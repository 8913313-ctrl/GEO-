<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Device-shadow heartbeat and node-side desired-state acknowledgement. */
class PublisherDeviceShadowController extends BaseApiController
{
    public function heartbeat(Request $request, string $device): JsonResponse
    {
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
        ]);

        $reported = is_array($validated['reported_state'] ?? null) ? $validated['reported_state'] : [];
        $desiredVersion = max(0, (int) ($record->desired_state_version ?? 0));
        $desired = $this->normalizeDesiredState($record->desired_state ?? []);
        $desired['version'] = $desiredVersion;
        $jobProtocol = $this->jobProtocol();
        $appliedVersion = array_key_exists('applied_version', $reported)
            ? max(0, (int) $reported['applied_version'])
            : ($record->applied_state_version !== null ? (int) $record->applied_state_version : null);
        $localOverride = array_key_exists('local_override', $reported)
            ? (bool) $reported['local_override']
            : (bool) ($record->local_override ?? false);

        $record->forceFill([
            'status' => $validated['status'] ?? 'online',
            'connection_mode' => $validated['connection_mode'] ?? $record->connection_mode,
            'capabilities' => $validated['capabilities'] ?? $record->capabilities,
            'meta' => array_replace($record->meta ?? [], $validated['meta'] ?? []),
            'applied_state_version' => $appliedVersion,
            'local_override' => $localOverride,
            'last_seen_at' => now(),
        ])->save();

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
                'desired_version_seen' => $reported['desired_version_seen'] ?? $desiredVersion,
                'applied_version' => $appliedVersion,
                'apply_status' => $reported['apply_status'] ?? ($appliedVersion === $desiredVersion ? 'applied' : 'pending'),
                'local_override' => $localOverride,
                'effective_auto_run' => $reported['effective_auto_run'] ?? ($desired['auto_run'] ?? false),
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
        $secret = trim((string) ($record->public_key ?? ''));
        if ($token === '' || $secret === '' || ! hash_equals($secret, $token)) {
            throw new ApiException('publisher_device_unauthorized', '设备凭证无效，请重新配对。', 401);
        }

        return $record;
    }

    /** @return array<string,mixed> */
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
            'enabled_platform_ids' => [],
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
        $merged['enabled_platform_ids'] = array_values(array_unique(array_filter((array) $merged['enabled_platform_ids'], 'is_string')));
        $merged['platform_policy'] = is_array($merged['platform_policy']) ? $merged['platform_policy'] : [];
        // Job protocol is a server-wide feature flag, never a per-device shadow field.
        unset($merged['job_protocol'], $merged['jobProtocol']);

        return $merged;
    }

    /** @return array<string,mixed> */
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
