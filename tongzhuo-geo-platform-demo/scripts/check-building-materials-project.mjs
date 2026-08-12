import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoFoundationDrafts } from "../foundation-assets/bootstrap.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";
import { resolveProjectSeed } from "../project-seeds/index.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { createProductionBackup, restoreProductionBackup, verifyProductionBackup } from "./production-backup-v2.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "geo-building-materials-project-"));
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const methodologyCandidates = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const runtimes = [];
const databases = [];

function originFor(seed) {
  return `https://${String(seed.companyProfile.officialDomain).replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

async function request(base, pathname, init = {}) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...init });
  return { response, text: await response.text() };
}

async function startProject(seed) {
  const database = new ProductionDatabase({ databasePath: path.join(root, `${seed.projectId}.sqlite`) });
  databases.push(database);
  const runtime = createSiteRuntime({
    database,
    workspaceId: seed.tenantId,
    projectId: seed.projectId,
    projectSeedKey: seed.key,
    staticRoot: root,
    host: "127.0.0.1",
    port: 0,
    baseUrl: originFor(seed),
    flushIntervalMs: 60_000,
    logger: { info() {}, warn() {}, error() {} }
  });
  runtimes.push(runtime);
  const address = await runtime.listen(0);
  return { database, runtime, base: `http://127.0.0.1:${address.port}` };
}

function assertNoCrossBrand(value, message) {
  assert.doesNotMatch(value, /桐灼|灼见 AI|桐灼科技|桐灼（淄博）|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai|短视频运营|企业 AI 落地/, message);
}

