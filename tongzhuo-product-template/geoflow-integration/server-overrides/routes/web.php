<?php

/**
 * Web 璺敱锛氬墠鍙颁笌 Blade 绠＄悊鍚庡彴锛堣矾寰勮 config/geoflow.admin_base_path锛岄粯璁?geo_admin锛夈€? */

use App\Http\Controllers\Admin\AdminActivityLogController;
use App\Http\Controllers\Admin\AdminAuthController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\AdminWelcomeController;
use App\Http\Controllers\Admin\AiModelController;
use App\Http\Controllers\Admin\AiPromptController;
use App\Http\Controllers\Admin\AiSpecialPromptController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\ApiTokenController;
use App\Http\Controllers\Admin\ArticleController;
use App\Http\Controllers\Admin\AuthorController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\ContactLeadController;
use App\Http\Controllers\Admin\CustomerProjectController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\GeoGrowthController;
use App\Http\Controllers\Admin\GeoAnswerTestController;
use App\Http\Controllers\Admin\GeoOpportunityController;
use App\Http\Controllers\Admin\GeoPlanController;
use App\Http\Controllers\Admin\DistributionController;
use App\Http\Controllers\Admin\FactBaseController;
use App\Http\Controllers\Admin\ImageLibraryController;
use App\Http\Controllers\Admin\KeywordLibraryController;
use App\Http\Controllers\Admin\KnowledgeBaseController;
use App\Http\Controllers\Admin\LegacyController;
use App\Http\Controllers\Admin\MaterialsController;
use App\Http\Controllers\Admin\PublisherAssistantController;
use App\Http\Controllers\Admin\PublisherDeviceController;
use App\Http\Controllers\Admin\SecuritySettingsController;
use App\Http\Controllers\Admin\SiteSettingsController;
use App\Http\Controllers\Admin\TaskController;
use App\Http\Controllers\Admin\TitleLibraryController;
use App\Http\Controllers\Admin\UrlImportController;
use App\Http\Controllers\Site\ArchiveController;
use App\Http\Controllers\Site\ArticleController as SiteArticleController;
use App\Http\Controllers\Site\CategoryController as SiteCategoryController;
use App\Http\Controllers\Site\HomeController;
use App\Http\Controllers\Site\TongzhuoContentController;
use App\Http\Controllers\Site\TongzhuoFaqController;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

Route::middleware(['site.locale', 'site.view_log'])->group(function (): void {
    Route::get('/', function (SiteTemplateService $cms) {
        $html = $cms->renderStaticPage('index.html');
        abort_if($html === null, 404);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, private',
        ]);
    })->name('site.home');
    Route::get('/issues.html', [TongzhuoFaqController::class, 'index'])->name('tongzhuo.faq.index.legacy');
    Route::get('/{pageFile}', function (string $pageFile, SiteTemplateService $cms) {
        $allowed = ['index.html', 'about.html', 'products.html', 'contact.html', 'cases.html', 'team.html', 'honors.html', 'careers.html'];
        if (! in_array($pageFile, $allowed, true)) {
            abort(404);
        }

        $html = $cms->renderStaticPage($pageFile);
        if ($html === null) {
            abort(404);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, private',
        ]);
    })->where('pageFile', '(index|about|products|contact|cases|team|honors|careers)\.html')->name('tongzhuo.static-page');
    Route::get('/archive', [ArchiveController::class, 'index'])->name('site.archive');
    Route::get('/archive/{year}/{month}', [ArchiveController::class, 'month'])
        ->name('site.archive.month')
        ->where(['year' => '[0-9]{4}', 'month' => '[0-9]{2}']);
    Route::get('/category/{slug}', [SiteCategoryController::class, 'show'])->name('site.category');
    Route::get('/article/{slug}', [SiteArticleController::class, 'show'])->name('site.article');
});

require __DIR__.'/tongzhuo.php';
require __DIR__.'/tongzhuo-cms.php';
require_once __DIR__.'/tongzhuo-access-admin.php';
require_once __DIR__.'/tongzhuo-rag-api.php';

$adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');

