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
const workspaceId = "deployment-template-contract";
let database;

try {
  assert.deepEqual(listSiteTemplates().map((item) => item.key), ["space-materials", "power-systems", "supply-chain"]);
  assert.equal(resolveSiteTemplateKey("industrial"), "space-materials");
  assert.equal(resolveSiteTemplateKey("energy"), "power-systems");
  assert.equal(resolveSiteTemplateKey("product-matrix"), "supply-chain");
  assert.equal(resolveSiteTemplateKey("tiles"), "space-materials");
  assert.equal(resolveSiteTemplateKey("ups-console"), "power-systems");
  assert.equal(resolveSiteTemplateKey("logistics"), "supply-chain");
  assert.equal(resolveSiteTemplateKey("not-a-template"), "space-materials");

  database = new ProductionDatabase({ databasePath: path.join(directory, "templates.sqlite") });
  new WorkspaceStore(database).save(workspaceId, {
    enterpriseProfile: { companyName: "示例设备有限公司", brandName: "示例设备" },
    businessLines: [{ id: "line-1", name: "可靠设备", product: "可靠设备", description: "用于模板隔离验收的客户业务数据。" }],
    site: { cms: {
      schemaVersion: 2,
      settings: { siteName: "示例设备", companyName: "示例设备有限公司", officialDomain: "equipment.example.test", description: "客户自己的公开信息。" },
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
  assert.equal(publishedBefore.site.theme.key, "space-materials");

  const cms = structuredClone(cmsStore.draft().snapshot);
  cms.theme.key = "supply-chain";
  const saved = cmsStore.saveDraft({ expectedRevision: cmsStore.draft().revision, cms });
  const preview = publicStore.snapshot({ draft: true });
  assert.equal(preview.site.theme.key, "supply-chain");
  assert.equal(preview.site.template.key, "supply-chain");
  assert.deepEqual(preview.site.businessLines, businessBefore, "template switching must not mutate business data");
  assert.equal(publicStore.snapshot().site.theme.key, "space-materials", "draft template must not leak into publication");

  const homePage = preview.site.pages.find((page) => page.id === "home");
  const previewHtml = renderFixedPage({ site: preview.site, page: homePage, origin: "https://example.test", preview: true });
  assert.match(previewHtml, /class="site-v8 site-template-supply-chain/);
  assert.match(previewHtml, /data-site-template="supply-chain"/);
  assert.match(previewHtml, /示例设备/);
  assert.doesNotMatch(previewHtml, /桐灼科技|灼见 GEO/, "client template must not inject Tongzhuo identity");
  assert.doesNotMatch(previewHtml, /aria-label="桐灼服务重点"/, "client template accessibility text must not inject Tongzhuo identity");
  assert.match(previewHtml, /theme-flow-home/, "supply-chain must use its service-routing home renderer");

  const structuralSignatures = new Set();
  const headerSignatures = new Set();
  const footerSignatures = new Set();
  const fixedSignatures = new Set();
  for (const template of listSiteTemplates()) {
    preview.site.theme.key = template.key;
    preview.site.template.key = template.key;
    const html = renderFixedPage({ site: preview.site, page: homePage, origin: "https://example.test", preview: true });
    const bodyClass = html.match(/<body class="([^"]+)"/)?.[1] || "";
    const signature = html.match(/class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-home)"/)?.[1]
      || bodyClass.match(/theme-home-(space-materials|power-systems|supply-chain)/)?.[0]
      || "unknown";
    structuralSignatures.add(signature);
    const headerSignature = html.match(/<header class="site-header [^"]*?(dossier-chrome|spec-chrome|console-chrome|magazine-chrome|casebook-chrome|catalog-chrome|space-chrome|power-chrome|flow-chrome)"/)?.[1] || "unknown";
    const footerSignature = html.match(/<footer class="site-footer [^"]*?(dossier-footer|spec-footer|console-footer|magazine-footer|casebook-footer|catalog-footer|space-footer|power-footer|flow-footer)"/)?.[1] || "unknown";
    headerSignatures.add(headerSignature);
    footerSignatures.add(footerSignature);
    const fixedHtml = renderFixedPage({ site: preview.site, page: { id: "about", title: "关于我们", path: "/about/", status: "published", seoDescription: "企业公开信息" }, origin: "https://example.test", preview: true });
    fixedSignatures.add(fixedHtml.match(/class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-fixed)/)?.[1] || "unknown");
    assert.match(html, /<button class="menu-toggle"[^>]+aria-controls="mobile-navigation"/, `${template.key} header must preserve the mobile navigation control`);
    assert.match(html, /<nav id="mobile-navigation"[^>]+aria-label="移动端导航"/, `${template.key} header must preserve accessible mobile navigation`);
  }
  assert.equal(structuralSignatures.size, listSiteTemplates().length, "every template must expose a different home structure signature");
  assert.equal(headerSignatures.size, listSiteTemplates().length, "every template must render a different header structure");
  assert.equal(footerSignatures.size, listSiteTemplates().length, "every template must render a different footer structure");
  assert.equal(fixedSignatures.size, listSiteTemplates().length, "every template must render a different fixed-page structure");
  assert(!headerSignatures.has("unknown"), "every template must provide its own header renderer");
  assert(!footerSignatures.has("unknown"), "every template must provide its own footer renderer");
  assert(!fixedSignatures.has("unknown"), "every template must provide its own fixed-page renderer");

  cmsStore.submitReview({ reason: "模板预览验收" });
  cmsStore.approve({ reason: "客户内容与模板通过审核" });
  const publication = cmsStore.publish({ expectedDraftRevision: saved.revision, note: "发布物流供应链模板" });
  assert.equal(publication.snapshot.theme.key, "supply-chain");
  assert.equal(publicStore.snapshot().site.theme.key, "supply-chain");
  assert.deepEqual(publicStore.snapshot().site.businessLines, businessBefore);
  assert.equal(cmsStore.releases()[0].sourceDraftRevision, saved.revision, "published template must remain traceable to its draft snapshot");

  console.log("Site template registry, aliases, draft preview isolation, publication snapshot, customer identity and shared CMS data contract passed.");
} finally {
  database?.close();
  await rm(directory, { recursive: true, force: true });
}
