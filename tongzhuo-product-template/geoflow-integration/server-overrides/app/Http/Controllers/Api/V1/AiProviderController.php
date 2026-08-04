<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\AiGenerationRun;
use App\Models\AiProvider;
use App\Services\TongzhuoAi\AiGatewayException;
use App\Services\TongzhuoAi\AiModelGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Private-installation AI provider and generation API.
 *
 * The response serializer deliberately never includes api_key or the raw
 * upstream response. This controller is intended to be mounted behind the
 * GEOFlow API token middleware; customer deployments can add their role/scope
 * middleware without changing the gateway.
 */
class AiProviderController extends BaseApiController
{
    public function __construct(private readonly AiModelGateway $gateway) {}

    public function index(Request $request): JsonResponse
    {
        $query = AiProvider::query()->orderByDesc('is_default')->orderBy('model_type')->orderBy('id');
        if ($request->filled('model_type')) {
            $query->whereIn('model_type', [(string) $request->string('model_type'), 'both']);
        }

        return $this->success($request, [
            'items' => $query->get()->map(fn (AiProvider $provider): array => $provider->safePayload())->values()->all(),
        ]);
    }

    public function show(Request $request, int $providerId): JsonResponse
    {
        return $this->success($request, [
            'provider' => AiProvider::query()->findOrFail($providerId)->safePayload(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedProvider($request, false);
        $apiKey = (string) ($data['api_key'] ?? '');
        unset($data['api_key']);
        $provider = new AiProvider($data);
        if ($apiKey !== '') {
            $provider->setApiKeyValue($apiKey);
        }
        $provider->save();
        if ($provider->is_default) {
            $this->clearOtherDefaults($provider);
        }

        return $this->success($request, ['provider' => $provider->fresh()->safePayload()], 201);
    }

    public function update(Request $request, int $providerId): JsonResponse
    {
        $provider = AiProvider::query()->findOrFail($providerId);
        $data = $this->validatedProvider($request, true);
        $apiKey = array_key_exists('api_key', $data) ? trim((string) $data['api_key']) : null;
        $clearKey = (bool) ($data['clear_api_key'] ?? false);
        unset($data['api_key'], $data['clear_api_key']);
        $provider->fill($data);
        if ($apiKey !== null && $apiKey !== '') {
            $provider->setApiKeyValue($apiKey);
        } elseif ($clearKey) {
            $provider->clearApiKey();
        }
        $provider->save();
        if ($provider->is_default) {
            $this->clearOtherDefaults($provider);
        }

        return $this->success($request, ['provider' => $provider->fresh()->safePayload()]);
    }

    public function destroy(Request $request, int $providerId): JsonResponse
    {
        $provider = AiProvider::query()->findOrFail($providerId);
        $provider->forceFill(['status' => 'disabled', 'is_default' => false])->save();

        return $this->success($request, ['provider' => $provider->fresh()->safePayload()]);
    }

    public function test(Request $request, int $providerId): JsonResponse
    {
        $result = $this->gateway->test(AiProvider::query()->findOrFail($providerId), [
            'timeout' => $request->integer('timeout', 30),
            'message' => $request->input('message', 'Reply with OK only.'),
        ]);

        return $this->success($request, $result, ($result['ok'] ?? false) ? 200 : 502);
    }

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'messages' => ['required', 'array', 'min:1', 'max:100'],
            'messages.*.role' => ['required', Rule::in(['system', 'user', 'assistant', 'tool'])],
            'messages.*.content' => ['required', 'string', 'max:100000'],
            'temperature' => ['nullable', 'numeric', 'between:0,2'],
            'max_tokens' => ['nullable', 'integer', 'between:1,100000'],
            'timeout' => ['nullable', 'integer', 'between:3,180'],
        ]);

        try {
            $result = $this->gateway->chat(
                $data['provider_id'] ?? null,
                array_values($data['messages']),
                $this->generationOptions($data),
            );
        } catch (Throwable $exception) {
            return $this->failed($exception, $request);
        }

        return $this->success($request, $this->withoutRaw($result));
    }

