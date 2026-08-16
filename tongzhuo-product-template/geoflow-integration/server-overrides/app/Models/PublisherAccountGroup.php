<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PublisherAccountGroup extends Model
{
    protected $fillable = [
        'publisher_device_id',
        'external_id',
        'name',
        'slug',
        'description',
        'default_publish_mode',
        'status',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'publisher_device_id' => 'integer',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(PublisherDevice::class, 'publisher_device_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PublisherAccountGroupItem::class);
    }
}
