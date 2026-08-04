import crypto from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ID = "geo-citation-lab";
const OFFICIAL_REPOSITORY = "https://github.com/yaojingang/geo-citation-lab";
const OFFICIAL_API_ROOT = "https://api.github.com/repos/yaojingang/geo-citation-lab";
const OFFICIAL_RAW_ROOT = "https://raw.githubusercontent.com/yaojingang/geo-citation-lab";
const DEFAULT_PACKAGE_ROOT = path.join(moduleRoot, "research-packages", PACKAGE_ID);
const STATE_FORMAT = "tongzhuo-citation-document-update-state-v1";
const SNAPSHOT_FORMAT = "tongzhuo-citation-document-snapshot-v1";
const POINTER_SCHEMA_VERSION = 1;
const SNAPSHOT_MANIFEST_NAME = ".citation-document-snapshot.json";
const REQUIRED_LICENSE_PATHS = Object.freeze([
  "LICENSE",
  "LICENSE-CODE",
  "LICENSE-CONTENT",
  "THIRD_PARTY_NOTICES.md"
]);
const ROOT_DOCUMENTS = new Set([
  "README.md",
  ...REQUIRED_LICENSE_PATHS
]);
const RESEARCH_PREFIXES = Object.freeze([
  "01-geo-experiment-data-report/",
  "02-geo-aeo-ai-search-papers/",
  "03-cn-geo-citation-dataset/"
]);
const DOCUMENT_EXTENSIONS = new Set([".md", ".markdown", ".html", ".htm", ".txt", ".json"]);
const EXCLUDED_SEGMENTS = new Set([
  ".git", ".github", "node_modules", "derived", "catalog", "curated", "records", "raw", "scripts", "__pycache__"
]);

function nowIso(clock) { return new Date(clock()).toISOString(); }
function clone(value) { return value == null ? value : structuredClone(value); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha1(value) { return crypto.createHash("sha1").update(value).digest("hex"); }
function isCommit(value) { return /^[a-f0-9]{40}$/i.test(String(value || "")); }
function isSha256(value) { return /^[a-f0-9]{64}$/i.test(String(value || "")); }
function isGitBlobSha(value) { return /^[a-f0-9]{40}$/i.test(String(value || "")); }
function safeMessage(error) { return String(error?.message || error || "Unknown document update error").slice(0, 500); }
function normalizeRelative(value) { return String(value || "").replaceAll("\\", "/").replace(/^\.\//, ""); }
function normalizeRepository(value) { return String(value || "").trim().replace(/\.git$/i, "").replace(/\/+$/, "").toLocaleLowerCase("en-US"); }
function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject(value[key])]));
}
function canonicalJson(value) { return `${JSON.stringify(sortedObject(value), null, 2)}\n`; }
function gitBlobSha(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return sha1(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, "utf8"), bytes]));
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRelative(value) {
  const raw = String(value || "");
  const normalized = normalizeRelative(raw);
  if (!normalized || raw.includes("\\") || raw.startsWith("./") || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new CitationDocumentUpdateError("Repository document path is invalid.", 422, "CITATION_DOCUMENT_PATH_INVALID", { path: value });
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new CitationDocumentUpdateError("Repository document path contains an unsafe segment.", 422, "CITATION_DOCUMENT_PATH_INVALID", { path: value });
  }
  return normalized;
}

function safeJoin(root, relativePath) {
  const normalized = safeRelative(relativePath);
  const target = path.resolve(root, ...normalized.split("/"));
  if (!isInside(root, target)) throw new CitationDocumentUpdateError("Repository document escaped the snapshot root.", 422, "CITATION_DOCUMENT_PATH_INVALID", { path: relativePath });
  return target;
}

function extensionOf(value) { return path.posix.extname(normalizeRelative(value)).toLocaleLowerCase("en-US"); }
function isLicensePath(value) { return REQUIRED_LICENSE_PATHS.includes(normalizeRelative(value)); }
function isAllowlistedDocumentPath(value) {
  const relative = safeRelative(value);
  if (ROOT_DOCUMENTS.has(relative)) return true;
  if (!RESEARCH_PREFIXES.some((prefix) => relative.startsWith(prefix))) return false;
  if (!DOCUMENT_EXTENSIONS.has(extensionOf(relative))) return false;
  const segments = relative.split("/").map((item) => item.toLocaleLowerCase("en-US"));
  return !segments.some((segment) => EXCLUDED_SEGMENTS.has(segment));
}
function isMethodologyPath(value) {
  const relative = normalizeRelative(value);
  if (isLicensePath(relative) || extensionOf(relative) === ".json") return false;
  return relative === "README.md" || RESEARCH_PREFIXES.some((prefix) => relative.startsWith(prefix));
}
function rawUrl(commit, relativePath) {
  const encoded = safeRelative(relativePath).split("/").map(encodeURIComponent).join("/");
  return `${OFFICIAL_RAW_ROOT}/${commit}/${encoded}`;
}
function officialRawUrl(value, commit, relativePath) {
  try {
    const actual = new URL(String(value || ""));
    const expected = new URL(rawUrl(commit, relativePath));
    return actual.protocol === "https:" && actual.hostname === expected.hostname && actual.pathname === expected.pathname && !actual.search && !actual.hash;
  } catch { return false; }
}

function licenseErrors(read) {
  const errors = [];
  const license = String(read("LICENSE") || "");
  const code = String(read("LICENSE-CODE") || "");
  const content = String(read("LICENSE-CONTENT") || "");
  const notices = String(read("THIRD_PARTY_NOTICES.md") || "");
  const every = (text, patterns) => patterns.every((pattern) => pattern.test(text));
  if (license.length < 500 || !every(license, [/GEO Citation Lab licensing/i, /separate licenses/i, /LICENSE-CODE/i, /LICENSE-CONTENT/i, /THIRD_PARTY_NOTICES\.md/i, /Redistributions must preserve/i])) {
    errors.push("LICENSE does not contain the expected scope map and redistribution notice");
  }
  if (code.length < 800 || !every(code, [/^MIT License/im, /Permission is hereby granted, free of charge/i, /The above copyright notice and this permission notice shall be included/i, /THE SOFTWARE IS PROVIDED "AS IS"/i, /WITHOUT WARRANTY OF ANY KIND/i])) {
    errors.push("LICENSE-CODE is not the complete expected MIT license text");
  }
  if (content.length < 700 || !every(content, [/Creative Commons Attribution 4\.0 International/i, /CC BY 4\.0/i, /creativecommons\.org\/licenses\/by\/4\.0/i, /provide reasonable attribution/i, /indicate whether you made changes/i, /does not cover[\s\S]{0,120}third-party material/i])) {
    errors.push("LICENSE-CONTENT is not the expected CC BY 4.0 scope and attribution notice");
  }
  if (notices.length < 800 || !every(notices, [/Third-party materials and distribution scope/i, /WENDAOstudy\/cn-geo-citation-dataset/i, /does not grant additional rights/i, /Copyright in each academic paper remains/i])) {
    errors.push("THIRD_PARTY_NOTICES.md does not contain the expected source and rights boundary");
  }
  const unexpectedRestriction = /(all rights reserved|noncommercial|non-commercial|no derivatives|no redistribution|additional restrictions)/i;
  if ([license, code, content].some((text) => unexpectedRestriction.test(text))) errors.push("license files contain an unexpected restrictive term and require manual review");
  return errors;
}

