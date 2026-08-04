# 交付检查清单

## 交付产物

- GEOFlow 工作台覆盖层：`geoflow-integration/`
- AI 友好官网：`website/`
- Windows 桌面发布执行器：`desktop-agent/`
- 产品说明和协议文档：`docs/`
- 客户实例清单：`customer-manifest.json`

## 生成客户实例

```powershell
.\scripts\New-Customer.ps1 `
  -CustomerSlug customer-a `
  -CompanyName '客户网络科技有限公司' `
  -ShortName '客户科技' `
  -SiteUrl 'https://www.example.com' `
  -GeoFlowBaseUrl 'https://flow.example.com' `
  -OutputPath 'D:\Deliveries\customer-a'
```

推荐实施方式是先生成客户配置文件，然后一键生成客户实例和交付包：

```powershell
New-Item -ItemType Directory -Force -Path 'D:\Deliveries\configs'

.\scripts\New-CustomerConfig.ps1 `
  -CustomerSlug 'customer-a' `
  -CompanyName '客户网络科技有限公司' `
  -ShortName '客户科技' `
  -SiteUrl 'https://www.example.com' `
  -GeoFlowBaseUrl 'https://flow.example.com' `
  -OutputPath 'D:\Deliveries\configs\customer-a.json'

.\scripts\Test-CustomerConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json'

.\scripts\New-CustomerDeliveryFromConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputRoot 'D:\Deliveries'
```

`geoflow.api_token` 必须留空，避免客户 Token 进入交付包。客户专属配置建议放在交付目录或项目管理目录，不要留在产品模板 `config/` 目录。

## 打包桌面执行器

从客户实例目录运行：

```powershell
.\scripts\Package-DesktopAgent.ps1 `
  -Root 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a-desktop-agent.zip' `
  -IncludeEmptyConfig
```

`Package-DesktopAgent.ps1` 会拒绝打包带有 `apiToken` 的 `.data/config.json`，并排除 `node_modules`、浏览器 Profile、日志和临时文件。使用 `-IncludeEmptyConfig` 时，即使源目录没有 `.data/config.json`，也会生成一个安全的空配置。

桌面执行器 zip 生成后会自动运行独立包验收：

```powershell
.\scripts\Test-DesktopAgentPackage.ps1 `
  -PackagePath 'D:\Deliveries\customer-a-desktop-agent.zip' `
  -ExpectedVersion '1.6.2'
```

这个验收会检查版本、预检入口、安装脚本、核心源码、空配置安全和运行产物排除规则。

## 验收服务器覆盖包

单独交付 GEOFlow 服务器覆盖包时，生成后会自动运行独立验收，也可以手动执行：

```powershell
.\scripts\Test-GeoFlowServerPackage.ps1 `
  -PackagePath 'D:\Deliveries\customer-a-geoflow-overrides.zip' `
  -ExpectedVersion '1.6.2'
```

这个验收会检查版本、安装命令、dry-run 命令、Linux 安装脚本、核心覆盖文件，以及 `.env`、`vendor`、`storage`、`node_modules`、`.data`、日志和临时文件是否被排除。

## 打包并验收 AI 友好官网

单独交付官网静态包时运行：

```powershell
.\scripts\Package-Website.ps1 `
  -Root 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a-ai-readable-website.zip'
```

官网包生成后会自动运行独立验收，也可以手动执行：

```powershell
.\scripts\Test-WebsitePackage.ps1 `
  -PackagePath 'D:\Deliveries\customer-a-ai-readable-website.zip' `
  -ExpectedVersion '1.6.2'
```

这个验收会检查官网首页、服务页、资讯页、联系页、`robots.txt`、`sitemap.xml`、`feed.xml`、`llms.txt`、`llms-full.txt`，并确认公开内容不包含服务价格表达，不包含 `.env`、`.data`、`node_modules`、`vendor`、日志和临时文件。

## 生成完整客户交付包

从客户实例目录运行：

```powershell
.\scripts\Package-CustomerDelivery.ps1 `
  -Root 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a-tongzhuo-geo-delivery.zip'
