import { randomUUID } from "node:crypto";

const DATA_SOURCES = new Set(["citation_lab", "enterprise_knowledge", "site_operations"]);
const PLATFORMS = new Set(["豆包", "DeepSeek", "千问", "元宝"]);
const DEPTHS = new Set(["quick", "detailed", "custom"]);
const OUTPUT_FORMATS = new Set(["interactive", "markdown", "html"]);

export class AnalysisWorkbenchError extends Error {
  constructor(message, status = 422, code = "ANALYSIS_WORKBENCH_ERROR", details = undefined) {
    super(message);
    this.name = "AnalysisWorkbenchError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${randomUUID()}`; }
function text(value, maximum = 10_000, required = false) {
  const output = String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum);
  if (required && !output) throw new AnalysisWorkbenchError("分析内容不能为空。", 422, "ANALYSIS_INPUT_REQUIRED");
  return output;
}
function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function requestIp(request) { return String(request?.headers?.["x-forwarded-for"] || request?.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 200) || null; }
function requestAgent(request) { return String(request?.headers?.["user-agent"] || "").slice(0, 500) || null; }
function normalizeList(values, allowed, fallback) {
  const source = Array.isArray(values) ? values : [];
  const result = [...new Set(source.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
  return result.length ? result : [...fallback];
}

export class AnalysisWorkbenchStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("AnalysisWorkbenchStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = String(options.workspaceId || "default");
  }

  audit(action, entityType, entityId, details, actor, request) {
    this.connection.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(actorId(actor), action, entityType, entityId || null, JSON.stringify(details || {}), requestIp(request), requestAgent(request), now());
  }

  sessionRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      status: row.status,
      providerId: row.provider_id,
      model: row.model,
      dataSources: parseJson(row.data_sources_json, []),
      platforms: parseJson(row.platforms_json, []),
      reportDepth: row.report_depth,
      outputFormat: row.output_format,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by || null,
      latestRunStatus: row.latest_run_status || null,
      latestRunId: row.latest_run_id || null,
      latestArtifactId: row.latest_artifact_id || null,
      artifactCount: Number(row.artifact_count || 0),
      messageCount: Number(row.message_count || 0)
    };
  }

  messageRow(row) {
    return row ? {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content_text,
      metadata: parseJson(row.metadata_json, {}),
      createdAt: row.created_at,
      createdBy: row.created_by || null
    } : null;
  }

  runRow(row, options = {}) {
    if (!row) return null;
    const result = {
      id: row.id,
      sessionId: row.session_id,
      userMessageId: row.user_message_id || null,
      status: row.status,
      providerId: row.provider_id,
      model: row.model,
      requestSnapshot: parseJson(row.request_snapshot_json, {}),
      plan: parseJson(row.plan_json, []),
      errorCode: row.error_code || null,
      errorMessage: row.error_message || null,
      createdAt: row.created_at,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      createdBy: row.created_by || null
    };
    if (options.includeTools) result.toolCalls = this.listToolCalls(row.id);
    return result;
  }

  toolCallRow(row) {
    return row ? {
      id: row.id,
      runId: row.run_id,
      ordinal: Number(row.ordinal),
      toolName: row.tool_name,
      arguments: parseJson(row.arguments_json, {}),
      status: row.status,
      evidenceId: row.evidence_id,
      result: parseJson(row.result_json, {}),
      errorMessage: row.error_message || null,
      createdAt: row.created_at,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null
    } : null;
  }

  artifactRow(row) {
    return row ? {
      id: row.id,
      sessionId: row.session_id,
      runId: row.run_id,
      version: Number(row.version_number),
      title: row.title,
      status: row.status,
      executiveSummary: row.executive_summary,
      sections: parseJson(row.sections_json, []),
      recommendations: parseJson(row.recommendations_json, []),
      limitations: parseJson(row.limitations_json, []),
      followUpSuggestions: parseJson(row.follow_up_suggestions_json, []),
      methodology: parseJson(row.methodology_json, {}),
      createdAt: row.created_at,
      createdBy: row.created_by || null
    } : null;
  }

