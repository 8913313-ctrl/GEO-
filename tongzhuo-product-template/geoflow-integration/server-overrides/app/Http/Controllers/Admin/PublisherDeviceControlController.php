<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PublisherDevice;
use App\Models\PublisherDeviceCommand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Admin controls for the publisher device shadow and command queue. */
class PublisherDeviceControlController extends Controller
{
    public function updateDesiredState(Request $request, int $deviceId): RedirectResponse
    {
        $input = $request->validate([
            'auto_run' => ['nullable', 'boolean'],
            'poll_seconds' => ['nullable', 'integer', 'min:10', 'max:3600'],
            'login_check_seconds' => ['nullable', 'integer', 'min:60', 'max:86400'],
            'max_job_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'max_concurrent_groups' => ['nullable', 'integer', 'min:1', 'max:8'],
            'enabled_platform_ids' => ['nullable', 'array'],
            'enabled_platform_ids.*' => ['string', 'max:80'],
            'platform_policy' => ['nullable', 'array'],
            'takeover' => ['nullable', 'boolean'],
            'clear_local_override' => ['nullable', 'boolean'],
        ]);

        $version = DB::transaction(function () use ($deviceId, $input): int {
            $device = PublisherDevice::query()->lockForUpdate()->findOrFail($deviceId);
            $state = $this->normalizeDesiredState($device->desired_state ?? []);
            foreach (['auto_run', 'poll_seconds', 'login_check_seconds', 'max_job_attempts', 'max_concurrent_groups', 'enabled_platform_ids', 'platform_policy', 'takeover'] as $key) {
                if (array_key_exists($key, $input)) {
                    $state[$key] = $input[$key];
                }
            }
            $state['version'] = max((int) ($device->desired_state_version ?? 0), (int) ($state['version'] ?? 0)) + 1;
            $state['updated_at'] = now()->toIso8601String();
            $clearOverride = (bool) ($input['clear_local_override'] ?? false);

            $device->forceFill([
                'desired_state' => $state,
                'desired_state_version' => $state['version'],
                'desired_state_updated_at' => now(),
                'local_override' => $clearOverride ? false : (bool) ($device->local_override ?? false),
            ])->save();

            return (int) $state['version'];
        });

        return back()->with('status', "设备期望配置已更新到 v{$version}。");
    }

    public function storeCommand(Request $request, int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);
        $input = $request->validate([
            'command_type' => ['required', 'string', 'max:60'],
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

        return $merged;
    }
}
