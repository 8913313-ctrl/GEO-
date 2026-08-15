import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { renderFixedPage } from "../public-site/site-renderer.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { DEFAULT_SITE_TEMPLATE_KEY, getSiteTemplate, listSiteTemplates, resolveSiteTemplateKey } from "../public-site/templates/site-template-registry.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-template-registry-"));
const workspaceId = "deployment-site-template-registry";
const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
let database;

function customerCms() {
  return {
    schemaVersion: 2,
    settings: {
      siteName: "示例企业",
      companyName: "示例企业有限公司",
      description: "由同一 CMS 数据契约提供的公开信息。"
    },
    theme: { key: "professional", name: "企业官网模板", primaryColor: "#345678", cta: "联系我们" },
    pages: [{ id: "home", title: "首页", path: "/", status: "published" }],
    modules: { home: [{ id: "home-hero", type: "hero", title: "首页", content: "由同一 CMS 数据契约提供的公开信息。", status: "published" }] },
    navItems: [{ id: "home", label: "首页", path: "/", visible: true }],
    categories: [], services: [], cases: [], problemGroups: [], redirects: []
  };
}

try {
  const templates = listSiteTemplates();
  assert.equal(DEFAULT_SITE_TEMPLATE_KEY, "space-materials");
  assert.deepEqual(templates.map((template) => template.key), ["space-materials", "power-systems", "supply-chain"]);
  assert.equal(resolveSiteTemplateKey("professional"), "space-materials");
  assert.equal(resolveSiteTemplateKey("industrial"), "space-materials");
  assert.equal(resolveSiteTemplateKey("energy"), "power-systems");
  assert.equal(resolveSiteTemplateKey("beauty"), "space-materials");
  assert.equal(resolveSiteTemplateKey("engineering-case"), "space-materials");
  assert.equal(resolveSiteTemplateKey("product-matrix"), "supply-chain");
  assert.equal(resolveSiteTemplateKey("tiles"), "space-materials");
  assert.equal(resolveSiteTemplateKey("ups-console"), "power-systems");
  assert.equal(resolveSiteTemplateKey("logistics"), "supply-chain");
  assert.equal(resolveSiteTemplateKey("unknown"), DEFAULT_SITE_TEMPLATE_KEY);
  for (const template of templates) {
    assert.match(template.key, /^[a-z][a-z0-9-]*$/);
    assert.ok(template.category && template.variant && template.name && template.description && /^#[0-9a-f]{6}$/i.test(template.color));
    assert.equal(getSiteTemplate(template.key).key, template.key);
  }

  const themeCss = await readFile(path.resolve(moduleRoot, "..", "public-site", "themes", "templates.css"), "utf8");
  for (const template of templates) assert.match(themeCss, new RegExp(`\\.site-template-${template.key}\\b`));
  assert.match(themeCss, /site-template-space-materials[\s\S]*space-hero/, "space-materials must provide an archive-led composition");
  assert.match(themeCss, /site-template-power-systems[\s\S]*power-hero/, "power-systems must provide a control-room composition");
  assert.match(themeCss, /site-template-supply-chain[\s\S]*flow-hero/, "supply-chain must provide a service-routing composition");
  assert.match(themeCss, /@media \(max-width: 680px\)/);
  assert.doesNotMatch(themeCss, /桐灼科技|客户案例|增长\s*\d|节省\s*\d|提升\s*\d/);

  database = new ProductionDatabase({ databasePath: path.join(directory, "templates.sqlite") });
  new WorkspaceStore(database).save(workspaceId, {
    enterpriseProfile: { companyName: "示例企业有限公司", brandName: "示例企业" },
    businessLines: [{ id: "line-1", name: "公开服务", product: "公开服务", description: "客户自己的公开服务说明。" }],
    site: { cms: customerCms() }
  }, { expectedRevision: 0 });

  const cmsStore = new SiteCmsStore(database, { workspaceId });
  const publicStore = new PublicSiteStore({ database, cmsStore, workspaceId });
  cmsStore.submitReview({ reason: "建立模板注册表首次发布基线" });
  cmsStore.approve({ reason: "首次发布基线审核通过" });
  cmsStore.publish({ expectedDraftRevision: cmsStore.draft().revision, note: "发布空间材料模板基线" });
  const originalPublication = publicStore.snapshot();
  const originalBusinessLines = structuredClone(originalPublication.site.businessLines);
  let expectedPublishedTemplate = "space-materials";
  assert.equal(originalPublication.site.theme.key, "space-materials");

  for (const template of templates) {
    const draftRecord = cmsStore.draft();
    const cms = structuredClone(draftRecord.snapshot);
    cms.theme.key = template.key;
    const saved = cmsStore.saveDraft({ expectedRevision: draftRecord.revision, cms });
    const preview = publicStore.snapshot({ draft: true });
    assert.equal(preview.site.theme.key, template.key);
    assert.equal(preview.site.template.key, template.key);
    assert.deepEqual(preview.site.businessLines, originalBusinessLines, `${template.key} changed customer data`);
    assert.equal(publicStore.snapshot().site.theme.key, expectedPublishedTemplate, "draft selection leaked to publication");

    const home = preview.site.pages.find((page) => page.id === "home");
    const html = renderFixedPage({ site: preview.site, page: home, origin: "https://example.test", preview: true });
    assert.match(html, new RegExp(`site-template-${template.key}`));
    assert.match(html, new RegExp(`data-site-template="${template.key}"`));
    assert.match(html, /<style id="site-template-styles">/);
    assert.match(html, /示例企业/);
    assert.doesNotMatch(html, /桐灼科技|灼见 GEO/, "template injected vendor/customer facts");

    if (template.key === "supply-chain") {
      cmsStore.submitReview({ reason: "模板注册表验收" });
      cmsStore.approve({ reason: "模板及客户内容通过审核" });
      const publication = cmsStore.publish({ expectedDraftRevision: saved.revision, note: "发布物流供应链模板快照" });
      assert.equal(publication.snapshot.theme.key, "supply-chain");
      assert.equal(publicStore.snapshot().site.theme.key, "supply-chain");
      assert.equal(cmsStore.releases()[0].sourceDraftRevision, saved.revision);
      expectedPublishedTemplate = "supply-chain";
      const nextDraft = cmsStore.draft();
      const resetCms = structuredClone(nextDraft.snapshot);
      resetCms.theme.key = "space-materials";
      cmsStore.saveDraft({ expectedRevision: nextDraft.revision, cms: resetCms });
    }
  }

  console.log("Site template registry, independent visual themes, shared CMS contract, preview isolation, published snapshot and responsive CSS checks passed.");
} finally {
  database?.close();
  await rm(directory, { recursive: true, force: true });
}
