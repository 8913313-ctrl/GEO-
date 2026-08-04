<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TongzhuoCmsPageVersion extends Model
{
    protected $table = 'tongzhuo_cms_page_versions';

    protected $fillable = [
        'page_id',
        'version_number',
        'title',
        'status',
        'page_snapshot',
        'blocks_snapshot',
        'created_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'page_id' => 'integer',
            'version_number' => 'integer',
            'page_snapshot' => 'array',
            'blocks_snapshot' => 'array',
            'created_by_admin_id' => 'integer',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(TongzhuoCmsPage::class, 'page_id');
    }
}
