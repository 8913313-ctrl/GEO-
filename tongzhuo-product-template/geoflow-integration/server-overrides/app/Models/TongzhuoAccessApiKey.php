<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TongzhuoAccessApiKey extends Model
{
    protected $table = 'tongzhuo_access_api_keys';

    protected $fillable = [
        'name',
        'key_id',
        'secret_hash',
        'scopes',
        'created_by_admin_id',
        'last_used_at',
        'expires_at',
        'revoked_at',
    ];

    protected $hidden = ['secret_hash'];

    protected $casts = [
        'scopes' => 'array',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];
}
