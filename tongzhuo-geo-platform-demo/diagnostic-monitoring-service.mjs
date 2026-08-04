import crypto from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";
import { DiagnosticConflictError, DiagnosticError, DiagnosticNotFoundError } from "./diagnostic-store.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const PLAN_STATUSES = new Set(["active", "paused", "attention", "archived"]);
const PLAN_RUN_STATUSES = new Set(["queued", "submitting", "submitted", "running", "completed", "partial", "failed", "attention", "cancelled", "skipped"]);
const ACTIVE_PLAN_RUN_STATUSES = new Set(["queued", "submitting", "submitted", "running"]);
const TERMINAL_PLAN_RUN_STATUSES = new Set(["completed", "partial", "failed", "attention", "cancelled", "skipped"]);
const SCHEDULE_CADENCES = new Set(["daily", "weekly", "monthly", "interval"]);
const MAX_RELAY_ITEMS = 500;
const dateTimeFormatters = new Map();

function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function plainObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function parseJson(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch { return fallback; }
}
function cleanText(value, field, maximum = 500, required = false) {
  const normalized = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !normalized) throw new BrandMonitoringError(`${field} is required.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field });
  if (normalized.length > maximum) throw new BrandMonitoringError(`${field} exceeds ${maximum} characters.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field, maximum });
  return normalized;
}
function jsonText(value, field, maximum = 128_000) {
  let encoded;
  try { encoded = JSON.stringify(value ?? {}); } catch { throw new BrandMonitoringError(`${field} must be JSON serializable.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field }); }
  if (encoded === undefined) throw new BrandMonitoringError(`${field} must be JSON serializable.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field });
  if (Buffer.byteLength(encoded, "utf8") > maximum) throw new BrandMonitoringError(`${field} exceeds ${maximum} bytes.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field, maximum });
  return encoded;
}
function stringArray(value, field, maximum, itemMaximum = 160) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BrandMonitoringError(`${field} must be an array.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field });
  if (value.length > maximum) throw new BrandMonitoringError(`${field} contains too many values.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field, maximum });
  const output = [];
  const seen = new Set();
  for (const item of value) {
    const normalized = cleanText(item, field, itemMaximum, true);
    const key = normalized.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}
function integer(value, field, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER, fallback = undefined } = {}) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BrandMonitoringError(`${field} must be an integer between ${minimum} and ${maximum}.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field, minimum, maximum });
  }
  return parsed;
}
function limitedPositive(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
}
function iso(value, field, fallback = "") {
  const raw = value === undefined || value === null || value === "" ? fallback : value;
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.valueOf())) throw new BrandMonitoringError(`${field} must be an ISO-8601 timestamp.`, 422, "BRAND_MONITORING_INVALID_INPUT", { field });
  return parsed.toISOString();
}
function sha256(value) { return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex"); }
function errorDetails(error) {
  return {
    code: cleanText(error?.code || "BRAND_MONITORING_EXECUTION_FAILED", "error code", 200) || "BRAND_MONITORING_EXECUTION_FAILED",
    message: cleanText(error?.message || "Brand monitoring execution failed.", "error message", 2_000) || "Brand monitoring execution failed.",
    retryable: Boolean(error?.retryable)
  };
}
function safeStatus(value, fallback = "queued") {
  const normalized = String(value || fallback).toLowerCase();
  return PLAN_RUN_STATUSES.has(normalized) ? normalized : fallback;
}
function relayRunStatus(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "pending") return "queued";
  return PLAN_RUN_STATUSES.has(normalized) ? normalized : "running";
}
function lastDayOfUtcMonth(year, month) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }

function normalizeTimeZone(value) {
  const requested = cleanText(value || "Asia/Shanghai", "schedule.timeZone", 120, true);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: requested }).resolvedOptions().timeZone;
  } catch {
    throw new BrandMonitoringError("schedule.timeZone must be a valid IANA time zone.", 422, "BRAND_MONITORING_INVALID_INPUT", { field: "schedule.timeZone", value: requested });
  }
}

function dateTimeFormatter(timeZone) {
  const key = String(timeZone);
  let formatter = dateTimeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: key, calendar: "iso8601", numberingSystem: "latn", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    dateTimeFormatters.set(key, formatter);
  }
  return formatter;
}

function zonedParts(value, timeZone) {
  const parts = dateTimeFormatter(timeZone).formatToParts(new Date(value));
  const output = {};
  for (const part of parts) {
    if (["year", "month", "day", "hour", "minute", "second"].includes(part.type)) output[part.type] = Number(part.value);
  }
  output.millisecond = new Date(value).getUTCMilliseconds();
  return output;
}

function localPartsEpoch(parts) {
  return Date.UTC(parts.year, Number(parts.month) - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond || 0);
}

function zonedDateTimeToInstant(parts, timeZone) {
  const targetEpoch = localPartsEpoch(parts);
  let candidate = targetEpoch;
  // Resolving through formatted local parts preserves local wall-clock time
  // across DST shifts without adding an external date-time dependency.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rendered = zonedParts(candidate, timeZone);
    const difference = targetEpoch - localPartsEpoch(rendered);
    if (difference === 0) return new Date(candidate).toISOString();
    candidate += difference;
  }
  // A skipped DST wall-clock time has no exact instant.  Use the first
  // representable instant after it rather than running before the consented
  // schedule point.
  for (let minutes = 0; minutes <= 180; minutes += 1) {
    const probe = candidate + minutes * 60_000;
    if (localPartsEpoch(zonedParts(probe, timeZone)) >= targetEpoch) return new Date(probe).toISOString();
  }
  throw new BrandMonitoringError("Monitoring schedule could not resolve its local execution time.", 409, "BRAND_MONITORING_SCHEDULE_INVALID");
}

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, Number(parts.month) - 1, parts.day + days, parts.hour, parts.minute, parts.second, parts.millisecond || 0));
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(), millisecond: date.getUTCMilliseconds()
  };
}

function nextScheduleOccurrence(schedule, occurrenceAt) {
  const source = plainObject(schedule);
  const current = new Date(occurrenceAt);
  if (Number.isNaN(current.valueOf())) throw new BrandMonitoringError("Monitoring schedule state is invalid.", 409, "BRAND_MONITORING_SCHEDULE_INVALID");
  const timeZone = normalizeTimeZone(source.timeZone);
  if (source.cadence === "monthly") {
    const anchor = new Date(source.anchorAt);
    if (Number.isNaN(anchor.valueOf())) throw new BrandMonitoringError("Monitoring schedule anchor is invalid.", 409, "BRAND_MONITORING_SCHEDULE_INVALID");
    const currentLocal = zonedParts(current, timeZone);
    const anchorLocal = zonedParts(anchor, timeZone);
    const nextMonth = currentLocal.month;
    const year = currentLocal.year + Math.floor(nextMonth / 12);
    const month = nextMonth % 12;
    const day = Math.min(anchorLocal.day, lastDayOfUtcMonth(year, month));
    return zonedDateTimeToInstant({ year, month: month + 1, day, hour: anchorLocal.hour, minute: anchorLocal.minute, second: anchorLocal.second, millisecond: anchorLocal.millisecond }, timeZone);
  }
  if (source.cadence === "daily" || source.cadence === "weekly") {
    const currentLocal = zonedParts(current, timeZone);
    return zonedDateTimeToInstant(addLocalDays(currentLocal, source.cadence === "daily" ? 1 : 7), timeZone);
  }
  const hours = source.cadence === "daily" ? 24
    : source.cadence === "weekly" ? 24 * 7 : integer(source.intervalHours, "schedule.intervalHours", { minimum: 24, maximum: 24 * 366 });
  return new Date(current.valueOf() + hours * 60 * 60 * 1000).toISOString();
}

function nextFutureScheduleOccurrence(schedule, previousOccurrenceAt, timestamp) {
  const cutoff = new Date(timestamp).valueOf();
  let candidate = nextScheduleOccurrence(schedule, previousOccurrenceAt);
  let guard = 0;
  while (new Date(candidate).valueOf() <= cutoff && guard < 10_000) {
    candidate = nextScheduleOccurrence(schedule, candidate);
    guard += 1;
  }
  if (guard >= 10_000) throw new BrandMonitoringError("Monitoring schedule cannot advance to a future occurrence.", 409, "BRAND_MONITORING_SCHEDULE_INVALID");
  return candidate;
}

