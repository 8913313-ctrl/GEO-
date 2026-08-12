import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveProjectSeed } from "../project-seeds/index.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { renderFixedPage } from "../public-site/site-renderer.mjs";
import { assertProductionConfiguration, productionConfig } from "../production-config.mjs";

const seed = resolveProjectSeed("tongzhuo-geo");
assert.ok(seed, "Tongzhuo project seed must be registered.");
assert.deepEqual({ projectId: seed.projectId, tenantId: seed.tenantId, slug: seed.slug }, { projectId: "tongzhuo-geo", tenantId: "tenant_tongzhuo_geo", slug: "tongzhuo-geo" });
assert.equal(seed.companyProfile.legalName, "桐灼（淄博）网络科技有限公司");
assert.equal(seed.companyProfile.officialDomain, "https://tongzhuo.ink");
assert.equal(seed.site.cms.settings.footerIcp, "鲁ICP备2026021587号-2");
assert.ok(seed.site.cms.settings.logoUrl && seed.site.cms.settings.brandLogoUrl && seed.site.cms.settings.brandMarkUrl, "Official logo assets are required.");
assert.ok(seed.site.cms.services.some((item) => item.id === "geo" && item.title === "GEO 服务"), "GEO must be a declared service line.");
assert.ok(seed.site.cms.cases.length || seed.site.cms.problemGroups.length, "A method or case must be present.");

const configured = assertProductionConfiguration({ ...productionConfig, tenantId: seed.tenantId, workspaceId: seed.tenantId, projectId: seed.projectId, projectSeedKey: seed.key });
assert.equal(configured.projectId, seed.projectId);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-project-identity-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "identity.sqlite") });
try {
  const snapshot = new PublicSiteStore({ database, workspaceId: seed.tenantId, projectSeedKey: seed.key }).snapshot();
  assert.equal(snapshot.site.companyName, seed.companyProfile.legalName);
  assert.equal(snapshot.site.officialDomain, "tongzhuo.ink");
  assert.equal(snapshot.site.footerIcp, "鲁ICP备2026021587号-2");
  assert.equal(snapshot.site.contact.address, seed.companyProfile.address);
  const home = renderFixedPage({ site: snapshot.site, page: snapshot.site.pages.find((page) => page.id === "home"), articles: [], categories: snapshot.categories, origin: "https://tongzhuo.ink" });
  for (const expected of ["桐灼科技", "桐灼（淄博）网络科技有限公司", "鲁ICP备2026021587号-2", "zhuojian-ai-lockup-gold.png"]) assert.match(home, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(home, /企业官网 · 标准版|Example Company|example\.invalid/, "Tongzhuo public output must not contain template identity placeholders.");
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const publisherSource = await readFile(new URL("../../publisher-assistant/src/server.js", import.meta.url), "utf8");
assert.match(publisherSource, /GEOFLOW_PROJECT_ID/);
assert.match(publisherSource, /X-TZ-Project-ID/);
assert.match(publisherSource, /projectId:/);
const serverSource = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
assert.match(serverSource, /PUBLISHER_PROJECT_MISMATCH/);
assert.match(serverSource, /projectSeed\.projectId !== projectId/);
console.log("Tongzhuo project identity contract passed: brand, legal entity, domain, GEO service, official logo, ICP, public site, backend, and local publisher align on one project identity.");
