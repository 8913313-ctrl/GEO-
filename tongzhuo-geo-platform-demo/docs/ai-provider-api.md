# AI 供应商配置接口

接口只在后台服务端保存供应商配置。`apiKey` 不会出现在任何响应中，响应使用 `hasApiKey` 与 `apiKeyMasked` 表示密钥状态；前端不应把密钥写入 `localStorage`。

## 路由

- `GET /api/ai/providers`：列出供应商（不返回原始密钥）。
- `POST /api/ai/providers`：创建供应商。请求字段：`id`（可选）、`name`、`baseUrl`、`model`、`apiKey`（可选）、`status`（`enabled` / `disabled`）。
- `PATCH /api/ai/providers/:id`：部分更新；省略 `apiKey` 表示保留，传空字符串或 `null` 表示清除。
- `DELETE /api/ai/providers/:id`：删除供应商。
- `POST /api/ai/providers/:id/test`：向该供应商的 Chat Completions 发起最小真实连接探针；启用且上游返回成功时返回 `passed`，停用、超时或上游失败时返回 `failed`。响应只包含脱敏供应商状态，不返回原始 API Key。

配置文件默认位于服务端 `data/ai-providers.json`，可通过 `TZ_AI_PROVIDER_DATA_DIR` 指定服务端数据目录。文件中的供应商 API Key 使用 AES-256-GCM 保存为 `apiKeyEncrypted`，不会写入 `apiKey` 明文字段。

加密主密钥优先读取服务端环境变量 `TZ_SECRETS_KEY`。开发环境未提供该变量时，服务会首次启动时在数据目录生成仅本机使用的 `.encryption-key` 文件；该文件必须与运行数据一起受访问控制保护，不能提交到 Git。正式私有化部署应由部署系统或密钥管理服务注入 `TZ_SECRETS_KEY`，并将它与加密配置分开备份。
