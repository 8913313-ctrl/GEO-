import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { projectSeedKeys, resolveProjectSeed } from "../project-seeds/index.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { renderFixedPage, renderInsightsPage } from "../public-site/site-renderer.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-project-seeds-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "project-seeds.sqlite") });
try {
  assert.deepEqual(projectSeedKeys(), ["tongzhuo-geo", "building-materials-demo", "machinery-demo", "energy-demo", "beauty-demo"]);
  assert.equal(resolveProjectSeed("missing-project"), null);

  const blankStore = new SiteCmsStore(database, { workspaceId: "tenant-blank-customer", projectSeedKey: "" });
  const blank = blankStore.publication().snapshot;
  assert.equal(blank.settings.siteName, "企业官网");
  assert.equal(blank.settings.companyName, "企业");
  assert.deepEqual(blank.services, [], "a fresh customer must not inherit Tongzhuo services");
  assert.deepEqual(blank.cases, [], "a fresh customer must not inherit Tongzhuo cases");
  assert.deepEqual(blank.problemGroups, [], "a fresh customer must not inherit Tongzhuo question groups");
  assert.doesNotMatch(JSON.stringify(blank), /桐灼|灼见 AI|短视频运营|企业 AI 落地/, "a neutral customer project must contain no Tongzhuo customer data");

  const tongzhuoStore = new SiteCmsStore(database, { workspaceId: "tenant_tongzhuo_geo", projectSeedKey: "tongzhuo-geo" });
  const tongzhuo = tongzhuoStore.publication().snapshot;
  assert.equal(tongzhuo.settings.companyName, "桐灼（淄博）网络科技有限公司");
  assert.equal(resolveProjectSeed("tongzhuo-geo").projectId, "tongzhuo-geo");
  assert.ok(tongzhuo.services.some((item) => item.id === "geo"));
  assert.ok(tongzhuo.cases.length > 0);
  assert.ok(tongzhuo.problemGroups.length > 0);
  assert.equal(tongzhuoStore.publication().checksum, tongzhuoStore.draft().checksum, "seed bootstrap must create matching draft and publication snapshots");

  const buildingSeed = resolveProjectSeed("building-materials-demo");
  assert.deepEqual({ projectId: buildingSeed.projectId, tenantId: buildingSeed.tenantId, industryTemplate: buildingSeed.industryTemplate, demo: buildingSeed.demo }, { projectId: "building-materials-demo", tenantId: "tenant_building_materials_demo", industryTemplate: "building-materials", demo: true });
  const buildingStore = new SiteCmsStore(database, { workspaceId: buildingSeed.tenantId, projectSeedKey: buildingSeed.key });
  const building = buildingStore.publication().snapshot;
  assert.equal(building.settings.companyName, "华材建材行业演示项目");
  assert.ok(building.services.some((item) => item.id === "material-selection"));
  assert.ok(building.problemGroups.some((item) => item.id === "selection"));
  assert.doesNotMatch(JSON.stringify(building), /桐灼|灼见 AI|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai/);

  const energySeed = resolveProjectSeed("energy-demo");
  const energy = new SiteCmsStore(database, { workspaceId: energySeed.tenantId, projectSeedKey: energySeed.key }).publication().snapshot;
  assert.equal(energy.theme.key, "energy");
  assert.match(JSON.stringify(energy), /UPS 选型支持|负载容量|续航/);
  assert.doesNotMatch(JSON.stringify(energy), /桐灼|华材建材|澄颜美妆/);

  const beautySeed = resolveProjectSeed("beauty-demo");
  const beauty = new SiteCmsStore(database, { workspaceId: beautySeed.tenantId, projectSeedKey: beautySeed.key }).publication().snapshot;
  assert.equal(beauty.theme.key, "beauty");
  assert.match(JSON.stringify(beauty), /成分与配方说明|敏感肌|安全/);
  assert.doesNotMatch(JSON.stringify(beauty), /桐灼|华材建材|恒稳能源/);

  const blankPublic = new PublicSiteStore({ database, workspaceId: "tenant-blank-customer", projectSeedKey: "" }).snapshot();
  const blankPages = blankPublic.site.pages.filter((page) => ["home", "about"].includes(page.id)).map((page) => renderFixedPage({
    site: blankPublic.site, page, articles: [], categories: blankPublic.categories, origin: "https://blank-customer.example"
  }));
  blankPages.push(renderInsightsPage({ site: blankPublic.site, articles: [], categories: blankPublic.categories, origin: "https://blank-customer.example" }));
  const blankHtml = blankPages.join("\n");
  assert.doesNotMatch(blankHtml, /桐灼|灼见|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai/, "neutral public pages must contain no Tongzhuo identity or assets");

  const tongzhuoPublic = new PublicSiteStore({ database, workspaceId: "tenant_tongzhuo_geo", projectSeedKey: "tongzhuo-geo" }).snapshot();
  const tongzhuoHome = renderFixedPage({
    site: tongzhuoPublic.site,
    page: tongzhuoPublic.site.pages.find((page) => page.id === "home"),
    articles: [],
    categories: tongzhuoPublic.categories,
    origin: "https://tongzhuo.example"
  });
  assert.match(tongzhuoHome, /桐灼科技/);
  assert.match(tongzhuoHome, /鲁ICP备2026021587号-2/);
  assert.match(tongzhuoHome, /zhuojian-ai-lockup-gold\.png/);
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Project seed isolation checks passed.");
