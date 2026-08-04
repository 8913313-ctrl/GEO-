<?php

namespace App\Services\TongzhuoCms;

use App\Models\TongzhuoCmsNavigationItem;
use App\Models\TongzhuoCmsPage;
use App\Models\TongzhuoCmsPageBlock;
use App\Models\TongzhuoCmsSite;
use Illuminate\Support\Facades\File;

class SiteTemplateService
{
    /** @return array<int, array<string, string>> */
    public function pageDefinitions(): array
    {
        return [
            ['slug' => 'home', 'path' => '/', 'title' => '桐灼科技｜GEO优化、短视频运营与企业AI落地', 'navigation_label' => '首页', 'description' => '桐灼（淄博）网络科技有限公司提供GEO优化、短视频运营和企业AI落地服务，帮助企业建立可信信源与持续获客能力。', 'template_key' => 'home'],
            ['slug' => 'about', 'path' => '/about.html', 'title' => '关于桐灼科技', 'navigation_label' => '关于我们', 'description' => '了解桐灼（淄博）网络科技有限公司的定位、方法与团队。', 'template_key' => 'company'],
            ['slug' => 'products', 'path' => '/products.html', 'title' => '产品中心｜GEO优化、短视频运营、企业AI落地', 'navigation_label' => '产品中心', 'description' => '桐灼围绕GEO优化、短视频运营与企业AI落地提供企业增长服务。', 'template_key' => 'services'],
            ['slug' => 'cases', 'path' => '/cases.html', 'title' => '服务案例', 'navigation_label' => '服务案例', 'description' => '查看桐灼服务项目的实践方法与案例成果。', 'template_key' => 'cases'],
            ['slug' => 'team', 'path' => '/team.html', 'title' => '创始团队', 'navigation_label' => '创始团队', 'description' => '认识桐灼科技的创始团队与服务能力。', 'template_key' => 'company'],
            ['slug' => 'honors', 'path' => '/honors.html', 'title' => '荣誉资质', 'navigation_label' => '荣誉资质', 'description' => '桐灼科技的企业资质、能力与荣誉信息。', 'template_key' => 'company'],
            ['slug' => 'issues', 'path' => '/issues.html', 'title' => '常见问题', 'navigation_label' => '常见问题', 'description' => '关于GEO优化、短视频运营与企业AI落地的常见问题。', 'template_key' => 'faq'],
            ['slug' => 'careers', 'path' => '/careers.html', 'title' => '加入我们', 'navigation_label' => '加入我们', 'description' => '加入桐灼科技，共同服务企业AI增长。', 'template_key' => 'careers'],
            ['slug' => 'contact', 'path' => '/contact.html', 'title' => '联系我们', 'navigation_label' => '联系方式', 'description' => '联系桐灼科技，预约GEO、短视频或企业AI业务诊断。', 'template_key' => 'contact'],
        ];
    }

    public function ensureSite(): TongzhuoCmsSite
    {
        $site = TongzhuoCmsSite::query()->first();
        if (! $site instanceof TongzhuoCmsSite) {
            $site = TongzhuoCmsSite::query()->create([
                'name' => '桐灼官网',
                'brand_name' => '桐灼科技',
                'domain' => request()->getHost(),
                'template_key' => 'tongzhuo-corporate',
                'status' => 'active',
                'settings' => $this->defaultSettings(),
                'seo_defaults' => [],
                'ai_crawl_settings' => [],
            ]);
        }

        $this->seedPages($site);
        $this->seedNavigation($site);

        return $site;
    }

    public function pageForFile(string $pageFile): ?TongzhuoCmsPage
    {
        $site = $this->ensureSite();
        $path = $pageFile === 'index.html' ? '/' : '/'.$pageFile;

        return TongzhuoCmsPage::query()
            ->where('site_id', $site->id)
            ->where('path', $path)
            ->where('status', 'published')
            ->with('blocks')
            ->first();
    }

