import { createHash, randomUUID } from "node:crypto";
import { appendAuditLog } from "./production-audit.mjs";

const SCOPES = new Set(["global", "industry", "project"]);
const VERSION_STATUSES = new Set(["draft", "review", "published", "retired"]);
const SOURCE_REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);
const SOURCE_REUSE_DECISIONS = new Set(["candidate-global-after-approval", "approved-global", "review-only", "rejected"]);

export class FoundationAssetError extends Error {
  constructor(message, status = 422, code = "FOUNDATION_ASSET_ERROR", details = undefined) {
    super(message);
    this.name = "FoundationAssetError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function text(value, field, maximum = 20_000, required = false) {
  const normalized = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !normalized) throw new FoundationAssetError(`${field} is required.`, 422, "FOUNDATION_ASSET_INVALID_INPUT", { field });
  return normalized.slice(0, maximum);
}

function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FoundationAssetError(`${field} must be an object.`, 422, "FOUNDATION_ASSET_INVALID_INPUT", { field });
  return structuredClone(value);
}

function array(value, field, { required = false } = {}) {
  if (!Array.isArray(value) || (required && !value.length)) throw new FoundationAssetError(`${field} must be ${required ? "a non-empty" : "an"} array.`, 422, "FOUNDATION_ASSET_INVALID_INPUT", { field });
  return structuredClone(value);
}

