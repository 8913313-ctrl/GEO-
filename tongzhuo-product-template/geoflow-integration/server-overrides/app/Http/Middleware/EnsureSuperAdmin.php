<?php

namespace App\Http\Middleware;

use App\Services\Access\AccessControlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function __construct(private readonly AccessControlService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->access->isSuperAdmin()) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'ok' => false,
                'error' => ['code' => 'super_admin_required', 'message' => '此操作仅限超级管理员。'],
            ], 403);
        }

        abort(403, '此操作仅限超级管理员。');
    }
}
