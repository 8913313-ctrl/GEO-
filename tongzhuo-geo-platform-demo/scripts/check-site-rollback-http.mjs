import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSiteRuntime } from "../site-server.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-rollback-http-"));
const databasePath = path.join(directory, "rollback.sqlite");
const port = 47_000 + Math.floor(Math.random() * 400);
const adminBase = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
  cwd: path.resolve("."),
  env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: directory, TZ_DATABASE_PATH: databasePath, TZ_LOG_DIR: path.join(directory, "logs"), TZ_MASTER_KEY: randomBytes(32).toString("base64") },
  stdio: "ignore"
});
let runtime;

function cookie(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; ");
}
async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, text, body };
}
async function ready() {
  for (let index = 0; index < 80; index += 1) {
    try { if ((await request(adminBase, "/health/ready")).response.ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("admin server did not start");
}

try {
  await ready();
  let result = await request(adminBase, "/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "rollback-admin", displayName: "回滚管理员", password: "RollbackAdmin!2026" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const auth = { Cookie: cookie(result.response), "X-CSRF-Token": result.body.data.csrfToken, "Content-Type": "application/json" };

  const snapshot = await request(adminBase, "/api/v1/site-cms/snapshot", { headers: auth });
  assert.equal(snapshot.response.status, 200, JSON.stringify(snapshot.body));
  const releaseV1 = snapshot.body.data.publication;
  const draft = structuredClone(snapshot.body.data.draft.snapshot);
  Object.assign(draft.settings, {
    siteName: "回滚验收官网 v1",
    companyName: "回滚验收企业有限公司",
    officialDomain: "rollback.example.test"
  });
  const v1Name = draft.settings.siteName;
  const v2Name = "回滚验收官网 v2";
  result = await request(adminBase, "/api/v1/site-cms/draft", { method: "PUT", headers: auth, body: JSON.stringify({ expectedRevision: snapshot.body.data.draft.revision, cms: draft }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const draftRevision = result.body.data.draft.revision;
  for (const [endpoint, reason] of [["submit-review", "提交回滚验收版本"], ["approve", "回滚验收版本审核通过"]]) {
    result = await request(adminBase, `/api/v1/site-cms/${endpoint}`, { method: "POST", headers: auth, body: JSON.stringify({ reason }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  }
  result = await request(adminBase, "/api/v1/site-cms/publish", { method: "POST", headers: auth, body: JSON.stringify({ expectedDraftRevision: draftRevision, note: "首次发布回滚验收 v1" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const firstRelease = result.body.data.publication;
  assert.equal(firstRelease.version, 1);
  assert.equal(releaseV1, null);

  const v2Draft = structuredClone(draft);
  v2Draft.settings.siteName = v2Name;
  result = await request(adminBase, "/api/v1/site-cms/draft", { method: "PUT", headers: auth, body: JSON.stringify({ expectedRevision: draftRevision, cms: v2Draft }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const v2DraftRevision = result.body.data.draft.revision;
  for (const [endpoint, reason] of [["submit-review", "提交回滚验收 v2"], ["approve", "回滚验收 v2 审核通过"]]) {
    result = await request(adminBase, `/api/v1/site-cms/${endpoint}`, { method: "POST", headers: auth, body: JSON.stringify({ reason }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  }
  result = await request(adminBase, "/api/v1/site-cms/publish", { method: "POST", headers: auth, body: JSON.stringify({ expectedDraftRevision: v2DraftRevision, note: "发布回滚验收 v2" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const releaseV2 = result.body.data.publication;
  assert.equal(releaseV2.version, firstRelease.version + 1);

  runtime = createSiteRuntime({ databasePath, workspaceId: "default", staticRoot: directory, host: "127.0.0.1", port: 0, baseUrl: "https://rollback.example.test", logger: { info() {}, warn() {}, error() {} } });
  const address = await runtime.listen(0, "127.0.0.1");
  const publicBase = `http://127.0.0.1:${address.port}`;
  assert.match((await request(publicBase, "/")).text, new RegExp(v2Name));

  const frozenBefore = runtime.store.database.connection.prepare("SELECT * FROM site_cms_releases WHERE id IN (?, ?) ORDER BY version_number").all(firstRelease.releaseId, releaseV2.releaseId);
  result = await request(adminBase, "/api/v1/site-cms/rollback", { method: "POST", headers: auth, body: JSON.stringify({ releaseId: "SITE-REL-OTHER-WORKSPACE", expectedCurrentVersion: releaseV2.version, reason: "跨企业回滚必须拒绝" }) });
  assert.equal(result.response.status, 404);
  assert.equal(result.body.code, "SITE_CMS_RELEASE_NOT_FOUND");
  result = await request(adminBase, "/api/v1/site-cms/rollback", { method: "POST", headers: auth, body: JSON.stringify({ releaseId: firstRelease.releaseId, expectedCurrentVersion: releaseV2.version, reason: "正式回滚到初始官网" }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const releaseV3 = result.body.data.publication;
  assert.equal(releaseV3.version, releaseV2.version + 1);
  assert.equal(releaseV3.operation, "rollback");
  assert.equal(releaseV3.status, "published");
  assert.notEqual(releaseV3.releaseId, firstRelease.releaseId);
  assert.notEqual(releaseV3.releaseId, releaseV2.releaseId);
  assert.equal(releaseV3.checksum, firstRelease.checksum);
  assert.equal(result.body.data.releases.items[0].sourceReleaseId, firstRelease.releaseId);
  assert.deepEqual(runtime.store.database.connection.prepare("SELECT * FROM site_cms_releases WHERE id IN (?, ?) ORDER BY version_number").all(firstRelease.releaseId, releaseV2.releaseId), frozenBefore);

  const publicAfter = await request(publicBase, "/");
  assert.equal(publicAfter.response.status, 200);
  assert.match(publicAfter.text, new RegExp(v1Name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(publicAfter.text, new RegExp(v2Name));
  const audit = runtime.store.database.connection.prepare("SELECT actor_user_id, details_json, created_at FROM audit_logs WHERE action = 'site.cms.rollback' AND entity_id = ?").get(releaseV3.releaseId);
  assert.ok(audit.actor_user_id);
  assert.ok(audit.created_at);
  const details = JSON.parse(audit.details_json);
  assert.equal(details.previousReleaseId, releaseV2.releaseId);
  assert.equal(details.previousVersion, releaseV2.version);
  assert.equal(details.restoredReleaseId, firstRelease.releaseId);
  assert.equal(details.restoredVersion, firstRelease.version);
  assert.equal(details.newReleaseId, releaseV3.releaseId);
  assert.equal(details.newVersion, releaseV3.version);
  assert.equal(details.reason, "正式回滚到初始官网");

  console.log("Official-site authenticated rollback API, new release, immutable history, audit lineage, deployment rejection, and live cutover checks passed.");
} finally {
  await runtime?.close();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
