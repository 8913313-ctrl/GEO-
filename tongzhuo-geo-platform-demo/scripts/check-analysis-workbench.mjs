import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAnalysisWorkbenchApi } from "../analysis-workbench-api.mjs";
import {
  AnalysisWorkbenchEngine,
  buildResearchDocumentQuery,
  buildWorkbenchModelPrompt,
  deterministicResearchIntent,
  normalizeWorkbenchModelResponse,
  planAnalysisTools,
  recommendationLimitFromText,
  validateWorkbenchReport
} from "../analysis-workbench-engine.mjs";
import { AnalysisWorkbenchStore } from "../analysis-workbench-store.mjs";
import { AiGenerationRunStore, AiGenerationService, ContractValidationError } from "../ai-generation-service.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-analysis-workbench-"));
let database;

const TARGET_PLATFORMS = ["豆包", "DeepSeek", "千问", "元宝"];

function platform(label, citationObservationCount, domainCount) {
  return {
    key: label.toLowerCase(),
    label,
    family: label,
    citationObservationCount,
    preferredCitationObservationCount: Math.max(1, citationObservationCount - 100),
    questionCount: 620,
    citationsPerQuestion: Number((citationObservationCount / 620).toFixed(1)),
    sourceCount: domainCount,
    pageCount: domainCount * 3,
    domainCount,
    exclusiveDomainCount: Math.floor(domainCount / 3),
    exclusiveDomainSharePct: 33.3,
    averageQuotePosition: 8.2,
    positionedCitationCount: Math.floor(citationObservationCount * 0.9),
    averageSnippetLength: 240,
    longSnippetSharePct: 18.5,
    sourceCategories: [{ key: "news", label: "新闻媒体", citationObservationCount: 1200 }],
    sourceTypes: [{ key: "official", label: "企业官网", citationObservationCount: 800 }],
    ecosystems: [{ key: "open_web", label: "开放网络", citationObservationCount: 900 }],
    contentFormats: [{ key: "guide", label: "指南", citationObservationCount: 600 }],
    releaseYear: 2026,
    releaseYearPublishedSharePct: 45.8,
    missingPublishedDateSharePct: 15.1,
    publicationYears: [{ year: 2026, citationObservationCount: 500 }],
    topDomains: [{ domain: `${label.toLowerCase()}.example`, citationObservationCount: 300 }]
  };
}

const benchmark = {
  factPackVersion: "citation-platform-preference-v1",
  dataset: {
    citationObservations: 214119,
    preferredCitationObservations: 189845,
    targetPlatformCitationObservationCount: 194753,
    questionCount: 620,
    sourceCount: 9878,
    pageCount: 107659
  },
  source: { datasetVersion: "2.0.1", sourceCommit: "mock-source-commit" },
  statisticalScope: {
    customerPerformanceMetric: false,
    causalInference: false,
    publicationDateMeaning: "The cited page publication date, not the AI answer collection time."
  },
  limitations: ["Global historical baseline only; not real-time customer monitoring."],
  platforms: [
    platform("豆包", 61592, 3384),
    platform("DeepSeek", 34767, 3301),
    platform("千问", 48634, 1376),
    platform("元宝", 49760, 4715)
  ],
  domainOverlap: [{ platformA: "豆包", platformB: "元宝", sharedDomainCount: 1090 }],
  questionSegments: [{
    key: "comparison",
    label: "对比类",
    definition: "用户比较两个或多个选择。",
    platforms: TARGET_PLATFORMS.map((label, index) => ({ label, citationObservationCount: 100 - index * 10 }))
  }],
  coverage: {
    availableIndustryCohorts: [
      { key: "food_beverage", label: "餐饮", questionCount: 20 },
      { key: "beauty_hair", label: "美容美发", questionCount: 20 }
    ]
  }
};

class MockCitationResearchStore {
  constructor() { this.calls = []; }
  platformPreferenceBenchmark(options = {}) {
    this.calls.push(options);
    return benchmark;
  }
  analyzeQuestionSet(options = {}) {
    return {
      source: benchmark.source,
      statisticalScope: benchmark.statisticalScope,
      limitations: benchmark.limitations,
      cohort: {
        evidenceId: "CLH-MOCK", mode: "global_baseline", basis: "Mock global fallback.", requested: { industry: options.industry },
        resolvedIndustry: null, directIndustryCohortApplied: false, inferredIndustryCohort: false, globalFallbackApplied: true,
        fallbackReason: "No exact industry cohort.", selectionWarnings: ["Global fallback."], questionCount: 620, questionIds: [], questions: [],
        representativeMatches: [], availableIndustryCohorts: benchmark.coverage.availableIndustryCohorts, statisticalScope: benchmark.statisticalScope, source: benchmark.source
      },
      platforms: benchmark.platforms,
      citationSamples: []
    };
  }
}

class MockKnowledgeStore {
  constructor() { this.calls = []; }
  async retrieve(input = {}) {
    this.calls.push(input);
    return {
      knowledgeGap: false,
      results: [{
        title: "企业 GEO 服务说明",
        quote: "企业提供 GEO 诊断、知识库建设与内容运营服务。",
        libraryName: "企业知识库",
        sourceUrl: "https://example.test/geo-service",
        locator: "服务能力",
        score: 0.91
      }]
    };
  }
}

