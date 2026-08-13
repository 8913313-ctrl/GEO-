import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePackage = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
const deliveryRoot = path.resolve(process.env.TZ_CLEAN_DELIVERY_ROOT || path.join(sourceRoot, "dist", "private-delivery", `tongzhuo-geo-private-${sourcePackage.version}-blank`));
const appRoot = path.join(deliveryRoot, "app");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-clean-delivery-runtime-"));
const dataDir = path.join(tempRoot, "data");
const siteDir = path.join(tempRoot, "site");
const databasePath = path.join(dataDir, "tongzhuo-production.sqlite");
const backupDir = path.join(tempRoot, "backup");
const tenantId = "tenant_clean_delivery";
const projectId = "clean-delivery-company";
const appPort = await freePort();
let sitePort = await freePort();
while (sitePort === appPort) sitePort = await freePort();
const processes = [];

async function assertPathExists(value, message) {
  await access(value).catch(() => { assert.fail(`${message}: ${value}`); });
}

async function freePort() {
  const { createServer } = await import("node:net");
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

async function portAcceptsConnections(port) {
  const { connect } = await import("node:net");
  return await new Promise((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.setTimeout(1_000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error(`tcp timeout:${port}`)); });
    socket.once("error", reject);
  });
}

function spawnRuntime(entry, extraEnv = {}) {
  const output = { stdout: "", stderr: "" };
  const child = spawn(process.execPath, [entry], {
    cwd: appRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      TZ_BIND_HOST: "127.0.0.1",
      PORT: String(appPort),
      TZ_SITE_BIND_HOST: "127.0.0.1",
      TZ_SITE_PORT: String(sitePort),
      TZ_SITE_BASE_URL: `http://127.0.0.1:${sitePort}`,
      TZ_SITE_STATIC_ROOT: siteDir,
      TZ_TENANT_ID: tenantId,
      TZ_PROJECT_ID: projectId,
      TZ_INDUSTRY_TEMPLATE: "professional-services",
      TZ_PROJECT_SEED: "",
      TZ_DATA_DIR: dataDir,
      TZ_DATABASE_PATH: databasePath,
      TZ_LOG_DIR: path.join(dataDir, "logs"),
      TZ_BACKUP_DIR: path.join(dataDir, "backups"),
      TZ_COOKIE_SECURE: "0",
      TZ_MASTER_KEY: Buffer.alloc(32, 0x5a).toString("base64"),
      TZ_PUBLISHER_SCHEDULER_INTERVAL_MS: "250",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output.stdout = `${output.stdout}${chunk}`.slice(-8_000); });
  child.stderr.on("data", (chunk) => { output.stderr = `${output.stderr}${chunk}`.slice(-8_000); });
  child.output = output;
  processes.push(child);
  return child;
}

