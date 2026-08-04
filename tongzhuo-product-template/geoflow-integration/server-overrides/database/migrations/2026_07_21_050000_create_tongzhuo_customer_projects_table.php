<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_customer_projects')) {
            Schema::create('tongzhuo_customer_projects', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('site_id')->nullable()->constrained('tongzhuo_cms_sites')->nullOnDelete();
                $table->string('name', 120);
                $table->string('company_name', 180);
                $table->string('status', 30)->default('active')->index();
                $table->string('stage', 40)->default('intake')->index();
                $table->string('health_status', 30)->default('normal')->index();
                $table->string('contact_name', 80)->nullable();
                $table->string('contact_phone', 80)->nullable();
                $table->string('website_url', 500)->nullable();
                $table->string('geoflow_url', 500)->nullable();
                $table->json('service_lines')->nullable();
                $table->json('endpoints')->nullable();
                $table->json('delivery_profile')->nullable();
                $table->text('next_action')->nullable();
                $table->text('notes')->nullable();
                $table->date('contract_started_at')->nullable();
                $table->date('go_live_at')->nullable();
                $table->timestamp('last_reviewed_at')->nullable();
                $table->foreignId('created_by_admin_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tongzhuo_customer_projects');
    }
};
