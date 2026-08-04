<?php

use App\Http\Controllers\Api\V1\AiProviderController;
use Illuminate\Support\Facades\Route;

/*
 * This file is intentionally separate from the upstream routes/api.php. It
 * can be enabled on an existing GEOFlow installation by the override
 * bootstrap or by requiring it from the customer's route provider.
 */
Route::prefix('api/v1/ai')
    ->middleware(['api', 'throttle:60,1', 'api.request_id', 'access.auth', 'access.audit'])
    ->group(function (): void {
        // All model calls are scoped to content generation. Provider secrets
        // and diagnostics stay in the admin group below.
        Route::middleware('access.scope:content.generate')->group(function (): void {
            Route::post('chat', [AiProviderController::class, 'chat'])->name('api.v1.ai.chat');
            Route::post('generate-article', [AiProviderController::class, 'generateArticle'])->name('api.v1.ai.generate-article');
            Route::get('generation-runs/{runId}', [AiProviderController::class, 'generationRun'])->whereNumber('runId')->name('api.v1.ai.generation-runs.show');
        });
        Route::middleware('access.scope:knowledge.manage')->post('embeddings', [AiProviderController::class, 'embeddings'])->name('api.v1.ai.embeddings');
    });

// Provider CRUD and connection tests are internal operator actions. The
// `models.manage` permission is seeded by the private-installation RBAC
// migration (super admins retain access automatically).
$adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');
Route::prefix($adminPrefix.'/ai')
    ->middleware(['web', 'admin.auth', 'admin.permission:models.manage', 'admin.activity'])
    ->name('admin.ai.')
    ->group(function (): void {
        Route::get('providers', [AiProviderController::class, 'index'])->name('providers.index');
        Route::post('providers', [AiProviderController::class, 'store'])->name('providers.store');
        Route::get('providers/{providerId}', [AiProviderController::class, 'show'])->whereNumber('providerId')->name('providers.show');
        Route::put('providers/{providerId}', [AiProviderController::class, 'update'])->whereNumber('providerId')->name('providers.update');
        Route::delete('providers/{providerId}', [AiProviderController::class, 'destroy'])->whereNumber('providerId')->name('providers.destroy');
        Route::post('providers/{providerId}/test', [AiProviderController::class, 'test'])->whereNumber('providerId')->name('providers.test');
        Route::get('generation-runs/{runId}', [AiProviderController::class, 'generationRun'])->whereNumber('runId')->name('generation-runs.show');
    });
