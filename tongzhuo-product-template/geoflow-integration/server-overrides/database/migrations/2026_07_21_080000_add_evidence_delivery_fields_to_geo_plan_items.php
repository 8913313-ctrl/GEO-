<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_plan_items')) {
            return;
        }

        Schema::table('tongzhuo_geo_plan_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'evidence_source')) {
                $table->string('evidence_source', 180)->nullable()->after('expected_output');
            }
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'current_question')) {
                $table->string('current_question', 260)->nullable()->after('evidence_source');
            }
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'owner_name')) {
                $table->string('owner_name', 80)->nullable()->after('current_question');
            }
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'deliverable')) {
                $table->string('deliverable', 180)->nullable()->after('owner_name');
            }
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'acceptance_metric')) {
                $table->string('acceptance_metric', 240)->nullable()->after('deliverable');
            }
            if (! Schema::hasColumn('tongzhuo_geo_plan_items', 'resample_date')) {
                $table->date('resample_date')->nullable()->after('acceptance_metric');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_plan_items')) {
            return;
        }

        Schema::table('tongzhuo_geo_plan_items', function (Blueprint $table): void {
            foreach ([
                'evidence_source',
                'current_question',
                'owner_name',
                'deliverable',
                'acceptance_metric',
                'resample_date',
            ] as $column) {
                if (Schema::hasColumn('tongzhuo_geo_plan_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
