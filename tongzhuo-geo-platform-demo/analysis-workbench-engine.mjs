import { ContractValidationError } from "./ai-generation-service.mjs";
import { AnalysisWorkbenchError } from "./analysis-workbench-store.mjs";

const CITATION_TOOLS = Object.freeze([
  "dataset_overview",
  "research_cohort",
  "platform_profile",
  "source_mix",
  "content_format_mix",
  "date_distribution",
  "top_domains",
  "domain_overlap",
  "question_segment_matrix",
  "industry_coverage",
  "citation_evidence_samples"
]);

const RESEARCH_DIMENSIONS = Object.freeze([
  "platform_profile",
  "source_preferences",
  "content_formats",
  "top_domains",
  "platform_overlap",
  "question_patterns",
  "publication_time",
  "content_strategy",
  "source_strategy",
  "execution_roadmap"
]);
const RESEARCH_DIMENSION_SET = new Set(RESEARCH_DIMENSIONS);
// Final synthesis runs in the background after the API has returned the queued
// run. Keep the longer allowance local to that call; previews and other content
// generation continue to use the service's 55 second upstream budget.
const FINAL_REPORT_GENERATION_BUDGET = Object.freeze({
  upstreamTotalTimeoutMs: 105_000,
  requestTimeoutMs: 100_000,
  upstreamMaxAttempts: 2
});
const RESEARCH_PLAN_GENERATION_BUDGET = Object.freeze({
  upstreamTotalTimeoutMs: 28_000,
  requestTimeoutMs: 25_000,
  upstreamMaxAttempts: 1
});
const SUPPORTED_PLATFORMS = Object.freeze(["豆包", "DeepSeek", "千问", "元宝"]);
const PLATFORM_ALIASES = Object.freeze({
  豆包: "豆包", doubao: "豆包",
  deepseek: "DeepSeek", "deep seek": "DeepSeek", 深度求索: "DeepSeek",
  千问: "千问", 通义千问: "千问", qwen: "千问",
  元宝: "元宝", 腾讯元宝: "元宝", yuanbao: "元宝"
});
const RESEARCH_INTENT_FALLBACK_CODES = new Set([
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_EMPTY_RESPONSE",
  "UPSTREAM_INVALID_RESPONSE",
  "MODEL_CONTRACT_INVALID"
]);

const TOOL_LABELS = Object.freeze({
  interpret_research_request: "理解研究要求并生成查询计划",
  dataset_overview: "读取数据集范围",
  research_cohort: "构建目标行业或问题研究样本",
  platform_profile: "计算目标平台引用画像",
  source_mix: "统计信源类型与生态",
  content_format_mix: "统计内容格式与摘要特征",
  date_distribution: "统计被引页面日期分布",
  top_domains: "统计高频与独有域名",
  domain_overlap: "计算平台信源重叠",
  question_segment_matrix: "计算问题类型 × 平台矩阵",
  industry_coverage: "检查目标行业样本覆盖",
  citation_evidence_samples: "抽取可追溯引用与页面证据",
  research_document_search: "检索 Citation Lab 研究报告与方法论",
  enterprise_knowledge_search: "检索企业知识库",
  site_operations_snapshot: "读取官网与运营摘要"
});

const RESEARCH_INTENT_SYSTEM_PROMPT = `你是 GEO 研究任务解析器。把用户的自然语言分析要求转换成一个受控研究计划；你不能执行 SQL、不能生成报告、不能补造仓库里不存在的行业数据。

只输出一个 JSON 对象：
{
  "topic":"研究主题",
  "industry":"用户要应用策略的行业或业务领域",
  "platforms":["豆包","DeepSeek","千问","元宝"],
  "dimensions":["platform_profile","source_preferences","content_formats","top_domains","platform_overlap","question_patterns","publication_time","content_strategy","source_strategy","execution_roadmap"],
  "representativeQuestions":["目标行业真实客户可能向 AI 提出的完整问题"],
  "scopeMode":"auto|direct_industry|global_baseline",
  "reportDepth":"quick|detailed|custom",
  "outputRequirements":["用户明确要求的报告内容"],
  "assumptions":["解析时必须说明的假设"]
}

规则：
1. platforms 只能从四个平台中选择；用户未限定时默认四个平台。
2. dimensions 必须从给定枚举中选择；用户要求“引用偏好和策略”时至少包含 platform_profile、source_preferences、content_formats、content_strategy、source_strategy。
3. representativeQuestions 输出 3-8 个自然问句，用来描述目标行业的用户提问结构，不得声称这些问题已存在于 Citation Lab。
4. scopeMode 默认 auto。只有用户明确要求只看全库基线时才用 global_baseline；不得因为用户写了行业就假设仓库有该行业直接样本。
5. 不得输出 SQL、统计数字、平台结论或报告正文。`;

const WORKBENCH_SYSTEM_PROMPT = `你是企业 GEO 数据研究与运营策略分析师。用户会给出一个分析需求，系统已经调用本地受控工具并提供可核验的事实结果。

必须遵守：
1. 只能使用 toolEvidence 中的事实，不得编造统计数字、平台偏好、域名或企业事实。
2. 每个正式章节和建议必须引用 toolEvidence 中存在的 refId（例如 E01、E03）；系统会把短编号转换为完整 evidenceId。不要抄写长串 AFE 编号。
3. 必须区分“Citation Lab 全局历史样本”“目标行业直接样本”“企业本地数据”和“策略推演”。没有行业样本时，不得写成该行业实证偏好。
4. 页面发布日期不是 AI 回答采集时间；引用观察数不是推荐率、提及率或客户效果。
5. 描述性相关不能写成因果结论。例如摘要更长不能直接证明长文更容易被引用。
6. 报告要直接回答 userRequest，并根据 reportDepth 控制详细程度。详细报告应包含数据范围、平台画像、差异矩阵、信源与内容策略、执行路线和限制说明。
7. 只输出一个 JSON 对象，不输出 Markdown 代码围栏或额外解释。
8. 为保证 JSON 完整：执行摘要不超过 500 个中文字符；详细报告最多 6 个章节、5 条建议；每个章节 content 不超过 500 个中文字符；每条建议 rationale 不超过 250 个中文字符、expectedOutcome 不超过 120 个中文字符；limitations 最多 8 条，followUpSuggestions 最多 4 条。不要复述整份工具结果。
9. roadmap、strategy 和 recommendations 中可以给出明确的建议周期或工作量，但必须写成“建议值/起始方案”，不能伪装成历史数据或效果预测。
10. expectedOutcome 只能描述可验收的交付物或验证动作，不得写“预计提升 20%”“稳定在 80 次/问题”等无实测依据的量化效果承诺。

JSON 格式：
{
  "title":"报告标题",
  "executiveSummary":"执行摘要",
  "sections":[{"key":"唯一键","title":"章节标题","kind":"overview|table|platform|strategy|roadmap|analysis","content":"字符串、数组或对象","evidenceIds":["E01"]}],
  "recommendations":[{"title":"行动建议","priority":"critical|high|medium|low","rationale":"依据与理由","expectedOutcome":"预期结果","evidenceIds":["E02"]}],
  "limitations":["限制说明"],
  "followUpSuggestions":["可继续追问的问题"]
}`;

function stringValue(value, maximum = 20_000) { return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum); }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function unique(values, maximum = 100) { return [...new Set((Array.isArray(values) ? values : []).map((item) => stringValue(item, 180)).filter(Boolean))].slice(0, maximum); }
function compact(value, depth = 0) {
  if (depth > 5) return undefined;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => compact(item, depth + 1)).filter((item) => item !== undefined);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [stringValue(key, 160), compact(item, depth + 1)]).filter(([, item]) => item !== undefined));
  if (["string", "number", "boolean"].includes(typeof value) || value === null) return typeof value === "string" ? stringValue(value, 20_000) : value;
  return undefined;
}
function normalize(value) { return stringValue(value, 500).normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\p{Z}\s]+/gu, ""); }
function platformName(value) {
  const source = stringValue(value, 80);
  if (!source) return "";
  const lowered = source.normalize("NFKC").toLocaleLowerCase("zh-CN");
  return PLATFORM_ALIASES[lowered] || PLATFORM_ALIASES[source] || SUPPORTED_PLATFORMS.find((item) => item.toLocaleLowerCase("zh-CN") === lowered) || "";
}
function platformsFromText(value) {
  const source = stringValue(value, 40_000).normalize("NFKC").toLocaleLowerCase("zh-CN");
  const selected = [];
  for (const [alias, canonical] of Object.entries(PLATFORM_ALIASES)) {
    if (source.includes(alias.toLocaleLowerCase("zh-CN")) && !selected.includes(canonical)) selected.push(canonical);
  }
  return SUPPORTED_PLATFORMS.filter((item) => selected.includes(item));
}
function dimensionsFromText(value) {
  const source = normalize(value);
  const dimensions = [];
  const add = (name) => { if (!dimensions.includes(name)) dimensions.push(name); };
  if (/平台|引用偏好|引用画像|引用差异/.test(source)) add("platform_profile");
  if (/信源|来源|媒体|社区|生态|渠道/.test(source)) add("source_preferences");
  if (/内容|格式|榜单|排名|指南|对比|摘要|长文|标题/.test(source)) add("content_formats");
  if (/域名|网站|页面|站点/.test(source)) add("top_domains");
  if (/重叠|差异|共同|独有|跨平台/.test(source)) add("platform_overlap");
  if (/问题|提问|问法|意图|场景/.test(source)) add("question_patterns");
  if (/时间|时效|年份|日期|更新/.test(source)) add("publication_time");
  if (/内容策略|写什么|内容规划|选题/.test(source)) add("content_strategy");
  if (/信源策略|渠道策略|发布平台|发布渠道/.test(source)) add("source_strategy");
  if (/执行|路线|计划|落地|周期|阶段/.test(source)) add("execution_roadmap");
  if (!dimensions.length || /策略|报告|分析/.test(source)) {
    ["platform_profile", "source_preferences", "content_formats", "content_strategy", "source_strategy"].forEach(add);
  }
  return dimensions;
}

