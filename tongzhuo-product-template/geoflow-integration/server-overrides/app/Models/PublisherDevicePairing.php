<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublisherDevicePairing extends Model
{
    protected $fillable = [
        'pairing_code',
        'status',
        'requested_by',
        'issued_at',
        'expires_at',
        'claimed_at',
        'claimed_device_id',
        'meta',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
        'expires_at' => 'datetime',
        'claimed_at' => 'datetime',
        'meta' => 'array',
    ];
}
