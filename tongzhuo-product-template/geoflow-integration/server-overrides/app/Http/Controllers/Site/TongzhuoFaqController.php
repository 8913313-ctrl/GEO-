<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoFaqCategory;
use App\Models\TongzhuoFaqItem;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\View\View;

class TongzhuoFaqController extends Controller
{
    public function __construct(private readonly SiteTemplateService $templates) {}

    public function index(): View
    {
        $site = $this->site();
        $categories = $this->publishedCategories($site)->get();

        return view('tongzhuo.faq-index', [
            'site' => $site,
            'categories' => $categories,
            'identity' => $this->identity($site),
        ]);
    }

    public function category(string $categorySlug): View
    {
        $site = $this->site();
        $category = $this->publishedCategories($site)->where('slug', $categorySlug)->firstOrFail();

        return view('tongzhuo.faq-category', [
            'site' => $site,
            'category' => $category,
            'categories' => $this->publishedCategories($site)->get(),
            'items' => $category->items()->where('status', 'published')->paginate(20),
            'identity' => $this->identity($site),
        ]);
    }

    public function show(string $categorySlug, string $slug): View
    {
        $site = $this->site();
        $category = $this->publishedCategories($site)->where('slug', $categorySlug)->firstOrFail();
        $item = $category->items()->where('status', 'published')->where('slug', $slug)->firstOrFail();

        return view('tongzhuo.faq-detail', [
            'site' => $site,
            'category' => $category,
            'item' => $item,
            'relatedItems' => $category->items()->where('status', 'published')->whereKeyNot($item->id)->limit(6)->get(),
            'identity' => $this->identity($site),
        ]);
    }

    private function site(): TongzhuoCmsSite
    {
        $site = $this->templates->ensureSite();
        $this->seedDefaults($site);

        return $site;
    }

    private function publishedCategories(TongzhuoCmsSite $site)
    {
        return $site->faqCategories()
            ->where('is_visible', true)
            ->with(['items' => fn ($query) => $query->where('status', 'published')->orderBy('sort_order')->orderBy('id')])
            ->whereHas('items', fn ($query) => $query->where('status', 'published'))
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    private function seedDefaults(TongzhuoCmsSite $site): void
    {
        if ($site->faqCategories()->exists()) {
            return;
        }

        $groups = [
            ['name' => 'GEO优化', 'slug' => 'geo', 'description' => '企业如何建立可被搜索与AI理解的可信信息源。', 'items' => [
                ['什么企业适合先做GEO优化？', '当客户搜索公司、产品或向AI询问服务商时，企业没有清晰入口，或者AI无法准确介绍企业，就应优先补齐官网信息源、服务页、行业观点与常见问题。'],
                ['GEO是不是只改官网关键词？', '不是。GEO更关注企业实体、事实证据、答案结构、持续更新和可引用来源。关键词只是入口，可验证的内容与清晰结构才是基础。'],
            ]],
            ['name' => '短视频运营', 'slug' => 'video', 'description' => '从内容选题到线索承接，回答短视频获客中的真实问题。', 'items' => [
                ['短视频有播放量但没有客户，通常卡在哪里？', '常见原因是内容只展示产品、没有回答客户决策问题；账号定位不够清晰；评论、私信、官网与线索承接没有形成闭环。'],
                ['工业品和制造业适合做短视频吗？', '适合，但不应套用娱乐内容的做法。围绕产品应用、工艺能力、客户问题、案例复盘与专业判断持续输出，更容易形成可信获客内容。'],
            ]],
            ['name' => '企业AI落地', 'slug' => 'enterprise-ai', 'description' => '先把高频业务知识沉淀下来，再让AI进入真实工作流程。', 'items' => [
                ['企业AI落地的第一步应该做什么？', '先整理产品资料、销售话术、客户问答、案例和流程等高频业务知识。知识清楚后，再进入销售助手、客服助手或内容工作流。'],
                ['如何判断企业先做哪一项服务？', '先看当前最卡的位置：看不见优先GEO，不信任优先内容和案例，不转化优先承接链路，不复用优先企业AI知识库。'],
            ]],
        ];

        foreach ($groups as $groupIndex => $group) {
            $category = TongzhuoFaqCategory::query()->create([
                'site_id' => $site->id,
                'name' => $group['name'],
                'slug' => $group['slug'],
                'description' => $group['description'],
                'sort_order' => ($groupIndex + 1) * 10,
                'is_visible' => true,
            ]);
            foreach ($group['items'] as $itemIndex => [$question, $answer]) {
                TongzhuoFaqItem::query()->create([
                    'site_id' => $site->id,
                    'category_id' => $category->id,
                    'question' => $question,
                    'slug' => 'question-'.($itemIndex + 1),
                    'answer' => $answer,
                    'excerpt' => $answer,
                    'sort_order' => ($itemIndex + 1) * 10,
                    'status' => 'published',
                    'published_at' => now(),
                ]);
            }
        }
    }

    /** @return array<string, string> */
    private function identity(TongzhuoCmsSite $site): array
    {
        $settings = $site->settings ?? [];

        return [
            'brand_name' => (string) ($site->brand_name ?: '桐灼科技'),
            'company_name' => (string) ($site->name ?: '桐灼（淄博）网络科技有限公司'),
            'base_url' => rtrim((string) ($settings['base_url'] ?? url('/')), '/'),
            'footer_summary' => (string) ($settings['footer_summary'] ?? '桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。'),
        ];
    }
}