Route::prefix($adminPrefix)->name('admin.')->middleware(['admin.locale'])->group(function () {
    // 閫氱敤鍏ュ彛涓庤瑷€鍒囨崲
    Route::get('locale/{locale}', [AdminAuthController::class, 'switchLocale'])->name('locale.switch');

    Route::get('/', function () {
        return Auth::guard('admin')->check()
            ? redirect()->route('admin.dashboard')
            : redirect()->route('admin.login');
    })->name('entry');

    // 璁垮璁よ瘉璺敱
    Route::middleware('guest:admin')->group(function () {
        Route::get('login', [AdminAuthController::class, 'showLoginForm'])->name('login');
        Route::post('login', [AdminAuthController::class, 'login'])->name('login.attempt');
    });

    Route::middleware(['admin.auth', 'admin.rbac', 'admin.activity'])->group(function () {
        Route::post('logout', [AdminAuthController::class, 'logout'])->name('logout');
        Route::post('welcome/dismiss', [AdminWelcomeController::class, 'dismiss'])->name('welcome.dismiss');
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('site-console', [DashboardController::class, 'siteConsole'])->name('site-console');
        Route::get('site-console/pages', [DashboardController::class, 'sitePagesConsole'])->name('site-console.pages');
        Route::get('site-console/pages/{page}', [DashboardController::class, 'editSitePage'])
            ->where('page', '[A-Za-z0-9_-]+')
            ->name('site-console.pages.edit');
        Route::get('site-console/settings', [DashboardController::class, 'siteSettingsConsole'])->name('site-console.settings');
        Route::get('site-console/ai-crawl', [DashboardController::class, 'siteAiConsole'])->name('site-console.ai-crawl');
        Route::post('site-console/site-identity', [DashboardController::class, 'updateSiteIdentity'])->name('site-console.site-identity.update');
        Route::post('site-console/ai-files/refresh', [DashboardController::class, 'refreshAiFiles'])->name('site-console.ai-files.refresh');
        Route::post('site-console/pages/{page}', [DashboardController::class, 'updateSitePage'])->name('site-console.pages.update');
        Route::post('site-console/home-services', [DashboardController::class, 'updateHomeServices'])->name('site-console.home-services.update');
        Route::post('site-console/faqs', [DashboardController::class, 'updateFaqItems'])->name('site-console.faqs.update');
        Route::get('geo-console', [DashboardController::class, 'geoConsole'])->name('geo-console');
        Route::prefix('geo-growth')->name('geo-growth.')->group(function (): void {
            Route::get('/', [GeoGrowthController::class, 'index'])->name('index');
            Route::post('audits', [GeoGrowthController::class, 'auditStore'])->name('audits.store');
            Route::get('audits/{auditId}', [GeoGrowthController::class, 'auditShow'])->whereNumber('auditId')->name('audit');
            Route::post('tasks/{taskId}/status', [GeoGrowthController::class, 'taskStatus'])->whereNumber('taskId')->name('tasks.status');
            Route::post('tasks/{taskId}/promote', [GeoGrowthController::class, 'promoteTask'])->whereNumber('taskId')->name('tasks.promote');
            Route::post('tasks/{taskId}/promote-faq', [GeoGrowthController::class, 'promoteTaskToFaq'])->whereNumber('taskId')->name('tasks.promote-faq');
        });
        Route::prefix('geo-opportunities')->name('geo-opportunities.')->group(function (): void {
            Route::get('/', [GeoOpportunityController::class, 'index'])->name('index');
            Route::post('/', [GeoOpportunityController::class, 'store'])->name('store');
            Route::post('seed-presets', [GeoOpportunityController::class, 'seedPresets'])->name('seed-presets');
            Route::post('{opportunityId}/status', [GeoOpportunityController::class, 'status'])->whereNumber('opportunityId')->name('status');
            Route::post('{opportunityId}/promote', [GeoOpportunityController::class, 'promote'])->whereNumber('opportunityId')->name('promote');
        });
        Route::prefix('geo-plans')->name('geo-plans.')->group(function (): void {
            Route::get('/', [GeoPlanController::class, 'index'])->name('index');
            Route::post('/', [GeoPlanController::class, 'store'])->name('store');
            Route::get('{planId}', [GeoPlanController::class, 'show'])->whereNumber('planId')->name('show');
            Route::post('items/{itemId}/status', [GeoPlanController::class, 'itemStatus'])->whereNumber('itemId')->name('items.status');
        });
        Route::prefix('geo-answer-tests')->name('geo-answer-tests.')->group(function (): void {
            Route::get('/', [GeoAnswerTestController::class, 'index'])->name('index');
            Route::post('/', [GeoAnswerTestController::class, 'store'])->name('store');
            Route::post('{testId}/run', [GeoAnswerTestController::class, 'run'])->whereNumber('testId')->name('run');
            Route::post('{testId}/sample', [GeoAnswerTestController::class, 'sample'])->whereNumber('testId')->name('sample');
            Route::post('{testId}/promote-opportunity', [GeoAnswerTestController::class, 'promoteOpportunity'])->whereNumber('testId')->name('promote-opportunity');
        });
        Route::get('analytics', [AnalyticsController::class, 'index'])->name('analytics');

        Route::prefix('fact-base')->name('fact-base.')->group(function (): void {
            Route::get('/', [FactBaseController::class, 'index'])->name('index');
            Route::post('/', [FactBaseController::class, 'store'])->name('store');
            Route::post('{factId}/status', [FactBaseController::class, 'status'])->whereNumber('factId')->name('status');
            Route::post('{factId}/delete', [FactBaseController::class, 'delete'])->whereNumber('factId')->name('delete');
        });

        Route::prefix('contact-leads')->name('contact-leads.')->group(function () {
            Route::get('/', [ContactLeadController::class, 'index'])->name('index');
            Route::patch('{leadId}', [ContactLeadController::class, 'update'])
                ->whereNumber('leadId')
                ->name('update');
        });

        Route::prefix('customer-projects')->name('customer-projects.')->group(function (): void {
            Route::get('/', [CustomerProjectController::class, 'index'])->name('index');
            Route::post('/', [CustomerProjectController::class, 'store'])->name('store');
            Route::post('current-site', [CustomerProjectController::class, 'createCurrentSiteProject'])->name('current-site');
            Route::get('{projectId}/dossier', [CustomerProjectController::class, 'dossier'])->whereNumber('projectId')->name('dossier');
            Route::get('{projectId}/dossier/export', [CustomerProjectController::class, 'exportDossier'])->whereNumber('projectId')->name('dossier.export');
            Route::get('{projectId}/handoff', [CustomerProjectController::class, 'handoffReport'])->whereNumber('projectId')->name('handoff');
            Route::get('{projectId}', [CustomerProjectController::class, 'show'])->whereNumber('projectId')->name('show');
            Route::put('{projectId}', [CustomerProjectController::class, 'update'])->whereNumber('projectId')->name('update');
        });

        // 浠诲姟绠＄悊锛圔lade 鏂拌矾寰勶級
        Route::prefix('tasks')->name('tasks.')->group(function () {
            Route::get('/', [TaskController::class, 'index'])->name('index');
            Route::post('{taskId}/toggle-status', [TaskController::class, 'toggleStatus'])->name('toggle-status');
            Route::post('{taskId}/delete', [TaskController::class, 'destroyTask'])->name('delete');
            Route::get('create', [TaskController::class, 'create'])->name('create');
            Route::post('create', [TaskController::class, 'store'])->name('store');
            Route::get('{taskId}/edit', [TaskController::class, 'edit'])->name('edit');
            Route::put('{taskId}', [TaskController::class, 'update'])->name('update');
            Route::get('health-check', [TaskController::class, 'healthCheck'])->name('health');
            Route::post('batch/start', [TaskController::class, 'batchAction'])->name('batch');
        });

        Route::prefix('distribution')->name('distribution.')->group(function () {
            Route::get('/', [DistributionController::class, 'index'])->name('index');
            Route::get('create', [DistributionController::class, 'create'])->name('create');
            Route::post('create', [DistributionController::class, 'store'])->name('store');
            Route::get('jobs', [DistributionController::class, 'jobs'])->name('jobs');
            Route::get('jobs/{distributionId}/wechatsync-package', [DistributionController::class, 'downloadWechatSyncPackage'])->name('wechatsync-package')->whereNumber('distributionId');
            Route::get('jobs/{distributionId}/edit', [DistributionController::class, 'editArticle'])->name('article.edit')->whereNumber('distributionId');
            Route::put('jobs/{distributionId}', [DistributionController::class, 'updateArticle'])->name('article.update')->whereNumber('distributionId');
            Route::post('jobs/{distributionId}/delete', [DistributionController::class, 'deleteArticle'])->name('article.delete')->whereNumber('distributionId');
            Route::post('jobs/{distributionId}/publisher-confirm', [DistributionController::class, 'confirmPublisherResult'])->name('publisher.confirm')->whereNumber('distributionId');
            Route::post('jobs/{distributionId}/publisher-fail', [DistributionController::class, 'failPublisherResult'])->name('publisher.fail')->whereNumber('distributionId');
            Route::post('jobs/{distributionId}/retry', [DistributionController::class, 'retry'])->name('retry')->whereNumber('distributionId');
            Route::get('{channelId}/edit', [DistributionController::class, 'edit'])->name('edit')->whereNumber('channelId');
            Route::put('{channelId}', [DistributionController::class, 'update'])->name('update')->whereNumber('channelId');
            Route::post('{channelId}/pause', [DistributionController::class, 'pause'])->name('pause')->whereNumber('channelId');
            Route::post('{channelId}/activate', [DistributionController::class, 'activate'])->name('activate')->whereNumber('channelId');
            Route::post('{channelId}/rotate-secret', [DistributionController::class, 'rotateSecret'])->name('rotate-secret')->whereNumber('channelId');
            Route::post('{channelId}/reveal-secret', [DistributionController::class, 'revealSecret'])->name('reveal-secret')->whereNumber('channelId');
            Route::post('{channelId}/download-package', [DistributionController::class, 'downloadPackage'])->name('download-package')->whereNumber('channelId');
            Route::post('{channelId}/sync-settings', [DistributionController::class, 'syncSettings'])->name('sync-settings')->whereNumber('channelId');
            Route::get('{channelId}', [DistributionController::class, 'show'])->name('show')->whereNumber('channelId');
            Route::post('{channelId}/health', [DistributionController::class, 'health'])->name('health')->whereNumber('channelId');
        });

        Route::prefix('publisher-devices')->name('publisher-devices.')->group(function () {
            Route::get('/', [PublisherDeviceController::class, 'index'])->name('index');
            Route::post('pairings', [PublisherDeviceController::class, 'issuePairingCode'])->name('pairings.store');
            Route::post('pairings/{pairingCode}/revoke', [PublisherDeviceController::class, 'revokePairingCode'])
                ->name('pairings.revoke')
                ->where('pairingCode', '[A-Z0-9]+');
            Route::post('{deviceId}/disable', [PublisherDeviceController::class, 'disable'])->name('disable')->whereNumber('deviceId');
            Route::post('{deviceId}/enable', [PublisherDeviceController::class, 'enable'])->name('enable')->whereNumber('deviceId');
            Route::post('{deviceId}/delete', [PublisherDeviceController::class, 'destroy'])->name('delete')->whereNumber('deviceId');
        });

        Route::get('publisher-assistant', [PublisherAssistantController::class, 'index'])->name('publisher-assistant');
        Route::post('publisher-assistant/bootstrap-channel', [PublisherAssistantController::class, 'bootstrapChannel'])->name('publisher-assistant.bootstrap-channel');
        Route::post('publisher-assistant/enqueue-published', [PublisherAssistantController::class, 'enqueuePublishedArticles'])->name('publisher-assistant.enqueue-published');

        // 鏂囩珷绠＄悊锛圔lade 鏂拌矾寰勶級
        Route::prefix('articles')->name('articles.')->group(function () {
            Route::get('/', [ArticleController::class, 'index'])->name('index');
            Route::post('batch/update-status', [ArticleController::class, 'batchUpdateStatus'])->name('batch.update-status');
            Route::post('batch/update-review', [ArticleController::class, 'batchUpdateReview'])->name('batch.update-review');
            Route::post('batch/delete', [ArticleController::class, 'batchDelete'])->name('batch.delete');
            Route::post('batch/restore', [ArticleController::class, 'batchRestore'])->name('batch.restore');
            Route::post('batch/force-delete', [ArticleController::class, 'batchForceDelete'])->name('batch.force-delete');
            Route::post('trash/empty', [ArticleController::class, 'emptyTrash'])->name('trash.empty');
            Route::get('create', [ArticleController::class, 'create'])->name('create');
            Route::post('create', [ArticleController::class, 'store'])->name('store');
            Route::post('{articleId}/dispatch', [ArticleController::class, 'dispatchToPublisher'])->whereNumber('articleId')->name('dispatch');
            Route::post('{articleId}/restore', [ArticleController::class, 'restore'])->name('restore')->whereNumber('articleId');
            Route::post('{articleId}/force-delete', [ArticleController::class, 'forceDelete'])->name('force-delete')->whereNumber('articleId');
            Route::get('{articleId}/edit', [ArticleController::class, 'edit'])->name('edit');
            Route::put('{articleId}', [ArticleController::class, 'update'])->name('update');
        });

        Route::prefix('categories')->name('categories.')->group(function () {
            Route::get('/', [CategoryController::class, 'index'])->name('index');
            Route::get('create', [CategoryController::class, 'create'])->name('create');
            Route::post('create', [CategoryController::class, 'store'])->name('store');
            Route::get('{categoryId}/edit', [CategoryController::class, 'edit'])->name('edit');
            Route::put('{categoryId}', [CategoryController::class, 'update'])->name('update');
            Route::post('{categoryId}/delete', [CategoryController::class, 'destroy'])->name('delete');
        });

        Route::prefix('authors')->name('authors.')->group(function () {
            Route::get('/', [AuthorController::class, 'index'])->name('index');
            Route::get('create', [AuthorController::class, 'create'])->name('create');
            Route::post('create', [AuthorController::class, 'store'])->name('store');
            Route::get('{authorId}/edit', [AuthorController::class, 'edit'])->name('edit');
            Route::get('{authorId}/detail', [AuthorController::class, 'detail'])->name('detail');
            Route::put('{authorId}', [AuthorController::class, 'update'])->name('update');
            Route::post('{authorId}/delete', [AuthorController::class, 'destroy'])->name('delete');
        });

        Route::prefix('keyword-libraries')->name('keyword-libraries.')->group(function () {
            Route::get('/', [KeywordLibraryController::class, 'index'])->name('index');
            Route::get('create', [KeywordLibraryController::class, 'create'])->name('create');
            Route::post('create', [KeywordLibraryController::class, 'store'])->name('store');
            Route::get('{libraryId}/edit', [KeywordLibraryController::class, 'edit'])->name('edit');
            Route::get('{libraryId}/detail', [KeywordLibraryController::class, 'detail'])->name('detail');
            Route::post('{libraryId}/keywords', [KeywordLibraryController::class, 'storeKeyword'])->name('keywords.store');
            Route::post('{libraryId}/keywords/delete', [KeywordLibraryController::class, 'destroyKeywords'])->name('keywords.delete');
            Route::post('{libraryId}/import', [KeywordLibraryController::class, 'importKeywords'])->name('import');
            Route::put('{libraryId}/detail', [KeywordLibraryController::class, 'updateFromDetail'])->name('detail.update');
            Route::put('{libraryId}', [KeywordLibraryController::class, 'update'])->name('update');
            Route::post('{libraryId}/delete', [KeywordLibraryController::class, 'destroy'])->name('delete');
        });

        // 绱犳潗绠＄悊锛氭爣棰樺簱绠＄悊
        Route::prefix('title-libraries')->name('title-libraries.')->group(function () {
            Route::get('/', [TitleLibraryController::class, 'index'])->name('index');
            Route::get('create', [TitleLibraryController::class, 'create'])->name('create');
            Route::post('create', [TitleLibraryController::class, 'store'])->name('store');
            Route::get('{libraryId}/edit', [TitleLibraryController::class, 'edit'])->name('edit');
            Route::get('{libraryId}/detail', [TitleLibraryController::class, 'detail'])->name('detail');
            Route::post('{libraryId}/titles', [TitleLibraryController::class, 'storeTitle'])->name('titles.store');
            Route::post('{libraryId}/titles/delete', [TitleLibraryController::class, 'destroyTitles'])->name('titles.delete');
            Route::post('{libraryId}/import', [TitleLibraryController::class, 'importTitles'])->name('import');
            Route::get('{libraryId}/ai-generate', [TitleLibraryController::class, 'aiGenerate'])->name('ai-generate');
            Route::post('{libraryId}/ai-generate', [TitleLibraryController::class, 'generateWithAi'])->name('ai-generate.submit');
            Route::put('{libraryId}', [TitleLibraryController::class, 'update'])->name('update');
            Route::post('{libraryId}/delete', [TitleLibraryController::class, 'destroy'])->name('delete');
        });

        // 绱犳潗绠＄悊锛氬浘鐗囧簱绠＄悊
        Route::prefix('image-libraries')->name('image-libraries.')->group(function () {
            Route::get('/', [ImageLibraryController::class, 'index'])->name('index');
            Route::get('create', [ImageLibraryController::class, 'create'])->name('create');
            Route::post('create', [ImageLibraryController::class, 'store'])->name('store');
            Route::get('{libraryId}/edit', [ImageLibraryController::class, 'edit'])->name('edit');
            Route::get('{libraryId}/detail', [ImageLibraryController::class, 'detail'])->name('detail');
            Route::post('{libraryId}/images/upload', [ImageLibraryController::class, 'uploadImages'])->name('images.upload');
            Route::post('{libraryId}/images/delete', [ImageLibraryController::class, 'destroyImages'])->name('images.delete');
            Route::put('{libraryId}/detail', [ImageLibraryController::class, 'updateFromDetail'])->name('detail.update');
            Route::put('{libraryId}', [ImageLibraryController::class, 'update'])->name('update');
            Route::post('{libraryId}/delete', [ImageLibraryController::class, 'destroy'])->name('delete');
        });

        // 绱犳潗绠＄悊锛氱煡璇嗗簱绠＄悊
        Route::prefix('knowledge-bases')->name('knowledge-bases.')->group(function () {
            Route::get('/', [KnowledgeBaseController::class, 'index'])->name('index');
            Route::get('create', [KnowledgeBaseController::class, 'create'])->name('create');
            Route::post('create', [KnowledgeBaseController::class, 'store'])->name('store');
            Route::get('{knowledgeBaseId}/edit', [KnowledgeBaseController::class, 'edit'])->name('edit');
            Route::get('{knowledgeBaseId}/detail', [KnowledgeBaseController::class, 'detail'])->name('detail');
            Route::post('upload', [KnowledgeBaseController::class, 'uploadFile'])->name('upload');
            Route::post('{knowledgeBaseId}/chunks/refresh', [KnowledgeBaseController::class, 'refreshChunks'])->name('chunks.refresh');
            Route::put('{knowledgeBaseId}/detail', [KnowledgeBaseController::class, 'updateFromDetail'])->name('detail.update');
            Route::put('{knowledgeBaseId}', [KnowledgeBaseController::class, 'update'])->name('update');
            Route::post('{knowledgeBaseId}/delete', [KnowledgeBaseController::class, 'destroy'])->name('delete');
        });

        // 涓氬姟椤甸潰
        Route::get('materials', [MaterialsController::class, 'index'])->name('materials.index');
        Route::get('url-import', [UrlImportController::class, 'index'])->name('url-import');
        Route::post('url-import', [UrlImportController::class, 'store'])->name('url-import.store');
        Route::get('url-import/history', [UrlImportController::class, 'history'])->name('url-import.history');
        Route::post('url-import/{jobId}/run', [UrlImportController::class, 'run'])
            ->name('url-import.run')
            ->whereNumber('jobId');
        Route::get('url-import/{jobId}/status', [UrlImportController::class, 'status'])
            ->name('url-import.status')
            ->whereNumber('jobId');
        Route::post('url-import/{jobId}/commit', [UrlImportController::class, 'commit'])
            ->name('url-import.commit')
            ->whereNumber('jobId');
        Route::get('url-import/{jobId}', [UrlImportController::class, 'show'])
            ->name('url-import.show')
            ->whereNumber('jobId');

        // AI 閰嶇疆妯″潡锛堥厤缃櫒 / 妯″瀷 / 鎻愮ず璇嶏級
        Route::group([], function () {
            Route::get('ai-configurator', [LegacyController::class, 'aiConfigurator'])->name('ai.configurator');
            Route::prefix('ai-models')->name('ai-models.')->group(function () {
                Route::get('/', [AiModelController::class, 'index'])->name('index');
                Route::post('create', [AiModelController::class, 'store'])->name('store');
                Route::put('{modelId}', [AiModelController::class, 'update'])->name('update');
                Route::post('{modelId}/test', [AiModelController::class, 'testConnection'])->name('test');
                Route::post('{modelId}/delete', [AiModelController::class, 'destroy'])->name('delete');
                Route::post('default-embedding', [AiModelController::class, 'updateDefaultEmbedding'])->name('default-embedding');
                Route::post('chunking-config', [AiModelController::class, 'updateChunkingConfig'])->name('chunking-config');
            });
            Route::get('ai-prompts', [AiPromptController::class, 'index'])->name('ai-prompts');
            Route::post('ai-prompts/create', [AiPromptController::class, 'store'])->name('ai-prompts.store');
            Route::put('ai-prompts/{promptId}', [AiPromptController::class, 'update'])->name('ai-prompts.update');
            Route::post('ai-prompts/{promptId}/delete', [AiPromptController::class, 'destroy'])->name('ai-prompts.delete');
            Route::get('ai-special-prompts', [AiSpecialPromptController::class, 'index'])->name('ai-special-prompts');
            Route::post('ai-special-prompts/keyword', [AiSpecialPromptController::class, 'updateKeyword'])->name('ai-special-prompts.keyword');
            Route::post('ai-special-prompts/description', [AiSpecialPromptController::class, 'updateDescription'])->name('ai-special-prompts.description');
        });

        Route::prefix('site-settings')->name('site-settings.')->group(function () {
            Route::get('/', [SiteSettingsController::class, 'index'])->name('index');
            Route::post('/', [SiteSettingsController::class, 'update'])->name('update');
            Route::post('theme', [SiteSettingsController::class, 'updateTheme'])->name('theme');
            Route::post('article-detail-ads', [SiteSettingsController::class, 'updateArticleDetailAds'])->name('ads');
            Route::get('sensitive-words', [SecuritySettingsController::class, 'index'])->name('sensitive-words');
            Route::post('sensitive-words', [SecuritySettingsController::class, 'storeSensitiveWords'])->name('sensitive-words.store');
            Route::post('sensitive-words/{wordId}/delete', [SecuritySettingsController::class, 'destroySensitiveWord'])
                ->name('sensitive-words.delete')
                ->whereNumber('wordId');
        });
        Route::prefix('security-settings')->name('security-settings.')->group(function () {
            Route::get('/', fn () => redirect()->route('admin.site-settings.sensitive-words'))->name('index');
            Route::post('sensitive-words', [SecuritySettingsController::class, 'storeSensitiveWords'])->name('words.store');
            Route::post('sensitive-words/{wordId}/delete', [SecuritySettingsController::class, 'destroySensitiveWord'])->name('words.delete');
            Route::post('password', [SecuritySettingsController::class, 'updatePassword'])->name('password.update');
        });

        Route::middleware('admin.super')->group(function () {
            Route::prefix('admin-users')->name('admin-users.')->group(function () {
                Route::get('/', [AdminUserController::class, 'index'])->name('index');
                Route::post('create', [AdminUserController::class, 'store'])->name('store');
                Route::post('{adminId}/update', [AdminUserController::class, 'update'])->name('update');
                Route::post('{adminId}/toggle-status', [AdminUserController::class, 'toggleStatus'])->name('toggle-status');
                Route::post('{adminId}/delete', [AdminUserController::class, 'destroy'])->name('delete');
            });
            Route::get('admin-activity-logs', [AdminActivityLogController::class, 'index'])->name('admin-activity-logs');
            Route::prefix('api-tokens')->name('api-tokens.')->group(function () {
                Route::get('/', [ApiTokenController::class, 'index'])->name('index');
                Route::post('/', [ApiTokenController::class, 'store'])->name('store');
                Route::post('{tokenId}/revoke', [ApiTokenController::class, 'revoke'])->name('revoke');
            });
        });
    });
});
