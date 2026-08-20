import { createHash } from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";

export const DEFAULT_BUSINESS_RECORD_ARRAYS = Object.freeze({
  business_line: "businessLines",
  writing_agent: "writingAgents",
  keyword: "keywords",
  keyword_pack: "keywordPacks",
  question: "questionLibrary",
  topic: "topics",
  content_plan: "contentPlans",
  article: "articles",
  publish_task: "publishTasks",
  publish_schedule: "publishSchedules",
  account_group: "accountGroups",
  knowledge_base: "knowledgeBases",
  knowledge_item: "knowledgeItems",
  knowledge_version: "knowledgeVersions",
  knowledge_gap: "knowledgeGaps",
  knowledge_citation: "knowledgeCitations",
  writing_workspace: "writingWorkspaces",
  ai_conversation: "aiConversations",
  content_asset: "contentAssets",
  site_cms_task: "siteCmsTasks",
  monitor_task: "monitoring.tasks"
});

export class WorkspaceStoreError extends Error {
  constructor(message, status = 422, code = "WORKSPACE_STORE_ERROR", details = undefined) {
    super(message);
    this.name = "WorkspaceStoreError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class WorkspaceConflictError extends WorkspaceStoreError {
  constructor(expectedRevision, currentRevision) {
    super("工作区已被其他操作更新，请刷新后合并修改。", 409, "WORKSPACE_REVISION_CONFLICT", {
      expectedRevision,
      currentRevision
    });
    this.name = "WorkspaceConflictError";
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeWorkspaceId(value) {
  const id = String(value || "default").trim();
  if (!id || id.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new WorkspaceStoreError("工作区 ID 格式不正确。", 422, "INVALID_WORKSPACE_ID");
  }
  return id;
}

function resolvePath(object, dottedPath) {
  return String(dottedPath || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], object);
}

function serializeState(state, maxBytes) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new WorkspaceStoreError("工作区状态必须是 JSON 对象。", 422, "INVALID_WORKSPACE_STATE");
  }
  let json;
  try {
    json = JSON.stringify(state);
  } catch {
    throw new WorkspaceStoreError("工作区状态包含不能序列化的数据。", 422, "WORKSPACE_STATE_NOT_SERIALIZABLE");
  }
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > maxBytes) {
    throw new WorkspaceStoreError("工作区状态超过服务端允许的大小。", 413, "WORKSPACE_STATE_TOO_LARGE", { bytes, maxBytes });
  }
  return { json, bytes, checksum: createHash("sha256").update(json, "utf8").digest("hex") };
}

function recordId(item) {
  return String(item?.id ?? item?.key ?? item?.slug ?? "").trim();
}

function recordDisplayName(item) {
  return String(item?.name ?? item?.title ?? item?.question ?? item?.term ?? item?.label ?? "").trim().slice(0, 500) || null;
}

function recordBusinessLineId(item) {
  return String(item?.businessLineId ?? item?.business_line_id ?? "").trim().slice(0, 160) || null;
}

function recordStatus(item) {
  return String(item?.status ?? item?.reviewStatus ?? "").trim().slice(0, 80) || null;
}

function normalizeRecordArrayMap(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : DEFAULT_BUSINESS_RECORD_ARRAYS;
  const entries = Object.entries(source).map(([type, dottedPath]) => [String(type).trim(), String(dottedPath).trim()]);
  if (entries.some(([type, dottedPath]) => !type || type.length > 120 || !dottedPath)) {
    throw new WorkspaceStoreError("业务记录数组映射无效。", 422, "INVALID_RECORD_ARRAY_MAP");
  }
  return entries;
}

