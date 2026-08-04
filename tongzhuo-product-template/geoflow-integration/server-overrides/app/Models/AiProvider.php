<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiProvider extends Model
{
    protected $table = 'ai_providers';

    protected $fillable = [
        'name',
        'provider',
        'model_id',
        'model_type',
        'base_url',
        'chat_url',
        'embeddings_url',
        'status',
        'is_default',
        'daily_limit',
        'used_today',
        'total_used',
        'last_used_at',
        'last_tested_at',
        'last_error_code',
        'last_error_message',
        'metadata',
        'created_by_admin_id',
    ];

    /** Never expose the encrypted value through model serialization. */
    protected $hidden = [
        'api_key',
    ];

    protected function casts(): array
    {
        return [
            // Laravel's encrypted cast uses APP_KEY and transparently
            // rotates the value when the model is next persisted.
            'api_key' => 'encrypted',
            'is_default' => 'boolean',
            'daily_limit' => 'integer',
            'used_today' => 'integer',
            'total_used' => 'integer',
            'last_used_at' => 'datetime',
            'last_tested_at' => 'datetime',
            'metadata' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function generationRuns(): HasMany
    {
        return $this->hasMany(AiGenerationRun::class, 'provider_id');
    }

    public function setApiKeyValue(?string $key): void
    {
        $key = trim((string) $key);
        if ($key === '') {
            return;
        }

        $this->api_key = $key;
        $this->api_key_fingerprint = hash('sha256', $key);
    }

    public function clearApiKey(): void
    {
        $this->api_key = null;
        $this->api_key_fingerprint = null;
    }

    public function hasApiKey(): bool
    {
        return filled($this->api_key);
    }

    /** Only the gateway should call this; it is never included in API output. */
    public function apiKeyValue(): ?string
    {
        $value = $this->api_key;

        return filled($value) ? (string) $value : null;
    }

    /** @return array<string,mixed> */
    public function safePayload(): array
    {
        $metadata = is_array($this->metadata) ? $this->metadata : [];
        if (is_array($metadata['headers'] ?? null)) {
            $metadata['headers'] = array_fill_keys(array_keys($metadata['headers']), '[configured]');
        }

        return [
            'id' => (int) $this->id,
            'name' => (string) $this->name,
            'provider' => (string) $this->provider,
            'model_id' => (string) $this->model_id,
            'model_type' => (string) $this->model_type,
            'base_url' => $this->base_url,
            'chat_url' => $this->chat_url,
            'embeddings_url' => $this->embeddings_url,
            'status' => (string) $this->status,
            'is_default' => (bool) $this->is_default,
            'daily_limit' => $this->daily_limit,
            'used_today' => (int) $this->used_today,
            'total_used' => (int) $this->total_used,
            'last_used_at' => $this->last_used_at?->toIso8601String(),
            'last_tested_at' => $this->last_tested_at?->toIso8601String(),
            'last_error_code' => $this->last_error_code,
            'last_error_message' => $this->last_error_message,
            'api_key_configured' => $this->hasApiKey(),
            'api_key_fingerprint' => $this->api_key_fingerprint ? substr($this->api_key_fingerprint, 0, 12) : null,
            'metadata' => $metadata,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
