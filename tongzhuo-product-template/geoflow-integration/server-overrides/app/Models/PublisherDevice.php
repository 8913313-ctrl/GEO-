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
        'desired_state',
        'desired_state_version',
        'desired_state_updated_at',
        'applied_state_version',
        'local_override',
        'last_seen_at',
        'disabled_at',
    ];

    protected $casts = [
        'capabilities' => 'array',
        'meta' => 'array',
        'desired_state' => 'array',
        'desired_state_version' => 'integer',
        'desired_state_updated_at' => 'datetime',
        'applied_state_version' => 'integer',
        'local_override' => 'boolean',
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
