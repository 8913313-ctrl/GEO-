import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { RelayStore } from "../relay-store.mjs";

const execFileAsync = promisify(execFile);
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-relay-backup-check-"));
const dataDir = path.join(tempRoot, "data");
const databasePath = path.join(dataDir, "tongzhuo-relay.sqlite");
const backupDir = path.join(tempRoot, "backups");
const masterKey = Buffer.alloc(32, 37);
const masterKeyText = masterKey.toString("base64url");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const childEnv = {
  ...process.env,
  TZ_RELAY_DATA_DIR: dataDir,
  TZ_RELAY_DATABASE_PATH: databasePath,
  TZ_RELAY_BACKUP_DIR: backupDir,
  TZ_RELAY_MASTER_KEY: masterKeyText,
  TZ_RELAY_MASTER_KEY_FILE: ""
};

async function run(script, args = [], environment = childEnv) {
  return execFileAsync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    env: environment,
    windowsHide: true
  });
}

let store;
try {
  store = new RelayStore({ databasePath, dataDir, masterKey });
  store.createTenant({ tenantId: "tenant-backup-source", displayName: "Backup source tenant", initialCredits: 25 });
  store.upsertProviderAccount({
    providerAccountId: "provider-backup-source",
    providerCode: "aidso",
    displayName: "Backup source provider",
    isDefault: true,
    capabilities: { version: "backup-check", platforms: [{ code: "DB", terminals: ["web"], modes: ["fast"] }] },
    token: "backup-source-provider-token"
  });
  store.provisionInstance({
    tenantId: "tenant-backup-source",
    instanceId: "instance-backup-source",
    clientId: "client-backup-source",
    clientSecret: "backup-source-instance-secret",
    providerAccountId: "provider-backup-source",
    allowedCapabilities: { allowedPlatforms: ["DB"], items: [{ platform: "DB", terminal: "web", mode: "fast" }] }
  });
  store.close();
  store = null;

  await run("scripts/backup-relay.mjs", ["--retention-days", "30"]);
  const backupNames = (await readdir(backupDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("backup-"))
    .map((entry) => entry.name);
  assert.equal(backupNames.length, 1, "backup command must create one recovery snapshot");

  const backupPath = path.join(backupDir, backupNames[0]);
  const manifest = JSON.parse(await readFile(path.join(backupPath, "manifest.json"), "utf8"));
  assert.equal(manifest.format, "tongzhuo-relay-backup-v2");
  assert.equal(manifest.keyManagement.mode, "external_secret_manager");
  assert.equal(manifest.keyManagement.keyIncluded, false, "environment-managed master keys must never be copied into a backup");
  const verified = JSON.parse((await run("scripts/verify-relay-backup.mjs", ["--backup", backupPath])).stdout);
  assert.equal(verified.restorableWithCurrentMasterKey, true, "the scheduled backup verifier must validate the current master key");
  assert.equal(verified.providerCredentials, 1, "the backup verifier must decrypt provider credentials");
  assert.equal(verified.instanceCredentials, 1, "the backup verifier must decrypt instance credentials");

  store = new RelayStore({ databasePath, dataDir, masterKey });
  store.createTenant({ tenantId: "tenant-after-backup", displayName: "Mutation after backup", initialCredits: 10 });
  store.close();
  store = null;

  const wrongKeyEnvironment = {
    ...childEnv,
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 38).toString("base64url")
  };
  await assert.rejects(
    () => run("scripts/restore-relay.mjs", ["--backup", backupPath, "--force"], wrongKeyEnvironment),
    (error) => String(error?.stderr || error?.message || "").includes("恢复预检失败"),
    "restore must reject an external master key that cannot decrypt staged credentials before it touches the live database"
  );
  store = new RelayStore({ databasePath, dataDir, masterKey });
  assert.ok(store.getTenant("tenant-after-backup"), "a rejected key preflight must leave the live database untouched");
  store.close();
  store = null;

  await run("scripts/restore-relay.mjs", ["--backup", backupPath, "--force"]);
  store = new RelayStore({ databasePath, dataDir, masterKey });
  assert.ok(store.getTenant("tenant-backup-source"), "the backup tenant must be restored");
  assert.equal(store.getTenant("tenant-after-backup"), null, "post-backup mutations must not survive restore");
  store.close();
  store = null;

  console.log("Relay backup and external-secret restore rehearsal passed.");
} finally {
  store?.close();
  await rm(tempRoot, { recursive: true, force: true });
}
