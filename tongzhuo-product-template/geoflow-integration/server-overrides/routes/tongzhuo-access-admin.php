<?php

use App\Http\Controllers\Admin\TongzhuoAccessController;
use Illuminate\Support\Facades\Route;

// Browser-admin endpoints inherit Laravel's web/session/CSRF middleware from
// routes/web.php. Bearer-token endpoints live in tongzhuo-access-api.php.
$adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');
Route::prefix($adminPrefix.'/access')
    ->middleware(['admin.auth', 'admin.permission:roles.manage', 'admin.activity'])
    ->name('admin.access.')
    ->group(function (): void {
        Route::get('me', [TongzhuoAccessController::class, 'me'])->name('me');
        Route::get('users', [TongzhuoAccessController::class, 'users'])->name('users.index');
        Route::post('users', [TongzhuoAccessController::class, 'storeUser'])->name('users.store');
        Route::patch('users/{adminId}', [TongzhuoAccessController::class, 'updateUser'])->whereNumber('adminId')->name('users.update');
        Route::post('users/{adminId}/toggle', [TongzhuoAccessController::class, 'toggleUser'])->whereNumber('adminId')->name('users.toggle');
        Route::delete('users/{adminId}', [TongzhuoAccessController::class, 'deleteUser'])->whereNumber('adminId')->name('users.delete');
        Route::get('roles', [TongzhuoAccessController::class, 'roles'])->name('roles.index');
        Route::post('roles', [TongzhuoAccessController::class, 'storeRole'])->name('roles.store');
        Route::patch('roles/{roleId}', [TongzhuoAccessController::class, 'updateRole'])->whereNumber('roleId')->name('roles.update');
        Route::get('permissions', [TongzhuoAccessController::class, 'permissions'])->name('permissions.index');
        Route::get('audit-logs', [TongzhuoAccessController::class, 'auditLogs'])->name('audit.index');
        Route::get('api-keys', [TongzhuoAccessController::class, 'apiKeys'])->name('api-keys.index');
        Route::post('api-keys', [TongzhuoAccessController::class, 'issueApiKey'])->middleware('admin.permission:api.manage')->name('api-keys.store');
        Route::post('api-keys/{keyId}/revoke', [TongzhuoAccessController::class, 'revokeApiKey'])->whereNumber('keyId')->middleware('admin.permission:api.manage')->name('api-keys.revoke');
    });
