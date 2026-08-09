import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentStore } from "../content-store.mjs";
import {
  MonitoringError,
  MonitoringStore,
  analyzeGeoHtml,
  calculateOverallScore,
  classifyTraffic,
  isPublicAddress,
  monitoringReportingDate
} from "../monitoring-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-monitoring-"));
let database;
let serverProcess;

const longAnswer = "企业进行 GEO 内容建设时，应先给出能够独立理解的结论，再用经过审核的产品资料、交付边界和可核验来源解释结论。页面还需要明确适用条件、限制和更新时间，避免让机器或读者把营销判断误认为客观事实。";
const diagnosticHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <meta name="description" content="企业 GEO 内容建设的审核、结构化表达与可信引用方法。">
  <meta property="og:title" content="企业 GEO 内容建设">
  <meta property="og:description" content="从企业知识到可核验页面的完整方法。">
  <meta property="og:image" content="https://example.com/cover.png">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="zh_CN">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://example.com/insights/geo">
  <link rel="icon" href="/favicon.ico">
  <title>企业 GEO 内容建设方法</title>
  <script type="application/ld+json">{
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"WebSite","name":"示例企业官网"},
      {"@type":"Organization","name":"示例企业"},
      {"@type":"Article","headline":"企业 GEO 内容建设方法"},
      {"@type":"FAQPage","mainEntity":[]},
      {"@type":"BreadcrumbList","itemListElement":[]}
    ]
  }</script>
</head>
<body>
  <main>
    <h1>企业 GEO 内容建设方法</h1>
    <p>${longAnswer}</p>
    <h2>先建立企业知识边界</h2>
    <p>${longAnswer.repeat(2)}</p>
    <ul><li>产品事实</li><li>服务边界</li></ul>
    <h2>再形成可引用的答案结构</h2>
    <p>${longAnswer.repeat(3)}</p>
    <ol><li>结论先行</li><li>证据随后</li></ol>
    <h2>常见问题</h2>
    <p>${longAnswer.repeat(2)}</p>
    <img src="/diagram.png" alt="企业 GEO 内容工作流">
    <a href="https://example.com/about">企业信息</a>
    <a href="https://www.gov.cn/zhengce/">政策来源</a>
    <a href="https://doi.org/10.1000/example">研究来源</a>
    <a href="https://github.com/example/reference">公开资料</a>
    <a href="https://example.net/reference">参考来源</a>
  </main>
