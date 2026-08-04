import crypto from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import {
  mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ID = "geo-citation-lab";
const OFFICIAL_REPOSITORY = "https://github.com/yaojingang/geo-citation-lab";
const OFFICIAL_API_ROOT = "https://api.github.com/repos/yaojingang/geo-citation-lab";
const DEFAULT_PACKAGE_ROOT = path.join(moduleRoot, "research-packages", PACKAGE_ID);
const DEFAULT_VERSION = "2.0.1";
const STATE_FORMAT = "tongzhuo-citation-package-update-state-v1";
const DISTRIBUTION_FORMAT = "tongzhuo-citation-package-v1";
const MANIFEST_ASSET_NAMES = new Set([
  "geo-citation-lab-package-manifest.json",
  "tongzhuo-geo-citation-lab-package-manifest.json"
]);
const REQUIRED_TABLES = Object.freeze([
  "metadata", "source_artifacts", "table_inventory", "research_limitations",
  "questions", "question_labels", "ai_platforms", "sources", "pages", "citation_observations"
]);
const REQUIRED_NOTICE_PATHS = Object.freeze([
  "NOTICE-PINS.json",
  "upstream/licenses/LICENSE",
  "upstream/licenses/LICENSE-CODE",
  "upstream/licenses/LICENSE-CONTENT",
  "upstream/licenses/THIRD_PARTY_NOTICES.md"
]);
const SQLITE_PATH = "derived/citation-research.sqlite";

function nowIso(clock) { return new Date(clock()).toISOString(); }
function clone(value) { return value == null ? value : structuredClone(value); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function isSha256(value) { return /^[a-f0-9]{64}$/i.test(String(value || "")); }
function isCommit(value) { return /^[a-f0-9]{40}$/i.test(String(value || "")); }
function isVersion(value) { return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(String(value || "")); }
function cleanVersion(value) { return String(value || "").trim().replace(/^v(?=\d)/i, ""); }
function normalizeRelative(value) { return String(value || "").replaceAll("\\", "/").replace(/^\.\//, ""); }
function jsonValue(value) { try { return JSON.parse(String(value)); } catch { return value; } }
function safeMessage(error) { return String(error?.message || error || "Unknown update error").slice(0, 500); }
function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject(value[key])]));
}
function canonicalJson(value) { return `${JSON.stringify(sortedObject(value), null, 2)}\n`; }

function versionParts(value) {
  const match = cleanVersion(value).match(/^(\d+(?:\.\d+){1,3})(?:[-+](.*))?$/);
  if (!match) return null;
  return { numbers: match[1].split(".").map(Number), suffix: match[2] || "" };
}

export function compareCitationPackageVersions(left, right) {
  const a = versionParts(left); const b = versionParts(right);
  if (!a || !b) return String(left || "").localeCompare(String(right || ""));
  const length = Math.max(a.numbers.length, b.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a.numbers[index] || 0) - (b.numbers[index] || 0);
    if (difference) return difference;
  }
  if (!a.suffix && b.suffix) return 1;
  if (a.suffix && !b.suffix) return -1;
  return a.suffix.localeCompare(b.suffix);
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeJoin(root, relativePath) {
  const normalized = normalizeRelative(relativePath);
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new CitationPackageUpdateError("Package file path is invalid.", 422, "CITATION_UPDATE_PATH_INVALID", { path: relativePath });
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new CitationPackageUpdateError("Package file path contains an unsafe segment.", 422, "CITATION_UPDATE_PATH_INVALID", { path: relativePath });
  }
  const target = path.resolve(root, ...segments);
  if (!isInside(root, target)) throw new CitationPackageUpdateError("Package file escaped the staging root.", 422, "CITATION_UPDATE_PATH_INVALID", { path: relativePath });
  return target;
}

function officialDownloadUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { return false; }
  if (url.protocol !== "https:") return false;
  if (url.hostname === "github.com") return url.pathname.startsWith("/yaojingang/geo-citation-lab/releases/download/");
  return url.hostname === "api.github.com" && url.pathname.startsWith("/repos/yaojingang/geo-citation-lab/releases/assets/");
}

function initialState() {
  return {
    format: STATE_FORMAT,
    revision: 0,
    updatedAt: null,
    lastCheck: null,
    candidate: null,
    activations: []
  };
}

