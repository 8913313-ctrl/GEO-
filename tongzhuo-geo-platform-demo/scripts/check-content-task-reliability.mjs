import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { ContentStore } from "../content-store.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-content-reliability-"));
const databasePath = path.join(directory, "content.sqlite");
let database;
try {
  database = new ProductionDatabase({ databasePath });
  let store = new ContentStore(database, { workspaceId: "customer-a", requireEvidence: true });
  const task = store.upsertTask({ id: "TASK-IDEMPOTENT", title: "可靠性测试文章", status: "planned" });
  const replayedTask = store.upsertTask({ id: "TASK-IDEMPOTENT", title: "可靠性测试文章", status: "planned" });
  assert.equal(task.id, replayedTask.id);
  assert.equal(store.listTasks({ includeCancelled: true }).length, 1, "replaying a stable task id must not duplicate tasks");
  const article = store.upsertArticle({ id: "ART-IDEMPOTENT", taskId: task.id, title: task.title });
  const replayedArticle = store.upsertArticle({ id: "ART-IDEMPOTENT", taskId: task.id, title: task.title });
  assert.equal(article.id, replayedArticle.id);
  assert.equal(store.listArticles().length, 1, "replaying a stable article id must not duplicate articles");

  const queued = store.createGenerationJob({ id: "GEN-QUEUED", taskId: task.id, articleId: article.id, idempotencyKey: "same-request", requestPayload: { title: task.title } });
  const replayedJob = store.createGenerationJob({ id: "GEN-OTHER", taskId: task.id, articleId: article.id, idempotencyKey: "same-request", requestPayload: { title: task.title } });
  assert.equal(queued.id, replayedJob.id);
  assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_generation_jobs WHERE workspace_id = ?").get("customer-a").count, 1);
  assert.throws(() => store.createGenerationJob({ id: "GEN-CONFLICT", taskId: task.id, articleId: article.id, idempotencyKey: "same-request", requestPayload: { title: "different payload" } }), (error) => error.code === "CONTENT_REVISION_CONFLICT", "an idempotency key must not silently replay a different payload");
  store.updateGenerationJob({ jobId: queued.id, status: "running" });
  assert.throws(() => store.updateGenerationJob({ jobId: queued.id, status: "queued" }), (error) => error.code === "CONTENT_JOB_STATUS_REGRESSION", "running jobs must not regress to queued");

  const terminal = store.createGenerationJob({ id: "GEN-TERMINAL", taskId: task.id, articleId: article.id, idempotencyKey: "terminal-request" });
  store.updateGenerationJob({ jobId: terminal.id, status: "running" });
  store.updateGenerationJob({ jobId: terminal.id, status: "failed", errorCode: "PROVIDER_TEMPORARY", errorMessage: "Provider timed out after 90000ms; retry with a new idempotency key." });
  assert.throws(() => store.updateGenerationJob({ jobId: terminal.id, status: "running" }), (error) => error.code === "CONTENT_JOB_COMPLETED", "terminal generation jobs must never move backwards");
  assert.equal(store.generationJob("customer-a", terminal.id).errorCode, "PROVIDER_TEMPORARY");
  assert.match(store.generationJob("customer-a", terminal.id).errorMessage, /timed out|retry/i, "temporary provider failures must retain an actionable explanation");

  store.upsertTask({ id: task.id, title: task.title, status: "completed" });
  assert.equal(store.upsertTask({ id: task.id, title: task.title, status: "planned" }).status, "completed", "completed tasks must not regress during replay");
  assert.equal(store.upsertTask({ id: task.id, title: task.title, status: "cancelled" }).status, "completed", "completed tasks must remain terminal");

  const gateTask = store.createTask({ id: "TASK-REVIEW-GATE", title: "审核门禁测试", status: "draft" });
  const gateArticle = store.createArticle({ id: "ART-REVIEW-GATE", taskId: gateTask.id, title: gateTask.title, contentText: "这是一篇尚未经过风险扫描和人工审核的测试正文，重试与恢复流程都不能把它直接变成可以发布的正式版本。" });
  const gateBefore = store.canPublish(gateArticle.id, null, { workspaceId: "customer-a" });
  assert.equal(gateBefore.ok, false, "an unreviewed version must not pass the publication gate");
  assert.equal(store.upsertTask({ id: gateTask.id, title: gateTask.title, status: "generating" }).status, "generating");
  const gateAfter = store.canPublish(gateArticle.id, null, { workspaceId: "customer-a" });
  assert.equal(gateAfter.ok, false, "task replay must not bypass version review and freeze gates");

  database.close();
  database = new ProductionDatabase({ databasePath });
  store = new ContentStore(database, { workspaceId: "customer-a" });
  const recovered = store.recoverInterruptedGenerationJobs({ staleBefore: new Date(Date.now() + 1_000).toISOString() });
  assert.equal(recovered, 1, "restart recovery must resolve queued/running jobs left by the previous process");
  const interrupted = store.generationJob("customer-a", queued.id);
  assert.equal(interrupted.status, "failed");
  assert.equal(interrupted.errorCode, "CONTENT_GENERATION_INTERRUPTED");
  assert.match(interrupted.errorMessage, /restart|interrupted|重试/i);
  assert.throws(() => store.updateGenerationJob({ jobId: queued.id, status: "succeeded" }), (error) => error.code === "CONTENT_JOB_COMPLETED");
  assert.equal(store.recoverInterruptedGenerationJobs({ staleBefore: new Date(Date.now() + 1_000).toISOString() }), 0, "restart recovery must be idempotent");

  console.log("Content task idempotency, terminal-state, provider-error, and restart-recovery checks passed.");
} finally {
  try { database?.close(); } catch {}
  await rm(directory, { recursive: true, force: true });
}
