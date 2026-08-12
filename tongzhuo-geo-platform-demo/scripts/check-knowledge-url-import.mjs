import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openProductionDatabase } from "../production-database.mjs";
import { KnowledgeStore, KnowledgeError } from "../knowledge-store.mjs";
import { KnowledgeUrlImportStore, fetchPublicKnowledgePage } from "../knowledge-url-import-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-knowledge-url-import-"));
const database = openProductionDatabase({ databasePath: path.join(temporaryDirectory, "production.sqlite") });

function fakeResponse({ statusCode = 200, headers = { "content-type": "text/html" }, body = "" } = {}) {
  async function* chunks() { yield Buffer.from(body, "utf8"); }
  return { statusCode, headers, resume() {}, destroy() {}, [Symbol.asyncIterator]: chunks };
}

try {
  const knowledge = new KnowledgeStore(database);
  const actor = null;
  const library = knowledge.createLibrary({ workspaceId: "default", name: "URL 资料", businessLineId: "BL-1", actor });
  const calls = [];
  const importer = new KnowledgeUrlImportStore(database, knowledge, {
    workspaceId: "default",
    previewTtlMs: 60_000,
    fetchPage: async (url) => {
      calls.push(url);
      return { requestedUrl: url, finalUrl: "https://public.example.com/page", title: "公开产品资料", content: "防水材料用于地下室和屋顶施工。施工前应确认基层含水率与节点处理。", contentType: "text/html", sourceBytes: 256 };
    }
  });

  const preview = await importer.createPreview({ workspaceId: "default", libraryId: library.id, url: "https://public.example.com/start", idempotencyKey: "request-1", actor });
  assert.equal(preview.status, "pending", "preview must remain pending before human confirmation");
  assert.equal(knowledge.listDocuments({ workspaceId: "default", libraryId: library.id }).length, 0, "fetch must not create a knowledge document");
  const repeatedPreview = await importer.createPreview({ workspaceId: "default", libraryId: library.id, url: "https://public.example.com/start", idempotencyKey: "request-1", actor });
  assert.equal(repeatedPreview.id, preview.id, "same idempotency key must return existing preview");
  assert.equal(calls.length, 1, "same idempotency key must not fetch again");
  await assert.rejects(() => importer.createPreview({ workspaceId: "default", libraryId: library.id, url: "https://public.example.com/other", idempotencyKey: "request-1", actor }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_IDEMPOTENCY_CONFLICT");

  await assert.rejects(() => importer.commitPreview({ workspaceId: "default", previewId: preview.id, actor }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_CONFIRMATION_REQUIRED");
  const committed = await importer.commitPreview({ workspaceId: "default", previewId: preview.id, confirmed: true, actor });
  assert.equal(committed.preview.status, "committed", "confirmed preview should be committed");
  assert.equal(knowledge.listDocuments({ workspaceId: "default", libraryId: library.id }).length, 1, "confirmed preview must create one document");
  assert.equal(knowledge.documentVersion("default", committed.version.id).source_type, "url", "committed document must retain URL source type");
  const repeatCommit = await importer.commitPreview({ workspaceId: "default", previewId: preview.id, confirmed: true, actor });
  assert.equal(repeatCommit.idempotent, true, "repeated confirmation must be idempotent");

  const duplicatePreview = await importer.createPreview({ workspaceId: "default", libraryId: library.id, url: "https://public.example.com/duplicate", idempotencyKey: "request-2", actor });
  const duplicateCommit = await importer.commitPreview({ workspaceId: "default", previewId: duplicatePreview.id, confirmed: true, actor });
  assert.equal(duplicateCommit.duplicate, true, "same extracted content must not create a duplicate document");
  assert.equal(knowledge.listDocuments({ workspaceId: "default", libraryId: library.id }).length, 1, "duplicate source content must not increase document count");

  const expired = await importer.createPreview({ workspaceId: "default", libraryId: library.id, url: "https://public.example.com/expired", idempotencyKey: "request-3", actor });
  database.connection.prepare("UPDATE knowledge_url_import_previews SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), expired.id);
  await assert.rejects(() => importer.commitPreview({ workspaceId: "default", previewId: expired.id, confirmed: true, actor }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_PREVIEW_EXPIRED");

  await assert.rejects(() => fetchPublicKnowledgePage("http://127.0.0.1/private", { validatePublicUrl: async () => { const error = new Error("blocked"); error.code = "MONITORING_SSRF_BLOCKED"; error.status = 403; throw error; } }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_SSRF_BLOCKED");
  let validations = 0;
  const redirected = await fetchPublicKnowledgePage("https://public.example.com/a", {
    validatePublicUrl: async (url) => { validations += 1; return { url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }; },
    requestPage: async ({ target }) => target.pathname === "/a"
      ? fakeResponse({ statusCode: 302, headers: { location: "https://public.example.com/b" } })
      : fakeResponse({ body: "<html><title>资料页</title><body><main><h1>产品说明</h1><p>这是可以导入的公开内容，用于验证逐跳 URL 安全检查。</p></main></body></html>" })
  });
  assert.equal(validations, 2, "every redirect target must be validated again");
  assert.match(redirected.content, /可以导入的公开内容/, "HTML main content should be extracted");
  await assert.rejects(() => fetchPublicKnowledgePage("https://public.example.com/file", {
    validatePublicUrl: async (url) => ({ url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }),
    requestPage: async () => fakeResponse({ headers: { "content-type": "application/pdf" }, body: "%PDF" })
  }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_CONTENT_TYPE");
  await assert.rejects(() => fetchPublicKnowledgePage("https://public.example.com/compressed", {
    validatePublicUrl: async (url) => ({ url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }),
    requestPage: async () => fakeResponse({ headers: { "content-type": "text/html", "content-encoding": "gzip" }, body: "compressed" })
  }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_CONTENT_ENCODING");
  await assert.rejects(() => fetchPublicKnowledgePage("https://public.example.com/declared-large", {
    maxBytes: 16_384,
    validatePublicUrl: async (url) => ({ url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }),
    requestPage: async () => fakeResponse({ headers: { "content-type": "text/html", "content-length": "20000" }, body: "small" })
  }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_TOO_LARGE");
  await assert.rejects(() => fetchPublicKnowledgePage("https://public.example.com/stream-large", {
    maxBytes: 16_384,
    validatePublicUrl: async (url) => ({ url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }),
    requestPage: async () => fakeResponse({ body: "x".repeat(16_385) })
  }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_TOO_LARGE");
  await assert.rejects(() => fetchPublicKnowledgePage("https://public.example.com/redirect-forever", {
    maxRedirects: 1,
    validatePublicUrl: async (url) => ({ url: new URL(url), records: [{ address: "93.184.216.34", family: 4 }] }),
    requestPage: async () => fakeResponse({ statusCode: 302, headers: { location: "/redirect-forever" } })
  }), (error) => error instanceof KnowledgeError && error.code === "KNOWLEDGE_URL_REDIRECT_LIMIT");
  console.log("knowledge URL import check passed");
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
