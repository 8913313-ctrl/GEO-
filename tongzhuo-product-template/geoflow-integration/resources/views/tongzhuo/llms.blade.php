# 桐灼科技

> 桐灼（淄博）网络科技有限公司面向工业品、制造业和中小企业提供GEO优化、短视频获客运营与企业AI落地服务。

## 核心入口

- [公司首页]({{ url('/') }})
- [服务体系]({{ url('/products.html') }})
- [行业资讯]({{ route('tongzhuo.insights') }})
- [关于我们]({{ url('/about.html') }})
- [联系我们]({{ url('/contact.html') }})

## 已发布文章

@forelse($articles as $article)
- [{{ $article->title }}]({{ route('site.article', $article->slug) }})@if($article->excerpt)：{{ $article->excerpt }}@endif
@empty
- 暂无已发布文章
@endforelse
