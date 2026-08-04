<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiGenerationRun extends Model
{
    protected $table = 'ai_generation_runs';

    protected $guarded = ['id'];

    protected $hidden = [
        'prompt_snapshot',
        'response_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'prompt_snapshot' => 'array',
            'output_contract_snapshot' => 'array',
            'response_snapshot' => 'array',
            'usage' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class, 'provider_id');
    }
}
