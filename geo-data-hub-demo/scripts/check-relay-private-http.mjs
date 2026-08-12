import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CAPABILITIES } from "../relay-bootstrap.mjs";
import { RelayStore } from "../relay-store.mjs";
import { DiagnosticRelayClient, signInstanceRequest } from "../../tongzhuo-geo-platform-demo/diagnostic-relay-client.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "relay-private-http-"));
const relayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.join(directory, "relay.sqlite");
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const clientSecret = "private-http-check-secret-2026";
const masterKey = randomBytes(32);
const store = new RelayStore({ databasePath, dataDir: directory, masterKey, deliveryMaxAttempts: 3 });
const tenant = store.createTenant({ tenantId: "tenant-private-http", displayName: "私有化 HTTP 验证客户", initialCredits: 100 });
const provider = store.upsertProviderAccount({ providerAccountId: "provider_aidso_central", providerCode: "aidso", displayName: "Mock AIDSO", status: "active", isDefault: true, capabilities: DEFAULT_CAPABILITIES });
store.upsertPriceRule({ providerAccountId: provider.providerAccountId, platform: "DB", terminal: "web", mode: "fast", customerCredits: 10, estimatedUpstreamCredits: 2, version: "central-v1" });
const provisioned = store.provisionInstance({ tenantId: tenant.tenantId, instanceId: "instance-private-http", displayName: "桐灼私有化检查实例", clientId: "client-private-http", clientSecret, allowedCapabilities: { allowedPlatforms: ["DB"] } });
const other = store.createTenant({ tenantId: "tenant-private-other", displayName: "隔离检查客户", initialCredits: 50 });
store.provisionInstance({ tenantId: other.tenantId, instanceId: "instance-private-other", displayName: "另一客户实例", clientId: "client-private-other", clientSecret: "other-secret-2026", allowedCapabilities: { allowedPlatforms: ["DB"] } });
store.close();

