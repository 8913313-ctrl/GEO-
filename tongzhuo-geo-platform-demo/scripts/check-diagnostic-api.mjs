import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDiagnosticApi } from "../diagnostic-api.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-diagnostic-api-"));
let database;

function responseCapture() {
  return { value: null, json(status, body) { this.value = { status, body }; return this.value; } };
}

async function call(handler, response, method, url, body = undefined) {
  const request = { method, url, body, headers: {} };
  const parts = new URL(url, "http://localhost").pathname.split("/").filter(Boolean);
  response.value = null;
  await handler(request, response, parts, null);
  return response.value;
}

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "diagnostic-api.sqlite") });
  const store = new DiagnosticStore(database);
  const handler = createDiagnosticApi({ diagnosticStore: store, requestJson: async (request) => request.body || {}, configured: { requestBodyLimit: 1_000_000 } });
  const response = responseCapture();

  let result = await call(handler, response, "GET", "/api/v1/research-packages");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.items.length, 1);
  assert.equal(result.body.data.current.datasetVersion, "2.0.1");
  assert.equal(result.body.data.current.coverage.supportsRealtimeCitationMonitoring, false);

  result = await call(handler, response, "POST", "/api/v1/diagnostics/projects", {
    name: "API 第一阶段诊断",
    diagnosticType: "comprehensive",
    industry: "装备制造",
    targetBrand: "测试品牌",
    questionSetSnapshot: {
      name: "客户问题快照",
      questions: ["装备制造企业选择供应商时最关心哪些问题？", "供应商案例与交付能力应如何核验？"]
    }
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.project.status, "active");
  assert.equal(result.body.data.questionSet.status, "frozen");
  const projectId = result.body.data.project.id;
  const questionSetId = result.body.data.questionSet.id;

  result = await call(handler, response, "GET", "/api/v1/diagnostics/projects");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.items.length, 1);

  const relayRun = store.createRun({ projectId, questionSetId });
  const relayHandler = createDiagnosticApi({
    diagnosticStore: store,
    requestJson: async (request) => request.body || {},
    configured: { requestBodyLimit: 1_000_000 },
    relayService: {
      listLinks() {
        return [{
          id: "relay-link-api-check",
          diagnosticRunId: relayRun.id,
          relayRunId: "relay-run-api-check",
          clientRunId: "client-run-api-check",
          request: { projectId, items: [] },
          status: "submitted",
          createdAt: "2026-08-03T00:00:00.000Z"
        }];
      },
      getLink(runId) {
        return runId === relayRun.id ? {
          id: "relay-link-api-check",
          diagnosticRunId: relayRun.id,
          relayRunId: "relay-run-api-check",
          clientRunId: "client-run-api-check",
          status: "partial",
          request: { projectId, items: [] }
        } : null;
      }
    }
  });
  result = await call(relayHandler, response, "GET", "/api/v1/diagnostics/relay-runs?includeEvidence=true");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.items.length, 1);
  assert.equal(result.body.data.items[0].link.diagnosticRunId, relayRun.id);
  assert.equal(result.body.data.items[0].run.id, relayRun.id);

  store.addEvidence({
    runId: relayRun.id,
    evidenceType: "live",
    sourceKind: "aidso",
    sourceId: "aidso-api-check",
    title: "Verified API check sample",
    claim: "The verified answer mentions the target brand.",
    excerpt: "Verified API check answer.",
    verificationStatus: "verified",
    observedAt: "2026-08-03T00:00:01.000Z",
    provenance: { collectionMethod: "relay_pull", platform: "DB", terminal: "web", mode: "fast", questionId: "Q-1" },
    payload: {
      delivery: {
        normalized: { answerText: "Verified API check answer.", brandMentioned: true, brandMentionCount: 1, quoteCount: 1, uniqueDomainCount: 1, quotes: [{ url: "https://example.com/source" }] }
      },
      request: { questionId: "Q-1", prompt: "Which brand should customers choose?" }
    }
  });
  store.completeRun({ runId: relayRun.id });
  result = await call(relayHandler, response, "POST", `/api/v1/diagnostics/relay-runs/${encodeURIComponent(relayRun.id)}/report`, { title: "Relay API check report" });
  assert.equal(result.status, 201);
  assert.ok(result.body.data.reportId);
  assert.equal(result.body.data.version, 1);
  assert.equal(result.body.data.summary.verifiedLiveEvidenceCount, 1);
  assert.equal(result.body.data.report.projectId, projectId);
  assert.equal(result.body.data.report.runId, relayRun.id);
  assert.deepEqual(result.body.data.report.dataScope.evidenceCounts, { research: 0, enterprise: 0, live: 1 });
  assert.equal(result.body.data.report.dataScope.evidenceSource, "diagnostic_evidence(live)");
  assert.ok(result.body.data.report.evidence.every((item) => item.evidenceType === "live" && item.verificationStatus === "verified"));
  assert.equal(result.body.data.report.sections.find((section) => section.key === "verified_samples").content.items.length, 1);

  result = await call(relayHandler, response, "POST", `/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/relay-runs/${encodeURIComponent(relayRun.id)}/report`, {});
  assert.equal(result.status, 201);
  assert.equal(result.body.data.version, 2);

  await assert.rejects(
    () => call(relayHandler, response, "POST", `/api/v1/diagnostics/projects/not-this-project/relay-runs/${encodeURIComponent(relayRun.id)}/report`, {}),
    (error) => error?.code === "DIAGNOSTIC_CONFLICT" && error?.status === 409
  );

  result = await call(handler, response, "POST", `/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/reports`, {});
  assert.equal(result.status, 201);
  assert.equal(result.body.data.report.status, "final");
  assert.equal(result.body.data.report.dataScope.supportsCurrentAiRanking, false);
  assert.equal(result.body.data.report.recommendations.length, 4);
  assert.equal(result.body.data.actions.length, 4);
  const reportId = result.body.data.report.id;
  const actionId = result.body.data.actions[0].id;

  result = await call(handler, response, "GET", "/api/v1/diagnostics/reports");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.items[0].id, reportId);

  result = await call(handler, response, "GET", `/api/v1/diagnostics/reports/${encodeURIComponent(reportId)}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.report.dataScope.evidenceCounts.live, 0);
  assert.match(result.body.data.report.dataScope.boundary, /must not claim a current brand ranking/);

  result = await call(handler, response, "POST", `/api/v1/diagnostics/actions/${encodeURIComponent(actionId)}/confirm`, {});
  assert.equal(result.status, 200);
  assert.equal(result.body.data.action.status, "accepted");
  assert.equal(result.body.data.execution.state, "accepted");

  result = await call(handler, response, "GET", `/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.reports.length, 3);
  assert.ok(result.body.data.reports.some((item) => item.id === reportId));
  assert.equal(result.body.data.actions.length, 4);

  let snapshotCalls = 0;
  let analyzedOptions = null;
  const researchHandler = createDiagnosticApi({
    diagnosticStore: store,
    requestJson: async (request) => request.body || {},
    configured: { requestBodyLimit: 1_000_000 },
    requireAnalysisEngine: true,
    enterpriseSnapshotProvider: async () => { snapshotCalls += 1; return { shouldNotBeRead: true }; },
    analysisEngine: {
      async analyze(options) {
        analyzedOptions = options;
        return {
          project: store.project("default", options.projectId),
          questionSet: store.latestFrozenQuestionSet("default", options.projectId),
          run: { id: "RESEARCH-RUN", status: "completed" },
          persistedReport: { status: "final", title: "Citation Lab 研究报告" },
          persistedRecommendations: [],
          actions: [],
          modelRun: { id: "MODEL-RUN" }
        };
      }
    }
  });
  result = await call(researchHandler, response, "POST", `/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/reports`, {
    providerId: "deepseek",
    externalDataConsent: true,
    researchOnly: true,
    analysisMode: "citation_lab_research",
    report: { reportType: "comprehensive" }
  });
  assert.equal(result.status, 201);
  assert.equal(snapshotCalls, 0, "research-only reports must not read the enterprise snapshot provider");
  assert.equal(analyzedOptions.researchOnly, true);
  assert.equal(analyzedOptions.enterpriseSnapshot, null);
  assert.equal(analyzedOptions.input.analysisMode, "citation_lab_research");

  console.log("Diagnostic API check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
