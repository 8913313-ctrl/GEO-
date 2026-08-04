import assert from "node:assert/strict";
import { AiGenerationService } from "../ai-generation-service.mjs";

const secret = "sk-embedding-probe-secret";
const provider = {
  id: "embedding-probe",
  name: "Embedding probe",
  baseUrl: "https://embedding.example.test/v1",
  model: "text-embedding-demo",
  protocol: "openai_compatible",
  kind: "embedding",
  status: "enabled",
  apiKey: secret
};
const calls = [];
let recorded = null;
const providerStore = {
  async load() {},
  find(id) { return id === provider.id ? provider : null; },
  async setModel(id, model) {
    assert.equal(id, provider.id);
    provider.model = model;
  },
  async recordConnectionTest(id, status, message, testedAt) {
    recorded = { id, status, message, testedAt };
    return { id, kind: provider.kind, connectionStatus: status, lastTestMessage: message };
  }
};

const service = new AiGenerationService({
  providerStore,
  timeoutMs: 5000,
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      object: "list",
      data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
      model: provider.model,
      usage: { prompt_tokens: 5, total_tokens: 5 }
    }), { status: 200, headers: { "Content-Type": "application/json", "x-request-id": "embed-probe-001" } });
  }
});

const result = await service.testProvider(provider.id);
assert.equal(result.status, "passed");
assert.equal(result.dimensions, 4);
assert.equal(result.requestId, "embed-probe-001");
assert.equal(recorded?.status, "passed");
assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://embedding.example.test/v1/embeddings");
assert.equal(calls[0].options.method, "POST");
assert.equal(calls[0].options.headers.Authorization, `Bearer ${secret}`);
const body = JSON.parse(calls[0].options.body);
assert.deepEqual(body, { model: "text-embedding-demo", input: "GEO knowledge-base connection probe" });
assert.equal(Object.hasOwn(body, "messages"), false);
assert.equal(JSON.stringify(result).includes(secret), false);

console.log("AI provider embedding probe check passed");
