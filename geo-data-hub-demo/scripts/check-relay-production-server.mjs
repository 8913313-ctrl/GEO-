import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RelayStore } from "../relay-store.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-relay-production-server-"));
const masterKey = Buffer.alloc(32, 53);
const adminToken = "production-server-check-admin-token";
let child = null;

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function productionEnvironment({ dataDir, databasePath, port }) {
  return {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    TZ_RELAY_DATA_DIR: dataDir,
    TZ_RELAY_DATABASE_PATH: databasePath,
    TZ_RELAY_MASTER_KEY: masterKey.toString("base64url"),
    TZ_RELAY_MASTER_KEY_FILE: "",
    TZ_RELAY_ADMIN_TOKEN: adminToken,
    TZ_RELAY_ADMIN_TOKEN_FILE: "",
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    AIDSO_TOKEN: "production-server-check-aidso-token",
    TZ_RELAY_WORKER_ENABLED: "0",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
    TZ_RELAY_REQUIRE_HTTPS_FOR_ADMIN: "1",
    TZ_RELAY_ALLOW_INSECURE_ADMIN: "0",
    TZ_RELAY_SHUTDOWN_GRACE_MS: "1000",
    TZ_RELAY_SHUTDOWN_FORCE_MS: "2000"
  };
}

function startServer(environment) {
  const childProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: projectRoot,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  // Consume logs to avoid a child pipe back-pressure deadlock. Deliberately do
  // not surface them in assertion errors because operational logs may contain
  // customer identifiers on a failed test run.
  childProcess.stdout.resume();
  childProcess.stderr.resume();
  return childProcess;
}

function timeoutResult(value, milliseconds) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(value), milliseconds);
    // A successful child exit must not leave an otherwise-complete acceptance
    // script alive merely because its race timeout is still pending.
    timer.unref?.();
  });
}

function timeoutFailure(message, milliseconds) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    timer.unref?.();
  });
}

async function waitForReady(baseUrl, process) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error("production relay exited before becoming ready");
    try {
      const response = await fetch(`${baseUrl}/health/ready`, { signal: AbortSignal.timeout(800) });
      if (response.ok) return response;
    } catch {
      // The listener may not have bound yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("production relay did not become ready within 12 seconds");
}

async function waitForLive(baseUrl, process) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error("production relay exited before becoming live");
    try {
      const response = await fetch(`${baseUrl}/health/live`, { signal: AbortSignal.timeout(800) });
      if (response.ok) return response;
    } catch {
      // The listener may not have bound yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("production relay did not become live within 12 seconds");
}

async function stopServer(process) {
  if (!process || process.exitCode !== null) return;
  const exited = once(process, "exit").then(([code]) => ({ code, timedOut: false }));
  process.kill("SIGTERM");
  const graceful = await Promise.race([
    exited,
    timeoutResult({ code: null, timedOut: true }, 8_000)
  ]);
  if (graceful.timedOut && process.exitCode === null) {
    const forcedExit = once(process, "exit");
    process.kill("SIGKILL");
    await Promise.race([
      forcedExit,
      timeoutFailure("production relay did not exit after forced shutdown", 4_000)
    ]);
  }
}

async function expectDemoDatabaseRejected(environment, dataDir, databasePath) {
  const demoStore = new RelayStore({ databasePath, dataDir, masterKey });
  demoStore.createTenant({ tenantId: "tenant_demo_rejected", displayName: "Demo data", metadata: { demo: true } });
  demoStore.close();

  const rejected = startServer(environment);
  const [exitCode] = await Promise.race([
    once(rejected, "exit"),
    timeoutFailure("production relay accepted a demo database", 8_000)
  ]);
  assert.notEqual(exitCode, 0, "production service must reject a database containing demo records");
}

