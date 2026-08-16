<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherDevice;
use App\Models\PublisherDevicePairing;
use App\Models\PublisherAccountGroupItem;
use App\Models\PublisherPlatformSession;
use App\Services\Publishing\PublisherDeviceCredential;
use App\Services\Publishing\PublisherPlatformJobLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublisherDeviceController extends BaseApiController
{
    public function __construct(
        private readonly PublisherPlatformJobLifecycleService $lifecycle,
        private readonly PublisherDeviceShadowController $shadow,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'string', 'max:120'],
            'name' => ['required', 'string', 'max:120'],
            'public_key' => ['nullable', 'string', 'max:5000'],
            'device_secret' => ['nullable', 'string', 'max:5000'],
            'pairing_code' => ['nullable', 'string', 'max:80'],
            'connection_mode' => ['nullable', 'string', 'in:token,paired'],
            'capabilities' => ['nullable', 'array'],
            'meta' => ['nullable', 'array'],
        ]);

        $deviceSecret = trim((string) ($validated['device_secret'] ?? $validated['public_key'] ?? ''));
        if ($deviceSecret === '') {
            throw new ApiException('publisher_device_secret_required', '设备秘钥不能为空。', 422);
        }

        $pairingCode = trim((string) ($validated['pairing_code'] ?? ''));
        if ($pairingCode !== '') {
            // Preserve the existing expiry response and persist the expired
            // status before the atomic claim transaction begins.
            $this->validPairing($pairingCode);
        } else {
            $this->authorizeExistingDevice($request, (string) $validated['device_id']);
        }

        $registration = DB::transaction(function () use ($validated, $deviceSecret, $pairingCode): array {
            $pairing = null;
            if ($pairingCode !== '') {
                $pairing = PublisherDevicePairing::query()
                    ->where('pairing_code', $pairingCode)
                    ->where('status', 'pending')
                    ->lockForUpdate()
                    ->first();
                if (! $pairing) {
                    throw new ApiException('publisher_pairing_invalid', 'Pairing code is invalid or already in use.', 409);
                }
                if ($pairing->expires_at !== null && $pairing->expires_at->isPast()) {
                    $pairing->forceFill(['status' => 'expired'])->save();

                    return ['device' => null, 'pairing_expired' => true];
                }
            }

            // Lock an existing record too, so pairing/re-registration cannot
            // overwrite concurrent device metadata after the pairing is claimed.
            $existing = PublisherDevice::query()
                ->where('device_id', $validated['device_id'])
                ->lockForUpdate()
                ->first();
            $now = now();
            $device = $existing ?? new PublisherDevice(['device_id' => $validated['device_id']]);
            $device->forceFill([
                'device_id' => $validated['device_id'],
                'name' => $validated['name'],
                'public_key' => PublisherDeviceCredential::store($deviceSecret),
                'status' => 'online',
                'connection_mode' => 'paired',
                'pairing_code' => $pairing?->pairing_code ?? $existing?->pairing_code,
                'pairing_issued_at' => $pairing?->issued_at ?? $existing?->pairing_issued_at,
                'pairing_expires_at' => $pairing?->expires_at ?? $existing?->pairing_expires_at,
                'paired_at' => $pairing ? $now : ($existing?->paired_at ?? $now),
                'capabilities' => $validated['capabilities'] ?? [],
                'meta' => $validated['meta'] ?? [],
                'last_seen_at' => $now,
            ])->save();

            if ($pairing instanceof PublisherDevicePairing) {
                $pairing->forceFill([
                    'status' => 'claimed',
                    'claimed_at' => $now,
                    'claimed_device_id' => $device->device_id,
                ])->save();
            }

            return ['device' => $device->fresh(), 'pairing_expired' => false];
        });

        if ((bool) $registration['pairing_expired']) {
            throw new ApiException('publisher_pairing_expired', 'Pairing code has expired. Generate a new code in the admin panel.', 409);
        }

        /** @var PublisherDevice $device */
        $device = $registration['device'];

        return $this->success($request, [
            'device' => $this->serialize($device),
            'credential_type' => 'device_secret',
            'message' => '发布节点已绑定。后续心跳、拉取任务和回写结果使用本机设备秘钥鉴权。',
        ]);
    }

    public function heartbeat(Request $request, string $device): JsonResponse
    {
        // Some installed servers already own this legacy URI. Delegate it to
        // the shadow handler so those nodes receive desired state and report
        // their applied version without waiting for a route replacement.
        return $this->shadow->heartbeat($request, $device);
    }

    public function session(Request $request, string $device): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);

        $validated = $request->validate([
            'platform_id' => ['required', 'string', 'max:80'],
            'profile_key' => ['nullable', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'login_state' => ['required', 'string', 'in:unknown,open,ready,needs_login,needs_verification,needs_captcha,expired,disabled,error'],
            'last_verified_at' => ['nullable', 'date'],
            'last_error_message' => ['nullable', 'string', 'max:1000'],
            'auto_allowed' => ['nullable', 'boolean'],
            'meta' => ['nullable', 'array'],
        ]);

        $sessionUpdate = DB::transaction(function () use ($record, $validated): array {
            // Serialize session upserts per device. This closes the
            // updateOrCreate race that can otherwise produce a duplicate-key
            // response while several platform probes finish together.
            PublisherDevice::query()->whereKey($record->id)->lockForUpdate()->firstOrFail();
            $sessionLookup = [
                'publisher_device_id' => $record->id,
                'device_id' => $record->device_id,
                'platform_id' => $validated['platform_id'],
                'profile_key' => $validated['profile_key'] ?? null,
            ];
            $previousSession = PublisherPlatformSession::query()->where($sessionLookup)->first();
            $session = PublisherPlatformSession::query()->updateOrCreate(
                $sessionLookup,
                [
                    'account_name' => $validated['account_name'] ?? null,
                    'login_state' => $validated['login_state'],
                    'last_verified_at' => $validated['last_verified_at'] ?? null,
                    'last_seen_at' => now(),
                    'last_error_message' => $validated['last_error_message'] ?? null,
                    'auto_allowed' => $validated['auto_allowed'] ?? false,
                    'meta' => $validated['meta'] ?? [],
                ],
            );
            PublisherAccountGroupItem::query()
                ->where('publisher_device_id', $record->id)
                ->where('platform_id', $validated['platform_id'])
                ->when(
                    filled($validated['profile_key'] ?? null),
                    fn ($query) => $query->where('profile_key', $validated['profile_key'])
                )
                ->update(['publisher_platform_session_id' => $session->id]);

            return [
                'session' => $session,
                'previous_login_state' => $previousSession?->login_state,
            ];
        });
        /** @var PublisherPlatformSession $session */
        $session = $sessionUpdate['session'];
        $previousLoginState = $sessionUpdate['previous_login_state'];

        $this->lifecycle->onSessionUpdated($session->fresh(['device']), $previousLoginState);

        return $this->success($request, [
            'session' => $this->serializeSession($session),
            'sessions' => $this->serializeSessions($record),
        ]);
    }

    public function sessions(Request $request, string $device): JsonResponse
    {
        $record = $this->authorizeDevice($request, $device);

        return $this->success($request, [
            'device_id' => $record->device_id,
            'sessions' => $this->serializeSessions($record),
        ]);
    }

    private function validPairing(string $pairingCode): PublisherDevicePairing
    {
        $pairing = PublisherDevicePairing::query()
            ->where('pairing_code', $pairingCode)
            ->where('status', 'pending')
            ->first();

        if (! $pairing) {
            throw new ApiException('publisher_pairing_invalid', '配对码无效或已被使用。', 409);
        }

        if ($pairing->expires_at !== null && $pairing->expires_at->isPast()) {
            $pairing->forceFill(['status' => 'expired'])->save();
            throw new ApiException('publisher_pairing_expired', '配对码已过期，请在后台重新生成。', 409);
        }

        return $pairing;
    }

    private function authorizeExistingDevice(Request $request, string $deviceId): PublisherDevice
    {
        $record = PublisherDevice::query()->where('device_id', $deviceId)->first();
        if (! $record) {
            throw new ApiException('publisher_pairing_required', '首次绑定必须使用后台生成的配对码。', 409);
        }

        return $this->authorizeDevice($request, $deviceId);
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

    /** @return array<string,mixed> */
    private function serialize(PublisherDevice $device): array
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
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'updated_at' => $device->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function serializeSessions(PublisherDevice $device): array
    {
        return $device->platformSessions()
            ->orderByDesc('last_seen_at')
            ->orderByDesc('id')
            // A device can track all 28 supported platforms and multiple
            // profiles. Limiting this to 24 hid healthy session records.
            ->limit(100)
            ->get()
            ->map(fn (PublisherPlatformSession $session): array => $this->serializeSession($session))
            ->all();
    }

    /** @return array<string,mixed> */
    private function serializeSession(PublisherPlatformSession $session): array
    {
        return [
            'id' => (int) $session->id,
            'platform_id' => (string) $session->platform_id,
            'profile_key' => $session->profile_key,
            'account_name' => $session->account_name,
            'login_state' => (string) $session->login_state,
            'last_verified_at' => $session->last_verified_at?->toIso8601String(),
            'last_seen_at' => $session->last_seen_at?->toIso8601String(),
            'last_error_message' => $session->last_error_message,
            'auto_allowed' => (bool) $session->auto_allowed,
            'meta' => $session->meta ?? [],
        ];
    }
}
