<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoFaqItem extends Model
{
    protected $table = 'tongzhuo_faq_items';

    protected $fillable = ['site_id', 'category_id', 'question', 'slug', 'answer', 'excerpt', 'seo', 'sort_order', 'status', 'published_at'];

    protected function casts(): array
    {
        return ['site_id' => 'integer', 'category_id' => 'integer', 'seo' => 'array', 'sort_order' => 'integer', 'published_at' => 'datetime'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TongzhuoFaqCategory::class, 'category_id');
    }
}
