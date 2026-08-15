import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-production-api-"));
const port = 44000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const adminPassword = "PrivateAdmin!2026";
const operatorPassword = "PrivateOperator!2026";
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
  cwd: path.resolve("."),
  env: {
    ...process.env,
    NODE_ENV: "test",
    TZ_BIND_HOST: "127.0.0.1",
    TZ_COOKIE_SECURE: "0",
    TZ_DATA_DIR: tempDir,
    TZ_DATABASE_PATH: path.join(tempDir, "production.sqlite"),
    TZ_LOG_DIR: path.join(tempDir, "logs"),
    TZ_AI_PROVIDER_DATA_DIR: path.join(tempDir, "ai"),
    TZ_AI_GENERATION_DATA_DIR: path.join(tempDir, "generation"),
    TZ_PUBLISHER_DATA_DIR: path.join(tempDir, "publisher"),
    TZ_MASTER_KEY: randomBytes(32).toString("base64")
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  return { response, body };
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await request("/health/ready");
      if (result.response.status === 200 && result.body.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Production API did not become ready.\n${output}`);
}

try {
  await waitUntilReady();
  let result = await request("/api/v1/auth/status");
  assert(result.response.status === 200 && result.body.data.initialized === false, "Fresh service should require setup");

  result = await request("/api/v1/workspace");
  assert(result.response.status === 401, "Workspace must reject anonymous access");

  result = await request("/api/v1/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", displayName: "企业管理员", password: adminPassword })
  });
  assert(result.response.status === 201 && result.body.data.user.role === "admin", "Admin setup failed");
  const adminCookie = cookieHeader(result.response);
  const adminCsrf = result.body.data.csrfToken;
  assert(adminCookie.includes("tz_session=") && adminCsrf, "Admin session cookies were not issued");

  result = await request("/api/v1/workspace", { headers: { Cookie: adminCookie } });
  assert(result.response.status === 200 && result.body.data.revision === 0, "Fresh workspace should be empty");

  const state = { schemaVersion: 12, businessLines: [{ id: "BL-1", name: "测试业务线", status: "active" }], articles: [], topics: [] };
  result = await request("/api/v1/workspace", {
    method: "PUT",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ state, expectedRevision: 0 })
  });
  assert(result.response.status === 403 && result.body.code === "CSRF_INVALID", "Workspace write must require CSRF");

  result = await request("/api/v1/workspace", {
    method: "PUT",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ state, expectedRevision: 0 })
  });
  assert(result.response.status === 200 && result.body.data.revision === 1, "Workspace initial import failed");

  result = await request("/api/v1/workspace", {
    method: "PUT",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ state, expectedRevision: 0 })
  });
  assert(result.response.status === 409 && result.body.code === "WORKSPACE_REVISION_CONFLICT", "Workspace optimistic lock was not enforced");

  result = await request("/api/v1/site-cms");
  assert(result.response.status === 401, "CMS must reject anonymous access");
  result = await request("/api/v1/site-cms", { headers: { Cookie: adminCookie } });
  assert(result.response.status === 200 && result.body.data.draft && result.body.data.publication === null, "A blank customer deployment should expose a draft without publishing generic identity");
  const cmsDraft = result.body.data.draft;
  result = await request("/api/v1/site-cms/draft", {
    method: "PUT",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: cmsDraft.revision, cms: cmsDraft.snapshot })
  });
  assert(result.response.status === 403 && result.body.code === "CSRF_INVALID", "CMS draft write must require CSRF");
  result = await request("/api/v1/site-cms/draft", {
    method: "PUT",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: cmsDraft.revision, cms: { ...cmsDraft.snapshot, settings: { ...cmsDraft.snapshot.settings, siteName: "测试 CMS 官网" } } })
  });
  assert(result.response.status === 200 && result.body.data.draft.revision > cmsDraft.revision, "CMS draft save failed");
  const updatedCmsDraft = result.body.data.draft;
  result = await request("/api/v1/site-cms/submit-review", {
    method: "POST",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "HTTP CMS contract review" })
  });
  assert(result.response.status === 200 && result.body.data.workflow.status === "pending_review", "CMS review submission failed");
  result = await request("/api/v1/site-cms/approve", {
    method: "POST",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "HTTP CMS contract approval" })
  });
  assert(result.response.status === 200 && result.body.data.workflow.status === "approved", "CMS approval failed");
  result = await request("/api/v1/site-cms/publish", {
    method: "POST",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ expectedDraftRevision: updatedCmsDraft.revision, note: "HTTP CMS contract test" })
  });
  assert(result.response.status === 200 && result.body.data.publication.version === 1, "First CMS publication must create version 1");
  result = await request("/api/v1/site-cms/preview?path=/", { headers: { Cookie: adminCookie } });
  assert(result.response.status === 200 && /noindex/i.test(result.response.headers.get("x-robots-tag") || "") && result.response.headers.get("x-frame-options") === "SAMEORIGIN", "CMS preview headers are unsafe");

  result = await request("/api/v1/users", {
    method: "POST",
    headers: { Cookie: adminCookie, "X-CSRF-Token": adminCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "operator", displayName: "内容运营", password: operatorPassword, role: "operator", status: "active" })
  });
  assert(result.response.status === 201 && result.body.data.user.role === "operator", "Operator creation failed");

  result = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "operator", password: operatorPassword })
  });
  assert(result.response.status === 200, "Operator login failed");
  const operatorCookie = cookieHeader(result.response);
  const operatorCsrf = result.body.data.csrfToken;

  result = await request("/api/v1/users", { headers: { Cookie: operatorCookie } });
  assert(result.response.status === 403, "Operator must not manage users");
  result = await request("/api/ai/providers", { headers: { Cookie: operatorCookie } });
  assert(result.response.status === 200, "Operator should read provider metadata");
  result = await request("/api/ai/providers", {
    method: "POST",
    headers: { Cookie: operatorCookie, "X-CSRF-Token": operatorCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "forbidden", baseUrl: "https://example.com/v1", model: "test", apiKey: "never-save-this" })
  });
  assert(result.response.status === 403, "Operator must not manage model credentials");

  result = await request("/api/v1/external-sites/connections", { headers: { Cookie: operatorCookie } });
  assert(result.response.status === 200 && Array.isArray(result.body.data.items), "Operator should read external site connector metadata");
  result = await request("/api/v1/external-sites/connections", {
    method: "POST",
    headers: { Cookie: operatorCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "No CSRF", type: "generic_http", endpointUrl: "https://publisher.example/hook", settings: { authType: "none" } })
  });
  assert(result.response.status === 403 && result.body.code === "CSRF_INVALID", "External site connection writes must require CSRF");
  result = await request("/api/v1/external-sites/connections", {
    method: "POST",
    headers: { Cookie: operatorCookie, "X-CSRF-Token": operatorCsrf, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Operator forbidden", type: "generic_http", endpointUrl: "https://publisher.example/hook", settings: { authType: "none" } })
  });
  assert(result.response.status === 201 && result.body.data.connection && result.body.data.connection.hasCredentials === false, "Operator should create a connector with content.publish permission");

  result = await request("/api/v1/audit?limit=50", { headers: { Cookie: adminCookie } });
  assert(result.response.status === 200 && result.body.data.items.some((item) => item.action === "workspace.save"), "Server audit log is missing workspace event");

  result = await request("/api/v1/auth/logout", {
    method: "POST",
    headers: { Cookie: operatorCookie, "X-CSRF-Token": operatorCsrf, "Content-Type": "application/json" },
    body: "{}"
  });
  assert(result.response.status === 200, "Logout failed");
  result = await request("/api/v1/workspace", { headers: { Cookie: operatorCookie } });
  assert(result.response.status === 401, "Revoked session remained usable");

  const databaseBytes = await readFile(path.join(tempDir, "production.sqlite"));
  assert(!databaseBytes.includes(Buffer.from(adminPassword)) && !databaseBytes.includes(Buffer.from(operatorPassword)), "Plaintext password leaked into database");
  console.log("Production API check passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}

