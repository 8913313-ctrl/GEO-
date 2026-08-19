import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AiGenerationError, AiGenerationRunStore, AiGenerationService } from "../ai-generation-service.mjs";

const secret = "sk-image-provider-secret-123456";
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLz0QAAAABJRU5ErkJggg==";
const png = Buffer.from(pngBase64, "base64");
const providers = {
  image: {
    id: "image",
    name: "Image provider",
    baseUrl: "https://images.example/v1",
    model: "image-model-1",
    protocol: "openai_compatible",
    kind: "image",
    status: "enabled",
    apiKey: secret
  },
  text: {
    id: "text",
    name: "Text provider",
    baseUrl: "https://text.example/v1",
    model: "text-model-1",
    protocol: "openai_compatible",
    kind: "text",
    status: "enabled",
    apiKey: secret
  }
};

const providerStore = {
  async load() {},
  find(id) { return providers[id] || null; },
  async recordConnectionTest(id, status, message, testedAt) {
    const provider = providers[id];
    return { id: provider.id, name: provider.name, baseUrl: provider.baseUrl, model: provider.model, kind: provider.kind, status: provider.status, connectionStatus: status, lastTestMessage: message, lastTestAt: testedAt, hasApiKey: true };
  }
};

function imagePayload(extra = {}) {
  return {
    providerId: "image",
    articleTitle: "Enterprise GEO content preparation",
    articleContent: "Use verified enterprise knowledge and do not invent customer facts.",
    businessLine: { id: "BL-GEO", name: "GEO services" },
    allowExternalContent: true,
    ...extra
  };
}

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-ai-image-"));
try {
  const calls = [];
  const runStore = new AiGenerationRunStore({ dataDir: temp });
  const service = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        id: "imggen-b64",
        model: "image-model-1",
        data: [{ b64_json: pngBase64 }]
      }), { status: 200, headers: { "Content-Type": "application/json", "x-request-id": "req-image-b64" } });
    }
  });

  const generated = await service.generateImage(imagePayload({ size: "1536x1024" }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://images.example/v1/images/generations");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${secret}`);
  const request = JSON.parse(calls[0].options.body);
  assert.deepEqual(Object.keys(request).sort(), ["model", "n", "prompt", "response_format", "size"]);
  assert.equal(request.model, "image-model-1");
  assert.equal(request.n, 1);
  assert.equal(request.size, "1536x1024");
  assert.equal(request.response_format, "b64_json");
  assert.equal(request.prompt.includes(secret), false);
  assert.equal(generated.image.mimeType, "image/png");
  assert.equal(generated.image.buffer.equals(png), true);
  assert.equal(generated.run.operation, "image");
  assert.equal(generated.run.outputSummary.bytes, png.length);
  assert.equal(Object.hasOwn(generated.run, "apiKey"), false);

  const connectionTest = await service.testProvider("image");
  assert.equal(connectionTest.status, "passed");
  assert.match(connectionTest.message, /图片生成连接测试通过/);

  const persisted = await readFile(path.join(temp, "ai-generation-runs.json"), "utf8");
  assert.equal(persisted.includes(secret), false);
  assert.equal(persisted.includes(pngBase64), false);
  assert.equal(JSON.parse(persisted).runs.some((run) => run.operation === "image" && run.status === "succeeded"), true);

  const urlCalls = [];
  const urlService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async (url, options) => {
      urlCalls.push({ url, options });
      if (url === "https://images.example/v1/images/generations") {
        return new Response(JSON.stringify({ data: [{ url: "https://assets.example/generated.png" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      assert.equal(url, "https://assets.example/generated.png");
      assert.equal(options.redirect, "manual");
      return new Response(png, { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(png.length) } });
    }
  });
  const downloaded = await urlService.generateImage(imagePayload());
  assert.equal(urlCalls.length, 2);
  assert.equal(downloaded.image.mimeType, "image/png");
  assert.equal(downloaded.image.buffer.equals(png), true);

  const blockedUrlService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => new Response(JSON.stringify({ data: [{ url: "http://127.0.0.1/private.png" }] }), { status: 200, headers: { "Content-Type": "application/json" } })
  });
  await assert.rejects(
    () => blockedUrlService.generateImage(imagePayload()),
    (error) => error instanceof AiGenerationError && error.code === "UPSTREAM_UNSAFE_IMAGE_URL"
  );

  const invalidImageService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }), { status: 200, headers: { "Content-Type": "application/json" } })
  });
  await assert.rejects(
    () => invalidImageService.generateImage(imagePayload()),
    (error) => error instanceof AiGenerationError && error.code === "UPSTREAM_INVALID_IMAGE"
  );

  await assert.rejects(
    () => service.generateImage(imagePayload({ providerId: "text" })),
    (error) => error instanceof AiGenerationError && error.code === "PROVIDER_KIND_MISMATCH"
  );

  console.log("AI image generation check passed");
} finally {
  await rm(temp, { recursive: true, force: true });
}
