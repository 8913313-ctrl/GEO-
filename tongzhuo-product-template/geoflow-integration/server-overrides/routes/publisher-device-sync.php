<?php

use App\Http\Controllers\Api\V1\PublisherDeviceCommandController;
use App\Http\Controllers\Api\V1\PublisherDeviceController;
use App\Http\Controllers\Api\V1\PublisherDeviceEventController;
use App\Http\Controllers\Api\V1\PublisherDeviceShadowController;
use Illuminate\Support\Facades\Route;

/**
 * Device synchronization is deliberately separate from publisher jobs.
 *
 * Some production installations have only the old V1 jobs routes. Loading
 * this file independently lets those installations receive session, shadow,
 * command, and SSE endpoints without duplicate routes. The URI fallback
 * covers old host routes that predate route names.
 */
$publisherDeviceRouteExists = static function (string $name, string $method, string $uri): bool {
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
    ->group(function () use ($publisherDeviceRouteExists): void {
        Route::prefix('publisher')->name('api.v1.publisher.')->group(function () use ($publisherDeviceRouteExists): void {
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.register', 'POST', 'api/v1/publisher/devices/register')) {
                Route::post('devices/register', [PublisherDeviceController::class, 'register'])
                    ->middleware('throttle:20,1')
                    ->name('devices.register');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.heartbeat', 'POST', 'api/v1/publisher/devices/{device}/heartbeat')) {
                Route::post('devices/{device}/heartbeat', [PublisherDeviceShadowController::class, 'heartbeat'])->name('devices.heartbeat');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.shadow.heartbeat', 'POST', 'api/v1/publisher/devices/{device}/shadow/heartbeat')) {
                Route::post('devices/{device}/shadow/heartbeat', [PublisherDeviceShadowController::class, 'heartbeat'])->name('devices.shadow.heartbeat');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.shadow.show', 'GET', 'api/v1/publisher/devices/{device}/shadow')) {
                Route::get('devices/{device}/shadow', [PublisherDeviceShadowController::class, 'show'])->name('devices.shadow.show');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.events', 'GET', 'api/v1/publisher/devices/{device}/events')) {
                Route::get('devices/{device}/events', [PublisherDeviceEventController::class, 'stream'])->name('devices.events');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.sessions.index', 'GET', 'api/v1/publisher/devices/{device}/sessions')) {
                Route::get('devices/{device}/sessions', [PublisherDeviceController::class, 'sessions'])->name('devices.sessions.index');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.sessions.store', 'POST', 'api/v1/publisher/devices/{device}/sessions')) {
                Route::post('devices/{device}/sessions', [PublisherDeviceController::class, 'session'])->name('devices.sessions.store');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.commands.index', 'GET', 'api/v1/publisher/devices/{device}/commands')) {
                Route::get('devices/{device}/commands', [PublisherDeviceCommandController::class, 'index'])->name('devices.commands.index');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.commands.claim', 'POST', 'api/v1/publisher/devices/{device}/commands/{command}/claim')) {
                Route::post('devices/{device}/commands/{command}/claim', [PublisherDeviceCommandController::class, 'claim'])->whereNumber('command')->name('devices.commands.claim');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.commands.ack', 'POST', 'api/v1/publisher/devices/{device}/commands/{command}/ack')) {
                Route::post('devices/{device}/commands/{command}/ack', [PublisherDeviceCommandController::class, 'ack'])->whereNumber('command')->name('devices.commands.ack');
            }
            if (! $publisherDeviceRouteExists('api.v1.publisher.devices.commands.result', 'POST', 'api/v1/publisher/devices/{device}/commands/{command}/result')) {
                Route::post('devices/{device}/commands/{command}/result', [PublisherDeviceCommandController::class, 'result'])->whereNumber('command')->name('devices.commands.result');
            }
        });
    });
