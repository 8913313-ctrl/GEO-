import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";
import { ContentStore } from "../content-store.mjs";
import { importLegacyGeoFlowExport, LegacyGeoFlowImportError, LEGACY_GEOFLOW_EXPORT_FORMAT } from "./import-legacy-geoflow.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-legacy-import-"));
let database;

const exportData = {
  format: LEGACY_GEOFLOW_EXPORT_FORMAT,
  exportedAt: "2026-07-26T08:00:00.000Z",
  source: { id: "geoflow-site-2026-07-26", system: "GEOFlow", baseUrl: "https://legacy.example.com" },
  categories: [
    { id: "industry", name: "行业资讯", slug: "insights", description: "企业行业资讯", seoDescription: "企业行业资讯与方法", navVisible: true },
    { id: "guide", name: "采购指南", slug: "guides", parentId: "industry", navVisible: false }
  ],
  articles: [
    {
      id: "legacy-post-1",
      title: "制造业企业如何建立 GEO 内容体系",
      slug: "manufacturing-geo-content",
      categoryId: "industry",
      contentHtml: "<h1>制造业企业如何建立 GEO 内容体系</h1><p>先回答客户的真实问题，再提供可核验的企业事实。</p>",
      excerpt: "建立可持续的企业 GEO 内容体系。",
      keywords: ["制造业 GEO", "企业内容体系"],
      publishedAt: "2025-12-01T08:30:00+08:00",
      sourceUrl: "https://legacy.example.com/insights/manufacturing-geo-content",
      author: "桐灼科技"
    },
    {
      id: "legacy-post-2",
      title: "企业采购 GEO 服务前应确认哪些边界",
      slug: "geo-service-procurement-boundaries",
      categoryId: "guide",
      contentText: "企业在采购 GEO 服务前，应先确认目标、内容边界、审核责任和公开信源的归属。",
      excerpt: "采购 GEO 服务的关键确认项。",
      keywords: ["GEO 服务", "采购指南"],
      publishedAt: "2025-12-02T10:00:00.000Z"
    }
  ]
};

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "legacy.sqlite") });
  const preview = await importLegacyGeoFlowExport({ data: exportData, database, initializeWorkspace: true, dryRun: true });
  assert.equal(preview.dryRun, true);
  assert.equal(preview.articlesCreated, 2);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles").get().count, 0, "dry runs must not write articles");

  const first = await importLegacyGeoFlowExport({ data: exportData, database, initializeWorkspace: true });
  assert.equal(first.articlesCreated, 2);
  assert.equal(first.categoriesAdded, 2);
  const article = database.connection.prepare("SELECT * FROM content_articles WHERE id = ?").get(first.articleIds[0]);
  assert.equal(article.status, "published");
  assert.equal(article.created_at, "2025-12-01T00:30:00.000Z", "the legacy publication time must be retained in canonical UTC form");
  const version = database.connection.prepare("SELECT * FROM content_article_versions WHERE id = ?").get(article.current_version_id);
  assert.equal(version.source, "import");
  assert.equal(version.review_status, "approved");
  assert.equal(version.risk_status, "warning");
  assert.equal(version.frozen_at, "2025-12-01T00:30:00.000Z");
  const metadata = JSON.parse(article.metadata_json);
  assert.deepEqual(metadata.keywords, ["制造业 GEO", "企业内容体系"]);
  assert.equal(metadata.slug, "manufacturing-geo-content");
  assert.equal(metadata.legacyImport.sourceArticleId, "legacy-post-1");
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_article_reviews WHERE article_version_id = ?").get(version.id).count, 2);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_risk_scan_runs WHERE article_version_id = ?").get(version.id).count, 1);
  const contentStore = new ContentStore(database, { workspaceId: "default", requireEvidence: true });
  const contentArticle = contentStore.article("default", article.id, { includeVersion: true });
  assert.equal(contentArticle.status, "published");
  assert.equal(contentArticle.currentVersion.reviewStatus, "approved");
  assert.ok(contentArticle.currentVersion.frozenAt);
  assert.equal(contentStore.canPublish(article.id).ok, false, "legacy content remains protected from a new publish without current knowledge evidence");

  const workspace = database.connection.prepare("SELECT * FROM workspace_state WHERE workspace_id = 'default'").get();
  const workspaceState = JSON.parse(workspace.state_json);
  assert.equal(workspaceState.site.cms.categories.length, 2);
  assert.equal(workspaceState.site.cms.categories.find((item) => item.slug === "guides").parentId, workspaceState.site.cms.categories.find((item) => item.slug === "insights").id);
  assert.equal(workspaceState.site.cms.legacyImports.length, 1);
  const workspaceStore = new WorkspaceStore(database);
  const workspaceResave = workspaceStore.save("default", workspaceState, { expectedRevision: workspace.revision, reason: "legacy import compatibility check" });
  assert.equal(workspaceResave.revision, Number(workspace.revision) + 1, "the imported workspace must remain compatible with ordinary workspace saves");

  const second = await importLegacyGeoFlowExport({ data: exportData, database, initializeWorkspace: true });
  assert.equal(second.articlesCreated, 0);
  assert.equal(second.articlesSkipped, 2);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles").get().count, 2, "an identical rerun must be idempotent");

  const changed = structuredClone(exportData);
  changed.articles[0].title = "已改动的历史文章";
  await assert.rejects(
    () => importLegacyGeoFlowExport({ data: changed, database, initializeWorkspace: true }),
    (error) => error instanceof LegacyGeoFlowImportError && error.code === "LEGACY_IMPORT_SOURCE_CHANGED"
  );

  const unsafe = structuredClone(exportData);
  unsafe.source.id = "geoflow-site-unsafe";
  unsafe.articles[0].contentHtml = "<p>unsafe</p><script>alert(1)</script>";
  await assert.rejects(
    () => importLegacyGeoFlowExport({ data: unsafe, database, initializeWorkspace: true }),
    (error) => error instanceof LegacyGeoFlowImportError && error.code === "LEGACY_IMPORT_UNSAFE_HTML"
  );

  console.log("Legacy GEOFlow import check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
