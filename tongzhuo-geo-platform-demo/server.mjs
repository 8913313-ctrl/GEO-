import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publisherStore } from "./publisher-store.mjs";
import { aiProviderStore, AiProviderError } from "./ai-provider-store.mjs";
import { aiGenerationService, AiGenerationError } from "./ai-generation-service.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.argv[2] || process.env.PORT || 43127);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

mimeTypes[".exe"] = "application/vnd.microsoft.portable-executable";

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(body);
}

async function requestJson(request, maxBytes = 1_500_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("请求体过大。");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("请求 JSON 格式无效。");
    error.status = 422;
    throw error;
  }
}

function routeParts(request) {
  return new URL(request.url || "/", "http://localhost").pathname.split("/").filter(Boolean);
}

async function handlePublisherApi(request, response, parts) {
  await publisherStore.load();
  if (request.method === "GET" && parts.length === 2 && parts[1] === "overview") {
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.overview() });
  }
  if (request.method === "POST" && parts.length === 2 && parts[1] === "jobs") {
    return jsonResponse(response, 201, { ok: true, job: await publisherStore.createJobs(await requestJson(request)) });
  }
  if (request.method === "POST" && parts.length === 4 && parts[1] === "jobs" && parts[3] === "cancel") {
    return jsonResponse(response, 200, { ok: true, job: await publisherStore.cancelJob(parts[2]) });
  }
  const method = request.method || "GET";
  if (method === "GET" && parts.length === 2 && parts[1] === "platforms") {
    return jsonResponse(response, 200, { ok: true, platforms: publisherStore.platforms() });
  }
  if (method === "POST" && parts.length === 2 && parts[1] === "pairings") {
    return jsonResponse(response, 201, { ok: true, pairing: await publisherStore.createPairing() });
  }
  if (method === "POST" && parts.length === 3 && parts[1] === "devices" && parts[2] === "register") {
    return jsonResponse(response, 201, { ok: true, result: await publisherStore.register(await requestJson(request)) });
  }
  if (parts.length >= 3 && parts[1] === "devices") {
    const deviceId = decodeURIComponent(parts[2]);
    const device = publisherStore.state.devices.find((item) => item.id === deviceId);
    if (!device) return jsonResponse(response, 404, { ok: false, message: "发布器设备不存在。" });
    if (parts[3] === "heartbeat" && method === "POST") {
      return jsonResponse(response, 200, { ok: true, status: await publisherStore.heartbeat(device, await requestJson(request)) });
    }
    if (parts[3] === "sessions" && method === "GET") {
      return jsonResponse(response, 200, { ok: true, sessions: await publisherStore.sessions(device) });
    }
    if (parts[3] === "sessions" && method === "POST") {
      return jsonResponse(response, 200, { ok: true, session: await publisherStore.updateSession(device, await requestJson(request)) });
    }
  }
  return jsonResponse(response, 404, { ok: false, message: "发布器接口不存在。" });
}

async function handlePublisherWorkerApi(request, response, parts) {
  await publisherStore.load();
  const device = publisherStore.authenticate(request.headers);
  if (request.method === "GET" && parts[1] === "jobs") {
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: await publisherStore.jobs(device, query.get("limit")) } });
  }
  if (parts[1] === "jobs" && parts[2] && parts[3] === "claim" && request.method === "POST") {
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.claimJob(device, parts[2]) });
  }
  if (parts[1] === "jobs" && parts[2] && parts[3] === "result" && request.method === "POST") {
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.result(device, parts[2], await requestJson(request)) });
  }
  return jsonResponse(response, 404, { ok: false, message: "发布器任务接口不存在。" });
}

