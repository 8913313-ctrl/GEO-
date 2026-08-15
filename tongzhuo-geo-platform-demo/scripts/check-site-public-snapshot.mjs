import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { SiteCmsError, SiteCmsStore } from "../site-cms-store.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-public-snapshot-"));
const databasePath = path.join(temporaryDirectory, "public-snapshot.sqlite");
const workspaceA = "deployment-building-materials";
const workspaceB = "deployment-machinery";
let database;

function cms(name) {
  return {
    schemaVersion: 2,
    settings: { siteName: name, companyName: `${name}有限公司`, officialDomain: `${name === "甲方建材" ? "building" : "machinery"}.example.test`, description: `${name}正式公开信息。` },
    pages: [
      { id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true },
      { id: "insights", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true }
    ],
    navItems: [{ id: "home", label: "首页", path: "/", visible: true }, { id: "insights", label: "行业资讯", path: "/insights/", visible: true }],
    categories: [], services: [], cases: [], problemGroups: [], businessLines: [], redirects: [], modules: {}, theme: {}
  };
}

function insertArticle({ id, workspaceId, title, slug, status = "published", approved = true }) {
  const now = new Date().toISOString();
  const versionId = `${id}-V1`;
  const html = `<h2>直接回答</h2><p>${title}的正式正文。</p>`;
  const metadata = JSON.stringify({ siteSlug: slug, sitePublishedAt: now });
  database.connection.prepare(`INSERT INTO content_articles (id, workspace_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at) VALUES (?, ?, ?, '行业知识', ?, NULL, NULL, 1, ?, ?, ?)`)
    .run(id, workspaceId, title, status, metadata, now, now);
  database.connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'human', ?, 'passed', '{}', ?, ?)`)
    .run(versionId, id, title, html, title, `${title}摘要`, createHash("sha256").update(html).digest("hex"), approved ? "approved" : "draft", approved ? now : null, now);
  database.connection.prepare("UPDATE content_articles SET current_version_id = ?, approved_version_id = ? WHERE id = ?")
    .run(versionId, approved ? versionId : null, id);
  return { versionId };
}

function sqliteError(action, marker) {
  assert.throws(action, (error) => {
    assert.match(String(error?.message || error), marker);
    return true;
  });
}

try {
  database = new ProductionDatabase({ databasePath });
  const workspaces = new WorkspaceStore(database);
  workspaces.save(workspaceA, { site: { cms: cms("甲方建材") } }, { expectedRevision: 0 });
  workspaces.save(workspaceB, { site: { cms: cms("乙方机械") } }, { expectedRevision: 0 });

  const cmsA = new SiteCmsStore(database, { workspaceId: workspaceA });
  const cmsB = new SiteCmsStore(database, { workspaceId: workspaceB });
  const publicA = new PublicSiteStore({ database, cmsStore: cmsA, workspaceId: workspaceA });
  const publicB = new PublicSiteStore({ database, cmsStore: cmsB, workspaceId: workspaceB });
  const releaseA1 = cmsA.publication();
  const releaseB1 = cmsB.publication();
  assert.notEqual(releaseA1.releaseId, releaseB1.releaseId);
  assert.equal(publicA.snapshot().site.siteName, "甲方建材");
  assert.equal(publicB.snapshot().site.siteName, "乙方机械");

  // Saving a draft changes only the authenticated preview. The public reader
  // stays pinned to the current immutable release until an explicit publish.
  const draftA = structuredClone(cmsA.draft().snapshot);
  draftA.settings.siteName = "甲方建材未发布草稿";
  const savedA = cmsA.saveDraft({ expectedRevision: 1, cms: draftA });
  assert.equal(publicA.snapshot({ draft: true }).site.siteName, "甲方建材未发布草稿");
  assert.equal(publicA.snapshot().site.siteName, "甲方建材");
  assert.equal(publicB.snapshot().site.siteName, "乙方机械");

  cmsA.submitReview({ reason: "提交甲方官网审核" });
  cmsA.approve({ reason: "甲方官网审核通过" });
  const releaseA2 = cmsA.publish({ expectedDraftRevision: savedA.revision, note: "发布甲方官网 v2" });
  assert.equal(releaseA2.version, 2);
  assert.equal(releaseA2.sourceDraftRevision, savedA.revision);
  assert.equal(publicA.snapshot().site.siteName, "甲方建材未发布草稿");
  assert.equal(publicB.snapshot().site.siteName, "乙方机械");

  // Public articles use the same workspace boundary and publication gate.
  insertArticle({ id: "ART-BUILDING-PUBLIC", workspaceId: workspaceA, title: "甲方建材正式文章", slug: "building-public" });
  insertArticle({ id: "ART-BUILDING-DRAFT", workspaceId: workspaceA, title: "甲方建材内部草稿", slug: "building-draft", status: "draft", approved: false });
  insertArticle({ id: "ART-MACHINERY-PUBLIC", workspaceId: workspaceB, title: "乙方机械正式文章", slug: "machinery-public" });
  assert.deepEqual(publicA.snapshot().articles.map((item) => item.title), ["甲方建材正式文章"]);
  assert.deepEqual(publicB.snapshot().articles.map((item) => item.title), ["乙方机械正式文章"]);

  // Database-level constraints reject a pointer or rollback ancestry that
  // crosses the independently deployed enterprise boundary.
  sqliteError(
    () => database.connection.prepare("UPDATE site_cms_publications SET release_id = ?, version_number = ? WHERE workspace_id = ?").run(releaseB1.releaseId, releaseB1.version, workspaceA),
    /site publication release boundary mismatch/
  );
  sqliteError(
    () => database.connection.prepare(`INSERT INTO site_cms_releases (id, workspace_id, version_number, source_draft_revision, source_release_id, operation, snapshot_json, checksum, note, created_at, created_by) VALUES ('CROSS-SOURCE', ?, 99, 1, ?, 'rollback', '{}', ?, '', ?, NULL)`)
      .run(workspaceA, releaseB1.releaseId, "0".repeat(64), new Date().toISOString()),
    /site release source boundary mismatch/
  );
  sqliteError(
    () => database.connection.prepare("UPDATE site_cms_releases SET note = 'mutated' WHERE id = ?").run(releaseA2.releaseId),
    /site CMS release is immutable/
  );
  sqliteError(
    () => database.connection.prepare("DELETE FROM site_cms_releases WHERE id = ?").run(releaseA1.releaseId),
    /site CMS release cannot be deleted/
  );

  // The application query also fails closed if it encounters legacy/corrupt
  // data from before the database trigger existed.
  database.connection.exec("DROP TRIGGER site_cms_publications_release_boundary_update");
  database.connection.prepare("UPDATE site_cms_publications SET release_id = ?, version_number = ? WHERE workspace_id = ?")
    .run(releaseB1.releaseId, releaseB1.version, workspaceA);
  assert.throws(() => cmsA.publication(), (error) => {
    assert.ok(error instanceof SiteCmsError);
    assert.equal(error.status, 503);
    assert.equal(error.code, "SITE_CMS_PUBLICATION_INVALID");
    return true;
  });

  console.log("Official-site published snapshot, draft isolation, article gate, deployment boundary, and immutable release checks passed.");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
