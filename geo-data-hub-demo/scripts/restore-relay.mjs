import crypto from "node:crypto";
import { access, chmod, copyFile, lstat, mkdir, readFile, rename, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { RelayStore, loadRelayMasterKey } from "../relay-store.mjs";

const BACKUP_FORMAT = "tongzhuo-relay-backup-v2";
const MANAGED_KEY_BACKUP_NAME = "relay-managed-master.key";
const MASTER_KEY_BYTES = 32;

const args = process.argv.slice(2);

function valueAfter(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]) : fallback;
}

function isDockerSecretPath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/\/+/g, "/").toLowerCase();
  return normalized === "/run/secrets"
    || normalized.startsWith("/run/secrets/")
    || normalized === "/var/run/secrets"
    || normalized.startsWith("/var/run/secrets/");
}

function isPrivateMode(info) {
  return process.platform === "win32" || (Number(info.mode) & 0o077) === 0;
}

async function digest(filePath) {
  return `sha256:${crypto.createHash("sha256").update(await readFile(filePath)).digest("hex")}`;
}

async function exists(filePath) {
  return Boolean(await stat(filePath).catch(() => null));
}

async function assertWritableParent(filePath, description) {
  const parent = path.dirname(filePath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  try {
    await access(parent, fsConstants.W_OK | fsConstants.X_OK);
  } catch {
    throw new Error(`${description} 的父目录不可写：${parent}`);
  }
}

async function assertControlledManagedKeyDestination(filePath) {
  if (!path.isAbsolute(filePath)) throw new Error("受控主密钥恢复路径必须使用绝对路径。");
  if (isDockerSecretPath(filePath)) throw new Error("Docker Secret 路径是只读外部密钥注入点，恢复禁止向其写入；请先由 Secret Manager 配置主密钥。");
  const existing = await lstat(filePath).catch(() => null);
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("受控主密钥恢复目标必须是普通文件，不能是符号链接。");
    if (!isPrivateMode(existing)) throw new Error("现有受控主密钥文件权限过宽，拒绝覆盖。");
  }
  await assertWritableParent(filePath, "受控主密钥恢复目标");
}

async function validateExternalKeyRequirement(keyManagement, destinationKeyPath) {
  if (keyManagement?.mode !== "external_secret_manager") throw new Error("备份 manifest 的主密钥管理模式无效。");
  if (args.includes("--restore-managed-key")) throw new Error("该备份不包含受控主密钥文件，不能使用 --restore-managed-key。");
  if (process.env.TZ_RELAY_MASTER_KEY) return { source: "environment" };
  const configured = String(process.env.TZ_RELAY_MASTER_KEY_FILE || "").trim();
  if (!configured) {
    throw new Error("该备份依赖外部 Secret Manager。恢复前必须设置 TZ_RELAY_MASTER_KEY 或 TZ_RELAY_MASTER_KEY_FILE，且密钥不得从备份写回。");
  }
  const externalPath = path.resolve(configured);
  const info = await stat(externalPath).catch(() => null);
  if (!info?.isFile()) throw new Error(`外部主密钥文件不可读：${externalPath}`);
  const bytes = await readFile(externalPath);
  if (bytes.length !== MASTER_KEY_BYTES && !String(process.env.TZ_RELAY_MASTER_KEY || "").trim()) {
    // File-injected keys may be encoded text in some secret managers; allow
    // the service's own startup validation to parse it. An empty file, however,
    // must never pass preflight.
    if (!bytes.length) throw new Error("外部主密钥文件为空。");
  }
  return { source: isDockerSecretPath(externalPath) ? "docker_or_platform_secret" : "external_file", path: destinationKeyPath ? undefined : undefined };
}

