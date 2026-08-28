# 桐灼 GEO 增长套件模板

这是可复制交付的三部分产品模板：

1. 桐灼 GEO Node.js 工作台：负责企业知识、文章、审核、分发任务和线索管理，正式代码位于同级 `tongzhuo-geo-platform-demo/`。
2. AI 友好官网：读取已发布内容，提供行业资讯、文章详情、RSS、Sitemap、llms.txt 和结构化数据。
3. 桌面发布执行器：运行在运营人员 Windows 电脑上，连接 GEOFlow 任务队列和本地平台登录态，负责平台登录、验证码、页面自动化和结果回写。

## 目录

- `website/`：官网静态模板与 AI 抓取入口。
- `desktop-agent/`：新的 Windows 发布执行器骨架，负责设备绑定、心跳、任务轮询和平台浏览器 Profile。
- `publisher-assistant/`：旧版本地发布助手，保留为兼容和迁移参考。
- `docs/`：产品蓝图、发布设备协议和交付边界说明。
- `config/client-config.example.json`：客户交付配置样例。
- `scripts/New-Customer.ps1`：从模板生成一个客户实例。
- `scripts/Test-Template.ps1`：检查目录、配置和本地服务接口。

核心产品架构见 `docs/GEO-GROWTH-OS-ARCHITECTURE.md`。后续官网 CMS、GEO 工作台、GEORank 引擎接入、发布执行器、CustomerOpsBundle 和客户交付模板，都按这份架构推进。

## 发布执行器嵌入工作台

产品主线采用“桐灼 GEO Node.js 工作台 + Windows 桌面发布执行器”：

- Node.js 后台负责写文章、发布官网、创建分发任务、查看设备在线状态和任务状态。
- `desktop-agent/` 安装在运营人员电脑，保存平台登录态，从后台领取任务，打开平台编辑器并回写结果。

旧版 `publisher-assistant/` 作为兼容层保留：

- `publisher-assistant/deploy/`：使用 Docker 在服务器上运行独立发布服务，默认端口为 `19181`，容器异常自动重启。

发布服务的健康检查地址为 `/healthz`。平台账号、Cookie、验证码等登录态不进入模板包；服务端直发仍受平台登录态、风控和页面变化影响，保留草稿回退。

## 生成客户实例

在本目录运行：

```powershell
.\scripts\New-Customer.ps1 `
  -CustomerSlug acme `
  -CompanyName '示例（淄博）网络科技有限公司' `
  -ShortName '示例科技' `
  -SiteUrl 'https://www.example.com' `
  -GeoFlowBaseUrl 'https://flow.example.com' `
  -OutputPath 'D:\Deliveries\acme'
```

脚本会复制官网、GEOFlow 覆盖层、桌面执行器、兼容发布助手和产品文档，替换模板中的默认品牌与地址，并生成客户专属的本地配置。API Token、平台账号、Cookie 和浏览器登录态不会写入模板，也不会进入交付包。

也可以先生成一份经过校验的客户配置文件，再一键生成客户实例和完整交付包：

```powershell
New-Item -ItemType Directory -Force -Path 'D:\Deliveries\configs'

.\scripts\New-CustomerConfig.ps1 `
  -CustomerSlug 'customer-a' `
  -CompanyName '客户（淄博）网络科技有限公司' `
  -ShortName '客户科技' `
  -SiteUrl 'https://www.example.com' `
  -GeoFlowBaseUrl 'https://flow.example.com' `
  -OutputPath 'D:\Deliveries\configs\customer-a.json'

.\scripts\Test-CustomerConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json'

.\scripts\New-CustomerConfigReview.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputPath 'D:\Deliveries\configs\customer-a-CONFIG-REVIEW.md'

.\scripts\New-CustomerDeliveryFromConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputRoot 'D:\Deliveries'
```

配置文件中的 `geoflow.api_token` 必须保持为空。新客户不再把全局 API Token 填到桌面发布执行器里，而是在 GEOFlow 后台生成短时配对码，由执行器换取本机设备凭证。客户专属配置不要长期放在模板 `config/` 目录里，母版发布包只允许带 `client-config.example.json`。

`New-CustomerConfigReview.ps1` 会生成 JSON 和 Markdown 配置评审，列出客户身份、官网/GEOFlow/AI 抓取端点、端口规划、联系信息完整度、上线 warning 和安全边界。正式客户 release 会自动附带这份评审。

正式客户 release 还会自动生成 `*-HANDOFF-CHECKLIST.md` 和 `*-HANDOFF-CHECKLIST.json`，把必交文件、哈希、配置 warning、验收命令、安装后检查和签收负责人整理成一份可归档的交接清单。

`desktop_agent.port` 是主线 Windows 桌面发布执行器端口，默认 `19380`；`publisher_assistant.port` 是旧版兼容发布助手端口，默认 `19180`。两个端口必须不同。客户电脑端口被占用时，优先调整 `desktop_agent.port`，交付包中的健康检查、部署档案和支持诊断包会自动使用该端口。