export function recommendationLimitFromText(value) {
  const source = stringValue(value, 40_000);
  const match = source.match(/(?:输出|给出|提出|生成|需要)?\s*(10|[1-9]|[一二三四五六七八九十])\s*条[^，。；;\n]{0,24}(?:建议|策略|措施|方案)/u);
  if (!match) return null;
  const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const count = Number(match[1]) || chinese[match[1]] || 0;
  return count >= 1 && count <= 10 ? count : null;
}

// The full evidence ledger remains in SQLite. The model only receives a
// bounded synthesis packet so a private-deployment compatible endpoint can
// finish one report inside the reverse-proxy window.
const WORKBENCH_MODEL_PROMPT_BUDGET_BYTES = 28 * 1024;
const MODEL_CONTEXT_PROFILES = Object.freeze([
  Object.freeze({ name: "standard", userRequest: 8_000, arrayItems: 10, stringChars: 800, samples: 8, documents: 6, snippetChars: 360, previousSections: 6, conversationMessages: 6, conversationChars: 1_800 }),
  Object.freeze({ name: "compact", userRequest: 6_000, arrayItems: 7, stringChars: 600, samples: 6, documents: 4, snippetChars: 280, previousSections: 4, conversationMessages: 4, conversationChars: 1_200 }),
  Object.freeze({ name: "minimal", userRequest: 2_500, arrayItems: 4, stringChars: 320, samples: 3, documents: 2, snippetChars: 180, previousSections: 2, conversationMessages: 2, conversationChars: 600 }),
  Object.freeze({ name: "lean", userRequest: 1_500, arrayItems: 3, stringChars: 240, samples: 2, documents: 2, snippetChars: 160, previousSections: 1, conversationMessages: 2, conversationChars: 400 }),
  // Last-resort synthesis keeps an evidence reference for every completed
  // tool, but strips long source samples before a four-platform report is sent
  // to the model. The full evidence ledger remains persisted in SQLite.
  Object.freeze({ name: "emergency", userRequest: 900, arrayItems: 1, stringChars: 80, samples: 0, documents: 1, snippetChars: 60, previousSections: 1, conversationMessages: 1, conversationChars: 180 })
]);

function modelCompact(value, profile, depth = 0) {
  if (depth > 6) return undefined;
  if (Array.isArray(value)) return value.slice(0, profile.arrayItems).map((item) => modelCompact(item, profile, depth + 1)).filter((item) => item !== undefined);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [stringValue(key, 120), modelCompact(item, profile, depth + 1)]).filter(([, item]) => item !== undefined));
  if (typeof value === "string") return stringValue(value, profile.stringChars);
  if (["number", "boolean"].includes(typeof value) || value === null) return value;
  return undefined;
}

function compactResearchIntentForModel(value, profile) {
  const source = isObject(value) ? value : {};
  return {
    ...modelCompact(source, profile),
    platforms: unique(source.platforms || [], SUPPORTED_PLATFORMS.length),
    dimensions: unique(source.dimensions || [], RESEARCH_DIMENSIONS.length),
    outputRequirements: unique(source.outputRequirements || [], 12)
  };
}

function compactModelFields(source, fields, profile) {
  const row = {};
  for (const field of fields) {
    if (source?.[field] === undefined) continue;
    const compacted = modelCompact(source[field], profile);
    if (compacted !== undefined) row[field] = compacted;
  }
  return row;
}

function compactPlatformRows(source, profile, scalarFields, nestedFields = []) {
  const nestedLimit = Math.max(1, Math.min(2, Number(profile.arrayItems) || 1));
  return (Array.isArray(source?.platforms) ? source.platforms : [])
    .slice(0, SUPPORTED_PLATFORMS.length)
    .map((platform) => {
      const row = compactModelFields(platform, ["label", ...scalarFields], profile);
      for (const field of nestedFields) {
        row[field] = (Array.isArray(platform?.[field]) ? platform[field] : [])
          .slice(0, nestedLimit)
          .map((item) => modelCompact(item, profile))
          .filter((item) => item !== undefined);
      }
      return row;
    });
}

function compactPlatformEvidence(toolName, source, profile) {
  const base = compactModelFields(source, ["baselineScope", "pageDateMeaning", "longSnippetDefinition", "longSnippetThresholdCharacters"], profile);
  if (toolName === "platform_profile") return {
    ...base,
    platforms: compactPlatformRows(source, profile, ["citationObservationCount", "preferredCitationObservationCount", "questionCount", "citationsPerQuestion", "questionCoveragePct", "sourceCount", "pageCount", "domainCount", "exclusiveDomainCount", "exclusiveDomainSharePct", "averageQuotePosition", "positionedCitationCount", "averageSnippetLength", "longSnippetSharePct"])
  };
  if (toolName === "source_mix") return {
    ...base,
    platforms: compactPlatformRows(source, profile, [], ["sourceCategories", "sourceTypes", "ecosystems"])
  };
  if (toolName === "content_format_mix") return {
    ...base,
    platforms: compactPlatformRows(source, profile, ["averageSnippetLength", "longSnippetSharePct"], ["contentFormats"])
  };
  if (toolName === "date_distribution") return {
    ...base,
    platforms: compactPlatformRows(source, profile, ["releaseYear", "releaseYearPublishedSharePct", "missingPublishedDateSharePct"], ["publicationYears"])
  };
  return {
    ...base,
    platforms: compactPlatformRows(source, profile, ["domainCount", "exclusiveDomainCount", "exclusiveDomainSharePct"], ["topDomains"])
  };
}

