# 桐灼中央中转站后端基础

本目录的模块已把 `geo-data-hub-demo` 从纯前端演示升级为可运行的中央中转平台。`server.mjs` 负责 HTTP/健康检查/静态运营页面，`relay-api.mjs` 暴露中央运营 API 和客户实例 API，页面通过中央 API 读取真实运营状态。

## 模块

- `relay-store.mjs`：SQLite/WAL 多租户事实库、实例 HMAC 鉴权、价格快照、积分冻结/结算/释放、任务状态、交付 Outbox 和 ACK。
- `aidso-client.mjs`：爱搜 OpenAPI 适配器，包含真实 `AidsoClient`、本地 `MockAidsoClient` 和结果标准化。
- `relay-worker.mjs`：持久任务项的提交、轮询、指数退避、失败处理与交付生成。
- `relay-api.mjs`：中央运营端和客户私有化实例的 HTTP 契约、请求体限制与错误映射。
- `relay-bootstrap.mjs`：统一爱搜账号、能力/价格快照和本地演示实例初始化。

中央服务启动时可按以下方式组合：

```js
import { RelayStore } from "./relay-store.mjs";
import { AidsoClient } from "./aidso-client.mjs";
import { RelayWorker } from "./relay-worker.mjs";

const store = new RelayStore();
const provider = store.getProviderAccount("provider_aidso_primary");
const aidso = new AidsoClient({ token: process.env.AIDSO_TOKEN || store.getProviderToken(provider.providerAccountId) });
const worker = new RelayWorker({ store, aidsoClient: aidso });
worker.start();
```

生产环境应显式设置以下持久化配置，不能使用临时目录：

```text
TZ_RELAY_DATABASE_PATH=/srv/tongzhuo-relay/data/tongzhuo-relay.sqlite
TZ_RELAY_MASTER_KEY=<32-byte base64url/base64/hex key>
AIDSO_TOKEN=<桐灼统一爱搜主账号 token>
```

`AIDSO_TOKEN` 只在中央服务进程中出现。若使用 `upsertProviderAccount({ token })` 保存，Token 以 AES-256-GCM 密文写入数据库；任何公开查询都不会返回密文或 Token。

## 给 HTTP 层的调用顺序

每个客户端请求先调用：

```js
const identity = store.authenticateInstanceRequest({
  clientId,
  method,
  requestTarget, // 保留 query string
  timestamp,
  nonce,
  signature,
  rawBody
});
```

签名串固定为：

```text
METHOD\nrequestTarget\ntimestamp\nnonce\nSHA256(rawBody)
```

每次重试均需新的 Nonce；业务重试继续使用相同 `Idempotency-Key`。不要接受由客户端请求体提供的 `tenantId` 或任意上游 Token。

| 客户端接口 | Store 方法 |
| --- | --- |
| `POST /client/v1/effect-runs` | `createEffectRun({ instanceId: identity.instance.instanceId, ...body, idempotencyKey })` |
| `GET /client/v1/effect-runs/:id` | `getRunForInstance(identity.instance.instanceId, id, { includeItems: true })` |
| `GET /client/v1/deliveries` | `leaseDeliveries({ instanceId, consumerId, limit })` |
| `POST /client/v1/deliveries/:id/ack` | `acknowledgeDelivery({ instanceId, deliveryId, consumerId, payloadHash })` |
| `POST /client/v1/deliveries/:id/release` | `releaseDelivery({ instanceId, deliveryId, consumerId, delayMs })` |
| `POST /client/v1/effect-runs/:id/cancel` | `cancelRun(id, { instanceId, actorType: "instance" })` |
| `GET /client/v1/capabilities` | `listCapabilitiesForInstance(instanceId)` |
| `GET /client/v1/quota` | `getQuotaForInstance(instanceId)` |

中央运营端使用 `createTenant`、`provisionInstance`、`upsertProviderAccount`、`upsertPriceRule` 与 `creditTenant` 做开通、定价和充值。

## 关键安全行为

- 创建运行在单个短 SQLite 事务中完成价格校验、积分冻结、`relay_runs`、`relay_items` 与追加式账本写入。
- 客户端结果默认通过 Outbox 主动拉取；重复拉取和重复 ACK 都是幂等的，交付失败不会触发重扣费或重跑爱搜。
- Worker 在真实 `task_commit` 前先持久化 submit attempt。提交超时、连接中断、5xx 或 Worker 在收到 `reqId` 前崩溃时，任务进入 `submission_uncertain`，积分保持冻结，禁止自动重新提交或退款；必须先完成爱搜对账或人工明确重试。
- 已取得 `reqId` 的轮询可安全重试。单项失败只释放该项未结算的冻结积分，不影响同一批已完成项。
- 客户交付中只有桐灼客户积分，不包含爱搜 Token、爱搜实际成本或其他租户数据。
- 提交状态不确定的任务项不会自动重提或退款；运营人员核实爱搜后可调用 `POST /api/v1/admin/items/:relayItemId/reconcile`，当前支持 `{"resolution":"refund"}`，由追加式账本释放冻结积分。

验证命令：

```powershell
node scripts\check-relay-foundation.mjs
```

该检查使用内存 SQLite 与 Mock/HTTP fixture，覆盖 HMAC 重放、幂等、冻结/结算、交付 ACK、真实适配器请求格式和 `submission_uncertain` 的崩溃恢复保护。