function collectBusinessRecords(state, mapping) {
  return mapping.map(([recordType, dottedPath]) => {
    const raw = resolvePath(state, dottedPath);
    const values = raw == null ? [] : raw;
    if (!Array.isArray(values)) {
      throw new WorkspaceStoreError(`工作区字段 ${dottedPath} 应为数组。`, 422, "INVALID_BUSINESS_RECORD_ARRAY", { recordType, dottedPath });
    }
    const seen = new Set();
    const records = values.map((item, ordinal) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new WorkspaceStoreError(`${dottedPath}[${ordinal}] 必须是对象。`, 422, "INVALID_BUSINESS_RECORD");
      }
      const id = recordId(item);
      if (!id || id.length > 240) {
        throw new WorkspaceStoreError(`${dottedPath}[${ordinal}] 缺少有效 id。`, 422, "BUSINESS_RECORD_ID_REQUIRED");
      }
      if (seen.has(id)) {
        throw new WorkspaceStoreError(`${dottedPath} 中存在重复 id：${id}`, 422, "DUPLICATE_BUSINESS_RECORD_ID");
      }
      seen.add(id);
      return {
        recordType,
        id,
        businessLineId: recordBusinessLineId(item),
        status: recordStatus(item),
        displayName: recordDisplayName(item),
        ordinal,
        payloadJson: JSON.stringify(item)
      };
    });
    return { recordType, dottedPath, records };
  });
}

function parseJson(value, code) {
  try {
    return JSON.parse(value);
  } catch {
    throw new WorkspaceStoreError("服务端保存的工作区数据无法解析。", 500, code);
  }
}

