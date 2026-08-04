const REPORT_ARRAY_FIELDS = Object.freeze([
  "findings",
  "questionInsights",
  "sourceStrategy",
  "knowledgeAndSiteGaps",
  "roadmap",
  "recommendations"
]);

const USABLE_EVIDENCE_STATUSES = new Set(["verified", "supplied"]);
const RECOMMENDATION_CATEGORIES = new Set([
  "question_map",
  "source_ecosystem",
  "knowledge_gap",
  "site_cms",
  "content_plan",
  "publishing"
]);
const PRIORITIES = new Set(["critical", "high", "medium", "low"]);

const UNSUPPORTED_CLAIMS = Object.freeze([
  {
    code: "current_brand_ranking",
    label: "当前或实时品牌排名",
    pattern: /(?:当前|实时|最新|目前|currently|real[- ]?time|latest).{0,30}(?:品牌)?(?:排名|rank(?:ing)?).{0,18}(?:第?\s*\d+|第一|领先|落后|top\s*\d+|is\s+\d+)/iu
  },
  {
    code: "recommendation_rate",
    label: "推荐率、引用率或提及率",
    pattern: /(?:推荐率|引用率|提及率|recommendation\s+rate|citation\s+rate|mention\s+rate).{0,18}\d+(?:\.\d+)?\s*%/iu
  },
  {
    code: "sentiment",
    label: "情感倾向结论",
    pattern: /(?:情感倾向|情感得分|sentiment).{0,24}(?:正面|负面|中性|积极|消极|positive|negative|neutral|\d+(?:\.\d+)?\s*%)/iu
  },
  {
    code: "realtime_trend",
    label: "实时趋势结论",
    pattern: /(?:实时趋势|当前趋势|最新趋势|real[- ]?time\s+trend|current\s+trend).{0,30}(?:上升|下降|增长|走高|走低|rising|falling|increase|decrease)/iu
  },
  {
    code: "exact_citation_position",
    label: "未经实时采样支持的当前引用位置",
    pattern: /(?:当前|实时|本次回答|单次回答|currently|real[- ]?time|single\s+response).{0,30}(?:引用位置|引用位次|citation\s+position).{0,18}(?:第?\s*\d+|首位|第一|top\s*\d+)/iu
  },
  {
    code: "single_response_analysis",
    label: "单次回答分析",
    pattern: /(?:单次回答|一次回答|single\s+(?:model\s+)?response).{0,30}(?:显示|表明|证明|indicates|shows|proves)/iu
  },
  {
    code: "model_version_comparison",
    label: "模型版本对比",
    pattern: /(?:模型版本对比|model\s+version\s+comparison)|(?:(?:GPT|Claude|DeepSeek)[-\w.]*).{0,24}(?:优于|高于|低于|不如|vs\.?|versus|better|worse).{0,24}(?:(?:GPT|Claude|DeepSeek)[-\w.]*)/iu
  }
]);

const UNSUPPORTED_KEYS = /^(?:currentBrandRank|currentRanking|realTimeRank|recommendationRate|citationRate|mentionRate|sentimentScore|realTimeTrend|citationPosition|singleResponseAnalysis|modelVersionComparison)$/i;

const DIAGNOSTIC_SYSTEM_PROMPT = `你是企业 GEO 引用偏好与运营策略分析器。你的任务是基于 Citation Lab 事实包、本次运行已经持久化的研究证据和企业知识证据，生成结构化分析报告。

必须遵守：
1. 只能引用用户消息 evidenceCatalog 中存在的 evidenceId，不得编造、改写或引用目录外编号。
2. researchFactPack 出现时，必须覆盖豆包、DeepSeek、千问、元宝四个平台；事实包中的数值只能原样引用，不得自行改算、补齐或改写。
3. 必须区分四个范围：全局历史基线、行业 cohort、问题意图样本、企业自身证据。没有目标行业 cohort 时，只能写“全局历史基线对该行业的策略参考”，不得写成“该行业实证偏好”。
4. 历史研究证据只用于平台画像、问题类型、内容格式和信源策略判断；企业知识证据只用于该企业已审核知识范围内的判断。
5. 平均摘要长度、内容格式占比、信源频次和页面发布日期只代表历史相关性，不得写成“平台只看标题”“长文一定更容易被引用”等因果结论；页面发布日期不得解释为 AI 回答采集时间。
6. 没有带时间戳且已核验的实时采样时，禁止声称当前/实时品牌排名、推荐率、情感、实时趋势、当前严格引用位置、单次回答结论或模型版本差异。历史样本的平均引用位置可以作为描述性指标，但必须写明“历史样本平均”。
7. 没有可用证据的判断不得写入 findings、questionInsights、sourceStrategy、roadmap 或 recommendations，应写入 knowledgeAndSiteGaps 并明确“证据不足”。
8. 每条正式发现和建议至少引用一个 evidenceId；questionInsights 必须使用给定 questionId。
9. findings 至少包含：整体数据范围、四个平台各一条画像、跨平台差异或信源重叠；sourceStrategy 应给出四平台差异化动作；roadmap 应形成分阶段执行路径。
10. 每项策略要说明“数据依据 → 对目标行业的适用边界 → 执行动作”，不要只复述企业知识库。
11. 只输出一个 JSON 对象，不要 Markdown、代码围栏或解释。

JSON 必须包含：executiveSummary、findings、questionInsights、sourceStrategy、knowledgeAndSiteGaps、roadmap、recommendations、limitations、methodology、model。
findings、questionInsights、sourceStrategy、knowledgeAndSiteGaps、roadmap、recommendations、limitations 必须全部是 JSON 数组，即使只有一项也要使用 []；不得把 sourceStrategy 或 roadmap 输出为以平台名、阶段名为键的对象。
数组项格式：
- findings/sourceStrategy/roadmap: {id,title,statement 或 rationale,evidenceIds[]}
- questionInsights: {id,questionId,title,insight,evidenceIds[]}
- knowledgeAndSiteGaps: {id,questionId,title,statement,severity,evidenceIds[]}
- recommendations: {id,category,priority,title,rationale,expectedOutcome,evidenceIds[]}
- limitations: 字符串数组
methodology 和 model 必须是 JSON 对象。`;

export class DiagnosticAnalysisError extends Error {
  constructor(message, code = "DIAGNOSTIC_ANALYSIS_ERROR", details = {}, status = 422) {
    super(message);
    this.name = "DiagnosticAnalysisError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value, max = 4_000) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u0000/g, "").trim().slice(0, max);
}

function safeUrl(value) {
  const candidate = stringValue(value, 2_000);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function compactObject(value, depth = 0) {
  if (depth > 3) return undefined;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => compactObject(item, depth + 1)).filter((item) => item !== undefined);
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key, item]) => [stringValue(key, 120), compactObject(item, depth + 1)]).filter(([, item]) => item !== undefined));
  }
  if (["string", "number", "boolean"].includes(typeof value) || value === null) return typeof value === "string" ? stringValue(value, 5_000) : value;
  return undefined;
}

function reportSectionTextKey(field) {
  if (field === "questionInsights") return "insight";
  if (field === "recommendations" || field === "sourceStrategy" || field === "roadmap") return "rationale";
  return "statement";
}

function coerceReportArray(value, field, context, max = 100) {
  if (Array.isArray(value)) return value.slice(0, max);
  if (value === null || value === undefined || value === "") return [];
  context.coercedFields.push(field);
  const textKey = reportSectionTextKey(field);
  const parentEvidenceIds = isObject(value) ? uniqueStrings(value.evidenceIds || value.evidenceRefs || value.citations, 100, 180) : [];
  const makeItem = (item, title = "") => {
    if (isObject(item)) {
      return {
        ...(title && !item.title ? { title } : {}),
        ...item,
        ...(!item.evidenceIds && parentEvidenceIds.length ? { evidenceIds: parentEvidenceIds } : {})
      };
    }
    const text = stringValue(item, 8_000);
    return text ? { ...(title ? { title } : {}), [textKey]: text, ...(parentEvidenceIds.length ? { evidenceIds: parentEvidenceIds } : {}) } : null;
  };
  if (!isObject(value)) return [makeItem(value)].filter(Boolean).slice(0, max);

  const arrayKeys = [field, "items", "list", "strategies", "steps", "phases", "gaps", "actions"];
  for (const key of arrayKeys) {
    if (Array.isArray(value[key])) return value[key].map((item) => makeItem(item)).filter(Boolean).slice(0, max);
  }
  const directFields = ["title", "statement", "finding", "insight", "summary", "rationale", "strategy", "description", "action", "gap", "reason"];
  if (directFields.some((key) => value[key] !== undefined)) return [makeItem(value)].filter(Boolean).slice(0, max);

  const output = [];
  for (const [key, item] of Object.entries(value)) {
    if (["evidenceIds", "evidenceRefs", "citations"].includes(key)) continue;
    if (Array.isArray(item)) {
      for (const child of item) {
        const normalized = makeItem(child, key);
        if (normalized) output.push(normalized);
      }
    } else {
      const normalized = makeItem(item, key);
      if (normalized) output.push(normalized);
    }
    if (output.length >= max) break;
  }
  return output.slice(0, max);
}

