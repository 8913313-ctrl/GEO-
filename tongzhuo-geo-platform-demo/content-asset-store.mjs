import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { appendAuditLog } from "./production-audit.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const MAX_URL_LENGTH = 4_096;
const MAX_BODY_BYTES = 2_000_000;
const TRACKING_PARAMETERS = new Set(["fbclid", "gclid", "dclid", "msclkid", "yclid"]);

export class ContentAssetError extends Error {
  constructor(message, status = 422, code = "CONTENT_ASSET_ERROR", details = undefined) {
    super(message);
    this.name = "ContentAssetError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function clean(value, field, maximum = 300, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new ContentAssetError(`${field} is required.`, 422, "CONTENT_ASSET_INVALID_INPUT", { field });
  if (result.length > maximum) throw new ContentAssetError(`${field} exceeds ${maximum} characters.`, 422, "CONTENT_ASSET_INVALID_INPUT", { field, maximum });
  return result;
}
function parseJson(value, fallback = {}) { try { const parsed = JSON.parse(value || "null"); return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } }
function iso(value, field = "date") {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new ContentAssetError(`${field} must be an ISO date.`, 422, "CONTENT_ASSET_INVALID_INPUT", { field });
  return new Date(time).toISOString();
}

export function normalizeContentAssetUrl(value) {
  const raw = clean(value, "url", MAX_URL_LENGTH, true);
  let url;
  try { url = new URL(raw); } catch { throw new ContentAssetError("URL format is invalid.", 422, "CONTENT_ASSET_URL_INVALID"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) {
    throw new ContentAssetError("Only credential-free HTTP(S) URLs are allowed.", 422, "CONTENT_ASSET_URL_INVALID");
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.hash = "";
  return url.toString();
}

function blockedIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && [18, 19].includes(b));
}

function blockedIp(address) {
  const normalized = String(address || "").toLowerCase().replace(/^\[|\]$/g, "");
  const version = net.isIP(normalized);
  if (version === 4) return blockedIpv4(normalized);
  if (version !== 6) return true;
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? blockedIpv4(mapped[1]) : false;
}

async function assertPublicTarget(value, lookup = dns.lookup) {
  const normalized = normalizeContentAssetUrl(value);
  const url = new URL(normalized);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new ContentAssetError("Private or local publication URLs are blocked.", 422, "CONTENT_ASSET_URL_BLOCKED");
  }
  const literalVersion = net.isIP(hostname);
  const addresses = literalVersion ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new ContentAssetError("Publication host could not be resolved.", 422, "CONTENT_ASSET_URL_UNRESOLVED");
  if (addresses.some((entry) => blockedIp(entry.address))) throw new ContentAssetError("Private or local publication addresses are blocked.", 422, "CONTENT_ASSET_URL_BLOCKED");
  return normalized;
}

async function readLimitedBody(response, maximum = MAX_BODY_BYTES) {
  if (!response.body?.getReader) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel("body limit reached").catch(() => {});
      throw new ContentAssetError("Publication response exceeds the inspection limit.", 422, "CONTENT_ASSET_BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function declaredCanonical(body, contentType, baseUrl) {
  if (!/html/i.test(contentType || "") || !body.byteLength) return null;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(body);
  const match = text.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i);
  if (!match) return null;
  try { return normalizeContentAssetUrl(new URL(match[1] || match[2], baseUrl).toString()); } catch { return null; }
}

