import crypto from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const ENCRYPTED_SECRET_PREFIX = "enc:v1:";

class AiProviderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function safeId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(id) ? id : "";
}

function maskedKey(apiKey) {
  const value = String(apiKey || "");
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}••••${value.slice(-2)}`;
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

function normalizeStatus(value, fallback = "enabled") {
  const status = String(value || "").trim().toLowerCase();
  return ["enabled", "disabled"].includes(status) ? status : fallback;
}

function normalizeProtocol(value, fallback = "openai_compatible") {
  const protocol = String(value || "").trim().toLowerCase();
  return ["openai_compatible", "deepseek", "qwen", "kimi", "zhipu", "custom"].includes(protocol) ? protocol : fallback;
}

function inferProtocol(value, baseUrl) {
  const protocol = normalizeProtocol(value);
  if (protocol === "openai_compatible") {
    try {
      const hostname = new URL(baseUrl).hostname.toLowerCase();
      if (hostname === "api.deepseek.com" || hostname.endsWith(".api.deepseek.com")) return "deepseek";
    } catch {
      // URL validation happens separately; keep the user-selected protocol here.
    }
  }
  return protocol;
}

function normalizeKind(value, fallback = "text") {
  const kind = String(value || "").trim().toLowerCase();
  return ["text", "image", "embedding"].includes(kind) ? kind : fallback;
}

function normalizeUrl(value, field = "baseUrl") {
  const raw = String(value || "").trim();
  if (!raw) throw new AiProviderError(`${field} 不能为空。`);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AiProviderError(`${field} 必须是有效的 HTTP(S) 地址。`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new AiProviderError(`${field} 只允许使用 HTTP(S) 地址。`);
  return parsed.toString().replace(/\/$/, "");
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) throw new AiProviderError("供应商名称不能为空。");
  if (name.length > 80) throw new AiProviderError("供应商名称不能超过 80 个字符。");
  return name;
}

function normalizeModel(value) {
  const model = String(value || "").trim();
  if (!model) throw new AiProviderError("默认模型不能为空。");
  if (model.length > 120) throw new AiProviderError("默认模型不能超过 120 个字符。");
  return model;
}

function publicProvider(provider) {
  if (!provider) return null;
  const { apiKey: _apiKey, apiKeyEncrypted: _apiKeyEncrypted, ...safe } = provider;
  return {
    ...safe,
    hasApiKey: Boolean(provider.apiKey),
    apiKeyMasked: maskedKey(provider.apiKey)
  };
}

function readApiKey(payload) {
  if (!Object.prototype.hasOwnProperty.call(payload || {}, "apiKey")) return undefined;
  const value = payload.apiKey;
  if (value === null || value === "") return "";
  const apiKey = String(value || "").trim();
  if (apiKey.length < 4) throw new AiProviderError("API Key 长度过短，请检查后重试。");
  if (apiKey.length > 512) throw new AiProviderError("API Key 不能超过 512 个字符。");
  return apiKey;
}

function defaultState() {
  return { schemaVersion: 1, providers: [] };
}

export class AiProviderStore {
  constructor(options = {}) {
    const dataDir = options.dataDir || process.env.TZ_AI_PROVIDER_DATA_DIR || path.join(moduleRoot, "data");
    this.dataDir = path.resolve(dataDir);
    this.statePath = path.join(this.dataDir, options.fileName || "ai-providers.json");
    this.keyPath = path.join(this.dataDir, options.keyFileName || ".encryption-key");
    this.encryptionKeyMaterial = String(options.encryptionKey || process.env.TZ_SECRETS_KEY || "").trim();
    this.cipherKey = null;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async ensureCipherKey() {
    if (this.cipherKey) return this.cipherKey;
    let material = this.encryptionKeyMaterial;
    if (!material) {
      try {
        material = (await readFile(this.keyPath, "utf8")).trim();
      } catch (error) {
        if (error?.code !== "ENOENT") throw new AiProviderError("AI 密钥加密主密钥无法读取。", 500);
      }
    }
    if (!material) {
      material = crypto.randomBytes(32).toString("base64url");
      await mkdir(this.dataDir, { recursive: true });
      const temporaryPath = `${this.keyPath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporaryPath, material, { encoding: "utf8", mode: 0o600 });
      try {
        await chmod(temporaryPath, 0o600);
      } catch {
        // Windows may not support POSIX mode bits; the key file remains ignored and server-local.
      }
      await rename(temporaryPath, this.keyPath);
    }
    if (material.length < 16) throw new AiProviderError("AI 密钥加密主密钥长度不足。", 500);
    this.cipherKey = crypto.createHash("sha256").update(material, "utf8").digest();
    return this.cipherKey;
  }

  encryptSecret(value) {
    const secret = String(value || "");
    if (!secret) return "";
    if (!this.cipherKey) throw new AiProviderError("AI 密钥加密主密钥尚未初始化。", 500);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENCRYPTED_SECRET_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
  }

  decryptSecret(value) {
    const encrypted = String(value || "");
    if (!encrypted) return "";
    if (!encrypted.startsWith(ENCRYPTED_SECRET_PREFIX)) return encrypted;
    if (!this.cipherKey) throw new AiProviderError("AI 密钥加密主密钥尚未初始化。", 500);
    const parts = encrypted.split(":");
    if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") throw new AiProviderError("AI 供应商密钥格式无效。", 500);
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.cipherKey, Buffer.from(parts[2], "base64url"));
      decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(parts[4], "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new AiProviderError("AI 供应商密钥无法解密，请检查服务端加密主密钥。", 500);
    }
  }

  async load() {
    if (this.state) return this.state;
    await this.ensureCipherKey();
    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw);
      const providers = Array.isArray(parsed?.providers) ? parsed.providers : [];
      this.state = { schemaVersion: 1, providers: providers.map((provider) => this.normalizeStored(provider)).filter(Boolean) };
      if (providers.some((provider) => provider?.apiKey && !provider?.apiKeyEncrypted)) await this.persist();
    } catch (error) {
      if (error?.code !== "ENOENT") throw new AiProviderError("AI 供应商配置文件无法读取。", 500);
      this.state = defaultState();
    }
    return this.state;
  }

  normalizeStored(provider) {
    const id = safeId(provider?.id);
    if (!id) return null;
    const name = String(provider.name || id).trim().slice(0, 80);
    const baseUrl = String(provider.baseUrl || "").trim();
    const model = String(provider.model || "").trim();
    return {
      id,
      name: name || id,
      baseUrl,
      model: model || "default",
      protocol: inferProtocol(provider.protocol, baseUrl),
      kind: normalizeKind(provider.kind),
      apiKey: this.decryptSecret(provider.apiKeyEncrypted || provider.apiKey || ""),
      models: Array.isArray(provider.models) ? provider.models.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 50) : [],
      status: normalizeStatus(provider.status),
      connectionStatus: ["passed", "failed", "untested"].includes(provider.connectionStatus) ? provider.connectionStatus : "untested",
      lastTestAt: provider.lastTestAt || null,
      lastTestMessage: String(provider.lastTestMessage || "").slice(0, 200),
      createdAt: provider.createdAt || nowIso(),
      updatedAt: provider.updatedAt || provider.createdAt || nowIso()
    };
  }

  async persist() {
    await this.ensureCipherKey();
    const payload = JSON.stringify({
      ...this.state,
      providers: (this.state?.providers || []).map((provider) => {
        const { apiKey, apiKeyEncrypted: _apiKeyEncrypted, ...persisted } = provider;
        return { ...persisted, ...(apiKey ? { apiKeyEncrypted: this.encryptSecret(apiKey) } : {}) };
      })
    }, null, 2);
    await mkdir(this.dataDir, { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
    try {
      await chmod(temporaryPath, 0o600);
    } catch {
      // Windows may not support POSIX mode bits; the data file remains server-only.
    }
    await rename(temporaryPath, this.statePath);
  }

  async write(mutator) {
    await this.load();
    let result;
    this.writeQueue = this.writeQueue.then(async () => {
      result = await mutator(this.state);
      await this.persist();
    });
    await this.writeQueue;
    return result;
  }

  list() {
    return (this.state?.providers || []).map(publicProvider);
  }

  find(id) {
    return (this.state?.providers || []).find((provider) => provider.id === id) || null;
  }

  async create(payload = {}) {
    await this.load();
    const id = safeId(payload.id) || `provider-${Date.now().toString(36)}`;
    if (this.find(id)) throw new AiProviderError("供应商 ID 已存在。", 409);
    const name = normalizeName(payload.name);
    const baseUrl = normalizeUrl(payload.baseUrl);
    const model = normalizeModel(payload.model);
    const apiKey = readApiKey(payload) || "";
    const createdAt = nowIso();
    const provider = { id, name, baseUrl, model, protocol: inferProtocol(payload.protocol, baseUrl), kind: normalizeKind(payload.kind), apiKey, models: [], status: normalizeStatus(payload.status), connectionStatus: "untested", lastTestAt: null, lastTestMessage: "", createdAt, updatedAt: createdAt };
    await this.write((state) => state.providers.push(provider));
    return publicProvider(provider);
  }

  async update(id, payload = {}) {
    await this.load();
    const provider = this.find(id);
    if (!provider) throw new AiProviderError("AI 供应商不存在。", 404);
    if (Object.prototype.hasOwnProperty.call(payload, "name")) provider.name = normalizeName(payload.name);
    if (Object.prototype.hasOwnProperty.call(payload, "baseUrl")) provider.baseUrl = normalizeUrl(payload.baseUrl);
    if (Object.prototype.hasOwnProperty.call(payload, "model")) provider.model = normalizeModel(payload.model);
    if (Object.prototype.hasOwnProperty.call(payload, "protocol")) provider.protocol = normalizeProtocol(payload.protocol, provider.protocol);
    provider.protocol = inferProtocol(provider.protocol, provider.baseUrl);
    if (Object.prototype.hasOwnProperty.call(payload, "kind")) provider.kind = normalizeKind(payload.kind, provider.kind);
    if (Object.prototype.hasOwnProperty.call(payload, "status")) provider.status = normalizeStatus(payload.status, provider.status);
    const nextApiKey = readApiKey(payload);
    if (nextApiKey !== undefined) provider.apiKey = nextApiKey;
    provider.connectionStatus = "untested";
    provider.lastTestAt = null;
    provider.lastTestMessage = "配置已修改，等待重新测试连接。";
    provider.updatedAt = nowIso();
    await this.write(() => undefined);
    return publicProvider(provider);
  }

  async remove(id) {
    await this.load();
    const index = this.state.providers.findIndex((provider) => provider.id === id);
    if (index < 0) throw new AiProviderError("AI 供应商不存在。", 404);
    const [removed] = this.state.providers.splice(index, 1);
    await this.write(() => undefined);
    return publicProvider(removed);
  }

  async test(id) {
    await this.load();
    const provider = this.find(id);
    if (!provider) throw new AiProviderError("AI 供应商不存在。", 404);
    const testedAt = nowIso();
    const message = provider.status === "disabled"
      ? "供应商已停用，演示连接未执行。"
      : provider.apiKey
        ? "演示连接测试通过（未请求外部模型）。"
        : "演示连接完成，但当前未配置 API Key。";
    provider.connectionStatus = provider.status === "disabled" ? "failed" : "passed";
    provider.lastTestAt = testedAt;
    provider.lastTestMessage = message;
    provider.updatedAt = testedAt;
    await this.write(() => undefined);
    return { status: provider.connectionStatus, testedAt, message, provider: publicProvider(provider) };
  }

  async recordConnectionTest(id, status, message, testedAt = nowIso()) {
    await this.load();
    const provider = this.find(id);
    if (!provider) throw new AiProviderError("AI 供应商不存在。", 404);
    provider.connectionStatus = ["passed", "failed", "untested"].includes(status) ? status : "failed";
    provider.lastTestAt = testedAt;
    provider.lastTestMessage = String(message || "").replace(/[\r\n\t]+/g, " ").slice(0, 200);
    provider.updatedAt = testedAt;
    await this.write(() => undefined);
    return publicProvider(provider);
  }

  async setModel(id, model, models = undefined) {
    await this.load();
    const provider = this.find(id);
    if (!provider) throw new AiProviderError("AI 供应商不存在。", 404);
    provider.model = normalizeModel(model);
    if (Array.isArray(models)) provider.models = models.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 50);
    provider.connectionStatus = "untested";
    provider.lastTestAt = null;
    provider.lastTestMessage = "模型已根据供应商可用列表更新，等待连接测试。";
    provider.updatedAt = nowIso();
    await this.write(() => undefined);
    return publicProvider(provider);
  }
}

export const aiProviderStore = new AiProviderStore();
export { AiProviderError, maskedKey, publicProvider };
