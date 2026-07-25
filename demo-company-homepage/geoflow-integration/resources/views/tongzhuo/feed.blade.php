<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>桐灼科技资讯与行业观点</title>
    <link>{{ route('tongzhuo.insights') }}</link>
    <description>GEO优化、工业品短视频获客与企业AI落地的行业观点和实践内容。</description>
    <language>zh-CN</language>
    <atom:link href="{{ route('tongzhuo.feed') }}" rel="self" type="application/rss+xml" />
    @foreach($articles as $article)
    <item>
      <title>{{ $article->title }}</title>
      <link>{{ route('site.article', $article->slug) }}</link>
      <guid isPermaLink="true">{{ route('site.article', $article->slug) }}</guid>
      <pubDate>{{ optional($article->published_at)->toRssString() }}</pubDate>
      <author>{{ $article->author?->name ?? '桐灼研究' }}</author>
      <category>{{ $article->category?->name ?? '行业观点' }}</category>
      <description>{{ $article->excerpt ?: $article->meta_description }}</description>
    </item>
    @endforeach
  </channel>
</rss>
