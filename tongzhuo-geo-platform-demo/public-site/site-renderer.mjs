import { applyPublicCitationVisibility } from "../citation-visibility.mjs";
import { DEFAULT_SITE_TEMPLATE_KEY, isSiteTemplateKey, siteTemplateByKey, SITE_TEMPLATES } from "../site-template-registry.mjs";
import { LEGACY_SOURCE_PROFILES } from "./legacy-template-profiles.mjs";

const DEFAULT_DESCRIPTION = "企业公开信息、行业洞察与可验证的专业内容。";

// Front-end presentation fallbacks were removed (2026-08-24): the public
// website now shows CMS content exclusively. Empty arrays keep the render
// paths exercised without fabricating demo records.
const FRONTEND_SERVICES = Object.freeze([]);

const FRONTEND_CASES = Object.freeze([]);

const FRONTEND_PROBLEM_GROUPS = Object.freeze([]);

// Demo article fallbacks were removed (2026-08-24): the public website shows
// CMS-published articles only; an empty archive renders its empty state.
const FRONTEND_ARTICLES = Object.freeze([]);

const FRONTEND_NAV = Object.freeze([
  { label: "首页", path: "/" }, { label: "产品与服务", path: "/services/" }, { label: "关于我们", path: "/about/" },
  { label: "服务案例", path: "/cases/" }, { label: "行业资讯", path: "/insights/" }, { label: "问题地图", path: "/problem-map/" }, { label: "联系我们", path: "/contact/" }
]);
const PRIMARY_NAV_PAGE_IDS = new Set(["home", "services", "about", "contact", "insights", "cases", "problem-map"]);

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

function templateClass(site) {
  const key = isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY;
  return `template-${key.replace(/[^a-z0-9-]/gi, "-")}`;
}

