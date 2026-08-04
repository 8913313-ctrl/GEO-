import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createManagedAidsoClient } from "./managed-aidso-client.mjs";
import { createRelayApi } from "./relay-api.mjs";
import { bootstrapRelay } from "./relay-bootstrap.mjs";
import { assertRelayRuntimeConfig, loadRelayRuntimeConfig } from "./relay-config.mjs";
import { RelayStore } from "./relay-store.mjs";
import { createRelayWorker } from "./relay-worker.mjs";

const moduleRoot = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(moduleRoot, "public");
const runtimeConfig = assertRelayRuntimeConfig(loadRelayRuntimeConfig());
const port = runtimeConfig.port;
const host = runtimeConfig.host;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const securityHeaders = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:"
});

function safePath(urlPath) {
  const decoded = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const normalized = normalize(relative);
  if (normalized.startsWith("..") || normalized.includes(":")) return null;
  return join(publicRoot, normalized);
}

function json(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    ...securityHeaders
  });
  response.end(payload);
}

const SENSITIVE_LOG_FIELD = /(authorization|token|secret|password|cookie|api[_-]?key|credential|prompt|question|answer|raw|payload|normalized)/i;

function safeLogValue(value, depth = 0) {
  if (depth > 4) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => safeLogValue(entry, depth + 1));
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SENSITIVE_LOG_FIELD.test(key) ? "[REDACTED]" : safeLogValue(entry, depth + 1);
    }
    return output;
  }
  if (typeof value === "string") {
    return value
      .replace(/(?:bearer\s+|(?:authorization|token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s,;]+/ig, "[REDACTED]")
      .slice(0, 512);
  }
  return value;
}

function relayLog(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "tongzhuo-central-relay",
    level,
    event,
    ...safeLogValue(fields)
  };
  const write = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  write(JSON.stringify(entry));
}

function safeError(error) {
  return {
    code: String(error?.code || "RELAY_INTERNAL_ERROR").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120),
    message: "中转服务暂时无法处理该请求。"
  };
}

const store = new RelayStore({
  databasePath: runtimeConfig.databasePath,
  dataDir: runtimeConfig.dataDir,
  masterKey: runtimeConfig.masterKey || undefined,
  keyPath: runtimeConfig.masterKeyFile
});
if (runtimeConfig.production) store.assertNoDemoData();
// Sessions are intentionally short-lived and are revoked on a process restart.
// This prevents a restored database backup from resurrecting an old browser
// session and makes credential rotation/deployment cutovers deterministic.
const revokedAdminSessions = store.revokeActiveAdminSessions({ reason: "service_restart", actorType: "system" });
if (revokedAdminSessions) relayLog("info", "security.admin_sessions_revoked_on_start", { count: revokedAdminSessions });
const bootstrap = bootstrapRelay(store, {
  seedDemo: runtimeConfig.seedDemo,
  aidsoMode: runtimeConfig.aidsoMode,
  aidsoToken: runtimeConfig.aidsoToken,
  production: runtimeConfig.production
});
if (runtimeConfig.production && runtimeConfig.aidsoMode === "real" && !store.getProviderToken(bootstrap.providerAccountId)) {
  store.close();
  throw new Error("生产环境 AIDSO_TOKEN 未配置：请通过 AIDSO_TOKEN（首次启动）或管理员安全轮换流程保存加密凭证后重启。");
}
// Resolve the encrypted provider token per request so an administrator can
// rotate the single AIDSO account without restarting the Worker.
const providerClient = createManagedAidsoClient({
  store,
  providerAccountId: bootstrap.providerAccountId,
  mode: runtimeConfig.aidsoMode,
  baseUrl: runtimeConfig.aidsoBaseUrl,
  timeoutMs: runtimeConfig.aidsoTimeoutMs
});
const worker = createRelayWorker({
  store,
  providerClient,
  concurrency: runtimeConfig.workerConcurrency,
  claimLimit: runtimeConfig.workerClaimLimit,
  intervalMs: runtimeConfig.workerIntervalMs,
  pollInitialDelayMs: runtimeConfig.pollInitialDelayMs,
  pollRetryBaseMs: runtimeConfig.pollRetryBaseMs,
  submitRetryBaseMs: runtimeConfig.submitRetryBaseMs,
  onError(error, claim) {
    const issue = safeError(error);
    relayLog("error", "worker.tick_failed", { code: issue.code, relayItemId: claim?.relayItemId || undefined });
  }
});
const relayApi = createRelayApi({
  store,
  worker,
  adminToken: runtimeConfig.adminToken,
  allowInsecureAdmin: runtimeConfig.allowInsecureAdmin,
  runtimeConfig: {
    aidsoMode: runtimeConfig.aidsoMode,
    workerEnabled: runtimeConfig.workerEnabled,
    deliveryRetentionDays: runtimeConfig.deliveryRetentionDays,
    auditRetentionDays: runtimeConfig.auditRetentionDays,
    rawResponseRetentionDays: runtimeConfig.rawResponseRetentionDays,
    adminSessionTtlSeconds: runtimeConfig.adminSessionTtlSeconds,
    adminSessionCookieName: runtimeConfig.adminSessionCookieName,
    adminSessionSecureCookie: runtimeConfig.adminSessionSecureCookie,
    adminSessionRetentionDays: runtimeConfig.adminSessionRetentionDays,
    publicOrigin: runtimeConfig.publicOrigin,
    trustedProxyAddresses: runtimeConfig.trustedProxyAddresses,
    requireHttpsForAdmin: runtimeConfig.requireHttpsForAdmin
  }
});

