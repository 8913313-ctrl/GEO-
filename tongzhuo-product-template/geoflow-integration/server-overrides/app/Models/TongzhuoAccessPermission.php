<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TongzhuoAccessPermission extends Model
{
    protected $table = 'tongzhuo_access_permissions';

    protected $fillable = [
        'name',
        'slug',
        'group_key',
        'description',
        'is_system',
    ];

    protected $casts = ['is_system' => 'boolean'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(
            TongzhuoAccessRole::class,
            'tongzhuo_access_role_permissions',
            'permission_id',
            'role_id'
        )->withTimestamps();
    }
}
