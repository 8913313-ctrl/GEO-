import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MonitoringStore } from "./monitoring-store.mjs";
import { PublicLeadError, PublicLeadStore } from "./public-site/lead-store.mjs";
import { PublicSiteStore } from "./public-site/site-store.mjs";
import { KnowledgeStore } from "./knowledge-store.mjs";
import {
  injectStaticSeo,
  findFrontendArticle,
  findSiteProblem,
  renderArticlePage,
  renderFeed,
  renderFixedPage,
  renderInsightsPage,
  renderLlms,
  renderNotFound,
  renderProblemPage,
  renderRobots,
  renderSitemap
} from "./public-site/site-renderer.mjs";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_ROOT = path.resolve(moduleRoot, "..", "demo-company-homepage");
const BUILT_IN_SITE_ASSET_ROOT = path.resolve(moduleRoot, "public-site", "assets");
const DEFAULT_PORT = 18_080;
const MAX_STATIC_BYTES = 20 * 1024 * 1024;
const MAX_LEAD_BODY_BYTES = 64 * 1024;
const INSIGHTS_PAGE_SIZE = 12;
const FRONTEND_DEMO_ARTICLE_SLUGS = Object.freeze([
  "industrial-geo-first-step",
  "enterprise-ai-knowledge-base",
  "manufacturing-short-video-questions",
  "official-site-trusted-source",
  "customer-question-to-content",
  "ai-readable-content-structure"
]);

function refreshSiteAssetVersion(body) {
  return String(body || "")
    .replaceAll("site-v8.css?v=20260810-passport3", "site-v8.css?v=20260810-passport5")
    .replaceAll("site-v8.css?v=20260810-passport4", "site-v8.css?v=20260810-passport5")
    .replaceAll("site-v8.js?v=20260810-passport3", "site-v8.js?v=20260810-passport5")
    .replaceAll("site-v8.js?v=20260810-passport4", "site-v8.js?v=20260810-passport5")
    .replaceAll("site-v8.css?v=20260810-passport5", "site-v8.css?v=20260810-passport6")
    .replaceAll("site-v8.js?v=20260810-passport5", "site-v8.js?v=20260810-passport6")
    .replaceAll("site-v8.css?v=20260810-passport6", "site-v8.css?v=20260810-passport7")
    .replaceAll("site-v8.js?v=20260810-passport6", "site-v8.js?v=20260810-passport7")
    .replaceAll("site-v8.css?v=20260810-passport7", "site-v8.css?v=20260810-passport8")
    .replaceAll("site-v8.js?v=20260810-passport7", "site-v8.js?v=20260810-passport8")
    .replaceAll("site-v8.css?v=20260810-passport8", "site-v8.css?v=20260810-passport9")
    .replaceAll("site-v8.js?v=20260810-passport8", "site-v8.js?v=20260810-passport9")
    .replaceAll("site-v8.css?v=20260810-passport9", "site-v8.css?v=20260810-passport10")
    .replaceAll("site-v8.js?v=20260810-passport9", "site-v8.js?v=20260810-passport10")
    .replaceAll("site-v8.css?v=20260810-passport10", "site-v8.css?v=20260810-passport11")
    .replaceAll("site-v8.js?v=20260810-passport10", "site-v8.js?v=20260810-passport11")
    .replaceAll("site-v8.css?v=20260810-passport11", "site-v8.css?v=20260810-passport12")
    .replaceAll("site-v8.js?v=20260810-passport11", "site-v8.js?v=20260810-passport12")
    .replaceAll("site-v8.css?v=20260810-passport12", "site-v8.css?v=20260810-passport13")
    .replaceAll("site-v8.js?v=20260810-passport12", "site-v8.js?v=20260810-passport13")
    .replaceAll("site-v8.css?v=20260810-passport13", "site-v8.css?v=20260810-passport14")
    .replaceAll("site-v8.js?v=20260810-passport13", "site-v8.js?v=20260810-passport14")
    .replaceAll("site-v8.css?v=20260810-passport14", "site-v8.css?v=20260810-passport15")
    .replaceAll("site-v8.js?v=20260810-passport14", "site-v8.js?v=20260810-passport15")
    .replaceAll("site-v8.css?v=20260810-passport15", "site-v8.css?v=20260810-passport16")
    .replaceAll("site-v8.js?v=20260810-passport15", "site-v8.js?v=20260810-passport16")
    .replaceAll("site-v8.css?v=20260810-passport16", "site-v8.css?v=20260810-passport17")
    .replaceAll("site-v8.js?v=20260810-passport16", "site-v8.js?v=20260810-passport17")
    .replaceAll("site-v8.css?v=20260810-passport17", "site-v8.css?v=20260810-passport18")
    .replaceAll("site-v8.js?v=20260810-passport17", "site-v8.js?v=20260810-passport18")
    .replaceAll("site-v8.css?v=20260810-passport18", "site-v8.css?v=20260810-passport19")
    .replaceAll("site-v8.js?v=20260810-passport18", "site-v8.js?v=20260810-passport19")
    .replaceAll("site-v8.css?v=20260810-passport19", "site-v8.css?v=20260810-passport20")
    .replaceAll("site-v8.js?v=20260810-passport19", "site-v8.js?v=20260810-passport20")
    .replaceAll("site-v8.css?v=20260810-passport20", "site-v8.css?v=20260810-passport21")
    .replaceAll("site-v8.js?v=20260810-passport20", "site-v8.js?v=20260810-passport21")
    .replaceAll("site-v8.css?v=20260810-passport21", "site-v8.css?v=20260810-passport22")
    .replaceAll("site-v8.js?v=20260810-passport21", "site-v8.js?v=20260810-passport22")
    .replaceAll("site-v8.css?v=20260810-passport22", "site-v8.css?v=20260810-passport23")
    .replaceAll("site-v8.js?v=20260810-passport22", "site-v8.js?v=20260810-passport23")
    .replaceAll("site-v8.css?v=20260810-passport23", "site-v8.css?v=20260810-passport24")
    .replaceAll("site-v8.js?v=20260810-passport23", "site-v8.js?v=20260810-passport24")
    .replaceAll("site-v8.css?v=20260810-passport24", "site-v8.css?v=20260810-passport25")
    .replaceAll("site-v8.js?v=20260810-passport24", "site-v8.js?v=20260810-passport25")
    .replaceAll("site-v8.css?v=20260810-passport25", "site-v8.css?v=20260810-passport26")
    .replaceAll("site-v8.js?v=20260810-passport25", "site-v8.js?v=20260810-passport26")
    .replaceAll("site-v8.css?v=20260810-passport26", "site-v8.css?v=20260810-passport27")
    .replaceAll("site-v8.js?v=20260810-passport26", "site-v8.js?v=20260810-passport27")
    .replaceAll("site-v8.css?v=20260810-passport27", "site-v8.css?v=20260811-passport28")
    .replaceAll("site-v8.js?v=20260810-passport27", "site-v8.js?v=20260811-passport28")
    .replaceAll("site-v8.css?v=20260811-passport28", "site-v8.css?v=20260811-passport29")
    .replaceAll("site-v8.js?v=20260811-passport28", "site-v8.js?v=20260811-passport29")
    .replaceAll("site-v8.css?v=20260811-passport29", "site-v8.css?v=20260811-passport30")
    .replaceAll("site-v8.js?v=20260811-passport29", "site-v8.js?v=20260811-passport30");
}

