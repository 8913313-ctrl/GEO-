import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-content-api-"));
const port = 45000 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], { cwd: path.resolve("."), env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: temp, TZ_DATABASE_PATH: path.join(temp, "content.sqlite"), TZ_LOG_DIR: path.join(temp, "logs"), TZ_AI_PROVIDER_DATA_DIR: path.join(temp, "ai"), TZ_PUBLISHER_DATA_DIR: path.join(temp, "publisher"), TZ_PUBLISHER_SCHEDULER_INTERVAL_MS: "250", TZ_MASTER_KEY: randomBytes(32).toString("base64") }, stdio: ["ignore", "pipe", "pipe"] });
let childOutput = "";
child.stdout.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-8_000); });
child.stderr.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-8_000); });
function cookies(response) { return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; "); }
async function request(pathname, options = {}) { const response = await fetch(`${base}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; } return { response, body }; }
async function ready() {
  for (let i = 0; i < 150; i += 1) {
    if (child.exitCode !== null) throw new Error(`content API server exited before readiness (code ${child.exitCode})\n${childOutput}`);
    try {
      const result = await request("/health/ready");
      if (result.response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`content API server did not become ready within 15 seconds\n${childOutput}`);
}
function headers(cookie, csrf, extra = {}) { return { Cookie: cookie, ...(csrf ? { "X-CSRF-Token": csrf } : {}), "Content-Type": "application/json", ...extra }; }

try {
  await ready();
  let result = await request("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" }) });
  assert.equal(result.response.status, 201);
  const cookie = cookies(result.response); const csrf = result.body.data.csrfToken;
  const auth = headers(cookie, csrf);
  result = await request("/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify({ id: "PLAN-API-1", businessLineId: "BL-1", name: "API 内容计划", contentType: "深度文章", status: "planned", metadata: { topicIds: ["TOPIC-1"] } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const formalPlan = result.body.data.plan;
  result = await request("/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify({ id: "PLAN-API-1", businessLineId: "BL-1", name: "API 内容计划", contentType: "深度文章", status: "planned", metadata: { topicIds: ["TOPIC-1"] } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); assert.equal(result.body.data.plan.id, formalPlan.id); assert.equal(result.body.data.plan.revision, formalPlan.revision, "replaying plan sync must be idempotent");
  result = await request("/api/v1/users", { method: "POST", headers: auth, body: JSON.stringify({ username: "reviewer", displayName: "Reviewer", password: "PrivateReviewer!2026", role: "reviewer", status: "active" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  result = await request("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "reviewer", password: "PrivateReviewer!2026" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const reviewerCookie = cookies(result.response); const reviewerCsrf = result.body.data.csrfToken; const reviewerAuth = headers(reviewerCookie, reviewerCsrf);
  result = await request("/api/v1/knowledge/libraries", { method: "POST", headers: auth, body: JSON.stringify({ name: "内容审核证据库", kind: "document", businessLineId: "BL-1" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const libraryId = result.body.data.library.id;
  result = await request(`/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, { method: "POST", headers: auth, body: JSON.stringify({ title: "企业内容边界", sourceType: "text", content: "企业 GEO 内容必须引用已审核、可公开、可追溯的企业知识。正文需要明确证据来源、适用边界与执行步骤，未经审核的价格和效果数字不能对外发布。" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const knowledgeVersionId = result.body.data.version.id;
  result = await request(`/api/v1/knowledge/versions/${encodeURIComponent(knowledgeVersionId)}/approve`, { method: "POST", headers: auth, body: "{}" });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request("/api/v1/knowledge/retrieve", { method: "POST", headers: auth, body: JSON.stringify({ query: "企业 GEO 内容审核需要什么证据？", businessLineId: "BL-1", topK: 2 }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.ok(result.body.data.evidence.length, JSON.stringify(result.body));
  const retrievedEvidence = result.body.data.evidence[0];
  result = await request("/api/v1/content/tasks", { method: "POST", headers: auth, body: JSON.stringify({ id: "TASK-API-1", planId: formalPlan.id, businessLineId: "BL-1", title: "企业 GEO 如何建立可信内容", topicId: "TOPIC-1" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const task = result.body.data.task; const article = result.body.data.article;
  const evidence = [{ ...retrievedEvidence, id: "EVID-1", marker: "K1", knowledgeLibraryId: retrievedEvidence.libraryId, knowledgeDocumentId: retrievedEvidence.documentId, knowledgeVersionId: retrievedEvidence.versionId, knowledgeChunkId: "KC-GEO-LEGACY-01", claim: "企业内容边界已审定", supportStatus: "supported" }];
  result = await request(`/api/v1/content/tasks/${task.id}/versions`, { method: "POST", headers: auth, body: JSON.stringify({ articleId: article.id, expectedRevision: article.revision, title: article.title, contentHtml: "<p>企业 GEO 如何建立可信内容？本文先给出结论，再说明企业知识边界、证据来源和落地步骤。这里补充足够的正文信息，便于人工审核和后续发布。</p>", evidence }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const version = result.body.data.version; let remoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${task.id}/risk-scan`, { method: "POST", headers: reviewerAuth, body: JSON.stringify({ versionId: version.id }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.ok(["passed", "warning"].includes(result.body.data.scan.status), JSON.stringify(result.body));
  remoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${task.id}/submit-review`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: version.id, expectedRevision: remoteArticle.revision }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.version.reviewStatus, "pending");
  assert.equal(result.body.data.version.evidence[0].knowledgeChunkId, retrievedEvidence.chunkId, "legacy KC evidence must be normalized to the formal KCH ID during review");
  remoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${task.id}/approve`, { method: "POST", headers: reviewerAuth, body: JSON.stringify({ versionId: version.id, expectedRevision: remoteArticle.revision }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.version.reviewStatus, "approved"); assert.ok(result.body.data.version.frozenAt);
  result = await request(`/api/v1/content/tasks/${task.id}/can-publish`, { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200); assert.equal(result.body.data.ok, true, JSON.stringify(result.body));
  remoteArticle = result.body.data.article || result.body.data;
  result = await request("/api/publisher/jobs", { method: "POST", headers: auth, body: JSON.stringify({ contentArticleId: article.id, contentVersionId: version.id, platforms: ["web"], platformOrder: ["web"], mode: "scheduled", scheduledAt: new Date(Date.now() + 350).toISOString(), webUrl: "https://www.example.com/insights/content-api-publisher-loop/", siteSlug: "content-api-publisher-loop", siteCategory: "GEO 方法", siteAuthor: "API Test", article: { id: article.id, title: article.title } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); assert.equal(result.body.job.status, "scheduled"); assert.equal(result.body.job.results.web.state, "queued", JSON.stringify(result.body));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    result = await request(`/api/v1/content/articles/${encodeURIComponent(article.id)}`, { headers: { Cookie: cookie } });
    if (result.body.data?.article?.status === "published") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.article.status, "published", "web-only schedule must run without opening the publisher overview or polling from a desktop agent"); assert.equal(result.body.data.article.metadata.siteSlug, "content-api-publisher-loop");
  remoteArticle = result.body.data.article;
  result = await request(`/api/v1/content-assets?publishedOnly=1&articleId=${encodeURIComponent(article.id)}`, { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.items.length, 1, "successful website publication must create one durable content asset");
  const contentAsset = result.body.data.items[0];
  assert.equal(contentAsset.publications.length, 1, JSON.stringify(contentAsset));
  assert.equal(contentAsset.publications[0].platform, "web");
  result = await request(`/api/v1/content-assets/${encodeURIComponent(contentAsset.id)}/publications`, { method: "POST", headers: auth, body: JSON.stringify({ articleVersionId: version.id, platform: "manual", platformName: "行业媒体", url: "https://media.example.com/article/1?utm_source=test" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const manualPublication = result.body.data.publication;
  assert.equal(manualPublication.canonicalUrl, "https://media.example.com/article/1");
  result = await request(`/api/v1/content-assets/${encodeURIComponent(contentAsset.id)}/publications/${encodeURIComponent(manualPublication.id)}`, { method: "DELETE", headers: auth });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.asset.publications.some((item) => item.id === manualPublication.id), false);
  result = await request(`/api/v1/content/tasks/${task.id}/versions`, { method: "POST", headers: auth, body: JSON.stringify({ articleId: article.id, expectedRevision: remoteArticle.revision, baseVersionId: version.id, title: article.title, contentHtml: "<p>新的未审核正文版本。</p>", evidence }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const unreviewedVersion = result.body.data.version; remoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${task.id}/submit-review`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: unreviewedVersion.id, expectedRevision: remoteArticle.revision, riskScan: { findings: [] } }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.version.reviewStatus, "pending", "submitting a freshly saved version must scan and submit the same immutable version in one user action"); assert.ok(["passed", "warning"].includes(result.body.data.version.riskStatus), JSON.stringify(result.body));
  result = await request(`/api/v1/content/tasks/${task.id}`, { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200); assert.equal(result.body.data.version.id, unreviewedVersion.id); assert.equal(result.body.data.version.reviewStatus, "pending", "the exact freshly saved version must enter human review");
  result = await request(`/api/v1/content/tasks/${task.id}/can-publish`, { headers: { Cookie: cookie } });
  assert.equal(result.body.data.ok, false, JSON.stringify(result.body));
  result = await request("/api/publisher/jobs", { method: "POST", headers: auth, body: JSON.stringify({ articleId: article.id, platforms: ["web"], article: { id: article.id, title: article.title, content: "<p>unapproved</p>" } }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.body)); assert.equal(result.body.code, "CONTENT_REVIEW_REQUIRED");
  result = await request("/api/v1/content/tasks", { method: "POST", headers: auth, body: JSON.stringify({ id: "TASK-INVALID-EVIDENCE", planId: formalPlan.id, businessLineId: "BL-1", title: "伪造证据必须被阻止", topicId: "TOPIC-INVALID" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const invalidTask = result.body.data.task; const invalidArticle = result.body.data.article;
  const fakeEvidence = [{ id: "EVID-FAKE", marker: "K1", knowledgeLibraryId: "KB-NOT-EXIST", knowledgeDocumentId: "DOC-NOT-EXIST", knowledgeVersionId: "VER-NOT-EXIST", knowledgeChunkId: "CHUNK-NOT-EXIST", claim: "伪造证据", quote: "伪造证据", supportStatus: "supported" }];
  result = await request(`/api/v1/content/tasks/${invalidTask.id}/versions`, { method: "POST", headers: auth, body: JSON.stringify({ articleId: invalidArticle.id, expectedRevision: invalidArticle.revision, title: invalidArticle.title, contentHtml: "<p>这是一篇用于验证伪造知识引用会在提交审核时被正式服务端阻止的测试文章，正文长度足以完成风险扫描。</p>", evidence: fakeEvidence }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const invalidVersion = result.body.data.version; let invalidRemoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${invalidTask.id}/risk-scan`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: invalidVersion.id }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); invalidRemoteArticle = result.body.data.article;
  result = await request(`/api/v1/content/tasks/${invalidTask.id}/submit-review`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: invalidVersion.id, expectedRevision: invalidRemoteArticle.revision }) });
  assert.equal(result.response.status, 422, JSON.stringify(result.body)); assert.equal(result.body.code, "KNOWLEDGE_EVIDENCE_REFERENCE_NOT_FOUND");
  console.log("Content API workflow check passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); }
  await rm(temp, { recursive: true, force: true });
}
