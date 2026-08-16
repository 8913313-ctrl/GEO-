<?php

/**
 * Laravel 11 搴旂敤鍏ュ彛锛氳矾鐢便€佷腑闂翠欢鍒悕銆丄PI 寮傚父娓叉煋涓虹粺涓€ JSON 淇″皝銆? *
 * API 璺敱锛歚routes/api.php`锛堝墠缂€ /api锛夛紱`ApiException` 鍦?api/* 璇锋眰涓嬭浆涓?{@see ApiResponse::error}銆? */

use App\Console\Commands\ReconcilePublisherPlatformJobsCommand;
use App\Exceptions\ApiException;
use App\Http\Middleware\AdminWebLocale;
use App\Http\Middleware\AssignApiRequestId;
use App\Http\Middleware\AuditAccessApiRequest;
use App\Http\Middleware\AuthenticateAdminWeb;
use App\Http\Middleware\AuthenticateAccessApi;
use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\EnsureAccessScope;
use App\Http\Middleware\EnsureAdminPermission;
use App\Http\Middleware\EnforceAdminRbac;
use App\Http\Middleware\EnsureApiScope;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\LogAdminActivity;
use App\Http\Middleware\RecordSiteViewLog;
use App\Http\Middleware\SiteWebLocale;
use App\Support\ApiResponse;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function (): void {
            // Load the private-deployment content API once after the host
            // application's api.php.  The route file is kept separate so a
            // GEOFlow upgrade cannot overwrite the host API routes.
            $name = 'api.v1.content.business-lines.index';
            if (Route::getRoutes()->getByName($name) === null) {
                Route::prefix('api')->middleware('api')->group(function (): void {
                    require __DIR__.'/../routes/tongzhuo-content-api.php';
                });
            }
            // Device synchronization must not share the legacy jobs route's
            // registration sentinel. Existing V1 jobs are common on partially
            // upgraded servers, while device sessions, shadows, commands, and
            // SSE events may still be absent. Both route files make their
            // individual registrations idempotent, so loading them separately
            // preserves V1/V2 routes and fills only missing endpoints.
            Route::prefix('api')->middleware('api')->group(function (): void {
                require __DIR__.'/../routes/publisher-device-sync.php';
            });
            Route::prefix('api')->middleware('api')->group(function (): void {
                require __DIR__.'/../routes/publisher-assistant.php';
            });
            if (Route::getRoutes()->getByName('admin.ai.providers.index') === null) {
                require base_path('routes/tongzhuo-ai-api.php');
            }
            if (Route::getRoutes()->getByName('api.v1.access.me') === null) {
                require base_path('routes/tongzhuo-access-api.php');
            }
        },
    )
    ->withCommands([
        ReconcilePublisherPlatformJobsCommand::class,
    ])
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('publisher:reconcile')
            ->everyMinute()
            ->withoutOverlapping(5)
            ->when(fn (): bool => (bool) config('publishing.job_reconcile_schedule_enabled', true));
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            // 鐢熸垚/閫忎紶 X-Request-Id锛屽苟鍐欏叆鍝嶅簲澶?            'api.request_id' => AssignApiRequestId::class,
            // Authorization: Bearer锛岃В鏋?Sanctum token 骞舵敞鍏?ApiAuthContext
            'api.auth' => AuthenticateApiToken::class,
            'access.auth' => AuthenticateAccessApi::class,
            'access.audit' => AuditAccessApiRequest::class,
            'access.scope' => EnsureAccessScope::class,
            // 鏍￠獙 Token scopes锛屽 api.scope:catalog:read
            'api.scope' => EnsureApiScope::class,
            // Blade 鍚庡彴锛氱鐞嗗憳浼氳瘽閴存潈锛堝け璐ヨ烦杞?admin.login锛?            'admin.auth' => AuthenticateAdminWeb::class,
            // Blade 鍚庡彴锛歴ession locale
            'admin.locale' => AdminWebLocale::class,
            // 鍓嶅彴锛氬浐瀹?public_locale锛堥粯璁?zh_CN锛?            'site.locale' => SiteWebLocale::class,
            // 鍓嶅彴锛氫繚瀛樿闂棩蹇楋紝渚涙暟鎹垎鏋愭ā鍧楃粺璁?PV銆佽矾寰勫拰鐖櫕绫诲瀷
            'site.view_log' => RecordSiteViewLog::class,
            // Blade 鍚庡彴锛氫粎瓒呯骇绠＄悊鍛?            'admin.super' => EnsureSuperAdmin::class,
            // Blade 鍚庡彴锛氬啓鎿嶄綔鏃ュ織
            'admin.permission' => EnsureAdminPermission::class,
            'admin.rbac' => EnforceAdminRbac::class,
            'admin.activity' => LogAdminActivity::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if ($request->is('api/*')) {
                $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());
                $status = $e->getStatusCode();
                $code = match ($status) {
                    401 => 'unauthenticated',
                    403 => 'forbidden',
                    404 => 'not_found',
                    409 => 'conflict',
                    419 => 'csrf_token_mismatch',
                    429 => 'rate_limited',
                    default => 'http_error',
                };

                return ApiResponse::error(
                    $code,
                    $status === 419 ? '页面会话或 CSRF Token 已失效，请刷新后重试。' : ($e->getMessage() ?: '请求无法完成。'),
                    $rid,
                    $status
                )->withHeaders(['X-Request-Id' => $rid]);
            }

            $adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');
            if ($e->getStatusCode() !== 419 || ! $request->is($adminPrefix.'/login')) {
                return null;
            }

            return redirect()
                ->route('admin.login')
                ->withErrors(['username' => '登录页面已更新或会话已过期，请重新登录。']);
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());

            return ApiResponse::error(
                'validation_failed',
                '提交的数据不符合要求。',
                $rid,
                422,
                ['errors' => $e->errors()]
            )->withHeaders(['X-Request-Id' => $rid]);
        });

        /**
         * 鍚庡彴 firstOrFail 鍙嬪ソ閿欒椤碉細
         * Laravel 娓叉煋娴佺▼閲?ModelNotFoundException 鍙兘浼氬厛鍖呰涓?NotFoundHttpException锛?         * 鍥犳缁熶竴鎷︽埅 404锛屽苟浠呭鈥滄ā鍨嬩笉瀛樺湪鈥濆満鏅緭鍑哄悗鍙伴鏍肩殑 404 瑙嗗浘銆?         */
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return null;
            }

            $adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');
            if (! $request->is($adminPrefix.'/*')) {
                return null;
            }

            if (! $e->getPrevious() instanceof ModelNotFoundException) {
                return null;
            }

            return response()->view('admin.errors.not-found', [
                'pageTitle' => __('admin.common.not_found_title'),
                'activeMenu' => '',
                'adminSiteName' => config('app.name'),
            ], 404);
        });

        $exceptions->render(function (ApiException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());

            return ApiResponse::error(
                $e->getErrorCode(),
                $e->getMessage(),
                $rid,
                $e->getHttpStatus(),
                $e->getDetails()
            )->withHeaders(['X-Request-Id' => $rid]);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || $e instanceof ApiException) {
                return null;
            }

            Log::error($e->getMessage(), [
                'exception' => $e::class,
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());

            return ApiResponse::error(
                'internal_error',
                '服务器内部错误。',
                $rid,
                500
            )->withHeaders(['X-Request-Id' => $rid]);
        });
    })->create();
