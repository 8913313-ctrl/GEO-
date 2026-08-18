import path from "node:path";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

function booleanEnv(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function integerEnv(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function cleanOrigin(value) {
  const candidate = cleanUrl(value);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("invalid origin");
    }
    return parsed.origin;
  } catch {
    throw new Error("TZ_RELAY_PUBLIC_ORIGIN 必须是无路径、无凭证的 http(s) Origin。");
  }
}

function csvEnv(value) {
  return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function validTrustedProxyAddress(value) {
  const address = String(value || "").trim().replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "");
  return Boolean(isIP(address)) && !["0.0.0.0", "::"].includes(address);
}

function secretFromEnvironment(environment, valueName, fileName) {
  const direct = String(environment[valueName] || "").trim();
  if (direct) return direct;
  const filePath = String(environment[fileName] || "").trim();
  if (!filePath) return "";
  try {
    return readFileSync(filePath, "utf8").trim();
  } catch (error) {
    const wrapped = new Error(`${fileName} 指定的密钥文件无法读取：${filePath}`);
    wrapped.code = "RELAY_SECRET_FILE_UNREADABLE";
    wrapped.cause = error;
    throw wrapped;
  }
}

function validMasterKey(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^[A-Fa-f0-9]{64}$/.test(text)) return true;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return false;
  try {
    return Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64").length === 32;
  } catch {
    return false;
  }
}

function normalizedMode(value, fallback) {
  const mode = String(value || fallback).trim().toLowerCase();
  if (!["real", "mock"].includes(mode)) throw new Error("TZ_RELAY_AIDSO_MODE 只能是 real 或 mock。");
  return mode;
}

function cookieName(value, fallback) {
  const name = String(value || fallback).trim();
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(name)) throw new Error("TZ_RELAY_ADMIN_SESSION_COOKIE_NAME 必须是 3-128 位的字母、数字、下划线或连字符。");
  return name;
}

