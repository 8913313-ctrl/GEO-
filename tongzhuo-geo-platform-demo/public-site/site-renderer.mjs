import { applyPublicCitationVisibility } from "../citation-visibility.mjs";
import { getSiteTemplate, resolveSiteTemplateKey, SITE_TEMPLATE_CSS } from "./templates/site-template-registry.mjs";

const DEFAULT_DESCRIPTION = "企业公开信息、行业洞察与可验证的专业内容。";

// Front-end prototype content. These records are presentation fallbacks only:
// the public website can later receive the same shape exclusively from CMS.
const FRONTEND_SERVICES = Object.freeze([
  { id: "geo", title: "GEO 服务", eyebrow: "AI SEARCH VISIBILITY", description: "围绕企业知识、官网信源、客户问题和持续内容运营，让企业信息更容易被客户与 AI 正确理解。", audience: "工业品、制造业及需要建设公开信源的中小企业", href: "/services/#geo" },
  { id: "enterprise-ai", title: "企业 AI 落地", eyebrow: "ENTERPRISE AI", description: "把企业资料、业务规则和工作流程整理为可调用的知识与智能应用，帮助团队真正使用 AI。", audience: "希望建设知识库、智能体和业务工作流的企业", href: "/services/#enterprise-ai" },
  { id: "short-video", title: "短视频运营", eyebrow: "CONTENT GROWTH", description: "围绕真实业务场景建立选题、脚本、账号和发布节奏，持续沉淀可复用的内容资产。", audience: "需要长期获客和内容运营能力的企业", href: "/services/#short-video" }
]);

const FRONTEND_CASES = Object.freeze([
  { id: "case-industry-source", title: "工业设备企业公开信源建设", service: "GEO 服务", industry: "工业品", summary: "统一产品参数、应用场景和售后问答，让官网与公开内容使用同一套企业事实。", result: "企业知识、官网页面与内容生产形成统一来源" },
  { id: "case-manufacturing-questions", title: "制造业客户问题体系梳理", service: "企业 AI 落地", industry: "制造业", summary: "按照采购、技术和使用人员的决策阶段拆分问题，形成知识库、问题地图和内容计划。", result: "客户问题能够被持续管理、回答和复用" },
  { id: "case-content-operations", title: "中小企业内容运营流程建设", service: "短视频运营", industry: "中小企业", summary: "统一内容方向、审核标准和发布节奏，让短视频与图文内容不再依赖临时发挥。", result: "形成可执行、可复盘的长期内容机制" }
]);

const FRONTEND_PROBLEM_GROUPS = Object.freeze([
  { id: "geo", title: "GEO 服务问题", service: "GEO 服务", description: "从 AI 搜索认知、信源建设到效果判断。", questions: [
    { slug: "industrial-geo-start", title: "工业品企业做 GEO 应该从哪里开始？", answer: "先统一企业主体、产品服务、应用场景、案例和常见问答，再围绕采购与技术人员真实会问的问题建设公开内容。", industries: ["工业品", "制造业"] },
    { slug: "geo-vs-seo", title: "GEO 与传统 SEO 的目标和做法有什么不同？", answer: "SEO 更关注搜索结果中的网页可见性，GEO 更关注企业事实能否被 AI 理解、选择并组织进回答。两者可以协同，但内容结构和衡量方式不同。", industries: ["工业品", "制造业", "中小企业"] },
    { slug: "geo-service-selection", title: "选择 GEO 服务商时需要重点判断哪些能力？", answer: "重点判断企业知识整理、真实问题研究、内容审核、官网信源、多平台发布和可复核监测是否能形成闭环。", industries: ["制造业", "中小企业"] },
    { slug: "geo-value", title: "企业如何判断 GEO 项目是否正在产生真实价值？", answer: "应持续观察公开内容是否被抓取、品牌与服务是否被正确提及、引用来源能否复核，以及高价值问题的覆盖是否提升。", industries: ["工业品", "制造业", "中小企业"] }
  ] },
  { id: "enterprise-ai", title: "企业 AI 落地问题", service: "企业 AI 落地", description: "从资料治理、知识库到业务智能体。", questions: [
    { slug: "ai-knowledge-base", title: "企业做 AI 应用前为什么要先建立知识库？", answer: "企业知识库为 AI 提供统一、经过审核且可追溯的事实来源，避免不同员工、文档和模型给出互相冲突的答案。", industries: ["工业品", "制造业", "中小企业"] },
    { slug: "ai-first-scenario", title: "没有 AI 基础的企业应该先落地哪个场景？", answer: "优先选择资料相对完整、结果容易人工核对、能够节省重复劳动的场景，例如企业问答、内容辅助或内部资料检索。", industries: ["制造业", "中小企业"] },
    { slug: "ai-data-security", title: "企业资料交给 AI 使用时怎样控制安全边界？", answer: "需要明确资料权限、公开级别、审核状态和调用范围，并对模型密钥、访问日志和知识版本进行独立管理。", industries: ["工业品", "制造业"] }
  ] },
  { id: "short-video", title: "短视频运营问题", service: "短视频运营", description: "从选题、内容生产到账号持续运营。", questions: [
    { slug: "video-b2b-content", title: "工业品和制造业短视频应该拍什么内容？", answer: "优先展示客户真实关心的选型问题、使用场景、技术边界、实施流程和售后问题，而不是只做企业宣传片。", industries: ["工业品", "制造业"] },
    { slug: "video-sustainable", title: "企业怎样建立可持续的短视频选题机制？", answer: "把销售、客服、技术和采购沟通中反复出现的问题沉淀为问题库，再按业务阶段持续转化为脚本和内容计划。", industries: ["工业品", "制造业", "中小企业"] },
    { slug: "video-results", title: "短视频运营效果应该怎样复盘？", answer: "除播放量外，还应观察有效咨询、客户问题、内容复用、账号稳定性和销售协同情况。", industries: ["中小企业", "制造业"] }
  ] }
]);

// These records keep the first public-site walkthrough useful before a client
// has published its own CMS content. They are deliberately presentation-only;
// once the CMS contains approved records, the runtime data takes precedence.
const FRONTEND_ARTICLES = Object.freeze([
  { id: "frontend-article-geo", slug: "industrial-geo-first-step", title: "工业品企业做 GEO，第一步不是批量写文章", categoryName: "GEO优化", categorySlug: "geo", author: "桐灼内容团队", publishedAt: "2026-07-18T09:00:00+08:00", excerpt: "GEO 的起点是统一企业事实、客户问题和公开信源，而不是先堆叠一批看似专业的文章。", tags: ["GEO", "企业信源"], contentHtml: "<h2>直接回答</h2><p>工业品企业做 GEO，第一步应当先整理企业主体、产品服务、应用场景、案例和常见问答，再把这些事实组织成客户与 AI 都能理解的公开内容。</p><h2>为什么不能先批量写作</h2><p>如果产品参数、服务边界和客户问题没有统一来源，文章越多，企业对外表达越容易互相冲突。GEO 需要的是一套可持续维护的事实系统。</p><h2>建议的起步顺序</h2><ol><li>确认企业主体和核心业务线。</li><li>整理客户在采购、技术和使用阶段的真实问题。</li><li>建立官网页面、问题地图和行业资讯的关联结构。</li></ol>" },
  { id: "frontend-article-ai", slug: "enterprise-ai-knowledge-base", title: "企业 AI 落地为什么要先建设可审核知识库", categoryName: "企业AI落地", categorySlug: "enterprise-ai", author: "桐灼内容团队", publishedAt: "2026-07-12T09:00:00+08:00", excerpt: "知识库不是文件堆，而是经过版本、权限和审核管理，可以被业务持续调用的企业事实底座。", tags: ["企业AI", "知识库"], contentHtml: "<h2>直接回答</h2><p>企业 AI 落地前先建设知识库，是为了让模型获得统一、经过审核且可以追溯的事实来源。</p><h2>企业知识库要管理什么</h2><p>除了文件本身，还要管理资料所属业务线、有效版本、来源、审核状态、访问权限和可引用片段。</p><h2>从一个场景开始</h2><p>建议优先从企业问答、销售资料检索或售后支持这类边界清晰的场景开始，再逐步扩展到内容生产和智能体。</p>" },
  { id: "frontend-article-video", slug: "manufacturing-short-video-questions", title: "制造业短视频选题，应该从销售现场的问题开始", categoryName: "短视频运营", categorySlug: "short-video", author: "桐灼内容团队", publishedAt: "2026-07-05T09:00:00+08:00", excerpt: "真正能持续生产的制造业内容，来自客户反复提出的选型、使用、交付与售后问题。", tags: ["制造业", "短视频"], contentHtml: "<h2>先找问题，再定脚本</h2><p>把销售、技术和售后团队反复回答的问题记录下来，再按客户决策阶段拆解为短视频主题。</p><h2>一条问题可以拆成多种内容</h2><p>同一问题可以分别做成现场演示、参数解释、误区澄清和案例复盘，形成连续而不重复的内容节奏。</p><h2>内容要回到业务</h2><p>每条内容都应该说明适用场景、边界和下一步行动，避免只追求播放量而无法产生有效咨询。</p>" },
  { id: "frontend-article-source", slug: "official-site-trusted-source", title: "官网如何成为企业可控制的第一方信源", categoryName: "GEO优化", categorySlug: "geo", author: "桐灼内容团队", publishedAt: "2026-06-28T09:00:00+08:00", excerpt: "官网不是信息堆放区，而是企业身份、产品事实、问题回答和联系入口的第一方公开来源。", tags: ["官网", "第一方信源"], contentHtml: "<h2>官网要回答四件事</h2><p>企业是谁、提供什么、适合解决什么问题，以及客户如何验证和联系企业。</p><h2>页面之间要彼此关联</h2><p>产品与服务连接问题地图，问题地图连接行业资讯，文章详情再连接服务案例和咨询入口，访客与 AI 才能沿着同一条事实链理解企业。</p>" },
  { id: "frontend-article-question", slug: "customer-question-to-content", title: "怎样把产品资料整理成客户真正会问的问题", categoryName: "企业AI落地", categorySlug: "enterprise-ai", author: "桐灼内容团队", publishedAt: "2026-06-20T09:00:00+08:00", excerpt: "从资料出发不等于照抄资料，要把参数、场景和边界翻译成客户在决策过程中会提出的具体问题。", tags: ["问题地图", "内容生产"], contentHtml: "<h2>问题来自决策阶段</h2><p>采购关心适配和成本，技术关心参数与边界，使用人员关心部署和维护。不同阶段需要不同的回答。</p><h2>问题要能被直接回答</h2><p>好的问题包含对象、场景和判断条件，回答时可以引用明确事实，而不是只给概念解释。</p>" },
  { id: "frontend-article-ai-read", slug: "ai-readable-content-structure", title: "AI 读取企业内容时，最先识别哪些结构", categoryName: "GEO优化", categorySlug: "geo", author: "桐灼内容团队", publishedAt: "2026-06-12T09:00:00+08:00", excerpt: "清晰的标题层级、直接回答、实体信息、证据与更新时间，决定内容能否被稳定理解和引用。", tags: ["AI读取", "内容结构"], contentHtml: "<h2>先给直接答案</h2><p>文章开头先回答问题，再补充依据、适用条件和操作步骤，能降低读者和机器的理解成本。</p><h2>把事实写成可识别的实体</h2><p>企业名称、产品名称、服务范围、行业和联系方式应该在页面中保持一致，并通过内部链接形成关联。</p>" }
]);

const FRONTEND_NAV = Object.freeze([
  { label: "首页", path: "/" }, { label: "产品与服务", path: "/services/" }, { label: "关于我们", path: "/about/" },
  { label: "服务案例", path: "/cases/" }, { label: "行业资讯", path: "/insights/" }, { label: "问题地图", path: "/problem-map/" }, { label: "联系我们", path: "/contact/" }
]);

const ENABLED_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function explicitFrontendDemoRequested() {
  return ENABLED_ENV_VALUES.has(String(process.env.TZ_SITE_FRONTEND_DEMO || "").trim().toLowerCase());
}

export function demoFixturesEnabled(site = {}) {
  return process.env.NODE_ENV !== "production"
    && explicitFrontendDemoRequested()
    && site?.frontendDemo === true;
}

const VOID_TAGS = new Set(["br", "hr", "img"]);
const ALLOWED_TAGS = new Set([
  "a", "article", "b", "blockquote", "br", "code", "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "mark", "ol", "p", "pre", "section", "small",
  "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul"
]);
const GLOBAL_ATTRIBUTES = new Set(["class", "id", "title"]);
const TAG_ATTRIBUTES = Object.freeze({
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  ol: new Set(["start"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"])
});

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(value = "") { return escapeHtml(value); }

function decodeEntities(value = "") {
  const names = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (Object.hasOwn(names, key)) return names[key];
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16) || 0xfffd);
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10) || 0xfffd);
    return match;
  });
}

