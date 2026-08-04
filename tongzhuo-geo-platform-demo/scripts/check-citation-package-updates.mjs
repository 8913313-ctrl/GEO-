import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CitationPackageUpdateError,
  CitationPackageUpdateStore,
  resolveActiveCitationResearchPackage
} from "../citation-package-update-store.mjs";
import { createCitationPackageUpdateApi } from "../citation-package-update-api.mjs";

const OFFICIAL_REPO = "https://github.com/yaojingang/geo-citation-lab";
const CURRENT_COMMIT = "1".repeat(40);
const CANDIDATE_COMMIT = "2".repeat(40);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-citation-update-"));
const packageRoot = path.join(temporaryRoot, "research-packages", "geo-citation-lab");
const assetsRoot = path.join(temporaryRoot, "release-assets");

function digest(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

function createDatabase(databasePath, version, commit) {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    CREATE TABLE source_artifacts (artifact_name TEXT PRIMARY KEY, repository_path TEXT NOT NULL, size_bytes INTEGER NOT NULL, minimum_size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL) STRICT;
    CREATE TABLE table_inventory (table_name TEXT PRIMARY KEY, row_count INTEGER NOT NULL, source_artifact TEXT NOT NULL) STRICT;
    CREATE TABLE research_limitations (code TEXT PRIMARY KEY, description TEXT NOT NULL) STRICT;
    CREATE TABLE questions (question_id TEXT PRIMARY KEY, prompt TEXT NOT NULL DEFAULT '', prompt_normalized TEXT NOT NULL DEFAULT '', source_layer TEXT NOT NULL DEFAULT '', source_subcat TEXT NOT NULL DEFAULT '', citation_record_count INTEGER NOT NULL DEFAULT 0, platform_count INTEGER NOT NULL DEFAULT 0, source_count INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE question_labels (question_id TEXT NOT NULL, label_dimension TEXT NOT NULL, label_value TEXT NOT NULL, label_cn TEXT NOT NULL, confidence REAL, label_source TEXT, taxonomy_version TEXT, source_layer TEXT, source_subcat TEXT);
    CREATE TABLE ai_platforms (platform_code TEXT PRIMARY KEY, platform_name_cn TEXT NOT NULL DEFAULT '', product_family TEXT NOT NULL DEFAULT '', terminal TEXT NOT NULL DEFAULT '', company_ecosystem TEXT NOT NULL DEFAULT '', mapping_status TEXT NOT NULL DEFAULT '') STRICT;
    CREATE TABLE sources (source_id TEXT PRIMARY KEY, domain TEXT NOT NULL DEFAULT '', source_display_name TEXT NOT NULL DEFAULT '', source_category_l1 TEXT NOT NULL DEFAULT '', source_category_l1_cn TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT '', source_type_cn TEXT NOT NULL DEFAULT '', ecosystem TEXT NOT NULL DEFAULT '', classification_status TEXT NOT NULL DEFAULT '') STRICT;
    CREATE TABLE pages (page_id TEXT PRIMARY KEY, source_id TEXT, canonical_url TEXT NOT NULL DEFAULT '', page_title TEXT NOT NULL DEFAULT '', source_display_name TEXT NOT NULL DEFAULT '', representative_published_date TEXT) STRICT;
    CREATE TABLE citation_observations (citation_id TEXT PRIMARY KEY, question_id TEXT NOT NULL, platform_code TEXT, page_id TEXT, source_id TEXT, canonical_url TEXT NOT NULL DEFAULT '', quote_title TEXT NOT NULL DEFAULT '', site_name_raw TEXT NOT NULL DEFAULT '', snippet TEXT NOT NULL DEFAULT '', domain_normalized TEXT NOT NULL DEFAULT '', source_layer TEXT NOT NULL DEFAULT '', source_subcat TEXT NOT NULL DEFAULT '', record_hash TEXT NOT NULL DEFAULT '', occurrence_count INTEGER NOT NULL DEFAULT 1, is_preferred_exact_record INTEGER NOT NULL DEFAULT 1, availability_flags TEXT NOT NULL DEFAULT '', quality_flags TEXT NOT NULL DEFAULT '', release_date TEXT NOT NULL DEFAULT '') STRICT;
  `);
  const insert = database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries({
    schema_version: 1,
    package_id: "geo-citation-lab",
    dataset_version: version,
    release_date: "2026-07-29",
    source_commit: commit,
    source_repository: OFFICIAL_REPO,
    deterministic_build: true
  })) insert.run(key, JSON.stringify(value));
  database.close();
}

function baseManifest(version, commit, sqliteBuffer) {
  const checksum = digest(sqliteBuffer);
  return {
    manifestVersion: 1,
    packageId: "geo-citation-lab",
    name: "GEO Citation Lab",
    repo: OFFICIAL_REPO,
    datasetVersion: version,
    releasedAt: "2026-07-29",
    status: "ready",
    sourceCommit: commit,
    checksum,
    statistics: { citations: 0, questions: 0, platformsOrTerminals: 0, sources: 0, pages: 0 },
    artifacts: {
      "citation-research.sqlite": { included: true, readOnlyRuntime: true, bytes: sqliteBuffer.length, sha256: checksum }
    },
    capabilities: { evidenceTraceability: true },
    licenses: {
      code: { spdx: "MIT" },
      originalReportsAndContent: { spdx: "CC-BY-4.0", attributionRequired: true },
      thirdParty: { policy: "retain_original_licenses", licenseOverride: false }
    },
    limitations: [], allowedUse: ["offline research context"], prohibitedClaims: ["real-time monitoring"],
    attribution: { sourceName: "GEO Citation Lab", sourceRepo: OFFICIAL_REPO, datasetVersion: version, releasedAt: "2026-07-29" }
  };
}

async function noticeFiles(version, commit) {
  const values = {
    "LICENSE": Buffer.from("MIT repository license\n"),
    "LICENSE-CODE": Buffer.from("MIT code license\n"),
    "LICENSE-CONTENT": Buffer.from("CC BY 4.0 content license\n"),
    "THIRD_PARTY_NOTICES.md": Buffer.from("Third-party notices retained.\n")
  };
  const pins = {
    schemaVersion: 1, datasetVersion: version, sourceCommit: commit, sourceRepository: OFFICIAL_REPO,
    notices: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { sha256: digest(value), sizeBytes: value.length }]))
  };
  return { values, pinsBuffer: Buffer.from(`${JSON.stringify(pins, null, 2)}\n`) };
}

async function installCurrentPackage() {
  const root = path.join(packageRoot, "2.0.1");
  await mkdir(path.join(root, "derived"), { recursive: true });
  const databasePath = path.join(root, "derived", "citation-research.sqlite");
  createDatabase(databasePath, "2.0.1", CURRENT_COMMIT);
  const databaseBuffer = await readFile(databasePath);
  const notices = await noticeFiles("2.0.1", CURRENT_COMMIT);
  await mkdir(path.join(root, "upstream", "licenses"), { recursive: true });
  for (const [name, value] of Object.entries(notices.values)) await writeFile(path.join(root, "upstream", "licenses", name), value);
  await writeFile(path.join(root, "NOTICE-PINS.json"), notices.pinsBuffer);
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(baseManifest("2.0.1", CURRENT_COMMIT, databaseBuffer), null, 2)}\n`);
}

async function buildCandidateAssets() {
  await mkdir(assetsRoot, { recursive: true });
  const databasePath = path.join(assetsRoot, "citation-research-2.1.0.sqlite");
  createDatabase(databasePath, "2.1.0", CANDIDATE_COMMIT);
  const databaseBuffer = await readFile(databasePath);
  const notices = await noticeFiles("2.1.0", CANDIDATE_COMMIT);
  const files = new Map([
    ["derived/citation-research.sqlite", databaseBuffer],
    ["NOTICE-PINS.json", notices.pinsBuffer],
    ...Object.entries(notices.values).map(([name, value]) => [`upstream/licenses/${name}`, value])
  ]);
  const manifest = baseManifest("2.1.0", CANDIDATE_COMMIT, databaseBuffer);
  manifest.distribution = {
    format: "tongzhuo-citation-package-v1",
    files: [...files.entries()].map(([relativePath, value], index) => ({
      path: relativePath,
      url: `https://github.com/yaojingang/geo-citation-lab/releases/download/v2.1.0/asset-${index}`,
      bytes: value.length,
      sha256: digest(value)
    }))
  };
  const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestUrl = "https://github.com/yaojingang/geo-citation-lab/releases/download/v2.1.0/geo-citation-lab-package-manifest.json";
  const byUrl = new Map([[manifestUrl, Buffer.from(manifestRaw)]]);
  manifest.distribution.files.forEach((file) => byUrl.set(file.url, files.get(file.path)));
  return { manifest, manifestRaw, manifestUrl, byUrl };
}

function jsonResponse(value, status = 200) {
  const body = JSON.stringify(value);
  return new Response(body, { status, headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) } });
}

