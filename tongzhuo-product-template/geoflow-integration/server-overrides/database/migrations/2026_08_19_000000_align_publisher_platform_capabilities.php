<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $requiredColumns = [
            'platform_id',
            'status',
            'support_level',
            'supports_draft',
            'supports_direct_publish',
            'supports_scheduled',
        ];
        if (! Schema::hasTable('publisher_platforms')) {
            return;
        }
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('publisher_platforms', $column)) {
                return;
            }
        }

        $directPlatformIds = ['wechat_mp', 'zhihu', 'toutiao'];
        $manualPlatformIds = [
            'weibo',
            'xiaohongshu',
            'juejin',
            'csdn',
            'jianshu',
            'douyin',
            'bilibili',
            'baijiahao',
            'yuque',
            'douban',
            'sohu',
            'xueqiu',
            'woshipm',
            'dayu',
            'yidian',
            '51cto',
            'imooc',
            'oschina',
            'segmentfault',
            'cnblogs',
            'sohufocus',
            'eastmoney',
            'smzdm',
            'netease',
        ];

        DB::table('publisher_platforms')
            ->whereIn('platform_id', $directPlatformIds)
            ->update([
                'status' => 'active',
                'support_level' => 'ready',
                'supports_draft' => true,
                'supports_direct_publish' => true,
                'supports_scheduled' => true,
            ]);

        DB::table('publisher_platforms')
            ->whereIn('platform_id', $manualPlatformIds)
            ->update([
                'status' => 'active',
                'support_level' => 'manual',
                'supports_draft' => true,
                'supports_direct_publish' => false,
                'supports_scheduled' => false,
            ]);

        DB::table('publisher_platforms')
            ->where('platform_id', 'x')
            ->update([
                'status' => 'paused',
                'support_level' => 'planned',
                'supports_draft' => false,
                'supports_direct_publish' => false,
                'supports_scheduled' => false,
            ]);
    }

    public function down(): void
    {
        // Forward-only: prior capability values may include operator changes,
        // so rolling this policy back cannot be done safely.
    }
};