export function plainText(value = "") {
  return decodeEntities(String(value)
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|noscript|template|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|table|ul|ol|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateText(value, maximum = 180) {
  const source = plainText(value);
  if (source.length <= maximum) return source;
  return `${source.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

export function slugify(value, fallback = "article") {
  const slug = String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function normalizeArticleSlug(value) {
  try { return decodeURIComponent(String(value || "")).normalize("NFKC").toLocaleLowerCase("en-US"); } catch { return String(value || "").normalize("NFKC").toLocaleLowerCase("en-US"); }
}

function safeUrl(value, kind = "link") {
  const candidate = String(value || "").trim();
  if (!candidate || /[\u0000-\u001f\u007f]/.test(candidate)) return "";
  if (candidate.startsWith("#") || candidate.startsWith("./") || candidate.startsWith("../")) return candidate;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
    if (kind === "link" && ["mailto:", "tel:"].includes(parsed.protocol)) return parsed.href;
  } catch {
    // Relative values without a leading dot are intentionally rejected. They
    // are ambiguous after an article is mounted under /insights/:slug.
  }
  return "";
}

function parseAttributes(raw = "") {
  const result = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of String(raw).matchAll(pattern)) {
    result.push([String(match[1] || "").toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""]);
  }
  return result;
}

/**
 * Small server-side allow-list sanitizer for published article HTML. The
 * content store is authoritative, but a public renderer must never trust
 * stored HTML as executable markup.
 */
export function sanitizeArticleHtml(value = "") {
  const withoutDangerousBlocks = String(value || "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<(script|style|noscript|template|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\?(?:[\s\S]*?)\?>/g, "");
  return withoutDangerousBlocks.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (token, rawTag, rawAttributes) => {
    const sourceTag = String(rawTag || "").toLowerCase();
    // The article title is the document's only H1. Stored body H1 headings are
    // demoted at the publication boundary so imported/editor content cannot
    // create competing top-level page titles.
    const tag = sourceTag === "h1" ? "h2" : sourceTag;
    const closing = /^<\s*\//.test(token);
    if (!ALLOWED_TAGS.has(sourceTag)) return "";
    if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    const allowed = new Set([...(TAG_ATTRIBUTES[tag] || []), ...GLOBAL_ATTRIBUTES]);
    const attributes = [];
    let hasLoading = false;
    for (const [name, rawValue] of parseAttributes(rawAttributes)) {
      if (!allowed.has(name)) continue;
      let value = String(rawValue || "").trim();
      if (name === "href") value = safeUrl(value, "link");
      if (name === "src") value = safeUrl(value, "image");
      if ((name === "href" || name === "src") && !value) continue;
      if (name === "target" && value !== "_blank" && value !== "_self") continue;
      if (name === "rel") value = value.split(/\s+/).filter((item) => ["nofollow", "noopener", "noreferrer"].includes(item)).join(" ");
      if (name === "class") value = value.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
      if (name === "id") value = value.replace(/[^\w\-:.]/g, "-").slice(0, 160);
      if (name === "width" || name === "height" || name === "colspan" || name === "rowspan" || name === "start") {
        const numeric = Number.parseInt(value, 10);
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10_000) continue;
        value = String(numeric);
      }
      if (name === "loading") { if (!["lazy", "eager"].includes(value)) continue; hasLoading = true; }
      if (!value && !["title", "alt"].includes(name)) continue;
      attributes.push(`${name}="${escapeHtml(value)}"`);
    }
    if (tag === "a" && attributes.some((attribute) => attribute === 'target="_blank"') && !attributes.some((attribute) => attribute.startsWith("rel="))) {
      attributes.push('rel="noopener noreferrer"');
    }
    if (tag === "img" && !hasLoading) attributes.push('loading="lazy"');
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  });
}

function ensureArticleHeadings(html) {
  const used = new Set();
  const headings = [];
  const body = html.replace(/<(h[2-3])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, tag, attributes, inner) => {
    const title = plainText(inner);
    if (!title) return whole;
    const idMatch = String(attributes || "").match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const base = slugify(idMatch?.[1] || idMatch?.[2] || idMatch?.[3] || title, "section");
    let id = base;
    let suffix = 2;
    while (used.has(id)) { id = `${base}-${suffix}`; suffix += 1; }
    used.add(id);
    headings.push({ level: String(tag).toLowerCase(), id, title });
    const cleanAttributes = String(attributes || "").replace(/\s+id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i, "");
    return `<${String(tag).toLowerCase()}${cleanAttributes} id="${escapeHtml(id)}">${inner}</${String(tag).toLowerCase()}>`;
  });
  return { html: body, headings };
}

function dateValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoDate(value) { return dateValue(value)?.toISOString() || ""; }
function dateLabel(value) {
  const date = dateValue(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
}
function dateShort(value) {
  const date = dateValue(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("/", ".");
}
function dateDay(value) {
  const date = dateValue(value);
  return date ? String(date.getDate()).padStart(2, "0") : "--";
}
function dateMonth(value) {
  const date = dateValue(value);
  return date ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}` : "";
}

function absoluteUrl(origin, pathname = "/") {
  return new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, origin).href;
}

function canonicalPublicPath(pathname = "/") {
  const source = String(pathname || "/").trim() || "/";
  const [rawPath, suffix = ""] = source.split(/(?=[?#])/u, 2);
  let normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized !== "/" && !/\.[a-z0-9]{1,8}$/i.test(normalized)) normalized = `${normalized.replace(/\/+$/, "")}/`;
  return `${normalized}${suffix}`;
}

function pagePathKey(pathname = "/") {
  let value = String(pathname || "/").split(/[?#]/u, 1)[0] || "/";
  value = value.replace(/\/{2,}/g, "/");
  return value === "/" ? "/" : value.replace(/\/+$/, "");
}

function publishedPage(site, id, pathname = "") {
  const pages = Array.isArray(site.pages) ? site.pages : [];
  const pathKey = pagePathKey(pathname);
  return pages.find((page) => page?.status === "published" && (page?.id === id || (pathname && pagePathKey(page.path) === pathKey))) || null;
}

function pageForPath(site, pathname = "/") {
  const target = pagePathKey(pathname);
  const pages = Array.isArray(site.pages) ? site.pages : [];
  const exact = pages.find((page) => pagePathKey(page?.path) === target);
  if (exact) return exact;
  return pages
    .filter((page) => {
      const candidate = pagePathKey(page?.path);
      return candidate !== "/" && target.startsWith(`${candidate}/`);
    })
    .sort((left, right) => pagePathKey(right.path).length - pagePathKey(left.path).length)[0] || null;
}

function publicFixedPageAvailable(site, pathname) {
  const key = pagePathKey(pathname);
  const configured = pageForPath(site, key);
  if (configured) return configured.status === "published";
  return demoFixturesEnabled(site) && ["/cases", "/problem-map"].includes(key);
}

function entityId(origin, name) { return `${absoluteUrl(origin, "/")}#${name}`; }

function safeJsonLd(value) {
  return JSON.stringify(value, null, 0)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function organizationSchema(site, origin) {
  const organizationId = entityId(origin, "organization");
  const contact = site.contact || {};
  const servedAreas = [...new Set([contact.industryRegion, contact.serviceArea].map((item) => String(item || "").trim()).filter(Boolean))];
  const rawLogo = publicAsset(site, "schemaLogoUrl") || publicAsset(site, "logoUrl");
  const logo = rawLogo ? new URL(rawLogo, origin).href : undefined;
  const sameAs = (Array.isArray(site.sameAs) ? site.sameAs : []).map((item) => safeUrl(item, "link")).filter((item) => /^https?:/i.test(item));
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: site.companyName || site.siteName,
    alternateName: site.siteName && site.siteName !== site.companyName ? site.siteName : undefined,
    url: absoluteUrl(origin, "/"),
    logo,
    sameAs: sameAs.length ? [...new Set(sameAs)] : undefined,
    telephone: contact.phone || undefined,
    email: contact.email || undefined,
    address: contact.address ? { "@type": "PostalAddress", streetAddress: contact.address } : undefined,
    areaServed: servedAreas.length ? servedAreas.map((name) => ({ "@type": "AdministrativeArea", name })) : undefined
  };
}

function isWebPageType(value) {
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) => ["WebPage", "AboutPage", "ContactPage", "CollectionPage", "FAQPage", "ProfilePage", "SearchResultsPage"].includes(type));
}

function pageSchema(site, origin, pathname, extra = [], options = {}) {
  const organizationId = entityId(origin, "organization");
  const websiteId = entityId(origin, "website");
  const canonical = absoluteUrl(origin, pathname);
  const pageId = `${canonical}#webpage`;
  const pageEnabled = options.pageEnabled !== false;
  const extras = Array.isArray(extra) ? extra.filter(Boolean) : [];
  const explicitPage = extras.find((node) => node && isWebPageType(node["@type"])) || null;
  const pageNode = {
    "@type": explicitPage?.["@type"] || options.pageType || "WebPage",
    ...(explicitPage || {}),
    "@id": pageId,
    url: canonical,
    name: explicitPage?.name || options.name || site.siteName,
    description: explicitPage?.description || options.description || site.description || DEFAULT_DESCRIPTION,
    isPartOf: { "@id": websiteId },
    about: explicitPage?.about || { "@id": organizationId },
    inLanguage: explicitPage?.inLanguage || "zh-CN"
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(site, origin),
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: site.siteName,
        url: absoluteUrl(origin, "/"),
        publisher: { "@id": organizationId },
        inLanguage: "zh-CN"
      },
      ...(pageEnabled ? [pageNode, ...extras.filter((node) => node !== explicitPage)] : [])
    ]
  };
}

function publicBrandName(site) {
  const configured = String(site.siteName || "").trim();
  return configured || "企业官网";
}

function publicAsset(site, key) {
  return safeUrl(site?.[key], "image");
}

function brandLockup(site) {
  const brand = publicBrandName(site);
  const logo = publicAsset(site, "brandLogoUrl") || publicAsset(site, "logoUrl");
  if (logo) return `<span class="brand-mark brand-mark-lockup"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand)}" width="116" height="64" decoding="async"></span>`;
  return `<span class="brand-mark brand-mark-text">${escapeHtml(brand)}</span>`;
}

function publicCompanyName(site) {
  const configured = String(site.companyName || "").trim();
  return configured || publicBrandName(site);
}

function pageTitle(site, title = "") {
  const brand = publicBrandName(site);
  return title ? `${title}｜${brand}` : brand;
}

function navigation(site, active = "") {
  // The first public-site version has a deliberate, complete information
  // architecture. CMS navigation labels can replace these later, but missing
  // demo pages must not make the walkthrough look unfinished.
  const publishedPaths = new Set((Array.isArray(site.pages) ? site.pages : []).filter((page) => page?.status === "published").map((page) => String(page.path || "").replace(/\/$/, "") || "/"));
  const cmsItems = Array.isArray(site.navItems) ? site.navItems.filter((item) => {
    if (item?.visible === false || !item?.path) return false;
    const path = String(item.path || "").replace(/\/$/, "") || "/";
    return path === "/insights" ? publishedPaths.has("/insights") : publishedPaths.has(path);
  }) : [];
  const cmsByPath = new Map(cmsItems.map((item) => [String(item.path || "").replace(/\/$/, "") || "/", item]));
  const demoEnabled = demoFixturesEnabled(site);
  const items = demoEnabled
    ? FRONTEND_NAV.map((item) => ({ ...item, label: cmsByPath.get(item.path.replace(/\/$/, "") || "/")?.label || item.label }))
    : cmsItems;
  const normalize = (value) => String(value || "/").replace(/\/index\.html$/i, "/").replace(/\.html$/i, "/").replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const navOrder = new Map([["/", 0], ["/services", 1], ["/about", 2], ["/cases", 3], ["/insights", 4], ["/problem-map", 5], ["/contact", 6]]);
  const activePath = normalize(active);
  const visibleItems = demoEnabled
    ? items.filter((item) => publicFixedPageAvailable(site, item.path))
    : items;
  const orderedItems = [...visibleItems].sort((left, right) => (navOrder.get(normalize(left.path)) ?? 100) - (navOrder.get(normalize(right.path)) ?? 100));
  const primaryPaths = new Set(["/", "/services", "/cases", "/insights", "/about", "/contact"]);
  const aboutLabel = site.footerLabel && site.footerLabel !== "企业" ? `关于${site.footerLabel}` : "关于我们";
  const primaryLabels = new Map([["/", "首页"], ["/services", "产品与服务"], ["/cases", "服务案例"], ["/insights", "行业资讯"], ["/about", aboutLabel], ["/contact", "联系"]]);
  const displayItems = orderedItems.filter((item) => primaryPaths.has(normalize(item.path))).map((item) => ({ ...item, label: primaryLabels.get(normalize(item.path)) || item.label }));
  const brand = publicBrandName(site);
  return `<header class="site-header"><div class="shell nav"><a class="brand" href="/" aria-label="${escapeHtml(brand)}首页">${brandLockup(site)}</a><nav class="nav-links" aria-label="主导航">${displayItems.map((item) => `<a${activePath === normalize(item.path) ? " class=\"active\" aria-current=\"page\"" : ""} href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join("")}</nav><div class="nav-actions"><a class="nav-cta" href="/contact/">预约诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="mobile-navigation"><span></span><span></span><span></span></button></div></div><nav id="mobile-navigation" class="mobile-navigation" aria-label="移动端导航">${displayItems.map((item) => `<a${activePath === normalize(item.path) ? " class=\"active\"" : ""} href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join("")}<a class="mobile-cta" href="/contact/">预约诊断</a></nav></header>`;
}

function footer(site) {
  const contact = site.contact || {};
  const brand = publicBrandName(site);
  const company = publicCompanyName(site);
  const footerLabel = String(site.footerLabel || brand || "企业").trim();
  const icp = String(site.footerIcp || "").trim();
  return `<footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/">${brandLockup(site)}</a><p>把企业事实组织成客户与 AI 都能验证的公开信源。</p>${contact.serviceArea || contact.industryRegion ? `<span class="footer-meta">${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · "))}</span>` : ""}</div><div class="footer-col"><strong>GEO</strong><a href="/services/">服务方法</a><a href="/problem-map/">问题地图</a><a href="/cases/">实施场景</a></div><div class="footer-col"><strong>知识</strong><a href="/insights/">行业资讯</a><a href="/llms.txt">AI 内容索引</a><a href="/feed.xml">RSS 订阅</a></div><div class="footer-col"><strong>${escapeHtml(footerLabel)}</strong><a href="/about/">关于我们</a><a href="/contact/">业务咨询</a>${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : ""}</div></div><div class="shell footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(company)}</span>${icp ? `<a class="footer-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">${escapeHtml(icp)}</a>` : ""}<span>真实 · 清晰 · 可追溯 · 能持续</span></div></footer>`;
}

function directionIcon(direction = "right") {
  const paths = {
    right: '<path d="M4 12h15M14 7l5 5-5 5"/>',
    diagonal: '<path d="M5 19 19 5M10 5h9v9"/>',
    down: '<path d="M12 4v15M7 14l5 5 5-5"/>'
  };
  const safeDirection = paths[direction] ? direction : "right";
  return `<svg class="direction-icon direction-icon-${safeDirection}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[safeDirection]}</svg>`;
}

function renderDirectionalIcons(html = "") {
  return String(html)
    .replaceAll("↗", directionIcon("diagonal"))
    .replaceAll("↓", directionIcon("down"))
    .replaceAll("→", directionIcon("right"));
}

function documentShell({ site, origin, pathname, title, description, active, schemaExtra = [], body, robots = "index,follow,max-image-preview:large,max-snippet:-1", feed = true, preview = false, assetBase = "/site-assets-r6", headLinks = [], openGraphType = "website", headMeta = [], bodyClass = "" }) {
  const canonical = absoluteUrl(origin, pathname);
  const configuredPage = pageForPath(site, pathname);
  const schema = preview ? null : pageSchema(site, origin, pathname, schemaExtra, {
    pageEnabled: configuredPage?.schemaEnabled !== false,
    name: pageTitle(site, title),
    description: description || site.description || DEFAULT_DESCRIPTION
  });
  const primary = /^#[0-9a-f]{6}$/i.test(site.theme?.primaryColor || "") ? site.theme.primaryColor : "#155eef";
  const templateKey = resolveSiteTemplateKey(site.theme?.key || site.template?.key);
  const template = getSiteTemplate(templateKey);
  const metaDescription = description || site.description || DEFAULT_DESCRIPTION;
  const resolvedTitle = pageTitle(site, title);
  const extraLinks = headLinks.filter((item) => item?.rel && item?.href).map((item) => `<link rel="${escapeHtml(item.rel)}" href="${escapeHtml(item.href)}">`).join("");
  const extraMeta = headMeta.filter((item) => item?.content && (item?.name || item?.property)).map((item) => `<meta ${item.property ? `property="${escapeHtml(item.property)}"` : `name="${escapeHtml(item.name)}"`} content="${escapeHtml(item.content)}">`).join("");
  const favicon = publicAsset(site, "brandMarkUrl") || publicAsset(site, "logoUrl");
  const faviconLink = favicon ? `<link rel="icon" type="image/png" href="${escapeHtml(favicon)}">` : "";
  const renderedBody = renderDirectionalIcons(body);
  const runtimeAssetBase = preview ? String(assetBase || "/api/v1/site-cms/preview/assets").replace(/\/+$/, "") : "/site-assets-r9";
  const publicationIdentity = preview ? "" : `<link rel="canonical" href="${escapeHtml(canonical)}">${extraLinks}${feed ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(publicBrandName(site))}行业资讯" href="/feed.xml">` : ""}<meta property="og:title" content="${escapeHtml(resolvedTitle)}"><meta property="og:description" content="${escapeHtml(metaDescription)}"><meta property="og:type" content="${escapeHtml(openGraphType)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="${escapeHtml(publicBrandName(site))}"><meta property="og:locale" content="zh_CN"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(resolvedTitle)}"><meta name="twitter:description" content="${escapeHtml(metaDescription)}">${extraMeta}<script type="application/ld+json">${safeJsonLd(schema)}</script>`;
  return `<!doctype html><html lang="zh-CN" style="--brand:${escapeHtml(primary)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(preview ? `CMS 草稿预览 · ${resolvedTitle}` : resolvedTitle)}</title><meta name="description" content="${escapeHtml(metaDescription)}"><meta name="robots" content="${escapeHtml(preview ? "noindex,nofollow,noarchive,nosnippet,noimageindex" : robots)}"><meta name="author" content="${escapeHtml(publicCompanyName(site))}">${faviconLink}${publicationIdentity}<meta name="theme-color" content="${escapeHtml(template.color)}"><link rel="stylesheet" href="${escapeHtml(runtimeAssetBase)}/site-v8.css?v=20260812-templates1"><style id="site-template-styles">${SITE_TEMPLATE_CSS}</style></head><body class="site-v8 site-template-${escapeHtml(templateKey)}${bodyClass ? ` ${escapeHtml(bodyClass)}` : ""}${preview ? " is-preview" : ""}" data-site-template="${escapeHtml(templateKey)}" data-site-template-name="${escapeHtml(template.name)}"><!--
THESIS: the website behaves like a living enterprise source passport; it refuses generic AI dashboards and decorative futurism.
OWN-WORLD: oxblood leather, smoked black, warm ivory paper, old-gold rules, archival stamps and stitched records.
STORY: visitors identify the enterprise, inspect its GEO method as signed source records, read verified content, then request a source-file review.
FIRST VIEWPORT: a centered open evidence dossier anchors the fold; the offer sits left and a vertical fact-to-source endorsement chain sits right.
FORM: verification passport, approved composition 02; concept seed challenger-passport; user-confirmed on 2026-08-10.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
--><a class="skip-link" href="#main">跳到正文</a>${preview ? `<div class="preview-bar" role="status"><span>CMS 草稿预览</span><b>仅供已登录运营人员查看 · 尚未影响正式官网</b></div>` : ""}${navigation(site, active)}<main id="main">${renderedBody}</main>${footer(site)}<script src="${escapeHtml(runtimeAssetBase)}/site.js?v=20260813-lead-builder1" defer></script><script src="${escapeHtml(runtimeAssetBase)}/gsap.min.js?v=20260810-passport8" defer></script><script src="${escapeHtml(runtimeAssetBase)}/site-v8.js?v=20260810-passport3" defer></script></body></html>`;
}

function pageModules(site, page, preview = false) {
  const values = Array.isArray(site.modules?.[page.id]) ? site.modules[page.id] : [];
  return values.filter((item) => item && item.status !== "hidden" && (preview || item.status !== "draft"));
}

function actionLink(label, href = "/contact/", className = "button primary") {
  return `<a class="${className}" href="${escapeHtml(href)}">${escapeHtml(label)} <span aria-hidden="true">→</span></a>`;
}

function moduleHeading(module, fallbackTitle) {
  return `<div class="section-head"><div>${module.eyebrow ? `<span class="kicker">${escapeHtml(module.eyebrow)}</span>` : ""}<h2>${escapeHtml(module.title || fallbackTitle)}</h2></div>${module.description ? `<p>${escapeHtml(module.description)}</p>` : ""}</div>`;
}

function serviceRows(site, module) {
  const rows = Array.isArray(module.items) && module.items.length ? module.items : (site.businessLines || []).map((line) => ({
    title: line.product || line.name, description: line.description || line.positioning || line.audience || "查看服务内容、适用对象与交付方式。", href: "/contact/"
  }));
  if (rows.length) return rows.slice(0, 8);
  return [
    { title: "企业知识建设", description: "统一企业事实、产品服务、案例与问答，形成可追溯的内容依据。" },
    { title: "内容生产与审核", description: "围绕真实客户问题生产结构清晰、证据明确的企业内容。" },
    { title: "官网与发布运营", description: "将审核内容发布为企业可持续控制的公开信源。" }
  ];
}

function renderContactForm(site, sourcePath) {
  const f = site.leadForm || {};
  if (f.enabled === false) return `<div class="lead-form-disabled"><p>暂未开放在线咨询，请通过页面公开联系方式联系我们。</p></div>`;
  const legacyFields = [
    { key: "name", label: f.nameLabel || "姓名", type: "text", required: true, enabled: true, maximum: 80 },
    { key: "phone", label: f.contactLabel || "联系方式", type: "tel", required: true, enabled: true, maximum: 60 },
    { key: "company", label: f.companyLabel || "企业名称", type: "text", enabled: f.showCompany !== false, maximum: 160 },
    { key: "service", label: f.serviceLabel || "咨询方向", type: "select", enabled: f.showService !== false, dynamicOptions: "business-lines", maximum: 160 },
    { key: "website", label: f.websiteLabel || "企业官网", type: "url", enabled: f.showWebsite === true, placeholder: "https://", maximum: 300 },
    { key: "message", label: f.messageLabel || "需要解决的问题", type: "textarea", enabled: f.showMessage !== false, placeholder: f.messagePlaceholder, maximum: 2_000 }
  ];
  const definitions = (Array.isArray(f.fields) && f.fields.length ? f.fields : legacyFields).filter((field) => field?.enabled !== false).slice(0, 16);
  const renderField = (field) => {
    const key = escapeHtml(field.key);
    const label = `${escapeHtml(field.label || field.key)}${field.required ? " *" : ""}`;
    const required = field.required ? " required" : "";
    const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
    const maximum = Math.max(1, Number(field.maximum) || (field.type === "textarea" ? 2_000 : 160));
    const autocomplete = field.key === "name" ? " autocomplete=\"name\"" : field.key === "phone" ? " autocomplete=\"tel\"" : field.key === "company" ? " autocomplete=\"organization\"" : "";
    if (field.type === "textarea") return `<label class="lead-form-field lead-form-field-wide"><span>${label}</span><textarea name="${key}" rows="5" maxlength="${maximum}"${placeholder}${required}></textarea></label>`;
    if (field.type === "select") {
      const options = [...(Array.isArray(field.options) ? field.options : []), ...(field.dynamicOptions === "business-lines" ? (site.businessLines || []).slice(0, 10).map((line) => line.product || line.name) : [])];
      const unique = [...new Set(options.filter(Boolean))].slice(0, 30);
      return `<label class="lead-form-field"><span>${label}</span><select name="${key}"${required}><option value="">请选择</option>${unique.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
    }
    return `<label class="lead-form-field"><span>${label}</span><input name="${key}" type="${escapeHtml(field.type || "text")}" maxlength="${maximum}"${autocomplete}${placeholder}${required}></label>`;
  };
  return `<form class="lead-form" data-lead-form data-form-version="${escapeHtml(f.version || "legacy")}"><div class="form-grid">${definitions.map(renderField).join("")}</div><input type="hidden" name="source_url" value="${escapeHtml(sourcePath)}"><div class="form-submit"><button class="button ink" type="submit">${escapeHtml(f.submitLabel || "提交咨询")} <span aria-hidden="true">→</span></button><p data-form-message role="status">${escapeHtml([f.responsePromise, f.privacyNotice].filter(Boolean).join("；"))}</p></div></form>`;
}