## 打包桌面执行器

生成客户实例后，可以单独打包 Windows 桌面发布执行器：

```powershell
.\scripts\Package-DesktopAgent.ps1 `
  -Root 'D:\Deliveries\acme' `
  -OutputPath 'D:\Deliveries\acme-desktop-agent.zip' `
  -IncludeEmptyConfig
```

脚本会排除 `node_modules`、浏览器 Profile、日志和临时文件；如果 `.data/config.json` 中存在 API Token，会拒绝打包。

## 生成完整客户交付包

客户实例验收后，可以一键生成完整交付 zip：

```powershell
.\scripts\Package-CustomerDelivery.ps1 `
  -Root 'D:\Deliveries\acme' `
  -OutputPath 'D:\Deliveries\acme-tongzhuo-geo-delivery.zip'
```

交付给客户前，建议执行一次完整链路烟测：

```powershell
.\scripts\Test-CustomerDelivery.ps1
```

这个脚本会临时生成客户实例、打完整交付包、校验外层和内层 manifest、确认版本一致，并检查交付包里没有 `node_modules`、浏览器登录态、运行日志、客户 Token 等不该交付的内容。

客户解压完整交付包后，根目录会有统一入口：

```powershell
.\Start-CustomerDelivery.ps1
```

这个入口可以查看交付摘要、校验包完整性、生成服务器安装命令、准备桌面发布端安装目录、生成售后支持诊断包，并提供回滚指引。

正式安装前可以先生成上线预检报告：

```powershell
.\Start-CustomerDelivery.ps1 -Action PreflightReport
```

预检报告会检查客户 URL、桌面端口规划、部署档案、组件包完整性、必需文档、桌面包预检入口、服务端命令生成能力和本机桌面端健康状态，并输出 JSON/Markdown 方便实施归档。

客户启动会前可以生成上线启动包：

```powershell
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
```

启动包会输出客户端点、角色分工、账号准备、培训议程、首周运营计划和验收目标，便于销售、实施和客户运营人员对齐。

启动会确认完成后，可以生成客户首月 30 天运营计划：

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
```

运营计划会输出 JSON/Markdown，包含 GEO 优化、短视频运营、企业 AI 落地三条服务线的周计划、文章选题、分发节奏、线索复盘和安全边界，适合直接作为客户首月执行日历。

售前演示、客户续费或内部交接时，可以生成客户销售演示包：

```powershell
.\Start-CustomerDelivery.ps1 -Action SalesKit
```

销售演示包会输出 JSON/Markdown，包含产品定位、三条服务线、演示流程、客户访谈问题、异议处理、证据点和下一步动作；公开内容不包含价格，也不会收集客户 Token 或平台账号信息。

客户首月运营结束后，可以生成客户成功复盘：

```powershell
.\Start-CustomerDelivery.ps1 -Action SuccessReview
```

复盘会输出 JSON/Markdown，整理文章、AI 抓取文件、分发任务、发布设备、线索、短视频选题和企业 AI 场景证据，并生成风险复盘、下月计划和续费/扩展讨论材料。

`delivery-manifest.json` 会记录服务端包、桌面端包和官网包的 SHA256 与文件大小；`Start-CustomerDelivery.ps1 -Action Verify` 会核对这些信息。

交付包根目录还会生成 `DELIVERY-SUMMARY.md`，把客户信息、版本、组件包路径、SHA256 和文件大小整理成可读表格，便于实施和客户交接。

交付 zip 本身也可以单独验收：

```powershell
.\scripts\Test-CustomerDeliveryPackage.ps1 `
  -PackagePath 'D:\Deliveries\acme-tongzhuo-geo-delivery.zip' `
  -ExpectedVersion 'X.Y.Z'
```

交付包会包含 GEOFlow 服务器覆盖层部署包、Windows 本地发布助手安装包、AI 友好官网静态包、产品文档、客户实例清单和交付清单。包内不包含平台账号密码、Cookie、浏览器 Profile、客户 API Token 或 `node_modules`。

每个交付 zip 内部都会写入 manifest 和版本号，便于后续升级、售后排查和客户版本确认。

## 产品母版发布

桐灼内部发布一个可复制销售的新版本时，执行：

```powershell
.\scripts\Package-ProductRelease.ps1
```

这个命令会先运行模板校验和客户交付烟测，然后生成版本化产品母版 zip，并写入 `release-manifest.json`。发布流程详见 `docs/RELEASE-PROCESS.md`。

发版前版本号必须保持一致：

```powershell
.\scripts\Test-VersionConsistency.ps1
```

它会检查 `product.json`、桌面端 `package.json`、`package-lock.json`、`src/version.js` 和 `CHANGELOG.md`。

母版发布包生成后会自动验证最终 zip，也可以单独执行：

