import assert from "node:assert/strict";
import {
  DiagnosticAnalysisEngine,
  DiagnosticAnalysisError,
  validateDiagnosticReport
} from "../diagnostic-analysis-engine.mjs";

class MockDiagnosticStore {
  constructor() {
    this.calls = [];
    this.added = [];
    this.failed = [];
    this.reports = [];
    this.recommendations = [];
    this.currentRun = null;
    this.projectValue = {
      id: "PROJECT-1",
      name: "示例制造企业",
      diagnosticType: "comprehensive",
      industry: "工业制造",
      targetBrand: "示例品牌",
      websiteUrl: "https://example.com/",
      businessLineId: "BL-1",
      objective: "建立可被 AI 理解和引用的企业信源",
      scope: { region: "中国" },
      researchPackageId: "RP-1"
    };
    this.questionSetValue = {
      id: "QUESTION-SET-1",
      projectId: "PROJECT-1",
      status: "frozen",
      version: 1,
      questions: [
        { id: "Q-1", text: "工业企业如何建设可被 AI 引用的官网内容？", intent: "方案" },
        { id: "Q-2", text: "制造企业做 GEO 前需要准备哪些可信资料？", intent: "准备清单" }
      ]
    };
  }

  project(workspaceId, projectId) {
    this.calls.push(["project", workspaceId, projectId]);
    assert.equal(projectId, this.projectValue.id);
    return this.projectValue;
  }

  latestFrozenQuestionSet(workspaceId, projectId) {
    this.calls.push(["latestFrozenQuestionSet", workspaceId, projectId]);
    return this.questionSetValue;
  }

  questionSet(workspaceId, questionSetId) {
    this.calls.push(["questionSet", workspaceId, questionSetId]);
    assert.equal(questionSetId, this.questionSetValue.id);
    return this.questionSetValue;
  }

  createRun(input) {
    this.calls.push(["createRun", input]);
    this.currentRun = {
      id: "RUN-1",
      projectId: input.projectId,
      questionSetId: input.questionSetId,
      status: "queued",
      inputSnapshot: {
        project: this.projectValue,
        questionSet: this.questionSetValue,
        researchPackage: { id: "RP-1" }
      }
    };
    return this.currentRun;
  }

  run(workspaceId, runId) {
    this.calls.push(["run", workspaceId, runId]);
    assert.equal(runId, this.currentRun.id);
    return this.currentRun;
  }

  startRun({ runId }) {
    this.calls.push(["startRun", runId]);
    assert.equal(runId, this.currentRun.id);
    this.currentRun = { ...this.currentRun, status: "running" };
    return this.currentRun;
  }

  addEvidence(input) {
    assert.equal(this.currentRun.status, "running", "evidence must be written to a running diagnostic run");
    const item = { id: `EVIDENCE-${this.added.length + 1}`, ...input };
    this.added.push(item);
    this.calls.push(["addEvidence", item.id]);
    return item;
  }

  completeRun({ runId }) {
    this.calls.push(["completeRun", runId]);
    assert.equal(runId, this.currentRun.id);
    this.currentRun = { ...this.currentRun, status: "completed", evidence: [...this.added] };
    return this.currentRun;
  }

  failRun(input) {
    this.calls.push(["failRun", input.runId]);
    this.failed.push(input);
    this.currentRun = { ...this.currentRun, status: "failed", errorCode: input.errorCode };
    return this.currentRun;
  }

  createReport(input) {
    this.calls.push(["createReport", input.runId]);
    assert.equal(this.currentRun.status, "completed", "report persistence must happen after run completion");
    assert.ok(Array.isArray(input.sections));
    const report = { id: `REPORT-${this.reports.length + 1}`, ...input };
    this.reports.push(report);
    return report;
  }

  createRecommendation(input) {
    this.calls.push(["createRecommendation", input.title]);
    assert.ok(this.added.some((item) => input.evidenceRefs.includes(item.id)), "persisted recommendation must reference run evidence");
    const recommendation = { id: `RECOMMENDATION-${this.recommendations.length + 1}`, ...input };
    this.recommendations.push(recommendation);
    return recommendation;
  }
}

class MockCitationResearchStore {
  constructor() {
    this.requests = [];
  }

