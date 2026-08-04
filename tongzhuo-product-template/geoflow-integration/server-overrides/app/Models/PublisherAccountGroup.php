<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PublisherAccountGroup extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'default_publish_mode',
        'status',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'created_by_admin_id' => 'integer',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PublisherAccountGroupItem::class);
    }
}
