import crypto from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";
import { publicCitationMarkersVisible } from "./citation-visibility.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const MAX_TITLE = 300;
const MAX_TEXT = 8_000_000;
const MAX_EXCERPT = 2_000;
const VERSION_STATES = new Set(["draft", "pending", "changes_requested", "approved", "superseded"]);
const REVIEW_ACTIONS = new Set(["submitted", "changes_requested", "approved", "commented"]);
const RISK_STATES = new Set(["queued", "running", "passed", "warning", "blocked", "failed"]);

export class ContentError extends Error {
  constructor(message, status = 422, code = "CONTENT_ERROR", details = undefined) {
    super(message);
    this.name = "ContentError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ContentNotFoundError extends ContentError {
  constructor(message = "Content record not found.", details) { super(message, 404, "CONTENT_NOT_FOUND", details); }
}

export class ContentConflictError extends ContentError {
  constructor(message = "The content was changed by another user.", details) { super(message, 409, "CONTENT_REVISION_CONFLICT", details); }
}

export class ContentStateError extends ContentError {
  constructor(message = "The content is not in a valid state for this operation.", code = "CONTENT_INVALID_STATE", details) { super(message, 422, code, details); }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }

function stringValue(value, field, max, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new ContentError(`${field} is required.`, 422, "CONTENT_INVALID_INPUT", { field });
  if (result.length > max) throw new ContentError(`${field} exceeds ${max} characters.`, 422, "CONTENT_INVALID_INPUT", { field, max });
  return result;
}

function jsonValue(value, fallback = {}) {
  if (value === undefined || value === null) return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch { return fallback; }
}

function jsonText(value, fallback = {}) { return JSON.stringify(jsonValue(value, fallback)); }
function contentTextFromHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeContent({ contentHtml = "", contentText = "" } = {}) {
  const html = stringValue(contentHtml, "contentHtml", MAX_TEXT);
  const text = stringValue(contentText || contentTextFromHtml(html), "contentText", MAX_TEXT, true);
  if (!html && !text) throw new ContentError("Article content is required.", 422, "CONTENT_BODY_REQUIRED");
  return { html, text, hash: crypto.createHash("sha256").update(JSON.stringify({ html, text }), "utf8").digest("hex") };
}

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) return [];
  const seenMarkers = new Set();
  return evidence.slice(0, 500).map((item, ordinal) => {
    const marker = stringValue(item?.marker || `K${ordinal + 1}`, "evidence marker", 50, true);
    if (seenMarkers.has(marker)) throw new ContentError(`Duplicate evidence marker: ${marker}.`, 422, "CONTENT_EVIDENCE_DUPLICATE");
    seenMarkers.add(marker);
    const supportStatus = ["supported", "partial", "unsupported", "conflict"].includes(item?.supportStatus) ? item.supportStatus : "supported";
    return {
      id: stringValue(item?.id || id("CE"), "evidence id", 180, true),
      ordinal,
      marker,
      knowledgeLibraryId: stringValue(item?.knowledgeLibraryId || item?.libraryId, "knowledgeLibraryId", 180),
      knowledgeDocumentId: stringValue(item?.knowledgeDocumentId || item?.documentId || item?.itemId, "knowledgeDocumentId", 180),
      knowledgeVersionId: stringValue(item?.knowledgeVersionId || item?.versionId, "knowledgeVersionId", 180),
      knowledgeChunkId: stringValue(item?.knowledgeChunkId || item?.chunkId, "knowledgeChunkId", 180),
      claim: stringValue(item?.claim, "evidence claim", 2_000),
      quote: stringValue(item?.quote, "evidence quote", 10_000),
      supportStatus,
      metadataJson: jsonText(item?.metadata, {})
    };
  });
}

