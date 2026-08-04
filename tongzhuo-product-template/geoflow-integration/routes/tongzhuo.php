<?php

use App\Http\Controllers\Site\TongzhuoContentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['site.locale', 'site.view_log'])->group(function (): void {
    Route::get('/insights', [TongzhuoContentController::class, 'insights'])->name('tongzhuo.insights');
    Route::get('/insights.html', [TongzhuoContentController::class, 'insights'])->name('tongzhuo.insights.legacy');
    Route::get('/index.html', [TongzhuoContentController::class, 'home'])->name('tongzhuo.home.legacy');
});

Route::middleware(['site.locale'])->group(function (): void {
    Route::get('/feed.xml', [TongzhuoContentController::class, 'feed'])->name('tongzhuo.feed');
    Route::get('/sitemap.xml', [TongzhuoContentController::class, 'sitemap'])->name('tongzhuo.sitemap');
    Route::get('/llms.txt', [TongzhuoContentController::class, 'llms'])->name('tongzhuo.llms');
    Route::get('/llms-full.txt', [TongzhuoContentController::class, 'llmsFull'])->name('tongzhuo.llms-full');
});