    public function renderStaticPage(string $pageFile): ?string
    {
        $filePath = public_path($pageFile);
        if (! is_file($filePath)) {
            return null;
        }

        $page = $this->pageForFile($pageFile);
        if (! $page instanceof TongzhuoCmsPage) {
            return File::get($filePath);
        }

        $html = File::get($filePath);
        $settings = $page->site->settings ?? $this->defaultSettings();
        $brand = trim((string) ($page->site->brand_name ?: '桐灼科技'));
        $seo = $page->seo ?? [];
        $title = trim((string) ($seo['title'] ?? $page->title));
        $description = trim((string) ($seo['description'] ?? $page->description));
        $canonical = rtrim((string) ($settings['base_url'] ?? request()->getSchemeAndHttpHost()), '/').$page->path;

        $html = preg_replace('/<title>.*?<\/title>/is', '<title>'.e($title).'</title>', $html, 1) ?? $html;
        $html = preg_replace('/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i', '<meta name="description" content="'.e($description).'">', $html, 1) ?? $html;
        $html = preg_replace('/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i', '<link rel="canonical" href="'.e($canonical).'">', $html, 1) ?? $html;
        $html = str_replace('</head>', '  <link rel="stylesheet" href="/assets/cms-runtime.css?v=20260720-1">'."\n".'</head>', $html);
        $html = $this->replaceNavigation($html, $page, $brand);
        $html = $this->replaceHero($html, $page);
        if ($page->slug === 'home') {
            $html = $this->replaceHomeServiceCards($html, $page);
        }
        $html = str_replace('</main>', $this->renderRuntimeBlocks($page)."\n  </main>", $html);

        return $html;
    }

    /** @return array<string, string> */
    public function defaultSettings(): array
    {
        return [
            'base_url' => request()->getSchemeAndHttpHost(),
            'footer_summary' => '桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。',
            'contact_phone' => '17852030756',
            'contact_wechat' => 'TZqaKi',
            'address' => '山东省淄博市张店区北西六路20甲4号5层A4号',
            'icp' => '',
        ];
    }

    private function seedPages(TongzhuoCmsSite $site): void
    {
        foreach ($this->pageDefinitions() as $index => $definition) {
            $page = TongzhuoCmsPage::query()->firstOrCreate(
                ['site_id' => $site->id, 'slug' => $definition['slug']],
                $definition + ['site_id' => $site->id, 'status' => 'published', 'sort_order' => $index + 1, 'seo' => [], 'structured_data' => []]
            );

            $hero = TongzhuoCmsPageBlock::query()->firstOrCreate(
                ['page_id' => $page->id, 'block_key' => 'hero'],
                [
                    'type' => 'hero',
                    'label' => '首屏内容',
                    'sort_order' => 1,
                    'is_visible' => true,
                    'content' => $this->defaultHeroContent($definition),
                    'settings' => [],
                ]
            );
            if (($hero->content['heading'] ?? '') === $definition['title']) {
                $hero->update(['content' => $this->defaultHeroContent($definition)]);
            }
            if ($definition['slug'] === 'home') {
                $this->seedHomeServiceBlocks($page);
            }
        }
    }

    private function seedNavigation(TongzhuoCmsSite $site): void
    {
        // Keep the public navigation order deterministic while preserving
        // visibility and other CMS-managed settings for existing items.
        $navigation = [
            ['label' => '首页', 'url' => 'index.html', 'sort_order' => 1],
            ['label' => '关于我们', 'url' => 'about.html', 'sort_order' => 2],
            ['label' => '产品中心', 'url' => 'products.html', 'sort_order' => 3],
            ['label' => '服务案例', 'url' => 'cases.html', 'sort_order' => 4],
            ['label' => '创始团队', 'url' => 'team.html', 'sort_order' => 5],
            ['label' => '荣誉资质', 'url' => 'honors.html', 'sort_order' => 6],
            ['label' => '行业资讯', 'url' => 'insights.html', 'sort_order' => 7],
            ['label' => '常见问题', 'url' => 'issues.html', 'sort_order' => 8],
            ['label' => '加入我们', 'url' => 'careers.html', 'sort_order' => 9],
            ['label' => '联系方式', 'url' => 'contact.html', 'sort_order' => 10],
        ];

        foreach ($navigation as $item) {
            $navigationItem = TongzhuoCmsNavigationItem::query()->firstOrCreate(
                ['site_id' => $site->id, 'area' => 'header', 'label' => $item['label']],
                [
                    'page_id' => null,
                    'url' => $item['url'],
                    'sort_order' => $item['sort_order'],
                    'is_visible' => true,
                    'settings' => [],
                ]
            );

            if ($navigationItem->sort_order !== $item['sort_order']) {
                $navigationItem->update(['sort_order' => $item['sort_order']]);
            }
        }
    }