async function masterKeyForStagedRestore(keyManagement, stagedKeyPath = "") {
  if (keyManagement?.mode === "managed_file") {
    return loadRelayMasterKey({ masterKey: await readFile(stagedKeyPath) });
  }
  const direct = String(process.env.TZ_RELAY_MASTER_KEY || "").trim();
  if (direct) return loadRelayMasterKey({ masterKey: direct });
  const configured = String(process.env.TZ_RELAY_MASTER_KEY_FILE || "").trim();
  if (!configured) throw new Error("恢复预检缺少外部主密钥。\n");
  const bytes = await readFile(path.resolve(configured));
  try {
    return loadRelayMasterKey({ masterKey: bytes.toString("utf8").trim() });
  } catch {
    // A managed host file may hold the 32 raw bytes accepted by RelayStore,
    // while Docker/Kubernetes Secret files normally hold encoded text.
    return loadRelayMasterKey({ masterKey: bytes });
  }
}

function parseEnvelope(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid envelope");
    return parsed;
  } catch {
    throw new Error("backup contains an invalid encrypted credential envelope");
  }
}

function verifyStagedDatabaseCanDecrypt(databasePath, masterKey) {
  let candidate;
  try {
    candidate = new RelayStore({ databasePath, masterKey, runMigrations: false });
    const providerRows = candidate.db.prepare(`
      SELECT id FROM relay_provider_accounts
      WHERE token_envelope_json IS NOT NULL AND token_envelope_json <> ''
    `).all();
    for (const provider of providerRows) candidate.getProviderToken(provider.id);

    const instanceRows = candidate.db.prepare(`
      SELECT id, client_id, secret_envelope_json FROM relay_instances
    `).all();
    for (const instance of instanceRows) {
      candidate.secretBox.decrypt(
        parseEnvelope(instance.secret_envelope_json),
        `instance:${instance.id}:${instance.client_id}`
      );
    }
    return { providerCredentials: providerRows.length, instanceCredentials: instanceRows.length };
  } catch (error) {
    const wrapped = new Error("恢复预检失败：当前主密钥无法解密备份中的 Provider 或客户实例凭证；线上数据库未被替换。");
    wrapped.code = "RELAY_RESTORE_MASTER_KEY_MISMATCH";
    wrapped.cause = error;
    throw wrapped;
  } finally {
    candidate?.close();
  }
}

const backup = path.resolve(valueAfter("--backup"));
const dataDir = path.resolve(valueAfter("--data-dir", process.env.TZ_RELAY_DATA_DIR || "./data"));
const databasePath = path.resolve(valueAfter("--database", process.env.TZ_RELAY_DATABASE_PATH || path.join(dataDir, "tongzhuo-relay.sqlite")));
const explicitManagedKeyPath = String(valueAfter("--managed-master-key-file", process.env.TZ_RELAY_MANAGED_MASTER_KEY_FILE || "")).trim();
const force = args.includes("--force");
const restoreManagedKey = args.includes("--restore-managed-key");

if (!backup || !force) throw new Error("恢复操作必须指定 --backup <目录> 和 --force，并确认中转服务已经停止。");
const manifestPath = path.join(backup, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.format !== BACKUP_FORMAT || !Array.isArray(manifest.files) || !manifest.database?.fileName) {
  throw new Error("备份 manifest 格式不受支持；仅允许经过新演练验证的 v2 备份。");
}

const names = new Set();
for (const file of manifest.files) {
  if (!file || typeof file.name !== "string" || path.basename(file.name) !== file.name || names.has(file.name)) {
    throw new Error("备份 manifest 包含无效或重复文件名。");
  }
  names.add(file.name);
  const source = path.join(backup, file.name);
  if (!(await exists(source))) throw new Error(`备份文件缺失：${file.name}`);
  if (await digest(source) !== file.sha256) throw new Error(`备份文件校验失败：${file.name}`);
}

const databaseEntry = manifest.files.find((file) => file.role === "database" && file.name === manifest.database.fileName);
if (!databaseEntry) throw new Error("备份 manifest 缺少数据库快照。");
const managedKeyEntry = manifest.files.find((file) => file.role === "managed_master_key" && file.name === MANAGED_KEY_BACKUP_NAME);
const keyManagement = manifest.keyManagement || {};
let managedKeyDestination = "";

