<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\ContactLead;
use App\Models\DistributionChannel;
use App\Models\PublisherDevice;
use App\Services\GeoGrowth\ProductWorkbenchService;
use App\Support\AdminWeb;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;
use Throwable;

class DashboardController extends Controller
{
    public function __construct(
        private readonly ProductWorkbenchService $workbenchService,
    ) {}

    public function index(): View
    {
        $stats = [
            'leads_total' => $this->count(ContactLead::class, 'contact_leads'),
            'leads_new' => $this->count(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->where('status', 'new')),
            'leads_qualified' => $this->count(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->where('status', 'qualified')),
            'articles_total' => $this->count(Article::class, 'articles'),
            'articles_published' => $this->count(Article::class, 'articles', fn (Builder $query) => $query->where('status', 'published')),
            'channels_active' => $this->count(DistributionChannel::class, 'distribution_channels', fn (Builder $query) => $query->where('status', 'active')),
            'jobs_pending' => $this->count(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereIn('status', ['queued', 'sending'])),
            'jobs_failed' => $this->count(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->where('status', 'failed')),
            'devices_online' => $this->count(PublisherDevice::class, 'publisher_devices', fn (Builder $query) => $query->whereNull('disabled_at')->where('last_seen_at', '>=', now()->subMinutes(2))),
        ];

        $recentLeads = $this->get(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->orderByDesc('id')->limit(5)->get());
        $recentArticles = $this->get(Article::class, 'articles', fn (Builder $query) => $query->orderByDesc('id')->limit(6)->get());
        $recentJobs = $this->get(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query
            ->with(['article:id,title,slug,status', 'channel:id,name,channel_type'])
            ->orderByDesc('id')
            ->limit(5)
            ->get());

        return view('admin.dashboard', [
            'pageTitle' => '产品工作台',
            'activeMenu' => 'dashboard',
            'adminSiteName' => AdminWeb::siteName(),
            'stats' => $stats,
            'workbench' => $this->workbenchService->summary(),
            'recentLeads' => $recentLeads,
            'recentArticles' => $recentArticles,
            'recentJobs' => $recentJobs,
        ]);
    }

    /**
     * @param class-string<\Illuminate\Database\Eloquent\Model> $model
     */
    private function count(string $model, string $table, ?callable $scope = null): int
    {
        if (! $this->hasTable($table)) {
            return 0;
        }

        try {
            $query = $model::query();
            if ($scope !== null) {
                $scope($query);
            }

            return (int) $query->count();
        } catch (Throwable) {
            return 0;
        }
    }

    /**
     * @param class-string<\Illuminate\Database\Eloquent\Model> $model
     */
    private function get(string $model, string $table, callable $callback): Collection
    {
        if (! $this->hasTable($table)) {
            return collect();
        }

        try {
            $result = $callback($model::query());

            return $result instanceof Collection ? $result : collect($result);
        } catch (Throwable) {
            return collect();
        }
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable) {
            return false;
        }
    }
}
