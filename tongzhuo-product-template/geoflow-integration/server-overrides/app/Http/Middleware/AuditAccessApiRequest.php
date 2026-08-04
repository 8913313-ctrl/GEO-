<?php

namespace App\Http\Middleware;

use App\Services\Access\AccessControlService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditAccessApiRequest
{
    public function __construct(private readonly AccessControlService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = null;
        try {
            return $response = $next($request);
        } finally {
            $context = (array) $request->attributes->get('access.auth', []);
            $this->access->audit(
                'access_api.request',
                'api_route',
                (string) optional($request->route())->getName(),
                [
                    'api_key_id' => $context['api_key_id'] ?? null,
                    'method' => $request->method(),
                    'path' => $request->path(),
                    'status' => $response?->getStatusCode() ?? 500,
                ],
                $request,
            );
        }
    }
}
