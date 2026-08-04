import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { backup, DatabaseSync } from "node:sqlite";
import { productionConfig } from "../production-config.mjs";

export const PRIVATE_BACKUP_FORMAT = "tongzhuo-private-backup-v2";
const LEGACY_BACKUP_FORMAT = "tongzhuo-private-backup-v1";
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COMPONENTS = Object.freeze({
  database: { kind: "file", archivePath: "payload/database/tongzhuo-production.sqlite", required: true, restoreAbsence: false },
  dataMasterKey: { kind: "file", archivePath: "payload/secrets/data-master.key", required: false, restoreAbsence: false },
  aiMasterKey: { kind: "file", archivePath: "payload/secrets/ai-master.key", required: false, restoreAbsence: false },
  aiProviders: { kind: "file", archivePath: "payload/state/ai-providers.json", required: false, restoreAbsence: true },
  publisherState: { kind: "file", archivePath: "payload/state/publisher-state.json", required: false, restoreAbsence: true },
  aiGenerationRuns: { kind: "file", archivePath: "payload/state/ai-generation-runs.json", required: false, restoreAbsence: true },
  legacyEncryptionKey: { kind: "file", archivePath: "payload/secrets/legacy.encryption-key", required: false, restoreAbsence: true },
  knowledgeAssets: { kind: "directory", archiveRoot: "payload/knowledge-assets", required: false, restoreAbsence: false },
  siteStatic: { kind: "directory", archiveRoot: "payload/site-static", required: false, restoreAbsence: false },
  deploymentConfig: { kind: "directory", archiveRoot: "payload/deployment-config", required: false, restoreAbsence: false },
  releaseMetadata: { kind: "file", archivePath: "metadata/version.json", required: true, restoreAbsence: false, referenceOnly: true }
});

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupId(prefix = "backup") {
  return `${prefix}-${timestamp()}-${crypto.randomBytes(4).toString("hex")}`;
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertNotFilesystemRoot(target, label) {
  const resolved = path.resolve(target);
  if (resolved === path.parse(resolved).root) throw new Error(`${label} 不能指向文件系统根目录。`);
}

function asArchivePath(value, label = "备份路径") {
  const raw = String(value || "");
  if (!raw || raw.includes("\0") || raw.includes("\\") || path.posix.isAbsolute(raw)) {
    throw new Error(`${label}不是安全的相对路径。`);
  }
  const normalized = path.posix.normalize(raw);
  const segments = raw.split("/");
  if (normalized !== raw || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`${label}包含路径穿越或无效片段。`);
  }
  return raw;
}

function relativeArchivePath(root, filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join("/");
  return asArchivePath(relative, "源文件相对路径");
}

async function exists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function regularFileOrMissing(filePath, label) {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) throw new Error(`${label}不能是符号链接：${filePath}`);
    if (!info.isFile()) throw new Error(`${label}必须是普通文件：${filePath}`);
    return info;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  await new Promise((resolve, reject) => {
    const input = createReadStream(filePath);
    input.on("data", (chunk) => { bytes += chunk.length; hash.update(chunk); });
    input.once("error", reject);
    input.once("end", resolve);
  });
  return { sha256: hash.digest("hex"), bytes };
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decodeMasterKey(value) {
  const material = String(value || "").trim();
  if (!material) return null;
  let decoded = null;
  if (/^[A-Fa-f0-9]{64}$/.test(material)) decoded = Buffer.from(material, "hex");
  else if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(material)) {
    decoded = Buffer.from(material.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  }
  if (!decoded || decoded.length !== 32) throw new Error("TZ_MASTER_KEY 必须是 32 字节密钥的 Base64/Base64URL 或 64 位十六进制表示。");
  return decoded;
}

function masterKeyFingerprint(key) {
  return `sha256:${crypto.createHash("sha256").update(key).digest("hex")}`;
}

function resolveMaybeRelative(value, base) {
  if (!String(value || "").trim()) return "";
  return path.resolve(path.isAbsolute(value) ? value : path.join(base, value));
}

