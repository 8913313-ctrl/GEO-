import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCitationDocumentUpdateApi } from "../citation-document-update-api.mjs";
import {
  CitationDocumentUpdateError,
  CitationDocumentUpdateStore,
  resolveActiveCitationResearchDocuments
} from "../citation-document-update-store.mjs";
import { ResearchDocumentError, ResearchDocumentStore } from "../research-document-store.mjs";

const OLD_COMMIT = "a".repeat(40);
const FIRST_COMMIT = "b".repeat(40);
const SECOND_COMMIT = "c".repeat(40);
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-citation-document-updates-"));

function blobSha(buffer) {
  const bytes = Buffer.from(buffer);
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
}

function fixtureFiles(label) {
  return new Map(Object.entries({
    LICENSE: `# GEO Citation Lab licensing\n\nThis repository uses separate licenses for software and original content. Software uses LICENSE-CODE and original reports use LICENSE-CONTENT. Third-party terms remain in THIRD_PARTY_NOTICES.md. These files cover only contributor rights and directory-level terms take precedence. Redistributions must preserve this file, LICENSE-CODE, LICENSE-CONTENT, applicable directory-level licenses, and THIRD_PARTY_NOTICES.md. ${"Scope details. ".repeat(20)} ${label}\n`,
    "LICENSE-CODE": `MIT License\n\nCopyright (c) 2026 Yao Jingang and GEO Citation Lab contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies. The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`,
    "LICENSE-CONTENT": `# Creative Commons Attribution 4.0 International\n\nOriginal content is licensed under the Creative Commons Attribution 4.0 International license (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/ . When sharing or adapting this material, provide reasonable attribution, link to the license, and indicate whether you made changes. GEO Citation Lab contributors are the requested attribution. This license applies only to rights held by the contributors. It does not cover academic papers, source datasets, fonts, trademarks, or other third-party material. ${"Attribution scope details. ".repeat(18)}\n`,
    "THIRD_PARTY_NOTICES.md": `# Third-party materials and distribution scope\n\nGEO Citation Lab collects research reports, datasets, metadata, and academic papers from several sources. The CN-GEO materials derive from WENDAOstudy/cn-geo-citation-dataset and keep their source terms. Copyright in each academic paper remains with its authors or publisher. This notice does not grant additional rights to third-party material. ${"Distribution boundary details. ".repeat(24)}\n`,
    "README.md": `# GEO Citation Lab ${label}\n\nPinned research snapshot.\n`,
    "01-geo-experiment-data-report/QUICK_REPORT.md": `# Citation selection report ${label}\n\nCitation breadth and absorption depth use separate measurements.\n`,
    "03-cn-geo-citation-dataset/data/数据集中文说明.md": `# 数据集说明 ${label}\n\n豆包、DeepSeek、千问和元宝使用相同统计口径。\n`,
    "03-cn-geo-citation-dataset/reports/final/CN-GEO_report.html": `<!doctype html><title>CN GEO ${label}</title><h1>平台引用偏好</h1>`
  }).map(([name, value]) => [name, Buffer.from(value, "utf8")]));
}

function treeFor(files, extraEntries = []) {
  return [...files.entries()].map(([filePath, bytes]) => ({
    path: filePath,
    mode: "100644",
    type: "blob",
    sha: blobSha(bytes),
    size: bytes.length
  })).concat(extraEntries);
}

function jsonResponse(value) {
  const body = Buffer.from(JSON.stringify(value));
  return new Response(body, { status: 200, headers: { "content-type": "application/json", "content-length": String(body.length) } });
}

function rawResponse(bytes) {
  return new Response(bytes, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "content-length": String(bytes.length) } });
}