function optionalMedia(image, alt, label = "内容图片") {
  const src = safeUrl(image, "image");
  if (src) return `<figure class="optional-media has-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt || label)}" loading="lazy" decoding="async"></figure>`;
  return `<div class="optional-media no-image" role="img" aria-label="${escapeHtml(label)}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 10h32v28H8zM13 32l8-8 5 5 4-4 5 7M15 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="18" r="2" fill="currentColor"/></svg><span>${escapeHtml(label)}</span></div>`;
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

function absoluteResourceUrl(origin, value) {
  const candidate = safeUrl(value, "image");
  if (!candidate) return "";
  return /^https?:\/\//i.test(candidate) ? candidate : absoluteUrl(origin, candidate);
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
  return site.frontendDemo === true && ["/cases", "/problem-map"].includes(key);
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
  const rawLogo = safeUrl(site.templateConfig?.logoUrl || site.assets?.logoUrl || site.logoUrl, "image");
  const logo = rawLogo ? new URL(rawLogo, origin).href : undefined;
  const sameAs = (Array.isArray(site.sameAs) ? site.sameAs : []).map((item) => safeUrl(item, "link")).filter((item) => /^https?:/i.test(item));
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: site.companyName || site.siteName,
    alternateName: site.siteName && site.siteName !== site.companyName ? site.siteName : undefined,
    url: absoluteUrl(origin, "/"),
    logo: logo || absoluteUrl(origin, PUBLIC_SCHEMA_LOGO),
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
  return configured && configured !== "企业官网" ? configured : "";
}

const PUBLIC_BRAND_MARK = "/assets/tongzhuo-mark-wine.png";
const PUBLIC_BRAND_MARK_ON_DARK = "/assets/tongzhuo-mark-gold.png";
const PUBLIC_BRAND_LOGO = "/assets/zhuojian-ai-lockup-gold.png";
const PUBLIC_SCHEMA_LOGO = "/assets/zhuojian-ai-official-logo.png";
const PREVIEW_ASSET_PREFIX = "/api/v1/site-cms/preview/assets";

function assetRoot(assetBase, fallback) {
  const normalized = String(assetBase || "").replace(/\/+$/, "");
  return normalized.startsWith(PREVIEW_ASSET_PREFIX) ? normalized : fallback;
}

function publicAsset(assetBase, fileName) {
  return `${assetRoot(assetBase, "/assets")}/${fileName}`;
}

function remapBuiltInPreviewAsset(value, assetBase) {
  const url = String(value || "").trim();
  if (!url || !String(assetBase || "").replace(/\/+$/, "").startsWith(PREVIEW_ASSET_PREFIX)) return url;
  const match = url.match(/^\/assets\/([^/?#]+)$/);
  if (!match || !SITE_TEMPLATES.some((template) => template.defaultImage === match[1])) return url;
  return publicAsset(assetBase, match[1]);
}

function configuredBrandLogo(site, assetBase, template = null) {
  return safeUrl(template?.logoUrl || site?.templateConfig?.logoUrl || site?.assets?.logoUrl || site?.logoUrl, "image")
    || publicAsset(assetBase, "zhuojian-ai-lockup-gold.png");
}

function configuredBrandMark(site, assetBase, template = null) {
  return safeUrl(template?.logoUrl || site?.templateConfig?.logoUrl || site?.assets?.logoUrl || site?.logoUrl, "image")
    || publicAsset(assetBase, "tongzhuo-mark-wine.png");
}

function brandLockup(site, assetBase, template = null) {
  return `<span class="brand-mark brand-mark-lockup"><img src="${escapeHtml(configuredBrandLogo(site, assetBase, template))}" alt="${escapeHtml(publicBrandName(site))}" width="116" height="64" decoding="async"></span>`;
}

function siteFavicon(site, assetBase) {
  return safeUrl(site?.assets?.faviconUrl || site?.templateConfig?.faviconUrl, "image") || publicAsset(assetBase, "tongzhuo-mark-wine.png");
}

function defaultContentImage(site, label, activeTemplate = null, assetBase = "/assets") {
  const cmsTemplate = site?.templateConfig || {};
  const template = activeTemplate || siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  const builtInDefault = template.defaultImage ? publicAsset(assetBase, template.defaultImage) : "";
  const configured = safeUrl(cmsTemplate.defaultImageUrl || site?.assets?.defaultImageUrl || builtInDefault, "image");
  const src = remapBuiltInPreviewAsset(configured, assetBase) || builtInDefault;
  if (!src) return null;
  return { src, alt: cmsTemplate.defaultImageAlt || site?.assets?.defaultImageAlt || `${label}默认图片` };
}

function footerColumns(site, fallback = []) {
  const configured = Array.isArray(site?.footer?.columns)
    ? site.footer.columns.map((column) => ({
      title: String(column?.title || "").trim(),
      links: (Array.isArray(column?.links) ? column.links : []).map((link) => ({
        label: String(link?.label || "").trim(),
        href: safeUrl(link?.href || link?.path, "link") || "/"
      })).filter((link) => link.label && link.href)
    })).filter((column) => column.title && column.links.length)
    : [];
  return configured.length ? configured : fallback;
}

function footerSocialLinks(site, fallback = []) {
  const configured = Array.isArray(site?.footer?.socialLinks)
    ? site.footer.socialLinks.map((link) => ({
      label: String(link?.label || "").trim(),
      href: safeUrl(link?.href || link?.path, "link") || ""
    })).filter((link) => link.label && link.href)
    : [];
  return configured.length ? configured : fallback;
}

function footerCompliance(site, company) {
  const footer = site?.footer || {};
  const isTongzhuoSite = /桐灼/.test(String(company || "")) || /tongzhuo\.ink/i.test(String(site?.officialDomain || ""));
  const icpNumber = String(footer.icpNumber || "").trim() || (isTongzhuoSite ? "鲁ICP备2026021587号-2" : "");
  const items = [];
  if (footer.showCopyright !== false) items.push(`<span>© ${new Date().getFullYear()} ${escapeHtml(company)} ${escapeHtml(footer.copyright || "版权所有")}</span>`);
  if (footer.showIcp !== false && icpNumber) items.push(`<a class="footer-icp" href="${escapeHtml(safeUrl(footer.icpUrl, "link") || "https://beian.miit.gov.cn/")}" target="_blank" rel="noreferrer">${escapeHtml(icpNumber)}</a>`);
  if (footer.showPoliceRecord !== false && footer.policeRecordNumber) items.push(`<a class="footer-police" href="${escapeHtml(safeUrl(footer.policeRecordUrl, "link") || "https://beian.mps.gov.cn/")}" target="_blank" rel="noreferrer">${escapeHtml(footer.policeRecordNumber)}</a>`);
  return items.join("");
}

function publicCompanyName(site) {
  const configured = String(site.companyName || "").trim();
  return configured && configured !== "企业" && configured !== "企业官网" ? configured : "";
}

function pageTitle(site, title = "") {
  const brand = publicBrandName(site);
  return title ? (brand ? `${title}｜${brand}` : title) : (brand || DEFAULT_DESCRIPTION);
}

function primaryNavigationPaths(site) {
  const pages = Array.isArray(site?.pages) ? site.pages : [];
  if (!pages.length) return new Set(FRONTEND_NAV.map((item) => sourceNormalizePath(item.path)));
  return new Set(pages
    .filter((page) => page?.status === "published" && PRIMARY_NAV_PAGE_IDS.has(page?.id) && page?.path)
    .map((page) => sourceNormalizePath(page.path)));
}

function configuredPrimaryNavigation(site) {
  const allowedPaths = primaryNavigationPaths(site);
  return Array.isArray(site?.navItems) ? site.navItems.filter((item) => (
    item?.visible !== false && item?.path && allowedPaths.has(sourceNormalizePath(item.path))
  )) : [];
}

function navigation(site, active = "", assetBase = "/assets") {
  if (site?.templateKey === "02-construction") return constructionNavigation(site, active, assetBase);
  // The first public-site version has a deliberate, complete information
  // architecture. CMS navigation labels can replace these later, but missing
  // demo pages must not make the walkthrough look unfinished.
  const allowedPaths = primaryNavigationPaths(site);
  const cmsItems = configuredPrimaryNavigation(site);
  const cmsByPath = new Map(cmsItems.map((item) => [String(item.path || "").replace(/\/$/, "") || "/", item]));
  const items = site.frontendDemo
    ? FRONTEND_NAV.map((item) => ({ ...item, label: cmsByPath.get(item.path.replace(/\/$/, "") || "/")?.label || item.label }))
    : (cmsItems.length ? cmsItems : FRONTEND_NAV.filter((item) => ["/", "/services/", "/insights/", "/about/", "/contact/"].includes(item.path) && allowedPaths.has(sourceNormalizePath(item.path))));
  const normalize = (value) => String(value || "/").replace(/\/index\.html$/i, "/").replace(/\.html$/i, "/").replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const navOrder = new Map([["/", 0], ["/services", 1], ["/about", 2], ["/cases", 3], ["/insights", 4], ["/problem-map", 5], ["/contact", 6]]);
  const activePath = normalize(active);
  const visibleItems = site.frontendDemo
    ? items.filter((item) => publicFixedPageAvailable(site, item.path))
    : items;
  const orderedItems = [...visibleItems].sort((left, right) => (navOrder.get(normalize(left.path)) ?? 100) - (navOrder.get(normalize(right.path)) ?? 100));
  const primaryPaths = new Set(["/", "/services", "/cases", "/insights", "/about", "/contact"]);
  // 主导航文字以 CMS「导航与外观」配置为准；仅未配置该项时才回退到默认名称，
  // 避免后台维护的导航名称被渲染层写死覆盖。
  const primaryLabels = new Map([["/", "首页"], ["/services", "产品与服务"], ["/cases", "服务案例"], ["/insights", "行业资讯"], ["/about", "关于我们"], ["/contact", "联系我们"]]);
  const displayItems = orderedItems.filter((item) => primaryPaths.has(normalize(item.path))).map((item) => ({ ...item, label: String(item.label || "").trim() || primaryLabels.get(normalize(item.path)) || item.path }));
  const brand = publicBrandName(site);
  return `<header class="site-header"><div class="shell nav"><a class="brand" href="/" aria-label="${escapeHtml(brand)}首页">${brandLockup(site, assetBase)}</a><nav class="nav-links" aria-label="主导航">${displayItems.map((item) => `<a${activePath === normalize(item.path) ? " class=\"active\" aria-current=\"page\"" : ""} href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join("")}</nav><div class="nav-actions"><a class="nav-cta" href="/contact/">预约诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="mobile-navigation"><span></span><span></span><span></span></button></div></div><nav id="mobile-navigation" class="mobile-navigation" aria-label="移动端导航">${displayItems.map((item) => `<a${activePath === normalize(item.path) ? " class=\"active\"" : ""} href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join("")}<a class="mobile-cta" href="/contact/">预约诊断</a></nav></header>`;
}

function constructionNavigation(site, active = "", assetBase = "/assets") {
  const normalizedActive = String(active || "/").replace(/\/$/, "") || "/";
  const fallbackItems = [["/", "首页"], ["/about/", "关于我们"], ["/services/", "服务项目"], ["/cases/", "工程案例"], ["/insights/", "新闻动态"], ["/contact/", "联系我们"]];
  const allowedPaths = primaryNavigationPaths(site);
  const configuredItems = configuredPrimaryNavigation(site).slice(0, 12).map((item) => [item.path, item.label]);
  const items = configuredItems.length ? configuredItems : fallbackItems.filter(([path]) => allowedPaths.has(sourceNormalizePath(path)));
  const company = publicCompanyName(site);
  const phone = site.contact?.phone || "";
  return `<header class="site-header header"><nav class="nav container"><a class="brand logo" href="/" aria-label="${escapeHtml(company)}首页"><span class="logo-icon logo-image" aria-hidden="true"><img src="${escapeHtml(configuredBrandMark(site, assetBase))}" alt="" width="32" height="32" decoding="async"></span><span>${escapeHtml(publicBrandName(site))}</span></a><ul class="nav-menu">${items.map(([path, label]) => `<li><a${normalizedActive === (String(path).replace(/\/$/, "") || "/") ? ' class="active" aria-current="page"' : ""} href="${escapeHtml(safeUrl(path, "link") || "/")}">${escapeHtml(label || "导航")}</a></li>`).join("")}</ul><div class="nav-contact">${phone ? `<span class="nav-phone">${escapeHtml(phone)}</span>` : ""}<a class="btn btn-primary" href="/contact/">预约咨询</a></div><button class="mobile-menu-btn" type="button" aria-label="打开导航" aria-expanded="false"><span></span><span></span><span></span></button></nav></header>`;
}

function footer(site, assetBase = "/assets") {
  if (site?.templateKey === "02-construction") return constructionFooter(site, assetBase);
  const contact = site.contact || {};
  const brand = publicBrandName(site);
  const company = publicCompanyName(site);
  const columns = footerColumns(site, [
    { title: "GEO", links: [{ label: "服务方法", href: "/services/" }, { label: "问题地图", href: "/problem-map/" }, { label: "实施场景", href: "/cases/" }] },
    { title: "知识", links: [{ label: "行业资讯", href: "/insights/" }, { label: "AI 内容索引", href: "/llms.txt" }, { label: "RSS 订阅", href: "/feed.xml" }] },
    { title: "企业", links: [{ label: "关于我们", href: "/about/" }, { label: "业务咨询", href: "/contact/" }, ...(contact.email ? [{ label: contact.email, href: `mailto:${contact.email}` }] : [])] }
  ]);
  const socials = footerSocialLinks(site, [{ label: "联系企业", href: "/contact/" }, { label: "查看新闻", href: "/insights/" }, { label: "查看案例", href: "/cases/" }]);
  const columnMarkup = columns.map((column) => `<div class="footer-col"><strong>${escapeHtml(column.title)}</strong>${column.links.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}</div>`).join("");
  const socialMarkup = site.footer?.showSocial === false ? "" : `<div class="footer-social" aria-label="企业社交入口">${socials.map((link, index) => `<a href="${escapeHtml(link.href)}" aria-label="${escapeHtml(link.label)}" title="${escapeHtml(link.label)}">${sourceIcon(["mail", "news", "building"][index % 3])}</a>`).join("")}</div>`;
  return `<footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/">${brandLockup(site, assetBase)}</a><p>${escapeHtml(site.footer?.description || "把企业事实组织成客户与 AI 都能验证的公开信源。")}</p>${contact.serviceArea || contact.industryRegion ? `<span class="footer-meta">${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · "))}</span>` : ""}${socialMarkup}</div>${columnMarkup}</div><div class="shell footer-bottom">${footerCompliance(site, company)}</div></footer>`;
}

function constructionFooter(site, assetBase = "/assets") {
  const company = publicCompanyName(site);
  const description = site.description || "提供专业的建筑工程、装饰设计与项目交付服务。";
  const columns = footerColumns(site, [
    { title: "服务项目", links: [{ label: "建筑工程", href: "/services/" }, { label: "装饰设计", href: "/services/" }, { label: "工程管理", href: "/services/" }, { label: "项目咨询", href: "/contact/" }] },
    { title: "关于我们", links: [{ label: "公司简介", href: "/about/" }, { label: "工程案例", href: "/cases/" }, { label: "新闻动态", href: "/insights/" }, { label: "联系我们", href: "/contact/" }] },
    { title: "服务支持", links: [{ label: "在线咨询", href: "/contact/" }, { label: "常见问题", href: "/problem-map/" }, { label: "提交需求", href: "/contact/" }, { label: "售后服务", href: "/contact/" }] }
  ]);
  const socials = footerSocialLinks(site, [{ label: "联系企业", href: "/contact/" }, { label: "查看新闻", href: "/insights/" }, { label: "查看案例", href: "/cases/" }]);
  const socialMarkup = site.footer?.showSocial === false ? "" : `<div class="footer-social" aria-label="企业入口">${socials.map((link, index) => `<a href="${escapeHtml(link.href)}" aria-label="${escapeHtml(link.label)}" title="${escapeHtml(link.label)}">${sourceIcon(["mail", "news", "building"][index % 3])}</a>`).join("")}</div>`;
  const columnMarkup = columns.map((column) => `<div class="footer-links"><h4>${escapeHtml(column.title)}</h4><ul>${column.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></div>`).join("");
  return `<footer class="site-footer footer"><div class="container"><div class="footer-grid"><div class="footer-about"><a class="footer-brand-logo" href="/" aria-label="${escapeHtml(company)}首页"><img src="${escapeHtml(configuredBrandLogo(site, assetBase))}" alt="${escapeHtml(publicBrandName(site))}" width="150" height="56" decoding="async"></a><h3>${escapeHtml(company)}</h3><p>${escapeHtml(site.footer?.description || description)}</p>${socialMarkup}</div>${columnMarkup}</div><div class="footer-bottom">${footerCompliance(site, company)}</div></div></footer>`;
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

const SOURCE_TEMPLATE_KEYS = new Set(["01-industry", "02-construction", "03-software-ai", "04-logistics", "05-business-services", "06-finance", "07-healthcare", "08-education", "09-travel-hotel", "10-food-consumer", "11-ups"]);
const LEGACY_SOURCE_TEMPLATE_KEYS = new Set([]);

function sourceTemplateFor(site) {
  const template = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  return SOURCE_TEMPLATE_KEYS.has(template.key) ? template : null;
}

function legacySourceTemplateFor(site) {
  const template = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  return LEGACY_SOURCE_TEMPLATE_KEYS.has(template.key) ? template : null;
}

const SOURCE_DEFAULT_PROFILE = Object.freeze({
  heroTitle: "专业工业制造解决方案提供商",
  heroHighlight: "工业制造",
  heroDescription: "围绕产品能力、应用场景与交付服务，为客户提供清晰、可靠的工业制造解决方案。",
  pageProductTitle: "产品中心",
  pageProductLead: "提供全系列工业制造设备，满足不同行业需求",
  aboutLead: "专注于工业制造、建材设备与机械设备，把产品资料、服务边界和交付能力组织成可理解的企业信息。",
  serviceSectionTitle: "产品中心",
  serviceSectionLead: "围绕实际业务场景，呈现产品能力、适用范围与服务支持。",
  caseSectionTitle: "工程案例",
  caseSectionLead: "成功服务于不同工业项目，展示专业能力与交付结果。",
  articleSectionTitle: "新闻动态",
  articleSectionLead: "了解企业最新资讯与行业动态",
  ctaLabel: "获取报价",
  ctaHref: "/contact/",
  aboutFeatures: ["品质保证", "技术创新", "完善服务", "行业经验"],
  stats: [["20", "年行业经验"], ["500", "合作客户"], ["50", "专利技术"], ["100", "项目案例"]]
});

function sourceTemplateProfile(template) {
  if (LEGACY_SOURCE_PROFILES[template.key]) return { ...SOURCE_DEFAULT_PROFILE, ...LEGACY_SOURCE_PROFILES[template.key] };
  if (template.key === "02-construction") {
    return {
      heroTitle: "匠心筑梦 品质为鼎",
      heroHighlight: "品质为鼎",
      heroDescription: "以建筑工程、装饰设计与项目交付为核心，把每一个项目节点都变成清晰、可靠的专业服务。",
      pageProductTitle: "服务项目",
      pageProductLead: "提供全方位建筑装饰解决方案",
      aboutLead: "以项目经验、设计能力与施工流程，清晰呈现企业的专业交付能力。",
      serviceSectionTitle: "服务项目",
      serviceSectionLead: "围绕项目实际需求，提供清晰的服务范围、交付方式与沟通路径。",
      caseSectionTitle: "精选案例",
      caseSectionLead: "从真实场景出发，呈现项目能力与交付过程。",
      articleSectionTitle: "新闻动态",
      articleSectionLead: "了解企业最新项目与行业动态",
      ctaLabel: "预约咨询",
      ctaHref: "/contact/",
      aboutFeatures: ["壹级资质", "专业团队", "品质保障", "全程服务"],
      stats: [["20", "年行业经验"], ["300", "完成项目"], ["50", "专业团队"], ["98", "客户满意度"]]
    };
  }
  return { ...SOURCE_DEFAULT_PROFILE };
}

function sourceIcon(kind = "building") {
  const paths = {
    building: '<path d="M4 20h16M6 20V8l6-5 6 5v12M9 20v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/>',
    factory: '<path d="M3 20h18M5 20V9l5 3V9l5 3V6l4 2v12M8 16h2m4 0h2m-6-4h.01m4 0h.01"/>',
    service: '<path d="M4 19h16M6 19V8l6-4 6 4v11M9 19v-5h6v5M8 10h.01M16 10h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-1.41 1.41-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.49a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.05.05-1.41-1.41.05-.05A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.84A1.7 1.7 0 0 0 9.4 10.4a1.7 1.7 0 0 0-.34-1.88l-.05-.05 1.41-1.41.05.05a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.38 5.9V5h2v.9a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.05-.05 1.41 1.41-.05.05A1.7 1.7 0 0 0 19.4 10.4a1.7 1.7 0 0 0 1.56 1.03H21v2h-.04A1.7 1.7 0 0 0 19.4 15Z"/>',
    chart: '<path d="M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8"/>',
    design: '<path d="m5 19 9.5-9.5M12 5l7 7M4 20h5M16 4l4 4"/>',
    award: '<circle cx="12" cy="8" r="4"/><path d="m9 12-1 8 4-2 4 2-1-8"/>',
    team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.3-3.2 2.3-5 6-5s5.7 1.8 6 5M15 15c3 0 4.7 1.5 5 4"/>',
    news: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
    pin: '<path d="M12 21s6-5.1 6-11A6 6 0 0 0 6 10c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    phone: '<path d="M7 4h3l1 4-2 1a13 13 0 0 0 6 6l1-2 4 1v3c0 1.1-.9 2-2 2C11 19 5 13 5 6c0-1.1.9-2 2-2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.building}</svg>`;
}

function sourceTemplateTitleMarkup(title, highlight) {
  const escapedTitle = escapeHtml(title);
  const escapedHighlight = escapeHtml(highlight);
  return escapedTitle.includes(escapedHighlight) ? escapedTitle.replace(escapedHighlight, `<span>${escapedHighlight}</span>`) : escapedTitle;
}

function sourceNormalizePath(value) {
  const normalized = String(value || "/").split("?")[0].replace(/\/index\.html$/i, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function sourceNavigation(site, active, template, assetBase = "/assets") {
  const profile = sourceTemplateProfile(template);
  const activePath = sourceNormalizePath(active);
  const fallbackItems = [
    ["/", "首页"],
    ["/about/", "关于我们"],
    ["/services/", profile.pageProductTitle],
    ["/cases/", "工程案例"],
    ["/insights/", "新闻动态"],
    ["/contact/", "联系我们"]
  ];
  const allowedPaths = primaryNavigationPaths(site);
  const configuredItems = configuredPrimaryNavigation(site).slice(0, 12).map((item) => [item.path, item.label]);
  const items = configuredItems.length ? configuredItems : fallbackItems.filter(([path]) => allowedPaths.has(sourceNormalizePath(path)));
  const company = publicCompanyName(site);
  const phone = site.contact?.phone || "";
  const links = items.map(([path, label]) => `<li><a${activePath === sourceNormalizePath(path) ? ' class="active" aria-current="page"' : ""} href="${escapeHtml(safeUrl(path, "link") || "/")}">${escapeHtml(label || "导航")}</a></li>`).join("");
  const topbar = template.key === "01-industry" ? `<div class="topbar"><div class="container"><span>欢迎访问${escapeHtml(company)}</span><div class="right"><a href="/contact/">在线询价</a><a href="/insights/">企业新闻</a><a href="/about/">关于我们</a></div></div></div>` : template.key === "11-ups" ? `<div class="topbar"><div class="container"><span>${escapeHtml(company)} · 电源设备服务</span><div class="right"><a href="/contact/">在线询价</a><a href="/insights/">行业知识</a></div></div></div>` : "";
  return `${topbar}<header class="header"><nav class="nav container"><a href="/" class="logo" aria-label="${escapeHtml(company)}首页"><span class="logo-icon logo-image"><img src="${escapeHtml(configuredBrandMark(site, assetBase, template))}" alt="" width="32" height="32" decoding="async"></span><span>${escapeHtml(publicBrandName(site))}</span></a><ul class="nav-menu">${links}</ul><div class="nav-contact">${phone ? `<span class="nav-phone">${escapeHtml(phone)}</span>` : ""}<a href="/contact/" class="btn btn-primary">${escapeHtml(site.cta || profile.ctaLabel)}</a></div><button type="button" class="mobile-menu-btn" aria-label="打开导航" aria-expanded="false"><span></span><span></span><span></span></button></nav></header>`;
}

function sourceFooter(site, template, assetBase = "/assets") {
  const profile = sourceTemplateProfile(template);
  const company = publicCompanyName(site);
  const services = frontendServices(site, false).slice(0, 4);
  const contact = site.contact || {};
  const fallbackColumns = [
    { title: profile.pageProductTitle, links: services.length ? services.map((service) => ({ label: service.title, href: service.href || "/services/" })) : [{ label: profile.pageProductTitle, href: "/services/" }] },
    { title: "关于我们", links: [{ label: "公司简介", href: "/about/" }, { label: "工程案例", href: "/cases/" }, { label: "新闻动态", href: "/insights/" }, { label: "联系我们", href: "/contact/" }] },
    { title: "联系方式", links: [{ label: contact.phone || "提交表单后由运营人员联系", href: contact.phone ? `tel:${contact.phone}` : "/contact/" }, ...(contact.email ? [{ label: contact.email, href: `mailto:${contact.email}` }] : []), ...(contact.address ? [{ label: contact.address, href: "/contact/" }] : [])] }
  ];
  const columns = footerColumns(site, fallbackColumns);
  const socials = footerSocialLinks(site, [{ label: "联系企业", href: "/contact/" }, { label: "查看新闻", href: "/insights/" }, { label: "查看案例", href: "/cases/" }]);
  const columnMarkup = columns.map((column) => `<div class="footer-links"><h4>${escapeHtml(column.title)}</h4><ul>${column.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></div>`).join("");
  const socialMarkup = site.footer?.showSocial === false ? "" : `<div class="footer-social" aria-label="企业社交入口">${socials.map((link, index) => `<a href="${escapeHtml(link.href)}" aria-label="${escapeHtml(link.label)}" title="${escapeHtml(link.label)}">${sourceIcon(["mail", "news", "building"][index % 3])}</a>`).join("")}</div>`;
  return `<footer class="footer"><div class="container"><div class="footer-grid"><div class="footer-about"><a class="footer-brand-logo" href="/" aria-label="${escapeHtml(company)}首页"><img src="${escapeHtml(configuredBrandLogo(site, assetBase, template))}" alt="${escapeHtml(publicBrandName(site))}" width="150" height="56" decoding="async"></a><h3>${escapeHtml(company)}</h3><p>${escapeHtml(site.footer?.description || site.description || profile.heroDescription)}</p>${contact.serviceArea || contact.industryRegion ? `<small class="footer-meta">${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · "))}</small>` : ""}${socialMarkup}</div>${columnMarkup}</div><div class="footer-bottom">${footerCompliance(site, company)}</div></div></footer>`;
}

function sourceBreadcrumb(title) {
  return `<div class="breadcrumb"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></div>`;
}

function sourcePageHeader(title, description) {
  return `<section class="page-header"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${sourceBreadcrumb(title)}</div></section>`;
}

function sourceVisual(className, item, icon, label, site) {
  const configured = defaultContentImage(site, label);
  const src = safeUrl(item?.image, "image") || configured?.src || "";
  if (src) return `<div class="${className} ${item?.image ? "has-template-image" : "has-default-image"}"><img src="${escapeHtml(src)}" alt="${escapeHtml(item?.imageAlt || item?.title || configured?.alt || label)}" loading="lazy" decoding="async"></div>`;
  return `<div class="${className} no-template-image" role="img" aria-label="${escapeHtml(label)}">${sourceIcon(icon)}</div>`;
}

function sourceContactForm(site, sourcePath, idSuffix) {
  const services = frontendServices(site, false).slice(0, 10);
  return `<form data-lead-form><div class="form-row"><div class="form-group"><label for="template-name-${idSuffix}">您的姓名</label><input id="template-name-${idSuffix}" name="name" autocomplete="name" maxlength="80" required placeholder="请输入姓名"></div><div class="form-group"><label for="template-phone-${idSuffix}">联系电话</label><input id="template-phone-${idSuffix}" name="phone" autocomplete="tel" maxlength="60" required placeholder="请输入电话"></div></div><div class="form-group"><label for="template-company-${idSuffix}">企业名称</label><input id="template-company-${idSuffix}" name="company" autocomplete="organization" maxlength="160" placeholder="请输入企业名称"></div><div class="form-group"><label for="template-service-${idSuffix}">咨询方向</label><select id="template-service-${idSuffix}" name="service"><option value="业务咨询">业务咨询</option>${services.map((service) => `<option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>`).join("")}</select></div><div class="form-group"><label for="template-message-${idSuffix}">需求说明</label><textarea id="template-message-${idSuffix}" name="message" maxlength="2000" placeholder="请说明项目类型、业务现状和希望解决的问题"></textarea></div><input type="hidden" name="source_url" value="${escapeHtml(sourcePath)}"><button class="btn btn-primary" type="submit">提交留言</button><p class="template-form-message" data-form-message role="status">提交后由企业运营人员跟进。</p></form>`;
}

function sourceData(site, articles, preview) {
  const data = templateHomeData(site, articles, preview);
  const services = data.services.length ? data.services : [{ id: "service-fallback", title: "企业服务方案", description: "围绕企业真实业务，整理清晰的服务范围与交付路径。" }];
  return { ...data, services, cases: data.cases || [], articles: data.articles || [] };
}

function sourceServiceMedia(template, service, index, site) {
  const icon = ["gear", "factory", "service", "chart", "building", "design"][index % 6];
  if (template.key === "02-construction") {
    return `<div class="service-media"><div class="service-icon">${sourceVisual("template-service-media", service, icon, "服务图片", site)}</div></div>`;
  }
  return `<div class="product-image">${sourceVisual("template-product-media", service, icon, "产品图片", site)}</div>`;
}

function sourceServiceCards(template, services, site) {
  if (template.key === "02-construction") {
    return services.slice(0, 6).map((service, index) => `<article class="service-card">${sourceServiceMedia(template, service, index, site)}<h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围、适用场景与交付方式。")}</p><a class="btn btn-outline" href="${escapeHtml(service.href || "/contact/")}">了解详情</a></article>`).join("");
  }
  return services.slice(0, 6).map((service, index) => `<article class="product-card">${sourceServiceMedia(template, service, index, site)}<div class="product-content"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看产品能力、应用场景与服务支持。")}</p><a href="${escapeHtml(service.href || "/services/")}" class="product-link">了解详情 <span aria-hidden="true">→</span></a></div></article>`).join("");
}

function sourceCaseCards(template, cases, site) {
  if (!cases.length) return `<p class="template-source-empty">案例内容正在整理中。</p>`;
  if (template.key === "02-construction") {
    return cases.slice(0, 6).map((item, index) => `<article class="project-card"><div class="project-card-bg">${sourceVisual("template-case-media", item, "building", "工程案例", site)}</div><div class="project-content"><span class="project-tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目实施过程与交付结果。")}</p></div></article>`).join("");
  }
  return cases.slice(0, 6).map((item) => `<article class="case-card"><div class="case-card-bg">${sourceVisual("template-case-media", item, "factory", "工程案例", site)}</div><div class="case-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目实施过程与交付结果。")}</p></div></article>`).join("");
}

function sourceNewsCards(template, articles, site) {
  if (!articles.length) return `<p class="template-source-empty">新闻内容正在整理中。</p>`;
  return articles.slice(0, 3).map((article) => `<article class="news-card"><div class="news-image">${sourceVisual("template-news-media", article, "news", "新闻封面", site)}</div><div class="news-content"><div class="news-date">${escapeHtml(dateShort(article.publishedAt))}</div><h3><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p></div></article>`).join("");
}

function sourceStats(profile, dynamicValues = null) {
  const values = dynamicValues || profile.stats;
  return values.map(([number, label]) => `<div class="stat-box"><div class="number" data-target="${escapeHtml(number)}">0</div><div class="label">${escapeHtml(label)}</div></div>`).join("");
}

function sourceAboutBlock(site, template, data) {
  const profile = sourceTemplateProfile(template);
  const company = publicCompanyName(site);
  const features = profile.aboutFeatures.map((label, index) => `<div class="about-feature"><div class="about-feature-icon">${sourceIcon(["check", "design", "service", "award"][index % 4])}</div><h4>${escapeHtml(label)}</h4></div>`).join("");
  return `<section class="section about"><div class="container"><div class="about-content"><div class="about-image">${sourceVisual("about-image-main", {}, template.key === "02-construction" ? "building" : "factory", "企业展示图片", site)}<div class="about-badge"><span>${Math.max(1, data.services.length)}+</span><small>核心业务方向</small></div></div><div class="about-text"><h3>关于${escapeHtml(company)}</h3><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p><div class="about-features">${features}</div><a href="/about/" class="btn btn-primary" style="margin-top: 30px;">了解更多</a></div></div></div></section>`;
}

function sourceContactBlock(site, template, sourcePath) {
  const profile = sourceTemplateProfile(template);
  const contact = site.contact || {};
  const rows = [
    ["pin", "公司地址", contact.address || "欢迎通过表单提交项目地址"],
    ["phone", "联系电话", contact.phone || "提交表单后由运营人员联系"],
    ["mail", "电子邮箱", contact.email || "暂未配置公开邮箱"],
    ["clock", "服务区域", contact.serviceArea || contact.industryRegion || "以实际业务沟通为准"]
  ];
  return `<section class="section contact"><div class="container"><div class="section-header"><h2>联系我们</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div><div class="contact-wrapper"><div class="contact-info"><h3>联系方式</h3>${rows.map(([icon, label, value]) => `<div class="info-item"><div class="info-icon">${sourceIcon(icon)}</div><div class="info-content"><h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p></div></div>`).join("")}</div><div class="contact-form"><h3>在线留言</h3>${sourceContactForm(site, sourcePath, template.key)}</div></div></div></section>`;
}

/* ============================================================
   01-工业制造：静态站结构（华盛重工风格）首页
   结构照抄「企业官网页面/01-工业制造建材机械/index.html」，
   数据全部来自 CMS（services/cases/articles/profile）。
   ============================================================ */

const INDUSTRY_HERO_FALLBACK_IMG = "/assets/tz-ind-01.jpg";
const INDUSTRY_ABOUT_FALLBACK_IMG = "/assets/tz-ind-02.jpg";
const INDUSTRY_PRODUCT_FALLBACK_IMGS = ["/assets/tz-ind-03.jpg", "/assets/tz-ind-04.jpg", "/assets/tz-ind-05.jpg"];
const INDUSTRY_CASE_FALLBACK_IMGS = ["/assets/tz-ind-05.jpg", "/assets/tz-ind-06.jpg", "/assets/tz-ind-03.jpg", "/assets/tz-ind-04.jpg"];
const INDUSTRY_NEWS_FALLBACK_IMG = "/assets/tz-ind-06.jpg";

function industryImage(item, fallback) {
  return safeUrl(item?.image, "image") || fallback;
}

function industryHeroTitleMarkup(title, highlight) {
  const escapedTitle = escapeHtml(title);
  const escapedHighlight = escapeHtml(highlight);
  return escapedTitle.includes(escapedHighlight) ? escapedTitle.replace(escapedHighlight, `<em>${escapedHighlight}</em>`) : escapedTitle;
}

function industryArrowSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
}

function industryCheckSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
}

function industrySplitTitle(title, fallback = "产品中心") {
  const value = String(title || fallback).trim() || fallback;
  if (value.length <= 2) return `<span>${escapeHtml(value)}</span>`;
  return `${escapeHtml(value.slice(0, -2))}<span>${escapeHtml(value.slice(-2))}</span>`;
}

function renderIndustrySourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);
  const templateDefaultImage = template.defaultImage ? `/assets/${template.defaultImage}` : "";
  const configuredImage = safeUrl(site?.templateConfig?.defaultImageUrl || site?.assets?.defaultImageUrl, "image");
  const hasCustomImage = Boolean(configuredImage && configuredImage !== templateDefaultImage);
  const heroBg = hasCustomImage ? configuredImage : INDUSTRY_HERO_FALLBACK_IMG;
  const aboutBg = hasCustomImage ? configuredImage : INDUSTRY_ABOUT_FALLBACK_IMG;

  const defaultStats = [["20", "年行业经验"], ["500", "合作客户"], ["50", "专利技术"], ["100", "项目案例"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 5);
  const statCells = heroStats.slice(0, 5).map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><small>${escapeHtml(label)}</small></div>`).join("");

  const aboutFeatures = profile.aboutFeatures.slice(0, 3).map((label) => `<li>${industryCheckSvg()}${escapeHtml(label)}</li>`).join("");
  const aboutStat = heroStats[0]?.[0] || "20";

  const products = data.services.slice(0, 3).map((service, index) => `<div class="prod reveal${index ? ` reveal-d${index}` : ""}"><div class="media"><img src="${escapeHtml(industryImage(service, INDUSTRY_PRODUCT_FALLBACK_IMGS[index % INDUSTRY_PRODUCT_FALLBACK_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"></div><div class="body"><span class="cat">${escapeHtml(service.audience || "标准系列")}</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看产品能力、应用场景与服务支持。")}</p><a href="${escapeHtml(safeUrl(service.href, "link") || "/services/")}" class="btn btn-primary">看产品详情${industryArrowSvg()}</a></div></div>`).join("");

  const caseItems = data.cases.slice(0, 4);
  const casesMarkup = caseItems.map((item, index) => {
    const className = index === 0 ? "case tall" : index === 3 ? "case wide" : "case";
    const inner = index === 0
      ? `<div class="tall-inner"><img src="${escapeHtml(industryImage(item, INDUSTRY_CASE_FALLBACK_IMGS[0]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`
      : `<div class="media-box"><img src="${escapeHtml(industryImage(item, INDUSTRY_CASE_FALLBACK_IMGS[index % INDUSTRY_CASE_FALLBACK_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`;
    return `<a class="${className} reveal" href="/cases/"><div class="info"><span class="tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h4>${escapeHtml(item.title)}</h4></div>${inner}</a>`;
  }).join("");

  const newsItems = data.articles.slice(0, 4);
  const newsFeature = newsItems[0] ? `<div class="feature reveal"><a href="${escapeHtml(articleLink(newsItems[0]))}"><img src="${escapeHtml(industryImage(newsItems[0], INDUSTRY_NEWS_FALLBACK_IMG))}" alt="${escapeHtml(newsItems[0].title)}" loading="lazy" decoding="async"><div class="meta"><span class="date">${escapeHtml(dateShort(newsItems[0].publishedAt))}</span><h3>${escapeHtml(newsItems[0].title)}</h3></div></a></div>` : "";
  const newsSide = newsItems.slice(1, 4).map((article) => {
    const month = dateMonth(article.publishedAt).split(".")[1] || "";
    const day = dateDay(article.publishedAt);
    return `<li><span class="date">${escapeHtml(month)}<br><b>${escapeHtml(day)}</b></span><a href="${escapeHtml(articleLink(article))}"><h4>${escapeHtml(article.title)}</h4></a></li>`;
  }).join("");
  const newsMarkup = newsFeature ? `<div class="news reveal">${newsFeature}<ul class="side">${newsSide}</ul></div>` : '<div class="template-source-empty">新闻内容正在整理中。</div>';

  return `<main id="template-main"><section class="hero"><div class="hero-copy"><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "品质保证")} · ${escapeHtml(profile.aboutFeatures?.[1] || "技术创新")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-primary">查看产品目录${industryArrowSvg()}</a><a href="/contact/" class="btn btn-light">索取报价</a></div></div><div class="hero-media"><img src="${escapeHtml(heroBg)}" alt="${escapeHtml(company)}生产车间" loading="lazy" decoding="async"></div></section><section class="figures"><div class="container">${statCells}</div></section><section class="section"><div class="container about"><div class="txt"><h2>关于<span>${escapeHtml(company)}</span></h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p><ul class="list">${aboutFeatures}</ul><a href="/about/" class="btn btn-ghost">了解${escapeHtml(publicBrandName(site))}${industryArrowSvg()}</a></div><div class="media"><img src="${escapeHtml(aboutBg)}" alt="${escapeHtml(company)}生产车间" loading="lazy" decoding="async"><div class="tag"><strong><span data-target="${escapeHtml(aboutStat)}">0</span>+</strong><small>${escapeHtml(heroStats[0]?.[1] || "年行业经验")}</small></div></div></div></section><section class="section section-2"><div class="container"><div class="head reveal"><div class="l"><h2>${industrySplitTitle(profile.serviceSectionTitle, "产品中心")}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="r"><a href="/services/">全部产品${industryArrowSvg()}</a></div></div><div class="prod-list">${products}</div></div></section>${caseItems.length ? `<section class="section"><div class="container"><div class="head reveal"><div class="l"><h2>${industrySplitTitle(profile.caseSectionTitle, "工程案例")}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="r"><a href="/cases/">全部案例${industryArrowSvg()}</a></div></div><div class="cases reveal">${casesMarkup}</div></div></section>` : ""}<section class="section section-2"><div class="container"><div class="head reveal"><div class="l"><h2>${industrySplitTitle(profile.articleSectionTitle, "新闻动态")}</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div><div class="r"><a href="/insights/">全部新闻${industryArrowSvg()}</a></div></div>${newsMarkup}</div></section><section class="cta"><div class="container"><div><h2>有项目要询价？</h2><p>把工况和需求告诉我们，我们会尽快回复方案与报价。</p></div><a href="/contact/" class="btn btn-light">立即咨询</a></div></section></main>`;
}

/* ============================================================
   02-建筑工程：静态站结构（筑鼎装饰风格）首页
   结构照抄「企业官网页面/02-建筑工程装饰设计/index.html」
   ============================================================ */

const CONSTRUCTION_BG_IMG = "/assets/tz-02-construction-01.jpg";
const CONSTRUCTION_WORK_IMGS = ["/assets/tz-02-construction-01.jpg", "/assets/tz-02-construction-02.jpg", "/assets/tz-02-construction-03.jpg", "/assets/tz-02-construction-04.jpg", "/assets/tz-02-construction-05.jpg", "/assets/tz-02-construction-06.jpg"];
const CONSTRUCTION_NEWS_IMGS = ["/assets/tz-02-construction-07.jpg", "/assets/tz-02-construction-08.jpg", "/assets/tz-02-construction-01.jpg"];

function renderConstructionSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["20", "年从业"], ["300", "交付项目"], ["80", "固定工人"], ["98", "按时交付率"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const introCols = heroStats.slice(0, 3).map(([number, label]) => `<div class="c"><strong><span data-target="${escapeHtml(number)}">0</span>+</strong><span>${escapeHtml(label)}</span></div>`).join("");

  const services = data.services.slice(0, 6).map((service, index) => `<a class="item" href="${escapeHtml(safeUrl(service.href, "link") || "/services/")}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围、适用对象与交付方式。")}</p></div><span class="go">→</span></a>`).join("");

  const works = data.cases.slice(0, 6).map((item, index) => {
    const widths = ["w1", "", "w3", "", "", "w2"];
    return `<a class="g ${widths[index] || ""}" href="/cases/"><img src="${escapeHtml(industryImage(item, CONSTRUCTION_WORK_IMGS[index % CONSTRUCTION_WORK_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"><div class="cap"><span>${escapeHtml(item.industry || item.service || "工程案例")}</span><h4>${escapeHtml(item.title)}</h4></div></a>`;
  }).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const newsItems = data.articles.slice(0, 3);
  const newsCards = newsItems.map((article, index) => `<a class="n" href="${escapeHtml(articleLink(article))}"><img src="${escapeHtml(industryImage(article, CONSTRUCTION_NEWS_IMGS[index % CONSTRUCTION_NEWS_IMGS.length]))}" alt="${escapeHtml(article.title)}" loading="lazy" decoding="async"><div class="b"><span class="date">${escapeHtml(dateShort(article.publishedAt))}</span><h4>${escapeHtml(article.title)}</h4></div></a>`).join("");
  const newsMarkup = newsItems.length ? `<div class="list reveal reveal-d1">${newsCards}</div>` : '<div class="template-source-empty">新闻内容正在整理中。</div>';

  const heroBg = (site?.templateConfig?.defaultImageUrl && site.templateConfig.defaultImageUrl !== (template.defaultImage ? `/assets/${template.defaultImage}` : "")) ? safeUrl(site.templateConfig.defaultImageUrl, "image") || CONSTRUCTION_BG_IMG : CONSTRUCTION_BG_IMG;

  return `<main id="template-main"><section class="hero"><div class="bg"><img src="${escapeHtml(heroBg)}" alt="${escapeHtml(company)}项目展示" loading="lazy" decoding="async"></div><div class="inner"><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "匠心筑造")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/cases/" class="btn btn-gold">看项目</a><a href="/contact/" class="btn btn-light-line">谈合作</a></div></div><div class="scroll">向下浏览</div></section><section class="intro"><div class="container"><span class="kicker">关于${escapeHtml(publicBrandName(site))}</span><h2>${escapeHtml(site.description || profile.aboutLead)}</h2><p>${escapeHtml(profile.aboutLead)}</p><div class="cols reveal">${introCols}</div></div></section><section class="services"><div class="container wrap"><div class="side"><span class="kicker">服务项目</span><h2>我们能做什么</h2><p>${escapeHtml(profile.serviceSectionLead)}</p><div class="num">${String(Math.min(6, data.services.length)).padStart(2, "0")}</div></div><div class="list reveal">${services}</div></div></section><section class="works"><div class="container"><div class="head reveal"><div><span class="kicker">工程案例</span><h2>近期项目</h2></div><a href="/cases/">查看全部 →</a></div><div class="gallery reveal">${works || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="news"><div class="container"><div class="head reveal"><span class="kicker">新闻动态</span><h2>公司近况</h2></div>${newsMarkup}</div></section><section class="cta"><div class="container"><h2>有项目想聊聊？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn">联系${escapeHtml(publicBrandName(site))}</a></div></section></main>`;
}

/* ============================================================
   03-软件科技：静态站结构（星云科技风格）首页
   结构照抄「企业官网页面/03-软件科技AI企业/index.html」
   ============================================================ */

function renderSoftwareSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["500", "企业客户"], ["99.9", "服务可用性"], ["800", "平均响应"], ["8", "AI 研发"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const iconKinds = ["gear", "service", "chart", "award", "design", "team"];
  const cards = data.services.slice(0, 6).map((service, index) => `<div class="card"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务能力与交付方式。")}</p></div>`).join("");

  const prods = data.services.slice(0, 4).map((service, index) => `<div class="prod"><div class="media">${sourceIcon(iconKinds[(index + 2) % iconKinds.length])}</div><div class="b"><div class="tags"><span>${escapeHtml(service.audience || "企业服务")}</span><span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span></div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看产品能力、应用场景与服务支持。")}</p></div></div>`).join("");

  const stackWords = ["AI 应用", "知识库", "数据分析", "私有化", "API", "自动化", "模型微调", "多模态", "企业服务", "持续运营"];
  const stack = stackWords.map((word) => `<span>${escapeHtml(word)}</span>`).join("");

  const clients = data.cases.slice(0, 5).map((item) => `<div class="c">${escapeHtml(item.industry || item.service || "企业客户")}</div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const codeMarkup = `<div class="win"><i></i><i></i><i></i></div><div class="code"><span class="c"># ${escapeHtml(publicBrandName(site))} · 接入示例</span><br><span class="p">from</span> ${escapeHtml(publicBrandName(site))} <span class="p">import</span> Agent<br><br>agent = Agent(<br>&nbsp;&nbsp;model=<span class="s">"${escapeHtml(profile.heroHighlight)}"</span>,<br>&nbsp;&nbsp;knowledge=<span class="s">"你的产品手册"</span><br>)<br><br><span class="c"># 一句话接入</span><br>reply = agent.chat(<span class="s">"怎么选型？"</span>)</div>`;

  return `<main id="template-main"><section class="hero"><div class="container"><div class="copy"><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "专业服务")} · ${escapeHtml(profile.aboutFeatures?.[1] || "技术创新")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-primary">看产品</a><a href="/cases/" class="btn btn-ghost">看案例</a></div></div><div class="visual">${codeMarkup}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">核心能力</span><h2>我们做什么</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="cards reveal">${cards}</div></div></section><section class="section products"><div class="container"><div class="head reveal"><span class="kicker">产品方案</span><h2>${escapeHtml(profile.serviceSectionTitle)}</h2></div><div class="prod-grid reveal">${prods}</div></div></section><section class="section"><div class="container"><div class="head reveal" style="text-align:center;"><span class="kicker">技术能力</span><h2>服务领域</h2></div><div class="stack reveal">${stack}</div></div></section>${clients ? `<section class="section products"><div class="container"><div class="head reveal"><span class="kicker">客户</span><h2>他们在用</h2></div><div class="clients reveal">${clients}</div></div></section>` : ""}<section class="section"><div class="container"><div class="stats">${statCells}</div></div></section><section class="cta"><div class="container"><h2>想看看它能不能用在你的业务里？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn btn-primary">约个演示</a></div></section></main>`;
}

/* ============================================================
   04-物流运输：静态站结构（迅驰物流风格）首页
   结构照抄「企业官网页面/04-物流运输供应链/index.html」
   ============================================================ */

function renderLogisticsSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["99.5", "到货准时率"], ["100", "日处理订单"], ["300", "覆盖城市"], ["15", "行业经验"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const iconKinds = ["service", "chart", "pin", "clock"];
  const services = data.services.slice(0, 4).map((service, index) => `<div class="service"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务能力与覆盖范围。")}</p></div>`).join("");

  const networkRows = heroStats.map(([number, label]) => `<li><span class="name">${escapeHtml(label)}</span><span class="num">${escapeHtml(number)}</span></li>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const quickLinks = [["网点查询", "pin"], ["在线下单", "service"], ["查运费", "chart"], ["时效查询", "clock"]].map(([label, icon]) => `<a href="/contact/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${(function () { const p = { pin: '<path d="M12 21s6-5.1 6-11A6 6 0 0 0 6 10c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>', service: '<path d="M4 19h16M6 19V8l6-4 6 4v11M9 19v-5h6v5M8 10h.01M16 10h.01"/>', chart: '<path d="M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>' }; return p[icon] || p.pin; })()}</svg>${escapeHtml(label)}</a>`).join("");

  return `<main id="template-main"><section class="hero"><div class="container"><div><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div style="display:flex;gap:12px;"><a href="/services/" class="btn btn-blue">看服务</a><a href="/contact/" class="btn btn-line">咨询报价</a></div></div><div class="quick reveal"><h3>快捷入口</h3><div class="grid">${quickLinks}</div></div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">服务项目</span><h2>几块核心业务</h2></div><div class="services reveal">${services}</div></div></section><section class="section network"><div class="container"><div class="wrap reveal"><div class="map">${escapeHtml(company)} 服务网络覆盖示意</div><div><div class="head reveal"><span class="kicker">网络覆盖</span><h2>货发到哪里都能接</h2></div><ul class="list">${networkRows}</ul></div></div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container"><div><h2>有货要发？报个价</h2></div><a href="/contact/" class="btn">在线询价</a></div></section></main>`;
}

/* ============================================================
   05-企业服务：静态站结构（创想咨询风格）首页
   结构照抄「企业官网页面/05-企业服务咨询营销/index.html」
   ============================================================ */

function renderConsultingSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);

  const defaultStats = [["500", "服务企业"], ["30", "平均增长"], ["100", "专业团队"], ["10", "行业经验"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const meta = heroStats.slice(0, 3).map(([number, label]) => `<span>服务 ${escapeHtml(number)} ${escapeHtml(label)}</span>`).join("");
  const svcRows = data.services.slice(0, 5).map((service, index) => `<a class="svc" href="${escapeHtml(safeUrl(service.href, "link") || "/services/")}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围与交付方式。")}</p></div><span class="go">→</span></a>`).join("");
  const logos = data.cases.slice(0, 10).map((item) => `<div class="lg">${escapeHtml(item.industry || item.service || "合作客户")}</div>`).join("");
  const steps = [["诊断", "先搞清楚现状、数据、问题在哪，不急着出方案。"], ["策略", "定方向、定打法，明确目标和衡量指标。"], ["执行", "内容、方案、落地页，按节奏推进。"], ["复盘", "看数据、调策略，持续优化。"]].map(([title, desc], index) => `<div class="step"><div class="n">${index + 1}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>`).join("");
  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");
  const phone = site.contact?.phone || "400-555-6666";

  return `<main id="template-main"><section class="hero"><div class="container"><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-dark">看服务</a><a href="/cases/" class="btn btn-line">看案例</a></div><div class="meta">${meta}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="no">服务项目</span><h2>几块核心业务</h2></div><div class="svc-list reveal">${svcRows}</div></div></section>${logos ? `<section class="section section-gray"><div class="container"><div class="head reveal"><span class="no">合作客户</span><h2>他们信任我们</h2></div><div class="logos reveal">${logos}</div></div></section>` : ""}<section class="section"><div class="container"><div class="head reveal"><span class="no">我们的方法</span><h2>怎么干活</h2></div><div class="steps reveal">${steps}</div></div></section><section class="section section-gray"><div class="container"><div class="stats">${statCells}</div></div></section><section class="cta"><div class="container"><div class="l"><h2>有业务上的困惑？聊聊</h2><p>先约个电话，聊聊你的现状，不收费。</p></div><div class="r"><span class="tel">${escapeHtml(phone)}</span><a href="/contact/" class="btn btn-accent">约个电话</a></div></div></section></main>`;
}

/* ============================================================
   06-金融服务：静态站结构（鑫盛金融风格）首页
   结构照抄「企业官网页面/06-金融服务投资/index.html」
   ============================================================ */

function renderFinanceSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["10", "稳健运营"], ["5", "最大回撤"], ["1000", "服务客户"], ["30", "投研团队"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const products = data.services.slice(0, 4).map((service, index) => `<div class="product"><div class="ic">${escapeHtml(String(service.title).slice(0, 1))}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围与适用对象。")}</p><div class="rate">${escapeHtml(heroStats[index % heroStats.length]?.[0] || "")}<small> ${escapeHtml(heroStats[index % heroStats.length]?.[1] || "核心指标")}</small></div></div>`).join("");

  const figs = heroStats.map(([number, label]) => `<div class="f"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const adv = profile.aboutFeatures.slice(0, 3).map((label, index) => `<div class="a"><div class="n">${String(index + 1).padStart(2, "0")}</div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(["独立运作，对结果负责。", "着眼长期，不做短期投机。", "公开透明，信息可查可验。"][index] || "以专业服务建立长期信任。")}</p></div>`).join("");

  return `<main id="template-main"><section class="hero"><div class="container"><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "专业服务")} · ${escapeHtml(profile.aboutFeatures?.[1] || "长期信任")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-gold">看产品</a><a href="/contact/" class="btn btn-line">预约咨询</a></div><div class="note">投资有风险，入市需谨慎。过往业绩不代表未来表现。</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">金融产品</span><h2>四类主要业务</h2></div><div class="products reveal">${products}</div></div></section><section class="chart-band"><div class="container wrap"><div class="chart">${escapeHtml(company)} 净值走势示意</div><div><h2>${escapeHtml(profile.heroTitle)}</h2><p>${escapeHtml(profile.heroDescription)}</p><div class="figs">${figs}</div></div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">为什么选我们</span><h2>我们的做法</h2></div><div class="adv reveal">${adv}</div></div></section><section class="cta"><div class="container"><h2>有资产配置的需求？</h2><p>先聊需求，再谈产品，不推销。</p><a href="/contact/" class="btn">预约咨询</a></div></section></main>`;
}

/* ============================================================
   07-医疗健康：静态站结构（康瑞医疗风格）首页
   结构照抄「企业官网页面/07-医疗健康/index.html」
   ============================================================ */

function renderHealthcareSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["20", "品牌历史"], ["100", "专业团队"], ["50", "服务患者"], ["98", "满意度"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const iconKinds = ["award", "check", "service", "team", "pin", "clock", "gear", "building"];
  const depts = data.services.slice(0, 8).map((service, index) => `<a class="dept" href="/services/"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(service.title)}</h3></a>`).join("");

  const doctors = data.services.slice(0, 4).map((service, doctorIndex) => `<div class="doctor"><div class="ava"><img src="/assets/tz-07-healthcare-${String(doctorIndex + 1).padStart(2, "0")}.jpg" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"></div><div class="b"><h4>${escapeHtml(service.title)}</h4><div class="title">${escapeHtml(service.audience || "专业服务")}</div><p>${escapeHtml((service.description || "").slice(0, 26))}</p></div></div>`).join("");

  const svcs = data.services.slice(0, 6).map((service) => `<div class="svc"><div class="ic">${sourceIcon("check")}</div><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务内容与预约方式。")}</p></div></div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const phone = site.contact?.phone || "400-120-0000";

  return `<main id="template-main"><section class="hero"><div class="container"><div><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-blue">看科室</a><a href="/contact/" class="btn btn-line">在线预约</a></div></div><div class="appt"><h3>在线预约</h3><form data-lead-form><div class="field"><input name="name" placeholder="您的称呼" required maxlength="80" /></div><div class="field"><input name="phone" type="tel" placeholder="联系电话" required maxlength="60" /></div><div class="field"><textarea name="message" rows="3" placeholder="需要预约的服务或说明"></textarea></div><button type="submit" class="btn btn-blue">确认预约</button><p class="template-form-message" data-form-message role="status">提交后由企业运营人员跟进。</p><input type="hidden" name="source_url" value="/" /></form></div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">服务科室</span><h2>重点科室</h2></div><div class="depts reveal">${depts}</div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">服务团队</span><h2>专业团队</h2></div><div class="doctors reveal">${doctors}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">特色服务</span><h2>除了门诊，还有这些</h2></div><div class="svcs reveal">${svcs}</div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container"><h2>需要帮助？先预约</h2><p>线上预约，到院直接服务。</p><a href="/contact/" class="btn btn-blue">预约服务</a></div></section></main>`;
}

/* ============================================================
   08-教育培训：静态站结构（博学堂风格）首页
   结构照抄「企业官网页面/08-教育培训学校/index.html」
   ============================================================ */

function renderEducationSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["15", "办学历史"], ["10", "学员数量"], ["200", "专业教师"], ["95", "满意度"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const heroBg = "/assets/tz-08-education-01.jpg";
  const iconKinds = ["gear", "chart", "service", "award", "design", "team"];
  const courses = data.services.slice(0, 6).map((service, index) => `<div class="course"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看课程内容与适合人群。")}</p><div class="meta"><span class="price">${escapeHtml(String(index + 1).padStart(2, "0"))}<small> 课程</small></span><span class="hours">${escapeHtml(service.audience || "长期开班")}</span></div></div></div>`).join("");

  const teachers = data.services.slice(0, 4).map((service, teacherIndex) => `<div class="teacher"><div class="ava"><img src="/assets/tz-08-education-${String(teacherIndex + 2).padStart(2, "0")}.jpg" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"></div><h4>${escapeHtml(service.title)}</h4><div class="subject">${escapeHtml(service.audience || "专业教师")}</div></div>`).join("");

  const adv = profile.aboutFeatures.slice(0, 4).map((label, index) => `<div class="a"><div class="ic">${sourceIcon(["award", "check", "chart", "team"][index % 4])}</div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(["专业能力，持续精进。", "小班教学，专注投入。", "定期反馈，进步可见。", "及时沟通，家校同步。"][index] || "以专业能力建立信任。")}</p></div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  return `<main id="template-main"><section class="hero"><div class="container"><div><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-purple">看课程</a><a href="/contact/" class="btn btn-line">约试听</a></div></div><div class="media"><img src="${escapeHtml(heroBg)}" alt="${escapeHtml(company)}课堂" loading="lazy" decoding="async"></div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">课程中心</span><h2>热门课程</h2></div><div class="courses reveal">${courses}</div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">师资力量</span><h2>明星老师</h2></div><div class="teachers reveal">${teachers}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">为什么选我们</span><h2>几个理由</h2></div><div class="adv reveal">${adv}</div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container"><h2>不确定孩子适不适合？先试听</h2><p>免费试听一节课，满意再报名。</p><a href="/contact/" class="btn">约试听</a></div></section></main>`;
}

/* ============================================================
   09-旅游酒店：静态站结构（云游文旅风格）首页
   结构照抄「企业官网页面/09-旅游酒店文旅/index.html」
   ============================================================ */

const TRAVEL_HERO_IMG = "/assets/tz-09-travel-hotel-01.jpg";
const TRAVEL_DEST_IMGS = ["/assets/tz-09-travel-hotel-02.jpg", "/assets/tz-09-travel-hotel-03.jpg", "/assets/tz-09-travel-hotel-04.jpg", "/assets/tz-09-travel-hotel-05.jpg"];
const TRAVEL_HOTEL_IMGS = ["/assets/tz-09-travel-hotel-06.jpg", "/assets/tz-09-travel-hotel-07.jpg", "/assets/tz-09-travel-hotel-08.jpg"];

function renderTravelSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["10", "行业经验"], ["100", "服务游客"], ["500", "合作酒店"], ["98", "好评率"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const dests = data.services.slice(0, 4).map((service, index) => `<a class="dest" href="/services/"><img src="${escapeHtml(industryImage(service, TRAVEL_DEST_IMGS[index % TRAVEL_DEST_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"><div class="info"><h4>${escapeHtml(service.title)}</h4><div class="price">${escapeHtml(service.audience || "热门推荐")}<b></b></div></div></a>`).join("");

  const hotels = data.services.slice(0, 3).map((service, index) => `<a class="hotel" href="/services/"><img src="${escapeHtml(industryImage(service, TRAVEL_HOTEL_IMGS[index % TRAVEL_HOTEL_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"><div class="b"><h4>${escapeHtml(service.title)}</h4><div class="loc">${escapeHtml((service.description || "").slice(0, 18))}</div><div class="foot"><span class="price">${escapeHtml(String(index + 1).padStart(2, "0"))}<small> 服务</small></span><span>${escapeHtml(service.audience || "品质保障")}</span></div></div></a>`).join("");

  const iconKinds = ["pin", "award", "service", "chart"];
  const svcs = data.services.slice(0, 4).map((service, index) => `<div class="svc"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml(service.description || "查看服务详情。")}</p></div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  const heroBg = "/assets/tz-09-travel-hotel-01.jpg";

  return `<main id="template-main"><section class="hero"><div class="bg"><img src="${escapeHtml(heroBg)}" alt="${escapeHtml(company)}目的地" loading="lazy" decoding="async"></div><div class="container"><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "专业服务")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><a href="/services/" class="btn btn-light">看服务</a></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">热门服务</span><h2>最近大家都在看</h2></div><div class="dests reveal">${dests}</div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">精选服务</span><h2>住得舒服点</h2></div><div class="hotels reveal">${hotels}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">我们的服务</span><h2>一站式</h2></div><div class="svcs reveal">${svcs}</div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container"><h2>想好去哪了吗？</h2><p>告诉我们时间和预算，帮你规划行程。</p><a href="/contact/" class="btn btn-green">咨询行程</a></div></section></main>`;
}

/* ============================================================
   10-食品餐饮：静态站结构（味道坊风格）首页
   结构照抄「企业官网页面/10-食品餐饮消费/index.html」
   ============================================================ */

function renderFoodSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["100", "品牌历史"], ["50", "产品种类"], ["1000", "年销量"], ["99", "好评率"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const heroBg = "/assets/tz-10-food-consumer-05.jpg";
  const storyBg = "/assets/tz-10-food-consumer-06.jpg";
  const iconKinds = ["award", "gear", "service", "chart"];
  const products = data.services.slice(0, 4).map((service, index) => `<div class="product"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h4>${escapeHtml(service.title)}</h4><div class="price">${escapeHtml(service.audience || "热销产品")}</div></div></div>`).join("");

  const stores = data.cases.slice(0, 4).map((item) => `<div class="store"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.industry || item.service || "欢迎到店")}</p></div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  return `<main id="template-main"><section class="hero"><div class="container"><div><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-red">看产品</a><a href="/contact/" class="btn btn-line">联系我们</a></div></div><div class="media"><img src="${escapeHtml(heroBg)}" alt="${escapeHtml(company)}产品展示" loading="lazy" decoding="async"></div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">热销产品</span><h2>最受欢迎的几样</h2></div><div class="products reveal">${products}</div></div></section><section class="section section-gray"><div class="container story"><div class="media"><img src="${escapeHtml(storyBg)}" alt="${escapeHtml(company)}故事" loading="lazy" decoding="async"></div><div><h2>${escapeHtml(profile.heroTitle)}</h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p><a href="/about/" class="btn btn-red">看品牌故事</a></div></div></section>${stores ? `<section class="section"><div class="container"><div class="head reveal"><span class="kicker">服务网点</span><h2>来门店看看</h2></div><div class="stores reveal">${stores}</div></div></section>` : ""}<section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container"><h2>想尝一口？</h2><p>联系我们，了解更多产品与服务。</p><a href="/contact/" class="btn">在线联系</a></div></section></main>`;
}

/* ============================================================
   11-UPS电源：静态站结构（新硕捷风格）首页
   结构照抄「企业官网页面/11-UPS不间断电源/index.html」
   ============================================================ */

const UPS_HERO_IMG = "/assets/ups/ols1000exl-1.jpg";
const UPS_GALLERY_IMGS = ["/assets/ups/ols2000e-1.jpg", "/assets/ups/ut1000e-1.jpg", "/assets/ups/ut600e-1.jpg", "/assets/ups/ut2200eb-1.jpg", "/assets/ups/ols1000exl-2.jpg", "/assets/ups/ut1000e-2.jpg"];

function renderUpsSourceHomeBody({ site, page, articles, template, preview }) {
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const company = publicCompanyName(site);

  const defaultStats = [["10", "电源行业"], ["2", "产品系列"], ["24", "快速响应"], ["365", "用心服务"]];
  const heroStats = Array.isArray(hero?.stats) && hero.stats.length ? hero.stats : (profile.stats || defaultStats).slice(0, 4);

  const series = data.services.slice(0, 2).map((service, index) => {
    const keys = heroStats.slice(0, 3).map(([number, label]) => `<div class="k"><b>${escapeHtml(number)}</b><span>${escapeHtml(label)}</span></div>`).join("");
    return `<div class="s ${index === 0 ? "online" : "backup"} reveal${index ? " reveal-d1" : ""}"><div class="ph"><img src="${escapeHtml(industryImage(service, UPS_GALLERY_IMGS[index]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"><span>${escapeHtml(service.audience || "产品实拍")}</span></div><span class="tag">${escapeHtml(service.audience || "标准系列")}</span><h3>${escapeHtml(service.title)}</h3><p class="desc">${escapeHtml(service.description || "查看产品能力与适用范围。")}</p><div class="keys">${keys}</div><div class="models"><a href="/services/">了解详情 →</a></div></div>`;
  }).join("");

  const gallery = data.services.slice(0, 5).map((service, index) => `<a class="g" href="/services/"><img src="${escapeHtml(industryImage(service, UPS_GALLERY_IMGS[index % UPS_GALLERY_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"><span>${escapeHtml(service.title)}</span></a>`).join("");

  const iconKinds = ["gear", "award", "service", "chart"];
  const scenes = data.services.slice(0, 4).map((service, index) => `<div class="scene"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml(service.description || "查看适用场景。")}</p></div>`).join("");

  const adv = profile.aboutFeatures.slice(0, 4).map((label, index) => `<div class="a"><div class="ic">${escapeHtml(String(label).slice(0, 1))}</div><div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(["帮你选型，按需求推荐。", "常用型号现货供应。", "本地可上门安装调试。", "电池主板可维修，不换整机。"][index] || "以专业服务建立信任。")}</p></div></div>`).join("");

  const statCells = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><span>${escapeHtml(label)}</span></div>`).join("");

  return `<main id="template-main"><section class="hero"><div class="container"><div><span class="kicker">${escapeHtml(profile.aboutFeatures?.[0] || "专业服务")} · ${escapeHtml(profile.aboutFeatures?.[1] || "现货供应")}</span><h1>${industryHeroTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="actions"><a href="/services/" class="btn btn-amber">看产品型号</a><a href="/contact/" class="btn btn-line">选型咨询</a></div></div><div class="ph"><img src="${escapeHtml(UPS_HERO_IMG)}" alt="${escapeHtml(company)}产品实拍图" loading="lazy" decoding="async"><div class="cap"><b>${escapeHtml(profile.heroHighlight)}</b> · 实拍图</div></div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">产品系列</span><h2>两大类，先搞清楚区别</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="series">${series}</div></div></section>${gallery ? `<section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">产品实拍</span><h2>几个在售型号</h2><p>门店实拍图，想多角度看的到店或联系客服。</p></div><div class="gallery reveal">${gallery}</div></div></section>` : ""}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">应用场景</span><h2>这些地方都在用</h2></div><div class="scenes reveal">${scenes}</div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">为什么找我们</span><h2>几个实在的理由</h2></div><div class="adv reveal">${adv}</div></div></section><section class="stats"><div class="container">${statCells}</div></section><section class="cta"><div class="container reveal"><h2>不确定该配多大功率？</h2><p>把负载情况发过来，我们帮你算选型。</p><a href="/contact/" class="btn">在线询价</a></div></section></main>`;
}

function renderSourceHomeBody({ site, page, articles, template, preview }) {
  if (template.key === "01-industry") return renderIndustrySourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "02-construction") return renderConstructionSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "03-software-ai") return renderSoftwareSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "04-logistics") return renderLogisticsSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "05-business-services") return renderConsultingSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "06-finance") return renderFinanceSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "07-healthcare") return renderHealthcareSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "08-education") return renderEducationSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "09-travel-hotel") return renderTravelSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "10-food-consumer") return renderFoodSourceHomeBody({ site, page, articles, template, preview });
  if (template.key === "11-ups") return renderUpsSourceHomeBody({ site, page, articles, template, preview });
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const serviceCards = sourceServiceCards(template, data.services, site);
  const caseCards = sourceCaseCards(template, data.cases, site);
  const newsCards = sourceNewsCards(template, data.articles, site);
  const company = publicCompanyName(site);
  const contact = sourceContactBlock(site, template, "/");
  if (template.key === "02-construction") {
    return `<main id="template-main"><section class="hero"><div class="container"><div class="hero-content"><h1>${sourceTemplateTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="hero-buttons"><a href="/cases/" class="btn btn-primary">查看案例</a><a href="/contact/" class="btn btn-outline">${escapeHtml(site.cta || "免费咨询")}</a></div></div></div></section>${sourceAboutBlock(site, template, data)}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="services-grid">${serviceCards}</div></div></section><section class="section projects"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="projects-grid">${caseCards}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${sourceStats(profile, profile.stats)}</div></div></section><section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.articleSectionTitle)}</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div><div class="news-grid">${newsCards}</div></div></section>${contact}</main>`;
  }
  const heroStats = [[String(Math.max(1, data.services.length)), "条业务线"], [String(data.cases.length), "+ 项目案例"], [String(data.articles.length), "+ 公开内容"], ["100", "% CMS 可追溯"]];
  return `<main id="template-main"><section class="hero"><div class="container"><div class="hero-content"><h1>${sourceTemplateTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="hero-buttons"><a href="/services/" class="btn btn-primary">探索产品</a><a href="/about/" class="btn btn-outline">了解更多</a></div></div></div><div class="hero-stats">${heroStats.map(([number, label]) => `<div class="stat-item"><span class="stat-number" data-target="${escapeHtml(number)}">0</span><span class="stat-label">${escapeHtml(label)}</span></div>`).join("")}</div></section>${sourceAboutBlock(site, template, data)}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="products-grid">${serviceCards}</div></div></section><section class="section cases"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="cases-grid">${caseCards}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${sourceStats(profile, profile.stats)}</div></div></section><section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.articleSectionTitle)}</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div><div class="news-grid">${newsCards}</div></div></section>${contact}</main>`;
}

function renderSourceHomePage({ site, page, articles, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const body = renderSourceHomeBody({ site, page, articles, template, preview });
  return documentShell({ site, origin, pathname: "/", title: page.title || site.siteName || "", description: page.seoDescription || site.description || profile.heroDescription, active: "/", schemaExtra: [{ "@type": "WebPage", name: page.title || site.siteName, description: page.seoDescription || site.description || profile.heroDescription }], body, preview, assetBase });
}

function renderSourceServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, [], preview);
  if (template.key === "01-industry") {
    const products = data.services.map((service, index) => `<div class="prod reveal"><div class="media"><img src="${escapeHtml(industryImage(service, INDUSTRY_PRODUCT_FALLBACK_IMGS[index % INDUSTRY_PRODUCT_FALLBACK_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"></div><div class="body"><span class="cat">${escapeHtml(service.audience || "标准系列")}</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看产品能力、应用场景与服务支持。")}</p><a href="${escapeHtml(safeUrl(service.href, "link") || "/contact/")}" class="btn btn-primary">索取报价${industryArrowSvg()}</a></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><div class="l"><h2>${industrySplitTitle(profile.serviceSectionTitle, "产品中心")}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div></div><div class="prod-list">${products}</div></div></section><section class="cta"><div class="container"><div><h2>型号没对上？</h2><p>非标定制也做，把工况和产量发过来，我们出方案。</p></div><a href="/contact/" class="btn btn-light">在线询价</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  const cards = sourceServiceCards(template, data.services, site);
  if (template.key === "03-software-ai") {
    const iconKinds = ["gear", "service", "chart", "award", "design", "team"];
    const prods = data.services.map((service, index) => `<div class="prod"><div class="media">${sourceIcon(iconKinds[(index + 2) % iconKinds.length])}</div><div class="b"><div class="tags"><span>${escapeHtml(service.audience || "企业服务")}</span><span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span></div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看产品能力、应用场景与服务支持。")}</p></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section products"><div class="container"><div class="head reveal"><span class="kicker">产品方案</span><h2>${escapeHtml(profile.serviceSectionTitle)}</h2></div><div class="prod-grid reveal">${prods}</div></div></section><section class="cta"><div class="container"><h2>想看看它能不能用在你的业务里？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn btn-primary">约个演示</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "04-logistics") {
    const iconKinds = ["service", "chart", "pin", "clock"];
    const services = data.services.map((service, index) => `<div class="service"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务能力与覆盖范围。")}</p></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">服务项目</span><h2>几块核心业务</h2></div><div class="services reveal">${services}</div></div></section><section class="cta"><div class="container"><div><h2>有货要发？报个价</h2></div><a href="/contact/" class="btn">在线询价</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "05-business-services") {
    const svcRows = data.services.map((service, index) => `<a class="svc" href="${escapeHtml(safeUrl(service.href, "link") || "/contact/")}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围与交付方式。")}</p></div><span class="go">→</span></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="no">服务项目</span><h2>几块核心业务</h2></div><div class="svc-list reveal">${svcRows}</div></div></section><section class="cta"><div class="container"><div class="l"><h2>有业务上的困惑？聊聊</h2><p>先约个电话，聊聊你的现状，不收费。</p></div><div class="r"><a href="/contact/" class="btn btn-accent">约个电话</a></div></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "07-healthcare") {
    const iconKinds = ["award", "check", "service", "team", "pin", "clock", "gear", "building"];
    const depts = data.services.map((service, index) => `<a class="dept" href="/contact/"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(service.title)}</h3></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">服务科室</span><h2>重点科室</h2></div><div class="depts reveal">${depts}</div></div></section><section class="cta"><div class="container"><h2>需要帮助？先预约</h2><p>线上预约，到院直接服务。</p><a href="/contact/" class="btn btn-blue">预约服务</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "08-education") {
    const iconKinds = ["gear", "chart", "service", "award", "design", "team"];
    const courses = data.services.map((service, index) => `<div class="course"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看课程内容与适合人群。")}</p><div class="meta"><span class="price">${escapeHtml(String(index + 1).padStart(2, "0"))}<small> 课程</small></span><span class="hours">${escapeHtml(service.audience || "长期开班")}</span></div></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">课程中心</span><h2>热门课程</h2></div><div class="courses reveal">${courses}</div></div></section><section class="cta"><div class="container"><h2>不确定孩子适不适合？先试听</h2><p>免费试听一节课，满意再报名。</p><a href="/contact/" class="btn">约试听</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "09-travel-hotel") {
    const iconKinds = ["pin", "award", "service", "chart"];
    const svcs = data.services.map((service, index) => `<div class="svc"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml(service.description || "查看服务详情。")}</p></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">我们的服务</span><h2>一站式</h2></div><div class="svcs reveal">${svcs}</div></div></section><section class="cta"><div class="container"><h2>想好去哪了吗？</h2><p>告诉我们时间和预算，帮你规划行程。</p><a href="/contact/" class="btn btn-green">咨询行程</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "10-food-consumer") {
    const iconKinds = ["award", "gear", "service", "chart"];
    const products = data.services.map((service, index) => `<div class="product"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h4>${escapeHtml(service.title)}</h4><div class="price">${escapeHtml(service.audience || "热销产品")}</div></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">热销产品</span><h2>最受欢迎的几样</h2></div><div class="products reveal">${products}</div></div></section><section class="cta"><div class="container"><h2>想尝一口？</h2><p>联系我们，了解更多产品与服务。</p><a href="/contact/" class="btn">在线联系</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "11-ups") {
    const heroStats = (profile.stats || [["10", "电源行业"], ["2", "产品系列"], ["24", "快速响应"], ["365", "用心服务"]]).slice(0, 4);
    const series = data.services.map((service, index) => {
      const keys = heroStats.slice(0, 3).map(([number, label]) => `<div class="k"><b>${escapeHtml(number)}</b><span>${escapeHtml(label)}</span></div>`).join("");
      return `<div class="s ${index === 0 ? "online" : "backup"} reveal"><div class="ph"><img src="${escapeHtml(industryImage(service, UPS_GALLERY_IMGS[index % UPS_GALLERY_IMGS.length]))}" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"><span>${escapeHtml(service.audience || "产品实拍")}</span></div><span class="tag">${escapeHtml(service.audience || "标准系列")}</span><h3>${escapeHtml(service.title)}</h3><p class="desc">${escapeHtml(service.description || "查看产品能力与适用范围。")}</p><div class="keys">${keys}</div><div class="models"><a href="/contact/">了解详情 →</a></div></div>`;
    }).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">产品系列</span><h2>两大类，先搞清楚区别</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="series">${series}</div></div></section><section class="cta"><div class="container reveal"><h2>不确定该配多大功率？</h2><p>把负载情况发过来，我们帮你算选型。</p><a href="/contact/" class="btn">在线询价</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  if (template.key === "02-construction") {
    const items = data.services.map((service, index) => `<a class="item" href="${escapeHtml(safeUrl(service.href, "link") || "/contact/")}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围、适用对象与交付方式。")}</p></div><span class="go">→</span></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="services"><div class="container wrap"><div class="side"><span class="kicker">服务项目</span><h2>我们能做什么</h2><p>${escapeHtml(profile.serviceSectionLead)}</p><div class="num">${String(Math.min(6, data.services.length)).padStart(2, "0")}</div></div><div class="list reveal">${items}</div></div></section><section class="cta"><div class="container"><h2>有项目想聊聊？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn">联系${escapeHtml(publicBrandName(site))}</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
  }
  const body = `<main id="template-main">${sourcePageHeader(page.title || profile.pageProductTitle, profile.pageProductLead)}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.pageProductTitle)}</h2><p>${escapeHtml(profile.pageProductLead)}</p></div><div class="${template.key === "02-construction" ? "services-grid" : "products-grid"}">${cards}</div></div></section></main>`;
  return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase });
}

function renderSourceCasesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, [], preview);
  if (template.key === "01-industry") {
    const categories = [...new Set(data.cases.map((item) => String(item.industry || item.service || "工程案例").trim()).filter(Boolean))];
    const filter = categories.length ? `<div class="filter" data-case-filter><button class="on" type="button" data-filter="all">全部</button>${categories.map((category) => `<button type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>` : "";
    const caseItems = data.cases.slice(0, 6);
    const casesMarkup = caseItems.map((item, index) => {
      const className = index === 0 ? "case tall" : index === 5 ? "case wide" : "case";
      const inner = index === 0
        ? `<div class="tall-inner"><img src="${escapeHtml(industryImage(item, INDUSTRY_CASE_FALLBACK_IMGS[0]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`
        : `<div class="media-box"><img src="${escapeHtml(industryImage(item, INDUSTRY_CASE_FALLBACK_IMGS[index % INDUSTRY_CASE_FALLBACK_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`;
      return `<a class="${className} reveal" href="/cases/" data-category="${escapeHtml(item.industry || item.service || "工程案例")}"><div class="info"><span class="tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h4>${escapeHtml(item.title)}</h4></div>${inner}</a>`;
    }).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section"><div class="container"><div class="head reveal"><div class="l"><h2>${industrySplitTitle(profile.caseSectionTitle, "工程案例")}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div></div>${filter}<div class="cases reveal">${casesMarkup || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container"><div><h2>想看更多同类项目？</h2><p>联系我们获取更多案例与实施细节。</p></div><a href="/contact/" class="btn btn-light">在线询价</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  const cards = sourceCaseCards(template, data.cases, site);
  if (["03-software-ai", "04-logistics", "07-healthcare", "08-education", "10-food-consumer"].includes(template.key)) {
    const iconKinds = ["gear", "service", "chart", "award", "design", "team"];
    const gridClass = template.key === "04-logistics" ? "services" : template.key === "07-healthcare" ? "svcs" : template.key === "08-education" ? "courses" : template.key === "10-food-consumer" ? "products" : "cards";
    const cardClass = template.key === "07-healthcare" ? "svc" : template.key === "08-education" ? "course" : template.key === "10-food-consumer" ? "product" : "card";
    const rows = data.cases.slice(0, 6).map((item, index) => template.key === "04-logistics"
      ? `<div class="service"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看实施过程与交付结果。")}</p></div>`
      : template.key === "07-healthcare"
      ? `<div class="svc"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看实施过程与交付结果。")}</p></div></div>`
      : template.key === "08-education"
        ? `<div class="course"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看实施过程与交付结果。")}</p><div class="meta"><span class="price">${escapeHtml(item.industry || item.service || "实施案例")}<small></small></span><span class="hours">${escapeHtml(item.service || "已完成")}</span></div></div></div>`
        : template.key === "10-food-consumer"
          ? `<div class="product"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h4>${escapeHtml(item.title)}</h4><div class="price">${escapeHtml(item.industry || item.service || "实施案例")}</div></div></div>`
          : `<div class="card"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看实施过程与交付结果。")}</p></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">${escapeHtml(profile.caseSectionTitle)}</span><h2>${escapeHtml(profile.caseSectionLead)}</h2></div><div class="${gridClass} reveal">${rows || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container"><h2>想了解更多？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn btn-primary">联系我们</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  if (template.key === "05-business-services" || template.key === "06-finance") {
    const rows = data.cases.slice(0, 6).map((item, index) => `<div class="a"><div class="n">${String(index + 1).padStart(2, "0")}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看实施过程与交付结果。")}</p></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">${escapeHtml(profile.caseSectionTitle)}</span><h2>成功案例</h2></div><div class="adv reveal">${rows || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container"><h2>想了解更多？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn btn-primary">联系我们</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  if (template.key === "09-travel-hotel") {
    const rows = data.cases.slice(0, 6).map((item, index) => `<a class="hotel" href="/cases/"><img src="${escapeHtml(industryImage(item, TRAVEL_HOTEL_IMGS[index % TRAVEL_HOTEL_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"><div class="b"><h4>${escapeHtml(item.title)}</h4><div class="loc">${escapeHtml(item.industry || item.service || "精选服务")}</div><div class="foot"><span class="price">${escapeHtml(String(index + 1).padStart(2, "0"))}<small> 案例</small></span><span>${escapeHtml(item.service || "已完成")}</span></div></div></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">${escapeHtml(profile.caseSectionTitle)}</span><h2>精选案例</h2></div><div class="hotels reveal">${rows || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container"><h2>想好去哪了吗？</h2><p>告诉我们时间和预算，帮你规划行程。</p><a href="/contact/" class="btn btn-green">咨询行程</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  if (template.key === "11-ups") {
    const rows = data.cases.slice(0, 6).map((item, index) => `<a class="g" href="/cases/"><img src="${escapeHtml(industryImage(item, UPS_GALLERY_IMGS[index % UPS_GALLERY_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"><span>${escapeHtml(item.industry || item.service || "应用场景")} · ${escapeHtml(item.title)}</span></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section"><div class="container"><div class="head reveal"><span class="kicker">应用场景</span><h2>这些地方都在用</h2></div><div class="gallery reveal">${rows || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container reveal"><h2>不确定该配多大功率？</h2><p>把负载情况发过来，我们帮你算选型。</p><a href="/contact/" class="btn">在线询价</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  if (template.key === "02-construction") {
    const categories = [...new Set(data.cases.map((item) => String(item.industry || item.service || "工程案例").trim()).filter(Boolean))];
    const filter = categories.length ? `<div class="filter" data-case-filter><button class="on" type="button" data-filter="all">全部</button>${categories.map((category) => `<button type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>` : "";
    const widths = ["w1", "", "w3", "", "", "w2"];
    const works = data.cases.slice(0, 6).map((item, index) => `<a class="g ${widths[index] || ""}" href="/cases/" data-category="${escapeHtml(item.industry || item.service || "工程案例")}"><img src="${escapeHtml(industryImage(item, CONSTRUCTION_WORK_IMGS[index % CONSTRUCTION_WORK_IMGS.length]))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"><div class="cap"><span>${escapeHtml(item.industry || item.service || "工程案例")}</span><h4>${escapeHtml(item.title)}</h4></div></a>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="works"><div class="container"><div class="head reveal"><div><span class="kicker">工程案例</span><h2>近期项目</h2></div><a href="/cases/">查看全部 →</a></div>${filter}<div class="gallery reveal">${works || '<div class="template-source-empty">案例内容正在整理中。</div>'}</div></div></section><section class="cta"><div class="container"><h2>有项目想聊聊？</h2><p>${escapeHtml(profile.articleSectionLead)}</p><a href="/contact/" class="btn">联系${escapeHtml(publicBrandName(site))}</a></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase });
  }
  const categories = [...new Set(data.cases.map((item) => String(item.industry || item.service || "工程案例").trim()).filter(Boolean))];
  const filter = template.key === "02-construction" && categories.length ? `<div class="projects-filter" data-case-filter><button class="filter-btn active" type="button" data-filter="all">全部</button>${categories.map((category) => `<button class="filter-btn" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>` : "";
  const filteredCards = template.key === "02-construction" ? data.cases.slice(0, 6).map((item) => `<article class="project-card" data-category="${escapeHtml(item.industry || item.service || "工程案例")}"><div class="project-card-bg">${sourceVisual("template-case-media", item, "building", "工程案例", site)}</div><div class="project-content"><span class="project-tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目实施过程与交付结果。")}</p></div></article>`).join("") : cards;
  const body = `<main id="template-main">${sourcePageHeader(page.title || profile.caseSectionTitle, profile.caseSectionLead)}<section class="section ${template.key === "02-construction" ? "projects" : "cases"}"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div>${filter}<div class="${template.key === "02-construction" ? "projects-grid" : "cases-grid"}">${filteredCards}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${sourceStats(profile, profile.stats)}</div></div></section></main>`;
  return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle, mainEntity: { "@type": "ItemList", numberOfItems: data.cases.length, itemListElement: data.cases.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title })) } }], body, preview, assetBase });
}

function renderSourceAboutPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const data = sourceData(site, [], preview);
  if (template.key === "01-industry") {
    const company = publicCompanyName(site);
    const heroStats = (profile.stats || [["20", "年行业经验"], ["500", "合作客户"], ["50", "专利技术"], ["100", "项目案例"]]).slice(0, 4);
    const figures = heroStats.map(([number, label]) => `<div class="cell"><strong><span data-target="${escapeHtml(number)}">0</span></strong><small>${escapeHtml(label)}</small></div>`).join("");
    const milestones = data.services.slice(0, 4).map((service, index) => `<div class="milestone"><span class="dot"></span><div class="y">${String(index + 1).padStart(2, "0")}</div><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml((service.description || "").slice(0, 30))}</p></div>`).join("");
    const team = data.services.slice(0, 4).map((service) => `<div class="p"><div class="ava">${sourceIcon("team")}</div><h4>${escapeHtml(service.title)}</h4><span>${escapeHtml(service.audience || "团队成员")}</span></div>`).join("");
    const honors = profile.aboutFeatures.slice(0, 3).map((label, index) => `<div class="h">${sourceIcon(["award", "check", "service"][index])}<div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(["以专业能力和严格流程保障交付质量。", "坚持技术创新，持续提升产品与服务。", "以完善服务支持客户长期使用。"][index] || "企业长期积累的资质与能力。")}</p></div></div>`).join("");
    const aboutBg = "/assets/tz-ind-02.jpg";
    const body = `<main id="template-main">${sourcePageHeader(page.title || "关于我们", profile.aboutLead)}<section class="section"><div class="container about"><div class="txt"><h2>关于<span>${escapeHtml(company)}</span></h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p><a href="/contact/" class="btn btn-ghost">联系我们${industryArrowSvg()}</a></div><div class="media"><img src="${escapeHtml(aboutBg)}" alt="${escapeHtml(company)}展示" loading="lazy" decoding="async"><div class="tag"><strong><span data-target="${escapeHtml(heroStats[0]?.[0] || "20")}">0</span>+</strong><small>${escapeHtml(heroStats[0]?.[1] || "年行业经验")}</small></div></div></div></section><section class="figures"><div class="container">${figures}</div></section><section class="section section-2"><div class="container"><div class="head reveal"><div class="l"><h2>业务<span>方向</span></h2></div></div><div class="milestones reveal">${milestones}</div></div></section><section class="section"><div class="container"><div class="head reveal"><div class="l"><h2>核心<span>团队</span></h2><p>管理、技术与项目团队，深耕行业多年。</p></div></div><div class="team reveal">${team}</div></div></section><section class="section section-2"><div class="container"><div class="head reveal"><div class="l"><h2>资质与<span>能力</span></h2></div></div><div class="honors reveal">${honors}</div></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || profile.aboutLead, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase });
  }
  const qualifications = data.services.slice(0, 3).map((service, index) => `<article class="service-card"><div class="service-icon">${sourceIcon(["award", "check", "team"][index])}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || profile.aboutLead)}</p></article>`).join("");
  if (template.key === "02-construction") {
    const company = publicCompanyName(site);
    const heroStats = (profile.stats || [["20", "年行业经验"], ["300", "完成项目"], ["50", "专业团队"], ["98", "客户满意度"]]).slice(0, 3);
    const cols = heroStats.map(([number, label]) => `<div class="c"><strong><span data-target="${escapeHtml(number)}">0</span>+</strong><span>${escapeHtml(label)}</span></div>`).join("");
    const items = data.services.map((service, index) => `<a class="item" href="${escapeHtml(safeUrl(service.href, "link") || "/services/")}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml((service.description || "").slice(0, 24))}</p></div><span class="go">→</span></a>`).join("");
    const team = data.services.slice(0, 4).map((service) => `<div class="p"><div class="ava">${sourceIcon("team")}</div><h4>${escapeHtml(service.title)}</h4><span>${escapeHtml(service.audience || "团队成员")}</span></div>`).join("");
    const story = data.services.slice(0, 4).map((service, index) => `<div class="story-card"><span class="y">${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml((service.description || "").slice(0, 36))}</p></div>`).join("");
    const honors = profile.aboutFeatures.slice(0, 3).map((label, index) => `<div class="h">${sourceIcon(["award", "check", "service"][index])}<div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(["以专业能力与严格流程保障项目交付质量。", "坚持以项目经验服务每一位客户。", "提供贯穿项目全程的服务支持。"][index] || "企业长期积累的能力。")}</p></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || "关于我们", profile.aboutLead)}<section class="intro"><div class="container"><span class="kicker">关于${escapeHtml(publicBrandName(site))}</span><h2>${escapeHtml(site.description || profile.aboutLead)}</h2><p>${escapeHtml(profile.aboutLead)}</p><div class="cols reveal">${cols}</div></div></section><section class="services"><div class="container wrap"><div class="side"><span class="kicker">服务项目</span><h2>我们能做什么</h2><div class="num">${String(Math.min(6, data.services.length)).padStart(2, "0")}</div></div><div class="list reveal">${items}</div></div></section><section class="section"><div class="container"><div class="head reveal"><div><span class="kicker">核心团队</span><h2>团队构成</h2></div></div><div class="team reveal">${team}</div></div></section><section class="section"><div class="container"><div class="head reveal"><div><span class="kicker">发展历程</span><h2>一路走来</h2></div></div><div class="story-grid reveal">${story}</div></div></section><section class="section section-2"><div class="container"><div class="head reveal"><div><span class="kicker">资质与能力</span><h2>荣誉认证</h2></div></div><div class="honors reveal">${honors}</div></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || profile.aboutLead, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase });
  }
  const culture = profile.aboutFeatures.map((label, index) => `<div class="about-feature"><div class="about-feature-icon">${sourceIcon(["check", "design", "award", "team"][index % 4])}</div><h4>${escapeHtml(label)}</h4></div>`).join("");
  if (["03-software-ai", "04-logistics", "05-business-services", "06-finance", "07-healthcare", "08-education", "09-travel-hotel", "10-food-consumer", "11-ups"].includes(template.key)) {
    const company = publicCompanyName(site);
    const services = data.services.slice(0, 4);
    const aboutBg = "/assets/tz-ind-02.jpg";
    const intro = `<section class="section"><div class="container"><div class="head reveal"><span class="kicker">关于${escapeHtml(publicBrandName(site))}</span><h2>${escapeHtml(site.description || profile.aboutLead)}</h2><p>${escapeHtml(profile.aboutLead)}</p></div><div class="about-copy"><p>${escapeHtml(profile.aboutLead)}</p></div></div></section>`;
    const teamMarkup = services.map((service) => template.key === "07-healthcare"
      ? `<div class="svc"><div class="ic">${sourceIcon("team")}</div><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.audience || "团队成员")}</p></div></div>`
      : template.key === "08-education"
        ? `<div class="teacher"><div class="ava"><img src="/assets/tz-08-education-02.jpg" alt="${escapeHtml(service.title)}" loading="lazy" decoding="async"></div><h4>${escapeHtml(service.title)}</h4><div class="subject">${escapeHtml(service.audience || "专业教师")}</div></div>`
        : template.key === "11-ups"
          ? `<div class="a"><div class="ic">${escapeHtml(String(service.title).slice(0, 1))}</div><div><h4>${escapeHtml(service.title)}</h4><p>${escapeHtml(service.audience || "团队成员")}</p></div></div>`
          : `<div class="p"><div class="ava">${sourceIcon("team")}</div><h4>${escapeHtml(service.title)}</h4><span>${escapeHtml(service.audience || "团队成员")}</span></div>`).join("");
    const teamGridClass = template.key === "07-healthcare" ? "svcs" : template.key === "08-education" ? "teachers" : template.key === "11-ups" ? "adv" : "team";
    const milestoneMarkup = services.map((service, index) => {
      const title = escapeHtml(service.title);
      const desc = escapeHtml((service.description || "").slice(0, 30));
      const no = String(index + 1).padStart(2, "0");
      switch (template.key) {
        case "03-software-ai": return `<div class="ver"><span class="v">V${no}</span><div><h4>${title}</h4><p>${desc}</p></div></div>`;
        case "04-logistics": return `<div class="m"><div class="y">${no}</div><div class="num">${title}</div><h4>${title}</h4><p>${desc}</p></div>`;
        case "05-business-services": return `<div class="zig"><div class="txt"><h4>${title}</h4><p>${desc}</p></div><div class="y">${no}</div><div class="blank"></div></div>`;
        case "06-finance": return `<div class="m-node"><div class="y">${no}</div><div class="big">${title}</div><h4>${title}</h4><p>${desc}</p></div>`;
        case "07-healthcare": return `<div class="m-step"><div class="ic">${sourceIcon("award")}</div><div class="y">${no}</div><h4>${title}</h4><p>${desc}</p></div>`;
        case "08-education": return `<div class="a"><div class="ic">${sourceIcon("check")}</div><h3>${title}</h3><p>${desc}</p></div>`;
        case "09-travel-hotel": return `<div class="svc"><div class="ic">${sourceIcon("pin")}</div><h4>${title}</h4><p>${desc}</p></div>`;
        case "10-food-consumer": return `<span class="y">${no}</span><p>${title}：${desc}</p>`;
        case "11-ups": return `<div class="scene"><div class="ic">${sourceIcon("gear")}</div><h4>${title}</h4><p>${desc}</p></div>`;
        default: return "";
      }
    }).join("");
    const milestoneClass = template.key === "03-software-ai" ? "changelog" : template.key === "04-logistics" ? "miles" : template.key === "05-business-services" ? "zigzag" : template.key === "06-finance" ? "milestones" : template.key === "07-healthcare" ? "milestones" : template.key === "08-education" ? "adv" : template.key === "09-travel-hotel" ? "svcs" : template.key === "10-food-consumer" ? "story-text" : "scenes";
    const honors = profile.aboutFeatures.slice(0, 3).map((label, index) => `<div class="h">${sourceIcon(["award", "check", "service"][index])}<div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(["以专业能力与严格流程保障交付质量。", "坚持技术创新，持续提升产品与服务。", "以完善服务支持客户长期使用。"][index] || "企业长期积累的资质与能力。")}</p></div></div>`).join("");
    const body = `<main id="template-main">${sourcePageHeader(page.title || "关于我们", profile.aboutLead)}${intro}<section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">核心团队</span><h2>团队构成</h2></div><div class="${teamGridClass} reveal">${teamMarkup}</div></div></section><section class="section"><div class="container"><div class="head reveal"><span class="kicker">发展历程</span><h2>一路走来</h2></div><div class="${milestoneClass} reveal">${milestoneMarkup}</div></div></section><section class="section section-gray"><div class="container"><div class="head reveal"><span class="kicker">资质与能力</span><h2>荣誉认证</h2></div><div class="honors reveal">${honors}</div></div></section></main>`;
    return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || profile.aboutLead, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase });
  }
  const body = `<main id="template-main">${sourcePageHeader(page.title || "关于我们", profile.aboutLead)}<section class="section"><div class="container"><div class="about-intro">${sourceVisual("about-intro-image", {}, template.key === "02-construction" ? "building" : "factory", "企业展示图片", site)}<div class="about-intro-text"><h2>公司简介</h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p></div></div></div></section><section class="section" style="background: var(--bg-light);"><div class="container"><div class="section-header"><h2>${template.key === "02-construction" ? "资质与服务" : "企业能力"}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="services-grid">${qualifications}</div></div></section><section class="section"><div class="container"><div class="section-header"><h2>企业文化</h2><p>${escapeHtml(profile.heroTitle)}</p></div><div class="about-features" style="max-width: 800px; margin: 0 auto; grid-template-columns: repeat(2, 1fr);">${culture}</div></div></section></main>`;
  return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || profile.aboutLead, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase });
}

function renderSourceContactPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const contactBody = sourceContactBlock(site, template, page.path || "/contact/");
  const body = `<main id="template-main">${sourcePageHeader(page.title || "联系我们", profile.articleSectionLead)}${contactBody.replace('<section class="section contact">', '<section class="section contact">')}</main>`;
  return documentShell({ site, origin, pathname: page.path || "/contact/", title: page.title || "联系我们", description: page.seoDescription || profile.articleSectionLead, active: "/contact/", schemaExtra: [{ "@type": "ContactPage", name: page.title || "联系我们" }], body, preview, assetBase });
}

function renderSourceInsightsPage({ site, articles, categories = [], selectedCategory = null, origin, page = 1, pageSize = 12, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const profile = sourceTemplateProfile(template);
  const displayCategories = frontendCategories(categories);
  const rows = frontendArticles(articles, site.frontendDemo).filter((article) => !selectedCategory || article.categorySlug === selectedCategory.slug || article.categoryName === selectedCategory.name);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 12));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const activePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const start = (activePage - 1) * safePageSize;
  const visible = rows.slice(start, start + safePageSize);
  const cards = template.key === "01-industry"
    ? `<div class="news-list">${visible.map((article) => `<article class="news-item"><div class="news-item-image">${sourceVisual("template-news-media", article, "news", "新闻封面", site)}</div><div class="news-item-content"><div class="news-item-date">${escapeHtml(dateShort(article.publishedAt))}</div><h3><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p><a class="news-more" href="${escapeHtml(articleLink(article))}">阅读全文 <span aria-hidden="true">→</span></a></div></article>`).join("")}</div>`
    : template.key === "02-construction"
      ? `<div class="news-list">${visible.map((article, index) => `<a class="n" href="${escapeHtml(articleLink(article))}"><img src="${escapeHtml(industryImage(article, CONSTRUCTION_NEWS_IMGS[index % CONSTRUCTION_NEWS_IMGS.length]))}" alt="${escapeHtml(article.title)}" loading="lazy" decoding="async"><div class="b"><span class="date">${escapeHtml(dateShort(article.publishedAt))}</span><h4>${escapeHtml(article.title)}</h4></div></a>`).join("")}</div>`
      : ["03-software-ai", "04-logistics", "05-business-services", "06-finance", "07-healthcare", "08-education", "09-travel-hotel", "10-food-consumer", "11-ups"].includes(template.key)
        ? (() => {
          const layout = {
            "03-software-ai": { grid: "cards", card: "card", icon: true, titleTag: "h3", lead: (a) => a.excerpt },
            "04-logistics": { grid: "services", card: "service", icon: true, titleTag: "h3", lead: (a) => a.excerpt },
            "05-business-services": { grid: "svc-list", card: "svc", icon: false, titleTag: "h3", lead: (a) => a.excerpt },
            "06-finance": { grid: "products", card: "product", icon: true, titleTag: "h3", lead: (a) => a.excerpt },
            "07-healthcare": { grid: "svcs", card: "svc", icon: true, titleTag: "h3", lead: (a) => a.excerpt },
            "08-education": { grid: "courses", card: "course", icon: true, titleTag: "h3", lead: (a) => a.excerpt },
            "09-travel-hotel": { grid: "hotels", card: "hotel", icon: false, titleTag: "h4", lead: (a) => a.excerpt },
            "10-food-consumer": { grid: "products", card: "product", icon: true, titleTag: "h4", lead: (a) => a.excerpt },
            "11-ups": { grid: "gallery", card: "g", icon: false, titleTag: "h4", lead: (a) => a.excerpt }
          }[template.key];
          const iconKinds = ["news", "gear", "service", "chart", "award", "design", "team", "building", "factory", "pin", "clock", "check"];
          const rows = visible.map((article, index) => {
            const date = escapeHtml(dateShort(article.publishedAt));
            const title = escapeHtml(article.title);
            const lead = escapeHtml((article.excerpt || "").slice(0, 60));
            const href = escapeHtml(articleLink(article));
            if (template.key === "09-travel-hotel") return `<a class="hotel" href="${href}"><div class="b"><h4>${title}</h4><div class="loc">${date}</div><div class="foot"><span class="price">${lead.slice(0, 14)}</span></div></div></a>`;
            if (template.key === "11-ups") return `<a class="g" href="${href}"><span>${date} · ${title}</span></a>`;
            if (template.key === "05-business-services") return `<a class="svc" href="${href}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${title}</h3><p>${date} · ${lead}</p></div><span class="go">→</span></a>`;
            if (template.key === "06-finance") return `<div class="product"><div class="ic">${escapeHtml(String(article.title).slice(0, 1))}</div><h3>${title}</h3><p>${date} · ${lead}</p><div class="rate">${escapeHtml(article.categoryName || "行业资讯")}<small></small></div></div>`;
            if (template.key === "08-education") return `<div class="course"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h3><a href="${href}">${title}</a></h3><p>${date} · ${lead}</p><div class="meta"><span class="price">${escapeHtml(article.categoryName || "校园动态")}</span></div></div></div>`;
            if (template.key === "10-food-consumer") return `<div class="product"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h4><a href="${href}">${title}</a></h4><div class="price">${date}</div></div></div>`;
            return `<a class="${layout.card}" href="${href}" style="display:block;text-decoration:none;">${layout.icon ? `<div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div>` : ""}<${layout.titleTag}>${title}</${layout.titleTag}><p>${date} · ${lead}</p></a>`;
          }).join("");
          return `<div class="${layout.grid}">${rows}</div>`;
        })()
        : `<div class="news-grid">${visible.map((article) => `<article class="news-card"><div class="news-image">${sourceVisual("template-news-media", article, "news", "新闻封面", site)}</div><div class="news-content"><div class="news-date">${escapeHtml(dateShort(article.publishedAt))}</div><h3><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p></div></article>`).join("")}</div>`;
  const canonicalBase = selectedCategory ? categoryLink(selectedCategory) : "/insights/";
  const pagePath = activePage > 1 ? `${canonicalBase}?page=${activePage}` : canonicalBase;
  const collectionUrl = absoluteUrl(origin, pagePath);
  const title = selectedCategory?.name || "新闻动态";
  const description = selectedCategory?.seoDescription || selectedCategory?.description || profile.articleSectionLead;
  const categoryRows = displayCategories
    .filter((item) => item.status !== "archived" && item.navVisible !== false)
    .map((category) => `<a${selectedCategory?.slug === category.slug ? " class=\"active\" aria-current=\"page\"" : ""} href="${escapeHtml(categoryLink(category))}"><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.description || "企业公开内容")}</small></a>`)
    .join("");
  const paginationMarkup = pagination(origin, canonicalBase, activePage, totalPages);
  const body = `<main id="template-main">${sourcePageHeader(title, description)}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(selectedCategory?.name || "最新资讯")}</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div>${cards || '<p class="template-source-empty">当前栏目暂未发布文章。</p>'}${paginationMarkup}</div></section></main>`;
  const schemaExtra = [{
    "@type": "CollectionPage",
    "@id": collectionUrl,
    name: title,
    url: collectionUrl,
    description,
    isPartOf: { "@id": entityId(origin, "website") },
    mainEntity: { "@type": "ItemList", numberOfItems: total, itemListElement: visible.map((article, index) => ({ "@type": "ListItem", position: start + index + 1, name: article.title, url: absoluteUrl(origin, articleLink(article)) })) }
  }, {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: origin },
      { "@type": "ListItem", position: 2, name: "新闻动态", item: absoluteUrl(origin, "/insights/") },
      ...(selectedCategory ? [{ "@type": "ListItem", position: 3, name: selectedCategory.name, item: absoluteUrl(origin, categoryLink(selectedCategory)) }] : [])
    ]
  }];
  const headLinks = [
    ...(activePage > 1 ? [{ rel: "prev", href: absoluteUrl(origin, activePage === 2 ? canonicalBase : `${canonicalBase}?page=${activePage - 1}`) }] : []),
    ...(activePage < totalPages ? [{ rel: "next", href: absoluteUrl(origin, `${canonicalBase}?page=${activePage + 1}`) }] : [])
  ];
  return documentShell({ site, origin, pathname: pagePath, title: activePage > 1 ? `${title} · 第 ${activePage} 页` : title, description, active: "/insights/", schemaExtra, body, preview, assetBase, headLinks });
}