function snapshotManifestErrors(manifest, options = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) errors.push("snapshot manifest must be an object");
  if (manifest?.format !== SNAPSHOT_FORMAT) errors.push(`snapshot format must equal ${SNAPSHOT_FORMAT}`);
  if (manifest?.schemaVersion !== 1) errors.push("snapshot schemaVersion must equal 1");
  if (manifest?.packageId !== PACKAGE_ID) errors.push(`snapshot packageId must equal ${PACKAGE_ID}`);
  if (normalizeRepository(manifest?.repository) !== normalizeRepository(OFFICIAL_REPOSITORY)) errors.push("snapshot repository is not the official Citation Lab repository");
  if (!isCommit(manifest?.sourceCommit)) errors.push("snapshot sourceCommit must be a full commit SHA");
  if (!isGitBlobSha(manifest?.treeSha)) errors.push("snapshot treeSha must be a full Git tree SHA");
  if (!Array.isArray(manifest?.files) || !manifest.files.length) errors.push("snapshot files must be a non-empty array");
  const declaredFiles = Array.isArray(manifest?.files) ? manifest.files : [];
  const seen = new Set();
  for (const [index, file] of declaredFiles.entries()) {
    let relative = "";
    try { relative = safeRelative(file?.path); } catch (error) { errors.push(`files[${index}] has unsafe path: ${safeMessage(error)}`); continue; }
    if (!isAllowlistedDocumentPath(relative)) errors.push(`files[${index}] is outside the document allowlist: ${relative}`);
    if (seen.has(relative)) errors.push(`duplicate snapshot path: ${relative}`);
    seen.add(relative);
    if (!Number.isSafeInteger(file?.sizeBytes) || file.sizeBytes < 1) errors.push(`files[${index}].sizeBytes is invalid`);
    if (!isGitBlobSha(file?.gitBlobSha)) errors.push(`files[${index}].gitBlobSha is invalid`);
    if (!isSha256(file?.sha256)) errors.push(`files[${index}].sha256 is invalid`);
  }
  for (const required of REQUIRED_LICENSE_PATHS) if (!seen.has(required)) errors.push(`required license file is missing: ${required}`);
  const documentCount = declaredFiles.filter((item) => !isLicensePath(item?.path)).length;
  const methodologyCount = declaredFiles.filter((item) => isMethodologyPath(item?.path)).length;
  if (documentCount < Number(options.minimumDocumentCount || 1)) errors.push(`document count ${documentCount} is below the required minimum`);
  if (methodologyCount < Number(options.minimumMethodologyCount || 1)) errors.push(`methodology count ${methodologyCount} is below the required minimum`);
  if (manifest?.counts?.documents !== documentCount) errors.push("snapshot document count does not match files");
  if (manifest?.counts?.methodology !== methodologyCount) errors.push("snapshot methodology count does not match files");
  return errors;
}

function listFilesSync(root, relative = "") {
  const output = [];
  const directory = relative ? safeJoin(root, relative) : root;
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new CitationDocumentUpdateError("Document snapshot contains a symbolic link.", 422, "CITATION_DOCUMENT_SNAPSHOT_SYMLINK", { path: child });
    if (entry.isDirectory()) output.push(...listFilesSync(root, child));
    else if (entry.isFile()) output.push(child);
    else throw new CitationDocumentUpdateError("Document snapshot contains a non-regular file.", 422, "CITATION_DOCUMENT_SNAPSHOT_FILE_TYPE_INVALID", { path: child });
  }
  return output;
}

async function assertDirectoryChainSafe(root, directory) {
  const resolvedRoot = path.resolve(root); const resolvedDirectory = path.resolve(directory);
  if (!isInside(resolvedRoot, resolvedDirectory)) throw new CitationDocumentUpdateError("Document directory escaped its staging root.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID", { directory });
  const relative = path.relative(resolvedRoot, resolvedDirectory);
  let current = resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new CitationDocumentUpdateError("Document staging path contains a symbolic link or non-directory ancestor.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID", { directory: current });
  }
}

