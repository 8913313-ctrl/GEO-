<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\ArticleDistribution;
use App\Models\DistributionLog;
use App\Models\PublisherDevice;
use App\Services\GeoFlow\DistributionPayloadBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Local publisher assistant queue.
 *
 * Browser profiles, platform cookies and CAPTCHA handling stay on the local
 * workstation. GEOFlow only exposes article payloads and records the result.
 */
class PublisherAssistantController extends BaseApiController
{
    public function __construct(
        private readonly DistributionPayloadBuilder $payloadBuilder,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeWorker($request);
        $limit = max(1, min(50, $request->integer('limit', 20)));
        $query = ArticleDistribution::query()
            ->with([
                'article:id,title,slug,excerpt,content,keywords,meta_description,status,published_at,updated_at,category_id,author_id,task_id',
                'article.category:id,name,slug',
                'article.author:id,name',
                'article.task:id,name',
                'channel:id,name,channel_type,channel_config,status',
            ])
            ->whereHas('channel', function ($channel): void {
                $channel
                    ->whereIn('channel_type', ['desktop_publisher', 'wechatsync_manual'])
                    ->where('status', 'active');
            })
            ->whereHas('article')
            ->where('action', '!=', 'delete')
            ->whereIn('status', ['queued', 'sending', 'synced', 'failed'])
            ->orderByDesc('id')
            ->limit($limit * 3);

        $items = $query->get()
            ->filter(fn (ArticleDistribution $distribution): bool => ! $this->assistantFinished($distribution))
            ->take($limit)
            ->map(fn (ArticleDistribution $distribution): array => $this->serializeDistribution($distribution))
            ->values()
            ->all();

        return $this->success($request, [
            'items' => $items,
            'count' => count($items),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function show(Request $request, int $distribution): JsonResponse
    {
        $this->authorizeWorker($request);
        $record = $this->findLocalPublisherDistribution($distribution);

        return $this->success($request, $this->serializeDistribution($record));
    }

    public function claim(Request $request, int $distribution): JsonResponse
    {
        $this->authorizeWorker($request);
        $workerId = $this->workerId($request);

        $record = DB::transaction(function () use ($distribution, $workerId): ArticleDistribution {
            $record = ArticleDistribution::query()
                ->with(['article.category', 'article.author', 'article.task', 'channel'])
                ->whereKey($distribution)
                ->lockForUpdate()
                ->first();

            if (! $record || ! $record->article || ! $record->channel || ! $record->channel->isLocalPublisher()) {
                throw new ApiException('publisher_job_not_found', '发布任务不存在。', 404);
            }

            $meta = $this->remoteMeta($record);
            $assistant = is_array($meta['publisher_assistant'] ?? null) ? $meta['publisher_assistant'] : [];
            $currentState = (string) ($assistant['state'] ?? '');
            $currentWorker = (string) ($assistant['worker_id'] ?? '');

            if (in_array($currentState, ['published', 'completed'], true)) {
                throw new ApiException('publisher_job_completed', '该任务已经完成发布。', 409);
            }

            $claimedAt = isset($assistant['claimed_at']) ? now()->parse((string) $assistant['claimed_at']) : null;
            $leaseExpired = $claimedAt === null || $claimedAt->lte(now()->subMinutes($this->legacyLeaseMinutes()));
            if ($currentState === 'processing' && $currentWorker !== '' && $currentWorker !== $workerId && ! $leaseExpired) {
                throw new ApiException('publisher_job_claimed', '该任务正在被另一台发布节点处理。', 409);
            }

            $meta['publisher_assistant'] = array_replace($assistant, [
                'state' => 'processing',
                'worker_id' => $workerId,
                'claimed_at' => now()->toIso8601String(),
                'last_error' => null,
                'state_summary' => [],
                'next_operator_action' => null,
            ]);
            $record->forceFill(['remote_meta' => $meta])->save();

            return $record->fresh(['article.category', 'article.author', 'article.task', 'channel']);
        });

        return $this->success($request, $this->serializeDistribution($record));
    }

    public function result(Request $request, int $distribution): JsonResponse
    {
        $this->authorizeWorker($request);
        $payload = $request->all();
        $state = trim((string) ($payload['state'] ?? ''));
        if (! in_array($state, ['awaiting_confirmation', 'draft_saved', 'published', 'failed', 'cancelled'], true)) {
            throw new ApiException('validation_failed', '发布节点状态无效。', 422, [
                'field_errors' => ['state' => 'state 必须为 awaiting_confirmation、draft_saved、published、failed 或 cancelled。'],
            ]);
        }
        $workerId = trim((string) ($payload['worker_id'] ?? ''));
        $message = trim((string) ($payload['message'] ?? ''));
        if (mb_strlen($workerId) > 120 || mb_strlen($message) > 1000) {
            throw new ApiException('validation_failed', '鍙戝竷鍔╂墜鍥炲啓鍙傛暟杩囬暱', 422);
        }
        if (filled($payload['remote_url'] ?? null) && filter_var((string) $payload['remote_url'], FILTER_VALIDATE_URL) === false) {
            throw new ApiException('validation_failed', 'remote_url 蹇呴』鏄湁鏁?URL', 422);
        }
        if (isset($payload['platform_results']) && ! is_array($payload['platform_results'])) {
            throw new ApiException('validation_failed', 'platform_results 必须是数组。', 422);
        }
        if (isset($payload['state_summary']) && ! is_array($payload['state_summary'])) {
            throw new ApiException('validation_failed', 'state_summary 必须是数组。', 422);
        }
        $nextOperatorAction = trim((string) ($payload['next_operator_action'] ?? ''));
        if (mb_strlen($nextOperatorAction) > 120) {
            throw new ApiException('validation_failed', 'next_operator_action 鍙傛暟杩囬暱', 422);
        }
        $record = $this->findLocalPublisherDistribution($distribution);
        $meta = $this->remoteMeta($record);
        $assistant = is_array($meta['publisher_assistant'] ?? null) ? $meta['publisher_assistant'] : [];

        $currentState = (string) ($assistant['state'] ?? '');
        if (in_array($currentState, ['published', 'cancelled'], true) && $currentState !== $state) {
            throw new ApiException('publisher_job_completed', '发布任务已进入终态，拒绝旧结果覆盖。', 409);
        }
        if ($workerId !== '' && isset($assistant['worker_id']) && (string) $assistant['worker_id'] !== $workerId) {
            throw new ApiException('publisher_job_worker_mismatch', '任务归属的发布节点不一致。', 409);
        }

        $meta['publisher_assistant'] = array_replace($assistant, [
            'state' => $state,
            'worker_id' => $workerId !== '' ? $workerId : ($assistant['worker_id'] ?? null),
            'updated_at' => now()->toIso8601String(),
            'completed_at' => in_array($state, ['published', 'draft_saved', 'cancelled'], true) ? now()->toIso8601String() : null,
            'last_error' => $state === 'failed' ? ($message !== '' ? $message : '鏈湴鍙戝竷鍔╂墜鎵ц澶辫触') : null,
            'platform_results' => is_array($payload['platform_results'] ?? null) ? $payload['platform_results'] : ($assistant['platform_results'] ?? []),
            'state_summary' => is_array($payload['state_summary'] ?? null) ? $payload['state_summary'] : ($assistant['state_summary'] ?? []),
            'next_operator_action' => $nextOperatorAction !== '' ? $nextOperatorAction : ($assistant['next_operator_action'] ?? null),
        ]);

        $record->forceFill([
            'remote_meta' => $meta,
            'remote_url' => filled($payload['remote_url'] ?? null) ? (string) $payload['remote_url'] : $record->remote_url,
            'last_error_message' => $state === 'failed' ? ($message !== '' ? $message : '鏈湴鍙戝竷鍔╂墜鎵ц澶辫触') : null,
        ])->save();

        DistributionLog::query()->create([
            'distribution_channel_id' => (int) $record->distribution_channel_id,
            'article_distribution_id' => (int) $record->id,
            'article_id' => (int) $record->article_id,
            'level' => $state === 'failed' ? 'error' : 'info',
            'event' => 'publisher_assistant.'.$state,
            'message' => $message !== '' ? $message : '鏈湴鍙戝竷鍔╂墜鐘舵€佸凡鏇存柊',
            'context' => [
                'state' => $state,
                'worker_id' => $workerId !== '' ? $workerId : ($assistant['worker_id'] ?? null),
                'platform_results' => $meta['publisher_assistant']['platform_results'] ?? [],
                'state_summary' => $meta['publisher_assistant']['state_summary'] ?? [],
                'next_operator_action' => $meta['publisher_assistant']['next_operator_action'] ?? null,
            ],
            'created_at' => now(),
        ]);

        return $this->success($request, $this->serializeDistribution($record->fresh(['article.category', 'article.author', 'article.task', 'channel'])));
    }

    private function legacyLeaseMinutes(): int
    {
        return max(1, (int) config('publishing.legacy_job_lease_minutes', 15));
    }
    private function findLocalPublisherDistribution(int $distribution): ArticleDistribution
    {
        $record = ArticleDistribution::query()
            ->with(['article.category', 'article.author', 'article.task', 'channel'])
            ->whereKey($distribution)
            ->first();

        if (! $record || ! $record->article || ! $record->channel || ! $record->channel->isLocalPublisher()) {
            throw new ApiException('publisher_job_not_found', '发布任务不存在。', 404);
        }

        return $record;
    }

    /** @return array<string,mixed> */
    private function serializeDistribution(ArticleDistribution $distribution): array
    {
        $payload = $this->payloadBuilder->build($distribution->article);
        $config = $distribution->channel->resolvedWechatSyncConfig();

        return [
            'id' => (int) $distribution->id,
            'action' => (string) $distribution->action,
            'status' => (string) $distribution->status,
            'created_at' => $distribution->created_at?->toIso8601String(),
            'updated_at' => $distribution->updated_at?->toIso8601String(),
            'remote_meta' => $this->remoteMeta($distribution),
            'assistant' => $this->remoteMeta($distribution)['publisher_assistant'] ?? [],
            'platforms' => $config['wechatsync_platforms'],
            'channel' => [
                'id' => (int) $distribution->channel->id,
                'name' => (string) $distribution->channel->name,
            ],
            'payload' => $payload,
        ];
    }

    /** @return array<string,mixed> */
    private function remoteMeta(ArticleDistribution $distribution): array
    {
        return is_array($distribution->remote_meta) ? $distribution->remote_meta : [];
    }

    private function assistantFinished(ArticleDistribution $distribution): bool
    {
        $assistant = $this->remoteMeta($distribution)['publisher_assistant'] ?? [];
        $state = is_array($assistant) ? (string) ($assistant['state'] ?? '') : '';

        return in_array($state, ['published', 'completed', 'cancelled'], true);
    }

    private function workerId(Request $request): string
    {
        $value = trim((string) $request->header('X-Publisher-Worker', ''));

        return $value !== '' ? Str::limit($value, 120, '') : 'worker-'.Str::lower(Str::random(12));
    }

    private function authorizeWorker(Request $request): PublisherDevice
    {
        $deviceId = trim((string) $request->header('X-Publisher-Worker', ''));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }

        $record = PublisherDevice::query()->where('device_id', $deviceId)->first();
        if (! $record) {
            throw new ApiException('publisher_device_not_found', '发布节点不存在。', 404);
        }
        if ($record->disabled_at !== null) {
            throw new ApiException('publisher_device_disabled', '发布节点已禁用。', 403);
        }

        $token = trim((string) $request->bearerToken());
        $secret = trim((string) ($record->public_key ?? ''));
        if ($token === '' || $secret === '' || ! hash_equals($secret, $token)) {
            throw new ApiException('publisher_device_unauthorized', '发布节点凭证无效，请重新配对。', 401);
        }

        return $record;
    }
}
