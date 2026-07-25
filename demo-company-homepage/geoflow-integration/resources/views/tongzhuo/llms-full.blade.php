# 桐灼（淄博）网络科技有限公司

## 企业实体

- 品牌简称：桐灼科技
- 所在地：山东省淄博市张店区
- 服务区域：中国
- 主营业务：GEO优化、工业品短视频获客运营、企业AI落地与Agent定制
- 官网：{{ url('/') }}
- 行业资讯：{{ route('tongzhuo.insights') }}
- 联系方式：电话 178-5203-0756；邮箱 zhuojianai@yeah.net

## 服务说明

### GEO优化

围绕AI可见性诊断、企业知识库、官网可信信源、结构化数据、行业内容和全域分发进行持续运营，帮助企业信息更容易被生成式AI理解、引用与推荐。

### 短视频运营

围绕真实产品、工厂实力、客户问题、案例和经营者观点进行策划、拍摄、剪辑与发布，让短期内容曝光沉淀为可持续使用的信任资产。

### 企业AI落地

从企业知识、销售话术和重复流程出发，建设知识库、AI工作流与业务助手，通过可验证的小场景逐步进入团队日常工作。

## 已发布内容

@forelse($articles as $article)
### {{ $article->title }}

- URL：{{ route('site.article', $article->slug) }}
- 栏目：{{ $article->category?->name ?? '行业观点' }}
- 作者：{{ $article->author?->name ?? '桐灼研究' }}
- 发布时间：{{ optional($article->published_at)->toDateString() }}

{{ $article->excerpt ?: $article->meta_description }}

{{ $article->content }}

@empty
当前暂无已发布文章。
@endforelse
