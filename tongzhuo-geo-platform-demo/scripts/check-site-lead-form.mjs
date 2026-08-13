import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { normalizeSiteCmsSnapshot } from "../site-cms-store.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { renderFixedPage } from "../public-site/site-renderer.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-lead-form-"));
const runtimes = [];
let nextPort = 49_000 + Math.floor(Math.random() * 200);

async function start(options) {
  const databasePath = path.join(directory, `${options.workspaceId}.sqlite`);
  const database = new ProductionDatabase({ databasePath });
  const runtime = createSiteRuntime({ database, staticRoot: directory, host: "127.0.0.1", port: nextPort++, baseUrl: options.baseUrl, workspaceId: options.workspaceId, projectId: options.projectId, leadRateLimit: options.leadRateLimit, logger: { info() {}, warn() {}, error() {} } });
  const cmsStore = runtime.store.cmsStore;
  const current = cmsStore.draft();
  const cms = structuredClone(current.snapshot);
  Object.assign(cms.settings, {
    siteName: `${options.workspaceId} official site`,
    companyName: `${options.workspaceId} company`,
    officialDomain: new URL(options.baseUrl).hostname
  });
  cms.pages = cms.pages.map((page) => ({ ...page, status: "published" }));
  const saved = cmsStore.saveDraft({ expectedRevision: current.revision, cms });
  cmsStore.submitReview({ reason: "lead form test first publication review" });
  cmsStore.approve({ reason: "lead form test first publication approved" });
  cmsStore.publish({ expectedDraftRevision: saved.revision, note: "lead form test first publication" });
  runtime.testDatabase = database;
  const address = await runtime.listen();
  runtimes.push(runtime);
  return { runtime, base: `http://127.0.0.1:${address.port}` };
}

async function submit(base, key, payload, forwardedFor = "") {
  const headers = { "Content-Type": "application/json", "Idempotency-Key": key };
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;
  const response = await fetch(`${base}/api/v1/leads`, { method: "POST", headers, body: JSON.stringify(payload) });
  const body = await response.json();
  return { response, body };
}