class MockAiGenerationService {
  constructor() { this.calls = []; }
  async generate(operation, input, prompt, validator, options = {}) {
    if (operation === "analysis_research_intent") {
      const raw = {
        topic: "四平台引用偏好研究", industry: "工业制造", platforms: TARGET_PLATFORMS,
        dimensions: ["platform_profile", "source_preferences", "content_formats", "content_strategy", "source_strategy"],
        representativeQuestions: ["工业企业如何开展 GEO 优化？", "制造业应该建设哪些 AI 信源？", "不同 AI 平台的内容偏好有什么差异？"],
        scopeMode: "auto", reportDepth: "quick", outputRequirements: ["输出平台分析与策略"], assumptions: []
      };
      const validated = validator(raw, input);
      const run = { id: `MOCK-PLANNER-${this.calls.length + 1}`, providerId: input.providerId, providerName: "Mock Provider", model: input.model || "mock-model", completedAt: new Date().toISOString() };
      this.calls.push({ operation, input, prompt, options, intent: validated.intent });
      return { run, ...validated };
    }
    const promptEnvelopeMatch = prompt.match(/\n\n(\{[\s\S]*\})\n\n/);
    assert.ok(promptEnvelopeMatch, "model prompt must contain one structured analysis envelope");
    const promptEnvelope = JSON.parse(promptEnvelopeMatch[1]);
    const toolEvidence = promptEnvelope.toolEvidence || [];
    const evidenceIds = [...new Set(toolEvidence.map((item) => item.evidenceId).filter(Boolean))];
    const evidenceIdFor = (toolName) => toolEvidence.find((item) => item.toolName === toolName)?.evidenceId || evidenceIds[0];
    assert.equal(operation, "analysis_workbench");
    assert.ok(evidenceIds.length > 0, "model prompt must contain persisted tool evidence ids");
    assert.match(options.systemPrompt, /toolEvidence/);
    const reportCallCount = this.calls.filter((item) => item.operation === "analysis_workbench").length;
    const raw = {
      title: reportCallCount ? "GEO 平台偏好追问报告" : "GEO 平台偏好快速报告",
      executiveSummary: "本报告仅把 Citation Lab 作为全局历史基线，不把观察数解释为推荐率或客户效果。",
      sections: [{
        key: "platform-baseline",
        title: "四平台历史基线",
        kind: "table",
        content: {
          columns: ["平台", "历史引用观察数"],
          rows: [["豆包", 61592], ["DeepSeek", 34767], ["千问", 48634], ["元宝", 49760]],
          scope: "Citation Lab 全局历史样本"
        },
        evidenceIds: [evidenceIdFor("platform_profile")]
      }],
      recommendations: [{
        title: "先核对行业样本覆盖再迁移策略",
        priority: "high",
        rationale: "平台基线不能直接等同于目标行业实证偏好。",
        expectedOutcome: "避免把全局相关性误写成行业因果结论。",
        evidenceIds: [evidenceIdFor("industry_coverage")]
      }],
      limitations: ["页面发布日期不是 AI 回答采集时间。"],
      followUpSuggestions: ["继续比较四个平台的信源类型差异。"]
    };
    const validated = validator(raw, input);
    this.calls.push({ operation, input, prompt, options, evidenceIds, report: validated.report });
    return {
      run: {
        id: `MOCK-AI-RUN-${this.calls.length}`,
        providerId: input.providerId,
        providerName: "Mock Provider",
        model: input.model || "mock-model",
        completedAt: new Date().toISOString()
      },
      ...validated
    };
  }
}

function responseCapture() {
  return { value: null, json(status, body) { this.value = { status, body }; return this.value; } };
}

async function callApi(handler, response, method, url, body = undefined) {
  const request = { method, url, body, headers: {} };
  const parts = new URL(url, "http://localhost").pathname.split("/").filter(Boolean);
  response.value = null;
  await handler(request, response, parts, null);
  return response.value;
}

