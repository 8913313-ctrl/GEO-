<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ContactLead;
use App\Models\TongzhuoCmsNavigationItem;
use App\Models\TongzhuoCmsPage;
use App\Models\TongzhuoCmsPageBlock;
use App\Models\TongzhuoCmsPageVersion;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoFaqCategory;
use App\Models\TongzhuoFaqItem;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TongzhuoCmsController extends Controller
{
    public function __construct(private readonly SiteTemplateService $templates) {}

    public function dashboard(): View
    {
        $site = $this->site();
        $pages = $site->pages()->withCount('blocks')->orderBy('sort_order')->get();
        $publishedPages = $pages->where('status', 'published')->count();
        $draftPages = $pages->where('status', 'draft')->count();
        $faqCategories = TongzhuoFaqCategory::query()->where('site_id', $site->id)->count();
        $faqItems = TongzhuoFaqItem::query()->where('site_id', $site->id)->count();
        $publishedFaqItems = TongzhuoFaqItem::query()->where('site_id', $site->id)->where('status', 'published')->count();
        $publishedArticles = Article::query()->where('status', 'published')->count();
        $settings = $site->settings ?? [];
        $requiredSettings = ['base_url', 'footer_summary', 'contact_phone', 'contact_wechat', 'address'];
        $completedSettings = collect($requiredSettings)->filter(fn (string $key): bool => ! empty($settings[$key] ?? null))->count();

        $contentReadiness = [
            'score' => $pages->count() > 0 ? (int) round(($publishedPages / max(1, $pages->count())) * 100) : 0,
            'draft_pages' => $draftPages,
            'published_faq_items' => $publishedFaqItems,
            'settings_score' => (int) round(($completedSettings / count($requiredSettings)) * 100),
        ];
        $aiEndpoints = collect([
            ['label' => 'robots.txt', 'path' => '/robots.txt', 'purpose' => '告诉搜索引擎和AI可抓取范围'],
            ['label' => 'sitemap.xml', 'path' => '/sitemap.xml', 'purpose' => '公开页面索引'],
            ['label' => 'feed.xml', 'path' => '/feed.xml', 'purpose' => '行业资讯订阅源'],
            ['label' => 'llms.txt', 'path' => '/llms.txt', 'purpose' => 'AI阅读入口'],
            ['label' => 'llms-full.txt', 'path' => '/llms-full.txt', 'purpose' => '完整企业信源摘要'],
        ])->map(function (array $endpoint): array {
            $endpoint['exists'] = File::exists(public_path(ltrim($endpoint['path'], '/')));

            return $endpoint;
        })->all();
        $nextActions = [
            ['title' => '补齐草稿页面', 'description' => '草稿页面不会稳定进入官网信源，建议先发布基础页面。', 'count' => $draftPages, 'route' => route('admin.tongzhuo-cms.pages.index', ['status' => 'draft']), 'level' => $draftPages > 0 ? 'warning' : 'done'],
            ['title' => '扩充问题地图', 'description' => 'FAQ 是给 AI 读取业务答案的核心内容，建议每条服务线至少 10 个问题。', 'count' => max(0, 30 - $publishedFaqItems), 'route' => route('admin.tongzhuo-cms.faqs.index'), 'level' => $publishedFaqItems >= 30 ? 'done' : 'warning'],
            ['title' => '持续发布行业资讯', 'description' => '资讯文章会进入官网、RSS、Sitemap 和分发队列。', 'count' => $publishedArticles, 'route' => route('admin.articles.index'), 'level' => $publishedArticles > 0 ? 'done' : 'warning'],
            ['title' => '检查全站基础信息', 'description' => '公司名、联系方式、地址和官网域名会写入 AI 信源文件。', 'count' => $contentReadiness['settings_score'], 'route' => route('admin.tongzhuo-cms.settings.index'), 'level' => $contentReadiness['settings_score'] >= 100 ? 'done' : 'warning'],
        ];

        return view('admin.tongzhuo-cms.dashboard', [
            'pageTitle' => '官网CMS',
            'activeMenu' => 'tongzhuo_cms',
            'site' => $site,
            'stats' => [
                'pages' => $pages->count(),
                'published' => $publishedPages,
                'drafts' => $draftPages,
                'blocks' => TongzhuoCmsPageBlock::query()->whereIn('page_id', $pages->pluck('id'))->count(),
                'articles' => Article::query()->count(),
                'contacts' => ContactLead::query()->count(),
                'faq_categories' => $faqCategories,
                'faq_items' => $faqItems,
                'published_faq_items' => $publishedFaqItems,
            ],
            'recentPages' => $pages->sortByDesc('updated_at')->take(5),
            'recentArticles' => Article::query()->latest('updated_at')->limit(5)->get(),
            'contentReadiness' => $contentReadiness,
            'aiEndpoints' => $aiEndpoints,
            'nextActions' => $nextActions,
        ]);
    }

    public function pageIndex(Request $request): View
    {
        $site = $this->site();
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'published', 'draft'])],
            'template' => ['nullable', 'string', 'max:80'],
            'q' => ['nullable', 'string', 'max:80'],
        ]);
        $status = $filters['status'] ?? 'all';
        $template = $filters['template'] ?? 'all';
        $keyword = trim((string) ($filters['q'] ?? ''));
        $query = $site->pages()->withCount(['blocks', 'versions'])->orderBy('sort_order')->orderBy('id');
        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if ($template !== 'all' && $template !== '') {
            $query->where('template_key', $template);
        }
        if ($keyword !== '') {
            $query->where(function ($builder) use ($keyword): void {
                $builder->where('title', 'like', '%'.$keyword.'%')
                    ->orWhere('navigation_label', 'like', '%'.$keyword.'%')
                    ->orWhere('description', 'like', '%'.$keyword.'%')
                    ->orWhere('slug', 'like', '%'.$keyword.'%');
            });
        }
        $allPages = $site->pages()->withCount('blocks')->orderBy('sort_order')->get();

        return view('admin.tongzhuo-cms.pages.index', [
            'pageTitle' => '页面管理',
            'activeMenu' => 'tongzhuo_cms',
            'site' => $site,
            'pages' => $query->get(),
            'allPages' => $allPages,
            'filters' => ['status' => $status, 'template' => $template, 'q' => $keyword],
            'templateOptions' => $allPages->pluck('template_key')->filter()->unique()->values(),
            'builtInSlugs' => collect($this->templates->pageDefinitions())->pluck('slug')->all(),
        ]);
    }

    public function pageCreate(): View
    {
        return $this->pageForm(null);
    }

    public function pageStore(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $this->validatePage($request, $site);
        $slug = $this->normalizeSlug($data['slug']);

        $page = TongzhuoCmsPage::query()->create([
            'site_id' => $site->id,
            'slug' => $slug,
            'path' => $this->pathForSlug($slug),
            'title' => $data['title'],
            'navigation_label' => $data['navigation_label'] ?: $data['title'],
            'description' => $data['description'] ?: null,
            'template_key' => $data['template_key'],
            'status' => 'draft',
            'sort_order' => (int) $site->pages()->max('sort_order') + 1,
            'seo' => [
                'title' => $data['seo']['title'] ?? $data['title'],
                'description' => $data['seo']['description'] ?? $data['description'],
            ],
            'structured_data' => [],
        ]);

        TongzhuoCmsPageBlock::query()->create([
            'page_id' => $page->id,
            'block_key' => 'hero',
            'type' => 'hero',
            'label' => '首屏内容',
            'sort_order' => 1,
            'is_visible' => true,
            'content' => [
                'eyebrow' => $page->navigation_label,
                'heading' => $page->title,
                'body' => $page->description,
                'button_label' => '预约沟通',
                'button_url' => 'contact.html',
            ],
            'settings' => [],
        ]);

        $this->snapshot($page, 'created');

        return redirect()->route('admin.tongzhuo-cms.pages.edit', ['pageId' => $page->id])
            ->with('message', '页面已创建。先补充内容模块，再发布到官网。');
    }

    public function pageEdit(int $pageId): View|RedirectResponse
    {
        return $this->pageForm($this->page($pageId));
    }

    public function pageUpdate(Request $request, int $pageId): RedirectResponse
    {
        $page = $this->page($pageId);
        $data = $this->validatePage($request, $page->site, $page);
        $builtIn = collect($this->templates->pageDefinitions())->contains('slug', $page->slug);
        $slug = $builtIn ? $page->slug : $this->normalizeSlug($data['slug']);

        $page->update([
            'slug' => $slug,
            'path' => $builtIn ? $page->path : $this->pathForSlug($slug),
            'title' => $data['title'],
            'navigation_label' => $data['navigation_label'] ?: $data['title'],
            'description' => $data['description'] ?: null,
            'template_key' => $data['template_key'],
            'sort_order' => $data['sort_order'] ?? $page->sort_order,
            'seo' => [
                'title' => $data['seo']['title'] ?? $data['title'],
                'description' => $data['seo']['description'] ?? $data['description'],
            ],
        ]);
        $this->snapshot($page->fresh(['blocks']), 'saved');

        return back()->with('message', '页面信息已保存，前台预览会立即使用新内容。');
    }

    public function pagePublish(int $pageId): RedirectResponse
    {
        $page = $this->page($pageId);
        $this->snapshot($page->load('blocks'), 'published');
        $page->update(['status' => 'published', 'published_at' => now()]);

        return back()->with('message', '页面已发布到官网。');
    }

    public function pageDraft(int $pageId): RedirectResponse
    {
        $page = $this->page($pageId);
        $page->update(['status' => 'draft', 'published_at' => null]);

        return back()->with('message', '页面已转为草稿，官网保留最近一次已发布内容。');
    }

    public function pageDelete(int $pageId): RedirectResponse
    {
        $page = $this->page($pageId);
        if (collect($this->templates->pageDefinitions())->contains('slug', $page->slug)) {
            return back()->withErrors('官网基础页面不能删除，可改为草稿或修改内容。');
        }

        $page->delete();

        return redirect()->route('admin.tongzhuo-cms.pages.index')->with('message', '自定义页面已删除。');
    }

    public function blockStore(Request $request, int $pageId): RedirectResponse
    {
        $page = $this->page($pageId);
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys($this->blockTypes()))],
            'label' => ['required', 'string', 'max:120'],
        ]);
        $number = (int) $page->blocks()->count() + 1;

        TongzhuoCmsPageBlock::query()->create([
            'page_id' => $page->id,
            'block_key' => 'block-'.now()->format('YmdHis').'-'.$number,
            'type' => $data['type'],
            'label' => $data['label'],
            'sort_order' => (int) $page->blocks()->max('sort_order') + 1,
            'is_visible' => true,
            'content' => ['heading' => $data['label'], 'body' => '', 'button_label' => '', 'button_url' => ''],
            'settings' => [],
        ]);

        return back()->with('message', '内容模块已添加。');
    }

    public function blockUpdate(Request $request, int $blockId): RedirectResponse
    {
        $block = $this->block($blockId);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:120'],
            'content' => ['nullable', 'array'],
            'content.eyebrow' => ['nullable', 'string', 'max:120'],
            'content.heading' => ['nullable', 'string', 'max:200'],
            'content.body' => ['nullable', 'string', 'max:6000'],
            'content.button_label' => ['nullable', 'string', 'max:80'],
            'content.button_url' => ['nullable', 'string', 'max:240'],
            'is_visible' => ['nullable', 'boolean'],
        ]);

        $block->update([
            'label' => $data['label'],
            'content' => array_merge($block->content ?? [], $data['content'] ?? []),
            'is_visible' => $request->boolean('is_visible'),
        ]);
        $this->snapshot($block->page()->with('blocks')->firstOrFail(), 'block-saved');

        return back()->with('message', '内容模块已保存。');
    }

    public function blockDelete(int $blockId): RedirectResponse
    {
        $block = $this->block($blockId);
        if ($block->block_key === 'hero') {
            return back()->withErrors('首屏模块不能删除，可以隐藏或修改内容。');
        }
        $block->delete();

        return back()->with('message', '内容模块已删除。');
    }

    public function blockReorder(Request $request): RedirectResponse
    {
        $data = $request->validate(['order' => ['required', 'array'], 'order.*' => ['integer']]);
        foreach ($data['order'] as $index => $blockId) {
            $block = $this->block((int) $blockId);
            $block->update(['sort_order' => $index + 1]);
        }

        return back()->with('message', '模块顺序已更新。');
    }

    public function navIndex(): View
    {
        $site = $this->site();

        return view('admin.tongzhuo-cms.navigation', [
            'pageTitle' => '导航管理',
            'activeMenu' => 'tongzhuo_cms',
            'site' => $site,
            'items' => $site->navigationItems()->orderBy('area')->orderBy('sort_order')->get(),
            'pages' => $site->pages()->orderBy('sort_order')->get(['id', 'title', 'path']),
        ]);
    }

    public function navSave(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'items' => ['nullable', 'array'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.area' => ['required', Rule::in(['header', 'footer'])],
            'items.*.label' => ['required', 'string', 'max:80'],
            'items.*.url' => ['required', 'string', 'max:180'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'items.*.is_visible' => ['nullable', 'boolean'],
        ]);

        $saved = [];
        foreach ($data['items'] ?? [] as $index => $item) {
            $record = ! empty($item['id'])
                ? $site->navigationItems()->find($item['id'])
                : null;
            $record ??= new TongzhuoCmsNavigationItem(['site_id' => $site->id]);
            $record->fill([
                'area' => $item['area'],
                'label' => $item['label'],
                'url' => ltrim($item['url'], '/'),
                'sort_order' => $item['sort_order'] ?? $index + 1,
                'is_visible' => ! empty($item['is_visible']),
            ]);
            $record->save();
            $saved[] = $record->id;
        }
        $site->navigationItems()->whereNotIn('id', $saved)->delete();

        return back()->with('message', '导航已保存，并会同步到官网顶部导航。');
    }

    public function settingsIndex(): View
    {
        return view('admin.tongzhuo-cms.settings', [
            'pageTitle' => '全站设置',
            'activeMenu' => 'tongzhuo_cms',
            'site' => $this->site(),
        ]);
    }

    public function settingsSave(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'brand_name' => ['required', 'string', 'max:80'],
            'domain' => ['nullable', 'string', 'max:160'],
            'settings' => ['nullable', 'array'],
            'settings.base_url' => ['nullable', 'url', 'max:160'],
            'settings.footer_summary' => ['nullable', 'string', 'max:240'],
            'settings.contact_phone' => ['nullable', 'string', 'max:40'],
            'settings.contact_wechat' => ['nullable', 'string', 'max:80'],
            'settings.address' => ['nullable', 'string', 'max:240'],
            'settings.icp' => ['nullable', 'string', 'max:80'],
        ]);
        $settings = array_merge($this->templates->defaultSettings(), $site->settings ?? [], $data['settings'] ?? []);
        $site->update([
            'name' => $data['name'],
            'brand_name' => $data['brand_name'],
            'domain' => $data['domain'] ?: $site->domain,
            'settings' => $settings,
        ]);
        $this->syncIdentityFile($site, $settings);

        return back()->with('message', '全站设置已保存，官网、RSS、Sitemap和AI说明会使用新的基础信息。');
    }

    private function pageForm(?TongzhuoCmsPage $page): View
    {
        $site = $this->site();
        $page?->load('blocks', 'versions');
        $blocks = $page?->blocks ?? collect();
        $seo = $page?->seo ?? [];
        $editorSummary = [
            'visible_blocks' => $blocks->where('is_visible', true)->count(),
            'hidden_blocks' => $blocks->where('is_visible', false)->count(),
            'has_seo_title' => ! empty($seo['title'] ?? null),
            'has_seo_description' => ! empty($seo['description'] ?? null),
            'has_description' => $page ? ! empty($page->description) : false,
        ];

        return view('admin.tongzhuo-cms.pages.form', [
            'pageTitle' => $page ? '编辑页面：'.$page->title : '新建页面',
            'activeMenu' => 'tongzhuo_cms',
            'site' => $site,
            'page' => $page,
            'blocks' => $blocks,
            'versions' => $page?->versions()->limit(8)->get() ?? collect(),
            'blockTypes' => $this->blockTypes(),
            'isBuiltIn' => $page && collect($this->templates->pageDefinitions())->contains('slug', $page->slug),
            'editorSummary' => $editorSummary,
        ]);
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function page(int $pageId): TongzhuoCmsPage
    {
        return $this->site()->pages()->with('blocks')->findOrFail($pageId);
    }

    private function block(int $blockId): TongzhuoCmsPageBlock
    {
        $block = TongzhuoCmsPageBlock::query()->with('page')->findOrFail($blockId);
        abort_unless($block->page && $block->page->site_id === $this->site()->id, 404);

        return $block;
    }

    /** @return array<string, mixed> */
    private function validatePage(Request $request, TongzhuoCmsSite $site, ?TongzhuoCmsPage $page = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'slug' => [
                'required', 'string', 'max:120', 'regex:/^[a-z0-9-]+$/',
                Rule::unique('tongzhuo_cms_pages', 'slug')->where(fn ($query) => $query->where('site_id', $site->id))->ignore($page?->id),
            ],
            'navigation_label' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:240'],
            'template_key' => ['required', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'seo' => ['nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:180'],
            'seo.description' => ['nullable', 'string', 'max:240'],
        ]);
    }

    private function normalizeSlug(string $slug): string
    {
        return trim(strtolower($slug));
    }

    private function pathForSlug(string $slug): string
    {
        return $slug === 'home' ? '/' : '/'.$slug.'.html';
    }

    /** @return array<string, string> */
    private function blockTypes(): array
    {
        return [
            'hero' => '首屏内容',
            'text' => '图文内容',
            'cards' => '服务卡片',
            'faq' => '常见问题',
            'cta' => '行动引导',
        ];
    }

    private function snapshot(TongzhuoCmsPage $page, string $status): void
    {
        $page->loadMissing('blocks');
        $next = (int) $page->versions()->max('version_number') + 1;
        TongzhuoCmsPageVersion::query()->create([
            'page_id' => $page->id,
            'version_number' => $next,
            'title' => $page->title,
            'status' => $status,
            'page_snapshot' => $page->only(['slug', 'path', 'title', 'navigation_label', 'description', 'template_key', 'status', 'sort_order', 'seo']),
            'blocks_snapshot' => $page->blocks->map(fn (TongzhuoCmsPageBlock $block) => $block->only(['block_key', 'type', 'label', 'sort_order', 'is_visible', 'content']))->values()->all(),
            'created_by_admin_id' => auth('admin')->id(),
        ]);
    }

    /** @param array<string, string> $settings */
    private function syncIdentityFile(TongzhuoCmsSite $site, array $settings): void
    {
        $path = storage_path('app/tongzhuo-site/identity.json');
        File::ensureDirectoryExists(dirname($path));
        File::put($path, json_encode([
            'company_name' => $site->name,
            'brand_name' => $site->brand_name,
            'brand_aliases' => $site->brand_name,
            'telephone' => $settings['contact_phone'] ?? '',
            'wechat' => $settings['contact_wechat'] ?? '',
            'address_region' => '山东省',
            'address_locality' => '淄博市张店区',
            'street_address' => $settings['address'] ?? '',
            'base_url' => $settings['base_url'] ?? request()->getSchemeAndHttpHost(),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
}
