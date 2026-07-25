"use strict";

const STORAGE_KEY = "tongzhuo-geo-platform-demo-v11";
const LEGACY_STORAGE_KEYS = ["tongzhuo-geo-platform-demo-v10", "tongzhuo-geo-platform-demo-v9", "tongzhuo-geo-platform-demo-v8", "tongzhuo-geo-platform-demo-v7", "tongzhuo-geo-platform-demo-v6"];

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
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  log: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};

const PAGE_META = {
  dashboard: { title: "工作台", description: "今天需要处理的事项和系统运行状态" },
  planning: { title: "选题中心", description: "维护业务线关键词，把客户问题转为选题和内容计划" },
  content: { title: "内容生产", description: "生成、编辑、审核并冻结可发布文章版本" },
  publish: { title: "发布运营", description: "选择账号组，统一管理官网和内容平台发布" },
  assets: { title: "内容资产", description: "统一管理文章版本、官网主信源、多平台分发和后续引用分析" },
  monitoring: { title: "效果监测", description: "持续观察品牌在 AI 回答中的提及、排名与引用" },
  site: { title: "官网运营", description: "管理企业官网展示、内容引用与咨询线索" },
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

function scoreTo100(value, fallback = 72) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function contentGapScore(coverage) {
  if (coverage === "未覆盖") return 100;
  if (coverage === "部分覆盖") return 60;
  if (coverage === "已覆盖") return 20;
  return 80;
}

function buildQuestionScoreBreakdown(question = {}) {
  const quality = question.quality || {};
  const stored = question.scoreBreakdown || {};
  const duplicateRiskValue = question.duplicateRisk ?? quality.duplicateRisk;
  const nonRepeat = duplicateRiskValue == null ? scoreTo100(stored.nonRepeat, 88) : 100 - scoreTo100(duplicateRiskValue, 12);
  return {
    askability: scoreTo100(question.askability ?? quality.askability ?? stored.askability, 82),
    businessRelevance: scoreTo100(question.businessRelevance ?? quality.businessRelevance ?? stored.businessRelevance ?? question.business, 78),
    specificity: scoreTo100(question.specificity ?? quality.specificity ?? stored.specificity, 72),
    commercialValue: scoreTo100(question.commercialValue ?? question.business_score ?? stored.commercialValue ?? question.business, 72),
    evidenceReadiness: scoreTo100(question.evidenceReadiness ?? quality.evidenceReadiness ?? stored.evidenceReadiness, 68),
    contentGap: scoreTo100(question.contentGap ?? contentGapScore(question.coverage), 80),
    nonRepeat
  };
}

function calculateQuestionPriorityScore(question = {}) {
  const breakdown = buildQuestionScoreBreakdown(question);
  return Math.round(Object.entries(QUESTION_SCORE_WEIGHTS).reduce((total, [key, weight]) => total + breakdown[key] * weight, 0));
}

function applyQuestionPriorityScore(question = {}) {
  const modelRecommendation = question.modelRecommendation ?? question.recommendation;
  const scoreBreakdown = buildQuestionScoreBreakdown(question);
  const priorityScore = Math.round(Object.entries(QUESTION_SCORE_WEIGHTS).reduce((total, [key, weight]) => total + scoreBreakdown[key] * weight, 0));
  return { ...question, modelRecommendation, scoreBreakdown, priorityScore, recommendation: priorityScore };
}

const QUESTION_VARIANTS = {
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
  "51cto": { name: "51CTO", short: "51", logoClass: "generic" },
  imooc: { name: "慕课网", short: "慕", logoClass: "generic" },
  oschina: { name: "开源中国", short: "开", logoClass: "generic" },
  segmentfault: { name: "SegmentFault", short: "S", logoClass: "generic" },
  sohufocus: { name: "搜狐焦点", short: "焦", logoClass: "sohu" },
  x: { name: "X（Twitter）", short: "X", logoClass: "generic" },
  eastmoney: { name: "东方财富", short: "东", logoClass: "generic" },
  smzdm: { name: "什么值得买", short: "值", logoClass: "generic" }
});

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
  { id: "51cto", category: "self_media", role: "51CTO", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "imooc", category: "self_media", role: "慕课网", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "oschina", category: "self_media", role: "开源中国", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "segmentfault", category: "self_media", role: "SegmentFault", enabled: true, support: "manual", accountMode: "local", capabilities: "技术长文", description: "已接入本地账号和任务队列，需人工确认发布", requiresManualConfirmation: true },
  { id: "cnblogs", category: "self_media", role: "博客园", enabled: true, support: "manual", accountMode: "local", capabilities: "长文", description: "已接入本地账号和任务队列，需在编辑器人工确认", requiresManualConfirmation: true },
  { id: "sohufocus", category: "self_media", role: "搜狐焦点（规划中）", enabled: false, support: "planned", accountMode: "local", capabilities: "图文", description: "平台目录已保留，暂不进入发布选择", requiresManualConfirmation: true },
  { id: "x", category: "self_media", role: "X（Twitter）（规划中）", enabled: false, support: "planned", accountMode: "local", capabilities: "短内容", description: "平台目录已保留，暂不进入发布选择", requiresManualConfirmation: true },
  { id: "eastmoney", category: "self_media", role: "东方财富（规划中）", enabled: false, support: "planned", accountMode: "local", capabilities: "财经内容", description: "平台目录已保留，暂不进入发布选择", requiresManualConfirmation: true },
  { id: "smzdm", category: "self_media", role: "什么值得买（规划中）", enabled: false, support: "planned", accountMode: "local", capabilities: "图文", description: "平台目录已保留，暂不进入发布选择", requiresManualConfirmation: true },
  { id: "netease", category: "self_media", role: "网易号（规划中）", enabled: false, support: "planned", accountMode: "local", capabilities: "图文", description: "平台目录已保留，暂不进入发布选择", requiresManualConfirmation: true }
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

const STATUS_META = {
  draft: ["草稿", "status-draft"],
  pending_review: ["待审核", "status-review"],
  approved: ["已通过", "status-approved"],
  published: ["已发布", "status-success"],
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
    schemaVersion: 12,
    businessLines: [
      { id: "BL-GEO", name: "GEO 优化服务", product: "企业 GEO 优化与运营", audience: "工业品、制造业及中小企业", scenario: "AI 搜索品牌发现与内容信源建设", knowledgeBaseIds: ["KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], defaultWritingAgentId: "WA-GEO-DEEP", status: "active", createdAt: minutesAgo(4320) },
      { id: "BL-VIDEO", name: "短视频获客运营", product: "企业短视频获客运营", audience: "需要持续获取销售线索的企业", scenario: "账号定位、内容策划与线索承接", knowledgeBaseIds: [], defaultWritingAgentId: "WA-BRAND-STORY", status: "active", createdAt: minutesAgo(4300) },
      { id: "BL-AI", name: "企业 AI 落地", product: "企业知识与 AI 应用", audience: "希望将 AI 接入业务流程的企业", scenario: "知识库、业务助手与流程提效", knowledgeBaseIds: [], defaultWritingAgentId: "WA-FAQ", status: "active", createdAt: minutesAgo(4280) }
    ],
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
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：围绕采购目标、比较维度、公开证据和验收标准输出决策指南；不直接给无依据的榜单或唯一推荐，必须说明适合谁、不适合谁以及如何核验。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: ["KB-GEO-001", "KB-CASE-001"], modelMode: "inherit", creativity: 0.3, minWords: 1400, maxWords: 2200, version: 3, usageCount: 4, createdBy: "王宁", createdAt: minutesAgo(8640), updatedAt: minutesAgo(360)
      },
      {
        id: "WA-BRAND-STORY", name: "品牌口吻编辑", description: "沿用企业语气，把业务事实组织成自然、有温度的品牌叙事。", avatar: "品", color: "rose", builtIn: false, status: "active",
        businessLineIds: ["BL-VIDEO"], contentTypes: ["深度文章", "案例解读"], template: "story", role: "企业品牌内容编辑", audience: "客户、合作伙伴与行业从业者", tone: "真诚、自然、有温度", style: "场景开篇 · 品牌视角 · 事实落点", structure: ["真实场景", "企业观察", "解决过程", "行动邀请"], required: "品牌表达必须落到已审核的产品、服务或案例事实。", banned: "不得使用空洞口号或虚构品牌故事。", cta: "用自然邀请结束，不强行推销。",
        systemPrompt: GEO_AGENT_PROMPT_FOUNDATION + "\n\n专属任务：可以从真实业务场景切入，但叙事必须回到企业主体、服务范围和公开证据；不得虚构人物、故事、客户反馈或结果。", geoPromptVersion: 2, strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: [], modelMode: "inherit", creativity: 0.5, minWords: 1000, maxWords: 1800, version: 2, usageCount: 3, createdBy: "李晨", createdAt: minutesAgo(5760), updatedAt: minutesAgo(720)
      }
    ],
    keywords: [
      { id: "KW-001", businessLineId: "BL-GEO", term: "工业品 GEO 优化", type: "种子词", source: "企业资料", status: "active", createdAt: minutesAgo(3000) },
      { id: "KW-002", businessLineId: "BL-GEO", term: "制造业 AI 搜索", type: "种子词", source: "手动添加", status: "active", createdAt: minutesAgo(2920) },
      { id: "KW-003", businessLineId: "BL-GEO", term: "GEO 服务商选择", type: "拓展词", source: "GEORank", status: "active", createdAt: minutesAgo(1430) },
      { id: "KW-004", businessLineId: "BL-GEO", term: "AI 搜索效果评估", type: "拓展词", source: "监测回流", status: "active", createdAt: minutesAgo(800) },
      { id: "KW-005", businessLineId: "BL-VIDEO", term: "短视频获客", type: "种子词", source: "企业资料", status: "active", createdAt: minutesAgo(2920) },
      { id: "KW-006", businessLineId: "BL-VIDEO", term: "工业品短视频运营", type: "拓展词", source: "手动添加", status: "active", createdAt: minutesAgo(1800) },
      { id: "KW-007", businessLineId: "BL-AI", term: "企业 AI 落地", type: "种子词", source: "企业资料", status: "active", createdAt: minutesAgo(1430) },
      { id: "KW-008", businessLineId: "BL-AI", term: "企业知识库建设", type: "拓展词", source: "GEORank", status: "active", createdAt: minutesAgo(920) }
    ],
    keywordPacks: [
      { id: "KP-202607-04", businessLineId: "BL-GEO", title: "工业品 GEO 优化", seeds: ["工业品GEO优化", "制造业AI搜索"], source: "手动拓展", total: 8, createdAt: minutesAgo(36) },
      { id: "KP-202607-03", businessLineId: "BL-AI", title: "企业 AI 落地", seeds: ["企业AI落地"], source: "企业资料", total: 6, createdAt: minutesAgo(1430) },
      { id: "KP-202607-02", businessLineId: "BL-VIDEO", title: "短视频获客", seeds: ["短视频获客"], source: "手动拓展", total: 8, createdAt: minutesAgo(2920) }
    ],
    questionLibrary: [
      { id: "Q-041", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "工业品 GEO 优化", question: "工业品企业如何做 GEO 优化？", dimension: "question", intent: "方案了解", stage: "方案评估", coverage: "未覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-041", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-042", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "制造业 AI 搜索", question: "制造业 AI 搜索优化应该从官网还是内容平台开始？", dimension: "technical", intent: "方案对比", stage: "方案评估", coverage: "部分覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-042", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-043", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "GEO 服务商选择", question: "选择 GEO 服务商时需要重点判断哪些能力？", dimension: "commercial", intent: "服务采购", stage: "供应商筛选", coverage: "未覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-043", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-044", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "山东 GEO 公司推荐", question: "山东企业选择本地 GEO 服务团队有哪些优势？", dimension: "ranking", intent: "品牌发现", stage: "供应商筛选", coverage: "未覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-044", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-045", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "GEO 和 SEO 区别", question: "GEO 与 SEO 的目标、内容和衡量方式有什么不同？", dimension: "semantic", intent: "概念认知", stage: "需求认知", coverage: "已覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-045", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-046", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "AI 搜索效果评估", question: "企业应如何判断 GEO 项目是否正在产生真实价值？", dimension: "review", intent: "效果评估", stage: "效果复盘", coverage: "部分覆盖", source: "监测回流", status: "active", topicId: "TOP-046", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-047", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "桐灼科技 GEO", question: "桐灼科技如何为制造企业落地 GEO 运营？", dimension: "brand", intent: "品牌了解", stage: "品牌核验", coverage: "未覆盖", source: "手动添加", status: "active", topicId: "TOP-047", selected: false, createdAt: minutesAgo(36) },
      { id: "Q-048", packId: "KP-202607-04", businessLineId: "BL-GEO", sourceKeyword: "工业品采购决策内容", question: "工业品采购决策链中，哪些内容最值得企业长期沉淀？", dimension: "scenario", intent: "场景分析", stage: "需求认知", coverage: "未覆盖", source: "GEORank 拓展", status: "active", topicId: "TOP-048", selected: false, createdAt: minutesAgo(36) }
    ],
    topics: [
      { id: "TOP-041", packId: "KP-202607-04", keyword: "工业品企业如何做 GEO 优化", title: "工业品企业如何搭建可持续的 GEO 内容体系？", dimension: "question", intent: "方案了解", recommendation: 94, business: 88, coverage: "未覆盖", reason: "客户在评估方案前常见的完整路径问题", selected: false },
      { id: "TOP-042", packId: "KP-202607-04", keyword: "制造业 AI 搜索优化方案", title: "制造业 AI 搜索优化应该从官网还是内容平台开始？", dimension: "technical", intent: "方案对比", recommendation: 91, business: 93, coverage: "部分覆盖", reason: "具有明确的实施顺序和采购判断意图", selected: false },
      { id: "TOP-043", packId: "KP-202607-04", keyword: "GEO 服务商怎么选", title: "选择 GEO 服务商时需要重点判断哪些能力？", dimension: "commercial", intent: "服务采购", recommendation: 89, business: 96, coverage: "未覆盖", reason: "处于服务商筛选阶段，商业意图较强", selected: false },
      { id: "TOP-044", packId: "KP-202607-04", keyword: "山东 GEO 公司推荐", title: "山东企业选择本地 GEO 服务团队有哪些优势？", dimension: "ranking", intent: "品牌发现", recommendation: 86, business: 91, coverage: "未覆盖", reason: "适合建立区域服务与企业实体关联", selected: false },
      { id: "TOP-045", packId: "KP-202607-04", keyword: "GEO 和 SEO 区别", title: "GEO 与 SEO 的目标、内容和衡量方式有什么不同？", dimension: "semantic", intent: "概念认知", recommendation: 83, business: 64, coverage: "已覆盖", reason: "基础认知问题，可支撑主题权威度", selected: false },
      { id: "TOP-046", packId: "KP-202607-04", keyword: "GEO 优化效果评测", title: "企业应如何判断 GEO 项目是否正在产生真实价值？", dimension: "review", intent: "效果评估", recommendation: 88, business: 84, coverage: "部分覆盖", reason: "回应客户对交付可信度与衡量边界的关注", selected: false },
      { id: "TOP-047", packId: "KP-202607-04", keyword: "桐灼科技 GEO", title: "桐灼科技如何为制造企业落地 GEO 运营？", dimension: "brand", intent: "品牌了解", recommendation: 82, business: 79, coverage: "未覆盖", reason: "建立品牌、服务能力与目标客户之间的关联", selected: false },
      { id: "TOP-048", packId: "KP-202607-04", keyword: "工业品采购决策内容", title: "工业品采购决策链中，哪些内容最值得企业长期沉淀？", dimension: "scenario", intent: "场景分析", recommendation: 87, business: 77, coverage: "未覆盖", reason: "覆盖销售、技术与采购共同参与的决策场景", selected: false }
    ],
    contentPlans: [
      { id: "PLAN-202607-01", name: "7 月 GEO 方法论内容计划", businessLineId: "BL-GEO", topicIds: ["TOP-041"], scheduledFor: "2026-07-24", owner: "王宁", contentType: "深度文章", knowledgeScope: { inheritedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], snapshottedAt: "2026-07-22T10:20:00+08:00" }, status: "produced", articleIds: ["ART-202607-031"], createdAt: minutesAgo(2880) },
      { id: "PLAN-202607-02", name: "制造业 AI 搜索专题", businessLineId: "BL-GEO", topicIds: ["TOP-042", "TOP-046"], scheduledFor: "2026-07-29", owner: "李晨", contentType: "系列文章", knowledgeScope: { inheritedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], snapshottedAt: "2026-07-22T22:00:00+08:00" }, status: "planned", articleIds: [], createdAt: minutesAgo(720) },
      { id: "PLAN-202607-03", name: "区域品牌发现内容", businessLineId: "BL-GEO", topicIds: ["TOP-044"], scheduledFor: "2026-08-03", owner: "王宁", contentType: "问答文章", knowledgeScope: { inheritedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"], snapshottedAt: "2026-07-23T07:00:00+08:00" }, status: "draft", articleIds: [], createdAt: minutesAgo(180) }
    ],
    articles: [
      {
        id: "ART-202607-031",
        title: "工业品企业如何搭建可持续的 GEO 内容体系？",
        topicId: "TOP-041",
        planId: "PLAN-202607-01",
        businessLineId: "BL-GEO",
        status: "draft",
        reviewStatus: "approved",
        version: "v2",
        author: "王宁",
        category: "GEO 方法论",
        riskStatus: "clean",
        sources: 6,
        citations: ["CIT-ART031-K1", "CIT-ART031-K2", "CIT-ART031-K3", "CIT-ART031-K4", "CIT-ART031-K5", "CIT-ART031-K6"],
        knowledgeSnapshot: {
          id: "KS-ART031-V2",
          capturedAt: "2026-07-22T10:30:00+08:00",
          enterpriseBaseIds: ["KB-CORP-001"],
          businessLineBaseIds: ["KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"],
          addedBaseIds: [],
          excludedBaseIds: [],
          resolvedBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"],
          lockedVersionIds: ["KV-CORP-002-V3", "KV-GEO-001-V4", "KV-CASE-001-V2", "KV-CASE-002-V1", "KV-FAQ-001-V3", "KV-FAQ-002-V2"],
          citationIds: ["CIT-ART031-K1", "CIT-ART031-K2", "CIT-ART031-K3", "CIT-ART031-K4", "CIT-ART031-K5", "CIT-ART031-K6"],
          gapIds: ["KG-ART031-PRICE", "KG-ART031-LEADTIME"]
        },
        generationSnapshot: {
          id: "GS-ART031-V2",
          generatedAt: "2026-07-22T10:30:00+08:00",
          generatedBy: "AI 内容助手",
          topicId: "TOP-041",
          planId: "PLAN-202607-01",
          businessLineId: "BL-GEO",
          model: { name: "DeepSeek V3（演示）", promptVersion: "GEO 深度文章专家 v1" },
          retrieval: {
            strategy: "rag",
            query: "工业品企业如何搭建可持续的 GEO 内容体系",
            topK: 12,
            minScore: 0.62,
            approvedItems: 8,
            retrievedChunks: 8,
            usedCitations: 6
          },
          knowledgeBaseIds: ["KB-CORP-001", "KB-GEO-001", "KB-CASE-001", "KB-FAQ-001"],
          citationIds: ["CIT-ART031-K1", "CIT-ART031-K2", "CIT-ART031-K3", "CIT-ART031-K4", "CIT-ART031-K5", "CIT-ART031-K6"],
          omittedFields: ["price", "delivery_cycle"],
          instruction: "价格与交付周期缺少已审核证据，不生成具体数字或保证性承诺。",
          fingerprint: "demo-kb-20260722-art031-v2"
        },
        knowledgeStatus: {
          state: "ready_with_omissions",
          availableItems: 8,
          evidenceCount: 6,
          supportedClaims: 6,
          conflictCount: 0,
          gapCount: 2,
          message: "6 条事实已有证据；价格与交付周期因缺少知识而省略。"
        },
        updatedAt: minutesAgo(22),
        keywords: ["工业品GEO", "企业内容体系", "AI搜索"],
        excerpt: "围绕真实产品、采购问题和企业证据，建立可以持续积累的内容生产与发布闭环。",
        content: "<p>工业品企业做 GEO，难点通常不在于偶尔写出一篇文章，而在于能否把真实业务知识持续转化为可信、清晰、可复用的内容资产。</p><h2>一、先建立唯一可信的企业知识</h2><p>产品参数、应用场景、典型案例、服务边界和常见问题应由企业资料统一维护。写作与官网展示引用同一份事实，才能避免不同渠道出现相互矛盾的表述。</p><h2>二、围绕客户决策问题策划内容</h2><p>选题不应只追逐宽泛热词。需要从采购、技术、使用和服务场景中找到客户真正会提问的问题，并明确每篇内容要回答什么。</p><h2>三、审核后再进入多平台发布</h2><p>文章通过事实与风险审核后冻结版本，再交给官网和本地发布助手。每个平台独立执行并回写结果，避免一个平台失败影响其他渠道。</p>"
      },
      {
        id: "ART-202607-030",
        title: "选择 GEO 服务商时需要重点判断哪些能力？",
        topicId: "TOP-043",
        planId: null,
        businessLineId: "BL-GEO",
        status: "draft",
        reviewStatus: "pending",
        version: "v1",
        author: "AI 内容助手",
        category: "采购指南",
        riskStatus: "clean",
        sources: 2,
        citations: ["CIT-ART030-K1", "CIT-ART030-K2"],
        knowledgeSnapshot: {
          id: "KS-ART030-V1",
          capturedAt: "2026-07-22T15:40:00+08:00",
          frozenAt: null,
          enterpriseBaseIds: ["KB-CORP-001"],
          businessLineBaseIds: ["KB-GEO-001"],
          resolvedBaseIds: ["KB-CORP-001", "KB-GEO-001"],
          lockedVersionIds: ["KV-CORP-002-V3", "KV-GEO-001-V4"],
          citationIds: ["CIT-ART030-K1", "CIT-ART030-K2"],
          gapIds: []
        },
        generationSnapshot: null,
        knowledgeStatus: { state: "ready", availableItems: 2, evidenceCount: 2, supportedClaims: 2, conflictCount: 0, gapCount: 0, message: "2 条企业事实已经映射，等待人工审核冻结。" },
        updatedAt: minutesAgo(48),
        keywords: ["GEO服务商", "服务商选择", "GEO能力"],
        excerpt: "从企业知识、内容生产、官网信源和长期运营四个方面判断 GEO 服务能力。",
        content: "<p>企业选择 GEO 服务团队时，首先要确认对方是否真正理解业务，而不是只提供一组抽象指标。</p><h2>判断一：能否整理真实企业知识</h2><p>可靠的内容必须来自产品、案例、交付流程与服务边界。服务商应能建立清晰的资料校验机制。</p><h2>判断二：能否形成日常运营闭环</h2><p>从选题、写作、审核到官网及内容平台发布，每一步都需要可追踪、可复核。</p>"
      },
      {
        id: "ART-202607-029",
        title: "GEO 与 SEO 的目标、内容和衡量方式有什么不同？",
        topicId: "TOP-045",
        planId: null,
        businessLineId: "BL-GEO",
        status: "draft",
        reviewStatus: "pending",
        version: "v3",
        author: "李晨",
        category: "基础知识",
        riskStatus: "warning",
        sources: 4,
        citations: [],
        knowledgeSnapshot: null,
        generationSnapshot: null,
        knowledgeStatus: { state: "legacy_unmapped", availableItems: 0, evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "历史演示文章尚未建立可追溯知识快照。" },
        updatedAt: minutesAgo(116),
        keywords: ["GEO", "SEO", "AI搜索"],
        excerpt: "从用户决策路径、内容组织和结果验证三个角度理解 GEO 与 SEO 的关系。",
        content: "<p>SEO 与 GEO 并不是互相替代的两件事。两者都依赖清晰、可信并可被检索的企业信息，但面向的结果形态不同。</p><h2>共同基础</h2><p>稳定的官网、可理解的页面结构和真实的企业证据，是两种优化都不能绕开的基础。</p>"
      },
      {
        id: "ART-202607-027",
        title: "企业官网为什么是 GEO 运营的长期信源？",
        topicId: null,
        planId: null,
        businessLineId: "BL-GEO",
        status: "published",
        reviewStatus: "approved",
        version: "v2",
        author: "王宁",
        category: "官网建设",
        riskStatus: "clean",
        sources: 7,
        citations: [],
        knowledgeSnapshot: null,
        generationSnapshot: null,
        knowledgeStatus: { state: "legacy_unmapped", availableItems: 0, evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "历史演示文章尚未建立可追溯知识快照。" },
        updatedAt: minutesAgo(1580),
        keywords: ["企业官网", "GEO信源", "企业知识"],
        excerpt: "企业官网是企业可持续控制、持续更新并建立实体一致性的核心公开信源。",
        content: "<p>企业官网不仅是展示页面，也是企业能够长期控制、持续校正的公开知识载体。</p>"
      }
    ],
    publishTasks: [
      {
        id: "PUB-202607-012",
        articleId: "ART-202607-027",
        articleTitle: "企业官网为什么是 GEO 运营的长期信源？",
        version: "v2",
        groupId: "group-main",
        groupName: "品牌主账号组",
        status: "partial",
        createdAt: minutesAgo(1510),
        targets: {
          web: { status: "success", account: "www.tongzhuo.com", remoteUrl: "https://example.com/insights/geo-source", updatedAt: minutesAgo(1508) },
          wechat: { status: "success", account: "桐灼科技", remoteUrl: "https://example.com/wechat/geo-source", updatedAt: minutesAgo(1504) },
          zhihu: { status: "success", account: "桐灼科技", remoteUrl: "https://example.com/zhihu/geo-source", updatedAt: minutesAgo(1501) },
          toutiao: { status: "result_unknown", account: "桐灼科技", remoteUrl: "", updatedAt: minutesAgo(1499) }
        },
        logs: [
          { time: "昨天 09:12", platform: "企业官网", message: "发布成功，已返回页面地址" },
          { time: "昨天 09:15", platform: "微信公众号", message: "发布成功，已写入远端文章 ID" },
          { time: "昨天 09:18", platform: "知乎", message: "发布成功，已返回文章地址" },
          { time: "昨天 09:20", platform: "头条号", message: "提交后连接中断，需要在本地确认结果" }
        ]
      }
    ],
    publishSchedules: [],
    accountGroups: [
      {
        id: "group-main",
        name: "品牌主账号组",
        deviceId: "DEV-01",
        deviceName: "运营部电脑 · GEO-OPS-01",
        updatedAt: minutesAgo(1),
        accounts: {
          wechat: { name: "桐灼科技", status: "online" },
          zhihu: { name: "桐灼科技", status: "online" },
          toutiao: { name: "桐灼科技", status: "online" }
        }
      },
      {
        id: "group-industry",
        name: "工业服务账号组",
        deviceId: "DEV-01",
        deviceName: "运营部电脑 · GEO-OPS-01",
        updatedAt: minutesAgo(6),
        accounts: {
          wechat: { name: "桐灼工业增长", status: "online" },
          zhihu: { name: "桐灼工业增长", status: "needs_login" },
          toutiao: { name: "工业增长观察", status: "online" }
        }
      }
    ],
    site: {
      domain: "www.tongzhuo.com",
      status: "online",
      theme: "桐灼企业官网 · 标准版",
      pages: 9,
      articles: 28,
      leads: 6,
      lastDiagnostic: "2026-07-18 14:30",
      diagnosticStatus: "正常",
      cms: {
        settings: {
          siteName: "桐灼科技",
          companyName: "桐灼（淄博）网络科技有限公司",
          description: "桐灼科技专注 GEO 优化、短视频获客运营与企业 AI 落地，持续建设企业公开信源。",
          allowAiCrawl: true,
          updatedAt: "2026-07-24T09:20:00.000Z"
        },
        pages: [
          { id: "home", type: "首页", title: "首页", path: "/", status: "published", description: "企业定位、核心服务、案例与咨询入口", seoDescription: "桐灼科技为企业提供 GEO 优化、内容运营与 AI 落地服务。", schemaEnabled: true, sitemapEnabled: true, version: 3, savedAt: "2026-07-24T09:20:00.000Z", publishedAt: "2026-07-24T09:20:00.000Z", versions: [{ version: 2, title: "首页", path: "/", description: "企业定位、核心服务、案例与咨询入口", seoDescription: "桐灼科技为企业提供 GEO 优化、内容运营与 AI 落地服务。", savedAt: "2026-07-16T09:20:00.000Z", note: "首页信源结构更新" }] },
          { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", description: "企业主体、团队与发展信息", seoDescription: "了解桐灼科技的企业主体、团队与服务理念。", schemaEnabled: true, sitemapEnabled: true, version: 2, savedAt: "2026-07-21T09:20:00.000Z", publishedAt: "2026-07-21T09:20:00.000Z", versions: [] },
          { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", description: "服务能力、适用对象与交付边界", seoDescription: "查看桐灼科技的 GEO 优化、内容运营与 AI 落地服务。", schemaEnabled: true, sitemapEnabled: true, version: 2, savedAt: "2026-07-21T09:20:00.000Z", publishedAt: "2026-07-21T09:20:00.000Z", versions: [] },
          { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", description: "经过审核的客户案例与实施结果", seoDescription: "查看企业 GEO 与内容运营服务案例。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-19T09:20:00.000Z", publishedAt: "2026-07-19T09:20:00.000Z", versions: [] },
          { id: "faq", type: "FAQ 页", title: "常见问题", path: "/faq/", status: "draft", description: "高频问题、直接答案与引用依据", seoDescription: "企业 GEO 服务常见问题与直接答案。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-24T09:20:00.000Z", publishedAt: null, versions: [] },
          { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", description: "客户自定义栏目下的公开文章", seoDescription: "桐灼科技行业资讯、方法和案例文章。", schemaEnabled: true, sitemapEnabled: true, version: 3, savedAt: "2026-07-23T09:20:00.000Z", publishedAt: "2026-07-23T09:20:00.000Z", versions: [] },
          { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", description: "咨询表单、服务区域与联系方式", seoDescription: "联系桐灼科技，预约业务诊断。", schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: "2026-07-19T09:20:00.000Z", publishedAt: "2026-07-19T09:20:00.000Z", versions: [] },
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
          { id: "nav-about", label: "关于我们", path: "/about/", type: "固定页面", visible: true },
          { id: "nav-contact", label: "联系我们", path: "/contact/", type: "固定页面", visible: true }
        ],
        theme: { name: "桐灼企业官网 · 标准版", primaryColor: "#1D5CFF", cta: "预约业务诊断", version: 1, updatedAt: "2026-07-24T09:20:00.000Z" },
        leads: [
          { id: "LEAD-001", name: "李先生", company: "山东某机械制造企业", service: "GEO 优化服务", createdAt: "今天 10:06", sourcePage: "服务页", status: "new", owner: "王宁", nextFollowAt: "今天 16:00", notes: "客户关注制造业 AI 搜索场景。", history: [] },
          { id: "LEAD-002", name: "刘经理", company: "淄博某新材料公司", service: "企业 AI 落地", createdAt: "昨天 16:34", sourcePage: "服务页", status: "contacted", owner: "王宁", nextFollowAt: "2026-07-25 10:00", notes: "已电话沟通，待补充现有资料。", history: [{ at: "昨天 17:10", note: "完成首次电话沟通", status: "contacted" }] },
          { id: "LEAD-003", name: "张总", company: "济南某工业设备企业", service: "官网 + GEO", createdAt: "7月20日", sourcePage: "首页", status: "qualified", owner: "张敏", nextFollowAt: "2026-07-28 14:00", notes: "已确认需求，等待方案沟通。", history: [{ at: "7月21日", note: "判断为有效商机", status: "qualified" }] },
          { id: "LEAD-004", name: "王工", company: "山东某自动化企业", service: "内容运营", createdAt: "7月19日", sourcePage: "行业资讯", status: "new", owner: "王宁", nextFollowAt: "2026-07-25 14:00", notes: "通过行业文章表单提交咨询。", history: [] },
          { id: "LEAD-005", name: "陈经理", company: "青岛某设备企业", service: "GEO 优化服务", createdAt: "7月18日", sourcePage: "专题页", status: "new", owner: "王宁", nextFollowAt: "2026-07-26 10:00", notes: "需要先了解服务边界。", history: [] },
          { id: "LEAD-006", name: "赵总", company: "潍坊某制造企业", service: "企业 AI 落地", createdAt: "7月17日", sourcePage: "联系我们", status: "contacted", owner: "张敏", nextFollowAt: "2026-07-29 10:00", notes: "已发送资料清单。", history: [] }
        ],
        redirects: [],
        deployment: { mode: "独立服务器", environment: "production", rootPath: "/var/www/tongzhuo-site", branch: "main", status: "online", lastDeployAt: "2026-07-24 09:20", lastTestAt: "2026-07-24 09:25", updatedAt: "2026-07-24T09:20:00.000Z" }
      }
    },
    enterpriseProfile: {
      completion: 86,
      companyName: "桐灼（淄博）网络科技有限公司",
      brandName: "桐灼科技",
      officialDomain: "www.tongzhuo.com",
      industryRegion: "企业服务 · 山东淄博",
      introduction: "面向工业品、制造业和中小企业，提供 GEO 优化、短视频获客运营与企业 AI 落地服务。",
      primaryService: "企业 GEO 优化服务",
      serviceDescription: "围绕企业知识、官网信源、内容生产、多平台发布和效果复盘建立持续运营闭环。",
      audience: "工业品、制造业及需要建立长期公开信源的中小企业",
      serviceArea: "全国",
      steps: [
        { id: "basic", label: "企业基本资料", status: "complete" },
        { id: "products", label: "产品与服务", status: "complete" },
        { id: "audience", label: "目标客户与区域", status: "complete" },
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
    knowledgeItems: [
      { id: "KI-CORP-001", knowledgeBaseId: "KB-CORP-001", kind: "document", title: "桐灼科技企业介绍", category: "企业档案", status: "approved", visibility: "public", latestVersionId: "KV-CORP-001-V2", tags: ["企业介绍", "服务区域"] },
      { id: "KI-CORP-002", knowledgeBaseId: "KB-CORP-001", kind: "document", title: "GEO 服务定位与承诺边界", category: "产品服务", status: "approved", visibility: "public", latestVersionId: "KV-CORP-002-V3", tags: ["GEO服务", "服务边界"] },
      { id: "KI-GEO-001", knowledgeBaseId: "KB-GEO-001", kind: "document", title: "GEO 运营标准流程", category: "产品服务", status: "approved", visibility: "public", latestVersionId: "KV-GEO-001-V4", tags: ["交付流程", "企业知识"] },
      { id: "KI-GEO-002", knowledgeBaseId: "KB-GEO-001", kind: "document", title: "文章审核与多平台发布规范", category: "交付规范", status: "approved", visibility: "internal", latestVersionId: "KV-GEO-002-V2", tags: ["审核", "发布"] },
      { id: "KI-CASE-001", knowledgeBaseId: "KB-CASE-001", kind: "document", title: "山东工业设备企业知识统一案例", category: "案例", status: "approved", visibility: "public", latestVersionId: "KV-CASE-001-V2", tags: ["工业设备", "知识库"] },
      { id: "KI-CASE-002", knowledgeBaseId: "KB-CASE-001", kind: "document", title: "制造业客户决策问题拆分案例", category: "案例", status: "approved", visibility: "public", latestVersionId: "KV-CASE-002-V1", tags: ["制造业", "内容计划"] },
      { id: "KI-FAQ-001", knowledgeBaseId: "KB-FAQ-001", kind: "qa", title: "工业品企业做 GEO 应从哪里开始？", question: "工业品企业做 GEO 应从哪里开始？", category: "FAQ", status: "approved", visibility: "public", latestVersionId: "KV-FAQ-001-V3", tags: ["启动", "企业知识"] },
      { id: "KI-FAQ-002", knowledgeBaseId: "KB-FAQ-001", kind: "qa", title: "同一篇文章怎样安全发布到多个平台？", question: "同一篇文章怎样安全发布到多个平台？", category: "FAQ", status: "approved", visibility: "public", latestVersionId: "KV-FAQ-002-V2", tags: ["审核", "多平台发布"] }
    ],
    knowledgeVersions: [
      {
        id: "KV-CORP-001-V2",
        itemId: "KI-CORP-001",
        version: 2,
        reviewStatus: "approved",
        reviewedBy: "王宁",
        reviewedAt: "2026-07-22T09:42:00+08:00",
        content: "桐灼科技面向工业品、制造业及中小企业，提供企业 GEO 优化、短视频获客运营与企业 AI 落地服务，服务区域为全国。",
        chunks: [{ id: "KC-CORP-001-01", section: "企业简介", text: "桐灼科技面向工业品、制造业及中小企业，提供企业 GEO 优化、短视频获客运营与企业 AI 落地服务，服务区域为全国。" }]
      },
      {
        id: "KV-CORP-002-V3",
        itemId: "KI-CORP-002",
        version: 3,
        reviewStatus: "approved",
        reviewedBy: "王宁",
        reviewedAt: "2026-07-22T10:05:00+08:00",
        content: "GEO 服务围绕企业知识整理、官网信源建设、内容生产、多平台发布和效果复盘形成持续运营闭环；不承诺固定排名或确定性收录结果。",
        chunks: [
          { id: "KC-CORP-002-01", section: "服务定位", text: "GEO 服务围绕企业知识整理、官网信源建设、内容生产、多平台发布和效果复盘形成持续运营闭环。" },
          { id: "KC-CORP-002-02", section: "承诺边界", text: "不承诺固定排名或确定性收录结果。" }
        ]
      },
      {
        id: "KV-GEO-001-V4",
        itemId: "KI-GEO-001",
        version: 4,
        reviewStatus: "approved",
        reviewedBy: "李晨",
        reviewedAt: "2026-07-22T10:14:00+08:00",
        content: "项目首先核对企业档案、产品服务、案例、FAQ 与公开边界，再基于客户真实问题建立问题词库、选题库和内容计划。",
        chunks: [{ id: "KC-GEO-001-01", section: "启动流程", text: "项目首先核对企业档案、产品服务、案例、FAQ 与公开边界，再基于客户真实问题建立问题词库、选题库和内容计划。" }]
      },
      {
        id: "KV-GEO-002-V2",
        itemId: "KI-GEO-002",
        version: 2,
        reviewStatus: "approved",
        reviewedBy: "李晨",
        reviewedAt: "2026-07-22T10:18:00+08:00",
        content: "文章只调用已审核知识；通过事实审核与内容风控后冻结版本，再由官网或本地发布助手创建各平台独立任务。",
        chunks: [{ id: "KC-GEO-002-01", section: "审核发布", text: "文章只调用已审核知识；通过事实审核与内容风控后冻结版本，再由官网或本地发布助手创建各平台独立任务。" }]
      },
      {
        id: "KV-CASE-001-V2",
        itemId: "KI-CASE-001",
        version: 2,
        reviewStatus: "approved",
        reviewedBy: "王宁",
        reviewedAt: "2026-07-21T16:20:00+08:00",
        content: "为一家山东工业设备企业梳理产品参数、应用场景和售后问答，建立业务线知识包后，官网与内容平台统一引用同一版本资料。",
        chunks: [{ id: "KC-CASE-001-01", section: "实施结果", text: "为一家山东工业设备企业梳理产品参数、应用场景和售后问答，建立业务线知识包后，官网与内容平台统一引用同一版本资料。" }]
      },
      {
        id: "KV-CASE-002-V1",
        itemId: "KI-CASE-002",
        version: 1,
        reviewStatus: "approved",
        reviewedBy: "王宁",
        reviewedAt: "2026-07-21T17:10:00+08:00",
        content: "在制造业项目中，采购、技术和使用人员关注的问题不同，内容计划按决策阶段拆分，并将监测未覆盖问题回流选题中心。",
        chunks: [{ id: "KC-CASE-002-01", section: "选题方法", text: "采购、技术和使用人员关注的问题不同，内容计划按决策阶段拆分，并将监测未覆盖问题回流选题中心。" }]
      },
      {
        id: "KV-FAQ-001-V3",
        itemId: "KI-FAQ-001",
        version: 3,
        reviewStatus: "approved",
        reviewedBy: "李晨",
        reviewedAt: "2026-07-22T09:58:00+08:00",
        content: "先统一企业介绍、产品参数、应用场景、案例、服务边界和常见问答，再围绕采购与技术人员会提出的问题策划内容。",
        chunks: [{ id: "KC-FAQ-001-01", section: "标准答案", text: "先统一企业介绍、产品参数、应用场景、案例、服务边界和常见问答，再围绕采购与技术人员会提出的问题策划内容。" }]
      },
      {
        id: "KV-FAQ-002-V2",
        itemId: "KI-FAQ-002",
        version: 2,
        reviewStatus: "approved",
        reviewedBy: "李晨",
        reviewedAt: "2026-07-22T10:02:00+08:00",
        content: "文章审核通过并冻结版本后，按平台分别创建发布任务；一个平台失败不会改变其他平台任务或已冻结正文。",
        chunks: [{ id: "KC-FAQ-002-01", section: "标准答案", text: "文章审核通过并冻结版本后，按平台分别创建发布任务；一个平台失败不会改变其他平台任务或已冻结正文。" }]
      }
    ],
    knowledgeGaps: [
      { id: "KG-ART031-PRICE", articleId: "ART-202607-031", businessLineId: "BL-GEO", field: "price", label: "标准报价", reason: "当前已审核知识没有统一对外报价。", status: "open", severity: "blocking", generationPolicy: "omit" },
      { id: "KG-ART031-LEADTIME", articleId: "ART-202607-031", businessLineId: "BL-GEO", field: "delivery_cycle", label: "交付周期", reason: "当前已审核知识没有可统一对外引用的交付周期。", status: "open", severity: "blocking", generationPolicy: "omit" }
    ],
    knowledgeCitations: [
      { id: "CIT-ART031-K1", articleId: "ART-202607-031", articleVersion: "v2", marker: "K1", paragraphId: "p-intro", knowledgeBaseId: "KB-CORP-001", itemId: "KI-CORP-002", versionId: "KV-CORP-002-V3", chunkId: "KC-CORP-002-01", claim: "GEO 是持续运营闭环", quote: "GEO 服务围绕企业知识整理、官网信源建设、内容生产、多平台发布和效果复盘形成持续运营闭环。", supportStatus: "supported" },
      { id: "CIT-ART031-K2", articleId: "ART-202607-031", articleVersion: "v2", marker: "K2", paragraphId: "p-knowledge", knowledgeBaseId: "KB-GEO-001", itemId: "KI-GEO-001", versionId: "KV-GEO-001-V4", chunkId: "KC-GEO-001-01", claim: "内容生产前需统一企业知识", quote: "项目首先核对企业档案、产品服务、案例、FAQ 与公开边界。", supportStatus: "supported" },
      { id: "CIT-ART031-K3", articleId: "ART-202607-031", articleVersion: "v2", marker: "K3", paragraphId: "p-knowledge", knowledgeBaseId: "KB-CASE-001", itemId: "KI-CASE-001", versionId: "KV-CASE-001-V2", chunkId: "KC-CASE-001-01", claim: "多渠道使用同一事实版本", quote: "建立业务线知识包后，官网与内容平台统一引用同一版本资料。", supportStatus: "supported" },
      { id: "CIT-ART031-K4", articleId: "ART-202607-031", articleVersion: "v2", marker: "K4", paragraphId: "p-topic", knowledgeBaseId: "KB-CASE-001", itemId: "KI-CASE-002", versionId: "KV-CASE-002-V1", chunkId: "KC-CASE-002-01", claim: "选题应覆盖不同决策角色的问题", quote: "采购、技术和使用人员关注的问题不同，内容计划按决策阶段拆分。", supportStatus: "supported" },
      { id: "CIT-ART031-K5", articleId: "ART-202607-031", articleVersion: "v2", marker: "K5", paragraphId: "p-topic", knowledgeBaseId: "KB-FAQ-001", itemId: "KI-FAQ-001", versionId: "KV-FAQ-001-V3", chunkId: "KC-FAQ-001-01", claim: "围绕真实客户问题策划内容", quote: "再围绕采购与技术人员会提出的问题策划内容。", supportStatus: "supported" },
      { id: "CIT-ART031-K6", articleId: "ART-202607-031", articleVersion: "v2", marker: "K6", paragraphId: "p-publish", knowledgeBaseId: "KB-FAQ-001", itemId: "KI-FAQ-002", versionId: "KV-FAQ-002-V2", chunkId: "KC-FAQ-002-01", claim: "审核冻结后按平台独立发布", quote: "文章审核通过并冻结版本后，按平台分别创建发布任务。", supportStatus: "supported" },
      { id: "CIT-ART030-K1", articleId: "ART-202607-030", articleVersion: "v1", marker: "K1", paragraphId: "p-intro", knowledgeBaseId: "KB-CORP-001", itemId: "KI-CORP-002", versionId: "KV-CORP-002-V3", chunkId: "KC-CORP-002-01", claim: "GEO 服务需要完整运营闭环", quote: "GEO 服务围绕企业知识整理、官网信源建设、内容生产、多平台发布和效果复盘形成持续运营闭环。", supportStatus: "supported", status: "needs_review" },
      { id: "CIT-ART030-K2", articleId: "ART-202607-030", articleVersion: "v1", marker: "K2", paragraphId: "p-knowledge", knowledgeBaseId: "KB-GEO-001", itemId: "KI-GEO-001", versionId: "KV-GEO-001-V4", chunkId: "KC-GEO-001-01", claim: "服务前需要核对企业事实", quote: "项目首先核对企业档案、产品服务、案例、FAQ 与公开边界。", supportStatus: "supported", status: "needs_review" }
    ],
    writingWorkspaces: [],
    aiConversations: [],
    contentAssets: [
      { id: "ASSET-KB-GEO-01", kind: "knowledge_image", name: "企业 GEO 运营闭环", mime: "image/svg+xml", knowledgeBaseId: "KB-GEO-001", itemId: "KI-GEO-001", versionId: "KV-GEO-001-V4", reviewStatus: "approved", license: "企业自有", altText: "企业知识、内容生产、多平台发布和效果复盘组成的 GEO 运营闭环", caption: "GEO 运营闭环示意", accent: "blue", createdAt: minutesAgo(720) },
      { id: "ASSET-KB-CASE-01", kind: "knowledge_image", name: "制造业内容决策链", mime: "image/svg+xml", knowledgeBaseId: "KB-CASE-001", itemId: "KI-CASE-002", versionId: "KV-CASE-002-V1", reviewStatus: "approved", license: "企业自有", altText: "采购、技术和使用人员参与内容决策的角色关系图", caption: "制造业客户决策角色", accent: "violet", createdAt: minutesAgo(680) },
      { id: "ASSET-KB-FAQ-01", kind: "knowledge_image", name: "多平台发布流程", mime: "image/svg+xml", knowledgeBaseId: "KB-FAQ-001", itemId: "KI-FAQ-002", versionId: "KV-FAQ-002-V2", reviewStatus: "approved", license: "企业自有", altText: "文章审核冻结后分别创建官网和内容平台发布任务", caption: "审核冻结与多平台发布", accent: "teal", createdAt: minutesAgo(620) }
    ],
    knowledge: {
      profile: { count: 1, reviewed: 1, updated: "今天 09:42" },
      products: { count: 3, reviewed: 3, updated: "昨天 16:20" },
      cases: { count: 8, reviewed: 7, updated: "昨天 11:08" },
      faq: { count: 24, reviewed: 22, updated: "7月20日" },
      documents: { count: 36, reviewed: 34, updated: "今天 10:14" },
      images: { count: 128, reviewed: 128, updated: "昨天 18:45" },
      adLaw: { count: 126, reviewed: 126, updated: "7月19日" },
      sensitive: { count: 34, reviewed: 34, updated: "7月20日" },
      banned: { count: 8, reviewed: 8, updated: "昨天 16:40" }
    },
    monitoring: {
      demo: true,
      lastRunAt: minutesAgo(47),
      metrics: {
        questions: 36,
        totalSamples: 18,
        validSamples: 15,
        mentions: 7,
        recommendations: 3,
        officialCitations: 2,
        mentionRate: 46.7,
        averageRank: 3.8,
        citedWorks: 7,
        citations: 29,
        sentimentPositive: 72
      },
      trend: [
        { label: "06/23", mention: 28, rank: 6.2 },
        { label: "06/28", mention: 31, rank: 5.7 },
        { label: "07/03", mention: 35, rank: 5.1 },
        { label: "07/08", mention: 34, rank: 4.8 },
        { label: "07/13", mention: 39, rank: 4.3 },
        { label: "07/18", mention: 41, rank: 4.0 },
        { label: "07/22", mention: 46.7, rank: 3.8 }
      ],
      platforms: [
        { id: "deepseek", name: "DeepSeek", questions: 8, valid: 3, mentions: 2, recommended: 1, officialCitations: 1, mentionRate: 66.7, averageRank: 3.1, status: "success" },
        { id: "doubao", name: "豆包", questions: 8, valid: 3, mentions: 2, recommended: 1, officialCitations: 0, mentionRate: 66.7, averageRank: 3.7, status: "success" },
        { id: "qwen", name: "通义千问", questions: 8, valid: 3, mentions: 1, recommended: 0, officialCitations: 1, mentionRate: 33.3, averageRank: 4.0, status: "success" },
        { id: "kimi", name: "Kimi", questions: 8, valid: 3, mentions: 1, recommended: 1, officialCitations: 0, mentionRate: 33.3, averageRank: 4.2, status: "success" },
        { id: "wenxin", name: "文心一言", questions: 8, valid: 3, mentions: 1, recommended: 0, officialCitations: 0, mentionRate: 33.3, averageRank: 4.3, status: "success" }
      ],
      sources: [
        { domain: "tongzhuo.com", name: "桐灼企业官网", type: "企业官网", works: 5, questions: 14, citations: 18 },
        { domain: "zhihu.com", name: "知乎文章", type: "内容平台", works: 3, questions: 7, citations: 8 },
        { domain: "mp.weixin.qq.com", name: "微信公众号", type: "内容平台", works: 2, questions: 3, citations: 3 }
      ],
      questions: [
        { id: "SAMPLE-001", question: "工业品企业如何做 GEO 优化？", type: "方案了解", platform: "DeepSeek", model: "DeepSeek Chat（演示）", entrance: "网页对话", mentioned: true, recommended: true, rank: 2, sentiment: "正面", sources: 2, checkedAt: minutesAgo(47), response: "工业品企业开展 GEO，通常要先整理产品、场景、案例和服务边界，再围绕采购与技术人员的真实问题持续生产内容。可关注桐灼科技等提供企业知识、官网信源与内容运营一体化服务的团队，并结合企业自身行业验证方案。", sourceUrls: ["https://www.tongzhuo.com/insights/geo-source", "https://www.zhihu.com/question/demo-answer"] },
        { id: "SAMPLE-002", question: "山东有哪些可靠的 GEO 服务团队？", type: "品牌发现", platform: "豆包", model: "豆包通用模型（演示）", entrance: "网页对话", mentioned: true, recommended: false, rank: 4, sentiment: "中性", sources: 1, checkedAt: minutesAgo(49), response: "选择山东本地 GEO 服务团队时，可以比较企业知识整理、官网建设、内容审核及多平台运营能力。桐灼科技是可进一步了解的服务团队之一，实际选择仍应核验案例、服务边界与交付方式。", sourceUrls: ["https://www.tongzhuo.com/services/geo"] },
        { id: "SAMPLE-003", question: "GEO 和 SEO 的主要区别是什么？", type: "概念认知", platform: "通义千问", model: "通义千问（演示）", entrance: "网页对话", mentioned: false, recommended: false, rank: null, sentiment: "未提及", sources: 0, checkedAt: minutesAgo(52), response: "SEO 主要提升网页在搜索结果中的可发现性，GEO 更关注企业事实与内容是否能被生成式 AI 理解、引用并用于回答。两者都依赖稳定的网站、清晰结构和可信内容。", sourceUrls: [] },
        { id: "SAMPLE-004", question: "制造业 AI 搜索优化从哪里开始？", type: "技术方案", platform: "Kimi", model: "Kimi（演示）", entrance: "网页对话", mentioned: true, recommended: true, rank: 5, sentiment: "正面", sources: 1, checkedAt: minutesAgo(55), response: "建议从统一企业资料和官网公开信源开始，再建立客户问题集、内容生产与发布流程。桐灼科技提出的企业知识到多端发布闭环可以作为一种实施思路，但需要按企业实际资料质量持续校验。", sourceUrls: ["https://www.tongzhuo.com/insights/manufacturing-ai-search"] }
      ],
      trackedWorks: [
        { title: "企业官网为什么是 GEO 运营的长期信源？", site: "桐灼企业官网", type: "官网", citedDays: 8, questions: 6, citations: 12, status: "success" },
        { title: "工业品企业如何搭建可持续的 GEO 内容体系？", site: "微信公众号", type: "公众号", citedDays: 3, questions: 2, citations: 4, status: "success" },
        { title: "选择 GEO 服务商时需要重点判断哪些能力？", site: "知乎", type: "内容平台", citedDays: 0, questions: 0, citations: 0, status: "queued" }
      ],
      tasks: [
        { id: "MON-202607-01", name: "桐灼品牌常规监测", businessLineId: "BL-GEO", business: "GEO 优化服务", businessNameSnapshot: "GEO 优化服务", platforms: ["DeepSeek", "豆包", "通义千问", "Kimi", "文心一言"], questionCount: 36, status: "success", createdAt: minutesAgo(1440), lastRunAt: minutesAgo(47), totalSamples: 18, validSamples: 15 }
      ]
    },
    settings: {
      model: "DeepSeek V3",
      imageModel: "通义万相",
      modelProviderId: "",
      imageProviderId: "",
      defaultWritingAgentId: "WA-GEO-DEEP",
      riskGate: true,
      manualReview: true,
      tenant: "桐灼科技",
      deployment: "独立服务器",
      members: [
        { id: "MEMBER-001", name: "王宁", email: "wangning@tongzhuo.com", role: "管理员", status: "active", lastLoginAt: minutesAgo(22), createdAt: minutesAgo(43200) },
        { id: "MEMBER-002", name: "李晨", email: "lichen@tongzhuo.com", role: "内容运营", status: "active", lastLoginAt: minutesAgo(960), createdAt: minutesAgo(20160) }
      ],
      operationLogs: [
        { id: "LOG-001", occurredAt: minutesAgo(18), category: "文章审核", actor: "王宁", detail: "通过文章 ART-202607-031 的 v2 版本" },
        { id: "LOG-002", occurredAt: minutesAgo(46), category: "知识同步", actor: "系统", detail: "知识资料完成分块与索引更新" },
        { id: "LOG-003", occurredAt: minutesAgo(59), category: "设备心跳", actor: "GEO-OPS-01", detail: "同步 2 个账号组、6 个平台账号" },
        { id: "LOG-004", occurredAt: minutesAgo(1500), category: "发布异常", actor: "本地发布助手", detail: "头条号目标进入结果待核验，未自动重试" }
      ]
    }
  };
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState()));
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
  const previousSchemaVersion = Number(parsed.schemaVersion || 0);
  if (!parsed.site || typeof parsed.site !== "object") parsed.site = cloneData(defaults.site);
  parsed.site = { ...defaults.site, ...parsed.site };
  const savedCms = parsed.site.cms && typeof parsed.site.cms === "object" ? parsed.site.cms : {};
  const defaultCms = defaults.site.cms;
  parsed.site.cms = {
    ...cloneData(defaultCms),
    ...savedCms,
    settings: { ...cloneData(defaultCms.settings), ...(savedCms.settings || {}) },
    pages: Array.isArray(savedCms.pages) ? savedCms.pages : cloneData(defaultCms.pages),
    modules: savedCms.modules && typeof savedCms.modules === "object" ? savedCms.modules : cloneData(defaultCms.modules),
    categories: Array.isArray(savedCms.categories) ? savedCms.categories : cloneData(defaultCms.categories),
    navItems: Array.isArray(savedCms.navItems) ? savedCms.navItems : cloneData(defaultCms.navItems),
    theme: { ...cloneData(defaultCms.theme), ...(savedCms.theme || {}) },
    leads: Array.isArray(savedCms.leads) ? savedCms.leads : cloneData(defaultCms.leads),
    redirects: Array.isArray(savedCms.redirects) ? savedCms.redirects : cloneData(defaultCms.redirects),
    deployment: { ...cloneData(defaultCms.deployment), ...(savedCms.deployment || {}) }
  };
  parsed.site.cms.pages = parsed.site.cms.pages.map((page) => ({
    schemaEnabled: true,
    sitemapEnabled: true,
    version: 1,
    versions: [],
    savedAt: new Date().toISOString(),
    publishedAt: page.status === "published" ? new Date().toISOString() : null,
    seoDescription: page.description || "",
    ...page,
    versions: Array.isArray(page.versions) ? page.versions : []
  }));
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
  defaults.knowledgeCitations.forEach((citation) => {
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
  parsed.questionLibrary = parsed.questionLibrary.map((question) => applyQuestionPriorityScore({
    ...buildGeoQuestionIntent(question),
    ...question,
    status: question.status || "active",
    version: Number(question.version) || 1,
    selected: question.status === "archived" ? false : Boolean(question.selected),
    createdAt: question.createdAt || Date.now(),
    updatedAt: question.updatedAt || question.createdAt || Date.now(),
    geoIntent: { ...buildGeoQuestionIntent(question), ...(question.geoIntent || {}) }
  }));
  parsed.topics = (Array.isArray(parsed.topics) ? parsed.topics : defaults.topics).map((topic) => {
    const sourceQuestion = parsed.questionLibrary.find((question) => question.id === topic.questionId || question.topicId === topic.id);
    return {
      ...topic,
      status: topic.status || "active",
      version: Number(topic.version) || 1,
      selected: topic.status === "archived" ? false : Boolean(topic.selected),
      createdAt: topic.createdAt || Date.now(),
      updatedAt: topic.updatedAt || topic.createdAt || Date.now(),
      questionSnapshot: topic.questionSnapshot || (sourceQuestion ? cloneData(sourceQuestion) : null),
      geoBrief: { ...buildGeoTopicBrief(topic, sourceQuestion), ...(topic.geoBrief || {}) }
    };
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
    : cloneData(defaults.settings.members);
  parsed.settings.operationLogs = Array.isArray(parsed.settings.operationLogs) && parsed.settings.operationLogs.length
    ? parsed.settings.operationLogs.map((entry, index) => ({
      id: entry.id || "LOG-" + String(index + 1).padStart(3, "0"),
      occurredAt: entry.occurredAt || Date.now(),
      category: entry.category || "系统操作",
      actor: entry.actor || "系统",
      detail: entry.detail || "已完成一项配置更新"
    }))
    : cloneData(defaults.settings.operationLogs);
  parsed.monitoring = { ...defaults.monitoring, ...(parsed.monitoring || {}) };
  ["platforms", "sources", "questions", "customQueries", "trackedWorks", "tasks", "trend"].forEach((key) => {
    if (!Array.isArray(parsed.monitoring[key])) parsed.monitoring[key] = cloneData(defaults.monitoring[key] || []);
  });
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
    if (!parsed.writingAgents.some((item) => item.id === agent.id)) parsed.writingAgents.push(cloneData(agent));
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
  parsed.schemaVersion = 12;
  return parsed;
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

const PUBLISH_PLATFORM_ALIASES = { wechat: "wechat_mp", baijia: "baijiahao", blog: "cnblogs", tiktok: "douyin" };
const PUBLISH_PLATFORM_REVERSE_ALIASES = Object.fromEntries(Object.entries(PUBLISH_PLATFORM_ALIASES).map(([from, to]) => [to, from]));
let publisherSnapshot = { loaded: false, devices: [], accountGroups: [], sessions: [], jobs: [], platforms: [], readyPlatformIds: [], selectablePlatformIds: [], manualConfirmationPlatformIds: [], error: "" };
let aiProviderSnapshot = { loaded: false, loading: false, providers: [], error: "" };

function canonicalPublishPlatformId(platformId) {
  const value = String(platformId || "").trim();
  return PUBLISH_PLATFORM_ALIASES[value] || value;
}

function uiPublishPlatformId(platformId) {
  const value = String(platformId || "").trim();
  return PUBLISH_PLATFORM_REVERSE_ALIASES[value] || value;
}

function publisherStoredAccount(group, platformId) {
  if (!group) return null;
  const canonical = canonicalPublishPlatformId(platformId);
  return group.accounts?.[platformId] || group.accounts?.[canonical] || null;
}

function publisherSessionGroupId(session = {}) {
  const explicitGroupId = String(session?.meta?.group_id || session?.group_id || "").trim();
  if (explicitGroupId) return explicitGroupId;
  const profileKey = String(session?.profile_key || "").trim();
  const separator = profileKey.lastIndexOf("--");
  return separator > 0 ? profileKey.slice(0, separator) : "";
}

function publisherSessionUpdatedAt(session = {}) {
  const value = Date.parse(session?.updated_at || session?.last_verified_at || "");
  return Number.isFinite(value) ? value : 0;
}

function publisherSessionForGroup(group, platformId) {
  if (!group) return null;
  const canonical = canonicalPublishPlatformId(platformId);
  const account = publisherStoredAccount(group, canonical);
  const groupId = String(group.id || "").trim();
  const profileKey = String(account?.profileKey || "").trim();
  const deviceId = String(group.deviceId || "").trim();
  return (publisherSnapshot.sessions || [])
    .filter((session) => canonicalPublishPlatformId(session?.platform_id) === canonical)
    .filter((session) => !deviceId || !session?.device_id || String(session.device_id) === deviceId)
    .filter((session) => {
      const sessionGroup = publisherSessionGroupId(session);
      return sessionGroup
        ? sessionGroup === groupId
        : Boolean(profileKey && String(session?.profile_key || "") === profileKey);
    })
    .sort((left, right) => publisherSessionUpdatedAt(right) - publisherSessionUpdatedAt(left))[0] || null;
}

function publisherConnectionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  // Login state is independent from an article/job result.  A saved draft or a
  // completed publish task must never make an account look logged in.
  if (["ready", "online"].includes(status)) return "online";
  if (status === "open") return "needs_login";
  return status || "needs_login";
}

function publisherAccountConnection(group, platformId) {
  const canonical = canonicalPublishPlatformId(platformId);
  const storedAccount = publisherStoredAccount(group, canonical);
  if (!publisherSnapshot.loaded) {
    return {
      account: storedAccount ? { ...storedAccount, platformId: canonical, status: "unknown" } : null,
      session: null,
      status: "unknown",
      ready: false
    };
  }
  const session = publisherSessionForGroup(group, canonical);
  const sessionState = String(session?.login_state || "").trim().toLowerCase();
  // A session reported by the local assistant is authoritative, including an
  // indeterminate probe. Do not let an old account cache keep showing
  // “已登录” after the live session has become unknown.
  const rawStatus = sessionState || storedAccount?.status;
  const status = publisherConnectionStatus(rawStatus);
  const account = storedAccount ? {
    ...storedAccount,
    platformId: canonical,
    name: session?.account_name || storedAccount.name || storedAccount.accountName || "未命名账号",
    accountName: session?.account_name || storedAccount.accountName || storedAccount.name || "",
    status,
    profileKey: session?.profile_key || storedAccount.profileKey || "",
    updatedAt: session?.updated_at || session?.last_verified_at || storedAccount.updatedAt
  } : null;
  return {
    account,
    session,
    status,
    ready: status === "online"
  };
}

function publisherAccount(group, platformId) {
  return publisherAccountConnection(group, platformId).account;
}

function publisherPlatform(platformId) {
  const canonical = canonicalPublishPlatformId(platformId);
  return publisherSnapshot.platforms.find((item) => item.id === canonical) || null;
}

function publisherPlatformSelectable(platformId) {
  const platform = publisherPlatform(platformId);
  // 平台能力必须来自当前发布器目录；断连时不允许用后台静态目录伪造可发布状态。
  return Boolean(publisherSnapshot.loaded && platform && platform.enabled !== false);
}

function publisherAccountReady(account) {
  return Boolean(account && ["online", "ready"].includes(account.status));
}

function publisherAccountReadyForGroup(group, platformId) {
  return publisherAccountConnection(group, platformId).ready;
}

function publisherConnectionMessage(connection) {
  const accountName = connection.account?.name || connection.account?.accountName || "账号";
  if (connection.ready) return `${accountName} · 已登录 · 可直接下发至本地助手`;
  if (!connection.account) return "当前账号组尚未绑定账号";
  if (connection.status === "unknown") return `${accountName} · 本地助手暂未确认登录状态`;
  if (["needs_verification", "needs_captcha"].includes(connection.status)) return `${accountName} · 请在本地发布器完成验证`;
  if (connection.status === "error") return `${accountName} · 本地登录状态异常，请重新登录`;
  return `${accountName} · 请在本地发布器完成登录`;
}

function mapPublisherGroup(group) {
  const accounts = {};
  Object.entries(group.accounts || {}).forEach(([platformId, account]) => {
    const uiId = canonicalPublishPlatformId(platformId);
    accounts[uiId] = {
      ...account,
      name: account.name || account.accountName || "未命名账号",
      status: account.status === "ready" ? "online" : account.status || "needs_login",
      platformId: uiId
    };
  });
  return { ...group, accounts };
}

function publisherGroupUpdatedAt(group) {
  const device = (publisherSnapshot.devices || []).find((item) => item.id === group?.deviceId);
  return [group?.updatedAt, device?.lastHeartbeatAt, ...Object.values(group?.accounts || {}).map((account) => account.updatedAt)].filter(Boolean).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || group?.updatedAt || Date.now();
}

function mapPublisherJob(job) {
  const platforms = (job.platforms || []).map(canonicalPublishPlatformId);
  const group = state.accountGroups.find((item) => item.id === job.group_id || item.id === job.account_group_id);
  const resultFor = (platformId) => {
    const canonical = canonicalPublishPlatformId(platformId);
    return job.results?.[canonical] || job.results?.[platformId] || null;
  };
  const targetStatus = (platformId) => {
    const result = resultFor(platformId);
    const stateValue = result?.state || "";
    if (stateValue === "published") return "success";
    if (["manual_required", "awaiting_confirmation"].includes(stateValue) || result?.requires_manual_confirmation) return "needs_verification";
    if (stateValue === "draft_saved") return "draft_saved";
    if (stateValue === "failed") return "failed";
    if (stateValue === "cancelled") return "cancelled";
    if (stateValue === "awaiting_login") return "needs_login";
    if (stateValue === "needs_verification") return "needs_verification";
    if (job.status === "scheduled") return "scheduled";
    if (job.status === "cancelled") return "cancelled";
    if (job.status === "running") return "running";
    return "queued";
  };
  const targets = Object.fromEntries(platforms.map((platformId) => {
    const account = platformId === "web" ? state.site?.domain : publisherAccount(group, platformId);
    const result = resultFor(platformId);
    return [platformId, {
      status: targetStatus(platformId),
      account: platformId === "web" ? state.site?.domain : account?.name || account?.accountName || "未绑定账号",
      remoteUrl: result?.remote_url || result?.remoteUrl || "",
      updatedAt: result?.updated_at || job.updatedAt || Date.now(),
      message: result?.message || result?.error || job.message || "",
      requiresManualConfirmation: Boolean(result?.requires_manual_confirmation),
      executionMode: result?.execution_mode || publisherPlatform(platformId)?.executionMode || "publisher"
    }];
  }));
  const statuses = Object.values(targets).map((item) => item.status);
  const status = statuses.length && statuses.every((item) => item === "success") ? "success" : job.status === "running" ? "running" : statuses.some((item) => item === "failed") ? "failed" : statuses.some((item) => ["draft_saved", "needs_verification"].includes(item)) ? "needs_verification" : job.status || "queued";
  return {
    id: `REMOTE-${job.id}`,
    remoteJobId: job.id,
    articleId: job.articleId,
    articleTitle: job.articleTitle,
    version: job.version,
    groupId: job.group_id || job.account_group_id,
    groupName: job.group_name || group?.name || "未指定账号组",
    status,
    createdAt: job.createdAt || Date.now(),
    updatedAt: job.updatedAt || Date.now(),
    platformOrder: platforms,
    targets,
    logs: Object.entries(targets).map(([platformId, target]) => ({
      time: target.updatedAt ? formatTimeLabel(target.updatedAt) : "刚刚",
      platform: PLATFORM_META[platformId]?.name || publisherPlatform(platformId)?.name || platformId,
      message: target.message || (target.status === "success" ? "平台已回写发布地址" : target.status === "scheduled" ? "已进入定时队列" : target.status === "running" ? "本地发布器正在执行" : "等待本地发布器领取任务")
    }))
  };
}

async function publisherApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok || body.ok === false) throw new Error(body.message || `发布器接口请求失败（${response.status}）`);
  return body;
}

async function aiApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok || body.ok === false) {
    const error = body.error || {};
    const message = error.message || body.message || body.errorMessage || `模型接口请求失败（${response.status}）`;
    const failure = new Error(message);
    failure.code = error.code || body.code || `HTTP_${response.status}`;
    failure.details = error.details || body.details || null;
    failure.retryable = Boolean(error.retryable || body.retryable);
    throw failure;
  }
  return body;
}

async function refreshAiProviders({ renderAfter = false } = {}) {
  aiProviderSnapshot = { ...aiProviderSnapshot, loading: true, error: "" };
  if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
  try {
    const payload = await aiApi("/api/ai/providers");
    const providers = Array.isArray(payload.data?.providers) ? payload.data.providers : Array.isArray(payload.providers) ? payload.providers : [];
    aiProviderSnapshot = { loaded: true, loading: false, providers, error: "" };
    // A newly configured text provider should be usable immediately.  Older
    // demo state may have a display-only model name (for example “DeepSeek V3”)
    // but no provider binding, which otherwise makes every generation request
    // stop before it reaches the real model API.
    if (autoBindDefaultAiProvider("text")) saveState();
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
    return aiProviderSnapshot;
  } catch (error) {
    aiProviderSnapshot = { ...aiProviderSnapshot, loaded: false, loading: false, error: error.message || "模型服务未连接" };
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
    return null;
  }
}

function publisherArticleWebUrl(article) {
  const path = article?.siteUrl || `/insights/${siteSlug(article?.siteSlug || article?.title, String(article?.id || "article").toLowerCase())}/`;
  if (/^https?:\/\//i.test(path)) return path;
  const domain = String(state.site?.domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return domain ? `https://${domain}${path.startsWith("/") ? path : "/" + path}` : path;
}

function syncPublisherResultsToState() {
  let changed = false;
  (state.publishTasks || []).forEach((task) => {
    const article = state.articles.find((item) => item.id === task.articleId && (!task.version || item.version === task.version));
    if (!article) return;
    const targets = Object.entries(task.targets || {});
    const successful = targets.filter(([, target]) => target.status === "success");
    const active = targets.some(([, target]) => ["queued", "running"].includes(target.status));
    const actionable = targets.some(([, target]) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status));
    const website = successful.find(([platform]) => platform === "web")?.[1];
    if (website) {
      if (article.siteStatus !== "published") changed = true;
      article.siteStatus = "published";
      article.siteUrl = website.remoteUrl || article.siteUrl || publisherArticleWebUrl(article);
      article.sitePublishedAt = article.sitePublishedAt || new Date().toISOString();
    }
    if (successful.length) {
      if (article.status !== "published") changed = true;
      article.status = "published";
      article.publishedAt = article.publishedAt || new Date().toISOString();
    } else if (active && article.status === "draft") {
      article.status = "publishing";
      changed = true;
    } else if (actionable && article.status === "publishing") {
      article.status = "draft";
      changed = true;
    }
  });
  if (changed) saveState();
}

function syncPublisherSchedulesFromJobs() {
  const taskByRemoteId = new Map((state.publishTasks || []).filter((task) => task.remoteJobId !== undefined && task.remoteJobId !== null).map((task) => [String(task.remoteJobId), task]));
  let changed = false;
  (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled").forEach((schedule) => {
    (schedule.items || []).forEach((item) => {
      (item.targets || []).forEach((target) => {
        if (!target.remoteJobId) return;
        const task = taskByRemoteId.get(String(target.remoteJobId));
        const rawStatus = task?.targets?.[target.platform]?.status || task?.status;
        if (!rawStatus) return;
        const nextStatus = rawStatus === "scheduled" ? "waiting" : rawStatus;
        if (target.status !== nextStatus) {
          target.status = nextStatus;
          changed = true;
        }
      });
      const targetStates = (item.targets || []).map((target) => target.status);
      const nextItemStatus = targetStates.length && targetStates.every((status) => status === "success") ? "success"
        : targetStates.some((status) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(status)) ? "partial"
          : targetStates.some((status) => ["running", "queued"].includes(status)) ? "running"
            : targetStates.every((status) => status === "cancelled") ? "cancelled" : "waiting";
      if (item.status !== nextItemStatus) {
        item.status = nextItemStatus;
        changed = true;
      }
    });
    const itemStates = (schedule.items || []).map((item) => item.status);
    const nextScheduleStatus = itemStates.length && itemStates.every((status) => status === "success") ? "completed"
      : itemStates.some((status) => status === "partial") ? "partial"
        : itemStates.some((status) => status === "running") ? "running"
          : itemStates.every((status) => status === "cancelled") ? "cancelled" : "scheduled";
    if (schedule.status !== nextScheduleStatus) {
      schedule.status = nextScheduleStatus;
      changed = true;
    }
  });
  if (changed) saveState();
}

async function ensurePublisherIntegration() {
  if (!publisherSnapshot.loaded) await refreshPublisherSnapshot();
  if (publisherSnapshot.loaded) return true;
  showToast("本地发布器服务未连接", publisherSnapshot.error || "请确认后台发布服务正在运行，并在发布助手页面重新同步。", "error");
  return false;
}

async function refreshPublisherSnapshot({ renderAfter = false } = {}) {
  try {
    const payload = await publisherApi("/api/publisher/overview");
    const data = payload.data || {};
    publisherSnapshot = {
      loaded: true,
      devices: Array.isArray(data.devices) ? data.devices : [],
      accountGroups: Array.isArray(data.accountGroups) ? data.accountGroups.map(mapPublisherGroup) : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      jobs: Array.isArray(data.jobs) ? data.jobs : [],
      platforms: Array.isArray(data.platforms) ? data.platforms : [],
      readyPlatformIds: Array.isArray(data.readyPlatformIds) ? data.readyPlatformIds : [],
      selectablePlatformIds: Array.isArray(data.selectablePlatformIds) ? data.selectablePlatformIds : (Array.isArray(data.platforms) ? data.platforms.filter((platform) => platform.enabled !== false).map((platform) => platform.id) : []),
      manualConfirmationPlatformIds: Array.isArray(data.manualConfirmationPlatformIds) ? data.manualConfirmationPlatformIds : (Array.isArray(data.platforms) ? data.platforms.filter((platform) => platform.requiresManualConfirmation || platform.support === "manual").map((platform) => platform.id) : []),
      error: ""
    };
    state.accountGroups = publisherSnapshot.accountGroups.length
      ? publisherSnapshot.accountGroups
      : [{ id: "unpaired", name: "未连接本地发布器", deviceId: "", deviceName: "请先配对桌面软件", updatedAt: Date.now(), accounts: {} }];
    state.publishTasks = publisherSnapshot.jobs.map(mapPublisherJob);
    syncPublisherResultsToState();
    syncPublisherSchedulesFromJobs();
    if (renderAfter) render();
    return publisherSnapshot;
  } catch (error) {
    publisherSnapshot = { ...publisherSnapshot, loaded: false, devices: [], accountGroups: [], sessions: [], jobs: [], platforms: [], readyPlatformIds: [], selectablePlatformIds: [], manualConfirmationPlatformIds: [], error: error.message };
    if (renderAfter) render();
    return null;
  }
}

function writingAgentById(agentId) {
  return (state.writingAgents || []).find((agent) => agent.id === agentId) || null;
}

function writingAgentSupports(agent, lineId, contentType = null) {
  if (!agent || agent.status !== "active") return false;
  const lineAllowed = !agent.businessLineIds?.length || agent.businessLineIds.includes(lineId);
  const typeAllowed = !contentType || !agent.contentTypes?.length || agent.contentTypes.includes(contentType);
  return lineAllowed && typeAllowed;
}

function activeWritingAgents(lineId = null, contentType = null) {
  return (state.writingAgents || []).filter((agent) => writingAgentSupports(agent, lineId, contentType));
}

function defaultAgentForLine(line, contentType = null) {
  const lineAgent = writingAgentById(line?.defaultWritingAgentId);
  if (writingAgentSupports(lineAgent, line?.id, contentType)) return lineAgent;
  const systemAgent = writingAgentById(state.settings.defaultWritingAgentId);
  if (writingAgentSupports(systemAgent, line?.id, contentType)) return systemAgent;
  return activeWritingAgents(line?.id, contentType)[0] || null;
}

function snapshotWritingAgent(agent, options = {}) {
  return createWritingAgentSnapshot(agent, { modelName: state.settings.model, selectedBy: "王宁", ...options });
}

function resolvePlanWritingAgent(plan) {
  if (!plan?.writingAgentSnapshot) return null;
  return { snapshot: plan.writingAgentSnapshot, agent: writingAgentById(plan.writingAgentSnapshot.agentId || plan.writingAgentId) };
}

function planExpectedPlatformIds(plan) {
  const ids = Array.isArray(plan?.writingHints?.expectedPlatformIds) ? plan.writingHints.expectedPlatformIds : [];
  return [...new Set(ids)].filter((id) => PLATFORM_META[id]);
}

function planExpectedPlatformNames(plan) {
  const nameSnapshots = plan?.writingHints?.expectedPlatformNames || {};
  return planExpectedPlatformIds(plan).map((id) => nameSnapshots[id] || PLATFORM_META[id].name);
}

function planExpectedPlatformGuidance(plan) {
  const guidanceSnapshots = plan?.writingHints?.expectedPlatformGuidance || {};
  return planExpectedPlatformIds(plan).map((id) => ({ id, name: PLATFORM_META[id].name, guidance: guidanceSnapshots[id] || PLATFORM_STYLE_HINTS[id] }));
}

function writingAgentUsageCount(agentId) {
  const plans = state.contentPlans.filter((plan) => plan.writingAgentId === agentId || plan.writingAgentSnapshot?.agentId === agentId).length;
  const articles = state.articles.filter((article) => article.writingAgentId === agentId || article.generationSnapshot?.writingAgent?.agentId === agentId).length;
  return plans + articles;
}

const ui = {
  route: "dashboard",
  planningTab: "keywords",
  planningArchiveKind: "questions",
  planningCategory: "all",
  selectedBusinessLineId: state.businessLines.find((line) => line.status === "active")?.id || state.businessLines[0]?.id || null,
  businessKeywordInput: "",
  businessKeywordError: "",
  questionInput: "",
  questionError: "",
  businessLineError: "",
  planError: "",
  seedInput: "",
  seedError: "",
  selectedCoreKeywordIds: [],
  seedExpanding: false,
  selectedPackId: state.keywordPacks[0]?.id || null,
  expanding: false,
  topicGenerating: false,
  contentView: "articles",
  studioWorkspaceId: null,
  studioArticleId: null,
  studioPane: "editor",
  studioComposerDraft: "",
  studioTopicDraft: "",
  studioContentType: "深度文章",
  studioAgentId: null,
  studioWebSearch: false,
  studioPicker: null,
  studioSelectionText: "",
  studioGenerating: false,
  studioNotice: "",
  articleTab: "all",
  articleTaskView: "plans",
  articlePlanFilterId: "all",
  articleSearch: "",
  articleRiskFilter: "all",
  articleKnowledgeFilter: "all",
  articleFilterExpanded: false,
  publishTab: "all",
  publishView: "tasks",
  publishBatchCategory: "self_media",
  publishBatchSearch: "",
  publishBatchArticleSearch: "",
  publishBatchSelection: null,
  assistantCatalogGroupId: null,
  pairingCode: null,
  pairingExpiresAt: null,
  assetTab: "all",
  assetExpandedId: null,
  assetPlanFilterId: "all",
  assetSearch: "",
  siteTab: "overview",
  sitePageId: "home",
  siteContentTab: "articles",
  siteCategoryFilter: "all",
  knowledgeTab: "libraries",
  knowledgeKindFilter: "all",
  monitoringTab: "overview",
  monitoringPlatform: "all",
  monitoringRange: "30",
  monitoringRefreshing: false,
  onboardingStep: 1,
  monitorTaskError: "",
  monitorPlatformSelection: null,
  settingsTab: "general",
  modal: null,
  publishSelection: null,
  articleSelection: [],
  scheduleSelection: null,
  submittingSchedule: false,
  submittingPublish: false,
  commandQuery: ""
};

const simulationTimers = new Map();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addOperationLog(category, detail, actor = "王宁") {
  const logs = state.settings.operationLogs = Array.isArray(state.settings.operationLogs) ? state.settings.operationLogs : [];
  logs.unshift({ id: uid("LOG"), occurredAt: Date.now(), category, actor, detail });
  if (logs.length > 120) logs.length = 120;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

function csvValue(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function monitoringBindingsForArticle(articleId) {
  return (state.monitoring.queryBindings || []).find((binding) => binding.articleId === articleId) || null;
}

function monitoredQuestionLabel(questionId) {
  const fromLibrary = state.questionLibrary.find((question) => question.id === questionId);
  const fromSamples = state.monitoring.questions.find((question) => question.id === questionId);
  const fromCustom = (state.monitoring.customQueries || []).find((question) => question.id === questionId);
  return fromLibrary?.question || fromSamples?.question || fromCustom?.question || "已删除的问题";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeStudioHtml(html) {
  if (!html || typeof document === "undefined") return String(html || "");
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("script,style,iframe,object,embed,form,meta,link").forEach((node) => node.remove());
  const allowedAttributes = new Set(["class", "id", "title", "role", "aria-label", "contenteditable", "data-action", "data-citation-id", "data-asset-id", "data-icon", "href", "target", "rel", "style"]);
  template.content.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || !allowedAttributes.has(attribute.name) && !allowedAttributes.has(name)) element.removeAttribute(attribute.name);
    });
    if (element.hasAttribute("href")) {
      try {
        const href = new URL(element.getAttribute("href"), window.location.origin);
        if (!["http:", "https:", "mailto:"].includes(href.protocol)) element.removeAttribute("href");
        else element.setAttribute("href", href.href);
      } catch { element.removeAttribute("href"); }
    }
    if (element.hasAttribute("data-action")) {
      const safeCitationAction = element.tagName === "BUTTON" && element.getAttribute("data-action") === "open-citation" && element.hasAttribute("data-citation-id");
      if (!safeCitationAction) element.removeAttribute("data-action");
    }
    if (element.hasAttribute("style")) {
      const alignment = element.style.textAlign;
      if (["left", "center", "right", "justify"].includes(alignment)) element.setAttribute("style", `text-align:${alignment}`);
      else element.removeAttribute("style");
    }
  });
  return template.innerHTML;
}

function icon(name) {
  const paths = ICONS[name] || ICONS.info;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

function renderSelectAllControl(scope, total, selected, label = "全选", attributes = "") {
  const count = Number(total) || 0;
  const selectedCount = Number(selected) || 0;
  const checked = count > 0 && selectedCount === count;
  const indeterminate = selectedCount > 0 && selectedCount < count;
  return `<label class="select-all-control"><input class="checkbox" type="checkbox" data-select-all="${scope}" data-select-total="${count}" data-select-selected="${selectedCount}" ${attributes} ${checked ? "checked" : ""} ${indeterminate ? 'data-indeterminate="true"' : ""} aria-label="${label}" aria-checked="${indeterminate ? "mixed" : checked ? "true" : "false"}" /><span>${label}</span><small>${selectedCount}/${count}</small></label>`;
}

function syncBulkSelectControl(input, total = input?.dataset.selectTotal, selected = input?.dataset.selectSelected) {
  if (!input) return;
  const count = Number(total) || 0;
  const selectedCount = Number(selected) || 0;
  input.dataset.selectTotal = String(count);
  input.dataset.selectSelected = String(selectedCount);
  input.checked = count > 0 && selectedCount === count;
  input.indeterminate = selectedCount > 0 && selectedCount < count;
  input.dataset.indeterminate = input.indeterminate ? "true" : "false";
  input.setAttribute("aria-checked", input.indeterminate ? "mixed" : input.checked ? "true" : "false");
  const counter = input.parentElement?.querySelector("small");
  if (counter) counter.textContent = selectedCount + "/" + count;
}

function hydrateBulkSelects(root = document) {
  root.querySelectorAll("[data-select-all]").forEach((input) => {
    syncBulkSelectControl(input);
  });
}

function formatRelative(timestamp) {
  const numericTimestamp = Number(timestamp);
  const parsedTimestamp = Number.isFinite(numericTimestamp) ? numericTimestamp : new Date(String(timestamp || "")).getTime();
  const diff = Math.max(0, Date.now() - (Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now()));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + " 分钟前";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " 小时前";
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨天" : days + " 天前";
}

function statusBadge(status) {
  const meta = STATUS_META[status] || [status, "status-draft"];
  return '<span class="status-badge ' + meta[1] + '">' + escapeHtml(meta[0]) + "</span>";
}

function platformLogo(platform) {
  const meta = PLATFORM_META[platform] || { short: "平", logoClass: "generic" };
  return '<span class="platform-logo ' + meta.logoClass + '">' + meta.short + "</span>";
}

function articleDisplayStatus(article) {
  if (article.status === "published") return "published";
  if (article.status === "publishing") return "publishing";
  if (article.reviewStatus === "approved") return "approved";
  if (article.reviewStatus === "pending" && article.reviewStage === "manual_review") return "pending_review";
  return "draft";
}

function articleReviewBadge(article) {
  if (article.reviewStatus === "approved") return statusBadge("approved");
  if (article.reviewStage === "manual_review") return statusBadge("pending_review");
  if (article.reviewStage === "revision_requested") return '<span class="status-badge status-review">退回修改</span>';
  return '<span class="status-badge status-draft">草稿未提交</span>';
}

function articleRiskBadge(article) {
  if (article.riskStatus === "blocked") return '<span class="status-badge status-error">已阻断</span>';
  if (article.riskStatus === "warning") return '<span class="status-badge status-review">需注意</span>';
  if (article.riskStatus === "stale") return '<span class="status-badge status-pending">结果已过期</span>';
  if (article.riskStatus === "unscanned") return '<span class="status-badge status-draft">未检测</span>';
  return '<span class="status-badge status-approved">已通过</span>';
}

function currentRoute() {
  const raw = location.hash.replace(/^#/, "").split("?")[0];
  return PAGE_META[raw] ? raw : "dashboard";
}

function navigate(route) {
  if (!PAGE_META[route]) route = "dashboard";
  if (location.hash === "#" + route) {
    ui.route = route;
    render();
  } else {
    location.hash = route;
  }
}

function pageHead(title, description, actions = "") {
  return '<div class="page-head"><div><h2>' + escapeHtml(title) + "</h2><p>" + escapeHtml(description) + '</p></div><div class="page-actions">' + actions + "</div></div>";
}

function showToast(title, message, type = "success") {
  const root = document.getElementById("toast-root");
  const toast = document.createElement("div");
  toast.className = "toast" + (type === "error" ? " error" : "");
  toast.innerHTML =
    "<span>" + icon(type === "error" ? "alert" : "check") + "</span>" +
    "<div><b>" + escapeHtml(title) + "</b><small>" + escapeHtml(message) + "</small></div>" +
    '<button type="button" aria-label="关闭">×</button>';
  root.appendChild(toast);
  const remove = () => toast.remove();
  toast.querySelector("button").addEventListener("click", remove);
  window.setTimeout(remove, 3600);
}

function updateShell() {
  const meta = PAGE_META[ui.route];
  document.getElementById("page-title").textContent = meta.title;
  document.getElementById("breadcrumb-current").textContent = meta.title;
  document.title = meta.title + " · 桐灼 GEO";
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === ui.route);
  });
  const pendingTopics = state.topics.filter((topic) => topic.status !== "archived" && topic.coverage !== "已覆盖").length;
  const pendingArticles = state.articles.filter((article) => article.reviewStatus === "pending").length;
  document.getElementById("topic-nav-count").textContent = String(pendingTopics);
  document.getElementById("article-nav-count").textContent = String(pendingArticles);
  const needsAction = state.publishTasks.some((task) =>
    Object.values(task.targets).some((target) => ["failed", "needs_login", "needs_verification", "result_unknown"].includes(target.status))
  );
  document.getElementById("publish-nav-dot").classList.toggle("warning", needsAction);
}

function render() {
  ui.route = currentRoute();
  updateShell();
  const renderers = {
    dashboard: renderDashboard,
    planning: renderPlanning,
    content: renderContent,
    publish: renderPublish,
    assets: renderAssets,
    monitoring: renderMonitoring,
    site: renderSite,
    knowledge: renderKnowledge,
    assistant: renderAssistant,
    settings: renderSettings
  };
  document.getElementById("view").innerHTML = renderers[ui.route]();
  hydrateIcons(document.getElementById("view"));
  hydrateBulkSelects(document.getElementById("view"));
  enhanceArticleTaskSelection(document.getElementById("view"));
  document.body.classList.remove("sidebar-open");
}

function renderDashboard() {
  const pendingReview = state.articles.filter((article) => article.reviewStatus === "pending").length;
  const readyToPublish = state.articles.filter((article) => article.reviewStatus === "approved" && article.status === "draft").length;
  const activeTargets = state.publishTasks.reduce(
    (total, task) => total + Object.values(task.targets).filter((target) => ["queued", "running"].includes(target.status)).length,
    0
  );
  const actionTargets = state.publishTasks.reduce(
    (total, task) => total + Object.values(task.targets).filter((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status)).length,
    0
  );
  const dashboardDevice = (publisherSnapshot.devices || [])[0];
  const dashboardDeviceStatus = !publisherSnapshot.loaded ? "unknown" : dashboardDevice?.status === "online" ? "device_online" : dashboardDevice ? "device_offline" : "not_connected";
  const dashboardDeviceName = dashboardDevice?.name || state.accountGroups[0]?.deviceName || "尚未连接桌面发布器";
  const dashboardHeartbeat = dashboardDevice?.lastHeartbeatAt || publisherGroupUpdatedAt(state.accountGroups[0]);

  return `
    <div class="page-container">
      ${pageHead("上午好，王宁", `今天的重点是完成内容审核，并处理 ${actionTargets} 个平台发布结果。`, '<button class="primary-button" type="button" data-nav="planning"><span data-icon="plus"></span>创建选题</button>')}

      <section class="metric-grid" aria-label="行动数据">
        <article class="metric-card">
          <div class="metric-top"><span>待审核文章</span><span class="metric-icon amber" data-icon="file"></span></div>
          <div class="metric-value">${pendingReview}</div>
          <div class="metric-note">来自真实文章审核状态</div>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>可以发布</span><span class="metric-icon green" data-icon="send"></span></div>
          <div class="metric-value">${readyToPublish}</div>
          <div class="metric-note">已审核且尚未发布</div>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>执行中目标</span><span class="metric-icon" data-icon="clock"></span></div>
          <div class="metric-value">${activeTargets}</div>
          <div class="metric-note">各平台独立计算</div>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>需要处理</span><span class="metric-icon purple" data-icon="alert"></span></div>
          <div class="metric-value">${actionTargets}</div>
          <div class="metric-note">登录、验证或结果核验</div>
        </article>
      </section>

      <section class="card workflow-card">
        <div class="card-header"><div><h3>GEO 运营闭环</h3><p>从企业事实到效果证据，每一步都有明确的输入和输出</p></div><span class="small-tag teal">持续运营</span></div>
        <div class="workflow-steps">
          <button class="workflow-step" type="button" data-action="open-onboarding"><span><i>1</i><b data-icon="briefcase"></b></span><strong>企业建档</strong><small>完整度 ${state.enterpriseProfile.completion}%</small></button>
          <i class="workflow-arrow">→</i>
          <button class="workflow-step" type="button" data-nav="planning"><span><i>2</i><b data-icon="compass"></b></span><strong>选题中心</strong><small>${state.keywords.length} 个关键词</small></button>
          <i class="workflow-arrow">→</i>
          <button class="workflow-step" type="button" data-nav="content"><span><i>3</i><b data-icon="file"></b></span><strong>内容生产</strong><small>${pendingReview} 篇待审核</small></button>
          <i class="workflow-arrow">→</i>
          <button class="workflow-step" type="button" data-nav="publish"><span><i>4</i><b data-icon="send"></b></span><strong>多端发布</strong><small>${readyToPublish} 篇可发布</small></button>
          <i class="workflow-arrow">→</i>
          <button class="workflow-step" type="button" data-nav="monitoring"><span><i>5</i><b data-icon="chart"></b></span><strong>效果监测</strong><small>演示数据</small></button>
        </div>
      </section>

      <div class="dashboard-grid">
        <div class="stack">
          <section class="card">
            <div class="card-header">
              <div><h3>今天要处理</h3><p>按业务对象计算，不使用虚构的 GEO 总分或流量指标</p></div>
              <button class="text-button" type="button" data-nav="content">查看全部 <span data-icon="arrow"></span></button>
            </div>
            <div class="todo-list">
              <button class="todo-item" type="button" data-action="show-pending-articles">
                <span class="todo-icon amber" data-icon="file"></span>
                <span class="todo-copy"><strong>审核待处理文章</strong><span>核对企业事实、引用来源与风险提示</span></span>
                <span class="todo-meta"><b>${pendingReview}</b><i class="todo-arrow">›</i></span>
              </button>
              <button class="todo-item" type="button" data-action="show-approved-articles">
                <span class="todo-icon" data-icon="send"></span>
                <span class="todo-copy"><strong>发布已通过文章</strong><span>选择一个账号组，勾选官网和内容平台</span></span>
                <span class="todo-meta"><b>${readyToPublish}</b><i class="todo-arrow">›</i></span>
              </button>
              <button class="todo-item" type="button" data-nav="publish">
                <span class="todo-icon red" data-icon="alert"></span>
                <span class="todo-copy"><strong>${actionTargets ? "处理发布异常" : "发布结果状态"}</strong><span>${actionTargets ? "登录、验证、草稿或失败目标需要人工处理" : "暂无需要人工处理的发布目标"}</span></span>
                <span class="todo-meta"><b>${actionTargets}</b><i class="todo-arrow">›</i></span>
              </button>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div><h3>快捷开始</h3><p>围绕“选题 → 内容 → 发布 → 复盘”的日常主流程</p></div>
            </div>
            <div class="quick-grid">
              <button class="quick-action" type="button" data-nav="planning"><span data-icon="sparkle"></span><b>进入选题中心</b><small>关键词、问题与计划</small></button>
              <button class="quick-action" type="button" data-nav="content"><span data-icon="edit"></span><b>审核文章</b><small>校验事实与风险</small></button>
              <button class="quick-action" type="button" data-action="publish-approved"><span data-icon="send"></span><b>一键发布</b><small>选择账号组和平台</small></button>
            </div>
          </section>
        </div>

        <aside class="stack">
          <section class="card onboarding-card">
            <div class="onboarding-card-head"><span class="knowledge-icon" data-icon="briefcase"></span><span><small>企业资料完整度</small><b>${state.enterpriseProfile.completion}%</b></span></div>
            <div class="onboarding-progress"><i style="width:${state.enterpriseProfile.completion}%"></i></div>
            <p>${state.enterpriseProfile.completion === 100 ? "企业身份、业务边界、证据资料和监测基线均已确认。" : "企业、产品和目标客户资料已完成；还有 1 条案例和 2 条 FAQ 等待确认。"}</p>
            <button class="secondary-button button-small" type="button" data-action="open-onboarding">${state.enterpriseProfile.completion === 100 ? "查看企业建档" : "继续完善企业建档"}</button>
          </section>
          <section class="card">
            <div class="card-header"><div><h3>系统状态</h3><p>客户独立部署环境</p></div></div>
            <div class="system-list">
              <div class="system-item">
                <div class="system-name"><span data-icon="globe"></span><span><b>企业官网</b><small>www.tongzhuo.com</small></span></div>
                <span class="health"><i></i>运行正常</span>
              </div>
              <div class="system-item">
                <div class="system-name"><span data-icon="sparkle"></span><span><b>GEORank 能力服务</b><small>关键词拓展接口</small></span></div>
                <span class="health"><i></i>可用</span>
              </div>
              <div class="system-item">
                <div class="system-name"><span data-icon="monitor"></span><span><b>本地发布助手</b><small>${escapeHtml(dashboardDeviceName)} · ${formatRelative(dashboardHeartbeat)}</small></span></div>
                ${statusBadge(dashboardDeviceStatus)}
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header"><div><h3>最近动态</h3><p>关键业务事件</p></div></div>
            <div class="activity-list">
              <div class="activity-item"><span class="activity-dot" data-icon="check"></span><div class="activity-copy"><b>文章通过人工审核</b><p>《工业品企业如何搭建可持续的 GEO 内容体系？》 · 22 分钟前</p></div></div>
              <div class="activity-item"><span class="activity-dot" data-icon="sparkle"></span><div class="activity-copy"><b>生成 8 个拓词结果</b><p>词包「工业品 GEO 优化」 · 36 分钟前</p></div></div>
              <div class="activity-item"><span class="activity-dot" data-icon="database"></span><div class="activity-copy"><b>企业知识完成更新</b><p>新增 2 条服务案例证据 · 1 小时前</p></div></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;
}

function activeBusinessLine() {
  const activeLines = state.businessLines.filter((line) => line.status === "active");
  return activeLines.find((line) => line.id === ui.selectedBusinessLineId) || activeLines[0] || state.businessLines[0];
}

function aiBusinessLinePayload(line) {
  return {
    id: line?.id || "",
    name: line?.name || line?.product || "",
    product: line?.product || "",
    description: line?.description || "",
    audience: line?.audience || "",
    scenario: line?.scenario || "",
    businessProfile: line?.businessProfile || line?.business_profile || "",
    targetUsers: Array.isArray(line?.targetUsers) ? line.targetUsers : [],
    blockedTerms: Array.isArray(line?.blockedTerms) ? line.blockedTerms : [],
    serviceScope: line?.serviceScope || ""
  };
}

function knowledgeBaseById(baseId) {
  return (state.knowledgeBases || []).find((base) => base.id === baseId) || null;
}

function knowledgeItemById(itemId) {
  return (state.knowledgeItems || []).find((item) => item.id === itemId) || null;
}

function knowledgeVersionById(versionId) {
  return (state.knowledgeVersions || []).find((version) => version.id === versionId) || null;
}

function knowledgeBaseItems(baseId) {
  return (state.knowledgeItems || []).filter((item) => item.knowledgeBaseId === baseId);
}

function approvedKnowledgeItems(baseId) {
  return knowledgeBaseItems(baseId).filter((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    return item.status === "approved" && item.enabled !== false && version?.reviewStatus === "approved";
  });
}

function enterpriseKnowledgeBaseIds() {
  return (state.knowledgeBases || [])
    .filter((base) => base.scope === "enterprise" && base.status !== "archived")
    .map((base) => base.id);
}

function inheritedKnowledgeBaseIds(line = activeBusinessLine()) {
  return [...new Set([...enterpriseKnowledgeBaseIds(), ...(line?.knowledgeBaseIds || [])])];
}

function normalizeKnowledgeScope(plan, line = state.businessLines.find((item) => item.id === plan?.businessLineId) || activeBusinessLine()) {
  const inherited = plan?.knowledgeScope?.inheritedBaseIds || inheritedKnowledgeBaseIds(line);
  const added = plan?.knowledgeScope?.addedBaseIds || [];
  const excluded = plan?.knowledgeScope?.excludedBaseIds || [];
  const resolved = plan?.knowledgeScope?.resolvedBaseIds || plan?.knowledgeBaseIds || [...new Set([...inherited, ...added])].filter((id) => !excluded.includes(id));
  return {
    inheritedBaseIds: [...new Set(inherited)],
    addedBaseIds: [...new Set(added)],
    excludedBaseIds: [...new Set(excluded)],
    resolvedBaseIds: [...new Set(resolved)],
    snapshottedAt: plan?.knowledgeScope?.snapshottedAt || plan?.createdAt || Date.now()
  };
}

function planKnowledgeSummary(plan) {
  const scope = normalizeKnowledgeScope(plan);
  const approved = scope.resolvedBaseIds.reduce((total, id) => total + approvedKnowledgeItems(id).length, 0);
  return { scope, approved };
}

function knowledgeKindLabel(kind) {
  return kind === "qa" ? "问答库" : "文档库";
}

function knowledgeScopeLabel(base) {
  if (base.scope === "enterprise") return "全企业共享";
  const line = state.businessLines.find((item) => item.id === base.businessLineId);
  return line ? line.name : "业务线专用";
}

function knowledgeSourceLabel(item, version) {
  return item.sourceName || item.fileName || item.url || version?.sourceName || (item.kind === "qa" ? "企业标准问答" : "企业资料");
}

function knowledgeLocator(item, version) {
  return item.locator || item.page || item.url || version?.locator || version?.page || version?.url || (item.kind === "qa" ? "标准答案" : "正文");
}

function topicBusinessLineId(topic) {
  if (topic.businessLineId) return topic.businessLineId;
  const question = state.questionLibrary.find((item) => item.topicId === topic.id);
  if (question) return question.businessLineId;
  return state.keywordPacks.find((pack) => pack.id === topic.packId)?.businessLineId || null;
}

function planningQuestionTopics(question) {
  if (!question) return [];
  return state.topics.filter((topic) => topic.questionId === question.id || topic.id === question.topicId);
}

function planningTopicPlans(topic) {
  if (!topic) return [];
  return state.contentPlans.filter((plan) => Array.isArray(plan.topicIds) && plan.topicIds.includes(topic.id));
}

function planningTopicArticles(topic) {
  if (!topic) return [];
  return state.articles.filter((article) => article.topicId === topic.id || article.sourceTopicId === topic.id || article.generationSnapshot?.sourceTopicId === topic.id);
}

function planningQuestionReferences(question) {
  const topics = planningQuestionTopics(question);
  const plans = [...new Map(topics.flatMap((topic) => planningTopicPlans(topic)).map((plan) => [plan.id, plan])).values()];
  const articles = [...new Map(topics.flatMap((topic) => planningTopicArticles(topic)).map((article) => [article.id, article])).values()];
  return { topics, plans, articles };
}

function planningTopicReferences(topic) {
  return { question: state.questionLibrary.find((question) => question.id === topic?.questionId || question.topicId === topic?.id) || null, plans: planningTopicPlans(topic), articles: planningTopicArticles(topic) };
}

function planningArchiveCount(lineId) {
  return state.questionLibrary.filter((question) => question.businessLineId === lineId && question.status === "archived").length + state.topics.filter((topic) => topicBusinessLineId(topic) === lineId && topic.status === "archived").length;
}

function planningTabs() {
  const line = activeBusinessLine();
  const counts = {
    keywords: state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active" && !isSeedKeyword(item)).length,
    questions: state.questionLibrary.filter((item) => item.businessLineId === line?.id && item.status === "active" && !planningQuestionTopics(item).some((topic) => topic.status !== "archived")).length,
    topics: state.topics.filter((item) => topicBusinessLineId(item) === line?.id && item.status !== "archived" && !planningTopicPlans(item).length).length,
    plans: state.contentPlans.filter((item) => item.businessLineId === line?.id).length,
    archive: planningArchiveCount(line?.id)
  };
  const tabs = [["keywords", "关键词拓展"], ["questions", "问题词库"], ["topics", "选题库"], ["plans", "内容计划"], ["archive", "归档管理"]];
  return '<div class="tabs topic-center-tabs" role="tablist">' + tabs.map(([id, label]) => '<button class="tab-button ' + (ui.planningTab === id ? "active" : "") + '" type="button" data-action="planning-tab" data-tab="' + id + '">' + label + " · " + counts[id] + "</button>").join("") + "</div>";
}

function renderBusinessScope() {
  const line = activeBusinessLine();
  const options = state.businessLines.filter((item) => item.status === "active").map((item) => '<option value="' + item.id + '" ' + (item.id === line?.id ? "selected" : "") + '>' + escapeHtml(item.name) + "</option>").join("");
  const keywordCount = state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active" && !isSeedKeyword(item)).length;
  const questionCount = state.questionLibrary.filter((item) => item.businessLineId === line?.id && item.status === "active" && !planningQuestionTopics(item).some((topic) => topic.status !== "archived")).length;
  return `
    <section class="card business-scope-card">
      <div class="field"><label for="business-line-select">当前产品 / 业务线</label><select class="select" id="business-line-select" data-planning-business>${options}</select></div>
      <div class="business-scope-copy"><b>${escapeHtml(line?.product || "尚未配置产品")}</b><span>${escapeHtml(line?.audience || "请补充目标客户")} · ${escapeHtml(line?.scenario || "请补充核心场景")}</span></div>
      <div class="business-scope-stats"><span><b>${keywordCount}</b>关键词</span><span><b>${questionCount}</b>问题</span></div>
      <div class="business-scope-actions"><button class="ghost-button button-small" type="button" data-action="manage-business-lines"><span data-icon="settings"></span>管理</button><button class="secondary-button button-small" type="button" data-action="open-business-line"><span data-icon="plus"></span>新增业务线</button></div>
    </section>
  `;
}

function isSeedKeyword(item) {
  return item?.keywordRole === "seed" || (Array.isArray(item?.sourceCoreKeywordIds) && item.sourceCoreKeywordIds.length > 0);
}

function renderKeywordWorkspace() {
  const line = activeBusinessLine();
  const lineKeywords = state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active");
  const coreKeywords = lineKeywords.filter((item) => !isSeedKeyword(item));
  const linePacks = state.keywordPacks.filter((pack) => pack.businessLineId === line?.id);
  const activePack = linePacks.find((pack) => pack.id === ui.selectedPackId) || linePacks[0];
  const packQuestions = state.questionLibrary.filter((question) => question.packId === activePack?.id && question.status === "candidate");
  const visibleQuestions = ui.planningCategory === "all" ? packQuestions : packQuestions.filter((question) => question.dimension === ui.planningCategory);
  const visibleSelectedQuestions = visibleQuestions.filter((question) => question.selected);
  const visibleCandidateQuestions = visibleQuestions.filter((question) => question.status === "candidate");
  const selectedCandidateQuestions = visibleCandidateQuestions.filter((question) => question.selected);
  const selectedQuestions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status !== "archived" && question.selected);
  const selectedCoreIds = new Set(ui.selectedCoreKeywordIds || []);
  const selectedSeedTerms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean);
  const keywordChips = coreKeywords.map((keyword) => `
    <span class="keyword-chip ${selectedCoreIds.has(keyword.id) ? "selected" : ""}"><input class="checkbox" type="checkbox" data-core-select="${escapeHtml(keyword.id)}" ${selectedCoreIds.has(keyword.id) ? "checked" : ""} aria-label="选择核心关键词：${escapeHtml(keyword.term)}" /><button class="keyword-name-button" type="button" data-action="toggle-core-keyword" data-keyword-id="${escapeHtml(keyword.id)}">${escapeHtml(keyword.term)}</button><small>核心关键词</small><button class="keyword-archive-button" type="button" data-action="archive-business-keyword" data-keyword-id="${keyword.id}" aria-label="归档核心关键词 ${escapeHtml(keyword.term)}">×</button></span>
  `).join("");
  const packageItems = linePacks.map((pack) => `
    <div class="package-item-wrap"><button class="package-item ${pack.id === activePack?.id ? "active" : ""}" type="button" data-action="select-pack" data-pack-id="${pack.id}"><strong>${escapeHtml(pack.title)}</strong><span><em>${escapeHtml(pack.source)}</em><b>${pack.total} 条</b></span></button><button class="package-delete-button" type="button" data-action="delete-keyword-pack" data-pack-id="${escapeHtml(pack.id)}" aria-label="删除历史词包：${escapeHtml(pack.title)}">删除</button></div>
  `).join("");
  const categoryTabs = DIMENSIONS.map((dimension) => {
    const count = dimension.id === "all" ? packQuestions.length : packQuestions.filter((question) => question.dimension === dimension.id).length;
    return '<button class="category-tab ' + (ui.planningCategory === dimension.id ? "active" : "") + '" type="button" data-action="planning-category" data-category="' + dimension.id + '">' + dimension.label + "<i>" + count + "</i></button>";
  }).join("");
  let resultItems = "";
  if (ui.expanding) {
    resultItems = Array.from({ length: 5 }).map((_, index) => '<div class="topic-item" aria-hidden="true"><span class="skeleton" style="width:17px;height:17px"></span><div><div class="skeleton" style="height:15px;width:' + (78 - index * 5) + '%"></div><div class="skeleton" style="height:10px;width:92%;margin-top:10px"></div></div><div class="skeleton" style="height:16px;width:50px"></div></div>').join("");
  } else if (!visibleQuestions.length) {
    resultItems = '<div class="empty-state"><div><span data-icon="compass"></span><h3>还没有问题词包</h3><p>先拓展并确认种子词，再根据种子词生成问题词包。</p></div></div>';
  } else {
    resultItems = visibleQuestions.map((question) => {
      const deleteAction = question.status === "candidate"
        ? `<div class="keyword-result-actions"><button class="link-button danger-text keyword-delete-button" type="button" data-action="delete-keyword-candidate" data-question-id="${escapeHtml(question.id)}" title="删除此候选问题" aria-label="删除候选问题：${escapeHtml(question.question)}">删除</button></div>`
        : "";
      const priorityScore = calculateQuestionPriorityScore(question);
      return `<div class="topic-item keyword-result-row"><input class="checkbox" type="checkbox" data-question-select="${question.id}" ${question.selected ? "checked" : ""} aria-label="选择问题：${escapeHtml(question.question)}" /><span class="topic-copy"><strong>${escapeHtml(question.question)}</strong><p>来源种子词：${escapeHtml(question.sourceKeyword)} · ${escapeHtml(question.source)}</p></span><span class="topic-score"><b>${priorityScore}</b><small>模型建议强度</small><span class="strength-bar"><i style="width:${priorityScore}%"></i></span></span>${deleteAction}</div>`;
    }).join("");
  }
  const basket = selectedQuestions.length ? selectedQuestions.map((question) => `<div class="basket-item"><b>${escapeHtml(question.question)}</b><span>${escapeHtml(question.sourceKeyword)}</span><button class="basket-remove" type="button" data-action="remove-question" data-question-id="${question.id}" aria-label="移除">×</button></div>`).join("") : '<div class="basket-empty"><div><span data-icon="clipboard"></span><b>问题篮还是空的</b><p>勾选问题词包中的结果，确认后加入问题词库。</p></div></div>';
  return `
    <section class="card keyword-manager-card">
      <div class="card-header"><div><h3>核心关键词</h3><p>核心关键词自动归属于当前产品 / 业务线；勾选后可智能拓展种子词。</p></div><span class="small-tag blue">${coreKeywords.length} 个</span></div>
      <div class="keyword-manager-body"><div class="keyword-input-row"><div class="field grow"><label for="business-keyword-input">核心关键词（可输入新词，也可勾选下方已有词）</label><input class="input ${ui.businessKeywordError ? "input-error" : ""}" id="business-keyword-input" value="${escapeHtml(ui.businessKeywordInput)}" placeholder="例如：激光清洗机，激光除锈" autocomplete="off" />${ui.businessKeywordError ? '<small class="error-text">' + escapeHtml(ui.businessKeywordError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="expand-seeds" ${ui.seedExpanding ? "disabled" : ""}>${ui.seedExpanding ? '<span class="loading-spinner"></span>正在拓展种子词' : '<span data-icon="sparkle"></span>智能拓展种子词'}</button></div><div class="keyword-chip-list">${keywordChips || '<span class="empty-inline">输入一个核心关键词后，即可智能拓展种子词。</span>'}</div><div class="keyword-selection-hint">${selectedCoreIds.size ? `已选择 ${selectedCoreIds.size} 个核心关键词` : "未勾选时使用当前业务线的全部核心关键词"}</div></div>
    </section>
    <section class="card seed-manager-card"><div class="card-header"><div><h3>种子词</h3><p>智能拓展结果直接显示在下方词框，可直接增删或修改后生成问题词包。</p></div><span class="small-tag teal">${selectedSeedTerms.length} 个</span></div><div class="seed-input-row"><div class="field grow"><label for="seed-input">拓展种子词（1–8 个，可直接编辑）</label><input class="input ${ui.seedError ? "input-error" : ""}" id="seed-input" value="${escapeHtml(ui.seedInput)}" placeholder="智能拓展后直接显示在这里，也可手动输入并用逗号分隔" autocomplete="off" />${ui.seedError ? '<small class="error-text">' + escapeHtml(ui.seedError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="generate-question-pack" ${ui.expanding || ui.seedExpanding ? "disabled" : ""}>${ui.expanding ? '<span class="loading-spinner"></span>正在生成问题词包' : '<span data-icon="sparkle"></span>生成问题词包'}</button></div></section>
    <div class="planning-layout">
      <aside class="card"><div class="card-header"><div><h3>历史词包</h3><p>仅显示当前业务线 · 可切换或删除历史结果</p></div></div><div class="package-list">${packageItems || '<div class="empty-package">暂无词包</div>'}</div></aside>
      <section class="card"><div class="card-header"><div><h3>${escapeHtml(activePack?.title || "问题词包结果")}</h3><p>种子词：${escapeHtml(activePack?.seeds?.join(" / ") || "—")}</p></div><span class="small-tag blue">共 ${packQuestions.length} 条</span></div><div class="category-tabs">${categoryTabs}</div><div class="model-note"><span data-icon="info"></span><span>每个栏目默认生成 5 个客户问题；勾选后加入问题词库。</span></div>${visibleQuestions.length ? '<div class="bulk-select-row keyword-bulk-row">' + renderSelectAllControl("keyword-questions", visibleQuestions.length, visibleSelectedQuestions.length, "全选当前栏目", 'data-select-pack-id="' + escapeHtml(activePack?.id || "") + '" data-select-dimension="' + escapeHtml(ui.planningCategory) + '"') + (visibleCandidateQuestions.length ? '<button class="danger-button button-small keyword-bulk-delete" type="button" data-action="delete-keyword-candidates" data-pack-id="' + escapeHtml(activePack?.id || "") + '" data-dimension="' + escapeHtml(ui.planningCategory) + '" title="删除已选择的候选问题" aria-label="删除已选择的候选问题" ' + (selectedCandidateQuestions.length ? "" : "disabled") + '>删除已选候选</button>' : "") + '</div>' : ""}<div class="topic-list">${resultItems}</div></section>
      <aside class="card"><div class="card-header"><div><h3>问题篮</h3><p>本次确认入库</p></div><span class="small-tag blue">${selectedQuestions.length} 个</span></div><div class="basket-list">${basket}</div><div class="basket-actions"><button class="primary-button" type="button" data-action="save-selected-questions" ${selectedQuestions.length ? "" : "disabled"}><span data-icon="book"></span>加入问题词库</button><button class="ghost-button" type="button" data-action="clear-questions" ${selectedQuestions.length ? "" : "disabled"}>清空选择</button></div></aside>
    </div>
  `;
}

function renderQuestionLibrary() {
  const line = activeBusinessLine();
  const questions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "active" && !planningQuestionTopics(question).some((topic) => topic.status !== "archived"));
  const selected = questions.filter((question) => question.selected);
  const rows = questions.map((question) => {
    const refs = planningQuestionReferences(question);
    const activeTopics = refs.topics.filter((topic) => topic.status !== "archived");
    const archivedTopics = refs.topics.filter((topic) => topic.status === "archived");
    const topicState = activeTopics.length ? `<span class="status-badge status-approved">${activeTopics.length} 个选题</span>` : archivedTopics.length ? `<span class="status-badge status-archived">${archivedTopics.length} 个已归档</span>` : '<span class="status-badge status-review">待生成</span>';
    const referenceText = refs.plans.length || refs.articles.length ? `${refs.plans.length} 计划 · ${refs.articles.length} 文章` : "暂无引用";
    const topicAction = activeTopics.length ? "" : `<button class="link-button" type="button" data-action="question-to-topic" data-question-id="${escapeHtml(question.id)}">生成选题</button>`;
    const coreKeywordText = (question.sourceCoreKeywords || []).join("、");
    return `<tr><td><input class="checkbox" type="checkbox" data-question-select="${question.id}" aria-label="选择问题 ${escapeHtml(question.question)}" ${question.selected ? "checked" : ""} /></td><td class="article-title-cell"><b>${escapeHtml(question.question)}</b><small>${escapeHtml(question.id)} · v${escapeHtml(question.version || 1)} · ${escapeHtml(question.source)}</small></td><td><b>${escapeHtml(question.sourceSeedKeyword || question.sourceKeyword)}</b>${coreKeywordText ? `<small style="display:block;color:var(--muted-2);margin-top:4px">核心词：${escapeHtml(coreKeywordText)}</small>` : ""}</td><td><span class="small-tag ${question.coverage === "未覆盖" ? "teal" : ""}">${escapeHtml(question.coverage)}</span></td><td>${topicState}</td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions">${topicAction}<button class="link-button" type="button" data-action="edit-question" data-question-id="${escapeHtml(question.id)}">编辑</button><button class="link-button danger-text" type="button" data-action="archive-question" data-question-id="${escapeHtml(question.id)}">归档</button></div></td></tr>`;
  }).join("");
  return `
    <section class="card toolbar-card question-add-bar"><div class="field grow"><label for="question-input">手动添加客户问题</label><input class="input ${ui.questionError ? "input-error" : ""}" id="question-input" value="${escapeHtml(ui.questionInput)}" placeholder="例如：制造企业如何开始做 AI 搜索优化？" autocomplete="off" />${ui.questionError ? '<small class="error-text">' + escapeHtml(ui.questionError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="add-question"><span data-icon="plus"></span>添加问题</button></section>
    <section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 问题词库</h3><p>关键词拓展、人工录入和监测缺口统一沉淀在这里；已归档问题可在归档管理中恢复。</p></div><span class="small-tag blue">${questions.length} 个问题</span></div>${questions.length ? '<div class="bulk-select-row table-select-row">' + renderSelectAllControl("question-library", questions.length, selected.length, "全选问题") + '</div>' : ""}<div class="table-scroll"><table class="data-table topic-center-table topic-management-table"><thead><tr><th></th><th>标准问题</th><th>来源种子词 / 核心词</th><th>覆盖</th><th>选题状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="help"></span><h3>还没有问题</h3><p>先到关键词拓展生成问题，或在上方手动添加。</p></div></div>'}</section>
    ${selected.length ? '<div class="selection-bar"><span>已选择 <b>' + selected.length + '</b> 个问题</span><button class="primary-button button-small" type="button" data-action="questions-to-topics" ' + (ui.topicGenerating ? "disabled" : "") + '><span data-icon="arrow"></span>' + (ui.topicGenerating ? "正在生成…" : "生成选题") + '</button></div>' : ""}
  `;
}

function renderTopicLibrary() {
  const line = activeBusinessLine();
  const topics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status !== "archived" && !planningTopicPlans(topic).length);
  const selectableTopics = topics.filter((topic) => topic.status === "active");
  const selected = selectableTopics.filter((topic) => topic.selected);
  const rows = topics.map((topic) => {
    const refs = planningTopicReferences(topic);
    const brief = topic.geoBrief || buildGeoTopicBrief(topic, refs.question);
    const question = refs.question;
    const plans = refs.plans;
    const articles = refs.articles;
    const article = articles[0];
    const isCandidate = topic.status === "candidate";
    const coreQuestion = topic.coreQuestion || brief.coreQuestion || question?.question || topic.title || "—";
    const lifecycle = isCandidate ? '<span class="status-badge status-review">待人工确认</span>' : article ? '<span class="status-badge status-approved">已创建内容</span>' : plans.length ? '<span class="status-badge status-publishing">已规划</span>' : '<span class="status-badge status-review">待计划</span>';
    const referenceText = `${plans.length} 计划 · ${articles.length} 文章`;
    const confirmAction = isCandidate ? `<button class="primary-button button-small" type="button" data-action="confirm-topic-candidate" data-topic-id="${escapeHtml(topic.id)}">确认入选题库</button>` : "";
    const directAction = isCandidate ? "" : `<button class="link-button topic-direct-button" type="button" data-action="direct-generate-topic" data-topic-id="${escapeHtml(topic.id)}">${article ? "查看文章" : "直接生成文章"}</button>`;
    const planAction = isCandidate || article ? "" : `<button class="link-button" type="button" data-action="topic-to-plan" data-topic-id="${escapeHtml(topic.id)}">加入计划</button>`;
    return `<tr><td><input class="checkbox" type="checkbox" data-topic-select="${topic.id}" aria-label="选择选题 ${escapeHtml(topic.title)}" ${topic.selected ? "checked" : ""} ${isCandidate ? "disabled" : ""} /></td><td class="article-title-cell"><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)}${isCandidate ? " · 待确认" : ""}</small></td><td class="article-title-cell"><b>${escapeHtml(coreQuestion)}</b></td><td><span class="source-tag">${escapeHtml(DIMENSIONS.find((item) => item.id === topic.dimension)?.label || topic.dimension)}</span></td><td><b>${topic.recommendation}</b><small style="display:block;color:var(--muted-2);margin-top:4px">模型建议强度</small></td><td>${lifecycle}</td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions">${confirmAction}${directAction}${planAction}<button class="link-button" type="button" data-action="edit-topic" data-topic-id="${escapeHtml(topic.id)}">编辑</button><button class="link-button danger-text" type="button" data-action="archive-topic" data-topic-id="${escapeHtml(topic.id)}">归档</button></div></td></tr>`;
  }).join("");
  return `
    <section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 选题库</h3><p>AI 生成的选题先由人工确认；确认后才能直接生成文章或加入计划。</p></div><span class="small-tag blue">${topics.length} 个选题</span></div>${selectableTopics.length ? '<div class="bulk-select-row table-select-row">' + renderSelectAllControl("topic-library", selectableTopics.length, selected.length, "全选已确认选题") + '</div>' : ""}<div class="table-scroll"><table class="data-table topic-center-table topic-management-table"><thead><tr><th></th><th>选题标题</th><th>核心回答问题</th><th>内容方向</th><th>优先级</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="clipboard"></span><h3>还没有选题</h3><p>到问题词库选择客户问题并生成选题。</p><button class="primary-button button-small" type="button" data-action="planning-tab" data-tab="questions">去问题词库</button></div></div>'}</section>
    ${selected.length ? '<div class="selection-bar"><span>已选择 <b>' + selected.length + '</b> 个选题</span><div><button class="ghost-button button-small" type="button" data-action="clear-topics">清空</button><button class="primary-button button-small" type="button" data-action="open-plan"><span data-icon="clock"></span>创建内容计划</button></div></div>' : ""}
  `;
}

function renderPlanningArchive() {
  const line = activeBusinessLine();
  const kind = ui.planningArchiveKind === "topics" ? "topics" : "questions";
  const archivedQuestions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "archived");
  const archivedTopics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "archived");
  const rows = kind === "questions"
    ? archivedQuestions.map((question) => {
      const refs = planningQuestionReferences(question);
      const referenceText = `${refs.topics.length} 选题 · ${refs.plans.length} 计划 · ${refs.articles.length} 文章`;
      const canDelete = !question.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length;
      return `<tr class="topic-row-archived"><td class="article-title-cell"><b>${escapeHtml(question.question)}</b><small>${escapeHtml(question.id)} · v${escapeHtml(question.version || 1)} · 归档于 ${formatRelative(question.archivedAt || question.updatedAt || question.createdAt)}</small></td><td>${escapeHtml(question.sourceKeyword || "—")}</td><td><span class="status-badge status-archived">已归档</span></td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions"><button class="secondary-button button-small" type="button" data-action="restore-planning-record" data-kind="question" data-record-id="${escapeHtml(question.id)}"><span data-icon="refresh"></span>恢复</button>${refs.topics.length || refs.plans.length || refs.articles.length ? `<button class="link-button" type="button" data-action="view-planning-relations" data-kind="question" data-record-id="${escapeHtml(question.id)}">引用详情</button>` : ""}<button class="danger-button button-small" type="button" data-action="request-delete-archive" data-kind="question" data-record-id="${escapeHtml(question.id)}" ${canDelete ? "" : "disabled"}>永久删除</button></div></td></tr>`;
    }).join("")
    : archivedTopics.map((topic) => {
      const refs = planningTopicReferences(topic);
      const referenceText = `${refs.plans.length} 计划 · ${refs.articles.length} 文章`;
      const canDelete = !refs.plans.length && !refs.articles.length;
      const brief = topic.geoBrief || buildGeoTopicBrief(topic, refs.question);
      const coreQuestion = topic.coreQuestion || brief.coreQuestion || refs.question?.question || topic.title || "—";
      return `<tr class="topic-row-archived"><td class="article-title-cell"><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)} · 归档于 ${formatRelative(topic.archivedAt || topic.updatedAt || topic.createdAt)}</small></td><td>${escapeHtml(coreQuestion)}</td><td><span class="source-tag">${escapeHtml(DIMENSIONS.find((item) => item.id === topic.dimension)?.label || topic.dimension || "未分类")}</span></td><td><b>${escapeHtml(topic.recommendation || "—")}</b><small style="display:block;color:var(--muted-2);margin-top:4px">模型建议强度</small></td><td><span class="status-badge status-archived">已归档</span></td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions"><button class="secondary-button button-small" type="button" data-action="restore-planning-record" data-kind="topic" data-record-id="${escapeHtml(topic.id)}"><span data-icon="refresh"></span>恢复</button>${refs.plans.length || refs.articles.length ? `<button class="link-button" type="button" data-action="view-planning-relations" data-kind="topic" data-record-id="${escapeHtml(topic.id)}">引用详情</button>` : ""}<button class="danger-button button-small" type="button" data-action="request-delete-archive" data-kind="topic" data-record-id="${escapeHtml(topic.id)}" ${canDelete ? "" : "disabled"}>永久删除</button></div></td></tr>`;
    }).join("");
  const total = archivedQuestions.length + archivedTopics.length;
  const table = kind === "questions"
    ? `<table class="data-table topic-center-table topic-management-table"><thead><tr><th>问题</th><th>来源关键词</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<table class="data-table topic-center-table topic-management-table"><thead><tr><th>选题</th><th>核心回答问题</th><th>内容方向</th><th>优先级</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<section class="archive-summary"><article class="card summary-card"><span data-icon="archive"></span><div><b>${total}</b><small>当前业务线归档项</small></div></article><article class="card summary-card"><span class="amber" data-icon="help"></span><div><b>${archivedQuestions.length}</b><small>归档问题</small></div></article><article class="card summary-card"><span class="purple" data-icon="clipboard"></span><div><b>${archivedTopics.length}</b><small>归档选题</small></div></article></section><section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 归档管理</h3><p>归档项不参与新的选题计划和文章生成，历史计划、文章与来源关系继续保留。</p></div><span class="small-tag blue">${total} 项</span></div><div class="archive-type-tabs" role="tablist"><button class="tab-button ${kind === "questions" ? "active" : ""}" type="button" data-action="planning-archive-kind" data-kind="questions">已归档问题 · ${archivedQuestions.length}</button><button class="tab-button ${kind === "topics" ? "active" : ""}" type="button" data-action="planning-archive-kind" data-kind="topics">已归档选题 · ${archivedTopics.length}</button></div>${rows ? `<div class="table-scroll">${table}</div>` : '<div class="archive-empty empty-state"><div><span data-icon="archive"></span><h3>这里还没有归档项</h3><p>在问题词库或选题库中归档后，可以在这里恢复。</p></div></div>'}</section>`;
}

function planStatusBadge(status) {
  const meta = { draft: ["待排期", "status-draft"], planned: ["待执行", "status-publishing"], produced: ["已创建内容", "status-approved"], completed: ["已完成", "status-success"] }[status] || [status, "status-draft"];
  return '<span class="status-badge ' + meta[1] + '">' + escapeHtml(meta[0]) + "</span>";
}

function renderContentPlans() {
  const line = activeBusinessLine();
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === line?.id);
  const rows = plans.map((plan) => {
    const { scope, approved } = planKnowledgeSummary(plan);
    const changes = scope.addedBaseIds.length || scope.excludedBaseIds.length ? `增补 ${scope.addedBaseIds.length} · 排除 ${scope.excludedBaseIds.length}` : "按默认知识包";
    const agentSnapshot = plan.writingAgentSnapshot;
    const agentCurrent = writingAgentById(agentSnapshot?.agentId || plan.writingAgentId);
    const versionHint = agentCurrent && Number(agentCurrent.version) > Number(agentSnapshot?.version || 0) ? " · 有新版" : "";
    const agentCell = agentSnapshot ? `<b>${escapeHtml(agentSnapshot.nameSnapshot)}</b><small style="display:block;color:var(--muted-2);margin-top:4px">v${escapeHtml(agentSnapshot.version)}${versionHint}</small>` : '<span class="status-badge status-review">未选择</span>';
    return `<tr><td class="article-title-cell"><b>${escapeHtml(plan.name)}</b><small>${plan.id} · 创建于 ${formatRelative(plan.createdAt)}</small></td><td><b>${plan.topicIds.length}</b> 个选题</td><td>${agentCell}</td><td><button class="knowledge-count-button" type="button" data-action="preview-plan-knowledge" data-plan-id="${plan.id}"><b>${scope.resolvedBaseIds.length}</b> 库 · <b>${approved}</b> 条</button><small style="display:block;color:var(--muted-2);margin-top:4px">${changes}</small></td><td>${escapeHtml(plan.scheduledFor)}</td><td>${escapeHtml(plan.owner)}</td><td>${escapeHtml(plan.contentType)}</td><td>${planStatusBadge(plan.status)}</td><td><button class="link-button" type="button" data-action="${plan.status === "produced" ? "view-plan-content" : "execute-plan"}" data-plan-id="${plan.id}">${plan.status === "produced" ? "查看内容" : "创建内容任务"}</button></td></tr>`;
  }).join("");
  const planned = plans.filter((plan) => ["draft", "planned"].includes(plan.status)).length;
  const produced = plans.filter((plan) => plan.status === "produced").length;
  return `
    <section class="topic-plan-summary"><article class="card summary-card"><span data-icon="clock"></span><div><b>${plans.length}</b><small>全部计划</small></div></article><article class="card summary-card"><span class="amber" data-icon="clipboard"></span><div><b>${planned}</b><small>等待执行</small></div></article><article class="card summary-card"><span class="green" data-icon="file"></span><div><b>${produced}</b><small>已创建内容</small></div></article></section>
    <section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 内容计划</h3><p>计划同时冻结选题来源、写作智能体版本和企业知识范围，再创建文章任务</p></div><button class="secondary-button button-small" type="button" data-action="planning-tab" data-tab="topics"><span data-icon="plus"></span>从选题创建</button></div><div class="table-scroll"><table class="data-table topic-center-table"><thead><tr><th>计划</th><th>选题</th><th>写作智能体</th><th>知识范围</th><th>计划日期</th><th>负责人</th><th>形式</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="clock"></span><h3>还没有内容计划</h3><p>先到选题库选择选题，再安排日期、负责人、写作智能体和知识范围。</p></div></div>'}</section>
  `;
}

function renderPlanning() {
  const actions = ui.planningTab === "keywords"
    ? '<button class="secondary-button" type="button" data-action="export-pack"><span data-icon="download"></span>导出词包</button><button class="primary-button" type="button" data-action="focus-business-keyword"><span data-icon="plus"></span>添加关键词</button>'
    : ui.planningTab === "questions"
      ? '<button class="primary-button" type="button" data-action="focus-question"><span data-icon="plus"></span>手动添加问题</button>'
      : ui.planningTab === "topics"
        ? '<button class="primary-button" type="button" data-action="open-plan"><span data-icon="clock"></span>创建内容计划</button>'
        : ui.planningTab === "plans"
          ? '<button class="primary-button" type="button" data-action="planning-tab" data-tab="topics"><span data-icon="plus"></span>从选题创建计划</button>'
          : '<button class="secondary-button" type="button" data-action="planning-archive-kind" data-kind="questions"><span data-icon="help"></span>查看归档问题</button>';
  const panel = ui.planningTab === "keywords" ? renderKeywordWorkspace() : ui.planningTab === "questions" ? renderQuestionLibrary() : ui.planningTab === "topics" ? renderTopicLibrary() : ui.planningTab === "plans" ? renderContentPlans() : renderPlanningArchive();
  return `<div class="page-container">${pageHead("选题中心", "按业务线维护关键词、客户问题、内容选题和执行计划。", actions)}<div class="tabs-row topic-center-tab-row">${planningTabs()}<span class="health"><i></i>来源链完整</span></div>${renderBusinessScope()}${panel}</div>`;
}

function contentSectionTabs() {
  const items = [
    ["studio", "AI 创作台", "edit", "直接生成"],
    ["articles", "文章任务", "file", state.articles.length],
    ["agents", "写作智能体", "sparkle", (state.writingAgents || []).filter((agent) => agent.status === "active").length]
  ];
  return '<div class="content-section-tabs" role="tablist">' + items.map(([id, label, iconName, count]) => `<button class="${ui.contentView === id ? "active" : ""}" type="button" data-action="content-view" data-view="${id}"><span data-icon="${iconName}"></span><span><b>${label}</b><small>${id === "studio" ? count : count + (id === "articles" ? " 篇" : " 个启用")}</small></span></button>`).join("") + "</div>";
}

function writingAgentCard(agent) {
  const lineNames = !agent.businessLineIds?.length
    ? ["全部业务线"]
    : agent.businessLineIds.map((id) => state.businessLines.find((line) => line.id === id)?.name).filter(Boolean);
  const defaultLines = state.businessLines.filter((line) => line.status === "active" && line.defaultWritingAgentId === agent.id).map((line) => line.name);
  const usage = writingAgentUsageCount(agent.id) || agent.usageCount || 0;
  const inactive = agent.status !== "active";
  const actions = agent.builtIn
    ? `<button class="secondary-button button-small" type="button" data-action="open-writing-agent" data-agent-id="${agent.id}">查看配置</button><button class="primary-button button-small" type="button" data-action="copy-writing-agent" data-agent-id="${agent.id}">复制后编辑</button>`
    : `<button class="secondary-button button-small" type="button" data-action="open-writing-agent" data-agent-id="${agent.id}">编辑</button><button class="ghost-button button-small" type="button" data-action="copy-writing-agent" data-agent-id="${agent.id}">复制</button><button class="ghost-button button-small" type="button" data-action="toggle-writing-agent" data-agent-id="${agent.id}">${inactive ? "恢复" : "停用"}</button>`;
  return `
    <article class="card writing-agent-card ${inactive ? "inactive" : ""}">
      <div class="writing-agent-card-head">
        <span class="writing-agent-avatar ${escapeHtml(agent.color || "blue")}">${escapeHtml(agent.avatar || agent.name.slice(0, 1))}</span>
        <div class="writing-agent-title"><div><h3>${escapeHtml(agent.name)}</h3>${agent.builtIn ? '<span class="small-tag blue">系统内置</span>' : '<span class="small-tag teal">企业自建</span>'}${inactive ? '<span class="status-badge status-draft">已停用</span>' : '<span class="status-badge status-approved">启用中</span>'}</div><p>${escapeHtml(agent.description)}</p></div>
        <span class="writing-agent-version">v${escapeHtml(agent.version)}</span>
      </div>
      <div class="writing-agent-profile"><div><span>写作角色</span><b>${escapeHtml(agent.role)}</b></div><div><span>风格</span><b>${escapeHtml(agent.style)}</b></div><div><span>知识规则</span><b>${agent.strictKnowledge ? "严格知识 · " : "普通知识 · "}${agent.citationsRequired ? "逐条引用" : "不强制引用"}</b></div></div>
      <div class="writing-agent-tags">${lineNames.map((name) => '<span class="small-tag">' + escapeHtml(name) + '</span>').join("")}${(agent.contentTypes || []).map((type) => '<span class="small-tag blue">' + escapeHtml(type) + '</span>').join("")}</div>
      ${defaultLines.length ? '<div class="agent-default-note"><span data-icon="check"></span>' + escapeHtml(defaultLines.join("、")) + ' 默认使用</div>' : ""}
      <div class="writing-agent-card-foot"><span>使用 ${usage} 次 · 更新于 ${formatRelative(agent.updatedAt)}</span><div>${actions}${agent.status === "active" && writingAgentSupports(agent, activeBusinessLine()?.id) && !defaultLines.includes(activeBusinessLine()?.name) ? '<button class="text-button" type="button" data-action="set-default-writing-agent" data-agent-id="' + agent.id + '">设为当前业务线默认</button>' : ""}</div></div>
    </article>
  `;
}

function renderWritingAgents() {
  const builtIn = (state.writingAgents || []).filter((agent) => agent.builtIn).map(writingAgentCard).join("");
  const custom = (state.writingAgents || []).filter((agent) => !agent.builtIn).map(writingAgentCard).join("");
  return `
    <div class="page-container">
      ${pageHead("写作智能体", "把可复用的写作角色、结构、语气和知识使用规则保存下来，创建内容时按需选择。", '<button class="primary-button" type="button" data-action="create-writing-agent"><span data-icon="plus"></span>创建智能体</button>')}
      ${contentSectionTabs()}
      <section class="writing-agent-principle"><span data-icon="info"></span><div><b>写作智能体决定怎么写</b><p>企业知识决定依据什么事实写，AI 模型决定用什么执行。智能体只能在内容计划冻结的知识范围内调整写法和召回顺序。</p></div></section>
      <section class="writing-agent-group"><div class="writing-agent-group-head"><div><h3>系统内置</h3><p>稳定的基础写作能力不可直接修改，可以复制成企业自己的版本。</p></div><span>${(state.writingAgents || []).filter((agent) => agent.builtIn).length} 个</span></div><div class="writing-agent-grid">${builtIn}</div></section>
      <section class="writing-agent-group"><div class="writing-agent-group-head"><div><h3>企业自建</h3><p>按业务、内容类型和品牌口吻维护；修改后版本递增，历史文章继续使用原快照。</p></div><span>${(state.writingAgents || []).filter((agent) => !agent.builtIn).length} 个</span></div><div class="writing-agent-grid">${custom || '<div class="card empty-state"><div><span data-icon="sparkle"></span><h3>还没有自定义智能体</h3><p>复制系统模板或从零创建一个。</p></div></div>'}</div></section>
    </div>
  `;
}

function studioWorkspaceById(workspaceId) {
  return (state.writingWorkspaces || []).find((workspace) => workspace.id === workspaceId) || null;
}

function studioConversationById(conversationId) {
  return (state.aiConversations || []).find((conversation) => conversation.id === conversationId) || null;
}

function studioConversationForWorkspace(workspace) {
  if (!workspace) return null;
  return studioConversationById(workspace.conversationId) || (state.aiConversations || []).find((conversation) => conversation.workspaceId === workspace.id) || null;
}

function studioArticleForWorkspace(workspace) {
  return workspace?.articleId ? state.articles.find((article) => article.id === workspace.articleId) || null : null;
}

function studioContentHash(content) {
  const value = String(content || "").replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "h" + (hash >>> 0).toString(36);
}

function studioWorkspaceTopic(workspace, article = studioArticleForWorkspace(workspace)) {
  if (article?.topicSnapshot) return article.topicSnapshot;
  const linked = article?.topicId ? state.topics.find((topic) => topic.id === article.topicId) : null;
  return linked || workspace?.topic || { source: "custom", id: null, title: "", keyword: "", intent: "直接创作" };
}

function studioKnowledgeBases(workspace) {
  const scopeIds = workspace?.knowledgeScope?.resolvedBaseIds || [];
  return scopeIds.map(knowledgeBaseById).filter((base) => base && base.status !== "archived");
}

function studioApprovedKnowledgeEntries(workspace) {
  return studioKnowledgeBases(workspace).flatMap((base) => approvedKnowledgeItems(base.id).map((item) => ({
    base,
    item,
    version: knowledgeVersionById(item.latestVersionId)
  }))).filter((entry) => entry.version);
}

function studioKnowledgeAssets(workspace) {
  const allowed = new Set(workspace?.knowledgeScope?.resolvedBaseIds || []);
  return (state.contentAssets || []).filter((asset) => {
    if (asset.kind !== "knowledge_image" || asset.archived || asset.reviewStatus !== "approved" || !allowed.has(asset.knowledgeBaseId)) return false;
    if (asset.legacyImageCard && !asset.itemId && !asset.versionId) return true;
    const item = knowledgeItemById(asset.itemId);
    const version = knowledgeVersionById(asset.versionId);
    return item?.status === "approved" && item.latestVersionId === asset.versionId && version?.reviewStatus === "approved";
  });
}

function createStudioWorkspace(article = null) {
  const linkedPlan = contentPlanForArticle(article);
  const line = state.businessLines.find((item) => item.id === (article?.businessLineId || linkedPlan?.businessLineId)) || activeBusinessLine();
  const knownContentTypes = ["深度文章", "问答文章", "案例解读", "系列文章"];
  const contentType = linkedPlan?.contentType || (knownContentTypes.includes(article?.category) ? article.category : "深度文章");
  const agentSnapshot = cloneData(article?.generationSnapshot?.writingAgent);
  const agent = writingAgentById(agentSnapshot?.agentId) || defaultAgentForLine(line, contentType);
  const inheritedBaseIds = article?.knowledgeSnapshot?.resolvedBaseIds || inheritedKnowledgeBaseIds(line);
  const now = Date.now();
  const workspaceId = uid("WS");
  const conversationId = uid("CHAT");
  const linkedTopic = article?.topicId ? state.topics.find((topic) => topic.id === article.topicId) : null;
  const topic = cloneData(article?.topicSnapshot || linkedTopic || { source: "custom", id: null, title: "", keyword: "", intent: "直接创作" });
  const snapshot = agentSnapshot || snapshotWritingAgent(agent, { selectionSource: article ? "article_workspace" : "quick_create" });
  const workspace = {
    id: workspaceId,
    mode: article ? "article" : "quick",
    sourceType: article?.sourceType || (article ? "content_task" : "quick_create"),
    articleId: article?.id || null,
    status: article ? "draft" : "blank",
    businessLineId: line?.id || null,
    businessLineSnapshot: line ? { id: line.id, name: line.name, product: line.product } : null,
    topic,
    draftTitle: article ? "" : (topic.title || ""),
    draftContent: "",
    draftContentHtml: "",
    contentType,
    knowledgeScope: {
      inheritedBaseIds: cloneData(inheritedBaseIds),
      addedBaseIds: cloneData(article?.knowledgeSnapshot?.addedBaseIds || []),
      excludedBaseIds: cloneData(article?.knowledgeSnapshot?.excludedBaseIds || []),
      resolvedBaseIds: cloneData(inheritedBaseIds),
      snapshottedAt: new Date(now).toISOString(),
      lockedVersionIds: cloneData(article?.knowledgeSnapshot?.lockedVersionIds || [])
    },
    selectedKnowledgeBaseIds: cloneData(inheritedBaseIds),
    selectedKnowledgeItemIds: [],
    writingAgentId: snapshot?.agentId || agent?.id || null,
    writingAgentSnapshot: snapshot,
    conversationId,
    attachmentIds: [],
    assetIds: cloneData(article?.assetIds || []),
    createdAt: now,
    updatedAt: now
  };
  const conversation = {
    id: conversationId,
    workspaceId,
    articleId: article?.id || null,
    status: "active",
    selectedAgentId: agent?.id || snapshot?.agentId || null,
    selectedKnowledgeBaseIds: cloneData(inheritedBaseIds),
    selectedKnowledgeItemIds: [],
    webSearchEnabled: false,
    attachments: [],
    imageIds: cloneData(article?.assetIds || []),
    messages: [{
      id: uid("MSG"),
      role: "assistant",
      text: article
        ? "文章已载入创作台。我会基于当前版本、已冻结的企业知识和你选择的写作智能体提出修改建议；在你点击应用前，我不会改动正文。"
        : "告诉我这篇文章要解决的问题。生成初稿后，你可以继续让我调整结构、标题或段落；所有建议都会先预览，再由你决定是否应用。",
      createdAt: now,
      agentSnapshot: snapshot,
      contextSnapshot: { businessLineId: line?.id || null, articleVersion: article?.version || null, knowledgeBaseIds: cloneData(inheritedBaseIds), webSearchEnabled: false }
    }],
    createdAt: now,
    updatedAt: now
  };
  state.writingWorkspaces = state.writingWorkspaces || [];
  state.aiConversations = state.aiConversations || [];
  state.writingWorkspaces.unshift(workspace);
  state.aiConversations.unshift(conversation);
  if (article) {
    article.workspaceId = workspace.id;
    article.sourceType = article.sourceType || "content_task";
  }
  return workspace;
}

function ensureStudioWorkspace(articleId = null, forceNew = false) {
  let article = articleId ? state.articles.find((item) => item.id === articleId) : null;
  let workspace = null;
  if (article && !forceNew) workspace = studioWorkspaceById(article.workspaceId) || (state.writingWorkspaces || []).find((item) => item.articleId === article.id) || null;
  if (!article && !forceNew) workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace) workspace = createStudioWorkspace(article);
  article = studioArticleForWorkspace(workspace);
  const conversation = studioConversationForWorkspace(workspace);
  if (ui.studioWorkspaceId !== workspace.id) ui.studioPicker = null;
  ui.studioWorkspaceId = workspace.id;
  ui.studioArticleId = article?.id || null;
  ui.studioTopicDraft = workspace.topic?.title || "";
  ui.studioContentType = workspace.contentType || article?.category || "深度文章";
  ui.studioAgentId = conversation?.selectedAgentId || workspace.writingAgentId || null;
  ui.studioWebSearch = Boolean(conversation?.webSearchEnabled);
  saveState();
  return workspace;
}

function openContentStudio(articleId = null, options = {}) {
  ui.studioPicker = null;
  ensureStudioWorkspace(articleId, Boolean(options.forceNew));
  ui.contentView = "studio";
  ui.studioPane = "editor";
  ui.studioComposerDraft = "";
  closeModal();
  navigate("content");
  window.setTimeout(() => {
    const target = document.getElementById("studio-title-editor") || document.getElementById("studio-composer-input");
    target?.focus();
  }, 40);
}

function renderStudioMessage(message, conversation) {
  const role = message.role || "assistant";
  const agent = message.agentSnapshot;
  const avatar = role === "user" ? "我" : role === "system" ? "系" : escapeHtml(writingAgentById(agent?.agentId)?.avatar || agent?.nameSnapshot?.slice(0, 1) || "AI");
  const sources = (message.sources || []).map((source, index) => `<div class="studio-source-card ${source.sourceType === "web" ? "web" : ""}"><b>${source.sourceType === "web" ? "WEB" + (index + 1) : "K" + (index + 1)}</b><span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.meta || source.url || "企业知识")}</small></span></div>`).join("");
  const proposal = message.proposal;
  const proposalHtml = proposal ? `<section class="studio-proposal-card"><header><strong>${escapeHtml(proposal.label || "AI 修改建议")}</strong><small>${proposal.status === "applied" ? "已应用到 " + escapeHtml(proposal.appliedVersion || "当前版本") : proposal.status === "discarded" ? "已放弃" : "尚未修改正文"}</small></header><div class="studio-proposal-diff"><div class="remove">原结构：${escapeHtml(proposal.before || "当前正文")}</div><div class="add">建议结构：${escapeHtml(proposal.after || proposal.title || "新方案")}</div></div>${proposal.status === "pending" ? `<div class="studio-proposal-actions"><button class="primary-button" type="button" data-action="apply-studio-proposal" data-message-id="${message.id}"><span data-icon="check"></span>${proposal.kind === "title" ? "采用标题" : proposal.kind === "insert" ? "插入正文" : "应用到正文"}</button><button class="secondary-button" type="button" data-action="copy-studio-proposal" data-message-id="${message.id}">仅复制</button><button class="ghost-button" type="button" data-action="discard-studio-proposal" data-message-id="${message.id}">放弃</button></div>` : ""}</section>` : "";
  const attachmentNote = (message.attachments || []).length ? `<p><small>本次参考附件：${message.attachments.map((item) => escapeHtml(item.name)).join("、")}（临时资料，未进入企业知识库）</small></p>` : "";
  return `<div class="studio-message ${role}">${role === "user" ? "" : `<span class="studio-message-avatar">${avatar}</span>`}<div class="studio-message-card"><p>${escapeHtml(message.text || "").replace(/\n/g, "<br>")}</p>${attachmentNote}${sources}${proposalHtml}</div>${role === "user" ? `<span class="studio-message-avatar">${avatar}</span>` : ""}</div>`;
}

function renderStudioPicker(workspace, conversation) {
  if (!ui.studioPicker) return "";
  if (ui.studioPicker === "knowledge") {
    const selected = new Set(conversation?.selectedKnowledgeItemIds || []);
    const rows = studioApprovedKnowledgeEntries(workspace).map(({ base, item, version }) => `<button class="studio-picker-item ${selected.has(item.id) ? "selected" : ""}" type="button" data-action="toggle-studio-knowledge" data-item-id="${item.id}"><span class="studio-picker-thumb" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(item.title || item.question)}</b><small>${escapeHtml(base.name)} · v${escapeHtml(version.version)} · 已审核</small></span><em>${selected.has(item.id) ? "已引用" : "引用"}</em></button>`).join("");
    return `<div class="studio-inline-picker"><div class="studio-picker-head"><div><h4>引用企业知识 / 文件</h4><p>只显示当前业务线授权范围内的已审核版本</p></div><button class="icon-button" type="button" data-action="close-studio-picker"><span data-icon="x"></span></button></div><div class="studio-picker-list">${rows || '<div class="studio-empty-chat"><div><span data-icon="book"></span><b>没有可引用知识</b><p>请先在企业知识中审核资料。</p></div></div>'}</div></div>`;
  }
  if (ui.studioPicker === "knowledge-image") {
    const rows = studioKnowledgeAssets(workspace).map((asset) => `<button class="studio-picker-item" type="button" data-action="insert-studio-asset" data-asset-id="${asset.id}"><span class="studio-picker-thumb ${escapeHtml(asset.accent || "blue")}" data-icon="image"></span><span><b>${escapeHtml(asset.name)}</b><small>${escapeHtml(asset.caption)} · ${escapeHtml(asset.license)} · 已审核</small></span><em>${studioArticleForWorkspace(workspace) ? "插入" : "选择"}</em></button>`).join("");
    return `<div class="studio-inline-picker"><div class="studio-picker-head"><div><h4>知识库图片</h4><p>只显示已审核且在当前知识范围内的图片</p></div><button class="icon-button" type="button" data-action="close-studio-picker"><span data-icon="x"></span></button></div><div class="studio-picker-list">${rows || '<div class="studio-empty-chat"><div><span data-icon="image"></span><b>没有可用图片</b><p>当前业务线知识库中暂无已审核图片。</p></div></div>'}</div></div>`;
  }
  return `<div class="studio-inline-picker"><div class="studio-picker-head"><div><h4>插入图片</h4><p>图片会保留来源、版权和审核状态</p></div><button class="icon-button" type="button" data-action="close-studio-picker"><span data-icon="x"></span></button></div><div class="studio-picker-list"><button class="studio-picker-item" type="button" data-action="generate-studio-image"><span class="studio-picker-thumb" data-icon="sparkle"></span><span><b>AI 配图占位（演示）</b><small>创建待确认的配图占位；正式部署后接入图片生成与对象存储</small></span><em>生成</em></button><button class="studio-picker-item" type="button" data-action="trigger-studio-image-upload"><span class="studio-picker-thumb" data-icon="upload"></span><span><b>上传本地图片</b><small>仅保存文件元数据，正式版上传到客户对象存储</small></span><em>上传</em></button><button class="studio-picker-item" type="button" data-action="open-studio-knowledge-images"><span class="studio-picker-thumb" data-icon="database"></span><span><b>从知识库图片选择</b><small>只使用已审核、已授权的企业图片</small></span><em>选择</em></button></div></div>`;
}

function renderStudioChat(workspace, conversation, article) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const selectedAgent = writingAgentById(conversation?.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  const agents = activeWritingAgents(line?.id, workspace.contentType || article?.category || null);
  const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
  const messages = (conversation?.messages || []).map((message) => renderStudioMessage(message, conversation)).join("");
  const knowledgeChips = (conversation?.selectedKnowledgeItemIds || []).map((itemId) => knowledgeItemById(itemId)).filter(Boolean).map((item) => `<span class="studio-selection-chip"><span data-icon="book"></span><b>${escapeHtml(item.title || item.question)}</b><button type="button" data-action="remove-studio-context" data-kind="knowledge" data-id="${item.id}"><span data-icon="x"></span></button></span>`).join("");
  const attachmentChips = (workspace.attachmentIds || []).map((assetId) => (state.contentAssets || []).find((asset) => asset.id === assetId)).filter(Boolean).map((asset) => `<span class="studio-selection-chip"><span data-icon="paperclip"></span><b>${escapeHtml(asset.name)}</b><button type="button" data-action="remove-studio-context" data-kind="attachment" data-id="${asset.id}"><span data-icon="x"></span></button></span>`).join("");
  const imageChips = (conversation?.imageIds || []).map((assetId) => (state.contentAssets || []).find((asset) => asset.id === assetId)).filter(Boolean).map((asset) => `<span class="studio-selection-chip"><span data-icon="image"></span><b>${escapeHtml(asset.name)}</b><button type="button" data-action="remove-studio-context" data-kind="image" data-id="${asset.id}"><span data-icon="x"></span></button></span>`).join("");
  return `<aside class="studio-chat-panel"><div class="studio-chat-head"><div><h3>AI 协作</h3><p>先给建议，再由你决定是否写入正文</p></div><div class="studio-chat-head-actions"><button class="icon-button" type="button" data-action="new-studio-conversation" title="新对话"><span data-icon="plus"></span></button><button class="icon-button" type="button" data-action="studio-pane" data-pane="info" title="文章信息"><span data-icon="info"></span></button></div></div><div class="studio-chat-context"><b>${article ? "当前全文" : "创作准备"}</b><span class="studio-context-chip blue"><span data-icon="sparkle"></span><b>${escapeHtml(selectedAgent?.name || "未选择智能体")}</b></span>${conversation?.webSearchEnabled ? '<span class="studio-context-chip teal"><span data-icon="globe"></span><b>联网检索演示</b></span>' : ""}</div><div class="studio-chat-messages">${messages || '<div class="studio-empty-chat"><div><span data-icon="sparkle"></span><b>从一个具体要求开始</b><p>例如：改成采购决策结构，并保留企业知识引用。</p></div></div>'}</div><div class="studio-composer">${renderStudioPicker(workspace, conversation)}<div class="studio-selected-context">${knowledgeChips}${attachmentChips}${imageChips}</div><textarea class="studio-composer-input" id="studio-composer-input" placeholder="例如：把文章改成采购决策结构，先给我看大纲差异…">${escapeHtml(ui.studioComposerDraft)}</textarea><div class="studio-composer-toolbar"><select class="studio-agent-select" id="studio-chat-agent" aria-label="选择写作智能体">${agentOptions}</select><button class="studio-tool-button teal ${conversation?.webSearchEnabled ? "active" : ""}" type="button" data-action="toggle-studio-web" title="联网检索演示（未接入真实搜索服务）"><span data-icon="globe"></span><span>联网演示</span></button><button class="studio-tool-button" type="button" data-action="open-studio-image-picker" title="插入图片"><span data-icon="image"></span></button><button class="studio-tool-button ${(workspace.attachmentIds || []).length ? "has-value" : ""}" type="button" data-action="trigger-studio-attachment" title="上传附件"><span data-icon="paperclip"></span></button><button class="studio-tool-button ${(conversation?.selectedKnowledgeItemIds || []).length ? "has-value" : ""}" type="button" data-action="open-studio-knowledge-picker" title="引用知识库或文件"><span data-icon="quote"></span><span>@知识</span></button><button class="studio-tool-button ${(conversation?.imageIds || []).length ? "has-value" : ""}" type="button" data-action="open-studio-knowledge-images" title="知识库图片"><span data-icon="database"></span></button><button class="studio-send-button" type="button" data-action="send-studio-chat" ${ui.studioComposerDraft.trim() ? "" : "disabled"} aria-label="发送"><span data-icon="send"></span></button></div><input id="studio-attachment-input" type="file" hidden multiple /><input id="studio-image-input" type="file" accept="image/*" hidden /></div></aside>`;
}

function renderStudioInfo(workspace, article) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const citations = article ? articleCitations(article) : [];
  const agent = article?.generationSnapshot?.writingAgent || workspace.writingAgentSnapshot;
  return `<aside class="studio-info-pane"><h3>文章信息</h3><section class="studio-info-card"><h4>当前上下文</h4><div class="side-list"><div><span>业务线</span><b>${escapeHtml(line?.name || "未设置")}</b></div><div><span>来源</span><b>${workspace.mode === "quick" ? "直接创作" : "文章任务"}</b></div><div><span>内容形式</span><b>${escapeHtml(workspace.contentType)}</b></div><div><span>写作智能体</span><b>${escapeHtml(agent?.nameSnapshot || "未选择")} ${agent ? "v" + escapeHtml(agent.version) : ""}</b></div></div></section><section class="studio-info-card"><h4>审核与版本</h4><div class="side-list"><div><span>文章版本</span><b>${escapeHtml(article?.version || "尚未生成")}</b></div><div><span>审核状态</span><b>${article ? (article.reviewStatus === "approved" ? "已通过" : "待审核") : "—"}</b></div><div><span>风控状态</span><b>${article ? (article.riskStatus === "clean" ? "已通过" : article.riskStatus === "stale" ? "已过期" : "待检测") : "—"}</b></div></div></section><section class="studio-info-card"><h4>知识与素材</h4><p>已授权 ${studioKnowledgeBases(workspace).length} 个知识库，正文锁定 ${citations.length} 条企业事实引用；会话附件 ${(workspace.attachmentIds || []).length} 个，文章图片 ${(workspace.assetIds || []).length} 张。</p></section><section class="studio-info-card"><h4>安全边界</h4><p>联网结果和临时附件只作为本次对话参考，不能替代已审核企业知识。AI 建议应用后会创建文章新版本，并重新进入审核与风控。</p></section></aside>`;
}

function renderStudioRichToolbar() {
  return `<div class="studio-editor-toolbar studio-editor-toolbar-rich" aria-label="文章编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button studio-format-wide" type="button" data-action="studio-format" data-command="formatBlock" data-value="p" title="正文">正文⌄</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="blockquote" title="引用">❝</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="underline" title="下划线"><u>U</u></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button></div><div class="studio-toolbar-group"><button class="studio-format-button studio-format-wide" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">标题 2</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertOrderedList" title="有序列表">1.</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="justifyLeft" title="左对齐">☰</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="justifyCenter" title="居中">≡</button></div><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-link" title="插入链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="undo" title="撤销">↶</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="redo" title="重做">↷</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="removeFormat" title="清除格式">⌫</button></div></div>`;
}

function renderStudioTextEditor(workspace) {
  const draftTitle = workspace.draftTitle || workspace.topic?.title || "";
  const draftContent = workspace.draftContent || "";
  const bodyHtml = workspace.draftContentHtml || escapeHtml(draftContent).replace(/\n/g, "<br>");
  return `<main class="studio-editor-panel studio-quick-editor"><div class="studio-editor-head"><div><h3>文章编辑器</h3><p>直接编辑标题和正文；写作与修改要求请在右侧 AI 协作中沟通</p></div><span class="status-badge status-draft">编辑中</span></div>${renderStudioRichToolbar()}<textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(draftTitle)}</textarea><article class="studio-editor-body studio-quick-content" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${bodyHtml}</article></main>`;
}

function renderStudioQuickEditor(workspace) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId) || activeBusinessLine();
  const lines = state.businessLines.filter((item) => item.status === "active").map((item) => `<option value="${item.id}" ${item.id === line?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  const agents = activeWritingAgents(line?.id, workspace.contentType);
  const selectedAgent = writingAgentById(workspace.writingAgentId) || defaultAgentForLine(line, workspace.contentType);
  const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
  const approved = studioApprovedKnowledgeEntries(workspace).length;
  const draftTitle = workspace.draftTitle || workspace.topic?.title || "";
  const draftContent = workspace.draftContent || "";
  const bodyHtml = workspace.draftContentHtml || escapeHtml(draftContent).replace(/\n/g, "<br>");
  return `<main class="studio-editor-panel studio-quick-editor"><div class="studio-editor-head"><div><h3>直接生成文章</h3><p>先写标题和正文，也可以直接在右侧 AI 协作里提出写作要求</p></div><span class="status-badge status-draft">准备中</span></div><div class="studio-editor-toolbar" aria-label="编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">H2</button></div><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-link" title="链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="open-studio-image-picker" title="图片"><span data-icon="image"></span></button></div></div><textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(draftTitle)}</textarea><article class="studio-editor-body studio-quick-content" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${bodyHtml}</article><section class="studio-quick-settings"><div class="studio-quick-settings-grid"><label class="studio-field"><span>产品 / 业务线</span><select class="select" id="studio-business-line">${lines}</select></label><label class="studio-field"><span>内容形式</span><select class="select" id="studio-content-type">${["深度文章", "问答文章", "案例解读", "系列文章"].map((type) => `<option ${type === workspace.contentType ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="studio-field full"><span>写作智能体</span><select class="select" id="studio-direct-agent">${agentOptions}</select></label></div><div class="studio-knowledge-summary ${approved ? "" : "warning"}"><span data-icon="${approved ? "database" : "alert"}"></span><span><b>${studioKnowledgeBases(workspace).length} 个知识库 · ${approved} 条已审核知识可用</b><small>${approved ? "生成后锁定企业知识版本；联网结果不会成为企业事实。" : "请先在企业知识中补充并审核资料。"}</small></span></div><button class="primary-button studio-quick-generate" type="button" data-action="generate-studio-article" ${approved && selectedAgent ? "" : "disabled"}><span data-icon="sparkle"></span>${ui.studioGenerating ? "正在生成…" : "生成文章初稿"}</button></section></main>`;
}

function renderStudioArticleTextEditor(article) {
  const citations = articleCitations(article);
  const status = article.reviewStatus === "approved" ? '<span class="status-badge status-approved">已审核</span>' : '<span class="status-badge status-review">待审核</span>';
  return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>文章正文</h3><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${citations.length} 条企业知识引用</p></div>${status}</div>${renderStudioRichToolbar()}<textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(article.title)}</textarea><article class="studio-editor-body" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${articleContentForEditor(article, citations)}</article></main>`;
}

function renderStudioEditor(workspace, article) {
  if (!article) return renderStudioTextEditor(workspace);
  return renderStudioArticleTextEditor(article);
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId) || activeBusinessLine();
  if (!article) {
    const lines = state.businessLines.filter((item) => item.status === "active").map((item) => `<option value="${item.id}" ${item.id === line?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    const agents = activeWritingAgents(line?.id, workspace.contentType);
    const selectedAgent = writingAgentById(workspace.writingAgentId) || defaultAgentForLine(line, workspace.contentType);
    const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
    const approved = studioApprovedKnowledgeEntries(workspace).length;
    return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>直接生成文章</h3><p>不必先创建内容计划，但仍会冻结智能体和企业知识版本</p></div><span class="status-badge status-draft">准备中</span></div><div class="studio-empty-canvas"><div><span class="studio-empty-icon" data-icon="sparkle"></span><p class="studio-empty-prompt"><strong>今天要写什么？</strong>输入主题、客户问题或具体写作要求，系统会先核对业务线、智能体和知识范围。</p><div class="studio-generate-grid"><div class="studio-field full"><label for="studio-topic-input">主题 / 客户问题 *</label><textarea class="textarea" id="studio-topic-input" rows="4" placeholder="例如：工业品企业应该如何选择 GEO 服务商？">${escapeHtml(ui.studioTopicDraft || workspace.topic?.title || "")}</textarea><small>直接输入不会自动加入选题库；生成时只保存本篇文章的主题快照。</small></div><div class="studio-field"><label for="studio-business-line">产品 / 业务线</label><select class="select" id="studio-business-line">${lines}</select></div><div class="studio-field"><label for="studio-content-type">内容形式</label><select class="select" id="studio-content-type">${["深度文章", "问答文章", "案例解读", "系列文章"].map((type) => `<option ${type === workspace.contentType ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="studio-field full"><label for="studio-direct-agent">写作智能体</label><select class="select" id="studio-direct-agent">${agentOptions}</select><small>${escapeHtml(selectedAgent?.style || "请先配置适用于当前业务线的写作智能体")}</small></div><div class="studio-knowledge-summary ${approved ? "" : "warning"}"><span data-icon="${approved ? "database" : "alert"}"></span><span><b>${studioKnowledgeBases(workspace).length} 个知识库 · ${approved} 条已审核知识可用</b><br>${approved ? "生成后逐条记录知识库、条目和版本，企业事实不会来自联网结果。" : "当前没有可生成的企业证据，请先在企业知识中补充并审核资料。"}</span></div><div class="studio-field full"><button class="primary-button" type="button" data-action="generate-studio-article" ${approved && selectedAgent ? "" : "disabled"}><span data-icon="sparkle"></span>${ui.studioGenerating ? "正在生成…" : "生成文章初稿"}</button></div></div></div></div></main>`;
  }
  const citations = articleCitations(article);
  return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>文章正文</h3><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${citations.length} 条企业知识引用</p></div>${article.reviewStatus === "approved" ? '<span class="status-badge status-approved">已审核</span>' : '<span class="status-badge status-review">待审核</span>'}</div><div class="studio-editor-toolbar" aria-label="编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">H2</button></div><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-link" title="链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="open-studio-image-picker" title="图片"><span data-icon="image"></span></button></div></div><textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(article.title)}</textarea><article class="studio-editor-body" id="studio-content-editor" contenteditable="true" spellcheck="false">${articleContentForEditor(article, citations)}</article></main>`;
}

function renderContentStudio() {
  const workspace = ensureStudioWorkspace(null, false);
  const article = studioArticleForWorkspace(workspace);
  const conversation = studioConversationForWorkspace(workspace);
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const agent = writingAgentById(conversation?.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  const knowledgeCount = studioApprovedKnowledgeEntries(workspace).length;
  return `<div class="page-container"><div class="tabs-row topic-center-tab-row">${contentSectionTabs()}<span class="health"><i></i>自动保存会话</span></div><section class="content-studio-page"><div class="studio-topbar"><button class="studio-back-button" type="button" data-action="back-to-articles"><span data-icon="arrow"></span>文章任务</button><div class="studio-doc-meta"><span>${article ? escapeHtml(article.id) + " · " + escapeHtml(article.version) : "直接创作 · 尚未生成文章"}</span><strong class="studio-doc-title">${escapeHtml(article?.title || workspace.topic?.title || "新文章")}</strong><small class="studio-save-state">${article ? "已保存到客户空间" : "创作上下文已保存"}</small><div class="studio-context-chips"><span class="studio-context-chip"><span data-icon="briefcase"></span><b>${escapeHtml(line?.name || "未设置业务线")}</b></span><span class="studio-context-chip blue"><span data-icon="sparkle"></span><b>${escapeHtml(agent?.name || workspace.writingAgentSnapshot?.nameSnapshot || "未选择智能体")}</b></span><span class="studio-context-chip teal"><span data-icon="database"></span><b>${studioKnowledgeBases(workspace).length} 库 / ${knowledgeCount} 条已审核</b></span><span class="studio-context-chip"><span data-icon="file"></span><b>${workspace.mode === "quick" ? "直接创作" : "文章任务"}</b></span></div></div><div class="studio-top-actions"><button class="secondary-button" type="button" data-action="save-studio-draft"><span data-icon="check"></span><span>保存草稿</span></button><button class="primary-button" type="button" data-action="submit-studio-review" ${article ? "" : "disabled"}><span data-icon="shield"></span><span>提交审核</span></button></div></div><div class="studio-mobile-tabs"><button class="${ui.studioPane === "editor" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="editor">正文</button><button class="${ui.studioPane === "chat" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="chat">AI 协作</button><button class="${ui.studioPane === "info" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="info">文章信息</button></div><div class="studio-shell" data-active-pane="${escapeHtml(ui.studioPane)}">${renderStudioEditor(workspace, article)}${renderStudioChat(workspace, conversation, article)}${renderStudioInfo(workspace, article)}</div></section></div>`;
}

function contentPlanForArticle(article) {
  if (!article) return null;
  const directPlan = state.contentPlans.find((plan) => plan.id === article.planId);
  if (directPlan) return directPlan;
  return state.contentPlans.find((plan) => Array.isArray(plan.articleIds) && plan.articleIds.includes(article.id)) || null;
}

function contentArticleBusinessLineId(article) {
  const plan = contentPlanForArticle(article);
  if (plan?.businessLineId) return plan.businessLineId;
  if (article?.businessLineId || article?.generationSnapshot?.businessLineId) return article.businessLineId || article.generationSnapshot.businessLineId;
  const topic = article?.topicId ? state.topics.find((item) => item.id === article.topicId) : null;
  return topic ? topicBusinessLineId(topic) : null;
}

function contentArticleInCurrentBusinessLine(article) {
  const line = activeBusinessLine();
  return Boolean(line?.id) && contentArticleBusinessLineId(article) === line.id;
}

function contentPlanArticles(plan) {
  if (!plan) return [];
  return state.articles.filter((article) => contentPlanForArticle(article)?.id === plan.id);
}

function contentPlanTopicIds(plan) {
  const ids = Array.isArray(plan?.topicIds) ? plan.topicIds : [];
  const snapshotIds = Array.isArray(plan?.topicSnapshots) ? plan.topicSnapshots.map((topic) => topic?.id) : [];
  return [...new Set([...ids, ...snapshotIds].filter(Boolean))];
}

function contentPlanProgress(plan) {
  const articles = contentPlanArticles(plan);
  const topicIds = contentPlanTopicIds(plan);
  const plannedTopicIds = new Set(topicIds);
  const coveredTopicIds = new Set(articles.map((article) => article.topicId).filter((topicId) => plannedTopicIds.has(topicId)));
  const missingTopicIds = topicIds.filter((topicId) => !coveredTopicIds.has(topicId));
  const total = topicIds.length || articles.length;
  const created = topicIds.length ? coveredTopicIds.size : articles.length;
  return {
    articles,
    topicIds,
    plannedCount: topicIds.length,
    total,
    created,
    draft: articles.filter((article) => article.reviewStatus !== "approved" && article.reviewStage !== "manual_review").length,
    pending: articles.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length,
    approved: articles.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length,
    published: articles.filter((article) => article.status === "published").length,
    missing: missingTopicIds.length,
    missingTopicIds,
    extraArticles: topicIds.length ? articles.filter((article) => !plannedTopicIds.has(article.topicId)) : []
  };
}

function articlePublishEligibility(article) {
  if (!article) return { ok: false, reason: "文章不存在" };
  if (!articleBusinessLineIsActive(article)) return { ok: false, reason: "业务线已归档" };
  if (article.reviewStatus !== "approved") return { ok: false, reason: "未完成人工审核" };
  if (article.riskStatus !== "clean") return { ok: false, reason: "风控未通过" };
  if (!articleCitations(article).length) return { ok: false, reason: "缺少知识证据" };
  if (!article.knowledgeSnapshot || (!article.knowledgeSnapshot.frozenAt && article.knowledgeStatus?.state !== "ready_with_omissions" && article.knowledgeStatus?.state !== "frozen")) return { ok: false, reason: "知识证据未冻结" };
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return { ok: false, reason: "企业事实存在冲突" };
  if (articleHasKnowledgeUpdates(article)) return { ok: false, reason: "知识版本已更新" };
  if (articleAssetReviewIssues(article).length) return { ok: false, reason: "图片素材尚未审核" };
  if (article.status !== "draft") return { ok: false, reason: article.status === "published" ? "文章已发布" : "已有执行任务" };
  return { ok: true, reason: "可发布" };
}

function articleExistingPublishPlatforms(article) {
  if (!article) return new Set();
  const platforms = new Set();
  const addPlatform = (platform) => {
    const canonical = canonicalPublishPlatformId(platform);
    platforms.add(platform);
    platforms.add(canonical);
    if (PUBLISH_PLATFORM_REVERSE_ALIASES[canonical]) platforms.add(PUBLISH_PLATFORM_REVERSE_ALIASES[canonical]);
  };
  state.publishTasks.filter((task) => task.articleId === article.id && task.version === article.version).forEach((task) => Object.keys(task.targets || {}).forEach(addPlatform));
  (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled" && schedule.articleVersions?.[article.id] === article.version).forEach((schedule) => (schedule.items || []).filter((item) => item.articleId === article.id).forEach((item) => (item.targets || []).forEach((target) => addPlatform(target.platform))));
  return platforms;
}

function articleScheduleEligibility(article, selection) {
  const base = articlePublishEligibility(article);
  if (!base.ok) return base;
  const requested = selection?.platformOrder || selection?.platforms || [];
  const existing = articleExistingPublishPlatforms(article);
  if (requested.length && !requested.some((platform) => !existing.has(platform))) return { ok: false, reason: "所选平台已有发布任务" };
  return { ok: true, reason: "可排期" };
}

function publishScheduleForArticle(article) {
  if (!article) return [];
  return (state.publishSchedules || []).filter((schedule) => schedule.articleIds?.includes(article.id) && schedule.articleVersions?.[article.id] === article.version && ["scheduled", "running", "partial"].includes(schedule.status));
}

function articleMatchesContentFilters(article) {
  if (!article) return false;
  const query = String(ui.articleSearch || "").trim().toLowerCase();
  const plan = contentPlanForArticle(article);
  const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
  const agent = article.generationSnapshot?.writingAgent;
  const searchable = [article.title, article.id, article.category, article.author, plan?.name, topic?.title, agent?.nameSnapshot]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (ui.articleRiskFilter !== "all" && article.riskStatus !== ui.articleRiskFilter) return false;
  const hasKnowledge = articleCitations(article).length > 0 && Boolean(article.knowledgeSnapshot);
  if (ui.articleKnowledgeFilter === "mapped" && !hasKnowledge) return false;
  if (ui.articleKnowledgeFilter === "unmapped" && hasKnowledge) return false;
  if (ui.articleKnowledgeFilter === "outdated" && !articleHasKnowledgeUpdates(article)) return false;
  return true;
}

function contentTaskVisibleArticles() {
  const line = activeBusinessLine();
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === line?.id);
  const base = state.articles.filter((article) => {
    if (!contentArticleInCurrentBusinessLine(article)) return false;
    const plan = contentPlanForArticle(article);
    if (ui.articlePlanFilterId === "__direct__") return !plan;
    if (ui.articlePlanFilterId && ui.articlePlanFilterId !== "all") return plan?.id === ui.articlePlanFilterId;
    return true;
  });
  return base.filter((article) => {
    if (ui.articleTab === "uncreated") return false;
    if (ui.articleTab === "draft") return article.reviewStatus !== "approved" && article.reviewStage !== "manual_review";
    if (ui.articleTab === "pending") return article.reviewStatus === "pending" && article.reviewStage === "manual_review";
    if (ui.articleTab === "approved") return article.reviewStatus === "approved" && article.status !== "published";
    if (ui.articleTab === "published") return article.status === "published";
    return true;
  }).filter(articleMatchesContentFilters);
}

function selectedArticleObjects() {
  const selected = new Set(ui.articleSelection || []);
  return state.articles.filter((article) => selected.has(article.id));
}

// 批量人工审核只处理待审核草稿；通用复选框还允许选择可排期的已审核文章。
function articleSelectableForReview(article) {
  return Boolean(article && article.status === "draft" && article.reviewStatus !== "approved" && article.reviewStage === "manual_review");
}

function articleSelectableForAction(article) {
  return articleSelectableForReview(article) || articlePublishEligibility(article).ok;
}

function articleReviewBlockReason(article) {
  if (!article) return "文章不存在";
  if (!articleBusinessLineIsActive(article)) return "所属业务线已归档";
  if (article.status === "published") return "文章已发布";
  if (article.reviewStatus === "approved") return "已审核通过";
  if (article.reviewStage !== "manual_review") return article.reviewStage === "revision_requested" ? "已退回修改，尚未重新提交" : "尚未提交人工审核";
  const citations = articleCitations(article);
  if (!citations.length || !article.knowledgeSnapshot) return "缺少企业知识证据";
  if (citations.some((citation) => !knowledgeBaseById(citation.knowledgeBaseId || citation.baseId) || !knowledgeItemById(citation.itemId || citation.knowledgeItemId) || !knowledgeVersionById(citation.versionId || citation.knowledgeVersionId))) return "引用证据不完整";
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return "企业事实存在冲突";
  if (articleHasKnowledgeUpdates(article)) return "知识版本已更新";
  if (articleAssetReviewIssues(article).length) return "图片素材尚未审核";
  if (["unscanned", "stale"].includes(article.riskStatus) || article.riskScan?.articleVersion !== article.version) return "尚未完成当前版本风控";
  if (article.riskStatus === "blocked") return "风控已阻断";
  if (article.riskStatus === "warning") return "存在风控警告";
  return "";
}

function selectedArticleIdsForCurrentView() {
  return Array.isArray(ui.articleSelection) ? ui.articleSelection : [];
}

function clearArticleSelection() {
  ui.articleSelection = [];
}

function enhanceArticleTaskSelection(root = document) {
  if (ui.route !== "content" || ui.contentView !== "articles" || ui.articleTaskView !== "articles") return;
  const table = root.querySelector(".content-article-table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tbody tr:not(.article-task-uncreated)")];
  const articles = rows.map((row) => {
    const openButton = row.querySelector('[data-action="open-article"]');
    const articleId = openButton?.dataset.articleId;
    return { row, article: state.articles.find((item) => item.id === articleId) };
  }).filter((entry) => entry.article);
  const selectable = articles.filter((entry) => articleSelectableForAction(entry.article));
  const selected = new Set(selectedArticleIdsForCurrentView());
  const selectedVisible = selectable.filter((entry) => selected.has(entry.article.id));

  articles.forEach(({ row, article }) => {
    const titleCell = row.querySelector("td.article-title-cell");
    if (!titleCell || titleCell.querySelector("[data-article-select]")) return;
    const canSelect = articleSelectableForAction(article);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox article-select-checkbox";
    checkbox.dataset.articleSelect = article.id;
    checkbox.checked = canSelect && selected.has(article.id);
    checkbox.disabled = !canSelect;
    checkbox.setAttribute("aria-label", `选择 ${article.title || article.id}`);
    const titleContent = document.createElement("span");
    while (titleCell.firstChild) titleContent.append(titleCell.firstChild);
    const wrapper = document.createElement("span");
    wrapper.className = "article-title-select";
    titleCell.append(wrapper);
    wrapper.append(checkbox);
    wrapper.append(titleContent);
  });

  const card = table.closest(".table-card");
  if (!card || card.querySelector(".article-bulk-row")) return;
  const header = card.querySelector(":scope > .card-header");
  if (!header) return;
  const bulkRow = document.createElement("div");
  bulkRow.className = "bulk-select-row article-bulk-row";
  const reviewableCount = selectedVisible.filter((entry) => articleSelectableForReview(entry.article)).length;
  const publishableCount = selectedVisible.filter((entry) => articlePublishEligibility(entry.article).ok).length;
  bulkRow.innerHTML = `${renderSelectAllControl("content-articles", selectable.length, selectedVisible.length, "全选当前列表")}<span class="article-bulk-summary">已选择 <b>${selectedVisible.length}</b> 篇文章</span><button class="primary-button button-small" type="button" data-action="open-batch-review" ${reviewableCount ? "" : "disabled"}><span data-icon="check"></span>批量审核${reviewableCount ? `（${reviewableCount}篇）` : ""}</button><button class="secondary-button button-small" type="button" data-action="open-schedule" ${publishableCount ? "" : "disabled"}><span data-icon="clock"></span>定时发布${publishableCount ? `（${publishableCount}篇）` : ""}</button>`;
  header.insertAdjacentElement("afterend", bulkRow);
  hydrateIcons(bulkRow);
  hydrateBulkSelects(bulkRow);
}

function contentTaskViewSwitcher() {
  return `<div class="content-task-switcher" role="tablist"><button class="${ui.articleTaskView === "plans" ? "active" : ""}" type="button" data-action="content-task-view" data-view="plans"><span data-icon="clock"></span><span><b>计划任务</b><small>按计划管理文章</small></span></button><button class="${ui.articleTaskView === "articles" ? "active" : ""}" type="button" data-action="content-task-view" data-view="articles"><span data-icon="file"></span><span><b>全部文章</b><small>按状态统一处理</small></span></button></div>`;
}

function renderContentPlanTasks() {
  const line = activeBusinessLine();
  const plans = [...state.contentPlans].filter((plan) => plan.businessLineId === line?.id).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const directArticles = state.articles.filter((article) => !contentPlanForArticle(article) && contentArticleInCurrentBusinessLine(article));
  const allPlannedArticles = state.articles.filter((article) => contentPlanForArticle(article)?.businessLineId === line?.id);
  const pending = allPlannedArticles.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length;
  const published = allPlannedArticles.filter((article) => article.status === "published").length;
  const rows = plans.map((plan) => {
    const line = state.businessLines.find((item) => item.id === plan.businessLineId);
    const progress = contentPlanProgress(plan);
    const percent = progress.total ? Math.min(100, Math.round(progress.created / progress.total * 100)) : 0;
    const statusSummary = [
      progress.draft ? `<span class="status-badge status-draft">草稿 ${progress.draft}</span>` : "",
      progress.pending ? `<span class="status-badge status-review">待审核 ${progress.pending}</span>` : "",
      progress.approved ? `<span class="status-badge status-approved">已通过 ${progress.approved}</span>` : "",
      progress.published ? `<span class="status-badge status-success">已发布 ${progress.published}</span>` : ""
    ].filter(Boolean).join(" ") || '<span class="small-tag">尚未生成</span>';
    const missingNote = !progress.total ? '<small>计划无选题</small>' : progress.missing ? `<small class="plan-progress-missing">还差 ${progress.missing} 篇</small>` : '<small class="plan-progress-complete">文章任务已齐</small>';
    return `<tr><td class="article-title-cell"><button class="plan-name-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</button><small>${escapeHtml(plan.id)} · ${escapeHtml(line?.name || "未关联业务线")} · 创建于 ${formatRelative(plan.createdAt)}</small></td><td><b>${progress.plannedCount}</b> 个选题<br><small>${progress.created}/${progress.total || 0} 篇文章</small></td><td><div class="plan-progress"><div class="plan-progress-track"><i style="width:${percent}%"></i></div><div class="plan-progress-meta"><b>${percent}%</b>${missingNote}</div></div><div class="plan-status-list">${statusSummary}</div></td><td>${escapeHtml(plan.scheduledFor || "未安排")}</td><td>${escapeHtml(plan.owner || "未分配")}</td><td>${planStatusBadge(plan.status)}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">查看文章任务</button>${progress.articles.some((article) => articlePublishEligibility(article).ok) ? `<button class="link-button" type="button" data-action="schedule-plan" data-plan-id="${escapeHtml(plan.id)}">安排发布</button>` : ""}${progress.missing ? `<button class="link-button" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(plan.id)}">继续生成</button>` : ""}</div></td></tr>`;
  }).join("");
  const directRow = directArticles.length ? `<tr><td class="article-title-cell"><button class="plan-name-button" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="__direct__">直接创作</button><small>未关联内容计划 · 独立文章工作区</small></td><td>—<br><small>${directArticles.length} 篇文章</small></td><td><div class="plan-progress"><div class="plan-progress-track"><i style="width:100%"></i></div><div class="plan-progress-meta"><b>—</b><small>直接创作不纳入计划进度</small></div></div></td><td>—</td><td>—</td><td><span class="small-tag blue">独立创作</span></td><td><button class="link-button" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="__direct__">查看文章</button></td></tr>` : "";
  const summary = `<section class="content-plan-summary"><article class="card summary-card"><span data-icon="clock"></span><div><b>${plans.length}</b><small>内容计划</small></div></article><article class="card summary-card"><span class="amber" data-icon="clipboard"></span><div><b>${allPlannedArticles.length}</b><small>计划文章</small></div></article><article class="card summary-card"><span class="green" data-icon="file"></span><div><b>${pending}</b><small>待审核</small></div></article><article class="card summary-card"><span class="purple" data-icon="send"></span><div><b>${published}</b><small>已发布</small></div></article></section>`;
  return `${contentTaskViewSwitcher()}${summary}<section class="card table-card"><div class="card-header"><div><h3>内容计划任务</h3><p>先按计划查看进度，再进入计划查看每个选题对应的文章状态。</p></div><button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="all">查看全部文章</button></div>${rows || directRow ? `<div class="table-scroll"><table class="data-table content-plan-table"><thead><tr><th>计划</th><th>选题 / 文章</th><th>文章进度与状态</th><th>截止日期</th><th>负责人</th><th>计划状态</th><th style="text-align:right">操作</th></tr></thead><tbody>${rows}${directRow}</tbody></table></div>` : '<div class="empty-state"><div><span data-icon="clock"></span><h3>还没有内容计划</h3><p>先从选题中心创建计划，或直接进入 AI 创作台。</p><button class="primary-button button-small" type="button" data-nav="planning">进入选题中心</button></div></div>'}</section>`;
}

function renderContentArticleList() {
  const line = activeBusinessLine();
  const plans = [...state.contentPlans].filter((plan) => plan.businessLineId === line?.id).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const selectedPlan = ui.articlePlanFilterId && ui.articlePlanFilterId !== "all" && ui.articlePlanFilterId !== "__direct__"
    ? plans.find((plan) => plan.id === ui.articlePlanFilterId)
    : null;
  const baseFiltered = state.articles.filter((article) => {
    if (!contentArticleInCurrentBusinessLine(article)) return false;
    const plan = contentPlanForArticle(article);
    if (ui.articlePlanFilterId === "__direct__") return !plan;
    if (ui.articlePlanFilterId && ui.articlePlanFilterId !== "all") return plan?.id === ui.articlePlanFilterId;
    return true;
  });
  const selectedPlanProgress = selectedPlan ? contentPlanProgress(selectedPlan) : null;
  const tabs = selectedPlan ? [["all", "全部任务"], ["uncreated", "未生成"], ["draft", "草稿 / 退回"], ["pending", "待审核"], ["approved", "已通过"], ["published", "已发布"]] : [["all", "全部文章"], ["draft", "草稿 / 退回"], ["pending", "待审核"], ["approved", "已通过"], ["published", "已发布"]];
  const tabCount = (id) => {
    if (id === "all") return baseFiltered.length + (selectedPlanProgress?.missing || 0);
    if (id === "uncreated") return selectedPlanProgress?.missing || 0;
    if (id === "draft") return baseFiltered.filter((article) => article.reviewStatus !== "approved" && article.reviewStage !== "manual_review").length;
    if (id === "pending") return baseFiltered.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length;
    if (id === "approved") return baseFiltered.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length;
    return baseFiltered.filter((article) => article.status === "published").length;
  };
  const filtered = baseFiltered.filter((article) => {
    if (ui.articleTab === "uncreated") return false;
    if (ui.articleTab === "draft") return article.reviewStatus !== "approved" && article.reviewStage !== "manual_review";
    if (ui.articleTab === "pending") return article.reviewStatus === "pending" && article.reviewStage === "manual_review";
    if (ui.articleTab === "approved") return article.reviewStatus === "approved" && article.status !== "published";
    if (ui.articleTab === "published") return article.status === "published";
    return true;
  }).filter(articleMatchesContentFilters);
  const selectableArticles = filtered.filter(articleSelectableForAction);
  const selectableArticleIds = new Set(selectableArticles.map((article) => article.id));
  // 过滤条件变化后，隐藏列表中的勾选不应继续影响批量操作。
  ui.articleSelection = selectedArticleIdsForCurrentView().filter((id) => selectableArticleIds.has(id));
  const selectedArticleIds = new Set(ui.articleSelection);
  const selectedArticles = selectableArticles.filter((article) => selectedArticleIds.has(article.id));
  const tabHtml = tabs.map(([id, label]) => `<button class="tab-button ${ui.articleTab === id ? "active" : ""}" type="button" data-action="article-tab" data-tab="${id}">${label} · ${tabCount(id)}</button>`).join("");
  const planOptions = [`<option value="all" ${ui.articlePlanFilterId === "all" ? "selected" : ""}>全部计划</option>`, `<option value="__direct__" ${ui.articlePlanFilterId === "__direct__" ? "selected" : ""}>直接创作（无计划）</option>`].concat(plans.map((plan) => `<option value="${escapeHtml(plan.id)}" ${ui.articlePlanFilterId === plan.id ? "selected" : ""}>${escapeHtml(plan.name)}</option>`)).join("");
  const articleRows = filtered.map((article) => {
    const agent = article.generationSnapshot?.writingAgent;
    const plan = contentPlanForArticle(article);
    const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
    const sourceCell = plan
      ? `<span class="article-source-cell"><button class="link-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</button><small>${escapeHtml(topic?.title || "关联选题未找到")}</small></span>`
      : '<span class="article-source-cell direct"><b>直接创作</b><small>未关联内容计划</small></span>';
    const agentCell = agent
      ? `<span class="article-agent-cell"><b>${escapeHtml(agent.nameSnapshot)}</b><small>v${escapeHtml(agent.version)} · ${escapeHtml(agent.style || agent.template || "写作配置")}</small></span>`
      : '<span class="article-agent-cell legacy"><b>历史默认配置</b><small>未记录智能体</small></span>';
    return `<tr><td class="article-title-cell"><button type="button" data-action="open-article" data-article-id="${article.id}">${escapeHtml(article.title)}</button><small>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · 更新于 ${formatRelative(article.updatedAt)}</small></td><td>${sourceCell}</td><td><span class="source-tag">${escapeHtml(article.category)}</span></td><td>${agentCell}</td><td>${article.status === "published" ? statusBadge("published") : article.status === "publishing" ? statusBadge("publishing") : statusBadge("draft")}</td><td>${articleReviewBadge(article)}</td><td>${articleCitations(article).length ? `<span class="status-badge status-approved">${articleCitations(article).length} 条证据</span><small style="display:block;margin-top:4px;color:var(--muted-2)">${article.knowledgeStatus?.gapCount || 0} 项缺口已省略</small>` : '<span class="status-badge status-review">未映射</span>'}</td><td>${articleRiskBadge(article)}<small style="display:block;margin-top:4px;color:var(--muted-2)">绑定 ${article.version}</small></td><td>${escapeHtml(article.author)}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="open-article" data-article-id="${article.id}">打开</button><button class="link-button" type="button" data-action="open-article-studio" data-article-id="${article.id}">AI 协作</button>${article.reviewStatus === "approved" && article.status === "draft" && articleCitations(article).length && articleBusinessLineIsActive(article) ? `<button class="link-button" type="button" data-action="open-publish" data-article-id="${article.id}">发布</button>` : ""}</div></td></tr>`;
  }).join("");
  const missingRows = selectedPlan && selectedPlanProgress.missingTopicIds.length && ["all", "uncreated"].includes(ui.articleTab)
    ? selectedPlanProgress.missingTopicIds.map((topicId) => {
      const topic = selectedPlan.topicSnapshots?.find((item) => item.id === topicId) || state.topics.find((item) => item.id === topicId);
      const agent = selectedPlan.writingAgentSnapshot;
      const title = topic?.title || `选题 ${topicId}`;
      return `<tr class="article-task-uncreated"><td class="article-title-cell"><span class="article-task-placeholder"><b>${escapeHtml(title)}</b><small>${escapeHtml(topicId)} · 尚未生成文章</small></span></td><td><span class="article-source-cell"><b>${escapeHtml(selectedPlan.name)}</b><small>${escapeHtml(title)}</small></span></td><td><span class="source-tag">${escapeHtml(selectedPlan.contentType || "待确定")}</span></td><td><span class="article-agent-cell"><b>${escapeHtml(agent?.nameSnapshot || "计划写作智能体")}</b><small>${agent?.version ? "v" + escapeHtml(agent.version) : "等待生成时冻结"}</small></span></td><td><span class="status-badge status-draft">未生成</span></td><td><span class="small-tag">待创建</span></td><td><span class="small-tag">生成后核验</span></td><td><span class="small-tag">未检测</span></td><td>${escapeHtml(selectedPlan.owner || "未分配")}</td><td><button class="link-button" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}">生成文章</button></td></tr>`;
    }).join("")
    : "";
  const rows = articleRows + missingRows;
  const filterLabel = ui.articlePlanFilterId === "__direct__" ? "直接创作" : selectedPlan?.name || "全部计划";
  const description = selectedPlan
    ? `计划包含 ${selectedPlanProgress.plannedCount} 个选题，已生成 ${selectedPlanProgress.created}/${selectedPlanProgress.total || 0} 个计划任务${selectedPlanProgress.extraArticles.length ? `，另有 ${selectedPlanProgress.extraArticles.length} 篇附加文章` : ""}。`
    : ui.articlePlanFilterId === "__direct__"
      ? "直接创作文章不进入内容计划进度。"
      : "可按计划查看文章，也可以切换到状态标签统一处理。";
  const headerActions = `<div class="table-actions content-article-header-actions">${selectedPlanProgress?.missing ? `<button class="secondary-button button-small" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}"><span data-icon="sparkle"></span>继续生成</button>` : ""}<button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="plans"><span data-icon="clock"></span>返回计划任务</button></div>`;
  const emptyState = selectedPlan
    ? `<div class="empty-state"><div><span data-icon="file"></span><h3>当前状态没有文章</h3><p>${selectedPlanProgress.missing ? `该计划还有 ${selectedPlanProgress.missing} 个选题尚未生成，可继续创建计划文章。` : "该计划在当前状态下没有文章，可返回计划任务查看整体进度。"}</p>${selectedPlanProgress.missing ? `<button class="primary-button button-small" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}"><span data-icon="sparkle"></span>继续生成计划文章</button>` : '<button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="plans">返回计划任务</button>'}</div></div>`
    : '<div class="empty-state"><div><span data-icon="file"></span><h3>当前筛选没有文章</h3><p>可以直接生成一篇文章，或回到选题中心创建内容计划。</p><button class="primary-button button-small" type="button" data-action="open-content-studio">直接创作</button></div></div>';
  const taskTable = rows ? `<div class="table-scroll"><table class="data-table content-article-table"><thead><tr><th>文章 / 任务</th><th>来源计划 / 选题</th><th>分类</th><th>写作智能体</th><th>内容状态</th><th>审核状态</th><th>知识证据</th><th>风控状态</th><th>作者</th><th style="text-align:right">操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState;
  const activeAdvancedFilters = Number(ui.articleRiskFilter !== "all") + Number(ui.articleKnowledgeFilter !== "all");
  const advancedFilters = ui.articleFilterExpanded
    ? `<div class="content-advanced-filters"><label><span>风控状态</span><select class="select" data-content-risk-filter><option value="all" ${ui.articleRiskFilter === "all" ? "selected" : ""}>全部风控状态</option><option value="clean" ${ui.articleRiskFilter === "clean" ? "selected" : ""}>风控通过</option><option value="unscanned" ${ui.articleRiskFilter === "unscanned" ? "selected" : ""}>尚未检测</option><option value="stale" ${ui.articleRiskFilter === "stale" ? "selected" : ""}>结果已过期</option><option value="warning" ${ui.articleRiskFilter === "warning" ? "selected" : ""}>需注意</option><option value="blocked" ${ui.articleRiskFilter === "blocked" ? "selected" : ""}>已阻断</option></select></label><label><span>知识证据</span><select class="select" data-content-knowledge-filter><option value="all" ${ui.articleKnowledgeFilter === "all" ? "selected" : ""}>全部证据状态</option><option value="mapped" ${ui.articleKnowledgeFilter === "mapped" ? "selected" : ""}>已映射企业知识</option><option value="unmapped" ${ui.articleKnowledgeFilter === "unmapped" ? "selected" : ""}>未映射企业知识</option><option value="outdated" ${ui.articleKnowledgeFilter === "outdated" ? "selected" : ""}>引用知识已更新</option></select></label><button class="ghost-button button-small" type="button" data-action="clear-content-filters" ${activeAdvancedFilters || ui.articleSearch ? "" : "disabled"}>清除筛选</button></div>`
    : "";
  return `${contentTaskViewSwitcher()}<div class="content-article-toolbar"><div class="tabs" role="tablist">${tabHtml}</div><div class="filter-tools"><label class="content-plan-filter"><span>来源计划</span><select class="select" id="content-plan-filter">${planOptions}</select></label><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.articleSearch)}" placeholder="搜索文章、计划、选题或编号" aria-label="搜索文章" data-content-article-search /></div><button class="secondary-button button-small ${activeAdvancedFilters ? "active" : ""}" type="button" data-action="content-filter"><span data-icon="filter"></span>筛选${activeAdvancedFilters ? ` · ${activeAdvancedFilters}` : ""}</button></div></div>${advancedFilters}<section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(filterLabel)} · 文章任务</h3><p>${description}</p></div>${headerActions}</div>${taskTable}</section>`;
}

function renderContent() {
  if (ui.contentView === "studio") return renderContentStudio();
  if (ui.contentView === "agents") return renderWritingAgents();
  const line = activeBusinessLine();
  return `<div class="page-container">${pageHead("内容生产", `${line?.name || "当前业务线"} · 按内容计划管理文章任务，也可以进入 AI 创作台直接起稿。`, '<button class="secondary-button" type="button" data-nav="planning"><span data-icon="clock"></span>进入选题中心</button><button class="primary-button" type="button" data-action="open-content-studio"><span data-icon="sparkle"></span>直接创作</button>')}${contentSectionTabs()}${ui.articleTaskView === "plans" ? renderContentPlanTasks() : renderContentArticleList()}</div>`;
}

function articleAssetRecords() {
  const trackedWorks = state.monitoring?.trackedWorks || [];
  const activeLine = activeBusinessLine();
  return state.articles
    .filter((article) => !activeLine?.id || contentArticleBusinessLineId(article) === activeLine.id)
    .map((article) => {
      const plan = contentPlanForArticle(article);
      const topic = article.topicId ? state.topics.find((item) => item.id === article.topicId) : null;
      const tasks = state.publishTasks.filter((task) => task.articleId === article.id && (!task.version || task.version === article.version));
      const targetMap = new Map();
      tasks.forEach((task) => Object.entries(task.targets || {}).forEach(([platform, target]) => {
        const previous = targetMap.get(platform);
        if (!previous || Number(target.updatedAt || 0) >= Number(previous.updatedAt || 0)) {
          targetMap.set(platform, { ...cloneData(target), platform, taskId: task.id, groupName: task.groupName });
        }
      }));
      const targets = [...targetMap.values()];
      const successful = targets.filter((target) => target.status === "success").length;
      const actionable = targets.filter((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status)).length;
      const websiteTarget = targets.find((target) => target.platform === "web");
      const sourceUrl = websiteTarget?.remoteUrl || article.siteUrl || "";
      const tracked = trackedWorks.find((item) => item.articleId === article.id) || trackedWorks.find((item) => item.title === article.title) || null;
      const queryBinding = monitoringBindingsForArticle(article.id);
      const citationCount = Number(tracked?.citations || 0);
      const citationQuestions = Number(tracked?.questions || queryBinding?.questionIds?.length || 0);
      let lifecycle = "draft";
      if (article.reviewStatus === "pending") lifecycle = "pending_review";
      else if (actionable) lifecycle = "needs_action";
      else if (article.status === "published" || successful) lifecycle = tracked ? "monitoring" : "published";
      else if (article.reviewStatus === "approved") lifecycle = "ready";
      return {
        id: "ASSET-" + article.id,
        article,
        plan,
        topic,
        line: state.businessLines.find((item) => item.id === contentArticleBusinessLineId(article)),
        targets,
        targetCount: targets.length,
        successful,
        actionable,
        sourceUrl,
        sourceHealth: sourceUrl ? "healthy" : (article.status === "published" ? "pending" : "missing"),
        tracked,
        queryBinding,
        citationCount,
        citationQuestions,
        lifecycle,
        lastActivity: targets.reduce((latest, target) => Math.max(latest, Number(target.updatedAt || 0)), Number(article.updatedAt || 0))
      };
    });
}

function assetLifecycleBadge(record) {
  const meta = {
    draft: ["草稿资产", "status-draft"],
    pending_review: ["待人工审核", "status-review"],
    ready: ["待发布", "status-approved"],
    published: ["已发布", "status-success"],
    monitoring: ["监测中", "status-running"],
    needs_action: ["需要处理", "status-error"]
  }[record.lifecycle] || ["待整理", "status-draft"];
  return `<span class="status-badge ${meta[1]}">${meta[0]}</span>`;
}

function assetSourceBadge(record) {
  const meta = {
    healthy: ["已建立主信源地址", "status-approved"],
    pending: ["主信源待核验", "status-pending"],
    missing: ["尚未建立主信源", "status-draft"]
  }[record.sourceHealth] || ["未检测", "status-draft"];
  return `<span class="small-tag asset-source-status ${meta[1]}">${meta[0]}</span>`;
}

function renderAssetPlatforms(record) {
  if (!record.targets.length) return '<div class="asset-empty-note"><span data-icon="send"></span><span>还没有发布任务；审核通过后可从发布运营创建官网或平台任务。</span></div>';
  return `<div class="asset-platform-list">${record.targets.map((target) => {
    const meta = PLATFORM_META[target.platform] || { name: target.platform, short: "平", logoClass: "web" };
    const url = target.remoteUrl || "";
    const demoUrl = /example\.com/i.test(url);
    return `<div class="asset-platform-row"><div class="asset-platform-name">${platformLogo(target.platform)}<span><b>${escapeHtml(meta.name)}</b><small>${escapeHtml(target.account || "未绑定账号")}</small></span></div><div>${statusBadge(target.status)}${url ? `<a class="asset-url" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开${demoUrl ? "演示地址" : "信源"}</a>` : '<small class="asset-url-muted">等待地址</small>'}</div><small class="asset-platform-time">${target.updatedAt ? formatRelative(target.updatedAt) : "尚未执行"}</small></div>`;
  }).join("")}</div>`;
}

function renderAssetDetail(record) {
  const article = record.article;
  const knowledgeCount = articleCitations(article).length;
  const boundQuestionCount = record.queryBinding?.questionIds?.length || 0;
  const monitorText = record.tracked
    ? `已记录 ${record.citationQuestions} 个问题、${record.citationCount} 次引用，最近 ${record.tracked.citedDays || 0} 天发现引用`
    : boundQuestionCount
      ? `已绑定 ${boundQuestionCount} 个监测问题，等待采样回写引用证据`
      : "尚未绑定监测问题；可从问题词库或现有 AI 样本中选择。";
  return `<div class="asset-detail"><div class="asset-detail-grid"><section><div class="asset-detail-head"><div><h4>发布渠道与信源</h4><p>官网是主信源，其他平台是分发信源；每个平台独立记录状态。</p></div><span class="small-tag blue">${record.successful}/${record.targetCount || 0} 完成</span></div>${renderAssetPlatforms(record)}</section><section><div class="asset-detail-head"><div><h4>引用监测准备</h4><p>发布后把原始问题、选题问题或自定义问题绑定到这篇资产。</p></div><span class="small-tag ${record.tracked ? "green" : boundQuestionCount ? "blue" : "amber"}">${record.tracked ? "已有演示数据" : boundQuestionCount ? `已绑定 ${boundQuestionCount} 个问题` : "待接入"}</span></div><div class="asset-monitor-card"><span class="asset-monitor-icon" data-icon="chart"></span><div><b>${record.tracked ? `${record.citationCount} 次引用` : boundQuestionCount ? `等待采样` : "尚未监测"}</b><small>${escapeHtml(monitorText)}</small></div></div><div class="asset-detail-links"><button class="link-button" type="button" data-action="asset-open-monitoring" data-asset-id="${record.id}">查看引用分析</button><button class="link-button" type="button" data-action="asset-add-query" data-asset-id="${record.id}">${boundQuestionCount ? "管理监测问题" : "添加监测问题"}</button></div></section></div><div class="asset-detail-footer"><span><b>知识快照</b> ${knowledgeCount ? `${knowledgeCount} 条企业证据 · ${article.knowledgeSnapshot?.frozenAt || article.reviewStatus === "approved" ? "已冻结" : "待冻结"}` : "未建立可追溯证据"}</span><span><b>来源计划</b> ${escapeHtml(record.plan?.name || "直接创作")}</span><span><b>当前版本</b> ${escapeHtml(article.version || "v1")}</span><div class="asset-detail-actions"><button class="secondary-button button-small" type="button" data-action="open-asset-article" data-article-id="${article.id}">查看文章</button><button class="secondary-button button-small" type="button" data-action="asset-new-version" data-article-id="${article.id}">创建新版本</button></div></div></div>`;
}

function renderAssets() {
  const records = articleAssetRecords();
  const search = String(ui.assetSearch || "").trim().toLowerCase();
  const visible = records.filter((record) => {
    if (ui.assetTab === "published" && !["published", "monitoring", "needs_action"].includes(record.lifecycle)) return false;
    if (ui.assetTab === "ready" && !["ready", "pending_review", "draft"].includes(record.lifecycle)) return false;
    if (ui.assetTab === "needs" && record.lifecycle !== "needs_action") return false;
    if (search && ![record.article.title, record.plan?.name, record.topic?.title, record.article.id].filter(Boolean).join(" ").toLowerCase().includes(search)) return false;
    return true;
  });
  const publishedCount = records.filter((record) => ["published", "monitoring", "needs_action"].includes(record.lifecycle)).length;
  const monitoringCount = records.filter((record) => record.lifecycle === "monitoring").length;
  const needsCount = records.filter((record) => record.lifecycle === "needs_action").length;
  const totalCitations = records.reduce((sum, record) => sum + record.citationCount, 0);
  const tabs = [["all", "全部资产", records.length], ["published", "已发布", publishedCount], ["ready", "待发布 / 待审核", records.length - publishedCount], ["needs", "需要处理", needsCount]];
  const rows = visible.map((record) => {
    const article = record.article;
    const expanded = ui.assetExpandedId === record.id;
    const publishText = record.targetCount ? `${record.successful}/${record.targetCount} 平台完成` : "未创建发布任务";
    const citationText = record.tracked ? `${record.citationCount} 次引用 · ${record.citationQuestions} 个问题` : record.queryBinding?.questionIds?.length ? `已绑定 ${record.queryBinding.questionIds.length} 个问题` : "未接入监测";
    return `<article class="card asset-card ${expanded ? "is-expanded" : ""}"><div class="asset-card-main"><div class="asset-card-title"><span class="asset-kind-icon" data-icon="file"></span><div><div class="asset-title-line"><button class="asset-title-button" type="button" data-action="open-asset-article" data-article-id="${article.id}">${escapeHtml(article.title)}</button><span class="small-tag">${escapeHtml(article.version || "v1")}</span></div><p>${escapeHtml(record.plan?.name || "直接创作")} · ${escapeHtml(record.topic?.title || "未关联选题")} · ${escapeHtml(record.line?.name || "未关联业务线")}</p></div></div><div class="asset-card-actions">${assetLifecycleBadge(record)}<button class="secondary-button button-small" type="button" data-action="asset-expand" data-asset-id="${record.id}">${expanded ? "收起管理" : "管理资产"}</button></div></div><div class="asset-card-metrics"><div><small>发布渠道</small><b>${escapeHtml(publishText)}</b><span>${record.targetCount ? "官网 / 内容平台独立记录" : "审核通过后创建任务"}</span></div><div><small>官网主信源</small><b>${assetSourceBadge(record)}</b><span>${record.sourceUrl ? escapeHtml(record.sourceUrl) : "尚未生成官网地址"}</span></div><div><small>AI 引用分析</small><b class="asset-citation-value">${escapeHtml(citationText)}</b><span>${record.tracked ? "最近一次已记录引用" : "发布后绑定问题再监测"}</span></div><div><small>最近活动</small><b>${record.lastActivity ? formatRelative(record.lastActivity) : "—"}</b><span>${escapeHtml(article.id)} · ${escapeHtml(article.author || "未分配")}</span></div></div>${expanded ? renderAssetDetail(record) : ""}</article>`;
  }).join("");
  return `<div class="page-container">${pageHead("内容资产", "一篇文章建立一个长期资产，统一管理文章版本、官网主信源、多平台发布记录和后续引用分析。", '<button class="secondary-button" type="button" data-nav="content"><span data-icon="file"></span>进入内容生产</button><button class="primary-button" type="button" data-nav="publish"><span data-icon="send"></span>查看发布任务</button>')}<div class="asset-summary"><article class="card summary-card"><span data-icon="file"></span><div><b>${records.length}</b><small>内容资产</small></div></article><article class="card summary-card"><span class="green" data-icon="globe"></span><div><b>${publishedCount}</b><small>已进入发布</small></div></article><article class="card summary-card"><span class="purple" data-icon="chart"></span><div><b>${monitoringCount}</b><small>监测中</small></div></article><article class="card summary-card"><span class="amber" data-icon="link"></span><div><b>${totalCitations}</b><small>已记录引用</small></div></article></div><div class="asset-demo-note"><span data-icon="info"></span><div><b>资产页面先记录真实发布关系，引用监测等连接器接入后再产生真实数据。</b><small>当前没有监测数据的文章会明确显示“未接入监测”，不会把发布成功误认为已被 AI 引用。</small></div></div><section class="card asset-workspace"><div class="asset-toolbar"><div class="tabs">${tabs.map(([id, label, count]) => `<button class="tab-button ${ui.assetTab === id ? "active" : ""}" type="button" data-action="asset-tab" data-tab="${id}">${label} · ${count}</button>`).join("")}</div><div class="asset-filter-tools"><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.assetSearch || "")}" placeholder="搜索文章、计划或选题" aria-label="搜索内容资产" data-asset-search /></div><button class="secondary-button button-small" type="button" data-action="asset-clear-search">清空</button></div></div>${rows ? `<div class="asset-list">${rows}</div>` : '<div class="empty-state"><div><span data-icon="file"></span><h3>没有符合条件的内容资产</h3><p>可以先在内容生产中生成文章，通过审核后会自动进入这里。</p><button class="primary-button button-small" type="button" data-nav="content">进入内容生产</button></div></div>'}</section></div>`;
}

function publishBatchEligibleArticle(article) {
  return articlePublishEligibility(article);
}

function publishBatchArticles() {
  const line = activeBusinessLine();
  const query = String(ui.publishBatchArticleSearch || "").trim().toLowerCase();
  return state.articles
    .filter((article) => !line?.id || contentArticleBusinessLineId(article) === line.id)
    .filter((article) => !query || [article.title, article.id, contentPlanForArticle(article)?.name].filter(Boolean).join(" ").toLowerCase().includes(query))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function publishBatchGroup() {
  const selection = ui.publishBatchSelection || {};
  return state.accountGroups.find((group) => group.id === selection.groupId) || state.accountGroups[0] || null;
}

function publishBatchPlatformEntry(platformId) {
  return PUBLISH_PLATFORM_REGISTRY.find((entry) => entry.id === platformId) || null;
}

function publishBatchPlatformStateLegacy(entry, group, selectedArticles) {
  if (!entry) return { available: false, status: "not_connected", reason: "平台不存在" };
  if (!entry.enabled) return { available: false, status: "not_connected", reason: entry.description || "该平台当前不可用" };
  const existingCount = selectedArticles.filter((article) => articleExistingPublishPlatforms(article).has(entry.id)).length;
  if (existingCount) return { available: false, status: "queued", reason: `${existingCount} 篇文章已有该平台任务` };
  if (entry.id === "web") return { available: true, status: "online", reason: state.site.domain + " · 服务器发布" };
  const account = group?.accounts?.[entry.id];
  if (!account) return { available: false, status: "not_connected", reason: "本地助手尚未绑定账号" };
  if (account.status !== "online") return { available: false, status: account.status || "needs_login", reason: account.name + " · 请在本地助手处理" };
  return { available: true, status: "online", reason: account.name };
}

function publishBatchPlatformState(entry, group, selectedArticles) {
  if (!entry) return { available: false, status: "not_connected", reason: "平台不存在" };
  if (!entry.enabled) return { available: false, status: entry.support === "planned" ? "planned" : "not_connected", reason: entry.description || "该平台当前不可用" };
  const existingCount = selectedArticles.filter((article) => articleExistingPublishPlatforms(article).has(entry.id)).length;
  if (existingCount) return { available: false, status: "queued", reason: `${existingCount} 篇文章已有该平台任务` };
  if (entry.id === "web") return { available: true, status: "online", reason: `${state.site.domain} · 服务器发布` };
  const catalog = publisherPlatform(entry.id);
  if (publisherSnapshot.loaded && (!catalog || !catalog.enabled)) return { available: false, status: "not_connected", reason: "本地发布器未声明该平台" };
  const connection = publisherAccountConnection(group, entry.id);
  const account = connection.account;
  if (!account) return { available: false, status: "not_connected", reason: "当前账号组尚未绑定账号" };
  if (!connection.ready) return { available: false, status: connection.status, reason: publisherConnectionMessage(connection) };
  return {
    available: true,
    status: "online",
    reason: publisherConnectionMessage(connection),
    session: connection.session
  };
}

function publishBatchCategoryTabs() {
  const categories = [
    ["self_media", "自媒体账号", "账号登录后由本地助手执行"],
    ["official", "企业官网 / 微门户", "企业主信源与站点内容"]
  ];
  return categories.map(([id, label, description]) => `<button class="publish-category-tab ${ui.publishBatchCategory === id ? "active" : ""}" type="button" data-action="publish-batch-category" data-category="${id}"><b>${label}</b><small>${description}</small></button>`).join("");
}

function publishBatchPlatformCards() {
  const selection = ui.publishBatchSelection || { platforms: [], platformOrder: [] };
  const group = publishBatchGroup();
  const selectedArticles = state.articles.filter((article) => (selection.articleIds || []).includes(article.id));
  const query = String(ui.publishBatchSearch || "").trim().toLowerCase();
  const entries = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled !== false && entry.category === ui.publishBatchCategory && (!query || [entry.id, PLATFORM_META[entry.id]?.name, entry.role, entry.capabilities].join(" ").toLowerCase().includes(query)));
  const cards = entries.map((entry) => {
    const stateMeta = publishBatchPlatformState(entry, group, selectedArticles);
    const selected = (selection.platforms || []).includes(entry.id) && stateMeta.available;
    const isExisting = stateMeta.status === "queued";
    const status = isExisting ? "queued" : stateMeta.status;
    const platform = PLATFORM_META[entry.id] || { name: entry.id, short: "平", logoClass: "generic" };
    return `<label class="publish-platform-card ${selected ? "selected" : ""} ${stateMeta.available ? "" : "disabled"}"><div class="publish-platform-card-top"><input class="checkbox" type="checkbox" data-publish-batch-platform="${entry.id}" ${selected ? "checked" : ""} ${stateMeta.available ? "" : "disabled"} /><span class="platform-logo ${platform.logoClass}">${platform.short}</span><span class="publish-platform-card-name"><b>${escapeHtml(platform.name)}</b><small>${escapeHtml(entry.role)}</small></span>${statusBadge(status)}</div><div class="publish-platform-card-meta"><span>${escapeHtml(entry.capabilities)}</span><span>${escapeHtml(stateMeta.reason)}</span></div>${entry.id === "web" ? '<em class="publish-platform-role">推荐主信源</em>' : ""}</label>`;
  }).join("");
  return cards || '<div class="empty-state compact"><div><span data-icon="search"></span><h3>没有匹配的平台</h3><p>换一个平台名称或切换平台分类。</p></div></div>';
}

function publishBatchArticleRows() {
  const selection = ui.publishBatchSelection || { articleIds: [] };
  const rows = publishBatchArticles().slice(0, 40).map((article) => {
    const eligibility = publishBatchEligibleArticle(article);
    const plan = contentPlanForArticle(article);
    const selected = selection.articleIds.includes(article.id);
    const status = articleDisplayStatus(article);
    const disabled = !eligibility.ok;
    return `<label class="publish-article-row ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}"><input class="checkbox" type="checkbox" data-publish-batch-article="${article.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""} /><span class="publish-article-row-copy"><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(plan?.name || "直接创作")} · ${escapeHtml(article.version || "v1")}</small></span><span class="publish-article-row-status">${statusBadge(status)}<small>${escapeHtml(eligibility.ok ? "可发布" : eligibility.reason)}</small></span></label>`;
  }).join("");
  return rows || '<div class="empty-state compact"><div><span data-icon="file"></span><h3>没有可选择的文章</h3><p>请先在内容生产中完成文章审核和知识证据冻结。</p><button class="primary-button button-small" type="button" data-nav="content">去内容生产</button></div></div>';
}

function publishBatchOrderChips() {
  const order = ui.publishBatchSelection?.platformOrder || [];
  return order.map((platform, index) => `<span class="publish-order-chip">${index + 1}. ${escapeHtml(PLATFORM_META[platform]?.name || platform)}<button type="button" data-action="move-publish-batch-platform" data-platform="${platform}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-publish-batch-platform" data-platform="${platform}" data-direction="down" ${index === order.length - 1 ? "disabled" : ""}>↓</button></span>`).join("");
}

function renderPublishComposer() {
  const selection = ui.publishBatchSelection || { articleIds: [], platforms: [], platformOrder: [], groupId: state.accountGroups[0]?.id || null, mode: "immediate", intervalMinutes: 60 };
  const selectedArticles = state.articles.filter((article) => selection.articleIds.includes(article.id));
  const selectedPlatforms = selection.platformOrder || selection.platforms || [];
  const group = publishBatchGroup();
  const availableCount = selectedArticles.length * selectedPlatforms.length;
  const groups = state.accountGroups.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === group?.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.deviceName || "本地设备")}</option>`).join("");
  const availablePlatformCount = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).length;
  const mode = selection.mode || "immediate";
  return `<div class="page-container publish-composer-page">${pageHead("新建发布批次", "先选择通过人工审核的文章，再选择多个平台；平台账号、顺序和间隔只影响发布执行，不改变文章版本。", '<button class="secondary-button" type="button" data-action="back-to-publish-tasks"><span data-icon="arrow"></span>返回发布任务</button>')}<div class="publish-flow-steps"><span class="active"><i>1</i>选择文章</span><b>→</b><span class="active"><i>2</i>选择平台</span><b>→</b><span><i>3</i>配置执行</span><b>→</b><span><i>4</i>发布回写</span></div><div class="publish-composer-grid"><section class="card publish-composer-section publish-article-picker"><div class="publish-composer-section-head"><div><h3>选择文章</h3><p>只有完成审核、风控和知识证据冻结的当前版本可以发布。</p></div><span class="small-tag blue">已选 ${selectedArticles.length} 篇</span></div><div class="publish-picker-toolbar"><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.publishBatchArticleSearch || "")}" placeholder="搜索文章、计划或编号" aria-label="搜索待发布文章" data-publish-batch-article-search /></div><button class="secondary-button button-small" type="button" data-action="publish-batch-select-eligible">选择全部可发布</button></div><div class="publish-article-list">${publishBatchArticleRows()}</div></section><section class="card publish-composer-section publish-platform-picker"><div class="publish-composer-section-head"><div><h3>选择发布平台</h3><p>同一篇文章可以发布多个平台，但同一平台只允许一个账号。</p></div><span class="small-tag green">${availablePlatformCount} 个可用</span></div><div class="publish-platform-actions"><button class="secondary-button button-small" type="button" data-action="publish-batch-select-all"><span data-icon="sparkle"></span>全平台智能分发</button><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.publishBatchSearch || "")}" placeholder="搜索平台" aria-label="搜索发布平台" data-publish-batch-platform-search /></div></div><div class="publish-category-tabs">${publishBatchCategoryTabs()}</div><div class="publish-platform-grid">${publishBatchPlatformCards()}</div><div class="publish-platform-note"><span data-icon="info"></span><span>官网不强制勾选；已登录的平台可直接下发至本地发布助手。若平台执行时出现验证码、审核或发布限制，任务结果会单独回写，不会影响其他平台。</span></div></section></div><section class="card publish-composer-section publish-delivery-config"><div class="publish-composer-section-head"><div><h3>账号与执行规则</h3><p>本地助手按照平台顺序执行，每发送一篇后等待设定间隔，再继续下一篇。</p></div><span class="small-tag">${selectedPlatforms.length} 个平台</span></div><div class="publish-config-grid"><label class="field"><span>发布账号组</span><select class="select" data-publish-batch-group>${groups}</select><small>账号登录和分类在本地发布助手中维护，后台只同步账号别名和状态。</small></label><label class="field"><span>文章间隔（分钟）</span><input class="input" type="number" min="5" max="1440" step="5" value="${escapeHtml(selection.intervalMinutes || 60)}" data-publish-batch-interval /><small>适用于同一平台的下一篇文章。</small></label><div class="publish-mode-picker"><span>发布方式</span><div class="publish-mode-options"><label class="publish-mode-option ${mode === "immediate" ? "active" : ""}"><input type="radio" name="publish-batch-mode" value="immediate" data-publish-batch-mode ${mode === "immediate" ? "checked" : ""} /><b>立即发布</b><small>创建任务后由本地助手按顺序领取</small></label><label class="publish-mode-option ${mode === "schedule" ? "active" : ""}"><input type="radio" name="publish-batch-mode" value="schedule" data-publish-batch-mode ${mode === "schedule" ? "checked" : ""} /><b>定时排期</b><small>继续设置每天数量、时间和预计完成日期</small></label></div></div></div><div class="publish-order-config"><span>执行顺序</span><div class="publish-order-chips">${publishBatchOrderChips() || '<small>选择平台后可调整顺序</small>'}</div></div></section><section class="card publish-batch-summary"><div><span class="publish-summary-icon" data-icon="send"></span><div><b>${selectedArticles.length} 篇文章 × ${selectedPlatforms.length} 个平台</b><small>将创建 ${availableCount} 条平台发布任务；文章资产仍按文章版本独立管理。</small></div></div><div class="publish-summary-actions"><button class="secondary-button" type="button" data-action="publish-batch-preflight" ${selectedArticles.length && selectedPlatforms.length ? "" : "disabled"}><span data-icon="shield"></span>检查发布条件</button><button class="primary-button" type="button" data-action="submit-publish-batch" ${selectedArticles.length && selectedPlatforms.length ? "" : "disabled"}>${mode === "schedule" ? '<span data-icon="clock"></span>进入定时排期' : '<span data-icon="send"></span>立即创建发布任务'}</button></div></section></div>`;
}

function openPublishBatch(articleIds = []) {
  const available = state.articles.filter((article) => articleBusinessLineIsActive(article) && publishBatchEligibleArticle(article).ok);
  const requested = [...new Set(articleIds)].map((id) => state.articles.find((article) => article.id === id)).filter((article) => article && available.some((item) => item.id === article.id));
  const selectedArticles = requested.length ? requested : available.slice(0, 1);
  const group = state.accountGroups[0] || null;
  const platforms = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
  ui.publishBatchSelection = { articleIds: selectedArticles.map((article) => article.id), groupId: group?.id || null, platforms, platformOrder: [...platforms], intervalMinutes: 60, mode: "immediate" };
  ui.publishBatchCategory = "self_media";
  ui.publishBatchSearch = "";
  ui.publishBatchArticleSearch = "";
  ui.publishView = "compose";
  closeModal();
  navigate("publish");
}

function openScheduleFromPublishBatch() {
  const selection = ui.publishBatchSelection;
  if (!selection?.articleIds?.length) return showToast("请先选择文章", "定时发布需要至少选择一篇通过审核的文章。", "error");
  if (!selection.platformOrder?.length) return showToast("请先选择平台", "请选择至少一个可用平台。", "error");
  const eligible = selection.articleIds.filter((id) => articlePublishEligibility(state.articles.find((article) => article.id === id)).ok);
  if (!eligible.length) return showToast("没有可排期文章", "选中的文章必须完成审核、风控和知识证据冻结。", "error");
  ui.scheduleSelection = { ...scheduleDefaultSelection(eligible), groupId: selection.groupId, platforms: [...selection.platformOrder], platformOrder: [...selection.platformOrder], intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60) };
  ui.publishView = "tasks";
  ui.modal = { type: "schedule" };
  renderModal();
}

function submitPublishBatchLegacy() {
  const selection = ui.publishBatchSelection;
  if (!selection?.articleIds?.length) return showToast("请先选择文章", "请选择至少一篇文章。", "error");
  if (!selection.platformOrder?.length) return showToast("请先选择平台", "请选择至少一个可用平台。", "error");
  if (selection.mode === "schedule") return openScheduleFromPublishBatch();
  const group = publishBatchGroup();
  const articles = selection.articleIds.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
  const tasks = [];
  articles.forEach((article) => {
    const eligibility = articlePublishEligibility(article);
    if (!eligibility.ok) return;
    const existing = articleExistingPublishPlatforms(article);
    const platforms = selection.platformOrder.filter((platform) => !existing.has(platform) && publishBatchPlatformState(publishBatchPlatformEntry(platform), group, [article]).available);
    if (!platforms.length) return;
    const task = { id: uid("PUB"), batchId: uid("BATCH"), articleId: article.id, articleTitle: article.title, version: article.version, groupId: group?.id || null, groupName: group?.name || "未选择账号组", platformOrder: [...platforms], intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60), status: "queued", createdAt: Date.now(), targets: {}, logs: [] };
    platforms.forEach((platform) => {
      const account = platform === "web" ? state.site.domain : publisherAccount(group, platform);
      task.targets[platform] = { status: "queued", account: platform === "web" ? state.site.domain : account.name, remoteUrl: "", updatedAt: Date.now() };
      task.logs.push({ time: "刚刚", platform: PLATFORM_META[platform]?.name || platform, message: platform === "web" ? "官网发布任务已入队" : "等待本地发布助手按平台顺序领取任务" });
    });
    tasks.push(task);
    article.status = "publishing";
    article.updatedAt = Date.now();
  });
  if (!tasks.length) return showToast("没有可创建的目标", "可能已存在相同平台任务，或文章发布条件已变化。", "error");
  state.publishTasks.unshift(...tasks.reverse());
  saveState();
  ui.publishBatchSelection = null;
  ui.publishView = "tasks";
  ui.publishTab = "running";
  navigate("publish");
  showToast("发布批次已创建", `${tasks.length} 篇文章将按平台顺序执行，共 ${tasks.reduce((sum, task) => sum + Object.keys(task.targets).length, 0)} 条平台任务。`);
  tasks.forEach((task) => simulateTask(task.id));
}

async function submitPublishBatch() {
  const selection = ui.publishBatchSelection;
  if (!selection?.articleIds?.length) return showToast("请先选择文章", "请选择至少一篇文章。", "error");
  if (!selection.platformOrder?.length) return showToast("请先选择平台", "请选择至少一个可用平台。", "error");
  if (selection.mode === "schedule") return openScheduleFromPublishBatch();
  if (!(await ensurePublisherIntegration())) return;
  const group = publishBatchGroup();
  const articles = selection.articleIds.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
  const created = [];
  for (const article of articles) {
    const eligibility = articlePublishEligibility(article);
    if (!eligibility.ok) continue;
    const platforms = selection.platformOrder.filter((platform) => publishBatchPlatformState(publishBatchPlatformEntry(platform), group, [article]).available);
    if (!platforms.length) continue;
    const result = await publisherApi("/api/publisher/jobs", {
      method: "POST",
      body: {
        articleId: article.id,
        articleTitle: article.title,
        version: article.version,
        article: { id: article.id, title: article.title, version: article.version, excerpt: article.excerpt, content: article.content },
        webUrl: publisherArticleWebUrl(article),
        accountGroupId: group?.id,
        groupName: group?.name,
        platforms,
        platformOrder: platforms,
        intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
        mode: "immediate"
      }
    });
    if (result.job) created.push(result.job);
  }
  if (!created.length) return showToast("没有可创建的任务", "请确认文章已审核，并且账号组中存在已登录的平台账号。", "error");
  ui.publishBatchSelection = null;
  ui.publishView = "tasks";
  ui.publishTab = "running";
  await refreshPublisherSnapshot();
  navigate("publish");
  showToast("发布任务已交给本地发布器", `${created.length} 篇文章已进入平台任务队列，等待本地软件按顺序领取。`);
}

function taskNeedsAction(task) {
  return Object.values(task.targets).some((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status));
}

function renderPublish() {
  if (ui.publishView === "compose") return renderPublishComposer();
  const runningCount = state.publishTasks.filter((task) => ["queued", "running"].includes(task.status)).length;
  const actionCount = state.publishTasks.filter(taskNeedsAction).length;
  const successCount = state.publishTasks.filter((task) => task.status === "success").length;
  const scheduleCount = (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled").length;
  const readyCount = state.articles.filter((article) => article.reviewStatus === "approved" && article.status === "draft" && articleCitations(article).length && article.riskStatus === "clean" && articleBusinessLineIsActive(article)).length;
  const tabs = [["all", "全部任务"], ["running", "进行中"], ["action", "需要处理"], ["success", "发布成功"]];

  const filtered = state.publishTasks.filter((task) => {
    if (ui.publishTab === "running") return ["queued", "running"].includes(task.status);
    if (ui.publishTab === "action") return taskNeedsAction(task);
    if (ui.publishTab === "success") return task.status === "success";
    return true;
  });

  const tabHtml = tabs.map(([id, label]) => {
    const count = id === "all" ? state.publishTasks.length : id === "running" ? runningCount : id === "action" ? actionCount : successCount;
    return '<button class="tab-button ' + (ui.publishTab === id ? "active" : "") + '" type="button" data-action="publish-tab" data-tab="' + id + '">' + label + " · " + count + "</button>";
  }).join("");

  const tasks = filtered.map((task) => {
    const targetHtml = Object.entries(task.targets).map(([platform, target]) => {
      const meta = PLATFORM_META[platform];
      const result = target.status === "success"
        ? target.remoteUrl
          ? '<a href="' + escapeHtml(target.remoteUrl) + '" target="_blank" rel="noreferrer">打开发布地址</a>'
          : '<button class="link-button" type="button" data-action="task-log" data-task-id="' + task.id + '">查看回写详情</button>'
        : target.status === "result_unknown"
          ? '<button class="link-button" type="button" data-action="task-log" data-task-id="' + task.id + '">立即核验</button>'
          : ["queued", "running"].includes(target.status)
            ? "本地助手正在处理"
            : "等待处理";
      return `
        <div class="publish-target">
          <div class="platform-name"><span class="platform-label">${platformLogo(platform)}<span>${meta.name}</span></span>${statusBadge(target.status)}</div>
          <div class="target-result">${escapeHtml(target.account)} · ${result}</div>
        </div>
      `;
    }).join("");
    return `
      <article class="card publish-task">
        <div class="publish-task-head">
          <div class="publish-task-title">
            <div><h3>${escapeHtml(task.articleTitle)}</h3><span class="small-tag">${escapeHtml(task.version)}</span></div>
            <p>${escapeHtml(task.id)} · ${escapeHtml(task.groupName)} · 创建于 ${formatRelative(task.createdAt)}</p>
          </div>
          <div class="publish-task-actions">${statusBadge(task.status)}<button class="secondary-button button-small" type="button" data-action="task-log" data-task-id="${task.id}">详情</button></div>
        </div>
        <div class="publish-targets">${targetHtml}</div>
      </article>
    `;
  }).join("");

  return `
    <div class="page-container">
      ${pageHead("发布运营", "文章审核通过后创建发布批次；本地助手按平台顺序和文章间隔执行。", '<button class="secondary-button" type="button" data-action="go-schedule-articles"><span data-icon="clock"></span>创建定时排期</button><button class="primary-button" type="button" data-action="open-publish-batch"><span data-icon="send"></span>新建发布批次</button>')}
      ${publisherSnapshot.loaded ? "" : `<div class="privacy-note warning publisher-offline-note"><span data-icon="alert"></span><span><b>发布服务未连接</b><br />${escapeHtml(publisherSnapshot.error || "正在连接本地发布器任务服务；断连期间不会创建模拟任务或伪造发布结果。")}</span><button class="secondary-button button-small" type="button" data-action="refresh-publisher"><span data-icon="refresh"></span>重新连接</button></div>`}
      <section class="publish-summary">
        <article class="card summary-card"><span data-icon="file"></span><div><b>${readyCount}</b><small>待发布文章</small></div></article>
        <article class="card summary-card"><span data-icon="clock"></span><div><b>${scheduleCount}</b><small>有效发布排期</small></div></article>
        <article class="card summary-card"><span class="purple" data-icon="send"></span><div><b>${runningCount}</b><small>执行中任务</small></div></article>
        <article class="card summary-card"><span class="red" data-icon="alert"></span><div><b>${actionCount}</b><small>需要人工处理</small></div></article>
      </section>
      ${renderPublishSchedules()}
      <div class="tabs-row"><div class="tabs">${tabHtml}</div><div class="filter-tools"><button class="secondary-button button-small" type="button" data-nav="assistant"><span data-icon="monitor"></span>账号组状态</button></div></div>
      <div class="publish-list">
        ${tasks || '<section class="card empty-state"><div><span data-icon="send"></span><h3>这里还没有任务</h3><p>从已通过文章发起一次多平台发布。</p><button class="primary-button button-small" type="button" data-action="publish-approved">选择文章</button></div></section>'}
      </div>
    </div>
  `;
}

function monitoringTabs() {
  const tabs = [
    ["overview", "数据总览"],
    ["mentions", "提及与排名"],
    ["sources", "引用信源"],
    ["sentiment", "品牌情感"],
    ["dialogs", "AI 对话"],
    ["tracking", "作品追踪"]
  ];
  return '<div class="tabs monitoring-tabs">' + tabs.map(([id, label]) =>
    '<button class="tab-button ' + (ui.monitoringTab === id ? "active" : "") + '" type="button" data-action="monitoring-tab" data-tab="' + id + '">' + label + "</button>"
  ).join("") + "</div>";
}

function monitoringFilters() {
  const platformOptions = ['<option value="all">全部 AI 平台</option>']
    .concat(state.monitoring.platforms.map((platform) => '<option value="' + platform.id + '" ' + (ui.monitoringPlatform === platform.id ? "selected" : "") + ">" + platform.name + "</option>"))
    .join("");
  return `
    <section class="card monitor-filters">
      <div class="field">
        <label>监测对象</label>
        <select class="select"><option>桐灼科技 · GEO 优化服务</option></select>
      </div>
      <div class="field">
        <label>AI 平台</label>
        <select class="select" data-monitor-filter="platform">${platformOptions}</select>
      </div>
      <div class="field">
        <label>统计周期</label>
        <select class="select" data-monitor-filter="range">
          <option value="7" ${ui.monitoringRange === "7" ? "selected" : ""}>最近 7 天</option>
          <option value="30" ${ui.monitoringRange === "30" ? "selected" : ""}>最近 30 天</option>
          <option value="90" ${ui.monitoringRange === "90" ? "selected" : ""}>最近 90 天</option>
        </select>
      </div>
      <div class="monitor-filter-meta"><span>最近采集</span><b>${formatRelative(state.monitoring.lastRunAt)}</b></div>
    </section>
  `;
}

function selectedMonitoringPlatform() {
  return state.monitoring.platforms.find((platform) => platform.id === ui.monitoringPlatform) || null;
}

function monitoringSourceRecords() {
  const sourceMap = new Map((state.monitoring.sources || []).map((source) => [source.domain, { ...source }]));
  (state.monitoring.trackedWorks || []).forEach((work) => {
    const domain = work.sourceDomain || "unknown.local";
    const existing = sourceMap.get(domain) || {
      id: "SOURCE-" + domain.replace(/[^a-z0-9]/gi, "-").toUpperCase(), domain, name: work.site || domain, type: work.type || "内容平台", works: 0, questions: 0, citations: 0
    };
    const worksForDomain = (state.monitoring.trackedWorks || []).filter((item) => (item.sourceDomain || "unknown.local") === domain);
    sourceMap.set(domain, {
      ...existing,
      works: worksForDomain.length,
      questions: worksForDomain.reduce((sum, item) => sum + Number(item.questions || item.questionIds?.length || 0), 0),
      citations: worksForDomain.reduce((sum, item) => sum + Number(item.citations || 0), 0)
    });
  });
  return [...sourceMap.values()].sort((a, b) => Number(b.citations || 0) - Number(a.citations || 0));
}

function monitoringWorksForSource(domain) {
  return (state.monitoring.trackedWorks || []).filter((work) => (work.sourceDomain || "unknown.local") === domain);
}

function visibleMonitoringQuestions() {
  const platform = selectedMonitoringPlatform();
  return platform ? state.monitoring.questions.filter((question) => question.platform === platform.name) : state.monitoring.questions;
}

function monitoringTaskBadge(status) {
  const meta = {
    queued: ["待首次采样", "status-queued"],
    running: ["采样中", "status-running"],
    success: ["采样完成", "status-success"],
    failed: ["采样失败", "status-error"]
  }[status] || [status, "status-draft"];
  return '<span class="status-badge ' + meta[1] + '">' + escapeHtml(meta[0]) + "</span>";
}

function mentionTrendChart() {
  const points = state.monitoring.trend;
  const max = 60;
  const width = 640;
  const height = 190;
  const paddingX = 28;
  const paddingY = 18;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2 - 20;
  const coordinates = points.map((point, index) => {
    const x = paddingX + (usableW * index) / Math.max(points.length - 1, 1);
    const y = paddingY + usableH - (point.mention / max) * usableH;
    return { x, y, ...point };
  });
  const polyline = coordinates.map((point) => point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
  const dots = coordinates.map((point) =>
    '<circle cx="' + point.x + '" cy="' + point.y + '" r="4" fill="#2563eb"><title>' + point.label + " · 提及率 " + point.mention + "%</title></circle>"
  ).join("");
  const labels = coordinates.map((point) =>
    '<text x="' + point.x + '" y="' + (height - 4) + '" text-anchor="middle">' + point.label + "</text>"
  ).join("");
  return `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="近30天品牌提及率趋势">
      <defs><linearGradient id="mentionArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".20"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
      <line x1="${paddingX}" y1="${paddingY + usableH}" x2="${width - paddingX}" y2="${paddingY + usableH}" stroke="#e2e8f0"/>
      <line x1="${paddingX}" y1="${paddingY + usableH / 2}" x2="${width - paddingX}" y2="${paddingY + usableH / 2}" stroke="#edf1f5" stroke-dasharray="4 5"/>
      <polygon points="${paddingX},${paddingY + usableH} ${polyline} ${width - paddingX},${paddingY + usableH}" fill="url(#mentionArea)"/>
      <polyline points="${polyline}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>
  `;
}

function renderMonitoringOverview() {
  const selectedPlatform = selectedMonitoringPlatform();
  const metrics = {
    total: selectedPlatform?.questions ?? state.monitoring.metrics.totalSamples,
    valid: selectedPlatform?.valid ?? state.monitoring.metrics.validSamples,
    mentions: selectedPlatform?.mentions ?? state.monitoring.metrics.mentions,
    recommendations: selectedPlatform?.recommended ?? state.monitoring.metrics.recommendations,
    officialCitations: selectedPlatform?.officialCitations ?? state.monitoring.metrics.officialCitations
  };
  const visiblePlatforms = selectedPlatform ? [selectedPlatform] : state.monitoring.platforms;
  const platformRows = visiblePlatforms.map((platform) => `
    <div class="platform-performance-row">
      <span class="ai-platform-mark">${platform.name.slice(0, 1)}</span>
      <span class="platform-performance-copy"><b>${platform.name}</b><small>有效 ${platform.valid} · 提及 ${platform.mentions} · 推荐 ${platform.recommended} · 官网引用 ${platform.officialCitations}</small></span>
      <span class="platform-performance-value"><b>${platform.mentions} / ${platform.valid}</b><span class="mini-progress"><i style="width:${platform.mentionRate}%"></i></span></span>
    </div>
  `).join("");
  const taskRows = state.monitoring.tasks.filter((task) => !task.archivedAt).map((task) => `
    <button class="monitor-task-row" type="button" data-action="monitor-task-detail" data-task-id="${task.id}">
      <span class="monitor-task-icon" data-icon="target"></span>
      <span><b>${escapeHtml(task.name)}</b><small>${task.platforms.length} 个平台 · ${task.questionCount} 个问题</small></span>
      <span><b>${task.lastRunAt ? formatRelative(task.lastRunAt) : "尚未运行"}</b><small>${task.lastRunAt ? "最近采样" : "等待首次采样"}</small></span>
      ${monitoringTaskBadge(task.status)}
    </button>
  `).join("");
  const latestQuestions = visibleMonitoringQuestions().slice(0, 4).map((question) => `
    <div class="monitor-question-row">
      <span class="question-state ${question.mentioned ? "mentioned" : ""}" data-icon="${question.mentioned ? "check" : "x"}"></span>
      <span><b>${escapeHtml(question.question)}</b><small>${question.platform} · ${escapeHtml(question.type)} · ${formatRelative(question.checkedAt)}</small></span>
      <span>${question.mentioned ? '<b>第 ' + question.rank + " 位</b><small>" + question.sentiment + "</small>" : '<b>未提及</b><small>建议补充内容</small>'}</span>
    </div>
  `).join("");

  return `
    <section class="monitor-kpi-grid">
      <article class="card monitor-kpi"><span class="monitor-kpi-icon" data-icon="help"></span><div><small>有效样本</small><b>${metrics.valid}<i> / ${metrics.total}</i></b><em>成功取得完整回答</em></div></article>
      <article class="card monitor-kpi"><span class="monitor-kpi-icon green" data-icon="chart"></span><div><small>品牌提及</small><b>${metrics.mentions}<i> / ${metrics.valid}</i></b><em>只统计有效样本</em></div></article>
      <article class="card monitor-kpi"><span class="monitor-kpi-icon amber" data-icon="target"></span><div><small>明确推荐</small><b>${metrics.recommendations}<i> / ${metrics.valid}</i></b><em>回答存在明确推荐语义</em></div></article>
      <article class="card monitor-kpi"><span class="monitor-kpi-icon purple" data-icon="link"></span><div><small>官网引用</small><b>${metrics.officialCitations}<i> / ${metrics.valid}</i></b><em>引用 URL 命中官方域名</em></div></article>
    </section>
    <div class="monitor-layout">
      <section class="card monitor-chart-card">
        <div class="card-header"><div><h3>品牌提及率趋势</h3><p>同一问题集、同一平台口径下的周期变化</p></div><span class="small-tag blue">+14.6 个百分点</span></div>
        <div class="card-body">${mentionTrendChart()}<div class="chart-legend"><span><i></i>品牌提及率（同口径轮次）</span><b>当前 7 / 15</b></div></div>
      </section>
      <section class="card">
        <div class="card-header"><div><h3>平台表现</h3><p>演示问题集的横向对比</p></div></div>
        <div class="platform-performance-list">${platformRows}</div>
      </section>
    </div>
    <div class="monitor-layout monitor-layout-bottom">
      <section class="card">
        <div class="card-header"><div><h3>最近监测结果</h3><p>逐问题保留回答、提及位置和引用证据</p></div><button class="text-button" data-action="monitoring-tab" data-tab="dialogs">查看全部 <span data-icon="arrow"></span></button></div>
        <div class="monitor-question-list">${latestQuestions}</div>
      </section>
      <section class="card">
        <div class="card-header"><div><h3>监测任务</h3><p>正式版由新增采集调度服务执行</p></div><button class="icon-button" type="button" data-action="open-monitor-task" aria-label="创建监测"><span data-icon="plus"></span></button></div>
        <div class="monitor-task-list">${taskRows}</div>
      </section>
    </div>
  `;
}

function renderMonitoringTable() {
  const questions = visibleMonitoringQuestions();
  if (ui.monitoringTab === "mentions") {
    const rows = questions.map((item) => `<tr><td class="article-title-cell"><b>${escapeHtml(item.question)}</b><small>${escapeHtml(item.type)}</small></td><td>${escapeHtml(item.platform)}</td><td>${ui.monitoringRange} 天</td><td>${item.mentioned ? "已提及" : "未提及"}</td><td>${item.rank ? "第 " + item.rank + " 位" : "—"}</td><td><span class="status-badge ${item.mentioned ? "status-approved" : "status-draft"}">${item.mentioned ? "已提及" : "未提及"}</span></td></tr>`).join("");
    return `<section class="card table-card"><div class="card-header"><div><h3>品牌提及记录</h3><p>按问题、平台和时间保留每次监测结果</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>AI 问题</th><th>平台</th><th>监测周期</th><th>本轮提及</th><th>榜单位置</th><th>结果</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  if (ui.monitoringTab === "sources") {
    const rows = monitoringSourceRecords().map((item) => `<tr><td class="article-title-cell"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.domain)}</small></td><td><span class="source-tag">${escapeHtml(item.type)}</span></td><td>${item.works}</td><td>${item.questions}</td><td><b>${item.citations}</b> 次</td><td><button class="link-button" type="button" data-action="monitor-source-works" data-source-domain="${escapeHtml(item.domain)}">查看作品</button></td></tr>`).join("");
    return `<section class="card table-card"><div class="card-header"><div><h3>引用信源分析</h3><p>识别 AI 回答引用了哪些官网和平台作品</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>来源</th><th>类型</th><th>被引用作品</th><th>引用问题</th><th>引用次数</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  if (ui.monitoringTab === "sentiment") {
    const rows = questions.filter((item) => item.mentioned).map((item) => `<tr><td class="article-title-cell"><b>${escapeHtml(item.question)}</b><small>${escapeHtml(item.type)}</small></td><td>${item.platform}</td><td>${item.sentiment === "正面" ? '<span class="status-badge status-approved">正面</span>' : '<span class="status-badge status-draft">中性</span>'}</td><td>${item.sources} 个</td><td>${formatRelative(item.checkedAt)}</td></tr>`).join("");
    return `
      <div class="sentiment-layout">
        <section class="card sentiment-summary"><div class="sentiment-ring"><span><b>${state.monitoring.metrics.sentimentPositive}%</b><small>正面</small></span></div><div><h3>品牌情感倾向</h3><p>只对明确提及品牌的回答进行语义判断，必须保留原回答证据。</p><div class="sentiment-legend"><span><i class="positive"></i>正面 72%</span><span><i class="neutral"></i>中性 24%</span><span><i class="negative"></i>负面 4%</span></div></div></section>
        <section class="card table-card"><div class="card-header"><div><h3>情感记录</h3><p>可回看原始 AI 回答</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>AI 问题</th><th>平台</th><th>倾向</th><th>引用来源</th><th>检测时间</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      </div>
    `;
  }
  if (ui.monitoringTab === "dialogs") {
    const rows = questions.map((item) => `<tr><td>${formatRelative(item.checkedAt)}</td><td class="article-title-cell"><b>${escapeHtml(item.question)}</b><small>问题类型：${item.type}</small></td><td>${item.platform}</td><td>${item.mentioned ? "提及，排名 " + item.rank : "未提及"}</td><td>${item.sources}</td><td><button class="link-button" data-action="monitor-dialog-detail" data-sample-id="${item.id}">查看回答</button></td></tr>`).join("");
    return `<section class="card table-card"><div class="card-header"><div><h3>AI 对话记录</h3><p>原问题、原回答、品牌位置和信源证据必须可追溯</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>时间</th><th>AI 问题</th><th>平台</th><th>提及结果</th><th>引用源</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  const rows = state.monitoring.trackedWorks.map((item) => `<tr><td class="article-title-cell"><button class="link-button" type="button" data-action="edit-tracked-work" data-work-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button><small>发布站点：${escapeHtml(item.site)}${item.url ? " · " + escapeHtml(item.url) : ""}</small></td><td><span class="source-tag">${escapeHtml(item.type)}</span></td><td>${item.citedDays} 天</td><td>${item.questions || item.questionIds?.length || 0}</td><td>${item.citations}</td><td>${item.citations ? statusBadge("success") : statusBadge("queued")}</td></tr>`).join("");
  return `<section class="card table-card"><div class="card-header"><div><h3>作品引用追踪</h3><p>将已发布文章与 AI 回答中的引用证据关联；可从内容资产直接带入，也可补录外部作品。</p></div><button class="secondary-button button-small" type="button" data-action="add-tracked-work"><span data-icon="plus"></span>添加作品</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>作品</th><th>站点类型</th><th>被引用天数</th><th>引用问题</th><th>引用次数</th><th>状态</th></tr></thead><tbody>${rows || '<tr><td colspan="6"><div class="empty-state compact"><p>还没有纳入引用追踪的作品。</p></div></td></tr>'}</tbody></table></div></section>`;
}

function renderMonitoring() {
  const actions = '<button class="secondary-button" type="button" data-action="refresh-monitoring" ' + (ui.monitoringRefreshing ? "disabled" : "") + '>' + (ui.monitoringRefreshing ? '<span class="loading-spinner" style="border-color:#9bb7ee;border-top-color:var(--blue)"></span>正在采集' : '<span data-icon="refresh"></span>刷新监测') + '</button><button class="primary-button" type="button" data-action="open-monitor-task"><span data-icon="plus"></span>创建监测</button>';
  return `
    <div class="page-container">
      ${pageHead("效果监测", "持续验证品牌是否被 AI 提及、排在什么位置，以及哪些内容成为引用信源。", actions)}
      <div class="monitor-demo-note"><span data-icon="info"></span><span><b>当前展示为产品演示数据</b>正式版需要新增 AI 平台采集、调度、证据留存与统计服务；GEOFlow、GEORank 现有源码不包含完整监测引擎。</span><span class="small-tag blue">演示数据</span></div>
      ${monitoringFilters()}
      <div class="tabs-row">${monitoringTabs()}<span class="health"><i></i>监测任务正常</span></div>
      ${ui.monitoringTab === "overview" ? renderMonitoringOverview() : renderMonitoringTable()}
    </div>
  `;
}

function legacySiteTabs() {
  const tabs = [["preview", "官网预览"], ["homepage", "首页编排"], ["leads", "咨询线索"], ["settings", "站点设置"]];
  return '<div class="tabs">' + tabs.map(([id, label]) => '<button class="tab-button ' + (ui.siteTab === id ? "active" : "") + '" type="button" data-action="site-tab" data-tab="' + id + '">' + label + "</button>").join("") + "</div>";
}

function legacyRenderSitePanel() {
  if (ui.siteTab === "homepage") {
    const modules = [
      ["01", "首屏定位", "标题、价值说明与主要行动按钮", "已发布"],
      ["02", "核心服务", "引用企业知识中的 3 项产品服务", "已发布"],
      ["03", "典型案例", "引用 6 条已审核案例", "已发布"],
      ["04", "常见问题", "引用 8 条高频 FAQ", "草稿"]
    ];
    return `
      <section class="card table-card">
        <div class="card-header"><div><h3>首页模块</h3><p>拖拽编排将在正式 GEOFlow 主题模块中实现</p></div><button class="primary-button button-small" type="button" data-action="site-module-add"><span data-icon="plus"></span>添加模块</button></div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>顺序</th><th>模块</th><th>内容来源</th><th>状态</th><th></th></tr></thead><tbody>
          ${modules.map((row) => '<tr><td>' + row[0] + '</td><td><b>' + row[1] + '</b></td><td>' + row[2] + '</td><td>' + (row[3] === "已发布" ? statusBadge("published") : statusBadge("draft")) + '</td><td><button class="link-button" data-action="site-module-edit" data-module="' + escapeHtml(row[1]) + '">编辑</button></td></tr>').join("")}
        </tbody></table></div>
      </section>
    `;
  }

  if (ui.siteTab === "leads") {
    const leads = [
      ["李先生", "山东某机械制造企业", "GEO 优化服务", "今天 10:06", "new"],
      ["刘经理", "淄博某新材料公司", "企业 AI 落地", "昨天 16:34", "contacted"],
      ["张总", "济南某工业设备企业", "官网 + GEO", "7月20日", "qualified"]
    ];
    const leadStatus = { new: ["新线索", "status-review"], contacted: ["已联系", "status-publishing"], qualified: ["有效商机", "status-approved"] };
    return `
      <section class="card table-card">
        <div class="card-header"><div><h3>官网咨询线索</h3><p>来自 GEOFlow 可配置表单与线索状态</p></div><button class="secondary-button button-small" type="button" data-action="export-leads"><span data-icon="download"></span>导出 CSV</button></div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>联系人</th><th>企业</th><th>咨询服务</th><th>提交时间</th><th>状态</th><th></th></tr></thead><tbody>
          ${leads.map((lead) => '<tr><td><b>' + lead[0] + '</b></td><td>' + lead[1] + '</td><td>' + lead[2] + '</td><td>' + lead[3] + '</td><td><span class="status-badge ' + leadStatus[lead[4]][1] + '">' + leadStatus[lead[4]][0] + '</span></td><td><button class="link-button" data-action="site-lead-follow" data-lead-name="' + escapeHtml(lead[0]) + '">跟进</button></td></tr>').join("")}
        </tbody></table></div>
      </section>
    `;
  }

  if (ui.siteTab === "settings") {
    return `
      <div class="site-layout">
        <section class="card">
          <div class="card-header"><div><h3>基础设置</h3><p>域名、SEO 与 AI 抓取相关设置</p></div><button class="primary-button button-small" type="button" data-action="save-site">保存设置</button></div>
          <div class="card-body">
            <div class="field-row">
              <div class="field"><label>网站名称</label><input class="input" value="桐灼科技" /></div>
              <div class="field"><label>主域名</label><input class="input" value="www.tongzhuo.com" /></div>
            </div>
            <div class="field" style="margin-top:14px"><label>网站描述</label><textarea class="textarea">桐灼科技专注 GEO 优化、短视频获客运营与企业 AI 落地。</textarea></div>
            <div class="setting-row" style="margin-top:10px"><div><b>允许 AI 抓取公开内容</b><small>生成 robots 与 AI crawler 规则</small></div><div class="setting-value">仅限已发布的官网页面</div><button class="toggle on" type="button" data-setting="siteAiCrawl" aria-label="切换"></button></div>
          </div>
        </section>
        <aside class="card">
          <div class="card-header"><div><h3>站点状态</h3><p>低频维护入口</p></div></div>
          <div class="card-body">
            <div class="site-health" style="margin-top:0">
              <div class="site-health-head"><h4>上次检测：正常</h4>${statusBadge("healthy")}</div>
              <p>检测时间 ${state.site.lastDiagnostic}。网站诊断仅用于首次上线或配置变更后的复查。</p>
              <button class="secondary-button button-small" type="button" data-action="run-diagnostic"><span data-icon="refresh"></span>重新检测</button>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  return `
    <div class="site-layout">
      <section class="card">
        <div class="card-header"><div><h3>官网实时预览</h3><p>固定企业模板引用同一份产品、案例与 FAQ 数据</p></div><button class="secondary-button button-small" type="button" data-action="preview-site"><span data-icon="external"></span>打开官网</button></div>
        <div class="card-body">
          <div class="browser-frame">
            <div class="browser-bar"><span class="browser-dots"><i></i><i></i><i></i></span><span class="browser-address">https://www.tongzhuo.com</span></div>
            <div class="site-preview">
              <div class="preview-nav"><span class="preview-brand"><i></i>桐灼科技</span><span class="preview-links"><span>首页</span><span>服务</span><span>案例</span><span>行业洞察</span><span>关于我们</span></span></div>
              <div class="preview-hero">
                <div><span class="preview-kicker">GEO · CONTENT · ENTERPRISE AI</span><h3>让企业在新的客户决策路径中，被发现、被理解、被选择</h3><p>围绕真实企业知识，连接官网信源、内容运营与 AI 应用，形成能够长期积累的数字资产。</p><span class="preview-cta">了解桐灼服务 →</span></div>
                <div class="preview-visual"><span class="visual-core">GEO</span></div>
              </div>
              <div class="preview-features"><div class="preview-feature"><b>GEO 优化</b><p>企业实体、官网信源与行业内容。</p></div><div class="preview-feature"><b>短视频运营</b><p>账号定位、内容策划与线索承接。</p></div><div class="preview-feature"><b>企业 AI 落地</b><p>知识库、业务助手与流程优化。</p></div></div>
            </div>
          </div>
        </div>
      </section>
      <aside class="stack">
        <section class="card">
          <div class="card-header"><div><h3>官网内容</h3><p>来自企业知识与文章库</p></div></div>
          <div class="site-side-list">
            <div class="site-side-item"><span><b>固定页面</b><small>首页、关于、联系等</small></span><span>${state.site.pages} 页</span></div>
            <div class="site-side-item"><span><b>行业文章</b><small>已审核并发布</small></span><span>${state.site.articles} 篇</span></div>
            <div class="site-side-item"><span><b>产品服务</b><small>引用企业知识</small></span><span>3 项</span></div>
            <div class="site-side-item"><span><b>案例与 FAQ</b><small>引用已审核资料</small></span><span>32 条</span></div>
          </div>
        </section>
        <section class="card">
          <div class="card-header"><div><h3>本月咨询</h3><p>官网表单线索</p></div><button class="text-button" type="button" data-action="site-tab" data-tab="leads">查看</button></div>
          <div class="card-body"><div style="display:flex;align-items:end;gap:10px"><b style="font-size:30px;line-height:1">${state.site.leads}</b><span style="color:var(--muted);font-size:10px">条待跟进线索</span></div></div>
        </section>
      </aside>
    </div>
  `;
}

function legacyRenderSite() {
  return `
    <div class="page-container">
      ${pageHead("官网运营", "官网是公开展示与可信信源，业务资料统一引用企业知识。", '<button class="primary-button" type="button" data-action="preview-site"><span data-icon="external"></span>预览官网</button>')}
      <div class="tabs-row">${siteTabs()}<span class="health"><i></i>网站运行正常</span></div>
      ${renderSitePanel()}
    </div>
  `;
}

/* --------------------------------------------------------------------------
 * 官网运营 CMS 演示层
 *
 * 文章正文仍由内容生产中心维护；这里负责页面结构、栏目、官网字段、
 * 预览和发布信源。正式版可将这些演示常量替换为 site/page/category API。
 * -------------------------------------------------------------------------- */
const SITE_PAGE_DEFINITIONS = [
  { id: "home", type: "首页", title: "首页", path: "/", status: "published", description: "企业定位、核心服务、案例与咨询入口" },
  { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", description: "企业主体、团队与发展信息" },
  { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", description: "服务能力、适用对象与交付边界" },
  { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", description: "经过审核的客户案例与实施结果" },
  { id: "faq", type: "FAQ 页", title: "常见问题", path: "/faq/", status: "draft", description: "高频问题、直接答案与引用依据" },
  { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", description: "客户自定义栏目下的公开文章" },
  { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", description: "咨询表单、服务区域与联系方式" },
  { id: "landing", type: "专题页", title: "制造业 GEO 专题", path: "/topics/manufacturing-geo/", status: "draft", description: "可按业务线创建的专题落地页" }
];

const SITE_CATEGORIES = [
  { id: "geo", name: "GEO优化", slug: "geo", level: 1, count: 8, status: "active", description: "企业 GEO 方法、信源建设与 AI 搜索" },
  { id: "enterprise-ai", name: "企业AI落地", slug: "enterprise-ai", level: 1, count: 5, status: "active", description: "企业知识、AI 应用与流程落地" },
  { id: "short-video", name: "短视频运营", slug: "short-video", level: 1, count: 4, status: "active", description: "短视频获客、账号运营与内容策略" },
  { id: "solutions", name: "应用方案", slug: "solutions", level: 1, count: 3, status: "active", description: "按行业和业务场景组织的解决方案" },
  { id: "procurement", name: "采购指南", slug: "procurement", level: 1, count: 2, status: "active", description: "选型、比较和采购决策问题" },
  { id: "archive", name: "历史归档", slug: "archive", level: 1, count: 6, status: "archived", description: "不再进入导航的历史栏目" }
];

const SITE_NAV_ITEMS = [
  ["首页", "/", "固定页面"],
  ["产品与服务", "/services/", "固定页面"],
  ["行业资讯", "/insights/", "资讯列表"],
  ["服务案例", "/cases/", "固定页面"],
  ["关于我们", "/about/", "固定页面"],
  ["联系我们", "/contact/", "固定页面"]
];

const SITE_SEMANTIC_MODULES = {
  home: [
    ["首屏", "企业定位、直接答案与主 CTA", "引用企业公共知识", "published"],
    ["直接答案", "用一段话回答客户最关心的问题", "AI 信源摘要", "published"],
    ["产品服务", "服务范围、适用对象和交付边界", "产品/业务线资料", "published"],
    ["案例与证据", "案例、数据和可核验事实", "已审核案例库", "published"],
    ["最新资讯", "自动展示已发布文章和栏目", "行业资讯", "draft"],
    ["咨询 CTA", "联系表单与下一步行动", "线索表单", "published"]
  ],
  insights: [
    ["栏目说明", "栏目简介、AI 摘要和导航入口", "栏目配置", "published"],
    ["文章列表", "标题、摘要、作者、日期与主栏目", "官网文章", "published"],
    ["相关内容", "按业务线、标签和实体关联内容", "内容关联", "draft"]
  ],
  services: [
    ["服务直接答案", "适合谁、解决什么问题、如何交付", "企业知识库", "published"],
    ["服务模块", "产品、能力、流程和边界", "产品/业务线资料", "published"],
    ["FAQ 与 CTA", "常见问题、证据和咨询入口", "FAQ 知识库", "draft"]
  ]
};

function sitePageDefinition(id = ui.sitePageId) {
  const pages = siteCms().pages || SITE_PAGE_DEFINITIONS;
  return pages.find((item) => item.id === id) || pages[0];
}

function siteCms() {
  return state.site.cms;
}

function sitePages() {
  return siteCms().pages || SITE_PAGE_DEFINITIONS;
}

function siteModules(pageId) {
  const modules = siteCms().modules?.[pageId];
  if (Array.isArray(modules)) return modules;
  const legacy = SITE_SEMANTIC_MODULES[pageId] || [["正文", "结构化页面正文和直接答案", "页面内容", "draft"], ["相关内容", "关联文章、案例与 FAQ", "内容库", "draft"], ["CTA", "页面行动入口", "公共组件", "published"]];
  siteCms().modules[pageId] = legacy.map((module, index) => ({ id: `${pageId}-legacy-${index}`, title: module[0], description: module[1], source: module[2], status: module[3], content: "" }));
  return siteCms().modules[pageId];
}

function siteCategories(includeArchived = false) {
  const categories = siteCms().categories || SITE_CATEGORIES;
  return includeArchived ? categories : categories.filter((item) => item.status !== "archived");
}

function siteNavItems() {
  const nav = siteCms().navItems || SITE_NAV_ITEMS;
  return nav.map((item, index) => Array.isArray(item) ? { id: `legacy-nav-${index}`, label: item[0], path: item[1], type: item[2], visible: true } : item);
}

function siteLeads() {
  return siteCms().leads || [];
}

function siteNow() {
  return new Date().toISOString();
}

function siteDisplayTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

function sitePath(value, fallback = "/") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function siteSlug(value, fallback = "page") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function siteAddRedirect(from, to, reason = "地址变更") {
  const source = sitePath(from);
  const target = sitePath(to);
  if (source === target) return null;
  const redirects = siteCms().redirects;
  const existing = redirects.find((item) => item.from === source);
  if (existing) {
    existing.to = target;
    existing.reason = reason;
    existing.status = "active";
    existing.updatedAt = siteNow();
    return existing;
  }
  const redirect = { id: uid("REDIRECT"), from: source, to: target, status: "active", reason, createdAt: siteNow(), updatedAt: siteNow() };
  redirects.unshift(redirect);
  return redirect;
}

function siteCategoryCount(category) {
  return (state.articles || []).filter((article) => article.siteCategory === category.name || article.category === category.name || article.category === category.id).length || category.count || 0;
}

function siteArticleStatus(article) {
  if (article.siteStatus === "published") return statusBadge("published");
  if (article.status === "published") return statusBadge("published");
  if (article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length) return '<span class="status-badge status-approved">待发布</span>';
  if (article.reviewStatus === "approved") return '<span class="status-badge status-review">待补证据</span>';
  return statusBadge("pending_review");
}

function siteTabs() {
  const tabs = [
    ["overview", "官网概览"],
    ["pages", "页面管理"],
    ["insights", "行业资讯"],
    ["navigation", "导航与外观"],
    ["leads", "咨询线索"],
    ["settings", "站点设置"]
  ];
  return '<div class="tabs site-cms-tabs">' + tabs.map(([id, label]) => '<button class="tab-button ' + (ui.siteTab === id ? "active" : "") + '" type="button" data-action="site-tab" data-tab="' + id + '">' + label + "</button>").join("") + "</div>";
}

function renderSiteOverview() {
  const articles = state.articles || [];
  const pages = sitePages();
  const leads = siteLeads();
  const pendingLeads = leads.filter((lead) => lead.status === "new").length;
  const published = articles.filter((article) => article.status === "published" || article.siteStatus === "published").length;
  const approved = articles.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length;
  const checks = [
    ["企业主体", "Organization 与 WebSite 已配置", "ok"],
    ["文章信源", `${published} 篇文章已生成 Article 数据`, "ok"],
    ["栏目结构", "主栏目与标签可继续配置", "warn"],
    ["机器入口", "sitemap · RSS · llms 自动更新", "ok"]
  ];
  return `
    <div class="site-cms-overview">
      <section class="site-hero-card card">
        <div class="site-hero-copy"><span class="eyebrow">PUBLIC SOURCE CMS</span><h2>把企业官网变成可持续积累的公开信源</h2><p>文章在内容生产中心完成写作和审核，官网 CMS 负责页面结构、栏目归属、SEO/AI 信号与正式发布。</p><div class="site-hero-actions"><button class="primary-button button-small" type="button" data-action="site-tab" data-tab="pages"><span data-icon="layout"></span>管理页面</button><button class="secondary-button button-small" type="button" data-action="site-tab" data-tab="insights"><span data-icon="file"></span>管理行业资讯</button></div></div>
        <div class="site-health-score"><div class="score-ring"><b>92</b><small>信源完整度</small></div><span>${statusBadge("healthy")}<small>网站发布正常</small></span></div>
      </section>
      <div class="stats-grid site-stat-grid">
        <div class="stat-card"><span class="stat-icon blue" data-icon="layout"></span><div><small>固定页面</small><b>${pages.length}</b><em>页</em></div></div>
        <div class="stat-card"><span class="stat-icon purple" data-icon="file"></span><div><small>官网文章</small><b>${published}</b><em>篇已发布</em></div></div>
        <div class="stat-card"><span class="stat-icon teal" data-icon="edit"></span><div><small>待发布文章</small><b>${approved}</b><em>篇已审核</em></div></div>
        <div class="stat-card"><span class="stat-icon orange" data-icon="message"></span><div><small>待跟进线索</small><b>${pendingLeads}</b><em>条</em></div></div>
      </div>
      <div class="site-cms-grid">
        <section class="card"><div class="card-header"><div><h3>官网内容流水线</h3><p>每一步都有明确归属，避免文章正文在两个地方维护。</p></div><span class="small-tag blue">当前站点：${escapeHtml(state.site.domain)}</span></div><div class="site-publish-flow"><div class="site-flow-step done"><i>1</i><b>内容生产</b><small>写作、知识库引用、AI 协作</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step done"><i>2</i><b>人工审核</b><small>事实、风险与证据冻结</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step active"><i>3</i><b>官网 CMS</b><small>栏目、SEO、预览与发布</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step"><i>4</i><b>公开信源</b><small>页面、sitemap、RSS、llms</small></div></div></section>
        <section class="card"><div class="card-header"><div><h3>信源检查</h3><p>发布时自动执行，不需要频繁手动诊断。</p></div><button class="text-button" type="button" data-action="site-tab" data-tab="settings">查看设置</button></div><div class="site-check-list">${checks.map(([title, text, stateName]) => `<div class="site-check-item"><span class="check-dot ${stateName}">${stateName === "ok" ? "✓" : "!"}</span><span><b>${title}</b><small>${text}</small></span></div>`).join("")}</div></section>
      </div>
      <section class="card"><div class="card-header"><div><h3>最近官网发布</h3><p>仅显示已通过审核并生成官网版本的内容。</p></div><button class="text-button" type="button" data-action="site-tab" data-tab="insights">查看全部</button></div><div class="site-recent-list">${articles.filter((article) => article.status === "published" || article.reviewStatus === "approved").slice(0, 4).map((article) => `<div class="site-recent-item"><span class="site-recent-type">${escapeHtml(article.category || "行业资讯")}</span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.author || "企业内容团队")} · ${formatRelative(article.updatedAt)}</small></div><span>${siteArticleStatus(article)}</span></div>`).join("")}</div></section>
    </div>
  `;
}

function renderSitePages() {
  const page = sitePageDefinition();
  const pages = sitePages();
  const modules = siteModules(page.id);
  return `
    <div class="site-page-toolbar"><div><h2>页面管理</h2><p>固定模板 + 语义模块，保证页面可编辑、可预览、可回滚。</p></div><div class="modal-foot-right"><button class="secondary-button button-small" type="button" data-action="site-new-page"><span data-icon="plus"></span>新建专题页</button><button class="primary-button button-small" type="button" data-action="site-page-save"><span data-icon="check"></span>保存页面</button></div></div>
    <div class="site-page-manager">
      <aside class="card site-page-tree"><div class="card-header"><div><h3>页面树</h3><p>${pages.length} 个页面 · ${pages.filter((item) => item.status === "published").length} 个已发布</p></div></div><div class="site-tree-list">${pages.map((item) => `<button class="site-tree-item ${item.id === page.id ? "active" : ""}" type="button" data-action="site-page" data-page-id="${escapeHtml(item.id)}"><span class="site-tree-icon" data-icon="${item.id === "home" ? "home" : item.id === "insights" ? "file" : item.id === "contact" ? "message" : "layout"}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.path)}</small></span>${item.status === "published" ? '<i class="site-tree-status">已发布</i>' : '<i class="site-tree-status draft">草稿</i>'}</button>`).join("")}</div></aside>
      <section class="card site-page-editor"><div class="card-header"><div><span class="small-tag">${escapeHtml(page.type)}</span><h3>${escapeHtml(page.title)}</h3><p>${escapeHtml(page.description)}</p></div><button class="secondary-button button-small" type="button" data-action="site-page-preview" data-page-id="${escapeHtml(page.id)}"><span data-icon="eye"></span>预览页面</button></div><div class="site-editor-canvas"><div class="site-editor-canvas-head"><span>页面模块</span><small>每个模块可编辑内容来源与展示状态</small></div>${modules.map((module, index) => `<div class="site-module-row"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><span class="site-module-grip">⋮⋮</span><div class="site-module-copy"><b>${escapeHtml(module.title)}</b><small>${escapeHtml(module.description)}</small><em>内容来源：${escapeHtml(module.source)}</em></div><span>${module.status === "published" ? statusBadge("published") : statusBadge("draft")}</span><button class="icon-button" type="button" data-action="site-module-edit" data-page-id="${escapeHtml(page.id)}" data-module-id="${escapeHtml(module.id)}" aria-label="编辑模块"><span data-icon="edit"></span></button></div>`).join("")}<button class="site-add-module" type="button" data-action="site-module-add" data-page-id="${escapeHtml(page.id)}"><span data-icon="plus"></span>添加语义模块</button></div></section>
      <aside class="card site-page-settings"><div class="card-header"><div><h3>页面设置</h3><p>页面级 SEO 与 AI 信号</p></div></div><div class="card-body"><div class="field"><label for="site-page-title">页面标题</label><input class="input" id="site-page-title" value="${escapeHtml(page.title)}" /></div><div class="field"><label for="site-page-path">页面路径</label><input class="input" id="site-page-path" value="${escapeHtml(page.path)}" /></div><div class="field"><label for="site-page-seo">SEO 描述</label><textarea class="textarea" id="site-page-seo" rows="4">${escapeHtml(page.seoDescription || page.description)}</textarea></div><div class="setting-row"><div><b>自动生成结构化数据</b><small>${escapeHtml(page.type)} 模板自动生成对应 Schema</small></div><label class="toggle ${page.schemaEnabled !== false ? "on" : ""}"><input type="checkbox" id="site-page-schema" ${page.schemaEnabled !== false ? "checked" : ""} /><span></span></label></div><div class="setting-row"><div><b>加入站点地图</b><small>发布后自动更新 sitemap</small></div><label class="toggle ${page.sitemapEnabled !== false ? "on" : ""}"><input type="checkbox" id="site-page-sitemap" ${page.sitemapEnabled !== false ? "checked" : ""} /><span></span></label></div><div class="site-page-version"><span data-icon="history"></span><span><b>当前版本 v${escapeHtml(page.version || 1)}</b><small>最近保存：${escapeHtml(siteDisplayTime(page.savedAt))} · 可回滚</small></span><button class="link-button" type="button" data-action="site-page-version" data-page-id="${escapeHtml(page.id)}">查看</button></div></div></aside>
    </div>
  `;
}

function renderSiteInsights() {
  const articles = (state.articles || []).filter((article) => ui.siteCategoryFilter === "all" || article.siteCategory === ui.siteCategoryFilter || article.category === ui.siteCategoryFilter);
  const categories = siteCategories();
  return `
    <div class="site-page-toolbar"><div><h2>行业资讯</h2><p>正文在内容生产中心完成；这里管理主栏目、标签、官网字段和发布状态。</p></div><div class="modal-foot-right"><button class="secondary-button button-small" type="button" data-action="site-category-action"><span data-icon="layers"></span>管理栏目</button><button class="primary-button button-small" type="button" data-action="site-content-production"><span data-icon="edit"></span>去内容生产</button></div></div>
    <section class="card site-source-note"><span class="site-source-note-icon" data-icon="info"></span><div><b>官网文章的唯一写作入口是“内容生产中心”</b><p>审核通过后，文章才会出现在这里。官网 CMS 可补充主栏目、标签、摘要、封面、SEO 和 URL，不复制另一套正文编辑器。</p></div><span class="small-tag blue">审核冻结后发布</span></section>
    <div class="site-content-tabs"><button class="site-content-tab ${ui.siteContentTab === "articles" ? "active" : ""}" type="button" data-action="site-content-tab" data-tab="articles">文章列表 <small>${state.articles.length}</small></button><button class="site-content-tab ${ui.siteContentTab === "categories" ? "active" : ""}" type="button" data-action="site-content-tab" data-tab="categories">资讯栏目 <small>${categories.length}</small></button></div>
    ${ui.siteContentTab === "categories" ? `<section class="card table-card"><div class="card-header"><div><h3>客户可配置的资讯栏目</h3><p>最多两级；有文章的栏目不能直接删除，修改 slug 自动生成 301。</p></div><button class="primary-button button-small" type="button" data-action="site-add-category"><span data-icon="plus"></span>新增栏目</button></div><div class="table-scroll"><table class="data-table site-category-table"><thead><tr><th>栏目</th><th>Slug</th><th>文章</th><th>导航</th><th>状态</th><th></th></tr></thead><tbody>${categories.map((category) => `<tr><td class="article-title-cell"><b>${escapeHtml(category.name)}</b><small>${escapeHtml(category.description)}</small></td><td><code>/insights/category/${escapeHtml(category.slug)}/</code></td><td><b>${siteCategoryCount(category)}</b> 篇</td><td><span class="status-badge ${category.navVisible ? "status-approved" : "status-draft"}">${category.navVisible ? "显示" : "隐藏"}</span></td><td><span class="status-badge ${category.status === "active" ? "status-approved" : "status-review"}">${category.status === "active" ? "启用" : "停用"}</span></td><td><button class="link-button" type="button" data-action="site-category-action" data-category-id="${escapeHtml(category.id)}">编辑</button></td></tr>`).join("")}</tbody></table></div><div class="site-category-tip"><span data-icon="info"></span><span>文章只设置一个主栏目，可以设置多个标签；产品/业务线是内部运营维度，不等同于官网栏目。</span></div></section>` : `<section class="card table-card"><div class="card-header"><div><h3>官网文章</h3><p>当前显示已审核内容和已发布内容；发布到官网前需先完成人工审核。</p></div><div class="site-filter-chips">${[["all", "全部"], ...categories.slice(0, 4).map((item) => [item.name, item.name])].map(([value, label]) => `<button class="filter-chip ${ui.siteCategoryFilter === value ? "active" : ""}" type="button" data-action="site-category-filter" data-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join("")}</div></div><div class="table-scroll"><table class="data-table site-article-table"><thead><tr><th>文章</th><th>主栏目</th><th>标签</th><th>版本/作者</th><th>官网状态</th><th>操作</th></tr></thead><tbody>${articles.map((article) => `<tr><td class="article-title-cell"><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(article.siteExcerpt || article.excerpt || "等待官网摘要")}</small></td><td><span class="source-tag">${escapeHtml(article.siteCategory || article.category || "待归类")}</span></td><td><div class="site-tag-list">${(article.keywords || []).slice(0, 2).map((tag) => `<em>${escapeHtml(tag)}</em>`).join("") || '<em>待补充</em>'}</div></td><td>${escapeHtml(article.version || "v1")}<small class="table-subtext">${escapeHtml(article.siteAuthor || article.author || "企业内容团队")}</small></td><td>${siteArticleStatus(article)}</td><td><button class="link-button" type="button" data-action="site-article-preview" data-article-id="${escapeHtml(article.id)}">预览</button>${article.status === "published" || article.siteStatus === "published" ? '<span class="table-action-divider">·</span><button class="link-button" type="button" data-action="site-article-unpublish" data-article-id="' + article.id + '">下线</button>' : article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length ? '<span class="table-action-divider">·</span><button class="link-button" type="button" data-action="site-publish-article" data-article-id="' + article.id + '">发布到官网</button>' : '<span class="table-subtext">回内容生产审核</span>'}</td></tr>`).join("")}</tbody></table></div></section>`}
  `;
}

function renderSiteNavigation() {
  const modules = siteModules("home");
  const navItems = siteNavItems();
  const theme = siteCms().theme;
  return `
    <div class="site-page-toolbar"><div><h2>导航与外观</h2><p>统一维护导航、首页模块、主题和公共组件，不改变文章事实内容。</p></div><button class="primary-button button-small" type="button" data-action="site-nav-save"><span data-icon="check"></span>保存外观设置</button></div>
    <div class="site-navigation-grid"><section class="card"><div class="card-header"><div><h3>主导航</h3><p>顺序、名称、地址与显示状态均可维护。</p></div><button class="secondary-button button-small" type="button" data-action="site-nav-add"><span data-icon="plus"></span>添加导航项</button></div><div class="site-nav-list">${navItems.map((item, index) => `<div class="site-nav-row"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><span class="site-module-grip">⋮⋮</span><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.path)} · ${escapeHtml(item.type)}</small></div><span class="status-badge ${item.visible ? "status-approved" : "status-draft"}">${item.visible ? "显示" : "隐藏"}</span><button class="icon-button" type="button" data-action="site-nav-edit" data-nav-id="${escapeHtml(item.id)}" aria-label="编辑导航"><span data-icon="edit"></span></button></div>`).join("")}</div></section><section class="card"><div class="card-header"><div><h3>首页语义模块</h3><p>每个模块均可关联知识、产品、案例或资讯。</p></div></div><div class="site-nav-list">${modules.slice(0, 5).map((module, index) => `<div class="site-nav-row compact"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(module.title)}</b><small>${escapeHtml(module.description)}</small></div><span>${module.status === "published" ? statusBadge("published") : statusBadge("draft")}</span><button class="link-button" type="button" data-action="site-module-edit" data-page-id="home" data-module-id="${escapeHtml(module.id)}">编辑</button></div>`).join("")}</div></section></div>
    <section class="card site-theme-card"><div class="card-header"><div><h3>主题与公共信息</h3><p>一次设置，自动应用到所有页面。当前主题版本 v${escapeHtml(theme.version || 1)}。</p></div></div><div class="field-row"><div class="field"><label for="site-theme-name">当前主题</label><select class="select" id="site-theme-name"><option ${theme.name === "桐灼企业官网 · 标准版" ? "selected" : ""}>桐灼企业官网 · 标准版</option><option ${theme.name === "企业服务 · 深色版" ? "selected" : ""}>企业服务 · 深色版</option></select></div><div class="field"><label for="site-theme-color">品牌主色</label><div class="color-setting"><i style="background:${escapeHtml(theme.primaryColor)}"></i><input class="input" id="site-theme-color" value="${escapeHtml(theme.primaryColor)}" /></div></div><div class="field"><label for="site-theme-cta">默认 CTA 文案</label><input class="input" id="site-theme-cta" value="${escapeHtml(theme.cta)}" /></div></div></section>
  `;
}

function renderSiteLeads() {
  const leads = siteLeads();
  const pending = leads.filter((lead) => lead.status === "new").length;
  const contacted = leads.filter((lead) => lead.status === "contacted").length;
  const qualified = leads.filter((lead) => lead.status === "qualified").length;
  const leadStatus = { new: ["新线索", "status-review"], contacted: ["已联系", "status-publishing"], qualified: ["有效商机", "status-approved"] };
  return `<section class="card table-card"><div class="card-header"><div><h2>官网咨询线索</h2><p>来自官网表单的咨询，支持来源页面、跟进状态和导出。</p></div><button class="secondary-button button-small" type="button" data-action="export-leads"><span data-icon="download"></span>导出 CSV</button></div><div class="site-lead-summary"><div><b>${pending}</b><span>待跟进</span></div><div><b>${leads.length}</b><span>已收录线索</span></div><div><b>${qualified}</b><span>有效商机</span></div><div><b>${leads.length ? Math.round((qualified / leads.length) * 100) : 0}%</b><span>转化率</span></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>联系人</th><th>企业</th><th>咨询服务</th><th>提交时间</th><th>来源页面</th><th>状态</th><th></th></tr></thead><tbody>${leads.map((lead) => { const meta = leadStatus[lead.status] || leadStatus.new; return `<tr><td><b>${escapeHtml(lead.name)}</b><small class="table-subtext">${escapeHtml(lead.owner || "未分配")}</small></td><td>${escapeHtml(lead.company)}</td><td>${escapeHtml(lead.service)}</td><td>${escapeHtml(lead.createdAt)}</td><td><span class="source-tag">${escapeHtml(lead.sourcePage || "官网")}</span></td><td><span class="status-badge ${meta[1]}">${meta[0]}</span></td><td><button class="link-button" type="button" data-action="site-lead-follow" data-lead-id="${escapeHtml(lead.id)}">${lead.status === "new" ? "跟进" : "查看"}</button></td></tr>`; }).join("")}</tbody></table></div><div class="site-category-tip"><span data-icon="info"></span><span>${contacted} 条线索正在跟进；每次跟进会写入时间、负责人和下一步计划。</span></div></section>`;
}

function renderSiteSettings() {
  const settings = siteCms().settings;
  const deployment = siteCms().deployment;
  const redirects = siteCms().redirects || [];
  const outputs = [["Organization", "企业主体、品牌名和官方域名", "已生成"], ["Article / Breadcrumb", "文章页自动输出结构化数据", "已开启"], ["sitemap / RSS", "发布后自动更新机器入口", "已开启"], ["llms.txt", "公开信源摘要和完整内容索引", "已生成"]];
  return `<div class="site-settings-grid"><section class="card"><div class="card-header"><div><h2>站点与企业主体</h2><p>域名、企业实体和公开描述是全站信源的基础。</p></div><button class="primary-button button-small" type="button" data-action="save-site">保存设置</button></div><div class="card-body"><div class="field-row"><div class="field"><label for="site-setting-name">网站名称</label><input class="input" id="site-setting-name" value="${escapeHtml(settings.siteName)}" /></div><div class="field"><label for="site-setting-domain">主域名</label><input class="input" id="site-setting-domain" value="${escapeHtml(state.site.domain)}" /></div></div><div class="field"><label for="site-setting-company">企业主体</label><input class="input" id="site-setting-company" value="${escapeHtml(settings.companyName)}" /></div><div class="field"><label for="site-setting-description">网站描述</label><textarea class="textarea" id="site-setting-description" rows="3">${escapeHtml(settings.description)}</textarea></div><div class="setting-row"><div><b>允许 AI 抓取已发布内容</b><small>仅公开已审核、已发布的官网页面</small></div><label class="toggle ${settings.allowAiCrawl !== false ? "on" : ""}"><input type="checkbox" id="site-setting-ai-crawl" ${settings.allowAiCrawl !== false ? "checked" : ""} /><span></span></label></div></div></section><section class="card"><div class="card-header"><div><h2>AI 信源输出</h2><p>系统自动生成，不需要每篇文章手动配置。</p></div><span class="small-tag blue">信源完整度 92%</span></div><div class="site-output-list">${outputs.map((item) => `<div class="site-output-row"><span class="check-dot ok">✓</span><div><b>${item[0]}</b><small>${item[1]}</small></div><span class="status-badge status-approved">${item[2]}</span></div>`).join("")}</div><div class="site-settings-footnote"><span data-icon="info"></span><span>页面发布时自动检查标题、摘要、作者、发布日期、canonical、内部链接和栏目主题一致性。</span></div></section><section class="card site-advanced-card"><div class="card-header"><div><h2>高级设置</h2><p>低频维护入口：部署、重定向和网站诊断。</p></div></div><div class="advanced-setting-row"><div><b>服务器发布</b><small>${escapeHtml(deployment.mode)} · ${escapeHtml(deployment.environment)} · 最近发布 ${escapeHtml(deployment.lastDeployAt || "—")}</small></div><span class="status-badge ${deployment.status === "online" ? "status-online" : "status-review"}">${deployment.status === "online" ? "在线" : "待检查"}</span><button class="link-button" type="button" data-action="site-deployment">查看</button></div><div class="advanced-setting-row"><div><b>URL 重定向</b><small>栏目或页面 slug 修改时自动生成 301</small></div><span class="small-tag">${redirects.filter((item) => item.status === "active").length} 条生效</span><button class="link-button" type="button" data-action="site-redirects">管理</button></div><div class="site-health site-health-quiet"><div class="site-health-head"><h4>网站诊断：${escapeHtml(state.site.diagnosticStatus || "正常")}</h4>${statusBadge("healthy")}</div><p>首次上线或配置变更后复查即可，不作为日常运营工具。</p><button class="secondary-button button-small" type="button" data-action="run-diagnostic"><span data-icon="refresh"></span>重新检测</button></div></section></div>`;
}

function renderSitePanel() {
  if (ui.siteTab === "pages") return renderSitePages();
  if (ui.siteTab === "insights") return renderSiteInsights();
  if (ui.siteTab === "navigation") return renderSiteNavigation();
  if (ui.siteTab === "leads") return renderSiteLeads();
  if (ui.siteTab === "settings") return renderSiteSettings();
  return renderSiteOverview();
}

function renderSite() {
  return `<div class="page-container">${pageHead("官网运营", "管理企业官网页面、行业资讯、公开信源与咨询线索。文章正文在内容生产中心完成，审核后由官网 CMS 发布。", '<button class="secondary-button" type="button" data-action="preview-site"><span data-icon="external"></span>预览官网</button>')}<div class="tabs-row">${siteTabs()}<span class="health"><i></i>网站运行正常</span></div>${renderSitePanel()}</div>`;
}

function renderSitePublishModal() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return "";
  const eligible = article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length;
  if (!eligible) return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">暂不能发布到官网</h2><p>文章必须完成人工审核、风险检查和知识证据冻结。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="site-source-note"><span class="site-source-note-icon" data-icon="alert"></span><div><b>${escapeHtml(article.title)}</b><p>当前状态：${article.reviewStatus === "approved" ? "已审核" : "待审核"} · ${article.riskStatus === "clean" ? "风险通过" : "需要处理风险"} · ${articleCitations(article).length ? "证据已关联" : "尚未关联证据"}</p></div></div></div><div class="modal-foot"><div></div><button class="secondary-button" type="button" data-action="close-modal">返回文章任务</button></div>`);
  const categories = siteCategories();
  const selectedCategory = article.siteCategory || article.category || categories[0]?.name || "GEO优化";
  const slug = article.siteSlug || String(article.title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || article.id.toLowerCase();
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">发布到企业官网</h2><p>${escapeHtml(article.id)} · 冻结版本 ${escapeHtml(article.version || "v1")} · 官网发布信息</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body site-publish-modal-body"><div class="publish-article"><b>${escapeHtml(article.title)}</b><span>正文来自内容生产中心；本窗口只补充官网展示字段。</span></div><div class="field-row"><div class="field"><label for="site-publish-category">主栏目 *</label><select class="select" id="site-publish-category">${categories.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === selectedCategory ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label for="site-publish-author">作者</label><input class="input" id="site-publish-author" value="${escapeHtml(article.author || "桐灼研究")}" /></div></div><div class="field"><label for="site-publish-slug">文章地址 slug *</label><div class="site-slug-input"><span>/insights/</span><input class="input" id="site-publish-slug" value="${escapeHtml(slug)}" /></div><small class="field-help">修改已发布文章的 slug 时，系统自动生成 301 重定向。</small></div><div class="field"><label for="site-publish-excerpt">官网摘要</label><textarea class="textarea" id="site-publish-excerpt" rows="4">${escapeHtml(article.excerpt || "")}</textarea></div><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>Article / Breadcrumb</b><small>发布时自动生成结构化数据</small></span></div><div><span class="check-dot ok">✓</span><span><b>栏目页、首页、sitemap</b><small>发布后自动更新相关入口</small></span></div><div><span class="check-dot ok">✓</span><span><b>知识证据冻结</b><small>${articleCitations(article).length} 条引用证据随版本保存</small></span></div></div></div><div class="modal-foot"><span>发布后可在行业资讯中下线或回滚</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-confirm-publish"><span data-icon="send"></span>确认发布</button></div></div>`, { wide: true });
}

function submitSitePublish() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return closeModal();
  const category = document.getElementById("site-publish-category")?.value || article.category || "GEO优化";
  const slug = document.getElementById("site-publish-slug")?.value.trim() || article.id.toLowerCase();
  const author = document.getElementById("site-publish-author")?.value.trim() || article.author || "桐灼研究";
  const excerpt = document.getElementById("site-publish-excerpt")?.value.trim() || article.excerpt || "";
  const oldSlug = article.siteSlug;
  article.siteStatus = "published";
  article.siteCategory = category;
  article.siteSlug = slug;
  article.siteAuthor = author;
  article.siteExcerpt = excerpt;
  article.siteUrl = "/insights/" + slug + "/";
  article.sitePublishedAt = new Date().toISOString();
  if (oldSlug && oldSlug !== slug) siteAddRedirect(`/insights/${oldSlug}/`, `/insights/${slug}/`, `文章“${article.title}”地址调整`);
  saveState();
  closeModal();
  ui.siteTab = "insights";
  ui.siteContentTab = "articles";
  showToast("官网文章已发布", `${category} 栏目已更新，页面地址为 ${article.siteUrl}`);
  return render();
}

function siteValue(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

function siteChecked(id) {
  return Boolean(document.getElementById(id)?.checked);
}

function sitePageSnapshot(page) {
  return {
    version: Number(page.version) || 1,
    title: page.title,
    path: page.path,
    description: page.description,
    seoDescription: page.seoDescription,
    schemaEnabled: page.schemaEnabled !== false,
    sitemapEnabled: page.sitemapEnabled !== false,
    status: page.status,
    savedAt: page.savedAt,
    modules: cloneData(siteModules(page.id))
  };
}

function siteArchivePageVersion(page, note = "页面更新") {
  page.versions = Array.isArray(page.versions) ? page.versions : [];
  page.versions.unshift({ ...sitePageSnapshot(page), note });
}

function saveSitePage() {
  const page = sitePageDefinition();
  if (!page) return;
  const title = siteValue("site-page-title");
  const path = sitePath(siteValue("site-page-path"));
  const seoDescription = siteValue("site-page-seo");
  if (!title) return showToast("请填写页面标题", "页面标题不能为空。", "error");
  if (!path || path.includes(" ")) return showToast("页面路径不正确", "请使用以 / 开头的站内路径，且不要包含空格。", "error");
  const conflict = sitePages().find((item) => item.id !== page.id && item.path === path);
  if (conflict) return showToast("页面路径已存在", `“${conflict.title}”正在使用 ${path}。`, "error");
  const changed = title !== page.title || path !== page.path || seoDescription !== (page.seoDescription || "") || siteChecked("site-page-schema") !== (page.schemaEnabled !== false) || siteChecked("site-page-sitemap") !== (page.sitemapEnabled !== false);
  if (!changed) return showToast("页面没有新的修改", "当前设置已经是已保存状态。", "info");
  const oldPath = page.path;
  siteArchivePageVersion(page, "保存前版本");
  page.title = title;
  page.path = path;
  page.description = seoDescription || page.description;
  page.seoDescription = seoDescription;
  page.schemaEnabled = siteChecked("site-page-schema");
  page.sitemapEnabled = siteChecked("site-page-sitemap");
  page.version = (Number(page.version) || 1) + 1;
  page.savedAt = siteNow();
  if (oldPath !== path) siteAddRedirect(oldPath, path, `页面“${title}”路径调整`);
  saveState();
  render();
  showToast("页面已保存", `已生成 v${page.version}，页面设置和模块可继续预览或回滚。`, "success");
}

function renderSitePreviewModal() {
  const page = sitePageDefinition(ui.modal?.pageId);
  if (!page) return "";
  const modules = siteModules(page.id);
  const domain = state.site.domain;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网预览 · ${escapeHtml(page.title)}</h2><p>预览地址：${escapeHtml(`https://${domain}${page.path}`)} · 不会写入线上站点</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><section class="site-preview"><div style="padding:24px 28px;border-bottom:1px solid #e7ebf2;display:flex;justify-content:space-between;gap:18px"><div><small style="color:#627187">${escapeHtml(siteCms().settings.siteName)} · ${escapeHtml(page.type)}</small><h1 style="margin:8px 0 0;font-size:26px;color:#172033">${escapeHtml(page.title)}</h1><p style="margin:8px 0 0;color:#65728a;line-height:1.7">${escapeHtml(page.seoDescription || page.description)}</p></div><span class="status-badge ${page.status === "published" ? "status-approved" : "status-draft"}">${page.status === "published" ? "线上版本" : "草稿预览"}</span></div><div style="padding:20px 28px;display:grid;gap:12px">${modules.filter((module) => module.status !== "hidden").map((module) => `<article style="padding:16px;border:1px solid #e7ebf2;border-radius:10px;background:#fff"><small style="color:#3a73d9">${escapeHtml(module.source)}</small><h2 style="margin:5px 0 6px;font-size:17px;color:#172033">${escapeHtml(module.title)}</h2><p style="margin:0;color:#65728a;line-height:1.7">${escapeHtml(module.content || module.description)}</p></article>`).join("") || '<div class="empty-state compact"><div><h3>尚未配置页面模块</h3><p>先添加至少一个语义模块。</p></div></div>'}</div></section><div class="site-publish-checks"><div><span class="check-dot ${page.schemaEnabled !== false ? "ok" : "warn"}">${page.schemaEnabled !== false ? "✓" : "!"}</span><span><b>结构化数据</b><small>${page.schemaEnabled !== false ? "将输出对应的 Schema" : "本版本未输出 Schema"}</small></span></div><div><span class="check-dot ${page.sitemapEnabled !== false ? "ok" : "warn"}">${page.sitemapEnabled !== false ? "✓" : "!"}</span><span><b>机器入口</b><small>${page.sitemapEnabled !== false ? "已加入 sitemap 与 llms 索引" : "未加入 sitemap"}</small></span></div></div></div><div class="modal-foot"><span>当前版本 v${escapeHtml(page.version || 1)} · 最近保存 ${escapeHtml(siteDisplayTime(page.savedAt))}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭预览</button><button class="primary-button" type="button" data-action="site-page-version" data-page-id="${escapeHtml(page.id)}"><span data-icon="history"></span>查看版本</button></div></div>`, { wide: true });
}

function renderSitePageVersionModal() {
  const page = sitePageDefinition(ui.modal?.pageId);
  if (!page) return "";
  const rows = [{ ...sitePageSnapshot(page), current: true }, ...(page.versions || [])].map((version) => `<div class="article-version-row ${version.current ? "current" : ""}"><span><b>v${escapeHtml(version.version)} · ${version.current ? "当前版本" : escapeHtml(version.note || "历史版本")}</b><small>${escapeHtml(version.title)} · ${escapeHtml(version.path)} · ${escapeHtml(siteDisplayTime(version.savedAt))}</small></span>${version.current ? '<em>当前</em>' : `<button class="secondary-button button-small" type="button" data-action="site-page-restore-version" data-page-id="${escapeHtml(page.id)}" data-version="${escapeHtml(version.version)}">回滚到此版</button>`}</div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">页面版本记录</h2><p>${escapeHtml(page.title)} · 回滚会新建一个版本，不会删除已有历史。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="article-version-list">${rows}</div></div><div class="modal-foot"><span>已保存 ${page.versions?.length || 0} 个历史版本</span><button class="primary-button" type="button" data-action="close-modal">完成</button></div>`, { wide: true });
}

function restoreSitePageVersion(pageId, versionNumber) {
  const page = sitePages().find((item) => item.id === pageId);
  const revision = page?.versions?.find((item) => Number(item.version) === Number(versionNumber));
  if (!page || !revision) return showToast("找不到页面版本", "请关闭窗口后重新打开版本记录。", "error");
  siteArchivePageVersion(page, "回滚前版本");
  const nextVersion = (Number(page.version) || 1) + 1;
  ["title", "path", "description", "seoDescription", "schemaEnabled", "sitemapEnabled", "status"].forEach((key) => { if (key in revision) page[key] = revision[key]; });
  if (Array.isArray(revision.modules)) siteCms().modules[page.id] = cloneData(revision.modules);
  page.version = nextVersion;
  page.savedAt = siteNow();
  saveState();
  closeModal();
  render();
  showToast("已回滚页面版本", `已基于 v${versionNumber} 创建新的 v${nextVersion}。`, "success");
}

function renderSitePageEditorModal() {
  const page = ui.modal?.pageId ? sitePageDefinition(ui.modal.pageId) : null;
  const isNew = !page;
  const sourceOptions = sitePages().filter((item) => item.id !== page?.id).map((item) => `<option value="${escapeHtml(item.id)}">复制 ${escapeHtml(item.title)} 的模块</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新建专题页" : "编辑页面"}</h2><p>专题页会先保存为草稿；页面正文仍由模块和关联知识决定。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-new-page-title">页面标题 *</label><input class="input" id="site-new-page-title" value="${escapeHtml(page?.title || "")}" placeholder="例如：制造业 AI 搜索优化" /></div><div class="field"><label for="site-new-page-type">页面类型</label><select class="select" id="site-new-page-type"><option ${page?.type === "专题页" ? "selected" : ""}>专题页</option><option ${page?.type === "服务页" ? "selected" : ""}>服务页</option><option ${page?.type === "落地页" ? "selected" : ""}>落地页</option><option ${page?.type === "FAQ 页" ? "selected" : ""}>FAQ 页</option></select></div></div><div class="field"><label for="site-new-page-path">页面路径 *</label><input class="input" id="site-new-page-path" value="${escapeHtml(page?.path || "/topics/")}" placeholder="/topics/manufacturing-geo/" /><small class="field-help">路径唯一；修改已有页面路径时会自动增加 301 重定向。</small></div><div class="field"><label for="site-new-page-description">页面说明 / SEO 描述</label><textarea class="textarea" id="site-new-page-description" rows="4">${escapeHtml(page?.seoDescription || page?.description || "")}</textarea></div>${isNew ? `<div class="field"><label for="site-new-page-template">初始模块</label><select class="select" id="site-new-page-template"><option value="blank">空白页面（后续自行添加模块）</option>${sourceOptions}</select></div>` : ""}</div><div class="modal-foot"><span>${isNew ? "创建后可继续添加语义模块" : "保存会创建新页面版本"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-submit-page" data-page-id="${escapeHtml(page?.id || "")}"><span data-icon="check"></span>${isNew ? "创建页面" : "保存页面"}</button></div></div>`, { wide: true });
}

function submitSitePage(pageId) {
  const title = siteValue("site-new-page-title");
  const path = sitePath(siteValue("site-new-page-path"));
  const description = siteValue("site-new-page-description");
  const type = siteValue("site-new-page-type") || "专题页";
  if (!title || !path) return showToast("请填写页面标题和路径", "页面标题和路径是必填项。", "error");
  const page = pageId ? sitePages().find((item) => item.id === pageId) : null;
  const conflict = sitePages().find((item) => item.id !== pageId && item.path === path);
  if (conflict) return showToast("页面路径已存在", `“${conflict.title}”正在使用 ${path}。`, "error");
  if (page) {
    const oldPath = page.path;
    siteArchivePageVersion(page, "编辑前版本");
    Object.assign(page, { title, path, type, description: description || page.description, seoDescription: description || page.seoDescription, version: (Number(page.version) || 1) + 1, savedAt: siteNow() });
    if (oldPath !== path) siteAddRedirect(oldPath, path, `页面“${title}”路径调整`);
    ui.sitePageId = page.id;
  } else {
    const id = uid("PAGE").toLowerCase();
    const template = siteValue("site-new-page-template");
    const newPage = { id, type, title, path, status: "draft", description: description || `${title} 页面说明`, seoDescription: description || `${title} 页面说明`, schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: siteNow(), publishedAt: null, versions: [] };
    sitePages().push(newPage);
    siteCms().modules[id] = template && template !== "blank" ? cloneData(siteModules(template)).map((module, index) => ({ ...module, id: `${id}-module-${index + 1}` })) : [];
    ui.sitePageId = id;
  }
  saveState();
  closeModal();
  ui.siteTab = "pages";
  render();
  showToast(page ? "页面已更新" : "专题页已创建", `${title} 已保存为草稿，可以继续配置模块和预览。`, "success");
}

function renderSiteModuleModal() {
  const pageId = ui.modal?.pageId || ui.sitePageId;
  const modules = siteModules(pageId);
  const module = ui.modal?.moduleId ? modules.find((item) => item.id === ui.modal.moduleId) : null;
  const isNew = !module;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加语义模块" : "编辑语义模块"}</h2><p>模块展示的是可解释的页面语义；正文可以引用企业知识、案例、栏目或公共组件。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-module-title">模块名称 *</label><input class="input" id="site-module-title" value="${escapeHtml(module?.title || "")}" placeholder="例如：客户常见问题" /></div><div class="field"><label for="site-module-status">展示状态</label><select class="select" id="site-module-status"><option value="published" ${module?.status === "published" ? "selected" : ""}>已发布</option><option value="draft" ${!module || module?.status === "draft" ? "selected" : ""}>草稿</option><option value="hidden" ${module?.status === "hidden" ? "selected" : ""}>隐藏</option></select></div></div><div class="field"><label for="site-module-source">内容来源</label><input class="input" id="site-module-source" value="${escapeHtml(module?.source || "页面内容")}" placeholder="例如：企业知识库 / 已审核案例库" /></div><div class="field"><label for="site-module-description">模块说明</label><textarea class="textarea" id="site-module-description" rows="3">${escapeHtml(module?.description || "")}</textarea></div><div class="field"><label for="site-module-content">预览文案</label><textarea class="textarea" id="site-module-content" rows="5">${escapeHtml(module?.content || "")}</textarea></div></div><div class="modal-foot"><span>${isNew ? "添加后会出现在当前页面末尾" : "模块变更会随页面版本一起保存"}</span><div class="modal-foot-right">${!isNew && modules.length > 1 ? `<button class="danger-button" type="button" data-action="site-delete-module" data-page-id="${escapeHtml(pageId)}" data-module-id="${escapeHtml(module.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-module" data-page-id="${escapeHtml(pageId)}" data-module-id="${escapeHtml(module?.id || "")}"><span data-icon="check"></span>保存模块</button></div></div>`, { wide: true });
}

function saveSiteModule(pageId, moduleId) {
  const title = siteValue("site-module-title");
  if (!title) return showToast("请填写模块名称", "模块名称不能为空。", "error");
  const modules = siteCms().modules[pageId] || (siteCms().modules[pageId] = []);
  const page = sitePages().find((item) => item.id === pageId);
  if (page) siteArchivePageVersion(page, "模块更新前版本");
  const existing = modules.find((item) => item.id === moduleId);
  const values = { title, source: siteValue("site-module-source") || "页面内容", description: siteValue("site-module-description"), content: siteValue("site-module-content"), status: siteValue("site-module-status") || "draft" };
  if (existing) Object.assign(existing, values);
  else modules.push({ id: uid("MODULE"), ...values });
  if (page) { page.savedAt = siteNow(); page.version = (Number(page.version) || 1) + 1; }
  saveState();
  closeModal();
  render();
  showToast(existing ? "模块已更新" : "模块已添加", "页面模块已保存，可在预览中查看。", "success");
}

function deleteSiteModule(pageId, moduleId) {
  const modules = siteCms().modules[pageId] || [];
  if (modules.length <= 1) return showToast("至少保留一个模块", "页面至少需要保留一个内容模块。", "error");
  const page = sitePages().find((item) => item.id === pageId);
  if (page) siteArchivePageVersion(page, "删除模块前版本");
  siteCms().modules[pageId] = modules.filter((item) => item.id !== moduleId);
  if (page) { page.savedAt = siteNow(); page.version = (Number(page.version) || 1) + 1; }
  saveState();
  closeModal();
  render();
  showToast("模块已删除", "页面其余模块和历史页面版本不受影响。", "success");
}

function renderSiteCategoryManagerModal() {
  const rows = siteCategories(true).map((category) => `<div class="site-nav-row"><div><b>${escapeHtml(category.name)}</b><small>/insights/category/${escapeHtml(category.slug)}/ · ${siteCategoryCount(category)} 篇文章</small></div><span class="status-badge ${category.status === "active" ? "status-approved" : "status-draft"}">${category.status === "active" ? "启用" : "已归档"}</span><button class="secondary-button button-small" type="button" data-action="site-edit-category" data-category-id="${escapeHtml(category.id)}">编辑</button></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">资讯栏目管理</h2><p>栏目可改名、停用或归档；修改 slug 会自动创建 301 重定向。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="site-nav-list">${rows}</div></div><div class="modal-foot"><span>${siteCategories().length} 个启用栏目 · ${siteCategories(true).filter((item) => item.status === "archived").length} 个归档栏目</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">完成</button><button class="primary-button" type="button" data-action="site-add-category"><span data-icon="plus"></span>新增栏目</button></div></div>`, { wide: true });
}

function renderSiteCategoryModal() {
  const category = ui.modal?.categoryId ? siteCategories(true).find((item) => item.id === ui.modal.categoryId) : null;
  const isNew = !category;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新增资讯栏目" : "编辑资讯栏目"}</h2><p>官网栏目可由每个客户独立配置，不等同于内部产品或业务线。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-category-name">栏目名称 *</label><input class="input" id="site-category-name" value="${escapeHtml(category?.name || "")}" /></div><div class="field"><label for="site-category-slug">栏目 slug *</label><input class="input" id="site-category-slug" value="${escapeHtml(category?.slug || "")}" placeholder="industry-news" /></div></div><div class="field"><label for="site-category-description">栏目说明</label><textarea class="textarea" id="site-category-description" rows="3">${escapeHtml(category?.description || "")}</textarea></div><div class="field"><label for="site-category-seo">SEO / AI 摘要</label><textarea class="textarea" id="site-category-seo" rows="3">${escapeHtml(category?.seoDescription || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-category-status">栏目状态</label><select class="select" id="site-category-status"><option value="active" ${category?.status !== "archived" ? "selected" : ""}>启用</option><option value="archived" ${category?.status === "archived" ? "selected" : ""}>归档</option></select></div><label class="field"><span>导航显示</span><span style="display:flex;align-items:center;gap:8px;padding-top:8px"><input type="checkbox" id="site-category-nav" ${category?.navVisible !== false ? "checked" : ""} /> 显示在资讯导航中</span></label></div>${category && siteCategoryCount(category) ? `<div class="archive-impact-note"><span data-icon="info"></span><span>该栏目已有 ${siteCategoryCount(category)} 篇文章，不能永久删除；可以停用或归档，文章仍保留历史归属。</span></div>` : ""}</div><div class="modal-foot"><span>${isNew ? "新栏目创建后立即可在文章发布时选择" : "变更会同步栏目页和导航"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-category" data-category-id="${escapeHtml(category?.id || "")}"><span data-icon="check"></span>保存栏目</button></div></div>`, { wide: true });
}

function saveSiteCategory(categoryId) {
  const name = siteValue("site-category-name");
  const slug = siteSlug(siteValue("site-category-slug"), siteSlug(name, "category"));
  if (!name) return showToast("请填写栏目名称", "栏目名称不能为空。", "error");
  const conflict = siteCategories(true).find((item) => item.id !== categoryId && (item.name === name || item.slug === slug));
  if (conflict) return showToast("栏目名称或 slug 已存在", `请与“${conflict.name}”使用不同的名称和地址。`, "error");
  const categories = siteCms().categories;
  const category = categories.find((item) => item.id === categoryId);
  const values = { name, slug, description: siteValue("site-category-description"), seoDescription: siteValue("site-category-seo"), status: siteValue("site-category-status") || "active", navVisible: siteChecked("site-category-nav"), updatedAt: siteNow() };
  if (category) {
    const oldName = category.name;
    const oldSlug = category.slug;
    Object.assign(category, values);
    state.articles.forEach((article) => {
      if (article.siteCategory === oldName) article.siteCategory = name;
      else if (article.category === oldName) article.siteCategory = name;
    });
    if (oldSlug !== slug) siteAddRedirect(`/insights/category/${oldSlug}/`, `/insights/category/${slug}/`, `栏目“${name}”slug 调整`);
  } else {
    categories.push({ id: uid("CATEGORY"), level: 1, count: 0, createdAt: siteNow(), ...values });
  }
  saveState();
  closeModal();
  ui.siteTab = "insights";
  ui.siteContentTab = "categories";
  render();
  showToast(category ? "栏目已更新" : "栏目已创建", `“${name}”已保存，文章发布时可以选择该栏目。`, "success");
}

function renderSiteArticlePreviewModal() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return "";
  const category = article.siteCategory || article.category || "待归类";
  const slug = article.siteSlug || article.id.toLowerCase();
  const body = sanitizeStudioHtml(article.content || `<p>${escapeHtml(article.excerpt || "尚无正文预览")}</p>`);
  const citations = articleCitations(article);
  const schemaPreview = { "@context": "https://schema.org", "@type": "Article", headline: article.title, author: article.siteAuthor || article.author || "企业内容团队", articleSection: category, url: `https://${state.site.domain}/insights/${slug}/` };
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网文章预览</h2><p>${escapeHtml(article.id)} · ${escapeHtml(article.version || "v1")} · ${escapeHtml(category)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><article class="site-preview" style="padding:28px"><span class="small-tag blue">${escapeHtml(category)}</span><h1 style="margin:12px 0 8px;color:#172033;font-size:26px">${escapeHtml(article.title)}</h1><p style="color:#68758a">${escapeHtml(article.siteExcerpt || article.excerpt || "")}</p><div style="display:flex;gap:12px;color:#7b8798;font-size:11px;margin:12px 0 20px"><span>${escapeHtml(article.siteAuthor || article.author || "企业内容团队")}</span><span>·</span><span>${escapeHtml(article.sitePublishedAt ? siteDisplayTime(article.sitePublishedAt) : "预览未发布")}</span></div><div class="article-content read-only">${body}</div></article><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>知识证据</b><small>${citations.length} 条引用随当前版本冻结</small></span></div><div><span class="check-dot ok">✓</span><span><b>Article Schema</b><small>${escapeHtml(JSON.stringify(schemaPreview))}</small></span></div></div></div><div class="modal-foot"><span>预览地址 /insights/${escapeHtml(slug)}/</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button>${article.siteStatus === "published" ? "" : article.reviewStatus === "approved" && article.riskStatus === "clean" && citations.length ? `<button class="primary-button" type="button" data-action="site-publish-article" data-article-id="${escapeHtml(article.id)}"><span data-icon="send"></span>发布到官网</button>` : ""}</div></div>`, { wide: true });
}

function renderSiteNavModal() {
  const navItem = ui.modal?.navId ? siteNavItems().find((item) => item.id === ui.modal.navId) : null;
  const isNew = !navItem;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加导航项" : "编辑导航项"}</h2><p>导航可以指向固定页面、资讯栏目或自定义站内地址。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-nav-label">导航名称 *</label><input class="input" id="site-nav-label" value="${escapeHtml(navItem?.label || "")}" /></div><div class="field"><label for="site-nav-type">链接类型</label><select class="select" id="site-nav-type"><option ${navItem?.type === "固定页面" ? "selected" : ""}>固定页面</option><option ${navItem?.type === "资讯列表" ? "selected" : ""}>资讯列表</option><option ${navItem?.type === "资讯栏目" ? "selected" : ""}>资讯栏目</option><option ${navItem?.type === "自定义链接" ? "selected" : ""}>自定义链接</option></select></div></div><div class="field"><label for="site-nav-path">站内地址 *</label><input class="input" id="site-nav-path" value="${escapeHtml(navItem?.path || "/")}" /></div><label class="field"><span>显示状态</span><span style="display:flex;align-items:center;gap:8px;padding-top:8px"><input type="checkbox" id="site-nav-visible" ${navItem?.visible !== false ? "checked" : ""} /> 在主导航显示</span></label></div><div class="modal-foot"><span>导航顺序按列表保存，新增项会排在末尾</span><div class="modal-foot-right">${!isNew ? `<button class="danger-button" type="button" data-action="site-delete-nav" data-nav-id="${escapeHtml(navItem.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-nav" data-nav-id="${escapeHtml(navItem?.id || "")}"><span data-icon="check"></span>保存导航</button></div></div>`, { wide: true });
}

function saveSiteNav(navId) {
  const label = siteValue("site-nav-label");
  const path = sitePath(siteValue("site-nav-path"));
  if (!label || !path) return showToast("请填写导航名称和地址", "导航名称和站内地址不能为空。", "error");
  const navItems = siteCms().navItems;
  const item = navItems.find((entry) => entry.id === navId);
  const values = { label, path, type: siteValue("site-nav-type") || "自定义链接", visible: siteChecked("site-nav-visible"), updatedAt: siteNow() };
  if (item) Object.assign(item, values);
  else navItems.push({ id: uid("NAV"), ...values });
  saveState();
  closeModal();
  render();
  showToast(item ? "导航项已更新" : "导航项已添加", "保存外观设置后将形成新的主题版本。", "success");
}

function deleteSiteNav(navId) {
  siteCms().navItems = siteCms().navItems.filter((item) => item.id !== navId);
  saveState();
  closeModal();
  render();
  showToast("导航项已删除", "对应页面和内容不会被删除。", "success");
}

function saveSiteAppearance() {
  const theme = siteCms().theme;
  const color = siteValue("site-theme-color");
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return showToast("品牌主色格式不正确", "请输入类似 #1D5CFF 的 6 位十六进制颜色。", "error");
  theme.name = siteValue("site-theme-name") || theme.name;
  theme.primaryColor = color || theme.primaryColor;
  theme.cta = siteValue("site-theme-cta") || theme.cta;
  theme.version = (Number(theme.version) || 1) + 1;
  theme.updatedAt = siteNow();
  state.site.theme = theme.name;
  saveState();
  render();
  showToast("导航与外观已保存", `已创建主题版本 v${theme.version}，所有页面将使用新的公共样式。`, "success");
}

function renderSiteLeadFollowModal() {
  const lead = siteLeads().find((item) => item.id === ui.modal?.leadId);
  if (!lead) return "";
  const history = (lead.history || []).map((item) => `<div class="article-version-row"><span><b>${escapeHtml(item.note)}</b><small>${escapeHtml(item.owner || lead.owner || "未分配")} · ${escapeHtml(item.at || "")}</small></span><em>${item.status === "qualified" ? "有效商机" : item.status === "contacted" ? "已联系" : "新线索"}</em></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">线索跟进 · ${escapeHtml(lead.name)}</h2><p>${escapeHtml(lead.company)} · ${escapeHtml(lead.service)} · 来源 ${escapeHtml(lead.sourcePage || "官网")}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-lead-status">线索状态</label><select class="select" id="site-lead-status"><option value="new" ${lead.status === "new" ? "selected" : ""}>新线索</option><option value="contacted" ${lead.status === "contacted" ? "selected" : ""}>已联系</option><option value="qualified" ${lead.status === "qualified" ? "selected" : ""}>有效商机</option></select></div><div class="field"><label for="site-lead-owner">负责人</label><input class="input" id="site-lead-owner" value="${escapeHtml(lead.owner || "")}" /></div></div><div class="field"><label for="site-lead-next">下次跟进时间</label><input class="input" id="site-lead-next" value="${escapeHtml(lead.nextFollowAt || "")}" placeholder="例如：2026-07-28 10:00" /></div><div class="field"><label for="site-lead-note">本次跟进记录 *</label><textarea class="textarea" id="site-lead-note" rows="4" placeholder="记录沟通结果、客户需求和下一步安排">${escapeHtml(lead.notes || "")}</textarea></div>${history ? `<div class="field"><label>历史跟进记录</label><div class="article-version-list">${history}</div></div>` : '<div class="archive-impact-note"><span data-icon="info"></span><span>这是首次跟进，保存后会建立第一条沟通记录。</span></div>'}</div><div class="modal-foot"><span>线索编号 ${escapeHtml(lead.id)} · 提交于 ${escapeHtml(lead.createdAt)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-lead" data-lead-id="${escapeHtml(lead.id)}"><span data-icon="check"></span>保存跟进</button></div></div>`, { wide: true });
}

function saveSiteLead(leadId) {
  const lead = siteLeads().find((item) => item.id === leadId);
  if (!lead) return showToast("线索不存在", "请刷新页面后重试。", "error");
  const note = siteValue("site-lead-note");
  if (!note) return showToast("请填写跟进记录", "至少记录本次沟通结果或下一步安排。", "error");
  const status = siteValue("site-lead-status") || lead.status;
  const owner = siteValue("site-lead-owner") || "未分配";
  lead.history = Array.isArray(lead.history) ? lead.history : [];
  lead.history.unshift({ id: uid("FOLLOW"), at: new Date().toLocaleString("zh-CN", { hour12: false }), note, status, owner });
  lead.status = status;
  lead.owner = owner;
  lead.nextFollowAt = siteValue("site-lead-next");
  lead.notes = note;
  lead.updatedAt = siteNow();
  state.site.leads = siteLeads().filter((item) => item.status === "new").length;
  saveState();
  closeModal();
  render();
  showToast("跟进记录已保存", `“${lead.name}”已更新为${status === "qualified" ? "有效商机" : status === "contacted" ? "已联系" : "新线索"}。`, "success");
}

function renderSiteDeploymentModal() {
  const deployment = siteCms().deployment;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网服务器发布</h2><p>官网由客户服务器直接发布，不经过本地媒体发布助手。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="manual-review-complete"><span data-icon="server"></span><div><b>${deployment.status === "online" ? "服务器连接正常" : "服务器连接待检查"}</b><p>最近检测：${escapeHtml(deployment.lastTestAt || "尚未检测")} · 最近部署：${escapeHtml(deployment.lastDeployAt || "尚未部署")}</p></div></div><div class="field-row"><div class="field"><label for="site-deploy-mode">部署方式</label><select class="select" id="site-deploy-mode"><option ${deployment.mode === "独立服务器" ? "selected" : ""}>独立服务器</option><option ${deployment.mode === "容器部署" ? "selected" : ""}>容器部署</option><option ${deployment.mode === "静态站点" ? "selected" : ""}>静态站点</option></select></div><div class="field"><label for="site-deploy-env">发布环境</label><select class="select" id="site-deploy-env"><option value="production" ${deployment.environment === "production" ? "selected" : ""}>production</option><option value="staging" ${deployment.environment === "staging" ? "selected" : ""}>staging</option></select></div></div><div class="field"><label for="site-deploy-root">站点目录</label><input class="input" id="site-deploy-root" value="${escapeHtml(deployment.rootPath || "")}" placeholder="/var/www/company-site" /></div><div class="field"><label for="site-deploy-branch">发布分支 / 版本通道</label><input class="input" id="site-deploy-branch" value="${escapeHtml(deployment.branch || "main")}" /></div><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>发布权限</b><small>只允许当前客户空间发布到自己的官网目录</small></span></div><div><span class="check-dot ok">✓</span><span><b>发布前检查</b><small>自动检查页面、结构化数据、sitemap 与重定向</small></span></div></div></div><div class="modal-foot"><span>连接检测只更新状态，不会触发正式部署</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="site-test-deployment"><span data-icon="refresh"></span>检测连接</button><button class="primary-button" type="button" data-action="site-save-deployment"><span data-icon="check"></span>保存部署设置</button></div></div>`, { wide: true });
}

function saveSiteDeployment() {
  const rootPath = siteValue("site-deploy-root");
  if (!rootPath) return showToast("请填写站点目录", "服务器发布需要明确的客户站点目录。", "error");
  Object.assign(siteCms().deployment, { mode: siteValue("site-deploy-mode") || "独立服务器", environment: siteValue("site-deploy-env") || "production", rootPath, branch: siteValue("site-deploy-branch") || "main", updatedAt: siteNow() });
  saveState();
  closeModal();
  render();
  showToast("部署设置已保存", "新的设置将在下一次官网发布时使用。", "success");
}

function testSiteDeployment() {
  const deployment = siteCms().deployment;
  deployment.mode = siteValue("site-deploy-mode") || deployment.mode;
  deployment.environment = siteValue("site-deploy-env") || deployment.environment;
  deployment.rootPath = siteValue("site-deploy-root") || deployment.rootPath;
  deployment.branch = siteValue("site-deploy-branch") || deployment.branch;
  deployment.status = "online";
  deployment.lastTestAt = new Date().toLocaleString("zh-CN", { hour12: false });
  deployment.updatedAt = siteNow();
  saveState();
  renderModal();
  showToast("服务器连接正常", `${deployment.environment} 环境和站点目录均可访问。`, "success");
}

function renderSiteRedirectsModal() {
  const redirects = siteCms().redirects || [];
  const rows = redirects.map((item) => `<div class="site-nav-row"><div><b>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</b><small>${escapeHtml(item.reason || "手动创建")} · ${escapeHtml(siteDisplayTime(item.updatedAt || item.createdAt))}</small></div><span class="status-badge ${item.status === "active" ? "status-approved" : "status-draft"}">${item.status === "active" ? "301 生效" : "已停用"}</span><button class="link-button" type="button" data-action="site-toggle-redirect" data-redirect-id="${escapeHtml(item.id)}">${item.status === "active" ? "停用" : "启用"}</button><button class="icon-button" type="button" data-action="site-delete-redirect" data-redirect-id="${escapeHtml(item.id)}" aria-label="删除重定向"><span data-icon="trash"></span></button></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">URL 301 重定向</h2><p>页面或栏目路径变更时自动创建；也可以手动增加站内重定向。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-redirect-from">原地址</label><input class="input" id="site-redirect-from" placeholder="/old-path/" /></div><div class="field"><label for="site-redirect-to">目标地址</label><input class="input" id="site-redirect-to" placeholder="/new-path/" /></div></div><div class="field"><label for="site-redirect-reason">变更原因</label><input class="input" id="site-redirect-reason" placeholder="例如：专题页地址调整" /></div><button class="secondary-button" type="button" data-action="site-add-redirect"><span data-icon="plus"></span>添加重定向</button><div class="site-nav-list" style="padding:12px 0 0">${rows || '<div class="empty-state compact"><div><span data-icon="link"></span><h3>还没有重定向</h3><p>修改页面或栏目地址时，系统会自动在这里生成记录。</p></div></div>'}</div></div><div class="modal-foot"><span>${redirects.filter((item) => item.status === "active").length} 条规则正在生效</span><button class="primary-button" type="button" data-action="close-modal">完成</button></div>`, { wide: true });
}

function addSiteRedirect() {
  const from = siteValue("site-redirect-from");
  const to = siteValue("site-redirect-to");
  if (!from || !to) return showToast("请填写原地址和目标地址", "两个地址都必须是当前官网内的路径。", "error");
  if (sitePath(from) === sitePath(to)) return showToast("重定向地址不能相同", "原地址和目标地址需要不同。", "error");
  siteAddRedirect(from, to, siteValue("site-redirect-reason") || "手动创建");
  saveState();
  renderModal();
  showToast("301 重定向已添加", `${sitePath(from)} 将跳转到 ${sitePath(to)}。`, "success");
}

function toggleSiteRedirect(redirectId) {
  const redirect = siteCms().redirects.find((item) => item.id === redirectId);
  if (!redirect) return;
  redirect.status = redirect.status === "active" ? "disabled" : "active";
  redirect.updatedAt = siteNow();
  saveState();
  renderModal();
}

function deleteSiteRedirect(redirectId) {
  siteCms().redirects = siteCms().redirects.filter((item) => item.id !== redirectId);
  saveState();
  renderModal();
  showToast("重定向已删除", "该原地址将不再自动跳转。", "success");
}

function saveSiteSettings() {
  const name = siteValue("site-setting-name");
  const domain = siteValue("site-setting-domain").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const companyName = siteValue("site-setting-company");
  const description = siteValue("site-setting-description");
  if (!name || !domain || !companyName) return showToast("请补全站点基础信息", "网站名称、主域名和企业主体不能为空。", "error");
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(domain)) return showToast("主域名格式不正确", "请填写不带协议和路径的域名，例如 www.example.com。", "error");
  Object.assign(siteCms().settings, { siteName: name, companyName, description, allowAiCrawl: siteChecked("site-setting-ai-crawl"), updatedAt: siteNow() });
  state.site.domain = domain;
  saveState();
  render();
  showToast("站点设置已保存", "企业主体、域名和 AI 抓取配置已更新。", "success");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportSiteLeads() {
  const statusLabel = { new: "新线索", contacted: "已联系", qualified: "有效商机" };
  const header = ["线索编号", "联系人", "企业", "咨询服务", "提交时间", "来源页面", "状态", "负责人", "下次跟进", "最近记录"];
  const rows = siteLeads().map((lead) => [lead.id, lead.name, lead.company, lead.service, lead.createdAt, lead.sourcePage, statusLabel[lead.status] || lead.status, lead.owner, lead.nextFollowAt, lead.notes]);
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `官网咨询线索-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  siteCms().lastLeadsExportAt = siteNow();
  saveState();
  showToast("线索 CSV 已导出", `共导出 ${rows.length} 条线索及当前跟进状态。`, "success");
}

function renderKnowledgeLibraries() {
  const activeBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived");
  const bases = activeBases.filter((base) => ui.knowledgeKindFilter === "all" || base.kind === ui.knowledgeKindFilter);
  const activeBaseIds = new Set(activeBases.map((base) => base.id));
  const approvedCount = (state.knowledgeItems || []).filter((item) => activeBaseIds.has(item.knowledgeBaseId) && item.status === "approved").length;
  const pendingCount = (state.knowledgeItems || []).filter((item) => activeBaseIds.has(item.knowledgeBaseId) && item.status !== "approved").length;
  const cards = bases.map((base) => {
    const items = knowledgeBaseItems(base.id);
    const approved = approvedKnowledgeItems(base.id).length;
    return `
      <article class="card knowledge-library-card">
        <div class="knowledge-library-head">
          <span class="knowledge-icon ${base.kind === "qa" ? "purple" : ""}" data-icon="${base.kind === "qa" ? "help" : "book"}"></span>
          <div class="knowledge-library-badges"><span class="small-tag ${base.kind === "qa" ? "purple" : "blue"}">${knowledgeKindLabel(base.kind)}</span>${base.status === "ready" ? '<span class="status-badge status-approved">条目就绪</span>' : '<span class="status-badge status-review">处理中</span>'}</div>
        </div>
        <h3>${escapeHtml(base.name)}</h3>
        <p>${escapeHtml(base.description || "尚未填写知识库说明")}</p>
        <div class="knowledge-library-scope"><span data-icon="layers"></span><span>${escapeHtml(knowledgeScopeLabel(base))}</span><b>版本索引</b></div>
        <div class="knowledge-library-stats"><span><b>${items.length}</b> 条知识</span><span><b>${approved}</b> 条可用于写作</span></div>
        <button class="knowledge-library-open" type="button" data-action="open-knowledge-base" data-base-id="${base.id}"><span>进入知识库</span><span data-icon="arrow"></span></button>
      </article>
    `;
  }).join("");
  return `
    <section class="knowledge-metrics">
      <article class="card summary-card"><span data-icon="database"></span><div><b>${activeBases.length}</b><small>知识库</small></div></article>
      <article class="card summary-card"><span class="green" data-icon="check"></span><div><b>${approvedCount}</b><small>已审核知识</small></div></article>
      <article class="card summary-card"><span class="purple" data-icon="help"></span><div><b>${activeBases.filter((base) => base.kind === "qa").length}</b><small>标准问答库</small></div></article>
      <article class="card summary-card"><span class="amber" data-icon="clock"></span><div><b>${pendingCount}</b><small>待审核</small></div></article>
    </section>
    <div class="knowledge-toolbar">
      <div class="segmented-control" role="tablist">
        ${[["all", "全部"], ["document", "文档库"], ["qa", "问答库"]].map(([id, label]) => '<button class="' + (ui.knowledgeKindFilter === id ? "active" : "") + '" type="button" data-action="knowledge-kind-filter" data-kind="' + id + '">' + label + "</button>").join("")}
      </div>
      <p>文档库保存长资料，问答库保存企业认可的标准回答；当前演示按已审核条目和版本范围检索，正式部署再接入向量 RAG 服务。</p>
    </div>
    <section class="knowledge-library-grid">${cards || '<div class="card empty-state knowledge-empty"><div><span data-icon="book"></span><h3>还没有这类知识库</h3><p>新建后即可录入资料并绑定业务线。</p><button class="primary-button button-small" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button></div></div>'}</section>
  `;
}

function renderKnowledgePackages() {
  const publicBases = (state.knowledgeBases || []).filter((base) => base.scope === "enterprise" && base.status !== "archived");
  const cards = state.businessLines.filter((line) => line.status === "active").map((line) => {
    const bound = (line.knowledgeBaseIds || []).map(knowledgeBaseById).filter(Boolean);
    const names = bound.map((base) => '<span class="knowledge-package-chip"><span data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span>' + escapeHtml(base.name) + '</span>').join("");
    const approved = bound.reduce((total, base) => total + approvedKnowledgeItems(base.id).length, 0) + publicBases.reduce((total, base) => total + approvedKnowledgeItems(base.id).length, 0);
    return `
      <article class="card knowledge-package-card">
        <div class="knowledge-package-head"><span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span><div><h3>${escapeHtml(line.name)}</h3><p>${escapeHtml(line.product)}</p></div><button class="secondary-button button-small" type="button" data-action="manage-knowledge-package" data-line-id="${line.id}">配置默认知识</button></div>
        <div class="inherit-chain"><span>企业公共库 ${publicBases.length}</span><span data-icon="arrow"></span><span>业务线专属 ${bound.length}</span><span data-icon="arrow"></span><b>可用知识 ${approved} 条</b></div>
        <div class="knowledge-package-list">${names || '<span class="empty-inline">尚未绑定业务线专属知识库</span>'}</div>
        <p class="knowledge-package-note">新建内容计划会继承公共库和这里的默认库；已保存计划仍使用自己的范围快照。</p>
      </article>
    `;
  }).join("");
  return `
    <section class="card public-knowledge-banner"><span class="knowledge-icon" data-icon="globe"></span><div><h3>企业公共知识</h3><p>自动进入所有业务线与新内容计划，无需重复绑定。</p></div><div class="public-base-list">${publicBases.map((base) => '<button type="button" data-action="open-knowledge-base" data-base-id="' + base.id + '">' + escapeHtml(base.name) + '<b>' + approvedKnowledgeItems(base.id).length + ' 条</b></button>').join("") || "暂无公共库"}</div></section>
    <div class="stack">${cards}</div>
  `;
}

function renderEnterpriseFacts() {
  const profile = state.enterpriseProfile;
  const facts = [
    ["企业主体", profile.companyName, "经人工确认的企业全称"],
    ["品牌名称", profile.brandName, "官网与内容平台统一使用"],
    ["主营服务", profile.primaryService, profile.serviceDescription],
    ["服务客户", profile.audience, "用于限定文章适用范围"],
    ["服务区域", profile.serviceArea, "公开对外服务范围"],
    ["官方信源", profile.officialDomain, "企业可长期控制的公开信源"]
  ];
  return `<section class="facts-layout"><div class="card fact-summary"><span class="completion-ring"><b>${profile.completion}%</b></span><div><h3>企业事实完成度</h3><p>事实卡用于快速校验，详细原文与版本仍保存在文档库和问答库。</p><button class="secondary-button button-small" type="button" data-action="edit-knowledge" data-knowledge="profile">继续完善企业档案</button></div></div><div class="fact-grid">${facts.map(([label, value, note]) => '<article class="card fact-card"><span>' + label + '</span><b>' + escapeHtml(value || "待补充") + '</b><p>' + escapeHtml(note || "") + '</p></article>').join("")}</div></section>`;
}

function renderKnowledgeReview() {
  const pending = (state.knowledgeItems || []).filter((item) => item.status !== "approved" && knowledgeBaseById(item.knowledgeBaseId)?.status !== "archived");
  const gaps = (state.knowledgeGaps || []).filter((gap) => !["resolved", "archived"].includes(gap.status));
  const pendingRows = pending.map((item) => {
    const base = knowledgeBaseById(item.knowledgeBaseId);
    return `<tr><td class="article-title-cell"><b>${escapeHtml(item.title || item.question)}</b><small>${escapeHtml(base?.name || "未知知识库")} · ${escapeHtml(item.id)}</small></td><td><span class="small-tag ${item.kind === "qa" ? "purple" : "blue"}">${knowledgeKindLabel(item.kind || base?.kind)}</span></td><td>${item.status === "pending_review" ? statusBadge("pending_review") : statusBadge("draft")}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="open-knowledge-item" data-item-id="${item.id}">查看 / 编辑</button><button class="link-button" type="button" data-action="approve-knowledge-item" data-item-id="${item.id}">审核通过</button></div></td></tr>`;
  }).join("");
  const gapCards = gaps.map((gap) => {
    const line = state.businessLines.find((item) => item.id === gap.businessLineId);
    return `<article class="knowledge-gap-card"><span class="gap-icon" data-icon="alert"></span><div><b>${escapeHtml(gap.title || gap.label || gap.fact || "待补充企业知识")}</b><p>${escapeHtml(gap.description || gap.reason || "当前知识范围没有足够证据，模型不会自行补写。")}</p><small>${escapeHtml(line?.name || "全企业")} · 来源：${escapeHtml(gap.source || "内容生成检查")}</small></div><button class="secondary-button button-small" type="button" data-action="resolve-knowledge-gap" data-gap-id="${gap.id}">补充知识</button></article>`;
  }).join("");
  return `
    <section class="knowledge-review-grid">
      <div class="card table-card"><div class="card-header"><div><h3>待审核知识</h3><p>草稿和待审核版本不会参与文章生成</p></div><span class="status-badge status-review">${pending.length} 条</span></div>${pendingRows ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>知识条目</th><th>类型</th><th>状态</th><th>操作</th></tr></thead><tbody>' + pendingRows + '</tbody></table></div>' : '<div class="empty-state compact"><div><span data-icon="check"></span><h3>没有待审核知识</h3><p>当前可用知识均已完成审核。</p></div></div>'}</div>
      <div class="card"><div class="card-header"><div><h3>知识缺口</h3><p>生成和监测发现的事实空白</p></div><span class="small-tag amber">${gaps.length} 项</span></div><div class="knowledge-gap-list">${gapCards || '<div class="empty-state compact"><div><span data-icon="check"></span><h3>暂无知识缺口</h3><p>最近生成任务没有发现必须补充的事实。</p></div></div>'}</div></div>
    </section>
  `;
}

function renderKnowledgeLegacyCards(tab) {
  const cards = tab === "assets"
    ? [{ id: "images", title: "品牌与内容素材", description: "品牌、产品、案例和文章配图，供内容任务按授权范围使用。", icon: "image", tone: "teal", unit: "张" }]
    : tab === "facts"
      ? [
        { id: "products", title: "产品服务", description: "产品、服务内容、交付方式与对外承诺边界。", icon: "briefcase", tone: "teal", unit: "项" },
        { id: "cases", title: "案例资质", description: "已脱敏、已授权且允许用于内容生产的案例与资质。", icon: "clipboard", tone: "purple", unit: "项" },
        { id: "faq", title: "常见问题", description: "客户常问问题与企业认可的标准回答。", icon: "help", tone: "blue", unit: "条" },
        { id: "documents", title: "知识资料", description: "企业档案、产品资料、交付规范和其他来源清单。", icon: "book", tone: "amber", unit: "份" }
      ]
    : [
      { id: "adLaw", title: "广告法规则", description: "广告合规规则属于内容风控，不参与企业事实检索。", icon: "shield", tone: "amber", unit: "条" },
      { id: "sensitive", title: "企业敏感规则", description: "行业敏感词、内部信息和不允许对外披露的表达。", icon: "alert", tone: "purple", unit: "条" },
      { id: "banned", title: "企业禁用表述", description: "与服务边界或企业事实冲突的禁止说法。", icon: "lock", tone: "teal", unit: "条" }
    ];
  return '<section class="knowledge-grid">' + cards.map((item) => { const data = state.knowledge[item.id] || { count: 0, updated: "尚未维护" }; return `<article class="card knowledge-card"><div class="knowledge-card-head"><span class="knowledge-icon ${item.tone}" data-icon="${item.icon}"></span><span class="status-badge status-approved">已启用</span></div><h3>${escapeHtml(data.name || item.title)}</h3><p>${item.description}</p><div class="knowledge-card-foot"><span><b>${Number(data.count) || 0}</b> ${item.unit} · ${escapeHtml(data.updated || "尚未维护")}</span><button class="text-button" type="button" data-action="edit-knowledge" data-knowledge="${item.id}">管理 <span data-icon="arrow"></span></button></div></article>`; }).join("") + "</section>";
}

function renderKnowledge() {
  const tabs = [["libraries", "知识库"], ["packages", "业务线知识包"], ["facts", "企业事实"], ["review", "待审核 / 知识缺口"], ["assets", "素材库"], ["rules", "内容规则"]];
  if (!tabs.some(([id]) => id === ui.knowledgeTab)) ui.knowledgeTab = "libraries";
  const tabHtml = tabs.map(([id, label]) => '<button class="tab-button ' + (ui.knowledgeTab === id ? "active" : "") + '" type="button" data-action="knowledge-tab" data-tab="' + id + '">' + label + "</button>").join("");
  const actions = ui.knowledgeTab === "libraries"
    ? '<button class="secondary-button" type="button" data-action="import-knowledge"><span data-icon="upload"></span>导入资料</button><button class="primary-button" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button>'
    : ui.knowledgeTab === "packages"
      ? '<button class="primary-button" type="button" data-action="manage-knowledge-package" data-line-id="' + (activeBusinessLine()?.id || "") + '"><span data-icon="layers"></span>配置当前业务线</button>'
      : ui.knowledgeTab === "facts"
        ? '<button class="primary-button" type="button" data-action="edit-knowledge" data-knowledge="profile"><span data-icon="edit"></span>完善企业档案</button>'
        : "";
  const panel = ui.knowledgeTab === "libraries" ? renderKnowledgeLibraries()
    : ui.knowledgeTab === "packages" ? renderKnowledgePackages()
      : ui.knowledgeTab === "facts" ? `${renderEnterpriseFacts()}<section class="knowledge-structured-section"><div class="card-header"><div><h3>结构化企业资料</h3><p>维护运营人员常用的产品、案例、FAQ 和资料清单；详细正文与版本仍以知识库为准。</p></div></div>${renderKnowledgeLegacyCards("facts")}</section>`
        : ui.knowledgeTab === "review" ? renderKnowledgeReview()
          : renderKnowledgeLegacyCards(ui.knowledgeTab);
  return `
    <div class="page-container">
      ${pageHead("企业知识", "让每篇内容都基于本企业已审核、可追溯、可冻结的事实生成。", actions)}
      <div class="tabs-row knowledge-tabs-row"><div class="tabs">${tabHtml}</div><span class="small-tag teal">本地演示检索</span></div>
      ${panel}
      <div class="privacy-note"><span data-icon="info"></span><span><b>内容关联规则：</b>文章覆盖 ＞ 内容计划 ＞ 业务线默认知识包 ＞ 企业公共库。问题词库记录“客户会问什么”，企业问答库记录“企业如何标准回答”，两者不会混用。</span></div>
    </div>
  `;
}

function renderAssistantLegacy() {
  const groups = state.accountGroups.map((group) => {
    const accounts = Object.entries(group.accounts).map(([platform, account]) => `
      <div class="account-item">
        ${platformLogo(platform)}
        <span><b>${escapeHtml(account.name)}</b><small>${PLATFORM_META[platform].name}</small></span>
        ${statusBadge(account.status)}
      </div>
    `).join("");
    return `
      <article class="card account-group">
        <div class="account-group-head">
          <div class="group-title"><span class="group-avatar">${group.name.slice(0, 1)}</span><span><b>${escapeHtml(group.name)}</b><small>${escapeHtml(group.deviceName)} · ${formatRelative(group.updatedAt)}同步</small></span></div>
          <button class="secondary-button button-small" type="button" data-action="edit-group">在本地助手中管理</button>
        </div>
        <div class="account-grid">${accounts}</div>
      </article>
    `;
  }).join("");

  return `
    <div class="page-container">
      ${pageHead("发布助手", "客户从这里下载本地桌面软件；账号登录与分组在客户电脑完成，后台只同步设备、账号别名和可用状态。", '<a class="secondary-button" href="/downloads/tongzhuo-geo-publisher-setup.exe" download><span data-icon="download"></span>下载本地发布器</a><button class="primary-button" type="button" data-action="pair-device"><span data-icon="plus"></span>配对新设备</button>')}
      <section class="card assistant-download-card">
        <div class="assistant-download-copy"><span class="download-app-icon" data-icon="monitor"></span><div><span class="section-kicker">CLIENT APP · WINDOWS</span><h3>客户本地发布器</h3><p>安装在运营人员电脑上，在本地登录微信公众号、知乎、头条等平台账号。平台密码、Cookie、验证码和浏览器登录态不会上传到客户服务器。</p><div class="assistant-download-meta"><span class="small-tag blue">版本 1.8.10</span><span class="small-tag">Windows 10/11</span><span class="small-tag teal">默认端口 18280</span></div></div></div>
        <div class="assistant-download-actions"><a class="primary-button" href="/downloads/tongzhuo-geo-publisher-setup.exe" download><span data-icon="download"></span>下载 Windows 桌面软件</a><button class="secondary-button" type="button" data-action="pair-device"><span data-icon="link"></span>查看配对步骤</button><small>下载安装程序后双击运行，软件会自动创建桌面快捷方式和开始菜单入口。</small></div>
      </section>
      <section class="assistant-flow card">
        <div class="card-header"><div><h3>本地发布器连接流程</h3><p>只需要首次安装和配对，之后任务会自动同步到本地软件。</p></div><span class="small-tag teal">本机执行</span></div>
        <div class="assistant-flow-steps"><div><i>1</i><b>下载并安装</b><small>客户在当前页面下载 Windows 桌面软件并完成安装。</small></div><div><i>2</i><b>绑定客户后台</b><small>输入配对码，建立设备令牌。</small></div><div><i>3</i><b>本地登录账号</b><small>按账号组逐个平台登录，后台只看到状态。</small></div><div><i>4</i><b>领取并执行</b><small>审核通过的排期由本地软件按平台顺序执行。</small></div></div>
      </section>
      <section class="card assistant-hero">
        <div class="device-state"><span class="device-icon" data-icon="monitor"><i></i></span><div><h3>运营部电脑 · GEO-OPS-01</h3><p>Windows 11 · 桌面发布节点 1.8.10 · 最近心跳 ${formatRelative(state.accountGroups[0].updatedAt)}</p></div></div>
        <div class="assistant-meta"><span>设备状态<b>在线</b></span><span>账号组<b>${state.accountGroups.length} 组</b></span><span>平台账号<b>6 个</b></span></div>
      </section>
      <div class="stack">${groups}</div>
      <div class="privacy-note"><span data-icon="lock"></span><span><b style="display:block;color:var(--ink);margin-bottom:2px">平台登录态只留在本机</b>密码、Cookie、验证码与浏览器 Profile 不会上传服务器。本地助手只主动通过 HTTPS 领取任务和回写结果。</span></div>
    </div>
  `;
}

function renderAssistant() {
  const devices = publisherSnapshot.devices || [];
  const onlineDevices = devices.filter((device) => device.status === "online");
  const groups = state.accountGroups.filter((group) => group.id !== "unpaired").map((group) => {
    const accounts = Object.keys(group.accounts || {}).map((platform) => {
      const connection = publisherAccountConnection(group, platform);
      const account = connection.account || group.accounts?.[platform] || {};
      return `
      <div class="account-item">
        ${platformLogo(platform)}
        <span><b>${escapeHtml(account.name || account.accountName || "未命名账号")}</b><small>${escapeHtml(PLATFORM_META[platform]?.name || publisherPlatform(platform)?.name || platform)}</small></span>
        ${statusBadge(connection.status || account.status || "needs_login")}
      </div>
    `;
    }).join("");
    return `<article class="card account-group"><div class="account-group-head"><div class="group-title"><span class="group-avatar">${escapeHtml(group.name.slice(0, 1))}</span><span><b>${escapeHtml(group.name)}</b><small>${escapeHtml(group.deviceName || "本地桌面发布器")} · ${formatRelative(publisherGroupUpdatedAt(group))}同步</small></span></div><button class="secondary-button button-small" type="button" data-action="edit-group">在本地软件中管理</button></div><div class="account-grid">${accounts || '<div class="empty-state compact"><p>该账号组暂未同步平台账号。</p></div>'}</div></article>`;
  }).join("");
  const deviceName = onlineDevices[0]?.name || devices[0]?.name || "尚未连接桌面发布器";
  const lastHeartbeat = onlineDevices[0]?.lastHeartbeatAt || devices[0]?.lastHeartbeatAt || null;
  const accountCount = groups ? groups.match(/class="account-item"/g)?.length || 0 : 0;
  const liveState = onlineDevices.length ? "device_online" : devices.length ? "device_offline" : "not_connected";
  const selectablePlatformCount = (publisherSnapshot.selectablePlatformIds || publisherSnapshot.platforms || []).filter((item) => (typeof item === "string" ? item : item.id) !== "web" && (typeof item === "string" || item.enabled !== false)).length;
  const catalogGroups = state.accountGroups.filter((group) => group.id !== "unpaired");
  const catalogGroup = catalogGroups.find((group) => group.id === ui.assistantCatalogGroupId) || catalogGroups[0] || null;
  const loggedInPlatformCount = (publisherSnapshot.platforms || []).filter((platform) => platform.id !== "web" && platform.enabled !== false && publisherAccountReadyForGroup(catalogGroup, platform.id)).length;
  const catalogGroupOptions = catalogGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === catalogGroup?.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
  const catalogRows = (publisherSnapshot.platforms || []).filter((platform) => platform.id !== "web" && platform.enabled !== false).map((platform) => {
    const connection = publisherAccountConnection(catalogGroup, platform.id);
    const state = platform.enabled === false ? (platform.support === "planned" ? "planned" : "not_connected") : connection.ready ? "online" : connection.account ? connection.status : "not_connected";
    const copy = platform.enabled === false
      ? "规划目录保留，暂不进入发布选择"
      : publisherConnectionMessage(connection);
    return `<div class="assistant-platform-row"><span class="assistant-platform-name">${escapeHtml(platform.name)}</span>${statusBadge(state)}<small>${escapeHtml(copy)}</small></div>`;
  }).join("");
  return `
    <div class="page-container">
      ${pageHead("发布助手", "本地 Windows 软件负责平台账号登录和执行；发布运营只负责选择审核通过的文章、账号组和平台。", '<a class="secondary-button" href="/downloads/tongzhuo-geo-publisher-setup.exe" download><span data-icon="download"></span>下载桌面软件</a><button class="primary-button" type="button" data-action="pair-device"><span data-icon="plus"></span>配对新设备</button>')}
      <section class="card assistant-hero"><div class="device-state"><span class="device-icon" data-icon="monitor"><i></i></span><div><h3>${escapeHtml(deviceName)}</h3><p>最近心跳：${lastHeartbeat ? escapeHtml(formatTimeLabel(lastHeartbeat)) : "尚未连接"}</p></div></div><div class="assistant-meta"><span>设备状态${statusBadge(liveState)}</span><span>账号组<b>${groups ? state.accountGroups.filter((group) => group.id !== "unpaired").length : 0} 组</b></span><span>平台账号<b>${accountCount} 个</b></span></div></section>
      <section class="card assistant-download-card"><div class="assistant-download-copy"><span class="download-app-icon" data-icon="monitor"></span><div><span class="section-kicker">CLIENT APP · WINDOWS</span><h3>桐灼 GEO 桌面发布器</h3><p>桌面软件启动后会在本机托盘运行，账号登录态只留在客户电脑；后台通过任务队列把审核后的文章交给它执行。</p></div></div><div class="assistant-download-actions"><a class="primary-button" href="/downloads/tongzhuo-geo-publisher-setup.exe" download><span data-icon="download"></span>下载 Windows 桌面软件</a><button class="secondary-button" type="button" data-action="pair-device"><span data-icon="link"></span>生成配对码</button></div></section>
      <div class="stack">${groups || '<section class="card empty-state"><div><span data-icon="monitor"></span><h3>尚未连接本地发布器</h3><p>下载软件、安装后点击“生成配对码”，再把配对码填入桌面软件。</p><button class="primary-button" type="button" data-action="pair-device">生成配对码</button></div></section>'}</div>
      <section class="card assistant-platform-catalog"><div class="card-header"><div><h3>发布平台目录</h3><p>目录与桌面发布器保持一致；状态按当前账号组的本地登录会话实时同步，已登录的平台可直接在发布运营中下发。</p></div><div class="assistant-catalog-tools">${catalogGroupOptions ? `<label><span>账号组</span><select class="select" data-assistant-catalog-group>${catalogGroupOptions}</select></label>` : ""}<span class="small-tag teal">${selectablePlatformCount} 个本地平台 · ${loggedInPlatformCount} 个已登录</span></div></div><div class="assistant-platform-list">${catalogRows || '<div class="empty-state compact"><p>等待桌面发布器目录同步。</p></div>'}</div></section>
      <div class="privacy-note"><span data-icon="lock"></span><span><b style="display:block;color:var(--ink);margin-bottom:2px">平台登录态只留在本机</b>密码、Cookie、验证码与浏览器 Profile 不会上送服务器；后台只保存设备状态、账号别名、任务状态和发布结果。</span></div>
    </div>
  `;
}

function formatTimeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "-") : date.toLocaleString("zh-CN", { hour12: false });
}

function aiProviderProtocolLabel(protocol) {
  const labels = { openai_compatible: "OpenAI 兼容接口", deepseek: "DeepSeek", qwen: "通义千问", kimi: "Kimi / Moonshot", zhipu: "智谱 GLM", custom: "自定义接口" };
  return labels[protocol] || protocol || "OpenAI 兼容接口";
}

function aiProviderKindLabel(kind) {
  return kind === "image" ? "图片模型" : kind === "embedding" ? "向量模型" : "文本模型";
}

function aiProviderStatusMarkup(provider) {
  const status = provider?.connectionStatus || provider?.status || (provider?.connected ? "connected" : "not_configured");
  if (["connected", "online", "healthy", "passed"].includes(status)) return '<span class="status-badge status-online">已连接</span>';
  if (["testing", "pending"].includes(status)) return '<span class="status-badge status-pending">检测中</span>';
  if (["error", "failed"].includes(status)) return '<span class="status-badge status-error">连接失败</span>';
  return '<span class="status-badge status-draft">未测试</span>';
}

function renderAiProviderCards() {
  if (aiProviderSnapshot.loading) return '<div class="ai-provider-empty"><span class="loading-spinner dark"></span><b>正在读取模型供应商</b><p>仅加载供应商名称和脱敏状态，不会读取 API 密钥。</p></div>';
  if (!aiProviderSnapshot.loaded && aiProviderSnapshot.error) return `<div class="ai-provider-empty error"><span data-icon="alert"></span><b>模型供应服务未连接</b><p>${escapeHtml(aiProviderSnapshot.error)}。启动服务端后可在这里添加 API。</p><button class="secondary-button button-small" type="button" data-action="refresh-ai-providers"><span data-icon="refresh"></span>重新读取</button></div>`;
  if (!aiProviderSnapshot.providers.length) return '<div class="ai-provider-empty"><span data-icon="cpu"></span><b>还没有模型供应商</b><p>添加 API 后，模型才会出现在“更换模型”和写作智能体中。</p><button class="secondary-button button-small" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>添加第一个供应商</button></div>';
  return `<div class="ai-provider-list">${aiProviderSnapshot.providers.map((provider) => {
    const textDefault = state.settings.modelProviderId === provider.id;
    const imageDefault = state.settings.imageProviderId === provider.id;
    const modelNames = Array.isArray(provider.models) ? provider.models.map((model) => model.id || model.name).filter(Boolean).slice(0, 3) : [];
    const configuredModel = provider.model || provider.modelId || "未配置模型";
    const displayedModels = modelNames.length ? modelNames.join("、") : configuredModel;
    return `<article class="ai-provider-row"><div class="ai-provider-icon"><span data-icon="cpu"></span></div><div class="ai-provider-copy"><div class="ai-provider-title"><b>${escapeHtml(provider.name || "未命名供应商")}</b>${aiProviderStatusMarkup(provider)}</div><p>${escapeHtml(aiProviderProtocolLabel(provider.protocol))} · ${escapeHtml(provider.baseUrl || "未填写 Base URL")}</p><div class="ai-provider-meta"><span>${escapeHtml(provider.apiKeyMasked || "未配置密钥")}</span><span>${escapeHtml(displayedModels)}</span></div><div class="ai-provider-defaults">${textDefault ? '<span class="small-tag blue">默认文本模型</span>' : ''}${imageDefault ? '<span class="small-tag teal">默认图片模型</span>' : ''}</div></div><div class="ai-provider-actions"><button class="secondary-button button-small" type="button" data-action="edit-ai-provider" data-provider-id="${escapeHtml(provider.id)}">编辑</button><button class="ghost-button button-small" type="button" data-action="test-ai-provider" data-provider-id="${escapeHtml(provider.id)}">测试</button><button class="text-button" type="button" data-action="delete-ai-provider" data-provider-id="${escapeHtml(provider.id)}">删除</button></div></article>`;
  }).join("")}</div>`;
}

function renderSettingsPanel() {
  if (ui.settingsTab === "models") {
    return `
      <section class="card">
        <div class="card-header"><div><h3>AI 模型</h3><p>模型选择会作为新生成文章的执行快照；既有文章、计划和智能体版本不会被覆盖。</p></div><div class="settings-model-actions"><button class="secondary-button button-small" type="button" data-action="refresh-ai-providers"><span data-icon="refresh"></span>刷新供应商</button><button class="primary-button button-small" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>添加 API 供应商</button></div></div>
        <div class="setting-section">
          <div class="setting-row"><div><b>默认文本模型</b><small>用于文章生成、AI 协作和企业知识整理</small></div><div class="setting-value">${escapeHtml(state.settings.model)}${state.settings.modelProviderId ? '<small class="setting-value-sub">已绑定 API 供应商</small>' : '<small class="setting-value-sub warning">尚未绑定 API</small>'}</div><button class="secondary-button button-small" type="button" data-action="edit-model" data-model-kind="text">更换</button></div>
          <div class="setting-row"><div><b>默认图片模型</b><small>用于文章配图任务；不影响已审核的知识库图片</small></div><div class="setting-value">${escapeHtml(state.settings.imageModel)}${state.settings.imageProviderId ? '<small class="setting-value-sub">已绑定 API 供应商</small>' : '<small class="setting-value-sub warning">尚未绑定 API</small>'}</div><button class="secondary-button button-small" type="button" data-action="edit-model" data-model-kind="image">更换</button></div>
          <div class="setting-row"><div><b>写作智能体</b><small>提示词、写作角色和知识策略在内容生产中独立管理</small></div><div class="setting-value">${(state.writingAgents || []).filter((agent) => agent.status === "active").length} 个启用</div><button class="secondary-button button-small" type="button" data-action="open-writing-agent-manager">进入管理</button></div>
        </div>
        <div class="privacy-note" style="margin:0 18px 18px"><span data-icon="info"></span><span>API 密钥由服务端保存并脱敏返回，浏览器只显示供应商状态和密钥末四位。正式部署建议启用服务器密钥加密或客户专属密钥管理服务。</span></div>
      </section>
      <section class="card ai-provider-section"><div class="card-header"><div><h3>模型供应商 / API</h3><p>一个供应商可以提供多个文本、图片或向量模型；添加后再在“更换模型”中选择。</p></div><span class="small-tag blue">服务端管理</span></div>${renderAiProviderCards()}</section>
    `;
  }
  if (ui.settingsTab === "members") {
    const memberBadge = (member) => member.status === "active" ? statusBadge("online") : member.status === "invited" ? '<span class="status-badge status-pending">待接受</span>' : '<span class="status-badge status-error">已停用</span>';
    const rows = (state.settings.members || []).map((member) => `<tr><td><b>${escapeHtml(member.name)}</b><small style="display:block;color:var(--muted)">${escapeHtml(member.email)}</small></td><td>${escapeHtml(member.role)}</td><td>${member.lastLoginAt ? escapeHtml(formatRelative(member.lastLoginAt)) : "尚未登录"}</td><td>${memberBadge(member)}</td><td><button class="link-button" type="button" data-action="manage-member" data-member-id="${escapeHtml(member.id)}">管理</button></td></tr>`).join("");
    return `
      <section class="card table-card">
        <div class="card-header"><div><h3>成员与权限</h3><p>成员、角色和状态只作用于当前客户部署空间；平台账号登录仍只在本地发布助手管理。</p></div><button class="primary-button button-small" type="button" data-action="invite-member"><span data-icon="plus"></span>邀请成员</button></div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>成员</th><th>角色</th><th>最近登录</th><th>状态</th><th></th></tr></thead><tbody>
          ${rows || '<tr><td colspan="5">暂无成员</td></tr>'}
        </tbody></table></div><div class="privacy-note" style="margin:14px 18px 18px"><span data-icon="lock"></span><span>邀请会先保存为“待接受”演示状态；这里不保存平台账号、Cookie 或密码。</span></div>
      </section>
    `;
  }
  if (ui.settingsTab === "logs") {
    const logs = [...(state.settings.operationLogs || [])].sort((a, b) => Number(b.occurredAt || 0) - Number(a.occurredAt || 0));
    return `
      <section class="card">
        <div class="card-header"><div><h3>操作日志</h3><p>审核、发布、配置与设备事件。导出的是当前浏览器中可回看的演示记录。</p></div><button class="secondary-button button-small" type="button" data-action="export-logs"><span data-icon="download"></span>导出 CSV</button></div>
        <div class="card-body log-list">
          ${logs.map((entry) => `<div class="log-item"><span title="${escapeHtml(formatDateTime(entry.occurredAt))}">${escapeHtml(formatRelative(entry.occurredAt))}</span><b>${escapeHtml(entry.category)}</b><span><small>${escapeHtml(entry.actor)} · </small>${escapeHtml(entry.detail)}</span></div>`).join("") || '<div class="empty-state compact"><p>暂无可导出的操作日志。</p></div>'}
        </div>
      </section>
    `;
  }
  return `
    <section class="card">
      <div class="card-header"><div><h3>部署与工作流</h3><p>当前客户空间的基础配置</p></div><button class="primary-button button-small" data-action="save-settings">保存设置</button></div>
      <div class="setting-section">
        <div class="setting-row"><div><b>部署方式</b><small>应用、数据库、官网均客户独立</small></div><div class="setting-value">${escapeHtml(state.settings.deployment)} · 桐灼科技</div><span class="small-tag teal">运行正常</span></div>
        <div class="setting-row"><div><b>文章风险门禁</b><small>存在高风险表述时阻止发布</small></div><div class="setting-value">审核通过仍需经过发布风险门</div><button class="toggle ${state.settings.riskGate ? "on" : ""}" type="button" data-setting="riskGate" aria-label="切换风险门禁"></button></div>
        <div class="setting-row"><div><b>人工审核</b><small>AI 生成文章默认进入待审核</small></div><div class="setting-value">适用于所有内容生成任务</div><button class="toggle ${state.settings.manualReview ? "on" : ""}" type="button" data-setting="manualReview" aria-label="切换人工审核"></button></div>
        <div class="setting-row"><div><b>系统版本</b><small>后台演示版本</small></div><div class="setting-value">Tongzhuo GEO Platform 0.4.0-demo</div><button class="secondary-button button-small" data-action="show-version">版本说明</button></div>
      </div>
      <div class="setting-section">
        <div class="setting-row"><div><b>重置演示数据</b><small>清除本浏览器中的原型操作记录</small></div><div class="setting-value">不会影响工作区中的任何旧工程或正式数据</div><button class="danger-button button-small" data-action="reset-demo"><span data-icon="refresh"></span>重置</button></div>
      </div>
    </section>
  `;
}

function renderSettings() {
  const items = [
    ["general", "settings", "通用设置"],
    ["models", "cpu", "AI 模型"],
    ["members", "users", "成员权限"],
    ["logs", "log", "操作日志"]
  ];
  const nav = items.map(([id, iconName, label]) => '<button class="' + (ui.settingsTab === id ? "active" : "") + '" type="button" data-action="settings-tab" data-tab="' + id + '"><span data-icon="' + iconName + '"></span>' + label + "</button>").join("");
  return `
    <div class="page-container">
      ${pageHead("系统设置", "管理当前客户独立部署环境，不包含平台账号密码与登录态。")}
      <div class="settings-layout">
        <aside class="card settings-nav">${nav}</aside>
        ${renderSettingsPanel()}
      </div>
    </div>
  `;
}

function closeModal() {
  if (ui.modal?.type === "onboarding") persistOnboardingDraft();
  ui.modal = null;
  ui.publishSelection = null;
  ui.scheduleSelection = null;
  ui.submittingSchedule = false;
  ui.submittingPublish = false;
  ui.monitorPlatformSelection = null;
  document.getElementById("modal-root").innerHTML = "";
  document.body.style.overflow = "";
}

function mountModal(html) {
  const root = document.getElementById("modal-root");
  root.innerHTML = html;
  hydrateIcons(root);
  hydrateBulkSelects(root);
  document.body.style.overflow = "hidden";
}

function renderModal() {
  if (!ui.modal) return closeModal();
  const renderers = {
    article: renderArticleModal,
    batchReview: renderBatchReviewModal,
    schedule: renderScheduleModal,
    publish: renderPublishModal,
    task: renderTaskModal,
    search: renderSearchModal,
    notifications: renderNotificationsModal,
    pair: renderPairModal,
    knowledge: renderKnowledgeModal,
    importKnowledge: renderImportKnowledgeModal,
    createKnowledgeBase: renderCreateKnowledgeBaseModal,
    knowledgeBaseDetail: renderKnowledgeBaseDetailModal,
    knowledgePackage: renderKnowledgePackageModal,
    knowledgeItem: renderKnowledgeItemModal,
    generationPreview: renderGenerationPreviewModal,
    citation: renderCitationModal,
    onboarding: renderOnboardingModal,
    businessLine: renderBusinessLineModal,
    businessLineManager: renderBusinessLineManagerModal,
    deleteBusinessLine: renderDeleteBusinessLineModal,
    contentPlan: renderContentPlanModal,
    topicPlanPicker: renderTopicPlanPickerModal,
    writingAgent: renderWritingAgentModal,
    regenerateArticle: renderRegenerateArticleModal,
    articleVersion: renderArticleVersionModal,
    monitorTask: renderMonitorTaskModal,
    monitorDetail: renderMonitorDetailModal,
    monitorEvidence: renderMonitorEvidenceModal,
    monitorQuery: renderMonitorQueryModal,
    sourceWorks: renderSourceWorksModal,
    trackedWork: renderTrackedWorkModal,
    modelEditor: renderModelEditorModal,
    memberEditor: renderMemberEditorModal,
    risk: renderRiskModal,
    questionEditor: renderQuestionEditorModal,
    topicEditor: renderTopicEditorModal,
    planningRelations: renderPlanningRelationsModal,
    planningArchiveDelete: renderPlanningArchiveDeleteModal,
    sitePublish: renderSitePublishModal,
    sitePreview: renderSitePreviewModal,
    sitePageVersions: renderSitePageVersionModal,
    sitePageEditor: renderSitePageEditorModal,
    siteModule: renderSiteModuleModal,
    siteCategoryManager: renderSiteCategoryManagerModal,
    siteCategory: renderSiteCategoryModal,
    siteArticlePreview: renderSiteArticlePreviewModal,
    siteNav: renderSiteNavModal,
    siteLeadFollow: renderSiteLeadFollowModal,
    siteDeployment: renderSiteDeploymentModal,
    siteRedirects: renderSiteRedirectsModal,
    version: renderVersionModal,
    reset: renderResetModal,
    aiProvider: renderAiProviderModal
  };
  const renderer = renderers[ui.modal.type];
  if (!renderer) return closeModal();
  mountModal(renderer());
}

function modalChrome(content, options = {}) {
  const className = options.drawer ? "drawer-dialog" : "modal-dialog" + (options.wide ? " wide" : "");
  return `
    <div class="modal-backdrop" data-action="backdrop-close"></div>
    <section class="${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      ${content}
    </section>
  `;
}

function renderQuestionEditorModal() {
  const question = state.questionLibrary.find((item) => item.id === ui.modal.questionId);
  if (!question) return "";
  const refs = planningQuestionReferences(question);
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">编辑问题</h2><p>${escapeHtml(question.id)} · 当前版本 v${escapeHtml(question.version || 1)} · 修改不会回写历史文章</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="planning-question-text">标准问题 *</label><textarea class="textarea" id="planning-question-text" rows="3">${escapeHtml(question.question)}</textarea></div><div class="field-row"><div class="field"><label for="planning-question-source">来源关键词</label><input class="input" id="planning-question-source" value="${escapeHtml(question.sourceKeyword || "")}" /></div><div class="field"><label for="planning-question-coverage">覆盖状态</label><select class="select" id="planning-question-coverage"><option ${question.coverage === "未覆盖" ? "selected" : ""}>未覆盖</option><option ${question.coverage === "部分覆盖" ? "selected" : ""}>部分覆盖</option><option ${question.coverage === "已覆盖" ? "selected" : ""}>已覆盖</option><option ${question.coverage === "已规划" ? "selected" : ""}>已规划</option></select></div></div>${refs.topics.length ? `<div class="archive-impact-note"><span data-icon="info"></span><span>该问题已关联 ${refs.topics.length} 个选题、${refs.plans.length} 个计划和 ${refs.articles.length} 篇文章。保存后只更新问题版本，已有选题和文章保留原快照。</span></div>` : ""}</div><div class="modal-foot"><span>保存后版本号会递增</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-question-edit"><span data-icon="check"></span>保存问题</button></div></div>`, { wide: true });
}

function renderTopicEditorModal() {
  const topic = state.topics.find((item) => item.id === ui.modal.topicId);
  if (!topic) return "";
  const dimensions = DIMENSIONS.filter((item) => item.id !== "all").map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === topic.dimension ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
  const coreQuestion = topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title || "";
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">编辑选题</h2><p>${escapeHtml(topic.id)} · 当前版本 v${escapeHtml(topic.version || 1)} · 历史计划和文章不会被回写</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="planning-topic-title">选题标题 *</label><textarea class="textarea" id="planning-topic-title" rows="3">${escapeHtml(topic.title)}</textarea></div><div class="field"><label for="planning-topic-core-question">核心回答问题 *</label><textarea class="textarea" id="planning-topic-core-question" rows="3">${escapeHtml(coreQuestion)}</textarea></div><div class="field"><label for="planning-topic-dimension">内容方向</label><select class="select" id="planning-topic-dimension">${dimensions}</select></div><div class="field"><label for="planning-topic-intent">用户意图</label><input class="input" id="planning-topic-intent" value="${escapeHtml(topic.intent || "")}" /></div></div><div class="modal-foot"><span>保存后版本号会递增</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-topic-edit"><span data-icon="check"></span>保存选题</button></div></div>`, { wide: true });
}

function renderPlanningRelationsModal() {
  const kind = ui.modal.kind === "topic" ? "topic" : "question";
  const record = kind === "question" ? state.questionLibrary.find((item) => item.id === ui.modal.recordId) : state.topics.find((item) => item.id === ui.modal.recordId);
  if (!record) return "";
  if (kind === "question") {
    const refs = planningQuestionReferences(record);
    const topics = refs.topics.map((topic) => `<div class="relation-step"><span class="relation-step-index">选题</span><div><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)} · ${planningTopicPlans(topic).length} 个计划 · ${planningTopicArticles(topic).length} 篇文章</small></div></div>`).join("");
    return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">问题引用关系</h2><p>${escapeHtml(record.question)} · ${escapeHtml(record.id)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="relation-chain"><div class="relation-step"><span class="relation-step-index">问题</span><div><b>${escapeHtml(record.question)}</b><small>${escapeHtml(record.sourceKeyword || "无来源关键词")} · v${escapeHtml(record.version || 1)}</small></div></div><span class="relation-arrow">↓</span>${topics || '<div class="archive-empty empty-state"><div><h3>还没有生成选题</h3><p>这个问题可以继续生成一个选题。</p></div></div>'}</div><div class="side-list" style="margin-top:16px"><div><span>内容计划</span><b>${refs.plans.length} 个</b></div><div><span>文章任务</span><b>${refs.articles.length} 篇</b></div><div><span>管理规则</span><b>${record.status === "archived" ? "已归档，不参与新计划" : "使用中"}</b></div></div></div><div class="modal-foot"><span>归档不会破坏历史来源链</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>`, { wide: true });
  }
  const refs = planningTopicReferences(record);
  const plans = refs.plans.map((plan) => `<div class="relation-step"><span class="relation-step-index">计划</span><div><b>${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.id)} · ${escapeHtml(plan.status || "")}</small></div></div>`).join("");
  const articles = refs.articles.map((article) => `<div class="relation-step"><span class="relation-step-index">文章</span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(article.version || "")}</small></div></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">选题引用关系</h2><p>${escapeHtml(record.title)} · ${escapeHtml(record.id)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="relation-chain"><div class="relation-step"><span class="relation-step-index">选题</span><div><b>${escapeHtml(record.title)}</b><small>${escapeHtml(refs.question?.question || "历史问题")} · v${escapeHtml(record.version || 1)}</small></div></div><span class="relation-arrow">↓</span>${plans || '<div class="relation-step"><span class="relation-step-index">计划</span><div><b>尚未加入内容计划</b></div></div>'}<span class="relation-arrow">↓</span>${articles || '<div class="relation-step"><span class="relation-step-index">文章</span><div><b>尚未生成文章</b></div></div>'}</div><div class="side-list" style="margin-top:16px"><div><span>来源问题</span><b>${escapeHtml(refs.question?.id || "未找到")}</b></div><div><span>计划数量</span><b>${refs.plans.length} 个</b></div><div><span>文章数量</span><b>${refs.articles.length} 篇</b></div><div><span>管理规则</span><b>${record.status === "archived" ? "已归档，不参与新计划" : "使用中"}</b></div></div></div><div class="modal-foot"><span>归档不会删除已生成文章</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>`, { wide: true });
}

function renderPlanningArchiveDeleteModal() {
  const kind = ui.modal.kind === "topic" ? "topic" : "question";
  const record = kind === "question" ? state.questionLibrary.find((item) => item.id === ui.modal.recordId) : state.topics.find((item) => item.id === ui.modal.recordId);
  if (!record) return "";
  const refs = kind === "question" ? planningQuestionReferences(record) : planningTopicReferences(record);
  const canDelete = kind === "question" ? !record.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length : !refs.plans.length && !refs.articles.length;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">永久删除${kind === "question" ? "问题" : "选题"}</h2><p>该操作不可恢复，请确认数据没有任何引用。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="delete-business-line-warning ${canDelete ? "" : "danger"}"><span data-icon="${canDelete ? "info" : "lock"}"></span><div><b>${escapeHtml(kind === "question" ? record.question : record.title)}</b><p>${canDelete ? "当前没有计划、文章或下游关系，可以永久删除。" : "当前仍存在下游引用，只能继续保留为归档状态。"}</p></div></div><div class="delete-impact-grid"><div><span>关联选题</span><b>${refs.topics?.length || 0}</b></div><div><span>关联计划</span><b>${refs.plans.length}</b></div><div><span>关联文章</span><b>${refs.articles.length}</b></div></div></div><div class="modal-foot"><span>${canDelete ? "删除后无法恢复" : "请先解除所有引用"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="danger-button" type="button" data-action="confirm-delete-archive" data-kind="${kind}" data-record-id="${escapeHtml(record.id)}" ${canDelete ? "" : "disabled"}>确认永久删除</button></div></div>`, { wide: true });
}

function openArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新页面后重试。", "error");
  ui.modal = { type: "article", articleId };
  renderModal();
}

function articleCitations(article) {
  return (article.citations || []).map((id) => (state.knowledgeCitations || []).find((citation) => citation.id === id)).filter(Boolean);
}

function articleAssetReviewIssues(article) {
  return (article?.assetIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter((asset) => asset && asset.reviewStatus !== "approved");
}

function articleBusinessLineIsActive(article) {
  const lineId = contentArticleBusinessLineId(article);
  return !lineId || state.businessLines.some((line) => line.id === lineId && line.status === "active");
}

function articleHasKnowledgeUpdates(article) {
  return articleCitations(article).some((citation) => {
    const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
    const latest = item && knowledgeVersionById(item.latestVersionId);
    return latest?.reviewStatus === "approved" && item.latestVersionId !== (citation.versionId || citation.knowledgeVersionId);
  });
}

function articleContentForEditor(article, citations) {
  if (!citations.length || article.content.includes("data-citation-id")) return article.content;
  const groups = [[0], [1, 2], [3, 4], [5]];
  let paragraphIndex = 0;
  return article.content.replace(/<\/p>/g, (closing) => {
    const markers = (groups[paragraphIndex] || []).map((index) => citations[index] ? citationMarkerHtml(citations[index]) : "").join("");
    paragraphIndex += 1;
    return markers + closing;
  });
}

function renderBatchReviewModal() {
  const ids = selectedArticleIdsForCurrentView();
  const entries = ids.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean).map((article) => ({ article, reason: articleReviewBlockReason(article) }));
  const reviewable = entries.filter((entry) => !entry.reason);
  const blocked = entries.filter((entry) => entry.reason);
  const rows = entries.map(({ article, reason }) => `<div class="batch-review-item ${reason ? "blocked" : "ready"}"><span class="batch-review-state" data-icon="${reason ? "alert" : "check"}"></span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${reason ? escapeHtml(reason) : "满足审核条件"}</small></div></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">批量人工审核</h2><p>将对已选择的待审核文章执行人工审核，通过后才允许进入发布流程。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="batch-review-summary"><div><span>已选择</span><b>${entries.length}</b><small>篇文章</small></div><div class="ready"><span>可审核通过</span><b>${reviewable.length}</b><small>篇</small></div><div class="blocked"><span>不参与本次</span><b>${blocked.length}</b><small>篇</small></div></div>${blocked.length ? '<div class="privacy-note warning"><span data-icon="alert"></span><span>已审核文章不会重复审核；缺少证据或未通过风控的文章也会被跳过，原状态保持不变。</span></div>' : ""}<div class="batch-review-list">${rows || '<div class="empty-state compact"><div><span data-icon="file"></span><h3>没有可审核文章</h3><p>请返回文章任务列表重新选择。</p></div></div>'}</div></div><div class="modal-foot"><span>审核人：王宁 · 审核通过后会记录时间和当前文章版本</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="confirm-batch-review" ${reviewable.length ? "" : "disabled"}><span data-icon="check"></span>确认审核通过${reviewable.length ? `（${reviewable.length}篇）` : ""}</button></div></div>`, { wide: true });
}

function renderArticleModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return "";
  const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
  const plan = contentPlanForArticle(article);
  const businessLine = state.businessLines.find((item) => item.id === (article.businessLineId || (topic && topicBusinessLineId(topic))));
  const citations = articleCitations(article);
  const lineActive = articleBusinessLineIsActive(article);
  const reviewPending = article.reviewStatus !== "approved";
  const manualReview = reviewPending && article.reviewStage === "manual_review";
  const revisionRequested = reviewPending && article.reviewStage === "revision_requested";
  const reviewStage = article.reviewStage || (reviewPending ? "draft" : "ready_to_publish");
  const submittedAt = article.reviewSubmittedAt ? new Date(article.reviewSubmittedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未提交";
  const reviewedAt = article.reviewedAt ? new Date(article.reviewedAt).toLocaleString("zh-CN", { hour12: false }) : "—";
  const knowledgeReady = citations.length > 0 && !citations.some((citation) => citation.supportStatus === "conflict" || citation.status === "missing") && (article.knowledgeStatus?.conflictCount || 0) === 0;
  const articleAssets = (article.assetIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter(Boolean);
  const assetIssues = articleAssetReviewIssues(article);
  const geoQuality = article.generationSnapshot?.outputContract
    ? (article.geoQuality || evaluateGeoArticleQuality(article.content, topic || {}, citations))
    : null;
  const geoQualityBlocked = Boolean(geoQuality?.status === "block");
  const canPublish = article.reviewStatus === "approved" && article.status === "draft" && article.riskStatus === "clean" && knowledgeReady && lineActive;
  const hasKnowledgeUpdates = articleHasKnowledgeUpdates(article);
  const riskMeta = {
    clean: { label: "风控通过", text: "未命中 warning / blocked 规则", tone: "clean" },
    warning: { label: "需注意", text: "发现 1 条 warning 规则", tone: "warning" },
    blocked: { label: "已阻断", text: "命中 blocked 规则，禁止发布", tone: "warning" },
    stale: { label: "结果已过期", text: "正文已变化，需要重新检测", tone: "warning" },
    unscanned: { label: "尚未检测", text: "审核前将执行内容风控", tone: "warning" }
  }[article.riskStatus] || { label: "尚未检测", text: "需要执行内容风控", tone: "warning" };
  const actions = !lineActive
    ? '<button class="primary-button" type="button" data-action="manage-business-lines"><span data-icon="refresh"></span>恢复业务线后继续</button>'
    : reviewPending
    ? manualReview
      ? '<button class="secondary-button" type="button" data-action="reject-article"><span data-icon="edit"></span>退回修改</button><button class="primary-button" type="button" data-action="approve-article"><span data-icon="check"></span>审核通过</button>'
      : revisionRequested
        ? '<button class="primary-button" type="button" data-action="open-article-studio" data-article-id="' + article.id + '"><span data-icon="edit"></span>继续修改</button>'
        : geoQualityBlocked
          ? '<button class="primary-button" type="button" data-action="open-article-studio" data-article-id="' + article.id + '"><span data-icon="edit"></span>补齐结构后再提交</button>'
          : '<button class="primary-button" type="button" data-action="submit-article-review" data-article-id="' + article.id + '"><span data-icon="shield"></span>提交人工审核</button>'
    : article.status === "draft" && article.riskStatus !== "clean"
      ? '<button class="primary-button" type="button" data-action="open-risk" data-article-id="' + article.id + '"><span data-icon="shield"></span>重新风控</button>'
    : canPublish
      ? '<button class="primary-button" type="button" data-action="open-publish" data-article-id="' + article.id + '"><span data-icon="send"></span>去发布</button>'
      : article.status !== "draft"
        ? '<button class="primary-button" type="button" data-nav="publish"><span data-icon="send"></span>查看发布任务</button>'
        : '<button class="primary-button" type="button" disabled><span data-icon="lock"></span>缺少知识证据</button>';
  const keywords = article.keywords.map((word) => '<span class="small-tag">' + escapeHtml(word) + "</span>").join("");
  const citationRows = citations.map((citation) => {
    const base = knowledgeBaseById(citation.knowledgeBaseId || citation.baseId);
    const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
    const version = knowledgeVersionById(citation.versionId || citation.knowledgeVersionId);
    return `<button class="article-citation-row" type="button" data-action="open-citation" data-citation-id="${citation.id}"><b>${escapeHtml(citation.marker)}</b><span><strong>${escapeHtml(item?.title || item?.question || "企业知识")}</strong><small>${escapeHtml(base?.name || "知识库")} · v${escapeHtml(version?.version || citation.knowledgeVersion || "1")}</small></span><span data-icon="arrow"></span></button>`;
  }).join("");
  const editorContent = articleContentForEditor(article, citations);
  const articleAgent = article.generationSnapshot?.writingAgent || null;
  const selectableAgents = activeWritingAgents(article.businessLineId || businessLine?.id, plan?.contentType || article.category);
  const selectedAgentIsActive = selectableAgents.some((agent) => agent.id === articleAgent?.agentId);
  const agentOptions = `${articleAgent && !selectedAgentIsActive ? '<option value="' + articleAgent.agentId + '" selected disabled>' + escapeHtml(articleAgent.nameSnapshot) + ' · v' + escapeHtml(articleAgent.version) + '（已停用）</option>' : ""}${selectableAgents.map((agent) => '<option value="' + agent.id + '" ' + (agent.id === articleAgent?.agentId ? "selected" : "") + '>' + escapeHtml(agent.name) + ' · v' + escapeHtml(agent.version) + '</option>').join("")}`;
  const previousVersions = Array.isArray(article.versions) ? article.versions : [];
  const versionRows = [`<div class="article-version-row current"><span><b>${escapeHtml(article.version)} · 当前稿</b><small>${escapeHtml(articleAgent?.nameSnapshot || "未记录智能体")}${articleAgent ? " v" + escapeHtml(articleAgent.version) : ""}</small></span><em>${formatRelative(article.updatedAt)}</em></div>`].concat(previousVersions.map((revision, index) => `<button class="article-version-row" type="button" data-action="open-article-version" data-article-id="${article.id}" data-version-index="${index}"><span><b>${escapeHtml(revision.version)} · ${escapeHtml(revision.reasonLabel || "历史版本")}</b><small>${escapeHtml(revision.generationSnapshot?.writingAgent?.nameSnapshot || revision.writingAgentNameSnapshot || "历史默认配置")}${revision.generationSnapshot?.writingAgent ? " v" + escapeHtml(revision.generationSnapshot.writingAgent.version) : ""}</small></span><em>${formatRelative(revision.archivedAt || revision.updatedAt)}</em></button>`)).join("");

  return modalChrome(`
    <div class="modal-head">
      <div><h2 id="modal-title">${manualReview ? "人工审核" : "文章编辑与审核"}</h2><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${manualReview ? "核对通过后才允许发布" : revisionRequested ? "已退回修改，重新提交后才可审核" : reviewPending ? "草稿尚未提交人工审核" : "绑定当前版本发布"}</p></div>
      <button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button>
    </div>
    <div class="modal-body">
      ${!lineActive ? '<div class="knowledge-update-banner danger"><span data-icon="lock"></span><div><b>所属业务线已删除</b><p>历史正文和引用证据仍可查看；恢复业务线后才能编辑、审核或创建新的发布任务。</p></div></div>' : ""}
      ${hasKnowledgeUpdates ? '<div class="knowledge-update-banner"><span data-icon="history"></span><div><b>企业知识已有新版本</b><p>本文继续引用生成时冻结的旧版本；如需使用最新知识，请从内容计划重新生成新版本。</p></div></div>' : ""}
      ${manualReview ? `<div class="manual-review-banner"><span class="manual-review-step active"><i>1</i><b>人工审核中</b><small>正文、引用、风险</small></span><span class="manual-review-arrow">→</span><span class="manual-review-step"><i>2</i><b>审核通过</b><small>冻结当前版本</small></span><span class="manual-review-arrow">→</span><span class="manual-review-step"><i>3</i><b>进入发布</b><small>官网 / 多平台</small></span></div><div class="manual-review-meta"><div><span>当前状态</span><b class="status-badge status-review">待人工审核</b></div><div><span>提交时间</span><b>${escapeHtml(submittedAt)}</b></div><div><span>提交人</span><b>${escapeHtml(article.reviewSubmittedBy || "内容团队")}</b></div><div><span>审核版本</span><b>${escapeHtml(article.version)}</b></div></div><div class="manual-review-checklist"><b>审核清单</b><span class="ok">正文完整</span><span class="${citations.length ? "ok" : "warning"}">${citations.length ? "企业知识已引用" : "缺少企业知识引用"}</span><span class="${article.riskStatus === "clean" ? "ok" : "warning"}">${article.riskStatus === "clean" ? "风控已通过" : "待完成风控"}</span><small>审核通过后才会解锁发布，修改正文后会自动生成新版本并重新审核。</small></div>` : revisionRequested ? `<div class="knowledge-update-banner"><span data-icon="edit"></span><div><b>已退回修改</b><p>${escapeHtml(article.reviewNote || "请根据审核意见修改后重新提交。")}</p></div></div>` : reviewPending ? `<div class="knowledge-update-banner"><span data-icon="clock"></span><div><b>当前为编辑草稿</b><p>确认正文、企业知识引用和风险状态后，再提交人工审核；未提交的草稿不能审核或发布。</p></div></div>` : `<div class="manual-review-complete"><span data-icon="check"></span><div><b>人工审核已通过 · 当前版本可发布</b><p>审核人：${escapeHtml(article.reviewedBy || "内容团队")} · ${escapeHtml(reviewedAt)} · 已冻结 ${escapeHtml(article.version)} 的正文与知识引用</p></div></div>`}
      <div class="article-drawer-grid">
        <div>
          <textarea class="editor-title" id="article-title-editor" rows="2" ${lineActive ? "" : "readonly"}>${escapeHtml(article.title)}</textarea>
          <div class="editor-toolbar" aria-label="编辑工具栏">
            <button type="button" data-action="article-format" data-command="bold" aria-label="粗体" title="粗体" ${lineActive ? "" : "disabled"}><b>B</b></button><button type="button" data-action="article-format" data-command="italic" aria-label="斜体" title="斜体" ${lineActive ? "" : "disabled"}><i>I</i></button><button type="button" data-action="article-format" data-command="formatBlock" data-value="h2" aria-label="标题" title="二级标题" ${lineActive ? "" : "disabled"}>H2</button>
            <button type="button" data-action="article-format" data-command="insertUnorderedList" aria-label="列表" title="无序列表" ${lineActive ? "" : "disabled"}>☷</button><button type="button" data-action="article-link" aria-label="链接" title="插入链接" ${lineActive ? "" : "disabled"}><span data-icon="link"></span></button><button type="button" data-action="open-article-studio" data-article-id="${article.id}" aria-label="图片" title="在 AI 创作台插入或管理图片" ${lineActive ? "" : "disabled"}><span data-icon="image"></span></button>
          </div>
          <article class="article-content ${lineActive ? "" : "read-only"}" id="article-content-editor" contenteditable="${lineActive ? "true" : "false"}" spellcheck="false">${editorContent}</article>
        </div>
        <aside class="article-side">
          <div class="side-panel article-agent-panel">
            <h4>AI 协作 · 写作智能体</h4>
            ${articleAgent ? `<div class="current-agent-chip"><span class="writing-agent-avatar ${escapeHtml(writingAgentById(articleAgent.agentId)?.color || "blue")}">${escapeHtml(writingAgentById(articleAgent.agentId)?.avatar || articleAgent.nameSnapshot.slice(0, 1))}</span><span><b>${escapeHtml(articleAgent.nameSnapshot)} · v${escapeHtml(articleAgent.version)}</b><small>${escapeHtml(articleAgent.style)} · ${articleAgent.strictKnowledge ? "严格知识" : "普通模式"}</small></span></div>` : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>历史内容未记录写作智能体，需从内容计划重新生成。</span></div>'}
            ${articleAgent && citations.length && lineActive ? `<label class="agent-switch-label" for="article-writing-agent">后续 AI 操作使用</label><select class="select" id="article-writing-agent">${agentOptions}</select><button class="secondary-button button-small agent-regenerate-button" type="button" data-action="request-regenerate-article" data-article-id="${article.id}" ${selectableAgents.length ? "" : "disabled"}><span data-icon="refresh"></span>使用此智能体重新生成</button><p class="snapshot-note"><span data-icon="info"></span>切换下拉不会修改正文；确认重写后创建新版本。</p>` : ""}
          </div>
          <div class="side-panel">
            <h4>工作流状态</h4>
            <div class="side-list">
              <div><span>内容状态</span><b>${article.status === "published" ? "已发布" : article.status === "publishing" ? "发布中" : "草稿"}</b></div>
              <div><span>审核状态</span><b>${article.reviewStatus === "approved" ? "已通过 · 可发布" : revisionRequested ? "退回修改" : manualReview ? "待人工审核" : "草稿未提交"}</b></div>
              <div><span>冻结版本</span><b>${canPublish ? article.version : "—"}</b></div>
            </div>
          </div>
          ${geoQuality ? `<div class="side-panel"><h4>GEO 结构质量门</h4><div class="risk-score"><span class="risk-state-icon ${geoQuality.status === "pass" ? "" : "warning"}" data-icon="${geoQuality.status === "pass" ? "check" : "alert"}"></span><p><b style="display:block;color:${geoQuality.status === "pass" ? "var(--green)" : "var(--amber)"}">${geoQuality.status === "pass" ? "结构通过" : geoQuality.status === "block" ? "结构阻断" : "建议补强"} · ${geoQuality.score} 分</b>${geoQuality.missing.length ? escapeHtml(geoQuality.missing.join("、")) + "。" : "已包含直接回答、证据、步骤、FAQ、边界和语义标题。"}</p></div><small class="snapshot-note">这是内容结构检查，不等同于 AI 推荐分；仍需完成风控和人工审核。</small></div>` : ""}
          <div class="side-panel">
            <h4>关联选题</h4>
            <p>${escapeHtml(topic?.title || "未关联选题")}</p>
            <div class="side-list" style="margin-top:8px"><div><span>业务线</span><b>${escapeHtml(businessLine?.name || "未关联")}</b></div><div><span>内容计划</span><b>${escapeHtml(plan?.name || "未经过计划")}</b></div></div>
          </div>
          <div class="side-panel">
            <h4>企业知识引用</h4>
            ${citationRows ? '<div class="article-citation-list">' + citationRows + '</div>' : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>这是一篇未建立证据映射的历史内容，不能直接审核发布。</span></div>'}
            <div class="citation-summary"><span>已审核证据</span><b>${citations.length} 条</b><small>${article.knowledgeStatus?.gapCount || 0} 项缺口已省略 · ${article.knowledgeStatus?.conflictCount || 0} 项冲突</small></div>
            ${article.knowledgeSnapshot ? '<p class="snapshot-note"><span data-icon="lock"></span>生成于 ' + escapeHtml(new Date(article.knowledgeSnapshot.capturedAt).toLocaleString("zh-CN", { hour12: false })) + '，引用版本' + (article.knowledgeSnapshot.frozenAt || article.reviewStatus === "approved" ? "已冻结" : "待审核冻结") + '。</p>' : ""}
          </div>
          ${articleAssets.length ? `<div class="side-panel"><h4>文章素材 ${assetIssues.length ? '<span class="small-tag amber">' + assetIssues.length + ' 待确认</span>' : '<span class="small-tag green">已确认</span>'}</h4><div class="article-citation-list">${articleAssets.map((asset) => `<div class="article-citation-row article-asset-row"><b><span data-icon="image"></span></b><span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.license || "来源待确认")} · ${asset.reviewStatus === "approved" ? "已审核" : "待人工确认"}</small></span>${asset.reviewStatus === "approved" ? '<span class="status-badge status-approved">可用</span>' : `<span class="article-asset-actions"><button class="link-button" type="button" data-action="approve-article-asset" data-article-id="${article.id}" data-asset-id="${asset.id}">确认可用</button><button class="link-button danger-text" type="button" data-action="remove-article-asset" data-article-id="${article.id}" data-asset-id="${asset.id}">移出</button></span>`}</div>`).join("")}</div><p class="snapshot-note"><span data-icon="info"></span>上传或 AI 生成的图片必须由人工确认来源与适用性，才可以随文章通过审核。</p></div>` : ""}
          <div class="side-panel">
            <h4>内容风控</h4>
            <div class="risk-score"><span class="risk-state-icon ${riskMeta.tone === "warning" ? "warning" : ""}" data-icon="shield"></span><p><b style="display:block;color:${riskMeta.tone === "warning" ? "var(--amber)" : "var(--green)"}">${riskMeta.label}</b>${riskMeta.text}</p></div>
            <button class="text-button" type="button" data-action="open-risk" data-article-id="${article.id}" style="margin-top:8px">查看风险详情 <span data-icon="arrow"></span></button>
          </div>
          <div class="side-panel">
            <h4>关键词</h4>
            <div class="topic-tags">${keywords}</div>
          </div>
          <div class="side-panel"><h4>文章版本</h4><div class="article-version-list">${versionRows}</div></div>
        </aside>
      </div>
    </div>
    <div class="modal-foot">
      <span style="color:var(--muted);font-size:10px">最后更新：${formatRelative(article.updatedAt)} · ${escapeHtml(article.author)}</span>
      <div class="modal-foot-right">
        <button class="secondary-button" type="button" data-action="open-article-studio" data-article-id="${article.id}"><span data-icon="sparkle"></span>AI 创作台</button>
        ${lineActive ? '<button class="secondary-button" type="button" data-action="save-article">保存草稿</button>' : ""}
        ${actions}
      </div>
    </div>
  `, { drawer: true });
}

function archiveArticleRevision(article, reason = "manual_edit", reasonLabel = "历史版本") {
  article.versions = Array.isArray(article.versions) ? article.versions : [];
  const revision = {
    id: uid("ARV"),
    version: article.version,
    title: article.title,
    content: article.content,
    status: article.status,
    reviewStatus: article.reviewStatus,
    reviewStage: article.reviewStage || null,
    reviewSubmittedAt: article.reviewSubmittedAt || null,
    reviewSubmittedBy: article.reviewSubmittedBy || null,
    reviewedAt: article.reviewedAt || null,
    reviewedBy: article.reviewedBy || null,
    reviewNote: article.reviewNote || "",
    riskStatus: article.riskStatus,
    author: article.author,
    citations: cloneData(article.citations || []),
    citationSnapshots: cloneData(articleCitations(article)),
    knowledgeSnapshot: cloneData(article.knowledgeSnapshot),
    generationSnapshot: cloneData(article.generationSnapshot),
    knowledgeStatus: cloneData(article.knowledgeStatus),
    writingAgentId: article.writingAgentId || null,
    writingAgentVersion: article.writingAgentVersion || null,
    writingAgentNameSnapshot: article.writingAgentNameSnapshot || null,
    updatedAt: article.updatedAt,
    archivedAt: Date.now(),
    reason,
    reasonLabel
  };
  article.versions.unshift(revision);
  return revision;
}

function studioCloneCitationsForVersion(article, nextVersion) {
  const previous = articleCitations(article);
  if (!previous.length) return { citations: [], idMap: new Map() };
  const idMap = new Map();
  const next = previous.map((citation, index) => ({
    ...cloneData(citation),
    id: uid("CIT") + "-K" + (index + 1),
    articleId: article.id,
    articleVersion: nextVersion,
    status: "needs_review",
    supportStatus: "supported"
  }));
  previous.forEach((citation, index) => idMap.set(citation.id, next[index].id));
  state.knowledgeCitations = Array.isArray(state.knowledgeCitations) ? state.knowledgeCitations : [];
  state.knowledgeCitations.push(...next);
  article.citations = next.map((citation) => citation.id);
  article.sources = next.length;
  article.content = studioRemapCitationIds(article.content, idMap);
  if (article.knowledgeSnapshot) article.knowledgeSnapshot.citationIds = article.citations.slice();
  return { citations: next, idMap };
}

function studioRemapCitationIds(html, idMap) {
  if (!idMap?.size || !html) return html;
  return String(html).replace(/(data-citation-id=["'])([^"']+)(["'])/gi, (match, prefix, id, suffix) => idMap.has(id) ? prefix + idMap.get(id) + suffix : match);
}

function saveArticleEditor(options = {}) {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  const titleInput = document.getElementById("article-title-editor");
  const contentInput = document.getElementById("article-content-editor");
  if (!article || !titleInput || !contentInput) return null;
  if (!articleBusinessLineIsActive(article)) {
    if (!options.silent) showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    return article;
  }
  const nextTitle = titleInput.value.trim();
  const nextContent = sanitizeStudioHtml(contentInput.innerHTML.trim());
  if (!nextTitle) {
    showToast("标题不能为空", "请填写文章标题后再保存。", "error");
    titleInput.focus();
    return null;
  }
  const citations = articleCitations(article);
  const renderedBaseline = articleContentForEditor(article, citations).trim();
  const changed = nextTitle !== article.title || nextContent !== renderedBaseline;
  const requiresNewVersion = changed && (article.reviewStatus === "approved" || article.status === "published");
  if (requiresNewVersion) archiveArticleRevision(article, "manual_edit", "人工修订前");
  article.title = nextTitle;
  article.content = nextContent;
  if (article.generationSnapshot?.outputContract || article.geoQuality) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot?.topicSnapshot || {}, citations);
    if (article.generationSnapshot) article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
  article.updatedAt = Date.now();
  if (changed) {
    article.riskStatus = "stale";
    citations.forEach((citation) => { citation.status = "needs_review"; });
    if (article.knowledgeStatus) {
      article.knowledgeStatus.state = "needs_review";
      article.knowledgeStatus.message = "正文已修改，需要重新核验引用证据并冻结新版本。";
    }
    if (article.knowledgeSnapshot) article.knowledgeSnapshot.frozenAt = null;
    article.reviewStatus = "pending";
    article.reviewStage = "draft";
    article.reviewSubmittedAt = null;
    article.reviewSubmittedBy = null;
    article.reviewedAt = null;
    article.reviewedBy = null;
    article.reviewNote = "";
  }
  if (requiresNewVersion) {
    article.status = "draft";
    const number = Number(article.version.replace(/\D/g, "")) || 1;
    article.version = "v" + (number + 1);
    if (!options.silent) showToast("已生成新版本", "文章内容变更，需要重新审核后才能发布。");
  } else if (!options.silent) {
    showToast("文章已保存", "草稿内容已保存在本次演示数据中。");
  }
  saveState();
  render();
  return article;
}

function submitArticleForManualReview(articleId, options = {}) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新页面后重试。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能提交审核。", "error");
  if (article.reviewStatus === "approved") return showToast("当前版本已经审核通过", "修改正文会自动创建新版本并重新进入审核。", "error");
  if (options.fromArticleModal && ui.modal?.type === "article" && ui.modal.articleId === article.id) {
    const saved = saveArticleEditor({ silent: true });
    if (!saved) return null;
  }
  if (article.generationSnapshot?.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot.topicSnapshot || {}, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
    if (article.geoQuality.status === "block") {
      saveState();
      render();
      return showToast("结构质量门未通过", article.geoQuality.missing.join("、") + "。请先补齐后再提交人工审核。", "error");
    }
  }
  const workspace = (state.writingWorkspaces || []).find((item) => item.articleId === article.id);
  article.reviewStatus = "pending";
  article.reviewStage = "manual_review";
  article.reviewSubmittedAt = new Date().toISOString();
  article.reviewSubmittedBy = "王宁";
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.status = "draft";
  if (article.riskStatus === "clean") article.riskStatus = "unscanned";
  article.updatedAt = Date.now();
  if (workspace) {
    workspace.status = "review";
    workspace.updatedAt = article.updatedAt;
  }
  saveState();
  return article;
}

function rejectArticle() {
  const article = saveArticleEditor({ silent: true });
  if (!article) return;
  if (article.reviewStage !== "manual_review") return showToast("文章尚未进入人工审核", "请先从文章编辑页提交审核。", "error");
  const workspace = (state.writingWorkspaces || []).find((item) => item.articleId === article.id);
  const reason = window.prompt("请输入退回修改原因", article.reviewNote || "请补充正文、知识引用或风险处理后重新提交审核。");
  if (reason === null) return;
  article.reviewStatus = "pending";
  article.reviewStage = "revision_requested";
  article.reviewNote = reason.trim() || "请根据审核清单修改后重新提交。";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.status = "draft";
  if (workspace) {
    workspace.status = "revision";
    workspace.updatedAt = Date.now();
  }
  article.updatedAt = Date.now();
  saveState();
  closeModal();
  openContentStudio(article.id);
  showToast("已退回修改", "文章已回到内容编辑页，修改后请重新提交人工审核。", "warning");
}

function approveArticle() {
  const article = saveArticleEditor({ silent: true });
  if (!article) return;
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "历史文章可以查看，但恢复业务线后才能继续审核和发布。", "error");
  if (article.reviewStage !== "manual_review") return showToast("文章尚未提交人工审核", "请先确认草稿并点击“提交人工审核”。", "error");
  if (article.generationSnapshot?.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot.topicSnapshot || {}, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
    if (article.geoQuality.status === "block") return showToast("结构质量门未通过", article.geoQuality.missing.join("、") + "。请退回修改后再审核。", "error");
  }
  const citations = articleCitations(article);
  if (!citations.length || !article.knowledgeSnapshot) return showToast("缺少企业知识证据", "这篇历史内容没有逐条引用与版本快照，请从内容计划重新生成。", "error");
  if (citations.some((citation) => !knowledgeBaseById(citation.knowledgeBaseId || citation.baseId) || !knowledgeItemById(citation.itemId || citation.knowledgeItemId) || !knowledgeVersionById(citation.versionId || citation.knowledgeVersionId))) return showToast("引用证据不完整", "存在无法定位到知识原文的引用，暂不能通过审核。", "error");
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return showToast("企业事实存在冲突", "请先处理知识冲突，再重新生成或审核文章。", "error");
  if (articleHasKnowledgeUpdates(article)) return showToast("知识版本已更新", "当前草稿引用的不是最新已审核版本，请从内容计划重新生成新版本。", "error");
  const assetIssues = articleAssetReviewIssues(article);
  if (assetIssues.length) return showToast("图片素材尚未审核", "文章包含未审核的上传或 AI 图片，请先完成素材审核后再通过文章审核。", "error");
  if (["unscanned", "stale"].includes(article.riskStatus) || article.riskScan?.articleVersion !== article.version) return showToast("尚未完成当前版本风控", "请先打开内容风控并重新检测，确认没有阻断或警告后再审核通过。", "error");
  if (article.riskStatus === "blocked") return showToast("风控已阻断", "命中 blocked 规则的文章不能通过审核。", "error");
  if (article.riskStatus === "warning") return showToast("存在 warning 规则", "请先查看风险详情并修订，或由管理员在正式版中填写覆盖原因。", "error");
  article.reviewStatus = "approved";
  article.reviewStage = "ready_to_publish";
  article.reviewedAt = new Date().toISOString();
  article.reviewedBy = "王宁";
  citations.forEach((citation) => { citation.status = "verified"; citation.supportStatus = "supported"; citation.articleVersion = article.version; });
  article.sources = citations.length;
  article.knowledgeSnapshot.frozenAt = new Date().toISOString();
  article.knowledgeSnapshot.citationIds = citations.map((citation) => citation.id);
  article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "frozen", evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, message: "正文、知识版本和逐条引用已完成审核冻结。" };
  article.updatedAt = Date.now();
  const reviewWorkspace = (state.writingWorkspaces || []).find((workspace) => workspace.articleId === article.id);
  if (reviewWorkspace) {
    reviewWorkspace.status = "approved";
    reviewWorkspace.updatedAt = Date.now();
  }
  ui.contentView = "articles";
  ui.articleTaskView = "articles";
  ui.articleTab = "approved";
  saveState();
  render();
  showToast("审核已通过", "已冻结 " + article.version + " 正文和 " + citations.length + " 条知识证据，可以进入发布。");
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
}

function openBatchReview() {
  const current = contentTaskVisibleArticles().filter(articleSelectableForAction);
  const visibleIds = new Set(current.map((article) => article.id));
  const ids = selectedArticleIdsForCurrentView().filter((id) => visibleIds.has(id));
  const hasReviewable = ids.some((id) => articleSelectableForReview(state.articles.find((article) => article.id === id)));
  if (!hasReviewable) return showToast("请先选择待审核文章", "已审核文章可用于定时发布；批量审核只处理待审核文章。", "error");
  ui.articleSelection = ids;
  ui.modal = { type: "batchReview" };
  return renderModal();
}

function approveSelectedArticles() {
  const ids = selectedArticleIdsForCurrentView();
  const entries = ids.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean).map((article) => ({ article, reason: articleReviewBlockReason(article) }));
  const approved = entries.filter((entry) => !entry.reason).map(({ article }) => article);
  const skipped = entries.filter((entry) => entry.reason);
  if (!approved.length) return showToast("没有可审核文章", "所选文章均未满足人工审核条件。", "error");
  const reviewedAt = new Date().toISOString();
  approved.forEach((article) => {
    const citations = articleCitations(article);
    article.reviewStatus = "approved";
    article.reviewStage = "ready_to_publish";
    article.reviewedAt = reviewedAt;
    article.reviewedBy = "王宁";
    citations.forEach((citation) => { citation.status = "verified"; citation.supportStatus = "supported"; citation.articleVersion = article.version; });
    article.sources = citations.length;
    if (article.knowledgeSnapshot) {
      article.knowledgeSnapshot.frozenAt = article.knowledgeSnapshot.frozenAt || reviewedAt;
      article.knowledgeSnapshot.citationIds = citations.map((citation) => citation.id);
    }
    article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "frozen", evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, message: "正文、知识版本和逐条引用已完成审核冻结。" };
    article.updatedAt = Date.now();
  });
  clearArticleSelection();
  saveState();
  closeModal();
  render();
  const suffix = skipped.length ? `；${skipped.length} 篇因审核条件未满足而跳过` : "";
  showToast(`已审核通过 ${approved.length} 篇`, `已记录审核人和审核时间，文章可继续进入发布流程${suffix}。`);
}

function openPublish(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新后重试。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "历史文章仍可查看，但恢复业务线后才能创建新的发布任务。", "error");
  if (article.reviewStatus !== "approved") return showToast("文章尚未通过审核", "先完成事实与风险审核，再进入发布。", "error");
  if (article.riskStatus !== "clean") return showToast("风控状态不允许发布", "请重新检测当前文章版本，确认状态为 clean。", "error");
  if (articleAssetReviewIssues(article).length) return showToast("图片素材尚未审核", "文章包含未审核素材，不能发布；请先完成图片来源、版权和内容审核。", "error");
  if (!articleCitations(article).length || !article.knowledgeSnapshot?.frozenAt && article.knowledgeStatus?.state !== "ready_with_omissions") return showToast("知识证据尚未冻结", "请先完成事实审核并冻结当前文章引用版本。", "error");
  if (articleHasKnowledgeUpdates(article)) return showToast("企业知识已有更新", "当前文章仍保留旧证据；请确认沿用旧版本或重新生成后再发布。", "error");
  if (article.status !== "draft") {
    ui.publishTab = "all";
    closeModal();
    navigate("publish");
    return showToast("文章已有发布任务", "请在发布运营中查看分平台结果。");
  }
  return openPublishBatch([articleId]);
}

function renderPublishModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  const selection = ui.publishSelection;
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  if (!article || !group) return "";
  const options = state.accountGroups.map((item) => '<option value="' + item.id + '" ' + (item.id === group.id ? "selected" : "") + ">" + escapeHtml(item.name) + "</option>").join("");
  const existingPlatforms = articleExistingPublishPlatforms(article);
  const publishEntries = PUBLISH_PLATFORM_REGISTRY.filter((entry) => (entry.enabled && entry.category === "self_media") || entry.id === "web");
  const availablePlatforms = publishEntries.map((entry) => entry.id).filter((platform) => (platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform))) && !existingPlatforms.has(platform));
  const choices = publishEntries.map((entry) => {
    const platform = entry.id;
    const isWeb = platform === "web";
    const connection = isWeb ? { account: { name: state.site.domain, status: "online" }, status: "online", ready: true } : publisherAccountConnection(group, platform);
    const account = connection.account;
    const alreadyExists = existingPlatforms.has(platform);
    const available = (isWeb || (publisherPlatformSelectable(platform) && connection.ready)) && !alreadyExists;
    const selected = selection.platforms.includes(platform) && available;
    const status = alreadyExists ? "queued" : available ? "online" : connection.status || "needs_login";
    const help = alreadyExists ? "当前文章版本已发布或已排期" : isWeb ? "由服务器直接发布，无需本地登录" : publisherConnectionMessage(connection);
    return `
      <label class="platform-choice ${selected ? "selected" : ""} ${available ? "" : "disabled"}">
        <input class="checkbox" type="checkbox" data-publish-platform="${platform}" ${selected ? "checked" : ""} ${available ? "" : "disabled"} />
        ${platformLogo(platform)}
        <span><b>${PLATFORM_META[platform].name}</b><small>${escapeHtml(help)}</small></span>
        ${statusBadge(status)}
      </label>
    `;
  }).join("");
  const selectedCount = selection.platforms.filter((platform) => {
    if (existingPlatforms.has(platform)) return false;
    if (platform === "web") return true;
    return publisherAccountReadyForGroup(group, platform);
  }).length;

  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">发布文章</h2><p>一个账号组内，同一平台只使用一个账号</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="publish-article"><b>${escapeHtml(article.title)}</b><span>${escapeHtml(article.id)} · 冻结版本 ${escapeHtml(article.version)} · 审核已通过</span></div>
      <div class="field" style="margin-top:16px">
        <label for="publish-group">发布账号组</label>
        <select class="select" id="publish-group" data-publish-group>${options}</select>
        <small>账号分组只在本地软件中修改，后台同步别名与状态。</small>
      </div>
      <div class="bulk-select-row">${renderSelectAllControl("publish-platforms", availablePlatforms.length, selectedCount, "全选可用平台")}</div><div class="publish-platforms">${choices}</div>
      <div class="security-inline"><span data-icon="lock"></span><span>服务器不保存平台密码、Cookie、验证码或浏览器 Profile。本地助手将主动领取平台任务。</span></div>
    </div>
    <div class="modal-foot">
      <span style="color:var(--muted);font-size:10px">已选择 ${selectedCount} 个发布目标</span>
      <div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-publish" ${selectedCount && !ui.submittingPublish ? "" : "disabled"}>${ui.submittingPublish ? '<span class="loading-spinner"></span>创建任务' : '<span data-icon="send"></span>确认发布'}</button></div>
    </div>
  `, { wide: true });
}

async function submitPublish() {
  if (!(await ensurePublisherIntegration())) return;
  if (ui.submittingPublish || !ui.publishSelection) return;
  const selection = ui.publishSelection;
  const article = state.articles.find((item) => item.id === selection.articleId);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  if (!article || !group) return;
  const existing = articleExistingPublishPlatforms(article);
  const platforms = selection.platforms.filter((platform) => !existing.has(platform) && (platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform))));
  if (!platforms.length) return showToast("没有可创建的目标", "请确认账号组中已登录对应的本地发布平台。", "error");
  ui.submittingPublish = true;
  renderModal();
  try {
    await publisherApi("/api/publisher/jobs", {
      method: "POST",
      body: {
        articleId: article.id,
        articleTitle: article.title,
        version: article.version,
        article: { id: article.id, title: article.title, version: article.version, excerpt: article.excerpt, content: article.content },
        webUrl: publisherArticleWebUrl(article),
        accountGroupId: group.id,
        groupName: group.name,
        platforms,
        platformOrder: platforms,
        intervalMinutes: 60,
        mode: "immediate"
      }
    });
    closeModal();
    ui.publishTab = "running";
    await refreshPublisherSnapshot();
    navigate("publish");
    showToast("发布任务已创建", "本地发布器将按平台顺序领取并回写结果。");
  } catch (error) {
    ui.submittingPublish = false;
    renderModal();
    showToast("发布任务创建失败", error.message, "error");
  }
}

function taskAggregateStatus(task) {
  const statuses = Object.values(task.targets).map((target) => target.status);
  if (statuses.some((status) => ["queued", "running"].includes(status))) return "running";
  if (statuses.every((status) => status === "success")) return "success";
  if (statuses.some((status) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(status))) return "partial";
  return "queued";
}

function submitPublishLegacy() {
  if (ui.submittingPublish || !ui.publishSelection) return;
  const selection = ui.publishSelection;
  const article = state.articles.find((item) => item.id === selection.articleId);
  const group = state.accountGroups.find((item) => item.id === selection.groupId);
  if (!article || !group) return;

  const requested = selection.platforms.filter((platform) => platform === "web" || publisherAccountReadyForGroup(group, platform));
  const existing = articleExistingPublishPlatforms(article);
  const platforms = requested.filter((platform) => !existing.has(platform));
  if (!platforms.length) return showToast("没有可创建的目标", "同一文章版本不会重复创建相同平台任务。", "error");

  ui.submittingPublish = true;
  renderModal();
  window.setTimeout(() => {
    const task = {
      id: uid("PUB"),
      articleId: article.id,
      articleTitle: article.title,
      version: article.version,
      groupId: group.id,
      groupName: group.name,
      status: "queued",
      createdAt: Date.now(),
      targets: {},
      logs: []
    };
    platforms.forEach((platform) => {
      task.targets[platform] = {
        status: "queued",
        account: platform === "web" ? state.site.domain : publisherAccount(group, platform).name,
        remoteUrl: "",
        updatedAt: Date.now()
      };
      task.logs.push({ time: "刚刚", platform: PLATFORM_META[platform].name, message: platform === "web" ? "官网发布任务已入队" : "等待本地发布助手领取任务" });
    });
    state.publishTasks.unshift(task);
    article.status = "publishing";
    article.updatedAt = Date.now();
    saveState();
    closeModal();
    ui.publishTab = "running";
    navigate("publish");
    showToast("发布任务已创建", platforms.length + " 个目标将独立执行，互不影响。");
    simulateTask(task.id);
  }, 520);
}

function scheduleDefaultSelection(articleIds = []) {
  const group = state.accountGroups[0];
  const platforms = ["web", ...Object.keys(group?.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform)).map(canonicalPublishPlatformId)];
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    articleIds: [...new Set(articleIds)],
    groupId: group?.id || null,
    platforms,
    platformOrder: [...platforms],
    quotaMode: "dailyCount",
    dailyCount: 3,
    finishDays: 3,
    intervalMinutes: 60,
    startDate,
    dailyStart: "09:00",
    dailyEnd: "18:00",
    mode: "daily"
  };
}

function openScheduleForArticles(articleIds = [], sourcePlanId = null) {
  const ids = [...new Set(articleIds)].filter((id) => state.articles.some((article) => article.id === id));
  if (!ids.length) return showToast("请先选择文章", "定时发布需要先选择至少一篇文章。", "error");
  const eligible = ids.filter((id) => articlePublishEligibility(state.articles.find((article) => article.id === id)).ok);
  if (!eligible.length) return showToast("没有可排期文章", "选中的文章必须完成审核、风控和知识证据冻结。", "error");
  ui.scheduleSelection = { ...scheduleDefaultSelection(ids), sourcePlanId };
  ui.modal = { type: "schedule" };
  renderModal();
}

function scheduleArticles(selection) {
  const selected = new Set(selection?.articleIds || []);
  return state.articles.filter((article) => selected.has(article.id) && articleScheduleEligibility(article, selection).ok);
}

function scheduleDateWithOffset(date, minutes) {
  const parts = String(date || "").split("-").map(Number);
  const value = parts.length === 3 && parts.every(Number.isFinite)
    ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
    : new Date();
  value.setHours(0, Number(minutes) || 0, 0, 0);
  return value;
}

function scheduleCapacity(selection, articleCount) {
  const platforms = selection?.platformOrder || selection?.platforms || [];
  const [startHour, startMinute] = String(selection?.dailyStart || "09:00").split(":").map(Number);
  const [endHour, endMinute] = String(selection?.dailyEnd || "18:00").split(":").map(Number);
  const dayStart = startHour * 60 + startMinute;
  const dayEnd = endHour * 60 + endMinute;
  const interval = Math.max(5, Number(selection?.intervalMinutes) || 60);
  const requestedDaily = selection?.quotaMode === "finishDays"
    ? Math.max(1, Math.ceil(articleCount / Math.max(1, Number(selection?.finishDays) || 1)))
    : Math.max(1, Number(selection?.dailyCount) || 1);
  const targetSlots = dayEnd >= dayStart ? Math.floor((dayEnd - dayStart) / interval) + 1 : 0;
  const timeCapacity = platforms.length ? Math.floor(targetSlots / platforms.length) : 0;
  const effectiveDaily = Math.max(0, Math.min(requestedDaily, timeCapacity));
  return { platforms, dayStart, dayEnd, interval, requestedDaily, targetSlots, timeCapacity, effectiveDaily, limited: effectiveDaily < requestedDaily };
}

function schedulePreviewItems(selection = ui.scheduleSelection) {
  if (!selection) return [];
  const articles = scheduleArticles(selection);
  const capacity = scheduleCapacity(selection, articles.length);
  if (!articles.length || !capacity.platforms.length || !capacity.effectiveDaily) return [];
  const items = [];
  for (let offset = 0, dayIndex = 0; offset < articles.length; offset += capacity.effectiveDaily, dayIndex += 1) {
    const dayArticles = articles.slice(offset, offset + capacity.effectiveDaily);
    const startDate = scheduleDateWithOffset(selection.startDate, 0);
    startDate.setDate(startDate.getDate() + dayIndex);
    const localDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    dayArticles.forEach((article, articleIndex) => {
      const existingPlatforms = articleExistingPublishPlatforms(article);
      const targetTimes = capacity.platforms.map((platform, platformIndex) => {
        const sequence = platformIndex * dayArticles.length + articleIndex;
        const scheduledAt = scheduleDateWithOffset(localDate, capacity.dayStart + sequence * capacity.interval);
        return { platform, scheduledAt: scheduledAt.toISOString() };
      }).filter((target) => !existingPlatforms.has(target.platform));
      items.push({
        order: offset + articleIndex + 1,
        articleId: article.id,
        articleTitle: article.title,
        version: article.version,
        scheduledAt: targetTimes[0].scheduledAt,
        completesAt: targetTimes.at(-1).scheduledAt,
        targetTimes,
        platformNames: targetTimes.map((target) => PLATFORM_META[target.platform]?.name || target.platform)
      });
    });
  }
  return items;
}

function scheduleTimeLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function scheduleTimeRangeLabel(item) {
  if (!item?.scheduledAt) return "—";
  const start = scheduleTimeLabel(item.scheduledAt);
  if (!item.completesAt || item.completesAt === item.scheduledAt) return start;
  const end = new Date(item.completesAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${start} — ${end}`;
}

function schedulePlatformChoices(selection, group) {
  const entries = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled && (entry.category === "self_media" || entry.id === "web"));
  return entries.map((entry) => {
    const platform = entry.id;
    const isWeb = platform === "web";
    const connection = isWeb ? { account: { name: state.site.domain, status: "online" }, status: "online", ready: true } : publisherAccountConnection(group, platform);
    const account = connection.account;
    const available = isWeb || (publisherPlatformSelectable(platform) && connection.ready);
    const selected = (selection.platforms || []).includes(platform) && available;
    const help = isWeb ? "服务器发布" : publisherConnectionMessage(connection);
    return `<label class="platform-choice schedule-platform-choice ${selected ? "selected" : ""} ${available ? "" : "disabled"}"><input class="checkbox" type="checkbox" data-schedule-platform="${platform}" ${selected ? "checked" : ""} ${available ? "" : "disabled"} />${platformLogo(platform)}<span><b>${PLATFORM_META[platform].name}</b><small>${escapeHtml(help)}</small></span>${statusBadge(available ? "online" : connection.status || "needs_login")}</label>`;
  }).join("");
}

function renderScheduleModal() {
  const selection = ui.scheduleSelection || scheduleDefaultSelection([]);
  const selectedArticles = state.articles.filter((article) => (selection.articleIds || []).includes(article.id));
  const eligible = selectedArticles.filter((article) => articleScheduleEligibility(article, selection).ok);
  const excluded = selectedArticles.filter((article) => !articleScheduleEligibility(article, selection).ok);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  const groups = state.accountGroups.map((item) => `<option value="${item.id}" ${item.id === group?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  const capacity = scheduleCapacity(selection, eligible.length);
  const preview = schedulePreviewItems(selection);
  const previewRows = preview.slice(0, 10).map((item) => `<tr><td><b>${item.order}</b></td><td class="schedule-preview-title">${escapeHtml(item.articleTitle)}<small>${escapeHtml(item.articleId)} · ${escapeHtml(item.version)}</small></td><td><span class="schedule-platform-chips">${(item.targetTimes || []).map((target) => `<em>${escapeHtml(PLATFORM_META[target.platform]?.name || target.platform)} ${new Date(target.scheduledAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</em>`).join("")}</span></td><td><b>${scheduleTimeRangeLabel(item)}</b></td></tr>`).join("");
  const days = preview.length ? Math.max(1, Math.ceil((new Date(preview.at(-1).scheduledAt) - new Date(preview[0].scheduledAt)) / 86400000) + 1) : 0;
  const expectedCompletionAt = preview.at(-1)?.completesAt || preview.at(-1)?.scheduledAt || null;
  const orderedPlatforms = selection.platformOrder || selection.platforms || [];
  const orderChips = orderedPlatforms.map((platform, index) => `<span class="schedule-order-chip">${index + 1}. ${escapeHtml(PLATFORM_META[platform]?.name || platform)}<button type="button" data-action="move-schedule-platform" data-platform="${platform}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-schedule-platform" data-platform="${platform}" data-direction="down" ${index === orderedPlatforms.length - 1 ? "disabled" : ""}>↓</button></span>`).join("");
  const excludedHtml = excluded.length ? `<div class="schedule-warning"><span data-icon="alert"></span><span>${excluded.length} 篇不能排期：${excluded.map((article) => `${escapeHtml(article.title)}（${escapeHtml(articleScheduleEligibility(article, selection).reason)}）`).join("、")}</span></div>` : "";
  const requestedDailyLabel = selection.quotaMode === "finishDays" ? `目标 ${Math.max(1, Math.ceil(eligible.length / Math.max(1, Number(selection.finishDays) || 1)))} 篇/天` : `目标 ${Math.max(1, Number(selection.dailyCount) || 1)} 篇/天`;
  const quotaDescription = `${requestedDailyLabel}，实际每天 ${capacity.effectiveDaily || 0} 篇，预计 ${days} 天完成`;
  const capacityWarning = capacity.limited ? `；按 ${capacity.platforms.length} 个平台和 ${capacity.interval} 分钟间隔，每天最多容纳 ${capacity.timeCapacity} 篇` : "";
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">创建定时发布</h2><p>只排期已完成人工审核的文章；文章数按文章计算，平台按顺序逐个执行</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body schedule-modal-body"><section class="schedule-section"><div class="schedule-section-head"><div><h3>发布文章</h3><p>本次选择 ${selectedArticles.length} 篇，可排期 ${eligible.length} 篇</p></div><span class="small-tag blue">${eligible.length} 篇文章</span></div>${excludedHtml}<div class="schedule-article-summary">${eligible.slice(0, 6).map((article) => `<span>${escapeHtml(article.title)}</span>`).join("")}${eligible.length > 6 ? `<span>+${eligible.length - 6} 篇</span>` : ""}</div></section><section class="schedule-section"><div class="schedule-section-head"><div><h3>账号组与平台</h3><p>同一平台只绑定一个本地账号；平台顺序决定助手执行队列</p></div></div><label class="field"><span>发布账号组</span><select class="select" id="schedule-group" data-schedule-group>${groups}</select></label><div class="publish-platforms schedule-platforms">${schedulePlatformChoices(selection, group)}</div><div class="schedule-order-row"><span>执行顺序</span><div class="schedule-order-chips">${orderChips || '<small>请先选择平台</small>'}</div></div></section><section class="schedule-section"><div class="schedule-section-head"><div><h3>排期规则</h3><p>一个平台发送完一篇后等待设定间隔，再发送该平台的下一篇</p></div></div><div class="schedule-mode-tabs"><label class="schedule-mode-card ${selection.quotaMode === "dailyCount" ? "active" : ""}"><input type="radio" name="schedule-quota-mode" data-schedule-quota-mode value="dailyCount" ${selection.quotaMode === "dailyCount" ? "checked" : ""} /><b>按每天数量</b><small>例如每天发布3篇，系统计算完成天数</small></label><label class="schedule-mode-card ${selection.quotaMode === "finishDays" ? "active" : ""}"><input type="radio" name="schedule-quota-mode" data-schedule-quota-mode value="finishDays" ${selection.quotaMode === "finishDays" ? "checked" : ""} /><b>按完成天数</b><small>例如5天完成，系统计算每天数量</small></label></div><div class="field-row schedule-fields"><label class="field"><span>开始日期</span><input class="input" type="date" id="schedule-start-date" value="${escapeHtml(selection.startDate)}" /></label><label class="field"><span>每天开始时间</span><input class="input" type="time" id="schedule-daily-start" value="${escapeHtml(selection.dailyStart)}" /></label><label class="field"><span>每天结束时间</span><input class="input" type="time" id="schedule-daily-end" value="${escapeHtml(selection.dailyEnd)}" /></label><label class="field"><span>文章间隔（分钟）</span><input class="input" type="number" min="5" max="1440" step="5" id="schedule-interval" value="${escapeHtml(selection.intervalMinutes)}" /></label>${selection.quotaMode === "dailyCount" ? `<label class="field"><span>每天发布文章数</span><input class="input" type="number" min="1" max="50" id="schedule-daily-count" value="${escapeHtml(selection.dailyCount)}" /></label>` : `<label class="field"><span>计划完成天数</span><input class="input" type="number" min="1" max="90" id="schedule-finish-days" value="${escapeHtml(selection.finishDays)}" /></label>`}</div><div class="schedule-rule-note"><span data-icon="clock"></span><span>${quotaDescription}${capacityWarning}；如果助手离线，恢复后会按平台顺序继续执行，不会集中补发。</span></div><div class="schedule-completion"><span data-icon="check"></span><div><small>预计完成时间</small><b>${expectedCompletionAt ? escapeHtml(scheduleTimeLabel(expectedCompletionAt)) : "调整规则后计算"}</b></div></div></section><section class="schedule-section schedule-preview-section"><div class="schedule-section-head"><div><h3>发布时间预览</h3><p>每行仍是一篇文章；平台列显示该文章在各平台的执行时间</p></div><span class="small-tag">${preview.length} 篇</span></div>${preview.length ? `<div class="table-scroll"><table class="data-table schedule-preview-table"><thead><tr><th>#</th><th>文章</th><th>平台及时间</th><th>计划时间范围</th></tr></thead><tbody>${previewRows}</tbody></table></div>${preview.length > 10 ? `<small class="schedule-more-note">还有 ${preview.length - 10} 篇文章将在后续日期执行。</small>` : ""}` : '<div class="schedule-empty">请先选择可用平台和文章排期规则。</div>'}</section></div><div class="modal-foot"><span>审核通过后版本会在排期时冻结</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-schedule" ${eligible.length && selection.platforms?.length && preview.length && !ui.submittingSchedule ? "" : "disabled"}>${ui.submittingSchedule ? '<span class="loading-spinner"></span>正在保存' : '<span data-icon="clock"></span>创建排期'}</button></div></div>`, { wide: true });
}

function submitScheduleLegacy() {
  if (ui.submittingSchedule || !ui.scheduleSelection) return;
  const selection = ui.scheduleSelection;
  const articles = scheduleArticles(selection);
  const group = state.accountGroups.find((item) => item.id === selection.groupId);
  const platforms = (selection.platformOrder || selection.platforms || []).filter((platform) => platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform)));
  if (!articles.length) return showToast("没有可排期文章", "请先完成文章人工审核。", "error");
  if (!platforms.length) return showToast("请至少选择一个平台", "平台账号需要在本地助手中登录并保持在线。", "error");
  const preview = schedulePreviewItems({ ...selection, articleIds: articles.map((article) => article.id), platforms, platformOrder: platforms });
  const schedule = {
    id: uid("SCH"),
    businessLineId: activeBusinessLine()?.id || null,
    source: selection.sourcePlanId ? "内容计划" : "文章任务",
    sourcePlanId: selection.sourcePlanId || null,
    articleIds: articles.map((article) => article.id),
    articleVersions: Object.fromEntries(articles.map((article) => [article.id, article.version])),
    articleTitles: Object.fromEntries(articles.map((article) => [article.id, article.title])),
    groupId: group?.id || null,
    groupName: group?.name || "未选择账号组",
    platforms,
    platformOrder: platforms,
    quotaMode: selection.quotaMode,
    dailyCount: Number(selection.dailyCount) || null,
    finishDays: Number(selection.finishDays) || null,
    intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
    startDate: selection.startDate,
    dailyStart: selection.dailyStart,
    dailyEnd: selection.dailyEnd,
    expectedCompletionAt: preview.at(-1)?.completesAt || preview.at(-1)?.scheduledAt || null,
    status: "scheduled",
    createdAt: Date.now(),
    items: preview.map((item) => ({
      ...item,
      status: "waiting",
      targets: (item.targetTimes || []).filter((target) => !articleExistingPublishPlatforms(state.articles.find((article) => article.id === item.articleId)).has(target.platform)).map((target) => ({
        platform: target.platform,
        account: target.platform === "web" ? state.site.domain : publisherAccount(group, target.platform)?.name || "未绑定账号",
        scheduledAt: target.scheduledAt,
        status: "waiting"
      }))
    }))
  };
  ui.submittingSchedule = true;
  renderModal();
  window.setTimeout(() => {
    state.publishSchedules = Array.isArray(state.publishSchedules) ? state.publishSchedules : [];
    state.publishSchedules.unshift(schedule);
    saveState();
    ui.articleSelection = [];
    closeModal();
    ui.publishTab = "all";
    navigate("publish");
    showToast("定时发布排期已创建", `${schedule.articleIds.length} 篇文章将按 ${schedule.platformOrder.map((platform) => PLATFORM_META[platform].name).join(" → ")} 顺序执行。`);
  }, 360);
}

async function submitSchedule() {
  if (!(await ensurePublisherIntegration())) return;
  if (ui.submittingSchedule || !ui.scheduleSelection) return;
  const selection = ui.scheduleSelection;
  const articles = scheduleArticles(selection);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  const platforms = (selection.platformOrder || selection.platforms || []).filter((platform) => platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform)));
  if (!articles.length) return showToast("没有可排期文章", "请先完成文章审核。", "error");
  if (!platforms.length) return showToast("请至少选择一个平台", "平台账号需要在本地发布器中登录。", "error");
  const preview = schedulePreviewItems({ ...selection, articleIds: articles.map((article) => article.id), platforms, platformOrder: platforms });
  const schedule = {
    id: uid("SCH"),
    businessLineId: activeBusinessLine()?.id || null,
    source: selection.sourcePlanId ? "内容计划" : "文章任务",
    sourcePlanId: selection.sourcePlanId || null,
    articleIds: articles.map((article) => article.id),
    articleVersions: Object.fromEntries(articles.map((article) => [article.id, article.version])),
    articleTitles: Object.fromEntries(articles.map((article) => [article.id, article.title])),
    groupId: group?.id || null,
    groupName: group?.name || "未选择账号组",
    platforms,
    platformOrder: platforms,
    quotaMode: selection.quotaMode,
    dailyCount: Number(selection.dailyCount) || null,
    finishDays: Number(selection.finishDays) || null,
    intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
    startDate: selection.startDate,
    dailyStart: selection.dailyStart,
    dailyEnd: selection.dailyEnd,
    expectedCompletionAt: preview.at(-1)?.completesAt || preview.at(-1)?.scheduledAt || null,
    status: "scheduled",
    createdAt: Date.now(),
    remoteJobIds: [],
    items: preview.map((item) => ({
      ...item,
      status: "waiting",
      targets: (item.targetTimes || []).filter((target) => !articleExistingPublishPlatforms(state.articles.find((article) => article.id === item.articleId)).has(target.platform)).map((target) => ({
        platform: target.platform,
        account: target.platform === "web" ? state.site.domain : publisherAccount(group, target.platform)?.name || "未绑定账号",
        scheduledAt: target.scheduledAt,
        status: "waiting",
        remoteJobId: null
      }))
    }))
  };
  ui.submittingSchedule = true;
  renderModal();
  const createdRemoteIds = [];
  try {
    for (const item of schedule.items) {
      const article = state.articles.find((entry) => entry.id === item.articleId);
      if (!article) continue;
      for (const target of item.targets) {
        const result = await publisherApi("/api/publisher/jobs", {
          method: "POST",
          body: {
            articleId: article.id,
            articleTitle: article.title,
            version: article.version,
            article: { id: article.id, title: article.title, version: article.version, excerpt: article.excerpt, content: article.content },
            webUrl: publisherArticleWebUrl(article),
            accountGroupId: group?.id,
            groupName: group?.name,
            platforms: [target.platform],
            platformOrder: [target.platform],
            intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
            mode: "scheduled",
            scheduledAt: target.scheduledAt
          }
        });
        target.remoteJobId = result.job?.id || null;
        if (target.remoteJobId !== null) createdRemoteIds.push(target.remoteJobId);
      }
    }
    if (!createdRemoteIds.length) throw new Error("没有可创建的排期目标，请确认文章和平台尚未存在相同任务。");
    schedule.remoteJobIds = createdRemoteIds;
    state.publishSchedules = Array.isArray(state.publishSchedules) ? state.publishSchedules : [];
    state.publishSchedules.unshift(schedule);
    saveState();
    ui.submittingSchedule = false;
    closeModal();
    await refreshPublisherSnapshot();
    ui.publishTab = "running";
    navigate("publish");
    showToast("定时发布排期已创建", `${schedule.articleIds.length} 篇文章、${createdRemoteIds.length} 个平台目标已按预览时间交给发布器。`);
  } catch (error) {
    await Promise.all(createdRemoteIds.map((id) => publisherApi(`/api/publisher/jobs/${id}/cancel`, { method: "POST" }).catch(() => null)));
    ui.submittingSchedule = false;
    renderModal();
    showToast("排期创建失败", error.message, "error");
  }
}

async function cancelPublishSchedule(scheduleId) {
  const schedule = (state.publishSchedules || []).find((item) => item.id === scheduleId);
  if (!schedule) return;
  if (!(await ensurePublisherIntegration())) return;
  const remoteIds = [...new Set((schedule.items || []).flatMap((item) => (item.targets || []).map((target) => target.remoteJobId).filter(Boolean)))];
  try {
    const results = await Promise.all(remoteIds.map((id) => publisherApi(`/api/publisher/jobs/${id}/cancel`, { method: "POST" })));
    const cancelled = new Set(results.filter((result) => result.job?.status === "cancelled").map((result) => String(result.job.id)));
    (schedule.items || []).forEach((item) => {
      (item.targets || []).forEach((target) => {
        if (cancelled.has(String(target.remoteJobId))) target.status = "cancelled";
      });
      if ((item.targets || []).every((target) => target.status === "cancelled")) item.status = "cancelled";
    });
  } catch (error) {
    return showToast("取消排期失败", error.message || "存在已开始执行的任务，请在任务详情中处理。", "error");
  }
  schedule.status = "cancelled";
  saveState();
  await refreshPublisherSnapshot();
  render();
  showToast("未来排期已取消", "已经执行的发布任务不会被回滚。", "success");
}

function renderPublishSchedules() {
  const schedules = (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled" && (schedule.businessLineId === activeBusinessLine()?.id || !schedule.businessLineId));
  if (!schedules.length) return `<section class="card publish-schedule-empty"><div><span data-icon="clock"></span><div><h3>还没有定时发布排期</h3><p>在文章任务中完成审核后，选择文章即可创建发布节奏。</p></div><button class="secondary-button button-small" type="button" data-nav="content"><span data-icon="file"></span>去文章任务</button></div></section>`;
  const cards = schedules.map((schedule) => {
    const items = schedule.items || [];
    const first = items[0]?.scheduledAt;
    const lastItem = items.at(-1);
    const last = lastItem?.targets?.at(-1)?.scheduledAt || lastItem?.completesAt || lastItem?.scheduledAt;
    const status = schedule.status === "completed" ? '<span class="status-badge status-success">已完成</span>' : schedule.status === "running" ? '<span class="status-badge status-running">执行中</span>' : schedule.status === "partial" ? '<span class="status-badge status-pending">部分完成</span>' : '<span class="status-badge status-queued">已排期</span>';
    const platformChips = (schedule.platformOrder || schedule.platforms || []).map((platform) => `<span>${platformLogo(platform)}${escapeHtml(PLATFORM_META[platform]?.name || platform)}</span>`).join("");
    const rows = items.slice(0, 5).map((item) => `<div class="schedule-item-row"><span class="schedule-item-index">${item.order}</span><span class="schedule-item-title"><b>${escapeHtml(item.articleTitle)}</b><small>${escapeHtml(item.version)}</small></span><span class="schedule-item-time">${scheduleTimeRangeLabel(item)}</span><span class="schedule-item-platforms">${(item.targets || []).map((target) => `<em>${escapeHtml(PLATFORM_META[target.platform]?.name || target.platform)} ${new Date(target.scheduledAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</em>`).join("")}</span>${statusBadge(item.status === "waiting" ? "scheduled" : item.status)}</div>`).join("");
    return `<article class="card publish-schedule-card"><div class="publish-schedule-head"><div><div class="publish-schedule-title"><h3>${escapeHtml(schedule.source === "内容计划" ? "内容计划发布排期" : "文章批量发布排期")}</h3>${status}</div><p>${escapeHtml(schedule.id)} · ${escapeHtml(schedule.groupName)} · ${schedule.articleIds.length} 篇文章 · 每篇间隔 ${schedule.intervalMinutes} 分钟</p></div><div class="publish-schedule-actions">${schedule.status !== "cancelled" ? `<button class="link-button" type="button" data-action="cancel-schedule" data-schedule-id="${schedule.id}">取消未来排期</button>` : ""}</div></div><div class="publish-schedule-meta"><span><b>执行顺序</b>${platformChips}</span><span><b>时间范围</b>${escapeHtml(scheduleTimeLabel(first))} — ${escapeHtml(scheduleTimeLabel(last))}</span><span class="publish-completion-time"><b>预计完成时间</b>${escapeHtml(scheduleTimeLabel(schedule.expectedCompletionAt || last))}</span></div><div class="schedule-item-list">${rows}</div>${items.length > 5 ? `<small class="schedule-more-note">还有 ${items.length - 5} 篇文章在后续执行。</small>` : ""}</article>`;
  }).join("");
  return `<section class="publish-schedules"><div class="section-heading"><div><h2>定时发布排期</h2><p>文章任务完成审核后创建；实际执行由本地助手按平台顺序领取。</p></div><span class="small-tag blue">${schedules.filter((schedule) => schedule.status !== "cancelled").length} 个有效排期</span></div>${cards}</section>`;
}

function refreshAfterTaskUpdate(task) {
  task.status = taskAggregateStatus(task);
  if (task.status === "success") {
    const article = state.articles.find((item) => item.id === task.articleId);
    if (article) {
      article.status = "published";
      article.updatedAt = Date.now();
    }
    if (ui.route === "publish" && ui.publishTab === "running") ui.publishTab = "all";
  }
  saveState();
  render();
  if (ui.modal?.type === "task" && ui.modal.taskId === task.id) renderModal();
}

function simulateTask(taskId) {
  if (simulationTimers.has(taskId)) return;
  const task = state.publishTasks.find((item) => item.id === taskId);
  if (!task) return;
  const timers = [];
  const pendingPlatforms = Object.entries(task.targets).filter(([, target]) => ["queued", "running"].includes(target.status));
  pendingPlatforms.forEach(([platform, target], index) => {
    if (target.status === "queued") {
      timers.push(window.setTimeout(() => {
        const currentTask = state.publishTasks.find((item) => item.id === taskId);
        if (!currentTask || currentTask.targets[platform].status !== "queued") return;
        currentTask.targets[platform].status = "running";
        currentTask.targets[platform].updatedAt = Date.now();
        currentTask.logs.push({ time: "刚刚", platform: PLATFORM_META[platform].name, message: platform === "web" ? "正在生成官网页面与结构化数据" : "本地助手已领取任务，正在打开发布页面" });
        refreshAfterTaskUpdate(currentTask);
      }, 380 + index * 260));
    }
    timers.push(window.setTimeout(() => {
      const currentTask = state.publishTasks.find((item) => item.id === taskId);
      if (!currentTask || !["queued", "running"].includes(currentTask.targets[platform].status)) return;
      currentTask.targets[platform].status = "success";
      currentTask.targets[platform].updatedAt = Date.now();
      currentTask.targets[platform].remoteUrl = "https://demo.tongzhuo.local/" + platform + "/" + currentTask.articleId.toLowerCase();
      currentTask.targets[platform].message = "";
      currentTask.logs.push({ time: "刚刚", platform: PLATFORM_META[platform].name, message: "发布成功，已回写远端文章地址" });
      refreshAfterTaskUpdate(currentTask);
      if (currentTask.status === "success") showToast("多平台发布完成", "所有目标均已返回成功结果。");
    }, 1350 + index * 680));
  });
  const cleanup = window.setTimeout(() => simulationTimers.delete(taskId), 1600 + pendingPlatforms.length * 720);
  timers.push(cleanup);
  simulationTimers.set(taskId, timers);
}

function renderTaskModal() {
  const task = state.publishTasks.find((item) => item.id === ui.modal.taskId);
  if (!task) return "";
  const targetRows = Object.entries(task.targets).map(([platform, target]) => `
    <div class="platform-choice">
      <span></span>${platformLogo(platform)}
      <span><b>${PLATFORM_META[platform].name}</b><small>${escapeHtml(target.account)}${target.remoteUrl ? " · 已返回页面地址" : ""}${target.message ? " · " + escapeHtml(target.message) : ""}</small></span>
      ${statusBadge(target.status)}
    </div>
  `).join("");
  const logs = task.logs.slice().reverse().map((log) => '<div class="log-item"><span>' + escapeHtml(log.time) + "</span><b>" + escapeHtml(log.platform) + "</b><span>" + escapeHtml(log.message) + "</span></div>").join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">发布任务详情</h2><p>${escapeHtml(task.id)} · ${escapeHtml(task.version)} · ${escapeHtml(task.groupName)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="publish-article"><b>${escapeHtml(task.articleTitle)}</b><span>各平台结果独立记录；草稿、验证码、审核或失败都不会自动记为“已发布”。</span></div>
      <div class="publish-platforms">${targetRows}</div>
      <h3 style="margin:20px 0 6px;font-size:13px">执行日志</h3>
      <div class="log-list">${logs}</div>
    </div>
    <div class="modal-foot"><span>任务状态：${STATUS_META[task.status]?.[0] || task.status}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button></div></div>
  `, { wide: true });
}

function renderSearchModal() {
  return modalChrome(`
    <div class="search-box"><span data-icon="search"></span><input id="command-input" value="${escapeHtml(ui.commandQuery)}" placeholder="搜索页面或操作…" autocomplete="off" /></div>
    <div class="command-list" id="command-list">${commandResultsHtml()}</div>
  `);
}

function commandResultsHtml() {
  const commands = [
    { route: "planning", icon: "sparkle", title: "选题中心", description: "维护关键词、问题词库、选题库和内容计划", keys: "选题中心 关键词 问题 内容计划" },
    { route: "content", icon: "file", title: "内容生产", description: "打开文章列表与审核工作流", keys: "文章 审核 写作" },
    { action: "publish-approved", icon: "send", title: "发布已通过文章", description: "选择账号组与发布平台", keys: "发布 微信 知乎 头条" },
    { route: "assets", icon: "folder", title: "内容资产", description: "管理文章版本、官网信源与多平台分发关系", keys: "资产 版本 信源 引用 内容" },
    { route: "monitoring", icon: "chart", title: "效果监测", description: "查看品牌提及、推荐与官网引用证据", keys: "监测 提及 引用 AI" },
    { route: "knowledge", icon: "book", title: "企业知识", description: "管理产品、案例、FAQ 与资料", keys: "企业资料 知识库" },
    { route: "assistant", icon: "monitor", title: "发布助手", description: "查看设备和平台账号状态", keys: "设备 账号组 登录" },
    { route: "site", icon: "globe", title: "官网运营", description: "预览官网、管理线索与站点设置", keys: "网站 官网 诊断" }
  ];
  const query = ui.commandQuery.trim().toLowerCase();
  const filtered = commands.filter((command) => !query || (command.title + command.description + command.keys).toLowerCase().includes(query));
  if (!filtered.length) return '<div class="empty-state" style="min-height:160px"><div><span data-icon="search"></span><h3>没有匹配结果</h3><p>换一个关键词试试。</p></div></div>';
  return filtered.map((command) => `
    <button class="command-item" type="button" data-command-route="${command.route || ""}" data-command-action="${command.action || ""}">
      <span data-icon="${command.icon}"></span><span><b>${command.title}</b><small>${command.description}</small></span><kbd>↵</kbd>
    </button>
  `).join("");
}

function renderNotificationsModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">通知</h2><p>1 条需要处理的运营消息</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <button class="todo-item" type="button" data-action="notification-task" style="width:100%">
        <span class="todo-icon red" data-icon="alert"></span><span class="todo-copy"><strong>头条号发布结果待核验</strong><span>平台提交后连接中断，为避免重复发文，任务已暂停自动重试。</span></span><span class="todo-meta"><i class="todo-arrow">›</i></span>
      </button>
      <div class="todo-item"><span class="todo-icon" data-icon="check"></span><span class="todo-copy"><strong>企业知识同步完成</strong><span>36 份资料已完成更新，可用于内容生成。</span></span><span class="todo-meta"><small>1小时前</small></span></div>
    </div>
  `);
}

function renderPairModalLegacy() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配对本地发布助手</h2><p>配对码 10 分钟内有效</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body" style="text-align:center">
      <span class="device-icon" style="margin:0 auto 14px" data-icon="monitor"></span>
      <p style="margin:0;color:var(--muted)">在客户电脑打开桐灼 GEO 发布节点，在“绑定节点”中输入：</p>
      <div style="margin:18px auto;padding:15px;border:1px dashed #9db5dc;border-radius:12px;background:#f7faff;color:var(--blue);font-size:28px;font-weight:800;letter-spacing:6px">TZ-482916</div>
      <div class="security-inline" style="text-align:left"><span data-icon="lock"></span><span>配对只建立设备令牌。平台登录态与账号资料不会通过配对上传服务器。</span></div>
    </div>
    <div class="modal-foot"><span>等待本地助手连接…</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">完成</button></div></div>
  `);
}

function renderPairModal() {
  const code = ui.pairingCode || "正在生成配对码…";
  const expires = ui.pairingExpiresAt ? new Date(ui.pairingExpiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "10分钟内有效";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配对本地 GEO 发布器</h2><p>将当前客户后台与 Windows 桌面软件连接</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body" style="text-align:center">
      <span class="device-icon" style="margin:0 auto 14px" data-icon="monitor"></span>
      <p style="margin:0;color:var(--muted)">在桌面发布器的“绑定节点”中填写当前后台地址和下面的配对码。</p>
      <div style="margin:18px auto;padding:15px;border:1px dashed #9db5dc;border-radius:12px;background:#f7faff;color:var(--blue);font-size:28px;font-weight:800;letter-spacing:4px">${escapeHtml(code)}</div>
      <p style="margin:0;color:var(--muted);font-size:12px">${escapeHtml(expires)}</p>
      <div class="security-inline" style="text-align:left"><span data-icon="lock"></span><span>配对只建立设备令牌。平台密码、Cookie、验证码和浏览器 Profile 只保存在客户电脑。</span></div>
    </div>
    <div class="modal-foot"><span>桌面软件完成绑定后会显示在线</span><div class="modal-foot-right"><button class="secondary-button" data-action="refresh-publisher"><span data-icon="refresh"></span>刷新状态</button><button class="secondary-button" data-action="close-modal">完成</button></div></div>
  `);
}

async function issuePublisherPairing() {
  try {
    ui.pairingCode = null;
    ui.pairingExpiresAt = null;
    renderModal();
    const result = await publisherApi("/api/publisher/pairings", { method: "POST", body: {} });
    ui.pairingCode = result.pairing?.code || "";
    ui.pairingExpiresAt = result.pairing?.expiresAt || null;
    renderModal();
  } catch (error) {
    showToast("配对码生成失败", error.message, "error");
  }
}

function legacyKnowledgeDefinition(type) {
  return {
    products: { name: "产品服务", label: "产品 / 服务（每行一条）", help: "用于统一产品名称、服务内容与交付边界。" },
    cases: { name: "案例资质", label: "案例 / 资质（每行一条）", help: "只填写已脱敏且允许对外使用的案例和资质。" },
    faq: { name: "常见问题", label: "标准问答（每行一条）", help: "建议使用“问题｜企业标准答案”的格式。" },
    documents: { name: "知识资料", label: "资料清单（每行一条）", help: "记录资料名称、来源或用途；正文仍在文档知识库中维护版本。" },
    images: { name: "图片素材", label: "图片素材（每行一条）", help: "建议使用“素材名｜版权来源｜ALT 文本”的格式。" },
    adLaw: { name: "广告法词库", label: "合规规则（每行一条）", help: "命中后进入内容风控，不作为企业事实参与 RAG。" },
    sensitive: { name: "企业敏感词", label: "敏感规则（每行一条）", help: "记录需要人工复核的行业词、内部信息或披露边界。" },
    banned: { name: "禁用表述", label: "禁用表述（每行一条）", help: "命中后阻止文章审核通过，修改正文后才可继续。" }
  }[type] || { name: "企业知识", label: "内容（每行一条）", help: "保存后会记录更新时间并在此处回显。" };
}

function legacyKnowledgeDefaultContent(type) {
  const itemText = (item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    return item.kind === "qa" ? `${item.question || item.title}｜${version?.content || ""}` : `${item.title}｜${version?.content || ""}`;
  };
  if (type === "products") return (state.knowledgeItems || []).filter((item) => ["产品服务", "交付规范"].includes(item.category)).map(itemText).join("\n");
  if (type === "cases") return (state.knowledgeItems || []).filter((item) => item.category === "案例").map(itemText).join("\n");
  if (type === "faq") return (state.knowledgeItems || []).filter((item) => item.kind === "qa").map(itemText).join("\n");
  if (type === "documents") return (state.knowledgeItems || []).filter((item) => item.kind !== "qa").map(itemText).join("\n");
  if (type === "images") return (state.contentAssets || []).filter((asset) => asset.kind === "knowledge_image").map((asset) => `${asset.name}｜${asset.license || "来源待确认"}｜${asset.altText || asset.caption || ""}`).join("\n");
  if (type === "adLaw") return "禁止使用“国家级”“最高级”“最佳”等无法证明的绝对化用语\n效果、排名、收录和增长结论必须说明条件与证据\n涉及客户成果时必须使用已审核案例且保留适用边界";
  if (type === "sensitive") return "客户名称、合同金额和未公开经营数据需人工复核\n内部账号、Cookie、验证码和服务器凭据不得进入对外内容\n未公开产品参数与路线图不得对外披露";
  if (type === "banned") return "保证固定排名\n保证被 AI 收录或引用\n无需任何企业资料即可产生效果";
  return "";
}

function renderKnowledgeModal() {
  const type = ui.modal.knowledgeType || "products";
  const definition = legacyKnowledgeDefinition(type);
  const record = state.knowledge[type] || { count: 0, reviewed: 0, updated: "尚未维护" };
  const content = record.content === undefined ? legacyKnowledgeDefaultContent(type) : record.content;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">管理${escapeHtml(definition.name)}</h2><p>保存后立即写入当前客户空间，并在企业知识页回显</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="side-panel"><h4>统一事实原则</h4><p>${escapeHtml(definition.help)} 已审核企业事实供官网、文章和发布引用；内容规则只参与风险检查。</p></div>
      <div class="field" style="margin-top:14px"><label for="legacy-knowledge-name">卡片名称</label><input class="input" id="legacy-knowledge-name" value="${escapeHtml(record.name || definition.name)}" /></div>
      <div class="field" style="margin-top:12px"><label for="legacy-knowledge-content">${escapeHtml(definition.label)}</label><textarea class="textarea" id="legacy-knowledge-content" style="min-height:240px" placeholder="每行填写一条内容">${escapeHtml(content)}</textarea><small>${escapeHtml(definition.help)}</small></div>
    </div>
    <div class="modal-foot"><span>当前记录：${Number(record.count) || 0} 条 · ${escapeHtml(record.updated || "尚未维护")}</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="save-knowledge" data-knowledge="${escapeHtml(type)}"><span data-icon="check"></span>保存并回显</button></div></div>
  `, { wide: true });
}

function legacyKnowledgeBaseForType(type) {
  const lineId = activeBusinessLine()?.id;
  const activeBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived");
  if (type === "faq") return activeBases.find((base) => base.kind === "qa" && (!base.businessLineId || base.businessLineId === lineId)) || activeBases.find((base) => base.kind === "qa") || null;
  if (type === "cases") return activeBases.find((base) => base.kind === "document" && /案例|资质/.test(base.name) && (!base.businessLineId || base.businessLineId === lineId)) || activeBases.find((base) => base.kind === "document" && /案例|资质/.test(base.name)) || null;
  return activeBases.find((base) => base.kind === "document" && base.businessLineId === lineId) || activeBases.find((base) => base.kind === "document" && base.scope === "enterprise") || activeBases.find((base) => base.kind === "document") || null;
}

function syncLegacyCardToKnowledgeItem(type, name, content) {
  const base = legacyKnowledgeBaseForType(type);
  if (!base) return null;
  const now = Date.now();
  let item = (state.knowledgeItems || []).find((entry) => entry.legacyCardKey === type);
  const current = item && knowledgeVersionById(item.latestVersionId);
  const nextNumber = Number(current?.version || 0) + 1;
  const itemId = item?.id || uid("KI-CARD");
  const versionId = uid("KV-CARD") + "-V" + nextNumber;
  const version = {
    id: versionId,
    itemId,
    version: nextNumber,
    reviewStatus: "pending_review",
    reviewedBy: null,
    reviewedAt: null,
    content,
    sourceName: `结构化资料卡 · ${name}`,
    locator: name,
    chunks: [{ id: uid("KC"), section: name, text: content }],
    createdAt: now,
    supersedesVersionId: current?.id || null
  };
  state.knowledgeVersions.push(version);
  if (!item) {
    item = {
      id: itemId,
      legacyCardKey: type,
      knowledgeBaseId: base.id,
      kind: base.kind,
      title: name,
      question: base.kind === "qa" ? `${name}有哪些企业标准回答？` : undefined,
      category: type === "products" ? "产品服务" : type === "cases" ? "案例" : type === "faq" ? "FAQ" : "企业资料",
      status: "pending_review",
      visibility: "public",
      sourceName: version.sourceName,
      locator: name,
      latestVersionId: versionId,
      tags: ["结构化资料"],
      createdAt: now,
      updatedAt: now
    };
    state.knowledgeItems.push(item);
  } else {
    item.knowledgeBaseId = base.id;
    item.kind = base.kind;
    item.title = name;
    if (base.kind === "qa") item.question = item.question || `${name}有哪些企业标准回答？`;
    item.status = "pending_review";
    item.sourceName = version.sourceName;
    item.locator = name;
    item.latestVersionId = versionId;
    item.updatedAt = now;
  }
  base.itemIds = [...new Set([...(base.itemIds || []), item.id])];
  base.updatedAt = now;
  return item;
}

function syncLegacyKnowledgeImages(entries) {
  const base = legacyKnowledgeBaseForType("documents");
  if (!base) return [];
  const existing = (state.contentAssets || []).filter((asset) => asset.legacyImageCard === true);
  const activeKeys = new Set();
  const assets = entries.map((entry, index) => {
    const [rawName, rawLicense, rawAlt] = String(entry).split(/[｜|]/).map((part) => part.trim());
    const name = rawName || `知识图片 ${index + 1}`;
    const key = name.toLowerCase();
    activeKeys.add(key);
    const asset = existing.find((item) => item.legacyImageKey === key) || { id: uid("ASSET-KB"), createdAt: Date.now() };
    Object.assign(asset, {
      legacyImageCard: true,
      legacyImageKey: key,
      kind: "knowledge_image",
      name,
      mime: asset.mime || "image/*",
      knowledgeBaseId: base.id,
      reviewStatus: "approved",
      reviewedBy: "王宁",
      reviewedAt: new Date().toISOString(),
      license: rawLicense || "企业自有 · 已确认",
      altText: rawAlt || name,
      caption: rawAlt || name,
      accent: asset.accent || ["blue", "teal", "violet", "amber"][index % 4],
      archived: false,
      updatedAt: Date.now()
    });
    if (!state.contentAssets.includes(asset)) state.contentAssets.push(asset);
    return asset;
  });
  existing.filter((asset) => !activeKeys.has(asset.legacyImageKey)).forEach((asset) => { asset.archived = true; asset.updatedAt = Date.now(); });
  return assets;
}

function saveLegacyKnowledge(type) {
  const key = type || ui.modal?.knowledgeType;
  const definition = legacyKnowledgeDefinition(key);
  const nameInput = document.getElementById("legacy-knowledge-name");
  const contentInput = document.getElementById("legacy-knowledge-content");
  const name = nameInput?.value.trim() || definition.name;
  const content = contentInput?.value.trim() || "";
  if (!content) {
    contentInput?.classList.add("input-error");
    contentInput?.focus();
    return showToast("内容不能为空", "请至少保留一条可审核的知识或规则。", "error");
  }
  const entries = content.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  state.knowledge = state.knowledge || {};
  const previous = state.knowledge[key] || {};
  state.knowledge[key] = {
    ...previous,
    name,
    content,
    entries,
    count: entries.length,
    reviewed: ["products", "cases", "faq", "documents"].includes(key) ? 0 : entries.length,
    updated: new Date().toLocaleString("zh-CN", { hour12: false }),
    updatedAt: new Date().toISOString(),
    version: Number(previous.version || 0) + 1
  };
  if (["products", "cases", "faq", "documents"].includes(key)) {
    const item = syncLegacyCardToKnowledgeItem(key, name, content);
    if (item) addOperationLog("企业知识", `更新结构化资料「${name}」，新版本已进入待审核区`);
  }
  if (key === "images") {
    const assets = syncLegacyKnowledgeImages(entries);
    addOperationLog("企业知识", `更新知识图片素材 ${assets.length} 条`);
  }
  if (["adLaw", "sensitive", "banned"].includes(key)) {
    state.articles.forEach((article) => {
      if (article.status === "published") return;
      article.riskStatus = article.riskStatus === "blocked" || article.riskStatus === "warning" ? article.riskStatus : "stale";
      article.riskScan = null;
    });
    addOperationLog("内容风控", `更新「${name}」规则，未发布文章需重新检测`);
  }
  saveState();
  closeModal();
  render();
  const pendingReview = ["products", "cases", "faq", "documents"].includes(key);
  showToast(pendingReview ? "资料已保存待审核" : "知识已保存", pendingReview ? `「${name}」已创建待审核知识版本，审核通过后进入后续文章生成。` : `已保存「${name}」的 ${entries.length} 条内容，并在对应业务功能中生效。`);
}

function renderImportKnowledgeModal() {
  const bases = (state.knowledgeBases || []).filter((base) => base.kind === "document" && base.status !== "archived");
  const options = bases.map((base) => `<option value="${base.id}">${escapeHtml(base.name)} · ${escapeHtml(knowledgeScopeLabel(base))}</option>`).join("");
  if (!bases.length) {
    return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">导入资料</h2><p>需要先创建一个文档知识库承接资料</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="empty-state"><div><span data-icon="book"></span><h3>暂无文档知识库</h3><p>先新建文档库，再导入 PDF、Word、Markdown 或文本资料。</p><button class="primary-button button-small" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button></div></div></div>`, { wide: true });
  }
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">导入企业资料</h2><p>文件先进入待审核区，审核通过后才参与 RAG 与文章创作</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="knowledge-import-base">导入到 *</label><select class="select" id="knowledge-import-base">${options}</select></div>
      <div class="field" style="margin-top:14px"><label for="knowledge-import-file">选择资料文件 *</label><input class="input" id="knowledge-import-file" type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.html,.htm,.json,.xml" /><small>文本、Markdown、CSV、HTML、JSON、XML 会在浏览器中提取文字；PDF / Word 在正式部署时由服务器解析。</small></div>
      <div class="field" style="margin-top:14px"><label for="knowledge-import-content">正文或关键摘录（PDF / Word 建议填写）</label><textarea class="textarea" id="knowledge-import-content" rows="8" placeholder="可粘贴资料正文或关键摘录。若是文本类文件，可留空由系统读取。"></textarea></div>
      <div class="privacy-note" style="margin-top:14px"><span data-icon="lock"></span><span>演示版不把原始文件写入浏览器存储，只保存文件名、类型、大小和可读取的文字；正式私有化部署时原文件应保存到客户服务器对象存储。</span></div>
    </div>
    <div class="modal-foot"><span>导入后需人工核对来源、正文和公开范围</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-import"><span data-icon="upload"></span>导入待审核</button></div></div>
  `, { wide: true });
}

function renderCreateKnowledgeBaseModal() {
  const lineOptions = state.businessLines.filter((line) => line.status === "active").map((line) => '<option value="' + line.id + '" ' + (line.id === ui.selectedBusinessLineId ? "selected" : "") + '>' + escapeHtml(line.name) + "</option>").join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">新建知识库</h2><p>先按内容形态分为文档库或问答库，索引策略统一由系统管理</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="knowledge-type-picker">
        <label><input type="radio" name="knowledge-kind" value="document" checked /><span class="knowledge-icon" data-icon="book"></span><b>文档库</b><small>PDF、Word、网页、产品资料、案例等长资料</small></label>
        <label><input type="radio" name="knowledge-kind" value="qa" /><span class="knowledge-icon purple" data-icon="help"></span><b>问答库</b><small>标准问题、官方答案、异议处理和服务边界</small></label>
      </div>
      <div class="field" style="margin-top:16px"><label for="knowledge-base-name">知识库名称 *</label><input class="input" id="knowledge-base-name" placeholder="例如：GEO 产品资料库" autocomplete="off" /></div>
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="knowledge-base-scope">使用范围</label><select class="select" id="knowledge-base-scope"><option value="business_line">业务线专用</option><option value="enterprise">全企业共享</option></select></div><div class="field"><label for="knowledge-base-line">所属业务线</label><select class="select" id="knowledge-base-line">${lineOptions}</select></div></div>
      <div class="field" style="margin-top:13px"><label for="knowledge-base-description">用途说明</label><textarea class="textarea" id="knowledge-base-description" rows="3" placeholder="说明这里存放什么，以及允许哪些内容任务使用"></textarea></div>
      <div class="privacy-note"><span data-icon="database"></span><span><b>正式部署索引：RAG</b><br />当前演示按知识条目与版本检索；正式私有化部署时由系统管理员配置向量库、分块、重排和索引任务。</span></div>
    </div>
    <div class="modal-foot"><span>新建后可继续添加文档或标准问答</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-base"><span data-icon="plus"></span>创建知识库</button></div></div>
  `, { wide: true });
}

function renderKnowledgeBaseDetailModal() {
  const base = knowledgeBaseById(ui.modal.baseId);
  if (!base) return "";
  const items = knowledgeBaseItems(base.id);
  const rows = items.map((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const approved = item.status === "approved" && version?.reviewStatus === "approved";
    return `<tr><td class="article-title-cell"><b>${escapeHtml(item.title || item.question)}</b><small>${escapeHtml(knowledgeSourceLabel(item, version))} · ${escapeHtml(knowledgeLocator(item, version))}</small></td><td>v${escapeHtml(version?.version || "1")}</td><td><span class="small-tag">${escapeHtml(item.visibility === "internal" ? "仅内部" : "可对外")}</span></td><td>${approved ? '<span class="status-badge status-approved">可用于写作</span>' : '<span class="status-badge status-review">待审核</span>'}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="open-knowledge-item" data-item-id="${item.id}">${approved ? "查看 / 编辑" : "查看草稿"}</button>${approved ? "" : '<button class="link-button" type="button" data-action="approve-knowledge-item" data-item-id="' + item.id + '">审核通过</button>'}</div></td></tr>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(base.name)}</h2><p>${knowledgeKindLabel(base.kind)} · ${escapeHtml(knowledgeScopeLabel(base))} · RAG 索引${base.status === "ready" ? "就绪" : "处理中"}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="knowledge-detail-summary"><div><span>全部知识</span><b>${items.length}</b></div><div><span>已审核可用</span><b>${approvedKnowledgeItems(base.id).length}</b></div><div><span>待审核</span><b>${items.filter((item) => item.status !== "approved").length}</b></div><div><span>最近索引</span><b>${escapeHtml(base.updatedAt ? formatRelative(base.updatedAt) : "刚刚")}</b></div></div>
      <div class="card-header inline-head"><div><h3>知识条目</h3><p>${escapeHtml(base.description || "")}</p></div><button class="primary-button button-small" type="button" data-action="add-knowledge-item" data-base-id="${base.id}"><span data-icon="plus"></span>${base.kind === "qa" ? "新增问答" : "新增资料"}</button></div>
      ${rows ? '<div class="table-scroll knowledge-detail-table"><table class="data-table"><thead><tr><th>资料 / 问题</th><th>版本</th><th>公开范围</th><th>写作状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state"><div><span data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span><h3>这个知识库还是空的</h3><p>添加第一条知识，审核通过后才会参与文章生成。</p><button class="primary-button button-small" type="button" data-action="add-knowledge-item" data-base-id="' + base.id + '"><span data-icon="plus"></span>添加知识</button></div></div>'}
    </div>
    <div class="modal-foot"><span>历史文章始终保留生成时引用的知识版本</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>
  `, { wide: true });
}

function renderKnowledgeItemModal() {
  const base = knowledgeBaseById(ui.modal.baseId || knowledgeItemById(ui.modal.itemId)?.knowledgeBaseId);
  const item = knowledgeItemById(ui.modal.itemId);
  if (!base) return "";
  const version = item ? knowledgeVersionById(item.latestVersionId) : null;
  if (item && ui.modal.edit) {
    return modalChrome(`
      <div class="modal-head"><div><h2 id="modal-title">编辑知识并新建版本</h2><p>${escapeHtml(base.name)} · 当前 v${escapeHtml(version?.version || "1")} 会保留给历史文章引用</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="关闭"><span data-icon="x"></span></button></div>
      <div class="modal-body">
        ${base.kind === "qa" ? `<div class="field"><label for="knowledge-item-question">标准问题 *</label><input class="input" id="knowledge-item-question" value="${escapeHtml(item.question || item.title)}" /></div>` : `<div class="field"><label for="knowledge-item-title">资料标题 *</label><input class="input" id="knowledge-item-title" value="${escapeHtml(item.title)}" /></div>`}
        <div class="field" style="margin-top:13px"><label for="knowledge-item-content">${base.kind === "qa" ? "企业标准答案 *" : "资料原文 *"}</label><textarea class="textarea" id="knowledge-item-content" rows="8">${escapeHtml(version?.content || item.content || "")}</textarea></div>
        <div class="field-row" style="margin-top:13px"><div class="field"><label for="knowledge-item-source">来源文件 / URL</label><input class="input" id="knowledge-item-source" value="${escapeHtml(knowledgeSourceLabel(item, version))}" /></div><div class="field"><label for="knowledge-item-locator">页码 / 章节</label><input class="input" id="knowledge-item-locator" value="${escapeHtml(knowledgeLocator(item, version))}" /></div></div>
        <div class="field" style="margin-top:13px"><label for="knowledge-item-visibility">对外范围</label><select class="select" id="knowledge-item-visibility"><option value="public" ${item.visibility !== "internal" ? "selected" : ""}>可用于对外内容</option><option value="internal" ${item.visibility === "internal" ? "selected" : ""}>仅内部参考</option></select></div>
        <div class="privacy-note"><span data-icon="history"></span><span>保存后会生成待审核的新版本；审核期间该条目暂停进入新的 RAG 任务。历史计划和文章仍引用原来的已冻结版本。</span></div>
      </div>
      <div class="modal-foot"><span>新版本需人工审核通过后才重新进入 RAG</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">取消</button><button class="primary-button" type="button" data-action="save-knowledge-item-edit" data-item-id="${item.id}"><span data-icon="check"></span>保存新版本并提交审核</button></div></div>
    `, { wide: true });
  }
  if (item) {
    return modalChrome(`
      <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(item.title || item.question)}</h2><p>${escapeHtml(base.name)} · v${escapeHtml(version?.version || "1")} · ${escapeHtml(knowledgeLocator(item, version))}</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="返回"><span data-icon="x"></span></button></div>
      <div class="modal-body"><div class="source-document"><span>${base.kind === "qa" ? "企业标准答案" : "知识原文"}</span>${item.question ? '<h3>问：' + escapeHtml(item.question) + '</h3>' : ""}<p>${escapeHtml(version?.content || item.content || "暂无正文")}</p></div><div class="side-list" style="margin-top:14px"><div><span>来源</span><b>${escapeHtml(knowledgeSourceLabel(item, version))}</b></div><div><span>定位</span><b>${escapeHtml(knowledgeLocator(item, version))}</b></div><div><span>审核状态</span><b>${version?.reviewStatus === "approved" ? "已审核" : "待审核"}</b></div><div><span>对外范围</span><b>${item.visibility === "internal" ? "仅内部" : "可对外"}</b></div></div></div>
      <div class="modal-foot"><span>查看的是当前知识版本，文章引用会另外冻结</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="edit-knowledge-item" data-item-id="${item.id}"><span data-icon="edit"></span>编辑并新建版本</button><button class="primary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">返回知识库</button></div></div>
    `);
  }
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${base.kind === "qa" ? "新增标准问答" : "新增文档知识"}</h2><p>${escapeHtml(base.name)} · 新知识默认进入待审核</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${base.kind === "qa" ? '<div class="field"><label for="knowledge-item-question">标准问题 *</label><input class="input" id="knowledge-item-question" placeholder="例如：GEO 服务从哪里开始？" /></div><div class="field" style="margin-top:13px"><label for="knowledge-item-content">企业标准答案 *</label><textarea class="textarea" id="knowledge-item-content" rows="7" placeholder="只填写企业确认、允许使用的回答"></textarea></div>' : '<div class="field"><label for="knowledge-item-title">资料标题 *</label><input class="input" id="knowledge-item-title" placeholder="例如：GEO 服务交付说明" /></div><div class="field" style="margin-top:13px"><label for="knowledge-item-content">资料原文 *</label><textarea class="textarea" id="knowledge-item-content" rows="7" placeholder="粘贴已确认的产品、服务、案例或流程资料"></textarea></div>'}
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="knowledge-item-source">来源文件 / URL</label><input class="input" id="knowledge-item-source" placeholder="方案.pdf 或 https://..." /></div><div class="field"><label for="knowledge-item-locator">页码 / 章节</label><input class="input" id="knowledge-item-locator" placeholder="第 6 页 / 标准答案" /></div></div>
      <div class="field" style="margin-top:13px"><label for="knowledge-item-visibility">对外范围</label><select class="select" id="knowledge-item-visibility"><option value="public">可用于对外内容</option><option value="internal">仅内部参考</option></select></div>
      <div class="privacy-note"><span data-icon="clock"></span><span>保存后状态为“待审核”。只有人工审核通过的版本才进入 RAG 检索和文章生成。</span></div>
    </div>
    <div class="modal-foot"><span>知识正文后续修改会产生新版本</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-item" data-base-id="${base.id}"><span data-icon="check"></span>保存并提交审核</button></div></div>
  `, { wide: true });
}

function renderKnowledgePackageModal() {
  const line = state.businessLines.find((item) => item.id === ui.modal.lineId);
  if (!line) return "";
  const publicBases = (state.knowledgeBases || []).filter((base) => base.scope === "enterprise" && base.status !== "archived");
  const selectable = (state.knowledgeBases || []).filter((base) => base.scope !== "enterprise" && base.status !== "archived" && (!base.businessLineId || base.businessLineId === line.id));
  const publicRows = publicBases.map((base) => '<label class="knowledge-check-row locked"><input type="checkbox" checked disabled /><span class="knowledge-check-icon" data-icon="globe"></span><span><b>' + escapeHtml(base.name) + '</b><small>企业公共知识 · 自动继承 · ' + approvedKnowledgeItems(base.id).length + ' 条可用</small></span><em>固定</em></label>').join("");
  const rows = selectable.map((base) => '<label class="knowledge-check-row"><input class="checkbox" type="checkbox" data-package-base value="' + base.id + '" ' + ((line.knowledgeBaseIds || []).includes(base.id) ? "checked" : "") + ' /><span class="knowledge-check-icon" data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span><span><b>' + escapeHtml(base.name) + '</b><small>' + knowledgeKindLabel(base.kind) + ' · ' + approvedKnowledgeItems(base.id).length + ' 条可用于写作</small></span><em>' + escapeHtml(knowledgeScopeLabel(base)) + '</em></label>').join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配置业务线知识包</h2><p>${escapeHtml(line.name)} · 新内容计划默认继承这里的选择</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="knowledge-scope-block"><h3>企业公共知识</h3><p>由系统自动加入，业务线不能排除。</p>${publicRows}</div><div class="knowledge-scope-block"><h3>业务线默认知识库</h3><p>只显示归属当前业务线的知识库，避免跨业务线调用错误资料。</p>${rows || '<div class="empty-state compact"><div><span data-icon="book"></span><h3>没有可绑定的专属知识库</h3><p>请先创建属于这条业务线的文档库或问答库。</p></div></div>'}</div><div class="privacy-note"><span data-icon="history"></span><span>修改默认知识包只影响以后新建的内容计划；已保存计划的知识范围快照不会被覆盖。</span></div></div>
    <div class="modal-foot"><span>公共库 ${publicBases.length} 个 · 专属库可多选</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-knowledge-package" data-line-id="${line.id}"><span data-icon="check"></span>保存默认知识包</button></div></div>
  `, { wide: true });
}

function generationEvidenceForPlan(plan, limit = 6) {
  const scope = normalizeKnowledgeScope(plan);
  const preferredIds = (plan.writingAgentSnapshot?.preferredKnowledgeBaseIds || []).filter((id) => scope.resolvedBaseIds.includes(id));
  const orderedBaseIds = [...preferredIds, ...scope.resolvedBaseIds.filter((id) => !preferredIds.includes(id))];
  const groups = orderedBaseIds.map((baseId) => approvedKnowledgeItems(baseId).map((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const chunk = version?.chunks?.[0];
    return { base: knowledgeBaseById(baseId), item, version, chunk, quote: chunk?.text || version?.content || "" };
  }).filter((entry) => entry.base && entry.version && entry.quote));
  const selectedItemIds = new Set(plan.selectedKnowledgeItemIds || []);
  const selected = [];
  groups.flat().forEach((entry) => { if (selectedItemIds.has(entry.item.id) && selected.length < limit) selected.push(entry); });
  groups.forEach((group) => { if (group[0] && selected.length < limit && !selected.some((entry) => entry.item.id === group[0].item.id)) selected.push(group[0]); });
  for (let depth = 1; selected.length < limit; depth += 1) {
    let found = false;
    [...groups].reverse().forEach((group) => {
      if (group[depth] && selected.length < limit && !selected.some((entry) => entry.item.id === group[depth].item.id)) {
        selected.push(group[depth]);
        found = true;
      }
    });
    if (!found) break;
  }
  return selected;
}

function generationGapLabels(plan, options = {}) {
  const planArticleIds = new Set(plan.articleIds || []);
  const gaps = (state.knowledgeGaps || []).filter((gap) => gap.status !== "resolved" && (gap.planId === plan.id || planArticleIds.has(gap.articleId)) && (!gap.businessLineId || gap.businessLineId === plan.businessLineId));
  const labels = gaps.map((gap) => gap.title || gap.label || gap.fact).filter(Boolean);
  if (labels.length || options.blockingOnly || plan.writingAgentSnapshot?.missingEvidenceAction === "block") return labels;
  return ["价格", "交付周期"];
}

function renderGenerationPreviewModal() {
  const plan = state.contentPlans.find((item) => item.id === ui.modal.planId);
  if (!plan) return "";
  const alreadyGenerated = plan.status === "produced";
  const line = state.businessLines.find((item) => item.id === plan.businessLineId);
  const { scope, approved } = planKnowledgeSummary(plan);
  const evidence = generationEvidenceForPlan(plan);
  const gaps = generationGapLabels(plan);
  const agentSnapshot = plan.writingAgentSnapshot;
  const currentAgent = writingAgentById(agentSnapshot?.agentId || plan.writingAgentId);
  const agentAvailable = Boolean(agentSnapshot && currentAgent?.status === "active");
  const hasNewAgentVersion = Boolean(currentAgent && agentSnapshot && Number(currentAgent.version) > Number(agentSnapshot.version));
  const blockedByKnowledgePolicy = agentSnapshot?.missingEvidenceAction === "block" && generationGapLabels(plan, { blockingOnly: true }).length > 0;
  const canGenerate = evidence.length > 0 && agentAvailable && !blockedByKnowledgePolicy;
  const publicIds = enterpriseKnowledgeBaseIds();
  const baseRows = scope.resolvedBaseIds.map((baseId) => {
    const base = knowledgeBaseById(baseId);
    if (!base) return "";
    const itemCount = approvedKnowledgeItems(baseId).length;
    const usedCount = evidence.filter((entry) => entry.base.id === baseId).length;
    const origin = publicIds.includes(baseId) ? "企业公共" : scope.addedBaseIds.includes(baseId) ? "本计划增补" : "业务线默认";
    return `<div class="generation-base-row"><span class="knowledge-check-icon" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(base.name)}</b><small>${knowledgeKindLabel(base.kind)} · ${origin}</small></span><em>拟用 ${usedCount} / 可用 ${itemCount}</em></div>`;
  }).join("");
  const evidenceRows = evidence.map((entry, index) => `<div class="generation-evidence-row"><b>K${index + 1}</b><span><strong>${escapeHtml(entry.item.title || entry.item.question)}</strong><small>${escapeHtml(entry.base.name)} · v${escapeHtml(entry.version.version)} · ${escapeHtml(knowledgeLocator(entry.item, entry.version))}</small><p>${escapeHtml(entry.quote)}</p></span></div>`).join("");
  const chain = '<span>企业公共库 ' + publicIds.filter((id) => scope.resolvedBaseIds.includes(id)).length + '</span><span data-icon="arrow"></span><span>' + escapeHtml(line?.name || "业务线") + '默认库 ' + scope.inheritedBaseIds.filter((id) => !publicIds.includes(id) && scope.resolvedBaseIds.includes(id)).length + '</span><span data-icon="arrow"></span><b>本计划 ' + scope.resolvedBaseIds.length + ' 库</b>';
  const preferredInScope = (agentSnapshot?.preferredKnowledgeBaseIds || []).filter((id) => scope.resolvedBaseIds.includes(id)).map((id) => knowledgeBaseById(id)?.name).filter(Boolean);
  const expectedPlatformNames = planExpectedPlatformNames(plan);
  const briefTopic = plan.topicSnapshots?.[0] || state.topics.find((topic) => plan.topicIds?.includes(topic.id));
  const topicBrief = briefTopic ? (briefTopic.geoBrief || buildGeoTopicBrief(briefTopic, briefTopic.questionSnapshot)) : null;
  const topicBriefHtml = topicBrief ? `<section class="generation-section geo-brief-preview"><div class="section-title"><div><h3>本次选题 Brief</h3><p>先确定 AI 要回答的问题，再决定文章结构；多选题计划会为每篇文章分别生成 Brief。</p></div><span class="small-tag teal">问题地图</span></div><div class="geo-brief-grid"><div><span>核心问题</span><b>${escapeHtml(topicBrief.coreQuestion || briefTopic.title)}</b></div><div><span>决策角色</span><b>${escapeHtml(topicBrief.decisionRole || "—")}</b></div><div><span>回答方式</span><b>${escapeHtml(topicBrief.answerMode || "—")}</b></div><div><span>证据需求</span><b>${escapeHtml((topicBrief.evidenceNeeds || []).join("、") || "—")}</b></div></div><div class="topic-tags">${(topicBrief.requiredSections || []).map((section) => `<span class="small-tag">${escapeHtml(section)}</span>`).join("")}</div></section>` : "";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">生成方案确认</h2><p>${escapeHtml(plan.name)} · 同时核对写作方式与企业知识依据</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body generation-preview">
      ${agentSnapshot ? `<section class="generation-agent-section ${agentAvailable || alreadyGenerated ? "" : "invalid"}"><div class="generation-agent-main"><span class="writing-agent-avatar ${escapeHtml(currentAgent?.color || "blue")}">${escapeHtml(currentAgent?.avatar || agentSnapshot.nameSnapshot.slice(0, 1))}</span><div><span>本计划冻结的写作智能体</span><h3>${escapeHtml(agentSnapshot.nameSnapshot)} <em>v${escapeHtml(agentSnapshot.version)}</em></h3><p>${escapeHtml(agentSnapshot.style)} · ${escapeHtml(agentSnapshot.template)} · ${agentSnapshot.minWords}–${agentSnapshot.maxWords} 字</p></div><span class="status-badge ${agentAvailable ? "status-approved" : "status-error"}">${agentAvailable ? "可用" : "已停用或不适用"}</span></div><div class="generation-agent-rules"><span><b>写作角色</b>${escapeHtml(agentSnapshot.role)}</span><span><b>目标读者</b>${escapeHtml(agentSnapshot.audience)}</span><span><b>知识模式</b>${agentSnapshot.strictKnowledge ? "严格知识" : "普通模式"} · ${agentSnapshot.citationsRequired ? "逐条引用" : "不强制引用"}</span><span><b>缺少证据</b>${agentSnapshot.missingEvidenceAction === "block" ? "阻止生成" : "省略并标记"}</span></div>${preferredInScope.length ? '<p class="agent-priority-note"><b>优先召回：</b>' + escapeHtml(preferredInScope.join("、")) + '；仅调整本计划知识范围内的顺序。</p>' : ""}${hasNewAgentVersion && !alreadyGenerated ? '<div class="agent-version-update"><span data-icon="history"></span><span>当前智能体已有 v' + escapeHtml(currentAgent.version) + '，计划仍冻结 v' + escapeHtml(agentSnapshot.version) + '。</span><button class="text-button" type="button" data-action="upgrade-plan-agent" data-plan-id="' + plan.id + '">升级到最新版</button></div>' : ""}</section>` : '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>计划未记录写作智能体</b><p>请重新创建内容计划后再生成，系统不会静默换用默认智能体。</p></div></div>'}
      ${expectedPlatformNames.length ? `<div class="generation-platform-hint"><span data-icon="sparkle"></span><span><b>预计适配平台（仅写作提示）</b><small>${escapeHtml(expectedPlatformNames.join("、"))} · 不会创建或锁定发布目标</small></span></div>` : ""}
      ${topicBriefHtml}
      <div class="generation-chain">${chain}</div>
      <div class="generation-summary"><div><span>实际知识库</span><b>${scope.resolvedBaseIds.length}</b></div><div><span>已审核知识</span><b>${approved}</b></div><div><span>预计引用证据</span><b>${evidence.length}</b></div><div><span>事实冲突</span><b class="good">0</b></div></div>
      <section class="generation-section"><div class="section-title"><div><h3>本次知识范围</h3><p>范围来自计划快照，不会临时改写业务线默认包</p></div><span class="small-tag teal">严格知识模式</span></div><div class="generation-base-list">${baseRows || '<div class="empty-inline">未选择知识库</div>'}</div></section>
      <section class="generation-section"><div class="section-title"><div><h3>预计使用的证据</h3><p>仅检索已审核版本，生成后逐条锁定版本和原文</p></div><span class="small-tag blue">${evidence.length} 条</span></div><div class="generation-evidence-list">${evidenceRows || '<div class="empty-state compact"><div><span data-icon="alert"></span><h3>没有可用证据</h3><p>请先补充并审核企业知识。</p></div></div>'}</div></section>
      ${gaps.length ? '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>发现 ' + gaps.length + ' 项知识缺口</b><p>' + gaps.map(escapeHtml).join("、") + '。缺口不会由模型补写，也不会生成具体数字或保证性承诺。</p></div></div>' : '<div class="privacy-note"><span data-icon="check"></span><span>当前计划没有已记录的知识缺口；严格知识智能体可以继续生成。</span></div>'}
      <label class="strict-mode-row"><input class="checkbox" type="checkbox" id="strict-knowledge-mode" ${agentSnapshot?.strictKnowledge !== false ? "checked" : ""} disabled /><span><b>${agentSnapshot?.strictKnowledge !== false ? "严格知识模式" : "普通知识模式"}</b><small>规则来自计划冻结的智能体版本；企业事实始终不能突破已审核知识范围</small></span></label>
    </div>
    <div class="modal-foot"><span>${alreadyGenerated ? "这是文章生成时实际使用的冻结方案" : canGenerate ? "智能体与证据检查通过，可以生成" : !agentAvailable ? "写作智能体不可用，暂不能生成" : blockedByKnowledgePolicy ? "智能体要求证据完整，需先补齐知识缺口" : "知识不足，暂不能生成"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">返回计划</button>${alreadyGenerated ? '<button class="primary-button" type="button" data-action="view-plan-content" data-plan-id="' + plan.id + '"><span data-icon="file"></span>查看已生成内容</button>' : '<button class="primary-button" type="button" data-action="confirm-generate-plan" data-plan-id="' + plan.id + '" ' + (canGenerate ? "" : "disabled") + '><span data-icon="sparkle"></span>确认并生成文章</button>'}</div></div>
  `, { wide: true });
}

function renderCitationModal() {
  const citation = (state.knowledgeCitations || []).find((item) => item.id === ui.modal.citationId);
  const article = state.articles.find((item) => item.id === (ui.modal.articleId || citation?.articleId));
  if (!citation || !article) return "";
  const base = knowledgeBaseById(citation.baseId || citation.knowledgeBaseId);
  const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
  const version = knowledgeVersionById(citation.versionId || citation.knowledgeVersionId);
  const currentVersion = knowledgeVersionById(item?.latestVersionId);
  const outdated = currentVersion && version && currentVersion.id !== version.id;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">引用证据 ${escapeHtml(citation.marker || "K")}</h2><p>${escapeHtml(article.title)} · ${escapeHtml(article.version)}</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回文章"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${outdated ? '<div class="knowledge-update-banner"><span data-icon="history"></span><div><b>知识已有新版本</b><p>本文仍引用 v' + escapeHtml(version.version) + '，不会自动替换为 v' + escapeHtml(currentVersion.version) + '。</p></div></div>' : ""}
      <div class="citation-proof"><span>已冻结的知识原文</span><blockquote>${escapeHtml(citation.quote || citation.excerpt || version?.content || "")}</blockquote></div>
      <div class="citation-map"><span><small>知识库</small><b>${escapeHtml(base?.name || "未知知识库")}</b></span><span><small>资料 / 问答</small><b>${escapeHtml(item?.title || item?.question || "未知条目")}</b></span><span><small>冻结版本</small><b>v${escapeHtml(version?.version || citation.knowledgeVersion || "1")}</b></span><span><small>原文定位</small><b>${escapeHtml(citation.locator || knowledgeLocator(item || {}, version))}</b></span><span><small>正文位置</small><b>${escapeHtml(citation.articleSection || citation.paragraphId || "文章正文")}</b></span><span><small>核验状态</small><b>${citation.status === "needs_review" ? "待重新核验" : "证据支持"}</b></span></div>
      <div class="privacy-note"><span data-icon="lock"></span><span>此证据保存了知识库、知识条目、版本、原文片段和正文位置。知识库更新不会静默改动已经审核或发布的文章。</span></div>
    </div>
    <div class="modal-foot"><span>${escapeHtml(knowledgeSourceLabel(item || {}, version))} · ${escapeHtml(knowledgeLocator(item || {}, version))}</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="back-article" data-article-id="${article.id}">返回文章</button></div></div>
  `);
}

function renderOnboardingModal() {
  const profile = state.enterpriseProfile;
  const isComplete = profile.completion === 100;
  const steps = [
    ["企业身份", "主体、品牌与官方域名"],
    ["业务边界", "服务、客户与禁止承诺"],
    ["证据资料", "案例、FAQ 与公开范围"],
    ["监测基线", "问题集与首批 AI 平台"]
  ];
  const stepHtml = steps.map((step, index) => {
    const number = index + 1;
    const stateClass = number < ui.onboardingStep ? "done" : number === ui.onboardingStep ? "active" : "";
    return '<div class="onboarding-step ' + stateClass + '"><span>' + (number < ui.onboardingStep ? icon("check") : number) + '</span><div><b>' + step[0] + '</b><small>' + step[1] + "</small></div></div>";
  }).join("");

  let body = "";
  if (ui.onboardingStep === 1) {
    body = `
      <div class="field-row"><div class="field"><label for="onboard-company">企业全称 *</label><input class="input" id="onboard-company" value="${escapeHtml(profile.companyName)}" placeholder="请输入工商登记全称" /></div><div class="field"><label for="onboard-brand">展示品牌</label><input class="input" id="onboard-brand" value="${escapeHtml(profile.brandName)}" /></div></div>
      <div class="field" style="margin-top:13px"><label for="onboard-intro">企业介绍 *</label><textarea class="textarea" id="onboard-intro" placeholder="说明企业定位、核心能力和服务对象">${escapeHtml(profile.introduction)}</textarea></div>
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="onboard-domain">官方域名</label><input class="input" id="onboard-domain" value="${escapeHtml(profile.officialDomain)}" /></div><div class="field"><label for="onboard-industry">行业与地区</label><input class="input" id="onboard-industry" value="${escapeHtml(profile.industryRegion)}" /></div></div>
    `;
  } else if (ui.onboardingStep === 2) {
    body = `
      <div class="field"><label for="onboard-service">主推产品 / 服务 *</label><input class="input" id="onboard-service" value="${escapeHtml(profile.primaryService)}" /></div>
      <div class="field" style="margin-top:13px"><label for="onboard-service-desc">定位、能力与交付边界 *</label><textarea class="textarea" id="onboard-service-desc">${escapeHtml(profile.serviceDescription)}</textarea></div>
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="onboard-audience">目标客户</label><input class="input" id="onboard-audience" value="${escapeHtml(profile.audience)}" /></div><div class="field"><label>服务范围</label><input class="input" id="onboard-area" value="${escapeHtml(profile.serviceArea)}" /></div></div>
      <div class="security-inline"><span data-icon="shield"></span><span>禁止承诺：不使用“保证排名、百分百收录、绝对第一”等无法验证的表述。</span></div>
    `;
  } else if (ui.onboardingStep === 3) {
    body = `
      <div class="onboarding-evidence-grid">
        <button class="evidence-card complete" type="button" data-action="onboarding-evidence" data-evidence-kind="website"><span data-icon="globe"></span><b>官网资料</b><small>已导入 9 个页面</small></button>
        <button class="evidence-card complete" type="button" data-action="onboarding-evidence" data-evidence-kind="document"><span data-icon="folder"></span><b>企业文件</b><small>已审核 34 / 36 份</small></button>
        <button class="evidence-card ${isComplete ? "complete" : "pending"}" type="button" data-action="onboarding-evidence" data-evidence-kind="case"><span data-icon="briefcase"></span><b>典型案例</b><small>${isComplete ? "8 / 8" : "7 / 8"} 条已确认</small></button>
        <button class="evidence-card ${isComplete ? "complete" : "pending"}" type="button" data-action="onboarding-evidence" data-evidence-kind="qa"><span data-icon="help"></span><b>常见问题</b><small>${isComplete ? "24 / 24" : "22 / 24"} 条已确认</small></button>
      </div>
      <div class="privacy-note"><span data-icon="info"></span><span>官网导入与 AI 整理只生成待确认草稿。正式发布到企业知识前必须人工核对事实与公开范围。</span></div>
    `;
  } else {
    body = `
      <div class="monitor-baseline">
        <div><span class="knowledge-icon" data-icon="target"></span><p><b>核心问题集</b><small>已从选题中心的问题词库选择 8 个问题，可作为首次采样基线。</small></p><span class="status-badge status-approved">已准备</span></div>
        <div><span class="knowledge-icon teal" data-icon="cpu"></span><p><b>首批 AI 平台</b><small>DeepSeek、豆包、通义千问、Kimi、文心一言。</small></p><span class="status-badge status-approved">5 个平台</span></div>
        <div><span class="knowledge-icon amber" data-icon="users"></span><p><b>竞品基线</b><small>${isComplete ? "已确认首批竞品，后续可持续调整。" : "正式运行前还需确认 2–5 个真实竞品品牌。"}</small></p><span class="status-badge ${isComplete ? "status-approved" : "status-review"}">${isComplete ? "已确认" : "待确认"}</span></div>
      </div>
      <div class="monitor-demo-note" style="margin:14px 0 0"><span data-icon="info"></span><span>完成建档后会生成企业事实卡、官方域名、首个问题集和监测任务。首次自动采样属于新增能力。</span><span class="small-tag blue">新增能力</span></div>
    `;
  }

  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">企业建档引导</h2><p>第 ${ui.onboardingStep} / 4 步 · 所有资料最终进入同一份企业知识</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="onboarding-layout">
      <aside class="onboarding-steps">${stepHtml}</aside>
      <div class="modal-body onboarding-form"><h3>${steps[ui.onboardingStep - 1][0]}</h3><p class="onboarding-lead">${steps[ui.onboardingStep - 1][1]}</p>${body}</div>
    </div>
    <div class="modal-foot"><span>已完成 ${Math.min(ui.onboardingStep - 1, 3)} / 4 步</span><div class="modal-foot-right">${ui.onboardingStep > 1 ? '<button class="secondary-button" type="button" data-action="onboarding-prev">上一步</button>' : '<button class="secondary-button" type="button" data-action="close-modal">稍后继续</button>'}${ui.onboardingStep < 4 ? '<button class="primary-button" type="button" data-action="onboarding-next">保存并继续</button>' : '<button class="primary-button" type="button" data-action="finish-onboarding"><span data-icon="check"></span>完成建档并开始策划</button>'}</div></div>
  `, { wide: true });
}

function renderBusinessLineModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">新增产品 / 业务线</h2><p>业务线是关键词、问题、选题和内容计划的共同归属</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="business-line-name">业务线名称 *</label><input class="input ${ui.businessLineError ? "input-error" : ""}" id="business-line-name" placeholder="例如：工业清洗设备" autocomplete="off" />${ui.businessLineError ? '<small class="error-text">' + escapeHtml(ui.businessLineError) + "</small>" : ""}</div>
      <div class="field" style="margin-top:13px"><label for="business-line-product">主推产品 / 服务</label><input class="input" id="business-line-product" placeholder="例如：激光清洗设备与交付服务" /></div>
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="business-line-audience">目标客户</label><input class="input" id="business-line-audience" placeholder="例如：汽车零部件制造企业" /></div><div class="field"><label for="business-line-scenario">核心场景</label><input class="input" id="business-line-scenario" placeholder="例如：除锈、除漆与模具清洁" /></div></div>
      <div class="privacy-note"><span data-icon="info"></span><span>创建后会自动切换到新业务线，可立即添加种子关键词并开始拓展。</span></div>
    </div>
    <div class="modal-foot"><span>同一客户空间内业务线名称不能重复</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-business-line"><span data-icon="plus"></span>创建业务线</button></div></div>
  `);
}

function businessLineImpact(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId);
  const topicIds = state.topics.filter((topic) => topicBusinessLineId(topic) === lineId).map((topic) => topic.id);
  const planIds = state.contentPlans.filter((plan) => plan.businessLineId === lineId).map((plan) => plan.id);
  const articleIds = state.articles.filter((article) => article.businessLineId === lineId || article.generationSnapshot?.businessLineId === lineId || planIds.includes(article.planId) || topicIds.includes(article.topicId)).map((article) => article.id);
  const impact = {
    keywords: state.keywords.filter((item) => item.businessLineId === lineId).length,
    packs: state.keywordPacks.filter((item) => item.businessLineId === lineId).length,
    questions: state.questionLibrary.filter((item) => item.businessLineId === lineId).length,
    topics: topicIds.length,
    plans: planIds.length,
    articles: articleIds.length,
    publishedArticles: state.articles.filter((article) => articleIds.includes(article.id) && article.status === "published").length,
    publishTasks: state.publishTasks.filter((task) => articleIds.includes(task.articleId)).length,
    knowledgeBases: (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.scope !== "enterprise").length,
    knowledgeGaps: (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId).length,
    monitoringTasks: (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line?.name).length
  };
  impact.total = impact.keywords + impact.packs + impact.questions + impact.topics + impact.plans + impact.articles + impact.publishTasks + impact.knowledgeBases + impact.knowledgeGaps + impact.monitoringTasks;
  return impact;
}

function renderBusinessLineManagerModal() {
  const activeLines = state.businessLines.filter((line) => line.status === "active");
  const archivedLines = state.businessLines.filter((line) => line.status === "archived");
  const activeRows = activeLines.map((line) => {
    const impact = businessLineImpact(line.id);
    const deleteDisabled = activeLines.length <= 1;
    return `<article class="business-line-manage-row"><span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span><div><b>${escapeHtml(line.name)}</b><p>${escapeHtml(line.product || "未填写主推产品")}</p><small>${impact.keywords} 关键词 · ${impact.questions} 问题 · ${impact.plans} 计划 · ${impact.articles} 文章 · ${impact.knowledgeBases} 知识库</small></div><button class="danger-button button-small" type="button" data-action="request-delete-business-line" data-line-id="${line.id}" ${deleteDisabled ? "disabled" : ""}>${deleteDisabled ? "至少保留一条" : "删除"}</button></article>`;
  }).join("");
  const archivedRows = archivedLines.map((line) => {
    const impact = businessLineImpact(line.id);
    return `<article class="business-line-manage-row archived"><span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span><div><b>${escapeHtml(line.name)}</b><p>已从日常运营入口移除</p><small>保留 ${impact.articles} 篇历史文章与 ${impact.knowledgeBases} 个业务线知识库的证据关系</small></div><button class="secondary-button button-small" type="button" data-action="restore-business-line" data-line-id="${line.id}"><span data-icon="refresh"></span>恢复</button></article>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">产品 / 业务线管理</h2><p>新增、删除或恢复业务线；至少保留一条可运营业务线</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="business-line-manage-head"><div><h3>正在使用</h3><p>删除后将从选题、计划和知识配置入口中移除。</p></div><button class="primary-button button-small" type="button" data-action="open-business-line"><span data-icon="plus"></span>新增业务线</button></div><div class="business-line-manage-list">${activeRows}</div>${archivedRows ? '<div class="business-line-manage-head archived-head"><div><h3>已删除，可恢复</h3><p>保留历史文章、发布记录和引用证据。</p></div></div><div class="business-line-manage-list">' + archivedRows + '</div>' : ""}<div class="privacy-note"><span data-icon="info"></span><span>空业务线会直接删除；已有内容的业务线采用可恢复删除，避免历史文章和知识引用失去来源。</span></div></div>
    <div class="modal-foot"><span>当前 ${activeLines.length} 条可用业务线</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>
  `, { wide: true });
}

function renderDeleteBusinessLineModal() {
  const line = state.businessLines.find((item) => item.id === ui.modal.lineId && item.status === "active");
  if (!line) return "";
  const impact = businessLineImpact(line.id);
  const isEmpty = impact.total === 0;
  const activeCount = state.businessLines.filter((item) => item.status === "active").length;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">删除业务线</h2><p>${escapeHtml(line.name)} · ${isEmpty ? "空业务线将永久删除" : "已有历史数据，将采用可恢复删除"}</p></div><button class="icon-button" type="button" data-action="back-business-line-manager" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="delete-business-line-warning"><span data-icon="alert"></span><div><b>确认删除「${escapeHtml(line.name)}」？</b><p>${isEmpty ? "这条业务线还没有运营数据，删除后不会保留空记录。" : "业务线会从日常运营入口中移除，关联知识库停止参与新内容生成；历史文章、发布记录和引用证据继续保留。"}</p></div></div><div class="delete-impact-grid"><div><span>关键词</span><b>${impact.keywords}</b></div><div><span>客户问题</span><b>${impact.questions}</b></div><div><span>选题</span><b>${impact.topics}</b></div><div><span>内容计划</span><b>${impact.plans}</b></div><div><span>文章</span><b>${impact.articles}</b></div><div><span>专属知识库</span><b>${impact.knowledgeBases}</b></div></div>${impact.publishedArticles || impact.publishTasks ? '<div class="privacy-note warning"><span data-icon="lock"></span><span>其中包含 ' + impact.publishedArticles + ' 篇已发布文章和 ' + impact.publishTasks + ' 个发布任务，这些记录不会被物理删除。</span></div>' : ""}</div>
    <div class="modal-foot"><span>${activeCount <= 1 ? "系统必须至少保留一条业务线" : isEmpty ? "此操作不可恢复" : "删除后可在业务线管理中恢复"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-business-line-manager">取消</button><button class="danger-button" type="button" data-action="confirm-delete-business-line" data-line-id="${line.id}" ${activeCount <= 1 ? "disabled" : ""}>确认删除</button></div></div>
  `);
}

function renderTopicPlanPickerModal() {
  const topic = state.topics.find((item) => item.id === ui.modal.topicId);
  if (!topic) return "";
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId);
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === lineId && plan.status !== "archived");
  const planStates = plans.map((plan) => {
    const status = plan.status || (contentPlanArticles(plan).length ? "produced" : "planned");
    const duplicate = contentPlanTopicIds(plan).includes(topic.id);
    const available = ["draft", "planned"].includes(status) && !duplicate;
    return { plan, status, duplicate, available };
  });
  const firstAvailableId = planStates.find((item) => item.available)?.plan.id || null;
  const selectedPlanId = planStates.some((item) => item.available && item.plan.id === ui.modal.planId) ? ui.modal.planId : firstAvailableId;
  const rows = planStates.map(({ plan, status, duplicate, available }) => {
    const topicCount = contentPlanTopicIds(plan).length;
    const unavailableReason = duplicate ? "该选题已在计划中" : status === "produced" ? "已生成内容，不再追加选题" : status === "completed" ? "计划已完成" : "当前状态不可追加";
    return `<label class="topic-plan-picker-row ${available ? "" : "disabled"}"><input class="checkbox" type="radio" name="topic-plan-id" value="${escapeHtml(plan.id)}" ${plan.id === selectedPlanId ? "checked" : ""} ${available ? "" : "disabled"} /><span class="topic-plan-picker-icon" data-icon="clock"></span><span class="topic-plan-picker-copy"><b>${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.id)} · ${topicCount} 个选题 · ${escapeHtml(plan.contentType || "未设置形式")}</small><em>完成日期 ${escapeHtml(plan.scheduledFor || "未安排")} · ${escapeHtml(plan.owner || "未分配负责人")}</em></span><span class="topic-plan-picker-state">${planStatusBadge(status)}<small>${available ? "可以加入" : escapeHtml(unavailableReason)}</small></span></label>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">加入已有内容计划</h2><p>${escapeHtml(line?.name || "业务线")} · 为当前选题选择一个计划</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body topic-plan-picker-body">
      <section class="topic-plan-picker-topic"><span data-icon="file"></span><span><small>当前选题</small><b>${escapeHtml(topic.title)}</b><em>${escapeHtml(topic.intent || "未设置用户意图")}</em></span></section>
      <div class="topic-plan-picker-heading"><div><h3>选择内容计划</h3><p>只显示当前产品 / 业务线的计划；已生成内容或已完成的计划不可追加。</p></div><span class="small-tag blue">${planStates.filter((item) => item.available).length} 个可选</span></div>
      <div class="topic-plan-picker-list">${rows || '<div class="empty-state topic-plan-picker-empty"><div><span data-icon="clock"></span><h3>还没有内容计划</h3><p>可以先为这个选题新建一个内容计划。</p></div></div>'}</div>
      <div class="privacy-note"><span data-icon="lock"></span><span>加入后，这个选题会使用该计划已经确定的写作智能体、企业知识范围和预计适配平台提示；不会锁定实际发布平台。</span></div>
    </div>
    <div class="modal-foot"><span>加入后可在「内容计划」继续创建文章任务</span><div class="modal-foot-right"><button class="ghost-button" type="button" data-action="create-plan-from-topic-picker" data-topic-id="${escapeHtml(topic.id)}"><span data-icon="plus"></span>新建内容计划</button><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-topic-plan-picker" ${firstAvailableId ? "" : "disabled"}><span data-icon="check"></span>确认加入</button></div></div>
  `, { wide: true });
}

function renderContentPlanModal() {
  const line = activeBusinessLine();
  const selectedTopics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  const topicList = selectedTopics.map((topic) => '<div class="plan-topic-item"><span data-icon="file"></span><span><b>' + escapeHtml(topic.title) + '</b><small>' + escapeHtml(topic.intent) + " · " + topic.recommendation + ' 优先级</small></span></div>').join("");
  const inheritedIds = inheritedKnowledgeBaseIds(line);
  const eligibleBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived" && (base.scope === "enterprise" || !base.businessLineId || base.businessLineId === line?.id));
  const knowledgeList = eligibleBases.map((base) => {
    const inherited = inheritedIds.includes(base.id);
    const origin = base.scope === "enterprise" ? "企业公共" : inherited ? "业务线默认" : "可增补";
    return `<label class="knowledge-check-row plan-knowledge-row"><input class="checkbox" type="checkbox" data-plan-knowledge value="${base.id}" ${inherited ? "checked" : ""} /><span class="knowledge-check-icon" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(base.name)}</b><small>${knowledgeKindLabel(base.kind)} · ${approvedKnowledgeItems(base.id).length} 条已审核知识</small></span><em>${origin}</em></label>`;
  }).join("");
  const defaultAgent = defaultAgentForLine(line, "深度文章");
  const availableAgents = activeWritingAgents(line?.id);
  const agentOptions = availableAgents.map((agent) => `<option value="${agent.id}" ${agent.id === defaultAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}${agent.id === line?.defaultWritingAgentId ? "（业务线默认）" : ""}</option>`).join("");
  const platformHintChoices = Object.entries(PLATFORM_META).map(([id, meta]) => `<label class="plan-platform-hint-option"><input class="checkbox" type="checkbox" data-plan-style-platform value="${id}" />${platformLogo(id).replace("<span ", '<span aria-hidden="true" ')}<span><b>${escapeHtml(meta.name)}</b><small>${escapeHtml(PLATFORM_STYLE_HINTS[id])}</small></span></label>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">创建内容计划</h2><p>${escapeHtml(line?.name || "业务线")} · 已选择 ${selectedTopics.length} 个选题</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="content-plan-name">计划名称 *</label><input class="input ${ui.planError ? "input-error" : ""}" id="content-plan-name" value="${escapeHtml(line?.name || "业务线")} · 8 月内容计划" />${ui.planError ? '<small class="error-text">' + escapeHtml(ui.planError) + "</small>" : ""}</div>
      <div class="field-row" style="margin-top:13px"><div class="field"><label for="content-plan-date">计划完成日期 *</label><input class="input" id="content-plan-date" type="date" value="2026-08-05" /></div><div class="field"><label for="content-plan-owner">负责人</label><select class="select" id="content-plan-owner"><option>王宁</option><option>李晨</option><option>AI 内容助手</option></select></div></div>
      <div class="field" style="margin-top:13px"><label for="content-plan-type">内容形式</label><select class="select" id="content-plan-type"><option>深度文章</option><option>系列文章</option><option>问答文章</option><option>案例解读</option></select></div>
      <div class="plan-agent-panel"><div class="section-title"><div><h3>写作智能体 *</h3><p>决定文章角色、结构、语气与知识使用规则；保存计划时冻结当前版本</p></div><span class="small-tag blue">写法快照</span></div><select class="select" id="content-plan-agent" ${agentOptions ? "" : "disabled"}>${agentOptions || '<option value="">当前业务线没有可用智能体</option>'}</select>${defaultAgent ? `<div class="plan-agent-summary" id="plan-agent-summary"><span class="writing-agent-avatar ${escapeHtml(defaultAgent.color || "blue")}">${escapeHtml(defaultAgent.avatar || defaultAgent.name.slice(0, 1))}</span><span><b>${escapeHtml(defaultAgent.name)} · v${escapeHtml(defaultAgent.version)}</b><small>${escapeHtml(defaultAgent.style)} · ${defaultAgent.strictKnowledge ? "严格知识模式" : "普通知识模式"}</small></span></div>` : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>请先到内容生产创建或恢复一个可用写作智能体。</span></div>'}</div>
      <details class="plan-platform-hints"><summary><span><b>预计适配平台（可选）</b><small>仅向 AI 提示写作风格，不锁定发布</small></span><span class="small-tag">不锁定发布</span></summary><div class="plan-platform-hint-body"><p>可多选，也可以不选。平台和账号仍然只在文章审核通过后到「发布运营」中确定。</p><div class="plan-platform-hint-grid" role="group" aria-label="预计适配平台（可选）">${platformHintChoices}</div></div></details>
      <div class="privacy-note"><span data-icon="send"></span><span>发布平台与账号将在文章审核通过后，到「发布运营」中选择；内容计划不预先锁定分发渠道。</span></div>
      <div class="plan-knowledge-panel"><div class="section-title"><div><h3>本计划使用的企业知识</h3><p>已继承 ${inheritedIds.length} 个知识库，可为这次计划增补或排除；不会反向修改业务线默认包</p></div><span class="small-tag teal">范围快照</span></div><div class="plan-knowledge-list">${knowledgeList || '<div class="empty-inline">当前业务线还没有可用知识库</div>'}</div></div>
      <div class="plan-topic-list">${topicList}</div>
    </div>
    <div class="modal-foot"><span>保存时同时冻结智能体版本与本次知识范围</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-content-plan" ${agentOptions ? "" : "disabled"}><span data-icon="check"></span>保存内容计划</button></div></div>
  `, { wide: true });
}

function renderWritingAgentModal() {
  const editingAgent = writingAgentById(ui.modal.agentId);
  const cloneSource = writingAgentById(ui.modal.cloneFromId);
  const source = editingAgent || cloneSource;
  const isReadOnly = Boolean(editingAgent?.builtIn);
  const isCopy = Boolean(cloneSource && !editingAgent);
  const empty = {
    name: "", description: "", avatar: "智", role: "企业内容编辑", audience: "企业客户", tone: "专业、清晰", style: "结论清晰 · 证据优先", template: "deep", structure: ["结论先行", "分点论证", "行动建议"], required: "关键判断需要企业知识支持。", banned: "不得虚构企业事实、案例或效果承诺。", cta: "给出克制的下一步建议。", systemPrompt: "请基于本次内容计划冻结的企业知识完成写作，所有企业事实必须可追溯。", strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: [], businessLineIds: [], contentTypes: ["深度文章"], modelMode: "inherit", creativity: 0.35, minWords: 1000, maxWords: 1800
  };
  const agent = { ...empty, ...(source || {}) };
  let name = isCopy ? agent.name + " 副本" : agent.name;
  if (isCopy) {
    let copyNo = 2;
    while ((state.writingAgents || []).some((item) => item.name.toLowerCase() === name.toLowerCase())) name = agent.name + " 副本 " + copyNo++;
  }
  const lineChecks = state.businessLines.filter((line) => line.status === "active").map((line) => `<label><input class="checkbox" type="checkbox" data-agent-line value="${line.id}" ${(agent.businessLineIds || []).includes(line.id) ? "checked" : ""} />${escapeHtml(line.name)}</label>`).join("");
  const contentTypeChecks = ["深度文章", "系列文章", "问答文章", "案例解读"].map((type) => `<label><input class="checkbox" type="checkbox" data-agent-content-type value="${type}" ${(agent.contentTypes || []).includes(type) ? "checked" : ""} />${type}</label>`).join("");
  const knowledgeChecks = (state.knowledgeBases || []).filter((base) => base.status !== "archived").map((base) => `<label class="agent-knowledge-option"><input class="checkbox" type="checkbox" data-agent-knowledge value="${base.id}" ${(agent.preferredKnowledgeBaseIds || []).includes(base.id) ? "checked" : ""} /><span><b>${escapeHtml(base.name)}</b><small>${escapeHtml(knowledgeScopeLabel(base))} · 仅作计划范围内的优先级建议</small></span></label>`).join("");
  const title = isReadOnly ? "查看内置智能体" : editingAgent ? "编辑写作智能体" : isCopy ? "复制写作智能体" : "创建写作智能体";
  const subtitle = isReadOnly ? "系统模板不可直接修改，可以复制成企业自建版本" : editingAgent ? "保存配置变更后版本自动递增，历史快照不受影响" : "把常用写作角色、结构和知识规则保存为可复用能力";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body writing-agent-form">
      <fieldset ${isReadOnly ? "disabled" : ""}>
        <section class="agent-form-section"><div class="section-title"><div><h3>1. 基本信息</h3><p>说明这个智能体适合谁、适合什么内容</p></div>${editingAgent ? '<span class="small-tag blue">当前 v' + escapeHtml(editingAgent.version) + '</span>' : '<span class="small-tag teal">新建 v1</span>'}</div><div class="field-row"><div class="field"><label for="writing-agent-name">智能体名称 *</label><input class="input" id="writing-agent-name" maxlength="40" value="${escapeHtml(name)}" placeholder="例如：技术白皮书编辑" /></div><div class="field"><label for="writing-agent-avatar">图标文字</label><input class="input" id="writing-agent-avatar" maxlength="1" value="${escapeHtml(agent.avatar || name.slice(0, 1) || "智")}" /></div></div><div class="field"><label for="writing-agent-description">一句话用途 *</label><input class="input" id="writing-agent-description" maxlength="100" value="${escapeHtml(agent.description)}" placeholder="说明它最擅长写什么" /></div><div class="field-row"><div class="field"><label for="writing-agent-role">扮演角色</label><input class="input" id="writing-agent-role" value="${escapeHtml(agent.role)}" /></div><div class="field"><label for="writing-agent-audience">目标读者</label><input class="input" id="writing-agent-audience" value="${escapeHtml(agent.audience)}" /></div></div><div class="field"><label>适用业务线 <small>不勾选代表全部业务线</small></label><div class="agent-check-grid">${lineChecks}</div></div><div class="field"><label>适用内容形式 *</label><div class="agent-check-grid">${contentTypeChecks}</div></div></section>
        <section class="agent-form-section"><div class="section-title"><div><h3>2. 写作规则</h3><p>结构化配置给运营人员使用，高级提示词保留完整控制</p></div><span class="small-tag blue">决定怎么写</span></div><div class="field-row"><div class="field"><label for="writing-agent-tone">语气</label><input class="input" id="writing-agent-tone" value="${escapeHtml(agent.tone)}" /></div><div class="field"><label for="writing-agent-style">写作风格</label><input class="input" id="writing-agent-style" value="${escapeHtml(agent.style)}" /></div></div><div class="field-row"><div class="field"><label for="writing-agent-template">文章结构模板</label><select class="select" id="writing-agent-template"><option value="deep" ${agent.template === "deep" ? "selected" : ""}>深度解读</option><option value="qa" ${agent.template === "qa" ? "selected" : ""}>标准问答</option><option value="case" ${agent.template === "case" ? "selected" : ""}>案例拆解</option><option value="guide" ${agent.template === "guide" ? "selected" : ""}>采购指南</option><option value="story" ${agent.template === "story" ? "selected" : ""}>品牌叙事</option></select></div><div class="field"><label for="writing-agent-structure">推荐结构</label><input class="input" id="writing-agent-structure" value="${escapeHtml((agent.structure || []).join("、"))}" /></div></div><div class="field"><label for="writing-agent-required">必须包含</label><textarea class="textarea" id="writing-agent-required" rows="2">${escapeHtml(agent.required)}</textarea></div><div class="field"><label for="writing-agent-banned">禁止表达</label><textarea class="textarea" id="writing-agent-banned" rows="2">${escapeHtml(agent.banned)}</textarea></div><div class="field"><label for="writing-agent-cta">结尾行动引导</label><input class="input" id="writing-agent-cta" value="${escapeHtml(agent.cta)}" /></div><details class="agent-prompt-details" open><summary>高级提示词 *</summary><p>提示词不能绕过知识证据、内容风控与人工审核门禁。</p><textarea class="textarea" id="writing-agent-prompt" rows="7">${escapeHtml(agent.systemPrompt)}</textarea></details></section>
        <section class="agent-form-section"><div class="section-title"><div><h3>3. 知识与生成</h3><p>智能体控制写法，不会替换内容计划冻结的知识范围</p></div><span class="small-tag teal">权限不越界</span></div><div class="agent-policy-grid"><label class="strict-mode-row"><input class="checkbox" type="checkbox" id="writing-agent-strict" ${agent.strictKnowledge ? "checked" : ""} /><span><b>严格知识模式</b><small>企业事实必须有已审核证据</small></span></label><label class="strict-mode-row"><input class="checkbox" type="checkbox" id="writing-agent-citations" ${agent.citationsRequired ? "checked" : ""} /><span><b>生成逐条引用</b><small>文章保留 K1–Kn 证据定位</small></span></label></div><div class="field-row"><div class="field"><label for="writing-agent-missing">缺少证据时</label><select class="select" id="writing-agent-missing"><option value="omit" ${agent.missingEvidenceAction === "omit" ? "selected" : ""}>省略并标记知识缺口</option><option value="block" ${agent.missingEvidenceAction === "block" ? "selected" : ""}>阻止生成</option></select></div><div class="field"><label for="writing-agent-model">模型</label><select class="select" id="writing-agent-model"><option value="inherit">继承系统默认模型</option></select></div></div><div class="field-row three"><div class="field"><label for="writing-agent-min-words">最少字数</label><input class="input" type="number" id="writing-agent-min-words" min="300" max="10000" value="${escapeHtml(agent.minWords)}" /></div><div class="field"><label for="writing-agent-max-words">最多字数</label><input class="input" type="number" id="writing-agent-max-words" min="500" max="15000" value="${escapeHtml(agent.maxWords)}" /></div><div class="field"><label for="writing-agent-creativity">创造性 0–1</label><input class="input" type="number" id="writing-agent-creativity" min="0" max="1" step="0.05" value="${escapeHtml(agent.creativity)}" /></div></div><div class="field"><label>优先知识库 <small>只调整计划已经选中知识库的召回顺序</small></label><div class="agent-knowledge-list">${knowledgeChecks || '<span class="empty-inline">还没有知识库</span>'}</div></div></section>
      </fieldset>
      <div class="privacy-note"><span data-icon="history"></span><span>${isReadOnly ? "系统模板保持只读；复制后可以自定义。" : "保存修改只影响之后选择新版本的计划；历史计划和文章继续使用生成时的完整快照。"}</span></div>
    </div>
    <div class="modal-foot"><span>${isReadOnly ? "系统内置 · v" + escapeHtml(agent.version) : editingAgent ? "本次保存将检查配置变化" : "保存后可在内容计划中选择"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button>${isReadOnly ? '<button class="primary-button" type="button" data-action="copy-writing-agent" data-agent-id="' + agent.id + '"><span data-icon="plus"></span>复制后编辑</button>' : '<button class="primary-button" type="button" data-action="save-writing-agent" data-agent-id="' + (editingAgent?.id || "") + '"><span data-icon="check"></span>保存智能体</button>'}</div></div>
  `, { wide: true });
}

function renderRegenerateArticleModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  const agent = writingAgentById(ui.modal.agentId);
  if (!article || !agent) return "";
  const current = article.generationSnapshot?.writingAgent;
  const unsaved = Boolean(ui.modal.unsavedChanges);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">使用新智能体重新生成</h2><p>${escapeHtml(article.title)} · 将创建文章新版本</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${unsaved ? '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>检测到未保存修改</b><p>继续重新生成将以当前已保存版本为基础，编辑器中的未保存内容不会带入新版本。</p></div></div>' : ""}
      <div class="agent-regenerate-compare"><div><span>当前版本</span><b>${escapeHtml(article.version)} · ${escapeHtml(current?.nameSnapshot || "历史默认配置")}${current ? " v" + escapeHtml(current.version) : ""}</b><small>原正文、引用、审核状态和智能体快照将进入版本历史</small></div><span data-icon="arrow"></span><div><span>新版本</span><b>v${(Number(String(article.version).replace(/\D/g, "")) || 1) + 1} · ${escapeHtml(agent.name)} v${escapeHtml(agent.version)}</b><small>${escapeHtml(agent.style)} · ${agent.strictKnowledge ? "严格知识" : "普通知识"}</small></div></div>
      <div class="delete-business-line-warning"><span data-icon="refresh"></span><div><b>重新生成会发生什么？</b><p>新版本沿用当前冻结的企业知识版本与逐条引用，正文按新智能体结构重写；审核回到待审核，风控回到未检测。已发布任务仍绑定旧版本。</p></div></div>
      <div class="privacy-note"><span data-icon="lock"></span><span>智能体只能改变写法，不能增加计划未授权的知识库，也不能绕过事实审核、内容风控和人工审核。</span></div>
    </div>
    <div class="modal-foot"><span>此操作不会覆盖 ${escapeHtml(article.version)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-article" data-article-id="${article.id}">取消</button><button class="primary-button" type="button" data-action="confirm-regenerate-article" data-article-id="${article.id}" data-agent-id="${agent.id}"><span data-icon="sparkle"></span>创建新版本</button></div></div>
  `);
}

function renderArticleVersionModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  const revision = article?.versions?.[Number(ui.modal.versionIndex)];
  if (!article || !revision) return "";
  const agent = revision.generationSnapshot?.writingAgent;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">文章历史版本 ${escapeHtml(revision.version)}</h2><p>${escapeHtml(article.id)} · 只读快照 · ${new Date(revision.archivedAt || revision.updatedAt).toLocaleString("zh-CN", { hour12: false })}</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回"><span data-icon="x"></span></button></div>
    <div class="modal-body article-version-preview"><div class="generation-agent-section"><div class="generation-agent-main"><span class="writing-agent-avatar ${escapeHtml(writingAgentById(agent?.agentId)?.color || "blue")}">${escapeHtml(writingAgentById(agent?.agentId)?.avatar || agent?.nameSnapshot?.slice(0, 1) || "史")}</span><div><span>生成时冻结的写作方式</span><h3>${escapeHtml(agent?.nameSnapshot || "历史默认配置")} ${agent ? "<em>v" + escapeHtml(agent.version) + "</em>" : ""}</h3><p>${escapeHtml(agent?.style || "该版本未记录智能体配置")}</p></div><span class="status-badge status-draft">历史只读</span></div></div><h2 class="article-version-title">${escapeHtml(revision.title)}</h2><article class="article-content read-only">${revision.content}</article></div>
    <div class="modal-foot"><span>${(revision.citations || []).length} 条引用 · ${escapeHtml(revision.reviewStatus === "approved" ? "审核通过" : "待审核")}</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="back-article" data-article-id="${article.id}">返回当前版本</button></div></div>
  `, { wide: true });
}

function articleEditorHasUnsavedChanges(article) {
  const titleInput = document.getElementById("article-title-editor");
  const contentInput = document.getElementById("article-content-editor");
  if (!titleInput || !contentInput) return false;
  return titleInput.value.trim() !== article.title || contentInput.innerHTML.trim() !== articleContentForEditor(article, articleCitations(article)).trim();
}

async function regenerateArticleWithAgent(articleId, agentId) {
  const article = state.articles.find((item) => item.id === articleId);
  const agent = writingAgentById(agentId);
  const topic = article?.topicSnapshot || article?.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article?.topicId);
  const plan = state.contentPlans.find((item) => item.id === article?.planId);
  if (!article || !agent || !topic) return showToast("无法重新生成", "文章、选题或写作智能体不存在。", "error");
  if (!writingAgentSupports(agent, article.businessLineId, plan?.contentType || null)) return showToast("写作智能体不可用", "请选择已启用且适用于当前业务线的智能体。", "error");
  const oldCitations = articleCitations(article);
  if (!oldCitations.length || !article.knowledgeSnapshot) return showToast("缺少冻结知识证据", "历史文章不能直接改写，请从内容计划重新生成。", "error");
  if (agent.missingEvidenceAction === "block" && (article.knowledgeStatus?.gapCount || 0) > 0) return showToast("知识缺口阻止重写", "该智能体要求证据完整，请先补齐并审核文章记录的知识缺口。", "error");
  let providerId = selectedTextProviderId();
  if (!providerId && !aiProviderSnapshot.loaded) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const line = state.businessLines.find((item) => item.id === article.businessLineId && item.status === "active") || activeBusinessLine();
  if (!line) return showToast("业务线不可用", "请选择一个有效的产品 / 业务线后重试。", "error");
  const nextNumber = (Number(String(article.version).replace(/\D/g, "")) || 1) + 1;
  const nextVersion = "v" + nextNumber;
  const now = new Date().toISOString();
  const agentSnapshot = snapshotWritingAgent(agent, { selectedAt: now, selectionSource: "article_override", lockedAt: now });
  const expectedPlatformGuidance = planExpectedPlatformGuidance(plan);
  const geoBrief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  if (!topic.geoBrief) topic.geoBrief = cloneData(geoBrief);
  const contentType = plan?.contentType || article.category || "深度文章";
  let remoteGeneration;
  try {
    remoteGeneration = await requestAiArticle({
      providerId,
      line,
      contentType,
      topic: { ...topic, geoBrief },
      agentSnapshot,
      evidence: oldCitations.map((citation) => ({
        item: { title: citation.claim || citation.title || "已审核企业事实" },
        quote: citation.quote || citation.excerpt || "",
        base: { name: citation.source || citation.sourceName || "企业知识库" },
        version: { id: citation.versionId || citation.knowledgeVersionId || "", content: citation.quote || "" }
      })),
      expectedPlatforms: expectedPlatformGuidance.map((item) => item.name)
    });
  } catch (error) {
    return showToast("文章重写失败", error.message || "模型未返回符合 GEO 文章契约的结果，旧版本保持不变。", "error");
  }
  if (!remoteGeneration || typeof (remoteGeneration.html || remoteGeneration.content) !== "string") {
    return showToast("文章重写失败", "模型没有返回可编辑文章，旧版本保持不变。", "error");
  }
  archiveArticleRevision(article, "agent_regeneration", "智能体重写前");
  const newCitations = oldCitations.map((citation, index) => ({ ...cloneData(citation), id: uid("CIT") + "-K" + (index + 1), articleVersion: nextVersion, status: "needs_review" }));
  state.knowledgeCitations.push(...newCitations);
  const citationIds = newCitations.map((citation) => citation.id);
  const outputContract = buildGeoOutputContract({ ...topic, geoBrief }, newCitations, agentSnapshot, { contentType });
  article.version = nextVersion;
  article.status = "draft";
  article.reviewStatus = "pending";
  article.reviewStage = "draft";
  article.reviewSubmittedAt = null;
  article.reviewSubmittedBy = null;
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.riskStatus = "unscanned";
  article.author = "AI · " + agent.name;
  article.content = String(remoteGeneration.html || remoteGeneration.content || "");
  article.title = String(remoteGeneration.title || article.title).slice(0, 240);
  article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
  article.geoQuality = evaluateGeoArticleQuality(article.content, { ...topic, geoBrief }, newCitations);
  article.citations = citationIds;
  article.sources = citationIds.length;
  applyRemoteArticleResult(article, remoteGeneration);
  article.knowledgeSnapshot = { ...cloneData(article.knowledgeSnapshot), id: uid("KS"), capturedAt: now, frozenAt: null, citationIds };
  article.generationSnapshot = {
    ...cloneData(article.generationSnapshot),
    id: uid("GS"),
    generatedAt: now,
    generatedBy: "AI · " + agent.name,
    topicSnapshot: cloneData(topic),
    topicBrief: cloneData(geoBrief),
    model: { name: remoteGeneration.model || agentSnapshot.resolvedModel?.name || state.settings.model, promptVersion: agent.name + " v" + agent.version },
    generationMode: "model",
    generationRunId: remoteGeneration.generationRunId || remoteGeneration.runId || null,
    writingAgent: agentSnapshot,
    outputContract,
    geoQuality: article.geoQuality,
    styleGuidance: { expectedPlatforms: expectedPlatformGuidance.map((item) => item.name), platformGuidance: expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false },
    citationIds,
    promptTemplate: "由服务端 AI 生成契约驱动，运行记录已保存。",
    fingerprint: "demo-agent-" + article.id.toLowerCase() + "-" + nextVersion
  };
  article.topicSnapshot = cloneData(topic);
  article.writingAgentId = agent.id;
  article.writingAgentVersion = agent.version;
  article.writingAgentNameSnapshot = agent.name;
  article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "needs_review", evidenceCount: citationIds.length, supportedClaims: citationIds.length, message: "正文已由新智能体重写，沿用原冻结知识版本，需重新完成事实与风险审核。" };
  article.updatedAt = Date.now();
  saveState();
  closeModal();
  render();
  openArticle(article.id);
  showToast("已创建文章 " + nextVersion, "旧版本已完整保留；当前稿使用「" + agent.name + "」v" + agent.version + "，需要重新审核后发布。");
}

function renderVersionModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">关于演示版本</h2><p>Tongzhuo GEO Platform 0.4.0-demo</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="privacy-note" style="margin-top:0"><span data-icon="info"></span><span>当前版本用于确认产品结构、视觉和核心流程，所有异步发布结果均为本地模拟，不代表正式生产后台已经完成。</span></div>
      <div class="side-list" style="margin-top:16px"><div><span>后台基线</span><b>GEOFlow Laravel</b></div><div><span>拓词 / 诊断能力</span><b>GEORank FastAPI</b></div><div><span>发布执行</span><b>Windows 本地助手（待正式接入）</b></div><div><span>演示数据</span><b>浏览器 localStorage</b></div></div>
    </div>
    <div class="modal-foot"><span>源码映射见 docs/SOURCE-MAPPING.md</span><div class="modal-foot-right"><button class="primary-button" data-action="close-modal">我知道了</button></div></div>
  `);
}

function renderMonitorTaskModal() {
  const platformNames = state.monitoring.platforms.map((platform) => platform.name);
  if (!Array.isArray(ui.monitorPlatformSelection)) ui.monitorPlatformSelection = platformNames.slice();
  const selectedPlatforms = new Set(ui.monitorPlatformSelection);
  const platforms = state.monitoring.platforms.map((platform) =>
    '<label class="platform-choice ' + (selectedPlatforms.has(platform.name) ? 'selected' : '') + '"><input class="checkbox" type="checkbox" data-monitor-task-platform value="' + escapeHtml(platform.name) + '" ' + (selectedPlatforms.has(platform.name) ? 'checked' : '') + ' /><span class="ai-platform-mark">' + platform.name.slice(0, 1) + '</span><span><b>' + escapeHtml(platform.name) + '</b><small>采集回答、品牌位置与引用 URL</small></span><span class="small-tag blue">演示</span></label>'
  ).join("");
  const platformCount = state.monitoring.platforms.length;
  const lineOptions = state.businessLines.filter((line) => line.status === "active").map((line) => '<option value="' + line.id + '" ' + (line.id === ui.selectedBusinessLineId ? "selected" : "") + '>' + escapeHtml(line.name) + '</option>').join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">创建监测任务</h2><p>固定问题集、平台与入口后，才能比较不同轮次</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field-row"><div class="field"><label for="monitor-task-name">任务名称 *</label><input class="input ${ui.monitorTaskError ? "input-error" : ""}" id="monitor-task-name" value="桐灼品牌常规监测" /></div><div class="field"><label>业务线</label><select class="select" id="monitor-task-business">${lineOptions}</select></div></div>
      ${ui.monitorTaskError ? '<small class="error-text">' + escapeHtml(ui.monitorTaskError) + '</small>' : ''}
      <div class="field" style="margin-top:15px"><label>采样问题集</label><select class="select"><option>工业品 GEO 优化 · 8 个核心问题</option><option>企业 AI 落地 · 6 个核心问题</option></select><small>问题集变更后应创建新的监测口径，不覆盖历史轮次。</small></div>
      <div class="field" style="margin-top:15px"><label>AI 平台（至少选择 1 个）</label><div class="bulk-select-row">${renderSelectAllControl("monitor-platforms", platformCount, selectedPlatforms.size, "全选 AI 平台")}</div><div class="publish-platforms monitor-platform-choices">${platforms}</div></div>
      <div class="security-inline"><span data-icon="info"></span><span>原型只模拟任务创建。正式版需新增平台采集适配、调度、原始回答存证和失败重试。</span></div>
    </div>
    <div class="modal-foot"><span>执行方式：人工触发 / 定时采样</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-monitor-task"><span data-icon="plus"></span>创建任务</button></div></div>
  `, { wide: true });
}

function renderMonitorDetailModal() {
  const task = state.monitoring.tasks.find((item) => item.id === ui.modal.taskId);
  if (!task) return "";
  const platformTags = task.platforms.map((platform) => '<span class="small-tag blue">' + escapeHtml(platform) + '</span>').join("");
  const hasResult = task.status === "success" && Number(task.totalSamples) > 0;
  const statusText = hasResult ? "采样完成" : task.status === "running" ? "采样中" : task.status === "failed" ? "采样失败" : "等待首次采样";
  const sampleText = hasResult ? task.validSamples + " / " + task.totalSamples : "—";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">监测任务详情</h2><p>${task.id} · 固定问题集与平台口径</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="publish-article"><b>${escapeHtml(task.name)}</b><span>业务线：${escapeHtml(task.business)} · ${task.lastRunAt ? "最近运行 " + formatRelative(task.lastRunAt) : "尚未执行采样"}</span></div>
      <div class="side-list" style="margin-top:16px"><div><span>监测问题</span><b>${task.questionCount} 个</b></div><div><span>AI 平台</span><b>${task.platforms.length} 个</b></div><div><span>执行状态</span><b>${statusText}</b></div><div><span>有效样本</span><b>${sampleText}</b></div></div>
      <div class="topic-tags" style="margin-top:14px">${platformTags}</div>
      <div class="monitor-demo-note" style="margin:16px 0 0"><span data-icon="info"></span><span>演示任务不请求真实 AI 平台。正式结果必须保存原问题、原回答、入口、模型版本、采样时间和引用 URL。</span><span class="small-tag blue">演示</span></div>
    </div>
    <div class="modal-foot"><span>${hasResult ? "最近成功率：" + sampleText : "尚无采样结果"}</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">关闭</button><button class="primary-button" data-action="refresh-monitoring"><span data-icon="refresh"></span>${hasResult ? "执行本轮采样" : "执行首次采样"}</button></div></div>
  `);
}

function renderMonitorEvidenceModal() {
  const sample = state.monitoring.questions.find((item) => item.id === ui.modal.sampleId);
  if (!sample) return "";
  const sources = sample.sourceUrls.length
    ? sample.sourceUrls.map((url) => '<div><span>引用 URL</span><b>' + escapeHtml(url) + '</b></div>').join("")
    : '<div><span>引用 URL</span><b>本次回答未返回引用链接</b></div>';
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">AI 回答证据</h2><p>${escapeHtml(sample.id)} · 原始样本只读存证</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="monitor-demo-note" style="margin-top:0"><span data-icon="info"></span><span><b>以下为产品演示样本</b>用于确认正式版证据结构，不代表对真实 AI 平台的即时采集结果。</span><span class="small-tag blue">演示证据</span></div>
      <div class="field" style="margin-top:16px"><label>原问题</label><div class="side-panel"><h4>${escapeHtml(sample.question)}</h4><p>${escapeHtml(sample.type)} · ${escapeHtml(sample.platform)}</p></div></div>
      <div class="field" style="margin-top:16px"><label>原始回答</label><div class="side-panel"><p>${escapeHtml(sample.response)}</p></div></div>
      <div class="side-list" style="margin-top:16px">
        <div><span>平台 / 模型</span><b>${escapeHtml(sample.platform)} · ${escapeHtml(sample.model)}</b></div>
        <div><span>采样入口</span><b>${escapeHtml(sample.entrance)}</b></div>
        <div><span>采样时间</span><b>${formatRelative(sample.checkedAt)}</b></div>
        <div><span>品牌结果</span><b>${sample.mentioned ? "已提及" + (sample.rank ? " · 第 " + sample.rank + " 位" : "") : "未提及"}</b></div>
        <div><span>推荐判断</span><b>${sample.recommended ? "明确推荐" : "未形成明确推荐"}</b></div>
        ${sources}
      </div>
    </div>
    <div class="modal-foot"><span>正式版需同时保存入口、模型版本和采样时间戳</span><div class="modal-foot-right"><button class="primary-button" data-action="close-modal">关闭证据</button></div></div>
  `, { drawer: true });
}

function renderMonitorQueryModal() {
  const record = articleAssetRecords().find((item) => item.id === ui.modal.assetId);
  if (!record) return "";
  const article = record.article;
  const bound = monitoringBindingsForArticle(article.id);
  const selectedIds = new Set(bound?.questionIds || []);
  const libraryQuestions = state.questionLibrary.filter((question) => question.status === "active" && question.businessLineId === contentArticleBusinessLineId(article));
  const sampleQuestions = state.monitoring.questions.filter((question) => !libraryQuestions.some((item) => item.question === question.question));
  const customQueries = state.monitoring.customQueries || [];
  const renderOption = (question, source) => `<label class="platform-choice monitor-query-choice ${selectedIds.has(question.id) ? "selected" : ""}"><input class="checkbox" type="checkbox" data-monitor-query-id value="${escapeHtml(question.id)}" ${selectedIds.has(question.id) ? "checked" : ""} /><span class="ai-platform-mark" data-icon="help"></span><span><b>${escapeHtml(question.question)}</b><small>${escapeHtml(source)}${question.platform ? " · " + escapeHtml(question.platform) : ""}</small></span><span class="small-tag ${selectedIds.has(question.id) ? "teal" : ""}">${selectedIds.has(question.id) ? "已绑定" : "可选"}</span></label>`;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">管理监测问题</h2><p>为「${escapeHtml(article.title)}」绑定持续观察的客户问题</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="monitor-demo-note" style="margin-top:0"><span data-icon="info"></span><span><b>绑定是内容资产与监测的连接点</b>选择的问题会随这篇文章保存；之后采样回写时，引用记录会归到这篇内容资产，而不是只停留在总览。</span><span class="small-tag blue">本地演示</span></div>
      <div class="field" style="margin-top:16px"><label>问题词库</label><div class="publish-platforms monitor-platform-choices">${libraryQuestions.length ? libraryQuestions.map((question) => renderOption(question, "选题中心问题词库")).join("") : '<div class="empty-state compact"><p>当前业务线还没有可用问题。</p></div>'}</div></div>
      <div class="field" style="margin-top:16px"><label>已有 AI 监测样本</label><div class="publish-platforms monitor-platform-choices">${sampleQuestions.length ? sampleQuestions.map((question) => renderOption(question, "已有演示采样")).join("") : '<div class="empty-state compact"><p>暂无可复用样本。</p></div>'}</div></div>
      ${customQueries.length ? `<div class="field" style="margin-top:16px"><label>已保存的自定义问题</label><div class="publish-platforms monitor-platform-choices">${customQueries.map((question) => renderOption(question, "自定义监测问题")).join("")}</div></div>` : ""}
      <div class="field" style="margin-top:16px"><label for="monitor-custom-question">补充自定义问题（可选）</label><textarea class="textarea" id="monitor-custom-question" rows="2" placeholder="例如：客户在 AI 中会如何询问这项服务？"></textarea><small>保存时会将它加入当前资产的监测问题，不会自动写入选题中心。</small></div>
    </div>
    <div class="modal-foot"><span>当前已绑定 ${selectedIds.size} 个问题</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-monitor-queries" data-asset-id="${escapeHtml(record.id)}"><span data-icon="check"></span>保存绑定</button></div></div>
  `, { wide: true });
}

function renderSourceWorksModal() {
  const source = monitoringSourceRecords().find((item) => item.domain === ui.modal.sourceDomain);
  if (!source) return "";
  const works = monitoringWorksForSource(source.domain);
  const rows = works.map((work) => `<button class="monitor-task-row" type="button" data-action="edit-tracked-work" data-work-id="${escapeHtml(work.id)}"><span class="monitor-task-icon" data-icon="file"></span><span><b>${escapeHtml(work.title)}</b><small>${escapeHtml(work.url || "未记录 URL")} · ${Number(work.questions || work.questionIds?.length || 0)} 个问题</small></span><span><b>${Number(work.citations || 0)} 次</b><small>累计引用</small></span>${work.citations ? statusBadge("success") : statusBadge("queued")}</button>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(source.name)} · 作品</h2><p>${escapeHtml(source.domain)} · ${works.length} 篇已纳入引用追踪</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="side-list"><div><span>来源类型</span><b>${escapeHtml(source.type)}</b></div><div><span>累计引用</span><b>${Number(source.citations || 0)} 次</b></div><div><span>关联问题</span><b>${Number(source.questions || 0)} 个</b></div></div><div class="monitor-task-list" style="margin-top:16px">${rows || '<div class="empty-state compact"><p>还没有为这个来源补录作品。</p></div>'}</div></div>
    <div class="modal-foot"><span>点击作品可以修改追踪信息</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button><button class="primary-button" type="button" data-action="add-tracked-work" data-source-domain="${escapeHtml(source.domain)}" data-source-name="${escapeHtml(source.name)}" data-source-type="${escapeHtml(source.type)}"><span data-icon="plus"></span>添加作品</button></div></div>
  `, { wide: true });
}

function renderTrackedWorkModal() {
  const existing = ui.modal.workId ? state.monitoring.trackedWorks.find((item) => item.id === ui.modal.workId) : null;
  const sourceDomain = existing?.sourceDomain || ui.modal.sourceDomain || "";
  const articleOptions = [`<option value="">不关联后台文章（外部作品）</option>`].concat(state.articles.map((article) => `<option value="${escapeHtml(article.id)}" ${(existing?.articleId || "") === article.id ? "selected" : ""}>${escapeHtml(article.title)}</option>`)).join("");
  const siteType = existing?.type || ui.modal.sourceType || "官网";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${existing ? "编辑追踪作品" : "添加追踪作品"}</h2><p>记录作品和来源，供后续 AI 引用证据回写</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="tracked-work-article">关联后台文章（可选）</label><select class="select" id="tracked-work-article">${articleOptions}</select><small>关联后，引用次数会同步展示在对应内容资产中。</small></div>
      <div class="field-row" style="margin-top:15px"><div class="field"><label for="tracked-work-title">作品标题 *</label><input class="input" id="tracked-work-title" value="${escapeHtml(existing?.title || "")}" placeholder="请输入文章或作品标题" /></div><div class="field"><label for="tracked-work-type">站点类型</label><select class="select" id="tracked-work-type">${["官网", "公众号", "内容平台", "行业媒体", "其他"].map((item) => `<option ${siteType === item ? "selected" : ""}>${item}</option>`).join("")}</select></div></div>
      <div class="field-row"><div class="field"><label for="tracked-work-site">发布站点 *</label><input class="input" id="tracked-work-site" value="${escapeHtml(existing?.site || ui.modal.sourceName || "")}" placeholder="例如：桐灼企业官网" /></div><div class="field"><label for="tracked-work-domain">来源域名 *</label><input class="input" id="tracked-work-domain" value="${escapeHtml(sourceDomain)}" placeholder="例如：tongzhuo.com" /></div></div>
      <div class="field"><label for="tracked-work-url">作品 URL（可选）</label><input class="input" id="tracked-work-url" value="${escapeHtml(existing?.url || "")}" placeholder="https://" /></div>
      <div class="field-row"><div class="field"><label for="tracked-work-questions">关联问题数</label><input class="input" id="tracked-work-questions" type="number" min="0" value="${Number(existing?.questions || existing?.questionIds?.length || 0)}" /></div><div class="field"><label for="tracked-work-citations">已记录引用次数</label><input class="input" id="tracked-work-citations" type="number" min="0" value="${Number(existing?.citations || 0)}" /></div></div>
    </div>
    <div class="modal-foot"><span>${existing ? `创建于 ${formatDateTime(existing.createdAt)}` : "保存后将进入作品引用追踪"}</span><div class="modal-foot-right">${existing ? `<button class="danger-button" type="button" data-action="delete-tracked-work" data-work-id="${escapeHtml(existing.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-tracked-work" data-work-id="${escapeHtml(existing?.id || "")}"><span data-icon="check"></span>保存作品</button></div></div>
  `, { wide: true });
}

function renderModelEditorModal() {
  const kind = ui.modal.modelKind === "image" ? "image" : "text";
  const isText = kind === "text";
  const current = isText ? state.settings.model : state.settings.imageModel;
  const providerKey = isText ? "modelProviderId" : "imageProviderId";
  const selectedProviderId = state.settings[providerKey] || "";
  const providers = (aiProviderSnapshot.providers || []).filter((provider) => provider.status !== "disabled");
  const providerOptions = [`<option value="">不绑定 API 供应商（仅保存模型名称）</option>`, ...providers.map((provider) => `<option value="${escapeHtml(provider.id)}" ${selectedProviderId === provider.id ? "selected" : ""}>${escapeHtml(provider.name)} · ${escapeHtml(provider.model || "未填写模型")}</option>`)].join("");
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">更换默认${isText ? "文本" : "图片"}模型</h2><p>选择已配置的 API 供应商；已有文章仍使用生成时保存的模型快照。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body model-editor-body"><div class="field"><label for="model-provider">API 供应商</label><select class="select" id="model-provider">${providerOptions}</select><small>${selectedProvider ? `${escapeHtml(selectedProvider.apiKeyMasked || "未配置 API Key")} · ${escapeHtml(aiProviderProtocolLabel(selectedProvider.protocol))}` : "尚未绑定供应商时不会发起真实 API 请求。"}</small></div><div class="field" style="margin-top:15px"><label for="model-custom-name">模型 ID / 名称 *</label><input class="input" id="model-custom-name" value="${escapeHtml(current)}" placeholder="例如：deepseek-chat、gpt-4o-mini、qwen-plus" /><small>选择供应商后，留空会使用供应商默认模型。</small></div><button class="secondary-button" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>没有供应商？添加 API</button><div class="privacy-note" style="margin-top:4px"><span data-icon="lock"></span><span>API Key 只保存在服务端并以掩码显示，浏览器不会保存原始密钥。</span></div></div>
    <div class="modal-foot"><span>当前：${escapeHtml(current)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-model" data-model-kind="${kind}"><span data-icon="check"></span>保存模型</button></div></div>
  `);
}

function renderAiProviderModal() {
  const existing = ui.modal.providerId ? (aiProviderSnapshot.providers || []).find((provider) => provider.id === ui.modal.providerId) : null;
  const provider = existing || { name: "", baseUrl: "", model: "", protocol: "openai_compatible", kind: "text", status: "enabled" };
  const protocolOptions = [["openai_compatible", "OpenAI 兼容接口"], ["deepseek", "DeepSeek"], ["qwen", "通义千问"], ["kimi", "Kimi / Moonshot"], ["zhipu", "智谱 GLM"], ["custom", "自定义接口"]].map(([value, label]) => `<option value="${value}" ${provider.protocol === value ? "selected" : ""}>${label}</option>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${existing ? "编辑 API 供应商" : "添加 API 供应商"}</h2><p>配置一次后，文本、图片或向量模型都可以在对应的“更换模型”入口中选择。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body ai-provider-form"><div class="ai-provider-form-note"><span data-icon="shield"></span><div><b>密钥安全</b><small>原始 API Key 只提交到客户服务器，列表和页面永远只显示掩码。</small></div></div><div class="field-row"><div class="field"><label for="ai-provider-name">供应商名称 *</label><input class="input" id="ai-provider-name" value="${escapeHtml(provider.name)}" placeholder="例如：公司 DeepSeek" /></div><div class="field"><label for="ai-provider-protocol">接口类型</label><select class="select" id="ai-provider-protocol">${protocolOptions}</select></div></div><div class="field"><label for="ai-provider-base-url">API Base URL *</label><input class="input" id="ai-provider-base-url" value="${escapeHtml(provider.baseUrl)}" placeholder="例如：https://api.deepseek.com/v1" /><small>只填写服务端 API 地址，不要把模型路径重复拼接。</small></div><div class="field-row"><div class="field"><label for="ai-provider-key">API Key ${existing ? "（留空保持不变）" : "*"}</label><input class="input" id="ai-provider-key" type="password" value="" placeholder="${escapeHtml(existing?.apiKeyMasked || "sk-...")}" autocomplete="new-password" /></div><div class="field"><label for="ai-provider-model">默认模型 ID *</label><input class="input" id="ai-provider-model" value="${escapeHtml(provider.model || "")}" placeholder="例如：deepseek-chat" /></div></div><div class="field-row"><div class="field"><label for="ai-provider-kind">模型用途</label><select class="select" id="ai-provider-kind"><option value="text" ${provider.kind === "text" ? "selected" : ""}>文本模型</option><option value="image" ${provider.kind === "image" ? "selected" : ""}>图片模型</option><option value="embedding" ${provider.kind === "embedding" ? "selected" : ""}>向量模型</option></select></div><div class="field"><label for="ai-provider-status">供应商状态</label><select class="select" id="ai-provider-status"><option value="enabled" ${provider.status !== "disabled" ? "selected" : ""}>启用</option><option value="disabled" ${provider.status === "disabled" ? "selected" : ""}>停用</option></select></div></div><div class="privacy-note"><span data-icon="info"></span><span>测试连接目前只验证配置状态，不会向外部模型发送文章内容。正式接入生成服务时，调用仍由客户服务器完成。</span></div></div>
    <div class="modal-foot"><span>${existing ? `供应商 ID：${escapeHtml(existing.id)}` : "保存后可立即测试连接"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="ghost-button" type="button" data-action="test-ai-provider-draft"><span data-icon="check"></span>保存并测试</button><button class="primary-button" type="button" data-action="save-ai-provider" data-provider-id="${escapeHtml(existing?.id || "")}"><span data-icon="check"></span>保存供应商</button></div></div>
  `, { wide: true });
}

function renderMemberEditorModal() {
  const existing = ui.modal.memberId ? state.settings.members.find((member) => member.id === ui.modal.memberId) : null;
  const role = existing?.role || "内容运营";
  const status = existing?.status || "invited";
  const adminCount = (state.settings.members || []).filter((member) => member.role === "管理员" && member.status !== "disabled").length;
  const canDelete = !existing || !(existing.role === "管理员" && adminCount <= 1);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${existing ? "管理成员" : "邀请成员"}</h2><p>${existing ? "修改角色或停用成员；修改会立即保存在当前演示空间。" : "保存后会创建一条待接受的演示邀请记录。"}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="field-row"><div class="field"><label for="member-name">姓名 *</label><input class="input" id="member-name" value="${escapeHtml(existing?.name || "")}" placeholder="请输入成员姓名" /></div><div class="field"><label for="member-email">邮箱 *</label><input class="input" id="member-email" type="email" value="${escapeHtml(existing?.email || "")}" placeholder="name@company.com" /></div></div><div class="field-row"><div class="field"><label for="member-role">角色</label><select class="select" id="member-role">${["管理员", "内容运营", "审核人员", "只读成员"].map((item) => `<option ${role === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label for="member-status">状态</label><select class="select" id="member-status">${[["active", "已启用"], ["invited", "待接受"], ["disabled", "已停用"]].map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div><div class="privacy-note" style="margin-top:16px"><span data-icon="info"></span><span>正式版可连接企业 SSO 或邮件服务；当前演示仅保存成员和权限状态，不会实际发送邮件。</span></div></div>
    <div class="modal-foot"><span>${existing?.lastLoginAt ? "最近登录：" + formatDateTime(existing.lastLoginAt) : "尚未登录"}</span><div class="modal-foot-right">${existing ? `<button class="danger-button" type="button" data-action="delete-member" data-member-id="${escapeHtml(existing.id)}" ${canDelete ? "" : "disabled"}>删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-member" data-member-id="${escapeHtml(existing?.id || "")}"><span data-icon="check"></span>${existing ? "保存修改" : "保存邀请"}</button></div></div>
  `);
}

function riskRuleEntries(type) {
  const record = state.knowledge?.[type] || {};
  if (Array.isArray(record.entries) && record.entries.length) return record.entries.map((entry) => String(entry).trim()).filter(Boolean);
  const content = record.content === undefined ? legacyKnowledgeDefaultContent(type) : record.content;
  return String(content || "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function riskTermsFromEntry(entry) {
  const quoted = [...String(entry).matchAll(/[“\"]([^”\"]+)[”\"]/g)].map((match) => match[1].trim()).filter(Boolean);
  if (quoted.length) return quoted;
  if (String(entry).length <= 30) return [String(entry).trim()];
  return String(entry).split(/[、，,；;]/).map((part) => part.replace(/^(禁止使用|禁止|不得|涉及|命中后|需要)/, "").trim()).filter((part) => part.length >= 2 && part.length <= 24);
}

function scanArticleRisk(article) {
  const plainText = `${article.title || ""}\n${studioPlainText(article.content || "")}`;
  const definitions = [
    { type: "banned", label: "企业禁用表述", level: "blocked", message: "命中企业明确禁用的对外表述，修改后才能提交审核。" },
    { type: "sensitive", label: "企业敏感规则", level: "warning", message: "涉及企业敏感信息或公开边界，需要人工核对。" },
    { type: "adLaw", label: "广告法规则", level: "warning", message: "可能属于绝对化或无法证明的效果表述，需要补充证据与适用边界。" }
  ];
  const hits = [];
  const seen = new Set();
  definitions.forEach((definition) => {
    riskRuleEntries(definition.type).forEach((entry, entryIndex) => {
      riskTermsFromEntry(entry).forEach((term) => {
        const normalized = term.trim();
        if (!normalized || seen.has(`${definition.type}:${normalized}`)) return;
        seen.add(`${definition.type}:${normalized}`);
        const index = plainText.indexOf(normalized);
        if (index < 0) return;
        hits.push({
          id: `${definition.type}-${entryIndex}-${hits.length + 1}`,
          type: definition.type,
          label: definition.label,
          level: definition.level,
          term: normalized,
          rule: entry,
          excerpt: plainText.slice(Math.max(0, index - 28), Math.min(plainText.length, index + normalized.length + 42)).replace(/\s+/g, " "),
          message: definition.message
        });
      });
    });
  });
  const status = hits.some((hit) => hit.level === "blocked") ? "blocked" : hits.length ? "warning" : "clean";
  return {
    status,
    articleVersion: article.version,
    scannedAt: new Date().toISOString(),
    ruleVersions: Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, Number(state.knowledge?.[type]?.version || 0)])),
    ruleCounts: Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, riskRuleEntries(type).length])),
    hits
  };
}

function applyArticleRiskScan(article) {
  const scan = scanArticleRisk(article);
  article.riskStatus = scan.status;
  article.riskScan = scan;
  article.updatedAt = Date.now();
  return scan;
}

function renderRiskModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return "";
  const riskStatus = article.riskStatus || "unscanned";
  const scan = article.riskScan?.articleVersion === article.version ? article.riskScan : null;
  const hits = scan?.hits || [];
  const needsScan = ["unscanned", "stale"].includes(riskStatus) || !scan && ["warning", "blocked"].includes(riskStatus);
  const statusTitle = riskStatus === "blocked" ? `命中 ${hits.filter((hit) => hit.level === "blocked").length || 1} 条阻断规则` : riskStatus === "warning" ? `命中 ${hits.length || 1} 条需复核规则` : riskStatus === "stale" ? "旧结果已过期" : riskStatus === "unscanned" ? "当前版本尚未检测" : "当前版本通过风控";
  let result = '<div class="empty-state" style="min-height:180px"><div><span data-icon="shield"></span><h3>当前版本通过风控</h3><p>没有命中当前企业内容规则；修改正文或规则后需要重新检测。</p></div></div>';
  if (hits.length) result = `<div class="risk-issue-list">${hits.map((hit) => `<div class="risk-issue"><span class="status-badge ${hit.level === "blocked" ? "status-error" : "status-review"}">${hit.level === "blocked" ? "阻断" : "复核"}</span><div><b>${escapeHtml(hit.label)} · 命中“${escapeHtml(hit.term)}”</b><p>片段：${escapeHtml(hit.excerpt)}</p><small>${escapeHtml(hit.message)}<br />规则：${escapeHtml(hit.rule)}</small></div></div>`).join("")}</div>`;
  if (needsScan) result = '<div class="empty-state" style="min-height:180px"><div><span data-icon="refresh"></span><h3>' + (riskStatus === "stale" ? "正文已变化" : scan ? "规则已变化" : "尚无可追溯检测明细") + '</h3><p>请重新检测当前文章版本，再进入审核与发布。</p></div></div>';
  const counts = scan?.ruleCounts || Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, riskRuleEntries(type).length]));
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">内容风控详情</h2><p>${article.id} · ${article.version} · 风控结果绑定当前文章版本与规则版本</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="risk-overview ${riskStatus !== "clean" ? "warning" : "clean"}"><span class="risk-state-icon ${riskStatus !== "clean" ? "warning" : ""}" data-icon="shield"></span><div><b>${statusTitle}</b><p>实际检查企业维护的广告法规则、敏感规则和禁用表述，并保存命中片段。</p></div></div>
      ${result}
      <div class="risk-rule-grid"><div><b>${counts.adLaw || 0}</b><span>广告法规则</span></div><div><b>${counts.sensitive || 0}</b><span>企业敏感规则</span></div><div><b>${counts.banned || 0}</b><span>企业禁用表述</span></div><div><b>${articleCitations(article).length}</b><span>企业事实证据</span></div></div>
    </div>
    <div class="modal-foot"><span>检测时间：${scan?.scannedAt ? new Date(scan.scannedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未检测"}</span><div class="modal-foot-right"><button class="secondary-button" data-action="back-article" data-article-id="${article.id}">返回文章</button><button class="primary-button" data-action="run-risk-scan" data-article-id="${article.id}"><span data-icon="refresh"></span>重新检测</button></div></div>
  `, { wide: true });
}

function renderResetModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">重置演示数据</h2><p>恢复到第一次打开时的示例状态</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="privacy-note" style="margin-top:0;border-color:#f0c8cc;background:var(--red-soft)"><span data-icon="alert" style="color:var(--red)"></span><span>这只会清除当前浏览器中的演示操作记录，不会删除工作区文件，也不会影响任何旧工程。</span></div></div>
    <div class="modal-foot"><span></span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="danger-button" data-action="confirm-reset">确认重置</button></div></div>
  `);
}

function addBusinessKeywords() {
  const line = activeBusinessLine();
  const values = [...new Set(ui.businessKeywordInput.split(/[，,;；\n]/).map((value) => value.trim()).filter(Boolean))];
  if (!line || !values.length) {
    ui.businessKeywordError = "请至少输入 1 个关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (values.length > 20) {
    ui.businessKeywordError = "一次最多添加 20 个关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (values.some((value) => value.length > 40)) {
    ui.businessKeywordError = "单个关键词不能超过 40 个字。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  const existing = new Set(state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active").map((item) => item.term.toLowerCase()));
  const added = values.filter((value) => !existing.has(value.toLowerCase()));
  if (!added.length) {
    ui.businessKeywordError = "这些关键词已存在于当前业务线。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  state.keywords.unshift(...added.map((term, index) => ({ id: uid("KW") + index, businessLineId: line.id, term, type: "核心关键词", keywordRole: "core", source: "手动添加", status: "active", createdAt: Date.now() })));
  ui.businessKeywordInput = "";
  ui.businessKeywordError = "";
  saveState();
  render();
  showToast("核心关键词已新增", "已向「" + line.name + "」新增 " + added.length + " 个核心关键词；勾选后即可智能拓展种子词。");
}

function addQuestionToLibrary() {
  const line = activeBusinessLine();
  const question = ui.questionInput.trim();
  if (!question) {
    ui.questionError = "请输入客户问题。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  if (question.length > 120) {
    ui.questionError = "问题不能超过 120 个字。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  const duplicate = state.questionLibrary.some((item) => item.businessLineId === line.id && item.question.toLowerCase() === question.toLowerCase() && item.status === "active");
  if (duplicate) {
    ui.questionError = "问题词库中已经存在相同问题。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  const manualQuestion = { id: uid("Q"), packId: null, businessLineId: line.id, sourceKeyword: "人工录入", question, dimension: "question", intent: "待判断", stage: "待判断", coverage: "未覆盖", source: "手动添加", status: "active", version: 1, topicId: null, selected: false, recommendation: 80, createdAt: Date.now(), updatedAt: Date.now() };
  manualQuestion.geoIntent = buildGeoQuestionIntent(manualQuestion);
  state.questionLibrary.unshift(manualQuestion);
  ui.questionInput = "";
  ui.questionError = "";
  saveState();
  render();
  showToast("问题已加入词库", "可以继续勾选问题并生成正式选题。");
}

function saveSelectedQuestions() {
  const line = activeBusinessLine();
  const selected = state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived" && question.selected);
  if (!selected.length) return showToast("还没有选择问题", "请先勾选至少一个拓展结果。", "error");
  const affectedPackIds = new Set(selected.map((question) => question.packId).filter(Boolean));
  selected.forEach((question) => { question.status = "active"; question.version = Number(question.version) || 1; question.updatedAt = Date.now(); question.selected = false; });
  affectedPackIds.forEach((packId) => updateKeywordPackTotal(state.keywordPacks.find((pack) => pack.id === packId)));
  ui.planningTab = "questions";
  saveState();
  render();
  showToast("问题已入库", "已保存 " + selected.length + " 个标准问题，下一步可以生成选题。");
}

function normalizeAiTopicCandidate(item, sourceQuestion, index, generationRunId = null) {
  if (!item || typeof item !== "object" || !sourceQuestion) throw new Error("模型返回的选题缺少来源问题");
  const title = String(item.title || "").trim();
  if (!title) throw new Error("模型返回了空的选题标题");
  const coreQuestion = String(item.core_question || item.coreQuestion || title || sourceQuestion.question).trim();
  if (!coreQuestion) throw new Error("模型返回的选题缺少核心回答问题");
  const quality = item.quality || {};
  const topic = {
    id: `TOP-AI-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    packId: sourceQuestion.packId || null,
    businessLineId: sourceQuestion.businessLineId,
    questionId: sourceQuestion.id,
    questionSnapshot: cloneData(sourceQuestion),
    keyword: sourceQuestion.sourceKeyword,
    title: title.slice(0, 240),
    coreQuestion: coreQuestion.slice(0, 240),
    dimension: sourceQuestion.dimension,
    intent: String(item.user_intent || sourceQuestion.intent || "客户问答"),
    recommendation: Math.max(0, Math.min(100, Number(quality.recommendation_score ?? sourceQuestion.recommendation ?? 0) || 0)),
    business: Math.max(0, Math.min(100, Number(quality.business_score ?? sourceQuestion.business ?? 0) || 0)),
    coverage: "未覆盖",
    reason: `由客户问题生成：${sourceQuestion.question}`,
    source: "AI 模型选题",
    generationRunId: item.generationRunId || item.generation_run_id || generationRunId || null,
    status: "candidate",
    version: 1,
    selected: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  topic.geoIntent = {
    ...(sourceQuestion.geoIntent || buildGeoQuestionIntent(sourceQuestion)),
    coreQuestion,
    expectedAnswer: String(item.content_direction || "先回答客户问题，再给出依据、适用条件、步骤和边界。"),
    evidenceNeeds: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String) : sourceQuestion.evidenceRequirements || []
  };
  topic.geoBrief = {
    ...buildGeoTopicBrief(topic, sourceQuestion),
    title: topic.title,
    coreQuestion,
    contentDirection: String(item.content_direction || "").slice(0, 2000),
    userIntent: topic.intent,
    answerOutline: Array.isArray(item.answer_outline) ? item.answer_outline.map(String).slice(0, 12) : [],
    evidenceRequirements: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String).slice(0, 20) : [],
    proofPoints: Array.isArray(item.proof_points) ? item.proof_points.map(String).slice(0, 20) : [],
    audienceBoundary: String(item.audience_boundary || "").slice(0, 1000),
    sourceQuestionId: sourceQuestion.id
  };
  return topic;
}

async function questionsToTopics(questionIds = null) {
  const line = activeBusinessLine();
  const questions = state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status === "active" && (questionIds ? questionIds.includes(question.id) : question.selected));
  if (!questions.length) return showToast("还没有选择问题", "请先勾选至少一个问题再生成选题。", "error");
  const providerId = selectedTextProviderId();
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const pending = questions.filter((question) => !planningQuestionTopics(question).some((topic) => topic.status !== "archived"));
  if (!pending.length) {
    ui.planningTab = "topics";
    render();
    return showToast("选题已经存在", "所选问题都已关联选题，已切换到选题库。");
  }
  ui.topicGenerating = true;
  render();
  try {
    const payload = await aiApi("/api/ai/generate/topics", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: aiBusinessLinePayload(line),
        questions: pending.map((question) => ({
          id: question.id,
          question: question.question,
          dimension: question.dimension,
          sourceKeyword: question.sourceKeyword,
          coverage: question.coverage
        })),
        existingTopics: state.topics
          .filter((topic) => topicBusinessLineId(topic) === line.id && topic.status !== "archived")
          .map((topic) => topic.title)
          .filter(Boolean)
          .slice(-100)
      }
    });
    const data = payload.data || payload;
    const rawTopics = data.topics || data.items || [];
    if (!Array.isArray(rawTopics) || rawTopics.length !== pending.length) throw new Error("模型没有为每个问题返回一个选题");
    const created = [];
    rawTopics.forEach((item, index) => {
      const sourceId = item.question_id || item.questionId || item.sourceQuestionId;
      const sourceQuestion = pending.find((question) => String(question.id) === String(sourceId) || question.question === String(item.question || item.primary_question || "")) || pending[index];
      const topic = normalizeAiTopicCandidate(item, sourceQuestion, index, data.generationRunId || data.runId || null);
      const existing = planningQuestionTopics(sourceQuestion).find((candidate) => candidate.status !== "archived");
      if (existing) return;
      state.topics.unshift(topic);
      sourceQuestion.topicId = topic.id;
      sourceQuestion.coverage = topic.status === "candidate" ? "待确认选题" : "已规划";
      sourceQuestion.updatedAt = Date.now();
      sourceQuestion.selected = false;
      created.push(topic);
    });
    pending.filter((question) => !created.some((topic) => topic.questionId === question.id)).forEach((question) => { question.selected = false; });
    ui.topicGenerating = false;
    ui.planningTab = "topics";
    saveState();
    render();
    showToast("选题候选已生成", "模型已为 " + created.length + " 个客户问题生成对应选题 Brief，请逐条编辑并人工确认后再生成文章或加入计划。");
  } catch (error) {
    ui.topicGenerating = false;
    saveState();
    render();
    showToast("选题生成失败", error.message || "模型未返回完整选题，请检查配置后重试。", "error");
  }
}

function submitKnowledgeBase() {
  const nameInput = document.getElementById("knowledge-base-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("知识库名称不能为空", "请填写一个便于运营人员识别的名称。", "error");
  }
  if ((state.knowledgeBases || []).some((base) => base.name.toLowerCase() === name.toLowerCase())) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("知识库名称已存在", "请进入现有知识库，或使用其他名称。", "error");
  }
  const kind = document.querySelector('input[name="knowledge-kind"]:checked')?.value || "document";
  const scope = document.getElementById("knowledge-base-scope")?.value || "business_line";
  const businessLineId = scope === "enterprise" ? null : document.getElementById("knowledge-base-line")?.value || activeBusinessLine()?.id || null;
  const base = {
    id: uid("KB"), name, kind, scope, businessLineId, isDefault: false, indexStrategy: "rag", status: "ready",
    description: document.getElementById("knowledge-base-description")?.value.trim() || (kind === "qa" ? "企业认可的标准问题与标准回答。" : "已审核后用于企业内容生产的资料。"),
    itemIds: [], createdAt: Date.now(), updatedAt: Date.now()
  };
  state.knowledgeBases.unshift(base);
  saveState();
  render();
  ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
  renderModal();
  showToast("知识库已创建", "已创建「" + name + "」，现在可以添加" + (kind === "qa" ? "标准问答" : "文档资料") + "。");
}

async function submitKnowledgeImport() {
  const base = knowledgeBaseById(document.getElementById("knowledge-import-base")?.value);
  const fileInput = document.getElementById("knowledge-import-file");
  const file = fileInput?.files?.[0] || null;
  const pasted = document.getElementById("knowledge-import-content")?.value.trim() || "";
  if (!base || base.kind !== "document") return showToast("请选择文档知识库", "导入资料必须进入一个有效的文档知识库。", "error");
  if (!file) {
    fileInput?.classList.add("input-error");
    fileInput?.focus();
    return showToast("请选择资料文件", "选择文件后再导入；演示版不会把原文件写入浏览器存储。", "error");
  }
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  const textLike = String(file.type || "").startsWith("text/") || ["txt", "md", "csv", "html", "htm", "json", "xml"].includes(extension);
  let content = pasted;
  let importStatus = "ready";
  if (!content && textLike) {
    try { content = (await file.text()).trim(); } catch { content = ""; }
  }
  if (content.length > 120000) content = content.slice(0, 120000) + "\n\n[演示版仅保留前 120000 个字符，正式版由服务器完整解析并分块]";
  if (!content) {
    importStatus = "pending_parse";
    content = `文件已登记：${file.name}\n类型：${file.type || extension || "未知"}\n大小：${Math.max(1, Math.ceil(Number(file.size || 0) / 1024))} KB\n\n当前演示环境未解析该文件正文，请打开此条目补充正文后再提交审核。`;
  }
  const itemId = uid("KI-IMPORT");
  const versionId = uid("KV-IMPORT") + "-V1";
  const now = Date.now();
  const item = {
    id: itemId,
    knowledgeBaseId: base.id,
    kind: "document",
    title: file.name.replace(/\.[^.]+$/, "") || file.name,
    category: "导入资料",
    status: importStatus === "ready" ? "pending_review" : "draft",
    visibility: "public",
    latestVersionId: versionId,
    sourceName: file.name,
    locator: importStatus === "ready" ? "文件正文" : "待解析文件",
    importStatus,
    sourceFile: { name: file.name, type: file.type || "application/octet-stream", size: Number(file.size || 0), extension },
    tags: [],
    createdAt: now,
    updatedAt: now
  };
  const version = {
    id: versionId,
    itemId,
    version: 1,
    reviewStatus: importStatus === "ready" ? "pending_review" : "draft",
    reviewedBy: null,
    reviewedAt: null,
    content,
    sourceName: file.name,
    locator: item.locator,
    chunks: [{ id: uid("KC"), section: item.locator, text: content }],
    createdAt: now
  };
  state.knowledgeItems.push(item);
  state.knowledgeVersions.push(version);
  base.itemIds = [...new Set([...(base.itemIds || []), itemId])];
  base.updatedAt = now;
  addOperationLog("企业知识", `导入资料「${file.name}」到知识库「${base.name}」`);
  saveState();
  render();
  ui.modal = importStatus === "ready" ? { type: "knowledgeBaseDetail", baseId: base.id } : { type: "knowledgeItem", baseId: base.id, itemId };
  renderModal();
  showToast(importStatus === "ready" ? "资料已导入待审核" : "文件已登记，等待补充正文", importStatus === "ready" ? "已提取可读取文字，人工审核通过后才会进入 RAG。" : "PDF / Word 正文未在浏览器解析，请在当前条目中补充正文再提交审核。", importStatus === "ready" ? "success" : "warning");
}

function submitKnowledgeItem(baseId) {
  const base = knowledgeBaseById(baseId);
  if (!base) return showToast("知识库不存在", "请刷新页面后重试。", "error");
  const question = document.getElementById("knowledge-item-question")?.value.trim() || "";
  const title = base.kind === "qa" ? question : document.getElementById("knowledge-item-title")?.value.trim() || "";
  const content = document.getElementById("knowledge-item-content")?.value.trim() || "";
  if (!title || !content) return showToast("知识内容不完整", base.kind === "qa" ? "请填写标准问题和企业标准答案。" : "请填写资料标题和资料原文。", "error");
  const itemId = uid("KI");
  const versionId = uid("KV") + "-V1";
  const item = {
    id: itemId, knowledgeBaseId: base.id, kind: base.kind, title, question: base.kind === "qa" ? question : undefined,
    category: base.kind === "qa" ? "FAQ" : "企业资料", status: "pending_review", visibility: document.getElementById("knowledge-item-visibility")?.value || "public",
    latestVersionId: versionId, sourceName: document.getElementById("knowledge-item-source")?.value.trim() || (base.kind === "qa" ? "企业标准问答" : "手动录入"),
    locator: document.getElementById("knowledge-item-locator")?.value.trim() || (base.kind === "qa" ? "标准答案" : "正文"),
    gapId: ui.modal.gapId || null, tags: [], createdAt: Date.now(), updatedAt: Date.now()
  };
  const version = {
    id: versionId, itemId, version: 1, reviewStatus: "pending_review", reviewedBy: null, reviewedAt: null, content,
    sourceName: item.sourceName, locator: item.locator, chunks: [{ id: uid("KC"), section: item.locator, text: content }]
  };
  state.knowledgeItems.push(item);
  state.knowledgeVersions.push(version);
  base.itemIds = [...new Set([...(base.itemIds || []), itemId])];
  base.updatedAt = Date.now();
  saveState();
  render();
  ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
  renderModal();
  showToast("知识已提交审核", "审核通过前不会进入文章生成。", "success");
}

function updateKnowledgeItem(itemId) {
  const item = knowledgeItemById(itemId);
  const base = item && knowledgeBaseById(item.knowledgeBaseId);
  const current = item && knowledgeVersionById(item.latestVersionId);
  if (!item || !base || !current) return showToast("知识条目不存在", "请刷新后重试。", "error");
  const question = document.getElementById("knowledge-item-question")?.value.trim() || "";
  const title = base.kind === "qa" ? question : document.getElementById("knowledge-item-title")?.value.trim() || "";
  const content = document.getElementById("knowledge-item-content")?.value.trim() || "";
  if (!title || !content) return showToast("知识内容不完整", "请填写标题（或标准问题）和正文后再保存。", "error");
  const sourceName = document.getElementById("knowledge-item-source")?.value.trim() || knowledgeSourceLabel(item, current);
  const locator = document.getElementById("knowledge-item-locator")?.value.trim() || knowledgeLocator(item, current);
  const nextNumber = Number(current.version || 0) + 1;
  const versionId = uid("KV") + "-V" + nextNumber;
  const next = {
    id: versionId,
    itemId: item.id,
    version: nextNumber,
    reviewStatus: "pending_review",
    reviewedBy: null,
    reviewedAt: null,
    content,
    sourceName,
    locator,
    chunks: [{ id: uid("KC"), section: locator, text: content }],
    createdAt: Date.now(),
    supersedesVersionId: current.id
  };
  state.knowledgeVersions.push(next);
  item.title = title;
  if (base.kind === "qa") item.question = question;
  item.sourceName = sourceName;
  item.locator = locator;
  item.visibility = document.getElementById("knowledge-item-visibility")?.value || item.visibility || "public";
  item.latestVersionId = versionId;
  item.status = "pending_review";
  if (item.importStatus === "pending_parse") item.importStatus = "ready";
  item.updatedAt = Date.now();
  base.status = "ready";
  base.updatedAt = Date.now();
  saveState();
  ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
  render();
  renderModal();
  showToast("知识新版本已提交审核", `${title} 已创建 v${nextNumber}；审核期间暂停用于新文章，历史引用保持不变。`);
}

function approveKnowledgeItem(itemId) {
  const item = knowledgeItemById(itemId);
  const version = item && knowledgeVersionById(item.latestVersionId);
  if (!item || !version) return showToast("知识版本不存在", "请刷新后重试。", "error");
  if (item.importStatus === "pending_parse") return showToast("文件正文尚未解析", "请先打开条目补充并保存正文，再提交人工审核。", "error");
  item.status = "approved";
  item.updatedAt = Date.now();
  version.reviewStatus = "approved";
  version.reviewedBy = "王宁";
  version.reviewedAt = new Date().toISOString();
  const base = knowledgeBaseById(item.knowledgeBaseId);
  if (base) { base.status = "ready"; base.updatedAt = Date.now(); }
  if (item.gapId) {
    const gap = state.knowledgeGaps.find((entry) => entry.id === item.gapId);
    if (gap) { gap.status = "resolved"; gap.resolvedByItemId = item.id; }
  }
  saveState();
  render();
  if (ui.modal?.type === "knowledgeBaseDetail") renderModal();
  showToast("知识审核通过", "v" + version.version + " 已进入 RAG 检索，可用于新的内容任务。");
}

function saveKnowledgePackage(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId);
  if (!line) return showToast("业务线不存在", "请刷新后重试。", "error");
  line.knowledgeBaseIds = Array.from(document.querySelectorAll("[data-package-base]:checked")).map((input) => input.value);
  saveState();
  closeModal();
  render();
  showToast("默认知识包已保存", "以后新建的「" + line.name + "」内容计划会继承这些知识库；历史计划保持不变。");
}

function openGenerationPreview(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  ui.modal = { type: "generationPreview", planId };
  renderModal();
}

function upgradePlanWritingAgent(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  if (plan.status === "produced") return showToast("文章已经生成", "已生成计划必须保留原智能体快照；请在文章中创建新版本。", "error");
  const current = writingAgentById(plan.writingAgentSnapshot?.agentId || plan.writingAgentId);
  if (!current || !writingAgentSupports(current, plan.businessLineId, plan.contentType)) return showToast("智能体不可用", "请恢复智能体或重新创建内容计划。", "error");
  if (Number(current.version) <= Number(plan.writingAgentSnapshot?.version || 0)) return showToast("已经是最新版本", "当前计划无需升级。", "error");
  plan.writingAgentId = current.id;
  plan.writingAgentVersion = current.version;
  plan.writingAgentSnapshot = snapshotWritingAgent(current, { selectionSource: "manual_upgrade" });
  saveState();
  render();
  ui.modal = { type: "generationPreview", planId };
  renderModal();
  showToast("计划已升级智能体", "已显式更新到「" + current.name + "」v" + current.version + "，知识范围保持不变。");
}

function saveWritingAgent(agentId) {
  const existing = writingAgentById(agentId);
  if (existing?.builtIn) return showToast("内置智能体不可直接修改", "请先复制为企业自建智能体。", "error");
  const nameInput = document.getElementById("writing-agent-name");
  const promptInput = document.getElementById("writing-agent-prompt");
  const name = nameInput?.value.trim() || "";
  const description = document.getElementById("writing-agent-description")?.value.trim() || "";
  const systemPrompt = promptInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("智能体名称不能为空", "请填写一个便于运营人员识别的名称。", "error");
  }
  if (!description) return showToast("请填写智能体用途", "一句话说明它最适合创作什么内容。", "error");
  if (!systemPrompt) {
    promptInput?.classList.add("input-error");
    promptInput?.focus();
    return showToast("高级提示词不能为空", "请描述智能体的核心写作要求。", "error");
  }
  if ((state.writingAgents || []).some((agent) => agent.id !== agentId && agent.name.toLowerCase() === name.toLowerCase())) return showToast("智能体名称已存在", "请使用更容易区分的名称。", "error");
  const contentTypes = Array.from(document.querySelectorAll("[data-agent-content-type]:checked")).map((input) => input.value);
  if (!contentTypes.length) return showToast("请选择内容形式", "智能体至少需要适用于一种内容形式。", "error");
  const minWords = Number(document.getElementById("writing-agent-min-words")?.value || 1000);
  const maxWords = Number(document.getElementById("writing-agent-max-words")?.value || 1800);
  if (minWords < 300 || maxWords < minWords) return showToast("目标字数不合理", "最多字数必须大于等于最少字数，且最少不少于 300 字。", "error");
  const payload = {
    name,
    description,
    avatar: document.getElementById("writing-agent-avatar")?.value.trim().slice(0, 1) || name.slice(0, 1),
    role: document.getElementById("writing-agent-role")?.value.trim() || "企业内容编辑",
    audience: document.getElementById("writing-agent-audience")?.value.trim() || "企业客户",
    tone: document.getElementById("writing-agent-tone")?.value.trim() || "专业、清晰",
    style: document.getElementById("writing-agent-style")?.value.trim() || "结论清晰 · 证据优先",
    template: document.getElementById("writing-agent-template")?.value || "deep",
    structure: (document.getElementById("writing-agent-structure")?.value || "").split(/[、，,\n]/).map((item) => item.trim()).filter(Boolean),
    required: document.getElementById("writing-agent-required")?.value.trim() || "",
    banned: document.getElementById("writing-agent-banned")?.value.trim() || "",
    cta: document.getElementById("writing-agent-cta")?.value.trim() || "",
    systemPrompt,
    businessLineIds: Array.from(document.querySelectorAll("[data-agent-line]:checked")).map((input) => input.value),
    contentTypes,
    strictKnowledge: Boolean(document.getElementById("writing-agent-strict")?.checked),
    citationsRequired: Boolean(document.getElementById("writing-agent-citations")?.checked),
    missingEvidenceAction: document.getElementById("writing-agent-missing")?.value || "omit",
    preferredKnowledgeBaseIds: Array.from(document.querySelectorAll("[data-agent-knowledge]:checked")).map((input) => input.value),
    modelMode: "inherit",
    creativity: Math.min(1, Math.max(0, Number(document.getElementById("writing-agent-creativity")?.value || 0.35))),
    minWords,
    maxWords
  };
  const trackedKeys = Object.keys(payload);
  if (existing) {
    const before = JSON.stringify(Object.fromEntries(trackedKeys.map((key) => [key, existing[key]])));
    const after = JSON.stringify(payload);
    if (before === after) {
      closeModal();
      return showToast("配置没有变化", "智能体仍保持 v" + existing.version + "，未创建无意义的新版本。");
    }
    existing.changeLog = Array.isArray(existing.changeLog) ? existing.changeLog : [];
    existing.changeLog.unshift(createWritingAgentSnapshot(existing, { modelName: state.settings.model, selectedBy: "王宁", selectionSource: "version_history" }));
    Object.assign(existing, payload, { version: (Number(existing.version) || 1) + 1, updatedAt: Date.now() });
    saveState();
    closeModal();
    render();
    return showToast("智能体已更新", "「" + existing.name + "」已发布 v" + existing.version + "；历史计划和文章继续使用旧快照。");
  }
  const colors = ["blue", "teal", "amber", "violet", "rose"];
  const agent = { id: uid("WA"), ...payload, color: colors[(state.writingAgents || []).length % colors.length], builtIn: false, status: "active", version: 1, usageCount: 0, changeLog: [], createdBy: "王宁", createdAt: Date.now(), updatedAt: Date.now() };
  state.writingAgents.unshift(agent);
  saveState();
  closeModal();
  ui.contentView = "agents";
  render();
  showToast("写作智能体已创建", "「" + agent.name + "」v1 已可在内容计划和文章工作台中选择。");
}

function toggleWritingAgent(agentId) {
  const agent = writingAgentById(agentId);
  if (!agent || agent.builtIn) return showToast("系统智能体不可停用", "系统模板用于保证至少有一项基础写作能力。", "error");
  if (agent.status === "active") {
    const defaultLines = state.businessLines.filter((line) => line.status === "active" && line.defaultWritingAgentId === agent.id);
    if (defaultLines.length) return showToast("不能停用默认智能体", "请先为「" + defaultLines.map((line) => line.name).join("、") + "」设置其他默认智能体。", "error");
    agent.status = "inactive";
    agent.archivedAt = Date.now();
  } else {
    agent.status = "active";
    delete agent.archivedAt;
  }
  agent.updatedAt = Date.now();
  saveState();
  render();
  showToast(agent.status === "active" ? "智能体已恢复" : "智能体已停用", agent.status === "active" ? "现在可以用于新的内容计划和文章修订。" : "新的内容不能再选择它，历史计划和文章快照仍完整保留。");
}

function setDefaultWritingAgent(agentId) {
  const line = activeBusinessLine();
  const agent = writingAgentById(agentId);
  if (!line || !writingAgentSupports(agent, line.id)) return showToast("智能体不适用于当前业务线", "请先编辑适用范围或选择其他智能体。", "error");
  line.defaultWritingAgentId = agent.id;
  saveState();
  render();
  showToast("业务线默认智能体已更新", "「" + line.name + "」以后新建计划默认选择「" + agent.name + "」；历史计划保持不变。");
}

function deleteBusinessLine(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  const activeLines = state.businessLines.filter((item) => item.status === "active");
  if (!line) return showToast("业务线不存在", "请刷新页面后重试。", "error");
  if (activeLines.length <= 1) return showToast("不能删除最后一条业务线", "系统必须至少保留一条可运营业务线。", "error");
  const impact = businessLineImpact(lineId);
  const isEmpty = impact.total === 0;
  state.questionLibrary.filter((item) => item.businessLineId === lineId).forEach((item) => { item.selected = false; });
  state.topics.filter((topic) => topicBusinessLineId(topic) === lineId).forEach((topic) => { topic.selected = false; });
  if (isEmpty) {
    state.businessLines = state.businessLines.filter((item) => item.id !== lineId);
  } else {
    line.status = "archived";
    line.archivedAt = Date.now();
    (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.scope !== "enterprise").forEach((base) => {
      base.statusBeforeArchive = base.status;
      base.status = "archived";
      base.archivedAt = Date.now();
    });
    (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId && !["resolved", "archived"].includes(gap.status)).forEach((gap) => {
      gap.statusBeforeArchive = gap.status;
      gap.status = "archived";
    });
    (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line.name).forEach((task) => { task.archivedAt = Date.now(); });
  }
  const nextLine = state.businessLines.find((item) => item.status === "active");
  ui.selectedBusinessLineId = nextLine?.id || null;
  ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === nextLine?.id)?.id || null;
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  ui.planningCategory = "all";
  saveState();
  render();
  ui.modal = { type: "businessLineManager" };
  renderModal();
  showToast("业务线已删除", isEmpty ? "空业务线已永久删除。" : "已从日常运营入口移除，历史文章与证据关系继续保留，可随时恢复。");
}

function restoreBusinessLine(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "archived");
  if (!line) return showToast("未找到已删除业务线", "请刷新页面后重试。", "error");
  line.status = "active";
  delete line.archivedAt;
  (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.status === "archived").forEach((base) => {
    base.status = base.statusBeforeArchive || "ready";
    delete base.statusBeforeArchive;
    delete base.archivedAt;
  });
  (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId && gap.status === "archived").forEach((gap) => {
    gap.status = gap.statusBeforeArchive || "open";
    delete gap.statusBeforeArchive;
  });
  (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line.name).forEach((task) => { delete task.archivedAt; });
  ui.selectedBusinessLineId = line.id;
  ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === line.id)?.id || null;
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  saveState();
  render();
  ui.modal = { type: "businessLineManager" };
  renderModal();
  showToast("业务线已恢复", "「" + line.name + "」及其知识库、选题和内容计划已重新进入日常运营入口。");
}

function submitBusinessLine() {
  const nameInput = document.getElementById("business-line-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("业务线名称不能为空", "请输入产品或业务线名称。", "error");
  }
  if (state.businessLines.some((line) => line.name.toLowerCase() === name.toLowerCase())) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("业务线已存在", "请使用其他名称，或回到现有业务线继续添加关键词。", "error");
  }
  const line = { id: uid("BL"), name, product: document.getElementById("business-line-product")?.value.trim() || name, audience: document.getElementById("business-line-audience")?.value.trim() || "待补充目标客户", scenario: document.getElementById("business-line-scenario")?.value.trim() || "待补充核心场景", status: "active", knowledgeBaseIds: [], defaultWritingAgentId: state.settings.defaultWritingAgentId, createdAt: Date.now() };
  state.businessLines.push(line);
  ui.selectedBusinessLineId = line.id;
  ui.selectedPackId = null;
  ui.planningTab = "keywords";
  ui.businessKeywordInput = "";
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  saveState();
  closeModal();
  render();
  showToast("业务线已创建", "现在可以为「" + line.name + "」添加关键词。");
  window.setTimeout(() => document.getElementById("business-keyword-input")?.focus(), 30);
}

function archivePlanningQuestion(questionId) {
  const question = state.questionLibrary.find((item) => item.id === questionId);
  if (!question || question.status === "archived") return;
  question.archivedFromStatus = question.status || "active";
  question.status = "archived";
  question.archivedAt = Date.now();
  question.archivedBy = "王宁";
  question.archivedReason = "运营人员归档";
  question.selected = false;
  saveState();
  render();
  showToast("问题已归档", "历史选题、计划和文章仍然保留，可在归档管理中恢复。");
}

function archivePlanningTopic(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status === "archived") return;
  topic.archivedFromStatus = topic.status || "active";
  topic.status = "archived";
  topic.archivedAt = Date.now();
  topic.archivedBy = "王宁";
  topic.archivedReason = "运营人员归档";
  topic.selected = false;
  saveState();
  render();
  showToast("选题已归档", "不会影响已经创建的内容计划和历史文章。");
}

function confirmTopicCandidate(topicId) {
  const topic = state.topics.find((item) => item.id === topicId && item.status === "candidate");
  if (!topic) return showToast("选题无法确认", "该选题可能已经确认、归档或不存在。", "error");
  topic.status = "active";
  topic.confirmedAt = Date.now();
  topic.confirmedBy = "王宁";
  topic.updatedAt = Date.now();
  topic.selected = false;
  const sourceQuestion = topic.questionId ? state.questionLibrary.find((item) => item.id === topic.questionId) : null;
  if (sourceQuestion) {
    sourceQuestion.coverage = "已规划";
    sourceQuestion.updatedAt = topic.updatedAt;
  }
  saveState();
  render();
  showToast("选题已确认", "现在可以直接生成文章，或加入现有内容计划。");
}

function restorePlanningRecord(kind, recordId) {
  const record = kind === "topic" ? state.topics.find((item) => item.id === recordId) : state.questionLibrary.find((item) => item.id === recordId);
  if (!record || record.status !== "archived") return;
  const recordName = String(kind === "topic" ? record.title : record.question || "").trim().toLowerCase();
  const duplicate = kind === "topic"
    ? state.topics.some((item) => item.id !== record.id && item.status !== "archived" && topicBusinessLineId(item) === topicBusinessLineId(record) && String(item.title || "").trim().toLowerCase() === recordName)
    : state.questionLibrary.some((item) => item.id !== record.id && item.status !== "archived" && item.businessLineId === record.businessLineId && String(item.question || "").trim().toLowerCase() === recordName);
  if (duplicate) return showToast(kind === "topic" ? "无法恢复选题" : "无法恢复问题", "当前业务线中已存在同名的活跃记录，请先编辑或归档同名记录后再恢复。", "error");
  record.status = record.archivedFromStatus && record.archivedFromStatus !== "archived" ? record.archivedFromStatus : "active";
  delete record.archivedFromStatus;
  delete record.archivedAt;
  delete record.archivedBy;
  delete record.archivedReason;
  record.updatedAt = Date.now();
  saveState();
  render();
  showToast(kind === "topic" ? "选题已恢复" : "问题已恢复", "已重新回到当前业务线的日常运营列表。");
}

function submitQuestionEdit() {
  const question = state.questionLibrary.find((item) => item.id === ui.modal?.questionId);
  if (!question) return;
  const text = document.getElementById("planning-question-text")?.value.trim() || "";
  const sourceKeyword = document.getElementById("planning-question-source")?.value.trim() || "";
  const coverage = document.getElementById("planning-question-coverage")?.value || "未覆盖";
  if (!text) return showToast("问题不能为空", "请填写客户真正会提出的问题。", "error");
  const duplicate = state.questionLibrary.some((item) => item.id !== question.id && item.businessLineId === question.businessLineId && item.status !== "archived" && item.question.trim().toLowerCase() === text.toLowerCase());
  if (duplicate) return showToast("问题已经存在", "当前业务线中已有相同问题，请修改后再保存。", "error");
  question.revisions = Array.isArray(question.revisions) ? question.revisions : [];
  question.revisions.unshift({ version: question.version || 1, question: question.question, sourceKeyword: question.sourceKeyword, dimension: question.dimension, intent: question.intent, stage: question.stage, coverage: question.coverage, updatedAt: question.updatedAt || question.createdAt || Date.now() });
  question.question = text;
  question.sourceKeyword = sourceKeyword;
  question.coverage = coverage;
  question.geoIntent = buildGeoQuestionIntent(question);
  question.version = Number(question.version || 1) + 1;
  question.updatedAt = Date.now();
  const refs = planningQuestionReferences(question);
  saveState();
  closeModal();
  render();
  showToast("问题已更新", refs.topics.length ? `已创建 v${question.version}；${refs.topics.length} 个选题仍保留原内容快照。` : `已保存问题 v${question.version}。`);
}

function submitTopicEdit() {
  const topic = state.topics.find((item) => item.id === ui.modal?.topicId);
  if (!topic) return;
  const title = document.getElementById("planning-topic-title")?.value.trim() || "";
  const coreQuestion = document.getElementById("planning-topic-core-question")?.value.trim() || "";
  const keyword = topic.keyword || "";
  const dimension = document.getElementById("planning-topic-dimension")?.value || "question";
  const intent = document.getElementById("planning-topic-intent")?.value.trim() || "待判断";
  const recommendation = Math.max(0, Math.min(100, Number(topic.recommendation ?? 80)));
  const coverage = topic.coverage || "未覆盖";
  const reason = topic.reason || "";
  if (!title) return showToast("选题标题不能为空", "请填写文章需要回答的具体方向。", "error");
  if (!coreQuestion) return showToast("核心回答问题不能为空", "请填写文章最终必须直接回答的问题。", "error");
  const duplicate = state.topics.some((item) => item.id !== topic.id && item.status !== "archived" && topicBusinessLineId(item) === topicBusinessLineId(topic) && item.title.trim().toLowerCase() === title.toLowerCase());
  if (duplicate) return showToast("选题已经存在", "当前业务线中已有相同选题，请修改后再保存。", "error");
  topic.revisions = Array.isArray(topic.revisions) ? topic.revisions : [];
  topic.revisions.unshift({ version: topic.version || 1, title: topic.title, coreQuestion: topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title, keyword: topic.keyword, dimension: topic.dimension, intent: topic.intent, recommendation: topic.recommendation, coverage: topic.coverage, reason: topic.reason, updatedAt: topic.updatedAt || topic.createdAt || Date.now() });
  topic.title = title;
  topic.coreQuestion = coreQuestion;
  topic.keyword = keyword;
  topic.dimension = dimension;
  topic.intent = intent;
  topic.recommendation = recommendation;
  topic.coverage = coverage;
  topic.reason = reason;
  topic.geoIntent = buildGeoQuestionIntent({ ...topic, question: coreQuestion, sourceKeyword: topic.keyword });
  topic.geoBrief = { ...buildGeoTopicBrief(topic, topic.questionSnapshot), coreQuestion, title };
  topic.version = Number(topic.version || 1) + 1;
  topic.updatedAt = Date.now();
  const refs = planningTopicReferences(topic);
  saveState();
  closeModal();
  render();
  showToast("选题已更新", refs.plans.length || refs.articles.length ? `已创建 v${topic.version}；历史计划和文章继续使用原选题版本。` : `已保存选题 v${topic.version}。`);
}

function permanentlyDeletePlanningRecord(kind, recordId) {
  const list = kind === "topic" ? state.topics : state.questionLibrary;
  const record = list.find((item) => item.id === recordId);
  if (!record || record.status !== "archived") return showToast("只能删除归档记录", "请先将问题或选题归档，再执行永久删除。", "error");
  const refs = kind === "topic" ? planningTopicReferences(record) : planningQuestionReferences(record);
  const canDelete = kind === "topic" ? !refs.plans.length && !refs.articles.length : !record.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length;
  if (!canDelete) return showToast("仍有下游引用", "该记录只能继续归档，不能永久删除。", "error");
  const index = list.findIndex((item) => item.id === recordId);
  if (index >= 0) list.splice(index, 1);
  if (kind === "topic") state.questionLibrary.filter((question) => question.topicId === recordId).forEach((question) => { question.topicId = null; });
  saveState();
  closeModal();
  render();
  showToast(kind === "topic" ? "选题已永久删除" : "问题已永久删除", "这条记录没有任何下游引用，已从当前客户空间移除。");
}

function openContentPlan() {
  const line = activeBusinessLine();
  const selected = state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  if (!selected.length) return showToast("还没有选择选题", "请先在选题库勾选至少一个选题。", "error");
  ui.planError = "";
  ui.modal = { type: "contentPlan" };
  renderModal();
}

function openTopicDirectStudio(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active") return showToast("选题尚未确认", "请先在选题库完成人工确认。", "error");
  const existingArticle = planningTopicArticles(topic)[0];
  if (existingArticle) {
    ui.contentView = "studio";
    return openContentStudio(existingArticle.id);
  }
  if (planningTopicPlans(topic).length) return showToast("选题已进入计划", "请到内容计划中创建或查看文章任务。", "error");
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "这个选题关联的产品 / 业务线已停用。", "error");
  ui.selectedBusinessLineId = line.id;
  const workspace = ensureStudioWorkspace(null, true);
  const conversation = studioConversationForWorkspace(workspace);
  const question = planningTopicReferences(topic).question;
  const coreQuestion = topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title;
  const contentType = "深度文章";
  const inheritedBaseIds = inheritedKnowledgeBaseIds(line);
  const agent = defaultAgentForLine(line, contentType);
  const now = Date.now();
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: "topic_direct" });
  workspace.sourceType = "topic_direct";
  workspace.sourceTopicId = topic.id;
  workspace.sourceTopicSnapshot = cloneData(topic);
  workspace.sourceQuestionSnapshot = cloneData(question);
  workspace.businessLineId = line.id;
  workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
  workspace.topic = { ...cloneData(topic), source: "topic_library", geoBrief: cloneData(topic.geoBrief || buildGeoTopicBrief(topic, question)), prompt: [topic.title, coreQuestion !== topic.title ? "核心回答问题：" + coreQuestion : "", topic.intent ? "用户意图：" + topic.intent : "", topic.geoBrief?.answerMode ? "回答方式：" + topic.geoBrief.answerMode : ""].filter(Boolean).join("\n") };
  workspace.draftTitle = topic.title;
  workspace.draftContent = "";
  workspace.draftContentHtml = "";
  workspace.contentType = contentType;
  workspace.knowledgeScope = { inheritedBaseIds: cloneData(inheritedBaseIds), addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: cloneData(inheritedBaseIds), snapshottedAt: new Date(now).toISOString(), lockedVersionIds: [] };
  workspace.selectedKnowledgeBaseIds = cloneData(inheritedBaseIds);
  workspace.selectedKnowledgeItemIds = [];
  workspace.writingAgentId = agent?.id || null;
  workspace.writingAgentSnapshot = agentSnapshot;
  workspace.updatedAt = now;
  if (conversation) {
    conversation.articleId = null;
    conversation.selectedAgentId = agent?.id || null;
    conversation.selectedKnowledgeBaseIds = cloneData(inheritedBaseIds);
    conversation.selectedKnowledgeItemIds = [];
    conversation.webSearchEnabled = false;
    conversation.messages = [{ id: uid("MSG"), role: "assistant", text: `已带入选题「${topic.title}」。核心回答问题是「${coreQuestion}」。你可以直接发送下方写作要求生成初稿，也可以先补充文章结构、语气或受众。`, createdAt: now, agentSnapshot, contextSnapshot: { businessLineId: line.id, sourceTopicId: topic.id, knowledgeBaseIds: cloneData(inheritedBaseIds), webSearchEnabled: false } }];
    conversation.updatedAt = now;
  }
  ui.studioWorkspaceId = workspace.id;
  ui.studioArticleId = null;
  ui.studioTopicDraft = topic.title;
  ui.studioContentType = contentType;
  ui.studioAgentId = agent?.id || null;
  ui.studioWebSearch = false;
  ui.studioPicker = null;
  ui.studioComposerDraft = "请基于这个选题和企业知识生成文章初稿";
  ui.contentView = "studio";
  ui.studioPane = "editor";
  saveState();
  closeModal();
  navigate("content");
  window.setTimeout(() => document.getElementById("studio-composer-input")?.focus(), 40);
}

function openTopicPlanPicker(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active") return showToast("选题尚未确认", "请先在选题库完成人工确认，再加入内容计划。", "error");
  if (planningTopicPlans(topic).length) return showToast("选题已进入计划", "该选题已经在内容计划中，可前往内容计划查看。", "error");
  const article = planningTopicArticles(topic)[0];
  if (article) {
    ui.contentView = "studio";
    openContentStudio(article.id);
    return showToast("该选题已生成文章", "为避免重复创建，已为你打开现有文章。", "success");
  }
  ui.modal = { type: "topicPlanPicker", topicId: topic.id, planId: null };
  renderModal();
}

function createPlanFromTopicPicker(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active" || planningTopicPlans(topic).length) return showToast("选题不可用", "请先确认选题并刷新选题库后重试。", "error");
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "这个选题关联的产品 / 业务线已停用。", "error");
  ui.selectedBusinessLineId = line.id;
  state.topics.filter((item) => topicBusinessLineId(item) === line.id).forEach((item) => { item.selected = item.id === topic.id; });
  saveState();
  closeModal();
  openContentPlan();
}

function submitTopicPlanPicker() {
  const topic = state.topics.find((item) => item.id === ui.modal?.topicId);
  const planId = document.querySelector('input[name="topic-plan-id"]:checked')?.value || "";
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!topic || topic.status !== "active") return showToast("选题不可用", "请先在选题库完成人工确认。", "error");
  if (!planId) return showToast("请选择内容计划", "选择一个已有计划，或为这个选题新建计划。", "error");
  if (!plan || plan.businessLineId !== topicBusinessLineId(topic)) return showToast("内容计划不可用", "只能加入当前产品 / 业务线的内容计划。", "error");
  const status = plan.status || (contentPlanArticles(plan).length ? "produced" : "planned");
  if (!["draft", "planned"].includes(status)) return showToast("计划不可追加选题", "已生成内容或已完成的计划不能继续加入选题。", "error");
  if (planningTopicPlans(topic).length || contentPlanTopicIds(plan).includes(topic.id)) return showToast("选题已进入计划", "请刷新页面后查看最新计划。", "error");
  const now = Date.now();
  plan.topicIds = [...new Set([...contentPlanTopicIds(plan), topic.id])];
  plan.topicSnapshots = [...(Array.isArray(plan.topicSnapshots) ? plan.topicSnapshots : []).filter((item) => item?.id !== topic.id).map((item) => cloneData(item)), cloneData(topic)];
  plan.updatedAt = now;
  topic.selected = false;
  topic.coverage = "已规划";
  topic.updatedAt = now;
  saveState();
  closeModal();
  render();
  showToast("已加入内容计划", `「${topic.title}」已加入「${plan.name}」，可继续创建文章任务。`);
}

function submitContentPlan() {
  const line = activeBusinessLine();
  const selected = state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  const nameInput = document.getElementById("content-plan-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("计划名称不能为空", "请输入内容计划名称。", "error");
  }
  if (!selected.length) return showToast("没有可用选题", "返回选题库重新选择。", "error");
  const date = document.getElementById("content-plan-date")?.value || "";
  if (!date) return showToast("请选择计划日期", "内容计划需要明确预计完成日期。", "error");
  const contentType = document.getElementById("content-plan-type")?.value || "深度文章";
  const agentId = document.getElementById("content-plan-agent")?.value || "";
  const agent = writingAgentById(agentId);
  if (!agent || !writingAgentSupports(agent, line.id, contentType)) return showToast("写作智能体不可用", "请选择一个已启用、适用于当前业务线和内容形式的智能体。", "error");
  const expectedPlatformIds = Array.from(document.querySelectorAll("[data-plan-style-platform]:checked")).map((item) => item.value).filter((id) => PLATFORM_META[id]);
  const expectedPlatformNames = Object.fromEntries(expectedPlatformIds.map((id) => [id, PLATFORM_META[id].name]));
  const expectedPlatformGuidance = Object.fromEntries(expectedPlatformIds.map((id) => [id, PLATFORM_STYLE_HINTS[id]]));
  const inheritedBaseIds = inheritedKnowledgeBaseIds(line);
  const resolvedBaseIds = Array.from(document.querySelectorAll("[data-plan-knowledge]:checked")).map((item) => item.value);
  if (!resolvedBaseIds.length) return showToast("请保留至少一个知识库", "内容任务必须有可追溯的企业知识来源。", "error");
  const addedBaseIds = resolvedBaseIds.filter((id) => !inheritedBaseIds.includes(id));
  const excludedBaseIds = inheritedBaseIds.filter((id) => !resolvedBaseIds.includes(id));
  const now = Date.now();
  const agentSnapshot = snapshotWritingAgent(agent, { selectedAt: new Date(now).toISOString(), selectionSource: agent.id === line.defaultWritingAgentId ? "business_default" : "manual" });
  const plan = { id: uid("PLAN"), name, businessLineId: line.id, topicIds: selected.map((topic) => topic.id), topicSnapshots: selected.map((topic) => cloneData(topic)), scheduledFor: date, owner: document.getElementById("content-plan-owner")?.value || "王宁", contentType, status: "planned", articleIds: [], writingAgentId: agent.id, writingAgentVersion: agentSnapshot.version, writingAgentSnapshot: agentSnapshot, writingHints: { expectedPlatformIds, expectedPlatformNames, expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false, snapshottedAt: now }, knowledgeBaseIds: resolvedBaseIds, knowledgeScope: { inheritedBaseIds, addedBaseIds, excludedBaseIds, resolvedBaseIds, snapshottedAt: now }, createdAt: now };
  state.contentPlans.unshift(plan);
  selected.forEach((topic) => { topic.selected = false; topic.coverage = "已规划"; });
  ui.planningTab = "plans";
  saveState();
  closeModal();
  render();
  showToast("内容计划已创建", "已安排 " + plan.topicIds.length + " 个选题，并冻结「" + agent.name + "」v" + agent.version + " 与 " + resolvedBaseIds.length + " 个知识库的使用范围。");
}

function citationMarkerHtml(citation) {
  return ` <button class="citation-marker" type="button" contenteditable="false" data-action="open-citation" data-citation-id="${citation.id}" title="查看 ${citation.marker} 引用证据">[${citation.marker}]</button>`;
}

// 旧版演示正文仅用于兼容历史文章快照；新生成统一走下方 GEO 证据页契约。
function buildKnowledgeArticleContentLegacy(topic, citations, agentSnapshot = null) {
  const statement = (citation) => citation ? '<span>' + escapeHtml(citation.quote) + "</span>" + citationMarkerHtml(citation) : "";
  const group = (items) => items.filter(Boolean).map(statement).join(" ");
  const template = agentSnapshot?.template || "deep";
  const heading = (index, fallback) => escapeHtml(agentSnapshot?.structure?.[index] || fallback);
  const writingFrame = agentSnapshot ? `从${escapeHtml(agentSnapshot.role)}的视角，本文采用${escapeHtml(agentSnapshot.tone)}的表达方式。` : "";
  const cta = agentSnapshot?.cta ? `<p class="agent-article-cta">${escapeHtml(agentSnapshot.cta)}</p>` : "";
  if (template === "qa") return `
    <p id="p-intro"><b>先说结论：</b>“${escapeHtml(topic.title)}”需要结合企业自身业务资料判断，不能用一套通用答案替代真实事实。${writingFrame}${statement(citations[0])}</p>
    <h2>${heading(0, "为什么这样回答？")}</h2>
    <p id="p-knowledge">${group(citations.slice(1, 3))}</p>
    <h2>${heading(1, "企业落地时要满足哪些条件？")}</h2>
    <p id="p-topic">${group(citations.slice(3, 5))}</p>
    <h2>${heading(2, "下一步如何验证？")}</h2>
    <p id="p-publish">${group(citations.slice(5))}</p>
    <p class="knowledge-omission-note">回答边界：价格、周期及效果承诺缺少统一审核证据，本文主动省略。</p>
    ${cta}
  `;
  if (template === "case") return `
    <p id="p-intro">这篇案例拆解围绕“${escapeHtml(topic.title)}”展开，只复盘已经进入企业知识库并通过审核的事实。${writingFrame}${statement(citations[0])}</p>
    <h2>${heading(0, "一、案例背景与业务问题")}</h2>
    <p id="p-knowledge">${group(citations.slice(1, 3))}</p>
    <h2>${heading(1, "二、实施过程与关键选择")}</h2>
    <p id="p-topic">${group(citations.slice(3, 5))}</p>
    <h2>${heading(2, "三、结果、边界与可借鉴之处")}</h2>
    <p id="p-publish">${group(citations.slice(5))}</p>
    <p class="knowledge-omission-note">案例说明：未被企业审核的客户名称、项目数字和效果指标不会写入正文。</p>
    ${cta}
  `;
  if (template === "guide") return `
    <p id="p-intro">面对“${escapeHtml(topic.title)}”，采购与技术团队应先统一决策目标，再比较有证据支持的能力。${writingFrame}${statement(citations[0])}</p>
    <h2>${heading(0, "一、先明确本次决策目标")}</h2>
    <p id="p-knowledge">${group(citations.slice(1, 3))}</p>
    <h2>${heading(1, "二、用哪些维度比较方案")}</h2>
    <p id="p-topic">${group(citations.slice(3, 5))}</p>
    <h2>${heading(2, "三、签约前的证据核验清单")}</h2>
    <p id="p-publish">${group(citations.slice(5))}</p>
    <p class="knowledge-omission-note">决策边界：本文不输出未经证实的排名、绝对化推荐或保证性承诺。</p>
    ${cta}
  `;
  if (template === "story") return `
    <p id="p-intro">很多企业第一次认真讨论“${escapeHtml(topic.title)}”，往往不是因为追逐一个新概念，而是发现客户获取信息的方式已经改变。${writingFrame}${statement(citations[0])}</p>
    <h2>${heading(0, "从一个真实业务场景说起")}</h2>
    <p id="p-knowledge">${group(citations.slice(1, 3))}</p>
    <h2>${heading(1, "我们如何理解并解决这个问题")}</h2>
    <p id="p-topic">${group(citations.slice(3, 5))}</p>
    <h2>${heading(2, "把方法落回企业自己的长期积累")}</h2>
    <p id="p-publish">${group(citations.slice(5))}</p>
    <p class="knowledge-omission-note">品牌表达边界：故事中的人物、客户反馈与结果均不得脱离已审核企业事实。</p>
    ${cta}
  `;
  return `
    <p id="p-intro">围绕“${escapeHtml(topic.title)}”，企业需要先把内容建立在自己的真实业务资料上。${writingFrame}${statement(citations[0])}</p>
    <h2>${heading(0, "一、先统一企业事实与服务边界")}</h2>
    <p id="p-knowledge">${group(citations.slice(1, 3))}</p>
    <h2>${heading(1, "二、围绕客户真实决策问题策划")}</h2>
    <p id="p-topic">${group(citations.slice(3, 5))}</p>
    <h2>${heading(2, "三、审核冻结后进入多平台发布")}</h2>
    <p id="p-publish">${group(citations.slice(5))}</p>
    <p class="knowledge-omission-note">说明：当前知识库没有统一的价格和交付周期证据，本文不补写具体数字或保证性承诺。</p>
    ${cta}
  `;
}

function buildKnowledgeArticleContent(topic, citations, agentSnapshot = null, options = {}) {
  const brief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  const dimension = topic.dimension || topic.questionSnapshot?.dimension || "question";
  const fallbackAnswer = {
    semantic: "先把概念、目标对象和适用边界分开说明，再与相近概念进行对比；不要只用一个缩写或关键词代替完整定义。",
    scenario: "是否适合不能只看行业名称，应先核对目标客户、使用场景、资料完整度和执行条件，再决定从哪个场景切入。",
    commercial: "评估服务时应先核验服务范围、交付流程、验收证据和双方责任，再比较报价或承诺；没有公开依据的结果不应直接采信。",
    ranking: "不宜直接给出脱离条件的‘最好’名单，应先建立比较维度，逐项核验能力、案例、来源和适用边界，再形成分层选择。",
    review: "应把资产质量和 AI 表现分开评估，结合提及、推荐、官网引用、引用准确度和转化等有效样本持续复盘，而不是只看一次曝光。",
    brand: "应先确认企业主体、服务能力、适用客户和公开信源是否一致，再用可核验资料回答品牌能力，不用口号替代证据。",
    question: "建议从已审核的企业事实开始，先定义问题和目标读者，再按实施步骤、验收标准和缺口安排内容；资料不足时先补证，不用模型猜测。",
    technical: "需要把企业事实、问题地图、内容生产、审核发布和 AI 采样串成可追溯流程，并明确每个系统的输入、输出和责任边界。"
  }[dimension] || "应先明确问题、适用条件和核验证据，再给出可执行的下一步；无法从已审核资料确认的内容必须保留为待补充信息。";
  const statement = (citation) => citation
    ? "<span>" + escapeHtml(citation.quote || "") + "</span>" + citationMarkerHtml(citation)
    : "<span>当前已审核资料没有提供这一事实，本文不补写具体结论。</span>";
  const group = (items) => items.filter(Boolean).map(statement).join(" ");
  const customHeading = (index, fallback) => {
    const custom = agentSnapshot?.structure?.[index];
    return escapeHtml(custom && custom !== fallback ? `${fallback}（${custom}）` : fallback);
  };
  const writingFrame = agentSnapshot
    ? `<p class="geo-writing-note"><span>写作方式：</span>${escapeHtml(agentSnapshot.role || "企业内容编辑")} · ${escapeHtml(agentSnapshot.tone || "专业、清晰、克制")} · ${escapeHtml(agentSnapshot.style || "结论先行、证据优先")}</p>`
    : "";
  const directAnswer = `围绕“${escapeHtml(brief.coreQuestion || topic.title)}”，本文先给出可独立引用的判断：${escapeHtml(fallbackAnswer)}本次涉及企业自身的事实，只引用已审核知识；没有证据的部分保留为待补充信息。`;
  const evidence = citations.slice(1, 3);
  const method = citations.slice(3, 5);
  const faqCitation = citations[5] || citations[4] || citations[0];
  const faqSeeds = (brief.faqSeeds || ["这适合哪些企业或场景？", "落地前需要准备什么？", "如何核验结果或判断是否适用？"]).slice(0, 3);
  const faqAnswer = (index) => index === 0
    ? `先对照目标客户、业务场景和${escapeHtml(brief.answerMode || "回答方式")}，再判断是否适合，不把单一案例直接推广到所有企业。`
    : index === 1
      ? `至少准备企业主体、产品或服务说明、典型场景、可公开案例、FAQ 和禁用表达，并让来源、版本与更新时间可追溯。`
      : `用来源、版本、适用条件和更新时间逐条复核；${escapeHtml(fallbackAnswer)}若当前资料没有结论，应回到知识库补证。`;
  const comparisonBlock = ["commercial", "ranking", "review"].includes(dimension)
    ? `<h3>比较时先看哪些维度？</h3><table><thead><tr><th>比较维度</th><th>核验问题</th><th>当前证据边界</th></tr></thead><tbody><tr><td>能力与范围</td><td>是否覆盖本次目标场景？</td><td>只引用已审核的服务与产品资料</td></tr><tr><td>过程与交付</td><td>谁负责、如何验收、如何复盘？</td><td>没有统一资料的字段标记待补证</td></tr><tr><td>结果与风险</td><td>结果能否追溯，限制条件是什么？</td><td>不输出未经证实的排名或效果承诺</td></tr></tbody></table>`
    : "";
  const cta = agentSnapshot?.cta ? `<p class="agent-article-cta">${escapeHtml(agentSnapshot.cta)}</p>` : "";
  return `
    <section class="geo-article-section geo-answer-section" id="p-intro" data-geo-section="direct-answer">
      <h2>直接回答</h2>
      <p><strong>结论：</strong>${directAnswer}${statement(citations[0])}</p>
      ${writingFrame}
    </section>
    <section class="geo-article-section" id="p-scope" data-geo-section="scope">
      <h2>适用对象与问题边界</h2>
      <p>本内容面向${escapeHtml(brief.decisionRole || "正在评估方案的企业读者")}，回答方式为“${escapeHtml(brief.answerMode || "直接答案与执行步骤")}”。文章只讨论“${escapeHtml(brief.coreQuestion || topic.title)}”，不把单一案例或通用经验扩大为所有企业都适用的结论。</p>
      <ul><li>需要优先核验：${escapeHtml((brief.evidenceNeeds || []).join("、") || "企业主体、服务范围和适用条件")}。</li><li>不在本篇替代判断：未经审核的价格、排名、客户评价和效果承诺。</li></ul>
    </section>
    <section class="geo-article-section" id="p-knowledge" data-geo-section="evidence">
      <h2>${customHeading(0, "关键判断与事实依据")}</h2>
      <ol>${(evidence.length ? evidence : [null]).map((citation, index) => `<li><strong>依据 ${index + 1}：</strong>${statement(citation)}</li>`).join("")}</ol>
    </section>
    <section class="geo-article-section" id="p-topic" data-geo-section="method">
      <h2>${customHeading(1, "实施步骤或决策清单")}</h2>
      <ol><li><strong>先确认问题：</strong>把目标客户、使用场景和决策阶段写清楚，再决定内容范围。</li><li><strong>再核验事实：</strong>只使用本次冻结的知识版本，将每个关键判断绑定到对应证据。${group(method.slice(0, 1))}</li><li><strong>最后检查边界：</strong>对缺少证据的字段标记待补充，不用确定性话术代替事实。${group(method.slice(1, 2))}</li></ol>
      ${comparisonBlock}
    </section>
    <section class="geo-article-section geo-faq-section" id="p-faq" data-geo-section="faq">
      <h2>${customHeading(2, "常见追问")}</h2>
      ${faqSeeds.map((question, index) => `<h3>${escapeHtml(question)}</h3><p>${faqAnswer(index)}${index === 2 ? statement(faqCitation) : ""}</p>`).join("")}
    </section>
    <section class="geo-article-section geo-boundary-section" id="p-boundary" data-geo-section="boundary">
      <h2>信息边界与更新时间</h2>
      <p>本文企业事实仅来自本次冻结并通过审核的知识版本；联网搜索、临时附件和图片不能单独证明企业文字事实。${escapeHtml((brief.exclusions || []).join("；"))}。发布前仍需完成事实核验、风险扫描和人工审核。</p>
      <p class="knowledge-omission-note">如需补充价格、交付周期、客户名称或效果数字，请先在企业知识库建立并审核对应资料，再重新生成文章版本。</p>
    </section>
    ${cta}
  `;
}

function createArticleKnowledgeBundle(articleId, topic, plan) {
  const evidence = generationEvidenceForPlan(plan);
  const writingAgentSnapshot = cloneData(plan.writingAgentSnapshot);
  const geoBrief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  if (!topic.geoBrief) topic.geoBrief = cloneData(geoBrief);
  const expectedPlatformNames = planExpectedPlatformNames(plan);
  const expectedPlatformGuidance = planExpectedPlatformGuidance(plan);
  const sectionMeta = [
    ["p-intro", "直接回答"], ["p-knowledge", "关键判断与事实依据"], ["p-knowledge", "关键判断与事实依据"],
    ["p-topic", "实施步骤或决策清单"], ["p-topic", "实施步骤或决策清单"], ["p-faq", "常见追问"]
  ];
  const citations = evidence.map((entry, index) => {
    const marker = "K" + (index + 1);
    const citation = {
      id: uid("CIT") + "-" + marker,
      articleId,
      articleVersion: "v1",
      marker,
      paragraphId: sectionMeta[index]?.[0] || "p-content",
      articleSection: sectionMeta[index]?.[1] || "文章正文",
      knowledgeBaseId: entry.base.id,
      itemId: entry.item.id,
      versionId: entry.version.id,
      knowledgeVersion: entry.version.version,
      chunkId: entry.chunk?.id || null,
      claim: entry.item.title || entry.item.question,
      quote: entry.quote,
      excerpt: entry.quote,
      locator: knowledgeLocator(entry.item, entry.version),
      supportStatus: "supported",
      status: "verified"
    };
    return citation;
  });
  state.knowledgeCitations = state.knowledgeCitations || [];
  state.knowledgeCitations.push(...citations);
  const scope = normalizeKnowledgeScope(plan);
  const publicIds = enterpriseKnowledgeBaseIds();
  const planArticleIds = new Set(plan.articleIds || []);
  const gapTemplates = (state.knowledgeGaps || []).filter((gap) => gap.status !== "resolved" && (gap.planId === plan.id || planArticleIds.has(gap.articleId)) && (!gap.businessLineId || gap.businessLineId === plan.businessLineId));
  const fallbackGaps = writingAgentSnapshot?.missingEvidenceAction === "block" ? [] : [{ field: "price", label: "标准报价", reason: "当前已审核知识没有统一对外报价。" }, { field: "delivery_cycle", label: "交付周期", reason: "当前已审核知识没有可统一对外引用的交付周期。" }];
  const uniqueGaps = [...new Map((gapTemplates.length ? gapTemplates : fallbackGaps).map((gap) => [gap.field || gap.label, gap])).values()];
  const createdGaps = uniqueGaps.map((gap) => ({ id: uid("KG"), articleId, businessLineId: plan.businessLineId, field: gap.field || "missing_fact", label: gap.label || gap.title || "待补充事实", reason: gap.reason || "当前知识范围没有可核验的企业事实。", status: "open", severity: "blocking", generationPolicy: "omit" }));
  state.knowledgeGaps.push(...createdGaps);
  const now = new Date().toISOString();
  if (writingAgentSnapshot) writingAgentSnapshot.lockedAt = now;
  const citationIds = citations.map((citation) => citation.id);
  const lockedVersionIds = [...new Set(citations.map((citation) => citation.versionId))];
  const outputContract = buildGeoOutputContract({ ...topic, geoBrief }, citations, writingAgentSnapshot, { contentType: plan.contentType });
  const promptTemplate = buildGeoArticlePrompt({ ...topic, geoBrief }, citations, writingAgentSnapshot, { contentType: plan.contentType, outputContract, expectedPlatformGuidance });
  const content = buildKnowledgeArticleContent({ ...topic, geoBrief }, citations, writingAgentSnapshot, { outputContract });
  const geoQuality = evaluateGeoArticleQuality(content, { ...topic, geoBrief }, citations);
  return {
    citations,
    content,
    geoQuality,
    knowledgeSnapshot: {
      id: uid("KS"),
      capturedAt: now,
      frozenAt: null,
      enterpriseBaseIds: scope.resolvedBaseIds.filter((id) => publicIds.includes(id)),
      businessLineBaseIds: scope.resolvedBaseIds.filter((id) => !publicIds.includes(id) && !scope.addedBaseIds.includes(id)),
      addedBaseIds: scope.addedBaseIds,
      excludedBaseIds: scope.excludedBaseIds,
      resolvedBaseIds: scope.resolvedBaseIds,
      lockedVersionIds,
      citationIds,
      gapIds: createdGaps.map((gap) => gap.id)
    },
    generationSnapshot: {
      id: uid("GS"), generatedAt: now, generatedBy: "AI 内容助手", topicId: topic.id, topicSnapshot: cloneData(topic), planId: plan.id, businessLineId: plan.businessLineId,
      model: { name: (writingAgentSnapshot?.resolvedModel?.name || state.settings.model) + "（演示）", promptVersion: writingAgentSnapshot ? writingAgentSnapshot.nameSnapshot + " v" + writingAgentSnapshot.version : "历史默认配置" },
      writingAgent: writingAgentSnapshot,
      topicBrief: cloneData(geoBrief),
      outputContract,
      geoQuality,
      promptTemplate,
      styleGuidance: { expectedPlatforms: expectedPlatformNames, platformGuidance: expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false },
      retrieval: { strategy: "rag", query: topic.title, topK: 12, minScore: 0.62, approvedItems: planKnowledgeSummary(plan).approved, retrievedChunks: evidence.length, usedCitations: citations.length },
      knowledgeBaseIds: scope.resolvedBaseIds,
      citationIds,
      omittedFields: createdGaps.map((gap) => gap.field),
      instruction: promptTemplate,
      fingerprint: "demo-kb-" + articleId.toLowerCase()
    },
    knowledgeStatus: { state: "ready_with_omissions", availableItems: planKnowledgeSummary(plan).approved, evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, gapCount: createdGaps.length, message: citations.length + " 条事实已有证据；" + createdGaps.map((gap) => gap.label).join("与") + "因缺少知识而省略。" }
  };
}

function articleFromTopic(topic, plan, index) {
  const articleId = uid("ART") + index;
  const bundle = createArticleKnowledgeBundle(articleId, topic, plan);
  return {
    id: articleId,
    title: topic.title,
    topicId: topic.id,
    topicSnapshot: cloneData(topic),
    planId: plan.id,
    businessLineId: plan.businessLineId,
    status: "draft",
    reviewStatus: "pending",
    reviewStage: "draft",
    reviewSubmittedAt: null,
    reviewSubmittedBy: null,
    reviewNote: "",
    reviewedAt: null,
    reviewedBy: null,
    version: "v1",
    author: "AI 内容助手",
    category: plan.contentType,
    riskStatus: "unscanned",
    sources: bundle.citations.length,
    citations: bundle.citations.map((citation) => citation.id),
    knowledgeSnapshot: bundle.knowledgeSnapshot,
    generationSnapshot: bundle.generationSnapshot,
    geoQuality: bundle.geoQuality,
    writingAgentId: bundle.generationSnapshot.writingAgent?.agentId || null,
    writingAgentVersion: bundle.generationSnapshot.writingAgent?.version || null,
    writingAgentNameSnapshot: bundle.generationSnapshot.writingAgent?.nameSnapshot || null,
    versions: [],
    knowledgeStatus: bundle.knowledgeStatus,
    updatedAt: Date.now(),
    keywords: [topic.keyword, topic.intent, "企业知识"],
    excerpt: bundle.citations[0]?.quote || "来自内容计划「" + plan.name + "」的企业知识型文章初稿。",
    content: bundle.content
  };
}

function studioResetArticleReview(article, riskStatus = "unscanned") {
  article.reviewStatus = "pending";
  article.reviewStage = "draft";
  article.reviewSubmittedAt = null;
  article.reviewSubmittedBy = null;
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.status = "draft";
  article.riskStatus = riskStatus;
  articleCitations(article).forEach((citation) => { citation.status = "needs_review"; });
  if (article.knowledgeSnapshot) article.knowledgeSnapshot.frozenAt = null;
  if (article.knowledgeStatus) {
    article.knowledgeStatus.state = "needs_review";
    article.knowledgeStatus.message = "正文已变化，需要重新核验引用、执行风控并人工审核。";
  }
  if (article.generationSnapshot?.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot.topicSnapshot || {}, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
}

function studioBumpArticleVersion(article, reason, reasonLabel) {
  archiveArticleRevision(article, reason, reasonLabel);
  const current = Number(String(article.version || "v1").replace(/\D/g, "")) || 1;
  article.version = "v" + (current + 1);
  return studioCloneCitationsForVersion(article, article.version);
}

function syncStudioArticleEditor(options = {}) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const article = studioArticleForWorkspace(workspace);
  const titleInput = document.getElementById("studio-title-editor");
  const contentInput = document.getElementById("studio-content-editor");
  if (!workspace || !article || !titleInput || !contentInput) return article || null;
  const nextTitle = titleInput.value.trim();
  const nextContent = sanitizeStudioHtml(contentInput.innerHTML.trim());
  if (!nextTitle) {
    if (!options.silent) showToast("标题不能为空", "请填写文章标题后再保存。", "error");
    titleInput.focus();
    return null;
  }
  const baseline = articleContentForEditor(article, articleCitations(article)).trim();
  const changed = nextTitle !== article.title || nextContent !== baseline;
  const requiresNewVersion = changed && (article.reviewStatus === "approved" || article.status === "published");
  const citationClone = requiresNewVersion ? studioBumpArticleVersion(article, "manual_edit", "人工编辑前") : null;
  article.title = nextTitle;
  article.content = citationClone?.idMap ? studioRemapCitationIds(nextContent, citationClone.idMap) : nextContent;
  if (changed) studioResetArticleReview(article, "stale");
  article.updatedAt = Date.now();
  workspace.updatedAt = article.updatedAt;
  if (requiresNewVersion && !options.silent) showToast("已生成新版本", "已审核正文发生变化，需要重新审核与风控。");
  else if (!options.silent) showToast("草稿已保存", "文章正文和 AI 会话均已保存在当前客户空间。");
  saveState();
  return article;
}

function studioPlainText(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function studioHeadings(html) {
  return [...String(html || "").matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => studioPlainText(match[1])).filter(Boolean);
}

function studioReplaceHeadings(html, headings) {
  let index = 0;
  const semanticHeadings = ["直接回答", "适用对象与问题边界", "关键判断与事实依据", "实施步骤或决策清单", "常见追问", "信息边界与更新时间"];
  const replaced = String(html || "").replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi, (match) => {
    const custom = headings[index];
    const current = match.replace(/<[^>]+>/g, "").trim();
    const semantic = semanticHeadings[index] || current || "正文要点";
    index += 1;
    return `<h2>${escapeHtml(semantic)}${custom && custom !== semantic ? "（" + escapeHtml(custom) + "）" : ""}</h2>`;
  });
  if (index) return replaced;
  return replaced + headings.map((heading) => `<h2>${escapeHtml(heading)}</h2><p>请结合当前企业知识证据补充本节内容。</p>`).join("");
}

function studioFirstParagraphRewrite(html, prompt) {
  const match = String(html || "").match(/<p\b[^>]*>[\s\S]*?<\/p>/i);
  if (!match) return html;
  const markers = [...match[0].matchAll(/<button\b[^>]*data-citation-id="[^"]+"[^>]*>[\s\S]*?<\/button>/gi)].map((item) => item[0]).join("");
  const intro = prompt.includes("简洁")
    ? "先说结论：这项决策应从真实业务问题和已审核企业知识出发，再确定内容结构与发布路径。"
    : "这篇文章先明确读者要解决的核心问题，再用可追溯的企业知识说明判断依据、适用条件和下一步行动。";
  return String(html || "").replace(match[0], `<p id="p-intro">${escapeHtml(intro)}${markers}</p>`);
}

function buildStudioProposal(article, prompt, agentSnapshot) {
  if (!article) return null;
  const currentHash = studioContentHash(article.content);
  const lower = String(prompt || "").toLowerCase();
  if ((prompt.includes("标题") || lower.includes("headline")) && !prompt.includes("结构")) {
    const topic = article.topicSnapshot?.title || article.title;
    const title = topic.includes("？") ? topic : `${topic.replace(/[。！!]+$/, "")}：从企业知识到可执行决策`;
    return { kind: "title", label: "标题建议", title, before: article.title, after: title, baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  if (prompt.includes("开头") || prompt.includes("导语") || prompt.includes("简洁")) {
    const html = studioFirstParagraphRewrite(article.content, prompt);
    return { kind: "rewrite", label: "开篇重写建议", html, before: "现有开篇", after: "结论先行，并保留原企业知识引用", baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  if (prompt.includes("插入") || prompt.includes("补充") || prompt.includes("增加一节")) {
    const html = `${article.content}<h2>补充：落地前的核验清单</h2><ul><li>核对企业知识版本与适用边界。</li><li>确认内容面向的决策角色与发布渠道。</li><li>发布前重新完成引用、风险和人工审核。</li></ul>`;
    return { kind: "insert", label: "补充段落建议", html, before: "现有正文", after: "新增“落地前的核验清单”", baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  let headings;
  if (prompt.includes("采购") || prompt.includes("决策")) headings = ["一、先明确采购目标与适用场景", "二、用可核验维度比较方案", "三、签约前完成证据核验清单"];
  else if (prompt.includes("案例")) headings = ["一、案例背景与真实问题", "二、实施过程与关键选择", "三、结果、边界与可借鉴之处"];
  else if (prompt.includes("问答") || prompt.includes("FAQ")) headings = ["一、先给出直接答案", "二、说明判断依据与适用条件", "三、给出下一步核验建议"];
  else headings = (agentSnapshot?.structure || ["结论先行", "分点论证", "行动建议"]).slice(0, 3).map((heading, index) => `${["一", "二", "三"][index]}、${heading}`);
  const before = studioHeadings(article.content);
  return { kind: "structure", label: "文章结构调整建议", html: studioReplaceHeadings(article.content, headings), before: before.join(" → ") || "当前正文结构", after: headings.join(" → "), baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
}

function studioMessageSources(workspace, conversation) {
  const selectedIds = new Set(conversation?.selectedKnowledgeItemIds || []);
  const knowledgeSources = studioApprovedKnowledgeEntries(workspace).filter((entry) => selectedIds.has(entry.item.id)).map((entry) => ({
    sourceType: "knowledge",
    title: entry.item.title || entry.item.question,
    meta: `${entry.base.name} · v${entry.version.version} · 已审核`,
    knowledgeBaseId: entry.base.id,
    itemId: entry.item.id,
    versionId: entry.version.id
  }));
  if (conversation?.webSearchEnabled) knowledgeSources.push({
    sourceType: "web",
    title: "公开网页检索结果（演示）",
    meta: `外部资料 · 未经企业审核 · ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content"
  });
  return knowledgeSources;
}

async function sendStudioChat() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  if (!workspace || !conversation) return;
  const input = document.getElementById("studio-composer-input");
  const prompt = (input?.value || ui.studioComposerDraft).trim();
  if (!prompt) return showToast("请输入调整要求", "例如：改成采购决策结构，并保留知识引用。", "error");
  const article = syncStudioArticleEditor({ silent: true }) || studioArticleForWorkspace(workspace);
  const agent = writingAgentById(conversation.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  if (!agent || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return showToast("写作智能体不可用", "请选择适用于当前业务线和内容形式的智能体。", "error");
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: "studio_chat" });
  const attachments = (workspace.attachmentIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter(Boolean).map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, reviewStatus: asset.reviewStatus }));
  const sources = studioMessageSources(workspace, conversation);
  const contextSnapshot = {
    businessLineId: workspace.businessLineId,
    topic: cloneData(studioWorkspaceTopic(workspace, article)),
    articleVersion: article?.version || null,
    contentHash: article ? studioContentHash(article.content) : null,
    knowledgeBaseIds: cloneData(conversation.selectedKnowledgeBaseIds || []),
    knowledgeItemIds: cloneData(conversation.selectedKnowledgeItemIds || []),
    attachmentIds: cloneData(workspace.attachmentIds || []),
    imageIds: cloneData(conversation.imageIds || []),
    webSearchEnabled: Boolean(conversation.webSearchEnabled)
  };
  if (!article) {
    const editorBodyDraft = (document.getElementById("studio-content-editor")?.innerText || workspace.draftContent || "").trim();
    const hasEditorDraft = Boolean((document.getElementById("studio-title-editor")?.value || workspace.draftTitle || "").trim() || editorBodyDraft);
    conversation.messages.push({ id: uid("MSG"), role: "user", text: prompt, createdAt: Date.now(), agentSnapshot, contextSnapshot, attachments });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = "";
    ui.studioTopicDraft = prompt;
    saveState();
    const generated = await generateStudioArticle(prompt, { fromChat: true, preserveDraft: hasEditorDraft });
    if (!generated) showToast("暂时无法生成", "请检查业务线、写作智能体和已审核企业知识后重试。", "error");
    if (generated && editorBodyDraft) {
      const proposal = buildStudioProposal(generated, prompt, agentSnapshot);
      const generatedContext = { ...contextSnapshot, topic: cloneData(studioWorkspaceTopic(workspace, generated)), articleVersion: generated.version, contentHash: studioContentHash(generated.content) };
      const responseText = proposal?.kind === "title"
        ? "我已基于你刚才的正文给出标题建议，尚未写入文章。"
        : proposal?.kind === "insert"
          ? "我已基于你刚才的正文补出一节落地核验清单，点击应用后才会写入正文。"
          : "我已基于你刚才的正文整理出结构差异，点击应用后才会写入正文。";
      conversation.messages.push({ id: uid("MSG"), role: "assistant", text: responseText, createdAt: Date.now(), agentSnapshot, contextSnapshot: generatedContext, sources, attachments, proposal });
      conversation.updatedAt = Date.now();
      workspace.updatedAt = conversation.updatedAt;
      saveState();
      render();
    }
    return;
  }
  conversation.messages.push({ id: uid("MSG"), role: "user", text: prompt, createdAt: Date.now(), agentSnapshot, contextSnapshot, attachments });
  const providerId = selectedTextProviderId();
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId && item.status === "active");
  const evidence = articleCitations(article).map((citation) => ({
    item: { title: citation.claim || citation.title || "已审核企业事实" },
    quote: citation.quote || citation.excerpt || "",
    base: { name: citation.source || citation.sourceName || "企业知识库" },
    version: { id: citation.versionId || citation.knowledgeVersionId || "", content: citation.quote || "" }
  }));
  if (!providerId || !line || !evidence.length) {
    const failureText = !providerId ? "尚未配置文本模型，无法生成 AI 修改建议。" : !line ? "当前业务线不可用，无法生成 AI 修改建议。" : "当前文章没有冻结的已审核证据，无法安全重写。";
    conversation.messages.push({ id: uid("MSG"), role: "assistant", text: failureText, createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal: null });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = "";
    saveState();
    render();
    return showToast("AI 协作未执行", failureText, "error");
  }
  let remoteRevision;
  try {
    remoteRevision = await requestAiArticle({
      providerId,
      line,
      contentType: workspace.contentType,
      topic: studioWorkspaceTopic(workspace, article),
      agentSnapshot,
      evidence,
      expectedPlatforms: planExpectedPlatformGuidance(contentPlanForArticle(article)).map((item) => item.name),
      userInstruction: `${prompt}\n当前文章标题：${article.title}\n当前文章正文：${studioPlainText(article.content).slice(0, 12000)}`
    });
  } catch (error) {
    const failureText = `模型没有生成可用的修改建议：${error.message || "请检查模型与知识配置后重试。"}`;
    conversation.messages.push({ id: uid("MSG"), role: "assistant", text: failureText, createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal: null });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = "";
    saveState();
    render();
    return showToast("AI 协作失败", failureText, "error");
  }
  const titleOnly = (prompt.includes("标题") || String(prompt).toLowerCase().includes("headline")) && !prompt.includes("结构");
  const proposal = {
    kind: titleOnly ? "title" : "rewrite",
    label: titleOnly ? "AI 标题建议" : "AI 正文修改建议",
    title: String(remoteRevision.title || article.title).slice(0, 240),
    html: titleOnly ? null : String(remoteRevision.html || remoteRevision.content || ""),
    before: titleOnly ? article.title : `当前 ${article.version}`,
    after: String(remoteRevision.summary || "已按本次要求重写，并保留证据边界。").slice(0, 300),
    baseArticleVersion: article.version,
    baseContentHash: studioContentHash(article.content),
    status: "pending",
    generationRunId: remoteRevision.generationRunId || remoteRevision.runId || null,
    model: remoteRevision.model || selectedTextModelName(),
    usage: remoteRevision.usage || null
  };
  const responseText = titleOnly
    ? "模型给出了一版更聚焦客户问题的标题，尚未写入文章。"
    : "模型已经按你的要求重写正文并保留企业知识引用，点击“应用到正文”后才会创建新版本。";
  conversation.messages.push({ id: uid("MSG"), role: "assistant", text: responseText + (conversation.webSearchEnabled ? " 联网结果单独标为外部资料，不会当成企业知识证据。" : ""), createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal });
  conversation.updatedAt = Date.now();
  workspace.updatedAt = conversation.updatedAt;
  ui.studioComposerDraft = "";
  saveState();
  render();
  window.setTimeout(() => {
    const messages = document.querySelector(".studio-chat-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
    document.getElementById("studio-composer-input")?.focus();
  }, 30);
}

function applyStudioProposal(messageId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const message = conversation?.messages.find((item) => item.id === messageId);
  const proposal = message?.proposal;
  const article = syncStudioArticleEditor({ silent: true }) || studioArticleForWorkspace(workspace);
  if (!article || !proposal || proposal.status !== "pending") return showToast("建议不可用", "请重新发送调整要求。", "error");
  if (proposal.baseArticleVersion !== article.version || proposal.baseContentHash !== studioContentHash(article.content)) return showToast("建议已过期", "正文或版本在建议生成后发生了变化，请重新让 AI 生成建议。", "error");
  const citationClone = studioBumpArticleVersion(article, "ai_collaboration", "应用 AI 建议前");
  if (proposal.kind === "title") article.title = proposal.title;
  else article.content = sanitizeStudioHtml(studioRemapCitationIds(proposal.html, citationClone?.idMap));
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  article.editEvents = Array.isArray(article.editEvents) ? article.editEvents : [];
  article.editEvents.unshift({ id: uid("EDIT"), type: "ai_proposal_applied", messageId, proposalKind: proposal.kind, fromVersion: proposal.baseArticleVersion, toVersion: article.version, agentSnapshot: cloneData(message.agentSnapshot), contextSnapshot: cloneData(message.contextSnapshot), createdAt: article.updatedAt });
  proposal.status = "applied";
  proposal.appliedVersion = article.version;
  proposal.appliedAt = article.updatedAt;
  conversation.messages.forEach((item) => {
    if (item.id !== messageId && item.proposal?.status === "pending") {
      item.proposal.status = "discarded";
      item.proposal.discardReason = "正文已生成新版本";
      item.proposal.discardedAt = article.updatedAt;
    }
  });
  conversation.messages.push({ id: uid("MSG"), role: "system", text: `建议已应用并创建 ${article.version}。审核、引用核验和风控已重置，旧版本仍可追溯。`, createdAt: article.updatedAt });
  conversation.updatedAt = article.updatedAt;
  workspace.status = "draft";
  workspace.updatedAt = article.updatedAt;
  saveState();
  render();
  showToast("AI 建议已应用", `已创建 ${article.version}，提交审核前需要重新风控并核验引用。`);
}

function discardStudioProposal(messageId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const message = conversation?.messages.find((item) => item.id === messageId);
  if (!message?.proposal) return;
  message.proposal.status = "discarded";
  message.proposal.discardedAt = Date.now();
  conversation.updatedAt = Date.now();
  saveState();
  render();
}

async function generateStudioArticle(topicOverride = "", options = {}) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace || workspace.articleId) return;
  const draftTitle = (document.getElementById("studio-title-editor")?.value || workspace.draftTitle || "").trim();
  const draftContentElement = document.getElementById("studio-content-editor");
  const draftContentHtml = sanitizeStudioHtml(draftContentElement?.innerHTML?.trim() || workspace.draftContentHtml || "");
  const draftContent = (draftContentElement?.innerText || workspace.draftContent || "").trim();
  const topicText = String(topicOverride || [draftTitle, draftContent].filter(Boolean).join("\n") || ui.studioTopicDraft).trim();
  const lineId = document.getElementById("studio-business-line")?.value || workspace.businessLineId;
  const contentType = document.getElementById("studio-content-type")?.value || workspace.contentType;
  const agentId = document.getElementById("studio-direct-agent")?.value || workspace.writingAgentId;
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  const agent = writingAgentById(agentId);
  if (!topicText) return showToast("请先填写主题", "输入这篇文章要回答的问题或具体写作要求。", "error");
  if (!line) return showToast("业务线不可用", "请选择一个有效的产品 / 业务线。", "error");
  if (!agent || !writingAgentSupports(agent, line.id, contentType)) return showToast("写作智能体不可用", "请选择适用于当前业务线和内容形式的智能体。", "error");
  const scope = workspace.knowledgeScope;
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: options.fromChat ? "studio_chat" : "quick_create", lockedAt: new Date().toISOString() });
  const context = { id: null, name: "AI 创作台 · 直接创作", businessLineId: line.id, contentType, articleIds: [], writingAgentId: agent.id, writingAgentSnapshot: agentSnapshot, knowledgeBaseIds: cloneData(scope.resolvedBaseIds), knowledgeScope: cloneData(scope), selectedKnowledgeItemIds: cloneData(workspace.selectedKnowledgeItemIds || []), createdAt: Date.now() };
  const evidence = generationEvidenceForPlan(context);
  if (!evidence.length && !options.manualOnly) return showToast("没有可用企业知识", "请先为当前业务线配置知识库，并审核至少一条知识。", "error");
  const firstLine = topicText.split(/\n/).map((item) => item.trim()).find(Boolean) || topicText;
  const title = (draftTitle || firstLine).length > 70 ? (draftTitle || firstLine).slice(0, 68) + "…" : (draftTitle || firstLine);
  const topic = { id: uid("DIRECT-TOPIC"), source: "custom", title, keyword: title.slice(0, 32), intent: "直接创作", prompt: topicText, userInstruction: topicOverride || null };
  topic.geoIntent = buildGeoQuestionIntent({ question: title, sourceKeyword: topic.keyword, dimension: "question", intent: "直接创作", stage: "方案评估", source: "AI 创作台" });
  topic.geoBrief = buildGeoTopicBrief(topic, { id: null, question: title, sourceKeyword: topic.keyword, dimension: "question", intent: "直接创作", stage: "方案评估", geoIntent: topic.geoIntent });
  const sourceTopicId = workspace.sourceTopicId || null;
  const sourceTopicSnapshot = cloneData(workspace.sourceTopicSnapshot || null);
  let remoteGeneration = null;
  if (!options.manualOnly) {
    const providerId = selectedTextProviderId();
    if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
    const approvedEvidence = evidence.map((entry, index) => ({
      id: `EVID-${index + 1}`,
      marker: `K${index + 1}`,
      claim: entry.item.title || entry.item.question || "已审核企业事实",
      quote: entry.quote,
      source: entry.base.name,
      locator: knowledgeLocator(entry.item, entry.version),
      versionId: entry.version.id,
      status: "approved",
      supportStatus: "supported"
    }));
    ui.studioGenerating = true;
    saveState();
    render();
    try {
      const modelQuestion = /[？?]/.test(topic.geoBrief.coreQuestion || "")
        ? topic.geoBrief.coreQuestion
        : `${topic.geoBrief.coreQuestion}应该如何判断和实施？`;
      const payload = await aiApi("/api/ai/generate/article", {
        method: "POST",
        body: {
          providerId,
          model: selectedTextModelName(),
          businessLine: aiBusinessLinePayload(line),
          contentType,
          topic: { id: topic.id, title: topic.title, coreQuestion: modelQuestion, dimension: topic.dimension || "question", intent: topic.intent, stage: topic.stage, geoBrief: { ...topic.geoBrief, coreQuestion: modelQuestion } },
          topicBrief: { ...topic.geoBrief, coreQuestion: modelQuestion },
          agentSnapshot,
          writingAgent: agentSnapshot,
          approvedEvidence,
          outputContract: buildGeoOutputContract(topic, [], agentSnapshot, { contentType })
        }
      });
      remoteGeneration = payload.data?.article || payload.article || payload.data || payload;
      const remoteHtml = remoteGeneration?.html || remoteGeneration?.content;
      if (!remoteHtml || typeof remoteHtml !== "string") throw new Error("模型没有返回可编辑的 HTML 文章");
      remoteGeneration = { ...remoteGeneration, html: remoteHtml, approvedEvidence };
    } catch (error) {
      ui.studioGenerating = false;
      saveState();
      render();
      showToast("文章生成失败", error.message || "模型未返回符合 GEO 文章契约的结果，请重试。", "error");
      return null;
    }
  }
  const article = articleFromTopic(topic, context, 0);
  article.topicId = null;
  article.planId = null;
  article.workspaceId = workspace.id;
  article.sourceType = workspace.sourceType === "topic_direct" ? "topic_direct" : "quick_create";
  article.sourceTopicId = sourceTopicId;
  article.sourceTopicSnapshot = sourceTopicSnapshot;
  article.topicSnapshot = cloneData(topic);
  article.businessLineId = line.id;
  article.category = contentType;
  article.author = "王宁 · AI 协作";
  if (remoteGeneration) {
    article.title = String(remoteGeneration.title || article.title).slice(0, 240);
    const citations = articleCitations(article);
    article.content = String(remoteGeneration.html || "").replace(/<sup\b([^>]*?)data-evidence-id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/sup>/gi, (match, before, evidenceId, after, label) => {
      const index = Number(String(evidenceId).replace(/\D/g, "")) - 1;
      const citation = citations[index];
      return citation ? citationMarkerHtml(citation) : String(label || "");
    });
    article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
    article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "real_model", generationMode: "model", model: remoteGeneration.model || selectedTextModelName(), usage: remoteGeneration.usage || null, requestId: remoteGeneration.requestId || null, omittedClaims: remoteGeneration.omittedClaims || [], warnings: remoteGeneration.warnings || [] };
  }
  if (options.manualOnly) {
    article.title = draftTitle || article.title;
    article.content = draftContentHtml || `<p>${escapeHtml(draftContent)}</p>`;
    article.excerpt = studioPlainText(article.content).slice(0, 180);
    const generatedCitationIds = new Set(article.citations || []);
    state.knowledgeCitations = (state.knowledgeCitations || []).filter((citation) => !generatedCitationIds.has(citation.id));
    state.knowledgeGaps = (state.knowledgeGaps || []).filter((gap) => gap.articleId !== article.id);
    article.citations = [];
    article.sources = 0;
    article.knowledgeSnapshot = { ...(article.knowledgeSnapshot || {}), citationIds: [], lockedVersionIds: [], frozenAt: null };
    article.knowledgeStatus = { state: "needs_review", evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "手工正文尚未映射企业知识引用，需要在 AI 协作或企业知识核验后再审核。" };
    article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "manual_editor", citationIds: [], topicSnapshot: cloneData(topic), instruction: "用户直接编辑的正文，未继承模板事实引用。" };
    article.sourceType = "manual_editor";
    article.author = "王宁 · 编辑";
  } else if (options.preserveDraft && (draftTitle || draftContent)) {
    article.title = draftTitle || article.title;
    if (draftContent) {
      article.content = draftContentHtml || `<p>${escapeHtml(draftContent)}</p>`;
      article.excerpt = studioPlainText(article.content).slice(0, 180);
      const generatedCitationIds = new Set(article.citations || []);
      state.knowledgeCitations = (state.knowledgeCitations || []).filter((citation) => !generatedCitationIds.has(citation.id));
      state.knowledgeGaps = (state.knowledgeGaps || []).filter((gap) => gap.articleId !== article.id);
      article.citations = [];
      article.sources = 0;
      article.knowledgeSnapshot = { ...(article.knowledgeSnapshot || {}), citationIds: [], lockedVersionIds: [], frozenAt: null };
      article.knowledgeStatus = { state: "needs_review", evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "手工正文尚未映射企业知识引用，需要在 AI 协作或企业知识核验后再审核。" };
      article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "manual_editor", citationIds: [], topicSnapshot: cloneData(topic), instruction: "用户直接编辑的正文，未继承模板事实引用。" };
      article.sourceType = "quick_editor_draft";
      article.author = "王宁 · 编辑";
    } else {
      article.sourceType = "quick_editor_title";
      article.author = "王宁 · 编辑";
    }
  }
  article.keywords = [topic.keyword, "直接创作", line.name];
  article.generationSnapshot = { ...article.generationSnapshot, sourceType: article.sourceType, workspaceId: workspace.id, planId: null, topicSnapshot: cloneData(topic), sourceTopicId, sourceTopicSnapshot };
  if (article.generationSnapshot.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, topic, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
  article.assetIds = cloneData(workspace.assetIds || []);
  state.articles.unshift(article);
  workspace.articleId = article.id;
  workspace.status = "draft";
  workspace.businessLineId = line.id;
  workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
  workspace.topic = cloneData(topic);
  workspace.draftTitle = "";
  workspace.draftContent = "";
  workspace.draftContentHtml = "";
  workspace.contentType = contentType;
  workspace.writingAgentId = agent.id;
  workspace.writingAgentSnapshot = agentSnapshot;
  workspace.knowledgeScope.lockedVersionIds = cloneData(article.knowledgeSnapshot?.lockedVersionIds || []);
  workspace.knowledgeScope.frozenAt = new Date().toISOString();
  workspace.updatedAt = Date.now();
  const conversation = studioConversationForWorkspace(workspace);
  if (conversation) {
    conversation.articleId = article.id;
    conversation.selectedAgentId = agent.id;
    const manualTextDraft = options.manualOnly || (options.preserveDraft && Boolean(draftContent));
    conversation.messages.push({ id: uid("MSG"), role: "system", text: manualTextDraft ? "已保存为手工编辑草稿。正文尚未建立企业知识引用，后续可在 AI 协作中继续写作或补充核验。" : `已基于 ${evidence.length} 条已审核企业知识生成 ${article.version} 初稿。正文、智能体和知识版本已记录，当前为待审核、未风控状态。`, createdAt: Date.now() });
    conversation.updatedAt = Date.now();
  }
  ui.studioArticleId = article.id;
  ui.studioAgentId = agent.id;
  ui.studioGenerating = false;
  saveState();
  render();
  showToast(options.manualOnly ? "草稿已保存" : "文章初稿已生成", options.manualOnly ? `已创建 ${article.id} · ${article.version}，可继续在右侧 AI 协作中写作。` : `已创建 ${article.id} · ${article.version}，可继续通过右侧 AI 对话调整。`);
  return article;
}

function studioAssetFigure(asset) {
  return `<figure class="studio-knowledge-image" data-asset-id="${escapeHtml(asset.id)}"><div class="knowledge-image-placeholder ${escapeHtml(asset.accent || "blue")}" role="img" aria-label="${escapeHtml(asset.altText || asset.name)}"><span data-icon="image"></span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.kind === "knowledge_image" ? "企业知识库图片 · " + (asset.license || "来源已记录") : "创作素材 · 待审核")}</small></div><figcaption>${escapeHtml(asset.caption || asset.altText || asset.name)}</figcaption></figure>`;
}

function insertStudioAsset(assetId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!workspace || !conversation || !asset) return;
  if (asset.kind === "knowledge_image" && !studioKnowledgeAssets(workspace).some((item) => item.id === asset.id)) return showToast("图片不可用", "只能使用当前知识范围内、对应已审核知识版本的图片。", "error");
  if (!conversation.imageIds.includes(asset.id)) conversation.imageIds.push(asset.id);
  const article = syncStudioArticleEditor({ silent: true }) || studioArticleForWorkspace(workspace);
  if (!article) {
    workspace.assetIds = Array.isArray(workspace.assetIds) ? workspace.assetIds : [];
    if (!workspace.assetIds.includes(asset.id)) workspace.assetIds.push(asset.id);
    const editor = document.getElementById("studio-content-editor");
    if (editor) {
      editor.insertAdjacentHTML("beforeend", studioAssetFigure(asset));
      workspace.draftContent = editor.innerText || "";
      workspace.draftContentHtml = sanitizeStudioHtml(editor.innerHTML);
    }
    workspace.updatedAt = Date.now();
    ui.studioPicker = null;
    saveState();
    render();
    return showToast("图片已插入草稿", "素材来源和审核状态已记录；保存文章后继续沿用。 ");
  }
  studioBumpArticleVersion(article, "asset_insert", "插入图片前");
  article.content = `${article.content}${studioAssetFigure(asset)}`;
  article.assetIds = Array.isArray(article.assetIds) ? article.assetIds : [];
  if (!article.assetIds.includes(asset.id)) article.assetIds.push(asset.id);
  workspace.assetIds = Array.isArray(workspace.assetIds) ? workspace.assetIds : [];
  if (!workspace.assetIds.includes(asset.id)) workspace.assetIds.push(asset.id);
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  workspace.updatedAt = article.updatedAt;
  ui.studioPicker = null;
  saveState();
  render();
  showToast("图片已插入", `已创建 ${article.version}，图片来源和版权信息已记录。`);
}

function generateStudioImageAsset() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const article = studioArticleForWorkspace(workspace);
  const asset = { id: uid("ASSET-AI"), kind: "generated", name: "文章主题配图（演示占位）", mime: "image/png", reviewStatus: "pending", license: "AI 配图占位 · 待人工确认", altText: article ? `${article.title}的文章主题示意图` : "文章主题示意图", caption: "AI 配图占位（待接入真实图片服务）", accent: "violet", createdAt: Date.now() };
  state.contentAssets.push(asset);
  insertStudioAsset(asset.id);
}

function approveArticleAsset(articleId, assetId) {
  const article = state.articles.find((item) => item.id === articleId);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!article || !asset || !(article.assetIds || []).includes(assetId)) return showToast("素材不存在", "请刷新文章后重试。", "error");
  asset.reviewStatus = "approved";
  asset.reviewedAt = new Date().toISOString();
  asset.reviewedBy = "王宁";
  asset.license = String(asset.license || "来源已确认").replace("待确认", "已确认");
  article.updatedAt = Date.now();
  addOperationLog("素材审核", `已确认文章《${article.title}》中的素材「${asset.name}」可用`);
  saveState();
  render();
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
  showToast("素材已确认", "已记录来源确认；文章仍需完成风控和人工审核后才可发布。");
}

function removeArticleAssetMarkup(html, assetId) {
  if (typeof document === "undefined") return String(html || "");
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  template.content.querySelectorAll("[data-asset-id]").forEach((node) => {
    if (node.getAttribute("data-asset-id") !== assetId) return;
    const container = node.closest("figure") || node;
    container.remove();
  });
  return template.innerHTML;
}

function removeArticleAsset(articleId, assetId) {
  const article = state.articles.find((item) => item.id === articleId);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!article || !asset || !(article.assetIds || []).includes(assetId)) return showToast("素材不存在", "请刷新文章后重试。", "error");
  studioBumpArticleVersion(article, "asset_remove", "移除素材前");
  article.assetIds = article.assetIds.filter((id) => id !== assetId);
  article.content = removeArticleAssetMarkup(article.content, assetId);
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  (state.writingWorkspaces || []).filter((workspace) => workspace.articleId === article.id).forEach((workspace) => {
    workspace.assetIds = (workspace.assetIds || []).filter((id) => id !== assetId);
    workspace.updatedAt = article.updatedAt;
    const conversation = studioConversationForWorkspace(workspace);
    if (conversation) conversation.imageIds = (conversation.imageIds || []).filter((id) => id !== assetId);
  });
  addOperationLog("素材审核", `已从文章《${article.title}》移出素材「${asset.name}」，并创建 ${article.version} 新版本`);
  saveState();
  render();
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
  showToast("素材已移出", `已创建 ${article.version} 新版本，需重新完成风控与人工审核。`);
}

function addStudioFiles(fileList, kind = "attachment") {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const files = Array.from(fileList || []);
  if (!workspace || !conversation || !files.length) return;
  const assets = files.map((file) => ({ id: uid(kind === "image" ? "ASSET-IMG" : "ASSET-FILE"), kind: kind === "image" ? "upload" : "attachment", name: file.name, mime: file.type || "application/octet-stream", size: file.size, reviewStatus: "temporary", license: kind === "image" ? "用户上传 · 待确认" : "临时会话资料", altText: file.name, caption: file.name, accent: "teal", createdAt: Date.now() }));
  state.contentAssets.push(...assets);
  if (kind === "image") {
    insertStudioAsset(assets[0].id);
    return;
  }
  assets.forEach((asset) => {
    if (!workspace.attachmentIds.includes(asset.id)) workspace.attachmentIds.push(asset.id);
    if (!conversation.attachments.includes(asset.id)) conversation.attachments.push(asset.id);
  });
  workspace.updatedAt = Date.now();
  conversation.updatedAt = workspace.updatedAt;
  saveState();
  render();
  showToast("附件已加入本次对话", "附件仅作临时上下文，不会自动进入企业知识库或成为审核证据。");
}

function startNewStudioConversation() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace) return;
  const oldConversation = studioConversationForWorkspace(workspace);
  if (oldConversation) oldConversation.status = "archived";
  const id = uid("CHAT");
  const conversation = { id, workspaceId: workspace.id, articleId: workspace.articleId || null, status: "active", selectedAgentId: oldConversation?.selectedAgentId || workspace.writingAgentId, selectedKnowledgeBaseIds: cloneData(workspace.knowledgeScope.resolvedBaseIds), selectedKnowledgeItemIds: [], webSearchEnabled: false, attachments: [], imageIds: [], messages: [{ id: uid("MSG"), role: "assistant", text: "新对话已开始。文章正文没有变化；你可以换一个智能体，从新的角度提出修改要求。", createdAt: Date.now(), agentSnapshot: cloneData(workspace.writingAgentSnapshot) }], createdAt: Date.now(), updatedAt: Date.now() };
  state.aiConversations.unshift(conversation);
  workspace.conversationId = id;
  workspace.updatedAt = Date.now();
  ui.studioComposerDraft = "";
  ui.studioWebSearch = false;
  ui.studioPicker = null;
  saveState();
  render();
}

function aiEvidencePayload(evidence) {
  return (evidence || []).map((entry, index) => ({
    id: `EVID-${index + 1}`,
    marker: `K${index + 1}`,
    claim: entry.item?.title || entry.item?.question || "已审核企业事实",
    quote: entry.quote || entry.version?.content || "",
    source: entry.base?.name || "企业知识库",
    locator: knowledgeLocator(entry.item || {}, entry.version || {}),
    versionId: entry.version?.id || null,
    status: "approved",
    supportStatus: "supported"
  }));
}

function applyRemoteArticleResult(article, remoteGeneration) {
  if (!article || !remoteGeneration) return article;
  article.title = String(remoteGeneration.title || article.title).slice(0, 240);
  const citations = articleCitations(article);
  article.content = String(remoteGeneration.html || remoteGeneration.content || "").replace(/<sup\b([^>]*?)data-evidence-id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/sup>/gi, (match, before, evidenceId, after, label) => {
    const index = Number(String(evidenceId).replace(/\D/g, "")) - 1;
    const citation = citations[index];
    return citation ? citationMarkerHtml(citation) : String(label || "");
  });
  article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
  article.sources = citations.length;
  article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "real_model", generationMode: "model", model: remoteGeneration.model || selectedTextModelName(), usage: remoteGeneration.usage || null, requestId: remoteGeneration.requestId || null, omittedClaims: remoteGeneration.omittedClaims || [], warnings: remoteGeneration.warnings || [] };
  return article;
}

async function requestAiArticle({ providerId, line, contentType, topic, agentSnapshot, evidence, expectedPlatforms = [], userInstruction = "" }) {
  const coreQuestion = /[？?]/.test(topic?.geoBrief?.coreQuestion || topic?.title || "")
    ? (topic?.geoBrief?.coreQuestion || topic?.title)
    : `${topic?.geoBrief?.coreQuestion || topic?.title}应该如何判断和实施？`;
  const brief = { ...(topic?.geoBrief || buildGeoTopicBrief(topic, topic?.questionSnapshot)), coreQuestion };
  const payload = await aiApi("/api/ai/generate/article", {
    method: "POST",
    body: {
      providerId,
      model: selectedTextModelName(),
      businessLine: aiBusinessLinePayload(line),
      contentType,
      topic: { id: topic.id, title: topic.title, coreQuestion, dimension: topic.dimension || "question", intent: topic.intent, stage: topic.stage, geoBrief: brief },
      topicBrief: brief,
      userInstruction: String(userInstruction || "").slice(0, 4000),
      agentSnapshot,
      writingAgent: agentSnapshot,
      approvedEvidence: aiEvidencePayload(evidence),
      expectedPlatforms,
      outputContract: buildGeoOutputContract({ ...topic, geoBrief: brief }, [], agentSnapshot, { contentType })
    }
  });
  const remote = payload.data?.article || payload.article || payload.data || payload;
  if (!remote || typeof (remote.html || remote.content) !== "string") throw new Error("模型没有返回可编辑的 HTML 文章");
  return remote;
}

async function executeContentPlan(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  const resolvedAgent = resolvePlanWritingAgent(plan);
  if (!resolvedAgent?.snapshot || !resolvedAgent.agent) return showToast("计划缺少写作智能体", "请重新创建内容计划；系统不会静默换用默认智能体。", "error");
  if (resolvedAgent.agent.status !== "active") return showToast("写作智能体不可用", "该智能体已停用，请恢复后再生成；系统不会静默换用其他智能体。", "error");
  const evidence = generationEvidenceForPlan(plan);
  if (!evidence.length) return showToast("没有可用企业知识", "请先为计划选择知识库，并审核至少一条知识。", "error");
  if (resolvedAgent.snapshot.missingEvidenceAction === "block" && generationGapLabels(plan, { blockingOnly: true }).length) return showToast("知识缺口阻止生成", "当前智能体要求证据完整，请先补齐并审核计划中的知识缺口。", "error");
  const providerId = selectedTextProviderId();
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const line = state.businessLines.find((item) => item.id === plan.businessLineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "内容计划所属业务线已停用，不能继续生成文章。", "error");
  closeModal();
  plan.status = "generating";
  plan.updatedAt = Date.now();
  saveState();
  render();
  plan.topicIds = contentPlanTopicIds(plan);
  plan.topicSnapshots = Array.isArray(plan.topicSnapshots) ? plan.topicSnapshots.filter((topic) => topic && topic.id).map((topic) => cloneData(topic)) : [];
  const topicSnapshotById = new Map(plan.topicSnapshots.map((topic) => [topic.id, topic]));
  plan.articleIds = [...new Set((Array.isArray(plan.articleIds) ? plan.articleIds : []).filter(Boolean))];
  const created = [];
  const missingTopics = [];
  const failedTopics = [];
  for (const [index, topicId] of plan.topicIds.entries()) {
    const existing = state.articles.find((article) => contentPlanForArticle(article)?.id === plan.id && article.topicId === topicId);
    if (existing) {
      existing.planId = plan.id;
      existing.businessLineId = existing.businessLineId || plan.businessLineId;
      if (!plan.articleIds.includes(existing.id)) plan.articleIds.push(existing.id);
      continue;
    }
    const topic = topicSnapshotById.get(topicId) || state.topics.find((item) => item.id === topicId);
    if (!topic) {
      missingTopics.push(topicId);
      continue;
    }
    if (!topicSnapshotById.has(topicId)) {
      const snapshot = cloneData(topic);
      plan.topicSnapshots.push(snapshot);
      topicSnapshotById.set(topicId, snapshot);
    }
    try {
      const remote = await requestAiArticle({
        providerId,
        line,
        contentType: plan.contentType,
        topic,
        agentSnapshot: resolvedAgent.snapshot,
        evidence,
        expectedPlatforms: planExpectedPlatformNames(plan)
      });
      const article = applyRemoteArticleResult(articleFromTopic(topic, plan, index), remote);
      article.geoQuality = evaluateGeoArticleQuality(article.content, topic, articleCitations(article));
      article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
      state.articles.unshift(article);
      plan.articleIds.push(article.id);
      created.push(article);
      plan.updatedAt = Date.now();
      saveState();
      render();
    } catch (error) {
      failedTopics.push({ topicId, title: topic.title, message: error.message || "模型生成失败" });
    }
  }
  const progress = contentPlanProgress(plan);
  plan.status = !failedTopics.length && progress.total && !progress.missing ? "produced" : "planned";
  plan.updatedAt = Date.now();
  if (plan.writingAgentSnapshot && !plan.writingAgentSnapshot.lockedAt) plan.writingAgentSnapshot.lockedAt = new Date().toISOString();
  saveState();
  ui.contentView = "articles";
  ui.articleTaskView = "articles";
  ui.articlePlanFilterId = plan.id;
  ui.articleTab = "all";
  navigate("content");
  const message = failedTopics.length
    ? `已生成 ${created.length} 篇，另有 ${failedTopics.length} 篇失败；失败项未使用本地模板替代，可修正模型或知识后重试。首个错误：${failedTopics[0].message}`
    : created.length
    ? "已从计划生成 " + created.length + " 篇待审核初稿。" + (progress.missing ? "仍有 " + progress.missing + " 个选题待生成。" : "")
    : missingTopics.length
      ? "部分选题记录已不存在，计划仍保留待处理状态。"
      : "计划中的选题已经存在文章，已打开内容生产。";
  showToast(failedTopics.length ? "部分文章生成失败" : "内容任务已创建", message, failedTopics.length ? "error" : "success");
}

function selectedTextProviderId() {
  return String(state.settings?.modelProviderId || "").trim();
}

function selectedTextModelName() {
  return String(state.settings?.model || "").trim();
}

function normalizeAiQuestionCandidate(item, index, packId, businessLineId, seeds, generationRunId = null) {
  if (!item || typeof item !== "object") throw new Error("模型返回了无法识别的问题项");
  const dimension = String(item.dimension || "").trim();
  const question = String(item.question || "").trim();
  const sourceKeyword = String(item.source_keyword || item.sourceKeyword || "").trim();
  if (!DIMENSIONS.some((entry) => entry.id === dimension && entry.id !== "all") || !question || !/[？?]/.test(question) || !sourceKeyword) {
    throw new Error("模型返回的问题缺少完整问句、来源关键词或栏目");
  }
  if (!seeds.some((seed) => seed.toLowerCase() === sourceKeyword.toLowerCase())) {
    throw new Error(`模型返回了未在本次拓展中出现的来源关键词：${sourceKeyword}`);
  }
  const intentLabels = { question: "客户问答", comparison: "方案对比", selection: "方案选择", evaluation: "效果评估", implementation: "实施落地", risk: "风险核验" };
  const stageLabels = { discovery: "需求认知", shortlist: "方案筛选", evaluation: "方案评估", purchase: "采购决策", implementation: "实施落地", renewal: "复盘续费" };
  const modelRecommendation = Math.max(0, Math.min(100, Number(item.modelRecommendation ?? item.recommendation_score ?? item.recommendation ?? 0) || 0));
  const business = Math.max(0, Math.min(100, Number(item.business_score ?? item.business ?? 0) || 0));
  const questionRecord = applyQuestionPriorityScore({
    id: `Q-AI-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    packId,
    businessLineId,
    sourceKeyword,
    question,
    dimension,
    intent: intentLabels[item.intent] || String(item.intent || "客户问答"),
    stage: stageLabels[item.decision_stage] || String(item.decision_stage || "需求认知"),
    coverage: "未覆盖",
    source: "AI 模型拓展",
    status: "candidate",
    version: 1,
    topicId: null,
    selected: false,
    modelRecommendation,
    business,
    quality: {
      askability: scoreTo100(item.quality?.askability ?? item.askability, 82),
      specificity: scoreTo100(item.quality?.specificity ?? item.specificity, 72),
      businessRelevance: scoreTo100(item.quality?.businessRelevance ?? item.businessRelevance, 78),
      evidenceReadiness: scoreTo100(item.quality?.evidenceReadiness ?? item.evidenceReadiness, 68),
      duplicateRisk: scoreTo100(item.quality?.duplicateRisk ?? item.duplicateRisk, 12)
    },
    reason: String(item.reason || "基于客户角色、场景与决策任务生成").slice(0, 500),
    generationMode: "real_model",
    engine: "openai-compatible",
    askerRole: String(item.asker_role || "").slice(0, 200),
    triggerScenario: String(item.trigger_scenario || "").slice(0, 500),
    expectedAnswer: String(item.expected_answer || "").slice(0, 1000),
    followUpQuestions: Array.isArray(item.follow_up_questions) ? item.follow_up_questions.map(String).slice(0, 10) : [],
    queryRewrites: Array.isArray(item.query_rewrites) ? item.query_rewrites.map(String).slice(0, 10) : [],
    evidenceRequirements: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String).slice(0, 20) : [],
    generationRunId: item.generationRunId || item.generation_run_id || generationRunId || null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  questionRecord.geoIntent = buildGeoQuestionIntent(questionRecord);
  return questionRecord;
}

async function expandSeedKeywords() {
  const line = activeBusinessLine();
  if (!line || ui.seedExpanding) return;
  const inputTerms = [...new Set(ui.businessKeywordInput.split(/[，,;；\n]/).map((term) => term.trim()).filter(Boolean))];
  if (inputTerms.length > 8) {
    ui.businessKeywordError = "一次最多使用 8 个核心关键词拓展种子词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (inputTerms.some((term) => term.length > 40)) {
    ui.businessKeywordError = "单个核心关键词不能超过 40 个字。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  const coreKeywords = state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active" && !isSeedKeyword(item));
  const coreByTerm = new Map(coreKeywords.map((item) => [item.term.toLowerCase(), item]));
  const now = Date.now();
  const newCoreKeywords = inputTerms.filter((term) => !coreByTerm.has(term.toLowerCase())).map((term, index) => ({
    id: uid("KW") + index,
    businessLineId: line.id,
    term,
    type: "核心关键词",
    keywordRole: "core",
    source: "智能拓展入口",
    status: "active",
    createdAt: now,
    updatedAt: now
  }));
  newCoreKeywords.forEach((item) => coreByTerm.set(item.term.toLowerCase(), item));
  const inputCoreKeywords = inputTerms.map((term) => coreByTerm.get(term.toLowerCase())).filter(Boolean);
  const selectedIds = new Set(ui.selectedCoreKeywordIds || []);
  const validSelectedCoreKeywords = coreKeywords.filter((item) => selectedIds.has(item.id));
  const requestedCoreKeywords = inputCoreKeywords.length
    ? [...inputCoreKeywords, ...validSelectedCoreKeywords]
    : (validSelectedCoreKeywords.length ? validSelectedCoreKeywords : coreKeywords);
  const requestedUniqueCoreKeywords = [...new Map(requestedCoreKeywords.map((item) => [item.id, item])).values()];
  const selectedCoreKeywords = requestedUniqueCoreKeywords.slice(0, 8);
  if (selectedIds.size && !validSelectedCoreKeywords.length) ui.selectedCoreKeywordIds = [];
  if (!selectedCoreKeywords.length) {
    ui.businessKeywordError = "请输入一个核心关键词，或勾选下方已有核心关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (requestedUniqueCoreKeywords.length > 8) {
    ui.businessKeywordError = "本次输入和勾选的核心关键词合计不能超过 8 个。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  let providerId = selectedTextProviderId();
  if (!providerId && !aiProviderSnapshot.loaded) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  if (newCoreKeywords.length) state.keywords.unshift(...newCoreKeywords);
  ui.selectedCoreKeywordIds = selectedCoreKeywords.map((item) => item.id);
  ui.businessKeywordInput = "";
  ui.businessKeywordError = "";
  ui.seedExpanding = true;
  saveState();
  render();
  try {
    const existingSeeds = state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active" && isSeedKeyword(item)).map((item) => item.term);
    const payload = await aiApi("/api/ai/generate/seeds", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: aiBusinessLinePayload(line),
        coreKeywords: selectedCoreKeywords.map((item) => item.term),
        existingSeeds,
        count: 8
      }
    });
    const data = payload.data || payload;
    const rawSeeds = data.seeds || data.items || [];
    if (!Array.isArray(rawSeeds) || !rawSeeds.length) throw new Error("模型没有返回可用的种子词");
    const existing = new Set(existingSeeds.map((term) => term.toLowerCase()));
    const added = rawSeeds.map((item, index) => {
      const term = String(item?.term || item?.keyword || item?.name || "").trim().slice(0, 80);
      if (!term || existing.has(term.toLowerCase())) return null;
      existing.add(term.toLowerCase());
      const sourceKeyword = String(item?.sourceKeyword || item?.source_keyword || selectedCoreKeywords[0].term).trim();
      const sourceCore = selectedCoreKeywords.find((keyword) => keyword.term.toLowerCase() === sourceKeyword.toLowerCase()) || selectedCoreKeywords[0];
      return {
        id: uid("KW-SEED") + index,
        businessLineId: line.id,
        term,
        type: "种子词",
        keywordRole: "seed",
        source: "AI 智能拓展",
        sourceCoreKeywordIds: [sourceCore.id],
        sourceCoreKeywords: [sourceCore.term],
        reason: String(item?.reason || "由核心关键词智能拓展").slice(0, 240),
        relevance: Number(item?.relevance) || 78,
        business: Number(item?.business) || 72,
        generationRunId: item?.generationRunId || data.generationRunId || data.runId || null,
        selected: true,
        status: "active",
        createdAt: now,
        updatedAt: now
      };
    }).filter(Boolean).slice(0, 8);
    if (!added.length) throw new Error("模型返回的种子词都已存在，请调整核心关键词后重试");
    ui.seedInput = added.map((item) => item.term).join("，");
    ui.seedError = "";
    ui.seedExpanding = false;
    saveState();
    render();
    showToast("种子词拓展完成", `已根据核心关键词生成 ${added.length} 个种子词，可编辑确认后生成问题词包。`);
  } catch (error) {
    ui.seedExpanding = false;
    saveState();
    render();
    showToast("种子词拓展失败", error.message || "模型没有返回可用种子词，请检查模型配置后重试。", "error");
  }
}

function editSeedKeyword(keywordId) {
  const keyword = state.keywords.find((item) => item.id === keywordId && isSeedKeyword(item));
  if (!keyword) return;
  const nextTerm = window.prompt("编辑种子词", keyword.term)?.trim();
  if (!nextTerm || nextTerm === keyword.term) return;
  if (nextTerm.length > 80) return showToast("种子词过长", "单个种子词不能超过 80 个字。", "error");
  const duplicate = state.keywords.some((item) => item.id !== keyword.id && item.businessLineId === keyword.businessLineId && item.status === "active" && item.term.toLowerCase() === nextTerm.toLowerCase());
  if (duplicate) return showToast("种子词已存在", "请修改为其他表达。", "error");
  const terms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean).map((term) => term.toLowerCase() === keyword.term.toLowerCase() ? nextTerm : term);
  keyword.term = nextTerm;
  keyword.updatedAt = Date.now();
  ui.seedInput = [...new Set(terms)].slice(0, 8).join("，");
  saveState();
  render();
  showToast("种子词已修改", "后续生成的问题词包将使用新的种子词表达。");
}

function deleteSeedKeyword(keywordId) {
  const keyword = state.keywords.find((item) => item.id === keywordId && isSeedKeyword(item));
  if (!keyword) return;
  if (!window.confirm(`确认删除种子词“${keyword.term}”？`)) return;
  state.keywords = state.keywords.filter((item) => item.id !== keyword.id);
  ui.seedInput = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter((term) => term && term.toLowerCase() !== keyword.term.toLowerCase()).join("，");
  saveState();
  render();
  showToast("种子词已删除", "已生成的历史问题词包不会受到影响。");
}

async function generateQuestionPack() {
  const seeds = ui.seedInput.split(/[，,;\n]/).map((seed) => seed.trim()).filter(Boolean);
  const unique = [...new Set(seeds)].map((seed) => seed.slice(0, 40));
  const line = activeBusinessLine();
  if (!unique.length) {
    ui.seedError = "请至少输入 1 个种子词。";
    render();
    document.getElementById("seed-input")?.focus();
    return;
  }
  if (unique.length > 8) {
    ui.seedError = "一次最多输入 8 个种子词，请减少后再试。";
    render();
    document.getElementById("seed-input")?.focus();
    return;
  }
  let providerId = selectedTextProviderId();
  if (!providerId && !aiProviderSnapshot.loaded) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) {
    return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中添加供应商，并绑定默认文本模型。", "error");
  }
  ui.seedError = "";
  ui.expanding = true;
  const businessLineId = line.id;
  const businessLineName = line.name;
  render();
  try {
    const payload = await aiApi("/api/ai/generate/questions", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: aiBusinessLinePayload(line),
        seeds: unique,
        existingQuestions: state.questionLibrary.filter((item) => item.businessLineId === businessLineId && item.status !== "archived").map((item) => item.question).slice(0, 100),
        dimensions: DIMENSIONS.filter((dimension) => dimension.id !== "all").map((dimension) => dimension.id)
      }
    });
    const data = payload.data || payload;
    const rawQuestions = data.questions || data.customerQuestions || data.items || [];
    if (!Array.isArray(rawQuestions) || !rawQuestions.length) throw new Error("模型没有返回问题候选");
    const packId = uid("KP");
    const existingKeywords = new Set(state.keywords.filter((item) => item.businessLineId === businessLineId && item.status === "active").map((item) => item.term.toLowerCase()));
    const sourceCoreIds = (ui.selectedCoreKeywordIds || []).filter((id) => state.keywords.some((item) => item.id === id && item.businessLineId === businessLineId && !isSeedKeyword(item)));
    const sourceCoreKeywords = sourceCoreIds.map((id) => state.keywords.find((item) => item.id === id)?.term).filter(Boolean);
    const seedKeywords = unique.filter((seed) => !existingKeywords.has(seed.toLowerCase())).map((term, index) => ({ id: uid("KW") + index, businessLineId, term, type: "种子词", keywordRole: "seed", source: "手动补充", sourceCoreKeywordIds: sourceCoreIds, sourceCoreKeywords, status: "active", selected: true, createdAt: Date.now() }));
    const seedSourceByTerm = new Map([
      ...state.keywords.filter((item) => item.businessLineId === businessLineId && item.status === "active" && isSeedKeyword(item)),
      ...seedKeywords
    ].map((item) => [item.term.toLowerCase(), item]));
    const questions = rawQuestions.map((item, index) => {
      const question = normalizeAiQuestionCandidate(item, index, packId, businessLineId, unique, data.generationRunId || data.runId || null);
      const sourceSeed = seedSourceByTerm.get(question.sourceKeyword.toLowerCase()) || null;
      const coreIds = [...new Set(sourceSeed?.sourceCoreKeywordIds || sourceCoreIds)];
      const coreTerms = [...new Set(sourceSeed?.sourceCoreKeywords || sourceCoreKeywords)];
      question.sourceSeedKeywordId = sourceSeed?.id || null;
      question.sourceSeedKeyword = sourceSeed?.term || question.sourceKeyword;
      question.sourceCoreKeywordIds = coreIds;
      question.sourceCoreKeywords = coreTerms;
      question.sourceChain = { businessLineId, coreKeywordIds: coreIds, coreKeywords: coreTerms, seedKeywordId: sourceSeed?.id || null, seedKeyword: sourceSeed?.term || question.sourceKeyword, packId };
      return question;
    });
    const counts = Object.fromEntries(DIMENSIONS.filter((dimension) => dimension.id !== "all").map((dimension) => [dimension.id, questions.filter((question) => question.dimension === dimension.id).length]));
    const missing = Object.entries(counts).filter(([, count]) => count !== QUESTION_VARIANT_LIMIT);
    if (missing.length) throw new Error("模型没有按每个栏目 5 个问题返回完整结果，请重试（缺少：" + missing.map(([dimension, count]) => `${dimension}=${count}`).join("、") + "）");
    state.keywords.unshift(...seedKeywords);
    const packCoreKeywords = [...new Set(questions.flatMap((question) => question.sourceCoreKeywords || []))];
    state.keywordPacks.unshift({ id: packId, businessLineId, title: unique[0] + (unique.length > 1 ? " 等 " + unique.length + " 个词" : "") + " · " + businessLineName, seeds: unique, coreKeywords: packCoreKeywords, source: "AI 生成问题词包", total: questions.length, generationRunId: data.generationRunId || data.runId || null, createdAt: Date.now() });
    state.questionLibrary.unshift(...questions);
    ui.selectedPackId = packId;
    ui.planningCategory = "all";
    ui.expanding = false;
    saveState();
    render();
    showToast("问题词包生成完成", "模型已按 8 个栏目各生成 5 个客户问题，共 " + questions.length + " 个候选；请勾选后加入问题词库。");
  } catch (error) {
    ui.expanding = false;
    saveState();
    render();
    showToast("问题词包生成失败", error.message || "模型未返回可用的结构化问题，请检查模型配置后重试。", "error");
  }
}

function generateArticlesFromTopics() {
  return openContentPlan();
}

function updateKeywordPackTotal(pack) {
  if (!pack) return;
  pack.total = state.questionLibrary.filter((question) => question.packId === pack.id && question.status === "candidate").length;
}

function removeKeywordCandidates(questionIds, options = {}) {
  const line = activeBusinessLine();
  const ids = new Set((questionIds || []).filter(Boolean));
  const pack = state.keywordPacks.find((item) => item.id === options.packId && item.businessLineId === line?.id);
  if (!line || !pack || !ids.size) return showToast("没有可删除的候选", "请先选择当前业务线词包中的候选问题。", "error");
  const candidates = state.questionLibrary.filter((question) => {
    if (!ids.has(question.id) || question.businessLineId !== line.id || question.packId !== pack.id || question.status !== "candidate") return false;
    const dimension = options.dimension || "all";
    return dimension === "all" || question.dimension === dimension;
  });
  if (!candidates.length) return showToast("没有可删除的候选", "已入问题词库的问题不会被此操作删除。", "error");
  const blocked = candidates.filter((question) => {
    const refs = planningQuestionReferences(question);
    return refs.topics.length || refs.plans.length || refs.articles.length;
  });
  const removable = candidates.filter((question) => !blocked.includes(question));
  if (!removable.length) return showToast("候选已有引用", "请先在问题词库或归档管理中处理引用关系。", "error");
  const deletedCandidateCounts = pack.deletedCandidateCounts && typeof pack.deletedCandidateCounts === "object" ? pack.deletedCandidateCounts : {};
  removable.forEach((question) => {
    const dimension = question.dimension || "question";
    deletedCandidateCounts[dimension] = (Number(deletedCandidateCounts[dimension]) || 0) + 1;
    question.selected = false;
  });
  const removableIds = new Set(removable.map((question) => question.id));
  state.questionLibrary = state.questionLibrary.filter((question) => !removableIds.has(question.id));
  pack.deletedCandidateCounts = deletedCandidateCounts;
  pack.autoFillSuppressed = true;
  updateKeywordPackTotal(pack);
  const currentLinePacks = state.keywordPacks.filter((item) => item.businessLineId === line.id);
  if (!currentLinePacks.some((item) => item.id === ui.selectedPackId)) ui.selectedPackId = currentLinePacks[0]?.id || null;
  saveState();
  render();
  const suffix = blocked.length ? `，另有 ${blocked.length} 条因存在引用而保留` : "";
  showToast(options.bulk ? "候选问题已批量删除" : "候选问题已删除", `已从当前词包移除 ${removable.length} 条候选${suffix}。`, blocked.length ? "warning" : "success");
}

function deleteKeywordCandidate(questionId) {
  const question = state.questionLibrary.find((item) => item.id === questionId);
  if (!question || question.status !== "candidate") return showToast("不能删除正式问题", "只有候选问题可以删除。", "error");
  return removeKeywordCandidates([questionId], { packId: question.packId, dimension: question.dimension, bulk: false });
}

function deleteKeywordCandidates(packId, dimension = "all") {
  const line = activeBusinessLine();
  const candidates = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.packId === packId && question.status === "candidate" && question.selected && (dimension === "all" || question.dimension === dimension));
  return removeKeywordCandidates(candidates.map((question) => question.id), { packId, dimension, bulk: true });
}

function deleteKeywordPack(packId) {
  const line = activeBusinessLine();
  const pack = state.keywordPacks.find((item) => item.id === packId && item.businessLineId === line?.id);
  if (!pack) return showToast("历史词包不存在", "请刷新页面后重试。", "error");
  const questions = state.questionLibrary.filter((question) => question.packId === pack.id && question.businessLineId === line.id);
  const linkedOrSaved = questions.filter((question) => {
    const refs = planningQuestionReferences(question);
    return question.status !== "candidate" || refs.topics.length || refs.plans.length || refs.articles.length;
  });
  const removableIds = new Set(questions.filter((question) => !linkedOrSaved.includes(question)).map((question) => question.id));
  const confirmText = linkedOrSaved.length
    ? `确认删除历史词包“${pack.title}”？未入库候选将删除，已有 ${linkedOrSaved.length} 个正式问题或引用记录会继续保留。`
    : `确认删除历史词包“${pack.title}”及其中 ${removableIds.size} 个候选问题？`;
  if (!window.confirm(confirmText)) return;
  state.questionLibrary = state.questionLibrary.filter((question) => !removableIds.has(question.id));
  linkedOrSaved.forEach((question) => {
    question.sourcePackTitle = question.sourcePackTitle || pack.title;
    question.packId = null;
  });
  state.keywordPacks = state.keywordPacks.filter((item) => item.id !== pack.id);
  const nextPack = state.keywordPacks.find((item) => item.businessLineId === line.id);
  ui.selectedPackId = nextPack?.id || null;
  ui.planningCategory = "all";
  saveState();
  render();
  showToast("历史词包已删除", linkedOrSaved.length ? `已删除 ${removableIds.size} 个未入库候选；${linkedOrSaved.length} 个正式问题及引用关系已保留。` : "词包及未入库候选问题已删除。");
}

function exportPlanningPack() {
  const line = activeBusinessLine();
  const packs = state.keywordPacks.filter((pack) => pack.businessLineId === line?.id);
  const pack = packs.find((item) => item.id === ui.selectedPackId) || packs[0];
  if (!pack) return showToast("没有可导出的词包", "请先添加关键词并执行一次智能拓展。", "error");
  const questions = state.questionLibrary.filter((question) => question.packId === pack.id && question.businessLineId === line?.id);
  if (!questions.length) return showToast("词包中没有问题", "当前词包没有可导出的拓展结果。", "error");
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["问题编号", "问题", "来源关键词", "内容方向", "状态", "建议强度"],
    ...questions.map((question) => [
      question.id,
      question.question,
      question.sourceKeyword,
      DIMENSIONS.find((item) => item.id === question.dimension)?.label || question.dimension,
      question.status === "candidate" ? "候选问题" : question.status === "active" ? "问题词库" : "已归档",
      question.recommendation || ""
    ])
  ];
  const blob = new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `${String(pack.title || "关键词拓展").replace(/[\\/:*?"<>|]+/g, "-")}-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("词包已导出", `已导出「${pack.title}」的 ${questions.length} 条问题及来源状态。`);
}

function verifyPublishResult(taskId, platform) {
  const task = state.publishTasks.find((item) => item.id === taskId);
  if (!task || !task.targets[platform]) return;
  showToast("请在本地发布器确认", "后台不会直接把待确认结果改成已发布；请在本地平台完成发布后，由发布器回写真实结果。", "info");
}

function runDiagnostic(button) {
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner" style="border-color:#9bb7ee;border-top-color:var(--blue)"></span>检测中';
  window.setTimeout(() => {
    state.site.lastDiagnostic = new Date().toLocaleString("zh-CN", { hour12: false });
    state.site.diagnosticStatus = "正常";
    saveState();
    render();
    showToast("站点检测完成", "基础访问、页面结构与抓取配置均正常。");
  }, 1200);
}

function persistOnboardingDraft() {
  const profile = state.enterpriseProfile;
  const value = (id) => document.getElementById(id)?.value.trim();
  if (ui.onboardingStep === 1) {
    if (value("onboard-company") !== undefined) profile.companyName = value("onboard-company");
    if (value("onboard-brand") !== undefined) profile.brandName = value("onboard-brand");
    if (value("onboard-intro") !== undefined) profile.introduction = value("onboard-intro");
    if (value("onboard-domain") !== undefined) profile.officialDomain = value("onboard-domain");
    if (value("onboard-industry") !== undefined) profile.industryRegion = value("onboard-industry");
  }
  if (ui.onboardingStep === 2) {
    if (value("onboard-service") !== undefined) profile.primaryService = value("onboard-service");
    if (value("onboard-service-desc") !== undefined) profile.serviceDescription = value("onboard-service-desc");
    if (value("onboard-audience") !== undefined) profile.audience = value("onboard-audience");
    if (value("onboard-area") !== undefined) profile.serviceArea = value("onboard-area");
  }
  saveState();
}

function saveOnboardingCurrentStep() {
  const required = [];
  if (ui.onboardingStep === 1) {
    required.push(["onboard-company", "请填写企业全称"], ["onboard-intro", "请填写企业介绍"]);
  } else if (ui.onboardingStep === 2) {
    required.push(["onboard-service", "请填写主推产品或服务"], ["onboard-service-desc", "请说明业务定位与交付边界"]);
  }
  for (const [id, message] of required) {
    const input = document.getElementById(id);
    if (!input?.value.trim()) {
      input?.classList.add("input-error");
      input?.focus();
      showToast("建档信息未完成", message, "error");
      return false;
    }
  }
  persistOnboardingDraft();
  return true;
}

function refreshMonitoring() {
  if (ui.monitoringRefreshing) return;
  ui.monitoringRefreshing = true;
  closeModal();
  navigate("monitoring");
  render();
  window.setTimeout(() => {
    state.monitoring.lastRunAt = Date.now();
    state.monitoring.tasks.filter((task) => !task.archivedAt).forEach((task) => {
      task.lastRunAt = Date.now();
      task.status = "success";
      if (!task.totalSamples) {
        task.totalSamples = Math.max(task.questionCount * task.platforms.length, 1);
        task.validSamples = Math.max(task.totalSamples - Math.min(3, task.totalSamples), 0);
      }
    });
    state.monitoring.trackedWorks.forEach((work) => {
      const boundCount = Number(work.questionIds?.length || work.questions || 0);
      if (!boundCount) return;
      work.questions = boundCount;
      work.citedDays = Math.max(Number(work.citedDays || 0), 1);
      work.citations = Math.max(Number(work.citations || 0), Math.min(boundCount, Math.max(1, Math.ceil(boundCount / 2))));
      work.status = "success";
      work.updatedAt = Date.now();
    });
    addOperationLog("效果监测", "完成一轮演示采样并更新内容资产引用追踪");
    ui.monitoringRefreshing = false;
    saveState();
    render();
    showToast("本轮演示采样已完成", "已生成 15 / 18 个有效演示样本；没有请求真实 AI 平台。");
  }, 1100);
}

function submitMonitorTask() {
  const nameInput = document.getElementById("monitor-task-name");
  const name = nameInput?.value.trim() || "";
  const platforms = Array.from(document.querySelectorAll("[data-monitor-task-platform]:checked")).map((input) => input.value);
  ui.monitorPlatformSelection = platforms.slice();
  if (!name) {
    ui.monitorTaskError = "请填写任务名称。";
    return renderModal();
  }
  if (!platforms.length) {
    ui.monitorTaskError = "请至少选择一个 AI 平台。";
    return renderModal();
  }
  const businessLineId = document.getElementById("monitor-task-business")?.value || activeBusinessLine()?.id;
  const businessLine = state.businessLines.find((line) => line.id === businessLineId && line.status === "active");
  if (!businessLine) {
    ui.monitorTaskError = "请选择一条可用业务线。";
    return renderModal();
  }
  state.monitoring.tasks.unshift({
    id: uid("MON"),
    name,
    businessLineId: businessLine.id,
    business: businessLine.name,
    businessNameSnapshot: businessLine.name,
    platforms,
    questionCount: 8,
    status: "queued",
    createdAt: Date.now(),
    lastRunAt: null,
    totalSamples: 0,
    validSamples: 0
  });
  ui.monitorTaskError = "";
  saveState();
  closeModal();
  ui.monitoringTab = "overview";
  navigate("monitoring");
  render();
  showToast("监测任务已创建", "原型已保存任务配置；真实采集服务仍需正式开发。");
}

function domainFromUrl(value, fallback = "tongzhuo.com") {
  try {
    return new URL(String(value || "")).hostname || fallback;
  } catch {
    return fallback;
  }
}

function saveMonitorQueries(assetId) {
  const record = articleAssetRecords().find((item) => item.id === assetId);
  if (!record) return showToast("内容资产不存在", "请刷新页面后重试。", "error");
  const questionIds = Array.from(document.querySelectorAll("[data-monitor-query-id]:checked")).map((input) => input.value);
  const customQuestion = document.getElementById("monitor-custom-question")?.value.trim() || "";
  if (customQuestion) {
    const existing = (state.monitoring.customQueries || []).find((item) => item.question.toLowerCase() === customQuestion.toLowerCase());
    const custom = existing || { id: uid("MQ"), question: customQuestion, source: "内容资产自定义", createdAt: Date.now() };
    if (!existing) state.monitoring.customQueries.unshift(custom);
    questionIds.push(custom.id);
  }
  const uniqueIds = [...new Set(questionIds)];
  if (!uniqueIds.length) return showToast("至少选择一个监测问题", "也可以在下方填写一个自定义问题。", "error");
  const article = record.article;
  state.monitoring.queryBindings = (state.monitoring.queryBindings || []).filter((binding) => binding.articleId !== article.id);
  state.monitoring.queryBindings.push({
    id: uid("BIND"), articleId: article.id, assetId: record.id, articleVersion: article.version,
    questionIds: uniqueIds, updatedAt: Date.now(), updatedBy: "王宁"
  });
  let work = state.monitoring.trackedWorks.find((item) => item.articleId === article.id) || state.monitoring.trackedWorks.find((item) => item.title === article.title);
  const sourceUrl = record.sourceUrl || article.siteUrl || "";
  if (!work) {
    work = {
      id: uid("WORK"), articleId: article.id, title: article.title, site: sourceUrl ? state.site.domain : "待发布内容资产",
      type: sourceUrl ? "官网" : "内容资产", sourceDomain: domainFromUrl(sourceUrl), url: sourceUrl,
      citedDays: 0, questions: uniqueIds.length, citations: 0, status: "queued", questionIds: uniqueIds,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    state.monitoring.trackedWorks.unshift(work);
  } else {
    Object.assign(work, { articleId: article.id, title: article.title, questions: uniqueIds.length, questionIds: uniqueIds, updatedAt: Date.now() });
  }
  addOperationLog("监测配置", `为《${article.title}》绑定 ${uniqueIds.length} 个监测问题`);
  saveState();
  closeModal();
  render();
  showToast("监测问题已保存", `已将 ${uniqueIds.length} 个问题与这篇内容资产建立关联，可在效果监测中回看。`);
}

function saveTrackedWork(workId) {
  const existing = workId ? state.monitoring.trackedWorks.find((item) => item.id === workId) : null;
  const articleId = document.getElementById("tracked-work-article")?.value || "";
  const article = state.articles.find((item) => item.id === articleId);
  const title = document.getElementById("tracked-work-title")?.value.trim() || article?.title || "";
  const site = document.getElementById("tracked-work-site")?.value.trim() || "";
  const sourceDomain = document.getElementById("tracked-work-domain")?.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "";
  const url = document.getElementById("tracked-work-url")?.value.trim() || "";
  if (!title || !site || !sourceDomain) return showToast("作品信息不完整", "请填写作品标题、发布站点和来源域名。", "error");
  if (url && !/^https?:\/\//i.test(url)) return showToast("作品 URL 格式不正确", "请填写以 http:// 或 https:// 开头的完整地址。", "error");
  const questions = Math.max(0, Number(document.getElementById("tracked-work-questions")?.value || 0));
  const citations = Math.max(0, Number(document.getElementById("tracked-work-citations")?.value || 0));
  const payload = {
    articleId: articleId || null,
    title,
    site,
    type: document.getElementById("tracked-work-type")?.value || "内容平台",
    sourceDomain,
    url,
    citedDays: existing?.citedDays || 0,
    questions,
    citations,
    status: citations ? "success" : "queued",
    questionIds: articleId ? monitoringBindingsForArticle(articleId)?.questionIds || existing?.questionIds || [] : existing?.questionIds || [],
    updatedAt: Date.now()
  };
  if (existing) Object.assign(existing, payload);
  else state.monitoring.trackedWorks.unshift({ id: uid("WORK"), ...payload, createdAt: Date.now() });
  addOperationLog("引用追踪", `${existing ? "更新" : "添加"}作品《${title}》`);
  saveState();
  closeModal();
  ui.monitoringTab = "tracking";
  navigate("monitoring");
  render();
  showToast(existing ? "作品已更新" : "作品已加入追踪", "记录已保存，可随时打开修改或从引用信源分析中回看。");
}

function upsertAiProviderSnapshot(provider) {
  if (!provider?.id) return;
  const existingIndex = aiProviderSnapshot.providers.findIndex((item) => item.id === provider.id);
  const providers = [...aiProviderSnapshot.providers];
  if (existingIndex >= 0) providers[existingIndex] = provider;
  else providers.unshift(provider);
  aiProviderSnapshot = { ...aiProviderSnapshot, loaded: true, loading: false, providers, error: "" };
}

function enabledAiProviders(kind = "text") {
  return (aiProviderSnapshot.providers || []).filter((provider) => provider?.kind === kind && provider.status !== "disabled" && provider.id && provider.hasApiKey === true && (provider.model || provider.modelId));
}

function autoBindDefaultAiProvider(kind = "text", preferredProvider = null) {
  const providerKey = kind === "image" ? "imageProviderId" : "modelProviderId";
  const modelKey = kind === "image" ? "imageModel" : "model";
  const existingId = String(state.settings?.[providerKey] || "").trim();
  const existing = (aiProviderSnapshot.providers || []).find((provider) => provider.id === existingId && provider.kind === kind && provider.status !== "disabled" && provider.hasApiKey === true && (provider.model || provider.modelId));
  if (existing) {
    // Keep a stale display label from the pre-API demo state from being sent
    // as the upstream model ID.  The provider's model is the authoritative
    // default when the binding was created automatically.
    const configuredModel = String(state.settings?.[modelKey] || "").trim();
    const providerValidatedModel = existing.protocol === "deepseek" && existing.connectionStatus === "passed";
    if (!configuredModel || /DeepSeek\s*V\d|演示|默认模型/i.test(configuredModel) || (providerValidatedModel && existing.model && configuredModel !== existing.model)) {
      if (existing.model && state.settings[modelKey] !== existing.model) {
        state.settings[modelKey] = existing.model;
        return true;
      }
    }
    return false;
  }
  const candidates = enabledAiProviders(kind);
  const provider = preferredProvider && candidates.some((item) => item.id === preferredProvider.id)
    ? preferredProvider
    : candidates.length === 1 ? candidates[0] : null;
  if (!provider) return false;
  state.settings[providerKey] = provider.id;
  if (provider.model) state.settings[modelKey] = provider.model;
  return true;
}

function aiProviderFormPayload({ includeBlankKey = false } = {}) {
  const payload = {
    name: document.getElementById("ai-provider-name")?.value.trim() || "",
    protocol: document.getElementById("ai-provider-protocol")?.value || "openai_compatible",
    baseUrl: document.getElementById("ai-provider-base-url")?.value.trim() || "",
    model: document.getElementById("ai-provider-model")?.value.trim() || "",
    kind: document.getElementById("ai-provider-kind")?.value || "text",
    status: document.getElementById("ai-provider-status")?.value || "enabled"
  };
  const apiKeyInput = document.getElementById("ai-provider-key");
  const apiKey = apiKeyInput?.value.trim() || "";
  if (apiKey || includeBlankKey) payload.apiKey = apiKey;
  return payload;
}

async function saveAiProvider({ testAfter = false } = {}) {
  const providerId = ui.modal?.providerId || "";
  const returnToModelKind = ui.modal?.returnToModelKind || "";
  const payload = aiProviderFormPayload({ includeBlankKey: !providerId });
  if (!payload.name || !payload.baseUrl || !payload.model) return showToast("信息还没填完整", "供应商名称、API Base URL 和默认模型 ID 都是必填项。", "error");
  if (!providerId && !payload.apiKey) return showToast("API Key 不能为空", "新建供应商时请输入 API Key；编辑已有供应商可以留空以保持原密钥。", "error");
  try {
    const response = providerId
      ? await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}`, { method: "PATCH", body: payload })
      : await aiApi("/api/ai/providers", { method: "POST", body: payload });
    const provider = response.provider || response.data?.provider;
    upsertAiProviderSnapshot(provider);
    const autoBound = provider?.kind === "text" && provider.status !== "disabled"
      ? autoBindDefaultAiProvider("text", provider)
      : provider?.kind === "image" && provider.status !== "disabled"
        ? autoBindDefaultAiProvider("image", provider)
        : false;
    if (autoBound) saveState();
    if (testAfter && provider?.id) {
      const tested = await aiApi(`/api/ai/providers/${encodeURIComponent(provider.id)}/test`, { method: "POST", body: {} });
      const testedProvider = tested.result?.provider;
      upsertAiProviderSnapshot(testedProvider || provider);
      const rebound = testedProvider?.kind === "text" && testedProvider.status !== "disabled"
        ? autoBindDefaultAiProvider("text", testedProvider)
        : testedProvider?.kind === "image" && testedProvider.status !== "disabled"
          ? autoBindDefaultAiProvider("image", testedProvider)
          : false;
      if (rebound) saveState();
      showToast("供应商已保存并完成测试", tested.result?.message || "测试状态已更新。");
    } else {
      showToast(
        providerId ? "供应商配置已更新" : "API 供应商已添加",
        autoBound
          ? `${provider.name || "API 供应商"} 已保存，并已自动绑定为默认${provider.kind === "image" ? "图片" : "文本"}模型，现在可以生成选题和文章。`
          : "供应商已保存；如需用于生成，请在“更换模型”中选择它。"
      );
    }
    if (returnToModelKind) {
      ui.modal = { type: "modelEditor", modelKind: returnToModelKind };
      return renderModal();
    }
    closeModal();
    render();
  } catch (error) {
    showToast("供应商保存失败", error.message || "请检查服务端是否已启动。", "error");
  }
}

async function testAiProvider(providerId) {
  if (!providerId) return;
  try {
    const response = await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, { method: "POST", body: {} });
    const testedProvider = response.result?.provider;
    upsertAiProviderSnapshot(testedProvider);
    const rebound = testedProvider?.kind === "text" && testedProvider.status !== "disabled"
      ? autoBindDefaultAiProvider("text", testedProvider)
      : testedProvider?.kind === "image" && testedProvider.status !== "disabled"
        ? autoBindDefaultAiProvider("image", testedProvider)
        : false;
    if (rebound) saveState();
    render();
    showToast(response.result?.status === "passed" ? "连接测试通过" : "连接测试未通过", response.result?.message || "测试状态已更新。", response.result?.status === "passed" ? "success" : "error");
  } catch (error) {
    showToast("连接测试失败", error.message || "请检查服务端是否已启动。", "error");
  }
}

async function deleteAiProvider(providerId) {
  const provider = aiProviderSnapshot.providers.find((item) => item.id === providerId);
  if (!provider) return;
  if (state.settings.modelProviderId === providerId || state.settings.imageProviderId === providerId) return showToast("供应商正在使用中", "请先在默认模型中取消绑定后再删除。", "error");
  if (!window.confirm(`确认删除模型供应商“${provider.name}”？`)) return;
  try {
    await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}`, { method: "DELETE" });
    aiProviderSnapshot = { ...aiProviderSnapshot, providers: aiProviderSnapshot.providers.filter((item) => item.id !== providerId) };
    render();
    showToast("供应商已删除", "服务端密钥和供应商配置已一并移除。");
  } catch (error) {
    showToast("供应商删除失败", error.message || "请稍后重试。", "error");
  }
}

function saveModel(modelKind) {
  const kind = modelKind === "image" ? "image" : "text";
  const providerId = document.getElementById("model-provider")?.value || "";
  const customName = document.getElementById("model-custom-name")?.value.trim() || "";
  const provider = (aiProviderSnapshot.providers || []).find((item) => item.id === providerId);
  const modelName = (provider && (!customName || /DeepSeek\s*V\d|演示|默认模型/i.test(customName)) ? provider.model : customName) || provider?.model || "";
  if (!modelName) return showToast("模型 ID 不能为空", "请输入模型 ID，或先选择一个已配置默认模型的供应商。", "error");
  const key = kind === "image" ? "imageModel" : "model";
  const providerKey = kind === "image" ? "imageProviderId" : "modelProviderId";
  const before = state.settings[key];
  state.settings[key] = modelName;
  state.settings[providerKey] = providerId;
  addOperationLog("模型配置", `默认${kind === "image" ? "图片" : "文本"}模型由“${before}”更换为“${modelName}”${provider ? `，绑定供应商“${provider.name}”` : "，未绑定 API 供应商"}`);
  saveState();
  closeModal();
  render();
  showToast("默认模型已更新", `新生成任务将使用“${modelName}”${provider ? `（${provider.name}）` : ""}；历史文章的模型快照保持不变。`);
}

function saveMember(memberId) {
  const existing = memberId ? state.settings.members.find((member) => member.id === memberId) : null;
  const name = document.getElementById("member-name")?.value.trim() || "";
  const email = document.getElementById("member-email")?.value.trim().toLowerCase() || "";
  const role = document.getElementById("member-role")?.value || "内容运营";
  const status = document.getElementById("member-status")?.value || "invited";
  if (!name || !email) return showToast("成员信息不完整", "请填写姓名和邮箱。", "error");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("邮箱格式不正确", "请填写有效的企业邮箱地址。", "error");
  if (state.settings.members.some((member) => member.id !== memberId && member.email.toLowerCase() === email)) return showToast("邮箱已经存在", "该邮箱已属于当前客户空间的其他成员。", "error");
  const activeAdmins = state.settings.members.filter((member) => member.role === "管理员" && member.status !== "disabled");
  if (existing?.role === "管理员" && existing.status !== "disabled" && activeAdmins.length <= 1 && (role !== "管理员" || status === "disabled")) {
    return showToast("不能停用最后一名管理员", "请先将其他成员设为管理员。", "error");
  }
  const payload = { name, email, role, status };
  if (existing) Object.assign(existing, payload);
  else state.settings.members.push({ id: uid("MEMBER"), ...payload, lastLoginAt: null, createdAt: Date.now() });
  addOperationLog("成员权限", `${existing ? "更新成员" : "邀请成员"}：${name}（${role}）`);
  saveState();
  closeModal();
  render();
  showToast(existing ? "成员配置已保存" : "成员邀请已保存", existing ? "角色和状态已更新。" : "当前为演示待接受状态，不会实际发送邮件。");
}

function deleteMember(memberId) {
  const member = state.settings.members.find((item) => item.id === memberId);
  if (!member) return;
  const activeAdmins = state.settings.members.filter((item) => item.role === "管理员" && item.status !== "disabled");
  if (member.role === "管理员" && activeAdmins.length <= 1) return showToast("不能删除最后一名管理员", "请先将其他成员设为管理员。", "error");
  state.settings.members = state.settings.members.filter((item) => item.id !== memberId);
  addOperationLog("成员权限", `删除成员：${member.name}`);
  saveState();
  closeModal();
  render();
  showToast("成员已删除", `“${member.name}”已从当前客户空间移除。`);
}

function exportOperationLogs() {
  addOperationLog("日志导出", "导出当前客户空间的操作日志 CSV");
  const rows = [["时间", "分类", "操作人 / 来源", "详情"], ...(state.settings.operationLogs || []).map((entry) => [formatDateTime(entry.occurredAt), entry.category, entry.actor, entry.detail])];
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const day = new Date().toISOString().slice(0, 10);
  downloadTextFile(`tongzhuo-geo-operation-logs-${day}.csv`, csv, "text/csv;charset=utf-8");
  saveState();
  render();
  showToast("日志文件已下载", `已导出 ${Math.max(rows.length - 1, 0)} 条可回看的 CSV 记录。`);
}

function updateCommandResults() {
  const list = document.getElementById("command-list");
  if (!list) return;
  list.innerHTML = commandResultsHtml();
  hydrateIcons(list);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    closeModal();
    navigate(nav.dataset.nav);
    return;
  }

  const command = event.target.closest("[data-command-route], [data-command-action]");
  if (command) {
    const route = command.dataset.commandRoute;
    const action = command.dataset.commandAction;
    closeModal();
    if (route) navigate(route);
    if (action === "publish-approved") {
      const article = state.articles.find((item) => item.reviewStatus === "approved" && item.status === "draft");
      if (article) openPublish(article.id);
      else {
        ui.contentView = "articles";
        ui.articleTaskView = "articles";
        ui.articlePlanFilterId = "all";
        ui.articleTab = "approved";
        navigate("content");
      }
    }
    return;
  }

  const settingToggle = event.target.closest("[data-setting]");
  if (settingToggle) {
    const key = settingToggle.dataset.setting;
    state.settings[key] = !state.settings[key];
    const label = key === "riskGate" ? "文章风险门禁" : key === "manualReview" ? "人工审核" : key;
    addOperationLog("工作流设置", `${label}已${state.settings[key] ? "开启" : "关闭"}`);
    saveState();
    render();
    showToast("设置已保存", `${label}已${state.settings[key] ? "开启" : "关闭"}。`);
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (action === "open-sidebar") return document.body.classList.add("sidebar-open");
  if (action === "close-sidebar") return document.body.classList.remove("sidebar-open");
  if (action === "backdrop-close" && event.target === actionElement) return closeModal();
  if (action === "close-modal") return closeModal();
  if (action === "open-search") {
    ui.commandQuery = "";
    ui.modal = { type: "search" };
    renderModal();
    return window.setTimeout(() => document.getElementById("command-input")?.focus(), 30);
  }
  if (action === "open-notifications") {
    ui.modal = { type: "notifications" };
    return renderModal();
  }
  if (action === "user-menu") return showToast("当前用户：王宁", "角色为企业管理员。");
  if (action === "open-onboarding") {
    ui.onboardingStep = 1;
    ui.modal = { type: "onboarding" };
    return renderModal();
  }
  if (action === "onboarding-prev") {
    persistOnboardingDraft();
    ui.onboardingStep = Math.max(1, ui.onboardingStep - 1);
    return renderModal();
  }
  if (action === "onboarding-next") {
    if (!saveOnboardingCurrentStep()) return;
    ui.onboardingStep = Math.min(4, ui.onboardingStep + 1);
    return renderModal();
  }
  if (action === "onboarding-evidence") {
    const kind = actionElement.dataset.evidenceKind;
    const base = (state.knowledgeBases || []).find((item) => item.kind === kind) || null;
    if (base) {
      ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
      return renderModal();
    }
    closeModal();
    ui.knowledgeKindFilter = kind || "all";
    return navigate("knowledge");
  }
  if (action === "finish-onboarding") {
    state.enterpriseProfile.completion = 100;
    state.enterpriseProfile.steps.forEach((step) => { step.status = "complete"; });
    saveState();
    closeModal();
    navigate("planning");
    return showToast("企业建档已完成", "企业事实卡、问题集与监测基线已准备，可以进入选题中心。");
  }
  if (action === "preview-site") {
    ui.modal = { type: "sitePreview", pageId: "home" };
    return renderModal();
  }
  if (action === "focus-seed") {
    ui.planningTab = "keywords";
    ui.planningArchiveKind = "questions";
    navigate("planning");
    return window.setTimeout(() => document.getElementById("seed-input")?.focus(), 50);
  }
  if (action === "planning-tab") {
    ui.planningTab = actionElement.dataset.tab;
    ui.businessKeywordError = "";
    ui.questionError = "";
    return render();
  }
  if (action === "planning-archive-kind") {
    ui.planningTab = "archive";
    ui.planningArchiveKind = actionElement.dataset.kind === "topics" ? "topics" : "questions";
    return render();
  }
  if (action === "edit-question") {
    ui.modal = { type: "questionEditor", questionId: actionElement.dataset.questionId };
    return renderModal();
  }
  if (action === "edit-topic") {
    ui.modal = { type: "topicEditor", topicId: actionElement.dataset.topicId };
    return renderModal();
  }
  if (action === "archive-question") return archivePlanningQuestion(actionElement.dataset.questionId);
  if (action === "archive-topic") return archivePlanningTopic(actionElement.dataset.topicId);
  if (action === "restore-planning-record") return restorePlanningRecord(actionElement.dataset.kind, actionElement.dataset.recordId);
  if (action === "view-planning-relations") {
    ui.modal = { type: "planningRelations", kind: actionElement.dataset.kind, recordId: actionElement.dataset.recordId };
    return renderModal();
  }
  if (action === "request-delete-archive") {
    ui.modal = { type: "planningArchiveDelete", kind: actionElement.dataset.kind, recordId: actionElement.dataset.recordId };
    return renderModal();
  }
  if (action === "confirm-delete-archive") return permanentlyDeletePlanningRecord(actionElement.dataset.kind, actionElement.dataset.recordId);
  if (action === "submit-question-edit") return submitQuestionEdit();
  if (action === "submit-topic-edit") return submitTopicEdit();
  if (action === "content-view") {
    const view = actionElement.dataset.view;
    ui.contentView = ["studio", "agents", "articles"].includes(view) ? view : "articles";
    if (ui.contentView === "studio") ensureStudioWorkspace(null, false);
    return render();
  }
  if (action === "content-task-view") {
    ui.contentView = "articles";
    ui.articleTaskView = actionElement.dataset.view === "articles" ? "articles" : "plans";
    clearArticleSelection();
    if (actionElement.dataset.planFilter) ui.articlePlanFilterId = actionElement.dataset.planFilter;
    if (ui.articleTaskView === "plans") ui.articlePlanFilterId = "all";
    ui.articleTab = "all";
    return render();
  }
  if (action === "open-content-studio") return openContentStudio(null, { forceNew: true });
  if (action === "open-article-studio") {
    if (ui.modal?.type === "article") saveArticleEditor({ silent: true });
    return openContentStudio(actionElement.dataset.articleId);
  }
  if (action === "back-to-articles") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const studioArticle = studioArticleForWorkspace(workspace);
    const studioPlan = contentPlanForArticle(studioArticle);
    if (studioArticle) syncStudioArticleEditor({ silent: true });
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    if (studioPlan) ui.articlePlanFilterId = studioPlan.id;
    else if (studioArticle) ui.articlePlanFilterId = "__direct__";
    ui.articleTab = "all";
    return render();
  }
  if (action === "studio-pane") {
    ui.studioPane = ["editor", "chat", "info"].includes(actionElement.dataset.pane) ? actionElement.dataset.pane : "editor";
    return render();
  }
  if (action === "generate-studio-article") return generateStudioArticle();
  if (action === "save-studio-draft") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    return workspace?.articleId ? syncStudioArticleEditor() : generateStudioArticle("", { manualOnly: true });
  }
  if (action === "submit-studio-review") {
    const article = syncStudioArticleEditor({ silent: true });
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    if (!article || !workspace) return showToast("文章尚未生成", "请先生成文章初稿。", "error");
    if (!submitArticleForManualReview(article.id)) return;
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    const articlePlan = contentPlanForArticle(article);
    ui.articlePlanFilterId = articlePlan?.id || "__direct__";
    ui.articleTab = "pending";
    ui.articleSelection = [];
    render();
    ui.modal = { type: "article", articleId: article.id };
    renderModal();
    return showToast("已提交人工审核", "请核对正文、企业知识引用和内容风控；审核通过后才能发布。");
  }
  if (action === "toggle-studio-web") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!conversation) return;
    conversation.webSearchEnabled = !conversation.webSearchEnabled;
    conversation.updatedAt = Date.now();
    ui.studioWebSearch = conversation.webSearchEnabled;
    saveState();
    return render();
  }
  if (action === "open-studio-image-picker") {
    ui.studioPicker = ui.studioPicker === "image" ? null : "image";
    return render();
  }
  if (action === "open-studio-knowledge-picker") {
    ui.studioPicker = ui.studioPicker === "knowledge" ? null : "knowledge";
    return render();
  }
  if (action === "open-studio-knowledge-images") {
    ui.studioPicker = "knowledge-image";
    return render();
  }
  if (action === "close-studio-picker") {
    ui.studioPicker = null;
    return render();
  }
  if (action === "trigger-studio-attachment") return document.getElementById("studio-attachment-input")?.click();
  if (action === "trigger-studio-image-upload") return document.getElementById("studio-image-input")?.click();
  if (action === "toggle-studio-knowledge") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const itemId = actionElement.dataset.itemId;
    const allowed = studioApprovedKnowledgeEntries(workspace).some((entry) => entry.item.id === itemId);
    if (!conversation || !allowed) return showToast("知识不可引用", "只能引用当前业务线授权范围内的已审核知识。", "error");
    const selected = new Set(conversation.selectedKnowledgeItemIds || []);
    selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId);
    conversation.selectedKnowledgeItemIds = [...selected];
    conversation.updatedAt = Date.now();
    workspace.selectedKnowledgeItemIds = [...selected];
    workspace.updatedAt = conversation.updatedAt;
    saveState();
    return render();
  }
  if (action === "remove-studio-context") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!workspace || !conversation) return;
    const id = actionElement.dataset.id;
    if (actionElement.dataset.kind === "knowledge") {
      conversation.selectedKnowledgeItemIds = conversation.selectedKnowledgeItemIds.filter((itemId) => itemId !== id);
      workspace.selectedKnowledgeItemIds = workspace.selectedKnowledgeItemIds.filter((itemId) => itemId !== id);
    } else if (actionElement.dataset.kind === "attachment") {
      workspace.attachmentIds = workspace.attachmentIds.filter((assetId) => assetId !== id);
      conversation.attachments = conversation.attachments.filter((assetId) => assetId !== id);
    } else {
      conversation.imageIds = conversation.imageIds.filter((assetId) => assetId !== id);
    }
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    saveState();
    return render();
  }
  if (action === "send-studio-chat") return sendStudioChat();
  if (action === "apply-studio-proposal") return applyStudioProposal(actionElement.dataset.messageId);
  if (action === "discard-studio-proposal") return discardStudioProposal(actionElement.dataset.messageId);
  if (action === "copy-studio-proposal") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const message = studioConversationForWorkspace(workspace)?.messages.find((item) => item.id === actionElement.dataset.messageId);
    const proposal = message?.proposal;
    const text = proposal?.after || proposal?.title || studioPlainText(proposal?.html || "");
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    return showToast("建议已复制", "正文没有发生变化。");
  }
  if (action === "insert-studio-asset") return insertStudioAsset(actionElement.dataset.assetId);
  if (action === "generate-studio-image") return generateStudioImageAsset();
  if (action === "new-studio-conversation") return startNewStudioConversation();
  if (action === "article-format") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    const editor = document.getElementById("article-content-editor");
    if (!article || !editor) return;
    if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    editor.focus();
    document.execCommand(actionElement.dataset.command, false, actionElement.dataset.value || null);
    return;
  }
  if (action === "article-link") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    const editor = document.getElementById("article-content-editor");
    if (!article || !editor) return;
    if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    const url = window.prompt("请输入链接地址（https://…）", "https://");
    if (!url) return;
    let parsedUrl;
    try { parsedUrl = new URL(url.trim(), window.location.origin); } catch { return showToast("链接格式不正确", "只允许使用 http、https 或 mailto 链接。", "error"); }
    if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) return showToast("链接协议不允许", "只允许使用 http、https 或 mailto 链接。", "error");
    editor.focus();
    document.execCommand("createLink", false, parsedUrl.href);
    return;
  }
  if (action === "studio-format") {
    const editor = document.getElementById("studio-content-editor");
    if (!editor) return;
    editor.focus();
    document.execCommand(actionElement.dataset.command, false, actionElement.dataset.value || null);
    return;
  }
  if (action === "studio-link") {
    const editor = document.getElementById("studio-content-editor");
    if (!editor) return;
    const url = window.prompt("请输入链接地址（https://…）", "https://");
    if (!url) return;
    let parsedUrl;
    try { parsedUrl = new URL(url.trim(), window.location.origin); } catch { return showToast("链接格式不正确", "只允许使用 http、https 或 mailto 链接。", "error"); }
    if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) return showToast("链接协议不允许", "只允许使用 http、https 或 mailto 链接。", "error");
    editor.focus();
    document.execCommand("createLink", false, parsedUrl.href);
    return;
  }
  if (action === "create-writing-agent") {
    ui.modal = { type: "writingAgent" };
    return renderModal();
  }
  if (action === "open-writing-agent") {
    ui.modal = { type: "writingAgent", agentId: actionElement.dataset.agentId };
    return renderModal();
  }
  if (action === "copy-writing-agent") {
    ui.modal = { type: "writingAgent", cloneFromId: actionElement.dataset.agentId };
    return renderModal();
  }
  if (action === "save-writing-agent") return saveWritingAgent(actionElement.dataset.agentId || null);
  if (action === "toggle-writing-agent") return toggleWritingAgent(actionElement.dataset.agentId);
  if (action === "set-default-writing-agent") return setDefaultWritingAgent(actionElement.dataset.agentId);
  if (action === "open-writing-agent-manager") {
    ui.contentView = "agents";
    closeModal();
    return navigate("content");
  }
  if (action === "open-business-line") {
    ui.businessLineError = "";
    ui.modal = { type: "businessLine" };
    return renderModal();
  }
  if (action === "manage-business-lines" || action === "back-business-line-manager") {
    ui.modal = { type: "businessLineManager" };
    return renderModal();
  }
  if (action === "request-delete-business-line") {
    ui.modal = { type: "deleteBusinessLine", lineId: actionElement.dataset.lineId };
    return renderModal();
  }
  if (action === "confirm-delete-business-line") return deleteBusinessLine(actionElement.dataset.lineId);
  if (action === "restore-business-line") return restoreBusinessLine(actionElement.dataset.lineId);
  if (action === "submit-business-line") return submitBusinessLine();
  if (action === "focus-business-keyword") {
    ui.planningTab = "keywords";
    render();
    return window.setTimeout(() => document.getElementById("business-keyword-input")?.focus(), 30);
  }
  if (action === "add-business-keywords") return addBusinessKeywords();
  if (action === "toggle-core-keyword") {
    const keywordId = actionElement.dataset.keywordId;
    const selected = new Set(ui.selectedCoreKeywordIds || []);
    selected.has(keywordId) ? selected.delete(keywordId) : selected.add(keywordId);
    ui.selectedCoreKeywordIds = [...selected];
    return render();
  }
  if (action === "archive-business-keyword") {
    const keyword = state.keywords.find((item) => item.id === actionElement.dataset.keywordId);
    if (keyword) keyword.status = "archived";
    ui.selectedCoreKeywordIds = (ui.selectedCoreKeywordIds || []).filter((id) => id !== actionElement.dataset.keywordId);
    saveState();
    render();
    return showToast("关键词已归档", "历史词包和来源链不受影响。");
  }
  if (action === "expand-seeds") return expandSeedKeywords();
  if (action === "generate-question-pack") return generateQuestionPack();
  if (action === "edit-seed-keyword") return editSeedKeyword(actionElement.dataset.keywordId);
  if (action === "delete-seed-keyword") return deleteSeedKeyword(actionElement.dataset.keywordId);
  if (action === "delete-keyword-pack") return deleteKeywordPack(actionElement.dataset.packId);
  if (action === "delete-keyword-candidate") return deleteKeywordCandidate(actionElement.dataset.questionId);
  if (action === "delete-keyword-candidates") return deleteKeywordCandidates(actionElement.dataset.packId, actionElement.dataset.dimension || "all");
  if (action === "focus-question") {
    ui.planningTab = "questions";
    render();
    return window.setTimeout(() => document.getElementById("question-input")?.focus(), 30);
  }
  if (action === "add-question") return addQuestionToLibrary();
  if (action === "save-selected-questions") return saveSelectedQuestions();
  if (action === "remove-question") {
    const question = state.questionLibrary.find((item) => item.id === actionElement.dataset.questionId);
    if (question) question.selected = false;
    saveState();
    return render();
  }
  if (action === "clear-questions") {
    const line = activeBusinessLine();
    state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived").forEach((question) => { question.selected = false; });
    saveState();
    return render();
  }
  if (action === "questions-to-topics") return questionsToTopics();
  if (action === "question-to-topic") {
    const question = state.questionLibrary.find((item) => item.id === actionElement.dataset.questionId);
    if (!question || question.status === "archived") return showToast("问题已归档", "请先在归档管理中恢复，再生成选题。", "error");
    const linkedTopics = planningQuestionTopics(question);
    const activeTopics = linkedTopics.filter((topic) => topic.status !== "archived");
    const archivedTopics = linkedTopics.filter((topic) => topic.status === "archived");
    if (activeTopics.length) {
      ui.planningTab = "topics";
      return render();
    }
    if (archivedTopics.length) {
      ui.planningTab = "archive";
      ui.planningArchiveKind = "topics";
      return render();
    }
    return questionsToTopics([question.id]);
  }
  if (action === "direct-generate-topic") return openTopicDirectStudio(actionElement.dataset.topicId);
  if (action === "topic-to-plan") return openTopicPlanPicker(actionElement.dataset.topicId);
  if (action === "confirm-topic-candidate") return confirmTopicCandidate(actionElement.dataset.topicId);
  if (action === "submit-topic-plan-picker") return submitTopicPlanPicker();
  if (action === "create-plan-from-topic-picker") return createPlanFromTopicPicker(actionElement.dataset.topicId);
  if (action === "open-plan") return openContentPlan();
  if (action === "submit-content-plan") return submitContentPlan();
  if (action === "execute-plan" || action === "preview-plan-knowledge") return openGenerationPreview(actionElement.dataset.planId);
  if (action === "upgrade-plan-agent") return upgradePlanWritingAgent(actionElement.dataset.planId);
  if (action === "confirm-generate-plan") return executeContentPlan(actionElement.dataset.planId);
  if (action === "view-plan-content") {
    const plan = state.contentPlans.find((item) => item.id === actionElement.dataset.planId);
    if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
    ui.articleTab = "all";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = plan.id;
    if (ui.modal) closeModal();
    ui.contentView = "articles";
    navigate("content");
    return;
  }
  if (action === "select-pack") {
    const line = activeBusinessLine();
    state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived").forEach((question) => { question.selected = false; });
    ui.selectedPackId = actionElement.dataset.packId;
    ui.planningCategory = "all";
    saveState();
    return render();
  }
  if (action === "planning-category") {
    ui.planningCategory = actionElement.dataset.category;
    return render();
  }
  if (action === "remove-topic") {
    const topic = state.topics.find((item) => item.id === actionElement.dataset.topicId);
    if (topic) topic.selected = false;
    saveState();
    return render();
  }
  if (action === "clear-topics") {
    const line = activeBusinessLine();
    state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status !== "archived").forEach((topic) => { topic.selected = false; });
    saveState();
    return render();
  }
  if (action === "generate-article") return openContentPlan();
  if (action === "export-pack") return exportPlanningPack();
  if (action === "content-filter") {
    ui.articleFilterExpanded = !ui.articleFilterExpanded;
    return render();
  }
  if (action === "clear-content-filters") {
    ui.articleSearch = "";
    ui.articleRiskFilter = "all";
    ui.articleKnowledgeFilter = "all";
    clearArticleSelection();
    return render();
  }
  if (action === "article-tab") {
    ui.articleTaskView = "articles";
    ui.articleTab = actionElement.dataset.tab;
    clearArticleSelection();
    return render();
  }
  if (action === "open-batch-review") return openBatchReview();
  if (action === "confirm-batch-review") return approveSelectedArticles();
  if (action === "go-schedule-articles") {
    closeModal();
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "approved";
    clearArticleSelection();
    return navigate("content");
  }
  if (action === "open-schedule") return openScheduleForArticles(selectedArticleIdsForCurrentView(), ui.articlePlanFilterId && !["all", "__direct__"].includes(ui.articlePlanFilterId) ? ui.articlePlanFilterId : null);
  if (action === "schedule-plan") {
    const plan = state.contentPlans.find((item) => item.id === actionElement.dataset.planId);
    if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
    return openScheduleForArticles(contentPlanArticles(plan).map((article) => article.id), plan.id);
  }
  if (action === "move-schedule-platform") {
    if (!ui.scheduleSelection) return;
    const order = [...(ui.scheduleSelection.platformOrder || [])];
    const index = order.indexOf(actionElement.dataset.platform);
    const next = actionElement.dataset.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    ui.scheduleSelection.platformOrder = order;
    return renderModal();
  }
  if (action === "submit-schedule") return submitSchedule().catch((error) => showToast("排期创建失败", error.message, "error"));
  if (action === "cancel-schedule") return cancelPublishSchedule(actionElement.dataset.scheduleId);
  if (action === "show-pending-articles") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "pending";
    return navigate("content");
  }
  if (action === "show-approved-articles") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "approved";
    return navigate("content");
  }
  if (action === "open-article") return openArticle(actionElement.dataset.articleId);
  if (action === "approve-article-asset") return approveArticleAsset(actionElement.dataset.articleId, actionElement.dataset.assetId);
  if (action === "remove-article-asset") return removeArticleAsset(actionElement.dataset.articleId, actionElement.dataset.assetId);
  if (action === "request-regenerate-article") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    const agentId = document.getElementById("article-writing-agent")?.value;
    if (!article || !agentId) return showToast("请选择写作智能体", "选择后再创建文章新版本。", "error");
    ui.modal = { type: "regenerateArticle", articleId: article.id, agentId, unsavedChanges: articleEditorHasUnsavedChanges(article) };
    return renderModal();
  }
  if (action === "confirm-regenerate-article") return regenerateArticleWithAgent(actionElement.dataset.articleId, actionElement.dataset.agentId);
  if (action === "open-article-version") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (article && articleEditorHasUnsavedChanges(article)) return showToast("请先保存当前修改", "保存或撤销编辑器中的变化后再查看历史版本。", "error");
    ui.modal = { type: "articleVersion", articleId: actionElement.dataset.articleId, versionIndex: Number(actionElement.dataset.versionIndex) };
    return renderModal();
  }
  if (action === "open-citation") {
    const citation = (state.knowledgeCitations || []).find((item) => item.id === actionElement.dataset.citationId);
    if (!citation) return showToast("引用证据不存在", "请刷新页面后重试。", "error");
    const articleId = ui.modal?.articleId || citation.articleId;
    if (ui.modal?.type === "article") saveArticleEditor({ silent: true });
    ui.modal = { type: "citation", citationId: citation.id, articleId };
    return renderModal();
  }
  if (action === "save-article") {
    const article = saveArticleEditor();
    if (article) {
      ui.modal = { type: "article", articleId: article.id };
      renderModal();
    }
    return;
  }
  if (action === "submit-article-review") {
    const article = submitArticleForManualReview(actionElement.dataset.articleId || ui.modal?.articleId, { fromArticleModal: true });
    if (!article) return;
    render();
    ui.modal = { type: "article", articleId: article.id };
    renderModal();
    return showToast("已提交人工审核", "当前版本已进入人工审核；审核通过后才能发布。");
  }
  if (action === "approve-article") return approveArticle();
  if (action === "reject-article") return rejectArticle();
  if (action === "open-publish") return openPublish(actionElement.dataset.articleId);
  if (action === "open-publish-batch") return openPublishBatch();
  if (action === "back-to-publish-tasks") {
    ui.publishView = "tasks";
    ui.publishBatchSelection = null;
    ui.publishBatchSearch = "";
    ui.publishBatchArticleSearch = "";
    return render();
  }
  if (action === "publish-batch-category") {
    ui.publishBatchCategory = actionElement.dataset.category || "self_media";
    return render();
  }
  if (action === "publish-batch-select-eligible") {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.articleIds = publishBatchArticles().filter((article) => publishBatchEligibleArticle(article).ok).map((article) => article.id);
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (action === "publish-batch-select-all") {
    if (!ui.publishBatchSelection) return;
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (action === "move-publish-batch-platform") {
    if (!ui.publishBatchSelection) return;
    const order = [...(ui.publishBatchSelection.platformOrder || [])];
    const index = order.indexOf(actionElement.dataset.platform);
    const next = actionElement.dataset.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (action === "publish-batch-preflight") {
    const selection = ui.publishBatchSelection;
    const articles = (selection?.articleIds || []).map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
    const blocked = articles.filter((article) => !articlePublishEligibility(article).ok);
    const websiteSelected = (selection?.platforms || []).includes("web");
    if (blocked.length) return showToast("还有文章不能发布", `${blocked.length} 篇文章未满足审核、风控或知识证据条件。`, "error");
    if (!websiteSelected) return showToast("发布条件检查完成", "文章可以发布；本批次未选择官网主信源，后续引用分析可能缺少官方来源。", "warning");
    return showToast("发布条件检查通过", `${articles.length} 篇文章、${selection.platforms.length} 个平台均满足当前演示规则。`);
  }
  if (action === "submit-publish-batch") return submitPublishBatch().catch((error) => showToast("发布任务创建失败", error.message, "error"));
  if (action === "publish-approved") {
    const article = state.articles.find((item) => item.reviewStatus === "approved" && item.status === "draft" && item.riskStatus === "clean" && articleCitations(item).length && articleBusinessLineIsActive(item));
    if (!article) {
      ui.contentView = "articles";
      ui.articleTaskView = "articles";
      ui.articlePlanFilterId = "all";
      ui.articleTab = "approved";
      navigate("content");
      return showToast("暂无可发布文章", "请先审核一篇文章。", "error");
    }
    ui.contentView = "articles";
    return openPublish(article.id);
  }
  if (action === "submit-publish") return submitPublish().catch((error) => showToast("发布任务创建失败", error.message, "error"));
  if (action === "publish-tab") {
    ui.publishTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "asset-tab") {
    ui.assetTab = actionElement.dataset.tab || "all";
    ui.assetExpandedId = null;
    return render();
  }
  if (action === "asset-expand") {
    ui.assetExpandedId = ui.assetExpandedId === actionElement.dataset.assetId ? null : actionElement.dataset.assetId;
    return render();
  }
  if (action === "asset-clear-search") {
    ui.assetSearch = "";
    return render();
  }
  if (action === "open-asset-article") return openArticle(actionElement.dataset.articleId);
  if (action === "asset-open-monitoring") {
    const record = articleAssetRecords().find((item) => item.id === actionElement.dataset.assetId);
    ui.monitoringTab = "tracking";
    navigate("monitoring");
    return showToast("已打开作品引用追踪", record?.queryBinding?.questionIds?.length ? `《${record.article.title}》已绑定 ${record.queryBinding.questionIds.length} 个监测问题。` : "这篇资产尚未绑定监测问题，可以返回内容资产进行设置。");
  }
  if (action === "asset-add-query") {
    ui.modal = { type: "monitorQuery", assetId: actionElement.dataset.assetId };
    return renderModal();
  }
  if (action === "save-monitor-queries") return saveMonitorQueries(actionElement.dataset.assetId);
  if (action === "asset-new-version") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (article) openContentStudio(article.id);
    return showToast("已打开文章工作区", "保存修改后会生成新的文章版本，并重新进入审核流程。");
  }
  if (action === "task-log") {
    ui.modal = { type: "task", taskId: actionElement.dataset.taskId };
    return renderModal();
  }
  if (action === "verify-result") return verifyPublishResult(actionElement.dataset.taskId, actionElement.dataset.platform);
  if (action === "notification-task") {
    closeModal();
    ui.publishTab = "action";
    return navigate("publish");
  }
  if (action === "monitoring-tab") {
    ui.monitoringTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "open-monitor-task") {
    ui.monitorTaskError = "";
    ui.modal = { type: "monitorTask" };
    return renderModal();
  }
  if (action === "submit-monitor-task") return submitMonitorTask();
  if (action === "monitor-task-detail") {
    ui.modal = { type: "monitorDetail", taskId: actionElement.dataset.taskId };
    return renderModal();
  }
  if (action === "refresh-monitoring") return refreshMonitoring();
  if (action === "monitor-dialog-detail") {
    ui.modal = { type: "monitorEvidence", sampleId: actionElement.dataset.sampleId };
    return renderModal();
  }
  if (action === "monitor-source-works") {
    ui.modal = { type: "sourceWorks", sourceDomain: actionElement.dataset.sourceDomain };
    return renderModal();
  }
  if (action === "add-tracked-work") {
    ui.modal = { type: "trackedWork", sourceDomain: actionElement.dataset.sourceDomain || "", sourceName: actionElement.dataset.sourceName || "", sourceType: actionElement.dataset.sourceType || "" };
    return renderModal();
  }
  if (action === "edit-tracked-work") {
    ui.modal = { type: "trackedWork", workId: actionElement.dataset.workId };
    return renderModal();
  }
  if (action === "save-tracked-work") return saveTrackedWork(actionElement.dataset.workId || null);
  if (action === "delete-tracked-work") {
    const work = state.monitoring.trackedWorks.find((item) => item.id === actionElement.dataset.workId);
    if (!work) return;
    state.monitoring.trackedWorks = state.monitoring.trackedWorks.filter((item) => item.id !== work.id);
    addOperationLog("引用追踪", `删除作品《${work.title}》`);
    saveState();
    closeModal();
    render();
    return showToast("追踪作品已删除", "内容资产和文章原文不会被删除。", "success");
  }
  if (action === "site-tab") {
    ui.siteTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "site-page") {
    ui.sitePageId = actionElement.dataset.pageId || "home";
    ui.siteTab = "pages";
    return render();
  }
  if (action === "site-content-tab") {
    ui.siteContentTab = actionElement.dataset.tab || "articles";
    return render();
  }
  if (action === "site-category-filter") {
    ui.siteCategoryFilter = actionElement.dataset.filter || "all";
    ui.siteContentTab = "articles";
    return render();
  }
  if (action === "site-page-save") return saveSitePage();
  if (action === "site-page-preview") {
    ui.modal = { type: "sitePreview", pageId: actionElement.dataset.pageId || ui.sitePageId };
    return renderModal();
  }
  if (action === "site-page-version") {
    ui.modal = { type: "sitePageVersions", pageId: actionElement.dataset.pageId || ui.sitePageId };
    return renderModal();
  }
  if (action === "site-page-restore-version") return restoreSitePageVersion(actionElement.dataset.pageId, actionElement.dataset.version);
  if (action === "site-new-page") {
    ui.modal = { type: "sitePageEditor" };
    return renderModal();
  }
  if (action === "site-submit-page") return submitSitePage(actionElement.dataset.pageId);
  if (action === "site-module-add") {
    ui.modal = { type: "siteModule", pageId: actionElement.dataset.pageId || ui.sitePageId };
    return renderModal();
  }
  if (action === "site-module-edit") {
    ui.modal = { type: "siteModule", pageId: actionElement.dataset.pageId || ui.sitePageId, moduleId: actionElement.dataset.moduleId };
    return renderModal();
  }
  if (action === "site-save-module") return saveSiteModule(actionElement.dataset.pageId, actionElement.dataset.moduleId);
  if (action === "site-delete-module") return deleteSiteModule(actionElement.dataset.pageId, actionElement.dataset.moduleId);
  if (action === "site-add-category") {
    ui.modal = { type: "siteCategory" };
    return renderModal();
  }
  if (action === "site-category-action") {
    ui.modal = actionElement.dataset.categoryId ? { type: "siteCategory", categoryId: actionElement.dataset.categoryId } : { type: "siteCategoryManager" };
    return renderModal();
  }
  if (action === "site-edit-category") {
    ui.modal = { type: "siteCategory", categoryId: actionElement.dataset.categoryId };
    return renderModal();
  }
  if (action === "site-save-category") return saveSiteCategory(actionElement.dataset.categoryId);
  if (action === "site-publish-article") {
    ui.modal = { type: "sitePublish", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "site-confirm-publish") return submitSitePublish();
  if (action === "site-article-preview") {
    ui.modal = { type: "siteArticlePreview", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "site-article-unpublish") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (article) {
      article.siteStatus = "draft";
      article.siteUnpublishedAt = new Date().toISOString();
      saveState();
    }
    showToast("官网文章已下线", "官网公开页面已移除，文章版本和发布记录仍会保留。", "success");
    return render();
  }
  if (action === "site-content-production") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    return navigate("content");
  }
  if (action === "site-nav-save") return saveSiteAppearance();
  if (action === "site-nav-add") {
    ui.modal = { type: "siteNav" };
    return renderModal();
  }
  if (action === "site-nav-edit") {
    ui.modal = { type: "siteNav", navId: actionElement.dataset.navId };
    return renderModal();
  }
  if (action === "site-save-nav") return saveSiteNav(actionElement.dataset.navId);
  if (action === "site-delete-nav") return deleteSiteNav(actionElement.dataset.navId);
  if (action === "site-lead-follow") {
    ui.modal = { type: "siteLeadFollow", leadId: actionElement.dataset.leadId };
    return renderModal();
  }
  if (action === "site-save-lead") return saveSiteLead(actionElement.dataset.leadId);
  if (action === "site-deployment") {
    ui.modal = { type: "siteDeployment" };
    return renderModal();
  }
  if (action === "site-save-deployment") return saveSiteDeployment();
  if (action === "site-test-deployment") return testSiteDeployment();
  if (action === "site-redirects") {
    ui.modal = { type: "siteRedirects" };
    return renderModal();
  }
  if (action === "site-add-redirect") return addSiteRedirect();
  if (action === "site-toggle-redirect") return toggleSiteRedirect(actionElement.dataset.redirectId);
  if (action === "site-delete-redirect") return deleteSiteRedirect(actionElement.dataset.redirectId);
  if (action === "run-diagnostic") return runDiagnostic(actionElement);
  if (action === "save-site") return saveSiteSettings();
  if (action === "export-leads") return exportSiteLeads();
  if (action === "knowledge-tab") {
    ui.knowledgeTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "knowledge-kind-filter") {
    ui.knowledgeKindFilter = actionElement.dataset.kind;
    return render();
  }
  if (action === "create-knowledge-base") {
    ui.modal = { type: "createKnowledgeBase" };
    return renderModal();
  }
  if (action === "submit-knowledge-base") return submitKnowledgeBase();
  if (action === "submit-knowledge-import") return submitKnowledgeImport().catch((error) => showToast("资料导入失败", error.message || "请检查文件后重试。", "error"));
  if (action === "open-knowledge-base") {
    ui.modal = { type: "knowledgeBaseDetail", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "add-knowledge-item") {
    ui.modal = { type: "knowledgeItem", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "open-knowledge-item") {
    ui.modal = { type: "knowledgeItem", itemId: actionElement.dataset.itemId };
    return renderModal();
  }
  if (action === "edit-knowledge-item") {
    const item = knowledgeItemById(actionElement.dataset.itemId);
    if (!item) return showToast("知识条目不存在", "请刷新后重试。", "error");
    ui.modal = { type: "knowledgeItem", itemId: item.id, baseId: item.knowledgeBaseId, edit: true };
    return renderModal();
  }
  if (action === "back-knowledge-base") {
    ui.modal = { type: "knowledgeBaseDetail", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "submit-knowledge-item") return submitKnowledgeItem(actionElement.dataset.baseId);
  if (action === "save-knowledge-item-edit") return updateKnowledgeItem(actionElement.dataset.itemId);
  if (action === "approve-knowledge-item") return approveKnowledgeItem(actionElement.dataset.itemId);
  if (action === "manage-knowledge-package") {
    ui.modal = { type: "knowledgePackage", lineId: actionElement.dataset.lineId || activeBusinessLine()?.id };
    return renderModal();
  }
  if (action === "save-knowledge-package") return saveKnowledgePackage(actionElement.dataset.lineId);
  if (action === "resolve-knowledge-gap") {
    const gap = state.knowledgeGaps.find((item) => item.id === actionElement.dataset.gapId);
    const base = (state.knowledgeBases || []).find((item) => item.kind === "document" && item.businessLineId === gap?.businessLineId) || (state.knowledgeBases || []).find((item) => item.kind === "document");
    if (!base) return showToast("请先新建文档库", "知识缺口需要先选择一个知识库承接。", "error");
    ui.modal = { type: "knowledgeItem", baseId: base.id, gapId: gap?.id || null };
    return renderModal();
  }
  if (action === "edit-knowledge") {
    if (actionElement.dataset.knowledge === "profile") {
      ui.onboardingStep = 1;
      ui.modal = { type: "onboarding" };
      return renderModal();
    }
    ui.modal = { type: "knowledge", knowledgeType: actionElement.dataset.knowledge };
    return renderModal();
  }
  if (action === "import-knowledge") {
    ui.modal = { type: "importKnowledge" };
    return renderModal();
  }
  if (action === "save-knowledge") {
    return saveLegacyKnowledge(actionElement.dataset.knowledge);
  }
  if (action === "open-risk") {
    ui.modal = { type: "risk", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "back-article") return openArticle(actionElement.dataset.articleId);
  if (action === "run-risk-scan") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (!article) return;
    const scan = applyArticleRiskScan(article);
    addOperationLog("内容风控", `检测文章《${article.title}》${article.version}：${scan.status}，命中 ${scan.hits.length} 条规则`);
    saveState();
    ui.modal = { type: "risk", articleId: article.id };
    render();
    renderModal();
    if (scan.status === "blocked") return showToast("风控检测已阻断", `命中 ${scan.hits.filter((hit) => hit.level === "blocked").length} 条禁用表述，修改后才能审核。`, "error");
    if (scan.status === "warning") return showToast("风控检测需人工复核", `命中 ${scan.hits.length} 条敏感或合规规则，请查看片段并修改。`, "warning");
    return showToast("风控检测通过", "当前文章版本未命中企业内容规则。", "success");
  }
  if (action === "edit-group") return showToast("请在本地助手中修改", "账号登录与分组只在客户电脑完成，然后同步状态到后台。");
  if (action === "pair-device") {
    ui.modal = { type: "pair" };
    renderModal();
    return issuePublisherPairing();
  }
  if (action === "refresh-publisher") {
    return refreshPublisherSnapshot({ renderAfter: true });
  }
  if (action === "settings-tab") {
    ui.settingsTab = actionElement.dataset.tab;
    render();
    if (ui.settingsTab === "models" && !aiProviderSnapshot.loaded) return refreshAiProviders({ renderAfter: true });
    return;
  }
  if (action === "refresh-ai-providers") return refreshAiProviders({ renderAfter: true });
  if (action === "add-ai-provider") {
    const returnToModelKind = ui.modal?.type === "modelEditor" ? ui.modal.modelKind : "";
    ui.modal = { type: "aiProvider", returnToModelKind };
    return renderModal();
  }
  if (action === "edit-ai-provider") {
    ui.modal = { type: "aiProvider", providerId: actionElement.dataset.providerId || "" };
    return renderModal();
  }
  if (action === "save-ai-provider") return saveAiProvider();
  if (action === "test-ai-provider-draft") return saveAiProvider({ testAfter: true });
  if (action === "test-ai-provider") return testAiProvider(actionElement.dataset.providerId || "");
  if (action === "delete-ai-provider") return deleteAiProvider(actionElement.dataset.providerId || "");
  if (action === "edit-model") {
    ui.modal = { type: "modelEditor", modelKind: actionElement.dataset.modelKind };
    return renderModal();
  }
  if (action === "save-model") return saveModel(actionElement.dataset.modelKind);
  if (action === "invite-member") {
    ui.modal = { type: "memberEditor" };
    return renderModal();
  }
  if (action === "manage-member") {
    ui.modal = { type: "memberEditor", memberId: actionElement.dataset.memberId };
    return renderModal();
  }
  if (action === "save-member") return saveMember(actionElement.dataset.memberId || null);
  if (action === "delete-member") return deleteMember(actionElement.dataset.memberId);
  if (action === "save-settings") {
    addOperationLog("系统设置", "保存当前客户空间的部署与工作流配置");
    saveState();
    return showToast("设置已保存", "当前客户空间配置已更新。");
  }
  if (action === "show-version") {
    ui.modal = { type: "version" };
    return renderModal();
  }
  if (action === "reset-demo") {
    ui.modal = { type: "reset" };
    return renderModal();
  }
  if (action === "confirm-reset") {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    state = migrateState(cloneDefaultState());
    ui.selectedPackId = state.keywordPacks[0].id;
    ui.selectedBusinessLineId = state.businessLines[0].id;
    ui.planningTab = "keywords";
    ui.planningArchiveKind = "questions";
    ui.businessKeywordInput = "";
    ui.questionInput = "";
    ui.articleTab = "all";
    ui.contentView = "articles";
    ui.articleTaskView = "plans";
    ui.articlePlanFilterId = "all";
    ui.articleSearch = "";
    ui.articleRiskFilter = "all";
    ui.articleKnowledgeFilter = "all";
    ui.articleFilterExpanded = false;
    ui.studioWorkspaceId = null;
    ui.studioArticleId = null;
    ui.studioPane = "editor";
    ui.studioComposerDraft = "";
    ui.studioTopicDraft = "";
    ui.studioPicker = null;
    ui.publishTab = "all";
    ui.publishView = "tasks";
    ui.publishBatchSelection = null;
    ui.publishBatchCategory = "self_media";
    ui.publishBatchSearch = "";
    ui.publishBatchArticleSearch = "";
    ui.assetTab = "all";
    ui.assetExpandedId = null;
    ui.assetSearch = "";
    closeModal();
    render();
    return showToast("演示数据已重置", "已恢复到首次打开时的示例状态。");
  }
  if (action === "export-logs") return exportOperationLogs();
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-publish-batch-article-search]")) {
    ui.publishBatchArticleSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".publish-article-row").forEach((row) => {
      row.hidden = Boolean(query && !row.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-publish-batch-platform-search]")) {
    ui.publishBatchSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".publish-platform-card").forEach((card) => {
      card.hidden = Boolean(query && !card.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-asset-search]")) {
    ui.assetSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".asset-card").forEach((card) => {
      card.hidden = Boolean(query && !card.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-content-article-search]")) {
    ui.articleSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".content-article-table tbody tr:not(.article-task-uncreated)").forEach((row) => {
      row.hidden = Boolean(query && !row.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.id === "studio-topic-input") {
    ui.studioTopicDraft = event.target.value;
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    if (workspace) {
      workspace.topic = { ...(workspace.topic || {}), source: "custom", title: event.target.value, prompt: event.target.value };
      workspace.updatedAt = Date.now();
      saveState();
    }
  }
  if (event.target.id === "studio-composer-input") {
    ui.studioComposerDraft = event.target.value;
    const sendButton = document.querySelector('[data-action="send-studio-chat"]');
    if (sendButton) sendButton.disabled = !event.target.value.trim();
  }
  if (event.target.id === "studio-title-editor" || event.target.id === "studio-content-editor") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const article = workspace && studioArticleForWorkspace(workspace);
    if (article) {
      syncStudioArticleEditor({ silent: true });
    } else if (workspace) {
      if (event.target.id === "studio-title-editor") {
        workspace.draftTitle = event.target.value;
        ui.studioTopicDraft = event.target.value;
        workspace.topic = { ...(workspace.topic || {}), source: "custom", title: event.target.value, prompt: event.target.value };
      } else {
        workspace.draftContent = event.target.innerText || "";
        workspace.draftContentHtml = sanitizeStudioHtml(event.target.innerHTML || "");
      }
      workspace.updatedAt = Date.now();
      saveState();
    }
    document.querySelector(".studio-save-state")?.classList.remove("unsaved");
    if (document.querySelector(".studio-save-state")) document.querySelector(".studio-save-state").textContent = "已自动保存";
  }
  if (event.target.id === "business-keyword-input") {
    ui.businessKeywordInput = event.target.value;
    if (ui.businessKeywordError) {
      ui.businessKeywordError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "question-input") {
    ui.questionInput = event.target.value;
    if (ui.questionError) {
      ui.questionError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "seed-input") {
    ui.seedInput = event.target.value;
    if (ui.seedError) {
      ui.seedError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "command-input") {
    ui.commandQuery = event.target.value;
    updateCommandResults();
  }
});

document.addEventListener("change", (event) => {
  if (["site-page-schema", "site-page-sitemap", "site-setting-ai-crawl"].includes(event.target.id)) {
    event.target.closest(".toggle")?.classList.toggle("on", event.target.checked);
    return;
  }
  if (event.target.id === "tracked-work-article") {
    const article = state.articles.find((item) => item.id === event.target.value);
    if (!article) return;
    const record = articleAssetRecords().find((item) => item.article.id === article.id);
    const titleInput = document.getElementById("tracked-work-title");
    const siteInput = document.getElementById("tracked-work-site");
    const domainInput = document.getElementById("tracked-work-domain");
    const urlInput = document.getElementById("tracked-work-url");
    const questionInput = document.getElementById("tracked-work-questions");
    if (titleInput && !titleInput.value.trim()) titleInput.value = article.title;
    if (siteInput && !siteInput.value.trim()) siteInput.value = record?.sourceUrl ? state.site.domain : "待发布内容资产";
    if (domainInput && !domainInput.value.trim()) domainInput.value = domainFromUrl(record?.sourceUrl || article.siteUrl || "");
    if (urlInput && !urlInput.value.trim()) urlInput.value = record?.sourceUrl || article.siteUrl || "";
    if (questionInput && !Number(questionInput.value)) questionInput.value = String(monitoringBindingsForArticle(article.id)?.questionIds?.length || 0);
    return;
  }
  if (event.target.id === "model-provider") {
    const provider = (aiProviderSnapshot.providers || []).find((item) => item.id === event.target.value);
    const modelInput = document.getElementById("model-custom-name");
    if (provider?.model && modelInput && (!modelInput.value.trim() || /DeepSeek\s*V\d|演示|默认模型/i.test(modelInput.value.trim()))) {
      modelInput.value = provider.model;
    }
    return;
  }
  if (event.target.matches("[data-assistant-catalog-group]")) {
    ui.assistantCatalogGroupId = event.target.value || null;
    return render();
  }
  if (event.target.matches("[data-publish-batch-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group || !ui.publishBatchSelection) return;
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.groupId = group.id;
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (event.target.matches("[data-publish-batch-article]")) {
    if (!ui.publishBatchSelection) return;
    const selected = new Set(ui.publishBatchSelection.articleIds || []);
    event.target.checked ? selected.add(event.target.dataset.publishBatchArticle) : selected.delete(event.target.dataset.publishBatchArticle);
    ui.publishBatchSelection.articleIds = [...selected];
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = new Set(PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id));
    const order = (ui.publishBatchSelection.platformOrder || []).filter((platform) => available.has(platform));
    ui.publishBatchSelection.platforms = order;
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (event.target.matches("[data-publish-batch-platform]")) {
    if (!ui.publishBatchSelection) return;
    const platform = event.target.dataset.publishBatchPlatform;
    const platforms = new Set(ui.publishBatchSelection.platforms || []);
    const order = [...(ui.publishBatchSelection.platformOrder || [])];
    if (event.target.checked) {
      platforms.add(platform);
      if (!order.includes(platform)) order.push(platform);
    } else {
      platforms.delete(platform);
      const index = order.indexOf(platform);
      if (index >= 0) order.splice(index, 1);
    }
    ui.publishBatchSelection.platforms = [...platforms];
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (event.target.matches("[data-publish-batch-mode]")) {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.mode = event.target.value === "schedule" ? "schedule" : "immediate";
    return render();
  }
  if (event.target.matches("[data-publish-batch-interval]")) {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.intervalMinutes = Math.max(5, Number(event.target.value) || 60);
    return render();
  }
  if (event.target.matches("[data-schedule-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group || !ui.scheduleSelection) return;
    const available = ["web", ...Object.keys(group.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform))];
    ui.scheduleSelection.groupId = group.id;
    ui.scheduleSelection.platforms = available;
    ui.scheduleSelection.platformOrder = [...available];
    return renderModal();
  }
  if (event.target.matches("[data-schedule-platform]")) {
    if (!ui.scheduleSelection) return;
    const platform = event.target.dataset.schedulePlatform;
    const platforms = new Set(ui.scheduleSelection.platforms || []);
    const order = [...(ui.scheduleSelection.platformOrder || [])];
    if (event.target.checked) {
      platforms.add(platform);
      if (!order.includes(platform)) order.push(platform);
    } else {
      platforms.delete(platform);
      const index = order.indexOf(platform);
      if (index >= 0) order.splice(index, 1);
    }
    ui.scheduleSelection.platforms = [...platforms];
    ui.scheduleSelection.platformOrder = order;
    return renderModal();
  }
  if (event.target.matches("[data-schedule-quota-mode]")) {
    if (!ui.scheduleSelection) return;
    ui.scheduleSelection.quotaMode = event.target.value === "finishDays" ? "finishDays" : "dailyCount";
    return renderModal();
  }
  if (ui.scheduleSelection && ["schedule-start-date", "schedule-daily-start", "schedule-daily-end", "schedule-interval", "schedule-daily-count", "schedule-finish-days"].includes(event.target.id)) {
    const fieldMap = {
      "schedule-start-date": "startDate",
      "schedule-daily-start": "dailyStart",
      "schedule-daily-end": "dailyEnd",
      "schedule-interval": "intervalMinutes",
      "schedule-daily-count": "dailyCount",
      "schedule-finish-days": "finishDays"
    };
    const numeric = ["schedule-interval", "schedule-daily-count", "schedule-finish-days"].includes(event.target.id);
    ui.scheduleSelection[fieldMap[event.target.id]] = numeric ? Math.max(1, Number(event.target.value) || 1) : event.target.value;
    return renderModal();
  }
  if (event.target.matches("[data-article-select]")) {
    const selected = new Set(selectedArticleIdsForCurrentView());
    const articleId = event.target.dataset.articleSelect;
    if (event.target.checked) selected.add(articleId);
    else selected.delete(articleId);
    ui.articleSelection = [...selected];
    return render();
  }
  if (event.target.matches("[data-select-all]")) {
    const scope = event.target.dataset.selectAll;
    if (scope === "content-articles") {
      const ids = [...document.querySelectorAll("[data-article-select]:not(:disabled)")].map((input) => input.dataset.articleSelect).filter(Boolean);
      ui.articleSelection = event.target.checked ? ids : [];
      return render();
    }
    if (scope === "keyword-questions") {
      const line = activeBusinessLine();
      const packId = event.target.dataset.selectPackId;
      const dimension = event.target.dataset.selectDimension || "all";
      state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "candidate" && question.packId === packId && (dimension === "all" || question.dimension === dimension)).forEach((question) => { question.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "question-library") {
      const line = activeBusinessLine();
      state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "active").forEach((question) => { question.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "topic-library") {
      const line = activeBusinessLine();
      state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "active").forEach((topic) => { topic.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "publish-platforms") {
      const group = state.accountGroups.find((item) => item.id === ui.publishSelection?.groupId) || state.accountGroups[0];
      const article = state.articles.find((item) => item.id === ui.publishSelection?.articleId);
      const existing = articleExistingPublishPlatforms(article);
      const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled && (entry.category === "self_media" || entry.id === "web"))
        .map((entry) => entry.id)
        .filter((platform) => (platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform))) && !existing.has(platform));
      if (ui.publishSelection) ui.publishSelection.platforms = event.target.checked ? available : [];
      return renderModal();
    }
    if (scope === "monitor-platforms") {
      const boxes = document.querySelectorAll("[data-monitor-task-platform]");
      boxes.forEach((checkbox) => {
        checkbox.checked = event.target.checked;
        checkbox.closest(".platform-choice")?.classList.toggle("selected", event.target.checked);
      });
      ui.monitorPlatformSelection = Array.from(boxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
      syncBulkSelectControl(event.target, boxes.length, event.target.checked ? boxes.length : 0);
      return;
    }
  }
  if (event.target.id === "content-plan-filter") {
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = event.target.value || "all";
    ui.articleTab = "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.matches("[data-content-risk-filter]")) {
    ui.articleRiskFilter = event.target.value || "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.matches("[data-content-knowledge-filter]")) {
    ui.articleKnowledgeFilter = event.target.value || "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.id === "studio-business-line") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const line = state.businessLines.find((item) => item.id === event.target.value && item.status === "active");
    if (!workspace || !conversation || !line || workspace.articleId) return;
    const inherited = inheritedKnowledgeBaseIds(line);
    const agent = defaultAgentForLine(line, workspace.contentType);
    workspace.businessLineId = line.id;
    workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
    workspace.knowledgeScope = { inheritedBaseIds: cloneData(inherited), addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: cloneData(inherited), snapshottedAt: new Date().toISOString(), lockedVersionIds: [] };
    workspace.selectedKnowledgeBaseIds = cloneData(inherited);
    workspace.selectedKnowledgeItemIds = [];
    workspace.writingAgentId = agent?.id || null;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    conversation.selectedAgentId = agent?.id || null;
    conversation.selectedKnowledgeBaseIds = cloneData(inherited);
    conversation.selectedKnowledgeItemIds = [];
    conversation.updatedAt = workspace.updatedAt;
    ui.selectedBusinessLineId = line.id;
    ui.studioAgentId = agent?.id || null;
    saveState();
    return render();
  }
  if (event.target.id === "studio-content-type") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!workspace || workspace.articleId) return;
    workspace.contentType = event.target.value;
    const current = writingAgentById(workspace.writingAgentId);
    const agent = writingAgentSupports(current, workspace.businessLineId, workspace.contentType) ? current : defaultAgentForLine(state.businessLines.find((line) => line.id === workspace.businessLineId), workspace.contentType);
    workspace.writingAgentId = agent?.id || null;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    if (conversation) {
      conversation.selectedAgentId = agent?.id || null;
      conversation.updatedAt = workspace.updatedAt;
    }
    ui.studioContentType = workspace.contentType;
    ui.studioAgentId = agent?.id || null;
    saveState();
    return render();
  }
  if (event.target.id === "studio-direct-agent") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const agent = writingAgentById(event.target.value);
    if (!workspace || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return;
    workspace.writingAgentId = agent.id;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    if (conversation) {
      conversation.selectedAgentId = agent.id;
      conversation.updatedAt = workspace.updatedAt;
    }
    ui.studioAgentId = agent.id;
    saveState();
    return render();
  }
  if (event.target.id === "studio-chat-agent") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const agent = writingAgentById(event.target.value);
    if (!workspace || !conversation || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return showToast("智能体不可用", "请选择适用于当前文章的智能体。", "error");
    conversation.selectedAgentId = agent.id;
    conversation.updatedAt = Date.now();
    ui.studioAgentId = agent.id;
    saveState();
    return render();
  }
  if (event.target.id === "studio-attachment-input") {
    addStudioFiles(event.target.files, "attachment");
    event.target.value = "";
    return;
  }
  if (event.target.id === "studio-image-input") {
    addStudioFiles(event.target.files, "image");
    event.target.value = "";
    return;
  }
  if (event.target.id === "content-plan-agent" || event.target.id === "content-plan-type") {
    const agentSelect = document.getElementById("content-plan-agent");
    const type = document.getElementById("content-plan-type")?.value || "深度文章";
    let agent = writingAgentById(agentSelect?.value);
    if (event.target.id === "content-plan-type" && !writingAgentSupports(agent, activeBusinessLine()?.id, type)) {
      const compatible = activeWritingAgents(activeBusinessLine()?.id, type);
      if (compatible[0] && agentSelect) {
        agentSelect.value = compatible[0].id;
        agent = compatible[0];
      }
    }
    const summary = document.getElementById("plan-agent-summary");
    if (agent && summary) {
      const compatible = writingAgentSupports(agent, activeBusinessLine()?.id, type);
      summary.classList.toggle("invalid", !compatible);
      summary.innerHTML = `<span class="writing-agent-avatar ${escapeHtml(agent.color || "blue")}">${escapeHtml(agent.avatar || agent.name.slice(0, 1))}</span><span><b>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</b><small>${escapeHtml(agent.style)} · ${agent.strictKnowledge ? "严格知识模式" : "普通知识模式"}${compatible ? "" : " · 不适用于当前内容形式"}</small></span>`;
    }
    return;
  }
  if (event.target.matches("[data-planning-business]")) {
    ui.selectedBusinessLineId = event.target.value;
    ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === ui.selectedBusinessLineId)?.id || null;
    ui.selectedCoreKeywordIds = [];
    ui.seedInput = "";
    ui.planningCategory = "all";
    ui.articleTaskView = "plans";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "all";
    clearArticleSelection();
    state.questionLibrary.forEach((question) => { question.selected = false; });
    state.topics.forEach((topic) => { topic.selected = false; });
    saveState();
    return render();
  }
  if (event.target.matches("[data-core-select]")) {
    const keywordId = event.target.dataset.coreSelect;
    const keyword = state.keywords.find((item) => item.id === keywordId && item.status === "active" && !isSeedKeyword(item));
    if (!keyword || keyword.businessLineId !== activeBusinessLine()?.id) return render();
    const selected = new Set(ui.selectedCoreKeywordIds || []);
    event.target.checked ? selected.add(keywordId) : selected.delete(keywordId);
    ui.selectedCoreKeywordIds = [...selected];
    return render();
  }
  if (event.target.matches("[data-seed-select]")) {
    const keyword = state.keywords.find((item) => item.id === event.target.dataset.seedSelect && item.status === "active" && isSeedKeyword(item));
    if (!keyword || keyword.businessLineId !== activeBusinessLine()?.id) return render();
    const terms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean);
    const matchIndex = terms.findIndex((term) => term.toLowerCase() === keyword.term.toLowerCase());
    if (event.target.checked && matchIndex < 0) {
      if (terms.length >= 8) {
        event.target.checked = false;
        return showToast("最多选择 8 个种子词", "请先取消一个已选种子词，再选择新的候选。", "error");
      }
      terms.push(keyword.term);
    } else if (!event.target.checked && matchIndex >= 0) {
      terms.splice(matchIndex, 1);
    }
    ui.seedInput = terms.join("，");
    ui.seedError = "";
    return render();
  }
  if (event.target.matches('[data-monitor-filter="platform"]')) {
    ui.monitoringPlatform = event.target.value;
    return render();
  }
  if (event.target.matches('[data-monitor-filter="range"]')) {
    ui.monitoringRange = event.target.value;
    return render();
  }
  if (event.target.matches("[data-monitor-task-platform]")) {
    const boxes = document.querySelectorAll("[data-monitor-task-platform]");
    const selectedCount = Array.from(boxes).filter((checkbox) => checkbox.checked).length;
    boxes.forEach((checkbox) => checkbox.closest(".platform-choice")?.classList.toggle("selected", checkbox.checked));
    ui.monitorPlatformSelection = Array.from(boxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    syncBulkSelectControl(document.querySelector('[data-select-all="monitor-platforms"]'), boxes.length, selectedCount);
    return;
  }
  if (event.target.matches("[data-topic-select]")) {
    const topic = state.topics.find((item) => item.id === event.target.dataset.topicSelect);
    if (topic && topic.status === "active" && !planningTopicPlans(topic).length) topic.selected = event.target.checked;
    saveState();
    return render();
  }
  if (event.target.matches("[data-question-select]")) {
    const question = state.questionLibrary.find((item) => item.id === event.target.dataset.questionSelect);
    if (question && question.status !== "archived") question.selected = event.target.checked;
    saveState();
    return render();
  }
  if (event.target.matches("[data-publish-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group) return;
    const article = state.articles.find((item) => item.id === ui.publishSelection?.articleId);
    const existing = articleExistingPublishPlatforms(article);
    ui.publishSelection.groupId = group.id;
    ui.publishSelection.platforms = ["web", ...Object.keys(group.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform)).map(canonicalPublishPlatformId)].filter((platform) => !existing.has(platform));
    return renderModal();
  }
  if (event.target.matches("[data-publish-platform]")) {
    const platform = event.target.dataset.publishPlatform;
    const platforms = new Set(ui.publishSelection.platforms);
    event.target.checked ? platforms.add(platform) : platforms.delete(platform);
    ui.publishSelection.platforms = [...platforms];
    return renderModal();
  }
});

window.addEventListener("hashchange", render);
window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.id === "studio-composer-input" && !event.shiftKey) {
    event.preventDefault();
    return sendStudioChat();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && ui.contentView === "studio") {
    event.preventDefault();
    return syncStudioArticleEditor();
  }
  if (event.key === "Enter" && event.target.id === "business-keyword-input") {
    event.preventDefault();
    return expandSeedKeywords();
  }
  if (event.key === "Enter" && event.target.id === "question-input") {
    event.preventDefault();
    return addQuestionToLibrary();
  }
  if (event.key === "Enter" && event.target.id === "seed-input") {
    event.preventDefault();
    return generateQuestionPack();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.commandQuery = "";
    ui.modal = { type: "search" };
    renderModal();
    return window.setTimeout(() => document.getElementById("command-input")?.focus(), 30);
  }
  if (event.key === "Escape") {
    if (ui.modal) closeModal();
    document.body.classList.remove("sidebar-open");
  }
});

hydrateIcons(document);
if (!location.hash || !PAGE_META[currentRoute()]) history.replaceState(null, "", "#dashboard");
render();
refreshPublisherSnapshot({ renderAfter: true }).catch(() => {});
window.setInterval(() => refreshPublisherSnapshot({ renderAfter: ["publish", "assistant"].includes(currentRoute()) }), 15000);
