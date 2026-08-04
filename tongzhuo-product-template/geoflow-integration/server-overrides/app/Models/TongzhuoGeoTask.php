<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoGeoTask extends Model
{
    protected $table = 'tongzhuo_geo_tasks';

    protected $fillable = ['site_id', 'audit_id', 'finding_id', 'type', 'priority', 'status', 'title', 'description', 'content_brief', 'due_at', 'assigned_to_admin_id'];

    protected function casts(): array
    {
        return ['site_id' => 'integer', 'audit_id' => 'integer', 'finding_id' => 'integer', 'content_brief' => 'array', 'due_at' => 'datetime', 'assigned_to_admin_id' => 'integer'];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoAudit::class, 'audit_id');
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(TongzhuoGeoFinding::class, 'finding_id');
    }
}
