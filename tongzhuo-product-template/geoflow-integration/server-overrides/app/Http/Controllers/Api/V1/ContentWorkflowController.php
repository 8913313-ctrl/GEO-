<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\TongzhuoContentArticleCitation;
use App\Models\TongzhuoContentArticleVersion;
use App\Models\TongzhuoContentBusinessLine;
use App\Models\TongzhuoContentGenerationRun;
use App\Models\TongzhuoContentKeywordPack;
use App\Models\TongzhuoContentManagedKeyword;
use App\Models\TongzhuoContentPlan;
use App\Models\TongzhuoContentPlanItem;
use App\Models\TongzhuoContentQuestionLibraryItem;
use App\Models\TongzhuoContentTopicCandidate;
use App\Models\TongzhuoContentWritingAgent;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Private-deployment content workflow API.
 *
 * This controller intentionally stores only article_id/source_id references;
 * the existing GEOFlow Article and KnowledgeBase implementations remain the
 * source of truth.  Generation services can use the persisted brief,
 * knowledge_scope and retrieval_snapshot as their RAG contract.
 */
class ContentWorkflowController
{
    /** @return array<string,mixed> */
    private function payload(mixed $value = null, array $meta = []): array
    {
        return ['ok' => true, 'data' => $value instanceof Model ? $value->toArray() : $value, 'meta' => $meta];
    }

    private function ok(mixed $value = null, int $status = 200, array $meta = []): JsonResponse
    {
        return response()->json($this->payload($value, $meta), $status);
    }

