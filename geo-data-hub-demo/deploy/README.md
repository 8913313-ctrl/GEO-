# 桐灼中央中转平台生产部署

## 1. 生产密钥

生产环境必须关闭演示种子并启用真实爱搜：

```dotenv
NODE_ENV=production
TZ_RELAY_SEED_DEMO=0
TZ_RELAY_AIDSO_MODE=real
TZ_RELAY_ALLOW_INSECURE_ADMIN=0
TZ_RELAY_PUBLIC_ORIGIN=https://relay.example.com
TZ_RELAY_TRUSTED_PROXY_ADDRESSES=127.0.0.1
TZ_RELAY_REQUIRE_HTTPS_FOR_ADMIN=1
TZ_RELAY_MASTER_KEY=<32-byte base64url/base64/hex key>
TZ_RELAY_ADMIN_TOKEN=<random token, at least 16 characters>
AIDSO_TOKEN=<桐灼统一爱搜账号 token>
```

推荐使用 Docker/Kubernetes secret 文件，不要把密钥提交到 `.env` 或镜像：

```bash
export TZ_RELAY_MASTER_KEY_SECRET_FILE=/srv/secrets/relay-master.key
export TZ_RELAY_ADMIN_TOKEN_SECRET_FILE=/srv/secrets/relay-admin.token
export AIDSO_TOKEN_SECRET_FILE=/srv/secrets/aidso.token
docker compose -f deploy/docker-compose.production.yml \
  -f deploy/docker-compose.production.secrets.yml up -d --build
```

首次启动会把 `AIDSO_TOKEN` 加密写入 SQLite。完成首次启动后，可以清除进程环境中的 AIDSO Token，再通过管理员 API 轮换；数据库中的密文由 `TZ_RELAY_MASTER_KEY` 解密。主密钥丢失等同于无法恢复 Token 和客户实例密钥，必须纳入备份。

初始化生产密钥（只写入权限受控目录，命令输出只包含指纹，不打印凭证）：

```bash
node scripts/generate-relay-secrets.mjs \
  --production \
  --output-dir /srv/secrets/tongzhuo-relay \
  --aidso-token-file /run/private/aidso-token
```

脚本会生成 `relay-master.key`、`relay-admin.token` 和 `aidso.token`。已有文件一律拒绝覆盖；主密钥不能通过“重新生成”轮换，否则历史实例密钥和数据库中的 AIDSO 密文将无法解密。AIDSO 来源文件在首次启动完成后应从临时位置销毁。

管理员 Token 轮换采用“新 Token 部署并重启，再撤销旧 Token”的流程。中转服务只接受当前配置的 Token；不要通过浏览器或日志传输 Token。

使用文件注入时可原子生成新 Token：

```bash
node scripts/rotate-admin-token.mjs --file /srv/secrets/relay-admin.token --force
docker compose -f deploy/docker-compose.production.yml restart relay
```

### 管理员浏览器会话

`TZ_RELAY_ADMIN_TOKEN` 是根凭证：只用于 CLI，或在浏览器登录时一次性换取会话。运营页面会向
`POST /api/v1/admin/session` 临时发送 Bearer 根凭证；服务端返回的只有短期会话状态，并下发不含根凭证的
HttpOnly Cookie。之后页面只依赖 Cookie 调用管理员 API。

生产默认会话策略：

```dotenv
TZ_RELAY_ADMIN_SESSION_TTL_SECONDS=3600
TZ_RELAY_ADMIN_SESSION_COOKIE_NAME=__Host-tz-relay-admin-session
TZ_RELAY_ADMIN_SESSION_SECURE=1
TZ_RELAY_ADMIN_SESSION_RETENTION_DAYS=7
```

- Cookie 固定为 `HttpOnly; Secure; SameSite=Strict; Path=/`，并使用 `__Host-` 前缀；HTTPS 是必需条件。
- 状态变更的 Cookie 请求必须同源；CLI 仍可显式携带 `Authorization: Bearer <root token>`。
- `DELETE /api/v1/admin/session` 会立即撤销当前会话并清除 Cookie；会话创建、撤销和会话操作均写入审计。
- 服务重启会撤销仍存活的管理员会话，避免数据库恢复或部署切换后旧 Cookie 被重新启用；管理员需重新登录。
- 不要通过 URL、反向代理日志、浏览器存储或脚本变量长期保存根 Token。

### 可选 MCP 运维适配器

MCP 适配器是独立 stdio 进程，不应作为公网 HTTP 服务暴露。它以 CLI 身份读取同一只读管理员根凭证文件，并仅调用中央管理 API：

```bash
TZ_RELAY_MCP_URL=https://relay.example.com \
TZ_RELAY_ADMIN_TOKEN_FILE=/run/secrets/tz_relay_admin_token \
npm run mcp:serve
```

仅允许受信任的 MCP 宿主/服务账号启动它。适配器不回传 Token、实例密钥或爱搜原始响应；任务重试、人工退款和实例密钥轮换均要求显式确认。密钥轮换还必须配置一个受 ACL 保护的 `TZ_RELAY_MCP_SECRET_HANDOFF_DIR`，新密钥只写入该目录供安全交付流程消费。完整工具范围和交付规范见 [MCP-ADAPTER.md](../MCP-ADAPTER.md)。