function validateRuntimeManifest(manifest, options = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) errors.push("manifest must be an object");
  if (manifest?.packageId !== PACKAGE_ID) errors.push(`packageId must equal ${PACKAGE_ID}`);
  if (manifest?.repo !== OFFICIAL_REPOSITORY) errors.push("repo must be the authoritative upstream repository");
  if (!isVersion(manifest?.datasetVersion)) errors.push("datasetVersion must be a numeric release version");
  if (!isCommit(manifest?.sourceCommit)) errors.push("sourceCommit must be a full 40-character commit SHA");
  if (manifest?.status !== "ready") errors.push("status must equal ready");
  if (!isSha256(manifest?.checksum)) errors.push("checksum must be SHA-256");
  const sqlite = manifest?.artifacts?.["citation-research.sqlite"];
  if (sqlite?.included !== true) errors.push("derived SQLite must be declared included");
  if (sqlite?.readOnlyRuntime !== true) errors.push("derived SQLite must be read-only at runtime");
  if (!Number.isSafeInteger(sqlite?.bytes) || sqlite.bytes < 1024) errors.push("derived SQLite byte size is invalid");
  if (!isSha256(sqlite?.sha256) || sqlite?.sha256 !== manifest?.checksum) errors.push("derived SQLite SHA-256 must match manifest.checksum");
  if (manifest?.licenses?.code?.spdx !== "MIT") errors.push("code license must remain MIT");
  if (manifest?.licenses?.originalReportsAndContent?.spdx !== "CC-BY-4.0") errors.push("report/content license must remain CC-BY-4.0");
  if (manifest?.licenses?.originalReportsAndContent?.attributionRequired !== true) errors.push("CC-BY attribution must remain required");
  if (manifest?.licenses?.thirdParty?.licenseOverride !== false) errors.push("third-party licenses must not be overridden");
  if (manifest?.attribution?.sourceRepo !== OFFICIAL_REPOSITORY) errors.push("attribution.sourceRepo must be authoritative");
  if (manifest?.attribution?.datasetVersion !== manifest?.datasetVersion) errors.push("attribution datasetVersion mismatch");
  if (options.requireDistribution) {
    const distribution = manifest?.distribution;
    if (distribution?.format !== DISTRIBUTION_FORMAT) errors.push(`distribution.format must equal ${DISTRIBUTION_FORMAT}`);
    if (!Array.isArray(distribution?.files)) errors.push("distribution.files must be an array");
    const files = Array.isArray(distribution?.files) ? distribution.files : [];
    const seen = new Set();
    for (const [index, file] of files.entries()) {
      const relative = normalizeRelative(file?.path);
      if (!relative || relative.startsWith("/") || relative.split("/").some((segment) => !segment || segment === "." || segment === "..")) errors.push(`distribution.files[${index}].path is unsafe`);
      if (seen.has(relative)) errors.push(`duplicate distribution path: ${relative}`);
      seen.add(relative);
      if (["manifest.json", "UPDATE-RECEIPT.json"].includes(relative) || relative.startsWith(".updates/")) errors.push(`distribution.files[${index}].path is reserved`);
      if (!officialDownloadUrl(file?.url)) errors.push(`distribution.files[${index}].url is not an official release asset`);
      if (!Number.isSafeInteger(file?.bytes) || file.bytes < 1) errors.push(`distribution.files[${index}].bytes is invalid`);
      if (!isSha256(file?.sha256)) errors.push(`distribution.files[${index}].sha256 is invalid`);
    }
    for (const required of [SQLITE_PATH, ...REQUIRED_NOTICE_PATHS]) if (!seen.has(required)) errors.push(`required distribution file is missing: ${required}`);
    const sqliteFile = files.find((file) => normalizeRelative(file?.path) === SQLITE_PATH);
    if (sqliteFile && sqlite) {
      if (sqliteFile.sha256 !== sqlite.sha256) errors.push("distribution SQLite checksum does not match artifacts metadata");
      if (sqliteFile.bytes !== sqlite.bytes) errors.push("distribution SQLite byte size does not match artifacts metadata");
    }
  }
  return { valid: errors.length === 0, errors };
}

export class CitationPackageUpdateError extends Error {
  constructor(message, status = 422, code = "CITATION_PACKAGE_UPDATE_ERROR", details = {}) {
    super(message);
    this.name = "CitationPackageUpdateError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function fileSha256(filePath) {
  const handle = await open(filePath, "r");
  const hash = crypto.createHash("sha256");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
    return hash.digest("hex");
  } finally { await handle.close().catch(() => {}); }
}

function installedManifestRecord(packageRoot, version, manifest) {
  const packagePath = path.join(packageRoot, version);
  const databasePath = path.join(packagePath, ...SQLITE_PATH.split("/"));
  let bytes = null; let installed = false;
  try { const info = statSync(databasePath); installed = info.isFile(); bytes = info.size; } catch {}
  return {
    version,
    packagePath,
    databasePath,
    installed,
    bytes,
    sourceCommit: String(manifest?.sourceCommit || ""),
    releasedAt: String(manifest?.releasedAt || ""),
    manifestStatus: String(manifest?.status || "unknown"),
    declaredChecksum: String(manifest?.checksum || "")
  };
}

export function resolveActiveCitationResearchPackage(options = {}) {
  const packageRoot = path.resolve(options.packageRoot || process.env.TZ_CITATION_PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
  const pointerPath = path.join(packageRoot, ".updates", "active.json");
  let requestedVersion = String(options.version || "").trim();
  if (!requestedVersion && existsSync(pointerPath)) {
    try { requestedVersion = String(JSON.parse(readFileSync(pointerPath, "utf8"))?.activeVersion || ""); } catch {}
  }
  const versions = [];
  try {
    for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isVersion(entry.name)) continue;
      const manifestPath = path.join(packageRoot, entry.name, "manifest.json");
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (validateRuntimeManifest(manifest).valid) versions.push(installedManifestRecord(packageRoot, entry.name, manifest));
      } catch {}
    }
  } catch {}
  const installed = versions.filter((item) => item.installed).sort((a, b) => compareCitationPackageVersions(b.version, a.version));
  const selected = installed.find((item) => item.version === requestedVersion)
    || installed.find((item) => item.version === DEFAULT_VERSION)
    || installed[0]
    || null;
  return { packageRoot, pointerPath, active: selected, installed };
}

