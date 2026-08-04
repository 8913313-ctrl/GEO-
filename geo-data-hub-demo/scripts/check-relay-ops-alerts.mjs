import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const token = "relay-ops-alert-check-token";
let probeStatus = "unavailable";
let server;

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  response.end(payload);
}

function runCheck(baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/check-relay-ops.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        TZ_RELAY_URL: baseUrl,
        TZ_RELAY_PUBLIC_ORIGIN: "",
        TZ_RELAY_ADMIN_TOKEN: token,
        TZ_RELAY_ADMIN_TOKEN_FILE: "",
        TZ_RELAY_ALERT_WEBHOOK_URL: "",
        TZ_RELAY_ALERT_ATTENTION_THRESHOLD: "0"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

try {
  server = createServer(async (request, response) => {
    if (request.url === "/health/ready") {
      sendJson(response, 200, { status: "ready" });
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }
    if (request.url === "/api/v1/admin/ops/summary?limit=20") {
      sendJson(response, 200, {
        summary: { attentionItems: 0 },
        provider: { lastHealthStatus: "healthy" }
      });
      return;
    }
    if (request.url === "/api/v1/admin/providers/aidso/test" && request.method === "POST") {
      sendJson(response, probeStatus === "healthy" ? 200 : 503, {
        status: probeStatus,
        providerStatus: probeStatus === "healthy" ? "REACHABLE" : "AIDSO_NETWORK"
      });
      return;
    }
    sendJson(response, 404, { error: "not found" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const unavailable = await runCheck(baseUrl);
  assert.equal(unavailable.code, 2, "an unavailable AIDSO probe must fail the operational check");
  const unavailableOutput = JSON.parse(unavailable.stdout);
  assert.ok(unavailableOutput.alerts.some((alert) => alert.code === "RELAY_PROVIDER_PROBE_FAILED"), "the scheduler must surface a failed real probe");

  probeStatus = "healthy";
  const healthy = await runCheck(baseUrl);
  assert.equal(healthy.code, 0, "a healthy probe must clear operational alerts");
  const healthyOutput = JSON.parse(healthy.stdout);
  assert.equal(healthyOutput.providerProbe.status, "healthy");
  assert.deepEqual(healthyOutput.alerts, []);

  console.log("Relay operational alert probe checks passed.");
} finally {
  if (server?.listening) {
    server.close();
    await once(server, "close").catch(() => {});
  }
}