    public function generateArticle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'brief' => ['required', 'array'],
            'system_prompt' => ['nullable', 'string', 'max:50000'],
            'output_contract' => ['nullable', 'array'],
            'temperature' => ['nullable', 'numeric', 'between:0,2'],
            'max_tokens' => ['nullable', 'integer', 'between:1,100000'],
            'timeout' => ['nullable', 'integer', 'between:3,180'],
        ]);

        try {
            $result = $this->gateway->generateArticle(
                $data,
                $data['provider_id'] ?? null,
                $this->generationOptions($data),
            );
        } catch (Throwable $exception) {
            return $this->failed($exception, $request);
        }

        return $this->success($request, $this->withoutRaw($result));
    }

    public function embeddings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider_id' => ['nullable', 'integer', 'exists:ai_providers,id'],
            'input' => ['required'],
            'timeout' => ['nullable', 'integer', 'between:3,180'],
        ]);
        $values = is_array($data['input']) ? array_values($data['input']) : [$data['input']];
        if (count($values) > 128 || collect($values)->contains(fn (mixed $value): bool => ! is_string($value) || mb_strlen($value) > 20000)) {
            throw ValidationException::withMessages(['input' => 'Embedding 单次最多 128 个文本，每个文本不超过 20000 字符。']);
        }
        try {
            $result = $this->gateway->embeddings(
                $data['input'],
                $data['provider_id'] ?? null,
                $this->generationOptions($data),
            );
        } catch (Throwable $exception) {
            return $this->failed($exception, $request);
        }

        return $this->success($request, $this->withoutRaw($result));
    }

    public function generationRun(Request $request, int $runId): JsonResponse
    {
        $run = AiGenerationRun::query()->with('provider')->findOrFail($runId);

        return $this->success($request, [
            'run' => [
                'id' => (int) $run->id,
                'kind' => (string) $run->kind,
                'status' => (string) $run->status,
                'provider' => $run->provider?->safePayload(),
                'output_contract' => $run->output_contract_snapshot,
                'usage' => $run->usage,
                'error_code' => $run->error_code,
                'error_message' => $run->error_message,
                'request_id' => $run->request_id,
                'created_at' => $run->created_at?->toIso8601String(),
                'updated_at' => $run->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /** @return array<string,mixed> */
    private function validatedProvider(Request $request, bool $update): array
    {
        $rules = [
            'name' => [$update ? 'sometimes' : 'required', 'string', 'max:120'],
            'provider' => ['sometimes', 'string', 'max:80'],
            'model_id' => [$update ? 'sometimes' : 'required', 'string', 'max:180'],
            'model_type' => [$update ? 'sometimes' : 'required', Rule::in(['chat', 'embedding', 'both'])],
            'base_url' => ['nullable', 'url', 'max:1000'],
            'chat_url' => ['nullable', 'url', 'max:1000'],
            'embeddings_url' => ['nullable', 'url', 'max:1000'],
            'api_key' => [$update ? 'sometimes' : 'nullable', 'string', 'max:1000'],
            'clear_api_key' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
            'is_default' => ['sometimes', 'boolean'],
            'daily_limit' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'metadata' => ['nullable', 'array'],
        ];

        $data = $request->validate($rules);
        foreach (['base_url', 'chat_url', 'embeddings_url'] as $field) {
            if (empty($data[$field])) {
                continue;
            }
            $parts = parse_url((string) $data[$field]);
            if (isset($parts['user']) || isset($parts['pass'])) {
                throw ValidationException::withMessages([$field => '模型地址不能包含用户名或密码，请把凭据保存到 API Key 字段。']);
            }
        }

        return $data;
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    private function generationOptions(array $data): array
    {
        return array_filter([
            'temperature' => $data['temperature'] ?? null,
            'max_tokens' => $data['max_tokens'] ?? null,
            'timeout' => $data['timeout'] ?? null,
            'request_id' => request()->attributes->get('request_id'),
        ], static fn (mixed $value): bool => $value !== null);
    }

    private function clearOtherDefaults(AiProvider $provider): void
    {
        AiProvider::query()
            ->where('id', '!=', $provider->id)
            ->where('model_type', $provider->model_type)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    private function withoutRaw(array $payload): array
    {
        unset($payload['raw']);

        return $payload;
    }

    /** @return JsonResponse */
    protected function failed(Throwable $exception, Request $request): JsonResponse
    {
        if ($exception instanceof AiGatewayException) {
            return response()->json([
                'ok' => false,
                'error' => [
                    'code' => $exception->errorCode(),
                    'message' => $exception->getMessage(),
                    'retryable' => $exception->retryable(),
                    'request_id' => $request->attributes->get('request_id'),
                ],
            ], $exception->httpStatus());
        }
        if ($exception instanceof ValidationException) {
            return response()->json(['ok' => false, 'error' => ['code' => 'validation_failed', 'message' => '请求参数校验失败。', 'fields' => $exception->errors()]], 422);
        }

        return response()->json(['ok' => false, 'error' => ['code' => 'internal_error', 'message' => 'AI 服务内部错误。']], 500);
    }
}