async function handleAiProviderApi(request, response, parts) {
  await aiProviderStore.load();
  const method = request.method || "GET";
  if (method === "GET" && parts.length === 3) {
    return jsonResponse(response, 200, { ok: true, providers: aiProviderStore.list() });
  }
  if (method === "POST" && parts.length === 3) {
    const provider = await aiProviderStore.create(await requestJson(request));
    return jsonResponse(response, 201, { ok: true, provider });
  }
  if (parts.length === 4) {
    const id = decodeURIComponent(parts[3]);
    if (method === "PATCH") {
      const provider = await aiProviderStore.update(id, await requestJson(request));
      return jsonResponse(response, 200, { ok: true, provider });
    }
    if (method === "DELETE") {
      const provider = await aiProviderStore.remove(id);
      return jsonResponse(response, 200, { ok: true, provider });
    }
  }
  if (method === "POST" && parts.length === 5 && parts[4] === "test") {
    const result = await aiGenerationService.testProvider(decodeURIComponent(parts[3]));
    return jsonResponse(response, 200, { ok: true, result });
  }
  return jsonResponse(response, 404, { ok: false, message: "AI 供应商接口不存在。" });
}

async function handleAiGenerationApi(request, response, parts) {
  if (parts.length !== 4) {
    return jsonResponse(response, 404, { ok: false, code: "GENERATION_ROUTE_NOT_FOUND", message: "AI 生成接口不存在。" });
  }
  if (request.method !== "POST") {
    return jsonResponse(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "AI 生成接口只接受 POST 请求。" });
  }
  const payload = await requestJson(request);
  const operation = parts[3];
  if (operation === "questions") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateQuestions(payload) });
  }
  if (operation === "seeds") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateSeeds(payload) });
  }
  if (operation === "topics") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateTopics(payload) });
  }
  if (operation === "article") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateArticle(payload) });
  }
  return jsonResponse(response, 404, { ok: false, code: "GENERATION_ROUTE_NOT_FOUND", message: "AI 生成接口不存在。" });
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(root, requested);
  return resolved.startsWith(path.resolve(root)) ? resolved : null;
}

const server = http.createServer(async (request, response) => {
  try {
    const parts = routeParts(request);
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "providers") {
      try {
        return await handleAiProviderApi(request, response, parts);
      } catch (error) {
        const status = error instanceof AiProviderError ? error.status : error.status || 422;
        return jsonResponse(response, status, { ok: false, message: error.message || "AI 供应商请求失败。" });
      }
    }
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "generate") {
      try {
        return await handleAiGenerationApi(request, response, parts);
      } catch (error) {
        const status = error instanceof AiGenerationError ? error.status : error.status || 500;
        const code = error instanceof AiGenerationError ? error.code : status === 413 ? "REQUEST_TOO_LARGE" : "AI_GENERATION_ERROR";
        const details = error instanceof AiGenerationError && Array.isArray(error.details) ? error.details : undefined;
        return jsonResponse(response, status, { ok: false, code, message: error.message || "AI 生成请求失败。", ...(details ? { details } : {}) });
      }
    }
    if (parts[0] === "api" && ((parts[1] === "v1" && parts[2] === "publisher") || parts[1] === "publisher")) {
      try {
        const isV1 = parts[1] === "v1";
        const publisherParts = isV1 ? parts.slice(2) : parts.slice(1);
        if (publisherParts[1] === "devices" || publisherParts[1] === "pairings" || publisherParts[1] === "overview" || publisherParts[1] === "platforms" || publisherParts[1] === "jobs") {
          if (publisherParts[1] === "jobs" && isV1) return await handlePublisherWorkerApi(request, response, publisherParts);
          return await handlePublisherApi(request, response, publisherParts);
        }
        return await handlePublisherWorkerApi(request, response, publisherParts);
      } catch (error) {
        return jsonResponse(response, error.message.includes("尚未完成配对") ? 401 : 422, { ok: false, message: error.message });
      }
    }
    let filePath = safePath(request.url || "/");
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      filePath = path.join(root, "index.html");
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Tongzhuo GEO demo: http://127.0.0.1:${port}`);
});
