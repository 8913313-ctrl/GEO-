import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { renderFixedPage } from "../public-site/site-renderer.mjs";
import { listSiteTemplates, resolveSiteTemplateKey } from "../public-site/templates/site-template-registry.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-templates-"));
const workspaceId = "tenant-template-contract";
let database;

try {
  assert.deepEqual(listSiteTemplates().map((item) => item.key), ["professional", "industrial", "energy", "beauty"]);
  assert.equal(resolveSiteTemplateKey("building-materials"), "industrial");
  assert.equal(resolveSiteTemplateKey("ups"), "energy");
  assert.equal(resolveSiteTemplateKey("skincare"), "beauty");
  assert.equal(resolveSiteTemplateKey("not-a-template"), "professional");

  database = new ProductionDatabase({ databasePath: path.join(directory, "templates.sqlite") });
  new WorkspaceStore(database).save(workspaceId, {
    enterpriseProfile: { companyName: "示例设备有限公司", brandName: "示例设备" },
    businessLines: [{ id: "line-1", name: "可靠设备", product: "可靠设备", description: "用于模板隔离验收的客户业务数据。" }],
    site: { cms: {
      schemaVersion: 2,
      settings: { siteName: "示例设备", companyName: "示例设备有限公司", description: "客户自己的公开信息。" },
      theme: { key: "professional", name: "客户主题", primaryColor: "#345678", cta: "联系我们" },
      pages: [{ id: "home", title: "首页", path: "/", status: "published" }],
      modules: { home: [{ id: "home-hero", type: "hero", title: "首页", content: "客户自己的公开信息。", status: "published" }] },
      navItems: [{ id: "home", label: "首页", path: "/", visible: true }],
      categories: [], services: [], cases: [], problemGroups: [], redirects: []
    } }
  }, { expectedRevision: 0 });

  const cmsStore = new SiteCmsStore(database, { workspaceId });
  const publicStore = new PublicSiteStore({ database, cmsStore, workspaceId });
  const publishedBefore = publicStore.snapshot();
  const businessBefore = structuredClone(publishedBefore.site.businessLines);
  assert.equal(publishedBefore.site.theme.key, "professional");

  const cms = structuredClone(cmsStore.draft().snapshot);
  cms.theme.key = "energy";
  const saved = cmsStore.saveDraft({ expectedRevision: cmsStore.draft().revision, cms });
  const preview = publicStore.snapshot({ draft: true });
  assert.equal(preview.site.theme.key, "energy");
  assert.equal(preview.site.template.key, "energy");
  assert.deepEqual(preview.site.businessLines, businessBefore, "template switching must not mutate business data");
  assert.equal(publicStore.snapshot().site.theme.key, "professional", "draft template must not leak into publication");

  const homePage = preview.site.pages.find((page) => page.id === "home");
  const previewHtml = renderFixedPage({ site: preview.site, page: homePage, origin: "https://example.test", preview: true });
  assert.match(previewHtml, /class="site-v8 site-template-energy/);
  assert.match(previewHtml, /data-site-template="energy"/);
  assert.match(previewHtml, /示例设备/);
  assert.doesNotMatch(previewHtml, /桐灼科技|灼见 GEO/, "client template must not inject Tongzhuo identity");
  assert.doesNotMatch(previewHtml, /aria-label="桐灼服务重点"/, "client template accessibility text must not inject Tongzhuo identity");

  cmsStore.submitReview({ reason: "模板预览验收" });
  cmsStore.approve({ reason: "客户内容与模板通过审核" });
  const publication = cmsStore.publish({ expectedDraftRevision: saved.revision, note: "发布能源设备模板" });
  assert.equal(publication.snapshot.theme.key, "energy");
  assert.equal(publicStore.snapshot().site.theme.key, "energy");
  assert.deepEqual(publicStore.snapshot().site.businessLines, businessBefore);
  assert.equal(cmsStore.releases()[0].sourceDraftRevision, saved.revision, "published template must remain traceable to its draft snapshot");

  console.log("Site template registry, aliases, draft preview isolation, publication snapshot, customer identity and shared CMS data contract passed.");
} finally {
  database?.close();
  await rm(directory, { recursive: true, force: true });
}
