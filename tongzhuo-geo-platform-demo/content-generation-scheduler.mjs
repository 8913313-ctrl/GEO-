import crypto from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";

const CADENCES = new Set(["daily", "weekly", "monthly", "interval"]);
const SCHEDULE_STATUSES = new Set(["active", "paused", "attention"]);
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const GENERATION_FIELDS = new Set([
  "topic", "topicBrief", "contentType", "companyProfile", "businessLine", "rag",
  "writingAgent", "agentSnapshot", "providerId", "model", "outputContract", "dueAt"
]);
const FORBIDDEN_GENERATION_FIELDS = new Set([
  "status", "taskStatus", "reviewStatus", "riskStatus", "approved", "approve", "published",
  "publish", "frozenAt", "frozenBy", "submitReview", "autoPublish", "publication"
]);
const formatters = new Map();

export class ContentGenerationSchedulerError extends Error {
  constructor(message, status = 422, code = "CONTENT_GENERATION_SCHEDULER_ERROR", details = undefined) {
    super(message);
    this.name = "ContentGenerationSchedulerError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function parseJson(value, fallback = {}) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } }
function clean(value, maximum = 2_000) { return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum); }
function timestamp(value, field, fallback = "") {
  const raw = value || fallback;
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.valueOf())) throw new ContentGenerationSchedulerError(`${field} must be an ISO-8601 timestamp.`, 422, "CONTENT_SCHEDULE_INVALID", { field });
  return parsed.toISOString();
}
function integer(value, field, minimum, maximum, fallback = undefined) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new ContentGenerationSchedulerError(`${field} must be an integer between ${minimum} and ${maximum}.`, 422, "CONTENT_SCHEDULE_INVALID", { field });
  return parsed;
}
function normalizeTimeZone(value) {
  const requested = clean(value || "Asia/Shanghai", 120);
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: requested }).resolvedOptions().timeZone; }
  catch { throw new ContentGenerationSchedulerError("schedule.timeZone must be a valid IANA time zone.", 422, "CONTENT_SCHEDULE_INVALID", { field: "schedule.timeZone", value: requested }); }
}
function formatter(timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat("en-CA", {
    timeZone, calendar: "iso8601", numberingSystem: "latn", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }));
  return formatters.get(timeZone);
}
function zonedParts(value, timeZone) {
  const result = {};
  formatter(timeZone).formatToParts(new Date(value)).forEach((part) => {
    if (["year", "month", "day", "hour", "minute", "second"].includes(part.type)) result[part.type] = Number(part.value);
  });
  result.millisecond = new Date(value).getUTCMilliseconds();
  return result;
}
function localEpoch(parts) { return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond || 0); }
function localToInstant(parts, timeZone) {
  const target = localEpoch(parts);
  let candidate = target;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const delta = target - localEpoch(zonedParts(candidate, timeZone));
    if (!delta) return new Date(candidate).toISOString();
    candidate += delta;
  }
  for (let minute = 0; minute <= 180; minute += 1) {
    const probe = candidate + minute * 60_000;
    if (localEpoch(zonedParts(probe, timeZone)) >= target) return new Date(probe).toISOString();
  }
  throw new ContentGenerationSchedulerError("The local schedule time cannot be resolved.", 409, "CONTENT_SCHEDULE_UNRESOLVABLE");
}
function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second, parts.millisecond || 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(), millisecond: date.getUTCMilliseconds() };
}
function lastDay(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }

export function normalizeContentGenerationSchedule(input = {}, at = now()) {
  const source = object(input);
  const cadence = clean(source.cadence || (source.intervalHours ? "interval" : "weekly"), 32).toLowerCase();
  if (!CADENCES.has(cadence)) throw new ContentGenerationSchedulerError("schedule.cadence must be daily, weekly, monthly, or interval.", 422, "CONTENT_SCHEDULE_INVALID", { field: "schedule.cadence" });
  const startAt = timestamp(source.startAt || source.firstRunAt || at, "schedule.startAt", at);
  const anchorAt = timestamp(source.anchorAt || startAt, "schedule.anchorAt", startAt);
  const intervalHours = cadence === "interval" ? integer(source.intervalHours, "schedule.intervalHours", 24, 24 * 366) : cadence === "daily" ? 24 : cadence === "weekly" ? 168 : 0;
  return { version: "content-generation-schedule-v1", cadence, intervalHours, timeZone: normalizeTimeZone(source.timeZone), anchorAt, startAt };
}