function renderFixedModule({ site, page, module, articles, index }) {
  const type = module.type || "content";
  if (type === "hero") {
    if (page.id === "home") return `<section class="home-hero" style="--hero-image:linear-gradient(118deg,#0d1b36 0%,#155eef 52%,#24b6b2 100%)"><div class="hero-scrim"></div><div class="shell hero-content"><span class="eyebrow">${escapeHtml(module.eyebrow || "ENTERPRISE GEO OPERATIONS")}</span><h1>${escapeHtml(site.siteName)}</h1><p class="hero-offer">${escapeHtml(module.title && module.title !== "首屏" ? module.title : site.description || module.content)}</p><p>${escapeHtml(module.content || module.description || site.description)}</p><div class="actions">${actionLink(module.ctaLabel || site.cta || "预约业务咨询", module.ctaHref || "/contact/")} ${actionLink("查看产品与服务", "/services/", "button secondary light")}</div></div><div class="hero-proof shell"><span><b>企业知识</b><small>统一事实来源</small></span><span><b>人工审核</b><small>发布前质量门槛</small></span><span><b>公开信源</b><small>官网与机器入口</small></span></div></section>`;
    return `<header class="page-hero"><div class="shell page-hero-grid"><div><span class="eyebrow">${escapeHtml(module.eyebrow || page.type || "OFFICIAL WEBSITE")}</span><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(module.content || page.seoDescription || page.description)}</p></div><div class="page-hero-index" aria-hidden="true"><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(site.siteName)}</span></div></div></header>`;
  }
  if (type === "services") {
    const rows = serviceRows(site, module);
    return `<section class="section services-band"><div class="shell">${moduleHeading(module, "产品与服务")}<div class="service-list">${rows.map((item, rowIndex) => `<article><span>${String(rowIndex + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.content || "")}</p></div><a href="${escapeHtml(item.href || "/contact/")}" aria-label="了解${escapeHtml(item.title)}">→</a></article>`).join("")}</div></div></section>`;
  }
  if (type === "process") {
    const rows = module.items?.length ? module.items : ["需求与资料梳理", "企业知识建设", "内容生产与审核", "官网与平台发布", "效果监测与复盘"].map((title) => ({ title }));
    return `<section class="section process-band"><div class="shell">${moduleHeading(module, "合作流程")}<ol class="process-list">${rows.slice(0, 8).map((item, rowIndex) => `<li><span>${String(rowIndex + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</div></li>`).join("")}</ol></div></section>`;
  }
  if (["proof", "entity", "principles", "boundary"].includes(type)) {
    const contact = site.contact || {};
    const facts = module.items?.length ? module.items : [
      { title: "企业主体", description: site.companyName || site.siteName },
      { title: "服务定位", description: module.content || site.description },
      { title: "服务区域", description: contact.serviceArea || contact.industryRegion || "以实际服务范围为准" }
    ];
    return `<section class="section proof-band"><div class="shell">${moduleHeading(module, module.title)}<div class="fact-grid">${facts.slice(0, 6).map((item) => `<article><span class="fact-mark"></span><small>${escapeHtml(item.title)}</small><p>${escapeHtml(item.description || item.content || "")}</p></article>`).join("")}</div></div></section>`;
  }
  if (["insights", "articles"].includes(type)) {
    return `<section class="section insights-band"><div class="shell">${moduleHeading(module, "最新行业资讯")}<div class="insight-list">${articles.slice(0, 3).map(articleCard).join("") || '<div class="empty-copy"><h3>内容正在建设</h3><p>已审核并发布的文章会自动出现在这里。</p></div>'}</div><div class="section-action">${actionLink("浏览全部行业资讯", "/insights/", "button secondary")}</div></div></section>`;
  }
  if (type === "faq") {
    const rows = module.items || [];
    return `<section class="section faq-band"><div class="shell narrow">${moduleHeading(module, "常见问题")}<div class="faq-list">${rows.length ? rows.map((item, rowIndex) => `<details${rowIndex === 0 ? " open" : ""}><summary>${escapeHtml(item.title)}</summary><p>${escapeHtml(item.description || item.content || "")}</p></details>`).join("") : `<div class="empty-copy"><h3>${escapeHtml(module.title)}</h3><p>${escapeHtml(module.content || module.description)}</p></div>`}</div></div></section>`;
  }
  if (["contact", "form"].includes(type)) {
    const contact = site.contact || {};
    return `<section class="section contact-section"><div class="shell contact-layout"><div class="contact-copy">${moduleHeading(module, "联系我们")}<div class="contact-details">${contact.phone ? `<a href="tel:${escapeHtml(contact.phone)}"><small>联系电话</small><b>${escapeHtml(contact.phone)}</b></a>` : ""}${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}"><small>电子邮箱</small><b>${escapeHtml(contact.email)}</b></a>` : ""}${contact.address ? `<span><small>企业地址</small><b>${escapeHtml(contact.address)}</b></span>` : ""}</div></div>${renderContactForm(site, page.path)}</div></section>`;
  }
  if (type === "cta") {
    return `<section class="contact-band"><div class="shell contact-grid"><div><span class="eyebrow">NEXT STEP</span><h2>${escapeHtml(module.title || site.cta)}</h2><p>${escapeHtml(module.content || module.description || site.description)}</p></div>${actionLink(module.ctaLabel || site.cta || "提交业务咨询", module.ctaHref || "/contact/", "button ink")}</div></section>`;
  }
  return `<section class="section content-band"><div class="shell narrow">${moduleHeading(module, module.title)}<div class="answer-copy"><p>${escapeHtml(module.content || module.description)}</p></div></div></section>`;
}

function moduleOf(site, pageId, type, preview = false) {
  const modules = (Array.isArray(site.modules?.[pageId]) ? site.modules[pageId] : [])
    .filter((item) => item && item.status !== "hidden" && item.status !== "archived" && (preview || item.status !== "draft"));
  return modules.find((item) => item?.type === type) || modules.find((item) => String(item?.id || "").includes(type)) || null;
}

function moduleText(module, fallback) {
  const value = module?.content || module?.description || "";
  return String(value).trim() || fallback;
}

function frontendCategories(site, categories = null) {
  if (Array.isArray(categories)) return categories;
  if (!demoFixturesEnabled(site)) return [];
  return [
    { id: "geo", name: "GEO优化", slug: "geo", description: "企业 GEO 方法、信源建设与 AI 搜索" },
    { id: "enterprise-ai", name: "企业AI落地", slug: "enterprise-ai", description: "企业知识、AI 应用与流程落地" },
    { id: "short-video", name: "短视频运营", slug: "short-video", description: "短视频获客、账号运营与内容策略" }
  ];
}

function frontendArticles(site, articles = []) {
  return articles.length || !demoFixturesEnabled(site) ? articles : FRONTEND_ARTICLES.map((article) => ({ ...article, isDemo: true }));
}

function visibleCmsRecords(records = [], preview = false) {
  return records.filter((item) => item && item.status !== "archived" && (preview || item.status !== "draft"))
    .slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function frontendServices(site, preview = false) {
  if (Array.isArray(site.services)) return visibleCmsRecords(site.services, preview);
  return demoFixturesEnabled(site) ? FRONTEND_SERVICES : [];
}

function frontendCases(site, preview = false) {
  if (Array.isArray(site.cases)) return visibleCmsRecords(site.cases, preview);
  return demoFixturesEnabled(site) ? FRONTEND_CASES : [];
}

function frontendProblemGroups(site, preview = false) {
  if (!Array.isArray(site.problemGroups)) return demoFixturesEnabled(site) ? FRONTEND_PROBLEM_GROUPS : [];
  return visibleCmsRecords(site.problemGroups, preview).map((group) => ({
    ...group,
    questions: visibleCmsRecords(Array.isArray(group.questions) ? group.questions : [], preview)
  })).filter((group) => group.questions.length);
}

function serviceCard(service, index, detailed = false) {
  const href = safeUrl(service.href || "/contact/") || "/contact/";
  const focus = service.cmsFocus || service.focus;
  const meta = [service.audience ? `<span><b>适合对象</b>${escapeHtml(service.audience)}</span>` : "", focus ? `<span><b>工作重点</b>${escapeHtml(focus)}</span>` : ""].join("");
  return `<article class="service-card${detailed ? " service-card-detailed" : ""}" id="${escapeHtml(service.id)}"><div class="service-card-top"><span class="service-label">${escapeHtml(service.eyebrow || "SERVICE")}</span></div><div class="service-card-copy"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p></div>${detailed && meta ? `<div class="service-card-meta">${meta}</div>` : ""}<a class="card-link" href="${escapeHtml(href)}">${detailed ? "讨论这项服务" : "了解服务"}<span aria-hidden="true">↗</span></a></article>`;
}

function compactArticleCard(article) {
  const url = articleLink(article);
  return `<article class="compact-article-card"><div class="compact-article-meta"><span>${escapeHtml(article.categoryName || "行业观点")}</span><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time></div>${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<h3><a href="${escapeHtml(url)}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p><a class="card-link" href="${escapeHtml(url)}">阅读全文<span aria-hidden="true">↗</span></a></article>`;
}

function caseCard(item, index) {
  return `<article class="case-card" data-case-industry="${escapeHtml(item.industry)}"><div class="case-card-head"><small>${escapeHtml(item.industry)} · ${escapeHtml(item.service)}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="case-result"><b>形成结果</b><span>${escapeHtml(item.result)}</span></div></article>`;
}

function problemCard(problem, group) {
  const context = Array.isArray(problem.industries) && problem.industries.length ? problem.industries.slice(0, 2).join(" · ") : group.service;
  return `<a class="problem-card" href="/problem-map/${encodeURIComponent(problem.slug)}/"><span class="problem-card-tag">${escapeHtml(context)}</span><h3>${escapeHtml(problem.title)}</h3><p>${escapeHtml(problem.answer)}</p><span class="card-link">查看直接回答<span aria-hidden="true">↗</span></span></a>`;
}

function processSteps() {
  return [
    { title: "把企业事实说清楚", description: "统一企业主体、产品服务、应用场景、案例与边界。" },
    { title: "从客户问题组织内容", description: "按采购、技术和使用阶段整理真实提问，不从空泛关键词开始。" },
    { title: "让官网成为公开信源", description: "将直接回答、证据与联系入口放进结构清晰、可持续维护的页面。" },
    { title: "审核、发布与复盘", description: "所有对外内容经过人工审核，再按节奏发布并持续复盘。" }
  ];
}

function renderLegacyHomePage({ site, page, articles, categories, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const hero = moduleOf(site, page.id, "hero", preview);
  const contentArticles = frontendArticles(site, articles);
  const groups = frontendProblemGroups(site, preview);
  const FRONTEND_SERVICES = frontendServices(site, preview);
  const FRONTEND_CASES = frontendCases(site, preview);
  const casesPageAvailable = preview || publicFixedPageAvailable(site, "/cases/");
  const featuredProblems = groups.flatMap((group) => group.questions.slice(0, 2).map((problem) => ({ problem, group }))).slice(0, 4);
  const heroDescription = moduleText(hero, "围绕 GEO 服务、企业 AI 落地与短视频运营，建立一套可解释、可审核、可持续的企业公开表达系统。");
  const serviceSummary = FRONTEND_SERVICES.length ? `当前公开 ${FRONTEND_SERVICES.length} 项服务，可从最重要的一项开始。` : "服务内容将在完成审核后公开。";
  const brandName = escapeHtml(publicBrandName(site));
  const casesSection = FRONTEND_CASES.length ? `<section class="section home-cases-v3"><div class="shell"><div class="home-section-heading"><span class="kicker">SERVICE SCENARIOS</span><h2>把复杂的企业现状，<span>拆成可推进的工作。</span></h2><p>每一个实施场景都从企业事实、客户问题与内容节奏出发，明确可交付、可复盘的下一步。</p></div><div class="case-grid home-case-grid">${FRONTEND_CASES.map(caseCard).join("")}</div>${casesPageAvailable ? `<div class="section-action home-section-action"><a class="button secondary" href="/cases/">查看服务案例 <span aria-hidden="true">↗</span></a></div>` : ""}</div></section>` : "";
  const problemsSection = featuredProblems.length ? `<section class="section home-problems-v3"><div class="shell"><div class="home-section-heading home-section-heading-split"><div><span class="kicker">QUESTION MAP</span><h2>从客户真正会问的<span>问题开始。</span></h2></div><p>每个问题都连接直接回答、相关内容和适用服务，让下一步判断更清楚。</p></div><div class="problem-grid home-problem-grid">${featuredProblems.map(({ problem, group }) => problemCard(problem, group)).join("")}</div><div class="home-section-action"><a class="text-link" href="/problem-map/">查看全部问题地图 <span>↗</span></a></div></div></section>` : "";
  const insightsSection = `<section class="section home-insights-v3"><div class="shell"><div class="home-section-heading home-section-heading-split"><div><span class="kicker">INSIGHTS</span><h2>持续回答行业里的<span>关键问题。</span></h2></div><p>围绕客户真实问题，持续发布经过审核的行业内容，沉淀为企业可复用的公开资产。</p></div><div class="compact-article-grid home-article-grid">${contentArticles.slice(0, 3).map(compactArticleCard).join("") || '<div class="empty-copy"><h3>行业内容正在建设</h3><p>通过审核并发布的内容会自动出现在这里。</p></div>'}</div><div class="home-section-action"><a class="text-link" href="/insights/">进入行业资讯 <span>↗</span></a></div></div></section>`;
  const body = `<section class="home-hero-v3"><div class="hero-v3-grid" aria-hidden="true"></div><div class="hero-v3-glow hero-v3-glow-a" aria-hidden="true"></div><div class="hero-v3-glow hero-v3-glow-b" aria-hidden="true"></div><div class="shell home-hero-v3-inner"><div class="home-hero-v3-copy"><span class="hero-v3-kicker"><i aria-hidden="true">✦</i> AI 时代的企业可见性</span><h1>让专业能力，成为<span class="hero-title-line">客户与 AI 的首选答案</span></h1><p>${escapeHtml(heroDescription)}</p><div class="actions hero-v3-actions">${actionLink(site.cta || "获取企业诊断", "/contact/", "button primary")}${actionLink("探索服务方案", "/services/", "button secondary")}</div><div class="hero-v3-tags" aria-label="企业服务重点"><span>企业事实</span><span>问题地图</span><span>内容信源</span><span>持续复盘</span></div></div><div class="ai-pulse-scene" aria-label="企业公开信源工作台示意"><div class="pulse-scene-orbit orbit-one" aria-hidden="true"></div><div class="pulse-scene-orbit orbit-two" aria-hidden="true"></div><div class="pulse-source-pill source-pill-a"><i aria-hidden="true">▣</i><span>官网信源</span></div><div class="pulse-source-pill source-pill-b"><i aria-hidden="true">✦</i><span>行业内容</span></div><div class="pulse-source-pill source-pill-c"><i aria-hidden="true">⌁</i><span>客户问题</span></div><div class="pulse-console"><div class="pulse-console-top"><div><span class="pulse-console-mark">TZ</span><b>${brandName} · Source Pulse</b></div><span class="pulse-console-status"><i></i> 已建立信源</span></div><div class="pulse-console-body"><div class="pulse-query"><small>AI 搜索问题</small><p>怎样让企业的专业服务，被准确理解与选择？</p></div><div class="pulse-answer"><div class="pulse-answer-head"><span>推荐答案结构</span><em>可追溯</em></div><strong>${brandName}</strong><p>以企业事实、服务边界与真实问题为基础，建立可被持续理解的公开表达。</p><div class="pulse-answer-sources"><span><i></i> 企业官网</span><span><i></i> 问题地图</span><span><i></i> 行业内容</span></div></div><div class="pulse-meter"><div><span>事实清晰度</span><b>完整</b><i><em></em></i></div><div><span>内容可引用性</span><b>持续建设</b><i><em></em></i></div></div></div></div><div class="pulse-floating-note"><span>GEO 工作流</span><b>从企业事实到客户答案</b></div></div></div><div class="shell hero-v3-ribbon"><article><span>01</span><div><b>统一企业事实</b><small>让产品、服务与案例说同一种语言</small></div></article><article><span>02</span><div><b>组织客户问题</b><small>让每一份内容回应真实决策</small></div></article><article><span>03</span><div><b>沉淀公开信源</b><small>让专业能力持续被发现与理解</small></div></article></div></section><section class="section home-outcomes-v3"><div class="shell"><div class="home-section-heading home-heading-centered"><span class="kicker">WHY IT MATTERS</span><h2>让企业的公开信源，<span>进入客户的决策路径。</span></h2><p>不是堆砌概念，也不是一次性曝光；而是让客户与 AI 都能够快速读懂、验证并信任企业的专业能力。</p></div><div class="outcome-grid"><article><span class="outcome-icon" aria-hidden="true">⌁</span><h3>被准确理解</h3><p>统一企业主体、服务边界与场景表达，减少信息割裂与理解偏差。</p></article><article><span class="outcome-icon" aria-hidden="true">↗</span><h3>被持续发现</h3><p>用真实客户问题驱动官网与行业内容，让每次发布都有长期价值。</p></article><article><span class="outcome-icon" aria-hidden="true">✦</span><h3>被自然信任</h3><p>让事实、案例与回答彼此印证，形成清晰可信的品牌信源。</p></article></div><div class="outcome-flow" aria-label="企业公开信源形成路径"><span>企业事实</span><i aria-hidden="true">→</i><span>内容与问题</span><i aria-hidden="true">→</i><span>客户理解</span><i aria-hidden="true">→</i><span>业务机会</span></div></div></section><section class="section home-services-v3"><div class="shell"><div class="home-section-heading home-heading-centered"><span class="kicker">CORE CAPABILITIES</span><h2>从被理解，到<span>被选择。</span></h2><p>${escapeHtml(serviceSummary)}</p></div><div class="service-grid home-service-grid">${FRONTEND_SERVICES.map((service, index) => serviceCard(service, index)).join("")}</div></div></section><section class="section home-process-v3"><div class="shell home-process-layout"><div class="home-process-intro"><span class="kicker">HOW WE WORK</span><h2>一套内容，连接企业事实与客户决策。</h2><p>官网、行业资讯、问题地图和服务案例，不是彼此分散的栏目，而是同一套企业事实在不同场景下的表达。</p><a class="button secondary" href="/problem-map/">浏览问题地图 <span aria-hidden="true">↗</span></a></div><ol class="process-steps home-process-steps">${processSteps().map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div><i aria-hidden="true">↗</i></li>`).join("")}</ol></div></section>${casesSection}${problemsSection}${insightsSection}<section class="contact-band home-cta-v3"><div class="shell contact-grid"><div><span class="eyebrow">START WITH THE REAL QUESTION</span><h2>先说说企业现在最想解决的问题。</h2><p>我们会根据企业的业务、资料与目标，判断从哪条服务线开始更合适。</p></div>${actionLink("提交业务咨询", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: "/", title: "", description: site.description, active: "/", schemaExtra: [{ "@type": "WebPage", name: site.siteName, description: site.description }], body: `<span class="sr-only">ENTERPRISE GEO OPERATIONS</span>${body}`, preview, assetBase });
}

function renderHomePage({ site, page, articles, categories, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const hero = moduleOf(site, page.id, "hero", preview);
  const services = frontendServices(site, preview);
  const cases = frontendCases(site, preview);
  const groups = frontendProblemGroups(site, preview);
  const contentArticles = frontendArticles(site, articles);
  const brand = publicBrandName(site);
  const brandMark = publicAsset(site, "brandMarkUrl") || publicAsset(site, "logoUrl");
  const brandMarkOnDark = publicAsset(site, "brandMarkOnDarkUrl") || brandMark;
  const loaderMark = brandMarkOnDark ? `<img src="${escapeHtml(brandMarkOnDark)}" alt="" width="38" height="32">` : "";
  const dossierMark = brandMark ? `<img src="${escapeHtml(brandMark)}" alt="${escapeHtml(brand)}标识" width="48" height="48">` : `<b aria-hidden="true">${escapeHtml(brand.slice(0, 2))}</b>`;
  const brandCode = brand.replace(/[^A-Za-z0-9\p{Script=Han}]/gu, "").slice(0, 3).toLocaleUpperCase("en-US") || "ENT";
  // A private customer may have a business line before they have created a
  // separate CMS service record. Keep the public identity specific to that
  // customer instead of falling back to the generic product label.
  const coreService = services[0]?.title
    || site.businessLines?.[0]?.product
    || site.businessLines?.[0]?.name
    || "企业服务";
  const heroDescription = moduleText(hero, site.description || "为企业建立一张可被搜索、理解和引用的数字身份证，统一企业主体、产品服务、客户问题与公开信源。");
  const featuredQuestions = groups.flatMap((group) => group.questions.slice(0, 1).map((problem) => ({ problem, group }))).slice(0, 3);
  const serviceRows = services.slice(0, 3).map((service) => `<article class="corp-service-row"><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p><small>适合：${escapeHtml(service.audience || "需要建立公开信源的企业")}</small></div><a href="${escapeHtml(service.href || "/services/")}" aria-label="了解${escapeHtml(service.title)}">了解服务 <span aria-hidden="true">→</span></a></article>`).join("");
  const caseRows = cases.slice(0, 3).map((item) => `<article class="corp-case-item"><div><span>${escapeHtml(item.industry || item.service || "企业服务")}</span><h3>${escapeHtml(item.title)}</h3></div><p>${escapeHtml(item.summary)}</p><strong>${escapeHtml(item.result)}</strong></article>`).join("");
  const questionRows = featuredQuestions.map(({ problem, group }) => `<a class="corp-question-row" href="/problem-map/${encodeURIComponent(problem.slug)}/"><span>${escapeHtml(group.service)}</span><h3>${escapeHtml(problem.title)}</h3><i aria-hidden="true">→</i></a>`).join("");
  const articleRows = contentArticles.slice(0, 3).map((article) => `<a class="corp-article-row" href="${escapeHtml(articleLink(article))}"><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><div><span>${escapeHtml(article.categoryName || "行业观点")}</span>${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.excerpt)}</p></div><i aria-hidden="true">→</i></a>`).join("");
  const body = `<span class="sr-only">ENTERPRISE GEO OPERATIONS</span><div class="identity-loader" data-identity-loader aria-label="正在建立企业公开关系图谱">
      <div class="identity-loader-top"><span class="loader-brand">${loaderMark}<b>${escapeHtml(brand)} GEO</b></span><button type="button" data-loader-skip>跳过动画</button></div>
      <div class="identity-loader-stage">
        <div class="obsidian-graph-loader" data-obsidian-graph aria-hidden="true">
          <div class="obsidian-graph-aura"></div>
          <svg viewBox="0 0 1000 620" role="presentation">
            <g class="obsidian-graph-edges obsidian-graph-edges-primary">
              <path data-loader-line data-depth="1" d="M500 310 L276 178"/>
              <path data-loader-line data-depth="1" d="M500 310 L724 150"/>
              <path data-loader-line data-depth="1" d="M500 310 L786 355"/>
              <path data-loader-line data-depth="1" d="M500 310 L650 504"/>
              <path data-loader-line data-depth="1" d="M500 310 L330 494"/>
            </g>
            <g class="obsidian-graph-edges obsidian-graph-edges-secondary">
              <path data-loader-line data-depth="2" d="M276 178 L151 101"/><path data-loader-line data-depth="2" d="M276 178 L276 62"/><path data-loader-line data-depth="2" d="M276 178 L142 246"/>
              <path data-loader-line data-depth="2" d="M724 150 L862 84"/><path data-loader-line data-depth="2" d="M724 150 L874 214"/><path data-loader-line data-depth="2" d="M724 150 L604 61"/>
              <path data-loader-line data-depth="2" d="M786 355 L916 312"/><path data-loader-line data-depth="2" d="M786 355 L910 440"/><path data-loader-line data-depth="2" d="M786 355 L662 326"/>
              <path data-loader-line data-depth="2" d="M650 504 L793 548"/><path data-loader-line data-depth="2" d="M650 504 L613 592"/><path data-loader-line data-depth="2" d="M650 504 L510 557"/>
              <path data-loader-line data-depth="2" d="M330 494 L211 579"/><path data-loader-line data-depth="2" d="M330 494 L105 460"/><path data-loader-line data-depth="2" d="M330 494 L238 382"/>
            </g>
            <g class="obsidian-graph-edges obsidian-graph-edges-cross">
              <path data-loader-line data-depth="3" d="M276 178 Q488 34 724 150"/><path data-loader-line data-depth="3" d="M724 150 Q860 220 786 355"/><path data-loader-line data-depth="3" d="M786 355 Q760 468 650 504"/><path data-loader-line data-depth="3" d="M650 504 Q488 596 330 494"/><path data-loader-line data-depth="3" d="M330 494 Q166 337 276 178"/>
              <path class="obsidian-signal-line" data-loader-line data-depth="3" d="M90 313 C136 313 142 280 181 280 S228 344 273 344 321 274 365 274 413 329 458 329 504 249 550 249 598 342 644 342 689 291 735 291 782 326 828 326 874 277 932 277"/>
            </g>
            <g class="obsidian-graph-nodes">
              <g class="obsidian-node obsidian-node-core" data-loader-node data-depth="0" transform="translate(500 310)"><circle class="obsidian-node-halo" r="39"/><circle r="20"/><text y="45">${escapeHtml(brand)}</text><text class="obsidian-node-caption" y="66">ENTERPRISE ENTITY</text></g>
              <g class="obsidian-node obsidian-node-primary" data-loader-node data-depth="1" transform="translate(276 178)"><circle r="12"/><text x="-19" y="-19" text-anchor="end">企业信息</text></g>
              <g class="obsidian-node obsidian-node-primary" data-loader-node data-depth="1" transform="translate(724 150)"><circle r="12"/><text x="19" y="-17">产品服务</text></g>
              <g class="obsidian-node obsidian-node-primary" data-loader-node data-depth="1" transform="translate(786 355)"><circle r="12"/><text x="20" y="5">客户问题</text></g>
              <g class="obsidian-node obsidian-node-primary" data-loader-node data-depth="1" transform="translate(650 504)"><circle r="12"/><text x="17" y="27">公开信源</text></g>
              <g class="obsidian-node obsidian-node-primary" data-loader-node data-depth="1" transform="translate(330 494)"><circle r="12"/><text x="-18" y="27" text-anchor="end">客户答案</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(151 101)"><circle r="6"/><text x="-13" y="-10" text-anchor="end">企业名称</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(276 62)"><circle r="5"/><text x="0" y="-14" text-anchor="middle">服务边界</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(142 246)"><circle r="5"/><text x="-13" y="5" text-anchor="end">主体信息</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(862 84)"><circle r="6"/><text x="13" y="-8">核心业务</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(874 214)"><circle r="5"/><text x="14" y="5">应用场景</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(604 61)"><circle r="5"/><text x="-12" y="-10" text-anchor="end">产品资料</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(916 312)"><circle r="6"/><text x="15" y="-7">采购问题</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(910 440)"><circle r="5"/><text x="14" y="8">技术问题</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(662 326)"><circle r="5"/><text x="-13" y="-8" text-anchor="end">使用问题</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(793 548)"><circle r="6"/><text x="14" y="9">企业官网</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(613 592)"><circle r="5"/><text x="0" y="-14" text-anchor="middle">行业内容</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(510 557)"><circle r="5"/><text x="-13" y="11" text-anchor="end">正式出处</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(211 579)"><circle r="6"/><text x="-13" y="10" text-anchor="end">AI 理解</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(105 460)"><circle r="5"/><text x="-13" y="5" text-anchor="end">客户决策</text></g>
              <g class="obsidian-node obsidian-node-secondary" data-loader-node data-depth="2" transform="translate(238 382)"><circle r="5"/><text x="-13" y="-9" text-anchor="end">可信引用</text></g>
            </g>
          </svg>
        </div>
        <p class="identity-loader-status"><span data-loader-status>正在识别企业主体</span><i class="identity-loader-status-dot" aria-hidden="true"></i></p>
      </div>
      <div class="identity-loader-foot"><span>ENTERPRISE · QUESTIONS · SOURCES · ANSWERS</span><span>建立可被客户与 AI 理解的企业身份</span></div>
    </div><div class="corp-home">
    <section class="passport-hero">
      <div class="passport-atmosphere" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="shell passport-hero-layout">
        <div class="passport-hero-copy">
          <h1>让客户和 AI，<br><strong>先认准你的企业。</strong></h1>
          <p class="passport-lead">${escapeHtml(heroDescription)}</p>
          <div class="passport-actions"><a class="passport-button passport-button-primary" href="/contact/">开始 GEO 诊断 <span aria-hidden="true">→</span></a><a class="passport-button passport-button-secondary" href="#source-passport">看懂数字身份证 <span aria-hidden="true">↓</span></a></div>
          <p class="passport-note">把企业主体、产品服务、客户问题与公开出处整理成一张可持续更新的数字身份证。</p>
        </div>
        <div class="passport-dossier identity-dossier" id="source-passport" aria-label="${escapeHtml(brand)}企业数字身份证示意">
          <div class="identity-dossier-top"><span>${escapeHtml(brandCode)} / GEO / DIGITAL ID</span><b><i></i>可被理解</b></div>
          <div class="identity-dossier-main">
            <article class="identity-profile">
              <header><span>企业数字身份证</span><b>V.2026</b></header>
              <div class="identity-profile-head"><div class="identity-logo-ring">${dossierMark}</div><div><small>ENTERPRISE ENTITY</small><h2>${escapeHtml(brand)}</h2><p>GEO / 企业公开信源</p></div></div>
              <div class="identity-score"><div class="identity-score-ring"><strong>GEO</strong><small>身份档案</small></div><div><b>统一企业对外身份</b><p>让企业主体、服务边界、客户问题和正式出处保持同一套表达。</p></div></div>
              <div class="identity-stat-grid"><div><b>主体信息</b><span>名称 · 业务 · 边界</span></div><div><b>客户问题</b><span>采购 · 技术 · 使用</span></div><div><b>公开信源</b><span>官网 · 内容 · 出处</span></div></div>
              <dl class="identity-fields"><div><dt>核心业务</dt><dd>${escapeHtml(coreService)}</dd></div><div><dt>身份状态</dt><dd>可持续维护</dd></div><div><dt>使用场景</dt><dd>客户搜索与 AI 问答</dd></div></dl>
            </article>
          </div>
          <div class="identity-dossier-bottom"><span>企业主体与服务边界</span><span>客户问题与内容回应</span><span>公开出处与持续复盘</span></div>
        </div>
      </div>
      <div class="shell passport-summary" aria-label="企业数字身份证的三项核心内容"><div><span>ENTITY</span><strong>企业信息</strong><small>让主体与业务边界保持一致</small></div><div><span>QUESTION</span><strong>客户问题</strong><small>让内容回应真实决策过程</small></div><div><span>SOURCE</span><strong>公开信源</strong><small>让答案回到正式出处</small></div></div>
    </section><section class="corp-section corp-method">
      <div class="shell corp-split-heading"><h2>GEO 不是多写几篇文章，<br>而是建立一条可信的答案链。</h2><p>从业务问题开始，把企业事实拆成可以引用、验证和持续更新的公开信源。客户能看懂，AI 也更容易准确理解。</p></div>
      <div class="shell corp-evidence-track" aria-label="${escapeHtml(brand)} GEO 方法"><div><span>业务问题</span><p>从采购、技术与使用场景确认真实提问</p></div><i aria-hidden="true">→</i><div><span>企业事实</span><p>整理产品、服务、案例与适用边界</p></div><i aria-hidden="true">→</i><div><span>公开信源</span><p>组织成官网、问题页与行业内容</p></div><i aria-hidden="true">→</i><div><span>持续验证</span><p>重复采样、纠错并复盘引用变化</p></div></div>
    </section>

    <section class="corp-section corp-services">
      <div class="shell corp-section-top"><div><h2>从诊断开始，逐步形成企业增长闭环。</h2><p>不需要一次做完全部能力。先找到关键缺口，再选择最值得推进的一条服务线。</p></div><a href="/services/">查看完整服务方案 <span aria-hidden="true">→</span></a></div>
      <div class="shell corp-service-list">${serviceRows}</div>
    </section>

    ${caseRows ? `<section class="corp-section corp-cases"><div class="shell corp-section-top"><div><h2>把复杂现状，拆成可以推进的工作。</h2><p>用典型实施场景说明我们如何从事实、问题和内容开始。</p></div><a href="/cases/">查看案例成果 <span aria-hidden="true">→</span></a></div><div class="shell corp-case-list">${caseRows}</div></section>` : ""}

    <section class="corp-section corp-knowledge"><div class="shell corp-knowledge-grid"><div class="corp-knowledge-intro"><h2>持续回答企业客户真正关心的问题。</h2><p>问题地图与行业观点共同构成公开知识入口，让每一篇内容都能回到真实业务。</p><a class="corp-button corp-button-secondary" href="/problem-map/">进入问题地图 <span aria-hidden="true">→</span></a></div><div class="corp-question-list">${questionRows || "<p>问题地图正在建设。</p>"}</div></div></section>

    <section class="corp-section corp-insights"><div class="shell corp-section-top"><div><h2>最新行业观点</h2><p>围绕客户问题、产品资料与应用场景，整理可回到业务事实的行业内容。</p></div><a href="/insights/">进入行业资讯 <span aria-hidden="true">→</span></a></div><div class="shell corp-article-list">${articleRows || "<p>行业内容正在建设。</p>"}</div></section>

    <section class="corp-contact"><div class="shell corp-contact-layout"><div><h2>先看清企业现在最该解决的问题。</h2><p>提交企业现状后，我们会先确认诊断范围、所需资料与交付边界。可在提交前沟通保密方式，不强制采购后续服务。</p></div><a class="corp-button corp-button-light" href="/contact/">提交业务咨询 <span aria-hidden="true">→</span></a></div></section>
  </div>`;
  const description = site.description || `${brand}企业官网。`;
  return documentShell({ site, origin, pathname: "/", title: "", description, active: "/", schemaExtra: [{ "@type": "WebPage", name: brand, description }], body, preview, assetBase, bodyClass: "corp-home-page" });
}

function renderServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const hero = moduleOf(site, page.id, "hero", preview);
  const FRONTEND_SERVICES = frontendServices(site, preview).map((service) => ({ ...service, cmsFocus: service.focus }));
  const body = `<header class="page-hero page-hero-v2 page-hero-dark"><div class="shell page-hero-v2-inner"><span class="eyebrow">SERVICES / 解决方案</span><h1>让企业的专业能力，被正确理解。</h1><p>${escapeHtml(moduleText(hero, site.description || "查看企业正式公开的产品服务、适用对象与交付边界。"))}</p><div class="hero-tag-row">${FRONTEND_SERVICES.slice(0, 3).map((service) => `<span>${escapeHtml(service.title)}</span>`).join("")}</div></div></header><section class="section services-detail-section"><div class="shell"><div class="section-head section-head-v2"><div><span class="kicker">服务能力</span><h2>可以从一项服务开始，也可以逐步形成闭环。</h2></div><p>服务范围、资料边界和交付方式会在项目开始前明确，不用模糊承诺代替具体工作。</p></div><div class="service-detail-list">${FRONTEND_SERVICES.map((service, index) => serviceCard({ ...service, focus: service.focus || "服务内容、适用条件与交付边界" }, index, true)).join("")}</div></div></section><section class="section service-method-section"><div class="shell service-method-layout"><div><span class="kicker">交付原则</span><h2>不承诺无法验证的结果，只交付可继续运营的系统。</h2></div><div class="principle-grid"><article><b>事实优先</b><p>所有公开表达都以企业资料、业务人员和可核验来源为依据。</p></article><article><b>问题优先</b><p>内容从客户在采购、技术和使用阶段的真实问题开始。</p></article><article><b>审核优先</b><p>文章、案例和官网内容经过人工审核后，才进入正式发布版本。</p></article><article><b>长期运营</b><p>每一次发布都沉淀为下一轮选题、知识和效果复盘的依据。</p></article></div></div></section><section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Make the next step clear</span><h2>不知道先从哪一项开始？</h2><p>提交企业现状，我们会结合公开服务范围判断适合的下一步。</p></div>${actionLink("预约一次业务沟通", "/contact/", "button ink")}</div></section>`;
  const serviceTags = `<div class="hero-tag-row">${FRONTEND_SERVICES.slice(0, 3).map((service, index) => `<span>${escapeHtml(service.title)}${index === 0 ? "（主业务）" : ""}</span>`).join("")}</div>`;
  const serviceHeading = FRONTEND_SERVICES.length ? `${FRONTEND_SERVICES.length} 项服务` : "服务内容";
  const renderedBody = body.replace(/<div class="hero-tag-row">[\s\S]*?<\/div>/, serviceTags).replace("三条服务线", serviceHeading);
  const schemaExtra = FRONTEND_SERVICES.map((service) => ({
    "@type": "Service",
    "@id": `${absoluteUrl(origin, `/services/#${encodeURIComponent(service.id)}`)}`,
    name: service.title,
    description: service.description,
    audience: service.audience || undefined,
    provider: { "@id": entityId(origin, "organization") }
  }));
  return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || "产品与服务", description: page.seoDescription || site.description, active: "/services/", schemaExtra, body: renderedBody, preview, assetBase });
}

function renderCasesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const FRONTEND_CASES = frontendCases(site, preview);
  const industries = [...new Set(FRONTEND_CASES.map((item) => String(item.industry || "").trim()).filter(Boolean))];
  const body = `<header class="page-hero page-hero-v2"><div class="shell page-hero-v2-inner"><span class="eyebrow">CASES / 典型实施场景</span><h1>把复杂的企业问题，拆成可以推进的工作。</h1><p>公开案例需要经过客户授权、脱敏和人工审核。第一版先用典型场景展示我们如何从企业事实、客户问题和内容运营开始。</p></div></header><section class="section cases-list-section"><div class="shell"><div class="case-filter" data-case-filter><button class="is-active" type="button" data-case-value="all">全部场景</button><button type="button" data-case-value="工业品">工业品</button><button type="button" data-case-value="制造业">制造业</button><button type="button" data-case-value="中小企业">中小企业</button></div><div class="case-grid case-grid-wide">${FRONTEND_CASES.map((item, index) => caseCard(item, index)).join("")}</div></div></section><section class="section case-note-section"><div class="shell case-note"><span class="kicker">Case note</span><h2>案例不是结果数字的堆叠，而是可复用的方法。</h2><p>正式案例页会由官网 CMS 管理客户授权、项目阶段、实施内容、公开证据和关联服务。每一条内容都要能够回到企业事实。</p><a class="button secondary" href="/contact/">讨论你的业务场景 <span aria-hidden="true">↗</span></a></div></section>`;
  const filters = `<div class="case-filter" data-case-filter><button class="is-active" type="button" data-case-value="all">全部场景</button>${industries.map((industry) => `<button type="button" data-case-value="${escapeHtml(industry)}">${escapeHtml(industry)}</button>`).join("")}</div>`;
  const renderedBody = body.replace(/<div class="case-filter" data-case-filter>[\s\S]*?<\/div><div class="case-grid case-grid-wide">/, `${filters}<div class="case-grid case-grid-wide">`)
    .replace("第一版先用典型场景展示我们如何从企业事实、客户问题和内容运营开始。", `当前展示 ${FRONTEND_CASES.length} 个典型实施场景（演示内容，非客户案例）。`)
    .replace("正式案例页会由官网 CMS 管理客户授权、项目阶段、实施内容、公开证据和关联服务。每一条内容都要能够回到企业事实。", "每个案例都说明业务场景、实施内容与形成结果，帮助企业判断方法是否适合自身情况。");
  const schemaExtra = [{ "@type": "CollectionPage", name: page.title || "服务案例", mainEntity: { "@type": "ItemList", numberOfItems: FRONTEND_CASES.length, itemListElement: FRONTEND_CASES.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title })) } }];
  return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || "服务案例", description: page.seoDescription || "查看企业服务案例与典型实施路径。", active: "/cases/", schemaExtra, body: renderedBody, preview, assetBase });
}

function renderProblemMapPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const groups = frontendProblemGroups(site, preview);
  const allProblems = groups.flatMap((group) => group.questions.map((problem) => ({ problem, group })));
  const body = `<header class="page-hero page-hero-v2 page-hero-dark"><div class="shell page-hero-v2-inner"><span class="eyebrow">PROBLEM MAP / 客户问题地图</span><h1>从客户的真实问题，开始理解企业。</h1><p>问题地图不是 FAQ 列表，而是把客户在不同决策阶段的提问，连接到直接回答、行业资讯、服务方法与咨询入口。</p><div class="hero-tag-row"><span>按服务方向组织</span><span>按行业场景筛选</span><span>每个问题有下一步</span></div></div></header><section class="section problem-map-section"><div class="shell"><div class="problem-map-intro"><div><span class="kicker">问题总览</span><h2>客户正在问什么</h2></div><p>这里先展示前端演示问题。正式上线后，公开问题将由 CMS 审核并与已发布文章关联。</p></div><div class="problem-map-groups">${groups.map((group) => `<section class="problem-group" id="${escapeHtml(group.id)}"><div class="problem-group-head"><div><span class="kicker">${escapeHtml(group.service)}</span><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.description)}</p></div></div><div class="problem-grid">${group.questions.map((problem) => problemCard(problem, group)).join("")}</div></section>`).join("")}</div></div></section><section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Have a specific question?</span><h2>没有找到你的问题？</h2><p>把企业现状和具体场景告诉我们，我们会从问题本身判断下一步如何梳理。</p></div>${actionLink("提交企业问题", "/contact/", "button ink")}</div></section>`;
  const renderedBody = body.replace("这里先展示前端演示问题。正式上线后，公开问题将由 CMS 审核并与已发布文章关联。", "每个问题都提供直接回答，并连接到相关行业内容和适用服务。");
  const schemaExtra = [{
    "@type": "FAQPage",
    name: page.title || "客户问题地图",
    mainEntity: allProblems.map(({ problem }) => ({
      "@type": "Question",
      "@id": `${absoluteUrl(origin, `/problem-map/${encodeURIComponent(problem.slug)}/`)}#question`,
      name: problem.title,
      acceptedAnswer: { "@type": "Answer", "@id": `${absoluteUrl(origin, `/problem-map/${encodeURIComponent(problem.slug)}/`)}#answer`, text: problem.answer }
    }))
  }];
  return documentShell({ site, origin, pathname: page.path || "/problem-map/", title: page.title || "问题地图", description: page.seoDescription || "按服务方向与行业查看企业客户常见问题及直接回答。", active: "/problem-map/", schemaExtra, body: renderedBody, preview, assetBase });
}

function renderAboutPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const contact = site.contact || {};
  const services = frontendServices(site, preview);
  const cases = frontendCases(site, preview);
  const serviceDirection = services.map((service, index) => `${service.title}${index === 0 ? "（核心业务）" : ""}`).join("；") || "企业服务";
  const audiences = [...new Set(services.map((service) => service.audience).filter(Boolean))].join("；") || "需要了解企业产品、服务和交付边界的客户";
  const industries = [...new Set(cases.map((item) => item.industry).filter(Boolean))].join("、");
  const positioning = industries ? `围绕${industries}等业务场景，我们把企业资料、客户问题、公开内容和官网运营放进同一套可审核的工作方法里。` : "我们把企业资料、客户问题、公开内容和官网运营放进同一套可审核的工作方法里。";
  const body = `<header class="page-hero page-hero-v2"><div class="shell page-hero-v2-inner"><span class="eyebrow">ABOUT / 关于我们</span><h1>我们关注的，不是内容数量，而是企业能否被准确理解。</h1><p>${escapeHtml(site.description || "持续建设清晰、可信并可维护的企业公开信息。")}</p></div></header><section class="section about-story-section"><div class="shell about-story-grid"><div><span class="kicker">我们的定位</span><h2 class="about-position-title"><span>企业公开信息</span><span>产品服务展示</span><span>行业内容中心</span></h2></div><div class="about-story-copy"><p>${escapeHtml(positioning)}</p><p>官网应该让客户快速看懂企业是谁、提供什么、适用边界是什么，以及下一步如何联系。</p></div></div></section><section class="section about-principles-section"><div class="shell"><div class="section-head section-head-v2"><div><span class="kicker">我们的工作原则</span><h2>真实、清晰、可追溯、能持续。</h2></div><p>这四个词决定每一个页面、问题回答与公开内容如何被整理和审核。</p></div><div class="principle-grid principle-grid-large"><article><span>01</span><b>真实</b><p>不凭空补充企业能力，不用无法验证的客户结果替代事实。</p></article><article><span>02</span><b>清晰</b><p>直接回答客户问题，减少概念堆叠和跨页面的信息断裂。</p></article><article><span>03</span><b>可追溯</b><p>文章、案例和服务说明都能回到企业资料与审核版本。</p></article><article><span>04</span><b>能持续</b><p>把一次项目沉淀为企业后续可以继续运营的内容资产。</p></article></div></div></section><section class="section about-facts-section"><div class="shell about-facts"><div><span class="kicker">公开企业信息</span><h2>${escapeHtml(site.companyName || site.siteName)}</h2><p>${escapeHtml(site.description || "企业公开信息与服务说明。")}</p></div><dl><div><dt>服务对象</dt><dd>${escapeHtml(audiences)}</dd></div><div><dt>服务方向</dt><dd>${escapeHtml(serviceDirection)}</dd></div>${contact.serviceArea || contact.industryRegion ? `<div><dt>服务区域</dt><dd>${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · "))}</dd></div>` : ""}</dl></div></section><section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Work from the facts</span><h2>从企业真实情况开始沟通。</h2></div>${actionLink("联系我们", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || site.description, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: "关于我们" }], body, preview, assetBase });
}

function renderContactPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const contact = site.contact || {};
  const body = `<header class="page-hero page-hero-v2 page-hero-dark"><div class="shell page-hero-v2-inner"><span class="eyebrow">CONTACT / 联系我们</span><h1>把问题说清楚，下一步就会更明确。</h1><p>请留下企业名称、联系方式和希望解决的问题。我们会先了解业务背景，再判断适合从哪条服务线开始。</p></div></header><section class="section contact-section contact-section-v2"><div class="shell contact-layout"><div class="contact-copy"><span class="kicker">咨询方式</span><h2>一次有准备的业务沟通。</h2><p>建议在留言里说明企业所在行业、主要产品或服务、当前遇到的问题，以及希望达到的目标。</p><div class="contact-details">${contact.phone ? `<a href="tel:${escapeHtml(contact.phone)}"><small>联系电话</small><b>${escapeHtml(contact.phone)}</b></a>` : `<span><small>联系电话</small><b>提交表单后由运营人员联系</b></span>`}${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}"><small>电子邮箱</small><b>${escapeHtml(contact.email)}</b></a>` : ""}${contact.address ? `<span><small>企业地址</small><b>${escapeHtml(contact.address)}</b></span>` : ""}</div><div class="contact-checklist"><span>先了解企业现状</span><span>判断问题所在环节</span><span>给出可执行的下一步</span></div></div>${renderContactForm(site, page.path || "/contact/")}</div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/contact/", title: page.title || "联系我们", description: page.seoDescription || "联系企业并提交业务咨询。", active: "/contact/", schemaExtra: [{ "@type": "ContactPage", name: "联系我们" }], body, preview, assetBase });
}

export function findFrontendArticle(slug, site = null) {
  if (site ? !demoFixturesEnabled(site) : process.env.NODE_ENV === "production" || !explicitFrontendDemoRequested()) return null;
  const value = normalizeArticleSlug(slug);
  return FRONTEND_ARTICLES.find((item) => normalizeArticleSlug(item.slug) === value) || null;
}

export function findFrontendProblem(slug, site = null) {
  if (site ? !demoFixturesEnabled(site) : process.env.NODE_ENV === "production" || !explicitFrontendDemoRequested()) return null;
  const value = normalizeArticleSlug(slug);
  for (const group of FRONTEND_PROBLEM_GROUPS) {
    const problem = group.questions.find((item) => normalizeArticleSlug(item.slug) === value);
    if (problem) return { problem, group };
  }
  return null;
}

export function findSiteProblem(site, slug, { preview = false } = {}) {
  const value = normalizeArticleSlug(slug);
  for (const group of frontendProblemGroups(site || {}, preview)) {
    const problem = (group.questions || []).find((item) => normalizeArticleSlug(item.slug) === value);
    if (problem) return { problem, group };
  }
  return null;
}

