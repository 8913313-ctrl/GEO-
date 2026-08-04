<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publisher_platform_sessions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('publisher_device_id')->index();
            $table->string('device_id', 120)->index();
            $table->string('platform_id', 80)->index();
            $table->string('profile_key', 120)->nullable()->index();
            $table->string('account_name', 120)->nullable();
            $table->string('login_state', 40)->default('unknown')->index();
            $table->timestamp('last_verified_at')->nullable()->index();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->text('last_error_message')->nullable();
            $table->boolean('auto_allowed')->default(false)->index();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->foreign('publisher_device_id')->references('id')->on('publisher_devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publisher_platform_sessions');
    }
};