</body>
</html>`;

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "monitoring.sqlite") });

  // GEORank parity: deterministic scores use 30% Schema, 30% content,
  // 20% Meta and 20% authoritative/external-link analysis.
  const deterministic = analyzeGeoHtml(diagnosticHtml, { baseUrl: "https://example.com/insights/geo" });
  assert.equal(deterministic.ruleVersion, "yaojingang-georank-v1");
  assert.equal(deterministic.schema.score, 100);
  assert.equal(deterministic.content.score, 100);
  assert.equal(deterministic.meta.score, 100);
  assert.equal(deterministic.citation.score, 80);
  assert.equal(deterministic.overallScore, 96);
  assert.equal(deterministic.schema.schemaCount, 1);
  assert.deepEqual(deterministic.schema.missingRecommended, []);
  assert.deepEqual(deterministic.schema.evidence.found_types.sort(), ["Article", "BreadcrumbList", "FAQPage", "Organization", "WebSite"].sort());
  assert.equal(deterministic.schema.evidence.jsonld_count, 1);
  assert.equal(deterministic.content.h3Count, 0);
  assert.equal(typeof deterministic.content.firstParagraphHasDirectAnswer, "boolean");
  assert.equal(deterministic.meta.previewScore, 100);
  assert.equal(deterministic.meta.evidence.check_count, 13);
  assert.equal(deterministic.citation.externalLinkCount, 4);
  assert.equal(deterministic.citation.authorityLinkCount, 2);
  assert.equal(deterministic.citation.internalLinkCount, 1);
  assert.equal(deterministic.citation.evidence.has_recognized_source_link, true);
  assert.equal(deterministic.citation.sourceLinks.includes("https://example.net/reference"), true);
  assert.equal(deterministic.citation.evidence.source_links[2].href, "https://example.net/reference");
  assert.equal(deterministic.recommendations.source, "rules");
  assert.equal(deterministic.recommendations.generation.status, "rule_ready");
  assert.equal(calculateOverallScore(100, 100, 100, 80), 96);
  assert.match(deterministic.contentHash, /^[a-f0-9]{64}$/);

  // GEOFlow parity: AI crawler patterns must take precedence over the broad
  // "bot" fallback, while normal browsers and missing UA remain distinct.
  assert.deepEqual(classifyTraffic("Mozilla/5.0 compatible; GPTBot/1.2"), { type: "ai_bot", botName: "gptbot" });
  assert.deepEqual(classifyTraffic("ClaudeBot/1.0"), { type: "ai_bot", botName: "claudebot" });
  assert.deepEqual(classifyTraffic("Mozilla/5.0 Googlebot/2.1"), { type: "search_bot", botName: "googlebot" });
  assert.deepEqual(classifyTraffic("curl/8.0"), { type: "other_bot", botName: "curl" });
  assert.deepEqual(classifyTraffic("Mozilla/5.0 Chrome/138.0"), { type: "human", botName: "" });
  assert.deepEqual(classifyTraffic(""), { type: "unknown", botName: "" });
  assert.equal(isPublicAddress("127.0.0.1"), false);
  assert.equal(isPublicAddress("10.0.0.1"), false);
  assert.equal(isPublicAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicAddress("::ffff:7f00:1"), false);
  assert.equal(isPublicAddress("::ffff:c0a8:101"), false);
  assert.equal(isPublicAddress("::ffff:ac10:1"), false);
  assert.equal(isPublicAddress("::ffff:0808:0808"), true);
  assert.equal(isPublicAddress("::7f00:1"), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);

  const contentStore = new ContentStore(database, { workspaceId: "default", requireEvidence: false });
  const plan = contentStore.createPlan({ name: "监测验收计划", businessLineId: "BL-MON" });
  const task = contentStore.createTask({ planId: plan.id, title: "监测验收文章", businessLineId: "BL-MON" });
  const article = contentStore.createArticle({ id: "ART-MON-1", taskId: task.id, planId: plan.id, businessLineId: "BL-MON", title: "监测验收文章", contentHtml: "<p>正文</p>" });
  const version = article.currentVersion;
  contentStore.recordRiskScan({ articleId: article.id, versionId: version.id, status: "passed" });
  let current = contentStore.article("default", article.id);
  contentStore.submitReview({ articleId: article.id, versionId: version.id, expectedRevision: current.revision });
  current = contentStore.article("default", article.id);
  contentStore.approveAndFreeze({ articleId: article.id, versionId: version.id, expectedRevision: current.revision });
  const completedJob = contentStore.createGenerationJob({ articleId: article.id, taskId: task.id, operation: "article" });
  contentStore.updateGenerationJob({ jobId: completedJob.id, status: "running" });
  contentStore.updateGenerationJob({ jobId: completedJob.id, status: "succeeded" });
  contentStore.createGenerationJob({ articleId: article.id, taskId: task.id, operation: "rewrite" });

  const timestamp = new Date().toISOString();
  const publisherStore = {
    async load() {},
    state: {
      jobs: [
        { id: 1, status: "success", createdAt: timestamp, targetPlatforms: ["web", "zhihu"], results: { web: { state: "published" }, zhihu: { state: "published" } } },
        { id: 2, status: "failed", createdAt: timestamp, targetPlatforms: ["toutiao"], results: { toutiao: { state: "failed" } } }
      ]
    }
  };
  const monitoring = new MonitoringStore(database, { workspaceId: "default", allowedLocalRoots: [temporaryDirectory], publisherStore, ipSalt: "monitoring-test-salt" });

  const uploaded = await monitoring.diagnose({ html: diagnosticHtml, baseUrl: "https://example.com/insights/geo", sourceLabel: "验收页面" });
  assert.equal(uploaded.status, "completed");
  assert.equal(uploaded.overallScore, 96);
  assert.equal(uploaded.contentHash, deterministic.contentHash);
  assert.equal(monitoring.listReports({ limit: 10 }).length, 1);

  let suggestionGeneratorInput = null;
  const modelMonitoring = new MonitoringStore(database, {
    workspaceId: "model-suggestion-check",
    ipSalt: "monitoring-model-suggestion-salt",
    recommendationGenerator: async (input) => {
      suggestionGeneratorInput = input;
      return {
        summary: "模型仅根据规则证据整理建议。",
        priorityAction: "先补齐结构化数据。",
        recommendations: [{ priority: "P0", title: "补齐实体 Schema", action: "补齐 Organization 和 WebSite 的字段。", rationale: "当前规则证据显示实体结构需完善。", evidenceKeys: ["schema"] }],
        generation: { providerId: "provider-check", providerName: "Check provider", model: "check-model", generationRunId: "AIRUN-CHECK", generatedAt: "2026-08-07T00:00:00.000Z" }
      };
    }
  });
  const queued = modelMonitoring.enqueueDiagnosis({
    html: diagnosticHtml,
    baseUrl: "https://example.com/insights/geo",
    suggestionGeneration: { mode: "llm", providerId: "provider-check", model: "check-model" }
  });
  assert.equal(queued.status, "pending", "asynchronous diagnostics must return a pending report first");
  assert.equal(queued.totalScore, null);
  assert.equal(queued.schemaScore, null);
  assert.equal(queued.analysisRevision, null);
  let queuedCompleted = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const report = modelMonitoring.report("model-suggestion-check", queued.id);
    if (["completed", "failed"].includes(report.status)) { queuedCompleted = report; break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(queuedCompleted?.status, "completed", JSON.stringify(queuedCompleted));
  assert.equal(queuedCompleted.recommendationSource, "llm");
  assert.equal(queuedCompleted.recommendations.llm.recommendations[0].title, "补齐实体 Schema");
  assert.equal(queuedCompleted.meta.previewScore, 100);
  assert.equal(queuedCompleted.evidence.schema.jsonld_count, 1);
  assert.equal(suggestionGeneratorInput.providerId, "provider-check");

  const fallbackMonitoring = new MonitoringStore(database, {
    workspaceId: "model-fallback-check",
    ipSalt: "monitoring-model-fallback-salt",
    recommendationGenerator: async () => { const error = new Error("model unavailable"); error.code = "UPSTREAM_TIMEOUT"; throw error; }
  });
  const fallback = await fallbackMonitoring.diagnose({
    html: diagnosticHtml,
    baseUrl: "https://example.com/insights/geo",
    suggestionGeneration: { mode: "llm", providerId: "provider-check", model: "check-model" }
  });
  assert.equal(fallback.recommendationSource, "rule_fallback");
  assert.equal(fallback.recommendations.generation.status, "fallback");
  assert.equal(fallback.recommendations.generation.failureCode, "UPSTREAM_TIMEOUT");

  const localSiteDirectory = path.join(temporaryDirectory, "public-site");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(localSiteDirectory, { recursive: true }));
  await writeFile(path.join(localSiteDirectory, "index.html"), diagnosticHtml, "utf8");
  const local = await monitoring.diagnose({ localDirectory: localSiteDirectory, relativePath: "index.html", baseUrl: "https://example.com/" });
  assert.equal(local.sourceKind, "local_directory");
  assert.equal(local.status, "completed");

  await assert.rejects(
    monitoring.diagnose({ url: "http://127.0.0.1/" }),
    (error) => error instanceof MonitoringError && error.code === "MONITORING_SSRF_BLOCKED" && Boolean(error.details?.reportId)
  );
  await assert.rejects(
    monitoring.diagnose({ url: "http://[::ffff:7f00:1]/" }),
    (error) => error instanceof MonitoringError && error.code === "MONITORING_SSRF_BLOCKED" && Boolean(error.details?.reportId)
  );
  assert.equal(monitoring.listReports({ status: "failed" }).length, 2, "failed diagnostics remain auditable");

  const day = monitoringReportingDate(new Date(timestamp));
  const logItems = [
    { eventId: "evt-human", occurredAt: timestamp, method: "GET", path: "/insights/geo", statusCode: 200, ipAddress: "198.18.0.1", userAgent: "Mozilla/5.0 Chrome/138.0", articleId: article.id },
    { eventId: "evt-gpt", occurredAt: timestamp, method: "GET", path: "/insights/geo", statusCode: 200, ipAddress: "198.18.0.2", userAgent: "GPTBot/1.2", articleId: article.id },
    { eventId: "evt-claude", occurredAt: timestamp, method: "GET", path: "/about", statusCode: 500, ipAddress: "198.18.0.3", userAgent: "ClaudeBot/1.0" },
    { eventId: "evt-google", occurredAt: timestamp, method: "GET", path: "/", statusCode: 200, ipAddress: "198.18.0.4", userAgent: "Googlebot/2.1" },
    { eventId: "evt-curl", occurredAt: timestamp, method: "GET", path: "/robots.txt", statusCode: 200, ipAddress: "198.18.0.5", userAgent: "curl/8.0" },
    { eventId: "evt-unknown", occurredAt: timestamp, method: "GET", path: "/llms.txt", statusCode: 200, ipAddress: "198.18.0.6", userAgent: "" },
    { eventId: "evt-api", occurredAt: timestamp, method: "GET", path: "/api/v1/workspace", statusCode: 200, ipAddress: "198.18.0.8", userAgent: "Mozilla/5.0" },
    { eventId: "evt-post-ai", occurredAt: timestamp, method: "POST", path: "/contact", statusCode: 201, ipAddress: "198.18.0.7", userAgent: "Bytespider" }
  ];
  const ingested = monitoring.ingestAccessLogs({ source: "server", items: logItems });
  assert.deepEqual({ received: ingested.received, accepted: ingested.accepted, duplicates: ingested.duplicates }, { received: 8, accepted: 8, duplicates: 0 });
  const duplicate = monitoring.ingestAccessLogs({ source: "server", items: [logItems[0]] });
  assert.equal(duplicate.accepted, 0);
  assert.equal(duplicate.duplicates, 1);

  const traffic = monitoring.trafficSummary({ dateFrom: day, dateTo: day });
  assert.equal(traffic.hasData, true);
  assert.deepEqual(traffic.kpis, { pv: 3, uniqueIp: 3, humanPv: 1, aiBotPv: 1, searchBotPv: 1, otherBotPv: 0, unknownPv: 0, errors: 1, rawRequests: 7, excludedRequests: 4 });
  assert.deepEqual(Object.fromEntries(traffic.botBreakdown.map((item) => [item.key, item.count])), { human: 1, search_bot: 1, ai_bot: 1, other_bot: 0, unknown: 0 });
  assert.equal(traffic.topPaths[0].path, "/insights/geo");
  assert.equal(traffic.topPaths[0].views, 2);
  assert.equal(traffic.topArticles[0].articleId, article.id);
  assert.equal(traffic.topArticles[0].views, 2);
  const storedIp = database.connection.prepare("SELECT ip_hash FROM monitoring_access_logs WHERE event_id = 'evt-human'").get();
  assert.match(storedIp.ip_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(storedIp.ip_hash, "198.18.0.1", "raw client IP must not be persisted");

  monitoring.ingestAccessLogs({ workspaceId: "timezone-check", source: "server", items: [
    { eventId: "tz-before-midnight", occurredAt: "2026-08-06T15:59:59.000Z", method: "GET", path: "/", statusCode: 200, ipAddress: "198.18.1.1", userAgent: "Mozilla/5.0" },
    { eventId: "tz-after-midnight", occurredAt: "2026-08-06T16:00:01.000Z", method: "GET", path: "/", statusCode: 200, ipAddress: "198.18.1.2", userAgent: "GPTBot/1.0" },
    { eventId: "tz-favicon", occurredAt: "2026-08-06T16:00:02.000Z", method: "GET", path: "/favicon.ico", statusCode: 404, ipAddress: "198.18.1.3", userAgent: "Mozilla/5.0" },
    { eventId: "tz-redirect", occurredAt: "2026-08-06T16:00:03.000Z", method: "GET", path: "/legacy", statusCode: 301, ipAddress: "198.18.1.4", userAgent: "Mozilla/5.0" }
  ] });
  const shanghaiDay = monitoring.trafficSummary({ workspaceId: "timezone-check", dateFrom: "2026-08-07", dateTo: "2026-08-07", source: "server" });
  assert.deepEqual(shanghaiDay.kpis, { pv: 1, uniqueIp: 1, humanPv: 0, aiBotPv: 1, searchBotPv: 0, otherBotPv: 0, unknownPv: 0, errors: 0, rawRequests: 3, excludedRequests: 2 });
  assert.deepEqual(shanghaiDay.trafficTrend, [{ date: "2026-08-07", pv: 1, aiBotPv: 1 }]);
  assert.equal(shanghaiDay.filters.timeZoneOffsetMinutes, 480);

  const operations = await monitoring.operationsSummary({ dateFrom: day, dateTo: day, businessLineId: "BL-MON" });
  assert.equal(operations.content.totalArticles, 1);
  assert.equal(operations.content.approved, 1);
  assert.equal(operations.content.currentReview.approved, 1);
  assert.deepEqual({ total: operations.generation.total, queued: operations.generation.queued, succeeded: operations.generation.succeeded, successRate: operations.generation.successRate }, { total: 2, queued: 1, succeeded: 1, successRate: 50 });
  assert.deepEqual({ available: operations.publishing.available, total: operations.publishing.total, success: operations.publishing.success, failed: operations.publishing.failed }, { available: true, total: 2, success: 1, failed: 1 });
  assert.match(operations.boundary, /not proof/i);

  // Verify the authenticated HTTP contract used by the actual admin page.
  const apiDirectory = path.join(temporaryDirectory, "api");
  const apiPort = 46300 + Math.floor(Math.random() * 300);
  const apiBase = `http://127.0.0.1:${apiPort}`;
  serverProcess = spawn(process.execPath, [path.resolve("server.mjs"), String(apiPort)], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      TZ_BIND_HOST: "127.0.0.1",
      TZ_COOKIE_SECURE: "0",
      TZ_DATA_DIR: apiDirectory,
      TZ_DATABASE_PATH: path.join(apiDirectory, "monitoring-api.sqlite"),
      TZ_LOG_DIR: path.join(apiDirectory, "logs"),
      TZ_AI_PROVIDER_DATA_DIR: path.join(apiDirectory, "ai"),
      TZ_PUBLISHER_DATA_DIR: path.join(apiDirectory, "publisher"),
      TZ_MASTER_KEY: randomBytes(32).toString("base64")
    },
    stdio: "ignore"
  });
  const apiRequest = async (pathname, options = {}) => {
    const response = await fetch(`${apiBase}${pathname}`, options);
    const responseText = await response.text();
    let body = {};
    try { body = responseText ? JSON.parse(responseText) : {}; } catch { body = { message: responseText }; }
    return { response, body };
  };
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await apiRequest("/health/ready")).response.ok) break; } catch { /* server is still starting */ }
    if (attempt === 49) throw new Error("monitoring API server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let apiResult = await apiRequest("/api/v1/monitoring/overview?days=1");
  assert.equal(apiResult.response.status, 401, "monitoring data must require a signed-in account");
  apiResult = await apiRequest("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" }) });
  assert.equal(apiResult.response.status, 201, JSON.stringify(apiResult.body));
  const cookie = (typeof apiResult.response.headers.getSetCookie === "function" ? apiResult.response.headers.getSetCookie() : [apiResult.response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = apiResult.body.data.csrfToken;
  const readHeaders = { Cookie: cookie };
  const writeHeaders = { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" };

  apiResult = await apiRequest("/api/v1/monitoring/diagnostics", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ html: diagnosticHtml, baseUrl: "https://example.com/insights/geo" }) });
  assert.equal(apiResult.response.status, 403, "monitoring writes must enforce CSRF");
  apiResult = await apiRequest("/api/v1/monitoring/diagnostics", { method: "POST", headers: writeHeaders, body: JSON.stringify({ html: diagnosticHtml, baseUrl: "https://example.com/insights/geo", sourceLabel: "API 验收页面" }) });
  assert.equal(apiResult.response.status, 202, JSON.stringify(apiResult.body));
  assert.equal(apiResult.body.data.diagnostic.status, "pending");
  assert.equal(apiResult.body.data.diagnostic.totalScore, null);
  assert.equal(apiResult.body.data.diagnostic.schemaScore, null);
  assert.equal(apiResult.body.data.diagnostic.previewScore, null);
  const apiReportId = apiResult.body.data.diagnostic.id;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    apiResult = await apiRequest(`/api/v1/monitoring/diagnostics/${encodeURIComponent(apiReportId)}`, { headers: readHeaders });
    if (["completed", "failed"].includes(apiResult.body.data?.diagnostic?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(apiResult.response.status, 200);
  assert.equal(apiResult.body.data.diagnostic.id, apiReportId);
  assert.equal(apiResult.body.data.diagnostic.status, "completed", JSON.stringify(apiResult.body));
  assert.equal(apiResult.body.data.diagnostic.totalScore, 96);
  assert.equal(apiResult.body.data.diagnostic.scores.schema, 100);
  assert.equal(apiResult.body.data.diagnostic.meta.previewScore, 100);
  assert.equal(apiResult.body.data.diagnostic.recommendationSource, "rules");
  apiResult = await apiRequest("/api/v1/monitoring/diagnostics?limit=5", { headers: readHeaders });
  assert.equal(apiResult.response.status, 200);
  assert.equal(apiResult.body.data.items.length, 1);

  const apiLogTime = new Date().toISOString();
  apiResult = await apiRequest("/api/v1/monitoring/access-logs", { method: "POST", headers: writeHeaders, body: JSON.stringify({ source: "server", items: [
    { eventId: "api-gpt", occurredAt: apiLogTime, method: "GET", path: "/insights/api", statusCode: 200, ipAddress: "203.0.113.10", userAgent: "GPTBot/1.2" },
    { eventId: "api-human", occurredAt: apiLogTime, method: "GET", path: "/", statusCode: 200, ipAddress: "203.0.113.11", userAgent: "Mozilla/5.0 Chrome/138.0" }
  ] }) });
  assert.equal(apiResult.response.status, 202, JSON.stringify(apiResult.body));
  assert.equal(apiResult.body.data.accepted, 2);
  apiResult = await apiRequest("/api/v1/monitoring/traffic?days=1", { headers: readHeaders });
  assert.equal(apiResult.response.status, 200);
  assert.equal(apiResult.body.data.traffic.pv, 2);
  assert.equal(apiResult.body.data.traffic.aiBotPv, 1);
  apiResult = await apiRequest("/api/v1/monitoring/overview?days=1", { headers: readHeaders });
  assert.equal(apiResult.response.status, 200);
  assert.equal(apiResult.body.data.overview.latestDiagnostic.id, apiReportId);
  assert.match(apiResult.body.data.overview.boundary, /not proof/i);

  console.log("Monitoring foundation check passed");
} finally {
  if (serverProcess?.exitCode === null && serverProcess?.signalCode === null) {
    serverProcess.kill("SIGTERM");
    await new Promise((resolve) => serverProcess.once("exit", resolve));
  }
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
