<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentManagedKeyword extends Model
{
    protected $table = 'tongzhuo_content_managed_keywords';
    protected $fillable = ['business_line_id', 'keyword_pack_id', 'keyword', 'normalized_keyword', 'status', 'intent', 'cluster_name', 'priority', 'score', 'dimensions', 'metadata', 'archived_at', 'created_by_admin_id'];
    protected function casts(): array { return ['business_line_id' => 'integer', 'keyword_pack_id' => 'integer', 'score' => 'integer', 'dimensions' => 'array', 'metadata' => 'array', 'archived_at' => 'datetime', 'created_by_admin_id' => 'integer']; }
    public function businessLine(): BelongsTo { return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id'); }
    public function pack(): BelongsTo { return $this->belongsTo(TongzhuoContentKeywordPack::class, 'keyword_pack_id'); }
    public function questions(): HasMany { return $this->hasMany(TongzhuoContentQuestionLibraryItem::class, 'managed_keyword_id'); }
}
