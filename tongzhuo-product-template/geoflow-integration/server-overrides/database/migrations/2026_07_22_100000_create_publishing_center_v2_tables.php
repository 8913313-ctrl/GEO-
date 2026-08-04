<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publisher_platforms', function (Blueprint $table): void {
            $table->id();
            $table->string('platform_id', 80)->unique();
            $table->string('name', 120);
            $table->string('group_key', 60)->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->string('status', 30)->default('active')->index();
            $table->string('support_level', 30)->default('manual')->index();
            $table->boolean('supports_draft')->default(false);
            $table->boolean('supports_direct_publish')->default(false);
            $table->boolean('supports_scheduled')->default(false);
            $table->boolean('supports_images')->default(false);
            $table->boolean('supports_cover')->default(false);
            $table->json('content_formats')->nullable();
            $table->json('limits')->nullable();
            $table->string('login_url', 500)->nullable();
            $table->string('editor_url', 500)->nullable();
            $table->string('adapter_min_version', 40)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('publisher_account_groups', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->string('default_publish_mode', 30)->default('draft');
            $table->string('status', 30)->default('active')->index();
            $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('publisher_account_group_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('publisher_account_group_id');
            $table->string('platform_id', 80);
            $table->unsignedBigInteger('publisher_device_id')->nullable()->index();
            $table->unsignedBigInteger('publisher_platform_session_id')->nullable()->index();
            $table->string('profile_key', 120)->nullable();
            $table->string('publish_mode', 30)->default('draft');
            $table->boolean('enabled')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('overrides')->nullable();
            $table->timestamps();

            $table->foreign('publisher_account_group_id', 'publisher_account_group_items_group_fk')
                ->references('id')->on('publisher_account_groups')->cascadeOnDelete();
            $table->foreign('publisher_device_id', 'publisher_account_group_items_device_fk')
                ->references('id')->on('publisher_devices')->nullOnDelete();
            $table->foreign('publisher_platform_session_id', 'publisher_account_group_items_session_fk')
                ->references('id')->on('publisher_platform_sessions')->nullOnDelete();
            $table->unique(
                ['publisher_account_group_id', 'platform_id', 'publisher_platform_session_id'],
                'publisher_account_group_platform_session_unique'
            );
        });

        Schema::table('article_distributions', function (Blueprint $table): void {
            $table->string('publish_mode', 30)->default('draft')->index()->after('action');
            $table->unsignedBigInteger('publisher_account_group_id')->nullable()->index()->after('distribution_channel_id');
            $table->string('assigned_device_strategy', 30)->default('auto')->after('publisher_account_group_id');
            $table->unsignedBigInteger('requested_by_admin_id')->nullable()->index()->after('assigned_device_strategy');
            $table->timestamp('scheduled_at')->nullable()->index()->after('next_retry_at');
            $table->timestamp('started_at')->nullable()->index()->after('scheduled_at');
            $table->timestamp('completed_at')->nullable()->index()->after('started_at');
            $table->json('publisher_summary')->nullable()->after('remote_meta');

            $table->foreign('publisher_account_group_id', 'article_distributions_publisher_group_fk')
                ->references('id')->on('publisher_account_groups')->nullOnDelete();
        });

        Schema::create('publisher_platform_jobs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('article_distribution_id');
            $table->string('platform_id', 80);
            $table->unsignedBigInteger('publisher_device_id')->nullable()->index();
            $table->unsignedBigInteger('publisher_platform_session_id')->nullable()->index();
            $table->string('profile_key', 120)->nullable();
            $table->string('publish_mode', 30)->default('draft')->index();
            $table->string('status', 40)->default('queued')->index();
            $table->string('progress_step', 120)->nullable();
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(2);
            $table->timestamp('claimed_at')->nullable()->index();
            $table->timestamp('lease_expires_at')->nullable()->index();
            $table->timestamp('started_at')->nullable()->index();
            $table->timestamp('last_progress_at')->nullable()->index();
            $table->timestamp('finished_at')->nullable()->index();
            $table->timestamp('next_retry_at')->nullable()->index();
            $table->string('remote_url', 1000)->nullable();
            $table->string('error_category', 80)->nullable()->index();
            $table->text('error_message')->nullable();
            $table->string('next_operator_action', 160)->nullable();
            $table->json('payload_snapshot')->nullable();
            $table->json('result')->nullable();
            $table->timestamps();

            $table->foreign('article_distribution_id', 'publisher_platform_jobs_distribution_fk')
                ->references('id')->on('article_distributions')->cascadeOnDelete();
            $table->foreign('publisher_device_id', 'publisher_platform_jobs_device_fk')
                ->references('id')->on('publisher_devices')->nullOnDelete();
            $table->foreign('publisher_platform_session_id', 'publisher_platform_jobs_session_fk')
                ->references('id')->on('publisher_platform_sessions')->nullOnDelete();
            $table->unique(
                ['article_distribution_id', 'platform_id', 'publisher_platform_session_id'],
                'publisher_platform_jobs_distribution_platform_session_unique'
            );
        });

        Schema::create('publisher_device_commands', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('publisher_device_id')->index();
            $table->string('command_type', 60)->index();
            $table->string('status', 30)->default('queued')->index();
            $table->json('payload')->nullable();
            $table->json('result')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('claimed_at')->nullable()->index();
            $table->timestamp('completed_at')->nullable()->index();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->foreign('publisher_device_id', 'publisher_device_commands_device_fk')
                ->references('id')->on('publisher_devices')->cascadeOnDelete();
        });

        Schema::table('publisher_platform_sessions', function (Blueprint $table): void {
            $table->json('capabilities')->nullable()->after('auto_allowed');
            $table->string('support_level', 30)->nullable()->index()->after('capabilities');
            $table->timestamp('last_probe_at')->nullable()->index()->after('last_seen_at');
            $table->string('adapter_version', 40)->nullable()->after('support_level');
            $table->unique(
                ['publisher_device_id', 'platform_id', 'profile_key'],
                'publisher_platform_sessions_device_platform_profile_unique'
            );
        });

    }

    public function down(): void
    {
        Schema::table('publisher_platform_sessions', function (Blueprint $table): void {
            $table->dropUnique('publisher_platform_sessions_device_platform_profile_unique');
            $table->dropColumn(['capabilities', 'support_level', 'last_probe_at', 'adapter_version']);
        });

        Schema::dropIfExists('publisher_device_commands');
        Schema::dropIfExists('publisher_platform_jobs');

        Schema::table('article_distributions', function (Blueprint $table): void {
            $table->dropForeign('article_distributions_publisher_group_fk');
            $table->dropColumn([
                'publish_mode',
                'publisher_account_group_id',
                'assigned_device_strategy',
                'requested_by_admin_id',
                'scheduled_at',
                'started_at',
                'completed_at',
                'publisher_summary',
            ]);
        });

        Schema::dropIfExists('publisher_account_group_items');
        Schema::dropIfExists('publisher_account_groups');
        Schema::dropIfExists('publisher_platforms');
    }
};
