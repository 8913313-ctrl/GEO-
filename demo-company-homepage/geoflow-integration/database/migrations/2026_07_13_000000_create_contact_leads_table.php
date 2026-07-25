<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_leads', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 80);
            $table->string('phone', 80);
            $table->string('company', 150)->nullable();
            $table->string('service', 100);
            $table->string('website', 500)->nullable();
            $table->text('message');
            $table->string('source_url', 500)->nullable();
            $table->string('status', 30)->default('new')->index();
            $table->text('note')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('contacted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_leads');
    }
};
