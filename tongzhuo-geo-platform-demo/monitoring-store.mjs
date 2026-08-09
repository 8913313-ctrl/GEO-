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
// Keep the externally recorded GEORank rule family stable for existing
// reports. `analysisRevision` below distinguishes the richer evidence
// contract without making old reports appear to have been re-scored.
export const DIAGNOSTIC_RULE_VERSION = "yaojingang-georank-v1";
export const DIAGNOSTIC_ANALYSIS_REVISION = "website-page-analysis-v2";
const RULE_VERSION = DIAGNOSTIC_RULE_VERSION;
export const DEFAULT_DIAGNOSTIC_WEIGHTS = Object.freeze({ schema: 0.3, content: 0.3, meta: 0.2, citation: 0.2 });
export const TRAFFIC_TYPES = Object.freeze(["human", "search_bot", "ai_bot", "other_bot", "unknown"]);
export const DEFAULT_MONITORING_TIME_ZONE_OFFSET_MINUTES = 8 * 60;

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

export function monitoringTimeZoneOffsetMinutes(value = process.env.TZ_MONITORING_TIME_ZONE_OFFSET_MINUTES) {
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= -720 && offset <= 840 ? offset : DEFAULT_MONITORING_TIME_ZONE_OFFSET_MINUTES;
}

