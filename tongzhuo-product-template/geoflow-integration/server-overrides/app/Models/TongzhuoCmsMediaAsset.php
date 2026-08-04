<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoCmsMediaAsset extends Model
{
    protected $table = 'tongzhuo_cms_media_assets';

    protected $fillable = [
        'site_id',
        'disk',
        'path',
        'url',
        'type',
        'mime_type',
        'title',
        'alt_text',
        'size',
        'meta',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'size' => 'integer',
            'meta' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }
}
