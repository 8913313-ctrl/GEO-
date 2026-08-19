# 桐灼 GEO 私有化部署手册

本文对应当前 0.5 生产底座版本。系统采用“一家企业一套部署”：管理后台、业务 API、SQLite 数据库、模型配置和发布任务运行在客户服务器；本地发布助手安装在运营人员 Windows 电脑，只保存平台登录态和浏览器 Profile。

## 1. 运行要求

- Node.js 24 或更高版本（使用内置 `node:sqlite`）。
- Windows Server、Linux 或 Docker 均可；服务器需要能够写入数据目录。
- 反向代理对外提供 HTTPS。浏览器不应直接暴露 Node 进程端口。
- 本地发布助手可以访问服务器的 HTTPS 地址；服务器不反向连接运营人员电脑。

## 2. 配置环境变量

复制 `.env.example` 为 `.env`，再按客户环境填写。至少需要设置一个随机的 `TZ_MASTER_KEY`（32 字节，Base64 或 Hex），它用于加密模型 API Key；不要把 `.env` 提交到 Git。

常用配置：

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `development` |
| `TZ_BIND_HOST` | Node 监听地址；生产环境建议只监听 `127.0.0.1` | `127.0.0.1` |
| `PORT` | Node 端口 | `44127` |
| `TZ_DATA_DIR` | 运行数据、发布器状态和日志目录 | `./data` |
| `TZ_DATABASE_PATH` | SQLite 数据库文件 | `data/tongzhuo-production.sqlite` |
| `TZ_MASTER_KEY` | API Key 加密主密钥，生产必填 | 无 |
| `TZ_COOKIE_SECURE` | 仅通过 HTTPS 发送登录 Cookie | `false` |
| `TZ_TRUST_PROXY` | Node 位于可信反向代理后时设为 `true` | `false` |
| `TZ_SESSION_HOURS` | 会话有效期 | `12` |
| `TZ_EMBEDDING_PROVIDER_ID` | 用于知识向量化和检索的 embedding 供应商 ID | 空（使用本地兜底） |
| `TZ_EMBEDDING_TIMEOUT_MS` | embedding 请求超时时间 | `30000` |
| `TZ_RAG_LOCAL_FALLBACK` | embedding 服务不可用时是否使用本地兜底向量 | `1` |
| `TZ_RELAY_BASE_URL` | 桐灼中央中转站地址（仅服务端调用） | 空（未接入） |
| `TZ_RELAY_INSTANCE_ID` | 中转站分配的私有化实例 ID | 空 |
| `TZ_RELAY_CLIENT_ID` | 中转站分配的实例 Client ID | 空 |
| `TZ_RELAY_CLIENT_SECRET` | 仅非生产本地调试可用；生产 Compose 禁止使用 | 空 |
| `TZ_RELAY_CLIENT_SECRET_FILE` | 生产容器内 Relay HMAC 文件路径；由 Compose Secret 设置，不手填明文 | 空 |
| `TZ_RELAY_CLIENT_SECRET_HOST_PATH` | 仅 Compose `cutover.env` 使用的受保护宿主机 HMAC 文件绝对路径 | 空（未接入） |
| `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH` | 仅 Compose `cutover.env` 使用的独立临时检测服务 Token 文件路径 | 空（默认关闭） |
| `TZ_RELAY_DELIVERY_CONSUMER` | 交付消费者 ID；多进程部署时每个实例固定一个 | 自动生成 |
| `TZ_RELAY_PULL_INTERVAL_MS` | 后台主动拉取交付的间隔 | `10000` |
| `TZ_RELAY_PULL_BATCH_SIZE` | 每次拉取的交付数量 | `50` |
| `TZ_BRAND_MONITORING_SCHEDULER_INTERVAL_MS` | 客户服务端检查到期品牌监测计划的间隔 | `60000` |
| `TZ_BRAND_MONITORING_SCHEDULER_BATCH_SIZE` | 单次调度最多领取的计划运行数 | `12` |

