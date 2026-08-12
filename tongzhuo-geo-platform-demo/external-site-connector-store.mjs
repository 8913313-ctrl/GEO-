import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { appendAuditLog } from "./production-audit.mjs";
import { ProductionSecrets } from "./production-secrets.mjs";
import { isPublicAddress, validatePublicUrl } from "./monitoring-store.mjs";

const CONNECTION_TYPES = new Set(["wordpress_rest", "generic_http"]);
const AUTH_TYPES = new Set(["none", "bearer", "header", "hmac_sha256"]);
const AUTH_HEADER_ALLOWLIST = new Set(["x-api-key", "x-auth-token", "x-webhook-token"]);
const TERMINAL_STATES = new Set(["published", "updated", "deleted"]);
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 512 * 1024;

export class ExternalSiteConnectorError extends Error {
  constructor(message, status = 422, code = "EXTERNAL_SITE_ERROR", details = undefined) {
    super(message);
    this.name = "ExternalSiteConnectorError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function sha256(value) { return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex"); }
function parseJson(value, fallback = {}) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }

function text(value, field, maximum, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new ExternalSiteConnectorError(`${field} is required.`, 422, "EXTERNAL_SITE_INVALID_INPUT", { field });
  if (result.length > maximum) throw new ExternalSiteConnectorError(`${field} exceeds ${maximum} characters.`, 422, "EXTERNAL_SITE_INVALID_INPUT", { field, maximum });
  return result;
}

function safeEndpoint(value) {
  let url;
  try { url = new URL(text(value, "endpointUrl", 2_000, true)); } catch { throw new ExternalSiteConnectorError("A valid HTTP or HTTPS endpoint is required.", 422, "EXTERNAL_SITE_URL_INVALID"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || url.hash) {
    throw new ExternalSiteConnectorError("Only credential-free HTTP/HTTPS endpoint URLs are allowed.", 422, "EXTERNAL_SITE_URL_INVALID");
  }
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (![80, 443].includes(port)) throw new ExternalSiteConnectorError("External site endpoints are restricted to ports 80 and 443.", 403, "EXTERNAL_SITE_SSRF_BLOCKED");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || (!hostname.includes(".") && !hostname.includes(":")) || (/^[0-9a-f:.]+$/i.test(hostname) && !isPublicAddress(hostname))) {
    throw new ExternalSiteConnectorError("Local, private, and internal external site endpoints are blocked.", 403, "EXTERNAL_SITE_SSRF_BLOCKED");
  }
  return url.toString();
}

function normalizeType(value) {
  const type = text(value, "type", 40, true).toLowerCase();
  if (!CONNECTION_TYPES.has(type)) throw new ExternalSiteConnectorError("Unsupported external site connector type.", 422, "EXTERNAL_SITE_TYPE_INVALID");
  return type;
}