function githubFixture(options = {}) {
  const commits = new Map([
    [FIRST_COMMIT, fixtureFiles("first")],
    [SECOND_COMMIT, fixtureFiles("second")]
  ]);
  const treeShas = new Map([...commits.keys()].map((commit) => [commit, crypto.createHash("sha1").update(`tree:${commit}`).digest("hex")]));
  const commitByTree = new Map([...treeShas].map(([commit, treeSha]) => [treeSha, commit]));
  let head = options.head || FIRST_COMMIT;
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/commits/HEAD")) return jsonResponse({ sha: head, commit: { tree: { sha: treeShas.get(head) } } });
    const treeMatch = url.pathname.match(/\/git\/trees\/([a-f0-9]{40})$/i);
    if (url.hostname === "api.github.com" && treeMatch) {
      const treeSha = treeMatch[1];
      const commit = commitByTree.get(treeSha);
      const files = commits.get(commit);
      if (!files) return new Response("missing", { status: 404 });
      const extras = options.extraTreeEntries?.(commit) || [];
      return jsonResponse({ sha: treeSha, truncated: false, tree: treeFor(files, extras) });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      assert.deepEqual(parts.slice(0, 2), ["yaojingang", "geo-citation-lab"]);
      const commit = parts[2];
      const filePath = parts.slice(3).map(decodeURIComponent).join("/");
      const source = commits.get(commit)?.get(filePath);
      if (!source) return new Response("missing", { status: 404 });
      if (options.tamperPath === filePath) {
        const changed = Buffer.from(source);
        changed[0] = changed[0] === 65 ? 66 : 65;
        return rawResponse(changed);
      }
      return rawResponse(source);
    }
    throw new Error(`Unexpected fixture URL: ${url}`);
  };
  return { fetch, commits, get head() { return head; }, set head(value) { head = value; } };
}

function storeFor(packageRoot, fixture) {
  return new CitationDocumentUpdateStore({
    packageRoot,
    fetch: fixture.fetch,
    minimumDocumentCount: 3,
    minimumMethodologyCount: 3,
    maxFileBytes: 256_000,
    maxSnapshotBytes: 2_000_000,
    metadataTimeoutMs: 5_000,
    fileTimeoutMs: 5_000
  });
}

function responseCapture() {
  return { value: null, json(status, body) { this.value = { status, body }; return this.value; } };
}

async function callApi(handler, method, url, body = undefined) {
  const response = responseCapture();
  const request = { method, url, body, headers: {} };
  const parts = new URL(url, "http://localhost").pathname.split("/").filter(Boolean);
  await handler(request, response, parts);
  return response.value;
}

async function createDataPackage(root) {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({
    manifestVersion: 1,
    packageId: "geo-citation-lab",
    repo: "https://github.com/yaojingang/geo-citation-lab",
    datasetVersion: "9.9.9",
    releasedAt: "2026-07-29",
    sourceCommit: OLD_COMMIT,
    limitations: []
  }), "utf8");
}

