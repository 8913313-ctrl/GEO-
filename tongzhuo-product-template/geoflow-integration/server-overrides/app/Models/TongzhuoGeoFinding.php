<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TongzhuoGeoFinding extends Model
{
    protected $table = 'tongzhuo_geo_findings';

    protected $fillable = ['audit_id', 'key', 'area', 'severity', 'status', 'title', 'description', 'suggestion', 'evidence'];

    protected function casts(): array
    {
        return ['audit_id' => 'integer', 'evidence' => 'array'];
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoAudit::class, 'audit_id');
    }

    public function task(): HasOne
    {
        return $this->hasOne(TongzhuoGeoTask::class, 'finding_id');
    }
}
