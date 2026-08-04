import crypto from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const MASTER_KEY_BYTES = 32;
const SECRET_AAD_PREFIX = "tongzhuo-relay:v1:";
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const DEFAULT_NONCE_WINDOW_SECONDS = 300;
const DEFAULT_DELIVERY_MAX_ATTEMPTS = 12;
const MAX_RUN_ITEMS = 500;
const MAX_INCLUDE_RESULTS_BYTES = 5 * 1024 * 1024;

const RUN_STATUSES = new Set(["queued", "running", "partial", "completed", "failed", "attention", "cancelled"]);
const ITEM_TERMINAL_STATUSES = new Set(["completed", "failed", "dead_letter", "cancelled"]);
const ITEM_ACTIVE_STATUSES = new Set(["queued", "submit_retry", "submitted", "poll_retry"]);
const RECONCILIATION_RESOLUTIONS = new Set(["refund", "confirmed_success", "retry"]);
const PAYMENT_ORDER_STATUSES = new Set(["pending_payment", "paid", "cancelled"]);
const PAYMENT_CHANNELS = new Set(["offline_bank", "wechat_transfer", "alipay_transfer", "contract_grant"]);
const INVOICE_REQUEST_STATUSES = new Set(["requested", "issued", "voided"]);
const ADMIN_ROLES = new Set(["super_admin", "operations", "finance", "support", "auditor"]);
const ADMIN_STATUSES = new Set(["active", "disabled"]);
const ADMIN_PASSWORD_SCRYPT = Object.freeze({ N: 16_384, r: 8, p: 1, keyLength: 64 });
const ADMIN_LOGIN_MAX_FAILURES = 5;
const ADMIN_LOGIN_LOCK_MS = 15 * 60_000;

export class RelayStoreError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "RelayStoreError";
    this.code = code;
    this.statusCode = Number(options.statusCode || 400);
    this.details = options.details;
  }
}

function relayError(code, message, options = {}) {
  return new RelayStoreError(code, message, options);
}

function nowIso(value = undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function isoAfter(ms, now = new Date()) {
  return new Date(now.valueOf() + Math.max(0, Number(ms) || 0)).toISOString();
}

function toInteger(value, fallback = 0, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  return toInteger(value, fallback, 1, maximum);
}

function nonNegativeInteger(value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return toInteger(value, fallback, 0, maximum);
}

function optionalCreditCap(value, maximum = 10_000_000) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw relayError("RELAY_VALIDATION", `单次积分上限必须是 0 到 ${maximum} 之间的整数。`, { statusCode: 422, details: { field: "maxCustomerCredits", maximum } });
  }
  return parsed;
}

function cleanText(value, name, options = {}) {
  const normalized = String(value ?? "").trim();
  const minimum = Number(options.minimum ?? 1);
  const maximum = Number(options.maximum ?? 2_000);
  if (normalized.length < minimum || normalized.length > maximum) {
    throw relayError("RELAY_VALIDATION", `${name} 长度必须在 ${minimum} 到 ${maximum} 个字符之间。`, { statusCode: 422 });
  }
  return normalized;
}

function optionalText(value, maximum = 2_000) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maximum) throw relayError("RELAY_VALIDATION", `字段长度不能超过 ${maximum} 个字符。`, { statusCode: 422 });
  return normalized;
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function digestText(value) {
  return `sha256:${digest(Buffer.from(String(value ?? ""), "utf8"))}`;
}

function timingSafeTextEqual(left, right) {
  const leftBytes = Buffer.from(String(left ?? ""), "utf8");
  const rightBytes = Buffer.from(String(right ?? ""), "utf8");
  return leftBytes.length > 0 && leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw relayError("RELAY_VALIDATION", "JSON 数据不能包含非有限数字。", { statusCode: 422 });
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) output[key] = canonicalize(value[key]);
    }
    return output;
  }
  throw relayError("RELAY_VALIDATION", "数据必须可以序列化为 JSON。", { statusCode: 422 });
}

function stableJson(value, fallback = {}) {
  return JSON.stringify(canonicalize(value === undefined ? fallback : value));
}

function parseJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
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

function safeJson(value, fallback = {}) {
  return stableJson(redactSensitive(value === undefined ? fallback : value));
}

function startOfUtcDay(iso) {
  const date = new Date(iso);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfUtcMonth(iso) {
  const date = new Date(iso);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function decodeMasterKey(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length !== MASTER_KEY_BYTES) throw relayError("RELAY_SECRET_CONFIGURATION", "中转站主密钥必须正好为 32 字节。", { statusCode: 500 });
    return Buffer.from(value);
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  let decoded = null;
  if (/^[A-Fa-f0-9]{64}$/.test(text)) decoded = Buffer.from(text, "hex");
  else if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) decoded = Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!decoded || decoded.length !== MASTER_KEY_BYTES) {
    throw relayError("RELAY_SECRET_CONFIGURATION", "TZ_RELAY_MASTER_KEY 必须是 32 字节密钥的 base64/base64url 或 64 位十六进制表示。", { statusCode: 500 });
  }
  return decoded;
}

function bestEffortPrivateMode(filePath) {
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Windows 服务账户的文件 ACL 由部署脚本负责。
  }
}

function normalizeAdminUsername(value) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    throw relayError("RELAY_ADMIN_USERNAME_INVALID", "管理员账号须为 3 到 64 位小写字母、数字、点、下划线或连字符。", { statusCode: 422 });
  }
  return username;
}

function validateAdminPassword(value) {
  const password = String(value ?? "");
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (password.length < 12 || password.length > 256 || classes < 3) {
    throw relayError("RELAY_ADMIN_PASSWORD_WEAK", "管理员密码须为 12 到 256 位，并至少包含大写字母、小写字母、数字、符号中的三类。", { statusCode: 422 });
  }
  return password;
}

function hashAdminPassword(value, saltValue = undefined) {
  const password = validateAdminPassword(value);
  const salt = saltValue ? Buffer.from(String(saltValue), "base64url") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, ADMIN_PASSWORD_SCRYPT.keyLength, {
    N: ADMIN_PASSWORD_SCRYPT.N,
    r: ADMIN_PASSWORD_SCRYPT.r,
    p: ADMIN_PASSWORD_SCRYPT.p,
    maxmem: 64 * 1024 * 1024
  });
  return {
    salt: salt.toString("base64url"),
    hash: hash.toString("base64url"),
    params: { algorithm: "scrypt", N: ADMIN_PASSWORD_SCRYPT.N, r: ADMIN_PASSWORD_SCRYPT.r, p: ADMIN_PASSWORD_SCRYPT.p, keyLength: ADMIN_PASSWORD_SCRYPT.keyLength }
  };
}