function summarizedEvidenceResult(toolName, result, profile) {
  const source = isObject(result) ? result : {};
  if (toolName === "dataset_overview") {
    return {
      source: compactModelFields(source.source, ["id", "datasetVersion", "releaseDate", "sourceCommit", "sourceRepository"], profile),
      statisticalScope: compactModelFields(source.statisticalScope, ["primaryObservationFilter", "comparisonObservationFilter", "aggregationUnit", "platformGrouping", "publicationDateMeaning", "customerPerformanceMetric", "causalInference"], profile),
      dataset: {
        ...compactModelFields(source.dataset, ["questions", "questionCount", "platforms", "sources", "sourceCount", "pages", "pageCount", "citationObservations", "preferredCitationObservations", "targetPlatformCitationObservationCount", "targetPlatformPreferredCitationObservationCount"], profile),
        targetPlatformFamilies: unique(source.dataset?.targetPlatformFamilies || [], SUPPORTED_PLATFORMS.length)
      },
      limitations: (Array.isArray(source.limitations) ? source.limitations : []).slice(0, Math.max(1, Math.min(3, Number(profile.arrayItems) || 1))).map((item) => stringValue(item, profile.stringChars))
    };
  }
  if (["platform_profile", "source_mix", "content_format_mix", "date_distribution", "top_domains"].includes(toolName)) {
    return compactPlatformEvidence(toolName, source, profile);
  }
  if (toolName === "domain_overlap") {
    return {
      domainOverlap: (Array.isArray(source.domainOverlap) ? source.domainOverlap : [])
        .slice(0, 12)
        .map((item) => compactModelFields(item, ["platformA", "platformB", "sharedDomainCount", "unionDomainCount", "jaccardSimilarity", "overlapSharePct"], profile))
    };
  }
  if (toolName === "citation_evidence_samples") return {
    cohort: modelCompact(source.cohort, profile),
    samples: (source.samples || []).slice(0, profile.samples).map((item) => ({
      citationId: item?.citationId,
      questionId: item?.questionId,
      question: stringValue(item?.question, 300),
      platformFamily: item?.platformFamily || item?.platform,
      title: stringValue(item?.title, 300),
      domain: stringValue(item?.domain, 240),
      url: stringValue(item?.sourceUrl || item?.url, 1_000),
      snippet: stringValue(item?.snippet || item?.quote || item?.excerpt, profile.snippetChars)
    })),
    source: modelCompact(source.source, profile),
    statisticalScope: modelCompact(source.statisticalScope, profile),
    boundary: stringValue(source.boundary, profile.stringChars)
  };
  if (toolName === "research_document_search") return {
    query: stringValue(source.query, 1_950),
    index: modelCompact(source.index, profile),
    package: modelCompact(source.package, profile),
    retrievalScope: modelCompact(source.retrievalScope, profile),
    resultCount: source.resultCount,
    results: (source.results || []).slice(0, profile.documents).map((item) => ({
      evidenceId: item?.evidenceId,
      title: stringValue(item?.title, 300),
      category: item?.category,
      path: stringValue(item?.path, 500),
      sourceUrl: stringValue(item?.sourceUrl, 1_000),
      score: item?.score,
      snippet: stringValue(item?.snippet, profile.snippetChars),
      locator: modelCompact(item?.locator, profile),
      provenance: modelCompact(item?.provenance, profile)
    })),
    limitations: modelCompact(source.limitations, profile)
  };
  if (toolName === "research_cohort") return {
    requestedIndustry: source.requestedIndustry,
    scopeMode: source.scopeMode,
    cohort: {
      ...modelCompact(source.cohort, profile),
      questions: (source.cohort?.questions || []).slice(0, Math.max(1, Math.min(10, profile.arrayItems))).map((item) => modelCompact(item, profile)),
      representativeMatches: (source.cohort?.representativeMatches || []).slice(0, Math.max(1, Math.min(8, profile.arrayItems))).map((item) => modelCompact(item, profile))
    },
    representativeQuestions: modelCompact(source.representativeQuestions, profile),
    boundary: stringValue(source.boundary, profile.stringChars)
  };
  if (toolName === "enterprise_knowledge_search") return {
    knowledgeGap: source.knowledgeGap,
    message: stringValue(source.message, profile.stringChars),
    results: (source.results || []).slice(0, Math.max(1, Math.min(8, profile.arrayItems))).map((item) => ({ ...modelCompact(item, profile), quote: stringValue(item?.quote, profile.snippetChars) }))
  };
  return modelCompact(source, profile);
}

export function buildResearchDocumentQuery(userRequest, intent = {}) {
  const segments = ["Citation Lab 数据集 方法论 引用偏好 信源 内容格式 域名 数据边界"];
  const industry = stringValue(intent.industry, 80);
  const topic = stringValue(intent.topic, 160);
  const questions = unique(intent.representativeQuestions || [], 8).map((item) => stringValue(item, 80)).join("；").slice(0, 280);
  if (industry) segments.push(`行业：${industry}`);
  if (topic) segments.push(`主题：${topic}`);
  if (questions) segments.push(`代表问题：${questions}`);
  const prefix = segments.join("\n");
  const remaining = Math.max(200, Math.min(1_250, 1_950 - Buffer.byteLength(prefix, "utf8") - 32));
  let requestPrefix = stringValue(userRequest, remaining);
  if (requestPrefix) segments.push(`用户要求摘要：${requestPrefix}`);
  let query = segments.join("\n");
  while (Buffer.byteLength(query, "utf8") >= 2_000 && requestPrefix) {
    const over = Buffer.byteLength(query, "utf8") - 1_950;
    requestPrefix = requestPrefix.slice(0, Math.max(0, requestPrefix.length - Math.ceil(over / 2) - 8));
    segments[segments.length - 1] = `用户要求摘要：${requestPrefix}`;
    query = segments.join("\n");
  }
  return query;
}

export function buildWorkbenchModelPrompt(input = {}) {
  const fullEvidence = Array.isArray(input.toolEvidence) ? input.toolEvidence : [];
  const profiles = input.reportDepth === "quick" ? MODEL_CONTEXT_PROFILES.slice(1) : MODEL_CONTEXT_PROFILES;
  for (const profile of profiles) {
    const previous = input.previousReport ? {
      title: stringValue(input.previousReport.title, 500),
      executiveSummary: stringValue(input.previousReport.executiveSummary, Math.min(3_000, profile.stringChars * 2)),
      sections: (input.previousReport.sections || []).slice(0, profile.previousSections).map((item) => ({ key: item?.key, title: item?.title, kind: item?.kind, content: modelCompact(item?.content, profile), evidenceIds: modelCompact(item?.evidenceIds, profile) }))
    } : null;
    const envelope = {
      userRequest: stringValue(input.userRequest, profile.userRequest),
      researchIntent: compactResearchIntentForModel(input.researchIntent, profile),
      reportDepth: input.reportDepth,
      selectedDataSources: modelCompact(input.selectedDataSources, profile),
      selectedPlatforms: unique(input.selectedPlatforms || [], SUPPORTED_PLATFORMS.length),
      previousReport: previous,
      recentConversation: (input.recentConversation || []).slice(-profile.conversationMessages).map((item) => ({ role: item?.role, content: stringValue(item?.content, profile.conversationChars) })),
      toolEvidence: fullEvidence.map((item) => ({ refId: item.refId, evidenceId: item.evidenceId, toolName: item.toolName, label: item.label, result: summarizedEvidenceResult(item.toolName, item.result, profile) })),
      contextBudget: { version: "workbench-model-context-v1", profile: profile.name, maximumPromptBytes: WORKBENCH_MODEL_PROMPT_BUDGET_BYTES, fullEvidencePersisted: true, modelReceivesSummaries: true }
    };
    const prompt = `请根据本次受控工具结果完成用户要求。\n\n${JSON.stringify(envelope)}\n\n只输出系统消息要求的 JSON 对象。`;
    const promptBytes = Buffer.byteLength(prompt, "utf8");
    if (promptBytes <= WORKBENCH_MODEL_PROMPT_BUDGET_BYTES) return { prompt, envelope, promptBytes, profile: profile.name, maximumPromptBytes: WORKBENCH_MODEL_PROMPT_BUDGET_BYTES };
  }
  throw new AnalysisWorkbenchError("受控证据摘要仍超过模型上下文预算，请缩小分析范围后重试。", 422, "ANALYSIS_MODEL_CONTEXT_BUDGET_EXCEEDED", { maximumPromptBytes: WORKBENCH_MODEL_PROMPT_BUDGET_BYTES });
}

export function normalizeResearchIntent(raw, fallback = {}) {
  const source = isObject(raw?.intent) ? raw.intent : isObject(raw) ? raw : {};
  const fallbackPlatforms = unique(fallback.platforms || []).map(platformName).filter(Boolean);
  const requestedPlatforms = unique(source.platforms || []).map(platformName).filter(Boolean);
  const promptPlatforms = platformsFromText(fallback.userRequest || "");
  const platforms = SUPPORTED_PLATFORMS.filter((item) => (requestedPlatforms.length ? requestedPlatforms : promptPlatforms.length ? promptPlatforms : fallbackPlatforms.length ? fallbackPlatforms : SUPPORTED_PLATFORMS).includes(item));
  const requestedDimensions = unique(source.dimensions || []).filter((item) => RESEARCH_DIMENSION_SET.has(item));
  const dimensions = requestedDimensions.length ? requestedDimensions : dimensionsFromText(fallback.userRequest || "");
  const reportDepth = ["quick", "detailed", "custom"].includes(source.reportDepth)
    ? source.reportDepth
    : ["quick", "detailed", "custom"].includes(fallback.reportDepth) ? fallback.reportDepth : "detailed";
  const scopeMode = ["auto", "direct_industry", "global_baseline"].includes(source.scopeMode) ? source.scopeMode : "auto";
  const intent = {
    version: "citation-research-intent-v1",
    topic: stringValue(source.topic || fallback.topic || fallback.userRequest, 240),
    industry: stringValue(source.industry || fallback.industry, 160),
    platforms: platforms.length ? platforms : [...SUPPORTED_PLATFORMS],
    dimensions,
    representativeQuestions: unique(source.representativeQuestions || source.researchQuestions || [], 8).filter((item) => item.length >= 4),
    scopeMode,
    reportDepth,
    outputRequirements: unique(source.outputRequirements || [], 12),
    assumptions: unique(source.assumptions || [], 8)
  };
  if (!intent.topic) throw new ContractValidationError(["研究计划缺少 topic。"]);
  if (!intent.dimensions.length) throw new ContractValidationError(["研究计划缺少有效 dimensions。"]);
  if (!intent.platforms.length) throw new ContractValidationError(["研究计划没有有效平台。"]);
  if ((intent.dimensions.includes("content_strategy") || intent.dimensions.includes("source_strategy")) && intent.representativeQuestions.length > 0 && intent.representativeQuestions.length < 3) {
    throw new ContractValidationError(["策略研究计划的 representativeQuestions 应提供 3-8 个完整客户问题，或明确返回空数组并使用全库基线。"]);
  }
  return intent;
}

