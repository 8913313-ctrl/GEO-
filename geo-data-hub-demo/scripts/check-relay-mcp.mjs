import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import {
  createRelayMcpServer,
  getRelayMcpToolDefinitions,
  redactRelayMcpOutput,
  resolveRelayMcpAdminToken,
  resolveRelayMcpBaseUrl,
  startRelayMcpStdioServer
} from "../relay-mcp-server.mjs";

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "tongzhuo-relay-mcp-"));
const handoffDirectory = path.join(temporaryRoot, "handoff");
const tokenFile = path.join(temporaryRoot, "admin-token");
const adminToken = "mcp-check-admin-token-123456";
const upstreamSecret = `upstream-${randomBytes(18).toString("base64url")}`;

writeFileSync(tokenFile, `${adminToken}\n`, { mode: 0o600 });
// The directory is provisioned before startup; the adapter refuses to create
// one implicitly for a credential handoff.
mkdirSync(handoffDirectory, { mode: 0o700 });

const calls = [];
const api = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const body = rawBody ? JSON.parse(rawBody) : null;
  calls.push({ method: request.method, url: request.url, authorization: request.headers.authorization || "", body });

  if (request.headers.authorization !== `Bearer ${adminToken}`) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { token: upstreamSecret } }));
    return;
  }
  const reply = (statusCode, payload) => {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  };
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  if (requestUrl.pathname === "/api/v1/admin/ops/summary" && requestUrl.searchParams.get("limit") === "13") {
    reply(503, { error: { token: upstreamSecret, upstreamResponse: { raw: "must-not-leak" } } });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/ops/summary") {
    reply(200, {
      serverTime: "2026-08-03T00:00:00.000Z",
      summary: {
        activeTenants: 2,
        activeInstances: 3,
        activeRuns: 4,
        activeItems: 5,
        attentionItems: 1,
        customerAvailableCredits: 900,
        customerHeldCredits: 100,
        upstreamCreditsRecorded: 42
      },
      runtime: { aidsoMode: "real", workerEnabled: true, deliveryRetentionDays: 90, auditRetentionDays: 365 },
      provider: { providerAccountId: "provider_central", providerCode: "aidso", displayName: "Central provider", tokenReference: upstreamSecret, status: "active", maxInFlight: 8 },
      attention: [{
        relayItemId: "item_attention", relayRunId: "run_attention", questionId: "q-1", prompt: "customer prompt must not leak",
        platform: "DB", terminal: "web", mode: "fast", status: "submission_uncertain", customerCredits: 2,
        upstreamReqId: "upstream-request-id", raw: { answer: "upstream raw must not leak" }, normalized: { answer: "normalised must not leak" },
        lastError: { code: "RELAY_PROVIDER_TIMEOUT", message: `Bearer ${upstreamSecret}` }
      }]
    });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/tenants") {
    reply(200, { tenants: [{
      tenantId: "tenant_alpha", displayName: "Alpha", status: "active", metadata: { secret: upstreamSecret },
      wallet: { availableCredits: 200, heldCredits: 10, revision: 2, updatedAt: "2026-08-03T00:00:00.000Z" }
    }] });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/instances") {
    reply(200, { instances: [{
      instanceId: "instance_alpha", tenantId: "tenant_alpha", tenantName: "Alpha", displayName: "Alpha production", clientId: "alpha-client",
      secretVersion: 3, status: "active", maxInFlight: 2, dailyCreditLimit: 100, monthlyCreditLimit: 1000,
      callbackUrl: `https://example.test/${upstreamSecret}`, metadata: { token: upstreamSecret }
    }] });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/runs" && request.method === "GET") {
    reply(200, { runs: [{
      relayRunId: "run_alpha", tenantId: "tenant_alpha", tenantName: "Alpha", instanceId: "instance_alpha", clientRunId: "client-run-1",
      status: "attention", billingStatus: "awaiting_reconciliation", projectId: "project-1", questionSetId: "set-1",
      brand: { name: "must not leak" }, totalItems: 1, completedItems: 0, failedItems: 0,
      estimatedCustomerCredits: 2, heldCustomerCredits: 2, settledCustomerCredits: 0
    }] });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/runs/run_alpha") {
    reply(200, { run: {
      relayRunId: "run_alpha", tenantId: "tenant_alpha", instanceId: "instance_alpha", clientRunId: "client-run-1",
      status: "attention", billingStatus: "awaiting_reconciliation", projectId: "project-1", questionSetId: "set-1",
      inputSnapshot: { secret: upstreamSecret, prompt: "must not leak" }, priceSnapshot: { upstream: upstreamSecret },
      totalItems: 1, completedItems: 0, failedItems: 0, estimatedCustomerCredits: 2, heldCustomerCredits: 2, settledCustomerCredits: 0,
      items: [{
        relayItemId: "item_attention", relayRunId: "run_alpha", questionId: "q-1", ordinal: 1, prompt: "must not leak",
        platform: "DB", terminal: "web", mode: "fast", status: "submission_uncertain", customerCredits: 2,
        upstreamReqId: "must-not-leak", raw: { token: upstreamSecret }, normalized: { result: "must not leak" },
        lastError: { code: "RELAY_PROVIDER_TIMEOUT", message: `token=${upstreamSecret}` }
      }]
    } });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/items/item_attention/retry") {
    reply(202, { item: { relayItemId: "item_attention", relayRunId: "run_alpha", questionId: "q-1", status: "submit_retry", clientSecret: upstreamSecret } });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/items/item_attention/reconcile") {
    assert.deepEqual(body, { resolution: "refund", note: "Confirmed upstream timeout" });
    reply(200, {
      resolution: "refund",
      item: { relayItemId: "item_attention", relayRunId: "run_alpha", questionId: "q-1", status: "failed", raw: { token: upstreamSecret } },
      run: { relayRunId: "run_alpha", tenantId: "tenant_alpha", instanceId: "instance_alpha", status: "failed", billingStatus: "refunded", totalItems: 1, clientSecret: upstreamSecret }
    });
    return;
  }
  if (requestUrl.pathname === "/api/v1/admin/instances/instance_alpha/rotate-secret") {
    assert.equal(typeof body?.clientSecret, "string");
    assert.ok(body.clientSecret.length >= 32);
    reply(200, {
      instance: { instanceId: "instance_alpha", tenantId: "tenant_alpha", tenantName: "Alpha", displayName: "Alpha production", clientId: "alpha-client", secretVersion: 4, status: "active", maxInFlight: 2, dailyCreditLimit: 100, monthlyCreditLimit: 1000 },
      clientSecret: body.clientSecret,
      token: upstreamSecret
    });
    return;
  }
  reply(404, { error: { token: upstreamSecret } });
});

