import crypto from "node:crypto";
import { AidsoClient, AidsoClientError, MockAidsoClient } from "./aidso-client.mjs";

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
}

function providerRow(store, providerAccountId = "") {
  const requested = String(providerAccountId || "").trim();
  if (requested) return store.db.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(requested) || null;
  return store.db.prepare(`
    SELECT * FROM relay_provider_accounts
    WHERE provider_code = 'aidso' AND status IN ('active', 'degraded')
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  `).get() || null;
}

/**
 * Resolve the encrypted provider token immediately before each operation.
 * This keeps the long-lived Worker in sync with administrator token rotation
 * without requiring a process restart or exposing the token to HTTP clients.
 */
export class ManagedAidsoClient {
  constructor(options = {}) {
    if (!options.store) throw new TypeError("ManagedAidsoClient requires a RelayStore instance.");
    this.store = options.store;
    this.providerAccountId = String(options.providerAccountId || "").trim();
    this.mode = String(options.mode || "real").trim().toLowerCase();
    this.baseUrl = String(options.baseUrl || process.env.AIDSO_BASE_URL || "").trim();
    this.timeoutMs = positiveInteger(options.timeoutMs || process.env.AIDSO_TIMEOUT_MS, 45_000, 180_000);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.mockPollsBeforeCompletion = positiveInteger(options.mockPollsBeforeCompletion, 1, 100);
    this.cached = null;
    this.cachedKey = "";
  }

  _resolve() {
    const row = providerRow(this.store, this.providerAccountId);
    const providerAccountId = row?.id || this.providerAccountId || "provider_aidso_central";
    let token = "";
    if (row?.token_envelope_json) token = this.store.getProviderToken(providerAccountId);
    const mode = this.mode === "mock" ? "mock" : "real";
    const tokenHash = token ? crypto.createHash("sha256").update(token, "utf8").digest("hex") : "none";
    const baseUrl = this.baseUrl || String(process.env.AIDSO_BASE_URL || "https://openapi.aidso.com/geo_api").trim();
    const cacheKey = `${mode}:${providerAccountId}:${tokenHash}:${baseUrl}:${this.timeoutMs}`;
    if (cacheKey === this.cachedKey && this.cached) return { ...this.cached, row };

    let client;
    if (mode === "mock") {
      client = new MockAidsoClient({ pollsBeforeCompletion: this.mockPollsBeforeCompletion });
    } else if (!token) {
      client = {
        async submit() {
          throw new AidsoClientError("AIDSO_CONFIGURATION", "尚未配置统一爱搜 Token，请在管理员后台保存后重试。", { retryable: false });
        },
        async poll() {
          throw new AidsoClientError("AIDSO_CONFIGURATION", "尚未配置统一爱搜 Token，请在管理员后台保存后重试。", { retryable: false });
        },
        async probe() {
          return {
            status: "unconfigured",
            mode: "real",
            providerStatus: "TOKEN_MISSING",
            latencyMs: 0,
            message: "尚未配置统一爱搜 Token。"
          };
        }
      };
    } else {
      client = new AidsoClient({
        token,
        baseUrl,
        timeoutMs: this.timeoutMs,
        fetchImpl: this.fetchImpl
      });
    }
    this.cachedKey = cacheKey;
    this.cached = { client, providerAccountId };
    return { ...this.cached, row };
  }

  getProviderState() {
    const resolved = this._resolve();
    const row = resolved.row;
    return {
      providerAccountId: resolved.providerAccountId,
      mode: this.mode === "mock" ? "mock" : "real",
      status: row?.status || "unconfigured",
      tokenConfigured: Boolean(row?.token_envelope_json),
      maxInFlight: Number(row?.max_in_flight || 0) || null
    };
  }

  async submit(item) {
    return this._resolve().client.submit(item);
  }

  async poll(reqId, context = {}) {
    return this._resolve().client.poll(reqId, context);
  }

  async probe(options = {}) {
    return this._resolve().client.probe(options);
  }
}

export function createManagedAidsoClient(options = {}) {
  return new ManagedAidsoClient(options);
}