export function deterministicResearchIntent(userRequest, options = {}) {
  const prompt = stringValue(userRequest, 40_000);
  const industryPatterns = [
    /(?:我现在在|所在|目标|面向|针对)(?:的)?(?:这个)?行业[：:\s]*([^，。；;\n]{2,40})/i,
    /(?:行业|领域)[：:\s]*([^，。；;\n]{2,40})/i
  ];
  let industry = stringValue(options.industry, 160);
  if (!industry) {
    for (const pattern of industryPatterns) {
      const match = prompt.match(pattern);
      if (match?.[1]) { industry = stringValue(match[1], 160); break; }
    }
  }
  return normalizeResearchIntent({
    topic: prompt.slice(0, 240),
    industry,
    platforms: platformsFromText(prompt),
    dimensions: dimensionsFromText(prompt),
    representativeQuestions: [],
    scopeMode: /全库|全局基线/.test(prompt) ? "global_baseline" : "auto",
    reportDepth: /(?:快速分析|快速报告|简要分析|简要报告|简报|摘要版|只要摘要|只输出摘要|输出摘要)/.test(prompt) ? "quick" : options.reportDepth || "detailed",
    outputRequirements: [prompt]
  }, { ...options, userRequest: prompt });
}

function selectedPlatforms(benchmark, requested) {
  const wanted = new Set(Array.isArray(requested) && requested.length ? requested : ["豆包", "DeepSeek", "千问", "元宝"]);
  return (benchmark?.platforms || []).filter((item) => wanted.has(item.label) || wanted.has(item.family) || wanted.has(item.key));
}

export function planAnalysisTools(requestText, options = {}) {
  const prompt = stringValue(requestText, 40_000);
  const normalized = normalize(prompt);
  const intent = isObject(options.intent) ? normalizeResearchIntent(options.intent, { ...options, userRequest: prompt }) : null;
  const depth = intent?.reportDepth || (["quick", "detailed", "custom"].includes(options.reportDepth) ? options.reportDepth : "detailed");
  const dataSources = new Set(Array.isArray(options.dataSources) && options.dataSources.length ? options.dataSources : ["citation_lab"]);
  const dimensions = new Set(intent?.dimensions?.length ? intent.dimensions : dimensionsFromText(prompt));
  const names = [];
  const add = (name) => { if (!names.includes(name)) names.push(name); };
  if (dataSources.has("citation_lab")) {
    add("dataset_overview");
    add("industry_coverage");
    add("research_cohort");
    // Report depth controls writing detail, not query breadth. Only an explicit
    // all-dimensional request should pull every statistical matrix; otherwise
    // use the dimensions extracted from the user's request.
    const broad = /综合|完整|全部|全维度|全量/.test(normalized);
    if (broad || dimensions.has("platform_profile")) add("platform_profile");
    if (broad || dimensions.has("source_preferences")) add("source_mix");
    if (broad || dimensions.has("content_formats")) add("content_format_mix");
    if (dimensions.has("publication_time")) add("date_distribution");
    if (broad || dimensions.has("top_domains") || dimensions.has("source_preferences")) add("top_domains");
    if (broad || dimensions.has("platform_overlap")) add("domain_overlap");
    if (broad || dimensions.has("question_patterns")) add("question_segment_matrix");
    if (depth !== "quick" || dimensions.has("top_domains") || dimensions.has("source_preferences")) add("citation_evidence_samples");
    if (options.includeResearchDocuments !== false) add("research_document_search");
    if (depth === "quick") {
      const required = new Set(["dataset_overview", "industry_coverage", "research_cohort", "platform_profile", "source_mix", "research_document_search"]);
      names.splice(0, names.length, ...names.filter((name) => required.has(name)).slice(0, 6));
    }
  }
  if (dataSources.has("enterprise_knowledge")) add("enterprise_knowledge_search");
  if (dataSources.has("site_operations")) add("site_operations_snapshot");
  return names.map((toolName) => ({ toolName, label: TOOL_LABELS[toolName], arguments: {} }));
}

