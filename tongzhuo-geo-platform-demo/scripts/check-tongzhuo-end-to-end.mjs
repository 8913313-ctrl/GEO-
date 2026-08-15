import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoFoundationDrafts } from "../foundation-assets/bootstrap.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";
import { createSiteRuntime } from "../site-server.mjs";

const workspaceId = "deployment_tongzhuo_geo";
const projectId = "tongzhuo-geo";
const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-e2e-"));
const databasePath = path.join(directory, "tongzhuo.sqlite");
const port = 48_600 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
let child;
let siteRuntime;

const bootstrapDb = new ProductionDatabase({ databasePath });
const foundationStore = new FoundationAssetStore(bootstrapDb);
const drafts = ensureGeoFoundationDrafts(foundationStore);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidateManifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const methodology = importUpsGeoCandidateRules(foundationStore, candidateManifest);
for (const review of methodology.rules) foundationStore.upsertMethodologySourceReview({
  methodologyVersionId: methodology.version.id,
  ruleId: review.ruleId,
  theme: review.theme,
  rule: review.rule,
  source: review.source,
  classification: review.classification,
  applicability: review.applicability,
  licenseStatus: review.licenseStatus,
  reuseDecision: "approved-global",
  reviewStatus: "approved",
  reviewNote: "P7-T02 isolated acceptance of the owner-approved v1 manifest"
});
foundationStore.setMethodologyVersionStatus(methodology.version.id, "published");
foundationStore.setPromptVersionStatus(drafts.promptVersion.id, "published");
foundationStore.setQualityRulePackStatus(drafts.qualityRulePack.id, "published");
bootstrapDb.close();

function cookies(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; ");
}
async function request(origin, pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, options);
  const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, body, text };
}
function headers(cookie, csrf, extra = {}) { return { Cookie: cookie, ...(csrf ? { "X-CSRF-Token": csrf } : {}), "Content-Type": "application/json", ...extra }; }

