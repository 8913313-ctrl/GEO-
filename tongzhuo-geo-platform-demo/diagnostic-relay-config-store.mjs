import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionSecrets, ProductionSecretsError } from "./production-secrets.mjs";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

export class DiagnosticRelayConfigError extends Error {
  constructor(message, status = 400, code = "DIAGNOSTIC_RELAY_CONFIG_INVALID") {
    super(message);
    this.name = "DiagnosticRelayConfigError";
    this.status = status;
    this.code = code;
  }
}

function nowIso() { return new Date().toISOString(); }
function text(value, field, maximum = 512) {
  const result = String(value ?? "").replace(/[\u0000\r\n]/g, "").trim();
  if (result.length > maximum) throw new DiagnosticRelayConfigError(`${field} 不能超过 ${maximum} 个字符。`);
  return result;
}
function normalizeUrl(value) {
  const raw = text(value, "中转服务地址", 1_024);
  if (!raw) return "";
  let parsed;
  try { parsed = new URL(raw); } catch { throw new DiagnosticRelayConfigError("中转服务地址必须是有效的 HTTP(S) 地址。", 422); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new DiagnosticRelayConfigError("中转服务地址只允许使用 HTTP(S)。", 422);
  return parsed.toString().replace(/\/+$/, "");
}

function emptyState() {
  return { schemaVersion: 1, baseUrl: "", instanceId: "", clientId: "", deliveryConsumer: "", clientSecretEncrypted: null, updatedAt: null, lastTestAt: null, lastTestStatus: "untested", lastTestMessage: "", lastTestDetails: null };
}

function maskedSecret(secret) {
  const value = String(secret || "");
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}••••${value.slice(-2)}`;
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export class DiagnosticRelayConfigStore {
  constructor(options = {}) {
    this.dataDir = path.resolve(options.dataDir || process.env.TZ_DATA_DIR || path.join(moduleRoot, "data"));
    this.statePath = path.join(this.dataDir, options.fileName || "diagnostic-relay-config.json");
    this.secrets = options.secrets || new ProductionSecrets({ dataDir: this.dataDir });
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.state) return this.state;
    try { await this.secrets.load(); } catch (error) {
      const message = error instanceof ProductionSecretsError ? error.message : "服务端主密钥无法加载。";
      throw new DiagnosticRelayConfigError(message, 500, "DIAGNOSTIC_RELAY_SECRET_STORE_UNAVAILABLE");
    }
    try {
      const parsed = JSON.parse(await readFile(this.statePath, "utf8"));
      this.state = { ...emptyState(), ...(parsed && typeof parsed === "object" ? parsed : {}) };
      this.state.baseUrl = normalizeUrl(this.state.baseUrl);
      this.state.instanceId = text(this.state.instanceId, "实例 ID", 256);
      this.state.clientId = text(this.state.clientId, "Client ID", 256);
      this.state.deliveryConsumer = text(this.state.deliveryConsumer, "交付消费者", 256);
      this.state.clientSecretEncrypted = this.state.clientSecretEncrypted && typeof this.state.clientSecretEncrypted === "object" ? this.state.clientSecretEncrypted : null;
      this.state.lastTestStatus = ["passed", "failed", "untested"].includes(this.state.lastTestStatus) ? this.state.lastTestStatus : "untested";
      this.state.lastTestMessage = text(this.state.lastTestMessage, "测试消息", 500);
    } catch (error) {
      if (error instanceof DiagnosticRelayConfigError) throw error;
      if (error?.code !== "ENOENT") throw new DiagnosticRelayConfigError("AI 效果检测服务配置文件无法读取。", 500, "DIAGNOSTIC_RELAY_CONFIG_READ_FAILED");
      this.state = emptyState();
    }
    return this.state;
  }

  async persist() {
    try { await this.secrets.load(); } catch (error) {
      const message = error instanceof ProductionSecretsError ? error.message : "服务端主密钥无法加载。";
      throw new DiagnosticRelayConfigError(message, 500, "DIAGNOSTIC_RELAY_SECRET_STORE_UNAVAILABLE");
    }
    await mkdir(this.dataDir, { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.state, null, 2), { encoding: "utf8", mode: 0o600 });
    try { await chmod(temporaryPath, 0o600); } catch { /* Windows ACLs remain server-managed. */ }
    await rename(temporaryPath, this.statePath);
  }

  async write(mutator) {
    await this.load();
    let result;
    this.writeQueue = this.writeQueue.then(async () => { result = await mutator(this.state); await this.persist(); });
    await this.writeQueue;
    return result;
  }

  decryptSecret() {
    if (!this.state?.clientSecretEncrypted) return "";
    try { return this.secrets.decryptSecret(this.state.clientSecretEncrypted, "diagnostic-relay:client-secret"); }
    catch (error) { throw new DiagnosticRelayConfigError(error.message || "中转站密钥无法解密。", 500, "DIAGNOSTIC_RELAY_SECRET_DECRYPT_FAILED"); }
  }

  public({ source = "ui" } = {}) {
    const secret = this.state?.clientSecretEncrypted ? this.decryptSecret() : "";
    return {
      configured: Boolean(this.state?.baseUrl && this.state?.instanceId && this.state?.clientId && secret),
      source,
      baseUrl: this.state?.baseUrl || "",
      instanceId: this.state?.instanceId || "",
      clientId: this.state?.clientId || "",
      deliveryConsumer: this.state?.deliveryConsumer || "",
      hasClientSecret: Boolean(secret),
      clientSecretMasked: maskedSecret(secret),
      updatedAt: this.state?.updatedAt || null,
      lastTestAt: this.state?.lastTestAt || null,
      lastTestStatus: this.state?.lastTestStatus || "untested",
      lastTestMessage: this.state?.lastTestMessage || "",
      lastTestDetails: this.state?.lastTestDetails || null
    };
  }

  async save(payload = {}) {
    await this.load();
    const next = {
      baseUrl: normalizeUrl(payload.baseUrl),
      instanceId: text(payload.instanceId, "实例 ID", 256),
      clientId: text(payload.clientId, "Client ID", 256),
      deliveryConsumer: text(payload.deliveryConsumer, "交付消费者", 256)
    };
    const hasSecretField = Object.prototype.hasOwnProperty.call(payload, "clientSecret");
    const suppliedSecret = hasSecretField ? String(payload.clientSecret ?? "").trim() : "";
    if (suppliedSecret.length > 4_096) throw new DiagnosticRelayConfigError("Client Secret 不能超过 4096 个字符。", 422);
    await this.write((state) => {
      Object.assign(state, next);
      if (hasSecretField && suppliedSecret) state.clientSecretEncrypted = this.secrets.encryptSecret(suppliedSecret, "diagnostic-relay:client-secret");
      state.updatedAt = nowIso();
      state.lastTestStatus = "untested";
      state.lastTestAt = null;
      state.lastTestMessage = "配置已保存，等待连接测试。";
      state.lastTestDetails = null;
    });
    return this.public();
  }

  async recordTest(status, message, details = null) {
    await this.write((state) => {
      state.lastTestAt = nowIso();
      state.lastTestStatus = ["passed", "failed", "untested"].includes(status) ? status : "failed";
      state.lastTestMessage = text(message, "测试消息", 500);
      state.lastTestDetails = details && typeof details === "object" ? details : null;
      state.updatedAt = state.updatedAt || state.lastTestAt;
    });
    return this.public();
  }

  runtimeConfig() {
    return {
      relayBaseUrl: this.state?.baseUrl || "",
      relayInstanceId: this.state?.instanceId || "",
      relayClientId: this.state?.clientId || "",
      relayClientSecret: this.decryptSecret(),
      relayDeliveryConsumer: this.state?.deliveryConsumer || ""
    };
  }
}

export const diagnosticRelayConfigStore = new DiagnosticRelayConfigStore();
