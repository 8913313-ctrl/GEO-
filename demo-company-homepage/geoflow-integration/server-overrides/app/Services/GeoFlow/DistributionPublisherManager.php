<?php

namespace App\Services\GeoFlow;

use App\Models\DistributionChannel;
use RuntimeException;

class DistributionPublisherManager
{
    public function __construct(
        private readonly GeoFlowAgentPublisher $geoFlowAgentPublisher,
        private readonly WordPressRestPublisher $wordPressRestPublisher,
        private readonly WechatsyncManualPublisher $wechatsyncManualPublisher,
    ) {}

    public function forChannel(DistributionChannel $channel): DistributionPublisherInterface
    {
        return match ($channel->channelType()) {
            'geoflow_agent' => $this->geoFlowAgentPublisher,
            'wordpress_rest' => $this->wordPressRestPublisher,
            'desktop_publisher' => $this->wechatsyncManualPublisher,
            'wechatsync_manual' => $this->wechatsyncManualPublisher,
            default => throw new RuntimeException('不支持的分发渠道类型：'.(string) $channel->channel_type),
        };
    }
}