try {
  const tongzhuoSeed = resolveProjectSeed("tongzhuo-geo");
  const buildingSeed = resolveProjectSeed("building-materials-demo");
  assert.ok(tongzhuoSeed && buildingSeed, "both customer projects must be registered seeds");
  assert.deepEqual(
    { projectId: buildingSeed.projectId, tenantId: buildingSeed.tenantId, industryTemplate: buildingSeed.industryTemplate, demo: buildingSeed.demo },
    { projectId: "building-materials-demo", tenantId: "tenant_building_materials_demo", industryTemplate: "building-materials", demo: true }
  );

  const tongzhuo = await startProject(tongzhuoSeed);
  const building = await startProject(buildingSeed);
  assert.notEqual(tongzhuo.database.databasePath, building.database.databasePath, "each customer must have an independent SQLite deployment");

  const buildingSnapshot = new PublicSiteStore({ database: building.database, workspaceId: buildingSeed.tenantId, projectSeedKey: buildingSeed.key }).snapshot();
  assert.deepEqual(
    { projectId: buildingSnapshot.site.projectId, tenantId: buildingSnapshot.site.tenantId, industryTemplate: buildingSnapshot.site.industryTemplate, demo: buildingSnapshot.site.demo },
    { projectId: buildingSeed.projectId, tenantId: buildingSeed.tenantId, industryTemplate: "building-materials", demo: true }
  );
  assert.equal(buildingSnapshot.site.officialDomain, "building-materials.example.invalid");

  const pages = ["/", "/services/", "/cases/", "/about/", "/problem-map/", "/contact/", "/problem-map/material-parameter-comparison/", "/sitemap.xml", "/llms.txt", "/llms-full.txt"];
  const rendered = [];
  for (const pathname of pages) {
    const result = await request(building.base, pathname);
    assert.equal(result.response.status, 200, `building materials page must render: ${pathname}`);
    rendered.push(result.text);
  }
  const buildingHtml = rendered.join("\n");
  assertNoCrossBrand(buildingHtml, "building materials public output must never contain Tongzhuo identity, service data, assets, or ICP");
  for (const expected of ["华材建材演示项目", "建材选型支持", "质量与标准资料", "采购与交付说明", "规格参数", "执行标准", "building-materials.example.invalid"]) {
    assert.match(buildingHtml, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `building public output is missing ${expected}`);
  }
  assert.match(buildingHtml, /演示内容，非客户案例/, "demo customer must state its case boundary");

  const tongzhuoHome = await request(tongzhuo.base, "/");
  assert.equal(tongzhuoHome.response.status, 200);
  assert.match(tongzhuoHome.text, /桐灼科技/);
  assert.doesNotMatch(tongzhuoHome.text, /华材建材演示项目|建材选型支持/, "Tongzhuo runtime must not inherit building customer content");

  const leadPayload = { name: "演示采购负责人", phone: "13800001111", company: "建材演示客户", message: "了解规格参数资料", source_url: "/contact/" };
  const lead = await request(building.base, "/api/v1/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "building-materials-project-check-0001" },
    body: JSON.stringify(leadPayload)
  });
  assert.equal(lead.response.status, 201, "building lead must be accepted by its own runtime");
  assert.equal(building.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get(buildingSeed.tenantId, buildingSeed.projectId).count, 1);
  assert.equal(tongzhuo.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads").get().count, 0, "a building lead must never enter Tongzhuo deployment");

  const buildingCms = new SiteCmsStore(building.database, { workspaceId: buildingSeed.tenantId, projectSeedKey: buildingSeed.key });
  const tongzhuoCms = new SiteCmsStore(tongzhuo.database, { workspaceId: tongzhuoSeed.tenantId, projectSeedKey: tongzhuoSeed.key });
  const buildingDraft = buildingCms.draft();
  const changedCms = structuredClone(buildingDraft.snapshot);
  changedCms.theme.primaryColor = "#356E56";
  const saved = buildingCms.saveDraft({ expectedRevision: buildingDraft.revision, cms: changedCms, reason: "building-materials-theme-isolation-check" });
  buildingCms.submitReview({ reason: "building-materials-theme-isolation-check" });
  buildingCms.approve({ reason: "building-materials-theme-isolation-check" });
  buildingCms.publish({ expectedDraftRevision: saved.revision, note: "building-materials-theme-isolation-check" });
  const themedBuilding = await request(building.base, "/");
  assert.match(themedBuilding.text, /--brand:#356E56/, "building theme change must be published to only its own site");
  assert.notEqual(tongzhuoCms.publication().snapshot.theme.primaryColor, "#356E56", "building theme must not mutate Tongzhuo CMS publication");

  // Both deployments deliberately reference the same immutable global GEO
  // package IDs, while the package rows themselves remain in independent
  // customer databases. No customer branding or facts are copied into it.
  const methodIds = [];
  for (const deployment of [tongzhuo, building]) {
    const store = new FoundationAssetStore(deployment.database);
    const foundation = ensureGeoFoundationDrafts(store);
    const methodology = importUpsGeoCandidateRules(store, methodologyCandidates);
    methodIds.push({ methodology: methodology.version.id, prompt: foundation.promptVersion.id, quality: foundation.qualityRulePack.id });
  }
  assert.deepEqual(methodIds[0], { methodology: "MVER-GEO-CORE-V1", prompt: "PVER-GEO-ARTICLE-V1", quality: "QRULE-GEO-CONTENT-V1" });
  assert.deepEqual(methodIds[1], methodIds[0], "all private deployments must use the same versioned GEO core asset identifiers");
  assert.equal(tongzhuo.database.connection.prepare("SELECT COUNT(*) AS count FROM site_cms_publications WHERE workspace_id = ?").get(buildingSeed.tenantId).count, 0, "Tongzhuo database must not contain building CMS publication rows");
  assert.equal(building.database.connection.prepare("SELECT COUNT(*) AS count FROM site_cms_publications WHERE workspace_id = ?").get(tongzhuoSeed.tenantId).count, 0, "building database must not contain Tongzhuo CMS publication rows");

  const now = new Date().toISOString();
  for (const [deployment, seed, marker] of [[tongzhuo, tongzhuoSeed, "tongzhuo"], [building, buildingSeed, "building"]]) {
    deployment.database.connection.prepare("INSERT INTO knowledge_libraries (id, workspace_id, name, kind, scope, description, status, created_at, updated_at) VALUES (?, ?, ?, 'document', 'enterprise', ?, 'active', ?, ?)")
      .run(`KB-P8-${marker}`, seed.tenantId, `P8 ${marker} knowledge`, `${marker} isolated knowledge`, now, now);
    deployment.database.connection.prepare("INSERT INTO content_articles (id, workspace_id, title, category, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, 'P8', 'draft', '{}', ?, ?)")
      .run(`ART-P8-${marker}`, seed.tenantId, `P8 ${marker} content`, now, now);
  }
  assert.equal(tongzhuo.database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id = ?").get(buildingSeed.tenantId).count, 0);
  assert.equal(building.database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id = ?").get(tongzhuoSeed.tenantId).count, 0);
  assert.equal(tongzhuo.database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles WHERE workspace_id = ?").get(buildingSeed.tenantId).count, 0);
  assert.equal(building.database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles WHERE workspace_id = ?").get(tongzhuoSeed.tenantId).count, 0);
  assert.equal(tongzhuo.database.connection.prepare("SELECT COUNT(*) AS count FROM publication_tasks WHERE tenant_id = ?").get(buildingSeed.tenantId).count, 0);
  assert.equal(building.database.connection.prepare("SELECT COUNT(*) AS count FROM publication_tasks WHERE tenant_id = ?").get(tongzhuoSeed.tenantId).count, 0);

  for (const runtime of runtimes.reverse()) await runtime.close();
  runtimes.length = 0;
  for (const [deployment, seed, marker] of [[tongzhuo, tongzhuoSeed, "tongzhuo"], [building, buildingSeed, "building"]]) {
    deployment.database.checkpoint("TRUNCATE");
    const dataDir = path.join(root, `${marker}-data`);
    const backupDir = path.join(root, `${marker}-backup`);
    const config = { dataDir, databasePath: deployment.database.databasePath, backupDir: path.join(dataDir, "backups") };
    const env = { TZ_DATA_DIR: dataDir, TZ_DATABASE_PATH: deployment.database.databasePath, TZ_BACKUP_DIR: path.join(dataDir, "backups"), TZ_DEPLOY_CONFIG_DIR: path.join(root, `${marker}-deploy`), TZ_SITE_STATIC_ROOT: path.join(root, `${marker}-site`) };
    const created = await createProductionBackup({ config, env, projectRoot, targetDir: backupDir, backupId: `P8-${marker}` });
    assert.equal((await verifyProductionBackup(created.targetDir)).format, "tongzhuo-private-backup-v2");
    deployment.database.connection.prepare("DELETE FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").run(seed.tenantId, seed.projectId);
    deployment.database.checkpoint("TRUNCATE");
    deployment.database.close();
    databases.splice(databases.indexOf(deployment.database), 1);
    await restoreProductionBackup({ config, env, projectRoot, sourceDir: created.targetDir, force: true, skipSafetySnapshot: true });
    const restored = new ProductionDatabase({ databasePath: deployment.database.databasePath });
    assert.equal(restored.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id = ?").get(seed.tenantId).count, 1, `${marker} knowledge must survive its own backup restore`);
    if (marker === "building") assert.equal(restored.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get(seed.tenantId, seed.projectId).count, 1, "building lead must be restored only into building deployment");
    restored.close();
  }

  console.log("Building-materials project seed, runtime pages, CMS theme, lead, content, knowledge, publication, backup/restore, identity and versioned-core isolation checks passed.");
} finally {
  for (const runtime of runtimes.reverse()) await runtime.close();
  for (const database of databases) database.close();
  await rm(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
