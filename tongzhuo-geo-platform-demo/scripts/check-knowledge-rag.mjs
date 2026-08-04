import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { KnowledgeStore, inferDocumentFormat, parseKnowledgeFile } from "../knowledge-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-rag-"));
let database;

try {
  assert.equal(inferDocumentFormat("text/html", "company.html"), "html");
  assert.match(parseKnowledgeFile(Buffer.from("<h1>企业产品</h1><p>GEO &amp; AI</p>"), { mimeType: "text/html", sourceName: "company.html" }), /企业产品[\s\S]*GEO & AI/);
  assert.match(parseKnowledgeFile(Buffer.from("# 企业资料\n\n[产品手册](https://example.com)"), { mimeType: "text/markdown", sourceName: "manual.md" }), /企业资料[\s\S]*产品手册/);
  assert.throws(() => parseKnowledgeFile(Buffer.from("not-a-pdf"), { mimeType: "application/pdf", sourceName: "scan.pdf" }), (error) => error.code === "KNOWLEDGE_FILE_OCR_REQUIRED" || error.code === "KNOWLEDGE_FILE_INVALID");
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "knowledge.sqlite") });
  const store = new KnowledgeStore(database, { workspaceId: "default" });
  const actor = null;
  const library = store.createLibrary({ name: "工业品知识库", kind: "document", businessLineId: "BL-1", actor });
  assert.equal(library.name, "工业品知识库");

  const version = await store.createDocument({
    libraryId: library.id,
    title: "工业品 GEO 服务交付说明",
    sourceType: "text",
    content: "工业品 GEO 优化首先需要建立企业事实和产品边界。\n\n交付流程包括企业资料审核、问题词包规划、文章生成、人工审核和多平台发布。\n\n没有经过企业审核的客户名称、价格和效果数字不得写入对外文章。",
    actor
  });
  assert.equal(version.review_status, "approved");
  assert.equal(version.index_status, "indexed");

  const approved = await store.approveVersion({ versionId: version.id, actor });
  assert.equal(approved.reviewStatus, "approved");
  assert.equal(approved.indexStatus, "indexed");
  const chunkCount = Number(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE version_id = ?").get(version.id).count);
  assert.ok(chunkCount >= 1, "approved document should be chunked");
  assert.equal(Number(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE version_id = ? AND embedding_status = 'ready'").get(version.id).count), chunkCount);

  const result = await store.retrieve({ query: "工业品 GEO 优化的交付流程是什么？", businessLineId: "BL-1", topK: 4, actor });
  assert.equal(result.knowledgeGap, false);
  assert.ok(result.runId);
  assert.ok(result.results.length >= 1);
  assert.ok(result.evidence[0].chunkId);
  assert.ok(result.evidence[0].versionId === version.id);
  assert.equal(store.retrievalRun("default", result.runId).results.length, result.results.length);

  const hidden = store.createLibrary({ name: "其他业务线资料", kind: "document", businessLineId: "BL-2", actor });
  const hiddenVersion = await store.createDocument({ libraryId: hidden.id, title: "其他业务线", content: "这是另一条业务线的资料。", actor });
  await store.approveVersion({ versionId: hiddenVersion.id, actor });
  const scoped = await store.retrieve({ query: "这是另一条业务线的资料", businessLineId: "BL-1", actor });
  assert.equal(scoped.results.some((item) => item.versionId === hiddenVersion.id), false, "business line filter must prevent cross-line retrieval");

  console.log("knowledge RAG check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