export async function inspectContentAssetUrl(value, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new ContentAssetError("Fetch is unavailable.", 503, "CONTENT_ASSET_FETCH_UNAVAILABLE");
  let current = normalizeContentAssetUrl(value);
  let redirects = 0;
  for (;;) {
    current = await assertPublicTarget(current, options.lookup || dns.lookup);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Number(options.timeoutMs || 8_000)));
    let response;
    try {
      response = await fetchImpl(current, { method: "GET", redirect: "manual", signal: controller.signal, headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1", "User-Agent": "Tongzhuo-Content-Asset-Monitor/1.0" } });
    } catch (error) {
      throw new ContentAssetError(error?.name === "AbortError" ? "Publication check timed out." : "Publication URL is unreachable.", 422, error?.name === "AbortError" ? "CONTENT_ASSET_TIMEOUT" : "CONTENT_ASSET_UNREACHABLE");
    } finally {
      clearTimeout(timeout);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      if (++redirects > 4) throw new ContentAssetError("Publication has too many redirects.", 422, "CONTENT_ASSET_REDIRECT_LIMIT");
      current = new URL(response.headers.get("location"), current).toString();
      continue;
    }
    const contentType = String(response.headers.get("content-type") || "").slice(0, 200);
    const body = await readLimitedBody(response, Number(options.maxBodyBytes || MAX_BODY_BYTES));
    const hash = body.byteLength ? crypto.createHash("sha256").update(body).digest("hex") : null;
    const priorHash = String(options.priorHash || "");
    const healthy = response.status >= 200 && response.status < 300;
    return {
      resolvedUrl: normalizeContentAssetUrl(current),
      declaredCanonicalUrl: declaredCanonical(body, contentType, current),
      healthStatus: healthy ? (priorHash && hash && priorHash !== hash ? "changed" : redirects ? "redirected" : "healthy") : "unreachable",
      httpStatus: response.status,
      contentType: contentType || null,
      contentHash: hash,
      redirects
    };
  }
}

function publicationRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    articleId: row.article_id,
    articleVersionId: row.article_version_id || null,
    publisherJobId: row.publisher_job_id || null,
    platform: row.platform_code,
    platformName: row.platform_name,
    source: row.source,
    url: row.url,
    canonicalUrl: row.canonical_url,
    resolvedUrl: row.resolved_url || null,
    declaredCanonicalUrl: row.declared_canonical_url || null,
    status: row.status,
    healthStatus: row.health_status,
    httpStatus: row.http_status === null ? null : Number(row.http_status),
    contentType: row.content_type || null,
    contentHash: row.content_hash || null,
    lastErrorCode: row.last_error_code || null,
    lastErrorMessage: row.last_error_message || null,
    publishedAt: row.published_at || null,
    lastCheckedAt: row.last_checked_at || null,
    nextCheckAt: row.next_check_at || null,
    consecutiveFailures: Number(row.consecutive_failures || 0),
    lastHealthyAt: row.last_healthy_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

function assetRow(row, publications = []) {
  return { id: row.id, workspaceId: row.workspace_id, articleId: row.article_id, title: row.title_snapshot, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, publications };
}

function citationRow(row) {
  return {
    id: row.id, assetId: row.asset_id, publicationId: row.publication_id, articleId: row.article_id,
    evidenceId: row.evidence_id, diagnosticRunId: row.diagnostic_run_id, questionId: row.question_id || null,
    question: row.question_text || "", platform: row.platform_code || "", terminal: row.terminal_code || "", mode: row.mode_code || "",
    sourceUrl: row.source_url, canonicalSourceUrl: row.canonical_source_url, sourceTitle: row.source_title || "",
    sourceRank: row.source_rank === null ? null : Number(row.source_rank), matchKind: row.match_kind, observedAt: row.observed_at,
    createdAt: row.created_at, metadata: parseJson(row.metadata_json, {})
  };
}

