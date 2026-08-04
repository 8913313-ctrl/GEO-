<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_answer_tests')) {
            Schema::create('tongzhuo_geo_answer_tests', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('opportunity_id')->nullable()->constrained('tongzhuo_geo_opportunities')->nullOnDelete();
                $table->string('service_line', 40)->default('geo')->index();
                $table->string('status', 30)->default('draft')->index();
                $table->string('verdict', 30)->default('unknown')->index();
                $table->string('source', 40)->default('local')->index();
                $table->string('question', 260);
                $table->text('expected_answer')->nullable();
                $table->text('observed_answer')->nullable();
                $table->text('gap_summary')->nullable();
                $table->json('evidence_sources')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('last_run_at')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_geo_answer_tests');
    }
};
