<?php

namespace App\Services\GeoFlow;

use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;

class WechatsyncManualPublisher implements DistributionPublisherInterface
{
    public function health(DistributionChannel $channel): array
    {
        $config = $channel->resolvedWechatSyncConfig();
        $isDesktopPublisher = $channel->isDesktopPublisher();

        return [
            'ok' => true,
            'channel_type' => $channel->channelType(),
            'mode' => $isDesktopPublisher ? 'desktop_agent_queue' : 'manual_package',
            'platforms' => $config['wechatsync_platforms'],
            'message' => $isDesktopPublisher
                ? '桐灼本地发布助手渠道可用，文章发布后会进入本地执行器队列。'
                : 'Wechatsync 手动发布包渠道可用，请在本地已登录浏览器环境执行发布。',
        ];
    }

    public function publish(ArticleDistribution $distribution, array $payload): array
    {
        return $this->packageResult($distribution, $payload, 'publish');
    }

    public function update(ArticleDistribution $distribution, array $payload): array
    {
        return $this->packageResult($distribution, $payload, 'update');
    }

    public function delete(ArticleDistribution $distribution): array
    {
        return [
            'deleted' => true,
            'remote_id' => 'local-publisher-'.$distribution->id,
            'remote_url' => null,
            'remote_meta' => [
                'local_publisher' => true,
                'package_available' => false,
                'deleted_at' => now()->toISOString(),
                'requires_manual_delete' => true,
            ],
        ];
    }

    public function syncSiteSettings(DistributionChannel $channel): array
    {
        return [
            'ok' => true,
            'channel_type' => $channel->channelType(),
            'mode' => $channel->isDesktopPublisher() ? 'desktop_agent_queue' : 'manual_package',
            'message' => '本地发布助手渠道不需要同步远程站点设置。',
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function packageResult(ArticleDistribution $distribution, array $payload, string $action): array
    {
        $distribution->loadMissing('channel');
        $channel = $distribution->channel;
        $config = $channel instanceof DistributionChannel
            ? $channel->resolvedWechatSyncConfig()
            : ['wechatsync_platforms' => []];
        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];
        $title = trim((string) ($article['title'] ?? ''));

        return [
            'remote_id' => $channel?->isDesktopPublisher() ? 'desktop-publisher-'.$distribution->id : 'wechatsync-package-'.$distribution->id,
            'remote_url' => null,
            'remote_meta' => [
                'local_publisher' => true,
                'desktop_publisher' => $channel?->isDesktopPublisher() ?? false,
                'wechatsync_manual' => $channel?->isWechatSyncManual() ?? false,
                'package_available' => $channel?->isWechatSyncManual() ?? false,
                'package_action' => $action,
                'package_generated_at' => now()->toISOString(),
                'article_title' => $title,
                'platforms' => $config['wechatsync_platforms'],
                'content_format' => 'markdown_and_html',
                'requires_local_browser' => true,
                'requires_manual_confirmation' => true,
                'requires_desktop_agent' => $channel?->isDesktopPublisher() ?? false,
            ],
        ];
    }
}