function verifyAdminPassword(value, row) {
  try {
    const salt = Buffer.from(String(row?.password_salt || ""), "base64url");
    const expected = Buffer.from(String(row?.password_hash || ""), "base64url");
    if (salt.length !== 16 || expected.length !== ADMIN_PASSWORD_SCRYPT.keyLength) return false;
    const actual = crypto.scryptSync(String(value ?? ""), salt, expected.length, {
      N: ADMIN_PASSWORD_SCRYPT.N,
      r: ADMIN_PASSWORD_SCRYPT.r,
      p: ADMIN_PASSWORD_SCRYPT.p,
      maxmem: 64 * 1024 * 1024
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) return Buffer.alloc(0);
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secret, timestamp = Date.now()) {
  const key = decodeBase32(secret);
  if (key.length < 16) return "";
  const counter = Math.floor(new Date(timestamp).valueOf() / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digestBytes = crypto.createHmac("sha1", key).update(counterBytes).digest();
  const offset = digestBytes[digestBytes.length - 1] & 0x0f;
  const binary = ((digestBytes[offset] & 0x7f) << 24)
    | ((digestBytes[offset + 1] & 0xff) << 16)
    | ((digestBytes[offset + 2] & 0xff) << 8)
    | (digestBytes[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret, code, timestamp = Date.now()) {
  const normalized = String(code || "").trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const drift of [-30_000, 0, 30_000]) {
    if (timingSafeTextEqual(totpCode(secret, new Date(timestamp).valueOf() + drift), normalized)) return true;
  }
  return false;
}

const ADMIN_DUMMY_PASSWORD_RECORD = hashAdminPassword("RelayDummyPassword!2026", Buffer.alloc(16, 7).toString("base64url"));

export function resolveRelayDatabasePath(options = {}) {
  const configured = String(options.databasePath || process.env.TZ_RELAY_DATABASE_PATH || "").trim();
  if (configured === ":memory:") return configured;
  const dataDir = path.resolve(options.dataDir || process.env.TZ_RELAY_DATA_DIR || path.join(moduleRoot, "data"));
  return path.resolve(configured || path.join(dataDir, "tongzhuo-relay.sqlite"));
}

export function loadRelayMasterKey(options = {}) {
  const explicit = decodeMasterKey(options.masterKey);
  if (explicit) return explicit;
  const environment = decodeMasterKey(options.environmentValue === undefined ? process.env.TZ_RELAY_MASTER_KEY : options.environmentValue);
  if (environment) return environment;
  const dataDir = path.resolve(options.dataDir || process.env.TZ_RELAY_DATA_DIR || path.join(moduleRoot, "data"));
  const keyPath = path.resolve(options.keyPath || path.join(dataDir, "secrets", "relay-master.key"));
  if (existsSync(keyPath)) {
    const key = readFileSync(keyPath);
    if (key.length !== MASTER_KEY_BYTES) throw relayError("RELAY_SECRET_CONFIGURATION", "中转站主密钥文件必须正好包含 32 个随机字节。", { statusCode: 500 });
    bestEffortPrivateMode(keyPath);
    return key;
  }
  mkdirSync(path.dirname(keyPath), { recursive: true });
  const generated = crypto.randomBytes(MASTER_KEY_BYTES);
  try {
    writeFileSync(keyPath, generated, { flag: "wx", mode: 0o600 });
    bestEffortPrivateMode(keyPath);
    return generated;
  } catch (error) {
    if (error?.code !== "EEXIST") throw relayError("RELAY_SECRET_CONFIGURATION", "无法创建中转站主密钥文件。", { statusCode: 500, cause: error });
    const key = readFileSync(keyPath);
    if (key.length !== MASTER_KEY_BYTES) throw relayError("RELAY_SECRET_CONFIGURATION", "中转站主密钥文件必须正好包含 32 个随机字节。", { statusCode: 500 });
    bestEffortPrivateMode(keyPath);
    return key;
  }
}

export class RelaySecretBox {
  constructor(options = {}) {
    this.masterKey = loadRelayMasterKey(options);
  }

  encrypt(value, context) {
    const plainText = String(value ?? "");
    if (!plainText) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);
    cipher.setAAD(Buffer.from(`${SECRET_AAD_PREFIX}${context}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url")
    };
  }

  decrypt(envelope, context) {
    if (!envelope) return "";
    if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
      throw relayError("RELAY_SECRET_CONFIGURATION", "不支持的中转站密文版本。", { statusCode: 500 });
    }
    try {
      const iv = Buffer.from(String(envelope.iv || ""), "base64url");
      const tag = Buffer.from(String(envelope.tag || ""), "base64url");
      const ciphertext = Buffer.from(String(envelope.ciphertext || ""), "base64url");
      if (iv.length !== 12 || tag.length !== 16) throw new Error("invalid envelope");
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.masterKey, iv);
      decipher.setAAD(Buffer.from(`${SECRET_AAD_PREFIX}${context}`, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch (error) {
      throw relayError("RELAY_SECRET_CONFIGURATION", "中转站密文无法解密，请检查主密钥。", { statusCode: 500, cause: error });
    }
  }
}

export function buildInstanceSignatureInput({ method, requestTarget, timestamp, nonce, rawBody = "" }) {
  const normalizedMethod = cleanText(method, "HTTP 方法", { maximum: 16 }).toUpperCase();
  const normalizedTarget = cleanText(requestTarget, "请求路径", { maximum: 4_096 });
  const normalizedTimestamp = cleanText(timestamp, "时间戳", { maximum: 32 });
  const normalizedNonce = cleanText(nonce, "Nonce", { maximum: 256 });
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  return `${normalizedMethod}\n${normalizedTarget}\n${normalizedTimestamp}\n${normalizedNonce}\n${digest(body)}`;
}

export function signInstanceRequest({ secret, method, requestTarget, timestamp, nonce, rawBody = "" }) {
  const signingSecret = cleanText(secret, "实例密钥", { maximum: 4_096 });
  const input = buildInstanceSignatureInput({ method, requestTarget, timestamp, nonce, rawBody });
  return crypto.createHmac("sha256", signingSecret).update(input, "utf8").digest("hex");
}

const MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "relay_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS relay_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE relay_tenants (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE relay_wallets (
        tenant_id TEXT PRIMARY KEY REFERENCES relay_tenants(id) ON DELETE CASCADE,
        available_credits INTEGER NOT NULL DEFAULT 0 CHECK (available_credits >= 0),
        held_credits INTEGER NOT NULL DEFAULT 0 CHECK (held_credits >= 0),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE relay_provider_accounts (
        id TEXT PRIMARY KEY,
        provider_code TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disabled')),
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        token_reference TEXT NOT NULL DEFAULT '',
        token_envelope_json TEXT,
        capabilities_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(capabilities_json)),
        last_known_balance INTEGER,
        max_in_flight INTEGER NOT NULL DEFAULT 8 CHECK (max_in_flight >= 1),
        last_health_at TEXT,
        last_health_status TEXT NOT NULL DEFAULT 'unknown',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX relay_provider_default_idx
        ON relay_provider_accounts(provider_code)
        WHERE is_default = 1;

      CREATE TABLE relay_instances (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        provider_account_id TEXT REFERENCES relay_provider_accounts(id) ON DELETE RESTRICT,
        display_name TEXT NOT NULL,
        client_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
        secret_envelope_json TEXT NOT NULL CHECK (json_valid(secret_envelope_json)),
        secret_fingerprint TEXT NOT NULL,
        secret_version INTEGER NOT NULL DEFAULT 1 CHECK (secret_version >= 1),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
        allowed_capabilities_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(allowed_capabilities_json)),
        max_in_flight INTEGER NOT NULL DEFAULT 2 CHECK (max_in_flight >= 1),
        daily_credit_limit INTEGER NOT NULL DEFAULT 0 CHECK (daily_credit_limit >= 0),
        monthly_credit_limit INTEGER NOT NULL DEFAULT 0 CHECK (monthly_credit_limit >= 0),
        callback_url TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX relay_instances_tenant_idx ON relay_instances(tenant_id, status);

      CREATE TABLE relay_price_rules (
        id TEXT PRIMARY KEY,
        provider_account_id TEXT NOT NULL REFERENCES relay_provider_accounts(id) ON DELETE RESTRICT,
        platform TEXT NOT NULL,
        terminal TEXT NOT NULL,
        mode TEXT NOT NULL,
        customer_credits INTEGER NOT NULL CHECK (customer_credits > 0),
        estimated_upstream_credits INTEGER NOT NULL DEFAULT 0 CHECK (estimated_upstream_credits >= 0),
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider_account_id, platform, terminal, mode, version)
      ) STRICT;

      CREATE INDEX relay_price_rules_lookup_idx
        ON relay_price_rules(provider_account_id, platform, terminal, mode, status, updated_at DESC);

      CREATE TABLE relay_runs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        instance_id TEXT NOT NULL REFERENCES relay_instances(id) ON DELETE RESTRICT,
        provider_account_id TEXT NOT NULL REFERENCES relay_provider_accounts(id) ON DELETE RESTRICT,
        client_run_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'partial', 'completed', 'failed', 'attention', 'cancelled')),
        billing_status TEXT NOT NULL DEFAULT 'held' CHECK (billing_status IN ('held', 'settled', 'refunded', 'awaiting_reconciliation', 'cancelled')),
        project_id TEXT NOT NULL DEFAULT '',
        question_set_id TEXT NOT NULL DEFAULT '',
        question_set_checksum TEXT NOT NULL DEFAULT '',
        input_snapshot_json TEXT NOT NULL CHECK (json_valid(input_snapshot_json)),
        capability_snapshot_json TEXT NOT NULL CHECK (json_valid(capability_snapshot_json)),
        price_snapshot_json TEXT NOT NULL CHECK (json_valid(price_snapshot_json)),
        consent_json TEXT NOT NULL CHECK (json_valid(consent_json)),
        estimated_customer_credits INTEGER NOT NULL CHECK (estimated_customer_credits >= 0),
        held_customer_credits INTEGER NOT NULL CHECK (held_customer_credits >= 0),
        settled_customer_credits INTEGER NOT NULL DEFAULT 0 CHECK (settled_customer_credits >= 0),
        total_items INTEGER NOT NULL CHECK (total_items > 0),
        completed_items INTEGER NOT NULL DEFAULT 0 CHECK (completed_items >= 0),
        failed_items INTEGER NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
        submitted_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(instance_id, idempotency_key),
        UNIQUE(instance_id, client_run_id)
      ) STRICT;

      CREATE INDEX relay_runs_tenant_idx ON relay_runs(tenant_id, submitted_at DESC);
      CREATE INDEX relay_runs_instance_idx ON relay_runs(instance_id, submitted_at DESC);
      CREATE INDEX relay_runs_status_idx ON relay_runs(status, updated_at);

      CREATE TABLE relay_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES relay_runs(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        instance_id TEXT NOT NULL REFERENCES relay_instances(id) ON DELETE RESTRICT,
        provider_account_id TEXT NOT NULL REFERENCES relay_provider_accounts(id) ON DELETE RESTRICT,
        client_item_id TEXT NOT NULL,
        question_id TEXT NOT NULL DEFAULT '',
        ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
        platform TEXT NOT NULL,
        terminal TEXT NOT NULL,
        mode TEXT NOT NULL,
        request_json TEXT NOT NULL CHECK (json_valid(request_json)),
        customer_credits INTEGER NOT NULL CHECK (customer_credits > 0),
        estimated_upstream_credits INTEGER NOT NULL DEFAULT 0 CHECK (estimated_upstream_credits >= 0),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'submit_retry', 'submitted', 'poll_retry', 'completed', 'failed', 'dead_letter', 'submission_uncertain', 'cancelled')),
        upstream_req_id TEXT UNIQUE,
        submission_response_json TEXT,
        raw_payload_json TEXT,
        normalized_json TEXT,
        normalizer_version TEXT NOT NULL DEFAULT '',
        raw_payload_hash TEXT NOT NULL DEFAULT '',
        upstream_credits INTEGER NOT NULL DEFAULT 0 CHECK (upstream_credits >= 0),
        submit_attempts INTEGER NOT NULL DEFAULT 0 CHECK (submit_attempts >= 0),
        poll_attempts INTEGER NOT NULL DEFAULT 0 CHECK (poll_attempts >= 0),
        last_error_code TEXT,
        last_error_message TEXT,
        next_action_at TEXT NOT NULL,
        lease_owner TEXT,
        lease_until TEXT,
        observed_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(run_id, client_item_id)
      ) STRICT;

      CREATE INDEX relay_items_work_idx
        ON relay_items(status, next_action_at, lease_until, created_at);
      CREATE INDEX relay_items_run_idx ON relay_items(run_id, ordinal);
      CREATE INDEX relay_items_instance_lease_idx ON relay_items(instance_id, lease_until);

      CREATE TABLE relay_attempts (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES relay_items(id) ON DELETE CASCADE,
        operation TEXT NOT NULL CHECK (operation IN ('submit', 'poll')),
        attempt_no INTEGER NOT NULL CHECK (attempt_no >= 1),
        worker_id TEXT NOT NULL,
        outcome TEXT NOT NULL DEFAULT 'running' CHECK (outcome IN ('running', 'succeeded', 'retry_scheduled', 'failed', 'uncertain')),
        provider_status TEXT NOT NULL DEFAULT '',
        response_hash TEXT NOT NULL DEFAULT '',
        error_code TEXT,
        error_message TEXT,
        latency_ms INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        UNIQUE(item_id, operation, attempt_no)
      ) STRICT;

      CREATE INDEX relay_attempts_item_idx ON relay_attempts(item_id, started_at DESC);

      CREATE TABLE relay_billing_ledger (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        provider_account_id TEXT REFERENCES relay_provider_accounts(id) ON DELETE SET NULL,
        run_id TEXT REFERENCES relay_runs(id) ON DELETE SET NULL,
        item_id TEXT REFERENCES relay_items(id) ON DELETE SET NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('top_up', 'adjustment', 'freeze', 'settle', 'release', 'upstream_cost')),
        available_delta INTEGER NOT NULL DEFAULT 0,
        held_delta INTEGER NOT NULL DEFAULT 0,
        available_after INTEGER,
        held_after INTEGER,
        customer_credits INTEGER NOT NULL DEFAULT 0 CHECK (customer_credits >= 0),
        upstream_credits INTEGER NOT NULL DEFAULT 0 CHECK (upstream_credits >= 0),
        price_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(price_snapshot_json)),
        idempotency_key TEXT,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX relay_ledger_idempotency_idx
        ON relay_billing_ledger(tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX relay_ledger_tenant_idx ON relay_billing_ledger(tenant_id, created_at DESC);
      CREATE INDEX relay_ledger_run_idx ON relay_billing_ledger(run_id, created_at);

      CREATE TABLE relay_deliveries (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        instance_id TEXT NOT NULL REFERENCES relay_instances(id) ON DELETE RESTRICT,
        run_id TEXT NOT NULL REFERENCES relay_runs(id) ON DELETE CASCADE,
        item_id TEXT REFERENCES relay_items(id) ON DELETE CASCADE,
        delivery_key TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence >= 1),
        kind TEXT NOT NULL CHECK (kind IN ('item_result', 'item_attention', 'run_summary')),
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'acknowledged', 'dead_letter')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        available_at TEXT NOT NULL,
        lease_owner TEXT,
        lease_until TEXT,
        last_error TEXT,
        acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(instance_id, delivery_key),
        UNIQUE(instance_id, sequence)
      ) STRICT;

      CREATE INDEX relay_deliveries_pull_idx
        ON relay_deliveries(instance_id, status, available_at, lease_until, sequence);

      CREATE TABLE relay_nonce_uses (
        instance_id TEXT NOT NULL REFERENCES relay_instances(id) ON DELETE CASCADE,
        nonce TEXT NOT NULL,
        seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY(instance_id, nonce)
      ) STRICT;

      CREATE INDEX relay_nonce_expiry_idx ON relay_nonce_uses(expires_at);

      CREATE TABLE relay_audit_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES relay_tenants(id) ON DELETE SET NULL,
        instance_id TEXT REFERENCES relay_instances(id) ON DELETE SET NULL,
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX relay_audit_events_entity_idx
        ON relay_audit_events(entity_type, entity_id, created_at DESC);
    `
  },
  {
    version: 2,
    name: "ledger_immutability",
    sql: `
      CREATE TRIGGER relay_billing_ledger_no_update
      BEFORE UPDATE ON relay_billing_ledger
      BEGIN
        SELECT RAISE(ABORT, 'relay_billing_ledger is append-only');
      END;

      CREATE TRIGGER relay_billing_ledger_no_delete
      BEFORE DELETE ON relay_billing_ledger
      BEGIN
        SELECT RAISE(ABORT, 'relay_billing_ledger is append-only');
      END;
    `
  },
  {
    version: 3,
    name: "operator_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS relay_operator_settings (
        setting_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL CHECK (json_valid(value_json)),
        updated_by TEXT NOT NULL DEFAULT 'operator',
        updated_at TEXT NOT NULL
      ) STRICT;
    `
  },
  {
    version: 4,
    name: "admin_sessions",
    sql: `
      CREATE TABLE IF NOT EXISTS relay_admin_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT,
        revoked_reason TEXT,
        remote_address TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT ''
      ) STRICT;

      CREATE INDEX IF NOT EXISTS relay_admin_sessions_expiry_idx
        ON relay_admin_sessions(expires_at, revoked_at);
    `
  },
  {
    version: 5,
    name: "delivery_dead_letters_and_reconciliation_cases",
    sql: `
      CREATE TABLE IF NOT EXISTS relay_reconciliation_cases (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        instance_id TEXT NOT NULL REFERENCES relay_instances(id) ON DELETE RESTRICT,
        run_id TEXT NOT NULL REFERENCES relay_runs(id) ON DELETE RESTRICT,
        item_id TEXT NOT NULL REFERENCES relay_items(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        reason_code TEXT NOT NULL DEFAULT '',
        reason_message TEXT NOT NULL DEFAULT '',
        opened_by TEXT NOT NULL DEFAULT 'worker',
        opened_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolution TEXT CHECK (resolution IN ('refund', 'confirmed_success', 'retry')),
        resolution_note TEXT NOT NULL DEFAULT '',
        evidence_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_json)),
        resolved_by TEXT,
        resolved_at TEXT
      ) STRICT;

      CREATE INDEX IF NOT EXISTS relay_reconciliation_cases_status_idx
        ON relay_reconciliation_cases(status, updated_at ASC);
      CREATE INDEX IF NOT EXISTS relay_reconciliation_cases_tenant_idx
        ON relay_reconciliation_cases(tenant_id, opened_at DESC);
      CREATE INDEX IF NOT EXISTS relay_reconciliation_cases_item_idx
        ON relay_reconciliation_cases(item_id, opened_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS relay_reconciliation_open_item_idx
        ON relay_reconciliation_cases(item_id)
        WHERE status = 'open';
    `
  },
  {
    version: 6,
    name: "payment_orders_and_invoice_requests",
    sql: `
      -- A payment order is intentionally separate from the immutable credit
      -- ledger.  Creating an order never changes a customer's balance; only
      -- an audited finance confirmation can append its top-up ledger entry.
      CREATE TABLE IF NOT EXISTS relay_payment_orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'pending_payment'
          CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
        payment_channel TEXT NOT NULL
          CHECK (payment_channel IN ('offline_bank', 'wechat_transfer', 'alipay_transfer', 'contract_grant')),
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3),
        credits INTEGER NOT NULL CHECK (credits > 0),
        external_order_reference TEXT NOT NULL DEFAULT '',
        payment_reference TEXT NOT NULL DEFAULT '',
        confirmation_note TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        idempotency_key TEXT,
        ledger_id TEXT REFERENCES relay_billing_ledger(id) ON DELETE RESTRICT,
        created_by TEXT NOT NULL DEFAULT 'operator',
        confirmed_by TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        cancelled_at TEXT,
        cancellation_note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS relay_payment_orders_idempotency_idx
        ON relay_payment_orders(tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS relay_payment_orders_external_reference_idx
        ON relay_payment_orders(tenant_id, external_order_reference)
        WHERE external_order_reference <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS relay_payment_orders_payment_reference_idx
        ON relay_payment_orders(payment_reference)
        WHERE payment_reference <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS relay_payment_orders_ledger_idx
        ON relay_payment_orders(ledger_id)
        WHERE ledger_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS relay_payment_orders_tenant_status_idx
        ON relay_payment_orders(tenant_id, status, created_at DESC);

      -- Invoice recipient details are encrypted with the relay master key.
      -- This stores a request/issuance record, not a fabricated tax invoice;
      -- the legal invoice remains issued by the approved finance system.
      CREATE TABLE IF NOT EXISTS relay_invoice_requests (
        id TEXT PRIMARY KEY,
        payment_order_id TEXT NOT NULL REFERENCES relay_payment_orders(id) ON DELETE RESTRICT,
        tenant_id TEXT NOT NULL REFERENCES relay_tenants(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'requested'
          CHECK (status IN ('requested', 'issued', 'voided')),
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3),
        billing_title TEXT NOT NULL,
        billing_envelope_json TEXT NOT NULL CHECK (json_valid(billing_envelope_json)),
        invoice_number TEXT NOT NULL DEFAULT '',
        issue_note TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
        idempotency_key TEXT,
        requested_by TEXT NOT NULL DEFAULT 'operator',
        requested_at TEXT NOT NULL,
        issued_by TEXT,
        issued_at TEXT,
        voided_by TEXT,
        voided_at TEXT,
        void_note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS relay_invoice_requests_payment_order_idx
        ON relay_invoice_requests(payment_order_id);
      CREATE UNIQUE INDEX IF NOT EXISTS relay_invoice_requests_idempotency_idx
        ON relay_invoice_requests(tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS relay_invoice_requests_number_idx
        ON relay_invoice_requests(invoice_number)
        WHERE invoice_number <> '';
      CREATE INDEX IF NOT EXISTS relay_invoice_requests_tenant_status_idx
        ON relay_invoice_requests(tenant_id, status, requested_at DESC);
    `
  },
  {
    version: 7,
    name: "named_admin_users_rbac_and_mfa",
    sql: `
      CREATE TABLE IF NOT EXISTS relay_admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        normalized_username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_params_json TEXT NOT NULL CHECK (json_valid(password_params_json)),
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'operations', 'finance', 'support', 'auditor')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        mfa_secret_envelope_json TEXT CHECK (mfa_secret_envelope_json IS NULL OR json_valid(mfa_secret_envelope_json)),
        mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0, 1)),
        mfa_enrolled_at TEXT,
        failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
        locked_until TEXT,
        password_changed_at TEXT NOT NULL,
        last_login_at TEXT,
        created_by TEXT NOT NULL DEFAULT 'root_token',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS relay_admin_users_role_status_idx
        ON relay_admin_users(role, status, created_at);

      ALTER TABLE relay_admin_sessions ADD COLUMN admin_user_id TEXT REFERENCES relay_admin_users(id) ON DELETE SET NULL;
      ALTER TABLE relay_admin_sessions ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'root_token'
        CHECK (auth_source IN ('root_token', 'password', 'development_loopback'));
      ALTER TABLE relay_admin_sessions ADD COLUMN operator_label TEXT NOT NULL DEFAULT '';
      ALTER TABLE relay_admin_sessions ADD COLUMN mfa_verified_at TEXT;
      ALTER TABLE relay_admin_sessions ADD COLUMN reauthenticated_at TEXT;

      CREATE INDEX IF NOT EXISTS relay_admin_sessions_user_idx
        ON relay_admin_sessions(admin_user_id, expires_at, revoked_at);
    `
  }
]);

function publicTenant(row, wallet = undefined) {
  if (!row) return null;
  return {
    tenantId: row.id,
    displayName: row.display_name,
    status: row.status,
    metadata: parseJson(row.metadata_json, {}),
    wallet: wallet
      ? {
          availableCredits: Number(wallet.available_credits),
          heldCredits: Number(wallet.held_credits),
          revision: Number(wallet.revision),
          updatedAt: wallet.updated_at
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicAdminSession(row) {
  if (!row) return null;
  return {
    sessionId: row.id,
    role: row.role,
    adminUserId: row.admin_user_id || null,
    username: row.username || "",
    displayName: row.display_name || row.operator_label || "",
    authSource: row.auth_source || "root_token",
    mfaVerified: Boolean(row.mfa_verified_at),
    mfaVerifiedAt: row.mfa_verified_at || null,
    reauthenticatedAt: row.reauthenticated_at || null,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at || null
  };
}

function publicAdminUser(row) {
  if (!row) return null;
  return {
    adminUserId: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    mfaEnabled: Boolean(row.mfa_enabled),
    mfaEnrolledAt: row.mfa_enrolled_at || null,
    failedLoginCount: Number(row.failed_login_count || 0),
    lockedUntil: row.locked_until || null,
    passwordChangedAt: row.password_changed_at,
    lastLoginAt: row.last_login_at || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicInstance(row) {
  if (!row) return null;
  return {
    instanceId: row.id,
    tenantId: row.tenant_id,
    providerAccountId: row.provider_account_id || null,
    displayName: row.display_name,
    clientId: row.client_id,
    secretVersion: Number(row.secret_version),
    status: row.status,
    allowedCapabilities: parseJson(row.allowed_capabilities_json, {}),
    maxInFlight: Number(row.max_in_flight),
    dailyCreditLimit: Number(row.daily_credit_limit),
    monthlyCreditLimit: Number(row.monthly_credit_limit),
    callbackUrl: row.callback_url || "",
    metadata: parseJson(row.metadata_json, {}),
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicProvider(row, options = {}) {
  if (!row) return null;
  const output = {
    providerAccountId: row.id,
    providerCode: row.provider_code,
    displayName: row.display_name,
    status: row.status,
    isDefault: Boolean(row.is_default),
    tokenReference: row.token_reference || "",
    capabilities: parseJson(row.capabilities_json, {}),
    lastKnownBalance: row.last_known_balance === null ? null : Number(row.last_known_balance),
    maxInFlight: Number(row.max_in_flight),
    lastHealthAt: row.last_health_at || null,
    lastHealthStatus: row.last_health_status,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (options.includeSecretEnvelope) output.tokenEnvelope = parseJson(row.token_envelope_json, null);
  return output;
}

function publicPriceRule(row, options = {}) {
  if (!row) return null;
  const output = {
    priceRuleId: row.id,
    providerAccountId: row.provider_account_id,
    platform: row.platform,
    terminal: row.terminal,
    mode: row.mode,
    customerCredits: Number(row.customer_credits),
    version: row.version,
    status: row.status,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (options.includeUpstreamEstimate) output.estimatedUpstreamCredits = Number(row.estimated_upstream_credits);
  return output;
}

function customerPriceSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const items = Array.isArray(source.items) ? source.items : [];
  return {
    ...source,
    items: items.map(({ estimatedUpstreamCredits, ...item }) => item)
  };
}

function publicRun(row, options = {}) {
  if (!row) return null;
  const output = {
    relayRunId: row.id,
    tenantId: row.tenant_id,
    instanceId: row.instance_id,
    providerAccountId: row.provider_account_id,
    clientRunId: row.client_run_id,
    status: row.status,
    billingStatus: row.billing_status,
    projectId: row.project_id,
    questionSetId: row.question_set_id,
    questionSetChecksum: row.question_set_checksum,
    inputSnapshot: parseJson(row.input_snapshot_json, {}),
    capabilitySnapshot: parseJson(row.capability_snapshot_json, {}),
    priceSnapshot: options.includeUpstream === true
      ? parseJson(row.price_snapshot_json, {})
      : customerPriceSnapshot(parseJson(row.price_snapshot_json, {})),
    consent: parseJson(row.consent_json, {}),
    estimatedCustomerCredits: Number(row.estimated_customer_credits),
    heldCustomerCredits: Number(row.held_customer_credits),
    settledCustomerCredits: Number(row.settled_customer_credits),
    totalItems: Number(row.total_items),
    completedItems: Number(row.completed_items),
    failedItems: Number(row.failed_items),
    submittedAt: row.submitted_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at
  };
  if (options.includeRequestHash) output.requestHash = row.request_hash;
  return output;
}

function publicItem(row, options = {}) {
  if (!row) return null;
  const request = parseJson(row.request_json, {});
  const output = {
    relayItemId: row.id,
    relayRunId: row.run_id,
    clientItemId: row.client_item_id,
    questionId: row.question_id,
    ordinal: Number(row.ordinal),
    prompt: request.prompt || "",
    platform: row.platform,
    terminal: row.terminal,
    mode: row.mode,
    status: row.status,
    upstreamReqId: row.upstream_req_id || null,
    customerCredits: Number(row.customer_credits),
    submitAttempts: Number(row.submit_attempts),
    pollAttempts: Number(row.poll_attempts),
    lastError: row.last_error_code ? { code: row.last_error_code, message: row.last_error_message || "" } : null,
    observedAt: row.observed_at || null,
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at
  };
  if (options.includeResult) {
    output.raw = parseJson(row.raw_payload_json, null);
    output.normalized = parseJson(row.normalized_json, null);
    output.normalizerVersion = row.normalizer_version || "";
  }
  if (options.includeUpstream) {
    output.estimatedUpstreamCredits = Number(row.estimated_upstream_credits);
    output.upstreamCredits = Number(row.upstream_credits);
  }
  if (options.reconciliation) output.reconciliation = publicReconciliationCase(options.reconciliation);
  return output;
}

function publicDelivery(row) {
  if (!row) return null;
  return {
    deliveryId: row.id,
    tenantId: row.tenant_id,
    instanceId: row.instance_id,
    relayRunId: row.run_id,
    relayItemId: row.item_id || null,
    deliveryKey: row.delivery_key,
    sequence: Number(row.sequence),
    kind: row.kind,
    status: row.status,
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts || DEFAULT_DELIVERY_MAX_ATTEMPTS),
    availableAt: row.available_at,
    leaseUntil: row.lease_until || null,
    lastError: row.last_error || null,
    acknowledgedAt: row.acknowledged_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicReconciliationCase(row) {
  if (!row) return null;
  return {
    reconciliationId: row.id,
    tenantId: row.tenant_id,
    instanceId: row.instance_id,
    relayRunId: row.run_id,
    relayItemId: row.item_id,
    status: row.status,
    reason: {
      code: row.reason_code || "",
      message: row.reason_message || ""
    },
    openedBy: row.opened_by || "worker",
    openedAt: row.opened_at,
    updatedAt: row.updated_at,
    resolution: row.resolution || null,
    resolutionNote: row.resolution_note || "",
    evidence: parseJson(row.evidence_json, {}),
    resolvedBy: row.resolved_by || null,
    resolvedAt: row.resolved_at || null
  };
}

function maskedReference(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 4) return "****";
  return `${"*".repeat(Math.min(12, Math.max(4, text.length - 4)))}${text.slice(-4)}`;
}

function publicPaymentOrder(row) {
  if (!row) return null;
  return {
    paymentOrderId: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    paymentChannel: row.payment_channel,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    credits: Number(row.credits),
    externalOrderReference: row.external_order_reference || "",
    paymentReferenceMasked: maskedReference(row.payment_reference),
    confirmationNote: row.confirmation_note || "",
    ledgerId: row.ledger_id || null,
    createdBy: row.created_by || "operator",
    confirmedBy: row.confirmed_by || null,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at || null,
    cancelledAt: row.cancelled_at || null,
    cancellationNote: row.cancellation_note || "",
    updatedAt: row.updated_at
  };
}

function publicInvoiceRequest(row, options = {}) {
  if (!row) return null;
  const output = {
    invoiceRequestId: row.id,
    paymentOrderId: row.payment_order_id,
    tenantId: row.tenant_id,
    status: row.status,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    billingTitle: row.billing_title,
    invoiceNumber: row.invoice_number || "",
    issueNote: row.issue_note || "",
    requestedBy: row.requested_by || "operator",
    requestedAt: row.requested_at,
    issuedBy: row.issued_by || null,
    issuedAt: row.issued_at || null,
    voidedBy: row.voided_by || null,
    voidedAt: row.voided_at || null,
    voidNote: row.void_note || "",
    updatedAt: row.updated_at
  };
  if (options.includeBilling === true) {
    const secretBox = options.secretBox;
    if (!secretBox) throw new TypeError("publicInvoiceRequest requires a secretBox when including billing details.");
    output.billing = parseJson(secretBox.decrypt(parseJson(row.billing_envelope_json, null), `invoice:${row.id}:billing`), {});
  }
  return output;
}

function allowsCapability(policy, item) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return true;
  const platform = item.platform;
  const terminal = item.terminal;
  const mode = item.mode;
  const allowedPlatforms = Array.isArray(policy.allowedPlatforms) ? policy.allowedPlatforms.map(String) : [];
  if (allowedPlatforms.length && !allowedPlatforms.includes(platform)) return false;
  const tuples = Array.isArray(policy.items) ? policy.items : Array.isArray(policy.allowedItems) ? policy.allowedItems : [];
  if (!tuples.length) return true;
  return tuples.some((tuple) => {
    if (!tuple || typeof tuple !== "object") return false;
    return (!tuple.platform || String(tuple.platform) === platform)
      && (!tuple.terminal || String(tuple.terminal) === terminal)
      && (!tuple.mode || String(tuple.mode) === mode);
  });
}

function providerSupportsCapability(snapshot, item) {
  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
  // Older development fixtures did not carry a platforms field. Keep those
  // fixtures compatible while requiring every modern/production snapshot that
  // declares platforms to contain the exact tuple being priced.
  if (!Object.hasOwn(source, "platforms")) return true;
  const platforms = Array.isArray(source.platforms) ? source.platforms : [];
  return platforms.some((platform) => {
    if (!platform || String(platform.code || "").trim() !== String(item.platform || "").trim()) return false;
    const terminals = Array.isArray(platform.terminals) ? platform.terminals.map(String) : [];
    const modes = Array.isArray(platform.modes) ? platform.modes.map(String) : [];
    return terminals.includes(String(item.terminal || "")) && modes.includes(String(item.mode || ""));
  });
}

function sanitizeError(error) {
  const code = optionalText(error?.code || "RELAY_PROVIDER_ERROR", 120) || "RELAY_PROVIDER_ERROR";
  const message = optionalText(error?.message || "上游服务调用失败。", 1_000) || "上游服务调用失败。";
  return { code, message };
}

export class RelayStore {
  constructor(options = {}) {
    this.databasePath = resolveRelayDatabasePath(options);
    this.busyTimeoutMs = positiveInteger(options.busyTimeoutMs ?? process.env.TZ_RELAY_DATABASE_BUSY_TIMEOUT_MS, DEFAULT_BUSY_TIMEOUT_MS, 60_000);
    this.deliveryMaxAttempts = positiveInteger(options.deliveryMaxAttempts ?? process.env.TZ_RELAY_DELIVERY_MAX_ATTEMPTS, DEFAULT_DELIVERY_MAX_ATTEMPTS, 1_000);
    this.isMemoryDatabase = this.databasePath === ":memory:";
    this.dataDir = this.isMemoryDatabase ? path.resolve(options.dataDir || path.join(moduleRoot, "data")) : path.dirname(this.databasePath);
    if (!this.isMemoryDatabase) mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.closed = false;
    this.configure();
    this.secretBox = options.secretBox || new RelaySecretBox({
      masterKey: options.masterKey,
      environmentValue: options.environmentValue,
      dataDir: options.dataDir || process.env.TZ_RELAY_DATA_DIR || this.dataDir,
      keyPath: options.keyPath
    });
    if (options.runMigrations !== false) this.migrate();
    if (!this.isMemoryDatabase) bestEffortPrivateMode(this.databasePath);
  }

  configure() {
    this.db.exec(`PRAGMA busy_timeout = ${this.busyTimeoutMs}`);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    // Customer credit holds, settlements and releases are financial records.
    // WAL + FULL asks SQLite to synchronise both the journal and database at
    // commit boundaries, trading a small amount of write latency for durable
    // acknowledged accounting state after host power loss.
    this.db.exec("PRAGMA synchronous = FULL");
    const foreignKeys = Number(this.db.prepare("PRAGMA foreign_keys").get()?.foreign_keys || 0);
    const journalMode = String(this.db.prepare("PRAGMA journal_mode").get()?.journal_mode || "").toLowerCase();
    const synchronous = Number(this.db.prepare("PRAGMA synchronous").get()?.synchronous ?? -1);
    if (foreignKeys !== 1 || (!this.isMemoryDatabase && journalMode !== "wal") || synchronous !== 2) {
      throw relayError("RELAY_DATABASE_CONFIGURATION", "无法启用 SQLite WAL、FULL 同步或外键约束。", { statusCode: 500 });
    }
  }

  /**
   * Return only non-sensitive local database readiness facts. The HTTP layer
   * uses this before advertising readiness, so a closed or unusable SQLite
   * handle cannot look healthy merely because the Node process is listening.
   */
  getDatabaseHealth() {
    if (this.closed) return { ready: false, code: "RELAY_DATABASE_CLOSED" };
    try {
      const probe = this.db.prepare("SELECT 1 AS ok").get();
      const foreignKeys = Number(this.db.prepare("PRAGMA foreign_keys").get()?.foreign_keys || 0);
      const journalMode = String(this.db.prepare("PRAGMA journal_mode").get()?.journal_mode || "").toLowerCase();
      const synchronous = Number(this.db.prepare("PRAGMA synchronous").get()?.synchronous ?? -1);
      const ready = Number(probe?.ok) === 1
        && foreignKeys === 1
        && (this.isMemoryDatabase || journalMode === "wal")
        && synchronous === 2;
      return {
        ready,
        code: ready ? "OK" : "RELAY_DATABASE_CONFIGURATION",
        journalMode,
        synchronous: synchronous === 2 ? "full" : String(synchronous),
        foreignKeys: foreignKeys === 1
      };
    } catch {
      return { ready: false, code: "RELAY_DATABASE_UNAVAILABLE" };
    }
  }

  /**
   * A production database must never silently inherit the development seed.
   * We deliberately refuse startup instead of deleting a customer-like tenant
   * or its immutable financial history automatically.
   */
  getDemoDataSummary() {
    const tenant = this.db.prepare(`
      SELECT COUNT(*) AS count FROM relay_tenants
      WHERE id = 'tenant_demo_jingjin' OR json_extract(metadata_json, '$.demo') = 1
    `).get();
    const instance = this.db.prepare(`
      SELECT COUNT(*) AS count FROM relay_instances
      WHERE id = 'instance_demo_jingjin_prod' OR json_extract(metadata_json, '$.demo') = 1
    `).get();
    const pricing = this.db.prepare(`
      SELECT COUNT(*) AS count FROM relay_price_rules
      WHERE json_extract(metadata_json, '$.source') IN ('development-price-book', 'central-price-book')
    `).get();
    const capabilities = this.db.prepare(`
      SELECT COUNT(*) AS count FROM relay_provider_accounts
      WHERE json_extract(capabilities_json, '$.source') = 'development-capability-book'
    `).get();
    return {
      tenants: Number(tenant?.count || 0),
      instances: Number(instance?.count || 0),
      developmentPriceRules: Number(pricing?.count || 0),
      developmentCapabilitySnapshots: Number(capabilities?.count || 0),
      present: Number(tenant?.count || 0) > 0
        || Number(instance?.count || 0) > 0
        || Number(pricing?.count || 0) > 0
        || Number(capabilities?.count || 0) > 0
    };
  }

  assertNoDemoData() {
    const summary = this.getDemoDataSummary();
    if (summary.present) {
      throw relayError("RELAY_DEMO_DATA_PRESENT", "生产数据库包含本地演示租户、实例或开发价格/能力数据；请使用新的生产数据库，或按已审批的数据迁移流程清除演示数据。", {
        statusCode: 500,
        details: summary
      });
    }
    return summary;
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relay_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const applied = this.db.prepare("SELECT 1 FROM relay_schema_migrations WHERE version = ?");
    const record = this.db.prepare("INSERT INTO relay_schema_migrations(version, name, applied_at) VALUES (?, ?, ?)");
    for (const migration of MIGRATIONS) {
      if (applied.get(migration.version)) continue;
      this.transaction(() => {
        this.db.exec(migration.sql);
        record.run(migration.version, migration.name, nowIso());
      });
    }
  }

  transaction(callback, mode = "IMMEDIATE") {
    if (this.closed) throw relayError("RELAY_DATABASE_CLOSED", "中转站数据库已经关闭。", { statusCode: 500 });
    const normalizedMode = String(mode || "IMMEDIATE").toUpperCase();
    if (!["DEFERRED", "IMMEDIATE", "EXCLUSIVE"].includes(normalizedMode)) throw new TypeError("Unsupported SQLite transaction mode.");
    this.db.exec(`BEGIN ${normalizedMode}`);
    try {
      const result = callback(this.db);
      if (result && typeof result.then === "function") throw new TypeError("RelayStore transactions must be synchronous.");
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
  }

  checkpoint(mode = "PASSIVE") {
    const normalizedMode = String(mode || "PASSIVE").toUpperCase();
    if (!["PASSIVE", "FULL", "RESTART", "TRUNCATE"].includes(normalizedMode)) throw new TypeError("Unsupported SQLite checkpoint mode.");
    return this.db.prepare(`PRAGMA wal_checkpoint(${normalizedMode})`).get();
  }

  close() {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }

  _audit(connection, values) {
    connection.prepare(`
      INSERT INTO relay_audit_events(id, tenant_id, instance_id, actor_type, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomId("audit"),
      values.tenantId || null,
      values.instanceId || null,
      values.actorType || "system",
      cleanText(values.action, "审计动作", { maximum: 120 }),
      cleanText(values.entityType, "审计实体", { maximum: 120 }),
      optionalText(values.entityId, 256),
      safeJson(values.details || {}),
      values.createdAt || nowIso()
    );
  }

  _openReconciliationCase(connection, item, options = {}) {
    const timestamp = nowIso(options.now);
    const existing = connection.prepare(`
      SELECT * FROM relay_reconciliation_cases
      WHERE item_id = ? AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
    `).get(item.id);
    const reasonCode = optionalText(options.reasonCode || item.last_error_code || "RELAY_SUBMISSION_UNCERTAIN", 120);
    const reasonMessage = optionalText(options.reasonMessage || item.last_error_message || "上游提交状态不确定，等待人工核验。", 2_000);
    if (existing) {
      connection.prepare(`
        UPDATE relay_reconciliation_cases
        SET reason_code = ?, reason_message = ?, updated_at = ?
        WHERE id = ?
      `).run(reasonCode, reasonMessage, timestamp, existing.id);
      return connection.prepare("SELECT * FROM relay_reconciliation_cases WHERE id = ?").get(existing.id);
    }
    const caseId = randomId("reconcile");
    connection.prepare(`
      INSERT INTO relay_reconciliation_cases(
        id, tenant_id, instance_id, run_id, item_id, status,
        reason_code, reason_message, opened_by, opened_at, updated_at,
        evidence_json
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).run(
      caseId,
      item.tenant_id,
      item.instance_id,
      item.run_id,
      item.id,
      reasonCode,
      reasonMessage,
      optionalText(options.actorType || "worker", 120) || "worker",
      timestamp,
      timestamp,
      safeJson(options.evidence || {})
    );
    this._audit(connection, {
      tenantId: item.tenant_id,
      instanceId: item.instance_id,
      actorType: options.actorType || "worker",
      action: "reconciliation.opened",
      entityType: "reconciliation_case",
      entityId: caseId,
      details: { relayItemId: item.id, relayRunId: item.run_id, reasonCode },
      createdAt: timestamp
    });
    return connection.prepare("SELECT * FROM relay_reconciliation_cases WHERE id = ?").get(caseId);
  }

  _latestReconciliationCase(connection, itemId, options = {}) {
    const onlyOpen = options.onlyOpen === true;
    return connection.prepare(`
      SELECT * FROM relay_reconciliation_cases
      WHERE item_id = ? ${onlyOpen ? "AND status = 'open'" : ""}
      ORDER BY opened_at DESC
      LIMIT 1
    `).get(itemId) || null;
  }

  _resolveReconciliationCase(connection, caseRow, input = {}) {
    if (!caseRow) return null;
    const timestamp = nowIso(input.now);
    const resolution = cleanText(input.resolution, "对账处理方式", { maximum: 32 }).toLowerCase();
    if (!RECONCILIATION_RESOLUTIONS.has(resolution)) {
      throw relayError("RELAY_RECONCILIATION_UNSUPPORTED", "不支持的人工对账处理方式。", { statusCode: 422 });
    }
    const note = optionalText(input.note, 2_000);
    const resolutionEvidence = input.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence) ? input.evidence : {};
    const evidence = {
      opened: parseJson(caseRow.evidence_json, {}),
      resolution: resolutionEvidence
    };
    connection.prepare(`
      UPDATE relay_reconciliation_cases
      SET status = 'resolved', resolution = ?, resolution_note = ?, evidence_json = ?,
          resolved_by = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND status = 'open'
    `).run(
      resolution,
      note,
      safeJson(evidence),
      optionalText(input.actorType || "operator", 120) || "operator",
      timestamp,
      timestamp,
      caseRow.id
    );
    const resolved = connection.prepare("SELECT * FROM relay_reconciliation_cases WHERE id = ?").get(caseRow.id);
    this._audit(connection, {
      tenantId: caseRow.tenant_id,
      instanceId: caseRow.instance_id,
      actorType: optionalText(input.actorType || "operator", 120) || "operator",
      action: "reconciliation.resolved",
      entityType: "reconciliation_case",
      entityId: caseRow.id,
      details: { relayItemId: caseRow.item_id, relayRunId: caseRow.run_id, resolution },
      createdAt: timestamp
    });
    return resolved;
  }

  /**
   * Creates an opaque administrator session. The browser receives the opaque
   * value only through an HttpOnly cookie; SQLite keeps a one-way digest, so a
   * database backup cannot be used as an active administrator session.
   */
  createAdminSession(input = {}) {
    const ttlSeconds = positiveInteger(input.ttlSeconds, 3_600, 86_400);
    const timestamp = nowIso(input.now);
    const expiresAt = new Date(new Date(timestamp).valueOf() + ttlSeconds * 1_000).toISOString();
    const sessionId = randomId("admin_session");
    const sessionSecret = crypto.randomBytes(32).toString("base64url");
    const sessionToken = `${sessionId}.${sessionSecret}`;
    const remoteAddress = optionalText(input.remoteAddress, 256);
    const userAgent = optionalText(input.userAgent, 1_000);
    const actorLabel = optionalText(input.actorLabel, 120);
    const role = cleanText(input.role || "operator", "管理员角色", { maximum: 80 });
    const adminUserId = optionalText(input.adminUserId, 128) || null;
    const authSource = ["root_token", "password", "development_loopback"].includes(input.authSource) ? input.authSource : (adminUserId ? "password" : "root_token");
    const mfaVerifiedAt = input.mfaVerified ? timestamp : (input.mfaVerifiedAt ? nowIso(input.mfaVerifiedAt) : null);
    const reauthenticatedAt = input.reauthenticated === false ? null : timestamp;
    const session = this.transaction((connection) => {
      connection.prepare("DELETE FROM relay_admin_sessions WHERE expires_at <= ?").run(timestamp);
      if (adminUserId && !connection.prepare("SELECT 1 FROM relay_admin_users WHERE id = ? AND status = 'active'").get(adminUserId)) {
        throw relayError("RELAY_ADMIN_USER_UNAVAILABLE", "管理员账号不存在或已停用。", { statusCode: 403 });
      }
      connection.prepare(`
        INSERT INTO relay_admin_sessions(
          id, token_hash, role, issued_at, expires_at, last_seen_at,
          remote_address, user_agent, admin_user_id, auth_source,
          operator_label, mfa_verified_at, reauthenticated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        digestText(sessionSecret),
        role,
        timestamp,
        expiresAt,
        timestamp,
        remoteAddress,
        userAgent,
        adminUserId,
        authSource,
        actorLabel,
        mfaVerifiedAt,
        reauthenticatedAt
      );
      const row = connection.prepare(`
        SELECT s.*, u.username, u.display_name
        FROM relay_admin_sessions s
        LEFT JOIN relay_admin_users u ON u.id = s.admin_user_id
        WHERE s.id = ?
      `).get(sessionId);
      this._audit(connection, {
        actorType: adminUserId ? `admin_user:${adminUserId}` : "operator_session",
        action: "admin.session_created",
        entityType: "admin_session",
        entityId: sessionId,
        details: { role, expiresAt, remoteAddress, actorLabel: actorLabel || undefined, authSource, mfaVerified: Boolean(mfaVerifiedAt), adminUserId }
      });
      return publicAdminSession(row);
    });
    return { sessionToken, session };
  }

  _parseAdminSessionToken(value) {
    const token = String(value || "").trim();
    const separator = token.indexOf(".");
    if (separator < 1 || separator === token.length - 1 || token.length > 1_024) return null;
    const sessionId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    if (!/^admin_session_[A-Za-z0-9_-]{16,}$/.test(sessionId) || !/^[A-Za-z0-9_-]{32,}$/.test(secret)) return null;
    return { sessionId, secret };
  }

  authenticateAdminSession(sessionToken, options = {}) {
    const parsed = this._parseAdminSessionToken(sessionToken);
    if (!parsed) return null;
    const timestamp = nowIso(options.now);
    const row = this.db.prepare(`
      SELECT s.*, u.username, u.display_name, u.status AS admin_user_status, u.role AS admin_user_role
      FROM relay_admin_sessions s
      LEFT JOIN relay_admin_users u ON u.id = s.admin_user_id
      WHERE s.id = ?
    `).get(parsed.sessionId);
    if (!row || row.revoked_at || row.expires_at <= timestamp || !timingSafeTextEqual(row.token_hash, digestText(parsed.secret))) return null;
    if (row.admin_user_id && (row.admin_user_status !== "active" || row.admin_user_role !== row.role)) return null;

    // Avoid turning every authenticated API read into a SQLite write while
    // retaining enough activity information for an operator session audit.
    const lastSeen = Date.parse(row.last_seen_at || "");
    if (!Number.isFinite(lastSeen) || Date.parse(timestamp) - lastSeen >= 60_000) {
      this.db.prepare("UPDATE relay_admin_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL").run(timestamp, row.id);
      row.last_seen_at = timestamp;
    }
    return publicAdminSession(row);
  }

  markAdminSessionMfaVerified(sessionToken, options = {}) {
    const parsed = this._parseAdminSessionToken(sessionToken);
    if (!parsed) return null;
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const row = connection.prepare("SELECT * FROM relay_admin_sessions WHERE id = ?").get(parsed.sessionId);
      if (!row || row.revoked_at || row.expires_at <= timestamp || !row.admin_user_id || !timingSafeTextEqual(row.token_hash, digestText(parsed.secret))) return null;
      connection.prepare("UPDATE relay_admin_sessions SET mfa_verified_at = ?, reauthenticated_at = ?, last_seen_at = ? WHERE id = ?").run(timestamp, timestamp, timestamp, row.id);
      return publicAdminSession(connection.prepare(`
        SELECT s.*, u.username, u.display_name
        FROM relay_admin_sessions s
        LEFT JOIN relay_admin_users u ON u.id = s.admin_user_id
        WHERE s.id = ?
      `).get(row.id));
    });
  }

  revokeAdminSession(sessionToken, options = {}) {
    const parsed = this._parseAdminSessionToken(sessionToken);
    if (!parsed) return null;
    const timestamp = nowIso(options.now);
    const reason = optionalText(options.reason || "operator_logout", 240) || "operator_logout";
    const actorType = optionalText(options.actorType || "operator_session", 120) || "operator_session";
    return this.transaction((connection) => {
      const row = connection.prepare(`
        SELECT s.*, u.username, u.display_name
        FROM relay_admin_sessions s
        LEFT JOIN relay_admin_users u ON u.id = s.admin_user_id
        WHERE s.id = ?
      `).get(parsed.sessionId);
      if (!row || !timingSafeTextEqual(row.token_hash, digestText(parsed.secret))) return null;
      if (!row.revoked_at) {
        connection.prepare(`
          UPDATE relay_admin_sessions
          SET revoked_at = ?, revoked_reason = ?, last_seen_at = ?
          WHERE id = ?
        `).run(timestamp, reason, timestamp, row.id);
        this._audit(connection, {
          actorType,
          action: "admin.session_revoked",
          entityType: "admin_session",
          entityId: row.id,
          details: { reason }
        });
      }
      return publicAdminSession({ ...row, revoked_at: row.revoked_at || timestamp, revoked_reason: row.revoked_reason || reason, last_seen_at: timestamp });
    });
  }

  revokeActiveAdminSessions(options = {}) {
    const timestamp = nowIso(options.now);
    const reason = optionalText(options.reason || "service_restart", 240) || "service_restart";
    const actorType = optionalText(options.actorType || "system", 120) || "system";
    return this.transaction((connection) => {
      const changed = connection.prepare(`
        UPDATE relay_admin_sessions
        SET revoked_at = ?, revoked_reason = ?, last_seen_at = ?
        WHERE revoked_at IS NULL AND expires_at > ?
      `).run(timestamp, reason, timestamp, timestamp);
      if (changed.changes) {
        this._audit(connection, {
          actorType,
          action: "admin.sessions_revoked",
          entityType: "admin_session_batch",
          entityId: "active",
          details: { reason, count: Number(changed.changes) }
        });
      }
      return Number(changed.changes || 0);
    });
  }

  countAdminUsers() {
    return Number(this.db.prepare("SELECT COUNT(*) AS count FROM relay_admin_users").get()?.count || 0);
  }

  listAdminUsers(options = {}) {
    const limit = positiveInteger(options.limit, 200, 1_000);
    return this.db.prepare("SELECT * FROM relay_admin_users ORDER BY created_at ASC LIMIT ?").all(limit).map(publicAdminUser);
  }

  getAdminUser(id) {
    return publicAdminUser(this.db.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(cleanText(id, "管理员 ID", { maximum: 128 })));
  }

  createAdminUser(input = {}) {
    const normalizedUsername = normalizeAdminUsername(input.username);
    const displayName = cleanText(input.displayName || input.name || input.username, "管理员姓名", { maximum: 120 });
    const role = cleanText(input.role || "auditor", "管理员角色", { maximum: 80 });
    if (!ADMIN_ROLES.has(role)) throw relayError("RELAY_ADMIN_ROLE_INVALID", "不支持的管理员角色。", { statusCode: 422 });
    const status = cleanText(input.status || "active", "管理员状态", { maximum: 32 });
    if (!ADMIN_STATUSES.has(status)) throw relayError("RELAY_ADMIN_STATUS_INVALID", "不支持的管理员状态。", { statusCode: 422 });
    const password = hashAdminPassword(input.password);
    const timestamp = nowIso(input.now);
    const adminUserId = optionalText(input.adminUserId || input.id, 128) || randomId("admin_user");
    const createdBy = optionalText(input.createdBy || input.actorType || "root_token", 120) || "root_token";
    return this.transaction((connection) => {
      if (connection.prepare("SELECT 1 FROM relay_admin_users WHERE normalized_username = ?").get(normalizedUsername)) {
        throw relayError("RELAY_ADMIN_USER_EXISTS", "管理员账号已存在。", { statusCode: 409 });
      }
      connection.prepare(`
        INSERT INTO relay_admin_users(
          id, username, normalized_username, display_name,
          password_salt, password_hash, password_params_json,
          role, status, password_changed_at, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        adminUserId,
        normalizedUsername,
        normalizedUsername,
        displayName,
        password.salt,
        password.hash,
        safeJson(password.params),
        role,
        status,
        timestamp,
        createdBy,
        timestamp,
        timestamp
      );
      this._audit(connection, {
        actorType: createdBy,
        action: "admin.user_created",
        entityType: "admin_user",
        entityId: adminUserId,
        details: { username: normalizedUsername, role, status },
        createdAt: timestamp
      });
      return publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId));
    });
  }

  authenticateAdminCredentials(input = {}) {
    let normalizedUsername = "";
    try {
      normalizedUsername = normalizeAdminUsername(input.username);
    } catch {
      verifyAdminPassword(input.password, ADMIN_DUMMY_PASSWORD_RECORD);
      throw relayError("RELAY_ADMIN_LOGIN_FAILED", "管理员账号或密码不正确。", { statusCode: 401 });
    }
    const timestamp = nowIso(input.now);
    const timestampMs = new Date(timestamp).valueOf();
    const row = this.db.prepare("SELECT * FROM relay_admin_users WHERE normalized_username = ?").get(normalizedUsername);
    if (!row) {
      verifyAdminPassword(input.password, ADMIN_DUMMY_PASSWORD_RECORD);
      throw relayError("RELAY_ADMIN_LOGIN_FAILED", "管理员账号或密码不正确。", { statusCode: 401 });
    }
    if (row.status !== "active") throw relayError("RELAY_ADMIN_LOGIN_FAILED", "管理员账号或密码不正确。", { statusCode: 401 });
    if (row.locked_until && new Date(row.locked_until).valueOf() > timestampMs) {
      throw relayError("RELAY_ADMIN_ACCOUNT_LOCKED", "管理员账号已临时锁定，请稍后再试。", { statusCode: 423, details: { lockedUntil: row.locked_until } });
    }
    const recordFailure = (code = "RELAY_ADMIN_LOGIN_FAILED", message = "管理员账号或密码不正确。") => {
      this.transaction((connection) => {
        const failures = Number(row.failed_login_count || 0) + 1;
        const lockedUntil = failures >= ADMIN_LOGIN_MAX_FAILURES ? new Date(timestampMs + ADMIN_LOGIN_LOCK_MS).toISOString() : null;
        connection.prepare("UPDATE relay_admin_users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?").run(failures, lockedUntil, timestamp, row.id);
        this._audit(connection, {
          actorType: `admin_login:${row.id}`,
          action: "admin.login_failed",
          entityType: "admin_user",
          entityId: row.id,
          details: { failures, lockedUntil, reason: code },
          createdAt: timestamp
        });
      });
      throw relayError(code, message, { statusCode: 401 });
    };
    if (!verifyAdminPassword(input.password, row)) recordFailure();
    let mfaVerified = false;
    if (row.mfa_enabled) {
      const secret = this.secretBox.decrypt(parseJson(row.mfa_secret_envelope_json, null), `admin-mfa:${row.id}`);
      if (!String(input.totp || "").trim()) {
        throw relayError("RELAY_ADMIN_MFA_REQUIRED", "请输入身份验证器中的 6 位动态验证码。", { statusCode: 401, details: { mfaRequired: true } });
      }
      if (!verifyTotp(secret, input.totp, timestampMs)) recordFailure("RELAY_ADMIN_MFA_INVALID", "动态验证码不正确或已过期。");
      mfaVerified = true;
    }
    return this.transaction((connection) => {
      connection.prepare("UPDATE relay_admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, row.id);
      this._audit(connection, {
        actorType: `admin_user:${row.id}`,
        action: "admin.login_succeeded",
        entityType: "admin_user",
        entityId: row.id,
        details: { mfaVerified },
        createdAt: timestamp
      });
      return {
        user: publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(row.id)),
        mfaVerified
      };
    });
  }

  updateAdminUser(id, input = {}, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || "super_admin", 120) || "super_admin";
    return this.transaction((connection) => {
      const current = connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId);
      if (!current) throw relayError("RELAY_ADMIN_USER_NOT_FOUND", "管理员账号不存在。", { statusCode: 404 });
      const displayName = input.displayName === undefined ? current.display_name : cleanText(input.displayName, "管理员姓名", { maximum: 120 });
      const role = input.role === undefined ? current.role : cleanText(input.role, "管理员角色", { maximum: 80 });
      const status = input.status === undefined ? current.status : cleanText(input.status, "管理员状态", { maximum: 32 });
      if (!ADMIN_ROLES.has(role)) throw relayError("RELAY_ADMIN_ROLE_INVALID", "不支持的管理员角色。", { statusCode: 422 });
      if (!ADMIN_STATUSES.has(status)) throw relayError("RELAY_ADMIN_STATUS_INVALID", "不支持的管理员状态。", { statusCode: 422 });
      if (current.role === "super_admin" && current.status === "active" && (role !== "super_admin" || status !== "active")) {
        const activeSuperAdmins = Number(connection.prepare("SELECT COUNT(*) AS count FROM relay_admin_users WHERE role = 'super_admin' AND status = 'active'").get()?.count || 0);
        if (activeSuperAdmins <= 1) throw relayError("RELAY_ADMIN_LAST_SUPER_ADMIN", "不能停用或降级最后一个超级管理员。", { statusCode: 409 });
      }
      connection.prepare("UPDATE relay_admin_users SET display_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?").run(displayName, role, status, timestamp, adminUserId);
      if (role !== current.role || status !== current.status) {
        connection.prepare("UPDATE relay_admin_sessions SET revoked_at = ?, revoked_reason = ?, last_seen_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL").run(timestamp, "admin_user_changed", timestamp, adminUserId);
      }
      this._audit(connection, {
        actorType,
        action: "admin.user_updated",
        entityType: "admin_user",
        entityId: adminUserId,
        details: { displayName, role, status },
        createdAt: timestamp
      });
      return publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId));
    });
  }

  resetAdminPassword(id, passwordValue, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const password = hashAdminPassword(passwordValue);
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || "super_admin", 120) || "super_admin";
    return this.transaction((connection) => {
      const current = connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId);
      if (!current) throw relayError("RELAY_ADMIN_USER_NOT_FOUND", "管理员账号不存在。", { statusCode: 404 });
      connection.prepare(`
        UPDATE relay_admin_users
        SET password_salt = ?, password_hash = ?, password_params_json = ?,
            password_changed_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(password.salt, password.hash, safeJson(password.params), timestamp, timestamp, adminUserId);
      connection.prepare("UPDATE relay_admin_sessions SET revoked_at = ?, revoked_reason = ?, last_seen_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL").run(timestamp, "password_reset", timestamp, adminUserId);
      this._audit(connection, { actorType, action: "admin.password_reset", entityType: "admin_user", entityId: adminUserId, details: {}, createdAt: timestamp });
      return publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId));
    });
  }

  beginAdminMfaEnrollment(id, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || `admin_user:${adminUserId}`, 120) || `admin_user:${adminUserId}`;
    return this.transaction((connection) => {
      const row = connection.prepare("SELECT * FROM relay_admin_users WHERE id = ? AND status = 'active'").get(adminUserId);
      if (!row) throw relayError("RELAY_ADMIN_USER_NOT_FOUND", "管理员账号不存在或已停用。", { statusCode: 404 });
      if (row.mfa_enabled) throw relayError("RELAY_ADMIN_MFA_ALREADY_ENABLED", "该管理员已启用多因素认证。", { statusCode: 409 });
      const secret = encodeBase32(crypto.randomBytes(20));
      const envelope = this.secretBox.encrypt(secret, `admin-mfa:${adminUserId}`);
      connection.prepare("UPDATE relay_admin_users SET mfa_secret_envelope_json = ?, updated_at = ? WHERE id = ?").run(safeJson(envelope), timestamp, adminUserId);
      this._audit(connection, { actorType, action: "admin.mfa_enrollment_started", entityType: "admin_user", entityId: adminUserId, details: {}, createdAt: timestamp });
      const issuer = optionalText(options.issuer || "Tongzhuo GEO Relay", 120) || "Tongzhuo GEO Relay";
      const label = `${issuer}:${row.username}`;
      return {
        secret,
        otpauthUri: `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
      };
    });
  }

  confirmAdminMfaEnrollment(id, code, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || `admin_user:${adminUserId}`, 120) || `admin_user:${adminUserId}`;
    return this.transaction((connection) => {
      const row = connection.prepare("SELECT * FROM relay_admin_users WHERE id = ? AND status = 'active'").get(adminUserId);
      if (!row || !row.mfa_secret_envelope_json) throw relayError("RELAY_ADMIN_MFA_NOT_ENROLLED", "请先生成多因素认证密钥。", { statusCode: 409 });
      const secret = this.secretBox.decrypt(parseJson(row.mfa_secret_envelope_json, null), `admin-mfa:${adminUserId}`);
      if (!verifyTotp(secret, code, new Date(timestamp).valueOf())) throw relayError("RELAY_ADMIN_MFA_INVALID", "动态验证码不正确或已过期。", { statusCode: 422 });
      connection.prepare("UPDATE relay_admin_users SET mfa_enabled = 1, mfa_enrolled_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, adminUserId);
      this._audit(connection, { actorType, action: "admin.mfa_enabled", entityType: "admin_user", entityId: adminUserId, details: {}, createdAt: timestamp });
      return publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId));
    });
  }

  disableAdminMfa(id, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || "super_admin", 120) || "super_admin";
    return this.transaction((connection) => {
      const row = connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId);
      if (!row) throw relayError("RELAY_ADMIN_USER_NOT_FOUND", "管理员账号不存在。", { statusCode: 404 });
      connection.prepare("UPDATE relay_admin_users SET mfa_enabled = 0, mfa_secret_envelope_json = NULL, mfa_enrolled_at = NULL, updated_at = ? WHERE id = ?").run(timestamp, adminUserId);
      connection.prepare("UPDATE relay_admin_sessions SET revoked_at = ?, revoked_reason = ?, last_seen_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL").run(timestamp, "mfa_disabled", timestamp, adminUserId);
      this._audit(connection, { actorType, action: "admin.mfa_disabled", entityType: "admin_user", entityId: adminUserId, details: {}, createdAt: timestamp });
      return publicAdminUser(connection.prepare("SELECT * FROM relay_admin_users WHERE id = ?").get(adminUserId));
    });
  }

  revokeAdminUserSessions(id, options = {}) {
    const adminUserId = cleanText(id, "管理员 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const actorType = optionalText(options.actorType || "super_admin", 120) || "super_admin";
    const reason = optionalText(options.reason || "administrator_revoked", 240) || "administrator_revoked";
    return this.transaction((connection) => {
      const changed = connection.prepare("UPDATE relay_admin_sessions SET revoked_at = ?, revoked_reason = ?, last_seen_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL").run(timestamp, reason, timestamp, adminUserId);
      this._audit(connection, { actorType, action: "admin.user_sessions_revoked", entityType: "admin_user", entityId: adminUserId, details: { reason, count: Number(changed.changes || 0) }, createdAt: timestamp });
      return Number(changed.changes || 0);
    });
  }

  createTenant(input = {}) {
    const tenantId = optionalText(input.tenantId || input.id, 128) || randomId("tenant");
    const displayName = cleanText(input.displayName || input.name, "客户名称", { maximum: 240 });
    const initialCredits = nonNegativeInteger(input.initialCredits, 0, 1_000_000_000);
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const existing = connection.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(tenantId);
      if (existing) throw relayError("RELAY_CONFLICT", "客户租户 ID 已存在。", { statusCode: 409 });
      connection.prepare(`
        INSERT INTO relay_tenants(id, display_name, status, metadata_json, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?, ?)
      `).run(tenantId, displayName, safeJson(input.metadata || {}), timestamp, timestamp);
      connection.prepare(`
        INSERT INTO relay_wallets(tenant_id, available_credits, held_credits, revision, updated_at)
        VALUES (?, ?, 0, 1, ?)
      `).run(tenantId, initialCredits, timestamp);
      if (initialCredits > 0) {
        this._insertLedger(connection, {
          tenantId,
          entryType: "top_up",
          availableDelta: initialCredits,
          heldDelta: 0,
          availableAfter: initialCredits,
          heldAfter: 0,
          customerCredits: initialCredits,
          note: optionalText(input.initialCreditNote || "初始积分", 1_000),
          idempotencyKey: input.idempotencyKey ? cleanText(input.idempotencyKey, "幂等键", { maximum: 512 }) : null,
          createdAt: timestamp
        });
      }
      this._audit(connection, { tenantId, actorType: input.actorType || "operator", action: "tenant.created", entityType: "tenant", entityId: tenantId, details: { initialCredits } });
      return this.getTenant(tenantId);
    });
  }

  getTenant(tenantId) {
    const id = cleanText(tenantId, "客户租户 ID", { maximum: 128 });
    const tenant = this.db.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(id);
    if (!tenant) return null;
    const wallet = this.db.prepare("SELECT * FROM relay_wallets WHERE tenant_id = ?").get(id);
    return publicTenant(tenant, wallet);
  }

  listTenants(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const rows = this.db.prepare(`
      SELECT t.*, w.available_credits, w.held_credits, w.revision, w.updated_at AS wallet_updated_at
      FROM relay_tenants t
      JOIN relay_wallets w ON w.tenant_id = t.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(limit);
    return rows.map((row) => publicTenant(row, {
      available_credits: row.available_credits,
      held_credits: row.held_credits,
      revision: row.revision,
      updated_at: row.wallet_updated_at
    }));
  }

  setTenantStatus(tenantId, status, options = {}) {
    const id = cleanText(tenantId, "客户租户 ID", { maximum: 128 });
    const normalizedStatus = cleanText(status, "客户状态", { maximum: 32 });
    if (!["active", "suspended", "closed"].includes(normalizedStatus)) throw relayError("RELAY_VALIDATION", "不支持的客户状态。", { statusCode: 422 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const changed = connection.prepare("UPDATE relay_tenants SET status = ?, updated_at = ? WHERE id = ?").run(normalizedStatus, timestamp, id);
      if (!changed.changes) throw relayError("RELAY_NOT_FOUND", "客户租户不存在。", { statusCode: 404 });
      this._audit(connection, { tenantId: id, actorType: options.actorType || "operator", action: "tenant.status_changed", entityType: "tenant", entityId: id, details: { status: normalizedStatus } });
      return this.getTenant(id);
    });
  }

  _getWallet(connection, tenantId) {
    const wallet = connection.prepare("SELECT * FROM relay_wallets WHERE tenant_id = ?").get(tenantId);
    if (!wallet) throw relayError("RELAY_NOT_FOUND", "客户积分钱包不存在。", { statusCode: 404 });
    return wallet;
  }

  _insertLedger(connection, values) {
    connection.prepare(`
      INSERT INTO relay_billing_ledger(
        id, tenant_id, provider_account_id, run_id, item_id, entry_type,
        available_delta, held_delta, available_after, held_after,
        customer_credits, upstream_credits, price_snapshot_json, idempotency_key, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      values.id || randomId("ledger"),
      values.tenantId,
      values.providerAccountId || null,
      values.runId || null,
      values.itemId || null,
      values.entryType,
      toInteger(values.availableDelta, 0),
      toInteger(values.heldDelta, 0),
      values.availableAfter === undefined ? null : toInteger(values.availableAfter, 0),
      values.heldAfter === undefined ? null : toInteger(values.heldAfter, 0),
      nonNegativeInteger(values.customerCredits, 0),
      nonNegativeInteger(values.upstreamCredits, 0),
      safeJson(values.priceSnapshot || {}),
      values.idempotencyKey || null,
      optionalText(values.note, 1_000),
      values.createdAt || nowIso()
    );
  }

  creditTenant(tenantId, input = {}) {
    const id = cleanText(tenantId, "客户租户 ID", { maximum: 128 });
    const credits = positiveInteger(input.credits, 0, 1_000_000_000);
    const type = cleanText(input.entryType || "top_up", "账本类型", { maximum: 32 });
    if (!["top_up", "adjustment"].includes(type)) throw relayError("RELAY_VALIDATION", "积分入账只能使用 top_up 或 adjustment。", { statusCode: 422 });
    const idempotencyKey = input.idempotencyKey ? cleanText(input.idempotencyKey, "幂等键", { maximum: 512 }) : null;
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      if (idempotencyKey) {
        const existing = connection.prepare("SELECT * FROM relay_billing_ledger WHERE tenant_id = ? AND idempotency_key = ?").get(id, idempotencyKey);
        if (existing) return { idempotent: true, ledgerId: existing.id, wallet: this.getTenant(id)?.wallet };
      }
      const tenant = connection.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(id);
      if (!tenant) throw relayError("RELAY_NOT_FOUND", "客户租户不存在。", { statusCode: 404 });
      const wallet = this._getWallet(connection, id);
      const availableAfter = Number(wallet.available_credits) + credits;
      connection.prepare(`
        UPDATE relay_wallets
        SET available_credits = ?, revision = revision + 1, updated_at = ?
        WHERE tenant_id = ?
      `).run(availableAfter, timestamp, id);
      const ledgerId = randomId("ledger");
      this._insertLedger(connection, {
        id: ledgerId,
        tenantId: id,
        entryType: type,
        availableDelta: credits,
        heldDelta: 0,
        availableAfter,
        heldAfter: Number(wallet.held_credits),
        customerCredits: credits,
        idempotencyKey,
        note: input.note || "客户积分入账",
        createdAt: timestamp
      });
      this._audit(connection, { tenantId: id, actorType: input.actorType || "operator", action: "wallet.credited", entityType: "wallet", entityId: id, details: { credits, type, ledgerId } });
      return { idempotent: false, ledgerId, wallet: this.getTenant(id)?.wallet };
    });
  }

  upsertProviderAccount(input = {}) {
    const providerAccountId = optionalText(input.providerAccountId || input.id, 128) || randomId("provider");
    const providerCode = cleanText(input.providerCode || input.provider || "aidso", "上游代码", { maximum: 80 }).toLowerCase();
    const displayName = cleanText(input.displayName || input.name || providerCode, "上游名称", { maximum: 240 });
    const status = cleanText(input.status || "active", "上游状态", { maximum: 32 });
    if (!["active", "degraded", "disabled"].includes(status)) throw relayError("RELAY_VALIDATION", "不支持的上游状态。", { statusCode: 422 });
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const existing = connection.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(providerAccountId);
      const isDefault = input.isDefault === undefined ? Number(existing?.is_default || 0) : (input.isDefault ? 1 : 0);
      if (isDefault) connection.prepare("UPDATE relay_provider_accounts SET is_default = 0, updated_at = ? WHERE provider_code = ? AND id <> ?").run(timestamp, providerCode, providerAccountId);
      const tokenEnvelope = input.token === undefined
        ? existing?.token_envelope_json || null
        : safeJson(this.secretBox.encrypt(cleanText(input.token, "爱搜 Token", { maximum: 8_000 }), `provider:${providerAccountId}`));
      const values = {
        providerCode,
        displayName,
        status,
        isDefault,
        tokenReference: input.tokenReference === undefined ? (existing?.token_reference || "") : optionalText(input.tokenReference, 1_000),
        tokenEnvelope,
        capabilities: input.capabilities === undefined ? parseJson(existing?.capabilities_json, {}) : input.capabilities,
        lastKnownBalance: input.lastKnownBalance === undefined ? (existing?.last_known_balance ?? null) : (input.lastKnownBalance === null ? null : nonNegativeInteger(input.lastKnownBalance, 0)),
        maxInFlight: positiveInteger(input.maxInFlight, Number(existing?.max_in_flight || 8), 1_000),
        metadata: input.metadata === undefined ? parseJson(existing?.metadata_json, {}) : input.metadata
      };
      connection.prepare(`
        INSERT INTO relay_provider_accounts(
          id, provider_code, display_name, status, is_default, token_reference, token_envelope_json,
          capabilities_json, last_known_balance, max_in_flight, last_health_at, last_health_status,
          metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider_code = excluded.provider_code,
          display_name = excluded.display_name,
          status = excluded.status,
          is_default = excluded.is_default,
          token_reference = excluded.token_reference,
          token_envelope_json = excluded.token_envelope_json,
          capabilities_json = excluded.capabilities_json,
          last_known_balance = excluded.last_known_balance,
          max_in_flight = excluded.max_in_flight,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(
        providerAccountId, values.providerCode, values.displayName, values.status, values.isDefault,
        values.tokenReference, values.tokenEnvelope, safeJson(values.capabilities), values.lastKnownBalance,
        values.maxInFlight, existing?.last_health_at || null, existing?.last_health_status || "unknown",
        safeJson(values.metadata), existing?.created_at || timestamp, timestamp
      );
      this._audit(connection, { actorType: input.actorType || "operator", action: "provider.upserted", entityType: "provider_account", entityId: providerAccountId, details: { providerCode, status, isDefault: Boolean(isDefault) } });
      return this.getProviderAccount(providerAccountId);
    });
  }

  getProviderAccount(providerAccountId, options = {}) {
    const id = cleanText(providerAccountId, "上游账户 ID", { maximum: 128 });
    const row = this.db.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(id);
    return publicProvider(row, { includeSecretEnvelope: options.includeSecretEnvelope === true });
  }

  getProviderToken(providerAccountId) {
    const id = cleanText(providerAccountId, "上游账户 ID", { maximum: 128 });
    const row = this.db.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(id);
    if (!row) throw relayError("RELAY_NOT_FOUND", "上游账户不存在。", { statusCode: 404 });
    if (!row.token_envelope_json) return "";
    return this.secretBox.decrypt(parseJson(row.token_envelope_json, null), `provider:${id}`);
  }

  setProviderHealth(providerAccountId, input = {}) {
    const id = cleanText(providerAccountId, "上游账户 ID", { maximum: 128 });
    const health = cleanText(input.status || input.healthStatus, "上游健康状态", { maximum: 80 });
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const changed = connection.prepare(`
        UPDATE relay_provider_accounts
        SET last_health_at = ?, last_health_status = ?,
            last_known_balance = COALESCE(?, last_known_balance), updated_at = ?
        WHERE id = ?
      `).run(timestamp, health, input.lastKnownBalance === undefined ? null : nonNegativeInteger(input.lastKnownBalance, 0), timestamp, id);
      if (!changed.changes) throw relayError("RELAY_NOT_FOUND", "上游账户不存在。", { statusCode: 404 });
      return this.getProviderAccount(id);
    });
  }

  provisionInstance(input = {}) {
    const tenantId = cleanText(input.tenantId, "客户租户 ID", { maximum: 128 });
    const instanceId = optionalText(input.instanceId || input.id, 128) || randomId("instance");
    const clientId = cleanText(input.clientId || `tz_${crypto.randomBytes(12).toString("base64url")}`, "实例 Client ID", { maximum: 256 });
    const displayName = cleanText(input.displayName || input.name || clientId, "实例名称", { maximum: 240 });
    const status = cleanText(input.status || "active", "实例状态", { maximum: 32 });
    if (!["active", "suspended", "revoked"].includes(status)) throw relayError("RELAY_VALIDATION", "不支持的实例状态。", { statusCode: 422 });
    const providedSecret = input.clientSecret === undefined ? "" : cleanText(input.clientSecret, "实例密钥", { maximum: 4_096 });
    const clientSecret = providedSecret || crypto.randomBytes(32).toString("base64url");
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const tenant = connection.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(tenantId);
      if (!tenant) throw relayError("RELAY_NOT_FOUND", "客户租户不存在。", { statusCode: 404 });
      const existing = connection.prepare("SELECT * FROM relay_instances WHERE id = ? OR client_id = ?").get(instanceId, clientId);
      if (existing) throw relayError("RELAY_CONFLICT", "实例 ID 或 Client ID 已存在。", { statusCode: 409 });
      let providerAccountId = input.providerAccountId ? cleanText(input.providerAccountId, "上游账户 ID", { maximum: 128 }) : "";
      if (!providerAccountId) providerAccountId = connection.prepare("SELECT id FROM relay_provider_accounts WHERE provider_code = 'aidso' AND status = 'active' ORDER BY is_default DESC, created_at ASC LIMIT 1").get()?.id || "";
      if (providerAccountId && !connection.prepare("SELECT 1 FROM relay_provider_accounts WHERE id = ?").get(providerAccountId)) {
        throw relayError("RELAY_NOT_FOUND", "实例指定的上游账户不存在。", { statusCode: 404 });
      }
      const envelope = this.secretBox.encrypt(clientSecret, `instance:${instanceId}:${clientId}`);
      connection.prepare(`
        INSERT INTO relay_instances(
          id, tenant_id, provider_account_id, display_name, client_id, secret_envelope_json, secret_fingerprint,
          secret_version, status, allowed_capabilities_json, max_in_flight, daily_credit_limit, monthly_credit_limit,
          callback_url, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        instanceId, tenantId, providerAccountId || null, displayName, clientId, safeJson(envelope), digestText(clientSecret), status,
        safeJson(input.allowedCapabilities || {}), positiveInteger(input.maxInFlight, 2, 100),
        nonNegativeInteger(input.dailyCreditLimit, 0, 1_000_000_000), nonNegativeInteger(input.monthlyCreditLimit, 0, 1_000_000_000),
        optionalText(input.callbackUrl, 2_000), safeJson(input.metadata || {}), timestamp, timestamp
      );
      this._audit(connection, { tenantId, instanceId, actorType: input.actorType || "operator", action: "instance.provisioned", entityType: "instance", entityId: instanceId, details: { providerAccountId: providerAccountId || null } });
      return { instance: this.getInstance(instanceId), clientSecret };
    });
  }

  getInstance(instanceId) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    return publicInstance(this.db.prepare("SELECT * FROM relay_instances WHERE id = ?").get(id));
  }

  getInstanceByClientId(clientId) {
    const id = cleanText(clientId, "实例 Client ID", { maximum: 256 });
    return publicInstance(this.db.prepare("SELECT * FROM relay_instances WHERE client_id = ? COLLATE NOCASE").get(id));
  }

  rotateInstanceSecret(instanceId, options = {}) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    const clientSecret = options.clientSecret === undefined ? crypto.randomBytes(32).toString("base64url") : cleanText(options.clientSecret, "实例密钥", { maximum: 4_096 });
    return this.transaction((connection) => {
      const instance = connection.prepare("SELECT * FROM relay_instances WHERE id = ?").get(id);
      if (!instance) throw relayError("RELAY_NOT_FOUND", "实例不存在。", { statusCode: 404 });
      const envelope = this.secretBox.encrypt(clientSecret, `instance:${instance.id}:${instance.client_id}`);
      connection.prepare(`
        UPDATE relay_instances
        SET secret_envelope_json = ?, secret_fingerprint = ?, secret_version = secret_version + 1, updated_at = ?
        WHERE id = ?
      `).run(safeJson(envelope), digestText(clientSecret), timestamp, id);
      connection.prepare("DELETE FROM relay_nonce_uses WHERE instance_id = ?").run(id);
      this._audit(connection, { tenantId: instance.tenant_id, instanceId: id, actorType: options.actorType || "operator", action: "instance.secret_rotated", entityType: "instance", entityId: id, details: {} });
      return { instance: this.getInstance(id), clientSecret };
    });
  }

  setInstanceStatus(instanceId, status, options = {}) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    const normalizedStatus = cleanText(status, "实例状态", { maximum: 32 });
    if (!["active", "suspended", "revoked"].includes(normalizedStatus)) throw relayError("RELAY_VALIDATION", "不支持的实例状态。", { statusCode: 422 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const instance = connection.prepare("SELECT * FROM relay_instances WHERE id = ?").get(id);
      if (!instance) throw relayError("RELAY_NOT_FOUND", "实例不存在。", { statusCode: 404 });
      connection.prepare("UPDATE relay_instances SET status = ?, updated_at = ? WHERE id = ?").run(normalizedStatus, timestamp, id);
      this._audit(connection, { tenantId: instance.tenant_id, instanceId: id, actorType: options.actorType || "operator", action: "instance.status_changed", entityType: "instance", entityId: id, details: { status: normalizedStatus } });
      return this.getInstance(id);
    });
  }

  authenticateInstanceRequest(input = {}) {
    const clientId = cleanText(input.clientId, "实例 Client ID", { maximum: 256 });
    const timestampText = cleanText(input.timestamp, "时间戳", { maximum: 32 });
    const nonce = cleanText(input.nonce, "Nonce", { maximum: 256 });
    const signature = String(input.signature || "").trim().replace(/^sha256=/i, "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(signature)) throw relayError("RELAY_AUTH_INVALID", "实例签名格式无效。", { statusCode: 401 });
    const timestampSeconds = Number(timestampText);
    const maximumSkew = positiveInteger(input.maximumSkewSeconds, DEFAULT_NONCE_WINDOW_SECONDS, 3_600);
    const currentSeconds = Math.floor((input.now instanceof Date ? input.now : new Date()).valueOf() / 1_000);
    if (!Number.isInteger(timestampSeconds) || Math.abs(currentSeconds - timestampSeconds) > maximumSkew) {
      throw relayError("RELAY_AUTH_EXPIRED", "实例签名已过期。", { statusCode: 401 });
    }
    const target = cleanText(input.requestTarget || input.path, "请求路径", { maximum: 4_096 });
    const method = cleanText(input.method, "HTTP 方法", { maximum: 16 });
    const requestTime = nowIso(input.now);
    return this.transaction((connection) => {
      const instance = connection.prepare(`
        SELECT i.*, t.status AS tenant_status, t.display_name AS tenant_display_name
        FROM relay_instances i JOIN relay_tenants t ON t.id = i.tenant_id
        WHERE i.client_id = ? COLLATE NOCASE
      `).get(clientId);
      if (!instance || instance.status !== "active" || instance.tenant_status !== "active") {
        throw relayError("RELAY_AUTH_INVALID", "实例凭证无效或已停用。", { statusCode: 401 });
      }
      const secret = this.secretBox.decrypt(parseJson(instance.secret_envelope_json, null), `instance:${instance.id}:${instance.client_id}`);
      const expected = signInstanceRequest({ secret, method, requestTarget: target, timestamp: timestampText, nonce, rawBody: input.rawBody || "" });
      if (!timingSafeTextEqual(expected, signature)) throw relayError("RELAY_AUTH_INVALID", "实例签名无效。", { statusCode: 401 });
      connection.prepare("DELETE FROM relay_nonce_uses WHERE expires_at < ?").run(requestTime);
      try {
        connection.prepare("INSERT INTO relay_nonce_uses(instance_id, nonce, seen_at, expires_at) VALUES (?, ?, ?, ?)")
          .run(instance.id, nonce, requestTime, isoAfter((maximumSkew * 2) * 1_000, new Date(requestTime)));
      } catch (error) {
        if (Number(error?.errcode) === 1555 || /relay_nonce_uses\.instance_id, relay_nonce_uses\.nonce/i.test(String(error?.message || ""))) {
          throw relayError("RELAY_AUTH_REPLAY", "请求已被接收过。", { statusCode: 409 });
        }
        throw error;
      }
      connection.prepare("UPDATE relay_instances SET last_seen_at = ?, updated_at = ? WHERE id = ?").run(requestTime, requestTime, instance.id);
      this._audit(connection, { tenantId: instance.tenant_id, instanceId: instance.id, actorType: "instance", action: "instance.authenticated", entityType: "instance", entityId: instance.id, details: { requestTarget: target } });
      return {
        tenantId: instance.tenant_id,
        tenantDisplayName: instance.tenant_display_name,
        instance: publicInstance(instance)
      };
    });
  }

  upsertPriceRule(input = {}) {
    const providerAccountId = cleanText(input.providerAccountId, "上游账户 ID", { maximum: 128 });
    const platform = cleanText(input.platform, "平台", { maximum: 120 });
    const terminal = cleanText(input.terminal || "web", "终端", { maximum: 120 });
    const mode = cleanText(input.mode || "fast", "模式", { maximum: 120 });
    const version = cleanText(input.version || "default", "价格版本", { maximum: 120 });
    const priceRuleId = optionalText(input.priceRuleId || input.id, 128) || randomId("price");
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const provider = connection.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(providerAccountId);
      if (!provider) throw relayError("RELAY_NOT_FOUND", "上游账户不存在。", { statusCode: 404 });
      if (!providerSupportsCapability(parseJson(provider.capabilities_json, {}), { platform, terminal, mode })) {
        throw relayError("RELAY_CAPABILITY_UNAVAILABLE", `价格规则 ${platform}/${terminal}/${mode} 不在已核验的上游能力快照中。`, { statusCode: 422 });
      }
      const existing = connection.prepare("SELECT * FROM relay_price_rules WHERE id = ?").get(priceRuleId);
      const status = cleanText(input.status || existing?.status || "active", "价格状态", { maximum: 32 });
      if (!["active", "disabled"].includes(status)) throw relayError("RELAY_VALIDATION", "不支持的价格状态。", { statusCode: 422 });
      connection.prepare(`
        INSERT INTO relay_price_rules(
          id, provider_account_id, platform, terminal, mode, customer_credits, estimated_upstream_credits,
          version, status, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider_account_id, platform, terminal, mode, version) DO UPDATE SET
          customer_credits = excluded.customer_credits,
          estimated_upstream_credits = excluded.estimated_upstream_credits,
          status = excluded.status,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(
        priceRuleId, providerAccountId, platform, terminal, mode,
        positiveInteger(input.customerCredits, 1, 1_000_000), nonNegativeInteger(input.estimatedUpstreamCredits, 0, 1_000_000),
        version, status, safeJson(input.metadata || {}), existing?.created_at || timestamp, timestamp
      );
      const row = connection.prepare(`
        SELECT * FROM relay_price_rules
        WHERE provider_account_id = ? AND platform = ? AND terminal = ? AND mode = ? AND version = ?
      `).get(providerAccountId, platform, terminal, mode, version);
      this._audit(connection, { actorType: input.actorType || "operator", action: "price_rule.upserted", entityType: "price_rule", entityId: row.id, details: { providerAccountId, platform, terminal, mode, version } });
      return publicPriceRule(row, { includeUpstreamEstimate: true });
    });
  }

  _getInstanceRow(connection, instanceId) {
    const row = connection.prepare(`
      SELECT i.*, t.status AS tenant_status
      FROM relay_instances i JOIN relay_tenants t ON t.id = i.tenant_id
      WHERE i.id = ?
    `).get(instanceId);
    if (!row) throw relayError("RELAY_NOT_FOUND", "实例不存在。", { statusCode: 404 });
    return row;
  }

  _getProviderForInstance(connection, instance) {
    const providerId = instance.provider_account_id || connection.prepare(`
      SELECT id FROM relay_provider_accounts
      WHERE provider_code = 'aidso' AND status = 'active'
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `).get()?.id;
    if (!providerId) throw relayError("RELAY_PROVIDER_UNAVAILABLE", "尚未配置可用的爱搜统一账户。", { statusCode: 503 });
    const provider = connection.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(providerId);
    if (!provider || provider.status !== "active") throw relayError("RELAY_PROVIDER_UNAVAILABLE", "当前实例没有可用的上游账户。", { statusCode: 503 });
    return provider;
  }

  _normalizeRunItem(input, ordinal) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw relayError("RELAY_VALIDATION", "检测任务项格式无效。", { statusCode: 422 });
    const clientItemId = cleanText(input.clientItemId || input.itemId, "任务项 ID", { maximum: 256 });
    const questionId = optionalText(input.questionId, 256);
    const prompt = cleanText(input.prompt, "检测问题", { maximum: 8_000 });
    const platform = cleanText(input.platform, "平台", { maximum: 120 });
    const terminal = cleanText(input.terminal || "web", "终端", { maximum: 120 });
    const mode = cleanText(input.mode || "fast", "模式", { maximum: 120 });
    return {
      clientItemId,
      questionId,
      ordinal,
      platform,
      terminal,
      mode,
      request: {
        prompt,
        platform,
        terminal,
        mode,
        questionId,
        metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {}
      }
    };
  }

  _quoteItems(connection, instance, provider, items) {
    const policy = parseJson(instance.allowed_capabilities_json, {});
    const quoted = [];
    for (const item of items) {
      if (!allowsCapability(policy, item)) {
        throw relayError("RELAY_CAPABILITY_FORBIDDEN", `实例不允许调用 ${item.platform}/${item.terminal}/${item.mode}。`, { statusCode: 403 });
      }
      const price = connection.prepare(`
        SELECT * FROM relay_price_rules
        WHERE provider_account_id = ? AND platform = ? AND terminal = ? AND mode = ? AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(provider.id, item.platform, item.terminal, item.mode);
      if (!price) {
        throw relayError("RELAY_PRICE_UNAVAILABLE", `没有 ${item.platform}/${item.terminal}/${item.mode} 的可用价格规则。`, { statusCode: 422 });
      }
      quoted.push({ ...item, price });
    }
    return quoted;
  }

  _assertInstanceBudget(connection, instance, estimate, submittedAt) {
    const dailyLimit = Number(instance.daily_credit_limit);
    const monthlyLimit = Number(instance.monthly_credit_limit);
    if (dailyLimit > 0) {
      const used = Number(connection.prepare(`
        SELECT COALESCE(SUM(estimated_customer_credits), 0) AS used
        FROM relay_runs
        WHERE instance_id = ? AND submitted_at >= ? AND status <> 'cancelled'
      `).get(instance.id, startOfUtcDay(submittedAt))?.used || 0);
      if (used + estimate > dailyLimit) throw relayError("RELAY_DAILY_BUDGET_EXCEEDED", "实例当日检测积分预算不足。", { statusCode: 429, details: { dailyLimit, used, estimate } });
    }
    if (monthlyLimit > 0) {
      const used = Number(connection.prepare(`
        SELECT COALESCE(SUM(estimated_customer_credits), 0) AS used
        FROM relay_runs
        WHERE instance_id = ? AND submitted_at >= ? AND status <> 'cancelled'
      `).get(instance.id, startOfUtcMonth(submittedAt))?.used || 0);
      if (used + estimate > monthlyLimit) throw relayError("RELAY_MONTHLY_BUDGET_EXCEEDED", "实例当月检测积分预算不足。", { statusCode: 429, details: { monthlyLimit, used, estimate } });
    }
  }

  quoteEffectRun(input = {}) {
    const instanceId = cleanText(input.instanceId, "实例 ID", { maximum: 128 });
    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (!rawItems.length || rawItems.length > MAX_RUN_ITEMS) throw relayError("RELAY_VALIDATION", `任务项数量必须在 1 到 ${MAX_RUN_ITEMS} 之间。`, { statusCode: 422 });
    return this.transaction((connection) => {
      const instance = this._getInstanceRow(connection, instanceId);
      if (instance.status !== "active" || instance.tenant_status !== "active") throw relayError("RELAY_INSTANCE_INACTIVE", "实例或客户当前不可用。", { statusCode: 403 });
      const provider = this._getProviderForInstance(connection, instance);
      const ids = new Set();
      const items = rawItems.map((item, ordinal) => {
        const normalized = this._normalizeRunItem(item, ordinal);
        if (ids.has(normalized.clientItemId)) throw relayError("RELAY_VALIDATION", "同一运行中不能有重复的任务项 ID。", { statusCode: 422 });
        ids.add(normalized.clientItemId);
        return normalized;
      });
      const quoted = this._quoteItems(connection, instance, provider, items);
      const estimatedCustomerCredits = quoted.reduce((sum, entry) => sum + Number(entry.price.customer_credits), 0);
      return {
        instanceId,
        provider: publicProvider(provider),
        estimatedCustomerCredits,
        priceSnapshot: quoted.map((entry) => ({
          clientItemId: entry.clientItemId,
          platform: entry.platform,
          terminal: entry.terminal,
          mode: entry.mode,
          customerCredits: Number(entry.price.customer_credits),
          priceRuleId: entry.price.id,
          priceVersion: entry.price.version
        }))
      };
    }, "DEFERRED");
  }

  createEffectRun(input = {}) {
    const instanceId = cleanText(input.instanceId, "实例 ID", { maximum: 128 });
    const clientRunId = cleanText(input.clientRunId, "客户端运行 ID", { maximum: 256 });
    const idempotencyKey = cleanText(input.idempotencyKey, "幂等键", { maximum: 512 });
    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (!rawItems.length || rawItems.length > MAX_RUN_ITEMS) throw relayError("RELAY_VALIDATION", `任务项数量必须在 1 到 ${MAX_RUN_ITEMS} 之间。`, { statusCode: 422 });
    const consent = input.consent && typeof input.consent === "object" && !Array.isArray(input.consent) ? input.consent : {};
    if (consent.externalDataConsent !== true) throw relayError("RELAY_CONSENT_REQUIRED", "必须明确确认向外部数据服务发送检测问题。", { statusCode: 422 });
    const timestamp = nowIso(input.now);
    const maxCustomerCredits = optionalCreditCap(input.maxCustomerCredits);
    const normalizedItems = rawItems.map((item, ordinal) => this._normalizeRunItem(item, ordinal));
    const ids = new Set();
    for (const item of normalizedItems) {
      if (ids.has(item.clientItemId)) throw relayError("RELAY_VALIDATION", "同一运行中不能有重复的任务项 ID。", { statusCode: 422 });
      ids.add(item.clientItemId);
    }
    const requestSnapshot = {
      clientRunId,
      projectId: optionalText(input.projectId, 256),
      questionSetId: optionalText(input.questionSetId, 256),
      questionSetChecksum: optionalText(input.questionSetChecksum, 512),
      brand: input.brand && typeof input.brand === "object" && !Array.isArray(input.brand) ? input.brand : {},
      competitors: Array.isArray(input.competitors) ? input.competitors.map((entry) => optionalText(entry, 240)).filter(Boolean) : [],
      analysisScope: input.analysisScope && typeof input.analysisScope === "object" && !Array.isArray(input.analysisScope) ? input.analysisScope : {},
      requestMetadata: input.requestMetadata && typeof input.requestMetadata === "object" && !Array.isArray(input.requestMetadata) ? input.requestMetadata : {},
      maxCustomerCredits,
      items: normalizedItems.map((item) => ({ clientItemId: item.clientItemId, questionId: item.questionId, ...item.request }))
    };
    const requestHash = digestText(stableJson({ requestSnapshot, consent }));
    return this.transaction((connection) => {
      const instance = this._getInstanceRow(connection, instanceId);
      if (instance.status !== "active" || instance.tenant_status !== "active") throw relayError("RELAY_INSTANCE_INACTIVE", "实例或客户当前不可用。", { statusCode: 403 });
      const duplicate = connection.prepare("SELECT * FROM relay_runs WHERE instance_id = ? AND idempotency_key = ?").get(instanceId, idempotencyKey);
      if (duplicate) {
        if (!timingSafeTextEqual(duplicate.request_hash, requestHash)) throw relayError("RELAY_IDEMPOTENCY_MISMATCH", "幂等键已用于不同的检测请求。", { statusCode: 409 });
        return { created: false, run: publicRun(duplicate) };
      }
      if (connection.prepare("SELECT 1 FROM relay_runs WHERE instance_id = ? AND client_run_id = ?").get(instanceId, clientRunId)) {
        throw relayError("RELAY_CONFLICT", "客户端运行 ID 已存在，请使用原幂等键重试。", { statusCode: 409 });
      }
      const provider = this._getProviderForInstance(connection, instance);
      const quoted = this._quoteItems(connection, instance, provider, normalizedItems);
      const estimatedCustomerCredits = quoted.reduce((sum, entry) => sum + Number(entry.price.customer_credits), 0);
      if (maxCustomerCredits !== null && estimatedCustomerCredits > maxCustomerCredits) {
        throw relayError("RELAY_CLIENT_CREDIT_CAP_EXCEEDED", "本次最新报价超过客户服务端提交的单次积分上限，未创建任务或冻结积分。", {
          statusCode: 409,
          details: { estimatedCustomerCredits, maxCustomerCredits }
        });
      }
      this._assertInstanceBudget(connection, instance, estimatedCustomerCredits, timestamp);
      const wallet = this._getWallet(connection, instance.tenant_id);
      if (Number(wallet.available_credits) < estimatedCustomerCredits) {
        throw relayError("RELAY_INSUFFICIENT_CREDITS", "客户可用积分不足，无法冻结本次检测额度。", {
          statusCode: 402,
          details: { availableCredits: Number(wallet.available_credits), requiredCredits: estimatedCustomerCredits }
        });
      }
      const runId = optionalText(input.relayRunId, 128) || randomId("run");
      const providerSnapshot = {
        providerAccountId: provider.id,
        providerCode: provider.provider_code,
        capabilityVersion: parseJson(provider.capabilities_json, {}).version || null,
        capturedAt: timestamp
      };
      const priceSnapshot = quoted.map((entry) => ({
        relayItemId: null,
        clientItemId: entry.clientItemId,
        priceRuleId: entry.price.id,
        priceVersion: entry.price.version,
        platform: entry.platform,
        terminal: entry.terminal,
        mode: entry.mode,
        customerCredits: Number(entry.price.customer_credits),
        estimatedUpstreamCredits: Number(entry.price.estimated_upstream_credits)
      }));
      connection.prepare(`
        INSERT INTO relay_runs(
          id, tenant_id, instance_id, provider_account_id, client_run_id, idempotency_key, request_hash,
          status, billing_status, project_id, question_set_id, question_set_checksum, input_snapshot_json,
          capability_snapshot_json, price_snapshot_json, consent_json, estimated_customer_credits,
          held_customer_credits, settled_customer_credits, total_items, submitted_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 'held', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
        runId, instance.tenant_id, instance.id, provider.id, clientRunId, idempotencyKey, requestHash,
        requestSnapshot.projectId, requestSnapshot.questionSetId, requestSnapshot.questionSetChecksum,
        safeJson(requestSnapshot), safeJson(providerSnapshot), safeJson({ version: "relay-price-snapshot-v1", items: priceSnapshot }), safeJson(consent),
        estimatedCustomerCredits, estimatedCustomerCredits, quoted.length, timestamp, timestamp
      );
      const insertItem = connection.prepare(`
        INSERT INTO relay_items(
          id, run_id, tenant_id, instance_id, provider_account_id, client_item_id, question_id, ordinal,
          platform, terminal, mode, request_json, customer_credits, estimated_upstream_credits,
          status, next_action_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)
      `);
      for (const entry of quoted) {
        const itemId = randomId("item");
        insertItem.run(
          itemId, runId, instance.tenant_id, instance.id, provider.id, entry.clientItemId, entry.questionId, entry.ordinal,
          entry.platform, entry.terminal, entry.mode, safeJson(entry.request), Number(entry.price.customer_credits),
          Number(entry.price.estimated_upstream_credits), timestamp, timestamp, timestamp
        );
      }
      const availableAfter = Number(wallet.available_credits) - estimatedCustomerCredits;
      const heldAfter = Number(wallet.held_credits) + estimatedCustomerCredits;
      connection.prepare(`
        UPDATE relay_wallets
        SET available_credits = ?, held_credits = ?, revision = revision + 1, updated_at = ?
        WHERE tenant_id = ?
      `).run(availableAfter, heldAfter, timestamp, instance.tenant_id);
      this._insertLedger(connection, {
        tenantId: instance.tenant_id,
        providerAccountId: provider.id,
        runId,
        entryType: "freeze",
        availableDelta: -estimatedCustomerCredits,
        heldDelta: estimatedCustomerCredits,
        availableAfter,
        heldAfter,
        customerCredits: estimatedCustomerCredits,
        priceSnapshot: { items: priceSnapshot },
        idempotencyKey: `run-freeze:${instance.id}:${idempotencyKey}`,
        note: `冻结检测积分：${clientRunId}`,
        createdAt: timestamp
      });
      this._audit(connection, { tenantId: instance.tenant_id, instanceId: instance.id, actorType: input.actorType || "instance", action: "run.created", entityType: "run", entityId: runId, details: { clientRunId, totalItems: quoted.length, estimatedCustomerCredits } });
      return { created: true, run: publicRun(connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(runId)) };
    });
  }

  getRun(relayRunId, options = {}) {
    const id = cleanText(relayRunId, "中转运行 ID", { maximum: 128 });
    const run = this.db.prepare("SELECT * FROM relay_runs WHERE id = ?").get(id);
    if (!run) return null;
    const output = publicRun(run, { includeRequestHash: options.includeRequestHash === true, includeUpstream: options.includeUpstream === true });
    if (options.includeItems) {
      const rows = this.db.prepare("SELECT * FROM relay_items WHERE run_id = ? ORDER BY ordinal ASC").all(id);
      output.items = rows.map((row) => publicItem(row, { includeResult: options.includeResults === true, includeUpstream: options.includeUpstream === true }));
      if (options.includeResults === true && Buffer.byteLength(JSON.stringify(output), "utf8") > MAX_INCLUDE_RESULTS_BYTES) {
        throw relayError("RELAY_RESULT_TOO_LARGE", "本次结果超过单次补偿查询大小限制，请改用 deliveries 逐条拉取。", { statusCode: 413, details: { maxBytes: MAX_INCLUDE_RESULTS_BYTES } });
      }
    }
    return output;
  }

  getRunForInstance(instanceId, relayRunId, options = {}) {
    const normalizedInstanceId = cleanText(instanceId, "实例 ID", { maximum: 128 });
    const normalizedRunId = cleanText(relayRunId, "中转运行 ID", { maximum: 128 });
    const run = this.db.prepare("SELECT * FROM relay_runs WHERE id = ? AND instance_id = ?").get(normalizedRunId, normalizedInstanceId);
    if (!run) return null;
    const output = publicRun(run);
    if (options.includeItems) {
      output.items = this.db.prepare("SELECT * FROM relay_items WHERE run_id = ? ORDER BY ordinal ASC")
        .all(normalizedRunId)
        .map((row) => publicItem(row, { includeResult: options.includeResults === true }));
      if (options.includeResults === true && Buffer.byteLength(JSON.stringify(output), "utf8") > MAX_INCLUDE_RESULTS_BYTES) {
        throw relayError("RELAY_RESULT_TOO_LARGE", "本次结果超过单次补偿查询大小限制，请改用 deliveries 逐条拉取。", { statusCode: 413, details: { maxBytes: MAX_INCLUDE_RESULTS_BYTES } });
      }
    }
    return output;
  }

  listRunsForInstance(instanceId, options = {}) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    const limit = positiveInteger(options.limit, 50, 500);
    const rows = this.db.prepare("SELECT * FROM relay_runs WHERE instance_id = ? ORDER BY submitted_at DESC LIMIT ?").all(id, limit);
    return rows.map((row) => publicRun(row));
  }

  getQuotaForInstance(instanceId) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    const row = this.db.prepare(`
      SELECT i.*, t.status AS tenant_status, w.available_credits, w.held_credits, w.revision, w.updated_at AS wallet_updated_at
      FROM relay_instances i
      JOIN relay_tenants t ON t.id = i.tenant_id
      JOIN relay_wallets w ON w.tenant_id = i.tenant_id
      WHERE i.id = ?
    `).get(id);
    if (!row) throw relayError("RELAY_NOT_FOUND", "实例不存在。", { statusCode: 404 });
    const current = nowIso();
    const dailyUsed = Number(this.db.prepare(`
      SELECT COALESCE(SUM(estimated_customer_credits), 0) AS used
      FROM relay_runs WHERE instance_id = ? AND submitted_at >= ? AND status <> 'cancelled'
    `).get(id, startOfUtcDay(current))?.used || 0);
    const monthlyUsed = Number(this.db.prepare(`
      SELECT COALESCE(SUM(estimated_customer_credits), 0) AS used
      FROM relay_runs WHERE instance_id = ? AND submitted_at >= ? AND status <> 'cancelled'
    `).get(id, startOfUtcMonth(current))?.used || 0);
    return {
      instanceId: id,
      tenantId: row.tenant_id,
      instanceStatus: row.status,
      tenantStatus: row.tenant_status,
      availableCredits: Number(row.available_credits),
      heldCredits: Number(row.held_credits),
      dailyCreditLimit: Number(row.daily_credit_limit),
      monthlyCreditLimit: Number(row.monthly_credit_limit),
      dailyUsed,
      monthlyUsed,
      maxInFlight: Number(row.max_in_flight),
      walletRevision: Number(row.revision),
      updatedAt: row.wallet_updated_at
    };
  }

  listCapabilitiesForInstance(instanceId) {
    const id = cleanText(instanceId, "实例 ID", { maximum: 128 });
    return this.transaction((connection) => {
      const instance = this._getInstanceRow(connection, id);
      const provider = this._getProviderForInstance(connection, instance);
      const rules = connection.prepare(`
        SELECT * FROM relay_price_rules
        WHERE provider_account_id = ? AND status = 'active'
        ORDER BY platform ASC, terminal ASC, mode ASC, updated_at DESC
      `).all(provider.id);
      const policy = parseJson(instance.allowed_capabilities_json, {});
      const providerMetadata = parseJson(provider.metadata_json, {});
      return {
        provider: {
          providerCode: provider.provider_code,
          displayName: provider.display_name,
          executionMode: String(providerMetadata.executionMode || "unknown").toLowerCase(),
          capabilitySnapshot: parseJson(provider.capabilities_json, {})
        },
        items: rules
          .map((rule) => publicPriceRule(rule))
          .filter((rule) => allowsCapability(policy, rule))
      };
    }, "DEFERRED");
  }

  _recoverExpiredWork(connection, timestamp) {
    const attempts = connection.prepare(`
      SELECT a.id AS attempt_id, a.operation, it.id AS item_id
      FROM relay_attempts a
      JOIN relay_items it ON it.id = a.item_id
      JOIN relay_runs r ON r.id = it.run_id
      WHERE a.outcome = 'running'
        AND it.lease_until IS NOT NULL
        AND it.lease_until <= ?
    `).all(timestamp);
    for (const attempt of attempts) {
      if (attempt.operation === "submit") {
        // A process may have died after writing the outbound intent but before it
        // received reqId. Retrying would risk a duplicate paid upstream task.
        connection.prepare(`
          UPDATE relay_attempts
          SET outcome = 'uncertain', error_code = 'RELAY_SUBMISSION_UNCERTAIN',
              error_message = '提交任务的工作进程在收到爱搜 reqId 前失去租约。', finished_at = ?
          WHERE id = ? AND outcome = 'running'
        `).run(timestamp, attempt.attempt_id);
        connection.prepare(`
          UPDATE relay_items
          SET status = 'submission_uncertain', last_error_code = 'RELAY_SUBMISSION_UNCERTAIN',
              last_error_message = '爱搜提交状态不确定，已停止自动重提并等待对账。',
              lease_owner = NULL, lease_until = NULL, updated_at = ?
          WHERE id = ?
        `).run(timestamp, attempt.item_id);
        const item = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(attempt.item_id);
        const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id);
        this._openReconciliationCase(connection, item, {
          actorType: "worker",
          reasonCode: "RELAY_SUBMISSION_UNCERTAIN",
          reasonMessage: item.last_error_message,
          evidence: { source: "lease_recovery", attemptId: attempt.attempt_id }
        });
        this._enqueueDelivery(connection, {
          tenantId: item.tenant_id,
          instanceId: item.instance_id,
          runId: item.run_id,
          itemId: item.id,
          deliveryKey: `item:${item.id}:attention`,
          kind: "item_attention",
          payload: this._itemDeliveryPayload(item, run, "item_attention"),
          createdAt: timestamp
        });
        this._maybeFinalizeRun(connection, item.run_id, timestamp);
      } else {
        // Polls are idempotent: a lost poll response can be retried using reqId.
        connection.prepare(`
          UPDATE relay_attempts
          SET outcome = 'retry_scheduled', error_code = 'RELAY_POLL_LEASE_EXPIRED',
              error_message = '轮询工作进程失去租约，已安排安全重试。', finished_at = ?
          WHERE id = ? AND outcome = 'running'
        `).run(timestamp, attempt.attempt_id);
        connection.prepare(`
          UPDATE relay_items
          SET status = 'poll_retry', next_action_at = ?, lease_owner = NULL, lease_until = NULL, updated_at = ?
          WHERE id = ?
        `).run(timestamp, timestamp, attempt.item_id);
      }
    }
  }

  claimWork(input = {}) {
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const limit = positiveInteger(input.limit, 10, 100);
    const leaseMs = positiveInteger(input.leaseMs, 60_000, 15 * 60_000);
    const timestamp = nowIso(input.now);
    const leaseUntil = isoAfter(leaseMs, new Date(timestamp));
    return this.transaction((connection) => {
      this._recoverExpiredWork(connection, timestamp);
      const candidates = connection.prepare(`
        SELECT
          it.*, r.input_snapshot_json, r.client_run_id, r.status AS run_status,
          i.max_in_flight, p.max_in_flight AS provider_max_in_flight,
          i.status AS instance_status, t.status AS tenant_status
        FROM relay_items it
        JOIN relay_runs r ON r.id = it.run_id
        JOIN relay_instances i ON i.id = it.instance_id
        JOIN relay_tenants t ON t.id = it.tenant_id
        JOIN relay_provider_accounts p ON p.id = it.provider_account_id
        WHERE it.status IN ('queued', 'submit_retry', 'submitted', 'poll_retry')
          AND it.next_action_at <= ?
          AND (it.lease_until IS NULL OR it.lease_until <= ?)
          AND r.billing_status = 'held'
          AND r.status IN ('queued', 'running')
          AND i.status = 'active'
          AND t.status = 'active'
          AND p.status = 'active'
        ORDER BY it.next_action_at ASC, it.created_at ASC
        LIMIT ?
      `).all(timestamp, timestamp, Math.min(limit * 8, 800));
      const claimed = [];
      const claimStatement = connection.prepare(`
        UPDATE relay_items
        SET lease_owner = ?, lease_until = ?, updated_at = ?
        WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?)
      `);
      const activeCount = connection.prepare(`
        SELECT COUNT(*) AS count
        FROM relay_items
        WHERE instance_id = ? AND lease_until IS NOT NULL AND lease_until > ?
      `);
      const providerActiveCount = connection.prepare(`
        SELECT COUNT(*) AS count
        FROM relay_items
        WHERE provider_account_id = ? AND lease_until IS NOT NULL AND lease_until > ?
      `);
      for (const candidate of candidates) {
        if (claimed.length >= limit) break;
        const inFlight = Number(activeCount.get(candidate.instance_id, timestamp)?.count || 0);
        if (inFlight >= Number(candidate.max_in_flight)) continue;
        const providerInFlight = Number(providerActiveCount.get(candidate.provider_account_id, timestamp)?.count || 0);
        if (providerInFlight >= Number(candidate.provider_max_in_flight)) continue;
        const updated = claimStatement.run(workerId, leaseUntil, timestamp, candidate.id, timestamp);
        if (!updated.changes) continue;
        connection.prepare(`
          UPDATE relay_runs
          SET status = CASE WHEN status = 'queued' THEN 'running' ELSE status END,
              started_at = COALESCE(started_at, ?), updated_at = ?
          WHERE id = ?
        `).run(timestamp, timestamp, candidate.run_id);
        const operation = ["submitted", "poll_retry"].includes(candidate.status) ? "poll" : "submit";
        claimed.push({
          relayItemId: candidate.id,
          relayRunId: candidate.run_id,
          tenantId: candidate.tenant_id,
          instanceId: candidate.instance_id,
          providerAccountId: candidate.provider_account_id,
          clientRunId: candidate.client_run_id,
          clientItemId: candidate.client_item_id,
          questionId: candidate.question_id,
          platform: candidate.platform,
          terminal: candidate.terminal,
          mode: candidate.mode,
          request: parseJson(candidate.request_json, {}),
          brand: parseJson(candidate.input_snapshot_json, {}).brand || {},
          upstreamReqId: candidate.upstream_req_id || null,
          operation,
          leaseUntil,
          submitAttempts: Number(candidate.submit_attempts),
          pollAttempts: Number(candidate.poll_attempts)
        });
      }
      return claimed;
    });
  }

  _assertLeasedItem(connection, itemId, workerId, timestamp) {
    const item = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(itemId);
    if (!item) throw relayError("RELAY_NOT_FOUND", "任务项不存在。", { statusCode: 404 });
    if (item.lease_owner !== workerId || !item.lease_until || item.lease_until <= timestamp) {
      throw relayError("RELAY_LEASE_LOST", "任务项租约已失效，不能继续写入执行结果。", { statusCode: 409 });
    }
    return item;
  }

  beginItemAttempt(input = {}) {
    const itemId = cleanText(input.relayItemId || input.itemId, "任务项 ID", { maximum: 128 });
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const operation = cleanText(input.operation, "执行操作", { maximum: 16 });
    if (!["submit", "poll"].includes(operation)) throw relayError("RELAY_VALIDATION", "执行操作只能是 submit 或 poll。", { statusCode: 422 });
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const item = this._assertLeasedItem(connection, itemId, workerId, timestamp);
      const expectedOperation = ["submitted", "poll_retry"].includes(item.status) ? "poll" : "submit";
      if (operation !== expectedOperation) throw relayError("RELAY_STATE_CONFLICT", "任务项当前状态与执行操作不匹配。", { statusCode: 409 });
      const attemptNo = operation === "submit" ? Number(item.submit_attempts) + 1 : Number(item.poll_attempts) + 1;
      const attemptId = randomId("attempt");
      connection.prepare(`
        INSERT INTO relay_attempts(id, item_id, operation, attempt_no, worker_id, outcome, started_at)
        VALUES (?, ?, ?, ?, ?, 'running', ?)
      `).run(attemptId, itemId, operation, attemptNo, workerId, timestamp);
      connection.prepare(`
        UPDATE relay_items
        SET ${operation === "submit" ? "submit_attempts" : "poll_attempts"} = ?, updated_at = ?
        WHERE id = ?
      `).run(attemptNo, timestamp, itemId);
      return { attemptId, attemptNo, operation, startedAt: timestamp };
    });
  }

  _assertRunningAttempt(connection, attemptId, itemId, workerId) {
    const attempt = connection.prepare("SELECT * FROM relay_attempts WHERE id = ? AND item_id = ?").get(attemptId, itemId);
    if (!attempt || attempt.worker_id !== workerId || attempt.outcome !== "running") throw relayError("RELAY_ATTEMPT_CONFLICT", "执行尝试不再可写。", { statusCode: 409 });
    return attempt;
  }

  _finishAttempt(connection, attempt, values) {
    connection.prepare(`
      UPDATE relay_attempts
      SET outcome = ?, provider_status = ?, response_hash = ?, error_code = ?, error_message = ?, latency_ms = ?, finished_at = ?
      WHERE id = ?
    `).run(
      values.outcome,
      optionalText(values.providerStatus, 240),
      optionalText(values.responseHash, 200),
      values.errorCode ? optionalText(values.errorCode, 120) : null,
      values.errorMessage ? optionalText(values.errorMessage, 1_000) : null,
      values.latencyMs === undefined || values.latencyMs === null ? null : nonNegativeInteger(values.latencyMs, 0, 3_600_000),
      values.finishedAt || nowIso(),
      attempt.id
    );
  }

  recordItemSubmitted(input = {}) {
    const itemId = cleanText(input.relayItemId || input.itemId, "任务项 ID", { maximum: 128 });
    const attemptId = cleanText(input.attemptId, "执行尝试 ID", { maximum: 128 });
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const upstreamReqId = cleanText(input.upstreamReqId, "爱搜 reqId", { maximum: 512 });
    const nextActionAt = nowIso(input.nextActionAt);
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const item = this._assertLeasedItem(connection, itemId, workerId, timestamp);
      const attempt = this._assertRunningAttempt(connection, attemptId, itemId, workerId);
      if (attempt.operation !== "submit") throw relayError("RELAY_STATE_CONFLICT", "当前尝试不是提交任务。", { statusCode: 409 });
      try {
        connection.prepare(`
          UPDATE relay_items
          SET status = 'poll_retry', upstream_req_id = ?, submission_response_json = ?,
              last_error_code = NULL, last_error_message = NULL, next_action_at = ?,
              lease_owner = NULL, lease_until = NULL, updated_at = ?
          WHERE id = ?
        `).run(upstreamReqId, safeJson(input.rawResponse || {}), nextActionAt, timestamp, itemId);
      } catch (error) {
        if (String(error?.code || "").includes("SQLITE_CONSTRAINT")) throw relayError("RELAY_UPSTREAM_REQID_CONFLICT", "该爱搜 reqId 已被其他任务绑定。", { statusCode: 409 });
        throw error;
      }
      this._finishAttempt(connection, attempt, { outcome: "succeeded", providerStatus: input.providerStatus || "accepted", responseHash: digestText(safeJson(input.rawResponse || {})), latencyMs: input.latencyMs, finishedAt: timestamp });
      return publicItem({ ...item, status: "poll_retry", upstream_req_id: upstreamReqId, updated_at: timestamp });
    });
  }

  recordItemPollPending(input = {}) {
    const itemId = cleanText(input.relayItemId || input.itemId, "任务项 ID", { maximum: 128 });
    const attemptId = cleanText(input.attemptId, "执行尝试 ID", { maximum: 128 });
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const item = this._assertLeasedItem(connection, itemId, workerId, timestamp);
      const attempt = this._assertRunningAttempt(connection, attemptId, itemId, workerId);
      if (attempt.operation !== "poll") throw relayError("RELAY_STATE_CONFLICT", "当前尝试不是轮询任务。", { statusCode: 409 });
      connection.prepare(`
        UPDATE relay_items
        SET status = 'poll_retry', next_action_at = ?, lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(nowIso(input.nextActionAt), timestamp, itemId);
      this._finishAttempt(connection, attempt, { outcome: "succeeded", providerStatus: input.providerStatus || "ING", responseHash: digestText(safeJson(input.rawResponse || {})), latencyMs: input.latencyMs, finishedAt: timestamp });
      return publicItem({ ...item, status: "poll_retry", updated_at: timestamp });
    });
  }

  _itemDeliveryPayload(item, run, kind = "item_result") {
    const completed = item.status === "completed";
    if (kind === "item_attention") {
      return {
        relayRunId: run.id,
        clientRunId: run.client_run_id,
        itemId: item.client_item_id,
        status: "attention",
        error: { code: item.last_error_code || "RELAY_SUBMISSION_UNCERTAIN", message: item.last_error_message || "爱搜提交状态不确定，等待人工对账。" },
        createdAt: item.updated_at
      };
    }
    const payload = {
      relayRunId: run.id,
      clientRunId: run.client_run_id,
      itemId: item.client_item_id,
      status: completed ? "completed" : "failed",
      upstream: {
        provider: "aidso",
        reqId: item.upstream_req_id || null,
        platform: item.platform,
        terminal: item.terminal,
        mode: item.mode
      },
      observedAt: item.observed_at || null,
      usage: { customerCredits: Number(item.customer_credits) }
    };
    if (completed) {
      payload.raw = parseJson(item.raw_payload_json, {});
      payload.normalized = parseJson(item.normalized_json, {});
      payload.quality = { status: payload.normalized?.qualityStatus || "supplied", normalizerVersion: item.normalizer_version || "" };
    } else {
      payload.error = { code: item.last_error_code || "RELAY_ITEM_FAILED", message: item.last_error_message || "任务未能完成。" };
    }
    return payload;
  }

  _enqueueDelivery(connection, values) {
    const existing = connection.prepare("SELECT * FROM relay_deliveries WHERE instance_id = ? AND delivery_key = ?").get(values.instanceId, values.deliveryKey);
    if (existing) return existing;
    const sequence = Number(connection.prepare("SELECT COALESCE(MAX(sequence), 0) AS sequence FROM relay_deliveries WHERE instance_id = ?").get(values.instanceId)?.sequence || 0) + 1;
    const timestamp = values.createdAt || nowIso();
    const payload = redactSensitive(values.payload || {});
    const payloadJson = stableJson(payload);
    const deliveryId = randomId("delivery");
    connection.prepare(`
      INSERT INTO relay_deliveries(
        id, tenant_id, instance_id, run_id, item_id, delivery_key, sequence, kind, payload_json, payload_hash,
        status, attempt_count, available_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)
    `).run(
      deliveryId, values.tenantId, values.instanceId, values.runId, values.itemId || null, values.deliveryKey,
      sequence, values.kind, payloadJson, digestText(payloadJson), timestamp, timestamp, timestamp
    );
    return connection.prepare("SELECT * FROM relay_deliveries WHERE id = ?").get(deliveryId);
  }

  _refreshRunCounts(connection, runId, timestamp) {
    const aggregate = connection.prepare(`
      SELECT
        COUNT(*) AS total_items,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_items,
        COALESCE(SUM(CASE WHEN status IN ('failed', 'dead_letter', 'cancelled') THEN 1 ELSE 0 END), 0) AS failed_items,
        COALESCE(SUM(CASE WHEN status = 'submission_uncertain' THEN 1 ELSE 0 END), 0) AS attention_items,
        COALESCE(SUM(CASE WHEN status IN ('queued', 'submit_retry', 'submitted', 'poll_retry') THEN 1 ELSE 0 END), 0) AS active_items,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN customer_credits ELSE 0 END), 0) AS charge_credits
      FROM relay_items WHERE run_id = ?
    `).get(runId);
    connection.prepare(`
      UPDATE relay_runs
      SET completed_items = ?, failed_items = ?, updated_at = ?
      WHERE id = ?
    `).run(Number(aggregate.completed_items), Number(aggregate.failed_items), timestamp, runId);
    return {
      totalItems: Number(aggregate.total_items),
      completedItems: Number(aggregate.completed_items),
      failedItems: Number(aggregate.failed_items),
      attentionItems: Number(aggregate.attention_items),
      activeItems: Number(aggregate.active_items),
      chargeCredits: Number(aggregate.charge_credits)
    };
  }

  _maybeFinalizeRun(connection, runId, timestamp) {
    const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(runId);
    if (!run) return null;
    const summary = this._refreshRunCounts(connection, runId, timestamp);
    if (summary.attentionItems > 0) {
      connection.prepare("UPDATE relay_runs SET status = 'attention', billing_status = 'awaiting_reconciliation', updated_at = ? WHERE id = ?").run(timestamp, runId);
      return { finalized: false, status: "attention" };
    }
    if (summary.activeItems > 0) {
      connection.prepare("UPDATE relay_runs SET status = 'running', updated_at = ? WHERE id = ?").run(timestamp, runId);
      return { finalized: false, status: "running" };
    }
    if (run.billing_status !== "held") return { finalized: false, status: run.status };
    const totalHeld = Number(run.held_customer_credits);
    const charged = summary.chargeCredits;
    const refundable = totalHeld - charged;
    if (refundable < 0) throw relayError("RELAY_BILLING_INVARIANT", "运行结算金额超过冻结金额。", { statusCode: 500 });
    const wallet = this._getWallet(connection, run.tenant_id);
    if (Number(wallet.held_credits) < totalHeld) throw relayError("RELAY_BILLING_INVARIANT", "客户冻结积分余额不一致。", { statusCode: 500 });
    let availableAfter = Number(wallet.available_credits);
    let heldAfter = Number(wallet.held_credits);
    if (charged > 0) {
      heldAfter -= charged;
      this._insertLedger(connection, {
        tenantId: run.tenant_id,
        providerAccountId: run.provider_account_id,
        runId,
        entryType: "settle",
        availableDelta: 0,
        heldDelta: -charged,
        availableAfter,
        heldAfter,
        customerCredits: charged,
        priceSnapshot: parseJson(run.price_snapshot_json, {}),
        note: `结算检测积分：${run.client_run_id}`,
        createdAt: timestamp
      });
    }
    if (refundable > 0) {
      availableAfter += refundable;
      heldAfter -= refundable;
      this._insertLedger(connection, {
        tenantId: run.tenant_id,
        providerAccountId: run.provider_account_id,
        runId,
        entryType: "release",
        availableDelta: refundable,
        heldDelta: -refundable,
        availableAfter,
        heldAfter,
        customerCredits: refundable,
        priceSnapshot: parseJson(run.price_snapshot_json, {}),
        note: `释放未执行积分：${run.client_run_id}`,
        createdAt: timestamp
      });
    }
    connection.prepare(`
      UPDATE relay_wallets
      SET available_credits = ?, held_credits = ?, revision = revision + 1, updated_at = ?
      WHERE tenant_id = ?
    `).run(availableAfter, heldAfter, timestamp, run.tenant_id);
    const status = summary.completedItems === summary.totalItems ? "completed" : summary.completedItems > 0 ? "partial" : "failed";
    const billingStatus = charged > 0 ? "settled" : "refunded";
    connection.prepare(`
      UPDATE relay_runs
      SET status = ?, billing_status = ?, settled_customer_credits = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, billingStatus, charged, timestamp, timestamp, runId);
    const finishedRun = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(runId);
    this._enqueueDelivery(connection, {
      tenantId: run.tenant_id,
      instanceId: run.instance_id,
      runId,
      deliveryKey: `run:${runId}:summary`,
      kind: "run_summary",
      payload: {
        relayRunId: runId,
        clientRunId: run.client_run_id,
        status,
        billingStatus,
        totalItems: summary.totalItems,
        completedItems: summary.completedItems,
        failedItems: summary.failedItems,
        chargedCredits: charged,
        completedAt: timestamp
      },
      createdAt: timestamp
    });
    this._audit(connection, { tenantId: run.tenant_id, instanceId: run.instance_id, actorType: "worker", action: "run.finalized", entityType: "run", entityId: runId, details: { status, charged, refundable } });
    return { finalized: true, run: publicRun(finishedRun) };
  }

  recordItemCompleted(input = {}) {
    const itemId = cleanText(input.relayItemId || input.itemId, "任务项 ID", { maximum: 128 });
    const attemptId = cleanText(input.attemptId, "执行尝试 ID", { maximum: 128 });
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const item = this._assertLeasedItem(connection, itemId, workerId, timestamp);
      const attempt = this._assertRunningAttempt(connection, attemptId, itemId, workerId);
      if (attempt.operation !== "poll") throw relayError("RELAY_STATE_CONFLICT", "完成结果只能由轮询操作写入。", { statusCode: 409 });
      const raw = redactSensitive(input.rawPayload || {});
      const normalized = redactSensitive(input.normalized || {});
      const observedAt = nowIso(input.observedAt || timestamp);
      const upstreamCredits = nonNegativeInteger(input.upstreamCredits, 0, 1_000_000);
      const rawJson = stableJson(raw);
      connection.prepare(`
        UPDATE relay_items
        SET status = 'completed', raw_payload_json = ?, normalized_json = ?, normalizer_version = ?, raw_payload_hash = ?,
            upstream_credits = ?, observed_at = ?, completed_at = ?, last_error_code = NULL, last_error_message = NULL,
            lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(rawJson, stableJson(normalized), optionalText(input.normalizerVersion || normalized.normalizerVersion || "aidso-normalizer-v1", 120), digestText(rawJson), upstreamCredits, observedAt, timestamp, timestamp, itemId);
      this._finishAttempt(connection, attempt, { outcome: "succeeded", providerStatus: input.providerStatus || "DONE", responseHash: digestText(rawJson), latencyMs: input.latencyMs, finishedAt: timestamp });
      const completed = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(itemId);
      const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(completed.run_id);
      if (upstreamCredits > 0) {
        this._insertLedger(connection, {
          tenantId: completed.tenant_id,
          providerAccountId: completed.provider_account_id,
          runId: completed.run_id,
          itemId,
          entryType: "upstream_cost",
          availableDelta: 0,
          heldDelta: 0,
          customerCredits: 0,
          upstreamCredits,
          priceSnapshot: { estimatedUpstreamCredits: Number(completed.estimated_upstream_credits), customerCredits: Number(completed.customer_credits) },
          note: `爱搜实际消耗：${completed.upstream_req_id || "unknown"}`,
          createdAt: timestamp
        });
      }
      this._enqueueDelivery(connection, {
        tenantId: completed.tenant_id,
        instanceId: completed.instance_id,
        runId: completed.run_id,
        itemId,
        deliveryKey: `item:${itemId}:terminal`,
        kind: "item_result",
        payload: this._itemDeliveryPayload(completed, run),
        createdAt: timestamp
      });
      this._maybeFinalizeRun(connection, completed.run_id, timestamp);
      return publicItem(completed, { includeResult: true, includeUpstream: true });
    });
  }

  recordItemFailure(input = {}) {
    const itemId = cleanText(input.relayItemId || input.itemId, "任务项 ID", { maximum: 128 });
    const attemptId = cleanText(input.attemptId, "执行尝试 ID", { maximum: 128 });
    const workerId = cleanText(input.workerId, "Worker ID", { maximum: 256 });
    const retryable = Boolean(input.retryable);
    const submissionUncertain = Boolean(input.submissionUncertain);
    const maxAttempts = positiveInteger(input.maxAttempts, 4, 100);
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const item = this._assertLeasedItem(connection, itemId, workerId, timestamp);
      const attempt = this._assertRunningAttempt(connection, attemptId, itemId, workerId);
      const error = sanitizeError(input.error);
      const attempts = attempt.operation === "submit" ? Number(item.submit_attempts) : Number(item.poll_attempts);
      let status;
      let outcome;
      let nextActionAt = timestamp;
      if (submissionUncertain && attempt.operation === "submit") {
        status = "submission_uncertain";
        outcome = "uncertain";
      } else if (retryable && attempts < maxAttempts) {
        status = attempt.operation === "submit" ? "submit_retry" : "poll_retry";
        outcome = "retry_scheduled";
        nextActionAt = nowIso(input.nextActionAt);
      } else {
        status = retryable ? "dead_letter" : "failed";
        outcome = "failed";
      }
      connection.prepare(`
        UPDATE relay_items
        SET status = ?, last_error_code = ?, last_error_message = ?, next_action_at = ?,
            lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(status, error.code, error.message, nextActionAt, timestamp, itemId);
      this._finishAttempt(connection, attempt, { outcome, errorCode: error.code, errorMessage: error.message, providerStatus: input.providerStatus || "", latencyMs: input.latencyMs, finishedAt: timestamp });
      const failed = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(itemId);
      const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(failed.run_id);
      if (status === "submission_uncertain") {
        this._openReconciliationCase(connection, failed, {
          actorType: "worker",
          reasonCode: error.code,
          reasonMessage: error.message,
          evidence: {
            source: "worker_failure",
            providerStatus: input.providerStatus || "",
            attemptId,
            operation: attempt.operation
          }
        });
        this._enqueueDelivery(connection, {
          tenantId: failed.tenant_id,
          instanceId: failed.instance_id,
          runId: failed.run_id,
          itemId,
          deliveryKey: `item:${itemId}:attention`,
          kind: "item_attention",
          payload: this._itemDeliveryPayload(failed, run, "item_attention"),
          createdAt: timestamp
        });
      } else if (ITEM_TERMINAL_STATUSES.has(status)) {
        this._enqueueDelivery(connection, {
          tenantId: failed.tenant_id,
          instanceId: failed.instance_id,
          runId: failed.run_id,
          itemId,
          deliveryKey: `item:${itemId}:terminal`,
          kind: "item_result",
          payload: this._itemDeliveryPayload(failed, run),
          createdAt: timestamp
        });
      }
      this._maybeFinalizeRun(connection, failed.run_id, timestamp);
      return { item: publicItem(failed), retryScheduled: status === "submit_retry" || status === "poll_retry", needsReconciliation: status === "submission_uncertain" };
    });
  }

  retryItem(itemId, options = {}) {
    const id = cleanText(itemId, "任务项 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const item = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id);
      if (!item) throw relayError("RELAY_NOT_FOUND", "任务项不存在。", { statusCode: 404 });
      if (!["failed", "dead_letter", "submission_uncertain"].includes(item.status)) throw relayError("RELAY_STATE_CONFLICT", "当前任务项不需要人工重试。", { statusCode: 409 });
      const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id);
      if (!run || !["held", "awaiting_reconciliation"].includes(run.billing_status)) {
        throw relayError("RELAY_RETRY_REQUIRES_NEW_RUN", "该运行已经完成结算；请创建新的检测运行，不可直接重试。", { statusCode: 409 });
      }
      const nextStatus = item.upstream_req_id ? "poll_retry" : "submit_retry";
      const reconciliationCase = item.status === "submission_uncertain"
        ? (this._latestReconciliationCase(connection, item.id, { onlyOpen: true })
          || this._openReconciliationCase(connection, item, {
            actorType: options.actorType || "operator",
            reasonCode: item.last_error_code,
            reasonMessage: item.last_error_message,
            evidence: { source: "direct_retry_legacy_attention" },
            now: timestamp
          }))
        : null;
      connection.prepare(`
        UPDATE relay_items
        SET status = ?, next_action_at = ?, lease_owner = NULL, lease_until = NULL,
            last_error_code = NULL, last_error_message = NULL, updated_at = ?
        WHERE id = ?
      `).run(nextStatus, timestamp, timestamp, id);
      connection.prepare(`
        UPDATE relay_runs
        SET status = 'running', billing_status = 'held', completed_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(timestamp, item.run_id);
      const resolvedCase = reconciliationCase
        ? this._resolveReconciliationCase(connection, reconciliationCase, {
          resolution: item.upstream_req_id ? "confirmed_success" : "retry",
          note: optionalText(options.note, 2_000) || "操作员通过重试动作结束人工对账。",
          actorType: options.actorType || "operator",
          evidence: { outcome: nextStatus, source: "retry_item" },
          now: timestamp
        })
        : null;
      this._audit(connection, { tenantId: item.tenant_id, instanceId: item.instance_id, actorType: options.actorType || "operator", action: "item.retry_requested", entityType: "item", entityId: id, details: { nextStatus, reconciliationId: resolvedCase?.id || null } });
      return publicItem(connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id), { reconciliation: resolvedCase });
    });
  }

  /**
   * Resolve a submission-uncertain item after an operator has reconciled the
   * upstream request. The safe default is a refund: the item is terminally
   * failed, the held customer credits are released by normal run finalization,
   * and the client receives a terminal item delivery plus run summary.
   */
  reconcileAttentionItem(itemId, options = {}) {
    const id = cleanText(itemId, "任务项 ID", { maximum: 128 });
    const resolution = cleanText(options.resolution || "refund", "处理方式", { maximum: 32 }).toLowerCase();
    if (!RECONCILIATION_RESOLUTIONS.has(resolution)) {
      throw relayError("RELAY_RECONCILIATION_UNSUPPORTED", "当前仅支持将不确定提交按退款处理；确认上游成功后请创建新的检测运行。", { statusCode: 422 });
    }
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const item = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id);
      if (!item) throw relayError("RELAY_NOT_FOUND", "任务项不存在。", { statusCode: 404 });
      if (item.status !== "submission_uncertain") {
        throw relayError("RELAY_STATE_CONFLICT", "只有 submission_uncertain 任务项可以做人工对账。", { statusCode: 409, details: { status: item.status } });
      }
      const run = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id);
      if (!run || run.billing_status !== "awaiting_reconciliation") {
        throw relayError("RELAY_STATE_CONFLICT", "该运行当前不在待对账状态。", { statusCode: 409 });
      }
      const actorType = optionalText(options.actorType || "operator", 120) || "operator";
      const operatorNote = optionalText(options.note, 2_000);
      const reconciliationCase = this._latestReconciliationCase(connection, item.id, { onlyOpen: true })
        || this._openReconciliationCase(connection, item, {
          actorType,
          reasonCode: item.last_error_code,
          reasonMessage: item.last_error_message,
          evidence: { source: "legacy_attention_item" },
          now: timestamp
        });

      if (resolution === "retry") {
        if (item.upstream_req_id) {
          throw relayError("RELAY_RECONCILIATION_RETRY_UNSAFE", "任务已关联上游 reqId，不能重新提交；请使用 confirmed_success 继续轮询。", { statusCode: 409 });
        }
        const note = operatorNote || "操作员核验上游未受理，安全重新提交。";
        connection.prepare("UPDATE relay_items SET status = 'submit_retry', next_action_at = ?, lease_owner = NULL, lease_until = NULL, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE id = ? AND status = 'submission_uncertain'")
          .run(timestamp, timestamp, id);
        connection.prepare("UPDATE relay_runs SET status = 'running', billing_status = 'held', completed_at = NULL, updated_at = ? WHERE id = ?")
          .run(timestamp, item.run_id);
        const resolvedCase = this._resolveReconciliationCase(connection, reconciliationCase, {
          resolution,
          note,
          actorType,
          evidence: { outcome: "safe_resubmit" },
          now: timestamp
        });
        const retried = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id);
        this._audit(connection, {
          tenantId: item.tenant_id,
          instanceId: item.instance_id,
          actorType,
          action: "item.reconciled_retry",
          entityType: "item",
          entityId: id,
          details: { reconciliationId: resolvedCase.id, note: note.slice(0, 500) },
          createdAt: timestamp
        });
        return {
          item: publicItem(retried, { reconciliation: resolvedCase }),
          run: publicRun(connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id)),
          reconciliation: publicReconciliationCase(resolvedCase),
          resolution
        };
      }

      if (resolution === "confirmed_success") {
        const upstreamReqId = cleanText(options.upstreamReqId || options.reqId, "爱搜 reqId", { maximum: 512 });
        const duplicateReqId = connection.prepare("SELECT id FROM relay_items WHERE upstream_req_id = ? AND id <> ?").get(upstreamReqId, id);
        if (duplicateReqId) {
          throw relayError("RELAY_UPSTREAM_REQID_CONFLICT", "该爱搜 reqId 已关联到其他任务项。", { statusCode: 409 });
        }
        const note = operatorNote || "操作员确认上游已受理，恢复结果轮询。";
        connection.prepare("UPDATE relay_items SET status = 'poll_retry', upstream_req_id = ?, next_action_at = ?, lease_owner = NULL, lease_until = NULL, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE id = ? AND status = 'submission_uncertain'")
          .run(upstreamReqId, timestamp, timestamp, id);
        connection.prepare("UPDATE relay_runs SET status = 'running', billing_status = 'held', completed_at = NULL, updated_at = ? WHERE id = ?")
          .run(timestamp, item.run_id);
        const resolvedCase = this._resolveReconciliationCase(connection, reconciliationCase, {
          resolution,
          note,
          actorType,
          evidence: { outcome: "continue_poll", upstreamReqId },
          now: timestamp
        });
        const recovered = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id);
        this._audit(connection, {
          tenantId: item.tenant_id,
          instanceId: item.instance_id,
          actorType,
          action: "item.reconciled_confirmed_success",
          entityType: "item",
          entityId: id,
          details: { reconciliationId: resolvedCase.id, upstreamReqId, note: note.slice(0, 500) },
          createdAt: timestamp
        });
        return {
          item: publicItem(recovered, { reconciliation: resolvedCase }),
          run: publicRun(connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id)),
          reconciliation: publicReconciliationCase(resolvedCase),
          resolution
        };
      }

      connection.prepare(`
        UPDATE relay_items
        SET status = 'failed', last_error_code = 'RELAY_RECONCILED_REFUND',
            last_error_message = ?, next_action_at = ?, lease_owner = NULL,
            lease_until = NULL, updated_at = ?
        WHERE id = ? AND status = 'submission_uncertain'
      `).run(String(options.note || "操作员确认上游提交不确定，按安全策略释放客户额度。 ").slice(0, 2_000), timestamp, timestamp, id);
      // Re-open billing finalization so _maybeFinalizeRun can append the
      // immutable release ledger entry and enqueue a run summary.
      connection.prepare("UPDATE relay_runs SET status = 'running', billing_status = 'held', completed_at = NULL, updated_at = ? WHERE id = ?").run(timestamp, item.run_id);
      const failed = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id);
      const currentRun = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(item.run_id);
      this._enqueueDelivery(connection, {
        tenantId: failed.tenant_id,
        instanceId: failed.instance_id,
        runId: failed.run_id,
        itemId: failed.id,
        deliveryKey: `item:${failed.id}:terminal`,
        kind: "item_result",
        payload: this._itemDeliveryPayload(failed, currentRun),
        createdAt: timestamp
      });
      const finalized = this._maybeFinalizeRun(connection, failed.run_id, timestamp);
      const refundNote = operatorNote || "操作员确认上游提交不确定，按安全策略释放客户额度。";
      const resolvedCase = this._resolveReconciliationCase(connection, reconciliationCase, {
        resolution,
        note: refundNote,
        actorType,
        evidence: { outcome: "customer_credit_release" },
        now: timestamp
      });
      const finalRun = finalized?.run || publicRun(connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(failed.run_id));
      const refundedCredits = Math.max(0, Number(run.held_customer_credits) - Number(finalRun.settledCustomerCredits || 0));
      this._audit(connection, {
        tenantId: failed.tenant_id,
        instanceId: failed.instance_id,
        actorType: options.actorType || "operator",
        action: "item.reconciled_refund",
        entityType: "item",
        entityId: failed.id,
        details: { resolution, note: String(options.note || "").slice(0, 500) }
      });
      return {
        item: publicItem(connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(id), { reconciliation: resolvedCase }),
        run: finalRun,
        reconciliation: publicReconciliationCase(resolvedCase),
        refundedCredits,
        resolution
      };
    });
  }

  cancelRun(relayRunId, options = {}) {
    const runId = cleanText(relayRunId, "中转运行 ID", { maximum: 128 });
    const instanceId = optionalText(options.instanceId, 128);
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const run = connection.prepare(instanceId ? "SELECT * FROM relay_runs WHERE id = ? AND instance_id = ?" : "SELECT * FROM relay_runs WHERE id = ?").get(...(instanceId ? [runId, instanceId] : [runId]));
      if (!run) throw relayError("RELAY_NOT_FOUND", "检测运行不存在。", { statusCode: 404 });
      if (["completed", "failed", "partial", "cancelled"].includes(run.status)) return publicRun(run);
      const activeItems = connection.prepare("SELECT * FROM relay_items WHERE run_id = ? AND status IN ('queued', 'submit_retry', 'submitted', 'poll_retry')").all(runId);
      connection.prepare(`
        UPDATE relay_items
        SET status = 'cancelled', last_error_code = 'RELAY_CANCELLED', last_error_message = '检测运行已取消。',
            lease_owner = NULL, lease_until = NULL, next_action_at = ?, updated_at = ?
        WHERE run_id = ? AND status IN ('queued', 'submit_retry', 'submitted', 'poll_retry')
      `).run(timestamp, timestamp, runId);
      const currentRun = connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(runId);
      for (const original of activeItems) {
        const item = connection.prepare("SELECT * FROM relay_items WHERE id = ?").get(original.id);
        this._enqueueDelivery(connection, {
          tenantId: item.tenant_id,
          instanceId: item.instance_id,
          runId,
          itemId: item.id,
          deliveryKey: `item:${item.id}:terminal`,
          kind: "item_result",
          payload: this._itemDeliveryPayload(item, currentRun),
          createdAt: timestamp
        });
      }
      this._maybeFinalizeRun(connection, runId, timestamp);
      this._audit(connection, { tenantId: run.tenant_id, instanceId: run.instance_id, actorType: options.actorType || "operator", action: "run.cancelled", entityType: "run", entityId: runId, details: {} });
      return publicRun(connection.prepare("SELECT * FROM relay_runs WHERE id = ?").get(runId));
    });
  }

  _deadLetterExhaustedDeliveries(connection, instanceId, timestamp) {
    const maxAttempts = this.deliveryMaxAttempts;
    const rows = connection.prepare(`
      SELECT * FROM relay_deliveries
      WHERE instance_id = ?
        AND attempt_count >= ?
        AND (
          (status = 'queued' AND available_at <= ?)
          OR (status = 'leased' AND lease_until IS NOT NULL AND lease_until <= ?)
        )
      ORDER BY sequence ASC
    `).all(instanceId, maxAttempts, timestamp, timestamp);
    if (!rows.length) return [];
    const reason = `客户交付达到 ${maxAttempts} 次最大尝试，已转入死信队列。`;
    const update = connection.prepare(`
      UPDATE relay_deliveries
      SET status = 'dead_letter', lease_owner = NULL, lease_until = NULL,
          last_error = COALESCE(last_error, ?), updated_at = ?
      WHERE id = ? AND status IN ('queued', 'leased')
    `);
    const deadLettered = [];
    for (const row of rows) {
      if (!update.run(reason, timestamp, row.id).changes) continue;
      deadLettered.push(row);
      this._audit(connection, {
        tenantId: row.tenant_id,
        instanceId: row.instance_id,
        actorType: "system",
        action: "delivery.dead_lettered",
        entityType: "delivery",
        entityId: row.id,
        details: { attemptCount: Number(row.attempt_count), maxAttempts, reason },
        createdAt: timestamp
      });
    }
    return deadLettered;
  }

  leaseDeliveries(input = {}) {
    const instanceId = cleanText(input.instanceId, "实例 ID", { maximum: 128 });
    const consumerId = cleanText(input.consumerId || input.deliveryConsumerId || "client-pull", "交付消费者 ID", { maximum: 256 });
    const limit = positiveInteger(input.limit, 50, 200);
    const leaseMs = positiveInteger(input.leaseMs, 120_000, 30 * 60_000);
    const timestamp = nowIso(input.now);
    const leaseUntil = isoAfter(leaseMs, new Date(timestamp));
    return this.transaction((connection) => {
      const instance = this._getInstanceRow(connection, instanceId);
      this._deadLetterExhaustedDeliveries(connection, instanceId, timestamp);
      const rows = connection.prepare(`
        SELECT * FROM relay_deliveries
        WHERE instance_id = ?
          AND status IN ('queued', 'leased')
          AND available_at <= ?
          AND (lease_until IS NULL OR lease_until <= ?)
        ORDER BY sequence ASC
        LIMIT ?
      `).all(instanceId, timestamp, timestamp, limit);
      const update = connection.prepare(`
        UPDATE relay_deliveries
        SET status = 'leased', lease_owner = ?, lease_until = ?, attempt_count = attempt_count + 1, updated_at = ?
        WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?) AND status IN ('queued', 'leased')
      `);
      const deliveries = [];
      for (const row of rows) {
        const changed = update.run(consumerId, leaseUntil, timestamp, row.id, timestamp);
        if (!changed.changes) continue;
        deliveries.push({
          deliveryId: row.id,
          sequence: Number(row.sequence),
          kind: row.kind,
          payloadHash: row.payload_hash,
          payload: parseJson(row.payload_json, {}),
          leaseUntil,
          attemptCount: Number(row.attempt_count) + 1,
          maxAttempts: this.deliveryMaxAttempts
        });
      }
      if (deliveries.length) this._audit(connection, { tenantId: instance.tenant_id, instanceId, actorType: "instance", action: "deliveries.leased", entityType: "delivery_batch", entityId: deliveries[0].deliveryId, details: { count: deliveries.length, consumerId } });
      return deliveries;
    });
  }

  acknowledgeDelivery(input = {}) {
    const instanceId = cleanText(input.instanceId, "实例 ID", { maximum: 128 });
    const deliveryId = cleanText(input.deliveryId, "交付 ID", { maximum: 128 });
    const consumerId = optionalText(input.consumerId || input.deliveryConsumerId, 256);
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const delivery = connection.prepare("SELECT * FROM relay_deliveries WHERE id = ? AND instance_id = ?").get(deliveryId, instanceId);
      if (!delivery) throw relayError("RELAY_NOT_FOUND", "交付记录不存在。", { statusCode: 404 });
      if (input.payloadHash && !timingSafeTextEqual(delivery.payload_hash, String(input.payloadHash))) {
        throw relayError("RELAY_DELIVERY_HASH_MISMATCH", "交付确认的 payloadHash 不匹配。", { statusCode: 409 });
      }
      if (delivery.status === "acknowledged") return { deliveryId, acknowledged: true, idempotent: true, acknowledgedAt: delivery.acknowledged_at };
      if (delivery.status !== "leased" || (consumerId && delivery.lease_owner !== consumerId)) throw relayError("RELAY_DELIVERY_LEASE_CONFLICT", "交付记录未由当前客户端租用。", { statusCode: 409 });
      connection.prepare(`
        UPDATE relay_deliveries
        SET status = 'acknowledged', acknowledged_at = ?, lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(timestamp, timestamp, deliveryId);
      this._audit(connection, { tenantId: delivery.tenant_id, instanceId, actorType: "instance", action: "delivery.acknowledged", entityType: "delivery", entityId: deliveryId, details: { payloadHash: delivery.payload_hash } });
      return { deliveryId, acknowledged: true, idempotent: false, acknowledgedAt: timestamp };
    });
  }

  releaseDelivery(input = {}) {
    const instanceId = cleanText(input.instanceId, "实例 ID", { maximum: 128 });
    const deliveryId = cleanText(input.deliveryId, "交付 ID", { maximum: 128 });
    const consumerId = optionalText(input.consumerId || input.deliveryConsumerId, 256);
    const delayMs = nonNegativeInteger(input.delayMs, 0, 86_400_000);
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const delivery = connection.prepare("SELECT * FROM relay_deliveries WHERE id = ? AND instance_id = ?").get(deliveryId, instanceId);
      if (!delivery) throw relayError("RELAY_NOT_FOUND", "交付记录不存在。", { statusCode: 404 });
      if (delivery.status !== "leased" || (consumerId && delivery.lease_owner !== consumerId)) throw relayError("RELAY_DELIVERY_LEASE_CONFLICT", "交付记录未由当前客户端租用。", { statusCode: 409 });
      const error = optionalText(input.error, 1_000);
      const exhausted = Number(delivery.attempt_count) >= this.deliveryMaxAttempts;
      if (exhausted) {
        const reason = error || `客户交付达到 ${this.deliveryMaxAttempts} 次最大尝试，已转入死信队列。`;
        connection.prepare(`
          UPDATE relay_deliveries
          SET status = 'dead_letter', lease_owner = NULL, lease_until = NULL,
              last_error = ?, updated_at = ?
          WHERE id = ?
        `).run(reason, timestamp, deliveryId);
        this._audit(connection, {
          tenantId: delivery.tenant_id,
          instanceId,
          actorType: "instance",
          action: "delivery.dead_lettered",
          entityType: "delivery",
          entityId: deliveryId,
          details: { attemptCount: Number(delivery.attempt_count), maxAttempts: this.deliveryMaxAttempts, reason },
          createdAt: timestamp
        });
        return { deliveryId, released: false, deadLettered: true, attemptCount: Number(delivery.attempt_count), maxAttempts: this.deliveryMaxAttempts };
      }
      connection.prepare(`
        UPDATE relay_deliveries
        SET status = 'queued', lease_owner = NULL, lease_until = NULL, available_at = ?, last_error = ?, updated_at = ?
        WHERE id = ?
      `).run(isoAfter(delayMs, new Date(timestamp)), error || null, timestamp, deliveryId);
      return { deliveryId, released: true, deadLettered: false, attemptCount: Number(delivery.attempt_count), maxAttempts: this.deliveryMaxAttempts };
    });
  }

  listDeadLetterDeliveries(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const rows = this.db.prepare(`
      SELECT * FROM relay_deliveries
      WHERE status = 'dead_letter'
      ORDER BY updated_at ASC, sequence ASC
      LIMIT ?
    `).all(limit);
    return rows.map((row) => publicDelivery(row));
  }

  requeueDeadLetterDelivery(deliveryId, options = {}) {
    const id = cleanText(deliveryId, "交付 ID", { maximum: 128 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const delivery = connection.prepare("SELECT * FROM relay_deliveries WHERE id = ?").get(id);
      if (!delivery) throw relayError("RELAY_NOT_FOUND", "交付记录不存在。", { statusCode: 404 });
      if (delivery.status !== "dead_letter") {
        throw relayError("RELAY_STATE_CONFLICT", "只有死信交付可以重新入队。", { statusCode: 409, details: { status: delivery.status } });
      }
      if (digestText(delivery.payload_json) !== delivery.payload_hash) {
        throw relayError("RELAY_DELIVERY_PAYLOAD_EXPIRED", "该死信交付的原始结果已按留存策略清除，不能安全重投；请由客户实例重新授权、报价并提交新的检测运行。", { statusCode: 409 });
      }
      const previousAttempts = Number(delivery.attempt_count);
      connection.prepare(`
        UPDATE relay_deliveries
        SET status = 'queued', attempt_count = 0, available_at = ?, lease_owner = NULL,
            lease_until = NULL, last_error = NULL, updated_at = ?
        WHERE id = ? AND status = 'dead_letter'
      `).run(timestamp, timestamp, id);
      this._audit(connection, {
        tenantId: delivery.tenant_id,
        instanceId: delivery.instance_id,
        actorType: options.actorType || "operator",
        action: "delivery.requeued",
        entityType: "delivery",
        entityId: id,
        details: { previousAttempts, note: optionalText(options.note, 500) },
        createdAt: timestamp
      });
      return publicDelivery(connection.prepare("SELECT * FROM relay_deliveries WHERE id = ?").get(id));
    });
  }

  createPaymentOrder(input = {}) {
    const tenantId = cleanText(input.tenantId, "客户租户 ID", { maximum: 128 });
    const idempotencyKey = cleanText(input.idempotencyKey, "支付订单幂等键", { maximum: 512 });
    const paymentChannel = cleanText(input.paymentChannel, "收款渠道", { maximum: 64 }).toLowerCase();
    if (!PAYMENT_CHANNELS.has(paymentChannel)) {
      throw relayError("RELAY_VALIDATION", "不支持的收款渠道。", { statusCode: 422 });
    }
    const rawAmountCents = Number(input.amountCents);
    if (!Number.isInteger(rawAmountCents) || rawAmountCents < 0 || rawAmountCents > 1_000_000_000_000) {
      throw relayError("RELAY_VALIDATION", "收款金额必须是非负整数分。", { statusCode: 422 });
    }
    if (paymentChannel !== "contract_grant" && rawAmountCents <= 0) {
      throw relayError("RELAY_VALIDATION", "实际收款订单金额必须大于零。", { statusCode: 422 });
    }
    const credits = positiveInteger(input.credits, 0, 1_000_000_000);
    const currency = cleanText(input.currency || "CNY", "币种", { maximum: 3 }).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw relayError("RELAY_VALIDATION", "币种必须是三位 ISO 代码。", { statusCode: 422 });
    const externalOrderReference = optionalText(input.externalOrderReference || input.externalId, 512);
    const timestamp = nowIso(input.now);
    const orderId = optionalText(input.paymentOrderId || input.id, 128) || randomId("payment");
    return this.transaction((connection) => {
      const tenant = connection.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(tenantId);
      if (!tenant) throw relayError("RELAY_NOT_FOUND", "客户租户不存在。", { statusCode: 404 });
      const existingByIdempotency = connection.prepare(`
        SELECT * FROM relay_payment_orders WHERE tenant_id = ? AND idempotency_key = ?
      `).get(tenantId, idempotencyKey);
      if (existingByIdempotency) {
        const matches = existingByIdempotency.payment_channel === paymentChannel
          && Number(existingByIdempotency.amount_cents) === rawAmountCents
          && existingByIdempotency.currency === currency
          && Number(existingByIdempotency.credits) === credits
          && existingByIdempotency.external_order_reference === externalOrderReference;
        if (!matches) {
          throw relayError("RELAY_IDEMPOTENCY_MISMATCH", "支付订单幂等键已用于不同的收款请求。", { statusCode: 409 });
        }
        return { order: publicPaymentOrder(existingByIdempotency), created: false, idempotent: true };
      }
      if (externalOrderReference) {
        const existingByExternalReference = connection.prepare(`
          SELECT * FROM relay_payment_orders WHERE tenant_id = ? AND external_order_reference = ?
        `).get(tenantId, externalOrderReference);
        if (existingByExternalReference) {
          const matches = existingByExternalReference.payment_channel === paymentChannel
            && Number(existingByExternalReference.amount_cents) === rawAmountCents
            && existingByExternalReference.currency === currency
            && Number(existingByExternalReference.credits) === credits;
          if (!matches) {
            throw relayError("RELAY_CONFLICT", "该外部订单号已对应不同的收款订单。", { statusCode: 409 });
          }
          return { order: publicPaymentOrder(existingByExternalReference), created: false, idempotent: true };
        }
      }
      connection.prepare(`
        INSERT INTO relay_payment_orders(
          id, tenant_id, status, payment_channel, amount_cents, currency, credits,
          external_order_reference, metadata_json, idempotency_key, created_by,
          created_at, updated_at
        ) VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, tenantId, paymentChannel, rawAmountCents, currency, credits,
        externalOrderReference, safeJson(input.metadata || {}), idempotencyKey,
        optionalText(input.actorType || "operator", 120) || "operator", timestamp, timestamp
      );
      this._audit(connection, {
        tenantId,
        actorType: input.actorType || "operator",
        action: "payment_order.created",
        entityType: "payment_order",
        entityId: orderId,
        details: { paymentChannel, amountCents: rawAmountCents, currency, credits, hasExternalOrderReference: Boolean(externalOrderReference) },
        createdAt: timestamp
      });
      return { order: publicPaymentOrder(connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(orderId)), created: true, idempotent: false };
    });
  }

  getPaymentOrder(paymentOrderId) {
    const id = cleanText(paymentOrderId, "支付订单 ID", { maximum: 128 });
    return publicPaymentOrder(this.db.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(id));
  }

  listPaymentOrders(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const tenantId = optionalText(options.tenantId, 128);
    const status = optionalText(options.status, 64);
    if (status && !PAYMENT_ORDER_STATUSES.has(status)) throw relayError("RELAY_VALIDATION", "不支持的支付订单状态。", { statusCode: 422 });
    const filters = [];
    const parameters = [];
    if (tenantId) { filters.push("tenant_id = ?"); parameters.push(tenantId); }
    if (status) { filters.push("status = ?"); parameters.push(status); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.db.prepare(`
      SELECT * FROM relay_payment_orders ${where}
      ORDER BY created_at DESC LIMIT ?
    `).all(...parameters, limit);
    return rows.map((row) => publicPaymentOrder(row));
  }

  confirmPaymentOrder(paymentOrderId, options = {}) {
    const id = cleanText(paymentOrderId, "支付订单 ID", { maximum: 128 });
    const paymentReference = cleanText(options.paymentReference, "收款流水号或合同编号", { maximum: 512 });
    const confirmationNote = cleanText(options.note || options.confirmationNote, "到账核验说明", { maximum: 1_000 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const order = connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(id);
      if (!order) throw relayError("RELAY_NOT_FOUND", "支付订单不存在。", { statusCode: 404 });
      if (order.status === "paid") {
        return {
          order: publicPaymentOrder(order),
          wallet: this.getTenant(order.tenant_id)?.wallet,
          ledgerId: order.ledger_id || null,
          idempotent: true
        };
      }
      if (order.status !== "pending_payment") {
        throw relayError("RELAY_STATE_CONFLICT", "只有待收款订单可以确认到账。", { statusCode: 409, details: { status: order.status } });
      }
      const duplicatePayment = connection.prepare(`
        SELECT id FROM relay_payment_orders WHERE payment_reference = ? AND id <> ?
      `).get(paymentReference, id);
      if (duplicatePayment) {
        throw relayError("RELAY_CONFLICT", "该收款流水号或合同编号已经用于另一笔订单。", { statusCode: 409 });
      }
      const tenant = connection.prepare("SELECT * FROM relay_tenants WHERE id = ?").get(order.tenant_id);
      if (!tenant) throw relayError("RELAY_NOT_FOUND", "支付订单所属客户不存在。", { statusCode: 404 });
      const wallet = this._getWallet(connection, order.tenant_id);
      const availableAfter = Number(wallet.available_credits) + Number(order.credits);
      connection.prepare(`
        UPDATE relay_wallets
        SET available_credits = ?, revision = revision + 1, updated_at = ?
        WHERE tenant_id = ?
      `).run(availableAfter, timestamp, order.tenant_id);
      const ledgerId = randomId("ledger");
      this._insertLedger(connection, {
        id: ledgerId,
        tenantId: order.tenant_id,
        entryType: "top_up",
        availableDelta: Number(order.credits),
        heldDelta: 0,
        availableAfter,
        heldAfter: Number(wallet.held_credits),
        customerCredits: Number(order.credits),
        idempotencyKey: `payment_order:${id}`,
        note: `支付订单 ${id} 经人工核验到账后入账。`,
        createdAt: timestamp
      });
      const actorType = optionalText(options.actorType || "operator", 120) || "operator";
      connection.prepare(`
        UPDATE relay_payment_orders
        SET status = 'paid', payment_reference = ?, confirmation_note = ?, ledger_id = ?,
            confirmed_by = ?, confirmed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_payment'
      `).run(paymentReference, confirmationNote, ledgerId, actorType, timestamp, timestamp, id);
      this._audit(connection, {
        tenantId: order.tenant_id,
        actorType,
        action: "payment_order.confirmed",
        entityType: "payment_order",
        entityId: id,
        details: { ledgerId, credits: Number(order.credits), amountCents: Number(order.amount_cents), currency: order.currency },
        createdAt: timestamp
      });
      return {
        order: publicPaymentOrder(connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(id)),
        wallet: this.getTenant(order.tenant_id)?.wallet,
        ledgerId,
        idempotent: false
      };
    });
  }

  cancelPaymentOrder(paymentOrderId, options = {}) {
    const id = cleanText(paymentOrderId, "支付订单 ID", { maximum: 128 });
    const note = cleanText(options.note || options.cancellationNote, "作废说明", { maximum: 1_000 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const order = connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(id);
      if (!order) throw relayError("RELAY_NOT_FOUND", "支付订单不存在。", { statusCode: 404 });
      if (order.status === "cancelled") return { order: publicPaymentOrder(order), idempotent: true };
      if (order.status !== "pending_payment") {
        throw relayError("RELAY_STATE_CONFLICT", "已到账订单不能在中转站直接作废或退款；请走实际收款渠道的财务退款流程。", { statusCode: 409, details: { status: order.status } });
      }
      const actorType = optionalText(options.actorType || "operator", 120) || "operator";
      connection.prepare(`
        UPDATE relay_payment_orders
        SET status = 'cancelled', cancellation_note = ?, cancelled_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_payment'
      `).run(note, timestamp, timestamp, id);
      this._audit(connection, {
        tenantId: order.tenant_id,
        actorType,
        action: "payment_order.cancelled",
        entityType: "payment_order",
        entityId: id,
        details: { note },
        createdAt: timestamp
      });
      return { order: publicPaymentOrder(connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(id)), idempotent: false };
    });
  }

  createInvoiceRequest(input = {}) {
    const paymentOrderId = cleanText(input.paymentOrderId, "支付订单 ID", { maximum: 128 });
    const idempotencyKey = cleanText(input.idempotencyKey, "开票申请幂等键", { maximum: 512 });
    const billingTitle = cleanText(input.billingTitle, "发票抬头", { maximum: 512 });
    const invoiceId = optionalText(input.invoiceRequestId || input.id, 128) || randomId("invoice");
    const timestamp = nowIso(input.now);
    return this.transaction((connection) => {
      const order = connection.prepare("SELECT * FROM relay_payment_orders WHERE id = ?").get(paymentOrderId);
      if (!order) throw relayError("RELAY_NOT_FOUND", "支付订单不存在。", { statusCode: 404 });
      if (order.status !== "paid" || !order.ledger_id) {
        throw relayError("RELAY_STATE_CONFLICT", "只有已确认到账的支付订单可以申请开票。", { statusCode: 409, details: { status: order.status } });
      }
      if (Number(order.amount_cents) <= 0) {
        throw relayError("RELAY_STATE_CONFLICT", "零金额赠送订单不能创建发票申请。", { statusCode: 409 });
      }
      const existingByIdempotency = connection.prepare(`
        SELECT * FROM relay_invoice_requests WHERE tenant_id = ? AND idempotency_key = ?
      `).get(order.tenant_id, idempotencyKey);
      if (existingByIdempotency) {
        if (existingByIdempotency.payment_order_id !== paymentOrderId || existingByIdempotency.billing_title !== billingTitle) {
          throw relayError("RELAY_IDEMPOTENCY_MISMATCH", "开票申请幂等键已用于不同的请求。", { statusCode: 409 });
        }
        return { invoice: publicInvoiceRequest(existingByIdempotency), created: false, idempotent: true };
      }
      const existingForOrder = connection.prepare("SELECT * FROM relay_invoice_requests WHERE payment_order_id = ?").get(paymentOrderId);
      if (existingForOrder) {
        if (existingForOrder.billing_title !== billingTitle) {
          throw relayError("RELAY_CONFLICT", "该支付订单已有不同抬头的开票申请。", { statusCode: 409 });
        }
        return { invoice: publicInvoiceRequest(existingForOrder), created: false, idempotent: true };
      }
      const billing = {
        title: billingTitle,
        taxId: optionalText(input.taxId, 128),
        recipientName: optionalText(input.recipientName, 240),
        recipientEmail: optionalText(input.recipientEmail, 320)
      };
      const envelope = this.secretBox.encrypt(stableJson(billing), `invoice:${invoiceId}:billing`);
      connection.prepare(`
        INSERT INTO relay_invoice_requests(
          id, payment_order_id, tenant_id, status, amount_cents, currency, billing_title,
          billing_envelope_json, metadata_json, idempotency_key, requested_by, requested_at, updated_at
        ) VALUES (?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId, paymentOrderId, order.tenant_id, Number(order.amount_cents), order.currency,
        billingTitle, safeJson(envelope), safeJson(input.metadata || {}), idempotencyKey,
        optionalText(input.actorType || "operator", 120) || "operator", timestamp, timestamp
      );
      this._audit(connection, {
        tenantId: order.tenant_id,
        actorType: input.actorType || "operator",
        action: "invoice_request.created",
        entityType: "invoice_request",
        entityId: invoiceId,
        details: { paymentOrderId, amountCents: Number(order.amount_cents), currency: order.currency },
        createdAt: timestamp
      });
      return {
        invoice: publicInvoiceRequest(connection.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(invoiceId)),
        created: true,
        idempotent: false
      };
    });
  }

  getInvoiceRequest(invoiceRequestId, options = {}) {
    const id = cleanText(invoiceRequestId, "开票申请 ID", { maximum: 128 });
    const row = this.db.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(id);
    return publicInvoiceRequest(row, { includeBilling: options.includeBilling === true, secretBox: this.secretBox });
  }

  listInvoiceRequests(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const tenantId = optionalText(options.tenantId, 128);
    const status = optionalText(options.status, 64);
    if (status && !INVOICE_REQUEST_STATUSES.has(status)) throw relayError("RELAY_VALIDATION", "不支持的开票申请状态。", { statusCode: 422 });
    const filters = [];
    const parameters = [];
    if (tenantId) { filters.push("tenant_id = ?"); parameters.push(tenantId); }
    if (status) { filters.push("status = ?"); parameters.push(status); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.db.prepare(`
      SELECT * FROM relay_invoice_requests ${where}
      ORDER BY requested_at DESC LIMIT ?
    `).all(...parameters, limit);
    return rows.map((row) => publicInvoiceRequest(row, { includeBilling: options.includeBilling === true, secretBox: this.secretBox }));
  }

  issueInvoiceRequest(invoiceRequestId, options = {}) {
    const id = cleanText(invoiceRequestId, "开票申请 ID", { maximum: 128 });
    const invoiceNumber = cleanText(options.invoiceNumber, "发票号码", { maximum: 256 });
    const issueNote = optionalText(options.note || options.issueNote, 1_000);
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const invoice = connection.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(id);
      if (!invoice) throw relayError("RELAY_NOT_FOUND", "开票申请不存在。", { statusCode: 404 });
      if (invoice.status === "issued") {
        if (invoice.invoice_number !== invoiceNumber) {
          throw relayError("RELAY_STATE_CONFLICT", "该开票申请已登记为其他发票号码。", { statusCode: 409 });
        }
        return { invoice: publicInvoiceRequest(invoice), idempotent: true };
      }
      if (invoice.status !== "requested") {
        throw relayError("RELAY_STATE_CONFLICT", "只有待开票申请可以登记开票。", { statusCode: 409, details: { status: invoice.status } });
      }
      const duplicate = connection.prepare("SELECT id FROM relay_invoice_requests WHERE invoice_number = ? AND id <> ?").get(invoiceNumber, id);
      if (duplicate) throw relayError("RELAY_CONFLICT", "该发票号码已被其他开票申请使用。", { statusCode: 409 });
      const actorType = optionalText(options.actorType || "operator", 120) || "operator";
      connection.prepare(`
        UPDATE relay_invoice_requests
        SET status = 'issued', invoice_number = ?, issue_note = ?, issued_by = ?,
            issued_at = ?, updated_at = ?
        WHERE id = ? AND status = 'requested'
      `).run(invoiceNumber, issueNote, actorType, timestamp, timestamp, id);
      this._audit(connection, {
        tenantId: invoice.tenant_id,
        actorType,
        action: "invoice_request.issued",
        entityType: "invoice_request",
        entityId: id,
        details: { paymentOrderId: invoice.payment_order_id, invoiceNumber },
        createdAt: timestamp
      });
      return { invoice: publicInvoiceRequest(connection.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(id)), idempotent: false };
    });
  }

  voidInvoiceRequest(invoiceRequestId, options = {}) {
    const id = cleanText(invoiceRequestId, "开票申请 ID", { maximum: 128 });
    const note = cleanText(options.note || options.voidNote, "作废说明", { maximum: 1_000 });
    const timestamp = nowIso(options.now);
    return this.transaction((connection) => {
      const invoice = connection.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(id);
      if (!invoice) throw relayError("RELAY_NOT_FOUND", "开票申请不存在。", { statusCode: 404 });
      if (invoice.status === "voided") return { invoice: publicInvoiceRequest(invoice), idempotent: true };
      const actorType = optionalText(options.actorType || "operator", 120) || "operator";
      connection.prepare(`
        UPDATE relay_invoice_requests
        SET status = 'voided', void_note = ?, voided_by = ?, voided_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('requested', 'issued')
      `).run(note, actorType, timestamp, timestamp, id);
      this._audit(connection, {
        tenantId: invoice.tenant_id,
        actorType,
        action: "invoice_request.voided",
        entityType: "invoice_request",
        entityId: id,
        details: { paymentOrderId: invoice.payment_order_id, previousStatus: invoice.status, note },
        createdAt: timestamp
      });
      return { invoice: publicInvoiceRequest(connection.prepare("SELECT * FROM relay_invoice_requests WHERE id = ?").get(id)), idempotent: false };
    });
  }

  listBillingLedger(tenantId, options = {}) {
    const id = cleanText(tenantId, "客户租户 ID", { maximum: 128 });
    const limit = positiveInteger(options.limit, 100, 1_000);
    const rows = this.db.prepare(`
      SELECT * FROM relay_billing_ledger WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(id, limit);
    return rows.map((row) => ({
      ledgerId: row.id,
      tenantId: row.tenant_id,
      providerAccountId: row.provider_account_id || null,
      relayRunId: row.run_id || null,
      relayItemId: row.item_id || null,
      entryType: row.entry_type,
      availableDelta: Number(row.available_delta),
      heldDelta: Number(row.held_delta),
      availableAfter: row.available_after === null ? null : Number(row.available_after),
      heldAfter: row.held_after === null ? null : Number(row.held_after),
      customerCredits: Number(row.customer_credits),
      upstreamCredits: Number(row.upstream_credits),
      priceSnapshot: parseJson(row.price_snapshot_json, {}),
      note: row.note,
      createdAt: row.created_at
    }));
  }

  getReconciliationCase(reconciliationId) {
    const id = cleanText(reconciliationId, "对账工单 ID", { maximum: 128 });
    return publicReconciliationCase(this.db.prepare("SELECT * FROM relay_reconciliation_cases WHERE id = ?").get(id));
  }

  listReconciliationCases(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const status = optionalText(options.status, 32).toLowerCase();
    if (status && !["open", "resolved"].includes(status)) {
      throw relayError("RELAY_VALIDATION", "不支持的对账工单状态。", { statusCode: 422 });
    }
    const tenantId = optionalText(options.tenantId, 128);
    const instanceId = optionalText(options.instanceId, 128);
    const rows = this.db.prepare(`
      SELECT * FROM relay_reconciliation_cases
      WHERE (? = '' OR status = ?)
        AND (? = '' OR tenant_id = ?)
        AND (? = '' OR instance_id = ?)
      ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, updated_at ASC
      LIMIT ?
    `).all(status, status, tenantId, tenantId, instanceId, instanceId, limit);
    return rows.map((row) => publicReconciliationCase(row));
  }

  listAttentionItems(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const rows = this.db.prepare(`
      SELECT * FROM relay_items WHERE status IN ('submission_uncertain', 'dead_letter') ORDER BY updated_at ASC LIMIT ?
    `).all(limit);
    return rows.map((row) => publicItem(row, {
      includeResult: true,
      includeUpstream: true,
      reconciliation: row.status === "submission_uncertain" ? this._latestReconciliationCase(this.db, row.id) : null
    }));
  }

  listAuditEvents(options = {}) {
    const limit = positiveInteger(options.limit, 100, 1_000);
    const rows = this.db.prepare(`
      SELECT a.*, t.display_name AS tenant_name, i.display_name AS instance_name
      FROM relay_audit_events a
      LEFT JOIN relay_tenants t ON t.id = a.tenant_id
      LEFT JOIN relay_instances i ON i.id = a.instance_id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(limit);
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id || null,
      tenantName: row.tenant_name || "",
      instanceId: row.instance_id || null,
      instanceName: row.instance_name || "",
      actorType: row.actor_type,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: parseJson(row.details_json, {}),
      createdAt: row.created_at
    }));
  }

  getOperatorSettings() {
    const defaults = {
      billing: { freezeBeforeRun: true, autoRefundFailed: true, allowCustomPricing: true, priceSnapshotTtlMinutes: 15 },
      security: { requestSigningRequired: true, geoIpAlerts: true, autoRotateSecrets: false },
      storage: { rawResponseRetentionDays: 90, ledgerRetentionDays: 0, redactLogs: true },
      alerts: { providerBalanceEnabled: true, lowBalanceEnabled: true, failureRateEnabled: true }
    };
    const rows = this.db.prepare("SELECT setting_key, value_json FROM relay_operator_settings").all();
    for (const row of rows) {
      const [section, key] = String(row.setting_key || "").split(".");
      if (!defaults[section] || !Object.prototype.hasOwnProperty.call(defaults[section], key)) continue;
      const value = parseJson(row.value_json, defaults[section][key]);
      defaults[section][key] = typeof defaults[section][key] === "boolean" ? Boolean(value) : Number(value);
    }
    return defaults;
  }

  updateOperatorSettings(input = {}, options = {}) {
    const current = this.getOperatorSettings();
    const allowed = {
      billing: { freezeBeforeRun: "boolean", autoRefundFailed: "boolean", allowCustomPricing: "boolean", priceSnapshotTtlMinutes: "integer" },
      security: { requestSigningRequired: "boolean", geoIpAlerts: "boolean", autoRotateSecrets: "boolean" },
      storage: { rawResponseRetentionDays: "integer", ledgerRetentionDays: "integer", redactLogs: "boolean" },
      alerts: { providerBalanceEnabled: "boolean", lowBalanceEnabled: "boolean", failureRateEnabled: "boolean" }
    };
    const next = {};
    for (const [section, fields] of Object.entries(allowed)) {
      next[section] = { ...current[section] };
      if (!input[section] || typeof input[section] !== "object" || Array.isArray(input[section])) continue;
      for (const [key, kind] of Object.entries(fields)) {
        if (!(key in input[section])) continue;
        const raw = input[section][key];
        if (kind === "boolean") next[section][key] = typeof raw === "string" ? !/^(false|0|off|no)$/i.test(raw.trim()) : Boolean(raw);
        else {
          const parsed = Number(raw);
          if (!Number.isInteger(parsed)) throw relayError("RELAY_VALIDATION", `${section}.${key} 必须是整数。`, { statusCode: 422 });
          const max = key.includes("Retention") ? 3_650 : key.includes("Ttl") ? 240 : 1_000_000;
          if (parsed < 0 || parsed > max) throw relayError("RELAY_VALIDATION", `${section}.${key} 超出允许范围。`, { statusCode: 422 });
          next[section][key] = parsed;
        }
      }
    }
    const timestamp = nowIso(options.now);
    this.transaction((connection) => {
      const statement = connection.prepare(`
        INSERT INTO relay_operator_settings(setting_key, value_json, updated_by, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      `);
      for (const [section, fields] of Object.entries(next)) for (const [key, value] of Object.entries(fields)) statement.run(`${section}.${key}`, safeJson(value), options.actorType || "operator", timestamp);
      this._audit(connection, { actorType: options.actorType || "operator", action: "operator_settings.updated", entityType: "operator_settings", entityId: "global", details: next, createdAt: timestamp });
    });
    return next;
  }

  getOperationsAnalytics(options = {}) {
    const days = Math.max(1, Math.min(365, Number(options.days || 30)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const totals = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'top_up' THEN customer_credits ELSE 0 END), 0) AS top_up_customer_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'settle' THEN customer_credits ELSE 0 END), 0) AS settled_customer_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'upstream_cost' THEN upstream_credits ELSE 0 END), 0) AS upstream_cost_credits,
        (SELECT COUNT(*) FROM relay_runs WHERE submitted_at >= ? AND status = 'completed') AS successful_runs,
        (SELECT COUNT(*) FROM relay_runs WHERE submitted_at >= ? AND status IN ('failed', 'attention', 'cancelled')) AS failed_runs,
        (SELECT COALESCE(SUM(completed_items), 0) FROM relay_runs WHERE submitted_at >= ?) AS completed_items,
        (SELECT COUNT(*) FROM relay_tenants WHERE status = 'active') AS active_tenants,
        (SELECT COUNT(*) FROM relay_instances WHERE status = 'active') AS active_instances
      FROM relay_billing_ledger
      WHERE created_at >= ?
    `).get(since, since, since, since);
    const successfulRuns = Number(totals.successful_runs || 0);
    const failedRuns = Number(totals.failed_runs || 0);
    const runningRuns = Number(this.db.prepare("SELECT COUNT(*) AS count FROM relay_runs WHERE submitted_at >= ? AND status IN ('queued','running')").get(since)?.count || 0);
    const totalRuns = successfulRuns + failedRuns + runningRuns;
    const settledCustomerCredits = Number(totals.settled_customer_credits || 0);
    const upstreamCostCredits = Number(totals.upstream_cost_credits || 0);
    const series = this.db.prepare(`
      SELECT substr(created_at, 1, 10) AS day,
        COALESCE(SUM(CASE WHEN entry_type = 'top_up' THEN customer_credits ELSE 0 END), 0) AS top_up_customer_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'settle' THEN customer_credits ELSE 0 END), 0) AS customer_settled_credits,
        COALESCE(SUM(CASE WHEN entry_type = 'upstream_cost' THEN upstream_credits ELSE 0 END), 0) AS upstream_cost_credits
      FROM relay_billing_ledger
      WHERE created_at >= ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
    `).all(since).map((row) => ({ day: row.day, label: row.day?.slice(5) || row.day, topUpCustomerCredits: Number(row.top_up_customer_credits), customerSettledCredits: Number(row.customer_settled_credits), upstreamCostCredits: Number(row.upstream_cost_credits) }));
    return {
      days,
      since,
      totals: {
        topUpCustomerCredits: Number(totals.top_up_customer_credits || 0),
        settledCustomerCredits,
        upstreamCostCredits,
        grossProfitCredits: settledCustomerCredits - upstreamCostCredits,
        grossMarginRate: settledCustomerCredits > 0 ? (settledCustomerCredits - upstreamCostCredits) / settledCustomerCredits : 0,
        successfulRuns,
        failedRuns,
        totalRuns,
        successRate: totalRuns > 0 ? successfulRuns / totalRuns * 100 : 0,
        completedItems: Number(totals.completed_items || 0),
        activeTenants: Number(totals.active_tenants || 0),
        activeInstances: Number(totals.active_instances || 0)
      },
      series
    };
  }

  /**
   * Keep accounting and run identity append-only while stripping expired raw
   * upstream evidence in place. This preserves reconciliation hashes, task
   * status and ledger references without retaining AIDSO response payloads
   * beyond the configured window.
   */
  cleanupOperationalData(options = {}) {
    const deliveryRetentionDays = positiveInteger(options.deliveryRetentionDays, 90, 3_650);
    const auditRetentionDays = positiveInteger(options.auditRetentionDays, 365, 3_650);
    const adminSessionRetentionDays = positiveInteger(options.adminSessionRetentionDays, 7, 3_650);
    const rawResponseRetentionDays = nonNegativeInteger(options.rawResponseRetentionDays, this.getOperatorSettings().storage.rawResponseRetentionDays, 3_650);
    const now = new Date(nowIso(options.now));
    const deliveryCutoff = new Date(now.valueOf() - deliveryRetentionDays * 86_400_000).toISOString();
    const auditCutoff = new Date(now.valueOf() - auditRetentionDays * 86_400_000).toISOString();
    const adminSessionCutoff = new Date(now.valueOf() - adminSessionRetentionDays * 86_400_000).toISOString();
    const rawResponseCutoff = new Date(now.valueOf() - rawResponseRetentionDays * 86_400_000).toISOString();
    return this.transaction((connection) => {
      const rawPayloads = connection.prepare(`
        UPDATE relay_items
        SET submission_response_json = NULL, raw_payload_json = NULL,
            normalized_json = NULL, updated_at = ?
        WHERE completed_at IS NOT NULL
          AND completed_at < ?
          AND (submission_response_json IS NOT NULL OR raw_payload_json IS NOT NULL OR normalized_json IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM relay_deliveries
            WHERE relay_deliveries.item_id = relay_items.id
              AND relay_deliveries.status IN ('queued', 'leased')
          )
      `).run(now.toISOString(), rawResponseCutoff);
      // Acknowledged/dead-letter deliveries are no longer readable by a
      // client, but their persisted payload used to keep a second copy of the
      // raw AIDSO response until the longer delivery-retention window. Strip
      // only those response bodies after the raw-retention period while keeping
      // the original immutable payload hash for audit and duplicate ACK proof.
      // Queued/leased deliveries remain intact until their client consumes them.
      // A later requeue of a scrubbed dead letter is rejected, rather than
      // returning a payload whose canonical hash no longer matches.
      const scrubbedDeliveryPayloads = connection.prepare(`
        UPDATE relay_deliveries
        SET payload_json = json_remove(payload_json, '$.raw', '$.normalized')
        WHERE status IN ('acknowledged', 'dead_letter')
          AND COALESCE(acknowledged_at, updated_at, created_at) < ?
          AND (json_type(payload_json, '$.raw') IS NOT NULL OR json_type(payload_json, '$.normalized') IS NOT NULL)
      `).run(rawResponseCutoff);
      const deliveries = connection.prepare(`
        DELETE FROM relay_deliveries
        WHERE status IN ('acknowledged', 'dead_letter')
          AND COALESCE(acknowledged_at, updated_at, created_at) < ?
      `).run(deliveryCutoff);
      const audit = connection.prepare("DELETE FROM relay_audit_events WHERE created_at < ?").run(auditCutoff);
      const nonces = connection.prepare("DELETE FROM relay_nonce_uses WHERE expires_at < ?").run(now.toISOString());
      const sessions = connection.prepare(`
        DELETE FROM relay_admin_sessions
        WHERE expires_at <= ?
           OR (revoked_at IS NOT NULL AND revoked_at < ?)
      `).run(now.toISOString(), adminSessionCutoff);
      return {
        deliveryRetentionDays,
        auditRetentionDays,
        adminSessionRetentionDays,
        rawResponseRetentionDays,
        deliveryCutoff,
        auditCutoff,
        adminSessionCutoff,
        rawResponseCutoff,
        deletedRawPayloads: Number(rawPayloads.changes || 0),
        scrubbedDeliveryPayloads: Number(scrubbedDeliveryPayloads.changes || 0),
        deletedDeliveries: Number(deliveries.changes || 0),
        deletedAuditEvents: Number(audit.changes || 0),
        deletedNonceUses: Number(nonces.changes || 0),
        deletedAdminSessions: Number(sessions.changes || 0)
      };
    });
  }

  getOperationsSummary() {
    const totals = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM relay_tenants WHERE status = 'active') AS active_tenants,
        (SELECT COUNT(*) FROM relay_instances WHERE status = 'active') AS active_instances,
        (SELECT COUNT(*) FROM relay_runs WHERE status IN ('queued', 'running')) AS active_runs,
        (SELECT COUNT(*) FROM relay_items WHERE status IN ('queued', 'submit_retry', 'submitted', 'poll_retry')) AS active_items,
        (SELECT COUNT(*) FROM relay_items WHERE status IN ('submission_uncertain', 'dead_letter')) AS attention_items,
        (SELECT COUNT(*) FROM relay_deliveries WHERE status = 'dead_letter') AS dead_letter_deliveries,
        (SELECT COUNT(*) FROM relay_reconciliation_cases WHERE status = 'open') AS open_reconciliation_cases,
        (SELECT COUNT(*) FROM relay_payment_orders WHERE status = 'pending_payment') AS pending_payment_orders,
        (SELECT COUNT(*) FROM relay_invoice_requests WHERE status = 'requested') AS pending_invoice_requests,
        (SELECT COALESCE(SUM(available_credits), 0) FROM relay_wallets) AS available_credits,
        (SELECT COALESCE(SUM(held_credits), 0) FROM relay_wallets) AS held_credits,
        (SELECT COALESCE(SUM(upstream_credits), 0) FROM relay_billing_ledger WHERE entry_type = 'upstream_cost') AS upstream_credits
    `).get();
    return {
      activeTenants: Number(totals.active_tenants),
      activeInstances: Number(totals.active_instances),
      activeRuns: Number(totals.active_runs),
      activeItems: Number(totals.active_items),
      attentionItems: Number(totals.attention_items),
      deadLetterDeliveries: Number(totals.dead_letter_deliveries),
      openReconciliationCases: Number(totals.open_reconciliation_cases),
      pendingPaymentOrders: Number(totals.pending_payment_orders),
      pendingInvoiceRequests: Number(totals.pending_invoice_requests),
      customerAvailableCredits: Number(totals.available_credits),
      customerHeldCredits: Number(totals.held_credits),
      upstreamCreditsRecorded: Number(totals.upstream_credits)
    };
  }
}

export { ITEM_ACTIVE_STATUSES, ITEM_TERMINAL_STATUSES, MIGRATIONS, RUN_STATUSES };
