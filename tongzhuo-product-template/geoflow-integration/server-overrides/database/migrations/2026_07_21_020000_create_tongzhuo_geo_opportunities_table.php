<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_opportunities')) {
            Schema::create('tongzhuo_geo_opportunities', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('audit_id')->nullable()->constrained('tongzhuo_geo_audits')->nullOnDelete();
                $table->foreignId('task_id')->nullable()->constrained('tongzhuo_geo_tasks')->nullOnDelete();
                $table->string('service_line', 40)->default('geo')->index();
                $table->string('intent', 40)->default('question')->index();
                $table->string('status', 30)->default('new')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->string('keyword', 120)->nullable();
                $table->string('question', 240);
                $table->string('recommended_output', 40)->default('article')->index();
                $table->text('answer_angle')->nullable();
                $table->json('evidence')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('promoted_at')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_geo_opportunities');
    }
};
