<?php

namespace App\Services\Publishing;

use App\Models\PublisherPlatform;
use Illuminate\Support\Collection;

class PublisherPlatformCatalogService
{
    public const EXPECTED_EXTERNAL_PLATFORM_COUNT = 28;
    public const VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS = ['wechat_mp', 'zhihu', 'toutiao'];
    public const HIDDEN_PLATFORM_IDS = ['x'];

    /**
     * @return list<array<string,mixed>>
     */
    public function definitions(): array
    {
        return [
            $this->platform('wechat_mp', '微信公众号', 'wechat', 10, 'https://mp.weixin.qq.com/', 'https://mp.weixin.qq.com/'),
            $this->platform('zhihu', '知乎', 'content', 20, 'https://www.zhihu.com/signin?next=%2F', 'https://zhuanlan.zhihu.com/write'),
            $this->platform('weibo', '微博', 'social', 30, 'https://weibo.com/', 'https://weibo.com/'),
            $this->platform('xiaohongshu', '小红书', 'video_graphic', 40, 'https://creator.xiaohongshu.com/', 'https://creator.xiaohongshu.com/new/home'),
            $this->platform('juejin', '掘金', 'tech', 50, 'https://juejin.cn/', 'https://juejin.cn/editor/drafts/new'),
            $this->platform('csdn', 'CSDN', 'tech', 60, 'https://passport.csdn.net/', 'https://editor.csdn.net/md/'),
            $this->platform('jianshu', '简书', 'blog_knowledge', 70, 'https://www.jianshu.com/sign_in', 'https://www.jianshu.com/writer'),
            $this->platform('toutiao', '头条号', 'news_media', 80, 'https://mp.toutiao.com/', 'https://mp.toutiao.com/profile_v4/graphic/publish'),
            $this->platform('douyin', '抖音图文', 'video_graphic', 90, 'https://creator.douyin.com/', 'https://creator.douyin.com/creator-micro/content/upload'),
            $this->platform('bilibili', 'B站专栏', 'video_graphic', 100, 'https://passport.bilibili.com/', 'https://member.bilibili.com/platform/upload/text/edit'),
            $this->platform('baijiahao', '百家号', 'baidu', 110, 'https://baijiahao.baidu.com/', 'https://baijiahao.baidu.com/builder/rc/edit?type=news'),
            $this->platform('yuque', '语雀', 'blog_knowledge', 120, 'https://www.yuque.com/login', 'https://www.yuque.com/dashboard'),
            $this->platform('douban', '豆瓣', 'content', 130, 'https://www.douban.com/', 'https://www.douban.com/'),
            $this->platform('sohu', '搜狐号', 'news_media', 140, 'https://mp.sohu.com/', 'https://mp.sohu.com/'),
            $this->platform('xueqiu', '雪球', 'finance_consumer', 150, 'https://xueqiu.com/', 'https://xueqiu.com/'),
            $this->platform('woshipm', '人人都是产品经理', 'tech', 160, 'https://www.woshipm.com/', 'https://www.woshipm.com/'),
            $this->platform('dayu', '大鱼号', 'news_media', 170, 'https://mp.dayu.com/', 'https://mp.dayu.com/'),
            $this->platform('yidian', '一点号', 'news_media', 180, 'https://mp.yidianzixun.com/', 'https://mp.yidianzixun.com/'),
            $this->platform('51cto', '51CTO', 'tech', 190, 'https://blog.51cto.com/', 'https://blog.51cto.com/'),
            $this->platform('imooc', '慕课网', 'tech', 200, 'https://www.imooc.com/', 'https://www.imooc.com/'),
            $this->platform('oschina', '开源中国', 'tech', 210, 'https://www.oschina.net/', 'https://my.oschina.net/'),
            $this->platform('segmentfault', 'SegmentFault', 'tech', 220, 'https://segmentfault.com/user/login', 'https://segmentfault.com/write'),
            $this->platform('cnblogs', '博客园', 'blog_knowledge', 230, 'https://account.cnblogs.com/signin', 'https://i.cnblogs.com/posts/edit'),
            $this->platform('sohufocus', '搜狐焦点', 'news_media', 240, 'https://mp.focus.cn/', 'https://mp.focus.cn/'),
            $this->platform('x', 'X（Twitter）', 'overseas', 250, 'https://x.com/login', 'https://x.com/compose/post'),
            $this->platform('eastmoney', '东方财富', 'finance_consumer', 260, 'https://www.eastmoney.com/', 'https://www.eastmoney.com/'),
            $this->platform('smzdm', '什么值得买', 'finance_consumer', 270, 'https://www.smzdm.com/', 'https://post.smzdm.com/'),
            $this->platform('netease', '网易号', 'news_media', 280, 'https://mp.163.com/', 'https://mp.163.com/'),
        ];
    }

    /**
     * Adds missing first-party catalog entries without overwriting customer-managed records.
     */
    public function ensureDefaults(): void
    {
        foreach ($this->definitions() as $definition) {
            PublisherPlatform::query()->firstOrCreate(
                ['platform_id' => $definition['platform_id']],
                $definition,
            );
        }
    }

    /** @return Collection<int, PublisherPlatform> */
    public function activePlatforms(): Collection
    {
        $this->ensureDefaults();

        return PublisherPlatform::query()
            ->where('status', 'active')
            ->whereNotIn('platform_id', self::HIDDEN_PLATFORM_IDS)
            ->orderBy('group_key')
            ->orderBy('sort_order')
            ->get();
    }

    /** @return array{configured:int,expected:int,missing:int} */
    public function coverage(): array
    {
        $configured = PublisherPlatform::query()
            ->where('status', '!=', 'retired')
            ->count();

        return [
            'configured' => $configured,
            'expected' => self::EXPECTED_EXTERNAL_PLATFORM_COUNT,
            'missing' => max(0, self::EXPECTED_EXTERNAL_PLATFORM_COUNT - $configured),
        ];
    }

    /** @return array<string,mixed> */
    private function platform(
        string $id,
        string $name,
        string $group,
        int $sortOrder,
        string $loginUrl,
        string $editorUrl,
    ): array {
        $isHidden = in_array($id, self::HIDDEN_PLATFORM_IDS, true);
        $isVerifiedDirect = in_array($id, self::VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS, true);

        return [
            'platform_id' => $id,
            'name' => $name,
            'group_key' => $group,
            'sort_order' => $sortOrder,
            'status' => $isHidden ? 'paused' : 'active',
            'support_level' => $isHidden ? 'planned' : ($isVerifiedDirect ? 'ready' : 'manual'),
            'supports_draft' => ! $isHidden,
            'supports_direct_publish' => $isVerifiedDirect,
            'supports_scheduled' => $isVerifiedDirect,
            'supports_images' => false,
            'supports_cover' => false,
            'content_formats' => ['html', 'markdown', 'plain'],
            'limits' => [],
            'login_url' => $loginUrl,
            'editor_url' => $editorUrl,
            'adapter_min_version' => $isHidden ? null : '1.8.9',
            'meta' => ['external' => true, 'catalog_source' => 'publishing-center-v2'],
        ];
    }
}