if (runtimeConfig.workerEnabled) worker.start();
function runOperationalCleanup() {
  try {
    const result = store.cleanupOperationalData({
      deliveryRetentionDays: runtimeConfig.deliveryRetentionDays,
      auditRetentionDays: runtimeConfig.auditRetentionDays,
      adminSessionRetentionDays: runtimeConfig.adminSessionRetentionDays,
        rawResponseRetentionDays: effectiveRawResponseRetentionDays()
    });
    if (result.deletedDeliveries || result.deletedAuditEvents || result.deletedNonceUses || result.deletedAdminSessions || result.deletedRawPayloads || result.scrubbedDeliveryPayloads) {
      relayLog("info", "cleanup.completed", {
        rawPayloads: result.deletedRawPayloads,
        deliveryPayloads: result.scrubbedDeliveryPayloads,
        deliveries: result.deletedDeliveries,
        auditEvents: result.deletedAuditEvents,
        nonceUses: result.deletedNonceUses,
        adminSessions: result.deletedAdminSessions,
        rawResponseRetentionDays: result.rawResponseRetentionDays
      });
    }
  } catch (error) {
    const issue = safeError(error);
    relayLog("error", "cleanup.failed", { code: issue.code });
  }
}
// Apply a newly deployed or tightened data-retention policy immediately rather
// than waiting for the first periodic interval.
runOperationalCleanup();
const cleanupTimer = setInterval(runOperationalCleanup, runtimeConfig.cleanupIntervalMs);
cleanupTimer.unref();

let closing = false;
let shutdownPromise = null;
let activeRequests = 0;
let resolveActiveRequests = null;

function effectiveRawResponseRetentionDays() {
  const deploymentValue = Number(runtimeConfig.rawResponseRetentionDays);
  const deploymentCeiling = Number.isInteger(deploymentValue)
    ? Math.max(0, Math.min(3_650, deploymentValue))
    : 90;
  const operatorValue = Number(store.getOperatorSettings()?.storage?.rawResponseRetentionDays);
  const operatorPolicy = Number.isInteger(operatorValue)
    ? Math.max(0, Math.min(3_650, operatorValue))
    : deploymentCeiling;
  // Deployment sets the outer data-protection boundary; an operator may only
  // shorten it. This is evaluated at every cleanup cycle so a saved setting
  // takes effect without a service restart.
  return Math.min(deploymentCeiling, operatorPolicy);
}

function readiness() {
  const database = store.getDatabaseHealth();
  const workerHealth = worker.getHealth();
  const provider = store.getProviderAccount(bootstrap.providerAccountId);
  const capabilityCount = Array.isArray(provider?.capabilities?.platforms) ? provider.capabilities.platforms.length : 0;
  const activePriceCount = Number(store.db.prepare(
    "SELECT COUNT(*) AS count FROM relay_price_rules WHERE provider_account_id = ? AND status = 'active'"
  ).get(bootstrap.providerAccountId)?.count || 0);
  const providerReady = runtimeConfig.aidsoMode === "mock"
    || Boolean(provider?.tokenReference) && provider?.status === "active" && capabilityCount > 0 && activePriceCount > 0;
  const workerReady = !runtimeConfig.workerEnabled
    || (workerHealth.acceptingTicks && workerHealth.timerActive && !workerHealth.stopping);
  const ready = !closing && database.ready && workerReady && providerReady;
  return {
    ready,
    payload: {
      status: ready ? "ready" : "not_ready",
      service: "tongzhuo-central-relay",
      lifecycle: closing ? "draining" : "accepting",
      database: {
        ready: database.ready,
        code: database.code,
        journalMode: database.journalMode || null,
        synchronous: database.synchronous || null,
        foreignKeys: Boolean(database.foreignKeys)
      },
      worker: {
        enabled: runtimeConfig.workerEnabled,
        acceptingTicks: workerHealth.acceptingTicks,
        timerActive: workerHealth.timerActive,
        inFlight: workerHealth.inFlight,
        stopping: workerHealth.stopping,
        lastTickErrorCode: workerHealth.lastTickErrorCode || null
      },
      provider: { ready: providerReady, capabilityCount, activePriceCount },
      now: new Date().toISOString()
    }
  };
}

