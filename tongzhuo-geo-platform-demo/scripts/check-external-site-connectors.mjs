import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { openProductionDatabase } from "../production-database.mjs";
import { ContentStore } from "../content-store.mjs";
import { ExternalSiteConnectorError, ExternalSiteConnectorStore, requestExternalJson } from "../external-site-connector-store.mjs";

function response({ statusCode = 200, headers = { "content-type": "application/json" }, body = "{}" } = {}) {
  const stream = Readable.from([Buffer.from(body, "utf8")]);
  stream.statusCode = statusCode; stream.headers = headers; stream.resume = () => {}; return stream;
}

function insertArticle(connection, { workspaceId = "tenant-a", articleId, versionId, approved = true } = {}) {
  const timestamp = new Date().toISOString();
  connection.prepare(`INSERT INTO content_articles (id, workspace_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at) VALUES (?, ?, ?, 'guide', ?, ?, ?, 1, '{}', ?, ?)`)
    .run(articleId, workspaceId, `Article ${articleId}`, approved ? "approved" : "draft", versionId, approved ? versionId : null, timestamp, timestamp);
  connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at) VALUES (?, ?, 1, ?, '<p>Verified content</p>', 'Verified content', 'Excerpt', ?, 'human', ?, ?, '{}', ?, ?)`)
    .run(versionId, articleId, `Article ${articleId}`, "a".repeat(64), approved ? "approved" : "draft", approved ? "passed" : "not_scanned", approved ? timestamp : null, timestamp);
}

const root = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-external-sites-"));
const database = openProductionDatabase({ databasePath: path.join(root, "production.sqlite") });

try {
  const tables = new Set(database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  assert.ok(tables.has("external_site_connections"));
  assert.ok(tables.has("external_site_publication_tasks"));
  insertArticle(database.connection, { articleId: "ART-APPROVED", versionId: "VER-APPROVED" });
  insertArticle(database.connection, { articleId: "ART-DRAFT", versionId: "VER-DRAFT", approved: false });
  insertArticle(database.connection, { workspaceId: "tenant-b", articleId: "ART-TENANT-B", versionId: "VER-TENANT-B" });

  const calls = [];
  const content = new ContentStore(database, { workspaceId: "tenant-a", requireEvidence: false });
  const store = new ExternalSiteConnectorStore(database, content, {
    workspaceId: "tenant-a",
    masterKey: randomBytes(32),
    request: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("fail")) throw new ExternalSiteConnectorError("upstream failed", 502, "EXTERNAL_SITE_HTTP_STATUS", { statusCode: 503, retryable: true });
      if (options.payload.event === "connector.test") return { statusCode: 200, receipt: { ok: true }, finalUrl: url };
      if (url.includes("users/me")) return { statusCode: 200, receipt: { id: 7, name: "Publisher" }, finalUrl: url };
      if (options.payload.event === "article.deleted" || options.method === "DELETE") return { statusCode: 200, receipt: { remoteId: "remote-1", status: "deleted", ignoredSecret: "must-not-be-stored" }, finalUrl: url };
      return { statusCode: 200, receipt: { remoteId: "remote-1", remoteUrl: "https://publisher.example/posts/remote-1" }, finalUrl: url };
    }
  });

  const generic = await store.create({ workspaceId: "tenant-a", name: "Official website", type: "generic_http", endpointUrl: "https://publisher.example/hooks/articles", settings: { authType: "header", headerName: "X-API-Key", method: "DELETE", arbitraryHeaders: { Cookie: "blocked" } }, credentials: { secret: "super-secret-token" } });
  assert.equal(generic.hasCredentials, true);
  assert.deepEqual(generic.settings, { authType: "header", headerName: "x-api-key" }, "arbitrary method and headers must not survive normalization");
  assert.equal(JSON.stringify(generic).includes("super-secret-token"), false, "API model must not reveal credentials");
  const encrypted = database.connection.prepare("SELECT credential_envelope_json FROM external_site_connections WHERE id = ?").get(generic.id).credential_envelope_json;
  assert.equal(encrypted.includes("super-secret-token"), false, "database must contain only encrypted credentials");

  await assert.rejects(() => store.create({ name: "Local", type: "generic_http", endpointUrl: "http://127.0.0.1/admin", settings: { authType: "none" } }), (error) => error.code === "EXTERNAL_SITE_SSRF_BLOCKED" || error.code === "EXTERNAL_SITE_URL_INVALID");
  await assert.rejects(() => store.create({ name: "Bad port", type: "generic_http", endpointUrl: "https://publisher.example:8443/hook", settings: { authType: "none" } }), (error) => error.code === "EXTERNAL_SITE_SSRF_BLOCKED");
  await assert.rejects(() => store.create({ name: "Credentials", type: "generic_http", endpointUrl: "https://user:pass@publisher.example/hook", settings: { authType: "none" } }), (error) => error.code === "EXTERNAL_SITE_URL_INVALID");
  await assert.rejects(() => store.create({ name: "Header injection", type: "generic_http", endpointUrl: "https://publisher.example/hook", settings: { authType: "header", headerName: "Cookie" }, credentials: { secret: "x" } }), (error) => error.code === "EXTERNAL_SITE_HEADER_BLOCKED");

  const tested = await store.testConnection({ workspaceId: "tenant-a", connectionId: generic.id });
  assert.equal(tested.connection.lastTestStatus, "passed");
  assert.equal(calls.at(-1).options.headers["x-api-key"], "super-secret-token");
  assert.deepEqual(Object.keys(calls.at(-1).options.headers), ["x-api-key"], "only normalized authentication headers may be sent");
  const noAuth = await store.update({ workspaceId: "tenant-a", connectionId: generic.id, settings: { authType: "none" } });
  assert.equal(noAuth.hasCredentials, false, "switching to no authentication must remove stored credentials");
  assert.deepEqual(store.credentials(store.row("tenant-a", generic.id)), {});
  await store.update({ workspaceId: "tenant-a", connectionId: generic.id, settings: { authType: "header", headerName: "X-API-Key" }, credentials: { secret: "super-secret-token" } });

  assert.throws(() => store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-DRAFT", articleVersionId: "VER-DRAFT", idempotencyKey: "draft-1" }), (error) => error.code === "CONTENT_REVIEW_REQUIRED");
  assert.throws(() => store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-TENANT-B", articleVersionId: "VER-TENANT-B", idempotencyKey: "cross-tenant" }), (error) => error.code === "CONTENT_NOT_FOUND");
  const created = store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", idempotencyKey: "publish-1" });
  assert.equal(created.task.status, "queued");
  const replay = store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", idempotencyKey: "publish-1" });
  assert.equal(replay.idempotent, true);
  assert.throws(() => store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", operation: "update", remoteId: "other", idempotencyKey: "publish-1" }), (error) => error.code === "EXTERNAL_SITE_IDEMPOTENCY_CONFLICT");

  const published = await store.executeTask({ workspaceId: "tenant-a", taskId: created.task.id });
  assert.equal(published.task.status, "published");
  assert.equal(published.task.remoteUrl, "https://publisher.example/posts/remote-1");
  const callCount = calls.length;
  const repeatedExecute = await store.executeTask({ workspaceId: "tenant-a", taskId: created.task.id });
  assert.equal(repeatedExecute.idempotent, true);
  assert.equal(calls.length, callCount, "repeated execution must not call the remote site again");

  const tampered = store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", idempotencyKey: "tampered-1" });
  assert.throws(() => database.connection.prepare("UPDATE external_site_publication_tasks SET payload_hash = ? WHERE id = ?").run("b".repeat(64), tampered.task.id), /identity is immutable/);

  const update = store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", operation: "update", remoteId: "remote-1", idempotencyKey: "update-1" });
  assert.equal((await store.executeTask({ workspaceId: "tenant-a", taskId: update.task.id })).task.status, "updated");
  const deletion = store.createTask({ workspaceId: "tenant-a", connectionId: generic.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", operation: "delete", idempotencyKey: "delete-1" });
  assert.equal(deletion.task.remoteId, "remote-1", "update/delete should resolve the latest saved remote mapping");
  const deleted = await store.executeTask({ workspaceId: "tenant-a", taskId: deletion.task.id });
  assert.equal(deleted.task.status, "deleted");
  assert.equal(JSON.stringify(deleted.task.receipt).includes("must-not-be-stored"), false, "remote receipts must be reduced to allowlisted fields");

  const wordpress = await store.create({ workspaceId: "tenant-a", name: "WordPress", type: "wordpress_rest", endpointUrl: "https://wordpress.example/", credentials: { username: "editor", applicationPassword: "app-pass" } });
  const beforeWordPressTestCalls = calls.length;
  await store.testConnection({ workspaceId: "tenant-a", connectionId: wordpress.id });
  assert.equal(calls.length, beforeWordPressTestCalls + 1);
  assert.equal(calls.at(-1).options.method, "GET", "WordPress connection test must not create a draft post");
  assert.match(calls.at(-1).url, /\/wp-json\/wp\/v2\/users\/me\?context=edit$/);

  const failing = await store.create({ workspaceId: "tenant-a", name: "Failing", type: "generic_http", endpointUrl: "https://fail.example/hook", settings: { authType: "none" } });
  const failedTask = store.createTask({ workspaceId: "tenant-a", connectionId: failing.id, articleId: "ART-APPROVED", articleVersionId: "VER-APPROVED", idempotencyKey: "failure-1" });
  await assert.rejects(() => store.executeTask({ workspaceId: "tenant-a", taskId: failedTask.task.id }), (error) => error.code === "EXTERNAL_SITE_HTTP_STATUS");
  const failed = store.task("tenant-a", failedTask.task.id);
  assert.equal(failed.status, "failed"); assert.equal(failed.attempts, 1); assert.ok(failed.nextAttemptAt);
  await assert.rejects(() => store.executeTask({ workspaceId: "tenant-a", taskId: failedTask.task.id }), (error) => error.code === "EXTERNAL_SITE_HTTP_STATUS");
  assert.equal(store.task("tenant-a", failedTask.task.id).attempts, 2, "explicit retry must increment attempts");
  assert.throws(() => store.task("tenant-b", created.task.id), (error) => error.code === "EXTERNAL_SITE_TASK_NOT_FOUND");

  const auditActions = new Set(database.connection.prepare("SELECT action FROM audit_logs WHERE action LIKE 'external_site.%'").all().map((row) => row.action));
  for (const action of ["external_site.connection.create", "external_site.connection.test", "external_site.publication.create", "external_site.publication.published", "external_site.publication.updated", "external_site.publication.deleted", "external_site.publication.failed"]) assert.ok(auditActions.has(action), `missing audit action ${action}`);

  const validatePublic = async (url) => {
    if (url.includes("127.0.0.1")) throw Object.assign(new Error("blocked"), { code: "MONITORING_SSRF_BLOCKED", status: 403 });
    return { url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] };
  };
  await assert.rejects(() => requestExternalJson("http://127.0.0.1/hook", { payload: {}, validate: validatePublic, requestPage: async () => response() }), (error) => error.code === "EXTERNAL_SITE_SSRF_BLOCKED");
  let validations = 0;
  const sameOrigin = await requestExternalJson("https://public.example/a", { payload: {}, validate: async (url) => { validations += 1; return validatePublic(url); }, requestPage: async ({ target }) => target.pathname === "/a" ? response({ statusCode: 307, headers: { location: "/b" } }) : response({ body: '{"remoteId":"ok"}' }) });
  assert.equal(validations, 2, "every redirect target must be resolved and validated again");
  assert.equal(sameOrigin.receipt.remoteId, "ok");
  await assert.rejects(() => requestExternalJson("https://public.example/a", { payload: {}, validate: validatePublic, requestPage: async () => response({ statusCode: 307, headers: { location: "https://other.example/b" } }) }), (error) => error.code === "EXTERNAL_SITE_REDIRECT_ORIGIN");
  await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, validate: validatePublic, requestPage: async () => { throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }); } }), (error) => error.code === "EXTERNAL_SITE_TIMEOUT");
  for (const statusCode of [400, 503]) await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, validate: validatePublic, requestPage: async () => response({ statusCode }) }), (error) => error.code === "EXTERNAL_SITE_HTTP_STATUS" && error.details.statusCode === statusCode);
  await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, validate: validatePublic, requestPage: async () => response({ body: "not-json" }) }), (error) => error.code === "EXTERNAL_SITE_RECEIPT_INVALID");
  await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, validate: validatePublic, requestPage: async () => response({ headers: { "content-type": "text/html" }, body: "{}" }) }), (error) => error.code === "EXTERNAL_SITE_CONTENT_TYPE");
  await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, validate: validatePublic, requestPage: async () => response({ headers: { "content-type": "application/json", "content-encoding": "gzip" }, body: "{}" }) }), (error) => error.code === "EXTERNAL_SITE_CONTENT_ENCODING");
  await assert.rejects(() => requestExternalJson("https://public.example/hook", { payload: {}, maxBytes: 1024, validate: validatePublic, requestPage: async () => response({ body: `{"value":"${"x".repeat(2048)}"}` }) }), (error) => error.code === "EXTERNAL_SITE_RESPONSE_TOO_LARGE");

  console.log("external site connector checks passed");
} finally {
  database.close();
  await rm(root, { recursive: true, force: true });
}
