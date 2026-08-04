<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publisher_devices', function (Blueprint $table): void {
            $table->string('connection_mode', 24)->default('token')->index()->after('status');
            $table->string('pairing_code', 80)->nullable()->index()->after('connection_mode');
            $table->timestamp('pairing_issued_at')->nullable()->after('pairing_code');
            $table->timestamp('pairing_expires_at')->nullable()->after('pairing_issued_at');
            $table->timestamp('paired_at')->nullable()->after('pairing_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('publisher_devices', function (Blueprint $table): void {
            $table->dropColumn([
                'connection_mode',
                'pairing_code',
                'pairing_issued_at',
                'pairing_expires_at',
                'paired_at',
            ]);
        });
    }
};
