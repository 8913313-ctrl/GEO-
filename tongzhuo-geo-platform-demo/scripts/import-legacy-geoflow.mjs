import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ProductionDatabase } from "../production-database.mjs";
import { appendAuditLog } from "../production-audit.mjs";
import { productionConfig } from "../production-config.mjs";
import { DEFAULT_BUSINESS_RECORD_ARRAYS } from "../workspace-store.mjs";

export const LEGACY_GEOFLOW_EXPORT_FORMAT = "tongzhuo-legacy-geoflow-export-v1";

const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 15 * 1024 * 1024;
const MAX_ARTICLES = 20_000;
const MAX_CATEGORIES = 1_000;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const HTML_FORBIDDEN = /<\s*(?:script|iframe|object|embed|form|input|textarea|button|svg|math|base|meta|link|style)\b/i;
const UNSAFE_HTML_ATTRIBUTE = /\son[a-z]+\s*=|(?:href|src)\s*=\s*["']?\s*(?:javascript|data|vbscript):/i;

export class LegacyGeoFlowImportError extends Error {
  constructor(message, code = "LEGACY_IMPORT_INVALID", details = undefined) {
    super(message);
    this.name = "LegacyGeoFlowImportError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function importId(kind, workspaceId, sourceId, legacyId) {
  return `${kind}-${sha256(`${workspaceId}\u001f${sourceId}\u001f${legacyId}`).slice(0, 32)}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, field, max = 10_000) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (!result) throw new LegacyGeoFlowImportError(`${field} is required.`, "LEGACY_IMPORT_REQUIRED", { field });
  if (result.length > max) throw new LegacyGeoFlowImportError(`${field} exceeds ${max} characters.`, "LEGACY_IMPORT_TOO_LARGE", { field, max });
  return result;
}

function optionalString(value, field, max = 10_000) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (result.length > max) throw new LegacyGeoFlowImportError(`${field} exceeds ${max} characters.`, "LEGACY_IMPORT_TOO_LARGE", { field, max });
  return result;
}

function contentString(value, field) {
  const result = String(value ?? "").replace(/\u0000/g, "");
  if (result.length > 8_000_000) throw new LegacyGeoFlowImportError(`${field} exceeds 8000000 characters.`, "LEGACY_IMPORT_TOO_LARGE", { field });
  return result;
}

function optionalUrl(value, field) {
  const result = optionalString(value, field, 2_000);
  if (!result) return "";
  try {
    const url = new URL(result);
    if (!/^https?:$/.test(url.protocol)) throw new Error("protocol");
    return result;
  } catch {
    throw new LegacyGeoFlowImportError(`${field} must be an http(s) URL.`, "LEGACY_IMPORT_INVALID_URL", { field });
  }
}

function normalizeIsoTime(value, field) {
  const source = requiredString(value, field, 120);
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) throw new LegacyGeoFlowImportError(`${field} must be an ISO-8601 timestamp.`, "LEGACY_IMPORT_INVALID_TIME", { field, value: source });
  return { original: source, iso: date.toISOString() };
}

function normalizeSlug(value, field) {
  const slug = requiredString(value, field, 500);
  if (/[\u0000-\u001f\\?#]/.test(slug) || slug.split("/").some((part) => part === "." || part === "..")) {
    throw new LegacyGeoFlowImportError(`${field} contains an unsafe path segment.`, "LEGACY_IMPORT_INVALID_SLUG", { field });
  }
  return slug.replace(/^\/+|\/+$/g, "");
}

function normalizeBoolean(value, fallback) {
  return value === undefined || value === null ? fallback : Boolean(value);
}

function normalizeInteger(value, fallback, minimum = 0, maximum = 100_000) {
  if (value === undefined || value === null || value === "") return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new LegacyGeoFlowImportError("A numeric export field is outside its allowed range.", "LEGACY_IMPORT_INVALID_NUMBER", { value, minimum, maximum });
  }
  return result;
}

function stableValue(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) throw new LegacyGeoFlowImportError("metadata must contain JSON-compatible values only.", "LEGACY_IMPORT_INVALID_METADATA");
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function normalizeMetadata(value, field) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new LegacyGeoFlowImportError(`${field} must be an object.`, "LEGACY_IMPORT_INVALID_METADATA", { field });
  const result = stableValue(value);
  const encoded = JSON.stringify(result);
  if (Buffer.byteLength(encoded, "utf8") > 128_000) throw new LegacyGeoFlowImportError(`${field} exceeds 128 KB.`, "LEGACY_IMPORT_TOO_LARGE", { field });
  return result;
}

function textFromHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlFromText(value) {
  return String(value)
    .split(/\r?\n{2,}/)
    .map((part) => `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("\n");
}

function normalizeContent(value, field) {
  const html = contentString(value?.contentHtml, `${field}.contentHtml`);
  const text = contentString(value?.contentText, `${field}.contentText`);
  if (!html.trim() && !text.trim()) throw new LegacyGeoFlowImportError(`${field} requires contentHtml or contentText.`, "LEGACY_IMPORT_BODY_REQUIRED", { field });
  if (html && (HTML_FORBIDDEN.test(html) || UNSAFE_HTML_ATTRIBUTE.test(html))) {
    throw new LegacyGeoFlowImportError(`${field}.contentHtml contains unsafe active markup.`, "LEGACY_IMPORT_UNSAFE_HTML", { field });
  }
  const normalizedHtml = html || htmlFromText(text);
  const normalizedText = text || textFromHtml(normalizedHtml);
  if (!normalizedText) throw new LegacyGeoFlowImportError(`${field} does not contain readable text.`, "LEGACY_IMPORT_BODY_REQUIRED", { field });
  return {
    html: normalizedHtml,
    text: normalizedText,
    hash: sha256(JSON.stringify({ html: normalizedHtml, text: normalizedText }))
  };
}

function normalizeKeywords(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new LegacyGeoFlowImportError(`${field} must be an array.`, "LEGACY_IMPORT_INVALID_KEYWORDS", { field });
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const keyword = optionalString(item, field, 200);
    if (keyword && !seen.has(keyword)) {
      seen.add(keyword);
      result.push(keyword);
    }
  }
  if (result.length > 100) throw new LegacyGeoFlowImportError(`${field} exceeds 100 entries.`, "LEGACY_IMPORT_TOO_LARGE", { field });
  return result;
}

function normalizeCategory(raw, index) {
  if (!isPlainObject(raw)) throw new LegacyGeoFlowImportError(`categories[${index}] must be an object.`, "LEGACY_IMPORT_INVALID_CATEGORY");
  const id = requiredString(raw.id, `categories[${index}].id`, 180);
  const name = requiredString(raw.name, `categories[${index}].name`, 120);
  const slug = normalizeSlug(raw.slug, `categories[${index}].slug`);
  const parentId = optionalString(raw.parentId, `categories[${index}].parentId`, 180) || null;
  const status = optionalString(raw.status || "active", `categories[${index}].status`, 40);
  if (!["active", "archived"].includes(status)) throw new LegacyGeoFlowImportError(`categories[${index}].status must be active or archived.`, "LEGACY_IMPORT_INVALID_CATEGORY");
  return {
    id,
    name,
    slug,
    parentId,
    status,
    level: normalizeInteger(raw.level, 1, 1, 4),
    sortOrder: normalizeInteger(raw.sortOrder, index, 0),
    description: optionalString(raw.description, `categories[${index}].description`, 2_000),
    seoDescription: optionalString(raw.seoDescription, `categories[${index}].seoDescription`, 2_000),
    navVisible: normalizeBoolean(raw.navVisible, true),
    metadata: normalizeMetadata(raw.metadata, `categories[${index}].metadata`)
  };
}

function normalizeArticle(raw, index, categoriesById) {
  if (!isPlainObject(raw)) throw new LegacyGeoFlowImportError(`articles[${index}] must be an object.`, "LEGACY_IMPORT_INVALID_ARTICLE");
  const categoryId = requiredString(raw.categoryId, `articles[${index}].categoryId`, 180);
  const category = categoriesById.get(categoryId);
  if (!category) throw new LegacyGeoFlowImportError(`articles[${index}].categoryId does not exist in categories.`, "LEGACY_IMPORT_UNKNOWN_CATEGORY", { categoryId });
  const published = normalizeIsoTime(raw.publishedAt, `articles[${index}].publishedAt`);
  const body = normalizeContent(raw, `articles[${index}]`);
  const title = requiredString(raw.title, `articles[${index}].title`, 300);
  const slug = normalizeSlug(raw.slug, `articles[${index}].slug`);
  const excerpt = optionalString(raw.excerpt, `articles[${index}].excerpt`, 2_000);
  const id = requiredString(raw.id, `articles[${index}].id`, 180);
  const keywords = normalizeKeywords(raw.keywords, `articles[${index}].keywords`);
  const normalized = {
    id,
    title,
    slug,
    categoryId,
    categoryName: category.name,
    categorySlug: category.slug,
    body,
    excerpt,
    keywords,
    publishedAt: published.iso,
    originalPublishedAt: published.original,
    sourceUrl: optionalUrl(raw.sourceUrl, `articles[${index}].sourceUrl`),
    author: optionalString(raw.author, `articles[${index}].author`, 300),
    metadata: normalizeMetadata(raw.metadata, `articles[${index}].metadata`)
  };
  normalized.fingerprint = sha256(JSON.stringify({
    id: normalized.id,
    title: normalized.title,
    slug: normalized.slug,
    categoryId: normalized.categoryId,
    bodyHash: normalized.body.hash,
    excerpt: normalized.excerpt,
    keywords: normalized.keywords,
    publishedAt: normalized.publishedAt,
    sourceUrl: normalized.sourceUrl,
    author: normalized.author,
    metadata: normalized.metadata
  }));
  return normalized;
}

export function normalizeLegacyGeoFlowExport(payload) {
  if (!isPlainObject(payload)) throw new LegacyGeoFlowImportError("Legacy export must be a JSON object.", "LEGACY_IMPORT_INVALID_EXPORT");
  if (payload.format !== LEGACY_GEOFLOW_EXPORT_FORMAT) {
    throw new LegacyGeoFlowImportError(`Unsupported export format. Expected ${LEGACY_GEOFLOW_EXPORT_FORMAT}.`, "LEGACY_IMPORT_FORMAT_UNSUPPORTED");
  }
  if (!isPlainObject(payload.source)) throw new LegacyGeoFlowImportError("source must be an object.", "LEGACY_IMPORT_INVALID_SOURCE");
  const sourceId = requiredString(payload.source.id, "source.id", 120);
  if (!SOURCE_ID_PATTERN.test(sourceId)) throw new LegacyGeoFlowImportError("source.id may contain only letters, numbers, dot, underscore, colon, and hyphen.", "LEGACY_IMPORT_INVALID_SOURCE");
  const exported = normalizeIsoTime(payload.exportedAt, "exportedAt");
  if (!Array.isArray(payload.categories) || payload.categories.length > MAX_CATEGORIES) throw new LegacyGeoFlowImportError(`categories must be an array with at most ${MAX_CATEGORIES} items.`, "LEGACY_IMPORT_INVALID_EXPORT");
  if (!Array.isArray(payload.articles) || payload.articles.length > MAX_ARTICLES) throw new LegacyGeoFlowImportError(`articles must be an array with at most ${MAX_ARTICLES} items.`, "LEGACY_IMPORT_INVALID_EXPORT");
  const categories = payload.categories.map(normalizeCategory);
  const categoryIds = new Set(); const categorySlugs = new Set();
  for (const category of categories) {
    if (categoryIds.has(category.id)) throw new LegacyGeoFlowImportError(`Duplicate category id: ${category.id}.`, "LEGACY_IMPORT_DUPLICATE_CATEGORY");
    if (categorySlugs.has(category.slug)) throw new LegacyGeoFlowImportError(`Duplicate category slug: ${category.slug}.`, "LEGACY_IMPORT_DUPLICATE_CATEGORY");
    categoryIds.add(category.id); categorySlugs.add(category.slug);
  }
  for (const category of categories) {
    if (category.parentId && !categoryIds.has(category.parentId)) throw new LegacyGeoFlowImportError(`Category ${category.id} references an unknown parentId.`, "LEGACY_IMPORT_UNKNOWN_CATEGORY", { categoryId: category.id, parentId: category.parentId });
  }
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const articles = payload.articles.map((article, index) => normalizeArticle(article, index, categoriesById));
  const articleIds = new Set(); const articleSlugs = new Set();
  for (const article of articles) {
    if (articleIds.has(article.id)) throw new LegacyGeoFlowImportError(`Duplicate article id: ${article.id}.`, "LEGACY_IMPORT_DUPLICATE_ARTICLE");
    if (articleSlugs.has(article.slug)) throw new LegacyGeoFlowImportError(`Duplicate article slug: ${article.slug}.`, "LEGACY_IMPORT_DUPLICATE_ARTICLE");
    articleIds.add(article.id); articleSlugs.add(article.slug);
  }
  const normalized = {
    format: LEGACY_GEOFLOW_EXPORT_FORMAT,
    exportedAt: exported.iso,
    originalExportedAt: exported.original,
    source: {
      id: sourceId,
      system: optionalString(payload.source.system || "GEOFlow", "source.system", 120),
      baseUrl: optionalUrl(payload.source.baseUrl, "source.baseUrl"),
      metadata: normalizeMetadata(payload.source.metadata, "source.metadata")
    },
    categories,
    articles
  };
  normalized.fingerprint = sha256(JSON.stringify({
    format: normalized.format,
    exportedAt: normalized.exportedAt,
    source: normalized.source,
    categories: normalized.categories,
    articles: normalized.articles.map(({ body, ...article }) => ({ ...article, bodyHash: body.hash }))
  }));
  return normalized;
}

function parseStoredJson(value, field) {
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw new LegacyGeoFlowImportError(`${field} is corrupt and cannot be safely changed.`, "LEGACY_IMPORT_STATE_CORRUPT", { field });
  }
}

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = object;
  for (const part of parts.slice(0, -1)) {
    if (current[part] === undefined) current[part] = {};
    if (!isPlainObject(current[part])) throw new LegacyGeoFlowImportError(`Workspace field ${dottedPath} has an incompatible shape.`, "LEGACY_IMPORT_WORKSPACE_SHAPE");
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((result, key) => result?.[key], object);
}

