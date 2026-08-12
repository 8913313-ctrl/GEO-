# P2-T06：方法论来源审批与发布门

日期：2026-08-12  
状态：代码与测试完成；真实数据库未导入，16 条规则仍待负责人审批。

## 已实现

- 数据库迁移 `19 / methodology_source_reviews` 保存规则、主题、来源路径、精确定位、摘要、SHA-256、分类、适用范围、许可说明、复用决定、审核状态、审核人和审核时间。
- `geo-core-methodology-v1` 来源审核草稿固定使用 `MVER-GEO-CORE-V1-DRAFT`，不会覆盖旧版本。
- 候选规则导入是幂等的；重复导入不会清除已经完成的审核。
- 正式发布要求规则数量与候选清单一致，且每条均为 `approved + approved-global`。
- 任一规则为 `pending`、`rejected` 或复用范围受限时，发布返回明确错误。
- 发布后方法论正文和来源审核记录均由 SQLite 触发器冻结，不能更新或删除。
- 审核和发布命令必须显式传入 `--apply true`，并要求数据库中的有效用户作为审核人/发布人。
- 内容计划生成文章时，服务端按问题和内容类型最多选择 8 条相关方法规则；浏览器提交的方法片段会被丢弃。
- 生成提示词只包含方法版本 ID 和本次规则片段，不注入方法论全文。
- `GenerationRun` 请求快照和文章版本元数据保存方法版本、校验和及规则 ID，后续可复核本次生成使用了什么。
- 桐灼和建材计划可以引用相同的全局方法版本，但按各自 `workspace_id` 读取计划和企业证据；跨租户计划读取被拒绝。

## 小白 AI 执行顺序

### 1. 只检查清单，不写数据库

```powershell
npm run check:ups-geo-rules
npm run foundation:ups-geo-import
```

### 2. 经负责人确认后导入待审规则

```powershell
npm run foundation:ups-geo-import -- --apply true
```

这一步只创建草稿和 16 条 `pending` 审核记录，不会发布。

### 3. 每次只审核一条规则

```powershell
npm run foundation:review-source -- `
  --version MVER-GEO-CORE-V1-DRAFT `
  --rule UPS-GEO-R001 `
  --status approved `
  --reviewer-id <数据库中的有效用户ID> `
  --note "负责人确认该规则允许进入所有 GEO 客户共用方法论" `
  --apply true
```

如果不允许复用，把 `--status` 改为 `rejected` 并写明原因。不得为了通过发布门而批量自动批准。

### 4. 全部审核后发布

```powershell
npm run foundation:publish-methodology -- `
  --version MVER-GEO-CORE-V1-DRAFT `
  --publisher-id <数据库中的有效用户ID> `
  --apply true
```

只要还有一条未批准，命令就会拒绝发布。

## 验证

```text
npm run check:ups-geo-rules       通过：6 个主题、16 条规则、来源 SHA-256 匹配
npm run check:foundation-assets   通过：导入幂等、数量门禁、审批门禁、发布冻结
node scripts/check-ai-generation-service.mjs 通过：方法版本和按需片段进入生成提示词与快照
node scripts/check-production-api.mjs        通过
node scripts/check-content-workflow.mjs 通过
node scripts/check-content-api.mjs      通过
```

## 安全边界

- 未对真实生产数据库执行 `foundation:init` 或候选规则导入。
- 未读取或输出数据库用户、Token、服务器密码或客户数据。
- 山东金沣昌项目事实和第三方仓库全文没有进入全局方法论。
- UPS_GEO 根目录没有明确 `LICENSE`，真实批准仍必须由负责人作出。
