import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { signInstanceRequest as signCentralRequest } from "../../geo-data-hub-demo/relay-store.mjs";
import { DiagnosticRelayClient, payloadHash } from "../diagnostic-relay-client.mjs";
import { DiagnosticRelayService } from "../diagnostic-relay-service.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-diagnostic-relay-"));
let database;
const secret = "relay-client-secret-for-check";
const itemPayload = {
  relayRunId: "relay-run-check",
  clientRunId: "client-run-check",
  itemId: "q-1-DB-web-fast",
  status: "completed",
  upstream: { provider: "aidso", reqId: "aidso-req-check", platform: "DB", terminal: "web", mode: "fast" },
  observedAt: "2026-08-02T12:00:00.000Z",
  usage: { customerCredits: 2 },
  normalized: {
    answerText: "桐灼科技提供工业机器人 GEO 运营服务。",
    brandMentioned: true,
    brandMentionCount: 1,
    quotes: [{ url: "https://example.com/proof", title: "示例信源", siteName: "Example" }],
    quoteCount: 1,
    uniqueDomainCount: 1,
    qualityStatus: "verified",
    normalizerVersion: "aidso-normalizer-v1"
  },
  quality: { status: "verified", normalizerVersion: "aidso-normalizer-v1" }
};
const summaryPayload = {
  relayRunId: "relay-run-check",
  clientRunId: "client-run-check",
  status: "completed",
  billingStatus: "settled",
  totalItems: 1,
  completedItems: 1,
  failedItems: 0,
  chargedCredits: 2,
  completedAt: "2026-08-02T12:00:01.000Z"
};

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "relay.sqlite") });
  const diagnosticStore = new DiagnosticStore(database);
  const project = diagnosticStore.createProject({ name: "Relay 接入检查", diagnosticType: "comprehensive", industry: "工业自动化", targetBrand: "桐灼科技" });
  const questionSet = diagnosticStore.freezeQuestionSet({ questionSetId: diagnosticStore.createQuestionSet({ projectId: project.id, questions: [{ id: "q-1", text: "工业机器人 GEO 服务如何选择？" }] }).id });

  const deliveries = [
    // Deliberately deliver the summary first: the outbox is at-least-once and
    // clients must not mark a run complete before late item evidence arrives.
    { deliveryId: "delivery-summary-check", sequence: 2, kind: "run_summary", payloadHash: payloadHash(summaryPayload), payload: summaryPayload, leaseUntil: "2026-08-02T12:02:00.000Z" },
    { deliveryId: "delivery-item-check", sequence: 1, kind: "item_result", payloadHash: payloadHash(itemPayload), payload: itemPayload, leaseUntil: "2026-08-02T12:02:00.000Z" }
  ];
  let deliveryPullCount = 0;
  let relayCreateCount = 0;
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const target = new URL(String(url));
    if (target.pathname === "/client/v1/effect-runs" && options.method === "POST") {
      relayCreateCount += 1;
      const relayRunId = relayCreateCount === 1 ? "relay-run-check" : `relay-run-check-${relayCreateCount}`;
      return new Response(JSON.stringify({ relayRunId, created: true, run: { relayRunId, status: "queued" } }), { status: 202, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/capabilities" && options.method === "GET") {
      return new Response(JSON.stringify({ provider: { providerCode: "aidso" }, items: [{ platform: "DB", terminal: "web", mode: "fast", customerCredits: 2 }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/quota" && options.method === "GET") {
      return new Response(JSON.stringify({ availableCredits: 98, heldCredits: 2 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/effect-runs/quote" && options.method === "POST") {
      return new Response(JSON.stringify({ estimatedCustomerCredits: 2, priceSnapshot: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.pathname === "/client/v1/deliveries" && options.method === "GET") {
      const next = deliveryPullCount++ === 0 ? deliveries : [];
      return new Response(JSON.stringify({ deliveries: next, serverTime: "2026-08-02T12:00:00.000Z" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/\/ack$/.test(target.pathname) || /\/release$/.test(target.pathname)) {
      return new Response(JSON.stringify({ acknowledged: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected request: ${options.method} ${target.pathname}`);
  };
  const client = new DiagnosticRelayClient({ baseUrl: "https://relay.example.test", instanceId: "instance-check", clientId: "client-check", clientSecret: secret, fetchImpl });
  const service = new DiagnosticRelayService({ database, diagnosticStore, client, pullBatchSize: 10 });

  assert.equal((await service.capabilities()).provider.providerCode, "aidso");
  assert.equal((await service.quota()).availableCredits, 98);
  assert.equal((await service.quote({ projectId: project.id, questionSetId: questionSet.id, items: [{ itemId: "quote-1", questionId: "q-1", prompt: "quote", platform: "DB", terminal: "web", mode: "fast" }] })).estimatedCustomerCredits, 2);

  const created = await service.createRun({
    projectId: project.id,
    questionSetId: questionSet.id,
    items: [{ itemId: "q-1-DB-web-fast", questionId: "q-1", prompt: "工业机器人 GEO 服务如何选择？", platform: "DB", terminal: "web", mode: "fast" }],
    maxCustomerCredits: 3,
    consent: { externalDataConsent: true, method: "check" }
  });
  assert.equal(created.link.relayRunId, "relay-run-check");
  assert.equal(created.run.status, "running");

  const createRequest = requests.find((entry) => new URL(entry.url).pathname === "/client/v1/effect-runs");
  const createUrl = new URL(createRequest.url);
  assert.equal(JSON.parse(createRequest.options.body).maxCustomerCredits, 3);
  const expectedSignature = signCentralRequest({
    secret,
    method: createRequest.options.method,
    requestTarget: `${createUrl.pathname}${createUrl.search}`,
    timestamp: createRequest.options.headers["x-tz-timestamp"],
    nonce: createRequest.options.headers["x-tz-nonce"],
    rawBody: createRequest.options.body
  });
  assert.equal(createRequest.options.headers["x-tz-signature"], expectedSignature);

  const pulled = await service.pullDeliveries({ limit: 10 });
  assert.equal(pulled.pulled, 2);
  assert.equal(pulled.acknowledged, 2);
  assert.equal(pulled.failed, 0);
  const run = diagnosticStore.run("default", created.link.diagnosticRunId, { includeEvidence: true, includeMetrics: true });
  assert.equal(run.status, "completed");
  assert.equal(run.evidence.filter((item) => item.evidenceType === "live").length, 1);
  assert.equal(run.evidence[0].verificationStatus, "verified");
  assert.equal(run.metrics.length, 4);

  const duplicatePull = await service.pullDeliveries({ limit: 10 });
  assert.equal(duplicatePull.pulled, 0);

  // A monitoring plan pins an immutable question-set version.  Once a newer
  // version is frozen the original becomes "superseded", but the explicit
  // monitoring-only opt-in must still be able to create a comparable run.
  const nextQuestionSet = diagnosticStore.freezeQuestionSet({
    questionSetId: diagnosticStore.createQuestionSet({
      projectId: project.id,
      questions: [{ id: "q-2", text: "How should an industrial brand compare GEO services?" }]
    }).id
  });
  assert.equal(nextQuestionSet.status, "frozen");
  assert.equal(diagnosticStore.questionSet("default", questionSet.id).status, "superseded");
  await assert.rejects(
    () => service.createRun({
      projectId: project.id,
      questionSetId: questionSet.id,
      items: [{ itemId: "q-1-DB-web-fast-default", questionId: "q-1", prompt: questionSet.questions[0].text, platform: "DB", terminal: "web", mode: "fast" }],
      clientRunId: "strict-superseded-rejection",
      idempotencyKey: "strict-superseded-rejection",
      consent: { externalDataConsent: true, method: "check" }
    }),
    (error) => error.code === "RELAY_QUESTION_SET_INVALID"
  );
  const comparable = await service.createRun({
    projectId: project.id,
    questionSetId: questionSet.id,
    items: [{ itemId: "q-1-DB-web-fast-monitor", questionId: "q-1", prompt: questionSet.questions[0].text, platform: "DB", terminal: "web", mode: "fast" }],
    clientRunId: "monitoring-superseded-check",
    idempotencyKey: "monitoring-superseded-check",
    allowSupersededQuestionSet: true,
    consent: { externalDataConsent: true, method: "check" }
  });
  assert.equal(comparable.link.relayRunId, "relay-run-check-2");
  assert.equal(comparable.run.questionSetId, questionSet.id);
  const tableNames = database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'diagnostic_relay_%' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(tableNames, ["diagnostic_relay_delivery_receipts", "diagnostic_relay_links"]);

  console.log("Diagnostic relay integration check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
