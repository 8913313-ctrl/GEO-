<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentBusinessLine extends Model
{
    protected $table = 'tongzhuo_content_business_lines';

    protected $fillable = ['site_id', 'name', 'slug', 'description', 'status', 'sort_order', 'settings', 'created_by_admin_id'];

    protected function casts(): array
    {
        return ['site_id' => 'integer', 'sort_order' => 'integer', 'settings' => 'array', 'created_by_admin_id' => 'integer'];
    }

    public function keywordPacks(): HasMany { return $this->hasMany(TongzhuoContentKeywordPack::class, 'business_line_id'); }
    public function keywords(): HasMany { return $this->hasMany(TongzhuoContentManagedKeyword::class, 'business_line_id'); }
    public function questions(): HasMany { return $this->hasMany(TongzhuoContentQuestionLibraryItem::class, 'business_line_id'); }
    public function topics(): HasMany { return $this->hasMany(TongzhuoContentTopicCandidate::class, 'business_line_id'); }
    public function plans(): HasMany { return $this->hasMany(TongzhuoContentPlan::class, 'business_line_id'); }
}