function checkMigrationNine() {
  const migration = database.connection.prepare("SELECT version, name FROM migrations WHERE version = 9").get();
  assert.equal(migration?.version, 9);
  assert.equal(migration?.name, "ai_analysis_workbench");
  const tables = new Set(database.connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name));
  for (const table of ["analysis_sessions", "analysis_messages", "analysis_runs", "analysis_tool_calls", "analysis_artifacts"]) {
    assert.ok(tables.has(table), `Migration 9 must create ${table}`);
  }
  const indexes = new Set(database.connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'index'").all().map((row) => row.name));
  for (const index of ["analysis_sessions_workspace_idx", "analysis_messages_session_idx", "analysis_runs_session_idx", "analysis_tool_calls_run_idx", "analysis_artifacts_session_idx"]) {
    assert.ok(indexes.has(index), `Migration 9 must create ${index}`);
  }
  assert.equal(database.connection.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
}

function checkQuickPlanning() {
  assert.equal(recommendationLimitFromText("输出三条有数据边界的内容与信源建议。"), 3);
  assert.equal(recommendationLimitFromText("请给出 5 条行动策略。"), 5);
  assert.equal(recommendationLimitFromText("请给出详细建议。"), null);
  const plan = planAnalysisTools(
    "快速分析豆包、DeepSeek、千问和元宝的平台与信源偏好",
    { reportDepth: "quick", dataSources: ["citation_lab", "enterprise_knowledge", "site_operations"] }
  );
  const names = plan.map((item) => item.toolName);
  assert.deepEqual(names.slice(0, 5), ["dataset_overview", "industry_coverage", "research_cohort", "platform_profile", "source_mix"]);
  assert.ok(names.includes("enterprise_knowledge_search"));
  assert.ok(names.includes("site_operations_snapshot"));
  assert.equal(new Set(names).size, names.length, "quick tool plan must not contain duplicates");
  assert.ok(names.every((name) => !name.includes("web_search")), "quick mode must remain inside the allowlisted local tool plan");

  const focusedDetailed = planAnalysisTools(
    "只分析豆包的引用偏好，输出三条内容与信源建议。",
    {
      reportDepth: "detailed",
      dataSources: ["citation_lab"],
      intent: {
        topic: "豆包引用偏好",
        platforms: ["豆包"],
        dimensions: ["platform_profile", "source_preferences", "content_formats", "content_strategy", "source_strategy"],
        reportDepth: "detailed"
      }
    }
  ).map((item) => item.toolName);
  assert.ok(focusedDetailed.includes("platform_profile"));
  assert.ok(focusedDetailed.includes("source_mix"));
  assert.ok(focusedDetailed.includes("content_format_mix"));
  assert.ok(focusedDetailed.includes("citation_evidence_samples"));
  assert.equal(focusedDetailed.includes("domain_overlap"), false, "one-platform focused research must not load the cross-platform overlap matrix");
  assert.equal(focusedDetailed.includes("question_segment_matrix"), false, "unrequested question segmentation must not inflate the model context");
}

function checkBoundedResearchDocumentQuery() {
  const longRequest = `请基于仓库资料分析四平台引用偏好，并给出内容与信源策略。${"超长补充要求".repeat(7_000)}`;
  const query = buildResearchDocumentQuery(longRequest, {
    industry: "工业制造与企业 GEO 运营",
    topic: "豆包、DeepSeek、千问和元宝的引用偏好与落地策略",
    representativeQuestions: Array.from({ length: 8 }, (_, index) => `制造业企业第 ${index + 1} 个代表性客户问题应该如何回答？`)
  });
  assert.ok(Buffer.byteLength(query, "utf8") < 2_000, "research document query must remain below the store's strict 2000-byte safety boundary");
  assert.match(query, /工业制造/);
  assert.match(query, /DeepSeek/);
  assert.match(query, /代表问题/);
  assert.match(query, /用户要求摘要/);
  assert.ok(query.length < longRequest.length / 10, "the full 40k-style user request must never be copied into repository retrieval");
}

async function checkPlannerFallback() {
  const engine = new AnalysisWorkbenchEngine({
    store: {},
    aiGenerationService: {
      async generate() {
        const error = new Error("upstream timed out");
        error.code = "UPSTREAM_TIMEOUT";
        throw error;
      }
    }
  });
  const result = await engine.interpretRequest("只分析豆包的引用偏好，并给出内容与信源策略。", {
    providerId: "mock-provider",
    platforms: ["豆包"],
    reportDepth: "detailed"
  });
  assert.equal(result.plannerRun, null);
  assert.equal(result.plannerFallback?.applied, true);
  assert.equal(result.plannerFallback?.reasonCode, "UPSTREAM_TIMEOUT");
  assert.deepEqual(result.intent.platforms, ["豆包"]);
  assert.ok(result.intent.dimensions.includes("platform_profile"));
  assert.ok(result.intent.dimensions.includes("source_preferences"));
}

function checkWorkbenchModelContextBudget() {
  const repeatedRows = Array.from({ length: 40 }, (_, index) => ({ label: `类别-${index}`, citationObservationCount: 10_000 + index, sharePct: 20 + index / 10 }));
  const toolEvidence = [
    { refId: "E01", evidenceId: "AFE-BUDGET-01", toolName: "dataset_overview", label: "数据范围", result: { dataset: { ...benchmark.dataset, targetPlatformFamilies: TARGET_PLATFORMS }, source: benchmark.source, statisticalScope: benchmark.statisticalScope, limitations: Array(20).fill("固定历史样本，不是实时客户效果。") } },
    { refId: "E02", evidenceId: "AFE-BUDGET-02", toolName: "research_cohort", label: "样本", result: { requestedIndustry: "工业制造", scopeMode: "auto", cohort: { mode: "global_baseline", questionCount: 620, questions: Array.from({ length: 60 }, (_, index) => ({ questionId: `Q-${index}`, prompt: `问题 ${index} ${"问题描述".repeat(80)}` })), representativeMatches: [] }, boundary: "没有直接行业样本，只能进行策略迁移。" } },
    { refId: "E03", evidenceId: "AFE-BUDGET-03", toolName: "platform_profile", label: "四平台画像", result: { platforms: TARGET_PLATFORMS.map((label, index) => ({ ...platform(label, 60_000 - index * 5_000, 3_000 - index * 200), sourceCategories: repeatedRows })) } },
    { refId: "E04", evidenceId: "AFE-BUDGET-04", toolName: "source_mix", label: "信源", result: { platforms: TARGET_PLATFORMS.map((label) => ({ label, sourceCategories: repeatedRows, sourceTypes: repeatedRows, ecosystems: repeatedRows })) } },
    { refId: "E05", evidenceId: "AFE-BUDGET-05", toolName: "citation_evidence_samples", label: "引用页面证据", result: { samples: Array.from({ length: 60 }, (_, index) => ({ platform: TARGET_PLATFORMS[index % 4], title: `页面 ${index}`, sourceUrl: `https://example.test/${index}`, snippet: "长引用片段".repeat(4_000), citationObservationCount: 1_000 + index })), limitations: ["样本不是实时引用。"] } },
    { refId: "E06", evidenceId: "AFE-BUDGET-06", toolName: "research_document_search", label: "仓库资料", result: { query: "Citation Lab 方法论", resultCount: 12, results: Array.from({ length: 12 }, (_, index) => ({ evidenceId: `RDL-${index}`, title: `研究报告 ${index}`, category: "methodology", path: `reports/${index}.md`, sourceUrl: `https://github.com/example/${index}`, score: 0.9, snippet: "仓库研究片段".repeat(3_000), locator: { chunkOrdinal: index }, provenance: { sourceCommit: "a".repeat(40) } })), limitations: ["固定仓库快照。"] } }
  ];
  const context = buildWorkbenchModelPrompt({
    userRequest: "详细分析要求".repeat(5_000),
    researchIntent: { industry: "工业制造", topic: "四平台引用偏好", platforms: TARGET_PLATFORMS, representativeQuestions: ["制造业如何开展 GEO？"] },
    reportDepth: "detailed",
    selectedDataSources: ["citation_lab"],
    selectedPlatforms: TARGET_PLATFORMS,
    previousReport: { title: "上一版", executiveSummary: "摘要".repeat(5_000), sections: Array.from({ length: 20 }, (_, index) => ({ title: `章节${index}`, content: "正文".repeat(4_000) })) },
    recentConversation: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "对话".repeat(4_000) })),
    toolEvidence
  });
  assert.ok(context.promptBytes <= context.maximumPromptBytes);
  assert.ok(context.promptBytes <= 32 * 1024);
  const match = context.prompt.match(/\n\n(\{[\s\S]*\})\n\n/);
  assert.ok(match, "budgeted prompt must preserve one complete JSON envelope");
  const envelope = JSON.parse(match[1]);
  assert.equal(envelope.toolEvidence.length, toolEvidence.length);
  assert.deepEqual(envelope.toolEvidence.map((item) => item.evidenceId), toolEvidence.map((item) => item.evidenceId));
  assert.equal(envelope.contextBudget.fullEvidencePersisted, true);
  assert.ok(envelope.toolEvidence.find((item) => item.toolName === "citation_evidence_samples").result.samples.length <= 8);
  assert.ok(envelope.toolEvidence.find((item) => item.toolName === "research_document_search").result.results.length <= 6);
  assert.equal(toolEvidence[4].result.samples.length, 60, "model summarization must not mutate the full persisted evidence");
  assert.equal(toolEvidence[5].result.results.length, 12);
  const quickContext = buildWorkbenchModelPrompt({
    userRequest: "请输出摘要版报告",
    researchIntent: { industry: "工业制造", topic: "引用偏好", platforms: TARGET_PLATFORMS },
    reportDepth: "quick",
    selectedDataSources: ["citation_lab"],
    selectedPlatforms: TARGET_PLATFORMS,
    toolEvidence
  });
  assert.notEqual(quickContext.profile, "standard", "quick synthesis must start with a compact model context");
  const emergencyContext = buildWorkbenchModelPrompt({
    userRequest: "请生成四平台分析".repeat(10_000),
    researchIntent: {
      topic: "引用偏好分析".repeat(4_000),
      industry: "GEO运营".repeat(4_000),
      platforms: TARGET_PLATFORMS,
      representativeQuestions: Array.from({ length: 8 }, () => "客户问题".repeat(4_000)),
      assumptions: Array.from({ length: 8 }, () => "数据边界".repeat(4_000))
    },
    reportDepth: "detailed",
    selectedDataSources: ["citation_lab"],
    selectedPlatforms: TARGET_PLATFORMS,
    previousReport: { title: "上一版", executiveSummary: "执行摘要".repeat(10_000), sections: Array.from({ length: 10 }, () => ({ content: "章节".repeat(10_000) })) },
    recentConversation: Array.from({ length: 10 }, () => ({ role: "user", content: "追问".repeat(10_000) })),
    toolEvidence
  });
  assert.ok(emergencyContext.promptBytes <= emergencyContext.maximumPromptBytes);
  assert.ok(["lean", "emergency"].includes(emergencyContext.profile));
  const emergencyMatch = emergencyContext.prompt.match(/\n\n(\{[\s\S]*\})\n\n/);
  assert.ok(emergencyMatch, "emergency prompt must preserve one complete JSON envelope");
  const emergencyEnvelope = JSON.parse(emergencyMatch[1]);
  assert.deepEqual(emergencyEnvelope.selectedPlatforms, TARGET_PLATFORMS, "context compression must preserve every selected platform");
  assert.deepEqual(emergencyEnvelope.researchIntent.platforms, TARGET_PLATFORMS, "context compression must preserve every requested platform");
  for (const toolName of ["platform_profile", "source_mix"]) {
    const platformEvidence = emergencyEnvelope.toolEvidence.find((item) => item.toolName === toolName);
    assert.deepEqual(platformEvidence.result.platforms.map((item) => item.label), TARGET_PLATFORMS, `${toolName} must retain one evidence row per requested platform`);
  }
  const datasetEvidence = emergencyEnvelope.toolEvidence.find((item) => item.toolName === "dataset_overview");
  assert.deepEqual(datasetEvidence.result.dataset.targetPlatformFamilies, TARGET_PLATFORMS, "dataset scope must retain every target platform family");
}

