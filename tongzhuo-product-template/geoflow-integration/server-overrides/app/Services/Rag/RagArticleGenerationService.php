<?php

namespace App\Services\Rag;

use App\Models\TongzhuoContentArticleCitation;
use App\Models\TongzhuoContentArticleVersion;
use App\Models\TongzhuoContentGenerationRun;
use App\Models\TongzhuoContentPlanItem;
use App\Models\TongzhuoContentWritingAgent;
use App\Services\TongzhuoAi\AiModelGateway;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Throwable;

class RagArticleGenerationService
{
    public function __construct(
        private readonly HybridKnowledgeRetriever $retriever,
        private readonly AiModelGateway $gateway,
    ) {}

    /**
     * @param array<string,mixed> $brief
     * @return array<string,mixed>
     */
    public function generate(array $brief, ?int $createdByAdminId = null): array
    {
        $title = trim((string) ($brief['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('文章标题不能为空。');
        }

        $planItem = $this->preparePlanItem($brief);
        if ($planItem && empty($brief['article_id']) && $planItem->article_id) {
            $brief['article_id'] = (int) $planItem->article_id;
        }
        $query = $this->retrievalQuery($brief);
        $filters = [
            'business_line_id' => $brief['business_line_id'] ?? null,
            'site_id' => $brief['site_id'] ?? null,
            'document_ids' => $brief['knowledge_document_ids'] ?? [],
            'visibility' => $brief['knowledge_visibility'] ?? ['internal', 'public'],
        ];

        $run = null;
        try {
            $run = TongzhuoContentGenerationRun::query()->create([
                'content_plan_item_id' => $brief['content_plan_item_id'] ?? null,
                'article_id' => $brief['article_id'] ?? null,
                'writing_agent_id' => $brief['writing_agent_id'] ?? null,
                'status' => 'running',
                'prompt_snapshot' => json_encode(['title' => $title, 'retrieval_query' => $query], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'brief_snapshot' => $this->safeBrief($brief),
                'knowledge_scope' => $filters,
                'started_at' => now(),
                'created_by_admin_id' => $createdByAdminId,
            ]);
            $retrieval = $this->retriever->search(
                $query,
                $filters,
                (int) ($brief['top_k'] ?? config('geoflow.rag.top_k', 6)),
                $brief['embedding_provider_id'] ?? null,
                $createdByAdminId,
            );
            $citations = $retrieval['citations'];
            if ($citations === [] && $this->requiresKnowledge($brief)) {
                throw new \InvalidArgumentException('当前业务线没有检索到已审核知识，已停止生成以避免模型编造企业事实。');
            }
            // Server retrieval always overrides any context supplied by a
            // caller; client-provided citations are never trusted as facts.
            $generationBrief = array_replace($brief, [
                'topic' => $title,
                'rag_context' => array_map(fn (array $citation): array => [
                    'key' => $citation['key'],
                    'title' => $citation['title'],
                    'excerpt' => $citation['excerpt'],
                    'locator' => $citation['locator'],
                    'source_url' => $citation['source_url'],
                ], $citations),
                'citations' => array_map(fn (array $citation): array => [
                    'key' => $citation['key'],
                    'document_id' => $citation['document_id'],
                    'document_version' => $citation['document_version'],
                    'chunk_id' => $citation['chunk_id'],
                    'title' => $citation['title'],
                    'source_url' => $citation['source_url'],
                    'locator' => $citation['locator'],
                ], $citations),
            ]);
            $systemPrompt = $this->systemPrompt($brief['writing_agent_id'] ?? null, $brief['system_prompt'] ?? null);
            $generation = $this->gateway->generateArticle(
                $generationBrief,
                $brief['chat_provider_id'] ?? null,
                array_filter([
                    'system_prompt' => $systemPrompt,
                    'temperature' => $brief['temperature'] ?? 0.3,
                    'max_tokens' => $brief['max_tokens'] ?? null,
                ], fn (mixed $value): bool => $value !== null),
            );

            $usedKeys = $this->usedCitationKeys((string) $generation['content']);
            $availableKeys = array_column($citations, 'key');
            $unknownKeys = array_values(array_diff($usedKeys, $availableKeys));
            $usedCitations = array_values(array_filter($citations, fn (array $citation): bool => in_array($citation['key'], $usedKeys, true)));
            $citationPassed = $unknownKeys === [] && ($citations === [] || $usedKeys !== []);
            if (! $citationPassed) {
                throw new \InvalidArgumentException('文章引用未通过知识证据校验，已停止保存。请确认正文只引用检索到的 [Kx] 证据。');
            }
            $this->validateArticleStructure((string) $generation['content'], $brief);

            $run->forceFill([
                'status' => 'succeeded',
                'provider' => (string) ($generation['provider_id'] ?? ''),
                'model' => (string) ($generation['model'] ?? ''),
                'retrieval_snapshot' => [
                    'rag_run_id' => $retrieval['run_id'],
                    'mode' => $retrieval['mode'],
                    'query' => $retrieval['query'],
                    'latency_ms' => $retrieval['latency_ms'],
                ],
                'citation_snapshot' => $citations,
                'usage' => $generation['usage'] ?? [],
                'completed_at' => now(),
            ])->save();

            if (! empty($brief['article_id'])) {
                $this->persistArticleCitations((int) $brief['article_id'], (int) $run->id, $usedCitations);
                $this->persistArticleVersion(
                    (int) $brief['article_id'],
                    (int) $run->id,
                    $planItem?->id,
                    $title,
                    (string) $generation['content'],
                    $citations,
                    $createdByAdminId,
                    [
                        'used' => $usedKeys,
                        'unknown' => $unknownKeys,
                        'passed' => $citationPassed,
                    ],
                );
            }
            if ($planItem) {
                $planItem->forceFill(array_filter([
                    'status' => 'draft',
                    'article_id' => $brief['article_id'] ?? null,
                    'completed_at' => now(),
                ], fn (mixed $value): bool => $value !== null))->save();
            }

            unset($generation['raw']);

            return [
                'content_generation_run_id' => (int) $run->id,
                'rag_run_id' => (int) $retrieval['run_id'],
                'content' => (string) $generation['content'],
                'model' => $generation['model'] ?? null,
                'provider_id' => $generation['provider_id'] ?? null,
                'usage' => $generation['usage'] ?? [],
                'citations' => $citations,
                'citation_check' => [
                    'available' => $availableKeys,
                    'used' => $usedKeys,
                    'unknown' => $unknownKeys,
                    'passed' => $citationPassed,
                ],
                'retrieval' => [
                    'mode' => $retrieval['mode'],
                    'latency_ms' => $retrieval['latency_ms'],
                    'embedding_error' => $retrieval['embedding_error'],
                ],
                'ai_generation_run_id' => $generation['generation_run_id'] ?? null,
            ];
        } catch (Throwable $exception) {
            if ($run) {
                $run->forceFill([
                    'status' => 'failed',
                    'error_message' => mb_substr($exception->getMessage(), 0, 2000),
                    'completed_at' => now(),
                ])->save();
            }
            if (isset($planItem) && $planItem) {
                $planItem->forceFill(['status' => 'failed', 'completed_at' => now()])->save();
            }
            throw $exception;
        }
    }

    /** @param array<string,mixed> $brief */
    private function retrievalQuery(array $brief): string
    {
        $parts = [
            $brief['title'] ?? '',
            $brief['primary_question'] ?? '',
            $brief['content_direction'] ?? '',
            $brief['user_intent'] ?? '',
            implode(' ', array_map('strval', (array) ($brief['keywords'] ?? []))),
        ];

        return trim(implode("\n", array_filter(array_map(fn (mixed $value): string => trim((string) $value), $parts))));
    }

    private function systemPrompt(mixed $agentId, mixed $override): ?string
    {
        $override = trim((string) $override);
        if ($override !== '') {
            return $override;
        }
        if (! is_numeric($agentId)) {
            return null;
        }
        $agent = TongzhuoContentWritingAgent::query()->where('enabled', true)->find((int) $agentId);

        return $agent ? (string) $agent->system_prompt : null;
    }

    /** @param array<string,mixed> $brief */
    private function requiresKnowledge(array $brief): bool
    {
        if (array_key_exists('require_knowledge', $brief)) {
            return (bool) $brief['require_knowledge'];
        }
        if (is_numeric($brief['writing_agent_id'] ?? null)) {
            $agent = TongzhuoContentWritingAgent::query()->find((int) $brief['writing_agent_id']);
            if ($agent) {
                return (bool) $agent->strict_knowledge;
            }
        }

        return true;
    }

    /** @return list<string> */
    private function usedCitationKeys(string $content): array
    {
        preg_match_all('/\[(K\d+)\]/iu', $content, $matches);

        return array_values(array_unique(array_map('strtoupper', $matches[1] ?? [])));
    }

    /** @param array<string,mixed> $brief */
    private function validateArticleStructure(string $content, array $brief): void
    {
        $content = trim($content);
        if (mb_strlen(strip_tags($content)) < 300) {
            throw new \InvalidArgumentException('文章正文过短，未形成可供 AI 读取的完整回答。');
        }
        if (preg_match('/<\/?script\b|<\/?style\b|\son\w+\s*=|javascript:/iu', $content)) {
            throw new \InvalidArgumentException('文章包含不安全 HTML 或脚本内容，已停止保存。');
        }
        $plain = mb_strtolower(strip_tags($content));
        $sections = [
            ['直接回答', 'direct_answer', '结论'],
            ['证据', '事实依据', 'evidence', '来源依据'],
            ['适用对象', '适用范围', '边界', 'scope'],
            ['步骤', '执行清单', '实施', 'steps'],
            ['faq', '常见问题', '常见追问', 'FAQ'],
            ['来源', '参考资料', 'sources', '更新时间'],
        ];
        foreach ($sections as $aliases) {
            $found = false;
            foreach ($aliases as $alias) {
                if (mb_stripos($plain, mb_strtolower($alias)) !== false) {
                    $found = true;
                    break;
                }
            }
            if (! $found) {
                throw new \InvalidArgumentException('文章缺少 AI 可读取的必要结构：'.(string) $aliases[0].'。');
            }
        }
        $question = trim((string) ($brief['primary_question'] ?? ''));
        if ($question !== '') {
            $questionKey = preg_replace('/[\s，,。.!！?？、:：;；“”"\'‘’（）()【】\[\]]+/u', '', mb_strtolower($question)) ?: mb_strtolower($question);
            $plainKey = preg_replace('/[\s，,。.!！?？、:：;；“”"\'‘’（）()【】\[\]]+/u', '', $plain) ?: $plain;
            if ($questionKey !== '' && mb_strlen($questionKey) >= 6 && mb_stripos($plainKey, $questionKey) === false) {
                throw new \InvalidArgumentException('文章没有明确回答来源客户问题，已停止保存。');
            }
        }
    }

    /** @param list<array<string,mixed>> $citations */
    private function persistArticleCitations(int $articleId, int $generationRunId, array $citations): void
    {
        if (! Schema::hasTable('tongzhuo_content_article_citations')) {
            return;
        }
        TongzhuoContentArticleCitation::query()
            ->where('article_id', $articleId)
            ->delete();
        foreach ($citations as $citation) {
            TongzhuoContentArticleCitation::query()->create([
                'article_id' => $articleId,
                'generation_run_id' => $generationRunId,
                'citation_key' => $citation['key'],
                'source_type' => 'knowledge_chunk',
                'source_id' => $citation['chunk_id'],
                'source_title' => $citation['title'],
                'source_url' => $citation['source_url'],
                'quote' => $citation['excerpt'],
                'locator' => $citation['locator'],
                'confidence' => $citation['score'] >= 0.75 ? 'high' : ($citation['score'] >= 0.45 ? 'medium' : 'low'),
                'metadata' => [
                    'document_id' => $citation['document_id'],
                    'document_version' => $citation['document_version'],
                    'content_hash' => $citation['content_hash'],
                    'rag_score' => $citation['score'],
                ],
            ]);
        }
    }

    /**
     * @param list<array<string,mixed>> $citations
     * @param array<string,mixed> $citationCheck
     */
    private function persistArticleVersion(
        int $articleId,
        int $generationRunId,
        ?int $planItemId,
        string $title,
        string $content,
        array $citations,
        ?int $createdByAdminId,
        array $citationCheck,
    ): void {
        if (! Schema::hasTable('tongzhuo_content_article_versions')) {
            return;
        }
        DB::transaction(function () use ($articleId, $generationRunId, $planItemId, $title, $content, $citations, $createdByAdminId, $citationCheck): void {
            $latest = TongzhuoContentArticleVersion::query()
                ->where('article_id', $articleId)
                ->orderByDesc('version_number')
                ->lockForUpdate()
                ->first();
            TongzhuoContentArticleVersion::query()->create([
                'article_id' => $articleId,
                'content_plan_item_id' => $planItemId,
                'generation_run_id' => $generationRunId,
                'version_number' => (int) ($latest?->version_number ?? 0) + 1,
                'status' => 'draft',
                'title' => $title,
                'content' => $content,
                'structured_content' => null,
                'citation_snapshot' => $citations,
                'quality_result' => ['citation_check' => $citationCheck],
                'created_by_admin_id' => $createdByAdminId,
            ]);
        });
    }

    /** @param array<string,mixed> $brief */
    private function preparePlanItem(array $brief): ?TongzhuoContentPlanItem
    {
        if (empty($brief['content_plan_item_id'])) {
            return null;
        }
        $item = TongzhuoContentPlanItem::query()->with('plan')->findOrFail((int) $brief['content_plan_item_id']);
        $requestedLine = isset($brief['business_line_id']) ? (int) $brief['business_line_id'] : null;
        if ($requestedLine && (int) $item->plan?->business_line_id !== $requestedLine) {
            throw new \InvalidArgumentException('内容任务与所选业务线不一致。');
        }
        if (! empty($brief['article_id']) && $item->article_id && (int) $item->article_id !== (int) $brief['article_id']) {
            throw new \InvalidArgumentException('内容任务已关联其他文章，不能覆盖写入。');
        }
        if (! in_array((string) $item->status, ['queued', 'draft', 'failed'], true)) {
            throw new \InvalidArgumentException('当前内容任务状态不能开始生成。');
        }
        $item->forceFill(['status' => 'generating', 'started_at' => now(), 'completed_at' => null])->save();

        return $item;
    }

    /** @param array<string,mixed> $brief @return array<string,mixed> */
    private function safeBrief(array $brief): array
    {
        return array_diff_key($brief, array_flip(['api_key', 'authorization', 'cookie', 'rag_context', 'citations']));
    }
}
