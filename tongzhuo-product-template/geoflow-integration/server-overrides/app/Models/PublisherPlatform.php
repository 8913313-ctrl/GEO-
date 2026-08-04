<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublisherPlatform extends Model
{
    protected $fillable = [
        'platform_id',
        'name',
        'group_key',
        'sort_order',
        'status',
        'support_level',
        'supports_draft',
        'supports_direct_publish',
        'supports_scheduled',
        'supports_images',
        'supports_cover',
        'content_formats',
        'limits',
        'login_url',
        'editor_url',
        'adapter_min_version',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'supports_draft' => 'boolean',
            'supports_direct_publish' => 'boolean',
            'supports_scheduled' => 'boolean',
            'supports_images' => 'boolean',
            'supports_cover' => 'boolean',
            'content_formats' => 'array',
            'limits' => 'array',
            'meta' => 'array',
        ];
    }
}