function requestFinished() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (!activeRequests && resolveActiveRequests) {
    resolveActiveRequests({ drained: true, timedOut: false });
    resolveActiveRequests = null;
  }
}

function waitForActiveRequests(timeoutMs) {
  if (!activeRequests) return Promise.resolve({ drained: true, timedOut: false });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (resolveActiveRequests) resolveActiveRequests = null;
      resolve({ drained: false, timedOut: true });
    }, timeoutMs);
    timer.unref?.();
    resolveActiveRequests = (result) => {
      clearTimeout(timer);
      resolve(result);
    };
  });
}

const server = createServer(async (request, response) => {
  activeRequests += 1;
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/health/live") {
      json(response, 200, {
        status: closing ? "draining" : "live",
        service: "tongzhuo-central-relay",
        lifecycle: closing ? "draining" : "accepting",
        now: new Date().toISOString()
      });
      return;
    }
    if (url.pathname === "/health/ready") {
      const state = readiness();
      json(response, state.ready ? 200 : 503, state.payload);
      return;
    }
    if (closing) {
      json(response, 503, { error: { code: "RELAY_SHUTTING_DOWN", message: "中转服务正在安全停止，请稍后重试。" } });
      return;
    }
    if (await relayApi.handle(request, response, url)) return;

    const filePath = safePath(url.pathname);
    if (!filePath) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }
    const info = await stat(filePath);
    const target = info.isDirectory() ? join(filePath, "index.html") : filePath;
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      ...securityHeaders
    });
    response.end(body);
  } catch (error) {
    const issue = safeError(error);
    relayLog("error", "http.request_failed", { code: issue.code });
    if (!response.headersSent) json(response, 500, { error: issue });
    else response.destroy();
  } finally {
    requestFinished();
  }
});

server.keepAliveTimeout = 5_000;
server.headersTimeout = 15_000;
server.requestTimeout = 60_000;

function closeHttpListener() {
  return new Promise((resolve) => {
    try {
      server.close((error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
          relayLog("warn", "shutdown.http_close_failed", { code: String(error.code || "RELAY_HTTP_CLOSE") });
        }
        resolve();
      });
    } catch (error) {
      relayLog("warn", "shutdown.http_close_failed", { code: String(error?.code || "RELAY_HTTP_CLOSE") });
      resolve();
    }
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

async function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  closing = true;
  clearInterval(cleanupTimer);
  relayLog("info", "shutdown.started", { signal, graceMs: runtimeConfig.shutdownGraceMs, forceMs: runtimeConfig.shutdownForceMs });
  const httpClosed = closeHttpListener();
  server.closeIdleConnections?.();

  shutdownPromise = (async () => {
    const [workerDrain, requestDrain] = await Promise.all([
      worker.waitForInFlight({ timeoutMs: runtimeConfig.shutdownGraceMs }),
      waitForActiveRequests(runtimeConfig.shutdownGraceMs)
    ]);
    if (workerDrain.timedOut || requestDrain.timedOut) {
      relayLog("warn", "shutdown.grace_timeout", {
        workerTimedOut: workerDrain.timedOut,
        requestsTimedOut: requestDrain.timedOut,
        activeRequests
      });
      // Do not let persistent keep-alive clients hold the process past the
      // configured grace period. Claimed work remains protected by its lease
      // and restart recovery if an upstream call did not finish in time.
      server.closeAllConnections?.();
    }
    const remaining = Math.max(250, runtimeConfig.shutdownForceMs - runtimeConfig.shutdownGraceMs);
    await Promise.race([httpClosed, delay(remaining)]);
    store.close();
    const exitCode = workerDrain.timedOut || requestDrain.timedOut ? 1 : 0;
    relayLog("info", "shutdown.completed", { exitCode, workerDrained: workerDrain.drained, requestsDrained: requestDrain.drained });
    return { exitCode };
  })();
  return shutdownPromise;
}

function requestShutdown(signal) {
  shutdown(signal)
    .then(({ exitCode }) => process.exit(exitCode))
    .catch((error) => {
      relayLog("error", "shutdown.failed", { code: String(error?.code || "RELAY_SHUTDOWN_FAILED") });
      process.exit(1);
    });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

server.listen(port, host, () => {
  const demo = bootstrap.demoInstance;
  relayLog("info", "service.started", {
    port,
    workerEnabled: runtimeConfig.workerEnabled,
    aidsoMode: runtimeConfig.aidsoMode,
    database: store.getDatabaseHealth().code,
    demoSeeded: Boolean(demo)
  });
});