function normalizeSettings(type, value = {}) {
  const input = parseJson(value, {});
  if (type === "wordpress_rest") {
    const postsPath = text(input.postsPath || "/wp-json/wp/v2/posts", "postsPath", 500, true);
    if (!postsPath.startsWith("/") || postsPath.startsWith("//") || /[?#]/.test(postsPath)) throw new ExternalSiteConnectorError("WordPress postsPath must be an absolute path without query or fragment.", 422, "EXTERNAL_SITE_SETTINGS_INVALID");
    return { postsPath };
  }
  const authType = text(input.authType || "none", "authType", 40, true).toLowerCase();
  if (!AUTH_TYPES.has(authType)) throw new ExternalSiteConnectorError("Unsupported generic HTTP authentication type.", 422, "EXTERNAL_SITE_AUTH_INVALID");
  const headerName = authType === "header" ? text(input.headerName, "headerName", 80, true).toLowerCase() : "";
  if (headerName && !AUTH_HEADER_ALLOWLIST.has(headerName)) throw new ExternalSiteConnectorError("The requested authentication header is not allowlisted.", 422, "EXTERNAL_SITE_HEADER_BLOCKED", { allowed: [...AUTH_HEADER_ALLOWLIST] });
  return { authType, ...(headerName ? { headerName } : {}) };
}

function normalizeCredentials(type, settings, value = {}, { required = false } = {}) {
  const input = parseJson(value, {});
  if (type === "wordpress_rest") {
    const username = text(input.username, "username", 200, required);
    const applicationPassword = text(input.applicationPassword, "applicationPassword", 2_000, required);
    return username || applicationPassword ? { username, applicationPassword } : {};
  }
  if (settings.authType === "none") return {};
  const secret = text(input.secret || input.token, "secret", 4_000, required);
  return secret ? { secret } : {};
}

function publicConnection(row) {
  const settings = parseJson(row.settings_json, {});
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type,
    endpointUrl: row.endpoint_url,
    settings,
    status: row.status,
    hasCredentials: Boolean(row.credential_fingerprint),
    lastTestStatus: row.last_test_status,
    lastTestAt: row.last_test_at || null,
    lastErrorCode: row.last_error_code || null,
    lastErrorMessage: row.last_error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicTask(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    connectionId: row.connection_id,
    articleId: row.article_id,
    articleVersionId: row.article_version_id,
    operation: row.operation,
    remoteId: row.remote_id || "",
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    status: row.status,
    attempts: Number(row.attempts),
    nextAttemptAt: row.next_attempt_at || null,
    receipt: publicReceipt(parseJson(row.receipt_json, {})),
    remoteUrl: row.remote_url || "",
    lastErrorCode: row.last_error_code || null,
    lastErrorMessage: row.last_error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null
  };
}

function publicReceipt(value) {
  const receipt = parseJson(value, {});
  const remoteId = text(receipt.id ?? receipt.remoteId, "receipt.remoteId", 500);
  const remoteUrl = text(receipt.link ?? receipt.url ?? receipt.remoteUrl, "receipt.remoteUrl", 2_000);
  const remoteStatus = text(receipt.status ?? receipt.state, "receipt.status", 120);
  return { ...(remoteId ? { remoteId } : {}), ...(remoteUrl ? { remoteUrl } : {}), ...(remoteStatus ? { status: remoteStatus } : {}) };
}

function origin(value) { return new URL(value).origin; }
function wordpressUrl(connection, operation, remoteId = "") {
  const settings = parseJson(connection.settings_json, {});
  const base = new URL(connection.endpoint_url);
  const collection = new URL(settings.postsPath || "/wp-json/wp/v2/posts", base);
  if (origin(collection) !== origin(base)) throw new ExternalSiteConnectorError("WordPress postsPath must remain on the configured origin.", 422, "EXTERNAL_SITE_ORIGIN_MISMATCH");
  if (["update", "delete"].includes(operation)) collection.pathname = `${collection.pathname.replace(/\/$/, "")}/${encodeURIComponent(remoteId)}`;
  if (operation === "delete") collection.searchParams.set("force", "true");
  return collection.toString();
}

function responseError(statusCode) {
  const retryable = statusCode === 408 || statusCode === 429 || statusCode >= 500;
  return new ExternalSiteConnectorError(`External site returned HTTP ${statusCode}.`, 502, "EXTERNAL_SITE_HTTP_STATUS", { statusCode, retryable });
}

export async function requestExternalJson(url, { payload, headers = {}, method = "POST", timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, maxRedirects = 3, validate = validatePublicUrl, requestPage = null } = {}) {
  let current = safeEndpoint(url);
  const initialOrigin = origin(current);
  const normalizedMethod = String(method || "POST").trim().toUpperCase();
  if (!["GET", "POST", "DELETE"].includes(normalizedMethod)) throw new ExternalSiteConnectorError("External site request method is not allowed.", 422, "EXTERNAL_SITE_METHOD_INVALID");
  const body = normalizedMethod === "GET" ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload ?? {}), "utf8");
  if (body.length > 2 * 1024 * 1024) throw new ExternalSiteConnectorError("External site request payload is too large.", 413, "EXTERNAL_SITE_PAYLOAD_TOO_LARGE");
  for (let redirect = 0; redirect <= Math.min(3, Math.max(0, Number(maxRedirects) || 0)); redirect += 1) {
    let validated;
    try { validated = await validate(current, { allowedPorts: [80, 443] }); } catch (error) {
      if (["MONITORING_SSRF_BLOCKED", "MONITORING_URL_INVALID", "MONITORING_DNS_FAILED"].includes(error?.code)) throw new ExternalSiteConnectorError(error.message, error.status || 403, error.code.replace("MONITORING_", "EXTERNAL_SITE_"));
      throw error;
    }
    const target = validated.url;
    if (target.origin !== initialOrigin) throw new ExternalSiteConnectorError("Cross-origin redirects are not allowed for authenticated external site requests.", 403, "EXTERNAL_SITE_REDIRECT_ORIGIN");
    const selected = validated.records[0];
    let response;
    try {
        response = requestPage ? await requestPage({ target, selected, body, headers, method: normalizedMethod, timeoutMs }) : await new Promise((resolve, reject) => {
        const transport = target.protocol === "https:" ? https : http;
        const request = transport.request({
          protocol: target.protocol,
          hostname: target.hostname,
          servername: target.hostname.replace(/^\[|\]$/g, ""),
          port: target.port || undefined,
          method: normalizedMethod,
          path: `${target.pathname || "/"}${target.search || ""}`,
          headers: { Host: target.host, "User-Agent": "TongzhuoExternalSiteConnector/1.0", Accept: "application/json", ...(body.length ? { "Content-Type": "application/json", "Content-Length": String(body.length) } : {}), ...headers },
          timeout: Math.max(1_000, Math.min(30_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS)),
          lookup(_hostname, lookupOptions, callback) {
            if (lookupOptions?.all) callback(null, [{ address: selected.address, family: selected.family }]);
            else callback(null, selected.address, selected.family);
          }
        }, resolve);
        request.on("timeout", () => request.destroy(Object.assign(new Error("external site request timed out"), { code: "ETIMEDOUT" })));
        request.on("error", reject);
        request.end(body.length ? body : undefined);
      });
    } catch (error) {
      if (error instanceof ExternalSiteConnectorError) throw error;
      throw new ExternalSiteConnectorError(error?.code === "ETIMEDOUT" ? "External site request timed out." : "External site request failed.", 502, error?.code === "ETIMEDOUT" ? "EXTERNAL_SITE_TIMEOUT" : "EXTERNAL_SITE_REQUEST_FAILED", { retryable: true });
    }
    const statusCode = Number(response.statusCode || 0);
    const location = response.headers?.location;
    if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
      response.resume?.();
      if (redirect === Math.min(3, Math.max(0, Number(maxRedirects) || 0))) throw new ExternalSiteConnectorError("External site redirected too many times.", 502, "EXTERNAL_SITE_REDIRECT_LIMIT");
      const next = new URL(location, target).toString();
      if (origin(next) !== initialOrigin) throw new ExternalSiteConnectorError("Cross-origin redirects are not allowed for authenticated external site requests.", 403, "EXTERNAL_SITE_REDIRECT_ORIGIN");
      current = next;
      continue;
    }
    if (statusCode < 200 || statusCode >= 300) { response.resume?.(); throw responseError(statusCode); }
    const contentType = String(response.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json" && !contentType.endsWith("+json")) { response.resume?.(); throw new ExternalSiteConnectorError("External site must return JSON.", 502, "EXTERNAL_SITE_CONTENT_TYPE"); }
    const contentEncoding = String(response.headers?.["content-encoding"] || "identity").trim().toLowerCase();
    if (contentEncoding && contentEncoding !== "identity") { response.resume?.(); throw new ExternalSiteConnectorError("Compressed external site responses are not accepted.", 502, "EXTERNAL_SITE_CONTENT_ENCODING"); }
    const declaredLength = Number(response.headers?.["content-length"] || 0);
    if (declaredLength > maxBytes) { response.destroy?.(); throw new ExternalSiteConnectorError("External site response is too large.", 502, "EXTERNAL_SITE_RESPONSE_TOO_LARGE"); }
    const chunks = []; let bytes = 0;
    for await (const chunk of response) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maxBytes) { response.destroy?.(); throw new ExternalSiteConnectorError("External site response is too large.", 502, "EXTERNAL_SITE_RESPONSE_TOO_LARGE"); }
      chunks.push(buffer);
    }
    let receipt;
    try { receipt = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ExternalSiteConnectorError("External site returned no valid JSON receipt.", 502, "EXTERNAL_SITE_RECEIPT_INVALID"); }
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new ExternalSiteConnectorError("External site returned no valid JSON receipt.", 502, "EXTERNAL_SITE_RECEIPT_INVALID");
    return { statusCode, receipt, finalUrl: target.toString() };
  }
  throw new ExternalSiteConnectorError("External site request failed.", 502, "EXTERNAL_SITE_REQUEST_FAILED");
}

