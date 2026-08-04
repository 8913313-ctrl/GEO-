import crypto from "node:crypto";

const DEFAULT_BASE_URL = "https://openapi.aidso.com/geo_api";
const DEFAULT_TIMEOUT_MS = 45_000;
const PENDING_STATUSES = new Set(["ING", "PENDING", "PROCESSING", "QUEUED", "RUNNING", "WAITING"]);
const SUCCESS_STATUSES = new Set(["DONE", "COMPLETED", "SUCCESS", "SUCCEEDED", "FINISHED", "OK"]);

export class AidsoClientError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AidsoClientError";
    this.code = code;
    this.statusCode = options.statusCode || null;
    this.retryable = Boolean(options.retryable);
    this.submissionUncertain = Boolean(options.submissionUncertain);
    this.providerStatus = options.providerStatus || "";
    this.details = options.details;
  }
}

function cleanText(value, name, maximum = 8_000) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum) throw new AidsoClientError("AIDSO_VALIDATION", `${name} 无效。`, { retryable: false });
  return text;
}

function optionalText(value, maximum = 20_000) {
  const text = String(value ?? "").trim();
  return text.length > maximum ? text.slice(0, maximum) : text;
}

function safeParseJson(text) {
  try {
    return { value: JSON.parse(text), parsed: true };
  } catch {
    return { value: null, parsed: false };
  }
}

function redactSensitive(value, depth = 0) {
  if (depth > 30) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = /(authorization|token|secret|password|cookie|api[_-]?key)/i.test(key)
      ? "[REDACTED]"
      : redactSensitive(entry, depth + 1);
  }
  return output;
}

function stableJson(value) {
  return JSON.stringify(value ?? {});
}

function hashJson(value) {
  return `sha256:${crypto.createHash("sha256").update(stableJson(value), "utf8").digest("base64url")}`;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function unwrapPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw || {};
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) return raw.data;
  if (raw.result && typeof raw.result === "object" && !Array.isArray(raw.result) && raw.result.data && typeof raw.result.data === "object") return raw.result.data;
  return raw;
}

function statusFrom(raw) {
  const payload = unwrapPayload(raw);
  const status = firstDefined(
    payload?.status,
    payload?.state,
    payload?.task_status,
    raw?.status,
    raw?.state,
    raw?.task_status
  );
  return String(status ?? "").trim().toUpperCase();
}

function findReqId(raw) {
  const payload = unwrapPayload(raw);
  const candidate = firstDefined(
    payload?.reqId,
    payload?.req_id,
    payload?.requestId,
    payload?.request_id,
    payload?.taskId,
    payload?.task_id,
    raw?.reqId,
    raw?.req_id,
    raw?.requestId,
    raw?.request_id,
    raw?.taskId,
    raw?.task_id
  );
  return candidate === undefined || candidate === null ? "" : String(candidate).trim();
}

function hasProviderError(raw) {
  const payload = unwrapPayload(raw);
  if (payload?.success === false || raw?.success === false) return true;
  if (payload?.error || raw?.error) return true;
  const code = firstDefined(payload?.code, raw?.code);
  if (typeof code === "number" && code >= 400) return true;
  if (typeof code === "string" && /^(ERR|ERROR|FAIL|FAILED|[45]\d\d)/i.test(code)) return true;
  return false;
}

function providerMessage(raw) {
  const payload = unwrapPayload(raw);
  const error = payload?.error || raw?.error;
  return optionalText(firstDefined(
    typeof error === "string" ? error : error?.message,
    payload?.message,
    raw?.message,
    payload?.msg,
    raw?.msg,
    "爱搜返回了失败状态。"
  ), 1_000);
}

function toIsoTime(value, fallback = new Date().toISOString()) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed.toISOString();
}

function extractUsage(raw) {
  const payload = unwrapPayload(raw);
  const usage = payload?.usage || raw?.usage || {};
  const candidate = firstDefined(
    usage?.credits,
    usage?.credit,
    usage?.points,
    payload?.credits,
    payload?.credit,
    raw?.credits,
    raw?.credit
  );
  const number = Number(candidate);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function extractResultNodes(raw) {
  const payload = unwrapPayload(raw);
  const candidate = firstDefined(payload?.result, payload?.results, payload?.data?.result, raw?.result, raw?.results);
  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === "object") return [candidate];
  return [payload];
}

