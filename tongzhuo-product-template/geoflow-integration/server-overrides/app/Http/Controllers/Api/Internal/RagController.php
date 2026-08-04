<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Services\Access\AccessControlService;
use App\Services\Rag\HybridKnowledgeRetriever;
use App\Services\Rag\RagArticleGenerationService;
use App\Services\TongzhuoAi\AiGatewayException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class RagController extends Controller
{
    public function __construct(
        private readonly HybridKnowledgeRetriever $retriever,
        private readonly RagArticleGenerationService $generator,
        private readonly AccessControlService $access,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'max:3000'],
            'business_line_id' => ['nullable', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'site_id' => ['nullable', 'integer'],
            'document_ids' => ['nullable', 'array', 'max:100'],
            'document_ids.*' => ['integer', 'exists:tongzhuo_knowledge_documents,id'],
            'visibility' => ['nullable', 'array'],
            'visibility.*' => ['string', 'in:internal,public,restricted'],
            'top_k' => ['nullable', 'integer', 'min:1', 'max:20'],
            'embedding_provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
        ]);
        $data['visibility'] ??= ['internal', 'public'];
        if (in_array('restricted', $data['visibility'], true) && ! $this->access->allows('knowledge.manage')) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'permission_denied',
                'message' => '当前账号无权检索受限知识。',
            ]], 403);
        }
        try {
            $result = $this->retriever->search(
                $data['query'],
                $data,
                (int) ($data['top_k'] ?? 6),
                $data['embedding_provider_id'] ?? null,
                $this->currentAdminId(),
            );
        } catch (AiGatewayException $exception) {
            return $this->gatewayError($exception);
        }
        $this->access->audit('knowledge.rag.searched', 'rag_run', $result['run_id'], ['mode' => $result['mode'], 'citations' => count($result['citations'])]);

        return response()->json(['ok' => true, 'data' => $result]);
    }

    public function generateArticle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:240'],
            'primary_question' => ['nullable', 'string', 'max:1000'],
            'content_direction' => ['nullable', 'string', 'max:2000'],
            'user_intent' => ['nullable', 'string', 'max:500'],
            'keywords' => ['nullable', 'array', 'max:100'],
            'keywords.*' => ['string', 'max:240'],
            'business_line_id' => ['nullable', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'site_id' => ['nullable', 'integer'],
            'content_plan_item_id' => ['nullable', 'integer', 'exists:tongzhuo_content_plan_items,id'],
            'article_id' => ['nullable', 'integer'],
            'writing_agent_id' => ['nullable', 'integer', 'exists:tongzhuo_content_writing_agents,id'],
            'knowledge_document_ids' => ['nullable', 'array', 'max:100'],
            'knowledge_document_ids.*' => ['integer', 'exists:tongzhuo_knowledge_documents,id'],
            'embedding_provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'chat_provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'top_k' => ['nullable', 'integer', 'min:1', 'max:20'],
            'require_knowledge' => ['nullable', 'boolean'],
            'temperature' => ['nullable', 'numeric', 'min:0', 'max:2'],
            'max_tokens' => ['nullable', 'integer', 'min:128', 'max:100000'],
            'expected_platforms' => ['nullable', 'array'],
            'expected_platforms.*' => ['string', 'max:80'],
            'output_contract' => ['nullable', 'array'],
        ]);
        try {
            $result = $this->generator->generate($data, $this->currentAdminId());
        } catch (AiGatewayException $exception) {
            return $this->gatewayError($exception);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['ok' => false, 'error' => ['code' => 'invalid_request', 'message' => $exception->getMessage()]], 422);
        } catch (Throwable $exception) {
            throw $exception;
        }
        $this->access->audit('content.article.generated_with_rag', 'content_generation_run', $result['content_generation_run_id'], [
            'rag_run_id' => $result['rag_run_id'],
            'citation_check' => $result['citation_check'],
        ]);

        return response()->json(['ok' => true, 'data' => $result]);
    }

    private function gatewayError(AiGatewayException $exception): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => [
            'code' => $exception->errorCode(),
            'message' => $exception->getMessage(),
            'retryable' => $exception->retryable(),
            'details' => $exception->details(),
        ]], $exception->httpStatus());
    }

    private function currentAdminId(): ?int
    {
        return $this->access->adminId($this->access->currentAdmin());
    }
}
