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

        Route::prefix('publisher')->name('api.v1.publisher.')->group(function (): void {
            Route::post('devices/register', [PublisherDeviceController::class, 'register'])
                ->middleware('throttle:20,1')
                ->name('devices.register');
            Route::post('devices/{device}/heartbeat', [PublisherDeviceController::class, 'heartbeat'])->name('devices.heartbeat');
            Route::get('devices/{device}/sessions', [PublisherDeviceController::class, 'sessions'])->name('devices.sessions.index');
            Route::post('devices/{device}/sessions', [PublisherDeviceController::class, 'session'])->name('devices.sessions.store');

            Route::get('jobs', [PublisherAssistantController::class, 'index'])->name('jobs.index');
            Route::get('jobs/{distribution}', [PublisherAssistantController::class, 'show'])
                ->whereNumber('distribution')
                ->name('jobs.show');
            Route::post('jobs/{distribution}/claim', [PublisherAssistantController::class, 'claim'])
                ->whereNumber('distribution')
                ->name('jobs.claim');
            Route::post('jobs/{distribution}/result', [PublisherAssistantController::class, 'result'])
                ->whereNumber('distribution')
                ->name('jobs.result');
        });
    });
