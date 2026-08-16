<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The claim path checks for a live lease by device + profile. A composite
     * index keeps that profile-level serialization efficient as queues grow.
     */
    public function up(): void
    {
        $columns = ['publisher_device_id', 'profile_key', 'status', 'lease_expires_at'];
        if (! Schema::hasTable('publisher_platform_jobs')
            || array_filter($columns, fn (string $column): bool => ! Schema::hasColumn('publisher_platform_jobs', $column)) !== []) {
            return;
        }
        if ($this->hasIndexNamed('publisher_platform_jobs_profile_lease_index')) {
            return;
        }

        try {
            Schema::table('publisher_platform_jobs', function (Blueprint $table): void {
                $table->index(
                    ['publisher_device_id', 'profile_key', 'status', 'lease_expires_at'],
                    'publisher_platform_jobs_profile_lease_index',
                );
            });
        } catch (\Throwable $exception) {
            // A parallel deploy may create the index after the metadata check.
            if (! $this->hasIndexNamed('publisher_platform_jobs_profile_lease_index')) {
                throw $exception;
            }
        }
    }

    public function down(): void
    {
        // Forward-only: the index protects the claim path and can be shared by
        // a customer-managed schema. Rolling this migration back must not
        // remove an index that predated it.
    }

    private function hasIndexNamed(string $name): bool
    {
        foreach (Schema::getIndexes('publisher_platform_jobs') as $index) {
            if (strcasecmp((string) ($index['name'] ?? ''), $name) === 0) {
                return true;
            }
        }

        return false;
    }
};