try {
  child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
    cwd: path.resolve("."),
    env: { ...process.env, NODE_ENV: "test", TZ_PROJECT_ID: projectId, TZ_PROJECT_SEED: "tongzhuo-geo", TZ_INDUSTRY_TEMPLATE: "professional-services", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: directory, TZ_DATABASE_PATH: databasePath, TZ_LOG_DIR: path.join(directory, "logs"), TZ_PUBLISHER_DATA_DIR: path.join(directory, "publisher"), TZ_MASTER_KEY: randomBytes(32).toString("base64") },
    stdio: "ignore"
  });
  for (let i = 0; i < 100; i += 1) { try { if ((await request(base, "/health/ready")).response.ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  let result = await request(base, "/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "tongzhuo-admin", displayName: "桐灼项目管理员", password: "TongzhuoPrivate!2026" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const cookie = cookies(result.response); const csrf = result.body.data.csrfToken; const auth = headers(cookie, csrf);
  const ids = { workspaceId, projectId, boundary: { website: "local-runtime", externalPlatform: "mock", liveAiSampling: "not-run" } };

  const workspaceState = {
    enterpriseProfile: { companyName: "桐灼（淄博）网络科技有限公司", brandName: "桐灼科技", introduction: "面向企业提供 GEO 服务、企业 AI 应用与内容运营服务。", officialDomain: "https://tongzhuo.ink", industryRegion: "山东淄博", serviceArea: "中国" },
    businessLines: [{ id: "BL-TONGZHUO-GEO", name: "灼见 GEO 服务", product: "企业 GEO 私有化运营系统", audience: "需要建设 AI 可见性与公开信源的企业", scenario: "企业知识、内容、官网、发布和监测闭环", status: "active" }],
    questionLibrary: [{ id: "Q-TONGZHUO-GEO-START", question: "企业应该怎样从企业事实和公开信源开始做 GEO？", businessLineId: "BL-TONGZHUO-GEO", intent: "方案了解", status: "approved" }],
    topics: [{ id: "TOP-TONGZHUO-GEO-START", title: "企业如何从事实与公开信源开始做 GEO", sourceQuestionId: "Q-TONGZHUO-GEO-START", businessLineId: "BL-TONGZHUO-GEO", status: "approved" }]
  };
  result = await request(base, "/api/v1/workspace", { method: "PUT", headers: auth, body: JSON.stringify({ expectedRevision: 0, source: "P7-T02", state: workspaceState }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); ids.workspaceRevision = result.body.data.revision; ids.businessLineId = "BL-TONGZHUO-GEO"; ids.questionId = "Q-TONGZHUO-GEO-START"; ids.topicId = "TOP-TONGZHUO-GEO-START";

  result = await request(base, "/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify({ id: "PLAN-TONGZHUO-E2E", businessLineId: ids.businessLineId, name: "桐灼 GEO 首轮内容计划", contentType: "深度文章", status: "planned", metadata: { topicIds: [ids.topicId] } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.planId = result.body.data.plan.id; ids.methodologyVersionId = result.body.data.plan.foundationAssets.methodologyVersionId; ids.promptVersionId = result.body.data.plan.foundationAssets.promptVersionId; ids.qualityRulePackId = result.body.data.plan.foundationAssets.qualityRulePackId;
  assert.deepEqual({ methodologyVersionId: ids.methodologyVersionId, promptVersionId: ids.promptVersionId, qualityRulePackId: ids.qualityRulePackId }, { methodologyVersionId: "MVER-GEO-CORE-V1", promptVersionId: "PVER-GEO-ARTICLE-V1", qualityRulePackId: "QRULE-GEO-CONTENT-V1" });

  result = await request(base, "/api/v1/knowledge/libraries", { method: "POST", headers: auth, body: JSON.stringify({ name: "桐灼企业事实库", kind: "document", businessLineId: ids.businessLineId, scope: "enterprise" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.knowledgeLibraryId = result.body.data.library.id;
  result = await request(base, `/api/v1/knowledge/libraries/${encodeURIComponent(ids.knowledgeLibraryId)}/documents`, { method: "POST", headers: auth, body: JSON.stringify({ title: "桐灼 GEO 服务事实", sourceType: "text", content: "桐灼（淄博）网络科技有限公司面向企业提供 GEO 服务。服务从企业已审核事实、客户真实问题和公开信源开始，经过内容生产、人工审核、官网与外部渠道发布，再根据监测结果持续优化。", metadata: { visibility: "public", evidenceBoundary: "enterprise-approved" } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.knowledgeDocumentId = result.body.data.version.documentId; ids.knowledgeVersionId = result.body.data.version.id;
  result = await request(base, `/api/v1/knowledge/versions/${encodeURIComponent(ids.knowledgeVersionId)}/approve`, { method: "POST", headers: auth, body: "{}" }); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(base, "/api/v1/knowledge/retrieve", { method: "POST", headers: auth, body: JSON.stringify({ query: "企业如何开始做 GEO？", businessLineId: ids.businessLineId, topK: 3 }) }); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const found = result.body.data.evidence[0]; assert.ok(found); ids.knowledgeChunkId = found.chunkId;

  result = await request(base, "/api/v1/content/tasks", { method: "POST", headers: auth, body: JSON.stringify({ id: "TASK-TONGZHUO-E2E", planId: ids.planId, businessLineId: ids.businessLineId, title: "企业如何从事实与公开信源开始做 GEO", topicId: ids.topicId }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.contentTaskId = result.body.data.task.id; ids.articleId = result.body.data.article.id; let article = result.body.data.article;
  const evidence = [{ ...found, id: "EVID-TONGZHUO-E2E", marker: "K1", knowledgeLibraryId: found.libraryId, knowledgeDocumentId: found.documentId, knowledgeVersionId: found.versionId, knowledgeChunkId: found.chunkId, claim: "桐灼 GEO 服务以已审核企业事实和公开信源为起点。", quote: found.quote, supportStatus: "supported" }];
  result = await request(base, `/api/v1/content/tasks/${ids.contentTaskId}/versions`, { method: "POST", headers: auth, body: JSON.stringify({ articleId: ids.articleId, expectedRevision: article.revision, title: article.title, contentHtml: "<h2>直接回答</h2><p>企业做 GEO 应先统一企业主体、业务能力和客户真实问题，再把经过审核的事实组织成可公开访问、可引用的信源。</p><h2>实施步骤</h2><p>桐灼按照企业知识审核、问题地图、内容计划、人工复核、官网和外部渠道发布、持续监测的顺序推进，并保留每一步的版本和证据。</p>", evidence, metadata: { showPublicCitationMarkers: false, generationBoundary: "human-authored-acceptance" } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.articleVersionId = result.body.data.version.id; article = result.body.data.article;
  result = await request(base, `/api/v1/content/tasks/${ids.contentTaskId}/risk-scan`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: ids.articleVersionId }) }); assert.equal(result.response.status, 200, JSON.stringify(result.body)); article = result.body.data.article;
  result = await request(base, `/api/v1/content/tasks/${ids.contentTaskId}/submit-review`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: ids.articleVersionId, expectedRevision: article.revision }) }); assert.equal(result.response.status, 200, JSON.stringify(result.body)); article = result.body.data.article;
  result = await request(base, `/api/v1/content/tasks/${ids.contentTaskId}/approve`, { method: "POST", headers: auth, body: JSON.stringify({ versionId: ids.articleVersionId, expectedRevision: article.revision, note: "P7-T02 人工验收审核" }) }); assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.ok(result.body.data.version.frozenAt); ids.frozenAt = result.body.data.version.frozenAt;

  result = await request(base, "/api/publisher/pairings", { method: "POST", headers: auth, body: "{}" }); assert.equal(result.response.status, 201, JSON.stringify(result.body));
  result = await request(base, "/api/publisher/devices/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairing_code: result.body.pairing.code, device_id: "DEV-TONGZHUO-E2E", device_secret: "tongzhuo-e2e-device-secret", name: "桐灼 Windows 发布器（验收）", capabilities: ["zhihu"], meta: { account_groups: [{ id: "group-tongzhuo", name: "桐灼发布账号组", accounts: { zhihu: { platformId: "zhihu", name: "桐灼知乎（Mock）", status: "online", profileKey: "group-tongzhuo--zhihu" } } }] } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.publisherDeviceId = result.body.result.device_id; const worker = headers("", "", { Authorization: `Bearer ${result.body.result.pairing_token}`, "X-Publisher-Worker": ids.publisherDeviceId, "X-TZ-Project-ID": projectId });

  result = await request(base, "/api/publisher/jobs", { method: "POST", headers: auth, body: JSON.stringify({ contentArticleId: ids.articleId, contentVersionId: ids.articleVersionId, platforms: ["web", "zhihu"], platformOrder: ["web", "zhihu"], accountGroupId: "group-tongzhuo", mode: "immediate", webUrl: "https://tongzhuo.ink/insights/geo-facts-and-sources/", siteSlug: "geo-facts-and-sources", siteCategory: "GEO 方法", siteAuthor: "桐灼研究", article: { id: ids.articleId, title: article.title } }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.publisherJobId = String(result.body.job.id); ids.publicationTaskIds = result.body.publicationTasks.map((item) => item.id);
  result = await request(base, `/api/v1/publisher/jobs/${ids.publisherJobId}/claim`, { method: "POST", headers: worker, body: "{}" }); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(base, `/api/v1/publisher/jobs/${ids.publisherJobId}/start`, { method: "POST", headers: worker, body: "{}" }); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(base, `/api/v1/publisher/jobs/${ids.publisherJobId}/result`, { method: "POST", headers: worker, body: JSON.stringify({ state: "published", platform_results: { web: { state: "published", remote_url: "https://tongzhuo.ink/insights/geo-facts-and-sources/", data_origin: "enterprise_measured", message: "P7-T02 local-runtime 官网发布结果" }, zhihu: { state: "published", remote_url: "https://mock.example/zhihu/tongzhuo-e2e", data_origin: "mock_demo", message: "P7-T02 Mock 外部平台结果" } } }) }); assert.equal(result.response.status, 200, JSON.stringify(result.body)); ids.websitePublicationUrl = "https://tongzhuo.ink/insights/geo-facts-and-sources/"; ids.externalPublicationUrl = "https://mock.example/zhihu/tongzhuo-e2e";

  siteRuntime = createSiteRuntime({ databasePath, staticRoot: directory, host: "127.0.0.1", port: 0, baseUrl: "https://tongzhuo.ink", workspaceId: workspaceId, projectId, projectSeedKey: "tongzhuo-geo", flushIntervalMs: 60_000, logger: { info() {}, warn() {}, error() {} } });
  await siteRuntime.listen(0); const siteAddress = siteRuntime.server.address(); assert.ok(siteAddress && typeof siteAddress.port === "number" && siteAddress.port > 0, JSON.stringify(siteAddress)); const siteBase = `http://127.0.0.1:${siteAddress.port}`;
  result = await request(siteBase, "/insights/geo-facts-and-sources/"); assert.equal(result.response.status, 200, result.text); assert.match(result.text, /企业如何从事实与公开信源开始做 GEO/); const publishedHtml = result.text;
  result = await request(siteBase, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "lead-tongzhuo-e2e" }, body: JSON.stringify({ name: "P7 验收联系人", phone: "13900000000", company: "P7 验收企业", service: "GEO 诊断", message: "希望了解企业如何从事实和公开信源开始做 GEO。", source_url: "https://tongzhuo.ink/contact/", utm_source: "p7-e2e" }) }); assert.equal(result.response.status, 201, JSON.stringify(result.body)); ids.leadId = result.body.data?.id || result.body.data?.lead?.id || result.body.lead?.id || result.body.id; assert.ok(ids.leadId, JSON.stringify(result.body));

  result = await request(base, "/api/v1/monitoring/diagnostics", { method: "POST", headers: auth, body: JSON.stringify({ html: publishedHtml, baseUrl: "https://tongzhuo.ink/insights/geo-facts-and-sources/", sourceLabel: "P7-T02 本地发布快照", suggestionGeneration: { enabled: false } }) }); assert.equal(result.response.status, 202, JSON.stringify(result.body)); ids.monitoringReportId = result.body.data.diagnostic.id;
  for (let i = 0; i < 60; i += 1) { result = await request(base, `/api/v1/monitoring/diagnostics/${encodeURIComponent(ids.monitoringReportId)}`, { headers: { Cookie: cookie } }); if (["completed", "failed"].includes(result.body.data?.diagnostic?.status)) break; await new Promise((resolve) => setTimeout(resolve, 100)); }
  assert.equal(result.body.data.diagnostic.status, "completed", JSON.stringify(result.body)); const recommendations = result.body.data.diagnostic.recommendations?.recommended || []; assert.ok(recommendations.length, JSON.stringify(result.body)); ids.nextSuggestion = recommendations[0].item || recommendations[0].action;

  const verify = new ProductionDatabase({ databasePath });
  try {
    const taskRows = verify.connection.prepare("SELECT channel, status, remote_url, result_json FROM publication_tasks WHERE workspace_id = ? AND content_id = ? ORDER BY channel").all(workspaceId, ids.articleId);
    assert.equal(taskRows.find((item) => item.channel === "web")?.status, "published"); assert.equal(taskRows.find((item) => item.channel === "zhihu")?.status, "published");
    assert.equal(JSON.parse(taskRows.find((item) => item.channel === "web")?.result_json || "{}").dataOrigin, "enterprise_measured"); assert.equal(JSON.parse(taskRows.find((item) => item.channel === "zhihu")?.result_json || "{}").dataOrigin, "mock_demo");
    assert.equal(verify.connection.prepare("SELECT project_id FROM site_contact_leads WHERE id = ?").get(ids.leadId)?.project_id, projectId);
  } finally { verify.close(); }
  console.log(JSON.stringify({ status: "passed", ids }, null, 2));
} finally {
  await siteRuntime?.close?.();
  if (child?.exitCode === null && child?.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try { await rm(directory, { recursive: true, force: true }); break; }
    catch (error) { if (error?.code !== "EBUSY" || attempt === 9) throw error; await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
}
