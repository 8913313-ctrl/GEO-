@php
  $published = $article->published_at ?? $article->created_at;
  $updated = $article->updated_at ?? $published;
  $authorName = $article->author?->name ?? '桐灼研究';
  $categoryName = $article->category?->name ?? '行业观点';
  $readingMinutes = max(1, (int) ceil(mb_strlen(strip_tags($contentHtml)) / 500));
  $articleSchema = [
    '@context' => 'https://schema.org',
    '@graph' => [
      [
        '@type' => 'Article',
        'headline' => $article->title,
        'description' => $pageDescription,
        'datePublished' => optional($published)->toAtomString(),
        'dateModified' => optional($updated)->toAtomString(),
        'inLanguage' => 'zh-CN',
        'author' => ['@type' => 'Organization', 'name' => $authorName],
        'publisher' => ['@type' => 'Organization', 'name' => '桐灼（淄博）网络科技有限公司'],
        'keywords' => $tags,
        'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $canonicalUrl],
      ],
      [
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
          ['@type' => 'ListItem', 'position' => 1, 'name' => '首页', 'item' => url('/')],
          ['@type' => 'ListItem', 'position' => 2, 'name' => '行业资讯', 'item' => route('tongzhuo.insights')],
          ['@type' => 'ListItem', 'position' => 3, 'name' => $article->title, 'item' => $canonicalUrl],
        ],
      ],
    ],
  ];
@endphp
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ $article->title }}｜桐灼科技</title>
  <meta name="description" content="{{ $pageDescription }}">
  <meta name="author" content="{{ $authorName }}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <link rel="canonical" href="{{ $canonicalUrl }}">
  <link rel="alternate" type="application/rss+xml" title="桐灼科技行业资讯" href="{{ route('tongzhuo.feed') }}">
  <meta property="og:title" content="{{ $article->title }}">
  <meta property="og:description" content="{{ $pageDescription }}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{{ $canonicalUrl }}">
  <meta property="og:site_name" content="桐灼科技">
  <meta name="theme-color" content="#fbfbfa">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/wukong-overrides.css">
  <script type="application/ld+json">{!! json_encode($articleSchema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
</head>
<body>
  <a class="skip-link" href="#article">跳到正文</a>
  <header class="site-header"><div class="shell nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><nav class="nav-links" aria-label="主导航"><a href="/">首页</a><a href="/products.html">服务</a><a class="active" href="{{ route('tongzhuo.insights') }}">行业资讯</a><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></nav><div class="nav-actions"><a class="nav-cta" href="/contact.html">预约业务诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button></div></div></header>
  <main>
    <header class="article-hero"><div class="shell"><span class="kicker">{{ $categoryName }}</span><h1>{{ $article->title }}</h1>@if($excerptPlain !== '')<p>{{ $excerptPlain }}</p>@endif<div class="article-meta"><span>作者：{{ $authorName }}</span><time datetime="{{ optional($published)->toDateString() }}">发布：{{ optional($published)->format('Y年n月j日') }}</time><time datetime="{{ optional($updated)->toDateString() }}">更新：{{ optional($updated)->format('Y年n月j日') }}</time><span>预计阅读：{{ $readingMinutes }}分钟</span></div></div></header>

    <article class="shell article-layout" id="article" data-geoflow-article data-article-id="{{ $article->id }}">
      <aside class="article-toc" aria-label="文章信息"><strong>文章信息</strong><span>{{ $categoryName }}</span><span>{{ $authorName }}</span><a href="{{ route('tongzhuo.insights') }}">返回行业资讯</a></aside>
      <div class="prose">
        @if($excerptPlain !== '')<div class="answer-box"><strong>内容摘要</strong><p>{{ $excerptPlain }}</p></div>@endif
        {!! $contentHtml !!}
        @if(count($tags) > 0)<div class="source-note">主题：{{ implode('、', $tags) }}</div>@endif
        <div class="source-note">本文由{{ $authorName }}发布，内容同步自桐灼 GEO 运营工作台。更新时间：{{ optional($updated)->format('Y年n月j日') }}。</div>
      </div>
    </article>

    <section class="contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Build Your Source</span><h2>让企业知识，成为AI可以理解和引用的可信信源</h2><p>桐灼提供企业实体梳理、官网内容建设、全域信源运营与AI可见性持续优化。</p></div><div class="contact-form"><strong style="font-size:24px">了解GEO优化服务</strong><p style="color:var(--muted)">查看适用企业、服务内容和完整实施流程。</p><a class="button ink" href="/product-website.html">查看服务详情 <span class="arrow">→</span></a></div></div></section>
  </main>
  <footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><p>桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。</p></div><div class="footer-col"><strong>服务</strong><a href="/product-website.html">GEO优化</a><a href="/product-content-platform.html">短视频运营</a><a href="/product-distribution.html">企业AI落地</a></div><div class="footer-col"><strong>内容</strong><a href="{{ route('tongzhuo.insights') }}">行业资讯</a><a href="/article-geo-source.html">GEO知识</a></div><div class="footer-col"><strong>公司</strong><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></div></div><div class="shell footer-bottom"><span>© 2026 桐灼（淄博）网络科技有限公司</span><span>内容由桐灼研究发布</span></div></footer>
  <script src="/assets/site.js?v=20260712-3"></script>
</body>
</html>
