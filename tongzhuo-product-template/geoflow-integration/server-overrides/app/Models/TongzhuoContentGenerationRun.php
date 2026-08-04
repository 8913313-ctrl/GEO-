<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentGenerationRun extends Model
{
    protected $table = 'tongzhuo_content_generation_runs';
    protected $fillable = ['content_plan_item_id', 'article_id', 'writing_agent_id', 'status', 'provider', 'model', 'prompt_snapshot', 'brief_snapshot', 'knowledge_scope', 'retrieval_snapshot', 'citation_snapshot', 'usage', 'error_message', 'started_at', 'completed_at', 'created_by_admin_id'];
    protected function casts(): array { return ['content_plan_item_id' => 'integer', 'article_id' => 'integer', 'writing_agent_id' => 'integer', 'brief_snapshot' => 'array', 'knowledge_scope' => 'array', 'retrieval_snapshot' => 'array', 'citation_snapshot' => 'array', 'usage' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'created_by_admin_id' => 'integer']; }
    public function item(): BelongsTo { return $this->belongsTo(TongzhuoContentPlanItem::class, 'content_plan_item_id'); }
    public function agent(): BelongsTo { return $this->belongsTo(TongzhuoContentWritingAgent::class, 'writing_agent_id'); }
    public function citations(): HasMany { return $this->hasMany(TongzhuoContentArticleCitation::class, 'generation_run_id'); }
}
