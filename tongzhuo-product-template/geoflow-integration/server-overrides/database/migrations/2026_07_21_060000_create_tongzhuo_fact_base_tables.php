<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_fact_cards')) {
            Schema::create('tongzhuo_fact_cards', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->constrained('tongzhuo_cms_sites')->cascadeOnDelete();
                $table->string('fact_type', 40)->default('service')->index();
                $table->string('status', 30)->default('confirmed')->index();
                $table->string('confidence_level', 30)->default('medium')->index();
                $table->string('title', 180);
                $table->text('fact_text');
                $table->string('source_title', 180)->nullable();
                $table->string('source_url', 500)->nullable();
                $table->date('source_updated_at')->nullable();
                $table->json('service_lines')->nullable();
                $table->json('usage_targets')->nullable();
                $table->json('forbidden_phrases')->nullable();
                $table->json('metadata')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('tongzhuo_geo_opportunities')) {
            Schema::table('tongzhuo_geo_opportunities', function (Blueprint $table): void {
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'cluster_name')) {
                    $table->string('cluster_name', 120)->nullable()->after('keyword')->index();
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'parent_question')) {
                    $table->string('parent_question', 240)->nullable()->after('question');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'follow_up_questions')) {
                    $table->json('follow_up_questions')->nullable()->after('parent_question');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'query_rewrites')) {
                    $table->json('query_rewrites')->nullable()->after('follow_up_questions');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'evidence_query')) {
                    $table->string('evidence_query', 240)->nullable()->after('query_rewrites');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'mapped_assets')) {
                    $table->json('mapped_assets')->nullable()->after('evidence_query');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'competitor_notes')) {
                    $table->json('competitor_notes')->nullable()->after('mapped_assets');
                }
                if (! Schema::hasColumn('tongzhuo_geo_opportunities', 'coverage_status')) {
                    $table->string('coverage_status', 30)->default('unknown')->after('competitor_notes')->index();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tongzhuo_geo_opportunities')) {
            Schema::table('tongzhuo_geo_opportunities', function (Blueprint $table): void {
                foreach ([
                    'cluster_name',
                    'parent_question',
                    'follow_up_questions',
                    'query_rewrites',
                    'evidence_query',
                    'mapped_assets',
                    'competitor_notes',
                    'coverage_status',
                ] as $column) {
                    if (Schema::hasColumn('tongzhuo_geo_opportunities', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        Schema::dropIfExists('tongzhuo_fact_cards');
    }
};