function coerceLimitations(value, context) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  context.coercedFields.push("limitations");
  if (!isObject(value)) return [stringValue(value, 2_000)].filter(Boolean);
  return Object.entries(value).flatMap(([key, item]) => {
    if (Array.isArray(item)) return item.map((entry) => stringValue(entry?.description || entry, 2_000)).filter(Boolean);
    return [stringValue(item?.description || item || key, 2_000)].filter(Boolean);
  }).slice(0, 100);
}

function evidenceRows(catalog) {
  if (catalog instanceof Map) return [...catalog.values()];
  if (Array.isArray(catalog)) return catalog;
  if (isObject(catalog) && Array.isArray(catalog.items)) return catalog.items;
  if (isObject(catalog)) return Object.values(catalog);
  return [];
}

function catalogMap(catalog) {
  const result = new Map();
  for (const item of evidenceRows(catalog)) {
    const id = stringValue(item?.id || item?.evidenceId, 180);
    if (!id) continue;
    result.set(id, {
      ...item,
      id,
      verificationStatus: stringValue(item?.verificationStatus || item?.status || "supplied", 40).toLowerCase()
    });
  }
  return result;
}

function unsupportedClaims(value, path = "$") {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...unsupportedClaims(item, `${path}[${index}]`)));
    return found;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (UNSUPPORTED_KEYS.test(key) && item !== null && item !== undefined && item !== "" && item !== "not_available") {
        found.push({ code: "unsupported_metric_field", label: `不受支持的指标字段 ${key}`, path: `${path}.${key}` });
      }
      if (key !== "evidenceIds") found.push(...unsupportedClaims(item, `${path}.${key}`));
    }
    return found;
  }
  if (typeof value !== "string") return found;
  for (const rule of UNSUPPORTED_CLAIMS) if (rule.pattern.test(value)) found.push({ code: rule.code, label: rule.label, path });
  return found;
}

function uniqueStrings(values, maxItems = 100, maxLength = 180) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => stringValue(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function normalizedNumericValue(value) {
  const candidate = String(value || "").replace(/,/g, "").trim();
  if (!candidate) return "";
  const number = Number(candidate);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(8)));
}

function allNumericValues(value) {
  const values = new Set();
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const normalized = normalizedNumericValue(match[0]);
    if (normalized) values.add(normalized);
  }
  return values;
}

function metricNumericValues(value) {
  const values = new Set();
  const text = stringValue(value, 20_000);
  const pattern = /(\d[\d,]*(?:\.\d+)?)\s*(%|％|字符|条|个|次|位|问|字|页|年|家|项|分|倍)/gu;
  for (const match of text.matchAll(pattern)) {
    const normalized = normalizedNumericValue(match[1]);
    if (!normalized) continue;
    const number = Number(normalized);
    const unit = match[2];
    // Small whole numbers are often plan enumeration (for example “3 个阶段”),
    // not a measured research fact. Percentages and decimals are always checked.
    if (unit !== "%" && unit !== "％" && Number.isInteger(number) && number >= 0 && number <= 4) continue;
    values.add(normalized);
  }
  return values;
}

function unsupportedMetricNumbers(text, evidenceIds, available) {
  const claimed = metricNumericValues(text);
  if (!claimed.size) return [];
  const supported = new Set();
  const rows = evidenceIds?.length ? evidenceIds.map((id) => available.get(id)).filter(Boolean) : [...available.values()];
  for (const row of rows) {
    for (const number of allNumericValues({
      title: row.title,
      excerpt: row.excerpt,
      claim: row.claim,
      provenance: row.provenance,
      payload: row.payload
    })) supported.add(number);
  }
  return [...claimed].filter((number) => !supported.has(number));
}

function normalizeEvidenceRefs(item, available, context) {
  const requested = uniqueStrings(item?.evidenceIds || item?.evidenceRefs || item?.citations, 100, 180);
  const valid = [];
  const rejected = [];
  for (const id of requested) {
    const evidence = available.get(id);
    if (!evidence || !USABLE_EVIDENCE_STATUSES.has(evidence.verificationStatus)) rejected.push(id);
    else valid.push(id);
  }
  if (rejected.length) context.invalidEvidenceRefs.push({ section: context.section, itemId: stringValue(item?.id, 180), evidenceIds: rejected });
  return valid;
}

function itemId(item, prefix, index) {
  return stringValue(item?.id, 180) || `${prefix}-${index + 1}`;
}

function itemTitle(item, fallback, max = 300) {
  return stringValue(item?.title || item?.name || item?.label, max) || fallback;
}

function itemText(item, fields, max = 8_000) {
  for (const field of fields) {
    const result = stringValue(item?.[field], max);
    if (result) return result;
  }
  return "";
}

function addEvidenceGap(context, section, item, index, reason) {
  const unsafeTitle = itemTitle(item, "模型结论", 160);
  const title = unsupportedClaims(unsafeTitle).length ? "模型结论缺少可核验证据" : `证据不足：${unsafeTitle}`;
  context.evidenceGaps.push({
    id: `AUTO-GAP-${section.toUpperCase()}-${index + 1}`,
    title,
    statement: reason,
    sourceSection: section,
    evidenceIds: []
  });
}

function normalizeGroundedSection(rawItems, section, available, context, textFields) {
  context.section = section;
  const prefix = section.replace(/([A-Z])/g, "-$1").toUpperCase();
  const output = [];
  rawItems.forEach((rawItem, index) => {
    const item = isObject(rawItem) ? rawItem : { statement: rawItem };
    const text = itemText(item, textFields);
    if (!text) {
      addEvidenceGap(context, section, item, index, "模型输出缺少可核验的结论文本，未纳入正式报告。");
      return;
    }
    const rejected = unsupportedClaims(item, `$.${section}[${index}]`);
    if (rejected.length) {
      context.rejectedClaims.push(...rejected.map((claim) => ({ ...claim, section, itemId: itemId(item, prefix, index) })));
      return;
    }
    const evidenceIds = normalizeEvidenceRefs(item, available, context);
    if (!evidenceIds.length) {
      addEvidenceGap(context, section, item, index, "该判断没有引用本次诊断运行中已持久化且可用的证据，未纳入正式结论。");
      return;
    }
    const unsupportedNumbers = section === "findings" ? unsupportedMetricNumbers(text, evidenceIds, available) : [];
    if (unsupportedNumbers.length) {
      context.rejectedClaims.push({
        code: "unverified_numeric_claim",
        label: `结论包含引用证据未支持的数值：${unsupportedNumbers.join("、")}`,
        path: `$.${section}[${index}]`,
        section,
        itemId: itemId(item, prefix, index),
        values: unsupportedNumbers
      });
      addEvidenceGap(context, section, item, index, "该判断包含引用证据未支持的统计数值，未纳入正式结论。");
      return;
    }
    output.push({
      id: itemId(item, prefix, index),
      title: itemTitle(item, text.slice(0, 80)),
      statement: text,
      evidenceIds
    });
  });
  return output;
}

function sanitizeExecutiveSummary(value, context, available) {
  const source = stringValue(value, 20_000);
  if (!source) return "本报告基于已持久化的历史研究证据与企业知识证据形成，结论范围以证据目录和限制说明为准。";
  const sentences = source.split(/(?<=[。！？.!?])\s*/u).filter(Boolean);
  const accepted = [];
  sentences.forEach((sentence, index) => {
    const rejected = unsupportedClaims(sentence, `$.executiveSummary[${index}]`);
    const unsupportedNumbers = unsupportedMetricNumbers(sentence, [], available);
    if (unsupportedNumbers.length) rejected.push({
      code: "unverified_numeric_claim",
      label: `摘要包含证据目录未支持的数值：${unsupportedNumbers.join("、")}`,
      path: `$.executiveSummary[${index}]`,
      values: unsupportedNumbers
    });
    if (rejected.length) context.rejectedClaims.push(...rejected.map((claim) => ({ ...claim, section: "executiveSummary" })));
    else accepted.push(sentence);
  });
  return stringValue(accepted.join(" "), 20_000) || "本报告仅保留了能够由本次运行证据支持的分析；证据不足的判断已移入知识与站点缺口。";
}

function normalizeQuestionInsights(rawItems, available, questionIds, context) {
  context.section = "questionInsights";
  const output = [];
  rawItems.forEach((rawItem, index) => {
    const item = isObject(rawItem) ? rawItem : { insight: rawItem };
    const questionId = stringValue(item.questionId, 180);
    if (!questionId || (questionIds.size && !questionIds.has(questionId))) {
      addEvidenceGap(context, "questionInsights", item, index, "该问题洞察没有绑定本次冻结问题集中的 questionId，未纳入正式结论。");
      return;
    }
    const insight = itemText(item, ["insight", "statement", "summary", "rationale", "content"]);
    const rejected = unsupportedClaims(item, `$.questionInsights[${index}]`);
    if (rejected.length) {
      context.rejectedClaims.push(...rejected.map((claim) => ({ ...claim, section: "questionInsights", itemId: itemId(item, "QUESTION-INSIGHT", index) })));
      return;
    }
    const evidenceIds = normalizeEvidenceRefs(item, available, context);
    if (!insight || !evidenceIds.length) {
      addEvidenceGap(context, "questionInsights", item, index, "该问题洞察缺少可核验文本或没有引用本次运行的可用证据，未纳入正式结论。");
      return;
    }
    output.push({
      id: itemId(item, "QUESTION-INSIGHT", index),
      questionId,
      title: itemTitle(item, `问题 ${questionId} 的证据洞察`),
      insight,
      evidenceIds
    });
  });
  return output;
}