function checkExplicitQuickDepthRouting() {
  const detailed = deterministicResearchIntent("是否需要对命中页面进行内容类型与摘要特征标注？", { reportDepth: "detailed" });
  assert.equal(detailed.reportDepth, "detailed", "the business term 摘要特征 must not downgrade a detailed report");
  const quick = deterministicResearchIntent("请输出摘要版报告", { reportDepth: "detailed" });
  assert.equal(quick.reportDepth, "quick");
}

function checkEvidenceContract() {
  const toolEvidence = [{ refId: "E01", evidenceId: "AFE-VALID-01", toolName: "platform_profile", result: benchmark.platforms }];
  const valid = validateWorkbenchReport({
    title: "结构化平台报告",
    executiveSummary: "仅描述历史样本。",
    sections: [{
      key: "matrix",
      title: "平台矩阵",
      kind: "table",
      content: { columns: ["平台", "观察数"], rows: [["豆包", 61592]] },
      evidenceIds: ["AFE-VALID-01"]
    }],
    recommendations: [{ title: "保留范围说明", rationale: "防止误解。", evidenceIds: ["AFE-VALID-01"] }],
    limitations: ["非实时监测。"]
  }, toolEvidence, { dataSources: ["citation_lab"], platforms: TARGET_PLATFORMS, reportDepth: "quick" });
  assert.deepEqual(valid.report.sections[0].content.rows, [["豆包", 61592]], "rich section content must survive validation");
  const shortReference = validateWorkbenchReport({
    title: "短证据编号报告",
    executiveSummary: "仅描述历史样本。",
    sections: [{ title: "平台事实", kind: "platform", content: "豆包有 61592 条历史引用观察。", evidenceIds: ["E01"] }],
    recommendations: [{ title: "执行节奏", rationale: "建议先按 30/60/90 天三阶段推进，每周发布 5 篇内容。", evidenceIds: ["E01"] }]
  }, toolEvidence);
  assert.deepEqual(shortReference.report.sections[0].evidenceIds, ["AFE-VALID-01"], "short evidence references must persist as full AFE ids");
  assert.equal(shortReference.report.recommendations.length, 1, "strategy planning numbers must not be treated as historical metrics");
  const forecastSanitized = validateWorkbenchReport({
    title: "效果预测拦截报告",
    executiveSummary: "仅描述历史样本。",
    sections: [{ title: "平台事实", kind: "platform", content: "豆包平均摘要长度为 240 字符。", evidenceIds: ["E01"] }],
    recommendations: [{ title: "不允许效果承诺", rationale: "建议执行内容计划。", expectedOutcome: "预计引用稳定在 240 次。", evidenceIds: ["E01"] }]
  }, toolEvidence, { unsupportedNumericPolicy: "sanitize" });
  assert.match(forecastSanitized.report.recommendations[0].expectedOutcome, /待核验/);
  assert.deepEqual(forecastSanitized.report.methodology.rejectedNumericClaims[0].values, ["240"]);
  const recommendationSanitized = validateWorkbenchReport({
    title: "建议数字证据清洗报告",
    executiveSummary: "仅描述历史样本。",
    sections: [{ title: "平台事实", kind: "platform", content: "豆包共有 61,592 条历史引用观察。", evidenceIds: ["E01"] }],
    recommendations: [{
      title: "保留事实并清洗建议中的推测数字",
      rationale: "豆包共有 61,592 条历史引用观察，但建议中的预期增幅 103.9% 尚无证据支持。",
      expectedOutcome: "预计新增 475 条引用观察。",
      evidenceIds: ["E01"]
    }]
  }, toolEvidence, { unsupportedNumericPolicy: "sanitize" });
  const sanitizedRecommendation = recommendationSanitized.report.recommendations[0];
  assert.match(sanitizedRecommendation.rationale, /61,592 条历史引用观察/, "evidence-supported figures must be preserved");
  assert.doesNotMatch(JSON.stringify(sanitizedRecommendation), /103\.9|475/, "unsupported recommendation figures must not survive sanitization");
  assert.match(sanitizedRecommendation.rationale, /待核验/);
  assert.match(sanitizedRecommendation.expectedOutcome, /待核验/);
  assert.deepEqual(recommendationSanitized.report.methodology.rejectedNumericClaims[0].values.sort(), ["103.9", "475"]);
  assert.ok(recommendationSanitized.report.limitations.some((item) => /待核验.*基线复测/.test(item)));
  const limitedRecommendations = validateWorkbenchReport({
    title: "按用户数量约束建议",
    executiveSummary: "仅描述历史样本。",
    sections: [{ title: "平台事实", kind: "platform", content: "豆包共有 61,592 条历史引用观察。", evidenceIds: ["E01"] }],
    recommendations: Array.from({ length: 5 }, (_, index) => ({ title: `建议 ${index + 1}`, rationale: "基于历史样本提出。", evidenceIds: ["E01"] }))
  }, toolEvidence, { recommendationLimit: 3 });
  assert.equal(limitedRecommendations.report.recommendations.length, 3, "an explicit recommendation count in the user request must cap the report output");
  const normalized = normalizeWorkbenchModelResponse({
    reportTitle: "兼容模型报告",
    summary: "模型使用兼容字段。",
    sections: { strategy: { title: "内容策略", kind: "strategy", content: "建议每周发布 5 篇内容。" } },
    actions: [{ title: "信源策略", reason: "先建设企业一手信源。" }]
  }, toolEvidence);
  assert.equal(normalized.sections.length, 1);
  assert.deepEqual(normalized.sections[0].evidenceIds, ["E01"]);
  assert.throws(
    () => validateWorkbenchReport({
      title: "伪造证据报告",
      executiveSummary: "不应通过。",
      sections: [{ title: "错误章节", content: "错误", evidenceIds: ["AFE-FABRICATED-99"] }],
      recommendations: []
    }, toolEvidence),
    (error) => error instanceof ContractValidationError && error.code === "MODEL_CONTRACT_INVALID"
  );
  assert.throws(
    () => validateWorkbenchReport({
      title: "编造数字报告",
      executiveSummary: "不应通过。",
      sections: [{ title: "错误统计", content: "豆包共有 999999 条历史引用观察。", evidenceIds: ["AFE-VALID-01"] }],
      recommendations: []
    }, toolEvidence),
    (error) => error instanceof ContractValidationError
      && error.code === "MODEL_CONTRACT_INVALID"
      && error.details.some((detail) => /999999/.test(detail))
  );
  assert.throws(
    () => validateWorkbenchReport({
      title: "编造结构化数字报告",
      executiveSummary: "不应通过。",
      sections: [{ title: "错误表格", content: { columns: ["平台", "观察数"], rows: [["豆包", 70000]] }, evidenceIds: ["AFE-VALID-01"] }],
      recommendations: []
    }, toolEvidence),
    (error) => error instanceof ContractValidationError
      && error.code === "MODEL_CONTRACT_INVALID"
      && error.details.some((detail) => /70000/.test(detail))
  );
  const sanitized = validateWorkbenchReport({
    title: "带无证据数字的可恢复报告",
    executiveSummary: "本报告只说明历史样本。",
    sections: [{ title: "平台观察", kind: "platform", content: "豆包共有 999999 条历史引用观察。", evidenceIds: ["E01"] }],
    recommendations: []
  }, toolEvidence, { unsupportedNumericPolicy: "sanitize" });
  assert.doesNotMatch(JSON.stringify({
    executiveSummary: sanitized.report.executiveSummary,
    sections: sanitized.report.sections,
    recommendations: sanitized.report.recommendations
  }), /999999/);
  assert.match(JSON.stringify(sanitized.report.sections[0].content), /待核验/);
  assert.deepEqual(sanitized.report.methodology.rejectedNumericClaims[0].values, ["999999"]);
  assert.ok(sanitized.report.limitations.some((item) => /无证据统计值/.test(item)));
}

