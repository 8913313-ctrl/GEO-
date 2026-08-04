<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoGeoAnswerTest extends Model
{
    protected $table = 'tongzhuo_geo_answer_tests';

    protected $fillable = [
        'site_id',
        'opportunity_id',
        'service_line',
        'status',
        'verdict',
        'source',
        'platform',
        'surface',
        'prompt_id',
        'run_id',
        'model_version',
        'sampled_at',
        'mention',
        'recommendation',
        'rank',
        'citations',
        'competitor_mentions',
        'answer_accuracy',
        'sampling_notes',
        'question',
        'expected_answer',
        'observed_answer',
        'gap_summary',
        'evidence_sources',
        'metadata',
        'last_run_at',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'opportunity_id' => 'integer',
            'sampled_at' => 'datetime',
            'mention' => 'boolean',
            'recommendation' => 'boolean',
            'rank' => 'integer',
            'citations' => 'array',
            'competitor_mentions' => 'array',
            'answer_accuracy' => 'integer',
            'evidence_sources' => 'array',
            'metadata' => 'array',
            'last_run_at' => 'datetime',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoOpportunity::class, 'opportunity_id');
    }
}