try {
  const building = await start({ workspaceId: "tenant-building", projectId: "project-building", baseUrl: "https://building.example.test", leadRateLimit: { maximum: 20 } });
  const machinery = await start({ workspaceId: "tenant-machinery", projectId: "project-machinery", baseUrl: "https://machinery.example.test", leadRateLimit: { maximum: 20 } });
  const payload = { name: "张经理", phone: "13800001111", company: "测试建材", message: "预约 GEO 诊断", source_url: "https://building.example.test/contact/?utm_source=wechat", utm: { source: "wechat" } };

  let result = await submit(building.base, "lead-form-shared-key-0001", payload);
  assert.equal(result.response.status, 201);
  assert.match(result.body.data.message, /1 个工作日内回复/);
  const leadId = result.body.data.id;
  result = await submit(building.base, "lead-form-shared-key-0001", payload);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.id, leadId);
  assert.equal(result.body.data.duplicate, true);
  assert.equal(building.runtime.store.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get("tenant-building", "project-building").count, 1);

  result = await submit(building.base, "lead-form-shared-key-0001", { ...payload, phone: "13900002222" });
  assert.equal(result.response.status, 409);
  assert.equal(result.body.code, "SITE_LEAD_IDEMPOTENCY_CONFLICT");

  result = await submit(machinery.base, "lead-form-shared-key-0001", { ...payload, company: "测试机械", phone: "machinery@example.test", source_url: "https://machinery.example.test/contact/" });
  assert.equal(result.response.status, 201, "the same browser key is isolated by deployment tenant and project");
  assert.notEqual(result.body.data.id, leadId);
  assert.equal(machinery.runtime.store.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get("tenant-machinery", "project-machinery").count, 1);
  assert.equal(building.runtime.store.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get("tenant-building", "project-machinery").count, 0);

  const limited = await start({ workspaceId: "tenant-limited", projectId: "project-limited", baseUrl: "https://limited.example.test", leadRateLimit: { maximum: 2, windowMs: 60_000 } });
  for (const index of [1, 2]) {
    result = await submit(limited.base, `lead-form-rate-000${index}`, { name: `客户${index}`, phone: `1380000000${index}` });
    assert.equal(result.response.status, 201);
  }
  result = await submit(limited.base, "lead-form-rate-0003", { name: "客户3", phone: "13800000003" });
  assert.equal(result.response.status, 429);
  assert.equal(result.body.code, "SITE_LEAD_RATE_LIMITED");
  assert.equal(limited.runtime.store.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ?").get("tenant-limited").count, 2);

  result = await submit(building.base, "short", { name: "无效键", phone: "13800003333" });
  assert.equal(result.response.status, 422);
  assert.equal(result.body.code, "SITE_LEAD_IDEMPOTENCY_REQUIRED");

  const dynamicScript = await readFile(path.resolve("public-site/assets/site.js"), "utf8");
  const visualScript = await readFile(path.resolve("public-site/assets/site-v8.js"), "utf8");
  const staticScript = await readFile(path.resolve("../demo-company-homepage/assets/site.js"), "utf8");
  for (const source of [dynamicScript, staticScript]) {
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /1 个工作日内回复/);
    assert.ok(source.indexOf("form.reset()") > source.indexOf("response.ok"), "form fields must only reset after a successful response");
  }
  assert.doesNotMatch(visualScript, /site-assets-r6\/site\.js/, "the visual runtime must not inject a second lead-form runtime");

  const configuredCms = normalizeSiteCmsSnapshot({ settings: { leadForm: { nameLabel: "联系人<script>", contactLabel: "手机或微信", submitLabel: "提交选型需求", responsePromise: "2 小时内联系", privacyNotice: "仅用于选型服务", fields: [
    { key: "name", label: "联系人<script>", type: "text", required: true },
    { key: "phone", label: "手机或微信", type: "tel", required: true },
    { key: "project_type", label: "项目类型", type: "select", required: true, options: ["厂房", "住宅"] },
    { key: "purchase_volume", label: "预计采购量", type: "number", placeholder: "例如 1000" },
    { key: "password", label: "密码", type: "text" }
  ] } } });
  const configuredSite = new PublicSiteStore({ database: building.runtime.store.database, workspaceId: "tenant-building", projectId: "project-building" }).siteConfig({ revision: 1, state: {} }, configuredCms);
  const contactPage = configuredSite.pages.find((item) => item.id === "contact") || { id: "contact", title: "联系我们", path: "/contact/" };
  const configuredHtml = renderFixedPage({ site: configuredSite, page: contactPage, origin: "https://building.example.test" });
  assert.match(configuredHtml, /联系人&lt;script&gt; \*/);
  assert.doesNotMatch(configuredHtml, /联系人<script>/);
  assert.match(configuredHtml, /手机或微信 \*/);
  assert.match(configuredHtml, /提交选型需求/);
  assert.match(configuredHtml, /2 小时内联系；仅用于选型服务/);
  assert.match(configuredHtml, /name="project_type"/);
  assert.match(configuredHtml, /name="purchase_volume"/);
  assert.match(configuredHtml, /厂房|住宅/);
  assert.doesNotMatch(configuredHtml, /name="password"/);
  assert.match(configuredHtml, /name="name"[^>]+required/);
  assert.match(configuredHtml, /name="phone"[^>]+required/);
  assert.match(configuredHtml, /site\.js\?v=20260813-lead-builder1/);
  assert.equal((configuredHtml.match(/site\.js\?v=20260813-lead-builder1/g) || []).length, 1, "the lead-form runtime must be loaded exactly once");
  const formVersion = configuredSite.leadForm.version;
  result = await submit(building.base, "lead-form-config-0001", { name: "李经理", phone: "13900001111", form_version: formVersion, custom_fields: { project_type: "厂房", purchase_volume: "1000" } });
  assert.equal(result.response.status, 409, "runtime must validate against its own published form, not an unrelated render-only snapshot");
  building.runtime.leadStore.create({ name: "李经理", phone: "13900001111", form_version: formVersion, custom_fields: { project_type: "厂房", purchase_volume: "1000" } }, { idempotencyKey: "lead-form-snapshot-0001", site: configuredSite });
  const storedSnapshot = JSON.parse(building.runtime.store.database.connection.prepare("SELECT metadata_json FROM site_contact_leads WHERE idempotency_key = ?").get("lead-form-snapshot-0001").metadata_json).leadForm;
  assert.equal(storedSnapshot.version, formVersion);
  assert.equal(storedSnapshot.fields.project_type, "厂房");
  assert.equal(storedSnapshot.fields.name, "李经理");
  assert.equal(storedSnapshot.fields.phone, "13900001111");
  assert.equal(storedSnapshot.definition.find((field) => field.key === "project_type").label, "项目类型");
  assert.throws(() => building.runtime.store.database.connection.prepare("UPDATE site_contact_leads SET metadata_json = '{}' WHERE idempotency_key = ?").run("lead-form-snapshot-0001"), /immutable/);
  assert.throws(() => building.runtime.leadStore.create({ name: "李经理", phone: "13900001111", form_version: formVersion, custom_fields: { project_type: "非法选项" } }, { idempotencyKey: "lead-form-invalid-select-1", site: configuredSite }), /选项无效/);
  assert.throws(() => building.runtime.leadStore.create({ name: "李经理", phone: "13900001111", form_version: "stale-version", custom_fields: { project_type: "厂房" } }, { idempotencyKey: "lead-form-stale-version-1", site: configuredSite }), /表单已更新/);
  const disabledSite = { ...configuredSite, leadForm: { ...configuredSite.leadForm, enabled: false } };
  const disabledHtml = renderFixedPage({ site: disabledSite, page: contactPage, origin: "https://building.example.test" });
  assert.doesNotMatch(disabledHtml, /data-lead-form/);
  assert.match(disabledHtml, /暂未开放在线咨询/);

  console.log("Official-site lead validation, configurable safe rendering, required-field boundary, idempotency, isolation, rate limiting, attribution, response promise, and failure preservation passed.");
} finally {
  for (const runtime of runtimes.reverse()) {
    await runtime.close();
    runtime.testDatabase.checkpoint("TRUNCATE");
    runtime.testDatabase.close();
  }
  try { await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 }); }
  catch (error) { if (error?.code !== "EBUSY") throw error; }
}
