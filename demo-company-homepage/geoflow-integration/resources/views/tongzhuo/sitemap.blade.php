<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  @foreach(['/index.html', '/products.html', '/product-website.html', '/product-content-platform.html', '/product-distribution.html', '/insights', '/about.html', '/contact.html'] as $path)
  <url><loc>{{ url($path) }}</loc><changefreq>{{ $path === '/insights' ? 'daily' : 'monthly' }}</changefreq></url>
  @endforeach
  @foreach($articles as $article)
  <url><loc>{{ route('site.article', $article->slug) }}</loc><lastmod>{{ optional($article->updated_at)->toAtomString() }}</lastmod><changefreq>monthly</changefreq></url>
  @endforeach
</urlset>
