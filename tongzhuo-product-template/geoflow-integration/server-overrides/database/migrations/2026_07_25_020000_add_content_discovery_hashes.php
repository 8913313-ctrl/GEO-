<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tongzhuo_content_question_library') && ! Schema::hasColumn('tongzhuo_content_question_library', 'question_hash')) {
            Schema::table('tongzhuo_content_question_library', function (Blueprint $table): void {
                $table->char('question_hash', 64)->nullable()->after('managed_keyword_id');
            });
            $this->backfillQuestionHashes();
            Schema::table('tongzhuo_content_question_library', function (Blueprint $table): void {
                $table->unique(['business_line_id', 'question_hash'], 'tz_content_questions_hash_unique');
            });
        }

        if (Schema::hasTable('tongzhuo_content_topic_candidates') && ! Schema::hasColumn('tongzhuo_content_topic_candidates', 'topic_hash')) {
            Schema::table('tongzhuo_content_topic_candidates', function (Blueprint $table): void {
                $table->char('topic_hash', 64)->nullable()->after('question_library_item_id');
            });
            $this->backfillTopicHashes();
            Schema::table('tongzhuo_content_topic_candidates', function (Blueprint $table): void {
                $table->unique(['business_line_id', 'topic_hash'], 'tz_content_topics_hash_unique');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tongzhuo_content_topic_candidates') && Schema::hasColumn('tongzhuo_content_topic_candidates', 'topic_hash')) {
            Schema::table('tongzhuo_content_topic_candidates', function (Blueprint $table): void {
                $table->dropUnique('tz_content_topics_hash_unique');
                $table->dropColumn('topic_hash');
            });
        }
        if (Schema::hasTable('tongzhuo_content_question_library') && Schema::hasColumn('tongzhuo_content_question_library', 'question_hash')) {
            Schema::table('tongzhuo_content_question_library', function (Blueprint $table): void {
                $table->dropUnique('tz_content_questions_hash_unique');
                $table->dropColumn('question_hash');
            });
        }
    }

    private function backfillQuestionHashes(): void
    {
        $seen = [];
        DB::table('tongzhuo_content_question_library')->orderBy('id')->chunkById(200, function ($rows) use (&$seen): void {
            foreach ($rows as $row) {
                $normalized = preg_replace('/\s+/u', '', mb_strtolower(trim((string) $row->question))) ?: trim((string) $row->question);
                $hash = hash('sha256', $normalized);
                $key = ((int) $row->business_line_id).':'.$hash;
                // Existing duplicates remain addressable; only the first
                // record receives a non-null key so the new unique index is
                // safe on upgrades of already-used installations.
                $value = isset($seen[$key]) ? null : $hash;
                $seen[$key] = true;
                DB::table('tongzhuo_content_question_library')->where('id', $row->id)->update(['question_hash' => $value]);
            }
        });
    }

    private function backfillTopicHashes(): void
    {
        $seen = [];
        DB::table('tongzhuo_content_topic_candidates')->orderBy('id')->chunkById(200, function ($rows) use (&$seen): void {
            foreach ($rows as $row) {
                $source = $row->question_library_item_id !== null
                    ? 'question:'.(int) $row->question_library_item_id
                    : 'question:'.(preg_replace('/\s+/u', '', mb_strtolower(trim((string) $row->primary_question))) ?: trim((string) $row->primary_question));
                $hash = hash('sha256', $source.'|title:'.(preg_replace('/\s+/u', '', mb_strtolower(trim((string) $row->title))) ?: trim((string) $row->title)));
                $key = ((int) $row->business_line_id).':'.$hash;
                $value = isset($seen[$key]) ? null : $hash;
                $seen[$key] = true;
                DB::table('tongzhuo_content_topic_candidates')->where('id', $row->id)->update(['topic_hash' => $value]);
            }
        });
    }
};
