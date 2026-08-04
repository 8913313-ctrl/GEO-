@php
  $published = $article->published_at ?? $article->created_at;
  $updated = $article->updated_at ?? $published;
  $authorName = $article->author?->name ?? '妗愮伡鐮旂┒';
  $categoryName = $article->category?->name ?? '琛屼笟瑙傜偣';
  $readingMinutes = max(1, (int) ceil(mb_strlen(strip_tags($contentHtml)) / 500));
  $identity = $identity ?? [];
  $baseUrl = rtrim((string) ($identity['base_url'] ?? url('/')), '/');
  $brandName = (string) ($identity['brand_name'] ?? '妗愮伡绉戞妧');
  $companyName = (string) ($identity['company_name'] ?? '妗愮伡锛堟穭鍗氾級缃戠粶绉戞妧鏈夐檺鍏徃');
  $footerSummary = (string) ($identity['footer_summary'] ?? '妗愮伡锛堟穭鍗氾級缃戠粶绉戞妧鏈夐檺鍏徃锛屼笓娉℅EO浼樺寲銆佺煭瑙嗛杩愯惀涓庝紒涓欰I钀藉湴銆?);
  $articleSchema = [
    chr(64).'context' => 'https://schema.org',
    '@graph' => [
      [
        '@type' => 'Article',
        'headline' => $article->title,
        'description' => $pageDescription,
        'datePublished' => optional($published)->toAtomString(),
        'dateModified' => optional($updated)->toAtomString(),
        'inLanguage' => 'zh-CN',
        'author' => ['@type' => 'Organization', 'name' => $authorName],
        'publisher' => ['@type' => 'Organization', 'name' => $companyName],
        'keywords' => $tags,
        'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $canonicalUrl],
      ],
      [
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
          ['@type' => 'ListItem', 'position' => 1, 'name' => '棣栭〉', 'item' => $baseUrl.'/'],
          ['@type' => 'ListItem', 'position' => 2, 'name' => '琛屼笟璧勮', 'item' => $baseUrl.'/insights.html'],
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
  <title>{{ $article->title }}锝渰{ $brandName }}</title>
  <meta name="description" content="{{ $pageDescription }}">
  <meta name="author" content="{{ $authorName }}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <link rel="canonical" href="{{ $canonicalUrl }}">
  <link rel="alternate" type="application/rss+xml" title="{{ $brandName }}琛屼笟璧勮" href="{{ $baseUrl }}/feed.xml">
  <meta property="og:title" content="{{ $article->title }}">
  <meta property="og:description" content="{{ $pageDescription }}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{{ $canonicalUrl }}">
  <meta property="og:site_name" content="{{ $brandName }}">
  <meta name="theme-color" content="#fbfbfa">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="/assets/wukong-overrides.css">
  <script type="application/ld+json">{!! json_encode($articleSchema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
</head>
<body>
  <a class="skip-link" href="#article">璺冲埌姝ｆ枃</a>
  <header class="site-header"><div class="shell nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>{{ $brandName }}</span></a><nav class="nav-links" aria-label="涓诲鑸?><a href="/">棣栭〉</a><a href="/products.html">鏈嶅姟</a><a class="active" href="/insights.html">琛屼笟璧勮</a><a href="/about.html">鍏充簬鎴戜滑</a><a href="/contact.html">鑱旂郴鎴戜滑</a></nav><div class="nav-actions"><a class="nav-cta" href="/contact.html">棰勭害涓氬姟璇婃柇</a><button class="menu-toggle" type="button" aria-label="鎵撳紑瀵艰埅" aria-expanded="false">鈽?/button></div></div></header>
  <main>
    <header class="article-hero"><div class="shell"><span class="kicker">{{ $categoryName }}</span><h1>{{ $article->title }}</h1>@if($excerptPlain !== '')<p>{{ $excerptPlain }}</p>@endif<div class="article-meta"><span>浣滆€咃細{{ $authorName }}</span><time datetime="{{ optional($published)->toDateString() }}">鍙戝竷锛歿{ optional($published)->format('Y骞磏鏈坖鏃?) }}</time><time datetime="{{ optional($updated)->toDateString() }}">鏇存柊锛歿{ optional($updated)->format('Y骞磏鏈坖鏃?) }}</time><span>棰勮闃呰锛歿{ $readingMinutes }}鍒嗛挓</span></div></div></header>

    <article class="shell article-layout" id="article" data-geoflow-article data-article-id="{{ $article->id }}">
      <aside class="article-toc" aria-label="鏂囩珷淇℃伅"><strong>鏂囩珷淇℃伅</strong><span>{{ $categoryName }}</span><span>{{ $authorName }}</span><a href="/insights.html">杩斿洖琛屼笟璧勮</a></aside>
      <div class="prose">
        @if($excerptPlain !== '')<div class="answer-box"><strong>鍐呭鎽樿</strong><p>{{ $excerptPlain }}</p></div>@endif
        {!! $contentHtml !!}
        @if(count($tags) > 0)<div class="source-note">涓婚锛歿{ implode('銆?, $tags) }}</div>@endif
        <div class="source-note">鏈枃鐢眥{ $authorName }}鍙戝竷锛屽唴瀹瑰悓姝ヨ嚜妗愮伡 GEO 杩愯惀宸ヤ綔鍙般€傛洿鏂版椂闂达細{{ optional($updated)->format('Y骞磏鏈坖鏃?) }}銆?/div>
      </div>
    </article>

    <section class="contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Build Your Source</span><h2>璁╀紒涓氱煡璇嗭紝鎴愪负AI鍙互鐞嗚В鍜屽紩鐢ㄧ殑鍙俊淇℃簮</h2><p>妗愮伡鎻愪緵浼佷笟瀹炰綋姊崇悊銆佸畼缃戝唴瀹瑰缓璁俱€佸叏鍩熶俊婧愯繍钀ヤ笌AI鍙鎬ф寔缁紭鍖栥€?/p></div><div class="contact-form"><strong style="font-size:24px">浜嗚ВGEO浼樺寲鏈嶅姟</strong><p style="color:var(--muted)">鏌ョ湅閫傜敤浼佷笟銆佹湇鍔″唴瀹瑰拰瀹屾暣瀹炴柦娴佺▼銆?/p><a class="button ink" href="/product-website.html">鏌ョ湅鏈嶅姟璇︽儏 <span class="arrow">鈫?/span></a></div></div></section>
  </main>
  <footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>{{ $brandName }}</span></a><p>{{ $footerSummary }}</p></div><div class="footer-col"><strong>鏈嶅姟</strong><a href="/product-website.html">GEO浼樺寲</a><a href="/product-content-platform.html">鐭棰戣繍钀?/a><a href="/product-distribution.html">浼佷笟AI钀藉湴</a></div><div class="footer-col"><strong>鍐呭</strong><a href="/insights.html">琛屼笟璧勮</a><a href="/article-geo-source.html">GEO鐭ヨ瘑</a></div><div class="footer-col"><strong>鍏徃</strong><a href="/about.html">鍏充簬鎴戜滑</a><a href="/contact.html">鑱旂郴鎴戜滑</a></div></div><div class="shell footer-bottom"><span>漏 2026 {{ $companyName }}</span><span>鍐呭鐢辨鐏肩爺绌跺彂甯?/span></div></footer>
  <script src="/assets/site.js?v=20260712-3"></script>
</body>
</html>
