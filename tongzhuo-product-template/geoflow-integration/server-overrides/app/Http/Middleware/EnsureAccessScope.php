<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccessScope
{
    /** @param string ...$scopes */
    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $context = $request->attributes->get('access.auth');
        $allowed = is_array($context) ? array_map('strval', $context['scopes'] ?? []) : [];
        foreach ($scopes as $scope) {
            if (! in_array($scope, $allowed, true) && ! in_array('*', $allowed, true)) {
                return response()->json([
                    'ok' => false,
                    'error' => ['code' => 'access_api_forbidden', 'message' => 'API 密钥没有访问此接口的权限。'],
                ], 403);
            }
        }

        return $next($request);
    }
}