function alertRow(row) {
  return {
    id: row.id, assetId: row.asset_id, publicationId: row.publication_id || null, type: row.alert_type,
    severity: row.severity, status: row.status, title: row.title, message: row.message || "", details: parseJson(row.details_json, {}),
    firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, resolvedAt: row.resolved_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export class ContentAssetStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("ContentAssetStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.lookup = options.lookup || dns.lookup;
  }

  article(workspaceId, articleId) {
    const row = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, clean(articleId, "articleId", 180, true));
    if (!row) throw new ContentAssetError("Content article was not found.", 404, "CONTENT_ASSET_ARTICLE_NOT_FOUND", { articleId });
    return row;
  }

  ensureAsset({ workspaceId = this.workspaceId, articleId, actor = null, request = null } = {}) {
    const article = this.article(workspaceId, articleId);
    let row = this.connection.prepare("SELECT * FROM content_assets WHERE workspace_id = ? AND article_id = ?").get(workspaceId, article.id);
    if (row) {
      if (row.title_snapshot !== article.title) {
        const timestamp = now();
        this.connection.prepare("UPDATE content_assets SET title_snapshot = ?, updated_at = ?, updated_by = ? WHERE id = ?").run(article.title, timestamp, actorId(actor), row.id);
        row = this.connection.prepare("SELECT * FROM content_assets WHERE id = ?").get(row.id);
      }
      return this._assetPayload(row);
    }
    const assetId = id("CASSET");
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO content_assets (id, workspace_id, article_id, title_snapshot, status, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, 'tracking', ?, ?, ?, ?)`)
        .run(assetId, workspaceId, article.id, article.title, timestamp, timestamp, actorId(actor), actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.asset.create", entityType: "content_asset", entityId: assetId, details: { workspaceId, articleId: article.id }, request, createdAt: timestamp });
    });
    row = this.connection.prepare("SELECT * FROM content_assets WHERE id = ?").get(assetId);
    return this._assetPayload(row);
  }

  publications(workspaceId, assetId, options = {}) {
    const includeRemoved = options.includeRemoved === true;
    const rows = this.connection.prepare(`SELECT * FROM content_asset_publications WHERE workspace_id = ? AND asset_id = ? ${includeRemoved ? "" : "AND status != 'removed'"} ORDER BY CASE WHEN platform_code = 'web' THEN 0 ELSE 1 END, published_at DESC, created_at ASC`).all(workspaceId, assetId);
    return rows.map(publicationRow);
  }

  citations(workspaceId, assetId, options = {}) {
    const limit = Math.max(1, Math.min(2_000, Number(options.limit) || 100));
    return this.connection.prepare("SELECT * FROM content_asset_citations WHERE workspace_id = ? AND asset_id = ? ORDER BY observed_at DESC, created_at DESC LIMIT ?")
      .all(workspaceId, assetId, limit).map(citationRow);
  }

  alerts(workspaceId, assetId = null, options = {}) {
    const limit = Math.max(1, Math.min(2_000, Number(options.limit) || 100));
    const status = clean(options.status, "status", 32);
    const where = ["workspace_id = ?"];
    const values = [workspaceId];
    if (assetId) { where.push("asset_id = ?"); values.push(assetId); }
    if (status) { where.push("status = ?"); values.push(status); }
    return this.connection.prepare(`SELECT * FROM content_asset_alerts WHERE ${where.join(" AND ")} ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, last_seen_at DESC LIMIT ?`)
      .all(...values, limit).map(alertRow);
  }

  citationSummary(workspaceId, assetId) {
    const row = this.connection.prepare(`
      SELECT COUNT(*) AS citation_count,
             COUNT(DISTINCT evidence_id) AS evidence_count,
             COUNT(DISTINCT question_id) AS question_count,
             COUNT(DISTINCT platform_code) AS platform_count,
             MIN(observed_at) AS first_cited_at,
             MAX(observed_at) AS last_cited_at
      FROM content_asset_citations WHERE workspace_id = ? AND asset_id = ?
    `).get(workspaceId, assetId) || {};
    return {
      citationCount: Number(row.citation_count || 0), evidenceCount: Number(row.evidence_count || 0),
      questionCount: Number(row.question_count || 0), platformCount: Number(row.platform_count || 0),
      firstCitedAt: row.first_cited_at || null, lastCitedAt: row.last_cited_at || null
    };
  }

  _assetPayload(row) {
    return {
      ...assetRow(row, this.publications(row.workspace_id, row.id)),
      citationSummary: this.citationSummary(row.workspace_id, row.id),
      recentCitations: this.citations(row.workspace_id, row.id, { limit: 20 }),
      alerts: this.alerts(row.workspace_id, row.id, { status: "open", limit: 20 })
    };
  }

  list({ workspaceId = this.workspaceId, articleId = null, status = null, publishedOnly = false, limit = 500 } = {}) {
    const where = ["assets.workspace_id = ?"];
    const values = [workspaceId];
    if (articleId) { where.push("assets.article_id = ?"); values.push(clean(articleId, "articleId", 180, true)); }
    if (status) { where.push("assets.status = ?"); values.push(clean(status, "status", 40, true)); }
    if (publishedOnly) where.push(`(
      EXISTS (SELECT 1 FROM content_asset_publications AS publication WHERE publication.workspace_id = assets.workspace_id AND publication.asset_id = assets.id AND publication.status = 'active')
      OR EXISTS (SELECT 1 FROM content_articles AS article WHERE article.workspace_id = assets.workspace_id AND article.id = assets.article_id AND article.status = 'published')
    )`);
    const rows = this.connection.prepare(`SELECT assets.* FROM content_assets AS assets WHERE ${where.join(" AND ")} ORDER BY assets.updated_at DESC LIMIT ?`).all(...values, Math.max(1, Math.min(2_000, Number(limit) || 500)));
    return rows.map((row) => this._assetPayload(row));
  }

  get(workspaceId, assetId) {
    const row = this.connection.prepare("SELECT * FROM content_assets WHERE workspace_id = ? AND id = ?").get(workspaceId, clean(assetId, "assetId", 180, true));
    if (!row) throw new ContentAssetError("Content asset was not found.", 404, "CONTENT_ASSET_NOT_FOUND", { assetId });
    return this._assetPayload(row);
  }

  upsertPublication({ workspaceId = this.workspaceId, assetId = null, articleId, articleVersionId = null, publisherJobId = null, platform = "manual", platformName = "其他平台", source = "manual", url, publishedAt = null, metadata = {}, actor = null, request = null } = {}) {
    const article = this.article(workspaceId, articleId);
    const asset = assetId ? this.get(workspaceId, assetId) : this.ensureAsset({ workspaceId, articleId: article.id, actor, request });
    if (asset.articleId !== article.id) throw new ContentAssetError("Publication article does not match the asset.", 409, "CONTENT_ASSET_ARTICLE_MISMATCH");
    const versionId = clean(articleVersionId, "articleVersionId", 180);
    if (versionId && !this.connection.prepare("SELECT 1 FROM content_article_versions WHERE id = ? AND article_id = ?").get(versionId, article.id)) {
      throw new ContentAssetError("Article version was not found for this asset.", 404, "CONTENT_ASSET_VERSION_NOT_FOUND", { articleVersionId: versionId });
    }
    const normalizedUrl = normalizeContentAssetUrl(url);
    const normalizedSource = ["publish_sync", "manual", "import"].includes(source) ? source : "manual";
    const platformCode = clean(platform, "platform", 100, true).toLowerCase();
    const displayName = clean(platformName || platformCode, "platformName", 200, true);
    const jobId = clean(publisherJobId, "publisherJobId", 180) || null;
    const timestamp = now();
    const previous = this.connection.prepare("SELECT * FROM content_asset_publications WHERE workspace_id = ? AND asset_id = ? AND canonical_url = ?").get(workspaceId, asset.id, normalizedUrl);
    const publicationId = previous?.id || id("CPUB");
    const normalizedPublishedAt = iso(publishedAt, "publishedAt");
    const normalizedMetadata = metadata && typeof metadata === "object" ? metadata : {};
    const unchanged = previous
      && previous.status === "active"
      && String(previous.article_version_id || "") === versionId
      && String(previous.publisher_job_id || "") === String(jobId || "")
      && previous.platform_code === platformCode
      && previous.platform_name === displayName
      && previous.source === normalizedSource
      && previous.url === normalizedUrl
      && String(previous.published_at || "") === String(normalizedPublishedAt || "")
      && JSON.stringify(parseJson(previous.metadata_json, {})) === JSON.stringify(normalizedMetadata);
    if (unchanged) return { asset: this.get(workspaceId, asset.id), publication: publicationRow(previous), created: false, unchanged: true };
    this.database.transaction(() => {
      if (previous) {
        this.connection.prepare(`UPDATE content_asset_publications SET article_version_id = COALESCE(?, article_version_id), publisher_job_id = COALESCE(?, publisher_job_id), platform_code = ?, platform_name = ?, source = ?, url = ?, status = 'active', published_at = COALESCE(?, published_at), updated_at = ?, updated_by = ?, metadata_json = ? WHERE id = ?`)
          .run(versionId || null, jobId, platformCode, displayName, normalizedSource, normalizedUrl, normalizedPublishedAt, timestamp, actorId(actor), JSON.stringify(normalizedMetadata), publicationId);
      } else {
        this.connection.prepare(`INSERT INTO content_asset_publications (id, workspace_id, asset_id, article_id, article_version_id, publisher_job_id, platform_code, platform_name, source, url, canonical_url, status, health_status, published_at, created_at, updated_at, created_by, updated_by, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'unchecked', ?, ?, ?, ?, ?, ?)`)
          .run(publicationId, workspaceId, asset.id, article.id, versionId || null, jobId, platformCode, displayName, normalizedSource, normalizedUrl, normalizedUrl, normalizedPublishedAt, timestamp, timestamp, actorId(actor), actorId(actor), JSON.stringify(normalizedMetadata));
      }
      this.connection.prepare("UPDATE content_assets SET status = 'tracking', title_snapshot = ?, updated_at = ?, updated_by = ? WHERE id = ?").run(article.title, timestamp, actorId(actor), asset.id);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: previous ? "content.asset.publication.update" : "content.asset.publication.add", entityType: "content_asset_publication", entityId: publicationId, details: { workspaceId, assetId: asset.id, articleId: article.id, platform: platformCode, source: normalizedSource, canonicalUrl: normalizedUrl, publisherJobId: jobId }, request, createdAt: timestamp });
    });
    return { asset: this.get(workspaceId, asset.id), publication: publicationRow(this.connection.prepare("SELECT * FROM content_asset_publications WHERE id = ?").get(publicationId)), created: !previous };
  }

  syncPublisherJob(job, options = {}) {
    const workspaceId = String(options.workspaceId || this.workspaceId);
    const articleId = clean(job?.contentArticleId || job?.articleId, "articleId", 180);
    if (!articleId || !this.connection.prepare("SELECT 1 FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, articleId)) return { synced: 0, publications: [] };
    const results = job?.results && typeof job.results === "object" ? job.results : {};
    const publications = [];
    for (const [platform, result] of Object.entries(results)) {
      const resultState = String(result?.state || "").toLowerCase();
      const remoteUrl = result?.remote_url || result?.remoteUrl;
      if (!["published", "success"].includes(resultState) || !remoteUrl) continue;
      const entry = this.upsertPublication({ workspaceId, articleId, articleVersionId: job.contentVersionId || result.version_id || null, publisherJobId: job.id == null ? null : String(job.id), platform, platformName: result.platform_name || platform, source: "publish_sync", url: remoteUrl, publishedAt: result.published_at || result.updated_at || job.updatedAt, metadata: { publisherState: resultState } });
      publications.push(entry.publication);
    }
    return { synced: publications.length, publications };
  }

  _openAlert({ workspaceId, assetId, publicationId = null, type, severity = "warning", dedupeKey, title, message = "", details = {}, timestamp = now() }) {
    const existing = this.connection.prepare("SELECT * FROM content_asset_alerts WHERE workspace_id = ? AND dedupe_key = ?").get(workspaceId, dedupeKey);
    if (existing) {
      this.connection.prepare(`UPDATE content_asset_alerts SET status = 'open', severity = ?, title = ?, message = ?, details_json = ?, last_seen_at = ?, resolved_at = NULL, updated_at = ? WHERE id = ?`)
        .run(severity, title, message, JSON.stringify(details || {}), timestamp, timestamp, existing.id);
      return alertRow(this.connection.prepare("SELECT * FROM content_asset_alerts WHERE id = ?").get(existing.id));
    }
    const alertId = id("CALERT");
    this.connection.prepare(`INSERT INTO content_asset_alerts (id, workspace_id, asset_id, publication_id, alert_type, severity, status, dedupe_key, title, message, details_json, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(alertId, workspaceId, assetId, publicationId, type, severity, dedupeKey, title, message, JSON.stringify(details || {}), timestamp, timestamp, timestamp, timestamp);
    return alertRow(this.connection.prepare("SELECT * FROM content_asset_alerts WHERE id = ?").get(alertId));
  }

  _resolveAlert(workspaceId, dedupeKey, timestamp = now()) {
    this.connection.prepare(`UPDATE content_asset_alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE workspace_id = ? AND dedupe_key = ? AND status = 'open'`)
      .run(timestamp, timestamp, workspaceId, dedupeKey);
  }

  ingestEvidence(evidence, options = {}) {
    const workspaceId = String(options.workspaceId || this.workspaceId);
    if (!evidence || evidence.evidenceType !== "live" || evidence.verificationStatus !== "verified" || !evidence.observedAt) return { matched: 0, created: 0, citations: [] };
    const payload = evidence.payload && typeof evidence.payload === "object" ? evidence.payload : {};
    const delivery = payload.delivery && typeof payload.delivery === "object" ? payload.delivery : {};
    const normalized = delivery.normalized && typeof delivery.normalized === "object" ? delivery.normalized : (payload.normalized || {});
    const requestItem = payload.request && typeof payload.request === "object" ? payload.request : {};
    const quotes = Array.isArray(normalized.quotes) ? normalized.quotes : [];
    const sources = [...quotes];
    if (evidence.sourceUrl && !sources.some((item) => String(item?.url || item?.link || "") === evidence.sourceUrl)) sources.unshift({ url: evidence.sourceUrl });
    const created = [];
    const matchedAssets = new Set();
    const timestamp = now();
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index] || {};
      let canonicalSourceUrl;
      try { canonicalSourceUrl = normalizeContentAssetUrl(source.url || source.link); } catch { continue; }
      const publications = this.connection.prepare(`
        SELECT * FROM content_asset_publications
        WHERE workspace_id = ? AND status = 'active'
          AND (canonical_url = ? OR resolved_url = ? OR declared_canonical_url = ?)
      `).all(workspaceId, canonicalSourceUrl, canonicalSourceUrl, canonicalSourceUrl);
      for (const publication of publications) {
        const matchKind = publication.canonical_url === canonicalSourceUrl ? "canonical"
          : publication.resolved_url === canonicalSourceUrl ? "resolved" : "declared_canonical";
        const citationId = id("CCITE");
        const inserted = this.connection.prepare(`
          INSERT OR IGNORE INTO content_asset_citations (
            id, workspace_id, asset_id, publication_id, article_id, evidence_id, diagnostic_run_id,
            question_id, question_text, platform_code, terminal_code, mode_code, source_url,
            canonical_source_url, source_title, source_rank, match_kind, observed_at, created_at, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          citationId, workspaceId, publication.asset_id, publication.id, publication.article_id, evidence.id, evidence.runId,
          evidence.provenance?.questionId || requestItem.questionId || null,
          clean(requestItem.prompt || requestItem.question || "", "question", 5_000),
          clean(evidence.provenance?.platform || "", "platform", 100), clean(evidence.provenance?.terminal || "", "terminal", 100), clean(evidence.provenance?.mode || "", "mode", 100),
          normalizeContentAssetUrl(source.url || source.link), canonicalSourceUrl,
          clean(source.title || source.name || "", "sourceTitle", 500),
          Number.isInteger(Number(source.rank ?? source.position)) ? Number(source.rank ?? source.position) : index + 1,
          matchKind, new Date(evidence.observedAt).toISOString(), timestamp,
          JSON.stringify({ quote: source, sourceKind: evidence.sourceKind || "", sourceId: evidence.sourceId || "" })
        );
        if (!inserted.changes) continue;
        const citation = citationRow(this.connection.prepare("SELECT * FROM content_asset_citations WHERE id = ?").get(citationId));
        created.push(citation);
        matchedAssets.add(publication.asset_id);
      }
    }
    if (created.length) {
      this.database.transaction(() => {
        for (const assetId of matchedAssets) {
          this.connection.prepare("UPDATE content_assets SET updated_at = ? WHERE id = ?").run(timestamp, assetId);
          this._resolveAlert(workspaceId, `asset-citation-stale:${assetId}`, timestamp);
          const count = Number(this.connection.prepare("SELECT COUNT(*) AS count FROM content_asset_citations WHERE workspace_id = ? AND asset_id = ?").get(workspaceId, assetId)?.count || 0);
          if (count === created.filter((item) => item.assetId === assetId).length) {
            const asset = this.connection.prepare("SELECT title_snapshot FROM content_assets WHERE id = ?").get(assetId);
            this._openAlert({ workspaceId, assetId, type: "citation_first", severity: "info", dedupeKey: `asset-first-citation:${assetId}`, title: "内容资产首次被 AI 引用", message: `${asset?.title_snapshot || "文章"} 已在已验证的实时 AI 回答中出现引用。`, details: { evidenceId: evidence.id, observedAt: evidence.observedAt }, timestamp });
          }
        }
        appendAuditLog(this.connection, { action: "content.asset.citations.sync", entityType: "diagnostic_evidence", entityId: evidence.id, details: { workspaceId, created: created.length, assets: [...matchedAssets] }, createdAt: timestamp });
      });
    }
    return { matched: created.length, created: created.length, citations: created };
  }

  syncEvidence({ workspaceId = this.workspaceId, limit = 2_000 } = {}) {
    const rows = this.connection.prepare(`
      SELECT e.* FROM diagnostic_evidence e
      JOIN diagnostic_runs r ON r.id = e.run_id
      JOIN diagnostic_projects p ON p.id = r.project_id
      WHERE p.workspace_id = ? AND e.evidence_type = 'live' AND e.verification_status = 'verified' AND e.observed_at IS NOT NULL
      ORDER BY e.observed_at ASC LIMIT ?
    `).all(workspaceId, Math.max(1, Math.min(20_000, Number(limit) || 2_000)));
    let created = 0;
    for (const row of rows) {
      created += this.ingestEvidence({
        id: row.id, runId: row.run_id, evidenceType: row.evidence_type, sourceKind: row.source_kind, sourceId: row.source_id,
        sourceUrl: row.source_url, verificationStatus: row.verification_status, observedAt: row.observed_at,
        provenance: parseJson(row.provenance_json, {}), payload: parseJson(row.payload_json, {})
      }, { workspaceId }).created;
    }
    return { scannedEvidence: rows.length, created };
  }

  removePublication({ workspaceId = this.workspaceId, assetId, publicationId, actor = null, request = null } = {}) {
    const row = this.connection.prepare("SELECT * FROM content_asset_publications WHERE workspace_id = ? AND asset_id = ? AND id = ?").get(workspaceId, clean(assetId, "assetId", 180, true), clean(publicationId, "publicationId", 180, true));
    if (!row) throw new ContentAssetError("Publication was not found.", 404, "CONTENT_ASSET_PUBLICATION_NOT_FOUND");
    if (row.source !== "manual") throw new ContentAssetError("Automatically tracked publication URLs cannot be removed; archive the publisher record at its source.", 409, "CONTENT_ASSET_PUBLICATION_MANAGED");
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_asset_publications SET status = 'removed', updated_at = ?, updated_by = ? WHERE id = ?").run(timestamp, actorId(actor), row.id);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.asset.publication.remove", entityType: "content_asset_publication", entityId: row.id, details: { workspaceId, assetId, canonicalUrl: row.canonical_url }, request, createdAt: timestamp });
    });
    return this.get(workspaceId, assetId);
  }

  async checkPublication({ workspaceId = this.workspaceId, assetId, publicationId, actor = null, request = null } = {}) {
    const row = this.connection.prepare("SELECT * FROM content_asset_publications WHERE workspace_id = ? AND asset_id = ? AND id = ? AND status = 'active'").get(workspaceId, clean(assetId, "assetId", 180, true), clean(publicationId, "publicationId", 180, true));
    if (!row) throw new ContentAssetError("Active publication was not found.", 404, "CONTENT_ASSET_PUBLICATION_NOT_FOUND");
    const timestamp = now();
    const nextCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
    let result;
    try {
      result = await inspectContentAssetUrl(row.url, { fetchImpl: this.fetchImpl, lookup: this.lookup, priorHash: row.content_hash });
      if (result.healthStatus === "unreachable") throw new ContentAssetError(`Publication returned HTTP ${result.httpStatus}.`, 422, "CONTENT_ASSET_HTTP_UNREACHABLE", { httpStatus: result.httpStatus });
      this.database.transaction(() => {
        this.connection.prepare(`UPDATE content_asset_publications SET resolved_url = ?, declared_canonical_url = ?, health_status = ?, http_status = ?, content_type = ?, content_hash = ?, last_error_code = NULL, last_error_message = NULL, last_checked_at = ?, next_check_at = ?, consecutive_failures = 0, last_healthy_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
          .run(result.resolvedUrl, result.declaredCanonicalUrl, result.healthStatus, result.httpStatus, result.contentType, result.contentHash, timestamp, nextCheckAt, timestamp, timestamp, actorId(actor), row.id);
        this._resolveAlert(workspaceId, `publication-health:${row.id}`, timestamp);
        this._resolveAlert(workspaceId, `publication-redirect:${row.id}`, timestamp);
        this._resolveAlert(workspaceId, `publication-change:${row.id}`, timestamp);
        if (result.healthStatus === "changed") this._openAlert({ workspaceId, assetId, publicationId: row.id, type: "url_changed", severity: "warning", dedupeKey: `publication-change:${row.id}`, title: "内容资产页面发生变化", message: `${row.platform_name} 发布地址的正文摘要发生变化，请核查是否为正常更新。`, details: { url: row.url, contentHash: result.contentHash }, timestamp });
        if (result.healthStatus === "redirected") this._openAlert({ workspaceId, assetId, publicationId: row.id, type: "url_redirected", severity: "info", dedupeKey: `publication-redirect:${row.id}`, title: "内容资产地址发生跳转", message: `${row.platform_name} 发布地址跳转到新的公开地址。`, details: { url: row.url, resolvedUrl: result.resolvedUrl }, timestamp });
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.asset.publication.check", entityType: "content_asset_publication", entityId: row.id, details: { workspaceId, assetId, healthStatus: result.healthStatus, httpStatus: result.httpStatus, resolvedUrl: result.resolvedUrl }, request, createdAt: timestamp });
      });
    } catch (error) {
      const health = error?.code === "CONTENT_ASSET_URL_BLOCKED" ? "blocked" : "unreachable";
      const failures = Number(row.consecutive_failures || 0) + 1;
      const retryHours = Math.min(24, 2 ** Math.min(4, Math.max(0, failures - 1)));
      const retryAt = new Date(Date.now() + retryHours * 60 * 60 * 1_000).toISOString();
      this.database.transaction(() => {
        this.connection.prepare("UPDATE content_asset_publications SET health_status = ?, last_error_code = ?, last_error_message = ?, last_checked_at = ?, next_check_at = ?, consecutive_failures = ?, updated_at = ?, updated_by = ? WHERE id = ?")
          .run(health, String(error?.code || "CONTENT_ASSET_CHECK_FAILED").slice(0, 160), String(error?.message || "Publication check failed.").slice(0, 1_000), timestamp, retryAt, failures, timestamp, actorId(actor), row.id);
        this._openAlert({ workspaceId, assetId, publicationId: row.id, type: "url_unreachable", severity: failures >= 3 ? "critical" : "warning", dedupeKey: `publication-health:${row.id}`, title: failures >= 3 ? "内容资产地址连续不可访问" : "内容资产地址不可访问", message: `${row.platform_name} 发布地址检测失败（连续 ${failures} 次）。`, details: { url: row.url, code: error?.code || "CONTENT_ASSET_CHECK_FAILED", failures, retryAt }, timestamp });
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.asset.publication.check_failed", entityType: "content_asset_publication", entityId: row.id, details: { workspaceId, assetId, code: error?.code || "CONTENT_ASSET_CHECK_FAILED" }, request, createdAt: timestamp });
      });
      if (error instanceof ContentAssetError) throw error;
      throw new ContentAssetError("Publication check failed.", 422, "CONTENT_ASSET_CHECK_FAILED");
    }
    return publicationRow(this.connection.prepare("SELECT * FROM content_asset_publications WHERE id = ?").get(row.id));
  }

  async patrolDue({ workspaceId = this.workspaceId, limit = 20, citationStaleDays = 30 } = {}) {
    const timestamp = now();
    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const rows = this.connection.prepare(`
      SELECT * FROM content_asset_publications
      WHERE workspace_id = ? AND status = 'active'
        AND (next_check_at IS NULL OR next_check_at <= ?)
      ORDER BY COALESCE(next_check_at, last_checked_at, created_at) ASC LIMIT ?
    `).all(workspaceId, timestamp, normalizedLimit);
    const results = [];
    for (const row of rows) {
      try {
        const publication = await this.checkPublication({ workspaceId, assetId: row.asset_id, publicationId: row.id });
        results.push({ publicationId: row.id, status: publication.healthStatus, ok: true });
      } catch (error) {
        results.push({ publicationId: row.id, status: error?.code || "CONTENT_ASSET_CHECK_FAILED", ok: false });
      }
    }
    const staleCutoff = new Date(Date.now() - Math.max(1, Math.min(365, Number(citationStaleDays) || 30)) * 86_400_000).toISOString();
    const citedAssets = this.connection.prepare(`
      SELECT a.id, a.title_snapshot, MAX(c.observed_at) AS last_cited_at
      FROM content_assets a JOIN content_asset_citations c ON c.asset_id = a.id
      WHERE a.workspace_id = ? AND a.status = 'tracking'
      GROUP BY a.id HAVING MAX(c.observed_at) < ?
    `).all(workspaceId, staleCutoff);
    this.database.transaction(() => {
      for (const asset of citedAssets) this._openAlert({ workspaceId, assetId: asset.id, type: "citation_stale", severity: "warning", dedupeKey: `asset-citation-stale:${asset.id}`, title: "内容资产近期未再被引用", message: `${asset.title_snapshot} 最近一次已验证引用早于 ${Math.max(1, Number(citationStaleDays) || 30)} 天。`, details: { lastCitedAt: asset.last_cited_at, staleCutoff }, timestamp });
    });
    return { checked: rows.length, succeeded: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, staleCitations: citedAssets.length, results, completedAt: now() };
  }
}