const BUILT_IN_SITE_ASSETS = Object.freeze({
  "/site-assets/site.css": "site.css",
  "/site-assets/site.js": "site.js",
  "/site-assets/favicon.svg": "favicon.svg",
  "/site-assets/geo-signal-hero.svg": "geo-signal-hero.svg",
  "/site-assets/geo-answer-hero.svg": "geo-answer-hero.svg",
  "/site-assets/geo-network-hero.svg": "geo-network-hero.svg",
  "/site-assets-r5/site.css": "site.css",
  "/site-assets-r5/site.js": "site.js",
  "/site-assets-r5/favicon.svg": "favicon.svg",
  "/site-assets-r5/geo-signal-hero.svg": "geo-signal-hero.svg",
  "/site-assets-r5/geo-answer-hero.svg": "geo-answer-hero.svg",
  "/site-assets-r5/geo-network-hero.svg": "geo-network-hero.svg",
  "/site-assets-r6/site.css": "site.css",
  "/site-assets-r6/site.js": "site.js",
  "/site-assets-r6/favicon.svg": "favicon.svg",
  "/site-assets-r6/geo-signal-hero.svg": "geo-signal-hero.svg",
  "/site-assets-r6/geo-answer-hero.svg": "geo-answer-hero.svg",
  "/site-assets-r6/geo-network-hero.svg": "geo-network-hero.svg",
  "/site-assets-r7/site-v7.css": "site-v7.css",
  "/site-assets-r7/site-v7.js": "site-v7.js",
  "/site-assets-r8/site-v8.css": "site-v8.css",
  "/site-assets-r8/site-v8.js": "site-v8.js",
  "/site-assets-r9/site-v8.css": "site-v8.css",
  "/site-assets-r9/site-v8.js": "site-v8.js",
  "/site-assets-r9/site.js": "site.js",
  "/site-assets-r9/gsap.min.js": "gsap.min.js",
  "/site-assets-r9/tz-display.woff2": "fonts/tz-display.woff2",
  "/site-assets-r9/OFL-Smiley-Sans.txt": "fonts/OFL-Smiley-Sans.txt",
  "/assets/tongzhuo-geo-mark.svg": "tongzhuo-geo-mark.svg",
  "/assets/tongzhuo-official-mark.png": "tongzhuo-official-mark.png",
  "/assets/tongzhuo-mark-gold.png": "tongzhuo-mark-gold.png",
  "/assets/tongzhuo-mark-wine.png": "tongzhuo-mark-wine.png",
  "/assets/zhuojian-ai-official-logo.png": "zhuojian-ai-official-logo.png",
  "/assets/zhuojian-ai-lockup-gold.png": "zhuojian-ai-lockup-gold.png",
  "/assets/zhuojian-ai-brand.png": "zhuojian-ai-brand.png"
});

const LEGACY_REDIRECTS = Object.freeze({
  "/index.html": "/",
  "/about": "/about/",
  "/about.html": "/about/",
  "/contact": "/contact/",
  "/contact.html": "/contact/",
  "/products": "/services/",
  "/products/": "/services/",
  "/products.html": "/services/",
  "/services": "/services/",
  "/insights.html": "/insights/"
});