## 2. 启动与反向代理

先用脚本把域名、证书路径和管理网段写入一份未提交的 Nginx 配置；脚本拒绝示例域名、`0.0.0.0/0`、宽网段和非回环上游：

```bash
npm run ops:render-nginx -- \
  --output /etc/nginx/conf.d/tongzhuo-relay.conf \
  --server-name relay.tongzhuo.cn \
  --certificate /etc/letsencrypt/live/relay.tongzhuo.cn/fullchain.pem \
  --certificate-key /etc/letsencrypt/live/relay.tongzhuo.cn/privkey.pem \
  --admin-allow 10.20.30.0/24 \
  --health-allow 10.20.30.10
nginx -t -c /etc/nginx/nginx.conf
```

然后执行部署预检。预检不会创建数据库或修改线上数据，只检查真实密钥来源、种子关闭、HTTPS Origin、精确代理 IP、渲染后的 Nginx、备份目录、日志接收方式和告警通道：

```bash
npm run ops:preflight -- --nginx /etc/nginx/conf.d/tongzhuo-relay.conf
```

```bash
docker compose -f deploy/docker-compose.production.yml up -d --build
```

Node 仅监听 `127.0.0.1:44280`（或内部网络）。由 Nginx/网关加载 `deploy/nginx.conf`，负责 HTTPS、HSTS、管理网段访问控制和请求体限制。管理员请求必须带：

```http
Authorization: Bearer <TZ_RELAY_ADMIN_TOKEN>
```

`/health/live` 和 `/health/ready` 只允许负载均衡器或内网访问；运营数据和财务数据通过需要管理员鉴权的 `/api/v1/admin/ops/summary` 获取。

## 3. 备份、恢复和清理

备份脚本使用 SQLite `VACUUM INTO` 生成事务一致的单文件快照，并生成带 SHA-256 清单的目录。默认备份绝不复制由环境变量、Docker Secret 或 Secret Manager 注入的主密钥；只有显式传入 `--include-managed-key --managed-master-key-file <受控可写文件>` 时，才会备份该本地受控密钥文件，且 `/run/secrets` 永远不能被复制或恢复：

```bash
node scripts/backup-relay.mjs
node scripts/backup-relay.mjs --retention-days 30
npm run ops:verify-backup
```

建议每天至少一次备份并复制到异地对象存储；保留至少 30 天，定期演练恢复：

systemd 部署可启用 `tongzhuo-relay-backup.service` 和 `tongzhuo-relay-backup.timer`：

```bash
sudo systemctl enable --now tongzhuo-relay-backup.timer
sudo systemctl enable --now tongzhuo-relay-backup-verify.timer
```

备份完成后每周自动执行完整性、外键和当前主密钥解密验证；验证失败会通过 systemd 非零退出进入主机监控。生产环境应将 `TZ_RELAY_BACKUP_DIR` 挂载到独立磁盘，并由主机或对象存储复制到异地，不能只依赖与数据库同一块磁盘。

```bash
node scripts/restore-relay.mjs \
  --backup /srv/tongzhuo-relay/backups/backup-<timestamp> \
  --force
```

恢复前必须停止服务。脚本会把当前数据库移动到 `.pre-restore-*` 目录，不会静默删除。账本、运行记录和结果不会被自动清理；运行时清理只删除超过保留期的已确认/死信交付、审计事件和过期 nonce：

```dotenv
TZ_RELAY_DELIVERY_RETENTION_DAYS=90
TZ_RELAY_AUDIT_RETENTION_DAYS=365
TZ_RELAY_RAW_RESPONSE_RETENTION_DAYS=90
TZ_RELAY_CLEANUP_INTERVAL_MS=21600000
```

## 4. 日志、告警和人工对账

容器日志配置了滚动限制；主机或日志平台应采集 `relay-worker`、`relay-cleanup` 和 `relay-server` 前缀。死信/提交不确定任务通过：

```http
GET  /api/v1/admin/ops/summary
POST /api/v1/admin/items/:relayItemId/retry
POST /api/v1/admin/items/:relayItemId/reconcile  {"resolution":"refund","note":"..."}
GET  /api/v1/admin/audit
```

可用 cron、systemd timer 或监控平台运行：

```bash
TZ_RELAY_ADMIN_TOKEN='...' node scripts/check-relay-ops.mjs
```

当服务不可达、AIDSO 不健康或人工关注项超过阈值时脚本以非零状态退出；设置 `TZ_RELAY_ALERT_WEBHOOK_URL` 可发送告警。不要把完整响应（含客户信息）直接发到公开聊天渠道。

systemd 单元将结构化 JSON 日志写入 journald，并启用 `UMask=0077`、只读系统目录、禁止提权和系统调用架构限制；Docker 使用本地滚动日志驱动。预检要求 `TZ_RELAY_LOG_SINK=journal|container|stdout-collector`，并要求配置 HTTPS 告警 Webhook 或显式声明由监控平台接收 `ops:check` 的非零退出码。

