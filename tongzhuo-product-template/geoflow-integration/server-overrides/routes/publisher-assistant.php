<?php

use App\Http\Controllers\Api\V1\ContactLeadController;
use App\Http\Controllers\Api\V1\PublisherAssistantController;
use App\Http\Controllers\Api\V1\PublisherPlatformJobController;
use Illuminate\Support\Facades\Route;

/**
 * Return true when a host installation already owns this endpoint.
 *
 * Route names protect normal upgrades; checking the method and URI as well
 * prevents duplicate registration when a partially upgraded host has an
 * older, unnamed version of the same endpoint.
 */
$publisherRouteExists = static function (string $name, string $method, string $uri): bool {
    if (Route::getRoutes()->getByName($name) !== null) {
        return true;
    }

    foreach (Route::getRoutes()->getRoutes() as $route) {
        if ($route->uri() === $uri && in_array($method, $route->methods(), true)) {
            return true;
        }
    }

    return false;
};

Route::prefix('v1')
    ->middleware(['api.request_id'])
    ->group(function () use ($publisherRouteExists): void {
        if (! $publisherRouteExists('api.v1.leads.store', 'POST', 'api/v1/leads')) {
            Route::post('leads', [ContactLeadController::class, 'store'])
                ->middleware('throttle:10,1')
                ->name('api.v1.leads.store');
        }

        Route::prefix('publisher')->name('api.v1.publisher.')->group(function () use ($publisherRouteExists): void {
            // V1 distribution jobs remain available for installed agents that
            // have not switched to platform jobs. Each endpoint is guarded
            // separately so a host-provided V1 route cannot suppress V2.
            if (! $publisherRouteExists('api.v1.publisher.jobs.index', 'GET', 'api/v1/publisher/jobs')) {
                Route::get('jobs', [PublisherAssistantController::class, 'index'])->name('jobs.index');
            }
            if (! $publisherRouteExists('api.v1.publisher.jobs.show', 'GET', 'api/v1/publisher/jobs/{distribution}')) {
                Route::get('jobs/{distribution}', [PublisherAssistantController::class, 'show'])
                    ->whereNumber('distribution')
                    ->name('jobs.show');
            }
            if (! $publisherRouteExists('api.v1.publisher.jobs.claim', 'POST', 'api/v1/publisher/jobs/{distribution}/claim')) {
                Route::post('jobs/{distribution}/claim', [PublisherAssistantController::class, 'claim'])
                    ->whereNumber('distribution')
                    ->name('jobs.claim');
            }
            if (! $publisherRouteExists('api.v1.publisher.jobs.result', 'POST', 'api/v1/publisher/jobs/{distribution}/result')) {
                Route::post('jobs/{distribution}/result', [PublisherAssistantController::class, 'result'])
                    ->whereNumber('distribution')
                    ->name('jobs.result');
            }

            // V2 platform jobs are independent from the V1 sentinel above.
            // During a rolling upgrade either protocol can already exist
            // without hiding the other.
            if (! $publisherRouteExists('api.v1.publisher.platform-jobs.index', 'GET', 'api/v1/publisher/platform-jobs')) {
                Route::get('platform-jobs', [PublisherPlatformJobController::class, 'index'])->name('platform-jobs.index');
            }
            if (! $publisherRouteExists('api.v1.publisher.platform-jobs.claim', 'POST', 'api/v1/publisher/platform-jobs/{job}/claim')) {
                Route::post('platform-jobs/{job}/claim', [PublisherPlatformJobController::class, 'claim'])->whereNumber('job')->name('platform-jobs.claim');
            }
            if (! $publisherRouteExists('api.v1.publisher.platform-jobs.heartbeat', 'POST', 'api/v1/publisher/platform-jobs/{job}/heartbeat')) {
                Route::post('platform-jobs/{job}/heartbeat', [PublisherPlatformJobController::class, 'heartbeat'])->whereNumber('job')->name('platform-jobs.heartbeat');
            }
            if (! $publisherRouteExists('api.v1.publisher.platform-jobs.progress', 'POST', 'api/v1/publisher/platform-jobs/{job}/progress')) {
                Route::post('platform-jobs/{job}/progress', [PublisherPlatformJobController::class, 'progress'])->whereNumber('job')->name('platform-jobs.progress');
            }
            if (! $publisherRouteExists('api.v1.publisher.platform-jobs.result', 'POST', 'api/v1/publisher/platform-jobs/{job}/result')) {
                Route::post('platform-jobs/{job}/result', [PublisherPlatformJobController::class, 'result'])->whereNumber('job')->name('platform-jobs.result');
            }
        });
    });