export class ExternalSiteConnectorStore {
  constructor(database, contentStore, options = {}) {
    if (!database?.connection || !contentStore) throw new TypeError("ExternalSiteConnectorStore requires database and content store instances.");
    this.database = database;
    this.connection = database.connection;
    this.contentStore = contentStore;
    this.workspaceId = String(options.workspaceId || "default");
    this.secrets = options.secrets || new ProductionSecrets({ dataDir: options.dataDir, ...(options.masterKey === undefined ? {} : { masterKey: options.masterKey }), ...(Object.prototype.hasOwnProperty.call(options, "environmentValue") ? { environmentValue: options.environmentValue } : {}) });
    this.request = options.request || requestExternalJson;
  }

  async ready() { await this.secrets.load(); return this; }
  secretContext(connectionId) { return `external-site:${connectionId}:credentials`; }
  row(workspaceId, connectionId) {
    const row = this.connection.prepare("SELECT * FROM external_site_connections WHERE workspace_id = ? AND id = ?").get(workspaceId, connectionId);
    if (!row) throw new ExternalSiteConnectorError("External site connection was not found.", 404, "EXTERNAL_SITE_CONNECTION_NOT_FOUND");
    return row;
  }
  credentials(row) {
    const envelope = parseJson(row.credential_envelope_json, {});
    if (!Object.keys(envelope).length) return {};
    return parseJson(this.secrets.decryptSecret(envelope, this.secretContext(row.id)), {});
  }
  list({ workspaceId = this.workspaceId } = {}) { return this.connection.prepare("SELECT * FROM external_site_connections WHERE workspace_id = ? ORDER BY updated_at DESC").all(workspaceId).map(publicConnection); }
  get(workspaceId, connectionId) { return publicConnection(this.row(workspaceId, connectionId)); }

