<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\PublisherDevicePairing;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = trim((string) $request->bearerToken());

        if ($token !== '') {
            $request->attributes->set('api.auth', [
                'type' => 'token',
                'token' => $token,
                'scopes' => ['articles:read', 'articles:write'],
            ]);

            return $next($request);
        }

        if ($request->is('api/v1/publisher/devices/register')) {
            $pairingCode = strtoupper(trim((string) $request->input('pairing_code', '')));
            if ($pairingCode === '') {
                throw new ApiException('publisher_pairing_required', '请先输入后台生成的配对码。', 401);
            }

            $pairing = PublisherDevicePairing::query()
                ->where('pairing_code', $pairingCode)
                ->where('status', 'pending')
                ->first();

            if (! $pairing) {
                throw new ApiException('publisher_pairing_invalid', '配对码无效或已过期。', 409);
            }

            $request->attributes->set('api.auth', [
                'type' => 'pairing',
                'pairing_code' => $pairingCode,
                'scopes' => ['articles:write'],
            ]);

            return $next($request);
        }

        throw new ApiException('publisher_auth_required', '请先完成设备绑定。', 401);
    }
}