export function loadRelayRuntimeConfig(environment = process.env) {
  const nodeEnvironment = String(environment.NODE_ENV || "development").trim().toLowerCase();
  const production = nodeEnvironment === "production";
  const dataDir = path.resolve(environment.TZ_RELAY_DATA_DIR || path.join(moduleRoot, "data"));
  const databaseSetting = String(environment.TZ_RELAY_DATABASE_PATH || "").trim();
  const databasePath = databaseSetting === ":memory:"
    ? ":memory:"
    : path.resolve(databaseSetting || path.join(dataDir, "tongzhuo-relay.sqlite"));
  const explicitMasterKey = String(environment.TZ_RELAY_MASTER_KEY || "").trim();
  const explicitMasterKeyFile = String(environment.TZ_RELAY_MASTER_KEY_FILE || "").trim();
  const explicitAdminToken = String(environment.TZ_RELAY_ADMIN_TOKEN || "").trim();
  const explicitAdminTokenFile = String(environment.TZ_RELAY_ADMIN_TOKEN_FILE || "").trim();
  const explicitAidsoToken = String(environment.AIDSO_TOKEN || "").trim();
  const explicitAidsoTokenFile = String(environment.AIDSO_TOKEN_FILE || "").trim();
  const aidsoToken = secretFromEnvironment(environment, "AIDSO_TOKEN", "AIDSO_TOKEN_FILE");
  const defaultMode = aidsoToken ? "real" : (production ? "real" : "mock");
  return Object.freeze({
    nodeEnvironment,
    production,
    host: String(environment.HOST || environment.TZ_RELAY_BIND_HOST || "127.0.0.1").trim(),
    port: integerEnv(environment.PORT, 44280, 1, 65535),
    dataDir,
    databasePath,
    masterKey: secretFromEnvironment(environment, "TZ_RELAY_MASTER_KEY", "TZ_RELAY_MASTER_KEY_FILE"),
    masterKeyExplicitlyConfigured: Boolean(explicitMasterKey || explicitMasterKeyFile),
    adminToken: secretFromEnvironment(environment, "TZ_RELAY_ADMIN_TOKEN", "TZ_RELAY_ADMIN_TOKEN_FILE"),
    secretConfigurationConflicts: [
      explicitMasterKey && explicitMasterKeyFile ? "TZ_RELAY_MASTER_KEY/TZ_RELAY_MASTER_KEY_FILE" : "",
      explicitAdminToken && explicitAdminTokenFile ? "TZ_RELAY_ADMIN_TOKEN/TZ_RELAY_ADMIN_TOKEN_FILE" : "",
      explicitAidsoToken && explicitAidsoTokenFile ? "AIDSO_TOKEN/AIDSO_TOKEN_FILE" : ""
    ].filter(Boolean),
    masterKeyFile: path.resolve(explicitMasterKeyFile || path.join(dataDir, "secrets", "relay-master.key")),
    allowInsecureAdmin: booleanEnv(environment.TZ_RELAY_ALLOW_INSECURE_ADMIN, !production),
    adminSessionTtlSeconds: integerEnv(environment.TZ_RELAY_ADMIN_SESSION_TTL_SECONDS, production ? 3_600 : 28_800, 300, 86_400),
    adminSessionCookieName: cookieName(environment.TZ_RELAY_ADMIN_SESSION_COOKIE_NAME, production ? "__Host-tz-relay-admin-session" : "tz-relay-admin-session"),
    adminSessionSecureCookie: booleanEnv(environment.TZ_RELAY_ADMIN_SESSION_SECURE, production),
    adminSessionRetentionDays: integerEnv(environment.TZ_RELAY_ADMIN_SESSION_RETENTION_DAYS, 7, 1, 3_650),
    publicOrigin: cleanOrigin(environment.TZ_RELAY_PUBLIC_ORIGIN || ""),
    trustedProxyAddresses: csvEnv(environment.TZ_RELAY_TRUSTED_PROXY_ADDRESSES),
    requireHttpsForAdmin: booleanEnv(environment.TZ_RELAY_REQUIRE_HTTPS_FOR_ADMIN, production),
    seedDemo: booleanEnv(environment.TZ_RELAY_SEED_DEMO, !production),
    aidsoMode: normalizedMode(environment.TZ_RELAY_AIDSO_MODE || environment.AIDSO_MODE, defaultMode),
    allowMockInProduction: booleanEnv(environment.TZ_RELAY_ALLOW_MOCK_IN_PRODUCTION, false),
    aidsoToken,
    aidsoBaseUrl: cleanUrl(environment.AIDSO_BASE_URL || "https://openapi.aidso.com/geo_api"),
    allowInsecureAidsoBaseUrl: booleanEnv(environment.TZ_RELAY_ALLOW_INSECURE_AIDSO_BASE_URL, false),
    aidsoTimeoutMs: integerEnv(environment.AIDSO_TIMEOUT_MS, 45_000, 1_000, 180_000),
    workerEnabled: !String(environment.TZ_RELAY_WORKER_ENABLED || "").trim().match(/^(0|false|off|no)$/i),
    workerIntervalMs: integerEnv(environment.TZ_RELAY_WORKER_INTERVAL_MS, 5_000, 1_000, 60_000),
    pollInitialDelayMs: integerEnv(environment.TZ_RELAY_POLL_INITIAL_DELAY_MS, 15_000, 0, 3_600_000),
    pollRetryBaseMs: integerEnv(environment.TZ_RELAY_POLL_RETRY_BASE_MS, 15_000, 0, 3_600_000),
    submitRetryBaseMs: integerEnv(environment.TZ_RELAY_SUBMIT_RETRY_BASE_MS, 15_000, 0, 3_600_000),
    workerConcurrency: integerEnv(environment.TZ_RELAY_WORKER_CONCURRENCY, 4, 1, 32),
    workerClaimLimit: integerEnv(environment.TZ_RELAY_WORKER_CLAIM_LIMIT, 12, 1, 100),
    shutdownGraceMs: integerEnv(environment.TZ_RELAY_SHUTDOWN_GRACE_MS, 20_000, 1_000, 300_000),
    shutdownForceMs: integerEnv(environment.TZ_RELAY_SHUTDOWN_FORCE_MS, 30_000, 2_000, 360_000),
    cleanupIntervalMs: integerEnv(environment.TZ_RELAY_CLEANUP_INTERVAL_MS, 21_600_000, 60_000, 7 * 86_400_000),
    deliveryRetentionDays: integerEnv(environment.TZ_RELAY_DELIVERY_RETENTION_DAYS, 90, 3, 3_650),
    auditRetentionDays: integerEnv(environment.TZ_RELAY_AUDIT_RETENTION_DAYS, 365, 30, 3_650),
    rawResponseRetentionDays: integerEnv(environment.TZ_RELAY_RAW_RESPONSE_RETENTION_DAYS, 90, 0, 3_650)
  });
}

