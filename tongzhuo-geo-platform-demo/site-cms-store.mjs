import { createHash, randomUUID } from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";

const CORE_PAGE_IDS = new Set(["home", "services", "about", "contact", "insights", "cases", "problem-map"]);
const OPTIONAL_PATHS = new Set(["/cases/", "/faq/", "/team/", "/honors/", "/jobs/"]);
const MAX_SNAPSHOT_BYTES = 2_000_000;

export class SiteCmsError extends Error {
  constructor(message, status = 422, code = "SITE_CMS_ERROR", details = undefined) {
    super(message);
    this.name = "SiteCmsError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function cleanText(value, fallback = "", maximum = 2_000) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  return (result || fallback).slice(0, maximum);
}

function cleanList(value, maximum = 20) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，、;；|]/) : [];
  return [...new Set(source.map((item) => cleanText(item, "", 120)).filter(Boolean))].slice(0, maximum);
}

function cleanPublicUrl(value, { allowRelative = false } = {}) {
  const candidate = cleanText(value, "", 1_000);
  if (!candidate || /[\r\n]/.test(candidate)) return "";
  if (allowRelative && candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function cleanPublicUrlList(value, maximum = 12) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\r\n,，;；|]+/) : [];
  return [...new Set(source.map((item) => cleanPublicUrl(item)).filter(Boolean))].slice(0, maximum);
}

function cleanId(value, fallback) {
  const id = cleanText(value, fallback, 160).replace(/[^A-Za-z0-9._:-]/g, "-");
  return id || fallback;
}

export function normalizeCmsPath(value, fallback = "/") {
  let pathname = cleanText(value, fallback, 500);
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\r\n?#]/.test(pathname)) pathname = fallback;
  const aliases = {
    "/index.html": "/", "/products.html": "/services/", "/products/": "/services/",
    "/about.html": "/about/", "/contact.html": "/contact/", "/insights.html": "/insights/"
  };
  pathname = aliases[pathname] || pathname;
  if (pathname !== "/" && !pathname.endsWith("/") && !/\.[A-Za-z0-9]{1,8}$/.test(pathname)) pathname += "/";
  return pathname.replace(/\/{2,}/g, "/");
}

function normalizeCmsHref(value, fallback = "/contact/") {
  const candidate = cleanText(value, fallback, 500);
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\r\n]/.test(candidate)) return fallback;
  return candidate;
}

function slugify(value, fallback = "page") {
  const slug = String(value || "").normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return slug || fallback;
}

