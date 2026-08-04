import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdHocDiagnosticService } from "../diagnostic-ad-hoc-service.mjs";
import { requireAdHocDiagnosticServiceApi } from "../diagnostic-ad-hoc-auth.mjs";
import { createDiagnosticApi } from "../diagnostic-api.mjs";
import { DiagnosticRelayClient, payloadHash, signInstanceRequest } from "../diagnostic-relay-client.mjs";
import { DiagnosticRelayService } from "../diagnostic-relay-service.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-ad-hoc-diagnostic-"));
let database;

function responseCapture() {
  return {
    status: null,
    payload: null,
    json(status, payload) {
      this.status = status;
      this.payload = payload;
      return payload;
    }
  };
}

try {
  const relaySecret = "relay-client-secret-for-ad-hoc-check";
  const serviceApiToken = "customer-server-only-ad-hoc-api-token";
  const requests = [];
  const deliveryBatches = [];
  let createCount = 0;
  let quoteCount = 0;
  let acknowledgedCount = 0;
  const fetchImpl = async (url, options = {}) => {
    const target = new URL(String(url));
    requests.push({ url: String(url), options });
    if (target.pathname === "/client/v1/effect-runs/quote" && options.method === "POST") {
      quoteCount += 1;
      return new Response(JSON.stringify({ estimatedCustomerCredits: 4, currency: "credits", priceSnapshot: [{ customerCredits: 2 }, { customerCredits: 2 }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/effect-runs" && options.method === "POST") {
      createCount += 1;
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ relayRunId: `relay-ad-hoc-check-${createCount}`, created: true, run: { relayRunId: `relay-ad-hoc-check-${createCount}`, clientRunId: body.clientRunId, status: "queued" } }), { status: 202, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/deliveries" && options.method === "GET") {
      return new Response(JSON.stringify({ deliveries: deliveryBatches.shift() || [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/deliveries\/[^/]+\/ack$/.test(target.pathname) && options.method === "POST") {
      acknowledgedCount += 1;
      return new Response(JSON.stringify({ acknowledged: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/deliveries\/[^/]+\/release$/.test(target.pathname) && options.method === "POST") {
      return new Response(JSON.stringify({ released: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected relay request: ${options.method} ${target.pathname}`);
  };

  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "ad-hoc.sqlite") });
  const diagnosticStore = new DiagnosticStore(database);
  const relayClient = new DiagnosticRelayClient({
    baseUrl: "https://relay.example.test",
    instanceId: "instance-ad-hoc-check",
    clientId: "client-ad-hoc-check",
    clientSecret: relaySecret,
    fetchImpl
  });
  const relayService = new DiagnosticRelayService({ database, diagnosticStore, client: relayClient, pullBatchSize: 10 });
  const adHocDiagnosticService = new AdHocDiagnosticService({ database, diagnosticStore, relayService });

  assert.throws(
    () => requireAdHocDiagnosticServiceApi({ headers: {} }, { token: serviceApiToken }),
    (error) => error.code === "AD_HOC_DIAGNOSTIC_SERVICE_AUTH_REQUIRED"
  );
  assert.throws(
    () => requireAdHocDiagnosticServiceApi({ headers: { "x-tz-ad-hoc-api-key": serviceApiToken } }, { token: "" }),
    (error) => error.code === "AD_HOC_DIAGNOSTIC_SERVICE_API_DISABLED"
  );
  const servicePrincipal = requireAdHocDiagnosticServiceApi({ headers: { "x-tz-ad-hoc-api-key": serviceApiToken } }, { token: serviceApiToken });
  assert.equal(servicePrincipal.service.adHocDiagnostic, true);

  let requestBody = {
    idempotencyKey: "crm-20260803-question-001",
    question: "工业机器人企业应如何评估 GEO 优化服务？",
    platforms: ["DB"],
    terminals: ["web"],
    modes: ["fast"],
    brand: { name: "桐灼示例", aliases: ["桐灼"] },
    competitors: ["竞品 A"],
    analysisScope: { ticketId: "CRM-20260803-001" },
    externalDataConsent: true,
    externalDataConsentAt: "2026-08-03T09:30:00.000Z",
    externalDataConsentMethod: "customer_authorization_record",
    authorizationReference: "CONSENT-20260803-001",
    authorizedBy: "customer-operator-123"
  };
  const diagnosticApi = createDiagnosticApi({
    diagnosticStore,
    requestJson: async () => requestBody,
    relayService,
    adHocDiagnosticService
  });
  const request = { method: "POST", url: "/api/v1/diagnostics/relay/ad-hoc-runs", headers: { "x-tz-ad-hoc-api-key": serviceApiToken, "user-agent": "offline-check" }, socket: { remoteAddress: "127.0.0.1" } };
  const parts = ["api", "v1", "diagnostics", "relay", "ad-hoc-runs"];

  await assert.rejects(
    () => diagnosticApi(request, responseCapture(), parts, { userId: "browser-user", permissions: ["workspace.write"] }),
    (error) => error.code === "AD_HOC_DIAGNOSTIC_SERVICE_ONLY"
  );
  requestBody = { ...requestBody, externalDataConsent: false, idempotencyKey: "crm-20260803-question-no-consent" };
  await assert.rejects(
    () => diagnosticApi(request, responseCapture(), parts, servicePrincipal),
    (error) => error.code === "RELAY_CONSENT_REQUIRED"
  );
  requestBody = { ...requestBody, externalDataConsent: true, idempotencyKey: "crm-20260803-question-001" };
  const firstResponse = responseCapture();
  await diagnosticApi(request, firstResponse, parts, servicePrincipal);
  assert.equal(firstResponse.status, 202);
  assert.equal(firstResponse.payload.ok, true);
  const created = firstResponse.payload.data;
  assert.equal(created.reused, false);
  assert.equal(created.project.temporary, true);
  assert.equal(created.questionSet.status, "frozen");
  assert.equal(created.questionSet.questions.length, 1);
  assert.equal(created.quote.estimatedCustomerCredits, 4);
  assert.equal(created.link.status, "submitted");
  assert.equal(created.run.status, "running");
  assert.equal(quoteCount, 1);
  assert.equal(createCount, 1);

  const quoteRequest = requests.find((entry) => new URL(entry.url).pathname === "/client/v1/effect-runs/quote");
  const createRequest = requests.find((entry) => new URL(entry.url).pathname === "/client/v1/effect-runs");
  for (const entry of [quoteRequest, createRequest]) {
    const target = new URL(entry.url);
    const expectedSignature = signInstanceRequest({
      secret: relaySecret,
      method: entry.options.method,
      requestTarget: `${target.pathname}${target.search}`,
      timestamp: entry.options.headers["x-tz-timestamp"],
      nonce: entry.options.headers["x-tz-nonce"],
      rawBody: entry.options.body
    });
    assert.equal(entry.options.headers["x-tz-signature"], expectedSignature);
  }
  assert.equal(JSON.parse(createRequest.options.body).requestMetadata.source, "customer_server_ad_hoc_single_question");
  assert.equal(JSON.parse(createRequest.options.body).requestMetadata.authorizationReference, undefined);

  const duplicateResponse = responseCapture();
  await diagnosticApi(request, duplicateResponse, parts, servicePrincipal);
  assert.equal(duplicateResponse.status, 202);
  assert.equal(duplicateResponse.payload.data.reused, true);
  assert.equal(quoteCount, 1);
  assert.equal(createCount, 1);
  requestBody = { ...requestBody, question: "同一个幂等键不能绑定另一个问题" };
  await assert.rejects(
    () => diagnosticApi(request, responseCapture(), parts, servicePrincipal),
    (error) => error.code === "AD_HOC_DIAGNOSTIC_IDEMPOTENCY_CONFLICT"
  );
  requestBody = { ...requestBody, question: "工业机器人企业应如何评估 GEO 优化服务？" };

  const item = created.link.request.items[0];
  const itemPayload = {
    relayRunId: created.link.relayRunId,
    clientRunId: created.link.clientRunId,
    itemId: item.itemId,
    status: "completed",
    upstream: { provider: "aidso", reqId: "aidso-ad-hoc-req-1", platform: item.platform, terminal: item.terminal, mode: item.mode },
    observedAt: "2026-08-03T09:35:00.000Z",
    usage: { customerCredits: 2 },
    normalized: {
      answerText: "示例结果：应先确认问题集、证据范围与价格规则。",
      brandMentioned: true,
      brandMentionCount: 1,
      quotes: [{ url: "https://example.com/proof", title: "Example proof" }],
      quoteCount: 1,
      uniqueDomainCount: 1,
      qualityStatus: "verified",
      normalizerVersion: "aidso-normalizer-v1"
    },
    quality: { status: "verified", normalizerVersion: "aidso-normalizer-v1" }
  };
  const summaryPayload = {
    relayRunId: created.link.relayRunId,
    clientRunId: created.link.clientRunId,
    status: "completed",
    billingStatus: "settled",
    totalItems: 1,
    completedItems: 1,
    failedItems: 0,
    chargedCredits: 4,
    completedAt: "2026-08-03T09:36:00.000Z"
  };
  deliveryBatches.push([
    { deliveryId: "ad-hoc-item-delivery", sequence: 1, kind: "item_result", payloadHash: payloadHash(itemPayload), payload: itemPayload, leaseUntil: "2026-08-03T09:40:00.000Z" },
    { deliveryId: "ad-hoc-summary-delivery", sequence: 2, kind: "run_summary", payloadHash: payloadHash(summaryPayload), payload: summaryPayload, leaseUntil: "2026-08-03T09:40:00.000Z" }
  ]);
  const pulled = await relayService.pullDeliveries({ limit: 10 });
  assert.equal(pulled.acknowledged, 2);
  assert.equal(acknowledgedCount, 2);
  const completedRun = diagnosticStore.run("default", created.link.diagnosticRunId, { includeEvidence: true, includeMetrics: true });
  assert.equal(completedRun.status, "completed");
  assert.equal(completedRun.evidence.filter((entry) => entry.evidenceType === "live").length, 1);

  const audits = database.connection.prepare("SELECT action, details_json FROM audit_logs WHERE action LIKE 'diagnostic.relay.ad_hoc.%' ORDER BY id").all();
  const authorizationAudit = audits.find((entry) => entry.action === "diagnostic.relay.ad_hoc.authorized");
  assert.ok(authorizationAudit);
  assert.equal(authorizationAudit.details_json.includes(requestBody.question), false);
  const authorizationDetails = JSON.parse(authorizationAudit.details_json);
  assert.equal(authorizationDetails.authorization.authorizationReference, "CONSENT-20260803-001");
  assert.equal(authorizationDetails.authorization.authorizedBy, "customer-operator-123");
  assert.equal(typeof authorizationDetails.questionSha256, "string");
  assert.equal(audits.some((entry) => entry.action === "diagnostic.relay.ad_hoc.submitted"), true);

  console.log("Ad-hoc diagnostic API check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
