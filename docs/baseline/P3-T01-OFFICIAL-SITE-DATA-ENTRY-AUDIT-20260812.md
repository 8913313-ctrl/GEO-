# P3-T01 官网数据入口盘点

日期：2026-08-12  
范围：`tongzhuo-geo-platform-demo` 官网渲染、公开快照、CMS、文章与线索链路  
性质：只读审计；本任务未修改运行代码、数据库或部署配置

## 1. 结论

官网正式数据主链已经存在，公开运行时的权威来源是：

```text
当前私有化部署的 workspace_id
→ site_cms_publications 当前发布指针
→ site_cms_releases 不可变 CMS 快照
→ PublicSiteStore 组装公开站点数据
→ site-renderer 服务端渲染
```

正式文章走另一条有发布门的链路：

```text
content_articles.status = published
→ approved_version_id
→ content_article_versions.review_status = approved
→ frozen_at 非空
→ risk_status = passed / warning
→ PublicSiteStore.publishedRows()
→ 官网、sitemap、RSS、llms.txt 共用同一公开文章集合
```

因此，正式官网并不是纯静态项目，也不是直接读取 `FRONTEND_*` 常量。CMS 页面、服务、场景、问题地图和栏目来自当前正式发布快照；文章来自通过审核、冻结和风险门的 SQL 记录；线索写入当前私有化部署的数据库。

但是工程仍保留七类非正式回退：服务、案例、问题地图、文章、分类、导航、旧静态 HTML。生产模式会关闭主要的 `frontendDemo` 内容回退，但静态文件兜底和大量模板级固定营销文案仍然存在。下一任务应将这些回退改成显式开发开关，并保证空数据在生产环境显示明确空状态或 404，而不是自动补演示内容。

## 2. 要求搜索的结果

执行：

```powershell
rg -n "FRONTEND_SERVICES|FRONTEND_CASES|FRONTEND_ARTICLES|FRONTEND_PROBLEM_GROUPS|frontendDemo|site_release" tongzhuo-geo-platform-demo
```

命中集中于：

- `public-site/site-renderer.mjs`：四组演示数据常量及渲染选择逻辑。
- `public-site/site-store.mjs`：`frontendDemo` 开关计算。
- `site-server.mjs`：开发演示文章、演示页面以及生产环境强制关闭逻辑。

没有名为 `site_release` 的现行符号或表。当前对应实现名称是：

- `site_cms_drafts`
- `site_cms_releases`
- `site_cms_publications`

## 3. 页面与数据源映射

| 页面/数据 | 正式权威来源 | 渲染入口 | 非正式回退 |
|---|---|---|---|
| 企业名称、Logo、联系方式、ICP备案、主题 | `site_cms_publications → site_cms_releases.snapshot_json.settings/theme` | `PublicSiteStore.siteConfig()` | `defaultSite()` 提供通用企业占位值；Logo 缺失时显示品牌文字 |
| 页面状态、SEO、路径 | 正式 CMS 快照的 `pages` | `cmsPageForPath()`、`renderFixedPage()` | 快照缺少 `pages` 时使用 `defaultSite().pages` |
| 主导航 | 正式 CMS 快照的 `navItems`，并受已发布页面过滤 | `navigation()` | 开发演示使用完整 `FRONTEND_NAV`；非演示且 CMS 导航为空时使用五项裁剪导航 |
| 首页/服务页模块 | 正式 CMS 快照的 `modules` | `moduleOf()`、各固定页面渲染函数 | 模块缺失时由 `moduleText()` 和页面模板中的固定文案补齐 |
| 服务 | 正式 CMS 快照的 `services` | `frontendServices()` | 仅 `frontendDemo=true` 且字段不是数组时使用 `FRONTEND_SERVICES` |
| 典型场景/案例 | 正式 CMS 快照的 `cases` | `frontendCases()` | 仅 `frontendDemo=true` 且字段不是数组时使用 `FRONTEND_CASES` |
| 问题地图 | 正式 CMS 快照的 `problemGroups` | `frontendProblemGroups()`、`findSiteProblem()` | 仅 `frontendDemo=true` 且字段不是数组时使用 `FRONTEND_PROBLEM_GROUPS` |
| 行业栏目 | 正式 CMS 快照的 `categories` | `PublicSiteStore.categories()` | 渲染器在栏目为空时使用三项 `frontendCategories()` |
| 行业文章 | SQL 正式文章及其已批准冻结版本；工作区 JSON 只允许补充展示字段 | `publishedRows()`、`articles()` | 开发演示且正式文章为 0 时使用 `FRONTEND_ARTICLES` 的六篇内容 |
| sitemap/RSS/llms | 与人类页面相同的正式页面、栏目和文章集合 | `renderSitemap()`、`renderFeed()`、`renderLlms()` | 开发演示可进入演示文章/问题；生产模式关闭 |
| 联系表单 | 页面模板生成；业务线选项来自 CMS `businessLines` | `leadForm()` | 没有业务线时仍保留“业务咨询”固定选项 |
| 公开线索写入 | `POST /api/v1/leads → PublicLeadStore → site_contact_leads` | `site-server.mjs` | 无演示线索回退 |
| 后台线索查看与跟进 | `site_contact_leads`，限定当前 `workspace_id` | `GET /api/v1/site-cms/snapshot`、`PATCH /api/v1/site-cms/leads/:id` | 无跨部署汇总入口 |
| 未被 CMS 接管的静态路径 | `TZ_SITE_STATIC_ROOT` | `serveStatic()` | 未配置时默认指向旧 `demo-company-homepage` 目录 |

