import assert from "node:assert/strict";
import crypto from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createProductionBackup,
  PRIVATE_BACKUP_FORMAT,
  restoreProductionBackup,
  verifyProductionBackup
} from "./production-backup-v2.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-backup-v2-"));
const projectRoot = path.join(root, "application");
const dataDir = path.join(root, "production-data");
const backupDir = path.join(root, "backups");
const siteDir = path.join(root, "official-site");
const deployDir = path.join(root, "deployment-config");
const databasePath = path.join(dataDir, "tongzhuo-production.sqlite");
const masterKey = crypto.randomBytes(32);
const env = {
  TZ_DATA_DIR: dataDir,
  TZ_DATABASE_PATH: databasePath,
  TZ_BACKUP_DIR: backupDir,
  TZ_AI_PROVIDER_DATA_DIR: dataDir,
  TZ_PUBLISHER_DATA_DIR: dataDir,
  TZ_AI_GENERATION_DATA_DIR: dataDir,
  TZ_SITE_STATIC_ROOT: siteDir,
  TZ_DEPLOY_CONFIG_DIR: deployDir,
  TZ_MASTER_KEY: ""
};
const config = { dataDir, databasePath, backupDir };

function databaseValue() {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try { return database.prepare("SELECT value FROM sample WHERE id = 1").get().value; }
  finally { database.close(); }
}

function setDatabaseValue(value) {
  const database = new DatabaseSync(databasePath);
  try { database.prepare("UPDATE sample SET value = ? WHERE id = 1").run(value); }
  finally { database.close(); }
}

async function writeManifest(directory, manifest) {
  const buffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(directory, "manifest.json"), buffer);
  await writeFile(path.join(directory, "manifest.sha256"), `${crypto.createHash("sha256").update(buffer).digest("hex")}  manifest.json\n`);
}

