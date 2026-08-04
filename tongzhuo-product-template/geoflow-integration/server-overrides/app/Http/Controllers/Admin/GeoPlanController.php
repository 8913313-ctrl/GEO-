<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoGeoPlan;
use App\Models\TongzhuoGeoPlanItem;
use App\Services\GeoGrowth\GeoEngineManager;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class GeoPlanController extends Controller
{
    public function __construct(
        private readonly SiteTemplateService $templates,
        private readonly GeoEngineManager $engines,
    ) {}

    public function index(): View
    {
        $site = $this->site();

        return view('admin.geo-plans.index', [
            'pageTitle' => '行动方案',
            'activeMenu' => 'geo_plans',
            'plans' => $site->geoPlans()->withCount('items')->latest()->paginate(12),
            'latestPlan' => $site->geoPlans()->with('items')->latest()->first(),
            'stats' => [
                'plans' => $site->geoPlans()->count(),
                'open_tasks' => $site->geoTasks()->whereIn('status', ['todo', 'doing'])->count(),
                'new_opportunities' => $site->geoOpportunities()->whereIn('status', ['new', 'planned'])->count(),
            ],
        ]);
    }

    public function show(int $planId): View
    {
        $plan = $this->site()->geoPlans()->with(['items.task', 'items.opportunity'])->findOrFail($planId);

        return view('admin.geo-plans.show', [
            'pageTitle' => '行动方案详情',
            'activeMenu' => 'geo_plans',
            'plan' => $plan,
            'phaseLabels' => $this->phaseLabels(),
            'workstreamLabels' => $this->workstreamLabels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:180'],
            'start_date' => ['nullable', 'date'],
        ]);
        $site = $this->site();
        $startDate = isset($data['start_date']) ? Carbon::parse($data['start_date'])->startOfDay() : now()->startOfDay();
        $enginePlan = $this->engines->generateActionPlan([
            'site' => [
                'name' => $site->name,
                'brand_name' => $site->brand_name,
                'domain' => $site->domain,
            ],
            'start_date' => $startDate->toDateString(),
            'task_count' => $site->geoTasks()->whereIn('status', ['todo', 'doing'])->count(),
            'opportunity_count' => $site->geoOpportunities()->whereIn('status', ['new', 'planned'])->count(),
            'published_articles' => Article::query()->where('status', 'published')->count(),
        ]);
        $plan = $site->geoPlans()->create([
            'title' => $data['title'] ?: ((string) ($enginePlan['title'] ?? '') ?: 'GEO 90天行动方案 - '.$startDate->format('Y-m-d')),
            'status' => 'active',
            'source' => (string) ($enginePlan['engine'] ?? 'local'),
            'start_date' => $startDate->toDateString(),
            'end_date' => $startDate->copy()->addDays(89)->toDateString(),
            'summary' => (string) ($enginePlan['summary'] ?? '') ?: '根据当前网站诊断任务、问题机会和内容资产生成的90天GEO运营计划。',
            'metrics' => array_merge([
                'target_articles' => 12,
                'target_faqs' => 18,
                'target_distribution_jobs' => 24,
                'review_cycle_days' => 14,
            ], is_array($enginePlan['metrics'] ?? null) ? $enginePlan['metrics'] : []),
            'metadata' => [
                'generator' => 'geo_engine',
                'engine' => (string) ($enginePlan['engine'] ?? 'local'),
                'engine_metadata' => is_array($enginePlan['metadata'] ?? null) ? $enginePlan['metadata'] : [],
                'task_count' => $site->geoTasks()->whereIn('status', ['todo', 'doing'])->count(),
                'opportunity_count' => $site->geoOpportunities()->whereIn('status', ['new', 'planned'])->count(),
            ],
            'created_by_admin_id' => auth('admin')->id(),
        ]);

        foreach ($this->buildPlanItems($site, is_array($enginePlan['items'] ?? null) ? $enginePlan['items'] : []) as $item) {
            $plan->items()->create($item);
        }

        return redirect()->route('admin.geo-plans.show', ['planId' => $plan->id])->with('message', '90天GEO行动方案已生成。');
    }

    public function itemStatus(Request $request, int $itemId): RedirectResponse
    {
        $item = TongzhuoGeoPlanItem::query()
            ->whereHas('plan', fn ($query) => $query->where('site_id', $this->site()->id))
            ->findOrFail($itemId);
        $status = $request->validate(['status' => ['required', Rule::in(['todo', 'doing', 'done', 'skipped'])]])['status'];
        $item->update([
            'status' => $status,
            'completed_at' => $status === 'done' ? now() : null,
        ]);

        return back()->with('message', '方案事项状态已更新。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    /** @return array<int,array<string,mixed>> */
    private function buildPlanItems(TongzhuoCmsSite $site, array $engineItems = []): array
    {
        $items = array_merge($this->normalizeEngineItems($engineItems), $this->baselineItems());
        $sort = 100;

        $tasks = $site->geoTasks()->whereIn('status', ['todo', 'doing'])->latest()->limit(8)->get();
        foreach ($tasks as $task) {
            $items[] = [
                'task_id' => $task->id,
                'phase' => $task->priority === 'high' ? 'day_1_30' : 'day_31_60',
                'workstream' => str_contains((string) $task->type, 'technical') ? 'technical' : 'content',
                'status' => 'todo',
                'priority' => $task->priority,
                'title' => $task->title,
                'description' => $task->description,
                'expected_output' => str_contains((string) $task->type, 'faq') ? 'FAQ草稿或发布' : '文章/页面优化',
                'evidence_source' => 'GEO任务 #'.$task->id,
                'current_question' => $task->title,
                'owner_name' => 'GEO运营',
                'deliverable' => str_contains((string) $task->type, 'faq') ? 'FAQ草稿或发布记录' : '文章/页面优化记录',
                'acceptance_metric' => '任务状态更新为已完成，并形成可被官网或AI引用的内容资产。',
                'resample_date' => now()->addDays($task->priority === 'high' ? 14 : 30)->toDateString(),
                'sort_order' => $sort,
                'evidence' => ['source' => 'geo_task', 'task_type' => $task->type],
            ];
            $sort += 10;
        }

        $opportunities = $site->geoOpportunities()->whereIn('status', ['new', 'planned'])->latest()->limit(10)->get();
        foreach ($opportunities as $opportunity) {
            $items[] = [
                'opportunity_id' => $opportunity->id,
                'phase' => $opportunity->priority === 'high' ? 'day_1_30' : 'day_31_60',
                'workstream' => 'content',
                'status' => 'todo',
                'priority' => $opportunity->priority,
                'title' => $opportunity->question,
                'description' => $opportunity->answer_angle,
                'expected_output' => match ($opportunity->recommended_output) {
                    'faq' => 'FAQ问答',
                    'service_page' => '服务页优化',
                    'case' => '案例内容',
                    default => '行业资讯文章',
                },
                'evidence_source' => '问题地图 #'.$opportunity->id.($opportunity->evidence_query ? ' · '.$opportunity->evidence_query : ''),
                'current_question' => $opportunity->question,
                'owner_name' => '内容运营',
                'deliverable' => match ($opportunity->recommended_output) {
                    'faq' => '发布FAQ并关联问题地图',
                    'service_page' => '完成服务页模块优化',
                    'case' => '发布案例证据内容',
                    default => '发布证据型行业资讯文章',
                },
                'acceptance_metric' => '内容通过GEO质量门，并在AI问答测试中完成一次复采。',
                'resample_date' => now()->addDays($opportunity->priority === 'high' ? 14 : 30)->toDateString(),
                'sort_order' => $sort,
                'evidence' => [
                    'source' => 'geo_opportunity',
                    'keyword' => $opportunity->keyword,
                    'service_line' => $opportunity->service_line,
                    'cluster_name' => $opportunity->cluster_name,
                    'evidence_query' => $opportunity->evidence_query,
                    'coverage_status' => $opportunity->coverage_status,
                ],
            ];
            $sort += 10;
        }

        return $items;
    }

    /**
     * @param array<int,array<string,mixed>> $engineItems
     * @return array<int,array<string,mixed>>
     */
    private function normalizeEngineItems(array $engineItems): array
    {
        $sort = 60;

        return collect($engineItems)
            ->filter('is_array')
            ->map(function (array $item) use (&$sort): array {
                $normalized = [
                    'phase' => in_array($item['phase'] ?? '', ['day_1_30', 'day_31_60', 'day_61_90'], true) ? $item['phase'] : 'day_1_30',
                    'workstream' => in_array($item['workstream'] ?? '', ['technical', 'content', 'distribution', 'review'], true) ? $item['workstream'] : 'content',
                    'status' => 'todo',
                    'priority' => in_array($item['priority'] ?? '', ['high', 'medium', 'low'], true) ? $item['priority'] : 'medium',
                    'title' => (string) ($item['title'] ?? ''),
                    'description' => (string) ($item['description'] ?? ''),
                    'expected_output' => (string) ($item['expected_output'] ?? 'GEO运营资产'),
                    'evidence_source' => (string) ($item['evidence_source'] ?? 'GEORank/GEO引擎建议'),
                    'current_question' => (string) ($item['current_question'] ?? $item['title'] ?? ''),
                    'owner_name' => (string) ($item['owner_name'] ?? 'GEO运营'),
                    'deliverable' => (string) ($item['deliverable'] ?? $item['expected_output'] ?? 'GEO运营资产'),
                    'acceptance_metric' => (string) ($item['acceptance_metric'] ?? '完成交付物并记录复采结果。'),
                    'resample_date' => $this->normalizeDate($item['resample_date'] ?? null, 30),
                    'sort_order' => $sort,
                    'evidence' => is_array($item['evidence'] ?? null) ? $item['evidence'] : ['source' => 'geo_engine'],
                ];
                $sort += 10;

                return $normalized;
            })
            ->filter(fn (array $item): bool => $item['title'] !== '')
            ->values()
            ->all();
    }

    private function normalizeDate(mixed $value, int $fallbackDays): string
    {
        try {
            if (is_string($value) && trim($value) !== '') {
                return Carbon::parse($value)->toDateString();
            }
        } catch (\Throwable) {
            // Invalid engine dates fall back to a local schedule.
        }

        return now()->addDays($fallbackDays)->toDateString();
    }

    /** @return array<int,array<string,mixed>> */
    private function baselineItems(): array
    {
        return [
            [
                'phase' => 'day_1_30',
                'workstream' => 'technical',
                'status' => 'todo',
                'priority' => 'high',
                'title' => '完成官网AI抓取基础检查',
                'description' => '检查首页、服务页、行业资讯、问题地图、sitemap.xml、feed.xml、llms.txt、llms-full.txt 和结构化数据是否可访问。',
                'expected_output' => 'AI抓取检查记录',
                'evidence_source' => '官网公开入口与AI抓取文件',
                'current_question' => 'AI和搜索引擎是否能稳定读取官网核心内容？',
                'owner_name' => '技术/GEO运营',
                'deliverable' => 'AI可见性审计报告',
                'acceptance_metric' => 'robots、sitemap、feed、llms和核心页面均可访问。',
                'resample_date' => now()->addDays(7)->toDateString(),
                'sort_order' => 10,
                'evidence' => ['source' => 'baseline'],
            ],
            [
                'phase' => 'day_1_30',
                'workstream' => 'content',
                'status' => 'todo',
                'priority' => 'high',
                'title' => '建立三条服务线的问题机会池',
                'description' => '围绕GEO优化、短视频运营、企业AI落地，整理客户会问AI的问题，并区分文章、FAQ、案例和服务页优化。',
                'expected_output' => '不少于15条问题机会',
                'evidence_source' => '客户资料、事实底座和行业搜索意图',
                'current_question' => '客户会向AI提出哪些高意图问题？',
                'owner_name' => 'GEO运营',
                'deliverable' => '三条服务线问题地图',
                'acceptance_metric' => '每条服务线至少5条问题机会，并标注覆盖状态。',
                'resample_date' => now()->addDays(14)->toDateString(),
                'sort_order' => 20,
                'evidence' => ['source' => 'baseline'],
            ],
            [
                'phase' => 'day_31_60',
                'workstream' => 'content',
                'status' => 'todo',
                'priority' => 'medium',
                'title' => '持续发布行业资讯和FAQ',
                'description' => '每周围绕高意图问题发布行业资讯和FAQ，让官网形成可被AI引用的稳定内容资产。',
                'expected_output' => '8篇文章和12条FAQ',
                'evidence_source' => '问题地图、事实底座和内容质量门',
                'current_question' => '官网是否有足够证据页回答核心问题？',
                'owner_name' => '内容运营',
                'deliverable' => '证据型文章和FAQ',
                'acceptance_metric' => '内容通过GEO质量门，且进入官网行业资讯/问题地图。',
                'resample_date' => now()->addDays(45)->toDateString(),
                'sort_order' => 30,
                'evidence' => ['source' => 'baseline'],
            ],
            [
                'phase' => 'day_31_60',
                'workstream' => 'distribution',
                'status' => 'todo',
                'priority' => 'medium',
                'title' => '建立重点平台分发节奏',
                'description' => '把官网已发布内容同步进入分发队列，通过桌面发布执行器完成重点平台草稿或发布回写。',
                'expected_output' => '重点平台分发记录',
                'evidence_source' => '已发布官网文章和分发队列',
                'current_question' => '外部平台是否形成可引用信源和触达入口？',
                'owner_name' => '发布运营',
                'deliverable' => '多平台分发记录',
                'acceptance_metric' => '重点平台任务有回写结果，失败任务有重试或人工确认。',
                'resample_date' => now()->addDays(60)->toDateString(),
                'sort_order' => 40,
                'evidence' => ['source' => 'baseline'],
            ],
            [
                'phase' => 'day_61_90',
                'workstream' => 'review',
                'status' => 'todo',
                'priority' => 'medium',
                'title' => '复盘AI可见性、内容资产和线索结果',
                'description' => '按文章、FAQ、分发、线索和AI抓取状态复盘，更新下一轮关键词、问题机会和服务页优化计划。',
                'expected_output' => '月度GEO复盘报告',
                'evidence_source' => 'AI问答采样、分发结果和客户线索',
                'current_question' => 'AI平台是否开始提到、引用或推荐品牌？',
                'owner_name' => '客户成功/GEO运营',
                'deliverable' => 'AI表现与业务效果复盘',
                'acceptance_metric' => '记录品牌出现率、推荐率、引用来源、竞品差距和下月动作。',
                'resample_date' => now()->addDays(90)->toDateString(),
                'sort_order' => 50,
                'evidence' => ['source' => 'baseline'],
            ],
        ];
    }

    /** @return array<string,string> */
    private function phaseLabels(): array
    {
        return [
            'day_1_30' => '第1-30天：打基础',
            'day_31_60' => '第31-60天：扩内容',
            'day_61_90' => '第61-90天：复盘增长',
        ];
    }

    /** @return array<string,string> */
    private function workstreamLabels(): array
    {
        return [
            'technical' => '技术与AI抓取',
            'content' => '内容资产',
            'distribution' => '分发运营',
            'review' => '数据复盘',
        ];
    }
}
