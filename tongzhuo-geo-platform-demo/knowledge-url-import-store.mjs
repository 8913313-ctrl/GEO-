import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { appendAuditLog } from "./production-audit.mjs";
import { KnowledgeError } from "./knowledge-store.mjs";
import { validatePublicUrl } from "./monitoring-store.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_PREVIEW_TTL_MS = 30 * 60 * 1000;
const ALLOWED_CONTENT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);

function now() {
  return new Date().toISOString();
}

function identifier(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function boundedText(value, field, maximum, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new KnowledgeError(`${field}不能为空。`, 422, "KNOWLEDGE_URL_IMPORT_INVALID");
  if (result.length > maximum) throw new KnowledgeError(`${field}不能超过 ${maximum} 个字符。`, 422, "KNOWLEDGE_URL_IMPORT_INVALID");
  return result;
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (named[lower]) return named[lower];
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 0xfffd);
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 0xfffd);
    return match;
  });
}

function htmlText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template|svg|canvas)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractKnowledgePage(html, finalUrl, contentType = "text/html") {
  const source = String(html || "");
  if (contentType === "text/plain") {
    const content = source.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
    return { title: new URL(finalUrl).hostname, content };
  }
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const headingMatch = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const preferred = source.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || source;
  const title = htmlText(titleMatch?.[1] || headingMatch?.[1] || "") || new URL(finalUrl).hostname;
  return { title: title.slice(0, 300), content: htmlText(preferred) };
}

function mapNetworkError(error) {
  if (error instanceof KnowledgeError) return error;
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  if (code === "MONITORING_SSRF_BLOCKED") return new KnowledgeError("该地址不是可公开访问的公网地址。", 403, "KNOWLEDGE_URL_SSRF_BLOCKED");
  if (code === "MONITORING_URL_INVALID") return new KnowledgeError("请输入不含账号密码的 HTTP/HTTPS 公开地址。", 422, "KNOWLEDGE_URL_INVALID");
  if (code === "MONITORING_DNS_FAILED") return new KnowledgeError("网址域名无法解析。", 422, "KNOWLEDGE_URL_DNS_FAILED");
  if (status) return new KnowledgeError(error.message, status, code || "KNOWLEDGE_URL_FETCH_FAILED");
  return new KnowledgeError("无法读取该公开网页。", 502, "KNOWLEDGE_URL_FETCH_FAILED", { cause: String(error?.message || "unknown").slice(0, 300) });
}

export async function fetchPublicKnowledgePage(value, options = {}) {
  let current = boundedText(value, "网址", 2_000, true);
  const maxBytes = Math.max(16_384, Math.min(5 * 1024 * 1024, Number(options.maxBytes) || DEFAULT_MAX_BYTES));
  const timeoutMs = Math.max(1_000, Math.min(30_000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const maxRedirects = Math.max(0, Math.min(5, Number(options.maxRedirects) || DEFAULT_MAX_REDIRECTS));
  const validate = options.validatePublicUrl || validatePublicUrl;
  const requestPage = options.requestPage || null;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    let validated;
    try { validated = await validate(current, { allowedPorts: [80, 443] }); } catch (error) { throw mapNetworkError(error); }
    const target = validated.url;
    const selected = validated.records[0];
    let response;
    try {
      response = requestPage
        ? await requestPage({ target, selected, timeoutMs })
        : await new Promise((resolve, reject) => {
            const transport = target.protocol === "https:" ? https : http;
            const request = transport.request({
              protocol: target.protocol,
              hostname: target.hostname,
              servername: target.hostname.replace(/^\[|\]$/g, ""),
              port: target.port || undefined,
              method: "GET",
              path: `${target.pathname || "/"}${target.search || ""}`,
              headers: {
                Host: target.host,
                "User-Agent": "EnterpriseGeoKnowledgeImporter/1.0",
                Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
                "Accept-Encoding": "identity"
              },
              timeout: timeoutMs,
              lookup(_hostname, lookupOptions, callback) {
                if (lookupOptions?.all) callback(null, [{ address: selected.address, family: selected.family }]);
                else callback(null, selected.address, selected.family);
              }
            }, resolve);
            request.on("timeout", () => request.destroy(new Error("remote request timed out")));
            request.on("error", reject);
            request.end();
          });
    } catch (error) { throw mapNetworkError(error); }

    const statusCode = Number(response.statusCode || 0);
    const location = response.headers?.location;
    if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
      response.resume?.();
      if (redirect === maxRedirects) throw new KnowledgeError("网页跳转次数过多。", 422, "KNOWLEDGE_URL_REDIRECT_LIMIT");
      current = new URL(location, target).href;
      continue;
    }
    if (statusCode < 200 || statusCode >= 300) {
      response.resume?.();
      throw new KnowledgeError(`网页返回 HTTP ${statusCode}。`, 502, "KNOWLEDGE_URL_FETCH_STATUS", { statusCode });
    }
    const contentType = String(response.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      response.resume?.();
      throw new KnowledgeError("仅支持 HTML、XHTML 或纯文本网页。", 422, "KNOWLEDGE_URL_CONTENT_TYPE", { contentType });
    }
    const contentEncoding = String(response.headers?.["content-encoding"] || "identity").trim().toLowerCase();
    if (contentEncoding && contentEncoding !== "identity") {
      response.resume?.();
      throw new KnowledgeError("网页返回了不受支持的压缩编码。", 422, "KNOWLEDGE_URL_CONTENT_ENCODING", { contentEncoding });
    }
    const declaredLength = Number(response.headers?.["content-length"] || 0);
    if (declaredLength > maxBytes) {
      response.destroy?.();
      throw new KnowledgeError("网页内容超过导入大小限制。", 413, "KNOWLEDGE_URL_TOO_LARGE", { maxBytes });
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maxBytes) {
        response.destroy?.();
        throw new KnowledgeError("网页内容超过导入大小限制。", 413, "KNOWLEDGE_URL_TOO_LARGE", { maxBytes });
      }
      chunks.push(buffer);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    const extracted = extractKnowledgePage(html, target.href, contentType);
    if (!extracted.content || extracted.content.length < 20) throw new KnowledgeError("网页中没有提取到足够的正文内容。", 422, "KNOWLEDGE_URL_CONTENT_EMPTY");
    return { ...extracted, requestedUrl: value, finalUrl: target.href, contentType, sourceBytes: bytes };
  }
  throw new KnowledgeError("无法读取该公开网页。", 502, "KNOWLEDGE_URL_FETCH_FAILED");
}

