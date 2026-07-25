<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublisherDevice extends Model
{
    protected $fillable = [
        'device_id',
        'name',
        'public_key',
        'status',
        'capabilities',
        'meta',
        'last_seen_at',
        'disabled_at',
    ];

    protected $casts = [
        'capabilities' => 'array',
        'meta' => 'array',
        'last_seen_at' => 'datetime',
        'disabled_at' => 'datetime',
    ];
}
