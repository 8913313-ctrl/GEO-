# GEOFlow 官网资讯接入说明

## 已确认的线上能力

- GEOFlow 运行于 Laravel，文章表支持标题、slug、摘要、Markdown 正文、关键词、描述、作者、栏目、审核状态、发布状态和发布时间。
- 后台支持文章创建、审核、发布、更新和删除。
- 公开文章详情已经采用服务端 Markdown 转 HTML，并生成 canonical URL。
- REST API `/api/v1/articles` 需要 Bearer Token，不应由浏览器直接调用，避免公开密钥。

## 官网接入方式

官网正式部署时作为 GEOFlow 的企业官网主题运行，直接读取同一数据库中的已发布文章：

1. 首页只读取最新已发布文章，用于“资讯与行业观点”模块。
2. 行业资讯页按发布时间倒序分页，并支持栏目筛选。
3. 文章详情使用 `/article/{slug}`，正文由服务端输出完整 HTML。
4. 只允许 `status=published` 且未删除的文章进入公开页面。
5. 发布或更新文章后，同步刷新 RSS、XML Sitemap、llms.txt 与 llms-full.txt 的文章入口。
6. 文章页输出 `Article`、`BreadcrumbList` 和发布者 `Organization` 结构化数据。

## 字段映射

| GEOFlow 字段 | 官网用途 |
|---|---|
| `title` | H1、列表标题、Article headline |
| `slug` | 永久链接 |
| `excerpt` | 列表摘要与 meta description 回退 |
| `content` | Markdown 正文源 |
| `category` | 资讯栏目 |
| `author` | 文章署名 |
| `keywords` | 主题标签 |
| `meta_description` | 页面描述 |
| `published_at` | 首次发布时间 |
| `updated_at` | 最近更新时间 |

## 本地演示边界

当前本地静态站保留一篇真实演示文章，并在 `insights.html` 中标记服务端文章槽位。服务器尚未修改；设计确认后再把静态页面移植为 GEOFlow Blade 主题并完成上线验证。

## 已准备的部署文件

`geoflow-integration/` 已包含可部署到现有 Laravel 项目的核心绑定层：

- `routes/tongzhuo.php`：博客、RSS、Sitemap 和 llms 路由。
- `TongzhuoContentController.php`：只读取 `Article::published()` 数据，支持栏目筛选与分页。
- `insights.blade.php`：服务端渲染博客列表，并输出动态 `ItemList` JSON-LD。
- `feed.blade.php`：从同一批已发布文章生成 RSS。
- `sitemap.blade.php`：自动加入文章 URL 与更新时间。
- `llms.blade.php`：自动列出已发布文章供 AI 系统读取。

部署时需要删除同名静态文件或调整 Nginx `try_files`，把 `/insights`、`/feed.xml`、`/sitemap.xml` 和 `/llms.txt` 交给 Laravel；后台令牌始终只留在服务端。

将 `routes/tongzhuo.php` 复制到 Laravel 的 `routes/` 后，在现有 `routes/web.php` 末尾加入 `require __DIR__.'/tongzhuo.php';`，再复制控制器与 Blade 模板并执行路由、视图缓存刷新。

## 官网客户线索

官网 `contact.html` 的诊断表单直接提交到 GEOFlow 的 `/api/v1/leads`，线索写入 `contact_leads` 表；不打开邮箱客户端，也不做邮件兜底。

后台登录后，在顶部导航进入“客户线索”，可以按状态查看客户姓名、联系电话、企业名称、关注服务、官网或账号和需求内容，并记录跟进备注。

部署这部分时需要：

1. 复制 `server-overrides/app/Models/ContactLead.php`、控制器、视图和路由覆盖文件。
2. 复制 `database/migrations/2026_07_13_000000_create_contact_leads_table.php` 到 GEOFlow 的 `database/migrations/`。
3. 执行 `php artisan migrate --force`。
4. 清理缓存：`php artisan optimize:clear`，然后提交一条测试线索确认后台可见。