export class CitationPackageUpdateStore {
  constructor(options = {}) {
    this.packageRoot = path.resolve(options.packageRoot || process.env.TZ_CITATION_PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
    this.controlRoot = path.resolve(options.controlRoot || path.join(this.packageRoot, ".updates"));
    this.stagingRoot = path.join(this.controlRoot, "staging");
    this.statePath = path.resolve(options.statePath || path.join(this.controlRoot, "state.json"));
    this.pointerPath = path.resolve(options.pointerPath || path.join(this.controlRoot, "active.json"));
    if (!isInside(this.packageRoot, this.controlRoot) || !isInside(this.controlRoot, this.statePath) || !isInside(this.controlRoot, this.pointerPath)) {
      throw new CitationPackageUpdateError("Update control paths must remain inside the package root.", 500, "CITATION_UPDATE_CONTROL_PATH_INVALID");
    }
    this.fetch = options.fetch || globalThis.fetch;
    if (typeof this.fetch !== "function") throw new TypeError("CitationPackageUpdateStore requires fetch.");
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.githubToken = String(options.githubToken || process.env.TZ_CITATION_UPDATE_GITHUB_TOKEN || "").trim();
    this.maxManifestBytes = Math.max(10_000, Number(options.maxManifestBytes) || 1_000_000);
    this.maxArtifactBytes = Math.max(1_000_000, Number(options.maxArtifactBytes) || 2_000_000_000);
    this.maxPackageBytes = Math.max(this.maxArtifactBytes, Number(options.maxPackageBytes) || 2_500_000_000);
    this.metadataTimeoutMs = Math.max(1_000, Number(options.metadataTimeoutMs) || 20_000);
    this.artifactTimeoutMs = Math.max(60_000, Number(options.artifactTimeoutMs) || 30 * 60 * 1000);
    this.checkIntervalMs = Math.max(3_600_000, Number(options.checkIntervalMs) || 24 * 60 * 60 * 1000);
    this.busy = false;
  }

  async readState() {
    try {
      const state = JSON.parse(await readFile(this.statePath, "utf8"));
      if (state?.format !== STATE_FORMAT || !Number.isSafeInteger(state?.revision)) throw new Error("state format is invalid");
      return state;
    } catch (error) {
      if (error?.code === "ENOENT") return initialState();
      throw new CitationPackageUpdateError("Citation package update state cannot be read safely.", 500, "CITATION_UPDATE_STATE_INVALID", { cause: safeMessage(error) });
    }
  }

  async writeState(value) {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state = { ...clone(value), format: STATE_FORMAT, revision: Number(value?.revision || 0) + 1, updatedAt: nowIso(this.clock) };
    const temporary = path.join(path.dirname(this.statePath), `.state-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, canonicalJson(state), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.statePath);
    return state;
  }

  async operation(callback) {
    if (this.busy) throw new CitationPackageUpdateError("Another Citation Lab update operation is in progress.", 409, "CITATION_UPDATE_BUSY");
    this.busy = true;
    try { return await callback(); } finally { this.busy = false; }
  }

  async installedPackages() {
    const items = [];
    let entries = [];
    try { entries = await readdir(this.packageRoot, { withFileTypes: true }); } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !isVersion(entry.name)) continue;
      try {
        const manifest = JSON.parse(await readFile(path.join(this.packageRoot, entry.name, "manifest.json"), "utf8"));
        const validation = validateRuntimeManifest(manifest);
        const record = installedManifestRecord(this.packageRoot, entry.name, manifest);
        items.push({ ...record, validManifest: validation.valid, manifestErrors: validation.errors });
      } catch (error) {
        items.push({ version: entry.name, packagePath: path.join(this.packageRoot, entry.name), installed: false, validManifest: false, manifestErrors: [safeMessage(error)] });
      }
    }
    return items.sort((a, b) => compareCitationPackageVersions(b.version, a.version));
  }

  async activePointer() {
    try {
      const pointer = JSON.parse(await readFile(this.pointerPath, "utf8"));
      if (pointer?.schemaVersion !== 1 || pointer?.packageId !== PACKAGE_ID || !isVersion(pointer?.activeVersion)) throw new Error("pointer format is invalid");
      return pointer;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw new CitationPackageUpdateError("Active Citation Lab package pointer is invalid.", 500, "CITATION_UPDATE_POINTER_INVALID", { cause: safeMessage(error) });
    }
  }

  async status() {
    const [state, installed, pointer] = await Promise.all([this.readState(), this.installedPackages(), this.activePointer()]);
    const usable = installed.filter((item) => item.installed && item.validManifest);
    const current = usable.find((item) => item.version === pointer?.activeVersion)
      || usable.find((item) => item.version === DEFAULT_VERSION)
      || usable[0]
      || null;
    const lastCheckAt = state.lastCheck?.checkedAt ? Date.parse(state.lastCheck.checkedAt) : NaN;
    const checkDue = !Number.isFinite(lastCheckAt) || this.clock() - lastCheckAt >= this.checkIntervalMs;
    return {
      packageId: PACKAGE_ID,
      officialRepository: OFFICIAL_REPOSITORY,
      updatePolicy: {
        automaticAction: "check_only",
        checkDue,
        checkIntervalHours: Math.round(this.checkIntervalMs / 3_600_000),
        activationRequiresExplicitConfirmation: true,
        activationRequiresRuntimeRestart: true,
        overwritesExistingVersions: false
      },
      current,
      installed,
      pointer,
      lastCheck: clone(state.lastCheck),
      candidate: clone(state.candidate),
      activationHistory: clone(state.activations || []).slice(-20).reverse(),
      revision: state.revision
    };
  }

  githubHeaders(accept = "application/vnd.github+json") {
    const headers = { Accept: accept, "User-Agent": "tongzhuo-geo-private-deployment" };
    if (this.githubToken) headers.Authorization = `Bearer ${this.githubToken}`;
    return headers;
  }

  async fetchJson(url, options = {}) {
    let response;
    try { response = await this.fetch(url, { headers: this.githubHeaders(), signal: options.signal || AbortSignal.timeout(this.metadataTimeoutMs) }); }
    catch (error) { throw new CitationPackageUpdateError("GitHub update metadata is unavailable.", 502, "CITATION_UPDATE_UPSTREAM_UNAVAILABLE", { cause: safeMessage(error) }); }
    if (options.allow404 && response.status === 404) return null;
    if (!response.ok) throw new CitationPackageUpdateError(`GitHub returned HTTP ${response.status}.`, 502, "CITATION_UPDATE_UPSTREAM_HTTP_ERROR", { status: response.status });
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared > this.maxManifestBytes) throw new CitationPackageUpdateError("Remote manifest exceeds the safe size limit.", 422, "CITATION_UPDATE_MANIFEST_TOO_LARGE");
    const text = await response.text();
    if (Buffer.byteLength(text) > this.maxManifestBytes) throw new CitationPackageUpdateError("Remote manifest exceeds the safe size limit.", 422, "CITATION_UPDATE_MANIFEST_TOO_LARGE");
    try { return { value: JSON.parse(text), raw: text, sha256: sha256(text) }; }
    catch { throw new CitationPackageUpdateError("Remote response is not valid JSON.", 502, "CITATION_UPDATE_UPSTREAM_JSON_INVALID"); }
  }

  async checkForUpdates() {
    return this.operation(async () => {
      const checkedAt = nowIso(this.clock);
      const currentStatus = await this.status();
      if (["staged", "validated"].includes(currentStatus.candidate?.lifecycle)) {
        throw new CitationPackageUpdateError("Finish or discard the staged candidate before checking for another update.", 409, "CITATION_UPDATE_CANDIDATE_IN_PROGRESS", { candidateId: currentStatus.candidate.id, lifecycle: currentStatus.candidate.lifecycle });
      }
      let release = null; let commit = null; const errors = [];
      try { release = (await this.fetchJson(`${OFFICIAL_API_ROOT}/releases/latest`, { allow404: true }))?.value || null; }
      catch (error) { errors.push({ source: "latest_release", code: error.code || "UPSTREAM_ERROR", message: safeMessage(error) }); }
      try { commit = (await this.fetchJson(`${OFFICIAL_API_ROOT}/commits/HEAD`))?.value || null; }
      catch (error) { errors.push({ source: "head_commit", code: error.code || "UPSTREAM_ERROR", message: safeMessage(error) }); }

      const latestCommit = isCommit(commit?.sha) ? String(commit.sha).toLowerCase() : "";
      const releaseVersion = isVersion(cleanVersion(release?.tag_name)) ? cleanVersion(release.tag_name) : "";
      const currentVersion = currentStatus.current?.version || "";
      const currentCommit = currentStatus.current?.sourceCommit || "";
      const newerVersion = Boolean(releaseVersion && (!currentVersion || compareCitationPackageVersions(releaseVersion, currentVersion) > 0));
      const newerCommit = Boolean(latestCommit && latestCommit !== currentCommit.toLowerCase());
      const updateDiscovered = newerVersion || newerCommit;
      const releaseSummary = release ? {
        id: String(release.id || ""),
        tag: String(release.tag_name || ""),
        version: releaseVersion || null,
        name: String(release.name || ""),
        publishedAt: release.published_at || null,
        htmlUrl: String(release.html_url || ""),
        draft: release.draft === true,
        prerelease: release.prerelease === true
      } : null;

      let packageManifest = null; let manifestObservation = null;
      const manifestAsset = Array.isArray(release?.assets)
        ? release.assets.find((asset) => MANIFEST_ASSET_NAMES.has(String(asset?.name || "")))
        : null;
      if (updateDiscovered && manifestAsset) {
        const url = String(manifestAsset.browser_download_url || "");
        if (!officialDownloadUrl(url)) {
          manifestObservation = { state: "rejected", reasonCode: "MANIFEST_URL_NOT_OFFICIAL", assetName: manifestAsset.name || "" };
        } else {
          try {
            const fetched = await this.fetchJson(url);
            const validation = validateRuntimeManifest(fetched.value, { requireDistribution: true });
            if (release?.draft === true || release?.prerelease === true) validation.errors.push("draft or prerelease packages are not eligible for production activation");
            if (validation.valid && releaseVersion && fetched.value.datasetVersion !== releaseVersion) validation.errors.push("package datasetVersion does not match the release tag");
            if (validation.valid && currentVersion && compareCitationPackageVersions(fetched.value.datasetVersion, currentVersion) <= 0) validation.errors.push("package datasetVersion is not newer than the active version");
            validation.valid = validation.errors.length === 0;
            packageManifest = validation.valid ? fetched.value : null;
            manifestObservation = {
              state: validation.valid ? "eligible" : "rejected",
              reasonCode: validation.valid ? "VERIFIED_PACKAGE_MANIFEST_DISCOVERED" : "PACKAGE_MANIFEST_INVALID",
              assetName: String(manifestAsset.name || ""), url, sha256: fetched.sha256,
              errors: validation.errors
            };
          } catch (error) {
            manifestObservation = { state: "rejected", reasonCode: error.code || "PACKAGE_MANIFEST_FETCH_FAILED", assetName: String(manifestAsset.name || ""), url, errors: [safeMessage(error)] };
          }
        }
      }

      let candidate = null;
      if (updateDiscovered) {
        const candidateVersion = packageManifest?.datasetVersion || releaseVersion || null;
        const eligible = Boolean(packageManifest && manifestObservation?.state === "eligible");
        candidate = {
          id: sha256([latestCommit, release?.id || "", candidateVersion || "source-only", manifestObservation?.sha256 || ""].join("\u001f")).slice(0, 24),
          lifecycle: "discovered",
          discoveredAt: checkedAt,
          sourceCommit: packageManifest?.sourceCommit || latestCommit || null,
          datasetVersion: candidateVersion,
          release: releaseSummary,
          discovery: { newerVersion, newerCommit },
          installability: {
            installable: eligible,
            state: eligible ? "installable_package_declared" : "source_update_only",
            reasonCode: eligible ? "VERIFIED_PACKAGE_MANIFEST_DISCOVERED" : manifestObservation?.reasonCode || "NO_INSTALLABLE_DATA_PACKAGE",
            explanation: eligible
              ? "An official release declares every required package file with byte size and SHA-256. Manual staging and validation are still required."
              : "A repository or release change was discovered, but no complete, verifiable Citation Lab data package was published. Nothing can be installed automatically."
          },
          manifest: manifestObservation,
          packageManifest: packageManifest ? clone(packageManifest) : null,
          stagedRelativePath: null,
          validation: null
        };
      }

      const state = await this.readState();
      state.lastCheck = {
        checkedAt,
        state: errors.length && !release && !commit ? "unavailable" : "completed",
        upstreamReachable: Boolean(release || commit),
        updateDiscovered,
        currentVersion: currentVersion || null,
        currentCommit: currentCommit || null,
        latestCommit: latestCommit || null,
        release: releaseSummary,
        errors
      };
      state.candidate = candidate;
      await this.writeState(state);
      return this.status();
    });
  }

  candidateFromState(state, candidateId) {
    const candidate = state?.candidate;
    if (!candidate || candidate.id !== String(candidateId || "")) throw new CitationPackageUpdateError("Update candidate no longer matches the latest checked candidate.", 409, "CITATION_UPDATE_CANDIDATE_STALE");
    return candidate;
  }

  async downloadFile(url, targetPath, expected) {
    if (!officialDownloadUrl(url)) throw new CitationPackageUpdateError("Artifact URL is not an official release asset.", 422, "CITATION_UPDATE_ARTIFACT_URL_REJECTED");
    let response;
    try { response = await this.fetch(url, { headers: this.githubHeaders("application/octet-stream"), signal: AbortSignal.timeout(this.artifactTimeoutMs) }); }
    catch (error) { throw new CitationPackageUpdateError("Artifact download could not be started.", 502, "CITATION_UPDATE_ARTIFACT_DOWNLOAD_FAILED", { cause: safeMessage(error) }); }
    if (!response.ok) throw new CitationPackageUpdateError(`Artifact download returned HTTP ${response.status}.`, 502, "CITATION_UPDATE_ARTIFACT_DOWNLOAD_FAILED", { status: response.status });
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared && declared !== expected.bytes) throw new CitationPackageUpdateError("Artifact Content-Length does not match the signed manifest.", 422, "CITATION_UPDATE_ARTIFACT_SIZE_MISMATCH", { expected: expected.bytes, actual: declared });
    if (declared > this.maxArtifactBytes || expected.bytes > this.maxArtifactBytes) throw new CitationPackageUpdateError("Artifact exceeds the configured safe size limit.", 422, "CITATION_UPDATE_ARTIFACT_TOO_LARGE");
    await mkdir(path.dirname(targetPath), { recursive: true });
    const temporary = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${crypto.randomUUID()}.part`);
    const handle = await open(temporary, "wx", 0o600);
    const hash = crypto.createHash("sha256"); let bytes = 0;
    try {
      if (!response.body) throw new CitationPackageUpdateError("Artifact response has no body.", 502, "CITATION_UPDATE_ARTIFACT_EMPTY");
      for await (const raw of response.body) {
        const chunk = Buffer.from(raw);
        bytes += chunk.length;
        if (bytes > expected.bytes || bytes > this.maxArtifactBytes) throw new CitationPackageUpdateError("Artifact exceeded its declared size while downloading.", 422, "CITATION_UPDATE_ARTIFACT_SIZE_MISMATCH");
        hash.update(chunk);
        await handle.write(chunk);
      }
      await handle.sync();
    } finally { await handle.close().catch(() => {}); }
    const digest = hash.digest("hex");
    if (bytes !== expected.bytes || digest !== String(expected.sha256).toLowerCase()) {
      await rm(temporary, { force: true }).catch(() => {});
      throw new CitationPackageUpdateError("Artifact checksum or byte size does not match the package manifest.", 422, "CITATION_UPDATE_ARTIFACT_INTEGRITY_FAILED", { expectedBytes: expected.bytes, actualBytes: bytes, expectedSha256: expected.sha256, actualSha256: digest });
    }
    await rename(temporary, targetPath);
    return { bytes, sha256: digest };
  }

  async stageCandidate({ candidateId, confirm = false } = {}) {
    if (confirm !== true) throw new CitationPackageUpdateError("Explicit staging confirmation is required.", 422, "CITATION_UPDATE_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (!candidate.installability?.installable || !candidate.packageManifest) throw new CitationPackageUpdateError("The discovered change has no complete installable data package.", 409, "CITATION_UPDATE_NOT_INSTALLABLE", { reasonCode: candidate.installability?.reasonCode });
      if (candidate.lifecycle !== "discovered") throw new CitationPackageUpdateError("Candidate is not in the discovered state.", 409, "CITATION_UPDATE_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const manifestUrl = candidate.manifest?.url;
      const fetched = await this.fetchJson(manifestUrl);
      if (fetched.sha256 !== candidate.manifest.sha256) throw new CitationPackageUpdateError("Remote package manifest changed after discovery. Run update check again.", 409, "CITATION_UPDATE_MANIFEST_CHANGED");
      const validation = validateRuntimeManifest(fetched.value, { requireDistribution: true });
      if (!validation.valid) throw new CitationPackageUpdateError("Remote package manifest failed validation during staging.", 422, "CITATION_UPDATE_MANIFEST_INVALID", { errors: validation.errors });
      const totalBytes = fetched.value.distribution.files.reduce((total, file) => total + Number(file.bytes || 0), 0);
      if (!Number.isSafeInteger(totalBytes) || totalBytes > this.maxPackageBytes) throw new CitationPackageUpdateError("Candidate package exceeds the configured aggregate size limit.", 422, "CITATION_UPDATE_PACKAGE_TOO_LARGE", { totalBytes, maximumBytes: this.maxPackageBytes });
      await mkdir(this.stagingRoot, { recursive: true });
      const stagePath = await mkdtemp(path.join(this.stagingRoot, `${candidate.id}-`));
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationPackageUpdateError("Generated staging path is unsafe.", 500, "CITATION_UPDATE_STAGING_PATH_INVALID");
      const receipts = [];
      try {
        for (const file of fetched.value.distribution.files) {
          const relativePath = normalizeRelative(file.path);
          const targetPath = safeJoin(stagePath, relativePath);
          const receipt = await this.downloadFile(file.url, targetPath, file);
          receipts.push({ path: relativePath, ...receipt });
        }
        await writeFile(path.join(stagePath, "manifest.json"), fetched.raw, { encoding: "utf8", mode: 0o600, flag: "wx" });
        await writeFile(path.join(stagePath, "UPDATE-RECEIPT.json"), canonicalJson({
          schemaVersion: 1, candidateId: candidate.id, stagedAt: nowIso(this.clock),
          officialRepository: OFFICIAL_REPOSITORY, manifestUrl, manifestSha256: fetched.sha256, files: receipts
        }), { encoding: "utf8", mode: 0o600, flag: "wx" });
      } catch (error) {
        await rm(stagePath, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
      candidate.lifecycle = "staged";
      candidate.stagedAt = nowIso(this.clock);
      candidate.stagedRelativePath = normalizeRelative(path.relative(this.packageRoot, stagePath));
      candidate.validation = null;
      await this.writeState(state);
      return this.status();
    });
  }

  async validatePackageDirectory(packagePath, manifest, options = {}) {
    const requireDistribution = options.requireDistribution !== false;
    const validation = validateRuntimeManifest(manifest, { requireDistribution });
    if (!validation.valid) throw new CitationPackageUpdateError("Staged package manifest is invalid.", 422, "CITATION_UPDATE_MANIFEST_INVALID", { errors: validation.errors });
    const fileResults = [];
    const declaredFiles = requireDistribution ? manifest.distribution.files : [{
      path: SQLITE_PATH,
      bytes: manifest.artifacts["citation-research.sqlite"].bytes,
      sha256: manifest.artifacts["citation-research.sqlite"].sha256
    }];
    for (const declared of declaredFiles) {
      const relativePath = normalizeRelative(declared.path);
      const filePath = safeJoin(packagePath, relativePath);
      const info = await stat(filePath).catch(() => null);
      if (!info?.isFile()) throw new CitationPackageUpdateError("A required staged package file is missing.", 422, "CITATION_UPDATE_STAGED_FILE_MISSING", { path: relativePath });
      if (info.size !== declared.bytes) throw new CitationPackageUpdateError("Staged file size does not match the manifest.", 422, "CITATION_UPDATE_STAGED_FILE_SIZE_MISMATCH", { path: relativePath, expected: declared.bytes, actual: info.size });
      const digest = await fileSha256(filePath);
      if (digest !== String(declared.sha256).toLowerCase()) throw new CitationPackageUpdateError("Staged file checksum does not match the manifest.", 422, "CITATION_UPDATE_STAGED_FILE_CHECKSUM_MISMATCH", { path: relativePath });
      fileResults.push({ path: relativePath, bytes: info.size, sha256: digest });
    }

    if (!requireDistribution) {
      for (const relativePath of REQUIRED_NOTICE_PATHS) {
        const filePath = safeJoin(packagePath, relativePath);
        const info = await stat(filePath).catch(() => null);
        if (!info?.isFile()) throw new CitationPackageUpdateError("A required installed notice file is missing.", 422, "CITATION_UPDATE_STAGED_FILE_MISSING", { path: relativePath });
        fileResults.push({ path: relativePath, bytes: info.size, sha256: await fileSha256(filePath) });
      }
    }

    const pinsPath = path.join(packagePath, "NOTICE-PINS.json");
    const pins = JSON.parse(await readFile(pinsPath, "utf8"));
    if (pins?.datasetVersion !== manifest.datasetVersion || pins?.sourceCommit !== manifest.sourceCommit || pins?.sourceRepository !== OFFICIAL_REPOSITORY) {
      throw new CitationPackageUpdateError("Notice pins do not match package provenance.", 422, "CITATION_UPDATE_NOTICE_PINS_MISMATCH");
    }
    for (const licensePath of REQUIRED_NOTICE_PATHS.slice(1)) {
      const expected = pins?.notices?.[path.basename(licensePath)];
      const file = fileResults.find((item) => item.path === licensePath);
      if (!expected || expected.sha256 !== file?.sha256 || expected.sizeBytes !== file?.bytes) throw new CitationPackageUpdateError("License notice pins do not match downloaded notices.", 422, "CITATION_UPDATE_NOTICE_INTEGRITY_FAILED", { path: licensePath });
    }

    const databasePath = path.join(packagePath, ...SQLITE_PATH.split("/"));
    let database;
    try {
      database = new DatabaseSync(databasePath, { readOnly: true });
      database.exec("PRAGMA query_only = ON");
      database.exec("PRAGMA trusted_schema = OFF");
      const quickCheck = database.prepare("PRAGMA quick_check(1)").get()?.quick_check;
      if (quickCheck !== "ok") throw new CitationPackageUpdateError("SQLite quick_check failed.", 422, "CITATION_UPDATE_DATABASE_INTEGRITY_FAILED", { quickCheck });
      const tables = new Set(database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => String(row.name)));
      const missingTables = REQUIRED_TABLES.filter((name) => !tables.has(name));
      if (missingTables.length) throw new CitationPackageUpdateError("Citation database schema is incomplete.", 422, "CITATION_UPDATE_DATABASE_SCHEMA_INVALID", { missingTables });
      const metadata = Object.fromEntries(database.prepare("SELECT key, value FROM metadata").all().map((row) => [String(row.key), jsonValue(row.value)]));
      if (String(metadata.package_id || "") !== PACKAGE_ID || String(metadata.dataset_version || "") !== manifest.datasetVersion || String(metadata.source_commit || "") !== manifest.sourceCommit || String(metadata.source_repository || "") !== OFFICIAL_REPOSITORY) {
        throw new CitationPackageUpdateError("Citation database provenance does not match the package manifest.", 422, "CITATION_UPDATE_DATABASE_PROVENANCE_MISMATCH", { metadata });
      }
      const count = (table) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count || 0);
      const counts = { citations: count("citation_observations"), questions: count("questions"), platformsOrTerminals: count("ai_platforms"), sources: count("sources"), pages: count("pages") };
      for (const [key, actual] of Object.entries(counts)) {
        if (!Number.isSafeInteger(manifest.statistics?.[key]) || manifest.statistics[key] !== actual) throw new CitationPackageUpdateError("Citation database row counts do not match the package manifest.", 422, "CITATION_UPDATE_DATABASE_COUNT_MISMATCH", { key, expected: manifest.statistics?.[key], actual });
      }
      return { databasePath, quickCheck, schemaTables: [...tables].sort(), counts, files: fileResults };
    } finally { database?.close(); }
  }

  async validateStagedCandidate({ candidateId } = {}) {
    return this.operation(async () => {
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle !== "staged") throw new CitationPackageUpdateError("Candidate must be staged before validation.", 409, "CITATION_UPDATE_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationPackageUpdateError("Recorded staging path is outside the staging root.", 500, "CITATION_UPDATE_STAGING_PATH_INVALID");
      const manifestRaw = await readFile(path.join(stagePath, "manifest.json"), "utf8");
      if (sha256(manifestRaw) !== candidate.manifest.sha256) throw new CitationPackageUpdateError("Staged manifest does not match the discovered manifest.", 422, "CITATION_UPDATE_MANIFEST_INTEGRITY_FAILED");
      const manifest = JSON.parse(manifestRaw);
      const result = await this.validatePackageDirectory(stagePath, manifest);
      candidate.lifecycle = "validated";
      candidate.validatedAt = nowIso(this.clock);
      candidate.validation = { state: "passed", ...result, databasePath: normalizeRelative(path.relative(this.packageRoot, result.databasePath)) };
      await this.writeState(state);
      return this.status();
    });
  }

  async discardCandidate({ candidateId, confirm = false } = {}) {
    if (confirm !== true) throw new CitationPackageUpdateError("Explicit discard confirmation is required.", 422, "CITATION_UPDATE_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle === "activated") throw new CitationPackageUpdateError("An activated version cannot be discarded; use rollback to change the active version.", 409, "CITATION_UPDATE_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      if (candidate.stagedRelativePath) {
        const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
        if (!isInside(this.stagingRoot, stagePath) || stagePath === this.stagingRoot) throw new CitationPackageUpdateError("Recorded staging path is unsafe.", 500, "CITATION_UPDATE_STAGING_PATH_INVALID");
        await rm(stagePath, { recursive: true, force: true });
      }
      state.candidate = null;
      await this.writeState(state);
      return this.status();
    });
  }

