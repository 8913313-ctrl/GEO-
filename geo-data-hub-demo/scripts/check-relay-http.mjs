import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { MockAidsoClient } from "../aidso-client.mjs";
import { createRelayApi } from "../relay-api.mjs";
import { RelayStore } from "../relay-store.mjs";
import { RelayWorker } from "../relay-worker.mjs";

const adminToken = "relay-http-check-admin-token";
const sessionCookieName = "__Host-relay-http-check-session";
let store;
let server;

function requestHeaders(cookie = "") {
  return {
    "X-Forwarded-Proto": "https",
    "X-Forwarded-For": "198.51.100.24",
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function createDeadLetterDelivery() {
  const tenant = store.createTenant({
    tenantId: "tenant-http-check",
    displayName: "HTTP check tenant",
    initialCredits: 20
  });
  const provider = store.upsertProviderAccount({
    providerAccountId: "provider-http-check",
    providerCode: "aidso",
    displayName: "HTTP check provider",
    isDefault: true,
    capabilities: { version: "http-check-v1" }
  });
  store.upsertPriceRule({
    providerAccountId: provider.providerAccountId,
    platform: "DB",
    terminal: "web",
    mode: "fast",
    customerCredits: 10,
    estimatedUpstreamCredits: 1,
    version: "http-check-v1"
  });
  const instance = store.provisionInstance({
    tenantId: tenant.tenantId,
    instanceId: "instance-http-check",
    displayName: "HTTP check instance",
    clientId: "client-http-check",
    clientSecret: "http-check-client-secret-0123456789"
  });
  const created = store.createEffectRun({
    instanceId: instance.instance.instanceId,
    clientRunId: "client-run-http-dead-letter",
    idempotencyKey: "client-run-http-dead-letter-v1",
    projectId: "project-http-check",
    questionSetId: "questions-http-check",
    questionSetChecksum: "sha256:http-check",
    brand: { name: "HTTP check brand" },
    consent: {
      externalDataConsent: true,
      consentedAt: new Date().toISOString(),
      method: "http-check"
    },
    items: [{
      itemId: "item-http-dead-letter",
      questionId: "question-http-dead-letter",
      prompt: "What is the HTTP dead-letter test?",
      platform: "DB",
      terminal: "web",
      mode: "fast"
    }]
  });
  const worker = new RelayWorker({
    store,
    providerClient: new MockAidsoClient({ pollsBeforeCompletion: 0 }),
    workerId: "relay-http-check-worker",
    pollInitialDelayMs: 0,
    pollRetryBaseMs: 0,
    submitRetryBaseMs: 0
  });
  await worker.tick();
  await worker.tick();

  const leased = store.leaseDeliveries({
    instanceId: instance.instance.instanceId,
    consumerId: "http-check-private-client",
    limit: 1
  });
  assert.equal(leased.length, 1, "the completed run must create a client delivery");
  const released = store.releaseDelivery({
    instanceId: instance.instance.instanceId,
    deliveryId: leased[0].deliveryId,
    consumerId: "http-check-private-client",
    error: "simulated private delivery failure"
  });
  assert.equal(released.deadLettered, true, "the delivery must move to the dead-letter queue");
  return leased[0].deliveryId;
}

try {
  store = new RelayStore({
    databasePath: ":memory:",
    masterKey: Buffer.alloc(32, 43),
    deliveryMaxAttempts: 1
  });
  const deliveryId = await createDeadLetterDelivery();
  const api = createRelayApi({
    store,
    adminToken,
    allowInsecureAdmin: false,
    runtimeConfig: {
      adminSessionTtlSeconds: 900,
      adminSessionCookieName: sessionCookieName,
      adminSessionSecureCookie: true,
      publicOrigin: "https://relay.example.test",
      trustedProxyAddresses: ["127.0.0.1"],
      requireHttpsForAdmin: true
    }
  });
  server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    if (await api.handle(request, response, url)) return;
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const unauthenticated = await fetch(`${baseUrl}/api/v1/admin/deliveries/dead-letter`, {
    headers: requestHeaders()
  });
  assert.equal(unauthenticated.status, 401, "dead-letter administration must require authentication");

  const login = await fetch(`${baseUrl}/api/v1/admin/session`, {
    method: "POST",
    headers: {
      ...requestHeaders(),
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operatorLabel: "http-check" })
  });
  assert.equal(login.status, 201, "the test administrator must receive an HTTPS session");
  const setCookie = login.headers.get("set-cookie") || "";
  assert.match(setCookie, new RegExp(`${sessionCookieName}=`));
  const cookie = setCookie.split(";")[0];

  const deadLetters = await fetch(`${baseUrl}/api/v1/admin/deliveries/dead-letter?limit=10`, {
    headers: requestHeaders(cookie)
  });
  assert.equal(deadLetters.status, 200, "an authenticated operator must be able to inspect dead-letter deliveries");
  const deadLetterPayload = await deadLetters.json();
  assert.equal(deadLetterPayload.deliveries.length, 1);
  assert.equal(deadLetterPayload.deliveries[0].deliveryId, deliveryId);
  assert.equal(deadLetterPayload.deliveries[0].status, "dead_letter");
  assert.equal(deadLetterPayload.deliveries[0].attemptCount, 1);

  const csrfBlocked = await fetch(`${baseUrl}/api/v1/admin/deliveries/${encodeURIComponent(deliveryId)}/requeue`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ note: "private client recovered" })
  });
  assert.equal(csrfBlocked.status, 403, "a cookie-authenticated requeue must require a same-origin request");

  const requeue = await fetch(`${baseUrl}/api/v1/admin/deliveries/${encodeURIComponent(deliveryId)}/requeue`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      Origin: "https://relay.example.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ note: "private client recovered" })
  });
  assert.equal(requeue.status, 202, "an authenticated operator may requeue a retained dead-letter delivery");
  const requeuePayload = await requeue.json();
  assert.equal(requeuePayload.delivery.deliveryId, deliveryId);
  assert.equal(requeuePayload.delivery.status, "queued");
  assert.equal(requeuePayload.delivery.attemptCount, 0);

  const remainingDeadLetters = await fetch(`${baseUrl}/api/v1/admin/deliveries/dead-letter?limit=10`, {
    headers: requestHeaders(cookie)
  });
  assert.equal(remainingDeadLetters.status, 200);
  assert.deepEqual((await remainingDeadLetters.json()).deliveries, [], "the requeued delivery must leave the dead-letter list");

  const persistedDelivery = store.db.prepare("SELECT status, attempt_count FROM relay_deliveries WHERE id = ?").get(deliveryId);
  assert.equal(persistedDelivery.status, "queued", "the HTTP requeue must reset durable status");
  assert.equal(Number(persistedDelivery.attempt_count), 0, "the HTTP requeue must reset durable attempt count");

  const audit = await fetch(`${baseUrl}/api/v1/admin/audit?limit=100`, {
    headers: requestHeaders(cookie)
  });
  assert.equal(audit.status, 200);
  const auditPayload = await audit.json();
  const requeueAudit = auditPayload.events.find((event) => event.action === "delivery.requeued" && event.entityId === deliveryId);
  assert.ok(requeueAudit, "the HTTP requeue must write an audit event");
  assert.equal(requeueAudit.actorType, "operator_session");
  assert.equal(requeueAudit.details.previousAttempts, 1);
  assert.equal(requeueAudit.details.note, "private client recovered");

  const paymentOrderResponse = await fetch(`${baseUrl}/api/v1/admin/payment-orders`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      Origin: "https://relay.example.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tenantId: "tenant-http-check",
      idempotencyKey: "http-check-payment-order-v1",
      paymentChannel: "offline_bank",
      amountCents: 12_500,
      currency: "CNY",
      credits: 5,
      externalOrderReference: "http-check-sales-001"
    })
  });
  assert.equal(paymentOrderResponse.status, 201, "a cookie-authenticated operator may create a pending payment order");
  const paymentOrder = await paymentOrderResponse.json();
  assert.equal(paymentOrder.order.status, "pending_payment");
  assert.equal(store.getTenant("tenant-http-check").wallet.availableCredits, 10, "creating an order must not credit the wallet");

  const paymentConfirmResponse = await fetch(`${baseUrl}/api/v1/admin/payment-orders/${encodeURIComponent(paymentOrder.order.paymentOrderId)}/confirm`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      Origin: "https://relay.example.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ paymentReference: "http-check-bank-001", note: "finance check completed" })
  });
  assert.equal(paymentConfirmResponse.status, 200, "only a confirmed payment order may append a top-up");
  const paymentConfirmed = await paymentConfirmResponse.json();
  assert.equal(paymentConfirmed.order.status, "paid");
  assert.equal(store.getTenant("tenant-http-check").wallet.availableCredits, 15);

  const invoiceCreateResponse = await fetch(`${baseUrl}/api/v1/admin/invoice-requests`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      Origin: "https://relay.example.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      paymentOrderId: paymentOrder.order.paymentOrderId,
      idempotencyKey: "http-check-invoice-v1",
      billingTitle: "HTTP Check Co.",
      taxId: "HTTP-CHECK-TAX-ID"
    })
  });
  assert.equal(invoiceCreateResponse.status, 201);
  const invoiceCreated = await invoiceCreateResponse.json();
  assert.equal(invoiceCreated.invoice.status, "requested");
  assert.equal(Object.hasOwn(invoiceCreated.invoice, "billing"), false, "invoice creation responses must not echo encrypted recipient details");

  const invoiceDetailResponse = await fetch(`${baseUrl}/api/v1/admin/invoice-requests/${encodeURIComponent(invoiceCreated.invoice.invoiceRequestId)}?includeBilling=true`, {
    headers: requestHeaders(cookie)
  });
  assert.equal(invoiceDetailResponse.status, 200);
  assert.equal((await invoiceDetailResponse.json()).invoice.billing.taxId, "HTTP-CHECK-TAX-ID");

  const invoiceListResponse = await fetch(`${baseUrl}/api/v1/admin/invoice-requests?limit=10`, {
    headers: requestHeaders(cookie)
  });
  assert.equal(invoiceListResponse.status, 200);
  const invoiceList = await invoiceListResponse.json();
  assert.equal(Object.hasOwn(invoiceList.invoices[0], "billing"), false, "invoice lists must omit encrypted billing recipient details by default");

  const invoiceIssueResponse = await fetch(`${baseUrl}/api/v1/admin/invoice-requests/${encodeURIComponent(invoiceCreated.invoice.invoiceRequestId)}/issue`, {
    method: "POST",
    headers: {
      ...requestHeaders(cookie),
      Origin: "https://relay.example.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ invoiceNumber: "HTTP-CHECK-INV-001", note: "issued externally" })
  });
  assert.equal(invoiceIssueResponse.status, 200, "a real external invoice number may be recorded after issuance");
  assert.equal((await invoiceIssueResponse.json()).invoice.status, "issued");

  console.log("Relay dead-letter HTTP administration check passed.");
} finally {
  if (server?.listening) {
    server.close();
    await once(server, "close").catch(() => {});
  }
  store?.close();
}
