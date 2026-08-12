import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_BACKUP_FORMAT, sha256File, verifyProductionBackup } from "./production-backup-v2.mjs";

const PRODUCT_ID = "tongzhuo-geo-private-delivery";
const MANIFEST_FORMAT = "tongzhuo-private-delivery-manifest-v1";
const MIGRATION_FORMAT = PRIVATE_BACKUP_FORMAT;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOP_LEVEL_APP_FILES = new Set([
  ".dockerignore",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "package-lock.json",
  "package.json",
  "README.md"
]);
const APP_DIRECTORIES = ["deploy", "docs", "foundation-assets", "industry-templates", "project-seeds", "public", "public-site", "research-packages", "scripts"];
const BLOCKED_DIRECTORY_NAMES = new Set([
  ".git",
  "backups",
  "certs",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "secrets"
]);
const BLOCKED_FILE_NAMES = new Set([
  ".encryption-key",
  ".env",
  "ai-generation-runs.json",
  "ai-providers.json",
  "cutover.env",
  "master.key",
  "publisher-state.json",
  "tongzhuo-production.sqlite"
]);

function usage() {
  return `桐灼 GEO 私有化交付包构建器

用法：
  node scripts/build-private-delivery.mjs --mode blank [选项]
  node scripts/build-private-delivery.mjs --mode migrated \\
    --migration-input <绝对路径> --customer-id <客户代号> \\
    --acknowledge-sensitive-data [选项]

选项：
  --mode <blank|migrated>       交付模式，默认 blank
  --version <版本>              默认读取 package.json
  --output <目录>               默认 dist/private-delivery
  --migration-input <目录>      migrated 模式必填；须为 backup v2 目录
  --customer-id <代号>          migrated 模式必填；只允许字母、数字、点、横线和下划线
  --acknowledge-sensitive-data  确认 migrated 包包含客户数据和恢复密钥
  --overwrite                   仅覆盖由本构建器生成的同名目录/压缩包
  --no-archive                  只生成目录，不生成 tar.gz（用于本地验证）
  --help                        显示帮助

安全边界：blank 模式采用源码白名单，不读取 data、backups、.env、证书、
客户官网或任何运行时状态。migrated 模式不会自动发现数据，只接收显式指定且
通过 manifest.sha256 校验的 backup v2 目录。`;
}

