# 桐灼 GEO 中央中转平台

这是桐灼自有的多租户 AI 数据中转与运营平台，不部署在客户服务器上。AI 效果检测页面属于客户的灼见 GEO 私有化后台；中央平台只负责统一管理爱搜账号、客户积分、任务队列、结果交付和运营账本。

```text
客户私有化 GEO 后台
  → 实例 HMAC 请求
桐灼中央中转平台
  → 统一爱搜账号
爱搜 GEO OpenAPI
  → 中转交付队列
客户实例主动拉取 + ACK
```

## 已实现

- SQLite/WAL 独立中央库：客户租户、私有化实例、统一爱搜账号、能力与价格快照。
- 实例级 HMAC + 时间戳 + Nonce 防重放；浏览器不接触客户实例密钥或爱搜 Token。
- 客户积分冻结、完成结算、失败释放以及追加式账本。
- 持久化任务项、爱搜 `task_commit` / `get_result` Worker、退避轮询和 `submission_uncertain` 人工对账状态。
- 客户端主动拉取交付结果并 ACK，适配客户服务器位于内网的部署方式。
- 44280 运营页面读取中央 API 的客户、实例、任务、账本、经营分析和上游状态；真实原始回答仍由客户实例拉取并落库。收款核验、发票登记、导出、设置保存、实例暂停/恢复/吊销与密钥轮换、失败重试、人工退款和交付死信重投均写入真实 API/审计账本，不再在浏览器修改演示数组。
- 开发环境可显式使用 Mock 适配器进行离线验收；生产环境强制 `TZ_RELAY_AIDSO_MODE=real` 并拒绝演示种子。
- 可选 stdio MCP 运维适配器仅暴露脱敏后的运营查询和受确认的重试、退款、实例密钥轮换动作；它使用管理员根凭证文件调用中央 API，不返回 Token、实例密钥或爱搜原始响应。
- 生产密钥初始化、管理员 Token 轮换、Nginx 渲染和上线预检均由不回显凭证的运维脚本执行；默认备份附带摘要清单，并支持定时完整性、外键和主密钥解密验证。

## 启动

本地开发：

```powershell
npm.cmd start
```

默认地址：`http://127.0.0.1:44280/#dashboard`

开发模式默认可以建立本地演示租户；这些数据只用于离线验收，不得迁移到生产数据库。需要客户实例凭证时，请通过中央管理员 API 临时签发，禁止把密钥写入前端或文档。

生产环境必须关闭演示种子并配置 `.env.example` 中的变量，尤其是：

```text
TZ_RELAY_DATABASE_PATH
TZ_RELAY_MASTER_KEY
TZ_RELAY_ADMIN_TOKEN
TZ_RELAY_AIDSO_MODE=real
AIDSO_TOKEN
TZ_RELAY_SEED_DEMO=0
```

首次上线依次执行 `npm run ops:generate-secrets`、`npm run ops:render-nginx` 和 `npm run ops:preflight`。具体参数、systemd 定时任务与异常处置见 [生产部署手册](deploy/README.md) 和 [运行手册](deploy/OPERATIONS-RUNBOOK.md)。

## 客户实例 API

所有 `/client/v1/*` 请求由客户私有化后台服务端发出。签名串为：

```text
METHOD\nPATH_AND_QUERY\nTIMESTAMP\nNONCE\nSHA256(RAW_BODY)
```

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| `GET` | `/client/v1/capabilities` | 获取中央允许的平台、终端、模式和客户积分价格 |
| `GET` | `/client/v1/quota` | 获取本实例可用/冻结积分与预算 |
| `POST` | `/client/v1/effect-runs/quote` | 预估本次检测任务与积分 |
| `POST` | `/client/v1/effect-runs` | 创建 AI 效果检测运行，需 `Idempotency-Key` |
| `GET` | `/client/v1/effect-runs/:relayRunId` | 查询运行和任务项状态 |
| `GET` | `/client/v1/deliveries` | 拉取等待处理的结果交付 |
| `POST` | `/client/v1/deliveries/:deliveryId/ack` | 客户已幂等落库后确认交付 |
| `POST` | `/client/v1/deliveries/:deliveryId/release` | 客户本地落库失败时释放租约并延迟重试 |
| `POST` | `/client/v1/effect-runs/:relayRunId/cancel` | 取消尚未完成的检测运行 |