function inspectSnapshotDirectorySync(snapshotRoot, options = {}) {
  const root = path.resolve(snapshotRoot);
  const manifestPath = path.join(root, SNAPSHOT_MANIFEST_NAME);
  if (!existsSync(root) || !statSync(root).isDirectory() || lstatSync(root).isSymbolicLink() || !existsSync(manifestPath)) {
    throw new CitationDocumentUpdateError("Document snapshot is incomplete.", 422, "CITATION_DOCUMENT_SNAPSHOT_INCOMPLETE", { snapshotRoot: root });
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch (error) { throw new CitationDocumentUpdateError("Document snapshot manifest is invalid JSON.", 422, "CITATION_DOCUMENT_SNAPSHOT_MANIFEST_INVALID", { cause: safeMessage(error) }); }
  const shapeErrors = snapshotManifestErrors(manifest, options);
  if (shapeErrors.length) throw new CitationDocumentUpdateError("Document snapshot manifest failed validation.", 422, "CITATION_DOCUMENT_SNAPSHOT_MANIFEST_INVALID", { errors: shapeErrors });
  const actual = listFilesSync(root).filter((item) => item !== SNAPSHOT_MANIFEST_NAME);
  const declared = manifest.files.map((item) => item.path).sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(actual.sort((a, b) => a.localeCompare(b, "en"))) !== JSON.stringify(declared)) {
    throw new CitationDocumentUpdateError("Document snapshot file inventory differs from its manifest.", 422, "CITATION_DOCUMENT_SNAPSHOT_INVENTORY_MISMATCH", { actual, declared });
  }
  const verifiedFiles = [];
  for (const file of manifest.files) {
    const filePath = safeJoin(root, file.path);
    const info = lstatSync(filePath);
    if (!info.isFile() || info.isSymbolicLink()) throw new CitationDocumentUpdateError("Document snapshot entry is not a regular file.", 422, "CITATION_DOCUMENT_SNAPSHOT_FILE_TYPE_INVALID", { path: file.path });
    const bytes = readFileSync(filePath);
    if (bytes.length !== file.sizeBytes) throw new CitationDocumentUpdateError("Document snapshot byte size mismatch.", 422, "CITATION_DOCUMENT_SNAPSHOT_SIZE_MISMATCH", { path: file.path, expected: file.sizeBytes, actual: bytes.length });
    const actualSha256 = sha256(bytes); const actualBlob = gitBlobSha(bytes);
    if (actualSha256 !== file.sha256) throw new CitationDocumentUpdateError("Document snapshot SHA-256 mismatch.", 422, "CITATION_DOCUMENT_SNAPSHOT_SHA256_MISMATCH", { path: file.path });
    if (actualBlob !== file.gitBlobSha) throw new CitationDocumentUpdateError("Document snapshot Git blob SHA mismatch.", 422, "CITATION_DOCUMENT_SNAPSHOT_GIT_BLOB_MISMATCH", { path: file.path });
    let decoded;
    try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new CitationDocumentUpdateError("Document snapshot file is not valid UTF-8 text.", 422, "CITATION_DOCUMENT_SNAPSHOT_ENCODING_INVALID", { path: file.path }); }
    if (extensionOf(file.path) === ".json") {
      try { JSON.parse(decoded.replace(/^\uFEFF/, "")); }
      catch { throw new CitationDocumentUpdateError("Document snapshot JSON file is invalid.", 422, "CITATION_DOCUMENT_SNAPSHOT_JSON_INVALID", { path: file.path }); }
    }
    verifiedFiles.push({ path: file.path, sizeBytes: bytes.length, sha256: actualSha256, gitBlobSha: actualBlob });
  }
  const licenses = licenseErrors((relative) => readFileSync(safeJoin(root, relative), "utf8"));
  if (licenses.length) throw new CitationDocumentUpdateError("Document snapshot license validation failed.", 422, "CITATION_DOCUMENT_SNAPSHOT_LICENSE_INVALID", { errors: licenses });
  const manifestRaw = readFileSync(manifestPath);
  return {
    sourceCommit: String(manifest.sourceCommit).toLowerCase(),
    treeSha: String(manifest.treeSha).toLowerCase(),
    repository: OFFICIAL_REPOSITORY,
    documentRoot: root,
    manifestPath,
    manifestSha256: sha256(manifestRaw),
    installed: true,
    verified: true,
    legacy: false,
    createdAt: manifest.createdAt || null,
    counts: clone(manifest.counts),
    files: verifiedFiles
  };
}

function inferDataPackageCommit(packageRoot) {
  const root = path.resolve(packageRoot);
  let version = "";
  try { version = String(JSON.parse(readFileSync(path.join(root, ".updates", "active.json"), "utf8"))?.activeVersion || ""); } catch {}
  const candidates = [];
  if (version) candidates.push(version);
  candidates.push("2.0.1");
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isDirectory() && /^\d+(?:\.\d+)+/.test(entry.name)) candidates.push(entry.name);
  } catch {}
  for (const candidate of [...new Set(candidates)]) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(root, candidate, "manifest.json"), "utf8"));
      if (isCommit(manifest?.sourceCommit)) return String(manifest.sourceCommit).toLowerCase();
    } catch {}
  }
  return "";
}

function legacyDocumentRecord(packageRoot, commit, explicitRoot = "") {
  if (!isCommit(commit)) return null;
  const root = path.resolve(explicitRoot || path.join(packageRoot, `repository-mirror-${commit.slice(0, 8)}`));
  try {
    if (!statSync(root).isDirectory()) return null;
    const files = listFilesSync(root).filter((item) => DOCUMENT_EXTENSIONS.has(extensionOf(item)) || isLicensePath(item));
    if (!files.length) return null;
    return {
      sourceCommit: commit,
      repository: OFFICIAL_REPOSITORY,
      documentRoot: root,
      manifestPath: null,
      manifestSha256: null,
      installed: true,
      verified: false,
      legacy: true,
      createdAt: null,
      counts: { documents: files.filter((item) => !isLicensePath(item)).length, methodology: files.filter(isMethodologyPath).length },
      files: []
    };
  } catch { return null; }
}