function sourceProblemMapCards(template, rows) {
  const key = template.key;
  const iconKinds = ["service", "chart", "gear", "award", "team", "check", "news", "pin", "clock", "design", "factory", "building"];
  const link = (row) => `/problem-map/${encodeURIComponent(row.slug)}/`;
  if (key === "01-industry" || key === "02-construction") {
    return `<div class="${key === "02-construction" ? "services-grid" : "products-grid"}">${rows.map((row, index) => `<article class="${key === "02-construction" ? "service-card" : "product-card"}"><div class="${key === "02-construction" ? "service-icon" : "product-image"}">${sourceIcon(index % 2 ? "chart" : "service")}</div><div class="${key === "01-industry" ? "product-content" : ""}"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.answer)}</p><a class="${key === "02-construction" ? "btn btn-outline" : "product-link"}" href="${escapeHtml(link(row))}">查看回答 <span aria-hidden="true">→</span></a></div></article>`).join("")}</div>`;
  }
  if (key === "05-business-services") {
    return `<div class="svc-list">${rows.map((row, index) => `<a class="svc" href="${escapeHtml(link(row))}"><span class="no">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.answer)}</p></div><span class="go">→</span></a>`).join("")}</div>`;
  }
  if (key === "06-finance") {
    return `<div class="products">${rows.map((row, index) => `<div class="product"><div class="ic">${escapeHtml(String(row.title).slice(0, 1))}</div><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml((row.answer || "").slice(0, 60))}</p><a class="btn btn-gold" href="${escapeHtml(link(row))}">查看回答</a></div>`).join("")}</div>`;
  }
  if (key === "08-education") {
    return `<div class="courses">${rows.map((row, index) => `<a class="course" href="${escapeHtml(link(row))}" style="display:block;text-decoration:none;"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml((row.answer || "").slice(0, 60))}</p><div class="meta"><span class="price">查看回答</span><span class="hours">${escapeHtml(row.group?.title || "常见问题")}</span></div></div></a>`).join("")}</div>`;
  }
  if (key === "10-food-consumer") {
    return `<div class="products">${rows.map((row, index) => `<div class="product"><div class="media">${sourceIcon(iconKinds[index % iconKinds.length])}</div><div class="b"><h4>${escapeHtml(row.title)}</h4><div class="price">${escapeHtml((row.answer || "").slice(0, 30))}</div></div></div>`).join("")}</div>`;
  }
  if (key === "11-ups") {
    return `<div class="scenes">${rows.map((row, index) => `<div class="scene"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><h4>${escapeHtml(row.title)}</h4><p>${escapeHtml((row.answer || "").slice(0, 50))}</p><a class="btn btn-amber" href="${escapeHtml(link(row))}">查看回答</a></div>`).join("")}</div>`;
  }
  const grid = key === "04-logistics" ? "services" : key === "07-healthcare" ? "svcs" : key === "09-travel-hotel" ? "svcs" : "cards";
  const card = key === "04-logistics" ? "service" : key === "07-healthcare" ? "svc" : key === "09-travel-hotel" ? "svc" : "card";
  const titleTag = key === "09-travel-hotel" ? "h4" : "h3";
  return `<div class="${grid}">${rows.map((row, index) => `<a class="${card}" href="${escapeHtml(link(row))}" style="display:block;text-decoration:none;"><div class="ic">${sourceIcon(iconKinds[index % iconKinds.length])}</div><${titleTag}>${escapeHtml(row.title)}</${titleTag}><p>${escapeHtml((row.answer || "").slice(0, 60))}</p></a>`).join("")}</div>`;
}

function renderSourceProblemMapPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = sourceTemplateFor(site);
  const groups = frontendProblemGroups(site, preview);
  const rows = groups.flatMap((group) => group.questions.slice(0, 6).map((problem) => ({ ...problem, group })));
  const cards = sourceProblemMapCards(template, rows);
  const body = `<main id="template-main">${sourcePageHeader(page.title || "客户问题", "从客户真实问题出发，理解企业的产品、服务与下一步。")}<section class="section"><div class="container"><div class="section-header"><h2>客户正在问什么</h2><p>每个问题都连接到直接回答与咨询入口。</p></div>${cards}</div></section></main>`;
  const schemaExtra = [{
    "@type": "FAQPage",
    name: page.title || "客户问题地图",
    mainEntity: rows.map((problem) => ({
      "@type": "Question",
      "@id": `${absoluteUrl(origin, `/problem-map/${encodeURIComponent(problem.slug)}/`)}#question`,
      name: problem.title,
      acceptedAnswer: { "@type": "Answer", "@id": `${absoluteUrl(origin, `/problem-map/${encodeURIComponent(problem.slug)}/`)}#answer`, text: problem.answer }
    }))
  }];
  return documentShell({ site, origin, pathname: page.path || "/problem-map/", title: page.title || "客户问题", description: page.seoDescription || "客户问题与直接回答。", active: "/problem-map/", schemaExtra, body, preview, assetBase });
}

function renderSourceArticleBody({ site, article, template, contentHtml, provenanceNote }) {
  const profile = sourceTemplateProfile(template);
  return `<main id="template-main">${sourcePageHeader(article.categoryName || "新闻动态", article.excerpt || profile.articleSectionLead)}<section class="section"><div class="container"><article class="template-source-article"><div class="news-date">${escapeHtml(dateShort(article.publishedAt))}</div><h2>${escapeHtml(article.title)}</h2>${article.excerpt ? `<p class="template-source-article-lead">${escapeHtml(article.excerpt)}</p>` : ""}<div class="template-source-article-content">${contentHtml}</div><p class="template-source-article-note">${provenanceNote}</p></article></div></section></main>`;
}

function sourceDocumentShell({ site, origin, pathname, title, description, active, schemaExtra = [], body, robots = "index,follow,max-image-preview:large,max-snippet:-1", feed = true, preview = false, assetBase = "/site-assets-r6", headLinks = [], openGraphType = "website", headMeta = [], activeTemplate = sourceTemplateFor(site) }) {
  const canonical = absoluteUrl(origin, pathname);
  const configuredPage = pageForPath(site, pathname);
  const schema = pageSchema(site, origin, pathname, schemaExtra, { pageEnabled: configuredPage?.schemaEnabled !== false, name: pageTitle(site, title), description: description || site.description || DEFAULT_DESCRIPTION });
  const cssRoot = assetRoot(assetBase, "/site-assets-r9");
  const imageRoot = assetRoot(assetBase, "/assets");
  const cssHref = `${cssRoot}/${activeTemplate.stylesheet}?v=20260827-tpl-01-11-refactor-v1`;
  const sharedFixesHref = `${cssRoot}/template-source-fixes.css?v=20260828-tpl-shared-fixes-v1`;
  const runtimeHref = `${cssRoot}/template-runtime.js?v=20260827-tpl-01-11-refactor-v1`;
  const brandMark = siteFavicon(site, imageRoot);
  const socialImage = absoluteResourceUrl(origin, configuredBrandLogo(site, imageRoot, activeTemplate)) || absoluteResourceUrl(origin, brandMark);
  const extraLinks = headLinks.filter((item) => item?.rel && item?.href).map((item) => `<link rel="${escapeHtml(item.rel)}" href="${escapeHtml(item.href)}">`).join("");
  const extraMeta = headMeta.filter((item) => item?.content && (item?.name || item?.property)).map((item) => `<meta ${item.property ? `property="${escapeHtml(item.property)}"` : `name="${escapeHtml(item.name)}"`} content="${escapeHtml(item.content)}">`).join("");
  const renderedBody = renderDirectionalIcons(body);
  const sourceBody = /<main\b/i.test(renderedBody) ? renderedBody : `<main id="template-main">${renderedBody}</main>`;
  const templateNumber = activeTemplate.key.slice(0, 2);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(pageTitle(site, title))}</title><meta name="description" content="${escapeHtml(description || site.description || DEFAULT_DESCRIPTION)}"><meta name="robots" content="${escapeHtml(preview ? "noindex,nofollow,noarchive" : robots)}"><meta name="author" content="${escapeHtml(publicCompanyName(site))}"><link rel="icon" type="image/png" href="${escapeHtml(brandMark)}"><link rel="canonical" href="${escapeHtml(canonical)}">${extraLinks}${feed && !preview ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(publicBrandName(site))}新闻动态" href="/feed.xml">` : ""}<meta property="og:title" content="${escapeHtml(pageTitle(site, title))}"><meta property="og:description" content="${escapeHtml(description || site.description || DEFAULT_DESCRIPTION)}"><meta property="og:type" content="${escapeHtml(openGraphType)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="${escapeHtml(publicBrandName(site))}"><meta property="og:locale" content="zh_CN">${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}"><meta property="og:image:alt" content="${escapeHtml(publicBrandName(site) || "企业官网")}">` : ""}<meta name="twitter:card" content="${socialImage ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(pageTitle(site, title))}"><meta name="twitter:description" content="${escapeHtml(description || site.description || DEFAULT_DESCRIPTION)}">${socialImage ? `<meta name="twitter:image" content="${escapeHtml(socialImage)}">` : ""}${extraMeta}<meta name="theme-color" content="${escapeHtml(activeTemplate.accent)}"><link rel="stylesheet" href="${cssHref}"><link rel="stylesheet" href="${sharedFixesHref}"><script type="application/ld+json">${safeJsonLd(schema)}</script></head><body class="template-source template-source-${templateNumber}${preview ? " is-preview" : ""}" data-site-template="${escapeHtml(activeTemplate.key)}"><a class="template-skip" href="#template-main">跳到正文</a>${sourceNavigation(site, active, activeTemplate, imageRoot)}${sourceBody}${sourceFooter(site, activeTemplate, imageRoot)}<script src="${runtimeHref}" defer></script></body></html>`;
}

