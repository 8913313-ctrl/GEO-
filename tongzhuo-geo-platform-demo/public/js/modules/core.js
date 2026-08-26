"use strict";

const STORAGE_KEY = "tongzhuo-geo-platform-demo-v11";
const LEGACY_STORAGE_KEYS = ["tongzhuo-geo-platform-demo-v10", "tongzhuo-geo-platform-demo-v9", "tongzhuo-geo-platform-demo-v8", "tongzhuo-geo-platform-demo-v7", "tongzhuo-geo-platform-demo-v6"];
const LOCAL_PUBLISHER_DOWNLOAD_URL = "https://tongzhuo.ink/downloads/%E6%A1%90%E7%81%BC%E5%8F%91%E5%B8%83%E5%8A%A9%E6%89%8B%20Setup%201.0.3.exe";

function publisherDownloadHref() {
  const meta = document.querySelector('meta[name="publisher-download-url"]');
  const value = String(meta?.content || "").trim();
  const url = value && !value.includes("__TZ_PUBLISHER_DOWNLOAD_URL__") ? value : LOCAL_PUBLISHER_DOWNLOAD_URL;
  return typeof escapeHtml === "function" ? escapeHtml(url) : url;
}

const ICONS = {
  home: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z"/>',
  file: '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4M9 11h6M9 15h6"/>',
  send: '<path d="m21 3-7.7 18-3.7-7.1L3 10.7 21 3Z"/><path d="m9.6 13.9 4.7-4.7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22z"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>',
  play: '<path d="m9 6 9 6-9 6V6Z"/>',
  "credit-card": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  sparkle: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6L19 13Z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  edit: '<path d="m14 4 6 6L8 22H2v-6L14 4Z"/><path d="m12 6 6 6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.3.9-1.3 1.9M12 17h.01"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.7-2L20 8M4 16l2.2 2a7 7 0 0 0 11.7-2"/>',
  upload: '<path d="M12 16V3M7 8l5-5 5 5"/><path d="M4 15v6h16v-6"/>',
  paperclip: '<path d="m20.5 11.5-8.9 8.9a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.4-8.4"/>',
  quote: '<path d="M4 17h5l2-5V7H4v5h3M14 17h5l2-5V7h-7v5h3"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  folder: '<path d="M3 5h7l2 2h9v13H3z"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5a5 5 0 0 0 8 0M9 9h.01M15 9h.01"/>',
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.3a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 2-1.6L22 7H6"/>',
  message: '<path d="M21 13a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  log: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  inbox: '<path d="M22 12h-5l-2 3h-6l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};

const PAGE_META = {
  dashboard: { title: "总览", description: "今天需要处理的事项和系统运行状态" },
  planning: { title: "问题研究", description: "从客户问题与搜索需求中发现值得生产的内容机会" },
  content: { title: "内容生产", description: "生成、编辑、审核并冻结可发布文章版本" },
  publish: { title: "发布任务", description: "管理文章排期、发布批次、平台执行状态和失败处理" },
  assets: { title: "内容资产", description: "查看已发布内容、公开地址、平台结果和长期引用健康" },
  monitoring: { title: "抓取 / SEO 诊断", description: "查看官网访问、抓取、Schema、Meta 与页面链接运行情况" },
  "effect-search": { title: "实时搜索", description: "提交实时检测并查看多平台 AI 回答与可追溯证据。" },
  "effect-diagnostic": { title: "品牌诊断", description: "按冻结问题集批量检测品牌在 AI 平台中的表现，并生成真实诊断报告。" },
  "effect-monitor": { title: "品牌监测", description: "按监测计划持续采样，并基于真实 live evidence 查看品牌趋势。" },
  site: { title: "官网运营", description: "管理官网公开内容、页面结构、信源与正式发布" },
  knowledge: { title: "企业知识", description: "维护全系统唯一可信的企业事实来源" },
  assistant: { title: "发布助手", description: "查看本地设备、账号组与平台登录状态" },
  settings: { title: "系统设置", description: "管理模型、权限、日志与私有化部署配置" }
};

const DIMENSIONS = [
  { id: "all", label: "全部结果" },
  { id: "semantic", label: "语义拓展" },
  { id: "scenario", label: "场景覆盖" },
  { id: "commercial", label: "商业意图" },
  { id: "ranking", label: "推荐榜单" },
  { id: "review", label: "产品评测" },
  { id: "brand", label: "品牌关联" },
  { id: "question", label: "问答长尾" },
  { id: "technical", label: "技术方案" }
];

const QUESTION_VARIANT_LIMIT = 5;
const QUESTION_FALLBACK_ANGLES = ["客户类型与使用场景", "实施条件与准备清单", "团队分工与协作方式", "证据来源与核验方法", "成本投入与交付边界", "内容结构与表达方式", "过程风险与常见误区", "长期运营与复盘机制", "官网信源与内容资产", "业务结果与衡量指标", "采购决策与比较维度", "落地步骤与验收标准"];
const QUESTION_SCORE_WEIGHTS = Object.freeze({ askability: 0.20, businessRelevance: 0.20, specificity: 0.15, commercialValue: 0.15, evidenceReadiness: 0.15, contentGap: 0.10, nonRepeat: 0.05 });
const LEGACY_QUESTION_SCORE_FALLBACK = Object.freeze({ askability: 82, businessRelevance: 78, specificity: 72, commercialValue: 72, evidenceReadiness: 68, contentGap: 100, nonRepeat: 88 });

function scoreTo100(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function contentGapScore(coverage) {
  if (coverage === "未覆盖") return 100;
  if (coverage === "部分覆盖") return 60;
  if (coverage === "已覆盖") return 20;
  return null;
}

function localDateInputValue(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQuestionScoreBreakdown(question = {}) {
  const quality = question.quality || {};
  const stored = question.scoreBreakdown || {};
  const duplicateRiskValue = question.duplicateRisk ?? quality.duplicateRisk;
  const duplicateRisk = scoreTo100(duplicateRiskValue);
  const nonRepeat = duplicateRisk == null ? scoreTo100(stored.nonRepeat) : 100 - duplicateRisk;
  return {
    askability: scoreTo100(question.askability ?? quality.askability ?? stored.askability),
    businessRelevance: scoreTo100(question.businessRelevance ?? quality.businessRelevance ?? stored.businessRelevance ?? question.business),
    specificity: scoreTo100(question.specificity ?? quality.specificity ?? stored.specificity),
    commercialValue: scoreTo100(question.commercialValue ?? quality.commercialValue ?? question.business_score ?? stored.commercialValue ?? question.business),
    evidenceReadiness: scoreTo100(question.evidenceReadiness ?? quality.evidenceReadiness ?? stored.evidenceReadiness),
    contentGap: scoreTo100(question.contentGap ?? stored.contentGap ?? contentGapScore(question.coverage)),
    nonRepeat
  };
}

function calculateQuestionPriorityScore(question = {}) {
  const breakdown = buildQuestionScoreBreakdown(question);
  if (Object.values(breakdown).some((value) => !Number.isFinite(value))) return null;
  const isLegacyFallback = !question.scoreSource && Object.entries(LEGACY_QUESTION_SCORE_FALLBACK).every(([key, value]) => breakdown[key] === value);
  if (isLegacyFallback) return null;
  return Math.round(Object.entries(QUESTION_SCORE_WEIGHTS).reduce((total, [key, weight]) => total + breakdown[key] * weight, 0));
}

function applyQuestionPriorityScore(question = {}) {
  const modelRecommendation = question.modelRecommendation ?? (question.scoreSource ? null : question.recommendation);
  const scoreBreakdown = buildQuestionScoreBreakdown(question);
  const priorityScore = calculateQuestionPriorityScore(question);
  return {
    ...question,
    modelRecommendation,
    scoreBreakdown: priorityScore == null ? null : scoreBreakdown,
    priorityScore,
    recommendation: priorityScore == null ? (modelRecommendation ?? null) : priorityScore,
    scoreStatus: priorityScore == null ? "pending" : "scored"
  };
}
// Historical records created before system_rules_v1 may contain only a final score
// or the old fixed fallback dimensions. Rebuild their seven visible dimensions
// from the question text and current business context instead of reusing a fake score.
const QUESTION_RULE_COMMERCIAL_BASE = Object.freeze({ semantic: 56, scenario: 68, commercial: 88, ranking: 82, review: 74, brand: 76, question: 70, technical: 80 });
const QUESTION_RULE_EVIDENCE_BASE = Object.freeze({ semantic: 68, scenario: 72, commercial: 78, ranking: 76, review: 82, brand: 80, question: 70, technical: 79 });
const QUESTION_RULE_GENERIC_SOURCE_TERMS = Object.freeze(['企业', '服务', '方案', '优化', '业务', '项目', '内容', '系统', '平台', '行业', '技术', '产品', '客户', '品牌', '公司', '团队', '市场', '实施', '运营', '管理', '专业', '相关']);
const QUESTION_RULE_GENERIC_TITLE_PATTERNS = /^(关于|浅谈|解读|解析|一文读懂|全面了解|深度剖析|揭秘|盘点|赋能)|从.+角度(应该)?如何分析|第\d+轮拓展/;

function normalizeQuestionScoreKey(value) {
  return String(value || '').toLowerCase().replace(/[\s，,。.!！?？、:：;；“”"'‘’（）()【】\[\]]+/g, '');
}

function questionScoreBigrams(value) {
  const normalized = normalizeQuestionScoreKey(value);
  if (!normalized) return new Set();
  if (normalized.length < 2) return new Set([normalized]);
  const values = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) values.add(normalized.slice(index, index + 2));
  return values;
}

function questionScoreSimilarity(left, right) {
  const leftSet = questionScoreBigrams(left);
  const rightSet = questionScoreBigrams(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach((value) => { if (rightSet.has(value)) intersection += 1; });
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function questionScoreSignals(value, pattern, maximum = 6) {
  return Math.min(maximum, new Set(String(value || '').match(pattern) || []).size);
}

function questionScoreSourceTokens(value) {
  const normalized = normalizeQuestionScoreKey(value);
  if (!normalized) return [];
  const asciiTokens = normalized.match(/[a-z0-9]{2,}/g) || [];
  let distinctive = normalized.replace(/[a-z0-9]+/g, '');
  QUESTION_RULE_GENERIC_SOURCE_TERMS.forEach((term) => { distinctive = distinctive.split(term).join(''); });
  const cjkTokens = [];
  if (distinctive.length >= 2) {
    cjkTokens.push(distinctive);
    if (distinctive.length >= 3) {
      for (let size = Math.min(6, distinctive.length); size >= 3; size -= 1) {
        for (let index = 0; index <= distinctive.length - size; index += 1) cjkTokens.push(distinctive.slice(index, index + size));
      }
    }
  }
  return [...new Set([...asciiTokens, ...cjkTokens])].filter((token) => token.length >= 2);
}

function questionScoreMentionsSource(question, sourceKeyword) {
  const questionKey = normalizeQuestionScoreKey(question);
  const sourceKey = normalizeQuestionScoreKey(sourceKeyword);
  if (!questionKey || !sourceKey) return false;
  if (questionKey.includes(sourceKey)) return true;
  return questionScoreSourceTokens(sourceKeyword).some((token) => questionKey.includes(token));
}

function questionScoreBasisLabel(question) {
  if (question?.scoreBackfilled) return '';
  if (question?.scoreSource === 'system_rules_v1') return '系统规则评分';
  if (question?.scoreSource === 'model_contract') return '模型契约评分';
  return '历史评分';
}

function questionScoreBasisSummary(question = {}) {
  const breakdown = question.scoreBreakdown || buildQuestionScoreBreakdown(question);
  const value = (key) => Number.isFinite(Number(breakdown[key])) ? Number(breakdown[key]) : '—';
  const label = questionScoreBasisLabel(question);
  return (label ? '评分依据：' + label + '；' : '') + '可问性 ' + value('askability') + '×20%、业务相关度 ' + value('businessRelevance') + '×20%、具体度 ' + value('specificity') + '×15%、商业价值 ' + value('commercialValue') + '×15%、证据准备度 ' + value('evidenceReadiness') + '×15%、内容缺口 ' + value('contentGap') + '×10%、不重复度 ' + value('nonRepeat') + '×5%。';
}

function captureLegacyQuestionScore(question = {}) {
  const snapshot = {};
  ['recommendation', 'business', 'modelRecommendation', 'askability', 'specificity', 'businessRelevance', 'evidenceReadiness', 'duplicateRisk'].forEach((key) => {
    if (question[key] !== undefined && question[key] !== null) snapshot[key] = question[key];
  });
  if (question.quality && typeof question.quality === 'object') snapshot.quality = { ...question.quality };
  if (question.scoreBreakdown && typeof question.scoreBreakdown === 'object') snapshot.scoreBreakdown = { ...question.scoreBreakdown };
  return Object.keys(snapshot).length ? snapshot : null;
}

function calculateHistoricalQuestionRuleScores(question, allQuestions = [], businessLine = null) {
  const text = String(question?.question || '').trim();
  if (!text) return null;
  const sourceKeyword = String(question.sourceKeyword || question.sourceSeedKeyword || '').trim();
  const normalizedLength = normalizeQuestionScoreKey(text).length;
  const questionCues = questionScoreSignals(text, /如何|怎么|哪些|什么|是否|能否|为什么|多少|多久|哪里|区别|适合|应该|还是|判断|评估|选择|标准|指标|依据/g, 4);
  const specificitySignals = questionScoreSignals(text, /企业|行业|制造|团队|负责人|采购|预算|地区|官网|系统|平台|数据|知识库|项目|服务|实施|交付|场景|目标|资料|指标|周期|条件/g, 7);
  const commercialSignals = questionScoreSignals(text, /采购|报价|费用|成本|预算|交付|验收|服务商|选择|比较|续费|合同|周期|效果/g, 6);
  const evidenceSignals = questionScoreSignals(text, /依据|资料|数据|案例|指标|标准|证据|核验|对比|条件|步骤|流程|系统|资质|来源|版本|边界/g, 7);
  const lineContext = [businessLine?.name, businessLine?.product, businessLine?.description, businessLine?.audience, businessLine?.scenario, businessLine?.serviceScope].filter(Boolean).join(' ');
  const sourceRelated = questionScoreMentionsSource(text, sourceKeyword);
  const contextSimilarity = questionScoreSimilarity(text, lineContext);
  const candidates = allQuestions.filter((candidate) => candidate && candidate !== question && candidate.businessLineId === question.businessLineId && (candidate.dimension === question.dimension || normalizeQuestionScoreKey(candidate.question) === normalizeQuestionScoreKey(text))).map((candidate) => candidate.question).filter(Boolean);
  const duplicateSimilarity = candidates.reduce((maximum, candidate) => Math.max(maximum, questionScoreSimilarity(text, candidate)), 0);
  const askability = Math.max(0, Math.min(100, Math.round(68 + (/[?？]$/.test(text) ? 10 : 0) + Math.min(12, questionCues * 3) + (normalizedLength >= 12 && normalizedLength <= 58 ? 8 : normalizedLength >= 8 ? 4 : 0) - (QUESTION_RULE_GENERIC_TITLE_PATTERNS.test(text) ? 20 : 0))));
  const specificity = Math.max(0, Math.min(100, Math.round(54 + (sourceRelated ? 12 : 0) + Math.min(21, specificitySignals * 3) + (normalizedLength >= 18 ? 8 : normalizedLength >= 12 ? 4 : 0))));
  const businessRelevance = Math.max(0, Math.min(100, Math.round(58 + (sourceRelated ? 20 : 0) + Math.min(12, Math.round(contextSimilarity * 30)) + (['commercial', 'ranking', 'technical'].includes(question.dimension) ? 6 : 3))));
  const business = Math.max(0, Math.min(100, Math.round((QUESTION_RULE_COMMERCIAL_BASE[question.dimension] || 66) + Math.min(12, commercialSignals * 2) + Math.min(5, specificitySignals))));
  const evidenceReadiness = Math.max(0, Math.min(100, Math.round((QUESTION_RULE_EVIDENCE_BASE[question.dimension] || 70) + Math.min(14, evidenceSignals * 2) + (normalizedLength >= 16 ? 4 : 0))));
  const duplicateRisk = Math.max(0, Math.min(100, Math.round(duplicateSimilarity * 100)));
  const contentGap = question.coverage === '未覆盖' ? 100 : question.coverage === '部分覆盖' ? 60 : question.coverage === '已覆盖' ? 20 : 60;
  const scoreBreakdown = { askability, businessRelevance, specificity, commercialValue: business, evidenceReadiness, contentGap, nonRepeat: 100 - duplicateRisk };
  const priorityScore = Math.round(Object.entries(QUESTION_SCORE_WEIGHTS).reduce((total, [key, weight]) => total + scoreBreakdown[key] * weight, 0));
  return {
    business,
    quality: { askability, specificity, businessRelevance, evidenceReadiness, duplicateRisk },
    scoreBreakdown,
    priorityScore,
    recommendation: priorityScore,
    modelRecommendation: null,
    scoreSource: 'system_rules_v1',
    scoreStatus: 'scored',
    scoreBasisVersion: 'system_rules_v1',
    scoreBackfilled: true,
    scoreBackfilledAt: question.scoreBackfilledAt || question.updatedAt || Date.now()
  };
}const QUESTION_VARIANTS = {
  semantic: {
    intent: "概念认知", stage: "需求认知", recommendation: 84, business: 62, reason: "建立基础语义关系与概念边界",
    variants: [
      (seed) => seed + "与传统搜索优化有什么关系？",
      (seed) => "企业理解" + seed + "时最容易混淆哪些概念？",
      (seed) => seed + "的核心目标、对象和边界是什么？",
      (seed) => "为什么企业现在需要关注" + seed + "？",
      (seed) => "判断" + seed + "是否有效，首先要看哪些基础信号？",
      (seed) => "企业应该如何向团队解释" + seed + "的价值？",
      (seed) => seed + "和内容质量、品牌信任之间有什么联系？"
    ]
  },
  scenario: {
    intent: "场景分析", stage: "需求认知", recommendation: 88, business: 76, reason: "覆盖客户类型、决策链和真实使用场景",
    variants: [
      (seed) => "哪些企业和业务场景更适合开展" + seed + "？",
      (seed) => seed + "在制造业采购场景中如何落地？",
      (seed) => "企业在什么阶段应开始做" + seed + "？",
      (seed) => seed + "适合解决哪些客户获取问题？",
      (seed) => "不同规模企业开展" + seed + "时应如何选择切入点？",
      (seed) => seed + "在技术、采购和管理协同中分别解决什么问题？",
      (seed) => "哪些真实业务场景最能验证" + seed + "的价值？"
    ]
  },
  commercial: {
    intent: "服务采购", stage: "供应商筛选", recommendation: 93, business: 96, reason: "具有明确的服务采购与供应商判断意图",
    variants: [
      (seed) => "企业采购" + seed + "服务时应该如何评估方案？",
      (seed) => "选择" + seed + "服务商时应重点核验哪些交付能力？",
      (seed) => seed + "服务报价和交付范围应该如何比较？",
      (seed) => "企业采购" + seed + "前需要准备哪些资料？",
      (seed) => "如何判断" + seed + "服务是否值得长期投入？",
      (seed) => "企业签约" + seed + "服务时最容易忽略哪些边界？",
      (seed) => "评估" + seed + "服务商时，案例和方法论哪个更重要？"
    ]
  },
  ranking: {
    intent: "方案对比", stage: "供应商筛选", recommendation: 87, business: 91, reason: "适合形成客观、可验证的服务商选择标准",
    variants: [
      (seed) => seed + "服务团队应该重点比较哪些能力？",
      (seed) => "有哪些" + seed + "服务商选择标准值得参考？",
      (seed) => "如何制定" + seed + "服务团队的评估清单？",
      (seed) => "做" + seed + "时官网、案例和内容能力哪个更重要？",
      (seed) => "企业如何避免选错" + seed + "服务团队？",
      (seed) => "比较" + seed + "服务团队时需要核验哪些公开证据？",
      (seed) => seed + "服务商的长期运营能力应该如何判断？"
    ]
  },
  review: {
    intent: "效果评估", stage: "效果复盘", recommendation: 91, business: 86, reason: "回应效果评估与交付可信度关注",
    variants: [
      (seed) => "如何判断" + seed + "项目是否产生真实业务价值？",
      (seed) => seed + "项目应通过哪些指标评估效果？",
      (seed) => seed + "运营多久后可以复盘一次？",
      (seed) => seed + "效果不明显时应先检查哪些环节？",
      (seed) => "怎样区分" + seed + "的短期曝光与长期价值？",
      (seed) => "企业如何建立" + seed + "的持续监测机制？",
      (seed) => seed + "项目的结果应该如何向管理层汇报？"
    ]
  },
  brand: {
    intent: "品牌了解", stage: "品牌核验", recommendation: 82, business: 80, reason: "建立品牌、能力与目标客户之间的关联",
    variants: [
      (seed) => "桐灼科技如何为企业落地" + seed + "？",
      (seed) => "桐灼科技在" + seed + "项目中能提供哪些服务？",
      (seed) => "企业为什么选择桐灼科技开展" + seed + "？",
      (seed) => "桐灼科技如何用企业知识支撑" + seed + "？",
      (seed) => "制造业企业怎样验证桐灼科技的" + seed + "方案？",
      (seed) => "桐灼科技做" + seed + "时有哪些服务边界？",
      (seed) => "桐灼科技的" + seed + "能力适合哪些企业？"
    ]
  },
  question: {
    intent: "方案了解", stage: "方案评估", recommendation: 95, business: 84, reason: "典型的问答长尾与实施起点问题",
    variants: [
      (seed) => "从零开始做" + seed + "，第一步应该做什么？",
      (seed) => "企业开展" + seed + "前需要先准备什么？",
      (seed) => seed + "的常见实施流程是什么？",
      (seed) => "没有专业团队也能做" + seed + "吗？",
      (seed) => seed + "遇到问题时应该从哪里排查？",
      (seed) => "企业做" + seed + "时需要哪些岗位参与？",
      (seed) => "如何给" + seed + "制定一份可执行的起步计划？"
    ]
  },
  technical: {
    intent: "方案对比", stage: "方案评估", recommendation: 92, business: 90, reason: "具有明确的系统实施与流程设计意图",
    variants: [
      (seed) => seed + "的内容、官网和多平台发布如何形成闭环？",
      (seed) => "企业开展" + seed + "需要哪些系统和数据支持？",
      (seed) => "如何设计" + seed + "的内容生产与审核流程？",
      (seed) => seed + "如何与企业知识库和官网协同？",
      (seed) => "企业如何搭建可持续的" + seed + "运营架构？",
      (seed) => seed + "实施时哪些环节应该自动化？",
      (seed) => "如何保证" + seed + "的内容、证据和发布结果可追溯？"
    ]
  }
};

// GEO 内容不是围绕一个关键词堆砌段落，而是围绕一个可被 AI 直接回答的“问题意图单元”。
// 这些字段会随问题、选题、计划和文章快照保存，供真实模型接入时复用，也方便人工审核时解释文章为什么这样写。
const GEO_OUTPUT_CONTRACT_VERSION = "geo-evidence-article-v1";
const GEO_AGENT_PROMPT_FOUNDATION = [
  "你是企业 GEO 证据型内容编辑。目标不是堆关键词，而是让企业实体、能力、场景和边界被 AI 准确理解、引用和复述。",
  "先回答一个明确的客户问题，再按判断顺序组织正文；每个企业事实、数字、案例、资质和效果判断都必须绑定本次已审核知识证据，找不到证据就省略并记录知识缺口。",
  "输出必须包含：直接回答、适用对象与问题边界、关键判断与事实依据、实施步骤或决策清单、常见追问、来源/更新时间与信息边界。使用语义化 HTML，不输出 Markdown，不重复 H1。",
  "禁止虚构价格、排名、客户名称、案例数字、效果承诺、资质和平台结果；禁止把联网搜索、附件或图片直接当成企业事实；避免关键词堆砌、空泛开场和绝对化表述。"
].join("\n");
const GEO_INTENT_PROFILES = {
  semantic: { decisionRole: "认知者 / 研究者", answerMode: "概念解释与边界澄清", evidenceNeeds: ["定义", "适用范围", "与相近概念的区别"] },
  scenario: { decisionRole: "业务负责人 / 使用者", answerMode: "场景匹配与实施条件", evidenceNeeds: ["目标场景", "适用条件", "落地准备"] },
  commercial: { decisionRole: "采购负责人 / 决策者", answerMode: "采购判断与交付边界", evidenceNeeds: ["服务范围", "交付流程", "核验标准"] },
  ranking: { decisionRole: "方案比较者", answerMode: "可核验的比较框架", evidenceNeeds: ["比较维度", "证据来源", "选择边界"] },
  review: { decisionRole: "项目负责人 / 复盘者", answerMode: "效果评估与改进路径", evidenceNeeds: ["评估指标", "观察周期", "复盘动作"] },
  brand: { decisionRole: "品牌核验者", answerMode: "企业能力与信源核验", evidenceNeeds: ["企业主体", "能力范围", "公开证据"] },
  question: { decisionRole: "问题解决者", answerMode: "直接答案与执行步骤", evidenceNeeds: ["第一步", "实施流程", "验收标准"] },
  technical: { decisionRole: "技术 / 运营负责人", answerMode: "系统流程与协同方案", evidenceNeeds: ["系统边界", "数据流程", "审核与追溯"] }
};

function geoIntentProfile(dimension) {
  return GEO_INTENT_PROFILES[dimension] || GEO_INTENT_PROFILES.question;
}

function buildGeoQuestionIntent(question = {}) {
  const profile = geoIntentProfile(question.dimension);
  const coreQuestion = String(question.question || "").trim();
  const questionWithoutMark = coreQuestion.replace(/[？?。！!]+$/, "");
  return {
    version: "geo-question-unit-v1",
    coreQuestion,
    searchIntent: question.intent || "方案了解",
    decisionStage: question.stage || "需求认知",
    decisionRole: profile.decisionRole,
    answerMode: profile.answerMode,
    evidenceNeeds: cloneData(profile.evidenceNeeds),
    expectedAnswer: "先给出可独立引用的直接答案，再说明依据、适用条件、行动步骤和边界。",
    followUpAngles: ["适用对象与前提", "实施步骤与验收", "常见误区与边界"],
    followUpQuestions: [
      "哪些企业或业务场景适合？",
      "实施前需要准备哪些资料？",
      "如何核验结果，哪些情况不应直接下结论？"
    ],
    queryRewrites: [...new Set([
      coreQuestion,
      questionWithoutMark ? questionWithoutMark + " 怎么判断？" : "",
      questionWithoutMark ? questionWithoutMark + " 有哪些实施步骤？" : ""
    ].filter(Boolean))],
    coverage: question.coverage || "未覆盖",
    sourceKeyword: question.sourceKeyword || "",
    generatedBy: question.source || "问题词库"
  };
}

function buildGeoTopicBrief(topic = {}, sourceQuestion = null) {
  const question = sourceQuestion || topic.questionSnapshot || {};
  const intent = topic.geoIntent || question.geoIntent || buildGeoQuestionIntent({
    question: topic.coreQuestion || topic.title || question.question,
    dimension: topic.dimension || question.dimension,
    intent: topic.intent || question.intent,
    stage: topic.stage || question.stage,
    sourceKeyword: topic.keyword || question.sourceKeyword,
    source: topic.source || question.source
  });
  return {
    version: "geo-topic-brief-v1",
    coreQuestion: topic.coreQuestion || intent.coreQuestion || topic.title || "",
    title: topic.title || intent.coreQuestion || "",
    sourceKeyword: topic.keyword || intent.sourceKeyword || "",
    searchIntent: intent.searchIntent,
    decisionStage: intent.decisionStage,
    decisionRole: intent.decisionRole,
    answerMode: intent.answerMode,
    answerPromise: "回答一个明确的客户问题，并让读者知道结论适用于谁、依据是什么、下一步怎么做。",
    evidenceNeeds: cloneData(intent.evidenceNeeds || []),
    requiredSections: ["直接回答", "适用对象与问题边界", "关键判断与事实依据", "实施步骤或决策清单", "常见追问", "信息边界与更新时间"],
    faqSeeds: cloneData(intent.followUpQuestions || ["这适合哪些企业或场景？", "落地前需要准备什么？", "如何核验结果或判断是否适用？"]),
    queryRewrites: cloneData(intent.queryRewrites || [intent.coreQuestion || topic.title || ""]),
    parentQuestion: question.question || intent.coreQuestion || topic.title || "",
    followUpAngles: cloneData(intent.followUpAngles || []),
    targetContentTypes: topic.dimension === "question" ? ["问答文章", "FAQ 页"] : topic.dimension === "commercial" || topic.dimension === "ranking" ? ["采购指南", "对比文章"] : ["深度文章", "官网专题页"],
    mappedAssets: [],
    updateTriggers: ["企业知识版本更新", "服务边界或产品资料变化", "AI 采样发现未覆盖、引用错误或竞品差距"],
    exclusions: ["未经审核的价格、排名、客户名称、效果数字", "没有来源的绝对化承诺", "与核心问题无关的泛泛行业介绍"],
    sourceQuestionId: question.id || topic.questionId || null
  };
}

function evaluateGeoArticleQuality(html, topic = {}, citations = []) {
  const source = String(html || "");
  const has = (pattern) => pattern.test(source);
  const count = (pattern) => (source.match(pattern) || []).length;
  const brief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  const checks = {
    directAnswer: has(/id=["']p-intro["']/i) && has(/直接回答/),
    scope: has(/id=["']p-scope["']/i) && has(/适用对象与问题边界/),
    evidence: has(/id=["']p-knowledge["']/i) && (!citations.length || has(/data-citation-id=/i)),
    steps: has(/id=["']p-topic["']/i) && has(/<(ol|ul)\b/i),
    faq: has(/id=["']p-faq["']/i) && count(/<h3\b/gi) >= 2,
    boundary: has(/id=["']p-boundary["']/i) && has(/信息边界与更新时间|更新时间|来源/),
    semanticHeadings: count(/<h2\b/gi) >= 5 && !has(/<h1\b/i),
    questionSpecific: Boolean(String(brief.coreQuestion || topic.title || "").trim()) && (source.includes(String(brief.coreQuestion || topic.title || "").trim()) || source.includes(escapeHtml(String(brief.coreQuestion || topic.title || "").trim())))
  };
  const labels = {
    directAnswer: "开篇直接回答",
    scope: "适用对象与问题边界",
    evidence: "企业事实与引用",
    steps: "实施步骤或决策清单",
    faq: "常见追问（问答结构）",
    boundary: "来源、更新时间与边界",
    semanticHeadings: "语义化标题层级",
    questionSpecific: "围绕当前选题作答"
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => labels[key]);
  const hardMissing = ["directAnswer", "evidence", "faq", "boundary"].filter((key) => !checks[key]);
  const score = Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100);
  const status = hardMissing.length ? "block" : missing.length ? "warning" : "pass";
  return {
    version: "geo-quality-v1",
    score,
    status,
    checks,
    missing,
    nextAction: status === "pass" ? "可进入风控与人工审核" : status === "block" ? "补齐结构和证据后才能提交人工审核" : "建议补齐后再提交人工审核",
    evaluatedAt: new Date().toISOString()
  };
}

function buildGeoOutputContract(topic = {}, citations = [], agentSnapshot = null, options = {}) {
  const brief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  const requiredSections = Array.isArray(brief.requiredSections) && brief.requiredSections.length
    ? brief.requiredSections
    : ["直接回答", "适用对象与问题边界", "关键判断与事实依据", "实施步骤或决策清单", "常见追问", "信息边界与更新时间"];
  const citationIds = citations.map((citation) => citation.id).filter(Boolean);
  return {
    version: GEO_OUTPUT_CONTRACT_VERSION,
    language: "zh-CN",
    contentType: options.contentType || "深度文章",
    headline: topic.title || brief.title || "",
    coreQuestion: brief.coreQuestion,
    answerMode: brief.answerMode,
    sections: requiredSections.map((title, index) => ({
      id: ["direct-answer", "scope", "evidence", "method", "faq", "boundary"][index] || "section-" + (index + 1),
      title,
      required: true,
      citationRequired: ["关键判断与事实依据", "实施步骤或决策清单"].includes(title)
    })),
    citationIds,
    citationPolicy: "每一个企业事实或可验证判断都必须绑定到本次已审核知识引用；找不到依据时省略或标记待补证，不得自行补写。",
    machineReadable: { directAnswerFirst: true, semanticHeadings: true, faqAsQuestionAnswer: true, explicitBoundaries: true, noMarkdown: true },
    structuredDataHints: {
      articleType: "Article",
      inLanguage: "zh-CN",
      articleSection: requiredSections,
      mainEntity: { type: "Question", name: brief.coreQuestion || topic.title || "" },
      answerFormat: "直接回答 + 证据依据 + 步骤清单 + FAQ + 边界"
    },
    agent: agentSnapshot ? { id: agentSnapshot.agentId, version: agentSnapshot.version, name: agentSnapshot.nameSnapshot } : null
  };
}

function buildGeoArticlePrompt(topic = {}, citations = [], agentSnapshot = null, options = {}) {
  const brief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  const contract = options.outputContract || buildGeoOutputContract(topic, citations, agentSnapshot, options);
  const platformGuidance = Array.isArray(options.expectedPlatformGuidance) ? options.expectedPlatformGuidance : [];
  const evidence = citations.length
    ? citations.map((citation) => `${citation.marker || "K"}｜${citation.claim || "已审核事实"}｜${citation.quote || ""}`).join("\n")
    : "（本次没有可用的已审核企业事实；不得把未知内容写成事实。）";
  return [
    "你是企业 GEO 证据型内容编辑。GEO 的目标不是堆关键词或制造曝光，而是让企业实体、能力、场景和边界被生成式 AI 准确理解、引用和复述。",
    "请把文章写成可独立回答一个客户问题的证据页：开头直接回答，正文按判断顺序组织，企业事实可追溯，未知事实主动省略。",
    `【选题 Brief】核心问题：${brief.coreQuestion || topic.title || ""}；搜索意图：${brief.searchIntent}；决策阶段：${brief.decisionStage}；主要读者：${brief.decisionRole}；回答方式：${brief.answerMode}。`,
    `【企业事实】以下是本次计划冻结且已审核的事实，只能引用、改写或归纳这些内容；每条事实旁保留对应引用标记：\n${evidence}`,
    `【写作智能体】${agentSnapshot?.role || "企业内容编辑"}；语气：${agentSnapshot?.tone || "专业、清晰、克制"}；风格：${agentSnapshot?.style || "结论先行、证据优先"}。${agentSnapshot?.systemPrompt || ""}`,
    `【输出契约 ${contract.version}】使用语义化 HTML，不输出 Markdown，不重复标题，不添加 H1；后台会根据结构生成 Article / Question 结构化数据。必须依次包含：直接回答、适用对象与问题边界、关键判断与事实依据、实施步骤或决策清单、常见追问（问题 + 答案）、信息边界与更新时间。直接回答放在首段，脱离上下文也能成立；H2/H3 标题要描述真实问题，不使用“第一部分/精彩内容”等空标题。`,
    "【比较与决策】当选题属于商业意图、榜单、评测或方案对比时，必须列出可核验的比较维度、适合对象、限制条件和证据来源；资料不足时输出比较框架，不输出虚假的排名或唯一推荐。",
    "【事实与风险规则】禁止虚构价格、排名、客户名称、案例数字、效果承诺、资质和平台结果；禁止把联网搜索或附件内容当成企业事实；不确定时写明“当前资料未提供”，并给出需要补充的证据字段。避免空泛开场、关键词堆砌和绝对化表述。",
    "【可读性规则】每段只表达一个判断；优先使用短段、列表、步骤和问答；实体名称、服务范围、适用对象、限制条件和更新时间必须写清楚。",
    platformGuidance.length ? `【可选风格参考】${platformGuidance.map((item) => `${item.name}：${item.guidance}`).join("；")}。这只影响阅读节奏，不等于锁定发布平台，也不能改变事实边界。` : "",
    `【智能体补充要求】${agentSnapshot?.required || ""}\n【禁止表达】${agentSnapshot?.banned || ""}`
  ].filter(Boolean).join("\n\n");
}

const PLATFORM_META = {
  web: { name: "企业官网", short: "官", logoClass: "web" },
  wechat: { name: "微信公众号", short: "微", logoClass: "wechat" },
  zhihu: { name: "知乎", short: "知", logoClass: "zhihu" },
  toutiao: { name: "头条号", short: "头", logoClass: "toutiao" },
  blog: { name: "博客园", short: "博", logoClass: "blog" },
  csdn: { name: "CSDN", short: "C", logoClass: "csdn" },
  tiktok: { name: "TikTok", short: "TT", logoClass: "tiktok" },
  juejin: { name: "掘金", short: "掘", logoClass: "juejin" },
  pinduoduo: { name: "拼多多", short: "拼", logoClass: "pinduoduo" },
  jianshu: { name: "简书", short: "简", logoClass: "jianshu" },
  netease: { name: "网易号", short: "易", logoClass: "netease" },
  sohu: { name: "搜狐号", short: "狐", logoClass: "sohu" },
  baijia: { name: "百家号", short: "百", logoClass: "baijia" },
  bilibili: { name: "哔哩哔哩", short: "哔", logoClass: "bilibili" },
  microvideo: { name: "微视", short: "微", logoClass: "microvideo" },
  tencent_media: { name: "腾讯内容开放平台", short: "腾", logoClass: "tencent-media" },
  xiaohongshu: { name: "小红书", short: "红", logoClass: "xiaohongshu" },
  kuaishou: { name: "快手", short: "快", logoClass: "kuaishou" },
  douyin: { name: "抖音", short: "抖", logoClass: "douyin" },
  weixin_video: { name: "微信视频号", short: "视", logoClass: "weixin-video" },
  third_party_press: { name: "行业媒体分发", short: "媒", logoClass: "third-party" },
  press_release: { name: "新闻稿分发", short: "稿", logoClass: "third-party" }
};

Object.assign(PLATFORM_META, {
  wechat_mp: PLATFORM_META.wechat,
  weibo: { name: "微博", short: "微", logoClass: "weibo" },
  baijiahao: PLATFORM_META.baijia,
  cnblogs: PLATFORM_META.blog,
  xiaohongshu: { name: "小红书", short: "红", logoClass: "xiaohongshu" },
  bilibili: { name: "B站专栏", short: "哔", logoClass: "bilibili" },
  douyin: { name: "抖音图文", short: "抖", logoClass: "douyin" },
  yuque: { name: "语雀", short: "语", logoClass: "generic" },
  douban: { name: "豆瓣", short: "豆", logoClass: "generic" },
  xueqiu: { name: "雪球", short: "球", logoClass: "generic" },
  woshipm: { name: "人人都是产品经理", short: "人", logoClass: "generic" },
  dayu: { name: "大鱼号", short: "鱼", logoClass: "generic" },
  yidian: { name: "一点号", short: "一", logoClass: "generic" },
  imooc: { name: "慕课网", short: "慕", logoClass: "generic" },
  segmentfault: { name: "SegmentFault", short: "S", logoClass: "generic" },
  eastmoney: { name: "东方财富", short: "东", logoClass: "generic" }
});

// Historical publish jobs can contain platforms that are no longer offered in
// the current catalog. Keep those records readable instead of allowing one
// retired platform to crash the whole publish page.
function publishPlatformName(platformId) {
  const id = canonicalPublishPlatformId(platformId);
  return PLATFORM_META[id]?.name || PLATFORM_META[platformId]?.name || String(platformId || "未知平台");
}

const PUBLISH_PLATFORM_REGISTRY = [
  { id: "web", category: "official", role: "企业官网主信源", enabled: true, accountMode: "server", capabilities: "长文 · 结构化数据", description: "由官网服务器直接发布，作为企业长期可控的主信源", requiresManualConfirmation: false },
  { id: "wechat_mp", category: "self_media", role: "微信公众号", enabled: true, support: "ready", accountMode: "local", capabilities: "图文", description: "本地发布助手可尝试提交；出现验证或审核提示时转人工确认", requiresManualConfirmation: false },
  { id: "zhihu", category: "self_media", role: "知乎专栏", enabled: true, support: "ready", accountMode: "local", capabilities: "问答 · 图文", description: "本地发布助手可尝试提交；出现验证或审核提示时转人工确认", requiresManualConfirmation: false },
  { id: "toutiao", category: "self_media", role: "头条号", enabled: true, support: "ready", accountMode: "local", capabilities: "图文", description: "本地发布助手可尝试提交；出现验证或审核提示时转人工确认", requiresManualConfirmation: false },
  { id: "baijiahao", category: "self_media", role: "百家号", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，发布需在百家号后台人工确认", requiresManualConfirmation: true },
  { id: "xiaohongshu", category: "self_media", role: "小红书", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需在创作中心补充素材并人工确认", requiresManualConfirmation: true },
  { id: "weibo", category: "self_media", role: "微博", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，发布需人工确认安全验证", requiresManualConfirmation: true },
  { id: "juejin", category: "self_media", role: "掘金", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需在编辑器人工确认", requiresManualConfirmation: true },
  { id: "csdn", category: "self_media", role: "CSDN", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需在编辑器人工确认", requiresManualConfirmation: true },
  { id: "jianshu", category: "self_media", role: "简书", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需在编辑器人工确认", requiresManualConfirmation: true },
  { id: "douyin", category: "self_media", role: "抖音图文", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需补充素材并人工确认", requiresManualConfirmation: true },
  { id: "bilibili", category: "self_media", role: "B站专栏", enabled: true, support: "manual", accountMode: "local", capabilities: "专栏", description: "已接入本地账号和任务队列，需在创作中心人工确认", requiresManualConfirmation: true },
  { id: "yuque", category: "self_media", role: "语雀", enabled: true, support: "manual", accountMode: "local", capabilities: "知识文档", description: "已接入本地账号和任务队列，需在工作台人工确认", requiresManualConfirmation: true },
  { id: "douban", category: "self_media", role: "豆瓣", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需人工确认发表", requiresManualConfirmation: true },
  { id: "sohu", category: "self_media", role: "搜狐号", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "xueqiu", category: "self_media", role: "雪球", enabled: true, support: "manual", accountMode: "local", capabilities: "财经内容", description: "已接入本地账号和任务队列，需人工确认发表", requiresManualConfirmation: true },
  { id: "woshipm", category: "self_media", role: "人人都是产品经理", enabled: true, support: "manual", accountMode: "local", capabilities: "产品运营长文", description: "已接入本地账号和任务队列，需人工确认投稿", requiresManualConfirmation: true },
  { id: "dayu", category: "self_media", role: "大鱼号", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "yidian", category: "self_media", role: "一点号", enabled: true, support: "manual", accountMode: "local", capabilities: "图文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "imooc", category: "self_media", role: "慕课网", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "segmentfault", category: "self_media", role: "SegmentFault", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "cnblogs", category: "self_media", role: "博客园", enabled: true, support: "manual", accountMode: "local", capabilities: "长文", description: "已接入本地账号和任务队列，需在编辑器人工确认", requiresManualConfirmation: true },
  { id: "eastmoney", category: "self_media", role: "东方财富", enabled: true, support: "ready", accountMode: "local", capabilities: "财经内容", description: "本地发布节点自动填充草稿，平台验证码和风控由本机处理", requiresManualConfirmation: false },
  { id: "netease", category: "self_media", role: "网易号", enabled: true, support: "ready", accountMode: "local", capabilities: "图文", description: "本地发布节点自动填充草稿，平台验证码和风控由本机处理", requiresManualConfirmation: false }
].map((entry) => entry.enabled && entry.accountMode === "local"
  ? {
    ...entry,
    support: "ready",
    requiresManualConfirmation: false,
    description: "本地发布助手登录后可直接下发；如遇验证码、风控或提交失败，会单独回写任务结果"
  }
  : entry);

const PLATFORM_STYLE_HINTS = {
  web: "完整长文与结构化信息",
  wechat: "公众号阅读节奏与段落",
  zhihu: "问答逻辑与观点论证",
  toutiao: "信息流阅读与直接表达"
};

/* 首期正式支持的发布平台（与 README 产品定位一致）：官网由服务器发布，公众号/知乎/头条走本地发布助手 */
const FORMAL_PUBLISH_PLATFORM_IDS = new Set([
  "web", "wechat_mp", "zhihu", "toutiao", "baijiahao", "xiaohongshu", "weibo", "juejin", "csdn",
  "jianshu", "douyin", "bilibili", "yuque", "douban", "sohu", "xueqiu", "woshipm", "dayu",
  "yidian", "imooc", "segmentfault", "cnblogs",
  "eastmoney", "netease",
]);

const STATUS_META = {
  draft: ["草稿", "status-draft"],
  pending_review: ["待审核", "status-review"],
  approved: ["已通过", "status-approved"],
  published: ["已发布", "status-published"],
  publishing: ["发布中", "status-publishing"],
  queued: ["排队中", "status-queued"],
  scheduled: ["已排期", "status-queued"],
  cancelled: ["已取消", "status-draft"],
  running: ["执行中", "status-running"],
  success: ["发布成功", "status-success"],
  completed: ["已完成", "status-success"],
  failed: ["发布失败", "status-error"],
  needs_login: ["未登录", "status-login"],
  needs_verification: ["需要验证", "status-login"],
  unknown: ["状态待检测", "status-pending"],
  manual_ready: ["已登录", "status-online"],
  manual_required: ["需验证", "status-login"],
  awaiting_confirmation: ["需验证", "status-login"],
  awaiting_login: ["等待登录", "status-login"],
  partial_failed: ["部分失败", "status-error"],
  processing: ["处理中", "status-publishing"],
  draft_saved: ["草稿待确认", "status-pending"],
  planned: ["规划中", "status-draft"],
  not_connected: ["未绑定账号", "status-draft"],
  result_unknown: ["结果待核验", "status-pending"],
  device_online: ["在线", "status-online"],
  device_offline: ["离线", "status-login"],
  online: ["已登录", "status-online"],
  healthy: ["正常", "status-success"],
  partial: ["部分完成", "status-pending"]
};

function uid(prefix) {
  return prefix + "-" + String(Date.now()).slice(-7) + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function minutesAgo(minutes) {
  return Date.now() - minutes * 60 * 1000;
}

function defaultState() {
  return {
    schemaVersion: 13,
    businessLines: [],
    writingAgents: [
      {
        id: "WA-GEO-DEEP", name: "GEO 深度文章专家", description: "把企业知识组织成结论清晰、证据充分的 GEO 深度文章。", avatar: "深", color: "blue", builtIn: true, status: "active",
        businessLineIds: [], contentTypes: ["深度文章", "系列文章"], template: "deep", role: "企业 GEO 内容顾问", audience: "企业决策者、市场负责人和业务负责人", tone: "专业、可信、克制", style: "结论先行 · 分点论证 · 证据优先", structure: ["结论先行", "分点论证", "证据引用", "行动建议"], required: "每个关键判断尽量引用企业已审核事实，并说明适用边界。", banned: "不得虚构案例、价格、排名、客户评价或确定性效果承诺。", cta: "使用克制的下一步建议，不制造焦虑。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：用 3–5 个主体小节解释问题，必要时给出比较维度、证据列表和可执行清单；先说结论，再补充条件和边界。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: ["KB-GEO-001", "KB-CASE-001"], modelMode: "inherit", creativity: 0.35, minWords: 1600, maxWords: 2600, version: 2, usageCount: 12, createdBy: "系统", createdAt: minutesAgo(10080), updatedAt: minutesAgo(1440)
      },
      {
        id: "WA-FAQ", name: "客户问题标准回答", description: "先回答客户最关心的问题，再解释原因、条件与适用边界。", avatar: "答", color: "teal", builtIn: true, status: "active",
        businessLineIds: [], contentTypes: ["问答文章", "深度文章"], template: "qa", role: "企业标准问答编辑", audience: "正在了解方案的潜在客户", tone: "直接、清楚、耐心", style: "先给答案 · 再讲原因 · 明确边界", structure: ["一句话结论", "关键原因", "适用条件", "下一步"], required: "问题开头必须直接作答，避免空泛铺垫。", banned: "不得把尚未审核的信息写成企业标准答案。", cta: "引导读者补充自己的业务场景。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：把标题问题改写成一问一答，开篇用 1–2 句话直接作答，再列出条件、步骤、边界和至少 3 个追问 FAQ；不要用泛泛科普替代答案。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: ["KB-FAQ-001"], modelMode: "inherit", creativity: 0.2, minWords: 800, maxWords: 1400, version: 2, usageCount: 8, createdBy: "系统", createdAt: minutesAgo(10020), updatedAt: minutesAgo(1380)
      },
      {
        id: "WA-CASE", name: "行业案例拆解", description: "按背景、问题、过程、结果与边界拆解已审核案例。", avatar: "案", color: "amber", builtIn: true, status: "active",
        businessLineIds: ["BL-GEO"], contentTypes: ["案例解读", "深度文章"], template: "case", role: "B2B 案例解读编辑", audience: "正在比较方案与服务商的企业客户", tone: "客观、具体、可核验", style: "背景还原 · 过程拆解 · 结果有边界", structure: ["案例背景", "核心问题", "实施过程", "结果与适用边界"], required: "结果必须来自已审核案例，区分事实与方法建议。", banned: "不得编造客户名称、项目数据和结果指标。", cta: "邀请读者对照自己的项目条件。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：按案例背景、问题、过程、结果与适用边界组织内容；每一个结果数字和客户评价都必须逐条有证据，证据不足时阻止生成，不把个案结果泛化。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "block", preferredKnowledgeBaseIds: ["KB-CASE-001"], modelMode: "inherit", creativity: 0.25, minWords: 1200, maxWords: 2000, version: 2, usageCount: 5, createdBy: "系统", createdAt: minutesAgo(9960), updatedAt: minutesAgo(1320)
      },
      {
        id: "WA-PURCHASE", name: "工业品采购决策顾问", description: "面向采购、技术和管理者，输出可比较、可验证的决策指南。", avatar: "采", color: "violet", builtIn: false, status: "active",
        businessLineIds: ["BL-GEO"], contentTypes: ["深度文章", "系列文章"], template: "guide", role: "工业品采购决策顾问", audience: "采购负责人、技术负责人和企业管理者", tone: "理性、务实、不夸张", style: "决策框架 · 对比维度 · 验证清单", structure: ["明确目标", "比较维度", "验证证据", "决策清单"], required: "给出可执行的比较标准，并标记企业事实引用。", banned: "不得输出未经证实的排名或绝对化推荐。", cta: "提供下一步核验清单。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：围绕采购目标、比较维度、公开证据和验收标准输出决策指南；不直接给无依据的榜单或唯一推荐，必须说明适合谁、不适合谁以及如何核验。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: ["KB-GEO-001", "KB-CASE-001"], modelMode: "inherit", creativity: 0.3, minWords: 1400, maxWords: 2200, version: 3, usageCount: 4, createdBy: currentUserName() || "系统管理员", createdAt: minutesAgo(8640), updatedAt: minutesAgo(360)
      },
      {
        id: "WA-BRAND-STORY", name: "品牌口吻编辑", description: "沿用企业语气，把业务事实组织成自然、有温度的品牌叙事。", avatar: "品", color: "rose", builtIn: false, status: "active",
        businessLineIds: ["BL-VIDEO"], contentTypes: ["深度文章", "案例解读"], template: "story", role: "企业品牌内容编辑", audience: "客户、合作伙伴与行业从业者", tone: "真诚、自然、有温度", style: "场景开篇 · 品牌视角 · 事实落点", structure: ["真实场景", "企业观察", "解决过程", "行动邀请"], required: "品牌表达必须落到已审核的产品、服务或案例事实。", banned: "不得使用空洞口号或虚构品牌故事。", cta: "用自然邀请结束，不强行推销。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：可以从真实业务场景切入，但叙事必须回到企业主体、服务范围和公开证据；不得虚构人物、故事、客户反馈或结果。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: [], modelMode: "inherit", creativity: 0.5, minWords: 1000, maxWords: 1800, version: 2, usageCount: 3, createdBy: "运营团队", createdAt: minutesAgo(5760), updatedAt: minutesAgo(720)
      }
    ],
    keywords: [],
    keywordPacks: [],

    questionLibrary: [],

    topics: [],

    contentPlans: [],

    articles: [],

    publishTasks: [],

    publishSchedules: [],
    accountGroups: [],

    site: {
      domain: "",
      baseUrl: "",
      status: "not_configured",
      theme: "企业官网 · 标准版",
      pages: 0,
      articles: 0,
      leads: 0,
      lastDiagnostic: null,
      diagnosticStatus: "尚未检测",
      cms: {
        settings: {
          siteName: "企业官网",
          companyName: "企业",
          description: "企业公开信息、产品服务与行业内容。",
          logoUrl: "",
          sameAs: [],
          allowAiCrawl: true,
          updatedAt: null
        },
        assets: {
          logoUrl: "",
          faviconUrl: "",
          defaultImageUrl: "/assets/template-01-default.png",
          defaultImageAlt: "企业默认图片"
        },
        pages: [
          { id: "home", type: "首页", title: "首页", path: "/", status: "published", description: "企业定位、核心服务、案例与咨询入口", seoDescription: "企业为企业提供 GEO 优化、内容运营与 AI 落地服务。", schemaEnabled: true, sitemapEnabled: true, version: 3, savedAt: "2026-07-24T09:20:00.000Z", publishedAt: "2026-07-24T09:20:00.000Z", versions: [{ version: 2, title: "首页", path: "/", description: "企业定位、核心服务、案例与咨询入口", seoDescription: "企业为企业提供 GEO 优化、内容运营与 AI 落地服务。", savedAt: "2026-07-16T09:20:00.000Z", note: "首页信源结构更新" }] },
          { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", description: "企业主体、团队与发展信息", seoDescription: "了解企业的企业主体、团队与服务理念。", schemaEnabled: true, sitemapEnabled: true, version: 2, savedAt: "2026-07-21T09:20:00.000Z", publishedAt: "2026-07-21T09:20:00.000Z", versions: [] },
          { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", description: "服务能力、适用对象与交付边界", seoDescription: "查看企业的 GEO 优化、内容运营与 AI 落地服务。", schemaEnabled: true, sitemapEnabled: true, version: 2, savedAt: "2026-07-21T09:20:00.000Z", publishedAt: "2026-07-21T09:20:00.000Z", versions: [] },
          { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", description: "经过审核的客户案例与实施结果", seoDescription: "查看企业 GEO 与内容运营服务案例。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-19T09:20:00.000Z", publishedAt: "2026-07-19T09:20:00.000Z", versions: [] },
          { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", description: "客户自定义栏目下的公开文章", seoDescription: "企业行业资讯、方法和案例文章。", schemaEnabled: true, sitemapEnabled: true, version: 3, savedAt: "2026-07-23T09:20:00.000Z", publishedAt: "2026-07-23T09:20:00.000Z", versions: [] },
          { id: "problem-map", type: "问题地图", title: "问题地图", path: "/problem-map/", status: "published", description: "按服务方向和行业整理客户真实问题", seoDescription: "按服务方向与行业查看企业客户常见问题及直接回答。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-24T09:20:00.000Z", publishedAt: "2026-07-24T09:20:00.000Z" },
          { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", description: "咨询表单、服务区域与联系方式", seoDescription: "联系企业，预约业务诊断。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-19T09:20:00.000Z", publishedAt: "2026-07-19T09:20:00.000Z", versions: [] },
          { id: "landing", type: "专题页", title: "制造业 GEO 专题", path: "/topics/manufacturing-geo/", status: "draft", description: "可按业务线创建的专题落地页", seoDescription: "制造业企业 GEO 优化专题。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-24T09:20:00.000Z", publishedAt: null, versions: [] }
        ],
        modules: {
          home: [
            { id: "home-hero", title: "首屏", description: "企业定位、直接答案与主 CTA", source: "引用企业公共知识", status: "published", content: "让客户和 AI 在第一屏理解企业服务、适用对象与下一步行动。" },
            { id: "home-answer", title: "直接答案", description: "用一段话回答客户最关心的问题", source: "AI 信源摘要", status: "published", content: "围绕企业知识、官网信源、内容生产和多平台运营，建立可持续的 GEO 运营闭环。" },
            { id: "home-services", title: "产品服务", description: "服务范围、适用对象和交付边界", source: "产品/业务线资料", status: "published", content: "展示企业服务、适用对象、交付方式与边界。" },
            { id: "home-proof", title: "案例与证据", description: "案例、数据和可核验事实", source: "已审核案例库", status: "published", content: "引用已审核案例和可核验的企业事实。" },
            { id: "home-insights", title: "最新资讯", description: "自动展示已发布文章和栏目", source: "行业资讯", status: "draft", content: "自动列出已发布的行业资讯。" },
            { id: "home-cta", title: "咨询 CTA", description: "联系表单与下一步行动", source: "线索表单", status: "published", content: "预约业务诊断，获取适合企业现状的建议。" }
          ],
          insights: [
            { id: "insights-category", title: "栏目说明", description: "栏目简介、AI 摘要和导航入口", source: "栏目配置", status: "published", content: "用栏目说明帮助访问者与 AI 理解文章主题范围。" },
            { id: "insights-list", title: "文章列表", description: "标题、摘要、作者、日期与主栏目", source: "官网文章", status: "published", content: "展示经过审核并发布的文章。" },
            { id: "insights-related", title: "相关内容", description: "按业务线、标签和实体关联内容", source: "内容关联", status: "draft", content: "依据栏目、标签和业务线推荐相关内容。" }
          ],
          services: [
            { id: "services-answer", title: "服务直接答案", description: "适合谁、解决什么问题、如何交付", source: "企业知识库", status: "published", content: "基于企业知识库展示服务定位和交付方式。" },
            { id: "services-modules", title: "服务模块", description: "产品、能力、流程和边界", source: "产品/业务线资料", status: "published", content: "展示服务模块、能力和边界。" },
            { id: "services-faq", title: "FAQ 与 CTA", description: "常见问题、证据和咨询入口", source: "FAQ 知识库", status: "draft", content: "回答常见问题并提供咨询入口。" }
          ],
          cases: [
            { id: "cases-hero", type: "hero", title: "服务案例", description: "展示经过脱敏、审核并允许公开的实施案例", source: "已审核案例库", status: "published", content: "用真实场景说明服务方法、工作过程和可核验结果。" },
            { id: "cases-proof", type: "proof", title: "案例与证据", description: "按业务场景展示公开案例与实施依据", source: "企业案例知识库", status: "published", content: "只引用已通过公开范围审核的案例资料。" },
            { id: "cases-cta", type: "cta", title: "了解实施方式", description: "连接到业务咨询入口", source: "线索表单", status: "published", content: "提交您的业务场景，了解适合的实施路径。", ctaLabel: "提交业务场景", ctaHref: "/contact/" }
          ],
          "problem-map": [
            { id: "problem-map-hero", type: "hero", title: "问题地图", description: "按服务方向和行业整理客户真实问题", source: "问题词库与已发布文章", status: "published", content: "从真实客户提问出发，连接直接回答、行业文章、服务案例和对应服务。" },
            { id: "problem-map-list", type: "problem-map", title: "客户正在问什么", description: "按服务方向、行业与决策阶段组织问题", source: "已审核问题地图", status: "published", content: "只展示已公开问题或已发布文章关联的问题。" },
            { id: "problem-map-cta", type: "cta", title: "没有找到您的问题？", description: "提交企业现状和具体问题", source: "线索表单", status: "published", content: "我们会根据企业资料和业务目标给出下一步建议。", ctaLabel: "提交企业问题", ctaHref: "/contact/" }
          ]
        },
        categories: [
          { id: "geo", name: "GEO优化", slug: "geo", level: 1, count: 8, status: "active", description: "企业 GEO 方法、信源建设与 AI 搜索", navVisible: true, seoDescription: "企业 GEO 优化方法、公开信源建设与 AI 搜索内容。" },
          { id: "enterprise-ai", name: "企业AI落地", slug: "enterprise-ai", level: 1, count: 5, status: "active", description: "企业知识、AI 应用与流程落地", navVisible: true, seoDescription: "企业知识、AI 应用与流程落地实践。" },
          { id: "short-video", name: "短视频运营", slug: "short-video", level: 1, count: 4, status: "active", description: "短视频获客、账号运营与内容策略", navVisible: true, seoDescription: "短视频获客、账号运营和内容策略。" },
          { id: "solutions", name: "应用方案", slug: "solutions", level: 1, count: 3, status: "active", description: "按行业和业务场景组织的解决方案", navVisible: false, seoDescription: "按行业和业务场景组织的解决方案。" },
          { id: "procurement", name: "采购指南", slug: "procurement", level: 1, count: 2, status: "active", description: "选型、比较和采购决策问题", navVisible: false, seoDescription: "服务选型、比较和采购决策参考。" },
          { id: "archive", name: "历史归档", slug: "archive", level: 1, count: 6, status: "archived", description: "不再进入导航的历史栏目", navVisible: false, seoDescription: "" }
        ],
        navItems: [
          { id: "nav-home", label: "首页", path: "/", type: "固定页面", visible: true },
          { id: "nav-services", label: "产品与服务", path: "/services/", type: "固定页面", visible: true },
          { id: "nav-insights", label: "行业资讯", path: "/insights/", type: "资讯列表", visible: true },
          { id: "nav-cases", label: "服务案例", path: "/cases/", type: "固定页面", visible: true },
          { id: "nav-problem-map", label: "问题地图", path: "/problem-map/", type: "固定页面", visible: true },
          { id: "nav-about", label: "关于我们", path: "/about/", type: "固定页面", visible: true },
          { id: "nav-contact", label: "联系我们", path: "/contact/", type: "固定页面", visible: true }
        ],
        theme: { name: "桐灼企业官网 · 标准版", primaryColor: "#1D5CFF", cta: "预约业务诊断", version: 1, updatedAt: "2026-07-24T09:20:00.000Z" },
        templateConfigs: {},
        footer: {
          description: "企业公开信息、产品服务与行业内容。",
          copyright: "版权所有",
          icpNumber: "",
          icpUrl: "",
          policeRecordNumber: "",
          policeRecordUrl: "",
          showIcp: true,
          showPoliceRecord: true,
          showCopyright: true,
          showSocial: true,
          columns: [],
          socialLinks: []
        },
        leads: [],
        redirects: [],
        deployment: { mode: "独立服务器", environment: "production", rootPath: "/var/www/tongzhuo-site", branch: "main", status: "online", lastDeployAt: "2026-07-24 09:20", lastTestAt: "2026-07-24 09:25", updatedAt: "2026-07-24T09:20:00.000Z" }
      }
    },
    enterpriseProfile: {
      completion: 0,
      companyName: "",
      brandName: "",
      officialDomain: "",
      industryRegion: "",
      introduction: "",
      primaryService: "",
      serviceDescription: "",
      audience: "",
      serviceArea: "",
      steps: [
        { id: "basic", label: "企业基本资料", status: "pending" },
        { id: "products", label: "产品与服务", status: "pending" },
        { id: "audience", label: "目标客户与区域", status: "pending" },
        { id: "evidence", label: "案例、FAQ 与证据", status: "pending" }
      ]
    },
    knowledgeBases: [
      {
        id: "KB-CORP-001",
        name: "企业公共知识库",
        kind: "document",
        scope: "enterprise",
        businessLineId: null,
        isDefault: true,
        indexStrategy: "rag",
        description: "所有业务线默认继承的企业身份、服务定位与对外表述边界。",
        itemIds: ["KI-CORP-001", "KI-CORP-002"],
        status: "ready",
        updatedAt: "2026-07-22T10:05:00+08:00"
      },
      {
        id: "KB-GEO-001",
        name: "GEO 业务线文档库",
        kind: "document",
        scope: "business_line",
        businessLineId: "BL-GEO",
        isDefault: true,
        indexStrategy: "rag",
        description: "GEO 服务流程、交付方式与内容审核规范。",
        itemIds: ["KI-GEO-001", "KI-GEO-002"],
        status: "ready",
        updatedAt: "2026-07-22T10:18:00+08:00"
      },
      {
        id: "KB-CASE-001",
        name: "客户案例库",
        kind: "document",
        scope: "business_line",
        businessLineId: "BL-GEO",
        isDefault: true,
        indexStrategy: "rag",
        description: "已脱敏、已审核并允许用于内容生产的实施案例。",
        itemIds: ["KI-CASE-001", "KI-CASE-002"],
        status: "ready",
        updatedAt: "2026-07-21T17:10:00+08:00"
      },
      {
        id: "KB-FAQ-001",
        name: "FAQ 问答库",
        kind: "qa",
        scope: "business_line",
        businessLineId: "BL-GEO",
        isDefault: true,
        indexStrategy: "rag",
        description: "企业认可的客户问题与标准回答。",
        itemIds: ["KI-FAQ-001", "KI-FAQ-002"],
        status: "ready",
        updatedAt: "2026-07-22T10:02:00+08:00"
      }
    ],
    knowledgeItems: [],

    knowledgeVersions: [],

    knowledgeGaps: [],

    knowledgeCitations: [],

    writingWorkspaces: [],
    aiConversations: [],
    contentAssets: [],

    knowledge: {
      profile: { count: 0, reviewed: 0, updated: "尚未录入" },
      products: { count: 0, reviewed: 0, updated: "尚未录入" },
      cases: { count: 0, reviewed: 0, updated: "尚未录入" },
      faq: { count: 0, reviewed: 0, updated: "尚未录入" },
      documents: { count: 0, reviewed: 0, updated: "尚未录入" },
      images: { count: 0, reviewed: 0, updated: "尚未录入" },
      adLaw: { count: 0, reviewed: 0, updated: "尚未录入" },
      sensitive: { count: 0, reviewed: 0, updated: "尚未录入" },
      banned: { count: 0, reviewed: 0, updated: "尚未录入" }
    },
    monitoring: {
      demo: false,
      lastRunAt: null,
      metrics: {},
      trend: [],
      platforms: [],
      sources: [],
      questions: [],
      customQueries: [],
      queryBindings: [],
      trackedWorks: [],
      tasks: []
    },
    settings: {
      model: "",
      imageModel: "",
      modelProviderId: "",
      imageProviderId: "",
      embeddingProviderId: "",
      defaultWritingAgentId: "WA-GEO-DEEP",
      riskGate: true,
      manualReview: true,
      tenant: "待配置企业",
      deployment: "独立服务器",
      members: [],
      operationLogs: [],
    }
  };
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState()));
}

const SITE_TEMPLATE_REGISTRY = Object.freeze(window.TONGZHUO_SITE_TEMPLATES || []);
const DEFAULT_SITE_TEMPLATE_KEY = "01-industry";

function siteTemplateKey() {
  const key = siteCms()?.templateKey || siteCms()?.theme?.templateKey || DEFAULT_SITE_TEMPLATE_KEY;
  return SITE_TEMPLATE_REGISTRY.some((item) => item.key === key) ? key : DEFAULT_SITE_TEMPLATE_KEY;
}

function siteTemplate() {
  return SITE_TEMPLATE_REGISTRY.find((item) => item.key === siteTemplateKey()) || SITE_TEMPLATE_REGISTRY[0] || {
    key: DEFAULT_SITE_TEMPLATE_KEY, name: "工业制造 / 建材 / 机械", shortName: "工业制造", description: "企业官网模板", accent: "#1d4ed8", supports: []
  };
}

function blankSiteCms(sourceCms = {}) {
  const genericPages = [
    ["home", "首页", "首页", "/", "企业定位、核心服务与咨询入口"],
    ["services", "服务页", "产品与服务", "/services/", "产品、服务、适用对象与交付边界"],
    ["cases", "案例页", "服务案例", "/cases/", "经过审核的客户案例与实施结果"],
    ["insights", "资讯列表", "行业资讯", "/insights/", "企业发布的行业资讯与专业内容"],
    ["problem-map", "问题地图", "问题地图", "/problem-map/", "按服务方向和行业整理客户真实问题"],
    ["about", "关于页", "关于我们", "/about/", "企业主体、团队与发展信息"],
    ["contact", "联系页", "联系我们", "/contact/", "咨询表单与企业联系方式"]
  ].map(([id, type, title, pagePath, description]) => ({
    id,
    type,
    title,
    path: pagePath,
    status: "draft",
    description,
    seoDescription: "",
    schemaEnabled: true,
    sitemapEnabled: true,
    version: 1,
    savedAt: null,
    publishedAt: null
  }));
  const modules = cloneData(sourceCms.modules || {});
  Object.values(modules).forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => { item.status = "draft"; });
  });
  return {
    settings: {
      siteName: "企业官网",
      companyName: "",
      description: "",
      logoUrl: "",
      sameAs: [],
      allowAiCrawl: true,
      updatedAt: null
    },
    pages: genericPages,
    modules,
    categories: [],
    navItems: cloneData(sourceCms.navItems || []),
    templateKey: sourceCms.templateKey || DEFAULT_SITE_TEMPLATE_KEY,
    theme: { name: "企业官网 · 标准版", primaryColor: "#1D5CFF", cta: "联系我们", templateKey: sourceCms.templateKey || DEFAULT_SITE_TEMPLATE_KEY, version: 1, updatedAt: null },
    leads: [],
    redirects: [],
    deployment: { mode: "独立服务器", environment: "production", rootPath: "", branch: "", status: "not_configured", lastDeployAt: null, lastTestAt: null, updatedAt: null }
  };
}

function blankKnowledgeSummary(source = {}) {
  return Object.fromEntries(Object.keys(source).map((key) => [key, { count: 0, reviewed: 0, updated: "尚未录入" }]));
}

function cloneBlankState() {
  const blank = cloneDefaultState();
  blank.workspaceSeed = "private_blank_v1";
  blank.businessLines = [];
  blank.writingAgents = blank.writingAgents
    .filter((agent) => agent.builtIn)
    .map((agent) => ({
      ...agent,
      businessLineIds: [],
      preferredKnowledgeBaseIds: [],
      usageCount: 0,
      version: 1,
      createdBy: "系统"
    }));
  for (const key of [
    "keywords", "keywordPacks", "questionLibrary", "topics", "contentPlans", "articles",
    "publishTasks", "publishSchedules", "accountGroups", "knowledgeBases", "knowledgeItems",
    "knowledgeVersions", "knowledgeGaps", "knowledgeCitations", "writingWorkspaces",
    "aiConversations", "contentAssets"
  ]) blank[key] = [];
  if (blank.site) blank.site.leads = [];
  if (blank.settings) {
    blank.settings.members = [];
    blank.settings.operationLogs = [];
  }
  blank.site = {
    domain: "",
    baseUrl: "",
    status: "not_configured",
    theme: "企业官网 · 标准版",
    pages: 0,
    articles: 0,
    leads: 0,
    lastDiagnostic: null,
    diagnosticStatus: "尚未检测",
    cms: blankSiteCms(blank.site?.cms)
  };
  blank.enterpriseProfile = {
    completion: 0,
    companyName: "",
    brandName: "",
    officialDomain: "",
    industryRegion: "",
    introduction: "",
    primaryService: "",
    serviceDescription: "",
    audience: "",
    serviceArea: "",
    steps: [
      { id: "basic", label: "企业基本资料", status: "pending" },
      { id: "products", label: "产品与服务", status: "pending" },
      { id: "audience", label: "目标客户与区域", status: "pending" },
      { id: "evidence", label: "案例、FAQ 与证据", status: "pending" }
    ]
  };
  blank.knowledge = blankKnowledgeSummary(blank.knowledge);
  blank.monitoring = {
    demo: false,
    lastRunAt: null,
    metrics: { questions: 0, totalSamples: 0, validSamples: 0, mentions: 0, recommendations: 0, officialCitations: 0, mentionRate: 0, averageRank: null, citedWorks: 0, citations: 0, sentimentPositive: 0 },
    trend: [],
    platforms: [],
    sources: [],
    questions: [],
    trackedWorks: [],
    tasks: []
  };
  blank.settings = {
    ...blank.settings,
    model: "",
    imageModel: "",
    modelProviderId: "",
    imageProviderId: "",
    embeddingProviderId: "",
    defaultWritingAgentId: blank.writingAgents[0]?.id || "",
    tenant: "待配置企业",
    deployment: "独立服务器",
    members: [],
    operationLogs: []
  };
  return blank;
}

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildQuestionCandidates(seeds, packId, businessLineId, existingQuestions = new Set(), options = {}) {
  const normalizedSeeds = [...new Set((seeds || []).map((seed) => String(seed || "").trim()).filter(Boolean))];
  if (!normalizedSeeds.length) return [];
  const currentCounts = options.currentCounts || {};
  const questions = [];
  const source = options.source || "GEORank 演示拓展";
  const status = options.status || "candidate";
  Object.entries(QUESTION_VARIANTS).forEach(([dimension, template]) => {
    const target = Math.max(QUESTION_VARIANT_LIMIT - Number(currentCounts[dimension] || 0), 0);
    let createdForDimension = 0;
    const totalVariants = template.variants.length + QUESTION_FALLBACK_ANGLES.length * 8;
    for (let attempt = 0; attempt < totalVariants * normalizedSeeds.length && createdForDimension < target; attempt += 1) {
      const variantIndex = attempt % totalVariants;
      const seedIndex = (attempt + Math.floor(attempt / totalVariants)) % normalizedSeeds.length;
      const seed = normalizedSeeds[seedIndex];
      const questionText = variantIndex < template.variants.length
        ? template.variants[variantIndex](seed)
        : seed + "在" + (DIMENSIONS.find((item) => item.id === dimension)?.label || dimension) + "中，从" + QUESTION_FALLBACK_ANGLES[(variantIndex - template.variants.length) % QUESTION_FALLBACK_ANGLES.length] + "角度应该如何分析？" + (variantIndex >= template.variants.length + QUESTION_FALLBACK_ANGLES.length ? "（第" + (Math.floor((variantIndex - template.variants.length) / QUESTION_FALLBACK_ANGLES.length) + 1) + "轮拓展）" : "");
      const key = questionText.toLowerCase();
      if (existingQuestions.has(key)) continue;
      existingQuestions.add(key);
      const question = {
        id: uid("Q") + dimension + "-" + attempt + "-" + seedIndex,
        packId,
        businessLineId,
        sourceKeyword: seed,
        question: questionText,
        dimension,
        intent: template.intent,
        stage: template.stage,
        coverage: createdForDimension === 0 ? "部分覆盖" : "未覆盖",
        source,
        status,
        version: 1,
        topicId: null,
        selected: false,
        recommendation: template.recommendation,
        business: template.business,
        reason: template.reason,
        generationMode: options.generationMode || "fallback_demo",
        engine: options.engine || "georank-compatible",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      question.geoIntent = buildGeoQuestionIntent(question);
      questions.push(question);
      createdForDimension += 1;
    }
  });
  return questions;
}

function ensureQuestionPackMinimum(parsed, packId) {
  if (!Array.isArray(parsed.keywordPacks) || !Array.isArray(parsed.questionLibrary)) return;
  const pack = parsed.keywordPacks.find((item) => item.id === packId);
  if (!pack) return;
  const deletedCandidateCounts = pack.deletedCandidateCounts && typeof pack.deletedCandidateCounts === "object" ? pack.deletedCandidateCounts : {};
  // Historical demo packs may be incomplete. Never manufacture questions on
  // load: new candidates must come from the configured model endpoint and pass
  // the same customer-question quality gate as a fresh expansion.
  pack.deletedCandidateCounts = deletedCandidateCounts;
  pack.total = parsed.questionLibrary.filter((question) => question.packId === pack.id && question.status === "candidate").length;
}

function createWritingAgentSnapshot(agent, options = {}) {
  if (!agent) return null;
  const version = Number(agent.version) || 1;
  return {
    agentId: agent.id,
    version,
    nameSnapshot: agent.name,
    descriptionSnapshot: agent.description || "",
    template: agent.template || "deep",
    role: agent.role || "企业内容编辑",
    audience: agent.audience || "企业客户",
    tone: agent.tone || "专业、清晰",
    style: agent.style || "结论清晰 · 证据优先",
    structure: cloneData(agent.structure || []),
    required: agent.required || "",
    banned: agent.banned || "",
    cta: agent.cta || "",
    systemPrompt: agent.systemPrompt || "",
    geoPromptVersion: Number(agent.geoPromptVersion) || 1,
    strictKnowledge: agent.strictKnowledge !== false,
    citationsRequired: agent.citationsRequired !== false,
    missingEvidenceAction: agent.missingEvidenceAction || "omit",
    preferredKnowledgeBaseIds: cloneData(agent.preferredKnowledgeBaseIds || []),
    modelMode: agent.modelMode || "inherit",
    creativity: Number(agent.creativity ?? 0.35),
    minWords: Number(agent.minWords) || 800,
    maxWords: Number(agent.maxWords) || 1800,
    resolvedModel: { name: options.modelName || "DeepSeek V3", creativity: Number(agent.creativity ?? 0.35) },
    checksum: agent.id + "-v" + version,
    selectedAt: options.selectedAt || new Date().toISOString(),
    selectedBy: options.selectedBy || "系统迁移",
    selectionSource: options.selectionSource || "manual",
    lockedAt: options.lockedAt || null
  };
}

function migrateState(parsed) {
  const defaults = cloneDefaultState();
  const isPrivateBlankSeed = parsed.workspaceSeed === "private_blank_v1";
  const previousSchemaVersion = Number(parsed.schemaVersion || 0);
  if (!parsed.site || typeof parsed.site !== "object") parsed.site = cloneData(defaults.site);
  parsed.site = { ...defaults.site, ...parsed.site };
  const savedCms = parsed.site.cms && typeof parsed.site.cms === "object" ? parsed.site.cms : {};
  const defaultCms = defaults.site.cms;
  parsed.site.cms = {
    ...cloneData(defaultCms),
    ...savedCms,
    settings: { ...cloneData(defaultCms.settings), ...(savedCms.settings || {}) },
    assets: { ...cloneData(defaultCms.assets || { logoUrl: "", faviconUrl: "", defaultImageUrl: "", defaultImageAlt: "企业默认图片" }), ...(savedCms.assets || {}) },
    templateConfigs: savedCms.templateConfigs && typeof savedCms.templateConfigs === "object" ? savedCms.templateConfigs : cloneData(defaultCms.templateConfigs || {}),
    footer: { ...cloneData(defaultCms.footer || { columns: [], socialLinks: [] }), ...(savedCms.footer || {}), columns: Array.isArray(savedCms.footer?.columns) ? savedCms.footer.columns : cloneData(defaultCms.footer?.columns || []), socialLinks: Array.isArray(savedCms.footer?.socialLinks) ? savedCms.footer.socialLinks : cloneData(defaultCms.footer?.socialLinks || []) },
    pages: Array.isArray(savedCms.pages) ? savedCms.pages : cloneData(defaultCms.pages),
    modules: savedCms.modules && typeof savedCms.modules === "object" ? savedCms.modules : cloneData(defaultCms.modules),
    categories: Array.isArray(savedCms.categories) ? savedCms.categories : cloneData(defaultCms.categories),
    navItems: Array.isArray(savedCms.navItems) ? savedCms.navItems : cloneData(defaultCms.navItems),
    theme: { ...cloneData(defaultCms.theme), ...(savedCms.theme || {}) },
    leads: Array.isArray(savedCms.leads) ? savedCms.leads : cloneData(defaultCms.leads),
    redirects: Array.isArray(savedCms.redirects) ? savedCms.redirects : cloneData(defaultCms.redirects),
    deployment: { ...cloneData(defaultCms.deployment), ...(savedCms.deployment || {}) }
  };
  parsed.site.cms.pages = parsed.site.cms.pages.map((page) => {
    const normalizedPage = {
      schemaEnabled: true,
      sitemapEnabled: true,
      version: 1,
      savedAt: new Date().toISOString(),
      publishedAt: page.status === "published" ? new Date().toISOString() : null,
      seoDescription: page.description || "",
      ...page
    };
    delete normalizedPage.versions;
    return normalizedPage;
  });
  Object.keys(parsed.site.cms.modules).forEach((pageId) => {
    const modules = Array.isArray(parsed.site.cms.modules[pageId]) ? parsed.site.cms.modules[pageId] : [];
    parsed.site.cms.modules[pageId] = modules.map((module, index) => Array.isArray(module)
      ? { id: `${pageId}-module-${index + 1}`, title: module[0], description: module[1], source: module[2], status: module[3] || "draft", content: "" }
      : { id: module.id || `${pageId}-module-${index + 1}`, title: module.title || "未命名模块", description: module.description || "", source: module.source || "页面内容", status: module.status || "draft", content: module.content || "", ...module });
  });
  parsed.site.cms.categories = parsed.site.cms.categories.map((category) => ({ ...category, status: category.status || "active", navVisible: category.navVisible !== false, seoDescription: category.seoDescription || "" }));
  parsed.site.cms.navItems = parsed.site.cms.navItems.map((item, index) => Array.isArray(item)
    ? { id: `nav-${index + 1}`, label: item[0], path: item[1], type: item[2] || "自定义链接", visible: true }
    : { id: item.id || `nav-${index + 1}`, label: item.label || "导航项", path: item.path || "/", type: item.type || "自定义链接", visible: item.visible !== false, ...item });
  parsed.site.cms.leads = parsed.site.cms.leads.map((lead, index) => Array.isArray(lead)
    ? { id: `LEAD-${String(index + 1).padStart(3, "0")}`, name: lead[0], company: lead[1], service: lead[2], createdAt: lead[3], status: lead[4] || "new", sourcePage: "官网", owner: "未分配", nextFollowAt: "", notes: "", history: [] }
    : { id: lead.id || `LEAD-${String(index + 1).padStart(3, "0")}`, status: "new", sourcePage: "官网", owner: "未分配", nextFollowAt: "", notes: "", history: [], ...lead, history: Array.isArray(lead.history) ? lead.history : [] });
  const knowledgeCollections = ["knowledgeBases", "knowledgeItems", "knowledgeVersions", "knowledgeGaps", "knowledgeCitations", "writingWorkspaces", "aiConversations", "contentAssets"];
  knowledgeCollections.forEach((key) => {
    if (!Array.isArray(parsed[key])) parsed[key] = defaults[key];
  });
  parsed.knowledge = { ...cloneData(defaults.knowledge), ...(parsed.knowledge || {}) };
  Object.keys(defaults.knowledge).forEach((key) => {
    parsed.knowledge[key] = { ...cloneData(defaults.knowledge[key]), ...(parsed.knowledge[key] || {}) };
  });
  if (!isPrivateBlankSeed) defaults.knowledgeCitations.forEach((citation) => {
    if (!parsed.knowledgeCitations.some((item) => item.id === citation.id)) parsed.knowledgeCitations.push(cloneData(citation));
  });
  if (!Array.isArray(parsed.businessLines)) parsed.businessLines = defaults.businessLines;
  if (!Array.isArray(parsed.keywords)) parsed.keywords = cloneData(defaults.keywords);
  if (!Array.isArray(parsed.keywordPacks)) parsed.keywordPacks = cloneData(defaults.keywordPacks);
  parsed.keywordPacks = parsed.keywordPacks.map((pack) => ({
    ...pack,
    deletedCandidateCounts: pack.deletedCandidateCounts && typeof pack.deletedCandidateCounts === "object" ? pack.deletedCandidateCounts : {}
  }));
  if (!Array.isArray(parsed.questionLibrary)) parsed.questionLibrary = cloneData(defaults.questionLibrary);
  if (previousSchemaVersion < 12) {
    const referencedSeedIds = new Set(parsed.questionLibrary.flatMap((question) => [question.sourceSeedKeywordId, question.sourceChain?.seedKeywordId]).filter(Boolean));
    const referencedSeedTerms = new Set();
    parsed.keywordPacks.forEach((pack) => (pack.seeds || []).forEach((term) => referencedSeedTerms.add(`${pack.businessLineId}::${String(term).trim().toLowerCase()}`)));
    parsed.questionLibrary.forEach((question) => {
      const term = String(question.sourceSeedKeyword || question.sourceKeyword || "").trim().toLowerCase();
      if (term) referencedSeedTerms.add(`${question.businessLineId}::${term}`);
    });
    parsed.keywords = parsed.keywords.filter((keyword) => {
      if (keyword.keywordRole !== "seed" || keyword.source !== "AI 智能拓展") return true;
      if (referencedSeedIds.has(keyword.id)) return true;
      return referencedSeedTerms.has(`${keyword.businessLineId}::${String(keyword.term || "").trim().toLowerCase()}`);
    });
  }
  if (!Array.isArray(parsed.contentPlans)) parsed.contentPlans = defaults.contentPlans;
  if (!Array.isArray(parsed.articles)) parsed.articles = defaults.articles;
  if (!Array.isArray(parsed.publishSchedules)) parsed.publishSchedules = cloneData(defaults.publishSchedules || []);
  const normalizedQuestionLibrary = parsed.questionLibrary.map((question) => ({
    ...buildGeoQuestionIntent(question),
    ...question,
    status: question.status || 'active',
    version: Number(question.version) || 1,
    selected: question.status === 'archived' ? false : Boolean(question.selected),
    createdAt: question.createdAt || Date.now(),
    updatedAt: question.updatedAt || question.createdAt || Date.now(),
    geoIntent: { ...buildGeoQuestionIntent(question), ...(question.geoIntent || {}) }
  }));
  parsed.questionLibrary = normalizedQuestionLibrary.map((question) => {
    const trustedSource = ['system_rules_v1', 'model_contract'].includes(String(question.scoreSource || ''));
    const existingPriority = calculateQuestionPriorityScore(question);
    if (question.question && (!trustedSource || existingPriority == null)) {
      const legacyScoreSnapshot = question.legacyScoreSnapshot || captureLegacyQuestionScore(question);
      const businessLine = parsed.businessLines.find((line) => line.id === question.businessLineId) || null;
      const backfilled = calculateHistoricalQuestionRuleScores(question, normalizedQuestionLibrary, businessLine);
      if (backfilled) return { ...question, ...backfilled, ...(legacyScoreSnapshot ? { legacyScoreSnapshot } : {}) };
    }
    return applyQuestionPriorityScore(question);
  });  parsed.topics = (Array.isArray(parsed.topics) ? parsed.topics : defaults.topics).map((topic) => {
    const sourceQuestion = parsed.questionLibrary.find((question) => question.id === topic.questionId || question.topicId === topic.id);
    const migratedStatus = topic.status === "candidate" ? "active" : topic.status || "active";
    return {
      ...topic,
      status: migratedStatus,
      archivedFromStatus: topic.archivedFromStatus === "candidate" ? "active" : topic.archivedFromStatus,
      version: Number(topic.version) || 1,
      selected: migratedStatus === "archived" ? false : Boolean(topic.selected),
      autoAcceptedAt: topic.status === "candidate" ? topic.autoAcceptedAt || Date.now() : topic.autoAcceptedAt,
      createdAt: topic.createdAt || Date.now(),
      updatedAt: topic.updatedAt || topic.createdAt || Date.now(),
      questionSnapshot: topic.questionSnapshot || (sourceQuestion ? cloneData(sourceQuestion) : null),
      geoBrief: { ...buildGeoTopicBrief(topic, sourceQuestion), ...(topic.geoBrief || {}) }
    };
  });
  parsed.questionLibrary.forEach((question) => {
    if (question.coverage !== "待确认选题") return;
    const topic = parsed.topics.find((item) => item.id === question.topicId || item.questionId === question.id);
    if (topic && topic.status === "active") question.coverage = "已规划";
  });
  if (!Array.isArray(parsed.writingWorkspaces)) parsed.writingWorkspaces = cloneData(defaults.writingWorkspaces);
  if (!Array.isArray(parsed.aiConversations)) parsed.aiConversations = cloneData(defaults.aiConversations);
  if (!Array.isArray(parsed.contentAssets)) parsed.contentAssets = cloneData(defaults.contentAssets);
  (defaults.keywordPacks || []).map((pack) => pack.id).forEach((packId) => ensureQuestionPackMinimum(parsed, packId));
  parsed.writingWorkspaces = parsed.writingWorkspaces.map((workspace) => ({
    ...workspace,
    mode: workspace.mode || "quick",
    status: workspace.status || (workspace.articleId ? "draft" : "blank"),
    draftTitle: workspace.draftTitle || workspace.topic?.title || "",
    draftContent: workspace.draftContent || "",
    draftContentHtml: workspace.draftContentHtml || "",
    showPublicCitationMarkers: workspace.showPublicCitationMarkers === true,
    knowledgeScope: workspace.knowledgeScope || { inheritedBaseIds: [], addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: [], snapshottedAt: workspace.createdAt || Date.now() },
    selectedKnowledgeBaseIds: Array.isArray(workspace.selectedKnowledgeBaseIds) ? workspace.selectedKnowledgeBaseIds : (workspace.knowledgeScope?.resolvedBaseIds || []),
    selectedKnowledgeItemIds: Array.isArray(workspace.selectedKnowledgeItemIds) ? workspace.selectedKnowledgeItemIds : [],
    attachmentIds: Array.isArray(workspace.attachmentIds) ? workspace.attachmentIds : [],
    assetIds: Array.isArray(workspace.assetIds) ? workspace.assetIds : [],
    updatedAt: workspace.updatedAt || workspace.createdAt || Date.now()
  }));
  parsed.aiConversations = parsed.aiConversations.map((conversation) => ({
    ...conversation,
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    selectedKnowledgeBaseIds: Array.isArray(conversation.selectedKnowledgeBaseIds) ? conversation.selectedKnowledgeBaseIds : [],
    selectedKnowledgeItemIds: Array.isArray(conversation.selectedKnowledgeItemIds) ? conversation.selectedKnowledgeItemIds : [],
    attachments: Array.isArray(conversation.attachments) ? conversation.attachments : [],
    imageIds: Array.isArray(conversation.imageIds) ? conversation.imageIds : []
  }));
  parsed.settings = { ...defaults.settings, ...(parsed.settings || {}) };
  parsed.settings.members = Array.isArray(parsed.settings.members) && parsed.settings.members.length
    ? parsed.settings.members.map((member, index) => ({
      id: member.id || "MEMBER-" + String(index + 1).padStart(3, "0"),
      name: String(member.name || "未命名成员").trim(),
      email: String(member.email || "").trim(),
      role: member.role || "内容运营",
      status: ["active", "invited", "disabled"].includes(member.status) ? member.status : "active",
      lastLoginAt: member.lastLoginAt || null,
      createdAt: member.createdAt || Date.now()
    }))
    : isPrivateBlankSeed ? [] : cloneData(defaults.settings.members);
  parsed.settings.operationLogs = Array.isArray(parsed.settings.operationLogs) && parsed.settings.operationLogs.length
    ? parsed.settings.operationLogs.map((entry, index) => ({
      id: entry.id || "LOG-" + String(index + 1).padStart(3, "0"),
      occurredAt: entry.occurredAt || Date.now(),
      category: entry.category || "系统操作",
      actor: entry.actor || "系统",
      detail: entry.detail || "已完成一项配置更新"
    }))
    : isPrivateBlankSeed ? [] : cloneData(defaults.settings.operationLogs);
  parsed.monitoring = { ...defaults.monitoring, ...(parsed.monitoring || {}) };
  ["platforms", "sources", "questions", "customQueries", "trackedWorks", "tasks", "trend"].forEach((key) => {
    if (!Array.isArray(parsed.monitoring[key])) parsed.monitoring[key] = cloneData(defaults.monitoring[key] || []);
  });
  const isLegacyDemoQuestion = (question) => /^SAMPLE-00[1-4]$/.test(String(question?.id || ""));
  const legacyDemoWorkTitles = new Set([
    "企业官网为什么是 GEO 运营的长期信源？",
    "工业品企业如何搭建可持续的 GEO 内容体系？",
    "选择 GEO 服务商时需要重点判断哪些能力？"
  ]);
  const hadLegacyMonitoringDemo = parsed.monitoring.demo === true
    || parsed.monitoring.questions.some(isLegacyDemoQuestion);
  parsed.monitoring.questions = parsed.monitoring.questions.filter((question) => !isLegacyDemoQuestion(question));
  parsed.monitoring.tasks = parsed.monitoring.tasks.filter((task) => task.id !== "MON-202607-01");
  parsed.monitoring.trackedWorks = parsed.monitoring.trackedWorks.filter((work) => work.articleId || !legacyDemoWorkTitles.has(work.title));
  if (hadLegacyMonitoringDemo) {
    parsed.monitoring.lastRunAt = null;
    parsed.monitoring.metrics = {};
    parsed.monitoring.trend = [];
    parsed.monitoring.platforms = [];
    parsed.monitoring.sources = [];
  }
  parsed.monitoring.demo = false;
  parsed.monitoring.queryBindings = Array.isArray(parsed.monitoring.queryBindings) ? parsed.monitoring.queryBindings : [];
  parsed.monitoring.sources = parsed.monitoring.sources.map((source, index) => ({
    ...source,
    id: source.id || "SOURCE-" + String(index + 1).padStart(3, "0"),
    domain: source.domain || "unknown.local"
  }));
  parsed.monitoring.trackedWorks = parsed.monitoring.trackedWorks.map((work, index) => ({
    ...work,
    id: work.id || "WORK-" + String(index + 1).padStart(3, "0"),
    sourceDomain: work.sourceDomain || (String(work.site || "").includes("知乎") ? "zhihu.com" : String(work.site || "").includes("公众号") ? "mp.weixin.qq.com" : "tongzhuo.com"),
    url: work.url || "",
    publications: Array.isArray(work.publications) ? work.publications : [],
    autoTracked: work.autoTracked !== false,
    status: work.status || (Number(work.citations) ? "success" : "queued"),
    questionIds: Array.isArray(work.questionIds) ? work.questionIds : [],
    createdAt: work.createdAt || Date.now(),
    updatedAt: work.updatedAt || work.createdAt || Date.now()
  }));

  const defaultAgents = new Map(defaults.writingAgents.map((agent) => [agent.id, agent]));
  if (!Array.isArray(parsed.writingAgents)) parsed.writingAgents = cloneData(defaults.writingAgents);
  parsed.writingAgents = parsed.writingAgents.map((agent) => {
    const fallback = defaultAgents.get(agent.id) || {};
    const migrateBuiltinPrompt = Boolean(fallback.builtIn && Number(agent.geoPromptVersion || 0) < 2);
    return {
      ...fallback,
      ...agent,
      systemPrompt: migrateBuiltinPrompt ? fallback.systemPrompt : (agent.systemPrompt || fallback.systemPrompt || ""),
      geoPromptVersion: Number(agent.geoPromptVersion || fallback.geoPromptVersion) || 1,
      status: agent.status || fallback.status || "active",
      businessLineIds: Array.isArray(agent.businessLineIds) ? agent.businessLineIds : (fallback.businessLineIds || []),
      contentTypes: Array.isArray(agent.contentTypes) ? agent.contentTypes : (fallback.contentTypes || ["深度文章"]),
      structure: Array.isArray(agent.structure) ? agent.structure : (fallback.structure || []),
      preferredKnowledgeBaseIds: Array.isArray(agent.preferredKnowledgeBaseIds) ? agent.preferredKnowledgeBaseIds : (fallback.preferredKnowledgeBaseIds || []),
      version: migrateBuiltinPrompt ? (Number(fallback.version) || 1) : (Number(agent.version || fallback.version) || 1)
    };
  });
  defaults.writingAgents.forEach((agent) => {
    if ((!isPrivateBlankSeed || agent.builtIn) && !parsed.writingAgents.some((item) => item.id === agent.id)) parsed.writingAgents.push(cloneData(agent));
  });

  const defaultLines = new Map(defaults.businessLines.map((line) => [line.id, line]));
  parsed.businessLines = parsed.businessLines.map((line) => ({
    ...line,
    status: line.status || "active",
    knowledgeBaseIds: Array.isArray(line.knowledgeBaseIds)
      ? line.knowledgeBaseIds
      : (defaultLines.get(line.id)?.knowledgeBaseIds || []),
    defaultWritingAgentId: line.defaultWritingAgentId || defaultLines.get(line.id)?.defaultWritingAgentId || parsed.settings.defaultWritingAgentId
  }));
  if (Array.isArray(parsed.monitoring?.tasks)) {
    parsed.monitoring.tasks = parsed.monitoring.tasks.map((task) => {
      const line = parsed.businessLines.find((item) => item.id === task.businessLineId || item.name === task.business);
      return { ...task, businessLineId: task.businessLineId || line?.id || null, businessNameSnapshot: task.businessNameSnapshot || task.business || line?.name || "" };
    });
  }

  const defaultPlans = new Map(defaults.contentPlans.map((plan) => [plan.id, plan]));
  parsed.contentPlans = parsed.contentPlans.map((plan) => {
    const defaultScope = defaultPlans.get(plan.id)?.knowledgeScope;
    const line = parsed.businessLines.find((item) => item.id === plan.businessLineId);
    const inheritedBaseIds = [
      ...parsed.knowledgeBases.filter((base) => base.scope === "enterprise" && base.isDefault).map((base) => base.id),
      ...(line?.knowledgeBaseIds || [])
    ];
    const knowledgeScope = plan.knowledgeScope && Array.isArray(plan.knowledgeScope.resolvedBaseIds)
      ? plan.knowledgeScope
      : defaultScope || {
        inheritedBaseIds,
        addedBaseIds: [],
        excludedBaseIds: [],
        resolvedBaseIds: inheritedBaseIds,
        snapshottedAt: new Date(plan.createdAt || Date.now()).toISOString()
      };
    const agentId = plan.writingAgentId || line?.defaultWritingAgentId || parsed.settings.defaultWritingAgentId;
    const agent = parsed.writingAgents.find((item) => item.id === agentId) || parsed.writingAgents.find((item) => item.id === parsed.settings.defaultWritingAgentId);
    const snapshot = plan.writingAgentSnapshot || createWritingAgentSnapshot(agent, {
      modelName: parsed.settings.model,
      selectedAt: new Date(plan.createdAt || Date.now()).toISOString(),
      selectionSource: "migration_default",
      lockedAt: plan.status === "produced" ? new Date(plan.createdAt || Date.now()).toISOString() : null
    });
    const topicIds = [...new Set((Array.isArray(plan.topicIds) ? plan.topicIds : []).filter(Boolean))];
    const savedTopicSnapshots = Array.isArray(plan.topicSnapshots) ? plan.topicSnapshots.filter((topic) => topic && topic.id) : [];
    const topicSnapshots = topicIds.map((topicId) => savedTopicSnapshots.find((topic) => topic.id === topicId) || parsed.topics.find((topic) => topic.id === topicId)).filter(Boolean).map((topic) => cloneData(topic));
    const completeTopicIds = [...new Set([...topicIds, ...topicSnapshots.map((topic) => topic.id)])];
    return {
      ...plan,
      topicIds: completeTopicIds,
      topicSnapshots,
      articleIds: [...new Set((Array.isArray(plan.articleIds) ? plan.articleIds : []).filter(Boolean))],
      knowledgeScope,
      writingAgentId: snapshot?.agentId || agentId || null,
      writingAgentVersion: snapshot?.version || null,
      writingAgentSnapshot: snapshot
    };
  });

  const defaultArticles = new Map(defaults.articles.map((article) => [article.id, article]));
  parsed.articles = parsed.articles.map((article) => {
    const fallback = defaultArticles.get(article.id);
    const shouldBackfillDemoEvidence = Number(parsed.schemaVersion || 0) < 10 && article.reviewStatus === "pending" && !(article.citations || []).length && (fallback?.citations || []).length;
    const citations = shouldBackfillDemoEvidence ? cloneData(fallback.citations) : Array.isArray(article.citations) ? article.citations : (fallback?.citations || []);
    const plan = parsed.contentPlans.find((item) => item.id === article.planId);
    let generationSnapshot = article.generationSnapshot === undefined ? (fallback?.generationSnapshot || null) : article.generationSnapshot;
    let writingAgentSnapshot = generationSnapshot?.writingAgent || null;
    if (generationSnapshot && !writingAgentSnapshot) {
      const line = parsed.businessLines.find((item) => item.id === (article.businessLineId || generationSnapshot.businessLineId));
      const agentId = article.writingAgentId || plan?.writingAgentId || line?.defaultWritingAgentId || parsed.settings.defaultWritingAgentId;
      const agent = parsed.writingAgents.find((item) => item.id === agentId);
      writingAgentSnapshot = cloneData(plan?.writingAgentSnapshot) || createWritingAgentSnapshot(agent, {
        modelName: parsed.settings.model,
        selectedAt: generationSnapshot.generatedAt || new Date(article.updatedAt || Date.now()).toISOString(),
        selectionSource: "migration_default",
        lockedAt: generationSnapshot.generatedAt || new Date(article.updatedAt || Date.now()).toISOString()
      });
      generationSnapshot = { ...generationSnapshot, writingAgent: writingAgentSnapshot };
    }
    const topicSnapshot = generationSnapshot?.topicSnapshot || article.topicSnapshot || plan?.topicSnapshots?.find((topic) => topic.id === article.topicId) || parsed.topics.find((topic) => topic.id === article.topicId) || null;
    if (generationSnapshot && topicSnapshot && !generationSnapshot.topicSnapshot) generationSnapshot = { ...generationSnapshot, topicSnapshot: cloneData(topicSnapshot) };
    if (generationSnapshot && topicSnapshot) {
      const topicBrief = generationSnapshot.topicBrief || topicSnapshot.geoBrief || buildGeoTopicBrief(topicSnapshot, topicSnapshot.questionSnapshot);
      const snapshotCitations = parsed.knowledgeCitations.filter((citation) => citation.articleId === article.id && citations.includes(citation.id));
      const outputContract = generationSnapshot.outputContract || buildGeoOutputContract({ ...topicSnapshot, geoBrief: topicBrief }, snapshotCitations, writingAgentSnapshot, { contentType: plan?.contentType || article.category });
      const geoQuality = generationSnapshot.geoQuality || article.geoQuality || evaluateGeoArticleQuality(article.content, { ...topicSnapshot, geoBrief: topicBrief }, snapshotCitations);
      generationSnapshot = {
        ...generationSnapshot,
        topicBrief: cloneData(topicBrief),
        outputContract,
        geoQuality,
        promptTemplate: generationSnapshot.promptTemplate || buildGeoArticlePrompt({ ...topicSnapshot, geoBrief: topicBrief }, snapshotCitations, writingAgentSnapshot, { contentType: plan?.contentType || article.category, outputContract })
      };
    }
    if (generationSnapshot && writingAgentSnapshot && generationSnapshot.model?.promptVersion === "企业内容写作 v4") {
      generationSnapshot = { ...generationSnapshot, model: { ...generationSnapshot.model, promptVersion: writingAgentSnapshot.nameSnapshot + " v" + writingAgentSnapshot.version } };
    }
    return {
      ...article,
      showPublicCitationMarkers: article.showPublicCitationMarkers === true,
      reviewStage: article.reviewStage || (article.reviewStatus === "approved" ? "ready_to_publish" : "draft"),
      reviewSubmittedAt: article.reviewSubmittedAt || null,
      reviewSubmittedBy: article.reviewSubmittedBy || null,
      reviewNote: article.reviewNote || "",
      reviewedAt: article.reviewedAt || null,
      reviewedBy: article.reviewedBy || null,
      sources: citations.length ? citations.length : article.sources,
      citations,
      versions: Array.isArray(article.versions) ? article.versions : [],
      knowledgeSnapshot: shouldBackfillDemoEvidence ? cloneData(fallback?.knowledgeSnapshot || null) : article.knowledgeSnapshot === undefined ? (fallback?.knowledgeSnapshot || null) : article.knowledgeSnapshot,
      generationSnapshot,
      topicSnapshot: article.topicSnapshot || (generationSnapshot?.topicSnapshot ? cloneData(generationSnapshot.topicSnapshot) : (topicSnapshot ? cloneData(topicSnapshot) : null)),
      geoQuality: article.geoQuality || generationSnapshot?.geoQuality || null,
      writingAgentId: writingAgentSnapshot?.agentId || article.writingAgentId || null,
      writingAgentVersion: writingAgentSnapshot?.version || article.writingAgentVersion || null,
      writingAgentNameSnapshot: writingAgentSnapshot?.nameSnapshot || article.writingAgentNameSnapshot || null,
      knowledgeStatus: shouldBackfillDemoEvidence ? cloneData(fallback?.knowledgeStatus || article.knowledgeStatus) : article.knowledgeStatus || fallback?.knowledgeStatus || {
        state: "legacy_unmapped",
        availableItems: 0,
        evidenceCount: 0,
        supportedClaims: 0,
        conflictCount: 0,
        gapCount: 0,
        message: "历史演示文章尚未建立可追溯知识快照。"
      }
    };
  });

  parsed.publishSchedules = parsed.publishSchedules.map((schedule) => ({
    ...schedule,
    status: schedule.status || "scheduled",
    articleIds: Array.isArray(schedule.articleIds) ? schedule.articleIds : [],
    platforms: Array.isArray(schedule.platforms) ? schedule.platforms : [],
    items: Array.isArray(schedule.items) ? schedule.items : [],
    intervalMinutes: Number(schedule.intervalMinutes) || 10,
    expectedCompletionAt: schedule.expectedCompletionAt || schedule.items?.at?.(-1)?.completesAt || schedule.items?.at?.(-1)?.scheduledAt || null,
    createdAt: schedule.createdAt || Date.now()
  }));
  parsed.schemaVersion = 15;
  return parsed;
}

// ---- 前移自 shell/publisher：初始化链依赖，避免跨文件前向引用 ----
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function currentUserName() {
  const user = window.__TZ_AUTH__?.user;
  return user?.displayName || user?.name || user?.username || "";
}

function loadState() {
  try {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      for (const key of LEGACY_STORAGE_KEYS) {
        saved = localStorage.getItem(key);
        if (saved) break;
      }
    }
    if (!saved) return migrateState(cloneDefaultState());
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.articles) || !Array.isArray(parsed.topics)) return migrateState(cloneDefaultState());
    const migrated = migrateState(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return migrateState(cloneDefaultState());
  }
}

let state = loadState();
let workspaceRevision = 0;
let workspaceSyncReady = false;
let workspaceSyncTimer = null;
let workspaceSyncChain = Promise.resolve();
let workspaceChangeCounter = 0;
let siteCmsRuntime = {
  loaded: false,
  loading: false,
  saving: false,
  publishing: false,
  rollingBack: false,
  localDirty: false,
  draft: null,
  publication: null,
  releases: [],
  leads: [],
  lastSnapshotJson: "",
  error: ""
};
let knowledgeAssetRuntime = {
  loaded: false,
  loading: false,
  uploading: false,
  uploadProgress: null,
  items: [],
  error: ""
};
let siteCmsSyncTimer = null;
let siteCmsSyncChain = Promise.resolve();
