<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_knowledge_documents')) {
            Schema::create('tongzhuo_knowledge_documents', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('site_id')->nullable()->index();
                $table->unsignedBigInteger('business_line_id')->nullable()->index();
                $table->string('title', 240);
                $table->text('description')->nullable();
                $table->string('source_type', 32)->default('manual')->index();
                $table->string('source_format', 32)->default('text')->index();
                $table->string('source_url', 1000)->nullable();
                $table->string('source_path', 1000)->nullable();
                $table->string('mime_type', 160)->nullable();
                $table->longText('content');
                $table->string('content_hash', 64)->index();
                $table->unsignedInteger('version')->default(1);
                $table->string('language', 20)->default('zh-CN');
                $table->string('visibility', 24)->default('internal')->index();
                $table->string('review_status', 24)->default('confirmed')->index();
                $table->string('status', 24)->default('draft')->index();
                $table->unsignedBigInteger('reviewed_by_admin_id')->nullable()->index();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamp('indexed_at')->nullable()->index();
                $table->text('index_error')->nullable();
                $table->json('metadata')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();

                $table->foreign('business_line_id', 'tz_knowledge_documents_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_knowledge_chunks')) {
            Schema::create('tongzhuo_knowledge_chunks', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('document_id')->index();
                $table->unsignedInteger('document_version');
                $table->unsignedInteger('ordinal');
                $table->string('heading', 300)->nullable();
                $table->longText('content');
                $table->string('content_hash', 64)->index();
                $table->unsignedInteger('character_count')->default(0);
                $table->unsignedInteger('token_count')->nullable();
                $table->string('locator', 300)->nullable();
                $table->unsignedBigInteger('embedding_provider_id')->nullable()->index();
                $table->string('embedding_model', 180)->nullable()->index();
                $table->unsignedInteger('embedding_dimensions')->nullable();
                $table->json('embedding_json')->nullable();
                $table->timestamp('embedded_at')->nullable()->index();
                $table->string('status', 24)->default('pending')->index();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->foreign('document_id', 'tz_knowledge_chunks_document_fk')
                    ->references('id')->on('tongzhuo_knowledge_documents')->cascadeOnDelete();
                $table->foreign('embedding_provider_id', 'tz_knowledge_chunks_provider_fk')
                    ->references('id')->on('ai_providers')->nullOnDelete();
                $table->unique(['document_id', 'document_version', 'ordinal'], 'tz_knowledge_chunk_version_ordinal_unique');
            });
        }

        if (! Schema::hasTable('tongzhuo_rag_runs')) {
            Schema::create('tongzhuo_rag_runs', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->nullable()->index();
                $table->unsignedBigInteger('embedding_provider_id')->nullable()->index();
                $table->text('query');
                $table->string('retrieval_mode', 40)->index();
                $table->unsignedSmallInteger('top_k')->default(6);
                $table->json('filters')->nullable();
                $table->json('result_snapshot')->nullable();
                $table->unsignedInteger('latency_ms')->default(0);
                $table->string('request_id', 120)->nullable()->index();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();

                $table->foreign('business_line_id', 'tz_rag_runs_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->nullOnDelete();
                $table->foreign('embedding_provider_id', 'tz_rag_runs_provider_fk')
                    ->references('id')->on('ai_providers')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_rag_citations')) {
            Schema::create('tongzhuo_rag_citations', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('rag_run_id')->index();
                $table->unsignedBigInteger('document_id')->index();
                $table->unsignedBigInteger('chunk_id')->index();
                $table->string('citation_key', 32);
                $table->decimal('score', 8, 6)->default(0);
                $table->decimal('vector_score', 8, 6)->nullable();
                $table->decimal('keyword_score', 8, 6)->default(0);
                $table->text('excerpt');
                $table->string('locator', 300)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->foreign('rag_run_id', 'tz_rag_citations_run_fk')
                    ->references('id')->on('tongzhuo_rag_runs')->cascadeOnDelete();
                $table->foreign('document_id', 'tz_rag_citations_document_fk')
                    ->references('id')->on('tongzhuo_knowledge_documents')->cascadeOnDelete();
                $table->foreign('chunk_id', 'tz_rag_citations_chunk_fk')
                    ->references('id')->on('tongzhuo_knowledge_chunks')->cascadeOnDelete();
                $table->unique(['rag_run_id', 'citation_key'], 'tz_rag_run_citation_key_unique');
            });
        }

        $this->enablePgvectorWhenAvailable();
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_rag_citations');
        Schema::dropIfExists('tongzhuo_rag_runs');
        Schema::dropIfExists('tongzhuo_knowledge_chunks');
        Schema::dropIfExists('tongzhuo_knowledge_documents');
    }

    private function enablePgvectorWhenAvailable(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! (bool) config('geoflow.rag.pgvector', true)) {
            return;
        }

        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
            DB::statement('ALTER TABLE tongzhuo_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector');
        } catch (\Throwable) {
            // JSON embeddings remain a functional fallback when the database
            // user cannot install pgvector. Readiness checks report the mode.
        }
    }
};
