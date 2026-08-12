import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-url-api-"));
const port = 45500 + Math.floor(Math.random() * 300);
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
  cwd: path.resolve("."),
  env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: tempDir, TZ_DATABASE_PATH: path.join(tempDir, "production.sqlite"), TZ_LOG_DIR: path.join(tempDir, "logs"), TZ_AI_PROVIDER_DATA_DIR: path.join(tempDir, "ai"), TZ_PUBLISHER_DATA_DIR: path.join(tempDir, "publisher"), TZ_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

function assert(condition, message) { if (!condition) throw new Error(`${message}\n${output}`); }
async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
  return { response, body };
}
function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

try {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try { if ((await request("/health/ready")).response.status === 200) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (attempt === 299) throw new Error(`service did not start\n${output}`);
  }
  let result = await request("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "管理员", password: "KnowledgeUrlAdmin!2026" }) });
  assert(result.response.status === 201, "admin setup failed");
  const cookie = cookieHeader(result.response);
  const csrf = result.body.data.csrfToken;
  const headers = { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" };
  result = await request("/api/v1/knowledge/libraries", { method: "POST", headers, body: JSON.stringify({ name: "网页资料", kind: "document", businessLineId: "BL-1" }) });
  assert(result.response.status === 201, "library creation failed");
  const libraryId = result.body.data.library.id;

  result = await request("/api/v1/knowledge/url-imports/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ libraryId, url: "http://127.0.0.1/private" }) });
  assert(result.response.status === 401, "anonymous preview must be rejected");
  result = await request("/api/v1/knowledge/url-imports/preview", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ libraryId, url: "http://127.0.0.1/private" }) });
  assert(result.response.status === 403 && result.body.code === "CSRF_INVALID", "preview must require CSRF");
  result = await request("/api/v1/knowledge/url-imports/preview", { method: "POST", headers, body: JSON.stringify({ libraryId, url: "http://127.0.0.1/private" }) });
  assert(result.response.status === 403 && result.body.code === "KNOWLEDGE_URL_SSRF_BLOCKED", "loopback URL must be blocked by the API");
  result = await request("/api/v1/audit?limit=50", { headers: { Cookie: cookie } });
  assert(result.response.status === 200 && !result.body.data.items.some((item) => item.action === "knowledge.url_import.commit"), "blocked fetch must not create a commit audit event");
  console.log("knowledge URL import API check passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}