function normalizeGaps(rawItems, available, questionIds, context) {
  context.section = "knowledgeAndSiteGaps";
  const output = [];
  rawItems.forEach((rawItem, index) => {
    const item = isObject(rawItem) ? rawItem : { statement: rawItem };
    const statement = itemText(item, ["statement", "gap", "rationale", "description", "insight", "content"]);
    if (!statement) return;
    const rejected = unsupportedClaims(item, `$.knowledgeAndSiteGaps[${index}]`);
    if (rejected.length) {
      context.rejectedClaims.push(...rejected.map((claim) => ({ ...claim, section: "knowledgeAndSiteGaps", itemId: itemId(item, "GAP", index) })));
      return;
    }
    const questionId = stringValue(item.questionId, 180);
    const evidenceIds = normalizeEvidenceRefs(item, available, context);
    output.push({
      id: itemId(item, "GAP", index),
      title: itemTitle(item, "知识或官网证据缺口"),
      statement,
      questionId: questionId && (!questionIds.size || questionIds.has(questionId)) ? questionId : "",
      sourceSection: stringValue(item.sourceSection, 80),
      severity: PRIORITIES.has(stringValue(item.severity || item.priority, 20).toLowerCase()) ? stringValue(item.severity || item.priority, 20).toLowerCase() : "medium",
      evidenceIds
    });
  });
  return output;
}

function normalizeRecommendations(rawItems, available, context) {
  context.section = "recommendations";
  const output = [];
  rawItems.forEach((rawItem, index) => {
    const item = isObject(rawItem) ? rawItem : { rationale: rawItem };
    const rationale = itemText(item, ["rationale", "statement", "reason", "description", "content"]);
    const rejected = unsupportedClaims(item, `$.recommendations[${index}]`);
    if (rejected.length) {
      context.rejectedClaims.push(...rejected.map((claim) => ({ ...claim, section: "recommendations", itemId: itemId(item, "RECOMMENDATION", index) })));
      return;
    }
    const evidenceIds = normalizeEvidenceRefs(item, available, context);
    if (!rationale || !evidenceIds.length) {
      addEvidenceGap(context, "recommendations", item, index, "该建议没有说明证据依据或没有引用本次运行的可用证据，未作为正式建议。");
      return;
    }
    const category = stringValue(item.category, 40).toLowerCase();
    const priority = stringValue(item.priority, 20).toLowerCase();
    output.push({
      id: itemId(item, "RECOMMENDATION", index),
      category: RECOMMENDATION_CATEGORIES.has(category) ? category : "content_plan",
      priority: PRIORITIES.has(priority) ? priority : "medium",
      title: itemTitle(item, "GEO 优化建议"),
      rationale,
      expectedOutcome: stringValue(item.expectedOutcome || item.outcome, 5_000),
      evidenceIds
    });
  });
  return output;
}

function normalizeMethodology(value) {
  const input = isObject(value) ? value : {};
  return {
    framework: "evidence-grounded-geo-diagnostic-v1",
    evidenceRule: "先持久化、后分析；正式结论只能引用本次运行中 supplied 或 verified 的证据。",
    researchScope: "研究证据用于历史方法、问题类型和信源策略，不代替实时平台观测。",
    enterpriseScope: "企业证据来自已审核并完成索引的知识库内容。",
    approach: stringValue(input.approach || input.description || input.notes, 4_000)
  };
}

function normalizeModel(value) {
  const input = isObject(value) ? value : {};
  return {
    providerId: stringValue(input.providerId || input.provider, 180),
    name: stringValue(input.name || input.model, 180),
    runId: stringValue(input.runId || input.generationRunId, 180),
    generatedAt: stringValue(input.generatedAt, 80)
  };
}

export function validateDiagnosticReport(raw, evidenceCatalog, options = {}) {
  if (!isObject(raw)) {
    throw new DiagnosticAnalysisError("The diagnostic model must return one JSON object.", "DIAGNOSTIC_REPORT_CONTRACT_INVALID", { field: "$" });
  }
  const available = catalogMap(evidenceCatalog);
  const questions = Array.isArray(options.questions) ? options.questions : [];
  const questionIds = new Set(questions.map((question) => stringValue(question?.id, 180)).filter(Boolean));
  const context = { section: "", invalidEvidenceRefs: [], rejectedClaims: [], evidenceGaps: [], coercedFields: [] };
  const normalized = Object.fromEntries(REPORT_ARRAY_FIELDS.map((field) => [
    field,
    coerceReportArray(raw[field], field, context, field === "questionInsights" ? 500 : 100)
  ]));
  const normalizedLimitations = coerceLimitations(raw.limitations, context);

  const report = {
    executiveSummary: sanitizeExecutiveSummary(raw.executiveSummary, context, available),
    findings: normalizeGroundedSection(normalized.findings, "findings", available, context, ["statement", "finding", "insight", "summary", "rationale", "content"]),
    questionInsights: normalizeQuestionInsights(normalized.questionInsights, available, questionIds, context),
    sourceStrategy: normalizeGroundedSection(normalized.sourceStrategy, "sourceStrategy", available, context, ["rationale", "statement", "strategy", "insight", "description", "content"]),
    knowledgeAndSiteGaps: normalizeGaps(normalized.knowledgeAndSiteGaps, available, questionIds, context),
    roadmap: normalizeGroundedSection(normalized.roadmap, "roadmap", available, context, ["rationale", "statement", "action", "description", "insight", "content"]),
    recommendations: normalizeRecommendations(normalized.recommendations, available, context),
    limitations: uniqueStrings(normalizedLimitations, 100, 2_000),
    methodology: normalizeMethodology(raw.methodology),
    model: normalizeModel(raw.model)
  };

  report.knowledgeAndSiteGaps.push(...context.evidenceGaps);
  if (context.rejectedClaims.length) report.limitations.push("模型输出中存在超出本次证据范围的实时指标或平台结论，相关内容已从正式报告中移除。 ");
  if (context.invalidEvidenceRefs.length) report.limitations.push("模型引用了本次运行目录外或不可用的证据编号；相关编号已移除，无剩余有效证据的结论已转为证据缺口。 ");
  if (context.coercedFields.length) report.limitations.push(`模型返回的 ${[...new Set(context.coercedFields)].join("、")} 不是标准数组结构，系统已在保留证据校验的前提下完成结构归一化。`);
  report.limitations.push("未提供经时间戳核验的实时 AI 平台采样时，本报告不评估当前排名、推荐率、实时引用位置、情感或模型版本差异。");
  report.limitations = uniqueStrings(report.limitations, 100, 2_000);
  report.validation = {
    usableEvidenceCount: [...available.values()].filter((item) => USABLE_EVIDENCE_STATUSES.has(item.verificationStatus)).length,
    rejectedClaims: context.rejectedClaims,
    invalidEvidenceRefs: context.invalidEvidenceRefs,
    evidenceGaps: context.evidenceGaps.map((item) => item.id),
    coercedFields: [...new Set(context.coercedFields)]
  };
  return report;
}

function normalizeQuestion(question, index) {
  if (typeof question === "string") return { id: `Q-${index + 1}`, text: stringValue(question, 1_000) };
  return {
    ...compactObject(question),
    id: stringValue(question?.id, 180) || `Q-${index + 1}`,
    text: stringValue(question?.text || question?.question || question?.title, 1_000)
  };
}

function citationItems(result) {
  if (Array.isArray(result)) return result;
  if (!isObject(result)) return [];
  for (const key of ["items", "results", "citations", "evidence", "records"]) if (Array.isArray(result[key])) return result[key];
  if (Array.isArray(result.aggregations?.citationSamples)) return result.aggregations.citationSamples;
  return [];
}

function citationAnalysisItems(result, request) {
  if (!isObject(result)) return citationItems(result);
  const sample = isObject(result.sample) ? result.sample : {};
  const aggregations = isObject(result.aggregations) ? result.aggregations : {};
  const matches = Array.isArray(result.matchedQuestions) ? result.matchedQuestions : [];
  if (!matches.length) return [];
  const topPlatforms = (aggregations.platforms || []).slice(0, 8).map((item) => `${item.platformName || item.platformCode} ${Number(item.citationObservationCount || 0)} 条`).join("；");
  const topSourceTypes = (aggregations.sourceTypes || []).slice(0, 8).map((item) => `${item.sourceTypeLabel || item.sourceType} ${Number(item.citationObservationCount || 0)} 条`).join("；");
  const topDomains = (aggregations.domains || []).slice(0, 8).map((item) => `${item.sourceName || item.domain} ${Number(item.citationObservationCount || 0)} 条`).join("；");
  const summary = {
    id: result.evidenceId,
    title: `Citation Lab 问题匹配与信源聚合：${request.question?.text || request.query}`,
    sourceUrl: result.source?.sourceUrl || result.source?.sourceDataUrl,
    sourceName: "GEO Citation Lab",
    domain: "github.com",
    platformCode: "citation-lab",
    snippet: [
      `匹配 ${Number(sample.matchedQuestionCount || matches.length)} 个规范问题，纳入 ${Number(sample.citationObservationCount || 0)} 条按 preferred exact record 口径去重的历史引用观察。`,
      `匹配问题：${matches.slice(0, 8).map((item) => `${item.prompt}（匹配分 ${item.score}）`).join("；")}`,
      topPlatforms ? `平台分布：${topPlatforms}` : "",
      topSourceTypes ? `信源类型：${topSourceTypes}` : "",
      topDomains ? `高频域名：${topDomains}` : ""
    ].filter(Boolean).join("\n"),
    verificationStatus: "verified",
    analysisSummary: compactObject({ sample, matchedQuestions: matches, platforms: aggregations.platforms, sourceTypes: aggregations.sourceTypes, domains: aggregations.domains, pages: aggregations.pages })
  };
  return [summary, ...(aggregations.citationSamples || [])];
}

