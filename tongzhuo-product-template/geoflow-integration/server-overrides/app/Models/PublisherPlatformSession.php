<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PublisherPlatformSession extends Model
{
    protected $fillable = [
        'publisher_device_id',
        'device_id',
        'platform_id',
        'profile_key',
        'account_name',
        'login_state',
        'last_verified_at',
        'last_seen_at',
        'last_error_message',
        'auto_allowed',
        'capabilities',
        'support_level',
        'last_probe_at',
        'adapter_version',
        'meta',
    ];

    protected $casts = [
        'last_verified_at' => 'datetime',
        'last_seen_at' => 'datetime',
            'auto_allowed' => 'boolean',
            'capabilities' => 'array',
            'last_probe_at' => 'datetime',
            'meta' => 'array',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(PublisherDevice::class, 'publisher_device_id');
    }

    public function platformJobs(): HasMany
    {
        return $this->hasMany(PublisherPlatformJob::class, 'publisher_platform_session_id');
    }
}