try {
  const dataDir = path.join(tempRoot, "clean-data");
  const databasePath = path.join(dataDir, "tongzhuo-relay.sqlite");
  const port = await reservePort();
  const environment = productionEnvironment({ dataDir, databasePath, port });
  const baseUrl = `http://127.0.0.1:${port}`;
  child = startServer(environment);
  await waitForLive(baseUrl, child);
  const initialReadiness = await fetch(`${baseUrl}/health/ready`);
  assert.equal(initialReadiness.status, 503, "a fresh production relay must not advertise sample capabilities or prices as ready");
  const initialState = await initialReadiness.json();
  assert.equal(initialState.provider.capabilityCount, 0);
  assert.equal(initialState.provider.activePriceCount, 0);

  const directAdmin = await fetch(`${baseUrl}/api/v1/admin/session`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(directAdmin.status, 401, "direct HTTP must not accept production administrator credentials");

  const trustedProxyHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "X-Forwarded-Proto": "https",
    "X-Forwarded-For": "198.51.100.42"
  };
  const proxiedAdmin = await fetch(`${baseUrl}/api/v1/admin/session`, { headers: trustedProxyHeaders });
  assert.equal(proxiedAdmin.status, 200, "the configured reverse proxy may assert HTTPS for administrator traffic");
  assert.equal((await proxiedAdmin.json()).authenticated, true);

  const configuredProvider = await fetch(`${baseUrl}/api/v1/admin/providers/aidso`, {
    method: "POST",
    headers: { ...trustedProxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      providerAccountId: "provider_aidso_central",
      providerCode: "aidso",
      displayName: "Production check AIDSO",
      status: "active",
      isDefault: true,
      maxInFlight: 1,
      capabilities: {
        version: "production-check-v1",
        provider: "aidso",
        syncedAt: new Date().toISOString(),
        platforms: [{ code: "DB", name: "Production check platform", terminals: ["web"], modes: ["fast"] }]
      }
    })
  });
  assert.equal(configuredProvider.status, 200, "operators must explicitly save verified provider capabilities");
  const configuredPrice = await fetch(`${baseUrl}/api/v1/admin/prices`, {
    method: "POST",
    headers: { ...trustedProxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      providerAccountId: "provider_aidso_central",
      platform: "DB",
      terminal: "web",
      mode: "fast",
      customerCredits: 7,
      estimatedUpstreamCredits: 3,
      version: "production-check-v1"
    })
  });
  assert.equal(configuredPrice.status, 200, "operators must explicitly save the commercial price rule");
  const ready = await waitForReady(baseUrl, child);
  const readiness = await ready.json();
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.database.ready, true);
  assert.equal(readiness.provider.capabilityCount, 1);
  assert.equal(readiness.provider.activePriceCount, 1);

  const rejectedAdminRun = await fetch(`${baseUrl}/api/v1/admin/runs`, {
    method: "POST",
    headers: { ...trustedProxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ clientRunId: "must-not-bypass-client-signing" })
  });
  assert.equal(rejectedAdminRun.status, 404, "the central console must not bypass a customer instance's signed submission path");

  const login = await fetch(`${baseUrl}/api/v1/admin/session`, {
    method: "POST",
    headers: { ...trustedProxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ operatorLabel: "production-server-check" })
  });
  assert.equal(login.status, 201);
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  assert.match(cookie, /^__Host-tz-relay-admin-session=/);
  const sessionMutation = await fetch(`${baseUrl}/api/v1/admin/tenants`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://relay.example.test",
      "X-Forwarded-Proto": "https",
      "X-Forwarded-For": "198.51.100.42",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ displayName: "Production session tenant", initialCredits: 1 })
  });
  assert.equal(sessionMutation.status, 201, "same-origin session writes must work through the trusted HTTPS proxy");
  await stopServer(child);
  child = null;

  const demoDataDir = path.join(tempRoot, "demo-data");
  const demoDatabasePath = path.join(demoDataDir, "tongzhuo-relay.sqlite");
  await expectDemoDatabaseRejected(
    productionEnvironment({ dataDir: demoDataDir, databasePath: demoDatabasePath, port: await reservePort() }),
    demoDataDir,
    demoDatabasePath
  );

  console.log("Relay production startup, HTTPS proxy and demo-data gate checks passed.");
} finally {
  await stopServer(child);
  await rm(tempRoot, { recursive: true, force: true });
}