  search(request) {
    this.requests.push(request);
    return {
      results: [{
        id: `CITATION-${request.question.id}`,
        title: `${request.question.id} 的研究资料`,
        sourceUrl: `https://research.example.com/${request.question.id.toLowerCase()}`,
        sourceName: "GEO Citation Lab",
        domain: "research.example.com",
        platformCode: "citation-lab",
        snippet: `历史研究资料可用于分析 ${request.question.text}`,
        verificationStatus: "verified"
      }]
    };
  }
}

class MockKnowledgeStore {
  constructor() {
    this.requests = [];
  }

  retrieve(request) {
    this.requests.push(request);
    if (request.query.includes("可信资料")) {
      return {
        runId: "KRET-2",
        results: [],
        evidence: [],
        knowledgeGap: true,
        message: "企业知识库尚未沉淀资质与案例材料。"
      };
    }
    return {
      runId: "KRET-1",
      knowledgeGap: false,
      results: [{
        id: "CHUNK-1",
        chunkId: "CHUNK-1",
        versionId: "VERSION-1",
        documentId: "DOCUMENT-1",
        libraryId: "LIBRARY-1",
        libraryName: "企业可信资料库",
        title: "企业官网内容规范",
        quote: "产品页应明确适用对象、核心能力、事实依据和可核验来源。",
        locator: "第 2 节",
        sourceName: "企业内容规范",
        sourceUrl: "https://example.com/standards/content",
        score: 0.91,
        approved: true,
        status: "approved"
      }]
    };
  }
}

class MockAiGenerationService {
  constructor(store) {
    this.store = store;
    this.called = false;
    this.options = null;
    this.prompt = "";
  }

  async generate(operation, input, prompt, validator, options) {
    this.called = true;
    this.options = options;
    this.prompt = prompt;
    assert.equal(operation, "diagnostic_analysis");
    assert.equal(this.store.added.length, 4, "all research and enterprise evidence must be persisted before model generation");
    assert.match(options.systemPrompt, /只能引用.*evidenceId/s);
    for (const item of this.store.added) assert.match(prompt, new RegExp(item.id));

    const validEvidenceId = this.store.added.find((item) => item.verificationStatus === "verified").id;
    const enterpriseEvidenceId = this.store.added.find((item) => item.evidenceType === "enterprise" && item.verificationStatus === "verified").id;
    const raw = {
      executiveSummary: "企业已有可用于 GEO 的内容规范。当前品牌排名第 1。",
      findings: [
        { id: "F-VALID", title: "已有内容规范", statement: "企业已经形成产品页内容规范。", evidenceIds: [enterpriseEvidenceId] },
        { id: "F-FAKE", title: "虚构证据", statement: "这条结论引用了不存在的证据。", evidenceIds: ["EVIDENCE-NOT-EXISTS"] },
        { id: "F-LIVE", title: "实时排名", statement: "当前品牌排名第 1。", evidenceIds: [validEvidenceId] }
      ],
      questionInsights: [
        { id: "QI-1", questionId: "Q-1", title: "官网内容问题", insight: "问题需要用产品事实与来源共同回答。", evidenceIds: [enterpriseEvidenceId] },
        { id: "QI-UNKNOWN", questionId: "Q-404", title: "错误问题", insight: "不存在的问题。", evidenceIds: [validEvidenceId] }
      ],
      sourceStrategy: [
        { id: "SS-1", title: "建设一手信源", rationale: "优先把审核后的企业事实发布到官网。", evidenceIds: [enterpriseEvidenceId] }
      ],
      knowledgeAndSiteGaps: [
        { id: "GAP-1", questionId: "Q-2", title: "资质资料缺口", statement: "企业知识库尚缺资质与案例材料。", evidenceIds: [] }
      ],
      roadmap: [
        { id: "RM-1", title: "补齐可信资料", rationale: "先补齐产品、资质和案例事实，再组织官网页面。", evidenceIds: [enterpriseEvidenceId] }
      ],
      recommendations: [
        { id: "REC-1", category: "site_cms", priority: "high", title: "补齐页面事实字段", rationale: "产品页规范要求展示可核验事实。", expectedOutcome: "提高内容可理解性。", evidenceIds: [enterpriseEvidenceId] },
        { id: "REC-FAKE", category: "content_plan", priority: "medium", title: "无证据建议", rationale: "没有证据。", evidenceIds: ["MADE-UP-ID"] },
        { id: "REC-RATE", category: "publishing", priority: "high", title: "推荐率结论", rationale: "推荐率已经达到 80%。", evidenceIds: [validEvidenceId] }
      ],
      limitations: ["研究引用只代表历史资料范围。"],
      methodology: { approach: "逐问题检索研究引用与企业知识，再进行证据约束分析。" },
      model: { providerId: "MOCK", model: "mock-model" }
    };
    const validated = validator(raw, input);
    return {
      run: {
        id: "AI-RUN-1",
        providerId: "MOCK",
        model: "mock-model",
        completedAt: "2026-07-28T00:00:00.000Z"
      },
      ...validated
    };
  }
}