function json(value) { return JSON.stringify(value); }
function parse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function actorId(actor) { return actor?.userId || actor?.id || null; }
function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${randomUUID()}`; }
function checksum(value) { return createHash("sha256").update(json(value)).digest("hex"); }

function normalizeScope({ scope = "global", industryTemplate = "", workspaceId = "" } = {}) {
  const normalizedScope = text(scope, "scope", 20, true);
  if (!SCOPES.has(normalizedScope)) throw new FoundationAssetError("scope must be global, industry, or project.", 422, "FOUNDATION_ASSET_INVALID_SCOPE");
  const industry = text(industryTemplate, "industryTemplate", 120);
  const workspace = text(workspaceId, "workspaceId", 160);
  if (normalizedScope === "global" && (industry || workspace)) throw new FoundationAssetError("Global assets cannot carry industryTemplate or workspaceId.", 422, "FOUNDATION_ASSET_SCOPE_CONFLICT");
  if (normalizedScope === "industry" && (!industry || workspace)) throw new FoundationAssetError("Industry assets require industryTemplate and cannot carry workspaceId.", 422, "FOUNDATION_ASSET_SCOPE_CONFLICT");
  if (normalizedScope === "project" && (!workspace || industry)) throw new FoundationAssetError("Project assets require workspaceId and cannot carry industryTemplate.", 422, "FOUNDATION_ASSET_SCOPE_CONFLICT");
  return { scope: normalizedScope, industryTemplate: industry, workspaceId: workspace };
}

export class FoundationAssetStore {
  constructor(database) {
    if (!database?.connection) throw new TypeError("FoundationAssetStore requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
  }

  methodologyPackRow(row) {
    return row ? { id: row.id, key: row.key, scope: row.scope, industryTemplate: row.industry_template || "", workspaceId: row.workspace_id || "", title: row.title, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }

  methodologyVersionRow(row) {
    return row ? { id: row.id, packId: row.pack_id, version: Number(row.version), content: row.content, sources: parse(row.sources_json, []), checksum: row.checksum, status: row.status, createdAt: row.created_at, publishedAt: row.published_at || null } : null;
  }

  methodologySourceReviewRow(row) {
    return row ? {
      id: row.id,
      methodologyVersionId: row.methodology_version_id,
      ruleId: row.rule_id,
      theme: row.theme,
      rule: row.rule_text,
      source: { path: row.source_path, locator: row.source_locator, excerpt: row.source_excerpt, sha256: row.source_sha256 },
      classification: row.classification,
      applicability: row.applicability,
      licenseStatus: row.license_status,
      reuseDecision: row.reuse_decision,
      reviewStatus: row.review_status,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      createdAt: row.created_at
    } : null;
  }

  promptTemplateRow(row) {
    return row ? { id: row.id, key: row.key, scope: row.scope, industryTemplate: row.industry_template || "", workspaceId: row.workspace_id || "", operation: row.operation, title: row.title, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }

  promptVersionRow(row) {
    return row ? { id: row.id, templateId: row.template_id, version: Number(row.version), systemPrompt: row.system_prompt, userTemplate: row.user_template, variablesSchema: parse(row.variables_schema_json, {}), outputSchema: parse(row.output_schema_json, {}), qualityRules: parse(row.quality_rules_json, []), checksum: row.checksum, status: row.status, createdAt: row.created_at, publishedAt: row.published_at || null } : null;
  }

  qualityRulePackRow(row) {
    return row ? { id: row.id, key: row.key, scope: row.scope, industryTemplate: row.industry_template || "", workspaceId: row.workspace_id || "", title: row.title, version: Number(row.version), rules: parse(row.rules_json, []), checksum: row.checksum, status: row.status, createdAt: row.created_at, publishedAt: row.published_at || null } : null;
  }

  methodologyPackByKey(key, scopeOptions = {}) {
    const scope = normalizeScope(scopeOptions);
    return this.methodologyPackRow(this.connection.prepare("SELECT * FROM methodology_packs WHERE key = ? AND scope = ? AND industry_template = ? AND workspace_id = ?").get(text(key, "key", 160, true), scope.scope, scope.industryTemplate, scope.workspaceId));
  }

  methodologyVersions(packId) {
    return this.connection.prepare("SELECT * FROM methodology_versions WHERE pack_id = ? ORDER BY version DESC").all(text(packId, "packId", 180, true)).map((row) => this.methodologyVersionRow(row));
  }

  methodologySourceReviews(methodologyVersionId) {
    const versionId = text(methodologyVersionId, "methodologyVersionId", 180, true);
    return this.connection.prepare("SELECT * FROM methodology_source_reviews WHERE methodology_version_id = ? ORDER BY theme, rule_id").all(versionId).map((row) => this.methodologySourceReviewRow(row));
  }

  upsertMethodologySourceReview(input = {}, actor = null, request = null) {
    const methodologyVersionId = text(input.methodologyVersionId, "methodologyVersionId", 180, true);
    if (!this.connection.prepare("SELECT 1 FROM methodology_versions WHERE id = ?").get(methodologyVersionId)) throw new FoundationAssetError("Methodology version not found.", 404, "METHODOLOGY_VERSION_NOT_FOUND");
    const ruleId = text(input.ruleId, "ruleId", 180, true);
    const source = object(input.source, "source");
    const reviewStatus = text(input.reviewStatus || "pending", "reviewStatus", 20, true);
    const reuseDecision = text(input.reuseDecision || "candidate-global-after-approval", "reuseDecision", 80, true);
    if (!SOURCE_REVIEW_STATUSES.has(reviewStatus)) throw new FoundationAssetError("Invalid methodology source review status.", 422, "METHODOLOGY_SOURCE_REVIEW_INVALID_STATUS");
    if (!SOURCE_REUSE_DECISIONS.has(reuseDecision)) throw new FoundationAssetError("Invalid methodology source reuse decision.", 422, "METHODOLOGY_SOURCE_REVIEW_INVALID_REUSE_DECISION");
    if (reviewStatus === "approved" && reuseDecision !== "approved-global") throw new FoundationAssetError("Approved source reviews must explicitly allow global reuse.", 422, "METHODOLOGY_SOURCE_REVIEW_APPROVAL_SCOPE_REQUIRED");
    const version = this.connection.prepare("SELECT status FROM methodology_versions WHERE id = ?").get(methodologyVersionId);
    if (version.status === "published") throw new FoundationAssetError("Published methodology versions cannot receive new source reviews.", 409, "PUBLISHED_VERSION_IMMUTABLE");
    const timestamp = now();
    const reviewId = text(input.id, "id", 180) || id("MSREV");
    const fields = {
      theme: text(input.theme, "theme", 120, true),
      rule: text(input.rule, "rule", 10_000, true),
      sourcePath: text(source.path, "source.path", 1_000, true),
      sourceLocator: text(source.locator, "source.locator", 1_000, true),
      sourceExcerpt: text(source.excerpt, "source.excerpt", 2_000),
      sourceSha256: text(source.sha256, "source.sha256", 64, true).toLowerCase(),
      classification: text(input.classification, "classification", 120, true),
      applicability: text(input.applicability, "applicability", 2_000),
      licenseStatus: text(input.licenseStatus, "licenseStatus", 500),
      reviewNote: text(input.reviewNote, "reviewNote", 4_000)
    };
    if (!/^[0-9a-f]{64}$/.test(fields.sourceSha256)) throw new FoundationAssetError("source.sha256 must be a lowercase SHA-256 digest.", 422, "METHODOLOGY_SOURCE_REVIEW_INVALID_HASH");
    this.database.transaction(() => {
      const existing = this.connection.prepare("SELECT id FROM methodology_source_reviews WHERE methodology_version_id = ? AND rule_id = ?").get(methodologyVersionId, ruleId);
      if (existing) {
        this.connection.prepare("UPDATE methodology_source_reviews SET theme = ?, rule_text = ?, source_path = ?, source_locator = ?, source_excerpt = ?, source_sha256 = ?, classification = ?, applicability = ?, license_status = ?, reuse_decision = ?, review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?")
          .run(fields.theme, fields.rule, fields.sourcePath, fields.sourceLocator, fields.sourceExcerpt, fields.sourceSha256, fields.classification, fields.applicability, fields.licenseStatus, reuseDecision, reviewStatus, fields.reviewNote, reviewStatus === "pending" ? null : actorId(actor), reviewStatus === "pending" ? null : timestamp, existing.id);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.methodology_source_review.update", entityType: "methodology_source_review", entityId: existing.id, details: { methodologyVersionId, ruleId, reviewStatus, reuseDecision }, request, createdAt: timestamp });
      } else {
        this.connection.prepare("INSERT INTO methodology_source_reviews (id, methodology_version_id, rule_id, theme, rule_text, source_path, source_locator, source_excerpt, source_sha256, classification, applicability, license_status, reuse_decision, review_status, review_note, reviewed_by, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(reviewId, methodologyVersionId, ruleId, fields.theme, fields.rule, fields.sourcePath, fields.sourceLocator, fields.sourceExcerpt, fields.sourceSha256, fields.classification, fields.applicability, fields.licenseStatus, reuseDecision, reviewStatus, fields.reviewNote, reviewStatus === "pending" ? null : actorId(actor), reviewStatus === "pending" ? null : timestamp, timestamp);
        appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.methodology_source_review.create", entityType: "methodology_source_review", entityId: reviewId, details: { methodologyVersionId, ruleId, reviewStatus, reuseDecision }, request, createdAt: timestamp });
      }
    });
    return this.methodologySourceReviewRow(this.connection.prepare("SELECT * FROM methodology_source_reviews WHERE methodology_version_id = ? AND rule_id = ?").get(methodologyVersionId, ruleId));
  }

  createMethodologyPack(input = {}, actor = null, request = null) {
    const scope = normalizeScope(input);
    const packId = text(input.id, "id", 180) || id("MPACK");
    const key = text(input.key, "key", 160, true);
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO methodology_packs (id, key, scope, industry_template, workspace_id, title, description, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)")
        .run(packId, key, scope.scope, scope.industryTemplate, scope.workspaceId, text(input.title, "title", 300, true), text(input.description, "description", 2_000), timestamp, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.methodology_pack.create", entityType: "methodology_pack", entityId: packId, details: { key, ...scope }, request, createdAt: timestamp });
    });
    return this.methodologyPackRow(this.connection.prepare("SELECT * FROM methodology_packs WHERE id = ?").get(packId));
  }

  createMethodologyVersion(input = {}, actor = null, request = null) {
    const packId = text(input.packId, "packId", 180, true);
    if (!this.connection.prepare("SELECT 1 FROM methodology_packs WHERE id = ?").get(packId)) throw new FoundationAssetError("Methodology pack not found.", 404, "METHODOLOGY_PACK_NOT_FOUND");
    const version = Number(this.connection.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM methodology_versions WHERE pack_id = ?").get(packId).version);
    const content = text(input.content, "content", 200_000, true);
    const sources = array(input.sources || [], "sources");
    const versionId = text(input.id, "id", 180) || id("MVER");
    const digest = checksum({ kind: "methodology", packId, version, content, sources });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO methodology_versions (id, pack_id, version, content, sources_json, checksum, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
        .run(versionId, packId, version, content, json(sources), digest, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.methodology_version.create", entityType: "methodology_version", entityId: versionId, details: { packId, version, checksum: digest }, request, createdAt: timestamp });
    });
    return this.methodologyVersionRow(this.connection.prepare("SELECT * FROM methodology_versions WHERE id = ?").get(versionId));
  }

  setMethodologyVersionStatus(versionId, status, actor = null, request = null) {
    if (status === "published") this.assertMethodologyPublicationReady(versionId);
    return this.setVersionStatus("methodology_versions", versionId, status, actor, request, { requireSources: true });
  }

  assertMethodologyPublicationReady(methodologyVersionId) {
    const versionId = text(methodologyVersionId, "methodologyVersionId", 180, true);
    const version = this.connection.prepare("SELECT sources_json FROM methodology_versions WHERE id = ?").get(versionId);
    if (!version) throw new FoundationAssetError("Methodology version not found.", 404, "METHODOLOGY_VERSION_NOT_FOUND");
    const reviews = this.connection.prepare("SELECT rule_id, review_status, reuse_decision FROM methodology_source_reviews WHERE methodology_version_id = ?").all(versionId);
    if (!reviews.length) throw new FoundationAssetError("Methodology version requires source reviews before publication.", 409, "METHODOLOGY_SOURCE_REVIEWS_REQUIRED");
    const requiredRuleCount = Math.max(0, ...parse(version.sources_json, []).map((source) => Number(source?.requiredRuleCount || 0)).filter(Number.isInteger));
    if (requiredRuleCount && reviews.length !== requiredRuleCount) throw new FoundationAssetError("Methodology source review count does not match its source manifest.", 409, "METHODOLOGY_SOURCE_REVIEW_COUNT_MISMATCH", { requiredRuleCount, actualRuleCount: reviews.length });
    const incomplete = reviews.filter((review) => review.review_status !== "approved" || review.reuse_decision !== "approved-global");
    if (incomplete.length) throw new FoundationAssetError("Methodology version has unapproved or restricted source rules.", 409, "METHODOLOGY_SOURCE_REVIEWS_INCOMPLETE", { ruleIds: incomplete.map((review) => review.rule_id) });
    return { methodologyVersionId: versionId, reviewedRules: reviews.length, requiredRuleCount: requiredRuleCount || reviews.length, status: "ready" };
  }

  promptTemplateByKey(key, scopeOptions = {}) {
    const scope = normalizeScope(scopeOptions);
    return this.promptTemplateRow(this.connection.prepare("SELECT * FROM prompt_templates WHERE key = ? AND scope = ? AND industry_template = ? AND workspace_id = ?").get(text(key, "key", 160, true), scope.scope, scope.industryTemplate, scope.workspaceId));
  }

  promptVersions(templateId) {
    return this.connection.prepare("SELECT * FROM prompt_versions WHERE template_id = ? ORDER BY version DESC").all(text(templateId, "templateId", 180, true)).map((row) => this.promptVersionRow(row));
  }

  createPromptTemplate(input = {}, actor = null, request = null) {
    const scope = normalizeScope(input);
    const templateId = text(input.id, "id", 180) || id("PTPL");
    const key = text(input.key, "key", 160, true);
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO prompt_templates (id, key, scope, industry_template, workspace_id, operation, title, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)")
        .run(templateId, key, scope.scope, scope.industryTemplate, scope.workspaceId, text(input.operation, "operation", 120, true), text(input.title, "title", 300, true), timestamp, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.prompt_template.create", entityType: "prompt_template", entityId: templateId, details: { key, ...scope }, request, createdAt: timestamp });
    });
    return this.promptTemplateRow(this.connection.prepare("SELECT * FROM prompt_templates WHERE id = ?").get(templateId));
  }

  createPromptVersion(input = {}, actor = null, request = null) {
    const templateId = text(input.templateId, "templateId", 180, true);
    if (!this.connection.prepare("SELECT 1 FROM prompt_templates WHERE id = ?").get(templateId)) throw new FoundationAssetError("Prompt template not found.", 404, "PROMPT_TEMPLATE_NOT_FOUND");
    const version = Number(this.connection.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM prompt_versions WHERE template_id = ?").get(templateId).version);
    const systemPrompt = text(input.systemPrompt, "systemPrompt", 100_000, true);
    const userTemplate = text(input.userTemplate, "userTemplate", 100_000, true);
    const variablesSchema = object(input.variablesSchema, "variablesSchema");
    const outputSchema = object(input.outputSchema, "outputSchema");
    const qualityRules = array(input.qualityRules || [], "qualityRules", { required: true });
    const versionId = text(input.id, "id", 180) || id("PVER");
    const digest = checksum({ kind: "prompt", templateId, version, systemPrompt, userTemplate, variablesSchema, outputSchema, qualityRules });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO prompt_versions (id, template_id, version, system_prompt, user_template, variables_schema_json, output_schema_json, quality_rules_json, checksum, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
        .run(versionId, templateId, version, systemPrompt, userTemplate, json(variablesSchema), json(outputSchema), json(qualityRules), digest, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.prompt_version.create", entityType: "prompt_version", entityId: versionId, details: { templateId, version, checksum: digest }, request, createdAt: timestamp });
    });
    return this.promptVersionRow(this.connection.prepare("SELECT * FROM prompt_versions WHERE id = ?").get(versionId));
  }

  setPromptVersionStatus(versionId, status, actor = null, request = null) {
    if (status === "published" && !this.connection.prepare("SELECT 1 FROM prompt_test_cases WHERE prompt_version_id = ? AND status = 'active' LIMIT 1").get(versionId)) throw new FoundationAssetError("Prompt version requires an active test case before publication.", 409, "PROMPT_TEST_CASE_REQUIRED");
    return this.setVersionStatus("prompt_versions", versionId, status, actor, request);
  }

  createQualityRulePack(input = {}, actor = null, request = null) {
    const scope = normalizeScope(input);
    const key = text(input.key, "key", 160, true);
    const version = Number(this.connection.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM quality_rule_packs WHERE key = ? AND scope = ? AND industry_template = ? AND workspace_id = ?").get(key, scope.scope, scope.industryTemplate, scope.workspaceId).version);
    const rules = array(input.rules, "rules", { required: true });
    const packId = text(input.id, "id", 180) || id("QRULE");
    const digest = checksum({ kind: "quality", key, ...scope, version, rules });
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("INSERT INTO quality_rule_packs (id, key, scope, industry_template, workspace_id, title, version, rules_json, checksum, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
        .run(packId, key, scope.scope, scope.industryTemplate, scope.workspaceId, text(input.title, "title", 300, true), version, json(rules), digest, timestamp, actorId(actor));
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.quality_rule_pack.create", entityType: "quality_rule_pack", entityId: packId, details: { key, version, ...scope, checksum: digest }, request, createdAt: timestamp });
    });
    return this.qualityRulePackRow(this.connection.prepare("SELECT * FROM quality_rule_packs WHERE id = ?").get(packId));
  }

  qualityRulePacksByKey(key, scopeOptions = {}) {
    const scope = normalizeScope(scopeOptions);
    return this.connection.prepare("SELECT * FROM quality_rule_packs WHERE key = ? AND scope = ? AND industry_template = ? AND workspace_id = ? ORDER BY version DESC")
      .all(text(key, "key", 160, true), scope.scope, scope.industryTemplate, scope.workspaceId).map((row) => this.qualityRulePackRow(row));
  }

  selectPublishedPlanFoundation({ workspaceId, industryTemplate = "" } = {}) {
    const workspace = text(workspaceId, "workspaceId", 160, true);
    const industry = text(industryTemplate, "industryTemplate", 120);
    const scopeParams = [workspace, industry];
    const methodology = this.connection.prepare(`
      SELECT v.id, v.version, v.checksum, p.scope, p.industry_template
      FROM methodology_versions v JOIN methodology_packs p ON p.id = v.pack_id
      WHERE p.key = 'geo-core' AND v.status = 'published'
        AND (p.scope = 'global' OR (p.scope = 'industry' AND p.industry_template = ?) OR (p.scope = 'project' AND p.workspace_id = ?))
      ORDER BY CASE p.scope WHEN 'project' THEN 3 WHEN 'industry' THEN 2 ELSE 1 END DESC, v.version DESC LIMIT 1
    `).get(industry, workspace);
    const prompt = this.connection.prepare(`
      SELECT v.id, v.version, v.checksum, t.scope, t.industry_template
      FROM prompt_versions v JOIN prompt_templates t ON t.id = v.template_id
      WHERE t.key = 'geo-article' AND t.operation = 'article' AND v.status = 'published'
        AND (t.scope = 'global' OR (t.scope = 'industry' AND t.industry_template = ?) OR (t.scope = 'project' AND t.workspace_id = ?))
      ORDER BY CASE t.scope WHEN 'project' THEN 3 WHEN 'industry' THEN 2 ELSE 1 END DESC, v.version DESC LIMIT 1
    `).get(industry, workspace);
    const quality = this.connection.prepare(`
      SELECT id, version, checksum, scope, industry_template
      FROM quality_rule_packs
      WHERE key = 'geo-content-quality' AND status = 'published'
        AND (scope = 'global' OR (scope = 'industry' AND industry_template = ?) OR (scope = 'project' AND workspace_id = ?))
      ORDER BY CASE scope WHEN 'project' THEN 3 WHEN 'industry' THEN 2 ELSE 1 END DESC, version DESC LIMIT 1
    `).get(industry, workspace);
    const missing = [["methodology", methodology], ["prompt", prompt], ["quality", quality]].filter(([, value]) => !value).map(([kind]) => kind);
    if (missing.length) throw new FoundationAssetError("Published GEO foundation assets are incomplete for the current private deployment.", 409, "FOUNDATION_DEFAULTS_NOT_PUBLISHED", { missing, industryTemplate: industry });
    return {
      industryTemplate: industry,
      methodologyVersionId: methodology.id,
      promptVersionId: prompt.id,
      qualityRulePackId: quality.id,
      versions: {
        methodology: { version: Number(methodology.version), checksum: methodology.checksum, scope: methodology.scope },
        prompt: { version: Number(prompt.version), checksum: prompt.checksum, scope: prompt.scope },
        quality: { version: Number(quality.version), checksum: quality.checksum, scope: quality.scope }
      }
    };
  }

  setQualityRulePackStatus(packId, status, actor = null, request = null) {
    return this.setVersionStatus("quality_rule_packs", packId, status, actor, request);
  }

  createPromptTestCase(input = {}, actor = null, request = null) {
    const promptVersionId = text(input.promptVersionId, "promptVersionId", 180, true);
    const version = this.connection.prepare("SELECT status FROM prompt_versions WHERE id = ?").get(promptVersionId);
    if (!version) throw new FoundationAssetError("Prompt version not found.", 404, "PROMPT_VERSION_NOT_FOUND");
    if (version.status === "published") throw new FoundationAssetError("Published prompt versions cannot receive new test cases.", 409, "PUBLISHED_VERSION_IMMUTABLE");
    const testId = text(input.id, "id", 180) || id("PTEST");
    const timestamp = now();
    this.connection.prepare("INSERT INTO prompt_test_cases (id, prompt_version_id, name, input_fixture_json, expected_rules_json, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
      .run(testId, promptVersionId, text(input.name, "name", 300, true), json(object(input.inputFixture, "inputFixture")), json(array(input.expectedRules, "expectedRules", { required: true })), timestamp, actorId(actor));
    return { id: testId, promptVersionId, name: text(input.name, "name", 300, true), status: "active" };
  }

  setVersionStatus(table, requestedId, requestedStatus, actor = null, request = null, options = {}) {
    const allowedTables = new Set(["methodology_versions", "prompt_versions", "quality_rule_packs"]);
    if (!allowedTables.has(table)) throw new TypeError("Unsupported version table.");
    const versionId = text(requestedId, "id", 180, true);
    const status = text(requestedStatus, "status", 20, true);
    if (!VERSION_STATUSES.has(status)) throw new FoundationAssetError("Invalid version status.", 422, "FOUNDATION_ASSET_INVALID_STATUS");
    const row = this.connection.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(versionId);
    if (!row) throw new FoundationAssetError("Foundation asset version not found.", 404, "FOUNDATION_ASSET_VERSION_NOT_FOUND");
    if (row.status === "published") throw new FoundationAssetError("Published versions are immutable.", 409, "PUBLISHED_VERSION_IMMUTABLE");
    if (status === "published" && options.requireSources && !parse(row.sources_json, []).length) throw new FoundationAssetError("Methodology version requires sources before publication.", 409, "METHODOLOGY_SOURCES_REQUIRED");
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare(`UPDATE ${table} SET status = ?, published_at = ?, published_by = ? WHERE id = ?`).run(status, status === "published" ? timestamp : null, status === "published" ? actorId(actor) : null, versionId);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: `foundation.${table}.status`, entityType: table, entityId: versionId, details: { from: row.status, to: status }, request, createdAt: timestamp });
    });
    const updated = this.connection.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(versionId);
    if (table === "methodology_versions") return this.methodologyVersionRow(updated);
    if (table === "prompt_versions") return this.promptVersionRow(updated);
    return this.qualityRulePackRow(updated);
  }

  attachPlanFoundation({ workspaceId, planId, industryTemplate = "", methodologyVersionId, promptVersionId, qualityRulePackId, allowUnpublished = false } = {}, actor = null, request = null) {
    const workspace = text(workspaceId, "workspaceId", 160, true);
    const plan = text(planId, "planId", 180, true);
    const selectedIndustry = text(industryTemplate, "industryTemplate", 120);
    const refs = [
      ["methodology_versions", text(methodologyVersionId, "methodologyVersionId", 180, true), "SELECT v.status, p.scope, p.industry_template, p.workspace_id FROM methodology_versions v JOIN methodology_packs p ON p.id = v.pack_id WHERE v.id = ?"],
      ["prompt_versions", text(promptVersionId, "promptVersionId", 180, true), "SELECT v.status, t.scope, t.industry_template, t.workspace_id FROM prompt_versions v JOIN prompt_templates t ON t.id = v.template_id WHERE v.id = ?"],
      ["quality_rule_packs", text(qualityRulePackId, "qualityRulePackId", 180, true), "SELECT status, scope, industry_template, workspace_id FROM quality_rule_packs WHERE id = ?"]
    ];
    if (!this.connection.prepare("SELECT 1 FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspace, plan)) throw new FoundationAssetError("Content plan not found in the current private deployment.", 404, "CONTENT_PLAN_NOT_FOUND");
    for (const [, referenceId, query] of refs) {
      const row = this.connection.prepare(query).get(referenceId);
      if (!row) throw new FoundationAssetError(`Foundation reference ${referenceId} not found.`, 404, "FOUNDATION_REFERENCE_NOT_FOUND");
      if (!allowUnpublished && row.status !== "published") throw new FoundationAssetError("Content plans may only use published foundation assets.", 409, "FOUNDATION_REFERENCE_NOT_PUBLISHED", { referenceId });
      if (row.scope === "project" && row.workspace_id !== workspace) throw new FoundationAssetError("Project foundation asset belongs to another private deployment.", 403, "FOUNDATION_REFERENCE_WORKSPACE_MISMATCH", { referenceId });
      if (row.scope === "industry" && (!selectedIndustry || row.industry_template !== selectedIndustry)) throw new FoundationAssetError("Industry foundation asset does not match the content plan industry.", 409, "FOUNDATION_REFERENCE_INDUSTRY_MISMATCH", { referenceId, industryTemplate: selectedIndustry });
    }
    const timestamp = now();
    this.database.transaction(() => {
      this.connection.prepare("UPDATE content_plans SET methodology_version_id = ?, prompt_version_id = ?, quality_rule_pack_id = ?, revision = revision + 1, updated_at = ? WHERE workspace_id = ? AND id = ?")
        .run(refs[0][1], refs[1][1], refs[2][1], timestamp, workspace, plan);
      appendAuditLog(this.connection, { actorUserId: actorId(actor), action: "foundation.content_plan.attach", entityType: "content_plan", entityId: plan, details: { workspaceId: workspace, methodologyVersionId: refs[0][1], promptVersionId: refs[1][1], qualityRulePackId: refs[2][1], allowUnpublished }, request, createdAt: timestamp });
    });
    return this.connection.prepare("SELECT id, workspace_id, methodology_version_id, prompt_version_id, quality_rule_pack_id FROM content_plans WHERE workspace_id = ? AND id = ?").get(workspace, plan);
  }
}
