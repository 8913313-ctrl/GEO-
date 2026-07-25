import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AiProviderStore } from "../ai-provider-store.mjs";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-ai-provider-"));
try {
  const store = new AiProviderStore({ dataDir, encryptionKey: "unit-test-encryption-key-material" });
  const secret = "sk-demo-1234567890";
  const created = await store.create({ id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", apiKey: secret });
  assert.equal(created.id, "deepseek");
  assert.equal(created.hasApiKey, true);
  assert.equal(created.apiKeyMasked, "sk-d••••••••7890");
  assert.equal(JSON.stringify(created).includes(secret), false);
  assert.equal(JSON.stringify(store.list()).includes(secret), false);
  const persisted = await readFile(path.join(dataDir, "ai-providers.json"), "utf8");
  assert.equal(persisted.includes(secret), false);
  assert.equal(persisted.includes("apiKeyEncrypted"), true);

  const reloadedStore = new AiProviderStore({ dataDir, encryptionKey: "unit-test-encryption-key-material" });
  await reloadedStore.load();
  assert.equal(reloadedStore.list()[0].hasApiKey, true);

  const updated = await store.update("deepseek", { model: "deepseek-reasoner", apiKey: "sk-demo-updated-1234" });
  assert.equal(updated.model, "deepseek-reasoner");
  assert.equal(JSON.stringify(updated).includes("sk-demo-updated-1234"), false);
  const tested = await store.test("deepseek");
  assert.equal(tested.status, "passed");
  assert.equal(tested.provider.connectionStatus, "passed");
  const recorded = await store.recordConnectionTest("deepseek", "failed", "真实模型返回 401");
  assert.equal(recorded.connectionStatus, "failed");
  assert.equal(recorded.lastTestMessage, "真实模型返回 401");
  assert.equal(JSON.stringify(recorded).includes("sk-demo-updated-1234"), false);
  const removed = await store.remove("deepseek");
  assert.equal(removed.id, "deepseek");
  assert.deepEqual(store.list(), []);
  console.log("AI provider store check passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