function documentShell({ site, origin, pathname, title, description, active, schemaExtra = [], body, robots = "index,follow,max-image-preview:large,max-snippet:-1", feed = true, preview = false, assetBase = "/site-assets-r6", headLinks = [], openGraphType = "website", headMeta = [], bodyClass = "" }) {
  const canonical = absoluteUrl(origin, pathname);
  const configuredPage = pageForPath(site, pathname);
  const schema = pageSchema(site, origin, pathname, schemaExtra, {
    pageEnabled: configuredPage?.schemaEnabled !== false,
    name: pageTitle(site, title),
    description: description || site.description || DEFAULT_DESCRIPTION
  });
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key) || LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) {
    return sourceDocumentShell({ site, origin, pathname, title, description, active, schemaExtra, body, robots, feed, preview, assetBase, headLinks, openGraphType, headMeta, activeTemplate });
  }
  const primary = /^#[0-9a-f]{6}$/i.test(site.theme?.primaryColor || "") ? site.theme.primaryColor : activeTemplate.accent;
  const metaDescription = description || site.description || DEFAULT_DESCRIPTION;
  const resolvedTitle = pageTitle(site, title);
  const cssRoot = assetRoot(assetBase, "/site-assets-r9");
  const imageRoot = assetRoot(assetBase, "/assets");
  const cssHref = `${cssRoot}/site-v8.css?v=20260827-tpl-01-11-refactor-v1`;
  const gsapHref = `${cssRoot}/gsap.min.js?v=20260818-template-source-css`;
  const jsHref = `${cssRoot}/site-v8.js?v=20260818-template-source-css`;
  const brandMark = siteFavicon(site, imageRoot);
  const socialImage = absoluteResourceUrl(origin, configuredBrandLogo(site, imageRoot, activeTemplate)) || absoluteResourceUrl(origin, brandMark);
  const templateLinks = activeTemplate.key === "02-construction" ? [{ rel: "stylesheet", href: `${cssRoot}/template-02-construction.css?v=20260818-source-adapter2` }] : [];
  const extraLinks = headLinks.filter((item) => item?.rel && item?.href).map((item) => `<link rel="${escapeHtml(item.rel)}" href="${escapeHtml(item.href)}">`).join("");
  const templateStyles = templateLinks.filter((item) => item?.rel && item?.href).map((item) => `<link rel="${escapeHtml(item.rel)}" href="${escapeHtml(item.href)}">`).join("");
  const extraMeta = headMeta.filter((item) => item?.content && (item?.name || item?.property)).map((item) => `<meta ${item.property ? `property="${escapeHtml(item.property)}"` : `name="${escapeHtml(item.name)}"`} content="${escapeHtml(item.content)}">`).join("");
  const renderedBody = renderDirectionalIcons(body);
  const publicNavigation = activeTemplate.key === "02-construction" ? constructionNavigation(site, active, imageRoot) : navigation(site, active, imageRoot);
  const publicFooter = activeTemplate.key === "02-construction" ? constructionFooter(site) : footer(site, imageRoot);
  return `<!doctype html><html lang="zh-CN" style="--brand:${escapeHtml(primary)};--template-accent:${escapeHtml(activeTemplate.accent)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(resolvedTitle)}</title><meta name="description" content="${escapeHtml(metaDescription)}"><meta name="robots" content="${escapeHtml(preview ? "noindex,nofollow,noarchive" : robots)}"><meta name="author" content="${escapeHtml(publicCompanyName(site))}"><link rel="icon" type="image/png" href="${brandMark}"><link rel="canonical" href="${escapeHtml(canonical)}">${extraLinks}${feed && !preview ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(publicBrandName(site))}行业资讯" href="/feed.xml">` : ""}<meta property="og:title" content="${escapeHtml(resolvedTitle)}"><meta property="og:description" content="${escapeHtml(metaDescription)}"><meta property="og:type" content="${escapeHtml(openGraphType)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="${escapeHtml(publicBrandName(site))}"><meta property="og:locale" content="zh_CN">${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}"><meta property="og:image:alt" content="${escapeHtml(publicBrandName(site) || "企业官网")}">` : ""}<meta name="twitter:card" content="${socialImage ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(resolvedTitle)}"><meta name="twitter:description" content="${escapeHtml(metaDescription)}">${socialImage ? `<meta name="twitter:image" content="${escapeHtml(socialImage)}">` : ""}${extraMeta}<meta name="theme-color" content="#160f11"><link rel="stylesheet" href="${cssHref}">${templateStyles}<script type="application/ld+json">${safeJsonLd(schema)}</script></head><body class="site-v8 ${templateClass(site)}${bodyClass ? ` ${escapeHtml(bodyClass)}` : ""}${preview ? " is-preview" : ""}" data-site-template="${escapeHtml(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY)}" data-site-template-name="${escapeHtml(activeTemplate.name)}"><!--
THESIS: the website behaves like a living enterprise source passport; it refuses generic AI dashboards and decorative futurism.
OWN-WORLD: oxblood leather, smoked black, warm ivory paper, old-gold rules, archival stamps and stitched records.
STORY: visitors identify the enterprise, inspect its GEO method as signed source records, read verified content, then request a source-file review.
FIRST VIEWPORT: a centered open evidence dossier anchors the fold; the offer sits left and a vertical fact-to-source endorsement chain sits right.
FORM: verification passport, approved composition 02; concept seed challenger-passport; user-confirmed on 2026-08-10.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
--><a class="skip-link" href="#main">跳到正文</a>${publicNavigation}<main id="main">${renderedBody}</main>${publicFooter}<script src="${gsapHref}" defer></script><script src="${jsHref}" defer></script></body></html>`;
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
  return `<form class="lead-form" data-lead-form><div class="form-grid"><label><span>姓名 *</span><input name="name" autocomplete="name" maxlength="80" required></label><label><span>联系电话 *</span><input name="phone" autocomplete="tel" maxlength="60" required></label><label><span>企业名称</span><input name="company" autocomplete="organization" maxlength="160"></label><label><span>咨询方向</span><select name="service"><option value="业务咨询">业务咨询</option>${(site.businessLines || []).slice(0, 10).map((line) => `<option value="${escapeHtml(line.product || line.name)}">${escapeHtml(line.product || line.name)}</option>`).join("")}</select></label></div><label><span>需要解决的问题</span><textarea name="message" rows="5" maxlength="2000" placeholder="请描述企业现状、目标和当前遇到的问题"></textarea></label><input type="hidden" name="source_url" value="${escapeHtml(sourcePath)}"><div class="form-submit"><button class="button ink" type="submit">提交业务咨询 <span aria-hidden="true">→</span></button><p data-form-message role="status">提交后由企业运营人员在后台跟进。</p></div></form>`;
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

function frontendCategories(categories = []) {
  if (categories.length) return categories;
  return [
    { id: "geo", name: "GEO优化", slug: "geo", description: "企业 GEO 方法、信源建设与 AI 搜索" },
    { id: "enterprise-ai", name: "企业AI落地", slug: "enterprise-ai", description: "企业知识、AI 应用与流程落地" },
    { id: "short-video", name: "短视频运营", slug: "short-video", description: "短视频获客、账号运营与内容策略" }
  ];
}

function frontendArticles(articles = [], demo = false) {
  return articles.length || !demo ? articles : FRONTEND_ARTICLES.map((article) => ({ ...article, isDemo: true }));
}

function visibleCmsRecords(records = [], preview = false) {
  return records.filter((item) => item && item.status !== "archived" && (preview || item.status !== "draft"))
    .slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function frontendServices(site, preview = false) {
  if (Array.isArray(site.services)) return visibleCmsRecords(site.services, preview);
  if (Array.isArray(site.businessLines) && site.businessLines.length) {
    return visibleCmsRecords(site.businessLines, preview).map((item, index) => ({
      id: item.id || `business-line-${index + 1}`,
      title: item.product || item.name || `业务线 ${index + 1}`,
      description: item.description || item.positioning || item.audience || "查看服务范围、适用对象与交付方式。",
      audience: item.audience || "",
      focus: item.positioning || "",
      meta: item.positioning || (Array.isArray(item.keywords) && item.keywords.length ? item.keywords.join(" · ") : ""),
      icon: item.icon || ["building", "service", "chart", "gear", "design", "award"][index % 6]
    }));
  }
  return site.frontendDemo ? FRONTEND_SERVICES : [];
}

function frontendCases(site, preview = false) {
  if (Array.isArray(site.cases)) return visibleCmsRecords(site.cases, preview);
  return site.frontendDemo ? FRONTEND_CASES : [];
}

function frontendProblemGroups(site, preview = false) {
  if (!Array.isArray(site.problemGroups)) return site.frontendDemo ? FRONTEND_PROBLEM_GROUPS : [];
  return visibleCmsRecords(site.problemGroups, preview).map((group) => ({
    ...group,
    questions: visibleCmsRecords(Array.isArray(group.questions) ? group.questions : [], preview)
  })).filter((group) => group.questions.length);
}

function serviceCard(service, index, detailed = false) {
  const href = safeUrl(service.href || "/contact/") || "/contact/";
  const focus = service.cmsFocus || service.focus;
  const meta = [service.audience ? `<span><b>适合对象</b>${escapeHtml(service.audience)}</span>` : "", focus ? `<span><b>工作重点</b>${escapeHtml(focus)}</span>` : ""].join("");
  return `<article class="service-card${detailed ? " service-card-detailed" : ""}" id="${escapeHtml(service.id)}">${optionalMedia(service.image, service.imageAlt, "服务图片") }<div class="service-card-top"><span class="service-label">${escapeHtml(service.eyebrow || "SERVICE")}</span></div><div class="service-card-copy"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p></div>${detailed && meta ? `<div class="service-card-meta">${meta}</div>` : ""}<a class="card-link" href="${escapeHtml(href)}">${detailed ? "讨论这项服务" : "了解服务"}<span aria-hidden="true">↗</span></a></article>`;
}

function compactArticleCard(article) {
  const url = articleLink(article);
  return `<article class="compact-article-card">${optionalMedia(article.image, article.imageAlt, "文章封面")}<div class="compact-article-meta"><span>${escapeHtml(article.categoryName || "行业观点")}</span><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time></div>${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<h3><a href="${escapeHtml(url)}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p><a class="card-link" href="${escapeHtml(url)}">阅读全文<span aria-hidden="true">↗</span></a></article>`;
}

function caseCard(item, index) {
  return `<article class="case-card" data-case-industry="${escapeHtml(item.industry)}">${optionalMedia(item.image, item.imageAlt, "案例图片")}<div class="case-card-head"><small>${escapeHtml(item.industry)} · ${escapeHtml(item.service)}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="case-result"><b>形成结果</b><span>${escapeHtml(item.result)}</span></div></article>`;
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
  const contentArticles = frontendArticles(articles, site.frontendDemo);
  const groups = frontendProblemGroups(site, preview);
  const FRONTEND_SERVICES = frontendServices(site, preview);
  const FRONTEND_CASES = frontendCases(site, preview);
  const casesPageAvailable = preview || publicFixedPageAvailable(site, "/cases/");
  const featuredProblems = groups.flatMap((group) => group.questions.slice(0, 2).map((problem) => ({ problem, group }))).slice(0, 4);
  const heroDescription = moduleText(hero, "围绕 GEO 服务、企业 AI 落地与短视频运营，建立一套可解释、可审核、可持续的企业公开表达系统。");
  const serviceSummary = FRONTEND_SERVICES.length ? `当前公开 ${FRONTEND_SERVICES.length} 项服务，可从最重要的一项开始。` : "服务内容将在完成审核后公开。";
  const brandName = escapeHtml(site.siteName || "企业官网");
  const casesSection = FRONTEND_CASES.length ? `<section class="section home-cases-v3"><div class="shell"><div class="home-section-heading"><span class="kicker">SERVICE SCENARIOS</span><h2>把复杂的企业现状，<span>拆成可推进的工作。</span></h2><p>每一个实施场景都从企业事实、客户问题与内容节奏出发，明确可交付、可复盘的下一步。</p></div><div class="case-grid home-case-grid">${FRONTEND_CASES.map(caseCard).join("")}</div>${casesPageAvailable ? `<div class="section-action home-section-action"><a class="button secondary" href="/cases/">查看服务案例 <span aria-hidden="true">↗</span></a></div>` : ""}</div></section>` : "";
  const problemsSection = featuredProblems.length ? `<section class="section home-problems-v3"><div class="shell"><div class="home-section-heading home-section-heading-split"><div><span class="kicker">QUESTION MAP</span><h2>从客户真正会问的<span>问题开始。</span></h2></div><p>每个问题都连接直接回答、相关内容和适用服务，让下一步判断更清楚。</p></div><div class="problem-grid home-problem-grid">${featuredProblems.map(({ problem, group }) => problemCard(problem, group)).join("")}</div><div class="home-section-action"><a class="text-link" href="/problem-map/">查看全部问题地图 <span>↗</span></a></div></div></section>` : "";
  const insightsSection = `<section class="section home-insights-v3"><div class="shell"><div class="home-section-heading home-section-heading-split"><div><span class="kicker">INSIGHTS</span><h2>持续回答行业里的<span>关键问题。</span></h2></div><p>围绕客户真实问题，持续发布经过审核的行业内容，沉淀为企业可复用的公开资产。</p></div><div class="compact-article-grid home-article-grid">${contentArticles.slice(0, 3).map(compactArticleCard).join("") || '<div class="empty-copy"><h3>行业内容正在建设</h3><p>通过审核并发布的内容会自动出现在这里。</p></div>'}</div><div class="home-section-action"><a class="text-link" href="/insights/">进入行业资讯 <span>↗</span></a></div></div></section>`;
  const body = `<section class="home-hero-v3"><div class="hero-v3-grid" aria-hidden="true"></div><div class="hero-v3-glow hero-v3-glow-a" aria-hidden="true"></div><div class="hero-v3-glow hero-v3-glow-b" aria-hidden="true"></div><div class="shell home-hero-v3-inner"><div class="home-hero-v3-copy"><span class="hero-v3-kicker"><i aria-hidden="true">✦</i> AI 时代的企业可见性</span><h1>让专业能力，成为<span class="hero-title-line">客户与 AI 的首选答案</span></h1><p>${escapeHtml(heroDescription)}</p><div class="actions hero-v3-actions">${actionLink(site.cta || "获取企业诊断", "/contact/", "button primary")}${actionLink("探索服务方案", "/services/", "button secondary")}</div><div class="hero-v3-tags" aria-label="企业服务重点"><span>企业事实</span><span>问题地图</span><span>内容信源</span><span>持续复盘</span></div></div><div class="ai-pulse-scene" aria-label="企业公开信源工作台示意"><div class="pulse-scene-orbit orbit-one" aria-hidden="true"></div><div class="pulse-scene-orbit orbit-two" aria-hidden="true"></div><div class="pulse-source-pill source-pill-a"><i aria-hidden="true">▣</i><span>官网信源</span></div><div class="pulse-source-pill source-pill-b"><i aria-hidden="true">✦</i><span>行业内容</span></div><div class="pulse-source-pill source-pill-c"><i aria-hidden="true">⌁</i><span>客户问题</span></div><div class="pulse-console"><div class="pulse-console-top"><div><span class="pulse-console-mark">TZ</span><b>${brandName} · Source Pulse</b></div><span class="pulse-console-status"><i></i> 已建立信源</span></div><div class="pulse-console-body"><div class="pulse-query"><small>AI 搜索问题</small><p>怎样让企业的专业服务，被准确理解与选择？</p></div><div class="pulse-answer"><div class="pulse-answer-head"><span>推荐答案结构</span><em>可追溯</em></div><strong>${brandName}</strong><p>以企业事实、服务边界与真实问题为基础，建立可被持续理解的公开表达。</p><div class="pulse-answer-sources"><span><i></i> 企业官网</span><span><i></i> 问题地图</span><span><i></i> 行业内容</span></div></div><div class="pulse-meter"><div><span>事实清晰度</span><b>完整</b><i><em></em></i></div><div><span>内容可引用性</span><b>持续建设</b><i><em></em></i></div></div></div></div><div class="pulse-floating-note"><span>GEO 工作流</span><b>从企业事实到客户答案</b></div></div></div><div class="shell hero-v3-ribbon"><article><span>01</span><div><b>统一企业事实</b><small>让产品、服务与案例说同一种语言</small></div></article><article><span>02</span><div><b>组织客户问题</b><small>让每一份内容回应真实决策</small></div></article><article><span>03</span><div><b>沉淀公开信源</b><small>让专业能力持续被发现与理解</small></div></article></div></section><section class="section home-outcomes-v3"><div class="shell"><div class="home-section-heading home-heading-centered"><span class="kicker">WHY IT MATTERS</span><h2>让企业的公开信源，<span>进入客户的决策路径。</span></h2><p>不是堆砌概念，也不是一次性曝光；而是让客户与 AI 都能够快速读懂、验证并信任企业的专业能力。</p></div><div class="outcome-grid"><article><span class="outcome-icon" aria-hidden="true">⌁</span><h3>被准确理解</h3><p>统一企业主体、服务边界与场景表达，减少信息割裂与理解偏差。</p></article><article><span class="outcome-icon" aria-hidden="true">↗</span><h3>被持续发现</h3><p>用真实客户问题驱动官网与行业内容，让每次发布都有长期价值。</p></article><article><span class="outcome-icon" aria-hidden="true">✦</span><h3>被自然信任</h3><p>让事实、案例与回答彼此印证，形成清晰可信的品牌信源。</p></article></div><div class="outcome-flow" aria-label="企业公开信源形成路径"><span>企业事实</span><i aria-hidden="true">→</i><span>内容与问题</span><i aria-hidden="true">→</i><span>客户理解</span><i aria-hidden="true">→</i><span>业务机会</span></div></div></section><section class="section home-services-v3"><div class="shell"><div class="home-section-heading home-heading-centered"><span class="kicker">CORE CAPABILITIES</span><h2>从被理解，到<span>被选择。</span></h2><p>${escapeHtml(serviceSummary)}</p></div><div class="service-grid home-service-grid">${FRONTEND_SERVICES.map((service, index) => serviceCard(service, index)).join("")}</div></div></section><section class="section home-process-v3"><div class="shell home-process-layout"><div class="home-process-intro"><span class="kicker">HOW WE WORK</span><h2>一套内容，连接企业事实与客户决策。</h2><p>官网、行业资讯、问题地图和服务案例，不是彼此分散的栏目，而是同一套企业事实在不同场景下的表达。</p><a class="button secondary" href="/problem-map/">浏览问题地图 <span aria-hidden="true">↗</span></a></div><ol class="process-steps home-process-steps">${processSteps().map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div><i aria-hidden="true">↗</i></li>`).join("")}</ol></div></section>${casesSection}${problemsSection}${insightsSection}<section class="contact-band home-cta-v3"><div class="shell contact-grid"><div><span class="eyebrow">START WITH THE REAL QUESTION</span><h2>先说说企业现在最想解决的问题。</h2><p>我们会根据企业的业务、资料与目标，判断从哪条服务线开始更合适。</p></div>${actionLink("提交业务咨询", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: "/", title: "", description: site.description, active: "/", schemaExtra: [{ "@type": "WebPage", name: site.siteName, description: site.description }], body: `<span class="sr-only">ENTERPRISE GEO OPERATIONS</span>${body}`, preview, assetBase });
}

function templateHomeData(site, articles, preview) {
  const services = frontendServices(site, preview);
  const cases = frontendCases(site, preview);
  const groups = frontendProblemGroups(site, preview);
  const contentArticles = frontendArticles(articles, site.frontendDemo);
  const fallbackServices = [
    { id: "service-1", title: "企业服务方案", description: "从真实业务问题出发，整理清晰的服务边界与交付路径。", audience: "企业决策者" },
    { id: "service-2", title: "公开内容建设", description: "将企业事实、客户问题与审核内容组织成可持续维护的公开信源。", audience: "市场与内容团队" },
    { id: "service-3", title: "长期运营支持", description: "通过发布、监测与复盘，让官网内容持续回应客户判断。", audience: "需要持续增长的企业" }
  ];
  return {
    services: services.length ? services : fallbackServices,
    cases,
    groups,
    articles: contentArticles,
    featuredProblems: groups.flatMap((group) => group.questions.slice(0, 1).map((problem) => ({ problem, group }))).slice(0, 4)
  };
}

function templateHeroText(site, hero, profile) {
  const title = hero?.title && hero.title !== "首屏" ? hero.title : profile.headline;
  const description = moduleText(hero, site.description || profile.description);
  return { title, description };
}

function templateServiceCards(services, variant = "grid") {
  return services.slice(0, 6).map((service, index) => `<article class="template-service-card template-service-card--${variant}"><span class="template-card-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围、适用对象与交付方式。")}</p>${service.audience ? `<small>${escapeHtml(service.audience)}</small>` : ""}</div><a href="${escapeHtml(service.href || "/services/")}" aria-label="了解${escapeHtml(service.title)}">了解详情 <span aria-hidden="true">→</span></a></article>`).join("");
}

function templateCaseCards(cases) {
  return cases.slice(0, 3).map((item, index) => `<article class="template-case-card"><span class="template-card-index">${String(index + 1).padStart(2, "0")}</span><div><small>${escapeHtml(item.industry || item.service || "实施场景")}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看企业实施场景与交付结果。")}</p></div><strong>${escapeHtml(item.result || "可复盘")}</strong></article>`).join("");
}

function templateArticleCards(articles) {
  return articles.slice(0, 3).map((article) => `<article class="template-article-card"><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><div><small>${escapeHtml(article.categoryName || "行业观点")}</small><h3><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p></div></article>`).join("");
}

function templateStats(profile) {
  return `<div class="template-stat-row"><div><strong>01</strong><span>${escapeHtml(profile.statOne)}</span></div><div><strong>02</strong><span>${escapeHtml(profile.statTwo)}</span></div><div><strong>03</strong><span>${escapeHtml(profile.statThree)}</span></div></div>`;
}

function templateSectionHeading(kicker, title, description = "") {
  return `<div class="template-section-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>`;
}

function templateContactBand(site, profile) {
  return `<section class="template-contact-band"><div class="template-shell"><div><span class="template-kicker">${escapeHtml(profile.ctaKicker)}</span><h2>${escapeHtml(profile.ctaTitle)}</h2><p>${escapeHtml(site.description || profile.description)}</p></div>${actionLink(site.cta || profile.ctaLabel, "/contact/", "button template-button template-button--solid")}</div></section>`;
}

function renderIndustryTemplateHome({ site, page, articles, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const active = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  const profile = {
    "02-construction": { headline: "让每一项工程，都成为可信的作品", description: "用项目经验、设计能力与施工流程，清晰呈现企业的专业交付能力。", heroKicker: "PROJECTS / ENGINEERING", statOne: "项目经验", statTwo: "设计与施工", statThree: "案例成果", ctaKicker: "START A PROJECT", ctaTitle: "从一个真实项目开始沟通。", ctaLabel: "讨论项目" },
    "03-software-ai": { headline: "用技术系统，推动企业做出更快的判断", description: "把产品能力、技术架构与业务结果放在同一条可理解的路径上。", heroKicker: "PRODUCT / AI SYSTEMS", statOne: "产品能力", statTwo: "技术架构", statThree: "业务结果", ctaKicker: "BUILD THE SYSTEM", ctaTitle: "找到适合你的智能化路径。", ctaLabel: "获取方案" },
    "04-logistics": { headline: "让每一次交付，都有清晰的路线", description: "围绕运输网络、时效与服务区域，建立可追踪、可协同的供应链表达。", heroKicker: "NETWORK / DELIVERY", statOne: "运输网络", statTwo: "仓储节点", statThree: "服务时效", ctaKicker: "PLAN THE ROUTE", ctaTitle: "一起梳理你的交付网络。", ctaLabel: "咨询运输方案" },
    "05-business-services": { headline: "把复杂问题，整理成可执行的方法", description: "从客户问题、服务边界和实施步骤开始，让顾问能力被准确理解。", heroKicker: "METHOD / CONSULTING", statOne: "问题诊断", statTwo: "方法设计", statThree: "持续陪跑", ctaKicker: "MAKE IT CLEAR", ctaTitle: "先把最重要的问题说清楚。", ctaLabel: "预约咨询" },
    "06-finance": { headline: "以清晰边界，建立长期信任", description: "完整呈现专业资质、风险边界与服务方式，让每个判断都有依据。", heroKicker: "TRUST / CAPITAL", statOne: "专业资质", statTwo: "风险边界", statThree: "长期服务", ctaKicker: "A CLEARER DECISION", ctaTitle: "先了解适合你的服务边界。", ctaLabel: "开始沟通" },
    "07-healthcare": { headline: "让每一次专业照护，都更容易被找到", description: "把机构、服务、专业团队与预约路径组织成清晰、安心的患者入口。", heroKicker: "CARE / HEALTH", statOne: "专业团队", statTwo: "服务路径", statThree: "预约入口", ctaKicker: "CARE STARTS HERE", ctaTitle: "从一次专业咨询开始。", ctaLabel: "预约咨询" },
    "08-education": { headline: "让学习路径，从选择开始变得清楚", description: "围绕课程、师资与学习成果，帮助学生和家长快速找到适合的方向。", heroKicker: "LEARNING / GROWTH", statOne: "课程体系", statTwo: "师资力量", statThree: "学习成果", ctaKicker: "FIND YOUR PATH", ctaTitle: "找到适合你的下一堂课。", ctaLabel: "了解课程" },
    "09-travel-hotel": { headline: "把值得出发的地方，讲给真正想去的人", description: "用目的地、体验内容与服务细节，构成一条自然的旅行决策路径。", heroKicker: "DESTINATION / STAY", statOne: "目的地", statTwo: "旅行体验", statThree: "入住服务", ctaKicker: "PLAN THE STAY", ctaTitle: "为下一次出发做个计划。", ctaLabel: "咨询行程" },
    "10-food-consumer": { headline: "把每一口味道，都做成值得分享的品牌", description: "从产品、原料到制作故事，让消费者快速理解品牌与真实品质。", heroKicker: "PRODUCT / TASTE", statOne: "产品系列", statTwo: "制作工艺", statThree: "消费场景", ctaKicker: "TASTE THE STORY", ctaTitle: "从一款真正喜欢的产品开始。", ctaLabel: "了解产品" }
  }[active.key] || { headline: active.name, description: active.description, heroKicker: active.shortName, statOne: "企业能力", statTwo: "服务内容", statThree: "公开信源", ctaKicker: "NEXT STEP", ctaTitle: "从一个真实问题开始。", ctaLabel: "联系我们" };
  const data = templateHomeData(site, articles, preview);
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroText = templateHeroText(site, hero, profile);
  const services = templateServiceCards(data.services, active.layout);
  const cases = templateCaseCards(data.cases);
  const stories = templateArticleCards(data.articles);
  const problem = data.featuredProblems[0]?.problem;
  const problemGroup = data.featuredProblems[0]?.group;
  const problemBlock = problem ? `<aside class="template-answer-card"><span>客户问题</span><h3>${escapeHtml(problem.title)}</h3><p>${escapeHtml(problem.answer)}</p><a href="/problem-map/${encodeURIComponent(problem.slug)}/">查看直接回答 <span aria-hidden="true">→</span></a></aside>` : `<aside class="template-answer-card"><span>企业公开信源</span><h3>${escapeHtml(site.siteName || "企业官网")}</h3><p>${escapeHtml(site.description || profile.description)}</p><a href="/about/">了解企业 <span aria-hidden="true">→</span></a></aside>`;
  const contact = site.contact || {};
  const serviceSection = `<section class="template-section template-services-section"><div class="template-shell">${templateSectionHeading(profile.heroKicker, profile.headline, profile.description)}<div class="template-service-grid">${services}</div></div></section>`;
  const storySection = `<section class="template-section template-stories-section"><div class="template-shell">${templateSectionHeading("LATEST / INSIGHTS", "持续更新值得信任的内容", "文章、案例和直接回答共同构成企业的公开信源。")}<div class="template-story-grid">${stories || `<div class="template-empty-state">内容正在建设，审核发布后的文章会出现在这里。</div>`}</div></div></section>`;
  const caseSection = cases ? `<section class="template-section template-cases-section"><div class="template-shell">${templateSectionHeading("WORK / CASES", "把能力放进真实场景")}<div class="template-case-grid">${cases}</div></div></section>` : "";
  let body;
  if (active.key === "02-construction") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--project"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "讨论项目", "/contact/", "button template-button template-button--solid")}${actionLink("查看案例", "/cases/", "button template-button template-button--outline")}</div></div><div class="template-project-board"><span>PROJECT BOARD / 2026</span><strong>${escapeHtml(site.siteName)}</strong><div class="template-project-lines"><i></i><i></i><i></i></div><small>设计 · 施工 · 交付</small></div></div></section><section class="template-stat-band"><div class="template-shell">${templateStats(profile)}</div></section>${serviceSection}${caseSection}${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "03-software-ai") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--tech"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "获取方案", "/contact/", "button template-button template-button--solid")}${actionLink("浏览产品", "/services/", "button template-button template-button--outline")}</div></div><div class="template-tech-console"><span>LIVE SYSTEM / 01</span><strong>Enterprise Intelligence</strong><div class="template-console-bars"><i></i><i></i><i></i><i></i></div><div class="template-console-foot"><b>99.9%</b><small>可持续运行</small></div></div></div></section>${serviceSection}<section class="template-tech-strip"><div class="template-shell"><span>AI</span><span>DATA</span><span>API</span><span>WORKFLOW</span><span>SECURITY</span></div></section>${storySection}${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "04-logistics") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--route"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "咨询运输方案", "/contact/", "button template-button template-button--solid")}</div></div><div class="template-route-map" aria-label="运输网络示意"><span class="route-node route-node--a">A</span><span class="route-node route-node--b">B</span><span class="route-node route-node--c">C</span><i></i><i></i><small>NETWORK / DELIVERY</small></div></div></section><section class="template-stat-band"><div class="template-shell">${templateStats(profile)}</div></section>${serviceSection}<section class="template-section template-answer-section"><div class="template-shell template-answer-layout">${problemBlock}<div>${templateSectionHeading("OPERATIONS", "每一个节点，都有清晰的下一步", "从运输、仓储到交付，服务信息围绕客户真正的判断组织。")}${caseSection ? `<div class="template-mini-list">${data.cases.slice(0, 3).map((item) => `<div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.result || "查看交付场景")}</span></div>`).join("")}</div>` : ""}</div></div></section>${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "05-business-services") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--editorial"><div class="template-shell template-editorial-layout"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "预约咨询", "/contact/", "button template-button template-button--solid")}</div></div><aside><span>01 / 03</span><strong>问题<br>方法<br>行动</strong><small>企业服务工作方式</small></aside></div></section><section class="template-section template-method-section"><div class="template-shell template-method-layout"><div>${templateSectionHeading("HOW WE WORK", "先判断问题，再选择方法", "每项服务都需要对应真实的业务场景与可核验的交付边界。")}</div><ol>${processSteps().slice(0, 4).map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div></li>`).join("")}</ol></div></section>${serviceSection}${storySection}${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "06-finance") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--trust"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "开始沟通", "/contact/", "button template-button template-button--solid")}</div></div><div class="template-trust-panel"><span>TRUST RECORD</span><strong>清晰的专业边界</strong><div><b>01</b>适用对象</div><div><b>02</b>服务范围</div><div><b>03</b>风险提示</div></div></div></section><section class="template-section template-principles-section"><div class="template-shell">${templateSectionHeading("WHY TRUST", "每个判断，都回到可验证的事实")}${templateServiceCards(data.services.slice(0, 4), "principles")}</div></section>${storySection}${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "07-healthcare") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--care"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "预约咨询", "/contact/", "button template-button template-button--solid")}</div></div><aside class="template-appointment-card"><span>CARE PATH</span><strong>从了解情况开始</strong><p>${escapeHtml(contact.serviceArea || "专业团队为你提供清晰的咨询路径")}</p><a href="/contact/">预约咨询 <span aria-hidden="true">→</span></a></aside></div></section>${serviceSection}<section class="template-section template-care-section"><div class="template-shell template-care-grid">${problemBlock}<div>${templateSectionHeading("CARE NOTES", "把专业说明讲得更容易理解", "服务内容、就诊准备与常见问题统一回到公开页面。")}${stories}</div></div></section>${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "08-education") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--learning"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "了解课程", "/contact/", "button template-button template-button--solid")}${actionLink("查看学习内容", "/services/", "button template-button template-button--outline")}</div></div><div class="template-learning-board"><span>LEARNING PATH</span><b>选择方向</b><i>建立基础</i><i>持续练习</i><i>看到成果</i></div></div></section><section class="template-section template-course-section"><div class="template-shell">${templateSectionHeading("COURSES / PROGRAMS", "从一门适合的课程开始")}${templateServiceCards(data.services, "course")}</div></section>${caseSection || storySection}${templateContactBand(site, profile)}</div>`;
  } else if (active.key === "09-travel-hotel") {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--destination"><div class="template-shell template-destination-layout"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "咨询行程", "/contact/", "button template-button template-button--solid")}</div></div><div class="template-destination-card"><span>YOUR NEXT STOP</span><strong>${escapeHtml(site.siteName || "目的地")}</strong><small>${escapeHtml(contact.serviceArea || "目的地 · 体验 · 入住")}</small><a href="/about/">探索更多 <span aria-hidden="true">→</span></a></div></div></section><section class="template-section template-experience-section"><div class="template-shell template-experience-layout">${templateSectionHeading("EXPERIENCE", "让旅程从第一眼就开始")}${templateServiceCards(data.services, "experience")}</div></section>${storySection}${templateContactBand(site, profile)}</div>`;
  } else {
    body = `<div class="industry-template-home industry-template-home--${active.layout}"><section class="template-hero template-hero--product"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(profile.heroKicker)}</span><h1>${escapeHtml(heroText.title)}</h1><p>${escapeHtml(heroText.description)}</p><div class="template-actions">${actionLink(site.cta || "了解产品", "/contact/", "button template-button template-button--solid")}${actionLink("浏览产品", "/services/", "button template-button template-button--outline")}</div></div><div class="template-product-mark"><span>PRODUCT STORY</span><strong>${escapeHtml(site.siteName || "品牌")}</strong><small>原料 · 工艺 · 分享</small></div></div></section><section class="template-section template-product-section"><div class="template-shell">${templateSectionHeading("FEATURED PRODUCTS", "值得被记住的产品")}${templateServiceCards(data.services, "product")}</div></section><section class="template-section template-story-feature"><div class="template-shell template-story-feature-layout"><div>${templateSectionHeading("THE STORY", "好产品，也应该有清楚的来处", site.description || profile.description)}${actionLink("了解品牌", "/about/", "button template-button template-button--outline")}</div>${problemBlock}</div></section>${storySection}${templateContactBand(site, profile)}</div>`;
  }
  return documentShell({ site, origin, pathname: "/", title: "", description: site.description || profile.description, active: "/", schemaExtra: [{ "@type": "WebPage", name: site.siteName, description: site.description || profile.description }], body, preview, assetBase, bodyClass: `template-layout-${active.layout}` });
}

