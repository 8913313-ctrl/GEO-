<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\ArticleDistribution;
use App\Models\PublisherDevice;
use App\Models\PublisherPlatformJob;
use App\Services\Publishing\PublisherDeviceCredential;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Short-lived authenticated SSE wake-up stream for publisher devices. */
class PublisherDeviceEventController extends BaseApiController
{
    public function stream(Request $request, string $device): StreamedResponse
    {
        if (! (bool) config('publishing.device_events_enabled', false)) {
            throw new ApiException('publisher_device_events_disabled', 'Device event stream is not enabled.', 404);
        }

        $record = $this->authorizeDevice($request, $device);
        $maxSeconds = max(5, min(60, (int) config('publishing.device_events_max_seconds', 25)));
        $pollMilliseconds = max(250, min(5000, (int) config('publishing.device_events_poll_ms', 1000)));
        $initialFingerprint = $this->fingerprint($record);

        return response()->stream(function () use ($device, $maxSeconds, $pollMilliseconds, $initialFingerprint): void {
            @set_time_limit(0);
            $last = $initialFingerprint;
            $started = microtime(true);
            $this->emit('ready', [
                'device_id' => $device,
                'desired_state_version' => $last['desired_state_version'],
            ]);

            while (! connection_aborted() && (microtime(true) - $started) < $maxSeconds) {
                usleep($pollMilliseconds * 1000);
                $fresh = PublisherDevice::query()->where('device_id', $device)->first();
                if (! $fresh || $fresh->disabled_at !== null) break;
                $current = $this->fingerprint($fresh);
                if ($current['desired_state_version'] !== $last['desired_state_version']) {
                    $this->emit('desired_state_changed', ['desired_state_version' => $current['desired_state_version']]);
                }
                if ($current['commands'] !== $last['commands']) {
                    $this->emit('commands_available', [
                        'queued' => $current['commands']['queued'],
                        'latest_id' => $current['commands']['latest_id'],
                    ]);
                }
                if ($current['jobs'] !== $last['jobs']) {
                    $this->emit('jobs_available', [
                        'queued' => $current['jobs']['queued'],
                        'latest_id' => $current['jobs']['latest_id'],
                    ]);
                }
                $this->emit('keepalive', ['ts' => now()->toIso8601String()]);
                $last = $current;
            }
        }, 200, [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** @param array<string,mixed> $payload */
    private function emit(string $event, array $payload): void
    {
        echo 'event: '.preg_replace('/[^a-z0-9_.-]/i', '', $event)."\n";
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n\n";
        if (function_exists('ob_flush')) @ob_flush();
        @flush();
    }

    /** @return array<string,mixed> */
    private function fingerprint(PublisherDevice $device): array
    {
        $commands = ['queued' => 0, 'latest_id' => 0];
        try {
            $query = $device->commands()->where('status', 'queued');
            $commands['queued'] = (int) $query->count();
            $commands['latest_id'] = (int) ($query->max('id') ?? 0);
        } catch (\Throwable) {
        }

        $jobs = ['queued' => 0, 'latest_id' => 0];
        try {
            $query = PublisherPlatformJob::query()
                ->where(function ($inner) use ($device): void {
                    $inner->whereNull('publisher_device_id')->orWhere('publisher_device_id', $device->id);
                })
                ->whereIn('status', ['queued', 'waiting_for_device', 'processing', 'claimed'])
                ->where(function ($inner): void {
                    $inner->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', now());
                });
            $jobs['queued'] = (int) $query->count();
            $jobs['latest_id'] = (int) ($query->max('id') ?? 0);
        } catch (\Throwable) {
        }

        $legacy = ['queued' => 0, 'latest_id' => 0];
        try {
            $query = ArticleDistribution::query()
                ->whereIn('status', ['queued', 'sending', 'synced', 'failed'])
                ->whereDoesntHave('publisherPlatformJobs')
                ->whereHas('channel', function ($inner): void {
                    $inner->whereIn('channel_type', ['desktop_publisher', 'wechatsync_manual'])
                        ->where('status', 'active');
                });
            $legacy['queued'] = (int) $query->count();
            $legacy['latest_id'] = (int) ($query->max('id') ?? 0);
        } catch (\Throwable) {
        }

        return [
            'desired_state_version' => (int) ($device->desired_state_version ?? 0),
            'commands' => $commands,
            'jobs' => [
                'v2' => $jobs,
                'legacy' => $legacy,
                'queued' => $jobs['queued'] + $legacy['queued'],
                'latest_id' => max($jobs['latest_id'], $legacy['latest_id']),
            ],
        ];
    }

    private function authorizeDevice(Request $request, string $deviceId): PublisherDevice
    {
        $record = PublisherDevice::query()->where('device_id', $deviceId)->first();
        if (! $record) throw new ApiException('publisher_device_not_found', 'Publisher device not found.', 404);
        if ($record->disabled_at !== null) throw new ApiException('publisher_device_disabled', 'Publisher device is disabled.', 403);
        $worker = trim((string) $request->header('X-Publisher-Worker', ''));
        if ($worker !== '' && ! hash_equals((string) $record->device_id, $worker)) {
            throw new ApiException('publisher_device_worker_mismatch', 'Publisher worker does not match the requested device.', 403);
        }
        $token = trim((string) $request->bearerToken());
        if (! PublisherDeviceCredential::verify($record, $token)) {
            throw new ApiException('publisher_device_unauthorized', 'Publisher device credential is invalid.', 401);
        }
        return $record;
    }
}
