import assert from "node:assert/strict";
import { AidsoClient, MockAidsoClient } from "../aidso-client.mjs";
import { RelayStore, RelayStoreError, signInstanceRequest } from "../relay-store.mjs";
import { RelayWorker } from "../relay-worker.mjs";

let store;

try {
  store = new RelayStore({
    databasePath: ":memory:",
    masterKey: Buffer.alloc(32, 7),
    deliveryMaxAttempts: 2
  });

  const tenant = store.createTenant({ tenantId: "tenant-check", displayName: "中转站验证客户", initialCredits: 100 });
  assert.equal(tenant.wallet.availableCredits, 100);

  const provider = store.upsertProviderAccount({
    providerAccountId: "provider-aidso-check",
    providerCode: "aidso",
    displayName: "爱搜统一主账号（验证）",
    isDefault: true,
    capabilities: { version: "check-v1" }
  });
  store.upsertPriceRule({
    providerAccountId: provider.providerAccountId,
    platform: "DB",
    terminal: "web",
    mode: "fast",
    customerCredits: 10,
    estimatedUpstreamCredits: 2,
    version: "check-v1"
  });

  const provisioned = store.provisionInstance({
    tenantId: tenant.tenantId,
    instanceId: "instance-check",
    displayName: "客户私有化验证实例",
    clientId: "client-check",
    clientSecret: "check-secret-0123456789"
  });
  assert.equal(Object.hasOwn(provisioned.instance, "secretEnvelope"), false);

  const rawBody = JSON.stringify({ request: "signed" });
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = "nonce-check-001";
  const signature = signInstanceRequest({
    secret: provisioned.clientSecret,
    method: "POST",
    requestTarget: "/v1/effect-runs",
    timestamp,
    nonce,
    rawBody
  });
  const authenticated = store.authenticateInstanceRequest({
    clientId: "client-check",
    method: "POST",
    requestTarget: "/v1/effect-runs",
    timestamp,
    nonce,
    signature,
    rawBody
  });
  assert.equal(authenticated.instance.instanceId, "instance-check");
  assert.throws(() => store.authenticateInstanceRequest({
    clientId: "client-check",
    method: "POST",
    requestTarget: "/v1/effect-runs",
    timestamp,
    nonce,
    signature,
    rawBody
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_AUTH_REPLAY");

  const request = {
    instanceId: "instance-check",
    clientRunId: "client-run-check-001",
    idempotencyKey: "client-run-check-001-v1",
    projectId: "project-check",
    questionSetId: "questions-check",
    questionSetChecksum: "sha256:check",
    brand: { name: "桐灼", aliases: ["桐灼科技"] },
    consent: { externalDataConsent: true, consentedAt: new Date().toISOString(), method: "check" },
    items: [{
      itemId: "item-check-001",
      questionId: "question-check-001",
      prompt: "桐灼 GEO 优化系统是什么？",
      platform: "DB",
      terminal: "web",
      mode: "fast"
    }]
  };
  assert.throws(() => store.createEffectRun({
    ...request,
    clientRunId: "client-run-check-credit-cap",
    idempotencyKey: "client-run-check-credit-cap-v1",
    maxCustomerCredits: 9
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_CLIENT_CREDIT_CAP_EXCEEDED");
  assert.equal(store.getQuotaForInstance("instance-check").availableCredits, 100);
  const created = store.createEffectRun(request);
  assert.equal(created.created, true);
  const duplicate = store.createEffectRun(request);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.run.relayRunId, created.run.relayRunId);
  assert.throws(() => store.createEffectRun({
    ...request,
    items: [{ ...request.items[0], prompt: "同一幂等键但不同的问题" }]
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_IDEMPOTENCY_MISMATCH");
  assert.equal(store.getQuotaForInstance("instance-check").availableCredits, 90);
  assert.equal(store.getQuotaForInstance("instance-check").heldCredits, 10);

  const worker = new RelayWorker({
    store,
    providerClient: new MockAidsoClient({ pollsBeforeCompletion: 0 }),
    workerId: "relay-check-worker",
    pollInitialDelayMs: 0,
    pollRetryBaseMs: 0,
    submitRetryBaseMs: 0
  });
  await worker.tick();
  await worker.tick();
  const completed = store.getRun(created.run.relayRunId, { includeItems: true, includeResults: true, includeUpstream: true });
  assert.equal(completed.status, "completed");
  assert.equal(completed.billingStatus, "settled");
  assert.equal(completed.items[0].status, "completed");
  assert.equal(store.getQuotaForInstance("instance-check").heldCredits, 0);
  assert.equal(store.getQuotaForInstance("instance-check").availableCredits, 90);

  const deliveries = store.leaseDeliveries({ instanceId: "instance-check", consumerId: "private-sync-check" });
  assert.equal(deliveries.length, 2);
  for (const delivery of deliveries) {
    assert.ok(delivery.payloadHash.startsWith("sha256:"));
    store.acknowledgeDelivery({ instanceId: "instance-check", deliveryId: delivery.deliveryId, consumerId: "private-sync-check" });
  }
  assert.equal(store.leaseDeliveries({ instanceId: "instance-check", consumerId: "private-sync-check" }).length, 0);

  const deliveryRetryRun = store.createEffectRun({
    ...request,
    clientRunId: "client-run-check-delivery-dead-letter",
    idempotencyKey: "client-run-check-delivery-dead-letter-v1",
    items: [{ ...request.items[0], itemId: "item-check-delivery-dead-letter" }]
  });
  await worker.tick();
  await worker.tick();
  assert.equal(store.getRun(deliveryRetryRun.run.relayRunId).status, "completed");
  const firstLease = store.leaseDeliveries({ instanceId: "instance-check", consumerId: "delivery-dead-letter-check", limit: 1 });
  assert.equal(firstLease.length, 1);
  const firstRelease = store.releaseDelivery({
    instanceId: "instance-check",
    deliveryId: firstLease[0].deliveryId,
    consumerId: "delivery-dead-letter-check",
    error: "simulated private delivery write failure"
  });
  assert.equal(firstRelease.deadLettered, false);
  const secondLease = store.leaseDeliveries({ instanceId: "instance-check", consumerId: "delivery-dead-letter-check", limit: 1 });
  assert.equal(secondLease.length, 1);
  assert.equal(secondLease[0].deliveryId, firstLease[0].deliveryId);
  const secondRelease = store.releaseDelivery({
    instanceId: "instance-check",
    deliveryId: secondLease[0].deliveryId,
    consumerId: "delivery-dead-letter-check",
    error: "simulated private delivery write failure"
  });
  assert.equal(secondRelease.deadLettered, true, "delivery must dead-letter after its configured maximum attempts");
  const deadLetterDeliveries = store.listDeadLetterDeliveries();
  assert.equal(deadLetterDeliveries.length, 1);
  assert.equal(deadLetterDeliveries[0].deliveryId, firstLease[0].deliveryId);
  assert.equal(deadLetterDeliveries[0].attemptCount, 2);
  assert.equal(store.getOperationsSummary().deadLetterDeliveries, 1);
  const replayed = store.requeueDeadLetterDelivery(firstLease[0].deliveryId, { actorType: "operator-check", note: "client storage recovered" });
  assert.equal(replayed.status, "queued");
  assert.equal(replayed.attemptCount, 0);
  const replayLease = store.leaseDeliveries({ instanceId: "instance-check", consumerId: "delivery-dead-letter-replay", limit: 1 });
  assert.equal(replayLease[0].deliveryId, firstLease[0].deliveryId);
  store.acknowledgeDelivery({
    instanceId: "instance-check",
    deliveryId: replayLease[0].deliveryId,
    consumerId: "delivery-dead-letter-replay",
    payloadHash: replayLease[0].payloadHash
  });
  const remainingDelivery = store.leaseDeliveries({ instanceId: "instance-check", consumerId: "delivery-dead-letter-replay", limit: 10 });
  for (const delivery of remainingDelivery) {
    store.acknowledgeDelivery({
      instanceId: "instance-check",
      deliveryId: delivery.deliveryId,
      consumerId: "delivery-dead-letter-replay",
      payloadHash: delivery.payloadHash
    });
  }

  const cleanup = store.cleanupOperationalData({
    rawResponseRetentionDays: 1,
    deliveryRetentionDays: 90,
    auditRetentionDays: 365,
    now: new Date(Date.now() + 3 * 86_400_000)
  });
  assert.ok(cleanup.deletedRawPayloads >= 1, "expired upstream evidence must be stripped after the client ACKs delivery");
  assert.ok(cleanup.scrubbedDeliveryPayloads >= 1, "an acknowledged delivery must not retain a second raw-response copy beyond the raw retention window");
  const acknowledgedDelivery = store.db.prepare("SELECT id, payload_json FROM relay_deliveries WHERE instance_id = ? AND kind = 'item_result' LIMIT 1").get("instance-check");
  const acknowledgedPayload = JSON.parse(acknowledgedDelivery.payload_json);
  assert.equal(Object.hasOwn(acknowledgedPayload, "raw"), false);
  assert.equal(Object.hasOwn(acknowledgedPayload, "normalized"), false);
  store.db.prepare("UPDATE relay_deliveries SET status = 'dead_letter' WHERE id = ?").run(acknowledgedDelivery.id);
  assert.throws(
    () => store.requeueDeadLetterDelivery(acknowledgedDelivery.id),
    (error) => error instanceof RelayStoreError && error.code === "RELAY_DELIVERY_PAYLOAD_EXPIRED",
    "a dead-letter delivery whose raw evidence expired must not be requeued with a stale payload hash"
  );
  const retainedRun = store.getRun(created.run.relayRunId, { includeItems: true, includeResults: true, includeUpstream: true });
  assert.equal(retainedRun.items[0].raw, null);
  assert.equal(retainedRun.items[0].normalized, null);
  assert.ok(retainedRun.items[0].status === "completed", "evidence cleanup must not remove immutable task or billing state");

  const ledger = store.listBillingLedger("tenant-check");
  assert.ok(ledger.some((entry) => entry.entryType === "freeze"));
  assert.ok(ledger.some((entry) => entry.entryType === "settle"));
  assert.throws(() => store.db.exec("DELETE FROM relay_billing_ledger"));

  const creditsBeforePaymentOrder = store.getTenant("tenant-check").wallet.availableCredits;
  const paymentOrder = store.createPaymentOrder({
    tenantId: "tenant-check",
    idempotencyKey: "payment-order-foundation-check-v1",
    paymentChannel: "offline_bank",
    amountCents: 88_800,
    currency: "CNY",
    credits: 88,
    externalOrderReference: "sales-foundation-check-001",
    metadata: { source: "foundation-check" }
  });
  assert.equal(paymentOrder.created, true);
  assert.equal(paymentOrder.order.status, "pending_payment");
  assert.equal(store.getTenant("tenant-check").wallet.availableCredits, creditsBeforePaymentOrder, "creating a payment order must not credit a wallet");
  const duplicatePaymentOrder = store.createPaymentOrder({
    tenantId: "tenant-check",
    idempotencyKey: "payment-order-foundation-check-v1",
    paymentChannel: "offline_bank",
    amountCents: 88_800,
    currency: "CNY",
    credits: 88,
    externalOrderReference: "sales-foundation-check-001"
  });
  assert.equal(duplicatePaymentOrder.idempotent, true);
  assert.throws(() => store.createPaymentOrder({
    tenantId: "tenant-check",
    idempotencyKey: "payment-order-foundation-check-v1",
    paymentChannel: "offline_bank",
    amountCents: 88_900,
    currency: "CNY",
    credits: 88,
    externalOrderReference: "sales-foundation-check-001"
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_IDEMPOTENCY_MISMATCH");
  const paymentConfirmed = store.confirmPaymentOrder(paymentOrder.order.paymentOrderId, {
    paymentReference: "bank-foundation-check-001",
    note: "finance reconciliation complete",
    actorType: "operator-check"
  });
  assert.equal(paymentConfirmed.idempotent, false);
  assert.equal(paymentConfirmed.order.status, "paid");
  assert.equal(store.getTenant("tenant-check").wallet.availableCredits, creditsBeforePaymentOrder + 88, "only a confirmed payment order may credit a wallet");
  assert.equal(store.confirmPaymentOrder(paymentOrder.order.paymentOrderId, {
    paymentReference: "bank-foundation-check-001",
    note: "request retry",
    actorType: "operator-check"
  }).idempotent, true, "payment confirmation must be retry-safe");
  assert.throws(() => store.cancelPaymentOrder(paymentOrder.order.paymentOrderId, { note: "not allowed after credit" }), (error) => error instanceof RelayStoreError && error.code === "RELAY_STATE_CONFLICT");

  const invoiceRequest = store.createInvoiceRequest({
    paymentOrderId: paymentOrder.order.paymentOrderId,
    idempotencyKey: "invoice-foundation-check-v1",
    billingTitle: "Foundation Check Co., Ltd.",
    taxId: "TAX-FOUNDATION-CHECK",
    recipientName: "Finance",
    recipientEmail: "finance@example.test",
    actorType: "operator-check"
  });
  assert.equal(invoiceRequest.created, true);
  assert.equal(invoiceRequest.invoice.status, "requested");
  assert.equal(store.getInvoiceRequest(invoiceRequest.invoice.invoiceRequestId, { includeBilling: true }).billing.taxId, "TAX-FOUNDATION-CHECK", "invoice recipient fields must decrypt only for an explicit authorized administrative read");
  assert.equal(Object.hasOwn(store.listInvoiceRequests()[0], "billing"), false, "invoice lists must not expose encrypted recipient details by default");
  const invoiceIssued = store.issueInvoiceRequest(invoiceRequest.invoice.invoiceRequestId, {
    invoiceNumber: "INV-FOUNDATION-CHECK-001",
    note: "issued in external tax system",
    actorType: "operator-check"
  });
  assert.equal(invoiceIssued.invoice.status, "issued");
  const invoiceVoided = store.voidInvoiceRequest(invoiceRequest.invoice.invoiceRequestId, {
    note: "external red-letter record retained",
    actorType: "operator-check"
  });
  assert.equal(invoiceVoided.invoice.status, "voided");
  const cancelledPaymentOrder = store.createPaymentOrder({
    tenantId: "tenant-check",
    idempotencyKey: "payment-order-foundation-cancel-v1",
    paymentChannel: "contract_grant",
    amountCents: 0,
    currency: "CNY",
    credits: 1,
    externalOrderReference: "contract-foundation-cancel"
  });
  assert.equal(store.cancelPaymentOrder(cancelledPaymentOrder.order.paymentOrderId, { note: "duplicate sales order", actorType: "operator-check" }).order.status, "cancelled");

  const requests = [];
  const apiClient = new AidsoClient({
    token: "test-token-do-not-log",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), method: init.method, body: init.body });
      if (init.method === "POST") return new Response(JSON.stringify({ status: "ACCEPTED", reqId: "realish-req-001" }), { status: 200 });
      return new Response(JSON.stringify({
        status: "DONE",
        fetch_time: "2026-08-02T12:00:00.000Z",
        result: [{ answer: "桐灼科技提供 GEO 优化系统。", quote: JSON.stringify([{ url: "https://example.test/aidso", title: "引用" }]) }],
        usage: { credits: 2 }
      }), { status: 200 });
    }
  });
  const submitted = await apiClient.submit({ request: { prompt: "桐灼是什么？" }, platform: "DB", mode: "fast" });
  assert.equal(submitted.reqId, "realish-req-001");
  assert.deepEqual(JSON.parse(requests[0].body), { prompt: "桐灼是什么？", name: "DB", thinking_enabled: 0 });
  const polled = await apiClient.poll(submitted.reqId, { brand: { name: "桐灼", aliases: ["桐灼科技"] } });
  assert.equal(polled.state, "completed");
  assert.equal(polled.normalized.brandMentioned, true);
  assert.equal(polled.normalized.quoteCount, 1);
  const ambiguousClient = new AidsoClient({ token: "test-token", fetchImpl: async () => { throw new Error("connection reset"); } });
  await assert.rejects(() => ambiguousClient.submit({ request: { prompt: "测试" }, platform: "DB", mode: "fast" }), (error) => error.submissionUncertain === true);

  const uncertainRun = store.createEffectRun({
    ...request,
    clientRunId: "client-run-check-uncertain",
    idempotencyKey: "client-run-check-uncertain-v1",
    items: [{ ...request.items[0], itemId: "item-check-uncertain" }]
  });
  const now = new Date();
  const claim = store.claimWork({ workerId: "crash-simulation", leaseMs: 1, now });
  assert.equal(claim.length, 1);
  store.beginItemAttempt({ relayItemId: claim[0].relayItemId, workerId: "crash-simulation", operation: "submit", now });
  const afterLease = new Date(now.valueOf() + 5_000);
  assert.equal(store.claimWork({ workerId: "recovery-worker", leaseMs: 1, now: afterLease }).length, 0);
  const uncertain = store.getRun(uncertainRun.run.relayRunId, { includeItems: true });
  assert.equal(uncertain.status, "attention");
  assert.equal(uncertain.items[0].status, "submission_uncertain");
  assert.equal(store.getQuotaForInstance("instance-check").heldCredits, 10);
  const openReconciliation = store.listReconciliationCases({ status: "open" })
    .find((entry) => entry.relayItemId === uncertain.items[0].relayItemId);
  assert.ok(openReconciliation, "submission uncertainty must create a durable reconciliation case");
  assert.equal(openReconciliation.reason.code, "RELAY_SUBMISSION_UNCERTAIN");
  const attentionRecord = store.listAttentionItems({ limit: 100 })
    .find((entry) => entry.relayItemId === uncertain.items[0].relayItemId);
  assert.equal(attentionRecord.reconciliation?.status, "open");
  assert.equal(store.getOperationsSummary().openReconciliationCases, 1);

  const mockA = new MockAidsoClient({ pollsBeforeCompletion: 0 });
  const mockB = new MockAidsoClient({ pollsBeforeCompletion: 0 });
  const mockARequest = await mockA.submit({ request: { prompt: "restart-safe" }, platform: "DB", mode: "fast" });
  const mockBRequest = await mockB.submit({ request: { prompt: "restart-safe" }, platform: "DB", mode: "fast" });
  assert.notEqual(mockARequest.reqId, mockBRequest.reqId, "mock reqId must remain unique across worker restarts");

  const reconciled = store.reconcileAttentionItem(uncertain.items[0].relayItemId, { resolution: "refund", note: "foundation-check" });
  assert.equal(reconciled.resolution, "refund");
  assert.equal(reconciled.item.status, "failed");
  assert.equal(reconciled.run.billingStatus, "refunded");
  assert.equal(store.getQuotaForInstance("instance-check").heldCredits, 0);
  assert.equal(reconciled.reconciliation.status, "resolved");
  assert.equal(reconciled.reconciliation.resolution, "refund");
  assert.ok(reconciled.refundedCredits >= 10);
  assert.equal(store.getOperationsSummary().openReconciliationCases, 0);

  const retryReconciliationRun = store.createEffectRun({
    ...request,
    clientRunId: "client-run-check-reconciliation-retry",
    idempotencyKey: "client-run-check-reconciliation-retry-v1",
    items: [{ ...request.items[0], itemId: "item-check-reconciliation-retry" }]
  });
  const retryNow = new Date();
  const retryClaim = store.claimWork({ workerId: "retry-reconciliation-crash", leaseMs: 1, now: retryNow })
    .find((entry) => entry.relayRunId === retryReconciliationRun.run.relayRunId);
  assert.ok(retryClaim);
  store.beginItemAttempt({
    relayItemId: retryClaim.relayItemId,
    workerId: "retry-reconciliation-crash",
    operation: "submit",
    now: retryNow
  });
  store.claimWork({ workerId: "retry-reconciliation-recovery", leaseMs: 1, now: new Date(retryNow.valueOf() + 5_000) });
  const retryResolution = store.reconcileAttentionItem(retryClaim.relayItemId, {
    resolution: "retry",
    note: "upstream confirms no task was created"
  });
  assert.equal(retryResolution.item.status, "submit_retry");
  assert.equal(retryResolution.reconciliation.resolution, "retry");
  await worker.tick();
  await worker.tick();
  assert.equal(store.getRun(retryReconciliationRun.run.relayRunId).status, "completed");

  const confirmedReconciliationRun = store.createEffectRun({
    ...request,
    clientRunId: "client-run-check-reconciliation-confirmed",
    idempotencyKey: "client-run-check-reconciliation-confirmed-v1",
    items: [{ ...request.items[0], itemId: "item-check-reconciliation-confirmed" }]
  });
  const confirmedNow = new Date();
  const confirmedClaim = store.claimWork({ workerId: "confirmed-reconciliation-crash", leaseMs: 1, now: confirmedNow })
    .find((entry) => entry.relayRunId === confirmedReconciliationRun.run.relayRunId);
  assert.ok(confirmedClaim);
  store.beginItemAttempt({
    relayItemId: confirmedClaim.relayItemId,
    workerId: "confirmed-reconciliation-crash",
    operation: "submit",
    now: confirmedNow
  });
  store.claimWork({ workerId: "confirmed-reconciliation-recovery", leaseMs: 1, now: new Date(confirmedNow.valueOf() + 5_000) });
  const confirmedUpstream = await worker.providerClient.submit({
    request: { prompt: "confirmed upstream task" },
    platform: "DB",
    mode: "fast"
  });
  const confirmedResolution = store.reconcileAttentionItem(confirmedClaim.relayItemId, {
    resolution: "confirmed_success",
    upstreamReqId: confirmedUpstream.reqId,
    note: "upstream task id verified by operator"
  });
  assert.equal(confirmedResolution.item.status, "poll_retry");
  assert.equal(confirmedResolution.reconciliation.resolution, "confirmed_success");
  await worker.tick();
  assert.equal(store.getRun(confirmedReconciliationRun.run.relayRunId).status, "completed");

  store.upsertProviderAccount({
    providerAccountId: provider.providerAccountId,
    providerCode: "aidso",
    displayName: "爱搜统一账号（并发校验）",
    status: "active",
    isDefault: true,
    maxInFlight: 1
  });
  store.createEffectRun({
    ...request,
    clientRunId: "client-run-provider-limit",
    idempotencyKey: "client-run-provider-limit-v1",
    items: [
      { ...request.items[0], itemId: "item-provider-limit-1" },
      { ...request.items[0], itemId: "item-provider-limit-2", questionId: "question-provider-limit-2" }
    ]
  });
  const providerLimitedClaims = store.claimWork({ workerId: "provider-limit-check", limit: 10, leaseMs: 60_000 });
  assert.equal(providerLimitedClaims.length, 1, "a shared AIDSO account must honor its global maxInFlight limit across queued items");

  console.log("Relay foundation check passed.");
} finally {
  store?.close();
}
