<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_plans')) {
            Schema::create('tongzhuo_geo_plans', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('audit_id')->nullable()->constrained('tongzhuo_geo_audits')->nullOnDelete();
                $table->string('title', 180);
                $table->string('status', 30)->default('draft')->index();
                $table->string('source', 40)->default('local')->index();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->text('summary')->nullable();
                $table->json('metrics')->nullable();
                $table->json('metadata')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_geo_plan_items')) {
            Schema::create('tongzhuo_geo_plan_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('plan_id')->constrained('tongzhuo_geo_plans')->cascadeOnDelete();
                $table->foreignId('task_id')->nullable()->constrained('tongzhuo_geo_tasks')->nullOnDelete();
                $table->foreignId('opportunity_id')->nullable()->constrained('tongzhuo_geo_opportunities')->nullOnDelete();
                $table->string('phase', 30)->index();
                $table->string('workstream', 40)->default('content')->index();
                $table->string('status', 30)->default('todo')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->string('title', 180);
                $table->text('description')->nullable();
                $table->string('expected_output', 120)->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->json('evidence')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_geo_plan_items');
        Schema::dropIfExists('tongzhuo_geo_plans');
    }
};