function assertEvidenceReferences(report, store) {
  const available = new Set(store.added.map((item) => item.id));
  for (const section of ["findings", "questionInsights", "sourceStrategy", "roadmap", "recommendations"]) {
    for (const item of report[section]) {
      assert.ok(item.evidenceIds.length > 0, `${section} items must retain at least one evidence id`);
      for (const evidenceId of item.evidenceIds) assert.ok(available.has(evidenceId), `${evidenceId} must exist in the persisted run catalog`);
    }
  }
}

async function checkSuccessfulAnalysis() {
  const diagnosticStore = new MockDiagnosticStore();
  const citationResearchStore = new MockCitationResearchStore();
  const knowledgeStore = new MockKnowledgeStore();
  const aiGenerationService = new MockAiGenerationService(diagnosticStore);
  const engine = new DiagnosticAnalysisEngine({ diagnosticStore, citationResearchStore, knowledgeStore, aiGenerationService });
  const result = await engine.analyze({
    workspaceId: "WORKSPACE-1",
    projectId: "PROJECT-1",
    providerId: "MOCK",
    model: "mock-model",
    persistReport: true
  });

  assert.equal(result.run.status, "completed");
  assert.equal(result.evidenceCatalog.length, 4);
  assert.equal(citationResearchStore.requests.length, 2);
  assert.equal(knowledgeStore.requests.length, 2);
  assert.ok(aiGenerationService.called);
  assert.equal(diagnosticStore.failed.length, 0);
  assert.ok(result.persistedReport?.id);
  assert.equal(result.persistedRecommendations.length, 1);
  assert.equal(result.report.findings.length, 1, "fabricated and unsupported findings must be removed");
  assert.equal(result.report.recommendations.length, 1, "ungrounded and unsupported recommendations must be removed");
  assert.ok(result.report.knowledgeAndSiteGaps.some((item) => item.sourceSection === "findings"));
  assert.ok(result.report.knowledgeAndSiteGaps.some((item) => item.id === "RETRIEVAL-GAP-ENTERPRISE-Q-2"));
  assert.ok(result.report.validation.invalidEvidenceRefs.length >= 2);
  assert.ok(result.report.validation.rejectedClaims.some((item) => item.code === "current_brand_ranking"));
  assert.ok(result.report.validation.rejectedClaims.some((item) => item.code === "recommendation_rate"));
  assert.doesNotMatch(result.report.executiveSummary, /当前品牌排名第\s*1/);
  assert.doesNotMatch(JSON.stringify(result.report.findings), /当前品牌排名/);
  assert.doesNotMatch(JSON.stringify(result.report.recommendations), /推荐率已经达到/);
  for (const field of ["executiveSummary", "findings", "questionInsights", "sourceStrategy", "knowledgeAndSiteGaps", "roadmap", "recommendations", "limitations", "methodology", "model"]) {
    assert.ok(Object.hasOwn(result.report, field), `report contract must contain ${field}`);
  }
  assertEvidenceReferences(result.report, diagnosticStore);
}

async function checkFailureMarksRunFailed() {
  const diagnosticStore = new MockDiagnosticStore();
  const engine = new DiagnosticAnalysisEngine({
    diagnosticStore,
    citationResearchStore: new MockCitationResearchStore(),
    knowledgeStore: new MockKnowledgeStore(),
    aiGenerationService: {
      async generate() {
        throw Object.assign(new Error("mock upstream failure"), { code: "MOCK_UPSTREAM_FAILED" });
      }
    }
  });
  await assert.rejects(
    () => engine.run({ workspaceId: "WORKSPACE-1", projectId: "PROJECT-1", providerId: "MOCK" }),
    (error) => error instanceof DiagnosticAnalysisError && error.code === "MOCK_UPSTREAM_FAILED"
  );
  assert.equal(diagnosticStore.failed.length, 1);
  assert.equal(diagnosticStore.failed[0].errorCode, "MOCK_UPSTREAM_FAILED");
}

