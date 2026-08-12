<?php

use App\Http\Controllers\Api\V1\ContactLeadController;
use App\Http\Controllers\Api\V1\PublisherAssistantController;
use App\Http\Controllers\Api\V1\PublisherDeviceController;
use App\Http\Controllers\Api\V1\PublisherDeviceCommandController;
use App\Http\Controllers\Api\V1\PublisherDeviceShadowController;
use App\Http\Controllers\Api\V1\PublisherPlatformJobController;
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
            Route::post('devices/{device}/heartbeat', [PublisherDeviceShadowController::class, 'heartbeat'])->name('devices.heartbeat');
            Route::post('devices/{device}/shadow/heartbeat', [PublisherDeviceShadowController::class, 'heartbeat'])->name('devices.shadow.heartbeat');
            Route::get('devices/{device}/shadow', [PublisherDeviceShadowController::class, 'show'])->name('devices.shadow.show');
            Route::get('devices/{device}/sessions', [PublisherDeviceController::class, 'sessions'])->name('devices.sessions.index');
            Route::post('devices/{device}/sessions', [PublisherDeviceController::class, 'session'])->name('devices.sessions.store');
            Route::get('devices/{device}/commands', [PublisherDeviceCommandController::class, 'index'])->name('devices.commands.index');
            Route::post('devices/{device}/commands/{command}/claim', [PublisherDeviceCommandController::class, 'claim'])->whereNumber('command')->name('devices.commands.claim');
            Route::post('devices/{device}/commands/{command}/ack', [PublisherDeviceCommandController::class, 'ack'])->whereNumber('command')->name('devices.commands.ack');
            Route::post('devices/{device}/commands/{command}/result', [PublisherDeviceCommandController::class, 'result'])->whereNumber('command')->name('devices.commands.result');

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

            Route::get('platform-jobs', [PublisherPlatformJobController::class, 'index'])->name('platform-jobs.index');
            Route::post('platform-jobs/{job}/claim', [PublisherPlatformJobController::class, 'claim'])->whereNumber('job')->name('platform-jobs.claim');
            Route::post('platform-jobs/{job}/heartbeat', [PublisherPlatformJobController::class, 'heartbeat'])->whereNumber('job')->name('platform-jobs.heartbeat');
            Route::post('platform-jobs/{job}/progress', [PublisherPlatformJobController::class, 'progress'])->whereNumber('job')->name('platform-jobs.progress');
            Route::post('platform-jobs/{job}/result', [PublisherPlatformJobController::class, 'result'])->whereNumber('job')->name('platform-jobs.result');
        });
    });
