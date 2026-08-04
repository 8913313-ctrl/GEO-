# 私有化核心后端实施说明

本阶段只面向“一个客户一套服务器”的私有化部署，不包含 SaaS 租户、套餐、计费和跨客户数据共享。正式后端仍是客户服务器上的 GEOFlow Laravel；`tongzhuo-geo-platform-demo` 继续作为交互原型，不保存正式业务数据或模型密钥。

## 已落地的四部分

### 1. 内部账号、角色与权限

- 沿用 GEOFlow `admin` 登录和 `admin_users` 账号表。
- 新增角色、权限、账号角色关系、审计日志和集成 API Key 表。
- 初始角色：超级管理员、运营管理员、内容编辑、审核员、发布员、只读分析员。
- 权限覆盖官网、客户、知识库、选题计划、文章生成、审核、发布、GEO 监测、分析、模型和系统管理。
- `admin.rbac` 已接到旧 GEOFlow 后台路由，避免普通角色通过旧 URL 绕过新权限。
- 旧 `admin.super` 已统一使用新 RBAC 的 `super_admin` 角色判断。
- 浏览器管理入口：`/{ADMIN_BASE_PATH}/access/*`，使用 Session、CSRF 和 `admin.permission`。
- 集成密钥只开放 `GET /api/v1/access/me` 自检；账号、角色和密钥变更不允许由 Bearer Token 执行。

内部集成 Token 使用随机明文（仅创建时显示一次）和不可逆 HMAC 摘要验证，不保存可解密明文。

### 2. 正式数据库与业务 API

正式表覆盖：

`业务线 → 关键词包/关键词 → 问题词库 → 选题库 → 内容计划/文章任务 → 写作智能体 → 生成运行 → 文章引用/版本`

业务接口前缀为 `/api/v1/content`，使用 `tgf_...` 集成密钥：

- 读取：`content.read`
- 业务编辑：`content.write`
- 创建或回写生成任务：`content.generate`

关键词提升到问题、问题提升到选题、选题加入计划均使用数据库事务；更新接口支持 `expected_updated_at`/`If-Unmodified-Since` 冲突保护，避免两名运营人员覆盖彼此修改。

### 3. API Key 加密保存与真实模型网关

`ai_providers.api_key` 使用 Laravel `encrypted` cast，以服务器 `APP_KEY` 加密；模型配置的任何 JSON 响应都不会返回密钥原文，只返回“是否已配置”和指纹前缀。

模型管理入口：

- `GET/POST /{ADMIN_BASE_PATH}/ai/providers`
- `GET/PUT/DELETE /{ADMIN_BASE_PATH}/ai/providers/{id}`
- `POST /{ADMIN_BASE_PATH}/ai/providers/{id}/test`

模型调用入口：

- `POST /api/v1/ai/chat`
- `POST /api/v1/ai/generate-article`
- `POST /api/v1/ai/embeddings`

网关兼容 OpenAI 风格的 Chat Completions 和 Embeddings，支持独立 Chat/Embedding Provider、超时、有限重试、错误分类、调用量、每日限额和生成运行快照。浏览器不直接请求模型供应商。

`APP_KEY` 是客户数据的加密根密钥，部署后不得随意更换，必须进入服务器备份和灾备流程；交付包和源码包不得包含真实 `.env` 或客户 API Key。

### 4. 真实 RAG 与可追溯引用

知识表包含文档、文档版本、语义切片、Embedding 模型/维度/哈希、检索运行和引用快照。首批可靠解析格式为纯文本、Markdown 和 HTML；PDF/Word 解析尚未在本阶段宣称支持。

索引过程：

1. 正文规范化并按标题、段落和重叠窗口切片。
2. 服务端调用真实 Embedding Provider。
3. PostgreSQL 已启用 pgvector 时，同时保存 `vector` 和 JSON 备份；其他数据库使用 JSON 向量余弦检索。
4. 检索按业务线、站点、文档范围、可见性、审核和版本过滤。
5. 向量相似度与标题/正文关键词得分混排，返回 K1、K2…引用。
6. 文章生成只接收服务端检索结果；生成记录、文章版本和引用快照共同留档。

当查询 Embedding 临时不可用时，检索会明确标记 `keyword_fallback`；文档首次索引仍必须有真实 Embedding，不能用伪向量冒充完成。

同源后台接口：

- `GET/POST /api/internal/v1/knowledge-documents`
- `GET/PUT/DELETE /api/internal/v1/knowledge-documents/{id}`
- `POST /api/internal/v1/knowledge-documents/{id}/index`
- `POST /api/internal/v1/rag/search`
- `POST /api/internal/v1/rag/generate-article`

这些接口使用后台 Session 和 CSRF，分别受 `knowledge.read`、`knowledge.write`、`knowledge.manage`、`content.generate` 权限控制。

## 部署配置

推荐 PostgreSQL 16 + pgvector；MySQL/MariaDB 可以运行 JSON 向量回退模式。

```dotenv
APP_KEY=base64:客户独立且稳定的Laravel密钥
GEOFLOW_RAG_PGVECTOR=true
GEOFLOW_RAG_CHUNK_SIZE=1200
GEOFLOW_RAG_CHUNK_OVERLAP=160
GEOFLOW_RAG_EMBEDDING_BATCH_SIZE=64
GEOFLOW_RAG_TOP_K=6
GEOFLOW_RAG_CANDIDATE_LIMIT=2000
GEOFLOW_RAG_VECTOR_WEIGHT=0.72
GEOFLOW_AI_TIMEOUT_SECONDS=60
GEOFLOW_AI_CONNECT_TIMEOUT_SECONDS=10
GEOFLOW_AI_MAX_RETRIES=2
```

安装顺序：

```bash
bash deployment/install-geoflow-overrides.sh --laravel-root /www/wwwroot/geoflow --dry-run
bash deployment/install-geoflow-overrides.sh --laravel-root /www/wwwroot/geoflow
bash deployment/verify-geoflow-overrides.sh --laravel-root /www/wwwroot/geoflow --base-url https://customer.example.com
```

安装后先配置一个 Chat Provider 和一个 Embedding Provider，再录入知识文档并执行索引。已有 GEOFlow 管理账号中，系统会优先保留上游标记的超级管理员；旧版本没有该标记时，只将最早创建的管理员作为初始超级管理员。

## 验收

Windows 母版静态检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-AccessControl.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File geoflow-integration/deployment/check-content-workflow-contract.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File geoflow-integration/deployment/check-ai-provider-contract.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File geoflow-integration/deployment/check-rag-contract.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-ServerOverrides.ps1
```

最终验收必须在有 PHP、数据库和真实 Laravel 工程的 Linux 测试服务器完成：`php -l`、`php artisan migrate --force`、`php artisan route:list`、Provider 连接测试、知识索引、RAG 检索和一篇带引用文章的完整生成流程。
