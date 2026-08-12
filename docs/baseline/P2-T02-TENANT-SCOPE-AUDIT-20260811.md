# P2-T02 项目隔离字段审计（2026-08-11）

## 当前事实

GEOFlow 现有数据库已经把 `workspace_id` 作为实际项目隔离键，代码中没有发现 `customer_id` 或 `client_id` 的并行主键。当前生产 schema 共发现 48 张表，其中 26 张表直接保存 `workspace_id`，22 张表通过父对象关联项目范围。

因此本任务不擅自把数据库字段改名为 `tenant_id`。配置契约中的 `tenant_id` 是产品交付层的稳定项目身份；下一步应建立它与 GEOFlow `workspace_id` 的显式映射，并继续使用现有 `workspace_id` 过滤 SQL，避免一次大范围破坏性迁移。

## 直接隔离的对象族

已直接带 `workspace_id` 的对象包括：知识库、内容计划/任务/文章、生成任务、知识资产、向量后端、监测报告与访问日志、官网线索、CMS 草稿/发布、诊断项目、分析会话、relay 关联、监测计划、内容资产及其发布/引用/告警。

## 继承隔离的对象族

文章版本、知识文档/版本/分块/索引任务、诊断问题集/运行/证据/指标/报告/建议/动作、分析消息/运行/工具调用/产物等表不重复保存 `workspace_id`，而是通过父表 JOIN 取得项目范围。后续实现必须为每个对象族写跨工作区读取拒绝测试，不能仅凭“父表有关联”推断安全。

## 已实现的身份映射

- 新增 `TZ_TENANT_ID` 生产配置；未配置时为兼容现有桐灼实例，仍使用 `default`。
- `productionConfig.workspaceId` 只能是 `tenantId` 的内部同值映射；配置不同值会启动失败，防止出现第二套客户身份。
- 后台服务、官网 CMS、线索、内容、知识、诊断、分析、监测和后台任务已从硬编码 `default` 改为使用该项目工作区。
- 新增跨工作区负向测试，证明建材工作区不能读取机械工作区的业务记录。
- 独立官网、旧 GEOFlow 导入、官网快照连接、Docker staging/production 和私有交付安装脚本统一读取 `TZ_TENANT_ID`；旧的 `TZ_SITE_WORKSPACE_ID` 已移除，避免官网与后台配置成两个项目身份。

本轮完成了服务启动上下文、工作区状态/业务记录、官网 CMS/线索路由、内容、内容资产、诊断、监测和分析工作台的切换。审计过程中发现 `content-api.mjs`、`diagnostic-api.mjs`、`monitoring-api.mjs`、`analysis-workbench-api.mjs` 和分析引擎仍会把请求导回 `default`；现已统一从对应 Store 的 `workspaceId` 读取项目范围。

内容、诊断、监测和分析测试现在分别使用不同的非默认租户 ID。知识 API、内容发布、诊断、监测、分析工作台和官网发布观察器的目标检查均已通过。

真实运行验证使用 `TZ_TENANT_ID=tenant-building-materials-runtime` 和隔离临时数据库启动后台，`/health/live`、`/health/ready` 均通过；数据库 `research_packages.workspace_id` 实际写入 `tenant-building-materials-runtime`，验证后临时端口 `43129` 已停止。

## P2-T02 完成边界

当前一企业一部署不需要执行 schema 改名；备份和恢复以整套客户数据库为边界。后续新增对象族必须同时提供非默认租户测试和跨工作区拒绝测试。未来若转共享 SaaS，必须单独设计迁移和授权模型，不能把本轮同值映射误当成共享 SaaS 的授权实现。

全量 `npm run check` 仍会因仓库未安装可选 Citation Lab 派生数据库而停止在 `CITATION_RESEARCH_NOT_INSTALLED`；这是 P1 已记录的外部数据包限制。本轮受影响的租户映射、官网、内容、知识、诊断、监测、分析、发布和私有交付安全检查均已单独通过。

本审计没有生成客户数据、没有启动服务、没有改动现有数据库。
