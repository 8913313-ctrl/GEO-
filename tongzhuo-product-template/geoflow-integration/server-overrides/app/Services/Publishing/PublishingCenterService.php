<?php

namespace App\Services\Publishing;

use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use App\Models\PublisherAccountGroup;
use App\Models\PublisherPlatformJob;
use App\Services\GeoFlow\DistributionPayloadBuilder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PublishingCenterService
{
    public function __construct(
        private readonly PublisherPreflightService $preflight,
        private readonly PublisherBatchSummaryService $summary,
        private readonly DistributionPayloadBuilder $payloadBuilder,
    ) {}

    /**
     * @param list<string> $platformIds
     * @return array{distribution:ArticleDistribution,preflight:array<string,mixed>}
     */
    public function createBatch(
        Article $article,
        array $platformIds,
        string $publishMode = 'draft',
        ?PublisherAccountGroup $accountGroup = null,
        ?int $requestedByAdminId = null,
        ?string $scheduledAt = null,
        string $deviceStrategy = 'auto',
        ?int $preferredDeviceId = null,
        ?string $idempotencyKey = null,
    ): array {
        if (! in_array($publishMode, ['direct', 'draft', 'scheduled'], true)) {
            throw new InvalidArgumentException('发布模式无效。');
        }
        if (! in_array($deviceStrategy, ['auto', 'specified'], true)) {
            throw new InvalidArgumentException('设备分配策略无效。');
        }

        $platformIds = array_values(array_unique(array_filter($platformIds, 'is_string')));
        $hiddenPlatformIds = array_values(array_intersect(
            $platformIds,
            PublisherPlatformCatalogService::HIDDEN_PLATFORM_IDS,
        ));
        if ($hiddenPlatformIds !== []) {
            throw new InvalidArgumentException(
                'Hidden publisher platforms cannot receive tasks: '.implode(', ', $hiddenPlatformIds)
            );
        }
        $accountGroupItems = collect();
        if ($accountGroup instanceof PublisherAccountGroup) {
            $accountGroupItems = $accountGroup->items()
                ->where('enabled', true)
                ->get()
                ->keyBy('platform_id');
            $groupPlatforms = $accountGroupItems->keys()
                ->filter(fn ($id): bool => is_string($id) && $id !== '')
                ->values()
                ->all();
            $missingPlatforms = array_values(array_diff($platformIds, $groupPlatforms));
            if ($missingPlatforms !== []) {
                throw new InvalidArgumentException(
                    'Selected account group does not enable platforms: '.implode(', ', $missingPlatforms)
                );
            }
        }
        if ($platformIds === []) {
            throw new InvalidArgumentException('请至少选择一个发布平台。');
        }

        $preflight = $this->preflight->inspect($platformIds, $publishMode, $preferredDeviceId, $accountGroup);
        $channel = $this->ensureDesktopPublisherChannel();
        $payload = $this->payloadBuilder->build($article);
        $payloadHash = hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
        $idempotencyKey = $this->normalizeIdempotencyKey($idempotencyKey, $article, $platformIds, $publishMode, $accountGroup, $scheduledAt, $deviceStrategy, $preferredDeviceId, $payloadHash);

        $existing = ArticleDistribution::query()
            ->with('publisherPlatformJobs')
            ->where('idempotency_key', $idempotencyKey)
            ->first();
        if ($existing instanceof ArticleDistribution) {
            return ['distribution' => $existing, 'preflight' => $preflight, 'idempotent_replay' => true];
        }

        try {
            $distribution = DB::transaction(function () use ($article, $platformIds, $publishMode, $accountGroup, $accountGroupItems, $requestedByAdminId, $scheduledAt, $deviceStrategy, $preferredDeviceId, $preflight, $channel, $payload, $payloadHash, $idempotencyKey): ArticleDistribution {
                $distribution = ArticleDistribution::query()->create([
                    'article_id' => (int) $article->id,
                    'distribution_channel_id' => (int) $channel->id,
                    'publisher_account_group_id' => $accountGroup?->id,
                    'action' => 'publish',
                    'publish_mode' => $publishMode,
                    'assigned_device_strategy' => $deviceStrategy,
                    'requested_by_admin_id' => $requestedByAdminId,
                    'status' => 'queued',
                    'scheduled_at' => $scheduledAt,
                    'next_retry_at' => now(),
                    'payload_hash' => $payloadHash,
                    'idempotency_key' => $idempotencyKey,
                    'remote_meta' => [
                        'publisher_assistant' => [
                            'protocol_version' => 'v2',
                            'state' => 'queued',
                            'preferred_device_id' => $preferredDeviceId,
                            'created_at' => now()->toIso8601String(),
                        ],
                    ],
                ]);

                foreach ($preflight['items'] as $item) {
                    $groupItem = $accountGroupItems->get($item['platform_id']);
                    $targetDeviceId = $item['device_id']
                        ?? $groupItem?->publisher_device_id
                        ?? $accountGroup?->publisher_device_id
                        ?? ($deviceStrategy === 'specified' ? $preferredDeviceId : null);
                    $targetSessionId = $item['session_id'] ?? $groupItem?->publisher_platform_session_id;
                    $targetProfileKey = $item['profile_key'] ?? $groupItem?->profile_key;
                    $jobStatus = match ($item['state']) {
                        'ready', 'draft_only' => $publishMode === 'scheduled' ? 'waiting_for_schedule' : 'queued',
                        'waiting_for_device' => 'waiting_for_device',
                        'login_required' => 'login_required',
                        default => 'skipped',
                    };

                    PublisherPlatformJob::query()->create([
                        'article_distribution_id' => (int) $distribution->id,
                        'platform_id' => $item['platform_id'],
                        'publisher_device_id' => $targetDeviceId,
                        'publisher_platform_session_id' => $targetSessionId,
                        'profile_key' => $targetProfileKey,
                        // Backend scheduling controls when the task is made
                        // leaseable. Once due, a verified platform executes a
                        // normal direct publish; unverified channels retain the
                        // explicit draft/manual-confirmation downgrade from
                        // preflight.
                        'publish_mode' => $item['effective_mode'] ?? ($publishMode === 'scheduled' ? 'direct' : $publishMode),
                        'status' => $jobStatus,
                        'progress_step' => $jobStatus === 'skipped' ? '发布预检未通过' : '等待发布节点',
                        'progress_percent' => 0,
                        'next_retry_at' => $jobStatus === 'queued' ? now() : null,
                        'error_category' => $jobStatus === 'skipped' ? 'unsupported' : null,
                        'error_message' => $jobStatus === 'skipped' ? $item['message'] : null,
                        'next_operator_action' => $item['manual_confirmation'] ? '请在本地发布窗口检查并确认。' : null,
                        'payload_snapshot' => $payload,
                        'result' => [
                            'preflight_message' => $item['message'],
                            'account_group_external_id' => $accountGroup?->external_id,
                            // Keep this capability snapshot with the task. A
                            // platform can be reconfigured later, while an
                            // already-created task still needs the policy it had
                            // at creation time.
                            'preflight' => [
                                'state' => $item['state'],
                                'support_level' => $item['support_level'] ?? 'unknown',
                                'supports_draft' => (bool) ($item['supports_draft'] ?? false),
                                'supports_direct_publish' => (bool) ($item['supports_direct_publish'] ?? false),
                                'supports_scheduled' => (bool) ($item['supports_scheduled'] ?? false),
                                'manual_confirmation' => (bool) $item['manual_confirmation'],
                                'effective_mode' => $item['effective_mode'] ?? ($publishMode === 'scheduled' ? 'direct' : $publishMode),
                            ],
                        ],
                    ]);
                }

                return $distribution;
            });
        } catch (QueryException $exception) {
            // The initial lookup is intentionally outside the transaction so
            // normal idempotent replays stay cheap. A second, simultaneous
            // request can still race it; the unique index is the final guard.
            if (! $this->isIdempotencyUniqueViolation($exception)) {
                throw $exception;
            }

            $existing = ArticleDistribution::query()
                ->with('publisherPlatformJobs')
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if (! $existing instanceof ArticleDistribution) {
                throw $exception;
            }

            return ['distribution' => $existing, 'preflight' => $preflight, 'idempotent_replay' => true];
        }
        $this->summary->refresh($distribution);

        return ['distribution' => $distribution->fresh(['publisherPlatformJobs']), 'preflight' => $preflight];
    }

    private function isIdempotencyUniqueViolation(QueryException $exception): bool
    {
        $sqlState = (string) $exception->getCode();
        if (! in_array($sqlState, ['23000', '23505'], true)) {
            return false;
        }

        $message = strtolower($exception->getMessage());

        return str_contains($message, 'idempotency_key')
            || str_contains($message, 'idempotency_unique');
    }

    /**
     * @param list<string> $platformIds
     */
    private function normalizeIdempotencyKey(
        ?string $provided,
        Article $article,
        array $platformIds,
        string $publishMode,
        ?PublisherAccountGroup $accountGroup,
        ?string $scheduledAt,
        string $deviceStrategy,
        ?int $preferredDeviceId,
        string $payloadHash,
    ): string {
        $provided = trim((string) $provided);
        if ($provided !== '') {
            return mb_substr($provided, 0, 120);
        }

        sort($platformIds, SORT_STRING);
        $identity = [
            'article_id' => (int) $article->id,
            'platform_ids' => $platformIds,
            'publish_mode' => $publishMode,
            'account_group_id' => $accountGroup?->id,
            'scheduled_at' => $scheduledAt,
            'device_strategy' => $deviceStrategy,
            'preferred_device_id' => $preferredDeviceId,
            'payload_hash' => $payloadHash,
        ];

        return 'publisher-v2-'.hash('sha256', json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    }
    private function ensureDesktopPublisherChannel(): DistributionChannel
    {
        $channel = DistributionChannel::query()
            ->where('channel_type', 'desktop_publisher')
            ->orderByDesc('id')
            ->first();

        if ($channel instanceof DistributionChannel) {
            if ($channel->status !== 'active') {
                $channel->forceFill(['status' => 'active'])->save();
            }

            return $channel;
        }

        return DistributionChannel::query()->create([
            'name' => '桐灼本地发布节点',
            'domain' => 'local-publisher.tongzhuo.internal',
            'endpoint_url' => 'https://local.tongzhuo-publisher.invalid',
            'channel_type' => 'desktop_publisher',
            'front_mode' => 'static',
            'site_settings' => [],
            'channel_config' => [
                'wechatsync_platforms' => ['zip-download'],
                'wechatsync_default_mode' => 'draft',
                'wechatsync_content_format' => 'markdown_and_html',
            ],
            'status' => 'active',
            'description' => '发布中心 V2 的内部兼容渠道，由本地发布节点领取平台子任务。',
        ]);
    }
}
