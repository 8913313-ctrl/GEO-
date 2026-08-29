import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "public/js/modules/content-review.js"), "utf8");

assert.match(source, /function studioEvidenceFromCitation\(citation\)/);
assert.match(source, /const citationEvidence = articleCitations\(article\)\.map\(studioEvidenceFromCitation\)/);
assert.match(source, /evidence\.length !== citationEvidence\.length/);
assert.match(source, /当前文章的知识引用快照不完整/);
assert.match(source, /persist: false/);

const helper = source.match(/function studioEvidenceFromCitation\(citation\) \{[\s\S]*?\n\}\n\nfunction aiEvidencePayload/);
assert.ok(helper, "direct studio must normalize article citations before AI collaboration");
for (const field of ["libraryId", "documentId", "versionId", "chunkId", "referenceComplete"]) {
  assert.match(helper[0], new RegExp(field), `citation normalizer must preserve ${field}`);
}

const payload = source.match(/function aiEvidencePayload\(evidence\) \{[\s\S]*?\n\}\n\nfunction applyRemoteArticleResult/);
assert.ok(payload, "AI evidence payload function must remain present");
for (const field of ["knowledgeLibraryId", "knowledgeDocumentId", "knowledgeVersionId", "knowledgeChunkId"]) {
  assert.match(payload[0], new RegExp(field), `AI payload must send ${field}`);
}

console.log("Direct studio collaboration citation check passed");