function citationAdapter(store) {
  if (typeof store?.analyzeQuestion === "function") {
    return {
      name: "analyzeQuestion",
      invoke: (request) => {
        const result = store.analyzeQuestion(request.query, {
          matchLimit: request.matchLimit || 8,
          citationLimit: request.limit || 5,
          minimumScore: request.minimumScore,
          platformLimit: 20,
          sourceTypeLimit: 30,
          domainLimit: 50,
          pageLimit: 30
        });
        return { ...result, results: citationAnalysisItems(result, request) };
      }
    };
  }
  for (const name of ["search", "query", "retrieve", "searchCitations"]) {
    if (typeof store?.[name] === "function") return { name, invoke: (request) => store[name](request) };
  }
  throw new DiagnosticAnalysisError(
    "Citation research store is not configured with search(), query(), retrieve() or searchCitations().",
    "DIAGNOSTIC_CITATION_STORE_NOT_CONFIGURED",
    {},
    500
  );
}

function normalizedCoverageText(value) {
  return stringValue(value, 500).normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "");
}

function benchmarkIndustryCoverage(benchmark, industry) {
  const requestedIndustry = stringValue(industry, 300);
  const normalizedIndustry = normalizedCoverageText(requestedIndustry);
  const available = Array.isArray(benchmark?.coverage?.availableIndustryCohorts) ? benchmark.coverage.availableIndustryCohorts : [];
  const matched = normalizedIndustry ? available.filter((item) => {
    const label = normalizedCoverageText(item.label);
    return label && (normalizedIndustry.includes(label) || label.includes(normalizedIndustry));
  }) : [];
  return {
    requestedIndustry,
    // The current fact pack computes a global platform baseline. Matching
    // labels are disclosed, but are not promoted to an industry cohort until
    // the same deterministic metrics have been recomputed for that subset.
    industryCohortAvailable: false,
    industryCohortApplied: false,
    matchingIndustryLabelsAvailable: matched.length > 0,
    matchedIndustryCohorts: matched,
    availableIndustryCohorts: available,
    scopeLabel: "global_historical_baseline_only"
  };
}

function benchmarkEvidenceRecords(benchmark, coverage) {
  if (!isObject(benchmark) || !Array.isArray(benchmark.platforms)) return [];
  const sourceUrl = safeUrl(benchmark.source?.sourceUrl || benchmark.source?.sourceDataUrl);
  const commonProvenance = {
    datasetVersion: stringValue(benchmark.source?.datasetVersion, 80),
    sourceCommit: stringValue(benchmark.source?.sourceCommit, 120),
    factPackVersion: stringValue(benchmark.factPackVersion, 120),
    observationFilter: stringValue(benchmark.statisticalScope?.primaryObservationFilter, 300),
    platformGrouping: stringValue(benchmark.statisticalScope?.platformGrouping, 300),
    collectionMethod: "citation_lab_deterministic_sql_fact_pack"
  };
  const records = [{
    factKey: "dataset",
    evidenceType: "research",
    sourceKind: "citation_platform_fact_pack_scope",
    sourceId: stringValue(benchmark.evidenceId, 180),
    title: "Citation Lab 四大平台全库研究范围",
    sourceUrl,
    claim: `Citation Lab ${benchmark.source?.datasetVersion || ""} 包含 ${Number(benchmark.dataset?.citationObservations || 0)} 条原始历史引用观察；豆包、DeepSeek、千问、元宝四个平台家族合计 ${Number(benchmark.dataset?.targetPlatformCitationObservationCount || 0)} 条。`,
    excerpt: `数据版本 ${benchmark.source?.datasetVersion || "—"}；原始引用观察 ${Number(benchmark.dataset?.citationObservations || 0)}；preferred 精确记录 ${Number(benchmark.dataset?.preferredCitationObservations || 0)}；规范问题 ${Number(benchmark.dataset?.questions || 0)}；平台/终端 ${Number(benchmark.dataset?.platforms || 0)}；四目标平台家族原始观察 ${Number(benchmark.dataset?.targetPlatformCitationObservationCount || 0)}。统计对象是固定历史引用记录，不是客户实时表现。`,
    verificationStatus: "verified",
    provenance: { ...commonProvenance, factKey: "dataset" },
    payload: { dataset: benchmark.dataset, statisticalScope: benchmark.statisticalScope }
  }];
  for (const platform of benchmark.platforms) {
    const categories = (platform.sourceCategories || []).slice(0, 6).map((item) => `${item.label} ${item.sharePct}%`).join("；");
    const types = (platform.sourceTypes || []).slice(0, 8).map((item) => `${item.label} ${item.sharePct}%`).join("；");
    const formats = (platform.contentFormats || []).slice(0, 6).map((item) => `${item.label} ${item.sharePct}%`).join("；");
    const domains = (platform.topDomains || []).slice(0, 10).map((item) => `${item.domain} ${item.citationObservationCount} 条`).join("；");
    records.push({
      factKey: `platform:${platform.key}`,
      evidenceType: "research",
      sourceKind: "citation_platform_family_profile",
      sourceId: `${benchmark.evidenceId}:${platform.key}`,
      title: `${platform.label}历史引用偏好事实包`,
      sourceUrl,
      claim: `${platform.label}平台家族在固定数据集中有 ${platform.citationObservationCount} 条原始引用观察、${platform.domainCount} 个域名，历史样本平均引用位置 ${platform.averageQuotePosition}，平均摘要长度 ${platform.averageSnippetLength} 字符。`,
      excerpt: [
        `原始引用观察 ${platform.citationObservationCount}；preferred 精确记录 ${platform.preferredCitationObservationCount}；问题 ${platform.questionCount}；每问均引 ${platform.citationsPerQuestion}；域名 ${platform.domainCount}；独有域名 ${platform.exclusiveDomainCount}（${platform.exclusiveDomainSharePct}%）。`,
        `历史样本平均引用位置 ${platform.averageQuotePosition}（有效位置分母 ${platform.positionedCitationCount}）；平均摘要长度 ${platform.averageSnippetLength} 字符；长摘要占 ${platform.longSnippetSharePct}%。`,
        `${platform.releaseYear} 年页面占 ${platform.releaseYearPublishedSharePct}%；页面日期未知占 ${platform.missingPublishedDateSharePct}%。页面日期不是 AI 回答采集时间。`,
        categories ? `一级信源分类：${categories}` : "",
        types ? `信源类型：${types}` : "",
        formats ? `内容格式：${formats}` : "",
        domains ? `高频域名：${domains}` : ""
      ].filter(Boolean).join("\n"),
      verificationStatus: "verified",
      provenance: { ...commonProvenance, factKey: `platform:${platform.key}`, platformFamily: platform.family, platformCodes: platform.platformCodes },
      payload: compactObject(platform)
    });
  }
  records.push({
    factKey: "domain-overlap",
    evidenceType: "research",
    sourceKind: "citation_platform_domain_overlap",
    sourceId: `${benchmark.evidenceId}:domain-overlap`,
    title: "四平台信源域名重叠事实",
    sourceUrl,
    claim: "四个平台家族的域名交集由 Citation Lab 原始引用记录确定性计算。",
    excerpt: (benchmark.domainOverlap || []).map((item) => `${item.platformA} ↔ ${item.platformB}：共享 ${item.sharedDomainCount} 个域名，Jaccard ${item.jaccardPct}%`).join("；"),
    verificationStatus: "verified",
    provenance: { ...commonProvenance, factKey: "domain-overlap" },
    payload: { domainOverlap: benchmark.domainOverlap }
  });
  for (const segment of benchmark.questionSegments || []) {
    records.push({
      factKey: `segment:${segment.key}`,
      evidenceType: "research",
      sourceKind: "citation_question_segment_profile",
      sourceId: `${benchmark.evidenceId}:segment:${segment.key}`,
      title: `${segment.label}问题 × 平台历史引用效率`,
      sourceUrl,
      claim: `${segment.label}问题按透明规则形成 ${segment.questionCount} 个规范问题样本，并计算四平台历史引用观察。`,
      excerpt: `定义：${segment.definition}。样本问题 ${segment.questionCount} 个。${(segment.platforms || []).map((item) => `${item.platform}：${item.citationObservationCount} 条，${item.citationsPerQuestion} 条/问`).join("；")}`,
      verificationStatus: "verified",
      provenance: { ...commonProvenance, factKey: `segment:${segment.key}`, segmentDefinition: segment.definition },
      payload: compactObject(segment)
    });
  }
  records.push({
    factKey: "industry-coverage",
    evidenceType: "research",
    sourceKind: "citation_industry_coverage",
    sourceId: `${benchmark.evidenceId}:industry-coverage:${normalizedCoverageText(coverage?.requestedIndustry || "none").slice(0, 40) || "none"}`,
    title: "目标行业在 Citation Lab 中的覆盖边界",
    sourceUrl,
    claim: coverage?.industryCohortApplied
      ? `本报告已对“${coverage.requestedIndustry}”应用独立行业 cohort。`
      : coverage?.matchingIndustryLabelsAvailable
        ? `Citation Lab 存在与“${coverage.requestedIndustry}”近似的行业标签，但本报告未对该子集独立计算事实包，不能声称目标行业实证偏好。`
        : `Citation Lab 没有与“${coverage?.requestedIndustry || "未填写行业"}”直接对应的行业标签，本报告只能把四平台全局历史基线作为策略参考。`,
    excerpt: `目标行业：${coverage?.requestedIndustry || "未填写"}；独立行业 cohort：${coverage?.industryCohortApplied ? "已应用" : "未应用"}；近似行业标签：${(coverage?.matchedIndustryCohorts || []).map((item) => `${item.label}（${item.questionCount} 题）`).join("、") || "无"}；数据集已标注行业：${(coverage?.availableIndustryCohorts || []).map((item) => `${item.label}（${item.questionCount} 题）`).join("、") || "无"}。`,
    verificationStatus: "verified",
    provenance: { ...commonProvenance, factKey: "industry-coverage" },
    payload: compactObject(coverage)
  });
  return records;
}

