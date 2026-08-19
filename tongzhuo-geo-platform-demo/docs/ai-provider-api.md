# AI 供应商配置接口

接口只在后台服务端保存供应商配置。`apiKey` 不会出现在任何响应中，响应使用 `hasApiKey` 与 `apiKeyMasked` 表示密钥状态；前端不应把密钥写入 `localStorage`。

## 路由

- `GET /api/ai/providers`：列出供应商（不返回原始密钥）。
- `POST /api/ai/providers`：创建供应商。请求字段：`id`（可选）、`name`、`baseUrl`、`model`、`apiKey`（可选）、`kind`（`text` / `image` / `embedding`）、`status`（`enabled` / `disabled`）。
- `PATCH /api/ai/providers/:id`：部分更新；省略 `apiKey` 表示保留，传空字符串或 `null` 表示清除。
- `DELETE /api/ai/providers/:id`：删除供应商。
- `POST /api/ai/providers/:id/test`：按供应商用途发起最小真实连接探针；`kind=text` 调用 Chat Completions，`kind=image` 调用 OpenAI-compatible `/images/generations`，`kind=embedding` 调用 OpenAI-compatible `/embeddings` 并校验向量维度。启用且上游返回成功时返回 `passed`，停用、超时或上游失败时返回 `failed`。响应只包含脱敏供应商状态，不返回原始 API Key。
- `POST /api/ai/generate/image`：根据文章标题和短摘要生成一张图片，并将真实二进制保存为当前工作区知识资产。调用方必须显式传 `allowExternalContent: true`；写作台会先让操作者确认发送范围。服务端只保留提示词摘要、哈希、模型、运行编号和图片摘要，不保存完整 Base64 或 API Key。返回的图片资产默认是 `pending`，确认素材后才允许文章发布和知识索引。

图片供应商应提供 OpenAI-compatible `/images/generations` 接口，返回 `data[0].b64_json`、data URI 或 HTTPS 图片 URL。服务端会校验图片魔数、限制 20 MB 大小，并拒绝不安全的远程地址。

`kind=embedding` 的供应商用于企业知识库向量化和 RAG 检索，服务端调用其 OpenAI-compatible `/embeddings` 接口。建议通过 `TZ_EMBEDDING_PROVIDER_ID` 固定生产 embedding 供应商，避免模型切换造成同一知识库向量维度不一致。

配置文件默认位于服务端 `data/ai-providers.json`，可通过 `TZ_AI_PROVIDER_DATA_DIR` 指定服务端数据目录。文件中的供应商 API Key 使用 AES-256-GCM 保存为 `apiKeyEncrypted`，不会写入 `apiKey` 明文字段。

加密主密钥优先读取服务端环境变量 `TZ_SECRETS_KEY`。开发环境未提供该变量时，服务会首次启动时在数据目录生成仅本机使用的 `.encryption-key` 文件；该文件必须与运行数据一起受访问控制保护，不能提交到 Git。正式私有化部署应由部署系统或密钥管理服务注入 `TZ_SECRETS_KEY`，并将它与加密配置分开备份。
