import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createRelayApi } from "../relay-api.mjs";
import { RelayStore } from "../relay-store.mjs";

const rootToken = "relay-admin-session-check-root-token";
const store = new RelayStore({ databasePath: ":memory:", masterKey: Buffer.alloc(32, 41) });
const api = createRelayApi({
  store,
  adminToken: rootToken,
  allowInsecureAdmin: false,
  runtimeConfig: {
    adminSessionTtlSeconds: 900,
    adminSessionCookieName: "__Host-relay-admin-session-check",
    adminSessionSecureCookie: true,
    adminSessionRetentionDays: 7,
    publicOrigin: "https://relay.example.test",
    trustedProxyAddresses: ["127.0.0.1"],
    requireHttpsForAdmin: true,
    rawResponseRetentionDays: 30
  }
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (await api.handle(request, response, url)) return;
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const proxyHeaders = { "X-Forwarded-Proto": "https", "X-Forwarded-For": "198.51.100.22" };

  const untrustedProxyApi = createRelayApi({
    store,
    adminToken: rootToken,
    allowInsecureAdmin: false,
    runtimeConfig: {
      adminSessionTtlSeconds: 900,
      adminSessionCookieName: "__Host-relay-admin-session-check",
      adminSessionSecureCookie: true,
      publicOrigin: "https://relay.example.test",
      trustedProxyAddresses: ["127.0.0.2"],
      requireHttpsForAdmin: true
    }
  });
  const untrustedProxyServer = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    if (await untrustedProxyApi.handle(request, response, url)) return;
    response.writeHead(404).end();
  });
  try {
    untrustedProxyServer.listen(0, "127.0.0.1");
    await once(untrustedProxyServer, "listening");
    const untrustedPort = untrustedProxyServer.address().port;
    const spoofedHttps = await fetch(`http://127.0.0.1:${untrustedPort}/api/v1/admin/session`, {
      headers: { Authorization: `Bearer ${rootToken}`, ...proxyHeaders }
    });
    assert.equal(spoofedHttps.status, 401, "X-Forwarded-Proto from an untrusted peer must not bypass HTTPS enforcement");
  } finally {
    untrustedProxyServer.close();
    await once(untrustedProxyServer, "close").catch(() => {});
  }

  const unauthorized = await fetch(`${baseUrl}/api/v1/admin/overview`);
  assert.equal(unauthorized.status, 401, "admin API must reject requests without a root token or session cookie");

  const insecureCli = await fetch(`${baseUrl}/api/v1/admin/session`, {
    headers: { Authorization: `Bearer ${rootToken}` }
  });
  assert.equal(insecureCli.status, 401, "production-style admin credentials must not be accepted over plain HTTP");
  const cli = await fetch(`${baseUrl}/api/v1/admin/session`, {
    headers: { Authorization: `Bearer ${rootToken}`, ...proxyHeaders }
  });
  assert.equal(cli.status, 200, "the configured root token remains usable for CLI automation");
  assert.equal((await cli.json()).authType, "root_token");

  const login = await fetch(`${baseUrl}/api/v1/admin/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rootToken}`,
      "Content-Type": "application/json",
      ...proxyHeaders
    },
    body: JSON.stringify({ operatorLabel: "session-check" })
  });
  assert.equal(login.status, 201, "the root token must exchange for a short-lived session");
  const loginPayload = await login.json();
  assert.equal(loginPayload.authType, "session");
  assert.equal(JSON.stringify(loginPayload).includes(rootToken), false, "the login response must never echo the root token");
  const setCookie = login.headers.get("set-cookie") || "";
  assert.match(setCookie, /__Host-relay-admin-session-check=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Max-Age=900/i);
  const cookie = setCookie.split(";")[0];
  assert.ok(cookie.length > 40, "the session cookie must contain an opaque high-entropy value");

  const sessionRead = await fetch(`${baseUrl}/api/v1/admin/session`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(sessionRead.status, 200);
  const sessionPayload = await sessionRead.json();
  assert.equal(sessionPayload.authType, "session");
  assert.equal(sessionPayload.role, "operator");

  const sessionOverview = await fetch(`${baseUrl}/api/v1/admin/overview`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(sessionOverview.status, 200, "a session cookie must authorize admin reads without a Bearer header");

  const csrfBlocked = await fetch(`${baseUrl}/api/v1/admin/tenants`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", ...proxyHeaders },
    body: JSON.stringify({ displayName: "Blocked without origin" })
  });
  assert.equal(csrfBlocked.status, 403, "cookie-authenticated state changes require a same-origin request");

  const createdTenant = await fetch(`${baseUrl}/api/v1/admin/tenants`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://relay.example.test", "Content-Type": "application/json", ...proxyHeaders },
    body: JSON.stringify({ displayName: "Session authenticated tenant", initialCredits: 12 })
  });
  assert.equal(createdTenant.status, 201, "same-origin session writes must be accepted");

  const initialOperations = await fetch(`${baseUrl}/api/v1/admin/ops/summary`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(initialOperations.status, 200);
  assert.equal((await initialOperations.json()).runtime.rawResponseRetentionDays, 30, "deployment retention must cap the default operator setting");

  const deadLetterList = await fetch(`${baseUrl}/api/v1/admin/deliveries/dead-letter?limit=10`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(deadLetterList.status, 200, "operators must be able to inspect client-delivery dead letters");
  assert.deepEqual((await deadLetterList.json()).deliveries, []);

  const lengthenRetention = await fetch(`${baseUrl}/api/v1/admin/settings`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://relay.example.test", "Content-Type": "application/json", ...proxyHeaders },
    body: JSON.stringify({ storage: { rawResponseRetentionDays: 180 } })
  });
  assert.equal(lengthenRetention.status, 200);
  const cappedOperations = await fetch(`${baseUrl}/api/v1/admin/ops/summary`, { headers: { Cookie: cookie, ...proxyHeaders } });
  const cappedRuntime = (await cappedOperations.json()).runtime;
  assert.equal(cappedRuntime.rawResponseRetentionDays, 30, "a console setting must not lengthen the deployment privacy ceiling");
  assert.equal(cappedRuntime.rawResponseRetentionCeilingDays, 30);

  const shortenRetention = await fetch(`${baseUrl}/api/v1/admin/settings`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://relay.example.test", "Content-Type": "application/json", ...proxyHeaders },
    body: JSON.stringify({ storage: { rawResponseRetentionDays: 0 } })
  });
  assert.equal(shortenRetention.status, 200);
  const shortenedOperations = await fetch(`${baseUrl}/api/v1/admin/ops/summary`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal((await shortenedOperations.json()).runtime.rawResponseRetentionDays, 0, "a console setting may tighten raw-response retention immediately");

  const auditResponse = await fetch(`${baseUrl}/api/v1/admin/audit?limit=50`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  assert.ok(audit.events.some((event) => event.action === "admin.session_created" && event.actorType === "operator_session"), "session creation must be auditable");
  assert.ok(audit.events.some((event) => event.action === "tenant.created" && event.actorType === "operator_session"), "session-authenticated mutations must retain their actor type");

  const logout = await fetch(`${baseUrl}/api/v1/admin/session`, {
    method: "DELETE",
    headers: { Cookie: cookie, Origin: "https://relay.example.test", ...proxyHeaders }
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/i);
  const afterLogout = await fetch(`${baseUrl}/api/v1/admin/overview`, { headers: { Cookie: cookie, ...proxyHeaders } });
  assert.equal(afterLogout.status, 401, "a revoked session must not remain authorized");

  const expired = store.createAdminSession({
    ttlSeconds: 1,
    now: new Date(Date.now() - 10_000),
    remoteAddress: "127.0.0.1"
  });
  const expiredCookie = `__Host-relay-admin-session-check=${encodeURIComponent(expired.sessionToken)}`;
  const expiredResponse = await fetch(`${baseUrl}/api/v1/admin/overview`, { headers: { Cookie: expiredCookie, ...proxyHeaders } });
  assert.equal(expiredResponse.status, 401, "expired sessions must be rejected even before the cleanup job runs");

  const restartSession = store.createAdminSession({ ttlSeconds: 600, remoteAddress: "127.0.0.1" });
  assert.ok(store.authenticateAdminSession(restartSession.sessionToken), "a newly-issued session should be usable before restart revocation");
  assert.equal(store.revokeActiveAdminSessions({ reason: "service_restart" }), 1, "service startup must revoke surviving browser sessions");
  assert.equal(store.authenticateAdminSession(restartSession.sessionToken), null, "a restarted/restored service must not resurrect prior sessions");

  const sessionRows = store.db.prepare("SELECT token_hash FROM relay_admin_sessions").all();
  assert.equal(JSON.stringify(sessionRows).includes(rootToken), false, "SQLite must not persist the root token");
  console.log("Relay administrator session check passed.");
} finally {
  server.close();
  await once(server, "close").catch(() => {});
  store.close();
}