export function renderProblemPage({ site, problem, group, articles = [], origin, preview = false, assetBase = "/site-assets-r6" }) {
  const articleSource = frontendArticles(site, articles);
  const relatedIds = new Set(Array.isArray(problem.relatedArticleIds) ? problem.relatedArticleIds : []);
  const related = articleSource.filter((item) => relatedIds.size ? relatedIds.has(item.id) : item.categorySlug === group.id).slice(0, 3);
  const canonicalPath = `/problem-map/${encodeURIComponent(problem.slug)}/`;
  const questionId = `${absoluteUrl(origin, canonicalPath)}#question`;
  const schemaExtra = [{
    "@type": "WebPage",
    mainEntity: {
      "@type": "Question",
      "@id": questionId,
      name: problem.title,
      answerCount: 1,
      acceptedAnswer: { "@type": "Answer", "@id": `${absoluteUrl(origin, canonicalPath)}#answer`, text: problem.answer }
    }
  }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: origin }, { "@type": "ListItem", position: 2, name: "问题地图", item: absoluteUrl(origin, "/problem-map/") }, { "@type": "ListItem", position: 3, name: problem.title, item: absoluteUrl(origin, canonicalPath) }] }];
  const body = `<header class="problem-detail-hero"><div class="shell"><a class="breadcrumb" href="/problem-map/">问题地图</a><span class="kicker">${escapeHtml(group.service)}</span><h1>${escapeHtml(problem.title)}</h1><p>这是客户在企业决策过程中经常提出的问题。下面先给出直接回答，再说明适用边界和下一步。</p></div></header><section class="problem-detail-main"><div class="shell problem-detail-layout"><article><section class="direct-answer"><span class="direct-answer-label">直接回答</span><p>${escapeHtml(problem.answer)}</p></section><section class="problem-detail-copy"><h2>这个问题为什么重要</h2><p>客户提出的问题，往往比企业自我介绍更接近真实决策。把问题说清楚，才能让官网、文章和服务说明围绕同一套事实展开。</p><h2>建议从哪里开始</h2><ol><li>确认企业主体、产品服务和应用场景。</li><li>补充采购、技术和使用阶段的具体判断条件。</li><li>用一篇结构清晰的行业文章回答问题，并回链到服务与联系方式。</li></ol></section></article><aside class="problem-detail-aside"><div><span>所属服务</span><b>${escapeHtml(group.service)}</b></div><div><span>适用行业</span><b>${escapeHtml((problem.industries || []).join(" · "))}</b></div><a class="button primary" href="/contact/">围绕这个问题咨询</a></aside></div></section>${related.length ? `<section class="section white"><div class="shell"><div class="section-head"><div><span class="kicker">Related insights</span><h2>继续阅读</h2></div><p>查看同一服务方向下的行业内容。</p></div><div class="compact-article-grid">${related.map(compactArticleCard).join("")}</div></div></section>` : ""}<section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Need a more specific answer?</span><h2>把你的企业场景告诉我们。</h2></div>${actionLink("提交业务问题", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: canonicalPath, title: problem.title, description: problem.answer, active: "/problem-map/", schemaExtra, body, preview, assetBase });
}

export function renderFixedPage({ site, page, articles = [], categories = [], origin, preview = false, assetBase = "/site-assets-r6" }) {
  const configuredPage = pageForPath(site, page?.path || "/");
  if (!configuredPage && ["cases", "problem-map"].includes(page?.id) && !demoFixturesEnabled(site)) {
    return renderNotFound({ site, origin, pathname: page?.path || "/" });
  }
  if (page?.id === "home") return renderHomePage({ site, page, articles, categories, origin, preview, assetBase });
  if (page?.id === "services") return renderServicesPage({ site, page, origin, preview, assetBase });
  if (page?.id === "cases") return renderCasesPage({ site, page, origin, preview, assetBase });
  if (page?.id === "problem-map") return renderProblemMapPage({ site, page, origin, preview, assetBase });
  if (page?.id === "about") return renderAboutPage({ site, page, origin, preview, assetBase });
  if (page?.id === "contact") return renderContactPage({ site, page, origin, preview, assetBase });
  const modules = pageModules(site, page, preview);
  const source = modules.length ? modules : [{ id: `${page.id}-fallback`, type: "hero", title: page.title, content: page.seoDescription || page.description, status: "published" }];
  const body = source.map((module, index) => renderFixedModule({ site, page, module, articles, categories, index })).join("");
  const canonical = absoluteUrl(origin, page.path);
  const type = page.id === "about" ? "AboutPage" : page.id === "contact" ? "ContactPage" : page.id === "faq" ? "FAQPage" : page.id === "insights" ? "CollectionPage" : "WebPage";
  const schemaExtra = [{ "@type": type, "@id": canonical, url: canonical, name: page.title, description: page.seoDescription || page.description, isPartOf: { "@id": entityId(origin, "website") }, about: { "@id": entityId(origin, "organization") } }];
  if (page.path !== "/") schemaExtra.push({ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: origin }, { "@type": "ListItem", position: 2, name: page.title, item: canonical }] });
  return documentShell({ site, origin, pathname: page.path, title: page.path === "/" ? "" : page.title, description: page.seoDescription || page.description, active: page.path, schemaExtra, body, preview, assetBase });
}

function categoryLink(category) { return `/insights/category/${encodeURIComponent(category.slug)}/`; }
function articleLink(article) { return `/insights/${encodeURIComponent(article.slug)}/`; }

function articleMeta(article) {
  return `<div class="blog-meta"><span>${escapeHtml(article.categoryName || "行业观点")}</span><span>${escapeHtml(article.author || "企业内容团队")}</span><span>${Math.max(1, Math.ceil(plainText(article.contentText || article.contentHtml).length / 500))}分钟阅读</span>${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}</div>`;
}

function articleWordCount(article) {
  return plainText(article.contentText || article.contentHtml || "").replace(/\s+/g, "").length;
}

function articleCitations(article) {
  const metadata = article?.metadata && typeof article.metadata === "object" ? article.metadata : {};
  const siteMetadata = metadata.site && typeof metadata.site === "object" ? metadata.site : {};
  const raw = [article?.citation, article?.citations, metadata.citation, metadata.citations, siteMetadata.citation, siteMetadata.citations]
    .flatMap((value) => Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]);
  const normalized = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const value = item.trim();
      if (!value || /^(?:(?:CIT|EVIDENCE|KNOWLEDGE)[-_][\w-]+|(?:K|E|REF)\d+)$/i.test(value)) continue;
      const url = safeUrl(value, "link");
      normalized.push(/^https?:/i.test(url) ? url : value);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rawUrl = item.url || item.sourceUrl || item.href || "";
    const safeSourceUrl = safeUrl(rawUrl, "link");
    const name = String(item.source || item.sourceName || item.title || item.name || item.claim || "").trim();
    if (/^https?:/i.test(safeSourceUrl)) {
      normalized.push(name ? { "@type": "CreativeWork", name, url: safeSourceUrl } : safeSourceUrl);
    } else if (name) {
      normalized.push({ "@type": "CreativeWork", name });
    }
  }
  const seen = new Set();
  return normalized.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function articleCard(article) {
  const url = articleLink(article);
  return `<article class="blog-entry"><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}" class="blog-date"><strong>${escapeHtml(dateDay(article.publishedAt))}</strong><span>${escapeHtml(dateMonth(article.publishedAt))}</span></time><div class="blog-entry-body">${articleMeta(article)}<h3><a href="${escapeHtml(url)}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p>${article.tags?.length ? `<div class="blog-tags">${article.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</div><a class="blog-entry-link" href="${escapeHtml(url)}" aria-label="阅读${escapeHtml(article.title)}">→</a></article>`;
}

function pagination(origin, pathname, page, totalPages) {
  if (totalPages < 2) return "";
  const url = (target) => `${pathname}${target > 1 ? `?page=${target}` : ""}`;
  const values = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item <= 3 || item > totalPages - 2 || Math.abs(item - page) <= 1);
  let last = 0;
  const links = values.map((item) => {
    const gap = item - last > 1 ? `<span aria-hidden="true">…</span>` : "";
    last = item;
    return `${gap}<a${item === page ? ' aria-current="page"' : ""} href="${escapeHtml(url(item))}">${item}</a>`;
  }).join("");
  return `<nav class="site-pagination" aria-label="文章分页">${page > 1 ? `<a href="${escapeHtml(url(page - 1))}">上一页</a>` : ""}${links}${page < totalPages ? `<a href="${escapeHtml(url(page + 1))}">下一页</a>` : ""}</nav>`;
}

export function renderInsightsPage({ site, articles, categories, selectedCategory = null, origin, page = 1, pageSize = 12 }) {
  const displayArticles = frontendArticles(site, articles);
  const displayCategories = frontendCategories(site, categories);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 12));
  const total = displayArticles.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const activePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const pageArticles = displayArticles.slice((activePage - 1) * safePageSize, activePage * safePageSize);
  const featured = activePage === 1 ? pageArticles[0] || null : null;
  const visible = featured ? pageArticles.slice(1) : pageArticles;
  const title = selectedCategory ? `${selectedCategory.name}行业资讯` : "行业资讯";
  const description = selectedCategory?.seoDescription || selectedCategory?.description || site.description;
  const canonicalPath = selectedCategory ? categoryLink(selectedCategory) : "/insights/";
  const pagePath = activePage > 1 ? `${canonicalPath}?page=${activePage}` : canonicalPath;
  const collectionUrl = absoluteUrl(origin, pagePath);
  const itemList = pageArticles.map((article, index) => ({
    "@type": "ListItem", position: (activePage - 1) * safePageSize + index + 1, name: article.title, url: absoluteUrl(origin, articleLink(article))
  }));
  const schemaExtra = [{
    "@type": "CollectionPage", "@id": collectionUrl, name: title, url: collectionUrl, description,
    isPartOf: { "@id": entityId(origin, "website") }, mainEntity: { "@type": "ItemList", numberOfItems: total, itemListElement: itemList }
  }, { "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "首页", item: origin },
    { "@type": "ListItem", position: 2, name: "行业资讯", item: absoluteUrl(origin, "/insights/") },
    ...(selectedCategory ? [{ "@type": "ListItem", position: 3, name: selectedCategory.name, item: collectionUrl }] : [])
  ] }];
  const categoryRows = displayCategories.filter((item) => item.status !== "archived" && item.navVisible !== false).map((category) => `<a${selectedCategory?.slug === category.slug ? " class=\"active\"" : ""} href="${escapeHtml(categoryLink(category))}"><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.description || "企业公开内容")}</small></a>`).join("");
  const body = `<section class="page-hero blog-hero"><div class="shell"><div><span class="eyebrow">Knowledge &amp; Insights</span><h1>${escapeHtml(selectedCategory ? selectedCategory.name : "洞察 AI 搜索与企业增长")}</h1><p>${escapeHtml(selectedCategory?.description || "这里整理桐灼 GEO 的行业观点与典型内容。正式上线时以 CMS 审核通过的文章为准，演示数据会明确标注。")}</p><div class="actions"><a class="button primary" href="#archive">浏览文章 <span class="arrow">↓</span></a><a class="button secondary" href="/contact/">提交行业问题</a></div></div></div></section>${featured ? `<section class="section white" id="latest"><div class="shell"><div class="section-head"><div><span class="kicker">Featured</span><h2>最新行业观点</h2></div><p>内容按主题、摘要、作者和日期组织，方便读者与机器系统理解出处；正式站点以 CMS 发布状态为准。</p></div><article class="insight-feature"><div class="insight-visual" aria-hidden="true"><span class="visual-word w1">SOURCE</span><span class="visual-word w2">GEO</span><span class="visual-caption">ENTITY / ANSWER / EVIDENCE / FRESHNESS</span></div><div class="insight-copy">${featured.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<time datetime="${escapeHtml(isoDate(featured.publishedAt).slice(0, 10))}">${escapeHtml(featured.categoryName || "行业观点")} · ${escapeHtml(dateShort(featured.publishedAt))} · ${escapeHtml(featured.author)}</time><h3>${escapeHtml(featured.title)}</h3><p>${escapeHtml(featured.excerpt)}</p><a class="text-link" href="${escapeHtml(articleLink(featured))}">阅读全文 <span>→</span></a></div></article></div></section>` : ""}<section class="section blog-archive" id="archive"><div class="shell blog-layout"><div class="blog-main"><div class="blog-list-head"><div><span class="kicker">All Articles</span><h2>${escapeHtml(selectedCategory?.name || "全部文章")}</h2></div><span>共 ${total} 篇</span></div>${visible.length ? visible.map(articleCard).join("") : `<p class="blog-empty">当前栏目暂未发布文章。</p>`}${pagination(origin, canonicalPath, activePage, totalPages)}</div><aside class="blog-sidebar"><section class="blog-panel"><span class="blog-panel-label">内容栏目</span><a${selectedCategory ? "" : " class=\"active\""} href="/insights/"><strong>全部文章</strong><small>企业公开内容</small></a>${categoryRows}</section><section class="blog-panel blog-about"><span class="blog-panel-label">${escapeHtml(site.siteName)}</span><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p><a class="text-link" href="/about/">了解我们 <span>→</span></a></section></aside></div></section>`;
  const renderedBody = body.replace("这里整理桐灼 GEO 的行业观点与典型内容。", `这里整理${escapeHtml(publicBrandName(site))}的行业观点与典型内容。`);
  const headLinks = [
    ...(activePage > 1 ? [{ rel: "prev", href: absoluteUrl(origin, activePage === 2 ? canonicalPath : `${canonicalPath}?page=${activePage - 1}`) }] : []),
    ...(activePage < totalPages ? [{ rel: "next", href: absoluteUrl(origin, `${canonicalPath}?page=${activePage + 1}`) }] : [])
  ];
  return documentShell({
    site,
    origin,
    pathname: pagePath,
    title: activePage > 1 ? `${title} · 第 ${activePage} 页` : title,
    description,
    active: "/insights/",
    schemaExtra,
    body: renderedBody,
    headLinks
  });
}