export class CitationDocumentUpdateError extends Error {
  constructor(message, status = 422, code = "CITATION_DOCUMENT_UPDATE_ERROR", details = {}) {
    super(message);
    this.name = "CitationDocumentUpdateError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function resolveActiveCitationResearchDocuments(options = {}) {
  const packageRoot = path.resolve(options.packageRoot || process.env.TZ_CITATION_PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
  const controlRoot = path.resolve(options.controlRoot || path.join(packageRoot, ".document-updates"));
  const snapshotsRoot = path.resolve(options.snapshotsRoot || path.join(packageRoot, "document-snapshots"));
  const pointerPath = path.resolve(options.pointerPath || path.join(controlRoot, "document-active.json"));
  const installed = [];
  try {
    for (const entry of readdirSync(snapshotsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isCommit(entry.name)) continue;
      try { installed.push(inspectSnapshotDirectorySync(path.join(snapshotsRoot, entry.name), options)); }
      catch (error) { installed.push({ sourceCommit: entry.name, documentRoot: path.join(snapshotsRoot, entry.name), installed: false, verified: false, legacy: false, errorCode: error.code, errorMessage: error.message }); }
    }
  } catch {}
  installed.sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")) || left.sourceCommit.localeCompare(right.sourceCommit));
  let pointer = null;
  try {
    const pointerInfo = lstatSync(pointerPath);
    if (!pointerInfo.isFile() || pointerInfo.isSymbolicLink()) throw new Error("document pointer is not a regular file");
    pointer = JSON.parse(readFileSync(pointerPath, "utf8"));
    if (pointer?.schemaVersion !== POINTER_SCHEMA_VERSION || pointer?.packageId !== PACKAGE_ID || normalizeRepository(pointer?.repository) !== normalizeRepository(OFFICIAL_REPOSITORY) || !isCommit(pointer?.activeCommit)) throw new Error("document pointer format is invalid");
  } catch (error) {
    if (error?.code !== "ENOENT") throw new CitationDocumentUpdateError("Active Citation Lab document pointer is invalid.", 500, "CITATION_DOCUMENT_POINTER_INVALID", { cause: safeMessage(error) });
    pointer = null;
  }
  const requestedCommit = String(options.commit || process.env.TZ_CITATION_RESEARCH_DOCUMENT_COMMIT || pointer?.activeCommit || "").toLowerCase();
  let active = installed.find((item) => item.verified && item.sourceCommit === requestedCommit) || null;
  if (pointer && !active) throw new CitationDocumentUpdateError("Active Citation Lab document snapshot is missing or failed integrity validation.", 500, "CITATION_DOCUMENT_ACTIVE_SNAPSHOT_INVALID", { activeCommit: pointer.activeCommit });
  if (pointer && active) {
    const expectedRelative = normalizeRelative(path.relative(packageRoot, active.documentRoot));
    if (pointer.manifestSha256 !== active.manifestSha256 || pointer.snapshotRelativePath !== expectedRelative) {
      throw new CitationDocumentUpdateError("Active Citation Lab document pointer does not match the verified snapshot.", 500, "CITATION_DOCUMENT_ACTIVE_POINTER_MISMATCH", { activeCommit: pointer.activeCommit });
    }
  }
  let legacy = null;
  if (!active) {
    const legacyCommit = String(options.legacyCommit || inferDataPackageCommit(packageRoot)).toLowerCase();
    legacy = legacyDocumentRecord(packageRoot, legacyCommit, options.legacyDocumentRoot || process.env.TZ_CITATION_RESEARCH_REPOSITORY_MIRROR || "");
    active = legacy;
  }
  return { packageRoot, controlRoot, snapshotsRoot, pointerPath, pointer, active, installed, legacy };
}

function initialState() {
  return { format: STATE_FORMAT, revision: 0, updatedAt: null, lastCheck: null, candidate: null, activations: [] };
}

export class CitationDocumentUpdateStore {
  constructor(options = {}) {
    this.packageRoot = path.resolve(options.packageRoot || process.env.TZ_CITATION_PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
    this.controlRoot = path.resolve(options.controlRoot || path.join(this.packageRoot, ".document-updates"));
    this.stagingRoot = path.resolve(options.stagingRoot || path.join(this.controlRoot, "staging"));
    this.snapshotsRoot = path.resolve(options.snapshotsRoot || path.join(this.packageRoot, "document-snapshots"));
    this.statePath = path.resolve(options.statePath || path.join(this.controlRoot, "state.json"));
    this.pointerPath = path.resolve(options.pointerPath || path.join(this.controlRoot, "document-active.json"));
    if (!isInside(this.packageRoot, this.controlRoot) || !isInside(this.packageRoot, this.snapshotsRoot) || !isInside(this.controlRoot, this.stagingRoot) || !isInside(this.controlRoot, this.statePath) || !isInside(this.controlRoot, this.pointerPath)) {
      throw new CitationDocumentUpdateError("Document update paths must remain inside the Citation Lab package root.", 500, "CITATION_DOCUMENT_CONTROL_PATH_INVALID");
    }
    this.fetch = options.fetch || globalThis.fetch;
    if (typeof this.fetch !== "function") throw new TypeError("CitationDocumentUpdateStore requires fetch.");
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.githubToken = String(options.githubToken || process.env.TZ_CITATION_UPDATE_GITHUB_TOKEN || "").trim();
    this.metadataTimeoutMs = Math.max(1_000, Number(options.metadataTimeoutMs) || 20_000);
    this.fileTimeoutMs = Math.max(5_000, Number(options.fileTimeoutMs) || 120_000);
    this.maxMetadataBytes = Math.max(100_000, Number(options.maxMetadataBytes) || 12 * 1024 * 1024);
    this.maxFileBytes = Math.max(1_024, Number(options.maxFileBytes) || 8 * 1024 * 1024);
    this.maxSnapshotBytes = Math.max(this.maxFileBytes, Number(options.maxSnapshotBytes) || 64 * 1024 * 1024);
    this.maxFileCount = Math.max(8, Number(options.maxFileCount) || 500);
    this.minimumDocumentCount = Math.max(1, Number(options.minimumDocumentCount) || 8);
    this.minimumMethodologyCount = Math.max(1, Number(options.minimumMethodologyCount) || 4);
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
      throw new CitationDocumentUpdateError("Citation Lab document update state cannot be read safely.", 500, "CITATION_DOCUMENT_STATE_INVALID", { cause: safeMessage(error) });
    }
  }

  async assertControlPathsSafe() {
    await mkdir(this.packageRoot, { recursive: true });
    await mkdir(this.controlRoot, { recursive: true });
    await mkdir(this.stagingRoot, { recursive: true });
    await mkdir(this.snapshotsRoot, { recursive: true });
    const packageInfo = await lstat(this.packageRoot);
    if (!packageInfo.isDirectory() || packageInfo.isSymbolicLink()) throw new CitationDocumentUpdateError("Citation document package root must be a regular directory.", 500, "CITATION_DOCUMENT_ROOT_UNSAFE");
    const realPackage = await realpath(this.packageRoot);
    for (const target of [this.controlRoot, this.stagingRoot, this.snapshotsRoot]) {
      const info = await lstat(target);
      const resolved = await realpath(target);
      if (!info.isDirectory() || info.isSymbolicLink() || !isInside(realPackage, resolved)) {
        throw new CitationDocumentUpdateError("Citation document control directory is unsafe or escapes the package root.", 500, "CITATION_DOCUMENT_ROOT_UNSAFE", { target });
      }
    }
  }

  async writeState(value) {
    await this.assertControlPathsSafe();
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const state = { ...clone(value), format: STATE_FORMAT, revision: Number(value?.revision || 0) + 1, updatedAt: nowIso(this.clock) };
    const temporary = path.join(path.dirname(this.statePath), `.state-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, canonicalJson(state), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.statePath);
    return state;
  }

  async operation(callback) {
    if (this.busy) throw new CitationDocumentUpdateError("Another Citation Lab document update operation is in progress.", 409, "CITATION_DOCUMENT_UPDATE_BUSY");
    this.busy = true;
    try { return await callback(); } finally { this.busy = false; }
  }

  githubHeaders() {
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "tongzhuo-geo-private-deployment" };
    if (this.githubToken) headers.Authorization = `Bearer ${this.githubToken}`;
    return headers;
  }

  async readLimitedResponse(response, maximumBytes) {
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared > maximumBytes) throw new CitationDocumentUpdateError("GitHub response exceeds the configured size limit.", 422, "CITATION_DOCUMENT_RESPONSE_TOO_LARGE", { declared, maximumBytes });
    const chunks = []; let total = 0;
    if (!response.body) return Buffer.alloc(0);
    for await (const raw of response.body) {
      const chunk = Buffer.from(raw); total += chunk.length;
      if (total > maximumBytes) throw new CitationDocumentUpdateError("GitHub response exceeds the configured size limit.", 422, "CITATION_DOCUMENT_RESPONSE_TOO_LARGE", { actual: total, maximumBytes });
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  }

  async fetchJson(url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new CitationDocumentUpdateError("GitHub metadata URL is invalid.", 500, "CITATION_DOCUMENT_METADATA_URL_INVALID"); }
    if (parsed.protocol !== "https:" || parsed.hostname !== "api.github.com" || !parsed.pathname.startsWith("/repos/yaojingang/geo-citation-lab/")) {
      throw new CitationDocumentUpdateError("GitHub metadata URL is outside the official repository allowlist.", 422, "CITATION_DOCUMENT_METADATA_URL_REJECTED", { url });
    }
    let response;
    try { response = await this.fetch(url, { headers: this.githubHeaders(), redirect: "error", signal: AbortSignal.timeout(this.metadataTimeoutMs) }); }
    catch (error) { throw new CitationDocumentUpdateError("GitHub document metadata is unavailable.", 502, "CITATION_DOCUMENT_UPSTREAM_UNAVAILABLE", { cause: safeMessage(error) }); }
    if (!response.ok) throw new CitationDocumentUpdateError(`GitHub returned HTTP ${response.status}.`, 502, "CITATION_DOCUMENT_UPSTREAM_HTTP_ERROR", { status: response.status });
    const bytes = await this.readLimitedResponse(response, this.maxMetadataBytes);
    try { return JSON.parse(bytes.toString("utf8")); }
    catch { throw new CitationDocumentUpdateError("GitHub metadata is not valid JSON.", 502, "CITATION_DOCUMENT_UPSTREAM_JSON_INVALID"); }
  }

  async status() {
    const state = await this.readState();
    const resolution = resolveActiveCitationResearchDocuments({
      packageRoot: this.packageRoot,
      controlRoot: this.controlRoot,
      snapshotsRoot: this.snapshotsRoot,
      pointerPath: this.pointerPath,
      minimumDocumentCount: this.minimumDocumentCount,
      minimumMethodologyCount: this.minimumMethodologyCount
    });
    const lastCheckAt = state.lastCheck?.checkedAt ? Date.parse(state.lastCheck.checkedAt) : NaN;
    return {
      packageId: PACKAGE_ID,
      officialRepository: OFFICIAL_REPOSITORY,
      updatePolicy: {
        automaticAction: "check_only",
        checkDue: !Number.isFinite(lastCheckAt) || this.clock() - lastCheckAt >= this.checkIntervalMs,
        checkIntervalHours: Math.round(this.checkIntervalMs / 3_600_000),
        downloadsPinnedRawFilesOnly: true,
        executesGit: false,
        activationRequiresExplicitConfirmation: true,
        overwritesExistingSnapshots: false
      },
      current: resolution.active,
      installed: resolution.installed,
      pointer: resolution.pointer,
      lastCheck: clone(state.lastCheck),
      candidate: clone(state.candidate),
      activationHistory: clone(state.activations || []).slice(-20).reverse(),
      revision: state.revision
    };
  }

  async checkForUpdates() {
    return this.operation(async () => {
      const currentStatus = await this.status();
      if (["staged", "validated"].includes(currentStatus.candidate?.lifecycle)) {
        throw new CitationDocumentUpdateError("Finish or discard the staged document candidate before checking again.", 409, "CITATION_DOCUMENT_CANDIDATE_IN_PROGRESS", { candidateId: currentStatus.candidate.id });
      }
      const checkedAt = nowIso(this.clock);
      const commitPayload = await this.fetchJson(`${OFFICIAL_API_ROOT}/commits/HEAD`);
      const latestCommit = String(commitPayload?.sha || "").toLowerCase();
      if (!isCommit(latestCommit)) throw new CitationDocumentUpdateError("Official repository did not return a full commit SHA.", 502, "CITATION_DOCUMENT_COMMIT_INVALID");
      const treeSha = String(commitPayload?.commit?.tree?.sha || "").toLowerCase();
      if (!isGitBlobSha(treeSha)) throw new CitationDocumentUpdateError("Official repository commit did not include a full tree SHA.", 502, "CITATION_DOCUMENT_TREE_SHA_INVALID");
      const currentCommit = String(currentStatus.current?.sourceCommit || "").toLowerCase();
      const updateDiscovered = latestCommit !== currentCommit || currentStatus.current?.verified !== true;
      let candidate = null;
      if (updateDiscovered) {
        const tree = await this.fetchJson(`${OFFICIAL_API_ROOT}/git/trees/${treeSha}?recursive=1`);
        if (tree?.truncated === true) throw new CitationDocumentUpdateError("Official repository tree was truncated; snapshot cannot be complete.", 422, "CITATION_DOCUMENT_TREE_TRUNCATED");
        if (!Array.isArray(tree?.tree)) throw new CitationDocumentUpdateError("Official repository tree is missing.", 502, "CITATION_DOCUMENT_TREE_INVALID");
        if (String(tree?.sha || "").toLowerCase() !== treeSha) throw new CitationDocumentUpdateError("GitHub tree response does not match the commit tree SHA.", 422, "CITATION_DOCUMENT_TREE_SHA_MISMATCH", { expected: treeSha, actual: tree?.sha || null });
        const files = [];
        for (const entry of tree.tree) {
          const relative = safeRelative(entry?.path);
          if (!isAllowlistedDocumentPath(relative)) continue;
          if (entry?.type !== "blob" || entry?.mode !== "100644") {
            throw new CitationDocumentUpdateError("An allowlisted repository document is not a regular non-executable Git blob.", 422, "CITATION_DOCUMENT_TREE_FILE_TYPE_INVALID", { path: relative, type: entry?.type, mode: entry?.mode });
          }
          const sizeBytes = Number(entry?.size);
          if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > this.maxFileBytes) {
            throw new CitationDocumentUpdateError("An allowlisted repository document has an invalid or excessive size.", 422, "CITATION_DOCUMENT_TREE_FILE_SIZE_INVALID", { path: relative, sizeBytes, maximumBytes: this.maxFileBytes });
          }
          if (!isGitBlobSha(entry?.sha)) throw new CitationDocumentUpdateError("Repository tree entry has an invalid Git blob SHA.", 422, "CITATION_DOCUMENT_TREE_BLOB_INVALID", { path: relative });
          files.push({ path: relative, sizeBytes, gitBlobSha: String(entry.sha).toLowerCase(), rawUrl: rawUrl(latestCommit, relative) });
        }
        files.sort((left, right) => left.path.localeCompare(right.path, "en"));
        if (files.length > this.maxFileCount) throw new CitationDocumentUpdateError("Allowlisted document count exceeds the configured limit.", 422, "CITATION_DOCUMENT_FILE_COUNT_EXCEEDED", { count: files.length, maximum: this.maxFileCount });
        for (const required of REQUIRED_LICENSE_PATHS) if (!files.some((item) => item.path === required)) throw new CitationDocumentUpdateError("Official repository snapshot is missing a required license file.", 422, "CITATION_DOCUMENT_LICENSE_FILE_MISSING", { path: required });
        const counts = { documents: files.filter((item) => !isLicensePath(item.path)).length, methodology: files.filter((item) => isMethodologyPath(item.path)).length };
        const totalBytes = files.reduce((sum, item) => sum + item.sizeBytes, 0);
        if (counts.documents < this.minimumDocumentCount || counts.methodology < this.minimumMethodologyCount) {
          throw new CitationDocumentUpdateError("Official repository snapshot does not contain enough research documents.", 422, "CITATION_DOCUMENT_COUNT_INSUFFICIENT", { counts, minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
        }
        if (totalBytes > this.maxSnapshotBytes) throw new CitationDocumentUpdateError("Official repository document snapshot exceeds the aggregate size limit.", 422, "CITATION_DOCUMENT_SNAPSHOT_TOO_LARGE", { totalBytes, maximumBytes: this.maxSnapshotBytes });
        candidate = {
          id: sha256(`${latestCommit}\u001f${files.map((item) => `${item.path}:${item.gitBlobSha}`).join("\u001e")}`).slice(0, 24),
          lifecycle: "discovered",
          discoveredAt: checkedAt,
          sourceCommit: latestCommit,
          treeSha,
          previousCommit: currentCommit || null,
          repository: OFFICIAL_REPOSITORY,
          files,
          counts,
          totalBytes,
          stagedRelativePath: null,
          validation: null
        };
      }
      const state = await this.readState();
      state.lastCheck = { checkedAt, state: "completed", upstreamReachable: true, updateDiscovered, currentCommit: currentCommit || null, latestCommit };
      state.candidate = candidate;
      await this.writeState(state);
      return this.status();
    });
  }

  candidateFromState(state, candidateId) {
    const candidate = state?.candidate;
    if (!candidate || candidate.id !== String(candidateId || "")) throw new CitationDocumentUpdateError("Document update candidate no longer matches the latest checked candidate.", 409, "CITATION_DOCUMENT_CANDIDATE_STALE");
    return candidate;
  }

  async downloadCandidateFile(file, sourceCommit) {
    if (!officialRawUrl(file.rawUrl, sourceCommit, file.path)) throw new CitationDocumentUpdateError("Candidate raw URL is outside the official pinned-commit allowlist.", 422, "CITATION_DOCUMENT_RAW_URL_REJECTED", { path: file.path });
    let response;
    try { response = await this.fetch(file.rawUrl, { headers: { Accept: "text/plain, application/json, text/html", "User-Agent": "tongzhuo-geo-private-deployment" }, redirect: "error", signal: AbortSignal.timeout(this.fileTimeoutMs) }); }
    catch (error) { throw new CitationDocumentUpdateError("Pinned repository document could not be downloaded.", 502, "CITATION_DOCUMENT_DOWNLOAD_FAILED", { path: file.path, cause: safeMessage(error) }); }
    if (!response.ok) throw new CitationDocumentUpdateError(`Pinned repository document returned HTTP ${response.status}.`, 502, "CITATION_DOCUMENT_DOWNLOAD_FAILED", { path: file.path, status: response.status });
    const bytes = await this.readLimitedResponse(response, this.maxFileBytes);
    if (bytes.length !== file.sizeBytes) throw new CitationDocumentUpdateError("Downloaded document byte size differs from the Git tree.", 422, "CITATION_DOCUMENT_DOWNLOAD_SIZE_MISMATCH", { path: file.path, expected: file.sizeBytes, actual: bytes.length });
    const actualBlob = gitBlobSha(bytes);
    if (actualBlob !== file.gitBlobSha) throw new CitationDocumentUpdateError("Downloaded document does not match the Git tree blob SHA.", 422, "CITATION_DOCUMENT_DOWNLOAD_GIT_BLOB_MISMATCH", { path: file.path, expected: file.gitBlobSha, actual: actualBlob });
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new CitationDocumentUpdateError("Downloaded repository document is not valid UTF-8 text.", 422, "CITATION_DOCUMENT_DOWNLOAD_ENCODING_INVALID", { path: file.path }); }
    return { bytes, sha256: sha256(bytes), gitBlobSha: actualBlob };
  }

  async stageCandidate({ candidateId, confirm = false } = {}) {
    if (confirm !== true) throw new CitationDocumentUpdateError("Explicit document staging confirmation is required.", 422, "CITATION_DOCUMENT_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      await this.assertControlPathsSafe();
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle !== "discovered") throw new CitationDocumentUpdateError("Document candidate is not in the discovered state.", 409, "CITATION_DOCUMENT_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const stagePath = await mkdtemp(path.join(this.stagingRoot, `${candidate.id}-`));
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationDocumentUpdateError("Generated document staging path is unsafe.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID");
      const verifiedFiles = [];
      try {
        for (const file of candidate.files) {
          const downloaded = await this.downloadCandidateFile(file, candidate.sourceCommit);
          const target = safeJoin(stagePath, file.path);
          await mkdir(path.dirname(target), { recursive: true });
          await assertDirectoryChainSafe(stagePath, path.dirname(target));
          await writeFile(target, downloaded.bytes, { mode: 0o600, flag: "wx" });
          verifiedFiles.push({ path: file.path, sizeBytes: downloaded.bytes.length, gitBlobSha: downloaded.gitBlobSha, sha256: downloaded.sha256 });
        }
        const licenses = licenseErrors((relative) => readFileSync(safeJoin(stagePath, relative), "utf8"));
        if (licenses.length) throw new CitationDocumentUpdateError("Downloaded document licenses failed validation.", 422, "CITATION_DOCUMENT_SNAPSHOT_LICENSE_INVALID", { errors: licenses });
        const manifest = {
          format: SNAPSHOT_FORMAT,
          schemaVersion: 1,
          packageId: PACKAGE_ID,
          repository: OFFICIAL_REPOSITORY,
          sourceCommit: candidate.sourceCommit,
          treeSha: candidate.treeSha,
          createdAt: nowIso(this.clock),
          files: verifiedFiles,
          counts: candidate.counts
        };
        const manifestErrors = snapshotManifestErrors(manifest, { minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
        if (manifestErrors.length) throw new CitationDocumentUpdateError("Generated document snapshot manifest is invalid.", 422, "CITATION_DOCUMENT_SNAPSHOT_MANIFEST_INVALID", { errors: manifestErrors });
        await writeFile(path.join(stagePath, SNAPSHOT_MANIFEST_NAME), canonicalJson(manifest), { encoding: "utf8", mode: 0o600, flag: "wx" });
      } catch (error) {
        await rm(stagePath, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
      candidate.lifecycle = "staged";
      candidate.stagedAt = nowIso(this.clock);
      candidate.stagedRelativePath = normalizeRelative(path.relative(this.packageRoot, stagePath));
      await this.writeState(state);
      return this.status();
    });
  }

  async validateStagedCandidate({ candidateId } = {}) {
    return this.operation(async () => {
      await this.assertControlPathsSafe();
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle !== "staged") throw new CitationDocumentUpdateError("Document candidate must be staged before validation.", 409, "CITATION_DOCUMENT_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationDocumentUpdateError("Recorded document staging path is unsafe.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID");
      const result = inspectSnapshotDirectorySync(stagePath, { minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
      if (result.sourceCommit !== candidate.sourceCommit) throw new CitationDocumentUpdateError("Staged document commit differs from the candidate.", 422, "CITATION_DOCUMENT_STAGED_COMMIT_MISMATCH");
      candidate.lifecycle = "validated";
      candidate.validatedAt = nowIso(this.clock);
      candidate.validation = { state: "passed", manifestSha256: result.manifestSha256, counts: result.counts };
      await this.writeState(state);
      return this.status();
    });
  }

  async discardCandidate({ candidateId, confirm = false } = {}) {
    if (confirm !== true) throw new CitationDocumentUpdateError("Explicit document candidate discard confirmation is required.", 422, "CITATION_DOCUMENT_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      await this.assertControlPathsSafe();
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle === "activated") throw new CitationDocumentUpdateError("An activated document snapshot cannot be discarded.", 409, "CITATION_DOCUMENT_INVALID_LIFECYCLE");
      if (candidate.stagedRelativePath) {
        const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
        if (!isInside(this.stagingRoot, stagePath) || stagePath === this.stagingRoot) throw new CitationDocumentUpdateError("Recorded document staging path is unsafe.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID");
        await rm(stagePath, { recursive: true, force: true });
      }
      state.candidate = null;
      await this.writeState(state);
      return this.status();
    });
  }

  async writePointer(pointer) {
    await this.assertControlPathsSafe();
    const temporary = path.join(path.dirname(this.pointerPath), `.document-active-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, canonicalJson(pointer), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, this.pointerPath);
  }

  async restorePointer(pointer) {
    if (pointer) return this.writePointer(pointer);
    await this.assertControlPathsSafe();
    await rm(this.pointerPath, { force: true });
  }

  async activateCandidate({ candidateId, expectedCurrentCommit = "", confirm = false } = {}) {
    if (confirm !== true) throw new CitationDocumentUpdateError("Explicit document snapshot activation confirmation is required.", 422, "CITATION_DOCUMENT_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      await this.assertControlPathsSafe();
      const current = await this.status();
      if (String(expectedCurrentCommit || "").toLowerCase() !== String(current.current?.sourceCommit || "").toLowerCase()) {
        throw new CitationDocumentUpdateError("Active document snapshot changed since update status was loaded.", 409, "CITATION_DOCUMENT_ACTIVE_CONFLICT", { expected: expectedCurrentCommit || null, actual: current.current?.sourceCommit || null });
      }
      const state = await this.readState(); const candidate = this.candidateFromState(state, candidateId);
      if (candidate.lifecycle !== "validated" || candidate.validation?.state !== "passed") throw new CitationDocumentUpdateError("Only a validated document snapshot can be activated.", 409, "CITATION_DOCUMENT_INVALID_LIFECYCLE", { lifecycle: candidate.lifecycle });
      const stagePath = safeJoin(this.packageRoot, candidate.stagedRelativePath);
      if (!isInside(this.stagingRoot, stagePath)) throw new CitationDocumentUpdateError("Recorded document staging path is unsafe.", 500, "CITATION_DOCUMENT_STAGING_PATH_INVALID");
      const preActivation = inspectSnapshotDirectorySync(stagePath, { minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
      if (preActivation.sourceCommit !== candidate.sourceCommit || preActivation.manifestSha256 !== candidate.validation.manifestSha256) {
        throw new CitationDocumentUpdateError("Validated document snapshot changed before activation.", 422, "CITATION_DOCUMENT_ACTIVATION_INTEGRITY_MISMATCH");
      }
      const target = path.join(this.snapshotsRoot, candidate.sourceCommit);
      if (!isInside(this.snapshotsRoot, target)) throw new CitationDocumentUpdateError("Document activation target is unsafe.", 500, "CITATION_DOCUMENT_TARGET_INVALID");
      if (existsSync(target)) throw new CitationDocumentUpdateError("The target document snapshot already exists; installed snapshots are never overwritten.", 409, "CITATION_DOCUMENT_TARGET_EXISTS", { sourceCommit: candidate.sourceCommit });
      await rename(stagePath, target);
      const installedSnapshot = inspectSnapshotDirectorySync(target, { minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
      if (installedSnapshot.manifestSha256 !== candidate.validation.manifestSha256) {
        await rename(target, stagePath).catch(() => {});
        throw new CitationDocumentUpdateError("Installed document snapshot failed the final integrity check.", 422, "CITATION_DOCUMENT_ACTIVATION_INTEGRITY_MISMATCH");
      }
      const activatedAt = nowIso(this.clock);
      const previousPointer = current.pointer ? clone(current.pointer) : null;
      const pointer = {
        schemaVersion: POINTER_SCHEMA_VERSION,
        packageId: PACKAGE_ID,
        repository: OFFICIAL_REPOSITORY,
        activeCommit: candidate.sourceCommit,
        previousCommit: current.current?.sourceCommit || null,
        snapshotRelativePath: normalizeRelative(path.relative(this.packageRoot, target)),
        manifestSha256: candidate.validation.manifestSha256,
        activatedAt
      };
      try { await this.writePointer(pointer); }
      catch (error) {
        await rename(target, stagePath).catch(() => {});
        throw new CitationDocumentUpdateError("Document snapshot pointer could not be committed; previous snapshot remains active.", 500, "CITATION_DOCUMENT_ACTIVATION_COMMIT_FAILED", { cause: safeMessage(error) });
      }
      state.activations = [...(state.activations || []), { id: crypto.randomUUID(), action: "activate", at: activatedAt, fromCommit: current.current?.sourceCommit || null, toCommit: candidate.sourceCommit, candidateId: candidate.id }].slice(-100);
      candidate.lifecycle = "activated";
      candidate.activatedAt = activatedAt;
      candidate.stagedRelativePath = null;
      try { await this.writeState(state); }
      catch (error) {
        let recoveryError = null;
        try { await this.restorePointer(previousPointer); await rename(target, stagePath); }
        catch (recovery) { recoveryError = safeMessage(recovery); }
        throw new CitationDocumentUpdateError("Document snapshot state could not be committed after pointer activation.", 500, "CITATION_DOCUMENT_ACTIVATION_STATE_COMMIT_FAILED", { cause: safeMessage(error), recoveryError });
      }
      return this.status();
    });
  }

  async rollback({ targetCommit = "", expectedCurrentCommit = "", confirm = false } = {}) {
    if (confirm !== true) throw new CitationDocumentUpdateError("Explicit document snapshot rollback confirmation is required.", 422, "CITATION_DOCUMENT_CONFIRMATION_REQUIRED");
    return this.operation(async () => {
      await this.assertControlPathsSafe();
      const current = await this.status(); const activeCommit = String(current.current?.sourceCommit || "").toLowerCase();
      if (String(expectedCurrentCommit || "").toLowerCase() !== activeCommit) throw new CitationDocumentUpdateError("Active document snapshot changed since update status was loaded.", 409, "CITATION_DOCUMENT_ACTIVE_CONFLICT", { expected: expectedCurrentCommit || null, actual: activeCommit || null });
      const state = await this.readState();
      const previous = [...(state.activations || [])].reverse().find((item) => item.toCommit === activeCommit && item.fromCommit)?.fromCommit;
      const selectedCommit = String(targetCommit || previous || current.pointer?.previousCommit || "").toLowerCase();
      const target = current.installed.find((item) => item.verified && item.sourceCommit === selectedCommit);
      if (!target || selectedCommit === activeCommit) throw new CitationDocumentUpdateError("No verified earlier document snapshot is available for rollback.", 409, "CITATION_DOCUMENT_ROLLBACK_TARGET_UNAVAILABLE", { targetCommit: selectedCommit || null });
      const verifiedTarget = inspectSnapshotDirectorySync(target.documentRoot, { minimumDocumentCount: this.minimumDocumentCount, minimumMethodologyCount: this.minimumMethodologyCount });
      if (verifiedTarget.manifestSha256 !== target.manifestSha256) throw new CitationDocumentUpdateError("Rollback target changed after status was loaded.", 422, "CITATION_DOCUMENT_ROLLBACK_INTEGRITY_MISMATCH");
      const rolledBackAt = nowIso(this.clock);
      const previousPointer = current.pointer ? clone(current.pointer) : null;
      await this.writePointer({
        schemaVersion: POINTER_SCHEMA_VERSION,
        packageId: PACKAGE_ID,
        repository: OFFICIAL_REPOSITORY,
        activeCommit: target.sourceCommit,
        previousCommit: activeCommit,
        snapshotRelativePath: normalizeRelative(path.relative(this.packageRoot, target.documentRoot)),
        manifestSha256: target.manifestSha256,
        activatedAt: rolledBackAt
      });
      state.activations = [...(state.activations || []), { id: crypto.randomUUID(), action: "rollback", at: rolledBackAt, fromCommit: activeCommit, toCommit: target.sourceCommit, candidateId: null }].slice(-100);
      try { await this.writeState(state); }
      catch (error) {
        let recoveryError = null;
        try { await this.restorePointer(previousPointer); }
        catch (recovery) { recoveryError = safeMessage(recovery); }
        throw new CitationDocumentUpdateError("Document rollback state could not be committed after pointer change.", 500, "CITATION_DOCUMENT_ROLLBACK_STATE_COMMIT_FAILED", { cause: safeMessage(error), recoveryError });
      }
      return this.status();
    });
  }
}

export const CITATION_DOCUMENT_UPDATE_DEFAULTS = Object.freeze({
  packageId: PACKAGE_ID,
  officialRepository: OFFICIAL_REPOSITORY,
  officialApiRoot: OFFICIAL_API_ROOT,
  officialRawRoot: OFFICIAL_RAW_ROOT,
  packageRoot: DEFAULT_PACKAGE_ROOT,
  snapshotManifestName: SNAPSHOT_MANIFEST_NAME,
  requiredLicensePaths: REQUIRED_LICENSE_PATHS,
  snapshotFormat: SNAPSHOT_FORMAT
});

export default CitationDocumentUpdateStore;
