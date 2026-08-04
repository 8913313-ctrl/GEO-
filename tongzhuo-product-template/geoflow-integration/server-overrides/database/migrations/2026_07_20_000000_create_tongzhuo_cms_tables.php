<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_cms_sites')) {
            Schema::create('tongzhuo_cms_sites', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                $table->string('brand_name', 80)->nullable();
                $table->string('domain', 160)->nullable()->index();
                $table->string('template_key', 80)->default('tongzhuo-corporate');
                $table->string('status', 40)->default('active')->index();
                $table->json('settings')->nullable();
                $table->json('seo_defaults')->nullable();
                $table->json('ai_crawl_settings')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_cms_pages')) {
            Schema::create('tongzhuo_cms_pages', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->string('slug', 120);
                $table->string('path', 160);
                $table->string('title', 160);
                $table->string('navigation_label', 80)->nullable();
                $table->text('description')->nullable();
                $table->string('template_key', 80)->default('standard-page');
                $table->string('status', 40)->default('draft')->index();
                $table->unsignedInteger('sort_order')->default(0);
                $table->json('seo')->nullable();
                $table->json('structured_data')->nullable();
                $table->timestamp('published_at')->nullable()->index();
                $table->timestamps();
                $table->unique(['site_id', 'slug']);
                $table->unique(['site_id', 'path']);
            });
        }

        if (! Schema::hasTable('tongzhuo_cms_page_blocks')) {
            Schema::create('tongzhuo_cms_page_blocks', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('page_id')->constrained('tongzhuo_cms_pages')->cascadeOnDelete();
                $table->string('block_key', 120);
                $table->string('type', 80);
                $table->string('label', 120)->nullable();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->boolean('is_visible')->default(true)->index();
                $table->json('content')->nullable();
                $table->json('settings')->nullable();
                $table->timestamps();
                $table->unique(['page_id', 'block_key']);
            });
        }

        if (! Schema::hasTable('tongzhuo_cms_page_versions')) {
            Schema::create('tongzhuo_cms_page_versions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('page_id')->constrained('tongzhuo_cms_pages')->cascadeOnDelete();
                $table->unsignedInteger('version_number');
                $table->string('title', 160);
                $table->string('status', 40)->default('snapshot')->index();
                $table->json('page_snapshot');
                $table->json('blocks_snapshot');
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
                $table->unique(['page_id', 'version_number']);
            });
        }

        if (! Schema::hasTable('tongzhuo_cms_navigation_items')) {
            Schema::create('tongzhuo_cms_navigation_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('page_id')->nullable()->constrained('tongzhuo_cms_pages')->nullOnDelete();
                $table->string('area', 40)->default('header')->index();
                $table->string('label', 80);
                $table->string('url', 180);
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->boolean('is_visible')->default(true)->index();
                $table->json('settings')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_cms_media_assets')) {
            Schema::create('tongzhuo_cms_media_assets', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->string('disk', 40)->default('public');
                $table->string('path', 240);
                $table->string('url', 240)->nullable();
                $table->string('type', 60)->default('image')->index();
                $table->string('mime_type', 120)->nullable();
                $table->string('title', 160)->nullable();
                $table->text('alt_text')->nullable();
                $table->unsignedBigInteger('size')->default(0);
                $table->json('meta')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
                $table->unique(['site_id', 'path']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_cms_media_assets');
        Schema::dropIfExists('tongzhuo_cms_navigation_items');
        Schema::dropIfExists('tongzhuo_cms_page_versions');
        Schema::dropIfExists('tongzhuo_cms_page_blocks');
        Schema::dropIfExists('tongzhuo_cms_pages');
        Schema::dropIfExists('tongzhuo_cms_sites');
    }
};
