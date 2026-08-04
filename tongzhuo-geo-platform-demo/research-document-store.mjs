import crypto from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.join(moduleRoot, "research-packages", "geo-citation-lab", "2.0.1");
const OFFICIAL_REPOSITORY = "https://github.com/yaojingang/geo-citation-lab";
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_CORPUS_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_CHUNK_CHARACTERS = 1_200;
const DEFAULT_LIMITATIONS = Object.freeze([
  Object.freeze({
    code: "LEXICAL_DOCUMENT_RETRIEVAL",
    description: "Research-document search is deterministic lexical retrieval, not proof of semantic equivalence or applicability to a customer industry."
  }),
  Object.freeze({
    code: "VERSIONED_SNAPSHOT_ONLY",
    description: "Results describe the installed, pinned repository snapshot and do not represent the live upstream repository."
  }),
  Object.freeze({
    code: "DOCUMENTS_ARE_NOT_CITATION_OBSERVATIONS",
    description: "Repository documents provide methodology and data-contract context; citation counts and platform findings must come from the verified Citation Lab research database."
  })
]);
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git", ".github", "node_modules", "derived", "catalog", "curated", "records", "raw", "papers", "__pycache__"
]);
const EXCLUDED_FILE_NAMES = new Set([".citation-document-snapshot.json"]);
const MEDIA_TYPES = Object.freeze({
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
  ".json": "application/json"
});

export class ResearchDocumentError extends Error {
  constructor(message, code = "RESEARCH_DOCUMENT_ERROR", details = undefined) {
    super(message);
    this.name = "ResearchDocumentError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function stableHash(...values) {
  const hash = crypto.createHash("sha256");
  for (const value of values) hash.update(String(value), "utf8").update("\u001f", "utf8");
  return hash.digest("hex");
}

function fileSha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function gitBlobSha(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, "utf8"), bytes])).digest("hex");
}

function normalizeRepository(value) {
  return String(value || "").trim().replace(/\.git$/i, "").replace(/\/+$/, "").toLocaleLowerCase("en-US");
}