```powershell
.\scripts\Test-ProductReleasePackage.ps1 `
  -PackagePath 'D:\Releases\tongzhuo-geo-growth-suite-vX.Y.Z.zip' `
  -ExpectedVersion 'X.Y.Z'
```

交付前总验收可以执行：

```powershell
.\scripts\Test-ProductReadiness.ps1 `
  -OutputPath 'D:\Releases\tongzhuo-product-readiness-X.Y.Z.json' `
  -ReleaseOutputPath 'D:\Releases\tongzhuo-geo-growth-suite-vX.Y.Z.zip'
```

它会跑模板校验、客户交付烟测、母版发布包生成和最终 zip 验收，并输出 JSON 验收报告。

## Customer Service Scope

Before kickoff or handoff, generate the customer service scope:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

The output is written under `service-scopes/` as JSON and Markdown. Use it to confirm included service lines, out-of-scope work, customer responsibilities, acceptance criteria, and change-control boundaries. The generated scope does not include public prices, API Tokens, platform passwords, cookies, or browser profiles.

## Customer Product Manual

Before customer kickoff or operator training, generate the customer-readable product manual:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

The output is written under `product-manuals/` as JSON and Markdown. Use it to explain product modules, service lines, core workflows, operator roles, endpoints, first steps, success metrics, and the local platform-login security boundary.

## Publishing Loop Acceptance

Before production acceptance, generate the article-to-distribution publishing-loop acceptance:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

The output is written under `publishing-loop-acceptance/` as JSON and Markdown. Use it to verify official website AI endpoints, GEOFlow distribution and publisher-device endpoints, desktop publisher health, component versions, result-writeback API path, and the local platform-login security boundary.

## Publishing Loop Dry Run

Before using real platform accounts, generate a dry-run fixture for the article-to-publisher loop:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

The output is written under `publishing-loop-dry-runs/` as JSON and Markdown. Use it to verify the simulated article payload, website exposure, desktop publisher job claim, result API payload, per-platform result states, GEOFlow writeback record, and secret-free local-login boundary.

## 交付流程

### 1. 桐灼 GEO 工作台

正式后台使用同级 `tongzhuo-geo-platform-demo/` 的 Node.js 服务。生产环境通过环境变量配置站点名称、站点 URL、后台域名和主题，不把客户信息写死在代码中。

### 2. 官网

官网可以先以静态演示方式验收；正式上线时由 Node.js 官网服务读取同一套已发布文章数据，统一输出行业资讯、文章详情、RSS、Sitemap 和 AI 文件。不要在生产环境同时保留静态占位页和服务端同名路由。

### 3. 桌面发布执行器

客户侧不再运行 `npm start` 或手工打开本地控制台。交付包安装时使用桌面安装脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop-agent\install-desktop.ps1 -InstallAutostart -StartAfterInstall
```

管理员在桐灼 GEO 后台生成 10 分钟有效的配对码，运营电脑安装执行器后输入节点名称和配对码即可绑定。绑定完成后，日常发布动作都从统一后台发起；执行器在本机静默运行，负责平台登录窗口、验证码处理、内容填充、草稿/发布和结果回写。

默认本地健康检查为 `http://127.0.0.1:19380/healthz`。本地诊断页 `http://127.0.0.1:19380` 只给实施和售后排查使用，可以检查服务端口、GEOFlow 地址、设备 ID、绑定状态、最近心跳、可执行平台和后台连接探测。客户日常不需要打开它。

诊断区还可以导出支持报告 JSON，用于售后排查。报告会包含诊断结果、运行日志、平台能力和设备信息，但会脱敏 Token、Cookie、密码、Secret、Authorization 等敏感字段。

### 4. 旧版本地发布助手

`publisher-assistant/` 只作为旧客户迁移和问题复现的兼容层，不作为新客户主线交付入口。新客户统一使用 `desktop-agent/` 发布执行器和后台配对流程。

## 安全边界

- 每个客户使用独立后台实例、数据库、域名和设备凭证。
- 交付前删除 `.data/`、`node_modules/`、日志和浏览器配置目录。
- 不把客户 Token、平台密码、Cookie、验证码或联系人数据打进模板压缩包。
- 公开官网不展示服务价格，内容页面只保留服务范围、方法、事实和联系方式。
- 直接发布受平台登录态、验证码、风控和页面变化影响，产品默认保留草稿回退能力。

## 验收标准

- 官网首页、服务页、行业资讯、文章详情和联系表单可访问。
- `/robots.txt`、`/sitemap.xml`、`/feed.xml`、`/llms.txt` 和 `/llms-full.txt` 可访问。
- GEOFlow 能创建并发布一篇文章，官网能显示同一篇文章。
- 后台能查看客户线索和分发任务。
- 桌面发布执行器能注册设备、心跳、读取任务并打开至少一个已登录平台。
- 草稿模式可回写任务状态；直接发布失败时能明确回退为草稿。
