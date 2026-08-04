<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoFactCard extends Model
{
    protected $table = 'tongzhuo_fact_cards';

    protected $fillable = [
        'site_id',
        'fact_type',
        'status',
        'confidence_level',
        'title',
        'fact_text',
        'source_title',
        'source_url',
        'source_updated_at',
        'service_lines',
        'usage_targets',
        'forbidden_phrases',
        'metadata',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'source_updated_at' => 'date',
            'service_lines' => 'array',
            'usage_targets' => 'array',
            'forbidden_phrases' => 'array',
            'metadata' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }
}