async function checkFinalAttemptNumericRecovery() {
  const provider = {
    id: "deepseek-contract-recovery",
    name: "DeepSeek contract recovery",
    baseUrl: "https://api.deepseek.test/v1",
    model: "deepseek-chat",
    protocol: "openai_compatible",
    kind: "text",
    status: "enabled",
    apiKey: "test-only-key"
  };
  const providerStore = {
    async load() {},
    find(id) { return id === provider.id ? provider : null; }
  };
  const toolEvidence = [{ refId: "E01", evidenceId: "AFE-RECOVERY-01", toolName: "platform_profile", result: benchmark.platforms }];
  const secondResponse = {
    title: "最终尝试数字清洗报告",
    executiveSummary: "仅描述 Citation Lab 历史样本。",
    sections: [{ title: "平台事实", kind: "platform", content: "豆包共有 61,592 条历史引用观察。", evidenceIds: ["E01"] }],
    recommendations: [{
      title: "无证据预测必须降级",
      rationale: "豆包共有 61,592 条历史引用观察，但预期增幅 103.9% 尚无证据支持。",
      expectedOutcome: "预计新增 475 条引用观察。",
      evidenceIds: ["E01"]
    }]
  };
  let upstreamCalls = 0;
  let validatorCalls = 0;
  const service = new AiGenerationService({
    providerStore,
    runStore: new AiGenerationRunStore({ dataDir: path.join(temporaryDirectory, "numeric-recovery-runs") }),
    maxAttempts: 2,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => {
      upstreamCalls += 1;
      const content = upstreamCalls === 1 ? "not-json" : JSON.stringify(secondResponse);
      return new Response(JSON.stringify({
        id: `numeric-recovery-${upstreamCalls}`,
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });
  const generated = await service.generate(
    "analysis_workbench_numeric_recovery",
    { providerId: provider.id },
    "Return one report JSON object.",
    (raw, _input, validationContext = {}) => {
      validatorCalls += 1;
      const modelAttempt = Number(validationContext.attempt) || validatorCalls;
      const maximumAttempts = Number(validationContext.maxAttempts) || service.maxAttempts;
      return validateWorkbenchReport(raw, toolEvidence, {
        unsupportedNumericPolicy: modelAttempt >= maximumAttempts ? "sanitize" : "reject"
      });
    }
  );
  assert.equal(upstreamCalls, 2, "invalid JSON must consume the first model attempt");
  assert.equal(validatorCalls, 1, "invalid JSON must not be counted as a validator call");
  assert.equal(generated.run.attempts, 2);
  assert.match(generated.report.recommendations[0].rationale, /61,592 条历史引用观察/);
  assert.doesNotMatch(JSON.stringify(generated.report.recommendations), /103\.9|475/);
  assert.match(JSON.stringify(generated.report.recommendations), /待核验/);
  assert.ok(generated.report.limitations.some((item) => /待核验.*基线复测/.test(item)));
}

function checkStoreLifecycle(store) {
  const session = store.createSession({
    title: "Store 生命周期检查",
    providerId: "mock-provider",
    model: "mock-model",
    dataSources: ["citation_lab"],
    platforms: TARGET_PLATFORMS,
    reportDepth: "quick"
  });
  const message = store.addMessage(session.id, "user", "分析四平台引用偏好。");
  let run = store.createRun(session.id, message.id, { providerId: "mock-provider", reportDepth: "quick" });
  assert.equal(run.status, "queued");
  run = store.startRun(run.id, [{ toolName: "dataset_overview" }]);
  assert.equal(run.status, "running");
  const tool = store.createToolCall(run.id, 1, "dataset_overview", {});
  assert.equal(tool.status, "running");
  const completedTool = store.completeToolCall(tool.id, { citationObservations: 214119 });
  assert.equal(completedTool.status, "completed");
  const artifact = store.createArtifact(run.id, {
    title: "Store 报告 v1",
    executiveSummary: "生命周期通过。",
    sections: [{ key: "overview", title: "范围", kind: "overview", content: { citationObservations: 214119 }, evidenceIds: [tool.evidenceId] }],
    recommendations: [],
    limitations: [],
    followUpSuggestions: [],
    methodology: { toolCount: 1 }
  });
  assert.equal(artifact.version, 1);
  run = store.completeRun(run.id);
  assert.equal(run.status, "completed");
  const hydrated = store.session(store.workspaceId, session.id);
  assert.equal(hydrated.latestArtifact.id, artifact.id);
  assert.equal(hydrated.runs[0].toolCalls[0].evidenceId, tool.evidenceId);
}

async function checkApiAndFollowUp(store) {
  const citationResearchStore = new MockCitationResearchStore();
  const knowledgeStore = new MockKnowledgeStore();
  const siteOperationsCalls = [];
  const aiGenerationService = new MockAiGenerationService();
  const engine = new AnalysisWorkbenchEngine({
    store,
    citationResearchStore,
    knowledgeStore,
    aiGenerationService,
    siteOperationsProvider: async (input = {}) => {
      siteOperationsCalls.push(input);
      return {
        available: true,
        site: { publicationVersion: 3, publishedAt: "2026-07-28T00:00:00.000Z" },
        content: { totalArticles: 12, publishedArticles: 7 },
        boundary: "官网访问与 AI 爬虫访问不等于 AI 回答引用。"
      };
    }
  });
  const handler = createAnalysisWorkbenchApi({
    store,
    engine,
    requestJson: async (request) => request.body || {},
    configured: { requestBodyLimit: 1_000_000 }
  });
  const response = responseCapture();

  let result = await callApi(handler, response, "GET", "/api/v1/analysis-sessions/options");
  assert.equal(result.status, 200);
  assert.ok(result.body.data.tools.some((item) => item.name === "platform_profile"));
  result = await callApi(handler, response, "POST", "/api/v1/analysis-plans", {
    prompt: "分析工业制造在四个平台的引用偏好并制定策略", providerId: "mock-provider", model: "mock-model",
    dataSources: ["citation_lab"], externalDataConsent: true
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.intent.industry, "工业制造");
  assert.ok(result.body.data.plan.some((item) => item.toolName === "research_cohort"));

  await assert.rejects(
    () => callApi(handler, response, "POST", "/api/v1/analysis-sessions", {
      prompt: "缺少授权的分析",
      providerId: "mock-provider",
      externalDataConsent: false
    }),
    (error) => error.code === "ANALYSIS_EXTERNAL_MODEL_CONSENT_REQUIRED"
  );

  result = await callApi(handler, response, "POST", "/api/v1/analysis-sessions", {
    prompt: "快速分析豆包、DeepSeek、千问和元宝的平台与信源偏好",
    title: "四平台分析会话",
    providerId: "mock-provider",
    model: "mock-model",
    dataSources: ["citation_lab", "enterprise_knowledge", "site_operations"],
    platforms: TARGET_PLATFORMS,
    reportDepth: "quick",
    outputFormat: "interactive",
    industry: "工业制造",
    externalDataConsent: true,
    waitForCompletion: true
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.run.status, "completed");
  assert.equal(result.body.data.artifact.version, 1);
  assert.deepEqual(result.body.data.artifact.sections[0].content.rows[0], ["豆包", 61592]);
  const sessionId = result.body.data.session.id;
  const firstRunId = result.body.data.run.id;
  const firstArtifactId = result.body.data.artifact.id;
  assert.equal(citationResearchStore.calls.length, 1);
  assert.equal(knowledgeStore.calls.length, 1);
  assert.equal(siteOperationsCalls.length, 1);
  assert.ok(aiGenerationService.calls.some((item) => item.operation === "analysis_workbench"));
  const firstPlannerCall = aiGenerationService.calls.find((item) => item.operation === "analysis_research_intent");
  const firstReportCall = aiGenerationService.calls.find((item) => item.operation === "analysis_workbench");
  assert.equal(firstPlannerCall.options.upstreamTotalTimeoutMs, 28_000, "the planner must fall back before a slow model blocks task creation");
  assert.equal(firstPlannerCall.options.requestTimeoutMs, 25_000);
  assert.equal(firstPlannerCall.options.upstreamMaxAttempts, 1);
  assert.equal(firstPlannerCall.options.disableThinking, true);
  assert.equal(firstReportCall.options.upstreamTotalTimeoutMs, 105_000);
  assert.equal(firstReportCall.options.requestTimeoutMs, 100_000);
  assert.equal(firstReportCall.options.upstreamMaxAttempts, 2);
  assert.equal(firstReportCall.options.disableThinking, true);
  assert.equal(firstReportCall.options.jsonResponseFormat, true, "final reports must request the provider JSON response contract");
  assert.equal(firstReportCall.options.maxTokens, 10_000, "quick reports need enough completion budget for reasoning models to emit final JSON");
  assert.equal(firstReportCall.options.generationTotalTimeoutMs, 110_000);
  const firstToolCalls = result.body.data.run.toolCalls;
  assert.ok(firstToolCalls.some((item) => item.toolName === "enterprise_knowledge_search" && item.status === "completed"));
  assert.ok(firstToolCalls.some((item) => item.toolName === "site_operations_snapshot" && item.status === "completed"));
  const industryCoverage = firstToolCalls.find((item) => item.toolName === "industry_coverage")?.result;
  assert.equal(industryCoverage?.industryCohortAvailable, false);
  assert.equal(industryCoverage?.industryCohortApplied, false);

  result = await callApi(handler, response, "POST", `/api/v1/analysis-sessions/${encodeURIComponent(sessionId)}/messages`, {
    prompt: "继续比较四个平台的信源差异，并保留上一版报告上下文。",
    providerId: "mock-provider",
    model: "mock-model",
    dataSources: ["citation_lab"],
    platforms: TARGET_PLATFORMS,
    reportDepth: "detailed",
    externalDataConsent: true,
    waitForCompletion: true
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.artifact.version, 2);
  assert.equal(result.body.data.session.artifacts.length, 2);
  assert.equal(result.body.data.session.artifacts[1].id, firstArtifactId);
  assert.equal(result.body.data.session.artifacts[1].status, "superseded");
  const reportCalls = aiGenerationService.calls.filter((item) => item.operation === "analysis_workbench");
  assert.equal(reportCalls[1].options.upstreamTotalTimeoutMs, 105_000);
  assert.equal(reportCalls[1].options.requestTimeoutMs, 100_000);
  assert.equal(reportCalls[1].options.upstreamMaxAttempts, 2);
  assert.equal(reportCalls[1].options.maxTokens, 10_000, "the mock planner keeps this follow-up in quick mode");
  assert.match(reportCalls[1].prompt, /previousReport/);
  assert.match(reportCalls[1].prompt, /GEO 平台偏好快速报告/);

  result = await callApi(handler, response, "GET", `/api/v1/analysis-sessions/${encodeURIComponent(sessionId)}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.session.messageCount, 4, "two user and two assistant messages must be persisted");
  assert.equal(result.body.data.session.runs.length, 2);
  assert.ok(result.body.data.session.runs.every((item) => item.status === "completed"));
  assert.ok(result.body.data.session.runs.every((item) => item.toolCalls.every((tool) => tool.status === "completed" && tool.evidenceId)));

  result = await callApi(handler, response, "GET", `/api/v1/analysis-runs/${encodeURIComponent(firstRunId)}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.run.id, firstRunId);
  assert.ok(result.body.data.run.toolCalls.length >= 6);

  const otherStore = new AnalysisWorkbenchStore(database, { workspaceId: "other-workspace" });
  const otherSession = otherStore.createSession({ title: "其他企业会话", providerId: "mock-provider" });
  const otherMessage = otherStore.addMessage(otherSession.id, "user", "不应被默认工作区读取。");
  const otherRun = otherStore.createRun(otherSession.id, otherMessage.id, { providerId: "mock-provider" });
  await assert.rejects(
    () => callApi(handler, response, "GET", `/api/v1/analysis-runs/${encodeURIComponent(otherRun.id)}`),
    (error) => error.code === "ANALYSIS_SESSION_NOT_FOUND"
  );

  const deletionSession = store.createSession({ title: "待删除的测试报告", providerId: "mock-provider" });
  const deletionMessage = store.addMessage(deletionSession.id, "user", "删除报告功能测试");
  let deletionRun = store.createRun(deletionSession.id, deletionMessage.id, { providerId: "mock-provider" });
  deletionRun = store.startRun(deletionRun.id, [{ toolName: "dataset_overview" }]);
  const deletionTool = store.createToolCall(deletionRun.id, 1, "dataset_overview", {});
  store.completeToolCall(deletionTool.id, { citationObservations: 214119 });
  store.createArtifact(deletionRun.id, {
    title: "待删除的测试报告",
    executiveSummary: "删除功能回归测试报告。",
    sections: [{ key: "scope", title: "范围", kind: "overview", content: "测试", evidenceIds: [deletionTool.evidenceId] }],
    recommendations: [],
    limitations: [],
    followUpSuggestions: []
  });
  store.completeRun(deletionRun.id);
  await assert.rejects(
    () => callApi(handler, response, "DELETE", `/api/v1/analysis-sessions/${encodeURIComponent(deletionSession.id)}`, {}),
    (error) => error.code === "ANALYSIS_DELETE_CONFIRMATION_REQUIRED"
  );
  result = await callApi(handler, response, "DELETE", `/api/v1/analysis-sessions/${encodeURIComponent(deletionSession.id)}`, { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.deleted, true);
  assert.equal(result.body.data.artifacts, 1);
  assert.throws(() => store.session(store.workspaceId, deletionSession.id), (error) => error.code === "ANALYSIS_SESSION_NOT_FOUND");
  for (const table of ["analysis_sessions", "analysis_messages", "analysis_runs", "analysis_tool_calls", "analysis_artifacts"]) {
    assert.equal(database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${table === "analysis_sessions" ? "id" : table === "analysis_messages" ? "session_id" : table === "analysis_runs" || table === "analysis_artifacts" ? "session_id" : "run_id"} = ?`).get(table === "analysis_sessions" ? deletionSession.id : table === "analysis_tool_calls" ? deletionRun.id : deletionSession.id)?.count, 0, `${table} rows must be removed with a deleted report`);
  }

  const busySession = store.createSession({ title: "运行中的测试报告", providerId: "mock-provider" });
  const busyMessage = store.addMessage(busySession.id, "user", "运行中删除保护测试");
  const busyRun = store.createRun(busySession.id, busyMessage.id, { providerId: "mock-provider" });
  store.startRun(busyRun.id, []);
  assert.throws(() => store.deleteSession(store.workspaceId, busySession.id), (error) => error.code === "ANALYSIS_SESSION_BUSY");
  store.failRun(busyRun.id, new Error("测试结束"));
  store.deleteSession(store.workspaceId, busySession.id);
}

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "analysis-workbench.sqlite") });
  const store = new AnalysisWorkbenchStore(database, { workspaceId: "deployment-analysis-workbench" });
  checkMigrationNine();
  checkQuickPlanning();
  checkBoundedResearchDocumentQuery();
  await checkPlannerFallback();
  checkWorkbenchModelContextBudget();
  checkExplicitQuickDepthRouting();
  checkEvidenceContract();
  await checkFinalAttemptNumericRecovery();
  checkStoreLifecycle(store);
  await checkApiAndFollowUp(store);
  console.log("Analysis workbench checks passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