```

生成交付包后，打包脚本会自动验收最终 zip。也可以单独执行：

```powershell
.\scripts\Test-CustomerDeliveryPackage.ps1 `
  -PackagePath 'D:\Deliveries\customer-a-tongzhuo-geo-delivery.zip' `
  -ExpectedVersion '1.6.2'
```

交付前执行完整链路烟测：

```powershell
.\scripts\Test-CustomerDelivery.ps1
```

烟测会临时生成客户实例、打完整交付 zip、校验外层和内层 manifest、确认版本号一致，并检查敏感配置、浏览器登录态、`node_modules`、运行日志和临时目录没有进入交付包。

交付清单 `delivery-manifest.json` 会记录三个组件包的 SHA256 和文件大小。客户解压后执行：

```powershell
.\Start-CustomerDelivery.ps1 -Action Verify
```

会同时校验组件包版本、SHA256 和文件大小，确认传输后的包没有被替换或损坏。

正式安装前生成上线预检报告：

```powershell
.\Start-CustomerDelivery.ps1 -Action PreflightReport
```

预检报告会输出 JSON 和 Markdown，检查客户 URL、桌面端口规划、部署档案、组件包版本和完整性、必需文档、桌面包预检入口、服务端命令生成能力和本机桌面端健康状态。本机桌面端未启动会记为 warning，安装前不阻断；包损坏、文档缺失、端口规划错误会阻断。

客户启动会前生成上线启动包：

```powershell
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
```

启动包会输出 JSON 和 Markdown，包含客户端点、项目角色、账号准备、客户培训议程、首周运营计划、验收目标和安全边界。它适合交给销售、实施、客户负责人和客户运营人员共同确认。

启动会确认完成后，生成首月 30 天运营计划：

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
```

运营计划会输出 JSON 和 Markdown，覆盖 GEO 优化、短视频运营、企业 AI 落地三条服务线的周计划、文章选题、分发节奏、线索复盘、AI 抓取文件检查和安全边界。它适合交给客户运营人员作为首月执行日历。

售前演示、续费复盘或内部交接时，生成客户销售演示包：

```powershell
.\Start-CustomerDelivery.ps1 -Action SalesKit
```

销售演示包会输出 JSON 和 Markdown，包含产品定位、三条服务线、演示流程、客户访谈问题、异议处理、证据点和下一步动作。它不包含价格、客户 Token、平台密码、Cookie 或浏览器 Profile。

客户首月运营结束后，生成客户成功复盘：

```powershell
.\Start-CustomerDelivery.ps1 -Action SuccessReview
```

复盘会输出 JSON 和 Markdown，包含文章 URL、AI 抓取文件、分发任务、发布设备、线索、短视频选题、企业 AI 场景、风险、下月计划和续费/扩展讨论材料。

售后或实施排查时，生成脱敏支持诊断包：

```powershell
.\Start-CustomerDelivery.ps1 -Action SupportBundle
```

支持诊断包会输出 JSON 和 Markdown，记录交付包版本、组件包完整性、必需文档、本机桌面端健康探测和建议补充材料。它不包含 API Token、平台密码、Cookie、浏览器 Profile、验证码或截图。

主线 Windows 桌面发布执行器端口来自客户配置 `desktop_agent.port`，默认 `18280`。旧版兼容发布助手端口来自 `publisher_assistant.port`，默认 `18180`。交付前确认两个端口不同；如果客户电脑端口冲突，优先修改 `desktop_agent.port` 并重新生成正式客户交付 release。

客户解压完整交付包后，先运行根目录入口：

```powershell
.\Start-CustomerDelivery.ps1
```

这个入口用于查看交付摘要、执行完整性校验、生成服务器安装命令、准备桌面发布端和查看回滚指引。

完整交付包应包含：

- GEOFlow 服务器覆盖层部署包
- Windows 本地发布助手安装包
- AI 友好官网静态包
- `docs/` 产品文档
- `customer-manifest.json`
- `delivery-manifest.json`
- `DELIVERY-SUMMARY.md`
- `README.md`

每个 zip 包内部都应包含 manifest 文件，并写入与 `product.json` 一致的 `version`。售后排查、升级交付和客户版本确认以 manifest 为准。

## Customer Service Scope

Run this before kickoff, handoff, renewal, or a scope-change discussion:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

