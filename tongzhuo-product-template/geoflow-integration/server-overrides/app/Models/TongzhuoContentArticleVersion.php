<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoContentArticleVersion extends Model
{
    protected $table = 'tongzhuo_content_article_versions';
    protected $fillable = ['article_id', 'content_plan_item_id', 'generation_run_id', 'version_number', 'status', 'title', 'content', 'structured_content', 'citation_snapshot', 'quality_result', 'created_by_admin_id'];
    protected function casts(): array { return ['article_id' => 'integer', 'content_plan_item_id' => 'integer', 'generation_run_id' => 'integer', 'version_number' => 'integer', 'structured_content' => 'array', 'citation_snapshot' => 'array', 'quality_result' => 'array', 'created_by_admin_id' => 'integer']; }
    public function item(): BelongsTo { return $this->belongsTo(TongzhuoContentPlanItem::class, 'content_plan_item_id'); }
    public function generationRun(): BelongsTo { return $this->belongsTo(TongzhuoContentGenerationRun::class, 'generation_run_id'); }
}
