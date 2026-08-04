<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoKnowledgeDocument;
use App\Services\Access\AccessControlService;
use App\Services\Rag\KnowledgeIndexService;
use App\Services\TongzhuoAi\AiGatewayException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KnowledgeDocumentController extends Controller
{
    public function __construct(
        private readonly KnowledgeIndexService $indexer,
        private readonly AccessControlService $access,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_line_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['draft', 'indexing', 'ready', 'failed', 'archived'])],
            'review_status' => ['nullable', Rule::in(['pending', 'confirmed', 'rejected'])],
            'q' => ['nullable', 'string', 'max:200'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $query = TongzhuoKnowledgeDocument::query()->withCount('chunks')->latest('id');
        foreach (['business_line_id', 'status', 'review_status'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null && $data[$field] !== '') {
                $query->where($field, $data[$field]);
            }
        }
        if (! empty($data['q'])) {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($data['q'])).'%';
            $query->where(fn ($scope) => $scope->where('title', 'like', $needle)->orWhere('description', 'like', $needle));
        }

        $page = $query->paginate((int) ($data['per_page'] ?? 20));
        $page->getCollection()->transform(fn (TongzhuoKnowledgeDocument $document): array => $this->payload($document));

        return response()->json(['ok' => true, 'data' => $page]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedDocument($request);
        $data['content_hash'] = hash('sha256', $data['content']);
        $data['version'] = 1;
        $data['status'] = 'draft';
        $data['created_by_admin_id'] = $this->currentAdminId();
        if (($data['review_status'] ?? 'confirmed') === 'confirmed') {
            $data['reviewed_by_admin_id'] = $this->currentAdminId();
            $data['reviewed_at'] = now();
        }
        $document = TongzhuoKnowledgeDocument::query()->create($data);
        $this->access->audit('knowledge.document.created', 'knowledge_document', $document->id, ['title' => $document->title]);

        return response()->json(['ok' => true, 'data' => $this->payload($document)], 201);
    }

    public function show(int $documentId): JsonResponse
    {
        $document = TongzhuoKnowledgeDocument::query()->with('chunks')->findOrFail($documentId);
        $payload = $this->payload($document);
        $payload['content'] = $document->content;
        $payload['chunks'] = $document->chunks->map(fn ($chunk): array => [
            'id' => (int) $chunk->id,
            'ordinal' => (int) $chunk->ordinal,
            'heading' => $chunk->heading,
            'content' => $chunk->content,
            'locator' => $chunk->locator,
            'status' => $chunk->status,
            'embedding_model' => $chunk->embedding_model,
            'embedding_dimensions' => $chunk->embedding_dimensions,
            'embedded_at' => $chunk->embedded_at?->toIso8601String(),
        ])->all();

        return response()->json(['ok' => true, 'data' => $payload]);
    }

    public function update(Request $request, int $documentId): JsonResponse
    {
        $document = TongzhuoKnowledgeDocument::query()->findOrFail($documentId);
        $data = $this->validatedDocument($request, true);
        if (array_key_exists('content', $data)) {
            $hash = hash('sha256', $data['content']);
            if (! hash_equals((string) $document->content_hash, $hash)) {
                $data['content_hash'] = $hash;
                $data['version'] = (int) $document->version + 1;
                $data['status'] = 'draft';
                $data['indexed_at'] = null;
                $data['index_error'] = null;
            }
        }
        if (($data['review_status'] ?? null) === 'confirmed' && $document->review_status !== 'confirmed') {
            $data['reviewed_by_admin_id'] = $this->currentAdminId();
            $data['reviewed_at'] = now();
        }
        $document->fill($data)->save();
        $this->access->audit('knowledge.document.updated', 'knowledge_document', $document->id, ['version' => $document->version]);

        return response()->json(['ok' => true, 'data' => $this->payload($document->refresh())]);
    }

    public function archive(int $documentId): JsonResponse
    {
        $document = TongzhuoKnowledgeDocument::query()->findOrFail($documentId);
        $document->forceFill(['status' => 'archived'])->save();
        $this->access->audit('knowledge.document.archived', 'knowledge_document', $document->id);

        return response()->json(['ok' => true, 'data' => $this->payload($document)]);
    }

    public function indexDocument(Request $request, int $documentId): JsonResponse
    {
        $data = $request->validate(['embedding_provider_id' => ['nullable', 'integer', 'exists:ai_providers,id']]);
        $document = TongzhuoKnowledgeDocument::query()->findOrFail($documentId);
        try {
            $result = $this->indexer->index($document, $data['embedding_provider_id'] ?? null);
        } catch (AiGatewayException $exception) {
            return response()->json(['ok' => false, 'error' => [
                'code' => $exception->errorCode(),
                'message' => $exception->getMessage(),
                'retryable' => $exception->retryable(),
            ]], $exception->httpStatus());
        }
        $this->access->audit('knowledge.document.indexed', 'knowledge_document', $document->id, $result);

        return response()->json(['ok' => true, 'data' => $result]);
    }

    /** @return array<string,mixed> */
    private function validatedDocument(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'site_id' => ['nullable', 'integer'],
            'business_line_id' => ['nullable', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'title' => [$required, 'string', 'max:240'],
            'description' => ['nullable', 'string', 'max:5000'],
            'source_type' => ['sometimes', Rule::in(['manual', 'file', 'url', 'fact', 'cms'])],
            'source_format' => ['sometimes', Rule::in(['text', 'markdown', 'md', 'html'])],
            'source_url' => ['nullable', 'url', 'max:1000'],
            'source_path' => ['nullable', 'string', 'max:1000'],
            'mime_type' => ['nullable', 'string', 'max:160'],
            'content' => [$required, 'string', 'max:5000000'],
            'language' => ['sometimes', 'string', 'max:20'],
            'visibility' => ['sometimes', Rule::in(['internal', 'public', 'restricted'])],
            'review_status' => ['sometimes', Rule::in(['pending', 'confirmed', 'rejected'])],
            'metadata' => ['nullable', 'array'],
        ]);
    }

    /** @return array<string,mixed> */
    private function payload(TongzhuoKnowledgeDocument $document): array
    {
        return [
            'id' => (int) $document->id,
            'site_id' => $document->site_id,
            'business_line_id' => $document->business_line_id,
            'title' => (string) $document->title,
            'description' => $document->description,
            'source_type' => (string) $document->source_type,
            'source_format' => (string) $document->source_format,
            'source_url' => $document->source_url,
            'mime_type' => $document->mime_type,
            'content_hash' => (string) $document->content_hash,
            'version' => (int) $document->version,
            'language' => (string) $document->language,
            'visibility' => (string) $document->visibility,
            'review_status' => (string) $document->review_status,
            'status' => (string) $document->status,
            'chunks_count' => (int) ($document->chunks_count ?? $document->chunks()->count()),
            'indexed_at' => $document->indexed_at?->toIso8601String(),
            'index_error' => $document->index_error,
            'metadata' => (array) $document->metadata,
            'created_at' => $document->created_at?->toIso8601String(),
            'updated_at' => $document->updated_at?->toIso8601String(),
        ];
    }

    private function currentAdminId(): ?int
    {
        return $this->access->adminId($this->access->currentAdmin());
    }
}
