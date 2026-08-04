<?php

namespace App\Services\Rag;

use App\Models\TongzhuoKnowledgeChunk;
use App\Models\TongzhuoKnowledgeDocument;
use App\Services\TongzhuoAi\AiModelGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class KnowledgeIndexService
{
    public function __construct(
        private readonly KnowledgeChunker $chunker,
        private readonly AiModelGateway $gateway,
    ) {}

    /**
     * Rebuild a document index with real provider embeddings. Network calls
     * happen before the transaction so a slow model cannot hold DB locks.
     *
     * @return array{document_id:int,version:int,chunks:int,provider_id:int,model:string,dimensions:int,storage_mode:string}
     */
    public function index(TongzhuoKnowledgeDocument $document, int|string|null $provider = null): array
    {
        $document->forceFill(['status' => 'indexing', 'index_error' => null])->save();

        try {
            $chunks = $this->chunker->chunk(
                (string) $document->content,
                (string) $document->source_format,
            );
            if ($chunks === []) {
                throw new RuntimeException('知识文档没有可索引的正文。');
            }

            $vectors = [];
            $providerId = 0;
            $model = '';
            $batchSize = max(1, min(128, (int) config('geoflow.rag.embedding_batch_size', 64)));
            $inputs = array_map(fn (array $chunk): string => $chunk['content'], $chunks);
            foreach (array_chunk($inputs, $batchSize) as $batch) {
                $response = $this->gateway->embeddings(
                    $batch,
                    $providerId > 0 ? $providerId : $provider,
                    ['purpose' => 'knowledge_document'],
                );
                $responseProviderId = (int) ($response['provider_id'] ?? 0);
                if ($responseProviderId < 1 || ($providerId > 0 && $responseProviderId !== $providerId)) {
                    throw new RuntimeException('知识索引批次使用了不一致的 Embedding Provider。');
                }
                $providerId = $responseProviderId;
                $responseModel = trim((string) ($response['model'] ?? ''));
                if ($model !== '' && $responseModel !== $model) {
                    throw new RuntimeException('知识索引批次使用了不一致的 Embedding 模型。');
                }
                $model = $responseModel;
                $batchVectors = $response['vectors'] ?? [];
                if (! is_array($batchVectors) || count($batchVectors) !== count($batch)) {
                    throw new RuntimeException('Embedding 批次返回数量与知识切片数量不一致。');
                }
                array_push($vectors, ...$batchVectors);
            }
            if (! is_array($vectors) || count($vectors) !== count($chunks)) {
                throw new RuntimeException('Embedding 返回数量与知识切片数量不一致。');
            }

            $dimensions = count($vectors[0] ?? []);
            if ($dimensions < 1) {
                throw new RuntimeException('Embedding 未返回有效向量。');
            }
            foreach ($vectors as $vector) {
                if (! is_array($vector) || count($vector) !== $dimensions) {
                    throw new RuntimeException('Embedding 向量维度不一致。');
                }
            }

            if ($providerId < 1) {
                throw new RuntimeException('Embedding 响应缺少 provider_id。');
            }
            $pgvector = $this->pgvectorAvailable();
            DB::transaction(function () use ($document, $chunks, $vectors, $providerId, $model, $dimensions, $pgvector): void {
                TongzhuoKnowledgeChunk::query()->where('document_id', $document->id)->delete();

                foreach ($chunks as $index => $chunkData) {
                    $vector = array_map('floatval', $vectors[$index]);
                    $chunk = TongzhuoKnowledgeChunk::query()->create([
                        'document_id' => $document->id,
                        'document_version' => $document->version,
                        'ordinal' => $index + 1,
                        'heading' => $chunkData['heading'],
                        'content' => $chunkData['content'],
                        'content_hash' => hash('sha256', $chunkData['content']),
                        'character_count' => $chunkData['character_count'],
                        'token_count' => $chunkData['token_count'],
                        'locator' => $chunkData['locator'],
                        'embedding_provider_id' => $providerId,
                        'embedding_model' => $model,
                        'embedding_dimensions' => $dimensions,
                        'embedding_json' => $vector,
                        'embedded_at' => now(),
                        'status' => 'ready',
                        'metadata' => ['storage' => $pgvector ? 'pgvector+json' : 'json'],
                    ]);

                    if ($pgvector) {
                        $this->writePgvector((int) $chunk->id, $vector);
                    }
                }

                $document->forceFill([
                    'status' => 'ready',
                    'indexed_at' => now(),
                    'index_error' => null,
                    'metadata' => array_merge((array) $document->metadata, [
                        'embedding_provider_id' => $providerId,
                        'embedding_model' => $model,
                        'embedding_dimensions' => $dimensions,
                        'chunk_count' => count($chunks),
                        'vector_storage' => $pgvector ? 'pgvector+json' : 'json',
                    ]),
                ])->save();
            });

            return [
                'document_id' => (int) $document->id,
                'version' => (int) $document->version,
                'chunks' => count($chunks),
                'provider_id' => $providerId,
                'model' => $model,
                'dimensions' => $dimensions,
                'storage_mode' => $pgvector ? 'pgvector+json' : 'json',
            ];
        } catch (Throwable $exception) {
            $document->forceFill([
                'status' => 'failed',
                'index_error' => mb_substr($exception->getMessage(), 0, 2000),
            ])->save();
            throw $exception;
        }
    }

    public function pgvectorAvailable(): bool
    {
        if (DB::getDriverName() !== 'pgsql') {
            return false;
        }

        try {
            return Schema::hasColumn('tongzhuo_knowledge_chunks', 'embedding_vector');
        } catch (Throwable) {
            return false;
        }
    }

    /** @param list<float> $vector */
    private function writePgvector(int $chunkId, array $vector): void
    {
        $literal = '['.implode(',', array_map(fn (float $value): string => sprintf('%.10F', $value), $vector)).']';
        DB::update(
            'UPDATE tongzhuo_knowledge_chunks SET embedding_vector = ?::vector WHERE id = ?',
            [$literal, $chunkId],
        );
    }
}
