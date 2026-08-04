<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ArticleDistribution extends Model
{
    protected $fillable = [
        'article_id',
        'distribution_channel_id',
        'publisher_account_group_id',
        'action',
        'publish_mode',
        'assigned_device_strategy',
        'requested_by_admin_id',
        'status',
        'remote_id',
        'remote_url',
        'remote_meta',
        'idempotency_key',
        'attempt_count',
        'next_retry_at',
        'scheduled_at',
        'started_at',
        'completed_at',
        'last_attempt_at',
        'last_error_message',
        'payload_hash',
        'publisher_summary',
    ];

    protected function casts(): array
    {
        return [
            'article_id' => 'integer',
            'distribution_channel_id' => 'integer',
            'publisher_account_group_id' => 'integer',
            'requested_by_admin_id' => 'integer',
            'attempt_count' => 'integer',
            'next_retry_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'last_attempt_at' => 'datetime',
            'remote_meta' => 'array',
            'publisher_summary' => 'array',
        ];
    }

    public function wordpressPostId(): ?int
    {
        if ($this->remote_id !== null && ctype_digit((string) $this->remote_id)) {
            return (int) $this->remote_id;
        }

        $meta = is_array($this->remote_meta) ? $this->remote_meta : [];
        $postId = $meta['wordpress_post_id'] ?? null;

        return is_numeric($postId) ? (int) $postId : null;
    }

    /**
     * @return array<string,mixed>
     */
    public function publisherAssistantMeta(): array
    {
        $meta = is_array($this->remote_meta) ? $this->remote_meta : [];
        $assistant = $meta['publisher_assistant'] ?? [];

        return is_array($assistant) ? $assistant : [];
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    public function publisherPlatformResults(): array
    {
        $results = $this->publisherAssistantMeta()['platform_results'] ?? [];
        if (! is_array($results)) {
            return [];
        }

        $normalized = [];
        foreach ($results as $platform => $result) {
            if (! is_array($result)) {
                continue;
            }
            $platformId = is_string($platform) ? $platform : (string) ($result['platform'] ?? '');
            if ($platformId === '') {
                continue;
            }
            $result['platform'] = $platformId;
            $normalized[$platformId] = $result;
        }

        return $normalized;
    }

    /**
     * @return array<string,mixed>
     */
    public function publisherStateSummary(): array
    {
        $summary = $this->publisherAssistantMeta()['state_summary'] ?? [];

        return is_array($summary) ? $summary : [];
    }

    public function publisherNextOperatorAction(): string
    {
        return trim((string) ($this->publisherAssistantMeta()['next_operator_action'] ?? ''));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function publisherOperatorConfirmations(): array
    {
        $confirmations = $this->publisherAssistantMeta()['operator_confirmations'] ?? [];

        return is_array($confirmations) ? array_values(array_filter($confirmations, 'is_array')) : [];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'article_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(DistributionChannel::class, 'distribution_channel_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(DistributionLog::class, 'article_distribution_id');
    }

    public function publisherPlatformJobs(): HasMany
    {
        return $this->hasMany(PublisherPlatformJob::class, 'article_distribution_id');
    }

    public function publisherAccountGroup(): BelongsTo
    {
        return $this->belongsTo(PublisherAccountGroup::class, 'publisher_account_group_id');
    }
}
