# 桐灼 GEO 增长套件发布流程

这份流程用于桐灼内部发布一个可复制销售的产品母版。客户交付包从母版生成，母版本身不包含客户 API Token、平台账号、Cookie、浏览器登录态、运行日志、`node_modules` 或临时产物。

## 发布前检查

在产品模板根目录执行：

```powershell
.\scripts\Test-Template.ps1
.\scripts\Test-TemplateSecrets.ps1
.\scripts\Test-VersionConsistency.ps1
.\scripts\Test-CustomerDelivery.ps1
```

如果这次是新版本发布，先用版本升级助手统一更新版本号。默认 dry-run 只输出计划，确认无误后再加 `-Apply`：

```powershell
.\scripts\Update-ProductVersion.ps1 `
  -Version '1.6.3' `
  -ChangelogItem 'Describe the release change here.'

.\scripts\Update-ProductVersion.ps1 `
  -Version '1.6.3' `
  -ChangelogItem 'Describe the release change here.' `
  -Apply
```

这个入口会同步更新 `product.json`、桌面端 `package.json`、`package-lock.json`、`src/version.js` 和 `CHANGELOG.md`，并在写入后自动执行版本一致性校验。

`Test-Template.ps1` 检查模板结构、桌面发布执行器脚本、平台目录、诊断能力、导出包能力和服务端覆盖层基础规则。

`Test-TemplateSecrets.ps1` 扫描产品母版中的高危敏感信息，阻止已知服务器 IP、SSH 登录串、真实密码、私钥、常见 API Key、明文 Bearer Token、HTTP Basic 凭据、运行目录和客户配置泄露。

`Test-CustomerDelivery.ps1` 会临时生成客户实例，打完整客户交付包，校验外层和内层 manifest，并确认敏感目录和运行产物没有进入交付包。

客户解压交付包后，正式安装前推荐运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action PreflightReport
```

这会生成上线预检 JSON/Markdown，提前检查 URL、端口、部署档案、组件包完整性、必需文档、桌面包预检入口、服务端命令生成能力和本机桌面端健康状态。

客户启动会前推荐运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
```

这会生成客户上线启动 JSON/Markdown，包含角色分工、账号准备、培训议程、首周运营计划、验收目标和安全边界。

客户启动会确认完成后推荐运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
```

这会生成客户首月 30 天运营 JSON/Markdown，覆盖 GEO 优化、短视频运营、企业 AI 落地、分发节奏、线索复盘和 AI 抓取文件检查，方便实施和客户运营直接执行。

客户演示、续费复盘或销售交接前推荐运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action SalesKit
```

这会生成客户销售演示 JSON/Markdown，覆盖产品定位、服务线映射、演示路径、客户访谈问题、异议处理、证据点和下一步动作，并保持公开无价格、无 Token、无平台账号信息。

客户首月运营结束后推荐运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action SuccessReview
```

Generate the customer service scope before final handoff:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

The service scope output must be archived with release notes and the handoff checklist. It confirms included scope, excluded work, responsibilities, acceptance criteria, and change-control boundaries without exposing prices or secrets.

Generate the customer product manual before kickoff or operator training:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

The product manual output must be archived with release notes and the service scope. It gives customers a readable guide to modules, workflows, roles, endpoints, first steps, success metrics, and security boundaries.

Generate the publishing-loop acceptance before production acceptance:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

The publishing-loop acceptance output must be archived with release notes, the product manual, and the handoff checklist. It confirms the website AI endpoints, GEOFlow distribution endpoints, desktop publisher health endpoint, result-writeback API path, and local-login boundary are ready.

Generate the publishing-loop dry run before connecting real platform accounts:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

The dry-run output must be archived with acceptance evidence when implementation needs to prove the article payload, desktop job claim, result payload, platform result array, and GEOFlow writeback shape before a customer operator logs in to third-party platforms.

这会生成客户成功复盘 JSON/Markdown，覆盖首月证据、指标字段、三条服务线复盘、风险、下月计划和续费/扩展讨论材料。

`Test-VersionConsistency.ps1` 会校验 `product.json`、桌面端 `package.json`、`package-lock.json`、`src/version.js` 和 `CHANGELOG.md` 的版本记录一致。

生成母版发布包后，可以单独验证最终 zip：

```powershell
.\scripts\Test-ProductReleasePackage.ps1 `
  -PackagePath 'D:\Releases\tongzhuo-geo-growth-suite-v1.6.2.zip' `
  -ExpectedVersion '1.6.2'
```

`Package-ProductRelease.ps1` 默认会在生成 zip 后自动执行这一步，确认发布包包含必要入口、文档、配置样例和版本清单，并排除客户配置、运行目录、依赖目录和敏感文件。

## 发布总验收

正式归档或复制销售前，可以运行总验收：

```powershell
.\scripts\Test-ProductReadiness.ps1 `
  -OutputPath 'D:\Releases\tongzhuo-product-readiness-1.6.2.json' `
  -ReleaseOutputPath 'D:\Releases\tongzhuo-geo-growth-suite-v1.6.2.zip'
```

总验收会执行：

- 版本一致性校验
- 模板结构与脚本校验
- 客户交付能力验收
- Full 模式下生成并验证正式客户交付 release 归档
- 产品母版发布包生成
- 产品母版发布包最终验收