function firstStringByKeys(value, keys, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstStringByKeys(entry, keys, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const entry of Object.values(value)) {
    const found = firstStringByKeys(entry, keys, depth + 1);
    if (found) return found;
  }
  return "";
}

function collectQuoteCandidates(value, output = [], depth = 0) {
  if (depth > 9 || value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    for (const entry of value) collectQuoteCandidates(entry, output, depth + 1);
    return output;
  }
  if (typeof value !== "object") return output;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(quote|quotes|citation|citations|references|sources)$/i.test(key)) output.push(entry);
    else collectQuoteCandidates(entry, output, depth + 1);
  }
  return output;
}

function flattenQuoteValue(value, values = [], errors = []) {
  if (value === null || value === undefined || value === "") return { values, errors };
  if (typeof value === "string") {
    const parsed = safeParseJson(value);
    if (!parsed.parsed) {
      errors.push({ raw: value.slice(0, 4_000), reason: "invalid_json" });
      return { values, errors };
    }
    return flattenQuoteValue(parsed.value, values, errors);
  }
  if (Array.isArray(value)) {
    for (const entry of value) flattenQuoteValue(entry, values, errors);
    return { values, errors };
  }
  if (typeof value === "object") {
    if (Array.isArray(value.list)) return flattenQuoteValue(value.list, values, errors);
    if (Array.isArray(value.items)) return flattenQuoteValue(value.items, values, errors);
    if (Array.isArray(value.data)) return flattenQuoteValue(value.data, values, errors);
    values.push(value);
  }
  return { values, errors };
}

