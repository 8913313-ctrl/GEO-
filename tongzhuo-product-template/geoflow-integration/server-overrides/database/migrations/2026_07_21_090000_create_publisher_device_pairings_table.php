<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publisher_device_pairings', function (Blueprint $table): void {
            $table->id();
            $table->string('pairing_code', 80)->unique();
            $table->string('status', 40)->default('pending')->index();
            $table->string('requested_by', 120)->nullable();
            $table->timestamp('issued_at')->nullable()->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('claimed_at')->nullable()->index();
            $table->string('claimed_device_id', 120)->nullable()->index();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publisher_device_pairings');
    }
};