function benchmarkPromptPack(benchmark, coverage, evidenceIds = {}) {
  if (!benchmark) return null;
  return {
    factPackVersion: benchmark.factPackVersion,
    scopeEvidenceId: evidenceIds.dataset || "",
    dataset: benchmark.dataset,
    platforms: (benchmark.platforms || []).map((platform) => ({
      evidenceId: evidenceIds[`platform:${platform.key}`] || "",
      key: platform.key,
      label: platform.label,
      citationObservationCount: platform.citationObservationCount,
      preferredCitationObservationCount: platform.preferredCitationObservationCount,
      questionCount: platform.questionCount,
      citationsPerQuestion: platform.citationsPerQuestion,
      domainCount: platform.domainCount,
      exclusiveDomainCount: platform.exclusiveDomainCount,
      exclusiveDomainSharePct: platform.exclusiveDomainSharePct,
      averageQuotePosition: platform.averageQuotePosition,
      positionedCitationCount: platform.positionedCitationCount,
      averageSnippetLength: platform.averageSnippetLength,
      longSnippetSharePct: platform.longSnippetSharePct,
      releaseYear: platform.releaseYear,
      releaseYearPublishedSharePct: platform.releaseYearPublishedSharePct,
      missingPublishedDateSharePct: platform.missingPublishedDateSharePct,
      sourceCategories: (platform.sourceCategories || []).slice(0, 8),
      sourceTypes: (platform.sourceTypes || []).slice(0, 10),
      contentFormats: (platform.contentFormats || []).slice(0, 8),
      publicationYears: (platform.publicationYears || []).slice(0, 8),
      topDomains: (platform.topDomains || []).slice(0, 12)
    })),
    domainOverlapEvidenceId: evidenceIds["domain-overlap"] || "",
    domainOverlap: benchmark.domainOverlap,
    questionSegments: (benchmark.questionSegments || []).map((segment) => ({ ...segment, evidenceId: evidenceIds[`segment:${segment.key}`] || "" })),
    industryCoverageEvidenceId: evidenceIds["industry-coverage"] || "",
    industryCoverage: coverage,
    statisticalScope: benchmark.statisticalScope,
    limitations: benchmark.limitations
  };
}

function citationRecord(record, question, index) {
  const item = isObject(record) ? record : { snippet: record };
  const sourceUrl = safeUrl(item.url || item.sourceUrl || item.quoteUrl || item.canonicalUrl);
  const sourceName = stringValue(item.domain || item.sourceName || item.siteName || item.platformCode, 300);
  const excerpt = stringValue(item.snippet || item.excerpt || item.quote || item.claim || item.content, 20_000);
  const status = stringValue(item.verificationStatus || item.status, 40).toLowerCase();
  return {
    evidenceType: "research",
    sourceKind: "citation_research_record",
    sourceId: stringValue(item.id || item.citationId || item.recordId, 500) || `${question.id}-CIT-${index + 1}`,
    title: stringValue(item.title || item.quoteTitle || item.pageTitle, 500) || sourceName || `问题 ${question.id} 的研究引用`,
    sourceUrl,
    claim: stringValue(item.claim || excerpt || item.title, 5_000),
    excerpt,
    verificationStatus: ["verified", "supplied", "rejected", "not_available"].includes(status) ? status : "supplied",
    provenance: {
      questionId: question.id,
      sourceName,
      domain: stringValue(item.domain, 300),
      platformCode: stringValue(item.platformCode, 120),
      collectionMethod: "citation_research_store"
    },
    payload: compactObject({
      questionId: question.id,
      platformCode: item.platformCode,
      domain: item.domain,
      sourceName,
      rawId: item.id || item.citationId || item.recordId,
      analysisSummary: item.analysisSummary
    })
  };
}

function actionTypeForRecommendation(category) {
  return {
    question_map: "question_library_candidate",
    source_ecosystem: "publishing_strategy",
    knowledge_gap: "knowledge_gap",
    site_cms: "cms_task",
    content_plan: "content_plan",
    publishing: "publishing_strategy"
  }[category] || "content_plan";
}

function knowledgeItems(result) {
  if (Array.isArray(result?.results) && result.results.length) return result.results;
  if (Array.isArray(result?.evidence)) return result.evidence;
  return [];
}

function knowledgeRecord(record, retrieval, question, index) {
  const item = isObject(record) ? record : { quote: record };
  const approved = item.approved === true || ["approved", "verified"].includes(stringValue(item.status, 40).toLowerCase());
  const excerpt = stringValue(item.quote || item.content || item.excerpt || item.claim, 20_000);
  return {
    evidenceType: "enterprise",
    sourceKind: "enterprise_knowledge_chunk",
    sourceId: stringValue(item.chunkId || item.id || item.documentId, 500) || `${question.id}-KB-${index + 1}`,
    title: stringValue(item.title || item.claim, 500) || `问题 ${question.id} 的企业知识证据`,
    sourceUrl: safeUrl(item.sourceUrl || item.url),
    claim: stringValue(item.claim || item.title || excerpt, 5_000),
    excerpt,
    verificationStatus: approved ? "verified" : "supplied",
    provenance: {
      questionId: question.id,
      knowledgeRetrievalRunId: stringValue(retrieval?.runId, 180),
      libraryId: stringValue(item.libraryId, 180),
      libraryName: stringValue(item.libraryName || item.source, 300),
      documentId: stringValue(item.documentId, 180),
      versionId: stringValue(item.versionId, 180),
      chunkId: stringValue(item.chunkId || item.id, 180),
      locator: stringValue(item.locator, 500),
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
      collectionMethod: "knowledge_rag_retrieval"
    },
    payload: compactObject({
      questionId: question.id,
      libraryId: item.libraryId,
      libraryName: item.libraryName || item.source,
      documentId: item.documentId,
      versionId: item.versionId,
      chunkId: item.chunkId || item.id,
      locator: item.locator,
      score: item.score
    })
  };
}

function evidenceCatalogItem(stored, input, question) {
  return {
    id: stringValue(stored?.id || stored?.evidenceId, 180),
    evidenceType: stringValue(stored?.evidenceType || input.evidenceType, 40),
    sourceKind: stringValue(stored?.sourceKind || input.sourceKind, 200),
    title: stringValue(stored?.title || input.title, 500),
    sourceUrl: safeUrl(stored?.sourceUrl || input.sourceUrl),
    claim: stringValue(stored?.claim || input.claim, 5_000),
    excerpt: stringValue(stored?.excerpt || input.excerpt, 2_000),
    verificationStatus: stringValue(stored?.verificationStatus || input.verificationStatus || "supplied", 40).toLowerCase(),
    questionId: question.id,
    provenance: compactObject(stored?.provenance || input.provenance),
    payload: compactObject(stored?.payload || input.payload)
  };
}