const MANAGED_STATIC_PAGE_IDS = Object.freeze({
  "/": "home",
  "/about": "about", "/about/": "about", "/about.html": "about",
  "/contact": "contact", "/contact/": "contact", "/contact.html": "contact",
  "/products": "services", "/products/": "services", "/products.html": "services",
  "/services": "services", "/services/": "services",
  "/cases": "cases", "/cases/": "cases", "/cases.html": "cases",
  "/faq": "faq", "/faq/": "faq", "/issues": "faq", "/issues/": "faq", "/issues.html": "faq",
  "/team": "team", "/team/": "team", "/team.html": "team",
  "/honors": "honors", "/honors/": "honors", "/honors.html": "honors",
  "/careers": "jobs", "/careers/": "jobs", "/careers.html": "jobs"
});

const RESERVED_REDIRECT_PATHS = new Set([
  "/health/live", "/health/ready", "/sitemap.xml", "/feed.xml", "/robots.txt", "/llms.txt", "/llms-full.txt"
]);

const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".xsl": "text/xsl; charset=utf-8"
});

const STATIC_ALIASES = Object.freeze({
  "/about": "about.html", "/about/": "about.html",
  "/contact": "contact.html", "/contact/": "contact.html",
  "/cases": "cases.html", "/cases/": "cases.html",
  "/team": "team.html", "/team/": "team.html",
  "/honors": "honors.html", "/honors/": "honors.html",
  "/issues": "issues.html", "/issues/": "issues.html",
  "/faq": "issues.html", "/faq/": "issues.html",
  "/careers": "careers.html", "/careers/": "careers.html",
  "/products": "products.html", "/products/": "products.html",
  "/services": "products.html", "/services/": "products.html",
  "/product-website": "product-website.html", "/product-website/": "product-website.html",
  "/product-content-platform": "product-content-platform.html", "/product-content-platform/": "product-content-platform.html",
  "/product-distribution": "product-distribution.html", "/product-distribution/": "product-distribution.html"
});

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function booleanValue(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("en-US");
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function configuredOrigin(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function publishedSiteOrigin(site) {
  const configured = String(site?.officialDomain || "").trim();
  if (!configured) return "";
  return configuredOrigin(configured) || configuredOrigin(`https://${configured}`);
}

function safeHost(value) {
  const candidate = String(value || "").split(",")[0].trim().toLocaleLowerCase("en-US");
  if (!candidate || candidate.length > 255 || /[\s/\\@]/.test(candidate)) return "";
  try {
    const parsed = new URL(`http://${candidate}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
    return parsed.host;
  } catch {
    return "";
  }
}

function requestId(request) {
  const supplied = String(request.headers["x-request-id"] || "").trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function clientIp(request, trustProxy) {
  if (trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 120);
  }
  return String(request.socket?.remoteAddress || "").slice(0, 120);
}

function requestOrigin(request, options, site = null) {
  if (options.baseUrl) return options.baseUrl;
  const officialOrigin = publishedSiteOrigin(site);
  if (officialOrigin) return officialOrigin;
  const forwardedProto = options.trustProxy ? String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() : "";
  const protocol = ["http", "https"].includes(forwardedProto) ? forwardedProto : (request.socket?.encrypted ? "https" : "http");
  const forwardedHost = options.trustProxy ? safeHost(request.headers["x-forwarded-host"]) : "";
  const host = forwardedHost || safeHost(request.headers.host) || "localhost";
  return `${protocol}://${host}`;
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLocaleLowerCase("en-US")] || "application/octet-stream";
}

function securityHeaders(response, id, request = null, trustProxy = false) {
  response.setHeader("X-Request-Id", id);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  const forwardedProto = trustProxy ? String(request?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() : "";
  if (request?.socket?.encrypted || forwardedProto === "https") response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function errorBody(status, message) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${status}</title></head><body><h1>${status}</h1><p>${message}</p></body></html>`;
}

async function requestJson(request, maximumBytes = MAX_LEAD_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw new PublicLeadError("提交内容过大。", 413, "SITE_LEAD_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) throw new PublicLeadError("提交内容不能为空。", 422, "SITE_LEAD_BODY_REQUIRED");
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid object");
    return value;
  } catch {
    throw new PublicLeadError("提交格式无效。", 422, "SITE_LEAD_INVALID_JSON");
  }
}

class SiteLeadRateLimiter {
  constructor(options = {}) {
    this.windowMs = positiveInteger(options.windowMs ?? process.env.TZ_SITE_LEAD_RATE_WINDOW_MS, 15 * 60_000, 60_000, 24 * 60 * 60_000);
    this.maximum = positiveInteger(options.maximum ?? process.env.TZ_SITE_LEAD_RATE_MAXIMUM, 10, 1, 500);
    this.entries = new Map();
  }

  assert(key) {
    const now = Date.now();
    const safeKey = String(key || "unknown").slice(0, 160);
    const current = this.entries.get(safeKey);
    if (!current || current.resetAt <= now) {
      this.entries.set(safeKey, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    current.count += 1;
    if (current.count > this.maximum) throw new PublicLeadError("提交过于频繁，请稍后再试。", 429, "SITE_LEAD_RATE_LIMITED");
    if (this.entries.size > 10_000) {
      for (const [entryKey, value] of this.entries) if (value.resetAt <= now) this.entries.delete(entryKey);
    }
  }
}

function safePathname(value) {
  try {
    const url = new URL(value || "/", "http://site.local");
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

function decodedSegment(value) {
  try { return decodeURIComponent(value); } catch { return ""; }
}

function normalizeArticleSlug(value) { return decodedSegment(value).normalize("NFKC").toLocaleLowerCase("en-US"); }

function routeKey(value) {
  let pathname = String(value || "/");
  try { pathname = decodeURI(pathname); } catch { return ""; }
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\") || /[\r\n]/.test(pathname)) return "";
  pathname = pathname.normalize("NFKC").replace(/\/{2,}/g, "/");
  if (pathname !== "/" && !pathname.endsWith("/") && !/\.[A-Za-z0-9]{1,8}$/.test(pathname)) pathname += "/";
  return pathname;
}

function safeInternalPath(value) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\r\n]/.test(candidate)) return "";
  try {
    const parsed = new URL(candidate, "http://site.local");
    if (parsed.origin !== "http://site.local") return "";
    return parsed.pathname || "/";
  } catch {
    return "";
  }
}

function cmsPageForPath(site, pathname) {
  const key = routeKey(pathname);
  if (!key) return null;
  return (site.pages || []).find((page) => routeKey(page?.path) === key) || null;
}

function cmsPageById(site, id) {
  return (site.pages || []).find((page) => page?.id === id) || null;
}

function publishedRuntimeSnapshot(snapshot, production) {
  if (!production || snapshot.site?.frontendDemo !== true) return snapshot;
  return { ...snapshot, site: { ...snapshot.site, frontendDemo: false } };
}

function displayedArticles(site, articles) {
  if (articles.length || site.frontendDemo !== true) return articles;
  return FRONTEND_DEMO_ARTICLE_SLUGS.map((slug) => findFrontendArticle(slug)).filter(Boolean).map((article) => ({ ...article, isDemo: true }));
}

function paginationState(url, itemCount, pageSize = INSIGHTS_PAGE_SIZE) {
  const values = url.searchParams.getAll("page");
  const raw = values[0];
  const valid = values.length <= 1 && (raw === undefined || /^[1-9]\d{0,5}$/.test(raw));
  const page = raw === undefined ? 1 : Number(raw);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, Number(itemCount) || 0) / pageSize));
  return { page, totalPages, valid: valid && page <= totalPages };
}

function pagedPath(pathname, page) {
  return `${pathname}${page > 1 ? `?page=${page}` : ""}`;
}

function frontendDemoPageForPath(site, pathname) {
  if (site?.frontendDemo !== true) return null;
  const key = routeKey(pathname);
  if (key === "/cases/") return { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", seoDescription: "查看企业服务案例与典型实施路径。" };
  if (key === "/problem-map/") return { id: "problem-map", type: "问题地图", title: "问题地图", path: "/problem-map/", status: "published", seoDescription: "按服务方向与行业查看企业客户常见问题及直接回答。" };
  return null;
}

function redirectLocation(site, pathname, search = "") {
  if (RESERVED_REDIRECT_PATHS.has(pathname) || pathname.startsWith("/api/") || pathname.startsWith("/assets/") || pathname.startsWith("/site-assets/") || pathname.startsWith("/site-assets-r5/") || pathname.startsWith("/site-assets-r6/") || pathname.startsWith("/site-assets-r7/") || pathname.startsWith("/site-assets-r8/") || pathname.startsWith("/site-assets-r9/")) return "";
  const key = routeKey(pathname);
  if (!key) return "";
  const configured = (site.redirects || []).find((item) => item?.status === "active" && routeKey(item.from) === key);
  const page = cmsPageForPath(site, pathname);
  const target = safeInternalPath(configured?.to || LEGACY_REDIRECTS[pathname] || page?.path);
  const current = safeInternalPath(pathname);
  if (!target || target === current) return "";
  return `${target}${String(search || "")}`;
}

function staticPathOwnedByCms(site, pathname) {
  const pageId = MANAGED_STATIC_PAGE_IDS[pathname];
  return Boolean(pageId && (site.pages || []).some((page) => page?.id === pageId));
}

function staticRelativePath(pathname) {
  if (pathname.startsWith("/assets/")) return pathname.slice(1);
  if (["/rss.xsl", "/favicon.ico"].includes(pathname)) return pathname.slice(1);
  return "";
}

async function readStaticFile(staticRoot, relativePath) {
  let decoded;
  try { decoded = decodeURIComponent(relativePath); } catch { return null; }
  if (!decoded || decoded.includes("\0")) return null;
  const root = path.resolve(staticRoot);
  const target = path.resolve(root, decoded);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  try {
    const info = await stat(target);
    if (!info.isFile() || info.size > MAX_STATIC_BYTES) return null;
    return { body: await readFile(target), filePath: target, size: info.size };
  } catch {
    return null;
  }
}

class SiteAccessRecorder {
  constructor(monitoringStore, options = {}) {
    this.monitoringStore = monitoringStore;
    this.workspaceId = options.workspaceId || process.env.TZ_TENANT_ID || "default";
    this.logger = options.logger || console;
    this.pending = [];
    this.flushing = null;
    const interval = positiveInteger(options.flushIntervalMs ?? process.env.TZ_SITE_LOG_FLUSH_MS, 2_000, 250, 60_000);
    this.timer = setInterval(() => { void this.flush(); }, interval);
    this.timer.unref?.();
  }

  record(entry) {
    if (!entry || this.pending.length >= 5_000) return;
    this.pending.push({
      eventId: `SITE-${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
      method: entry.method || "GET", path: entry.path || "/", statusCode: entry.statusCode || 200,
      ipAddress: entry.ipAddress || "", userAgent: entry.userAgent || "", referer: entry.referer || "",
      articleId: entry.articleId || null,
      metadata: { service: "official-site", requestId: entry.requestId || "" }
    });
  }

  async flush() {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (this.pending.length) {
        const items = this.pending.splice(0, 1_000);
        try {
          this.monitoringStore.ingestAccessLogs({ workspaceId: this.workspaceId, source: "server", items });
        } catch (error) {
          // Monitoring cannot turn a public page request into an outage. Put
          // one bounded batch back for a later retry and report a redacted error.
          this.pending.unshift(...items.slice(0, 1_000 - this.pending.length));
          this.logger.warn?.("official_site.access_log_failed", { error: error.message, itemCount: items.length });
          break;
        }
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  async close() { clearInterval(this.timer); await this.flush(); }
}

/**
 * Creates the public website service. It deliberately has no management API:
 * all content mutation happens in the authenticated admin server. This service
 * writes only privacy-preserving access logs and validated public contact leads.
 */
export function createSiteRuntime(options = {}) {
  const store = options.store || new PublicSiteStore({
    database: options.database,
    databasePath: options.databasePath,
    workspaceId: options.workspaceId || process.env.TZ_TENANT_ID || "default",
    projectSeedKey: options.projectSeedKey || process.env.TZ_PROJECT_SEED || "",
    publicKnowledgeAssetBase: "/site-assets/knowledge"
  });
  const ownStore = !options.store;
  if (!store.publicKnowledgeAssetBase) store.publicKnowledgeAssetBase = "/site-assets/knowledge";
  const config = {
    host: String(options.host || process.env.TZ_SITE_BIND_HOST || "127.0.0.1").trim(),
    port: positiveInteger(options.port ?? process.env.TZ_SITE_PORT, DEFAULT_PORT, 1, 65_535),
    staticRoot: path.resolve(options.staticRoot || process.env.TZ_SITE_STATIC_ROOT || DEFAULT_STATIC_ROOT),
    baseUrl: configuredOrigin(options.baseUrl || process.env.TZ_SITE_BASE_URL),
    workspaceId: options.workspaceId || process.env.TZ_TENANT_ID || "default",
    trustProxy: options.trustProxy ?? booleanValue(process.env.TZ_TRUST_PROXY),
    production: options.production ?? process.env.NODE_ENV === "production",
    logger: options.logger || console
  };
  const monitoringStore = options.monitoringStore || new MonitoringStore(store.database, { workspaceId: config.workspaceId });
  const knowledgeStore = options.knowledgeStore || new KnowledgeStore(store.database, { workspaceId: config.workspaceId });
  const recorder = options.recorder || new SiteAccessRecorder(monitoringStore, { workspaceId: config.workspaceId, logger: config.logger, flushIntervalMs: options.flushIntervalMs });
  const leadStore = options.leadStore || new PublicLeadStore(store.database, { workspaceId: config.workspaceId, projectId: options.projectId || process.env.TZ_PROJECT_ID || config.workspaceId });
  const leadRateLimiter = options.leadRateLimiter || new SiteLeadRateLimiter(options.leadRateLimit);

  async function response(request, responseObject, result, context = {}) {
    const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(String(result.body || ""), "utf8");
    const id = context.requestId || requestId(request);
    securityHeaders(responseObject, id, request, config.trustProxy);
    responseObject.statusCode = result.status || 200;
    responseObject.setHeader("Content-Type", result.contentType || "text/html; charset=utf-8");
    responseObject.setHeader("Content-Length", body.byteLength);
    responseObject.setHeader("Cache-Control", result.cacheControl || "no-cache");
    if (result.canonical) responseObject.setHeader("Link", `<${result.canonical}>; rel=\"canonical\"`);
    for (const [name, value] of Object.entries(result.headers || {})) responseObject.setHeader(name, value);
    responseObject.end(request.method === "HEAD" ? undefined : body);
    if (context.track !== false && request.method === "GET") {
      recorder.record({
        method: "GET", path: context.pathname || safePathname(request.url), statusCode: result.status || 200,
        articleId: context.articleId || null, ipAddress: clientIp(request, config.trustProxy),
        userAgent: String(request.headers["user-agent"] || "").slice(0, 1_000),
        referer: String(request.headers.referer || "").slice(0, 2_000), requestId: id
      });
    }
  }

  async function dynamicResponse(request, responseObject, url, pathname, snapshot, origin) {
    const site = snapshot.site;
    const categories = snapshot.categories;
    const articles = snapshot.articles;
    const visibleArticles = displayedArticles(site, articles);
    const insightsPage = cmsPageById(site, "insights");
    const insightsPublished = insightsPage?.status === "published";
    const machineArticles = insightsPublished ? visibleArticles : [];
    const machineCategories = insightsPublished ? categories : [];
    if (pathname === "/health/live" || pathname === "/health/ready") {
      return response(request, responseObject, { status: 200, contentType: "application/json; charset=utf-8", cacheControl: "no-store", body: JSON.stringify({ ok: true, service: "official-site", workspaceId: snapshot.workspaceId, workspaceRevision: snapshot.workspaceRevision, articleCount: machineArticles.length }) }, { pathname, track: false });
    }
    // Machine-readable public endpoints are reserved and cannot be shadowed
    // by a CMS page using the same path. They use the same publication gate as
    // the human-facing industry section, so taking the section offline cannot
    // leak article metadata or full text through a crawler endpoint.
    if (pathname === "/sitemap.xml") return response(request, responseObject, { status: 200, contentType: "application/xml; charset=utf-8", body: renderSitemap({ site, articles: machineArticles, categories: machineCategories, origin }) }, { pathname });
    if (pathname === "/feed.xml") return response(request, responseObject, { status: 200, contentType: "application/rss+xml; charset=utf-8", body: renderFeed({ site, articles: machineArticles, origin }) }, { pathname });
    if (pathname === "/robots.txt") return response(request, responseObject, { status: 200, contentType: "text/plain; charset=utf-8", body: renderRobots({ site, origin }) }, { pathname });
    if (pathname === "/llms.txt") return response(request, responseObject, { status: 200, contentType: "text/plain; charset=utf-8", body: renderLlms({ site, articles: machineArticles, origin }) }, { pathname });
    if (pathname === "/llms-full.txt") return response(request, responseObject, { status: 200, contentType: "text/plain; charset=utf-8", body: renderLlms({ site, articles: machineArticles, origin, full: true }) }, { pathname });
    const cmsPage = /^\/(insights|article)(\/|$)/.test(pathname) ? null : cmsPageForPath(site, pathname);
    const demoPage = cmsPage ? null : frontendDemoPageForPath(site, pathname);
    if ((cmsPage || demoPage) && (cmsPage?.id !== "insights")) {
      const page = demoPage || cmsPage;
      if (!demoPage && cmsPage.status !== "published") return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const body = refreshSiteAssetVersion(renderFixedPage({ site, page, articles: visibleArticles, categories, origin }));
      return response(request, responseObject, { status: 200, body, canonical: new URL(page.path, origin).href }, { pathname: page.path });
    }
    const problemMatch = pathname.match(/^\/problem-map\/([^/]+)\/?$/);
    if (problemMatch) {
      const problemMapPage = cmsPageById(site, "problem-map");
      const demoProblemMap = site.frontendDemo === true && !problemMapPage;
      if (problemMapPage?.status !== "published" && !demoProblemMap) {
        return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      }
      const found = findSiteProblem(site, problemMatch[1]);
      if (!found) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const canonicalPath = `/problem-map/${encodeURIComponent(found.problem.slug)}/`;
      if (pathname !== canonicalPath) {
        return response(request, responseObject, { status: 301, body: "", headers: { Location: `${canonicalPath}${url.search}` }, cacheControl: "public, max-age=300" }, { pathname });
      }
      const body = refreshSiteAssetVersion(renderProblemPage({ site, problem: found.problem, group: found.group, articles: visibleArticles, origin }));
      return response(request, responseObject, { status: 200, body, canonical: new URL(canonicalPath, origin).href }, { pathname });
    }
    if (pathname === "/insights" || pathname === "/insights/") {
      if (!insightsPublished) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const pagination = paginationState(url, visibleArticles.length);
      if (!pagination.valid) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const canonicalBase = safeInternalPath(insightsPage.path) || "/insights/";
      const canonicalPath = pagedPath(canonicalBase, pagination.page);
       return response(request, responseObject, { status: 200, body: refreshSiteAssetVersion(renderInsightsPage({ site, articles: visibleArticles, categories, origin, page: pagination.page })), canonical: new URL(canonicalPath, origin).href }, { pathname: canonicalBase });
    }
    const categoryMatch = pathname.match(/^\/insights\/category\/([^/]+)\/?$/);
    if (categoryMatch) {
      if (!insightsPublished) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const slug = normalizeArticleSlug(categoryMatch[1]);
      const category = categories.find((item) => normalizeArticleSlug(item.slug) === slug);
      if (!category) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const categoryArticles = visibleArticles.filter((article) => article.categoryId === category.id || normalizeArticleSlug(article.categorySlug || "") === normalizeArticleSlug(category.slug) || article.categoryName === category.name);
      const canonicalBase = `/insights/category/${encodeURIComponent(category.slug)}/`;
      if (pathname !== canonicalBase) {
        return response(request, responseObject, { status: 301, body: "", headers: { Location: `${canonicalBase}${url.search}` }, cacheControl: "public, max-age=300" }, { pathname });
      }
      const pagination = paginationState(url, categoryArticles.length);
      if (!pagination.valid) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
       const body = refreshSiteAssetVersion(renderInsightsPage({
         site,
         articles: categoryArticles,
         categories,
         selectedCategory: category,
         origin,
         page: pagination.page
       }));
      const canonical = new URL(pagedPath(canonicalBase, pagination.page), origin).href;
      return response(request, responseObject, { status: 200, body, canonical }, { pathname });
    }
    const articleMatch = pathname.match(/^\/(insights|article)\/([^/]+)\/?$/);
    if (articleMatch) {
      if (!insightsPublished) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const slug = normalizeArticleSlug(articleMatch[2]);
      const article = visibleArticles.find((item) => normalizeArticleSlug(item.slug) === slug) || null;
      if (!article) return response(request, responseObject, { status: 404, body: renderNotFound({ site, origin, pathname }) }, { pathname });
      const canonicalPath = `/insights/${encodeURIComponent(article.slug)}/`;
      if (pathname !== canonicalPath) {
        return response(request, responseObject, { status: 301, body: "", headers: { Location: `${canonicalPath}${url.search}` }, cacheControl: "public, max-age=300" }, { pathname, articleId: article.id });
      }
      const related = visibleArticles.filter((item) => item.id !== article.id && (item.categoryId === article.categoryId || item.categorySlug === article.categorySlug)).slice(0, 3);
       const rendered = renderArticlePage({ site, article, origin, relatedArticles: related, compatibility: articleMatch[1] === "article" });
       return response(request, responseObject, { status: 200, body: refreshSiteAssetVersion(rendered.html), canonical: new URL(canonicalPath, origin).href }, { pathname, articleId: article.id });
    }
    return false;
  }

  async function serveBuiltInAsset(request, responseObject, pathname) {
    const relativePath = BUILT_IN_SITE_ASSETS[pathname];
    if (!relativePath) return false;
    const file = await readStaticFile(BUILT_IN_SITE_ASSET_ROOT, relativePath);
    if (!file) return false;
    return response(request, responseObject, {
      status: 200,
      body: file.body,
      contentType: contentType(relativePath),
      cacheControl: "no-cache"
    }, { pathname, track: false });
  }

  async function serveStatic(request, responseObject, pathname, snapshot, origin) {
    if (staticPathOwnedByCms(snapshot.site, pathname)) return false;
    const relativePath = staticRelativePath(pathname);
    if (!relativePath) return false;
    const file = await readStaticFile(config.staticRoot, relativePath);
    if (!file) return false;
    const isHtml = path.extname(relativePath).toLocaleLowerCase("en-US") === ".html";
    const body = isHtml ? injectStaticSeo(file.body.toString("utf8"), { site: snapshot.site, origin, pathname }) : file.body;
    return response(request, responseObject, {
      status: 200, body, contentType: contentType(relativePath),
      cacheControl: isHtml ? "no-cache" : "public, max-age=604800, immutable",
      canonical: isHtml ? new URL(pathname, origin).href : ""
    }, { pathname, track: isHtml });
  }

  async function handler(request, responseObject) {
    const method = String(request.method || "GET").toUpperCase();
    const id = requestId(request);
    let url;
    try { url = new URL(request.url || "/", "http://site.local"); } catch { url = new URL("/", "http://site.local"); }
    const pathname = safePathname(url.pathname);
    let origin = requestOrigin(request, config);
    if (pathname === "/api/v1/leads") {
      if (method !== "POST") {
        return response(request, responseObject, { status: 405, contentType: "application/json; charset=utf-8", body: JSON.stringify({ ok: false, code: "METHOD_NOT_ALLOWED", message: "只支持 POST 提交。" }), headers: { Allow: "POST" }, cacheControl: "no-store" }, { requestId: id, track: false });
      }
      try {
        const payload = await requestJson(request);
        leadRateLimiter.assert(clientIp(request, config.trustProxy));
        const publishedSite = publishedRuntimeSnapshot(store.snapshot({ draft: false }), config.production).site;
        const lead = leadStore.create(payload, { userAgent: request.headers["user-agent"] || "", idempotencyKey: request.headers["idempotency-key"] || payload.idempotency_key, site: publishedSite });
        const { replayed, ...publicLead } = lead;
        const responsePromise = String(publishedSite.leadForm?.responsePromise || "我们会尽快与您联系").replace(/[。；;]+$/, "");
        return response(request, responseObject, { status: replayed ? 200 : 201, contentType: "application/json; charset=utf-8", body: JSON.stringify({ ok: true, data: { ...publicLead, duplicate: replayed, message: replayed ? `本次需求已提交，请勿重复操作。${responsePromise}。` : `提交成功，${responsePromise}。` } }), cacheControl: "no-store" }, { requestId: id, track: false });
      } catch (error) {
        if (error?.code === "SITE_CMS_NOT_PUBLISHED") {
          return response(request, responseObject, { status: 404, contentType: "application/json; charset=utf-8", body: JSON.stringify({ ok: false, code: error.code, message: "官网尚未开放咨询。" }), cacheControl: "no-store", headers: { "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex" } }, { requestId: id, track: false });
        }
        const known = error instanceof PublicLeadError;
        if (!known) config.logger.error?.("official_site.lead_failed", { requestId: id, error: error.message });
        return response(request, responseObject, { status: known ? error.status : 500, contentType: "application/json; charset=utf-8", body: JSON.stringify({ ok: false, code: known ? error.code : "SITE_LEAD_FAILED", message: known ? error.message : "提交暂时失败，请稍后再试。" }), cacheControl: "no-store" }, { requestId: id, track: false });
      }
    }
    if (!["GET", "HEAD"].includes(method)) {
      return response(request, responseObject, { status: 405, body: errorBody(405, "Only GET and HEAD are supported."), headers: { Allow: "GET, HEAD" }, cacheControl: "no-store" }, { requestId: id, track: false });
    }
    try {
      const publicKnowledgeMatch = pathname.match(/^\/site-assets\/knowledge\/([^/]+)$/);
      if (publicKnowledgeMatch) {
        let assetId = "";
        try { assetId = decodeURIComponent(publicKnowledgeMatch[1]); } catch { assetId = ""; }
        if (!assetId) return response(request, responseObject, { status: 404, body: errorBody(404, "Asset not found") }, { requestId: id, pathname, track: false });
        // Do not turn the public media route into a directory for the whole
        // enterprise library. An asset is public only when it is referenced by
        // an article that has passed the normal publication gate.
        const publicSnapshot = store.snapshot({ draft: false });
        const publicReference = publicSnapshot.articles.some((article) => String(article.contentHtml || "").includes(`/site-assets/knowledge/${encodeURIComponent(assetId)}`));
        if (!publicReference) return response(request, responseObject, { status: 404, body: errorBody(404, "Asset not found") }, { requestId: id, pathname, track: false });
        let asset;
        try { asset = knowledgeStore.assetContent({ workspaceId: config.workspaceId, assetId }); }
        catch { return response(request, responseObject, { status: 404, body: errorBody(404, "Asset not found") }, { requestId: id, pathname, track: false }); }
        if (!String(asset.mimeType || "").toLocaleLowerCase("en-US").startsWith("image/")) return response(request, responseObject, { status: 404, body: errorBody(404, "Asset not found") }, { requestId: id, pathname, track: false });
        return response(request, responseObject, {
          status: 200,
          body: asset.buffer,
          contentType: asset.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
          headers: { ETag: `\"${asset.id}\"` }
        }, { requestId: id, pathname, track: false });
      }
      const assetResponse = await serveBuiltInAsset(request, responseObject, pathname);
      if (assetResponse !== false) return assetResponse;
      // The public runtime deliberately reads only the immutable CMS
      // publication pointer. Draft preview is an authenticated admin concern.
      let snapshot;
      try {
        snapshot = publishedRuntimeSnapshot(store.snapshot({ draft: false }), config.production);
      } catch (error) {
        if (error?.code === "SITE_CMS_NOT_PUBLISHED") {
          const draftSnapshot = store.snapshot({ draft: true });
          origin = requestOrigin(request, config, draftSnapshot.site);
          const unavailableSite = { ...draftSnapshot.site, allowAiCrawl: false };
          return response(request, responseObject, {
            status: 404,
            body: renderNotFound({ site: unavailableSite, origin, pathname }),
            cacheControl: "no-store",
            headers: { "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex" }
          }, { requestId: id, pathname, track: false });
        }
        throw error;
      }
      origin = requestOrigin(request, config, snapshot.site);
      if (snapshot.cms?.status === "unpublished" && !["/health/live", "/health/ready"].includes(pathname)) {
        return response(request, responseObject, { status: 404, body: renderNotFound({ site: snapshot.site, origin, pathname }) }, { requestId: id, pathname });
      }
      const location = redirectLocation(snapshot.site, pathname, url.search);
      if (location) {
        return response(request, responseObject, {
          status: 301,
          body: "",
          headers: { Location: location },
          cacheControl: "public, max-age=300"
        }, { requestId: id, pathname });
      }
      const dynamic = await dynamicResponse(request, responseObject, url, pathname, snapshot, origin);
      if (dynamic !== false) return dynamic;
      const staticResponse = await serveStatic(request, responseObject, pathname, snapshot, origin);
      if (staticResponse !== false) return staticResponse;
      return response(request, responseObject, { status: 404, body: renderNotFound({ site: snapshot.site, origin, pathname }) }, { requestId: id, pathname });
    } catch (error) {
      config.logger.error?.("official_site.request_failed", { requestId: id, pathname, error: error.message });
      if (responseObject.headersSent) { responseObject.destroy(); return undefined; }
      const fallbackSite = { siteName: "企业官网", companyName: "企业官网", description: "", cta: "联系我们", navItems: [], pages: [], allowAiCrawl: true };
      return response(request, responseObject, { status: 500, body: renderNotFound({ site: fallbackSite, origin, pathname }), cacheControl: "no-store" }, { requestId: id, pathname, track: false });
    }
  }

  const server = http.createServer((request, responseObject) => { void handler(request, responseObject); });
  return {
    server, store, monitoringStore, recorder, leadStore, config,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        const onError = (error) => { server.off("listening", onListening); reject(error); };
        const onListening = () => { server.off("error", onError); resolve(server.address()); };
        server.once("error", onError); server.once("listening", onListening); server.listen(port, host);
      });
    },
    async close() {
      await recorder.close();
      if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (ownStore) store.close();
    },
    flushAccessLogs() { return recorder.flush(); }
  };
}

async function runFromCommandLine() {
  const runtime = createSiteRuntime();
  const address = await runtime.listen();
  const port = typeof address === "object" && address ? address.port : runtime.config.port;
  runtime.config.logger.info?.("official_site.started", { host: runtime.config.host, port, staticRoot: runtime.config.staticRoot, workspaceId: runtime.config.workspaceId });
  const shutdown = async (signal) => {
    runtime.config.logger.info?.("official_site.stopping", { signal });
    try { await runtime.close(); process.exitCode = 0; } catch (error) { runtime.config.logger.error?.("official_site.stop_failed", { error: error.message }); process.exitCode = 1; }
  };
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFromCommandLine().catch((error) => { console.error(error); process.exitCode = 1; });
}
