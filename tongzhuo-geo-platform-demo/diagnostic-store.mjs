import crypto from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const PROJECT_TYPES = new Set(["industry_strategy", "source_ecosystem", "site_content", "comprehensive"]);
const EVIDENCE_TYPES = new Set(["research", "enterprise", "live"]);
const DATA_ORIGINS = new Set(["research_baseline", "enterprise_measured", "realtime_sampling", "mock_demo"]);
const REPORT_STATUSES = new Set(["draft", "final"]);
const RECOMMENDATION_CATEGORIES = new Set(["question_map", "source_ecosystem", "knowledge_gap", "site_cms", "content_plan", "publishing"]);
const ACTION_TYPES = new Set(["question_library_candidate", "knowledge_gap", "topic_candidate", "content_plan", "cms_task", "publishing_strategy"]);

export const DIAGNOSTIC_EVIDENCE_TYPES = Object.freeze(["research", "enterprise", "live"]);
export const DIAGNOSTIC_DATA_ORIGINS = Object.freeze(["research_baseline", "enterprise_measured", "realtime_sampling", "mock_demo"]);

export const CITATION_LAB_RESEARCH_PACKAGE = Object.freeze({
  id: "RP-CITATION-LAB-CN-GEO-2.0.1",
  packageKey: "yaojingang/geo-citation-lab:cn-geo-citation-dataset",
  name: "GEO Citation Lab — CN-GEO Citation Dataset",
  datasetVersion: "2.0.1",
  sourceRepository: "yaojingang/geo-citation-lab",
  sourceUrl: "https://github.com/yaojingang/geo-citation-lab/tree/main/03-cn-geo-citation-dataset",
  releasedAt: "2026-07-14",
  sourceCommit: null,
  checksumSha256: null,
  installState: "metadata_only",
  verificationStatus: "metadata_only",
  statistics: {
    citationRecords: 214119,
    canonicalQuestions: 620,
    platformsAndTerminals: 12,
    canonicalSources: 9878,
    pages: 107659,
    overseasExperiment: { prompts: 602, validCitations: 21143, citationFeatures: 23745, featureDimensions: 72 }
  },
  coverage: {
    dataset: "CN-GEO citation research baseline",
    role: "historical_research_baseline",
    rawDataBundled: false,
    supportsCurrentBrandRanking: false,
    supportsRealtimeCitationMonitoring: false
  },
  limitations: [
    "The package is a historical research baseline, not a live AI-platform monitoring feed.",
    "Complete answer text, reliable response identifiers, model versions and uniform collection timestamps are unavailable.",
    "responses.parquet is currently empty; current brand ranking, recommendation rate, sentiment and strict citation position cannot be derived from this package alone.",
    "This installation records verified upstream metadata only; raw DuckDB, Parquet and JSONL assets are not bundled in phase one."
  ],
  license: {
    code: "MIT",
    originalReportsAndContent: "CC BY 4.0",
    thirdPartyMaterials: "Retain original licences",
    attributionRequired: true
  },
  manifest: {
    schemaVersion: 1,
    upstreamManifest: "https://github.com/yaojingang/geo-citation-lab/blob/main/deploy/manifest.json",
    deploymentMode: "metadata_only",
    immutableReference: true
  }
});

export class DiagnosticError extends Error {
  constructor(message, status = 422, code = "DIAGNOSTIC_ERROR", details = undefined) {
    super(message);
    this.name = "DiagnosticError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class DiagnosticNotFoundError extends DiagnosticError {
  constructor(message = "Diagnostic record not found.", details) { super(message, 404, "DIAGNOSTIC_NOT_FOUND", details); }
}

export class DiagnosticConflictError extends DiagnosticError {
  constructor(message = "The diagnostic record has changed.", details) { super(message, 409, "DIAGNOSTIC_CONFLICT", details); }
}

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function hash(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value), "utf8").digest("hex"); }
function parseJson(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed === null || parsed === undefined) return fallback;
    return typeof parsed === "object" ? parsed : fallback;
  } catch { return fallback; }
}
function parseJsonAny(value, fallback = null) {
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return fallback; }
}
function jsonText(value, fallback = {}) { return JSON.stringify(parseJson(value, fallback)); }
function stringValue(value, field, max = 500, required = false) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !result) throw new DiagnosticError(`${field} is required.`, 422, "DIAGNOSTIC_INVALID_INPUT", { field });
  if (result.length > max) throw new DiagnosticError(`${field} exceeds ${max} characters.`, 422, "DIAGNOSTIC_INVALID_INPUT", { field, max });
  return result;
}
function enumValue(value, values, field, fallback = "") {
  const normalized = String(value || fallback).trim();
  if (!values.has(normalized)) throw new DiagnosticError(`Invalid ${field}.`, 422, "DIAGNOSTIC_INVALID_INPUT", { field, value });
  return normalized;
}
function positiveLimit(value, fallback = 100, max = 1000) { return Math.max(1, Math.min(max, Number(value) || fallback)); }
function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function relayLiveEvidenceItem(item) {
  const payload = parseJson(item.payload, {});
  const delivery = parseJson(payload.delivery, {});
  const normalized = parseJson(delivery.normalized, {});
  const request = parseJson(payload.request, {});
  const provenance = parseJson(item.provenance, {});
  const quotes = Array.isArray(normalized.quotes)
    ? normalized.quotes.slice(0, 50).map((quote) => ({
      url: String(quote?.url || quote?.link || "").trim(),
      title: String(quote?.title || "").trim(),
      siteName: String(quote?.siteName || quote?.site_name || "").trim()
    })).filter((quote) => quote.url || quote.title || quote.siteName)
    : [];
  return {
    evidenceId: item.id,
    observedAt: item.observedAt,
    platform: String(provenance.platform || "unknown").trim(),
    terminal: String(provenance.terminal || "web").trim(),
    mode: String(provenance.mode || "fast").trim(),
    questionId: String(provenance.questionId || request.questionId || "").trim(),
    question: String(request.prompt || request.question || "").trim(),
    answer: String(item.excerpt || item.claim || normalized.answerText || "").trim(),
    brandMentioned: typeof normalized.brandMentioned === "boolean" ? normalized.brandMentioned : null,
    brandMentionCount: Number.isFinite(Number(normalized.brandMentionCount)) ? Number(normalized.brandMentionCount) : null,
    quoteCount: Number.isFinite(Number(normalized.quoteCount)) ? Number(normalized.quoteCount) : quotes.length,
    uniqueDomainCount: Number.isFinite(Number(normalized.uniqueDomainCount)) ? Number(normalized.uniqueDomainCount) : null,
    quotes
  };
}
function relayLiveSummary(project, run, evidence, relayStatus = "") {
  const samples = evidence.map(relayLiveEvidenceItem);
  const groups = new Map();
  for (const sample of samples) {
    const key = [sample.platform, sample.terminal, sample.mode].join("/");
    const current = groups.get(key) || {
      platform: sample.platform,
      terminal: sample.terminal,
      mode: sample.mode,
      sampleCount: 0,
      brandMentionedCount: 0,
      mentionObservations: 0,
      quoteCount: 0,
      citationObservations: 0
    };
    current.sampleCount += 1;
    if (sample.brandMentioned !== null) {
      current.mentionObservations += 1;
      if (sample.brandMentioned) current.brandMentionedCount += 1;
    }
    current.quoteCount += Math.max(0, finiteNumber(sample.quoteCount, 0));
    if (finiteNumber(sample.quoteCount, 0) > 0) current.citationObservations += 1;
    groups.set(key, current);
  }
  const byPlatform = [...groups.values()].map((item) => ({
    ...item,
    brandMentionRate: item.mentionObservations ? Number((item.brandMentionedCount / item.mentionObservations * 100).toFixed(2)) : null,
    citationRate: item.sampleCount ? Number((item.citationObservations / item.sampleCount * 100).toFixed(2)) : null,
    averageQuoteCount: item.sampleCount ? Number((item.quoteCount / item.sampleCount).toFixed(2)) : 0
  }));
  const mentionObservations = samples.filter((sample) => sample.brandMentioned !== null);
  const citationObservations = samples.filter((sample) => finiteNumber(sample.quoteCount, 0) > 0);
  const questionIds = new Set(samples.map((sample) => sample.questionId).filter(Boolean));
  const overallMentionRate = mentionObservations.length
    ? Number((mentionObservations.filter((sample) => sample.brandMentioned).length / mentionObservations.length * 100).toFixed(2))
    : null;
  const overallCitationRate = samples.length
    ? Number((citationObservations.length / samples.length * 100).toFixed(2))
    : null;
  return {
    projectId: project.id,
    runId: run.id,
    targetBrand: project.targetBrand || project.name,
    relayStatus: String(relayStatus || "completed").trim(),
    verifiedLiveEvidenceCount: samples.length,
    questionCount: questionIds.size,
    platformCount: byPlatform.length,
    brandMentionRate: overallMentionRate,
    citationRate: overallCitationRate,
    byPlatform,
    generatedAt: now()
  };
}
function optionalUrl(value, field = "url") {
  const result = stringValue(value, field, 2000);
  if (!result) return "";
  let parsed;
  try { parsed = new URL(result); } catch { throw new DiagnosticError(`${field} must be a valid URL.`, 422, "DIAGNOSTIC_INVALID_INPUT", { field }); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new DiagnosticError(`${field} must use HTTP or HTTPS.`, 422, "DIAGNOSTIC_INVALID_INPUT", { field });
  return parsed.toString();
}
function checkRevision(expectedRevision, actual, entityId) {
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected)) throw new DiagnosticConflictError("expectedRevision is required.", { entityId, actualRevision: Number(actual) });
  if (expected !== Number(actual)) throw new DiagnosticConflictError("The diagnostic project is stale; reload before saving.", { entityId, expectedRevision: expected, actualRevision: Number(actual) });
}
function normalizeQuestions(input) {
  if (!Array.isArray(input)) throw new DiagnosticError("questions must be an array.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "questions" });
  if (input.length > 500) throw new DiagnosticError("A question set cannot contain more than 500 questions.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "questions", max: 500 });
  const seen = new Set();
  return input.map((item, index) => {
    const source = typeof item === "string" ? { text: item } : parseJson(item, {});
    const text = stringValue(source.text || source.question || source.title, `questions[${index}].text`, 1000, true);
    const normalized = text.toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
    if (seen.has(normalized)) throw new DiagnosticError("Question set contains duplicate questions.", 422, "DIAGNOSTIC_DUPLICATE_QUESTION", { index, text });
    seen.add(normalized);
    return {
      id: stringValue(source.id || `Q-${index + 1}`, `questions[${index}].id`, 180, true),
      text,
      intent: stringValue(source.intent, `questions[${index}].intent`, 300),
      category: stringValue(source.category, `questions[${index}].category`, 200),
      tags: Array.isArray(source.tags) ? source.tags.slice(0, 20).map((tag) => stringValue(tag, "question tag", 100)).filter(Boolean) : []
    };
  });
}
function unsupportedRealtimeClaims(value, path = "$") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...unsupportedRealtimeClaims(item, `${path}[${index}]`)));
    return findings;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z0-9\u4e00-\u9fff]/gi, "").toLowerCase();
      const liveMetricKey = /(?:current|realtime|live)(?:brand)?rank|currentranking|(?:current|realtime|live)(?:recommendation|citation|mention)rate|(?:当前|实时|最新)(?:品牌)?排名|(?:当前|实时|最新)(?:推荐率|引用率|提及率)/i.test(normalizedKey);
      const hasClaimedValue = item !== null && item !== undefined && item !== "" && !["not_available", "unavailable", "unknown"].includes(String(item).toLowerCase());
      if (liveMetricKey && hasClaimedValue) findings.push(`${path}.${key}`);
      findings.push(...unsupportedRealtimeClaims(item, `${path}.${key}`));
    }
    return findings;
  }
  if (typeof value === "string") {
    const affirmative = [
      /(?:当前|实时|最新).{0,18}(?:品牌)?排名\s*(?:为|是|[:：])?\s*(?:第\s*)?(?:\d+|[一二三四五六七八九十百千万]+)(?:名|位|名次)?/i,
      /(?:当前|实时|最新).{0,18}(?:推荐率|引用率|提及率)\s*(?:为|是|[:：])?\s*\d+(?:\.\d+)?\s*%?/i,
      /(?:current|real[- ]?time|latest).{0,24}(?:brand )?rank(?:ing)?\s*(?:is|=|:)?\s*#?\d+/i,
      /(?:current|real[- ]?time|latest).{0,24}(?:recommendation|citation|mention) rate\s*(?:is|=|:)?\s*\d+(?:\.\d+)?\s*%?/i
    ];
    if (affirmative.some((pattern) => pattern.test(value))) findings.push(path);
  }
  return findings;
}

