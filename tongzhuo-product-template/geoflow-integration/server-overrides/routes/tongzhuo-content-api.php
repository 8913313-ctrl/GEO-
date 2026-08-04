<?php

use App\Http\Controllers\Api\V1\ContentWorkflowController;
use App\Http\Controllers\Api\V1\ContentAiDiscoveryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Tongzhuo content workflow API
|--------------------------------------------------------------------------
|
| The override bootstrap loads this file after the host routes/api.php.  It is
| intentionally separate from publisher-assistant.php so either module can be
| upgraded independently.
|
*/
Route::prefix('v1/content')
    ->name('api.v1.content.')
    ->middleware(['throttle:120,1', 'api.request_id', 'access.auth', 'access.audit'])
    ->group(function (): void {
        Route::middleware('access.scope:content.read')->group(function (): void {
            Route::get('business-lines', [ContentWorkflowController::class, 'businessLines'])->name('business-lines.index');
            Route::get('business-lines/{businessLine}/keyword-packs', [ContentWorkflowController::class, 'keywordPacks'])->whereNumber('businessLine')->name('keyword-packs.index');
            Route::get('business-lines/{businessLine}/keywords', [ContentWorkflowController::class, 'keywords'])->whereNumber('businessLine')->name('keywords.index');
            Route::get('business-lines/{businessLine}/questions', [ContentWorkflowController::class, 'questions'])->whereNumber('businessLine')->name('questions.index');
            Route::get('business-lines/{businessLine}/topics', [ContentWorkflowController::class, 'topics'])->whereNumber('businessLine')->name('topics.index');
            Route::get('business-lines/{businessLine}/plans', [ContentWorkflowController::class, 'plans'])->whereNumber('businessLine')->name('plans.index');
            Route::get('plans/{plan}', [ContentWorkflowController::class, 'showPlan'])->whereNumber('plan')->name('plans.show');
            Route::get('writing-agents', [ContentWorkflowController::class, 'agents'])->name('writing-agents.index');
            Route::get('generation-runs/{run}', [ContentWorkflowController::class, 'showGenerationRun'])->whereNumber('run')->name('generation-runs.show');
            Route::get('articles/{article}/citations', [ContentWorkflowController::class, 'articleCitations'])->whereNumber('article')->name('articles.citations.index');
            Route::get('articles/{article}/versions', [ContentWorkflowController::class, 'articleVersions'])->whereNumber('article')->name('articles.versions.index');
        });

        Route::middleware('access.scope:content.write')->group(function (): void {
            Route::post('business-lines', [ContentWorkflowController::class, 'storeBusinessLine'])->name('business-lines.store');
            Route::patch('business-lines/{businessLine}', [ContentWorkflowController::class, 'updateBusinessLine'])->whereNumber('businessLine')->name('business-lines.update');
            Route::delete('business-lines/{businessLine}', [ContentWorkflowController::class, 'archiveBusinessLine'])->whereNumber('businessLine')->name('business-lines.archive');

            Route::post('business-lines/{businessLine}/keyword-packs', [ContentWorkflowController::class, 'storeKeywordPack'])->whereNumber('businessLine')->name('keyword-packs.store');
            Route::patch('keyword-packs/{pack}', [ContentWorkflowController::class, 'updateKeywordPack'])->whereNumber('pack')->name('keyword-packs.update');
            Route::delete('keyword-packs/{pack}', [ContentWorkflowController::class, 'archiveKeywordPack'])->whereNumber('pack')->name('keyword-packs.archive');
            Route::post('business-lines/{businessLine}/keywords', [ContentWorkflowController::class, 'storeKeyword'])->whereNumber('businessLine')->name('keywords.store');
            Route::patch('keywords/{keyword}', [ContentWorkflowController::class, 'updateKeyword'])->whereNumber('keyword')->name('keywords.update');
            Route::post('keywords/{keyword}/promote-to-question', [ContentWorkflowController::class, 'promoteKeywordToQuestion'])->whereNumber('keyword')->name('keywords.promote-to-question');
            Route::delete('keywords/{keyword}', [ContentWorkflowController::class, 'archiveKeyword'])->whereNumber('keyword')->name('keywords.archive');

            Route::post('business-lines/{businessLine}/questions', [ContentWorkflowController::class, 'storeQuestion'])->whereNumber('businessLine')->name('questions.store');
            Route::patch('questions/{question}', [ContentWorkflowController::class, 'updateQuestion'])->whereNumber('question')->name('questions.update');
            Route::post('questions/{question}/promote-to-topic', [ContentWorkflowController::class, 'promoteQuestionToTopic'])->whereNumber('question')->name('questions.promote-to-topic');
            Route::delete('questions/{question}', [ContentWorkflowController::class, 'archiveQuestion'])->whereNumber('question')->name('questions.archive');

            Route::post('business-lines/{businessLine}/topics', [ContentWorkflowController::class, 'storeTopic'])->whereNumber('businessLine')->name('topics.store');
            Route::patch('topics/{topic}', [ContentWorkflowController::class, 'updateTopic'])->whereNumber('topic')->name('topics.update');
            Route::delete('topics/{topic}', [ContentWorkflowController::class, 'archiveTopic'])->whereNumber('topic')->name('topics.archive');
            Route::post('topics/{topic}/promote-to-plan', [ContentWorkflowController::class, 'promoteTopicToPlan'])->whereNumber('topic')->name('topics.promote-to-plan');

            Route::post('business-lines/{businessLine}/plans', [ContentWorkflowController::class, 'storePlan'])->whereNumber('businessLine')->name('plans.store');
            Route::patch('plans/{plan}', [ContentWorkflowController::class, 'updatePlan'])->whereNumber('plan')->name('plans.update');
            Route::post('plans/{plan}/items', [ContentWorkflowController::class, 'storePlanItem'])->whereNumber('plan')->name('plan-items.store');
            Route::patch('plan-items/{item}', [ContentWorkflowController::class, 'updatePlanItem'])->whereNumber('item')->name('plan-items.update');
            Route::post('plan-items/{item}/status', [ContentWorkflowController::class, 'updatePlanItemStatus'])->whereNumber('item')->name('plan-items.status');

            Route::post('writing-agents', [ContentWorkflowController::class, 'storeAgent'])->name('writing-agents.store');
            Route::patch('writing-agents/{agent}', [ContentWorkflowController::class, 'updateAgent'])->whereNumber('agent')->name('writing-agents.update');

            Route::post('articles/{article}/citations', [ContentWorkflowController::class, 'storeArticleCitation'])->whereNumber('article')->name('articles.citations.store');
            Route::post('articles/{article}/versions', [ContentWorkflowController::class, 'storeArticleVersion'])->whereNumber('article')->name('articles.versions.store');
        });

        Route::middleware('access.scope:content.generate')->group(function (): void {
            Route::post('generation-runs', [ContentWorkflowController::class, 'createGenerationRun'])->name('generation-runs.store');
            Route::patch('generation-runs/{run}', [ContentWorkflowController::class, 'updateGenerationRun'])->whereNumber('run')->name('generation-runs.update');

            // Model-backed discovery. Generated records are persisted as
            // `candidate` and only become active after an operator confirms
            // them; this keeps the keyword -> question -> topic workflow
            // auditable and prevents unreviewed AI output from entering a
            // publishing plan.
            Route::post('ai/question-candidates', [ContentAiDiscoveryController::class, 'questionCandidates'])->name('ai.questions.generate');
            Route::post('ai/topic-candidates', [ContentAiDiscoveryController::class, 'topicCandidates'])->name('ai.topics.generate');
        });

        // Confirmation changes library state and archives the source record;
        // it therefore needs write scope in addition to generation scope.
        Route::middleware('access.scope:content.write')->group(function (): void {
            Route::post('ai/question-candidates/confirm', [ContentAiDiscoveryController::class, 'confirmQuestionCandidates'])->name('ai.questions.confirm');
            Route::post('ai/topic-candidates/confirm', [ContentAiDiscoveryController::class, 'confirmTopicCandidates'])->name('ai.topics.confirm');
        });
    });