function normalizeCommit(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function normalizedRelativePath(value) {
  return String(value || "").split(path.sep).join("/").replace(/^\.\//, "");
}

function readJsonFile(filePath, label) {
  let value;
  try { value = JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")); }
  catch (error) {
    throw new ResearchDocumentError(`${label} is not valid JSON.`, "RESEARCH_DOCUMENT_MANIFEST_INVALID", {
      path: filePath,
      cause: error.message
    });
  }
  return value;
}

function finiteInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLocaleLowerCase("en-US");
    if (normalized.startsWith("#x") || normalized.startsWith("#")) {
      const radix = normalized.startsWith("#x") ? 16 : 10;
      const offset = normalized.startsWith("#x") ? 2 : 1;
      const codePoint = Number.parseInt(normalized.slice(offset), radix);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return named[normalized] ?? match;
  });
}

function htmlToText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => `\n${"#".repeat(Number(level))} ${content.replace(/<[^>]+>/g, " ")}\n`)
    .replace(/<\/(?:p|div|li|section|article|header|footer|table|tr|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

function normalizeContent(raw, mediaType) {
  let value = String(raw || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\0/g, "");
  if (mediaType === "text/html") value = htmlToText(value);
  if (mediaType === "application/json") {
    try { value = JSON.stringify(stableJson(JSON.parse(value)), null, 2); }
    catch { /* Invalid JSON is skipped by the caller with an explicit reason. */ }
  }
  return value.split("\n").map((line) => line.replace(/[\t ]+$/g, "")).join("\n").trim();
}

function stripInlineMarkup(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(raw, normalized, mediaType, relativePath) {
  if (mediaType === "text/html") {
    const match = String(raw).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
      || String(raw).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (match?.[1]) return stripInlineMarkup(match[1].replace(/<[^>]+>/g, " ")).slice(0, 240);
  }
  if (mediaType === "application/json") {
    try {
      const parsed = JSON.parse(String(raw).replace(/^\uFEFF/, ""));
      const title = parsed?.title || parsed?.name || parsed?.packageId || parsed?.dataset_version || parsed?.contract_version;
      if (title) return String(title).trim().slice(0, 240);
    } catch { /* handled by the caller */ }
  }
  const markdownHeading = normalized.match(/^\s*#{1,6}\s+(.+)$/m)?.[1];
  if (markdownHeading) return stripInlineMarkup(markdownHeading).slice(0, 240);
  const firstLine = normalized.split("\n").map(stripInlineMarkup).find(Boolean);
  if (firstLine && firstLine.length <= 160) return firstLine;
  return path.basename(relativePath, path.extname(relativePath)).replace(/[-_]+/g, " ").trim();
}

function documentCategory(relativePath) {
  const value = normalizedRelativePath(relativePath).toLocaleLowerCase("en-US");
  if (/(^|\/)(?:licenses?|legal)(\/|$)|(^|\/)(?:license|notice|copying)(?:[-_.\/]|$)/.test(value)) return "license";
  if (/(^|\/)(?:schema|schemas|contracts?)(\/|$)|(?:schema|contract)\.json$/.test(value)) return "data_contract";
  if (/(^|\/)(?:quality)(\/|$)|quality[_-]?report/.test(value)) return "quality_report";
  if (/(?:manifest|pins?|package(?:-lock)?)\.json$/.test(value)) return "package_metadata";
  return "methodology";
}

function supportedMediaType(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase("en-US");
  if (MEDIA_TYPES[extension]) return MEDIA_TYPES[extension];
  const name = path.basename(filePath).toLocaleLowerCase("en-US");
  if (/^(?:readme|license|notice|copying)(?:[-_.].*)?$/.test(name)) return "text/plain";
  return "";
}

function packedRefCommit(gitDirectory, refName) {
  const directPath = path.resolve(gitDirectory, refName);
  if (existsSync(directPath)) return normalizeCommit(readFileSync(directPath, "utf8"));
  const packedRefsPath = path.join(gitDirectory, "packed-refs");
  if (!existsSync(packedRefsPath)) return "";
  for (const line of readFileSync(packedRefsPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{40})\s+(.+)$/i);
    if (match?.[2] === refName) return normalizeCommit(match[1]);
  }
  return "";
}

function detectGitCommit(repositoryRoot) {
  try {
    const dotGit = path.join(repositoryRoot, ".git");
    if (!existsSync(dotGit)) return "";
    let gitDirectory = dotGit;
    if (statSync(dotGit).isFile()) {
      const match = readFileSync(dotGit, "utf8").match(/^gitdir:\s*(.+)$/im);
      if (!match) return "";
      gitDirectory = path.resolve(repositoryRoot, match[1].trim());
    }
    const head = readFileSync(path.join(gitDirectory, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return normalizeCommit(head);
    const refName = head.match(/^ref:\s*(.+)$/i)?.[1];
    return refName ? packedRefCommit(gitDirectory, refName) : "";
  } catch { return ""; }
}

function discoverFiles(root, options) {
  const found = [];
  const skipped = [];
  let totalBytes = 0;

  function visit(directory, depth) {
    if (depth > options.maximumDepth) {
      skipped.push({ path: normalizedRelativePath(path.relative(root, directory)), reason: "maximum_depth" });
      return;
    }
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizedRelativePath(path.relative(root, absolutePath));
      if (entry.isSymbolicLink()) {
        skipped.push({ path: relativePath, reason: "symbolic_link" });
        continue;
      }
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLocaleLowerCase("en-US"))) visit(absolutePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (EXCLUDED_FILE_NAMES.has(entry.name.toLocaleLowerCase("en-US"))) continue;
      const mediaType = supportedMediaType(absolutePath);
      if (!mediaType) continue;
      const sizeBytes = lstatSync(absolutePath).size;
      if (sizeBytes > options.maxFileBytes) {
        skipped.push({ path: relativePath, reason: "file_too_large", sizeBytes });
        continue;
      }
      if (totalBytes + sizeBytes > options.maxCorpusBytes) {
        skipped.push({ path: relativePath, reason: "corpus_size_limit", sizeBytes });
        continue;
      }
      found.push({ absolutePath, relativePath, mediaType, sizeBytes });
      totalBytes += sizeBytes;
    }
  }

  visit(root, 0);
  return { found, skipped, totalBytes };
}

function splitLongBlock(block, maximumCharacters) {
  if (block.text.length <= maximumCharacters) return [block];
  const pieces = [];
  for (let start = 0; start < block.text.length; start += maximumCharacters) {
    pieces.push({ ...block, text: block.text.slice(start, start + maximumCharacters) });
  }
  return pieces;
}

function chunkDocument(content, maximumCharacters) {
  const lines = content.split("\n");
  const blocks = [];
  let buffer = [];
  let startLine = 1;
  let heading = "";

  function flush(endLine) {
    const text = buffer.join("\n").trim();
    if (text) blocks.push({ text, startLine, endLine, heading });
    buffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^\s*#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush(index);
      heading = stripInlineMarkup(headingMatch[1]);
      startLine = index + 1;
      buffer.push(line);
      continue;
    }
    if (!line.trim()) {
      flush(index);
      startLine = index + 2;
      continue;
    }
    if (!buffer.length) startLine = index + 1;
    buffer.push(line);
  }
  flush(lines.length);

  const chunks = [];
  let current = null;
  for (const block of blocks.flatMap((item) => splitLongBlock(item, maximumCharacters))) {
    if (!current) {
      current = { ...block };
      continue;
    }
    if (current.text.length + 2 + block.text.length <= maximumCharacters && current.heading === block.heading) {
      current.text += `\n\n${block.text}`;
      current.endLine = block.endLine;
    } else {
      chunks.push(current);
      current = { ...block };
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function searchTokens(value) {
  const result = new Set();
  const segments = String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || [];
  for (const segment of segments) {
    if (/^[a-z0-9]+$/i.test(segment)) {
      if (segment.length > 1) result.add(segment);
      continue;
    }
    if (segment.length <= 12) result.add(segment);
    for (const character of segment) result.add(character);
    for (let index = 0; index < segment.length - 1; index += 1) result.add(segment.slice(index, index + 2));
    for (let index = 0; index < segment.length - 2; index += 1) result.add(segment.slice(index, index + 3));
  }
  return result;
}

function searchNormalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "");
}

function tokenWeight(token) {
  if (/^[a-z0-9]+$/i.test(token)) return Math.min(3, 1 + token.length / 8);
  return token.length >= 3 ? 2.2 : token.length === 2 ? 1.4 : 0.35;
}

function intersectionWeight(queryTokens, contentTokens) {
  let matched = 0;
  let total = 0;
  for (const token of queryTokens) {
    const weight = tokenWeight(token);
    total += weight;
    if (contentTokens.has(token)) matched += weight;
  }
  return total ? matched / total : 0;
}

function roundScore(value) {
  return Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 10_000) / 10_000;
}

function resultSnippet(content, queryTokens, maximumCharacters = 360) {
  const compact = String(content || "").replace(/\s+/g, " ").trim();
  if (compact.length <= maximumCharacters) return compact;
  const candidates = [...queryTokens].filter((token) => token.length >= 2).sort((left, right) => right.length - left.length);
  const lower = compact.toLocaleLowerCase("zh-CN");
  let matchIndex = -1;
  for (const token of candidates) {
    matchIndex = lower.indexOf(token.toLocaleLowerCase("zh-CN"));
    if (matchIndex >= 0) break;
  }
  const start = Math.max(0, matchIndex < 0 ? 0 : matchIndex - Math.floor(maximumCharacters * 0.3));
  const end = Math.min(compact.length, start + maximumCharacters);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end).trim()}${end < compact.length ? "…" : ""}`;
}

function sourceUrl(repository, commit, sourcePath) {
  if (!repository || !commit || !sourcePath) return "";
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  return `${String(repository).replace(/\/+$/, "")}/blob/${commit}/${encodedPath}`;
}

function verifyIndependentRepositorySnapshot(documentRoot, mirrorCommit, verification, expectedRepository) {
  const root = path.resolve(documentRoot);
  const declaredRoot = path.resolve(String(verification?.documentRoot || ""));
  if (verification?.verified !== true || declaredRoot !== root) {
    throw new ResearchDocumentError("Independent Citation Lab document snapshot is not bound to the configured document root.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { documentRoot: root, declaredRoot });
  }
  const rootInfo = lstatSync(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new ResearchDocumentError("Independent Citation Lab document root is not a regular directory.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { documentRoot: root });
  const manifestPath = path.join(root, ".citation-document-snapshot.json");
  const manifestInfo = lstatSync(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink()) throw new ResearchDocumentError("Independent Citation Lab snapshot manifest is not a regular file.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { manifestPath });
  const manifestBytes = readFileSync(manifestPath);
  const manifestDigest = fileSha256(manifestBytes);
  if (!/^[a-f0-9]{64}$/i.test(String(verification?.manifestSha256 || "")) || manifestDigest !== String(verification.manifestSha256).toLowerCase()) {
    throw new ResearchDocumentError("Independent Citation Lab snapshot manifest hash does not match the verified record.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { manifestPath });
  }
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")); }
  catch { throw new ResearchDocumentError("Independent Citation Lab snapshot manifest is invalid JSON.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { manifestPath }); }
  if (manifest?.format !== "tongzhuo-citation-document-snapshot-v1"
    || manifest?.schemaVersion !== 1
    || normalizeCommit(manifest?.sourceCommit) !== mirrorCommit
    || normalizeRepository(manifest?.repository) !== normalizeRepository(expectedRepository)
    || normalizeCommit(verification?.sourceCommit) !== mirrorCommit
    || normalizeRepository(verification?.repository || verification?.sourceRepository) !== normalizeRepository(expectedRepository)
    || !Array.isArray(manifest?.files)
    || !manifest.files.length) {
    throw new ResearchDocumentError("Independent Citation Lab snapshot provenance is incomplete or inconsistent.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { manifestPath });
  }
  const declared = new Set();
  for (const file of manifest.files) {
    const relativePath = normalizedRelativePath(file?.path);
    const segments = relativePath.split("/");
    if (!relativePath || relativePath.startsWith("/") || String(file?.path || "").includes("\\") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new ResearchDocumentError("Independent Citation Lab snapshot contains an unsafe path.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { path: file?.path });
    }
    if (declared.has(relativePath)) throw new ResearchDocumentError("Independent Citation Lab snapshot contains a duplicate path.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { path: relativePath });
    declared.add(relativePath);
    const filePath = path.resolve(root, ...segments);
    const relativeToRoot = path.relative(root, filePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) throw new ResearchDocumentError("Independent Citation Lab snapshot path escaped its root.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { path: relativePath });
    const info = lstatSync(filePath);
    if (!info.isFile() || info.isSymbolicLink()) throw new ResearchDocumentError("Independent Citation Lab snapshot contains a non-regular file.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { path: relativePath });
    const bytes = readFileSync(filePath);
    if (bytes.length !== Number(file?.sizeBytes)
      || fileSha256(bytes) !== String(file?.sha256 || "").toLowerCase()
      || gitBlobSha(bytes) !== String(file?.gitBlobSha || "").toLowerCase()) {
      throw new ResearchDocumentError("Independent Citation Lab snapshot file integrity check failed.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { path: relativePath });
    }
  }
  const discovery = discoverFiles(root, { maximumDepth: 64, maxFileBytes: 64 * 1024 * 1024, maxCorpusBytes: 512 * 1024 * 1024 });
  const actual = new Set(discovery.found.map((item) => item.relativePath));
  if (actual.size !== declared.size || [...actual].some((item) => !declared.has(item))) {
    throw new ResearchDocumentError("Independent Citation Lab snapshot inventory does not match its verified manifest.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { actual: [...actual], declared: [...declared] });
  }
}

function countBy(items, keySelector) {
  const counts = {};
  for (const item of items) {
    const key = String(keySelector(item));
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")));
}

export class ResearchDocumentStore {
  constructor(options = {}) {
    this.packageRoot = path.resolve(options.packageRoot || process.env.TZ_CITATION_RESEARCH_PACKAGE_ROOT || DEFAULT_PACKAGE_ROOT);
    this.manifestPath = path.resolve(options.manifestPath || path.join(this.packageRoot, "manifest.json"));
    if (!existsSync(this.packageRoot) || !statSync(this.packageRoot).isDirectory()) {
      throw new ResearchDocumentError("Citation Lab research package is not installed.", "RESEARCH_DOCUMENT_PACKAGE_NOT_INSTALLED", { packageRoot: this.packageRoot });
    }
    if (!existsSync(this.manifestPath)) {
      throw new ResearchDocumentError("Citation Lab package manifest is missing.", "RESEARCH_DOCUMENT_MANIFEST_MISSING", { manifestPath: this.manifestPath });
    }

    this.manifest = readJsonFile(this.manifestPath, "Citation Lab package manifest");
    this.validateManifest(options);
    this.repositoryMirrorPath = String(options.repositoryMirrorPath || process.env.TZ_CITATION_RESEARCH_REPOSITORY_MIRROR || "").trim();
    this.documentRoot = path.resolve(this.repositoryMirrorPath || this.packageRoot);
    if (!existsSync(this.documentRoot) || !statSync(this.documentRoot).isDirectory()) {
      throw new ResearchDocumentError("Configured Citation Lab document root is unavailable.", "RESEARCH_DOCUMENT_ROOT_NOT_FOUND", { documentRoot: this.documentRoot });
    }

    const declaredMirrorCommit = normalizeCommit(options.repositoryMirrorCommit || process.env.TZ_CITATION_RESEARCH_REPOSITORY_COMMIT || "");
    const detectedMirrorCommit = this.repositoryMirrorPath ? detectGitCommit(this.documentRoot) : "";
    const mirrorCommit = declaredMirrorCommit || detectedMirrorCommit;
    this.datasetSourceCommit = this.sourceCommit;
    const independent = mirrorCommit && mirrorCommit !== this.datasetSourceCommit;
    if (independent && options.allowIndependentRepositorySnapshot !== true) {
      throw new ResearchDocumentError("Configured Citation Lab mirror does not match the pinned source commit.", "RESEARCH_DOCUMENT_COMMIT_MISMATCH", {
        expected: this.datasetSourceCommit,
        actual: mirrorCommit,
        documentRoot: this.documentRoot
      });
    }
    const snapshotVerification = options.independentRepositorySnapshot;
    const verifiedSnapshot = Boolean(this.repositoryMirrorPath && mirrorCommit && snapshotVerification?.verified === true);
    if (verifiedSnapshot) verifyIndependentRepositorySnapshot(this.documentRoot, mirrorCommit, snapshotVerification, OFFICIAL_REPOSITORY);
    else if (independent) throw new ResearchDocumentError("Independent Citation Lab document snapshot is not verified.", "RESEARCH_DOCUMENT_INDEPENDENT_SNAPSHOT_UNVERIFIED", { expectedCommit: mirrorCommit });
    this.sourceCommit = mirrorCommit || this.datasetSourceCommit;
    this.independentRepositorySnapshot = Boolean(independent);
    this.provenanceStatus = this.repositoryMirrorPath
      ? verifiedSnapshot
        ? independent ? "verified_independent_snapshot" : "verified_document_snapshot"
        : detectedMirrorCommit && detectedMirrorCommit === mirrorCommit
          ? "verified_mirror_commit"
          : mirrorCommit
            ? "declared_mirror_commit"
            : "unverified_mirror_commit"
      : "verified_package_snapshot";
    this.maxFileBytes = finiteInteger(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES, 256, 64 * 1024 * 1024);
    this.maxCorpusBytes = finiteInteger(options.maxCorpusBytes, DEFAULT_MAX_CORPUS_BYTES, this.maxFileBytes, 512 * 1024 * 1024);
    this.maxChunkCharacters = finiteInteger(options.maxChunkCharacters, DEFAULT_MAX_CHUNK_CHARACTERS, 300, 8_000);
    this.maximumDepth = finiteInteger(options.maximumDepth, 16, 1, 64);
    this.closed = false;
    this.documents = [];
    this.chunks = [];
    this.skippedFiles = [];
    this.indexDocuments();
  }

  validateManifest(options) {
    const packageId = String(this.manifest?.packageId || "").trim();
    const datasetVersion = String(this.manifest?.datasetVersion || "").trim();
    const sourceCommit = normalizeCommit(this.manifest?.sourceCommit);
    const repository = String(this.manifest?.repo || "").trim();
    if (!packageId || !datasetVersion || !/^[0-9a-f]{40}$/.test(sourceCommit) || !repository) {
      throw new ResearchDocumentError("Citation Lab package provenance is incomplete.", "RESEARCH_DOCUMENT_PROVENANCE_MISSING", {
        packageId,
        datasetVersion,
        sourceCommit,
        repository
      });
    }
    const expectedRepository = String(options.expectedRepository || OFFICIAL_REPOSITORY);
    if (normalizeRepository(repository) !== normalizeRepository(expectedRepository)) {
      throw new ResearchDocumentError("Citation Lab package repository is not the configured official source.", "RESEARCH_DOCUMENT_REPOSITORY_MISMATCH", {
        expected: expectedRepository,
        actual: repository
      });
    }
    if (options.expectedDatasetVersion && String(options.expectedDatasetVersion) !== datasetVersion) {
      throw new ResearchDocumentError("Citation Lab document version does not match the requested package version.", "RESEARCH_DOCUMENT_VERSION_MISMATCH", {
        expected: String(options.expectedDatasetVersion),
        actual: datasetVersion
      });
    }
    if (options.expectedSourceCommit && normalizeCommit(options.expectedSourceCommit) !== sourceCommit) {
      throw new ResearchDocumentError("Citation Lab document commit does not match the requested source commit.", "RESEARCH_DOCUMENT_COMMIT_MISMATCH", {
        expected: normalizeCommit(options.expectedSourceCommit),
        actual: sourceCommit
      });
    }
    this.packageId = packageId;
    this.datasetVersion = datasetVersion;
    this.releaseDate = String(this.manifest?.releasedAt || "").trim();
    this.sourceCommit = sourceCommit;
    this.sourceRepository = repository.replace(/\/+$/, "");
  }

  indexDocuments() {
    const discovery = discoverFiles(this.documentRoot, {
      maximumDepth: this.maximumDepth,
      maxFileBytes: this.maxFileBytes,
      maxCorpusBytes: this.maxCorpusBytes
    });
    this.skippedFiles = discovery.skipped;

    for (const file of discovery.found) {
      let raw;
      try { raw = readFileSync(file.absolutePath, "utf8"); }
      catch (error) {
        this.skippedFiles.push({ path: file.relativePath, reason: "read_failed", message: error.message });
        continue;
      }
      if (file.mediaType === "application/json") {
        try { JSON.parse(raw.replace(/^\uFEFF/, "")); }
        catch (error) {
          this.skippedFiles.push({ path: file.relativePath, reason: "invalid_json", message: error.message });
          continue;
        }
      }
      const content = normalizeContent(raw, file.mediaType);
      if (!content) {
        this.skippedFiles.push({ path: file.relativePath, reason: "empty_document" });
        continue;
      }
      const category = documentCategory(file.relativePath);
      const contentHash = stableHash(content);
      const sourcePath = this.repositoryMirrorPath
        ? file.relativePath
        : file.relativePath.startsWith("upstream/") ? file.relativePath.slice("upstream/".length) : "";
      const documentId = `RDL-DOC-${stableHash(this.packageId, this.datasetVersion, this.sourceCommit, file.relativePath, contentHash).slice(0, 24)}`;
      const document = {
        documentId,
        path: file.relativePath,
        sourcePath,
        sourceUrl: sourceUrl(this.sourceRepository, this.sourceCommit, sourcePath),
        title: deriveTitle(raw, content, file.mediaType, file.relativePath),
        mediaType: file.mediaType,
        category,
        sizeBytes: file.sizeBytes,
        contentHash,
        chunkCount: 0
      };
      const chunks = chunkDocument(content, this.maxChunkCharacters);
      for (const [ordinal, item] of chunks.entries()) {
        const chunkHash = stableHash(item.text);
        const evidenceId = `RDL-${stableHash(this.packageId, this.datasetVersion, this.sourceCommit, file.relativePath, contentHash, ordinal, chunkHash).slice(0, 24)}`;
        this.chunks.push({
          evidenceId,
          chunkId: `RDL-CHK-${stableHash(documentId, ordinal, chunkHash).slice(0, 24)}`,
          documentId,
          ordinal,
          heading: item.heading,
          startLine: item.startLine,
          endLine: item.endLine,
          content: item.text,
          normalizedContent: searchNormalized(item.text),
          tokens: searchTokens(`${document.title}\n${item.heading}\n${item.text}`),
          titleTokens: searchTokens(`${document.title}\n${item.heading}`),
          document
        });
      }
      document.chunkCount = chunks.length;
      this.documents.push(document);
    }
    this.documents.sort((left, right) => left.path.localeCompare(right.path, "en"));
    this.chunks.sort((left, right) => left.document.path.localeCompare(right.document.path, "en") || left.ordinal - right.ordinal);
  }

  ensureOpen() {
    if (this.closed) throw new ResearchDocumentError("Research document store is closed.", "RESEARCH_DOCUMENT_STORE_CLOSED");
  }

  limitations() {
    const limitations = DEFAULT_LIMITATIONS.map((item) => ({ ...item }));
    const knownCodes = new Set(limitations.map((item) => item.code));
    for (const item of Array.isArray(this.manifest?.limitations) ? this.manifest.limitations : []) {
      const code = String(item?.code || "").trim();
      const description = String(item?.description || "").trim();
      if (!code || !description || knownCodes.has(code)) continue;
      limitations.push({ code, description });
      knownCodes.add(code);
    }
    const methodologyCount = this.documents.filter((item) => item.category === "methodology").length;
    if (!methodologyCount) limitations.push({
      code: "METHODOLOGY_DOCUMENTS_UNAVAILABLE",
      description: "The installed snapshot contains no narrative methodology/report document in the supported formats; only technical metadata, contracts, quality records or license notices can be retrieved."
    });
    if (this.provenanceStatus === "unverified_mirror_commit") limitations.push({
      code: "MIRROR_COMMIT_UNVERIFIED",
      description: "The configured repository mirror has no readable Git commit metadata; documents are attributed to the package pin but mirror provenance is not independently verified."
    });
    if (this.provenanceStatus === "declared_mirror_commit") limitations.push({
      code: "MIRROR_COMMIT_DECLARED_ONLY",
      description: "The repository mirror commit was supplied by configuration but the directory has neither Git metadata nor a verified document-snapshot manifest."
    });
    if (this.independentRepositorySnapshot) limitations.push({
      code: "DOCUMENT_DATASET_COMMIT_DIFFER",
      description: `Research documents are pinned to repository commit ${this.sourceCommit}, while structured Citation Lab data remains pinned to ${this.datasetSourceCommit}. Document statements do not change the statistical dataset version.`
    });
    if (this.skippedFiles.length) limitations.push({
      code: "DOCUMENTS_SKIPPED",
      description: `${this.skippedFiles.length} candidate document(s) were skipped because of safety limits, invalid content, symbolic links or read failures.`
    });
    return limitations;
  }

  summary() {
    this.ensureOpen();
    const methodologyDocuments = this.documents.filter((item) => item.category === "methodology").length;
    const state = !this.documents.length ? "empty" : methodologyDocuments ? "ready" : "limited";
    return {
      ok: state !== "empty",
      state,
      readOnly: true,
      indexKind: "deterministic_memory_lexical",
      package: {
        id: this.packageId,
        datasetVersion: this.datasetVersion,
        releaseDate: this.releaseDate,
        sourceCommit: this.sourceCommit,
        datasetSourceCommit: this.datasetSourceCommit,
        independentRepositorySnapshot: this.independentRepositorySnapshot,
        sourceRepository: this.sourceRepository
      },
      source: {
        kind: this.repositoryMirrorPath ? "official_repository_mirror" : "installed_research_package",
        documentRoot: this.documentRoot,
        provenanceStatus: this.provenanceStatus
      },
      counts: {
        documents: this.documents.length,
        methodologyDocuments,
        chunks: this.chunks.length,
        indexedBytes: this.documents.reduce((sum, item) => sum + item.sizeBytes, 0),
        skippedFiles: this.skippedFiles.length
      },
      categories: countBy(this.documents, (item) => item.category),
      mediaTypes: countBy(this.documents, (item) => item.mediaType),
      supportedFormats: [...new Set([...Object.values(MEDIA_TYPES), "text/plain"])].sort(),
      skippedFiles: this.skippedFiles.map((item) => ({ ...item })),
      limitations: this.limitations()
    };
  }

  health() {
    const summary = this.summary();
    return { ...summary, readyForMethodologyRag: summary.state === "ready" };
  }

  search(request = {}) {
    this.ensureOpen();
    const input = typeof request === "string" ? { query: request } : request || {};
    const query = String(input.query || input.text || "").trim();
    if (!query) throw new ResearchDocumentError("A research-document query is required.", "RESEARCH_DOCUMENT_QUERY_REQUIRED");
    if (query.length > 2_000) throw new ResearchDocumentError("Research-document query exceeds 2000 characters.", "RESEARCH_DOCUMENT_QUERY_TOO_LONG");
    const limit = finiteInteger(input.limit || input.topK, 8, 1, 30);
    const minimumScore = Math.max(0, Math.min(1, Number(input.minimumScore ?? input.minScore ?? 0.1)));
    const categories = Array.isArray(input.categories) && input.categories.length
      ? new Set(input.categories.map((item) => String(item)))
      : null;
    const queryTokens = searchTokens(query);
    const normalizedQuery = searchNormalized(query);
    const scored = [];

    for (const chunk of this.chunks) {
      if (categories && !categories.has(chunk.document.category)) continue;
      const contentCoverage = intersectionWeight(queryTokens, chunk.tokens);
      const titleCoverage = intersectionWeight(queryTokens, chunk.titleTokens);
      const phraseMatch = normalizedQuery.length >= 2 && chunk.normalizedContent.includes(normalizedQuery) ? 1 : 0;
      const score = roundScore(contentCoverage * 0.72 + titleCoverage * 0.18 + phraseMatch * 0.10);
      if (score < minimumScore) continue;
      const itemLimitations = this.limitations();
      if (chunk.document.category !== "methodology") itemLimitations.push({
        code: "TECHNICAL_CONTEXT_ONLY",
        description: "This evidence is technical/package context rather than a narrative methodology or research report."
      });
      scored.push({
        evidenceId: chunk.evidenceId,
        documentId: chunk.documentId,
        chunkId: chunk.chunkId,
        score,
        path: chunk.document.path,
        sourcePath: chunk.document.sourcePath,
        sourceUrl: chunk.document.sourceUrl,
        title: chunk.document.title,
        category: chunk.document.category,
        mediaType: chunk.document.mediaType,
        snippet: resultSnippet(chunk.content, queryTokens, finiteInteger(input.snippetCharacters, 360, 120, 1_200)),
        locator: {
          chunkOrdinal: chunk.ordinal,
          heading: chunk.heading,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        },
        provenance: {
          packageId: this.packageId,
          datasetVersion: this.datasetVersion,
          releaseDate: this.releaseDate,
          sourceCommit: this.sourceCommit,
          datasetSourceCommit: this.datasetSourceCommit,
          independentRepositorySnapshot: this.independentRepositorySnapshot,
          sourceRepository: this.sourceRepository,
          contentHash: chunk.document.contentHash,
          provenanceStatus: this.provenanceStatus
        },
        limitations: itemLimitations
      });
    }

    scored.sort((left, right) => right.score - left.score
      || left.path.localeCompare(right.path, "en")
      || left.locator.chunkOrdinal - right.locator.chunkOrdinal);
    const summary = this.summary();
    return {
      query,
      results: scored.slice(0, limit),
      resultCount: Math.min(scored.length, limit),
      totalMatchedChunks: scored.length,
      index: {
        state: summary.state,
        indexKind: summary.indexKind,
        documentCount: summary.counts.documents,
        methodologyDocumentCount: summary.counts.methodologyDocuments,
        chunkCount: summary.counts.chunks
      },
      package: summary.package,
      retrievalScope: {
        categories: categories ? [...categories].sort() : "all",
        minimumScore,
        deterministic: true,
        fabricatedFallbackResults: false
      },
      limitations: summary.limitations
    };
  }

  close() {
    if (this.closed) return;
    this.documents = [];
    this.chunks = [];
    this.skippedFiles = [];
    this.closed = true;
  }
}

export const RESEARCH_DOCUMENT_DEFAULTS = Object.freeze({
  packageRoot: DEFAULT_PACKAGE_ROOT,
  sourceRepository: OFFICIAL_REPOSITORY,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  maxCorpusBytes: DEFAULT_MAX_CORPUS_BYTES,
  maxChunkCharacters: DEFAULT_MAX_CHUNK_CHARACTERS,
  limitations: DEFAULT_LIMITATIONS
});

export default ResearchDocumentStore;
