<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentPlan extends Model
{
    protected $table = 'tongzhuo_content_plans';
    protected $fillable = ['business_line_id', 'title', 'status', 'start_date', 'end_date', 'cadence', 'summary', 'settings', 'metadata', 'created_by_admin_id'];
    protected function casts(): array { return ['business_line_id' => 'integer', 'start_date' => 'date', 'end_date' => 'date', 'settings' => 'array', 'metadata' => 'array', 'created_by_admin_id' => 'integer']; }
    public function businessLine(): BelongsTo { return $this->belongsTo(TongzhuoContentBusinessLine::class, 'business_line_id'); }
    public function items(): HasMany { return $this->hasMany(TongzhuoContentPlanItem::class, 'content_plan_id')->orderBy('sort_order')->orderBy('id'); }
}