function createWorkspaceSkeleton() {
  const state = {};
  for (const dottedPath of Object.values(DEFAULT_BUSINESS_RECORD_ARRAYS)) setPath(state, dottedPath, []);
  state.site = { cms: { categories: [], legacyImports: [] } };
  return state;
}

function ensureWorkspaceShape(state) {
  if (!isPlainObject(state)) throw new LegacyGeoFlowImportError("Workspace state must be a JSON object.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
  for (const dottedPath of Object.values(DEFAULT_BUSINESS_RECORD_ARRAYS)) {
    const value = getPath(state, dottedPath);
    if (value === undefined) setPath(state, dottedPath, []);
    else if (!Array.isArray(value)) throw new LegacyGeoFlowImportError(`Workspace field ${dottedPath} must be an array.`, "LEGACY_IMPORT_WORKSPACE_SHAPE");
  }
  if (state.site === undefined) state.site = {};
  if (!isPlainObject(state.site)) throw new LegacyGeoFlowImportError("Workspace field site must be an object.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
  if (state.site.cms === undefined) state.site.cms = {};
  if (!isPlainObject(state.site.cms)) throw new LegacyGeoFlowImportError("Workspace field site.cms must be an object.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
  if (state.site.cms.categories === undefined) state.site.cms.categories = [];
  if (!Array.isArray(state.site.cms.categories)) throw new LegacyGeoFlowImportError("Workspace field site.cms.categories must be an array.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
  if (state.site.cms.legacyImports === undefined) state.site.cms.legacyImports = [];
  if (!Array.isArray(state.site.cms.legacyImports)) throw new LegacyGeoFlowImportError("Workspace field site.cms.legacyImports must be an array.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
  return state;
}

function workspaceCategoryProvenance(category) {
  return category?.legacyImport && isPlainObject(category.legacyImport) ? category.legacyImport : {};
}

function categoryCountByLegacyId(articles) {
  const counts = new Map();
  for (const article of articles) counts.set(article.categoryId, Number(counts.get(article.categoryId) || 0) + 1);
  return counts;
}

function applyCategoriesToWorkspace(state, exportData, workspaceId, importedAt) {
  const cms = state.site.cms;
  const categories = cms.categories;
  const existingByProvenance = new Map();
  const existingBySlug = new Map();
  for (const category of categories) {
    if (!isPlainObject(category)) throw new LegacyGeoFlowImportError("site.cms.categories contains an invalid entry.", "LEGACY_IMPORT_WORKSPACE_SHAPE");
    const provenance = workspaceCategoryProvenance(category);
    if (provenance.sourceId && provenance.sourceCategoryId) existingByProvenance.set(`${provenance.sourceId}\u001f${provenance.sourceCategoryId}`, category);
    if (category.slug) {
      const slug = String(category.slug);
      if (existingBySlug.has(slug)) throw new LegacyGeoFlowImportError(`Workspace already contains more than one category with slug ${slug}.`, "LEGACY_IMPORT_CATEGORY_CONFLICT", { slug });
      existingBySlug.set(slug, category);
    }
  }
  const counts = categoryCountByLegacyId(exportData.articles);
  const mappings = new Map();
  const additions = [];
  for (const sourceCategory of exportData.categories) {
    const sourceKey = `${exportData.source.id}\u001f${sourceCategory.id}`;
    const existing = existingByProvenance.get(sourceKey) || existingBySlug.get(sourceCategory.slug);
    if (existing) {
      mappings.set(sourceCategory.id, String(existing.id));
      continue;
    }
    const id = importId("LEGACY-CAT", workspaceId, exportData.source.id, sourceCategory.id);
    mappings.set(sourceCategory.id, id);
    additions.push({ sourceCategory, id });
  }
  for (const { sourceCategory, id } of additions) {
    categories.push({
      id,
      name: sourceCategory.name,
      slug: sourceCategory.slug,
      level: sourceCategory.level,
      parentId: sourceCategory.parentId ? mappings.get(sourceCategory.parentId) || null : null,
      count: Number(counts.get(sourceCategory.id) || 0),
      status: sourceCategory.status,
      description: sourceCategory.description,
      navVisible: sourceCategory.navVisible,
      seoDescription: sourceCategory.seoDescription,
      sortOrder: sourceCategory.sortOrder,
      metadata: sourceCategory.metadata,
      legacyImport: {
        contract: LEGACY_GEOFLOW_EXPORT_FORMAT,
        sourceId: exportData.source.id,
        sourceCategoryId: sourceCategory.id,
        importedAt
      }
    });
  }
  for (const sourceCategory of exportData.categories) {
    const seen = new Set([sourceCategory.id]);
    let cursor = sourceCategory.parentId;
    while (cursor) {
      if (seen.has(cursor)) throw new LegacyGeoFlowImportError(`Category ${sourceCategory.id} has a parent cycle.`, "LEGACY_IMPORT_CATEGORY_CYCLE", { categoryId: sourceCategory.id });
      seen.add(cursor);
      cursor = exportData.categories.find((item) => item.id === cursor)?.parentId || null;
    }
  }
  return { mappings, added: additions.length };
}

function rowProvenance(row) {
  try {
    const metadata = JSON.parse(row.metadata_json || "{}");
    return metadata?.legacyImport && isPlainObject(metadata.legacyImport) ? metadata.legacyImport : {};
  } catch {
    return {};
  }
}

function rowMetadata(row) {
  try {
    const metadata = JSON.parse(row.metadata_json || "{}");
    return isPlainObject(metadata) ? metadata : {};
  } catch {
    return {};
  }
}

function articleMetadata(article, exportData, workspaceCategoryId, importedAt) {
  return {
    ...article.metadata,
    keywords: article.keywords,
    slug: article.slug,
    publishedAt: article.publishedAt,
    legacyImport: {
      contract: LEGACY_GEOFLOW_EXPORT_FORMAT,
      sourceId: exportData.source.id,
      sourceSystem: exportData.source.system || "GEOFlow",
      sourceArticleId: article.id,
      sourceCategoryId: article.categoryId,
      sourceUrl: article.sourceUrl || null,
      author: article.author || null,
      workspaceCategoryId,
      publishedAt: article.publishedAt,
      originalPublishedAt: article.originalPublishedAt,
      exportFingerprint: exportData.fingerprint,
      articleFingerprint: article.fingerprint,
      importedAt
    }
  };
}

function buildPlan(connection, exportData, options) {
  const workspaceId = options.workspaceId;
  const workspaceRow = connection?.prepare("SELECT * FROM workspace_state WHERE workspace_id = ?").get(workspaceId) || null;
  if (!workspaceRow && !options.initializeWorkspace) {
    throw new LegacyGeoFlowImportError("Workspace is not initialized. Initialize the system first, or explicitly pass --initialize-workspace for an empty database.", "LEGACY_IMPORT_WORKSPACE_REQUIRED", { workspaceId });
  }
  const state = ensureWorkspaceShape(workspaceRow ? structuredClone(parseStoredJson(workspaceRow.state_json, "workspace_state.state_json")) : createWorkspaceSkeleton());
  const imports = state.site.cms.legacyImports;
  const existingImport = imports.find((item) => isPlainObject(item) && item.sourceId === exportData.source.id);
  if (existingImport && existingImport.exportFingerprint !== exportData.fingerprint) {
    throw new LegacyGeoFlowImportError("This source.id was already imported with different data. Use a new source.id for a new immutable migration batch.", "LEGACY_IMPORT_SOURCE_CHANGED", { sourceId: exportData.source.id });
  }
  const importedAt = new Date().toISOString();
  const categories = applyCategoriesToWorkspace(state, exportData, workspaceId, importedAt);
  const originalStateJson = workspaceRow?.state_json || "";
  const articlePlans = [];
  for (const article of exportData.articles) {
    const articleId = importId("LEGACY-ART", workspaceId, exportData.source.id, article.id);
    const versionId = importId("LEGACY-ARTV", workspaceId, exportData.source.id, article.id);
    const existing = connection?.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, articleId) || null;
    const slugOwner = connection?.prepare("SELECT id FROM content_articles WHERE workspace_id = ? AND status <> 'archived' AND json_extract(metadata_json, '$.slug') = ? LIMIT 1").get(workspaceId, article.slug) || null;
    if (slugOwner && slugOwner.id !== articleId) {
      throw new LegacyGeoFlowImportError("An existing article already owns this public slug. The import will not create an ambiguous website route.", "LEGACY_IMPORT_SLUG_CONFLICT", { slug: article.slug, existingArticleId: slugOwner.id, sourceArticleId: article.id });
    }
    if (existing) {
      const provenance = rowProvenance(existing);
      const metadata = rowMetadata(existing);
      const version = connection.prepare("SELECT id, content_hash, source, review_status, frozen_at FROM content_article_versions WHERE id = ? AND article_id = ?").get(existing.current_version_id, articleId);
      const sameKeywords = JSON.stringify(metadata.keywords || []) === JSON.stringify(article.keywords);
      if (provenance.sourceId !== exportData.source.id || provenance.sourceArticleId !== article.id || provenance.articleFingerprint !== article.fingerprint || existing.title !== article.title || existing.category !== article.categoryName || existing.status !== "published" || existing.current_version_id !== versionId || existing.approved_version_id !== versionId || metadata.slug !== article.slug || metadata.publishedAt !== article.publishedAt || !sameKeywords || version?.id !== versionId || version.content_hash !== article.body.hash || version.source !== "import" || version.review_status !== "approved" || !version.frozen_at) {
        throw new LegacyGeoFlowImportError("An existing article conflicts with this immutable legacy import. Existing published records are never overwritten.", "LEGACY_IMPORT_ARTICLE_CONFLICT", { articleId, sourceArticleId: article.id });
      }
      articlePlans.push({ article, articleId, versionId, workspaceCategoryId: categories.mappings.get(article.categoryId), action: "skipped" });
    } else {
      articlePlans.push({ article, articleId, versionId, workspaceCategoryId: categories.mappings.get(article.categoryId), action: "created" });
    }
  }
  const newImportRecord = !existingImport;
  if (newImportRecord) {
    imports.push({
      sourceId: exportData.source.id,
      sourceSystem: exportData.source.system || "GEOFlow",
      contract: LEGACY_GEOFLOW_EXPORT_FORMAT,
      exportFingerprint: exportData.fingerprint,
      exportedAt: exportData.exportedAt,
      originalExportedAt: exportData.originalExportedAt,
      importedAt,
      categoryCount: exportData.categories.length,
      articleCount: exportData.articles.length
    });
  }
  const serializedState = JSON.stringify(state);
  const workspaceChanged = !workspaceRow || serializedState !== originalStateJson;
  if (Buffer.byteLength(serializedState, "utf8") > Number(options.workspaceMaxBytes || MAX_WORKSPACE_BYTES)) {
    throw new LegacyGeoFlowImportError("Import would exceed the workspace size limit.", "LEGACY_IMPORT_WORKSPACE_TOO_LARGE", { bytes: Buffer.byteLength(serializedState, "utf8") });
  }
  return {
    workspaceId,
    workspaceRow,
    expectedWorkspaceRevision: Number(workspaceRow?.revision || 0),
    state,
    serializedState,
    stateChecksum: sha256(serializedState),
    importedAt,
    categories,
    articlePlans,
    workspaceChanged,
    createdArticles: articlePlans.filter((item) => item.action === "created").length,
    skippedArticles: articlePlans.filter((item) => item.action === "skipped").length
  };
}

function persistPlan(database, plan, exportData) {
  const connection = database.connection;
  const now = plan.importedAt;
  database.transaction(() => {
    const current = connection.prepare("SELECT revision, created_at FROM workspace_state WHERE workspace_id = ?").get(plan.workspaceId);
    if (Number(current?.revision || 0) !== plan.expectedWorkspaceRevision) {
      throw new LegacyGeoFlowImportError("Workspace changed during import. Re-run after reviewing the latest workspace state.", "LEGACY_IMPORT_WORKSPACE_CONFLICT", { expectedRevision: plan.expectedWorkspaceRevision, currentRevision: Number(current?.revision || 0) });
    }
    for (const item of plan.articlePlans.filter((candidate) => candidate.action === "created")) {
      const { article, articleId, versionId, workspaceCategoryId } = item;
      const metadata = articleMetadata(article, exportData, workspaceCategoryId, now);
      const metadataJson = JSON.stringify(metadata);
      const riskId = importId("LEGACY-RISK", plan.workspaceId, exportData.source.id, article.id);
      const submittedReviewId = importId("LEGACY-REV-SUB", plan.workspaceId, exportData.source.id, article.id);
      const approvedReviewId = importId("LEGACY-REV-APP", plan.workspaceId, exportData.source.id, article.id);
      connection.prepare(`INSERT INTO content_articles (id, workspace_id, task_id, plan_id, topic_id, business_line_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, NULL, NULL, NULL, NULL, ?, ?, 'published', ?, ?, 1, ?, ?, ?, NULL, NULL)`).run(
        articleId, plan.workspaceId, article.title, article.categoryName, versionId, versionId, metadataJson, article.publishedAt, article.publishedAt
      );
      connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, based_on_version_id, title, content_html, content_text, excerpt, content_hash, source, generation_job_id, review_status, risk_status, metadata_json, frozen_at, frozen_by, created_at, created_by)
        VALUES (?, ?, 1, NULL, ?, ?, ?, ?, ?, 'import', NULL, 'approved', 'warning', ?, ?, NULL, ?, NULL)`).run(
        versionId, articleId, article.title, article.body.html, article.body.text, article.excerpt, article.body.hash, metadataJson, article.publishedAt, article.publishedAt
      );
      connection.prepare(`INSERT INTO content_risk_scan_runs (id, article_version_id, status, policy_version, findings_json, summary_json, error_code, error_message, created_at, started_at, completed_at, created_by)
        VALUES (?, ?, 'warning', 'legacy-import-v1', ?, ?, NULL, NULL, ?, ?, ?, NULL)`).run(
        riskId,
        versionId,
        JSON.stringify([{ code: "LEGACY_IMPORT_REVIEW", severity: "warning", message: "Legacy published content passed structural import checks but has not been re-reviewed by the current risk policy." }]),
        JSON.stringify({ imported: true, structuralSafetyChecked: true, contentLength: article.body.text.length }),
        article.publishedAt,
        article.publishedAt,
        article.publishedAt
      );
      connection.prepare(`INSERT INTO content_article_reviews (id, article_version_id, review_round, action, from_status, to_status, note, details_json, created_at, actor_user_id)
        VALUES (?, ?, 1, 'submitted', 'draft', 'pending', ?, ?, ?, NULL),
                (?, ?, 2, 'approved', 'pending', 'approved', ?, ?, ?, NULL)`).run(
        submittedReviewId,
        versionId,
        "Historical published article imported from the legacy GEOFlow website.",
        JSON.stringify({ imported: true, sourceId: exportData.source.id }),
        article.publishedAt,
        approvedReviewId,
        versionId,
        "Historical publication preserved as an approved frozen version; re-review before substantive reuse.",
        JSON.stringify({ imported: true, sourceId: exportData.source.id }),
        article.publishedAt
      );
      appendAuditLog(connection, {
        action: "content.article.legacy_import",
        entityType: "content_article",
        entityId: articleId,
        details: { sourceId: exportData.source.id, sourceArticleId: article.id, sourceUrl: article.sourceUrl || null, versionId, publishedAt: article.publishedAt },
        createdAt: now
      });
    }
    if (plan.workspaceChanged) {
      const revision = plan.expectedWorkspaceRevision + 1;
      if (current) {
        connection.prepare("UPDATE workspace_state SET revision = ?, state_json = ?, checksum = ?, updated_at = ?, updated_by = NULL WHERE workspace_id = ?").run(revision, plan.serializedState, plan.stateChecksum, now, plan.workspaceId);
      } else {
        connection.prepare("INSERT INTO workspace_state (workspace_id, revision, state_json, checksum, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, NULL)").run(plan.workspaceId, revision, plan.serializedState, plan.stateChecksum, now, now);
      }
      connection.prepare("INSERT INTO workspace_revisions (workspace_id, revision, state_json, checksum, created_at, updated_by) VALUES (?, ?, ?, ?, ?, NULL)").run(plan.workspaceId, revision, plan.serializedState, plan.stateChecksum, now);
      appendAuditLog(connection, {
        action: "workspace.legacy_geoflow_import",
        entityType: "workspace",
        entityId: plan.workspaceId,
        details: { sourceId: exportData.source.id, exportFingerprint: exportData.fingerprint, categoriesAdded: plan.categories.added, articlesCreated: plan.createdArticles, articlesSkipped: plan.skippedArticles, previousRevision: plan.expectedWorkspaceRevision, revision },
        createdAt: now
      });
    }
  });
}

function readDatabasePlan(database, exportData, options) {
  return buildPlan(database?.connection || null, exportData, options);
}

export async function importLegacyGeoFlowExport({ data, database = null, databasePath = productionConfig.databasePath, workspaceId = productionConfig.workspaceId, initializeWorkspace = false, dryRun = false, workspaceMaxBytes = MAX_WORKSPACE_BYTES } = {}) {
  const exportData = normalizeLegacyGeoFlowExport(data);
  const options = { workspaceId: requiredString(workspaceId, "workspaceId", 120), initializeWorkspace: Boolean(initializeWorkspace), workspaceMaxBytes };
  let ownDatabase = null;
  let readOnlyDatabase = null;
  try {
    if (!database && dryRun && !existsSync(databasePath)) {
      if (!options.initializeWorkspace) throw new LegacyGeoFlowImportError("Database and workspace do not exist. Pass --initialize-workspace only when intentionally creating a brand-new system.", "LEGACY_IMPORT_WORKSPACE_REQUIRED");
      const plan = buildPlan(null, exportData, options);
      return { dryRun: true, sourceId: exportData.source.id, exportFingerprint: exportData.fingerprint, categoriesAdded: plan.categories.added, articlesCreated: plan.createdArticles, articlesSkipped: plan.skippedArticles, workspaceWouldChange: plan.workspaceChanged };
    }
    if (!database) {
      if (dryRun) {
        readOnlyDatabase = new DatabaseSync(databasePath, { readOnly: true });
        database = { connection: readOnlyDatabase };
      } else {
        ownDatabase = new ProductionDatabase({ databasePath });
        database = ownDatabase;
      }
    }
    if (!database?.connection) throw new TypeError("database must expose a SQLite connection.");
    const plan = readDatabasePlan(database, exportData, options);
    const summary = {
      dryRun: Boolean(dryRun),
      sourceId: exportData.source.id,
      exportFingerprint: exportData.fingerprint,
      categoriesAdded: plan.categories.added,
      articlesCreated: plan.createdArticles,
      articlesSkipped: plan.skippedArticles,
      workspaceChanged: plan.workspaceChanged,
      workspaceRevision: plan.workspaceChanged ? plan.expectedWorkspaceRevision + 1 : plan.expectedWorkspaceRevision,
      articleIds: plan.articlePlans.map((item) => item.articleId)
    };
    if (!dryRun) persistPlan(database, plan, exportData);
    return summary;
  } finally {
    readOnlyDatabase?.close();
    ownDatabase?.close();
  }
}

async function readExportFile(filePath) {
  const resolved = path.resolve(filePath);
  const data = await readFile(resolved);
  if (data.byteLength > MAX_EXPORT_BYTES) throw new LegacyGeoFlowImportError(`Export file exceeds ${MAX_EXPORT_BYTES} bytes.`, "LEGACY_IMPORT_TOO_LARGE");
  try {
    return JSON.parse(data.toString("utf8"));
  } catch {
    throw new LegacyGeoFlowImportError("Export file is not valid UTF-8 JSON.", "LEGACY_IMPORT_INVALID_JSON");
  }
}

function parseCliArguments(argv) {
  const options = { input: "", databasePath: productionConfig.databasePath, workspaceId: productionConfig.workspaceId, dryRun: false, initializeWorkspace: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") options.input = argv[++index] || "";
    else if (value === "--database") options.databasePath = argv[++index] || "";
    else if (value === "--workspace") options.workspaceId = argv[++index] || "";
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--initialize-workspace") options.initializeWorkspace = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else throw new LegacyGeoFlowImportError(`Unknown argument: ${value}`, "LEGACY_IMPORT_INVALID_ARGUMENT");
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/import-legacy-geoflow.mjs --input legacy-export.json [--database path] [--workspace deployment-id] [--dry-run] [--initialize-workspace]",
    "",
    "The import is immutable and additive. It imports only categories and published articles; it never overwrites an existing article."
  ].join("\n");
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      if (!options.input) throw new LegacyGeoFlowImportError("--input is required.", "LEGACY_IMPORT_REQUIRED");
      const data = await readExportFile(options.input);
      const result = await importLegacyGeoFlowExport({ data, databasePath: options.databasePath, workspaceId: options.workspaceId, dryRun: options.dryRun, initializeWorkspace: options.initializeWorkspace });
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`${error.code || "LEGACY_IMPORT_FAILED"}: ${error.message}`);
    process.exitCode = 1;
  }
}
