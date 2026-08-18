import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-monitoring-http-"));
const port = 45500 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
  cwd: path.resolve("."),
  env: {
    ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: temporaryDirectory,
    TZ_DATABASE_PATH: path.join(temporaryDirectory, "monitoring.sqlite"), TZ_LOG_DIR: path.join(temporaryDirectory, "logs"),
    TZ_AI_PROVIDER_DATA_DIR: path.join(temporaryDirectory, "ai"), TZ_PUBLISHER_DATA_DIR: path.join(temporaryDirectory, "publisher"), TZ_MASTER_KEY: randomBytes(32).toString("base64")
  }, stdio: "ignore"
});

function cookies(response) { return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; "); }
async function request(pathname, options = {}) { const response = await fetch(`${base}${pathname}`, options); const raw = await response.text(); let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; } return { response, body }; }
async function ready() { for (let attempt = 0; attempt < 60; attempt += 1) { try { const result = await request("/health/ready"); if (result.response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error("Monitoring HTTP API server did not become ready."); }
function headers(cookie, csrf) { return { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" }; }
async function waitForDiagnostic(reportId, cookie) {
  let result = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    result = await request(`/api/v1/monitoring/diagnostics/${encodeURIComponent(reportId)}`, { headers: { Cookie: cookie } });
    if (["completed", "failed"].includes(result.body.data?.diagnostic?.status)) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return result;
}

try {
  await ready();
  let result = await request("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const cookie = cookies(result.response); const csrf = result.body.data.csrfToken; const auth = headers(cookie, csrf);
  const html = `<html lang="zh-CN"><head><title>GEO</title><meta name="description" content="GEO"><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>企业 GEO</h1><p>上传的 HTML 快照可安全用于本地官网诊断，不会让服务端请求本机或内网地址。</p></body></html>`;

  result = await request("/api/v1/monitoring/diagnostics", { method: "POST", headers: auth, body: JSON.stringify({ html, baseUrl: "http://127.0.0.1:19080/", sourceLabel: "本地官网快照" }) });
  assert.equal(result.response.status, 202, JSON.stringify(result.body));
  assert.equal(result.body.data.diagnostic.status, "pending");
  const reportId = result.body.data.diagnostic.id;
  result = await waitForDiagnostic(reportId, cookie);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.diagnostic.status, "completed", JSON.stringify(result.body));
  assert.equal(result.body.data.diagnostic.url, "http://127.0.0.1:19080/");
  assert.equal(result.body.data.diagnostic.meta.previewScore, 33);
  assert.equal(result.body.data.diagnostic.recommendationSource, "rules");

  result = await request("/api/v1/monitoring/access-logs", { method: "POST", headers: auth, body: JSON.stringify({ source: "server", items: [{ eventId: "http-gptbot", occurredAt: new Date().toISOString(), method: "GET", path: "/insights/geo", statusCode: 200, ipAddress: "203.0.113.2", userAgent: "GPTBot/1.0" }] }) });
  assert.equal(result.response.status, 202, JSON.stringify(result.body)); assert.equal(result.body.data.accepted, 1);

  result = await request("/api/v1/monitoring/traffic?days=30", { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.traffic.aiBotPv, 1); assert.ok(Array.isArray(result.body.data.traffic.trend));

  result = await request("/api/v1/monitoring/overview?days=30", { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.ok(result.body.data.overview.latestDiagnostic); assert.equal(result.body.data.overview.traffic.kpis.aiBotPv, 1);

  result = await request("/api/v1/monitoring/diagnostics", { method: "POST", headers: auth, body: JSON.stringify({ url: "http://127.0.0.1/" }) });
  assert.equal(result.response.status, 403, JSON.stringify(result.body)); assert.equal(result.body.code, "MONITORING_SSRF_BLOCKED");

  console.log("Monitoring HTTP API check passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); }
  await rm(temporaryDirectory, { recursive: true, force: true });
}