function renderHomePage({ site, page, articles, categories, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceHomePage({ site, page, articles, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceHomePage({ site, page, articles, origin, preview, assetBase });
  if (activeTemplate.key !== DEFAULT_SITE_TEMPLATE_KEY) return renderIndustryTemplateHome({ site, page, articles, origin, preview, assetBase });
  const hero = moduleOf(site, page.id, "hero", preview);
  const services = frontendServices(site, preview);
  const cases = frontendCases(site, preview);
  const groups = frontendProblemGroups(site, preview);
  const contentArticles = frontendArticles(articles, site.frontendDemo);
  const brand = publicBrandName(site);
  const heroDescription = "为企业建立一张可被搜索、理解和引用的数字身份证，统一企业主体、产品服务、客户问题与公开信源。";
  const featuredQuestions = groups.flatMap((group) => group.questions.slice(0, 1).map((problem) => ({ problem, group }))).slice(0, 3);
  const serviceRows = services.slice(0, 3).map((service) => `<article class="corp-service-row"><div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p><small>适合：${escapeHtml(service.audience || "需要建立公开信源的企业")}</small></div><a href="${escapeHtml(service.href || "/services/")}" aria-label="了解${escapeHtml(service.title)}">了解服务 <span aria-hidden="true">→</span></a></article>`).join("");
  const caseRows = cases.slice(0, 3).map((item) => `<article class="corp-case-item"><div><span>${escapeHtml(item.industry || item.service || "企业服务")}</span><h3>${escapeHtml(item.title)}</h3></div><p>${escapeHtml(item.summary)}</p><strong>${escapeHtml(item.result)}</strong></article>`).join("");
  const questionRows = featuredQuestions.map(({ problem, group }) => `<a class="corp-question-row" href="/problem-map/${encodeURIComponent(problem.slug)}/"><span>${escapeHtml(group.service)}</span><h3>${escapeHtml(problem.title)}</h3><i aria-hidden="true">→</i></a>`).join("");
  const articleRows = contentArticles.slice(0, 3).map((article) => `<a class="corp-article-row" href="${escapeHtml(articleLink(article))}"><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><div><span>${escapeHtml(article.categoryName || "行业观点")}</span>${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.excerpt)}</p></div><i aria-hidden="true">→</i></a>`).join("");
  const body = `<span class="sr-only">ENTERPRISE GEO OPERATIONS</span><div class="identity-loader" data-identity-loader aria-label="正在建立企业公开关系图谱">
      <div class="identity-loader-top"><span class="loader-brand"><img src="${publicAsset(assetBase, "tongzhuo-mark-gold.png")}" alt="" width="38" height="32"><b>企业 GEO</b></span><button type="button" data-loader-skip>跳过动画</button></div>
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
        <div class="passport-dossier identity-dossier" id="source-passport" aria-label="企业数字身份证示意">
          <div class="identity-dossier-top"><span>TZ / GEO / DIGITAL ID</span><b><i></i>可被理解</b></div>
          <div class="identity-dossier-main">
            <article class="identity-profile">
              <header><span>企业数字身份证</span><b>V.2026</b></header>
              <div class="identity-profile-head"><div class="identity-logo-ring"><img src="${publicAsset(assetBase, "tongzhuo-mark-wine.png")}" alt="企业标识" width="48" height="48"></div><div><small>ENTERPRISE ENTITY</small><h2>${escapeHtml(brand)}</h2><p>GEO / 企业公开信源</p></div></div>
              <div class="identity-score"><div class="identity-score-ring"><strong>GEO</strong><small>身份档案</small></div><div><b>统一企业对外身份</b><p>让企业主体、服务边界、客户问题和正式出处保持同一套表达。</p></div></div>
              <div class="identity-stat-grid"><div><b>主体信息</b><span>名称 · 业务 · 边界</span></div><div><b>客户问题</b><span>采购 · 技术 · 使用</span></div><div><b>公开信源</b><span>官网 · 内容 · 出处</span></div></div>
              <dl class="identity-fields"><div><dt>核心业务</dt><dd>GEO 服务</dd></div><div><dt>身份状态</dt><dd>可持续维护</dd></div><div><dt>使用场景</dt><dd>客户搜索与 AI 问答</dd></div></dl>
            </article>
          </div>
          <div class="identity-dossier-bottom"><span>企业主体与服务边界</span><span>客户问题与内容回应</span><span>公开出处与持续复盘</span></div>
        </div>
      </div>
      <div class="shell passport-summary" aria-label="企业数字身份证的三项核心内容"><div><span>ENTITY</span><strong>企业信息</strong><small>让主体与业务边界保持一致</small></div><div><span>QUESTION</span><strong>客户问题</strong><small>让内容回应真实决策过程</small></div><div><span>SOURCE</span><strong>公开信源</strong><small>让答案回到正式出处</small></div></div>
    </section><section class="corp-section corp-method">
      <div class="shell corp-split-heading"><h2>GEO 不是多写几篇文章，<br>而是建立一条可信的答案链。</h2><p>从业务问题开始，把企业事实拆成可以引用、验证和持续更新的公开信源。客户能看懂，AI 也更容易准确理解。</p></div>
      <div class="shell corp-evidence-track" aria-label="GEO 工作方法"><div><span>业务问题</span><p>从采购、技术与使用场景确认真实提问</p></div><i aria-hidden="true">→</i><div><span>企业事实</span><p>整理产品、服务、案例与适用边界</p></div><i aria-hidden="true">→</i><div><span>公开信源</span><p>组织成官网、问题页与行业内容</p></div><i aria-hidden="true">→</i><div><span>持续验证</span><p>重复采样、纠错并复盘引用变化</p></div></div>
    </section>

    <section class="corp-section corp-services">
      <div class="shell corp-section-top"><div><h2>从诊断开始，逐步形成企业增长闭环。</h2><p>不需要一次做完全部能力。先找到关键缺口，再选择最值得推进的一条服务线。</p></div><a href="/services/">查看完整服务方案 <span aria-hidden="true">→</span></a></div>
      <div class="shell corp-service-list">${serviceRows}</div>
    </section>

    ${caseRows ? `<section class="corp-section corp-cases"><div class="shell corp-section-top"><div><h2>把复杂现状，拆成可以推进的工作。</h2><p>用典型实施场景说明我们如何从事实、问题和内容开始。</p></div><a href="/cases/">查看案例成果 <span aria-hidden="true">→</span></a></div><div class="shell corp-case-list">${caseRows}</div></section>` : ""}

    <section class="corp-section corp-knowledge"><div class="shell corp-knowledge-grid"><div class="corp-knowledge-intro"><h2>持续回答企业客户真正关心的问题。</h2><p>问题地图与行业观点共同构成公开知识入口，让每一篇内容都能回到真实业务。</p><a class="corp-button corp-button-secondary" href="/problem-map/">进入问题地图 <span aria-hidden="true">→</span></a></div><div class="corp-question-list">${questionRows || "<p>问题地图正在建设。</p>"}</div></div></section>

    <section class="corp-section corp-insights"><div class="shell corp-section-top"><div><h2>最新行业观点</h2><p>围绕 GEO、企业 AI 与内容运营，发布经过审核的实践内容。</p></div><a href="/insights/">进入行业资讯 <span aria-hidden="true">→</span></a></div><div class="shell corp-article-list">${articleRows || "<p>行业内容正在建设。</p>"}</div></section>

    <section class="corp-contact"><div class="shell corp-contact-layout"><div><h2>先看清企业现在最该解决的问题。</h2><p>提交企业现状后，我们会先确认诊断范围、所需资料与交付边界。可在提交前沟通保密方式，不强制采购后续服务。</p></div><a class="corp-button corp-button-light" href="/contact/">提交业务咨询 <span aria-hidden="true">→</span></a></div></section>
  </div>`;
  const description = site.description || "企业公开信息、产品服务与行业内容。";
  const honestBody = body.replace("发布经过审核的实践内容。", "整理可回到业务问题的典型内容。");
  return documentShell({ site, origin, pathname: "/", title: "", description, active: "/", schemaExtra: [{ "@type": "WebPage", name: brand, description }], body: honestBody, preview, assetBase, bodyClass: "corp-home-page" });
}

function renderIndustryTemplateServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const active = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (active.key === "02-construction") return renderConstructionServicesPage({ site, page, origin, preview, assetBase });
  const profiles = {
    "02-construction": ["project", "PROJECTS / ENGINEERING", "把服务能力，落实到每一个项目节点", "用项目经验、设计能力与施工流程，清晰呈现企业的专业交付能力。"],
    "03-software-ai": ["tech", "PRODUCT / AI SYSTEMS", "用技术系统，推动企业做出更快的判断", "把产品能力、技术架构与业务结果放在同一条可理解的路径上。"],
    "04-logistics": ["route", "NETWORK / DELIVERY", "让每一项服务，都有清晰的交付路线", "围绕运输网络、时效与服务区域，建立可追踪、可协同的供应链表达。"],
    "05-business-services": ["editorial", "METHOD / CONSULTING", "把复杂问题，整理成可执行的方法", "从客户问题、服务边界和实施步骤开始，让顾问能力被准确理解。"],
    "06-finance": ["trust", "TRUST / CAPITAL", "以清晰边界，建立长期信任", "完整呈现专业资质、风险边界与服务方式，让每个判断都有依据。"],
    "07-healthcare": ["care", "CARE / HEALTH", "让每一次专业照护，都更容易被找到", "把机构、服务、专业团队与预约路径组织成清晰、安心的患者入口。"],
    "08-education": ["learning", "LEARNING / GROWTH", "让学习路径，从选择开始变得清楚", "围绕课程、师资与学习成果，帮助学生和家长快速找到适合的方向。"],
    "09-travel-hotel": ["destination", "DESTINATION / STAY", "把值得出发的体验，讲给真正想去的人", "用目的地、体验内容与服务细节，构成一条自然的旅行决策路径。"],
    "10-food-consumer": ["product", "PRODUCT / TASTE", "把每一款产品，都做成值得分享的品牌", "从产品、原料到制作故事，让消费者快速理解品牌与真实品质。"]
  };
  const [heroVariant, kicker, title, description] = profiles[active.key] || ["product", active.shortName, active.name, active.description];
  const services = templateHomeData(site, [], preview).services;
  const cases = frontendCases(site, preview);
  const body = `<div class="industry-template-services industry-template-services--${active.layout}"><section class="template-hero template-hero--${heroVariant}"><div class="template-shell template-hero-grid"><div><span class="template-kicker">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><div class="template-actions">${actionLink(site.cta || "了解服务", "/contact/", "button template-button template-button--solid")}</div></div><div class="template-service-hero-visual"><span>${escapeHtml(active.shortName)}</span><strong>${String(services.length).padStart(2, "0")}</strong><small>服务方向 · 交付路径 · 公开内容</small></div></div></section><section class="template-section template-services-section"><div class="template-shell">${templateSectionHeading(kicker, "服务内容与适用场景", description)}<div class="template-service-grid">${templateServiceCards(services, active.layout)}</div></div></section>${cases.length ? `<section class="template-section template-cases-section"><div class="template-shell">${templateSectionHeading("WORK / CASES", "把能力放进真实场景")}<div class="template-case-grid">${templateCaseCards(cases)}</div></div></section>` : ""}<section class="template-contact-band"><div class="template-shell"><div><span class="template-kicker">NEXT STEP</span><h2>从一个真实需求开始沟通。</h2><p>${escapeHtml(site.description || description)}</p></div>${actionLink(site.cta || "联系我们", "/contact/", "button template-button template-button--solid")}</div></section></div>`;
  const schemaExtra = services.map((service) => ({ "@type": "Service", "@id": absoluteUrl(origin, `/services/#${encodeURIComponent(service.id)}`), name: service.title, description: service.description, provider: { "@id": entityId(origin, "organization") } }));
  return documentShell({ site, origin, pathname: page.path || "/services/", title: page.title || "产品与服务", description: page.seoDescription || description, active: "/services/", schemaExtra, body, preview, assetBase, bodyClass: `template-layout-${active.layout}` });
}

function constructionServiceIcon(index) {
  const paths = [
    '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5M3 11h3m12 0h3"/>',
    '<path d="M4 19 19 4M8 4h11v11M5 15l4 4M4 20h16"/>',
    '<path d="M4 6h16v12H4zM8 10h8M8 14h5"/><path d="M7 3v3m10-3v3"/>',
    '<path d="M4 18 9 8l4 6 3-4 4 8M4 20h16"/><circle cx="9" cy="8" r="1"/>',
    '<path d="M5 19V5h14v14M9 9h6m-6 4h6m-6 4h3"/>'
  ];
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[index % paths.length]}</svg>`;
}

function constructionCaseVisual(item, index) {
  const image = safeUrl(item.image, "image");
  if (image) return `<div class="project-card-bg construction-project-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.imageAlt || item.title || "工程案例")}" loading="lazy" decoding="async"></div>`;
  return `<div class="project-card-bg construction-project-placeholder" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path d="M7 40h34M10 40V19l14-10 14 10v21M19 40V28h10v12M15 22h3m15 0h-3"/></svg><span>${String(index + 1).padStart(2, "0")}</span></div>`;
}

function renderConstructionServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const services = templateHomeData(site, [], preview).services;
  const cases = frontendCases(site, preview);
  const title = page.title || "服务项目";
  const description = page.seoDescription || "提供专业的建筑工程、装饰设计与项目交付服务。";
  const serviceCards = services.map((service, index) => `<article class="service-card construction-service-card" id="${escapeHtml(service.id)}"><div class="service-icon">${constructionServiceIcon(index)}</div><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description || "查看服务范围、适用场景与交付方式。")}</p><a class="btn btn-outline construction-service-link" href="${escapeHtml(safeUrl(service.href || "/contact/", "link") || "/contact/")}">了解详情</a></article>`).join("");
  const caseCards = cases.slice(0, 3).map((item, index) => `<article class="project-card construction-project-card">${constructionCaseVisual(item, index)}<div class="project-content"><span class="project-tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目的实施过程与交付结果。")}</p></div></article>`).join("");
  const body = `<header class="page-header construction-page-header"><div class="container"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav></div></header><section class="section construction-services"><div class="container"><div class="section-header"><h2>专业服务项目</h2><p>围绕项目实际需求，提供清晰的服务范围、交付方式与沟通路径。</p></div><div class="services-grid">${serviceCards || '<p class="construction-empty">服务内容正在整理中。</p>'}</div></div></section>${caseCards ? `<section class="section projects construction-projects"><div class="container"><div class="section-header"><h2>精选工程案例</h2><p>从真实场景出发，呈现项目能力与交付过程。</p></div><div class="projects-grid">${caseCards}</div></div></section>` : ""}<section class="section construction-service-cta"><div class="container"><div><h2>从一个真实项目开始沟通。</h2><p>${escapeHtml(site.description || description)}</p></div><a class="btn btn-primary" href="/contact/">${escapeHtml(site.cta || "预约咨询")}</a></div></section>`;
  const schemaExtra = services.map((service) => ({ "@type": "Service", "@id": absoluteUrl(origin, `/services/#${encodeURIComponent(service.id)}`), name: service.title, description: service.description, provider: { "@id": entityId(origin, "organization") } }));
  return documentShell({ site, origin, pathname: page.path || "/services/", title, description, active: "/services/", schemaExtra, body, preview, assetBase, bodyClass: "template-layout-project-studio construction-services-page" });
}

function renderServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceServicesPage({ site, page, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceServicesPage({ site, page, origin, preview, assetBase });
  if (activeTemplate.key !== DEFAULT_SITE_TEMPLATE_KEY) return renderIndustryTemplateServicesPage({ site, page, origin, preview, assetBase });
  const hero = moduleOf(site, page.id, "hero", preview);
  const FRONTEND_SERVICES = frontendServices(site, preview).map((service) => ({ ...service, cmsFocus: service.focus }));
  const body = `<header class="page-hero page-hero-v2 page-hero-dark"><div class="shell page-hero-v2-inner"><span class="eyebrow">SERVICES / 解决方案</span><h1>让企业的专业能力，被正确理解。</h1><p>${escapeHtml(moduleText(hero, "从企业可信信源、AI 落地到内容运营，建立适合工业品、制造业和中小企业的长期增长底座。"))}</p><div class="hero-tag-row"><span>GEO 服务</span><span>企业 AI 落地</span><span>短视频运营</span></div></div></header><section class="section services-detail-section"><div class="shell"><div class="section-head section-head-v2"><div><span class="kicker">三条服务线</span><h2>可以从一项服务开始，也可以逐步形成闭环。</h2></div><p>服务范围、资料边界和交付方式会在项目开始前明确，不用模糊的“全网曝光”代替具体工作。</p></div><div class="service-detail-list">${FRONTEND_SERVICES.map((service, index) => serviceCard({ ...service, focus: index === 0 ? "企业实体、官网页面、客户问题和公开内容结构" : index === 1 ? "知识库、检索增强、智能体和业务流程协同" : "选题、脚本、账号内容与持续发布节奏" }, index, true)).join("")}</div></div></section><section class="section service-method-section"><div class="shell service-method-layout"><div><span class="kicker">交付原则</span><h2>不承诺无法验证的结果，只交付可继续运营的系统。</h2></div><div class="principle-grid"><article><b>事实优先</b><p>所有公开表达都以企业资料、业务人员和可核验来源为依据。</p></article><article><b>问题优先</b><p>内容从客户在采购、技术和使用阶段的真实问题开始。</p></article><article><b>审核优先</b><p>文章、案例和官网内容经过人工审核后，才进入正式发布版本。</p></article><article><b>长期运营</b><p>每一次发布都沉淀为下一轮选题、知识和效果复盘的依据。</p></article></div></div></section><section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Make the next step clear</span><h2>不知道先从哪一项开始？</h2><p>提交企业现状，我们先帮助你判断问题属于信源、AI 落地还是内容运营。</p></div>${actionLink("预约一次业务沟通", "/contact/", "button ink")}</div></section>`;
  const serviceTags = `<div class="hero-tag-row"><span>灼见 GEO（主业务）</span><span>企业 AI 落地（辅助）</span><span>内容运营（辅助）</span></div>`;
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
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceCasesPage({ site, page, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceCasesPage({ site, page, origin, preview, assetBase });
  if (activeTemplate.key === "02-construction") return renderConstructionCasesPage({ site, page, origin, preview, assetBase });
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
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceProblemMapPage({ site, page, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceProblemMapPage({ site, page, origin, preview, assetBase });
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
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceAboutPage({ site, page, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceAboutPage({ site, page, origin, preview, assetBase });
  if (activeTemplate.key === "02-construction") return renderConstructionAboutPage({ site, page, origin, preview, assetBase });
  const contact = site.contact || {};
  const body = `<header class="page-hero page-hero-v2"><div class="shell page-hero-v2-inner"><span class="eyebrow">ABOUT / 关于我们</span><h1>我们关注的，不是内容数量，而是企业能否被准确理解。</h1><p>${escapeHtml(site.description || "帮助企业建立清晰、可信并可持续运营的公开信源。")}</p></div></header><section class="section about-story-section"><div class="shell about-story-grid"><div><span class="kicker">我们的定位</span><h2 class="about-position-title"><span>企业可信信源</span><span>公司服务展示</span><span>行业内容中心</span></h2></div><div class="about-story-copy"><p>面向工业品企业、制造业企业和所有需要建立公开信源的中小企业，我们把企业资料、客户问题、内容生产和官网运营放进同一套可审核的工作方法里。</p><p>官网是公开世界里最重要的一方来源。它应该让客户在几秒内看懂企业是谁、能解决什么问题、为什么可信，以及下一步如何联系。</p></div></div></section><section class="section about-principles-section"><div class="shell"><div class="section-head section-head-v2"><div><span class="kicker">我们的工作原则</span><h2>真实、清晰、可追溯、能持续。</h2></div><p>这四个词决定每一个页面、问题回答与公开内容如何被整理和审核。</p></div><div class="principle-grid principle-grid-large"><article><span>01</span><b>真实</b><p>不凭空补充企业能力，不用无法验证的客户结果替代事实。</p></article><article><span>02</span><b>清晰</b><p>直接回答客户问题，减少概念堆叠和跨页面的信息断裂。</p></article><article><span>03</span><b>可追溯</b><p>文章、案例和服务说明都能回到企业资料与审核版本。</p></article><article><span>04</span><b>能持续</b><p>把一次项目沉淀为企业后续可以继续运营的内容资产。</p></article></div></div></section><section class="section about-facts-section"><div class="shell about-facts"><div><span class="kicker">公开企业信息</span><h2>${escapeHtml(site.companyName || site.siteName)}</h2><p>${escapeHtml(site.description || "企业公开信息与服务说明。")}</p></div><dl><div><dt>服务对象</dt><dd>工业品企业、制造业企业、中小企业</dd></div><div><dt>服务方向</dt><dd>灼见 GEO（主业务）；企业 AI 落地与内容运营（辅助能力）</dd></div>${contact.serviceArea || contact.industryRegion ? `<div><dt>服务区域</dt><dd>${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · "))}</dd></div>` : ""}</dl></div></section><section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Work from the facts</span><h2>从企业真实情况开始沟通。</h2></div>${actionLink("联系我们", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || site.description, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: "关于我们" }], body, preview, assetBase });
}

function renderContactPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceContactPage({ site, page, origin, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceContactPage({ site, page, origin, preview, assetBase });
  if (activeTemplate.key === "02-construction") return renderConstructionContactPage({ site, page, origin, preview, assetBase });
  const contact = site.contact || {};
  const body = `<header class="page-hero page-hero-v2 page-hero-dark"><div class="shell page-hero-v2-inner"><span class="eyebrow">CONTACT / 联系我们</span><h1>把问题说清楚，下一步就会更明确。</h1><p>请留下企业名称、联系方式和希望解决的问题。我们会先了解业务背景，再判断适合从哪条服务线开始。</p></div></header><section class="section contact-section contact-section-v2"><div class="shell contact-layout"><div class="contact-copy"><span class="kicker">咨询方式</span><h2>一次有准备的业务沟通。</h2><p>建议在留言里说明企业所在行业、主要产品或服务、当前遇到的问题，以及希望达到的目标。</p><div class="contact-details">${contact.phone ? `<a href="tel:${escapeHtml(contact.phone)}"><small>联系电话</small><b>${escapeHtml(contact.phone)}</b></a>` : `<span><small>联系电话</small><b>提交表单后由运营人员联系</b></span>`}${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}"><small>电子邮箱</small><b>${escapeHtml(contact.email)}</b></a>` : ""}${contact.address ? `<span><small>企业地址</small><b>${escapeHtml(contact.address)}</b></span>` : ""}</div><div class="contact-checklist"><span>先了解企业现状</span><span>判断问题所在环节</span><span>给出可执行的下一步</span></div></div>${renderContactForm(site, page.path || "/contact/")}</div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/contact/", title: page.title || "联系我们", description: page.seoDescription || "联系企业并提交业务咨询。", active: "/contact/", schemaExtra: [{ "@type": "ContactPage", name: "联系我们" }], body, preview, assetBase });
}

function renderConstructionCasesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const cases = frontendCases(site, preview);
  const industries = [...new Set(cases.map((item) => String(item.industry || item.service || "工程案例").trim()).filter(Boolean))];
  const filters = `<div class="projects-filter" data-case-filter><button class="filter-btn active" type="button" data-case-value="all">全部项目</button>${industries.map((industry) => `<button class="filter-btn" type="button" data-case-value="${escapeHtml(industry)}">${escapeHtml(industry)}</button>`).join("")}</div>`;
  const cards = cases.map((item, index) => `<article class="project-card construction-project-card" data-case-industry="${escapeHtml(item.industry || item.service || "工程案例")}">${constructionCaseVisual(item, index)}<div class="project-content"><span class="project-tag">${escapeHtml(item.industry || item.service || "工程案例")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目的实施过程与交付结果。")}</p></div></article>`).join("");
  const body = `<header class="page-header construction-page-header"><div class="container"><h1>${escapeHtml(page.title || "工程案例")}</h1><p>从真实场景出发，呈现项目能力与交付过程。</p><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">工程案例</span></nav></div></header><section class="section projects construction-projects"><div class="container"><div class="section-header"><h2>精选工程案例</h2><p>每个案例都说明业务场景、实施内容与形成结果，帮助企业判断方法是否适合自身情况。</p></div>${filters}<div class="projects-grid">${cards || '<p class="construction-empty">案例内容正在整理中。</p>'}</div></div></section><section class="section construction-service-cta"><div class="container"><div><h2>从一个真实项目开始沟通。</h2><p>${escapeHtml(site.description || "提供专业的建筑工程、装饰设计与项目交付服务。")}</p></div><a class="btn btn-primary" href="/contact/">${escapeHtml(site.cta || "预约咨询")}</a></div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || "工程案例", description: page.seoDescription || "工程案例与项目交付成果。", active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || "工程案例", mainEntity: { "@type": "ItemList", numberOfItems: cases.length, itemListElement: cases.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title })) } }], body, preview, assetBase, bodyClass: "template-layout-project-studio construction-cases-page" });
}

function renderConstructionAboutPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const contact = site.contact || {};
  const body = `<header class="page-header construction-page-header"><div class="container"><h1>${escapeHtml(page.title || "关于我们")}</h1><p>${escapeHtml(site.description || "专注于建筑工程、装饰设计与项目交付。")}</p><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">关于我们</span></nav></div></header><section class="section about"><div class="container"><div class="section-header"><h2>关于 ${escapeHtml(site.companyName || site.siteName)}</h2><p>以项目经验、设计能力与施工流程，清晰呈现企业的专业交付能力。</p></div><div class="about-content"><div class="about-image"><div class="about-image-main" role="img" aria-label="企业建筑服务示意"><svg viewBox="0 0 96 96" aria-hidden="true"><path d="M12 80h72M20 80V36l28-20 28 20v44M38 80V58h20v22M30 43h8m20 0h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="about-badge"><span>10+</span><small>专业交付经验</small></div></div><div class="about-text"><h3>把每一个项目，做成值得信赖的作品。</h3><p>${escapeHtml(site.description || "提供建筑工程、装饰设计与项目管理服务，重视每一个项目节点的清晰沟通与可靠交付。")}</p><div class="about-features"><div class="about-feature"><span class="about-feature-icon">${constructionServiceIcon(0)}</span><h4>工程施工</h4></div><div class="about-feature"><span class="about-feature-icon">${constructionServiceIcon(1)}</span><h4>装饰设计</h4></div><div class="about-feature"><span class="about-feature-icon">${constructionServiceIcon(2)}</span><h4>项目管理</h4></div><div class="about-feature"><span class="about-feature-icon">${constructionServiceIcon(3)}</span><h4>售后服务</h4></div></div></div></div></div></section><section class="section construction-service-cta"><div class="container"><div><h2>从一个真实项目开始沟通。</h2><p>${escapeHtml([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · ") || "期待与您讨论下一项工程计划。")}</p></div><a class="btn btn-primary" href="/contact/">${escapeHtml(site.cta || "预约咨询")}</a></div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || site.description, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase, bodyClass: "template-layout-project-studio construction-about-page" });
}

function renderConstructionContactPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const contact = site.contact || {};
  const contactRows = `${contact.phone ? `<div class="info-item"><span class="info-icon">${constructionServiceIcon(2)}</span><div class="info-content"><h4>联系电话</h4><p>${escapeHtml(contact.phone)}</p></div></div>` : ""}${contact.email ? `<div class="info-item"><span class="info-icon">${constructionServiceIcon(3)}</span><div class="info-content"><h4>电子邮箱</h4><p>${escapeHtml(contact.email)}</p></div></div>` : ""}${contact.address ? `<div class="info-item"><span class="info-icon">${constructionServiceIcon(0)}</span><div class="info-content"><h4>企业地址</h4><p>${escapeHtml(contact.address)}</p></div></div>` : ""}`;
  const body = `<header class="page-header construction-page-header"><div class="container"><h1>${escapeHtml(page.title || "联系我们")}</h1><p>请留下项目需求和联系方式，我们会尽快与您沟通。</p><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">联系我们</span></nav></div></header><section class="section contact"><div class="container"><div class="section-header"><h2>让我们开始一次清晰的沟通</h2><p>说明项目类型、规模、所在地区和期望时间，有助于我们更准确地了解您的需求。</p></div><div class="contact-wrapper"><div class="contact-info"><h3>${escapeHtml(site.companyName || site.siteName)}</h3>${contactRows || '<p>提交表单后由项目团队与您联系。</p>'}</div><div class="contact-form"><h3>提交项目需求</h3>${renderContactForm(site, page.path || "/contact/")}</div></div></div></section>`;
  return documentShell({ site, origin, pathname: page.path || "/contact/", title: page.title || "联系我们", description: page.seoDescription || "联系企业并提交项目需求。", active: "/contact/", schemaExtra: [{ "@type": "ContactPage", name: page.title || "联系我们" }], body, preview, assetBase, bodyClass: "template-layout-project-studio construction-contact-page" });
}

function legacySeedRows(rows = [], templateKey = "legacy") {
  return rows.map((row, index) => {
    const [title, description, third, fourth] = row;
    const isCourse = templateKey === "08-education";
    return {
      id: `${templateKey}-seed-${index + 1}`,
      title,
      description,
      meta: isCourse ? third : "",
      icon: isCourse ? fourth : third
    };
  });
}

function legacyBusinessLineRows(items = [], templateKey = "legacy") {
  return items.map((item, index) => ({
    id: item.id || `${templateKey}-business-line-${index + 1}`,
    title: item.title || item.product || item.name || `业务线 ${index + 1}`,
    description: item.description || item.positioning || item.audience || "查看服务范围、适用对象与交付方式。",
    meta: item.meta || item.positioning || (Array.isArray(item.keywords) && item.keywords.length ? item.keywords.join(" · ") : item.audience || ""),
    icon: item.icon || ["building", "service", "chart", "gear", "design", "award"][index % 6]
  }));
}

function legacyPeopleRows(items = [], fallback = []) {
  const people = items.map((item, index) => ({
    id: item.id || `legacy-person-${index + 1}`,
    title: item.title || item.name || `成员 ${index + 1}`,
    role: item.service || item.summary || item.result || item.description || "查看公开介绍。",
    image: item.image,
    imageAlt: item.imageAlt,
    icon: item.icon || ["team", "award", "building", "check"][index % 4]
  }));
  return people.length ? people : fallback.map(([title, role], index) => ({
    id: `legacy-person-${index + 1}`,
    title,
    role,
    icon: ["team", "award", "building", "check"][index % 4]
  }));
}

function legacyTemplateData(site, articles, preview, template) {
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  const cmsServices = frontendServices(site, preview);
  const cmsCases = frontendCases(site, preview);
  const cmsArticles = frontendArticles(articles, site.frontendDemo);
  const businessLines = legacyBusinessLineRows(Array.isArray(site.businessLines) ? visibleCmsRecords(site.businessLines, preview) : [], template.key);
  const seedServices = legacySeedRows(profile.seedServices, template.key);
  const services = cmsServices.length ? cmsServices : (businessLines.length ? businessLines : seedServices);
  const products = cmsServices.length ? cmsServices : (businessLines.length ? businessLines : legacySeedRows(profile.seedProducts || profile.seedServices, template.key));
  const destinations = cmsServices.length ? cmsServices : (businessLines.length ? businessLines : legacySeedRows(profile.destinations || [], template.key));
  const hotels = cmsCases.length
    ? cmsCases.map((item, index) => ({
      id: item.id || `${template.key}-hotel-${index + 1}`,
      title: item.title || item.name || `酒店 ${index + 1}`,
      description: item.description || item.summary || item.result || item.service || "舒适住宿，品质之选。",
      price: item.price || item.meta || item.result || item.service || "咨询报价",
      icon: item.icon || ["building", "design", "pin"][index % 3]
    }))
    : (profile.hotels || []).map(([title, description, price, icon], index) => ({ id: `${template.key}-hotel-${index + 1}`, title, description, price, icon }));
  const people = legacyPeopleRows(cmsCases, profile.people || []);
  return {
    profile,
    services,
    products,
    cases: cmsCases,
    articles: cmsArticles,
    destinations,
    hotels,
    people
  };
}

function legacyImageSlot(className, item, site, template, label, icon = "building", assetBase = "/assets") {
  const configured = defaultContentImage(site, label, template, assetBase);
  const src = safeUrl(item?.image, "image") || configured?.src || "";
  if (src) {
    return `<div class="${className} legacy-media ${item?.image ? "has-template-image" : "has-default-image"}"><img src="${escapeHtml(src)}" alt="${escapeHtml(item?.imageAlt || item?.title || configured?.alt || label)}" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="${className} legacy-media no-template-image" role="img" aria-label="${escapeHtml(label)}">${sourceIcon(icon)}</div>`;
}

function legacyIconSlot(className, icon, label) {
  return `<div class="${className}" role="img" aria-label="${escapeHtml(label)}">${sourceIcon(icon)}</div>`;
}

function legacyServiceCards(items, site, template, cardClass = "service-card", assetBase = "/assets") {
  return items.slice(0, 8).map((item, index) => {
    const icon = item.icon || ["building", "service", "chart", "gear", "design", "award"][index % 6];
    const visual = legacyImageSlot("service-icon", item, site, template, "服务图片", icon, assetBase);
    return `<div class="${cardClass}">${visual}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "查看服务范围、适用对象与交付方式。")}</p>${item.meta ? `<small class="legacy-card-meta">${escapeHtml(item.meta)}</small>` : ""}</div>`;
  }).join("");
}

function legacyFeatureCards(items) {
  return items.slice(0, 8).map((item, index) => `<div class="feature-card feature-item"><div class="feature-icon">${sourceIcon(item.icon || ["gear", "chart", "building", "check"][index % 4])}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "专业团队提供清晰、可靠的服务支持。")}</p></div>`).join("");
}

function legacyProductCards(items, site, template, assetBase = "/assets") {
  return items.slice(0, 8).map((item, index) => `<div class="product-card"><div>${legacyImageSlot("product-image", item, site, template, "产品图片", item.icon || ["gear", "chart", "factory", "service"][index % 4], assetBase)}</div><div class="product-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.summary || "查看产品能力、适用场景与服务支持。")}</p>${item.meta || item.result ? `<div class="product-price">${escapeHtml(item.meta || item.result)}</div>` : ""}</div></div>`).join("");
}

function legacyCourseCards(items, site, template, assetBase = "/assets") {
  return items.slice(0, 8).map((item, index) => `<div class="course-card"><div>${legacyImageSlot("course-image", item, site, template, "课程图片", item.icon || ["chart", "news", "gear", "design"][index % 4], assetBase)}</div><div class="course-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "查看课程内容、适合对象与学习安排。")}</p>${item.meta ? `<div class="course-meta"><span>${escapeHtml(item.meta)}</span><span>了解详情</span></div>` : ""}</div></div>`).join("");
}

function legacyDestinationCards(items, site, template, assetBase = "/assets") {
  return items.slice(0, 8).map((item, index) => `<div class="dest-card"><div>${legacyImageSlot("dest-card-bg", item, site, template, "目的地图片", item.icon || ["building", "design", "pin", "service"][index % 4], assetBase)}</div><div class="dest-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "发现目的地的独特体验。")}</p></div></div>`).join("");
}

function legacyHotelCards(items, site, template, assetBase = "/assets") {
  return items.slice(0, 8).map((item, index) => `<div class="hotel-card"><div>${legacyImageSlot("hotel-image", item, site, template, "酒店图片", item.icon || ["building", "design", "pin"][index % 3], assetBase)}</div><div class="hotel-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "舒适住宿，品质之选。")}</p><div class="hotel-meta"><span class="hotel-price">${escapeHtml(item.price || "咨询报价")}</span><span aria-label="品质服务">${sourceIcon("award")}</span></div></div></div>`).join("");
}

function legacyStats(profile) {
  const statClass = profile.statsClass === "stat-box" ? "stat-box" : "stat-item";
  const numberClass = profile.statsClass === "stat-box" ? "number" : "num";
  return (profile.stats || []).map(([number, label]) => `<div class="${statClass}"><div class="${numberClass}" data-target="${escapeHtml(number)}">0</div><div class="label">${escapeHtml(label)}</div></div>`).join("");
}

function legacyNewsSection(site, template, articles, profile, assetBase = "/assets") {
  if (!articles.length) return "";
  const cards = articles.slice(0, 6).map((article) => `<article class="legacy-article-card"><div>${legacyImageSlot("legacy-article-image", article, site, template, "文章封面", "news", assetBase)}</div><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><small>${escapeHtml(article.categoryName || "行业资讯")}</small><h3><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p></article>`).join("");
  return `<section class="section legacy-news-section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.articleSectionTitle)}</h2><p>${escapeHtml(profile.articleSectionLead)}</p></div><div class="legacy-article-grid">${cards}</div></div></section>`;
}

function legacyCaseSection(site, template, cases, profile, assetBase = "/assets") {
  if (!cases.length) return "";
  const cards = cases.slice(0, 6).map((item, index) => `<article class="legacy-list-card"><div>${legacyImageSlot("legacy-image", item, site, template, "案例图片", item.icon || ["building", "factory", "service"][index % 3], assetBase)}</div><small>${escapeHtml(item.industry || item.service || "实施场景")}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.result || "查看项目实施过程与交付结果。")}</p></article>`).join("");
  return `<section class="section legacy-case-section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="legacy-card-grid">${cards}</div></div></section>`;
}

function legacyCta(site, profile) {
  return `<section class="cta"><div class="container"><h2>${escapeHtml(profile.ctaTitle || profile.ctaLabel)}</h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><a href="/contact/" class="btn btn-primary">${escapeHtml(site.cta || profile.ctaLabel)}</a></div></section>`;
}

function legacyPageHeader(page, profile) {
  const title = page.title || profile.pageProductTitle;
  const description = page.seoDescription || profile.pageProductLead;
  return `<header class="legacy-page-header"><div class="container"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav></div></header>`;
}

function renderLegacySourceHomeBody({ site, page, articles, template, preview, assetBase = "/assets" }) {
  const data = legacyTemplateData(site, articles, preview, template);
  const { profile } = data;
  const hero = moduleOf(site, page.id, "hero", preview);
  const heroTitle = hero?.title && hero.title !== "首屏" ? hero.title : profile.heroTitle;
  const heroDescription = moduleText(hero, site.description || profile.heroDescription);
  const heroMarkup = `<section class="hero"><div class="container"><div class="hero-content"><h1>${sourceTemplateTitleMarkup(heroTitle, profile.heroHighlight)}</h1><p>${escapeHtml(heroDescription)}</p><div class="hero-buttons"><a href="/services/" class="btn btn-primary">${escapeHtml(profile.heroButton || profile.pageProductTitle)}</a><a href="/contact/" class="btn btn-outline">${escapeHtml(site.cta || profile.ctaLabel)}</a></div></div></div></section>`;
  let body = "";
  if (template.key === "03-software-ai") {
    const featureItems = data.services;
    const productItems = data.products;
    const techItems = profile.techItems || [];
    body = `${heroMarkup}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="features-grid">${legacyFeatureCards(featureItems)}</div></div></section><section class="section products"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="products-grid">${legacyProductCards(productItems, site, template, assetBase)}</div></div></section><section class="tech-stack"><div class="container"><div class="section-header"><h2 style="color:white">技术栈</h2><p style="color:rgba(255,255,255,0.8)">采用业界领先的技术架构</p></div><div class="tech-grid">${techItems.map(([title, label, icon]) => `<div class="tech-item"><div class="icon">${sourceIcon(icon)}</div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(label)}</p></div>`).join("")}</div></div></section><section class="section"><div class="container"><div class="section-header"><h2>数据说话</h2><p>用实力赢得客户信赖</p></div><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else if (template.key === "04-logistics") {
    body = `${heroMarkup}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="services-grid">${legacyServiceCards(data.services, site, template, "service-card", assetBase)}</div></div></section><section class="section features"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="features-grid">${profile.featureItems.map(([title, description], index) => `<div class="feature-item"><div class="feature-num">${String(index + 1).padStart(2, "0")}</div><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div></div>`).join("")}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else if (template.key === "05-business-services" || template.key === "06-finance") {
    const productMode = template.key === "06-finance";
    const primaryCards = productMode ? legacyProductCards(data.services, site, template, assetBase) : legacyServiceCards(data.services, site, template, "service-card", assetBase);
    const advantages = profile.advantages.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    body = `${heroMarkup}<section class="section ${productMode ? "products" : "services"}"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="${productMode ? "products-grid" : "services-grid"}">${primaryCards}</div></div></section><section class="section"><div class="container"><div class="advantages"><div class="advantages-content"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p><ul class="advantages-list">${advantages}</ul></div>${legacyImageSlot("advantages-image", {}, site, template, "企业优势图片", productMode ? "award" : "design", assetBase)}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else if (template.key === "07-healthcare") {
    body = `${heroMarkup}<section class="section services"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="services-grid">${legacyServiceCards(data.services, site, template, "service-card", assetBase)}</div></div></section><section class="section departments"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="dept-grid">${profile.departments.map(([title, icon]) => `<div class="dept-card">${legacyIconSlot("dept-icon", icon, title)}<h3>${escapeHtml(title)}</h3></div>`).join("")}</div></div></section><section class="section doctors"><div class="container"><div class="section-header"><h2>专家团队</h2><p>专业团队，安心守护</p></div><div class="doctors-grid">${data.people.map((person, index) => `<div class="doctor-card">${legacyImageSlot("doctor-avatar", person, site, template, "专家照片", person.icon || ["team", "award", "building", "check"][index % 4], assetBase)}<h4>${escapeHtml(person.title)}</h4><p>${escapeHtml(person.role)}</p></div>`).join("")}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else if (template.key === "08-education") {
    body = `${heroMarkup}<section class="section courses"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="courses-grid">${legacyCourseCards(data.services, site, template, assetBase)}</div></div></section><section class="section features"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="features-grid">${profile.featureItems.map(([title, description, icon]) => `<div class="feature-item"><div class="feature-icon">${sourceIcon(icon)}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>`).join("")}</div></div></section><section class="section teachers"><div class="container"><div class="section-header"><h2>明星教师</h2><p>优秀师资，成就优秀学生</p></div><div class="teachers-grid">${data.people.map((person, index) => `<div class="teacher-card">${legacyImageSlot("teacher-avatar", person, site, template, "教师照片", person.icon || ["team", "award", "building", "check"][index % 4], assetBase)}<h4>${escapeHtml(person.title)}</h4><p>${escapeHtml(person.role)}</p></div>`).join("")}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else if (template.key === "09-travel-hotel") {
    body = `${heroMarkup}<section class="section destinations"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="dest-grid">${legacyDestinationCards(data.destinations, site, template, assetBase)}</div></div></section><section class="section hotels"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="hotels-grid">${legacyHotelCards(data.hotels, site, template, assetBase)}</div></div></section><section class="section services"><div class="container"><div class="section-header"><h2>我们的服务</h2><p>一站式旅游解决方案</p></div><div class="services-grid">${legacyServiceCards(data.services, site, template, "service-item", assetBase)}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  } else {
    body = `${heroMarkup}<section class="section products"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div><div class="products-grid">${legacyProductCards(data.services, site, template, assetBase)}</div></div></section><section class="section features"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.caseSectionTitle)}</h2><p>${escapeHtml(profile.caseSectionLead)}</p></div><div class="features-grid">${profile.featureItems.map(([title, description, icon]) => `<div class="feature-item"><div class="feature-icon">${sourceIcon(icon)}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>`).join("")}</div></div></section><section class="section cooking"><div class="container"><div class="cooking-content"><div class="cooking-text"><h2>${escapeHtml(profile.cookingTitle)}</h2>${profile.cookingParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<a href="/about/" class="btn btn-primary">了解更多</a></div>${legacyImageSlot("cooking-image", {}, site, template, "品牌制作图片", "design", assetBase)}</div></div></section><section class="stats"><div class="container"><div class="stats-grid">${legacyStats(profile)}</div></div></section>${legacyNewsSection(site, template, data.articles, profile, assetBase)}${legacyCta(site, profile)}`;
  }
  return `<main id="template-main">${body}</main>`;
}

function renderLegacySourceHomePage({ site, page, articles, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  const body = renderLegacySourceHomeBody({ site, page, articles, template, preview, assetBase });
  return sourceDocumentShell({ site, origin, pathname: "/", title: "", description: site.description || profile.heroDescription, active: "/", schemaExtra: [{ "@type": "WebPage", name: site.siteName, description: site.description || profile.heroDescription }], body, preview, assetBase, activeTemplate: template });
}

function legacyServicePageCards(site, template, data, assetBase = "/assets") {
  if (template.key === "03-software-ai" || template.key === "06-finance" || template.key === "10-food-consumer") return `<div class="products-grid">${legacyProductCards(data.products, site, template, assetBase)}</div>`;
  if (template.key === "08-education") return `<div class="courses-grid">${legacyCourseCards(data.services, site, template, assetBase)}</div>`;
  if (template.key === "09-travel-hotel") return `<div class="dest-grid">${legacyDestinationCards(data.destinations, site, template, assetBase)}</div>`;
  const cardClass = template.key === "09-travel-hotel" ? "service-item" : "service-card";
  return `<div class="services-grid">${legacyServiceCards(data.services, site, template, cardClass, assetBase)}</div>`;
}

function renderLegacySourceServicesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const data = legacyTemplateData(site, [], preview, template);
  const profile = data.profile;
  const body = `<main id="template-main">${legacyPageHeader(page, profile)}<section class="section"><div class="container"><div class="section-header"><h2>${escapeHtml(profile.serviceSectionTitle)}</h2><p>${escapeHtml(profile.serviceSectionLead)}</p></div>${legacyServicePageCards(site, template, data, assetBase)}</div></section>${legacyCaseSection(site, template, data.cases, profile, assetBase)}${legacyCta(site, profile)}</main>`;
  return sourceDocumentShell({ site, origin, pathname: page.path || "/services/", title: page.title || profile.pageProductTitle, description: page.seoDescription || profile.pageProductLead, active: "/services/", schemaExtra: data.services.map((service) => ({ "@type": "Service", name: service.title, description: service.description })), body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceCasesPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const data = legacyTemplateData(site, [], preview, template);
  const profile = data.profile;
  const items = data.cases.length ? data.cases : data.products;
  const cards = items.slice(0, 8).map((item, index) => `<article class="legacy-list-card">${legacyImageSlot("legacy-image", item, site, template, "案例图片", item.icon || ["building", "factory", "service"][index % 3], assetBase)}<small>${escapeHtml(item.industry || item.service || "企业场景")}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || item.description || item.result || "查看企业公开场景与服务能力。")}</p></article>`).join("");
  const body = `<main id="template-main">${legacyPageHeader({ ...page, title: page.title || profile.caseSectionTitle, seoDescription: profile.caseSectionLead }, profile)}<section class="section legacy-page-content"><div class="container"><div class="legacy-card-grid">${cards || '<p>内容正在整理中。</p>'}</div></div></section>${legacyCta(site, profile)}</main>`;
  return sourceDocumentShell({ site, origin, pathname: page.path || "/cases/", title: page.title || profile.caseSectionTitle, description: page.seoDescription || profile.caseSectionLead, active: "/cases/", schemaExtra: [{ "@type": "CollectionPage", name: page.title || profile.caseSectionTitle }], body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceAboutPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const data = legacyTemplateData(site, [], preview, template);
  const profile = data.profile;
  const featureItems = profile.featureItems || profile.advantages?.map((title) => [title, "以清晰的服务流程和专业团队提供支持。", "check"]) || [];
  const features = featureItems.slice(0, 6).map(([title, description, icon]) => `<div class="legacy-list-card"><div class="feature-icon">${sourceIcon(icon || "check")}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description || "企业专业能力与服务说明。")}</p></div>`).join("");
  const body = `<main id="template-main">${legacyPageHeader({ ...page, title: page.title || "关于我们", seoDescription: profile.aboutLead }, profile)}<section class="section"><div class="container"><div class="legacy-about-grid"><div>${legacyImageSlot("legacy-about-visual", {}, site, template, "企业展示图片", "building", assetBase)}</div><div class="legacy-about-copy"><h2>${escapeHtml(site.companyName || site.siteName || "企业官网")}</h2><p>${escapeHtml(site.description || profile.aboutLead)}</p><p>${escapeHtml(profile.aboutLead)}</p><a href="/contact/" class="btn btn-primary">${escapeHtml(site.cta || profile.ctaLabel)}</a></div></div></div></section><section class="section"><div class="container"><div class="section-header"><h2>企业能力</h2><p>后台维护的服务与公开信息会同步到这里。</p></div><div class="legacy-card-grid">${features}</div></div></section>${legacyCta(site, profile)}</main>`;
  return sourceDocumentShell({ site, origin, pathname: page.path || "/about/", title: page.title || "关于我们", description: page.seoDescription || profile.aboutLead, active: "/about/", schemaExtra: [{ "@type": "AboutPage", name: page.title || "关于我们" }], body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceContactPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  const contact = site.contact || {};
  const rows = [["pin", "公司地址", contact.address || "欢迎通过表单提交项目地址"], ["phone", "联系电话", contact.phone || "提交表单后由运营人员联系"], ["mail", "电子邮箱", contact.email || "暂未配置公开邮箱"], ["clock", "服务区域", contact.serviceArea || contact.industryRegion || "以实际业务沟通为准"]];
  const info = rows.map(([icon, label, value]) => `<div class="info-item"><div class="info-icon">${sourceIcon(icon)}</div><div class="info-content"><h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p></div></div>`).join("");
  const body = `<main id="template-main">${legacyPageHeader({ ...page, title: page.title || "联系我们", seoDescription: profile.articleSectionLead }, profile)}<section class="section"><div class="container"><div class="legacy-contact-layout"><div class="legacy-contact-info"><h2>${escapeHtml(site.companyName || site.siteName || "企业官网")}</h2><p>${escapeHtml(site.description || profile.aboutLead)}</p>${info}</div><div class="legacy-contact-form"><h2>在线留言</h2>${sourceContactForm(site, page.path || "/contact/", template.key)}</div></div></div></section></main>`;
  return sourceDocumentShell({ site, origin, pathname: page.path || "/contact/", title: page.title || "联系我们", description: page.seoDescription || profile.articleSectionLead, active: "/contact/", schemaExtra: [{ "@type": "ContactPage", name: page.title || "联系我们" }], body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceInsightsPage({ site, articles, categories = [], selectedCategory = null, origin, page = 1, pageSize = 12, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  const rows = frontendArticles(articles, site.frontendDemo).filter((article) => !selectedCategory || article.categorySlug === selectedCategory.slug || article.categoryName === selectedCategory.name);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 12));
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const activePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const visible = rows.slice((activePage - 1) * safePageSize, activePage * safePageSize);
  const cards = visible.map((article) => `<article class="legacy-article-card">${legacyImageSlot("legacy-article-image", article, site, template, "文章封面", "news", assetBase)}<time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><small>${escapeHtml(article.categoryName || "行业资讯")}</small><h2><a href="${escapeHtml(articleLink(article))}">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.excerpt || "查看企业公开发布的行业内容。")}</p></article>`).join("");
  const canonicalBase = selectedCategory ? `/insights/category/${encodeURIComponent(selectedCategory.slug)}/` : "/insights/";
  const body = `<main id="template-main">${legacyPageHeader({ title: selectedCategory?.name || "行业资讯", seoDescription: profile.articleSectionLead }, profile)}<section class="section legacy-page-content"><div class="container"><div class="legacy-article-grid">${cards || '<p>当前栏目暂未发布文章。</p>'}</div>${pagination(origin, canonicalBase, activePage, totalPages)}</div></section></main>`;
  return sourceDocumentShell({ site, origin, pathname: canonicalBase, title: selectedCategory?.name || "行业资讯", description: profile.articleSectionLead, active: "/insights/", schemaExtra: [{ "@type": "CollectionPage", name: selectedCategory?.name || "行业资讯" }], body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceProblemMapPage({ site, page, origin, preview = false, assetBase = "/site-assets-r6" }) {
  const template = legacySourceTemplateFor(site);
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  const groups = frontendProblemGroups(site, preview);
  const questions = groups.flatMap((group) => group.questions.map((problem) => ({ ...problem, service: group.service }))).slice(0, 12);
  const cards = questions.map((problem) => `<article class="legacy-list-card"><small>${escapeHtml(problem.service)}</small><h3>${escapeHtml(problem.title)}</h3><p>${escapeHtml(problem.answer)}</p><a href="/problem-map/${encodeURIComponent(problem.slug)}/" class="btn btn-primary">查看回答</a></article>`).join("");
  const body = `<main id="template-main">${legacyPageHeader({ ...page, title: page.title || "问题地图", seoDescription: "客户常见问题与直接回答。" }, profile)}<section class="section legacy-page-content"><div class="container"><div class="legacy-card-grid">${cards || "<p>问题内容正在整理中。</p>"}</div></div></section>${legacyCta(site, profile)}</main>`;
  return sourceDocumentShell({ site, origin, pathname: page.path || "/problem-map/", title: page.title || "问题地图", description: "客户常见问题与直接回答。", active: "/problem-map/", body, preview, assetBase, activeTemplate: template });
}

function renderLegacySourceArticleBody({ site, article, template, contentHtml, provenanceNote, assetBase = "/assets" }) {
  const profile = LEGACY_SOURCE_PROFILES[template.key];
  return `<main id="template-main">${legacyPageHeader({ title: article.categoryName || profile.articleSectionTitle, seoDescription: article.excerpt || profile.articleSectionLead }, profile)}<section class="section"><div class="container"><article class="legacy-article-body"><div>${legacyImageSlot("legacy-article-image", article, site, template, "文章封面", "news", assetBase)}</div><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${escapeHtml(dateShort(article.publishedAt))}</time><h2>${escapeHtml(article.title)}</h2>${article.excerpt ? `<p><strong>${escapeHtml(article.excerpt)}</strong></p>` : ""}${contentHtml}<p class="legacy-article-note">${escapeHtml(provenanceNote)}</p></article></div></section></main>`;
}

export function findFrontendArticle(slug) {
  const value = normalizeArticleSlug(slug);
  return FRONTEND_ARTICLES.find((item) => normalizeArticleSlug(item.slug) === value) || null;
}

export function findFrontendProblem(slug) {
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

function renderBespokeProblemPage({ site, problem, group, related, origin, preview = false }) {
  const canonicalPath = `/problem-map/${encodeURIComponent(problem.slug)}/`;
  const title = escapeHtml(problem.title);
  const answer = escapeHtml(problem.answer || "我们会结合企业现状、服务方向与应用场景给出可执行的判断。");
  const service = escapeHtml(group.service || "桐灼服务");
  const industries = Array.isArray(problem.industries) && problem.industries.length ? problem.industries.map((item) => escapeHtml(item)).join(" · ") : "以实际业务场景为准";
  const relatedMarkup = related.length ? `<section class="section white"><div class="shell"><div class="section-head"><div><span class="kicker">Related insights</span><h2>继续阅读</h2></div><p>查看同一服务方向下的行业内容。</p></div><div class="insight-list">${related.map((item) => `<article class="insight-card"><time>${escapeHtml(item.categoryName || "行业资讯")} · ${escapeHtml(dateShort(item.publishedAt))}</time><h3><a href="${escapeHtml(articleLink(item))}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt || "查看桐灼公开发布的行业内容。")}</p><a class="text-link" href="${escapeHtml(articleLink(item))}">阅读全文 <span>→</span></a></article>`).join("")}</div></div></section>` : "";
  const nav = `<header class="site-header"><div class="shell nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><nav class="nav-links" aria-label="主导航"><a href="/">首页</a><a href="/products.html">服务</a><a href="/insights.html">行业资讯</a><a class="active" href="/problem-map.html">问题地图</a><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></nav><div class="nav-actions"><a class="nav-cta" href="/contact.html">预约业务诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button></div></div></header>`;
  const footer = `<footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><p>桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。</p></div><div class="footer-col"><strong>服务</strong><a href="/product-website.html">GEO优化</a><a href="/product-content-platform.html">短视频运营</a><a href="/product-distribution.html">企业AI落地</a></div><div class="footer-col"><strong>内容</strong><a href="/insights.html">行业资讯</a><a href="/problem-map.html">问题地图</a></div><div class="footer-col"><strong>公司</strong><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></div></div><div class="shell footer-bottom"><span>© 2026 桐灼（淄博）网络科技有限公司</span><a class="footer-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">鲁ICP备2026021587号-2</a><span>内容由桐灼研究发布</span></div></footer>`;
  const body = `<a class="skip-link" href="#main">跳到正文</a>${nav}<main id="main"><header class="article-hero"><div class="shell"><a class="breadcrumb" href="/problem-map.html">问题地图</a><span class="kicker">${service}</span><h1>${title}</h1><p>这是客户在企业决策过程中经常提出的问题。下面先给出直接回答，再说明适用边界和下一步。</p><div class="article-meta"><span>所属服务：${service}</span><span>适用行业：${industries}</span></div></div></header><article class="shell article-layout tz-problem-detail" id="problem"><aside class="article-toc" aria-label="问题导航"><strong>问题地图</strong><a href="/problem-map.html">返回问题总览</a><a href="#answer">直接回答</a><a href="#next">建议从哪里开始</a></aside><div class="prose"><section class="answer-box" id="answer"><strong>直接回答</strong><p>${answer}</p></section><h2>这个问题为什么重要</h2><p>客户提出的问题，往往比企业自我介绍更接近真实决策。把问题说清楚，才能让官网、文章和服务说明围绕同一套事实展开。</p><h2 id="next">建议从哪里开始</h2><ol><li>确认企业主体、产品服务和应用场景。</li><li>补充采购、技术和使用阶段的具体判断条件。</li><li>用一篇结构清晰的行业文章回答问题，并回链到服务与联系方式。</li></ol><div class="source-note">内容由桐灼企业内容工作台公开发布，具体方案以业务沟通结果为准。</div><a class="button ink" href="/contact.html">围绕这个问题咨询 <span class="arrow">→</span></a></div></article>${relatedMarkup}<section class="contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Talk to Tongzhuo</span><h2>把你的企业场景告诉我们。</h2><p>留下当前问题和业务背景，桐灼会结合服务方向给出下一步建议。</p></div><div class="contact-form"><strong style="font-size:24px">从真实问题开始沟通</strong><p style="color:var(--muted)">提交问题后由企业运营人员跟进。</p><a class="button ink" href="/contact.html">提交业务问题 <span class="arrow">→</span></a></div></div></section></main>${footer}<script src="/assets/site.js?v=20260827-problem-detail" defer></script>`;
  const canonical = absoluteUrl(origin, canonicalPath);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}｜桐灼科技</title><meta name="description" content="${answer}"><meta name="robots" content="${preview ? "noindex,nofollow" : "index,follow"}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta name="theme-color" content="#fbfbfa"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/wukong-overrides.css?v=20260827-problem-detail-2"></head><body>${body}</body></html>`;
}

export function renderProblemPage({ site, problem, group, articles = [], origin, preview = false, assetBase = "/site-assets-r6", bespoke = false }) {
  const articleSource = frontendArticles(articles, site.frontendDemo);
  const relatedIds = new Set(Array.isArray(problem.relatedArticleIds) ? problem.relatedArticleIds : []);
  const related = articleSource.filter((item) => relatedIds.size ? relatedIds.has(item.id) : item.categorySlug === group.id).slice(0, 3);
  const canonicalPath = `/problem-map/${encodeURIComponent(problem.slug)}/`;
  if (bespoke) return renderBespokeProblemPage({ site, problem, group, related, origin, preview });
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
  const template = sourceTemplateFor(site);
  if (template) {
    const profile = sourceTemplateProfile(template);
    const industries = Array.isArray(problem.industries) && problem.industries.length ? `适用行业：${escapeHtml(problem.industries.join("、"))}` : "";
    const relatedRows = related.length ? `<div class="template-source-related"><h3>继续阅读</h3>${related.map((item) => `<a class="template-source-related-card" href="${articleLink(item)}"><span>${escapeHtml(item.categoryName || "行业资讯")}</span><h4>${escapeHtml(item.title)}</h4></a>`).join("")}</div>` : "";
    const body = `<main id="template-main">${sourcePageHeader("客户问题", "这是客户在企业决策过程中经常提出的问题，下面先给出直接回答，再说明适用边界和下一步。")}<section class="section"><div class="container"><article class="template-source-article"><div class="news-date">${escapeHtml(group.service)}${industries ? ` · ${industries}` : ""}</div><h2>${escapeHtml(problem.title)}</h2><p class="template-source-article-lead">${escapeHtml(problem.answer)}</p><div class="template-source-article-content"><h2>这个问题为什么重要</h2><p>客户提出的问题，往往比企业自我介绍更接近真实决策。把问题说清楚，才能让官网、文章和服务说明围绕同一套事实展开。</p><h2>建议从哪里开始</h2><ol><li>确认企业主体、产品服务和应用场景。</li><li>补充采购、技术和使用阶段的具体判断条件。</li><li>用一篇结构清晰的行业文章回答问题，并回链到服务与联系方式。</li></ol></div>${relatedRows}<p class="template-source-article-note"><a class="btn btn-primary" href="/contact/">围绕这个问题咨询</a></p></article></div></section></main>`;
    return sourceDocumentShell({ site, origin, pathname: canonicalPath, title: problem.title, description: problem.answer, active: "/problem-map/", schemaExtra, body, preview, assetBase, activeTemplate: template });
  }
  const body = `<header class="problem-detail-hero"><div class="shell"><a class="breadcrumb" href="/problem-map/">问题地图</a><span class="kicker">${escapeHtml(group.service)}</span><h1>${escapeHtml(problem.title)}</h1><p>这是客户在企业决策过程中经常提出的问题。下面先给出直接回答，再说明适用边界和下一步。</p></div></header><section class="problem-detail-main"><div class="shell problem-detail-layout"><article><section class="direct-answer"><span class="direct-answer-label">直接回答</span><p>${escapeHtml(problem.answer)}</p></section><section class="problem-detail-copy"><h2>这个问题为什么重要</h2><p>客户提出的问题，往往比企业自我介绍更接近真实决策。把问题说清楚，才能让官网、文章和服务说明围绕同一套事实展开。</p><h2>建议从哪里开始</h2><ol><li>确认企业主体、产品服务和应用场景。</li><li>补充采购、技术和使用阶段的具体判断条件。</li><li>用一篇结构清晰的行业文章回答问题，并回链到服务与联系方式。</li></ol></section></article><aside class="problem-detail-aside"><div><span>所属服务</span><b>${escapeHtml(group.service)}</b></div><div><span>适用行业</span><b>${escapeHtml((problem.industries || []).join(" · "))}</b></div><a class="button primary" href="/contact/">围绕这个问题咨询</a></aside></div></section>${related.length ? `<section class="section white"><div class="shell"><div class="section-head"><div><span class="kicker">Related insights</span><h2>继续阅读</h2></div><p>查看同一服务方向下的行业内容。</p></div><div class="compact-article-grid">${related.map(compactArticleCard).join("")}</div></div></section>` : ""}<section class="contact-band contact-band-v2"><div class="shell contact-grid"><div><span class="eyebrow">Need a more specific answer?</span><h2>把你的企业场景告诉我们。</h2></div>${actionLink("提交业务问题", "/contact/", "button ink")}</div></section>`;
  return documentShell({ site, origin, pathname: canonicalPath, title: problem.title, description: problem.answer, active: "/problem-map/", schemaExtra, body, preview, assetBase });
}

export function renderFixedPage({ site, page, articles = [], categories = [], origin, preview = false, assetBase = "/site-assets-r6" }) {
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
  return `<article class="blog-entry"><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}" class="blog-date"><strong>${escapeHtml(dateDay(article.publishedAt))}</strong><span>${escapeHtml(dateMonth(article.publishedAt))}</span></time><div class="blog-entry-body">${optionalMedia(article.image, article.imageAlt, "文章封面")}${articleMeta(article)}<h3><a href="${escapeHtml(url)}">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p>${article.tags?.length ? `<div class="blog-tags">${article.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</div><a class="blog-entry-link" href="${escapeHtml(url)}" aria-label="阅读${escapeHtml(article.title)}">→</a></article>`;
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

function renderTemplateArticleBody({ site, article, activeTemplate, tableOfContents, contentHtml, provenanceNote, related, publishedMeta, modifiedMeta }) {
  const layout = activeTemplate.layout || "article-standard";
  const meta = `<div class="template-article-meta"><span>${escapeHtml(article.author || site.siteName)}</span>${publishedMeta}${modifiedMeta}<span>${Math.max(1, Math.ceil(plainText(article.contentText || article.contentHtml).length / 500))} 分钟阅读</span></div>`;
  const articleContent = `<article class="template-article-content" id="article" data-content-article-id="${escapeHtml(article.id)}"><div class="template-article-reading">${article.excerpt ? `<div class="template-article-summary"><strong>内容摘要</strong><p>${escapeHtml(article.excerpt)}</p></div>` : ""}${contentHtml}${article.tags?.length ? `<div class="template-article-tags">主题：${escapeHtml(article.tags.join("、"))}</div>` : ""}<div class="template-article-provenance">${provenanceNote}</div></div>${tableOfContents}</article>`;
  const contactBand = `<section class="template-article-cta"><div class="template-shell"><div><span>CONTINUE THE CONVERSATION</span><h2>把这篇内容放回你的真实业务场景。</h2><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p></div><a class="template-button template-button--solid" href="/contact/">${escapeHtml(site.cta || "联系我们")} <span aria-hidden="true">→</span></a></div></section>`;
  const header = `<header class="template-article-hero template-article-hero--${escapeHtml(layout)}"><div class="template-shell"><span class="template-kicker">${escapeHtml(article.categoryName || activeTemplate.shortName)}</span><h1>${escapeHtml(article.title)}</h1>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ""}${meta}</div></header>`;
  if (layout === "project-studio") {
    return `<div class="template-article-frame template-article-frame--${escapeHtml(layout)}">${header}<div class="template-shell template-article-stage"><aside class="template-article-side"><span>PROJECT NOTE</span><strong>项目<br>现场</strong><a href="/cases/">查看实施案例 <span aria-hidden="true">→</span></a></aside>${articleContent}</div>${related}${contactBand}</div>`;
  }
  if (layout === "tech-system") {
    return `<div class="template-article-frame template-article-frame--${escapeHtml(layout)}">${header}<div class="template-shell template-article-tech-stage"><div class="template-article-console"><span>KNOWLEDGE / ${escapeHtml(article.categoryName || "ARTICLE")}</span><b>01</b><i></i><i></i><i></i></div>${articleContent}</div>${related}${contactBand}</div>`;
  }
  if (layout === "route-network") {
    return `<div class="template-article-frame template-article-frame--${escapeHtml(layout)}">${header}<div class="template-shell template-article-route-stage"><div class="template-article-route-rail"><span>ROUTE</span><b>A</b><i></i><b>B</b><i></i><b>C</b><small>从问题到交付</small></div>${articleContent}</div>${related}${contactBand}</div>`;
  }
  return `<div class="template-article-frame template-article-frame--${escapeHtml(layout)}">${header}<div class="template-shell template-article-stage">${articleContent}</div>${related}${contactBand}</div>`;
}

function templateInsightCard(article, layout) {
  const date = escapeHtml(dateShort(article.publishedAt));
  const category = escapeHtml(article.categoryName || "行业观点");
  const href = escapeHtml(articleLink(article));
  const excerpt = escapeHtml(article.excerpt || "查看已发布的企业行业内容与服务洞察。");
  const marker = layout === "project-studio" ? "PROJECT NOTE" : layout === "tech-system" ? "SIGNAL LOG" : layout === "route-network" ? "ROUTE NOTE" : "INSIGHT";
  return `<article class="template-insight-card template-insight-card--${escapeHtml(layout)}"><div class="template-insight-card-meta"><span>${marker}</span><time datetime="${escapeHtml(isoDate(article.publishedAt).slice(0, 10))}">${date}</time></div><div><small>${category}</small><h2><a href="${href}">${escapeHtml(article.title)}</a></h2><p>${excerpt}</p></div><a class="template-insight-card-link" href="${href}" aria-label="阅读${escapeHtml(article.title)}">阅读文章 <span aria-hidden="true">→</span></a></article>`;
}

function renderTemplateInsightsPageBody({ site, articles, categories, selectedCategory, activeTemplate, activePage, total, totalPages, canonicalPath, origin }) {
  const layout = activeTemplate.layout;
  const title = selectedCategory ? selectedCategory.name : `${activeTemplate.shortName}资讯`;
  const description = selectedCategory?.description || site.description || "从企业真实业务出发，持续发布可被客户理解和验证的专业内容。";
  const start = (activePage - 1) * 12;
  const visible = articles.slice(start, start + 12);
  const categoryRows = categories
    .filter((item) => item.status !== "archived" && item.navVisible !== false)
    .map((category) => `<a${selectedCategory?.slug === category.slug ? " class=\"active\" aria-current=\"page\"" : ""} href="${escapeHtml(categoryLink(category))}"><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.description || "企业公开内容")}</small></a>`)
    .join("");
  const paginationMarkup = pagination(origin, canonicalPath, activePage, totalPages);
  const eyebrow = layout === "project-studio" ? "JOURNAL / PROJECT INTELLIGENCE" : layout === "tech-system" ? "KNOWLEDGE BASE / SIGNALS" : layout === "route-network" ? "NETWORK / OPERATIONS NOTES" : "INSIGHTS / KNOWLEDGE";
  const lead = layout === "project-studio" ? "项目经验、设计判断与交付过程在这里持续沉淀。" : layout === "tech-system" ? "把技术判断、产品能力与实践经验组织成可查阅的知识信号。" : layout === "route-network" ? "围绕供应链、服务节点和真实业务问题持续更新。" : description;
  return `<div class="template-insights template-insights--${escapeHtml(layout)}"><header class="template-insights-hero"><div class="template-shell"><span class="template-kicker">${eyebrow}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(lead)}</p><div class="template-insights-count"><span>已发布内容</span><b>${total}</b><small>篇</small></div></div></header><section class="template-insights-main"><div class="template-shell template-insights-layout"><div><div class="template-insights-list-heading"><span>ARTICLE ARCHIVE</span><p>${selectedCategory ? `正在查看：${escapeHtml(selectedCategory.name)}` : "按最新发布顺序浏览"}</p></div><div class="template-insights-list">${visible.length ? visible.map((article) => templateInsightCard(article, layout)).join("") : `<p class="template-insights-empty">当前栏目暂未发布文章。</p>`}</div>${paginationMarkup}</div><aside class="template-insights-sidebar"><span>浏览栏目</span><a${selectedCategory ? "" : " class=\"active\" aria-current=\"page\""} href="/insights/"><strong>全部文章</strong><small>企业公开内容</small></a>${categoryRows}<div class="template-insights-sidebar-note"><b>${escapeHtml(activeTemplate.shortName)}</b><p>${escapeHtml(site.description || activeTemplate.description)}</p><a href="/contact/">业务咨询 <span aria-hidden="true">→</span></a></div></aside></div></section></div>`;
}

export function renderInsightsPage({ site, articles, categories, selectedCategory = null, origin, page = 1, pageSize = 12, preview = false, assetBase = "/site-assets-r6" }) {
  const displayArticles = frontendArticles(articles, site.frontendDemo);
  const displayCategories = frontendCategories(categories);
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderSourceInsightsPage({ site, articles: displayArticles, categories: displayCategories, selectedCategory, origin, page, pageSize, preview, assetBase });
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) return renderLegacySourceInsightsPage({ site, articles: displayArticles, categories: displayCategories, selectedCategory, origin, page, pageSize, preview, assetBase });
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
  const standardBody = `<section class="page-hero blog-hero"><div class="shell"><div><span class="eyebrow">Knowledge &amp; Insights</span><h1>${escapeHtml(selectedCategory ? selectedCategory.name : "洞察 AI 搜索与企业增长")}</h1><p>${escapeHtml(selectedCategory?.description || "这里整理企业的行业观点与典型内容。正式上线时以 CMS 审核通过的文章为准，演示数据会明确标注。")}</p><div class="actions"><a class="button primary" href="#archive">浏览文章 <span class="arrow">↓</span></a><a class="button secondary" href="/contact/">提交行业问题</a></div></div></div></section>${featured ? `<section class="section white" id="latest"><div class="shell"><div class="section-head"><div><span class="kicker">Featured</span><h2>最新行业观点</h2></div><p>内容按主题、摘要、作者和日期组织，方便读者与机器系统理解出处；正式站点以 CMS 发布状态为准。</p></div><article class="insight-feature"><div class="insight-visual" aria-hidden="true"><span class="visual-word w1">SOURCE</span><span class="visual-word w2">GEO</span><span class="visual-caption">ENTITY / ANSWER / EVIDENCE / FRESHNESS</span></div><div class="insight-copy">${featured.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<time datetime="${escapeHtml(isoDate(featured.publishedAt).slice(0, 10))}">${escapeHtml(featured.categoryName || "行业观点")} · ${escapeHtml(dateShort(featured.publishedAt))} · ${escapeHtml(featured.author)}</time><h3>${escapeHtml(featured.title)}</h3><p>${escapeHtml(featured.excerpt)}</p><a class="text-link" href="${escapeHtml(articleLink(featured))}">阅读全文 <span>→</span></a></div></article></div></section>` : ""}<section class="section blog-archive" id="archive"><div class="shell blog-layout"><div class="blog-main"><div class="blog-list-head"><div><span class="kicker">All Articles</span><h2>${escapeHtml(selectedCategory?.name || "全部文章")}</h2></div><span>共 ${total} 篇</span></div>${visible.length ? visible.map(articleCard).join("") : `<p class="blog-empty">当前栏目暂未发布文章。</p>`}${pagination(origin, canonicalPath, activePage, totalPages)}</div><aside class="blog-sidebar"><section class="blog-panel"><span class="blog-panel-label">内容栏目</span><a${selectedCategory ? "" : " class=\"active\""} href="/insights/"><strong>全部文章</strong><small>企业公开内容</small></a>${categoryRows}</section><section class="blog-panel blog-about"><span class="blog-panel-label">${escapeHtml(site.siteName)}</span><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p><a class="text-link" href="/about/">了解我们 <span>→</span></a></section></aside></div></section>`;
  const body = activeTemplate.key === DEFAULT_SITE_TEMPLATE_KEY
    ? standardBody
    : renderTemplateInsightsPageBody({ site, articles: displayArticles, categories: displayCategories, selectedCategory, activeTemplate, activePage, total, totalPages, canonicalPath, origin });
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
    body,
    preview,
    assetBase,
    headLinks,
    bodyClass: activeTemplate.key === DEFAULT_SITE_TEMPLATE_KEY ? "" : `insights-layout-${activeTemplate.layout}`
  });
}

function renderBespokeArticlePage({ site, article, origin, relatedArticles, contentHtml, headings, schemaExtra, pathname, preview = false }) {
  const published = isoDate(article.publishedAt);
  const modified = isoDate(article.updatedAt || article.publishedAt);
  const publishedMeta = published ? `<time datetime="${escapeHtml(published.slice(0, 10))}">发布：${escapeHtml(dateLabel(published))}</time>` : "";
  const modifiedMeta = modified ? `<time datetime="${escapeHtml(modified.slice(0, 10))}">更新：${escapeHtml(dateLabel(modified))}</time>` : "";
  const provenance = article.isDemo
    ? "本文为前端演示内容，用于展示资讯结构，不代表已审核发布的正式企业文章。"
    : `本文由${escapeHtml(article.author || site.siteName)}发布，内容来自企业审核通过的正式版本。`;
  const tableOfContents = headings.length
    ? `<aside class="article-toc" aria-label="文章目录"><strong>文章目录</strong>${headings.map((item) => `<a class="toc-${item.level}" href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`).join("")}</aside>`
    : `<aside class="article-toc" aria-label="文章信息"><strong>文章信息</strong><span>${escapeHtml(article.categoryName || "行业观点")}</span><span>${escapeHtml(article.author || site.siteName)}</span><a href="/insights/">返回行业资讯</a></aside>`;
  const related = relatedArticles?.length ? `<section class="section white"><div class="shell"><div class="section-head"><div><span class="kicker">Related</span><h2>相关内容</h2></div><p>继续阅读桐灼公开发布的行业内容。</p></div><div class="insight-list">${relatedArticles.slice(0, 3).map((item) => `<article class="insight-card"><time datetime="${escapeHtml(isoDate(item.publishedAt).slice(0, 10))}">${escapeHtml(item.categoryName || "行业观点")} · ${escapeHtml(dateShort(item.publishedAt))}</time><h3><a href="${escapeHtml(articleLink(item))}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.excerpt || "查看桐灼公开发布的行业内容。")}</p><a class="text-link" href="${escapeHtml(articleLink(item))}">阅读全文 <span>→</span></a></article>`).join("")}</div></div></section>` : "";
  const nav = `<header class="site-header"><div class="shell nav"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><nav class="nav-links" aria-label="主导航"><a href="/">首页</a><a href="/products.html">服务</a><a class="active" href="/insights/">行业资讯</a><a href="/problem-map/">问题地图</a><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></nav><div class="nav-actions"><a class="nav-cta" href="/contact.html">预约业务诊断</a><button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button></div></div></header>`;
  const footer = `<footer class="site-footer"><div class="shell footer-main"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>桐灼科技</span></a><p>桐灼（淄博）网络科技有限公司，专注GEO优化、短视频运营与企业AI落地。</p></div><div class="footer-col"><strong>服务</strong><a href="/product-website.html">GEO优化</a><a href="/product-content-platform.html">短视频运营</a><a href="/product-distribution.html">企业AI落地</a></div><div class="footer-col"><strong>内容</strong><a href="/insights/">行业资讯</a><a href="/problem-map/">问题地图</a></div><div class="footer-col"><strong>公司</strong><a href="/about.html">关于我们</a><a href="/contact.html">联系我们</a></div></div><div class="shell footer-bottom"><span>© ${new Date().getFullYear()} 桐灼（淄博）网络科技有限公司</span><a class="footer-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">鲁ICP备2026021587号-2</a><span>内容由桐灼研究发布</span></div></footer>`;
  const body = `<header class="article-hero"><div class="shell"><span class="kicker">${escapeHtml(article.categoryName || "行业观点")}</span><h1>${escapeHtml(article.title)}</h1>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ""}<div class="article-meta"><span>作者：${escapeHtml(article.author || site.siteName)}</span>${publishedMeta}${modifiedMeta}<span>预计阅读：${Math.max(1, Math.ceil(plainText(article.contentText || article.contentHtml).length / 500))}分钟</span></div></div></header><article class="shell article-layout" id="article" data-content-article-id="${escapeHtml(article.id)}">${tableOfContents}<div class="prose">${article.excerpt ? `<div class="answer-box"><strong>内容摘要</strong><p>${escapeHtml(article.excerpt)}</p></div>` : ""}${contentHtml}${article.tags?.length ? `<div class="source-note">主题：${escapeHtml(article.tags.join("、"))}</div>` : ""}<div class="source-note">${provenance}${modified ? `最后更新：${escapeHtml(dateLabel(modified))}。` : ""}</div></div></article>${related}<section class="contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Build Your Source</span><h2>让企业知识成为客户和 AI 可以理解的可信信源</h2><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p></div><div class="contact-form"><strong style="font-size:24px">了解桐灼服务</strong><p style="color:var(--muted)">查看服务详情，或提交与本文相关的业务问题。</p><a class="button ink" href="/contact.html">联系我们 <span class="arrow">→</span></a></div></div></section>`;
  const canonical = absoluteUrl(origin, pathname);
  const schema = pageSchema(site, origin, pathname, schemaExtra, { pageEnabled: true, name: article.title, description: article.excerpt || site.description || DEFAULT_DESCRIPTION });
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(article.title)}｜桐灼科技</title><meta name="description" content="${escapeHtml(article.excerpt || site.description || DEFAULT_DESCRIPTION)}"><meta name="robots" content="${escapeHtml(preview ? "noindex,nofollow,noarchive" : "index,follow,max-image-preview:large,max-snippet:-1")}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta name="theme-color" content="#fbfbfa"><link rel="stylesheet" href="/assets/styles.css?v=20260827-bespoke-article-v1"><link rel="stylesheet" href="/assets/wukong-overrides.css?v=20260827-4"><script type="application/ld+json">${safeJsonLd(schema)}</script></head><body><a class="skip-link" href="#article">跳到正文</a>${nav}<main>${body}</main>${footer}<script src="/assets/site.js?v=20260827-article-v1"></script></body></html>`;
}

export function renderArticlePage({ site, article, origin, relatedArticles = [], compatibility = false, preview = false, assetBase = "/site-assets-r6", bespoke = false }) {
  const sanitized = sanitizeArticleHtml(applyPublicCitationVisibility(article.contentHtml || "", article.metadata));
  const rawBody = sanitized || plainText(article.contentText || "").split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const { html: contentHtml, headings } = ensureArticleHeadings(rawBody);
  const pathname = articleLink(article);
  const canonical = absoluteUrl(origin, pathname);
  const published = isoDate(article.publishedAt);
  const modified = isoDate(article.updatedAt || article.publishedAt);
  const organizationId = entityId(origin, "organization");
  const citations = articleCitations(article);
  const articleImage = absoluteResourceUrl(origin, article.image || article.coverImage || article.metadata?.image);
  const topics = [...new Set([article.categoryName, ...(Array.isArray(article.tags) ? article.tags : [])].map((item) => String(item || "").trim()).filter(Boolean))];
  const schemaExtra = [{
    "@type": "Article", "@id": `${canonical}#article`, headline: article.title, description: article.excerpt,
    url: canonical,
    datePublished: published || undefined, dateModified: modified || undefined, inLanguage: "zh-CN", isAccessibleForFree: true,
    image: articleImage || undefined,
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
  if (bespoke) return { html: renderBespokeArticlePage({ site, article, origin, relatedArticles, contentHtml, headings, schemaExtra, pathname, preview }), canonicalPath: pathname, compatibility };
  const activeTemplate = siteTemplateByKey(isSiteTemplateKey(site?.templateKey) ? site.templateKey : DEFAULT_SITE_TEMPLATE_KEY);
  if (SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) {
    const sourceBody = renderSourceArticleBody({ site, article, template: activeTemplate, contentHtml, provenanceNote });
    const sourceOutput = documentShell({ site, origin, pathname, title: article.title, description: article.excerpt, active: "/insights/", schemaExtra, body: sourceBody, openGraphType: "article", preview, assetBase });
    return { html: sourceOutput, canonicalPath: pathname, compatibility };
  }
  if (LEGACY_SOURCE_TEMPLATE_KEYS.has(activeTemplate.key)) {
    const sourceBody = renderLegacySourceArticleBody({ site, article, template: activeTemplate, contentHtml, provenanceNote, assetBase });
    const sourceOutput = sourceDocumentShell({ site, origin, pathname, title: article.title, description: article.excerpt, active: "/insights/", schemaExtra, body: sourceBody, openGraphType: "article", preview, assetBase, activeTemplate });
    return { html: sourceOutput, canonicalPath: pathname, compatibility };
  }
  const standardBody = `<header class="article-hero"><div class="shell">${article.isDemo ? '<span class="demo-badge">演示内容</span>' : ""}<span class="kicker">${escapeHtml(article.categoryName || "行业观点")}</span><h1>${escapeHtml(article.title)}</h1>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ""}<div class="article-meta"><span>作者：${escapeHtml(article.author || site.siteName)}</span>${publishedMeta}${modifiedMeta}<span>预计阅读：${Math.max(1, Math.ceil(plainText(article.contentText || article.contentHtml).length / 500))}分钟</span></div></div></header><article class="shell article-layout" id="article" data-content-article-id="${escapeHtml(article.id)}">${tableOfContents}<div class="prose">${article.excerpt ? `<div class="answer-box"><strong>内容摘要</strong><p>${escapeHtml(article.excerpt)}</p></div>` : ""}${contentHtml}${article.tags?.length ? `<div class="source-note">主题：${escapeHtml(article.tags.join("、"))}</div>` : ""}<div class="source-note">${provenanceNote}</div></div></article>${related}<section class="contact-band contact-band-v2 article-contact-band"><div class="shell contact-grid"><div class="contact-copy"><span class="eyebrow">Build Your Source</span><h2>让企业知识成为客户和 AI 可以理解的可信信源</h2><p>${escapeHtml(site.description || DEFAULT_DESCRIPTION)}</p></div><div class="contact-form"><strong class="contact-form-title">${escapeHtml(site.cta || "了解服务")}</strong><p class="contact-form-description">查看服务详情，或提交与本文相关的业务问题。</p><a class="button ink" href="/contact/">联系我们 <span class="arrow">→</span></a></div></div></section>`;
  const body = activeTemplate.key === DEFAULT_SITE_TEMPLATE_KEY
    ? standardBody
    : renderTemplateArticleBody({ site, article, activeTemplate, tableOfContents, contentHtml, provenanceNote, related, publishedMeta, modifiedMeta });
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
  const output = documentShell({ site, origin, pathname, title: article.title, description: article.excerpt, active: "/insights/", schemaExtra, body: renderedBody, openGraphType: "article", headMeta, bodyClass: activeTemplate.key === DEFAULT_SITE_TEMPLATE_KEY ? "" : `article-layout-${activeTemplate.layout}` });
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
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitleText = String(titleMatch?.[1] || site.siteName || "桐灼科技").replace(/<[^>]+>/g, "").trim();
  const socialImage = absoluteUrl(origin, "/assets/logo-zhuojian-blue.png");
  const configuredPage = pageForPath(site, pathname);
  const schema = pageSchema(site, origin, pathname, [{ "@type": "WebPage", "@id": canonical, url: canonical, name: site.siteName, description, isPartOf: { "@id": entityId(origin, "website") } }], { pageEnabled: configuredPage?.schemaEnabled !== false, name: site.siteName, description });
  // Static pages use document-relative hash links (for example #company).
  // The injected base href keeps assets rooted when a page is served through
  // an alias such as /about/, but without normalising these anchors the
  // browser resolves them against / and sends the user to the homepage.
  const withPageAnchors = String(html || "").replace(/(href=["'])#([^"']+)(["'])/gi, `$1${pathname}#$2$3`);
  const withoutCanonical = withPageAnchors.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "");
  // Keep page-authored JSON-LD (for example FAQPage and Article nodes) intact.
  // Replacing every script with a generic WebPage graph silently discarded
  // those signals on the bespoke static site. Pages without authored JSON-LD
  // still receive the generated organization/site/page graph below.
  const hasAuthoredSchema = /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script\s*>/i.test(withoutCanonical);
  const withoutSchema = hasAuthoredSchema ? withoutCanonical : withoutCanonical.replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  const generatedSchema = hasAuthoredSchema ? "" : `<script type="application/ld+json">${safeJsonLd(schema)}</script>`;
  const injection = `<base href="/"><link rel="icon" type="image/png" href="/assets/logo-mark-blue.png"><link rel="canonical" href="${escapeHtml(canonical)}"><meta name="author" content="${escapeHtml(site.companyName || "桐灼（淄博）网络科技有限公司")}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(pageTitleText)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="${escapeHtml(site.siteName || "桐灼科技")}"><meta property="og:image" content="${escapeHtml(socialImage)}"><meta property="og:locale" content="zh_CN"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(pageTitleText)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(socialImage)}">${generatedSchema}`;
  return withoutSchema.replace(/<\/head\s*>/i, `${injection}</head>`);
}

export function renderNotFound({ site, origin, pathname }) {
  return documentShell({
    site, origin, pathname, title: "页面未找到", description: "请求的公开页面不存在或尚未发布。", active: "",
    robots: "noindex,follow", feed: false,
    body: `<section class="page-hero blog-hero"><div class="shell"><div><span class="eyebrow">404</span><h1>页面未找到</h1><p>该内容可能尚未发布、已下线，或地址已发生变化。</p><div class="actions"><a class="button primary" href="/insights/">浏览行业资讯</a><a class="button secondary" href="/">返回首页</a></div></div></div></section>`
  });
}
