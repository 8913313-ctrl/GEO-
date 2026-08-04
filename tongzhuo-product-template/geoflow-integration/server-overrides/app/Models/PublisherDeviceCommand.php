<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublisherDeviceCommand extends Model
{
    protected $fillable = [
        'publisher_device_id',
        'command_type',
        'status',
        'payload',
        'result',
        'expires_at',
        'claimed_at',
        'completed_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'result' => 'array',
            'expires_at' => 'datetime',
            'claimed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(PublisherDevice::class, 'publisher_device_id');
    }
}