## 5. 客户实例密钥

管理员创建实例时只在 HTTPS 响应中返回一次 `clientSecret`。轮换：

```http
POST /api/v1/admin/instances/:instanceId/rotate-secret
```

轮换会递增 `secretVersion`、清理 nonce 并立即吊销旧密钥。客户迁移完成后可暂停或永久吊销：

```http
POST /api/v1/admin/instances/:instanceId/status {"status":"suspended"}
POST /api/v1/admin/instances/:instanceId/revoke
```

## Production preflight gate

1. Copy `.env.example` into production configuration, set `TZ_RELAY_PUBLIC_ORIGIN` to the real HTTPS origin, and set `TZ_RELAY_TRUSTED_PROXY_ADDRESSES` to the exact Nginx-to-Node TCP peer address. This is never a public-client CIDR, `0.0.0.0/0`, or all RFC1918 space.
2. Generate a new, placeholder-free Nginx file with `npm run ops:render-nginx`; review the exact VPN/load-balancer allowlist and run `nginx -t`. The template is intentionally fail-closed for remote management, the console and health endpoints until that allowlist is reviewed.
3. Inject `TZ_RELAY_MASTER_KEY`, `TZ_RELAY_ADMIN_TOKEN` and `AIDSO_TOKEN` from an approved Secret Manager or Docker/Kubernetes Secrets. Never commit them to `.env`, images, browser storage, logs or tickets. `AIDSO_BASE_URL` must be HTTPS in production; an HTTP endpoint would expose the shared token and customer prompts. Production must keep `TZ_RELAY_SEED_DEMO=0`; a database containing demo data or development price/capability records is rejected at start-up. Run `npm run ops:preflight` before the first start.
4. A blank production database starts deliberately degraded: it contains no sample AIDSO platform matrix or price book. In the operator console, save an approved capability snapshot from the official contract/verified API first, then save the matching commercial price rules and activate the provider. Readiness stays failed until token, capabilities and at least one active price rule are present.
5. On the target host run `npm run check`, `npm run check:backup-restore`, and `docker compose -f deploy/docker-compose.production.yml config`. Record two independent client-instance acceptance runs for signing, tenant isolation, quotas, duplicate submit/ACK, lease expiry and restart recovery.
6. Default backups deliberately omit a master key injected by environment or Secret Manager. Before restoration, provision the same master key in the target environment, run `npm run ops:verify-backup -- --backup <directory>`, then run `npm run ops:restore -- --backup <directory> --force`; the restore command never writes `/run/secrets` and decrypts staged provider/instance credentials before it atomically replaces the live database. Rehearse recovery on an isolated host at least quarterly.
7. Original AIDSO responses remain while a client has queued/leased deliveries, then are cleared from both task rows and acknowledged/dead-letter delivery payloads after `TZ_RELAY_RAW_RESPONSE_RETENTION_DAYS` or a shorter operator policy. Task state, original delivery hashes, billing ledger and audit records remain; an operator setting can tighten but never extend the deployment ceiling.
8. Add `scripts/check-relay-ops.mjs` to monitoring. On unreachability, readiness failure, AIDSO failure or attention-item threshold breach, freeze the affected instance, verify AIDSO-side state, then use the audited retry/reconcile/refund APIs. Delivery dead letters can be inspected and requeued with a mandatory operator note; never alter the SQLite ledger directly.

Real AIDSO capability/price synchronization and merchant payment acceptance require the official API contract, valid credentials and real-customer authorization. The relay is prepared for that controlled acceptance, but no Mock or rehearsal record may be labeled as a real production acceptance before those external prerequisites are supplied.

收款订单、到账核验、发票登记与支付商户接入边界见 [PAYMENT-OPERATIONS.md](../PAYMENT-OPERATIONS.md)。未签约支付或财税服务商时，仅启用“待核验订单 → 财务确认到账 → 追加积分账本”的流程；不得将浏览器表单、截图或客户自述当作自动入账依据。

## 运维告警定时任务

生产主机可直接安装随附的 `tongzhuo-relay-ops.service` 与 `tongzhuo-relay-ops.timer`：

```bash
sudo install -m 0644 deploy/tongzhuo-relay-ops.service /etc/systemd/system/
sudo install -m 0644 deploy/tongzhuo-relay-ops.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tongzhuo-relay-ops.timer
```

在 `/srv/tongzhuo-relay/.env` 为 `TZ_RELAY_URL` 设置一个受 Nginx 管理网段允许的 HTTPS 地址。定时任务每五分钟检查 `/health/ready`、运营摘要和一次非计费的爱搜探针；发现中转站不可达、待对账任务超阈值或爱搜探针失败时，以非零状态退出，并可将脱敏元数据发送到 `TZ_RELAY_ALERT_WEBHOOK_URL`。管理员 Token 从现有 Secret 文件读取，不应写入 unit 文件、命令行或日志。

签名按实例隔离；任何实例的密钥都不能调用其他实例的数据。
