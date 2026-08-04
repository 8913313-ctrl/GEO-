<?php

namespace App\Services\Rag;

use App\Models\TongzhuoKnowledgeChunk;
use App\Models\TongzhuoRagCitation;
use App\Models\TongzhuoRagRun;
use App\Services\TongzhuoAi\AiModelGateway;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class HybridKnowledgeRetriever
{
    public function __construct(
        private readonly AiModelGateway $gateway,
        private readonly KnowledgeIndexService $indexer,
    ) {}

    /**
     * @param array<string,mixed> $filters
     * @return array{run_id:int,request_id:string,mode:string,query:string,citations:list<array<string,mixed>>,latency_ms:int,embedding_error:?string}
     */
    public function search(
        string $query,
        array $filters = [],
        int $topK = 6,
        int|string|null $embeddingProvider = null,
        ?int $createdByAdminId = null,
    ): array {
        $startedAt = microtime(true);
        $query = trim($query);
        if ($query === '') {
            throw new \InvalidArgumentException('RAG 检索问题不能为空。');
        }

        $topK = max(1, min(20, $topK));
        $requestId = (string) Str::uuid();
        $queryVector = null;
        $providerId = null;
        $embeddingError = null;
        try {
            $embedding = $this->gateway->embeddings($query, $embeddingProvider, ['purpose' => 'knowledge_query']);
            $queryVector = array_map('floatval', (array) (($embedding['vectors'][0] ?? null)));
            $providerId = isset($embedding['provider_id']) ? (int) $embedding['provider_id'] : null;
            if ($queryVector === []) {
                throw new \RuntimeException('Embedding 查询向量为空。');
            }
        } catch (Throwable $exception) {
            $embeddingError = mb_substr($exception->getMessage(), 0, 500);
        }

        $candidateLimit = max($topK * 12, min(10000, (int) config('geoflow.rag.candidate_limit', 2000)));
        $mode = 'keyword_fallback';
        $candidates = null;

        if ($queryVector !== null && $this->indexer->pgvectorAvailable()) {
            try {
                $candidates = $this->pgvectorCandidates($queryVector, $filters, $candidateLimit);
                $mode = 'pgvector_hybrid';
            } catch (Throwable $exception) {
                $embeddingError = trim(($embeddingError ? $embeddingError.'; ' : '').'pgvector: '.$exception->getMessage());
            }
        }

        if ($candidates === null) {
            $candidates = $this->baseCandidates($filters)->limit($candidateLimit)->get();
            $mode = $queryVector !== null ? 'json_vector_hybrid' : 'keyword_fallback';
        }

        $vectorWeight = $queryVector !== null ? (float) config('geoflow.rag.vector_weight', 0.72) : 0.0;
        $vectorWeight = min(1, max(0, $vectorWeight));
        $keywordWeight = 1 - $vectorWeight;
        $ranked = $candidates->map(function (TongzhuoKnowledgeChunk $chunk) use ($query, $queryVector, $vectorWeight, $keywordWeight): array {
            $vectorScore = isset($chunk->vector_score)
                ? (float) $chunk->vector_score
                : $this->cosine($queryVector, $chunk->embedding_json);
            $keywordScore = $this->keywordScore($query, (string) $chunk->content, (string) ($chunk->document?->title ?? ''));
            $score = ($vectorScore === null ? 0 : max(0, min(1, $vectorScore))) * $vectorWeight
                + $keywordScore * $keywordWeight;

            return [
                'chunk' => $chunk,
                'score' => $score,
                'vector_score' => $vectorScore,
                'keyword_score' => $keywordScore,
            ];
        })->filter(function (array $result) use ($queryVector): bool {
            return $queryVector !== null || $result['keyword_score'] > 0;
        })->sortByDesc('score')->take($topK)->values();

        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);
        $run = TongzhuoRagRun::query()->create([
            'business_line_id' => isset($filters['business_line_id']) ? (int) $filters['business_line_id'] : null,
            'embedding_provider_id' => $providerId,
            'query' => $query,
            'retrieval_mode' => $mode,
            'top_k' => $topK,
            'filters' => $this->safeFilters($filters),
            'latency_ms' => $latencyMs,
            'request_id' => $requestId,
            'created_by_admin_id' => $createdByAdminId,
        ]);

        $citations = [];
        foreach ($ranked as $index => $result) {
            /** @var TongzhuoKnowledgeChunk $chunk */
            $chunk = $result['chunk'];
            $document = $chunk->document;
            if (! $document) {
                continue;
            }
            $key = 'K'.($index + 1);
            $excerpt = $this->excerpt((string) $chunk->content, $query);
            $payload = [
                'key' => $key,
                'document_id' => (int) $document->id,
                'document_version' => (int) $chunk->document_version,
                'chunk_id' => (int) $chunk->id,
                'title' => (string) $document->title,
                'source_type' => (string) $document->source_type,
                'source_url' => $document->source_url,
                'locator' => $chunk->locator,
                'excerpt' => $excerpt,
                'score' => round((float) $result['score'], 6),
                'vector_score' => $result['vector_score'] === null ? null : round((float) $result['vector_score'], 6),
                'keyword_score' => round((float) $result['keyword_score'], 6),
                'content_hash' => (string) $chunk->content_hash,
            ];
            TongzhuoRagCitation::query()->create([
                'rag_run_id' => $run->id,
                'document_id' => $document->id,
                'chunk_id' => $chunk->id,
                'citation_key' => $key,
                'score' => $payload['score'],
                'vector_score' => $payload['vector_score'],
                'keyword_score' => $payload['keyword_score'],
                'excerpt' => $excerpt,
                'locator' => $chunk->locator,
                'metadata' => [
                    'document_version' => (int) $chunk->document_version,
                    'content_hash' => (string) $chunk->content_hash,
                    'source_url' => $document->source_url,
                ],
            ]);
            $citations[] = $payload;
        }

        $run->forceFill(['result_snapshot' => $citations])->save();

        return [
            'run_id' => (int) $run->id,
            'request_id' => $requestId,
            'mode' => $mode,
            'query' => $query,
            'citations' => $citations,
            'latency_ms' => $latencyMs,
            'embedding_error' => $embeddingError,
        ];
    }

    /** @param array<string,mixed> $filters */
    private function baseCandidates(array $filters): Builder
    {
        $query = TongzhuoKnowledgeChunk::query()
            ->with('document')
            ->where('tongzhuo_knowledge_chunks.status', 'ready')
            ->whereHas('document', function (Builder $documents) use ($filters): void {
                $documents->where('status', 'ready')->where('review_status', 'confirmed');
                if (isset($filters['business_line_id']) && (int) $filters['business_line_id'] > 0) {
                    $lineId = (int) $filters['business_line_id'];
                    $documents->where(fn (Builder $scope) => $scope->whereNull('business_line_id')->orWhere('business_line_id', $lineId));
                }
                if (isset($filters['site_id']) && (int) $filters['site_id'] > 0) {
                    $documents->where('site_id', (int) $filters['site_id']);
                }
                if (! empty($filters['visibility'])) {
                    $documents->whereIn('visibility', array_values(array_filter((array) $filters['visibility'], 'is_string')));
                }
                if (! empty($filters['document_ids'])) {
                    $documents->whereIn('id', array_map('intval', (array) $filters['document_ids']));
                }
            });

        return $query;
    }

    /** @param list<float> $vector @param array<string,mixed> $filters */
    private function pgvectorCandidates(array $vector, array $filters, int $limit): Collection
    {
        $literal = '['.implode(',', array_map(fn (float $value): string => sprintf('%.10F', $value), $vector)).']';

        return $this->baseCandidates($filters)
            ->whereNotNull('embedding_vector')
            ->where('embedding_dimensions', count($vector))
            ->select('tongzhuo_knowledge_chunks.*')
            ->selectRaw('1 - (embedding_vector <=> ?::vector) AS vector_score', [$literal])
            ->orderByDesc('vector_score')
            ->limit($limit)
            ->get();
    }

    /** @param list<float>|null $left @param mixed $right */
    private function cosine(?array $left, mixed $right): ?float
    {
        if ($left === null || ! is_array($right) || count($left) !== count($right) || $left === []) {
            return null;
        }
        $dot = 0.0;
        $leftNorm = 0.0;
        $rightNorm = 0.0;
        foreach ($left as $index => $value) {
            $a = (float) $value;
            $b = (float) $right[$index];
            $dot += $a * $b;
            $leftNorm += $a * $a;
            $rightNorm += $b * $b;
        }
        if ($leftNorm <= 0 || $rightNorm <= 0) {
            return null;
        }

        return $dot / (sqrt($leftNorm) * sqrt($rightNorm));
    }

    private function keywordScore(string $query, string $content, string $title): float
    {
        $normalQuery = $this->normal($query);
        $normalContent = $this->normal($title.' '.$content);
        if ($normalQuery === '' || $normalContent === '') {
            return 0.0;
        }

        $exact = str_contains($normalContent, $normalQuery) ? 1.0 : 0.0;
        $tokens = $this->tokens($normalQuery);
        if ($tokens === []) {
            return $exact;
        }
        $matched = 0;
        foreach ($tokens as $token) {
            if (str_contains($normalContent, $token)) {
                $matched++;
            }
        }
        $coverage = $matched / count($tokens);
        $titleBoost = str_contains($this->normal($title), $normalQuery) ? 0.15 : 0.0;

        return min(1.0, $exact * 0.55 + $coverage * 0.45 + $titleBoost);
    }

    /** @return list<string> */
    private function tokens(string $text): array
    {
        $tokens = [];
        preg_match_all('/[a-z0-9][a-z0-9._-]{1,}/iu', $text, $latin);
        foreach ($latin[0] ?? [] as $token) {
            $tokens[] = mb_strtolower($token);
        }
        preg_match_all('/[\x{3400}-\x{9FFF}]{2,}/u', $text, $hanRuns);
        foreach ($hanRuns[0] ?? [] as $run) {
            $length = mb_strlen($run);
            for ($i = 0; $i < $length - 1; $i++) {
                $tokens[] = mb_substr($run, $i, min(3, $length - $i));
            }
        }

        return array_values(array_unique(array_filter($tokens, fn (string $token): bool => mb_strlen($token) >= 2)));
    }

    private function normal(string $text): string
    {
        return preg_replace('/[^\p{L}\p{N}._-]+/u', '', mb_strtolower(trim($text))) ?? '';
    }

    private function excerpt(string $content, string $query): string
    {
        $limit = max(180, (int) config('geoflow.rag.excerpt_chars', 480));
        if (mb_strlen($content) <= $limit) {
            return trim($content);
        }
        $needle = mb_substr(trim($query), 0, 30);
        $position = $needle !== '' ? mb_stripos($content, $needle) : false;
        $start = $position === false ? 0 : max(0, $position - (int) floor($limit / 3));

        return ($start > 0 ? '…' : '').trim(mb_substr($content, $start, $limit)).'…';
    }

    /** @param array<string,mixed> $filters @return array<string,mixed> */
    private function safeFilters(array $filters): array
    {
        return array_intersect_key($filters, array_flip(['business_line_id', 'site_id', 'visibility', 'document_ids']));
    }
}
