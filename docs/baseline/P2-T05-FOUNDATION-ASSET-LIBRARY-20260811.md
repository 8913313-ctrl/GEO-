# P2-T05 GEO 底层知识资产库（2026-08-11）

## 结论

“怎么做好 GEO”、文章提示词和质量规则已经有独立的版本化存储边界，不再要求每个客户复制一份字符串。数据库迁移版本为 `18 / geo_foundation_assets`。

## 数据对象

- `methodology_packs` / `methodology_versions`
- `prompt_templates` / `prompt_versions`
- `quality_rule_packs`
- `prompt_test_cases`
- `content_plans.methodology_version_id`
- `content_plans.prompt_version_id`
- `content_plans.quality_rule_pack_id`

作用域只能为 `global`、`industry` 或 `project`：

- `global` 不允许行业和租户字段。
- `industry` 必须有 `industry_template`，不允许租户字段。
- `project` 必须有 `tenant_id`，不允许伪装成行业资产。

内容计划引用项目资产时会校验所属租户；引用行业资产时必须显式提供并匹配行业模板。全局资产可由多个客户共同引用。

## 版本与冻结

方法版本、提示词版本和质量规则版本均保存 SHA-256 校验和。发布操作会保存发布时间和发布人。数据库触发器禁止对已发布版本执行更新或删除，存储层也会在进入数据库前拒绝覆盖。

提示词版本发布前至少需要一个启用的测试用例；方法版本发布前必须保留来源。内容计划默认只能绑定已发布资产。

## 初始草稿

`foundation-assets/geo-core-drafts.mjs` 提供以下系统草稿：

- `geo-core`
- `geo-article`
- `geo-content-quality`
- “缺少企业证据时不得补写事实”测试用例

这些内容只建立最低治理边界，明确标注尚未完成 `ups_geo` / 既有资料审计，因此初始化后保持草稿，不能冒充正式 GEO 方法论。

初始化命令必须显式执行：

```text
npm run foundation:init
```

该命令写入 `TZ_DATABASE_PATH`。本任务没有对现有生产数据库执行它，只在隔离临时数据库中完成验证。

## 验收证据

```text
npm run check:foundation-assets
node scripts/check-content-workflow.mjs
node scripts/check-content-api.mjs
```

验收证明：

- 桐灼与建材两个内容计划引用同一 `geo-core`、`geo-article` 和质量规则版本 ID。
- 跨租户引用项目自定义资产被拒绝。
- 已发布方法不能更新，已发布提示词不能删除或改状态。
- 重复运行草稿初始化不会产生重复版本。
- 内容 API 仍能返回内容计划，且计划响应包含 `foundationAssets` 版本引用。

私有交付白名单已加入 `foundation-assets`、`industry-templates` 和 `project-seeds`。交付检查执行到现有可选 Citation Lab SQLite 数据包时仍因该文件缺失停止；在此之前新增运行文件存在性断言已通过。

## 下一步

P2-T06 只能审计并导入真实存在的 `ups_geo` / 既有 GEO 资料。必须先记录文件路径、来源、作者/版权、修改时间和 SHA-256；来源不明的内容不能发布到 `geo-core`。