function finiteInteger(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function checkRevision(expectedRevision, actual, articleId) {
  const expected = finiteInteger(expectedRevision);
  if (expected === null) throw new ContentConflictError("expectedRevision is required for a write operation.", { articleId, actualRevision: actual });
  if (expected !== Number(actual)) throw new ContentConflictError("The article revision is stale; reload before saving.", { articleId, expectedRevision: expected, actualRevision: Number(actual) });
  return expected;
}

function allowedStatus(status, values, field) {
  const normalized = String(status || "").trim();
  if (!values.has(normalized)) throw new ContentError(`Invalid ${field}.`, 422, "CONTENT_INVALID_INPUT", { field, value: status });
  return normalized;
}

export class ContentStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("ContentStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.requireEvidence = options.requireEvidence !== false;
    this.evidenceValidator = typeof options.evidenceValidator === "function" ? options.evidenceValidator : null;
  }

  validateEvidenceReferences(evidence, context = {}) {
    if (!this.evidenceValidator) return { valid: true, count: Array.isArray(evidence) ? evidence.length : 0, items: evidence || [] };
    return this.evidenceValidator(evidence, { workspaceId: context.workspaceId || this.workspaceId, allowInternal: false, ...context });
  }

  articleRow(row, options = {}) {
    if (!row) return null;
    const result = {
      id: row.id,
      workspaceId: row.workspace_id,
      taskId: row.task_id || null,
      planId: row.plan_id || null,
      topicId: row.topic_id || null,
      businessLineId: row.business_line_id || null,
      title: row.title,
      category: row.category,
      status: row.status,
      currentVersionId: row.current_version_id || null,
      approvedVersionId: row.approved_version_id || null,
      revision: Number(row.revision || 1),
      metadata: jsonValue(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by || null,
      updatedBy: row.updated_by || null
    };
    if (options.includeVersion && result.currentVersionId) {
      try { result.currentVersion = this.version(result.workspaceId, result.currentVersionId, { includeEvidence: options.includeEvidence !== false }); } catch { result.currentVersion = null; }
    }
    return result;
  }

  versionRow(row, options = {}) {
    if (!row) return null;
    const result = {
      id: row.id,
      articleId: row.article_id,
      version: Number(row.version_number),
      basedOnVersionId: row.based_on_version_id || null,
      title: row.title,
      contentHtml: options.includeContent === false ? undefined : row.content_html,
      contentText: options.includeContent === false ? undefined : row.content_text,
      excerpt: row.excerpt,
      contentHash: row.content_hash,
      source: row.source,
      generationJobId: row.generation_job_id || null,
      reviewStatus: row.review_status,
      riskStatus: row.risk_status,
      metadata: jsonValue(row.metadata_json, {}),
      frozenAt: row.frozen_at || null,
      frozenBy: row.frozen_by || null,
      createdAt: row.created_at,
      createdBy: row.created_by || null
    };
    if (options.includeEvidence !== false) result.evidence = this.evidence(row.id);
    if (options.includeReviews) result.reviews = this.reviews(row.id);
    if (options.includeScans) result.riskScans = this.riskScans(row.id);
    return result;
  }

  planRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      businessLineId: row.business_line_id || null,
      name: row.name,
      contentType: row.content_type,
      ownerUserId: row.owner_user_id || null,
      status: row.status,
      scheduledFor: row.scheduled_for || null,
      revision: Number(row.revision),
      metadata: jsonValue(row.metadata_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  article(workspaceId = this.workspaceId, articleId, options = {}) {
    const row = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, articleId);
    if (!row || (!options.includeArchived && row.status === "archived")) throw new ContentNotFoundError("Article not found.", { articleId });
    return this.articleRow(row, options);
  }

  version(workspaceId = this.workspaceId, versionId, options = {}) {
    const row = this.connection.prepare(`
      SELECT v.* FROM content_article_versions v
      JOIN content_articles a ON a.id = v.article_id
      WHERE a.workspace_id = ? AND v.id = ?
    `).get(workspaceId, versionId);
    if (!row) throw new ContentNotFoundError("Article version not found.", { versionId });
    return this.versionRow(row, options);
  }

  listArticles({ workspaceId = this.workspaceId, planId = "", taskId = "", businessLineId = "", status = "", limit = 100, includeArchived = false } = {}) {
    const params = [workspaceId];
    let query = "SELECT * FROM content_articles WHERE workspace_id = ?";
    if (!includeArchived) query += " AND status <> 'archived'";
    if (planId) { query += " AND plan_id = ?"; params.push(planId); }
    if (taskId) { query += " AND task_id = ?"; params.push(taskId); }
    if (businessLineId) { query += " AND business_line_id = ?"; params.push(businessLineId); }
    if (status) { query += " AND status = ?"; params.push(status); }
    query += " ORDER BY updated_at DESC LIMIT ?";
    params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => this.articleRow(row));
  }

  listVersions({ workspaceId = this.workspaceId, articleId, limit = 100, includeContent = false } = {}) {
    if (!articleId) throw new ContentError("articleId is required.", 422, "CONTENT_INVALID_INPUT");
    const rows = this.connection.prepare(`
      SELECT v.* FROM content_article_versions v
      JOIN content_articles a ON a.id = v.article_id
      WHERE a.workspace_id = ? AND v.article_id = ?
      ORDER BY v.version_number DESC LIMIT ?
    `).all(workspaceId, articleId, Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return rows.map((row) => this.versionRow(row, { includeContent }));
  }

  createPlan({ workspaceId = this.workspaceId, id: requestedId, businessLineId = null, name, contentType = "", ownerUserId = null, status = "draft", scheduledFor = null, metadata = {}, actor = null, request = null } = {}) {
    const planId = stringValue(requestedId || id("PLAN"), "plan id", 180, true);
    const timestamp = now();
    const normalizedStatus = allowedStatus(status, new Set(["draft", "planned", "active", "completed", "cancelled", "archived"]), "plan status");
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO content_plans (id, workspace_id, business_line_id, name, content_type, owner_user_id, status, scheduled_for, metadata_json, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        planId, workspaceId, stringValue(businessLineId, "businessLineId", 180) || null, stringValue(name, "plan name", MAX_TITLE, true), stringValue(contentType, "contentType", 120), ownerUserId || null, normalizedStatus, scheduledFor || null, jsonText(metadata), timestamp, timestamp, actorId(actor)
      );
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.plan.create", entityType: "content_plan", entityId: planId, details: { workspaceId }, request, createdAt: timestamp });
    });
    return this.plan(workspaceId, planId);
  }

  upsertPlan(options = {}) {
    const workspaceId = options.workspaceId || this.workspaceId;
    const requestedId = stringValue(options.id || id("PLAN"), "plan id", 180, true);
    let existing = this.connection.prepare("SELECT * FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, requestedId);
    if (!existing) existing = this.connection.prepare("SELECT * FROM content_plans WHERE workspace_id = ? AND json_extract(metadata_json, '$.localPlanId') = ? ORDER BY created_at ASC LIMIT 1").get(workspaceId, requestedId);
    if (!existing) return this.createPlan({ ...options, workspaceId, id: requestedId });
    const planId = existing.id;

    const name = stringValue(options.name ?? existing.name, "plan name", MAX_TITLE, true);
    const businessLineId = stringValue(options.businessLineId ?? existing.business_line_id, "businessLineId", 180) || null;
    const contentType = stringValue(options.contentType ?? existing.content_type, "contentType", 120);
    const status = allowedStatus(options.status ?? existing.status, new Set(["draft", "planned", "active", "completed", "cancelled", "archived"]), "plan status");
    const scheduledFor = options.scheduledFor === undefined ? existing.scheduled_for : (options.scheduledFor || null);
    const ownerUserId = options.ownerUserId === undefined ? existing.owner_user_id : (options.ownerUserId || null);
    const metadata = options.metadata === undefined ? jsonValue(existing.metadata_json) : jsonValue(options.metadata);
    const unchanged = name === existing.name
      && businessLineId === (existing.business_line_id || null)
      && contentType === existing.content_type
      && ownerUserId === (existing.owner_user_id || null)
      && status === existing.status
      && scheduledFor === (existing.scheduled_for || null)
      && JSON.stringify(metadata) === JSON.stringify(jsonValue(existing.metadata_json));
    if (unchanged) return this.plan(workspaceId, planId);

    const timestamp = now();
    const userId = actorId(options.actor);
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE content_plans
        SET business_line_id = ?, name = ?, content_type = ?, owner_user_id = ?, status = ?, scheduled_for = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
        WHERE workspace_id = ? AND id = ?`).run(
        businessLineId, name, contentType, ownerUserId, status, scheduledFor, jsonText(metadata), timestamp, workspaceId, planId
      );
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.plan.sync", entityType: "content_plan", entityId: planId, details: { workspaceId, localPlanId: requestedId, revision: Number(existing.revision) + 1 }, request: options.request, createdAt: timestamp });
    });
    return this.plan(workspaceId, planId);
  }

  plan(workspaceId = this.workspaceId, planId) {
    const row = this.connection.prepare("SELECT * FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, planId);
    if (!row) throw new ContentNotFoundError("Content plan not found.", { planId });
    return this.planRow(row);
  }

  listPlans({ workspaceId = this.workspaceId, businessLineId = "", status = "", limit = 100, includeArchived = false } = {}) {
    const params = [workspaceId]; let query = "SELECT * FROM content_plans WHERE workspace_id = ?";
    if (!includeArchived) query += " AND status <> 'archived'";
    if (businessLineId) { query += " AND business_line_id = ?"; params.push(businessLineId); }
    if (status) { query += " AND status = ?"; params.push(status); }
    query += " ORDER BY updated_at DESC LIMIT ?"; params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => this.planRow(row));
  }

  createTask({ workspaceId = this.workspaceId, id: requestedId, planId = null, topicId = null, businessLineId = null, title, assigneeUserId = null, dueAt = null, status = "planned", metadata = {}, actor = null, request = null } = {}) {
    const taskId = stringValue(requestedId || id("TASK"), "task id", 180, true); const timestamp = now();
    const normalizedStatus = allowedStatus(status, new Set(["planned", "queued", "generating", "draft", "in_review", "changes_requested", "approved", "completed", "cancelled"]), "task status");
    if (planId && !this.connection.prepare("SELECT 1 FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, planId)) throw new ContentNotFoundError("Content plan not found.", { planId });
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO content_tasks (id, workspace_id, plan_id, topic_id, business_line_id, title, assignee_user_id, status, due_at, metadata_json, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(taskId, workspaceId, planId || null, topicId || null, stringValue(businessLineId, "businessLineId", 180) || null, stringValue(title, "task title", MAX_TITLE, true), assigneeUserId || null, normalizedStatus, dueAt || null, jsonText(metadata), timestamp, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "content.task.create", entityType: "content_task", entityId: taskId, details: { workspaceId, planId }, request, createdAt: timestamp });
    });
    return this.task(workspaceId, taskId);
  }

  upsertTask(options = {}) {
    const workspaceId = options.workspaceId || this.workspaceId;
    const requestedId = stringValue(options.id || id("TASK"), "task id", 180, true);
    let existing = this.connection.prepare("SELECT * FROM content_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, requestedId);
    const localArticleId = String(options.metadata?.localArticleId || "").trim();
    if (!existing && localArticleId) existing = this.connection.prepare("SELECT * FROM content_tasks WHERE workspace_id = ? AND json_extract(metadata_json, '$.localArticleId') = ? ORDER BY created_at ASC LIMIT 1").get(workspaceId, localArticleId);
    if (!existing) return this.createTask({ ...options, workspaceId, id: requestedId });
    const taskId = existing.id;
    const planId = options.planId === undefined ? existing.plan_id : (options.planId || null);
    if (planId && !this.connection.prepare("SELECT 1 FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, planId)) throw new ContentNotFoundError("Content plan not found.", { planId });
    const topicId = options.topicId === undefined ? existing.topic_id : (options.topicId || null);
    const businessLineId = options.businessLineId === undefined ? existing.business_line_id : (stringValue(options.businessLineId, "businessLineId", 180) || null);
    const title = stringValue(options.title ?? existing.title, "task title", MAX_TITLE, true);
    const assigneeUserId = options.assigneeUserId === undefined ? existing.assignee_user_id : (options.assigneeUserId || null);
    const dueAt = options.dueAt === undefined ? existing.due_at : (options.dueAt || null);
    const requestedStatus = options.status === undefined ? existing.status : allowedStatus(options.status, new Set(["planned", "queued", "generating", "draft", "in_review", "changes_requested", "approved", "completed", "cancelled"]), "task status");
    const status = ["in_review", "changes_requested", "approved", "completed"].includes(existing.status) && ["planned", "queued", "generating", "draft"].includes(requestedStatus) ? existing.status : requestedStatus;
    const metadata = options.metadata === undefined ? jsonValue(existing.metadata_json) : jsonValue(options.metadata);
    const unchanged = planId === (existing.plan_id || null)
      && topicId === (existing.topic_id || null)
      && businessLineId === (existing.business_line_id || null)
      && title === existing.title
      && assigneeUserId === (existing.assignee_user_id || null)
      && dueAt === (existing.due_at || null)
      && status === existing.status
      && JSON.stringify(metadata) === JSON.stringify(jsonValue(existing.metadata_json));
    if (unchanged) return this.task(workspaceId, taskId);
    const timestamp = now();
    const userId = actorId(options.actor);
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE content_tasks
        SET plan_id = ?, topic_id = ?, business_line_id = ?, title = ?, assignee_user_id = ?, status = ?, due_at = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
        WHERE workspace_id = ? AND id = ?`).run(planId, topicId, businessLineId, title, assigneeUserId, status, dueAt, jsonText(metadata), timestamp, workspaceId, taskId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.task.sync", entityType: "content_task", entityId: taskId, details: { workspaceId, planId, requestedTaskId: requestedId }, request: options.request, createdAt: timestamp });
    });
    return this.task(workspaceId, taskId);
  }

  task(workspaceId = this.workspaceId, taskId) {
    const row = this.connection.prepare("SELECT * FROM content_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, taskId);
    if (!row) throw new ContentNotFoundError("Content task not found.", { taskId });
    return { id: row.id, workspaceId: row.workspace_id, planId: row.plan_id || null, topicId: row.topic_id || null, businessLineId: row.business_line_id || null, title: row.title, assigneeUserId: row.assignee_user_id || null, articleId: row.article_id || null, status: row.status, dueAt: row.due_at || null, revision: Number(row.revision), metadata: jsonValue(row.metadata_json), createdAt: row.created_at, updatedAt: row.updated_at };
  }

  listTasks({ workspaceId = this.workspaceId, planId = "", status = "", businessLineId = "", limit = 100, includeCancelled = false } = {}) {
    const params = [workspaceId];
    let query = "SELECT * FROM content_tasks WHERE workspace_id = ?";
    if (!includeCancelled) query += " AND status <> 'cancelled'";
    if (planId) { query += " AND plan_id = ?"; params.push(planId); }
    if (status) { query += " AND status = ?"; params.push(status); }
    if (businessLineId) { query += " AND business_line_id = ?"; params.push(businessLineId); }
    query += " ORDER BY updated_at DESC LIMIT ?";
    params.push(Math.max(1, Math.min(1_000, Number(limit) || 100)));
    return this.connection.prepare(query).all(...params).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      planId: row.plan_id || null,
      topicId: row.topic_id || null,
      businessLineId: row.business_line_id || null,
      title: row.title,
      assigneeUserId: row.assignee_user_id || null,
      articleId: row.article_id || null,
      status: row.status,
      dueAt: row.due_at || null,
      revision: Number(row.revision),
      metadata: jsonValue(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  createArticle({ workspaceId = this.workspaceId, id: requestedId, taskId = null, planId = null, topicId = null, businessLineId = null, title, category = "", contentHtml = "", contentText = "", excerpt = "", source = "human", generationJobId = null, metadata = {}, evidence = [], actor = null, request = null } = {}) {
    const articleId = stringValue(requestedId || id("ART"), "article id", 180, true);
    const normalizedTitle = stringValue(title, "article title", MAX_TITLE, true);
    const timestamp = now(); const userId = actorId(actor);
    const hasBody = Boolean(String(contentHtml || contentText || "").trim());
    let createdVersionId = null;
    this.database.transaction(() => {
      if (taskId && !this.connection.prepare("SELECT 1 FROM content_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, taskId)) throw new ContentNotFoundError("Content task not found.", { taskId });
      if (planId && !this.connection.prepare("SELECT 1 FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, planId)) throw new ContentNotFoundError("Content plan not found.", { planId });
      this.connection.prepare(`INSERT INTO content_articles (id, workspace_id, task_id, plan_id, topic_id, business_line_id, title, category, status, revision, metadata_json, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?)`).run(articleId, workspaceId, taskId || null, planId || null, topicId || null, stringValue(businessLineId, "businessLineId", 180) || null, normalizedTitle, stringValue(category, "category", 120), jsonText(metadata), timestamp, timestamp, userId, userId);
      if (hasBody) {
        const body = normalizeContent({ contentHtml, contentText });
        createdVersionId = this.insertVersion({ articleId, versionNumber: 1, title: normalizedTitle, body, excerpt, source, generationJobId, metadata, evidence, timestamp, userId });
        this.connection.prepare("UPDATE content_articles SET current_version_id = ?, updated_at = ? WHERE id = ?").run(createdVersionId, timestamp, articleId);
      }
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.create", entityType: "content_article", entityId: articleId, details: { workspaceId, versionId: createdVersionId, taskId, planId }, request, createdAt: timestamp });
    });
    if (taskId) this.linkTaskArticle(workspaceId, taskId, articleId, timestamp);
    return this.article(workspaceId, articleId, { includeVersion: true });
  }

  upsertArticle(options = {}) {
    const workspaceId = options.workspaceId || this.workspaceId;
    const requestedId = stringValue(options.id || id("ART"), "article id", 180, true);
    let existing = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, requestedId);
    const localArticleId = String(options.metadata?.localArticleId || requestedId).trim();
    if (!existing && localArticleId) existing = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND json_extract(metadata_json, '$.localArticleId') = ? ORDER BY created_at ASC LIMIT 1").get(workspaceId, localArticleId);
    if (!existing) return this.createArticle({ ...options, workspaceId, id: requestedId });
    const articleId = existing.id;
    if (options.expectedRevision !== undefined) checkRevision(options.expectedRevision, existing.revision, articleId);
    const timestamp = now(); const userId = actorId(options.actor);
    const taskId = options.taskId === undefined ? existing.task_id : (options.taskId || null);
    const planId = options.planId === undefined ? existing.plan_id : (options.planId || null);
    if (taskId && !this.connection.prepare("SELECT 1 FROM content_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, taskId)) throw new ContentNotFoundError("Content task not found.", { taskId });
    if (planId && !this.connection.prepare("SELECT 1 FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspaceId, planId)) throw new ContentNotFoundError("Content plan not found.", { planId });
    const topicId = options.topicId === undefined ? existing.topic_id : (options.topicId || null);
    const businessLineId = options.businessLineId === undefined ? existing.business_line_id : (stringValue(options.businessLineId, "businessLineId", 180) || null);
    const title = stringValue(options.title, "article title", MAX_TITLE) || existing.title;
    const category = stringValue(options.category, "category", 120) || existing.category;
    const metadata = options.metadata === undefined ? jsonValue(existing.metadata_json) : jsonValue(options.metadata);
    const unchanged = taskId === (existing.task_id || null)
      && planId === (existing.plan_id || null)
      && topicId === (existing.topic_id || null)
      && businessLineId === (existing.business_line_id || null)
      && title === existing.title
      && category === existing.category
      && JSON.stringify(metadata) === JSON.stringify(jsonValue(existing.metadata_json));
    if (unchanged) {
      if (taskId) this.linkTaskArticle(workspaceId, taskId, articleId, timestamp);
      return this.article(workspaceId, articleId, { includeVersion: true });
    }
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE content_articles
        SET task_id = ?, plan_id = ?, topic_id = ?, business_line_id = ?, title = COALESCE(NULLIF(?, ''), title), category = COALESCE(NULLIF(?, ''), category), metadata_json = ?, updated_at = ?, updated_by = ?, revision = revision + 1
        WHERE workspace_id = ? AND id = ?`).run(taskId, planId, topicId, businessLineId, title, category, jsonText(metadata), timestamp, userId, workspaceId, articleId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.update", entityType: "content_article", entityId: articleId, details: { workspaceId, localArticleId }, request: options.request, createdAt: timestamp });
    });
    if (taskId) this.linkTaskArticle(workspaceId, taskId, articleId, timestamp);
    return this.article(workspaceId, articleId, { includeVersion: true });
  }

  insertVersion({ articleId, versionNumber, basedOnVersionId = null, title, body, excerpt = "", source = "human", generationJobId = null, metadata = {}, evidence = [], timestamp, userId }) {
    const versionId = id("ARTV");
    this.connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, based_on_version_id, title, content_html, content_text, excerpt, content_hash, source, generation_job_id, review_status, risk_status, metadata_json, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'not_scanned', ?, ?, ?)`).run(versionId, articleId, versionNumber, basedOnVersionId || null, title, body.html, body.text, stringValue(excerpt, "excerpt", MAX_EXCERPT), body.hash, ["human", "ai", "import"].includes(source) ? source : "human", generationJobId || null, jsonText(metadata), timestamp, userId);
    const usedEvidenceIds = new Set();
    for (const item of normalizeEvidence(evidence)) {
      let evidenceId = item.id;
      if (usedEvidenceIds.has(evidenceId) || this.connection.prepare("SELECT 1 FROM content_article_evidence WHERE id = ?").get(evidenceId)) evidenceId = `${evidenceId}-${versionId}`.slice(0, 180);
      usedEvidenceIds.add(evidenceId);
      this.connection.prepare(`INSERT INTO content_article_evidence (id, article_version_id, ordinal, marker, knowledge_library_id, knowledge_document_id, knowledge_version_id, knowledge_chunk_id, claim, quote, support_status, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(evidenceId, versionId, item.ordinal, item.marker, item.knowledgeLibraryId || null, item.knowledgeDocumentId || null, item.knowledgeVersionId || null, item.knowledgeChunkId || null, item.claim, item.quote, item.supportStatus, item.metadataJson, timestamp);
    }
    return versionId;
  }

  linkTaskArticle(workspaceId, taskId, articleId, timestamp = now()) {
    const current = this.connection.prepare("SELECT article_id, status FROM content_tasks WHERE workspace_id = ? AND id = ?").get(workspaceId, taskId);
    if (!current) throw new ContentNotFoundError("Content task not found.", { taskId });
    if (current.article_id === articleId && !["planned", "queued", "generating"].includes(current.status)) return;
    this.database.transaction(() => {
      const result = this.connection.prepare("UPDATE content_tasks SET article_id = ?, status = CASE WHEN status IN ('planned', 'queued', 'generating') THEN 'draft' ELSE status END, revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND id = ?").run(articleId, timestamp, workspaceId, taskId);
      if (!Number(result.changes)) throw new ContentNotFoundError("Content task not found.", { taskId });
    });
  }

  createVersion({ workspaceId = this.workspaceId, articleId, expectedRevision, baseVersionId = null, title, contentHtml = "", contentText = "", excerpt = "", source = "human", generationJobId = null, metadata = {}, evidence = [], actor = null, request = null } = {}) {
    const row = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, articleId);
    if (!row || row.status === "archived") throw new ContentNotFoundError("Article not found.", { articleId });
    checkRevision(expectedRevision, row.revision, articleId);
    const currentId = row.current_version_id || null;
    if (baseVersionId && baseVersionId !== currentId) throw new ContentConflictError("The base article version is stale.", { articleId, currentVersionId: currentId, baseVersionId });
    if (currentId) {
      const current = this.connection.prepare("SELECT * FROM content_article_versions WHERE id = ?").get(currentId);
      if (current?.review_status === "pending") throw new ContentStateError("Request changes on the pending version before creating a replacement.", "CONTENT_VERSION_IN_REVIEW");
    }
    const body = normalizeContent({ contentHtml, contentText }); const timestamp = now(); const userId = actorId(actor);
    let versionId;
    this.database.transaction(() => {
      const latest = this.connection.prepare("SELECT MAX(version_number) AS version FROM content_article_versions WHERE article_id = ?").get(articleId);
      versionId = this.insertVersion({ articleId, versionNumber: Number(latest?.version || 0) + 1, basedOnVersionId: currentId, title: stringValue(title || row.title, "article title", MAX_TITLE, true), body, excerpt, source, generationJobId, metadata, evidence, timestamp, userId });
      const result = this.connection.prepare("UPDATE content_articles SET title = ?, current_version_id = ?, status = 'draft', revision = revision + 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND id = ? AND revision = ?").run(stringValue(title || row.title, "article title", MAX_TITLE, true), versionId, timestamp, userId, workspaceId, articleId, Number(expectedRevision));
      if (!Number(result.changes)) throw new ContentConflictError("The article revision is stale.", { articleId });
      this.connection.prepare("UPDATE content_tasks SET status = 'draft', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.version.create", entityType: "content_article_version", entityId: versionId, details: { articleId, basedOnVersionId: currentId }, request, createdAt: timestamp });
    });
    return this.version(workspaceId, versionId, { includeContent: true });
  }

  evidence(versionId) {
    return this.connection.prepare("SELECT * FROM content_article_evidence WHERE article_version_id = ? ORDER BY ordinal ASC").all(versionId).map((row) => ({ id: row.id, articleVersionId: row.article_version_id, ordinal: Number(row.ordinal), marker: row.marker, knowledgeLibraryId: row.knowledge_library_id || null, knowledgeDocumentId: row.knowledge_document_id || null, knowledgeVersionId: row.knowledge_version_id || null, knowledgeChunkId: row.knowledge_chunk_id || null, claim: row.claim, quote: row.quote, supportStatus: row.support_status, metadata: jsonValue(row.metadata_json), createdAt: row.created_at }));
  }

  reviews(versionId) {
    return this.connection.prepare("SELECT * FROM content_article_reviews WHERE article_version_id = ? ORDER BY created_at ASC").all(versionId).map((row) => ({ id: row.id, articleVersionId: row.article_version_id, round: Number(row.review_round), action: row.action, fromStatus: row.from_status || null, toStatus: row.to_status || null, note: row.note, details: jsonValue(row.details_json), createdAt: row.created_at, actorUserId: row.actor_user_id || null }));
  }

  riskScans(versionId) {
    return this.connection.prepare("SELECT * FROM content_risk_scan_runs WHERE article_version_id = ? ORDER BY created_at DESC").all(versionId).map((row) => ({ id: row.id, articleVersionId: row.article_version_id, status: row.status, policyVersion: row.policy_version, findings: jsonValue(row.findings_json, []), summary: jsonValue(row.summary_json), errorCode: row.error_code || null, errorMessage: row.error_message || null, createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null, createdBy: row.created_by || null }));
  }

  assertCurrentVersion(workspaceId, articleId, versionId, expectedRevision, allowedReviews = null) {
    const article = this.connection.prepare("SELECT * FROM content_articles WHERE workspace_id = ? AND id = ?").get(workspaceId, articleId);
    if (!article) throw new ContentNotFoundError("Article not found.", { articleId });
    checkRevision(expectedRevision, article.revision, articleId);
    if (article.current_version_id !== versionId) throw new ContentConflictError("Only the current article version can be advanced.", { articleId, currentVersionId: article.current_version_id, versionId });
    const version = this.connection.prepare("SELECT * FROM content_article_versions WHERE id = ? AND article_id = ?").get(versionId, articleId);
    if (!version) throw new ContentNotFoundError("Article version not found.", { versionId });
    if (allowedReviews && !allowedReviews.includes(version.review_status)) throw new ContentStateError(`Version is ${version.review_status}, not ${allowedReviews.join(" or ")}.`, "CONTENT_INVALID_STATE");
    return { article, version };
  }

  insertReview({ versionId, action, fromStatus, toStatus, note = "", actor = null, request = null, details = {}, timestamp = now() }) {
    if (!REVIEW_ACTIONS.has(action)) throw new ContentError("Invalid review action.", 422, "CONTENT_INVALID_INPUT");
    const round = Number(this.connection.prepare("SELECT COALESCE(MAX(review_round), 0) + 1 AS round FROM content_article_reviews WHERE article_version_id = ?").get(versionId)?.round || 1);
    const reviewId = id("REV"); const userId = actorId(actor);
    this.connection.prepare("INSERT INTO content_article_reviews (id, article_version_id, review_round, action, from_status, to_status, note, details_json, created_at, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(reviewId, versionId, round, action, fromStatus || null, toStatus || null, stringValue(note, "review note", 20_000), jsonText(details), timestamp, userId);
    return reviewId;
  }

  submitReview({ workspaceId = this.workspaceId, articleId, versionId, expectedRevision, actor = null, request = null, note = "" } = {}) {
    const { article, version } = this.assertCurrentVersion(workspaceId, articleId, versionId, expectedRevision, ["draft", "changes_requested"]);
    if (!["passed", "warning"].includes(version.risk_status)) throw new ContentStateError("Run a risk scan before submitting the article for review.", "CONTENT_RISK_SCAN_REQUIRED");
    const evidence = this.evidence(versionId);
    if (this.requireEvidence && !evidence.some((item) => ["supported", "partial"].includes(item.supportStatus))) throw new ContentStateError("At least one supported knowledge citation is required before review.", "CONTENT_EVIDENCE_REQUIRED");
    this.validateEvidenceReferences(evidence, { workspaceId, articleId, versionId, action: "submit-review", article, version });
    const timestamp = now(); const userId = actorId(actor);
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_article_versions SET review_status = 'pending' WHERE id = ?").run(versionId);
      this.connection.prepare("UPDATE content_articles SET status = 'in_review', revision = revision + 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND id = ? AND revision = ?").run(timestamp, userId, workspaceId, articleId, Number(expectedRevision));
      this.connection.prepare("UPDATE content_tasks SET status = 'in_review', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      this.insertReview({ versionId, action: "submitted", fromStatus: version.review_status, toStatus: "pending", note, actor, request, timestamp });
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.review.submit", entityType: "content_article_version", entityId: versionId, details: { articleId }, request, createdAt: timestamp });
    });
    return this.version(workspaceId, versionId, { includeContent: true, includeReviews: true, includeScans: true });
  }

  requestChanges({ workspaceId = this.workspaceId, articleId, versionId, expectedRevision, note = "", actor = null, request = null } = {}) {
    const { article, version } = this.assertCurrentVersion(workspaceId, articleId, versionId, expectedRevision, ["pending"]);
    if (!stringValue(note, "review note", 20_000, true)) throw new ContentError("A change request note is required.", 422, "CONTENT_REVIEW_NOTE_REQUIRED");
    const timestamp = now(); const userId = actorId(actor);
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_article_versions SET review_status = 'changes_requested' WHERE id = ?").run(versionId);
      this.connection.prepare("UPDATE content_articles SET status = 'changes_requested', revision = revision + 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND id = ? AND revision = ?").run(timestamp, userId, workspaceId, articleId, Number(expectedRevision));
      this.connection.prepare("UPDATE content_tasks SET status = 'changes_requested', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      this.insertReview({ versionId, action: "changes_requested", fromStatus: version.review_status, toStatus: "changes_requested", note, actor, request, timestamp });
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.review.request_changes", entityType: "content_article_version", entityId: versionId, details: { articleId }, request, createdAt: timestamp });
    });
    return this.version(workspaceId, versionId, { includeContent: true, includeReviews: true });
  }

  approveAndFreeze({ workspaceId = this.workspaceId, articleId, versionId, expectedRevision, note = "", actor = null, request = null, allowNoEvidence = false } = {}) {
    const { article, version } = this.assertCurrentVersion(workspaceId, articleId, versionId, expectedRevision, ["pending"]);
    if (!["passed", "warning"].includes(version.risk_status)) throw new ContentStateError("The article must pass risk scanning before approval.", "CONTENT_RISK_SCAN_REQUIRED");
    const evidence = this.evidence(versionId);
    if (!allowNoEvidence && this.requireEvidence && !evidence.some((item) => item.supportStatus === "supported")) throw new ContentStateError("The article needs a supported knowledge citation before approval.", "CONTENT_EVIDENCE_REQUIRED");
    if (!allowNoEvidence || evidence.length) this.validateEvidenceReferences(evidence, { workspaceId, articleId, versionId, action: "approve", article, version });
    const timestamp = now(); const userId = actorId(actor);
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_article_versions SET review_status = 'approved', frozen_at = ?, frozen_by = ? WHERE id = ?").run(timestamp, userId, versionId);
      const result = this.connection.prepare("UPDATE content_articles SET status = 'approved', approved_version_id = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND id = ? AND revision = ?").run(versionId, timestamp, userId, workspaceId, articleId, Number(expectedRevision));
      if (!Number(result.changes)) throw new ContentConflictError("The article revision is stale.", { articleId });
      this.connection.prepare("UPDATE content_tasks SET status = 'approved', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      this.insertReview({ versionId, action: "approved", fromStatus: version.review_status, toStatus: "approved", note, actor, request, timestamp });
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.review.approve_freeze", entityType: "content_article_version", entityId: versionId, details: { articleId, frozenAt: timestamp }, request, createdAt: timestamp });
    });
    return this.version(workspaceId, versionId, { includeContent: true, includeEvidence: true, includeReviews: true, includeScans: true });
  }

  recordRiskScan({ workspaceId = this.workspaceId, articleId, versionId, status, policyVersion = "", findings = [], summary = {}, errorCode = null, errorMessage = null, actor = null, request = null, startedAt = null, completedAt = null } = {}) {
    if (!RISK_STATES.has(status)) throw new ContentError("Invalid risk scan status.", 422, "CONTENT_INVALID_INPUT");
    const version = this.connection.prepare("SELECT v.*, a.workspace_id FROM content_article_versions v JOIN content_articles a ON a.id = v.article_id WHERE a.workspace_id = ? AND a.id = ? AND v.id = ?").get(workspaceId, articleId, versionId);
    if (!version) throw new ContentNotFoundError("Article version not found.", { versionId });
    if (version.frozen_at) throw new ContentStateError("A frozen article version cannot be rescanned.", "CONTENT_VERSION_FROZEN");
    const scanId = id("RISK"); const timestamp = now(); const userId = actorId(actor);
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO content_risk_scan_runs (id, article_version_id, status, policy_version, findings_json, summary_json, error_code, error_message, created_at, started_at, completed_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(scanId, versionId, status, stringValue(policyVersion, "policyVersion", 120), JSON.stringify(Array.isArray(findings) ? findings : []), jsonText(summary), errorCode || null, errorMessage ? String(errorMessage).slice(0, 2_000) : null, timestamp, startedAt || timestamp, completedAt || (RISK_STATES.has(status) && !["queued", "running"].includes(status) ? timestamp : null), userId);
      this.connection.prepare("UPDATE content_article_versions SET risk_status = ? WHERE id = ?").run(status === "queued" || status === "running" ? "not_scanned" : status, versionId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.risk_scan", entityType: "content_risk_scan_run", entityId: scanId, details: { articleId, versionId, status, policyVersion }, request, createdAt: timestamp });
    });
    return this.riskScans(versionId)[0];
  }

  canPublish(articleId, versionId = null, options = {}) {
    const workspaceId = options.workspaceId || this.workspaceId;
    let article;
    try { article = this.article(workspaceId, articleId, { includeArchived: true }); } catch (error) { return { ok: false, code: error.code || "CONTENT_NOT_FOUND", reason: error.message, articleId, versionId }; }
    if (article.status === "archived") return { ok: false, code: "CONTENT_ARTICLE_ARCHIVED", reason: "An archived article cannot be published.", articleId, versionId };
    const selectedId = versionId || article.currentVersionId;
    if (!selectedId) return { ok: false, code: "CONTENT_VERSION_REQUIRED", reason: "A frozen article version is required.", articleId, versionId: null };
    let version;
    try { version = this.version(workspaceId, selectedId, { includeEvidence: true }); } catch (error) { return { ok: false, code: error.code || "CONTENT_NOT_FOUND", reason: error.message, articleId, versionId: selectedId }; }
    if (version.articleId !== articleId) return { ok: false, code: "CONTENT_VERSION_ARTICLE_MISMATCH", reason: "The selected version does not belong to this article.", articleId, versionId: selectedId, article, version };
    if (version.reviewStatus !== "approved" || !version.frozenAt) return { ok: false, code: "CONTENT_REVIEW_REQUIRED", reason: "Only an approved and frozen article version can be published.", articleId, versionId: selectedId, article, version };
    if (!["passed", "warning"].includes(version.riskStatus)) return { ok: false, code: "CONTENT_RISK_BLOCKED", reason: "The article has not passed risk scanning.", articleId, versionId: selectedId, article, version };
    if ((options.requireEvidence ?? this.requireEvidence) && !version.evidence.some((item) => item.supportStatus === "supported")) return { ok: false, code: "CONTENT_EVIDENCE_REQUIRED", reason: "The article has no supported knowledge citation.", articleId, versionId: selectedId, article, version };
    try {
      this.validateEvidenceReferences(version.evidence, { workspaceId, articleId, versionId: selectedId, action: "publish", article, version });
    } catch (error) {
      return { ok: false, code: error.code || "CONTENT_EVIDENCE_INVALID", reason: error.message || "The article evidence is no longer valid.", articleId, versionId: selectedId, article, version, details: error.details };
    }
    return { ok: true, code: "CONTENT_PUBLISHABLE", reason: "The article version is approved, frozen, and passed risk checks.", articleId, versionId: selectedId, article, version };
  }

  assertCanPublish(articleId, versionId = null, options = {}) {
    const result = this.canPublish(articleId, versionId, options);
    if (!result.ok) throw new ContentStateError(result.reason, result.code, { articleId, versionId: result.versionId });
    return result;
  }

  publish({ workspaceId = this.workspaceId, articleId, versionId = null, expectedRevision, category = "", metadata = {}, actor = null, request = null } = {}) {
    const current = this.article(workspaceId, articleId, { includeArchived: true });
    const revision = checkRevision(expectedRevision, current.revision, articleId);
    const publishable = this.assertCanPublish(articleId, versionId, { workspaceId });
    const selectedVersionId = publishable.versionId;
    const showPublicCitationMarkers = publicCitationMarkersVisible(publishable.version.metadata);
    const timestamp = now();
    const userId = actorId(actor);
    const requestedMetadata = jsonValue(metadata, {});
    const requestedSite = jsonValue(requestedMetadata.site, {});
    const existingSite = jsonValue(current.metadata?.site, {});
    const hasSiteExcerpt = Object.prototype.hasOwnProperty.call(requestedMetadata, "siteExcerpt") || Object.prototype.hasOwnProperty.call(requestedSite, "excerpt");
    const normalizedCategory = stringValue(category || requestedMetadata.siteCategory || requestedSite.category || current.category, "category", 120);
    const siteSlug = stringValue(requestedMetadata.siteSlug || requestedSite.slug, "siteSlug", 240);
    const siteAuthor = stringValue(requestedMetadata.siteAuthor || requestedSite.author, "siteAuthor", 160);
    const siteExcerpt = stringValue(requestedMetadata.siteExcerpt || requestedSite.excerpt, "siteExcerpt", MAX_EXCERPT);
    const siteCategoryId = stringValue(requestedMetadata.siteCategoryId || requestedSite.categoryId, "siteCategoryId", 180);
    const siteCategorySlug = stringValue(requestedMetadata.siteCategorySlug || requestedSite.categorySlug, "siteCategorySlug", 180);
    if (siteSlug) {
      const owner = this.connection.prepare(`
        SELECT id FROM content_articles
        WHERE workspace_id = ? AND id <> ? AND status = 'published'
          AND lower(COALESCE(json_extract(metadata_json, '$.siteSlug'), json_extract(metadata_json, '$.site.slug'), '')) = lower(?)
        LIMIT 1
      `).get(workspaceId, articleId, siteSlug);
      if (owner) throw new ContentStateError("Another published article already uses this site slug.", "CONTENT_SITE_SLUG_CONFLICT", { articleId, conflictingArticleId: owner.id, siteSlug });
    }
    const mergedMetadata = {
      ...current.metadata,
      ...requestedMetadata,
      site: {
        ...existingSite,
        ...requestedSite,
        ...(siteSlug ? { slug: siteSlug } : {}),
        ...(normalizedCategory ? { category: normalizedCategory } : {}),
        ...(siteCategoryId ? { categoryId: siteCategoryId } : {}),
        ...(siteCategorySlug ? { categorySlug: siteCategorySlug } : {}),
        ...(siteAuthor ? { author: siteAuthor } : {}),
        ...(hasSiteExcerpt ? { excerpt: siteExcerpt } : {}),
        showPublicCitationMarkers,
        status: "published",
        versionId: selectedVersionId,
        publishedAt: timestamp,
        updatedAt: timestamp
      },
      ...(siteSlug ? { siteSlug } : {}),
      ...(normalizedCategory ? { siteCategory: normalizedCategory } : {}),
      ...(siteCategoryId ? { siteCategoryId } : {}),
      ...(siteCategorySlug ? { siteCategorySlug } : {}),
      ...(siteAuthor ? { siteAuthor } : {}),
      ...(hasSiteExcerpt ? { siteExcerpt } : {}),
      showPublicCitationMarkers,
      siteStatus: "published",
      sitePublishedAt: timestamp,
      siteUpdatedAt: timestamp,
      publishedVersionId: selectedVersionId
    };
    this.database.transaction(() => {
      const result = this.connection.prepare(`
        UPDATE content_articles
        SET category = ?, status = 'published', approved_version_id = ?, metadata_json = ?, revision = revision + 1, updated_at = ?, updated_by = ?
        WHERE workspace_id = ? AND id = ? AND revision = ?
      `).run(normalizedCategory, selectedVersionId, JSON.stringify(mergedMetadata), timestamp, userId, workspaceId, articleId, revision);
      if (!Number(result.changes)) throw new ContentConflictError("The article revision is stale.", { articleId, expectedRevision: revision });
      this.connection.prepare("UPDATE content_tasks SET status = 'completed', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.publish", entityType: "content_article", entityId: articleId, details: { workspaceId, versionId: selectedVersionId, category: normalizedCategory, siteSlug: siteSlug || null, publishedAt: timestamp }, request, createdAt: timestamp });
    });
    const article = this.article(workspaceId, articleId, { includeVersion: true, includeEvidence: true });
    const version = this.version(workspaceId, selectedVersionId, { includeContent: true, includeEvidence: true });
    const task = article.taskId ? this.task(workspaceId, article.taskId) : null;
    return { article, version, task };
  }

  unpublish({ workspaceId = this.workspaceId, articleId, expectedRevision, reason = "", actor = null, request = null } = {}) {
    const current = this.article(workspaceId, articleId, { includeArchived: true });
    const revision = checkRevision(expectedRevision, current.revision, articleId);
    if (current.status !== "published") throw new ContentStateError("Only a published article can be unpublished.", "CONTENT_NOT_PUBLISHED", { articleId, status: current.status });
    const timestamp = now();
    const userId = actorId(actor);
    const normalizedReason = stringValue(reason, "reason", 2_000);
    const existingSite = jsonValue(current.metadata?.site, {});
    const mergedMetadata = {
      ...current.metadata,
      site: { ...existingSite, status: "unpublished", unpublishedAt: timestamp, updatedAt: timestamp },
      siteStatus: "unpublished",
      siteUnpublishedAt: timestamp,
      siteUpdatedAt: timestamp,
      ...(normalizedReason ? { siteUnpublishReason: normalizedReason } : {})
    };
    this.database.transaction(() => {
      const result = this.connection.prepare(`
        UPDATE content_articles
        SET status = 'approved', metadata_json = ?, revision = revision + 1, updated_at = ?, updated_by = ?
        WHERE workspace_id = ? AND id = ? AND revision = ?
      `).run(JSON.stringify(mergedMetadata), timestamp, userId, workspaceId, articleId, revision);
      if (!Number(result.changes)) throw new ContentConflictError("The article revision is stale.", { articleId, expectedRevision: revision });
      this.connection.prepare("UPDATE content_tasks SET status = 'approved', revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND article_id = ?").run(timestamp, workspaceId, articleId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.article.unpublish", entityType: "content_article", entityId: articleId, details: { workspaceId, versionId: current.approvedVersionId, reason: normalizedReason || null, unpublishedAt: timestamp }, request, createdAt: timestamp });
    });
    const article = this.article(workspaceId, articleId, { includeVersion: true, includeEvidence: true });
    const version = article.approvedVersionId ? this.version(workspaceId, article.approvedVersionId, { includeContent: true, includeEvidence: true }) : null;
    const task = article.taskId ? this.task(workspaceId, article.taskId) : null;
    return { article, version, task };
  }

  createGenerationJob({ workspaceId = this.workspaceId, id: requestedId, articleId = null, taskId = null, operation = "article", idempotencyKey = null, providerId = null, model = null, promptVersion = null, retrievalRunId = null, requestPayload = {}, actor = null, request = null } = {}) {
    const jobId = stringValue(requestedId || id("GEN"), "generation job id", 180, true); const timestamp = now(); const userId = actorId(actor);
    if (!["article", "rewrite", "collaboration"].includes(operation)) throw new ContentError("Invalid generation operation.", 422, "CONTENT_INVALID_INPUT");
    try {
      this.database.transaction(() => {
        this.connection.prepare("INSERT INTO content_generation_jobs (id, workspace_id, article_id, task_id, operation, idempotency_key, provider_id, model, prompt_version, retrieval_run_id, request_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(jobId, workspaceId, articleId || null, taskId || null, operation, idempotencyKey || null, providerId || null, model || null, promptVersion || null, retrievalRunId || null, jsonText(requestPayload), timestamp, userId);
        appendAuditLog(this.connection, { actorUserId: userId, action: "content.generation.create", entityType: "content_generation_job", entityId: jobId, details: { workspaceId, articleId, operation }, request, createdAt: timestamp });
      });
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE") && idempotencyKey) {
        const existing = this.connection.prepare("SELECT id FROM content_generation_jobs WHERE workspace_id = ? AND idempotency_key = ?").get(workspaceId, idempotencyKey);
        if (existing?.id) return this.generationJob(workspaceId, existing.id);
      }
      throw error;
    }
    return this.generationJob(workspaceId, jobId);
  }

  generationJob(workspaceId = this.workspaceId, jobId) {
    const row = this.connection.prepare("SELECT * FROM content_generation_jobs WHERE workspace_id = ? AND id = ?").get(workspaceId, jobId);
    if (!row) throw new ContentNotFoundError("Generation job not found.", { jobId });
    return { id: row.id, workspaceId: row.workspace_id, articleId: row.article_id || null, taskId: row.task_id || null, operation: row.operation, status: row.status, idempotencyKey: row.idempotency_key || null, providerId: row.provider_id || null, model: row.model || null, promptVersion: row.prompt_version || null, retrievalRunId: row.retrieval_run_id || null, request: jsonValue(row.request_json), result: jsonValue(row.result_json), inputTokens: Number(row.input_tokens), outputTokens: Number(row.output_tokens), costMicros: Number(row.cost_micros), attempts: Number(row.attempts), errorCode: row.error_code || null, errorMessage: row.error_message || null, createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null, createdBy: row.created_by || null };
  }

  generationJobByIdempotency(workspaceId = this.workspaceId, idempotencyKey) {
    const normalized = stringValue(idempotencyKey, "idempotencyKey", 500);
    if (!normalized) return null;
    const row = this.connection.prepare("SELECT id FROM content_generation_jobs WHERE workspace_id = ? AND idempotency_key = ?").get(workspaceId, normalized);
    return row?.id ? this.generationJob(workspaceId, row.id) : null;
  }

  updateGenerationJob({ workspaceId = this.workspaceId, jobId, status, result = {}, errorCode = null, errorMessage = null, inputTokens = 0, outputTokens = 0, costMicros = 0, actor = null, request = null } = {}) {
    const job = this.generationJob(workspaceId, jobId); const allowed = new Set(["queued", "running", "succeeded", "failed", "cancelled"]);
    if (!allowed.has(status)) throw new ContentError("Invalid generation job status.", 422, "CONTENT_INVALID_INPUT");
    if (["succeeded", "failed", "cancelled"].includes(job.status)) throw new ContentStateError("A completed generation job cannot be changed.", "CONTENT_JOB_COMPLETED");
    const timestamp = now(); const userId = actorId(actor); const startedAt = status === "running" ? (job.startedAt || timestamp) : job.startedAt; const completedAt = ["succeeded", "failed", "cancelled"].includes(status) ? timestamp : null;
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_generation_jobs SET status = ?, result_json = ?, input_tokens = ?, output_tokens = ?, cost_micros = ?, attempts = attempts + ?, error_code = ?, error_message = ?, started_at = ?, completed_at = ? WHERE workspace_id = ? AND id = ?").run(status, jsonText(result), Math.max(0, Number(inputTokens) || 0), Math.max(0, Number(outputTokens) || 0), Math.max(0, Number(costMicros) || 0), status === "running" ? 1 : 0, errorCode || null, errorMessage ? String(errorMessage).slice(0, 2_000) : null, startedAt || null, completedAt, workspaceId, jobId);
      appendAuditLog(this.connection, { actorUserId: userId, action: "content.generation.update", entityType: "content_generation_job", entityId: jobId, details: { status }, request, createdAt: timestamp });
    });
    return this.generationJob(workspaceId, jobId);
  }
}

export default ContentStore;
