<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoRagRun extends Model
{
    protected $table = 'tongzhuo_rag_runs';

    protected $fillable = [
        'business_line_id',
        'embedding_provider_id',
        'query',
        'retrieval_mode',
        'top_k',
        'filters',
        'result_snapshot',
        'latency_ms',
        'request_id',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'business_line_id' => 'integer',
            'embedding_provider_id' => 'integer',
            'top_k' => 'integer',
            'filters' => 'array',
            'result_snapshot' => 'array',
            'latency_ms' => 'integer',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function businessLine(): BelongsTo
    {
        return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id');
    }

    public function citations(): HasMany
    {
        return $this->hasMany(TongzhuoRagCitation::class, 'rag_run_id')->orderBy('id');
    }
}