function checkStrictTopLevelContract() {
  assert.throws(
    () => validateDiagnosticReport("```json\n{}\n```", []),
    (error) => error instanceof DiagnosticAnalysisError && error.code === "DIAGNOSTIC_REPORT_CONTRACT_INVALID"
  );
}

function checkObjectSourceStrategyCoercion() {
  const report = validateDiagnosticReport({
    executiveSummary: "基于已核验的企业资料形成信源建设策略。",
    findings: [],
    questionInsights: [],
    sourceStrategy: {
      "官网一手信源": {
        rationale: "将审核后的产品事实、资质与案例发布到企业官网。",
        evidenceIds: ["EVIDENCE-VALID"]
      },
      "无依据的外部信源": {
        rationale: "该策略只引用了模型编造的证据编号。",
        evidenceIds: ["EVIDENCE-FABRICATED"]
      }
    },
    knowledgeAndSiteGaps: [],
    roadmap: [],
    recommendations: [],
    limitations: [],
    methodology: { approach: "按证据目录校验信源策略。" },
    model: { providerId: "MOCK", model: "mock-object-strategy-model" }
  }, [{
    id: "EVIDENCE-VALID",
    evidenceType: "enterprise",
    verificationStatus: "verified",
    title: "企业可信资料"
  }]);

  assert.ok(Array.isArray(report.sourceStrategy), "object sourceStrategy must be normalized to an array");
  assert.equal(report.sourceStrategy.length, 1, "the strategy with fabricated evidence must not survive normalization");
  assert.equal(report.sourceStrategy[0].title, "官网一手信源");
  assert.deepEqual(report.sourceStrategy[0].evidenceIds, ["EVIDENCE-VALID"]);
  assert.ok(report.validation.coercedFields.includes("sourceStrategy"));
  assert.ok(report.validation.invalidEvidenceRefs.some((item) => item.evidenceIds.includes("EVIDENCE-FABRICATED")));
  assert.doesNotMatch(JSON.stringify(report.sourceStrategy), /EVIDENCE-FABRICATED/);
}

function checkNumericFactGrounding() {
  const report = validateDiagnosticReport({
    executiveSummary: "固定历史样本中，豆包平台家族有 61,592 条引用观察。70,000 条这一说法没有证据。",
    findings: [
      { id: "F-NUMERIC-VALID", title: "豆包历史样本", statement: "豆包平台家族共有 61,592 条原始引用观察。", evidenceIds: ["EVIDENCE-FACT"] },
      { id: "F-NUMERIC-INVALID", title: "被篡改的统计", statement: "豆包平台家族共有 70,000 条原始引用观察。", evidenceIds: ["EVIDENCE-FACT"] }
    ],
    questionInsights: [],
    sourceStrategy: [],
    knowledgeAndSiteGaps: [],
    roadmap: [],
    recommendations: [],
    limitations: [],
    methodology: {},
    model: {}
  }, [{
    id: "EVIDENCE-FACT",
    evidenceType: "research",
    verificationStatus: "verified",
    title: "豆包历史引用事实包",
    claim: "豆包平台家族有 61592 条原始引用观察。",
    excerpt: "原始引用观察 61592 条；preferred 精确记录 55709 条。"
  }]);

  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].id, "F-NUMERIC-VALID");
  assert.match(report.executiveSummary, /61,592 条/);
  assert.doesNotMatch(report.executiveSummary, /70,000 条/);
  assert.ok(report.validation.rejectedClaims.some((item) => item.code === "unverified_numeric_claim" && item.values?.includes("70000")));
  assert.ok(report.knowledgeAndSiteGaps.some((item) => item.sourceSection === "findings"));
}

await checkSuccessfulAnalysis();
await checkFailureMarksRunFailed();
checkStrictTopLevelContract();
checkObjectSourceStrategyCoercion();
checkNumericFactGrounding();
console.log("diagnostic analysis engine checks passed");