export function resolveBackupLayout(options = {}) {
  const env = options.env || process.env;
  const config = options.config || productionConfig;
  const projectRoot = path.resolve(options.projectRoot || moduleRoot);
  const dataDir = path.resolve(config.dataDir || env.TZ_DATA_DIR || path.join(projectRoot, "data"));
  const aiProviderDataDir = path.resolve(env.TZ_AI_PROVIDER_DATA_DIR || dataDir);
  const publisherDataDir = path.resolve(env.TZ_PUBLISHER_DATA_DIR || dataDir);
  const aiGenerationDataDir = path.resolve(env.TZ_AI_GENERATION_DATA_DIR || dataDir);
  const deploymentConfigDir = path.resolve(env.TZ_DEPLOY_CONFIG_DIR || path.join(projectRoot, "deploy"));
  const staticRuntimePath = String(env.TZ_SITE_STATIC_ROOT || "").trim();
  const staticHostPath = String(env.TZ_SITE_STATIC_HOST_PATH || "").trim();
  const siteStaticDir = staticRuntimePath
    ? resolveMaybeRelative(staticRuntimePath, projectRoot)
    : staticHostPath
      ? resolveMaybeRelative(staticHostPath, deploymentConfigDir)
      : path.resolve(projectRoot, "..", "demo-company-homepage");
  return Object.freeze({
    env,
    projectRoot,
    dataDir,
    databasePath: path.resolve(config.databasePath || env.TZ_DATABASE_PATH || path.join(dataDir, "tongzhuo-production.sqlite")),
    backupDir: path.resolve(config.backupDir || env.TZ_BACKUP_DIR || path.join(dataDir, "backups")),
    aiProviderDataDir,
    publisherDataDir,
    aiGenerationDataDir,
    dataMasterKeyPath: path.join(dataDir, "secrets", "master.key"),
    aiMasterKeyPath: path.join(aiProviderDataDir, "secrets", "master.key"),
    aiProvidersPath: path.join(aiProviderDataDir, "ai-providers.json"),
    publisherStatePath: path.join(publisherDataDir, "publisher-state.json"),
    aiGenerationRunsPath: path.join(aiGenerationDataDir, "ai-generation-runs.json"),
    legacyEncryptionKeyPath: path.join(aiProviderDataDir, ".encryption-key"),
    knowledgeAssetDir: path.resolve(env.TZ_KNOWLEDGE_ASSET_ROOT || path.join(dataDir, "knowledge-assets")),
    siteStaticDir,
    deploymentConfigDir
  });
}

function sourcePathForComponent(layout, componentId) {
  const paths = {
    database: layout.databasePath,
    dataMasterKey: layout.dataMasterKeyPath,
    aiMasterKey: layout.aiMasterKeyPath,
    aiProviders: layout.aiProvidersPath,
    publisherState: layout.publisherStatePath,
    aiGenerationRuns: layout.aiGenerationRunsPath,
    legacyEncryptionKey: layout.legacyEncryptionKeyPath,
    knowledgeAssets: layout.knowledgeAssetDir,
    siteStatic: layout.siteStaticDir,
    deploymentConfig: layout.deploymentConfigDir
  };
  return paths[componentId] || "";
}

async function copyCapturedFile(source, archiveTarget, options = {}) {
  const info = await regularFileOrMissing(source, options.label || "备份源文件");
  if (!info) return { present: false, required: Boolean(options.required), restoreAbsence: Boolean(options.restoreAbsence) };
  if (Number.isSafeInteger(options.expectedBytes) && info.size !== options.expectedBytes) {
    throw new Error(`${options.label || "备份源文件"}必须正好为 ${options.expectedBytes} 字节。`);
  }
  await mkdir(path.dirname(archiveTarget), { recursive: true, mode: 0o700 });
  await copyFile(source, archiveTarget);
  if (options.privateMode) await chmod(archiveTarget, 0o600).catch(() => {});
  const digest = await sha256File(archiveTarget);
  return {
    kind: "file",
    present: true,
    required: Boolean(options.required),
    restoreAbsence: Boolean(options.restoreAbsence),
    file: options.archivePath,
    sha256: digest.sha256,
    bytes: digest.bytes,
    mode: options.privateMode ? 0o600 : (info.mode & 0o777)
  };
}

function deploymentPathPolicy(relative, isDirectory) {
  const parts = relative.split("/");
  const base = parts.at(-1) || "";
  const lower = base.toLowerCase();
  if (parts.some((part) => [".git", "backups", "certs", "node_modules", "secrets"].includes(part.toLowerCase()))) return false;
  if (isDirectory) return true;
  if (lower === "cutover.env") return true;
  if (lower === ".env" || (lower.startsWith(".env.") && !lower.endsWith(".example"))) return false;
  if (/\.(key|pem|p12|pfx|crt)$/i.test(lower)) return false;
  return /^dockerfile(?:\..+)?$/i.test(base) || /\.(ya?ml|conf|json|toml|ini|example)$/i.test(lower);
}

async function walkDirectory(root, options = {}, current = root, result = { files: [], directories: [], excluded: [] }) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = relativeArchivePath(root, absolute);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`备份目录中不允许符号链接：${absolute}`);
    if (entry.isDirectory()) {
      if (options.include && !options.include(relative, true)) { result.excluded.push(relative); continue; }
      result.directories.push(relative);
      await walkDirectory(root, options, absolute, result);
      continue;
    }
    if (!entry.isFile()) throw new Error(`备份目录中发现不受支持的特殊文件：${absolute}`);
    if (options.include && !options.include(relative, false)) { result.excluded.push(relative); continue; }
    result.files.push({ absolute, relative, mode: info.mode & 0o777 });
  }
  return result;
}

