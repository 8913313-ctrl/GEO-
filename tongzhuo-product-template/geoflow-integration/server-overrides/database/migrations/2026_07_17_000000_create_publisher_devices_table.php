<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publisher_devices', function (Blueprint $table): void {
            $table->id();
            $table->string('device_id', 120)->unique();
            $table->string('name', 120);
            $table->text('public_key')->nullable();
            $table->string('status', 40)->default('pending')->index();
            $table->string('connection_mode', 24)->default('token')->index();
            $table->string('pairing_code', 80)->nullable()->index();
            $table->timestamp('pairing_issued_at')->nullable();
            $table->timestamp('pairing_expires_at')->nullable();
            $table->timestamp('paired_at')->nullable();
            $table->json('capabilities')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publisher_devices');
    }
};
