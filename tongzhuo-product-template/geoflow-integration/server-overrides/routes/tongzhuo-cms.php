<?php

use App\Http\Controllers\Admin\TongzhuoCmsController;
use App\Http\Controllers\Admin\TongzhuoFaqController;
use Illuminate\Support\Facades\Route;

$prefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');

Route::prefix($prefix.'/tongzhuo-cms')->name('admin.tongzhuo-cms.')->middleware(['admin.auth', 'admin.rbac', 'admin.activity'])->group(function (): void {
    Route::get('/', [TongzhuoCmsController::class, 'dashboard'])->name('dashboard');

    Route::prefix('faqs')->name('faqs.')->group(function (): void {
        Route::get('/', [TongzhuoFaqController::class, 'index'])->name('index');
        Route::post('categories', [TongzhuoFaqController::class, 'categoryStore'])->name('categories.store');
        Route::put('categories/{categoryId}', [TongzhuoFaqController::class, 'categoryUpdate'])->whereNumber('categoryId')->name('categories.update');
        Route::post('items', [TongzhuoFaqController::class, 'itemStore'])->name('items.store');
        Route::put('items/{itemId}', [TongzhuoFaqController::class, 'itemUpdate'])->whereNumber('itemId')->name('items.update');
        Route::post('items/{itemId}/status', [TongzhuoFaqController::class, 'itemStatus'])->whereNumber('itemId')->name('items.status');
        Route::post('items/{itemId}/delete', [TongzhuoFaqController::class, 'itemDelete'])->whereNumber('itemId')->name('items.delete');
    });

    // 椤甸潰绠＄悊
    Route::prefix('pages')->name('pages.')->group(function (): void {
        Route::get('/', [TongzhuoCmsController::class, 'pageIndex'])->name('index');
        Route::get('create', [TongzhuoCmsController::class, 'pageCreate'])->name('create');
        Route::post('create', [TongzhuoCmsController::class, 'pageStore'])->name('store');
        Route::get('{pageId}', [TongzhuoCmsController::class, 'pageEdit'])->whereNumber('pageId')->name('edit');
        Route::put('{pageId}', [TongzhuoCmsController::class, 'pageUpdate'])->whereNumber('pageId')->name('update');
        Route::post('{pageId}/publish', [TongzhuoCmsController::class, 'pagePublish'])->whereNumber('pageId')->name('publish');
        Route::post('{pageId}/draft', [TongzhuoCmsController::class, 'pageDraft'])->whereNumber('pageId')->name('draft');
        Route::post('{pageId}/delete', [TongzhuoCmsController::class, 'pageDelete'])->whereNumber('pageId')->name('delete');

        // 鍖哄潡绠＄悊
        Route::post('{pageId}/blocks', [TongzhuoCmsController::class, 'blockStore'])->whereNumber('pageId')->name('blocks.store');
        Route::put('blocks/{blockId}', [TongzhuoCmsController::class, 'blockUpdate'])->whereNumber('blockId')->name('blocks.update');
        Route::post('blocks/{blockId}/delete', [TongzhuoCmsController::class, 'blockDelete'])->whereNumber('blockId')->name('blocks.delete');
        Route::post('blocks/reorder', [TongzhuoCmsController::class, 'blockReorder'])->name('blocks.reorder');
    });

    // 瀵艰埅绠＄悊
    Route::prefix('navigation')->name('navigation.')->group(function (): void {
        Route::get('/', [TongzhuoCmsController::class, 'navIndex'])->name('index');
        Route::post('save', [TongzhuoCmsController::class, 'navSave'])->name('save');
    });

    // 鍏ㄧ珯璁剧疆
    Route::prefix('settings')->name('settings.')->group(function (): void {
        Route::get('/', [TongzhuoCmsController::class, 'settingsIndex'])->name('index');
        Route::post('save', [TongzhuoCmsController::class, 'settingsSave'])->name('save');
    });
});