try {
  await new Promise((resolve, reject) => api.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  const port = api.address().port;
  const environment = {
    TZ_RELAY_URL: `http://127.0.0.1:${port}`,
    TZ_RELAY_ADMIN_TOKEN_FILE: tokenFile,
    TZ_RELAY_MCP_SECRET_HANDOFF_DIR: handoffDirectory
  };

  assert.equal(resolveRelayMcpAdminToken(environment), adminToken, "file-injected admin token must be supported");
  assert.equal(resolveRelayMcpBaseUrl(environment), `http://127.0.0.1:${port}`);
  assert.throws(() => resolveRelayMcpBaseUrl({ TZ_RELAY_MCP_URL: "http://relay.example.test" }), /HTTPS/);
  assert.equal(getRelayMcpToolDefinitions().length, 8);
  assert.equal(
    getRelayMcpToolDefinitions().some((tool) => Object.keys(tool.inputSchema.properties || {}).some((field) => /token|secret|password|credential/i.test(field))),
    false,
    "tools must never accept credential arguments"
  );

  const server = createRelayMcpServer({ environment });
  const initialize = await server.handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "offline-check", version: "1" } } });
  assert.equal(initialize.result.serverInfo.name, "tongzhuo-relay-operations");
  const listed = await server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(listed.result.tools.length, 8);

  async function callTool(id, name, args) {
    const response = await server.handleRequest({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
    assert.ok(response.result, `MCP tool ${name} should return a tool result`);
    return { response, payload: JSON.parse(response.result.content[0].text) };
  }

  const summary = await callTool(3, "relay_operations_summary", { attentionLimit: 1 });
  assert.equal(summary.payload.ok, true);
  assert.equal(summary.payload.data.attention[0].relayItemId, "item_attention");
  const summaryText = JSON.stringify(summary.payload);
  for (const forbidden of [upstreamSecret, "customer prompt must not leak", "upstream-request-id", "upstream raw must not leak", "normalised must not leak"]) {
    assert.equal(summaryText.includes(forbidden), false, `summary leaked ${forbidden}`);
  }

  const tenants = await callTool(4, "relay_list_customers", { limit: 10 });
  assert.equal(tenants.payload.data.tenants[0].tenantId, "tenant_alpha");
  assert.equal(JSON.stringify(tenants.payload).includes(upstreamSecret), false);
  const instances = await callTool(5, "relay_list_instances", { tenantId: "tenant_alpha" });
  assert.equal(instances.payload.data.instances[0].instanceId, "instance_alpha");
  assert.equal(JSON.stringify(instances.payload).includes(upstreamSecret), false);
  const runs = await callTool(6, "relay_list_tasks", { instanceId: "instance_alpha" });
  assert.equal(runs.payload.data.runs[0].relayRunId, "run_alpha");
  assert.equal(JSON.stringify(runs.payload).includes("must not leak"), false);
  const task = await callTool(7, "relay_get_task", { relayRunId: "run_alpha" });
  const taskText = JSON.stringify(task.payload);
  for (const forbidden of [upstreamSecret, "must not leak", "upstreamReqId", "inputSnapshot", "raw", "normalized"]) {
    assert.equal(taskText.includes(forbidden), false, `task query leaked ${forbidden}`);
  }

  const beforeRetryCalls = calls.filter((entry) => entry.url.startsWith("/api/v1/admin/items/item_attention/retry")).length;
  const rejectedRetry = await callTool(8, "relay_retry_task", { relayItemId: "item_attention" });
  assert.equal(rejectedRetry.response.result.isError, true);
  assert.equal(calls.filter((entry) => entry.url.startsWith("/api/v1/admin/items/item_attention/retry")).length, beforeRetryCalls, "confirmation failure must not call the API");
  const retried = await callTool(9, "relay_retry_task", { relayItemId: "item_attention", confirmation: "RETRY" });
  assert.equal(retried.payload.data.retried, true);
  assert.equal(JSON.stringify(retried.payload).includes(upstreamSecret), false);

  const refunded = await callTool(10, "relay_refund_attention_task", { relayItemId: "item_attention", confirmation: "REFUND", note: "Confirmed upstream timeout" });
  assert.equal(refunded.payload.data.refunded, true);
  assert.equal(JSON.stringify(refunded.payload).includes(upstreamSecret), false);

  const rotated = await callTool(11, "relay_rotate_instance_secret", { instanceId: "instance_alpha", confirmation: "ROTATE" });
  const rotateText = JSON.stringify(rotated.payload);
  assert.equal(rotated.payload.data.rotated, true);
  assert.match(rotated.payload.data.credentialHandoff.reference, /^mcp-handoff-/);
  assert.equal(rotated.payload.data.credentialHandoff.status, "ready");
  assert.equal(rotateText.includes(upstreamSecret), false);
  assert.equal(rotateText.includes("clientSecret"), false, "the secret must never be returned by MCP");
  const handoffFiles = readdirSync(handoffDirectory).filter((entry) => entry.endsWith(".json"));
  assert.equal(handoffFiles.length, 1);
  const handoff = JSON.parse(readFileSync(path.join(handoffDirectory, handoffFiles[0]), "utf8"));
  assert.equal(handoff.status, "ready");
  assert.equal(handoff.instanceId, "instance_alpha");
  assert.ok(handoff.clientSecret.length >= 32);
  if (process.platform !== "win32") assert.equal(statSync(path.join(handoffDirectory, handoffFiles[0])).mode & 0o077, 0, "handoff secret file must not be group/world-readable");

  const upstreamFailure = await callTool(12, "relay_operations_summary", { attentionLimit: 13 });
  assert.equal(upstreamFailure.response.result.isError, true);
  assert.equal(JSON.stringify(upstreamFailure.payload).includes(upstreamSecret), false, "upstream error body must not leak through MCP");
  assert.equal(redactRelayMcpOutput({ token: "private", raw: { answer: "private" }, safe: "ok" }).token, "[REDACTED]");

  // Exercise newline-delimited stdio framing without spawning an external
  // process, so this remains a fully offline validation.
  const input = new PassThrough();
  const output = new PassThrough();
  let stdioOutput = "";
  output.setEncoding("utf8");
  output.on("data", (chunk) => { stdioOutput += chunk; });
  const stdioPromise = startRelayMcpStdioServer({ environment, input, output });
  input.end([
    JSON.stringify({ jsonrpc: "2.0", id: "stdio-init", method: "initialize", params: { protocolVersion: "2025-06-18" } }),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    JSON.stringify({ jsonrpc: "2.0", id: "stdio-tools", method: "tools/list" })
  ].join("\n") + "\n");
  await stdioPromise;
  const stdioMessages = stdioOutput.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(stdioMessages.length, 2);
  assert.equal(stdioMessages[0].id, "stdio-init");
  assert.equal(stdioMessages[1].result.tools.length, 8);

  assert.ok(calls.length >= 8);
  assert.ok(calls.every((entry) => entry.authorization === `Bearer ${adminToken}`), "all central admin calls must use only the injected bearer token");
  console.log("Relay MCP stdio adapter checks passed.");
} finally {
  await new Promise((resolve) => api.close(() => resolve()));
  rmSync(temporaryRoot, { recursive: true, force: true });
}
