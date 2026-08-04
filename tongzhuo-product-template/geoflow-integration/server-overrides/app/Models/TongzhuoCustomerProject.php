<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoCustomerProject extends Model
{
    protected $table = 'tongzhuo_customer_projects';

    protected $fillable = [
        'site_id',
        'name',
        'company_name',
        'status',
        'stage',
        'health_status',
        'contact_name',
        'contact_phone',
        'website_url',
        'geoflow_url',
        'service_lines',
        'endpoints',
        'delivery_profile',
        'next_action',
        'notes',
        'contract_started_at',
        'go_live_at',
        'last_reviewed_at',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'site_id' => 'integer',
            'service_lines' => 'array',
            'endpoints' => 'array',
            'delivery_profile' => 'array',
            'contract_started_at' => 'date',
            'go_live_at' => 'date',
            'last_reviewed_at' => 'datetime',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsSite::class, 'site_id');
    }
}