export function nextContentGenerationOccurrence(schedule, occurrenceAt) {
  const source = normalizeContentGenerationSchedule(schedule, occurrenceAt);
  const current = timestamp(occurrenceAt, "occurrenceAt");
  if (source.cadence === "interval") return new Date(new Date(current).valueOf() + source.intervalHours * 3_600_000).toISOString();
  const currentLocal = zonedParts(current, source.timeZone);
  if (source.cadence === "daily" || source.cadence === "weekly") return localToInstant(addLocalDays(currentLocal, source.cadence === "daily" ? 1 : 7), source.timeZone);
  const anchor = zonedParts(source.anchorAt, source.timeZone);
  const nextMonthIndex = currentLocal.month;
  const year = currentLocal.year + Math.floor(nextMonthIndex / 12);
  const month = nextMonthIndex % 12 + 1;
  return localToInstant({ year, month, day: Math.min(anchor.day, lastDay(year, month)), hour: anchor.hour, minute: anchor.minute, second: anchor.second, millisecond: anchor.millisecond }, source.timeZone);
}

function nextFuture(schedule, occurrenceAt, cutoff) {
  let candidate = nextContentGenerationOccurrence(schedule, occurrenceAt);
  for (let guard = 0; guard < 10_000; guard += 1) {
    if (new Date(candidate).valueOf() > new Date(cutoff).valueOf()) return candidate;
    candidate = nextContentGenerationOccurrence(schedule, candidate);
  }
  throw new ContentGenerationSchedulerError("The schedule cannot advance to a future occurrence.", 409, "CONTENT_SCHEDULE_UNRESOLVABLE");
}

export function normalizeContentGenerationPayload(input = {}) {
  const source = object(input);
  for (const field of FORBIDDEN_GENERATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) throw new ContentGenerationSchedulerError(`generationPayload.${field} is not allowed for automatic draft generation.`, 422, "CONTENT_SCHEDULE_UNSAFE_PAYLOAD", { field });
  }
  const output = {};
  for (const field of GENERATION_FIELDS) if (Object.prototype.hasOwnProperty.call(source, field)) output[field] = source[field];
  let encoded;
  try { encoded = JSON.stringify(output); } catch { throw new ContentGenerationSchedulerError("generationPayload must be JSON serializable.", 422, "CONTENT_SCHEDULE_INVALID"); }
  if (Buffer.byteLength(encoded, "utf8") > 256_000) throw new ContentGenerationSchedulerError("generationPayload exceeds 256000 bytes.", 422, "CONTENT_SCHEDULE_INVALID");
  const topic = object(output.topic);
  if (!clean(topic.coreQuestion || topic.title || object(output.topicBrief).coreQuestion, 5_000)) throw new ContentGenerationSchedulerError("generationPayload requires a topic title or core question.", 422, "CONTENT_SCHEDULE_TOPIC_REQUIRED");
  return JSON.parse(encoded);
}

