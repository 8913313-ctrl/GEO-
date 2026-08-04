<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoGeoPlanItem extends Model
{
    protected $table = 'tongzhuo_geo_plan_items';

    protected $fillable = [
        'plan_id',
        'task_id',
        'opportunity_id',
        'phase',
        'workstream',
        'status',
        'priority',
        'title',
        'description',
        'expected_output',
        'evidence_source',
        'current_question',
        'owner_name',
        'deliverable',
        'acceptance_metric',
        'resample_date',
        'sort_order',
        'evidence',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'plan_id' => 'integer',
            'task_id' => 'integer',
            'opportunity_id' => 'integer',
            'sort_order' => 'integer',
            'resample_date' => 'date',
            'evidence' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoPlan::class, 'plan_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoTask::class, 'task_id');
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoOpportunity::class, 'opportunity_id');
    }
}