async function waitFor(child, predicate, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`Runtime exited early (${child.exitCode}). stdout=${child.output.stdout} stderr=${child.output.stderr}`);
    try { if (await predicate()) return; } catch (error) { lastError = error?.message || String(error); }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Runtime did not become ready before timeout. lastError=${lastError} stdout=${child.output.stdout} stderr=${child.output.stderr}`);
}

async function request(base, pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("connection", "close");
  const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* HTML/text response */ }
  return { response, text, body };
}

function cookieValue(setCookie, name) {
  const match = String(setCookie || "").match(new RegExp(`(?:^|,\\s*)${name}=([^;]*)`));
  return match ? match[1] : "";
}

class CookieJar {
  values = new Map();
  absorb(response) {
    const headers = response.headers;
    const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") || ""];
    for (const value of values) {
      const match = String(value).match(/^([^=;]+)=([^;]*)/);
      if (match) this.values.set(match[1], match[2]);
    }
  }
  header() { return [...this.values.entries()].map(([key, value]) => `${key}=${value}`).join("; "); }
  csrf() { return this.values.get("tz_csrf") || ""; }
}

async function api(base, jar, pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  if (jar.header()) headers.set("cookie", jar.header());
  if (!["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase()) && jar.csrf()) headers.set("x-csrf-token", jar.csrf());
  const result = await request(base, pathname, { ...init, headers });
  jar.absorb(result.response);
  let body = null;
  try { body = JSON.parse(result.text); } catch { /* HTML/text response */ }
  return { ...result, body };
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 5_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}

try {
  await assertPathExists(appRoot, "clean blank delivery app directory is required");
  await assertPathExists(path.join(appRoot, "server.mjs"), "delivery app server is required");
  await assertPathExists(path.join(appRoot, "site-server.mjs"), "delivery app site server is required");
  const [manifest, deliveredPackage] = await Promise.all([
    readFile(path.join(deliveryRoot, "manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(appRoot, "package.json"), "utf8").then(JSON.parse)
  ]);
  assert.equal(manifest.product, "tongzhuo-geo-private-delivery");
  assert.equal(manifest.deliveryMode, "blank");
  assert.equal(manifest.security?.containsCustomerData, false);
  assert.equal(manifest.security?.containsRecoverySecrets, false);
  assert.equal(manifest.productVersion, sourcePackage.version, "delivery manifest version must match the current source package");
  assert.equal(deliveredPackage.version, sourcePackage.version, "delivered app version must match the current source package");
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/, "delivery manifest must identify its source commit");
  assert.equal(manifest.sourceDirty, false, "formal clean-delivery runtime gate rejects bundles built from a dirty source tree");
  assert.equal((await readFile(path.join(appRoot, "SOURCE_VERSION"), "utf8")).trim(), manifest.sourceCommit, "delivered runtime source identity must match the manifest");
  assert.notEqual(appPort, 18080); assert.notEqual(appPort, 43227); assert.notEqual(appPort, 18180);
  assert.notEqual(sitePort, 18080); assert.notEqual(sitePort, 43227); assert.notEqual(sitePort, 18180);

  // Start the API first so the runtime gate also proves a deterministic
  // first-boot path. Starting both processes against a new SQLite file at the
  // exact same instant currently exposes a migration race (reported below).
  const app = spawnRuntime("server.mjs");
  const appBase = `http://127.0.0.1:${appPort}`;
  const siteBase = `http://127.0.0.1:${sitePort}`;
  await waitFor(app, async () => {
    const ready = await request(appBase, "/health/ready");
    if (ready.response.status !== 200) throw new Error(`ready=${ready.response.status}:${ready.text.slice(0, 1_000)}`);
    assert.equal(ready.body?.runtime?.buildId, manifest.sourceCommit, "running delivery build must report the manifest source commit");
    return true;
  });
  const site = spawnRuntime("site-server.mjs");
  await waitFor(site, async () => portAcceptsConnections(sitePort));

  const beforeSetup = await request(appBase, "/api/v1/auth/status");
  assert.equal(beforeSetup.response.status, 200); assert.equal(beforeSetup.body?.data?.initialized, false, "blank delivery must start uninitialized");

  const jar = new CookieJar();
  const setup = await api(appBase, jar, "/api/v1/auth/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "CleanDelivery-Password-2026!", displayName: "新客户管理员", email: "owner@clean-delivery.example" }) });
  assert.equal(setup.response.status, 201, JSON.stringify(setup.body));
  assert.ok(jar.header() && jar.csrf(), "setup must issue session and CSRF cookies");
  assert.equal(setup.body?.data?.user?.role, "admin");

  const workspace = await api(appBase, jar, "/api/v1/workspace");
  assert.equal(workspace.response.status, 200, JSON.stringify(workspace.body));
  const initialState = workspace.body.data.state || {};
  const customerState = {
    ...initialState,
    site: {
      ...(initialState.site || {}),
      cms: {
        ...(initialState.site?.cms || {}),
        settings: { ...(initialState.site?.cms?.settings || {}), siteName: "清源工业装备", companyName: "清源工业装备有限公司", description: "面向企业客户的工业装备产品与技术资料。", officialDomain: `http://127.0.0.1:${sitePort}`, footerLabel: "清源工业装备" },
        theme: { ...(initialState.site?.cms?.theme || {}), key: "industrial", name: "工业企业 · 专业版", primaryColor: "#356e56", cta: "预约产品咨询" },
        services: [{ id: "product-selection", title: "产品选型支持", description: "按工况、规格和交付边界整理选型资料。", href: "/contact/", status: "published", order: 1 }],
        problemGroups: [{ id: "selection", title: "产品选型问题", service: "产品选型支持", description: "回答客户购买前的关键问题。", status: "published", order: 1, questions: [{ id: "question-1", slug: "product-selection", title: "如何选择合适的产品？", answer: "先确认工况、规格与交付条件。", status: "published", order: 1 }] }],
        cases: []
      }
    },
    businessLines: [{ id: "BL-CLEAN", name: "工业装备", product: "工业装备产品", status: "active" }]
  };
  const savedWorkspace = await api(appBase, jar, "/api/v1/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: workspace.body.data.revision, state: customerState, source: "clean-delivery-runtime-check" }) });
  assert.equal(savedWorkspace.response.status, 200, JSON.stringify(savedWorkspace.body));

  const cms = await api(appBase, jar, "/api/v1/site-cms");
  assert.equal(cms.response.status, 200, JSON.stringify(cms.body));
  const draft = cms.body.data.draft;
  const customerCms = {
    ...draft.snapshot,
    settings: { ...draft.snapshot.settings, siteName: "清源工业装备", companyName: "清源工业装备有限公司", description: "面向企业客户的工业装备产品与技术资料。", officialDomain: `http://127.0.0.1:${sitePort}`, footerLabel: "清源工业装备" },
    theme: { ...draft.snapshot.theme, key: "industrial", name: "工业企业 · 专业版", primaryColor: "#356e56", cta: "预约产品咨询" },
    services: [{ id: "product-selection", title: "产品选型支持", description: "按工况、规格和交付边界整理选型资料。", href: "/contact/", status: "published", order: 1 }]
  };
  const savedCms = await api(appBase, jar, "/api/v1/site-cms/draft", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: draft.revision, cms: customerCms }) });
  assert.equal(savedCms.response.status, 200, JSON.stringify(savedCms.body));
  const savedDraft = savedCms.body.data.draft;
  const attemptedPublish = await api(appBase, jar, "/api/v1/site-cms/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedDraftRevision: savedDraft.revision, note: "must be blocked before review" }) });
  assert.equal(attemptedPublish.response.status, 409, "CMS publish must be blocked before approval");
  const submitted = await api(appBase, jar, "/api/v1/site-cms/submit-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "clean delivery review" }) });
  assert.equal(submitted.response.status, 200, JSON.stringify(submitted.body));
  const approved = await api(appBase, jar, "/api/v1/site-cms/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "clean delivery approved" }) });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const published = await api(appBase, jar, "/api/v1/site-cms/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedDraftRevision: savedDraft.revision, note: "clean delivery publish" }) });
  assert.equal(published.response.status, 200, JSON.stringify(published.body));
  const publicHome = await request(siteBase, "/");
  assert.equal(publicHome.response.status, 200); assert.match(publicHome.text, /清源工业装备有限公司/); assert.match(publicHome.text, /产品选型支持/); assert.doesNotMatch(publicHome.text, /桐灼|灼见 AI|鲁ICP备2026021587号-2/);

  await stopProcess(site); await stopProcess(app);
  const { createProductionBackup, verifyProductionBackup, restoreProductionBackup } = await import(pathToFileURL(path.join(appRoot, "scripts", "production-backup-v2.mjs")).href);
  const backup = await createProductionBackup({ targetDir: backupDir, backupId: "CLEAN-DELIVERY-RUNTIME", projectRoot: appRoot, config: { dataDir, databasePath, backupDir: path.join(dataDir, "backups") }, env: { TZ_DATA_DIR: dataDir, TZ_DATABASE_PATH: databasePath, TZ_BACKUP_DIR: path.join(dataDir, "backups"), TZ_SITE_STATIC_ROOT: siteDir, TZ_DEPLOY_CONFIG_DIR: path.join(tempRoot, "deploy") } });
  assert.equal((await verifyProductionBackup(backup.targetDir)).format, "tongzhuo-private-backup-v2");
  const db = new DatabaseSync(databasePath);
  db.prepare("UPDATE site_cms_workflow_state SET status = 'unpublished' WHERE workspace_id = ?").run(tenantId);
  db.prepare("DELETE FROM workspace_state WHERE workspace_id = ?").run(tenantId);
  db.close();
  await restoreProductionBackup({ sourceDir: backup.targetDir, force: true, skipSafetySnapshot: true, projectRoot: appRoot, config: { dataDir, databasePath, backupDir: path.join(dataDir, "backups") }, env: { TZ_DATA_DIR: dataDir, TZ_DATABASE_PATH: databasePath, TZ_BACKUP_DIR: path.join(dataDir, "backups"), TZ_SITE_STATIC_ROOT: siteDir, TZ_DEPLOY_CONFIG_DIR: path.join(tempRoot, "deploy") } });
  const restored = new DatabaseSync(databasePath);
  assert.equal(restored.prepare("SELECT COUNT(*) AS count FROM workspace_state WHERE workspace_id = ?").get(tenantId).count, 1);
  assert.equal(restored.prepare("SELECT status FROM site_cms_workflow_state WHERE workspace_id = ?").get(tenantId).status, "published");
  restored.close();
  const restoredApp = spawnRuntime("server.mjs");
  await waitFor(restoredApp, async () => {
    const ready = await request(appBase, "/health/ready");
    if (ready.response.status !== 200) return false;
    assert.equal(ready.body?.runtime?.buildId, manifest.sourceCommit, "restored delivery build must retain the manifest source identity");
    return true;
  });
  const restoredSite = spawnRuntime("site-server.mjs");
  await waitFor(restoredSite, async () => portAcceptsConnections(sitePort));
  const restoredHome = await request(siteBase, "/");
  assert.equal(restoredHome.response.status, 200);
  assert.match(restoredHome.text, /清源工业装备有限公司/);
  assert.match(restoredHome.text, /产品选型支持/);
  assert.doesNotMatch(restoredHome.text, /桐灼|灼见 AI|鲁ICP备2026021587号-2/);
  await stopProcess(restoredSite);
  await stopProcess(restoredApp);
  console.log(`Clean private-delivery runtime passed: bundle=${deliveryRoot} appPort=${appPort} sitePort=${sitePort} tempRoot=${tempRoot}`);
} finally {
  for (const child of processes.reverse()) await stopProcess(child);
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
