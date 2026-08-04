<?php

namespace App\Http\Middleware;

use App\Services\Access\AccessControlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateAccessApi
{
    public function __construct(private readonly AccessControlService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = trim((string) $request->bearerToken());
        $context = $token !== '' ? $this->access->authenticateApiKey($token) : null;
        if (! $context) {
            return response()->json([
                'ok' => false,
                'error' => ['code' => 'access_api_unauthorized', 'message' => 'API 密钥无效、已撤销或已过期。'],
            ], 401);
        }

        $request->attributes->set('access.auth', $context);
        // Keep a compatible context for existing API scope middleware.
        $request->attributes->set('api.auth', $context);

        return $next($request);
    }
}
