<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentKeywordPack extends Model
{
    protected $table = 'tongzhuo_content_keyword_packs';
    protected $fillable = ['business_line_id', 'name', 'source', 'status', 'description', 'metadata', 'created_by_admin_id'];
    protected function casts(): array { return ['business_line_id' => 'integer', 'metadata' => 'array', 'created_by_admin_id' => 'integer']; }
    public function businessLine(): BelongsTo { return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id'); }
    public function keywords(): HasMany { return $this->hasMany(TongzhuoContentManagedKeyword::class, 'keyword_pack_id'); }
}
