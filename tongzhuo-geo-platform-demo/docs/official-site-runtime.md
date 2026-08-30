# 官网正式运行时

官网由 `site-server.mjs` 独立提供服务，后台仍由 `server.mjs` 提供服务。两个进程共享同一个 `TZ_DATABASE_PATH`，因此后台发布状态、官网文章、机器入口和访问监测来自同一份正式数据。官网进程不暴露管理写入 API。

## 公开门槛

文章同时满足以下条件才会被官网读取：

1. `content_articles.status = published`；
2. `approved_version_id` 指向正式版本；
3. 版本 `review_status = approved`；
4. 版本已有 `frozen_at`；
5. 风险状态为 `passed` 或 `warning`。

工作区 JSON 中的栏目、slug、作者和官网摘要只补充展示元数据，不能绕过以上 SQL 门槛。文章正文始终读取冻结版本并经过服务端 HTML 白名单清洗。

## 运行

```powershell
$env:TZ_DATABASE_PATH='G:\path\tongzhuo-production.sqlite'
$env:TZ_SITE_STATIC_ROOT='G:\path\demo-company-homepage'
$env:TZ_SITE_STATIC_ONLY='true'
$env:TZ_SITE_SPA_FALLBACK='true'
$env:TZ_SITE_BASE_URL='https://www.example.com'
$env:TZ_SITE_BIND_HOST='127.0.0.1'
$env:TZ_SITE_PORT='19080'
npm run start:site
```

## 挂载 React 企业官网

保留 React 官网的样式、动画和交互时，把官网构建产物的 `dist` 目录作为
`TZ_SITE_STATIC_ROOT`。官网服务直接返回该目录的 `index.html` 和 `assets`，React
代码通过同源 `/api/v1/site-public/bootstrap` 读取已发布的通用内容，通过同源
`/api/v1/leads` 写入公开咨询线索；后台和官网共享同一份正式数据库，因此不需要
把行业字段复制进后台表结构。

```powershell
$env:TZ_SITE_STATIC_ROOT='D:\path\to\qiyeguan\dist'
$env:TZ_SITE_STATIC_ONLY='true'
$env:TZ_SITE_SPA_FALLBACK='true'
npm run start:site
```

`TZ_SITE_SPA_FALLBACK=true` 只对 HTML 文档请求将不存在的路径回退到 `index.html`，
用于支持 React 单页路由；不存在的 JS、CSS、图片仍然返回 404。11 套模板共用这
套挂载协议，切换模板只需替换构建产物目录和正式模板 key，不新增行业专用数据库列。
生产容器中的 `/site` 仍然是只读挂载点，部署时将对应模板的 `dist` 挂载到 `/site`。

生产环境通常由 Nginx 或容器向外暴露端口。公开 origin 的优先级为：`TZ_SITE_BASE_URL` → CMS 正式版本中的 `officialDomain`（自动使用 HTTPS）→ 经过校验的请求域名。建议生产部署仍显式配置 `TZ_SITE_BASE_URL`，并在 CMS 中填写同一个主域名，避免 canonical、Schema、Sitemap、RSS 和 llms 使用内部地址。

主要路由：

- `/`、`/services/`、`/about/`、`/contact/`、`/insights/`：只渲染 CMS 正式版本中状态为 `published` 的页面；草稿和归档页返回 404；
- `/insights/`：正式文章列表；分页使用自引用 canonical 和 `prev/next`，非法或越界页返回 404；
- `/insights/category/:slug/`：栏目页；
- `/insights/:slug/`：文章正文；
- `/article/:slug`：旧文章地址兼容入口，301 到 `/insights/:slug/`；
- `/sitemap.xml`、`/feed.xml`、`/robots.txt`、`/llms.txt`、`/llms-full.txt`：从正式发布数据实时生成；
- `/health/live` 与 `/health/ready`：容器健康检查。

## CMS 草稿、预览和发布

后台通过 `/api/v1/site-cms` 读取同一数据库中的 CMS 草稿、正式版本和发布历史。页面、导航、栏目和模块修改先写入草稿；`/api/v1/site-cms/preview` 使用正式官网渲染器生成带 `noindex`、`no-store` 和 `SAMEORIGIN` 保护的预览。只有具备 `content.publish` 权限的账号可以发布或回滚，发布会生成不可变正式版本，官网、sitemap、RSS、robots 和 `llms.txt` 随正式版本切换。

官网文章正文不在 CMS 复制维护。内容生产中心完成写作、人工审核、风险检查和证据冻结后，运营人员在行业资讯中补充栏目、slug、作者和摘要，再调用内容发布 API。草稿、未审核、未冻结或已下线文章不会进入任何公开入口。

## AI 抓取与结构化信源

- 所有正式页面由服务端直接输出完整正文，不依赖 JavaScript 才能读取；每页保持一个 `H1` 和一个 `main`。
- `Organization → WebSite → WebPage` 使用稳定 `@id` 关联；服务、文章、问题与面包屑复用同一企业实体。
- CMS 可维护企业 Logo、电话、邮箱、地址、服务区域和权威主体链接（`sameAs`），发布后进入 Organization Schema。
- 问题地图输出 `FAQPage + Question + acceptedAnswer`；问题详情使用 `WebPage.mainEntity = Question`。
- Article 输出栏目、字数、主题、发布日期、更新时间及允许公开的真实引用；正文中的额外 `H1` 会在公开渲染时降为 `H2`。
- Sitemap、RSS、robots、`llms.txt` 与人类页面使用同一正式发布门槛。行业资讯页面下线后，文章标题、摘要和正文不会继续从机器入口暴露。
- 生产环境强制关闭前端演示数据；CMS 草稿预览始终带 `noindex`。

官网 GET 访问会通过 `MonitoringStore` 写入 `monitoring_access_logs`；原始 IP 不入库，只保存 HMAC 摘要。监测落库失败不会让官网请求失败。

## 验证

```powershell
npm run check:site
```

检查使用临时 SQLite，覆盖旧官网静态页、正式发布门槛、栏目和文章路由、Schema、Sitemap、RSS、robots、llms、HTML 清洗、HEAD/405 和访问日志入库，不修改当前业务数据库。

其中 `scripts/check-site-ai-readiness.mjs` 还会逐项验证正式域名、Sitemap URL 去重与可达性、分页 canonical、语义 HTML、Organization/Article/FAQ 图谱、草稿隔离及栏目下线隔离。
