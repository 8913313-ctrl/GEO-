<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiScope
{
    /**
     * @param  string  ...$scopes
     */
    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $auth = $request->attributes->get('api.auth');
        if (! is_array($auth)) {
            return $next($request);
        }

        $allowed = array_map('strval', $auth['scopes'] ?? []);
        foreach ($scopes as $scope) {
            if (! in_array($scope, $allowed, true)) {
                return response()->json([
                    'ok' => false,
                    'message' => '当前凭证没有访问该接口的权限。',
                ], 403);
            }
        }

        return $next($request);
    }
}
