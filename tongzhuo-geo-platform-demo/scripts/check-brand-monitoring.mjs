import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDiagnosticApi } from "../diagnostic-api.mjs";
import { BrandMonitoringService } from "../diagnostic-monitoring-service.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-brand-monitoring-"));
let database;

function responseCapture() {
  return {
    status: null,
    payload: null,
    json(status, payload) { this.status = status; this.payload = payload; return payload; }
  };
}

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "brand-monitoring.sqlite") });
  const diagnosticStore = new DiagnosticStore(database);
  const project = diagnosticStore.createProject({
    name: "Brand monitoring integration check",
    diagnosticType: "comprehensive",
    targetBrand: "Tongzhuo"
  });
  const firstQuestionSet = diagnosticStore.freezeQuestionSet({
    questionSetId: diagnosticStore.createQuestionSet({
      projectId: project.id,
      name: "Monitoring baseline",
      questions: [{ id: "monitor-q-1", text: "Which GEO platform is suitable for industrial brands?" }]
    }).id
  });

  const calls = { quote: [], create: [] };
  const links = new Map();
  let quotedCredits = 2;
  let relayOrdinal = 0;
  const relayService = {
    configured() { return true; },
    async quote(input) {
      calls.quote.push(input);
      return { estimatedCustomerCredits: quotedCredits, currency: "credits", priceSnapshot: [{ customerCredits: quotedCredits }] };
    },
    async createRun(input) {
      calls.create.push(input);
      relayOrdinal += 1;
      const run = diagnosticStore.createRun({
        projectId: input.projectId,
        questionSetId: input.questionSetId,
        evidenceScope: { live: true },
        allowSupersededQuestionSet: input.allowSupersededQuestionSet === true,
        input: { source: "brand-monitoring-check" }
      });
      diagnosticStore.startRun({ runId: run.id });
      const link = {
        id: `link-${relayOrdinal}`,
        diagnosticRunId: run.id,
        relayRunId: `relay-${relayOrdinal}`,
        status: "submitted",
        errorCode: null,
        errorMessage: null
      };
      links.set(run.id, link);
      return { link, run: diagnosticStore.run("default", run.id) };
    },
    getLinkByDiagnosticRun(runId) { return links.get(runId) || null; }
  };
  const service = new BrandMonitoringService({ database, diagnosticStore, relayService, schedulerBatchSize: 10 });
  const startAt = new Date(Date.now() - 1_000).toISOString();
  const plan = await service.createPlan({
    name: "Daily brand monitor",
    projectId: project.id,
    questionSetId: firstQuestionSet.id,
    items: [{ itemId: "monitor-q-1-db-web-fast", questionId: "monitor-q-1", platform: "DB", terminal: "web", mode: "fast" }],
    brand: { name: "Tongzhuo", aliases: ["Tongzhuo GEO"] },
    schedule: { cadence: "daily", startAt, timeZone: "Asia/Shanghai" },
    authorization: {
      externalDataConsent: true,
      authorizationReference: "MONITOR-CHECK-001",
      authorizedBy: "monitoring-check-user",
      consentedAt: startAt,
      method: "check"
    },
    maxCreditsPerRun: 4
  });
  assert.equal(plan.status, "active");
  assert.equal(plan.request.itemCount, 1);
  assert.equal(plan.schedule.timeZone, "Asia/Shanghai");
  assert.equal(plan.lastQuote.estimatedCustomerCredits, 2);
  assert.equal(calls.quote.length, 1);

  const processed = await service.processDue({ limit: 10 });
  assert.equal(processed.claimed, 1);
  assert.equal(processed.executed, 1);
  assert.equal(calls.create.length, 1);
  const submitted = service.listPlanRuns(plan.id)[0];
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.estimatedCustomerCredits, 2);
  assert.equal(calls.create[0].requestMetadata.feature, "aidso_brand_monitoring");
  assert.equal(calls.create[0].requestMetadata.aidsoProduct, "monitor");
  assert.equal(calls.create[0].requestMetadata.source, "effect_monitor");
  assert.equal(calls.create[0].maxCustomerCredits, 4);
  assert.deepEqual(calls.create[0].items, [{ itemId: "monitor-q-1-db-web-fast", questionId: "monitor-q-1", prompt: "Which GEO platform is suitable for industrial brands?", platform: "DB", terminal: "web", mode: "fast", metadata: {} }]);
  assert.equal(calls.create[0].requestMetadata.monitoringPlan.authorizationReferenceHash.length, 64);
  assert.equal(calls.create[0].requestMetadata.monitoringPlan.authorizationReference, undefined);
  await service.processDue({ limit: 10 });
  assert.equal(calls.create.length, 1, "an in-flight occurrence must not be submitted twice");

  links.get(submitted.diagnosticRunId).status = "completed";
  diagnosticStore.addEvidence({
    runId: submitted.diagnosticRunId,
    evidenceType: "live",
    sourceKind: "aidso_relay_delivery",
    sourceId: "aidso-request-1",
    title: "DeepSeek brand-monitoring answer",
    claim: "Tongzhuo is mentioned in the answer.",
    excerpt: "Tongzhuo is mentioned in the answer.",
    verificationStatus: "verified",
    observedAt: new Date().toISOString(),
    provenance: {
      collectionMethod: "relay_pull",
      platform: "DB",
      terminal: "web",
      mode: "fast",
      itemId: "monitor-q-1-db-web-fast",
      questionId: "monitor-q-1",
      upstreamReqId: "aidso-request-1"
    },
    payload: {
      request: { itemId: "monitor-q-1-db-web-fast", questionId: "monitor-q-1", prompt: "Which GEO platform is suitable for industrial brands?", platform: "DB", terminal: "web", mode: "fast" },
      delivery: {
        itemId: "monitor-q-1-db-web-fast",
        normalized: {
          answerText: "Tongzhuo is mentioned in the answer.",
          brandMentioned: true,
          brandMentionCount: 1,
          quotes: [{ title: "Tongzhuo official site", url: "https://example.com/geo" }],
          quoteCount: 1,
          qualityStatus: "verified"
        },
        upstream: { reqId: "aidso-request-1", platform: "DB", terminal: "web", mode: "fast" }
      }
    }
  });
  const reconciled = await service.reconcile({ limit: 10 });
  assert.equal(reconciled.finalized, 1);
  assert.equal(service.listPlanRuns(plan.id)[0].status, "completed");
  assert.ok(service.getPlan(plan.id).lastSuccessAt);

  // Freezing a newer question set turns the old one into "superseded".  A
  // monitoring plan must continue using its own frozen snapshot for a fair
  // before/after comparison, but generic ad-hoc runs remain strict by default.
  const secondQuestionSet = diagnosticStore.freezeQuestionSet({
    questionSetId: diagnosticStore.createQuestionSet({
      projectId: project.id,
      name: "New diagnostic version",
      questions: [{ id: "monitor-q-2", text: "How should an industrial brand evaluate GEO services?" }]
    }).id
  });
  assert.equal(diagnosticStore.questionSet("default", firstQuestionSet.id).status, "superseded");
  assert.equal(secondQuestionSet.status, "frozen");
  const manuallyTriggered = await service.triggerPlan(plan.id, { confirmExternalExecution: true });
  assert.equal(manuallyTriggered.status, "submitted");
  assert.equal(calls.create.at(-1).allowSupersededQuestionSet, true);
  assert.equal(calls.quote.at(-1).allowSupersededQuestionSet, true);

  const capPlan = await service.createPlan({
    name: "Budget protected monitor",
    projectId: project.id,
    questionSetId: secondQuestionSet.id,
    items: [{ itemId: "monitor-q-2-db-web-fast", questionId: "monitor-q-2", platform: "DB", terminal: "web", mode: "fast" }],
    brand: { name: "Tongzhuo" },
    schedule: { cadence: "weekly", startAt },
    authorization: {
      externalDataConsent: true,
      authorizationReference: "MONITOR-CHECK-002",
      authorizedBy: "monitoring-check-user",
      consentedAt: startAt,
      method: "check"
    },
    maxCreditsPerRun: 4
  });
  quotedCredits = 5;
  const budgetProcessed = await service.processDue({ limit: 10 });
  assert.ok(budgetProcessed.executed >= 1);
  const attentionRun = service.listPlanRuns(capPlan.id)[0];
  assert.equal(attentionRun.status, "attention");
  assert.equal(attentionRun.errorCode, "BRAND_MONITORING_BUDGET_EXCEEDED");
  assert.equal(service.getPlan(capPlan.id).status, "attention");
  assert.equal(calls.create.filter((item) => item.questionSetId === secondQuestionSet.id).length, 0);

  quotedCredits = 2;
  const monthlyCapPlan = await service.createPlan({
    name: "Monthly budget protected monitor",
    projectId: project.id,
    questionSetId: secondQuestionSet.id,
    items: [{ itemId: "monitor-q-2-db-web-deep", questionId: "monitor-q-2", platform: "DB", terminal: "web", mode: "deep" }],
    brand: { name: "Tongzhuo" },
    schedule: { cadence: "monthly", startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), timeZone: "Asia/Shanghai" },
    authorization: {
      externalDataConsent: true,
      authorizationReference: "MONITOR-CHECK-003",
      authorizedBy: "monitoring-check-user",
      consentedAt: startAt,
      method: "check"
    },
    maxCreditsPerRun: 4,
    maxMonthlyCredits: 3
  });
  const monthlyFirst = await service.triggerPlan(monthlyCapPlan.id, { confirmExternalExecution: true });
  assert.equal(monthlyFirst.status, "submitted");
  links.get(monthlyFirst.diagnosticRunId).status = "completed";
  await service.reconcile({ limit: 10 });
  const createCountBeforeMonthlyBlock = calls.create.length;
  const monthlyBlocked = await service.triggerPlan(monthlyCapPlan.id, { confirmExternalExecution: true });
  assert.equal(monthlyBlocked.status, "attention");
  assert.equal(monthlyBlocked.errorCode, "BRAND_MONITORING_MONTHLY_BUDGET_EXCEEDED");
  assert.equal(calls.create.length, createCountBeforeMonthlyBlock);

  const stalePlan = await service.createPlan({
    name: "Stale occurrence is skipped",
    projectId: project.id,
    questionSetId: secondQuestionSet.id,
    items: [{ itemId: "monitor-q-2-db-mobile-fast", questionId: "monitor-q-2", platform: "DB", terminal: "mobile", mode: "fast" }],
    brand: { name: "Tongzhuo" },
    schedule: { cadence: "daily", startAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), timeZone: "Asia/Shanghai" },
    authorization: {
      externalDataConsent: true,
      authorizationReference: "MONITOR-CHECK-004",
      authorizedBy: "monitoring-check-user",
      consentedAt: startAt,
      method: "check"
    },
    maxCreditsPerRun: 4
  });
  const createCountBeforeStaleCheck = calls.create.length;
  const staleProcessed = await service.processDue({ limit: 10 });
  assert.ok(staleProcessed.skipped >= 1);
  assert.equal(service.listPlanRuns(stalePlan.id)[0].status, "skipped");
  assert.equal(calls.create.length, createCountBeforeStaleCheck);

  const paused = service.pausePlan(plan.id);
  assert.equal(paused.status, "paused");
  assert.throws(
    () => service.resumePlan(plan.id, {}),
    (error) => error.code === "RELAY_CONSENT_REQUIRED"
  );
  assert.equal(service.resumePlan(plan.id, { confirmExternalExecution: true }).status, "active");

  const diagnosticApi = createDiagnosticApi({
    diagnosticStore,
    requestJson: async () => ({}),
    relayService,
    monitoringPlanService: service
  });
  const apiResponse = responseCapture();
  await diagnosticApi({ method: "GET", url: "/api/v1/diagnostics/monitoring-plans?limit=10", headers: {}, socket: {} }, apiResponse, ["api", "v1", "diagnostics", "monitoring-plans"], null);
  assert.equal(apiResponse.status, 200);
  assert.equal(apiResponse.payload.data.items.length, 4);

  await diagnosticApi({ method: "GET", url: `/api/v1/diagnostics/monitoring/analytics?planId=${encodeURIComponent(plan.id)}&range=30`, headers: {}, socket: {} }, apiResponse, ["api", "v1", "diagnostics", "monitoring", "analytics"], null);
  assert.equal(apiResponse.status, 200);
  assert.equal(apiResponse.payload.data.analytics.overview.verified, 1);
  assert.equal(apiResponse.payload.data.analytics.overview.mentionRate, 100);
  assert.equal(apiResponse.payload.data.analytics.overview.citations, 1);
  assert.equal(apiResponse.payload.data.analytics.mentionRank[0].averageRank, null);
  assert.equal(apiResponse.payload.data.analytics.sentiment.length, 0);
  assert.equal(apiResponse.payload.data.analytics.sources[0].domain, "example.com");
  assert.equal(apiResponse.payload.data.analytics.dialogs[0].evidenceId.startsWith("DEV-"), true);
  assert.equal(apiResponse.payload.data.analytics.evidenceBoundary.includes("verificationStatus=verified"), true);

  const tables = database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'diagnostic_monitoring_plan%' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(tables, ["diagnostic_monitoring_plan_runs", "diagnostic_monitoring_plans"]);
  console.log("Brand monitoring plan check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
