import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSiteRuntime } from "../site-server.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-lead-follow-up-"));
const databasePath = path.join(directory, "follow-up.sqlite");
const adminPort = 49_300 + Math.floor(Math.random() * 100);
const adminBase = `http://127.0.0.1:${adminPort}`;
let child;
let siteRuntime;

function cookie(response) { return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; "); }
async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options); const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, body, text };
}
async function login(username, password = "RoleUser!2026") {
  const result = await request(adminBase, "/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  return { Cookie: cookie(result.response), "X-CSRF-Token": result.body.data.csrfToken, "Content-Type": "application/json" };
}

try {
  child = spawn(process.execPath, [path.resolve("server.mjs"), String(adminPort)], { cwd: path.resolve("."), env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: directory, TZ_DATABASE_PATH: databasePath, TZ_LOG_DIR: path.join(directory, "logs"), TZ_MASTER_KEY: randomBytes(32).toString("base64"), TZ_TENANT_ID: "default", TZ_PROJECT_ID: "default" }, stdio: "ignore" });
  for (let index = 0; index < 80; index += 1) { try { if ((await request(adminBase, "/health/ready")).response.ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 100)); }
  let result = await request(adminBase, "/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "lead-admin", displayName: "线索管理员", password: "LeadAdmin!2026" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const admin = { Cookie: cookie(result.response), "X-CSRF-Token": result.body.data.csrfToken, "Content-Type": "application/json" };
  for (const [username, role] of [["lead-operator-a", "operator"], ["lead-operator-b", "operator"], ["lead-reviewer", "reviewer"], ["lead-viewer", "viewer"]]) {
    result = await request(adminBase, "/api/v1/users", { method: "POST", headers: admin, body: JSON.stringify({ username, displayName: username, password: "RoleUser!2026", role }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  }

  result = await request(adminBase, "/api/v1/site-cms/snapshot", { headers: { Cookie: admin.Cookie } });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const firstSiteCms = structuredClone(result.body.data.draft.snapshot);
  Object.assign(firstSiteCms.settings, {
    siteName: "Lead follow-up official site",
    companyName: "Lead follow-up test company",
    officialDomain: "lead-follow.example.test"
  });
  firstSiteCms.pages = firstSiteCms.pages.map((page) => ({ ...page, status: "published" }));
  result = await request(adminBase, "/api/v1/site-cms/draft", { method: "PUT", headers: admin, body: JSON.stringify({ expectedRevision: result.body.data.draft.revision, cms: firstSiteCms }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const firstSiteRevision = result.body.data.draft.revision;
  for (const [endpoint, reason] of [["submit-review", "lead follow-up first publication review"], ["approve", "lead follow-up first publication approved"]]) {
    result = await request(adminBase, `/api/v1/site-cms/${endpoint}`, { method: "POST", headers: admin, body: JSON.stringify({ reason }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  }
  result = await request(adminBase, "/api/v1/site-cms/publish", { method: "POST", headers: admin, body: JSON.stringify({ expectedDraftRevision: firstSiteRevision, note: "lead follow-up first publication" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));

  siteRuntime = createSiteRuntime({ databasePath, workspaceId: "default", projectId: "default", staticRoot: directory, host: "127.0.0.1", port: 49_450 + Math.floor(Math.random() * 100), baseUrl: "https://lead-follow.example.test", logger: { info() {}, warn() {}, error() {} } });
  const address = await siteRuntime.listen(); const siteBase = `http://127.0.0.1:${address.port}`;
  const leads = [];
  for (const [index, company] of [[1, "测试建材"], [2, "测试机械"]]) {
    result = await request(siteBase, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `lead-follow-up-000${index}` }, body: JSON.stringify({ name: `客户${index}`, phone: `1381234567${index}`, company, message: index === 1 ? "需要 GEO 诊断" : "需要信源建设", source_url: `https://example.test/contact/${index}` }) });
    assert.equal(result.response.status, 201); leads.push(result.body.data.id);
  }

  const operatorA = await login("lead-operator-a"); const operatorB = await login("lead-operator-b"); const reviewer = await login("lead-reviewer"); const viewer = await login("lead-viewer");
  result = await request(adminBase, `/api/v1/site-cms/leads?q=${encodeURIComponent("测试建材")}`, { headers: reviewer });
  assert.equal(result.response.status, 200); assert.deepEqual(result.body.data.items.map((lead) => lead.id), [leads[0]]); assert.equal(result.body.data.items[0].phoneOrEmail, "138****5671");

  result = await request(adminBase, `/api/v1/site-cms/leads/${leads[0]}`, { method: "PATCH", headers: operatorA, body: JSON.stringify({ status: "contacting", note: "首次电话沟通" }) });
  assert.equal(result.response.status, 409); assert.equal(result.body.code, "SITE_LEAD_CLAIM_REQUIRED");
  result = await request(adminBase, `/api/v1/site-cms/leads/${leads[0]}/claim`, { method: "POST", headers: operatorA, body: "{}" });
  assert.equal(result.response.status, 200); assert.equal(result.body.data.lead.owner, "lead-operator-a");
  result = await request(adminBase, `/api/v1/site-cms/leads/${leads[0]}/claim`, { method: "POST", headers: operatorA, body: "{}" });
  assert.equal(result.response.status, 200); assert.equal(result.body.data.duplicate, true);
  result = await request(adminBase, `/api/v1/site-cms/leads/${leads[0]}/claim`, { method: "POST", headers: operatorB, body: "{}" });
  assert.equal(result.response.status, 409); assert.equal(result.body.code, "SITE_LEAD_ALREADY_CLAIMED");

  result = await request(adminBase, `/api/v1/site-cms/leads/${leads[0]}`, { method: "PATCH", headers: operatorA, body: JSON.stringify({ status: "contacting", nextFollowAt: "2026-08-13T10:00:00+08:00", note: "已电话沟通，等待企业资料。" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.data.lead.status, "contacting"); assert.equal(result.body.data.lead.history.length, 2);
  result = await request(adminBase, "/api/v1/site-cms/leads?status=contacting", { headers: viewer });
  assert.equal(result.response.status, 200); assert.deepEqual(result.body.data.items.map((lead) => lead.id), [leads[0]]); assert.doesNotMatch(JSON.stringify(result.body), /13812345671/);

  for (const headers of [reviewer, viewer]) {
    result = await request(adminBase, `/api/v1/site-cms/leads/${leads[1]}/claim`, { method: "POST", headers, body: "{}" }); assert.equal(result.response.status, 403);
    result = await request(adminBase, "/api/v1/site-cms/leads/export", { headers }); assert.equal(result.response.status, 403);
  }
  result = await request(adminBase, "/api/v1/site-cms/leads/export", { headers: operatorA });
  assert.equal(result.response.status, 200); assert.match(result.response.headers.get("content-type") || "", /text\/csv/); assert.match(result.text, /138\*\*\*\*5671/); assert.doesNotMatch(result.text, /13812345671/);

  const db = siteRuntime.store.database.connection;
  const followUp = db.prepare("SELECT * FROM site_lead_follow_ups WHERE lead_id = ? AND event_type = 'status_changed'").get(leads[0]);
  assert.ok(followUp); assert.throws(() => db.prepare("UPDATE site_lead_follow_ups SET note = 'tampered' WHERE id = ?").run(followUp.id), /immutable/); assert.throws(() => db.prepare("DELETE FROM site_lead_follow_ups WHERE id = ?").run(followUp.id), /cannot be deleted/);
  assert.throws(() => db.prepare("INSERT INTO site_lead_follow_ups (id, tenant_id, project_id, lead_id, event_type, status_from, status_to, note, created_by, created_at) VALUES ('CROSS', 'other', 'other', ?, 'follow_up', 'new', 'new', '', ?, ?)").run(leads[0], followUp.created_by, new Date().toISOString()), /boundary mismatch/);
  const actions = db.prepare("SELECT action FROM audit_logs WHERE entity_type = 'site_lead' ORDER BY id").all().map((row) => row.action);
  for (const action of ["site.lead.claim", "site.lead.status_change", "site.lead.export"]) assert.ok(actions.includes(action), action);

  console.log("Official-site lead filtering, exclusive claim, six-state follow-up, immutable history, masked export, role denial, tenant/project boundary, and audit checks passed.");
} finally {
  await siteRuntime?.close();
  if (child && child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); }
  try { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (error) { if (error?.code !== "EBUSY") throw error; }
}
