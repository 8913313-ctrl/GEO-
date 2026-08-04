# 内容生产与审核 API

第四阶段把浏览器中的演示状态收敛为服务端事实来源。每次生成或编辑都会写入一个新的不可变文章版本，版本必须经过风控和人工审核才能冻结；发布接口只接受已审核、已冻结、风险通过且至少有一条企业知识引用的版本。

## 核心流程

```text
POST /api/v1/content/tasks
  → POST /api/v1/content/tasks/:taskId/versions
  → POST /api/v1/content/tasks/:taskId/risk-scan
  → POST /api/v1/content/tasks/:taskId/submit-review
  → POST /api/v1/content/tasks/:taskId/request-changes  (需要修改时)
  → POST /api/v1/content/tasks/:taskId/approve
  → GET  /api/v1/content/tasks/:taskId/can-publish
  → POST /api/publisher/jobs
```

`approve` 会把当前版本标记为 `approved` 并写入 `frozenAt`。之后编辑必须使用 `versions` 创建下一版本；新版本从 `draft` 重新开始审核，旧的冻结版本仍保留，可用于审计和已创建的发布任务。

前端点击“提交人工审核”时，会先等待新版本保存完成，再对同一个正式版本执行风控和提交。如果该正式版本尚无风控结果，`submit-review` 会在服务端自动补做一次安全扫描，避免保存新版本与扫描请求并发导致误报“尚未风控”。前端仍会提交企业禁用表述等规则命中，服务端仍会独立检查危险 HTML，并在审核动作中校验知识证据；GEO 文章结构评分只作为写作建议，不作为提交人工审核的硬门槛。

## 权限

- 生成、创建版本、提交审核、风控：`content.generate`
- 退回修改、审核通过冻结：`content.review`
- 发布任务：`content.publish`
- 查询内容与发布资格：`workspace.read`

所有写请求都要求已登录会话和 CSRF Token。`expectedRevision` 用于乐观锁，冲突时返回 `409 CONTENT_REVISION_CONFLICT`。

## 发布门禁

发布任务请求必须带 `articleId`（或 `contentArticleId`）以及可选的 `versionId`（或 `contentVersionId`）。服务端会重新读取数据库并校验，不信任浏览器传来的审核状态：

1. 版本属于当前文章且未归档；
2. 版本 `reviewStatus=approved` 且存在 `frozenAt`；
3. 风控状态为 `passed` 或 `warning`；
4. 至少一条知识引用的 `supportStatus=supported`。

不满足时返回明确的 `CONTENT_*` 错误码，发布器不会创建任务。