function normalizeQuote(value, index) {
  const url = optionalText(firstDefined(value?.url, value?.link, value?.source_url, value?.sourceUrl, value?.href), 4_000);
  const title = optionalText(firstDefined(value?.title, value?.name, value?.source_title, value?.sourceTitle), 1_000);
  const summary = optionalText(firstDefined(value?.summary, value?.snippet, value?.description, value?.content, value?.abstract), 8_000);
  const siteName = optionalText(firstDefined(value?.site_name, value?.siteName, value?.site, value?.domain_name, value?.domain), 1_000);
  const publishedAt = optionalText(firstDefined(value?.publish_time, value?.published_at, value?.publishedAt, value?.date), 240);
  const platformTaskId = optionalText(firstDefined(value?.task_id, value?.taskId, value?.platform_task_id, value?.platformTaskId), 512);
  let domain = "";
  try {
    domain = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    domain = "";
  }
  return { index, url, title, summary, siteName, domain, publishedAt, platformTaskId };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandMatch(answerText, brand = {}) {
  const aliases = [brand?.name, ...(Array.isArray(brand?.aliases) ? brand.aliases : [])]
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  const terms = [...new Set(aliases.map((entry) => entry.toLocaleLowerCase()))];
  let count = 0;
  for (const term of terms) {
    try {
      count += [...answerText.toLocaleLowerCase().matchAll(new RegExp(escapeRegex(term), "g"))].length;
    } catch {
      // A malformed alias must never make result normalization fail.
    }
  }
  return { aliases, mentioned: count > 0, count };
}

export function normalizeAidsoResult(raw, context = {}) {
  const safeRaw = redactSensitive(raw || {});
  const payload = unwrapPayload(safeRaw);
  const nodes = extractResultNodes(safeRaw);
  const answerText = firstStringByKeys(nodes, ["answer", "answer_text", "answerText", "content", "response", "text", "output"]);
  const contextText = firstStringByKeys(nodes, ["context"]);
  const thinkText = firstStringByKeys(nodes, ["think", "thinking"]);
  const suggestions = firstStringByKeys(nodes, ["suggestions", "suggestion"]);
  const candidates = collectQuoteCandidates(safeRaw);
  const flattened = candidates.reduce((state, candidate) => flattenQuoteValue(candidate, state.values, state.errors), { values: [], errors: [] });
  const seen = new Set();
  const quotes = flattened.values
    .map((value, index) => normalizeQuote(value, index + 1))
    .filter((quote) => {
      const key = quote.url || `${quote.title}:${quote.siteName}:${quote.index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(quote.url || quote.title || quote.siteName || quote.summary);
    });
  const mention = brandMatch(answerText, context.brand || {});
  const reqId = String(context.reqId || findReqId(safeRaw) || "").trim();
  const observedAt = toIsoTime(firstDefined(payload?.fetch_time, payload?.fetchTime, safeRaw?.fetch_time, safeRaw?.fetchTime));
  const qualityStatus = answerText && reqId ? "verified" : answerText ? "supplied" : "not_available";
  return {
    answerText,
    context: contextText,
    think: thinkText,
    suggestions,
    brandMentioned: mention.mentioned,
    brandMentionCount: mention.count,
    brandAliases: mention.aliases,
    quotes,
    quoteCount: quotes.length,
    uniqueDomainCount: new Set(quotes.map((quote) => quote.domain).filter(Boolean)).size,
    quoteParseErrors: flattened.errors,
    qualityStatus,
    observedAt,
    upstreamReqId: reqId || null,
    providerStatus: statusFrom(safeRaw) || "DONE",
    normalizerVersion: "aidso-normalizer-v1"
  };
}

function taskPayload(item) {
  const prompt = cleanText(item?.request?.prompt || item?.prompt, "检测问题");
  const platform = cleanText(item?.platform || item?.request?.platform, "平台", 120);
  const rawThinking = item?.thinkingEnabled ?? item?.request?.thinkingEnabled;
  const mode = String(item?.mode || item?.request?.mode || "fast").trim().toLowerCase();
  const thinkingEnabled = rawThinking === undefined ? ["deep", "thinking", "expert"].includes(mode) : Boolean(rawThinking);
  return { prompt, name: platform, thinking_enabled: thinkingEnabled ? 1 : 0 };
}

function endpoint(baseUrl, route, query = undefined) {
  const normalizedBase = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(`${normalizedBase}/${String(route).replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

export class AidsoClient {
  constructor(options = {}) {
    this.token = cleanText(options.token ?? process.env.AIDSO_TOKEN, "AIDSO_TOKEN", 8_000);
    this.baseUrl = String(options.baseUrl || process.env.AIDSO_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof this.fetchImpl !== "function") throw new AidsoClientError("AIDSO_CONFIGURATION", "当前 Node 运行时不支持 fetch。", { retryable: false });
    this.timeoutMs = Number.isInteger(Number(options.timeoutMs)) ? Math.max(1_000, Math.min(180_000, Number(options.timeoutMs))) : DEFAULT_TIMEOUT_MS;
  }

  async _request(method, route, options = {}) {
    const isWrite = method.toUpperCase() !== "GET";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = endpoint(this.baseUrl, route, options.query);
    const startedAt = Date.now();
    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          "aidso-token": this.token,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });
      const text = await response.text();
      const parsed = text ? safeParseJson(text) : { value: {}, parsed: true };
      const raw = parsed.parsed ? redactSensitive(parsed.value) : { rawText: text.slice(0, 20_000) };
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429;
        throw new AidsoClientError(
          `AIDSO_HTTP_${response.status}`,
          providerMessage(raw),
          {
            statusCode: response.status,
            retryable,
            // A 5xx may happen after AIDSO accepted a task_commit. Do not re-submit it automatically.
            submissionUncertain: isWrite && response.status >= 500,
            details: { latencyMs, responseHash: hashJson(raw) }
          }
        );
      }
      if (!parsed.parsed) {
        throw new AidsoClientError("AIDSO_INVALID_JSON", "爱搜返回的不是有效 JSON。", {
          retryable: !isWrite,
          submissionUncertain: isWrite,
          details: { latencyMs }
        });
      }
      return { raw, latencyMs };
    } catch (error) {
      if (error instanceof AidsoClientError) throw error;
      const aborted = error?.name === "AbortError";
      throw new AidsoClientError(aborted ? "AIDSO_TIMEOUT" : "AIDSO_NETWORK", aborted ? "调用爱搜超时。" : "调用爱搜时网络异常。", {
        retryable: !isWrite,
        submissionUncertain: isWrite,
        cause: error,
        details: { latencyMs: Date.now() - startedAt }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async submit(item) {
    const response = await this._request("POST", "task_commit", { body: taskPayload(item) });
    if (hasProviderError(response.raw)) {
      throw new AidsoClientError("AIDSO_SUBMIT_REJECTED", providerMessage(response.raw), { retryable: false, providerStatus: statusFrom(response.raw), details: { latencyMs: response.latencyMs } });
    }
    const reqId = findReqId(response.raw);
    if (!reqId) {
      throw new AidsoClientError("AIDSO_SUBMIT_INVALID_RESPONSE", "爱搜提交响应缺少 reqId。", {
        // The request was accepted at HTTP level; without reqId it is ambiguous.
        retryable: false,
        submissionUncertain: true,
        providerStatus: statusFrom(response.raw),
        details: { latencyMs: response.latencyMs, responseHash: hashJson(response.raw) }
      });
    }
    return { reqId, raw: response.raw, providerStatus: statusFrom(response.raw) || "ACCEPTED", latencyMs: response.latencyMs };
  }

  async poll(reqId, context = {}) {
    const id = cleanText(reqId, "爱搜 reqId", 512);
    const response = await this._request("GET", "get_result", { query: { reqId: id } });
    const providerStatus = statusFrom(response.raw);
    if (hasProviderError(response.raw)) {
      throw new AidsoClientError("AIDSO_POLL_FAILED", providerMessage(response.raw), {
        retryable: false,
        providerStatus,
        details: { latencyMs: response.latencyMs, responseHash: hashJson(response.raw) }
      });
    }
    if (PENDING_STATUSES.has(providerStatus)) return { state: "pending", raw: response.raw, providerStatus: providerStatus || "ING", latencyMs: response.latencyMs };
    const normalized = normalizeAidsoResult(response.raw, { ...context, reqId: id });
    const payload = unwrapPayload(response.raw);
    const hasResultShape = Object.prototype.hasOwnProperty.call(payload || {}, "result")
      || Object.prototype.hasOwnProperty.call(payload || {}, "results");
    if (SUCCESS_STATUSES.has(providerStatus) || normalized.answerText || normalized.quoteCount > 0 || hasResultShape) {
      return { state: "completed", raw: response.raw, normalized, upstreamCredits: extractUsage(response.raw), providerStatus: providerStatus || "DONE", latencyMs: response.latencyMs };
    }
    throw new AidsoClientError("AIDSO_UNKNOWN_STATUS", "无法识别爱搜任务状态。", {
      retryable: true,
      providerStatus,
      details: { latencyMs: response.latencyMs, responseHash: hashJson(response.raw) }
    });
  }

  /**
   * Run a non-billable upstream connectivity/authentication probe.
   *
   * AIDSO does not expose a stable health endpoint in every account tier.  A
   * GET for an intentionally impossible request id exercises DNS/TLS,
   * routing, and authentication without creating a billable task.  A 4xx
   * response from that lookup is therefore still useful evidence that the
   * endpoint is reachable; 401/403 remain authentication failures.
   */
  async probe(options = {}) {
    const probeReqId = cleanText(
      options.reqId || `__tongzhuo_relay_probe_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      "AIDSO 探针 reqId",
      512
    );
    try {
      const response = await this._request("GET", options.route || "get_result", {
        query: { reqId: probeReqId }
      });
      const providerStatus = statusFrom(response.raw);
      if (hasProviderError(response.raw)) {
        return {
          status: "degraded",
          mode: "real",
          providerStatus,
          latencyMs: response.latencyMs,
          message: providerMessage(response.raw)
        };
      }
      return {
        status: "healthy",
        mode: "real",
        providerStatus: providerStatus || "REACHABLE",
        latencyMs: response.latencyMs,
        message: "AIDSO OpenAPI 可访问，凭证已通过请求验证。"
      };
    } catch (error) {
      if (!(error instanceof AidsoClientError)) throw error;
      const code = String(error.code || "");
      const authFailure = code === "AIDSO_HTTP_401" || code === "AIDSO_HTTP_403";
      const endpointReachable = /^AIDSO_HTTP_(400|404|405|422)$/.test(code);
      return {
        status: authFailure ? "unauthorized" : endpointReachable ? "healthy" : "unavailable",
        mode: "real",
        providerStatus: error.providerStatus || code,
        latencyMs: error.details?.latencyMs || null,
        message: authFailure
          ? "AIDSO 凭证无效或已过期。"
          : endpointReachable
            ? "AIDSO OpenAPI 可访问；探针请求被上游按预期拒绝。"
            : error.message,
        errorCode: code
      };
    }
  }
}

function defaultMockRaw(item, sequence, context = {}) {
  const prompt = item?.request?.prompt || item?.prompt || "测试问题";
  const platform = item?.platform || item?.request?.platform || "DB";
  return {
    status: "DONE",
    reqId: context.reqId || `mock_req_${sequence}`,
    fetch_time: new Date().toISOString(),
    result: [{
      answer: `Mock AIDSO result for ${prompt}`,
      quote: JSON.stringify([{ url: "https://example.test/source", title: `${platform} 示例引用`, summary: "本地中转站验证用引用。", site_name: "Example" }])
    }],
    usage: { credits: 1 }
  };
}

export class MockAidsoClient {
  constructor(options = {}) {
    this.pollsBeforeCompletion = Number.isInteger(Number(options.pollsBeforeCompletion)) ? Math.max(0, Number(options.pollsBeforeCompletion)) : 1;
    this.responder = typeof options.responder === "function" ? options.responder : defaultMockRaw;
    this.records = new Map();
    this.sequence = 0;
    // The mock provider lives across worker restarts while the in-memory
    // sequence does not. Keep every generated reqId globally unique so a
    // restarted local worker cannot collide with relay_items.upstream_req_id.
    this.instanceToken = String(options.instanceToken || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || crypto.randomUUID().replace(/-/g, "");
  }

  async submit(item) {
    const reqId = `mock_req_${this.instanceToken}_${++this.sequence}`;
    const raw = { status: "ACCEPTED", reqId };
    this.records.set(reqId, { item, pollsRemaining: this.pollsBeforeCompletion, sequence: this.sequence });
    return { reqId, raw, providerStatus: "ACCEPTED", latencyMs: 0 };
  }

  async poll(reqId, context = {}) {
    const record = this.records.get(String(reqId));
    if (!record) throw new AidsoClientError("AIDSO_NOT_FOUND", "Mock reqId 不存在。", { retryable: false });
    if (record.pollsRemaining > 0) {
      record.pollsRemaining -= 1;
      return { state: "pending", raw: { status: "ING", reqId }, providerStatus: "ING", latencyMs: 0 };
    }
    const raw = redactSensitive(await this.responder(record.item, record.sequence, { ...context, reqId: String(reqId) }));
    if (!raw.reqId) raw.reqId = String(reqId);
    const normalized = normalizeAidsoResult(raw, { ...context, reqId: String(reqId) });
    return { state: "completed", raw, normalized, upstreamCredits: extractUsage(raw), providerStatus: statusFrom(raw) || "DONE", latencyMs: 0 };
  }

  async probe() {
    return {
      status: "mock",
      mode: "mock",
      providerStatus: "MOCK",
      latencyMs: 0,
      message: "本地模拟爱搜适配器可用；生产环境请配置真实 AIDSO Token。"
    };
  }
}

export function createAidsoClientFromEnvironment(options = {}) {
  const mode = String(options.mode || process.env.TZ_RELAY_AIDSO_MODE || "real").trim().toLowerCase();
  if (mode === "mock") return new MockAidsoClient(options);
  return new AidsoClient(options);
}

export { DEFAULT_BASE_URL };
