<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoGeoPlan extends Model
{
    protected $table = 'tongzhuo_geo_plans';

    protected $fillable = [
        'site_id',
        'audit_id',
        'title',
        'status',
        'source',
        'start_date',
        'end_date',
        'summary',
        'metrics',
        'metadata',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'audit_id' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'metrics' => 'array',
            'metadata' => 'array',
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

    public function items(): HasMany
    {
        return $this->hasMany(TongzhuoGeoPlanItem::class, 'plan_id')->orderBy('phase')->orderBy('sort_order')->orderBy('id');
    }
}