function citationToolResult(toolName, benchmark, request, cohortFact = null) {
  const platforms = selectedPlatforms(benchmark, request.platforms);
  const cohortPlatforms = selectedPlatforms(cohortFact, request.platforms);
  const cohort = cohortFact?.cohort || null;
  const cohortMode = stringValue(cohort?.mode, 80);
  const directIndustryMode = cohortMode === "industry_label";
  const relatedQuestionMode = cohortMode === "matched_representative_questions" || cohortMode === "explicit_question_ids";
  const cohortApplied = Boolean(cohort && !["global", "global_baseline"].includes(cohortMode) && Number(cohort.questionCount || 0) > 0);
  const cohortScope = cohort ? {
    evidenceId: cohort.evidenceId,
    mode: cohort.mode,
    basis: cohort.basis,
    requested: cohort.requested,
    resolvedIndustry: cohort.resolvedIndustry,
    directIndustryCohortApplied: cohort.directIndustryCohortApplied === true,
    inferredIndustryCohort: false,
    globalFallbackApplied: cohort.globalFallbackApplied === true,
    fallbackReason: cohort.fallbackReason || null,
    selectionWarnings: cohort.selectionWarnings || [],
    questionCount: Number(cohort.questionCount || 0),
    questionIds: (cohort.questionIds || []).slice(0, 60),
    questions: (cohort.questions || []).slice(0, 30).map((item) => ({ evidenceId: item.evidenceId, questionId: item.questionId, prompt: item.prompt, sourceLayer: item.sourceLayer, sourceSubcat: item.sourceSubcat })),
    representativeMatches: (cohort.representativeMatches || []).slice(0, 8).map((item) => ({ id: item.id, text: item.text, matchCount: item.matchCount, matches: (item.matches || []).slice(0, 5).map((match) => ({ evidenceId: match.evidenceId, questionId: match.questionId, prompt: match.prompt, score: match.score })) })),
    availableIndustryCohorts: cohort.availableIndustryCohorts || [],
    statisticalScope: cohort.statisticalScope,
    source: cohort.source
  } : null;
  const attachCohort = (result, mapper) => cohortApplied ? {
    ...result,
    targetCohort: {
      scope: cohortScope,
      platforms: cohortPlatforms.map(mapper),
      statisticalScope: cohortFact.statisticalScope,
      limitations: cohortFact.limitations || []
    }
  } : result;
  if (toolName === "dataset_overview") return { dataset: benchmark.dataset, source: benchmark.source, statisticalScope: benchmark.statisticalScope, limitations: benchmark.limitations };
  if (toolName === "research_cohort") return {
    requestedIndustry: request.industry,
    scopeMode: request.intent?.scopeMode || "auto",
    cohort: cohortScope || {
      mode: "global_baseline",
      fallbackApplied: true,
      fallbackReason: "未构建出目标行业直接样本，使用全库历史基线。",
      questionCount: 0,
      questions: []
    },
    representativeQuestions: request.intent?.representativeQuestions || [],
    boundary: cohortApplied
      ? "目标样本由可见的问题 ID 与筛选口径构建；仍属于历史引用观察，不是客户实时表现。"
      : "目标行业没有直接样本；后续行业建议属于全库基线上的策略迁移，不是该行业实测偏好。"
  };
  if (toolName === "platform_profile") return attachCohort({ longSnippetDefinition: "snippet length greater than 500 characters", longSnippetThresholdCharacters: 500, baselineScope: "Citation Lab global historical baseline", platforms: platforms.map((item) => ({
    label: item.label,
    citationObservationCount: item.citationObservationCount,
    preferredCitationObservationCount: item.preferredCitationObservationCount,
    questionCount: item.questionCount,
    citationsPerQuestion: item.citationsPerQuestion,
    sourceCount: item.sourceCount,
    pageCount: item.pageCount,
    domainCount: item.domainCount,
    exclusiveDomainCount: item.exclusiveDomainCount,
    exclusiveDomainSharePct: item.exclusiveDomainSharePct,
    averageQuotePosition: item.averageQuotePosition,
    positionedCitationCount: item.positionedCitationCount,
    averageSnippetLength: item.averageSnippetLength,
    longSnippetSharePct: item.longSnippetSharePct
  })) }, (item) => ({ label: item.label, citationObservationCount: item.citationObservationCount, preferredCitationObservationCount: item.preferredCitationObservationCount, questionCount: item.questionCount, citationsPerQuestion: item.citationsPerQuestion ?? item.citationsPerObservedQuestion, questionCoveragePct: item.questionCoveragePct, sourceCount: item.sourceCount, pageCount: item.pageCount, domainCount: item.domainCount, averageQuotePosition: item.averageQuotePosition, averageSnippetLength: item.averageSnippetLength }));
  if (toolName === "source_mix") return attachCohort({ baselineScope: "Citation Lab global historical baseline", platforms: platforms.map((item) => ({ label: item.label, sourceCategories: item.sourceCategories, sourceTypes: item.sourceTypes, ecosystems: item.ecosystems })) }, (item) => ({ label: item.label, sourceCategories: item.sourceCategories, sourceTypes: item.sourceTypes, ecosystems: item.ecosystems }));
  if (toolName === "content_format_mix") return attachCohort({ baselineScope: "Citation Lab global historical baseline", platforms: platforms.map((item) => ({ label: item.label, contentFormats: item.contentFormats, averageSnippetLength: item.averageSnippetLength, longSnippetSharePct: item.longSnippetSharePct })) }, (item) => ({ label: item.label, contentFormats: item.contentFormats, averageSnippetLength: item.averageSnippetLength, longSnippetSharePct: item.longSnippetSharePct }));
  if (toolName === "date_distribution") return attachCohort({ pageDateMeaning: benchmark.statisticalScope?.publicationDateMeaning, platforms: platforms.map((item) => ({ label: item.label, releaseYear: item.releaseYear, releaseYearPublishedSharePct: item.releaseYearPublishedSharePct, missingPublishedDateSharePct: item.missingPublishedDateSharePct, publicationYears: item.publicationYears })) }, (item) => ({ label: item.label, releaseYear: item.releaseYear, releaseYearPublishedSharePct: item.releaseYearPublishedSharePct, missingPublishedDateSharePct: item.missingPublishedDateSharePct, publicationYears: item.publicationYears }));
  if (toolName === "top_domains") return attachCohort({ baselineScope: "Citation Lab global historical baseline", platforms: platforms.map((item) => ({ label: item.label, domainCount: item.domainCount, exclusiveDomainCount: item.exclusiveDomainCount, exclusiveDomainSharePct: item.exclusiveDomainSharePct, topDomains: item.topDomains })) }, (item) => ({ label: item.label, domainCount: item.domainCount, topDomains: item.topDomains }));
  if (toolName === "domain_overlap") return { domainOverlap: (benchmark.domainOverlap || []).filter((item) => request.platforms.includes(item.platformA) && request.platforms.includes(item.platformB)) };
  if (toolName === "question_segment_matrix") return { segments: benchmark.questionSegments };
  if (toolName === "citation_evidence_samples") return {
    cohort: cohortScope,
    samples: (cohortFact?.citationSamples || cohortFact?.aggregations?.citationSamples || []).slice(0, 60),
    source: cohortFact?.source || benchmark.source,
    statisticalScope: cohortFact?.statisticalScope || benchmark.statisticalScope,
    boundary: cohortApplied ? "样本用于核验统计与查看引用页面，不代表当前实时引用。" : "目标行业无直接样本，本次不把页面样本表述为目标行业实证。"
  };
  if (toolName === "industry_coverage") {
    const industry = stringValue(request.industry || request.userRequest, 300);
    const normalizedIndustry = normalize(industry);
    const available = benchmark.coverage?.availableIndustryCohorts || [];
    const matched = available.filter((item) => {
      const label = normalize(item.label);
      return label && (normalizedIndustry.includes(label) || label.includes(normalizedIndustry));
    });
    return {
      requestedIndustry: industry,
      industryCohortAvailable: directIndustryMode,
      industryCohortApplied: directIndustryMode,
      relatedQuestionCohortApplied: relatedQuestionMode,
      activeCohortMode: cohortMode || "global_baseline",
      activeQuestionCount: Number(cohort?.questionCount || 0),
      matchingIndustryLabelsAvailable: matched.length > 0,
      matchedIndustryCohorts: matched,
      availableIndustryCohorts: available,
      interpretation: directIndustryMode
        ? "已按 Citation Lab 的明确行业标签构建并应用目标行业历史样本。"
        : relatedQuestionMode
          ? "没有直接行业标签；已构建透明的相关问题样本，但不能将其表述为目标行业完整实证。"
          : matched.length
            ? "存在近似行业标签，但未形成可用目标子集；本次使用全局历史基线。"
            : "没有直接行业标签；只能使用全局历史基线进行有边界的策略迁移。"
    };
  }
  throw new AnalysisWorkbenchError(`不支持的分析工具：${toolName}`, 422, "ANALYSIS_TOOL_NOT_ALLOWED", { toolName });
}

function evidenceReference(index) { return `E${String(index + 1).padStart(2, "0")}`; }

function normalizeEvidenceIds(value, allowed, aliases = new Map()) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const requested = unique(source).map((id) => id.replace(/^\[|\]$/g, "").trim());
  const ids = requested.map((id) => aliases.get(id.toUpperCase()) || id);
  const invalid = ids.filter((id) => !allowed.has(id));
  if (invalid.length) throw new ContractValidationError([`报告引用了不存在的工具证据：${invalid.join("、")}`]);
  return [...new Set(ids)];
}

function inferredEvidenceReferences(source, toolEvidence) {
  const text = normalize(JSON.stringify({ key: source?.key, title: source?.title, kind: source?.kind, content: source?.content ?? source?.items ?? source?.text }));
  const selected = [];
  const add = (toolName) => {
    const item = toolEvidence.find((row) => row.toolName === toolName);
    if (item?.refId && !selected.includes(item.refId)) selected.push(item.refId);
  };
  if (/范围|口径|数据集|样本|限制/.test(text)) add("dataset_overview");
  if (/行业|覆盖|cohort/.test(text)) add("industry_coverage");
  if (/平台|豆包|deepseek|千问|元宝|引用画像|观察数|位置|摘要/.test(text)) add("platform_profile");
  if (/信源|来源|媒体|社区|生态|渠道/.test(text)) add("source_mix");
  if (/格式|榜单|指南|对比|内容形态/.test(text)) add("content_format_mix");
  if (/日期|年份|时间|时效/.test(text)) add("date_distribution");
  if (/域名|网站/.test(text)) add("top_domains");
  if (/重叠|交集|独有/.test(text)) add("domain_overlap");
  if (/问题类型|提问|问法|意图|场景/.test(text)) add("question_segment_matrix");
  if (/企业|知识库|产品|服务/.test(text)) add("enterprise_knowledge_search");
  if (/官网|运营|发布|文章/.test(text)) add("site_operations_snapshot");
  if (!selected.length) {
    add("industry_coverage");
    add("dataset_overview");
    if (!selected.length && toolEvidence[0]?.refId) selected.push(toolEvidence[0].refId);
  }
  return selected.slice(0, 4);
}

export function normalizeWorkbenchModelResponse(raw, toolEvidence = []) {
  const source = isObject(raw?.report) && !raw.title && !raw.sections ? raw.report : raw;
  if (!isObject(source)) return source;
  const sectionsSource = Array.isArray(source.sections)
    ? source.sections
    : isObject(source.sections)
      ? Object.entries(source.sections).map(([key, value]) => isObject(value) ? { key, ...value } : { key, title: key, content: value })
      : [];
  const sections = sectionsSource.slice(0, 12).map((item, index) => {
    const section = isObject(item) ? item : { content: item };
    const explicitEvidence = section.evidenceIds ?? section.evidenceRefs ?? section.citations;
    return {
      ...section,
      key: section.key || section.id || `section-${index + 1}`,
      title: section.title || section.name || `第 ${index + 1} 部分`,
      kind: section.kind || section.type || "analysis",
      content: section.content ?? section.items ?? section.text ?? section.summary,
      evidenceIds: explicitEvidence == null || (Array.isArray(explicitEvidence) && !explicitEvidence.length)
        ? inferredEvidenceReferences(section, toolEvidence)
        : explicitEvidence
    };
  });
  const recommendationsSource = Array.isArray(source.recommendations)
    ? source.recommendations
    : Array.isArray(source.actions)
      ? source.actions
      : [];
  const recommendations = recommendationsSource.slice(0, 12).map((item) => {
    const recommendation = isObject(item) ? item : { rationale: item };
    const explicitEvidence = recommendation.evidenceIds ?? recommendation.evidenceRefs ?? recommendation.citations;
    return {
      ...recommendation,
      title: recommendation.title || recommendation.name || "GEO 行动建议",
      rationale: recommendation.rationale || recommendation.reason || recommendation.description || "",
      expectedOutcome: recommendation.expectedOutcome || recommendation.outcome || "",
      evidenceIds: explicitEvidence == null || (Array.isArray(explicitEvidence) && !explicitEvidence.length)
        ? inferredEvidenceReferences({ ...recommendation, kind: "strategy" }, toolEvidence)
        : explicitEvidence
    };
  });
  return {
    ...source,
    title: source.title || source.reportTitle || "GEO 运营分析报告",
    executiveSummary: source.executiveSummary || source.summary || source.overview || "",
    sections,
    recommendations,
    limitations: Array.isArray(source.limitations) ? source.limitations : source.limitations ? [source.limitations] : [],
    followUpSuggestions: Array.isArray(source.followUpSuggestions) ? source.followUpSuggestions : Array.isArray(source.followUps) ? source.followUps : []
  };
}

