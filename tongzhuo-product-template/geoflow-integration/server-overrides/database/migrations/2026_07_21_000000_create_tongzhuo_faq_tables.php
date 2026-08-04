<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_faq_categories')) {
            Schema::create('tongzhuo_faq_categories', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->string('name', 80);
                $table->string('slug', 120);
                $table->string('description', 240)->nullable();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->boolean('is_visible')->default(true)->index();
                $table->timestamps();
                $table->unique(['site_id', 'slug']);
            });
        }

        if (! Schema::hasTable('tongzhuo_faq_items')) {
            Schema::create('tongzhuo_faq_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->foreignId('category_id')->constrained('tongzhuo_faq_categories')->cascadeOnDelete();
                $table->string('question', 220);
                $table->string('slug', 140);
                $table->text('answer');
                $table->string('excerpt', 300)->nullable();
                $table->json('seo')->nullable();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->string('status', 30)->default('draft')->index();
                $table->timestamp('published_at')->nullable()->index();
                $table->timestamps();
                $table->unique(['category_id', 'slug']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_faq_items');
        Schema::dropIfExists('tongzhuo_faq_categories');
    }
};
