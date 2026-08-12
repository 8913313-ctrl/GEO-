import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveProjectSeed } from "../project-seeds/index.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";

const seed = resolveProjectSeed("machinery-demo");
assert.ok(seed, "machinery demo seed must be registered");
assert.deepEqual({ projectId: seed.projectId, tenantId: seed.tenantId, industryTemplate: seed.industryTemplate, demo: seed.demo }, { projectId: "machinery-demo", tenantId: "tenant_machinery_demo", industryTemplate: "machinery", demo: true });
const root = await mkdtemp(path.join(os.tmpdir(), "geo-machinery-project-"));
const database = new ProductionDatabase({ databasePath: path.join(root, "machinery.sqlite") });
const runtime = createSiteRuntime({ database, workspaceId: seed.tenantId, projectId: seed.projectId, projectSeedKey: seed.key, staticRoot: root, host: "127.0.0.1", port: 0, baseUrl: "https://machinery.example.invalid", flushIntervalMs: 60_000, logger: { info() {}, warn() {}, error() {} } });
async function request(base, pathname, init = {}) { const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...init }); return { response, text: await response.text() }; }
try {
  const address = await runtime.listen(0);
  const base = `http://127.0.0.1:${address.port}`;
  const snapshot = new PublicSiteStore({ database, workspaceId: seed.tenantId, projectSeedKey: seed.key }).snapshot();
  assert.equal(snapshot.site.industryTemplate, "machinery");
  assert.equal(snapshot.site.demo, true);
  assert.ok(snapshot.site.services.some((item) => item.id === "equipment-selection"));
  assert.ok(snapshot.site.problemGroups.some((item) => item.id === "selection"));
  const pages = ["/", "/services/", "/cases/", "/about/", "/problem-map/", "/contact/", "/problem-map/machine-capacity-selection/", "/sitemap.xml", "/llms.txt", "/llms-full.txt"];
  let html = "";
  for (const page of pages) { const result = await request(base, page); assert.equal(result.response.status, 200, `machinery page must render: ${page}`); html += result.text; }
  assert.match(html, /机械设备演示项目/);
  assert.match(html, /设备选型支持/);
  assert.match(html, /技术参数资料/);
  assert.match(html, /machinery\.example\.invalid/);
  assert.match(html, /演示内容，非客户案例/);
  assert.doesNotMatch(html, /桐灼|灼见 AI|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai|华材建材/);
  const lead = await request(base, "/api/v1/leads", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "machinery-demo-check-0001" }, body: JSON.stringify({ name: "演示采购负责人", phone: "13800002222", company: "机械演示客户", message: "了解设备选型资料", source_url: "/contact/" }) });
  assert.equal(lead.response.status, 201);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get(seed.tenantId, seed.projectId).count, 1);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id != ? OR project_id != ?").get(seed.tenantId, seed.projectId).count, 0);
  console.log("Machinery demo project seed, runtime pages, demo boundary, lead isolation and no-cross-brand checks passed.");
} finally { await runtime.close(); database.close(); await rm(root, { recursive: true, force: true }); }