function dateTextFromUtc(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function monitoringReportingDate(value = new Date(), offsetMinutes = monitoringTimeZoneOffsetMinutes()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("monitoringReportingDate requires a valid date.");
  return dateTextFromUtc(new Date(date.getTime() + offsetMinutes * 60_000));
}

export function monitoringDateDaysBefore(dateText, days) {
  const date = new Date(`${String(dateText)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new TypeError("monitoringDateDaysBefore requires YYYY-MM-DD.");
  date.setUTCDate(date.getUTCDate() - Math.max(0, Math.floor(Number(days) || 0)));
  return dateTextFromUtc(date);
}

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
  // JSON-LD commonly puts entities in @graph, but nested entities are also
  // valid (for example FAQ mainEntity or itemListElement). Traverse all
  // object-valued fields so the evidence reports every discoverable @type.
  for (const [key, nested] of Object.entries(value)) {
    if (key === "@context" || !nested || typeof nested !== "object") continue;
    jsonLdNodes(nested, output);
  }
  return output;
}

function schemaAnalysis(html) {
  const scripts = pairedTags(html, "script").filter((item) => String(item.attrs.type || "").toLowerCase() === "application/ld+json");
  const types = [];
  const scriptEvidence = [];
  let invalidJsonLdCount = 0;
  for (const [index, script] of scripts.entries()) {
    try {
      const parsed = JSON.parse(script.inner.trim());
      const nodes = jsonLdNodes(parsed);
      const scriptTypes = [];
      for (const node of nodes) {
        const values = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        values.filter((item) => typeof item === "string" && item.trim()).forEach((item) => {
          const type = item.trim(); types.push(type); scriptTypes.push(type);
        });
      }
      scriptEvidence.push({ index, valid: true, nodeCount: nodes.length, foundTypes: [...new Set(scriptTypes)] });
    } catch {
      invalidJsonLdCount += 1;
      scriptEvidence.push({ index, valid: false, nodeCount: 0, foundTypes: [] });
    }
  }
  const foundTypes = [...new Set(types)];
  const recommended = ["WebSite", "Organization", "FAQPage", "Article", "BreadcrumbList"];
  const coverageRatio = Math.round(foundTypes.filter((item) => recommended.includes(item)).length / recommended.length * 100);
  const score = Math.min(100, Math.max(foundTypes.length * 16, coverageRatio));
  const missingRecommended = recommended.filter((item) => !foundTypes.includes(item));
  const hasFaq = foundTypes.includes("FAQPage");
  const hasOrganization = foundTypes.includes("Organization");
  const hasWebsite = foundTypes.includes("WebSite");
  const hasArticle = foundTypes.includes("Article");
  const hasBreadcrumb = foundTypes.includes("BreadcrumbList");
  const evidence = {
    jsonld_count: scripts.length,
    parseable_jsonld_count: scripts.length - invalidJsonLdCount,
    invalid_jsonld_count: invalidJsonLdCount,
    found_types: foundTypes,
    missing_recommended: missingRecommended,
    has_website: hasWebsite,
    has_organization: hasOrganization,
    has_faq: hasFaq,
    has_article: hasArticle,
    has_breadcrumb: hasBreadcrumb,
    scripts: scriptEvidence
  };
  return {
    foundTypes,
    found_types: foundTypes,
    missingRecommended,
    missing_recommended: missingRecommended,
    schemaCount: scripts.length,
    jsonldCount: scripts.length,
    jsonld_count: scripts.length,
    invalidJsonLdCount,
    score,
    schemaScore: score,
    schema_score: score,
    coverageRatio,
    hasFaq,
    hasOrg: hasOrganization || hasWebsite,
    hasOrganization,
    hasArticle,
    hasBreadcrumb,
    hasProduct: foundTypes.includes("Product"),
    hasWebsite,
    evidence
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
  const canonicalHref = links.find((item) => relHas(item.attrs, "canonical") && item.attrs.href)?.attrs.href || "";
  const robotsValue = named("robots")?.attrs.content?.trim() || "";
  const htmlLang = htmlTag?.attrs.lang?.trim() || "";
  const checks = {
    title: Boolean(titleValue), titleLength: titleValue.length, htmlLang: Boolean(htmlTag?.attrs.lang?.trim()),
    metaDescription: Boolean(description), metaDescriptionLength: description.length,
    canonical: Boolean(canonicalHref),
    viewport: Boolean(named("viewport")?.attrs.content), robots: Boolean(robotsValue),
    favicon: links.some((item) => String(item.attrs.rel || "").toLowerCase().includes("icon") && item.attrs.href),
    ogTitle: Boolean(property("og:title")?.attrs.content), ogDescription: Boolean(property("og:description")?.attrs.content),
    ogImage: Boolean(property("og:image")?.attrs.content), ogType: Boolean(property("og:type")?.attrs.content), ogLocale: Boolean(property("og:locale")?.attrs.content),
    twitterCard: Boolean(named("twitter:card")?.attrs.content)
  };
  const booleanEntries = Object.entries(checks).filter(([, value]) => typeof value === "boolean");
  const score = Math.round(booleanEntries.filter(([, value]) => value).length / booleanEntries.length * 100);
  const previewKeys = ["title", "metaDescription", "ogTitle", "ogDescription", "ogImage", "twitterCard"];
  const missing = booleanEntries.filter(([, value]) => !value).map(([key]) => key);
  const previewScore = Math.round(previewKeys.filter((key) => checks[key]).length / previewKeys.length * 100);
  const evidence = {
    checks,
    missing,
    preview_checks: Object.fromEntries(previewKeys.map((key) => [key, Boolean(checks[key])])),
    title_length: titleValue.length,
    meta_description_length: description.length,
    html_lang: htmlLang,
    canonical_href: canonicalHref,
    robots_value: robotsValue,
    check_count: booleanEntries.length,
    passed_check_count: booleanEntries.filter(([, value]) => value).length
  };
  return { checks, missing, score, metaScore: score, meta_score: score, previewScore, preview_score: previewScore, evidence };
}

function firstParagraphDirectAnswerSignals(value) {
  const paragraph = String(value || "").trim();
  const normalized = paragraph.toLowerCase();
  const hasChineseAnswerCue = /\u662f|\u4e3a|\u6307|\u53ef\u4ee5|\u5e94\u5f53|\u5e94|\u5efa\u8bae|\u901a\u5e38|\u9700\u8981|\u9002\u5408|\u4e0d\u9002\u5408/.test(paragraph);
  const hasEnglishAnswerCue = /\b(is|are|means|can|should|recommend|typically|need|suitable)\b/.test(normalized);
  return {
    length: paragraph.length,
    hasDirectAnswerCue: hasChineseAnswerCue || hasEnglishAnswerCue,
    hasDirectAnswer: paragraph.length >= 40 && (hasChineseAnswerCue || hasEnglishAnswerCue)
  };
}

function contentAnalysis(html) {
  const h1s = pairedTags(html, "h1"); const h2s = pairedTags(html, "h2"); const h3s = pairedTags(html, "h3");
  const paragraphs = pairedTags(html, "p"); const lists = [...pairedTags(html, "ul"), ...pairedTags(html, "ol")];
  const tables = pairedTags(html, "table"); const images = openTags(html, "img"); const anchors = pairedTags(html, "a"); const buttons = pairedTags(html, "button");
  const firstParagraph = paragraphs[0]?.text?.trim() || "";
  const firstParagraphSignals = firstParagraphDirectAnswerSignals(firstParagraph);
  const hasSingleH1 = h1s.length === 1; const hasH2Structure = h2s.length >= 2;
  const bodyText = stripTags(html); const characterCount = bodyText.replace(/\s+/g, "").length;
  const headings = ["h1", "h2", "h3", "h4"].flatMap((tag) => pairedTags(html, tag).map((item) => item.text));
  const faqLikeSections = headings.filter((value) => /(faq|常见问题|问题|q&a)/i.test(value)).length;
  const normalizedFaqLikeSections = headings.filter((value) => /(?:faq|q&a|\u5e38\u89c1\u95ee\u9898|\u95ee\u9898)/i.test(String(value || ""))).length;
  const imageWithAltCount = images.filter((item) => item.attrs.alt?.trim()).length;
  const imageAltRatio = images.length ? Math.round(imageWithAltCount / images.length * 100) : 100;
  const ctaWords = ["联系", "咨询", "预约", "试用", "联系销售", "立即开始", "demo", "contact", "pricing"];
  const ctaCount = [...buttons, ...anchors].filter((item) => ctaWords.some((word) => item.text.toLowerCase().includes(word))).length;
  const ctaPatterns = [/\u8054\u7cfb/, /\u54a8\u8be2/, /\u9884\u7ea6/, /\u8bd5\u7528/, /\u7acb\u5373\u5f00\u59cb/, /\u83b7\u53d6\u65b9\u6848/, /\u7d22\u53d6/, /\bdemo\b/i, /\bcontact\b/i, /\bpricing\b/i];
  const normalizedCtaCount = [...buttons, ...anchors].filter((item) => ctaPatterns.some((pattern) => pattern.test(String(item.text || "")))).length;
  let score = 0;
  if (hasSingleH1) score += 20;
  if (hasH2Structure) score += 20;
  if (firstParagraph.length > 80) score += 20;
  if (characterCount > 800) score += 20;
  if (imageAltRatio >= 60) score += 10;
  if (normalizedFaqLikeSections >= 1 || lists.length >= 2) score += 10;
  const scoreBreakdown = {
    single_h1: hasSingleH1 ? 20 : 0,
    h2_structure: hasH2Structure ? 20 : 0,
    first_paragraph: firstParagraph.length > 80 ? 20 : 0,
    body_length: characterCount > 800 ? 20 : 0,
    image_alt_coverage: imageAltRatio >= 60 ? 10 : 0,
    faq_or_lists: normalizedFaqLikeSections >= 1 || lists.length >= 2 ? 10 : 0
  };
  const evidence = {
    h1_count: h1s.length,
    h2_count: h2s.length,
    h3_count: h3s.length,
    paragraph_count: paragraphs.length,
    character_count: characterCount,
    image_count: images.length,
    image_with_alt_count: imageWithAltCount,
    image_alt_ratio: imageAltRatio,
    faq_section_count: normalizedFaqLikeSections,
    list_count: lists.length,
    table_count: tables.length,
    cta_count: normalizedCtaCount,
    has_single_h1: hasSingleH1,
    has_h2_structure: hasH2Structure,
    first_paragraph_length: firstParagraphSignals.length,
    first_paragraph_has_direct_answer: firstParagraphSignals.hasDirectAnswer,
    score_breakdown: scoreBreakdown
  };
  return {
    h1Count: h1s.length, h2Count: h2s.length, h3Count: h3s.length, paragraphCount: paragraphs.length,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0, characterCount, readingTimeMinutes: Math.max(1, Math.round(Math.max(characterCount, 1) / 450)),
    hasSingleH1, hasH2Structure, firstParagraphQuality: firstParagraph.length > 80, headingHierarchyOk: hasSingleH1 && hasH2Structure,
    firstParagraphHasDirectAnswer: firstParagraphSignals.hasDirectAnswer,
    firstParagraphDirectAnswerCue: firstParagraphSignals.hasDirectAnswerCue,
    listCount: lists.length, tableCount: tables.length, imageCount: images.length, imageWithAltCount, imageAltRatio, faqLikeSections: normalizedFaqLikeSections, faqSectionCount: normalizedFaqLikeSections, ctaCount: normalizedCtaCount,
    score: Math.min(100, score), contentScore: Math.min(100, score), content_score: Math.min(100, score), scoreBreakdown, evidence
  };
}

function domainMatches(hostname, domain) { return hostname === domain || hostname.endsWith(`.${domain}`); }
function citationAnalysis(html, baseUrl) {
  let baseDomain = "";
  let base = null;
  try { base = new URL(baseUrl); baseDomain = base.hostname.toLowerCase(); } catch { /* uploaded fragments can omit a public URL */ }
  const authorityDomains = ["arxiv.org", "scholar.google.com", "pubmed.ncbi.nlm.nih.gov", "doi.org", "ieee.org", "acm.org", "nature.com", "science.org", "wikipedia.org"];
  const socialDomains = ["linkedin.com", "x.com", "twitter.com", "github.com", "youtube.com", "wechat.com", "weixin.qq.com", "zhihu.com", "bilibili.com"];
  const external = []; const authority = []; const internal = []; const social = []; const sourceLinks = [];
  const externalEvidence = []; const authorityEvidence = []; const internalEvidence = []; const socialEvidence = []; const sourceEvidence = [];
  for (const anchor of pairedTags(html, "a")) {
    const href = String(anchor.attrs.href || "").trim();
    let parsed; try { parsed = new URL(href, base || undefined); } catch { continue; }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) continue;
    const domain = parsed.hostname.toLowerCase();
    const record = { href: parsed.href, domain, text: String(anchor.text || "").replace(/\s+/g, " ").trim().slice(0, 180) };
    const sourceLike = /(?:source|reference|citation|evidence|\u6765\u6e90|\u5f15\u7528|\u53c2\u8003|\u8bc1\u636e)/i.test(`${record.text} ${anchor.attrs.rel || ""}`);
    if (baseDomain && domainMatches(domain, baseDomain)) {
      internal.push(parsed.href);
      internalEvidence.push(record);
    }
    else {
      external.push(parsed.href);
      externalEvidence.push(record);
      const labels = domain.split(".");
      const isAuthority = authorityDomains.some((item) => domainMatches(domain, item)) || labels.includes("gov") || labels.includes("edu") || /\.(?:gov|edu)(?:\.|$)/.test(domain);
      const isSocial = socialDomains.some((item) => domainMatches(domain, item));
      if (isAuthority) { authority.push(parsed.href); authorityEvidence.push(record); }
      if (isSocial) { social.push(parsed.href); socialEvidence.push(record); }
      if (isAuthority || sourceLike) { sourceLinks.push(parsed.href); sourceEvidence.push(record); }
    }
  }
  let score = external.length >= 3 ? 40 : external.length >= 1 ? 20 : 0;
  score += authority.length >= 2 ? 40 : authority.length >= 1 ? 20 : 0;
  if (external.length >= 10 || internal.length >= 12) score += 20;
  const normalizedScore = Math.min(100, score);
  const evidence = {
    external_link_count: external.length,
    authority_link_count: authority.length,
    internal_link_count: internal.length,
    social_link_count: social.length,
    source_link_count: sourceLinks.length,
    has_recognized_source_link: sourceLinks.length > 0,
    external_links: externalEvidence.slice(0, 12),
    authority_links: authorityEvidence.slice(0, 8),
    source_links: sourceEvidence.slice(0, 8),
    internal_links: internalEvidence.slice(0, 12),
    social_links: socialEvidence.slice(0, 8),
    score_breakdown: {
      external_links: external.length >= 3 ? 40 : external.length >= 1 ? 20 : 0,
      authority_links: authority.length >= 2 ? 40 : authority.length >= 1 ? 20 : 0,
      link_coverage: external.length >= 10 || internal.length >= 12 ? 20 : 0
    }
  };
  return {
    externalLinkCount: external.length, authorityLinkCount: authority.length, internalLinkCount: internal.length, socialLinkCount: social.length,
    sourceLinkCount: sourceLinks.length, hasRecognizedSourceLink: sourceLinks.length > 0,
    external_link_count: external.length, authority_link_count: authority.length, internal_link_count: internal.length, social_link_count: social.length,
    authorityLinks: authority.slice(0, 5), socialLinks: social.slice(0, 5), sourceLinks: sourceLinks.slice(0, 8), internalLinks: internal.slice(0, 8), externalLinks: external.slice(0, 8),
    score: normalizedScore, citationScore: normalizedScore, citation_score: normalizedScore, evidence
  };
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

function compactSuggestionText(value, max = 600) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function recommendationEvidenceKeys(value) {
  const allowed = new Set(["schema", "content", "meta", "citation"]);
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim().toLowerCase()).filter((item) => allowed.has(item)))];
}

function ruleRecommendationsWithEvidence(recommendations, analysis) {
  const annotate = (items, priority, evidenceKeys) => (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    id: item.id || `RULE-${priority}-${index + 1}`,
    source: "rules",
    priority,
    evidenceKeys
  }));
  const urgent = annotate(recommendations.urgent, "P0", ["schema", "meta", "content"]);
  const recommended = annotate(recommendations.recommended, "P1", ["schema", "meta", "content"]);
  const optional = annotate(recommendations.optional, "P2", ["citation", "content"]);
  const ruleFindings = {
    urgent,
    recommended,
    optional,
    strengths: Array.isArray(recommendations.strengths) ? recommendations.strengths : [],
    gaps: Array.isArray(recommendations.gaps) ? recommendations.gaps : [],
    evidence: {
      schema_score: analysis.schema.score,
      content_score: analysis.content.score,
      meta_score: analysis.meta.score,
      citation_score: analysis.citation.score
    }
  };
  return {
    ...recommendations,
    urgent,
    recommended,
    optional,
    source: "rules",
    recommendationSource: "rules",
    generation: {
      strategy: "rules_then_optional_llm",
      requested: false,
      status: "rule_ready",
      source: "rules",
      fallback: false
    },
    ruleFindings,
    llm: null
  };
}

function normalizeSuggestionGeneration(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const requestedMode = String(input.mode || input.type || "rules").trim().toLowerCase();
  return {
    mode: requestedMode === "llm" || requestedMode === "model" ? "llm" : "rules",
    providerId: compactSuggestionText(input.providerId, 180),
    model: compactSuggestionText(input.model, 180)
  };
}

function normalizeModelSuggestions(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawItems = Array.isArray(input.recommendations) ? input.recommendations : Array.isArray(input.actions) ? input.actions : [];
  const recommendations = rawItems.slice(0, 6).map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const title = compactSuggestionText(item.title || item.item, 180);
    const action = compactSuggestionText(item.action || item.recommendation || item.rationale, 700);
    if (!title || !action) return null;
    const priority = ["P0", "P1", "P2"].includes(String(item.priority || "").toUpperCase()) ? String(item.priority).toUpperCase() : index === 0 ? "P0" : "P1";
    const evidenceKeys = recommendationEvidenceKeys(item.evidenceKeys || item.evidence_keys);
    if (!evidenceKeys.length) return null;
    return {
      id: `LLM-${index + 1}`,
      source: "llm",
      priority,
      title,
      action,
      rationale: compactSuggestionText(item.rationale || "", 700),
      evidenceKeys
    };
  }).filter(Boolean);
  if (!recommendations.length) throw new MonitoringError("The model did not return usable diagnostic recommendations.", 502, "MONITORING_LLM_EMPTY");
  return {
    summary: compactSuggestionText(input.summary || input.overview, 1_200),
    priorityAction: compactSuggestionText(input.priorityAction || input.priority_action, 700),
    recommendations
  };
}

function ruleFallbackRecommendations(ruleRecommendations, generation, error = null) {
  const safeMessage = compactSuggestionText(error?.message || generation?.message || "", 500);
  return {
    ...ruleRecommendations,
    source: "rule_fallback",
    recommendationSource: "rule_fallback",
    generation: {
      strategy: "rules_then_optional_llm",
      requested: true,
      status: "fallback",
      source: "rule_fallback",
      fallback: true,
      providerId: compactSuggestionText(generation?.providerId, 180) || null,
      model: compactSuggestionText(generation?.model, 180) || null,
      failureCode: compactSuggestionText(error?.code || generation?.failureCode || "MONITORING_LLM_UNAVAILABLE", 120),
      failureMessage: safeMessage || "模型建议不可用，已保留规则建议。"
    },
    llm: null
  };
}

function mergeModelRecommendations(ruleRecommendations, generated, request) {
  const llm = normalizeModelSuggestions(generated);
  const generation = generated?.generation && typeof generated.generation === "object" ? generated.generation : {};
  return {
    ...ruleRecommendations,
    source: "llm",
    recommendationSource: "llm",
    generation: {
      strategy: "rules_then_optional_llm",
      requested: true,
      status: "succeeded",
      source: "llm",
      fallback: false,
      providerId: compactSuggestionText(generation.providerId || request.providerId, 180) || null,
      providerName: compactSuggestionText(generation.providerName, 180) || null,
      model: compactSuggestionText(generation.model || request.model, 180) || null,
      generationRunId: compactSuggestionText(generation.generationRunId || generation.runId, 180) || null,
      generatedAt: compactSuggestionText(generation.generatedAt, 80) || now()
    },
    llm
  };
}

export function analyzeGeoHtml(html, { baseUrl = "", weights = DEFAULT_DIAGNOSTIC_WEIGHTS } = {}) {
  const source = String(html ?? "").replace(/\u0000/g, "");
  const size = Buffer.byteLength(source, "utf8");
  if (!source.trim()) throw new MonitoringError("HTML content is required.", 422, "MONITORING_HTML_REQUIRED");
  if (size > MAX_HTML_BYTES) throw new MonitoringError("HTML exceeds the 5 MB limit.", 413, "MONITORING_HTML_TOO_LARGE");
  const schema = schemaAnalysis(source); const meta = metaAnalysis(source); const content = contentAnalysis(source); const citation = citationAnalysis(source, baseUrl);
  const normalizedWeights = normalizeWeights(weights);
  const overallScore = calculateOverallScore(schema.score, content.score, meta.score, citation.score, normalizedWeights);
  const ruleRecommendations = ruleRecommendationsWithEvidence(recommendationsFor(schema, meta, content, citation, overallScore), { schema, content, meta, citation });
  const evidence = {
    analysis_revision: DIAGNOSTIC_ANALYSIS_REVISION,
    score_formula: "schema*0.30 + content*0.30 + meta*0.20 + citation*0.20",
    schema: schema.evidence,
    content: content.evidence,
    meta: meta.evidence,
    citation: citation.evidence
  };
  return { ruleVersion: RULE_VERSION, analysisRevision: DIAGNOSTIC_ANALYSIS_REVISION, weights: normalizedWeights, overallScore, schema, content, meta, citation, evidence, ruleRecommendations, recommendations: ruleRecommendations, contentHash: crypto.createHash("sha256").update(source, "utf8").digest("hex"), contentBytes: size };
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

// Node's net.isIP() accepts both dotted and hexadecimal IPv4-mapped IPv6
// spellings (for example, ::ffff:127.0.0.1 and ::ffff:7f00:1).  Parse the
// complete IPv6 address before applying the IPv4 private/reserved ranges so
// that the hexadecimal spelling cannot bypass the SSRF guard.
function parseIpv6Hextets(address) {
  const sections = String(address).split("::");
  if (sections.length > 2) return null;
  const parseSection = (section) => {
    if (!section) return [];
    const pieces = section.split(":");
    const result = [];
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      if (piece.includes(".")) {
        if (index !== pieces.length - 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(piece)) return null;
        const octets = piece.split(".").map(Number);
        if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
        result.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(piece)) return null;
        result.push(Number.parseInt(piece, 16));
      }
    }
    return result;
  };
  const left = parseSection(sections[0]);
  const right = parseSection(sections.length === 2 ? sections[1] : "");
  if (!left || !right) return null;
  if (sections.length === 1) return left.length === 8 ? left : null;
  if (left.length + right.length >= 8) return null;
  return [...left, ...Array.from({ length: 8 - left.length - right.length }, () => 0), ...right];
}

function ipv4FromMappedIpv6(address) {
  const hextets = parseIpv6Hextets(address);
  if (!hextets) return null;
  const mapped = hextets.slice(0, 5).every((value) => value === 0) && hextets[5] === 0xffff;
  // IPv4-compatible IPv6 is deprecated, but it can still be interpreted as
  // an IPv4 destination by some stacks.  Apply the same guard to it too.
  const compatible = hextets.slice(0, 6).every((value) => value === 0);
  if (!mapped && !compatible) return null;
  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff].join(".");
}

export function isPublicAddress(address) {
  const normalized = String(address || "").toLowerCase().split("%", 1)[0];
  const family = net.isIP(normalized);
  if (family === 4) return ipv4Public(normalized);
  if (family !== 6) return false;
  const mappedIpv4 = ipv4FromMappedIpv6(normalized);
  if (mappedIpv4) return ipv4Public(mappedIpv4);
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
    }).catch((error) => {
      const cause = String(error?.message || "");
      const tlsFailure = target.protocol === "https:" && /(tls|ssl|handshake|wrong version|eproto|certificate)/i.test(cause);
      throw new MonitoringError(
        tlsFailure
          ? "HTTPS 连接失败。请确认该地址的端口已配置有效证书；如果站点只提供 HTTP，请使用 http:// 开头的公开地址。"
          : "未能读取官网页面。请确认地址、协议、端口和公网访问状态后重试。",
        tlsFailure ? 422 : 502,
        tlsFailure ? "MONITORING_FETCH_TLS" : "MONITORING_FETCH_FAILED",
        { cause }
      );
    });
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

function reportingDateValue(value, field) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const textValue = text(value, field, 10, true);
  if (!datePattern.test(textValue)) throw new MonitoringError("Dates must use YYYY-MM-DD.", 422, "MONITORING_DATE_INVALID");
  const date = new Date(`${textValue}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || dateTextFromUtc(date) !== textValue) throw new MonitoringError("The date range is invalid.", 422, "MONITORING_DATE_INVALID");
  return date;
}

function dateRange(input = {}, offsetMinutes = monitoringTimeZoneOffsetMinutes()) {
  const todayText = monitoringReportingDate(new Date(), offsetMinutes);
  const endText = input.dateTo ? text(input.dateTo, "dateTo", 10, true) : todayText;
  const endDay = reportingDateValue(endText, "dateTo");
  const startText = input.dateFrom ? text(input.dateFrom, "dateFrom", 10, true) : monitoringDateDaysBefore(endText, 6);
  const startDay = reportingDateValue(startText, "dateFrom");
  if (startDay > endDay) throw new MonitoringError("The date range is invalid.", 422, "MONITORING_DATE_INVALID");
  if ((endDay - startDay) / 86_400_000 > 366) throw new MonitoringError("The monitoring range cannot exceed 366 days.", 422, "MONITORING_DATE_RANGE_TOO_LARGE");
  const start = new Date(startDay.getTime() - offsetMinutes * 60_000);
  const end = new Date(endDay.getTime() + 86_400_000 - offsetMinutes * 60_000 - 1);
  return { start: start.toISOString(), end: end.toISOString(), dateFrom: startText, dateTo: endText, timeZoneOffsetMinutes: offsetMinutes };
}

function reportingDaySql(column = "occurred_at", offsetMinutes = monitoringTimeZoneOffsetMinutes()) {
  const modifier = `${offsetMinutes >= 0 ? "+" : ""}${offsetMinutes} minutes`;
  return `date(${column}, '${modifier}')`;
}

function publicPagePathSql(column = "path") {
  const normalized = `lower(${column})`;
  const technicalExtensions = ["ico", "xml", "txt", "json", "css", "js", "mjs", "map", "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "woff", "woff2", "ttf", "eot", "pdf", "zip", "mp3", "mp4", "webm"];
  return [
    `trim(${column}) <> ''`,
    `${normalized} NOT LIKE '/api/%'`,
    `${normalized} NOT LIKE '/health%'`,
    `${normalized} NOT LIKE '/site-assets/%'`,
    `${normalized} NOT LIKE '/assets/%'`,
    ...technicalExtensions.map((extension) => `${normalized} NOT GLOB '*.${extension}*'`)
  ].join(" AND ");
}

function successfulPublicPageSql(pathColumn = "path", statusColumn = "status_code") {
  return `${publicPagePathSql(pathColumn)} AND ${statusColumn} >= 200 AND ${statusColumn} < 300`;
}

export class MonitoringStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("MonitoringStore requires a ProductionDatabase instance.");
    this.database = database; this.connection = database.connection; this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.allowedLocalRoots = Array.isArray(options.allowedLocalRoots) ? options.allowedLocalRoots.map((item) => path.resolve(String(item))) : [];
    this.remotePorts = Array.isArray(options.remotePorts) ? options.remotePorts.map(Number).filter(Number.isInteger) : [80, 443];
    this.publisherStore = options.publisherStore || null;
    this.recommendationGenerator = typeof options.recommendationGenerator === "function" ? options.recommendationGenerator : null;
    this.diagnosticJobs = new Map();
    this.reportingTimeZoneOffsetMinutes = monitoringTimeZoneOffsetMinutes(options.reportingTimeZoneOffsetMinutes);
    this.ipSalt = String(options.ipSalt || process.env.TZ_MONITORING_IP_SALT || process.env.TZ_MASTER_KEY || "tongzhuo-monitoring-private-deployment");
  }

  reportRow(row) {
    if (!row) return null;
    const schema = json(row.schema_analysis_json); const content = json(row.content_analysis_json); const meta = json(row.meta_analysis_json); const citation = json(row.citation_analysis_json);
    const recommendations = json(row.recommendations_json);
    const overallScore = row.overall_score == null ? null : Number(row.overall_score);
    const completed = ["completed", "complete", "success", "succeeded"].includes(String(row.status || "").toLowerCase());
    const score = (value) => completed && value != null ? Number(value) : null;
    return {
      id: row.id, workspaceId: row.workspace_id, sourceKind: row.source_kind,
      sourceUrl: row.source_url, url: row.source_url, sourceLabel: row.source_label,
      status: row.status, overallScore: completed ? overallScore : null, totalScore: completed ? overallScore : null,
      scores: { schema: score(schema.score), content: score(content.score), meta: score(meta.score), authority: score(citation.score), citation: score(citation.score), preview: score(meta.previewScore ?? meta.preview_score) },
      schemaScore: score(schema.score), contentScore: score(content.score), metaScore: score(meta.score), authorityScore: score(citation.score), citationScore: score(citation.score), previewScore: score(meta.previewScore ?? meta.preview_score),
      ruleVersion: row.rule_version, weights: json(row.weights_json), schema, content, meta, citation,
      // Keep legacy reports distinguishable from the current evidence
      // contract. A missing revision means the report predates this schema;
      // silently labeling it as v2 would make its score provenance ambiguous.
      analysisRevision: schema?.evidence?.analysis_revision || schema?.analysisRevision || content?.analysisRevision || meta?.analysisRevision || citation?.analysisRevision || null,
      evidence: {
        schema: schema.evidence || {},
        content: content.evidence || {},
        meta: meta.evidence || {},
        citation: citation.evidence || {}
      },
      recommendations, recommendationSource: recommendations.recommendationSource || recommendations.source || "rules", suggestionGeneration: recommendations.generation || null,
      contentHash: row.content_hash || null, contentBytes: Number(row.content_bytes || 0),
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

  recoverInterruptedDiagnostics({ workspaceId = this.workspaceId } = {}) {
    const completedAt = now();
    const result = this.connection.prepare("UPDATE monitoring_site_reports SET status = 'failed', error_code = 'MONITORING_INTERRUPTED', error_message = 'The diagnostic worker stopped before this report completed. Please run it again.', completed_at = ? WHERE workspace_id = ? AND status IN ('pending', 'running')").run(completedAt, workspaceId);
    if (Number(result.changes || 0)) {
      appendAuditLog(this.connection, {
        actorUserId: null,
        action: "monitoring.diagnostic.interrupted",
        entityType: "monitoring_site_report",
        entityId: null,
        details: { workspaceId, recovered: Number(result.changes || 0) },
        request: null,
        createdAt: completedAt
      });
    }
    return Number(result.changes || 0);
  }

  createDiagnosticContext({ workspaceId = this.workspaceId, url = "", baseUrl = "", html = "", localDirectory = "", relativePath = "index.html", sourceLabel = "", weights = DEFAULT_DIAGNOSTIC_WEIGHTS, suggestionGeneration = null, actor = null, request = null } = {}) {
    const hasHtml = Boolean(String(html || "").trim()); const hasLocal = Boolean(String(localDirectory || "").trim()); const hasUrl = Boolean(String(url || "").trim());
    if ([hasHtml, hasLocal, hasUrl].filter(Boolean).length !== 1) throw new MonitoringError("Provide exactly one source: html, localDirectory, or url.", 422, "MONITORING_SOURCE_INVALID");
    const sourceKind = hasHtml ? "uploaded_html" : hasLocal ? "local_directory" : "remote_url";
    const reportId = id("DIAG"); const timestamp = now(); const userId = actorId(actor);
    let sourceUrl = "";
    let earlyValidationError = null;
    if (hasUrl) {
      sourceUrl = text(url, "url", 2_000, true);
      // Fail obvious unsafe targets before returning a queued report. DNS/IP
      // validation still happens again immediately before every network hop.
      try {
        const parsed = safeUrlSyntax(sourceUrl, { remote: true, allowedPorts: this.remotePorts });
        const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
        if (net.isIP(hostname) && !isPublicAddress(hostname)) {
          throw new MonitoringError("The remote URL resolves to a private, local, or reserved address.", 403, "MONITORING_SSRF_BLOCKED");
        }
      } catch (error) {
        earlyValidationError = error instanceof MonitoringError
          ? error
          : new MonitoringError("Diagnostic input validation failed.", 422, "MONITORING_INVALID_INPUT", { cause: error?.message || "" });
      }
    }
    else if (baseUrl) sourceUrl = safeUrlSyntax(baseUrl).href;
    const normalizedLabel = text(sourceLabel, "sourceLabel", 300);
    const normalizedSuggestionGeneration = normalizeSuggestionGeneration(suggestionGeneration || {});
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO monitoring_site_reports (id, workspace_id, source_kind, source_url, source_label, status, rule_version, weights_json, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`).run(reportId, workspaceId, sourceKind, sourceUrl, normalizedLabel, RULE_VERSION, JSON.stringify(normalizeWeights(weights)), timestamp, userId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "monitoring.diagnostic.create", entityType: "monitoring_site_report", entityId: reportId, details: { workspaceId, sourceKind, sourceUrl }, request, createdAt: timestamp });
    });
    if (earlyValidationError) {
      const completedAt = now();
      this.database.transaction(() => {
        this.connection.prepare("UPDATE monitoring_site_reports SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?").run(earlyValidationError.code, earlyValidationError.message.slice(0, 2_000), completedAt, reportId);
        appendAuditLog(this.connection, { actorUserId: userId, action: "monitoring.diagnostic.failed", entityType: "monitoring_site_report", entityId: reportId, details: { code: earlyValidationError.code, phase: "input_validation" }, request, createdAt: completedAt });
      });
      earlyValidationError.details = { ...(earlyValidationError.details || {}), reportId };
      throw earlyValidationError;
    }
    return { reportId, workspaceId, sourceKind, sourceUrl, sourceLabel: normalizedLabel, html, localDirectory, relativePath, weights, suggestionGeneration: normalizedSuggestionGeneration, actor, request };
  }

  async recommendationsForResult(result, context, finalUrl) {
    const ruleRecommendations = result.ruleRecommendations || result.recommendations;
    const request = context.suggestionGeneration || normalizeSuggestionGeneration();
    if (request.mode !== "llm") return ruleRecommendations;
    if (!request.providerId || !this.recommendationGenerator) {
      return ruleFallbackRecommendations(ruleRecommendations, request, new MonitoringError("No configured text-model provider was supplied for diagnostic suggestions.", 422, "MONITORING_LLM_UNAVAILABLE"));
    }
    try {
      const generated = await this.recommendationGenerator({
        workspaceId: context.workspaceId,
        reportId: context.reportId,
        sourceUrl: finalUrl || context.sourceUrl,
        providerId: request.providerId,
        model: request.model,
        analysis: {
          ruleVersion: result.ruleVersion,
          analysisRevision: result.analysisRevision,
          overallScore: result.overallScore,
          weights: result.weights,
          schema: result.schema,
          content: result.content,
          meta: result.meta,
          citation: result.citation,
          evidence: result.evidence
        },
        ruleRecommendations
      });
      return mergeModelRecommendations(ruleRecommendations, generated, request);
    } catch (error) {
      return ruleFallbackRecommendations(ruleRecommendations, request, error);
    }
  }

  async executeDiagnostic(context) {
    const { reportId, workspaceId, sourceKind, sourceUrl, sourceLabel, html, localDirectory, relativePath, weights, actor, request } = context;
    try {
      const startedAt = now(); this.connection.prepare("UPDATE monitoring_site_reports SET status = 'running', started_at = ? WHERE id = ?").run(startedAt, reportId);
      let loadedHtml = html; let finalUrl = sourceUrl; let finalLabel = sourceLabel;
      if (sourceKind === "remote_url") { const remote = await remoteHtml(sourceUrl, { allowedPorts: this.remotePorts }); loadedHtml = remote.html; finalUrl = remote.finalUrl; }
      else if (sourceKind === "local_directory") { const local = await localHtml(localDirectory, relativePath, this.allowedLocalRoots); loadedHtml = local.html; finalLabel = finalLabel || local.label; }
      const result = analyzeGeoHtml(loadedHtml, { baseUrl: finalUrl, weights });
      const recommendations = await this.recommendationsForResult(result, context, finalUrl);
      const persistedRecommendations = { ...recommendations, analysisRevision: result.analysisRevision, diagnosticEvidence: result.evidence };
      const storedSchema = { ...result.schema, analysisRevision: result.analysisRevision };
      const storedContent = { ...result.content, analysisRevision: result.analysisRevision };
      const storedMeta = { ...result.meta, analysisRevision: result.analysisRevision };
      const storedCitation = { ...result.citation, analysisRevision: result.analysisRevision };
      const completedAt = now();
      this.database.transaction(() => {
        this.connection.prepare(`UPDATE monitoring_site_reports SET source_url = ?, source_label = ?, status = 'completed', overall_score = ?, weights_json = ?, schema_analysis_json = ?, content_analysis_json = ?, meta_analysis_json = ?, citation_analysis_json = ?, recommendations_json = ?, content_hash = ?, content_bytes = ?, completed_at = ? WHERE id = ?`).run(finalUrl || "", finalLabel || "", result.overallScore, JSON.stringify(result.weights), JSON.stringify(storedSchema), JSON.stringify(storedContent), JSON.stringify(storedMeta), JSON.stringify(storedCitation), JSON.stringify(persistedRecommendations), result.contentHash, result.contentBytes, completedAt, reportId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "monitoring.diagnostic.complete", entityType: "monitoring_site_report", entityId: reportId, details: { overallScore: result.overallScore, contentHash: result.contentHash, recommendationSource: recommendations.recommendationSource || recommendations.source || "rules" }, request, createdAt: completedAt });
      });
      return this.report(workspaceId, reportId);
    } catch (error) {
      const completedAt = now(); const normalized = error instanceof MonitoringError ? error : new MonitoringError("Diagnostic processing failed.", 500, "MONITORING_DIAGNOSTIC_FAILED", { cause: error.message });
      this.database.transaction(() => {
        this.connection.prepare("UPDATE monitoring_site_reports SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?").run(normalized.code, normalized.message.slice(0, 2_000), completedAt, reportId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "monitoring.diagnostic.failed", entityType: "monitoring_site_report", entityId: reportId, details: { code: normalized.code }, request, createdAt: completedAt });
      });
      normalized.details = { ...(normalized.details || {}), reportId };
      throw normalized;
    }
  }

  async diagnose(input = {}) {
    return this.executeDiagnostic(this.createDiagnosticContext(input));
  }

  enqueueDiagnosis(input = {}) {
    const context = this.createDiagnosticContext(input);
    const report = this.report(context.workspaceId, context.reportId);
    const job = Promise.resolve().then(() => this.executeDiagnostic(context));
    this.diagnosticJobs.set(context.reportId, job);
    void job.then(
      () => this.diagnosticJobs.delete(context.reportId),
      () => this.diagnosticJobs.delete(context.reportId)
    );
    return report;
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
    const range = dateRange({ dateFrom, dateTo }, this.reportingTimeZoneOffsetMinutes);
    if (!["all", "local", "server", "channel"].includes(source)) throw new MonitoringError("Invalid log source filter.", 422, "MONITORING_FILTER_INVALID");
    if (!["all", ...TRAFFIC_TYPES].includes(trafficType)) throw new MonitoringError("Invalid traffic type filter.", 422, "MONITORING_FILTER_INVALID");
    const params = [workspaceId, range.start, range.end]; let where = "workspace_id = ? AND occurred_at BETWEEN ? AND ? AND method = 'GET'";
    if (source !== "all") { where += " AND source = ?"; params.push(source); }
    if (trafficType !== "all") { where += " AND traffic_type = ?"; params.push(trafficType); }
    if (articleId) { where += " AND article_id = ?"; params.push(articleId); }
    const pagePathWhere = `${where} AND ${publicPagePathSql()}`;
    const pageWhere = `${where} AND ${successfulPublicPageSql()}`;
    const rawKpis = this.connection.prepare(`SELECT COUNT(*) AS pv FROM monitoring_access_logs WHERE ${where}`).get(...params);
    const kpis = this.connection.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT CASE WHEN ip_hash <> '' THEN ip_hash END) AS unique_ip, SUM(CASE WHEN traffic_type = 'human' THEN 1 ELSE 0 END) AS human_pv, SUM(CASE WHEN traffic_type = 'ai_bot' THEN 1 ELSE 0 END) AS ai_bot_pv, SUM(CASE WHEN traffic_type = 'search_bot' THEN 1 ELSE 0 END) AS search_bot_pv, SUM(CASE WHEN traffic_type = 'other_bot' THEN 1 ELSE 0 END) AS other_bot_pv, SUM(CASE WHEN traffic_type = 'unknown' THEN 1 ELSE 0 END) AS unknown_pv FROM monitoring_access_logs WHERE ${pageWhere}`).get(...params);
    const errorKpis = this.connection.prepare(`SELECT COUNT(*) AS errors FROM monitoring_access_logs WHERE ${pagePathWhere} AND status_code >= 400`).get(...params);
    const reportingDay = reportingDaySql("occurred_at", this.reportingTimeZoneOffsetMinutes);
    const trendRows = this.connection.prepare(`SELECT ${reportingDay} AS day, COUNT(*) AS pv, SUM(CASE WHEN traffic_type = 'ai_bot' THEN 1 ELSE 0 END) AS ai_bot_pv FROM monitoring_access_logs WHERE ${pageWhere} GROUP BY day ORDER BY day`).all(...params);
    const trendMap = new Map(trendRows.map((row) => [row.day, { pv: Number(row.pv), aiBotPv: Number(row.ai_bot_pv || 0) }]));
    const trafficTrend = []; const cursor = new Date(`${range.dateFrom}T00:00:00.000Z`); const end = new Date(`${range.dateTo}T00:00:00.000Z`);
    while (cursor <= end) { const day = cursor.toISOString().slice(0, 10); trafficTrend.push({ date: day, ...(trendMap.get(day) || { pv: 0, aiBotPv: 0 }) }); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    const botRows = this.connection.prepare(`SELECT traffic_type, COUNT(*) AS count FROM monitoring_access_logs WHERE ${pageWhere} GROUP BY traffic_type`).all(...params); const botMap = new Map(botRows.map((row) => [row.traffic_type, Number(row.count)]));
    const topPaths = this.connection.prepare(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN ip_hash <> '' THEN ip_hash END) AS unique_ip FROM monitoring_access_logs WHERE ${pageWhere} GROUP BY path ORDER BY views DESC LIMIT 8`).all(...params).map((row) => ({ path: row.path, views: Number(row.views), uniqueIp: Number(row.unique_ip || 0) }));
    const articleWhere = pageWhere.replaceAll("workspace_id", "l.workspace_id").replaceAll("occurred_at", "l.occurred_at").replaceAll("source", "l.source").replaceAll("traffic_type", "l.traffic_type").replaceAll("article_id", "l.article_id").replaceAll("method", "l.method").replaceAll("status_code", "l.status_code").replaceAll("path", "l.path");
    const topArticles = this.connection.prepare(`SELECT l.article_id, COALESCE(a.title, l.article_id) AS title, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN l.ip_hash <> '' THEN l.ip_hash END) AS unique_ip FROM monitoring_access_logs l LEFT JOIN content_articles a ON a.id = l.article_id WHERE ${articleWhere} AND l.article_id IS NOT NULL GROUP BY l.article_id, a.title ORDER BY views DESC LIMIT 8`).all(...params).map((row) => ({ articleId: row.article_id, title: row.title, views: Number(row.views), uniqueIp: Number(row.unique_ip || 0) }));
    const normalizedKpis = {
      pv: Number(kpis?.pv || 0),
      uniqueIp: Number(kpis?.unique_ip || 0),
      humanPv: Number(kpis?.human_pv || 0),
      aiBotPv: Number(kpis?.ai_bot_pv || 0),
      searchBotPv: Number(kpis?.search_bot_pv || 0),
      otherBotPv: Number(kpis?.other_bot_pv || 0),
      unknownPv: Number(kpis?.unknown_pv || 0),
      errors: Number(errorKpis?.errors || 0),
      rawRequests: Number(rawKpis?.pv || 0),
      excludedRequests: Math.max(0, Number(rawKpis?.pv || 0) - Number(kpis?.pv || 0))
    };
    const botBreakdown = TRAFFIC_TYPES.map((key) => ({ key, count: botMap.get(key) || 0 }));
    return {
      filters: { ...range, source, trafficType, articleId: articleId || null }, hasData: normalizedKpis.pv > 0, kpis: normalizedKpis,
      pv: normalizedKpis.pv,
      trend: trafficTrend.map((item) => ({ date: item.date, pv: item.pv, totalPv: item.pv, aiBotPv: item.aiBotPv })),
      trafficTrend, botBreakdown,
      bots: botBreakdown.filter((item) => item.key !== "human" && item.key !== "unknown").map((item) => ({ name: item.key, pv: item.count })),
      topPaths: topPaths.map((item) => ({ ...item, pv: item.views })), topArticles
    };
  }

  async operationsSummary({ workspaceId = this.workspaceId, dateFrom, dateTo, businessLineId = "" } = {}) {
    const range = dateRange({ dateFrom, dateTo }, this.reportingTimeZoneOffsetMinutes); const params = [workspaceId, range.start, range.end];
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
