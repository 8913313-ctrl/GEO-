<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_audits')) {
            Schema::create('tongzhuo_geo_audits', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->string('url', 500);
                $table->string('status', 30)->default('pending')->index();
                $table->unsignedSmallInteger('score')->nullable();
                $table->json('summary')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_geo_findings')) {
            Schema::create('tongzhuo_geo_findings', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('audit_id')->constrained('tongzhuo_geo_audits')->cascadeOnDelete();
                $table->string('key', 80);
                $table->string('area', 40)->index();
                $table->string('severity', 20)->index();
                $table->string('status', 20)->default('open')->index();
                $table->string('title', 180);
                $table->text('description')->nullable();
                $table->text('suggestion')->nullable();
                $table->json('evidence')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_geo_tasks')) {
            Schema::create('tongzhuo_geo_tasks', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('audit_id')->nullable()->constrained('tongzhuo_geo_audits')->nullOnDelete();
                $table->foreignId('finding_id')->nullable()->constrained('tongzhuo_geo_findings')->nullOnDelete();
                $table->string('type', 40)->default('geo_fix')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->string('status', 30)->default('todo')->index();
                $table->string('title', 180);
                $table->text('description')->nullable();
                $table->json('content_brief')->nullable();
                $table->timestamp('due_at')->nullable();
                $table->foreignId('assigned_to_admin_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_geo_tasks');
        Schema::dropIfExists('tongzhuo_geo_findings');
        Schema::dropIfExists('tongzhuo_geo_audits');
    }
};
