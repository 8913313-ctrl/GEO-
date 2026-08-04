<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoKnowledgeChunk extends Model
{
    protected $table = 'tongzhuo_knowledge_chunks';

    protected $fillable = [
        'document_id',
        'document_version',
        'ordinal',
        'heading',
        'content',
        'content_hash',
        'character_count',
        'token_count',
        'locator',
        'embedding_provider_id',
        'embedding_model',
        'embedding_dimensions',
        'embedding_json',
        'embedded_at',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'document_id' => 'integer',
            'document_version' => 'integer',
            'ordinal' => 'integer',
            'character_count' => 'integer',
            'token_count' => 'integer',
            'embedding_provider_id' => 'integer',
            'embedding_dimensions' => 'integer',
            'embedding_json' => 'array',
            'embedded_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(TongzhuoKnowledgeDocument::class, 'document_id');
    }

    public function embeddingProvider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class, 'embedding_provider_id');
    }
}