  async create({ workspaceId = this.workspaceId, name, type, endpointUrl, settings = {}, credentials = {}, actor = null, request = null } = {}) {
    await this.ready();
    const normalizedType = normalizeType(type);
    const normalizedSettings = normalizeSettings(normalizedType, settings);
    const normalizedCredentials = normalizeCredentials(normalizedType, normalizedSettings, credentials, { required: normalizedType === "wordpress_rest" || normalizedSettings.authType !== "none" });
    const connectionId = id("EXTSITE"); const timestamp = now(); const userId = actorId(actor);
    const credentialJson = JSON.stringify(normalizedCredentials);
    const envelope = Object.keys(normalizedCredentials).length ? this.secrets.encryptSecret(credentialJson, this.secretContext(connectionId)) : {};
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO external_site_connections (id, workspace_id, name, type, endpoint_url, settings_json, credential_envelope_json, credential_fingerprint, status, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enabled', ?, ?, ?, ?)`)
        .run(connectionId, workspaceId, text(name, "name", 160, true), normalizedType, safeEndpoint(endpointUrl), JSON.stringify(normalizedSettings), JSON.stringify(envelope), Object.keys(normalizedCredentials).length ? sha256(credentialJson) : "", userId, userId, timestamp, timestamp);
      appendAuditLog(this.connection, { actorUserId: userId, action: "external_site.connection.create", entityType: "external_site_connection", entityId: connectionId, details: { workspaceId, type: normalizedType, endpointOrigin: origin(endpointUrl), hasCredentials: Object.keys(normalizedCredentials).length > 0 }, request, createdAt: timestamp });
    });
    return this.get(workspaceId, connectionId);
  }

  async update({ workspaceId = this.workspaceId, connectionId, name, endpointUrl, settings, credentials, status, actor = null, request = null } = {}) {
    await this.ready(); const current = this.row(workspaceId, connectionId);
    const normalizedSettings = settings === undefined ? parseJson(current.settings_json, {}) : normalizeSettings(current.type, settings);
    const existingCredentials = this.credentials(current);
    const normalizedCredentials = normalizeCredentials(current.type, normalizedSettings, credentials === undefined ? existingCredentials : credentials, { required: current.type === "wordpress_rest" || normalizedSettings.authType !== "none" });
    const nextStatus = status === undefined ? current.status : text(status, "status", 20, true).toLowerCase();
    if (!["enabled", "disabled"].includes(nextStatus)) throw new ExternalSiteConnectorError("Connection status is invalid.", 422, "EXTERNAL_SITE_STATUS_INVALID");
    const credentialJson = JSON.stringify(normalizedCredentials); const timestamp = now(); const userId = actorId(actor);
    const envelope = Object.keys(normalizedCredentials).length ? this.secrets.encryptSecret(credentialJson, this.secretContext(connectionId)) : {};
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE external_site_connections SET name = ?, endpoint_url = ?, settings_json = ?, credential_envelope_json = ?, credential_fingerprint = ?, status = ?, last_test_status = 'untested', last_test_at = NULL, last_error_code = NULL, last_error_message = NULL, updated_by = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`)
        .run(name === undefined ? current.name : text(name, "name", 160, true), endpointUrl === undefined ? current.endpoint_url : safeEndpoint(endpointUrl), JSON.stringify(normalizedSettings), JSON.stringify(envelope), Object.keys(normalizedCredentials).length ? sha256(credentialJson) : "", nextStatus, userId, timestamp, workspaceId, connectionId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "external_site.connection.update", entityType: "external_site_connection", entityId: connectionId, details: { workspaceId, endpointChanged: endpointUrl !== undefined, credentialsChanged: credentials !== undefined, status: nextStatus }, request, createdAt: timestamp });
    });
    return this.get(workspaceId, connectionId);
  }

  authHeaders(row, credentials, payload) {
    const settings = parseJson(row.settings_json, {});
    if (row.type === "wordpress_rest") return { Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.applicationPassword}`, "utf8").toString("base64")}` };
    if (settings.authType === "bearer") return { Authorization: `Bearer ${credentials.secret}` };
    if (settings.authType === "header") return { [settings.headerName]: credentials.secret };
    if (settings.authType === "hmac_sha256") {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const serialized = JSON.stringify(payload);
      return { "X-TZ-Timestamp": timestamp, "X-TZ-Signature": `sha256=${crypto.createHmac("sha256", credentials.secret).update(`${timestamp}.${serialized}`, "utf8").digest("hex")}` };
    }
    return {};
  }

  async testConnection({ workspaceId = this.workspaceId, connectionId, actor = null, request = null } = {}) {
    await this.ready(); const row = this.row(workspaceId, connectionId); const credentials = this.credentials(row);
    const payload = { event: "connector.test", sentAt: now() };
    const target = row.type === "wordpress_rest" ? new URL("/wp-json/wp/v2/users/me?context=edit", row.endpoint_url).toString() : row.endpoint_url;
    try {
      const requestPayload = row.type === "wordpress_rest" ? {} : payload;
      const result = await this.request(target, { payload: requestPayload, method: row.type === "wordpress_rest" ? "GET" : "POST", headers: this.authHeaders(row, credentials, requestPayload) });
      if (row.type === "wordpress_rest" && !result.receipt?.id) throw new ExternalSiteConnectorError("WordPress did not return the authenticated user.", 502, "EXTERNAL_SITE_RECEIPT_MISSING");
      const timestamp = now();
      this.database.transaction(() => {
        this.connection.prepare("UPDATE external_site_connections SET last_test_status = 'passed', last_test_at = ?, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE workspace_id = ? AND id = ?").run(timestamp, timestamp, workspaceId, connectionId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "external_site.connection.test", entityType: "external_site_connection", entityId: connectionId, details: { workspaceId, success: true }, request, createdAt: timestamp });
      });
      return { connection: this.get(workspaceId, connectionId), ok: true };
    } catch (error) {
      const timestamp = now(); const code = error?.code || "EXTERNAL_SITE_TEST_FAILED"; const message = String(error?.message || "Connection test failed.").slice(0, 500);
      this.database.transaction(() => {
        this.connection.prepare("UPDATE external_site_connections SET last_test_status = 'failed', last_test_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE workspace_id = ? AND id = ?").run(timestamp, code, message, timestamp, workspaceId, connectionId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "external_site.connection.test", entityType: "external_site_connection", entityId: connectionId, details: { workspaceId, success: false, code }, request, createdAt: timestamp });
      });
      throw error;
    }
  }

  task(workspaceId, taskId) {
    const row = this.connection.prepare("SELECT * FROM external_site_publication_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, taskId);
    if (!row) throw new ExternalSiteConnectorError("External site publication task was not found.", 404, "EXTERNAL_SITE_TASK_NOT_FOUND");
    return publicTask(row);
  }
  listTasks({ workspaceId = this.workspaceId, connectionId = "", articleId = "", limit = 100 } = {}) {
    const clauses = ["workspace_id = ?"]; const values = [workspaceId];
    if (connectionId) { clauses.push("connection_id = ?"); values.push(connectionId); }
    if (articleId) { clauses.push("article_id = ?"); values.push(articleId); }
    values.push(Math.max(1, Math.min(500, Number(limit) || 100)));
    return this.connection.prepare(`SELECT * FROM external_site_publication_tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...values).map(publicTask);
  }

  createTask({ workspaceId = this.workspaceId, connectionId, articleId, articleVersionId = null, operation = "publish", remoteId = "", idempotencyKey, actor = null, request = null } = {}) {
    const connection = this.row(workspaceId, connectionId);
    if (connection.status !== "enabled") throw new ExternalSiteConnectorError("External site connection is disabled.", 409, "EXTERNAL_SITE_CONNECTION_DISABLED");
    const publishable = this.contentStore.assertCanPublish(text(articleId, "articleId", 240, true), articleVersionId || null, { workspaceId });
    const normalizedOperation = text(operation, "operation", 20, true).toLowerCase();
    if (!["publish", "update", "delete"].includes(normalizedOperation)) throw new ExternalSiteConnectorError("Publication operation is invalid.", 422, "EXTERNAL_SITE_OPERATION_INVALID");
    const mappedRemoteId = normalizedOperation === "publish" ? "" : this.connection.prepare(`
      SELECT remote_id FROM external_site_publication_tasks
      WHERE workspace_id = ? AND connection_id = ? AND article_id = ?
        AND remote_id != '' AND status IN ('published', 'updated')
      ORDER BY completed_at DESC, created_at DESC LIMIT 1
    `).get(workspaceId, connectionId, publishable.article.id)?.remote_id || "";
    const normalizedRemoteId = text(remoteId || mappedRemoteId, "remoteId", 500, normalizedOperation !== "publish");
    const key = text(idempotencyKey, "idempotencyKey", 200, true);
    const identityPayload = { connectionId, articleId: publishable.article.id, articleVersionId: publishable.version.id, operation: normalizedOperation, remoteId: normalizedRemoteId };
    const payloadHash = sha256(JSON.stringify(identityPayload));
    const existing = this.connection.prepare("SELECT * FROM external_site_publication_tasks WHERE workspace_id = ? AND connection_id = ? AND idempotency_key = ?").get(workspaceId, connectionId, key);
    if (existing) {
      if (existing.payload_hash !== payloadHash) throw new ExternalSiteConnectorError("The idempotency key was already used for a different publication request.", 409, "EXTERNAL_SITE_IDEMPOTENCY_CONFLICT");
      return { task: publicTask(existing), idempotent: true };
    }
    const taskId = id("EXTJOB"); const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO external_site_publication_tasks (id, workspace_id, connection_id, article_id, article_version_id, operation, remote_id, idempotency_key, payload_hash, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`)
        .run(taskId, workspaceId, connectionId, publishable.article.id, publishable.version.id, normalizedOperation, normalizedRemoteId, key, payloadHash, actorId(actor), timestamp, timestamp);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "external_site.publication.create", entityType: "external_site_publication_task", entityId: taskId, details: { workspaceId, connectionId, articleId: publishable.article.id, articleVersionId: publishable.version.id, operation: normalizedOperation }, request, createdAt: timestamp });
    });
    return { task: this.task(workspaceId, taskId), idempotent: false };
  }

  publicationPayload(connection, task, version) {
    const slug = text(version.metadata?.siteSlug || version.metadata?.site?.slug || "", "slug", 240);
    if (connection.type === "wordpress_rest") return task.operation === "delete" ? {} : { title: version.title, content: version.contentHtml, excerpt: version.excerpt, status: "publish", ...(slug ? { slug } : {}) };
    if (task.operation === "delete") return { event: "article.deleted", idempotencyKey: task.idempotencyKey, article: { id: task.articleId, versionId: task.articleVersionId }, remoteId: task.remoteId };
    return { event: task.operation === "update" ? "article.updated" : task.operation === "delete" ? "article.deleted" : "article.published", idempotencyKey: task.idempotencyKey, article: { id: task.articleId, versionId: task.articleVersionId, title: version.title, contentHtml: version.contentHtml, contentText: version.contentText, excerpt: version.excerpt, contentHash: version.contentHash, ...(slug ? { slug } : {}) }, ...(task.remoteId ? { remoteId: task.remoteId } : {}) };
  }

  async executeTask({ workspaceId = this.workspaceId, taskId, actor = null, request = null } = {}) {
    await this.ready(); let task = this.task(workspaceId, taskId);
    if (TERMINAL_STATES.has(task.status)) return { task, idempotent: true };
    if (!["queued", "failed"].includes(task.status)) throw new ExternalSiteConnectorError("Publication task is already running.", 409, "EXTERNAL_SITE_TASK_BUSY");
    const connection = this.row(workspaceId, task.connectionId);
    if (connection.status !== "enabled") throw new ExternalSiteConnectorError("External site connection is disabled.", 409, "EXTERNAL_SITE_CONNECTION_DISABLED");
    const publishable = this.contentStore.assertCanPublish(task.articleId, task.articleVersionId, { workspaceId });
    const claimed = this.connection.prepare("UPDATE external_site_publication_tasks SET status = 'running', attempts = attempts + 1, next_attempt_at = NULL, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE workspace_id = ? AND id = ? AND status IN ('queued', 'failed')").run(now(), workspaceId, taskId);
    if (Number(claimed.changes) !== 1) throw new ExternalSiteConnectorError("Publication task is already running.", 409, "EXTERNAL_SITE_TASK_BUSY");
    task = this.task(workspaceId, taskId);
    const payload = this.publicationPayload(connection, task, publishable.version);
    const credentials = this.credentials(connection);
    const target = connection.type === "wordpress_rest" ? wordpressUrl(connection, task.operation, task.remoteId) : connection.endpoint_url;
    try {
      const result = await this.request(target, { payload, method: task.operation === "delete" && connection.type === "wordpress_rest" ? "DELETE" : "POST", headers: { "Idempotency-Key": task.idempotencyKey, ...this.authHeaders(connection, credentials, payload) } });
      const receipt = publicReceipt(result.receipt);
      const remoteId = text(receipt.id ?? receipt.remoteId ?? task.remoteId, "receipt.remoteId", 500);
      const remoteUrl = text(receipt.link ?? receipt.url ?? receipt.remoteUrl, "receipt.remoteUrl", 2_000);
      if (!remoteId && !remoteUrl) throw new ExternalSiteConnectorError("External site returned no publication receipt.", 502, "EXTERNAL_SITE_RECEIPT_MISSING");
      const timestamp = now(); const status = task.operation === "update" ? "updated" : task.operation === "delete" ? "deleted" : "published";
      this.database.transaction(() => {
        this.connection.prepare("UPDATE external_site_publication_tasks SET status = ?, remote_id = ?, receipt_json = ?, remote_url = ?, completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'").run(status, remoteId, JSON.stringify(receipt), remoteUrl, timestamp, timestamp, workspaceId, taskId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: `external_site.publication.${status}`, entityType: "external_site_publication_task", entityId: taskId, details: { workspaceId, connectionId: connection.id, articleId: task.articleId, articleVersionId: task.articleVersionId, remoteId: remoteId || null, remoteUrl: remoteUrl || null }, request, createdAt: timestamp });
      });
      return { task: this.task(workspaceId, taskId), idempotent: false };
    } catch (error) {
      const timestamp = now(); const code = error?.code || "EXTERNAL_SITE_REQUEST_FAILED"; const message = String(error?.message || "External site publication failed.").slice(0, 500); const retryable = error?.details?.retryable !== false;
      const nextAttempt = retryable ? new Date(Date.now() + Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.min(task.attempts, 6)))).toISOString() : null;
      this.database.transaction(() => {
        this.connection.prepare("UPDATE external_site_publication_tasks SET status = 'failed', next_attempt_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'").run(nextAttempt, code, message, timestamp, workspaceId, taskId);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "external_site.publication.failed", entityType: "external_site_publication_task", entityId: taskId, details: { workspaceId, connectionId: connection.id, articleId: task.articleId, articleVersionId: task.articleVersionId, code, retryable }, request, createdAt: timestamp });
      });
      throw error;
    }
  }
}
