<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoGeoAudit extends Model
{
    protected $table = 'tongzhuo_geo_audits';

    protected $fillable = ['site_id', 'url', 'status', 'score', 'summary', 'error_message', 'started_at', 'completed_at', 'created_by_admin_id'];

    protected function casts(): array
    {
        return ['site_id' => 'integer', 'score' => 'integer', 'summary' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'created_by_admin_id' => 'integer'];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function findings(): HasMany
    {
        return $this->hasMany(TongzhuoGeoFinding::class, 'audit_id')->orderByRaw("CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END")->orderBy('id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(TongzhuoGeoTask::class, 'audit_id');
    }
}