export function assertRelayRuntimeConfig(config = loadRelayRuntimeConfig()) {
  const problems = [];
  if (config.secretConfigurationConflicts?.length) problems.push(`同一凭证不能同时通过环境值和文件注入：${config.secretConfigurationConflicts.join(", ")}。`);
  if (!config.host) problems.push("HOST/TZ_RELAY_BIND_HOST 不能为空。");
  let aidsoUrl = null;
  try {
    aidsoUrl = new URL(config.aidsoBaseUrl);
    if (!/^https?:$/.test(aidsoUrl.protocol) || aidsoUrl.username || aidsoUrl.password || aidsoUrl.search || aidsoUrl.hash) {
      problems.push("AIDSO_BASE_URL must be an http(s) URL without embedded credentials, query parameters or fragments.");
    }
  } catch {
    problems.push("AIDSO_BASE_URL must be an http(s) URL.");
  }
  if (config.production && config.databasePath === ":memory:") problems.push("Production forbids TZ_RELAY_DATABASE_PATH=:memory:; use a persistent encrypted-volume path.");
  if (config.databasePath !== ":memory:" && !path.isAbsolute(config.databasePath)) problems.push("TZ_RELAY_DATABASE_PATH 必须是绝对路径。");
  if (config.shutdownForceMs <= config.shutdownGraceMs) problems.push("TZ_RELAY_SHUTDOWN_FORCE_MS 必须大于 TZ_RELAY_SHUTDOWN_GRACE_MS，为 HTTP 收尾预留时间。");
  if (config.production) {
    if (config.adminToken.length < 16) problems.push("TZ_RELAY_ADMIN_TOKEN must contain at least 16 characters.");
    if (!config.masterKeyExplicitlyConfigured || !config.masterKey) problems.push("Production requires an explicitly injected TZ_RELAY_MASTER_KEY or TZ_RELAY_MASTER_KEY_FILE; development key files are not accepted.");
    if (config.masterKey && !validMasterKey(config.masterKey)) problems.push("TZ_RELAY_MASTER_KEY must encode exactly 32 bytes.");
    if (!config.adminToken) problems.push("生产环境必须设置 TZ_RELAY_ADMIN_TOKEN。\n");
    if (config.allowInsecureAdmin) problems.push("生产环境不得启用 TZ_RELAY_ALLOW_INSECURE_ADMIN。");
    if (!config.adminSessionSecureCookie) problems.push("生产环境必须启用 Secure 管理员会话 Cookie。");
    if (!config.adminSessionCookieName.startsWith("__Host-")) problems.push("生产环境管理员会话 Cookie 必须以 __Host- 开头。");
    if (!config.publicOrigin || !config.publicOrigin.startsWith("https://")) problems.push("生产环境必须设置 HTTPS TZ_RELAY_PUBLIC_ORIGIN。");
    if (!config.requireHttpsForAdmin) problems.push("生产环境不得关闭 TZ_RELAY_REQUIRE_HTTPS_FOR_ADMIN。");
    if (aidsoUrl?.protocol !== "https:" && !config.allowInsecureAidsoBaseUrl) problems.push("Production requires an HTTPS AIDSO_BASE_URL; HTTP would expose the shared AIDSO token and customer prompts.");
    if (!config.trustedProxyAddresses.length) problems.push("生产环境必须设置 TZ_RELAY_TRUSTED_PROXY_ADDRESSES，且 Node 只应接受受信反向代理连接。");
    if (config.trustedProxyAddresses.some((address) => !validTrustedProxyAddress(address))) problems.push("TZ_RELAY_TRUSTED_PROXY_ADDRESSES 只能包含反向代理 TCP 对端的精确 IP，禁止主机名、CIDR 和通配地址。");
    if (config.seedDemo) problems.push("生产环境必须设置 TZ_RELAY_SEED_DEMO=0。");
    if (config.aidsoMode === "mock" && !config.allowMockInProduction) problems.push("生产环境默认禁止 Mock；如为演练环境，请显式设置 TZ_RELAY_ALLOW_MOCK_IN_PRODUCTION=1。");
  }
  if (problems.length) throw new Error(`中央中转平台配置无效：${problems.join(" ")}`);
  return config;
}
