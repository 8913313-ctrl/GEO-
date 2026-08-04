<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublisherAccountGroupItem extends Model
{
    protected $fillable = [
        'publisher_account_group_id',
        'platform_id',
        'publisher_device_id',
        'publisher_platform_session_id',
        'profile_key',
        'publish_mode',
        'enabled',
        'sort_order',
        'overrides',
    ];

    protected function casts(): array
    {
        return [
            'publisher_account_group_id' => 'integer',
            'publisher_device_id' => 'integer',
            'publisher_platform_session_id' => 'integer',
            'enabled' => 'boolean',
            'sort_order' => 'integer',
            'overrides' => 'array',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(PublisherAccountGroup::class, 'publisher_account_group_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(PublisherDevice::class, 'publisher_device_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(PublisherPlatformSession::class, 'publisher_platform_session_id');
    }
}
