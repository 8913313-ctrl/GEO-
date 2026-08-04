import crypto from "node:crypto";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_PULL_LIMIT = 50;

function text(value, name, maximum = 2_000, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new RelayClientError("RELAY_CLIENT_CONFIGURATION", `${name} 不能为空。`, { status: 503 });
  if (result.length > maximum) throw new RelayClientError("RELAY_CLIENT_CONFIGURATION", `${name} 超过 ${maximum} 个字符。`, { status: 503 });
  return result;
}

function digest(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8");
  return crypto.createHash("sha256").update(buffer).digest("base64url");
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RelayClientError("RELAY_CLIENT_INVALID_JSON", "JSON 数据不能包含非有限数字。", { status: 422 });
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonicalize(value[key])]));
  }
  throw new RelayClientError("RELAY_CLIENT_INVALID_JSON", "请求数据无法序列化为 JSON。", { status: 422 });
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value === undefined ? {} : value));
}

export function payloadHash(value) {
  return `sha256:${digest(stableJson(value))}`;
}

export function buildInstanceSignatureInput({ method, requestTarget, timestamp, nonce, rawBody = "" }) {
  const normalizedMethod = text(method, "HTTP 方法", 16, true).toUpperCase();
  const normalizedTarget = text(requestTarget, "请求路径", 4_096, true);
  const normalizedTimestamp = text(timestamp, "时间戳", 32, true);
  const normalizedNonce = text(nonce, "Nonce", 256, true);
  return `${normalizedMethod}\n${normalizedTarget}\n${normalizedTimestamp}\n${normalizedNonce}\n${digest(rawBody)}`;
}

export function signInstanceRequest({ secret, method, requestTarget, timestamp, nonce, rawBody = "" }) {
  const signingSecret = text(secret, "实例密钥", 4_096, true);
  const input = buildInstanceSignatureInput({ method, requestTarget, timestamp, nonce, rawBody });
  return crypto.createHmac("sha256", signingSecret).update(input, "utf8").digest("hex");
}

function parseJson(textValue) {
  if (!textValue) return {};
  try { return JSON.parse(textValue); } catch { return { rawText: String(textValue).slice(0, 20_000) }; }
}

function requestTarget(url) {
  return `${url.pathname}${url.search}`;
}

function responseMessage(payload, fallback) {
  return String(payload?.error?.message || payload?.message || fallback || "中转站请求失败。").slice(0, 2_000);
}

export class RelayClientError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "RelayClientError";
    this.code = code;
    this.status = Number(options.status || options.statusCode || 502);
    this.statusCode = this.status;
    this.details = options.details;
    this.retryable = Boolean(options.retryable);
  }
}

