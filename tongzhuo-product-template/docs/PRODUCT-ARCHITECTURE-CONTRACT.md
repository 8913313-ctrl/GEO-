# 桐灼 GEO 增长工作台产品架构契约

<!-- contract: tongzhuo_geo_growth_architecture_contract -->
<!-- product_loop: company_assets -> geo_diagnosis -> opportunities -> content -> website_ai_endpoints -> distribution -> leads -> customer_delivery -->
<!-- boundary: georank_engine_only desktop_login_only no_public_prices no_customer_secrets -->

这份契约用于约束产品母版，保证它不是一组临时页面，而是一套可以复制交付的企业 GEO 增长系统。任何版本发布前，都要能证明下面的模块、入口和安全边界存在。

## 产品主线

桐灼 GEO 增长工作台围绕一条闭环设计：

```text
企业资料与官网内容
  -> GEO 诊断与 AI 可见性检测
  -> 问题机会与行动方案
  -> 文章、FAQ、页面优化
  -> 官网公开承载与 AI 抓取入口
  -> 分发任务与本地发布执行器
  -> 线索回收、数据复盘、客户项目交付
```

后台页面、脚本和交付文档只要脱离这条闭环，就不应进入正式产品包。

## 后台模块契约

统一后台必须以左侧竖向导航承载以下模块：

| 分区 | 必须包含 | 作用 |
| --- | --- | --- |
| 工作台 | 总览 | 经营数据、待办、风险提醒 |
| 官网 CMS | 官网CMS、页面管理、问题地图、导航管理、全站设置 | 管理官网页面、FAQ、SEO 和 AI 抓取资产 |
| 内容增长 | 行业资讯、内容资产 | 生产文章、沉淀知识、承接 GEO 任务 |
| 客户资产 | 客户线索、客户项目 | 回收咨询、形成交付档案 |
| GEO运营 | GEO工作台、问题机会、AI问答测试、行动方案、分发管理、发布助手、数据复盘 | 完成诊断、选题、任务、分发和复盘 |
| 系统 | 系统配置、账号权限 | 管理模型、Token、权限和底层配置 |

## 官网与 AI 抓取契约

公开站点必须保留以下入口：

- `/index.html`：官网首页。
- `/insights.html` 或动态行业资讯路由：行业资讯列表。
- `/issues.html` 或动态问题地图路由：FAQ / 问题地图。
- `/contact.html` 或动态联系页：客户提交线索。
- `/robots.txt`、`/sitemap.xml`、`/feed.xml`、`/llms.txt`、`/llms-full.txt`：AI 与搜索引擎读取入口。

公开官网不得展示服务价格，不得暴露后台路径、API Token、平台账号、Cookie 或浏览器 Profile。

## GEORank 接入契约

GEORank 只作为 GEO 引擎能力层接入，不替换主后台。

必须保留：

- `GeoEngineClient`：统一引擎接口。
- `LocalGeoEngineClient`：本地规则兜底。
- `RemoteGeoRankEngineClient`：远程 GEORank 兼容接口。
- `GeoEngineManager`：根据配置切换 `local` / `georank`，并在远程失败时回退。
- `GEO_ENGINE_DRIVER`、`GEO_ENGINE_BASE_URL`、`GEO_ENGINE_AUDIT_PATH`、`GEO_ENGINE_API_KEY`、`GEO_ENGINE_TIMEOUT_SECONDS` 配置。

## 发布分发契约

服务器端负责文章、分发任务、设备状态和结果回写；第三方平台登录态必须留在本地 Windows 发布执行器。

必须保留：

- 后台分发管理页面。
- 发布助手 / 发布设备页面。
- 设备注册、心跳、领取任务、结果回写 API。
- 桌面端平台适配器、日志、诊断、导出支持包能力。
- 失败降级为草稿、人工确认或重试，不丢内容。

## 客户交付契约

产品必须能生成客户实例和交付包，并且交付包不能包含客户敏感信息。

必须保留：

- 客户配置样例。
- 客户实例生成脚本。
- 官网包、GEOFlow 服务端覆盖包、桌面发布执行器包。
- 上线预检、烟测、验收清单、客户项目档案、客户成功复盘文档。
- 敏感信息扫描和运行时目录排除。

## 发布前验收

发布母版前至少运行：

```powershell
.\scripts\Test-ProductArchitecture.ps1
.\scripts\Test-ServerOverrides.ps1
.\scripts\Test-Template.ps1
```

这三个脚本分别验证产品结构、服务端覆盖层和完整母版质量。
