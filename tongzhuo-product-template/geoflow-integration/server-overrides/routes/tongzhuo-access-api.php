<?php

use App\Http\Controllers\Admin\TongzhuoAccessController;
use Illuminate\Support\Facades\Route;

/*
 * Access API is kept separate from GEOFlow's vendor routes so a future
 * upstream upgrade does not require resolving a large routes/tongzhuo.php
 * merge. The installer loads this file from the override bootstrap.
 */
Route::prefix('api/v1/access')
    ->middleware(['api', 'throttle:120,1', 'access.auth', 'access.audit'])
    ->name('api.v1.access.')
    ->group(function (): void {
        Route::get('me', [TongzhuoAccessController::class, 'me'])->name('me');

    });
