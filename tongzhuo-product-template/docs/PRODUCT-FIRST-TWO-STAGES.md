# 桐灼 GEO 增长套件：前两个阶段预览

这份文档只定义产品先做出来给客户看、给内部演示、给后续开发继续推进的前两个阶段。

当前建议不要一上来追求“所有平台完全自动发布”。先把官网、内容、GEOFlow 后台、分发任务和本地执行器的主闭环跑通，产品就能开始演示、试点和复制交付。

## 一键生成预览报告

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action FirstTwoStages `
  -OutputPath 'C:\tmp\tongzhuo-first-two-stages-preview.json'
```

这个命令会同时生成 JSON 和 Markdown 报告，检查阶段一、阶段二的关键文件、后台入口、AI 抓取入口、本地执行器、首批平台适配器和安全边界。

## 生成试点验收清单

客户或内部试点交付包生成后，可以用 release manifest 生成前两阶段验收清单：

```powershell
.\scripts\Start-ProductDelivery.ps1 `
  -Action FirstTwoStagesPilot `
  -ReleaseManifestPath 'D:\Deliveries\customer-a\releases\customer-a-manifest.json' `
  -ScanRoot 'D:\Deliveries\customer-a' `
  -OutputPath 'D:\Deliveries\customer-a\first-two-stages-pilot-checklist.md'
```

清单只覆盖前两个阶段：官网/AI 抓取/线索，以及分发管理/本地执行器/首批平台/结果回写。

正式客户 release 也会自动生成：

- `*-FIRST-TWO-STAGES-PILOT.md`
- `*-FIRST-TWO-STAGES-PILOT.json`

这两个文件会写入 release manifest 和项目归档索引，交付包生成后即可用于试点签收。

## 阶段一：云端 GEO 工作台 + AI 友好官网

目标：让客户先拥有一个能沉淀内容、被 AI 抓取、能收集线索、能管理文章的 GEO 运营中台。

### 要做出来的能力

- 官网首页：展示公司定位、服务产品、案例/能力、联系入口。
- 服务产品页：围绕 GEO 优化、短视频运营、企业 AI 落地三条服务线做介绍。
- 行业资讯页：作为文章列表和观点沉淀入口，面向人看，也面向 AI 抓取。
- 文章详情页：每篇文章都有标题、摘要、正文、分类、发布时间、结构化数据。
- AI 抓取入口：`robots.txt`、`sitemap.xml`、`feed.xml`、`llms.txt`、`llms-full.txt`。
- 线索提交：官网表单提交后进入 GEOFlow 后台线索管理，不再打开邮件客户端。
- GEOFlow 后台入口：文章管理、行业资讯、线索管理、发布设备、分发管理、发布助手菜单。
- 内容分类：至少支持 GEO 优化、短视频运营、企业 AI 落地三类内容。
- 安全边界：官网公开内容不展示服务价格，不暴露后台 Token、平台账号、Cookie。

### 当前模板对应目录

- `website/`：官网静态模板和 AI 抓取文件。
- `geoflow-integration/`：GEOFlow 后台覆盖层、路由、控制器、视图和接口。
- `docs/AI-VISIBILITY-AUDIT.md`：AI 可见度检查说明。
- `scripts/New-AIVisibilityAudit.ps1`：官网 AI 抓取入口检查脚本。

### 阶段一验收标准

- 官网可以访问首页、服务页、行业资讯列表、文章详情、关于我们、联系我们。
- 官网文章可以被 `sitemap.xml`、`feed.xml`、`llms.txt` 关联到。
- 客户提交线索后，后台线索管理能看到记录。
- GEOFlow 后台能发布文章到官网。
- 页面源码包含清晰标题、描述、正文层级、JSON-LD 结构化数据。
- 公开页面不出现价格、后台 Token、平台账号或敏感配置。

## 阶段二：GEOFlow 分发管理 + Windows 本地发布执行器

目标：运营人员仍然在 GEOFlow 后台写文章、选平台、点发布；真正的第三方平台登录、验证码和发布动作，由客户电脑上的本地执行器完成。

### 要做出来的能力

- 设备绑定：本地执行器能绑定 GEOFlow，生成设备 ID，并持续心跳。
- 平台账号状态：本地执行器维护平台登录态，平台密码、Cookie、验证码不上传服务器。
- 分发任务：GEOFlow 后台能把文章生成分发任务，下发给指定设备。
- 平台适配：第一批重点适配微信公众号、知乎、头条号。
- 任务执行：本地执行器领取任务，打开对应平台编辑器，填充标题、正文、摘要、封面/素材信息。
- 结果回写：发布成功、草稿、失败原因、平台链接、截图/日志摘要回写 GEOFlow。
- 降级策略：直接发布失败时，不丢内容，降级为草稿、导出包或待人工确认。
- 本机诊断：本地页面能检查端口、Token、设备 ID、后台连接、最近心跳、可执行平台。

### 当前模板对应目录

- `desktop-agent/`：新的 Windows 本地发布执行器。
- `desktop-agent/src/platforms.js`：平台目录。
- `desktop-agent/src/adapters/`：平台适配器。
- `desktop-agent/public/`：本地执行器控制台页面。
- `geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php`：设备接口。
- `docs/PUBLISHER-DEVICE-PROTOCOL.md`：发布设备协议。
- `docs/OPERATIONS-RUNBOOK.md`：上线、回滚和排查手册。

### 阶段二验收标准

- 本地执行器能启动，并打开本地控制台。
- 本地执行器能注册到 GEOFlow 后台，后台能看到设备在线。
- GEOFlow 后台能创建分发任务，并被本地执行器领取。
- 至少微信公众号、知乎、头条号三个平台有可测试适配路径。
- 任务执行结果能回写到 GEOFlow 分发管理。
- 本地执行器失败时能给出明确原因，不让运营人员不知道卡在哪里。
- 平台登录态只保存在本机，不进入产品模板、客户交付包或服务器。

## 先不做的内容

为了先把产品前两阶段跑稳，以下内容暂时不作为第一轮验收重点：

- 所有平台全自动无人工发布。
- 服务器端直接保存第三方平台账号密码。
- 绕过验证码、滑块、安全验证。
- 客户组合管理、续费评分、健康评分等后期客户成功模块。
- 大规模数据报表和复杂 BI。

## 推荐演示流程

1. 打开官网首页，看公司定位、服务产品、行业资讯和联系入口。
2. 在 GEOFlow 后台写一篇行业资讯文章，分类选择 GEO 优化、短视频运营或企业 AI 落地。
3. 发布到官网，确认文章列表、文章详情、RSS、Sitemap 和 `llms.txt` 能看到内容入口。
4. 在官网提交一次客户线索，回到 GEOFlow 后台查看线索记录。
5. 打开本地发布执行器，确认设备在线、后台连接正常、平台目录可用。
6. 在 GEOFlow 文章管理里点击分发，选择微信公众号、知乎、头条号。
7. 本地执行器领取任务，打开平台编辑页，填充文章内容。
8. 发布或保存草稿后，回到 GEOFlow 分发管理看结果回写。

## 产品化边界

前两个阶段完成后，产品可以作为“GEO 内容运营中台 + AI 友好官网 + 本地多平台发布执行器”对外演示。

它解决的是企业获客链路的前半段闭环：

- 企业内容能生产。
- 官网能承载和被 AI 抓取。
- 线索能回收。
- 文章能进入多平台分发流程。
- 平台登录和验证码留在真实运营电脑上处理。

这时产品已经具备试点交付价值，后续再继续增强客户成功、项目交付、健康评分、组合看板和更多平台适配。
