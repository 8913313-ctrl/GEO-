import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import { promises as fs } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { appendAuditLog } from "./production-audit.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_LOG_BATCH = 1_000;
const RULE_VERSION = "yaojingang-georank-v1";
export const DEFAULT_DIAGNOSTIC_WEIGHTS = Object.freeze({ schema: 0.3, content: 0.3, meta: 0.2, citation: 0.2 });
export const TRAFFIC_TYPES = Object.freeze(["human", "search_bot", "ai_bot", "other_bot", "unknown"]);

export const AI_BOT_PATTERNS = Object.freeze([
  "gptbot", "chatgpt-user", "chatgpt", "oai-searchbot", "openai", "claudebot", "claude-searchbot", "claude-user", "anthropic",
  "perplexitybot", "perplexity-user", "perplexity", "ccbot", "google-extended", "applebot-extended", "bytespider",
  "meta-externalagent", "cohere-ai", "youbot"
]);
export const SEARCH_BOT_PATTERNS = Object.freeze(["googlebot", "bingbot", "baiduspider", "yandexbot", "duckduckbot", "sogou", "slurp", "360spider", "semrushbot", "ahrefsbot"]);
export const OTHER_BOT_PATTERNS = Object.freeze([
  "bot", "spider", "crawler", "curl", "wget", "python-requests", "go-http-client", "okhttp", "httpclient", "headlesschrome",
  "postmanruntime", "axios", "java/", "libwww-perl", "scrapy", "facebookexternalhit", "telegrambot", "whatsapp"
]);

export class MonitoringError extends Error {
  constructor(message, status = 422, code = "MONITORING_ERROR", details = undefined) {
    super(message);
    this.name = "MonitoringError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function json(value, fallback = {}) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } }
function text(value, field, max = 500, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new MonitoringError(`${field} is required.`, 422, "MONITORING_INVALID_INPUT", { field });
  if (result.length > max) throw new MonitoringError(`${field} exceeds ${max} characters.`, 422, "MONITORING_INVALID_INPUT", { field, max });
  return result;
}

function firstPattern(value, patterns) { return patterns.find((pattern) => value.includes(pattern)) || ""; }
export function classifyTraffic(userAgent) {
  const normalized = String(userAgent || "").trim().toLocaleLowerCase("en-US");
  if (!normalized) return { type: "unknown", botName: "" };
  const ai = firstPattern(normalized, AI_BOT_PATTERNS);
  if (ai) return { type: "ai_bot", botName: ai };
  const search = firstPattern(normalized, SEARCH_BOT_PATTERNS);
  if (search) return { type: "search_bot", botName: search };
  const other = firstPattern(normalized, OTHER_BOT_PATTERNS);
  if (other) return { type: "other_bot", botName: other };
  return { type: "human", botName: "" };
}

function decodeEntities(value) {
  const names = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (names[key]) return names[key];
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16) || 0xfffd);
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10) || 0xfffd);
    return match;
  });
}

