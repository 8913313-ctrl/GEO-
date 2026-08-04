<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoContentWritingAgent extends Model
{
    protected $table = 'tongzhuo_content_writing_agents';
    protected $fillable = ['name', 'slug', 'description', 'system_prompt', 'output_contract', 'style', 'strict_knowledge', 'is_default', 'enabled', 'settings', 'created_by_admin_id'];
    protected function casts(): array { return ['output_contract' => 'array', 'strict_knowledge' => 'boolean', 'is_default' => 'boolean', 'enabled' => 'boolean', 'settings' => 'array', 'created_by_admin_id' => 'integer']; }
    public function planItems(): HasMany { return $this->hasMany(TongzhuoContentPlanItem::class, 'writing_agent_id'); }
    public function generationRuns(): HasMany { return $this->hasMany(TongzhuoContentGenerationRun::class, 'writing_agent_id'); }
}
