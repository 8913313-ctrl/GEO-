import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));

function numberEnv(name, fallback, options = {}) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  const minimum = Number.isFinite(options.min) ? options.min : Number.NEGATIVE_INFINITY;
  const maximum = Number.isFinite(options.max) ? options.max : Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, value));
}

function booleanEnv(name, fallback = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

function secretEnv(name, fileName, unreadableCode = "RELAY_CLIENT_SECRET_FILE_UNREADABLE") {
  const direct = String(process.env[name] ?? "").trim();
  const filePath = String(process.env[fileName] ?? "").trim();
  if (direct && filePath) throw new Error(`${name} 与 ${fileName} 不能同时配置。`);
  if (direct) return direct;
  if (!filePath) return "";
  try {
    const value = readFileSync(filePath, "utf8").trim();
    if (!value) throw new Error("密钥文件为空。");
    return value;
  } catch (error) {
    const wrapped = new Error(`${fileName} 指定的实例密钥文件无法读取：${filePath}`);
    wrapped.code = unreadableCode;
    wrapped.cause = error;
    throw wrapped;
  }
}

const dataDir = path.resolve(process.env.TZ_DATA_DIR || path.join(moduleRoot, "data"));
export const productionConfig = Object.freeze({
  environment: String(process.env.NODE_ENV || "development").trim().toLowerCase(),
  host: String(process.env.TZ_BIND_HOST || "127.0.0.1").trim(),
  port: numberEnv("PORT", 43127, { min: 1, max: 65535 }),
  // This is a single-enterprise source deployment. The internal workspace
  // column remains only for backward-compatible database reads.
  workspaceId: "default",
  projectSeedKey: String(process.env.TZ_PROJECT_SEED || "").trim(),
  projectId: String(process.env.TZ_PROJECT_ID || "default").trim(),
  industryTemplate: String(process.env.TZ_INDUSTRY_TEMPLATE || "").trim(),
  dataDir,
  databasePath: path.resolve(process.env.TZ_DATABASE_PATH || path.join(dataDir, "tongzhuo-production.sqlite")),
  logDir: path.resolve(process.env.TZ_LOG_DIR || path.join(dataDir, "logs")),
  backupDir: path.resolve(process.env.TZ_BACKUP_DIR || path.join(dataDir, "backups")),
  publisherDownloadUrl: String(process.env.TZ_PUBLISHER_DOWNLOAD_URL || "").trim(),
  cookieSecure: booleanEnv("TZ_COOKIE_SECURE", false),
  trustProxy: booleanEnv("TZ_TRUST_PROXY", false),
  sessionHours: numberEnv("TZ_SESSION_HOURS", 12, { min: 1, max: 24 * 30 }),
  requestBodyLimit: numberEnv("TZ_REQUEST_BODY_LIMIT", 8_000_000, { min: 100_000, max: 50_000_000 }),
  logMaxBytes: numberEnv("TZ_LOG_MAX_BYTES", 10_000_000, { min: 1_000_000, max: 500_000_000 }),
  relayBaseUrl: String(process.env.TZ_RELAY_BASE_URL || "").trim().replace(/\/+$/, ""),
  relayInstanceId: String(process.env.TZ_RELAY_INSTANCE_ID || "").trim(),
  relayClientId: String(process.env.TZ_RELAY_CLIENT_ID || "").trim(),
  // The private instance signs requests on the server.  Prefer the *_FILE
  // form in production so the one-time secret never needs to live in an
  // environment dump, process inspector or deployment template.
  relayClientSecret: secretEnv("TZ_RELAY_CLIENT_SECRET", "TZ_RELAY_CLIENT_SECRET_FILE", "RELAY_CLIENT_SECRET_FILE_UNREADABLE"),
  relayClientSecretFile: String(process.env.TZ_RELAY_CLIENT_SECRET_FILE || "").trim(),
  relayDeliveryConsumer: String(process.env.TZ_RELAY_DELIVERY_CONSUMER || "").trim(),
  relayTimeoutMs: numberEnv("TZ_RELAY_TIMEOUT_MS", 15_000, { min: 1_000, max: 180_000 }),
  relayPullIntervalMs: numberEnv("TZ_RELAY_PULL_INTERVAL_MS", 10_000, { min: 1_000, max: 300_000 }),
  relayPullBatchSize: numberEnv("TZ_RELAY_PULL_BATCH_SIZE", 50, { min: 1, max: 200 }),
  // Brand-monitoring plans are executed by the private customer server.  The
  // interval governs local scheduling only; each occurrence still obtains a
  // fresh relay quote and is capped by its plan-specific credit authorization.
  brandMonitoringSchedulerIntervalMs: numberEnv("TZ_BRAND_MONITORING_SCHEDULER_INTERVAL_MS", 60_000, { min: 10_000, max: 900_000 }),
  brandMonitoringSchedulerBatchSize: numberEnv("TZ_BRAND_MONITORING_SCHEDULER_BATCH_SIZE", 12, { min: 1, max: 100 }),
  // Automatic content production is deliberately limited to reviewable
  // drafts. Each plan remains paused until an authenticated operator enables
  // it; this timer therefore has no effect on new installations.
  contentGenerationSchedulerEnabled: booleanEnv("TZ_CONTENT_GENERATION_SCHEDULER_ENABLED", false),
  contentGenerationSchedulerIntervalMs: numberEnv("TZ_CONTENT_GENERATION_SCHEDULER_INTERVAL_MS", 60_000, { min: 10_000, max: 900_000 }),
  contentGenerationSchedulerBatchSize: numberEnv("TZ_CONTENT_GENERATION_SCHEDULER_BATCH_SIZE", 3, { min: 1, max: 20 }),
  contentAssetPatrolIntervalMs: numberEnv("TZ_CONTENT_ASSET_PATROL_INTERVAL_MS", 6 * 60 * 60 * 1_000, { min: 60_000, max: 7 * 86_400_000 }),
  contentAssetPatrolBatchSize: numberEnv("TZ_CONTENT_ASSET_PATROL_BATCH_SIZE", 20, { min: 1, max: 200 }),
  contentAssetCitationStaleDays: numberEnv("TZ_CONTENT_ASSET_CITATION_STALE_DAYS", 30, { min: 1, max: 365 }),
  // Optional, narrow service-to-service API for one isolated temporary
  // question. Keep it separate from user sessions and from the relay HMAC.
  adHocDiagnosticApiToken: secretEnv("TZ_AD_HOC_DIAGNOSTIC_API_TOKEN", "TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE", "AD_HOC_DIAGNOSTIC_API_TOKEN_FILE_UNREADABLE"),
  adHocDiagnosticApiTokenFile: String(process.env.TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE || "").trim()
});

export function assertProductionConfiguration(config = productionConfig) {
  const problems = [];
  if (!config.host) problems.push("TZ_BIND_HOST 不能为空");
  if (config.workspaceId !== "default") problems.push("单企业源码部署的内部工作区必须固定为 default");
  if (!config.projectId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(config.projectId)) {
    problems.push("TZ_PROJECT_ID 格式不正确，只能包含字母、数字、点、下划线、冒号和连字符，且最长 120 个字符");
  }
  if (config.environment === "production" && config.host !== "127.0.0.1" && !config.cookieSecure) {
    problems.push("生产环境对外监听时必须启用安全 Cookie（即使由可信反向代理终止 TLS）");
  }
  const relayValues = [config.relayBaseUrl, config.relayInstanceId, config.relayClientId, config.relayClientSecret];
  const relayConfiguredFields = relayValues.filter(Boolean).length;
  if (relayConfiguredFields > 0 && relayConfiguredFields < relayValues.length) {
    problems.push("中转站接入必须同时配置 TZ_RELAY_BASE_URL、TZ_RELAY_INSTANCE_ID、TZ_RELAY_CLIENT_ID 和实例密钥。");
  }
  if (config.environment === "production" && relayConfiguredFields === relayValues.length) {
    try {
      const relayUrl = new URL(config.relayBaseUrl);
      if (relayUrl.protocol !== "https:") problems.push("生产环境的 TZ_RELAY_BASE_URL 必须使用 HTTPS。");
      if (relayUrl.username || relayUrl.password || relayUrl.pathname !== "/" || relayUrl.search || relayUrl.hash) {
        problems.push("TZ_RELAY_BASE_URL 必须是无路径、无凭证的中转站 Origin。");
      }
    } catch {
      problems.push("TZ_RELAY_BASE_URL 必须是有效的 HTTPS Origin。");
    }
    if (!config.relayClientSecretFile) {
      problems.push("生产环境中转实例密钥必须通过 TZ_RELAY_CLIENT_SECRET_FILE 注入。");
    }
  }
  if (config.environment === "production" && config.adHocDiagnosticApiToken && !config.adHocDiagnosticApiTokenFile) {
    problems.push("生产环境临时检测服务 API 密钥必须通过 TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE 注入。");
  }
  if (problems.length) throw new Error(`生产配置无效：${problems.join("；")}`);
  return config;
}
