import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { KnowledgeStore, parseKnowledgePdf } from "../knowledge-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";

function pdfWithEmbeddedImage() {
  const image = deflateSync(Buffer.from([255, 32, 32]));
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 5 0 R >> >> /MediaBox [0 0 300 300] /Contents 4 0 R >> endobj\n4 0 obj << /Length 58 >> stream\nBT /F1 12 Tf 10 280 Td (Enterprise product manual) Tj ET q /Im1 Do Q\nendstream endobj\n5 0 obj << /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length "),
    Buffer.from(String(image.length)),
    Buffer.from(" >> stream\n"),
    image,
    Buffer.from("\nendstream endobj\n%%EOF")
  ]);
}

const temp = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-multimedia-"));
let database;
try {
  const pdf = pdfWithEmbeddedImage();
  const parsed = parseKnowledgePdf(pdf, { sourceName: "产品手册.pdf" });
  assert.match(parsed.content, /Enterprise product manual/);
  assert.equal(parsed.pageCount, 1);
  assert.equal(parsed.images.length, 1);
  assert.equal(parsed.images[0].mimeType, "image/png");
  assert.equal(parsed.images[0].metadata.pageNumber, 1);
  assert.deepEqual([...parsed.images[0].buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  database = new ProductionDatabase({ databasePath: path.join(temp, "knowledge.sqlite") });
  const store = new KnowledgeStore(database, { workspaceId: "default" });
  const library = store.createLibrary({ name: "产品资料库", scope: "enterprise" });
  const version = await store.createDocument({
    libraryId: library.id,
    title: "产品手册",
    sourceType: "file",
    sourceName: "产品手册.pdf",
    mimeType: "application/pdf",
    contentBase64: pdf.toString("base64")
  });
  assert.equal(version.review_status, "approved");
  assert.equal(version.index_status, "indexed");
  const assets = store.listAssets({ versionId: version.id, limit: 10 });
  assert.equal(assets.filter((asset) => asset.assetType === "file").length, 1);
  assert.equal(assets.filter((asset) => asset.assetType === "image").length, 1);
  const image = assets.find((asset) => asset.assetType === "image");
  assert.equal(image.reviewStatus, "approved");
  assert.equal(image.metadata.pageNumber, 1);
  assert.equal(store.assetContent({ assetId: image.id }).buffer.length, parsed.images[0].buffer.length);
  assert.equal(Number(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_assets WHERE data_base64 = '' AND storage_key <> ''").get().count), 2);

  const batch = store.createAssetsBatch({
    libraryId: library.id,
    assets: [
      { sourceName: "现场照片-1.png", mimeType: "image/png", contentBase64: parsed.images[0].buffer.toString("base64") },
      { sourceName: "重复照片.png", mimeType: "image/png", contentBase64: parsed.images[0].buffer.toString("base64") }
    ]
  });
  assert.equal(batch.created, 0);
  assert.equal(batch.duplicates.length, 2);

  const secondPixel = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
  const uniqueBatch = store.createAssetsBatch({
    libraryId: library.id,
    defaults: { category: "案例现场", license: "企业自有" },
    assets: [
      { sourceName: "现场照片-2.png", mimeType: "image/png", contentBase64: secondPixel.toString("base64"), altText: "现场照片二" },
      { sourceName: "现场照片-3.png", mimeType: "image/png", contentBase64: Buffer.from([4, 5, 6, 7]).toString("base64"), altText: "现场照片三" }
    ]
  });
  assert.equal(uniqueBatch.created, 2);
  assert.equal(uniqueBatch.items.every((asset) => asset.reviewStatus === "approved"), true);
  assert.equal(uniqueBatch.items.every((asset) => asset.metadata.category === "案例现场"), true);
  uniqueBatch.items.forEach((asset) => {
    assert.ok(store.assetContent({ assetId: asset.id }).buffer.length > 0);
  });

  store.ocrEndpoint = "https://ocr.test/parse";
  store.ocrFetchImpl = async () => new Response(JSON.stringify({ text: "diagram OCR fact from embedded PDF image", provider: "test-ocr", confidence: 0.99 }), { status: 200, headers: { "Content-Type": "application/json" } });
  const ocrVersion = await store.createDocument({
    libraryId: library.id,
    title: "PDF image OCR",
    sourceType: "file",
    sourceName: "manual-with-image.pdf",
    mimeType: "application/pdf",
    contentBase64: pdf.toString("base64")
  });
  const embeddedJob = store.listOcrJobs({ versionId: ocrVersion.id }).find((job) => job.status === "queued");
  assert.ok(embeddedJob, "embedded PDF image must have a version-linked OCR job");
  const originalPdfChunkId = database.connection.prepare("SELECT id FROM knowledge_chunks WHERE version_id = ? ORDER BY ordinal ASC LIMIT 1").get(ocrVersion.id).id;
  const ocrResult = await store.processOcrQueue({ limit: 10 });
  assert.equal(ocrResult.results.some((item) => item.id === embeddedJob.id && item.status === "succeeded"), true);
  const ocrChunk = database.connection.prepare("SELECT content_text FROM knowledge_chunks WHERE version_id = ? AND content_text LIKE '%diagram OCR fact%'").get(ocrVersion.id);
  assert.ok(ocrChunk, "embedded PDF image OCR text must be reindexed into knowledge_chunks");
  assert.ok(database.connection.prepare("SELECT id FROM knowledge_chunks WHERE id = ? AND version_id = ?").get(originalPdfChunkId, ocrVersion.id), "PDF image OCR enrichment must preserve existing PDF text citation IDs");

  console.log("Knowledge multimedia check passed");
} finally {
  database?.close();
  await rm(temp, { recursive: true, force: true });
}
