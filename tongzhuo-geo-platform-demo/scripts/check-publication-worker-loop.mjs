import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { PublisherStore } from "../publisher-store.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "publication-worker-loop-"));
const databasePath = path.join(directory, "worker.sqlite");
const port = 49_550 + Math.floor(Math.random() * 100);
const base = `http://127.0.0.1:${port}`;
const serverEnv = {
  ...process.env,
  NODE_ENV: "test",
  TZ_TENANT_ID: "tenant-worker",
  TZ_PROJECT_ID: "worker-project",
  TZ_BIND_HOST: "127.0.0.1",
  TZ_COOKIE_SECURE: "0",
  TZ_DATA_DIR: directory,
  TZ_DATABASE_PATH: databasePath,
  TZ_LOG_DIR: path.join(directory, "logs"),
  TZ_PUBLISHER_DATA_DIR: path.join(directory, "publisher"),
  TZ_MASTER_KEY: randomBytes(32).toString("base64"),
  TZ_PUBLISHER_RETRY_BASE_MS: "100"
};
let child;

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  return { response, body, text };
}

function cookie(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean))
    .map((value) => value.split(";", 1)[0]).join("; ");
}

async function startServer() {
  child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], { cwd: path.resolve("."), env: serverEnv, stdio: "ignore" });
  for (let index = 0; index < 80; index += 1) {
    try { if ((await request("/health/ready")).response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become ready.");
}

async function stopServer() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
  child = undefined;
}

try {
  // First boot only creates an administrator.  The process is then stopped so
  // jobs are seeded in the exact persistent publisher state the second, real
  // worker server will load (no second in-memory PublisherStore is involved).
  await startServer();
  let result = await request("/api/v1/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "worker-admin", displayName: "发布管理员", password: "WorkerAdmin!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  await stopServer();

  const store = new PublisherStore({ dataDir: path.join(directory, "publisher") });
  await store.load();
  const pairing = await store.createPairing();
  const registration = await store.register({
    pairing_code: pairing.code,
    device_id: "DEV-WORKER-1",
    device_secret: "worker-secret-2026",
    name: "Windows 发布器",
    capabilities: ["zhihu"],
    meta: {
      account_groups: [{
        id: "group-worker", name: "发布账号组",
        accounts: { zhihu: { platformId: "zhihu", name: "测试知乎", status: "online", profileKey: "group-worker--zhihu" } }
      }]
    }
  });
  const worker = { Authorization: `Bearer ${registration.pairing_token}`, "X-Publisher-Worker": "DEV-WORKER-1", "X-TZ-Project-ID": "worker-project", "Content-Type": "application/json" };
  const db = new ProductionDatabase({ databasePath });
  const now = new Date().toISOString();
  const userId = db.connection.prepare("SELECT id FROM users WHERE username_normalized = 'worker-admin'").get().id;

  function seedArticle(suffix) {
    const articleId = `ART-WORKER-${suffix}`;
    const versionId = `ARTV-WORKER-${suffix}`;
    db.connection.prepare("INSERT INTO content_articles (id, workspace_id, title, status, revision, created_at, updated_at, created_by, updated_by) VALUES (?, 'tenant-worker', ?, 'approved', 1, ?, ?, ?, ?)")
      .run(articleId, `测试文章 ${suffix}`, now, now, userId, userId);
    db.connection.prepare("INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, frozen_by, created_at, created_by) VALUES (?, ?, 1, ?, '<p>正文</p>', '正文', '', ?, 'human', 'approved', 'passed', '{}', ?, ?, ?, ?)")
      .run(versionId, articleId, `测试文章 ${suffix}`, suffix.padEnd(64, "a").slice(0, 64), now, userId, now, userId);
    db.connection.prepare("UPDATE content_articles SET current_version_id = ?, approved_version_id = ? WHERE id = ?").run(versionId, versionId, articleId);
    return { articleId, versionId };
  }

  async function seedJob(suffix) {
    const { articleId, versionId } = seedArticle(suffix);
    const job = await store.createJobs({
      articleId, contentArticleId: articleId, contentVersionId: versionId,
      article: { id: articleId, title: `测试文章 ${suffix}`, content: "<p>正文</p>" },
      platforms: ["zhihu"], platformOrder: ["zhihu"], accountGroupId: "group-worker", maxAttempts: 3
    });
    db.connection.prepare("INSERT INTO publication_tasks (id, tenant_id, content_id, content_version_id, channel, payload_hash, status, attempts, external_job_id, payload_json, created_by, created_at, expires_at, updated_at) VALUES (?, 'tenant-worker', ?, ?, 'zhihu', ?, 'queued', 0, ?, '{}', ?, ?, ?, ?)")
      .run(`PUBTASK-WORKER-${suffix}`, articleId, versionId, randomBytes(32).toString("hex"), String(job.id), userId, now, new Date(Date.now() + 60_000).toISOString(), now);
    return job;
  }

  const successJob = await seedJob("SUCCESS");
  const draftJob = await seedJob("DRAFT");
  const failJob = await seedJob("FAIL");
  db.close();

  await startServer();
  const wrongProject = await request("/api/v1/publisher/jobs?limit=1", { headers: { ...worker, "X-TZ-Project-ID": "another-project" } });
  assert.equal(wrongProject.response.status, 403, JSON.stringify(wrongProject.body));
  assert.equal(wrongProject.body.code, "PUBLISHER_PROJECT_MISMATCH");
  result = await request("/api/publisher/devices/DEV-WORKER-1/sessions", {
    method: "POST", headers: worker,
    body: JSON.stringify({ platform_id: "zhihu", profile_key: "group-worker--zhihu", account_name: "测试知乎", login_state: "ready", auto_allowed: true, cookies: [{ name: "secret" }] })
  });
  assert.equal(result.response.status, 422, JSON.stringify(result.body));
  assert.equal(result.body.code, "PUBLISHER_SESSION_SECRET_REJECTED");

  async function claimStart(job) {
    let response = await request(`/api/v1/publisher/jobs/${job.id}/claim`, { method: "POST", headers: worker, body: "{}" });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.status, "claimed");
    response = await request(`/api/v1/publisher/jobs/${job.id}/start`, { method: "POST", headers: worker, body: "{}" });
    assert.equal(response.response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.status, "running");
  }

  await claimStart(successJob);
  result = await request(`/api/v1/publisher/jobs/${successJob.id}/result`, { method: "POST", headers: worker, body: JSON.stringify({ state: "published", platform_results: { zhihu: { state: "published", remote_url: "https://zhuanlan.zhihu.com/p/123" } } }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(`/api/v1/publisher/jobs/${successJob.id}/result`, { method: "POST", headers: worker, body: JSON.stringify({ state: "failed", platform_results: { zhihu: { state: "failed", code: "LATE", error: "late result" } } }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));

  await claimStart(draftJob);
  result = await request(`/api/v1/publisher/jobs/${draftJob.id}/result`, { method: "POST", headers: worker, body: JSON.stringify({ state: "draft_saved", platform_results: { zhihu: { state: "draft_saved", remote_url: "https://zhuanlan.zhihu.com/write" } } }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await claimStart(failJob);
    result = await request(`/api/v1/publisher/jobs/${failJob.id}/result`, { method: "POST", headers: worker, body: JSON.stringify({ state: "failed", error_code: "PLATFORM_TIMEOUT", message: `第 ${attempt} 次失败`, platform_results: { zhihu: { state: "failed", code: "PLATFORM_TIMEOUT", error: `第 ${attempt} 次失败` } } }) });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 240));
  }

  const verify = new ProductionDatabase({ databasePath });
  const success = verify.connection.prepare("SELECT * FROM publication_tasks WHERE external_job_id = ?").get(String(successJob.id));
  assert.equal(success.status, "published"); assert.equal(success.attempts, 1); assert.equal(success.remote_url, "https://zhuanlan.zhihu.com/p/123"); assert.equal(success.error_code, null);
  const draft = verify.connection.prepare("SELECT * FROM publication_tasks WHERE external_job_id = ?").get(String(draftJob.id));
  assert.equal(draft.status, "draft_saved"); assert.equal(draft.attempts, 1);
  const failed = verify.connection.prepare("SELECT * FROM publication_tasks WHERE external_job_id = ?").get(String(failJob.id));
  assert.equal(failed.status, "failed"); assert.equal(failed.attempts, 3); assert.equal(failed.error_code, "PLATFORM_TIMEOUT"); assert.equal(failed.next_attempt_at, null);
  const workerLookupPlan = verify.connection.prepare("EXPLAIN QUERY PLAN SELECT id, status, expires_at FROM publication_tasks WHERE tenant_id = ? AND external_job_id = ?").all("tenant-worker", String(successJob.id));
  assert.ok(workerLookupPlan.some((row) => /publication_tasks_worker_job_idx/.test(String(row.detail || ""))), "worker publication lookup must use the composite queue index");
  const dueQueuePlan = verify.connection.prepare("EXPLAIN QUERY PLAN SELECT id FROM publication_tasks WHERE tenant_id = ? AND status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at, id LIMIT 100").all("tenant-worker", new Date().toISOString());
  assert.ok(dueQueuePlan.some((row) => /publication_tasks_due_queue_idx/.test(String(row.detail || ""))), "due publication queue lookup must use the composite due index");
  for (const action of ["publication.task.claim", "publication.task.start", "publication.task.result"]) assert.ok(verify.connection.prepare("SELECT 1 FROM audit_logs WHERE action = ?").get(action), action);
  verify.close();
  const persisted = JSON.stringify(await store.overview());
  assert.doesNotMatch(persisted, /cookie|storageState|profilePath/i);
  console.log("Publication worker claim/start, draft/published result, URL gate, terminal idempotency, bounded exponential retry, failure details, audit, and local-login boundary checks passed.");
} finally {
  await stopServer();
  try { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (error) { if (error?.code !== "EBUSY") throw error; }
}
