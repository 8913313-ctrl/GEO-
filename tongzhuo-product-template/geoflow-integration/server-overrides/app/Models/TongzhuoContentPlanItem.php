<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentPlanItem extends Model
{
    protected $table = 'tongzhuo_content_plan_items';
    protected $fillable = ['content_plan_id', 'topic_candidate_id', 'question_library_item_id', 'article_id', 'writing_agent_id', 'title', 'output_type', 'status', 'review_status', 'priority', 'brief', 'knowledge_scope', 'scheduled_at', 'started_at', 'completed_at', 'reviewed_at', 'reviewed_by_admin_id', 'sort_order', 'metadata'];
    protected function casts(): array { return ['content_plan_id' => 'integer', 'topic_candidate_id' => 'integer', 'question_library_item_id' => 'integer', 'article_id' => 'integer', 'writing_agent_id' => 'integer', 'brief' => 'array', 'knowledge_scope' => 'array', 'scheduled_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'reviewed_at' => 'datetime', 'reviewed_by_admin_id' => 'integer', 'sort_order' => 'integer', 'metadata' => 'array']; }
    public function plan(): BelongsTo { return $this->belongsTo(TongzhuoContentPlan::class, 'content_plan_id'); }
    public function topic(): BelongsTo { return $this->belongsTo(TongzhuoContentTopicCandidate::class, 'topic_candidate_id'); }
    public function question(): BelongsTo { return $this->belongsTo(TongzhuoContentQuestionLibraryItem::class, 'question_library_item_id'); }
    public function agent(): BelongsTo { return $this->belongsTo(TongzhuoContentWritingAgent::class, 'writing_agent_id'); }
    public function generationRuns(): HasMany { return $this->hasMany(TongzhuoContentGenerationRun::class, 'content_plan_item_id'); }
}