async function writeFiles(root, files) {
  for (const [relative, bytes] of files) {
    const target = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

try {
  const packageRoot = path.join(temporaryDirectory, "lifecycle", "geo-citation-lab");
  const fixture = githubFixture();
  const store = storeFor(packageRoot, fixture);

  const legacyRoot = path.join(temporaryDirectory, "legacy", "geo-citation-lab");
  await mkdir(path.join(legacyRoot, "2.0.1"), { recursive: true });
  await writeFile(path.join(legacyRoot, "2.0.1", "manifest.json"), JSON.stringify({ packageId: "geo-citation-lab", datasetVersion: "2.0.1", sourceCommit: FIRST_COMMIT }), "utf8");
  await writeFiles(path.join(legacyRoot, `repository-mirror-${FIRST_COMMIT.slice(0, 8)}`), fixture.commits.get(FIRST_COMMIT));
  const legacyStore = storeFor(legacyRoot, fixture);
  let legacyStatus = await legacyStore.status();
  assert.equal(legacyStatus.current.legacy, true);
  assert.equal(legacyStatus.current.verified, false);
  legacyStatus = await legacyStore.checkForUpdates();
  assert.equal(legacyStatus.candidate.sourceCommit, FIRST_COMMIT, "an unverified legacy mirror must be adoptable as a verified snapshot even when HEAD has the same commit");

  let status = await store.status();
  assert.equal(status.current, null);
  assert.equal(status.updatePolicy.executesGit, false);
  assert.equal(status.updatePolicy.downloadsPinnedRawFilesOnly, true);

  status = await store.checkForUpdates();
  assert.equal(status.candidate.sourceCommit, FIRST_COMMIT);
  assert.equal(status.candidate.lifecycle, "discovered");
  assert.equal(status.candidate.counts.documents, 4);
  assert.equal(status.candidate.counts.methodology, 4);
  assert.ok(status.candidate.files.every((item) => item.rawUrl.includes(`/${FIRST_COMMIT}/`)));
  await assert.rejects(() => store.stageCandidate({ candidateId: status.candidate.id }), (error) => error.code === "CITATION_DOCUMENT_CONFIRMATION_REQUIRED");

  status = await store.stageCandidate({ candidateId: status.candidate.id, confirm: true });
  assert.equal(status.candidate.lifecycle, "staged");
  status = await store.validateStagedCandidate({ candidateId: status.candidate.id });
  assert.equal(status.candidate.lifecycle, "validated");
  status = await store.activateCandidate({ candidateId: status.candidate.id, expectedCurrentCommit: "", confirm: true });
  assert.equal(status.current.sourceCommit, FIRST_COMMIT);
  assert.equal(status.current.verified, true);
  assert.equal(status.current.legacy, false);
  assert.ok(existsSync(path.join(packageRoot, "document-snapshots", FIRST_COMMIT)));

  fixture.head = SECOND_COMMIT;
  status = await store.checkForUpdates();
  status = await store.stageCandidate({ candidateId: status.candidate.id, confirm: true });
  status = await store.validateStagedCandidate({ candidateId: status.candidate.id });
  status = await store.activateCandidate({ candidateId: status.candidate.id, expectedCurrentCommit: FIRST_COMMIT, confirm: true });
  assert.equal(status.current.sourceCommit, SECOND_COMMIT);
  assert.equal(status.installed.filter((item) => item.verified).length, 2);
  assert.ok(existsSync(path.join(packageRoot, "document-snapshots", FIRST_COMMIT)), "activating a new snapshot must preserve the old one");

  const rollbackReadme = path.join(packageRoot, "document-snapshots", FIRST_COMMIT, "README.md");
  const rollbackOriginal = await readFile(rollbackReadme);
  await writeFile(rollbackReadme, Buffer.concat([rollbackOriginal, Buffer.from("tampered")]));
  await assert.rejects(() => store.rollback({ expectedCurrentCommit: SECOND_COMMIT, confirm: true }), (error) => error.code === "CITATION_DOCUMENT_ROLLBACK_TARGET_UNAVAILABLE");
  const unchangedPointer = JSON.parse(await readFile(path.join(packageRoot, ".document-updates", "document-active.json"), "utf8"));
  assert.equal(unchangedPointer.activeCommit, SECOND_COMMIT, "a tampered rollback target must not change the active pointer");
  await writeFile(rollbackReadme, rollbackOriginal);
  status = await store.rollback({ expectedCurrentCommit: SECOND_COMMIT, confirm: true });
  assert.equal(status.current.sourceCommit, FIRST_COMMIT);
  assert.ok(status.installed.some((item) => item.sourceCommit === SECOND_COMMIT && item.verified), "rollback must preserve the newer snapshot");

  const resolved = resolveActiveCitationResearchDocuments({ packageRoot, minimumDocumentCount: 3, minimumMethodologyCount: 3 });
  assert.equal(resolved.active.sourceCommit, FIRST_COMMIT);
  assert.equal(resolved.active.verified, true);
  assert.equal(resolved.pointer.activeCommit, FIRST_COMMIT);

  const dataPackageRoot = path.join(temporaryDirectory, "data-package");
  await createDataPackage(dataPackageRoot);
  assert.throws(() => new ResearchDocumentStore({
    packageRoot: dataPackageRoot,
    repositoryMirrorPath: resolved.active.documentRoot,
    repositoryMirrorCommit: FIRST_COMMIT
  }), (error) => error instanceof ResearchDocumentError && error.code === "RESEARCH_DOCUMENT_COMMIT_MISMATCH");
  const documents = new ResearchDocumentStore({
    packageRoot: dataPackageRoot,
    repositoryMirrorPath: resolved.active.documentRoot,
    repositoryMirrorCommit: FIRST_COMMIT,
    allowIndependentRepositorySnapshot: true,
    independentRepositorySnapshot: resolved.active,
    maxChunkCharacters: 400
  });
  try {
    const summary = documents.summary();
    assert.equal(summary.package.sourceCommit, FIRST_COMMIT);
    assert.equal(summary.package.datasetSourceCommit, OLD_COMMIT);
    assert.equal(summary.package.independentRepositorySnapshot, true);
    assert.equal(summary.source.provenanceStatus, "verified_independent_snapshot");
    assert.ok(summary.limitations.some((item) => item.code === "DOCUMENT_DATASET_COMMIT_DIFFER"));
    assert.ok(documents.search("Citation selection report", { minimumScore: 0.05 }).results.length > 0);
  } finally { documents.close(); }
  assert.throws(() => new ResearchDocumentStore({
    packageRoot: dataPackageRoot,
    repositoryMirrorPath: resolved.active.documentRoot,
    repositoryMirrorCommit: FIRST_COMMIT,
    allowIndependentRepositorySnapshot: true,
    independentRepositorySnapshot: { ...resolved.active, verified: false }
  }), (error) => error.code === "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED");

  const handler = createCitationDocumentUpdateApi({ store, requestJson: async (request) => request.body || {}, configured: { requestBodyLimit: 100_000 } });
  let api = await callApi(handler, "GET", "/api/v1/citation-document-updates/status");
  assert.equal(api.status, 200);
  assert.equal(api.body.data.update.current.sourceCommit, FIRST_COMMIT);
  fixture.head = FIRST_COMMIT;
  api = await callApi(handler, "POST", "/api/v1/citation-document-updates/check");
  assert.equal(api.status, 200);
  assert.equal(api.body.data.update.candidate, null);

  const tamperedRoot = path.join(temporaryDirectory, "tampered", "geo-citation-lab");
  const tamperedFixture = githubFixture({ tamperPath: "README.md" });
  const tamperedStore = storeFor(tamperedRoot, tamperedFixture);
  let tamperedStatus = await tamperedStore.checkForUpdates();
  await assert.rejects(
    () => tamperedStore.stageCandidate({ candidateId: tamperedStatus.candidate.id, confirm: true }),
    (error) => error instanceof CitationDocumentUpdateError && error.code === "CITATION_DOCUMENT_DOWNLOAD_GIT_BLOB_MISMATCH"
  );
  assert.equal(existsSync(path.join(tamperedRoot, ".document-updates", "staging")), true);
  const stagingEntries = await (async () => { try { return await readdir(path.join(tamperedRoot, ".document-updates", "staging")); } catch { return []; } })();
  assert.equal(stagingEntries.length, 0, "failed staging must remove its isolated temporary directory");

  const activationTamperRoot = path.join(temporaryDirectory, "activation-tamper", "geo-citation-lab");
  const activationTamperFixture = githubFixture();
  const activationTamperStore = storeFor(activationTamperRoot, activationTamperFixture);
  let activationTamperStatus = await activationTamperStore.checkForUpdates();
  activationTamperStatus = await activationTamperStore.stageCandidate({ candidateId: activationTamperStatus.candidate.id, confirm: true });
  activationTamperStatus = await activationTamperStore.validateStagedCandidate({ candidateId: activationTamperStatus.candidate.id });
  const activationStage = path.join(activationTamperRoot, ...activationTamperStatus.candidate.stagedRelativePath.split("/"));
  const activationReadme = path.join(activationStage, "README.md");
  await writeFile(activationReadme, Buffer.concat([await readFile(activationReadme), Buffer.from("changed after validation")]));
  await assert.rejects(
    () => activationTamperStore.activateCandidate({ candidateId: activationTamperStatus.candidate.id, expectedCurrentCommit: "", confirm: true }),
    (error) => error.code === "CITATION_DOCUMENT_SNAPSHOT_SIZE_MISMATCH"
  );
  assert.equal(existsSync(path.join(activationTamperRoot, ".document-updates", "document-active.json")), false, "validation-to-activation tampering must not create a pointer");

  const stateFailureRoot = path.join(temporaryDirectory, "state-failure", "geo-citation-lab");
  const stateFailureFixture = githubFixture();
  const stateFailureStore = storeFor(stateFailureRoot, stateFailureFixture);
  let stateFailureStatus = await stateFailureStore.checkForUpdates();
  stateFailureStatus = await stateFailureStore.stageCandidate({ candidateId: stateFailureStatus.candidate.id, confirm: true });
  stateFailureStatus = await stateFailureStore.validateStagedCandidate({ candidateId: stateFailureStatus.candidate.id });
  const originalWriteState = stateFailureStore.writeState.bind(stateFailureStore);
  let rejectNextStateWrite = true;
  stateFailureStore.writeState = async (value) => {
    if (rejectNextStateWrite) { rejectNextStateWrite = false; throw new Error("injected state commit failure"); }
    return originalWriteState(value);
  };
  await assert.rejects(
    () => stateFailureStore.activateCandidate({ candidateId: stateFailureStatus.candidate.id, expectedCurrentCommit: "", confirm: true }),
    (error) => error.code === "CITATION_DOCUMENT_ACTIVATION_STATE_COMMIT_FAILED"
  );
  assert.equal(existsSync(path.join(stateFailureRoot, ".document-updates", "document-active.json")), false, "state commit failure must restore the previous pointer");
  assert.equal(existsSync(path.join(stateFailureRoot, ...stateFailureStatus.candidate.stagedRelativePath.split("/"))), true, "state commit failure must restore the validated staging directory");

  const licenseRoot = path.join(temporaryDirectory, "license-change", "geo-citation-lab");
  const licenseFixture = githubFixture();
  licenseFixture.commits.set(FIRST_COMMIT, new Map(licenseFixture.commits.get(FIRST_COMMIT)));
  licenseFixture.commits.get(FIRST_COMMIT).set("LICENSE-CODE", Buffer.concat([licenseFixture.commits.get(FIRST_COMMIT).get("LICENSE-CODE"), Buffer.from("\nAll rights reserved.\n")]));
  const licenseStore = storeFor(licenseRoot, licenseFixture);
  let licenseStatus = await licenseStore.checkForUpdates();
  await assert.rejects(
    () => licenseStore.stageCandidate({ candidateId: licenseStatus.candidate.id, confirm: true }),
    (error) => error.code === "CITATION_DOCUMENT_SNAPSHOT_LICENSE_INVALID"
  );

  const unsafeRoot = path.join(temporaryDirectory, "unsafe", "geo-citation-lab");
  const unsafeFixture = githubFixture({ extraTreeEntries: () => [{ path: "../escape.md", mode: "100644", type: "blob", sha: "d".repeat(40), size: 12 }] });
  const unsafeStore = storeFor(unsafeRoot, unsafeFixture);
  await assert.rejects(() => unsafeStore.checkForUpdates(), (error) => error.code === "CITATION_DOCUMENT_PATH_INVALID");
  assert.equal(existsSync(path.join(temporaryDirectory, "unsafe", "escape.md")), false);

  const manifest = JSON.parse(await readFile(path.join(resolved.active.documentRoot, ".citation-document-snapshot.json"), "utf8"));
  assert.equal(manifest.sourceCommit, FIRST_COMMIT);
  assert.ok(manifest.files.every((item) => /^[a-f0-9]{40}$/.test(item.gitBlobSha) && /^[a-f0-9]{64}$/.test(item.sha256)));

  console.log("Citation document update check passed");
  console.log("- official commit/tree/raw allowlist and Git blob verification: verified");
  console.log("- isolated staging, SHA-256, UTF-8, license and corpus thresholds: verified");
  console.log("- independent activation pointer, retained snapshots and rollback: verified");
  console.log("- explicit verified document/data commit separation: verified");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
