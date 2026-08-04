<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\GeoFlow\ContentDiscoveryService;
use App\Services\TongzhuoAi\AiGatewayException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

/** Real model-backed keyword/question/topic discovery endpoints. */
class ContentAiDiscoveryController
{
    public function __construct(private readonly ContentDiscoveryService $discovery) {}

    public function questionCandidates(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_line_id' => ['required', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'keyword_ids' => ['nullable', 'array', 'max:20'],
            'keyword_ids.*' => ['integer', 'distinct'],
            'keywords' => ['nullable', 'array', 'max:20'],
            'keywords.*' => ['string', 'max:240', 'distinct'],
            'dimensions' => ['nullable', 'array', 'max:8'],
            'dimensions.*' => ['string'],
            'provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'temperature' => ['nullable', 'numeric', 'between:0,2'],
            'max_tokens' => ['nullable', 'integer', 'between:1000,100000'],
            'timeout' => ['nullable', 'integer', 'between:3,180'],
        ]);

        return $this->run(function () use ($data, $request): array {
            return $this->discovery->generateQuestions($data, $this->adminId($request));
        }, $request);
    }

    public function confirmQuestionCandidates(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_line_id' => ['required', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'question_ids' => ['required', 'array', 'min:1', 'max:500'],
            'question_ids.*' => ['integer', 'distinct'],
        ]);

        return $this->run(function () use ($data, $request): array {
            return $this->discovery->confirmQuestions($data, $this->adminId($request));
        }, $request);
    }

    public function topicCandidates(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_line_id' => ['required', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'question_ids' => ['nullable', 'array', 'max:100'],
            'question_ids.*' => ['integer', 'distinct'],
            'questions' => ['nullable', 'array', 'max:100'],
            'questions.*' => ['array'],
            'questions.*.id' => ['required', 'integer'],
            'questions.*.intent' => ['nullable', 'string', 'max:40'],
            'questions.*.decision_stage' => ['nullable', 'string', 'max:32'],
            'provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'temperature' => ['nullable', 'numeric', 'between:0,2'],
            'max_tokens' => ['nullable', 'integer', 'between:1000,100000'],
            'timeout' => ['nullable', 'integer', 'between:3,180'],
        ]);

        return $this->run(function () use ($data, $request): array {
            return $this->discovery->generateTopics($data, $this->adminId($request));
        }, $request);
    }

    public function confirmTopicCandidates(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_line_id' => ['required', 'integer', 'exists:tongzhuo_content_business_lines,id'],
            'topic_ids' => ['required', 'array', 'min:1', 'max:500'],
            'topic_ids.*' => ['integer', 'distinct'],
        ]);

        return $this->run(function () use ($data, $request): array {
            return $this->discovery->confirmTopics($data, $this->adminId($request));
        }, $request);
    }

    /** @param callable():array<string,mixed> $callback */
    private function run(callable $callback, Request $request): JsonResponse
    {
        try {
            return response()->json(['ok' => true, 'data' => $callback(), 'meta' => [
                'request_id' => $request->attributes->get('request_id'),
            ]]);
        } catch (AiGatewayException $exception) {
            return response()->json([
                'ok' => false,
                'error' => [
                    'code' => $exception->errorCode(),
                    'message' => $exception->getMessage(),
                    'retryable' => $exception->retryable(),
                    'details' => $exception->details(),
                    'request_id' => $request->attributes->get('request_id'),
                ],
            ], $exception->httpStatus());
        } catch (ValidationException $exception) {
            return response()->json(['ok' => false, 'error' => [
                'code' => 'validation_failed', 'message' => '提交的数据不符合要求。', 'details' => $exception->errors(),
            ]], 422);
        } catch (Throwable $exception) {
            report($exception);
            return response()->json(['ok' => false, 'error' => [
                'code' => 'internal_error', 'message' => '选题生成服务暂时不可用，请稍后重试。',
                'request_id' => $request->attributes->get('request_id'),
            ]], 500);
        }
    }

    private function adminId(Request $request): ?int
    {
        $auth = $request->attributes->get('access.auth') ?? $request->attributes->get('api.auth');
        if (is_array($auth)) {
            $id = $auth['admin_id'] ?? $auth['user_id'] ?? $auth['id'] ?? null;
            return is_numeric($id) ? (int) $id : null;
        }
        return auth('admin')->id() ? (int) auth('admin')->id() : null;
    }
}
