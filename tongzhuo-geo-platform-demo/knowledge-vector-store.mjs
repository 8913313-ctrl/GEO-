export class VectorStoreError extends Error {
  constructor(message, code = "VECTOR_STORE_ERROR", details = undefined) {
    super(message);
    this.name = "VectorStoreError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function endpoint(base, suffix) {
  const value = String(base || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  return `${value}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

async function readJson(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { throw new VectorStoreError("Vector store returned invalid JSON.", "VECTOR_STORE_INVALID_RESPONSE"); }
  if (!response.ok) throw new VectorStoreError(body.message || body.error || `Vector store HTTP ${response.status}.`, "VECTOR_STORE_HTTP_ERROR", { status: response.status });
  return body;
}

export class RemoteVectorStore {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || process.env.TZ_VECTOR_STORE_URL || "").trim().replace(/\/+$/, "");
    this.apiKey = String(options.apiKey || process.env.TZ_VECTOR_STORE_API_KEY || "").trim();
    this.timeoutMs = Math.max(1_000, Math.min(120_000, Number(options.timeoutMs || process.env.TZ_VECTOR_STORE_TIMEOUT_MS) || 30_000));
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.collection = String(options.collection || process.env.TZ_VECTOR_STORE_COLLECTION || "knowledge_chunks").trim() || "knowledge_chunks";
  }

  get configured() { return Boolean(this.baseUrl); }

  async request(path, body) {
    if (!this.configured) return null;
    if (typeof this.fetchImpl !== "function") throw new VectorStoreError("当前 Node.js 不支持 fetch。", "VECTOR_STORE_FETCH_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      return await readJson(await this.fetchImpl(endpoint(this.baseUrl, path), { method: "POST", headers, body: JSON.stringify(body || {}), signal: controller.signal }));
    } catch (error) {
      if (error instanceof VectorStoreError) throw error;
      if (error?.name === "AbortError") throw new VectorStoreError("Vector store request timed out.", "VECTOR_STORE_TIMEOUT");
      throw new VectorStoreError(error?.message || "Vector store connection failed.", "VECTOR_STORE_CONNECTION_ERROR");
    } finally { clearTimeout(timer); }
  }

  async upsert({ namespace = "default", items = [] } = {}) {
    if (!this.configured || !items.length) return { configured: this.configured, count: 0 };
    const body = await this.request("/upsert", { collection: this.collection, namespace, items });
    return { configured: true, count: Number(body?.count ?? items.length), backend: body?.backend || "remote" };
  }

  async query({ namespace = "default", vector, topK = 8, filter = {} } = {}) {
    if (!this.configured) return { configured: false, matches: [] };
    const body = await this.request("/query", { collection: this.collection, namespace, vector, topK, filter });
    const matches = Array.isArray(body?.matches) ? body.matches : Array.isArray(body?.results) ? body.results : [];
    return { configured: true, matches };
  }

  async delete({ namespace = "default", ids = [] } = {}) {
    if (!this.configured || !ids.length) return { configured: this.configured, count: 0 };
    const body = await this.request("/delete", { collection: this.collection, namespace, ids });
    return { configured: true, count: Number(body?.count ?? ids.length) };
  }
}

export function createVectorStore(options = {}) {
  return new RemoteVectorStore(options);
}