const env = { ...process.env, NODE_ENV: "development", PORT: String(port), HOST: "127.0.0.1", TZ_RELAY_DATA_DIR: directory, TZ_RELAY_DATABASE_PATH: databasePath, TZ_RELAY_MASTER_KEY: masterKey.toString("base64"), TZ_RELAY_SEED_DEMO: "0", TZ_RELAY_AIDSO_MODE: "mock", TZ_RELAY_WORKER_ENABLED: "1", TZ_RELAY_POLL_INITIAL_DELAY_MS: "0", TZ_RELAY_POLL_RETRY_BASE_MS: "0", TZ_RELAY_SUBMIT_RETRY_BASE_MS: "0", TZ_RELAY_WORKER_INTERVAL_MS: "100" };
let child;
let serverOutput = "";
async function request(pathname, options = {}) { const response = await fetch(`${baseUrl}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch {} return { response, body, text }; }
function signedHeaders({ clientId, secret, pathname, timestamp = String(Math.floor(Date.now() / 1_000)), nonce }) {
  return {
    "x-tz-client-id": clientId,
    authorization: `Instance ${clientId}`,
    "x-tz-timestamp": timestamp,
    "x-tz-nonce": nonce,
    "x-tz-signature": signInstanceRequest({ secret, method: "GET", requestTarget: pathname, timestamp, nonce, rawBody: "" })
  };
}
async function stop() { if (child?.exitCode === null && child?.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); } }
try {
  child = spawn(process.execPath, [path.join(relayRoot, "server.mjs")], { cwd: relayRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8_000); });
  child.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8_000); });
  let ready = false;
  for (let i = 0; i < 80; i += 1) { try { if ((await request("/health/ready")).response.ok) { ready = true; break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  assert.equal(ready, true, `relay test server did not become ready: ${serverOutput}`);
  const client = new DiagnosticRelayClient({ baseUrl, instanceId: provisioned.instance.instanceId, clientId: provisioned.instance.clientId, clientSecret, timeoutMs: 5_000, deliveryConsumer: "private-http-check" });
  const capabilities = await client.capabilities(); assert.equal(capabilities?.provider?.providerCode, "aidso", JSON.stringify(capabilities));
  const before = await client.quota(); assert.equal(before.availableCredits, 100); assert.equal(before.heldCredits, 0);
  const body = { instanceId: provisioned.instance.instanceId, clientRunId: "private-http-run-1", projectId: "project-private-http", questionSetId: "question-set-private-http", questionSetChecksum: "sha256:private-http", brand: { name: "桐灼" }, consent: { externalDataConsent: true, method: "check" }, items: [{ itemId: "item-private-http-1", questionId: "question-1", prompt: "桐灼 GEO 服务如何帮助企业？", platform: "DB", terminal: "web", mode: "fast" }] };
  const created = await client.createEffectRun(body, "private-http-idempotency-1"); assert.equal(created.created, true); assert.equal(created.run.status, "queued");
  const duplicate = await client.createEffectRun(body, "private-http-idempotency-1"); assert.equal(duplicate.created, false); assert.equal(duplicate.relayRunId, created.relayRunId);
  const held = await client.quota(); assert.equal(held.availableCredits, 90); assert.equal(held.heldCredits, 10);
  let run;
  for (let i = 0; i < 30; i += 1) { run = await client.getEffectRun(created.relayRunId, { includeItems: true }); if (["completed", "failed", "cancelled"].includes(run.run.status)) break; await new Promise((resolve) => setTimeout(resolve, 120)); }
  assert.equal(run.run.status, "completed", JSON.stringify(run)); assert.equal(run.run.billingStatus, "settled");
  const after = await client.quota(); assert.equal(after.availableCredits, 90); assert.equal(after.heldCredits, 0);
  const deliveries = await client.pullDeliveries(20); assert.ok(deliveries.deliveries.length >= 2);
  for (const delivery of deliveries.deliveries) await client.acknowledgeDelivery(delivery.deliveryId, delivery.payloadHash);
  const drained = await client.pullDeliveries(20); assert.equal(drained.deliveries.length, 0);
  const quotaPath = "/client/v1/quota";
  const replayHeaders = signedHeaders({ clientId: provisioned.instance.clientId, secret: clientSecret, pathname: quotaPath, nonce: "private-http-replay-nonce" });
  assert.equal((await request(quotaPath, { headers: replayHeaders })).response.status, 200);
  const replay = await request(quotaPath, { headers: replayHeaders }); assert.equal(replay.response.status, 409); assert.equal(replay.body.error.code, "RELAY_AUTH_REPLAY");
  const expiredTimestamp = String(Math.floor(Date.now() / 1_000) - 1_000);
  const expired = await request(quotaPath, { headers: signedHeaders({ clientId: provisioned.instance.clientId, secret: clientSecret, pathname: quotaPath, timestamp: expiredTimestamp, nonce: "private-http-expired-nonce" }) });
  assert.equal(expired.response.status, 401); assert.equal(expired.body.error.code, "RELAY_AUTH_EXPIRED");
  const invalid = await request(quotaPath, { headers: { ...signedHeaders({ clientId: provisioned.instance.clientId, secret: clientSecret, pathname: quotaPath, nonce: "private-http-invalid-signature" }), "x-tz-signature": "0".repeat(64) } });
  assert.equal(invalid.response.status, 401); assert.equal(invalid.body.error.code, "RELAY_AUTH_INVALID");
  const otherClient = new DiagnosticRelayClient({ baseUrl, instanceId: "instance-private-other", clientId: "client-private-other", clientSecret: "other-secret-2026", timeoutMs: 5_000 });
  await assert.rejects(() => otherClient.getEffectRun(created.relayRunId), (error) => error.code === "RELAY_NOT_FOUND" && error.status === 404);
  const finalStore = new RelayStore({ databasePath, dataDir: directory, masterKey: Buffer.from(env.TZ_RELAY_MASTER_KEY, "base64") });
  const ledger = finalStore.listBillingLedger(tenant.tenantId); assert.ok(ledger.some((entry) => entry.entryType === "freeze")); assert.ok(ledger.some((entry) => entry.entryType === "settle"));
  assert.equal(finalStore.leaseDeliveries({ instanceId: "instance-private-http", consumerId: "private-http-check" }).length, 0);
  finalStore.close();
  console.log("Private GEOFlow-to-relay HTTP contract passed: HMAC, replay rejection, idempotency, credit freeze/settle, worker result, delivery ACK, and tenant boundary.");
} finally { await stop(); try { await rm(directory, { recursive: true, force: true }); } catch {} }