Archive the generated JSON and Markdown with the release manifest. The service scope confirms included GEO optimization, short video operations, enterprise AI landing deliverables, out-of-scope items, customer responsibilities, acceptance criteria, and change-control boundaries. It must not include public prices, API Tokens, platform passwords, cookies, or browser profiles.

## Customer Product Manual

Run this before customer kickoff or operator training:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

Archive the generated JSON and Markdown with the release manifest. The product manual explains product modules, service lines, article-to-distribution workflow, operator roles, customer first steps, endpoints, success metrics, and the local platform-login security boundary.

## Publishing Loop Acceptance

Run this before production acceptance:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

Archive the generated JSON and Markdown with the release manifest. The publishing-loop acceptance confirms the official website AI endpoints, GEOFlow distribution endpoints, publisher-device endpoints, desktop health endpoint, component package versions, result-writeback API path, and local-login security boundary are ready before the customer uses the system for real article distribution.

## Publishing Loop Dry Run

Run this before connecting real platform accounts:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

Archive the generated JSON and Markdown with the release manifest when implementation needs protocol evidence. The dry run simulates the article payload, website exposure, desktop publisher job claim, result API payload, per-platform states, and GEOFlow writeback without storing API Tokens, platform passwords, cookies, captcha state, or browser profiles.

## 安装桌面执行器

解压桌面执行器 zip 后，先运行预检：

```powershell
powershell -ExecutionPolicy Bypass -File .\preflight.ps1
```

预检会检查 PowerShell、Node.js、npm、npx、必需文件、本地端口和 `.data` 写入权限。预检通过后再运行安装：

```powershell
powershell -ExecutionPolicy Bypass -File .\install-desktop.ps1 -InstallAutostart -StartAfterInstall
```

默认安装到当前用户目录：`%LOCALAPPDATA%\TongzhuoGEO\DesktopAgent`，并创建桌面快捷方式。升级安装会保留 `.data` 目录。

## 上线前检查

- 公开官网不能出现服务价格。
- `/robots.txt`、`/sitemap.xml`、`/feed.xml`、`/llms.txt`、`/llms-full.txt` 可访问。
- GEOFlow 能创建文章并发布到官网。
- 后台能查看客户线索。
- 后台能查看发布设备和分发任务状态。
- 后台发布设备页面可禁用、恢复和删除本地执行器记录。
- 后台“发布助手”页面展示本地渠道、任务、设备和使用流程，不再依赖旧 iframe 页面。
- 后台“发布助手”页面可一键初始化默认本地发布渠道，默认平台为微信公众号、知乎、头条号和本地导出包。
- 分发管理中新建“桐灼本地发布助手”渠道，渠道类型保存为 `desktop_publisher`。
- 桌面发布执行器健康检查 `http://127.0.0.1:18280/healthz` 可访问。
- 桌面发布执行器“本机诊断”能显示服务端口、GEOFlow 地址、设备 ID、绑定状态、设备凭证存在性、最近心跳、可执行平台和后台连接探测结果。
- 桌面发布执行器能导出支持报告 JSON，报告包含诊断结果和运行日志，且不包含 API Token、Cookie、平台密码等敏感字段。
- 桌面发布执行器能注册设备并上报心跳。
- 桌面发布执行器平台目录与后台分发平台一致，并清楚区分“已适配、可打开、待适配、导出”。
- 桌面发布执行器能为 `zip-download` 任务生成本地导出包，包含 Markdown、HTML、结构化 JSON 和说明文件。
- 分发任务表能在平台结果中展示本地导出包目录，便于运营人员追踪人工发布文件。
- 桌面快捷方式「桐灼 GEO 发布执行器」会静默启动发布节点，不作为客户日常控制台入口。
- 需要后台常驻时，执行 `desktop-agent\install-autostart.ps1` 或安装命令的 `-InstallAutostart` 参数，并确认 Windows 计划任务中存在 `Tongzhuo GEO Desktop Agent`。
- 知乎、微信公众号、头条号至少完成草稿填充验证。

## 不得进入交付包

- 客户 API Token
- 第三方平台密码、Cookie、LocalStorage
- `.data/profiles/`
- `node_modules/`
- 浏览器缓存和截图
- 运行日志
