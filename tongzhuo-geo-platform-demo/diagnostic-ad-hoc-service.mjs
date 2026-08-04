import crypto from "node:crypto";
import { stableJson } from "./diagnostic-relay-client.mjs";
import { DiagnosticRelayError } from "./diagnostic-relay-service.mjs";
import { appendAuditLog } from "./production-audit.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const MAX_PLATFORM_COUNT = 12;
const MAX_TERMINAL_COUNT = 3;
const MAX_MODE_COUNT = 3;
const MAX_ITEM_COUNT = 24;

function now() { return new Date().toISOString(); }
function plainObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function text(value, field, maximum = 500, required = false) {
  const normalized = String(value ?? "").replace(/\u0000/g, "").trim();
  if (required && !normalized) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_INVALID_INPUT", `${field} is required.`, { status: 422, details: { field } });
  if (normalized.length > maximum) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_INVALID_INPUT", `${field} exceeds ${maximum} characters.`, { status: 422, details: { field, maximum } });
  return normalized;
}
function stringArray(value, field, maximum) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_INVALID_INPUT", `${field} must be an array.`, { status: 422, details: { field } });
  if (value.length > maximum) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_INVALID_INPUT", `${field} contains too many values.`, { status: 422, details: { field, maximum } });
  const unique = new Set();
  for (const item of value) {
    const normalized = text(item, field, 120, true);
    unique.add(normalized);
  }
  return [...unique];
}
function sha256(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function actorDescriptor(actor) {
  return String(actor?.service?.caller || actor?.username || actor?.displayName || "customer_server_api").slice(0, 120);
}
function quoteSummary(quote = {}) {
  return {
    estimatedCustomerCredits: Number.isFinite(Number(quote?.estimatedCustomerCredits)) ? Number(quote.estimatedCustomerCredits) : null,
    itemCount: Array.isArray(quote?.items) ? quote.items.length : Array.isArray(quote?.priceSnapshot) ? quote.priceSnapshot.length : null,
    currency: text(quote?.currency || "", "quote currency", 32)
  };
}

/**
 * Creates isolated, single-question relay runs for a customer's own backend.
 * It deliberately has no browser-facing responsibility: caller authentication
 * is enforced by server.mjs before this service is reached.
 */
export class AdHocDiagnosticService {
  constructor({ database, diagnosticStore, relayService, workspaceId = DEFAULT_WORKSPACE_ID, trustProxy = false } = {}) {
    if (!database?.connection) throw new TypeError("AdHocDiagnosticService requires a ProductionDatabase instance.");
    if (!diagnosticStore) throw new TypeError("AdHocDiagnosticService requires a DiagnosticStore instance.");
    if (!relayService || typeof relayService.quote !== "function" || typeof relayService.createRun !== "function") {
      throw new TypeError("AdHocDiagnosticService requires a DiagnosticRelayService instance.");
    }
    this.database = database;
    this.connection = database.connection;
    this.diagnosticStore = diagnosticStore;
    this.relayService = relayService;
    this.workspaceId = String(workspaceId || DEFAULT_WORKSPACE_ID);
    this.trustProxy = Boolean(trustProxy);
  }

  _existingLink(idempotencyKey) {
    return this.connection.prepare("SELECT diagnostic_run_id FROM diagnostic_relay_links WHERE workspace_id = ? AND idempotency_key = ?").get(this.workspaceId, idempotencyKey) || null;
  }

  _normalize(input = {}) {
    const question = text(input.question, "question", 1_000, true);
    const platforms = stringArray(input.platforms, "platforms", MAX_PLATFORM_COUNT);
    const terminals = stringArray(input.terminals, "terminals", MAX_TERMINAL_COUNT);
    const modes = stringArray(input.modes, "modes", MAX_MODE_COUNT);
    if (!platforms.length) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_PLATFORM_REQUIRED", "At least one platform is required for an ad-hoc diagnostic.", { status: 422 });
    const selectedTerminals = terminals.length ? terminals : ["web"];
    const selectedModes = modes.length ? modes : ["fast"];
    if (platforms.length * selectedTerminals.length * selectedModes.length > MAX_ITEM_COUNT) {
      throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_ITEM_LIMIT", `An ad-hoc diagnostic may create at most ${MAX_ITEM_COUNT} relay items.`, { status: 422, details: { maximum: MAX_ITEM_COUNT } });
    }
    const idempotencyKey = text(input.idempotencyKey, "idempotencyKey", 512, true);
    if (idempotencyKey.length < 8) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_IDEMPOTENCY_REQUIRED", "idempotencyKey must contain at least 8 characters.", { status: 422 });
    if (input.externalDataConsent !== true) {
      throw new DiagnosticRelayError("RELAY_CONSENT_REQUIRED", "externalDataConsent must be explicitly true before a question is sent to an external provider.", { status: 422 });
    }
    const authorizationReference = text(input.authorizationReference, "authorizationReference", 240, true);
    const authorizedBy = text(input.authorizedBy, "authorizedBy", 240, true);
    const consentedAtInput = text(input.externalDataConsentAt, "externalDataConsentAt", 80);
    let consentedAt = now();
    if (consentedAtInput) {
      const parsed = new Date(consentedAtInput);
      if (Number.isNaN(parsed.valueOf())) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_INVALID_CONSENT_TIME", "externalDataConsentAt must be an ISO-8601 timestamp.", { status: 422 });
      consentedAt = parsed.toISOString();
    }
    const consentMethod = text(input.externalDataConsentMethod || "customer_server_api", "externalDataConsentMethod", 120, true);
    const brand = plainObject(input.brand);
    const normalizedBrand = {
      ...brand,
      name: text(brand.name || "", "brand.name", 300),
      aliases: Array.isArray(brand.aliases) ? brand.aliases.slice(0, 20).map((item) => text(item, "brand.alias", 120)).filter(Boolean) : []
    };
    const competitors = stringArray(input.competitors, "competitors", 20).map((item) => text(item, "competitor", 240));
    const analysisScope = plainObject(input.analysisScope);
    const fingerprintPayload = { question, platforms, terminals: selectedTerminals, modes: selectedModes, brand: normalizedBrand, competitors, analysisScope };
    const requestFingerprint = sha256(stableJson(fingerprintPayload));
    return {
      question,
      platforms,
      terminals: selectedTerminals,
      modes: selectedModes,
      brand: normalizedBrand,
      competitors,
      analysisScope,
      idempotencyKey,
      clientRunId: text(input.clientRunId || `ad-hoc-${requestFingerprint.slice(0, 24)}`, "clientRunId", 256, true),
      consent: { externalDataConsent: true, consentedAt, method: consentMethod },
      authorization: { authorizationReference, authorizedBy, consentedAt, method: consentMethod },
      requestFingerprint
    };
  }

  _projectPayload(project) {
    return {
      id: project.id,
      name: project.name,
      scope: project.scope,
      status: project.status,
      temporary: project.scope?.temporary === true
    };
  }

  _audit(action, entityType, entityId, details, actor, request) {
    appendAuditLog(this.connection, {
      actorUserId: actor?.userId || actor?.id || null,
      action,
      entityType,
      entityId,
      details: { caller: actorDescriptor(actor), ...details },
      request,
      trustProxy: this.trustProxy
    });
  }

  async _resumeExisting(existing, normalized, actor, request) {
    const run = this.diagnosticStore.run(this.workspaceId, existing.diagnostic_run_id, { includeEvidence: true, includeMetrics: true });
    const link = this.relayService.getLinkByDiagnosticRun(run.id);
    if (!link) throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_LINK_STATE_INVALID", "The existing ad-hoc diagnostic has no relay link.", { status: 409, details: { runId: run.id } });
    const requestSnapshot = plainObject(link.request);
    const storedAdHoc = plainObject(plainObject(requestSnapshot.requestMetadata).adHocSingleQuestion);
    if (storedAdHoc.requestFingerprint !== normalized.requestFingerprint) {
      throw new DiagnosticRelayError("AD_HOC_DIAGNOSTIC_IDEMPOTENCY_CONFLICT", "The idempotencyKey is already bound to a different ad-hoc diagnostic request.", { status: 409, details: { diagnosticRunId: run.id } });
    }
    if (link.relayRunId) {
      return { reused: true, quote: null, project: this._projectPayload(this.diagnosticStore.project(this.workspaceId, run.projectId)), questionSet: this.diagnosticStore.questionSet(this.workspaceId, run.questionSetId), link, run };
    }
    const projectId = text(requestSnapshot.projectId || run.projectId, "stored projectId", 180, true);
    const questionSetId = text(requestSnapshot.questionSetId || run.questionSetId, "stored questionSetId", 180, true);
    const resumed = await this.relayService.createRun({
      projectId,
      questionSetId,
      items: Array.isArray(requestSnapshot.items) ? requestSnapshot.items : [],
      brand: plainObject(requestSnapshot.brand),
      competitors: Array.isArray(requestSnapshot.competitors) ? requestSnapshot.competitors : [],
      analysisScope: plainObject(requestSnapshot.analysisScope),
      requestMetadata: plainObject(requestSnapshot.requestMetadata),
      consent: plainObject(requestSnapshot.consent),
      clientRunId: link.clientRunId,
      idempotencyKey: normalized.idempotencyKey,
      actor,
      request
    });
    this._audit("diagnostic.relay.ad_hoc.retry", "diagnostic_relay_link", resumed.link.id, {
      diagnosticRunId: resumed.run.id,
      projectId,
      questionSetId,
      requestFingerprint: normalized.requestFingerprint
    }, actor, request);
    return { reused: true, quote: null, project: this._projectPayload(this.diagnosticStore.project(this.workspaceId, projectId)), questionSet: this.diagnosticStore.questionSet(this.workspaceId, questionSetId), ...resumed };
  }

  async createRun(input = {}, { actor = null, request = null } = {}) {
    const normalized = this._normalize(input);
    const existing = this._existingLink(normalized.idempotencyKey);
    if (existing) return this._resumeExisting(existing, normalized, actor, request);

    const project = this.diagnosticStore.createProject({
      workspaceId: this.workspaceId,
      name: `Ad-hoc single-question diagnostic ${normalized.requestFingerprint.slice(0, 12)}`,
      diagnosticType: "comprehensive",
      targetBrand: normalized.brand.name,
      objective: "Isolated relay-backed single-question diagnostic.",
      scope: {
        temporary: true,
        source: "relay_ad_hoc_single_question",
        requestFingerprint: normalized.requestFingerprint,
        createdBy: "customer_server_api"
      },
      actor,
      request
    });
    let questionSet = this.diagnosticStore.createQuestionSet({
      workspaceId: this.workspaceId,
      projectId: project.id,
      name: "Ad-hoc single-question frozen set",
      questions: [{
        id: `ADHOC-${normalized.requestFingerprint.slice(0, 24)}`,
        text: normalized.question,
        intent: "ad_hoc_single_question",
        category: "relay"
      }],
      actor,
      request
    });
    questionSet = this.diagnosticStore.freezeQuestionSet({ workspaceId: this.workspaceId, questionSetId: questionSet.id, actor, request });

    this._audit("diagnostic.relay.ad_hoc.authorized", "diagnostic_project", project.id, {
      projectId: project.id,
      questionSetId: questionSet.id,
      requestFingerprint: normalized.requestFingerprint,
      questionSha256: sha256(normalized.question),
      authorization: normalized.authorization,
      platforms: normalized.platforms,
      terminals: normalized.terminals,
      modes: normalized.modes
    }, actor, request);

    // Quote and submission intentionally go through the same relay service as
    // normal project diagnostics. The relay client adds the instance HMAC.
    const quote = await this.relayService.quote({
      projectId: project.id,
      questionSetId: questionSet.id,
      platforms: normalized.platforms,
      terminals: normalized.terminals,
      modes: normalized.modes
    });
    const created = await this.relayService.createRun({
      projectId: project.id,
      questionSetId: questionSet.id,
      platforms: normalized.platforms,
      terminals: normalized.terminals,
      modes: normalized.modes,
      brand: normalized.brand,
      competitors: normalized.competitors,
      analysisScope: normalized.analysisScope,
      requestMetadata: {
        source: "customer_server_ad_hoc_single_question",
        adHocSingleQuestion: { requestFingerprint: normalized.requestFingerprint, temporaryProject: true }
      },
      consent: normalized.consent,
      clientRunId: normalized.clientRunId,
      idempotencyKey: normalized.idempotencyKey,
      actor,
      request
    });
    this._audit("diagnostic.relay.ad_hoc.submitted", "diagnostic_relay_link", created.link.id, {
      diagnosticRunId: created.run.id,
      relayRunId: created.link.relayRunId || null,
      projectId: project.id,
      questionSetId: questionSet.id,
      requestFingerprint: normalized.requestFingerprint,
      quote: quoteSummary(quote)
    }, actor, request);
    return { reused: false, quote, project: this._projectPayload(project), questionSet, ...created };
  }
}

export default AdHocDiagnosticService;
