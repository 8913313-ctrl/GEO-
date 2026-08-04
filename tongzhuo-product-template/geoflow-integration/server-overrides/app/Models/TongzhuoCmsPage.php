<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoCmsPage extends Model
{
    protected $table = 'tongzhuo_cms_pages';

    protected $fillable = [
        'site_id',
        'slug',
        'path',
        'title',
        'navigation_label',
        'description',
        'template_key',
        'status',
        'sort_order',
        'seo',
        'structured_data',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'sort_order' => 'integer',
            'seo' => 'array',
            'structured_data' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(TongzhuoCmsPageBlock::class, 'page_id')->orderBy('sort_order');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(TongzhuoCmsPageVersion::class, 'page_id')->orderByDesc('version_number');
    }
}