    private function fail(string $message, int $status = 422, array $details = []): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => ['message' => $message, 'details' => $details]], $status);
    }

    private function notFound(string $message = '记录不存在'): JsonResponse
    {
        return $this->fail($message, 404);
    }

    private function line(int $id): ?TongzhuoContentBusinessLine
    {
        return TongzhuoContentBusinessLine::query()->find($id);
    }

    /** Return a 409 response when the caller supplied an outdated timestamp. */
    private function versionGuard(Request $request, Model $record): ?JsonResponse
    {
        $expected = trim((string) ($request->input('expected_updated_at') ?: $request->header('If-Unmodified-Since', '')));
        if ($expected === '' || $record->getAttribute('updated_at') === null) {
            return null;
        }

        try {
            $actual = Carbon::parse((string) $record->getAttribute('updated_at'));
            $wanted = Carbon::parse($expected);
        } catch (\Throwable) {
            return $this->fail('expected_updated_at 格式无效', 422, ['field' => 'expected_updated_at']);
        }

        if (abs($actual->diffInSeconds($wanted, false)) > 1) {
            return $this->fail('记录已被其他操作更新，请刷新后重试', 409, [
                'code' => 'stale_record',
                'current_updated_at' => $actual->toIso8601String(),
            ]);
        }

        return null;
    }

    /** @return array<string,mixed> */
    private function actor(Request $request): array
    {
        $auth = $request->attributes->get('access.auth') ?? $request->attributes->get('api.auth');
        if (is_array($auth)) {
            return $auth;
        }

        return ['type' => 'web', 'id' => auth('admin')->id() ?? null];
    }

    /** @return array<string,mixed> */
    private function authorFields(Request $request): array
    {
        $actor = $this->actor($request);
        $id = $actor['admin_id'] ?? $actor['user_id'] ?? $actor['id'] ?? null;

        return ['created_by_admin_id' => is_numeric($id) ? (int) $id : null];
    }

    public function businessLines(Request $request): JsonResponse
    {
        $query = TongzhuoContentBusinessLine::query()->orderBy('sort_order')->orderBy('id');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        $items = $query->get()->map(function (TongzhuoContentBusinessLine $line): array {
            $data = $line->toArray();
            $data['counts'] = [
                'keywords' => $line->keywords()->where('status', '!=', 'archived')->count(),
                'questions' => $line->questions()->where('status', '!=', 'archived')->count(),
                'topics' => $line->topics()->where('status', '!=', 'archived')->count(),
                'plans' => $line->plans()->where('status', '!=', 'archived')->count(),
            ];
            return $data;
        })->all();

        return $this->ok(['items' => $items, 'count' => count($items)]);
    }

    public function storeBusinessLine(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['nullable', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'string', 'in:active,archived'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'settings' => ['nullable', 'array'],
        ]);
        $data['slug'] = $this->uniqueSlug(TongzhuoContentBusinessLine::class, $data['slug'] ?? $data['name']);
        $line = TongzhuoContentBusinessLine::query()->create($data + $this->authorFields($request));

        return $this->ok($line, 201);
    }

    public function updateBusinessLine(Request $request, int $businessLine): JsonResponse
    {
        $line = $this->line($businessLine);
        if (! $line) {
            return $this->notFound('业务线不存在');
        }
        if ($conflict = $this->versionGuard($request, $line)) {
            return $conflict;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'string', 'in:active,archived'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'settings' => ['nullable', 'array'],
        ]);
        if (isset($data['slug']) && $data['slug'] !== $line->slug) {
            $data['slug'] = $this->uniqueSlug(TongzhuoContentBusinessLine::class, $data['slug'], $line->id);
        }
        $line->fill($data)->save();

        return $this->ok($line->fresh());
    }

    public function archiveBusinessLine(Request $request, int $businessLine): JsonResponse
    {
        $line = $this->line($businessLine);
        if (! $line) {
            return $this->notFound('业务线不存在');
        }
        if ($conflict = $this->versionGuard($request, $line)) {
            return $conflict;
        }
        $line->forceFill(['status' => 'archived'])->save();
        return $this->ok($line->fresh());
    }

    public function keywordPacks(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $query = TongzhuoContentKeywordPack::query()->where('business_line_id', $businessLine)->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        return $this->ok(['items' => $query->withCount('keywords')->get(), 'count' => $query->count()]);
    }

    public function storeKeywordPack(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'source' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'string', 'in:active,archived'],
            'description' => ['nullable', 'string', 'max:5000'],
            'metadata' => ['nullable', 'array'],
        ]);
        $pack = TongzhuoContentKeywordPack::query()->create($data + ['business_line_id' => $businessLine] + $this->authorFields($request));
        return $this->ok($pack, 201);
    }

    public function updateKeywordPack(Request $request, int $pack): JsonResponse
    {
        $record = TongzhuoContentKeywordPack::query()->find($pack);
        if (! $record) {
            return $this->notFound('关键词包不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'source' => ['sometimes', 'string', 'max:32'],
            'status' => ['sometimes', 'string', 'in:active,archived'],
            'description' => ['nullable', 'string', 'max:5000'],
            'metadata' => ['nullable', 'array'],
        ]);
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function archiveKeywordPack(Request $request, int $pack): JsonResponse
    {
        $record = TongzhuoContentKeywordPack::query()->find($pack);
        if (! $record) {
            return $this->notFound('关键词包不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $record->forceFill(['status' => 'archived'])->save();
        return $this->ok($record->fresh());
    }

    public function keywords(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $query = TongzhuoContentManagedKeyword::query()->where('business_line_id', $businessLine)->orderByDesc('id');
        foreach (['status', 'intent', 'priority', 'cluster_name'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->string($filter)->toString());
            }
        }
        if (! $request->filled('status')) {
            $query->where('status', 'active');
        }
        $items = $query->with('pack:id,name')->paginate(min(100, max(1, $request->integer('per_page', 30))));
        return $this->ok($items);
    }

    public function storeKeyword(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $data = $request->validate([
            'keyword' => ['required', 'string', 'max:240'],
            'keyword_pack_id' => ['nullable', 'integer', 'exists:tongzhuo_content_keyword_packs,id'],
            'intent' => ['nullable', 'string', 'max:40'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'dimensions' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (! empty($data['keyword_pack_id']) && ! TongzhuoContentKeywordPack::query()->whereKey($data['keyword_pack_id'])->where('business_line_id', $businessLine)->exists()) {
            return $this->fail('关键词包不属于当前业务线', 422, ['field' => 'keyword_pack_id']);
        }
        $data['business_line_id'] = $businessLine;
        $data['normalized_keyword'] = mb_strtolower(trim((string) $data['keyword']));
        $data += $this->authorFields($request);
        if (TongzhuoContentManagedKeyword::query()
            ->where('business_line_id', $businessLine)
            ->where('keyword_pack_id', $data['keyword_pack_id'] ?? null)
            ->where('normalized_keyword', $data['normalized_keyword'])
            ->exists()) {
            return $this->fail('同一关键词包中已存在该关键词', 409, ['code' => 'duplicate_keyword']);
        }
        $keyword = TongzhuoContentManagedKeyword::query()->create($data);
        return $this->ok($keyword, 201);
    }

    public function updateKeyword(Request $request, int $keyword): JsonResponse
    {
        $record = TongzhuoContentManagedKeyword::query()->find($keyword);
        if (! $record) {
            return $this->notFound('关键词不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'keyword' => ['sometimes', 'string', 'max:240'],
            'intent' => ['sometimes', 'string', 'max:40'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,critical'],
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'dimensions' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (isset($data['keyword'])) {
            $data['normalized_keyword'] = mb_strtolower(trim((string) $data['keyword']));
            if (TongzhuoContentManagedKeyword::query()
                ->where('business_line_id', $record->business_line_id)
                ->where('keyword_pack_id', $record->keyword_pack_id)
                ->where('normalized_keyword', $data['normalized_keyword'])
                ->where('id', '!=', $record->id)
                ->exists()) {
                return $this->fail('同一关键词包中已存在该关键词', 409, ['code' => 'duplicate_keyword']);
            }
        }
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function promoteKeywordToQuestion(Request $request, int $keyword): JsonResponse
    {
        $record = TongzhuoContentManagedKeyword::query()->find($keyword);
        if (! $record) {
            return $this->notFound('关键词不存在');
        }
        $data = $request->validate([
            'question' => ['required', 'string', 'max:5000'],
            'intent' => ['nullable', 'string', 'max:40'],
            'decision_stage' => ['nullable', 'string', 'max:32'],
            'follow_up_questions' => ['nullable', 'array'],
            'query_rewrites' => ['nullable', 'array'],
            'evidence_requirements' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'metadata' => ['nullable', 'array'],
        ]);
        $question = DB::transaction(function () use ($record, $data, $request): TongzhuoContentQuestionLibraryItem {
            $question = TongzhuoContentQuestionLibraryItem::query()->create($data + [
                'business_line_id' => $record->business_line_id,
                'managed_keyword_id' => $record->id,
                'cluster_name' => $record->cluster_name,
                'source' => 'keyword',
                'created_by_admin_id' => $this->authorFields($request)['created_by_admin_id'],
            ]);
            $record->forceFill(['status' => 'promoted', 'archived_at' => now()])->save();
            return $question;
        });
        return $this->ok($question, 201);
    }

    public function archiveKeyword(Request $request, int $keyword): JsonResponse
    {
        $record = TongzhuoContentManagedKeyword::query()->find($keyword);
        if (! $record) {
            return $this->notFound('关键词不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $record->forceFill(['status' => 'archived', 'archived_at' => now()])->save();
        return $this->ok($record->fresh());
    }

    public function questions(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $query = TongzhuoContentQuestionLibraryItem::query()->where('business_line_id', $businessLine)->orderByDesc('id');
        foreach (['status', 'intent', 'decision_stage', 'coverage_status', 'priority'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->string($filter)->toString());
            }
        }
        if (! $request->filled('status')) {
            $query->where('status', 'active');
        }
        return $this->ok($query->with('keyword:id,keyword')->paginate(min(100, max(1, $request->integer('per_page', 30)))));
    }

    public function storeQuestion(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $data = $request->validate([
            'managed_keyword_id' => ['nullable', 'integer', 'exists:tongzhuo_content_managed_keywords,id'],
            'question' => ['required', 'string', 'max:5000'],
            'intent' => ['nullable', 'string', 'max:40'],
            'decision_stage' => ['nullable', 'string', 'max:32'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'follow_up_questions' => ['nullable', 'array'],
            'query_rewrites' => ['nullable', 'array'],
            'evidence_requirements' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'status' => ['nullable', 'string', 'in:candidate,active,promoted,archived'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'coverage_status' => ['nullable', 'string', 'in:uncovered,in_progress,covered'],
            'source' => ['nullable', 'string', 'max:32'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (! empty($data['managed_keyword_id']) && ! TongzhuoContentManagedKeyword::query()->whereKey($data['managed_keyword_id'])->where('business_line_id', $businessLine)->exists()) {
            return $this->fail('关键词不属于当前业务线', 422, ['field' => 'managed_keyword_id']);
        }
        $question = TongzhuoContentQuestionLibraryItem::query()->create($data + ['business_line_id' => $businessLine] + $this->authorFields($request));
        return $this->ok($question, 201);
    }

    public function updateQuestion(Request $request, int $question): JsonResponse
    {
        $record = TongzhuoContentQuestionLibraryItem::query()->find($question);
        if (! $record) {
            return $this->notFound('问题不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'question' => ['sometimes', 'string', 'max:5000'],
            'intent' => ['sometimes', 'string', 'max:40'],
            'decision_stage' => ['sometimes', 'string', 'max:32'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'follow_up_questions' => ['nullable', 'array'],
            'query_rewrites' => ['nullable', 'array'],
            'evidence_requirements' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'status' => ['sometimes', 'string', 'in:candidate,active,promoted,archived'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,critical'],
            'coverage_status' => ['sometimes', 'string', 'in:uncovered,in_progress,covered'],
            'metadata' => ['nullable', 'array'],
        ]);
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function promoteQuestionToTopic(Request $request, int $question): JsonResponse
    {
        $record = TongzhuoContentQuestionLibraryItem::query()->find($question);
        if (! $record) {
            return $this->notFound('问题不存在');
        }
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:240'],
            'intent' => ['nullable', 'string', 'max:40'],
            'decision_stage' => ['nullable', 'string', 'max:32'],
            'proof_points' => ['nullable', 'array'],
            'evidence_types' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'audience_boundary' => ['nullable', 'string', 'max:5000'],
            'target_site_section' => ['nullable', 'string', 'max:120'],
            'output_type' => ['nullable', 'string', 'max:32'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'brief' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        $topic = DB::transaction(function () use ($record, $data, $request): TongzhuoContentTopicCandidate {
            $attributes = $data;
            $attributes['business_line_id'] = $record->business_line_id;
            $attributes['question_library_item_id'] = $record->id;
            $attributes['title'] = filled($data['title'] ?? null) ? (string) $data['title'] : Str::limit($record->question, 240, '');
            $attributes['primary_question'] = $record->question;
            $attributes['intent'] = filled($data['intent'] ?? null) ? (string) $data['intent'] : $record->intent;
            $attributes['decision_stage'] = filled($data['decision_stage'] ?? null) ? (string) $data['decision_stage'] : $record->decision_stage;
            $attributes['cluster_name'] = $record->cluster_name;
            $attributes['follow_up_questions'] = $record->follow_up_questions;
            $attributes['query_rewrites'] = $record->query_rewrites;
            $attributes['target_content_types'] = $data['target_content_types'] ?? $record->target_content_types;
            $attributes['created_by_admin_id'] = $this->authorFields($request)['created_by_admin_id'];
            $topic = TongzhuoContentTopicCandidate::query()->create($attributes);
            $record->forceFill(['status' => 'promoted', 'coverage_status' => 'in_progress', 'archived_at' => now()])->save();
            return $topic;
        });
        return $this->ok($topic, 201);
    }

    public function archiveQuestion(Request $request, int $question): JsonResponse
    {
        $record = TongzhuoContentQuestionLibraryItem::query()->find($question);
        if (! $record) {
            return $this->notFound('问题不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $record->forceFill(['status' => 'archived', 'archived_at' => now()])->save();
        return $this->ok($record->fresh());
    }

    public function topics(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $query = TongzhuoContentTopicCandidate::query()->where('business_line_id', $businessLine)->orderByDesc('id');
        foreach (['status', 'intent', 'decision_stage', 'coverage_status', 'priority'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->string($filter)->toString());
            }
        }
        if (! $request->filled('status')) {
            $query->where('status', 'active');
        }
        return $this->ok($query->with('question:id,question')->paginate(min(100, max(1, $request->integer('per_page', 30)))));
    }

    public function storeTopic(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $data = $request->validate([
            'question_library_item_id' => ['nullable', 'integer', 'exists:tongzhuo_content_question_library,id'],
            'title' => ['required', 'string', 'max:240'],
            'primary_question' => ['nullable', 'string', 'max:5000'],
            'intent' => ['nullable', 'string', 'max:40'],
            'decision_stage' => ['nullable', 'string', 'max:32'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'follow_up_questions' => ['nullable', 'array'],
            'query_rewrites' => ['nullable', 'array'],
            'proof_points' => ['nullable', 'array'],
            'evidence_types' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'audience_boundary' => ['nullable', 'string', 'max:5000'],
            'target_site_section' => ['nullable', 'string', 'max:120'],
            'output_type' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'string', 'in:candidate,active,planned,archived'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'coverage_status' => ['nullable', 'string', 'in:uncovered,in_progress,covered'],
            'brief' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (! empty($data['question_library_item_id']) && ! TongzhuoContentQuestionLibraryItem::query()->whereKey($data['question_library_item_id'])->where('business_line_id', $businessLine)->exists()) {
            return $this->fail('问题不属于当前业务线', 422, ['field' => 'question_library_item_id']);
        }
        $topic = TongzhuoContentTopicCandidate::query()->create($data + ['business_line_id' => $businessLine] + $this->authorFields($request));
        return $this->ok($topic, 201);
    }

    public function updateTopic(Request $request, int $topic): JsonResponse
    {
        $record = TongzhuoContentTopicCandidate::query()->find($topic);
        if (! $record) {
            return $this->notFound('选题不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:240'],
            'primary_question' => ['nullable', 'string', 'max:5000'],
            'intent' => ['sometimes', 'string', 'max:40'],
            'decision_stage' => ['sometimes', 'string', 'max:32'],
            'follow_up_questions' => ['nullable', 'array'],
            'query_rewrites' => ['nullable', 'array'],
            'proof_points' => ['nullable', 'array'],
            'evidence_types' => ['nullable', 'array'],
            'target_content_types' => ['nullable', 'array'],
            'audience_boundary' => ['nullable', 'string', 'max:5000'],
            'target_site_section' => ['nullable', 'string', 'max:120'],
            'output_type' => ['sometimes', 'string', 'max:32'],
            'status' => ['sometimes', 'string', 'in:candidate,active,planned,archived'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,critical'],
            'coverage_status' => ['sometimes', 'string', 'in:uncovered,in_progress,covered'],
            'brief' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function archiveTopic(Request $request, int $topic): JsonResponse
    {
        $record = TongzhuoContentTopicCandidate::query()->find($topic);
        if (! $record) {
            return $this->notFound('选题不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $record->forceFill(['status' => 'archived', 'archived_at' => now()])->save();
        return $this->ok($record->fresh());
    }

    public function promoteTopicToPlan(Request $request, int $topic): JsonResponse
    {
        $topicRecord = TongzhuoContentTopicCandidate::query()->find($topic);
        if (! $topicRecord) {
            return $this->notFound('选题不存在');
        }
        $data = $request->validate([
            'content_plan_id' => ['nullable', 'integer', 'exists:tongzhuo_content_plans,id'],
            'plan_title' => ['nullable', 'string', 'max:180'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'brief' => ['nullable', 'array'],
            'knowledge_scope' => ['nullable', 'array'],
        ]);
        if (! empty($data['content_plan_id']) && ! TongzhuoContentPlan::query()->whereKey($data['content_plan_id'])->where('business_line_id', $topicRecord->business_line_id)->exists()) {
            return $this->fail('计划不属于当前业务线', 422, ['field' => 'content_plan_id']);
        }
        $result = DB::transaction(function () use ($topicRecord, $data, $request): TongzhuoContentPlanItem {
            $plan = null;
            if (! empty($data['content_plan_id'])) {
                $plan = TongzhuoContentPlan::query()->whereKey($data['content_plan_id'])->where('business_line_id', $topicRecord->business_line_id)->lockForUpdate()->first();
            } else {
                $plan = TongzhuoContentPlan::query()->create([
                    'business_line_id' => $topicRecord->business_line_id,
                    'title' => $data['plan_title'] ?? ('选题计划 · '.now()->format('Y-m-d')),
                    'status' => 'draft',
                    'created_by_admin_id' => $this->authorFields($request)['created_by_admin_id'],
                ]);
            }
            $brief = $data['brief'] ?? ($topicRecord->brief ?: [
                'primary_question' => $topicRecord->primary_question,
                'intent' => $topicRecord->intent,
                'decision_stage' => $topicRecord->decision_stage,
                'proof_points' => $topicRecord->proof_points,
                'evidence_types' => $topicRecord->evidence_types,
                'audience_boundary' => $topicRecord->audience_boundary,
            ]);
            $item = $plan->items()->create([
                'topic_candidate_id' => $topicRecord->id,
                'question_library_item_id' => $topicRecord->question_library_item_id,
                'title' => $topicRecord->title,
                'output_type' => $topicRecord->output_type,
                'status' => 'queued',
                'priority' => $data['priority'] ?? $topicRecord->priority,
                'brief' => $brief,
                'knowledge_scope' => $data['knowledge_scope'] ?? [],
                'sort_order' => (int) $plan->items()->max('sort_order') + 1,
            ]);
            $topicRecord->forceFill(['status' => 'planned', 'coverage_status' => 'in_progress'])->save();
            return $item;
        });

        return $this->ok($result->load('plan', 'topic'), 201);
    }

    public function plans(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $query = TongzhuoContentPlan::query()->where('business_line_id', $businessLine)->withCount('items')->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        return $this->ok(['items' => $query->get(), 'count' => $query->count()]);
    }

    public function storePlan(Request $request, int $businessLine): JsonResponse
    {
        if (! $this->line($businessLine)) {
            return $this->notFound('业务线不存在');
        }
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'status' => ['nullable', 'string', 'in:draft,active,paused,completed,archived'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'cadence' => ['nullable', 'string', 'max:40'],
            'summary' => ['nullable', 'string', 'max:10000'],
            'settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        $plan = TongzhuoContentPlan::query()->create($data + ['business_line_id' => $businessLine] + $this->authorFields($request));
        return $this->ok($plan, 201);
    }

    public function showPlan(int $plan): JsonResponse
    {
        $record = TongzhuoContentPlan::query()->with(['businessLine:id,name,slug', 'items.topic:id,title,status', 'items.agent:id,name,slug'])->find($plan);
        return $record ? $this->ok($record) : $this->notFound('内容计划不存在');
    }

    public function updatePlan(Request $request, int $plan): JsonResponse
    {
        $record = TongzhuoContentPlan::query()->find($plan);
        if (! $record) {
            return $this->notFound('内容计划不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:180'],
            'status' => ['sometimes', 'string', 'in:draft,active,paused,completed,archived'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'cadence' => ['nullable', 'string', 'max:40'],
            'summary' => ['nullable', 'string', 'max:10000'],
            'settings' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);
        $allowed = [
            'draft' => ['active', 'archived'],
            'active' => ['paused', 'completed', 'archived'],
            'paused' => ['active', 'completed', 'archived'],
            'completed' => ['archived'],
            'archived' => [],
        ];
        if (isset($data['status']) && $data['status'] !== $record->status && ! in_array($data['status'], $allowed[$record->status] ?? [], true)) {
            return $this->fail('当前计划状态不能直接流转到目标状态', 409, ['from' => $record->status, 'to' => $data['status']]);
        }
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function storePlanItem(Request $request, int $plan): JsonResponse
    {
        $record = TongzhuoContentPlan::query()->find($plan);
        if (! $record) {
            return $this->notFound('内容计划不存在');
        }
        $data = $request->validate([
            'topic_candidate_id' => ['nullable', 'integer', 'exists:tongzhuo_content_topic_candidates,id'],
            'question_library_item_id' => ['nullable', 'integer', 'exists:tongzhuo_content_question_library,id'],
            'article_id' => ['nullable', 'integer', 'min:1'],
            'writing_agent_id' => ['nullable', 'integer', 'exists:tongzhuo_content_writing_agents,id'],
            'title' => ['required', 'string', 'max:240'],
            'output_type' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'string', 'in:queued,generating,draft,reviewing,approved,published,failed,archived'],
            'review_status' => ['nullable', 'string', 'in:unreviewed,pending,approved,rejected'],
            'priority' => ['nullable', 'string', 'in:low,medium,high,critical'],
            'brief' => ['nullable', 'array'],
            'knowledge_scope' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (! empty($data['topic_candidate_id']) && ! TongzhuoContentTopicCandidate::query()->whereKey($data['topic_candidate_id'])->where('business_line_id', $record->business_line_id)->exists()) {
            return $this->fail('选题不属于当前业务线', 422, ['field' => 'topic_candidate_id']);
        }
        if (! empty($data['question_library_item_id']) && ! TongzhuoContentQuestionLibraryItem::query()->whereKey($data['question_library_item_id'])->where('business_line_id', $record->business_line_id)->exists()) {
            return $this->fail('问题不属于当前业务线', 422, ['field' => 'question_library_item_id']);
        }
        $data['sort_order'] ??= (int) $record->items()->max('sort_order') + 1;
        $item = $record->items()->create($data);
        return $this->ok($item, 201);
    }

    public function updatePlanItem(Request $request, int $item): JsonResponse
    {
        $record = TongzhuoContentPlanItem::query()->find($item);
        if (! $record) {
            return $this->notFound('文章任务不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:240'],
            'article_id' => ['nullable', 'integer', 'min:1'],
            'writing_agent_id' => ['nullable', 'integer', 'exists:tongzhuo_content_writing_agents,id'],
            'status' => ['sometimes', 'string', 'in:queued,generating,draft,reviewing,approved,published,failed,archived'],
            'review_status' => ['sometimes', 'string', 'in:unreviewed,pending,approved,rejected'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,critical'],
            'brief' => ['nullable', 'array'],
            'knowledge_scope' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'metadata' => ['nullable', 'array'],
        ]);
        if (isset($data['status'])) {
            $allowed = [
                'queued' => ['generating', 'archived'],
                'generating' => ['draft', 'failed', 'queued'],
                'draft' => ['reviewing', 'generating', 'archived'],
                'reviewing' => ['approved', 'draft', 'failed'],
                'approved' => ['published', 'draft', 'archived'],
                'failed' => ['queued', 'generating', 'archived'],
                'published' => ['archived'],
                'archived' => [],
            ];
            if ($data['status'] !== $record->status && ! in_array($data['status'], $allowed[$record->status] ?? [], true)) {
                return $this->fail('文章任务不能直接流转到目标状态', 409, ['from' => $record->status, 'to' => $data['status']]);
            }
        }
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function updatePlanItemStatus(Request $request, int $item): JsonResponse
    {
        $record = TongzhuoContentPlanItem::query()->find($item);
        if (! $record) {
            return $this->notFound('文章任务不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate(['status' => ['required', 'string', 'in:queued,generating,draft,reviewing,approved,published,failed,archived'], 'review_status' => ['nullable', 'string', 'in:unreviewed,pending,approved,rejected'], 'message' => ['nullable', 'string', 'max:2000']]);
        $allowed = [
            'queued' => ['generating', 'archived'],
            'generating' => ['draft', 'failed', 'queued'],
            'draft' => ['reviewing', 'generating', 'archived'],
            'reviewing' => ['approved', 'draft', 'failed'],
            'approved' => ['published', 'draft', 'archived'],
            'failed' => ['queued', 'generating', 'archived'],
            'published' => ['archived'],
            'archived' => [],
        ];
        if ($data['status'] !== $record->status && ! in_array($data['status'], $allowed[$record->status] ?? [], true)) {
            return $this->fail('文章任务不能直接流转到目标状态', 409, ['from' => $record->status, 'to' => $data['status']]);
        }
        $updates = ['status' => $data['status']];
        if (isset($data['review_status'])) {
            $updates['review_status'] = $data['review_status'];
        }
        if (in_array($data['status'], ['approved', 'published'], true)) {
            $updates['review_status'] = 'approved';
        }
        if ($data['status'] === 'published') {
            $updates['completed_at'] = now();
        }
        $record->forceFill($updates)->save();
        return $this->ok(['item' => $record->fresh(), 'message' => $data['message'] ?? null]);
    }

    public function agents(Request $request): JsonResponse
    {
        $query = TongzhuoContentWritingAgent::query()->orderByDesc('is_default')->orderBy('name');
        if ($request->has('enabled')) {
            $query->where('enabled', $request->boolean('enabled'));
        }
        return $this->ok(['items' => $query->get(), 'count' => $query->count()]);
    }

    public function storeAgent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'system_prompt' => ['required', 'string', 'max:100000'],
            'output_contract' => ['nullable', 'array'],
            'style' => ['nullable', 'string', 'max:60'],
            'strict_knowledge' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'enabled' => ['nullable', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);
        $data['slug'] = $this->uniqueSlug(TongzhuoContentWritingAgent::class, $data['slug'] ?? $data['name']);
        if (($data['is_default'] ?? false) === true) {
            DB::table('tongzhuo_content_writing_agents')->update(['is_default' => false]);
        }
        $agent = TongzhuoContentWritingAgent::query()->create($data + $this->authorFields($request));
        return $this->ok($agent, 201);
    }

    public function updateAgent(Request $request, int $agent): JsonResponse
    {
        $record = TongzhuoContentWritingAgent::query()->find($agent);
        if (! $record) {
            return $this->notFound('写作智能体不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'system_prompt' => ['sometimes', 'string', 'max:100000'],
            'output_contract' => ['nullable', 'array'],
            'style' => ['nullable', 'string', 'max:60'],
            'strict_knowledge' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);
        if (isset($data['slug']) && $data['slug'] !== $record->slug) {
            $data['slug'] = $this->uniqueSlug(TongzhuoContentWritingAgent::class, $data['slug'], $record->id);
        }
        if (($data['is_default'] ?? false) === true) {
            DB::table('tongzhuo_content_writing_agents')->where('id', '!=', $record->id)->update(['is_default' => false]);
        }
        $record->fill($data)->save();
        return $this->ok($record->fresh());
    }

    public function createGenerationRun(Request $request): JsonResponse
    {
        $data = $request->validate([
            'content_plan_item_id' => ['nullable', 'integer', 'exists:tongzhuo_content_plan_items,id'],
            'article_id' => ['nullable', 'integer', 'min:1'],
            'writing_agent_id' => ['nullable', 'integer', 'exists:tongzhuo_content_writing_agents,id'],
            'provider' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:120'],
            'prompt_snapshot' => ['nullable', 'string', 'max:100000'],
            'brief_snapshot' => ['nullable', 'array'],
            'knowledge_scope' => ['nullable', 'array'],
            'retrieval_snapshot' => ['nullable', 'array'],
            'citation_snapshot' => ['nullable', 'array'],
        ]);
        if (empty($data['content_plan_item_id']) && empty($data['article_id'])) {
            return $this->fail('content_plan_item_id 与 article_id 至少提供一个', 422);
        }
        $run = DB::transaction(function () use ($data, $request): TongzhuoContentGenerationRun {
            $run = TongzhuoContentGenerationRun::query()->create($data + ['status' => 'queued'] + $this->authorFields($request));
            if ($run->content_plan_item_id) {
                TongzhuoContentPlanItem::query()->whereKey($run->content_plan_item_id)->whereIn('status', ['queued', 'draft', 'failed'])->update(['status' => 'generating', 'started_at' => now()]);
            }
            return $run;
        });
        return $this->ok($run, 201);
    }

    public function showGenerationRun(int $run): JsonResponse
    {
        $record = TongzhuoContentGenerationRun::query()
            ->with(['item:id,title,status,article_id', 'agent:id,name,slug'])
            ->find($run);
        return $record ? $this->ok($record) : $this->notFound('生成任务不存在');
    }

    public function updateGenerationRun(Request $request, int $run): JsonResponse
    {
        $record = TongzhuoContentGenerationRun::query()->find($run);
        if (! $record) {
            return $this->notFound('生成任务不存在');
        }
        if ($conflict = $this->versionGuard($request, $record)) {
            return $conflict;
        }
        $data = $request->validate([
            'status' => ['required', 'string', 'in:queued,running,succeeded,failed,cancelled'],
            'article_id' => ['nullable', 'integer', 'min:1'],
            'retrieval_snapshot' => ['nullable', 'array'],
            'citation_snapshot' => ['nullable', 'array'],
            'usage' => ['nullable', 'array'],
            'error_message' => ['nullable', 'string', 'max:10000'],
            'completed_at' => ['nullable', 'date'],
        ]);
        $updates = $data;
        $allowed = [
            'queued' => ['running', 'failed', 'cancelled'],
            'running' => ['succeeded', 'failed', 'cancelled'],
            'failed' => ['queued', 'running', 'cancelled'],
            'cancelled' => ['queued'],
            'succeeded' => [],
        ];
        if ($data['status'] !== $record->status && ! in_array($data['status'], $allowed[$record->status] ?? [], true)) {
            return $this->fail('生成任务不能直接流转到目标状态', 409, ['from' => $record->status, 'to' => $data['status']]);
        }
        if (in_array($data['status'], ['succeeded', 'failed', 'cancelled'], true) && empty($updates['completed_at'])) {
            $updates['completed_at'] = now();
        }
        DB::transaction(function () use ($record, $updates): void {
            $record->forceFill($updates)->save();
            if ($record->content_plan_item_id) {
                $itemStatus = match ($record->status) {
                    'succeeded' => 'draft',
                    'failed' => 'failed',
                    'cancelled' => 'queued',
                    'queued' => 'queued',
                    default => 'generating',
                };
                $itemUpdate = ['status' => $itemStatus];
                if ($record->article_id) {
                    $itemUpdate['article_id'] = $record->article_id;
                }
                TongzhuoContentPlanItem::query()->whereKey($record->content_plan_item_id)->update($itemUpdate);
            }
        });
        return $this->ok($record->fresh());
    }

    public function articleCitations(Request $request, int $article): JsonResponse
    {
        $query = TongzhuoContentArticleCitation::query()->where('article_id', $article)->orderBy('citation_key');
        return $this->ok(['items' => $query->get(), 'count' => $query->count()]);
    }

    public function storeArticleCitation(Request $request, int $article): JsonResponse
    {
        $data = $request->validate([
            'generation_run_id' => ['nullable', 'integer', 'exists:tongzhuo_content_generation_runs,id'],
            'citation_key' => ['required', 'string', 'max:32'],
            'source_type' => ['required', 'string', 'max:40'],
            'source_id' => ['nullable', 'integer', 'min:1'],
            'source_title' => ['nullable', 'string', 'max:240'],
            'source_url' => ['nullable', 'url', 'max:1000'],
            'quote' => ['nullable', 'string', 'max:10000'],
            'locator' => ['nullable', 'string', 'max:240'],
            'confidence' => ['nullable', 'string', 'in:low,medium,high,verified'],
            'metadata' => ['nullable', 'array'],
        ]);
        $citation = TongzhuoContentArticleCitation::query()->updateOrCreate(['article_id' => $article, 'citation_key' => $data['citation_key']], $data);
        return $this->ok($citation, $citation->wasRecentlyCreated ? 201 : 200);
    }

    public function articleVersions(Request $request, int $article): JsonResponse
    {
        $items = TongzhuoContentArticleVersion::query()->where('article_id', $article)->orderByDesc('version_number')->get();
        return $this->ok(['items' => $items, 'count' => $items->count()]);
    }

    public function storeArticleVersion(Request $request, int $article): JsonResponse
    {
        $data = $request->validate([
            'content_plan_item_id' => ['nullable', 'integer', 'exists:tongzhuo_content_plan_items,id'],
            'generation_run_id' => ['nullable', 'integer', 'exists:tongzhuo_content_generation_runs,id'],
            'version_number' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'in:draft,reviewing,approved,published,archived'],
            'title' => ['required', 'string', 'max:240'],
            'content' => ['required', 'string'],
            'structured_content' => ['nullable', 'array'],
            'citation_snapshot' => ['nullable', 'array'],
            'quality_result' => ['nullable', 'array'],
        ]);
        $version = DB::transaction(function () use ($data, $article, $request): TongzhuoContentArticleVersion {
            $last = TongzhuoContentArticleVersion::query()
                ->where('article_id', $article)
                ->orderByDesc('version_number')
                ->lockForUpdate()
                ->first();
            $attributes = $data;
            $attributes['version_number'] ??= ((int) ($last?->version_number ?? 0)) + 1;
            $version = TongzhuoContentArticleVersion::query()->create($attributes + ['article_id' => $article] + $this->authorFields($request));
            if (! empty($attributes['content_plan_item_id'])) {
                TongzhuoContentPlanItem::query()->whereKey($attributes['content_plan_item_id'])->update([
                    'article_id' => $article,
                    'status' => ($attributes['status'] ?? 'draft') === 'published' ? 'published' : 'draft',
                ]);
            }
            return $version;
        });
        return $this->ok($version, 201);
    }

    private function uniqueSlug(string $model, string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug(trim($value));
        if ($base === '') {
            $base = 'item';
        }
        $slug = $base;
        $suffix = 2;
        while (($query = $model::query()->where('slug', $slug))->when($ignoreId !== null, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$suffix++;
        }
        return $slug;
    }
}
