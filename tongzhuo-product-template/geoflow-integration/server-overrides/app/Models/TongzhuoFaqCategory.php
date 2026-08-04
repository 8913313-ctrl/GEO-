<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoFaqCategory extends Model
{
    protected $table = 'tongzhuo_faq_categories';

    protected $fillable = ['site_id', 'name', 'slug', 'description', 'sort_order', 'is_visible'];

    protected function casts(): array
    {
        return ['site_id' => 'integer', 'sort_order' => 'integer', 'is_visible' => 'boolean'];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TongzhuoFaqItem::class, 'category_id')->orderBy('sort_order')->orderBy('id');
    }
}
