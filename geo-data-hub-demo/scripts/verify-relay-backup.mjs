import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RelaySecretBox, loadRelayMasterKey } from "../relay-store.mjs";

const BACKUP_FORMAT = "tongzhuo-relay-backup-v2";
const args = process.argv.slice(2);

function valueAfter(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]) : fallback;
}

async function sha256(filePath) {
  return `sha256:${crypto.createHash("sha256").update(await readFile(filePath)).digest("hex")}`;
}

async function latestBackup(backupDir) {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("backup-")).map((entry) => entry.name).sort().reverse();
  if (!names.length) throw new Error(`备份目录中没有可验证的 backup-* 快照：${backupDir}`);
  return path.join(backupDir, names[0]);
}

async function privateRegularFile(filePath, label) {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`${label}不是常规文件或为符号链接：${filePath}`);
  if (process.platform !== "win32" && (Number(info.mode) & 0o077) !== 0) throw new Error(`${label}权限过宽：${filePath}`);
  return info;
}

async function resolveMasterKey() {
  const direct = String(process.env.TZ_RELAY_MASTER_KEY || "").trim();
  if (direct) return loadRelayMasterKey({ masterKey: direct });
  const configured = String(process.env.TZ_RELAY_MASTER_KEY_FILE || "").trim();
  if (!configured) throw new Error("备份验证必须通过 TZ_RELAY_MASTER_KEY 或 TZ_RELAY_MASTER_KEY_FILE 注入主密钥，验证过程不会从备份猜测密钥。");
  const keyPath = path.resolve(configured);
  await privateRegularFile(keyPath, "主密钥文件");
  const bytes = await readFile(keyPath);
  try {
    return loadRelayMasterKey({ masterKey: bytes.toString("utf8").trim() });
  } catch {
    return loadRelayMasterKey({ masterKey: bytes });
  }
}

const configuredBackup = String(valueAfter("--backup", "")).trim();
const backupDir = path.resolve(valueAfter("--backup-dir", process.env.TZ_RELAY_BACKUP_DIR || "./data/backups"));
const backupPath = configuredBackup ? path.resolve(configuredBackup) : await latestBackup(backupDir);
const manifestPath = path.join(backupPath, "manifest.json");
await privateRegularFile(manifestPath, "备份清单");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.format !== BACKUP_FORMAT || !Array.isArray(manifest.files) || !manifest.database?.fileName) throw new Error("备份清单格式不受支持。");

const names = new Set();
for (const entry of manifest.files) {
  if (!entry || typeof entry.name !== "string" || path.basename(entry.name) !== entry.name || names.has(entry.name)) throw new Error("备份清单包含非法或重复文件名。");
  names.add(entry.name);
  const filePath = path.join(backupPath, entry.name);
  await privateRegularFile(filePath, `备份文件 ${entry.name}`);
  if (await sha256(filePath) !== entry.sha256) throw new Error(`备份文件摘要不一致：${entry.name}`);
}

const databaseEntry = manifest.files.find((entry) => entry.role === "database" && entry.name === manifest.database.fileName);
if (!databaseEntry) throw new Error("备份清单缺少数据库快照。");
const databasePath = path.join(backupPath, databaseEntry.name);
const database = new DatabaseSync(databasePath, { readOnly: true });
let integrity = "";
let foreignKeyViolations = [];
try {
  integrity = String(database.prepare("PRAGMA quick_check").get()?.quick_check || "");
  foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all();
} finally {
  database.close();
}
if (integrity !== "ok") throw new Error(`SQLite 完整性检查失败：${integrity || "unknown"}`);
if (foreignKeyViolations.length) throw new Error(`SQLite 外键检查发现 ${foreignKeyViolations.length} 个问题。`);

const masterKey = await resolveMasterKey();
let providerCredentials = 0;
let instanceCredentials = 0;
// Use a read-only SQLite handle and the standalone secret box. Opening a
// RelayStore here could create a WAL sidecar or update pragmas, which would
// change the snapshot hash after it was verified.
const credentialsDb = new DatabaseSync(databasePath, { readOnly: true });
const secretBox = new RelaySecretBox({ masterKey });
try {
  const providers = credentialsDb.prepare("SELECT id, token_envelope_json FROM relay_provider_accounts WHERE token_envelope_json IS NOT NULL AND token_envelope_json <> ''").all();
  for (const provider of providers) secretBox.decrypt(JSON.parse(provider.token_envelope_json), `provider:${provider.id}`);
  providerCredentials = providers.length;
  const instances = credentialsDb.prepare("SELECT id, client_id, secret_envelope_json FROM relay_instances").all();
  for (const instance of instances) secretBox.decrypt(JSON.parse(instance.secret_envelope_json), `instance:${instance.id}:${instance.client_id}`);
  instanceCredentials = instances.length;
} finally {
  credentialsDb.close();
}

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  backupId: manifest.backupId,
  backupPath,
  integrity,
  foreignKeyViolations: 0,
  providerCredentials,
  instanceCredentials,
  restorableWithCurrentMasterKey: true
}, null, 2));
