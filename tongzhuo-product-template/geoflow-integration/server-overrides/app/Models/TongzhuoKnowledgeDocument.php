<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoKnowledgeDocument extends Model
{
    protected $table = 'tongzhuo_knowledge_documents';

    protected $fillable = [
        'site_id',
        'business_line_id',
        'title',
        'description',
        'source_type',
        'source_format',
        'source_url',
        'source_path',
        'mime_type',
        'content',
        'content_hash',
        'version',
        'language',
        'visibility',
        'review_status',
        'status',
        'reviewed_by_admin_id',
        'reviewed_at',
        'indexed_at',
        'index_error',
        'metadata',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'business_line_id' => 'integer',
            'version' => 'integer',
            'reviewed_by_admin_id' => 'integer',
            'reviewed_at' => 'datetime',
            'indexed_at' => 'datetime',
            'metadata' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function businessLine(): BelongsTo
    {
        return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id');
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(TongzhuoKnowledgeChunk::class, 'document_id')->orderBy('ordinal');
    }
}
