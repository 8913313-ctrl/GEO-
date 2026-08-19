import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLz0QAAAABJRU5ErkJggg==";
const png = Buffer.from(pngBase64, "base64");
const secret = "sk-http-image-secret-123456";
const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-ai-image-api-"));
const providerServer = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/images/generations") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  const payload = JSON.parse(body);
  assert.equal(payload.model, "local-image-model");
  assert.equal(payload.n, 1);
  assert.equal(payload.response_format, "b64_json");
  assert.ok(String(payload.prompt).includes("GEO"));
  assert.equal(request.headers.authorization, `Bearer ${secret}`);
  response.writeHead(200, { "Content-Type": "application/json", "x-request-id": "local-image-request" });
  response.end(JSON.stringify({ model: "local-image-model", data: [{ b64_json: pngBase64 }] }));
});
await new Promise((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
const providerPort = providerServer.address().port;
const port = 46_000 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.resolve("server.mjs"), String(port)], {
  cwd: path.resolve("."),
  env: {
    ...process.env,
    NODE_ENV: "test",
    TZ_BIND_HOST: "127.0.0.1",
    TZ_COOKIE_SECURE: "0",
    TZ_SITE_EMBED: "false",
    TZ_DATA_DIR: temp,
    TZ_DATABASE_PATH: path.join(temp, "content.sqlite"),
    TZ_LOG_DIR: path.join(temp, "logs"),
    TZ_AI_PROVIDER_DATA_DIR: path.join(temp, "ai"),
    TZ_AI_GENERATION_DATA_DIR: path.join(temp, "ai"),
    TZ_PUBLISHER_DATA_DIR: path.join(temp, "publisher"),
    TZ_MASTER_KEY: randomBytes(32).toString("base64")
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let childOutput = "";
child.stdout.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-8_000); });
child.stderr.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-8_000); });

function cookies(response) {
  return (typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean))
    .map((value) => value.split(";", 1)[0]).join("; ");
}

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  let body = {};
  try { body = buffer.length ? JSON.parse(buffer.toString("utf8")) : {}; } catch { body = { raw: buffer.toString("utf8") }; }
  return { response, body, buffer };
}

async function waitReady() {
  for (let index = 0; index < 180; index += 1) {
    if (child.exitCode !== null) throw new Error(`server exited before readiness\n${childOutput}`);
    try {
      const result = await request("/health/ready");
      if (result.response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not become ready\n${childOutput}`);
}

try {
  await waitReady();
  let result = await request("/api/v1/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", displayName: "Admin", password: "PrivateAdmin!2026" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const cookie = cookies(result.response);
  const csrf = result.body.data.csrfToken;
  const auth = { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" };

  result = await request("/api/ai/providers", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ name: "Local image provider", protocol: "openai_compatible", baseUrl: `http://127.0.0.1:${providerPort}/v1`, model: "local-image-model", kind: "image", status: "enabled", apiKey: secret })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const providerId = result.body.provider.id;

  result = await request("/api/v1/knowledge/libraries", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ name: "文章图片资产库", kind: "document", scope: "enterprise" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const libraryId = result.body.data.library.id;

  result = await request("/api/ai/generate/image", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      providerId,
      model: "local-image-model",
      libraryId,
      businessLineId: "BL-GEO",
      businessLineName: "GEO 服务",
      articleTitle: "企业 GEO 内容如何建立可信信源？",
      articleContent: "文章讨论 GEO 内容、企业知识和可追溯证据。",
      allowExternalContent: true,
      size: "1024x1024"
    })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const asset = result.body.data.asset;
  assert.equal(asset.reviewStatus, "pending");
  assert.equal(asset.metadata.sourceRole, "ai_generated_image");
  assert.equal(asset.metadata.providerId, providerId);
  assert.ok(asset.contentUrl);

  result = await request(asset.contentUrl, { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.response.headers.get("content-type"), "image/png");
  assert.equal(result.buffer.equals(png), true);

  const runs = await readFile(path.join(temp, "ai", "ai-generation-runs.json"), "utf8");
  assert.equal(runs.includes(secret), false);
  assert.equal(runs.includes(pngBase64), false);
  console.log("AI image API workflow check passed");
} finally {
  providerServer.close();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(temp, { recursive: true, force: true });
}