export class DiagnosticRelayClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "").trim().replace(/\/+$/, "");
    this.instanceId = text(options.instanceId, "TZ_RELAY_INSTANCE_ID", 256);
    this.clientId = text(options.clientId, "TZ_RELAY_CLIENT_ID", 256);
    this.clientSecret = text(options.clientSecret, "TZ_RELAY_CLIENT_SECRET", 4_096);
    this.deliveryConsumer = text(options.deliveryConsumer || `private-sync:${this.instanceId}`, "交付消费者", 256, true);
    this.timeoutMs = Math.max(1_000, Math.min(180_000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    if (!this.baseUrl) throw new RelayClientError("RELAY_CLIENT_CONFIGURATION", "TZ_RELAY_BASE_URL 不能为空。", { status: 503 });
    if (typeof this.fetchImpl !== "function") throw new RelayClientError("RELAY_CLIENT_CONFIGURATION", "当前 Node 运行时不支持 fetch。", { status: 503 });
  }

  async request(method, pathname, options = {}) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const url = new URL(pathname, `${this.baseUrl}/`);
    const rawBody = options.body === undefined ? "" : stableJson(options.body);
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = crypto.randomUUID();
    const signature = signInstanceRequest({
      secret: this.clientSecret,
      method: normalizedMethod,
      requestTarget: requestTarget(url),
      timestamp,
      nonce,
      rawBody
    });
    const headers = {
      accept: "application/json",
      "x-tz-client-id": this.clientId,
      authorization: `Instance ${this.clientId}`,
      "x-tz-timestamp": timestamp,
      "x-tz-nonce": nonce,
      "x-tz-signature": signature
    };
    if (rawBody) {
      headers["content-type"] = "application/json";
      headers["content-length"] = String(Buffer.byteLength(rawBody, "utf8"));
    }
    if (options.idempotencyKey) headers["idempotency-key"] = String(options.idempotencyKey);
    if (options.deliveryConsumer || this.deliveryConsumer) headers["x-tz-delivery-consumer"] = String(options.deliveryConsumer || this.deliveryConsumer);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await this.fetchImpl(url, {
        method: normalizedMethod,
        headers,
        body: rawBody || undefined,
        signal: controller.signal
      });
      const bodyText = await response.text();
      const payload = parseJson(bodyText);
      if (!response.ok) {
        throw new RelayClientError(
          payload?.error?.code || `RELAY_HTTP_${response.status}`,
          responseMessage(payload, `中转站返回 HTTP ${response.status}。`),
          {
            status: response.status,
            retryable: response.status >= 500 || response.status === 408 || response.status === 429,
            details: { response: payload, latencyMs: Date.now() - startedAt }
          }
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof RelayClientError) throw error;
      const aborted = error?.name === "AbortError";
      throw new RelayClientError(aborted ? "RELAY_CLIENT_TIMEOUT" : "RELAY_CLIENT_NETWORK", aborted ? "调用中转站超时。" : "调用中转站时网络异常。", {
        status: 502,
        retryable: true,
        cause: error,
        details: { latencyMs: Date.now() - startedAt }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  capabilities() { return this.request("GET", "/client/v1/capabilities"); }
  quota() { return this.request("GET", "/client/v1/quota"); }
  heartbeat() { return this.request("POST", "/client/v1/heartbeat", { body: {} }); }

  quoteEffectRun(body) {
    return this.request("POST", "/client/v1/effect-runs/quote", { body });
  }

  createEffectRun(body, idempotencyKey) {
    return this.request("POST", "/client/v1/effect-runs", { body, idempotencyKey });
  }

  listEffectRuns(limit = 50) {
    const query = new URLSearchParams({ limit: String(Math.max(1, Math.min(500, Number(limit) || DEFAULT_PULL_LIMIT))) });
    return this.request("GET", `/client/v1/effect-runs?${query}`);
  }

  getEffectRun(relayRunId, options = {}) {
    const query = new URLSearchParams();
    if (options.includeItems !== false) query.set("includeItems", "true");
    if (options.includeResults === true) query.set("includeResults", "true");
    return this.request("GET", `/client/v1/effect-runs/${encodeURIComponent(relayRunId)}${query.size ? `?${query}` : ""}`);
  }

  cancelEffectRun(relayRunId) {
    return this.request("POST", `/client/v1/effect-runs/${encodeURIComponent(relayRunId)}/cancel`, { body: {} });
  }

  pullDeliveries(limit = DEFAULT_PULL_LIMIT) {
    const query = new URLSearchParams({ limit: String(Math.max(1, Math.min(200, Number(limit) || DEFAULT_PULL_LIMIT))) });
    return this.request("GET", `/client/v1/deliveries?${query}`);
  }

  acknowledgeDelivery(deliveryId, hash) {
    return this.request("POST", `/client/v1/deliveries/${encodeURIComponent(deliveryId)}/ack`, { body: { payloadHash: hash } });
  }

  releaseDelivery(deliveryId, options = {}) {
    return this.request("POST", `/client/v1/deliveries/${encodeURIComponent(deliveryId)}/release`, {
      body: { delayMs: Math.max(0, Math.min(86_400_000, Number(options.delayMs) || 0)), error: options.error || "" }
    });
  }
}

export function createDiagnosticRelayClient(options = {}) {
  const values = options.config || options;
  const baseUrl = String(values.relayBaseUrl || values.baseUrl || "").trim();
  const instanceId = String(values.relayInstanceId || values.instanceId || "").trim();
  const clientId = String(values.relayClientId || values.clientId || "").trim();
  const clientSecret = String(values.relayClientSecret || values.clientSecret || "").trim();
  if (!baseUrl && !instanceId && !clientId && !clientSecret) return null;
  if (!baseUrl || !instanceId || !clientId || !clientSecret) {
    throw new RelayClientError("RELAY_CLIENT_CONFIGURATION", "中转站配置不完整，需要同时配置 URL、实例 ID、Client ID 和 Client Secret。", { status: 503 });
  }
  return new DiagnosticRelayClient({
    baseUrl,
    instanceId,
    clientId,
    clientSecret,
    deliveryConsumer: values.relayDeliveryConsumer || values.deliveryConsumer,
    timeoutMs: values.relayTimeoutMs || values.timeoutMs,
    fetchImpl: options.fetchImpl
  });
}