    private function seedHomeServiceBlocks(TongzhuoCmsPage $page): void
    {
        $definitions = [
            ['key' => 'service-geo', 'label' => '服务卡片：GEO优化', 'heading' => 'GEO优化', 'body' => '建设企业官网信源、行业观点、FAQ 与结构化数据，让 AI 搜索更准确地理解和引用企业。', 'button_label' => '了解服务', 'button_url' => 'product-website.html'],
            ['key' => 'service-video', 'label' => '服务卡片：短视频运营', 'heading' => '短视频运营', 'body' => '把产品、案例、工厂实力和客户问题转成持续内容，让真实业务能力进入客户决策。', 'button_label' => '了解服务', 'button_url' => 'product-content-platform.html'],
            ['key' => 'service-ai', 'label' => '服务卡片：企业AI落地', 'heading' => '企业AI落地', 'body' => '从企业知识库、销售助手和内容工作流开始，把 AI 放进真实业务流程。', 'button_label' => '了解服务', 'button_url' => 'product-distribution.html'],
        ];

        foreach ($definitions as $offset => $definition) {
            TongzhuoCmsPageBlock::query()->firstOrCreate(
                ['page_id' => $page->id, 'block_key' => $definition['key']],
                [
                    'type' => 'cards',
                    'label' => $definition['label'],
                    'sort_order' => 10 + $offset,
                    'is_visible' => true,
                    'content' => [
                        'heading' => $definition['heading'],
                        'body' => $definition['body'],
                        'button_label' => $definition['button_label'],
                        'button_url' => $definition['button_url'],
                    ],
                    'settings' => [],
                ]
            );
        }
    }

    /** @param array<string, string> $definition
     *  @return array<string, string> */
    private function defaultHeroContent(array $definition): array
    {
        if ($definition['slug'] === 'home') {
            return [
                'eyebrow' => 'Tongzhuo AI Growth',
                'heading' => "让企业被AI看见，\n被客户选择",
                'body' => '桐灼（淄博）网络科技有限公司，围绕 GEO 优化、短视频运营和企业 AI 落地，帮助企业建立能被搜索、AI 和客户共同理解的增长资产。',
                'button_label' => '预约业务诊断',
                'button_url' => 'contact.html',
            ];
        }

        return [
            'eyebrow' => $definition['navigation_label'],
            'heading' => $definition['title'],
            'body' => $definition['description'],
            'button_label' => $definition['slug'] === 'contact' ? '提交沟通需求' : '预约沟通',
            'button_url' => $definition['slug'] === 'contact' ? '#contact-form' : 'contact.html',
        ];
    }

    private function replaceNavigation(string $html, TongzhuoCmsPage $page, string $brand): string
    {
        $items = TongzhuoCmsNavigationItem::query()
            ->where('site_id', $page->site_id)
            ->where('area', 'header')
            ->where('is_visible', true)
            ->orderBy('sort_order')
            ->get();

        if ($items->isEmpty()) {
            return $html;
        }

        $links = '';
        foreach ($items as $item) {
            $url = ltrim((string) $item->url, '/') ?: 'index.html';
            $active = '/'.ltrim($url, '/') === $page->path || ($page->path === '/' && $url === 'index.html');
            $links .= '<a'.($active ? ' class="active"' : '').' href="/'.e($url).'">'.e($item->label).'</a>';
        }

        $nav = '<nav class="corp-links" aria-label="主导航">'.$links.'</nav>';
        $html = preg_replace('/<nav\s+class="corp-links"\s+aria-label="主导航">.*?<\/nav>/is', $nav, $html, 1) ?? $html;
        $html = preg_replace('/(<span>)(桐灼科技)(<\/span>)/u', '$1'.e($brand).'$3', $html, 1) ?? $html;

        return $html;
    }

