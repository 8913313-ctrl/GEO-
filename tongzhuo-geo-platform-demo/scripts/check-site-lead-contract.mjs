import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MIGRATIONS, ProductionDatabase } from "../production-database.mjs";
import { PublicLeadStore } from "../public-site/lead-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-lead-contract-"));
const migrationDatabasePath = path.join(directory, "legacy.sqlite");
let database;
let child;
let siteRuntime;
let publicBase = "";

function migrationSqlThrough(version) {
  return MIGRATIONS.filter((item) => item.version <= version).map((item) => item.sql).join("\n");
}
function cookie(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; ");
}
async function request(base, pathname, options = {}) {
  const targetBase = pathname === "/api/v1/leads" && publicBase ? publicBase : base;
  const response = await fetch(`${targetBase}${pathname}`, options);
  const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, body, text };
}

try {
  // Build an authentic pre-P5 schema and prove legacy status/data migration.
  database = new ProductionDatabase({ databasePath: migrationDatabasePath, runMigrations: false });
  database.connection.exec(migrationSqlThrough(21));
  database.connection.exec("CREATE TABLE migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT");
  const appliedAt = new Date().toISOString();
  for (const item of MIGRATIONS.filter((entry) => entry.version <= 21)) database.connection.prepare("INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)").run(item.version, item.name, appliedAt);
  const insertLegacy = database.connection.prepare("INSERT INTO site_contact_leads (id, workspace_id, name, phone, company, message, source_url, status, user_agent, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '{}', ?, ?)");
  insertLegacy.run("LEGACY-CONTACTED", "tenant-legacy", "旧联系客户", "13800000001", "旧企业", "旧需求一", "https://legacy.example/contact", "contacted", appliedAt, appliedAt);
  insertLegacy.run("LEGACY-CLOSED", "tenant-legacy", "旧关闭客户", "legacy@example.test", "旧企业", "旧需求二", "https://legacy.example/home", "closed", appliedAt, appliedAt);
  database.close(); database = new ProductionDatabase({ databasePath: migrationDatabasePath });
  const migrated = database.connection.prepare("SELECT id, workspace_id, tenant_id, project_id, phone_or_email, need, source_page, status FROM site_contact_leads ORDER BY id").all();
  assert.deepEqual(migrated.map((row) => row.status), ["lost", "contacting"]);
  assert.ok(migrated.every((row) => row.workspace_id === row.tenant_id && row.project_id === row.tenant_id));
  assert.equal(migrated.find((row) => row.id === "LEGACY-CONTACTED").phone_or_email, "13800000001");
  assert.equal(migrated.find((row) => row.id === "LEGACY-CLOSED").need, "旧需求二");

  // New writes carry canonical tenant/project fields, UTM and privacy-safe response.
  const tenantA = new PublicLeadStore(database, { workspaceId: "tenant-a", projectId: "project-building" });
  const tenantB = new PublicLeadStore(database, { workspaceId: "tenant-b", projectId: "project-machinery" });
  const createdA = tenantA.create({ name: "建材客户", phone: "13900001234", company: "建材企业", message: "需要 GEO 诊断", source_url: "https://building.example/contact", utm_source: "wechat", utm_campaign: "summer" }, { idempotencyKey: "lead-contract-building-0001" });
  tenantB.create({ name: "机械客户", phone: "machinery@example.test", company: "机械企业", message: "需要产品信源", source_url: "https://machinery.example/contact" }, { idempotencyKey: "lead-contract-machinery-0001" });
  assert.deepEqual(Object.keys(createdA).sort(), ["createdAt", "id", "replayed", "status"], "public create response must not echo contact details");
  const canonicalA = database.connection.prepare("SELECT tenant_id, project_id, phone_or_email, need, source_page, utm_json, status, follow_up_at, owner_id FROM site_contact_leads WHERE id = ?").get(createdA.id);
  assert.deepEqual({ ...canonicalA, utm_json: JSON.parse(canonicalA.utm_json) }, { tenant_id: "tenant-a", project_id: "project-building", phone_or_email: "13900001234", need: "需要 GEO 诊断", source_page: "https://building.example/contact", utm_json: { source: "wechat", campaign: "summer" }, status: "new", follow_up_at: null, owner_id: null });
  assert.throws(() => database.connection.prepare("UPDATE site_contact_leads SET status = 'closed' WHERE id = ?").run(createdA.id), /constraint failed|site lead contract violation/i);
  assert.throws(() => database.connection.prepare("UPDATE site_contact_leads SET tenant_id = 'tenant-b' WHERE id = ?").run(createdA.id), /constraint failed|site lead contract violation/i);
  database.close(); database = null;

  // HTTP role privacy: admin/operator may handle contacts; reviewer/viewer get
  // masked values although all are authenticated and can read the CMS.
  const httpDatabasePath = path.join(directory, "http.sqlite");
  const port = 47_500 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], { cwd: path.resolve("."), env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: directory, TZ_DATABASE_PATH: httpDatabasePath, TZ_LOG_DIR: path.join(directory, "logs"), TZ_MASTER_KEY: randomBytes(32).toString("base64") }, stdio: "ignore" });
  for (let index = 0; index < 80; index += 1) { try { if ((await request(base, "/health/ready")).response.ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 100)); }
  let result = await request(base, "/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "lead-admin", displayName: "线索管理员", password: "LeadAdmin!2026" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const adminCookie = cookie(result.response); const adminCsrf = result.body.data.csrfToken;
  const admin = { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" };
  for (const [username, role] of [["lead-operator", "operator"], ["lead-reviewer", "reviewer"], ["lead-viewer", "viewer"]]) {
    result = await request(base, "/api/v1/users", { method: "POST", headers: admin, body: JSON.stringify({ username, displayName: username, password: "RoleUser!2026", role }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  }
  const sitePort = 48_000 + Math.floor(Math.random() * 300);
  siteRuntime = createSiteRuntime({ databasePath: httpDatabasePath, workspaceId: "default", projectId: "default", staticRoot: directory, host: "127.0.0.1", port: sitePort, baseUrl: "https://lead-contract.example.test", logger: { info() {}, warn() {}, error() {} } });
  const siteAddress = await siteRuntime.listen();
  publicBase = `http://127.0.0.1:${siteAddress.port}`;
  const publicLead = await request(base, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "lead-contract-http-0001" }, body: JSON.stringify({ name: "隐私测试客户", phone: "13812345678", company: "隐私测试企业", message: "测试角色脱敏" }) });
  assert.equal(publicLead.response.status, 201, JSON.stringify(publicLead.body));
  assert.doesNotMatch(JSON.stringify(publicLead.body), /13812345678/);
  assert.match(publicLead.body.data.message, /1 个工作日内回复/);
  const replayedLead = await request(base, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "lead-contract-http-0001" }, body: JSON.stringify({ name: "隐私测试客户", phone: "13812345678", company: "隐私测试企业", message: "测试角色脱敏" }) });
  assert.equal(replayedLead.response.status, 200);
  assert.equal(replayedLead.body.data.id, publicLead.body.data.id);
  assert.equal(replayedLead.body.data.duplicate, true);
  assert.equal(siteRuntime.store.database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE idempotency_key = ?").get("lead-contract-http-0001").count, 1);
  const conflict = await request(base, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "lead-contract-http-0001" }, body: JSON.stringify({ name: "另一客户", phone: "13999999999" }) });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.code, "SITE_LEAD_IDEMPOTENCY_CONFLICT");

  async function login(username) {
    const login = await request(base, "/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: username === "lead-admin" ? "LeadAdmin!2026" : "RoleUser!2026" }) });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    return { Cookie: cookie(login.response) };
  }
  for (const [username, full] of [["lead-admin", true], ["lead-operator", true], ["lead-reviewer", false], ["lead-viewer", false]]) {
    const session = username === "lead-admin" ? { Cookie: adminCookie } : await login(username);
    const snapshot = await request(base, "/api/v1/site-cms/snapshot", { headers: session });
    assert.equal(snapshot.response.status, 200, JSON.stringify(snapshot.body));
    const lead = snapshot.body.data.leads.items.find((item) => item.id === publicLead.body.data.id);
    assert.ok(lead);
    assert.equal(lead.contactMasked, !full);
    if (full) assert.equal(lead.phoneOrEmail, "13812345678");
    else { assert.equal(lead.phoneOrEmail, "138****5678"); assert.doesNotMatch(JSON.stringify(lead), /13812345678/); }
  }

  console.log("Official-site lead migration, canonical fields, status constraint, tenant/project boundary, UTM, public privacy, and role masking checks passed.");
} finally {
  database?.close();
  await siteRuntime?.close();
  if (child && child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); }
  await rm(directory, { recursive: true, force: true });
}
