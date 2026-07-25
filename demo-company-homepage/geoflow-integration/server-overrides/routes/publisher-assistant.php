<?php

use App\Http\Controllers\Api\V1\ContactLeadController;
use App\Http\Controllers\Api\V1\PublisherAssistantController;
use App\Http\Controllers\Api\V1\PublisherDeviceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')
    ->middleware(['api.request_id'])
    ->group(function (): void {
        Route::post('leads', [ContactLeadController::class, 'store'])
            ->middleware('throttle:10,1');

        Route::prefix('publisher')
            ->middleware(['api.auth'])
            ->group(function (): void {
                Route::post('devices/register', [PublisherDeviceController::class, 'register'])
                    ->middleware('api.scope:articles:write');
                Route::post('devices/{device}/heartbeat', [PublisherDeviceController::class, 'heartbeat'])
                    ->middleware('api.scope:articles:write');
                Route::get('jobs', [PublisherAssistantController::class, 'index'])
                    ->middleware('api.scope:articles:read');
                Route::get('jobs/{distribution}', [PublisherAssistantController::class, 'show'])
                    ->whereNumber('distribution')
                    ->middleware('api.scope:articles:read');
                Route::post('jobs/{distribution}/claim', [PublisherAssistantController::class, 'claim'])
                    ->whereNumber('distribution')
                    ->middleware('api.scope:articles:write');
                Route::post('jobs/{distribution}/result', [PublisherAssistantController::class, 'result'])
                    ->whereNumber('distribution')
                    ->middleware('api.scope:articles:write');
            });
    });
