# Demo AI 生成接口

这组接口只服务于 `tongzhuo-geo-platform-demo`。它不会修改正式 Laravel 覆盖层，也不会把浏览器 `localStorage` 迁移成服务端业务数据库。

模型密钥只从服务端 `data/ai-providers.json` 读取。请求、响应、错误详情和运行记录都不会返回原始 API Key。每次运行只把脱敏元数据追加到 `data/ai-generation-runs.json`，前端仍负责把确认后的问题、选题和文章写入当前 demo state。

## 前置条件

先通过 `POST /api/ai/providers` 添加一个 `kind=text`、`status=enabled` 的 OpenAI-compatible 供应商。`baseUrl` 可以填写到 `/v1`；服务会自动调用其 `/chat/completions`。如果填写的地址已经以 `/chat/completions` 结尾，则直接使用该地址。

当前支持的供应商协议字段仍沿用供应商配置接口。真实生成统一要求其兼容 OpenAI Chat Completions 响应结构：

```json
{
  "choices": [{ "message": { "content": "{...模型生成的 JSON...}" } }]
}
```

## 1. 生成客户问题

`POST /api/ai/generate/questions`

```json
{
  "providerId": "deepseek",
  "model": "deepseek-chat",
  "businessLine": {
    "id": "BL-GEO",
    "name": "GEO 优化服务",
    "product": "企业 GEO 优化与运营",
    "audience": "制造业企业",
    "scenario": "AI 搜索品牌发现与内容信源建设"
  },
  "seeds": ["工业品 GEO 优化", "制造业 AI 搜索"],
  "dimensions": ["question", "commercial", "technical"],
  "limitPerDimension": 5,
  "existingQuestions": ["工业品企业如何开始做 GEO 优化？"]
}
```

`dimensions` 可用值：`semantic`、`scenario`、`commercial`、`ranking`、`review`、`brand`、`question`、`technical`。默认每类必须有 5 条问题通过质量门槛；不足时服务会要求模型重写一次，仍不足则明确报错，不会用模板或低质量问题凑数。

成功响应的 `data.questions` 可映射到前端 `questionLibrary`。服务已补充：

- `generationMode=model`
- `engine=openai-compatible`
- `quality.askability/specificity/businessRelevance/evidenceReadiness/duplicateRisk`
- `priorityScore`、`scoreBreakdown`、`modelRecommendation`
- `business_profile`、`generationRunId`

为兼容不同 demo 页面，问题数组同时以 `questions`、`customerQuestions` 和 `items` 暴露；选题数组同时以 `topics` 和 `items` 暴露。

问题阶段只生成问题主体和内部评分字段。问题必须是以问号结尾、可以由客户直接输入 AI 的完整问句，并且要在问句本身写清对象、场景或任务；编辑部标题、机械扩词、重复问题、画像禁用表达和低质量结果会进入 `data.rejected` 或导致契约错误。

## 2. 从问题生成选题

`POST /api/ai/generate/topics`

```json
{
  "providerId": "deepseek",
  "businessLine": {
    "id": "BL-GEO",
    "name": "GEO 优化服务",
    "product": "企业 GEO 优化与运营",
    "audience": "制造业企业",
    "scenario": "AI 搜索品牌发现与内容信源建设"
  },
  "questions": [{
    "id": "Q-001",
    "question": "制造企业做 GEO 优化时，应该先整理哪些企业资料？",
    "sourceKeyword": "制造业 GEO",
    "dimension": "question",
    "coverage": "未覆盖"
  }],
  "existingTopics": []
}
```

每个输入问题生成一个一对一选题。`data.topics[*].questionId` 只用于内部保留来源关系；模型生成表达更明确但不改变原意的 `coreQuestion`，并同步保存到 `geoBrief.coreQuestion`，后续选题库与文章生成均以它为准。原始问题保留在 `geoBrief.parentQuestion` 中用于追溯，但不在选题库主列表展示。

## 3. 生成文章

`POST /api/ai/generate/article`

```json
{
  "providerId": "deepseek",
  "businessLine": {
    "id": "BL-GEO",
    "name": "GEO 优化服务"
  },
  "contentType": "深度文章",
  "topic": {
    "id": "TOP-001",
    "title": "制造企业做 GEO 优化时，应该先整理哪些企业资料？",
    "dimension": "question",
    "geoBrief": {
      "coreQuestion": "制造企业做 GEO 优化时，应该先整理哪些企业资料？"
    }
  },
  "writingAgent": {
    "id": "WA-GEO-DEEP",
    "role": "企业 GEO 内容顾问",
    "tone": "专业、可信、克制",
    "strictKnowledge": true,
    "citationsRequired": true,
    "missingEvidenceAction": "omit"
  },
  "approvedEvidence": [{
    "id": "CIT-001",
    "marker": "K1",
    "claim": "企业资料需要可追溯",
    "quote": "企业资料应保留来源、版本和审核状态。",
    "status": "verified"
  }]
}
```

严格知识模式只接受标记为 `approved`、`verified`、`published` 或 `supportStatus=supported` 的证据。使用 `approvedEvidence` 字段时，服务会将这些条目视为前端已经完成审核；正式系统仍应在服务端重新校验租户、知识版本和权限。没有已审核证据时返回 `NO_APPROVED_EVIDENCE`。

文章模型必须返回 JSON，其中 `html` 使用现有 GEO 证据页的六个固定 section：

1. `p-intro`
2. `p-scope`
3. `p-knowledge`
4. `p-topic`
5. `p-faq`
6. `p-boundary`

企业事实引用使用 `<sup data-evidence-id="CIT-001">[K1]</sup>`。服务会拒绝未知证据、虚假 `usedEvidenceIds`、缺失章节、Markdown、`h1`、脚本、内联事件、内联样式和不安全 URL。前端落入现有 article state 前，仍应把 evidence ID 映射到现有 `knowledgeCitations` 和版本快照。

## 响应与错误

成功：

```json
{
  "ok": true,
  "data": {
    "run": {
      "id": "AIRUN-...",
      "operation": "questions",
      "providerId": "deepseek",
      "model": "deepseek-chat",
      "status": "succeeded",
      "attempts": 1,
      "durationMs": 1234
    }
  }
}
```

失败：

```json
{
  "ok": false,
  "code": "MODEL_CONTRACT_INVALID",
  "message": "模型输出未通过结构或质量校验。",
  "details": ["HTML 缺少 section#p-faq。"]
}
```

主要错误码：`INVALID_INPUT`、`PROVIDER_NOT_FOUND`、`PROVIDER_DISABLED`、`PROVIDER_KIND_MISMATCH`、`NO_APPROVED_EVIDENCE`、`UPSTREAM_TIMEOUT`、`UPSTREAM_CONNECTION_ERROR`、`UPSTREAM_HTTP_ERROR`、`UPSTREAM_RESPONSE_TOO_LARGE`、`MODEL_CONTRACT_INVALID`。

默认上游超时为 90 秒，最大响应体为 1.5 MB，契约失败时最多自动重试一次。可以通过 `TZ_AI_GENERATION_TIMEOUT_MS`、`TZ_AI_GENERATION_MAX_RESPONSE_BYTES` 和 `TZ_AI_GENERATION_MAX_ATTEMPTS` 调整。