Full 模式使用正式客户交付 release 归档作为客户交付证明，不再重复运行普通客户交付烟测；正式归档会覆盖客户配置、服务端包、桌面发布执行器包、AI 官网包、发布闭环验收、敏感信息扫描、交接清单和 release 自比较。

默认情况下，总验收会删除临时母版 zip，只保留 JSON 报告。正式归档时使用 `-ReleaseOutputPath` 指定母版 zip 路径；临时调试时也可以使用 `-KeepReleasePackage` 保留临时母版 zip。

## 正式发布归档

内部正式发版、归档或交给实施同事前，推荐使用：

```powershell
.\scripts\New-ProductRelease.ps1 `
  -OutputRoot 'D:\Releases' `
  -ReleaseSlug 'tongzhuo-geo-growth-suite-v1.6.2'
```

这个入口会先运行完整 readiness gate，然后在输出目录生成：

- 产品母版 zip
- readiness JSON 报告
- SHA256 校验文件
- RELEASE-SUMMARY.md 发布摘要
- RELEASE-NOTES.md / RELEASE-NOTES.json 发布说明

如果同名发布物已经存在，脚本会拒绝覆盖；确实需要重新生成时使用 `-Force`。

`RELEASE-NOTES` 会汇总本版本 changelog、readiness 检查、产品母版包哈希、客户交付烟测归档、客户交接清单文件和发布边界，适合发给销售、实施、售后或客户项目归档。

## 生成产品母版发布包

```powershell
.\scripts\Package-ProductRelease.ps1
```

默认会先执行模板校验和客户交付烟测，然后在 `dist/` 目录生成版本化 zip，例如：

```text
tongzhuo-geo-growth-suite-v1.6.2-YYYYMMDD-HHMMSS.zip
```

发布包根目录包含 `release-manifest.json`，记录产品名、版本、组件、入口脚本、校验门禁和排除规则。

## 快速生成发布包

只有在刚刚完整跑过校验、且没有再修改任何文件时，才可以使用：

```powershell
.\scripts\Package-ProductRelease.ps1 -SkipChecks
```

正式对外交付前不建议跳过校验。

## 发布包用途

产品母版发布包用于：

- 内部归档一个明确版本。
- 给实施同事生成客户实例。
- 在客户项目之间复制同一套标准能力。
- 出问题时按版本复现。
- 后续升级时对比客户当前版本和目标版本。

## 客户交付链路

从产品母版解压后，生成客户实例：

```powershell
.\scripts\New-Customer.ps1 `
  -CustomerSlug customer-a `
  -CompanyName '客户网络科技有限公司' `
  -ShortName '客户科技' `
  -SiteUrl 'https://www.example.com' `
  -GeoFlowBaseUrl 'https://flow.example.com' `
  -OutputPath 'D:\Deliveries\customer-a'
```

更推荐从配置文件生成，便于实施同事复用和归档：

```powershell
New-Item -ItemType Directory -Force -Path 'D:\Deliveries\configs'
Copy-Item .\config\client-config.example.json 'D:\Deliveries\configs\customer-a.json'
# 填写 D:\Deliveries\configs\customer-a.json 后执行
.\scripts\Test-CustomerConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json'

.\scripts\New-CustomerConfigReview.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputPath 'D:\Deliveries\configs\customer-a-CONFIG-REVIEW.md'

.\scripts\New-CustomerDeliveryFromConfig.ps1 `
  -ConfigPath 'D:\Deliveries\configs\customer-a.json' `
  -OutputRoot 'D:\Deliveries'
```

产品母版发布包只包含 `config/client-config.example.json`，不会包含客户专属配置文件。

配置评审会输出客户身份、端点、端口、联系信息完整度、上线 warning 和安全边界。正式客户交付 release 会自动生成 `*-CONFIG-REVIEW.md` 和 `*-CONFIG-REVIEW.json`，用于销售、实施和售后归档。

正式客户交付 release 还会自动生成 `*-HANDOFF-CHECKLIST.md` 和 `*-HANDOFF-CHECKLIST.json`，用于客户交接签收。清单会列出必交文件、SHA256、配置评审 warning、交付前检查、安装后检查、验收命令、签收负责人和安全边界。

客户配置中 `desktop_agent.port` 是主线 Windows 桌面发布执行器端口，默认 `18280`；`publisher_assistant.port` 是旧版兼容发布助手端口，默认 `18180`。两个端口必须不同。正式客户 release、部署档案、支持诊断包和桌面端健康检查都会读取 `desktop_agent.port`。

然后从客户实例生成完整交付包：

```powershell
.\scripts\Package-CustomerDelivery.ps1 `
  -Root 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a-tongzhuo-geo-delivery.zip'
```

客户解压交付包后，从根目录入口开始：

```powershell
.\Start-CustomerDelivery.ps1
```

## 发布边界

- 不把第三方平台账号、密码、Cookie、验证码、浏览器 Profile 打进任何发布包。
- 不把客户 API Token 打进任何发布包。
- 不把 `node_modules`、`.data`、运行日志、临时 zip、截图缓存打进发布包。
- 不承诺所有平台永久直接发布，平台风控或页面变化时保留草稿回退和适配器升级机制。