    private function replaceHero(string $html, TongzhuoCmsPage $page): string
    {
        $hero = $page->blocks->firstWhere('block_key', 'hero');
        $content = $hero?->content ?? [];
        $heading = trim((string) ($content['heading'] ?? ''));
        $body = trim((string) ($content['body'] ?? ''));
        $eyebrow = trim((string) ($content['eyebrow'] ?? ''));

        if ($heading !== '') {
            $html = preg_replace('/(<h1\b[^>]*>).*?(<\/h1>)/isu', '$1'.nl2br(e($heading)).'$2', $html, 1) ?? $html;
        }
        if ($body !== '') {
            $html = preg_replace('/(<h1\b[^>]*>.*?<\/h1>\s*<p\b[^>]*>).*?(<\/p>)/isu', '$1'.e($body).'$2', $html, 1) ?? $html;
        }
        if ($eyebrow !== '') {
            $html = preg_replace('/(<span\s+class="(?:eyebrow|home-kicker)"[^>]*>).*?(<\/span>)/isu', '$1'.e($eyebrow).'$2', $html, 1) ?? $html;
        }

        return $html;
    }

    private function replaceHomeServiceCards(string $html, TongzhuoCmsPage $page): string
    {
        $keys = ['service-geo', 'service-video', 'service-ai'];
        $blocks = $page->blocks->keyBy('block_key');
        $index = 0;

        return preg_replace_callback('/<article class="home-service-card">.*?<\/article>/is', function (array $match) use (&$index, $keys, $blocks): string {
            $key = $keys[$index] ?? null;
            $index++;
            $block = $key ? $blocks->get($key) : null;
            if (! $block instanceof TongzhuoCmsPageBlock || ! $block->is_visible) {
                return $match[0];
            }

            $content = $block->content ?? [];
            $heading = trim((string) ($content['heading'] ?? '服务内容'));
            $body = trim((string) ($content['body'] ?? ''));
            $label = trim((string) ($content['button_label'] ?? '了解服务'));
            $url = trim((string) ($content['button_url'] ?? 'contact.html'));
            $number = str_pad((string) $index, 2, '0', STR_PAD_LEFT);

            return '<article class="home-service-card"><span>'.$number.'</span><h3>'.e($heading).'</h3><p>'.e($body).'</p><a href="'.e($url).'">'.e($label).' →</a></article>';
        }, $html, 3) ?? $html;
    }

    private function renderRuntimeBlocks(TongzhuoCmsPage $page): string
    {
        $blocks = $page->blocks
            ->filter(fn (TongzhuoCmsPageBlock $block): bool => $block->is_visible && $block->block_key !== 'hero' && ! str_starts_with($block->block_key, 'service-'));

        if ($blocks->isEmpty()) {
            return '';
        }

        $html = '<section class="cms-runtime-section"><div class="corp-shell cms-runtime-grid">';
        foreach ($blocks as $block) {
            $content = $block->content ?? [];
            $heading = trim((string) ($content['heading'] ?? $block->label ?? '内容模块'));
            $body = trim((string) ($content['body'] ?? ''));
            $label = trim((string) ($content['button_label'] ?? ''));
            $url = trim((string) ($content['button_url'] ?? ''));
            $html .= '<article class="cms-runtime-block"><span>官网内容模块</span><h2>'.e($heading).'</h2>';
            if ($body !== '') {
                $html .= '<p>'.nl2br(e($body)).'</p>';
            }
            if ($label !== '' && $url !== '') {
                $html .= '<a href="'.e($url).'">'.e($label).' <b>→</b></a>';
            }
            $html .= '</article>';
        }

        return $html.'</div></section>';
    }
}
