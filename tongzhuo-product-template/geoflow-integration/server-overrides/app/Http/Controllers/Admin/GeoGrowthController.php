<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\Author;
use App\Models\Category;
use App\Models\ContactLead;
use App\Models\DistributionChannel;
use App\Models\PublisherDevice;
use App\Models\TongzhuoCmsPage;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoCustomerProject;
use App\Models\TongzhuoFaqCategory;
use App\Models\TongzhuoFaqItem;
use App\Models\TongzhuoGeoAudit;
use App\Models\TongzhuoGeoTask;
use App\Services\TongzhuoCms\SiteTemplateService;
use App\Services\TongzhuoGeoAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class GeoGrowthController extends Controller
{
    public function __construct(
        private readonly SiteTemplateService $templates,
        private readonly TongzhuoGeoAuditService $audits,
    ) {}

    public function index(): View
    {
        $site = $this->site();
        $stats = [
            'audits' => $site->geoAudits()->count(),
            'last_score' => $site->geoAudits()->where('status', 'completed')->latest('completed_at')->value('score'),
            'open_tasks' => $site->geoTasks()->whereIn('status', ['todo', 'doing'])->count(),
            'opportunities' => $site->geoOpportunities()->count(),
            'plans' => $site->geoPlans()->count(),
            'answer_tests' => $site->geoAnswerTests()->count(),
            'answer_gaps' => $site->geoAnswerTests()->where('verdict', 'gap')->count(),
            'cms_pages' => TongzhuoCmsPage::query()->where('site_id', $site->id)->count(),
            'published_pages' => TongzhuoCmsPage::query()->where('site_id', $site->id)->where('status', 'published')->count(),
            'articles' => Article::query()->count(),
            'published_articles' => Article::query()->where('status', 'published')->count(),
            'draft_articles' => Article::query()->where('status', 'draft')->count(),
            'faqs' => TongzhuoFaqItem::query()->where('status', 'published')->count(),
            'draft_faqs' => TongzhuoFaqItem::query()->where('status', 'draft')->count(),
            'leads' => ContactLead::query()->count(),
            'new_leads' => ContactLead::query()->where('status', 'new')->count(),
            'queued_jobs' => ArticleDistribution::query()->whereIn('status', ['queued', 'sending'])->count(),
            'failed_jobs' => ArticleDistribution::query()->where('status', 'failed')->count(),
            'channels_active' => DistributionChannel::query()->where('status', 'active')->count(),
            'devices_online' => PublisherDevice::query()->whereNull('disabled_at')->where('last_seen_at', '>=', now()->subMinutes(2))->count(),
            'customer_projects' => TongzhuoCustomerProject::query()->count(),
            'risk_projects' => TongzhuoCustomerProject::query()->where('health_status', 'risk')->count(),
        ];
        $operationActions = [
            ['title' => '运行官网GEO诊断', 'description' => '先确认官网结构、Sitemap、llms和基础SEO是否健康。', 'count' => $stats['audits'], 'href' => '#audit-form', 'icon' => 'scan-search', 'level' => $stats['audits'] > 0 ? 'done' : 'warning'],
            ['title' => '处理GEO任务', 'description' => '把诊断发现转成文章、FAQ、页面优化或技术修复。', 'count' => $stats['open_tasks'], 'href' => '#tasks', 'icon' => 'list-checks', 'level' => $stats['open_tasks'] > 0 ? 'warning' : 'done'],
            ['title' => '补齐AI问答缺口', 'description' => 'AI问答测试里的缺口要沉淀为问题机会和内容资产。', 'count' => $stats['answer_gaps'], 'href' => route('admin.geo-answer-tests.index'), 'icon' => 'messages-square', 'level' => $stats['answer_gaps'] > 0 ? 'warning' : 'done'],
            ['title' => '检查分发失败', 'description' => '分发失败会影响外部信源覆盖，优先处理失败任务。', 'count' => $stats['failed_jobs'], 'href' => route('admin.distribution.jobs'), 'icon' => 'send', 'level' => $stats['failed_jobs'] > 0 ? 'danger' : 'done'],
            ['title' => '跟进新增线索', 'description' => '官网表单进入客户线索后，需要及时标记和跟进。', 'count' => $stats['new_leads'], 'href' => route('admin.contact-leads.index'), 'icon' => 'message-square-more', 'level' => $stats['new_leads'] > 0 ? 'warning' : 'done'],
            ['title' => '复核风险项目', 'description' => '客户项目出现风险时，要补交付证据、培训记录和下一步动作。', 'count' => $stats['risk_projects'], 'href' => route('admin.customer-projects.index'), 'icon' => 'folder-kanban', 'level' => $stats['risk_projects'] > 0 ? 'danger' : 'done'],
        ];
        $workflowStages = [
            ['key' => 'diagnosis', 'title' => '诊断', 'metric' => $stats['audits'], 'next' => '生成发现和任务'],
            ['key' => 'opportunity', 'title' => '机会', 'metric' => $stats['opportunities'], 'next' => '沉淀AI问题'],
            ['key' => 'content', 'title' => '内容', 'metric' => $stats['published_articles'] + $stats['faqs'], 'next' => '发布文章和FAQ'],
            ['key' => 'distribution', 'title' => '分发', 'metric' => $stats['queued_jobs'], 'next' => '同步外部平台'],
            ['key' => 'lead', 'title' => '线索', 'metric' => $stats['leads'], 'next' => '跟进客户需求'],
            ['key' => 'delivery', 'title' => '交付', 'metric' => $stats['customer_projects'], 'next' => '归档项目证据'],
        ];

        return view('admin.geo-growth.index', [
            'pageTitle' => 'GEO增长',
            'activeMenu' => 'geo_console',
            'site' => $site,
            'stats' => $stats,
            'audits' => $site->geoAudits()->withCount(['findings', 'tasks'])->latest()->limit(8)->get(),
            'tasks' => $site->geoTasks()->with('audit')->whereIn('status', ['todo', 'doing'])->latest()->limit(12)->get(),
            'operationActions' => $operationActions,
            'workflowStages' => $workflowStages,
            'recentArticles' => Article::query()->latest('updated_at')->limit(5)->get(),
            'recentDistributions' => ArticleDistribution::query()->with(['article', 'channel'])->latest('updated_at')->limit(5)->get(),
            'geoEngineDriver' => (string) config('geoflow.geo_engine.driver', 'local'),
        ]);
    }

    public function auditShow(int $auditId): View
    {
        $audit = $this->site()->geoAudits()->with(['findings', 'tasks'])->findOrFail($auditId);

        return view('admin.geo-growth.audit', [
            'pageTitle' => '诊断报告',
            'activeMenu' => 'geo_console',
            'audit' => $audit,
        ]);
    }

    public function auditStore(Request $request): RedirectResponse
    {
        $data = $request->validate(['url' => ['required', 'string', 'max:500']]);
        $url = $this->normalizeUrl($data['url']);
        $this->assertPublicUrl($url);
        $audit = $this->site()->geoAudits()->create([
            'url' => $url,
            'status' => 'pending',
            'created_by_admin_id' => auth('admin')->id(),
        ]);
        $this->audits->run($audit);

        return redirect()->route('admin.geo-growth.audit', ['auditId' => $audit->id])
            ->with('message', '网站诊断已完成，结果已生成对应的优化任务。');
    }

    public function taskStatus(Request $request, int $taskId): RedirectResponse
    {
        $task = $this->site()->geoTasks()->findOrFail($taskId);
        $status = $request->validate(['status' => ['required', Rule::in(['todo', 'doing', 'done', 'dismissed'])]])['status'];
        $task->update(['status' => $status]);

        return back()->with('message', 'GEO任务状态已更新。');
    }

    public function promoteTask(int $taskId): RedirectResponse
    {
        $task = $this->site()->geoTasks()->findOrFail($taskId);
        $brief = is_array($task->content_brief) ? $task->content_brief : [];
        if (! empty($brief['article_id'])) {
            return redirect()->route('admin.articles.edit', ['articleId' => $brief['article_id']])->with('message', '这个任务已经生成过文章草稿。');
        }

        $categoryId = Category::query()->value('id');
        $authorId = Author::query()->value('id');
        if (! $categoryId || ! $authorId) {
            return back()->withErrors('请先在内容管理中建立文章分类和作者，再生成文章草稿。');
        }

        $article = Article::query()->create([
            'title' => $task->title,
            'slug' => 'geo-task-'.$task->id.'-'.Str::lower(Str::random(6)),
            'excerpt' => Str::limit((string) $task->description, 180, ''),
            'content' => '<h2>'.e($task->title).'</h2><p>'.e((string) $task->description).'</p><p>这是由GEO诊断任务生成的文章草稿，请结合企业知识库补充真实案例、服务边界和行动建议后再提交审核。</p>',
            'category_id' => (int) $categoryId,
            'author_id' => (int) $authorId,
            'keywords' => 'GEO优化,AI搜索,企业官网',
            'meta_description' => Str::limit((string) $task->description, 160, ''),
            'status' => 'draft',
            'review_status' => 'pending',
            'is_ai_generated' => false,
        ]);
        $task->update(['status' => 'doing', 'content_brief' => $brief + ['article_id' => $article->id, 'promoted_at' => now()->toIso8601String()]]);

        return redirect()->route('admin.articles.edit', ['articleId' => $article->id])
            ->with('message', '已生成文章草稿，请补充企业真实内容后提交审核。');
    }

    public function promoteTaskToFaq(int $taskId): RedirectResponse
    {
        $site = $this->site();
        $task = $site->geoTasks()->findOrFail($taskId);
        $brief = is_array($task->content_brief) ? $task->content_brief : [];
        if (! empty($brief['faq_id'])) {
            return redirect()->route('admin.tongzhuo-cms.faqs.index')->with('message', '这个任务已经生成过FAQ草稿。');
        }

        $category = $this->ensureGeoFaqCategory($site);
        $answer = $this->faqDraftAnswer($task);
        $faq = TongzhuoFaqItem::query()->create([
            'site_id' => $site->id,
            'category_id' => $category->id,
            'question' => $task->title,
            'slug' => 'geo-question-'.$task->id.'-'.Str::lower(Str::random(6)),
            'answer' => $answer,
            'excerpt' => Str::limit(strip_tags($answer), 260, ''),
            'seo' => [
                'title' => $task->title,
                'description' => Str::limit((string) $task->description, 160, ''),
            ],
            'sort_order' => ((int) $category->items()->max('sort_order') + 10),
            'status' => 'draft',
            'published_at' => null,
        ]);

        $task->update([
            'status' => 'doing',
            'content_brief' => $brief + [
                'faq_id' => $faq->id,
                'faq_category_id' => $category->id,
                'faq_promoted_at' => now()->toIso8601String(),
            ],
        ]);

        return redirect()->route('admin.tongzhuo-cms.faqs.index')->with('message', '已生成FAQ草稿，请补充真实答复后发布到问题地图。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function normalizeUrl(string $url): string
    {
        $url = trim($url);
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.$url;
        }
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host']) || ! in_array(strtolower((string) $parts['scheme']), ['http', 'https'], true)) {
            abort(422, '请输入有效的官网地址，例如 https://example.com');
        }

        $normalized = strtolower((string) $parts['scheme']).'://'.$parts['host'];
        if (! empty($parts['port'])) {
            $normalized .= ':'.$parts['port'];
        }

        $path = isset($parts['path']) ? '/'.ltrim((string) $parts['path'], '/') : '';
        if ($path === '' || $path === '/' || preg_match('#/index\.(html?|php)$#i', $path)) {
            return $normalized;
        }

        $normalized .= $path;
        if (! empty($parts['query'])) {
            $normalized .= '?'.$parts['query'];
        }

        return rtrim($normalized, '/');
    }

    private function assertPublicUrl(string $url): void
    {
        $host = (string) parse_url($url, PHP_URL_HOST);
        if ($host === '' || in_array(strtolower($host), ['localhost', 'localhost.localdomain'], true)) {
            abort(422, '诊断地址必须是公网可访问的官网。');
        }
        $ip = filter_var($host, FILTER_VALIDATE_IP) !== false ? $host : gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            abort(422, '诊断地址不能指向本机、内网或保留IP。');
        }
    }

    private function ensureGeoFaqCategory(TongzhuoCmsSite $site): TongzhuoFaqCategory
    {
        $category = $site->faqCategories()->where('slug', 'geo-opportunities')->first();
        if ($category instanceof TongzhuoFaqCategory) {
            return $category;
        }

        return TongzhuoFaqCategory::query()->create([
            'site_id' => $site->id,
            'name' => 'GEO问题机会',
            'slug' => 'geo-opportunities',
            'description' => '由GEO诊断和AI问题机会沉淀出的官网问答内容。',
            'sort_order' => ((int) $site->faqCategories()->max('sort_order') + 10),
            'is_visible' => true,
        ]);
    }

    private function faqDraftAnswer(TongzhuoGeoTask $task): string
    {
        $brief = is_array($task->content_brief) ? $task->content_brief : [];
        $serviceLine = (string) ($brief['service_line'] ?? '');
        $keyword = (string) ($brief['keyword'] ?? '');
        $parts = [
            '<p>'.e((string) $task->description ?: '这个问题来自GEO诊断或AI问题机会，需要结合企业真实服务能力进行回答。').'</p>',
            '<p>建议补充：适用客户、服务边界、执行步骤、交付结果、真实案例或可验证证据。</p>',
        ];

        if ($serviceLine !== '' || $keyword !== '') {
            $parts[] = '<p>内容方向：'.e(trim($serviceLine.' '.$keyword)).'</p>';
        }

        $parts[] = '<p>发布前请检查：答案是否清楚、是否能被AI直接引用、是否与官网服务页和行业资讯形成内链。</p>';

        return implode("\n", $parts);
    }
}
