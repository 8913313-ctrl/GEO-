# 企业知识库与 RAG API

所有接口均在登录会话下运行。写入、审核、索引和检索请求需要 Cookie Session 与 `X-CSRF-Token`；服务端固定使用当前私有部署的 `workspace_id=default`，不接受前端传入任意租户范围。

## 创建知识库

```http
POST /api/v1/knowledge/libraries
Content-Type: application/json
X-CSRF-Token: <csrf>

{
  "name": "工业品产品资料",
  "kind": "document",
  "scope": "business_line",
  "businessLineId": "BL-1",
  "description": "产品、交付和服务边界"
}
```

`kind` 可为 `document` 或 `qa`，`scope` 可为 `enterprise` 或 `business_line`。

## 提交文档版本

```http
POST /api/v1/knowledge/libraries/<libraryId>/documents
Content-Type: application/json
X-CSRF-Token: <csrf>

{
  "title": "交付边界说明",
  "sourceType": "text",
  "sourceName": "delivery.md",
  "content": "企业确认的资料正文……",
  "metadata": {"visibility": "public"}
}
```

也可以提交 `contentBase64`。每个文档都会生成不可变的 `knowledge_document_version`。文字解析成功后版本会自动设为可用并建立索引；扫描件在 OCR 完成后自动建立索引，不需要单独人工审核。

## 兼容的手动激活与重新索引

```http
POST /api/v1/knowledge/versions/<versionId>/approve
X-CSRF-Token: <csrf>
```

正常上传已自动执行以下流程；兼容接口可用于旧资料激活或索引修复：

```text
正文规范化 → 语义分块 → embedding → SQLite 向量索引 → indexed
```

`POST /api/v1/knowledge/versions/<versionId>/reindex` 用于模型切换或索引修复。文章本身在进入发布流程前仍须完成人工审核，这与知识资料的自动入库是两个独立门禁。

## 混合检索

```http
POST /api/v1/knowledge/retrieve
Content-Type: application/json
X-CSRF-Token: <csrf>

{
  "query": "工业品 GEO 的交付流程和发布边界是什么？",
  "businessLineId": "BL-1",
  "topK": 8,
  "minScore": 0.08,
  "libraryIds": []
}
```

响应中的 `results` 是经过业务线、企业公共库、审核状态和索引状态过滤后的知识片段；`evidence` 可以直接作为文章生成接口的 `approvedEvidence`。每条结果都包含：

- `libraryId`、`documentId`、`versionId`、`chunkId`
- `quote` 原文片段
- `locator` 片段定位
- `score`、`vectorScore`、`lexicalScore`
- 来源知识库和文档标题

系统同时计算 embedding 余弦相似度和关键词重合度，避免企业专有名词只靠向量召回时被遗漏。配置 `kind=embedding` 的 OpenAI-compatible 供应商后使用远程 embedding；未配置时使用本地 256 维 hash embedding 兜底。

## 接入文章生成

在 `/api/ai/generate/article` 请求中加入：

```json
{
  "useRag": true,
  "rag": {
    "enabled": true,
    "businessLineId": "BL-1",
    "query": "工业品 GEO 的交付流程和发布边界是什么？",
    "topK": 8
  }
}
```

服务端会先完成检索，把真实知识片段合并到模型上下文，再返回 `rag.runId`、embedding 模型、命中数量和知识缺口状态。文章生成服务仍会校验企业问句、HTML 结构、证据标记和严格知识模式。

## 高级企业能力

### OCR 与知识资产

图片原文件可立即作为文章配图；已配置 OCR 时，需要文字识别的图片/扫描件会保存为 `knowledge_assets`，并以 `extractionStatus=queued` 进入后台队列，识别完成后自动进入 RAG。未配置 OCR 的扫描件会明确失败。后台 worker 调用：

```json
{ "contentBase64": "...", "mimeType": "image/png", "sourceName": "产品图.png" }
```

OCR 服务返回 `{ "text": "...", "confidence": 0.98, "blocks": [] }`。提取完成后版本自动索引；知识资料不设置人工审核步骤，资产仍保留哈希、来源和处理状态。

相关接口：

- `GET/POST /api/v1/knowledge/assets`
- `POST /api/v1/knowledge/assets/:assetId/approve`（旧客户端兼容，正常上传无需调用）
- `GET /api/v1/knowledge/ocr`
- `POST /api/v1/knowledge/ocr`（手动处理 OCR 队列）

### 异步索引和重试

