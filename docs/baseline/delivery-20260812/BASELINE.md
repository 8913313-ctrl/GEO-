# 交付基线（2026-08-12）

- 分支：`codex/qa-fixes-20260812`
- 基准提交：`1777dff fix: complete enterprise onboarding and official site publish flow`
- 产品形态：单客户、整套出售、私有部署
- 工作区状态：存在大量历史未提交改动，全部保留；不得清理或覆盖

## 已执行并通过

- `node scripts/check-onboarding-baseline.mjs`
- `node scripts/check-blank-bootstrap.mjs`
- `node scripts/check-project-seeds.mjs`
- `node scripts/check-data-boundaries.mjs`
- `node scripts/check-planning-generation-flow.mjs`
- `node scripts/check-site-publish-loop.mjs`
- `node scripts/check-site-public-snapshot.mjs`

## 当前门槛状态

- 新客户建档初始化：脚本通过，真实浏览器流程待测。
- 客户数据边界：脚本通过，跨会话/异常流程待测。
- 内容规划与生成：脚本通过，真实模型失败和重试待测。
- 官网审核、发布和不可变快照：脚本通过，多模板尚未完成。
- 安全、性能、无障碍、备份恢复：尚未形成最终证据，不允许放行。

## 持续执行记录

- 官网四模板注册表、CMS 草稿/正式快照隔离、后台可视化选择器已完成。
- `npm run check:site` 全套通过。
- UPS/能源与美妆行业适配包、演示项目种子已加入隔离检查。
- 内容任务幂等冲突、终态倒退、重启中断恢复已修复并通过专项检查。
- 真实浏览器已确认选择 `energy` 后草稿保存 `theme.key=energy`，正式发布快照仍保持旧模板。
- 发现运行版本不一致风险：旧 Node 进程会使用旧 CMS 契约丢弃新字段；正式交付需增加构建/版本探针和启动前旧进程检查。
- 私有交付检查当前被引用研究库缺失拦截；固定 commit 数据正在按 SHA-256 下载和构建，未绕过校验。

## 当前服务约定

- 后台目标端口：`43227`
- 官网目标端口：`18180`
- workspace/project：`tenant_qa_enterprise`
- QA 数据库：`C:\Users\Administrator\AppData\Local\Temp\tongzhuo-geo-qa-enterprise-20260812\qa.sqlite`

基线检查时两个目标端口未检测到监听，后续真实浏览器测试前必须以固定 workspace、project、数据库和端口重新启动，避免启动到错误客户数据。