  async writePointer(pointer) {
    await mkdir(path.dirname(this.pointerPath), { recursive: true });
    const temporary = path.join(path.dirname(this.pointerPath), `.active-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, canonicalJson(pointer), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.pointerPath);
  }

  async activateCandidate({ candidateId, expectedCurrentVersion, confirm = false } = {}) {
    if (confirm !== true) throw new CitationPackageUpdateError("Explicit activation confirmation is required.", 422, "CITATION_UPDATE_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      const current = await this.status();
      if (String(expectedCurrentVersion || "") !== String(current.current?.version || "")) throw new CitationPackageUpdateError("Active package changed since the operator loaded update status.", 409, "CITATION_UPDATE_ACTIVE_VERSION_CONFLICT", { expected: expectedCurrentVersion || null, actual: current.current?.version || null });
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle !== "validated" || candidate.validation?.state !== "passed") throw new CitationPackageUpdateError("Only a validated candidate can be activated.", 409, "CITATION_UPDATE_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationPackageUpdateError("Recorded staging path is unsafe.", 500, "CITATION_UPDATE_STAGING_PATH_INVALID");
      const version = String(candidate.packageManifest.datasetVersion);
      const target = path.join(this.packageRoot, version);
      if (!isInside(this.packageRoot, target) || target === this.controlRoot) throw new CitationPackageUpdateError("Activation target is unsafe.", 500, "CITATION_UPDATE_TARGET_INVALID");
      if (existsSync(target)) throw new CitationPackageUpdateError("The target version already exists; existing packages are never overwritten.", 409, "CITATION_UPDATE_TARGET_EXISTS", { version });
      await rename(stagePath, target);
      const activatedAt = nowIso(this.clock);
      const pointer = {
        schemaVersion: 1, packageId: PACKAGE_ID, activeVersion: version,
        previousVersion: current.current?.version || null, activatedAt,
        databaseRelativePath: `${version}/${SQLITE_PATH}`,
        manifestSha256: candidate.manifest.sha256,
        sourceCommit: candidate.packageManifest.sourceCommit
      };
      try {
        await this.writePointer(pointer);
      } catch (error) {
        await rename(target, stagePath).catch(() => {});
        throw new CitationPackageUpdateError("Activation pointer could not be committed; the previous version remains selected.", 500, "CITATION_UPDATE_ACTIVATION_COMMIT_FAILED", { cause: safeMessage(error) });
      }
      state.activations = [...(state.activations || []), {
        id: crypto.randomUUID(), action: "activate", at: activatedAt,
        fromVersion: current.current?.version || null, toVersion: version,
        candidateId: candidate.id, manifestSha256: candidate.manifest.sha256
      }].slice(-100);
      candidate.lifecycle = "activated";
      candidate.activatedAt = activatedAt;
      candidate.stagedRelativePath = null;
      candidate.validation.databasePath = `${version}/${SQLITE_PATH}`;
      await this.writeState(state);
      return this.status();
    });
  }

  async rollback({ targetVersion = "", expectedCurrentVersion, confirm = false } = {}) {
    if (confirm !== true) throw new CitationPackageUpdateError("Explicit rollback confirmation is required.", 422, "CITATION_UPDATE_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      const current = await this.status(); const activeVersion = current.current?.version || "";
      if (String(expectedCurrentVersion || "") !== activeVersion) throw new CitationPackageUpdateError("Active package changed since the operator loaded update status.", 409, "CITATION_UPDATE_ACTIVE_VERSION_CONFLICT", { expected: expectedCurrentVersion || null, actual: activeVersion || null });
      const state = await this.readState();
      const latestActivation = [...(state.activations || [])].reverse().find((item) => item.toVersion === activeVersion && item.fromVersion);
      const selectedVersion = String(targetVersion || latestActivation?.fromVersion || current.pointer?.previousVersion || "");
      if (!selectedVersion || selectedVersion === activeVersion) throw new CitationPackageUpdateError("No earlier installed version is available for rollback.", 409, "CITATION_UPDATE_ROLLBACK_TARGET_UNAVAILABLE");
      const target = current.installed.find((item) => item.version === selectedVersion && item.installed && item.validManifest);
      if (!target) throw new CitationPackageUpdateError("Rollback target is not a valid installed package.", 409, "CITATION_UPDATE_ROLLBACK_TARGET_INVALID", { targetVersion: selectedVersion });
      const manifest = JSON.parse(await readFile(path.join(target.packagePath, "manifest.json"), "utf8"));
      await this.validatePackageDirectory(target.packagePath, manifest, { requireDistribution: Boolean(manifest.distribution) });
      const rolledBackAt = nowIso(this.clock);
      await this.writePointer({
        schemaVersion: 1, packageId: PACKAGE_ID, activeVersion: selectedVersion,
        previousVersion: activeVersion, activatedAt: rolledBackAt,
        databaseRelativePath: `${selectedVersion}/${SQLITE_PATH}`,
        manifestSha256: sha256(await readFile(path.join(target.packagePath, "manifest.json"), "utf8")),
        sourceCommit: target.sourceCommit
      });
      state.activations = [...(state.activations || []), {
        id: crypto.randomUUID(), action: "rollback", at: rolledBackAt,
        fromVersion: activeVersion, toVersion: selectedVersion, candidateId: null
      }].slice(-100);
      await this.writeState(state);
      return this.status();
    });
  }
}

export const CITATION_PACKAGE_UPDATE_DEFAULTS = Object.freeze({
  packageId: PACKAGE_ID,
  officialRepository: OFFICIAL_REPOSITORY,
  officialApiRoot: OFFICIAL_API_ROOT,
  packageRoot: DEFAULT_PACKAGE_ROOT,
  defaultVersion: DEFAULT_VERSION,
  distributionFormat: DISTRIBUTION_FORMAT,
  manifestAssetNames: [...MANIFEST_ASSET_NAMES],
  requiredDistributionPaths: [SQLITE_PATH, ...REQUIRED_NOTICE_PATHS]
});

export default CitationPackageUpdateStore;
