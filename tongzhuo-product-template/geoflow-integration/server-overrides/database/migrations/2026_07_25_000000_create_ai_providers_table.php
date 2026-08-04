<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AI credentials are stored in a separate table so an installation can be
     * upgraded independently from the upstream GEOFlow ai_models table.
     * `api_key` is encrypted by the AiProvider model's encrypted cast.
     */
    public function up(): void
    {
        if (! Schema::hasTable('ai_providers')) {
            Schema::create('ai_providers', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                $table->string('provider', 80)->default('openai-compatible')->index();
                $table->string('model_id', 180);
                $table->string('model_type', 30)->default('chat')->index();
                $table->text('base_url')->nullable();
                $table->text('chat_url')->nullable();
                $table->text('embeddings_url')->nullable();
                $table->text('api_key')->nullable();
                $table->string('api_key_fingerprint', 64)->nullable()->index();
                $table->string('status', 30)->default('active')->index();
                $table->boolean('is_default')->default(false)->index();
                $table->unsignedInteger('daily_limit')->nullable();
                $table->unsignedInteger('used_today')->default(0);
                $table->unsignedBigInteger('total_used')->default(0);
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('last_tested_at')->nullable();
                $table->string('last_error_code', 60)->nullable();
                $table->text('last_error_message')->nullable();
                $table->json('metadata')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();

                $table->index(['model_type', 'status', 'is_default']);
            });
        }

        if (! Schema::hasTable('ai_generation_runs')) {
            Schema::create('ai_generation_runs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('provider_id')->nullable()->constrained('ai_providers')->nullOnDelete();
                $table->string('kind', 40)->default('article');
                $table->string('status', 30)->default('succeeded')->index();
                $table->json('prompt_snapshot')->nullable();
                $table->json('output_contract_snapshot')->nullable();
                $table->json('response_snapshot')->nullable();
                $table->json('usage')->nullable();
                $table->string('error_code', 60)->nullable();
                $table->text('error_message')->nullable();
                $table->string('request_id', 120)->nullable()->index();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_generation_runs');
        Schema::dropIfExists('ai_providers');
    }
};