客户私有化服务端可在创建运行时传入可选的整数 `maxCustomerCredits`。该字段受实例 HMAC 签名保护；中转站会在创建瞬间按照当前价格规则重新计算 `estimatedCustomerCredits`，若报价超过该上限则返回 `RELAY_CLIENT_CREDIT_CAP_EXCEEDED`，不创建任务也不冻结积分。它适合品牌监测计划的单次额度授权，不能替代中央实例本身的日/月额度和钱包余额校验。

中央运营 API 位于 `/api/v1/admin/*`。生产环境的根凭证 `TZ_RELAY_ADMIN_TOKEN` 仅用于 CLI，或一次性换取浏览器会话：`POST /api/v1/admin/session` 会下发短期 `HttpOnly; Secure; SameSite=Strict` Cookie，随后页面不再保存或重复发送根 Token。`DELETE /api/v1/admin/session` 会立即撤销当前会话；开发时仅允许本机访问的无 Token 管理请求。

运营页面使用的生产数据接口包括：

- `GET /api/v1/admin/overview`：客户、实例、运行、账本、异常和上游状态总览。
- `GET /api/v1/admin/analytics?days=30`：充值入账、客户结算、爱搜成本、积分毛利和按日趋势。
- `GET|PUT /api/v1/admin/settings`：读取或保存计费、安全、留存、告警策略，保存动作写入审计表。
- `GET /api/v1/admin/audit`：管理员、Worker、实例和账本审计事件。
- `POST /api/v1/admin/instances/:instanceId/status|revoke|rotate-secret`：暂停、恢复、永久吊销或轮换客户实例凭证，全部写入审计事件。
- `GET|POST /api/v1/admin/payment-orders` 与订单确认/取消接口：登记线下收款并在到账核验后追加积分账本。
- `GET|POST /api/v1/admin/invoice-requests` 与开具/作废接口：登记发票流程，不伪造税务服务商结果。
- `POST /api/v1/admin/items/:relayItemId/retry`：仅对仍可重试的运行项重新入队；已结算运行由前端创建新运行。
- `POST /api/v1/admin/items/:relayItemId/reconcile`：对 `submission_uncertain` 任务执行人工退款和交付终止。
- `GET /api/v1/admin/deliveries/dead-letter` 与交付重投接口：仅重新交付给原客户实例，不重新检测或扣费。

提交状态不确定的任务项不会自动重提或退款。运营人员核实爱搜侧状态后，可调用 `POST /api/v1/admin/items/:relayItemId/reconcile`，当前支持 `{ "resolution": "refund" }`，释放冻结客户积分并向客户 outbox 发送终态交付。

运行查询可带 `includeItems=true&includeResults=true` 做小批量补偿读取；结果响应有大小上限，批量结果应优先使用 deliveries outbox。

## 可选 MCP 运维适配器

受信任的运维 MCP 宿主可运行：

```powershell
npm.cmd run mcp:serve
```

适配器通过 `TZ_RELAY_ADMIN_TOKEN` 或推荐的 `TZ_RELAY_ADMIN_TOKEN_FILE` 鉴权调用中央管理 API，非本机中转站地址强制使用 HTTPS。它仅提供运营摘要、客户/实例/任务查询、人工退款、任务重试和实例密钥轮换；所有输出均白名单脱敏，且轮换密钥只允许写入预配置的安全交付目录，绝不经 MCP 返回。详见 [MCP-ADAPTER.md](MCP-ADAPTER.md)。

## 验证

```powershell
npm.cmd run check
```

检查覆盖双租户隔离、实例签名防重放、日/月额度、并发限制、幂等创建、租约恢复、重复 ACK、爱搜不可用退款、死信对账、重启恢复、积分冻结与结算、结果交付、账本不可修改性，以及运营后台所有关键按钮使用真实 API、根 Token 不持久化和演示种子生产门禁。

更详细的模块与生产边界见 [RELAY-FOUNDATION.md](RELAY-FOUNDATION.md)。

收款订单、线下到账核验和发票登记的生产边界见 [PAYMENT-OPERATIONS.md](PAYMENT-OPERATIONS.md)。在未取得支付商户与财税服务商的正式资料前，中央后台不会伪造在线支付、自动退款或电子发票。