// Preflight every source, destination and key prerequisite before moving the
// live database. A rejected restore must leave the current service data intact.
if (keyManagement.mode === "managed_file") {
  if (!keyManagement.keyIncluded || !managedKeyEntry) throw new Error("受控主密钥备份不完整，拒绝恢复。");
  if (!restoreManagedKey) throw new Error("该备份包含受控主密钥；必须显式添加 --restore-managed-key 才能继续恢复。");
  if (!explicitManagedKeyPath) throw new Error("恢复受控主密钥必须提供 --managed-master-key-file（或 TZ_RELAY_MANAGED_MASTER_KEY_FILE）。");
  managedKeyDestination = path.resolve(explicitManagedKeyPath);
  await assertControlledManagedKeyDestination(managedKeyDestination);
} else if (keyManagement.mode === "external_secret_manager") {
  if (managedKeyEntry || keyManagement.keyIncluded) throw new Error("外部密钥管理备份不应包含主密钥文件。");
  await validateExternalKeyRequirement(keyManagement, "");
} else {
  throw new Error("备份 manifest 未声明受支持的主密钥管理方式。");
}

const restoreDir = path.dirname(databasePath);
await assertWritableParent(databasePath, "数据库恢复目标");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const previousDir = path.join(restoreDir, `.pre-restore-${stamp}`);
const stagedDatabasePath = path.join(restoreDir, `.restore-stage-${stamp}-${path.basename(databasePath)}`);
const stagedKeyPath = managedKeyDestination ? `${managedKeyDestination}.restore-stage-${stamp}` : "";

// Stage and verify copies before changing any current file.
await copyFile(path.join(backup, databaseEntry.name), stagedDatabasePath);
await chmod(stagedDatabasePath, 0o600).catch(() => {});
if (await digest(stagedDatabasePath) !== databaseEntry.sha256) throw new Error("数据库恢复预检失败：暂存副本校验不一致。");
if (managedKeyEntry) {
  await copyFile(path.join(backup, managedKeyEntry.name), stagedKeyPath);
  await chmod(stagedKeyPath, 0o600).catch(() => {});
  const bytes = await readFile(stagedKeyPath);
  if (bytes.length !== MASTER_KEY_BYTES || await digest(stagedKeyPath) !== managedKeyEntry.sha256) {
    throw new Error("受控主密钥恢复预检失败。");
  }
}

let keyVerification;
try {
  const stagedMasterKey = await masterKeyForStagedRestore(keyManagement, stagedKeyPath);
  keyVerification = verifyStagedDatabaseCanDecrypt(stagedDatabasePath, stagedMasterKey);
} catch (error) {
  // The live database has not been touched. Preserve rejected staged copies
  // for a privileged operator to inspect, but make their status unambiguous.
  await Promise.all([stagedDatabasePath, stagedKeyPath].filter(Boolean).map((file) => rename(file, `${file}.key-rejected`).catch(() => {})));
  throw error;
}

try {
  await mkdir(previousDir, { recursive: false, mode: 0o700 });
  for (const suffix of ["", "-wal", "-shm"]) {
    const current = `${databasePath}${suffix}`;
    if (await exists(current)) await rename(current, path.join(previousDir, path.basename(current)));
  }
  if (managedKeyDestination && await exists(managedKeyDestination)) {
    await rename(managedKeyDestination, path.join(previousDir, path.basename(managedKeyDestination)));
  }
  await rename(stagedDatabasePath, databasePath);
  if (stagedKeyPath) await rename(stagedKeyPath, managedKeyDestination);
  console.log(JSON.stringify({
    restored: manifest.backupId,
    databasePath,
    previousFiles: previousDir,
    keyManagement: { mode: keyManagement.mode, restoredManagedKey: Boolean(stagedKeyPath) },
    keyVerification
  }, null, 2));
} catch (error) {
  // Staged artifacts are harmless and help the operator diagnose a failed
  // restore. Remove only the temporary copies; never delete previous data.
  await Promise.all([stagedDatabasePath, stagedKeyPath].filter(Boolean).map((file) => rename(file, `${file}.failed`).catch(() => {})));
  throw error;
}