async function captureDirectory(source, archiveRootPath, archiveRoot, options = {}) {
  let info;
  try {
    info = await lstat(source);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { kind: "directory", present: false, required: Boolean(options.required), restoreAbsence: false, unavailableReason: "source-not-found" };
    }
    throw error;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${options.label || "备份源目录"}必须是普通目录且不能是符号链接：${source}`);
  if (isInside(source, options.backupTarget)) throw new Error(`备份目标不能位于${options.label || "源目录"}内部。`);
  const walked = await walkDirectory(source, { include: options.include });
  const files = [];
  await mkdir(archiveRootPath, { recursive: true, mode: 0o700 });
  for (const directory of walked.directories) await mkdir(path.join(archiveRootPath, ...directory.split("/")), { recursive: true });
  for (const file of walked.files) {
    const destination = path.join(archiveRootPath, ...file.relative.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(file.absolute, destination);
    const digest = await sha256File(destination);
    files.push({ path: file.relative, sha256: digest.sha256, bytes: digest.bytes, mode: file.mode });
  }
  return {
    kind: "directory",
    present: true,
    required: Boolean(options.required),
    restoreAbsence: false,
    root: archiveRoot,
    files,
    directories: walked.directories,
    excluded: walked.excluded
  };
}

async function sqliteMetadata(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database.prepare("PRAGMA quick_check").all();
    const values = rows.map((row) => String(Object.values(row)[0] || ""));
    if (values.length !== 1 || values[0].toLowerCase() !== "ok") throw new Error(`SQLite quick_check 失败：${values.join("；") || "未知错误"}`);
    let migrationVersion = null;
    try {
      migrationVersion = Number(database.prepare("SELECT MAX(version) AS version FROM migrations").get()?.version || 0);
    } catch {
      migrationVersion = null;
    }
    return { quickCheck: "ok", migrationVersion };
  } finally {
    database.close();
  }
}

async function createDatabaseSnapshot(source, target) {
  const sourceInfo = await regularFileOrMissing(source, "生产数据库");
  if (!sourceInfo) throw new Error(`生产数据库不存在：${source}`);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, target);
  } finally {
    database.close();
  }
  await chmod(target, 0o600).catch(() => {});
  const integrity = await sqliteMetadata(target);
  const digest = await sha256File(target);
  return { kind: "file", present: true, required: true, restoreAbsence: false, file: COMPONENTS.database.archivePath, sha256: digest.sha256, bytes: digest.bytes, mode: 0o600, sqlite: integrity };
}

async function packageMetadata(layout, databaseComponent, purpose) {
  let packageJson = {};
  let packageLock = null;
  try { packageJson = JSON.parse(await readFile(path.join(layout.projectRoot, "package.json"), "utf8")); } catch {}
  try { packageLock = await sha256File(path.join(layout.projectRoot, "package-lock.json")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  return {
    schemaVersion: 1,
    backupFormat: PRIVATE_BACKUP_FORMAT,
    purpose,
    application: {
      name: String(packageJson.name || "tongzhuo-geo-platform"),
      version: String(packageJson.version || "unknown"),
      releaseRevision: String(layout.env.TZ_RELEASE_REVISION || layout.env.GIT_COMMIT || "").slice(0, 200) || null,
      imageReference: String(layout.env.TZ_RELEASE_IMAGE || "").slice(0, 500) || null
    },
    database: databaseComponent.sqlite,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    packageLock: packageLock ? { sha256: packageLock.sha256, bytes: packageLock.bytes } : null,
    createdAt: new Date().toISOString()
  };
}

async function captureJsonBuffer(buffer, target, archivePath, options = {}) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, buffer, { mode: options.privateMode ? 0o600 : 0o644 });
  return {
    kind: "file", present: true, required: Boolean(options.required), restoreAbsence: false,
    file: archivePath, sha256: sha256Buffer(buffer), bytes: buffer.length, mode: options.privateMode ? 0o600 : 0o644
  };
}

async function inspectEncryptedProviderState(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    const providers = Array.isArray(parsed?.providers) ? parsed.providers : [];
    return {
      modern: providers.some((provider) => provider?.apiKeyEncrypted && typeof provider.apiKeyEncrypted === "object"),
      legacy: providers.some((provider) => typeof provider?.apiKeyEncrypted === "string" && provider.apiKeyEncrypted.startsWith("enc:v1:"))
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { modern: false, legacy: false };
    throw new Error(`无法检查 AI 供应商状态文件：${error.message}`);
  }
}

export async function createProductionBackup(options = {}) {
  const layout = resolveBackupLayout(options);
  const id = options.backupId || backupId(options.purpose === "pre-restore" ? "pre-restore" : "backup");
  const targetDir = path.resolve(options.targetDir || path.join(layout.backupDir, id));
  const purpose = options.purpose || "scheduled-or-manual";
  assertNotFilesystemRoot(targetDir, "备份目标");
  await mkdir(path.dirname(targetDir), { recursive: true, mode: 0o700 });
  let created = false;
  try {
    await mkdir(targetDir, { mode: 0o700 });
    created = true;
    const components = {};
    components.database = await createDatabaseSnapshot(layout.databasePath, path.join(targetDir, ...COMPONENTS.database.archivePath.split("/")));

    const fileSources = {
      dataMasterKey: layout.dataMasterKeyPath,
      aiMasterKey: layout.aiMasterKeyPath,
      aiProviders: layout.aiProvidersPath,
      publisherState: layout.publisherStatePath,
      aiGenerationRuns: layout.aiGenerationRunsPath,
      legacyEncryptionKey: layout.legacyEncryptionKeyPath
    };
    for (const [componentId, source] of Object.entries(fileSources)) {
      if (componentId === "aiMasterKey" && path.resolve(layout.aiMasterKeyPath) === path.resolve(layout.dataMasterKeyPath)) continue;
      const descriptor = COMPONENTS[componentId];
      components[componentId] = await copyCapturedFile(source, path.join(targetDir, ...descriptor.archivePath.split("/")), {
        label: componentId,
        required: descriptor.required,
        restoreAbsence: descriptor.restoreAbsence,
        archivePath: descriptor.archivePath,
        privateMode: true,
        expectedBytes: ["dataMasterKey", "aiMasterKey"].includes(componentId) ? 32 : undefined
      });
      if (components[componentId].present) components[componentId].file = descriptor.archivePath;
    }

    const environmentMasterKey = decodeMasterKey(layout.env.TZ_MASTER_KEY);
    const encryptedProviderState = await inspectEncryptedProviderState(layout.aiProvidersPath);
    const activeFileComponent = path.resolve(layout.aiMasterKeyPath) === path.resolve(layout.dataMasterKeyPath) ? "dataMasterKey" : "aiMasterKey";
    const activeFilePresent = Boolean(components[activeFileComponent]?.present);
    if (!environmentMasterKey && encryptedProviderState.modern && !activeFilePresent) {
      throw new Error("AI 供应商状态包含新版加密 API Key，但备份中没有可用的 master.key。请先修复密钥配置。");
    }
    if (!environmentMasterKey && encryptedProviderState.legacy && !components.legacyEncryptionKey?.present) {
      throw new Error("AI 供应商状态包含旧版加密 API Key，但备份中没有兼容 .encryption-key。请先修复密钥配置。");
    }
    const masterKey = environmentMasterKey
      ? { activeSource: "environment", fingerprint: masterKeyFingerprint(environmentMasterKey), requiredOnRestore: true }
      : activeFilePresent
        ? { activeSource: "file", component: activeFileComponent, fingerprint: `sha256:${components[activeFileComponent].sha256}`, requiredOnRestore: encryptedProviderState.modern }
        : { activeSource: "none", requiredOnRestore: false };

    components.knowledgeAssets = await captureDirectory(
      layout.knowledgeAssetDir,
      path.join(targetDir, ...COMPONENTS.knowledgeAssets.archiveRoot.split("/")),
      COMPONENTS.knowledgeAssets.archiveRoot,
      { label: "企业知识库图片与原文件", backupTarget: targetDir }
    );
    components.siteStatic = await captureDirectory(
      layout.siteStaticDir,
      path.join(targetDir, ...COMPONENTS.siteStatic.archiveRoot.split("/")),
      COMPONENTS.siteStatic.archiveRoot,
      { label: "官网静态页面及客户资源目录", backupTarget: targetDir }
    );
    components.deploymentConfig = await captureDirectory(
      layout.deploymentConfigDir,
      path.join(targetDir, ...COMPONENTS.deploymentConfig.archiveRoot.split("/")),
      COMPONENTS.deploymentConfig.archiveRoot,
      { label: "部署配置目录", backupTarget: targetDir, include: deploymentPathPolicy }
    );

    const release = await packageMetadata(layout, components.database, purpose);
    const releaseBuffer = Buffer.from(`${JSON.stringify(release, null, 2)}\n`, "utf8");
    components.releaseMetadata = await captureJsonBuffer(
      releaseBuffer,
      path.join(targetDir, ...COMPONENTS.releaseMetadata.archivePath.split("/")),
      COMPONENTS.releaseMetadata.archivePath,
      { required: true }
    );

    const manifest = {
      format: PRIVATE_BACKUP_FORMAT,
      formatVersion: 2,
      backupId: id,
      purpose,
      createdAt: new Date().toISOString(),
      application: release.application,
      masterKey,
      integrity: { algorithm: "sha256", manifestChecksumFile: "manifest.sha256" },
      components
    };
    const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(path.join(targetDir, "manifest.json"), manifestBuffer, { mode: 0o600 });
    await writeFile(path.join(targetDir, "manifest.sha256"), `${sha256Buffer(manifestBuffer)}  manifest.json\n`, { encoding: "utf8", mode: 0o600 });
    const verified = await verifyProductionBackup(targetDir);
    return { targetDir, manifest: verified.manifest, summary: verified.summary };
  } catch (error) {
    if (created) await rm(targetDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function secureArchiveFile(rootRealPath, archivePath, label) {
  const safePath = asArchivePath(archivePath, label);
  const candidate = path.resolve(rootRealPath, ...safePath.split("/"));
  if (!isInside(rootRealPath, candidate)) throw new Error(`${label}越过了备份目录边界。`);
  const resolved = await realpath(candidate);
  if (!isInside(rootRealPath, resolved)) throw new Error(`${label}通过符号链接越过了备份目录边界。`);
  const info = await lstat(resolved);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label}必须是备份目录内的普通文件。`);
  return { path: resolved, info };
}

