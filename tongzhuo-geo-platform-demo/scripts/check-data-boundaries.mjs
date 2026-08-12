import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DiagnosticError, DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "geo-data-boundaries-"));
const database = new ProductionDatabase({ databasePath: path.join(directory, "data-boundaries.sqlite") });
try {
  const store = new DiagnosticStore(database);
  const project = store.createProject({ name: "数据边界验收", industry: "专业服务", targetBrand: "桐灼科技" });
  const questionSet = store.freezeQuestionSet({ questionSetId: store.createQuestionSet({ projectId: project.id, questions: ["企业如何做 GEO？"] }).id });
  const run = store.createRun({ projectId: project.id, questionSetId: questionSet.id, evidenceScope: { enterprise: true, live: true } });
  store.addEvidence({ runId: run.id, evidenceType: "research", sourceKind: "citation_lab", title: "历史研究基线", verificationStatus: "verified", payload: { dataOrigin: "research_baseline" } });
  store.addEvidence({ runId: run.id, evidenceType: "enterprise", sourceKind: "official_site", title: "企业官网快照", verificationStatus: "verified", payload: { dataOrigin: "enterprise_measured" } });
  await assert.rejects(
    async () => store.addEvidence({ runId: run.id, evidenceType: "live", sourceKind: "mock_relay", title: "缺少环境标识的 Mock", observedAt: new Date().toISOString(), verificationStatus: "verified", provenance: { collectionMethod: "relay_pull", platform: "DB" }, payload: { dataOrigin: "mock_demo" } }),
    (error) => error instanceof DiagnosticError && error.code === "DIAGNOSTIC_MOCK_PROVENANCE_REQUIRED"
  );
  const mock = store.addEvidence({ runId: run.id, evidenceType: "live", sourceKind: "mock_relay", title: "Mock 平台回答", observedAt: new Date().toISOString(), verificationStatus: "verified", provenance: { collectionMethod: "relay_pull", platform: "DB", environment: "mock" }, payload: { dataOrigin: "mock_demo" } });
  store.addMetric({ runId: run.id, evidenceId: mock.id, evidenceType: "live", dimension: "brand", metricKey: "brand_mention_count", value: 1 });
  const completed = store.completeRun({ runId: run.id });
  const report = store.createReport({ runId: completed.id, title: "Mock 不得冒充实时的报告", status: "final" });
  assert.equal(mock.dataOrigin, "mock_demo");
  assert.deepEqual(report.dataScope.dataClasses, { researchBaseline: 1, enterpriseMeasured: 1, realtimeSampling: 0, mockDemo: 1 });
  assert.equal(report.dataScope.verifiedLiveMetricCount, 0);
  assert.equal(report.dataScope.supportsCurrentAiRanking, false);
  assert.match(report.dataScope.boundary, /Mock\/演示/);
  await assert.rejects(
    async () => store.createReport({ runId: completed.id, title: "伪造当前排名", executiveSummary: "当前品牌排名第一", status: "final" }),
    (error) => error instanceof DiagnosticError && error.code === "DIAGNOSTIC_UNSUPPORTED_REALTIME_CLAIM"
  );
  console.log("Research baseline, enterprise measured, realtime sampling, and mock/demo boundary checks passed.");
} finally {
  database.close();
  await rm(directory, { recursive: true, force: true });
}