function parseArguments(argv) {
  const options = {
    mode: "blank",
    version: "",
    output: path.join(projectRoot, "dist", "private-delivery"),
    migrationInput: "",
    customerId: "",
    acknowledgeSensitiveData: false,
    overwrite: false,
    archive: true,
    pruneHistory: false,
    retainBuilds: "2",
    help: false
  };
  const valueOptions = new Map([
    ["--mode", "mode"],
    ["--version", "version"],
    ["--output", "output"],
    ["--migration-input", "migrationInput"],
    ["--customer-id", "customerId"],
    ["--retain-builds", "retainBuilds"]
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} 缺少值。`);
      options[valueOptions.get(argument)] = value;
      index += 1;
      continue;
    }
    if (argument === "--acknowledge-sensitive-data") options.acknowledgeSensitiveData = true;
    else if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--no-archive") options.archive = false;
    else if (argument === "--prune-history") options.pruneHistory = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`未知参数：${argument}`);
  }
  return options;
}

function safeToken(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 80 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    throw new Error(`${label} 只允许 1-80 位字母、数字、点、横线和下划线，且须以字母或数字开头。`);
  }
  return normalized;
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error(label + " must be an integer between 1 and 20.");
  }
  return parsed;
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sourceIdentity() {
  const commitResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  if (commitResult.status !== 0) throw new Error(`无法读取 Git 提交：${commitResult.stderr || commitResult.stdout}`);
  const commit = String(commitResult.stdout || "").trim().toLocaleLowerCase("en-US");
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Git 提交格式无效，不能生成可追溯交付包。");
  const statusResult = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "."], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  if (statusResult.status !== 0) throw new Error(`无法读取 Git 工作树状态：${statusResult.stderr || statusResult.stdout}`);
  return { commit, dirty: Boolean(String(statusResult.stdout || "").trim()) };
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function isBlockedBlankPath(relativePath, isDirectory) {
  const normalized = slash(relativePath).replace(/^\.\//, "");
  const segments = normalized.toLocaleLowerCase("en-US").split("/").filter(Boolean);
  const citationDocumentSnapshot = /^(?:app\/)?research-packages\/geo-citation-lab\/document-snapshots\/[a-f0-9]{40}(?:\/|$)/i.test(normalized);
  const blockedDirectorySegments = segments.filter((segment) => BLOCKED_DIRECTORY_NAMES.has(segment));
  // A verified Citation Lab document snapshot legitimately contains a small
  // `data/` documentation tree (manifest, statistics, quality reports, and
  // contracts).  It is part of the active RAG corpus, not customer runtime
  // data.  Keep the general data-directory ban everywhere else, and continue
  // blocking backups/secrets/etc. even inside a snapshot.
  const allowedSnapshotDataDirectory = citationDocumentSnapshot
    && blockedDirectorySegments.length > 0
    && blockedDirectorySegments.every((segment) => segment === "data");
  if (isDirectory && blockedDirectorySegments.length > 0 && !allowedSnapshotDataDirectory) return true;
  const name = segments.at(-1) || "";
  const verifiedCitationResearchDatabase = /^(?:app\/)?research-packages\/geo-citation-lab\/[^/]+\/derived\/citation-research\.sqlite$/i.test(normalized);
  const citationUpstreamBinary = /^(?:app\/)?research-packages\/geo-citation-lab\/[^/]+\/upstream\/.*\.(?:duckdb|parquet)$/i.test(normalized);
  const citationDocumentRuntimeState = /^(?:app\/)?research-packages\/geo-citation-lab\/\.document-updates\/(?:state\.json|staging(?:\/|$))/i.test(normalized);
  if (citationUpstreamBinary) return true;
  if (citationDocumentRuntimeState) return true;
  if (BLOCKED_FILE_NAMES.has(name)) return true;
  if ((name.endsWith(".sqlite") || name.includes(".sqlite-")) && !verifiedCitationResearchDatabase) return true;
  if (/\.(?:key|pem|p12|pfx|jks|keystore)$/i.test(name)) return true;
  if (name.endsWith(".env") && !name.endsWith(".env.example")) return true;
  return false;
}

async function copyTree(source, target, options = {}, relativePath = "") {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`拒绝复制符号链接：${source}`);
  if (options.blank && isBlockedBlankPath(relativePath || path.basename(source), info.isDirectory())) {
    return;
  }
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true, mode: 0o755 });
    const entries = await readdir(source, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const childRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;
      await copyTree(path.join(source, entry.name), path.join(target, entry.name), options, childRelative);
    }
    return;
  }
  if (!info.isFile()) throw new Error(`不支持的文件类型：${source}`);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
  await copyFile(source, target);
  if (options.executable && /\.sh$/i.test(target)) await chmod(target, 0o755).catch(() => {});
}

async function copyApplication(target) {
  await mkdir(target, { recursive: true, mode: 0o755 });
  const entries = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!entry.isFile()) continue;
    if (!TOP_LEVEL_APP_FILES.has(entry.name) && !entry.name.endsWith(".mjs")) continue;
    await copyTree(path.join(projectRoot, entry.name), path.join(target, entry.name), { blank: true }, entry.name);
  }
  for (const directory of APP_DIRECTORIES) {
    const source = path.join(projectRoot, directory);
    if (await exists(source)) await copyTree(source, path.join(target, directory), { blank: true, executable: true }, directory);
  }
}

async function assertBlankBundleIsClean(bundleRoot) {
  const files = await listFiles(bundleRoot);
  const violations = files.filter((file) => isBlockedBlankPath(path.relative(bundleRoot, file), false));
  if (violations.length) {
    throw new Error(`blank 包出现禁止文件：\n${violations.map((file) => `- ${slash(path.relative(bundleRoot, file))}`).join("\n")}`);
  }
  if (await exists(path.join(bundleRoot, "migration"))) throw new Error("blank 包不得包含 migration 目录。");
}

async function validateMigrationInput(rawInput) {
  if (!rawInput) throw new Error("migrated 模式必须提供 --migration-input <绝对路径>。");
  if (!path.isAbsolute(rawInput)) throw new Error("--migration-input 必须是绝对路径，避免误打包当前目录数据。");
  const source = await realpath(rawInput);
  const sourceInfo = await stat(source);
  if (!sourceInfo.isDirectory()) throw new Error("--migration-input 必须指向 backup v2 目录，而不是单个文件。");
  const manifestPath = path.join(source, "manifest.json");
  const checksumPath = path.join(source, "manifest.sha256");
  const manifestBuffer = await readFile(manifestPath);
  const checksumText = (await readFile(checksumPath, "utf8")).trim();
  const expected = checksumText.match(/\b([a-fA-F0-9]{64})\b/)?.[1]?.toLocaleLowerCase("en-US");
  if (!expected || sha256(manifestBuffer) !== expected) throw new Error("迁移输入 manifest.sha256 校验失败。");
  let manifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString("utf8"));
  } catch {
    throw new Error("迁移输入 manifest.json 不是有效 JSON。");
  }
  if (manifest.format !== MIGRATION_FORMAT || Number(manifest.formatVersion) !== 2) {
    throw new Error(`迁移输入必须是 ${MIGRATION_FORMAT}（formatVersion=2）。`);
  }
  if (!manifest.components || typeof manifest.components !== "object") {
    throw new Error("迁移输入 manifest 缺少 components，不能确认恢复边界。");
  }
  // 复用恢复程序的完整校验器。除了根 manifest，它还验证每个 payload 的
  // 路径、字节数、SHA-256、SQLite 有效性和未登记文件，避免把一个只有
  // 正确外壳但内部被替换的备份放入客户交付包。
  const verified = await verifyProductionBackup(source);
  if (verified.format !== MIGRATION_FORMAT) throw new Error(`迁移输入必须是 ${MIGRATION_FORMAT}。`);
  if (verified.manifest.masterKey?.activeSource === "environment") {
    throw new Error("迁移备份依赖外部 TZ_MASTER_KEY，不能构建为可独立恢复的 migrated 交付包。请在源环境按受控流程改用数据卷 master.key 后重新备份，或单独制定企业密钥平台恢复方案。");
  }
  return { source, manifest: verified.manifest, manifestSha256: expected, summary: verified.summary };
}

async function listFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  const output = [];
  for (const entry of entries) {
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    const target = path.join(root, childRelative);
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error(`交付包中不允许符号链接：${target}`);
    if (info.isDirectory()) output.push(...await listFiles(root, childRelative));
    else if (info.isFile()) output.push(target);
    else throw new Error(`交付包中出现不支持的文件类型：${target}`);
  }
  return output;
}

async function fileRecords(bundleRoot, exclusions = new Set()) {
  const records = [];
  for (const file of await listFiles(bundleRoot)) {
    const relative = slash(path.relative(bundleRoot, file));
    if (exclusions.has(relative)) continue;
    const digest = await sha256File(file);
    records.push({ path: relative, bytes: digest.bytes, sha256: digest.sha256 });
  }
  return records;
}

async function validateOutputTarget(target, overwrite) {
  if (!await exists(target)) return;
  if (!overwrite) throw new Error(`输出已存在：${target}\n如需覆盖，请增加 --overwrite。`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(target, "manifest.json"), "utf8"));
  } catch {
    throw new Error(`拒绝覆盖非交付包目录：${target}`);
  }
  if (manifest.product !== PRODUCT_ID || manifest.format !== MANIFEST_FORMAT) {
    throw new Error(`拒绝覆盖无法识别的目录：${target}`);
  }
}

async function activateBuiltDirectory(staged, target) {
  if (!await exists(target)) {
    await rename(staged, target);
    return;
  }
  const previous = `${target}.replaced-${process.pid}`;
  if (await exists(previous)) await rm(previous, { recursive: true, force: true });
  try {
    await rename(target, previous);
  } catch (error) {
    throw new Error(`旧交付目录正在被占用，未作任何覆盖：${target}（${error.message}）`);
  }
  try {
    await rename(staged, target);
  } catch (error) {
    await rename(previous, target).catch(() => {});
    throw new Error(`新交付目录启用失败，已尝试恢复旧目录：${error.message}`);
  }
  await rm(previous, { recursive: true, force: true }).catch((error) => {
    console.warn(`旧交付目录已移出正式路径但暂时无法清理：${previous}（${error.message}）`);
  });
}

async function activateBuiltFiles(pairs) {
  const previousFiles = [];
  const activated = [];
  try {
    for (const { target } of pairs) {
      if (!await exists(target)) continue;
      const previous = `${target}.replaced-${process.pid}`;
      if (await exists(previous)) await rm(previous, { force: true });
      await rename(target, previous);
      previousFiles.push({ target, previous });
    }
    for (const { staged, target } of pairs) {
      await rename(staged, target);
      activated.push(target);
    }
  } catch (error) {
    for (const target of [...activated].reverse()) await rm(target, { force: true }).catch(() => {});
    for (const { target, previous } of [...previousFiles].reverse()) await rename(previous, target).catch(() => {});
    throw new Error(`交付压缩包启用失败，已尝试保留旧产物：${error.message}`);
  }
  for (const { previous } of previousFiles) {
    await rm(previous, { force: true }).catch((error) => {
      console.warn(`旧交付文件已移出正式路径但暂时无法清理：${previous}（${error.message}）`);
    });
  }
}

function createFirstReadme({ mode, version }) {
  const migration = mode === "migrated"
    ? "\n本包包含客户迁移数据及恢复密钥。必须在受控设备解压、通过加密通道传输，安装恢复并验收后立即安全删除交付介质副本。\n"
    : "\n本包为通用空白交付，不含数据库、API Key、主密钥、账号状态、客户官网或客户文件。\n";
  return `# 桐灼 GEO 私有化交付包 ${version}\n\n交付模式：\`${mode}\`。${migration}\n## 开始安装\n\n1. 阅读 \`docs/PRIVATE-DELIVERY.md\`。\n2. 核对 \`operations/app.env.example\` 与 \`operations/cutover.env.example\`；安装脚本会按参数生成受限的正式配置，真实值不得提交到 Git 或回传到普通工单。\n3. 在 Linux 服务器执行 \`sudo bash operations/preflight.sh --source ./app --site-source ./site-template --check-ports\`。\n4. 再执行 \`sudo bash operations/install.sh --source ./app --site-source ./site-template --site-url https://客户官网域名\`；安装完成后按终端地址创建首位企业管理员。\n5. 执行 \`sudo bash operations/verify.sh --install-root /opt/tongzhuo-geo\`，保存验收报告。\n\n所有文件在 \`manifest.json\` 中登记，并由 \`SHA256SUMS\` 校验。先执行 \`sha256sum -c SHA256SUMS\`，再开始安装。\n`;
}

async function createArchive(outputRoot, bundleName, overwrite) {
  const archivePath = path.join(outputRoot, `${bundleName}.tar.gz`);
  const checksumPath = `${archivePath}.sha256`;
  for (const target of [archivePath, checksumPath]) {
    if (!await exists(target)) continue;
    if (!overwrite) throw new Error(`输出已存在：${target}\n如需覆盖，请增加 --overwrite。`);
  }
  const stagedArchive = `${archivePath}.building-${process.pid}`;
  const stagedChecksum = `${checksumPath}.building-${process.pid}`;
  for (const staged of [stagedArchive, stagedChecksum]) {
    if (await exists(staged)) await rm(staged, { force: true });
  }
  // GNU tar on Windows treats an absolute `D:\\...` archive name as a
  // remote-host target because of the drive-letter colon. Run tar inside the
  // output directory and pass only relative names; this is portable on Linux
  // as well and still resolves to the same staged file.
  const stagedArchiveName = path.basename(stagedArchive);
  const result = spawnSync("tar", ["-czf", stagedArchiveName, bundleName], {
    cwd: outputRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) throw new Error(`无法调用 tar 创建交付包：${result.error.message}`);
  if (result.status !== 0) throw new Error(`tar 创建交付包失败：${result.stderr || result.stdout}`);
  const archiveDigest = await sha256File(stagedArchive);
  const archiveHash = archiveDigest.sha256;
  await writeFile(stagedChecksum, `${archiveHash}  ${path.basename(archivePath)}\n`, "utf8");
  try {
    await activateBuiltFiles([
      { staged: stagedArchive, target: archivePath },
      { staged: stagedChecksum, target: checksumPath }
    ]);
  } catch (error) {
    await rm(stagedArchive, { force: true }).catch(() => {});
    await rm(stagedChecksum, { force: true }).catch(() => {});
    throw error;
  }
  return { archivePath, checksumPath, sha256: archiveHash, bytes: archiveDigest.bytes };
}

async function isOwnedBundle(directory) {
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    return manifest.product === PRODUCT_ID && manifest.format === MANIFEST_FORMAT;
  } catch {
    return false;
  }
}

async function pruneHistoricalBundles(outputRoot, retainBuilds) {
  const entries = await readdir(outputRoot, { withFileTypes: true });
  const bundles = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(outputRoot, entry.name);
    if (!await isOwnedBundle(directory)) continue;
    const info = await stat(directory);
    bundles.push({ name: entry.name, directory, modifiedAt: info.mtimeMs });
  }
  bundles.sort((left, right) => right.modifiedAt - left.modifiedAt || right.name.localeCompare(left.name, "en"));
  const removed = [];
  for (const bundle of bundles.slice(retainBuilds)) {
    await rm(bundle.directory, { recursive: true, force: true });
    for (const suffix of [".tar.gz", ".tar.gz.sha256"]) {
      await rm(path.join(outputRoot, bundle.name + suffix), { force: true });
    }
    removed.push(bundle.name);
  }
  return removed;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!new Set(["blank", "migrated"]).has(options.mode)) throw new Error("--mode 只能是 blank 或 migrated。");
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
  const version = safeToken(options.version || packageJson.version, "版本号");
  const source = sourceIdentity();
  const retainBuilds = positiveInteger(options.retainBuilds, "--retain-builds");
  let customerId = "";
  let migration = null;
  if (options.mode === "migrated") {
    if (!options.acknowledgeSensitiveData) {
      throw new Error("migrated 模式必须显式增加 --acknowledge-sensitive-data，确认包内含客户数据与恢复密钥。");
    }
    customerId = safeToken(options.customerId, "客户代号");
    migration = await validateMigrationInput(options.migrationInput);
  } else if (options.migrationInput || options.customerId || options.acknowledgeSensitiveData) {
    throw new Error("blank 模式不得提供迁移输入、客户代号或敏感数据确认参数。");
  }

  const outputRoot = path.resolve(options.output);
  await mkdir(outputRoot, { recursive: true, mode: 0o755 });
  const bundleName = ["tongzhuo-geo-private", version, options.mode, customerId].filter(Boolean).join("-");
  const finalBundleRoot = path.join(outputRoot, bundleName);
  const bundleRoot = `${finalBundleRoot}.building-${process.pid}`;
  await validateOutputTarget(finalBundleRoot, options.overwrite);
  if (await exists(bundleRoot)) await rm(bundleRoot, { recursive: true, force: true });
  await mkdir(bundleRoot, { recursive: true, mode: 0o755 });

  try {
    await copyApplication(path.join(bundleRoot, "app"));
    await writeFile(path.join(bundleRoot, "app", "SOURCE_VERSION"), `${source.commit}\n`, "utf8");
    const operationsSource = path.join(projectRoot, "deploy", "private-delivery");
    if (!await exists(operationsSource)) throw new Error("缺少 deploy/private-delivery 运维文件。");
    await copyTree(operationsSource, path.join(bundleRoot, "operations"), { blank: true, executable: true }, "operations");
    const siteTemplate = path.join(operationsSource, "site-template");
    if (!await exists(siteTemplate)) throw new Error("缺少通用空白官网模板 deploy/private-delivery/site-template。");
    await copyTree(siteTemplate, path.join(bundleRoot, "site-template"), { blank: true }, "site-template");
    await mkdir(path.join(bundleRoot, "docs"), { recursive: true, mode: 0o755 });
    await copyFile(path.join(projectRoot, "docs", "PRIVATE-DELIVERY.md"), path.join(bundleRoot, "docs", "PRIVATE-DELIVERY.md"));
    await copyFile(path.join(operationsSource, "RELEASE-NOTES.md"), path.join(bundleRoot, "docs", "RELEASE-NOTES.md"));
    await writeFile(path.join(bundleRoot, "README-FIRST.md"), createFirstReadme({ mode: options.mode, version }), "utf8");
    await writeFile(path.join(bundleRoot, "VERSION"), `${version}\n`, "utf8");

    if (migration) {
      const migrationTarget = path.join(bundleRoot, "migration", "private-backup");
      await copyTree(migration.source, migrationTarget, { blank: false }, "migration/private-backup");
      await verifyProductionBackup(migrationTarget);
      await writeFile(path.join(bundleRoot, "migration", "SECURITY-NOTICE.md"), `# 敏感迁移数据\n\n客户代号：${customerId}\n\n本目录含企业数据库、主密钥、模型配置、发布器状态、官网文件和部署快照。它只能通过加密通道传输，必须限制文件权限；完成恢复和验收后，删除服务器上的交付副本。不要把本目录提交到 Git、网盘公开链接或普通工单。\n`, "utf8");
    } else {
      await assertBlankBundleIsClean(bundleRoot);
    }

    const createdAt = new Date().toISOString();
    const payloadFiles = await fileRecords(bundleRoot, new Set(["manifest.json", "SHA256SUMS"]));
    const manifest = {
      format: MANIFEST_FORMAT,
      formatVersion: 1,
      product: PRODUCT_ID,
      productVersion: version,
      sourceCommit: source.commit,
      sourceDirty: source.dirty,
      deliveryMode: options.mode,
      createdAt,
      requires: { operatingSystem: "Linux x86_64/arm64", dockerEngine: ">=24", dockerCompose: ">=2.20" },
      security: {
        containsCustomerData: options.mode === "migrated",
        containsRecoverySecrets: options.mode === "migrated",
        containsPlaintextApiKeys: false,
        archiveEncrypted: false
      },
      migration: migration ? {
        customerId,
        backupFormat: migration.manifest.format,
        backupCreatedAt: migration.manifest.createdAt || null,
        manifestSha256: migration.manifestSha256,
        verifiedComponents: migration.summary.components
      } : null,
      files: payloadFiles
    };
    await writeFile(path.join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const checksumFiles = await fileRecords(bundleRoot, new Set(["SHA256SUMS"]));
    await writeFile(
      path.join(bundleRoot, "SHA256SUMS"),
      `${checksumFiles.map((record) => `${record.sha256}  ${record.path}`).join("\n")}\n`,
      "utf8"
    );
    await activateBuiltDirectory(bundleRoot, finalBundleRoot);

    let archive = null;
    if (options.archive) archive = await createArchive(outputRoot, bundleName, options.overwrite);
    const prunedBundles = options.pruneHistory
      ? await pruneHistoricalBundles(outputRoot, retainBuilds)
      : [];
    console.log(JSON.stringify({
      ok: true,
      product: PRODUCT_ID,
      version,
      mode: options.mode,
      bundleRoot: finalBundleRoot,
      files: checksumFiles.length + 1,
      archive,
      prunedBundles
    }, null, 2));
    if (options.mode === "migrated") {
      console.warn("警告：migrated 交付包包含客户数据和恢复密钥，tar.gz 本身未加密；必须通过受控加密通道传输并在验收后安全删除。");
    }
  } catch (error) {
    if (await exists(bundleRoot)) await rm(bundleRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(`构建失败：${error.message}`);
  process.exitCode = 1;
});
