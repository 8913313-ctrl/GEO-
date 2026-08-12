import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentGenerationScheduler, nextContentGenerationOccurrence } from "../content-generation-scheduler.mjs";
import { ContentStore } from "../content-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-scheduled-drafts-"));
let database;
try {
  database = new ProductionDatabase({ databasePath: path.join(directory, "scheduled.sqlite") });
  const workspaceId = "customer-a";
  const content = new ContentStore(database, { workspaceId, requireEvidence: false });
  const plan = content.createPlan({ workspaceId, id: "PLAN-A", name: "Customer recurring content", status: "active" });
  let calls = 0;
  const generateDraft = async ({ planId, idempotencyKey }) => {
    calls += 1;
    const task = content.createTask({ workspaceId, id: `TASK-${calls}`, planId, title: "Scheduled draft", status: "generating" });
    const article = content.createArticle({ workspaceId, id: `ART-${calls}`, taskId: task.id, planId, title: task.title });
    const version = content.createVersion({ workspaceId, articleId: article.id, expectedRevision: article.revision, title: task.title, contentText: "This is an automatically generated draft that still requires risk scanning and human review before publication.", source: "ai", metadata: { idempotencyKey } });
    return { task: content.task(workspaceId, task.id), article: content.article(workspaceId, article.id, { includeVersion: true }), version };
  };
  const scheduler = new ContentGenerationScheduler({ database, contentStore: content, workspaceId, generateDraft, failureThreshold: 2 });

  assert.throws(() => scheduler.upsertSchedule({ planId: plan.id, schedule: { cadence: "daily", timeZone: "Mars/Olympus" }, generationPayload: { topic: { title: "Invalid zone" } } }), { code: "CONTENT_SCHEDULE_INVALID" });
  assert.throws(() => scheduler.upsertSchedule({ planId: plan.id, status: "active", schedule: { cadence: "daily" }, generationPayload: { topic: { title: "Must start paused" } } }), { code: "CONTENT_SCHEDULE_STARTS_PAUSED" });
  assert.throws(() => scheduler.upsertSchedule({ planId: plan.id, schedule: { cadence: "daily" }, generationPayload: { topic: { title: "Unsafe" }, autoPublish: true } }), { code: "CONTENT_SCHEDULE_UNSAFE_PAYLOAD" });

  const dueAt = new Date(Date.now() - 1_000).toISOString();
  let schedule = scheduler.upsertSchedule({ planId: plan.id, schedule: { cadence: "daily", startAt: dueAt, timeZone: "Asia/Shanghai" }, generationPayload: { topic: { id: "TOPIC-A", title: "Building material selection guide" } } });
  assert.equal(schedule.status, "paused");
  assert.equal(schedule.schedule.timeZone, "Asia/Shanghai");
  assert.equal((await scheduler.processDue()).claimed, 0);
  schedule = scheduler.setStatus({ planId: plan.id, status: "active" });
  assert.equal(schedule.status, "active");
  const result = await scheduler.processDue();
  assert.equal(result.claimed, 1); assert.equal(result.draftCreated, 1); assert.equal(calls, 1);
  const run = result.items[0];
  const article = content.article(workspaceId, run.contentArticleId, { includeVersion: true });
  assert.equal(article.status, "draft"); assert.equal(article.currentVersion.reviewStatus, "draft"); assert.equal(article.currentVersion.riskStatus, "not_scanned");
  assert.equal(content.task(workspaceId, run.contentTaskId).status, "draft");
  assert.equal((await scheduler.processDue()).claimed, 0); assert.equal(calls, 1, "the same occurrence must not generate twice");
  assert.equal(database.connection.prepare("SELECT count(*) AS count FROM content_article_reviews").get().count, 0);
  assert.equal(database.connection.prepare("SELECT count(*) AS count FROM external_site_publication_tasks").get().count, 0, "scheduler must not create external publication work");

  const other = new ContentGenerationScheduler({ database, workspaceId: "customer-b", generateDraft: async () => ({}) });
  assert.equal(other.listSchedules().length, 0);
  assert.throws(() => other.getSchedule(plan.id), { code: "CONTENT_SCHEDULE_NOT_FOUND" });

  const failedPlan = content.createPlan({ workspaceId, id: "PLAN-FAIL", name: "Failure plan", status: "active" });
  let failing = new ContentGenerationScheduler({ database, workspaceId, generateDraft: async () => { const error = new Error("temporary model failure"); error.code = "MODEL_TEMPORARY"; throw error; }, failureThreshold: 2 });
  failing.upsertSchedule({ planId: failedPlan.id, schedule: { cadence: "daily", startAt: dueAt, timeZone: "UTC" }, generationPayload: { topic: { title: "Failure draft" } } });
  failing.setStatus({ planId: failedPlan.id, status: "active" });
  let failed = (await failing.processDue()).items[0];
  assert.equal(failed.status, "failed"); assert.ok(failing.getSchedule(failedPlan.id).retryAt);
  database.connection.prepare("UPDATE content_generation_schedules SET retry_at = ? WHERE workspace_id = ? AND plan_id = ?").run(new Date(Date.now() - 1).toISOString(), workspaceId, failedPlan.id);
  failed = (await failing.processDue()).items[0];
  assert.equal(failed.attempts, 2); assert.equal(failing.getSchedule(failedPlan.id).status, "attention");

  const spring = nextContentGenerationOccurrence({ cadence: "daily", startAt: "2026-03-07T14:30:00.000Z", anchorAt: "2026-03-07T14:30:00.000Z", timeZone: "America/New_York" }, "2026-03-07T14:30:00.000Z");
  assert.equal(spring, "2026-03-08T13:30:00.000Z", "daily cadence must retain local wall-clock time through DST");

  const actions = database.connection.prepare("SELECT action FROM audit_logs WHERE entity_type LIKE 'content_generation_schedule%' ORDER BY id").all().map((row) => row.action);
  for (const action of ["content.generation_schedule.create", "content.generation_schedule.resume", "content.generation_schedule_run.draft_created", "content.generation_schedule_run.failed"]) assert.ok(actions.includes(action), `missing audit ${action}`);
  console.log("Scheduled draft generation default-off, DST, idempotency, retry, tenant isolation, audit, and no-publish checks passed.");
} finally {
  database?.close();
  await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
