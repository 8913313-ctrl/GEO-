<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublisherPlatformJob extends Model
{
    public const TERMINAL_STATUSES = ['draft_saved', 'published', 'failed', 'cancelled', 'skipped'];

    protected $fillable = [
        'article_distribution_id',
        'platform_id',
        'publisher_device_id',
        'publisher_platform_session_id',
        'profile_key',
        'publish_mode',
        'status',
        'progress_step',
        'progress_percent',
        'attempt_count',
        'max_attempts',
        'claimed_at',
        'lease_expires_at',
        'started_at',
        'last_progress_at',
        'finished_at',
        'next_retry_at',
        'remote_url',
        'error_category',
        'error_message',
        'next_operator_action',
        'payload_snapshot',
        'result',
    ];

    protected function casts(): array
    {
        return [
            'article_distribution_id' => 'integer',
            'publisher_device_id' => 'integer',
            'publisher_platform_session_id' => 'integer',
            'progress_percent' => 'integer',
            'attempt_count' => 'integer',
            'max_attempts' => 'integer',
            'claimed_at' => 'datetime',
            'lease_expires_at' => 'datetime',
            'started_at' => 'datetime',
            'last_progress_at' => 'datetime',
            'finished_at' => 'datetime',
            'next_retry_at' => 'datetime',
            'payload_snapshot' => 'array',
            'result' => 'array',
        ];
    }

    public function distribution(): BelongsTo
    {
        return $this->belongsTo(ArticleDistribution::class, 'article_distribution_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(PublisherDevice::class, 'publisher_device_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(PublisherPlatformSession::class, 'publisher_platform_session_id');
    }

    public function isTerminal(): bool
    {
        return in_array((string) $this->status, self::TERMINAL_STATUSES, true);
    }
}
