import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { createRelayApi } from "../relay-api.mjs";
import { RelayStore } from "../relay-store.mjs";

const rootToken = "relay-admin-rbac-root-token";
const origin = "https://relay.example.test";
const cookieName = "__Host-relay-admin-rbac";
const proxyHeaders = { "X-Forwarded-Proto": "https", "X-Forwarded-For": "198.51.100.33" };
const writeHeaders = { ...proxyHeaders, Origin: origin, "Content-Type": "application/json" };
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value) {
  let bits = "";
  for (const character of String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 30_000);
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(bytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function cookieFrom(response) {
  return (response.headers.get("set-cookie") || "").split(";", 1)[0];
}

async function jsonRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const store = new RelayStore({ databasePath: ":memory:", masterKey: Buffer.alloc(32, 52) });
const api = createRelayApi({
  store,
  adminToken: rootToken,
  allowInsecureAdmin: false,
  runtimeConfig: {
    adminSessionTtlSeconds: 900,
    adminSessionCookieName: cookieName,
    adminSessionSecureCookie: true,
    publicOrigin: origin,
    trustedProxyAddresses: ["127.0.0.1"],
    requireHttpsForAdmin: true
  }
});
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (await api.handle(request, response, url)) return;
  response.writeHead(404).end();
});

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let result = await jsonRequest(baseUrl, "/api/v1/admin/bootstrap", {
    method: "POST",
    headers: { ...writeHeaders, Authorization: `Bearer ${rootToken}` },
    body: JSON.stringify({ username: "admin", displayName: "平台主管", password: "SuperAdmin!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.user.role, "super_admin");
  assert.equal(store.countAdminUsers(), 1);

  result = await jsonRequest(baseUrl, "/api/v1/admin/bootstrap", {
    method: "POST",
    headers: { ...writeHeaders, Authorization: `Bearer ${rootToken}` },
    body: JSON.stringify({ username: "other", displayName: "重复初始化", password: "OtherAdmin!2026" })
  });
  assert.equal(result.response.status, 409, "root token must not bootstrap a second first administrator");

  result = await jsonRequest(baseUrl, "/api/v1/admin/login", {
    method: "POST",
    headers: { ...proxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "SuperAdmin!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  let superCookie = cookieFrom(result.response);
  assert.equal(result.body.mfaVerified, false);

  result = await jsonRequest(baseUrl, "/api/v1/admin/users", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: JSON.stringify({ username: "ops", displayName: "运营管理员", password: "Operations!2026", role: "operations" })
  });
  assert.equal(result.response.status, 403, "high-risk administrator creation must require MFA");

  result = await jsonRequest(baseUrl, "/api/v1/admin/me/mfa/enroll", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: "{}"
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const mfaSecret = result.body.enrollment.secret;
  assert.match(mfaSecret, /^[A-Z2-7]{32}$/);
  result = await jsonRequest(baseUrl, "/api/v1/admin/me/mfa/confirm", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: JSON.stringify({ totp: totp(mfaSecret) })
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.mfaVerified, true);

  result = await jsonRequest(baseUrl, "/api/v1/admin/users", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: JSON.stringify({ username: "ops", displayName: "运营管理员", password: "Operations!2026", role: "operations" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const operationsUser = result.body.user;
  result = await jsonRequest(baseUrl, "/api/v1/admin/users", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: JSON.stringify({ username: "audit", displayName: "审计员", password: "AuditReader!2026", role: "auditor" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await jsonRequest(baseUrl, "/api/v1/admin/login", {
    method: "POST",
    headers: { ...proxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ops", password: "Operations!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const operationsCookie = cookieFrom(result.response);
  result = await jsonRequest(baseUrl, "/api/v1/admin/overview", { headers: { ...proxyHeaders, Cookie: operationsCookie } });
  assert.equal(result.response.status, 200, "operations role must read the console");
  result = await jsonRequest(baseUrl, "/api/v1/admin/users", { headers: { ...proxyHeaders, Cookie: operationsCookie } });
  assert.equal(result.response.status, 403, "operations role must not enumerate administrator accounts");
  result = await jsonRequest(baseUrl, "/api/v1/admin/providers/aidso", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: operationsCookie },
    body: JSON.stringify({ providerAccountId: "provider_missing", displayName: "blocked-before-store" })
  });
  assert.equal(result.response.status, 403, "operations high-risk provider changes must require MFA before store access");

  result = await jsonRequest(baseUrl, "/api/v1/admin/login", {
    method: "POST",
    headers: { ...proxyHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "audit", password: "AuditReader!2026" })
  });
  assert.equal(result.response.status, 201);
  const auditCookie = cookieFrom(result.response);
  result = await jsonRequest(baseUrl, "/api/v1/admin/overview", { headers: { ...proxyHeaders, Cookie: auditCookie } });
  assert.equal(result.response.status, 200);
  result = await jsonRequest(baseUrl, "/api/v1/admin/tenants", {
    method: "POST",
    headers: { ...writeHeaders, Cookie: auditCookie },
    body: JSON.stringify({ displayName: "forbidden tenant" })
  });
  assert.equal(result.response.status, 403, "auditor must remain read-only");

  result = await jsonRequest(baseUrl, `/api/v1/admin/users/${encodeURIComponent(operationsUser.adminUserId)}`, {
    method: "PATCH",
    headers: { ...writeHeaders, Cookie: superCookie },
    body: JSON.stringify({ status: "disabled" })
  });
  assert.equal(result.response.status, 200);
  result = await jsonRequest(baseUrl, "/api/v1/admin/overview", { headers: { ...proxyHeaders, Cookie: operationsCookie } });
  assert.equal(result.response.status, 401, "disabling an administrator must revoke active sessions");

  const adminRow = store.db.prepare("SELECT * FROM relay_admin_users WHERE normalized_username = 'admin'").get();
  assert.equal(JSON.stringify(adminRow).includes("SuperAdmin!2026"), false, "passwords must never be stored in plaintext");
  assert.equal(String(adminRow.mfa_secret_envelope_json).includes(mfaSecret), false, "TOTP secrets must be encrypted at rest");
  assert.ok(store.listAuditEvents({ limit: 100 }).some((event) => event.action === "admin.mfa_enabled"));
  console.log("Relay named administrator, RBAC and MFA checks passed.");
} finally {
  server.close();
  await once(server, "close").catch(() => {});
  store.close();
}
