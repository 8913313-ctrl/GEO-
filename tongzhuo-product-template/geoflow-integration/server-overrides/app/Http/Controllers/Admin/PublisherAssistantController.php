<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use App\Models\PublisherDevicePairing;
use App\Models\PublisherAccountGroup;
use App\Services\Publishing\PublisherPlatformCatalogService;
use App\Services\Publishing\PublishingCenterService;
use App\Models\PublisherDevice;
use App\Services\GeoFlow\DistributionOrchestrator;
use App\Support\AdminWeb;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Throwable;

class PublisherAssistantController extends Controller
{
    public function __construct(
        private readonly DistributionOrchestrator $distributionOrchestrator,
        private readonly PublishingCenterService $publishingCenter,
        private readonly PublisherPlatformCatalogService $publisherPlatforms,
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

        $attentionJobs = (clone $localJobQuery)->get()->filter(function (ArticleDistribution $job): bool {
            $assistant = $job->publisherAssistantMeta();
            $state = (string) ($assistant['state'] ?? '');
            if (in_array($state, ['awaiting_confirmation', 'draft_saved', 'failed'], true)) {
                return true;
            }

            foreach ($job->publisherPlatformResults() as $result) {
                $platformState = is_array($result) ? (string) ($result['state'] ?? '') : '';
                if ($platformState !== '' && ! in_array($platformState, ['published', 'draft_saved'], true)) {
                    return true;
                }
            }

            return false;
        })->count();

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

        $pairings = PublisherDevicePairing::query()
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        $onlineDevices = $devices->filter(fn (PublisherDevice $device): bool => $this->deviceState($device) === 'online')->count();
        $publishedArticles = Article::query()
            ->where('status', 'published')
            ->orderByDesc('id')
            ->limit(100)
            ->get(['id', 'title', 'published_at']);
        $publisherPlatforms = $this->publisherPlatforms->activePlatforms();
        $accountGroups = PublisherAccountGroup::query()
            ->with('device:id,name,device_id,last_seen_at')
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        return view('admin.publisher-assistant', [
            'pageTitle' => '发布助手',
            'activeMenu' => 'publisher_assistant',
            'adminSiteName' => AdminWeb::siteName(),
            'localChannels' => $localChannels,
            'jobCounts' => $jobCounts,
            'recentJobs' => $recentJobs,
            'devices' => $devices,
            'pairings' => $pairings,
            'onlineDevices' => $onlineDevices,
            'attentionJobs' => $attentionJobs,
            'publishedArticles' => $publishedArticles,
            'publisherPlatforms' => $publisherPlatforms,
            'accountGroups' => $accountGroups,
            'publishingRequestKey' => (string) Str::uuid(),
            'deviceStateResolver' => fn (PublisherDevice $device): string => $this->deviceState($device),
        ]);
    }

    public function createPublishingBatch(Request $request): RedirectResponse
    {
        if (! (bool) config('publishing.center_v2_enabled', false)) {
            return back()->withInput()->withErrors('发布中心 V2 尚未启用，不能创建平台子任务。');
        }

        $validated = $request->validate([
            'article_id' => ['required', 'integer', 'exists:articles,id'],
            'platform_ids' => ['required', 'array', 'min:1'],
            'platform_ids.*' => ['string', 'max:80', 'exists:publisher_platforms,platform_id'],
            'account_group_id' => ['nullable', 'integer', 'exists:publisher_account_groups,id'],
            'publish_mode' => ['required', 'string', 'in:draft,direct,scheduled'],
            'scheduled_at' => ['nullable', 'required_if:publish_mode,scheduled', 'date', 'after:now'],
            'device_strategy' => ['nullable', 'string', 'in:auto,specified'],
            'preferred_device_id' => ['nullable', 'integer', 'exists:publisher_devices,id'],
            'idempotency_key' => ['required', 'string', 'max:120'],
        ]);

        $article = Article::query()->whereKey($validated['article_id'])->firstOrFail();
        if ((string) $article->status !== 'published') {
            return back()->withInput()->withErrors('只有已经发布到官网的文章才能创建平台发布任务。');
        }
        $accountGroup = filled($validated['account_group_id'] ?? null)
            ? PublisherAccountGroup::query()->whereKey($validated['account_group_id'])->where('status', 'active')->firstOrFail()
            : null;
        $preferredDeviceId = filled($validated['preferred_device_id'] ?? null)
            ? (int) $validated['preferred_device_id']
            : null;
        if ($accountGroup?->publisher_device_id !== null
            && $preferredDeviceId !== null
            && (int) $accountGroup->publisher_device_id !== $preferredDeviceId) {
            return back()->withInput()->withErrors('The selected account group belongs to a different publishing device.');
        }
        $preferredDeviceId ??= $accountGroup?->publisher_device_id;
        $deviceStrategy = $preferredDeviceId !== null
            ? 'specified'
            : ($validated['device_strategy'] ?? 'auto');

        try {
            $result = $this->publishingCenter->createBatch(
                article: $article,
                platformIds: array_values(array_unique($validated['platform_ids'])),
                publishMode: $validated['publish_mode'],
                accountGroup: $accountGroup,
                requestedByAdminId: auth('admin')->id(),
                scheduledAt: $validated['scheduled_at'] ?? null,
                deviceStrategy: $deviceStrategy,
                preferredDeviceId: $preferredDeviceId,
                idempotencyKey: $validated['idempotency_key'],
            );
        } catch (Throwable $exception) {
            return back()->withInput()->withErrors('创建发布任务失败：'.$exception->getMessage());
        }

        $distribution = $result['distribution'];
        $summary = $result['preflight']['summary'] ?? [];
        $ready = (int) ($summary['ready'] ?? 0) + (int) ($summary['draft_only'] ?? 0);
        $blocked = max(0, (int) ($summary['target'] ?? 0) - $ready);

        return redirect()
            ->route('admin.publisher-assistant')
            ->with('message', "发布批次 #{$distribution->id} 已创建：{$ready} 个平台进入队列，{$blocked} 个平台等待登录、设备或适配能力。需要人工确认的平台不会自动点击最终发布。");
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
                if ((bool) config('publishing.center_v2_enabled', false)) {
                    $platformIds = $this->publisherPlatforms->activePlatforms()
                        ->filter(fn ($platform): bool => (string) $platform->support_level !== 'planned')
                        ->pluck('platform_id')
                        ->values()
                        ->all();
                    $accountGroup = PublisherAccountGroup::query()
                        ->where('status', 'active')
                        ->orderBy('id')
                        ->first();
                    $this->publishingCenter->createBatch(
                        article: $article,
                        platformIds: $platformIds,
                        publishMode: $accountGroup?->default_publish_mode ?: 'draft',
                        accountGroup: $accountGroup,
                        requestedByAdminId: auth('admin')->id(),
                    );
                } else {
                    $this->distributionOrchestrator->enqueueForArticle($article);
                }
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

        if ($device->paired_at !== null) {
            return $device->last_seen_at && $device->last_seen_at->gte(now()->subMinutes(2))
                ? 'online'
                : 'paired';
        }

        if ($device->last_seen_at && $device->last_seen_at->gte(now()->subMinutes(2))) {
            return 'online';
        }

        return 'offline';
    }
}
