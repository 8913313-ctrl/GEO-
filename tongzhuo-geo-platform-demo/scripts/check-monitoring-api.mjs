import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentStore } from "../content-store.mjs";
import { createMonitoringApi } from "../monitoring-api.mjs";
import { MonitoringError, MonitoringStore } from "../monitoring-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-monitoring-api-"));
let database;

function responseCapture() {
  return { value: null, json(status, body) { this.value = { status, body }; return this.value; } };
}

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "monitoring-api.sqlite") });
  const contentStore = new ContentStore(database, { requireEvidence: false });
  const task = contentStore.createTask({ id: "TASK-MON-API", title: "监测 API 文章", businessLineId: "BL-MON" });
  contentStore.createArticle({ id: "ART-MON-API", taskId: task.id, title: "监测 API 文章", businessLineId: "BL-MON" });
  const publisherStore = { async load() {}, state: { jobs: [{ id: 1, status: "queued", createdAt: new Date().toISOString(), targetPlatforms: ["zhihu"], results: { zhihu: { state: "queued" } } }] } };
  const store = new MonitoringStore(database, { publisherStore, ipSalt: "monitoring-api-test" });
  const requestJson = async (request) => request.body || {};
  const handler = createMonitoringApi({ monitoringStore: store, requestJson, configured: { requestBodyLimit: 1_000_000 } });
  const response = responseCapture();
  const html = `<html lang="zh-CN"><head><title>GEO</title><meta name="description" content="GEO"><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>GEO</h1><p>这是通过上传 HTML 运行的安全诊断，不会访问本机地址。</p></body></html>`;

  await handler({ method: "POST", url: "/api/v1/monitoring/diagnostics", body: { html, baseUrl: "http://127.0.0.1:18080/", sourceLabel: "本地官网 HTML 快照" } }, response, ["api", "v1", "monitoring", "diagnostics"]);
  assert.equal(response.value.status, 202);
  assert.equal(response.value.body.data.report.sourceKind, "uploaded_html");
  assert.equal(response.value.body.data.report.url, "http://127.0.0.1:18080/");
  assert.equal(response.value.body.data.report.status, "pending");
  const reportId = response.value.body.data.report.id;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await handler({ method: "GET", url: `/api/v1/monitoring/diagnostics/${encodeURIComponent(reportId)}` }, response, ["api", "v1", "monitoring", "diagnostics", reportId]);
    if (["completed", "failed"].includes(response.value.body.data.report.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(response.value.body.data.report.status, "completed", JSON.stringify(response.value.body));
  assert.ok(response.value.body.data.report.scores.schema >= 0);
  assert.ok(response.value.body.data.report.meta.previewScore >= 0);
  assert.equal(response.value.body.data.report.recommendationSource, "rules");

  await handler({ method: "GET", url: "/api/v1/monitoring/diagnostics" }, response, ["api", "v1", "monitoring", "diagnostics"]);
  assert.equal(response.value.status, 200); assert.equal(response.value.body.data.items.length, 1);

  await handler({ method: "POST", url: "/api/v1/monitoring/access-logs", body: { source: "server", items: [{ eventId: "api-log-1", occurredAt: new Date().toISOString(), path: "/insights/geo", method: "GET", statusCode: 200, userAgent: "GPTBot/1.0", ipAddress: "203.0.113.8", articleId: "ART-MON-API" }] } }, response, ["api", "v1", "monitoring", "access-logs"]);
  assert.equal(response.value.status, 201); assert.equal(response.value.body.data.batch.accepted, 1);

  await handler({ method: "GET", url: "/api/v1/monitoring/traffic?days=30" }, response, ["api", "v1", "monitoring", "traffic"]);
  assert.equal(response.value.status, 200); assert.equal(response.value.body.data.kpis.aiBotPv, 1); assert.equal(response.value.body.data.pv, 1); assert.ok(response.value.body.data.trend.length >= 1);

  await handler({ method: "GET", url: "/api/v1/monitoring/overview?days=30" }, response, ["api", "v1", "monitoring", "overview"]);
  assert.equal(response.value.status, 200); assert.equal(response.value.body.data.overview.production.articles.total, 1, JSON.stringify(response.value.body.data.overview.production)); assert.equal(response.value.body.data.overview.production.contentTasks, 1, JSON.stringify(response.value.body.data.overview.production)); assert.equal(response.value.body.data.overview.production.publishing.running, 1, JSON.stringify(response.value.body.data.overview.production.publishing)); assert.ok(response.value.body.data.overview.latestDiagnostic);

  await assert.rejects(() => handler({ method: "POST", url: "/api/v1/monitoring/diagnostics", body: { url: "http://127.0.0.1/" } }, response, ["api", "v1", "monitoring", "diagnostics"]), (error) => error instanceof MonitoringError && error.code === "MONITORING_SSRF_BLOCKED");

  console.log("Monitoring API check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
