import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CitationResearchStore } from "../citation-research-store.mjs";
import { DiagnosticAnalysisEngine } from "../diagnostic-analysis-engine.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { KnowledgeStore } from "../knowledge-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-diagnostic-real-engine-"));
let database;
let citationResearchStore;

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "diagnostic.sqlite") });
  const diagnosticStore = new DiagnosticStore(database);
  const knowledgeStore = new KnowledgeStore(database);
  citationResearchStore = new CitationResearchStore();

  const project = diagnosticStore.createProject({
    name: "医美设备 GEO 真实引擎验收",
    diagnosticType: "comprehensive",
    industry: "医疗美容设备",
    targetBrand: "测试企业",
    objective: "分析客户问题对应的历史信源生态，并识别企业知识缺口。"
  });
  const questionSet = diagnosticStore.freezeQuestionSet({
    questionSetId: diagnosticStore.createQuestionSet({
      projectId: project.id,
      questions: [{ id: "Q-1", text: "行业内专业的医美仪器有哪些核心参数？", intent: "选型" }]
    }).id
  });

  const localContractModel = {
    async generate(operation, input, prompt, validator, options) {
      assert.equal(operation, "diagnostic_analysis");
      assert.match(options.systemPrompt, /只能引用.*evidenceId/s);
      const evidence = diagnosticStore.listEvidence({ workspaceId: "default", runId: input.runId, limit: 100 });
      const research = evidence.find((item) => item.evidenceType === "research" && item.verificationStatus === "verified");
      const enterprise = evidence.find((item) => item.sourceKind === "enterprise_operations_snapshot");
      assert.ok(research, "real Citation Lab research evidence must be persisted before model analysis");
      assert.equal(enterprise, undefined, "research-only analysis must not read or persist enterprise operations data");
      assert.equal(evidence.some((item) => item.evidenceType === "enterprise"), false);
      assert.match(prompt, new RegExp(research.id));
      assert.match(prompt, /"targetPlatformCitationObservationCount": 194753/);
      for (const count of [61592, 34767, 48634, 49760]) assert.match(prompt, new RegExp(`"citationObservationCount": ${count}`));
      assert.match(options.systemPrompt, /全局历史基线/);
      assert.doesNotMatch(prompt, /行业内专业的医美仪器有哪些核心参数/);
      const raw = {
        executiveSummary: "本次报告基于 Citation Lab 四平台全局历史引用事实包，并明确目标行业没有直接 cohort。",
        findings: [{ id: "F-1", title: "存在可复核的历史信源样本", statement: "该问题在固定研究包中匹配到规范问题和历史引用观察，可用于信源类型研究。", evidenceIds: [research.id] }],
        questionInsights: [],
        sourceStrategy: [{ id: "SS-1", title: "以企业一手参数页为核心", rationale: "先建立可核验的产品参数页，再以行业媒体和平台内容扩展发现入口。", evidenceIds: [research.id] }],
        knowledgeAndSiteGaps: [{ id: "GAP-1", questionId: "Q-1", title: "行业直接样本缺口", statement: "Citation Lab 没有医疗美容设备直接行业 cohort，策略需标注为全局基线迁移。", evidenceIds: [research.id] }],
        roadmap: [{ id: "RM-1", title: "先建立四平台基线策略", rationale: "先依据四平台事实包确定信源、格式和问题类型，再进入内容生产。", evidenceIds: [research.id] }],
        recommendations: [{ id: "REC-1", category: "source_ecosystem", priority: "high", title: "建立四平台差异化信源计划", rationale: "四平台历史样本在域名覆盖、信源分类和内容格式上存在可核验差异。", expectedOutcome: "形成带证据边界的平台内容与发布计划。", evidenceIds: [research.id] }],
        limitations: ["Citation Lab 是固定历史研究基线，不代表客户当前 AI 平台表现。"],
        methodology: { approach: "逐问题检索 Citation Lab 和企业知识，证据先落库后生成。" },
        model: { providerId: "LOCAL-CONTRACT", model: "deterministic-contract-model" }
      };
      const validated = validator(raw, input);
      return {
        run: { id: "LOCAL-MODEL-RUN", providerId: "LOCAL-CONTRACT", providerName: "本地契约测试模型", model: "deterministic-contract-model", completedAt: new Date().toISOString() },
        ...validated
      };
    }
  };

  const engine = new DiagnosticAnalysisEngine({
    diagnosticStore,
    citationResearchStore,
    knowledgeStore,
    aiGenerationService: localContractModel
  });
  const result = await engine.analyze({
    workspaceId: "default",
    projectId: project.id,
    questionSetId: questionSet.id,
    providerId: "LOCAL-CONTRACT",
    model: "deterministic-contract-model",
    persistReport: true,
    reportStatus: "final",
    researchOnly: true
  });

  assert.equal(result.run.status, "completed");
  assert.equal(result.persistedReport.status, "final");
  assert.equal(result.report.methodology.questionCount, 0);
  assert.equal(result.report.methodology.frozenQuestionCount, 1);
  assert.equal(result.report.methodology.research.matchedQuestionCount, 0);
  assert.equal(result.report.methodology.research.citationObservationCountAcrossQuestionAnalyses, 0);
  assert.equal(result.report.methodology.research.globalBaseline.rawCitationObservationCount, 214119);
  assert.equal(result.report.methodology.research.globalBaseline.targetPlatformCitationObservationCount, 194753);
  assert.deepEqual(result.report.methodology.research.globalBaseline.platformFamilies, ["豆包", "DeepSeek", "千问", "元宝"]);
  assert.ok(result.evidenceCatalog.some((item) => item.evidenceType === "research" && item.verificationStatus === "verified"));
  assert.equal(result.evidenceCatalog.filter((item) => item.sourceKind === "citation_platform_family_profile").length, 4);
  assert.equal(result.evidenceCatalog.some((item) => item.evidenceType === "enterprise"), false);
  assert.equal(result.report.methodology.analysisMode, "citation_lab_research");
  assert.equal(result.report.methodology.rag.enabled, false);
  assert.equal(result.persistedRecommendations.length, 1);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].actionType, "publishing_strategy");
  assert.doesNotMatch(JSON.stringify(result.report), /当前品牌排名|推荐率\s*\d|引用率\s*\d/);
  const detailed = diagnosticStore.report("default", result.persistedReport.id, { includeRecommendations: true, includeEvidence: true, includeMetrics: true, includeRun: true });
  assert.ok(detailed.evidence.length >= 3);
  const platformOverview = detailed.sections.find((section) => section.key === "platformOverview");
  assert.ok(platformOverview && Array.isArray(platformOverview.content));
  assert.deepEqual(platformOverview.content.map((item) => item.原始引用观察), [61592, 34767, 48634, 49760]);
  assert.equal(detailed.run.status, "completed");
  console.log("Real diagnostic engine integration check passed");
} finally {
  citationResearchStore?.close();
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
