<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoCmsNavigationItem extends Model
{
    protected $table = 'tongzhuo_cms_navigation_items';

    protected $fillable = [
        'site_id',
        'page_id',
        'area',
        'label',
        'url',
        'sort_order',
        'is_visible',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'page_id' => 'integer',
            'sort_order' => 'integer',
            'is_visible' => 'boolean',
            'settings' => 'array',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsPage::class, 'page_id');
    }
}
