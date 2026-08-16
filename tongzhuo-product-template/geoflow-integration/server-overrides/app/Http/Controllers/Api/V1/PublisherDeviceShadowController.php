<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherAccountGroup;
use App\Models\PublisherAccountGroupItem;
use App\Models\PublisherDevice;
use App\Models\PublisherPlatformSession;
use App\Services\Publishing\PublisherDeviceCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Device-shadow heartbeat and node-side desired-state acknowledgement. */
class PublisherDeviceShadowController extends BaseApiController
{
    public function heartbeat(Request $request, string $device): JsonResponse
    {
        // Desktop agents fall back to the original heartbeat URI while an
        // independently deployed server is catching up. Accept its old
        // envelope here as well, so the desired-state acknowledgement is not
        // silently dropped during that rolling upgrade.
        if (! $request->has('reported_state') && $request->has('desired_state_report')) {
            $request->merge(['reported_state' => $request->input('desired_state_report')]);
        }

        $record = $this->authorizeDevice($request, $device);
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:40'],
            'connection_mode' => ['nullable', 'string', 'in:token,paired'],
            'capabilities' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
            'reported_state' => ['nullable', 'array'],
            'reported_state.desired_version_seen' => ['nullable', 'integer', 'min:0'],
            'reported_state.applied_version' => ['nullable', 'integer', 'min:0'],
            'reported_state.apply_status' => ['nullable', 'string', 'in:pending,applied,rejected,error'],
            'reported_state.local_override' => ['nullable', 'boolean'],
            'reported_state.effective_auto_run' => ['nullable', 'boolean'],
            'reported_state.active_job_ids' => ['nullable', 'array'],
            'reported_state.active_job_ids.*' => ['integer', 'min:1'],
            'reported_state.job_protocol' => ['nullable', 'string', 'in:auto,dual,legacy,platform-jobs'],
            'reported_state.active_job_refs' => ['nullable', 'array'],
            'reported_state.publish_policy' => ['nullable', 'array'],
        ]);
        DB::beginTransaction();
        try {
            $record = PublisherDevice::query()->whereKey($record->id)->lockForUpdate()->firstOrFail();
            if ($record->disabled_at !== null) {
                throw new ApiException('publisher_device_disabled', 'Publisher device is disabled.', 403);
            }
            if (! PublisherDeviceCredential::verify($record, trim((string) $request->bearerToken()))) {
                throw new ApiException('publisher_device_unauthorized', 'Publisher device credential is invalid.', 401);
            }

            $incomingReported = is_array($validated['reported_state'] ?? null) ? $validated['reported_state'] : [];
            $storedReportedState = is_array($record->meta['publisher_reported_state'] ?? null)
                ? $record->meta['publisher_reported_state']
                : [];
            $reported = array_replace($storedReportedState, $incomingReported);
            $desiredVersion = max(0, (int) ($record->desired_state_version ?? 0));
            $desired = $this->normalizeDesiredState($record->desired_state ?? []);
            $desired['version'] = $desiredVersion;
            $jobProtocol = $this->jobProtocol();
            $storedAppliedVersion = $record->applied_state_version !== null
                ? min($desiredVersion, max(0, (int) $record->applied_state_version))
                : null;
            $reportedAppliedVersion = array_key_exists('applied_version', $incomingReported)
                ? max(0, (int) $incomingReported['applied_version'])
                : null;
            // A device may only acknowledge a version the server has actually
            // issued. Keep acknowledgements monotonic too, since two heartbeats
            // can finish out of order on an unreliable connection.
            $appliedVersion = $reportedAppliedVersion === null
                ? $storedAppliedVersion
                : min(
                    $desiredVersion,
                    $storedAppliedVersion === null
                        ? $reportedAppliedVersion
                        : max($storedAppliedVersion, $reportedAppliedVersion)
                );
            $storedDesiredVersionSeen = min(
                $desiredVersion,
                max(0, (int) ($storedReportedState['desired_version_seen'] ?? 0))
            );
            $reportedDesiredVersionSeen = array_key_exists('desired_version_seen', $incomingReported)
                ? min($desiredVersion, max(0, (int) $incomingReported['desired_version_seen']))
                : null;
            $desiredVersionSeen = $reportedDesiredVersionSeen === null
                ? $storedDesiredVersionSeen
                : max($storedDesiredVersionSeen, $reportedDesiredVersionSeen);
            $localOverride = array_key_exists('local_override', $incomingReported)
                ? (bool) $incomingReported['local_override']
                : (bool) ($record->local_override ?? false);
            $reportedApplyStatus = (string) ($incomingReported['apply_status'] ?? $storedReportedState['apply_status'] ?? 'pending');
            $applyStatus = in_array($reportedApplyStatus, ['rejected', 'error'], true)
                ? $reportedApplyStatus
                : ($appliedVersion !== null && $appliedVersion === $desiredVersion ? 'applied' : 'pending');
            $effectiveAutoRun = array_key_exists('effective_auto_run', $reported)
                ? (bool) $reported['effective_auto_run']
                : (bool) ($desired['auto_run'] ?? false);

            $meta = array_replace($record->meta ?? [], $validated['meta'] ?? []);
            $meta['publisher_reported_state'] = $this->reportedStateSnapshot(
                $reported,
                $appliedVersion,
                $localOverride,
                $desiredVersionSeen,
                $applyStatus,
                $effectiveAutoRun,
            );

            $record->forceFill([
                'status' => $validated['status'] ?? 'online',
                'connection_mode' => $validated['connection_mode'] ?? $record->connection_mode,
                'capabilities' => $validated['capabilities'] ?? $record->capabilities,
                'meta' => $meta,
                'applied_state_version' => $appliedVersion,
                'local_override' => $localOverride,
                'last_seen_at' => now(),
            ])->save();
            if (array_key_exists('account_groups', $validated['meta'] ?? [])) {
                $this->syncAccountGroups($record, (array) ($meta['account_groups'] ?? []));
            }
            DB::commit();
        } catch (\Throwable $exception) {
            DB::rollBack();
            throw $exception;
        }

        $record = $record->fresh();
        $devicePayload = $this->serializeDevice($record);
        return $this->success($request, array_replace($devicePayload, [
            // Keep both root fields and a named object for old/new clients.
            'device' => $devicePayload,
            'desired_state' => $desired,
            'desired_state_version' => $desiredVersion,
            'job_protocol' => $jobProtocol,
            'applied_state_version' => $appliedVersion,
            'reported_state' => [
                'desired_version_seen' => $desiredVersionSeen,
                'applied_version' => $appliedVersion,
                'apply_status' => $applyStatus,
                'local_override' => $localOverride,
                'effective_auto_run' => $effectiveAutoRun,
            ],
            'commands_hint' => [
                'queued' => (int) $record->commands()->where('status', 'queued')->count(),
            ],
        ]));
    }

    public function show(Request $request, string $device): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);

        $desiredVersion = max(0, (int) ($record->desired_state_version ?? 0));
        $desired = $this->normalizeDesiredState($record->desired_state ?? []);
        $desired['version'] = $desiredVersion;
        $jobProtocol = $this->jobProtocol();

        return $this->success($request, [
            'device_id' => $record->device_id,
            'desired_state' => $desired,
            'desired_state_version' => $desiredVersion,
            'job_protocol' => $jobProtocol,
            'applied_state_version' => $record->applied_state_version !== null ? (int) $record->applied_state_version : null,
            'local_override' => (bool) ($record->local_override ?? false),
            'updated_at' => $record->desired_state_updated_at?->toIso8601String(),
        ]);
    }

    private function authorizeDevice(Request $request, string $deviceId): PublisherDevice
    {
        $record = PublisherDevice::query()->where('device_id', $deviceId)->first();
        if (! $record) {
            throw new ApiException('publisher_device_not_found', '发布设备不存在。', 404);
        }
        if ($record->disabled_at !== null) {
            throw new ApiException('publisher_device_disabled', '发布设备已被禁用。', 403);
        }
        $token = trim((string) $request->bearerToken());
        if (! PublisherDeviceCredential::verify($record, $token)) {
            throw new ApiException('publisher_device_unauthorized', '设备凭证无效，请重新配对。', 401);
        }

        return $record;
    }

    /**
     * Mirror the device-local account-group structure without copying browser
     * cookies or credentials. The local group id stays in external_id while
     * the database id remains an internal relation key.
     */
    private function syncAccountGroups(PublisherDevice $device, array $groups): void
    {
        $seenGroupIds = [];
        foreach ($groups as $position => $payload) {
            if (! is_array($payload)) {
                continue;
            }
            $externalId = trim((string) ($payload['id'] ?? ''));
            if ($externalId === '' || mb_strlen($externalId) > 120) {
                continue;
            }
            $name = trim((string) ($payload['name'] ?? $externalId));
            $status = (string) ($payload['status'] ?? 'active') === 'disabled' ? 'disabled' : 'active';
            $slugPart = Str::slug($externalId);
            if ($slugPart === '') {
                $slugPart = substr(sha1($externalId), 0, 16);
            }

            $group = PublisherAccountGroup::query()->updateOrCreate(
                [
                    'publisher_device_id' => $device->id,
                    'external_id' => $externalId,
                ],
                [
                    'name' => mb_substr($name !== '' ? $name : $externalId, 0, 120),
                    'slug' => 'device-'.$device->id.'-'.$slugPart.'-'.substr(sha1($externalId), 0, 8),
                    'description' => '由发布设备“'.$device->name.'”同步的本地账号组。',
                    'status' => $status,
                ],
            );
            $seenGroupIds[] = (int) $group->id;

            $seenItemIds = [];
            foreach ((array) ($payload['accounts'] ?? []) as $platformId => $account) {
                $platformId = trim((string) $platformId);
                if ($platformId === '' || mb_strlen($platformId) > 80 || ! is_array($account)) {
                    continue;
                }
                $profileKey = trim((string) ($account['profileKey'] ?? $account['profile_key'] ?? ($externalId.'--'.$platformId)));
                $session = PublisherPlatformSession::query()
                    ->where('publisher_device_id', $device->id)
                    ->where('platform_id', $platformId)
                    ->when($profileKey !== '', fn ($query) => $query->where('profile_key', $profileKey))
                    ->orderByDesc('last_verified_at')
                    ->orderByDesc('last_seen_at')
                    ->first();
                $item = PublisherAccountGroupItem::query()->updateOrCreate(
                    [
                        'publisher_account_group_id' => $group->id,
                        'platform_id' => $platformId,
                    ],
                    [
                        'publisher_device_id' => $device->id,
                        'publisher_platform_session_id' => $session?->id,
                        'profile_key' => $profileKey !== '' ? mb_substr($profileKey, 0, 120) : null,
                        'enabled' => $status === 'active' && (string) ($account['status'] ?? '') !== 'disabled',
                        'sort_order' => max(0, (int) $position),
                        'overrides' => [
                            'account_name' => trim((string) ($account['accountName'] ?? $account['account_name'] ?? '')),
                            'local_status' => trim((string) ($account['status'] ?? 'unknown')),
                            'local_updated_at' => trim((string) ($account['updatedAt'] ?? $account['updated_at'] ?? '')),
                        ],
                    ],
                );
                $seenItemIds[] = (int) $item->id;
            }
            $group->items()->when(
                $seenItemIds !== [],
                fn ($query) => $query->whereNotIn('id', $seenItemIds),
                fn ($query) => $query,
            )->update(['enabled' => false]);
        }

        PublisherAccountGroup::query()
            ->where('publisher_device_id', $device->id)
            ->when($seenGroupIds !== [], fn ($query) => $query->whereNotIn('id', $seenGroupIds))
            ->update(['status' => 'disabled']);
    }

    /** @return array<string,mixed> */
    private function reportedStateSnapshot(
        array $reported,
        ?int $appliedVersion,
        bool $localOverride,
        int $desiredVersionSeen,
        string $applyStatus,
        bool $effectiveAutoRun,
    ): array
    {
        return [
            'desired_version_seen' => $desiredVersionSeen,
            'applied_version' => $appliedVersion,
            'apply_status' => $applyStatus,
            'local_override' => $localOverride,
            'effective_auto_run' => $effectiveAutoRun,
            'active_job_ids' => array_values(array_unique(array_map(
                'intval',
                array_filter((array) ($reported['active_job_ids'] ?? []), 'is_numeric')
            ))),
            'job_protocol' => (string) ($reported['job_protocol'] ?? ''),
            'active_job_refs' => is_array($reported['active_job_refs'] ?? null) ? $reported['active_job_refs'] : [],
            'publish_policy' => is_array($reported['publish_policy'] ?? null) ? $reported['publish_policy'] : [],
            'reported_at' => now()->toIso8601String(),
        ];
    }
    private function jobProtocol(): string
    {
        $configured = strtolower(trim((string) config('publishing.job_protocol', '')));
        if (in_array($configured, ['legacy', 'platform-jobs', 'dual', 'auto'], true)) {
            return $configured;
        }

        $centerEnabled = (bool) config('publishing.center_v2_enabled', false);
        $platformJobsEnabled = (bool) config('publishing.platform_jobs_enabled', false);
        if (! $centerEnabled || ! $platformJobsEnabled) {
            return 'legacy';
        }

        // Keep both queues readable during the rolling V1 -> V2 migration.
        return 'dual';
    }
    private function normalizeDesiredState(array $state): array
    {
        $defaults = [
            'version' => 0,
            'scope' => 'device',
            'takeover' => false,
            'auto_run' => false,
            'poll_seconds' => 20,
            'login_check_seconds' => 300,
            'max_job_attempts' => 2,
            'max_concurrent_groups' => 1,
            'default_daily_quota' => 5,
            'default_min_delay_seconds' => 20,
            'default_max_delay_seconds' => 60,
            'risk_pause_threshold' => 2,
            'risk_pause_minutes' => 1440,
            'platform_daily_quota' => [],
            'enabled_platform_ids' => [],
            'enabled_platform_ids_present' => false,
            'platform_filter_mode' => 'all',
            'platform_policy' => [],
        ];
        $merged = array_replace($defaults, $state);
        $merged['version'] = max(0, (int) $merged['version']);
        $merged['scope'] = 'device';
        $merged['takeover'] = (bool) $merged['takeover'];
        $merged['auto_run'] = (bool) $merged['auto_run'];
        $merged['poll_seconds'] = max(10, min(3600, (int) $merged['poll_seconds']));
        $merged['login_check_seconds'] = max(60, min(86400, (int) $merged['login_check_seconds']));
        $merged['max_job_attempts'] = max(1, min(10, (int) $merged['max_job_attempts']));
        $merged['max_concurrent_groups'] = max(1, min(8, (int) $merged['max_concurrent_groups']));
        $merged['default_daily_quota'] = max(0, min(10000, (int) $merged['default_daily_quota']));
        $merged['default_min_delay_seconds'] = max(0, min(3600, (int) $merged['default_min_delay_seconds']));
        $merged['default_max_delay_seconds'] = max(
            $merged['default_min_delay_seconds'],
            min(3600, (int) $merged['default_max_delay_seconds'])
        );
        $merged['risk_pause_threshold'] = max(1, min(100, (int) $merged['risk_pause_threshold']));
        $merged['risk_pause_minutes'] = max(1, min(10080, (int) $merged['risk_pause_minutes']));
        $merged['platform_daily_quota'] = $this->normalizePlatformDailyQuota($merged['platform_daily_quota']);
        $platformIds = array_values(array_unique(array_filter(
            (array) $merged['enabled_platform_ids'],
            'is_string'
        )));
        $hasExplicitFilter = array_key_exists('enabled_platform_ids_present', $state)
            ? filter_var($state['enabled_platform_ids_present'], FILTER_VALIDATE_BOOLEAN)
            : $platformIds !== [];
        $mode = strtolower(trim((string) ($state['platform_filter_mode'] ?? '')));

        if (! in_array($mode, ['all', 'allowlist', 'none'], true)) {
            $mode = $hasExplicitFilter ? ($platformIds === [] ? 'none' : 'allowlist') : 'all';
        }

        if ($mode === 'all') {
            $platformIds = [];
            $hasExplicitFilter = false;
        } elseif ($mode === 'none') {
            $platformIds = [];
            $hasExplicitFilter = true;
        } else {
            $hasExplicitFilter = true;
            if ($platformIds === []) {
                $mode = 'none';
            }
        }

        $merged['enabled_platform_ids'] = $platformIds;
        $merged['enabled_platform_ids_present'] = $hasExplicitFilter;
        $merged['platform_filter_mode'] = $mode;
        $merged['platform_policy'] = is_array($merged['platform_policy']) ? $merged['platform_policy'] : [];
        // Job protocol is a server-wide feature flag, never a per-device shadow field.
        unset($merged['job_protocol'], $merged['jobProtocol']);

        return $merged;
    }

    /** @return array<string,int> */
    private function normalizePlatformDailyQuota(mixed $value): array
    {
        $normalized = [];
        foreach ((array) $value as $platformId => $quota) {
            $id = trim((string) $platformId);
            if ($id === '' || strlen($id) > 80 || ! is_numeric($quota)) {
                continue;
            }
            $normalized[$id] = max(0, min(10000, (int) $quota));
        }

        ksort($normalized);
        return $normalized;
    }
    private function desiredStateWithVersion(PublisherDevice $device): array
    {
        $state = $this->normalizeDesiredState($device->desired_state ?? []);
        $state['version'] = max(0, (int) ($device->desired_state_version ?? 0));

        return $state;
    }

    /** @return array<string,mixed> */
    private function serializeDevice(PublisherDevice $device): array
    {
        return [
            'id' => (int) $device->id,
            'device_id' => (string) $device->device_id,
            'name' => (string) $device->name,
            'status' => (string) $device->status,
            'connection_mode' => (string) ($device->connection_mode ?? 'paired'),
            'pairing_code' => (string) ($device->pairing_code ?? ''),
            'pairing_issued_at' => $device->pairing_issued_at?->toIso8601String(),
            'pairing_expires_at' => $device->pairing_expires_at?->toIso8601String(),
            'paired_at' => $device->paired_at?->toIso8601String(),
            'capabilities' => $device->capabilities ?? [],
            'meta' => $device->meta ?? [],
            'reported_state' => is_array($device->meta['publisher_reported_state'] ?? null)
                ? $device->meta['publisher_reported_state']
                : [],
            'desired_state' => $this->desiredStateWithVersion($device),
            'desired_state_version' => (int) ($device->desired_state_version ?? 0),
            'applied_state_version' => $device->applied_state_version !== null ? (int) $device->applied_state_version : null,
            'local_override' => (bool) ($device->local_override ?? false),
            'desired_state_updated_at' => $device->desired_state_updated_at?->toIso8601String(),
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'updated_at' => $device->updated_at?->toIso8601String(),
        ];
    }
}
