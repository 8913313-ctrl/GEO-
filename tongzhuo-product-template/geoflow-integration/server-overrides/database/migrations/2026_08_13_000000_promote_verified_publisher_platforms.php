<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The desktop agent has offline contract coverage for all 28 external
     * platform IDs. Promote the five rows that were still marked `planned`
     * to `manual`, so the backend can queue them while retaining the
     * human-confirmation gate (manual is never advertised as direct publish).
     *
     * Only rows that are still `planned` are touched. This preserves an
     * operator's explicit paused/retired status and avoids overwriting a
     * customer-managed support level.
     */
    public function up(): void
    {
        if (! Schema::hasTable('publisher_platforms') || ! Schema::hasColumn('publisher_platforms', 'platform_id') || ! Schema::hasColumn('publisher_platforms', 'support_level')) {
            return;
        }

        DB::table('publisher_platforms')
            ->whereIn('platform_id', [
                'sohufocus',
                'x',
                'eastmoney',
                'smzdm',
                'netease',
            ])
            ->where('support_level', 'planned')
            ->update(['support_level' => 'manual']);
    }

    public function down(): void
    {
        // Forward-only: after deployment we cannot distinguish a row that
        // this migration promoted from one an operator intentionally changed
        // to manual. Reverting it could silently disable a customer setting.
    }
};
