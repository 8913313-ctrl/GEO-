import assert from "node:assert/strict";
import { AiGenerationService } from "../ai-generation-service.mjs";

const providers = [
  { id: "primary", name: "Primary", baseUrl: "https://primary.example/v1", model: "primary-model", protocol: "openai_compatible", kind: "text", status: "enabled", apiKey: "primary-secret", fallbackProviderIds: ["secondary", "disabled", "embedding"] },
  { id: "secondary", name: "Secondary", baseUrl: "https://secondary.example/v1", model: "secondary-model", protocol: "openai_compatible", kind: "text", status: "enabled", apiKey: "secondary-secret" },
  { id: "disabled", name: "Disabled", baseUrl: "https://disabled.example/v1", model: "disabled-model", protocol: "openai_compatible", kind: "text", status: "disabled", apiKey: "disabled-secret" },
  { id: "embedding", name: "Embedding", baseUrl: "https://embedding.example/v1", model: "embedding-model", protocol: "openai_compatible", kind: "embedding", status: "enabled", apiKey: "embedding-secret" }
];
const providerStore = { async load() {}, find(id) { return providers.find((item) => item.id === id) || null; } };
const response = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

const runs = [];
const order = [];
const service = new AiGenerationService({
  providerStore,
  runStore: { async append(run) { runs.push(run); return run; } },
  maxAttempts: 1,
  upstreamMaxAttempts: 1,
  upstreamRetryBaseMs: 0,
  fetchImpl: async (url) => {
    order.push(new URL(url).hostname);
    if (url.includes("primary.example")) return response(503, { error: { message: "temporarily unavailable primary-secret" } });
    return response(200, { model: "secondary-effective-model", choices: [{ message: { content: JSON.stringify({ ok: true }) }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, input_cost: 0.01, output_cost: 0.02, total_cost: 0.03, currency: "usd" } });
  }
});
const succeeded = await service.generate("failover-check", { providerId: "primary" }, "Return JSON", (raw) => raw);
assert.deepEqual(order, ["primary.example", "secondary.example"], "fallback order must follow the primary provider allowlist");
assert.equal(succeeded.run.providerId, "secondary");
assert.equal(succeeded.run.model, "secondary-effective-model");
assert.deepEqual(succeeded.run.providerAttempts, [
  { providerId: "primary", model: "primary-model", outcome: "failed", errorCode: "UPSTREAM_HTTP_ERROR", upstreamStatus: 503 },
  { providerId: "secondary", model: "secondary-effective-model", outcome: "succeeded" }
]);
assert.deepEqual(succeeded.run.usage, { promptTokens: 10, completionTokens: 5, totalTokens: 15, inputCost: 0.01, outputCost: 0.02, totalCost: 0.03, currency: "USD" });
assert.equal(JSON.stringify(succeeded.run).includes("secret"), false);

const rejectedCalls = [];
const rejectedRuns = [];
const rejectedService = new AiGenerationService({
  providerStore,
  runStore: { async append(run) { rejectedRuns.push(run); return run; } },
  maxAttempts: 1,
  upstreamMaxAttempts: 1,
  fetchImpl: async (url) => { rejectedCalls.push(new URL(url).hostname); return response(400, { error: { message: "invalid request parameter primary-secret" } }); }
});
await assert.rejects(
  () => rejectedService.generate("no-failover-on-400", { providerId: "primary" }, "Return JSON", (raw) => raw),
  (error) => error.code === "UPSTREAM_HTTP_ERROR" && error.generationRun.providerAttempts[0].upstreamStatus === 400
);
assert.deepEqual(rejectedCalls, ["primary.example"], "parameter and safety-class 4xx failures must not switch providers");
assert.equal(rejectedRuns[0].providerId, "primary");
assert.equal(JSON.stringify(rejectedRuns[0]).includes("primary-secret"), false);

console.log("AI provider failover checks passed.");
