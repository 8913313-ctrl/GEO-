<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The V2 publishing tables are already present on some installations.
     * Keep this migration additive and idempotent so an upgrade can be
     * applied to both the original V2 schema and partially upgraded copies.
     */
    public function up(): void
    {
        if (Schema::hasTable('publisher_devices')) {
            Schema::table('publisher_devices', function (Blueprint $table): void {
                if (! Schema::hasColumn('publisher_devices', 'desired_state')) {
                    $table->json('desired_state')->nullable()->after('meta');
                }
                if (! Schema::hasColumn('publisher_devices', 'desired_state_version')) {
                    $table->unsignedBigInteger('desired_state_version')->default(0)->after('desired_state');
                }
                if (! Schema::hasColumn('publisher_devices', 'desired_state_updated_at')) {
                    $table->timestamp('desired_state_updated_at')->nullable()->index()->after('desired_state_version');
                }
                if (! Schema::hasColumn('publisher_devices', 'applied_state_version')) {
                    $table->unsignedBigInteger('applied_state_version')->nullable()->after('desired_state_updated_at');
                }
                if (! Schema::hasColumn('publisher_devices', 'local_override')) {
                    $table->boolean('local_override')->default(false)->after('applied_state_version');
                }
            });
        }

        if (Schema::hasTable('publisher_platform_jobs')) {
            Schema::table('publisher_platform_jobs', function (Blueprint $table): void {
                if (! Schema::hasColumn('publisher_platform_jobs', 'lease_token')) {
                    $table->string('lease_token', 128)->nullable()->index()->after('lease_expires_at');
                }
                if (! Schema::hasColumn('publisher_platform_jobs', 'claimed_by')) {
                    $table->string('claimed_by', 120)->nullable()->index()->after('lease_token');
                }
                if (! Schema::hasColumn('publisher_platform_jobs', 'lease_heartbeat_at')) {
                    $table->timestamp('lease_heartbeat_at')->nullable()->index()->after('claimed_by');
                }
            });
        }

        if (Schema::hasTable('publisher_device_commands')) {
            Schema::table('publisher_device_commands', function (Blueprint $table): void {
                if (! Schema::hasColumn('publisher_device_commands', 'lease_token')) {
                    $table->string('lease_token', 128)->nullable()->index()->after('claimed_at');
                }
                if (! Schema::hasColumn('publisher_device_commands', 'lease_expires_at')) {
                    $table->timestamp('lease_expires_at')->nullable()->index()->after('lease_token');
                }

                if (! Schema::hasColumn('publisher_device_commands', 'claimed_by')) {
                    $table->string('claimed_by', 120)->nullable()->index()->after('lease_expires_at');
                }
            });
        }
    }

    public function down(): void
    {
        // Forward-only by design: this migration is also used to complete
        // partially upgraded installations. Laravel cannot tell whether an
        // existing column was created here, so dropping it could destroy
        // pre-existing device-shadow, lease, or job-result data.
    }
};