中转接入后，浏览器只调用客户本地的 `/api/v1/diagnostics/*`；不要把上述凭证注入前端。生产 Docker Compose 将 `TZ_RELAY_BASE_URL` 配置为中央中转站 HTTPS Origin，并通过 `cutover.env` 中的 `TZ_RELAY_CLIENT_SECRET_HOST_PATH` 把仅服务端可读的宿主机文件作为 Compose Secret 挂到 `geo-admin`；容器内由 `TZ_RELAY_CLIENT_SECRET_FILE=/run/secrets/tz_relay_client_secret` 读取，`app.env` 不能包含明文 HMAC。客户后台使用 `GET /api/v1/diagnostics/relay/capabilities`、`GET /api/v1/diagnostics/relay/quota` 和 `POST /api/v1/diagnostics/relay/quote` 获取能力与报价，再创建项目的 `relay-runs`。服务端后台会主动拉取中央 `/client/v1/deliveries`，本地事务写入 `diagnostic_evidence`（`evidence_type=live`）和指标后才 ACK；写入失败会 release 交付租约并重试。单问题临时检测服务使用另一个 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH`，默认空白关闭，绝不能与 Relay HMAC 复用。

生产环境通过域名和 HTTPS 访问时，设置：

```dotenv
NODE_ENV=production
TZ_BIND_HOST=127.0.0.1
TZ_COOKIE_SECURE=true
TZ_TRUST_PROXY=true
TZ_MASTER_KEY=<32-byte-base64-secret>
```

## 3. 启动与首次初始化

```powershell
cd "G:\桐灼GEO运营\tongzhuo-geo-platform-demo"
npm.cmd install
npm.cmd start
```

首次打开后台会显示“创建企业管理员”。这只在数据库为空时出现；创建完成后，系统会通过 HttpOnly Cookie 建立会话，并要求写操作携带 CSRF Token。管理员随后在“系统设置 → 成员与权限”创建运营、审核和只读账号。

健康检查：

```text
GET /health/live   # 进程存活
GET /health/ready  # 数据库、迁移和依赖已就绪
GET /api/v1/auth/status
```

`/health/ready` 返回 200 后才能把服务标记为可接收流量。

## 4. 企业知识库与真实 RAG

知识资料通过 `/api/v1/knowledge` 服务端接口进入正式知识表，不再只保存在浏览器工作区：

```text
创建文档库 / 问答库
→ 上传或提交资料正文（支持文本与 Base64 文件内容）
→ 形成不可变知识版本
→ 管理员 / 审核员批准
→ 自动分块、embedding、写入 SQLite 向量索引
→ 内容生成时按业务线、知识范围和审核状态做向量 + 关键词混合检索
→ 返回 chunk、来源、定位、版本和相关度，写入文章引用
```

推荐为客户配置一个 OpenAI-compatible embedding 供应商（供应商 `kind=embedding`），并把它的 ID 写入 `TZ_EMBEDDING_PROVIDER_ID`。没有配置时系统会使用 256 维本地 hash embedding 与关键词检索，保证离线私有部署仍可运行；正式交付建议使用企业认可的 embedding 模型，并将 `TZ_RAG_LOCAL_FALLBACK` 设为 `0`，避免 embedding 服务异常时降级为本地近似向量。

只有 `approved` 且 `indexed` 的知识版本会参与检索。文档新版本不会覆盖旧版本，历史文章继续绑定生成时的版本和 chunk。业务线过滤、企业公共库、内部资料范围和审计记录由服务端执行，不能通过前端参数绕过。

## 5. 反向代理

生产环境推荐使用 `deploy/nginx.conf` 作为参考配置：代理只转发到 `127.0.0.1:44127`，开启 HTTPS、请求体限制和安全响应头。Node 进程不直接绑定公网地址。若代理终止 TLS，必须设置 `TZ_TRUST_PROXY=true` 和 `TZ_COOKIE_SECURE=true`，并确保代理只来自受信网络。

## 6. 备份与恢复

SQLite 使用 WAL 模式。备份脚本会在写入期间执行 checkpoint，并同时保存数据库、发布器状态、模型配置和版本信息：

```powershell
npm.cmd run backup
```

也可以指定备份目录：

```powershell
$env:TZ_BACKUP_DIR = "D:\GEO-backups"
npm.cmd run backup
```

恢复前停止服务，确认目标目录和备份文件来自同一客户部署，再执行：

```powershell
npm.cmd run restore -- "D:\GEO-backups\2026-07-26T080000Z"
```

恢复后重新启动并检查 `/health/ready`。`TZ_MASTER_KEY` 必须与备份创建时相同，否则历史 API Key 无法解密；如果主密钥丢失，只能重新录入模型凭据。

## 7. 发布助手配对

1. 登录后台“发布运营”，生成一次性配对码（有效期 10 分钟）。
2. 在运营人员电脑安装并打开本地发布助手，输入后台 HTTPS 地址和配对码。
3. 助手注册设备后获得一次性 Token；服务器只保存 Token 摘要，不保存平台 Cookie。
4. 在助手中创建账号组并登录平台。助手通过心跳同步平台、账号别名和登录状态，后台以同步状态作为发布门禁。
5. 后台创建发布任务时选择一个账号组和多个不同平台；同一平台不能选择该组的多个账号。助手按平台顺序领取任务并回写结果。

未配对、凭据无效或配对码过期属于客户端状态问题，API 分别返回 401 `PUBLISHER_AUTH_REQUIRED` 或 409 `PAIRING_CODE_INVALID`，不会被记为服务器 500。

## 8. 日常运维检查

- 每日检查 `/health/ready`、磁盘空间和 `data/logs`。
- 每日至少保留一份离线备份，并定期做恢复演练。
- 不在工单、截图或日志中暴露 `TZ_MASTER_KEY`、模型 API Key、发布器 Token、Cookie 或浏览器 Profile。
- 变更模型、权限、发布平台和企业知识时保留审计日志；管理员账号启用强密码并限制访问来源。
- 升级前先备份；升级后运行 `npm.cmd run check`，再检查登录、模型连接、工作区保存和发布器心跳。

## 9. 当前交付边界

本版本已具备正式底座：SQLite 迁移/WAL、账号角色权限、会话和 CSRF、工作区版本锁、审计日志、API Key 加密、发布器凭据摘要、健康检查、Docker/Compose、备份恢复脚本和生产 API 自动化检查。

真实模型生成、RAG、PDF/Office 解析、OCR 队列、知识资产、异步索引和可插拔向量后端已经接通；部署时按客户环境配置 OCR/远程向量服务。官网 CMS、效果监测采样和各平台发布适配器仍按客户交付范围分阶段接入。页面中标记为“演示数据”的监测指标不能作为客户交付承诺。
