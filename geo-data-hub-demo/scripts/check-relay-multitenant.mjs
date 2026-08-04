import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AidsoClientError, MockAidsoClient } from "../aidso-client.mjs";
import { RelayStore, RelayStoreError, signInstanceRequest } from "../relay-store.mjs";
import { RelayWorker } from "../relay-worker.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-relay-multitenant-"));
const databasePath = path.join(tempRoot, "relay.sqlite");
const masterKey = Buffer.alloc(32, 19);
let store;
let reopened;

function requestFor(instance, suffix, overrides = {}) {
  return {
    instanceId: instance.instanceId,
    clientRunId: `client-${suffix}`,
    idempotencyKey: `idem-${suffix}`,
    projectId: `project-${instance.tenantId}`,
    questionSetId: `questions-${suffix}`,
    questionSetChecksum: `sha256:${suffix}`,
    brand: { name: "桐灼科技", aliases: ["桐灼"] },
    consent: { externalDataConsent: true, consentedAt: new Date().toISOString(), method: "multitenant-check" },
    items: [{
      itemId: `item-${suffix}`,
      questionId: `question-${suffix}`,
      prompt: `AI GEO test ${suffix}`,
      platform: "DB",
      terminal: "web",
      mode: "fast"
    }],
    ...overrides
  };
}

