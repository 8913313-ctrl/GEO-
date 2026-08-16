<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('publisher_devices')) {
            return;
        }

        Schema::table('publisher_devices', function (Blueprint $table): void {
            // The initial device-table migration now carries these columns
            // for fresh installs. Keep this historical upgrade migration
            // additive so both fresh and already-upgraded installations work.
            if (! Schema::hasColumn('publisher_devices', 'connection_mode')) {
                $table->string('connection_mode', 24)->default('token')->index()->after('status');
            }
            if (! Schema::hasColumn('publisher_devices', 'pairing_code')) {
                $table->string('pairing_code', 80)->nullable()->index()->after('connection_mode');
            }
            if (! Schema::hasColumn('publisher_devices', 'pairing_issued_at')) {
                $table->timestamp('pairing_issued_at')->nullable()->after('pairing_code');
            }
            if (! Schema::hasColumn('publisher_devices', 'pairing_expires_at')) {
                $table->timestamp('pairing_expires_at')->nullable()->after('pairing_issued_at');
            }
            if (! Schema::hasColumn('publisher_devices', 'paired_at')) {
                $table->timestamp('paired_at')->nullable()->after('pairing_expires_at');
            }
        });
    }

    public function down(): void
    {
        // Forward-only: on fresh installs these columns are owned by the
        // earlier create_publisher_devices migration. Dropping them here
        // would make rolling back this compatibility migration destructive.
    }
};
