<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherDevice;
use App\Models\PublisherDeviceCommand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Device initiated command queue.
 *
 * The desktop agent always authenticates with its own device bearer secret.
 * Commands are leased to a device before execution and every mutation must
 * carry the lease token, which makes retries safe after a process restart.
 */
class PublisherDeviceCommandController extends BaseApiController
{
    public function index(Request $request, string $device): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);
        $limit = max(1, min(50, $request->integer('limit', 20)));
        $now = now();

        $commands = PublisherDeviceCommand::query()
            ->where('publisher_device_id', $record->id)
            ->where(function ($query) use ($record, $now): void {
                $query
                    ->where(function ($queued) use ($now): void {
                        $queued->where('status', 'queued')
                            ->where(function ($expiry) use ($now): void {
                                $expiry->whereNull('expires_at')->orWhere('expires_at', '>', $now);
                            });
                    })
                    ->orWhere(function ($claimed) use ($record, $now): void {
                        $claimed->whereIn('status', ['claimed', 'processing'])
                            ->where(function ($lease) use ($record, $now): void {
                                $lease->where('lease_expires_at', '<=', $now)
                                    ->orWhere(function ($owned) use ($record, $now): void {
                                        $owned->where('claimed_by', $record->device_id)
                                            ->whereNotNull('lease_token')
                                            ->where(function ($active) use ($now): void {
                                                $active->whereNull('lease_expires_at')->orWhere('lease_expires_at', '>', $now);
                                            });
                                    });
                            });
                    });
            })
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (PublisherDeviceCommand $command): array => $this->serializeCommand($command, $record))
            ->all();

        return $this->success($request, [
            'device_id' => $record->device_id,
            'items' => $commands,
            'commands' => $commands,
            'count' => count($commands),
            'server_time' => $now->toIso8601String(),
        ]);
    }

    public function claim(Request $request, string $device, int $command): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);
        $worker = $record->device_id;

        $claimed = DB::transaction(function () use ($command, $record, $worker): PublisherDeviceCommand {
            /** @var PublisherDeviceCommand|null $item */
            $item = PublisherDeviceCommand::query()
                ->whereKey($command)
                ->lockForUpdate()
                ->first();
            if (! $item || (int) $item->publisher_device_id !== (int) $record->id) {
                throw new ApiException('publisher_command_not_found', '设备命令不存在。', 404);
            }
            if ($item->expires_at !== null && $item->expires_at->isPast()) {
                if (! in_array((string) $item->status, ['completed', 'failed', 'cancelled'], true)) {
                    $item->forceFill(['status' => 'expired', 'completed_at' => now()])->save();
                }
                throw new ApiException('publisher_command_expired', '设备命令已过期。', 409);
            }

            $status = (string) $item->status;
            if (in_array($status, ['completed', 'failed', 'cancelled', 'expired'], true)) {
                throw new ApiException('publisher_command_completed', '设备命令已完成。', 409);
            }
            $sameLiveClaim = in_array($status, ['claimed', 'processing'], true)
                && (string) ($item->claimed_by ?? '') === $worker
                && filled($item->lease_token)
                && ($item->lease_expires_at === null || $item->lease_expires_at->isFuture());
            if ($sameLiveClaim) {
                return $item;
            }

            if (in_array($status, ['claimed', 'processing'], true)
                && (string) ($item->claimed_by ?? '') !== $worker
                && ($item->lease_expires_at === null || $item->lease_expires_at->isFuture())) {
                throw new ApiException('publisher_command_claimed', '设备命令正在由其他执行器处理。', 409);
            }

            $item->forceFill([
                'status' => 'claimed',
                'claimed_at' => $item->claimed_at ?? now(),
                'claimed_by' => $worker,
                'lease_token' => bin2hex(random_bytes(32)),
                'lease_expires_at' => now()->addMinutes($this->leaseMinutes()),
            ])->save();

            return $item->fresh();
        });

        return $this->success($request, [
            'command' => $this->serializeCommand($claimed, $record, true),
        ]);
    }

    /** Alias retained for clients that call the endpoint an acknowledgement. */
    public function ack(Request $request, string $device, int $command): JsonResponse
    {
        return $this->result($request, $device, $command);
    }

    public function result(Request $request, string $device, int $command): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);
        $lease = $this->leaseToken($request);
        $status = strtolower(trim((string) ($request->input('status') ?? $request->input('state') ?? 'completed')));
        $aliases = ['success' => 'completed', 'done' => 'completed', 'acknowledged' => 'completed'];
        $status = $aliases[$status] ?? $status;
        if (! in_array($status, ['processing', 'completed', 'failed', 'cancelled'], true)) {
            throw new ApiException('validation_failed', 'command status 无效。', 422, [
                'field_errors' => ['status' => '仅支持 processing、completed、failed、cancelled。'],
            ]);
        }
        $result = $this->sanitizeResult($request->input('result', $request->input('payload', [])));
        $message = trim((string) ($request->input('error_message') ?? $request->input('message') ?? ''));

        $updated = DB::transaction(function () use ($command, $record, $lease, $status, $result, $message): PublisherDeviceCommand {
            /** @var PublisherDeviceCommand|null $item */
            $item = PublisherDeviceCommand::query()->whereKey($command)->lockForUpdate()->first();
            if (! $item || (int) $item->publisher_device_id !== (int) $record->id) {
                throw new ApiException('publisher_command_not_found', '设备命令不存在。', 404);
            }
            $this->assertCommandLease($item, $record, $lease);
            $currentStatus = (string) $item->status;
            $terminalStatuses = ['completed', 'failed', 'cancelled'];
            if (in_array($currentStatus, $terminalStatuses, true)) {
                if ($currentStatus !== $status) {
                    throw new ApiException(
                        'publisher_command_terminal_conflict',
                        '设备命令已经进入终态，不能被不同结果覆盖。',
                        409,
                    );
                }

                // A client may retry the same acknowledgement after losing the
                // HTTP response. Return the stored result without mutating it.
                return $item;
            }
            $terminal = in_array($status, ['completed', 'failed', 'cancelled'], true);
            $item->forceFill([
                'status' => $status,
                'result' => array_replace($this->sanitizeResult(is_array($item->result) ? $item->result : []), $result),
                'error_message' => $message !== '' ? $message : ($item->error_message ?? null),
                'completed_at' => $terminal ? now() : null,
                'lease_expires_at' => $terminal ? null : now()->addMinutes($this->leaseMinutes()),
            ])->save();

            return $item->fresh();
        });

        return $this->success($request, [
            'command' => $this->serializeCommand($updated, $record),
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

    private function leaseToken(Request $request): string
    {
        return trim((string) ($request->input('lease_token') ?: $request->header('X-Publisher-Lease')));
    }

    private function assertCommandLease(PublisherDeviceCommand $item, PublisherDevice $device, string $lease): void
    {
        if ($lease === '' || ! hash_equals((string) ($item->lease_token ?? ''), $lease)
            || (string) ($item->claimed_by ?? '') !== (string) $device->device_id) {
            throw new ApiException('publisher_command_lease_invalid', '设备命令租约无效。', 409);
        }
        if ($item->lease_expires_at !== null && $item->lease_expires_at->isPast()) {
            throw new ApiException('publisher_command_lease_expired', '设备命令租约已过期。', 409);
        }
    }

    /** @param mixed $result
     *  @return array<string,mixed> */
    private function sanitizeResult(mixed $result): array
    {
        if (! is_array($result)) {
            throw new ApiException('validation_failed', 'result 必须是对象。', 422);
        }
        foreach (['lease_token', 'leaseToken', 'lease_expires_at', 'leaseExpiresAt', 'device_id', 'deviceId', 'publisher_device_id', 'publisherDeviceId', 'claimed_by', 'claimedBy', 'command_id', 'commandId'] as $key) {
            unset($result[$key]);
        }

        return $result;
    }

    private function leaseMinutes(): int
    {
        return max(1, (int) config('publishing.job_lease_minutes', 15));
    }

    /** @return array<string,mixed> */
    private function serializeCommand(PublisherDeviceCommand $command, PublisherDevice $device, bool $includeLease = false): array
    {
        $payload = [
            'id' => (int) $command->id,
            'publisher_device_id' => (int) $command->publisher_device_id,
            'device_id' => (string) $device->device_id,
            'command_type' => (string) $command->command_type,
            'status' => (string) $command->status,
            'payload' => $command->payload ?? [],
            'result' => $this->sanitizeResult(is_array($command->result) ? $command->result : []),
            'expires_at' => $command->expires_at?->toIso8601String(),
            'claimed_at' => $command->claimed_at?->toIso8601String(),
            'completed_at' => $command->completed_at?->toIso8601String(),
            'error_message' => $command->error_message,
            'updated_at' => $command->updated_at?->toIso8601String(),
        ];
        if ($includeLease && (string) ($command->claimed_by ?? '') === (string) $device->device_id) {
            $payload['lease_token'] = $command->lease_token;
            $payload['lease_expires_at'] = $command->lease_expires_at?->toIso8601String();
        }

        return $payload;
    }
}