## 4. CMS 正式发布链路

### 4.1 初始化优先级

首次初始化当前部署的 CMS 时，`SiteCmsStore.ensureInitialized()` 使用：

```text
workspace_state.state.site.cms
→ 项目种子 projectSeed.site.cms
→ 空对象标准化
```

初始化会同时创建：

- 草稿 `site_cms_drafts`；
- bootstrap 发布版本 `site_cms_releases`；
- 当前正式指针 `site_cms_publications`。

项目种子只参与首次初始化，不应在已有正式发布记录后持续覆盖客户编辑内容。

### 4.2 草稿、发布和回滚

- 后台保存草稿要求 `expectedRevision`，冲突返回 409。
- 发布要求草稿版本未变化，并创建新的不可变 release。
- 回滚不会改写旧 release，而是创建新的 rollback release，同时更新草稿和正式指针。
- 公开站点始终调用 `snapshot({ draft: false })`，不会公开读取草稿。
- 后台预览使用 `snapshot({ draft: true })`，与正式流量隔离。

### 4.3 文章公开门

工作区 JSON 不能把未发布文章变成公开文章。`PublicSiteStore.publishedRows()` 必须同时满足：

1. 当前 `workspace_id`；
2. 文章状态为 `published`；
3. 使用 `approved_version_id`；
4. 版本审核状态为 `approved`；
5. 版本已经冻结；
6. 风险状态为 `passed` 或 `warning`。

工作区 JSON 只可补充 slug、栏目、作者、摘要、时间、关键词和标签等展示字段，不能替换标题、正文、审核状态或冻结状态。

## 5. 演示回退清单

### R1：服务常量

- 文件：`public-site/site-renderer.mjs`
- 常量：`FRONTEND_SERVICES`
- 触发：`site.services` 不是数组，且 `site.frontendDemo === true`。
- 风险：新客户未完成 CMS 初始化时可能误看成桐灼服务。
- 生产现状：正常生产配置默认关闭 `frontendDemo`。
- 后续：P3-T02 改为显式开发夹具，不参与通用生产渲染器的数据决策。

### R2：案例常量

- 常量：`FRONTEND_CASES`
- 触发：`site.cases` 不是数组，且开启演示。
- 页面明确标记“演示内容，非客户案例”，但仍不应进入客户交付生产站。

### R3：问题地图常量

- 常量：`FRONTEND_PROBLEM_GROUPS`
- 触发：`site.problemGroups` 不是数组，且开启演示。
- 额外行为：开发模式可在 CMS 没有 `/problem-map/` 页面时合成页面和详情路由。

### R4：文章常量

- 常量：`FRONTEND_ARTICLES`，共六篇。
- 触发：正式文章集合为空且开启演示。
- `site-server.mjs` 另有 `FRONTEND_DEMO_ARTICLE_SLUGS`，从同一演示文章集合选取文章。
- 风险：开发演示内容可能被误认为真实发布文章；生产保护必须保留。

### R5：分类常量

- 函数：`frontendCategories()`。
- 触发：渲染时栏目集合为空。
- 当前该函数没有单独检查 `frontendDemo`，因此即使正式运行关闭演示，空栏目页面也可能显示 GEO、企业 AI、短视频三项固定分类。
- 这是 P3-T02 的优先修复点。

### R6：导航常量

- 常量：`FRONTEND_NAV`。
- 开发演示使用完整七项导航。
- 非演示时，如果 CMS 导航为空，仍回退到首页、服务、资讯、关于、联系五项。
- 正式系统应区分“旧版快照缺字段”和“客户明确发布空导航”，不能用同一回退处理。

### R7：旧静态站目录

