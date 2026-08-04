<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_answer_tests')) {
            return;
        }

        Schema::table('tongzhuo_geo_answer_tests', function (Blueprint $table): void {
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'platform')) {
                $table->string('platform', 40)->default('local')->after('source')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'surface')) {
                $table->string('surface', 40)->default('web')->after('platform')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'prompt_id')) {
                $table->string('prompt_id', 80)->nullable()->after('surface')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'run_id')) {
                $table->string('run_id', 80)->nullable()->after('prompt_id')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'model_version')) {
                $table->string('model_version', 120)->nullable()->after('run_id');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'sampled_at')) {
                $table->timestamp('sampled_at')->nullable()->after('model_version');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'mention')) {
                $table->boolean('mention')->default(false)->after('sampled_at')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'recommendation')) {
                $table->boolean('recommendation')->default(false)->after('mention')->index();
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'rank')) {
                $table->unsignedSmallInteger('rank')->nullable()->after('recommendation');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'citations')) {
                $table->json('citations')->nullable()->after('rank');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'competitor_mentions')) {
                $table->json('competitor_mentions')->nullable()->after('citations');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'answer_accuracy')) {
                $table->unsignedTinyInteger('answer_accuracy')->nullable()->after('competitor_mentions');
            }
            if (! Schema::hasColumn('tongzhuo_geo_answer_tests', 'sampling_notes')) {
                $table->text('sampling_notes')->nullable()->after('answer_accuracy');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tongzhuo_geo_answer_tests')) {
            return;
        }

        Schema::table('tongzhuo_geo_answer_tests', function (Blueprint $table): void {
            foreach ([
                'platform',
                'surface',
                'prompt_id',
                'run_id',
                'model_version',
                'sampled_at',
                'mention',
                'recommendation',
                'rank',
                'citations',
                'competitor_mentions',
                'answer_accuracy',
                'sampling_notes',
            ] as $column) {
                if (Schema::hasColumn('tongzhuo_geo_answer_tests', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
