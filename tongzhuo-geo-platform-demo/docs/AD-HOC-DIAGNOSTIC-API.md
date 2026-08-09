# 受控单问题临时检测 API

此接口给客户自己的服务端调用，用于提交一个不依赖既有项目或冻结问题集的临时 AI 效果检测。它不是浏览器接口：前端页面不调用它，也不应持有其密钥。

服务端收到请求后会：

1. 校验独立的服务 API 密钥、显式外发授权和幂等键。
2. 创建隔离的本地临时项目与仅含一个问题的冻结问题集。
3. 先经 `DiagnosticRelayService.quote()` 向中转站报价，再经 `DiagnosticRelayService.createRun()` 创建任务；两次中转请求均由客户服务端使用实例 HMAC 签名。
4. 由现有交付拉取程序把中转站结果写入 `diagnostic_evidence`，且 `evidence_type=live` 后才 ACK。

该链路只请求中转站的 `/client/v1/*` 客户端接口，不会调用中央运营后台接口。

## 启用

默认关闭。为客户服务端生成独立的高熵随机值，并仅通过受保护的 Secret 文件挂载。私有化生产 Compose 部署时，登记宿主机源文件路径而不是容器内路径：

```dotenv
TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH=/opt/tongzhuo-geo/shared/relay-inputs/ad-hoc-diagnostic-api-token
```

该变量只写入受限的 `shared/cutover.env`。Compose 只把 root-only 源文件挂给 `geo-admin` 的 `/run/secrets/tz_ad_hoc_diagnostic_api_token`；启动阶段会复制到容器内 tmpfs 并将 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE` 指向该受限副本。`app.env` 不能包含 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN`。宿主机文件应为绝对路径、普通文件、`root:root`、`0600`，并禁止 group/other 访问。

生产环境不能用 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN` 直接注入；必须使用 `*_FILE`。此密钥与 `TZ_RELAY_CLIENT_SECRET_FILE` 必须不同，且都不能进入浏览器、前端构建产物、日志或工单。

轮换时先在 Secret Manager 中生成并挂载新值，再重启客户服务；旧值会立即失效。不要把此 API 密钥与中转实例 HMAC 密钥复用。

未配置时，接口返回 `503 AD_HOC_DIAGNOSTIC_SERVICE_API_DISABLED`。

## 请求

```text
POST /api/v1/diagnostics/relay/ad-hoc-runs
X-TZ-Ad-Hoc-Api-Key: <customer-server-only-secret>
Content-Type: application/json
```

示例：

```json
{
  "idempotencyKey": "crm-ticket-20260803-001-question-01",
  "question": "工业机器人企业应如何评估 GEO 优化服务？",
  "platforms": ["DB", "DS"],
  "terminals": ["web"],
  "modes": ["fast"],
  "brand": { "name": "示例品牌", "aliases": ["示例科技"] },
  "competitors": ["竞品 A"],
  "analysisScope": { "ticketId": "CRM-20260803-001" },
  "externalDataConsent": true,
  "externalDataConsentAt": "2026-08-03T09:30:00.000Z",
  "externalDataConsentMethod": "customer_authorization_record",
  "authorizationReference": "CONSENT-20260803-001",
  "authorizedBy": "customer-operator-123"
}
```

要求：

- `idempotencyKey` 必填，长度至少 8；相同键只能重试相同的问题、平台、终端、模式、品牌、竞品和分析范围。
- `question` 必填，最多 1000 个字符；请求不能提交项目、问题集或任意 `items` 来绕过单问题边界。
- `platforms` 至少一个；总的 `platforms × terminals × modes` 最多 24 个中转项。
- `externalDataConsent` 必须为布尔值 `true`。`authorizationReference` 与 `authorizedBy` 必填；授权时间未传时按客户服务端收到请求的时间记录。
- 授权参考、授权人、授权时间、问题 SHA-256 摘要和请求指纹会写入客户本地审计日志。问题正文不会被复制到该专用审计条目。

成功返回 `202`，其中包含 `quote`、临时 `project`、冻结 `questionSet`、本地 `run` 和中转 `link`。重复提交同一幂等键会返回既有运行，不重复创建项目、冻结问题集或中转任务；重试中的既有任务只会沿用保存的原始请求。

## 结果与查询

响应的 `link.diagnosticRunId` 可使用已有接口查询：

```text
GET /api/v1/diagnostics/relay-runs/:diagnosticRunId
POST /api/v1/diagnostics/relay-runs/:diagnosticRunId/pull
```

上述查询接口仍使用正常的客户后台用户权限。交付结果写入本地运行的 `diagnostic_evidence(live)`；若本地写入失败，服务端会 release 中转交付租约而不是 ACK。

常见错误码包括：`AD_HOC_DIAGNOSTIC_SERVICE_AUTH_REQUIRED`、`AD_HOC_DIAGNOSTIC_SERVICE_API_DISABLED`、`RELAY_CONSENT_REQUIRED`、`AD_HOC_DIAGNOSTIC_IDEMPOTENCY_CONFLICT`、`AD_HOC_DIAGNOSTIC_ITEM_LIMIT` 和中转站返回的额度/能力错误。

## 离线验收

在客户项目目录执行：

```powershell
node scripts/check-ad-hoc-diagnostic.mjs
```

该检查不访问真实爱搜或中央服务：它使用本地伪造的中转 HTTP 响应验证服务密钥拒绝逻辑、授权记录、隔离项目/冻结单题集、报价、HMAC 创建任务、交付 ACK 以及 `diagnostic_evidence(live)` 写入。
