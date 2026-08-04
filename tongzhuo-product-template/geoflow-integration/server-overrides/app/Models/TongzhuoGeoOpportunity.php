<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoGeoOpportunity extends Model
{
    protected $table = 'tongzhuo_geo_opportunities';

    protected $fillable = [
        'site_id',
        'audit_id',
        'task_id',
        'service_line',
        'intent',
        'status',
        'priority',
        'keyword',
        'cluster_name',
        'question',
        'parent_question',
        'follow_up_questions',
        'query_rewrites',
        'evidence_query',
        'mapped_assets',
        'competitor_notes',
        'coverage_status',
        'recommended_output',
        'answer_angle',
        'evidence',
        'metadata',
        'promoted_at',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'audit_id' => 'integer',
            'task_id' => 'integer',
            'follow_up_questions' => 'array',
            'query_rewrites' => 'array',
            'mapped_assets' => 'array',
            'competitor_notes' => 'array',
            'evidence' => 'array',
            'metadata' => 'array',
            'promoted_at' => 'datetime',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoAudit::class, 'audit_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoTask::class, 'task_id');
    }
}