try {
  store = new RelayStore({ databasePath, masterKey });
  const provider = store.upsertProviderAccount({
    providerAccountId: "provider-multitenant-check",
    providerCode: "aidso",
    displayName: "AIDSO shared account",
    status: "active",
    isDefault: true,
    maxInFlight: 2,
    capabilities: { version: "multitenant-check-v1" }
  });
  store.upsertPriceRule({
    providerAccountId: provider.providerAccountId,
    platform: "DB",
    terminal: "web",
    mode: "fast",
    customerCredits: 10,
    estimatedUpstreamCredits: 1,
    version: "multitenant-check-v1"
  });

  const tenantA = store.createTenant({ tenantId: "tenant-check-a", displayName: "Tenant A", initialCredits: 100 });
  const tenantB = store.createTenant({ tenantId: "tenant-check-b", displayName: "Tenant B", initialCredits: 30 });
  const instanceA = store.provisionInstance({
    instanceId: "instance-check-a",
    tenantId: tenantA.tenantId,
    displayName: "Tenant A production",
    clientId: "client-check-a",
    clientSecret: "secret-check-a",
    maxInFlight: 1,
    providerAccountId: provider.providerAccountId,
    allowedCapabilities: { allowedPlatforms: ["DB"] }
  });
  const instanceB = store.provisionInstance({
    instanceId: "instance-check-b",
    tenantId: tenantB.tenantId,
    displayName: "Tenant B production",
    clientId: "client-check-b",
    clientSecret: "secret-check-b",
    maxInFlight: 1,
    providerAccountId: provider.providerAccountId,
    allowedCapabilities: { allowedPlatforms: ["DB"] }
  });
  const tenantC = store.createTenant({ tenantId: "tenant-check-c", displayName: "Tenant C", initialCredits: 50 });
  const instanceC = store.provisionInstance({
    instanceId: "instance-check-c",
    tenantId: tenantC.tenantId,
    displayName: "Tenant C budget-limited",
    clientId: "client-check-c",
    clientSecret: "secret-check-c",
    maxInFlight: 1,
    dailyCreditLimit: 10,
    monthlyCreditLimit: 10,
    providerAccountId: provider.providerAccountId,
    allowedCapabilities: { allowedPlatforms: ["DB"] }
  });
  const tenantD = store.createTenant({ tenantId: "tenant-check-d", displayName: "Tenant D", initialCredits: 50 });
  const instanceD = store.provisionInstance({
    instanceId: "instance-check-d",
    tenantId: tenantD.tenantId,
    displayName: "Tenant D monthly-budget-limited",
    clientId: "client-check-d",
    clientSecret: "secret-check-d",
    maxInFlight: 1,
    dailyCreditLimit: 20,
    monthlyCreditLimit: 10,
    providerAccountId: provider.providerAccountId,
    allowedCapabilities: { allowedPlatforms: ["DB"] }
  });

  const rawBody = JSON.stringify({ hello: "relay" });
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const signature = signInstanceRequest({
    secret: instanceA.clientSecret,
    method: "POST",
    requestTarget: "/client/v1/effect-runs",
    timestamp,
    nonce: "nonce-multitenant-1",
    rawBody
  });
  assert.equal(store.authenticateInstanceRequest({
    clientId: instanceA.instance.clientId,
    method: "POST",
    requestTarget: "/client/v1/effect-runs",
    timestamp,
    nonce: "nonce-multitenant-1",
    signature,
    rawBody
  }).instance.instanceId, instanceA.instance.instanceId);
  assert.throws(() => store.authenticateInstanceRequest({
    clientId: instanceA.instance.clientId,
    method: "POST",
    requestTarget: "/client/v1/effect-runs",
    timestamp,
    nonce: "nonce-multitenant-1",
    signature,
    rawBody
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_AUTH_REPLAY");
  const crossInstanceSignature = signInstanceRequest({
    secret: instanceA.clientSecret,
    method: "POST",
    requestTarget: "/client/v1/effect-runs",
    timestamp,
    nonce: "nonce-multitenant-cross-instance",
    rawBody
  });
  assert.throws(() => store.authenticateInstanceRequest({
    clientId: instanceB.instance.clientId,
    method: "POST",
    requestTarget: "/client/v1/effect-runs",
    timestamp,
    nonce: "nonce-multitenant-cross-instance",
    signature: crossInstanceSignature,
    rawBody
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_AUTH_INVALID");

  const runARequest = requestFor(instanceA.instance, "a-001");
  const runA = store.createEffectRun(runARequest);
  const duplicateA = store.createEffectRun(runARequest);
  assert.equal(duplicateA.created, false);
  assert.equal(duplicateA.run.relayRunId, runA.run.relayRunId);
  assert.equal(store.getQuotaForInstance(instanceA.instance.instanceId).heldCredits, 10);
  assert.equal(store.getQuotaForInstance(instanceB.instance.instanceId).heldCredits, 0);

  const runB = store.createEffectRun(requestFor(instanceB.instance, "b-001"));
  assert.equal(store.getQuotaForInstance(instanceB.instance.instanceId).availableCredits, 20);
  assert.equal(store.getRunForInstance(instanceA.instance.instanceId, runB.run.relayRunId), null);
  const runC = store.createEffectRun(requestFor(instanceC.instance, "c-001"));
  assert.equal(store.getQuotaForInstance(instanceC.instance.instanceId).dailyUsed, 10);
  assert.throws(() => store.createEffectRun(requestFor(instanceC.instance, "c-002")), (error) => error instanceof RelayStoreError && error.code === "RELAY_DAILY_BUDGET_EXCEEDED");
  const runD = store.createEffectRun(requestFor(instanceD.instance, "d-001"));
  assert.equal(store.getQuotaForInstance(instanceD.instance.instanceId).monthlyUsed, 10);
  assert.throws(() => store.createEffectRun(requestFor(instanceD.instance, "d-002")), (error) => error instanceof RelayStoreError && error.code === "RELAY_MONTHLY_BUDGET_EXCEEDED");

  const worker = new RelayWorker({
    store,
    providerClient: new MockAidsoClient({ pollsBeforeCompletion: 0 }),
    workerId: "multitenant-worker",
    pollInitialDelayMs: 0,
    pollRetryBaseMs: 0,
    submitRetryBaseMs: 0
  });
  await worker.tick();
  await worker.tick();
  await worker.tick();
  await worker.tick();
  assert.equal(store.getRun(runA.run.relayRunId).status, "completed");
  assert.equal(store.getRun(runB.run.relayRunId).status, "completed");
  assert.equal(store.getRun(runC.run.relayRunId).status, "completed");
  assert.equal(store.getRun(runD.run.relayRunId).status, "completed");
  assert.equal(store.getQuotaForInstance(instanceA.instance.instanceId).availableCredits, 90);
  assert.equal(store.getQuotaForInstance(instanceB.instance.instanceId).availableCredits, 20);
  const analytics = store.getOperationsAnalytics({ days: 365 });
  assert.ok(analytics.totals.settledCustomerCredits >= 30);
  assert.ok(analytics.totals.grossProfitCredits <= analytics.totals.settledCustomerCredits);
  const settings = store.updateOperatorSettings({ alerts: { failureRateEnabled: false } }, { actorType: "operator-check" });
  assert.equal(settings.alerts.failureRateEnabled, false);
  assert.equal(store.getOperatorSettings().alerts.failureRateEnabled, false);

  const deliveriesA = store.leaseDeliveries({ instanceId: instanceA.instance.instanceId, consumerId: "consumer-a" });
  const deliveriesB = store.leaseDeliveries({ instanceId: instanceB.instance.instanceId, consumerId: "consumer-b" });
  assert.equal(deliveriesA.length, 2);
  assert.equal(deliveriesB.length, 2);
  assert.throws(() => store.acknowledgeDelivery({
    instanceId: instanceA.instance.instanceId,
    deliveryId: deliveriesB[0].deliveryId,
    consumerId: "consumer-a",
    payloadHash: deliveriesB[0].payloadHash
  }), (error) => error instanceof RelayStoreError && error.code === "RELAY_NOT_FOUND");
  for (const delivery of deliveriesA) {
    store.acknowledgeDelivery({ instanceId: instanceA.instance.instanceId, deliveryId: delivery.deliveryId, consumerId: "consumer-a", payloadHash: delivery.payloadHash });
  }
  const duplicateAck = store.acknowledgeDelivery({ instanceId: instanceA.instance.instanceId, deliveryId: deliveriesA[0].deliveryId, consumerId: "consumer-a", payloadHash: deliveriesA[0].payloadHash });
  assert.equal(duplicateAck.idempotent, true);
  store.acknowledgeDelivery({ instanceId: instanceB.instance.instanceId, deliveryId: deliveriesB[1].deliveryId, consumerId: "consumer-b", payloadHash: deliveriesB[1].payloadHash });
  store.releaseDelivery({ instanceId: instanceB.instance.instanceId, deliveryId: deliveriesB[0].deliveryId, consumerId: "consumer-b", delayMs: 0, error: "local retry" });
  const redeliveredB = store.leaseDeliveries({ instanceId: instanceB.instance.instanceId, consumerId: "consumer-b" });
  assert.equal(redeliveredB.some((delivery) => delivery.deliveryId === deliveriesB[0].deliveryId), true);
  for (const delivery of redeliveredB) {
    store.acknowledgeDelivery({ instanceId: instanceB.instance.instanceId, deliveryId: delivery.deliveryId, consumerId: "consumer-b", payloadHash: delivery.payloadHash });
  }

  const concurrencyRun = store.createEffectRun({
    ...requestFor(instanceA.instance, "a-concurrency"),
    items: [
      { ...requestFor(instanceA.instance, "a-concurrency").items[0], itemId: "item-a-concurrency-1" },
      { ...requestFor(instanceA.instance, "a-concurrency").items[0], itemId: "item-a-concurrency-2", questionId: "question-a-concurrency-2" }
    ]
  });
  const instanceLimitedClaims = store.claimWork({ workerId: "instance-limit-check", limit: 10, leaseMs: 60_000 });
  assert.equal(instanceLimitedClaims.filter((claim) => claim.relayRunId === concurrencyRun.run.relayRunId).length, 1, "an instance maxInFlight limit must apply before the shared provider limit");
  const cancelled = store.cancelRun(concurrencyRun.run.relayRunId, { actorType: "operator" });
  assert.equal(cancelled.status, "failed");
  assert.equal(store.getQuotaForInstance(instanceA.instance.instanceId).heldCredits, 0);
  const cancellationDeliveries = store.leaseDeliveries({ instanceId: instanceA.instance.instanceId, consumerId: "expiry-check", leaseMs: 1 });
  assert.ok(cancellationDeliveries.length >= 1);
  const expiredDeliveries = store.leaseDeliveries({ instanceId: instanceA.instance.instanceId, consumerId: "expiry-recovery", now: new Date(Date.now() + 5_000) });
  assert.equal(expiredDeliveries.some((delivery) => cancellationDeliveries.some((original) => original.deliveryId === delivery.deliveryId)), true);
  for (const delivery of expiredDeliveries) {
    store.acknowledgeDelivery({ instanceId: instanceA.instance.instanceId, deliveryId: delivery.deliveryId, consumerId: "expiry-recovery", payloadHash: delivery.payloadHash });
  }

  const unavailableRun = store.createEffectRun(requestFor(instanceB.instance, "b-upstream-unavailable"));
  const unavailableWorker = new RelayWorker({
    store,
    providerClient: {
      async submit() {
        throw new AidsoClientError("AIDSO_NETWORK", "upstream unavailable", { retryable: true, submissionUncertain: true });
      },
      async poll() {
        throw new AidsoClientError("AIDSO_NETWORK", "upstream unavailable", { retryable: true });
      }
    },
    workerId: "upstream-unavailable-check",
    submitRetryBaseMs: 0,
    pollRetryBaseMs: 0
  });
  await unavailableWorker.tick();
  const unavailable = store.getRun(unavailableRun.run.relayRunId, { includeItems: true });
  assert.equal(unavailable.status, "attention");
  assert.equal(unavailable.items[0].status, "submission_uncertain");
  const unavailableRefund = store.reconcileAttentionItem(unavailable.items[0].relayItemId, { resolution: "refund", note: "upstream-unavailable-check" });
  assert.equal(unavailableRefund.run.billingStatus, "refunded");

  const deadLetterRun = store.createEffectRun(requestFor(instanceB.instance, "b-dead-letter"));
  const deadLetterWorker = new RelayWorker({
    store,
    providerClient: {
      async submit() {
        throw new AidsoClientError("AIDSO_REJECTED", "upstream rejected request", { retryable: true, submissionUncertain: false });
      }
    },
    workerId: "dead-letter-check",
    submitMaxAttempts: 1,
    submitRetryBaseMs: 0
  });
  await deadLetterWorker.tick();
  const deadLetter = store.getRun(deadLetterRun.run.relayRunId, { includeItems: true });
  assert.equal(deadLetter.status, "failed");
  assert.equal(deadLetter.items[0].status, "dead_letter");
  assert.equal(store.listAttentionItems({ limit: 100 }).some((item) => item.relayItemId === deadLetter.items[0].relayItemId), true);

  const uncertainRun = store.createEffectRun(requestFor(instanceB.instance, "b-uncertain"));
  const now = new Date();
  const claim = store.claimWork({ workerId: "crashed-worker", limit: 1, leaseMs: 1, now });
  assert.equal(claim.length, 1);
  store.beginItemAttempt({ relayItemId: claim[0].relayItemId, workerId: "crashed-worker", operation: "submit", now });
  assert.equal(store.claimWork({ workerId: "recovery-worker", now: new Date(now.valueOf() + 5_000) }).length, 0);
  const uncertain = store.getRun(uncertainRun.run.relayRunId, { includeItems: true });
  assert.equal(uncertain.status, "attention");
  assert.equal(uncertain.items[0].status, "submission_uncertain");
  assert.equal(store.getQuotaForInstance(instanceB.instance.instanceId).heldCredits, 10);
  const refund = store.reconcileAttentionItem(uncertain.items[0].relayItemId, { resolution: "refund", note: "multitenant-recovery-check" });
  assert.equal(refund.run.billingStatus, "refunded");
  assert.equal(store.getQuotaForInstance(instanceB.instance.instanceId).heldCredits, 0);

  store.close();
  store = null;
  reopened = new RelayStore({ databasePath, masterKey });
  assert.equal(reopened.getQuotaForInstance(instanceA.instance.instanceId).availableCredits, 90);
  assert.equal(reopened.getQuotaForInstance(instanceB.instance.instanceId).availableCredits, 20);
  assert.equal(reopened.listBillingLedger(tenantA.tenantId).some((entry) => entry.entryType === "settle"), true);
  assert.equal(reopened.listBillingLedger(tenantB.tenantId).some((entry) => entry.entryType === "release"), true);
  console.log("Relay multi-tenant isolation and recovery check passed.");
} finally {
  reopened?.close();
  store?.close();
  await rm(tempRoot, { recursive: true, force: true });
}