export class DiagnosticStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("DiagnosticStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.workspaceId = String(options.workspaceId || DEFAULT_WORKSPACE_ID);
    this.ensureBuiltinResearchPackage(this.workspaceId);
  }

  ensureBuiltinResearchPackage(workspaceId = this.workspaceId) {
    const item = CITATION_LAB_RESEARCH_PACKAGE;
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`
        INSERT OR IGNORE INTO research_packages (
          id, workspace_id, package_key, name, dataset_version, source_repository, source_url,
          released_at, source_commit, checksum_sha256, install_state, verification_status,
          is_active, is_immutable, statistics_json, coverage_json, limitations_json,
          license_json, manifest_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id, workspaceId, item.packageKey, item.name, item.datasetVersion, item.sourceRepository,
        item.sourceUrl, item.releasedAt, item.sourceCommit, item.checksumSha256, item.installState,
        item.verificationStatus, JSON.stringify(item.statistics), JSON.stringify(item.coverage),
        JSON.stringify(item.limitations), JSON.stringify(item.license), JSON.stringify(item.manifest),
        timestamp, timestamp
      );
    });
    return this.researchPackage(workspaceId, item.id);
  }

  researchPackageRow(row) {
    if (!row) return null;
    return {
      id: row.id, workspaceId: row.workspace_id, packageKey: row.package_key, name: row.name,
      datasetVersion: row.dataset_version, sourceRepository: row.source_repository, sourceUrl: row.source_url,
      releasedAt: row.released_at || null, sourceCommit: row.source_commit || null, checksumSha256: row.checksum_sha256 || null,
      installState: row.install_state, verificationStatus: row.verification_status,
      active: Boolean(row.is_active), immutable: Boolean(row.is_immutable),
      statistics: parseJson(row.statistics_json), coverage: parseJson(row.coverage_json),
      limitations: parseJson(row.limitations_json, []), license: parseJson(row.license_json), manifest: parseJson(row.manifest_json),
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  listResearchPackages({ workspaceId = this.workspaceId, includeRetired = false } = {}) {
    let sql = "SELECT * FROM research_packages WHERE workspace_id = ?";
    if (!includeRetired) sql += " AND install_state <> 'retired'";
    sql += " ORDER BY is_active DESC, released_at DESC, created_at DESC";
    return this.connection.prepare(sql).all(workspaceId).map((row) => this.researchPackageRow(row));
  }

  researchPackage(workspaceId = this.workspaceId, packageId) {
    const row = this.connection.prepare("SELECT * FROM research_packages WHERE workspace_id = ? AND id = ?").get(workspaceId, packageId);
    if (!row) throw new DiagnosticNotFoundError("Research package not found.", { packageId });
    return this.researchPackageRow(row);
  }

  activeResearchPackage(workspaceId = this.workspaceId) {
    const row = this.connection.prepare("SELECT * FROM research_packages WHERE workspace_id = ? AND is_active = 1 AND install_state <> 'retired' ORDER BY released_at DESC LIMIT 1").get(workspaceId);
    if (!row) throw new DiagnosticNotFoundError("No active research package is configured.");
    return this.researchPackageRow(row);
  }

  updateResearchPackageInstallation({
    workspaceId = this.workspaceId,
    packageId = CITATION_LAB_RESEARCH_PACKAGE.id,
    installState,
    verificationStatus,
    sourceCommit,
    checksumSha256,
    statistics,
    coverage,
    limitations,
    manifest
  } = {}) {
    const current = this.researchPackage(workspaceId, packageId);
    const nextInstallState = installState || current.installState;
    const nextVerification = verificationStatus || current.verificationStatus;
    if (!["metadata_only", "staged", "ready", "failed", "retired"].includes(nextInstallState)) {
      throw new DiagnosticError("Invalid research package installState.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "installState" });
    }
    if (!["metadata_only", "unverified", "verified"].includes(nextVerification)) {
      throw new DiagnosticError("Invalid research package verificationStatus.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "verificationStatus" });
    }
    const timestamp = now();
    this.connection.prepare(`UPDATE research_packages SET
      source_commit = ?, checksum_sha256 = ?, install_state = ?, verification_status = ?,
      statistics_json = ?, coverage_json = ?, limitations_json = ?, manifest_json = ?, updated_at = ?
      WHERE workspace_id = ? AND id = ?`).run(
      sourceCommit === undefined ? current.sourceCommit : stringValue(sourceCommit, "sourceCommit", 100),
      checksumSha256 === undefined ? current.checksumSha256 : stringValue(checksumSha256, "checksumSha256", 128),
      nextInstallState,
      nextVerification,
      JSON.stringify(statistics === undefined ? current.statistics : parseJson(statistics, {})),
      JSON.stringify(coverage === undefined ? current.coverage : parseJson(coverage, {})),
      JSON.stringify(limitations === undefined ? current.limitations : (Array.isArray(limitations) ? limitations : [])),
      JSON.stringify(manifest === undefined ? current.manifest : parseJson(manifest, {})),
      timestamp,
      workspaceId,
      packageId
    );
    return this.researchPackage(workspaceId, packageId);
  }

  projectRow(row) {
    if (!row) return null;
    const counters = this.connection.prepare(`
      SELECT
        COALESCE((SELECT json_array_length(questions_json) FROM diagnostic_question_sets WHERE project_id = ? ORDER BY version_number DESC LIMIT 1), 0) AS question_count,
        (SELECT COUNT(*) FROM diagnostic_reports WHERE project_id = ?) AS report_count,
        (SELECT COUNT(*) FROM diagnostic_actions WHERE project_id = ? AND status IN ('proposed', 'accepted', 'failed')) AS pending_action_count
    `).get(row.id, row.id, row.id);
    return {
      id: row.id, workspaceId: row.workspace_id, name: row.name, diagnosticType: row.diagnostic_type,
      industry: row.industry, targetBrand: row.target_brand, websiteUrl: row.website_url, region: row.region,
      businessLineId: row.business_line_id || null, objective: row.objective, scope: parseJson(row.scope_json),
      researchPackageId: row.research_package_id || null, status: row.status, revision: Number(row.revision),
      questionCount: Number(counters?.question_count || 0), reportCount: Number(counters?.report_count || 0), pendingActionCount: Number(counters?.pending_action_count || 0),
      createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by || null, updatedBy: row.updated_by || null
    };
  }

  createProject({ workspaceId = this.workspaceId, id: requestedId, name, diagnosticType = "comprehensive", industry = "", targetBrand = "", websiteUrl = "", region = "", businessLineId = null, objective = "", scope = {}, researchPackageId = null, actor = null, request = null } = {}) {
    const projectId = stringValue(requestedId || id("DP"), "project id", 180, true);
    const packageId = researchPackageId || this.activeResearchPackage(workspaceId).id;
    this.researchPackage(workspaceId, packageId);
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_projects (
        id, workspace_id, name, diagnostic_type, industry, target_brand, website_url, region,
        business_line_id, objective, scope_json, research_package_id, status, revision,
        created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`
      ).run(
        projectId, workspaceId, stringValue(name, "project name", 300, true), enumValue(diagnosticType, PROJECT_TYPES, "diagnosticType"),
        stringValue(industry, "industry", 300), stringValue(targetBrand, "targetBrand", 300), optionalUrl(websiteUrl, "websiteUrl"),
        stringValue(region, "region", 200), stringValue(businessLineId, "businessLineId", 180) || null,
        stringValue(objective, "objective", 4000), jsonText(scope), packageId, timestamp, timestamp, actorId(actor), actorId(actor)
      );
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.project.create", entityType: "diagnostic_project", entityId: projectId, details: { workspaceId, packageId }, request, createdAt: timestamp });
    });
    return this.project(workspaceId, projectId);
  }

  project(workspaceId = this.workspaceId, projectId) {
    const row = this.connection.prepare("SELECT * FROM diagnostic_projects WHERE workspace_id = ? AND id = ?").get(workspaceId, projectId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic project not found.", { projectId });
    return this.projectRow(row);
  }

  listProjects({ workspaceId = this.workspaceId, status = "", diagnosticType = "", businessLineId = "", limit = 100, includeArchived = false } = {}) {
    const params = [workspaceId];
    let sql = "SELECT * FROM diagnostic_projects WHERE workspace_id = ?";
    if (!includeArchived) sql += " AND status <> 'archived'";
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (diagnosticType) { sql += " AND diagnostic_type = ?"; params.push(diagnosticType); }
    if (businessLineId) { sql += " AND business_line_id = ?"; params.push(businessLineId); }
    sql += " ORDER BY updated_at DESC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.projectRow(row));
  }

  updateProject({ workspaceId = this.workspaceId, projectId, expectedRevision, patch = {}, actor = null, request = null } = {}) {
    const current = this.project(workspaceId, projectId);
    checkRevision(expectedRevision, current.revision, projectId);
    const values = {
      name: patch.name === undefined ? current.name : stringValue(patch.name, "project name", 300, true),
      diagnosticType: patch.diagnosticType === undefined ? current.diagnosticType : enumValue(patch.diagnosticType, PROJECT_TYPES, "diagnosticType"),
      industry: patch.industry === undefined ? current.industry : stringValue(patch.industry, "industry", 300),
      targetBrand: patch.targetBrand === undefined ? current.targetBrand : stringValue(patch.targetBrand, "targetBrand", 300),
      websiteUrl: patch.websiteUrl === undefined ? current.websiteUrl : optionalUrl(patch.websiteUrl, "websiteUrl"),
      region: patch.region === undefined ? current.region : stringValue(patch.region, "region", 200),
      businessLineId: patch.businessLineId === undefined ? current.businessLineId : stringValue(patch.businessLineId, "businessLineId", 180) || null,
      objective: patch.objective === undefined ? current.objective : stringValue(patch.objective, "objective", 4000),
      scope: patch.scope === undefined ? current.scope : parseJson(patch.scope, {}),
      status: patch.status === undefined ? current.status : enumValue(patch.status, new Set(["draft", "active", "completed", "archived"]), "project status")
    };
    if (patch.researchPackageId && patch.researchPackageId !== current.researchPackageId) this.researchPackage(workspaceId, patch.researchPackageId);
    const packageId = patch.researchPackageId || current.researchPackageId;
    const timestamp = now();
    this.database.transaction(() => {
      const result = this.connection.prepare(`UPDATE diagnostic_projects SET name = ?, diagnostic_type = ?, industry = ?, target_brand = ?, website_url = ?, region = ?, business_line_id = ?, objective = ?, scope_json = ?, research_package_id = ?, status = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND id = ? AND revision = ?`).run(
        values.name, values.diagnosticType, values.industry, values.targetBrand, values.websiteUrl, values.region, values.businessLineId,
        values.objective, JSON.stringify(values.scope), packageId, values.status, timestamp, actorId(actor), workspaceId, projectId, current.revision
      );
      if (!result.changes) throw new DiagnosticConflictError("The diagnostic project was changed concurrently.", { projectId });
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.project.update", entityType: "diagnostic_project", entityId: projectId, details: { workspaceId, revision: current.revision + 1 }, request, createdAt: timestamp });
    });
    return this.project(workspaceId, projectId);
  }

  questionSetRow(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id, version: Number(row.version_number), name: row.name,
      status: row.status, questions: parseJson(row.questions_json, []), checksum: row.checksum,
      createdAt: row.created_at, updatedAt: row.updated_at, frozenAt: row.frozen_at || null,
      createdBy: row.created_by || null, frozenBy: row.frozen_by || null
    };
  }

  createQuestionSet({ workspaceId = this.workspaceId, projectId, id: requestedId, name = "", questions = [], actor = null, request = null } = {}) {
    this.project(workspaceId, projectId);
    const normalized = normalizeQuestions(questions);
    const questionSetId = stringValue(requestedId || id("DQS"), "question set id", 180, true);
    const timestamp = now();
    let version;
    this.database.transaction(() => {
      version = Number(this.connection.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM diagnostic_question_sets WHERE project_id = ?").get(projectId)?.version || 1);
      this.connection.prepare(`INSERT INTO diagnostic_question_sets (id, project_id, version_number, name, status, questions_json, checksum, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
      ).run(questionSetId, projectId, version, stringValue(name, "question set name", 300), JSON.stringify(normalized), hash(normalized), timestamp, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.question_set.create", entityType: "diagnostic_question_set", entityId: questionSetId, details: { projectId, version, questionCount: normalized.length }, request, createdAt: timestamp });
    });
    return this.questionSet(workspaceId, questionSetId);
  }

  questionSet(workspaceId = this.workspaceId, questionSetId) {
    const row = this.connection.prepare(`SELECT q.* FROM diagnostic_question_sets q JOIN diagnostic_projects p ON p.id = q.project_id WHERE p.workspace_id = ? AND q.id = ?`).get(workspaceId, questionSetId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic question set not found.", { questionSetId });
    return this.questionSetRow(row);
  }

  listQuestionSets({ workspaceId = this.workspaceId, projectId, limit = 100 } = {}) {
    this.project(workspaceId, projectId);
    return this.connection.prepare("SELECT * FROM diagnostic_question_sets WHERE project_id = ? ORDER BY version_number DESC LIMIT ?").all(projectId, positiveLimit(limit)).map((row) => this.questionSetRow(row));
  }

  freezeQuestionSet({ workspaceId = this.workspaceId, questionSetId, actor = null, request = null } = {}) {
    const current = this.questionSet(workspaceId, questionSetId);
    if (current.status === "frozen") return current;
    if (current.status !== "draft") throw new DiagnosticConflictError("Only a draft question set can be frozen.", { questionSetId, status: current.status });
    if (!current.questions.length) throw new DiagnosticError("A question set must contain at least one question before it is frozen.", 422, "DIAGNOSTIC_QUESTION_SET_EMPTY");
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE diagnostic_question_sets SET status = 'superseded', updated_at = ? WHERE project_id = ? AND status = 'frozen'").run(timestamp, current.projectId);
      this.connection.prepare("UPDATE diagnostic_question_sets SET status = 'frozen', frozen_at = ?, frozen_by = ?, updated_at = ? WHERE id = ? AND status = 'draft'").run(timestamp, actorId(actor), timestamp, questionSetId);
      this.connection.prepare("UPDATE diagnostic_projects SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END, revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ?").run(timestamp, actorId(actor), current.projectId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.question_set.freeze", entityType: "diagnostic_question_set", entityId: questionSetId, details: { projectId: current.projectId, version: current.version, checksum: current.checksum }, request, createdAt: timestamp });
    });
    return this.questionSet(workspaceId, questionSetId);
  }

  latestFrozenQuestionSet(workspaceId = this.workspaceId, projectId) {
    const row = this.connection.prepare(`SELECT q.* FROM diagnostic_question_sets q JOIN diagnostic_projects p ON p.id = q.project_id WHERE p.workspace_id = ? AND q.project_id = ? AND q.status = 'frozen' ORDER BY q.version_number DESC LIMIT 1`).get(workspaceId, projectId);
    if (!row) throw new DiagnosticError("Freeze a question set before starting a diagnostic run.", 422, "DIAGNOSTIC_QUESTION_SET_REQUIRED", { projectId });
    return this.questionSetRow(row);
  }

  runRow(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id, questionSetId: row.question_set_id,
      researchPackageId: row.research_package_id || null, status: row.status,
      inputSnapshot: parseJson(row.input_snapshot_json), evidenceScope: parseJson(row.evidence_scope_json),
      evidenceSummary: parseJson(row.evidence_summary_json), errorCode: row.error_code || null, errorMessage: row.error_message || null,
      createdAt: row.created_at, startedAt: row.started_at || null, completedAt: row.completed_at || null, createdBy: row.created_by || null
    };
  }

  createRun({ workspaceId = this.workspaceId, projectId, questionSetId = null, researchPackageId = null, evidenceScope = {}, input = {}, allowSupersededQuestionSet = false, actor = null, request = null } = {}) {
    const project = this.project(workspaceId, projectId);
    if (project.status === "archived") throw new DiagnosticConflictError("An archived project cannot start a diagnostic run.", { projectId });
    const questions = questionSetId ? this.questionSet(workspaceId, questionSetId) : this.latestFrozenQuestionSet(workspaceId, projectId);
    if (questions.projectId !== projectId || (questions.status !== "frozen" && !(allowSupersededQuestionSet === true && questions.status === "superseded"))) throw new DiagnosticError("The selected question set must be the frozen set for this project.", 422, "DIAGNOSTIC_QUESTION_SET_INVALID");
    const research = this.researchPackage(workspaceId, researchPackageId || project.researchPackageId || this.activeResearchPackage(workspaceId).id);
    const runId = id("DRUN"); const timestamp = now();
    const snapshot = {
      project: { id: project.id, revision: project.revision, name: project.name, diagnosticType: project.diagnosticType, industry: project.industry, targetBrand: project.targetBrand, websiteUrl: project.websiteUrl, businessLineId: project.businessLineId, objective: project.objective, scope: project.scope },
      questionSet: { id: questions.id, version: questions.version, checksum: questions.checksum, questions: questions.questions },
      researchPackage: { id: research.id, datasetVersion: research.datasetVersion, sourceRepository: research.sourceRepository, releasedAt: research.releasedAt, installState: research.installState, verificationStatus: research.verificationStatus },
      input: parseJson(input, {})
    };
    const scope = { research: true, enterprise: Boolean(evidenceScope.enterprise), live: Boolean(evidenceScope.live), ...parseJson(evidenceScope, {}) };
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_runs (id, project_id, question_set_id, research_package_id, status, input_snapshot_json, evidence_scope_json, evidence_summary_json, created_at, created_by) VALUES (?, ?, ?, ?, 'queued', ?, ?, '{}', ?, ?)`
      ).run(runId, projectId, questions.id, research.id, JSON.stringify(snapshot), JSON.stringify(scope), timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.run.create", entityType: "diagnostic_run", entityId: runId, details: { projectId, questionSetId: questions.id, researchPackageId: research.id }, request, createdAt: timestamp });
    });
    return this.run(workspaceId, runId);
  }

  run(workspaceId = this.workspaceId, runId, options = {}) {
    const row = this.connection.prepare(`SELECT r.* FROM diagnostic_runs r JOIN diagnostic_projects p ON p.id = r.project_id WHERE p.workspace_id = ? AND r.id = ?`).get(workspaceId, runId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic run not found.", { runId });
    const result = this.runRow(row);
    if (options.includeEvidence) result.evidence = this.listEvidence({ workspaceId, runId, limit: 1000 });
    if (options.includeMetrics) result.metrics = this.listMetrics({ workspaceId, runId, limit: 1000 });
    return result;
  }

  listRuns({ workspaceId = this.workspaceId, projectId, status = "", limit = 100 } = {}) {
    this.project(workspaceId, projectId);
    const params = [projectId]; let sql = "SELECT * FROM diagnostic_runs WHERE project_id = ?";
    if (status) { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY created_at DESC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.runRow(row));
  }

  startRun({ workspaceId = this.workspaceId, runId, actor = null, request = null } = {}) {
    const run = this.run(workspaceId, runId);
    if (run.status === "running") return run;
    if (run.status !== "queued") throw new DiagnosticConflictError("Only a queued diagnostic run can be started.", { runId, status: run.status });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE diagnostic_runs SET status = 'running', started_at = ? WHERE id = ? AND status = 'queued'").run(timestamp, runId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.run.start", entityType: "diagnostic_run", entityId: runId, details: { projectId: run.projectId }, request, createdAt: timestamp });
    });
    return this.run(workspaceId, runId);
  }

  evidenceRow(row) {
    if (!row) return null;
    const provenance = parseJson(row.provenance_json);
    const payload = parseJson(row.payload_json);
    const dataOrigin = DATA_ORIGINS.has(payload.dataOrigin) ? payload.dataOrigin : DATA_ORIGINS.has(provenance.dataOrigin) ? provenance.dataOrigin : row.evidence_type === "research" ? "research_baseline" : row.evidence_type === "enterprise" ? "enterprise_measured" : "realtime_sampling";
    return {
      id: row.id, runId: row.run_id, evidenceType: row.evidence_type, sourceKind: row.source_kind,
      sourceId: row.source_id, title: row.title, sourceUrl: row.source_url, claim: row.claim, excerpt: row.excerpt,
      verificationStatus: row.verification_status, observedAt: row.observed_at || null,
      dataOrigin, provenance, payload, createdAt: row.created_at, createdBy: row.created_by || null
    };
  }

  addEvidence({ workspaceId = this.workspaceId, runId, id: requestedId, evidenceType, sourceKind, sourceId = "", title, sourceUrl = "", claim = "", excerpt = "", verificationStatus = "supplied", observedAt = null, provenance = {}, payload = {}, actor = null, request = null } = {}) {
    const evidenceId = stringValue(requestedId || id("DEV"), "evidence id", 180, true);
    const existing = this.connection.prepare(`SELECT e.* FROM diagnostic_evidence e JOIN diagnostic_runs r ON r.id = e.run_id JOIN diagnostic_projects p ON p.id = r.project_id WHERE p.workspace_id = ? AND e.id = ?`).get(workspaceId, evidenceId);
    if (existing) return this.evidenceRow(existing);
    const run = this.run(workspaceId, runId);
    const type = enumValue(evidenceType, EVIDENCE_TYPES, "evidenceType");
    const verification = enumValue(verificationStatus, new Set(["supplied", "verified", "rejected", "not_available"]), "verificationStatus", "supplied");
    const observed = observedAt ? new Date(observedAt).toISOString() : null;
    const normalizedProvenance = parseJson(provenance, {});
    const normalizedPayload = parseJson(payload, {});
    const explicitOrigin = normalizedPayload.dataOrigin || normalizedProvenance.dataOrigin;
    if (explicitOrigin !== undefined && !DATA_ORIGINS.has(explicitOrigin)) throw new DiagnosticError("dataOrigin must be research_baseline, enterprise_measured, realtime_sampling or mock_demo.", 422, "DIAGNOSTIC_DATA_ORIGIN_INVALID");
    if (explicitOrigin === "mock_demo" && normalizedProvenance.environment !== "mock") throw new DiagnosticError("Mock/演示 evidence must declare provenance.environment=mock.", 422, "DIAGNOSTIC_MOCK_PROVENANCE_REQUIRED");
    const lateRelayEvidence = type === "live"
      && normalizedProvenance.collectionMethod === "relay_pull"
      && ["completed", "failed"].includes(run.status);
    if (!["queued", "running"].includes(run.status) && !lateRelayEvidence) {
      throw new DiagnosticConflictError("Evidence can only be added to a queued or running diagnostic run, except late relay deliveries.", { runId, status: run.status });
    }
    if (type === "live") {
      if (!observed) throw new DiagnosticError("Live evidence requires observedAt.", 422, "DIAGNOSTIC_LIVE_PROVENANCE_REQUIRED", { field: "observedAt" });
      if (!stringValue(normalizedProvenance.collectionMethod, "provenance.collectionMethod", 200) || !stringValue(normalizedProvenance.platform, "provenance.platform", 200)) {
        throw new DiagnosticError("Live evidence requires provenance.collectionMethod and provenance.platform.", 422, "DIAGNOSTIC_LIVE_PROVENANCE_REQUIRED");
      }
    }
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_evidence (id, run_id, evidence_type, source_kind, source_id, title, source_url, claim, excerpt, verification_status, observed_at, provenance_json, payload_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        evidenceId, runId, type, stringValue(sourceKind, "sourceKind", 200, true), stringValue(sourceId, "sourceId", 500),
        stringValue(title, "evidence title", 500, true), optionalUrl(sourceUrl, "sourceUrl"), stringValue(claim, "claim", 5000),
        stringValue(excerpt, "excerpt", 20000), verification, observed, JSON.stringify(normalizedProvenance), jsonText(normalizedPayload), timestamp, actorId(actor)
      );
      if (run.status === "queued") this.connection.prepare("UPDATE diagnostic_runs SET status = 'running', started_at = ? WHERE id = ?").run(timestamp, runId);
      this.refreshEvidenceSummary(runId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.evidence.add", entityType: "diagnostic_evidence", entityId: evidenceId, details: { runId, evidenceType: type, verificationStatus: verification }, request, createdAt: timestamp });
    });
    return this.evidence(workspaceId, evidenceId);
  }

  evidence(workspaceId = this.workspaceId, evidenceId) {
    const row = this.connection.prepare(`SELECT e.* FROM diagnostic_evidence e JOIN diagnostic_runs r ON r.id = e.run_id JOIN diagnostic_projects p ON p.id = r.project_id WHERE p.workspace_id = ? AND e.id = ?`).get(workspaceId, evidenceId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic evidence not found.", { evidenceId });
    return this.evidenceRow(row);
  }

  listEvidence({ workspaceId = this.workspaceId, runId, evidenceType = "", limit = 500 } = {}) {
    this.run(workspaceId, runId);
    const params = [runId]; let sql = "SELECT * FROM diagnostic_evidence WHERE run_id = ?";
    if (evidenceType) { enumValue(evidenceType, EVIDENCE_TYPES, "evidenceType"); sql += " AND evidence_type = ?"; params.push(evidenceType); }
    sql += " ORDER BY created_at ASC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.evidenceRow(row));
  }

  refreshEvidenceSummary(runId) {
    const rows = this.connection.prepare(`SELECT evidence_type, verification_status, COUNT(*) AS count FROM diagnostic_evidence WHERE run_id = ? GROUP BY evidence_type, verification_status`).all(runId);
    const summary = { total: 0, research: 0, enterprise: 0, live: 0, verifiedLive: 0, byVerification: {} };
    for (const row of rows) {
      const count = Number(row.count || 0); summary.total += count; summary[row.evidence_type] += count;
      summary.byVerification[row.verification_status] = (summary.byVerification[row.verification_status] || 0) + count;
      if (row.evidence_type === "live" && row.verification_status === "verified") summary.verifiedLive += count;
    }
    this.connection.prepare("UPDATE diagnostic_runs SET evidence_summary_json = ? WHERE id = ?").run(JSON.stringify(summary), runId);
    return summary;
  }

  metricRow(row) {
    if (!row) return null;
    return {
      id: row.id, runId: row.run_id, evidenceId: row.evidence_id || null, evidenceType: row.evidence_type,
      dimension: row.dimension, metricKey: row.metric_key, label: row.label, value: parseJsonAny(row.value_json, null),
      unit: row.unit, status: row.status, methodology: row.methodology, createdAt: row.created_at
    };
  }

  addMetric({ workspaceId = this.workspaceId, runId, id: requestedId, evidenceId = null, evidenceType, dimension, metricKey, label = "", value = null, unit = "", status = "measured", methodology = "", actor = null, request = null } = {}) {
    const type = enumValue(evidenceType, EVIDENCE_TYPES, "evidenceType");
    const metricStatus = enumValue(status, new Set(["measured", "derived", "not_available"]), "metric status", "measured");
    const normalizedDimension = stringValue(dimension, "dimension", 200, true);
    const key = stringValue(metricKey, "metricKey", 200, true);
    const existing = this.connection.prepare("SELECT * FROM diagnostic_metrics WHERE run_id = ? AND evidence_type = ? AND dimension = ? AND metric_key = ?").get(runId, type, normalizedDimension, key);
    if (existing) return this.metricRow(existing);
    const run = this.run(workspaceId, runId);
    let evidence = null;
    if (evidenceId) {
      evidence = this.evidence(workspaceId, evidenceId);
      if (evidence.runId !== runId || evidence.evidenceType !== type) throw new DiagnosticError("Metric evidence must belong to the same run and evidence type.", 422, "DIAGNOSTIC_METRIC_EVIDENCE_INVALID");
    }
    const lateRelayMetric = type === "live"
      && evidence?.provenance?.collectionMethod === "relay_pull"
      && ["completed", "failed"].includes(run.status);
    if (!["queued", "running"].includes(run.status) && !lateRelayMetric) {
      throw new DiagnosticConflictError("Metrics can only be added to a queued or running diagnostic run, except late relay deliveries.", { runId, status: run.status });
    }
    if (metricStatus !== "not_available" && !evidence) throw new DiagnosticError("Measured or derived metrics require an evidenceId.", 422, "DIAGNOSTIC_METRIC_EVIDENCE_REQUIRED");
    if (type === "live" && metricStatus !== "not_available" && (evidence.verificationStatus !== "verified" || !evidence.observedAt)) {
      throw new DiagnosticError("Live metrics require verified, timestamped live evidence.", 422, "DIAGNOSTIC_LIVE_METRIC_UNVERIFIED");
    }
    if (type !== "live" && /(real.?time|current|latest).*(rank|ranking)|(?:实时|当前|最新).*(排名|推荐率|引用率)/i.test(key)) {
      throw new DiagnosticError("Current or real-time ranking metrics require live evidence.", 422, "DIAGNOSTIC_REALTIME_METRIC_REQUIRES_LIVE_EVIDENCE", { metricKey: key });
    }
    const metricId = stringValue(requestedId || id("DM"), "metric id", 180, true); const timestamp = now();
    const encodedValue = JSON.stringify(value);
    if (encodedValue === undefined) throw new DiagnosticError("Metric value must be JSON serializable.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "value" });
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_metrics (id, run_id, evidence_id, evidence_type, dimension, metric_key, label, value_json, unit, status, methodology, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(metricId, runId, evidenceId || null, type, normalizedDimension, key, stringValue(label, "label", 300), encodedValue, stringValue(unit, "unit", 100), metricStatus, stringValue(methodology, "methodology", 4000), timestamp);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.metric.add", entityType: "diagnostic_metric", entityId: metricId, details: { runId, evidenceId, evidenceType: type, dimension, metricKey: key }, request, createdAt: timestamp });
    });
    return this.metric(workspaceId, metricId);
  }

  metric(workspaceId = this.workspaceId, metricId) {
    const row = this.connection.prepare(`SELECT m.* FROM diagnostic_metrics m JOIN diagnostic_runs r ON r.id = m.run_id JOIN diagnostic_projects p ON p.id = r.project_id WHERE p.workspace_id = ? AND m.id = ?`).get(workspaceId, metricId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic metric not found.", { metricId });
    return this.metricRow(row);
  }

  listMetrics({ workspaceId = this.workspaceId, runId, evidenceType = "", dimension = "", limit = 500 } = {}) {
    this.run(workspaceId, runId);
    const params = [runId]; let sql = "SELECT * FROM diagnostic_metrics WHERE run_id = ?";
    if (evidenceType) { enumValue(evidenceType, EVIDENCE_TYPES, "evidenceType"); sql += " AND evidence_type = ?"; params.push(evidenceType); }
    if (dimension) { sql += " AND dimension = ?"; params.push(dimension); }
    sql += " ORDER BY evidence_type, dimension, metric_key LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.metricRow(row));
  }

  completeRun({ workspaceId = this.workspaceId, runId, actor = null, request = null } = {}) {
    const run = this.run(workspaceId, runId);
    if (run.status === "completed") return run;
    if (!["queued", "running"].includes(run.status)) throw new DiagnosticConflictError("This run cannot be completed.", { runId, status: run.status });
    const timestamp = now(); const summary = this.refreshEvidenceSummary(runId);
    this.database.transaction(() => {
      this.connection.prepare("UPDATE diagnostic_runs SET status = 'completed', started_at = COALESCE(started_at, ?), completed_at = ?, evidence_summary_json = ? WHERE id = ?").run(timestamp, timestamp, JSON.stringify(summary), runId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.run.complete", entityType: "diagnostic_run", entityId: runId, details: { projectId: run.projectId, evidenceSummary: summary }, request, createdAt: timestamp });
    });
    return this.run(workspaceId, runId, { includeEvidence: true, includeMetrics: true });
  }

  failRun({ workspaceId = this.workspaceId, runId, errorCode = "DIAGNOSTIC_RUN_FAILED", errorMessage = "", actor = null, request = null } = {}) {
    const run = this.run(workspaceId, runId);
    if (!["queued", "running"].includes(run.status)) throw new DiagnosticConflictError("This run cannot be failed.", { runId, status: run.status });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE diagnostic_runs SET status = 'failed', started_at = COALESCE(started_at, ?), completed_at = ?, error_code = ?, error_message = ? WHERE id = ?").run(timestamp, timestamp, stringValue(errorCode, "errorCode", 200, true), stringValue(errorMessage, "errorMessage", 2000), runId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.run.fail", entityType: "diagnostic_run", entityId: runId, details: { projectId: run.projectId, errorCode }, request, createdAt: timestamp });
    });
    return this.run(workspaceId, runId);
  }

  reportRow(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id, runId: row.run_id, version: Number(row.version_number),
      title: row.title, reportType: row.report_type, status: row.status, executiveSummary: row.executive_summary,
      sections: parseJson(row.sections_json, []), methodology: parseJson(row.methodology_json), dataScope: parseJson(row.data_scope_json),
      limitations: parseJson(row.limitations_json, []), checksum: row.checksum, createdAt: row.created_at,
      finalizedAt: row.finalized_at || null, createdBy: row.created_by || null, finalizedBy: row.finalized_by || null
    };
  }

  derivedDataScope(workspaceId, run) {
    const research = run.researchPackageId ? this.researchPackage(workspaceId, run.researchPackageId) : null;
    const evidence = this.listEvidence({ workspaceId, runId: run.id, limit: 1000 });
    const metrics = this.listMetrics({ workspaceId, runId: run.id, limit: 1000 });
    const counts = { research: 0, enterprise: 0, live: 0 };
    const verified = { research: 0, enterprise: 0, live: 0 };
    const dataClasses = { researchBaseline: 0, enterpriseMeasured: 0, realtimeSampling: 0, mockDemo: 0 };
    const dataClassVerified = { researchBaseline: 0, enterpriseMeasured: 0, realtimeSampling: 0, mockDemo: 0 };
    const originFor = (item) => {
      const explicit = item?.payload?.dataOrigin || item?.provenance?.dataOrigin;
      if (DATA_ORIGINS.has(explicit)) return explicit;
      return item.evidenceType === "research" ? "research_baseline" : item.evidenceType === "enterprise" ? "enterprise_measured" : "realtime_sampling";
    };
    const classKey = { research_baseline: "researchBaseline", enterprise_measured: "enterpriseMeasured", realtime_sampling: "realtimeSampling", mock_demo: "mockDemo" };
    for (const item of evidence) {
      counts[item.evidenceType] += 1;
      const key = classKey[originFor(item)]; dataClasses[key] += 1;
      if (item.verificationStatus === "verified") { verified[item.evidenceType] += 1; dataClassVerified[key] += 1; }
    }
    const verifiedLiveMetrics = metrics.filter((item) => item.evidenceType === "live" && item.status !== "not_available" && evidence.some((source) => source.id === item.evidenceId && source.verificationStatus === "verified" && source.observedAt && originFor(source) === "realtime_sampling")).length;
    return {
      evidenceTypes: { research: "historical research baseline", enterprise: "customer-owned operational evidence", live: "timestamped AI-platform sampling" },
      evidenceCounts: counts, verifiedEvidenceCounts: verified, dataClasses, dataClassVerified, metricCount: metrics.length, verifiedLiveMetricCount: verifiedLiveMetrics,
      researchPackage: research ? { id: research.id, datasetVersion: research.datasetVersion, releasedAt: research.releasedAt, installState: research.installState, verificationStatus: research.verificationStatus, sourceUrl: research.sourceUrl } : null,
      supportsCurrentAiRanking: verifiedLiveMetrics > 0,
      boundary: verifiedLiveMetrics > 0
        ? "数据分别标记为研究基线、企业实测、实时采样或 Mock/演示；当前 AI 指标仅限明确标记为 realtime_sampling 且带时间戳、已验证的样本。"
        : "No verified live AI-platform sample is present. This report must not claim a current brand ranking, recommendation rate or real-time citation result. 数据分别标记为研究基线、企业实测、实时采样或 Mock/演示。"
    };
  }

  createReport({ workspaceId = this.workspaceId, runId, id: requestedId, title, reportType = null, executiveSummary = "", sections = [], methodology = {}, limitations = [], status = "draft", actor = null, request = null } = {}) {
    const run = this.run(workspaceId, runId, { includeEvidence: true, includeMetrics: true });
    if (run.status !== "completed") throw new DiagnosticConflictError("Complete the diagnostic run before creating a report.", { runId, status: run.status });
    const project = this.project(workspaceId, run.projectId);
    const normalizedStatus = enumValue(status, REPORT_STATUSES, "report status", "draft");
    const normalizedSections = parseJson(sections, []);
    if (!Array.isArray(normalizedSections)) throw new DiagnosticError("sections must be an array.", 422, "DIAGNOSTIC_INVALID_INPUT", { field: "sections" });
    const dataScope = this.derivedDataScope(workspaceId, run);
    const normalizedLimitations = Array.isArray(limitations) ? limitations.slice(0, 100).map((item) => stringValue(item, "limitation", 2000)).filter(Boolean) : [];
    if (!dataScope.supportsCurrentAiRanking) normalizedLimitations.unshift("No verified live AI-platform sample is present; current brand ranking, recommendation rate and real-time citation performance are outside this report's evidence scope.");
    const research = run.researchPackageId ? this.researchPackage(workspaceId, run.researchPackageId) : null;
    for (const limitation of research?.limitations || []) if (!normalizedLimitations.includes(limitation)) normalizedLimitations.push(limitation);
    const reportId = stringValue(requestedId || id("DREP"), "report id", 180, true); const timestamp = now();
    const reportTitle = stringValue(title, "report title", 500, true);
    const type = enumValue(reportType || project.diagnosticType, PROJECT_TYPES, "reportType");
    const summary = stringValue(executiveSummary, "executiveSummary", 30000);
    if (!dataScope.supportsCurrentAiRanking) {
      const unsupportedClaims = unsupportedRealtimeClaims({ executiveSummary: summary, sections: normalizedSections });
      if (unsupportedClaims.length) throw new DiagnosticError("Current AI ranking or rate claims require verified live evidence.", 422, "DIAGNOSTIC_UNSUPPORTED_REALTIME_CLAIM", { fields: unsupportedClaims });
    }
    const normalizedMethodology = { framework: "evidence-separated-diagnostic-v1", evidenceTypes: DIAGNOSTIC_EVIDENCE_TYPES, ...parseJson(methodology, {}) };
    let version;
    const checksum = hash({ reportTitle, type, summary, normalizedSections, normalizedMethodology, dataScope, normalizedLimitations });
    this.database.transaction(() => {
      version = Number(this.connection.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM diagnostic_reports WHERE run_id = ?").get(runId)?.version || 1);
      if (normalizedStatus === "final") this.connection.prepare("UPDATE diagnostic_reports SET status = 'superseded' WHERE run_id = ? AND status = 'final'").run(runId);
      this.connection.prepare(`INSERT INTO diagnostic_reports (id, project_id, run_id, version_number, title, report_type, status, executive_summary, sections_json, methodology_json, data_scope_json, limitations_json, checksum, created_at, finalized_at, created_by, finalized_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(reportId, run.projectId, runId, version, reportTitle, type, normalizedStatus, summary, JSON.stringify(normalizedSections), JSON.stringify(normalizedMethodology), JSON.stringify(dataScope), JSON.stringify(normalizedLimitations), checksum, timestamp, normalizedStatus === "final" ? timestamp : null, actorId(actor), normalizedStatus === "final" ? actorId(actor) : null);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.report.create", entityType: "diagnostic_report", entityId: reportId, details: { projectId: run.projectId, runId, version, status: normalizedStatus, evidenceScope: dataScope }, request, createdAt: timestamp });
    });
    return this.report(workspaceId, reportId, { includeRecommendations: true });
  }

  /**
   * Persist a report for a Relay-backed brand diagnostic run.
   *
   * Relay reports intentionally have a narrower evidence contract than the
   * general diagnostic report API: only timestamped, verified live evidence
   * belonging to this run is copied into the report.  Research/enterprise
   * evidence that may also exist on the run is excluded from the report's
   * data scope and sections.
   */
  createRelayDiagnosticReport({
    workspaceId = this.workspaceId,
    projectId = "",
    runId,
    relayRunId = "",
    relayStatus = "completed",
    title = "",
    generatedAnalysis = null,
    actor = null,
    request = null
  } = {}) {
    const normalizedRunId = stringValue(runId, "runId", 180, true);
    const run = this.run(workspaceId, normalizedRunId, { includeEvidence: true, includeMetrics: true });
    const normalizedProjectId = stringValue(projectId, "projectId", 180);
    if (normalizedProjectId && run.projectId !== normalizedProjectId) {
      throw new DiagnosticConflictError("The relay run does not belong to the requested project.", {
        runId: normalizedRunId,
        projectId: normalizedProjectId,
        actualProjectId: run.projectId
      });
    }
    if (run.status !== "completed") {
      throw new DiagnosticConflictError("Complete the Relay diagnostic run before creating a brand diagnostic report.", {
        runId: normalizedRunId,
        status: run.status
      });
    }
    const project = this.project(workspaceId, run.projectId);
    const normalizedRelayStatus = enumValue(
      relayStatus,
      new Set(["completed", "partial"]),
      "relayStatus",
      "completed"
    );
    const verifiedLiveEvidence = (run.evidence || []).filter((item) =>
      item.evidenceType === "live" && item.verificationStatus === "verified" && Boolean(item.observedAt)
    );
    if (!verifiedLiveEvidence.length) {
      throw new DiagnosticError(
        "A Relay brand diagnostic report requires at least one verified, timestamped live evidence record.",
        422,
        "DIAGNOSTIC_VERIFIED_LIVE_EVIDENCE_REQUIRED",
        { runId: normalizedRunId }
      );
    }

    const samples = verifiedLiveEvidence.map(relayLiveEvidenceItem);
    const evidenceIds = new Set(verifiedLiveEvidence.map((item) => item.id));
    const liveMetrics = (run.metrics || []).filter((item) =>
      item.evidenceType === "live" && item.status !== "not_available" && evidenceIds.has(item.evidenceId)
    );
    const summary = relayLiveSummary(project, run, verifiedLiveEvidence, normalizedRelayStatus);
    const generated = parseJson(generatedAnalysis, null);
    const inputSnapshot = parseJson(run.inputSnapshot, {});
    const requestSnapshot = parseJson(inputSnapshot.request, {});
    const brand = parseJson(requestSnapshot.brand, {});
    const competitors = Array.isArray(requestSnapshot.competitors)
      ? requestSnapshot.competitors.slice(0, 100).map((item) => stringValue(item, "competitor", 240)).filter(Boolean)
      : [];
    const reportSections = [
      {
        key: "live_scope",
        title: "Verified live diagnostic scope",
        content: {
          projectId: project.id,
          runId: run.id,
          relayRunId: stringValue(relayRunId, "relayRunId", 240),
          relayStatus: normalizedRelayStatus,
          targetBrand: project.targetBrand || project.name,
          brand,
          competitors,
          evidenceBoundary: "Only diagnostic_evidence(live) with verificationStatus=verified and observedAt is included."
        }
      },
      {
        key: "live_summary",
        title: "AI platform sampling summary",
        content: summary
      },
      {
        key: "platform_breakdown",
        title: "Platform and terminal breakdown",
        content: { items: summary.byPlatform }
      },
      {
        key: "verified_samples",
        title: "Verified answer samples",
        content: { items: samples }
      },
      {
        key: "verified_metrics",
        title: "Metrics derived from verified samples",
        content: {
          items: liveMetrics.map((metric) => ({
            id: metric.id,
            evidenceId: metric.evidenceId,
            dimension: metric.dimension,
            metricKey: metric.metricKey,
            label: metric.label,
            value: metric.value,
            unit: metric.unit,
            status: metric.status,
            methodology: metric.methodology
          }))
        }
      }
    ];
    if (generated && typeof generated === "object") {
      for (const section of Array.isArray(generated.sections) ? generated.sections.slice(0, 8) : []) {
        reportSections.push({
          key: stringValue(section.key || "analysis", "report section key", 120),
          title: stringValue(section.title || "数据分析", "report section title", 500),
          content: {
            summary: stringValue(section.summary, "report section summary", 8_000),
            findings: Array.isArray(section.findings) ? section.findings.slice(0, 20) : []
          }
        });
      }
      if (Array.isArray(generated.recommendations) && generated.recommendations.length) {
        reportSections.push({ key: "analysis_recommendations", title: "基于数据的优化建议", content: { items: generated.recommendations.slice(0, 20) } });
      }
    }
    const dataScope = {
      evidenceTypes: {
        research: "excluded from this Relay report",
        enterprise: "excluded from this Relay report",
        live: "timestamped and verified AI-platform sampling"
      },
      evidenceCounts: { research: 0, enterprise: 0, live: verifiedLiveEvidence.length },
      verifiedEvidenceCounts: { research: 0, enterprise: 0, live: verifiedLiveEvidence.length },
      metricCount: liveMetrics.length,
      verifiedLiveMetricCount: liveMetrics.length,
      supportsCurrentAiRanking: true,
      boundary: "This report is derived only from verified, timestamped diagnostic_evidence(live) records for the selected Relay run.",
      evidenceSource: "diagnostic_evidence(live)",
      evidenceIds: [...evidenceIds],
      relayRunId: stringValue(relayRunId, "relayRunId", 240),
      relayStatus: normalizedRelayStatus
    };
    const mentionText = summary.brandMentionRate === null ? "brand mention rate is unavailable" : `brand mention rate is ${summary.brandMentionRate}%`;
    const citationText = summary.citationRate === null ? "citation rate is unavailable" : `citation rate is ${summary.citationRate}%`;
    const executiveSummary = stringValue(generated?.executiveSummary, "executiveSummary", 30_000)
      || `${summary.targetBrand} brand diagnostic completed with ${summary.verifiedLiveEvidenceCount} verified live AI-platform samples; ${mentionText}, and ${citationText}.`;
    const normalizedMethodology = {
      framework: "relay-live-brand-diagnostic-v1",
      evidenceSource: "diagnostic_evidence(live)",
      verificationFilter: "evidenceType=live AND verificationStatus=verified AND observedAt IS NOT NULL",
      projectId: project.id,
      runId: run.id,
      relayRunId: stringValue(relayRunId, "relayRunId", 240),
      relayStatus: normalizedRelayStatus,
      verifiedLiveEvidenceCount: verifiedLiveEvidence.length,
      verifiedLiveMetricCount: liveMetrics.length,
      analysisMode: generated ? "full_live_effect" : "deterministic_live_summary",
      promptVersion: generated?.promptVersion || null,
      model: generated?.model || null
    };
    const reportId = id("DREP");
    const timestamp = now();
    const reportTitle = stringValue(title, "report title", 500) || `${summary.targetBrand} AI brand diagnostic report`;
    const reportType = enumValue(project.diagnosticType, PROJECT_TYPES, "reportType");
    const limitations = [
      "This report includes only verified, timestamped live AI-platform samples delivered by Relay.",
      ...(normalizedRelayStatus === "partial" ? ["The Relay run completed partially; unavailable or failed samples are not represented as verified evidence."] : []),
      ...(Array.isArray(generated?.limitations) ? generated.limitations.slice(0, 20).map((item) => stringValue(item, "limitation", 2_000)).filter(Boolean) : [])
    ];
    const checksum = hash({ reportTitle, reportType, executiveSummary, reportSections, normalizedMethodology, dataScope, limitations });
    let version;
    this.database.transaction(() => {
      version = Number(this.connection.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM diagnostic_reports WHERE run_id = ?").get(run.id)?.version || 1);
      this.connection.prepare("UPDATE diagnostic_reports SET status = 'superseded' WHERE run_id = ? AND status = 'final'").run(run.id);
      this.connection.prepare(`INSERT INTO diagnostic_reports (
        id, project_id, run_id, version_number, title, report_type, status,
        executive_summary, sections_json, methodology_json, data_scope_json,
        limitations_json, checksum, created_at, finalized_at, created_by, finalized_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'final', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        reportId,
        project.id,
        run.id,
        version,
        reportTitle,
        reportType,
        executiveSummary,
        JSON.stringify(reportSections),
        JSON.stringify(normalizedMethodology),
        JSON.stringify(dataScope),
        JSON.stringify(limitations),
        checksum,
        timestamp,
        timestamp,
        actorId(actor),
        actorId(actor)
      );
      appendAuditLog(this.connection, {
        actorUserId: actorId(actor),
        action: "diagnostic.relay_report.create",
        entityType: "diagnostic_report",
        entityId: reportId,
        details: {
          projectId: project.id,
          runId: run.id,
          relayRunId: stringValue(relayRunId, "relayRunId", 240),
          relayStatus: normalizedRelayStatus,
          verifiedLiveEvidenceCount: verifiedLiveEvidence.length,
          version
        },
        request,
        createdAt: timestamp
      });
    });
    const report = this.report(workspaceId, reportId, { includeRecommendations: true });
    // Do not expose the other evidence scopes through this customer-facing
    // Relay report response either; the persisted sections and data scope are
    // live-only, so the expanded response must obey the same boundary.
    report.evidence = verifiedLiveEvidence;
    report.metrics = liveMetrics;
    return { report, reportId: report.id, version: report.version, summary };
  }

  report(workspaceId = this.workspaceId, reportId, options = {}) {
    const row = this.connection.prepare(`SELECT d.* FROM diagnostic_reports d JOIN diagnostic_projects p ON p.id = d.project_id WHERE p.workspace_id = ? AND d.id = ?`).get(workspaceId, reportId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic report not found.", { reportId });
    const result = this.reportRow(row);
    if (options.includeRecommendations) result.recommendations = this.listRecommendations({ workspaceId, reportId, limit: 1000 });
    if (options.includeEvidence || options.includeMetrics || options.includeRun) {
      const run = this.run(workspaceId, result.runId, {
        includeEvidence: options.includeEvidence === true,
        includeMetrics: options.includeMetrics === true
      });
      if (options.includeRun) result.run = run;
      if (options.includeEvidence) result.evidence = run.evidence || [];
      if (options.includeMetrics) result.metrics = run.metrics || [];
    }
    return result;
  }

  listReports({ workspaceId = this.workspaceId, projectId = "", runId = "", status = "", limit = 100 } = {}) {
    const params = [workspaceId]; let sql = "SELECT d.* FROM diagnostic_reports d JOIN diagnostic_projects p ON p.id = d.project_id WHERE p.workspace_id = ?";
    if (projectId) { sql += " AND d.project_id = ?"; params.push(projectId); }
    if (runId) { sql += " AND d.run_id = ?"; params.push(runId); }
    if (status) { sql += " AND d.status = ?"; params.push(status); }
    sql += " ORDER BY d.created_at DESC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.reportRow(row));
  }

  recommendationRow(row) {
    if (!row) return null;
    return {
      id: row.id, reportId: row.report_id, category: row.category, priority: row.priority,
      title: row.title, rationale: row.rationale, expectedOutcome: row.expected_outcome,
      evidenceRefs: parseJson(row.evidence_refs_json, []), payload: parseJson(row.payload_json), status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by || null, updatedBy: row.updated_by || null
    };
  }

  createRecommendation({ workspaceId = this.workspaceId, reportId, id: requestedId, category, priority = "medium", title, rationale = "", expectedOutcome = "", evidenceRefs = [], payload = {}, actor = null, request = null } = {}) {
    const report = this.report(workspaceId, reportId);
    const refs = Array.isArray(evidenceRefs) ? [...new Set(evidenceRefs.map((item) => stringValue(item, "evidence reference", 180)).filter(Boolean))] : [];
    for (const evidenceId of refs) {
      const evidence = this.evidence(workspaceId, evidenceId);
      if (evidence.runId !== report.runId) throw new DiagnosticError("Recommendation evidence must belong to the report run.", 422, "DIAGNOSTIC_RECOMMENDATION_EVIDENCE_INVALID", { evidenceId });
    }
    const recommendationId = stringValue(requestedId || id("DREC"), "recommendation id", 180, true); const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_recommendations (id, report_id, category, priority, title, rationale, expected_outcome, evidence_refs_json, payload_json, status, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?, ?)`
      ).run(recommendationId, reportId, enumValue(category, RECOMMENDATION_CATEGORIES, "recommendation category"), enumValue(priority, new Set(["critical", "high", "medium", "low"]), "priority", "medium"), stringValue(title, "recommendation title", 500, true), stringValue(rationale, "rationale", 10000), stringValue(expectedOutcome, "expectedOutcome", 5000), JSON.stringify(refs), jsonText(payload), timestamp, timestamp, actorId(actor), actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.recommendation.create", entityType: "diagnostic_recommendation", entityId: recommendationId, details: { reportId, projectId: report.projectId, category }, request, createdAt: timestamp });
    });
    return this.recommendation(workspaceId, recommendationId);
  }

  recommendation(workspaceId = this.workspaceId, recommendationId) {
    const row = this.connection.prepare(`SELECT x.* FROM diagnostic_recommendations x JOIN diagnostic_reports d ON d.id = x.report_id JOIN diagnostic_projects p ON p.id = d.project_id WHERE p.workspace_id = ? AND x.id = ?`).get(workspaceId, recommendationId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic recommendation not found.", { recommendationId });
    return this.recommendationRow(row);
  }

  listRecommendations({ workspaceId = this.workspaceId, reportId, status = "", limit = 500 } = {}) {
    this.report(workspaceId, reportId);
    const params = [reportId]; let sql = "SELECT * FROM diagnostic_recommendations WHERE report_id = ?";
    if (status) { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at ASC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.recommendationRow(row));
  }

  actionRow(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id, recommendationId: row.recommendation_id || null,
      actionType: row.action_type, status: row.status, payload: parseJson(row.payload_json),
      targetEntityType: row.target_entity_type, targetEntityId: row.target_entity_id, result: parseJson(row.result_json),
      createdAt: row.created_at, updatedAt: row.updated_at, decidedAt: row.decided_at || null, appliedAt: row.applied_at || null,
      createdBy: row.created_by || null, updatedBy: row.updated_by || null
    };
  }

  createAction({ workspaceId = this.workspaceId, projectId, recommendationId = null, id: requestedId, actionType, payload = {}, actor = null, request = null } = {}) {
    this.project(workspaceId, projectId);
    if (recommendationId) {
      const recommendation = this.recommendation(workspaceId, recommendationId);
      const report = this.report(workspaceId, recommendation.reportId);
      if (report.projectId !== projectId) throw new DiagnosticError("Recommendation does not belong to the project.", 422, "DIAGNOSTIC_ACTION_RECOMMENDATION_INVALID");
    }
    const actionId = stringValue(requestedId || id("DACT"), "action id", 180, true); const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`INSERT INTO diagnostic_actions (id, project_id, recommendation_id, action_type, status, payload_json, result_json, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, 'proposed', ?, '{}', ?, ?, ?, ?)`
      ).run(actionId, projectId, recommendationId || null, enumValue(actionType, ACTION_TYPES, "actionType"), jsonText(payload), timestamp, timestamp, actorId(actor), actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "diagnostic.action.propose", entityType: "diagnostic_action", entityId: actionId, details: { projectId, recommendationId, actionType }, request, createdAt: timestamp });
    });
    return this.action(workspaceId, actionId);
  }

  action(workspaceId = this.workspaceId, actionId) {
    const row = this.connection.prepare(`SELECT a.* FROM diagnostic_actions a JOIN diagnostic_projects p ON p.id = a.project_id WHERE p.workspace_id = ? AND a.id = ?`).get(workspaceId, actionId);
    if (!row) throw new DiagnosticNotFoundError("Diagnostic action not found.", { actionId });
    return this.actionRow(row);
  }

  listActions({ workspaceId = this.workspaceId, projectId = "", status = "", limit = 500 } = {}) {
    const params = [workspaceId]; let sql = "SELECT a.* FROM diagnostic_actions a JOIN diagnostic_projects p ON p.id = a.project_id WHERE p.workspace_id = ?";
    if (projectId) { sql += " AND a.project_id = ?"; params.push(projectId); }
    if (status) { sql += " AND a.status = ?"; params.push(status); }
    sql += " ORDER BY a.created_at DESC LIMIT ?"; params.push(positiveLimit(limit));
    return this.connection.prepare(sql).all(...params).map((row) => this.actionRow(row));
  }

  transitionAction({ workspaceId = this.workspaceId, actionId, status, targetEntityType = "", targetEntityId = "", result = {}, actor = null, request = null } = {}) {
    const current = this.action(workspaceId, actionId);
    const next = enumValue(status, new Set(["accepted", "applied", "rejected", "failed", "cancelled"]), "action status");
    const allowed = {
      proposed: new Set(["accepted", "rejected", "cancelled"]),
      accepted: new Set(["applied", "failed", "cancelled"]),
      failed: new Set(["accepted", "cancelled"])
    };
    if (!allowed[current.status]?.has(next)) throw new DiagnosticConflictError("Invalid diagnostic action transition.", { actionId, currentStatus: current.status, requestedStatus: next });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE diagnostic_actions SET status = ?, target_entity_type = ?, target_entity_id = ?, result_json = ?, updated_at = ?, decided_at = CASE WHEN ? IN ('accepted', 'rejected', 'cancelled') THEN COALESCE(decided_at, ?) ELSE decided_at END, applied_at = CASE WHEN ? = 'applied' THEN ? ELSE applied_at END, updated_by = ? WHERE id = ?`
      ).run(next, stringValue(targetEntityType, "targetEntityType", 200), stringValue(targetEntityId, "targetEntityId", 300), jsonText(result), timestamp, next, timestamp, next, timestamp, actorId(actor), actionId);
      if (current.recommendationId) {
        const recommendationStatus = next === "accepted" ? "accepted" : next === "applied" ? "converted" : next === "rejected" ? "rejected" : null;
        if (recommendationStatus) this.connection.prepare("UPDATE diagnostic_recommendations SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?").run(recommendationStatus, timestamp, actorId(actor), current.recommendationId);
      }
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: `diagnostic.action.${next}`, entityType: "diagnostic_action", entityId: actionId, details: { projectId: current.projectId, previousStatus: current.status, targetEntityType, targetEntityId }, request, createdAt: timestamp });
    });
    return this.action(workspaceId, actionId);
  }

  createPhaseOneReport({ workspaceId = this.workspaceId, projectId, questionSetSnapshot = null, enterpriseSnapshot = null, report = {}, recommendations = null, actor = null, request = null } = {}) {
    const project = this.project(workspaceId, projectId);
    let questionSet;
    const suppliedQuestions = Array.isArray(questionSetSnapshot)
      ? questionSetSnapshot
      : Array.isArray(questionSetSnapshot?.questions) ? questionSetSnapshot.questions : null;
    if (suppliedQuestions) {
      questionSet = this.createQuestionSet({ workspaceId, projectId, name: questionSetSnapshot?.name || "本次诊断问题集", questions: suppliedQuestions, actor, request });
      questionSet = this.freezeQuestionSet({ workspaceId, questionSetId: questionSet.id, actor, request });
    } else {
      try { questionSet = this.latestFrozenQuestionSet(workspaceId, projectId); } catch (error) {
        if (!(error instanceof DiagnosticError) || error.code !== "DIAGNOSTIC_QUESTION_SET_REQUIRED") throw error;
        const subject = project.industry || project.targetBrand || "该企业";
        const defaultQuestions = [
          `${subject}客户在决策前最常向 AI 提出哪些真实问题？`,
          `${subject}相关答案通常需要哪些可核验的一手信源？`,
          `企业现有知识、官网页面与客户问题之间有哪些内容缺口？`,
          `官网如何形成便于 AI 抓取、理解和核验的页面结构？`,
          `未来 90 天应按什么顺序建设知识、内容与发布渠道？`
        ];
        questionSet = this.createQuestionSet({ workspaceId, projectId, name: "第一阶段诊断问题集", questions: defaultQuestions, actor, request });
        questionSet = this.freezeQuestionSet({ workspaceId, questionSetId: questionSet.id, actor, request });
      }
    }

    const research = this.researchPackage(workspaceId, project.researchPackageId || this.activeResearchPackage(workspaceId).id);
    let run = this.createRun({
      workspaceId, projectId, questionSetId: questionSet.id, researchPackageId: research.id,
      evidenceScope: { research: true, enterprise: true, live: false },
      input: { phase: 1, mode: "research_baseline_and_enterprise_context" }, actor, request
    });
    run = this.startRun({ workspaceId, runId: run.id, actor, request });
    const researchEvidence = this.addEvidence({
      workspaceId, runId: run.id, evidenceType: "research", sourceKind: "citation_lab_package_metadata",
      sourceId: research.id, title: `${research.name} v${research.datasetVersion}`, sourceUrl: research.sourceUrl,
      claim: "Citation Lab metadata is used as a historical research baseline and not as a live ranking feed.",
      excerpt: `Version ${research.datasetVersion}; released ${research.releasedAt || "unknown"}; installation state ${research.installState}.`,
      verificationStatus: "verified", observedAt: research.releasedAt ? `${research.releasedAt}T00:00:00.000Z` : null,
      provenance: { collectionMethod: "fixed_phase_one_manifest", upstreamRepository: research.sourceRepository, packageVerificationStatus: research.verificationStatus },
      payload: { statistics: research.statistics, coverage: research.coverage, limitations: research.limitations }, actor, request
    });
    const baselineMetrics = [
      ["citation_records", "引用记录", research.statistics.citationRecords, "records"],
      ["canonical_questions", "规范问题", research.statistics.canonicalQuestions, "questions"],
      ["platforms_and_terminals", "平台与终端", research.statistics.platformsAndTerminals, "platforms"],
      ["canonical_sources", "规范信源", research.statistics.canonicalSources, "sources"],
      ["pages", "页面", research.statistics.pages, "pages"]
    ];
    for (const [metricKey, label, value, unit] of baselineMetrics) {
      this.addMetric({ workspaceId, runId: run.id, evidenceId: researchEvidence.id, evidenceType: "research", dimension: "citation_lab_dataset_scale", metricKey, label, value, unit, status: "measured", methodology: "Fixed upstream dataset metadata; scale indicator only, not a customer performance metric.", actor, request });
    }
    const hasEnterpriseContext = Boolean(project.industry || project.targetBrand || project.websiteUrl || project.businessLineId || project.objective);
    if (hasEnterpriseContext) {
      this.addEvidence({
        workspaceId, runId: run.id, evidenceType: "enterprise", sourceKind: "customer_project_profile",
        sourceId: project.id, title: "客户提交的诊断项目资料", sourceUrl: project.websiteUrl,
        claim: "This record captures customer-supplied scope and objectives; it is not an independent verification of website or brand performance.",
        verificationStatus: "supplied", provenance: { collectionMethod: "customer_input", projectRevision: project.revision },
        payload: { industry: project.industry, targetBrand: project.targetBrand, websiteUrl: project.websiteUrl, businessLineId: project.businessLineId, objective: project.objective, scope: project.scope }, actor, request
      });
    }
    const enterprise = parseJson(enterpriseSnapshot, {});
    const hasEnterpriseSnapshot = Object.keys(enterprise).length > 0;
    if (hasEnterpriseSnapshot) {
      const enterpriseEvidence = this.addEvidence({
        workspaceId,
        runId: run.id,
        evidenceType: "enterprise",
        sourceKind: "internal_operations_snapshot",
        sourceId: project.id,
        title: "企业运营系统快照",
        sourceUrl: project.websiteUrl,
        claim: "该快照来自本次报告生成时的企业工作区、官网诊断和内容运营数据库。",
        excerpt: `Snapshot captured at ${enterprise.capturedAt || "report generation time"}.`,
        verificationStatus: "verified",
        observedAt: enterprise.capturedAt || new Date().toISOString(),
        provenance: { collectionMethod: "internal_database_snapshot", projectRevision: project.revision },
        payload: enterprise,
        actor,
        request
      });
      const enterpriseMetrics = [
        ["content_assets", "question_count", "问题词库", enterprise.assets?.questionCount, "questions"],
        ["content_assets", "topic_count", "选题数量", enterprise.assets?.topicCount, "topics"],
        ["knowledge_assets", "knowledge_base_count", "知识库数量", enterprise.assets?.knowledgeBaseCount, "libraries"],
        ["knowledge_assets", "knowledge_item_count", "知识条目", enterprise.assets?.knowledgeItemCount, "items"],
        ["content_operations", "article_total", "文章总数", enterprise.production?.articleTotal, "articles"],
        ["content_operations", "article_published", "已发布文章", enterprise.production?.published, "articles"],
        ["site_foundation", "site_geo_score", "官网 GEO 规则分", enterprise.websiteDiagnostic?.overallScore, "score"],
        ["site_foundation", "ai_crawler_pv_30d", "30 天 AI 爬虫访问", enterprise.crawlerTraffic?.aiBotPv, "pv"]
      ];
      for (const [dimension, metricKey, label, value, unit] of enterpriseMetrics) {
        if (value === undefined || value === null || value === "") continue;
        this.addMetric({ workspaceId, runId: run.id, evidenceId: enterpriseEvidence.id, evidenceType: "enterprise", dimension, metricKey, label, value, unit, status: "measured", methodology: "Point-in-time value read from the customer-owned operations database." });
      }
    }
    run = this.completeRun({ workspaceId, runId: run.id, actor, request });

    const requestedReport = parseJson(report, {});
    const questionRows = questionSet.questions.map((item, index) => ({ order: index + 1, question: item.text, intent: item.intent || "待结合企业知识库进一步判断" }));
    const defaultSections = [
      { key: "scope", title: "诊断范围与结论边界", content: { industry: project.industry, targetBrand: project.targetBrand, websiteUrl: project.websiteUrl, objective: project.objective, evidenceBoundary: "研究基线用于行业方法参考；企业资料用于自身诊断；没有实时采样就不输出当前 AI 排名。" } },
      { key: "question_map", title: "客户问题地图", content: { questions: questionRows, note: "这些问题是后续知识缺口、选题和内容计划的共同入口。" } },
      { key: "source_ecosystem", title: "信源生态策略", content: { baseline: research.statistics, interpretation: "Citation Lab 数据规模说明应从问题、平台、信源和页面四个层次建立分析框架；本阶段未宣称这些历史样本等同于该客户所在行业的实时分布。" } },
      { key: "knowledge_and_content", title: "知识与内容缺口", content: { snapshot: hasEnterpriseSnapshot ? enterprise.assets || {} : null, priorities: ["整理企业事实、产品参数、服务边界和案例证据", "把高价值客户问题关联到可核验知识片段", "将问题转为官网页面与行业内容计划"] } },
      { key: "official_site", title: "官网信源能力", content: { websiteUrl: project.websiteUrl, diagnostic: hasEnterpriseSnapshot ? enterprise.websiteDiagnostic || null : null, crawlerTraffic: hasEnterpriseSnapshot ? enterprise.crawlerTraffic || null : null, status: enterprise.websiteDiagnostic ? "已读取本次企业官网诊断快照" : project.websiteUrl ? "待运行网站 GEO 诊断" : "尚未提供官网地址", checks: ["页面语义结构", "结构化数据", "作者与更新时间", "事实来源与内链", "AI/搜索爬虫可达性"] } },
      { key: "execution_plan", title: "90 天执行建议", content: { phases: ["第 1-2 周：冻结问题地图与企业知识边界", "第 3-6 周：补齐核心页面和高价值答案", "第 7-10 周：多渠道发布并记录执行数据", "第 11-12 周：基于企业实测复盘；如需实时排名，另行启用 AI 平台采样器"] } }
    ];
    const createdReport = this.createReport({
      workspaceId, runId: run.id,
      title: requestedReport.title || `${project.name}｜第一阶段运营诊断报告`,
      reportType: requestedReport.reportType || project.diagnosticType,
      executiveSummary: requestedReport.executiveSummary || `本报告以 Citation Lab v${research.datasetVersion} 作为历史研究基线，结合客户提交的项目范围形成第一阶段执行策划。当前未接入经验证的 AI 平台实时样本，因此不提供当前品牌排名、推荐率或实时引用结论。`,
      sections: Array.isArray(requestedReport.sections) ? requestedReport.sections : defaultSections,
      methodology: { phase: 1, researchBaseline: research.id, questionSetChecksum: questionSet.checksum, enterpriseEvidence: hasEnterpriseContext || hasEnterpriseSnapshot, enterpriseSnapshot: hasEnterpriseSnapshot, liveSampling: false, ...(parseJson(requestedReport.methodology, {})) },
      limitations: Array.isArray(requestedReport.limitations) ? requestedReport.limitations : [],
      status: requestedReport.status || "final", actor, request
    });

    const defaultRecommendations = [
      { category: "question_map", priority: "high", title: "确认并扩充真实客户问题地图", rationale: "问题集决定知识整理、选题和报告评估的共同口径。", expectedOutcome: "形成可持续维护的行业问题资产。", actionType: "question_library_candidate", payload: { questions: questionSet.questions, sourceQuestionSetId: questionSet.id } },
      { category: "knowledge_gap", priority: "high", title: "补齐企业可核验知识", rationale: "没有企业事实、参数、边界和案例证据，内容会趋同且难以核验。", expectedOutcome: "形成可供 RAG 检索的企业知识证据。", actionType: "knowledge_gap", payload: { checklist: ["企业事实", "产品参数", "服务边界", "案例证据", "常见异议"] } },
      { category: "site_cms", priority: "high", title: "建立官网信源能力整改任务", rationale: "官网是企业可控制的一手信源，应同时满足人和机器的理解与核验。", expectedOutcome: "形成页面级 CMS 整改清单。", actionType: "cms_task", payload: { websiteUrl: project.websiteUrl, checks: ["schema", "content_structure", "metadata", "citations", "crawlability"] } },
      { category: "content_plan", priority: "medium", title: "将高价值问题转入内容计划", rationale: "问题只有进入知识、写作、审核和发布闭环才会产生运营价值。", expectedOutcome: "形成按优先级执行的内容计划。", actionType: "content_plan", payload: { sourceQuestionSetId: questionSet.id, questionCount: questionSet.questions.length } }
    ];
    const requestedRecommendations = Array.isArray(recommendations) ? recommendations : defaultRecommendations;
    const createdRecommendations = [];
    const actions = [];
    for (const input of requestedRecommendations.slice(0, 100)) {
      const recommendation = this.createRecommendation({ workspaceId, reportId: createdReport.id, category: input.category, priority: input.priority || "medium", title: input.title, rationale: input.rationale || "", expectedOutcome: input.expectedOutcome || "", evidenceRefs: input.evidenceRefs || [researchEvidence.id], payload: input.payload || {}, actor, request });
      createdRecommendations.push(recommendation);
      if (input.actionType) actions.push(this.createAction({ workspaceId, projectId, recommendationId: recommendation.id, actionType: input.actionType, payload: input.payload || {}, actor, request }));
    }
    return { project: this.project(workspaceId, projectId), questionSet, run, report: this.report(workspaceId, createdReport.id, { includeRecommendations: true }), recommendations: createdRecommendations, actions };
  }

  overview(workspaceId = this.workspaceId) {
    const projectCounts = Object.fromEntries(this.connection.prepare("SELECT status, COUNT(*) AS count FROM diagnostic_projects WHERE workspace_id = ? GROUP BY status").all(workspaceId).map((row) => [row.status, Number(row.count)]));
    const actionCounts = Object.fromEntries(this.connection.prepare(`SELECT a.status, COUNT(*) AS count FROM diagnostic_actions a JOIN diagnostic_projects p ON p.id = a.project_id WHERE p.workspace_id = ? GROUP BY a.status`).all(workspaceId).map((row) => [row.status, Number(row.count)]));
    return {
      generatedAt: now(), researchPackage: this.activeResearchPackage(workspaceId),
      projects: { total: Object.values(projectCounts).reduce((sum, count) => sum + count, 0), byStatus: projectCounts },
      actions: { total: Object.values(actionCounts).reduce((sum, count) => sum + count, 0), byStatus: actionCounts },
      recentProjects: this.listProjects({ workspaceId, includeArchived: true, limit: 5 }),
      recentReports: this.listReports({ workspaceId, limit: 5 }),
      evidenceBoundary: {
        research: "Historical Citation Lab research baseline.",
        enterprise: "Customer-owned knowledge, website, content and operational evidence.",
        live: "Explicitly collected, timestamped and verified AI-platform samples only."
      }
    };
  }
}

export default DiagnosticStore;