function normalizedNumber(value) {
  const candidate = String(value ?? "").replace(/,/g, "").trim();
  if (!candidate) return "";
  const number = Number(candidate);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(8)));
}

function allNumbers(value) {
  const output = new Set();
  const source = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const match of source.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const normalized = normalizedNumber(match[0]);
    if (normalized) output.add(normalized);
  }
  return output;
}

function claimedMetricNumbers(value, mode = "fact") {
  const output = new Set();
  const source = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (mode === "strategy") {
    const measuredSentences = source
      .split(/[。！？!?；;\n]+/u)
      .filter((sentence) => /历史|样本|统计|数据|观察|引用|占比|比例|平均|中位|域名|页面|问题数|记录|份额|jaccard|发布年份|摘要长度|排名|推荐率|提及率/iu.test(sentence));
    if (!measuredSentences.length) return output;
    return claimedMetricNumbers(measuredSentences.join("。"), "fact");
  }
  if (typeof value !== "string") {
    for (const normalized of allNumbers(value)) {
      const number = Number(normalized);
      if (Number.isInteger(number) && number >= 0 && number <= 4) continue;
      output.add(normalized);
    }
    return output;
  }
  const pattern = /(\d[\d,]*(?:\.\d+)?)\s*(%|％|字符|条|个|次|位|问|字|页|年|家|项|分|倍)/gu;
  for (const match of source.matchAll(pattern)) {
    const normalized = normalizedNumber(match[1]);
    if (!normalized) continue;
    const number = Number(normalized);
    const unit = match[2];
    // Small integers are commonly execution steps rather than measured facts.
    if (!["%", "％"].includes(unit) && Number.isInteger(number) && number >= 0 && number <= 4) continue;
    output.add(normalized);
  }
  return output;
}

function unsupportedEvidenceNumbers(value, evidenceIds, evidenceById, mode = "fact") {
  const claimed = claimedMetricNumbers(value, mode);
  if (!claimed.size) return [];
  const supported = new Set();
  for (const evidenceId of evidenceIds) {
    const row = evidenceById.get(evidenceId);
    if (!row) continue;
    for (const number of allNumbers(row.result)) {
      supported.add(number);
      const numeric = Number(number);
      if (Number.isFinite(numeric) && numeric >= 0 && numeric < 1_000) {
        [Math.round(numeric), Math.floor(numeric), Math.ceil(numeric), Math.floor(numeric / 5) * 5, Math.ceil(numeric / 5) * 5, Math.floor(numeric / 10) * 10, Math.ceil(numeric / 10) * 10]
          .forEach((variant) => supported.add(normalizedNumber(variant)));
      }
    }
  }
  const unsupported = new Set([...claimed].filter((number) => !supported.has(number)));
  const source = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const sentence of source.split(/[。！？!?；;\n]+/u)) {
    const forecast = /(预计|预期|可提升|将提升|提高到|增长到|达到|稳定在|改善(?=\s*\d)|提升(?=\s*\d)|增长(?=\s*\d))/iu.exec(sentence);
    if (!forecast) continue;
    // Only the text after a forecast marker is an unsupported projection. A
    // supported historical baseline earlier in the same sentence must remain.
    for (const number of claimedMetricNumbers(sentence.slice(forecast.index), "fact")) unsupported.add(number);
  }
  return [...unsupported];
}

function redactUnsupportedNumbers(value, unsupported, mode = "fact") {
  const blocked = new Set(unsupported);
  if (typeof value === "number") return blocked.has(normalizedNumber(value)) ? "待核验" : value;
  if (typeof value === "string") {
    const hasBlocked = (text) => [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].some((match) => blocked.has(normalizedNumber(match[0])));
    if (!hasBlocked(value)) return value;
    // Replace only the unsupported metric token. This keeps supported figures
    // and the surrounding explanation intact even when both occur together.
    return value.replace(
      /(\d[\d,]*(?:\.\d+)?)(\s*(?:%|％|字符|条|个|次|位|问|字|页|年|家|项|分|倍))?/gu,
      (match, number) => blocked.has(normalizedNumber(number)) ? "待核验" : match
    );
  }
  if (Array.isArray(value)) return value.map((item) => redactUnsupportedNumbers(item, unsupported, mode));
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactUnsupportedNumbers(item, unsupported, mode)]));
  return value;
}

function checkedEvidenceNumbers(value, evidenceIds, evidenceById, path, mode, policy, warnings) {
  const unsupported = unsupportedEvidenceNumbers(value, evidenceIds, evidenceById, mode);
  if (!unsupported.length) return value;
  if (policy !== "sanitize") throw new ContractValidationError([`${path} 包含引用证据未支持的统计数值：${unsupported.join("、")}`]);
  warnings.push({ path, values: unsupported });
  return redactUnsupportedNumbers(value, unsupported, mode);
}

export function validateWorkbenchReport(raw, toolEvidence, options = {}) {
  raw = normalizeWorkbenchModelResponse(raw, toolEvidence);
  if (!isObject(raw)) throw new ContractValidationError(["模型必须返回一个 JSON 对象。"]);
  const allowed = new Set((toolEvidence || []).map((item) => item.evidenceId));
  const evidenceById = new Map((toolEvidence || []).map((item) => [item.evidenceId, item]));
  const aliases = new Map();
  (toolEvidence || []).forEach((item, index) => {
    const refId = String(item.refId || evidenceReference(index)).toUpperCase();
    aliases.set(refId, item.evidenceId);
    aliases.set(refId.replace(/^E0*/, "E"), item.evidenceId);
    aliases.set(String(item.toolName || "").toUpperCase(), item.evidenceId);
  });
  const problems = [];
  const numericWarnings = [];
  const numericPolicy = options.unsupportedNumericPolicy === "sanitize" ? "sanitize" : "reject";
  const title = stringValue(raw.title, 500);
  let executiveSummary = stringValue(raw.executiveSummary || raw.summary, 30_000);
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections : [];
  const recommendationsRaw = Array.isArray(raw.recommendations) ? raw.recommendations : [];
  const recommendationLimit = Number.isInteger(Number(options.recommendationLimit))
    ? Math.max(1, Math.min(50, Number(options.recommendationLimit)))
    : 50;
  if (!title) problems.push("title 不能为空");
  if (!executiveSummary) problems.push("executiveSummary 不能为空");
  if (!sectionsRaw.length) problems.push("sections 必须至少包含一项");
  if (problems.length) throw new ContractValidationError(problems);
  executiveSummary = checkedEvidenceNumbers(executiveSummary, [...allowed], evidenceById, "executiveSummary", "strategy", numericPolicy, numericWarnings);
  const sections = sectionsRaw.slice(0, 30).map((item, index) => {
    const source = isObject(item) ? item : { content: item };
    const evidenceIds = normalizeEvidenceIds(source.evidenceIds, allowed, aliases);
    if (!evidenceIds.length) throw new ContractValidationError([`sections[${index}] 必须引用至少一个 evidenceId`]);
    let content = compact(source.content ?? source.items ?? source.text ?? source.summary);
    const kind = stringValue(source.kind, 80) || "analysis";
    const numberMode = ["strategy", "roadmap"].includes(kind.toLowerCase()) ? "strategy" : "fact";
    content = checkedEvidenceNumbers(content, evidenceIds, evidenceById, `sections[${index}]`, numberMode, numericPolicy, numericWarnings);
    return {
      key: stringValue(source.key, 120) || `section-${index + 1}`,
      title: stringValue(source.title, 500) || `第 ${index + 1} 部分`,
      kind,
      content,
      evidenceIds
    };
  });
  const recommendations = recommendationsRaw.slice(0, recommendationLimit).map((item, index) => {
    const source = isObject(item) ? item : { rationale: item };
    const evidenceIds = normalizeEvidenceIds(source.evidenceIds, allowed, aliases);
    if (!evidenceIds.length) throw new ContractValidationError([`recommendations[${index}] 必须引用至少一个 evidenceId`]);
    let rationale = stringValue(source.rationale || source.reason, 8_000);
    let expectedOutcome = stringValue(source.expectedOutcome || source.outcome, 5_000);
    const checked = checkedEvidenceNumbers({ rationale, expectedOutcome }, evidenceIds, evidenceById, `recommendations[${index}]`, "strategy", numericPolicy, numericWarnings);
    rationale = checked.rationale;
    expectedOutcome = checked.expectedOutcome;
    const priority = ["critical", "high", "medium", "low"].includes(source.priority) ? source.priority : "medium";
    return { title: stringValue(source.title, 500) || "GEO 行动建议", priority, rationale, expectedOutcome, evidenceIds };
  });
  const numericLimitation = numericWarnings.length
    ? `模型输出中的 ${numericWarnings.reduce((count, item) => count + item.values.length, 0)} 个无证据统计值已被系统替换为“待核验”；相关量化结论须完成基线复测后再写入正式事实。`
    : "";
  return {
    report: {
      title,
      executiveSummary,
      sections,
      recommendations,
      limitations: unique([...(Array.isArray(raw.limitations) ? raw.limitations : []), numericLimitation], 100).map((item) => stringValue(item, 2_000)),
      followUpSuggestions: unique(raw.followUpSuggestions, 20).map((item) => stringValue(item, 500)),
      methodology: {
        framework: "controlled-tool-analysis-workbench-v1",
        planner: "deterministic intent router over an allowlisted tool registry",
        evidenceRule: "Every report section and recommendation references persisted tool evidence.",
        dataSources: options.dataSources || [],
        platforms: options.platforms || [],
        reportDepth: options.reportDepth || "detailed",
        toolCount: toolEvidence.length,
        rejectedNumericClaims: numericWarnings
      }
    }
  };
}

