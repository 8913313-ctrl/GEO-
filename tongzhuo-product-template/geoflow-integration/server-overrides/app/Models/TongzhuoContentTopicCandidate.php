<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentTopicCandidate extends Model
{
    protected $table = 'tongzhuo_content_topic_candidates';
    protected $fillable = ['business_line_id', 'question_library_item_id', 'topic_hash', 'title', 'primary_question', 'intent', 'decision_stage', 'cluster_name', 'follow_up_questions', 'query_rewrites', 'proof_points', 'evidence_types', 'target_content_types', 'audience_boundary', 'target_site_section', 'output_type', 'status', 'priority', 'coverage_status', 'brief', 'metadata', 'archived_at', 'created_by_admin_id'];
    protected function casts(): array { return ['business_line_id' => 'integer', 'question_library_item_id' => 'integer', 'follow_up_questions' => 'array', 'query_rewrites' => 'array', 'proof_points' => 'array', 'evidence_types' => 'array', 'target_content_types' => 'array', 'brief' => 'array', 'metadata' => 'array', 'archived_at' => 'datetime', 'created_by_admin_id' => 'integer']; }
    protected static function booted(): void
    {
        static::saving(function (self $model): void {
            $source = $model->question_library_item_id !== null
                ? 'question:'.(int) $model->question_library_item_id
                : 'question:'.(preg_replace('/\s+/u', '', mb_strtolower(trim((string) $model->primary_question))) ?: trim((string) $model->primary_question));
            $title = preg_replace('/\s+/u', '', mb_strtolower(trim((string) $model->title))) ?: trim((string) $model->title);
            $model->topic_hash = hash('sha256', $source.'|title:'.$title);
        });
    }
    public function businessLine(): BelongsTo { return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id'); }
    public function question(): BelongsTo { return $this->belongsTo(TongzhuoContentQuestionLibraryItem::class, 'question_library_item_id'); }
    public function planItems(): HasMany { return $this->hasMany(TongzhuoContentPlanItem::class, 'topic_candidate_id'); }
}