await installCurrentPackage();
const candidateAssets = await buildCandidateAssets();
let discoveryMode = "source-only";
const fakeFetch = async (url) => {
  const value = String(url);
  if (value.endsWith("/releases/latest")) return jsonResponse({
    id: 210, tag_name: "v2.1.0", name: "Citation data 2.1.0", published_at: "2026-07-29T00:00:00Z",
    html_url: "https://github.com/yaojingang/geo-citation-lab/releases/tag/v2.1.0", draft: false, prerelease: false,
    assets: discoveryMode === "installable" ? [{ name: "geo-citation-lab-package-manifest.json", browser_download_url: candidateAssets.manifestUrl }] : []
  });
  if (value.endsWith("/commits/HEAD")) return jsonResponse({ sha: CANDIDATE_COMMIT });
  if (candidateAssets.byUrl.has(value)) {
    const body = candidateAssets.byUrl.get(value);
    return new Response(body, { status: 200, headers: { "content-length": String(body.length) } });
  }
  return jsonResponse({ message: "not found" }, 404);
};

const store = new CitationPackageUpdateStore({ packageRoot, fetch: fakeFetch, clock: () => Date.parse("2026-07-29T12:00:00Z") });

try {
  let status = await store.status();
  assert.equal(status.current.version, "2.0.1");
  assert.equal(status.updatePolicy.automaticAction, "check_only");
  assert.equal(status.updatePolicy.overwritesExistingVersions, false);

  status = await store.checkForUpdates();
  assert.equal(status.lastCheck.updateDiscovered, true);
  assert.equal(status.candidate.installability.installable, false);
  assert.equal(status.candidate.installability.state, "source_update_only");
  await assert.rejects(
    store.stageCandidate({ candidateId: status.candidate.id, confirm: true }),
    (error) => error instanceof CitationPackageUpdateError && error.code === "CITATION_UPDATE_NOT_INSTALLABLE"
  );
  status = await store.discardCandidate({ candidateId: status.candidate.id, confirm: true });
  assert.equal(status.candidate, null);

  discoveryMode = "installable";
  status = await store.checkForUpdates();
  const candidateId = status.candidate.id;
  assert.equal(status.candidate.installability.installable, true);
  assert.equal(status.candidate.installability.state, "installable_package_declared");
  await assert.rejects(
    store.stageCandidate({ candidateId }),
    (error) => error.code === "CITATION_UPDATE_CONFIRMATION_REQUIRED"
  );

  status = await store.stageCandidate({ candidateId, confirm: true });
  assert.equal(status.candidate.lifecycle, "staged");
  await assert.rejects(
    store.checkForUpdates(),
    (error) => error.code === "CITATION_UPDATE_CANDIDATE_IN_PROGRESS"
  );
  status = await store.validateStagedCandidate({ candidateId });
  assert.equal(status.candidate.lifecycle, "validated");
  assert.equal(status.candidate.validation.state, "passed");
  status = await store.activateCandidate({ candidateId, expectedCurrentVersion: "2.0.1", confirm: true });
  assert.equal(status.current.version, "2.1.0");
  assert.equal(status.pointer.previousVersion, "2.0.1");
  assert.equal(status.activationHistory[0].action, "activate");
  assert.equal(resolveActiveCitationResearchPackage({ packageRoot }).active.version, "2.1.0");

  await assert.rejects(
    store.rollback({ expectedCurrentVersion: "2.0.1", confirm: true }),
    (error) => error.code === "CITATION_UPDATE_ACTIVE_VERSION_CONFLICT"
  );
  status = await store.rollback({ expectedCurrentVersion: "2.1.0", confirm: true });
  assert.equal(status.current.version, "2.0.1");
  assert.equal(status.activationHistory[0].action, "rollback");
  assert.equal(resolveActiveCitationResearchPackage({ packageRoot }).active.version, "2.0.1");

  const api = createCitationPackageUpdateApi({ store, requestJson: async (request) => request.body || {} });
  const response = { json(code, body) { return { code, body }; } };
  const apiResult = await api({ method: "GET", url: "/api/v1/citation-package-updates/status" }, response, ["api", "v1", "citation-package-updates", "status"]);
  assert.equal(apiResult.code, 200);
  assert.equal(apiResult.body.data.update.current.version, "2.0.1");

  const persisted = JSON.parse(await readFile(path.join(packageRoot, ".updates", "state.json"), "utf8"));
  assert.equal(persisted.format, "tongzhuo-citation-package-update-state-v1");
  assert.ok(persisted.revision >= 6);
  console.log("Citation package update check passed");
  console.log("- source-only discovery is not installable");
  console.log("- staged files, notices, SQLite provenance and counts are verified");
  console.log("- activation is non-overwriting and rollback keeps both versions");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
