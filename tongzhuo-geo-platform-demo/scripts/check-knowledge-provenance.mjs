import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { KnowledgeStore } from "../knowledge-store.mjs";

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-provenance-"));
let database;
try {
  database = new ProductionDatabase({ databasePath: path.join(temp, "knowledge.sqlite") });
  const store = new KnowledgeStore(database, { workspaceId: "default" });
  const publicLibrary = store.createLibrary({ name: "Public evidence", scope: "enterprise" });
  const internalLibrary = store.createLibrary({ name: "Internal evidence", scope: "enterprise" });

  const first = await store.createDocument({ libraryId: publicLibrary.id, title: "Version one", content: "alpha legacy fact", metadata: { visibility: "public" } });
  const second = await store.createVersion({ documentId: first.document_id, title: "Version two", content: "alpha current fact", metadata: { visibility: "public" } });
  const latest = await store.retrieve({ query: "alpha", topK: 10 });
  assert.ok(latest.results.some((item) => item.versionId === second.id));
  assert.equal(latest.results.some((item) => item.versionId === first.id), false, "old indexed version must leave default recall");
  assert.equal(latest.evidence[0].libraryId, publicLibrary.id);
  assert.equal(latest.evidence[0].documentId, first.document_id);
  assert.equal(latest.evidence[0].versionId, second.id);
  assert.equal(latest.evidence[0].chunkId, latest.results[0].chunkId);
  const stableCitation = latest.evidence[0];
  await store.indexVersion({ versionId: second.id });
  const afterReindex = await store.retrieve({ query: "alpha", topK: 10 });
  assert.equal(afterReindex.evidence[0].chunkId, stableCitation.chunkId, "reindexing unchanged content must preserve citation chunk IDs");
  assert.equal(store.validateEvidenceReferences({ evidence: [stableCitation] }).valid, true);

  const internal = await store.createDocument({ libraryId: internalLibrary.id, title: "Internal note", content: "secret-only fact", metadata: { visibility: "internal" } });
  const publicOnly = await store.retrieve({ query: "secret-only", topK: 10 });
  assert.equal(publicOnly.results.some((item) => item.versionId === internal.id), false);
  const internalAllowed = await store.retrieve({ query: "secret-only", topK: 10, includeInternal: true });
  assert.ok(internalAllowed.results.some((item) => item.versionId === internal.id));
  await assert.rejects(() => store.retrieve({ query: "alpha", libraryIds: ["missing-library"] }), (error) => error.code === "KNOWLEDGE_LIBRARY_SCOPE_INVALID");

  const citation = afterReindex.evidence[0];
  assert.equal(store.validateEvidenceReferences({ evidence: [citation] }).valid, true);
  const legacyCitation = { ...citation, chunkId: "KC-GEO-001-01", knowledgeChunkId: "KC-GEO-001-01" };
  const migratedCitation = store.validateEvidenceReferences({ evidence: [legacyCitation] }).items[0];
  assert.equal(migratedCitation.chunkId, citation.chunkId, "legacy KC citation must resolve to the exact formal chunk by quote");
  assert.equal(migratedCitation.legacyResolution.method, "legacy_quote_unique");
  const punctuationDocument = await store.createDocument({ libraryId: publicLibrary.id, title: "Legacy punctuation boundary", content: "punctuation-boundary stable claim；the indexed chunk continues with a policy boundary", metadata: { visibility: "public" } });
  const punctuationEvidence = (await store.retrieve({ query: "punctuation-boundary", topK: 10 })).evidence.find((item) => item.versionId === punctuationDocument.id);
  assert.ok(punctuationEvidence);
  const punctuationBoundaryResolved = store.validateEvidenceReferences({ evidence: [{ ...punctuationEvidence, chunkId: "KC-LEGACY-PUNCTUATION-01", knowledgeChunkId: "KC-LEGACY-PUNCTUATION-01", quote: "punctuation-boundary stable claim。" }] }).items[0];
  assert.equal(punctuationBoundaryResolved.chunkId, punctuationEvidence.chunkId, "legacy quote punctuation must not break a unique hierarchy match");
  assert.throws(() => store.validateEvidenceReferences({ evidence: [{ ...citation, chunkId: "KCH-NOT-EXIST" }] }), (error) => error.code === "KNOWLEDGE_EVIDENCE_REFERENCE_NOT_FOUND");
  const ambiguousVersion = await store.createDocument({ libraryId: publicLibrary.id, title: "Ambiguous legacy quote", content: `ambiguous-token ${"a".repeat(1300)}\n\nambiguous-token ${"b".repeat(1300)}`, metadata: { visibility: "public" } });
  assert.throws(() => store.validateEvidenceReferences({ evidence: [{ libraryId: publicLibrary.id, documentId: ambiguousVersion.document_id, versionId: ambiguousVersion.id, chunkId: "KC-AMBIGUOUS-01", quote: "ambiguous-token" }] }), (error) => error.code === "KNOWLEDGE_EVIDENCE_REFERENCE_NOT_FOUND");
  assert.throws(() => store.validateEvidenceReferences({ evidence: [{ ...citation, chunkId: "missing" }] }), (error) => error.code === "KNOWLEDGE_EVIDENCE_REFERENCE_NOT_FOUND");
  assert.throws(() => store.validateEvidenceReferences({ evidence: [{ ...citation, documentId: "" }] }), (error) => error.code === "KNOWLEDGE_EVIDENCE_REFERENCE_INCOMPLETE");
  const internalEvidence = (await store.retrieve({ query: "secret-only", includeInternal: true })).evidence[0];
  assert.throws(() => store.validateEvidenceReferences({ evidence: [internalEvidence] }), (error) => error.code === "KNOWLEDGE_INTERNAL_EVIDENCE_FORBIDDEN");

  assert.equal(store.vectorBackendStatus().embedding.mode, "local_fallback");
  await assert.rejects(
    () => store.createDocument({ libraryId: publicLibrary.id, title: "Scanned PDF", sourceType: "file", sourceName: "scan.pdf", mimeType: "application/pdf", contentBase64: Buffer.from("%PDF-1.4 no text").toString("base64") }),
    (error) => error.code === "KNOWLEDGE_OCR_NOT_CONFIGURED"
  );

  const batch = await store.createDocumentsBatch({ libraryId: publicLibrary.id, documents: [
    { title: "Batch one", sourceName: "one.txt", mimeType: "text/plain", content: "batch alpha" },
    { title: "Batch two", sourceName: "two.txt", mimeType: "text/plain", content: "batch beta" }
  ] });
  assert.equal(batch.created, 2);
  const partialBatch = await store.createDocumentsBatch({ libraryId: publicLibrary.id, documents: [
    { title: "Invalid file", sourceName: "broken.pdf", contentBase64: "not-base64" },
    { title: "Valid third", sourceName: "three.txt", mimeType: "text/plain", content: "batch gamma" }
  ] });
  assert.equal(partialBatch.created, 1);
  assert.equal(partialBatch.failed, 1);
  const imageBytes = Buffer.from("same-image").toString("base64");
  const imageBatch = store.createAssetsBatch({ libraryId: publicLibrary.id, assets: [{ sourceName: "one.png", mimeType: "image/png", contentBase64: imageBytes, altText: "batch image" }] });
  assert.equal(imageBatch.created, 1);
  await store.processIndexQueue({ limit: 20 });
  const linkedImage = store.listAssets({ libraryId: publicLibrary.id }).find((item) => item.sourceName === "one.png");
  assert.ok(linkedImage?.documentId && linkedImage?.versionId, "bulk images must have a knowledge document/version for RAG provenance");
  assert.ok(Number(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE version_id = ?").get(linkedImage.versionId).count) >= 1);

  const secondLibrary = store.createLibrary({ name: "Second image library", scope: "enterprise" });
  const imageBatch2 = store.createAssetsBatch({ libraryId: secondLibrary.id, assets: [{ sourceName: "same.png", mimeType: "image/png", contentBase64: imageBytes, altText: "same image" }] });
  assert.equal(imageBatch2.created, 1, "the same image may belong to separate libraries");
  console.log("Knowledge provenance check passed");
} finally {
  database?.close();
  await rm(temp, { recursive: true, force: true });
}
