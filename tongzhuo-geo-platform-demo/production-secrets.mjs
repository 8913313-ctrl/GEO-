import crypto from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const MASTER_KEY_BYTES = 32;
const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "aes-256-gcm";
const DIGEST_PREFIX = "sha256:v1:";

export class ProductionSecretsError extends Error {
  constructor(message, cause = undefined) {
    super(message, cause ? { cause } : undefined);
    this.name = "ProductionSecretsError";
  }
}

function decodeMasterKey(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length !== MASTER_KEY_BYTES) throw new ProductionSecretsError("主密钥必须正好为 32 字节。");
    return Buffer.from(value);
  }

  const material = String(value || "").trim();
  if (!material) return null;
  let decoded;
  if (/^[A-Fa-f0-9]{64}$/.test(material)) {
    decoded = Buffer.from(material, "hex");
  } else if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(material)) {
    try {
      decoded = Buffer.from(material.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    } catch {
      decoded = null;
    }
  }
  if (!decoded || decoded.length !== MASTER_KEY_BYTES) {
    throw new ProductionSecretsError("TZ_MASTER_KEY 必须是 32 字节密钥的 base64/base64url 或 64 位十六进制表示。");
  }
  return decoded;
}

async function bestEffortPrivateMode(filePath) {
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows does not implement POSIX mode bits. File ACLs remain the
    // responsibility of the private-deployment installer/service account.
  }
}

export async function loadMasterKey(options = {}) {
  const dataDir = path.resolve(options.dataDir || path.join(moduleRoot, "data"));
  const keyPath = path.resolve(options.keyPath || path.join(dataDir, "secrets", "master.key"));
  const injectedKey = options.masterKey === undefined ? null : decodeMasterKey(options.masterKey);
  if (injectedKey) return injectedKey;

  const environmentValue = Object.prototype.hasOwnProperty.call(options, "environmentValue")
    ? options.environmentValue
    : process.env.TZ_MASTER_KEY;
  const environmentKey = decodeMasterKey(environmentValue);
  if (environmentKey) return environmentKey;

  try {
    const existing = await readFile(keyPath);
    if (existing.length !== MASTER_KEY_BYTES) {
      throw new ProductionSecretsError(`主密钥文件 ${keyPath} 必须正好包含 32 个随机字节。`);
    }
    await bestEffortPrivateMode(keyPath);
    return existing;
  } catch (error) {
    if (error instanceof ProductionSecretsError) throw error;
    if (error?.code !== "ENOENT") throw new ProductionSecretsError("主密钥文件无法读取。", error);
  }

  await mkdir(path.dirname(keyPath), { recursive: true });
  const generated = crypto.randomBytes(MASTER_KEY_BYTES);
  try {
    await writeFile(keyPath, generated, { flag: "wx", mode: 0o600 });
    await bestEffortPrivateMode(keyPath);
    return generated;
  } catch (error) {
    if (error?.code !== "EEXIST") throw new ProductionSecretsError("主密钥文件无法创建。", error);
    const existing = await readFile(keyPath);
    if (existing.length !== MASTER_KEY_BYTES) {
      throw new ProductionSecretsError(`主密钥文件 ${keyPath} 必须正好包含 32 个随机字节。`);
    }
    await bestEffortPrivateMode(keyPath);
    return existing;
  }
}

function associatedData(context) {
  return Buffer.from(`tongzhuo-secret:${String(context || "default")}`, "utf8");
}

export class ProductionSecrets {
  constructor(options = {}) {
    this.options = { ...options };
    this.masterKey = null;
  }

  async load() {
    if (!this.masterKey) this.masterKey = await loadMasterKey(this.options);
    return this;
  }

  encryptSecret(value, context = "default") {
    const secret = String(value || "");
    if (!secret) return null;
    if (!this.masterKey) throw new ProductionSecretsError("主密钥尚未加载。");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENVELOPE_ALGORITHM, this.masterKey, iv);
    cipher.setAAD(associatedData(context));
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return {
      version: ENVELOPE_VERSION,
      algorithm: ENVELOPE_ALGORITHM,
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url")
    };
  }

  decryptSecret(envelope, context = "default") {
    if (envelope === null || envelope === undefined || envelope === "") return "";
    if (!this.masterKey) throw new ProductionSecretsError("主密钥尚未加载。");
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new ProductionSecretsError("加密密文格式无效。");
    }
    if (envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== ENVELOPE_ALGORITHM) {
      throw new ProductionSecretsError("不支持的加密密文版本或算法。");
    }
    try {
      const iv = Buffer.from(String(envelope.iv || ""), "base64url");
      const tag = Buffer.from(String(envelope.tag || ""), "base64url");
      const ciphertext = Buffer.from(String(envelope.ciphertext || ""), "base64url");
      if (iv.length !== 12 || tag.length !== 16) throw new Error("invalid envelope sizes");
      const decipher = crypto.createDecipheriv(ENVELOPE_ALGORITHM, this.masterKey, iv);
      decipher.setAAD(associatedData(context));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch (error) {
      throw new ProductionSecretsError("密文无法解密，请检查主密钥和密文完整性。", error);
    }
  }
}

export function secretDigest(secret) {
  const value = String(secret || "");
  if (!value) return "";
  return `${DIGEST_PREFIX}${crypto.createHash("sha256").update(value, "utf8").digest("base64url")}`;
}

export function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySecret(secret, storedDigest) {
  const digest = String(storedDigest || "");
  if (!digest.startsWith(DIGEST_PREFIX)) return false;
  return timingSafeEqual(secretDigest(secret), digest);
}