function stripTags(value) {
  return decodeEntities(String(value || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attributes(source = "") {
  const result = {};
  for (const match of String(source).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function pairedTags(html, tag) {
  const rows = [];
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`, "gi");
  for (const match of String(html).matchAll(pattern)) rows.push({ attrs: attributes(match[1]), inner: match[2], text: stripTags(match[2]) });
  return rows;
}

function openTags(html, tag) {
  const rows = [];
  const pattern = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  for (const match of String(html).matchAll(pattern)) rows.push({ attrs: attributes(match[1]), raw: match[0] });
  return rows;
}

function jsonLdNodes(value, output = []) {
  if (Array.isArray(value)) { value.forEach((item) => jsonLdNodes(item, output)); return output; }
  if (!value || typeof value !== "object") return output;
  output.push(value);
  if (value["@graph"] && (Array.isArray(value["@graph"]) || typeof value["@graph"] === "object")) jsonLdNodes(value["@graph"], output);
  return output;
}

function schemaAnalysis(html) {
  const scripts = pairedTags(html, "script").filter((item) => String(item.attrs.type || "").toLowerCase() === "application/ld+json");
  const types = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.inner.trim());
      for (const node of jsonLdNodes(parsed)) {
        const values = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        values.filter((item) => typeof item === "string" && item.trim()).forEach((item) => types.push(item.trim()));
      }
    } catch { /* Invalid JSON-LD is intentionally ignored, matching GEORank. */ }
  }
  const foundTypes = [...new Set(types)];
  const recommended = ["WebSite", "Organization", "FAQPage", "Article", "BreadcrumbList"];
  const coverageRatio = Math.round(foundTypes.filter((item) => recommended.includes(item)).length / recommended.length * 100);
  const score = Math.min(100, Math.max(foundTypes.length * 16, coverageRatio));
  return {
    foundTypes,
    missingRecommended: recommended.filter((item) => !foundTypes.includes(item)),
    schemaCount: scripts.length,
    score,
    coverageRatio,
    hasFaq: foundTypes.includes("FAQPage"),
    hasOrg: foundTypes.includes("Organization") || foundTypes.includes("WebSite"),
    hasArticle: foundTypes.includes("Article"),
    hasBreadcrumb: foundTypes.includes("BreadcrumbList"),
    hasProduct: foundTypes.includes("Product"),
    hasWebsite: foundTypes.includes("WebSite")
  };
}

function firstByAttribute(rows, key, value) { return rows.find((row) => String(row.attrs[key] || "").toLowerCase() === value); }
function relHas(attrs, token) { return String(attrs.rel || "").toLowerCase().split(/\s+/).includes(token); }
function metaAnalysis(html) {
  const titleTag = pairedTags(html, "title")[0];
  const htmlTag = openTags(html, "html")[0];
  const metas = openTags(html, "meta"); const links = openTags(html, "link");
  const named = (name) => firstByAttribute(metas, "name", name);
  const property = (name) => firstByAttribute(metas, "property", name);
  const titleValue = titleTag?.text?.trim() || "";
  const description = named("description")?.attrs.content?.trim() || "";
  const checks = {
    title: Boolean(titleValue), titleLength: titleValue.length, htmlLang: Boolean(htmlTag?.attrs.lang?.trim()),
    metaDescription: Boolean(description), metaDescriptionLength: description.length,
    canonical: links.some((item) => relHas(item.attrs, "canonical") && item.attrs.href),
    viewport: Boolean(named("viewport")?.attrs.content), robots: Boolean(named("robots")?.attrs.content),
    favicon: links.some((item) => String(item.attrs.rel || "").toLowerCase().includes("icon") && item.attrs.href),
    ogTitle: Boolean(property("og:title")?.attrs.content), ogDescription: Boolean(property("og:description")?.attrs.content),
    ogImage: Boolean(property("og:image")?.attrs.content), ogType: Boolean(property("og:type")?.attrs.content), ogLocale: Boolean(property("og:locale")?.attrs.content),
    twitterCard: Boolean(named("twitter:card")?.attrs.content)
  };
  const booleanEntries = Object.entries(checks).filter(([, value]) => typeof value === "boolean");
  const score = Math.round(booleanEntries.filter(([, value]) => value).length / booleanEntries.length * 100);
  const previewKeys = ["title", "metaDescription", "ogTitle", "ogDescription", "ogImage", "twitterCard"];
  return { checks, missing: booleanEntries.filter(([, value]) => !value).map(([key]) => key), score, previewScore: Math.round(previewKeys.filter((key) => checks[key]).length / previewKeys.length * 100) };
}

function contentAnalysis(html) {
  const h1s = pairedTags(html, "h1"); const h2s = pairedTags(html, "h2"); const h3s = pairedTags(html, "h3");
  const paragraphs = pairedTags(html, "p"); const lists = [...pairedTags(html, "ul"), ...pairedTags(html, "ol")];
  const tables = pairedTags(html, "table"); const images = openTags(html, "img"); const anchors = pairedTags(html, "a"); const buttons = pairedTags(html, "button");
  const firstParagraph = paragraphs[0]?.text?.trim() || "";
  const hasSingleH1 = h1s.length === 1; const hasH2Structure = h2s.length >= 2;
  const bodyText = stripTags(html); const characterCount = bodyText.replace(/\s+/g, "").length;
  const headings = ["h1", "h2", "h3", "h4"].flatMap((tag) => pairedTags(html, tag).map((item) => item.text));
  const faqLikeSections = headings.filter((value) => /(faq|常见问题|问题|q&a)/i.test(value)).length;
  const imageWithAltCount = images.filter((item) => item.attrs.alt?.trim()).length;
  const imageAltRatio = images.length ? Math.round(imageWithAltCount / images.length * 100) : 100;
  const ctaWords = ["联系", "咨询", "预约", "试用", "联系销售", "立即开始", "demo", "contact", "pricing"];
  const ctaCount = [...buttons, ...anchors].filter((item) => ctaWords.some((word) => item.text.toLowerCase().includes(word))).length;
  let score = 0;
  if (hasSingleH1) score += 20;
  if (hasH2Structure) score += 20;
  if (firstParagraph.length > 80) score += 20;
  if (characterCount > 800) score += 20;
  if (imageAltRatio >= 60) score += 10;
  if (faqLikeSections >= 1 || lists.length >= 2) score += 10;
  return {
    h1Count: h1s.length, h2Count: h2s.length, h3Count: h3s.length, paragraphCount: paragraphs.length,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0, characterCount, readingTimeMinutes: Math.max(1, Math.round(Math.max(characterCount, 1) / 450)),
    hasSingleH1, hasH2Structure, firstParagraphQuality: firstParagraph.length > 80, headingHierarchyOk: hasSingleH1 && hasH2Structure,
    listCount: lists.length, tableCount: tables.length, imageCount: images.length, imageWithAltCount, imageAltRatio, faqLikeSections, ctaCount, score: Math.min(100, score)
  };
}

function domainMatches(hostname, domain) { return hostname === domain || hostname.endsWith(`.${domain}`); }
function citationAnalysis(html, baseUrl) {
  let baseDomain = "";
  try { baseDomain = new URL(baseUrl).hostname.toLowerCase(); } catch { /* uploaded fragments can omit a public URL */ }
  const authorityDomains = ["arxiv.org", "scholar.google.com", "pubmed.ncbi.nlm.nih.gov", "doi.org", "ieee.org", "acm.org", "nature.com", "science.org", "wikipedia.org"];
  const socialDomains = ["linkedin.com", "x.com", "twitter.com", "github.com", "youtube.com", "wechat.com", "weixin.qq.com", "zhihu.com", "bilibili.com"];
  const external = []; const authority = []; const internal = []; const social = [];
  for (const anchor of pairedTags(html, "a")) {
    const href = String(anchor.attrs.href || "").trim();
    let parsed; try { parsed = new URL(href); } catch { continue; }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) continue;
    const domain = parsed.hostname.toLowerCase();
    if (baseDomain && domainMatches(domain, baseDomain)) internal.push(href);
    else {
      external.push(href);
      const labels = domain.split(".");
      if (authorityDomains.some((item) => domainMatches(domain, item)) || labels.includes("gov") || labels.includes("edu")) authority.push(href);
      if (socialDomains.some((item) => domainMatches(domain, item))) social.push(href);
    }
  }
  let score = external.length >= 3 ? 40 : external.length >= 1 ? 20 : 0;
  score += authority.length >= 2 ? 40 : authority.length >= 1 ? 20 : 0;
  if (external.length >= 10 || internal.length >= 12) score += 20;
  return { externalLinkCount: external.length, authorityLinkCount: authority.length, internalLinkCount: internal.length, socialLinkCount: social.length, authorityLinks: authority.slice(0, 5), socialLinks: social.slice(0, 5), score: Math.min(100, score) };
}

function normalizeWeights(weights = {}) {
  const candidate = { ...DEFAULT_DIAGNOSTIC_WEIGHTS };
  for (const key of Object.keys(candidate)) {
    if (weights[key] !== undefined) candidate[key] = Math.max(0, Math.min(1, Number(weights[key]) || 0));
  }
  const total = Object.values(candidate).reduce((sum, value) => sum + value, 0);
  const source = total > 0 ? candidate : DEFAULT_DIAGNOSTIC_WEIGHTS;
  const divisor = Object.values(source).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value / divisor]));
}

export function calculateOverallScore(schemaScore, contentScore, metaScore, citationScore, weights = DEFAULT_DIAGNOSTIC_WEIGHTS) {
  const active = normalizeWeights(weights);
  return Math.round(schemaScore * active.schema + contentScore * active.content + metaScore * active.meta + citationScore * active.citation);
}

function recommendationsFor(schema, meta, content, citation, overall) {
  const urgent = []; const recommended = []; const strengths = []; const gaps = [];
  if (!schema.hasOrg) urgent.push({ item: "缺少 Organization/WebSite Schema", action: "在 <head> 中添加 Organization 或 WebSite JSON-LD，并填写 name、url、description 和 logo。" });
  if (!schema.hasFaq && content.h2Count >= 3) recommended.push({ item: "建议增加 FAQPage Schema", action: "把页面中真实存在的问答标记为 FAQPage，不要生成页面正文中不存在的问题。" });
  if (!meta.checks.metaDescription) urgent.push({ item: "缺少 meta description", action: "添加准确概括当前页面的 meta description，避免堆砌关键词。" });
  if (!meta.checks.ogImage) recommended.push({ item: "缺少 og:image", action: "添加可公开访问的 1200×630 图片，并同步配置图片说明。" });
  if (!content.hasSingleH1) urgent.push({ item: `H1 数量异常（${content.h1Count} 个）`, action: "每页仅保留一个准确表达页面主题的 H1。" });
  if (schema.score >= 80) strengths.push("结构化 Schema 覆盖较完整，页面实体和上下文更容易被机器识别。");
  if (meta.score >= 80) strengths.push("Meta 与社交预览信息较完整，有利于摘要抓取和结果展示。");
  if (citation.authorityLinkCount >= 1) strengths.push("页面已有权威外部引用，可增强关键判断的可核验性。");
  if (schema.missingRecommended.length) gaps.push(`仍缺少 ${schema.missingRecommended.slice(0, 3).join("、")} 等推荐 Schema。`);
  if (!content.firstParagraphQuality) gaps.push("首段缺少足够完整的直达答案，不利于机器快速抽取摘要。");
  if (citation.score < 40) gaps.push("引用密度较低，关键判断缺少外部可信来源支持。");
  const headline = overall >= 80 ? "页面 GEO 基础较强，可继续加强引用与高价值内容结构。" : overall >= 60 ? "页面具备一定 GEO 基础，但仍有明确优化空间。" : "页面 GEO 基础偏弱，建议先补齐结构化标记和内容要点。";
  const priority = urgent[0]?.action || recommended[0]?.action || "持续补充真实 FAQ、案例、权威引用和内部链接。";
  const phasePlan = [];
  if (urgent[0]) phasePlan.push({ phase: "P0", title: urgent[0].item, goal: urgent[0].action, successMetric: "关键结构与摘要信号完整，可被稳定识别。" });
  if (recommended[0]) phasePlan.push({ phase: "P1", title: recommended[0].item, goal: recommended[0].action, successMetric: "摘要展示、问答抽取与预览信息更完整。" });
  phasePlan.push({ phase: "P2", title: "持续补强引用与案例", goal: "补充 FAQ、案例、权威来源和内部链接。", successMetric: "可引用段落与权威来源持续增加。" });
  return { summary: { headline, overview: `当前页面综合 GEO 评分为 ${overall} 分。优先处理结构化数据、首段答案表达与权威引用，再逐步优化开放图谱和内容层级。`, priorityAction: priority }, strengths: strengths.slice(0, 3), gaps: gaps.slice(0, 3), urgent: urgent.slice(0, 3), recommended: recommended.slice(0, 3), optional: [], phasePlan: phasePlan.slice(0, 3) };
}

export function analyzeGeoHtml(html, { baseUrl = "", weights = DEFAULT_DIAGNOSTIC_WEIGHTS } = {}) {
  const source = String(html ?? "").replace(/\u0000/g, "");
  const size = Buffer.byteLength(source, "utf8");
  if (!source.trim()) throw new MonitoringError("HTML content is required.", 422, "MONITORING_HTML_REQUIRED");
  if (size > MAX_HTML_BYTES) throw new MonitoringError("HTML exceeds the 5 MB limit.", 413, "MONITORING_HTML_TOO_LARGE");
  const schema = schemaAnalysis(source); const meta = metaAnalysis(source); const content = contentAnalysis(source); const citation = citationAnalysis(source, baseUrl);
  const normalizedWeights = normalizeWeights(weights);
  const overallScore = calculateOverallScore(schema.score, content.score, meta.score, citation.score, normalizedWeights);
  return { ruleVersion: RULE_VERSION, weights: normalizedWeights, overallScore, schema, content, meta, citation, recommendations: recommendationsFor(schema, meta, content, citation, overallScore), contentHash: crypto.createHash("sha256").update(source, "utf8").digest("hex"), contentBytes: size };
}

function ipv4Public(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function isPublicAddress(address) {
  const normalized = String(address || "").toLowerCase().split("%", 1)[0];
  const family = net.isIP(normalized);
  if (family === 4) return ipv4Public(normalized);
  if (family !== 6) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Public(mapped[1]);
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return false;
  return true;
}

function safeUrlSyntax(value, { remote = false, allowedPorts = [80, 443] } = {}) {
  let parsed;
  try { parsed = new URL(text(value, "url", 2_000, true)); } catch { throw new MonitoringError("A valid HTTP or HTTPS URL is required.", 422, "MONITORING_URL_INVALID"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) throw new MonitoringError("Only credential-free HTTP/HTTPS URLs are allowed.", 422, "MONITORING_URL_INVALID");
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (remote && (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || !hostname.includes(".") && !net.isIP(hostname))) throw new MonitoringError("Local and internal hostnames are blocked.", 403, "MONITORING_SSRF_BLOCKED");
  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  if (remote && !allowedPorts.includes(port)) throw new MonitoringError("The remote URL port is not allowed.", 403, "MONITORING_SSRF_BLOCKED", { port });
  return parsed;
}

export async function validatePublicUrl(value, options = {}) {
  const parsed = safeUrlSyntax(value, { remote: true, allowedPorts: options.allowedPorts || [80, 443] });
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  let records;
  if (net.isIP(hostname)) records = [{ address: hostname, family: net.isIP(hostname) }];
  else {
    try { records = await dns.lookup(hostname, { all: true, verbatim: true }); } catch (error) { throw new MonitoringError("The remote hostname could not be resolved.", 422, "MONITORING_DNS_FAILED", { cause: error.message }); }
  }
  if (!records.length || records.some((item) => !isPublicAddress(item.address))) throw new MonitoringError("The remote URL resolves to a private, local, or reserved address.", 403, "MONITORING_SSRF_BLOCKED");
  return { url: parsed, records };
}

async function remoteHtml(value, options = {}) {
  let current = value;
  const redirects = Math.max(0, Math.min(5, Number(options.maxRedirects) || 3));
  for (let redirect = 0; redirect <= redirects; redirect += 1) {
    const validated = await validatePublicUrl(current, options);
    const selected = validated.records[0]; const target = validated.url;
    const response = await new Promise((resolve, reject) => {
      const transport = target.protocol === "https:" ? https : http;
      const request = transport.request({
        protocol: target.protocol, hostname: target.hostname, servername: target.hostname.replace(/^\[|\]$/g, ""), port: target.port || undefined,
        method: "GET", path: `${target.pathname || "/"}${target.search || ""}`, headers: { Host: target.host, "User-Agent": "TongzhuoGEOMonitor/1.0", Accept: "text/html,application/xhtml+xml" },
        timeout: Math.max(1_000, Math.min(30_000, Number(options.timeoutMs) || 10_000)),
        lookup(_hostname, lookupOptions, callback) {
          if (lookupOptions?.all) callback(null, [{ address: selected.address, family: selected.family }]);
          else callback(null, selected.address, selected.family);
        }
      }, resolve);
      request.on("timeout", () => request.destroy(new Error("remote request timed out")));
      request.on("error", reject); request.end();
    }).catch((error) => { throw new MonitoringError("The remote page could not be fetched.", 502, "MONITORING_FETCH_FAILED", { cause: error.message }); });
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      response.resume();
      if (redirect === redirects) throw new MonitoringError("The remote page redirected too many times.", 422, "MONITORING_REDIRECT_LIMIT");
      current = new URL(response.headers.location, target).href;
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); throw new MonitoringError(`The remote page returned HTTP ${response.statusCode}.`, 502, "MONITORING_FETCH_STATUS"); }
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) { response.resume(); throw new MonitoringError("The remote resource is not HTML.", 422, "MONITORING_CONTENT_TYPE"); }
    const chunks = []; let bytes = 0;
    for await (const chunk of response) {
      bytes += chunk.length;
      if (bytes > MAX_HTML_BYTES) { response.destroy(); throw new MonitoringError("The remote HTML exceeds 5 MB.", 413, "MONITORING_HTML_TOO_LARGE"); }
      chunks.push(chunk);
    }
    return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: target.href };
  }
  throw new MonitoringError("Remote page fetch failed.", 502, "MONITORING_FETCH_FAILED");
}

async function localHtml(directory, relativePath, roots) {
  if (!roots.length) throw new MonitoringError("Local-directory diagnostics are not enabled.", 403, "MONITORING_LOCAL_DISABLED");
  const requestedDirectory = path.resolve(text(directory, "localDirectory", 2_000, true));
  const requestedFile = path.resolve(requestedDirectory, text(relativePath || "index.html", "relativePath", 500, true));
  if (!/\.html?$/i.test(requestedFile)) throw new MonitoringError("Only .html/.htm files can be diagnosed from a local directory.", 422, "MONITORING_LOCAL_FILE_INVALID");
  let realFile;
  try { realFile = await fs.realpath(requestedFile); } catch { throw new MonitoringError("The local HTML file does not exist.", 404, "MONITORING_LOCAL_FILE_NOT_FOUND"); }
  let allowed = false;
  for (const root of roots) {
    try {
      const realRoot = await fs.realpath(path.resolve(root)); const relative = path.relative(realRoot, realFile);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) { allowed = true; break; }
    } catch { /* unavailable roots are ignored */ }
  }
  if (!allowed) throw new MonitoringError("The local HTML file is outside the configured static-site roots.", 403, "MONITORING_LOCAL_PATH_BLOCKED");
  const info = await fs.stat(realFile);
  if (!info.isFile() || info.size > MAX_HTML_BYTES) throw new MonitoringError("The local HTML file is invalid or exceeds 5 MB.", 413, "MONITORING_HTML_TOO_LARGE");
  return { html: await fs.readFile(realFile, "utf8"), label: path.basename(realFile) };
}

function dateRange(input = {}) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date(); const todayText = today.toISOString().slice(0, 10);
  const endText = input.dateTo ? text(input.dateTo, "dateTo", 10, true) : todayText;
  const defaultStart = new Date(`${endText}T00:00:00.000Z`); defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  const startText = input.dateFrom ? text(input.dateFrom, "dateFrom", 10, true) : defaultStart.toISOString().slice(0, 10);
  if (!datePattern.test(startText) || !datePattern.test(endText)) throw new MonitoringError("Dates must use YYYY-MM-DD.", 422, "MONITORING_DATE_INVALID");
  const start = new Date(`${startText}T00:00:00.000Z`); const end = new Date(`${endText}T23:59:59.999Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new MonitoringError("The date range is invalid.", 422, "MONITORING_DATE_INVALID");
  if ((end - start) / 86_400_000 > 366) throw new MonitoringError("The monitoring range cannot exceed 366 days.", 422, "MONITORING_DATE_RANGE_TOO_LARGE");
  return { start: start.toISOString(), end: end.toISOString(), dateFrom: startText, dateTo: endText };
}

export class MonitoringStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("MonitoringStore requires a ProductionDatabase instance.");
    this.database = database; this.connection = database.connection; this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.allowedLocalRoots = Array.isArray(options.allowedLocalRoots) ? options.allowedLocalRoots.map((item) => path.resolve(String(item))) : [];
    this.remotePorts = Array.isArray(options.remotePorts) ? options.remotePorts.map(Number).filter(Number.isInteger) : [80, 443];
    this.publisherStore = options.publisherStore || null;
    this.ipSalt = String(options.ipSalt || process.env.TZ_MONITORING_IP_SALT || process.env.TZ_MASTER_KEY || "tongzhuo-monitoring-private-deployment");
  }

  reportRow(row) {
    if (!row) return null;
    const schema = json(row.schema_analysis_json); const content = json(row.content_analysis_json); const meta = json(row.meta_analysis_json); const citation = json(row.citation_analysis_json);
    const overallScore = row.overall_score == null ? null : Number(row.overall_score);
    return {
      id: row.id, workspaceId: row.workspace_id, sourceKind: row.source_kind,
      sourceUrl: row.source_url, url: row.source_url, sourceLabel: row.source_label,
      status: row.status, overallScore, totalScore: overallScore,
      scores: { schema: Number(schema.score || 0), content: Number(content.score || 0), meta: Number(meta.score || 0), authority: Number(citation.score || 0) },
      schemaScore: Number(schema.score || 0), contentScore: Number(content.score || 0), metaScore: Number(meta.score || 0), authorityScore: Number(citation.score || 0),
      ruleVersion: row.rule_version, weights: json(row.weights_json), schema, content, meta, citation,
      recommendations: json(row.recommendations_json), contentHash: row.content_hash || null, contentBytes: Number(row.content_bytes || 0),
      errorCode: row.error_code || null, errorMessage: row.error_message || null, createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null, createdBy: row.created_by || null
    };
  }

  report(workspaceId = this.workspaceId, reportId) {
    const row = this.connection.prepare("SELECT * FROM monitoring_site_reports WHERE workspace_id = ? AND id = ?").get(workspaceId, reportId);
    if (!row) throw new MonitoringError("Diagnostic report not found.", 404, "MONITORING_REPORT_NOT_FOUND");
    return this.reportRow(row);
  }

  listReports({ workspaceId = this.workspaceId, status = "", limit = 50 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 50));
    const validStatus = status && ["pending", "running", "completed", "failed"].includes(status) ? status : "";
    return (validStatus ? this.connection.prepare("SELECT * FROM monitoring_site_reports WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?").all(workspaceId, validStatus, normalizedLimit) : this.connection.prepare("SELECT * FROM monitoring_site_reports WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(workspaceId, normalizedLimit)).map((row) => this.reportRow(row));
  }

  async diagnose({ workspaceId = this.workspaceId, url = "", baseUrl = "", html = "", localDirectory = "", relativePath = "index.html", sourceLabel = "", weights = DEFAULT_DIAGNOSTIC_WEIGHTS, actor = null, request = null } = {}) {
    const hasHtml = Boolean(String(html || "").trim()); const hasLocal = Boolean(String(localDirectory || "").trim()); const hasUrl = Boolean(String(url || "").trim());
    if ([hasHtml, hasLocal, hasUrl].filter(Boolean).length !== 1) throw new MonitoringError("Provide exactly one source: html, localDirectory, or url.", 422, "MONITORING_SOURCE_INVALID");
    const sourceKind = hasHtml ? "uploaded_html" : hasLocal ? "local_directory" : "remote_url";
    const reportId = id("DIAG"); const timestamp = now(); const userId = actorId(actor);
    let sourceUrl = "";
    if (hasUrl) sourceUrl = text(url, "url", 2_000, true);
    else if (baseUrl) sourceUrl = safeUrlSyntax(baseUrl).href;
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO monitoring_site_reports (id, workspace_id, source_kind, source_url, source_label, status, rule_version, weights_json, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`).run(reportId, workspaceId, sourceKind, sourceUrl, text(sourceLabel, "sourceLabel", 300), RULE_VERSION, JSON.stringify(normalizeWeights(weights)), timestamp, userId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "monitoring.diagnostic.create", entityType: "monitoring_site_report", entityId: reportId, details: { workspaceId, sourceKind, sourceUrl }, request, createdAt: timestamp });
    });
    try {
      const startedAt = now(); this.connection.prepare("UPDATE monitoring_site_reports SET status = 'running', started_at = ? WHERE id = ?").run(startedAt, reportId);
      let loadedHtml = html; let finalUrl = sourceUrl; let finalLabel = sourceLabel;
      if (hasUrl) { const remote = await remoteHtml(url, { allowedPorts: this.remotePorts }); loadedHtml = remote.html; finalUrl = remote.finalUrl; }
      else if (hasLocal) { const local = await localHtml(localDirectory, relativePath, this.allowedLocalRoots); loadedHtml = local.html; finalLabel = finalLabel || local.label; }
      const result = analyzeGeoHtml(loadedHtml, { baseUrl: finalUrl, weights }); const completedAt = now();
      this.database.transaction(() => {
        this.connection.prepare(`UPDATE monitoring_site_reports SET source_url = ?, source_label = ?, status = 'completed', overall_score = ?, weights_json = ?, schema_analysis_json = ?, content_analysis_json = ?, meta_analysis_json = ?, citation_analysis_json = ?, recommendations_json = ?, content_hash = ?, content_bytes = ?, completed_at = ? WHERE id = ?`).run(finalUrl || "", finalLabel || "", result.overallScore, JSON.stringify(result.weights), JSON.stringify(result.schema), JSON.stringify(result.content), JSON.stringify(result.meta), JSON.stringify(result.citation), JSON.stringify(result.recommendations), result.contentHash, result.contentBytes, completedAt, reportId);
        appendAuditLog(this.connection, { actorUserId: userId, action: "monitoring.diagnostic.complete", entityType: "monitoring_site_report", entityId: reportId, details: { overallScore: result.overallScore, contentHash: result.contentHash }, request, createdAt: completedAt });
      });
      return this.report(workspaceId, reportId);
    } catch (error) {
      const completedAt = now(); const normalized = error instanceof MonitoringError ? error : new MonitoringError("Diagnostic processing failed.", 500, "MONITORING_DIAGNOSTIC_FAILED", { cause: error.message });
      this.connection.prepare("UPDATE monitoring_site_reports SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?").run(normalized.code, normalized.message.slice(0, 2_000), completedAt, reportId);
      normalized.details = { ...(normalized.details || {}), reportId };
      throw normalized;
    }
  }

  hashIp(value) { const normalized = String(value || "").trim(); return normalized ? crypto.createHmac("sha256", this.ipSalt).update(normalized).digest("hex") : ""; }

  ingestAccessLogs({ workspaceId = this.workspaceId, source = "local", items = [], actor = null, request = null } = {}) {
    const normalizedSource = ["local", "server", "channel"].includes(source) ? source : null;
    if (!normalizedSource) throw new MonitoringError("Invalid log source.", 422, "MONITORING_LOG_SOURCE_INVALID");
    if (!Array.isArray(items) || !items.length) throw new MonitoringError("At least one access-log item is required.", 422, "MONITORING_LOG_ITEMS_REQUIRED");
    if (items.length > MAX_LOG_BATCH) throw new MonitoringError(`A log batch cannot exceed ${MAX_LOG_BATCH} items.`, 413, "MONITORING_LOG_BATCH_TOO_LARGE");
    const timestamp = now(); const batchId = id("LOGB"); const userId = actorId(actor); let accepted = 0; let duplicates = 0;
    const insert = this.connection.prepare(`INSERT OR IGNORE INTO monitoring_access_logs (id, workspace_id, event_id, source, occurred_at, method, path, status_code, ip_hash, user_agent, traffic_type, bot_name, article_id, channel_id, referer, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.database.transaction(() => {
      for (const item of items) {
        const eventId = text(item?.eventId, "eventId", 180) || null;
        const occurred = item?.occurredAt ? new Date(item.occurredAt) : new Date();
        if (!Number.isFinite(occurred.getTime())) throw new MonitoringError("occurredAt must be a valid date.", 422, "MONITORING_LOG_DATE_INVALID");
        const method = text(item?.method || "GET", "method", 16, true).toUpperCase();
        if (!/^[A-Z]+$/.test(method)) throw new MonitoringError("Invalid HTTP method.", 422, "MONITORING_LOG_METHOD_INVALID");
        let requestPath = text(item?.path, "path", 2_000, true);
        if (/^https?:\/\//i.test(requestPath)) { try { const parsed = new URL(requestPath); requestPath = `${parsed.pathname || "/"}${parsed.search || ""}`; } catch { throw new MonitoringError("Invalid access-log path.", 422, "MONITORING_LOG_PATH_INVALID"); } }
        if (!requestPath.startsWith("/") || /[\r\n]/.test(requestPath)) throw new MonitoringError("Access-log path must start with '/'.", 422, "MONITORING_LOG_PATH_INVALID");
        const statusCode = Number(item?.statusCode ?? 200);
        if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) throw new MonitoringError("statusCode must be between 100 and 599.", 422, "MONITORING_LOG_STATUS_INVALID");
        const userAgent = text(item?.userAgent, "userAgent", 1_000); const classified = classifyTraffic(userAgent);
        const linkedArticleId = text(item?.articleId, "articleId", 180) || null;
        if (linkedArticleId && !this.connection.prepare("SELECT 1 FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, linkedArticleId)) throw new MonitoringError("The linked article does not exist.", 422, "MONITORING_ARTICLE_NOT_FOUND", { articleId: linkedArticleId });
        const result = insert.run(id("LOG"), workspaceId, eventId, normalizedSource, occurred.toISOString(), method, requestPath, statusCode, this.hashIp(text(item?.ipAddress, "ipAddress", 120)), userAgent, classified.type, classified.botName, linkedArticleId, text(item?.channelId, "channelId", 180) || null, text(item?.referer, "referer", 2_000), JSON.stringify(json(item?.metadata, {})), timestamp);
        if (Number(result.changes)) accepted += 1; else duplicates += 1;
      }
      this.connection.prepare("INSERT INTO monitoring_log_batches (id, workspace_id, source, received_count, accepted_count, duplicate_count, rejected_count, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)").run(batchId, workspaceId, normalizedSource, items.length, accepted, duplicates, timestamp, userId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "monitoring.access_logs.ingest", entityType: "monitoring_log_batch", entityId: batchId, details: { workspaceId, source: normalizedSource, received: items.length, accepted, duplicates }, request, createdAt: timestamp });
    });
    return { batchId, received: items.length, accepted, duplicates, rejected: 0 };
  }

  trafficSummary({ workspaceId = this.workspaceId, dateFrom, dateTo, source = "all", trafficType = "all", articleId = "" } = {}) {
    const range = dateRange({ dateFrom, dateTo });
    if (!["all", "local", "server", "channel"].includes(source)) throw new MonitoringError("Invalid log source filter.", 422, "MONITORING_FILTER_INVALID");
    if (!["all", ...TRAFFIC_TYPES].includes(trafficType)) throw new MonitoringError("Invalid traffic type filter.", 422, "MONITORING_FILTER_INVALID");
    const params = [workspaceId, range.start, range.end]; let where = "workspace_id = ? AND occurred_at BETWEEN ? AND ? AND method = 'GET'";
    if (source !== "all") { where += " AND source = ?"; params.push(source); }
    if (trafficType !== "all") { where += " AND traffic_type = ?"; params.push(trafficType); }
    if (articleId) { where += " AND article_id = ?"; params.push(articleId); }
    const kpis = this.connection.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT CASE WHEN ip_hash <> '' THEN ip_hash END) AS unique_ip, SUM(CASE WHEN traffic_type = 'human' THEN 1 ELSE 0 END) AS human_pv, SUM(CASE WHEN traffic_type = 'ai_bot' THEN 1 ELSE 0 END) AS ai_bot_pv, SUM(CASE WHEN traffic_type = 'search_bot' THEN 1 ELSE 0 END) AS search_bot_pv, SUM(CASE WHEN traffic_type = 'other_bot' THEN 1 ELSE 0 END) AS other_bot_pv, SUM(CASE WHEN traffic_type = 'unknown' THEN 1 ELSE 0 END) AS unknown_pv, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors FROM monitoring_access_logs WHERE ${where}`).get(...params);
    const trendRows = this.connection.prepare(`SELECT substr(occurred_at, 1, 10) AS day, COUNT(*) AS pv, SUM(CASE WHEN traffic_type = 'ai_bot' THEN 1 ELSE 0 END) AS ai_bot_pv FROM monitoring_access_logs WHERE ${where} GROUP BY day ORDER BY day`).all(...params);
    const trendMap = new Map(trendRows.map((row) => [row.day, { pv: Number(row.pv), aiBotPv: Number(row.ai_bot_pv || 0) }]));
    const trafficTrend = []; const cursor = new Date(`${range.dateFrom}T00:00:00.000Z`); const end = new Date(`${range.dateTo}T00:00:00.000Z`);
    while (cursor <= end) { const day = cursor.toISOString().slice(0, 10); trafficTrend.push({ date: day, ...(trendMap.get(day) || { pv: 0, aiBotPv: 0 }) }); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    const botRows = this.connection.prepare(`SELECT traffic_type, COUNT(*) AS count FROM monitoring_access_logs WHERE ${where} GROUP BY traffic_type`).all(...params); const botMap = new Map(botRows.map((row) => [row.traffic_type, Number(row.count)]));
    const topPaths = this.connection.prepare(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN ip_hash <> '' THEN ip_hash END) AS unique_ip FROM monitoring_access_logs WHERE ${where} AND trim(path) <> '' GROUP BY path ORDER BY views DESC LIMIT 8`).all(...params).map((row) => ({ path: row.path, views: Number(row.views), uniqueIp: Number(row.unique_ip || 0) }));
    const topArticles = this.connection.prepare(`SELECT l.article_id, COALESCE(a.title, l.article_id) AS title, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN l.ip_hash <> '' THEN l.ip_hash END) AS unique_ip FROM monitoring_access_logs l LEFT JOIN content_articles a ON a.id = l.article_id WHERE ${where.replaceAll("workspace_id", "l.workspace_id").replaceAll("occurred_at", "l.occurred_at").replaceAll("source", "l.source").replaceAll("traffic_type", "l.traffic_type").replaceAll("article_id", "l.article_id").replaceAll("method", "l.method")} AND l.article_id IS NOT NULL GROUP BY l.article_id, a.title ORDER BY views DESC LIMIT 8`).all(...params).map((row) => ({ articleId: row.article_id, title: row.title, views: Number(row.views), uniqueIp: Number(row.unique_ip || 0) }));
    const normalizedKpis = {
      pv: Number(kpis?.pv || 0),
      uniqueIp: Number(kpis?.unique_ip || 0),
      humanPv: Number(kpis?.human_pv || 0),
      aiBotPv: Number(kpis?.ai_bot_pv || 0),
      searchBotPv: Number(kpis?.search_bot_pv || 0),
      otherBotPv: Number(kpis?.other_bot_pv || 0),
      unknownPv: Number(kpis?.unknown_pv || 0),
      errors: Number(kpis?.errors || 0)
    };
    const botBreakdown = TRAFFIC_TYPES.map((key) => ({ key, count: botMap.get(key) || 0 }));
    return {
      filters: { ...range, source, trafficType, articleId: articleId || null }, hasData: normalizedKpis.pv > 0, kpis: normalizedKpis,
      pv: normalizedKpis.aiBotPv,
      trend: trafficTrend.map((item) => ({ date: item.date, pv: item.aiBotPv, totalPv: item.pv })),
      trafficTrend, botBreakdown,
      bots: botBreakdown.filter((item) => item.key !== "human" && item.key !== "unknown").map((item) => ({ name: item.key, pv: item.count })),
      topPaths: topPaths.map((item) => ({ ...item, pv: item.views })), topArticles
    };
  }

  async operationsSummary({ workspaceId = this.workspaceId, dateFrom, dateTo, businessLineId = "" } = {}) {
    const range = dateRange({ dateFrom, dateTo }); const params = [workspaceId, range.start, range.end];
    let articleWhere = "workspace_id = ? AND created_at BETWEEN ? AND ?"; if (businessLineId) { articleWhere += " AND business_line_id = ?"; params.push(businessLineId); }
    let articleAliasWhere = "a.workspace_id = ? AND a.created_at BETWEEN ? AND ?"; if (businessLineId) articleAliasWhere += " AND a.business_line_id = ?";
    const articleRows = this.connection.prepare(`SELECT status, COUNT(*) AS count FROM content_articles WHERE ${articleWhere} GROUP BY status`).all(...params); const articleMap = new Map(articleRows.map((row) => [row.status, Number(row.count)]));
    const taskTotal = Number(this.connection.prepare(`SELECT COUNT(*) AS count FROM content_tasks WHERE ${articleWhere}`).get(...params)?.count || 0);
    const reviewRows = this.connection.prepare(`SELECT v.review_status, COUNT(*) AS count FROM content_article_versions v JOIN content_articles a ON a.id = v.article_id WHERE ${articleAliasWhere} AND v.id = a.current_version_id GROUP BY v.review_status`).all(...params); const reviewMap = new Map(reviewRows.map((row) => [row.review_status, Number(row.count)]));
    const jobWhere = businessLineId ? "j.workspace_id = ? AND j.created_at BETWEEN ? AND ? AND a.business_line_id = ?" : "j.workspace_id = ? AND j.created_at BETWEEN ? AND ?";
    const generationRows = this.connection.prepare(`SELECT j.status, COUNT(*) AS count FROM content_generation_jobs j LEFT JOIN content_articles a ON a.id = j.article_id WHERE ${jobWhere} GROUP BY j.status`).all(...params); const generationMap = new Map(generationRows.map((row) => [row.status, Number(row.count)]));
    const totalArticles = [...articleMap.values()].reduce((sum, value) => sum + value, 0); const generationTotal = [...generationMap.values()].reduce((sum, value) => sum + value, 0);
    let publisher = { available: false, total: 0, success: 0, partial: 0, failed: 0, pending: 0, cancelled: 0, platforms: [] };
    if (this.publisherStore) {
      await this.publisherStore.load?.();
      const jobs = (this.publisherStore.state?.jobs || []).filter((job) => { const created = new Date(job.createdAt || job.created_at || 0); return Number.isFinite(created.getTime()) && created >= new Date(range.start) && created <= new Date(range.end); });
      const counts = { success: 0, partial: 0, failed: 0, pending: 0, cancelled: 0 }; const platformMap = new Map();
      for (const job of jobs) {
        const status = String(job.status || "queued");
        if (["success", "published", "completed"].includes(status)) counts.success += 1;
        else if (status === "partial") counts.partial += 1;
        else if (status === "failed") counts.failed += 1;
        else if (status === "cancelled") counts.cancelled += 1;
        else counts.pending += 1;
        const platformIds = [...new Set([...(job.targetPlatforms || job.platforms || []), ...Object.keys(job.results || {})])];
        for (const platformId of platformIds) {
          const state = String(job.results?.[platformId]?.state || status); const row = platformMap.get(platformId) || { platformId, total: 0, success: 0, failed: 0, pending: 0 };
          row.total += 1;
          if (["published", "success", "completed"].includes(state)) row.success += 1; else if (["failed", "cancelled"].includes(state)) row.failed += 1; else row.pending += 1;
          platformMap.set(platformId, row);
        }
      }
      publisher = { available: true, total: jobs.length, ...counts, platforms: [...platformMap.values()].sort((a, b) => b.total - a.total) };
    }
    return {
      filters: { ...range, businessLineId: businessLineId || null },
      content: { totalArticles, taskTotal, draft: articleMap.get("draft") || 0, inReview: articleMap.get("in_review") || 0, changesRequested: articleMap.get("changes_requested") || 0, approved: articleMap.get("approved") || 0, published: articleMap.get("published") || 0, archived: articleMap.get("archived") || 0, currentReview: Object.fromEntries(reviewMap), funnel: [{ key: "created", count: totalArticles }, { key: "draft", count: articleMap.get("draft") || 0 }, { key: "review", count: reviewMap.get("pending") || 0 }, { key: "approved", count: reviewMap.get("approved") || 0 }, { key: "published", count: articleMap.get("published") || 0 }] },
      generation: { total: generationTotal, queued: generationMap.get("queued") || 0, running: generationMap.get("running") || 0, succeeded: generationMap.get("succeeded") || 0, failed: generationMap.get("failed") || 0, cancelled: generationMap.get("cancelled") || 0, successRate: generationTotal ? Math.round((generationMap.get("succeeded") || 0) / generationTotal * 10000) / 100 : 0 },
      publishing: publisher,
      boundary: "Crawler access is a discoverability proxy only; it is not proof of ranking or citation in an AI answer."
    };
  }

  async overview({ workspaceId = this.workspaceId, dateFrom, dateTo, businessLineId = "" } = {}) {
    const operations = await this.operationsSummary({ workspaceId, dateFrom, dateTo, businessLineId });
    const traffic = this.trafficSummary({ workspaceId, dateFrom, dateTo });
    const latestDiagnostic = this.listReports({ workspaceId, limit: 1 })[0] || null;
    const content = operations.content; const publishing = operations.publishing;
    return {
      latestDiagnostic,
      traffic,
      operations,
      production: {
        articles: { total: content.totalArticles, draft: content.draft + content.inReview + content.changesRequested, approved: content.approved, published: content.published },
        contentTasks: content.taskTotal,
        generation: operations.generation,
        publishing: { total: publishing.total, running: publishing.pending, failed: publishing.failed + publishing.partial, succeeded: publishing.success, cancelled: publishing.cancelled, platforms: publishing.platforms }
      },
      boundary: operations.boundary
    };
  }
}

export default MonitoringStore;
