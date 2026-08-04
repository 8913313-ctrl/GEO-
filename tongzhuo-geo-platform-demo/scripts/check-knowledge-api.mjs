import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-api-"));
const port = 45000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
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
    TZ_PUBLISHER_DATA_DIR: path.join(tempDir, "publisher"),
    TZ_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

function assertOk(condition, message) {
  if (!condition) throw new Error(`${message}\n${output}`);
}

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

async function waitUntilReady() {
  // Citation Lab and its research database can take longer than the old
  // five-second budget on a cold private-deployment start.
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const result = await request("/health/ready");
      if (result.response.status === 200) return;
    } catch {
      // service is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Knowledge API service did not become ready.\n${output}`);
}

try {
  await waitUntilReady();
  let result = await request("/api/v1/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", displayName: "知识管理员", password: "KnowledgeAdmin!2026" }) });
  assertOk(result.response.status === 201, "admin setup failed");
  const cookie = cookieHeader(result.response);
  const csrf = result.body.data.csrfToken;
  const headers = { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" };

  result = await request("/api/v1/knowledge/libraries", { method: "POST", headers, body: JSON.stringify({ name: "工业品资料", kind: "document", businessLineId: "BL-1", description: "企业产品和服务资料" }) });
  assertOk(result.response.status === 201, "library creation failed");
  const libraryId = result.body.data.library.id;

  result = await request(`/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, { method: "POST", headers, body: JSON.stringify({ title: "交付边界", content: "工业品 GEO 交付包括资料审核、问题规划、文章生产和人工审核。未经审核的价格和效果数字不能对外发布。", sourceType: "text" }) });
  assertOk(result.response.status === 201, "document creation failed");
  const versionId = result.body.data.version.id;

  const htmlBytes = Buffer.from("<h1>GEO</h1><p>企业知识文件解析后进入 RAG。</p>", "utf8").toString("base64");
  result = await request(`/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, { method: "POST", headers, body: JSON.stringify({ title: "HTML 资料", sourceType: "file", sourceName: "manual.html", mimeType: "text/html", contentBase64: htmlBytes }) });
  assertOk(result.response.status === 201, "base64 document creation failed");
  const fileVersionId = result.body.data.version.id;
  result = await request(`/api/v1/knowledge/versions/${encodeURIComponent(fileVersionId)}?includeContent=1`, { headers });
  assertOk(result.response.status === 200 && /企业知识文件解析后进入 RAG/.test(result.body.data.version.content), "parsed version content was not returned");
  result = await request(`/api/v1/knowledge/versions/${encodeURIComponent(fileVersionId)}/approve`, { method: "POST", headers, body: "{}" });
  assertOk(result.response.status === 200 && result.body.data.version.indexStatus === "indexed", "parsed file approval/indexing failed");

  result = await request(`/api/v1/knowledge/versions/${encodeURIComponent(versionId)}/approve`, { method: "POST", headers, body: "{}" });
  assertOk(result.response.status === 200 && result.body.data.version.indexStatus === "indexed", "version approval/indexing failed");

  result = await request("/api/v1/knowledge/retrieve", { method: "POST", headers, body: JSON.stringify({ query: "工业品 GEO 交付流程有哪些？", businessLineId: "BL-1", topK: 4 }) });
  assertOk(result.response.status === 200 && result.body.data.results.length >= 1, "RAG retrieval failed");
  assertOk(result.body.data.evidence[0].versionId === versionId, "retrieval citation version mismatch");

  result = await request("/api/v1/knowledge/retrieve", { method: "POST", headers, body: JSON.stringify({ query: "工业品 GEO 交付流程有哪些？", businessLineId: "BL-NOT-ALLOWED", topK: 4 }) });
  assertOk(result.response.status === 200 && result.body.data.results.length === 0, "business line filter leaked knowledge");

  result = await request(`/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, { method: "POST", headers, body: JSON.stringify({ title: "Internal pricing", content: "private-price-secret-987", metadata: { visibility: "internal" } }) });
  assertOk(result.response.status === 201, "internal document creation failed");
  const internalVersionId = result.body.data.version.id;
  result = await request("/api/v1/knowledge/retrieve", { method: "POST", headers, body: JSON.stringify({ query: "private-price-secret-987", businessLineId: "BL-1", includeInternal: true, topK: 10 }) });
  assertOk(result.response.status === 200 && !result.body.data.results.some((item) => item.versionId === internalVersionId), "public retrieval endpoint leaked internal knowledge");
  console.log("knowledge API check passed");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}
