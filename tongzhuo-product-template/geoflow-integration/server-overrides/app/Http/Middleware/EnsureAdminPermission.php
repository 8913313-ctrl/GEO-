<?php

namespace App\Http\Middleware;

use App\Services\Access\AccessControlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminPermission
{
    public function __construct(private readonly AccessControlService $access) {}

    /**
     * Usage: ->middleware('admin.permission:knowledge.read,knowledge.write')
     * Multiple arguments are treated as OR.
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if ($permissions === [] || $this->access->allowsAny($permissions)) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'ok' => false,
                'error' => ['code' => 'permission_denied', 'message' => '当前账号没有执行此操作的权限。'],
            ], 403);
        }

        abort(403, '当前账号没有执行此操作的权限。');
    }
}
