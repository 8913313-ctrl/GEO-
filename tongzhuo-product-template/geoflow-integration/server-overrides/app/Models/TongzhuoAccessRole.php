<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TongzhuoAccessRole extends Model
{
    protected $table = 'tongzhuo_access_roles';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_system',
        'is_active',
        'created_by_admin_id',
    ];

    protected $casts = [
        'is_system' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            TongzhuoAccessPermission::class,
            'tongzhuo_access_role_permissions',
            'role_id',
            'permission_id'
        )->withTimestamps();
    }
}
