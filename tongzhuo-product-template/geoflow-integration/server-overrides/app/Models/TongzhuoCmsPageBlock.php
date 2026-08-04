<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoCmsPageBlock extends Model
{
    protected $table = 'tongzhuo_cms_page_blocks';

    protected $fillable = [
        'page_id',
        'block_key',
        'type',
        'label',
        'sort_order',
        'is_visible',
        'content',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'page_id' => 'integer',
            'sort_order' => 'integer',
            'is_visible' => 'boolean',
            'content' => 'array',
            'settings' => 'array',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsPage::class, 'page_id');
    }
}
