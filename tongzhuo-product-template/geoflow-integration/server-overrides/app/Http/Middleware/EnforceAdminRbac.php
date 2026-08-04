<?php

namespace App\Http\Middleware;

use App\Services\Access\AccessControlService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/** Apply private-installation RBAC to legacy GEOFlow admin routes. */
class EnforceAdminRbac
{
    public function __construct(private readonly AccessControlService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        $permissions = $this->requiredPermissions($request);
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

    /** @return list<string> */
    private function requiredPermissions(Request $request): array
    {
        $name = (string) optional($request->route())->getName();
        $read = $request->isMethodSafe();

        if (in_array($name, ['admin.logout', 'admin.welcome.dismiss', 'admin.security-settings.password.update'], true)) {
            return [];
        }
        if ($name === 'admin.dashboard') {
            return ['dashboard.view'];
        }
        if (Str::startsWith($name, ['admin.site-console', 'admin.tongzhuo-cms.'])) {
            return ['website.manage'];
        }
        if (Str::startsWith($name, ['admin.site-settings', 'admin.security-settings'])) {
            return ['website.manage'];
        }
        if ($name === 'admin.geo-console' || Str::startsWith($name, ['admin.geo-growth.', 'admin.geo-opportunities.', 'admin.geo-plans.', 'admin.geo-answer-tests.'])) {
            return $read ? ['geo.read'] : ['geo.write'];
        }
        if ($name === 'admin.analytics') {
            return ['analytics.read'];
        }
        if (Str::startsWith($name, ['admin.fact-base.', 'admin.knowledge-bases.', 'admin.image-libraries.']) || Str::startsWith($name, 'admin.url-import') || $name === 'admin.materials.index') {
            return $read ? ['knowledge.read'] : ['knowledge.write'];
        }
        if (Str::startsWith($name, ['admin.tasks.', 'admin.keyword-libraries.', 'admin.title-libraries.'])) {
            return ['planning.write'];
        }
        if (Str::startsWith($name, 'admin.articles.')) {
            if ($name === 'admin.articles.batch.update-review') {
                return ['content.review'];
            }
            if ($name === 'admin.articles.dispatch') {
                return ['publishing.write'];
            }

            return $read ? ['content.write', 'content.review', 'publishing.read'] : ['content.write'];
        }
        if (Str::startsWith($name, ['admin.categories.', 'admin.authors.'])) {
            return ['content.write'];
        }
        if (Str::startsWith($name, ['admin.distribution.', 'admin.publisher-devices.', 'admin.publisher-assistant'])) {
            return $read ? ['publishing.read'] : ['publishing.write'];
        }
        if (Str::startsWith($name, ['admin.contact-leads.', 'admin.customer-projects.'])) {
            return ['customers.manage'];
        }
        if (Str::startsWith($name, ['admin.ai-models.', 'admin.ai-prompts', 'admin.ai-special-prompts']) || $name === 'admin.ai.configurator') {
            return ['models.manage'];
        }
        if (Str::startsWith($name, ['admin.admin-users.', 'admin.api-tokens.']) || $name === 'admin.admin-activity-logs') {
            return ['roles.manage'];
        }

        return ['dashboard.view'];
    }
}
