<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TongzhuoAccessAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'tongzhuo_access_audit_logs';

    protected $fillable = [
        'admin_user_id',
        'action',
        'resource_type',
        'resource_id',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected $casts = ['metadata' => 'array'];
}
