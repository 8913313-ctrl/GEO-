<?php

namespace App\Services\Publishing;

use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use App\Models\PublisherAccountGroup;
use App\Models\PublisherPlatformJob;
use App\Services\GeoFlow\DistributionPayloadBuilder;
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
        if ($accountGroup instanceof PublisherAccountGroup) {
            $groupPlatforms = $accountGroup->items()
                ->where('enabled', true)
                ->pluck('platform_id')
                ->filter(fn ($id): bool => is_string($id) && $id !== '')
                ->values()
                ->all();
            if ($groupPlatforms !== []) {
                $platformIds = array_values(array_intersect($platformIds, $groupPlatforms));
            }
        }
        if ($platformIds === []) {
            throw new InvalidArgumentException('请至少选择一个发布平台。');
        }

        $preflight = $this->preflight->inspect($platformIds, $publishMode, $preferredDeviceId);
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

        $distribution = DB::transaction(function () use ($article, $platformIds, $publishMode, $accountGroup, $requestedByAdminId, $scheduledAt, $deviceStrategy, $preflight, $channel, $payload, $payloadHash, $idempotencyKey): ArticleDistribution {
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
                        'created_at' => now()->toIso8601String(),
                    ],
                ],
            ]);

            foreach ($preflight['items'] as $item) {
                $jobStatus = match ($item['state']) {
                    'ready', 'draft_only' => $publishMode === 'scheduled' ? 'waiting_for_schedule' : 'queued',
                    'waiting_for_device' => 'waiting_for_device',
                    'login_required' => 'login_required',
                    default => 'skipped',
                };

                PublisherPlatformJob::query()->create([
                    'article_distribution_id' => (int) $distribution->id,
                    'platform_id' => $item['platform_id'],
                    'publisher_device_id' => $item['device_id'],
                    'publisher_platform_session_id' => $item['session_id'],
                    'profile_key' => $item['profile_key'],
                    'publish_mode' => $item['effective_mode'] ?? ($publishMode === 'scheduled' ? 'draft' : $publishMode),
                    'status' => $jobStatus,
                    'progress_step' => $jobStatus === 'skipped' ? '发布预检未通过' : '等待发布节点',
                    'progress_percent' => 0,
                    'next_retry_at' => $jobStatus === 'queued' ? now() : null,
                    'error_category' => $jobStatus === 'skipped' ? 'unsupported' : null,
                    'error_message' => $jobStatus === 'skipped' ? $item['message'] : null,
                    'next_operator_action' => $item['manual_confirmation'] ? '请在本地发布窗口检查并确认。' : null,
                    'payload_snapshot' => $payload,
                    'result' => ['preflight_message' => $item['message']],
                ]);
            }

            return $distribution;
        });

        $this->summary->refresh($distribution);

        return ['distribution' => $distribution->fresh(['publisherPlatformJobs']), 'preflight' => $preflight];
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
