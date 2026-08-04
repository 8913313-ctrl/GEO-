import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DiagnosticError, DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-diagnostic-"));
let database;

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "diagnostic.sqlite") });
  const store = new DiagnosticStore(database);

  const research = store.activeResearchPackage();
  assert.equal(research.datasetVersion, "2.0.1");
  assert.equal(research.statistics.citationRecords, 214119);
  assert.equal(research.installState, "metadata_only");
  assert.equal(research.coverage.supportsCurrentBrandRanking, false);
  assert.equal(research.sourceCommit, null);
  assert.equal(research.checksumSha256, null);

  let project = store.createProject({
    name: "工业品企业 GEO 运营诊断",
    diagnosticType: "comprehensive",
    industry: "工业自动化",
    targetBrand: "示例企业",
    websiteUrl: "https://example.com/",
    objective: "建立客户问题地图、官网信源与内容运营闭环"
  });
  assert.equal(project.status, "draft");

  let questionSet = store.createQuestionSet({ projectId: project.id, questions: [
    "工业自动化项目选型时应先比较哪些技术参数？",
    "工业自动化供应商的交付能力应如何核验？"
  ] });
  questionSet = store.freezeQuestionSet({ questionSetId: questionSet.id });
  assert.equal(questionSet.status, "frozen");
  project = store.project("default", project.id);
  assert.equal(project.status, "active");

  const created = store.createPhaseOneReport({ projectId: project.id, enterpriseSnapshot: {
    capturedAt: "2026-07-28T00:00:00.000Z",
    assets: { questionCount: 12, topicCount: 6, knowledgeBaseCount: 3, knowledgeItemCount: 28 },
    production: { articleTotal: 9, published: 4 },
    websiteDiagnostic: { overallScore: 82 },
    crawlerTraffic: { aiBotPv: 17 }
  } });
  assert.equal(created.run.status, "completed");
  assert.equal(created.report.status, "final");
  assert.equal(created.report.dataScope.supportsCurrentAiRanking, false);
  assert.match(created.report.dataScope.boundary, /No verified live AI-platform sample/);
  assert.ok(created.report.limitations.some((item) => /current brand ranking/i.test(item)));
  assert.equal(created.report.recommendations.length, 4);
  assert.equal(created.actions.length, 4);

  const researchMetric = created.run.metrics.find((item) => item.metricKey === "citation_records");
  assert.equal(researchMetric.value, 214119);
  assert.equal(researchMetric.evidenceType, "research");
  assert.equal(created.run.evidenceSummary.live, 0);
  assert.equal(created.run.evidenceSummary.enterprise, 2);
  assert.equal(created.run.metrics.find((item) => item.metricKey === "question_count")?.value, 12);
  assert.equal(created.run.metrics.find((item) => item.metricKey === "site_geo_score")?.value, 82);
  await assert.rejects(
    async () => store.createReport({ runId: created.run.id, title: "不受支持的实时结论", sections: [{ currentBrandRank: 1 }] }),
    (error) => error instanceof DiagnosticError && error.code === "DIAGNOSTIC_UNSUPPORTED_REALTIME_CLAIM"
  );

  let action = store.transitionAction({ actionId: created.actions[0].id, status: "accepted" });
  assert.equal(action.status, "accepted");
  action = store.transitionAction({ actionId: action.id, status: "applied", targetEntityType: "question_library", targetEntityId: "QL-TEST", result: { imported: 2 } });
  assert.equal(action.status, "applied");
  assert.equal(action.targetEntityId, "QL-TEST");

  const liveProject = store.createProject({ name: "实时证据边界测试", industry: "制造业" });
  const liveQuestions = store.freezeQuestionSet({ questionSetId: store.createQuestionSet({ projectId: liveProject.id, questions: ["制造业客户当前如何向 AI 提问？"] }).id });
  const liveRun = store.createRun({ projectId: liveProject.id, questionSetId: liveQuestions.id, evidenceScope: { live: true } });
  await assert.rejects(
    async () => store.addEvidence({ runId: liveRun.id, evidenceType: "live", sourceKind: "manual", title: "缺少采集信息的样本" }),
    (error) => error instanceof DiagnosticError && error.code === "DIAGNOSTIC_LIVE_PROVENANCE_REQUIRED"
  );
  const suppliedLiveEvidence = store.addEvidence({
    runId: liveRun.id, evidenceType: "live", sourceKind: "ai_platform_sample", title: "人工提交的 AI 样本",
    observedAt: new Date().toISOString(), verificationStatus: "supplied",
    provenance: { collectionMethod: "manual_capture", platform: "example-ai" }
  });
  await assert.rejects(
    async () => store.addMetric({ runId: liveRun.id, evidenceId: suppliedLiveEvidence.id, evidenceType: "live", dimension: "brand", metricKey: "current_brand_rank", value: 1 }),
    (error) => error instanceof DiagnosticError && error.code === "DIAGNOSTIC_LIVE_METRIC_UNVERIFIED"
  );
  await assert.rejects(
    async () => store.addMetric({ runId: liveRun.id, evidenceId: null, evidenceType: "research", dimension: "brand", metricKey: "current_brand_rank", value: 1 }),
    (error) => error instanceof DiagnosticError && ["DIAGNOSTIC_METRIC_EVIDENCE_REQUIRED", "DIAGNOSTIC_REALTIME_METRIC_REQUIRES_LIVE_EVIDENCE"].includes(error.code)
  );

  const tableNames = database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'diagnostic_%' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(tableNames, [
    "diagnostic_actions", "diagnostic_evidence", "diagnostic_metrics", "diagnostic_monitoring_plan_runs", "diagnostic_monitoring_plans", "diagnostic_projects",
    "diagnostic_question_sets", "diagnostic_recommendations", "diagnostic_relay_delivery_receipts",
    "diagnostic_relay_links", "diagnostic_reports", "diagnostic_runs"
  ]);

  console.log("Diagnostic foundation check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
