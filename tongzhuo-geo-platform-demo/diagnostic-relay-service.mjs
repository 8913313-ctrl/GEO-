import crypto from "node:crypto";
import { RelayClientError, payloadHash, stableJson } from "./diagnostic-relay-client.mjs";

const DEFAULT_WORKSPACE_ID = "default";
const LIVE_SOURCE_KIND = "aidso";

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function actorId(actor) { return actor?.userId || actor?.id || actor?.user?.id || null; }
function parseJson(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch { return fallback; }
}
function json(value) { return stableJson(value === undefined ? {} : value); }
function limitedText(value, maximum = 5_000) { return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function firstUrl(quotes) {
  for (const quote of asArray(quotes)) {
    const candidate = String(quote?.url || quote?.link || "").trim();
    try {
      const parsed = new URL(candidate);
      if (["http:", "https:"].includes(parsed.protocol)) return parsed.toString();
    } catch {
      // Ignore malformed provider URLs; the answer itself remains usable evidence.
    }
  }
  return "";
}
function mapTerminal(value) {
  const normalized = String(value || "web").trim().toLowerCase();
  return ({ 网页: "web", 手机: "mobile", 电商: "commerce", ecommerce: "commerce", "电商端": "commerce" })[normalized] || normalized;
}
function mapMode(value) {
  const normalized = String(value || "fast").trim().toLowerCase();
  return ({ 快速: "fast", "快速诊断": "fast", "深度思考": "deep", 专家: "expert" })[normalized] || normalized;
}
function mapPlatform(value) {
  const normalized = String(value || "").trim();
  return ({ 豆包: "DB", DeepSeek: "DS", deepseek: "DS", 腾讯元宝: "YB", 元宝: "YB", 通义千问: "QW", 千问: "QW", 百度AI: "BD", "百度 AI": "BD", 文心一言: "WX", Kimi: "KIMI", 红书问一问: "RED" })[normalized] || normalized;
}

export class DiagnosticRelayError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "DiagnosticRelayError";
    this.code = code;
    this.status = Number(options.status || options.statusCode || 502);
    this.statusCode = this.status;
    this.details = options.details;
    this.retryable = Boolean(options.retryable);
  }
}

function linkPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    diagnosticRunId: row.diagnostic_run_id,
    relayRunId: row.relay_run_id || null,
    clientRunId: row.client_run_id,
    idempotencyKey: row.idempotency_key,
    questionSetChecksum: row.question_set_checksum || "",
    request: parseJson(row.request_json, {}),
    remoteRun: parseJson(row.remote_run_json, {}),
    status: row.status,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    lastPulledAt: row.last_pulled_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function receiptPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    deliveryId: row.delivery_id,
    diagnosticRunId: row.diagnostic_run_id,
    relayRunId: row.relay_run_id,
    kind: row.kind,
    payloadHash: row.payload_hash,
    payload: parseJson(row.payload_json, {}),
    status: row.status,
    evidenceId: row.evidence_id || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    receivedAt: row.received_at,
    acknowledgedAt: row.acknowledged_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class DiagnosticRelayService {
  constructor({ database, diagnosticStore, contentAssetStore = null, client = null, workspaceId = DEFAULT_WORKSPACE_ID, pullBatchSize = 50 } = {}) {
    if (!database?.connection) throw new TypeError("DiagnosticRelayService requires a ProductionDatabase instance.");
    if (!diagnosticStore) throw new TypeError("DiagnosticRelayService requires a DiagnosticStore instance.");
    this.database = database;
    this.connection = database.connection;
    this.diagnosticStore = diagnosticStore;
    this.contentAssetStore = contentAssetStore;
    this.client = client;
    this.workspaceId = String(workspaceId || DEFAULT_WORKSPACE_ID);
    this.pullBatchSize = Math.max(1, Math.min(200, Number(pullBatchSize) || 50));
    this.lastPullAt = null;
    this.lastPullError = null;
  }

  configured() { return Boolean(this.client); }

  status() {
    return {
      configured: this.configured(),
      instanceId: this.client?.instanceId || null,
      clientId: this.client?.clientId || null,
      baseUrl: this.client?.baseUrl || null,
      deliveryConsumer: this.client?.deliveryConsumer || null,
      pullBatchSize: this.pullBatchSize,
      lastPullAt: this.lastPullAt,
      lastPullError: this.lastPullError
    };
  }

  health() {
    return {
      configured: this.configured(),
      lastPullAt: this.lastPullAt,
      lastPullError: this.lastPullError
        ? { code: this.lastPullError.code || "RELAY_PULL_FAILED", message: this.lastPullError.message || "" }
        : null
    };
  }

  async capabilities() {
    return this._requireClient().capabilities();
  }

  async quota() {
    return this._requireClient().quota();
  }

  async quote({ projectId, questionSetId = null, items = [], platforms = [], terminals = [], modes = [], allowSupersededQuestionSet = false } = {}) {
    const client = this._requireClient();
    const project = this.diagnosticStore.project(this.workspaceId, projectId);
    const questionSet = questionSetId
      ? this.diagnosticStore.questionSet(this.workspaceId, questionSetId)
      : this.diagnosticStore.latestFrozenQuestionSet(this.workspaceId, projectId);
    if (questionSet.projectId !== projectId || (questionSet.status !== "frozen" && !(allowSupersededQuestionSet === true && questionSet.status === "superseded"))) {
      throw new DiagnosticRelayError("RELAY_QUESTION_SET_INVALID", "中转报价必须使用该项目已冻结的问题集。", { status: 422 });
    }
    const normalizedItems = this._normalizeItems({ questionSet, items, platforms, terminals, modes });
    const quote = await client.quoteEffectRun({
      items: normalizedItems.map((item) => ({
        clientItemId: item.itemId,
        questionId: item.questionId,
        prompt: item.prompt,
        platform: item.platform,
        terminal: item.terminal,
        mode: item.mode
      }))
    });
    return { ...quote, projectId, questionSetId: questionSet.id, questionSetChecksum: questionSet.checksum };
  }

  _requireClient() {
    if (!this.client) throw new DiagnosticRelayError("RELAY_CLIENT_NOT_CONFIGURED", "客户后台尚未配置中转站实例凭证。", { status: 503 });
    return this.client;
  }

  _findLinkByIdempotency(idempotencyKey) {
    return this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE workspace_id = ? AND idempotency_key = ?").get(this.workspaceId, idempotencyKey);
  }

  _findLinkByRunId(runId) {
    return this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE workspace_id = ? AND diagnostic_run_id = ?").get(this.workspaceId, runId);
  }

  _findLinkByRelayRunId(relayRunId) {
    return this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE workspace_id = ? AND relay_run_id = ?").get(this.workspaceId, relayRunId);
  }

  _updateLink(linkId, patch = {}) {
    const current = this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE id = ? AND workspace_id = ?").get(linkId, this.workspaceId);
    if (!current) throw new DiagnosticRelayError("RELAY_LINK_NOT_FOUND", "本地中转映射不存在。", { status: 404 });
    const timestamp = now();
    const next = {
      relayRunId: patch.relayRunId === undefined ? current.relay_run_id : patch.relayRunId,
      requestJson: patch.request === undefined ? current.request_json : json(patch.request),
      remoteRunJson: patch.remoteRun === undefined ? current.remote_run_json : json(patch.remoteRun),
      status: patch.status === undefined ? current.status : String(patch.status),
      errorCode: patch.errorCode === undefined ? current.error_code : patch.errorCode || null,
      errorMessage: patch.errorMessage === undefined ? current.error_message : limitedText(patch.errorMessage, 2_000) || null,
      lastPulledAt: patch.lastPulledAt === undefined ? current.last_pulled_at : patch.lastPulledAt || null
    };
    this.connection.prepare(`
      UPDATE diagnostic_relay_links
      SET relay_run_id = ?, request_json = ?, remote_run_json = ?, status = ?, error_code = ?, error_message = ?, last_pulled_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `).run(next.relayRunId, next.requestJson, next.remoteRunJson, next.status, next.errorCode, next.errorMessage, next.lastPulledAt, timestamp, linkId, this.workspaceId);
    return linkPayload(this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE id = ?").get(linkId));
  }

  _insertLink({ diagnosticRunId, relayRunId = null, clientRunId, idempotencyKey, questionSetChecksum, request }) {
    const timestamp = now();
    const linkId = id("DRL");
    this.connection.prepare(`
      INSERT INTO diagnostic_relay_links(
        id, workspace_id, diagnostic_run_id, relay_run_id, client_run_id, idempotency_key,
        question_set_checksum, request_json, remote_run_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', 'pending', ?, ?)
    `).run(linkId, this.workspaceId, diagnosticRunId, relayRunId, clientRunId, idempotencyKey, questionSetChecksum || "", json(request), timestamp, timestamp);
    return linkPayload(this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE id = ?").get(linkId));
  }

  getLinkByDiagnosticRun(runId) { return linkPayload(this._findLinkByRunId(runId)); }
  getLinkByIdempotency(idempotencyKey) { return linkPayload(this._findLinkByIdempotency(idempotencyKey)); }
  getLinkByRelayRun(relayRunId) { return linkPayload(this._findLinkByRelayRunId(relayRunId)); }
  getLink(runId) { return this.getLinkByDiagnosticRun(runId); }

  listLinks({ projectId = "", diagnosticRunId = "", limit = 100 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const params = [this.workspaceId];
    let sql = `SELECT l.* FROM diagnostic_relay_links l JOIN diagnostic_runs r ON r.id = l.diagnostic_run_id JOIN diagnostic_projects p ON p.id = r.project_id WHERE l.workspace_id = ?`;
    if (projectId) { sql += " AND p.id = ?"; params.push(projectId); }
    if (diagnosticRunId) { sql += " AND l.diagnostic_run_id = ?"; params.push(diagnosticRunId); }
    sql += " ORDER BY l.created_at DESC LIMIT ?";
    params.push(normalizedLimit);
    return this.connection.prepare(sql).all(...params).map(linkPayload);
  }

  _normalizeItems({ questionSet, items, platforms, terminals, modes }) {
    const questions = asArray(questionSet.questions);
    const provided = asArray(items);
    if (provided.length) {
      return provided.map((item, ordinal) => ({
        itemId: limitedText(item.itemId || item.clientItemId || `item-${ordinal + 1}`, 256),
        questionId: limitedText(item.questionId || questions[ordinal]?.id || `Q-${ordinal + 1}`, 256),
        prompt: limitedText(item.prompt || item.question || questions[ordinal]?.text, 8_000),
        platform: mapPlatform(item.platform),
        terminal: mapTerminal(item.terminal),
        mode: mapMode(item.mode),
        metadata: item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : {}
      }));
    }
    const selectedPlatforms = asArray(platforms).map(mapPlatform).filter(Boolean);
    const selectedTerminals = (asArray(terminals).length ? terminals : ["web"]).map(mapTerminal).filter(Boolean);
    const selectedModes = (asArray(modes).length ? modes : ["fast"]).map(mapMode).filter(Boolean);
    if (!selectedPlatforms.length) throw new DiagnosticRelayError("RELAY_ITEMS_REQUIRED", "请至少选择一个中转平台。", { status: 422 });
    const output = [];
    for (const question of questions) {
      for (const platform of selectedPlatforms) {
        for (const terminal of selectedTerminals) {
          for (const mode of selectedModes) {
            const suffix = `${platform}-${terminal}-${mode}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
            output.push({ itemId: `${question.id}-${suffix}`, questionId: question.id, prompt: question.text, platform, terminal, mode, metadata: {} });
          }
        }
      }
    }
    if (!output.length) throw new DiagnosticRelayError("RELAY_ITEMS_REQUIRED", "冻结问题集没有可执行的问题。", { status: 422 });
    return output;
  }

  async createRun({ projectId, questionSetId = null, items = [], platforms = [], terminals = [], modes = [], brand = {}, competitors = [], analysisScope = {}, requestMetadata = {}, consent = {}, clientRunId = "", idempotencyKey = "", maxCustomerCredits = undefined, allowSupersededQuestionSet = false, actor = null, request = null } = {}) {
    const client = this._requireClient();
    const project = this.diagnosticStore.project(this.workspaceId, projectId);
    const questionSet = questionSetId ? this.diagnosticStore.questionSet(this.workspaceId, questionSetId) : this.diagnosticStore.latestFrozenQuestionSet(this.workspaceId, projectId);
    if (questionSet.projectId !== projectId || (questionSet.status !== "frozen" && !(allowSupersededQuestionSet === true && questionSet.status === "superseded"))) throw new DiagnosticRelayError("RELAY_QUESTION_SET_INVALID", "中转任务必须使用该项目已冻结的问题集。", { status: 422 });
    const normalizedItems = this._normalizeItems({ questionSet, items, platforms, terminals, modes });
    const normalizedClientRunId = limitedText(clientRunId || `client-${projectId}-${questionSet.version}-${crypto.randomUUID()}`, 256);
    const normalizedIdempotencyKey = limitedText(idempotencyKey || `diagnostic:${projectId}:${questionSet.id}:${normalizedClientRunId}`, 512);
    const consentPayload = { externalDataConsent: consent.externalDataConsent === true, consentedAt: consent.consentedAt || now(), method: consent.method || "authenticated_api" };
    if (!consentPayload.externalDataConsent) throw new DiagnosticRelayError("RELAY_CONSENT_REQUIRED", "向爱搜发送问题前必须确认外部数据发送范围。", { status: 422 });
    const requestSnapshot = {
      projectId,
      questionSetId: questionSet.id,
      questionSetChecksum: questionSet.checksum,
      brand: brand && typeof brand === "object" && !Array.isArray(brand) && (brand.name || asArray(brand.aliases).length)
        ? brand
        : { name: project.targetBrand },
      competitors: asArray(competitors).map((item) => limitedText(item, 240)).filter(Boolean),
      analysisScope: analysisScope && typeof analysisScope === "object" && !Array.isArray(analysisScope) ? analysisScope : {},
      requestMetadata: requestMetadata && typeof requestMetadata === "object" && !Array.isArray(requestMetadata) ? requestMetadata : {},
      maxCustomerCredits: maxCustomerCredits === undefined ? null : maxCustomerCredits,
      items: normalizedItems,
      consent: consentPayload
    };
    let link = this._findLinkByIdempotency(normalizedIdempotencyKey);
    if (!link) {
      const localRun = this.diagnosticStore.createRun({
        workspaceId: this.workspaceId,
        projectId,
        questionSetId: questionSet.id,
        evidenceScope: { research: true, enterprise: false, live: true },
        allowSupersededQuestionSet,
        input: { relay: { clientRunId: normalizedClientRunId, idempotencyKey: normalizedIdempotencyKey }, request: requestSnapshot },
        actor,
        request
      });
      link = this._insertLink({ diagnosticRunId: localRun.id, clientRunId: normalizedClientRunId, idempotencyKey: normalizedIdempotencyKey, questionSetChecksum: questionSet.checksum, request: requestSnapshot });
    }
    if (link.relayRunId) return { link, run: this.diagnosticStore.run(this.workspaceId, link.diagnosticRunId, { includeEvidence: true, includeMetrics: true }) };
    try {
      const remote = await client.createEffectRun({
        clientRunId: link.clientRunId,
        projectId,
        questionSetId: questionSet.id,
        questionSetChecksum: questionSet.checksum,
        brand: requestSnapshot.brand,
        competitors: requestSnapshot.competitors,
        analysisScope: requestSnapshot.analysisScope,
        requestMetadata: requestSnapshot.requestMetadata,
        items: requestSnapshot.items,
        ...(requestSnapshot.maxCustomerCredits === null ? {} : { maxCustomerCredits: requestSnapshot.maxCustomerCredits }),
        consent: consentPayload
      }, link.idempotencyKey);
      const remoteRun = remote?.run || {};
      link = this._updateLink(link.id, {
        relayRunId: remote.relayRunId || remoteRun.relayRunId,
        remoteRun,
        status: ["completed", "partial", "failed", "attention", "cancelled"].includes(remoteRun.status) ? remoteRun.status : "submitted",
        errorCode: null,
        errorMessage: null
      });
      const localRun = this.diagnosticStore.run(this.workspaceId, link.diagnosticRunId);
      if (localRun.status === "queued") this.diagnosticStore.startRun({ workspaceId: this.workspaceId, runId: link.diagnosticRunId, actor, request });
      return { link, run: this.diagnosticStore.run(this.workspaceId, link.diagnosticRunId, { includeEvidence: true, includeMetrics: true }) };
    } catch (error) {
      const wrapped = error instanceof RelayClientError ? error : new DiagnosticRelayError("RELAY_CREATE_FAILED", error.message || "创建中转任务失败。", { cause: error });
      // A timeout/5xx can happen after the relay accepted the idempotent
      // request. Keep the local run queued so the same idempotency key can be
      // retried safely; deterministic failures terminally fail it.
      const retryable = Boolean(wrapped.retryable);
      this._updateLink(link.id, { status: retryable ? "pending" : "failed", errorCode: wrapped.code, errorMessage: wrapped.message });
      if (!retryable) {
        const localRun = this.diagnosticStore.run(this.workspaceId, link.diagnosticRunId);
        if (["queued", "running"].includes(localRun.status)) {
          this.diagnosticStore.failRun({ workspaceId: this.workspaceId, runId: link.diagnosticRunId, errorCode: wrapped.code, errorMessage: wrapped.message, actor, request });
        }
      }
      throw wrapped;
    }
  }

  _receipt(delivery, link) {
    const existing = this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE workspace_id = ? AND delivery_id = ?").get(this.workspaceId, delivery.deliveryId);
    if (existing) {
      this.connection.prepare("UPDATE diagnostic_relay_delivery_receipts SET status = CASE WHEN status = 'synced' THEN status ELSE 'processing' END, error_code = NULL, error_message = NULL, updated_at = ? WHERE id = ?").run(now(), existing.id);
      return receiptPayload(this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE id = ?").get(existing.id));
    }
    const timestamp = now();
    const receiptId = id("DRR");
    this.connection.prepare(`
      INSERT INTO diagnostic_relay_delivery_receipts(
        id, workspace_id, delivery_id, diagnostic_run_id, relay_run_id, kind, payload_hash, payload_json,
        status, received_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)
    `).run(receiptId, this.workspaceId, delivery.deliveryId, link.diagnosticRunId, link.relayRunId, delivery.kind, delivery.payloadHash, json(delivery.payload), timestamp, timestamp, timestamp);
    return receiptPayload(this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE id = ?").get(receiptId));
  }

  _updateReceipt(receiptId, patch = {}) {
    const current = this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE id = ? AND workspace_id = ?").get(receiptId, this.workspaceId);
    if (!current) throw new DiagnosticRelayError("RELAY_RECEIPT_NOT_FOUND", "本地交付收据不存在。", { status: 500 });
    const timestamp = now();
    this.connection.prepare(`
      UPDATE diagnostic_relay_delivery_receipts
      SET status = ?, evidence_id = ?, error_code = ?, error_message = ?, acknowledged_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `).run(
      patch.status === undefined ? current.status : patch.status,
      patch.evidenceId === undefined ? current.evidence_id : patch.evidenceId || null,
      patch.errorCode === undefined ? current.error_code : patch.errorCode || null,
      patch.errorMessage === undefined ? current.error_message : limitedText(patch.errorMessage, 2_000) || null,
      patch.acknowledgedAt === undefined ? current.acknowledged_at : patch.acknowledgedAt || null,
      timestamp,
      receiptId,
      this.workspaceId
    );
    return receiptPayload(this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE id = ?").get(receiptId));
  }

  _itemRequest(link, itemId) {
    const request = link.request || {};
    return asArray(request.items).find((item) => item.itemId === itemId || item.clientItemId === itemId) || {};
  }

  _evidenceInput(delivery, link) {
    const payload = delivery.payload || {};
    const normalized = payload.normalized && typeof payload.normalized === "object" ? payload.normalized : {};
    const item = this._itemRequest(link, payload.itemId);
    const upstream = payload.upstream || {};
    const completed = payload.status === "completed";
    const answer = limitedText(normalized.answerText || normalized.answer || payload.error?.message || "", 5_000);
    const observedAt = payload.observedAt || normalized.observedAt || payload.createdAt || now();
    const reqId = limitedText(upstream.reqId || normalized.upstreamReqId || "", 500);
    const verified = completed && Boolean(reqId) && Boolean(answer) && (normalized.qualityStatus === "verified" || payload.quality?.status === "verified");
    const sourceUrl = firstUrl(normalized.quotes);
    const platform = upstream.platform || item.platform || "unknown";
    const terminal = upstream.terminal || item.terminal || "web";
    const mode = upstream.mode || item.mode || "fast";
    return {
      id: `LIVE-${delivery.deliveryId}`,
      evidenceType: "live",
      sourceKind: LIVE_SOURCE_KIND,
      sourceId: reqId || delivery.deliveryId,
      title: `${platform} · ${terminal} · ${mode} AI 回答`,
      sourceUrl,
      claim: answer || limitedText(payload.error?.message || "该任务未返回可用回答。", 5_000),
      excerpt: answer || limitedText(payload.error?.message || "该任务未返回可用回答。", 5_000),
      verificationStatus: verified ? "verified" : completed && answer ? "supplied" : "not_available",
      observedAt,
      provenance: {
        collectionMethod: "relay_pull",
        platform,
        terminal,
        mode,
        relayRunId: link.relayRunId,
        clientRunId: link.clientRunId,
        deliveryId: delivery.deliveryId,
        upstreamReqId: reqId || null,
        normalizerVersion: payload.quality?.normalizerVersion || normalized.normalizerVersion || null,
        itemId: payload.itemId || null,
        questionId: item.questionId || null
      },
      payload: {
        delivery: payload,
        request: item,
        payloadHash: delivery.payloadHash
      }
    };
  }

  _syncItem(delivery, link, receipt) {
    const evidenceInput = this._evidenceInput(delivery, link);
    const evidence = this.diagnosticStore.addEvidence({ workspaceId: this.workspaceId, runId: link.diagnosticRunId, ...evidenceInput });
    if (this.contentAssetStore && evidence.verificationStatus === "verified") this.contentAssetStore.ingestEvidence(evidence, { workspaceId: this.workspaceId });
    const payload = delivery.payload || {};
    const normalized = payload.normalized && typeof payload.normalized === "object" ? payload.normalized : {};
    if (payload.status === "completed" && evidence.verificationStatus === "verified") {
      const dimension = `item:${limitedText(payload.itemId || delivery.deliveryId, 240)}`;
      const values = [
        ["brand_mentioned", "品牌是否提及", Boolean(normalized.brandMentioned), "boolean"],
        ["brand_mention_count", "品牌提及次数", Number(normalized.brandMentionCount || 0), "count"],
        ["quote_count", "引用数量", Number(normalized.quoteCount || 0), "count"],
        ["unique_domain_count", "独立引用域名数", Number(normalized.uniqueDomainCount || 0), "count"]
      ];
      for (const [metricKey, label, value, unit] of values) {
        this.diagnosticStore.addMetric({
          workspaceId: this.workspaceId,
          runId: link.diagnosticRunId,
          evidenceId: evidence.id,
          evidenceType: "live",
          dimension,
          metricKey,
          label,
          value,
          unit,
          status: "measured",
          methodology: "由中央中转站爱搜结果中的标准化字段计算；只绑定 verified、带时间戳的 live evidence。"
        });
      }
    }
    return evidence;
  }

  _maybeFinalizeAfterSummary(linkId) {
    const row = this.connection.prepare("SELECT * FROM diagnostic_relay_links WHERE id = ? AND workspace_id = ?").get(linkId, this.workspaceId);
    if (!row) return null;
    const link = linkPayload(row);
    const summary = link.remoteRun?.summary || null;
    if (!summary) return link;
    const totalItems = Number(summary.totalItems || summary.total_items || link.request?.items?.length || 0);
    const syncedItems = Number(this.connection.prepare(`
      SELECT COUNT(*) AS count
      FROM diagnostic_relay_delivery_receipts
      WHERE workspace_id = ? AND diagnostic_run_id = ? AND kind = 'item_result' AND status = 'synced'
    `).get(this.workspaceId, link.diagnosticRunId)?.count || 0);
    if (totalItems > 0 && syncedItems < totalItems) return link;
    const status = String(summary.status || "").toLowerCase();
    if (["completed", "partial", "failed", "cancelled"].includes(status)) {
      this._updateLink(link.id, { status, lastPulledAt: now() });
    }
    const localRun = this.diagnosticStore.run(this.workspaceId, link.diagnosticRunId);
    if (["completed", "partial"].includes(status) && ["queued", "running"].includes(localRun.status)) {
      this.diagnosticStore.completeRun({ workspaceId: this.workspaceId, runId: link.diagnosticRunId });
    } else if (["failed", "cancelled"].includes(status) && ["queued", "running"].includes(localRun.status)) {
      this.diagnosticStore.failRun({ workspaceId: this.workspaceId, runId: link.diagnosticRunId, errorCode: `RELAY_RUN_${status.toUpperCase()}`, errorMessage: `中转运行状态：${status}` });
    }
    return this.getLinkByDiagnosticRun(link.diagnosticRunId);
  }

  _syncSummary(delivery, link) {
    const payload = delivery.payload || {};
    const status = String(payload.status || "").toLowerCase();
    const mapped = ["completed", "partial", "failed", "attention", "cancelled"].includes(status) ? status : "running";
    this._updateLink(link.id, {
      status: mapped,
      lastPulledAt: now(),
      errorCode: null,
      errorMessage: null,
      remoteRun: { ...(link.remoteRun || {}), summary: payload }
    });
    // The outbox is at-least-once and a summary can arrive before its item
    // deliveries. Keep the local run running until every item receipt has been
    // synced, so a late live evidence record is never hidden by a premature
    // terminal status.
    this._maybeFinalizeAfterSummary(link.id);
    return this.getLinkByDiagnosticRun(link.diagnosticRunId);
  }

  async _syncDelivery(delivery) {
    if (!delivery?.deliveryId || !delivery?.payloadHash) throw new DiagnosticRelayError("RELAY_DELIVERY_INVALID", "中转交付缺少 deliveryId 或 payloadHash。", { status: 502 });
    if (payloadHash(delivery.payload || {}) !== delivery.payloadHash) throw new DiagnosticRelayError("RELAY_DELIVERY_HASH_MISMATCH", "中转交付 payloadHash 校验失败。", { status: 502 });
    const relayRunId = delivery.payload?.relayRunId;
    const link = this._findLinkByRelayRunId(relayRunId);
    if (!link) throw new DiagnosticRelayError("RELAY_LINK_NOT_FOUND", `未找到中转运行 ${relayRunId || ""} 对应的本地诊断运行。`, { status: 409 });
    const linkData = linkPayload(link);
    let receipt = this._receipt(delivery, linkData);
    if (receipt.status !== "synced") {
      let evidence = null;
      try {
        if (delivery.kind === "item_result") evidence = this._syncItem(delivery, linkData, receipt);
        else if (delivery.kind === "run_summary") this._syncSummary(delivery, linkData);
        else if (delivery.kind === "item_attention") {
          const payload = delivery.payload || {};
          this._updateLink(link.id, { status: "attention", lastPulledAt: now(), errorCode: payload.error?.code || "RELAY_SUBMISSION_UNCERTAIN", errorMessage: payload.error?.message || "中转提交状态不确定。" });
        } else throw new DiagnosticRelayError("RELAY_DELIVERY_KIND_UNSUPPORTED", `不支持的中转交付类型：${delivery.kind}`, { status: 422 });
        receipt = this._updateReceipt(receipt.id, { status: "synced", evidenceId: evidence?.id || null, errorCode: null, errorMessage: null });
      } catch (error) {
        const wrapped = error instanceof DiagnosticRelayError ? error : new DiagnosticRelayError(error.code || "RELAY_LOCAL_SYNC_FAILED", error.message || "写入本地诊断证据失败。", { status: error.status || 500, cause: error });
        this._updateReceipt(receipt.id, { status: "failed", errorCode: wrapped.code, errorMessage: wrapped.message });
        throw wrapped;
      }
    }
    if (delivery.kind === "item_result") {
      this._updateLink(link.id, { status: delivery.payload?.status === "failed" ? "partial" : "running", lastPulledAt: now() });
      this._maybeFinalizeAfterSummary(link.id);
    }
    return { link: linkPayload(this._findLinkByRunId(link.diagnostic_run_id)), receipt };
  }

  async pullDeliveries({ limit = this.pullBatchSize } = {}) {
    const client = this._requireClient();
    const pulledAt = now();
    this.lastPullAt = pulledAt;
    this.lastPullError = null;
    const response = await client.pullDeliveries(limit);
    const deliveries = asArray(response?.deliveries);
    const results = [];
    for (const delivery of deliveries) {
      try {
        const synced = await this._syncDelivery(delivery);
        await client.acknowledgeDelivery(delivery.deliveryId, delivery.payloadHash);
        const receiptRow = this.connection.prepare("SELECT * FROM diagnostic_relay_delivery_receipts WHERE workspace_id = ? AND delivery_id = ?").get(this.workspaceId, delivery.deliveryId);
        const receipt = receiptRow ? this._updateReceipt(receiptRow.id, { status: "synced", evidenceId: synced.receipt.evidenceId, acknowledgedAt: now() }) : synced.receipt;
        results.push({ deliveryId: delivery.deliveryId, status: "acknowledged", link: synced.link, receipt });
      } catch (error) {
        const wrapped = error instanceof DiagnosticRelayError ? error : new DiagnosticRelayError(error.code || "RELAY_DELIVERY_SYNC_FAILED", error.message || "同步中转交付失败。", { status: error.status || 502, cause: error });
        try { await client.releaseDelivery(delivery.deliveryId, { delayMs: 5_000, error: wrapped.message }); } catch (releaseError) {
          wrapped.details = { ...(wrapped.details || {}), releaseError: releaseError.message };
        }
        results.push({ deliveryId: delivery.deliveryId, status: "failed", code: wrapped.code, message: wrapped.message });
        this.lastPullError = { code: wrapped.code, message: wrapped.message };
      }
    }
    return { pulled: deliveries.length, acknowledged: results.filter((item) => item.status === "acknowledged").length, failed: results.filter((item) => item.status === "failed").length, results, serverTime: response?.serverTime || null };
  }

  async pullRun(runId, options = {}) {
    const link = this._findLinkByRunId(runId);
    if (!link) throw new DiagnosticRelayError("RELAY_LINK_NOT_FOUND", "本地中转映射不存在。", { status: 404 });
    const result = await this.pullDeliveries(options);
    return { link: this.getLinkByDiagnosticRun(runId), ...result };
  }

  async cancelRun(runId) {
    const client = this._requireClient();
    const link = this._findLinkByRunId(runId);
    if (!link) throw new DiagnosticRelayError("RELAY_LINK_NOT_FOUND", "本地中转映射不存在。", { status: 404 });
    if (link.relay_run_id) await client.cancelEffectRun(link.relay_run_id);
    this._updateLink(link.id, { status: "cancelled", lastPulledAt: now() });
    const localRun = this.diagnosticStore.run(this.workspaceId, runId);
    if (["queued", "running"].includes(localRun.status)) this.diagnosticStore.failRun({ workspaceId: this.workspaceId, runId, errorCode: "RELAY_RUN_CANCELLED", errorMessage: "客户已取消中转检测运行。" });
    return { link: this.getLinkByDiagnosticRun(runId), run: this.diagnosticStore.run(this.workspaceId, runId, { includeEvidence: true, includeMetrics: true }) };
  }
}
