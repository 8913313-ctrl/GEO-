<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('publisher_account_groups')) {
            return;
        }

        Schema::table('publisher_account_groups', function (Blueprint $table): void {
            if (! Schema::hasColumn('publisher_account_groups', 'publisher_device_id')) {
                $table->unsignedBigInteger('publisher_device_id')->nullable()->index()->after('id');
            }
            if (! Schema::hasColumn('publisher_account_groups', 'external_id')) {
                $table->string('external_id', 120)->nullable()->index()->after('publisher_device_id');
            }
        });

        if ($this->hasDeviceExternalUniqueIndex()) {
            return;
        }

        try {
            Schema::table('publisher_account_groups', function (Blueprint $table): void {
                $table->unique(
                    ['publisher_device_id', 'external_id'],
                    'publisher_account_groups_device_external_unique'
                );
            });
        } catch (\Throwable $exception) {
            // A rolling or parallel deployment may create the same index after
            // the metadata check. Treat that as success, but surface genuine
            // schema/data errors such as duplicate non-null source identities.
            if (! $this->hasDeviceExternalUniqueIndex()) {
                throw $exception;
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('publisher_account_groups')) {
            return;
        }

        if ($this->hasIndexNamed('publisher_account_groups_device_external_unique')) {
            Schema::table('publisher_account_groups', function (Blueprint $table): void {
                $table->dropUnique('publisher_account_groups_device_external_unique');
            });
        }

        Schema::table('publisher_account_groups', function (Blueprint $table): void {
            if (Schema::hasColumn('publisher_account_groups', 'external_id')) {
                $table->dropColumn('external_id');
            }
            if (Schema::hasColumn('publisher_account_groups', 'publisher_device_id')) {
                $table->dropColumn('publisher_device_id');
            }
        });
    }

    private function hasDeviceExternalUniqueIndex(): bool
    {
        $wanted = ['external_id', 'publisher_device_id'];
        sort($wanted);

        foreach (Schema::getIndexes('publisher_account_groups') as $index) {
            $columns = array_map(
                fn ($column): string => strtolower((string) $column),
                (array) ($index['columns'] ?? []),
            );
            sort($columns);
            $unique = (bool) ($index['unique'] ?? false)
                || strtolower((string) ($index['type'] ?? '')) === 'unique';
            if ($unique && $columns === $wanted) {
                return true;
            }
        }

        return false;
    }

    private function hasIndexNamed(string $name): bool
    {
        foreach (Schema::getIndexes('publisher_account_groups') as $index) {
            if (strcasecmp((string) ($index['name'] ?? ''), $name) === 0) {
                return true;
            }
        }

        return false;
    }
};