export class AnalysisWorkbenchEngine {
  constructor(options = {}) {
    this.store = options.store;
    this.citationResearchStore = options.citationResearchStore;
    this.researchDocumentStore = options.researchDocumentStore || null;
    this.knowledgeStore = options.knowledgeStore;
    this.aiGenerationService = options.aiGenerationService;
    this.siteOperationsProvider = options.siteOperationsProvider || null;
    if (!this.store || !this.aiGenerationService) throw new TypeError("AnalysisWorkbenchEngine requires store and aiGenerationService.");
  }

  async interpretRequest(userRequest, options = {}) {
    const promptText = stringValue(userRequest, 40_000);
    const fallback = deterministicResearchIntent(promptText, options);
    const prompt = `请把下面的用户要求解析成受控 GEO 研究计划。\n\n${JSON.stringify({
      userRequest: promptText,
      currentIndustry: stringValue(options.industry, 160),
      currentPlatforms: Array.isArray(options.platforms) ? options.platforms : [],
      currentReportDepth: options.reportDepth || "detailed",
      supportedPlatforms: SUPPORTED_PLATFORMS,
      allowedDimensions: RESEARCH_DIMENSIONS,
      dataBoundary: "Citation Lab 可能没有用户目标行业的直接样本；不得假设存在。"
    }, null, 2)}\n\n只输出系统消息规定的 JSON 对象。`;
    try {
      const generated = await this.aiGenerationService.generate(
        "analysis_research_intent",
        { providerId: options.providerId, model: options.model, workspaceId: options.workspaceId || this.store.workspaceId },
        prompt,
        (raw) => ({ intent: normalizeResearchIntent(raw, { ...fallback, ...options, userRequest: promptText }) }),
        {
          systemPrompt: RESEARCH_INTENT_SYSTEM_PROMPT,
          temperature: 0.1,
          maxTokens: 3_000,
          ...RESEARCH_PLAN_GENERATION_BUDGET,
          disableThinking: true,
          inputSummary: { requestLength: promptText.length, platformCount: fallback.platforms.length },
          outputSummary: (result) => ({ platformCount: result.intent.platforms.length, dimensionCount: result.intent.dimensions.length, representativeQuestionCount: result.intent.representativeQuestions.length })
        }
      );
      return { intent: generated.intent, plannerRun: generated.run, plannerFallback: null };
    } catch (error) {
      if (!RESEARCH_INTENT_FALLBACK_CODES.has(String(error?.code || ""))) throw error;
      return {
        intent: fallback,
        plannerRun: null,
        plannerFallback: {
          applied: true,
          reasonCode: String(error.code),
          message: "大模型解析研究计划暂不可用，系统已按本地规则完成同等范围的受控计划。"
        }
      };
    }
  }

  async preview(input = {}) {
    const userRequest = stringValue(input.prompt || input.userRequest, 40_000);
    if (!userRequest) throw new AnalysisWorkbenchError("请输入要分析的需求。", 422, "ANALYSIS_INPUT_REQUIRED");
    if (!stringValue(input.providerId, 180)) throw new AnalysisWorkbenchError("请选择已配置的大模型。", 422, "ANALYSIS_MODEL_REQUIRED");
    const parsed = await this.interpretRequest(userRequest, {
      providerId: input.providerId,
      model: input.model,
      workspaceId: input.workspaceId || this.store.workspaceId,
      industry: input.industry,
      platforms: input.platforms,
      reportDepth: input.reportDepth
    });
    const dataSources = Array.isArray(input.dataSources) && input.dataSources.length ? input.dataSources : ["citation_lab"];
    const plan = planAnalysisTools(userRequest, {
      intent: parsed.intent,
      dataSources,
      includeResearchDocuments: Boolean(this.researchDocumentStore)
    });
    return { ...parsed, dataSources, plan };
  }