function publicPreview(row, { includeContent = true } = {}) {
  return {
    id: row.id,
    libraryId: row.library_id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    title: row.title,
    ...(includeContent ? { content: row.content_text } : {}),
    contentHash: row.content_hash,
    contentType: row.content_type,
    sourceBytes: Number(row.source_bytes),
    status: row.status,
    documentId: row.document_id || null,
    versionId: row.version_id || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    committedAt: row.committed_at || null
  };
}

export class KnowledgeUrlImportStore {
  constructor(database, knowledgeStore, options = {}) {
    if (!database?.connection || !knowledgeStore) throw new TypeError("KnowledgeUrlImportStore requires database and knowledge store instances.");
    this.database = database;
    this.connection = database.connection;
    this.knowledgeStore = knowledgeStore;
    this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.fetchPage = options.fetchPage || fetchPublicKnowledgePage;
    this.previewTtlMs = Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Number(options.previewTtlMs) || DEFAULT_PREVIEW_TTL_MS));
  }

  preview(workspaceId, previewId) {
    const row = this.connection.prepare("SELECT * FROM knowledge_url_import_previews WHERE workspace_id = ? AND id = ?").get(workspaceId, previewId);
    if (!row) throw new KnowledgeError("网址导入预览不存在。", 404, "KNOWLEDGE_URL_PREVIEW_NOT_FOUND");
    if (row.status === "pending" && Date.parse(row.expires_at) <= Date.now()) {
      this.connection.prepare("UPDATE knowledge_url_import_previews SET status = 'expired' WHERE id = ? AND status = 'pending'").run(row.id);
      row.status = "expired";
    }
    return row;
  }

  async createPreview({ workspaceId = this.workspaceId, libraryId, url, idempotencyKey = "", actor = null, request = null } = {}) {
    this.knowledgeStore.library(workspaceId, libraryId);
    const requestedUrl = boundedText(url, "网址", 2_000, true);
    const key = boundedText(idempotencyKey, "幂等键", 200) || identifier("url-preview-request");
    const existing = this.connection.prepare("SELECT * FROM knowledge_url_import_previews WHERE workspace_id = ? AND created_by IS ? AND idempotency_key = ?").get(workspaceId, actor?.userId || null, key);
    if (existing) {
      if (existing.library_id !== libraryId || existing.requested_url !== requestedUrl) throw new KnowledgeError("该幂等键已用于其他网址导入请求。", 409, "KNOWLEDGE_URL_IDEMPOTENCY_CONFLICT");
      return publicPreview(existing);
    }
    const fetched = await this.fetchPage(requestedUrl);
    const contentHash = sha256(fetched.content);
    const duplicate = this.connection.prepare(`
      SELECT d.id AS document_id, v.id AS version_id
      FROM knowledge_documents d
      JOIN knowledge_document_versions v ON v.document_id = d.id
      WHERE d.library_id = ? AND v.content_hash = ? AND d.status = 'active'
      ORDER BY v.version DESC LIMIT 1
    `).get(libraryId, contentHash);
    const previewId = identifier("KURLP");
    const createdAt = now();
    const expiresAt = new Date(Date.now() + this.previewTtlMs).toISOString();
    this.database.transaction(() => {
      this.connection.prepare(`
        INSERT INTO knowledge_url_import_previews
          (id, workspace_id, library_id, requested_url, final_url, title, content_text, content_hash, content_type, source_bytes, status, idempotency_key, created_by, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `).run(previewId, workspaceId, libraryId, requestedUrl, fetched.finalUrl, fetched.title, fetched.content, contentHash, fetched.contentType, fetched.sourceBytes, key, actor?.userId || null, createdAt, expiresAt);
      appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.url_import.preview", entityType: "knowledge_url_import_preview", entityId: previewId, details: { libraryId, requestedUrl, finalUrl: fetched.finalUrl, contentHash, sourceBytes: fetched.sourceBytes, duplicateDocumentId: duplicate?.document_id || null }, request, createdAt });
    });
    return { ...publicPreview(this.preview(workspaceId, previewId)), duplicate: duplicate ? { documentId: duplicate.document_id, versionId: duplicate.version_id } : null };
  }

  async commitPreview({ workspaceId = this.workspaceId, previewId, confirmed = false, actor = null, request = null } = {}) {
    if (confirmed !== true) throw new KnowledgeError("必须人工检查预览并明确确认后才能入库。", 422, "KNOWLEDGE_URL_CONFIRMATION_REQUIRED");
    let preview = this.preview(workspaceId, previewId);
    if (preview.status === "committed") {
      return { preview: publicPreview(preview), version: this.knowledgeStore.publicVersion(this.knowledgeStore.documentVersion(workspaceId, preview.version_id)), idempotent: true, duplicate: false };
    }
    if (preview.status === "expired") throw new KnowledgeError("网址导入预览已过期，请重新抓取。", 410, "KNOWLEDGE_URL_PREVIEW_EXPIRED");
    if (preview.status !== "pending") throw new KnowledgeError("网址导入正在提交，请勿重复操作。", 409, "KNOWLEDGE_URL_PREVIEW_BUSY");
    const claimed = this.connection.prepare("UPDATE knowledge_url_import_previews SET status = 'committing' WHERE id = ? AND workspace_id = ? AND status = 'pending'").run(previewId, workspaceId);
    if (Number(claimed.changes) !== 1) throw new KnowledgeError("网址导入正在提交，请勿重复操作。", 409, "KNOWLEDGE_URL_PREVIEW_BUSY");
    try {
      const duplicate = this.connection.prepare(`
        SELECT d.id AS document_id, v.id AS version_id
        FROM knowledge_documents d JOIN knowledge_document_versions v ON v.document_id = d.id
        WHERE d.library_id = ? AND v.content_hash = ? AND d.status = 'active'
        ORDER BY v.version DESC LIMIT 1
      `).get(preview.library_id, preview.content_hash);
      let version;
      if (duplicate) version = this.knowledgeStore.documentVersion(workspaceId, duplicate.version_id);
      else version = await this.knowledgeStore.createDocument({ workspaceId, libraryId: preview.library_id, title: preview.title, content: preview.content_text, sourceType: "url", sourceName: preview.title, sourceUrl: preview.final_url, mimeType: "text/plain", metadata: { visibility: "public", importedFrom: "secure_url_preview", requestedUrl: preview.requested_url, finalUrl: preview.final_url, sourceContentType: preview.content_type, sourceBytes: Number(preview.source_bytes), sourceContentHash: preview.content_hash }, actor, request });
      const committedAt = now();
      this.database.transaction(() => {
        this.connection.prepare("UPDATE knowledge_url_import_previews SET status = 'committed', document_id = ?, version_id = ?, committed_at = ? WHERE id = ? AND workspace_id = ? AND status = 'committing'").run(version.document_id, version.id, committedAt, previewId, workspaceId);
        appendAuditLog(this.connection, { actorUserId: actor?.userId || null, action: "knowledge.url_import.commit", entityType: "knowledge_url_import_preview", entityId: previewId, details: { libraryId: preview.library_id, documentId: version.document_id, versionId: version.id, contentHash: preview.content_hash, duplicate: Boolean(duplicate) }, request, createdAt: committedAt });
      });
      preview = this.preview(workspaceId, previewId);
      return { preview: publicPreview(preview), version: this.knowledgeStore.publicVersion(version), idempotent: false, duplicate: Boolean(duplicate) };
    } catch (error) {
      this.connection.prepare("UPDATE knowledge_url_import_previews SET status = 'pending' WHERE id = ? AND workspace_id = ? AND status = 'committing'").run(previewId, workspaceId);
      throw error;
    }
  }
}
