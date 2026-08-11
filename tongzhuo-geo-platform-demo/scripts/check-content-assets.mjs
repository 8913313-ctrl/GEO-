import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentAssetError, ContentAssetStore, normalizeContentAssetUrl } from "../content-asset-store.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { openProductionDatabase } from "../production-foundation.mjs";

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-content-assets-"));
const database = openProductionDatabase({ databasePath: path.join(temp, "assets.sqlite") });

function insertArticle(workspaceId, articleId, versionId, title, status = "published") {
  const timestamp = new Date().toISOString();
  database.connection.prepare(`INSERT INTO content_articles (id, workspace_id, title, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, '{}', ?, ?)`)
    .run(articleId, workspaceId, title, status, versionId, versionId, timestamp, timestamp);
  database.connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at) VALUES (?, ?, 1, ?, '<p>verified</p>', 'verified', '', ?, 'human', 'approved', 'passed', '{}', ?, ?)`)
    .run(versionId, articleId, title, `hash-${articleId}`, timestamp, timestamp);
}

try {
  insertArticle("default", "ART-ASSET-1", "VER-ASSET-1", "资产追踪测试文章");
  insertArticle("default", "ART-ASSET-DRAFT", "VER-ASSET-DRAFT", "尚未发布的草稿文章", "draft");
  insertArticle("tenant-b", "ART-ASSET-B", "VER-ASSET-B", "其他租户文章");
  let responseBody = "<html><head><link rel=\"canonical\" href=\"https://www.example.com/article\"></head><body>v1</body></html>";
  const store = new ContentAssetStore(database, {
    workspaceId: "default",
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async () => new Response(responseBody, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
  });

  assert.equal(normalizeContentAssetUrl("https://www.example.com/article?utm_source=test&b=2&a=1#top"), "https://www.example.com/article?a=1&b=2");
  const asset = store.ensureAsset({ articleId: "ART-ASSET-1" });
  assert.equal(asset.articleId, "ART-ASSET-1");
  store.ensureAsset({ articleId: "ART-ASSET-DRAFT" });
  assert.deepEqual(store.list({ publishedOnly: true }).map((item) => item.articleId), ["ART-ASSET-1"], "published-only asset lists must hide drafts without a publication");

  const manual = store.upsertPublication({ articleId: "ART-ASSET-1", articleVersionId: "VER-ASSET-1", platform: "manual", platformName: "行业媒体", source: "manual", url: "https://media.example.com/post/1?utm_medium=x" });
  assert.equal(manual.created, true);
  const duplicate = store.upsertPublication({ articleId: "ART-ASSET-1", articleVersionId: "VER-ASSET-1", platform: "manual", platformName: "行业媒体", source: "manual", url: "https://media.example.com/post/1" });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.unchanged, true);

  const synced = store.syncPublisherJob({ id: 88, articleId: "ART-ASSET-1", contentVersionId: "VER-ASSET-1", updatedAt: new Date().toISOString(), results: { web: { state: "published", remote_url: "https://www.example.com/article?fbclid=x" }, zhihu: { state: "published", remote_url: "https://www.zhihu.com/p/123" }, failed: { state: "failed", remote_url: "https://failed.example/1" } } });
  assert.equal(synced.synced, 2);
  assert.equal(store.get("default", asset.id).publications.length, 3);
  assert.equal(store.list({ workspaceId: "tenant-b" }).length, 0, "workspace list must not leak another workspace");

  let checked = await store.checkPublication({ assetId: asset.id, publicationId: synced.publications.find((item) => item.platform === "web").id });
  assert.equal(checked.healthStatus, "healthy");
  assert.equal(checked.declaredCanonicalUrl, "https://www.example.com/article");
  responseBody = "<html><body>v2 changed</body></html>";
  checked = await store.checkPublication({ assetId: asset.id, publicationId: checked.id });
  assert.equal(checked.healthStatus, "changed");
  assert.ok(store.get("default", asset.id).alerts.some((item) => item.type === "url_changed" && item.status === "open"));

  const diagnosticStore = new DiagnosticStore(database);
  const project = diagnosticStore.createProject({ name: "内容资产引用关联", diagnosticType: "comprehensive", industry: "工业自动化", targetBrand: "测试品牌" });
  const questionSet = diagnosticStore.freezeQuestionSet({ questionSetId: diagnosticStore.createQuestionSet({ projectId: project.id, questions: [{ id: "Q-ASSET-1", text: "测试品牌如何选择？" }] }).id });
  const run = diagnosticStore.createRun({ projectId: project.id, questionSetId: questionSet.id, evidenceScope: { live: true }, input: { source: "content-asset-check" } });
  const evidence = diagnosticStore.addEvidence({
    runId: run.id, evidenceType: "live", sourceKind: "aidso", sourceId: "aidso-content-asset-check",
    title: "AI 回答", sourceUrl: "https://www.example.com/article?utm_source=ai", claim: "已引用资产文章", excerpt: "已引用资产文章",
    verificationStatus: "verified", observedAt: "2026-08-03T12:00:00.000Z",
    provenance: { collectionMethod: "relay_pull", platform: "DB", terminal: "web", mode: "fast", questionId: "Q-ASSET-1" },
    payload: { request: { questionId: "Q-ASSET-1", prompt: "测试品牌如何选择？" }, delivery: { normalized: { quotes: [{ url: "https://www.example.com/article?utm_campaign=test", title: "资产文章", rank: 1 }] } } }
  });
  const citationSync = store.ingestEvidence(evidence);
  assert.equal(citationSync.created, 1, "verified live source URLs must match tracked publications");
  assert.equal(store.ingestEvidence(evidence).created, 0, "the same evidence delivery must be idempotent");
  const citedAsset = store.get("default", asset.id);
  assert.equal(citedAsset.citationSummary.citationCount, 1);
  assert.equal(citedAsset.citationSummary.questionCount, 1);
  assert.equal(citedAsset.recentCitations[0].evidenceId, evidence.id);
  assert.equal(citedAsset.recentCitations[0].platform, "DB");
  assert.ok(citedAsset.alerts.some((item) => item.type === "citation_first"));
  assert.equal(store.syncEvidence({ workspaceId: "default" }).created, 0, "evidence backfill must remain idempotent");

  const afterRemove = store.removePublication({ assetId: asset.id, publicationId: manual.publication.id });
  assert.equal(afterRemove.publications.some((item) => item.id === manual.publication.id), false);
  assert.throws(() => store.removePublication({ assetId: asset.id, publicationId: synced.publications[0].id }), (error) => error instanceof ContentAssetError && error.code === "CONTENT_ASSET_PUBLICATION_MANAGED");

  const blockedStore = new ContentAssetStore(database, { workspaceId: "default", lookup: async () => [{ address: "127.0.0.1", family: 4 }], fetchImpl: async () => new Response("ok") });
  const blocked = store.upsertPublication({ articleId: "ART-ASSET-1", platform: "manual", platformName: "内网", source: "manual", url: "https://internal.example/post" });
  await assert.rejects(() => blockedStore.checkPublication({ assetId: asset.id, publicationId: blocked.publication.id }), (error) => error instanceof ContentAssetError && error.code === "CONTENT_ASSET_URL_BLOCKED");
  const blockedAsset = store.get("default", asset.id);
  assert.equal(blockedAsset.publications.find((item) => item.id === blocked.publication.id).healthStatus, "blocked");
  assert.ok(blockedAsset.alerts.some((item) => item.type === "url_unreachable"));

  database.connection.prepare("UPDATE content_asset_publications SET next_check_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", synced.publications.find((item) => item.platform === "web").id);
  database.connection.prepare("UPDATE content_asset_citations SET observed_at = '2026-01-01T00:00:00.000Z' WHERE evidence_id = ?").run(evidence.id);
  const patrol = await store.patrolDue({ limit: 1, citationStaleDays: 1 });
  assert.equal(patrol.checked, 1);
  assert.equal(patrol.succeeded, 1);
  assert.equal(patrol.staleCitations, 1);
  assert.ok(store.get("default", asset.id).alerts.some((item) => item.type === "citation_stale"));

  const tables = database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'content_asset%' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(tables, ["content_asset_alerts", "content_asset_citations", "content_asset_publications", "content_assets"]);
  console.log("Content asset production tracking checks passed");
} finally {
  database.close();
  await rm(temp, { recursive: true, force: true });
}
