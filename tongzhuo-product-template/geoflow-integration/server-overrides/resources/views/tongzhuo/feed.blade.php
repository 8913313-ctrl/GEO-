@php
  $identity = $identity ?? [];
  $baseUrl = rtrim((string) ($identity['base_url'] ?? url('/')), '/');
  $brandName = (string) ($identity['brand_name'] ?? '妗愮伡绉戞妧');
@endphp
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{{ $brandName }}璧勮涓庤涓氳鐐?/title>
    <link>{{ $baseUrl }}/insights.html</link>
    <description>GEO浼樺寲銆佸伐涓氬搧鐭棰戣幏瀹笌浼佷笟AI钀藉湴鐨勮涓氳鐐瑰拰瀹炶返鍐呭銆?/description>
    <language>zh-CN</language>
    <atom:link href="{{ $baseUrl }}/feed.xml" rel="self" type="application/rss+xml" />
    @foreach($articles as $article)
    <item>
      <title>{{ $article->title }}</title>
      <link>{{ $baseUrl }}/article/{{ $article->slug }}</link>
      <guid isPermaLink="true">{{ $baseUrl }}/article/{{ $article->slug }}</guid>
      <pubDate>{{ optional($article->published_at)->toRssString() }}</pubDate>
      <author>{{ $article->author?->name ?? '妗愮伡鐮旂┒' }}</author>
      <category>{{ $article->category?->name ?? '琛屼笟瑙傜偣' }}</category>
      <description>{{ $article->excerpt ?: $article->meta_description }}</description>
    </item>
    @endforeach
  </channel>
</rss>
