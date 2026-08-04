<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoRagCitation extends Model
{
    protected $table = 'tongzhuo_rag_citations';

    protected $fillable = [
        'rag_run_id',
        'document_id',
        'chunk_id',
        'citation_key',
        'score',
        'vector_score',
        'keyword_score',
        'excerpt',
        'locator',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'rag_run_id' => 'integer',
            'document_id' => 'integer',
            'chunk_id' => 'integer',
            'score' => 'float',
            'vector_score' => 'float',
            'keyword_score' => 'float',
            'metadata' => 'array',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(TongzhuoRagRun::class, 'rag_run_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(TongzhuoKnowledgeDocument::class, 'document_id');
    }

    public function chunk(): BelongsTo
    {
        return $this->belongsTo(TongzhuoKnowledgeChunk::class, 'chunk_id');
    }
}
