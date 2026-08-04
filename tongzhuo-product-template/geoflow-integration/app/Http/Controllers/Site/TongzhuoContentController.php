<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Category;
use App\Support\Site\ArticleHtmlPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
        ]);
    }

    public function feed(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $content = view('tongzhuo.feed', compact('articles'))->render();

        return response("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<?xml-stylesheet type=\"text/xsl\" href=\"/rss.xsl\"?>\n".$content)
            ->header('Content-Type', 'application/rss+xml; charset=UTF-8');
    }

    public function sitemap(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('updated_at')
            ->get(['slug', 'published_at', 'updated_at']);

        $content = view('tongzhuo.sitemap', compact('articles'))->render();

        return response("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".$content)
            ->header('Content-Type', 'application/xml; charset=UTF-8');
    }

    public function llms(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->limit(50)
            ->get(['title', 'slug', 'excerpt', 'published_at']);

        return response()
            ->view('tongzhuo.llms', compact('articles'))
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    public function llmsFull(): Response
    {
        $articles = $this->publishedArticles()
            ->orderByDesc('published_at')
            ->limit(50)
            ->get();

        return response()
            ->view('tongzhuo.llms-full', compact('articles'))
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    /** @return Builder<Article> */
    private function publishedArticles(): Builder
    {
        return Article::query()
            ->with(['category:id,name,slug', 'author:id,name'])
            ->published();
    }
}
