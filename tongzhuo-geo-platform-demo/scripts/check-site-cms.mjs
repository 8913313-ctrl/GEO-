import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { SiteCmsError, SiteCmsStore } from "../site-cms-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-cms-"));
const databasePath = path.join(temporaryDirectory, "site-cms.sqlite");
const staticRoot = path.join(temporaryDirectory, "static-site");
const workspaceId = "default";
let database;
let runtime;

function clone(value) { return structuredClone(value); }

function expectCmsError(action, { status, code }) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof SiteCmsError, `expected SiteCmsError, received ${error?.constructor?.name || typeof error}`);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

function releaseRow(id) {
  const row = database.connection.prepare(`
    SELECT id, workspace_id, version_number, source_draft_revision, source_release_id,
      operation, snapshot_json, checksum, note, created_at, created_by
    FROM site_cms_releases
    WHERE id = ?
  `).get(id);
  return row ? { ...row } : null;
}

async function request(base, pathname) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual" });
  return { response, text: await response.text() };
}

const bootstrapCms = {
  schemaVersion: 1,
  settings: {
    siteName: "正式官网 v1",
    companyName: "测试企业有限公司",
    description: "这是已经正式发布的企业官网说明。",
    officialDomain: "cms.example.test",
    allowAiCrawl: true
  },
  pages: [
    { id: "home", type: "首页", title: "首页", path: "/", status: "published", sitemapEnabled: true },
    { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", sitemapEnabled: true },
    { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true },
    { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", sitemapEnabled: true },
    { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", sitemapEnabled: true }
  ],
  redirects: [
    { id: "legacy-products", from: "/legacy-products/", to: "/services/", status: "active", reason: "旧产品页地址调整" }
  ]
};

try {
  await mkdir(staticRoot, { recursive: true });
  await writeFile(path.join(staticRoot, "index.html"), "<!doctype html><html><head><title>旧模板</title></head><body><h1>企业官网</h1></body></html>");
  await writeFile(path.join(staticRoot, "products.html"), "<!doctype html><html><head><title>产品与服务</title></head><body><h1>产品与服务</h1></body></html>");

  database = new ProductionDatabase({ databasePath });
  const workspaceStore = new WorkspaceStore(database);
  workspaceStore.save(workspaceId, { site: { cms: bootstrapCms } }, { expectedRevision: 0 });

  const cmsStore = new SiteCmsStore(database, { workspaceId });
  const publicStore = new PublicSiteStore({ database, cmsStore, workspaceId });

  // Bootstrap creates one immutable release and points both draft and public
  // readers at the same normalized snapshot.
  const bootstrapDraft = cmsStore.draft(workspaceId);
  const bootstrapPublication = cmsStore.publication(workspaceId);
  assert.equal(bootstrapDraft.revision, 1);
  assert.equal(bootstrapPublication.version, 1);
  assert.equal(bootstrapPublication.operation, "bootstrap");
  assert.equal(bootstrapPublication.sourceDraftRevision, 1);
  assert.equal(bootstrapPublication.checksum, bootstrapDraft.checksum);
  assert.deepEqual(bootstrapPublication.snapshot, bootstrapDraft.snapshot);
  assert.equal(bootstrapDraft.snapshot.schemaVersion, 4);
  assert.equal(bootstrapDraft.snapshot.assets.defaultImageUrl, "/assets/template-01-default.png");
  assert.equal(Object.keys(bootstrapDraft.snapshot.templateConfigs).length, 11);
  assert.equal(bootstrapDraft.snapshot.footer.showIcp, true);
  const bootstrapReleases = cmsStore.releases(workspaceId);
  assert.equal(bootstrapReleases.length, 1);
  assert.equal(bootstrapReleases[0].id, bootstrapPublication.releaseId);
  assert.equal(bootstrapReleases[0].current, true);
  const frozenBootstrapRow = releaseRow(bootstrapPublication.releaseId);

  const bootstrapRedirects = bootstrapPublication.snapshot.redirects;
  assert.ok(bootstrapRedirects.some((item) => item.from === "/legacy-products/" && item.to === "/services/" && item.status === "active"));
  assert.ok(bootstrapRedirects.some((item) => item.from === "/products.html" && item.to === "/services/" && item.status === "active"));

  runtime = createSiteRuntime({
    store: publicStore,
    staticRoot,
    host: "127.0.0.1",
    port: 0,
    baseUrl: "https://cms.example.test",
    workspaceId,
    flushIntervalMs: 60_000,
    logger: { info() {}, warn() {}, error() {} }
  });
  const address = await runtime.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;

  let redirected = await request(base, "/products.html?source=legacy");
  assert.equal(redirected.response.status, 301);
  assert.equal(redirected.response.headers.get("location"), "/services/?source=legacy");
  redirected = await request(base, "/legacy-products/?source=cms");
  assert.equal(redirected.response.status, 301);
  assert.equal(redirected.response.headers.get("location"), "/services/?source=cms");

  const draftCms = clone(bootstrapDraft.snapshot);
  draftCms.settings.siteName = "仅草稿可见的官网 v2";
  draftCms.settings.description = "这段内容在发布前不能影响正式官网。";
  draftCms.assets = {
    ...draftCms.assets,
    logoUrl: "/assets/company-logo.png",
    defaultImageUrl: "/assets/default-cover.webp"
  };
  draftCms.templateConfigs["01-industry"].defaultImageUrl = "/assets/industry-default.webp";
  draftCms.footer = {
    ...draftCms.footer,
    icpNumber: "京ICP备00000000号",
    policeRecordNumber: "京公网安备00000000000000号",
    columns: [{ id: "footer-services", title: "服务项目", links: [{ id: "footer-services-1", label: "服务详情", href: "/services/" }, { id: "footer-services-2", label: "联系电话", href: "tel:400-000-0000" }] }],
    socialLinks: [{ id: "footer-social-1", label: "企业主页", href: "https://example.com/company" }]
  };
  draftCms.pages.push(
    { id: "published-after-release", type: "专题页", title: "待发布专题", path: "/published-after-release/", status: "published", sitemapEnabled: true },
    { id: "draft-only", type: "专题页", title: "内部草稿专题", path: "/draft-only/", status: "draft", sitemapEnabled: true }
  );
  const savedDraft = cmsStore.saveDraft({ expectedRevision: bootstrapDraft.revision, cms: draftCms }, null, null, workspaceId);
  assert.equal(savedDraft.revision, 2);
  assert.notEqual(savedDraft.checksum, bootstrapDraft.checksum);

  // Preview reads the current draft, while the default public snapshot remains
  // pinned to the last published release.
  const previewSnapshot = publicStore.snapshot({ draft: true });
  const formalBeforePublish = publicStore.snapshot();
  assert.equal(previewSnapshot.cms.mode, "draft");
  assert.equal(previewSnapshot.cms.revision, savedDraft.revision);
  assert.equal(previewSnapshot.site.siteName, "仅草稿可见的官网 v2");
  assert.equal(formalBeforePublish.cms.mode, "published");
  assert.equal(formalBeforePublish.cms.releaseId, bootstrapPublication.releaseId);
  assert.equal(formalBeforePublish.site.siteName, "正式官网 v1");

  let sitemap = await request(base, "/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.doesNotMatch(sitemap.text, /published-after-release/);
  assert.doesNotMatch(sitemap.text, /draft-only/);

  expectCmsError(
    () => cmsStore.saveDraft({ expectedRevision: bootstrapDraft.revision, cms: draftCms }, null, null, workspaceId),
    { status: 409, code: "SITE_CMS_DRAFT_CONFLICT" }
  );
  expectCmsError(
    () => cmsStore.publish({ expectedDraftRevision: bootstrapDraft.revision }, null, null, workspaceId),
    { status: 409, code: "SITE_CMS_PUBLISH_CONFLICT" }
  );

  const published = cmsStore.publish({ expectedDraftRevision: savedDraft.revision, note: "发布 CMS 自动化测试版本" }, null, null, workspaceId);
  assert.equal(published.version, 2);
  assert.equal(published.operation, "publish");
  assert.equal(published.sourceDraftRevision, savedDraft.revision);
  assert.equal(published.snapshot.settings.siteName, "仅草稿可见的官网 v2");
  assert.equal(published.snapshot.assets.logoUrl, "/assets/company-logo.png");
  assert.equal(published.snapshot.assets.defaultImageUrl, "/assets/default-cover.webp");
  assert.equal(published.snapshot.templateConfigs["01-industry"].defaultImageUrl, "/assets/industry-default.webp");
  assert.equal(published.snapshot.footer.icpNumber, "京ICP备00000000号");
  assert.equal(published.snapshot.footer.columns[0].links[1].href, "tel:400-000-0000");
  assert.equal(published.snapshot.footer.socialLinks[0].href, "https://example.com/company");
  const publishedRelease = cmsStore.releases(workspaceId).find((item) => item.id === published.releaseId);
  assert.equal(publishedRelease.sourceReleaseId, bootstrapPublication.releaseId);
  const frozenPublishedRow = releaseRow(published.releaseId);

  const formalAfterPublish = publicStore.snapshot();
  assert.equal(formalAfterPublish.cms.releaseId, published.releaseId);
  assert.equal(formalAfterPublish.cms.version, 2);
  assert.equal(formalAfterPublish.site.cmsReleaseVersion, 2);
  assert.equal(formalAfterPublish.site.siteName, "仅草稿可见的官网 v2");

  sitemap = await request(base, "/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.match(sitemap.text, /published-after-release/);
  assert.doesNotMatch(sitemap.text, /draft-only/);

  // A later draft must not mutate the already-published v2 release.
  const nextCms = clone(savedDraft.snapshot);
  nextCms.settings.siteName = "尚未发布的官网 v3";
  const laterDraft = cmsStore.saveDraft({ expectedRevision: savedDraft.revision, cms: nextCms }, null, null, workspaceId);
  assert.equal(laterDraft.revision, 3);
  assert.equal(publicStore.snapshot().site.siteName, "仅草稿可见的官网 v2");
  assert.equal(publicStore.snapshot({ draft: true }).site.siteName, "尚未发布的官网 v3");
  assert.deepEqual(releaseRow(bootstrapPublication.releaseId), frozenBootstrapRow);
  assert.deepEqual(releaseRow(published.releaseId), frozenPublishedRow);

  expectCmsError(
    () => cmsStore.rollback({ releaseId: bootstrapPublication.releaseId, expectedCurrentVersion: 1 }, null, null, workspaceId),
    { status: 409, code: "SITE_CMS_ROLLBACK_CONFLICT" }
  );

  const rolledBack = cmsStore.rollback({
    releaseId: bootstrapPublication.releaseId,
    expectedCurrentVersion: published.version,
    note: "回滚到官网初始正式版本"
  }, null, null, workspaceId);
  assert.equal(rolledBack.publication.version, 3);
  assert.equal(rolledBack.publication.operation, "rollback");
  assert.notEqual(rolledBack.publication.releaseId, bootstrapPublication.releaseId, "rollback must create a new release instead of reusing history");
  assert.equal(rolledBack.publication.checksum, bootstrapPublication.checksum);
  assert.deepEqual(rolledBack.publication.snapshot, bootstrapPublication.snapshot);
  assert.equal(rolledBack.draft.revision, laterDraft.revision + 1);
  assert.equal(rolledBack.draft.checksum, bootstrapPublication.checksum);

  const releasesAfterRollback = cmsStore.releases(workspaceId);
  assert.deepEqual(releasesAfterRollback.map((item) => item.version), [3, 2, 1]);
  assert.equal(releasesAfterRollback.filter((item) => item.current).length, 1);
  assert.equal(releasesAfterRollback[0].id, rolledBack.publication.releaseId);
  assert.equal(releasesAfterRollback[0].sourceReleaseId, bootstrapPublication.releaseId);
  assert.deepEqual(releaseRow(bootstrapPublication.releaseId), frozenBootstrapRow);
  assert.deepEqual(releaseRow(published.releaseId), frozenPublishedRow);

  assert.equal(publicStore.snapshot().site.siteName, "正式官网 v1");
  sitemap = await request(base, "/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.doesNotMatch(sitemap.text, /published-after-release/);
  assert.doesNotMatch(sitemap.text, /draft-only/);

  const auditActions = database.connection.prepare("SELECT action FROM audit_logs WHERE action LIKE 'site.cms.%' ORDER BY created_at, id").all().map((row) => row.action);
  assert.ok(auditActions.includes("site.cms.draft.save"));
  assert.ok(auditActions.includes("site.cms.publish"));
  assert.ok(auditActions.includes("site.cms.rollback"));

  console.log("Official site CMS publication contract check passed");
} finally {
  await runtime?.close();
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
