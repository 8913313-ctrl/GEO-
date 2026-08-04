<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoContentArticleCitation extends Model
{
    protected $table = 'tongzhuo_content_article_citations';
    protected $fillable = ['article_id', 'generation_run_id', 'citation_key', 'source_type', 'source_id', 'source_title', 'source_url', 'quote', 'locator', 'confidence', 'metadata'];
    protected function casts(): array { return ['article_id' => 'integer', 'generation_run_id' => 'integer', 'source_id' => 'integer', 'metadata' => 'array']; }
    public function generationRun(): BelongsTo { return $this->belongsTo(TongzhuoContentGenerationRun::class, 'generation_run_id'); }
}