function publicSchedule(row) {
  if (!row) return null;
  return {
    id: row.id, workspaceId: row.workspace_id, planId: row.plan_id, status: row.status,
    schedule: parseJson(row.schedule_json), generationPayload: parseJson(row.generation_payload_json),
    nextRunAt: row.next_run_at, retryAt: row.retry_at || null, consecutiveFailures: Number(row.consecutive_failures),
    lastScheduledAt: row.last_scheduled_at || null, lastSuccessAt: row.last_success_at || null,
    lastErrorCode: row.last_error_code || null, lastErrorMessage: row.last_error_message || null,
    createdBy: row.created_by || null, updatedBy: row.updated_by || null, createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function publicRun(row) {
  if (!row) return null;
  return {
    id: row.id, workspaceId: row.workspace_id, scheduleId: row.schedule_id, planId: row.plan_id,
    scheduledFor: row.scheduled_for, status: row.status, attempts: Number(row.attempts), idempotencyKey: row.idempotency_key,
    contentTaskId: row.content_task_id || null, contentArticleId: row.content_article_id || null, articleVersionId: row.article_version_id || null,
    errorCode: row.error_code || null, errorMessage: row.error_message || null,
    startedAt: row.started_at || null, completedAt: row.completed_at || null, createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function errorInfo(error) { return { code: clean(error?.code || "CONTENT_SCHEDULE_GENERATION_FAILED", 200), message: clean(error?.message || "Scheduled draft generation failed.", 2_000) }; }

export class ContentGenerationScheduler {
  constructor({ database, contentStore = null, workspaceId = "default", generateDraft, failureThreshold = 5, staleRunMs = 30 * 60_000 } = {}) {
    if (!database?.connection) throw new TypeError("ContentGenerationScheduler requires a ProductionDatabase instance.");
    if (typeof generateDraft !== "function") throw new TypeError("ContentGenerationScheduler requires a generateDraft callback.");
    this.database = database;
    this.connection = database.connection;
    this.contentStore = contentStore;
    this.workspaceId = String(workspaceId || "default");
    this.generateDraft = generateDraft;
    this.failureThreshold = integer(failureThreshold, "failureThreshold", 1, 20, 5);
    this.staleRunMs = integer(staleRunMs, "staleRunMs", 60_000, 24 * 60 * 60_000, 30 * 60_000);
  }

  _scheduleRow(workspaceId, planId) { return this.connection.prepare("SELECT * FROM content_generation_schedules WHERE workspace_id = ? AND plan_id = ?").get(workspaceId, planId); }
  _runRow(runId) { return this.connection.prepare("SELECT * FROM content_generation_schedule_runs WHERE workspace_id = ? AND id = ?").get(this.workspaceId, runId); }
  _audit(action, entityType, entityId, details, actor, request, at) { appendAuditLog(this.connection, { actorUserId: actorId(actor), action, entityType, entityId, details, request, createdAt: at }); }

  getSchedule(planId, workspaceId = this.workspaceId) {
    const row = this._scheduleRow(workspaceId, clean(planId, 180));
    if (!row) throw new ContentGenerationSchedulerError("Content generation schedule not found.", 404, "CONTENT_SCHEDULE_NOT_FOUND", { planId });
    return publicSchedule(row);
  }
  listSchedules({ workspaceId = this.workspaceId, status = "", limit = 100 } = {}) {
    const params = [workspaceId]; let sql = "SELECT * FROM content_generation_schedules WHERE workspace_id = ?";
    if (status) { if (!SCHEDULE_STATUSES.has(status)) throw new ContentGenerationSchedulerError("Invalid schedule status.", 422, "CONTENT_SCHEDULE_INVALID"); sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY updated_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(sql).all(...params).map(publicSchedule);
  }
  upsertSchedule({ workspaceId = this.workspaceId, planId, status = "paused", schedule, generationPayload, actor = null, request = null } = {}) {
    const normalizedPlanId = clean(planId, 180);
    if (!normalizedPlanId) throw new ContentGenerationSchedulerError("planId is required.", 422, "CONTENT_SCHEDULE_INVALID");
    const normalizedStatus = clean(status, 32).toLowerCase();
    if (!SCHEDULE_STATUSES.has(normalizedStatus)) throw new ContentGenerationSchedulerError("status must be active, paused, or attention.", 422, "CONTENT_SCHEDULE_INVALID");
    const at = now(); const normalizedSchedule = normalizeContentGenerationSchedule(schedule, at); const payload = normalizeContentGenerationPayload(generationPayload);
    const existing = this._scheduleRow(workspaceId, normalizedPlanId);
    if (!existing && normalizedStatus !== "paused") throw new ContentGenerationSchedulerError("New schedules must start paused and require an explicit resume confirmation.", 422, "CONTENT_SCHEDULE_STARTS_PAUSED");
    const scheduleJson = JSON.stringify(normalizedSchedule); const payloadJson = JSON.stringify(payload);
    const resetOccurrence = !existing || existing.schedule_json !== scheduleJson;
    this.database.transaction(() => {
      if (!existing) {
        this.connection.prepare(`INSERT INTO content_generation_schedules (id, workspace_id, plan_id, status, schedule_json, generation_payload_json, next_run_at, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id("CGS"), workspaceId, normalizedPlanId, normalizedStatus, scheduleJson, payloadJson, normalizedSchedule.startAt, actorId(actor), actorId(actor), at, at);
      } else {
        this.connection.prepare(`UPDATE content_generation_schedules SET status = ?, schedule_json = ?, generation_payload_json = ?, next_run_at = ?, retry_at = NULL, consecutive_failures = CASE WHEN ? = 'active' THEN 0 ELSE consecutive_failures END, last_error_code = NULL, last_error_message = NULL, updated_by = ?, updated_at = ? WHERE workspace_id = ? AND plan_id = ?`)
          .run(normalizedStatus, scheduleJson, payloadJson, resetOccurrence ? normalizedSchedule.startAt : existing.next_run_at, normalizedStatus, actorId(actor), at, workspaceId, normalizedPlanId);
      }
      const current = this._scheduleRow(workspaceId, normalizedPlanId);
      this._audit(existing ? "content.generation_schedule.update" : "content.generation_schedule.create", "content_generation_schedule", current.id, { workspaceId, planId: normalizedPlanId, status: normalizedStatus, schedule: normalizedSchedule, draftOnly: true }, actor, request, at);
    });
    return this.getSchedule(normalizedPlanId, workspaceId);
  }
  setStatus({ workspaceId = this.workspaceId, planId, status, actor = null, request = null } = {}) {
    const normalized = clean(status, 32).toLowerCase();
    if (!["active", "paused"].includes(normalized)) throw new ContentGenerationSchedulerError("Schedule status can only be set to active or paused.", 422, "CONTENT_SCHEDULE_INVALID");
    const current = this.getSchedule(planId, workspaceId); const at = now();
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE content_generation_schedules SET status = ?, retry_at = CASE WHEN ? = 'active' THEN retry_at ELSE NULL END, last_error_code = CASE WHEN ? = 'active' THEN NULL ELSE last_error_code END, last_error_message = CASE WHEN ? = 'active' THEN NULL ELSE last_error_message END, updated_by = ?, updated_at = ? WHERE workspace_id = ? AND plan_id = ?`)
        .run(normalized, normalized, normalized, normalized, actorId(actor), at, workspaceId, current.planId);
      this._audit(`content.generation_schedule.${normalized === "active" ? "resume" : "pause"}`, "content_generation_schedule", current.id, { workspaceId, planId: current.planId, draftOnly: true }, actor, request, at);
    });
    return this.getSchedule(current.planId, workspaceId);
  }
  listRuns({ workspaceId = this.workspaceId, planId = "", limit = 100 } = {}) {
    const params = [workspaceId]; let sql = "SELECT * FROM content_generation_schedule_runs WHERE workspace_id = ?";
    if (planId) { sql += " AND plan_id = ?"; params.push(planId); }
    sql += " ORDER BY scheduled_for DESC, created_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(sql).all(...params).map(publicRun);
  }

  claimDue({ at = now(), limit = 3 } = {}) {
    const cutoff = timestamp(at, "at"); const maximum = Math.max(1, Math.min(100, Number(limit) || 3)); const claimed = [];
    this.database.transaction(() => {
      const retryRows = this.connection.prepare(`SELECT r.* FROM content_generation_schedule_runs r JOIN content_generation_schedules s ON s.id = r.schedule_id WHERE r.workspace_id = ? AND r.status = 'failed' AND s.status = 'active' AND s.retry_at IS NOT NULL AND s.retry_at <= ? ORDER BY s.retry_at ASC LIMIT ?`).all(this.workspaceId, cutoff, maximum);
      retryRows.forEach((row) => {
        const result = this.connection.prepare("UPDATE content_generation_schedule_runs SET status = 'queued', error_code = NULL, error_message = NULL, completed_at = NULL, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'failed'").run(cutoff, this.workspaceId, row.id);
        if (Number(result.changes)) { this.connection.prepare("UPDATE content_generation_schedules SET retry_at = NULL, updated_at = ? WHERE workspace_id = ? AND id = ?").run(cutoff, this.workspaceId, row.schedule_id); claimed.push(publicRun(this._runRow(row.id))); }
      });
      const remaining = maximum - claimed.length;
      if (remaining <= 0) return;
      const schedules = this.connection.prepare(`SELECT * FROM content_generation_schedules WHERE workspace_id = ? AND status = 'active' AND retry_at IS NULL AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT ?`).all(this.workspaceId, cutoff, remaining);
      schedules.forEach((scheduleRow) => {
        const schedule = parseJson(scheduleRow.schedule_json); const occurrence = scheduleRow.next_run_at;
        const nextRunAt = nextFuture(schedule, occurrence, cutoff); const runId = id("CGR"); const key = `content-schedule:${scheduleRow.id}:${occurrence}`;
        try {
          this.connection.prepare(`INSERT INTO content_generation_schedule_runs (id, workspace_id, schedule_id, plan_id, scheduled_for, status, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)`)
            .run(runId, this.workspaceId, scheduleRow.id, scheduleRow.plan_id, occurrence, key, cutoff, cutoff);
          claimed.push(publicRun(this._runRow(runId)));
        } catch (error) {
          if (!String(error?.message || "").includes("UNIQUE")) throw error;
        }
        this.connection.prepare("UPDATE content_generation_schedules SET next_run_at = ?, last_scheduled_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND next_run_at = ?")
          .run(nextRunAt, occurrence, cutoff, this.workspaceId, scheduleRow.id, occurrence);
      });
    });
    return claimed;
  }

  _validateDraft(result) {
    const version = result?.version || result?.contentVersion || result?.article?.currentVersion;
    const article = result?.article || result?.contentArticle;
    if (!version?.id || !article?.id) throw new ContentGenerationSchedulerError("Generation callback did not return a persisted article draft.", 500, "CONTENT_SCHEDULE_DRAFT_MISSING");
    if (version.reviewStatus !== "draft" || version.frozenAt || ["approved", "published"].includes(article.status)) {
      throw new ContentGenerationSchedulerError("Automatic generation produced content outside the draft review boundary.", 500, "CONTENT_SCHEDULE_DRAFT_BOUNDARY_VIOLATION", { articleStatus: article.status, reviewStatus: version.reviewStatus, frozenAt: version.frozenAt || null });
    }
    return { taskId: result?.task?.id || article.taskId || null, articleId: article.id, versionId: version.id };
  }
  async executeRun(runId, { actor = null, request = null } = {}) {
    const at = now(); let claimed = false; let row;
    this.database.transaction(() => {
      row = this._runRow(runId);
      if (!row) throw new ContentGenerationSchedulerError("Content generation schedule run not found.", 404, "CONTENT_SCHEDULE_RUN_NOT_FOUND", { runId });
      const result = this.connection.prepare(`UPDATE content_generation_schedule_runs SET status = 'running', attempts = attempts + 1, started_at = COALESCE(started_at, ?), completed_at = NULL, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'queued'`).run(at, at, this.workspaceId, runId);
      claimed = Number(result.changes) === 1;
    });
    if (!claimed) return publicRun(this._runRow(runId));
    row = this._runRow(runId); const scheduleRow = this.connection.prepare("SELECT * FROM content_generation_schedules WHERE workspace_id = ? AND id = ?").get(this.workspaceId, row.schedule_id);
    if (!scheduleRow || scheduleRow.status !== "active") {
      this.database.transaction(() => this.connection.prepare("UPDATE content_generation_schedule_runs SET status = 'skipped', error_code = 'CONTENT_SCHEDULE_NOT_ACTIVE', error_message = 'The schedule was paused before execution.', completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'").run(at, at, this.workspaceId, runId));
      return publicRun(this._runRow(runId));
    }
    try {
      const result = await this.generateDraft({ workspaceId: this.workspaceId, planId: row.plan_id, scheduledFor: row.scheduled_for, idempotencyKey: row.idempotency_key, attempt: Number(row.attempts), generationPayload: parseJson(scheduleRow.generation_payload_json), actor, request });
      const draft = this._validateDraft(result); const completedAt = now();
      this.database.transaction(() => {
        this.connection.prepare(`UPDATE content_generation_schedule_runs SET status = 'draft_created', content_task_id = ?, content_article_id = ?, article_version_id = ?, error_code = NULL, error_message = NULL, completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'`)
          .run(draft.taskId, draft.articleId, draft.versionId, completedAt, completedAt, this.workspaceId, runId);
        this.connection.prepare(`UPDATE content_generation_schedules SET retry_at = NULL, consecutive_failures = 0, last_success_at = ?, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE workspace_id = ? AND id = ?`)
          .run(completedAt, completedAt, this.workspaceId, row.schedule_id);
        this._audit("content.generation_schedule_run.draft_created", "content_generation_schedule_run", runId, { workspaceId: this.workspaceId, planId: row.plan_id, scheduledFor: row.scheduled_for, articleId: draft.articleId, versionId: draft.versionId, draftOnly: true }, actor, request, completedAt);
      });
    } catch (error) {
      const failedAt = now(); const details = errorInfo(error); const currentSchedule = this.connection.prepare("SELECT * FROM content_generation_schedules WHERE workspace_id = ? AND id = ?").get(this.workspaceId, row.schedule_id); const failures = Number(currentSchedule?.consecutive_failures || 0) + 1;
      const attention = failures >= this.failureThreshold || details.code === "CONTENT_SCHEDULE_DRAFT_BOUNDARY_VIOLATION";
      const retryAt = attention ? null : new Date(new Date(failedAt).valueOf() + RETRY_DELAYS_MS[Math.min(failures - 1, RETRY_DELAYS_MS.length - 1)]).toISOString();
      this.database.transaction(() => {
        this.connection.prepare("UPDATE content_generation_schedule_runs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'").run(details.code, details.message, failedAt, failedAt, this.workspaceId, runId);
        this.connection.prepare(`UPDATE content_generation_schedules SET status = CASE WHEN ? THEN 'attention' ELSE status END, retry_at = ?, consecutive_failures = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`)
          .run(attention ? 1 : 0, retryAt, failures, details.code, details.message, failedAt, this.workspaceId, row.schedule_id);
        this._audit("content.generation_schedule_run.failed", "content_generation_schedule_run", runId, { workspaceId: this.workspaceId, planId: row.plan_id, scheduledFor: row.scheduled_for, code: details.code, failures, retryAt, attention, draftOnly: true }, actor, request, failedAt);
      });
    }
    return publicRun(this._runRow(runId));
  }
  async processDue({ at = now(), limit = 3, actor = null, request = null } = {}) {
    const runs = this.claimDue({ at, limit });
    const results = [];
    for (const run of runs) results.push(await this.executeRun(run.id, { actor, request }));
    return { claimed: runs.length, draftCreated: results.filter((item) => item.status === "draft_created").length, failed: results.filter((item) => item.status === "failed").length, skipped: results.filter((item) => item.status === "skipped").length, items: results };
  }
  recoverStaleRuns({ at = now() } = {}) {
    const current = timestamp(at, "at"); const cutoff = new Date(new Date(current).valueOf() - this.staleRunMs).toISOString(); let recovered = 0;
    this.database.transaction(() => {
      const rows = this.connection.prepare("SELECT * FROM content_generation_schedule_runs WHERE workspace_id = ? AND status = 'running' AND updated_at < ?").all(this.workspaceId, cutoff);
      rows.forEach((row) => {
        const schedule = this.connection.prepare("SELECT * FROM content_generation_schedules WHERE workspace_id = ? AND id = ?").get(this.workspaceId, row.schedule_id); const failures = Number(schedule?.consecutive_failures || 0) + 1; const attention = failures >= this.failureThreshold; const retryAt = attention ? null : new Date(new Date(current).valueOf() + RETRY_DELAYS_MS[Math.min(failures - 1, RETRY_DELAYS_MS.length - 1)]).toISOString();
        this.connection.prepare("UPDATE content_generation_schedule_runs SET status = 'failed', error_code = 'CONTENT_SCHEDULE_RUN_INTERRUPTED', error_message = 'Scheduled generation was interrupted and may be retried with the same occurrence key.', completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'running'").run(current, current, this.workspaceId, row.id);
        this.connection.prepare("UPDATE content_generation_schedules SET status = CASE WHEN ? THEN 'attention' ELSE status END, retry_at = ?, consecutive_failures = ?, last_error_code = 'CONTENT_SCHEDULE_RUN_INTERRUPTED', last_error_message = 'Scheduled generation was interrupted.', updated_at = ? WHERE workspace_id = ? AND id = ?").run(attention ? 1 : 0, retryAt, failures, current, this.workspaceId, row.schedule_id);
        recovered += 1;
      });
    });
    return recovered;
  }
}

export default ContentGenerationScheduler;
