import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { KnowledgeError, KnowledgeStore } from "../knowledge-store.mjs";

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-enterprise-"));
const vectorItems = new Map();
const vectorStore = {
  configured: true,
  collection: "test-knowledge",
  async upsert({ items }) { items.forEach((item) => vectorItems.set(item.id, item)); return { configured: true, count: items.length }; },
  async query({ topK }) { return { configured: true, matches: [...vectorItems.keys()].slice(0, topK).map((id, index) => ({ id, score: 0.9 - index * 0.01 })) }; }
};
const ocrFetchImpl = async () => new Response(JSON.stringify({ text: "OCR 提取的企业产品边界、交付流程和服务限制。", confidence: 0.98, provider: "test-ocr" }), { status: 200, headers: { "Content-Type": "application/json" } });
let database;
try {
  database = new ProductionDatabase({ databasePath: path.join(temp, "knowledge.sqlite") });
  const store = new KnowledgeStore(database, { workspaceId: "default", vectorStore, ocrEndpoint: "https://ocr.test/parse", ocrFetchImpl });
  const library = store.createLibrary({ name: "企业图像知识", scope: "enterprise" });
  const image = Buffer.from("fake-image-bytes").toString("base64");
  const version = await store.createDocument({ libraryId: library.id, title: "产品图像", sourceType: "file", sourceName: "product.png", mimeType: "image/png", contentBase64: image });
  assert.equal(version.extraction_status, "queued");
  assert.equal(version.extraction_method, "ocr");
  // Knowledge uploads are immediately usable; OCR only enriches searchable
  // text in the background and is not a second approval gate.
  assert.equal(version.review_status, "approved");
  assert.equal(store.listAssets({ versionId: version.id }).length, 1);
  assert.equal(store.listAssets({ versionId: version.id })[0].reviewStatus, "approved");
  assert.equal(store.listAssets({ versionId: version.id })[0].ocrStatus, "queued");
  assert.equal((await store.processOcrQueue({ limit: 5 })).results[0].status, "succeeded");
  const indexed = store.documentVersion("default", version.id);
  assert.equal(indexed.review_status, "approved");
  assert.equal(indexed.index_status, "indexed");
  assert.ok(vectorItems.size > 0);
  const retrieved = await store.retrieve({ query: "产品交付流程", topK: 3 });
  assert.ok(retrieved.results.length > 0);

  store.ocrEndpoint = "";
  await assert.rejects(
    () => store.createDocument({ libraryId: library.id, title: "扫描合同", sourceType: "file", sourceName: "contract.pdf", mimeType: "application/pdf", contentBase64: Buffer.from("%PDF-scanned-placeholder").toString("base64") }),
    (error) => error.code === "KNOWLEDGE_OCR_NOT_CONFIGURED"
  );
  store.ocrEndpoint = "https://ocr.test/parse";
  const queued = await store.createDocument({ libraryId: library.id, title: "扫描合同", sourceType: "file", sourceName: "contract.pdf", mimeType: "application/pdf", contentBase64: Buffer.from("%PDF-scanned-placeholder").toString("base64") });
  assert.equal(queued.extraction_status, "queued");
  assert.equal(queued.review_status, "approved");
  assert.equal(store.listAssets({ versionId: queued.id })[0].reviewStatus, "approved");
  assert.equal(store.documentVersion("default", queued.id).extraction_status, "queued");
  const processed = await store.processOcrQueue({ limit: 5 });
  assert.equal(processed.results[0].status, "succeeded");
  const afterOcr = store.documentVersion("default", queued.id);
  assert.equal(afterOcr.extraction_status, "complete");
  assert.equal(store.documentVersion("default", queued.id).index_status, "indexed");
  assert.equal(store.documentVersion("default", queued.id).index_status, "indexed");
  console.log("Knowledge enterprise capability check passed");
} finally {
  database?.close();
  await rm(temp, { recursive: true, force: true });
}
