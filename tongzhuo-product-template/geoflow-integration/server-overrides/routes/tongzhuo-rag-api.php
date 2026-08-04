<?php

use App\Http\Controllers\Api\Internal\KnowledgeDocumentController;
use App\Http\Controllers\Api\Internal\RagController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/internal/v1')
    ->name('tongzhuo.internal-api.')
    ->middleware(['admin.auth', 'admin.activity'])
    ->group(function (): void {
        Route::get('knowledge-documents', [KnowledgeDocumentController::class, 'index'])
            ->middleware('admin.permission:knowledge.read')
            ->name('knowledge-documents.index');
        Route::post('knowledge-documents', [KnowledgeDocumentController::class, 'store'])
            ->middleware('admin.permission:knowledge.write')
            ->name('knowledge-documents.store');
        Route::get('knowledge-documents/{documentId}', [KnowledgeDocumentController::class, 'show'])
            ->middleware('admin.permission:knowledge.read')
            ->whereNumber('documentId')
            ->name('knowledge-documents.show');
        Route::put('knowledge-documents/{documentId}', [KnowledgeDocumentController::class, 'update'])
            ->middleware('admin.permission:knowledge.write')
            ->whereNumber('documentId')
            ->name('knowledge-documents.update');
        Route::delete('knowledge-documents/{documentId}', [KnowledgeDocumentController::class, 'archive'])
            ->middleware('admin.permission:knowledge.manage')
            ->whereNumber('documentId')
            ->name('knowledge-documents.archive');
        Route::post('knowledge-documents/{documentId}/index', [KnowledgeDocumentController::class, 'indexDocument'])
            ->middleware('admin.permission:knowledge.write')
            ->whereNumber('documentId')
            ->name('knowledge-documents.index-document');

        Route::post('rag/search', [RagController::class, 'search'])
            ->middleware('admin.permission:knowledge.read')
            ->name('rag.search');
        Route::post('rag/generate-article', [RagController::class, 'generateArticle'])
            ->middleware('admin.permission:content.generate')
            ->name('rag.generate-article');
    });
