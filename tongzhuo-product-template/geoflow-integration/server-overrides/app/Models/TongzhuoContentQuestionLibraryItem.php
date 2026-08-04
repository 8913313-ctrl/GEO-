<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentQuestionLibraryItem extends Model
{
    protected $table = 'tongzhuo_content_question_library';
    protected $fillable = ['business_line_id', 'managed_keyword_id', 'question_hash', 'question', 'intent', 'decision_stage', 'cluster_name', 'follow_up_questions', 'query_rewrites', 'evidence_requirements', 'target_content_types', 'status', 'priority', 'coverage_status', 'source', 'metadata', 'archived_at', 'created_by_admin_id'];
    protected function casts(): array { return ['business_line_id' => 'integer', 'managed_keyword_id' => 'integer', 'follow_up_questions' => 'array', 'query_rewrites' => 'array', 'evidence_requirements' => 'array', 'target_content_types' => 'array', 'metadata' => 'array', 'archived_at' => 'datetime', 'created_by_admin_id' => 'integer']; }
    protected static function booted(): void
    {
        static::saving(function (self $model): void {
            $value = preg_replace('/\s+/u', '', mb_strtolower(trim((string) $model->question))) ?: trim((string) $model->question);
            $model->question_hash = $value === '' ? null : hash('sha256', $value);
        });
    }
    public function businessLine(): BelongsTo { return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id'); }
    public function keyword(): BelongsTo { return $this->belongsTo(TongzhuoContentManagedKeyword::class, 'managed_keyword_id'); }
    public function topics(): HasMany { return $this->hasMany(TongzhuoContentTopicCandidate::class, 'question_library_item_id'); }
}
