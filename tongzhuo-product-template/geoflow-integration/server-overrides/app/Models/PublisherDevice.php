<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PublisherDevice extends Model
{
    protected $fillable = [
        'device_id',
        'name',
        'public_key',
        'status',
        'connection_mode',
        'pairing_code',
        'pairing_issued_at',
        'pairing_expires_at',
        'paired_at',
        'capabilities',
        'meta',
        'last_seen_at',
        'disabled_at',
    ];

    protected $casts = [
        'capabilities' => 'array',
        'meta' => 'array',
        'pairing_issued_at' => 'datetime',
        'pairing_expires_at' => 'datetime',
        'paired_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'disabled_at' => 'datetime',
    ];

    public function platformSessions(): HasMany
    {
        return $this->hasMany(PublisherPlatformSession::class);
    }

    public function commands(): HasMany
    {
        return $this->hasMany(PublisherDeviceCommand::class);
    }

    public function platformJobs(): HasMany
    {
        return $this->hasMany(PublisherPlatformJob::class);
    }
}
