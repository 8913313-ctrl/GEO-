<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ $selectedCategory?->name ? $selectedCategory->name.'｜' : '' }}行业资讯｜桐灼科技</title>
  <meta name="description" content="桐灼科技持续发布GEO优化、工业品短视频获客和企业AI落地相关行业文章。">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <link rel="canonical" href="{{ $canonicalUrl }}">
  <link rel="alternate" type="application/rss+xml" title="桐灼科技行业资讯" href="{{ route('tongzhuo.feed') }}">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/wukong-overrides.css">
  <script type="application/ld+json">{!! json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'CollectionPage',
    'name' => '桐灼科技行业资讯',
    'url' => $canonicalUrl,
    'publisher' => ['@type' => 'Organization', 'name' => '桐灼（淄博）网络科技有限公司'],
    'mainEntity' => [
      '@type' => 'ItemList',
      'numberOfItems' => $articles->total(),
      'itemListElement' => $articles->values()->map(fn ($article, $index) => [
        '@type' => 'ListItem',
        'position' => $articles->firstItem() + $index,
        'name' => $article->title,
        'url' => route('site.article', $article->slug),
      ])->all(),
    ],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
</head>
<body>
  <a class="skip-link" href="#archive">跳到正文</a>
  <header class="site-header"><div class="shell nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><nav class="nav-links" aria-label="主导航"><a href="/">首页</a><a href="/products.html">服务</a><a class="active" href="{{ route('tongzhuo.insights') }}">行业资讯</a><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></nav><div class="nav-actions"><a class="nav-cta" href="/contact.html">预约业务诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button></div></div></header>
  <main>
    <section class="page-hero blog-hero"><div class="shell"><div><span class="eyebrow">Knowledge &amp; Insights</span><h1>洞察AI搜索与企业增长</h1><p>所有文章均来自GEOFlow已审核、已发布内容，正文由服务端直接输出。</p><div class="actions"><a class="button primary" href="#archive">浏览全部文章 <span class="arrow">↓</span></a><a class="button secondary" href="/contact.html">提交行业问题</a></div></div></div></section>
    <section class="section blog-archive" id="archive"><div class="shell blog-layout"><div class="blog-main"><div class="blog-list-head"><div><span class="kicker">All Articles</span><h2>{{ $selectedCategory?->name ?? '全部文章' }}</h2></div><span>共 {{ $articles->total() }} 篇</span></div>@forelse($articles as $article)<article class="blog-entry" data-geoflow-article data-article-id="{{ $article->id }}"><time datetime="{{ optional($article->published_at)->toDateString() }}" class="blog-date"><strong>{{ optional($article->published_at)->format('d') }}</strong><span>{{ optional($article->published_at)->format('Y.m') }}</span></time><div class="blog-entry-body"><div class="blog-meta"><span>{{ $article->category?->name ?? '行业观点' }}</span><span>{{ $article->author?->name ?? '桐灼研究' }}</span></div><h3><a href="{{ route('site.article', $article->slug) }}">{{ $article->title }}</a></h3><p>{{ $summaries[$article->id] ?? $article->excerpt }}</p></div><a class="blog-entry-link" href="{{ route('site.article', $article->slug) }}" aria-label="阅读{{ $article->title }}">→</a></article>@empty<p class="blog-empty">当前栏目暂无已发布文章。</p>@endforelse{{ $articles->links() }}</div><aside class="blog-sidebar"><section class="blog-panel"><span class="blog-panel-label">内容栏目</span><a href="{{ route('tongzhuo.insights') }}"><strong>全部文章</strong></a>@foreach($categories as $category)<a href="{{ route('tongzhuo.insights', ['category' => $category->slug]) }}"><strong>{{ $category->name }}</strong></a>@endforeach</section></aside></div></section>
  </main>
  <footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><p>桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。</p></div><div class="footer-col"><strong>服务</strong><a href="/product-website.html">GEO优化</a><a href="/product-content-platform.html">短视频运营</a><a href="/product-distribution.html">企业AI落地</a></div><div class="footer-col"><strong>内容</strong><a href="{{ route('tongzhuo.insights') }}">行业资讯</a><a href="/article-geo-source.html">GEO知识</a></div><div class="footer-col"><strong>公司</strong><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></div></div><div class="shell footer-bottom"><span>© 2026 桐灼（淄博）网络科技有限公司</span><span>内容由桐灼研究发布</span></div></footer>
  <script src="/assets/site.js?v=20260712-3"></script>
</body>
</html>
