import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { chmod, copyFile, lstat, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BACKUP_FORMAT = "tongzhuo-relay-backup-v2";
const MANAGED_KEY_BACKUP_NAME = "relay-managed-master.key";
const MASTER_KEY_BYTES = 32;

function valueAfter(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]) : fallback;
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function isoStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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

async function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(await readFile(filePath));
  return `sha256:${hash.digest("hex")}`;
}

async function assertControlledManagedKey(filePath) {
  if (!path.isAbsolute(filePath)) throw new Error("受控主密钥文件必须使用绝对路径。");
  if (isDockerSecretPath(filePath)) throw new Error("Docker Secret 路径只能由外部 Secret Manager 管理，禁止随中转站备份复制。");
  const info = await lstat(filePath).catch(() => null);
  if (!info || !info.isFile() || info.isSymbolicLink()) {
    throw new Error("受控主密钥文件必须是已存在、非符号链接的常规文件。");
  }
  if (!isPrivateMode(info)) throw new Error("受控主密钥文件权限必须禁止组和其他用户读取。");
  const bytes = await readFile(filePath);
  if (bytes.length !== MASTER_KEY_BYTES) throw new Error("受控主密钥文件必须恰好包含 32 个原始随机字节。");
  return info;
}

function resolveConfiguredKeySource(dataDir) {
  const directKey = String(process.env.TZ_RELAY_MASTER_KEY || "").trim();
  const explicitKeyFile = String(process.env.TZ_RELAY_MASTER_KEY_FILE || "").trim();
  return {
    directKey,
    explicitKeyFile: explicitKeyFile ? path.resolve(explicitKeyFile) : "",
    effectiveFile: explicitKeyFile ? path.resolve(explicitKeyFile) : path.join(dataDir, "secrets", "relay-master.key")
  };
}

async function resolveKeyManagement(args, dataDir) {
  const includeManagedKey = args.includes("--include-managed-key");
  const configuredManagedPath = String(valueAfter(args, "--managed-master-key-file", process.env.TZ_RELAY_MANAGED_MASTER_KEY_FILE || "")).trim();
  if (!includeManagedKey) {
    return {
      mode: "external_secret_manager",
      keyIncluded: false,
      restoreRequirement: "Provision the production master key separately from the approved Secret Manager before restore."
    };
  }
  if (!configuredManagedPath) {
    throw new Error("--include-managed-key 仅适用于显式 --managed-master-key-file（或 TZ_RELAY_MANAGED_MASTER_KEY_FILE）指定的受控可写文件。");
  }
  const managedPath = path.resolve(configuredManagedPath);
  const source = resolveConfiguredKeySource(dataDir);
  if (source.directKey) {
    throw new Error("当前使用 TZ_RELAY_MASTER_KEY 注入主密钥；该密钥由外部 Secret Manager 管理，禁止复制到备份中。");
  }
  if (source.explicitKeyFile && source.explicitKeyFile !== managedPath) {
    throw new Error("TZ_RELAY_MASTER_KEY_FILE 与受控备份密钥文件不一致；为避免复制错误密钥，已拒绝备份。");
  }
  if (!source.explicitKeyFile && source.effectiveFile !== managedPath) {
    throw new Error("受控备份密钥文件必须与中转服务实际使用的本地主密钥文件一致。");
  }
  await assertControlledManagedKey(managedPath);
  return {
    mode: "managed_file",
    keyIncluded: true,
    backupFileName: MANAGED_KEY_BACKUP_NAME,
    restoreRequirement: "Restore requires --restore-managed-key and the same explicitly configured controlled writable key file. Docker Secret paths are never writable by restore."
  };
}

const args = process.argv.slice(2);
const dataDir = path.resolve(valueAfter(args, "--data-dir", process.env.TZ_RELAY_DATA_DIR || "./data"));
const databasePath = path.resolve(valueAfter(args, "--database", process.env.TZ_RELAY_DATABASE_PATH || path.join(dataDir, "tongzhuo-relay.sqlite")));
const outputDir = path.resolve(valueAfter(args, "--output-dir", process.env.TZ_RELAY_BACKUP_DIR || path.join(dataDir, "backups")));
const retentionDays = integer(valueAfter(args, "--retention-days", process.env.TZ_RELAY_BACKUP_RETENTION_DAYS || "30"), 30, 1, 3_650);
const dryRun = args.includes("--dry-run");
const backupId = `backup-${isoStamp()}`;
const destination = path.join(outputDir, backupId);
const databaseBackupName = path.basename(databasePath);

if (!(await stat(databasePath).catch(() => null))) throw new Error(`数据库不存在：${databasePath}`);
const keyManagement = await resolveKeyManagement(args, dataDir);

if (dryRun) {
  console.log(JSON.stringify({
    dryRun: true,
    databasePath,
    outputDir,
    retentionDays,
    destination,
    keyManagement: { mode: keyManagement.mode, keyIncluded: keyManagement.keyIncluded }
  }, null, 2));
  process.exit(0);
}

await mkdir(outputDir, { recursive: true, mode: 0o700 });
await mkdir(destination, { recursive: false, mode: 0o700 });
const files = [];
try {
  // VACUUM INTO creates a transactionally consistent SQLite snapshot even while
  // the relay continues appending to its WAL. The resulting backup is a single
  // standalone database file; copying a live database and WAL independently is
  // intentionally avoided.
  const databaseTarget = path.join(destination, databaseBackupName);
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA busy_timeout = 10000");
    database.exec(`VACUUM INTO ${sqlLiteral(databaseTarget)}`);
  } finally {
    database.close();
  }
  await chmod(databaseTarget, 0o600).catch(() => {});
  files.push({ name: databaseBackupName, role: "database", sha256: await sha256(databaseTarget) });

  if (keyManagement.keyIncluded) {
    const managedPath = path.resolve(valueAfter(args, "--managed-master-key-file", process.env.TZ_RELAY_MANAGED_MASTER_KEY_FILE || ""));
    const target = path.join(destination, MANAGED_KEY_BACKUP_NAME);
    await copyFile(managedPath, target);
    await chmod(target, 0o600).catch(() => {});
    files.push({ name: MANAGED_KEY_BACKUP_NAME, role: "managed_master_key", sha256: await sha256(target) });
  }

  const manifest = {
    format: BACKUP_FORMAT,
    backupId,
    createdAt: new Date().toISOString(),
    database: {
      fileName: databaseBackupName,
      snapshotMethod: "sqlite_vacuum_into",
      sourceJournalMode: "wal"
    },
    keyManagement,
    retentionDays,
    files
  };
  await writeFile(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const cutoff = Date.now() - retentionDays * 86_400_000;
  const entries = await readdir(outputDir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("backup-") || entry.name === backupId) continue;
    const candidate = path.join(outputDir, entry.name);
    const info = await stat(candidate).catch(() => null);
    if (info && info.mtimeMs < cutoff) {
      await rm(candidate, { recursive: true, force: true });
      removed += 1;
    }
  }

  console.log(JSON.stringify({
    backup: {
      backupId,
      format: BACKUP_FORMAT,
      databaseFile: databaseBackupName,
      keyManagement: { mode: keyManagement.mode, keyIncluded: keyManagement.keyIncluded }
    },
    removedExpiredBackups: removed,
    destination
  }, null, 2));
} catch (error) {
  // The destination was created exclusively by this invocation and contains no
  // previous backup data, so removing it here is recoverable and prevents a
  // partial snapshot from being mistaken for a restore candidate.
  await rm(destination, { recursive: true, force: true }).catch(() => {});
  throw error;
}