function calendarMonthWindow(timestamp, timeZone) {
  const local = zonedParts(timestamp, timeZone);
  const start = zonedDateTimeToInstant({ year: local.year, month: local.month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone);
  const nextMonthIndex = local.month;
  const nextYear = local.year + Math.floor(nextMonthIndex / 12);
  const nextMonth = nextMonthIndex % 12 + 1;
  const end = zonedDateTimeToInstant({ year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone);
  return { start, end };
}

function defaultMaxLatenessHours(cadence, intervalHours = 0) {
  if (cadence === "daily") return 6;
  if (cadence === "weekly") return 24;
  if (cadence === "monthly") return 72;
  return Math.max(6, Math.min(24, Math.floor(Number(intervalHours || 24) / 2)));
}

function normalizeSchedule(input, timestamp) {
  const source = plainObject(input);
  const rawCadence = cleanText(source.cadence || (source.intervalHours ? "interval" : "weekly"), "schedule.cadence", 32, true).toLowerCase();
  if (!SCHEDULE_CADENCES.has(rawCadence)) {
    throw new BrandMonitoringError("schedule.cadence must be daily, weekly, monthly, or interval.", 422, "BRAND_MONITORING_INVALID_INPUT", { field: "schedule.cadence" });
  }
  const startAt = iso(source.startAt || source.firstRunAt || timestamp, "schedule.startAt", timestamp);
  const anchorAt = iso(source.anchorAt || startAt, "schedule.anchorAt", startAt);
  const intervalHours = rawCadence === "interval"
    ? integer(source.intervalHours, "schedule.intervalHours", { minimum: 24, maximum: 24 * 366 })
    : rawCadence === "daily" ? 24 : rawCadence === "weekly" ? 24 * 7 : 0;
  const maxLatenessHours = integer(source.maxLatenessHours, "schedule.maxLatenessHours", {
    minimum: 1,
    maximum: 24 * 31,
    fallback: defaultMaxLatenessHours(rawCadence, intervalHours)
  });
  return { version: "brand-monitoring-schedule-v1", cadence: rawCadence, intervalHours, maxLatenessHours, timeZone: normalizeTimeZone(source.timeZone), anchorAt, startAt };
}

function normalizeAuthorization(input, actor, timestamp) {
  const source = plainObject(input);
  if (source.externalDataConsent !== true) {
    throw new BrandMonitoringError("externalDataConsent must be explicitly true before creating an automated brand-monitoring plan.", 422, "RELAY_CONSENT_REQUIRED");
  }
  const authenticatedActor = cleanText(actorId(actor), "authenticated actor", 240);
  const authorizationReference = cleanText(source.authorizationReference || source.reference, "authorization.authorizationReference", 240, true);
  const authorizedBy = authenticatedActor || cleanText(source.authorizedBy, "authorization.authorizedBy", 240, true);
  const consentedAt = iso(source.consentedAt || timestamp, "authorization.consentedAt", timestamp);
  const method = cleanText(source.method || "authenticated_monitoring_plan", "authorization.method", 120, true);
  const expiresAt = source.expiresAt ? iso(source.expiresAt, "authorization.expiresAt") : null;
  if (expiresAt && new Date(expiresAt).valueOf() <= new Date(consentedAt).valueOf()) {
    throw new BrandMonitoringError("authorization.expiresAt must be later than authorization.consentedAt.", 422, "BRAND_MONITORING_INVALID_INPUT", { field: "authorization.expiresAt" });
  }
  return { externalDataConsent: true, authorizationReference, authorizedBy, consentedAt, method, expiresAt };
}

function quoteEstimate(quote) {
  const value = Number(quote?.estimatedCustomerCredits);
  if (!Number.isInteger(value) || value < 0) {
    throw new BrandMonitoringError("Relay quote does not contain a valid estimatedCustomerCredits value.", 502, "BRAND_MONITORING_QUOTE_INVALID");
  }
  return value;
}

function normalizeRelayItems(value, questionSet) {
  if (!Array.isArray(value) || !value.length) {
    throw new BrandMonitoringError("items must contain the exact question/platform/terminal/mode combinations selected for this plan.", 422, "BRAND_MONITORING_ITEMS_REQUIRED", { field: "items" });
  }
  if (value.length > MAX_RELAY_ITEMS) {
    throw new BrandMonitoringError(`A monitoring plan may contain at most ${MAX_RELAY_ITEMS} relay items.`, 422, "BRAND_MONITORING_ITEM_LIMIT", { maximum: MAX_RELAY_ITEMS });
  }
  const questions = new Map((Array.isArray(questionSet.questions) ? questionSet.questions : []).map((question) => [String(question.id), question]));
  const itemIds = new Set();
  const combinations = new Set();
  return value.map((valueItem, index) => {
    const item = plainObject(valueItem);
    const questionId = cleanText(item.questionId, `items[${index}].questionId`, 180, true);
    const question = questions.get(questionId);
    if (!question) {
      throw new BrandMonitoringError("Every monitoring item must reference a question in the frozen question-set snapshot.", 422, "BRAND_MONITORING_ITEM_QUESTION_INVALID", { index, questionId, questionSetId: questionSet.id });
    }
    const platform = cleanText(item.platform, `items[${index}].platform`, 120, true);
    const terminal = cleanText(item.terminal || "web", `items[${index}].terminal`, 120, true);
    const mode = cleanText(item.mode || "fast", `items[${index}].mode`, 120, true);
    const itemId = cleanText(item.itemId || item.clientItemId || `${questionId}-${platform}-${terminal}-${mode}`, `items[${index}].itemId`, 256, true);
    if (itemIds.has(itemId)) throw new BrandMonitoringError("Monitoring item IDs must be unique.", 422, "BRAND_MONITORING_ITEM_DUPLICATE", { itemId });
    itemIds.add(itemId);
    const combination = `${questionId}\u0000${platform}\u0000${terminal}\u0000${mode}`;
    if (combinations.has(combination)) {
      throw new BrandMonitoringError("A monitoring plan cannot contain the same question/platform/terminal/mode combination twice.", 422, "BRAND_MONITORING_ITEM_DUPLICATE", { questionId, platform, terminal, mode });
    }
    combinations.add(combination);
    // The browser may display a prompt, but it cannot alter the prompt that
    // is charged to the relay: use the immutable frozen question text only.
    return { itemId, questionId, prompt: question.text, platform, terminal, mode, metadata: {} };
  });
}

function itemAuditSummary(items) {
  return items.map((item) => ({ questionId: item.questionId, platform: item.platform, terminal: item.terminal, mode: item.mode }));
}

function optionalFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedLiveEvidence(evidence, requestItems = new Map()) {
  const payload = plainObject(evidence?.payload);
  const delivery = plainObject(payload.delivery);
  const normalized = plainObject(delivery.normalized);
  const provenance = plainObject(evidence?.provenance);
  const request = plainObject(payload.request);
  const itemId = cleanText(delivery.itemId || provenance.itemId || request.itemId || request.clientItemId, "evidence itemId", 256);
  const frozenItem = requestItems.get(itemId) || {};
  const quotes = Array.isArray(normalized.quotes) ? normalized.quotes.slice(0, 100).map((quote) => {
    const source = plainObject(quote);
    const url = cleanText(source.url || source.link, "quote url", 4_000);
    let domain = cleanText(source.domain || source.siteName || source.site_name, "quote domain", 500);
    if (!domain && url) {
      try { domain = new URL(url).hostname; } catch { domain = ""; }
    }
    return {
      title: cleanText(source.title || source.name || source.siteName || domain || url, "quote title", 1_000),
      domain,
      url,
      summary: cleanText(source.summary || source.excerpt, "quote summary", 4_000)
    };
  }).filter((quote) => quote.title || quote.domain || quote.url) : [];
  const brandMentioned = typeof normalized.brandMentioned === "boolean" ? normalized.brandMentioned : null;
  const brandMentionCount = optionalFiniteNumber(normalized.brandMentionCount);
  const firstMentionRank = optionalFiniteNumber(normalized.firstMentionRank ?? normalized.brandRank ?? normalized.rank);
  const sentiment = cleanText(normalized.sentiment || normalized.sentimentLabel, "sentiment", 120);
  return {
    evidenceId: evidence.id,
    diagnosticRunId: evidence.runId,
    itemId: itemId || null,
    questionId: cleanText(provenance.questionId || request.questionId || frozenItem.questionId, "questionId", 180),
    question: cleanText(request.prompt || request.question || frozenItem.prompt, "question", 5_000),
    platform: cleanText(provenance.platform || delivery.upstream?.platform || request.platform || frozenItem.platform || "unknown", "platform", 120),
    terminal: cleanText(provenance.terminal || delivery.upstream?.terminal || request.terminal || frozenItem.terminal || "web", "terminal", 120),
    mode: cleanText(provenance.mode || delivery.upstream?.mode || request.mode || frozenItem.mode || "fast", "mode", 120),
    answer: cleanText(evidence.excerpt || evidence.claim || normalized.answerText || normalized.answer, "answer", 20_000),
    brandMentioned,
    brandMentionCount,
    firstMentionRank: firstMentionRank && firstMentionRank > 0 ? firstMentionRank : null,
    sentiment: sentiment || null,
    quotes,
    citationSources: quotes,
    quoteCount: optionalFiniteNumber(normalized.quoteCount) ?? quotes.length,
    observedAt: evidence.observedAt,
    status: evidence.verificationStatus,
    upstreamReqId: cleanText(provenance.upstreamReqId || delivery.upstream?.reqId, "upstreamReqId", 500) || null
  };
}

export class BrandMonitoringError extends DiagnosticError {
  constructor(message, status = 422, code = "BRAND_MONITORING_ERROR", details = undefined) {
    super(message, status, code, details);
    this.name = "BrandMonitoringError";
  }
}

/**
 * Schedules immutable, relay-backed brand-monitoring snapshots.  It does not
 * scrape the Aidso dashboard and does not have any browser-side credentials:
 * each occurrence goes through DiagnosticRelayService, so the existing HMAC,
 * tenant billing, outbox delivery and live-evidence persistence stay intact.
 */
export class BrandMonitoringService {
  constructor({ database, diagnosticStore, relayService, workspaceId = DEFAULT_WORKSPACE_ID, trustProxy = false, schedulerBatchSize = 12 } = {}) {
    if (!database?.connection) throw new TypeError("BrandMonitoringService requires a ProductionDatabase instance.");
    if (!diagnosticStore || typeof diagnosticStore.project !== "function" || typeof diagnosticStore.questionSet !== "function") {
      throw new TypeError("BrandMonitoringService requires a DiagnosticStore instance.");
    }
    if (!relayService || typeof relayService.quote !== "function" || typeof relayService.createRun !== "function" || typeof relayService.getLinkByDiagnosticRun !== "function") {
      throw new TypeError("BrandMonitoringService requires a DiagnosticRelayService instance.");
    }
    this.database = database;
    this.connection = database.connection;
    this.diagnosticStore = diagnosticStore;
    this.relayService = relayService;
    this.workspaceId = String(workspaceId || DEFAULT_WORKSPACE_ID);
    this.trustProxy = Boolean(trustProxy);
    this.schedulerBatchSize = limitedPositive(schedulerBatchSize, 12, 100);
  }

  _audit(action, entityType, entityId, details = {}, actor = null, request = null, timestamp = now()) {
    appendAuditLog(this.connection, {
      actorUserId: actorId(actor), action, entityType, entityId, details, request, trustProxy: this.trustProxy, createdAt: timestamp
    });
  }

  _planSelect(where = "p.workspace_id = ?") {
    return `
      SELECT p.*, project.name AS project_name, project.target_brand AS project_target_brand,
        project.status AS project_status, questions.version_number AS question_set_version,
        questions.name AS question_set_name, questions.status AS question_set_status,
        questions.checksum AS question_set_checksum,
        COALESCE(json_array_length(questions.questions_json), 0) AS question_count
      FROM diagnostic_monitoring_plans p
      JOIN diagnostic_projects project ON project.id = p.project_id
      JOIN diagnostic_question_sets questions ON questions.id = p.question_set_id
      WHERE ${where}
    `;
  }

  _rawPlan(planId) {
    return this.connection.prepare(`${this._planSelect("p.workspace_id = ? AND p.id = ?")}`).get(this.workspaceId, planId) || null;
  }

  _planOrThrow(planId) {
    const row = this._rawPlan(planId);
    if (!row) throw new DiagnosticNotFoundError("Brand-monitoring plan not found.", { planId });
    return row;
  }

  _rawPlanRun(planRunId) {
    return this.connection.prepare(`
      SELECT r.*, p.name AS plan_name, p.status AS plan_status, p.project_id, p.question_set_id
      FROM diagnostic_monitoring_plan_runs r
      JOIN diagnostic_monitoring_plans p ON p.id = r.plan_id
      WHERE r.workspace_id = ? AND r.id = ?
    `).get(this.workspaceId, planRunId) || null;
  }

  _planRunOrThrow(planRunId) {
    const row = this._rawPlanRun(planRunId);
    if (!row) throw new DiagnosticNotFoundError("Brand-monitoring plan run not found.", { planRunId });
    return row;
  }

  planPayload(row) {
    if (!row) return null;
    const schedule = parseJson(row.schedule_json, {});
    const request = parseJson(row.request_snapshot_json, {});
    const authorization = parseJson(row.authorization_json, {});
    const quote = parseJson(row.last_quote_json, {});
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      status: row.status,
      projectId: row.project_id,
      project: {
        id: row.project_id,
        name: row.project_name || "",
        targetBrand: row.project_target_brand || "",
        status: row.project_status || ""
      },
      questionSetId: row.question_set_id,
      questionSet: {
        id: row.question_set_id,
        version: Number(row.question_set_version || 0),
        name: row.question_set_name || "",
        status: row.question_set_status || "",
        checksum: row.question_set_checksum || request.questionSetChecksum || "",
        questionCount: Number(row.question_count || 0),
        questions: Array.isArray(request.items) ? request.items.map((item) => ({
          id: item.questionId,
          text: item.prompt,
          type: "aidso_brand_monitoring",
          source: "frozen_question_set"
        })).filter((item, index, items) => item.id && item.text && items.findIndex((candidate) => candidate.id === item.id) === index) : []
      },
      schedule,
      request,
      authorization,
      budget: { maxCreditsPerRun: Number(row.max_credits_per_run), maxMonthlyCredits: Number(row.max_monthly_credits || 0) },
      retryPolicy: { maxAttempts: Number(row.max_attempts), failureThreshold: Number(row.failure_threshold) },
      lastQuote: quote,
      lastQuotedAt: row.last_quoted_at || null,
      nextRunAt: row.next_run_at || null,
      lastScheduledAt: row.last_scheduled_at || null,
      lastRunAt: row.last_run_at || null,
      lastSuccessAt: row.last_success_at || null,
      consecutiveFailures: Number(row.consecutive_failures || 0),
      lastErrorCode: row.last_error_code || null,
      lastErrorMessage: row.last_error_message || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by || null,
      updatedBy: row.updated_by || null
    };
  }

  planRunPayload(row) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      planId: row.plan_id,
      planName: row.plan_name || "",
      planStatus: row.plan_status || "",
      projectId: row.project_id || null,
      questionSetId: row.question_set_id || null,
      triggerKind: row.trigger_kind,
      scheduledFor: row.scheduled_for,
      status: row.status,
      diagnosticRunId: row.diagnostic_run_id || null,
      relayLinkId: row.relay_link_id || null,
      clientRunId: row.client_run_id,
      idempotencyKey: row.idempotency_key,
      request: parseJson(row.request_snapshot_json, {}),
      quote: parseJson(row.quote_json, {}),
      estimatedCustomerCredits: row.estimated_customer_credits === null ? null : Number(row.estimated_customer_credits),
      attempts: Number(row.attempts || 0),
      nextAttemptAt: row.next_attempt_at || null,
      errorCode: row.error_code || null,
      errorMessage: row.error_message || null,
      createdAt: row.created_at,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      updatedAt: row.updated_at
    };
  }

  _normalizePlanInput(input = {}, actor = null, timestamp = now()) {
    const source = plainObject(input);
    const projectId = cleanText(source.projectId, "projectId", 180, true);
    const questionSetId = cleanText(source.questionSetId, "questionSetId", 180, true);
    const project = this.diagnosticStore.project(this.workspaceId, projectId);
    const questionSet = this.diagnosticStore.questionSet(this.workspaceId, questionSetId);
    if (questionSet.projectId !== project.id) {
      throw new BrandMonitoringError("The question set must belong to the selected project.", 422, "BRAND_MONITORING_QUESTION_SET_INVALID", { projectId, questionSetId });
    }
    // A plan is created only from the currently frozen version.  It may later
    // continue against that same immutable snapshot after a newer version is
    // frozen (DiagnosticRelayService receives an explicit opt-in for that).
    if (questionSet.status !== "frozen") {
      throw new BrandMonitoringError("Create a monitoring plan from a currently frozen question set.", 422, "BRAND_MONITORING_QUESTION_SET_NOT_FROZEN", { questionSetId, status: questionSet.status });
    }
    if (!Array.isArray(questionSet.questions) || !questionSet.questions.length) {
      throw new BrandMonitoringError("The frozen question set contains no runnable questions.", 422, "BRAND_MONITORING_QUESTION_SET_EMPTY", { questionSetId });
    }
    const requestInput = plainObject(source.request);
    // The UI sends the exact capability items it rendered from the relay
    // snapshot.  Do not manufacture a platform × terminal × mode Cartesian
    // product here: unavailable combinations must never become billable jobs.
    const items = normalizeRelayItems(requestInput.items ?? source.items, questionSet);
    const brandSource = plainObject(requestInput.brand || source.brand);
    const brand = {
      name: cleanText(brandSource.name || project.targetBrand, "brand.name", 300, true),
      aliases: stringArray(brandSource.aliases, "brand.aliases", 20, 120)
    };
    const competitors = stringArray(requestInput.competitors ?? source.competitors, "competitors", 20, 240);
    const analysisScope = {
      ...plainObject(requestInput.analysisScope ?? source.analysisScope),
      source: "effect_monitor",
      feature: "aidso_brand_monitoring",
      aidsoProduct: "monitor"
    };
    jsonText(analysisScope, "analysisScope", 32_000);
    const schedule = normalizeSchedule(source.schedule, timestamp);
    const authorization = normalizeAuthorization(source.authorization || source.consent, actor, timestamp);
    const budget = plainObject(source.budget);
    const maxCreditsPerRun = integer(source.maxCreditsPerRun ?? budget.maxCreditsPerRun, "maxCreditsPerRun", { minimum: 1, maximum: 1_000_000 });
    const maxMonthlyCredits = integer(source.maxMonthlyCredits ?? budget.maxMonthlyCredits, "maxMonthlyCredits", { minimum: 0, maximum: 10_000_000, fallback: 0 });
    const maxAttempts = integer(source.maxAttempts ?? plainObject(source.retryPolicy).maxAttempts, "maxAttempts", { minimum: 1, maximum: 5, fallback: 3 });
    const failureThreshold = integer(source.failureThreshold ?? plainObject(source.retryPolicy).failureThreshold, "failureThreshold", { minimum: 1, maximum: 10, fallback: 3 });
    return {
      project,
      questionSet,
      name: cleanText(source.name || `Brand monitoring · ${brand.name}`, "name", 300, true),
      schedule,
      authorization,
      maxCreditsPerRun,
      maxMonthlyCredits,
      maxAttempts,
      failureThreshold,
      startPaused: source.startPaused === true,
      requestSnapshot: {
        version: "brand-monitoring-plan-request-v1",
        projectId: project.id,
        questionSetId: questionSet.id,
        questionSetChecksum: questionSet.checksum,
        brand,
        competitors,
        analysisScope,
        items,
        itemCount: items.length
      }
    };
  }

  async createPlan(input = {}, { actor = null, request = null } = {}) {
    if (typeof this.relayService.configured === "function" && !this.relayService.configured()) {
      throw new BrandMonitoringError("The relay client is not configured, so a paid brand-monitoring plan cannot be created.", 503, "RELAY_CLIENT_NOT_CONFIGURED");
    }
    const timestamp = now();
    const normalized = this._normalizePlanInput(input, actor, timestamp);
    const quote = await this.relayService.quote({
      projectId: normalized.project.id,
      questionSetId: normalized.questionSet.id,
      items: normalized.requestSnapshot.items
    });
    const estimate = quoteEstimate(quote);
    if (estimate > normalized.maxCreditsPerRun) {
      throw new BrandMonitoringError("The current relay quote exceeds the approved per-run credit cap.", 409, "BRAND_MONITORING_BUDGET_EXCEEDED", {
        estimatedCustomerCredits: estimate,
        maxCreditsPerRun: normalized.maxCreditsPerRun
      });
    }
    if (normalized.maxMonthlyCredits > 0 && estimate > normalized.maxMonthlyCredits) {
      throw new BrandMonitoringError("The current relay quote exceeds the approved monthly credit cap for this plan.", 409, "BRAND_MONITORING_MONTHLY_BUDGET_EXCEEDED", {
        estimatedCustomerCredits: estimate,
        maxMonthlyCredits: normalized.maxMonthlyCredits
      });
    }
    const planId = id("DMP");
    const scheduleJson = jsonText(normalized.schedule, "schedule");
    const requestJson = jsonText(normalized.requestSnapshot, "monitoring request");
    const authorizationJson = jsonText(normalized.authorization, "authorization", 16_000);
    const quoteJson = jsonText(quote, "relay quote");
    const status = normalized.startPaused ? "paused" : "active";
    this.database.transaction(() => {
      this.connection.prepare(`
        INSERT INTO diagnostic_monitoring_plans(
          id, workspace_id, project_id, question_set_id, name, status, schedule_json, request_snapshot_json, authorization_json,
          max_credits_per_run, max_monthly_credits, max_attempts, failure_threshold, last_quote_json, last_quoted_at, next_run_at,
          created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        planId, this.workspaceId, normalized.project.id, normalized.questionSet.id, normalized.name, status,
        scheduleJson, requestJson, authorizationJson, normalized.maxCreditsPerRun, normalized.maxMonthlyCredits, normalized.maxAttempts,
        normalized.failureThreshold, quoteJson, timestamp, normalized.schedule.startAt, timestamp, timestamp, actorId(actor), actorId(actor)
      );
      this._audit("diagnostic.monitoring_plan.create", "diagnostic_monitoring_plan", planId, {
        projectId: normalized.project.id,
        questionSetId: normalized.questionSet.id,
        questionSetChecksum: normalized.questionSet.checksum,
        questionCount: normalized.questionSet.questions.length,
        itemCount: normalized.requestSnapshot.itemCount,
        items: itemAuditSummary(normalized.requestSnapshot.items),
        schedule: normalized.schedule,
        maxCreditsPerRun: normalized.maxCreditsPerRun,
        maxMonthlyCredits: normalized.maxMonthlyCredits,
        estimatedCustomerCredits: estimate,
        authorizationReferenceHash: sha256(normalized.authorization.authorizationReference),
        startsPaused: normalized.startPaused
      }, actor, request, timestamp);
    });
    return this.getPlan(planId);
  }

  getPlan(planId, { includeRuns = false, runLimit = 100 } = {}) {
    const plan = this.planPayload(this._planOrThrow(planId));
    if (includeRuns) plan.runs = this.listPlanRuns(planId, { limit: runLimit });
    return plan;
  }

  listPlans({ projectId = "", status = "", limit = 100 } = {}) {
    const normalizedLimit = limitedPositive(limit, 100, 500);
    const params = [this.workspaceId];
    let where = "p.workspace_id = ?";
    if (projectId) { where += " AND p.project_id = ?"; params.push(cleanText(projectId, "projectId", 180, true)); }
    if (status) {
      const normalizedStatus = cleanText(status, "status", 32, true).toLowerCase();
      if (!PLAN_STATUSES.has(normalizedStatus)) throw new BrandMonitoringError("Invalid monitoring-plan status.", 422, "BRAND_MONITORING_INVALID_INPUT", { field: "status" });
      where += " AND p.status = ?";
      params.push(normalizedStatus);
    }
    params.push(normalizedLimit);
    return this.connection.prepare(`${this._planSelect(where)} ORDER BY p.updated_at DESC LIMIT ?`).all(...params).map((row) => this.planPayload(row));
  }

  listPlanRuns(planId, { limit = 100 } = {}) {
    this._planOrThrow(planId);
    return this.connection.prepare(`
      SELECT r.*, p.name AS plan_name, p.status AS plan_status, p.project_id, p.question_set_id
      FROM diagnostic_monitoring_plan_runs r
      JOIN diagnostic_monitoring_plans p ON p.id = r.plan_id
      WHERE r.workspace_id = ? AND r.plan_id = ?
      ORDER BY r.created_at DESC LIMIT ?
    `).all(this.workspaceId, planId, limitedPositive(limit, 100, 500)).map((row) => this.planRunPayload(row));
  }

  analytics(planId, { rangeDays = 30 } = {}) {
    const plan = this.getPlan(planId, { includeRuns: true, runLimit: 500 });
    const days = integer(rangeDays, "range", { minimum: 1, maximum: 365, fallback: 30 });
    const after = Date.now() - days * 86_400_000;
    const requestItems = new Map((plan.request?.items || []).map((item) => [String(item.itemId || item.clientItemId || ""), item]));
    const planRuns = (plan.runs || []).filter((run) => {
      const observed = new Date(run.scheduledFor || run.createdAt || 0).valueOf();
      return !Number.isNaN(observed) && observed >= after;
    });
    const records = [];
    for (const planRun of planRuns) {
      if (!planRun.diagnosticRunId) continue;
      let run;
      try {
        run = this.diagnosticStore.run(this.workspaceId, planRun.diagnosticRunId, { includeEvidence: true, includeMetrics: false });
      } catch { continue; }
      for (const evidence of run.evidence || []) {
        if (evidence.evidenceType !== "live" || evidence.verificationStatus !== "verified" || !evidence.observedAt) continue;
        if (new Date(evidence.observedAt).valueOf() < after) continue;
        records.push(normalizedLiveEvidence(evidence, requestItems));
      }
    }

    records.sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")));
    const platformMap = new Map();
    const sourceMap = new Map();
    const sentimentMap = new Map();
    for (const record of records) {
      const platformKey = `${record.platform}\u0000${record.terminal}`;
      const platform = platformMap.get(platformKey) || { platform: record.platform, terminal: record.terminal, samples: 0, mentionObservations: 0, mentioned: 0, brandMentionCount: 0, citations: 0, rankValues: [] };
      platform.samples += 1;
      if (record.brandMentioned !== null || record.brandMentionCount !== null) {
        platform.mentionObservations += 1;
        const mentioned = record.brandMentioned === true || Number(record.brandMentionCount || 0) > 0;
        if (mentioned) platform.mentioned += 1;
        platform.brandMentionCount += Math.max(0, Number(record.brandMentionCount || 0));
      }
      platform.citations += Math.max(0, Number(record.quoteCount || record.quotes.length || 0));
      if (record.firstMentionRank !== null) platform.rankValues.push(record.firstMentionRank);
      platformMap.set(platformKey, platform);
      if (record.sentiment) sentimentMap.set(record.sentiment, (sentimentMap.get(record.sentiment) || 0) + 1);
      for (const quote of record.quotes) {
        const sourceKey = quote.url || quote.domain || quote.title;
        const source = sourceMap.get(sourceKey) || { title: quote.title, domain: quote.domain, url: quote.url, citations: 0, records: 0, lastObservedAt: null };
        source.citations += 1;
        source.records += 1;
        if (!source.lastObservedAt || String(record.observedAt) > source.lastObservedAt) source.lastObservedAt = record.observedAt;
        sourceMap.set(sourceKey, source);
      }
    }
    const mentionRank = [...platformMap.values()].map((row) => ({
      platform: row.platform,
      terminal: row.terminal,
      samples: row.samples,
      mentioned: row.mentioned,
      brandMentionCount: row.brandMentionCount,
      mentionRate: row.mentionObservations ? Number((row.mentioned / row.mentionObservations * 100).toFixed(2)) : null,
      averageRank: row.rankValues.length ? Number((row.rankValues.reduce((sum, value) => sum + value, 0) / row.rankValues.length).toFixed(2)) : null,
      citations: row.citations
    })).sort((left, right) => (right.mentionRate ?? -1) - (left.mentionRate ?? -1));
    const sentimentObservations = [...sentimentMap.values()].reduce((sum, count) => sum + count, 0);
    const sentiment = [...sentimentMap.entries()].map(([label, count]) => ({ label, count, rate: sentimentObservations ? Number((count / sentimentObservations * 100).toFixed(2)) : null }));
    const sources = [...sourceMap.values()].sort((left, right) => right.citations - left.citations);
    const requested = planRuns.reduce((sum, run) => sum + Number(run.request?.itemCount || run.request?.items?.length || plan.request?.itemCount || 0), 0);
    const mentionObservations = records.filter((record) => record.brandMentioned !== null || record.brandMentionCount !== null);
    const mentioned = mentionObservations.filter((record) => record.brandMentioned === true || Number(record.brandMentionCount || 0) > 0);
    const rankedMentions = records.filter((record) => record.firstMentionRank !== null);
    const positiveSentimentCount = sentiment.reduce((sum, item) => /正面|积极|positive/i.test(item.label) ? sum + item.count : sum, 0);
    const questions = this.diagnosticStore.questionSet(this.workspaceId, plan.questionSetId).questions || [];
    return {
      overview: {
        requested,
        delivered: records.length,
        verified: records.length,
        dialogCount: records.length,
        mentionDialogCount: mentioned.length,
        coverageRate: requested ? Number((records.length / requested * 100).toFixed(2)) : null,
        mentionRate: mentionObservations.length ? Number((mentioned.length / mentionObservations.length * 100).toFixed(2)) : null,
        brandMentionCount: mentionObservations.length ? mentionObservations.reduce((sum, record) => sum + Math.max(0, Number(record.brandMentionCount || 0)), 0) : null,
        sov: null,
        top1MentionRate: rankedMentions.length ? Number((rankedMentions.filter((record) => record.firstMentionRank === 1).length / rankedMentions.length * 100).toFixed(2)) : null,
        top3MentionRate: rankedMentions.length ? Number((rankedMentions.filter((record) => record.firstMentionRank <= 3).length / rankedMentions.length * 100).toFixed(2)) : null,
        averageMentionRank: rankedMentions.length ? Number((rankedMentions.reduce((sum, record) => sum + record.firstMentionRank, 0) / rankedMentions.length).toFixed(2)) : null,
        brandFavorability: sentimentObservations ? Number((positiveSentimentCount / sentimentObservations * 100).toFixed(2)) : null,
        citations: records.reduce((sum, record) => sum + Math.max(0, Number(record.quoteCount || 0)), 0),
        citationArticleCount: sources.filter((source) => source.url).length,
        sourceCount: sources.length,
        runCount: planRuns.length,
        lastObservedAt: records[0]?.observedAt || null
      },
      mentionRank,
      sentiment,
      sources,
      dialogs: records,
      works: sources.map((source) => ({ ...source, workType: source.url ? "网页作品" : "来源记录" })),
      settings: {
        planId: plan.id,
        status: plan.status,
        schedule: plan.schedule,
        nextRunAt: plan.nextRunAt,
        authorizationReference: plan.authorization?.authorizationReference || null,
        authorizationExpiresAt: plan.authorization?.expiresAt || null,
        maxCreditsPerRun: plan.budget?.maxCreditsPerRun ?? null,
        maxMonthlyCredits: plan.budget?.maxMonthlyCredits ?? null,
        itemCount: plan.request?.itemCount ?? null
      },
      questionBank: questions,
      source: "diagnostic_evidence(live)",
      evidenceBoundary: "evidenceType=live AND verificationStatus=verified AND observedAt within range",
      rangeDays: days
    };
  }

  _insertPlanRun(plan, { triggerKind, scheduledFor, timestamp, actor = null, request = null, status = "queued", errorCode = null, errorMessage = null } = {}) {
    const normalizedStatus = safeStatus(status);
    const planRunId = id("DMPR");
    const dueAt = iso(scheduledFor || timestamp, "scheduledFor", timestamp);
    const clientRunId = `monitor-${plan.id}-${planRunId}`;
    const idempotencyKey = `monitoring:${plan.id}:${planRunId}`;
    const requestSnapshot = parseJson(plan.request_snapshot_json, {});
    this.connection.prepare(`
      INSERT INTO diagnostic_monitoring_plan_runs(
        id, plan_id, workspace_id, trigger_kind, scheduled_for, status, client_run_id, idempotency_key,
        request_snapshot_json, quote_json, error_code, error_message, created_at, completed_at, updated_at, next_attempt_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
    `).run(
      planRunId, plan.id, this.workspaceId, triggerKind, dueAt, normalizedStatus, clientRunId, idempotencyKey,
      jsonText(requestSnapshot, "monitoring request"), errorCode || null, errorMessage || null, timestamp,
      TERMINAL_PLAN_RUN_STATUSES.has(normalizedStatus) ? timestamp : null, timestamp,
      normalizedStatus === "queued" ? timestamp : null
    );
    this._audit(`diagnostic.monitoring_plan_run.${triggerKind}`, "diagnostic_monitoring_plan_run", planRunId, {
      planId: plan.id,
      scheduledFor: dueAt,
      status: normalizedStatus,
      questionSetId: plan.question_set_id,
      questionSetChecksum: requestSnapshot.questionSetChecksum || ""
    }, actor, request, timestamp);
    return planRunId;
  }

  _nextRunAt(plan, timestamp) {
    const schedule = parseJson(plan.schedule_json, {});
    return nextFutureScheduleOccurrence(schedule, plan.next_run_at || timestamp, timestamp);
  }

  _hasInFlightRun(planId) {
    const placeholders = [...ACTIVE_PLAN_RUN_STATUSES].map(() => "?").join(", ");
    const row = this.connection.prepare(`
      SELECT id FROM diagnostic_monitoring_plan_runs
      WHERE plan_id = ? AND status IN (${placeholders}) LIMIT 1
    `).get(planId, ...ACTIVE_PLAN_RUN_STATUSES);
    return row || null;
  }

  _claimDuePlans({ limit = this.schedulerBatchSize, timestamp = now() } = {}) {
    const normalizedLimit = limitedPositive(limit, this.schedulerBatchSize, 100);
    const claimed = [];
    const skipped = [];
    this.database.transaction(() => {
      const plans = this.connection.prepare(`${this._planSelect("p.workspace_id = ? AND p.status = 'active' AND p.next_run_at IS NOT NULL AND p.next_run_at <= ?")} ORDER BY p.next_run_at ASC LIMIT ?`).all(this.workspaceId, timestamp, normalizedLimit);
      for (const plan of plans) {
        const scheduledFor = plan.next_run_at;
        const nextRunAt = this._nextRunAt(plan, timestamp);
        const schedule = parseJson(plan.schedule_json, {});
        const maxLatenessHours = integer(schedule.maxLatenessHours, "schedule.maxLatenessHours", {
          minimum: 1,
          maximum: 24 * 31,
          fallback: defaultMaxLatenessHours(schedule.cadence, schedule.intervalHours)
        });
        const stale = new Date(timestamp).valueOf() - new Date(scheduledFor).valueOf() > maxLatenessHours * 60 * 60 * 1_000;
        if (stale) {
          const skippedId = this._insertPlanRun(plan, {
            triggerKind: "scheduled", scheduledFor, timestamp, status: "skipped",
            errorCode: "BRAND_MONITORING_SCHEDULE_MISSED",
            errorMessage: "The customer server resumed after this scheduled occurrence's allowed lateness window."
          });
          this.connection.prepare(`
            UPDATE diagnostic_monitoring_plans
            SET next_run_at = ?, last_scheduled_at = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ?
          `).run(nextRunAt, scheduledFor, timestamp, plan.id, this.workspaceId);
          skipped.push(skippedId);
          continue;
        }
        const inFlight = this._hasInFlightRun(plan.id);
        if (inFlight) {
          // Never stack billed runs for the same plan.  Retain a skipped
          // occurrence so a trend gap is visible rather than silently filled.
          const skippedId = this._insertPlanRun(plan, {
            triggerKind: "scheduled", scheduledFor, timestamp, status: "skipped",
            errorCode: "BRAND_MONITORING_OVERLAP_SKIPPED",
            errorMessage: "The scheduled occurrence was skipped because an earlier plan run was still in progress."
          });
          this.connection.prepare(`
            UPDATE diagnostic_monitoring_plans
            SET next_run_at = ?, last_scheduled_at = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ?
          `).run(nextRunAt, scheduledFor, timestamp, plan.id, this.workspaceId);
          skipped.push(skippedId);
          continue;
        }
        const planRunId = this._insertPlanRun(plan, { triggerKind: "scheduled", scheduledFor, timestamp });
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plans
          SET next_run_at = ?, last_scheduled_at = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(nextRunAt, scheduledFor, timestamp, plan.id, this.workspaceId);
        claimed.push(planRunId);
      }
    });
    return { claimed, skipped };
  }

  _queuedPlanRuns({ limit = this.schedulerBatchSize, timestamp = now() } = {}) {
    return this.connection.prepare(`
      SELECT r.id
      FROM diagnostic_monitoring_plan_runs r
      JOIN diagnostic_monitoring_plans p ON p.id = r.plan_id
      WHERE r.workspace_id = ? AND p.status = 'active' AND r.status = 'queued'
        AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= ?)
      ORDER BY r.created_at ASC LIMIT ?
    `).all(this.workspaceId, timestamp, limitedPositive(limit, this.schedulerBatchSize, 100)).map((row) => row.id);
  }

  _retryAt(attempts, timestamp) {
    const seconds = [30, 120, 600, 1_800, 3_600][Math.max(0, Math.min(4, Number(attempts || 1) - 1))];
    return new Date(new Date(timestamp).valueOf() + seconds * 1_000).toISOString();
  }

  _monthlyCommittedCredits(plan, timestamp) {
    const cap = Number(plan.max_monthly_credits || 0);
    const schedule = parseJson(plan.schedule_json, {});
    const timeZone = normalizeTimeZone(schedule.timeZone);
    const window = calendarMonthWindow(timestamp, timeZone);
    const committed = Number(this.connection.prepare(`
      SELECT COALESCE(SUM(estimated_customer_credits), 0) AS total
      FROM diagnostic_monitoring_plan_runs
      WHERE plan_id = ? AND workspace_id = ? AND diagnostic_run_id IS NOT NULL
        AND estimated_customer_credits IS NOT NULL
        AND created_at >= ? AND created_at < ?
    `).get(plan.id, this.workspaceId, window.start, window.end)?.total || 0);
    return { cap, committed, available: cap > 0 ? Math.max(0, cap - committed) : null, window };
  }

  _updateLastQuote(planId, quote, timestamp) {
    this.connection.prepare(`
      UPDATE diagnostic_monitoring_plans
      SET last_quote_json = ?, last_quoted_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `).run(jsonText(quote, "relay quote"), timestamp, timestamp, planId, this.workspaceId);
  }

  _markSubmissionFailure(planRunId, error, timestamp, actor = null, request = null) {
    const current = this._planRunOrThrow(planRunId);
    const plan = this._planOrThrow(current.plan_id);
    const details = errorDetails(error);
    // DiagnosticRelayService creates its local idempotent link before the
    // signed central call.  Retain that link even when the central call is
    // rejected or times out, so the monitoring history never loses the local
    // failure/retry trail.
    const relayLink = typeof this.relayService.getLinkByIdempotency === "function"
      ? this.relayService.getLinkByIdempotency(current.idempotency_key)
      : null;
    const diagnosticRunId = relayLink?.diagnosticRunId || null;
    const relayLinkId = relayLink?.id || null;
    const canRetry = details.retryable && Number(current.attempts) < Number(plan.max_attempts) && plan.status === "active";
    this.database.transaction(() => {
      if (canRetry) {
        const retryAt = this._retryAt(current.attempts, timestamp);
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plan_runs
          SET status = 'queued', diagnostic_run_id = COALESCE(diagnostic_run_id, ?), relay_link_id = COALESCE(relay_link_id, ?),
              next_attempt_at = ?, error_code = ?, error_message = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(diagnosticRunId, relayLinkId, retryAt, details.code, details.message, timestamp, current.id, this.workspaceId);
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plans
          SET last_error_code = ?, last_error_message = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(details.code, details.message, timestamp, plan.id, this.workspaceId);
      } else {
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plan_runs
          SET status = 'attention', diagnostic_run_id = COALESCE(diagnostic_run_id, ?), relay_link_id = COALESCE(relay_link_id, ?),
              next_attempt_at = NULL, error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(diagnosticRunId, relayLinkId, details.code, details.message, timestamp, timestamp, current.id, this.workspaceId);
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plans
          SET status = CASE WHEN status = 'archived' THEN status ELSE 'attention' END,
              last_error_code = ?, last_error_message = ?, consecutive_failures = consecutive_failures + 1,
              last_run_at = ?, updated_at = ?, updated_by = ?
          WHERE id = ? AND workspace_id = ?
        `).run(details.code, details.message, timestamp, timestamp, actorId(actor), plan.id, this.workspaceId);
      }
      this._audit("diagnostic.monitoring_plan_run.submission_failed", "diagnostic_monitoring_plan_run", current.id, {
        planId: plan.id,
        attempts: Number(current.attempts),
        retryable: details.retryable,
        willRetry: canRetry,
        code: details.code
      }, actor, request, timestamp);
    });
    return this.getPlanRun(planRunId);
  }

  _markTerminal(planRunId, status, { errorCode = null, errorMessage = null, timestamp = now(), actor = null, request = null } = {}) {
    const normalizedStatus = safeStatus(status);
    if (!TERMINAL_PLAN_RUN_STATUSES.has(normalizedStatus)) throw new BrandMonitoringError("A monitoring plan run can only be finalized with a terminal status.", 409, "BRAND_MONITORING_STATUS_INVALID");
    const current = this._planRunOrThrow(planRunId);
    if (TERMINAL_PLAN_RUN_STATUSES.has(current.status)) return this.getPlanRun(planRunId);
    const plan = this._planOrThrow(current.plan_id);
    const successful = normalizedStatus === "completed" || normalizedStatus === "partial";
    const requiresAttention = normalizedStatus === "attention";
    const nextFailures = successful ? 0 : Number(plan.consecutive_failures || 0) + (normalizedStatus === "failed" ? 1 : 0);
    const nextPlanStatus = plan.status === "archived" || plan.status === "paused" ? plan.status
      : requiresAttention || (normalizedStatus === "failed" && nextFailures >= Number(plan.failure_threshold)) ? "attention"
        : plan.status;
    this.database.transaction(() => {
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plan_runs
        SET status = ?, next_attempt_at = NULL, error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND workspace_id = ?
      `).run(normalizedStatus, errorCode || null, errorMessage || null, timestamp, timestamp, current.id, this.workspaceId);
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plans
        SET status = ?, last_run_at = ?, last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
            consecutive_failures = ?, last_error_code = ?, last_error_message = ?, updated_at = ?, updated_by = ?
        WHERE id = ? AND workspace_id = ?
      `).run(
        nextPlanStatus, timestamp, successful ? 1 : 0, timestamp, nextFailures,
        successful ? null : errorCode || null, successful ? null : errorMessage || null,
        timestamp, actorId(actor), plan.id, this.workspaceId
      );
      this._audit("diagnostic.monitoring_plan_run.finalize", "diagnostic_monitoring_plan_run", current.id, {
        planId: plan.id,
        status: normalizedStatus,
        errorCode: errorCode || null,
        nextPlanStatus
      }, actor, request, timestamp);
    });
    return this.getPlanRun(planRunId);
  }

  async executePlanRun(planRunId, { actor = null, request = null } = {}) {
    let initial = this._planRunOrThrow(planRunId);
    if (TERMINAL_PLAN_RUN_STATUSES.has(initial.status)) return this.getPlanRun(planRunId);
    let plan = this._planOrThrow(initial.plan_id);
    const timestamp = now();
    if (plan.status !== "active") {
      if (!initial.diagnostic_run_id && ["queued", "submitting"].includes(initial.status)) {
        this._markTerminal(initial.id, "cancelled", { errorCode: "BRAND_MONITORING_PLAN_NOT_ACTIVE", errorMessage: "The monitoring plan was not active before relay submission.", timestamp, actor, request });
      }
      return this.getPlanRun(initial.id);
    }
    if (initial.status !== "queued") return this.getPlanRun(initial.id);
    if (initial.next_attempt_at && new Date(initial.next_attempt_at).valueOf() > new Date(timestamp).valueOf()) return this.getPlanRun(initial.id);
    let claimed = false;
    this.database.transaction(() => {
      const current = this._rawPlanRun(initial.id);
      if (!current || current.status !== "queued") return;
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plan_runs
        SET status = 'submitting', attempts = attempts + 1, next_attempt_at = NULL,
            started_at = COALESCE(started_at, ?), updated_at = ?
        WHERE id = ? AND workspace_id = ?
      `).run(timestamp, timestamp, initial.id, this.workspaceId);
      claimed = true;
    });
    if (!claimed) return this.getPlanRun(initial.id);

    initial = this._planRunOrThrow(initial.id);
    plan = this._planOrThrow(initial.plan_id);
    const requestSnapshot = parseJson(initial.request_snapshot_json, {});
    const authorization = parseJson(plan.authorization_json, {});
    try {
      if (authorization.externalDataConsent !== true || !authorization.authorizationReference) {
        throw new BrandMonitoringError("The monitoring plan has no valid stored execution authorization.", 409, "BRAND_MONITORING_AUTHORIZATION_INVALID");
      }
      if (authorization.expiresAt && new Date(authorization.expiresAt).valueOf() <= new Date(timestamp).valueOf()) {
        throw new BrandMonitoringError("The monitoring plan authorization has expired and requires a new user confirmation.", 409, "BRAND_MONITORING_AUTHORIZATION_EXPIRED");
      }
      const quote = await this.relayService.quote({
        projectId: requestSnapshot.projectId,
        questionSetId: requestSnapshot.questionSetId,
        items: requestSnapshot.items,
        allowSupersededQuestionSet: true
      });
      const estimate = quoteEstimate(quote);
      if (estimate > Number(plan.max_credits_per_run)) {
        throw new BrandMonitoringError("The latest relay quote exceeds this plan's approved per-run credit cap.", 409, "BRAND_MONITORING_BUDGET_EXCEEDED", {
          estimatedCustomerCredits: estimate,
          maxCreditsPerRun: Number(plan.max_credits_per_run)
        });
      }
      const monthlyBudget = this._monthlyCommittedCredits(plan, timestamp);
      if (monthlyBudget.cap > 0 && monthlyBudget.committed + estimate > monthlyBudget.cap) {
        throw new BrandMonitoringError("The latest relay quote would exceed this plan's approved monthly credit cap.", 409, "BRAND_MONITORING_MONTHLY_BUDGET_EXCEEDED", {
          estimatedCustomerCredits: estimate,
          committedCustomerCredits: monthlyBudget.committed,
          maxMonthlyCredits: monthlyBudget.cap,
          budgetWindow: monthlyBudget.window
        });
      }
      this._updateLastQuote(plan.id, quote, timestamp);
      // Pause can race with a slow quote.  Do not create a new paid relay run
      // after the pause has been persisted; existing submitted jobs are never
      // silently cancelled because the relay may already have billed them.
      plan = this._planOrThrow(plan.id);
      if (plan.status !== "active") {
        return this._markTerminal(initial.id, "cancelled", {
          errorCode: "BRAND_MONITORING_PLAN_PAUSED", errorMessage: "The plan was paused before relay submission.", timestamp, actor, request
        });
      }
      const created = await this.relayService.createRun({
        projectId: requestSnapshot.projectId,
        questionSetId: requestSnapshot.questionSetId,
        items: requestSnapshot.items,
        brand: plainObject(requestSnapshot.brand),
        competitors: Array.isArray(requestSnapshot.competitors) ? requestSnapshot.competitors : [],
        analysisScope: {
          ...plainObject(requestSnapshot.analysisScope),
          feature: "aidso_brand_monitoring",
          aidsoProduct: "monitor",
          source: "effect_monitor"
        },
        requestMetadata: {
          feature: "aidso_brand_monitoring",
          aidsoProduct: "monitor",
          source: "effect_monitor",
          monitoringPlan: {
            planId: plan.id,
            planRunId: initial.id,
            triggerKind: initial.trigger_kind,
            scheduledFor: initial.scheduled_for,
            questionSetChecksum: requestSnapshot.questionSetChecksum || "",
            authorizationReferenceHash: sha256(authorization.authorizationReference)
          }
        },
        consent: {
          externalDataConsent: true,
          consentedAt: authorization.consentedAt,
          method: authorization.method || "authenticated_monitoring_plan"
        },
        clientRunId: initial.client_run_id,
        idempotencyKey: initial.idempotency_key,
        maxCustomerCredits: Number(plan.max_credits_per_run),
        allowSupersededQuestionSet: true,
        actor,
        request
      });
      const nextStatus = relayRunStatus(created?.link?.status || created?.run?.status || "submitted");
      this.database.transaction(() => {
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plan_runs
          SET status = ?, diagnostic_run_id = ?, relay_link_id = ?, quote_json = ?, estimated_customer_credits = ?,
              error_code = NULL, error_message = NULL, next_attempt_at = NULL, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(
          nextStatus, created?.run?.id || created?.link?.diagnosticRunId || null, created?.link?.id || null,
          jsonText(quote, "relay quote"), estimate, timestamp, initial.id, this.workspaceId
        );
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plans
          SET last_run_at = ?, last_error_code = NULL, last_error_message = NULL, updated_at = ?, updated_by = ?
          WHERE id = ? AND workspace_id = ?
        `).run(timestamp, timestamp, actorId(actor), plan.id, this.workspaceId);
        this._audit("diagnostic.monitoring_plan_run.submit", "diagnostic_monitoring_plan_run", initial.id, {
          planId: plan.id,
          diagnosticRunId: created?.run?.id || created?.link?.diagnosticRunId || null,
          relayRunId: created?.link?.relayRunId || null,
          estimatedCustomerCredits: estimate,
          quoteItemCount: Array.isArray(quote?.priceSnapshot) ? quote.priceSnapshot.length : null
        }, actor, request, timestamp);
      });
      if (TERMINAL_PLAN_RUN_STATUSES.has(nextStatus)) {
        return this._markTerminal(initial.id, nextStatus, { timestamp, actor, request });
      }
      return this.getPlanRun(initial.id);
    } catch (error) {
      return this._markSubmissionFailure(initial.id, error, timestamp, actor, request);
    }
  }

  getPlanRun(planRunId) { return this.planRunPayload(this._planRunOrThrow(planRunId)); }

  async reconcile({ limit = this.schedulerBatchSize, actor = null, request = null } = {}) {
    const rows = this.connection.prepare(`
      SELECT r.id
      FROM diagnostic_monitoring_plan_runs r
      JOIN diagnostic_monitoring_plans p ON p.id = r.plan_id
      WHERE r.workspace_id = ? AND r.diagnostic_run_id IS NOT NULL
        AND r.status IN ('queued', 'submitted', 'running')
      ORDER BY r.updated_at ASC LIMIT ?
    `).all(this.workspaceId, limitedPositive(limit, this.schedulerBatchSize * 4, 500));
    const result = { checked: 0, updated: 0, finalized: 0 };
    for (const row of rows) {
      result.checked += 1;
      const planRun = this._planRunOrThrow(row.id);
      const link = this.relayService.getLinkByDiagnosticRun(planRun.diagnostic_run_id);
      if (!link) {
        this._markTerminal(planRun.id, "attention", {
          errorCode: "BRAND_MONITORING_RELAY_LINK_MISSING",
          errorMessage: "The local diagnostic run has no matching relay link.", actor, request
        });
        result.finalized += 1;
        continue;
      }
      const nextStatus = relayRunStatus(link.status);
      if (TERMINAL_PLAN_RUN_STATUSES.has(nextStatus)) {
        this._markTerminal(planRun.id, nextStatus, {
          errorCode: link.errorCode || null,
          errorMessage: link.errorMessage || null,
          actor,
          request
        });
        result.finalized += 1;
        continue;
      }
      if (nextStatus !== planRun.status) {
        this.connection.prepare(`
          UPDATE diagnostic_monitoring_plan_runs
          SET status = ?, next_attempt_at = CASE WHEN ? = 'queued' THEN ? ELSE NULL END, updated_at = ?
          WHERE id = ? AND workspace_id = ?
        `).run(nextStatus, nextStatus, now(), now(), planRun.id, this.workspaceId);
        result.updated += 1;
      }
    }
    return result;
  }

  async processDue({ limit = this.schedulerBatchSize } = {}) {
    const timestamp = now();
    const reconciled = await this.reconcile({ limit: Math.max(1, Math.min(500, Number(limit) || this.schedulerBatchSize)) });
    const claimed = this._claimDuePlans({ limit, timestamp });
    const queued = this._queuedPlanRuns({ limit: Math.max(1, Math.min(100, Number(limit) || this.schedulerBatchSize)), timestamp });
    const runIds = [...new Set([...claimed.claimed, ...queued])];
    const executions = [];
    for (const planRunId of runIds) executions.push(await this.executePlanRun(planRunId));
    return {
      reconciled,
      claimed: claimed.claimed.length,
      skipped: claimed.skipped.length,
      executed: executions.length,
      runs: executions
    };
  }

  async triggerPlan(planId, input = {}, { actor = null, request = null } = {}) {
    const source = plainObject(input);
    if (source.confirmExternalExecution !== true) {
      throw new BrandMonitoringError("confirmExternalExecution must be explicitly true before starting a manual monitoring occurrence.", 422, "RELAY_CONSENT_REQUIRED");
    }
    const timestamp = now();
    let planRunId;
    this.database.transaction(() => {
      const plan = this._planOrThrow(planId);
      if (plan.status !== "active") throw new BrandMonitoringError("Resume the monitoring plan before starting a manual occurrence.", 409, "BRAND_MONITORING_PLAN_NOT_ACTIVE", { planId, status: plan.status });
      const inFlight = this._hasInFlightRun(plan.id);
      if (inFlight) throw new DiagnosticConflictError("This monitoring plan already has an in-flight occurrence.", { planId, planRunId: inFlight.id });
      planRunId = this._insertPlanRun(plan, { triggerKind: "manual", scheduledFor: timestamp, timestamp, actor, request });
    });
    return this.executePlanRun(planRunId, { actor, request });
  }

  pausePlan(planId, { actor = null, request = null } = {}) {
    const timestamp = now();
    this.database.transaction(() => {
      const plan = this._planOrThrow(planId);
      if (plan.status === "archived") throw new BrandMonitoringError("An archived monitoring plan cannot be paused.", 409, "BRAND_MONITORING_PLAN_ARCHIVED", { planId });
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plans
        SET status = 'paused', updated_at = ?, updated_by = ?
        WHERE id = ? AND workspace_id = ?
      `).run(timestamp, actorId(actor), plan.id, this.workspaceId);
      // Only non-submitted occurrences are cancelled.  A submitted relay run
      // can already have a held balance and must be cancelled explicitly via
      // its normal task-centre action if the operator wants that outcome.
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plan_runs
        SET status = 'cancelled', error_code = 'BRAND_MONITORING_PLAN_PAUSED',
            error_message = 'The monitoring plan was paused before relay submission.', completed_at = ?, updated_at = ?
        WHERE plan_id = ? AND workspace_id = ? AND status = 'queued' AND diagnostic_run_id IS NULL
      `).run(timestamp, timestamp, plan.id, this.workspaceId);
      this._audit("diagnostic.monitoring_plan.pause", "diagnostic_monitoring_plan", plan.id, { planId: plan.id }, actor, request, timestamp);
    });
    return this.getPlan(planId);
  }

  resumePlan(planId, input = {}, { actor = null, request = null } = {}) {
    if (plainObject(input).confirmExternalExecution !== true) {
      throw new BrandMonitoringError("confirmExternalExecution must be explicitly true before resuming automated monitoring.", 422, "RELAY_CONSENT_REQUIRED");
    }
    const timestamp = now();
    this.database.transaction(() => {
      const plan = this._planOrThrow(planId);
      if (plan.status === "archived") throw new BrandMonitoringError("An archived monitoring plan cannot be resumed.", 409, "BRAND_MONITORING_PLAN_ARCHIVED", { planId });
      const previousNext = plan.next_run_at && new Date(plan.next_run_at).valueOf() > new Date(timestamp).valueOf() ? plan.next_run_at : timestamp;
      this.connection.prepare(`
        UPDATE diagnostic_monitoring_plans
        SET status = 'active', next_run_at = ?, last_error_code = NULL, last_error_message = NULL,
            updated_at = ?, updated_by = ?
        WHERE id = ? AND workspace_id = ?
      `).run(previousNext, timestamp, actorId(actor), plan.id, this.workspaceId);
      this._audit("diagnostic.monitoring_plan.resume", "diagnostic_monitoring_plan", plan.id, {
        planId: plan.id,
        nextRunAt: previousNext,
        authorizationReferenceHash: sha256(parseJson(plan.authorization_json, {}).authorizationReference)
      }, actor, request, timestamp);
    });
    return this.getPlan(planId);
  }
}

export default BrandMonitoringService;