  async execute(runId, actor = null, request = null) {
    let run = this.store.run(runId, { includeTools: true });
    const session = this.store.session(this.store.workspaceId, run.sessionId);
    const userMessage = session.messages.find((item) => item.id === run.userMessageId) || session.messages.filter((item) => item.role === "user").at(-1);
    const snapshot = run.requestSnapshot || {};
    const userRequest = stringValue(userMessage?.content || snapshot.prompt, 40_000);
    const dataSources = Array.isArray(snapshot.dataSources) && snapshot.dataSources.length ? snapshot.dataSources : session.dataSources;
    const initialPlatforms = Array.isArray(snapshot.platforms) && snapshot.platforms.length ? snapshot.platforms : session.platforms;
    const initialDepth = snapshot.reportDepth || session.reportDepth;
    run = this.store.startRun(runId, [{ toolName: "interpret_research_request", label: TOOL_LABELS.interpret_research_request, arguments: {} }]);
    const evidence = [];
    try {
      const intentTool = this.store.createToolCall(runId, 1, "interpret_research_request", { requestLength: userRequest.length });
      let researchIntent;
      let plannerRun = null;
      let plannerFallback = null;
      try {
        if (isObject(snapshot.researchIntent)) researchIntent = normalizeResearchIntent(snapshot.researchIntent, { userRequest, industry: snapshot.industry, platforms: initialPlatforms, reportDepth: initialDepth });
        else {
          const parsed = await this.interpretRequest(userRequest, {
            providerId: run.providerId,
            model: run.model,
            workspaceId: this.store.workspaceId,
            industry: snapshot.industry,
            platforms: initialPlatforms,
            reportDepth: initialDepth
          });
          researchIntent = parsed.intent;
          plannerRun = parsed.plannerRun;
          plannerFallback = parsed.plannerFallback || null;
        }
        const completed = this.store.completeToolCall(intentTool.id, compact({
          intent: researchIntent,
          source: isObject(snapshot.researchIntent) ? "user_confirmed_research_plan" : plannerFallback?.applied ? "deterministic_fallback_plan" : "model_parsed_research_plan",
          plannerModel: plannerRun ? { providerId: plannerRun.providerId, model: plannerRun.model, runId: plannerRun.id } : null,
          plannerFallback
        }));
        evidence.push({ evidenceId: completed.evidenceId, toolName: completed.toolName, label: TOOL_LABELS[completed.toolName], result: completed.result });
      } catch (error) {
        this.store.failToolCall(intentTool.id, error);
        throw error;
      }
      const platforms = researchIntent.platforms;
      const reportDepth = researchIntent.reportDepth;
      const analysisRequest = {
        userRequest,
        intent: researchIntent,
        industry: researchIntent.industry || stringValue(snapshot.industry, 300),
        dataSources,
        platforms,
        reportDepth
      };
      const plannedTools = planAnalysisTools(userRequest, {
        ...analysisRequest,
        includeResearchDocuments: Boolean(this.researchDocumentStore)
      });
      const plan = [{ toolName: "interpret_research_request", label: TOOL_LABELS.interpret_research_request, arguments: {} }, ...plannedTools];
      run = this.store.updateRunPlan(runId, plan);
      let benchmark = null;
      let cohortFact = null;
      if (dataSources.includes("citation_lab")) {
        if (!this.citationResearchStore?.platformPreferenceBenchmark) throw new AnalysisWorkbenchError("Citation Lab 统计服务尚未就绪。", 503, "CITATION_RESEARCH_NOT_READY");
        benchmark = await this.citationResearchStore.platformPreferenceBenchmark({ platformFamilies: platforms });
        if (typeof this.citationResearchStore.analyzeQuestionSet === "function") {
          cohortFact = await this.citationResearchStore.analyzeQuestionSet({
            industry: analysisRequest.industry,
            representativeQuestions: researchIntent.representativeQuestions,
            platformFamilies: platforms,
            scopeMode: researchIntent.scopeMode,
            minimumScore: 0.16,
            matchLimitPerQuestion: 4,
            citationLimit: reportDepth === "quick" ? 20 : 60,
            domainLimit: reportDepth === "quick" ? 10 : 25
          });
        } else if (typeof this.citationResearchStore.buildResearchCohort === "function") {
          cohortFact = { cohort: await this.citationResearchStore.buildResearchCohort({ industry: analysisRequest.industry, representativeQuestions: researchIntent.representativeQuestions, scopeMode: researchIntent.scopeMode }) };
        }
      }
      for (let index = 0; index < plannedTools.length; index += 1) {
        const item = plannedTools[index];
        const tool = this.store.createToolCall(runId, index + 2, item.toolName, { ...item.arguments, platforms, industry: analysisRequest.industry, dimensions: researchIntent.dimensions, scopeMode: researchIntent.scopeMode });
        try {
          let result;
          if (CITATION_TOOLS.includes(item.toolName)) result = citationToolResult(item.toolName, benchmark, analysisRequest, cohortFact);
          else if (item.toolName === "research_document_search") {
            if (this.researchDocumentStore?.search) {
              const retrieval = await this.researchDocumentStore.search({ query: buildResearchDocumentQuery(userRequest, researchIntent), categories: ["methodology", "quality_report", "data_contract"], limit: reportDepth === "quick" ? 6 : 12 });
              result = {
                query: retrieval.query,
                index: retrieval.index,
                package: retrieval.package,
                retrievalScope: retrieval.retrievalScope,
                resultCount: retrieval.resultCount,
                results: (retrieval.results || []).map((row) => ({ evidenceId: row.evidenceId, title: row.title, category: row.category, path: row.path, sourceUrl: row.sourceUrl, score: row.score, snippet: row.snippet, locator: row.locator, provenance: row.provenance })),
                limitations: retrieval.limitations
              };
            } else result = { available: false, state: "not_configured", results: [], limitations: ["Citation Lab 研究文档索引尚未配置；本次仅使用结构化数据事实。"] };
          }
          else if (item.toolName === "enterprise_knowledge_search") {
            const retrieval = await this.knowledgeStore.retrieve({ workspaceId: this.store.workspaceId, query: userRequest, businessLineId: stringValue(snapshot.businessLineId, 180), topK: 8, minScore: 0.08, includeInternal: false, providerId: stringValue(snapshot.embeddingProviderId, 180), actor });
            result = { knowledgeGap: Boolean(retrieval?.knowledgeGap), message: retrieval?.message || "", results: (retrieval?.results || retrieval?.evidence || []).slice(0, 8).map((row) => ({ title: row.title, quote: row.quote || row.excerpt || row.content, source: row.libraryName || row.source, sourceUrl: row.sourceUrl || "", locator: row.locator || "", score: row.score })) };
          } else if (item.toolName === "site_operations_snapshot") {
            result = typeof this.siteOperationsProvider === "function" ? await this.siteOperationsProvider({ workspaceId: this.store.workspaceId, userRequest, actor, request }) : { available: false, message: "官网与运营摘要服务未配置。" };
          } else throw new AnalysisWorkbenchError(`不支持的分析工具：${item.toolName}`, 422, "ANALYSIS_TOOL_NOT_ALLOWED");
          const completed = this.store.completeToolCall(tool.id, compact(result));
          evidence.push({ evidenceId: completed.evidenceId, toolName: completed.toolName, label: TOOL_LABELS[completed.toolName] || completed.toolName, result: completed.result });
        } catch (error) {
          this.store.failToolCall(tool.id, error);
          throw error;
        }
      }
      const fullModelEvidence = evidence.map((item, index) => ({
        refId: evidenceReference(index),
        evidenceId: item.evidenceId,
        toolName: item.toolName,
        label: item.label,
        result: item.result
      }));
      const previous = session.latestArtifact ? { title: session.latestArtifact.title, executiveSummary: session.latestArtifact.executiveSummary, sections: session.latestArtifact.sections.slice(0, 20) } : null;
      const conversation = session.messages.slice(-10).map((item) => ({ role: item.role, content: stringValue(item.content, 4_000) }));
      const modelContext = buildWorkbenchModelPrompt({ userRequest, researchIntent, reportDepth, selectedDataSources: dataSources, selectedPlatforms: platforms, previousReport: previous, recentConversation: conversation, toolEvidence: fullModelEvidence });
      const prompt = modelContext.prompt;
      const generated = await this.aiGenerationService.generate(
        "analysis_workbench",
        { providerId: run.providerId, model: run.model, workspaceId: this.store.workspaceId, sessionId: session.id, runId },
        prompt,
        (raw) => {
          return validateWorkbenchReport(normalizeWorkbenchModelResponse(raw, fullModelEvidence), fullModelEvidence, {
            dataSources,
            platforms,
            reportDepth,
            recommendationLimit: recommendationLimitFromText(userRequest),
            // Unsupported numeric claims are recoverable evidence defects, not
            // a reason to regenerate an otherwise valid long report. Sanitize
            // them on the first valid response so a slow provider cannot turn
            // the repair attempt into an upstream timeout.
            unsupportedNumericPolicy: "sanitize"
          });
        },
        {
          systemPrompt: WORKBENCH_SYSTEM_PROMPT,
          temperature: 0.2,
          maxTokens: reportDepth === "quick" ? 10_000 : reportDepth === "custom" ? 14_000 : 12_000,
          generationTotalTimeoutMs: 110_000,
          disableThinking: true,
          // DeepSeek's JSON-mode response format is optional by default because
          // some gateways return an empty content field when it is forced. The
          // final report is the one operation where a malformed response cannot
          // be rendered or safely repaired, so request the provider's native
          // JSON contract explicitly here.
          jsonResponseFormat: true,
          ...FINAL_REPORT_GENERATION_BUDGET,
          inputSummary: { sessionId: session.id, runId, dataSources, platforms, toolCount: evidence.length, reportDepth, modelPromptBytes: modelContext.promptBytes, modelContextProfile: modelContext.profile, fullEvidencePersisted: true },
          outputSummary: (result) => ({ sectionCount: result.report.sections.length, recommendationCount: result.report.recommendations.length })
        }
      );
      const report = {
        ...generated.report,
        methodology: {
          ...generated.report.methodology,
          model: { providerId: generated.run.providerId, providerName: generated.run.providerName, model: generated.run.model, runId: generated.run.id, generatedAt: generated.run.completedAt },
          toolEvidence: evidence.map((item) => ({ evidenceId: item.evidenceId, toolName: item.toolName, label: item.label })),
          researchIntent,
          cohort: cohortFact && benchmark ? citationToolResult("research_cohort", benchmark, analysisRequest, cohortFact).cohort : null,
          dataVersion: benchmark?.source?.datasetVersion || null,
          sourceCommit: benchmark?.source?.sourceCommit || null,
          modelContext: { profile: modelContext.profile, promptBytes: modelContext.promptBytes, maximumPromptBytes: modelContext.maximumPromptBytes, fullEvidencePersisted: true, modelReceivesSummaries: true }
        }
      };
      const artifact = this.store.createArtifact(runId, report, actor, request);
      this.store.addMessage(session.id, "assistant", report.executiveSummary, { artifactId: artifact.id, runId, title: artifact.title }, actor, request);
      run = this.store.completeRun(runId);
      return { session: this.store.session(this.store.workspaceId, session.id), run, artifact };
    } catch (error) {
      this.store.failRun(runId, error);
      throw error;
    }
  }
}

export const ANALYSIS_TOOL_REGISTRY = Object.freeze(Object.fromEntries(["interpret_research_request", ...CITATION_TOOLS, "research_document_search", "enterprise_knowledge_search", "site_operations_snapshot"].map((name) => [name, { name, label: TOOL_LABELS[name] }])));

export default AnalysisWorkbenchEngine;
