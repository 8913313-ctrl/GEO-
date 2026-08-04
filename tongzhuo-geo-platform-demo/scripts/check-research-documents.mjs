import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ResearchDocumentError,
  ResearchDocumentStore,
  RESEARCH_DOCUMENT_DEFAULTS
} from "../research-document-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-research-documents-"));
const sourceCommit = "1234567890abcdef1234567890abcdef12345678";

async function put(root, relativePath, content) {
  const filePath = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createPackage(name, { includeNarrativeDocuments = true } = {}) {
  const root = path.join(temporaryDirectory, name);
  await mkdir(root, { recursive: true });
  await put(root, "manifest.json", JSON.stringify({
    manifestVersion: 1,
    packageId: "geo-citation-lab",
    repo: RESEARCH_DOCUMENT_DEFAULTS.sourceRepository,
    datasetVersion: "9.8.7",
    releasedAt: "2026-07-29",
    sourceCommit,
    limitations: [{
      code: "FIXTURE_SNAPSHOT_BOUNDARY",
      description: "Fixture observations are a fixed snapshot."
    }]
  }, null, 2));
  await put(root, "upstream/schema/record.schema.json", JSON.stringify({
    title: "Citation record contract",
    description: "引用观察记录的数据契约",
    properties: { platform: { type: "string" }, source_url: { type: "string" } }
  }, null, 2));
  if (includeNarrativeDocuments) {
    await put(root, "upstream/README.md", `# GEO Citation Lab 研究方法

本仓库使用历史引用观察数据比较 AI 平台的信源偏好。

## 平台引用分析

豆包、DeepSeek、千问和元宝必须按相同统计口径比较，不能把内容建议写成历史事实。

## 证据边界

每一项数据结论必须回到引用记录、来源页面和数据版本。`);
    await put(root, "upstream/reports/platform-evidence.html", `<!doctype html>
<html lang="zh-CN"><head><title>平台证据分析规范</title></head><body>
<h1>AI 平台信源偏好</h1><p>分析 DeepSeek 与千问时，应分别统计来源类型、域名和页面。</p>
</body></html>`);
    await put(root, "upstream/docs/research-limitations.txt", "研究限制\n当前数据是固定历史快照，不是客户实时监测结果。\n");
  }
  return root;
}

try {
  const packageRoot = await createPackage("complete-package");
  const first = new ResearchDocumentStore({
    packageRoot,
    expectedDatasetVersion: "9.8.7",
    expectedSourceCommit: sourceCommit,
    maxChunkCharacters: 360
  });
  const second = new ResearchDocumentStore({
    packageRoot,
    expectedDatasetVersion: "9.8.7",
    expectedSourceCommit: sourceCommit,
    maxChunkCharacters: 360
  });
  try {
    const summary = first.summary();
    assert.equal(summary.ok, true);
    assert.equal(summary.state, "ready");
    assert.equal(summary.readOnly, true);
    assert.equal(summary.indexKind, "deterministic_memory_lexical");
    assert.equal(summary.package.datasetVersion, "9.8.7");
    assert.equal(summary.package.sourceCommit, sourceCommit);
    assert.equal(summary.counts.documents, 5);
    assert.equal(summary.counts.methodologyDocuments, 3);
    assert.ok(summary.counts.chunks >= 5);
    assert.equal(summary.categories.data_contract, 1);
    assert.equal(summary.categories.methodology, 3);
    assert.equal(summary.categories.package_metadata, 1);
    assert.equal(summary.limitations.some((item) => item.code === "METHODOLOGY_DOCUMENTS_UNAVAILABLE"), false);
    assert.ok(summary.limitations.some((item) => item.code === "FIXTURE_SNAPSHOT_BOUNDARY"));

    const result = first.search({
      query: "豆包 DeepSeek 千问 元宝相同统计口径",
      categories: ["methodology"],
      limit: 4,
      minimumScore: 0.08
    });
    assert.ok(result.results.length >= 1);
    assert.equal(result.results[0].path, "upstream/README.md");
    assert.equal(result.results[0].sourcePath, "README.md");
    assert.match(result.results[0].sourceUrl, new RegExp(`/blob/${sourceCommit}/README\\.md$`));
    assert.match(result.results[0].snippet, /豆包/);
    assert.match(result.results[0].snippet, /DeepSeek/);
    assert.equal(result.results[0].provenance.datasetVersion, "9.8.7");
    assert.equal(result.results[0].provenance.sourceCommit, sourceCommit);
    assert.equal(result.results[0].provenance.provenanceStatus, "verified_package_snapshot");
    assert.ok(result.results[0].evidenceId.startsWith("RDL-"));
    assert.ok(result.results[0].locator.startLine >= 1);
    assert.ok(result.results[0].limitations.some((item) => item.code === "VERSIONED_SNAPSHOT_ONLY"));
    assert.equal(result.retrievalScope.fabricatedFallbackResults, false);

    const repeat = second.search({
      query: "豆包 DeepSeek 千问 元宝相同统计口径",
      categories: ["methodology"],
      limit: 4,
      minimumScore: 0.08
    });
    assert.deepEqual(
      repeat.results.map((item) => item.evidenceId),
      result.results.map((item) => item.evidenceId),
      "the same pinned corpus must produce stable evidence IDs"
    );

    const contract = first.search({ query: "引用观察记录的数据契约", categories: ["data_contract"] });
    assert.ok(contract.results.length >= 1);
    assert.equal(contract.results[0].category, "data_contract");
    assert.ok(contract.results[0].limitations.some((item) => item.code === "TECHNICAL_CONTEXT_ONLY"));

    const absent = first.search({ query: "量子航天宠物营养完全无关", minimumScore: 0.5 });
    assert.equal(absent.results.length, 0);
    assert.equal(absent.retrievalScope.fabricatedFallbackResults, false);
    assert.throws(() => first.search(""), (error) => error instanceof ResearchDocumentError && error.code === "RESEARCH_DOCUMENT_QUERY_REQUIRED");
  } finally {
    first.close();
    second.close();
  }

  const sparseRoot = await createPackage("sparse-package", { includeNarrativeDocuments: false });
  const sparse = new ResearchDocumentStore({ packageRoot: sparseRoot });
  try {
    const summary = sparse.summary();
    assert.equal(summary.state, "limited");
    assert.equal(summary.counts.methodologyDocuments, 0);
    assert.ok(summary.counts.documents >= 2);
    assert.ok(summary.limitations.some((item) => item.code === "METHODOLOGY_DOCUMENTS_UNAVAILABLE"));
  } finally { sparse.close(); }

  const mirrorRoot = path.join(temporaryDirectory, "official-mirror");
  await put(mirrorRoot, "README.md", "# 镜像研究方法\n\n所有报告结论必须提供证据编号。\n");
  const mirror = new ResearchDocumentStore({
    packageRoot,
    repositoryMirrorPath: mirrorRoot,
    repositoryMirrorCommit: sourceCommit
  });
  try {
    const summary = mirror.summary();
    assert.equal(summary.source.kind, "official_repository_mirror");
    assert.equal(summary.source.provenanceStatus, "declared_mirror_commit");
    assert.ok(summary.limitations.some((item) => item.code === "MIRROR_COMMIT_DECLARED_ONLY"));
    const result = mirror.search("报告结论证据编号");
    assert.equal(result.results[0].path, "README.md");
    assert.equal(result.results[0].sourcePath, "README.md");
  } finally { mirror.close(); }
  assert.throws(() => new ResearchDocumentStore({
    packageRoot,
    repositoryMirrorPath: mirrorRoot,
    repositoryMirrorCommit: "f".repeat(40)
  }), (error) => error instanceof ResearchDocumentError && error.code === "RESEARCH_DOCUMENT_COMMIT_MISMATCH");

  const installed = new ResearchDocumentStore();
  try {
    const summary = installed.summary();
    assert.equal(summary.package.id, "geo-citation-lab");
    assert.ok(summary.counts.documents > 0);
    if (summary.counts.methodologyDocuments === 0) {
      assert.equal(summary.state, "limited");
      assert.ok(summary.limitations.some((item) => item.code === "METHODOLOGY_DOCUMENTS_UNAVAILABLE"));
    } else {
      assert.equal(summary.state, "ready");
      assert.equal(summary.limitations.some((item) => item.code === "METHODOLOGY_DOCUMENTS_UNAVAILABLE"), false);
    }
  } finally { installed.close(); }

  console.log("Research document store check passed");
  console.log("- deterministic versioned chunks: verified");
  console.log("- official mirror provenance guard: verified");
  console.log("- sparse installed corpus is reported as limited: verified");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