function buildPrompt({ project, questions, evidenceCatalog, retrievalGaps, researchFactPack = null, researchCoverage = null, researchOnly = false }) {
  const grouped = new Map();
  for (const item of evidenceCatalog) {
    const key = stringValue(item.questionId, 180) || "PROJECT";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  const selectedEvidence = [];
  const groups = [...grouped.values()];
  let level = 0;
  let estimatedCharacters = 0;
  while (selectedEvidence.length < 100 && estimatedCharacters < 60_000 && groups.some((items) => level < items.length)) {
    for (const items of groups) {
      const item = items[level];
      if (!item) continue;
      const compact = {
        evidenceId: item.id,
        questionId: item.questionId,
        evidenceType: item.evidenceType,
        sourceKind: item.sourceKind,
        title: stringValue(item.title, 300),
        sourceUrl: item.sourceUrl,
        excerpt: stringValue(item.excerpt, 800),
        verificationStatus: item.verificationStatus
      };
      const size = JSON.stringify(compact).length;
      if (selectedEvidence.length && estimatedCharacters + size > 60_000) continue;
      selectedEvidence.push(compact);
      estimatedCharacters += size;
      if (selectedEvidence.length >= 100) break;
    }
    level += 1;
  }
  const payload = {
    reportBrief: {
      objective: "使用 Citation Lab 全库确定性统计与大模型分析，为目标行业形成四平台引用偏好、内容信源策略和分阶段行动报告。",
      requiredScopeOrder: ["global_historical_baseline", "industry_cohort_if_available", "intent_cohort", "direct_question_matches", "enterprise_evidence"],
      requiredPlatformFamilies: researchFactPack ? ["豆包", "DeepSeek", "千问", "元宝"] : [],
      requiredNarrative: "先陈述可核验数据事实，再说明对目标行业的适用边界，最后给出执行建议。不得把全局样本写成目标行业直接样本。"
    },
    project: {
      id: project.id,
      name: project.name,
      diagnosticType: project.diagnosticType,
      industry: project.industry,
      targetBrand: researchOnly ? "" : project.targetBrand,
      websiteUrl: researchOnly ? "" : project.websiteUrl,
      objective: project.objective,
      scope: researchOnly ? { analysisMode: "citation_lab_research" } : project.scope
    },
    frozenQuestions: researchOnly ? [] : questions.map((question) => ({ id: question.id, text: question.text, intent: question.intent || "", category: question.category || "" })),
    researchCoverage,
    researchFactPack,
    evidenceCatalog: selectedEvidence,
    evidenceSelection: {
      persistedEvidenceCount: evidenceCatalog.length,
      promptEvidenceCount: selectedEvidence.length,
      selectionRule: "按客户问题轮询选择，单条摘录最多 800 字，总上下文约 60000 字；模型只能引用本目录中显示的 evidenceId。"
    },
    retrievalGaps
  };
  return `请基于以下本次运行快照生成企业 GEO 诊断报告。每条正式结论必须使用 evidenceCatalog 中的 evidenceId。\n\n${JSON.stringify(payload, null, 2)}\n\n输出严格符合系统消息约定的单个 JSON 对象。`;
}

function reportSections(report, benchmark = null, coverage = null) {
  const deterministic = benchmark ? [
    {
      key: "researchScope",
      kind: "scope",
      title: "数据范围与覆盖说明",
      content: {
        数据版本: benchmark.source?.datasetVersion || "—",
        原始引用观察: benchmark.dataset?.citationObservations || 0,
        preferred精确记录: benchmark.dataset?.preferredCitationObservations || 0,
        规范问题: benchmark.dataset?.questions || 0,
        平台与终端: benchmark.dataset?.platforms || 0,
        四平台家族原始观察: benchmark.dataset?.targetPlatformCitationObservationCount || 0,
        目标行业: coverage?.requestedIndustry || "未填写",
        行业样本覆盖: coverage?.industryCohortApplied ? "已应用独立行业 cohort" : coverage?.matchingIndustryLabelsAvailable ? "存在近似行业标签但未独立聚合；以下平台画像仍是全局历史基线" : "无直接行业标签；以下平台画像是全局历史基线",
        统计口径: benchmark.statisticalScope?.primaryObservationFilter || "—"
      }
    },
    {
      key: "platformOverview",
      kind: "table",
      title: "四大 AI 平台历史引用画像",
      content: (benchmark.platforms || []).map((platform) => ({
        平台: platform.label,
        原始引用观察: platform.citationObservationCount,
        preferred精确记录: platform.preferredCitationObservationCount,
        每问均引: platform.citationsPerQuestion,
        信源域名: platform.domainCount,
        历史样本平均引用位置: platform.averageQuotePosition,
        平均摘要长度_字符: platform.averageSnippetLength,
        [`${platform.releaseYear}年页面占比`]: `${platform.releaseYearPublishedSharePct}%`,
        页面日期未知占比: `${platform.missingPublishedDateSharePct}%`
      }))
    },
    {
      key: "platformProfiles",
      kind: "platformProfiles",
      title: "平台信源、格式与高频域名",
      content: (benchmark.platforms || []).map((platform) => ({
        平台: platform.label,
        一级信源分类: (platform.sourceCategories || []).slice(0, 6).map((item) => `${item.label} ${item.sharePct}%`),
        信源类型: (platform.sourceTypes || []).slice(0, 8).map((item) => `${item.label} ${item.sharePct}%`),
        内容格式: (platform.contentFormats || []).slice(0, 6).map((item) => `${item.label} ${item.sharePct}%`),
        高频域名: (platform.topDomains || []).slice(0, 12).map((item) => `${item.domain} · ${item.citationObservationCount} 条${item.exclusiveToPlatformFamily ? " · 仅该平台家族出现" : ""}`),
        独有域名: `${platform.exclusiveDomainCount} 个（${platform.exclusiveDomainSharePct}%）`
      }))
    },
    {
      key: "domainOverlap",
      kind: "matrix",
      title: "平台间信源域名重叠",
      content: (benchmark.domainOverlap || []).map((item) => ({ 平台组合: `${item.platformA} ↔ ${item.platformB}`, 共享域名: item.sharedDomainCount, Jaccard: `${item.jaccardPct}%` }))
    },
    {
      key: "questionSegments",
      kind: "matrix",
      title: "问题类型 × 平台历史引用效率",
      content: (benchmark.questionSegments || []).map((segment) => ({
        问题类型: segment.label,
        规则: segment.definition,
        样本问题数: segment.questionCount,
        ...Object.fromEntries((segment.platforms || []).map((item) => [item.platform, `${item.citationsPerQuestion} 条/问`]))
      }))
    }
  ] : [];
  return [
    ...deterministic,
    { key: "findings", kind: "analysis", title: "关键发现与平台解读", content: report.findings },
    { key: "questionInsights", kind: "analysis", title: "客户问题洞察", content: report.questionInsights },
    { key: "sourceStrategy", kind: "strategy", title: "四平台信源与内容策略", content: report.sourceStrategy },
    { key: "knowledgeAndSiteGaps", kind: "gaps", title: "知识、官网与证据缺口", content: report.knowledgeAndSiteGaps },
    { key: "roadmap", kind: "roadmap", title: "分阶段执行路线图", content: report.roadmap },
    { key: "recommendations", kind: "actions", title: "即刻行动清单", content: report.recommendations }
  ];
}

function requireMethod(target, method, owner) {
  if (typeof target?.[method] !== "function") {
    throw new DiagnosticAnalysisError(`${owner}.${method}() is required.`, "DIAGNOSTIC_ANALYSIS_DEPENDENCY_MISSING", { owner, method }, 500);
  }
}

export class DiagnosticAnalysisEngine {
  constructor(options = {}) {
    this.diagnosticStore = options.diagnosticStore;
    this.citationResearchStore = options.citationResearchStore;
    this.knowledgeStore = options.knowledgeStore;
    this.aiGenerationService = options.aiGenerationService;
    this.citationTopK = Math.max(1, Math.min(20, Number(options.citationTopK) || 5));
    this.citationMatchLimit = Math.max(1, Math.min(20, Number(options.citationMatchLimit) || 8));
    this.citationMinimumScore = Math.max(0, Math.min(1, Number(options.citationMinimumScore ?? 0.12)));
    this.knowledgeTopK = Math.max(1, Math.min(20, Number(options.knowledgeTopK) || 5));
    requireMethod(this.diagnosticStore, "project", "diagnosticStore");
    requireMethod(this.diagnosticStore, "latestFrozenQuestionSet", "diagnosticStore");
    requireMethod(this.diagnosticStore, "createRun", "diagnosticStore");
    requireMethod(this.diagnosticStore, "startRun", "diagnosticStore");
    requireMethod(this.diagnosticStore, "addEvidence", "diagnosticStore");
    requireMethod(this.diagnosticStore, "completeRun", "diagnosticStore");
    citationAdapter(this.citationResearchStore);
    requireMethod(this.knowledgeStore, "retrieve", "knowledgeStore");
    requireMethod(this.aiGenerationService, "generate", "aiGenerationService");
  }

  async addEvidence(workspaceId, runId, input, question, actor, request) {
    const stored = await this.diagnosticStore.addEvidence({ workspaceId, runId, ...input, actor, request });
    const catalogItem = evidenceCatalogItem(stored, input, question);
    if (!catalogItem.id) throw new DiagnosticAnalysisError("Persisted evidence did not return an id.", "DIAGNOSTIC_EVIDENCE_ID_MISSING", { questionId: question.id }, 500);
    return catalogItem;
  }

  async execute(options = {}) {
    const workspaceId = stringValue(options.workspaceId, 180);
    const projectId = stringValue(options.projectId, 180);
    if (!workspaceId || !projectId) throw new DiagnosticAnalysisError("workspaceId and projectId are required.", "DIAGNOSTIC_ANALYSIS_INPUT_INVALID", { workspaceId, projectId });
    const researchOnly = options.researchOnly === true;

    const actor = options.actor || null;
    const request = options.request || null;
    let analysisRun = null;
    let completed = false;
    try {
      const project = await this.diagnosticStore.project(workspaceId, projectId);
      const requestedQuestionSetId = stringValue(options.questionSetId, 180);
      const questionSet = requestedQuestionSetId
        ? await this.diagnosticStore.questionSet(workspaceId, requestedQuestionSetId)
        : await this.diagnosticStore.latestFrozenQuestionSet(workspaceId, projectId);
      if (questionSet.projectId !== projectId || questionSet.status !== "frozen") {
        throw new DiagnosticAnalysisError("The diagnostic analysis requires the project's frozen question set.", "DIAGNOSTIC_QUESTION_SET_INVALID", { projectId, questionSetId: questionSet.id });
      }
      const questions = questionSet.questions.map(normalizeQuestion).filter((question) => question.text);
      if (!questions.length) throw new DiagnosticAnalysisError("The frozen question set is empty.", "DIAGNOSTIC_QUESTION_SET_EMPTY", { questionSetId: questionSet.id });

      if (options.runId) {
        requireMethod(this.diagnosticStore, "run", "diagnosticStore");
        analysisRun = await this.diagnosticStore.run(workspaceId, stringValue(options.runId, 180));
        if (analysisRun.projectId !== projectId || analysisRun.questionSetId !== questionSet.id) {
          throw new DiagnosticAnalysisError("The supplied run does not belong to this project and frozen question set.", "DIAGNOSTIC_RUN_SCOPE_INVALID", { runId: analysisRun.id });
        }
      } else {
        analysisRun = await this.diagnosticStore.createRun({
          workspaceId,
          projectId,
          questionSetId: questionSet.id,
          researchPackageId: options.researchPackageId || project.researchPackageId || null,
          evidenceScope: { ...compactObject(options.evidenceScope || {}), research: true, enterprise: !researchOnly, live: false },
          input: { operation: "evidence_grounded_diagnostic_analysis", analysisMode: researchOnly ? "citation_lab_research" : "combined_evidence", ...compactObject(options.input || {}) },
          actor,
          request
        });
      }
      if (analysisRun.status === "queued") analysisRun = await this.diagnosticStore.startRun({ workspaceId, runId: analysisRun.id, actor, request });
      if (analysisRun.status !== "running") throw new DiagnosticAnalysisError("The diagnostic run must be queued or running.", "DIAGNOSTIC_RUN_STATE_INVALID", { runId: analysisRun.id, status: analysisRun.status });

      const citation = citationAdapter(this.citationResearchStore);
      const catalog = [];
      const retrievalGaps = [];
      const directMatchGaps = [];
      const matchedResearchQuestionIds = new Set();
      const knowledgeRetrievalRunIds = new Set();
      let citationObservationCountAcrossAnalyses = 0;
      let enterpriseKnowledgeEvidenceCount = 0;
      let researchBenchmark = null;
      let researchCoverage = null;
      let researchFactPack = null;
      const benchmarkEvidenceIds = {};
      const benchmarkTypes = new Set(["industry_strategy", "source_ecosystem", "comprehensive"]);
      if (benchmarkTypes.has(project.diagnosticType) && typeof this.citationResearchStore?.platformPreferenceBenchmark === "function") {
        researchBenchmark = await this.citationResearchStore.platformPreferenceBenchmark({
          platformFamilies: Array.isArray(options.platformFamilies) ? options.platformFamilies : undefined
        });
        researchCoverage = benchmarkIndustryCoverage(researchBenchmark, project.industry);
        const benchmarkQuestion = { id: "RESEARCH-FACT-PACK" };
        for (const record of benchmarkEvidenceRecords(researchBenchmark, researchCoverage)) {
          const persisted = await this.addEvidence(workspaceId, analysisRun.id, record, benchmarkQuestion, actor, request);
          catalog.push(persisted);
          benchmarkEvidenceIds[record.factKey] = persisted.id;
        }
        researchFactPack = benchmarkPromptPack(researchBenchmark, researchCoverage, benchmarkEvidenceIds);
      }
      for (const question of questions) {
        if (researchOnly) continue;
        const citationResult = await citation.invoke({
          workspaceId,
          query: question.text,
          question,
          project,
          limit: Math.max(1, Math.min(20, Number(options.citationTopK) || this.citationTopK)),
          matchLimit: Math.max(1, Math.min(20, Number(options.citationMatchLimit) || this.citationMatchLimit)),
          minimumScore: Number.isFinite(Number(options.citationMinimumScore)) ? Number(options.citationMinimumScore) : this.citationMinimumScore
        });
        for (const match of citationResult?.matchedQuestions || []) if (match?.questionId) matchedResearchQuestionIds.add(String(match.questionId));
        citationObservationCountAcrossAnalyses += Number(citationResult?.sample?.citationObservationCount || 0);
        const citations = citationItems(citationResult).slice(0, Math.max(1, Math.min(20, Number(options.citationTopK) || this.citationTopK)));
        if (!citations.length && researchBenchmark) {
          directMatchGaps.push({ questionId: question.id, message: "该客户问题没有达到阈值的直接研究问题匹配；报告仍可使用全局四平台基线和透明定义的问题类型样本。" });
        } else if (!citations.length) {
          const gap = await this.addEvidence(workspaceId, analysisRun.id, {
            evidenceType: "research",
            sourceKind: "citation_research_gap",
            sourceId: question.id,
            title: `问题 ${question.id} 未检索到研究引用`,
            claim: "",
            excerpt: "研究引用库未返回与该问题匹配的记录。",
            verificationStatus: "not_available",
            provenance: { questionId: question.id, adapter: citation.name },
            payload: { questionId: question.id }
          }, question, actor, request);
          catalog.push(gap);
          retrievalGaps.push({ questionId: question.id, scope: "research", message: "未检索到研究引用。", evidenceId: gap.id });
        } else {
          for (let index = 0; index < citations.length; index += 1) {
            catalog.push(await this.addEvidence(workspaceId, analysisRun.id, citationRecord(citations[index], question, index), question, actor, request));
          }
        }

        if (!researchOnly) {
        const knowledge = await this.knowledgeStore.retrieve({
          workspaceId,
          query: question.text,
          businessLineId: options.businessLineId || project.businessLineId || "",
          libraryIds: Array.isArray(options.libraryIds) ? options.libraryIds : [],
          topK: Math.max(1, Math.min(20, Number(options.knowledgeTopK) || this.knowledgeTopK)),
          minScore: Number.isFinite(Number(options.minKnowledgeScore)) ? Number(options.minKnowledgeScore) : 0.08,
          providerId: stringValue(options.embeddingProviderId || options.knowledgeProviderId, 180),
          includeInternal: Boolean(options.includeInternalKnowledge),
          actor
        });
        if (knowledge?.runId) knowledgeRetrievalRunIds.add(String(knowledge.runId));
        const knowledgeResults = knowledgeItems(knowledge).slice(0, Math.max(1, Math.min(20, Number(options.knowledgeTopK) || this.knowledgeTopK)));
        if (!knowledgeResults.length || knowledge?.knowledgeGap) {
          const gap = await this.addEvidence(workspaceId, analysisRun.id, {
            evidenceType: "enterprise",
            sourceKind: "enterprise_knowledge_gap",
            sourceId: question.id,
            title: `问题 ${question.id} 存在企业知识缺口`,
            claim: "",
            excerpt: stringValue(knowledge?.message, 2_000) || "已审核企业知识库未返回足以回答该问题的内容。",
            verificationStatus: "not_available",
            provenance: { questionId: question.id, knowledgeRetrievalRunId: stringValue(knowledge?.runId, 180) },
            payload: { questionId: question.id, knowledgeGap: true }
          }, question, actor, request);
          catalog.push(gap);
          retrievalGaps.push({ questionId: question.id, scope: "enterprise", message: "已审核企业知识不足以回答该问题。", evidenceId: gap.id });
        }
        for (let index = 0; index < knowledgeResults.length; index += 1) {
          catalog.push(await this.addEvidence(workspaceId, analysisRun.id, knowledgeRecord(knowledgeResults[index], knowledge, question, index), question, actor, request));
          enterpriseKnowledgeEvidenceCount += 1;
        }
        }
      }

      const enterpriseSnapshot = compactObject(options.enterpriseSnapshot || null);
      if (!researchOnly && isObject(enterpriseSnapshot) && Object.keys(enterpriseSnapshot).length) {
        const snapshotQuestion = { id: "PROJECT-SNAPSHOT" };
        catalog.push(await this.addEvidence(workspaceId, analysisRun.id, {
          evidenceType: "enterprise",
          sourceKind: "enterprise_operations_snapshot",
          sourceId: project.id,
          title: "企业官网与运营数据库快照",
          claim: "本次诊断创建时从客户私有化系统读取的官网、知识、内容与发布运营快照。",
          excerpt: stringValue(JSON.stringify(enterpriseSnapshot), 20_000),
          verificationStatus: "verified",
          observedAt: stringValue(enterpriseSnapshot.capturedAt, 80) || new Date().toISOString(),
          provenance: { projectId: project.id, capturedAt: enterpriseSnapshot.capturedAt || "", collectionMethod: "customer_private_database_snapshot" },
          payload: enterpriseSnapshot
        }, snapshotQuestion, actor, request));
      }

      const prompt = buildPrompt({ project, questions, evidenceCatalog: catalog, retrievalGaps, researchFactPack, researchCoverage: { ...researchCoverage, directMatchGaps }, researchOnly });
      const generationInput = {
        providerId: stringValue(options.providerId, 180),
        model: stringValue(options.model, 180),
        workspaceId,
        projectId,
        runId: analysisRun.id
      };
      const generated = await this.aiGenerationService.generate(
        "diagnostic_analysis",
        generationInput,
        prompt,
        (raw) => validateDiagnosticReport(raw, catalog, { questions }),
        {
          systemPrompt: DIAGNOSTIC_SYSTEM_PROMPT,
          temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.2,
          maxTokens: Math.max(2_000, Math.min(32_000, Number(options.maxTokens) || 18_000)),
          inputSummary: { projectId, runId: analysisRun.id, questionCount: questions.length, evidenceCount: catalog.length, researchFactPackVersion: researchBenchmark?.factPackVersion || "", targetPlatformObservationCount: Number(researchBenchmark?.dataset?.targetPlatformCitationObservationCount || 0) },
          outputSummary: (result) => ({
            findingCount: result.findings.length,
            recommendationCount: result.recommendations.length,
            gapCount: result.knowledgeAndSiteGaps.length,
            rejectedClaimCount: result.validation.rejectedClaims.length
          })
        }
      );
      const generatedReport = isObject(generated?.report) ? generated.report : generated;
      const priorValidation = isObject(generatedReport?.validation) ? generatedReport.validation : {};
      const report = validateDiagnosticReport(generatedReport, catalog, { questions });
      report.validation.rejectedClaims = [
        ...(Array.isArray(priorValidation.rejectedClaims) ? priorValidation.rejectedClaims : []),
        ...report.validation.rejectedClaims
      ];
      report.validation.invalidEvidenceRefs = [
        ...(Array.isArray(priorValidation.invalidEvidenceRefs) ? priorValidation.invalidEvidenceRefs : []),
        ...report.validation.invalidEvidenceRefs
      ];
      report.validation.evidenceGaps = uniqueStrings([
        ...(Array.isArray(priorValidation.evidenceGaps) ? priorValidation.evidenceGaps : []),
        ...report.validation.evidenceGaps
      ], 500, 180);
      for (const gap of retrievalGaps) {
        const key = `RETRIEVAL-GAP-${gap.scope.toUpperCase()}-${gap.questionId}`;
        if (!report.knowledgeAndSiteGaps.some((item) => item.id === key)) {
          report.knowledgeAndSiteGaps.push({
            id: key,
            title: gap.scope === "enterprise" ? "企业知识证据缺口" : "研究引用证据缺口",
            statement: gap.message,
            questionId: gap.questionId,
            severity: "medium",
            evidenceIds: []
          });
        }
      }
      if (researchBenchmark && directMatchGaps.length) {
        report.limitations.push(`${directMatchGaps.length} 个客户问题没有达到直接研究问题匹配阈值；这些问题的策略只使用全局四平台历史基线、透明定义的问题类型样本和企业证据，不声称存在目标行业直接样本。`);
      }
      if (researchBenchmark && researchCoverage && !researchCoverage.industryCohortApplied) {
        report.limitations.push(researchCoverage.matchingIndustryLabelsAvailable
          ? `Citation Lab 存在与“${researchCoverage.requestedIndustry || "目标行业"}”近似的行业标签，但本报告未对该子集独立计算事实包；平台画像仍是全局历史引用基线。`
          : `Citation Lab 当前没有与“${researchCoverage.requestedIndustry || "目标行业"}”直接对应的行业标签；平台画像是全局历史引用基线，行业动作属于有边界的策略推演。`);
      }
      report.limitations = uniqueStrings(report.limitations, 100, 2_000);
      report.model = {
        providerId: stringValue(generated?.run?.providerId || report.model.providerId || options.providerId, 180),
        name: stringValue(generated?.run?.model || report.model.name || options.model, 180),
        runId: stringValue(generated?.run?.id || report.model.runId, 180),
        generatedAt: stringValue(generated?.run?.completedAt || report.model.generatedAt, 80) || new Date().toISOString()
      };
      report.methodology = {
        ...report.methodology,
        modelAnalysis: {
          providerId: report.model.providerId,
          providerName: stringValue(generated?.run?.providerName, 180),
          model: report.model.name,
          runId: report.model.runId,
          generatedAt: report.model.generatedAt
        },
        questionCount: researchOnly ? 0 : questions.length,
        frozenQuestionCount: questions.length,
        research: {
          adapter: citation.name,
          inputQuestionCount: questions.length,
          matchedQuestionCount: matchedResearchQuestionIds.size,
          citationObservationCountAcrossQuestionAnalyses: citationObservationCountAcrossAnalyses,
          directQuestionObservationFilter: "is_preferred_exact_record = 1",
          directMatchGapCount: directMatchGaps.length,
          globalBaseline: researchBenchmark ? {
            factPackVersion: researchBenchmark.factPackVersion,
            datasetVersion: researchBenchmark.source?.datasetVersion || "",
            rawCitationObservationCount: Number(researchBenchmark.dataset?.citationObservations || 0),
            preferredCitationObservationCount: Number(researchBenchmark.dataset?.preferredCitationObservations || 0),
            targetPlatformCitationObservationCount: Number(researchBenchmark.dataset?.targetPlatformCitationObservationCount || 0),
            platformFamilies: (researchBenchmark.platforms || []).map((item) => item.label),
            primaryObservationFilter: researchBenchmark.statisticalScope?.primaryObservationFilter || "",
            industryCoverage: researchCoverage
          } : null,
          countBoundary: "全局平台事实包使用原始上游记录复现公开平台总量；逐问题匹配使用 preferred exact record。两种口径分别标注且不得混用。"
        },
        analysisMode: researchOnly ? "citation_lab_research" : "combined_evidence",
        rag: researchOnly ? {
          enabled: false,
          retrievalRunCount: 0,
          evidenceCount: 0,
          retrievalMode: "本次报告按用户要求只使用 Citation Lab 研究事实包，不读取或发送企业知识片段。"
        } : {
          enabled: true,
          retrievalRunCount: knowledgeRetrievalRunIds.size,
          evidenceCount: enterpriseKnowledgeEvidenceCount,
          retrievalMode: "企业知识库语义与关键词混合检索"
        },
        evidenceCatalogCount: catalog.length,
        diagnosticRunId: analysisRun.id
      };

      analysisRun = await this.diagnosticStore.completeRun({ workspaceId, runId: analysisRun.id, actor, request });
      completed = true;
      let persistedReport = null;
      const persistedRecommendations = [];
      const actions = [];
      if (options.persistReport) {
        requireMethod(this.diagnosticStore, "createReport", "diagnosticStore");
        const defaultReportTitle = researchBenchmark
          ? `${project.name} · 四大 AI 平台引用偏好与 GEO 策略报告`
          : `${project.name} GEO 诊断报告`;
        persistedReport = await this.diagnosticStore.createReport({
          workspaceId,
          runId: analysisRun.id,
          title: stringValue(options.reportTitle, 500) || defaultReportTitle,
          reportType: project.diagnosticType,
          executiveSummary: report.executiveSummary,
          sections: reportSections(report, researchBenchmark, researchCoverage),
          methodology: report.methodology,
          limitations: report.limitations,
          status: options.reportStatus === "final" ? "final" : "draft",
          actor,
          request
        });
        if (report.recommendations.length) requireMethod(this.diagnosticStore, "createRecommendation", "diagnosticStore");
        for (const recommendation of report.recommendations) {
          const persistedRecommendation = await this.diagnosticStore.createRecommendation({
            workspaceId,
            reportId: persistedReport.id,
            category: recommendation.category,
            priority: recommendation.priority,
            title: recommendation.title,
            rationale: recommendation.rationale,
            expectedOutcome: recommendation.expectedOutcome,
            evidenceRefs: recommendation.evidenceIds,
            payload: { analysisRecommendationId: recommendation.id },
            actor,
            request
          });
          persistedRecommendations.push(persistedRecommendation);
          if (typeof this.diagnosticStore.createAction === "function") {
            actions.push(await this.diagnosticStore.createAction({
              workspaceId,
              projectId: project.id,
              recommendationId: persistedRecommendation.id,
              actionType: actionTypeForRecommendation(recommendation.category),
              payload: {
                analysisRecommendationId: recommendation.id,
                title: recommendation.title,
                rationale: recommendation.rationale,
                expectedOutcome: recommendation.expectedOutcome,
                checklist: [recommendation.title],
                checks: [recommendation.title, recommendation.rationale].filter(Boolean),
                websiteUrl: project.websiteUrl || ""
              },
              actor,
              request
            }));
          }
        }
      }

      return {
        project,
        questionSet,
        run: analysisRun,
        evidenceCatalog: catalog,
        report,
        reportPayload: report,
        persistedReport,
        persistedRecommendations,
        recommendations: persistedRecommendations,
        actions,
        modelRun: generated?.run || null
      };
    } catch (error) {
      if (analysisRun?.id && !completed && typeof this.diagnosticStore?.failRun === "function") {
        try {
          await this.diagnosticStore.failRun({
            workspaceId,
            runId: analysisRun.id,
            errorCode: stringValue(error?.code, 200) || "DIAGNOSTIC_ANALYSIS_FAILED",
            errorMessage: stringValue(error?.message, 2_000) || "Diagnostic analysis failed.",
            actor,
            request
          });
        } catch {
          // Preserve the original analysis failure.
        }
      }
      if (error instanceof DiagnosticAnalysisError) throw error;
      throw new DiagnosticAnalysisError(
        stringValue(error?.message, 2_000) || "Diagnostic analysis failed.",
        stringValue(error?.code, 200) || "DIAGNOSTIC_ANALYSIS_FAILED",
        {},
        Number(error?.status) || 500
      );
    }
  }

  async analyze(options = {}) {
    return this.execute(options);
  }

  async run(options = {}) {
    return this.execute(options);
  }
}