- `site-server.mjs` 的默认 `staticRoot` 是 `demo-company-homepage`。
- 请求顺序为动态 CMS 路由优先，之后才尝试静态文件；`staticPathOwnedByCms()` 防止静态 HTML 覆盖 CMS 已拥有路径。
- 仍然存在的问题：未被 CMS 接管的旧 HTML 可以作为第二内容来源被访问。
- 正式私有化交付应显式配置静态资产目录，并在生产环境只允许资源文件或经过清单批准的兼容页面。

### R8：通用站点默认值

- `defaultSite()` 提供“企业官网”“企业”、默认页面和默认导航。
- 这些值用于空白部署的结构安全，不属于客户数据。
- 生产交付验收应阻止仍使用占位企业名称的站点上线，而不是把占位内容当成正式发布。

### R9：模板级固定文案

- 首页、服务页、案例页、问题地图、关于页和联系页仍有大量写死在 `site-renderer.mjs` 的标题、说明、标签和 CTA。
- 这些并非 `FRONTEND_*` 记录，但同样会让不同客户网站呈现桐灼的固定叙事。
- P3-T02 只处理演示数据开关；模板固定文案应在后续 CMS 字段改造中逐步进入行业模板或项目 CMS，不能与演示常量清理混为一次大改。

## 6. 生产环境保护

当前已有两层保护：

1. `PublicSiteStore` 在 `NODE_ENV=production` 时默认令 `frontendDemo=false`；只有非生产的 `tongzhuo-geo` 项目种子默认开启。
2. `site-server.mjs` 的 `publishedRuntimeSnapshot()` 在生产运行时再次强制关闭 `frontendDemo`，即使快照意外带入 true 也不会渲染演示内容。

这两层保护应保留。P3-T02 的目标不是删除开发演示能力，而是把它变成明确、可审计、无法误入生产的开发开关。

## 7. 线索链路

公开表单只向当前客户官网的 `/api/v1/leads` 发送：

- 姓名、联系方式为必填；
- 企业、服务、官网、问题描述和来源 URL 为可选；
- 未知字段被忽略；
- 来源 URL 只接受无账号密码的 HTTP/HTTPS 地址；
- 服务端按 IP 限流；
- 保存到当前部署 `workspace_id` 下的 `site_contact_leads`。

后台通过受权限保护的 CMS 接口读取当前部署线索并更新状态、负责人、下次跟进时间和跟进记录。浏览器没有跨客户查询接口，公开站也没有线索列表接口。

尚未完成的闭环：来源快照、UTM/首次与末次来源、有效线索、商机和成交归因仍不完整；这些属于后续 P3/P7 范围，不在本只读任务中修改。

## 8. 真实本地数据库基线

只读取计数、版本和集合规模，没有读取或输出文章正文、联系人、Token、Cookie 或客户知识。

```text
CMS 正式工作区：default
CMS 正式版本：v1
发布操作：bootstrap
CMS schemaVersion：2
页面：7
导航：7
服务：3
场景：3
问题组：3
栏目：1
正式发布文章：0
已审核并冻结且风险合格的文章版本：0
线索：0
CMS release：1
```

这说明当前本地官网能展示 CMS bootstrap 内容，但尚未证明“真实文章生产 → 审核 → 官网发布 → 线索 → 后台跟进”的桐灼业务闭环已经完成。

另一个需要后续处理的配置问题是：当前正式记录属于 `workspace_id=default`，而桐灼项目种子的身份是 `tenant_tongzhuo_geo`。在迁移或正式部署前必须形成一次受控、可回滚的项目身份迁移，不能在本任务中直接改库。

## 9. P3-T02 输入清单

下一任务只应处理“演示数据改成显式开发开关”，建议边界如下：

1. 建立单一 `TZ_SITE_DEMO_FIXTURES` 开关，默认关闭，生产环境即使配置为 true 也拒绝启动或强制关闭并记录告警。
2. 将服务、案例、问题、文章、分类、导航统一受该开关控制。
3. CMS 明确发布空数组时必须保持为空；不得因为空数组而回退。
4. 快照缺少旧字段时只进行一次有审计的 schema migration，不在每次渲染时猜测。
5. 生产站空数据使用空状态或 404，不生成演示记录。
6. 将旧静态 HTML 路径从内容回退改成明确兼容清单；静态 CSS、JS、图片继续允许。
7. 增加测试：开发显式开启可见、默认关闭不可见、生产强制不可见、空数组不回退、CMS/SQL 正式内容优先、机器端点不泄漏演示内容。

## 10. P3-T01 验收

- 已确认 `site-renderer.mjs`、`site-store.mjs`、`lead-store.mjs` 和 CMS API 的数据流。
- 已列出页面、CMS、文章、机器端点和线索的正式数据源。
- 已列出全部演示记录回退及静态 HTML 第二来源。
- 已确认生产演示保护及其边界。
- 已建立真实本地数据库的非敏感基线。
- 本任务没有修改运行代码或数据库。

