import { AI_BOT_PATTERNS, DEFAULT_DIAGNOSTIC_WEIGHTS, DIAGNOSTIC_ANALYSIS_REVISION, DIAGNOSTIC_RULE_VERSION, OTHER_BOT_PATTERNS, SEARCH_BOT_PATTERNS, monitoringDateDaysBefore, monitoringReportingDate } from "./monitoring-store.mjs";

function queryOf(request) { return new URL(request.url || "/", "http://localhost").searchParams; }
function filterInput(query) {
  const days = Math.max(1, Math.min(366, Number(query.get("days")) || 0));
  let dateFrom = query.get("dateFrom") || undefined; let dateTo = query.get("dateTo") || undefined;
  if (days && !dateFrom && !dateTo) {
    dateTo = monitoringReportingDate();
    dateFrom = monitoringDateDaysBefore(dateTo, days - 1);
  } else if (days && !dateFrom && dateTo) {
    dateFrom = monitoringDateDaysBefore(dateTo, days - 1);
  }
  return {
    dateFrom,
    dateTo,
    source: query.get("source") || "server",
    trafficType: query.get("trafficType") || "all",
    articleId: query.get("articleId") || "",
    businessLineId: query.get("businessLineId") || ""
  };
}

function rangeInput(query) {
  const days = Math.max(1, Math.min(366, Number(query.get("days")) || 30));
  const dateTo = query.get("dateTo") || monitoringReportingDate();
  return { ...filterInput(query), days, dateFrom: query.get("dateFrom") || monitoringDateDaysBefore(dateTo, days - 1), dateTo, source: query.get("source") || "server" };
}

function reportPayload(report) {
  if (!report) return null;
  const completed = ["completed", "complete", "success", "succeeded"].includes(String(report.status || "").toLowerCase());
  const score = (value) => completed && value != null ? Number(value) : null;
  return {
    ...report,
    url: report.sourceUrl || "",
    overallScore: completed ? report.overallScore : null,
    totalScore: completed ? report.overallScore : null,
    scores: {
      schema: score(report.schema?.score),
      content: score(report.content?.score),
      meta: score(report.meta?.score),
      authority: score(report.citation?.score),
      citation: score(report.citation?.score),
      preview: score(report.meta?.previewScore ?? report.meta?.preview_score)
    },
    schemaScore: score(report.schema?.score),
    contentScore: score(report.content?.score),
    metaScore: score(report.meta?.score),
    authorityScore: score(report.citation?.score),
    citationScore: score(report.citation?.score),
    previewScore: score(report.meta?.previewScore ?? report.meta?.preview_score)
  };
}

export function createMonitoringApi({ monitoringStore, requestJson, configured = {} } = {}) {
  if (!monitoringStore || typeof monitoringStore.diagnose !== "function") throw new TypeError("createMonitoringApi requires a MonitoringStore instance.");
  if (typeof requestJson !== "function") throw new TypeError("createMonitoringApi requires requestJson.");
  const workspaceId = String(monitoringStore.workspaceId || "default");
  return async function handleMonitoringApi(request, response, parts, principal = null) {
    const method = request.method || "GET";
    if (parts.length === 4 && parts[3] === "overview" && method === "GET") {
      const filters = rangeInput(queryOf(request));
      const [traffic, operations] = await Promise.all([Promise.resolve(monitoringStore.trafficSummary({ workspaceId, ...filters })), monitoringStore.operationsSummary({ workspaceId, ...filters })]);
      return response.json(200, { ok: true, data: { overview: { generatedAt: new Date().toISOString(), days: filters.days, latestDiagnostic: reportPayload(monitoringStore.listReports({ workspaceId, limit: 1 })[0] || null), traffic, production: { articles: { total: operations.content.totalArticles, draft: operations.content.draft + operations.content.inReview + operations.content.changesRequested, approved: operations.content.approved, published: operations.content.published }, contentTasks: operations.content.taskTotal, generation: operations.generation, publishing: { total: operations.publishing.total, running: operations.publishing.pending, failed: operations.publishing.failed, success: operations.publishing.success, partial: operations.publishing.partial, cancelled: operations.publishing.cancelled } }, boundary: operations.boundary } } });
    }
    if (parts.length === 4 && parts[3] === "rules" && method === "GET") {
      return response.json(200, { ok: true, data: { ruleVersion: DIAGNOSTIC_RULE_VERSION, analysisRevision: DIAGNOSTIC_ANALYSIS_REVISION, weights: DEFAULT_DIAGNOSTIC_WEIGHTS, dimensions: ["schema", "content", "meta", "citation"], crawlerPatterns: { ai: AI_BOT_PATTERNS, search: SEARCH_BOT_PATTERNS, other: OTHER_BOT_PATTERNS }, boundary: "Crawler access is a discoverability proxy, not proof of AI-answer citation or ranking." } });
    }
    if (parts.length === 4 && parts[3] === "diagnostics" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: monitoringStore.listReports({ workspaceId, status: query.get("status") || "", limit: query.get("limit") || 50 }).map(reportPayload) } });
    }
    if (parts.length === 4 && parts[3] === "diagnostics" && method === "POST") {
      const body = await requestJson(request, Math.max(Number(configured.requestBodyLimit) || 1_000_000, 6_000_000));
      const report = typeof monitoringStore.enqueueDiagnosis === "function"
        ? monitoringStore.enqueueDiagnosis({ workspaceId, ...body, actor: principal, request })
        : await monitoringStore.diagnose({ workspaceId, ...body, actor: principal, request });
      return response.json(typeof monitoringStore.enqueueDiagnosis === "function" ? 202 : 201, { ok: true, data: { report: reportPayload(report), diagnostic: reportPayload(report) } });
    }
    if (parts.length === 5 && parts[3] === "diagnostics" && method === "GET") {
      const report = reportPayload(monitoringStore.report(workspaceId, decodeURIComponent(parts[4])));
      return response.json(200, { ok: true, data: { report, diagnostic: report } });
    }
    if (parts.length === 4 && parts[3] === "access-logs" && method === "POST") {
      const body = await requestJson(request, Math.max(Number(configured.requestBodyLimit) || 1_000_000, 4_000_000));
      const batch = monitoringStore.ingestAccessLogs({ workspaceId, source: body.source || "local", items: body.items, actor: principal, request });
      return response.json(201, { ok: true, data: { batch } });
    }
    if (parts.length === 4 && parts[3] === "traffic" && method === "GET") {
      const summary = monitoringStore.trafficSummary({ workspaceId, ...rangeInput(queryOf(request)) });
      const traffic = { ...summary, pv: summary.kpis.pv, aiBotPv: summary.kpis.aiBotPv, uniqueIp: summary.kpis.uniqueIp, trend: summary.trafficTrend.map((item) => ({ label: item.date, pv: item.pv, allPv: item.pv, aiBotPv: item.aiBotPv })), topPaths: summary.topPaths.map((item) => ({ ...item, pv: item.views })), bots: summary.botBreakdown.filter((item) => item.count > 0).map((item) => ({ name: item.key, count: item.count, pv: item.count })) };
      return response.json(200, { ok: true, data: { ...summary, traffic } });
    }
    if (parts.length === 4 && parts[3] === "operations" && method === "GET") {
      return response.json(200, { ok: true, data: await monitoringStore.operationsSummary({ workspaceId, ...filterInput(queryOf(request)) }) });
    }
    return response.json(404, { ok: false, code: "MONITORING_ROUTE_NOT_FOUND", message: "Monitoring API route not found." });
  };
}

export default createMonitoringApi;
