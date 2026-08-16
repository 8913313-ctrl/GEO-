<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PublisherDevice;
use App\Models\PublisherDeviceCommand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Admin controls for the publisher device shadow and command queue. */
class PublisherDeviceControlController extends Controller
{
    public function updateDesiredState(Request $request, int $deviceId): RedirectResponse
    {
        // The admin form uses JSON for a variable-length per-platform quota
        // map. Decode it before validation so the same strict rules apply to
        // browser form posts and API callers.
        $quotaJson = trim((string) $request->input('platform_daily_quota_json', ''));
        if ($quotaJson !== '') {
            try {
                $quotaMap = json_decode($quotaJson, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw ValidationException::withMessages([
                    'platform_daily_quota_json' => '平台每日配额必须是 JSON 对象，例如 {"zhihu": 5}。',
                ]);
            }
            if (! is_array($quotaMap) || array_is_list($quotaMap)) {
                throw ValidationException::withMessages([
                    'platform_daily_quota_json' => '平台每日配额必须是以平台 ID 为键的 JSON 对象。',
                ]);
            }
            $request->merge(['platform_daily_quota' => $quotaMap]);
        }

        $input = $request->validate([
            'auto_run' => ['nullable', 'boolean'],
            'poll_seconds' => ['nullable', 'integer', 'min:10', 'max:3600'],
            'login_check_seconds' => ['nullable', 'integer', 'min:60', 'max:86400'],
            'max_job_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'max_concurrent_groups' => ['nullable', 'integer', 'min:1', 'max:8'],
            'default_daily_quota' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'default_min_delay_seconds' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'default_max_delay_seconds' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'risk_pause_threshold' => ['nullable', 'integer', 'min:1', 'max:100'],
            'risk_pause_minutes' => ['nullable', 'integer', 'min:1', 'max:10080'],
            'platform_daily_quota_json' => ['nullable', 'string', 'max:10000'],
            'platform_daily_quota' => ['nullable', 'array'],
            'platform_daily_quota.*' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'enabled_platform_ids' => ['nullable', 'array'],
            'enabled_platform_ids.*' => ['string', 'max:80'],
            'enabled_platform_ids_present' => ['nullable', 'boolean'],
            'platform_filter_mode' => ['nullable', 'string', 'in:all,allowlist,none'],
            'platform_policy' => ['nullable', 'array'],
            'takeover' => ['nullable', 'boolean'],
            'clear_local_override' => ['nullable', 'boolean'],
        ]);

        // Browser forms carry the explicit-presence marker even when no
        // checkbox is selected. API callers may only send the ID array, which
        // must still become an allowlist instead of being silently ignored.
        $hasEnabledPlatformIds = $request->has('enabled_platform_ids_present')
            || $request->has('enabled_platform_ids')
            || array_key_exists('platform_filter_mode', $input);
        // `takeover` is intentionally a one-version action. Do not carry an
        // old true value into later edits, otherwise every future local change
        // would be silently overwritten by the device shadow.
        $takeoverRequested = (bool) ($input['takeover'] ?? false)
            || (bool) ($input['clear_local_override'] ?? false);

        $version = DB::transaction(function () use ($deviceId, $input, $hasEnabledPlatformIds, $takeoverRequested): int {
            $device = PublisherDevice::query()->lockForUpdate()->findOrFail($deviceId);
            $state = $this->normalizeDesiredState($device->desired_state ?? []);
            foreach ([
                'auto_run',
                'poll_seconds',
                'login_check_seconds',
                'max_job_attempts',
                'max_concurrent_groups',
                'default_daily_quota',
                'default_min_delay_seconds',
                'default_max_delay_seconds',
                'risk_pause_threshold',
                'risk_pause_minutes',
                'platform_policy',
            ] as $key) {
                if (array_key_exists($key, $input)) {
                    $state[$key] = $input[$key];
                }
            }
            if (array_key_exists('platform_daily_quota', $input)) {
                $state['platform_daily_quota'] = $this->normalizePlatformDailyQuota($input['platform_daily_quota']);
            }
            if ($hasEnabledPlatformIds) {
                $platformIds = array_values(array_unique(array_filter(
                    (array) ($input['enabled_platform_ids'] ?? []),
                    'is_string'
                )));
                $mode = strtolower(trim((string) ($input['platform_filter_mode'] ?? '')));

                if (! in_array($mode, ['all', 'allowlist', 'none'], true)) {
                    $mode = $platformIds === [] ? 'none' : 'allowlist';
                }

                if ($mode === 'all') {
                    $state['enabled_platform_ids'] = [];
                    $state['enabled_platform_ids_present'] = false;
                    $state['platform_filter_mode'] = 'all';
                } else {
                    $state['enabled_platform_ids'] = $mode === 'none' ? [] : $platformIds;
                    $state['enabled_platform_ids_present'] = true;
                    $state['platform_filter_mode'] = $mode === 'allowlist' && $platformIds === [] ? 'none' : $mode;
                }
            }
            $state['takeover'] = $takeoverRequested;
            $state['version'] = max((int) ($device->desired_state_version ?? 0), (int) ($state['version'] ?? 0)) + 1;
            $state['updated_at'] = now()->toIso8601String();

            // The device is the source of truth for whether it has actually
            // applied a forced takeover. Keep this report unchanged until its
            // next heartbeat acknowledges the new desired-state version.
            $device->forceFill([
                'desired_state' => $state,
                'desired_state_version' => $state['version'],
                'desired_state_updated_at' => now(),
            ])->save();

            return (int) $state['version'];
        });

        return back()->with('status', "设备期望配置已更新到 v{$version}。" . ($takeoverRequested ? ' 已下发收回本地接管指令，等待设备心跳确认。' : ''));
    }
    public function storeCommand(Request $request, int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);
        $input = $request->validate([
            'command_type' => ['required', 'string', 'in:poll_now,login_check,apply_desired_state'],
            'payload' => ['nullable', 'array'],
            'expires_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ]);
        $expiresMinutes = max(1, min(1440, (int) ($input['expires_minutes'] ?? 30)));
        PublisherDeviceCommand::query()->create([
            'publisher_device_id' => $device->id,
            'command_type' => $input['command_type'],
            'status' => 'queued',
            'payload' => $input['payload'] ?? [],
            'expires_at' => now()->addMinutes($expiresMinutes),
        ]);

        return back()->with('status', "已向设备 {$device->name} 下发 {$input['command_type']} 命令。");
    }

    /** @return array<string,mixed> */
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
}
