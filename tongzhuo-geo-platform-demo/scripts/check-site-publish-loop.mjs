import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSiteRuntime } from "../site-server.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-publish-loop-"));
const databasePath = path.join(temporaryDirectory, "content.sqlite");
const adminPort = 46_000 + Math.floor(Math.random() * 500);
const adminBase = `http://127.0.0.1:${adminPort}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(adminPort)], {
  cwd: path.resolve("."),
  env: {
    ...process.env,
    NODE_ENV: "test",
    TZ_BIND_HOST: "127.0.0.1",
    TZ_COOKIE_SECURE: "0",
    TZ_DATA_DIR: temporaryDirectory,
    TZ_DATABASE_PATH: databasePath,
    TZ_LOG_DIR: path.join(temporaryDirectory, "logs"),
    TZ_AI_PROVIDER_DATA_DIR: path.join(temporaryDirectory, "ai"),
    TZ_PUBLISHER_DATA_DIR: path.join(temporaryDirectory, "publisher"),
    TZ_MASTER_KEY: randomBytes(32).toString("base64")
  },
  stdio: "ignore"
});

let siteRuntime;

function cookies(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean))
    .map((value) => value.split(";", 1)[0]).join("; ");
}

function headers(cookie, csrf, extra = {}) {
  return { Cookie: cookie, ...(csrf ? { "X-CSRF-Token": csrf } : {}), "Content-Type": "application/json", ...extra };
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  return { response, body, text };
}

async function ready() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await request(adminBase, "/health/ready");
      if (result.response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("admin server did not become ready");
}

try {
  await ready();
  let result = await request(adminBase, "/api/v1/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const cookie = cookies(result.response);
  const csrf = result.body.data.csrfToken;
  const auth = headers(cookie, csrf);

  result = await request(adminBase, "/api/v1/knowledge/libraries", {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: "Official site evidence", kind: "document", scope: "enterprise" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const libraryId = result.body.data.library.id;
  result = await request(adminBase, `/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, {
    method: "POST", headers: auth,
    body: JSON.stringify({
      title: "Approved official source",
      sourceType: "text",
      content: "This approved enterprise fact supports the official website article publication and its public evidence boundary.",
      metadata: { visibility: "public" }
    })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const knowledgeVersionId = result.body.data.version.id;
  result = await request(adminBase, `/api/v1/knowledge/versions/${encodeURIComponent(knowledgeVersionId)}/approve`, {
    method: "POST", headers: auth, body: "{}"
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(adminBase, "/api/v1/knowledge/retrieve", {
    method: "POST", headers: auth,
    body: JSON.stringify({ query: "official website article publication evidence", topK: 2 })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.ok(result.body.data.evidence.length, JSON.stringify(result.body));
  const knowledgeEvidence = result.body.data.evidence[0];

  result = await request(adminBase, "/api/v1/content/tasks", {
    method: "POST", headers: auth,
    body: JSON.stringify({ id: "TASK-SITE-PUBLISH", title: "Official site publish loop article", topicId: "TOPIC-SITE" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const task = result.body.data.task;
  const article = result.body.data.article;
  const evidence = [{
    ...knowledgeEvidence,
    id: "EVID-SITE-1",
    marker: "K1",
    knowledgeLibraryId: knowledgeEvidence.libraryId,
    knowledgeDocumentId: knowledgeEvidence.documentId,
    knowledgeVersionId: knowledgeEvidence.versionId,
    knowledgeChunkId: knowledgeEvidence.chunkId,
    claim: "The official source is approved.",
    quote: knowledgeEvidence.quote,
    supportStatus: "supported"
  }];

  result = await request(adminBase, `/api/v1/content/tasks/${task.id}/versions`, {
    method: "POST", headers: auth,
    body: JSON.stringify({
      articleId: article.id, expectedRevision: article.revision, title: article.title,
      contentHtml: "<h2>Direct answer</h2><p>This is a reviewed enterprise article <button class=\"citation-marker\" data-citation-id=\"EVID-SITE-1\">[K1]</button> with enough factual detail to exercise the complete official website publication workflow and immutable approved-version contract.</p>",
      metadata: { showPublicCitationMarkers: false },
      evidence
    })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const version = result.body.data.version;
  let remoteArticle = result.body.data.article;

  result = await request(adminBase, `/api/v1/content/tasks/${task.id}/risk-scan`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: version.id }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  remoteArticle = result.body.data.article;
  result = await request(adminBase, `/api/v1/content/tasks/${task.id}/submit-review`, {
    method: "POST", headers: auth, body: JSON.stringify({ versionId: version.id, expectedRevision: remoteArticle.revision })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  remoteArticle = result.body.data.article;
  result = await request(adminBase, `/api/v1/content/tasks/${task.id}/approve`, {
    method: "POST", headers: auth, body: JSON.stringify({ versionId: version.id, expectedRevision: remoteArticle.revision })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.version.reviewStatus, "approved");
  assert.ok(result.body.data.version.frozenAt);
  remoteArticle = result.body.data.article;
  const approvedVersionId = remoteArticle.approvedVersionId;
  const frozenAt = result.body.data.version.frozenAt;
  const contentHash = result.body.data.version.contentHash;

  siteRuntime = createSiteRuntime({
    databasePath,
    staticRoot: temporaryDirectory,
    host: "127.0.0.1",
    port: 0,
    baseUrl: "https://site.example.test",
    workspaceId: "default",
    flushIntervalMs: 60_000,
    logger: { info() {}, warn() {}, error() {} }
  });
  const siteAddress = await siteRuntime.listen(0, "127.0.0.1");
  const siteBase = `http://127.0.0.1:${siteAddress.port}`;
  result = await request(siteBase, "/insights");
  assert.equal(result.response.status, 200);
  assert.doesNotMatch(result.text, /Official site publish loop article/);

  const publishPath = `/api/v1/content/articles/${encodeURIComponent(article.id)}/publish`;
  const publishBody = {
    versionId: approvedVersionId,
    expectedRevision: remoteArticle.revision,
    category: "GEO Operations",
    siteSlug: "official-site-publish-loop",
    siteAuthor: "Enterprise Content Team",
    siteExcerpt: "A verified publication-loop article.",
    metadata: { keywords: ["GEO", "official source"] }
  };
  result = await request(adminBase, publishPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publishBody) });
  assert.equal(result.response.status, 401, "publishing must require authentication");
  result = await request(adminBase, publishPath, { method: "POST", headers: headers(cookie, ""), body: JSON.stringify(publishBody) });
  assert.equal(result.response.status, 403, "cookie writes must require CSRF");
  result = await request(adminBase, publishPath, { method: "POST", headers: auth, body: JSON.stringify({ ...publishBody, expectedRevision: remoteArticle.revision - 1 }) });
  assert.equal(result.response.status, 409, "publishing must reject stale revisions");

  result = await request(adminBase, publishPath, { method: "POST", headers: auth, body: JSON.stringify(publishBody) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.article.status, "published");
  assert.equal(result.body.data.article.approvedVersionId, approvedVersionId);
  assert.equal(result.body.data.article.metadata.siteSlug, "official-site-publish-loop");
  assert.equal(result.body.data.article.metadata.showPublicCitationMarkers, false);
  assert.equal(result.body.data.task.status, "completed");
  assert.equal(result.body.data.version.reviewStatus, "approved");
  assert.equal(result.body.data.version.frozenAt, frozenAt);
  const publishedRevision = result.body.data.article.revision;

  result = await request(siteBase, "/insights");
  assert.equal(result.response.status, 200);
  assert.match(result.text, /Official site publish loop article/);
  result = await request(siteBase, "/insights/official-site-publish-loop");
  assert.equal(result.response.status, 200);
  assert.match(result.text, /Direct answer/);
  assert.doesNotMatch(result.text, /\[K1\]/, "citation markers must be hidden from the public article by default");
  assert.doesNotMatch(result.text, /data-citation-id/, "private evidence identifiers must not leak into public HTML");

  result = await request(adminBase, `/api/v1/content/articles/${encodeURIComponent(article.id)}/unpublish`, {
    method: "POST", headers: auth, body: JSON.stringify({ expectedRevision: publishedRevision, reason: "Test unpublish" })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.article.status, "approved");
  assert.equal(result.body.data.article.approvedVersionId, approvedVersionId, "unpublish must retain the frozen approved version pointer");
  assert.equal(result.body.data.task.status, "approved");
  assert.equal(result.body.data.version.id, approvedVersionId);
  assert.equal(result.body.data.version.reviewStatus, "approved");
  assert.equal(result.body.data.version.frozenAt, frozenAt);
  assert.equal(result.body.data.version.contentHash, contentHash, "unpublish must not mutate the approved body");

  result = await request(siteBase, "/insights");
  assert.equal(result.response.status, 200);
  assert.doesNotMatch(result.text, /Official site publish loop article/);
  result = await request(siteBase, "/insights/official-site-publish-loop");
  assert.equal(result.response.status, 404);

  const auditActions = siteRuntime.store.database.connection.prepare("SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY id").all(article.id).map((row) => row.action);
  assert.ok(auditActions.includes("content.article.publish"));
  assert.ok(auditActions.includes("content.article.unpublish"));
  console.log("Official site publish/unpublish loop check passed");
} finally {
  await siteRuntime?.close();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}