function defaultPages() {
  return [
    { id: "home", type: "首页", title: "首页", path: "/", status: "published", description: "企业定位、核心服务、可信证据与咨询入口", seoDescription: "了解企业提供的核心服务、适用对象与交付方式。" },
    { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", description: "服务能力、适用对象、交付流程与边界", seoDescription: "查看企业的产品、服务能力、适用对象与交付流程。" },
    { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", description: "经过审核、允许公开的服务案例与实施方法", seoDescription: "查看企业服务案例、实施方法与可核验结果。" },
    { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", description: "经过审核发布的企业公开内容", seoDescription: "阅读企业发布的行业资讯、方法与实践内容。" },
    { id: "problem-map", type: "问题地图", title: "问题地图", path: "/problem-map/", status: "published", description: "按服务方向和行业整理客户真实问题", seoDescription: "按服务方向与行业查看企业客户常见问题及直接回答。" },
    { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", description: "企业主体、定位、服务区域与可信信息", seoDescription: "了解企业主体、服务定位与公开信息。" },
    { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", description: "联系方式、服务区域与咨询表单", seoDescription: "联系企业并提交业务咨询。" }
  ];
}

function defaultServices() {
  return [
    { id: "geo", title: "GEO 服务", eyebrow: "AI SEARCH VISIBILITY", description: "围绕企业知识、官网信源、客户问题和持续内容运营，让企业信息更容易被客户与 AI 正确理解。", audience: "工业品、制造业及需要建设公开信源的中小企业", focus: "企业实体、官网页面、客户问题和公开内容结构", href: "/contact/", status: "published", order: 1 },
    { id: "enterprise-ai", title: "企业 AI 落地", eyebrow: "ENTERPRISE AI", description: "把企业资料、业务规则和工作流程整理为可调用的知识与智能应用，帮助团队真正使用 AI。", audience: "希望建设知识库、智能体和业务工作流的企业", focus: "知识库、检索增强、智能体和业务流程协同", href: "/contact/", status: "published", order: 2 },
    { id: "short-video", title: "短视频运营", eyebrow: "CONTENT GROWTH", description: "围绕真实业务场景建立选题、脚本、账号和发布节奏，持续沉淀可复用的内容资产。", audience: "需要长期获客和内容运营能力的企业", focus: "选题、脚本、账号内容与持续发布节奏", href: "/contact/", status: "published", order: 3 }
  ];
}

function defaultCases() {
  return [
    { id: "case-industry-source", title: "工业设备企业公开信源建设", service: "GEO 服务", industry: "工业品", summary: "统一产品参数、应用场景和售后问答，让官网与公开内容使用同一套企业事实。", result: "企业知识、官网页面与内容生产形成统一来源", status: "published", order: 1 },
    { id: "case-manufacturing-questions", title: "制造业客户问题体系梳理", service: "企业 AI 落地", industry: "制造业", summary: "按照采购、技术和使用人员的决策阶段拆分问题，形成知识库、问题地图和内容计划。", result: "客户问题能够被持续管理、回答和复用", status: "published", order: 2 },
    { id: "case-content-operations", title: "中小企业内容运营流程建设", service: "短视频运营", industry: "中小企业", summary: "统一内容方向、审核标准和发布节奏，让短视频与图文内容不再依赖临时发挥。", result: "形成可执行、可复盘的长期内容机制", status: "published", order: 3 }
  ];
}

function defaultProblemGroups() {
  return [
    { id: "geo", title: "GEO 服务问题", service: "GEO 服务", description: "从 AI 搜索认知、信源建设到效果判断。", status: "published", order: 1, questions: [
      { id: "question-industrial-geo-start", slug: "industrial-geo-start", title: "工业品企业做 GEO 应该从哪里开始？", answer: "先统一企业主体、产品服务、应用场景、案例和常见问答，再围绕采购与技术人员真实会问的问题建设公开内容。", industries: ["工业品", "制造业"], status: "published", order: 1 },
      { id: "question-geo-vs-seo", slug: "geo-vs-seo", title: "GEO 与传统 SEO 的目标和做法有什么不同？", answer: "SEO 更关注搜索结果中的网页可见性，GEO 更关注企业事实能否被 AI 理解、选择并组织进回答。两者可以协同，但内容结构和衡量方式不同。", industries: ["工业品", "制造业", "中小企业"], status: "published", order: 2 }
    ] },
    { id: "enterprise-ai", title: "企业 AI 落地问题", service: "企业 AI 落地", description: "从资料治理、知识库到业务智能体。", status: "published", order: 2, questions: [
      { id: "question-ai-knowledge-base", slug: "ai-knowledge-base", title: "企业做 AI 应用前为什么要先建立知识库？", answer: "企业知识库为 AI 提供统一、经过审核且可追溯的事实来源，避免不同员工、文档和模型给出互相冲突的答案。", industries: ["工业品", "制造业", "中小企业"], status: "published", order: 1 },
      { id: "question-ai-first-scenario", slug: "ai-first-scenario", title: "没有 AI 基础的企业应该先落地哪个场景？", answer: "优先选择资料相对完整、结果容易人工核对、能够节省重复劳动的场景，例如企业问答、内容辅助或内部资料检索。", industries: ["制造业", "中小企业"], status: "published", order: 2 }
    ] },
    { id: "short-video", title: "短视频运营问题", service: "短视频运营", description: "从选题、内容生产到账号持续运营。", status: "published", order: 3, questions: [
      { id: "question-video-b2b-content", slug: "video-b2b-content", title: "工业品和制造业短视频应该拍什么内容？", answer: "优先展示客户真实关心的选型问题、使用场景、技术边界、实施流程和售后问题，而不是只做企业宣传片。", industries: ["工业品", "制造业"], status: "published", order: 1 },
      { id: "question-video-sustainable", slug: "video-sustainable", title: "企业怎样建立可持续的短视频选题机制？", answer: "把销售、客服、技术和采购沟通中反复出现的问题沉淀为问题库，再按业务阶段持续转化为脚本和内容计划。", industries: ["工业品", "制造业", "中小企业"], status: "published", order: 2 }
    ] }
  ];
}

function normalizePublishedStatus(value, fallback = "draft") {
  return ["published", "draft", "archived"].includes(value) ? value : fallback;
}

function normalizeServices(value) {
  // A missing collection belongs to an older snapshot and receives migration
  // defaults. An explicit empty array is meaningful: the operator chose not
  // to publish that collection yet.
  const source = Array.isArray(value) ? value : defaultServices();
  return source.filter((item) => item && typeof item === "object").slice(0, 30).map((item, index) => ({
    id: cleanId(item.id, `service-${index + 1}`), title: cleanText(item.title, `服务 ${index + 1}`, 160),
    eyebrow: cleanText(item.eyebrow, "SERVICE", 80), description: cleanText(item.description, "", 1_500),
    audience: cleanText(item.audience, "", 800), focus: cleanText(item.focus, "", 800),
    href: normalizeCmsHref(item.href, "/contact/"), status: normalizePublishedStatus(item.status, "draft"),
    order: Math.max(1, Number.parseInt(item.order, 10) || index + 1), updatedAt: item.updatedAt || null
  })).sort((a, b) => a.order - b.order);
}

function normalizeCases(value) {
  const source = Array.isArray(value) ? value : defaultCases();
  return source.filter((item) => item && typeof item === "object").slice(0, 100).map((item, index) => ({
    id: cleanId(item.id, `case-${index + 1}`), title: cleanText(item.title, `案例 ${index + 1}`, 200),
    serviceId: cleanId(item.serviceId, ""), service: cleanText(item.service, "企业服务", 120), industry: cleanText(item.industry, "中小企业", 120),
    summary: cleanText(item.summary, "", 1_500), result: cleanText(item.result, "", 1_500),
    href: normalizeCmsHref(item.href, "/contact/"),
    status: normalizePublishedStatus(item.status, "draft"), order: Math.max(1, Number.parseInt(item.order, 10) || index + 1),
    updatedAt: item.updatedAt || null
  })).sort((a, b) => a.order - b.order);
}

function normalizeProblemGroups(value) {
  const source = Array.isArray(value) ? value : defaultProblemGroups();
  const usedSlugs = new Set();
  return source.filter((item) => item && typeof item === "object").slice(0, 30).map((item, index) => {
    const id = cleanId(item.id, `problem-group-${index + 1}`);
    const questions = (Array.isArray(item.questions) ? item.questions : []).filter((question) => question && typeof question === "object").slice(0, 200).map((question, questionIndex) => {
      const base = slugify(question.slug || question.title, `question-${questionIndex + 1}`);
      let slug = base;
      let suffix = 2;
      while (usedSlugs.has(slug)) { slug = `${base}-${suffix}`; suffix += 1; }
      usedSlugs.add(slug);
      const title = cleanText(question.title || question.question, `客户问题 ${questionIndex + 1}`, 300);
      const answer = cleanText(question.answer || question.coreAnswer, "", 4_000);
      return {
        id: cleanId(question.id, `${id}-question-${questionIndex + 1}`), slug,
        title, answer,
        industries: cleanList(question.industries, 12), intent: cleanText(question.intent, "", 120), stage: cleanText(question.stage, "", 120),
        relatedArticleIds: cleanList(question.relatedArticleIds, 20), relatedServiceId: cleanId(question.relatedServiceId, ""),
        // A public question without a direct answer is an empty SEO/AI page;
        // keep it in the editor but never migrate it as published.
        status: answer ? normalizePublishedStatus(question.status, "draft") : "draft", order: Math.max(1, Number.parseInt(question.order, 10) || questionIndex + 1),
        updatedAt: question.updatedAt || null
      };
    }).sort((a, b) => a.order - b.order);
    return {
      id, serviceId: cleanId(item.serviceId, ""), title: cleanText(item.title, `问题分组 ${index + 1}`, 200), service: cleanText(item.service, "企业服务", 120),
      description: cleanText(item.description, "", 1_000), status: normalizePublishedStatus(item.status, "draft"),
      order: Math.max(1, Number.parseInt(item.order, 10) || index + 1), questions, updatedAt: item.updatedAt || null
    };
  }).sort((a, b) => a.order - b.order);
}

function defaultModules(pageId, context = {}) {
  const company = context.settings?.companyName || context.settings?.siteName || "企业";
  const description = context.settings?.description || "持续建设清晰、可信并可验证的企业公开信息。";
  const rows = {
    home: [
      ["hero", "首屏", "让客户和 AI 快速理解企业是谁、提供什么服务以及下一步如何联系。", description],
      ["answer", "我们解决什么问题", "用直接答案说明企业价值和服务边界。", description],
      ["services", "核心产品与服务", "从产品 / 业务线读取公开服务信息。", "展示适用对象、核心能力与交付方式。"],
      ["proof", "可信依据", "展示企业主体、审核机制与可核验信息。", `${company} 对外内容经过企业知识与人工审核后发布。`],
      ["insights", "最新行业资讯", "自动读取已审核并发布的官网文章。", "持续发布面向真实客户问题的行业内容。"],
      ["cta", "开始沟通", "引导访问者提交业务问题。", "描述您的业务、目标和当前困难，我们会据此安排沟通。"]
    ],
    services: [
      ["hero", "产品与服务", "说明适用对象、解决的问题和交付边界。", description],
      ["services", "服务能力", "从产品 / 业务线读取公开服务信息。", "每项服务都说明适用对象、工作内容和交付结果。"],
      ["process", "合作流程", "用稳定流程帮助客户了解项目如何推进。", "需求梳理、资料建设、内容生产、发布运营、效果复盘。"],
      ["boundary", "交付原则", "明确依赖条件与结果边界。", "以真实企业知识和可核验资料为基础，不使用无法验证的承诺。"],
      ["cta", "获取适合企业现状的方案", "进入咨询表单。", "提交企业现状与目标，获取下一步建议。"]
    ],
    about: [
      ["hero", "关于我们", "介绍企业主体、定位与服务对象。", description],
      ["entity", "企业信息", "输出清晰一致的企业实体信息。", `${company} 持续维护企业身份、服务范围与公开表述的一致性。`],
      ["principles", "我们的工作原则", "真实、可核验、可持续。", "以企业事实为依据，以客户问题为内容起点，以人工审核作为发布门槛。"],
      ["cta", "了解合作方式", "进入联系页面。", "欢迎提交您的业务背景和目标。"]
    ],
    contact: [
      ["hero", "联系我们", "让咨询入口清晰直接。", "请留下有效联系方式与业务问题，我们会根据具体情况安排沟通。"],
      ["contact", "联系方式", "展示公开联系方式和服务区域。", "工作日内处理企业业务咨询。"],
      ["form", "提交业务咨询", "官网线索表单。", "请描述企业、需求与希望解决的问题。"]
    ],
    insights: [
      ["hero", "行业资讯", "说明内容范围和发布标准。", "只展示经过人工审核并正式发布的企业内容。"],
      ["articles", "文章列表", "按栏目展示正式文章。", "标题、摘要、作者、日期和正文结构均由正式内容版本生成。"]
    ],
    cases: [["hero", "服务案例", "展示允许公开的案例与实施方法。", "案例内容需经过脱敏和人工审核。"], ["proof", "案例与证据", "展示可核验结果。", "暂未发布公开案例。"], ["cta", "了解实施方式", "进入联系页面。", "提交您的业务场景。"]],
    "problem-map": [["hero", "问题地图", "按服务方向和行业整理客户真实问题。", "从真实客户提问出发，连接直接回答、行业文章、服务案例和对应服务。"], ["problem-map", "客户正在问什么", "只展示已公开问题或已发布文章关联的问题。", "按 GEO 服务、企业 AI 落地和短视频运营组织问题。"], ["cta", "没有找到您的问题？", "提交企业现状和具体问题。", "我们会根据企业资料和业务目标给出下一步建议。"]],
    faq: [["hero", "常见问题", "直接回答客户高频问题。", "答案来自已审核企业知识。"], ["faq", "问题与答案", "结构化 FAQ。", "暂未发布公开问答。"]]
  };
  return (rows[pageId] || [["hero", context.pageTitle || "页面", "页面核心说明。", description], ["content", "主要内容", "结构化页面内容。", description], ["cta", "联系我们", "进入联系页面。", "提交您的业务问题。"]]).map(([type, title, moduleDescription, content], index) => ({
    id: `${pageId}-${type}-${index + 1}`, type, title, description: moduleDescription, content, source: "CMS 页面内容", status: "published", items: []
  }));
}

function normalizePage(item, index) {
  const defaults = defaultPages();
  const fallback = defaults[index] || {};
  const id = cleanId(item?.id, fallback.id || `page-${index + 1}`);
  let path = normalizeCmsPath(item?.path, fallback.path || `/${slugify(item?.title, id)}/`);
  if (id === "home") path = "/";
  if (id === "services" && ["/products.html", "/products/"].includes(path)) path = "/services/";
  if (id === "insights") path = "/insights/";
  return {
    id, type: cleanText(item?.type, fallback.type || "标准页", 80), title: cleanText(item?.title, fallback.title || "页面", 200), path,
    status: ["published", "draft", "archived"].includes(item?.status) ? item.status : "draft",
    description: cleanText(item?.description, fallback.description || "", 500),
    seoDescription: cleanText(item?.seoDescription, item?.description || fallback.seoDescription || "", 500),
    schemaEnabled: item?.schemaEnabled !== false, sitemapEnabled: item?.sitemapEnabled !== false,
    version: Math.max(1, Number.parseInt(item?.version, 10) || 1), savedAt: item?.savedAt || item?.updatedAt || null, publishedAt: item?.publishedAt || null
  };
}

function normalizeModule(item, pageId, index) {
  const title = cleanText(item?.title, `内容模块 ${index + 1}`, 160);
  const type = cleanText(item?.type, inferModuleType(item?.id, title), 80);
  return {
    id: cleanId(item?.id, `${pageId}-${type}-${index + 1}`), type, title,
    eyebrow: cleanText(item?.eyebrow, "", 80), description: cleanText(item?.description, "", 500),
    content: cleanText(item?.content, item?.description || "", 10_000), source: cleanText(item?.source, "CMS 页面内容", 160),
    status: ["published", "draft", "hidden"].includes(item?.status) ? item.status : "draft",
    ctaLabel: cleanText(item?.ctaLabel, "", 80), ctaHref: normalizeCmsPath(item?.ctaHref, "/contact/"),
    image: cleanText(item?.image, "", 500),
    items: (Array.isArray(item?.items) ? item.items : []).slice(0, 24).map((entry, itemIndex) => ({
      id: cleanId(entry?.id, `${pageId}-${type}-item-${itemIndex + 1}`), title: cleanText(entry?.title, `项目 ${itemIndex + 1}`, 160),
      description: cleanText(entry?.description, entry?.content || "", 1_000), href: normalizeCmsPath(entry?.href, "/contact/")
    }))
  };
}

function inferModuleType(id, title) {
  const value = `${id || ""} ${title || ""}`.toLocaleLowerCase("zh-CN");
  if (/hero|首屏/.test(value)) return "hero";
  if (/answer|直接答案|解决什么/.test(value)) return "answer";
  if (/service|产品|服务能力|服务模块/.test(value)) return "services";
  if (/process|流程/.test(value)) return "process";
  if (/case|proof|案例|证据|可信/.test(value)) return "proof";
  if (/insight|article|资讯|文章/.test(value)) return "insights";
  if (/problem-map|问题地图/.test(value)) return "problem-map";
  if (/faq|问题/.test(value)) return "faq";
  if (/contact|form|联系|咨询/.test(value)) return "contact";
  if (/cta|行动/.test(value)) return "cta";
  if (/entity|企业信息|主体/.test(value)) return "entity";
  return "content";
}

function normalizeBusinessLines(state = {}) {
  return (Array.isArray(state.businessLines) ? state.businessLines : []).filter((item) => item && item.status !== "archived").slice(0, 12).map((item, index) => ({
    id: cleanId(item.id, `business-line-${index + 1}`), name: cleanText(item.name, item.product || `业务线 ${index + 1}`, 160),
    product: cleanText(item.product, item.name || "", 160), description: cleanText(item.description, item.serviceDescription || item.positioning || "", 800),
    audience: cleanText(item.audience, item.targetAudience || "", 300), positioning: cleanText(item.positioning, "", 500),
    keywords: cleanList(item.coreKeywords || item.keywords, 8)
  }));
}

export function normalizeSiteCmsSnapshot(source = {}, state = {}) {
  const cms = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const legacy = Number(cms.schemaVersion || 0) < 1;
  const profile = state.enterpriseProfile && typeof state.enterpriseProfile === "object" ? state.enterpriseProfile : {};
  const legacySite = state.site && typeof state.site === "object" ? state.site : {};
  const settingsSource = cms.settings && typeof cms.settings === "object" ? cms.settings : {};
  const settings = {
    siteName: cleanText(settingsSource.siteName, profile.brandName || "企业官网", 160),
    companyName: cleanText(settingsSource.companyName, profile.companyName || profile.brandName || "企业", 300),
    description: cleanText(settingsSource.description, profile.introduction || profile.serviceDescription || "企业公开信息、产品服务与行业内容。", 800),
    officialDomain: cleanText(settingsSource.officialDomain, legacySite.domain || profile.officialDomain || "", 300).replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
    industryRegion: cleanText(settingsSource.industryRegion, profile.industryRegion || "", 200),
    serviceArea: cleanText(settingsSource.serviceArea, profile.serviceArea || "", 200),
    phone: cleanText(settingsSource.phone, profile.phone || profile.contactPhone || "", 80),
    email: cleanText(settingsSource.email, profile.email || "", 160), address: cleanText(settingsSource.address, profile.address || "", 300),
    logoUrl: cleanPublicUrl(settingsSource.logoUrl, { allowRelative: true }),
    sameAs: cleanPublicUrlList(settingsSource.sameAs),
    allowAiCrawl: settingsSource.allowAiCrawl !== false, updatedAt: settingsSource.updatedAt || null
  };
  const rawPages = Array.isArray(cms.pages) && cms.pages.length ? cms.pages : defaultPages();
  const pages = rawPages.filter((item) => item && typeof item === "object").slice(0, 60).map(normalizePage);
  for (const fallback of defaultPages()) if (!pages.some((page) => page.id === fallback.id)) pages.push(normalizePage(fallback, pages.length));
  // Old demonstrations shipped several half-filled pages as if they were
  // public. Keep them available to the editor, but do not expose them during
  // the first CMS migration until an operator deliberately publishes them.
  if (legacy) {
    for (const page of pages) {
      if (!CORE_PAGE_IDS.has(page.id) && OPTIONAL_PATHS.has(page.path)) {
        page.status = "draft";
        page.sitemapEnabled = false;
      }
    }
  }
  const seenPaths = new Set();
  for (const page of pages) {
    if (seenPaths.has(page.path)) page.path = normalizeCmsPath(`/pages/${slugify(page.title, page.id)}-${page.id}/`);
    seenPaths.add(page.path);
  }
  const rawModules = cms.modules && typeof cms.modules === "object" && !Array.isArray(cms.modules) ? cms.modules : {};
  const modules = {};
  for (const page of pages) {
    const sourceModules = Array.isArray(rawModules[page.id]) && rawModules[page.id].length ? rawModules[page.id] : defaultModules(page.id, { settings, pageTitle: page.title });
    modules[page.id] = sourceModules.slice(0, 40).map((item, index) => normalizeModule(item, page.id, index));
  }
  const categories = (Array.isArray(cms.categories) ? cms.categories : []).filter((item) => item && typeof item === "object").slice(0, 100).map((item, index) => ({
    id: cleanId(item.id, `category-${index + 1}`), name: cleanText(item.name, `栏目 ${index + 1}`, 160),
    slug: slugify(item.slug || item.name, `category-${index + 1}`), description: cleanText(item.description, "", 500),
    seoDescription: cleanText(item.seoDescription, item.description || "", 500),
    status: item.status === "archived" ? "archived" : "active", navVisible: item.navVisible !== false, updatedAt: item.updatedAt || null
  }));
  if (!categories.length) categories.push({ id: "insights", name: "行业观点", slug: "insights", description: "企业公开发布的行业内容。", seoDescription: "企业行业观点与专业内容。", status: "active", navVisible: true, updatedAt: null });
  const rawNav = Array.isArray(cms.navItems) ? cms.navItems : [];
  const fallbackNav = [
    { id: "nav-home", label: "首页", path: "/" }, { id: "nav-services", label: "产品与服务", path: "/services/" },
    { id: "nav-cases", label: "服务案例", path: "/cases/" }, { id: "nav-insights", label: "行业资讯", path: "/insights/" },
    { id: "nav-problem-map", label: "问题地图", path: "/problem-map/" }, { id: "nav-about", label: "关于我们", path: "/about/" },
    { id: "nav-contact", label: "联系我们", path: "/contact/" }
  ];
  const navItems = (rawNav.length ? rawNav : fallbackNav).filter((item) => item && typeof item === "object").slice(0, 12).map((item, index) => {
    const path = normalizeCmsPath(item.path, "/");
    return { id: cleanId(item.id, `nav-${index + 1}`), label: cleanText(item.label, `导航 ${index + 1}`, 100), path, type: cleanText(item.type, "固定页面", 80), visible: item.visible !== false && !(legacy && OPTIONAL_PATHS.has(path) && path !== "/cases/") };
  });
  const requiredNav = fallbackNav.map((item) => ({ ...item, type: item.path === "/insights/" ? "资讯列表" : "固定页面", visible: true }));
  for (const item of requiredNav) if (!navItems.some((nav) => nav.path === item.path)) navItems.push(item);
  const navOrder = new Map(requiredNav.map((item, index) => [item.path, index]));
  navItems.sort((a, b) => (navOrder.get(a.path) ?? 100) - (navOrder.get(b.path) ?? 100));
  const themeSource = cms.theme && typeof cms.theme === "object" ? cms.theme : {};
  const primaryColor = /^#[0-9a-f]{6}$/i.test(themeSource.primaryColor || "") ? themeSource.primaryColor : "#155eef";
  const theme = { name: cleanText(themeSource.name, "企业官网 · 标准版", 120), primaryColor, cta: cleanText(themeSource.cta, "预约业务咨询", 80), version: Math.max(1, Number.parseInt(themeSource.version, 10) || 1), updatedAt: themeSource.updatedAt || null };
  const redirects = (Array.isArray(cms.redirects) ? cms.redirects : []).filter((item) => item && typeof item === "object").slice(0, 500).map((item, index) => ({
    id: cleanId(item.id, `redirect-${index + 1}`), from: normalizeCmsPath(item.from, "/"), to: normalizeCmsPath(item.to, "/"),
    status: item.status === "disabled" ? "disabled" : "active", reason: cleanText(item.reason, "地址变更", 300), updatedAt: item.updatedAt || item.createdAt || null
  })).filter((item) => item.from !== item.to);
  const standardRedirects = [["/index.html", "/"], ["/products.html", "/services/"], ["/products/", "/services/"], ["/about.html", "/about/"], ["/contact.html", "/contact/"], ["/insights.html", "/insights/"]];
  for (const [from, to] of standardRedirects) if (!redirects.some((item) => item.from === from)) redirects.push({ id: `standard-${slugify(from, "redirect")}`, from, to, status: "active", reason: "统一官网规范地址", updatedAt: null });
  return {
    schemaVersion: 2, settings, theme, pages, modules, categories, navItems, redirects,
    services: normalizeServices(cms.services), cases: normalizeCases(cms.cases), problemGroups: normalizeProblemGroups(cms.problemGroups),
    businessLines: normalizeBusinessLines(state), generatedAt: cleanText(cms.generatedAt, new Date().toISOString(), 80)
  };
}

function serializeSnapshot(snapshot) {
  const json = JSON.stringify(snapshot);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_SNAPSHOT_BYTES) throw new SiteCmsError("官网 CMS 数据超过允许大小。", 413, "SITE_CMS_SNAPSHOT_TOO_LARGE", { bytes, maximum: MAX_SNAPSHOT_BYTES });
  return { json, checksum: createHash("sha256").update(json).digest("hex") };
}

function parseSnapshot(value) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid snapshot");
    return parsed;
  } catch {
    throw new SiteCmsError("官网 CMS 数据无法解析。", 500, "SITE_CMS_SNAPSHOT_CORRUPT");
  }
}

function actorId(actor) { return actor?.userId || actor?.id || null; }

export class SiteCmsStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("SiteCmsStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = cleanId(options.workspaceId, "default");
    this.trustProxy = options.trustProxy ?? (String(process.env.TZ_TRUST_PROXY || "").toLowerCase() === "true");
  }

  workspaceState(workspaceId = this.workspaceId) {
    const row = this.connection.prepare("SELECT state_json FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
    if (!row) return {};
    try { return JSON.parse(row.state_json || "{}"); } catch { return {}; }
  }

  ensureInitialized(workspaceId = this.workspaceId) {
    const existing = this.connection.prepare("SELECT * FROM site_cms_drafts WHERE workspace_id = ?").get(workspaceId);
    const publication = this.connection.prepare("SELECT workspace_id FROM site_cms_publications WHERE workspace_id = ?").get(workspaceId);
    const state = this.workspaceState(workspaceId);
    if (existing && publication) {
      const stored = parseSnapshot(existing.snapshot_json);
      const needsContentMigration = Number(stored.schemaVersion || 0) < 2
        || !Array.isArray(stored.services) || !Array.isArray(stored.cases) || !Array.isArray(stored.problemGroups);
      if (needsContentMigration) {
        const migrated = normalizeSiteCmsSnapshot(stored, state);
        const serialized = serializeSnapshot(migrated);
        if (serialized.checksum !== existing.checksum) {
          const now = new Date().toISOString();
          this.database.transaction(() => {
            const result = this.connection.prepare(`UPDATE site_cms_drafts SET revision = ?, snapshot_json = ?, checksum = ?, updated_at = ? WHERE workspace_id = ? AND revision = ? AND checksum = ?`)
              .run(Number(existing.revision) + 1, serialized.json, serialized.checksum, now, workspaceId, Number(existing.revision), existing.checksum);
            if (Number(result.changes) === 1) appendAuditLog(this.connection, {
              actorUserId: null, action: "site.cms.draft.migrate", entityType: "site_cms_draft", entityId: workspaceId,
              details: { fromSchemaVersion: Number(stored.schemaVersion || 0), toSchemaVersion: 2, revision: Number(existing.revision) + 1 },
              request: null, trustProxy: this.trustProxy, createdAt: now
            });
          });
        }
      }
      return;
    }
    const snapshot = normalizeSiteCmsSnapshot(state.site?.cms || {}, state);
    const serialized = serializeSnapshot(snapshot);
    const now = new Date().toISOString();
    this.database.transaction(() => {
      // The admin and public-site processes may start against a freshly
      // migrated database at the same time. Re-check inside the write
      // transaction so bootstrap remains idempotent under that race.
      const currentDraft = this.connection.prepare("SELECT workspace_id FROM site_cms_drafts WHERE workspace_id = ?").get(workspaceId);
      const currentPublication = this.connection.prepare("SELECT workspace_id FROM site_cms_publications WHERE workspace_id = ?").get(workspaceId);
      if (!currentDraft) this.connection.prepare(`INSERT INTO site_cms_drafts (workspace_id, revision, snapshot_json, checksum, created_at, updated_at, updated_by) VALUES (?, 1, ?, ?, ?, ?, NULL)`).run(workspaceId, serialized.json, serialized.checksum, now, now);
      if (!currentPublication) {
        const releaseId = `SITE-REL-${randomUUID()}`;
        this.connection.prepare(`INSERT INTO site_cms_releases (id, workspace_id, version_number, source_draft_revision, source_release_id, operation, snapshot_json, checksum, note, created_at, created_by) VALUES (?, ?, 1, 1, NULL, 'bootstrap', ?, ?, ?, ?, NULL)`)
          .run(releaseId, workspaceId, serialized.json, serialized.checksum, "升级前官网自动保留版本", now);
        this.connection.prepare(`INSERT INTO site_cms_publications (workspace_id, release_id, version_number, published_at, published_by) VALUES (?, ?, 1, ?, NULL)`).run(workspaceId, releaseId, now);
      }
    });
  }

  draft(workspaceId = this.workspaceId) {
    this.ensureInitialized(workspaceId);
    const row = this.connection.prepare("SELECT * FROM site_cms_drafts WHERE workspace_id = ?").get(workspaceId);
    const snapshot = normalizeSiteCmsSnapshot(parseSnapshot(row.snapshot_json), this.workspaceState(workspaceId));
    const checksum = serializeSnapshot(snapshot).checksum;
    return { workspaceId, revision: Number(row.revision), snapshot, checksum, createdAt: row.created_at, updatedAt: row.updated_at, updatedBy: row.updated_by || null };
  }

  publication(workspaceId = this.workspaceId) {
    this.ensureInitialized(workspaceId);
    const row = this.connection.prepare(`SELECT p.workspace_id, p.release_id, p.version_number, p.published_at, p.published_by, r.operation, r.note, r.checksum, r.source_draft_revision, r.snapshot_json FROM site_cms_publications p JOIN site_cms_releases r ON r.id = p.release_id WHERE p.workspace_id = ?`).get(workspaceId);
    return { workspaceId, releaseId: row.release_id, version: Number(row.version_number), publishedAt: row.published_at, publishedBy: row.published_by || null, operation: row.operation, note: row.note, checksum: row.checksum, sourceDraftRevision: Number(row.source_draft_revision), snapshot: parseSnapshot(row.snapshot_json) };
  }

  releases(workspaceId = this.workspaceId, limit = 50) {
    this.ensureInitialized(workspaceId);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const current = this.connection.prepare("SELECT release_id FROM site_cms_publications WHERE workspace_id = ?").get(workspaceId)?.release_id;
    return this.connection.prepare(`SELECT id, version_number, source_draft_revision, source_release_id, operation, checksum, note, created_at, created_by FROM site_cms_releases WHERE workspace_id = ? ORDER BY version_number DESC LIMIT ?`).all(workspaceId, safeLimit).map((row) => ({
      id: row.id, version: Number(row.version_number), sourceDraftRevision: Number(row.source_draft_revision), sourceReleaseId: row.source_release_id || null, operation: row.operation, checksum: row.checksum, note: row.note, createdAt: row.created_at, createdBy: row.created_by || null, current: row.id === current
    }));
  }

  saveDraft(input = {}, actor = null, request = null, workspaceId = this.workspaceId) {
    const current = this.draft(workspaceId);
    const expectedRevision = Number(input.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new SiteCmsError("保存官网草稿必须提供 expectedRevision。", 428, "SITE_CMS_EXPECTED_REVISION_REQUIRED");
    if (expectedRevision !== current.revision) throw new SiteCmsError("官网草稿已由其他成员更新，请刷新后重试。", 409, "SITE_CMS_DRAFT_CONFLICT", { expectedRevision, currentRevision: current.revision });
    const state = this.workspaceState(workspaceId);
    const source = input.cms || input.snapshot || state.site?.cms || {};
    const snapshot = normalizeSiteCmsSnapshot(source, state);
    const serialized = serializeSnapshot(snapshot);
    if (serialized.checksum === current.checksum) return current;
    const revision = current.revision + 1;
    const now = new Date().toISOString();
    const userId = actorId(actor);
    this.database.transaction(() => {
      const result = this.connection.prepare(`UPDATE site_cms_drafts SET revision = ?, snapshot_json = ?, checksum = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND revision = ?`).run(revision, serialized.json, serialized.checksum, now, userId, workspaceId, current.revision);
      if (Number(result.changes) !== 1) throw new SiteCmsError("官网草稿已由其他成员更新，请刷新后重试。", 409, "SITE_CMS_DRAFT_CONFLICT");
      appendAuditLog(this.connection, { actorUserId: userId, action: "site.cms.draft.save", entityType: "site_cms_draft", entityId: workspaceId, details: { previousRevision: current.revision, revision, checksum: serialized.checksum }, request, trustProxy: this.trustProxy, createdAt: now });
    });
    return { workspaceId, revision, snapshot, checksum: serialized.checksum, createdAt: current.createdAt, updatedAt: now, updatedBy: userId };
  }

  publish(input = {}, actor = null, request = null, workspaceId = this.workspaceId) {
    const draft = this.draft(workspaceId);
    const expectedRevision = Number(input.expectedDraftRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision !== draft.revision) throw new SiteCmsError("发布前草稿版本已变化，请刷新预览后重新发布。", 409, "SITE_CMS_PUBLISH_CONFLICT", { expectedRevision, currentRevision: draft.revision });
    const current = this.publication(workspaceId);
    if (draft.checksum === current.checksum) throw new SiteCmsError("官网草稿与当前正式版本一致，无需重复发布。", 409, "SITE_CMS_NO_CHANGES");
    const version = current.version + 1;
    const id = `SITE-REL-${randomUUID()}`;
    const now = new Date().toISOString();
    const userId = actorId(actor);
    const note = cleanText(input.note, `发布官网 v${version}`, 500);
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO site_cms_releases (id, workspace_id, version_number, source_draft_revision, source_release_id, operation, snapshot_json, checksum, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'publish', ?, ?, ?, ?, ?)`).run(id, workspaceId, version, draft.revision, current.releaseId, JSON.stringify(draft.snapshot), draft.checksum, note, now, userId);
      this.connection.prepare(`UPDATE site_cms_publications SET release_id = ?, version_number = ?, published_at = ?, published_by = ? WHERE workspace_id = ?`).run(id, version, now, userId, workspaceId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "site.cms.publish", entityType: "site_cms_release", entityId: id, details: { version, draftRevision: draft.revision, previousReleaseId: current.releaseId, checksum: draft.checksum }, request, trustProxy: this.trustProxy, createdAt: now });
    });
    return this.publication(workspaceId);
  }

  rollback(input = {}, actor = null, request = null, workspaceId = this.workspaceId) {
    const releaseId = cleanText(input.releaseId, "", 200);
    if (!releaseId) throw new SiteCmsError("请选择需要恢复的官网版本。", 422, "SITE_CMS_RELEASE_REQUIRED");
    const target = this.connection.prepare("SELECT * FROM site_cms_releases WHERE id = ? AND workspace_id = ?").get(releaseId, workspaceId);
    if (!target) throw new SiteCmsError("指定的官网版本不存在。", 404, "SITE_CMS_RELEASE_NOT_FOUND");
    const current = this.publication(workspaceId);
    const expectedVersion = Number(input.expectedCurrentVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion !== current.version) throw new SiteCmsError("官网正式版本已经变化，请刷新后重试。", 409, "SITE_CMS_ROLLBACK_CONFLICT", { expectedVersion, currentVersion: current.version });
    const draft = this.draft(workspaceId);
    const snapshot = parseSnapshot(target.snapshot_json);
    const serialized = serializeSnapshot(snapshot);
    const draftRevision = draft.revision + 1;
    const version = current.version + 1;
    const id = `SITE-REL-${randomUUID()}`;
    const now = new Date().toISOString();
    const userId = actorId(actor);
    const note = cleanText(input.note, `回滚至 v${target.version_number}`, 500);
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE site_cms_drafts SET revision = ?, snapshot_json = ?, checksum = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ?`).run(draftRevision, serialized.json, serialized.checksum, now, userId, workspaceId);
      this.connection.prepare(`INSERT INTO site_cms_releases (id, workspace_id, version_number, source_draft_revision, source_release_id, operation, snapshot_json, checksum, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'rollback', ?, ?, ?, ?, ?)`).run(id, workspaceId, version, draftRevision, releaseId, serialized.json, serialized.checksum, note, now, userId);
      this.connection.prepare(`UPDATE site_cms_publications SET release_id = ?, version_number = ?, published_at = ?, published_by = ? WHERE workspace_id = ?`).run(id, version, now, userId, workspaceId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "site.cms.rollback", entityType: "site_cms_release", entityId: id, details: { version, restoredReleaseId: releaseId, restoredVersion: Number(target.version_number), previousReleaseId: current.releaseId, draftRevision }, request, trustProxy: this.trustProxy, createdAt: now });
    });
    return { publication: this.publication(workspaceId), draft: this.draft(workspaceId) };
  }
}