export class WorkspaceStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("WorkspaceStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.maxStateBytes = boundedInteger(options.maxStateBytes ?? process.env.TZ_WORKSPACE_MAX_BYTES, 15_000_000, 100_000, 100_000_000);
    this.recordArrayMap = normalizeRecordArrayMap(options.recordArrayMap);
    this.trustProxy = options.trustProxy ?? (String(process.env.TZ_TRUST_PROXY || "").toLowerCase() === "true");
  }

  get(workspaceId = "default") {
    const normalizedId = normalizeWorkspaceId(workspaceId);
    const row = this.connection.prepare("SELECT * FROM workspace_state WHERE workspace_id = ?").get(normalizedId);
    if (!row) {
      return { workspaceId: normalizedId, revision: 0, state: null, checksum: null, createdAt: null, updatedAt: null, updatedBy: null };
    }
    return {
      workspaceId: row.workspace_id,
      revision: Number(row.revision),
      state: parseJson(row.state_json, "WORKSPACE_STATE_CORRUPT"),
      checksum: row.checksum,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null
    };
  }

  save(workspaceIdOrState, stateOrOptions = {}, maybeOptions = {}) {
    const explicitWorkspace = typeof workspaceIdOrState === "string";
    const options = explicitWorkspace ? maybeOptions : stateOrOptions;
    const workspaceId = normalizeWorkspaceId(explicitWorkspace ? workspaceIdOrState : options.workspaceId || "default");
    const state = explicitWorkspace ? stateOrOptions : workspaceIdOrState;
    const expectedRevision = Number(options.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new WorkspaceStoreError("保存工作区时必须提供非负 expectedRevision。", 428, "EXPECTED_REVISION_REQUIRED");
    }
    const serialized = serializeState(state, this.maxStateBytes);
    const mapping = options.recordArrayMap ? normalizeRecordArrayMap(options.recordArrayMap) : this.recordArrayMap;
    const recordGroups = collectBusinessRecords(state, mapping);
    const actorUserId = options.actorUserId || options.actor?.userId || options.actor?.id || null;
    const now = new Date().toISOString();
    let saved;
    this.database.transaction(() => {
      const current = this.connection.prepare("SELECT revision, created_at FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
      const currentRevision = Number(current?.revision || 0);
      if (currentRevision !== expectedRevision) throw new WorkspaceConflictError(expectedRevision, currentRevision);
      const revision = currentRevision + 1;
      if (current) {
        this.connection.prepare(`
          UPDATE workspace_state
          SET revision = ?, state_json = ?, checksum = ?, updated_at = ?, updated_by = ?
          WHERE workspace_id = ?
        `).run(revision, serialized.json, serialized.checksum, now, actorUserId, workspaceId);
      } else {
        this.connection.prepare(`
          INSERT INTO workspace_state (
            workspace_id, revision, state_json, checksum, created_at, updated_at, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(workspaceId, revision, serialized.json, serialized.checksum, now, now, actorUserId);
      }
      this.connection.prepare(`
        INSERT INTO workspace_revisions (
          workspace_id, revision, state_json, checksum, created_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(workspaceId, revision, serialized.json, serialized.checksum, now, actorUserId);

      const existingRows = this.connection.prepare(`
        SELECT record_id, created_at FROM business_records
        WHERE workspace_id = ? AND record_type = ?
      `);
      const removeType = this.connection.prepare("DELETE FROM business_records WHERE workspace_id = ? AND record_type = ?");
      const insertRecord = this.connection.prepare(`
        INSERT INTO business_records (
          workspace_id, record_type, record_id, business_line_id, status, display_name,
          ordinal, payload_json, workspace_revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const group of recordGroups) {
        const createdAtById = new Map(existingRows.all(workspaceId, group.recordType).map((row) => [row.record_id, row.created_at]));
        removeType.run(workspaceId, group.recordType);
        for (const record of group.records) {
          insertRecord.run(
            workspaceId,
            record.recordType,
            record.id,
            record.businessLineId,
            record.status,
            record.displayName,
            record.ordinal,
            record.payloadJson,
            revision,
            createdAtById.get(record.id) || now,
            now
          );
        }
      }
      const recordCounts = Object.fromEntries(recordGroups.map((group) => [group.recordType, group.records.length]));
      // 工作区保存不写入审计日志：版本与操作人已由 workspace_revisions 完整记录，
      // 避免每次浏览器同步都产生一条 workspace.save，刷掉真正的高价值审计操作。
      saved = {
        workspaceId,
        revision,
        state,
        checksum: serialized.checksum,
        createdAt: current?.created_at || now,
        updatedAt: now,
        updatedBy: actorUserId,
        recordCounts
      };
    });
    return saved;
  }

  listRevisions(workspaceId = "default", limit = 50) {
    const normalizedId = normalizeWorkspaceId(workspaceId);
    const normalizedLimit = boundedInteger(limit, 50, 1, 500);
    return this.connection.prepare(`
      SELECT workspace_id, revision, checksum, created_at, updated_by
      FROM workspace_revisions
      WHERE workspace_id = ?
      ORDER BY revision DESC
      LIMIT ?
    `).all(normalizedId, normalizedLimit).map((row) => ({
      workspaceId: row.workspace_id,
      revision: Number(row.revision),
      checksum: row.checksum,
      createdAt: row.created_at,
      updatedBy: row.updated_by || null
    }));
  }

  listBusinessRecords(workspaceId = "default", recordType = "", limit = 1000) {
    const normalizedId = normalizeWorkspaceId(workspaceId);
    const normalizedType = String(recordType || "").trim();
    const normalizedLimit = boundedInteger(limit, 1000, 1, 10_000);
    const rows = normalizedType
      ? this.connection.prepare(`
          SELECT * FROM business_records
          WHERE workspace_id = ? AND record_type = ?
          ORDER BY ordinal ASC LIMIT ?
        `).all(normalizedId, normalizedType, normalizedLimit)
      : this.connection.prepare(`
          SELECT * FROM business_records
          WHERE workspace_id = ?
          ORDER BY record_type ASC, ordinal ASC LIMIT ?
        `).all(normalizedId, normalizedLimit);
    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      recordType: row.record_type,
      recordId: row.record_id,
      businessLineId: row.business_line_id || null,
      status: row.status || null,
      displayName: row.display_name || null,
      ordinal: Number(row.ordinal),
      payload: parseJson(row.payload_json, "BUSINESS_RECORD_CORRUPT"),
      workspaceRevision: Number(row.workspace_revision),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}
