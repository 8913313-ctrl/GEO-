<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Support\Site\ArticleHtmlPresenter;
use App\Support\Site\ArticleStickyAdPicker;
use App\Support\Site\SiteSettingsBag;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * 前台文章详情：浏览计数、Markdown 正文和相关文章。
 */
class ArticleController extends Controller
{
    public function show(string $slug): View
    {
        $article = Article::query()
            ->published()
            ->where('slug', $slug)
            ->with(['category', 'author'])
            ->first();

        if (! $article instanceof Article) {
            throw new NotFoundHttpException(__('site.article_not_found'));
        }

        $article->increment('view_count');
        $article->refresh();

        $map = SiteSettingsBag::all();
        $siteTitle = (string) ($map['site_name'] ?? config('geoflow.site_name', config('app.name')));
        $siteDescription = (string) ($map['site_description'] ?? config('geoflow.site_description', ''));

        $rawContent = (string) $article->content;
        $body = ArticleHtmlPresenter::stripLeadingTitleHeading($rawContent, (string) $article->title);
        $excerpt = trim((string) $article->excerpt);
        if ($excerpt !== '') {
            $excerpt = ArticleHtmlPresenter::stripLeadingTitleHeading($excerpt, (string) $article->title);
        }

        $contentHtml = ArticleHtmlPresenter::markdownToHtml($body);

        $tags = $this->keywordTags((string) $article->keywords);

        $related = Article::query()
            ->published()
            ->where('category_id', $article->category_id)
            ->whereKeyNot($article->id)
            ->inRandomOrder()
            ->limit(6)
            ->get(['id', 'title', 'slug']);

        $pageTitle = $article->title.' - '.$siteTitle;
        $pageDescription = $excerpt !== '' ? $excerpt : ArticleHtmlPresenter::cardSummary($article, 160);

        $stickyAd = ArticleStickyAdPicker::firstEnabled();
        $identity = $this->siteIdentity();
        $canonicalUrl = rtrim($identity['base_url'], '/').'/article/'.$article->slug;

        return view('tongzhuo.article', [
            'activeNav' => 'article',
            'article' => $article,
            'contentHtml' => $contentHtml,
            'excerptPlain' => $excerpt,
            'tags' => $tags,
            'relatedArticles' => $related,
            'siteTitle' => $siteTitle,
            'siteDescription' => $siteDescription,
            'siteKeywords' => '',
            'pageTitle' => $pageTitle,
            'pageDescription' => $pageDescription,
            'stickyAd' => $stickyAd,
            'canonicalUrl' => $canonicalUrl,
            'identity' => $identity,
        ]);
    }

    /**
     * @return list<string>
     */
    private function keywordTags(string $keywords): array
    {
        $keywords = trim($keywords);
        if ($keywords === '') {
            return [];
        }

        $parts = preg_split('/[,，、;；\s]+/u', $keywords) ?: [];

        $out = [];
        foreach ($parts as $part) {
            $t = trim((string) $part);
            if ($t !== '' && ! in_array($t, $out, true)) {
                $out[] = $t;
            }
        }

        return array_slice($out, 0, 12);
    }

    /**
     * @return array<string, string>
     */
    private function siteIdentity(): array
    {
        $defaults = [
            'company_name' => '桐灼（淄博）网络科技有限公司',
            'brand_name' => '桐灼科技',
            'footer_summary' => '桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。',
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
}
