@php
  $identity = $identity ?? ['base_url' => rtrim(url('/'), '/')];
  $baseUrl = rtrim((string) ($identity['base_url'] ?? url('/')), '/');
  $pages = [
    ['path' => '/', 'changefreq' => 'weekly', 'priority' => '1.0'],
    ['path' => '/products.html', 'changefreq' => 'monthly', 'priority' => '0.9'],
    ['path' => '/product-website.html', 'changefreq' => 'monthly', 'priority' => '0.9'],
    ['path' => '/product-content-platform.html', 'changefreq' => 'monthly', 'priority' => '0.9'],
    ['path' => '/product-distribution.html', 'changefreq' => 'monthly', 'priority' => '0.9'],
    ['path' => '/insights.html', 'changefreq' => 'weekly', 'priority' => '0.9'],
    ['path' => '/article-geo-source.html', 'changefreq' => 'monthly', 'priority' => '0.8'],
    ['path' => '/about.html', 'changefreq' => 'monthly', 'priority' => '0.8'],
    ['path' => '/cases.html', 'changefreq' => 'monthly', 'priority' => '0.8'],
    ['path' => '/team.html', 'changefreq' => 'monthly', 'priority' => '0.7'],
    ['path' => '/honors.html', 'changefreq' => 'monthly', 'priority' => '0.7'],
    ['path' => '/issues.html', 'changefreq' => 'weekly', 'priority' => '0.8'],
    ['path' => '/careers.html', 'changefreq' => 'monthly', 'priority' => '0.6'],
    ['path' => '/contact.html', 'changefreq' => 'monthly', 'priority' => '0.9'],
  ];
@endphp
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  @foreach($pages as $page)
  <url><loc>{{ $baseUrl }}{{ $page['path'] }}</loc><lastmod>{{ now()->toDateString() }}</lastmod><changefreq>{{ $page['changefreq'] }}</changefreq><priority>{{ $page['priority'] }}</priority></url>
  @endforeach
  @foreach($articles as $article)
  <url><loc>{{ $baseUrl }}/article/{{ $article->slug }}</loc><lastmod>{{ optional($article->updated_at)->toAtomString() }}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  @endforeach
</urlset>
