import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-api-"));
const port = 45500 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], { cwd: path.resolve("."), env: { ...process.env, NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_DATA_DIR: temp, TZ_DATABASE_PATH: path.join(temp, "knowledge.sqlite"), TZ_LOG_DIR: path.join(temp, "logs"), TZ_AI_PROVIDER_DATA_DIR: path.join(temp, "ai"), TZ_PUBLISHER_DATA_DIR: path.join(temp, "publisher"), TZ_MASTER_KEY: randomBytes(32).toString("base64") }, stdio: "ignore" });
function cookie(response) { return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean)).map((value) => value.split(";", 1)[0]).join("; "); }
async function request(pathname, options = {}) { const response = await fetch(`${base}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; } return { response, body }; }
async function ready() { for (let i = 0; i < 300; i += 1) { try { if ((await request("/health/ready")).response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error("server not ready"); }
try {
  await ready();
  let result = await request("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" }) });
  assert.equal(result.response.status, 201); const session = cookie(result.response); const csrf = result.body.data.csrfToken; const headers = { Cookie: session, "X-CSRF-Token": csrf, "Content-Type": "application/json" };
  result = await request("/api/v1/knowledge/libraries", { method: "POST", headers, body: JSON.stringify({ name: "资产测试库", kind: "document", scope: "enterprise" }) });
  assert.equal(result.response.status, 201); const libraryId = result.body.data.library.id;
  result = await request("/api/v1/knowledge/assets", { method: "POST", headers, body: JSON.stringify({ libraryId, assetType: "file", sourceName: "evidence.txt", mimeType: "text/plain", contentBase64: Buffer.from("企业资产说明").toString("base64"), extractedText: "企业资产说明", altText: "资产说明" }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body)); const assetId = result.body.data.asset.id;
  result = await request(`/api/v1/knowledge/assets/${assetId}/approve`, { method: "POST", headers, body: "{}" }); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  result = await request(`/api/v1/knowledge/assets?libraryId=${libraryId}`, { headers: { Cookie: session } }); assert.equal(result.response.status, 200); assert.equal(result.body.data.items[0].reviewStatus, "approved");
  result = await request("/api/v1/knowledge/documents-batch", { method: "POST", headers, body: JSON.stringify({ libraryId, documents: [
    { title: "Batch PDF companion", sourceName: "manual.txt", mimeType: "text/plain", content: "enterprise batch document one" },
    { title: "Batch Word companion", sourceName: "guide.md", mimeType: "text/markdown", content: "enterprise batch document two" }
  ] }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.created, 2);
  assert.equal(result.body.data.failed, 0);
  result = await request("/api/v1/knowledge/vector-backend", { headers: { Cookie: session } }); assert.equal(result.response.status, 200); assert.equal(result.body.data.kind, "sqlite"); assert.equal(result.body.data.embedding.mode, "local_fallback");
  console.log("Knowledge enterprise API check passed");
} finally { if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); } await rm(temp, { recursive: true, force: true }); }
