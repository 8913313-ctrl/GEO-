<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublisherDeviceController extends BaseApiController
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'string', 'max:120'],
            'name' => ['required', 'string', 'max:120'],
            'public_key' => ['nullable', 'string', 'max:5000'],
            'capabilities' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
        ]);

        $device = PublisherDevice::query()->updateOrCreate(
            ['device_id' => $validated['device_id']],
            [
                'name' => $validated['name'],
                'public_key' => $validated['public_key'] ?? null,
                'status' => 'online',
                'capabilities' => $validated['capabilities'] ?? [],
                'meta' => $validated['meta'] ?? [],
                'last_seen_at' => now(),
            ],
        );

        return $this->success($request, $this->serialize($device));
    }

    public function heartbeat(Request $request, string $device): JsonResponse
    {
        $record = PublisherDevice::query()->where('device_id', $device)->first();
        if (! $record) {
            throw new ApiException('publisher_device_not_found', '发布设备不存在，请先绑定设备', 404);
        }
        if ($record->disabled_at !== null) {
            throw new ApiException('publisher_device_disabled', '发布设备已被禁用', 403);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:40'],
            'capabilities' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
        ]);

        $record->forceFill([
            'status' => $validated['status'] ?? 'online',
            'capabilities' => $validated['capabilities'] ?? $record->capabilities,
            'meta' => array_replace($record->meta ?? [], $validated['meta'] ?? []),
            'last_seen_at' => now(),
        ])->save();

        return $this->success($request, $this->serialize($record));
    }

    /** @return array<string,mixed> */
    private function serialize(PublisherDevice $device): array
    {
        return [
            'id' => (int) $device->id,
            'device_id' => (string) $device->device_id,
            'name' => (string) $device->name,
            'status' => (string) $device->status,
            'capabilities' => $device->capabilities ?? [],
            'meta' => $device->meta ?? [],
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'updated_at' => $device->updated_at?->toIso8601String(),
        ];
    }
}