try {
  await Promise.all([
    mkdir(path.join(dataDir, "secrets"), { recursive: true }),
    mkdir(path.join(siteDir, "assets", "images"), { recursive: true }),
    mkdir(path.join(deployDir, "certs"), { recursive: true }),
    mkdir(projectRoot, { recursive: true })
  ]);
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    INSERT INTO migrations VALUES (7, 'backup-v2-check', '2026-07-26T00:00:00.000Z');
    CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO sample VALUES (1, 'original-database');
  `);
  database.close();

  await Promise.all([
    writeFile(path.join(projectRoot, "package.json"), JSON.stringify({ name: "private-delivery-check", version: "2.3.4" })),
    writeFile(path.join(projectRoot, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 })),
    writeFile(path.join(dataDir, "secrets", "master.key"), masterKey),
    writeFile(path.join(dataDir, ".encryption-key"), "legacy-test-key-material"),
    writeFile(path.join(dataDir, "ai-providers.json"), JSON.stringify({ schemaVersion: 1, providers: [{ id: "deepseek", apiKeyEncrypted: { version: 1, algorithm: "aes-256-gcm", ciphertext: "test" } }] })),
    writeFile(path.join(dataDir, "publisher-state.json"), JSON.stringify({ schemaVersion: 3, devices: [{ id: "DEVICE-1" }] })),
    writeFile(path.join(dataDir, "ai-generation-runs.json"), JSON.stringify({ schemaVersion: 1, runs: [{ id: "RUN-1" }] })),
    mkdir(path.join(dataDir, "knowledge-assets", "ab", "cd"), { recursive: true }).then(() => writeFile(path.join(dataDir, "knowledge-assets", "ab", "cd", "asset-hash"), "enterprise-image-bytes")),
    writeFile(path.join(siteDir, "index.html"), "<h1>Original official site</h1>"),
    writeFile(path.join(siteDir, "assets", "styles.css"), "body { color: #123; }"),
    writeFile(path.join(siteDir, "assets", "images", "logo.txt"), "customer-logo"),
    writeFile(path.join(deployDir, "docker-compose.production.yml"), "name: original-production\n"),
    writeFile(path.join(deployDir, "admin-tls.conf"), "listen 8443 ssl;\n"),
    writeFile(path.join(deployDir, "cutover.env"), "TZ_PRODUCTION_SITE_BASE_URL=https://geo.example.test\n"),
    writeFile(path.join(deployDir, ".env"), "TZ_MASTER_KEY=must-not-enter-deployment-snapshot\n"),
    writeFile(path.join(deployDir, "certs", "server.key"), "must-not-enter-backup")
  ]);

  const primary = await createProductionBackup({
    targetDir: path.join(backupDir, "primary"), config, env, projectRoot, backupId: "CHECK-PRIMARY"
  });
  assert.equal(primary.manifest.format, PRIVATE_BACKUP_FORMAT);
  assert.equal(primary.manifest.formatVersion, 2);
  assert.equal(primary.manifest.components.database.sqlite.quickCheck, "ok");
  assert.equal(primary.manifest.components.knowledgeAssets.present, true);
  assert.equal(primary.manifest.components.knowledgeAssets.files.length, 1);
  assert.equal(primary.manifest.components.database.sqlite.migrationVersion, 7);
  assert.equal(primary.manifest.components.siteStatic.present, true);
  assert.equal(primary.manifest.components.siteStatic.files.length, 3);
  assert.ok(primary.manifest.components.deploymentConfig.files.some((item) => item.path === "cutover.env"));
  assert.ok(!primary.manifest.components.deploymentConfig.files.some((item) => item.path === ".env"));
  assert.ok(primary.manifest.components.deploymentConfig.excluded.includes(".env"));
  assert.ok(primary.manifest.components.deploymentConfig.excluded.includes("certs"));
  const verifiedPrimary = await verifyProductionBackup(primary.targetDir);
  assert.ok(verifiedPrimary.summary.components.includes("aiProviders"));
  assert.ok(verifiedPrimary.summary.components.includes("releaseMetadata"));

  const injectedMasterKey = crypto.randomBytes(32).toString("base64");
  const environmentKeyBackup = await createProductionBackup({
    targetDir: path.join(backupDir, "environment-key"), config,
    env: { ...env, TZ_MASTER_KEY: injectedMasterKey }, projectRoot,
    backupId: "CHECK-ENVIRONMENT-KEY"
  });
  assert.equal(environmentKeyBackup.manifest.masterKey.activeSource, "environment");
  setDatabaseValue("environment-key-guard");
  await assert.rejects(
    () => restoreProductionBackup({
      sourceDir: environmentKeyBackup.targetDir, force: true, skipSafetySnapshot: true, config,
      env: { ...env, TZ_MASTER_KEY: crypto.randomBytes(32).toString("base64") }, projectRoot
    }),
    /TZ_MASTER_KEY.*不一致|指纹不一致/
  );
  assert.equal(databaseValue(), "environment-key-guard");
  await restoreProductionBackup({
    sourceDir: environmentKeyBackup.targetDir, force: true, skipSafetySnapshot: true, config,
    env: { ...env, TZ_MASTER_KEY: injectedMasterKey }, projectRoot
  });
  assert.equal(databaseValue(), "original-database");

  setDatabaseValue("changed-before-restore");
  await Promise.all([
    writeFile(path.join(dataDir, "ai-providers.json"), JSON.stringify({ schemaVersion: 1, providers: [] })),
    writeFile(path.join(dataDir, "publisher-state.json"), JSON.stringify({ schemaVersion: 3, devices: [] })),
    writeFile(path.join(dataDir, "ai-generation-runs.json"), JSON.stringify({ schemaVersion: 1, runs: [] })),
    writeFile(path.join(siteDir, "index.html"), "changed-site"),
    writeFile(path.join(siteDir, "remove-me.txt"), "not-in-backup"),
    writeFile(path.join(deployDir, "docker-compose.production.yml"), "name: changed-production\n"),
    writeFile(path.join(deployDir, ".env"), "TZ_MASTER_KEY=current-secret-stays\n")
  ]);

  const restored = await restoreProductionBackup({
    sourceDir: primary.targetDir, force: true, config, env, projectRoot
  });
  assert.equal(databaseValue(), "original-database");
  assert.match(await readFile(path.join(dataDir, "ai-providers.json"), "utf8"), /deepseek/);
  assert.match(await readFile(path.join(dataDir, "publisher-state.json"), "utf8"), /DEVICE-1/);
  assert.match(await readFile(path.join(dataDir, "ai-generation-runs.json"), "utf8"), /RUN-1/);
  assert.equal(await readFile(path.join(dataDir, "knowledge-assets", "ab", "cd", "asset-hash"), "utf8"), "enterprise-image-bytes");
  assert.equal(await readFile(path.join(siteDir, "index.html"), "utf8"), "<h1>Original official site</h1>");
  await assert.rejects(() => readFile(path.join(siteDir, "remove-me.txt")), (error) => error?.code === "ENOENT");
  assert.equal(await readFile(path.join(deployDir, "docker-compose.production.yml"), "utf8"), "name: original-production\n");
  assert.equal(await readFile(path.join(deployDir, ".env"), "utf8"), "TZ_MASTER_KEY=current-secret-stays\n");
  assert.ok(restored.safetySnapshot);
  assert.equal((await verifyProductionBackup(restored.safetySnapshot)).manifest.purpose, "pre-restore");

  // A v2 manifest explicitly records optional-state absence. Restoring that
  // point in time removes a later file without treating the absence as damage.
  await rm(path.join(dataDir, "ai-generation-runs.json"));
  const withoutRuns = await createProductionBackup({
    targetDir: path.join(backupDir, "without-runs"), config, env, projectRoot, backupId: "CHECK-WITHOUT-RUNS"
  });
  assert.equal(withoutRuns.manifest.components.aiGenerationRuns.present, false);
  await writeFile(path.join(dataDir, "ai-generation-runs.json"), "later-run-state");
  await restoreProductionBackup({ sourceDir: withoutRuns.targetDir, force: true, skipSafetySnapshot: true, config, env, projectRoot });
  await assert.rejects(() => readFile(path.join(dataDir, "ai-generation-runs.json")), (error) => error?.code === "ENOENT");

  // Transaction failure after replacing two targets must put both originals
  // back and leave no half-restored production state.
  setDatabaseValue("transaction-original");
  await writeFile(path.join(dataDir, "secrets", "master.key"), Buffer.alloc(32, 9));
  await assert.rejects(
    () => restoreProductionBackup({ sourceDir: primary.targetDir, force: true, skipSafetySnapshot: true, failCommitAfter: 2, config, env, projectRoot }),
    /恢复提交中断/
  );
  assert.equal(databaseValue(), "transaction-original");
  assert.deepEqual(await readFile(path.join(dataDir, "secrets", "master.key")), Buffer.alloc(32, 9));

  const traversal = path.join(backupDir, "malicious-traversal");
  await cp(primary.targetDir, traversal, { recursive: true });
  const traversalManifest = JSON.parse(await readFile(path.join(traversal, "manifest.json"), "utf8"));
  traversalManifest.components.siteStatic.files[0].path = "../escape.html";
  await writeManifest(traversal, traversalManifest);
  await assert.rejects(() => verifyProductionBackup(traversal), /路径穿越|安全的相对路径|无效片段/);

  const tampered = path.join(backupDir, "tampered-content");
  await cp(primary.targetDir, tampered, { recursive: true });
  await writeFile(path.join(tampered, "payload", "state", "publisher-state.json"), "tampered");
  await assert.rejects(() => verifyProductionBackup(tampered), /SHA256 校验失败/);

  // Existing v1 database/master-key backups remain recoverable. Optional v2
  // components are left untouched because v1 never declared their state.
  const legacy = path.join(backupDir, "legacy-v1");
  await mkdir(legacy, { recursive: true });
  await cp(path.join(primary.targetDir, "payload", "database", "tongzhuo-production.sqlite"), path.join(legacy, "tongzhuo-production.sqlite"));
  await cp(path.join(primary.targetDir, "payload", "secrets", "data-master.key"), path.join(legacy, "master.key"));
  const legacyDatabase = await readFile(path.join(legacy, "tongzhuo-production.sqlite"));
  const legacyKey = await readFile(path.join(legacy, "master.key"));
  await writeFile(path.join(legacy, "manifest.json"), JSON.stringify({
    format: "tongzhuo-private-backup-v1",
    database: { file: "tongzhuo-production.sqlite", sha256: crypto.createHash("sha256").update(legacyDatabase).digest("hex") },
    masterKey: { file: "master.key", sha256: crypto.createHash("sha256").update(legacyKey).digest("hex") }
  }));
  assert.equal((await verifyProductionBackup(legacy)).format, "tongzhuo-private-backup-v1");
  setDatabaseValue("before-v1-restore");
  await writeFile(path.join(dataDir, "publisher-state.json"), "v1-must-not-touch-this");
  await restoreProductionBackup({ sourceDir: legacy, force: true, skipSafetySnapshot: true, config, env, projectRoot });
  assert.equal(databaseValue(), "original-database");
  assert.equal(await readFile(path.join(dataDir, "publisher-state.json"), "utf8"), "v1-must-not-touch-this");

  const leftovers = (await readdir(dataDir)).filter((name) => name.includes(".tz-next-") || name.includes(".tz-previous-"));
  assert.deepEqual(leftovers, []);
  console.log("Production backup/restore v2 check passed");
} finally {
  await rm(root, { recursive: true, force: true });
}
