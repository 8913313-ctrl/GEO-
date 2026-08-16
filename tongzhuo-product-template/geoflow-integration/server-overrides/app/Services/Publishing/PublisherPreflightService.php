<?php

namespace App\Services\Publishing;

use App\Models\PublisherDevice;
use App\Models\PublisherAccountGroup;
use App\Models\PublisherPlatform;
use App\Models\PublisherPlatformSession;
use Illuminate\Support\Collection;

class PublisherPreflightService
{
    /**
     * @param list<string> $platformIds
     * @return array{items:list<array<string,mixed>>,summary:array<string,int>}
     */
    public function inspect(
        array $platformIds,
        string $requestedMode = 'draft',
        ?int $preferredDeviceId = null,
        ?PublisherAccountGroup $accountGroup = null,
    ): array
    {
        $platformIds = array_values(array_unique(array_filter($platformIds, 'is_string')));
        $platforms = PublisherPlatform::query()
            ->whereIn('platform_id', $platformIds)
            ->get()
            ->keyBy('platform_id');
        $sessions = $this->sessionsFor($platformIds, $preferredDeviceId, $accountGroup)
            ->groupBy('platform_id');

        $items = [];
        foreach ($platformIds as $platformId) {
            /** @var PublisherPlatform|null $platform */
            $platform = $platforms->get($platformId);
            /** @var Collection<int, PublisherPlatformSession> $platformSessions */
            $platformSessions = $sessions->get($platformId, collect());
            $items[] = $this->inspectPlatform($platformId, $platform, $platformSessions, $requestedMode);
        }

        $summary = [
            'target' => count($items),
            'ready' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'ready')),
            'draft_only' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'draft_only')),
            'waiting_for_device' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'waiting_for_device')),
            'login_required' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'login_required')),
            'unsupported' => count(array_filter($items, fn (array $item): bool => $item['state'] === 'unsupported')),
            'manual_confirmation' => count(array_filter($items, fn (array $item): bool => $item['manual_confirmation'])),
        ];

        return ['items' => $items, 'summary' => $summary];
    }

    /** @return Collection<int, PublisherPlatformSession> */
    private function sessionsFor(
        array $platformIds,
        ?int $preferredDeviceId,
        ?PublisherAccountGroup $accountGroup,
    ): Collection
    {
        $sessionIds = null;
        if ($accountGroup instanceof PublisherAccountGroup) {
            $sessionIds = $accountGroup->items()
                ->where('enabled', true)
                ->whereIn('platform_id', $platformIds)
                ->whereNotNull('publisher_platform_session_id')
                ->pluck('publisher_platform_session_id')
                ->map(fn ($id): int => (int) $id)
                ->filter()
                ->values()
                ->all();
            if ($sessionIds === []) {
                return collect();
            }
        }

        return PublisherPlatformSession::query()
            ->with('device')
            ->whereIn('platform_id', $platformIds)
            ->when($sessionIds !== null, fn ($query) => $query->whereIn('id', $sessionIds))
            ->when($preferredDeviceId !== null, fn ($query) => $query->where('publisher_device_id', $preferredDeviceId))
            ->orderByDesc('last_verified_at')
            ->orderByDesc('last_seen_at')
            ->get()
            ->filter(function (PublisherPlatformSession $session): bool {
                $device = $session->device;
                if (! $device instanceof PublisherDevice || $device->disabled_at !== null) {
                    return false;
                }

                return $device->last_seen_at !== null && $device->last_seen_at->gte(now()->subMinutes(2));
            })
            ->values();
    }

    /**
     * @param Collection<int, PublisherPlatformSession> $sessions
     * @return array<string,mixed>
     */
    private function inspectPlatform(string $platformId, ?PublisherPlatform $platform, Collection $sessions, string $requestedMode): array
    {
        if (! $platform instanceof PublisherPlatform || $platform->status !== 'active') {
            return $this->item($platformId, $platform, 'unsupported', '平台目录不存在或当前已停用。');
        }
        if ($platform->support_level === 'planned') {
            return $this->item($platformId, $platform, 'unsupported', '该平台仍处于适配规划中，暂不能创建发布任务。');
        }

        $ready = $sessions->first(fn (PublisherPlatformSession $session): bool => $session->login_state === 'ready');
        if (! $ready instanceof PublisherPlatformSession) {
            $hasKnownSession = $sessions->isNotEmpty();
            return $this->item(
                $platformId,
                $platform,
                $hasKnownSession ? 'login_required' : 'waiting_for_device',
                $hasKnownSession ? '发布电脑在线，但该平台账号需要重新登录或验证。' : '尚无在线且已绑定该平台的发布电脑。'
            );
        }

        $requestsPublicPublish = in_array($requestedMode, ['direct', 'scheduled'], true);
        if ($requestsPublicPublish && ! $platform->supports_direct_publish) {
            if (! $platform->supports_draft) {
                return $this->item(
                    $platformId,
                    $platform,
                    'unsupported',
                    $requestedMode === 'scheduled'
                        ? '该平台尚未通过自动发布验收，不能创建无人值守定时任务。'
                        : '该平台暂不支持自动直接发布或草稿保存。',
                    $ready,
                );
            }

            return $this->item(
                $platformId,
                $platform,
                'draft_only',
                $requestedMode === 'scheduled'
                    ? '该平台尚未通过定时直发验收，将在设定时间保存草稿并等待人工确认。'
                    : '该平台会降级为保存草稿，需人工确认后发布。',
                $ready,
                true,
                'draft',
            );
        }

        $manualConfirmation = $platform->support_level === 'manual' || ! $ready->auto_allowed;
        return $this->item(
            $platformId,
            $platform,
            'ready',
            $manualConfirmation ? '可打开编辑器并等待人工确认。' : '账号已就绪，可进入发布队列。',
            $ready,
            $manualConfirmation,
            $requestedMode === 'scheduled' ? 'direct' : $requestedMode
        );
    }

    /** @return array<string,mixed> */
    private function item(
        string $platformId,
        ?PublisherPlatform $platform,
        string $state,
        string $message,
        ?PublisherPlatformSession $session = null,
        bool $manualConfirmation = false,
        ?string $effectiveMode = null,
    ): array {
        return [
            'platform_id' => $platformId,
            'platform_name' => $platform?->name ?? $platformId,
            'support_level' => (string) ($platform?->support_level ?? 'unknown'),
            'supports_draft' => (bool) ($platform?->supports_draft ?? false),
            'supports_direct_publish' => (bool) ($platform?->supports_direct_publish ?? false),
            'supports_scheduled' => (bool) ($platform?->supports_scheduled ?? false),
            'state' => $state,
            'message' => $message,
            'effective_mode' => $effectiveMode,
            'manual_confirmation' => $manualConfirmation,
            'device_id' => $session?->publisher_device_id,
            'session_id' => $session?->id,
            'profile_key' => $session?->profile_key,
        ];
    }
}