知识索引任务保存在 `knowledge_index_jobs`，包含锁、尝试次数、下次重试时间和错误信息。服务启动后会周期性处理 OCR 与索引队列，也可以通过以下接口运维：

- `GET/POST /api/v1/knowledge/index-jobs`
- `POST /api/v1/knowledge/index-jobs/:jobId/retry`

大文件（默认正文超过 100,000 字符）会在审核后只进入队列，由 worker 异步完成分块和向量化；设置 `TZ_KNOWLEDGE_ASYNC_INDEX=1` 可让所有版本异步索引。单个任务最多自动重试 3 次，失败不会影响其他知识版本。

### 可插拔向量库

默认仍使用 SQLite 向量索引；配置 `TZ_VECTOR_STORE_URL` 后，系统会调用远程向量服务的 `/upsert`、`/query`、`/delete` 接口，并保留 SQLite 作为可回退索引。设置 `TZ_VECTOR_STORE_REQUIRED=1` 可在远程向量库不可用时阻止索引完成，适用于不允许降级的生产环境。`GET /api/v1/knowledge/vector-backend` 可查看当前后端状态。
## 图片与 PDF 资料

知识资料采用“上传即入库”模式，不需要单独人工审核：

- 文本、Office 和带文字 PDF 在解析后自动分块、生成向量并进入 RAG；
- 扫描型 PDF 只有在 OCR 已配置时才保存并进入处理队列；未配置时明确返回配置错误，不创建永久等待任务；
- PDF 中可提取的内嵌位图会成为独立 `image` 资产，并记录原 PDF、页码和对象信息；
- 直接上传图片无需 OCR 即可作为文章配图使用，OCR 仅用于增强检索；
- 图片原文件保存在 `TZ_KNOWLEDGE_ASSET_ROOT`（默认 `data/knowledge-assets`），SQLite 只保存元数据和存储键；
- backup v2 会连同数据库一起校验、备份和恢复图片原文件目录。

批量上传图片：

```http
POST /api/v1/knowledge/assets/batch
Content-Type: application/json

{
  "libraryId": "KB-...",
  "defaults": { "category": "产品图片", "license": "企业自有" },
  "assets": [
    { "sourceName": "product-01.jpg", "mimeType": "image/jpeg", "contentBase64": "..." }
  ]
}
```

后端单批最多 500 张、总大小 100 MB；管理端会把用户一次选择的图片自动拆为每批最多 40 张、20 MB 后连续上传。服务端按 SHA-256 自动去重。图片原文件通过以下鉴权接口读取：

```http
GET /api/v1/knowledge/assets/:assetId/content
```

文章发布到官网时，正文中的管理端图片地址会在公共站点运行时重写为只读媒体地址：

```http
GET /site-assets/knowledge/:assetId
```

该公开接口只返回未归档的图片类型资产，不暴露文档原文件、数据库路径或后台登录能力。

## 企业级安全与版本规则

- 面向文章生产的检索始终排除 `metadata.visibility=internal` 的资料；客户端不能通过 `includeInternal=true` 绕过。
- `rag.libraryIds` 会校验工作区、知识库状态和业务线归属，越权或不存在的知识库返回 `KNOWLEDGE_LIBRARY_SCOPE_INVALID`。
- 用于审核/发布的知识引用必须同时包含 `libraryId`、`documentId`、`versionId`、`chunkId`。服务端校验四级层级、启用/索引状态和引用原文；内部资料不能通过公开内容审核。
- 新版本完成索引后，默认召回只使用同一文档最新的已批准/已索引版本；历史版本仍保留供已发布文章追溯。
- 未配置 OCR 时，扫描 PDF 或没有文字说明的图片明确返回 `KNOWLEDGE_OCR_NOT_CONFIGURED`，不会永久停在 `queued`。遗留队列会由 worker 标记失败并记录原因。
- 图片批量上传会在归属知识库中建立对应文档/版本，使 OCR 文本进入 `knowledge_chunks`；同一图片可分别归属于不同知识库。
- `POST /api/v1/knowledge/documents-batch` 支持一次最多 100 个、总计 100 MB 的 PDF、DOCX、XLSX、Markdown 和文本文件，并分别返回成功、重复与失败项。

`GET /api/v1/knowledge/vector-backend` 的 `embedding` 字段明确显示 `mode=remote` 或 `mode=local_fallback`。`local-hash-256` 仅是未配置真实 embedding provider 时的兜底；检索运行会保存 provider、来源和 fallback 原因。
