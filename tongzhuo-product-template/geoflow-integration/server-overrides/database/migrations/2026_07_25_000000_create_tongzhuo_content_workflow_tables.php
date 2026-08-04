<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Private-deployment content workflow.
 *
 * The workflow is deliberately kept in tongzhuo_content_* tables.  GEOFlow
 * installations have different Article/KnowledgeBase schemas, so those
 * records are referenced by nullable IDs and snapshots instead of foreign
 * keys.  This lets an installation upgrade the content workflow without
 * altering the existing publishing/CMS tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_content_business_lines')) {
            Schema::create('tongzhuo_content_business_lines', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('site_id')->nullable()->index();
                $table->string('name', 120);
                $table->string('slug', 140);
                $table->text('description')->nullable();
                $table->string('status', 24)->default('active')->index();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->json('settings')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->unique('slug');
            });
        }

        if (! Schema::hasTable('tongzhuo_content_keyword_packs')) {
            Schema::create('tongzhuo_content_keyword_packs', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->index();
                $table->string('name', 160);
                $table->string('source', 32)->default('manual')->index();
                $table->string('status', 24)->default('active')->index();
                $table->text('description')->nullable();
                $table->json('metadata')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('business_line_id', 'tz_content_keyword_packs_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_managed_keywords')) {
            Schema::create('tongzhuo_content_managed_keywords', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->index();
                $table->unsignedBigInteger('keyword_pack_id')->nullable()->index();
                $table->string('keyword', 240);
                $table->string('normalized_keyword', 240);
                $table->string('status', 24)->default('active')->index();
                $table->string('intent', 40)->default('question')->index();
                $table->string('cluster_name', 120)->nullable()->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->unsignedSmallInteger('score')->nullable();
                $table->json('dimensions')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('archived_at')->nullable()->index();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('business_line_id', 'tz_content_keywords_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->cascadeOnDelete();
                $table->foreign('keyword_pack_id', 'tz_content_keywords_pack_fk')
                    ->references('id')->on('tongzhuo_content_keyword_packs')->nullOnDelete();
                $table->unique(['keyword_pack_id', 'normalized_keyword'], 'tz_content_keyword_pack_value_unique');
            });
        }

        if (! Schema::hasTable('tongzhuo_content_question_library')) {
            Schema::create('tongzhuo_content_question_library', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->index();
                $table->unsignedBigInteger('managed_keyword_id')->nullable()->index();
                $table->text('question');
                $table->string('intent', 40)->default('question')->index();
                $table->string('decision_stage', 32)->default('discovery')->index();
                $table->string('cluster_name', 120)->nullable()->index();
                $table->json('follow_up_questions')->nullable();
                $table->json('query_rewrites')->nullable();
                $table->json('evidence_requirements')->nullable();
                $table->json('target_content_types')->nullable();
                $table->string('status', 24)->default('active')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->string('coverage_status', 24)->default('uncovered')->index();
                $table->string('source', 32)->default('keyword')->index();
                $table->json('metadata')->nullable();
                $table->timestamp('archived_at')->nullable()->index();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('business_line_id', 'tz_content_questions_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->cascadeOnDelete();
                $table->foreign('managed_keyword_id', 'tz_content_questions_keyword_fk')
                    ->references('id')->on('tongzhuo_content_managed_keywords')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_topic_candidates')) {
            Schema::create('tongzhuo_content_topic_candidates', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->index();
                $table->unsignedBigInteger('question_library_item_id')->nullable()->index();
                $table->string('title', 240);
                $table->text('primary_question')->nullable();
                $table->string('intent', 40)->default('question')->index();
                $table->string('decision_stage', 32)->default('discovery')->index();
                $table->string('cluster_name', 120)->nullable()->index();
                $table->json('follow_up_questions')->nullable();
                $table->json('query_rewrites')->nullable();
                $table->json('proof_points')->nullable();
                $table->json('evidence_types')->nullable();
                $table->json('target_content_types')->nullable();
                $table->text('audience_boundary')->nullable();
                $table->string('target_site_section', 120)->nullable();
                $table->string('output_type', 32)->default('article')->index();
                $table->string('status', 24)->default('active')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->string('coverage_status', 24)->default('uncovered')->index();
                $table->json('brief')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('archived_at')->nullable()->index();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('business_line_id', 'tz_content_topics_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->cascadeOnDelete();
                $table->foreign('question_library_item_id', 'tz_content_topics_question_fk')
                    ->references('id')->on('tongzhuo_content_question_library')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_plans')) {
            Schema::create('tongzhuo_content_plans', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('business_line_id')->index();
                $table->string('title', 180);
                $table->string('status', 24)->default('draft')->index();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('cadence', 40)->nullable();
                $table->text('summary')->nullable();
                $table->json('settings')->nullable();
                $table->json('metadata')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('business_line_id', 'tz_content_plans_line_fk')
                    ->references('id')->on('tongzhuo_content_business_lines')->cascadeOnDelete();
            });
        }

        // The agent table is created before plan items because plan items keep
        // an optional foreign key to the selected writing agent.
        if (! Schema::hasTable('tongzhuo_content_writing_agents')) {
            Schema::create('tongzhuo_content_writing_agents', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                $table->string('slug', 140)->unique();
                $table->text('description')->nullable();
                $table->longText('system_prompt');
                $table->json('output_contract')->nullable();
                $table->string('style', 60)->nullable();
                $table->boolean('strict_knowledge')->default(true);
                $table->boolean('is_default')->default(false)->index();
                $table->boolean('enabled')->default(true)->index();
                $table->json('settings')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_plan_items')) {
            Schema::create('tongzhuo_content_plan_items', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('content_plan_id')->index();
                $table->unsignedBigInteger('topic_candidate_id')->nullable()->index();
                $table->unsignedBigInteger('question_library_item_id')->nullable()->index();
                $table->unsignedBigInteger('article_id')->nullable()->index();
                $table->unsignedBigInteger('writing_agent_id')->nullable()->index();
                $table->string('title', 240);
                $table->string('output_type', 32)->default('article')->index();
                $table->string('status', 32)->default('queued')->index();
                $table->string('review_status', 24)->default('unreviewed')->index();
                $table->string('priority', 20)->default('medium')->index();
                $table->json('brief')->nullable();
                $table->json('knowledge_scope')->nullable();
                $table->timestamp('scheduled_at')->nullable()->index();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->unsignedBigInteger('reviewed_by_admin_id')->nullable()->index();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->foreign('content_plan_id', 'tz_content_plan_items_plan_fk')
                    ->references('id')->on('tongzhuo_content_plans')->cascadeOnDelete();
                $table->foreign('topic_candidate_id', 'tz_content_plan_items_topic_fk')
                    ->references('id')->on('tongzhuo_content_topic_candidates')->nullOnDelete();
                $table->foreign('question_library_item_id', 'tz_content_plan_items_question_fk')
                    ->references('id')->on('tongzhuo_content_question_library')->nullOnDelete();
                $table->foreign('writing_agent_id', 'tz_content_plan_items_agent_fk')
                    ->references('id')->on('tongzhuo_content_writing_agents')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_generation_runs')) {
            Schema::create('tongzhuo_content_generation_runs', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('content_plan_item_id')->nullable()->index();
                $table->unsignedBigInteger('article_id')->nullable()->index();
                $table->unsignedBigInteger('writing_agent_id')->nullable()->index();
                $table->string('status', 24)->default('queued')->index();
                $table->string('provider', 80)->nullable()->index();
                $table->string('model', 120)->nullable();
                $table->longText('prompt_snapshot')->nullable();
                $table->json('brief_snapshot')->nullable();
                $table->json('knowledge_scope')->nullable();
                $table->json('retrieval_snapshot')->nullable();
                $table->json('citation_snapshot')->nullable();
                $table->json('usage')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('content_plan_item_id', 'tz_content_generation_item_fk')
                    ->references('id')->on('tongzhuo_content_plan_items')->nullOnDelete();
                $table->foreign('writing_agent_id', 'tz_content_generation_agent_fk')
                    ->references('id')->on('tongzhuo_content_writing_agents')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_content_article_citations')) {
            Schema::create('tongzhuo_content_article_citations', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('article_id')->index();
                $table->unsignedBigInteger('generation_run_id')->nullable()->index();
                $table->string('citation_key', 32);
                $table->string('source_type', 40)->index();
                $table->unsignedBigInteger('source_id')->nullable()->index();
                $table->string('source_title', 240)->nullable();
                $table->string('source_url', 1000)->nullable();
                $table->text('quote')->nullable();
                $table->string('locator', 240)->nullable();
                $table->string('confidence', 20)->default('medium')->index();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->foreign('generation_run_id', 'tz_content_citations_generation_fk')
                    ->references('id')->on('tongzhuo_content_generation_runs')->nullOnDelete();
                $table->unique(['article_id', 'citation_key'], 'tz_content_article_citation_unique');
            });
        }

        if (! Schema::hasTable('tongzhuo_content_article_versions')) {
            Schema::create('tongzhuo_content_article_versions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('article_id')->index();
                $table->unsignedBigInteger('content_plan_item_id')->nullable()->index();
                $table->unsignedBigInteger('generation_run_id')->nullable()->index();
                $table->unsignedInteger('version_number');
                $table->string('status', 24)->default('draft')->index();
                $table->string('title', 240);
                $table->longText('content');
                $table->json('structured_content')->nullable();
                $table->json('citation_snapshot')->nullable();
                $table->json('quality_result')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->foreign('content_plan_item_id', 'tz_content_versions_item_fk')
                    ->references('id')->on('tongzhuo_content_plan_items')->nullOnDelete();
                $table->foreign('generation_run_id', 'tz_content_versions_generation_fk')
                    ->references('id')->on('tongzhuo_content_generation_runs')->nullOnDelete();
                $table->unique(['article_id', 'version_number'], 'tz_content_article_version_unique');
            });
        }
    }

    public function down(): void
    {
        foreach ([
            'tongzhuo_content_article_versions',
            'tongzhuo_content_article_citations',
            'tongzhuo_content_generation_runs',
            'tongzhuo_content_plan_items',
            'tongzhuo_content_plans',
            'tongzhuo_content_topic_candidates',
            'tongzhuo_content_question_library',
            'tongzhuo_content_managed_keywords',
            'tongzhuo_content_keyword_packs',
            'tongzhuo_content_writing_agents',
            'tongzhuo_content_business_lines',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
