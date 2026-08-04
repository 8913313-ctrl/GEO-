<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TongzhuoCmsSite extends Model
{
    protected $table = 'tongzhuo_cms_sites';

    protected $fillable = [
        'name',
        'brand_name',
        'domain',
        'template_key',
        'status',
        'settings',
        'seo_defaults',
        'ai_crawl_settings',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'seo_defaults' => 'array',
            'ai_crawl_settings' => 'array',
        ];
    }

    public function pages(): HasMany
    {
        return $this->hasMany(TongzhuoCmsPage::class, 'site_id');
    }

    public function navigationItems(): HasMany
    {
        return $this->hasMany(TongzhuoCmsNavigationItem::class, 'site_id');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(TongzhuoCmsMediaAsset::class, 'site_id');
    }

    public function faqCategories(): HasMany
    {
        return $this->hasMany(TongzhuoFaqCategory::class, 'site_id');
    }

    public function geoAudits(): HasMany
    {
        return $this->hasMany(TongzhuoGeoAudit::class, 'site_id');
    }

    public function geoTasks(): HasMany
    {
        return $this->hasMany(TongzhuoGeoTask::class, 'site_id');
    }

    public function geoOpportunities(): HasMany
    {
        return $this->hasMany(TongzhuoGeoOpportunity::class, 'site_id');
    }

    public function factCards(): HasMany
    {
        return $this->hasMany(TongzhuoFactCard::class, 'site_id');
    }

    public function geoPlans(): HasMany
    {
        return $this->hasMany(TongzhuoGeoPlan::class, 'site_id');
    }

    public function geoAnswerTests(): HasMany
    {
        return $this->hasMany(TongzhuoGeoAnswerTest::class, 'site_id');
    }

    public function customerProjects(): HasMany
    {
        return $this->hasMany(TongzhuoCustomerProject::class, 'site_id');
    }
}
