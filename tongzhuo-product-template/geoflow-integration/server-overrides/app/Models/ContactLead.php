<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactLead extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'company',
        'service',
        'website',
        'message',
        'source_url',
        'status',
        'note',
        'ip_address',
        'user_agent',
        'contacted_at',
    ];

    protected function casts(): array
    {
        return [
            'contacted_at' => 'datetime',
        ];
    }
}