export function renderArticlePage({ site, article, origin, relatedArticles = [], compatibility = false }) {
  const sanitized = sanitizeArticleHtml(applyPublicCitationVisibility(article.contentHtml || "", article.metadata));
  const rawBody = sanitized || plainText(article.contentText || "").split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const { html: contentHtml, headings } = ensureArticleHeadings(rawBody);
  const pathname = articleLink(article);
  const canonical = absoluteUrl(origin, pathname);
  const published = isoDate(article.publishedAt);
  const modified = isoDate(article.updatedAt || article.publishedAt);
  const organizationId = entityId(origin, "organization");
  const citations = articleCitations(article);
  const topics = [...new Set([article.categoryName, ...(Array.isArray(article.tags) ? article.tags : [])].map((item) => String(item || "").trim()).filter(Boolean))];
  const schemaExtra = [{
    "@type": "Article", "@id": `${canonical}#article`, headline: article.title, description: article.excerpt,
    url: canonical,
    datePublished: published || undefined, dateModified: modified || undefined, inLanguage: "zh-CN", isAccessibleForFree: true,
    author: { "@type": "Organization", name: article.author || site.companyName || site.siteName },
    publisher: { "@id": organizationId },
    articleSection: article.categoryName || undefined,
    wordCount: articleWordCount(article) || undefined,
    about: topics.length ? topics.map((name) => ({ "@type": "Thing", name })) : undefined,
    citation: citations.length ? citations : undefined,
    keywords: article.tags || [],
    mainEntityOfPage: { "@id": `${canonical}#webpage` }
  }, {
    "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: origin },
      { "@type": "ListItem", position: 2, name: "行业资讯", item: absoluteUrl(origin, "/insights/") },
      ...(article.categorySlug ? [{ "@type": "ListItem", position: 3, name: article.categoryName, item: absoluteUrl(origin, categoryLink({ slug: article.categorySlug })) }] : []),
      { "@type": "ListItem", position: article.categorySlug ? 4 : 3, name: article.title, item: canonical }
    ]
  }];
  const tableOfContents = headings.length ? `<aside class="article-toc" aria-label="文章目录"><strong>文章目录</strong>${headings.map((item) => `<a class="toc-${item.level}" href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`).join("")}</aside>` : `<aside class="article-toc" aria-label="文章信息"><strong>文章信息</strong><span>${escapeHtml(article.categoryName || "行业观点")}</span><span>${escapeHtml(article.author || site.siteName)}</span><a href="/insights/">返回行业资讯</a></aside>`;
  const relatedIntro = relatedArticles.some((item) => item.isDemo)
    ? "继续阅读同一主题的演示内容；正式内容以 CMS 发布状态为准。"
    : "继续阅读同一栏目下已经审核发布的专业内容。";
  const related = relatedArticles.length ? `<section class="section white"><div class="shell"><div class="section-head"><div><span class="kicker">Related</span><h2>相关内容</h2></div><p>${relatedIntro}</p></div><div class="insight-list">${relatedArticles.slice(0, 3).map((item) => `<article class="insight-card">${item.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<time datetime="${escapeHtml(isoDate(item.publishedAt).slice(0, 10))}">${escapeHtml(item.categoryName || "行业观点")} · ${escapeHtml(dateShort(item.publishedAt))}</time><h3><a href="${escapeHtml(articleLink(item))}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt)}</p><a class="text-link" href="${escapeHtml(articleLink(item))}">阅读全文 <span>→</span></a></article>`).join("")}</div></div></section>` : "";
  const publishedMeta = published ? `<time datetime="${escapeHtml(published.slice(0, 10))}">发布：${escapeHtml(dateLabel(published))}</time>` : "";
  const modifiedMeta = modified ? `<time datetime="${escapeHtml(modified.slice(0, 10))}">更新：${escapeHtml(dateLabel(modified))}</time>` : "";
  const updateNote = modified ? `最后更新：${escapeHtml(dateLabel(modified))}。` : "";
  const provenanceNote = article.isDemo
    ? `本文为前端演示内容，用于展示资讯结构，不代表已审核发布的正式企业文章。${updateNote}`
    : `本文由${escapeHtml(article.author || site.siteName)}发布，内容来自企业内容工作台的已审核版本。${updateNote}`;
  const body = `<header class="article-hero"><div class="shell">${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<span class="kicker">${escapeHtml(article.categoryName || "行业观点")}</span><h1>${escapeHtml(article.title)}</h1>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ""}<div class="article-meta"><span>作者：${escapeHtml(article.author || site.siteName)}</span>${publishedMeta}${modifiedMeta}<span>预计阅读：${Math.max(1, Math.ceil(plainText(article.contentText || article.contentHtml).length / 500))}分钟</span></div></div></header><article class="shell article-layout" id="article" data-content-article-id="${escapeHtml(article.id)}">${tableOfContents}<div class="prose">${article.excerpt ? `<div class="answer-box"><strong>内容摘要</strong><p>${escapeHtml(article.excerpt)}</p></div>` : ""}${contentHtml}${article.tags?.length ? `<div class="source-note">主题：${escapeHtml(article.tags.join("、"))}</div>` : ""}<div class="source-note">${provenanceNote}</div></div></article>${related}<section class="contact-band contact-band-v2 article-contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Build Your Source</span><h2>让企业知识成为客户和 AI 可以理解的可信信源</h2><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p></div><div class="contact-form"><strong class="contact-form-title">${escapeHtml(site.cta || "了解服务")}</strong><p class="contact-form-description">查看服务详情，或提交与本文相关的业务问题。</p><a class="button ink" href="/contact/">联系我们 <span class="arrow">→</span></a></div></div></section>`;
  const repeatedExcerpt = article.excerpt ? `<div class="answer-box"><strong>内容摘要</strong><p>${escapeHtml(article.excerpt)}</p></div>` : "";
  const withoutRepeatedExcerpt = repeatedExcerpt ? body.replace(repeatedExcerpt, "") : body;
  const renderedBody = article.isDemo
    ? withoutRepeatedExcerpt
    : withoutRepeatedExcerpt.replace("内容来自企业内容工作台的已审核版本", "内容来自企业审核通过的正式版本");
  const headMeta = [
    ...(published ? [{ property: "article:published_time", content: published }] : []),
    ...(modified ? [{ property: "article:modified_time", content: modified }] : []),
    ...(article.categoryName ? [{ property: "article:section", content: article.categoryName }] : []),
    ...(Array.isArray(article.tags) ? article.tags.map((tag) => ({ property: "article:tag", content: tag })) : []),
    ...(article.categoryName ? [{ name: "twitter:label1", content: "栏目" }, { name: "twitter:data1", content: article.categoryName }] : []),
    ...(article.author ? [{ name: "twitter:label2", content: "作者" }, { name: "twitter:data2", content: article.author }] : [])
  ];
  const output = documentShell({ site, origin, pathname, title: article.title, description: article.excerpt, active: "/insights/", schemaExtra, body: renderedBody, openGraphType: "article", headMeta });
  return { html: output, canonicalPath: pathname, compatibility };
}

export function renderSitemap({ site, articles, categories, origin }) {
  const rows = new Map();
  const add = (pathname, lastmod = null, changefreq = "weekly", priority = "0.6") => {
    if (!pathname) return;
    const url = absoluteUrl(origin, canonicalPublicPath(pathname));
    rows.set(url, { url, lastmod, changefreq, priority });
  };
  const publicPages = (Array.isArray(site.pages) ? site.pages : []).filter((page) => page?.status === "published" && page?.sitemapEnabled !== false && page?.path);
  for (const page of publicPages) add(page.path, page.updatedAt || page.publishedAt, page.id === "insights" ? "daily" : "monthly", page.path === "/" ? "1.0" : page.id === "insights" ? "0.9" : "0.7");
  for (const fallbackPath of ["/cases/", "/problem-map/"]) {
    if (!publicPages.some((page) => pagePathKey(page.path) === pagePathKey(fallbackPath)) && publicFixedPageAvailable(site, fallbackPath)) {
      add(fallbackPath, site.updatedAt, "monthly", "0.7");
    }
  }
  const insightsPage = publicPages.find((page) => page.id === "insights" || pagePathKey(page.path) === "/insights") || null;
  if (insightsPage) {
    for (const category of visibleCmsRecords(Array.isArray(categories) ? categories : [], false)) add(categoryLink(category), category.updatedAt || site.updatedAt, "weekly", "0.7");
    for (const article of Array.isArray(articles) ? articles : []) add(articleLink(article), article.updatedAt || article.publishedAt, "monthly", "0.8");
  }
  const problemMapPage = publicPages.find((page) => page.id === "problem-map" || pagePathKey(page.path) === "/problem-map") || null;
  const problemMapAvailable = Boolean(problemMapPage) || publicFixedPageAvailable(site, "/problem-map/");
  if (problemMapAvailable) {
    for (const group of frontendProblemGroups(site, false)) {
      for (const problem of group.questions || []) add(`/problem-map/${encodeURIComponent(problem.slug)}/`, problem.updatedAt || group.updatedAt || site.updatedAt, "monthly", "0.7");
    }
  }
  const urls = [...rows.values()].map((item) => {
    const lastmod = isoDate(item.lastmod);
    return `<url><loc>${escapeXml(item.url)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ""}<changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function renderFeed({ site, articles, origin }) {
  const insightsPage = publishedPage(site, "insights", "/insights/");
  const publicArticles = insightsPage ? (Array.isArray(articles) ? articles : []) : [];
  const channelUrl = absoluteUrl(origin, insightsPage ? "/insights/" : "/");
  const selfUrl = absoluteUrl(origin, "/feed.xml");
  const entries = publicArticles.slice(0, 50).map((article) => {
    const url = absoluteUrl(origin, articleLink(article));
    const date = dateValue(article.publishedAt || article.updatedAt);
    return `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><description>${escapeXml(article.excerpt)}</description>${date ? `<pubDate>${date.toUTCString()}</pubDate>` : ""}<dc:creator>${escapeXml(article.author || site.companyName || site.siteName)}</dc:creator><category>${escapeXml(article.categoryName || "行业观点")}</category></item>`;
  }).join("");
  const buildDate = dateValue(publicArticles[0]?.publishedAt || publicArticles[0]?.updatedAt || site.updatedAt);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/rss.xsl"?>\n<rss version="2.0"><channel xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom"><title>${escapeXml(`${site.siteName}行业资讯`)}</title><link>${escapeXml(channelUrl)}</link><atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/><description>${escapeXml(site.description || DEFAULT_DESCRIPTION)}</description><language>zh-CN</language>${buildDate ? `<lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>` : ""}${entries}</channel></rss>\n`;
}

export function renderRobots({ site, origin }) {
  const crawlers = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended"];
  const aiRules = site.allowAiCrawl === false ? crawlers.map((agent) => `User-agent: ${agent}\nDisallow: /`).join("\n\n") : crawlers.map((agent) => `User-agent: ${agent}\nAllow: /`).join("\n\n");
  return `User-agent: *\nAllow: /\n\n${aiRules}\n\nSitemap: ${absoluteUrl(origin, "/sitemap.xml")}\n`;
}

export function renderLlms({ site, articles, origin, full = false }) {
  const homePage = publishedPage(site, "home", "/");
  const servicesPage = publishedPage(site, "services", "/services/");
  const insightsPage = publishedPage(site, "insights", "/insights/");
  const problemMapPage = publishedPage(site, "problem-map", "/problem-map/");
  const problemMapAvailable = Boolean(problemMapPage) || publicFixedPageAvailable(site, "/problem-map/");
  const lines = [
    `# ${site.siteName}`,
    "",
    `> ${site.description || DEFAULT_DESCRIPTION}`,
    "",
    "## 官方入口"
  ];
  if (homePage) lines.push(`- [官网首页](${absoluteUrl(origin, "/")}): 企业公开信息与服务说明。`);
  if (servicesPage) lines.push(`- [产品与服务](${absoluteUrl(origin, "/services/")}): 企业正式发布的服务范围与适用对象。`);
  if (insightsPage) lines.push(`- [行业资讯](${absoluteUrl(origin, "/insights/")}): 公开文章以 CMS 发布状态为准；演示内容会明确标注。`);
  lines.push(
    `- [RSS](${absoluteUrl(origin, "/feed.xml")})`,
    `- [Sitemap](${absoluteUrl(origin, "/sitemap.xml")})`
  );
  const services = servicesPage ? frontendServices(site, false) : [];
  if (servicesPage && services.length) {
    lines.push("", "## 产品与服务");
    for (const service of services) lines.push(`- [${service.title}](${absoluteUrl(origin, `/services/#${encodeURIComponent(service.id)}`)}): ${service.description}`);
  }
  const problemGroups = problemMapAvailable ? frontendProblemGroups(site, false) : [];
  if (problemGroups.length) {
    lines.push("", "## 客户问题地图");
    for (const group of problemGroups) {
      for (const problem of (group.questions || []).slice(0, full ? 100 : 20)) {
        lines.push(`- [${problem.title}](${absoluteUrl(origin, `/problem-map/${encodeURIComponent(problem.slug)}/`)})${full ? ` — ${problem.answer}` : ""}`);
      }
    }
  }
  const publicArticles = insightsPage ? (Array.isArray(articles) ? articles : []) : [];
  if (insightsPage) {
    lines.push("", "## 已发布文章");
    for (const article of publicArticles.slice(0, full ? 500 : 50)) {
      const url = absoluteUrl(origin, articleLink(article));
      lines.push(`- [${article.title}](${url}) — ${article.excerpt}`);
      if (full) {
        const content = plainText(article.contentText || article.contentHtml).slice(0, 12_000);
        lines.push("", `### ${article.title}`, "", content, "");
      }
    }
    if (!publicArticles.length) lines.push("- 暂无符合公开门槛的文章。");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function injectStaticSeo(html, { site, origin, pathname }) {
  const canonical = absoluteUrl(origin, pathname);
  const description = site.description || DEFAULT_DESCRIPTION;
  const configuredPage = pageForPath(site, pathname);
  const schema = pageSchema(site, origin, pathname, [{ "@type": "WebPage", "@id": canonical, url: canonical, name: site.siteName, description, isPartOf: { "@id": entityId(origin, "website") } }], { pageEnabled: configuredPage?.schemaEnabled !== false, name: site.siteName, description });
  const withoutCanonical = String(html || "").replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "");
  const withoutSchema = withoutCanonical.replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  const injection = `<base href="/"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}"><script type="application/ld+json">${safeJsonLd(schema)}</script>`;
  return withoutSchema.replace(/<\/head\s*>/i, `${injection}</head>`);
}

export function renderNotFound({ site, origin, pathname }) {
  return documentShell({
    site, origin, pathname, title: "页面未找到", description: "请求的公开页面不存在或尚未发布。", active: "",
    robots: "noindex,follow", feed: false,
    body: `<section class="page-hero blog-hero"><div class="shell"><div><span class="eyebrow">404</span><h1>页面未找到</h1><p>该内容可能尚未发布、已下线，或地址已发生变化。</p><div class="actions"><a class="button primary" href="/insights/">浏览行业资讯</a><a class="button secondary" href="/">返回首页</a></div></div></div></section>`
  });
}
