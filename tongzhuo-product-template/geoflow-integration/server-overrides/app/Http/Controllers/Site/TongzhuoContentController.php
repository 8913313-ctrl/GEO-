<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Category;
use App\Support\Site\ArticleHtmlPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;

class TongzhuoContentController extends Controller
{
    public function home(): View
    {
        $latestArticle = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->first();

        return view('tongzhuo.home', [
            'latestArticle' => $latestArticle,
            'latestSummary' => $latestArticle
                ? ArticleHtmlPresenter::cardSummary($latestArticle, 150)
                : null,
            'identity' => $this->siteIdentity(),
        ]);
    }

    public function insights(Request $request): View
    {
        $categorySlug = trim((string) $request->query('category', ''));
        $selectedCategory = $categorySlug !== ''
            ? Category::query()->where('slug', $categorySlug)->first()
            : null;

        $query = $this->publishedArticles();
        if ($selectedCategory instanceof Category) {
            $query->where('category_id', $selectedCategory->id);
        }

        $articles = $query
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString();

        $featured = $this->publishedArticles()
            ->where('is_featured', true)
            ->orderByDesc('published_at')
            ->first()
            ?? $this->publishedArticles()->orderByDesc('published_at')->first();

        $summaries = [];
        foreach ($articles as $article) {
            $summaries[$article->id] = ArticleHtmlPresenter::cardSummary($article, 180);
        }

        return view('tongzhuo.insights', [
            'articles' => $articles,
            'featured' => $featured,
            'summaries' => $summaries,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'selectedCategory' => $selectedCategory,
            'canonicalUrl' => $selectedCategory
                ? route('tongzhuo.insights', ['category' => $selectedCategory->slug])
                : route('tongzhuo.insights'),
            'identity' => $this->siteIdentity(),
        ]);
    }

    public function feed(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $content = view('tongzhuo.feed', [
            'articles' => $articles,
            'identity' => $this->siteIdentity(),
        ])->render();

        return response("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<?xml-stylesheet type=\"text/xsl\" href=\"/rss.xsl\"?>\n".$content)
            ->header('Content-Type', 'application/rss+xml; charset=UTF-8');
    }

    public function sitemap(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('updated_at')
            ->get(['slug', 'published_at', 'updated_at']);

        $content = view('tongzhuo.sitemap', [
            'articles' => $articles,
            'identity' => $this->siteIdentity(),
        ])->render();

        return response("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".$content)
            ->header('Content-Type', 'application/xml; charset=UTF-8');
    }

    public function robots(): Response
    {
        $identity = $this->siteIdentity();
        $content = "User-agent: *\n"
            ."Allow: /\n"
            ."Disallow: /geo_admin/\n"
            ."Disallow: /api/\n\n"
            ."Sitemap: ".rtrim($identity['base_url'], '/')."/sitemap.xml\n";

        return response($content)->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    public function llms(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->limit(50)
            ->get(['title', 'slug', 'excerpt', 'published_at']);

        return response()
            ->view('tongzhuo.llms', [
                'articles' => $articles,
                'identity' => $this->siteIdentity(),
            ])
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    public function llmsFull(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->limit(50)
            ->get();

        return response()
            ->view('tongzhuo.llms-full', [
                'articles' => $articles,
                'identity' => $this->siteIdentity(),
            ])
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    /** @return Builder<Article> */
    private function publishedArticles(): Builder
    {
        return Article::query()
            ->with(['category:id,name,slug', 'author:id,name'])
            ->published();
    }

    /**
     * @return array<string, string>
     */
    private function siteIdentity(): array
    {
        $defaults = [
            'company_name' => '桐灼（淄博）网络科技有限公司',
            'brand_name' => '桐灼科技',
            'brand_aliases' => '桐灼科技 / 灼见AI',
            'founding_date' => '2025年9月19日',
            'credit_code' => '以国家企业信用信息公示系统为准',
            'address_region' => '山东省',
            'address_locality' => '淄博市张店区',
            'street_address' => '北西六路20甲4号5层A4号',
            'telephone' => '17852030756',
            'telephone_display' => '178 5203 0756',
            'wechat' => 'TZqaKi',
            'email' => '电话或微信优先沟通',
            'service_area' => '中国企业客户',
            'base_url' => rtrim(url('/'), '/'),
        ];

        $path = storage_path('app/tongzhuo-site/identity.json');
        if (! is_file($path)) {
            return $defaults;
        }

        $stored = json_decode((string) File::get($path), true);
        if (! is_array($stored)) {
            return $defaults;
        }

        $identity = array_merge($defaults, $stored);
        $identity['base_url'] = rtrim((string) $identity['base_url'], '/');

        return array_map(fn (mixed $value): string => trim((string) $value), $identity);
    }

    /**
     * @param array<string, string> $identity
     */
    private function publicUrl(array $identity, string $path): string
    {
        return $identity['base_url'].($path === '/' ? '/' : '/'.ltrim($path, '/'));
    }
}
