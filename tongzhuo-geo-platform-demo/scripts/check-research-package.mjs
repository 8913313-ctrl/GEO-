import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "research-packages", "geo-citation-lab", "2.0.1", "manifest.json");
const researchDatabasePath = path.join(path.dirname(manifestPath), "derived", "citation-research.sqlite");
const errors = [];

async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function own(object, key) {
  return Boolean(object && typeof object === "object" && Object.hasOwn(object, key));
}

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactInteger(value, expected, pathLabel) {
  check(Number.isSafeInteger(value), `${pathLabel} must be a safe integer`);
  check(value === expected, `${pathLabel} must equal ${expected}`);
}

function requireFields(value, fields, pathLabel) {
  check(object(value), `${pathLabel} must be an object`);
  for (const field of fields) check(own(value, field), `${pathLabel}.${field} is required`);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Research package check failed: cannot read ${manifestPath}`);
  console.error(error.message);
  process.exitCode = 1;
}

if (manifest) {
  requireFields(manifest, [
    "manifestVersion", "packageId", "name", "repo", "datasetVersion", "releasedAt", "status",
    "sourceCommit", "checksum", "statistics", "artifacts", "capabilities", "licenses", "limitations",
    "allowedUse", "prohibitedClaims", "attribution"
  ], "manifest");

  check(manifest.manifestVersion === 1, "manifest.manifestVersion must equal 1");
  check(manifest.packageId === "geo-citation-lab", "manifest.packageId must equal geo-citation-lab");
  check(manifest.name === "GEO Citation Lab", "manifest.name must equal GEO Citation Lab");
  check(manifest.repo === "https://github.com/yaojingang/geo-citation-lab", "manifest.repo must use the authoritative upstream repository");
  check(manifest.datasetVersion === "2.0.1", "manifest.datasetVersion must equal 2.0.1");
  check(manifest.releasedAt === "2026-07-14", "manifest.releasedAt must equal 2026-07-14");
  check(manifest.status === "ready", "manifest.status must equal ready");
  check(manifest.sourceCommit === "81ba1566f70f114e9202b798f8d4525a9329ebd3", "manifest.sourceCommit must match the pinned upstream commit");
  check(manifest.checksum === "90c9bfe87c96ff250eb92a5d06e9b18a5aacdc6013b4b4bb7e45be46df886070", "manifest.checksum must match the derived SQLite artifact");

  requireFields(manifest.statistics, ["citations", "questions", "platformsOrTerminals", "sources", "pages"], "manifest.statistics");
  exactInteger(manifest.statistics?.citations, 214119, "manifest.statistics.citations");
  exactInteger(manifest.statistics?.questions, 620, "manifest.statistics.questions");
  exactInteger(manifest.statistics?.platformsOrTerminals, 12, "manifest.statistics.platformsOrTerminals");
  exactInteger(manifest.statistics?.sources, 9878, "manifest.statistics.sources");
  exactInteger(manifest.statistics?.pages, 107659, "manifest.statistics.pages");

  requireFields(manifest.artifacts, ["upstreamManifest", "cn_geo.duckdb", "citation_observations.parquet", "citation-research.sqlite", "responses.parquet"], "manifest.artifacts");
  check(manifest.artifacts?.["upstreamManifest"]?.sha256 === "8d6b27fabdb2b5b446ba097f66301e4e77d1d0633427ac4fd160655369a0de5b", "upstream manifest SHA-256 must match the pin");
  check(manifest.artifacts?.["cn_geo.duckdb"]?.sha256 === "ff76fb6fc049768df1760b0d0bfe91df075f7335779cfeddc7a792bd5ff52f6e", "DuckDB SHA-256 must match the immutable source commit");
  check(manifest.artifacts?.["citation_observations.parquet"]?.sha256 === "9e59d9e1fc625f4f343ee5d9e17b4a3a86e3d2a356fd300cf86634fab74078c7", "citation Parquet SHA-256 must match the pin");
  check(manifest.artifacts?.["citation-research.sqlite"]?.readOnlyRuntime === true, "derived SQLite must be declared read-only at runtime");
  try {
    const databaseInfo = await stat(researchDatabasePath);
    check(databaseInfo.isFile(), "derived SQLite must be a regular file");
    check(databaseInfo.size === manifest.artifacts?.["citation-research.sqlite"]?.bytes, "derived SQLite size must match the manifest");
    check(await sha256File(researchDatabasePath) === manifest.artifacts?.["citation-research.sqlite"]?.sha256, "derived SQLite SHA-256 must match the manifest");
  } catch (error) {
    check(false, `derived SQLite is unavailable: ${error.message}`);
  }
  const responses = manifest.artifacts?.["responses.parquet"];
  requireFields(responses, ["included", "declaredState", "rowCount"], "manifest.artifacts.responses.parquet");
  check(responses?.included === false, "responses.parquet must not be declared as included");
  check(responses?.declaredState === "empty", "responses.parquet must be declared empty");
  check(responses?.rowCount === 0, "responses.parquet rowCount must equal 0");

  requireFields(manifest.capabilities, [
    "completeResponses", "reliableResponseIds", "modelVersionTraceability",
    "normalizedCollectionTime", "realTimeCustomerMonitoring"
  ], "manifest.capabilities");
  for (const name of ["questionMatching", "citationObservationQuery", "platformSourceAndPageAggregation", "evidenceTraceability"]) {
    check(manifest.capabilities?.[name] === true, `manifest.capabilities.${name} must be enabled for the verified research database`);
  }
  for (const name of ["completeResponses", "reliableResponseIds", "modelVersionTraceability", "normalizedCollectionTime", "realTimeCustomerMonitoring"]) {
    check(manifest.capabilities?.[name] === false, `manifest.capabilities.${name} must remain disabled`);
  }

  requireFields(manifest.licenses, ["code", "originalReportsAndContent", "thirdParty"], "manifest.licenses");
  check(manifest.licenses?.code?.spdx === "MIT", "repository code license must be MIT");
  check(manifest.licenses?.code?.scope === "repository_code", "MIT scope must be repository_code");
  check(manifest.licenses?.originalReportsAndContent?.spdx === "CC-BY-4.0", "original reports and content license must be CC-BY-4.0");
  check(manifest.licenses?.originalReportsAndContent?.scope === "original_reports_and_content", "CC-BY-4.0 scope must cover original reports and content");
  check(manifest.licenses?.originalReportsAndContent?.attributionRequired === true, "CC-BY-4.0 attribution must be required");
  check(manifest.licenses?.thirdParty?.policy === "retain_original_licenses", "third-party material must retain original licenses");
  check(manifest.licenses?.thirdParty?.licenseOverride === false, "the package must not override third-party licenses");

  const requiredLimitations = new Set([
    "RESPONSES_PARQUET_EMPTY",
    "COMPLETE_RESPONSES_UNAVAILABLE",
    "RESPONSE_ID_UNRELIABLE",
    "MODEL_VERSION_UNAVAILABLE",
    "COLLECTION_TIME_NOT_NORMALIZED",
    "NOT_REAL_TIME_CUSTOMER_MONITORING"
  ]);
  check(Array.isArray(manifest.limitations), "manifest.limitations must be an array");
  const limitationCodes = new Set();
  for (const [index, limitation] of (manifest.limitations || []).entries()) {
    requireFields(limitation, ["code", "description"], `manifest.limitations[${index}]`);
    check(typeof limitation?.code === "string" && limitation.code.length > 0, `manifest.limitations[${index}].code must be non-empty`);
    check(typeof limitation?.description === "string" && limitation.description.length > 0, `manifest.limitations[${index}].description must be non-empty`);
    check(!limitationCodes.has(limitation?.code), `duplicate limitation code: ${limitation?.code}`);
    limitationCodes.add(limitation?.code);
  }
  for (const code of requiredLimitations) check(limitationCodes.has(code), `missing required limitation: ${code}`);

  check(Array.isArray(manifest.allowedUse) && manifest.allowedUse.length > 0, "manifest.allowedUse must be a non-empty array");
  check(Array.isArray(manifest.prohibitedClaims) && manifest.prohibitedClaims.length >= 4, "manifest.prohibitedClaims must enumerate prohibited product claims");
  check(manifest.attribution?.sourceName === "GEO Citation Lab", "attribution.sourceName must identify GEO Citation Lab");
  check(manifest.attribution?.sourceRepo === manifest.repo, "attribution.sourceRepo must match manifest.repo");
  check(manifest.attribution?.datasetVersion === manifest.datasetVersion, "attribution.datasetVersion must match manifest.datasetVersion");
  check(manifest.attribution?.releasedAt === manifest.releasedAt, "attribution.releasedAt must match manifest.releasedAt");

  if (errors.length) {
    console.error(`Research package check failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Research package check passed");
    console.log(`- package: ${manifest.packageId}@${manifest.datasetVersion}`);
    console.log(`- status: ${manifest.status}`);
    console.log(`- source: ${manifest.repo}`);
    console.log(`- provenance: ${manifest.sourceCommit}`);
    console.log(`- derived checksum: ${manifest.checksum}`);
  }
}
