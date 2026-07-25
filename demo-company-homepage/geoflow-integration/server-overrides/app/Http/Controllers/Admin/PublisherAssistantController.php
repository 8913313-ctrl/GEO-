<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use App\Models\PublisherDevice;
use App\Services\GeoFlow\DistributionOrchestrator;
use App\Support\AdminWeb;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class PublisherAssistantController extends Controller
{
    public function __construct(
        private readonly DistributionOrchestrator $distributionOrchestrator,
    ) {}

    public function index(): View
    {
        $localChannelTypes = ['desktop_publisher', 'wechatsync_manual'];

        $localChannels = DistributionChannel::query()
            ->whereIn('channel_type', $localChannelTypes)
            ->orderByDesc('id')
            ->get();

        $localJobQuery = ArticleDistribution::query()
            ->whereHas('channel', fn ($query) => $query->whereIn('channel_type', $localChannelTypes));

        $jobCounts = [
            'queued' => (clone $localJobQuery)->where('status', 'queued')->count(),
            'sending' => (clone $localJobQuery)->where('status', 'sending')->count(),
            'synced' => (clone $localJobQuery)->where('status', 'synced')->count(),
            'failed' => (clone $localJobQuery)->where('status', 'failed')->count(),
        ];

        $recentJobs = ArticleDistribution::query()
            ->with(['article:id,title,status', 'channel:id,name,channel_type'])
            ->whereHas('channel', fn ($query) => $query->whereIn('channel_type', $localChannelTypes))
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $devices = PublisherDevice::query()
            ->orderByRaw('last_seen_at is null')
            ->orderByDesc('last_seen_at')
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        $onlineDevices = $devices->filter(fn (PublisherDevice $device): bool => $this->deviceState($device) === 'online')->count();

        return view('admin.publisher-assistant', [
            'pageTitle' => '发布助手',
            'activeMenu' => 'publisher_assistant',
            'adminSiteName' => AdminWeb::siteName(),
            'localChannels' => $localChannels,
            'jobCounts' => $jobCounts,
            'recentJobs' => $recentJobs,
            'devices' => $devices,
            'onlineDevices' => $onlineDevices,
            'deviceStateResolver' => fn (PublisherDevice $device): string => $this->deviceState($device),
        ]);
    }

    public function bootstrapChannel(): RedirectResponse
    {
        [$channel, $created] = $this->ensureDefaultDesktopPublisherChannel();

        if (! $created) {
            return redirect()
                ->route('admin.publisher-assistant')
                ->with('message', '已启用现有的桐灼本地发布助手渠道，并确保本地导出包平台可用。');
        }

        return redirect()
            ->route('admin.publisher-assistant')
            ->with('message', '已创建桐灼本地发布助手渠道，默认启用微信公众号、知乎、头条号和本地导出包。');
    }

    public function enqueuePublishedArticles(): RedirectResponse
    {
        $this->ensureDefaultDesktopPublisherChannel();

        $count = 0;
        Article::query()
            ->where('status', 'published')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->each(function (Article $article) use (&$count): void {
                $this->distributionOrchestrator->enqueueForArticle($article);
                $count++;
            });

        return redirect()
            ->route('admin.publisher-assistant')
            ->with('message', $count > 0
                ? "已将 {$count} 篇已发布文章同步到本地发布助手队列，任务会由在线发布设备领取。"
                : '当前没有可同步的已发布文章。');
    }

    /**
     * @return array{0:DistributionChannel,1:bool}
     */
    private function ensureDefaultDesktopPublisherChannel(): array
    {
        $channel = DistributionChannel::query()
            ->where('channel_type', 'desktop_publisher')
            ->orderByDesc('id')
            ->first();

        if ($channel instanceof DistributionChannel) {
            $config = $channel->resolvedWechatSyncConfig();
            $config['wechatsync_platforms'] = array_values(array_unique(array_merge(
                $config['wechatsync_platforms'],
                ['zip-download']
            )));

            $channel->forceFill([
                'status' => 'active',
                'channel_config' => $config,
            ])->save();

            return [$channel, false];
        }

        $channel = DistributionChannel::query()->create([
            'name' => '桐灼本地发布助手',
            'domain' => 'local-publisher.tongzhuo.internal',
            'endpoint_url' => 'https://local.tongzhuo-publisher.invalid',
            'channel_type' => 'desktop_publisher',
            'front_mode' => 'static',
            'template_key' => null,
            'site_settings' => [],
            'channel_config' => [
                'wechatsync_platforms' => $this->defaultLocalPublisherPlatforms(),
                'wechatsync_default_mode' => 'draft',
                'wechatsync_content_format' => 'markdown_and_html',
            ],
            'status' => 'active',
            'description' => '系统默认本地发布助手渠道。文章发布后进入队列，由客户电脑上的桌面执行器领取并回写结果。',
            'created_by_admin_id' => auth('admin')->id(),
        ]);

        return [$channel, true];
    }

    /**
     * @return list<string>
     */
    private function defaultLocalPublisherPlatforms(): array
    {
        return ['wechat_mp', 'zhihu', 'toutiao', 'zip-download'];
    }

    private function deviceState(PublisherDevice $device): string
    {
        if ($device->disabled_at !== null) {
            return 'disabled';
        }

        if ((string) $device->status === 'pending') {
            return 'pending';
        }

        if ($device->last_seen_at && $device->last_seen_at->gte(now()->subMinutes(2))) {
            return 'online';
        }

        return 'offline';
    }
}