  createSession(input = {}, actor = null, request = null, workspaceId = this.workspaceId) {
    const timestamp = now();
    const sessionId = id("ASES");
    const title = text(input.title || input.prompt, 240, true);
    const dataSources = normalizeList(input.dataSources, DATA_SOURCES, ["citation_lab"]);
    const platforms = normalizeList(input.platforms, PLATFORMS, ["豆包", "DeepSeek", "千问", "元宝"]);
    const reportDepth = DEPTHS.has(input.reportDepth) ? input.reportDepth : "detailed";
    const outputFormat = OUTPUT_FORMATS.has(input.outputFormat) ? input.outputFormat : "interactive";
    this.connection.prepare(`INSERT INTO analysis_sessions (id, workspace_id, title, status, provider_id, model, data_sources_json, platforms_json, report_depth, output_format, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(sessionId, workspaceId, title, text(input.providerId, 180), text(input.model, 180), JSON.stringify(dataSources), JSON.stringify(platforms), reportDepth, outputFormat, timestamp, timestamp, actorId(actor), actorId(actor));
    this.audit("analysis.session.create", "analysis_session", sessionId, { dataSources, platforms, reportDepth, outputFormat }, actor, request);
    return this.session(workspaceId, sessionId);
  }

  updateSession(workspaceId, sessionId, patch = {}, actor = null, request = null) {
    const current = this.session(workspaceId, sessionId);
    const dataSources = patch.dataSources ? normalizeList(patch.dataSources, DATA_SOURCES, current.dataSources) : current.dataSources;
    const platforms = patch.platforms ? normalizeList(patch.platforms, PLATFORMS, current.platforms) : current.platforms;
    const reportDepth = DEPTHS.has(patch.reportDepth) ? patch.reportDepth : current.reportDepth;
    const outputFormat = OUTPUT_FORMATS.has(patch.outputFormat) ? patch.outputFormat : current.outputFormat;
    const status = ["active", "archived"].includes(patch.status) ? patch.status : current.status;
    this.connection.prepare(`UPDATE analysis_sessions SET title = ?, status = ?, provider_id = ?, model = ?, data_sources_json = ?, platforms_json = ?, report_depth = ?, output_format = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?`)
      .run(text(patch.title ?? current.title, 240, true), status, text(patch.providerId ?? current.providerId, 180), text(patch.model ?? current.model, 180), JSON.stringify(dataSources), JSON.stringify(platforms), reportDepth, outputFormat, now(), actorId(actor), sessionId, workspaceId);
    this.audit("analysis.session.update", "analysis_session", sessionId, { status, dataSources, platforms, reportDepth }, actor, request);
    return this.session(workspaceId, sessionId);
  }

  listSessions({ workspaceId = this.workspaceId, status = "active", limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const params = [workspaceId];
    let filter = "s.workspace_id = ?";
    if (status) { filter += " AND s.status = ?"; params.push(status); }
    params.push(safeLimit);
    return this.connection.prepare(`
      SELECT s.*,
        (SELECT r.id FROM analysis_runs r WHERE r.session_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS latest_run_id,
        (SELECT r.status FROM analysis_runs r WHERE r.session_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS latest_run_status,
        (SELECT a.id FROM analysis_artifacts a WHERE a.session_id = s.id ORDER BY a.version_number DESC LIMIT 1) AS latest_artifact_id,
        (SELECT COUNT(*) FROM analysis_artifacts a WHERE a.session_id = s.id) AS artifact_count,
        (SELECT COUNT(*) FROM analysis_messages m WHERE m.session_id = s.id) AS message_count
      FROM analysis_sessions s WHERE ${filter}
      ORDER BY s.updated_at DESC LIMIT ?
    `).all(...params).map((row) => this.sessionRow(row));
  }

  session(workspaceId = this.workspaceId, sessionId, options = {}) {
    const row = this.connection.prepare(`
      SELECT s.*,
        (SELECT r.id FROM analysis_runs r WHERE r.session_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS latest_run_id,
        (SELECT r.status FROM analysis_runs r WHERE r.session_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS latest_run_status,
        (SELECT a.id FROM analysis_artifacts a WHERE a.session_id = s.id ORDER BY a.version_number DESC LIMIT 1) AS latest_artifact_id,
        (SELECT COUNT(*) FROM analysis_artifacts a WHERE a.session_id = s.id) AS artifact_count,
        (SELECT COUNT(*) FROM analysis_messages m WHERE m.session_id = s.id) AS message_count
      FROM analysis_sessions s WHERE s.workspace_id = ? AND s.id = ?
    `).get(workspaceId, sessionId);
    if (!row) throw new AnalysisWorkbenchError("分析会话不存在。", 404, "ANALYSIS_SESSION_NOT_FOUND", { sessionId });
    const result = this.sessionRow(row);
    if (options.includeDetails !== false) {
      result.messages = this.listMessages(sessionId);
      result.runs = this.listRuns(sessionId, { includeTools: true });
      result.artifacts = this.listArtifacts(sessionId);
      result.latestArtifact = result.artifacts[0] || null;
    }
    return result;
  }

  addMessage(sessionId, role, content, metadata = {}, actor = null, request = null) {
    const session = this.session(this.workspaceId, sessionId, { includeDetails: false });
    if (session.status !== "active") throw new AnalysisWorkbenchError("分析会话已归档。", 409, "ANALYSIS_SESSION_ARCHIVED");
    if (!new Set(["user", "assistant", "system"]).has(role)) throw new AnalysisWorkbenchError("分析消息角色无效。", 422, "ANALYSIS_MESSAGE_ROLE_INVALID");
    const messageId = id("AMSG"); const timestamp = now();
    this.connection.prepare(`INSERT INTO analysis_messages (id, session_id, role, content_text, metadata_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(messageId, sessionId, role, text(content, 40_000, true), JSON.stringify(metadata || {}), timestamp, actorId(actor));
    this.connection.prepare("UPDATE analysis_sessions SET updated_at = ?, updated_by = ? WHERE id = ?").run(timestamp, actorId(actor), sessionId);
    this.audit("analysis.message.create", "analysis_message", messageId, { sessionId, role }, actor, request);
    return this.messageRow(this.connection.prepare("SELECT * FROM analysis_messages WHERE id = ?").get(messageId));
  }

  listMessages(sessionId, limit = 500) {
    return this.connection.prepare("SELECT * FROM analysis_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?").all(sessionId, Math.max(1, Math.min(1000, Number(limit) || 500))).map((row) => this.messageRow(row));
  }

  createRun(sessionId, userMessageId, input = {}, actor = null, request = null) {
    const session = this.session(this.workspaceId, sessionId, { includeDetails: false });
    const runId = id("ARUN"); const timestamp = now();
    this.connection.prepare(`INSERT INTO analysis_runs (id, session_id, user_message_id, status, provider_id, model, request_snapshot_json, plan_json, created_at, created_by) VALUES (?, ?, ?, 'queued', ?, ?, ?, '[]', ?, ?)`)
      .run(runId, sessionId, userMessageId || null, text(input.providerId || session.providerId, 180), text(input.model || session.model, 180), JSON.stringify(input || {}), timestamp, actorId(actor));
    this.audit("analysis.run.create", "analysis_run", runId, { sessionId, userMessageId }, actor, request);
    return this.run(runId);
  }

  run(runId, options = {}) {
    const row = this.connection.prepare("SELECT * FROM analysis_runs WHERE id = ?").get(runId);
    if (!row) throw new AnalysisWorkbenchError("分析运行不存在。", 404, "ANALYSIS_RUN_NOT_FOUND", { runId });
    return this.runRow(row, options);
  }

  listRuns(sessionId, options = {}) {
    return this.connection.prepare("SELECT * FROM analysis_runs WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").all(sessionId).map((row) => this.runRow(row, options));
  }

  startRun(runId, plan = []) {
    const timestamp = now();
    this.connection.prepare("UPDATE analysis_runs SET status = 'running', plan_json = ?, started_at = ?, error_code = NULL, error_message = NULL WHERE id = ? AND status = 'queued'").run(JSON.stringify(plan || []), timestamp, runId);
    return this.run(runId, { includeTools: true });
  }

  updateRunPlan(runId, plan = []) {
    const current = this.run(runId);
    if (current.status !== "running") throw new AnalysisWorkbenchError("只有运行中的分析任务可以更新研究计划。", 409, "ANALYSIS_RUN_NOT_RUNNING");
    this.connection.prepare("UPDATE analysis_runs SET plan_json = ? WHERE id = ? AND status = 'running'").run(JSON.stringify(plan || []), runId);
    return this.run(runId, { includeTools: true });
  }

  completeRun(runId) {
    const timestamp = now();
    this.connection.prepare("UPDATE analysis_runs SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'running'").run(timestamp, runId);
    const run = this.run(runId, { includeTools: true });
    this.connection.prepare("UPDATE analysis_sessions SET updated_at = ? WHERE id = ?").run(timestamp, run.sessionId);
    return run;
  }

  failRun(runId, error) {
    const timestamp = now();
    const detail = Array.isArray(error?.details) && error.details.length ? ` ${error.details.slice(0, 4).join("；")}` : "";
    this.connection.prepare("UPDATE analysis_runs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ? AND status IN ('queued','running')")
      .run(text(error?.code || "ANALYSIS_RUN_FAILED", 180), text(`${error?.message || "分析任务执行失败。"}${detail}`, 2_000), timestamp, runId);
    const run = this.run(runId, { includeTools: true });
    this.connection.prepare("UPDATE analysis_sessions SET updated_at = ? WHERE id = ?").run(timestamp, run.sessionId);
    return run;
  }

  createToolCall(runId, ordinal, toolName, args = {}) {
    const toolCallId = id("ATC"); const timestamp = now();
    const evidenceId = `AFE-${runId}-${String(ordinal).padStart(2, "0")}`;
    this.connection.prepare(`INSERT INTO analysis_tool_calls (id, run_id, ordinal, tool_name, arguments_json, status, evidence_id, result_json, created_at) VALUES (?, ?, ?, ?, ?, 'running', ?, '{}', ?)`)
      .run(toolCallId, runId, ordinal, text(toolName, 120, true), JSON.stringify(args || {}), evidenceId, timestamp);
    this.connection.prepare("UPDATE analysis_tool_calls SET started_at = ? WHERE id = ?").run(timestamp, toolCallId);
    return this.toolCallRow(this.connection.prepare("SELECT * FROM analysis_tool_calls WHERE id = ?").get(toolCallId));
  }

  completeToolCall(toolCallId, result) {
    this.connection.prepare("UPDATE analysis_tool_calls SET status = 'completed', result_json = ?, completed_at = ? WHERE id = ?").run(JSON.stringify(result ?? {}), now(), toolCallId);
    return this.toolCallRow(this.connection.prepare("SELECT * FROM analysis_tool_calls WHERE id = ?").get(toolCallId));
  }

  failToolCall(toolCallId, error) {
    this.connection.prepare("UPDATE analysis_tool_calls SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?").run(text(error?.message || error, 2_000), now(), toolCallId);
    return this.toolCallRow(this.connection.prepare("SELECT * FROM analysis_tool_calls WHERE id = ?").get(toolCallId));
  }

  listToolCalls(runId) {
    return this.connection.prepare("SELECT * FROM analysis_tool_calls WHERE run_id = ? ORDER BY ordinal ASC").all(runId).map((row) => this.toolCallRow(row));
  }

  createArtifact(runId, report, actor = null, request = null) {
    const run = this.run(runId);
    const artifactId = id("AART"); const timestamp = now();
    let version = 1;
    this.database.transaction(() => {
      version = Number(this.connection.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM analysis_artifacts WHERE session_id = ?").get(run.sessionId)?.version || 1);
      this.connection.prepare("UPDATE analysis_artifacts SET status = 'superseded' WHERE session_id = ? AND status = 'final'").run(run.sessionId);
      this.connection.prepare(`INSERT INTO analysis_artifacts (id, session_id, run_id, version_number, title, status, executive_summary, sections_json, recommendations_json, limitations_json, follow_up_suggestions_json, methodology_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'final', ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(artifactId, run.sessionId, runId, version, text(report.title, 500, true), text(report.executiveSummary, 30_000), JSON.stringify(report.sections || []), JSON.stringify(report.recommendations || []), JSON.stringify(report.limitations || []), JSON.stringify(report.followUpSuggestions || []), JSON.stringify(report.methodology || {}), timestamp, actorId(actor));
    });
    this.audit("analysis.artifact.create", "analysis_artifact", artifactId, { sessionId: run.sessionId, runId, version }, actor, request);
    return this.artifact(artifactId);
  }

  artifact(artifactId) {
    const row = this.connection.prepare("SELECT * FROM analysis_artifacts WHERE id = ?").get(artifactId);
    if (!row) throw new AnalysisWorkbenchError("分析报告不存在。", 404, "ANALYSIS_ARTIFACT_NOT_FOUND", { artifactId });
    return this.artifactRow(row);
  }

  listArtifacts(sessionId) {
    return this.connection.prepare("SELECT * FROM analysis_artifacts WHERE session_id = ? ORDER BY version_number DESC LIMIT 100").all(sessionId).map((row) => this.artifactRow(row));
  }

  deleteSession(workspaceId = this.workspaceId, sessionId, actor = null, request = null) {
    const session = this.session(workspaceId, sessionId, { includeDetails: false });
    const running = this.connection.prepare("SELECT COUNT(*) AS count FROM analysis_runs WHERE session_id = ? AND status IN ('queued', 'running')").get(sessionId);
    if (Number(running?.count || 0) > 0) {
      throw new AnalysisWorkbenchError("分析任务正在运行，完成或失败后才能删除报告。", 409, "ANALYSIS_SESSION_BUSY", { sessionId });
    }
    const counts = {
      artifacts: Number(this.connection.prepare("SELECT COUNT(*) AS count FROM analysis_artifacts WHERE session_id = ?").get(sessionId)?.count || 0),
      runs: Number(this.connection.prepare("SELECT COUNT(*) AS count FROM analysis_runs WHERE session_id = ?").get(sessionId)?.count || 0),
      messages: Number(this.connection.prepare("SELECT COUNT(*) AS count FROM analysis_messages WHERE session_id = ?").get(sessionId)?.count || 0)
    };
    this.database.transaction(() => {
      this.connection.prepare("DELETE FROM analysis_sessions WHERE id = ? AND workspace_id = ?").run(sessionId, workspaceId);
    });
    this.audit("analysis.session.delete", "analysis_session", sessionId, { title: session.title, ...counts }, actor, request);
    return { sessionId, title: session.title, deleted: true, ...counts };
  }
}

export const ANALYSIS_WORKBENCH_OPTIONS = Object.freeze({
  dataSources: [...DATA_SOURCES],
  platforms: [...PLATFORMS],
  reportDepths: [...DEPTHS],
  outputFormats: [...OUTPUT_FORMATS]
});

export default AnalysisWorkbenchStore;
