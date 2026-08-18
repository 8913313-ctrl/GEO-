import { readFile } from "node:fs/promises";

const baseUrl = String(process.env.TZ_RELAY_URL || process.env.TZ_RELAY_PUBLIC_ORIGIN || "http://127.0.0.1:44280").replace(/\/+$/, "");
const adminToken = String(process.env.TZ_RELAY_ADMIN_TOKEN || (process.env.TZ_RELAY_ADMIN_TOKEN_FILE
  ? await readFile(process.env.TZ_RELAY_ADMIN_TOKEN_FILE, "utf8").catch(() => "")
  : "")).trim();
const attentionThreshold = Number.isInteger(Number(process.env.TZ_RELAY_ALERT_ATTENTION_THRESHOLD))
  ? Math.max(0, Number(process.env.TZ_RELAY_ALERT_ATTENTION_THRESHOLD))
  : 0;
const webhook = String(process.env.TZ_RELAY_ALERT_WEBHOOK_URL || "").trim();

async function get(path, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
  let body = null;
  try { body = await response.json(); } catch { /* preserve non-JSON body as an unavailable response */ }
  return { ok: response.ok, status: response.status, body };
}

async function post(path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(15_000)
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* preserve a failed non-JSON response as unavailable */ }
  return { ok: response.ok, status: response.status, body: payload };
}

async function sendAlert(payload) {
  if (!webhook) return false;
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

const alerts = [];
let ready;
try {
  ready = await get("/health/ready");
} catch (error) {
  alerts.push({ code: "RELAY_UNREACHABLE", message: String(error?.message || error) });
}
if (ready && !ready.ok) alerts.push({ code: "RELAY_NOT_READY", message: `health/ready returned HTTP ${ready.status}` });

let operations = null;
let providerProbe = null;
if (adminToken) {
  try {
    const result = await get("/api/v1/admin/ops/summary?limit=20", { Authorization: `Bearer ${adminToken}` });
    if (!result.ok) alerts.push({ code: "RELAY_ADMIN_UNAVAILABLE", message: `admin ops returned HTTP ${result.status}` });
    else {
      operations = result.body;
      const attention = Number(result.body?.summary?.attentionItems || 0);
      if (attention > attentionThreshold) alerts.push({ code: "RELAY_ATTENTION_ITEMS", message: `${attention} 个任务项需要人工对账。`, count: attention });
      const providerStatus = String(result.body?.provider?.lastHealthStatus || "unknown");
      if (["unhealthy", "unconfigured", "disabled", "unavailable", "unauthorized", "degraded"].includes(providerStatus)) {
        alerts.push({ code: "RELAY_PROVIDER_UNHEALTHY", message: `AIDSO provider status: ${providerStatus}` });
      }
    }
  } catch (error) {
    alerts.push({ code: "RELAY_ADMIN_UNREACHABLE", message: String(error?.message || error) });
  }
  try {
    const probe = await post("/api/v1/admin/providers/aidso/test", {}, { Authorization: `Bearer ${adminToken}` });
    if (!probe.ok) {
      alerts.push({ code: "RELAY_PROVIDER_PROBE_FAILED", message: `AIDSO probe returned HTTP ${probe.status}` });
    } else {
      providerProbe = probe.body;
      const probeStatus = String(probe.body?.status || "unknown").toLowerCase();
      // `mock` is tolerated only for local development checks. Production
      // configuration already rejects it, but retaining this status makes the
      // scheduler usable in isolated tests without reporting a false outage.
      if (!["healthy", "mock"].includes(probeStatus)) {
        alerts.push({
          code: "RELAY_PROVIDER_PROBE_UNHEALTHY",
          message: `AIDSO probe status: ${probeStatus || "unknown"}`,
          providerStatus: String(probe.body?.providerStatus || "")
        });
      }
    }
  } catch (error) {
    alerts.push({ code: "RELAY_PROVIDER_PROBE_UNREACHABLE", message: String(error?.message || error) });
  }
}

const result = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  ready: ready?.body || null,
  operations,
  providerProbe,
  alerts
};
if (alerts.length) await sendAlert({ source: "tongzhuo-central-relay", severity: "critical", ...result });
console.log(JSON.stringify(result, null, 2));
if (alerts.length) process.exitCode = 2;