function validateDigest(value, label) {
  const digest = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${label}缺少有效 SHA256。`);
  return digest;
}

function validateBytes(value, label) {
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`${label}的字节数无效。`);
  return bytes;
}

function validateMode(value) {
  if (value == null) return 0o600;
  const mode = Number(value);
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error("备份文件权限字段无效。");
  return mode;
}

async function verifyFileRecord(rootRealPath, record, expectedPath, label) {
  if (!record || record.present !== true || record.kind !== "file") throw new Error(`${label}组件记录无效。`);
  if (record.file !== expectedPath) throw new Error(`${label}使用了非预期归档路径。`);
  const archive = await secureArchiveFile(rootRealPath, record.file, label);
  const digest = await sha256File(archive.path);
  if (digest.sha256 !== validateDigest(record.sha256, label)) throw new Error(`${label} SHA256 校验失败。`);
  if (digest.bytes !== validateBytes(record.bytes, label)) throw new Error(`${label}文件大小校验失败。`);
  validateMode(record.mode);
  if (["dataMasterKey", "aiMasterKey"].includes(label) && digest.bytes !== 32) throw new Error(`${label}必须正好为 32 字节。`);
  if (["aiProviders", "publisherState", "aiGenerationRuns", "releaseMetadata"].includes(label)) {
    try {
      const parsed = JSON.parse(await readFile(archive.path, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("顶层必须是对象");
    } catch (error) {
      throw new Error(`${label}不是有效的 JSON 状态文件：${error.message}`);
    }
  }
  return { path: archive.path, digest };
}

async function verifyDirectoryRecord(rootRealPath, record, expectedRoot, label) {
  if (!record || record.present !== true || record.kind !== "directory") throw new Error(`${label}组件记录无效。`);
  if (record.root !== expectedRoot) throw new Error(`${label}使用了非预期归档根目录。`);
  const seen = new Set();
  const files = [];
  for (const item of Array.isArray(record.files) ? record.files : []) {
    const relative = asArchivePath(item?.path, `${label}文件路径`);
    if (seen.has(relative)) throw new Error(`${label}包含重复文件：${relative}`);
    seen.add(relative);
    const archivePath = `${expectedRoot}/${relative}`;
    const archive = await secureArchiveFile(rootRealPath, archivePath, `${label}/${relative}`);
    const digest = await sha256File(archive.path);
    if (digest.sha256 !== validateDigest(item.sha256, `${label}/${relative}`)) throw new Error(`${label}/${relative} SHA256 校验失败。`);
    if (digest.bytes !== validateBytes(item.bytes, `${label}/${relative}`)) throw new Error(`${label}/${relative}文件大小校验失败。`);
    validateMode(item.mode);
    files.push({ ...item, path: relative, archivePath: archive.path });
  }
  const directorySet = new Set();
  for (const item of Array.isArray(record.directories) ? record.directories : []) {
    const relative = asArchivePath(item, `${label}目录路径`);
    if (directorySet.has(relative)) throw new Error(`${label}包含重复目录：${relative}`);
    directorySet.add(relative);
  }
  return { files, directories: [...directorySet] };
}

async function readManifestAndRoot(sourceDir) {
  const root = await realpath(path.resolve(sourceDir));
  const info = await lstat(root);
  if (!info.isDirectory()) throw new Error("备份源必须是目录。");
  const manifestFile = await secureArchiveFile(root, "manifest.json", "manifest.json");
  const manifestBuffer = await readFile(manifestFile.path);
  let manifest;
  try { manifest = JSON.parse(manifestBuffer.toString("utf8")); } catch { throw new Error("manifest.json 不是有效 JSON。"); }
  return { root, manifest, manifestBuffer };
}

async function verifyV2(root, manifest, manifestBuffer) {
  if (manifest.formatVersion !== 2 || !manifest.components || typeof manifest.components !== "object" || Array.isArray(manifest.components)) {
    throw new Error("备份 v2 清单结构无效。");
  }
  const checksumFile = await secureArchiveFile(root, "manifest.sha256", "manifest.sha256");
  const checksumText = (await readFile(checksumFile.path, "utf8")).trim();
  const checksumMatch = checksumText.match(/^([a-fA-F0-9]{64})\s+\*?manifest\.json$/);
  if (!checksumMatch || checksumMatch[1].toLowerCase() !== sha256Buffer(manifestBuffer)) throw new Error("manifest.json 完整性校验失败。");
  const unknown = Object.keys(manifest.components).filter((id) => !COMPONENTS[id]);
  if (unknown.length) throw new Error(`备份包含当前版本不支持的组件：${unknown.join("、")}`);
  const verifiedComponents = {};
  for (const [componentId, descriptor] of Object.entries(COMPONENTS)) {
    const record = manifest.components[componentId];
    if (!record) {
      if (descriptor.required) throw new Error(`备份缺少必需组件：${componentId}`);
      continue;
    }
    if (record.present === false) {
      if (descriptor.required) throw new Error(`备份必需组件不可用：${componentId}`);
      verifiedComponents[componentId] = { record, present: false };
      continue;
    }
    if (descriptor.kind === "file") {
      const verified = await verifyFileRecord(root, record, descriptor.archivePath, componentId);
      verifiedComponents[componentId] = { record, present: true, ...verified };
    } else {
      const verified = await verifyDirectoryRecord(root, record, descriptor.archiveRoot, componentId);
      verifiedComponents[componentId] = { record, present: true, ...verified };
    }
  }
  if (!manifest.masterKey || !["environment", "file", "none"].includes(manifest.masterKey.activeSource)) throw new Error("备份主密钥来源记录无效。");
  if (manifest.masterKey.activeSource === "environment" && !/^sha256:[a-f0-9]{64}$/.test(String(manifest.masterKey.fingerprint || ""))) {
    throw new Error("备份的环境主密钥指纹无效。");
  }
  if (manifest.masterKey.activeSource === "file" && !["dataMasterKey", "aiMasterKey"].includes(manifest.masterKey.component)) {
    throw new Error("备份的文件主密钥组件无效。");
  }
  if (manifest.masterKey.activeSource === "file") {
    const keyComponent = verifiedComponents[manifest.masterKey.component];
    if (!keyComponent?.present) throw new Error("备份声明的活动 master.key 组件不存在。");
    if (manifest.masterKey.fingerprint !== `sha256:${keyComponent.record.sha256}`) throw new Error("备份的 master.key 指纹与密钥文件不一致。");
  }
  return { manifest, components: verifiedComponents, format: PRIVATE_BACKUP_FORMAT };
}

async function verifyV1(root, manifest) {
  if (!manifest.database?.file) throw new Error("旧版备份缺少数据库组件。");
  const databasePath = asArchivePath(manifest.database.file, "旧版数据库路径");
  const databaseFile = await secureArchiveFile(root, databasePath, "旧版数据库");
  const databaseDigest = await sha256File(databaseFile.path);
  if (databaseDigest.sha256 !== validateDigest(manifest.database.sha256, "旧版数据库")) throw new Error("旧版数据库备份校验失败。");
  const components = {
    database: {
      present: true,
      path: databaseFile.path,
      digest: databaseDigest,
      record: { kind: "file", present: true, required: true, file: databasePath, sha256: databaseDigest.sha256, bytes: databaseDigest.bytes, mode: 0o600 }
    }
  };
  if (manifest.masterKey?.file) {
    const keyPath = asArchivePath(manifest.masterKey.file, "旧版 master.key 路径");
    const keyFile = await secureArchiveFile(root, keyPath, "旧版 master.key");
    const keyDigest = await sha256File(keyFile.path);
    if (keyDigest.sha256 !== validateDigest(manifest.masterKey.sha256, "旧版 master.key")) throw new Error("旧版 master.key 校验失败。");
    components.dataMasterKey = {
      present: true,
      path: keyFile.path,
      digest: keyDigest,
      record: { kind: "file", present: true, required: false, file: keyPath, sha256: keyDigest.sha256, bytes: keyDigest.bytes, mode: 0o600 }
    };
  }
  return { manifest, components, format: LEGACY_BACKUP_FORMAT };
}

export async function verifyProductionBackup(sourceDir) {
  const { root, manifest, manifestBuffer } = await readManifestAndRoot(sourceDir);
  let verified;
  if (manifest.format === PRIVATE_BACKUP_FORMAT) verified = await verifyV2(root, manifest, manifestBuffer);
  else if (manifest.format === LEGACY_BACKUP_FORMAT) verified = await verifyV1(root, manifest);
  else throw new Error(`不支持的备份格式：${String(manifest.format || "未标记")}`);
  const present = Object.entries(verified.components).filter(([, item]) => item.present).map(([id]) => id);
  return { ...verified, root, summary: { format: verified.format, componentCount: present.length, components: present } };
}

function targetForFileComponent(layout, componentId) {
  return sourcePathForComponent(layout, componentId);
}

function transactionSuffix(id, role) {
  return `.tz-${role}-${id}-${crypto.randomBytes(3).toString("hex")}`;
}

async function stageFileOperation(operation, transactionId) {
  await mkdir(path.dirname(operation.target), { recursive: true, mode: 0o700 });
  operation.stage = path.join(path.dirname(operation.target), `${path.basename(operation.target)}${transactionSuffix(transactionId, "next")}`);
  operation.previous = path.join(path.dirname(operation.target), `${path.basename(operation.target)}${transactionSuffix(transactionId, "previous")}`);
  await copyFile(operation.source, operation.stage);
  const digest = await sha256File(operation.stage);
  if (digest.sha256 !== operation.sha256 || digest.bytes !== operation.bytes) throw new Error(`暂存文件校验失败：${operation.componentId}`);
  if (operation.componentId === "database") await sqliteMetadata(operation.stage);
  await chmod(operation.stage, operation.mode).catch(() => {});
}

async function stageDirectoryOperation(operation, transactionId) {
  assertNotFilesystemRoot(operation.target, `${operation.componentId} 恢复目录`);
  await mkdir(path.dirname(operation.target), { recursive: true, mode: 0o700 });
  operation.stage = path.join(path.dirname(operation.target), `${path.basename(operation.target)}${transactionSuffix(transactionId, "next")}`);
  operation.previous = path.join(path.dirname(operation.target), `${path.basename(operation.target)}${transactionSuffix(transactionId, "previous")}`);
  await mkdir(operation.stage, { mode: 0o700 });
  for (const relative of operation.directories || []) await mkdir(path.join(operation.stage, ...relative.split("/")), { recursive: true });
  for (const file of operation.files) {
    const target = path.join(operation.stage, ...file.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file.archivePath, target);
    const digest = await sha256File(target);
    if (digest.sha256 !== file.sha256 || digest.bytes !== file.bytes) throw new Error(`暂存目录文件校验失败：${operation.componentId}/${file.path}`);
    await chmod(target, validateMode(file.mode)).catch(() => {});
  }
}

async function stageDeleteOperation(operation, transactionId) {
  await mkdir(path.dirname(operation.target), { recursive: true, mode: 0o700 });
  operation.stage = null;
  operation.previous = path.join(path.dirname(operation.target), `${path.basename(operation.target)}${transactionSuffix(transactionId, "previous")}`);
}

async function cleanupOperation(operation) {
  if (operation.stage) await rm(operation.stage, { recursive: true, force: true }).catch(() => {});
  if (operation.previous) await rm(operation.previous, { recursive: true, force: true }).catch(() => {});
}

async function rollbackOperations(committed) {
  const failures = [];
  for (const operation of [...committed].reverse()) {
    try {
      if (await exists(operation.target)) await rm(operation.target, { recursive: true, force: true });
      if (operation.hadPrevious && await exists(operation.previous)) await rename(operation.previous, operation.target);
    } catch (error) {
      failures.push(`${operation.componentId}: ${error.message}`);
    }
  }
  if (failures.length) throw new Error(`恢复失败且自动回滚不完整：${failures.join("；")}`);
}

async function commitOperations(operations, options = {}) {
  const committed = [];
  try {
    for (const operation of operations) {
      operation.hadPrevious = await exists(operation.target);
      if (operation.hadPrevious) await rename(operation.target, operation.previous);
      // Add the operation as soon as the old target has moved. If installing
      // the staged replacement fails, rollback must still put it back.
      committed.push(operation);
      if (operation.stage) await rename(operation.stage, operation.target);
      if (Number.isInteger(options.failCommitAfter) && committed.length >= options.failCommitAfter) throw new Error("测试注入：恢复提交中断。");
    }
  } catch (error) {
    try { await rollbackOperations(committed); } catch (rollbackError) { throw new AggregateError([error, rollbackError], "恢复事务失败且自动回滚不完整。", { cause: error }); }
    throw error;
  }
  for (const operation of operations) if (operation.previous) await rm(operation.previous, { recursive: true, force: true }).catch(() => {});
}

function ensureNonOverlappingRestoreRoots(layout, siteIncluded) {
  assertNotFilesystemRoot(layout.knowledgeAssetDir, "知识资产目录");
  const criticalFiles = [layout.databasePath, layout.dataMasterKeyPath, layout.aiMasterKeyPath, layout.aiProvidersPath, layout.publisherStatePath, layout.aiGenerationRunsPath];
  if (criticalFiles.some((item) => isInside(layout.knowledgeAssetDir, item))) throw new Error("知识资产目录与生产数据文件重叠，拒绝执行目录级恢复。");
  if (!siteIncluded) return;
  assertNotFilesystemRoot(layout.siteStaticDir, "官网静态目录");
  if (criticalFiles.some((item) => isInside(layout.siteStaticDir, item))) throw new Error("官网静态目录与生产数据目录重叠，拒绝执行目录级恢复。");
  if (isInside(layout.siteStaticDir, layout.deploymentConfigDir) || isInside(layout.deploymentConfigDir, layout.siteStaticDir)) {
    throw new Error("官网静态目录与部署配置目录重叠，拒绝执行恢复。");
  }
}

function validateEnvironmentMasterKey(manifest, env) {
  if (manifest.format !== PRIVATE_BACKUP_FORMAT) return;
  const current = decodeMasterKey(env.TZ_MASTER_KEY);
  if (manifest.masterKey?.activeSource === "environment") {
    if (!current) throw new Error("该备份使用环境变量主密钥加密；恢复前必须提供原 TZ_MASTER_KEY。");
    if (masterKeyFingerprint(current) !== manifest.masterKey.fingerprint) throw new Error("当前 TZ_MASTER_KEY 与备份指纹不一致，拒绝恢复加密配置。");
  }
  if (manifest.masterKey?.activeSource === "file" && current && masterKeyFingerprint(current) !== manifest.masterKey.fingerprint) {
    throw new Error("当前环境中的 TZ_MASTER_KEY 会覆盖备份 master.key，且两者指纹不一致；请先移除或改正环境变量。");
  }
}

function buildRestoreOperations(verified, layout) {
  const operations = [];
  const fileComponentIds = ["database", "dataMasterKey", "aiMasterKey", "aiProviders", "publisherState", "aiGenerationRuns", "legacyEncryptionKey"];
  for (const componentId of fileComponentIds) {
    const item = verified.components[componentId];
    const target = targetForFileComponent(layout, componentId);
    if (!target || !item) continue;
    if (item.present) {
      operations.push({
        kind: "file", componentId, source: item.path, target,
        sha256: item.record.sha256, bytes: item.record.bytes,
        mode: ["dataMasterKey", "aiMasterKey", "legacyEncryptionKey"].includes(componentId) ? 0o600 : validateMode(item.record.mode)
      });
    } else if (item.record?.restoreAbsence === true && COMPONENTS[componentId]?.restoreAbsence) {
      operations.push({ kind: "delete", componentId, target });
    }
  }
  const site = verified.components.siteStatic;
  if (site?.present) operations.push({ kind: "directory", componentId: "siteStatic", target: layout.siteStaticDir, files: site.files, directories: site.directories });
  const knowledgeAssets = verified.components.knowledgeAssets;
  if (knowledgeAssets?.present) operations.push({ kind: "directory", componentId: "knowledgeAssets", target: layout.knowledgeAssetDir, files: knowledgeAssets.files, directories: knowledgeAssets.directories });
  const deployment = verified.components.deploymentConfig;
  if (deployment?.present) {
    for (const file of deployment.files) {
      operations.push({
        kind: "file", componentId: `deploymentConfig/${file.path}`,
        source: file.archivePath,
        target: path.join(layout.deploymentConfigDir, ...file.path.split("/")),
        sha256: file.sha256, bytes: file.bytes, mode: validateMode(file.mode)
      });
    }
  }
  const targets = new Set();
  for (const operation of operations) {
    const normalized = path.resolve(operation.target).toLocaleLowerCase("en-US");
    if (targets.has(normalized)) throw new Error(`恢复清单映射到重复目标：${operation.target}`);
    targets.add(normalized);
  }
  return operations;
}

async function createSafetySnapshot(layout, options) {
  if (!await exists(layout.databasePath)) return null;
  const targetDir = path.join(layout.backupDir, backupId("pre-restore"));
  const result = await createProductionBackup({
    ...options,
    config: { dataDir: layout.dataDir, databasePath: layout.databasePath, backupDir: layout.backupDir },
    targetDir,
    purpose: "pre-restore"
  });
  return result.targetDir;
}

export async function restoreProductionBackup(options = {}) {
  if (!options.force) throw new Error("恢复会替换生产数据，必须显式传入 force=true（命令行使用 --force）。");
  const sourceDir = path.resolve(options.sourceDir || "");
  if (!options.sourceDir) throw new Error("必须提供备份目录。");
  const layout = resolveBackupLayout(options);
  const verified = await verifyProductionBackup(sourceDir);
  validateEnvironmentMasterKey(verified.manifest, layout.env);
  ensureNonOverlappingRestoreRoots(layout, Boolean(verified.components.siteStatic?.present));
  if (verified.components.siteStatic?.present && isInside(layout.siteStaticDir, sourceDir)) throw new Error("备份源位于即将替换的官网静态目录内，拒绝恢复。");

  const safetySnapshot = options.skipSafetySnapshot ? null : await createSafetySnapshot(layout, options);
  const transactionId = crypto.randomBytes(6).toString("hex");
  const operations = buildRestoreOperations(verified, layout);
  try {
    for (const operation of operations) {
      if (operation.kind === "file") await stageFileOperation(operation, transactionId);
      else if (operation.kind === "directory") await stageDirectoryOperation(operation, transactionId);
      else await stageDeleteOperation(operation, transactionId);
    }
    await commitOperations(operations, { failCommitAfter: options.failCommitAfter });
  } catch (error) {
    for (const operation of operations) await cleanupOperation(operation);
    throw error;
  }
  for (const operation of operations) await cleanupOperation(operation);
  await sqliteMetadata(layout.databasePath);
  return {
    databasePath: layout.databasePath,
    safetySnapshot,
    sourceFormat: verified.format,
    restoredComponents: operations.map((item) => item.componentId)
  };
}
