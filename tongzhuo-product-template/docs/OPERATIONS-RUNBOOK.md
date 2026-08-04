# 桐灼 GEO 增长套件运维手册

这份手册用于客户交付后的上线、升级、回滚和售后排查。产品采用“服务器 GEOFlow 工作台 + Windows 本地发布执行器”的混合架构：服务器负责内容、任务、官网和线索数据，本地执行器负责第三方平台登录态、验证码和发布动作。

## 交付包入口

解压完整交付包后，优先运行：

```powershell
.\Start-CustomerDelivery.ps1
```

常用动作：

```powershell
.\Start-CustomerDelivery.ps1 -Action Verify
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
.\Start-CustomerDelivery.ps1 -Action SalesKit
.\Start-CustomerDelivery.ps1 -Action SuccessReview
.\Start-CustomerDelivery.ps1 -Action ServiceScope
.\Start-CustomerDelivery.ps1 -Action ProductManual
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow
.\Start-CustomerDelivery.ps1 -Action PrepareDesktop
.\Start-CustomerDelivery.ps1 -Action SupportBundle
.\Start-CustomerDelivery.ps1 -Action RollbackGuide
```

`Verify` 会校验交付包、服务端包、桌面端包、官网包的 manifest 和版本一致性。

`delivery-manifest.json` 还包含服务端包、桌面端包和官网包的 SHA256 与文件大小。`Verify` 会核对这些完整性信息，用于确认客户收到的组件包未损坏、未被替换。

## 首次上线

1. 在服务器备份现有 GEOFlow 代码和数据库。
2. 上传 `packages/*-geoflow-server-overrides.zip` 到 Linux 服务器。
3. 执行 `Start-CustomerDelivery.ps1 -Action ServerInstallCommand` 生成安装命令。
4. 在 Linux 服务器上执行安装命令，安装脚本会先备份将被覆盖的文件。
5. 打开 GEOFlow 后台，确认“发布助手”“发布设备”“分发管理”“客户线索”等页面可访问。
6. 解压并安装 `packages/*-desktop-publisher-agent.zip`。
7. 在桌面发布执行器中配置 GEOFlow 地址和 API Token，注册设备并确认心跳在线。
8. 在本地执行器中登录需要发布的平台账号。
9. 从 GEOFlow 发布一篇测试文章，确认官网展示、分发任务生成、执行器领任务和结果回写均正常。

上线启动会前运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action OnboardingKit
```

启动包用于确认客户负责人、内容运营、桌面执行器操作人、服务器实施人、首周发布节奏和验收目标。

启动会确认完成后运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action OperatingPlan
```

30 天运营计划用于安排 GEO 优化文章、短视频脚本、桌面分发任务、线索复盘和企业 AI 落地场景发现。首月运营结束后，把计划 JSON/Markdown、文章 URL、分发结果和线索记录一并归档。

客户演示、续费复盘或销售交接前运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action SalesKit
```

销售演示包用于统一产品定位、三条服务线、演示流程、客户访谈问题、异议处理和证据点。它不包含公开价格、客户 Token、平台密码、Cookie 或浏览器 Profile。

客户首月运营结束后运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action SuccessReview
```

客户成功复盘用于整理文章、AI 抓取文件、分发任务、发布设备、线索、短视频选题和企业 AI 场景证据，并形成风险复盘、下月计划和续费/扩展讨论材料。

Before kickoff, handoff, renewal, or scope change, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ServiceScope
```

The scope statement keeps included services, excluded work, responsibilities, acceptance criteria, and change-control rules clear. It also preserves the no-price, no-token, no-platform-credential delivery boundary.

Before customer operator training, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action ProductManual
```

The product manual gives the customer a readable guide to modules, service lines, workflows, operator roles, endpoints, first steps, success metrics, and the local platform-login boundary.

Before production acceptance, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance
```

The publishing-loop acceptance verifies that article publishing, official website AI exposure, distribution tasks, publisher devices, desktop agent health, and result writeback are all represented in the delivery package and deployment profile.

Before using real third-party platform accounts, run:

```powershell
.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun
```

The publishing-loop dry run generates a simulated article, desktop publisher task, claim request, result API payload, per-platform result states, and final GEOFlow writeback record. It is used to prove our own protocol and state model before the operator logs in to actual platforms.

## 升级流程

1. 记录当前产品版本和客户实例版本。
2. 执行新交付包的 `.\Start-CustomerDelivery.ps1 -Action Verify`。
3. 备份数据库和服务器代码。
4. 上传新的服务端覆盖包并执行安装命令。
5. 如果桌面端版本变化，安装新的桌面发布执行器。安装脚本会保留 `.data` 配置目录。
6. 发布一篇测试文章，确认任务队列和平台结果回写正常。

## 回滚流程

服务端安装脚本会在 Laravel 项目内创建备份目录：

```text
storage/app/tongzhuo-backups/geoflow-overrides-YYYYMMDD-HHMMSS
```

回滚步骤：

1. 停止新的发布操作。
2. 选择最近一次可用备份目录。
3. 将备份目录中的文件复制回 Laravel 项目根目录对应路径。
4. 执行：

```bash
php artisan optimize:clear
php artisan route:clear
php artisan view:clear
```

5. 如升级时执行了数据库迁移，先评估迁移是否可逆，再决定是否执行数据库回滚。
6. 桌面端回滚时，先卸载当前桌面发布执行器，再安装上一版本桌面端包。
7. 官网回滚时，重新部署上一版本官网静态包或上一版本 GEOFlow 官网模板。

## 售后排查

客户报告“打不开、发布不了、设备不在线、任务没回写”时，先让实施人员在解压后的交付包目录运行：

```powershell
.\Start-CustomerDelivery.ps1 -Action SupportBundle
```

该命令会生成 `support-bundles/*.json` 和 `support-bundles/*.md`，包含交付包版本、组件包 SHA256、必需文档检查、本机桌面端健康探测、客户端点和建议补充材料。它不会收集 API Token、平台密码、Cookie、浏览器 Profile、验证码或截图。

优先收集以下信息：

- GEOFlow 后台中的分发任务状态和平台结果。
- 发布设备页面中的设备在线状态、最近心跳和禁用状态。
- 桌面发布执行器的“本机诊断”和“支持报告”。
- 服务器 Laravel 日志。
- 客户电脑是否能访问 `http://127.0.0.1:18280/healthz`。

不要让客户发送第三方平台密码、Cookie、验证码、浏览器 Profile 或 API Token。支持报告已经对敏感字段做脱敏处理。

## 关键边界

- 公开官网不展示服务价格。
- 第三方平台登录态只保存在客户本地电脑。
- 服务器只保存发布任务、文章数据、设备状态和执行结果。
- 平台验证码、扫码、滑块验证需要在本地执行器所在电脑上完成。
- 无法承诺所有平台永久直接发布，平台页面变化或风控升级时必须允许草稿回退和适配器升级。
