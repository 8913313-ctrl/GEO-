import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createProductionBackup, verifyProductionBackup } from "./production-backup-v2.mjs";
import "./check-private-delivery-operations.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(projectRoot, "scripts", "build-private-delivery.mjs");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const testRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-private-delivery-"));

function runBuilder(argumentsList, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [builder, ...argumentsList], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });
  assert.equal(result.status, expectedStatus, `builder status\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  return result;
}

async function walk(root, relative = "") {
  const output = [];
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    const child = relative ? path.join(relative, entry.name) : entry.name;
    const info = await lstat(path.join(root, child));
    assert.equal(info.isSymbolicLink(), false, `bundle symlink: ${child}`);
    if (info.isDirectory()) output.push(...await walk(root, child));
    else output.push(child.split(path.sep).join("/"));
  }
  return output;
}

async function assertSums(bundleRoot) {
  const lines = (await readFile(path.join(bundleRoot, "SHA256SUMS"), "utf8")).trim().split(/\r?\n/);
  assert.ok(lines.length > 20);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  ([^\\]+)$/);
    assert.ok(match, `invalid checksum line: ${line}`);
    const target = path.resolve(bundleRoot, ...match[2].split("/"));
    const relative = path.relative(bundleRoot, target);
    assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    const actual = crypto.createHash("sha256").update(await readFile(target)).digest("hex");
    assert.equal(actual, match[1], match[2]);
  }
}

async function exists(target) {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function createBackupFixture(root, options = {}) {
  const dataDir = path.join(root, "data");
  const siteDir = path.join(root, "site");
  const deployDir = path.join(root, "deploy");
  const appDir = path.join(root, "app");
  const databasePath = path.join(dataDir, "tongzhuo-production.sqlite");
  await Promise.all([
    mkdir(path.join(dataDir, "secrets"), { recursive: true }),
    mkdir(path.join(siteDir, "assets"), { recursive: true }),
    mkdir(deployDir, { recursive: true }),
    mkdir(appDir, { recursive: true })
  ]);
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    INSERT INTO migrations VALUES (9, 'private-delivery-check', '2026-07-26T00:00:00.000Z');
    CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO sample VALUES (1, 'customer-fixture');
  `);
  database.close();
  await Promise.all([
    writeFile(path.join(appDir, "package.json"), JSON.stringify({ name: "private-delivery-fixture", version: "9.0.0" })),
    writeFile(path.join(dataDir, "secrets", "master.key"), crypto.randomBytes(32)),
    writeFile(path.join(dataDir, "ai-providers.json"), JSON.stringify({ schemaVersion: 1, providers: [] })),
    writeFile(path.join(dataDir, "publisher-state.json"), JSON.stringify({ schemaVersion: 3, devices: [] })),
    writeFile(path.join(dataDir, "ai-generation-runs.json"), JSON.stringify({ schemaVersion: 1, runs: [] })),
    writeFile(path.join(siteDir, "index.html"), "<h1>Customer fixture</h1>"),
    writeFile(path.join(siteDir, "assets", "site.css"), "body{color:#123}"),
    writeFile(path.join(deployDir, "cutover.env"), "TZ_PRODUCTION_SITE_BASE_URL=https://customer.example.test\n")
  ]);
  const backupDir = path.join(root, "backup-v2");
  await createProductionBackup({
    targetDir: backupDir,
    backupId: "DELIVERY-CHECK",
    projectRoot: appDir,
    config: { dataDir, databasePath, backupDir: path.join(root, "backups") },
    env: {
      TZ_DATA_DIR: dataDir,
      TZ_DATABASE_PATH: databasePath,
      TZ_BACKUP_DIR: path.join(root, "backups"),
      TZ_AI_PROVIDER_DATA_DIR: dataDir,
      TZ_PUBLISHER_DATA_DIR: dataDir,
      TZ_AI_GENERATION_DATA_DIR: dataDir,
      TZ_SITE_STATIC_ROOT: siteDir,
      TZ_DEPLOY_CONFIG_DIR: deployDir,
      TZ_MASTER_KEY: options.environmentMasterKey || ""
    }
  });
  return backupDir;
}

try {
  const blankOutput = path.join(testRoot, "blank-output");
  runBuilder(["--mode", "blank", "--output", blankOutput, "--no-archive"]);
  const blankRoot = path.join(blankOutput, `tongzhuo-geo-private-${packageJson.version}-blank`);
  const blankManifest = JSON.parse(await readFile(path.join(blankRoot, "manifest.json"), "utf8"));
  assert.equal(blankManifest.deliveryMode, "blank");
  assert.match(blankManifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(typeof blankManifest.sourceDirty, "boolean");
  assert.equal(blankManifest.security.containsCustomerData, false);
  assert.equal(blankManifest.security.containsRecoverySecrets, false);
  assert.equal(blankManifest.migration, null);
  const blankFiles = await walk(blankRoot);
  assert.ok(blankFiles.includes("app/package.json"));
  assert.ok(blankFiles.includes("app/SOURCE_VERSION"));
  assert.equal((await readFile(path.join(blankRoot, "app", "SOURCE_VERSION"), "utf8")).trim(), blankManifest.sourceCommit);
  for (const foundationFile of [
    "app/foundation-asset-store.mjs",
    "app/foundation-assets/bootstrap.mjs",
    "app/industry-templates/index.mjs",
    "app/project-seeds/index.mjs"
  ]) assert.ok(blankFiles.includes(foundationFile), `delivery must include ${foundationFile}`);
  for (const runtimeFile of ["analysis-workbench-store.mjs", "analysis-workbench-engine.mjs", "analysis-workbench-api.mjs", "citation-document-update-store.mjs", "citation-document-update-api.mjs", "research-document-store.mjs"]) {
    assert.ok(blankFiles.includes(`app/${runtimeFile}`), `delivery must include ${runtimeFile}`);
  }
  for (const operatorScript of ["install.sh", "manage.sh", "preflight.sh", "upgrade.sh", "verify.sh"]) {
    assert.ok(blankFiles.includes(`operations/${operatorScript}`), operatorScript);
    assert.ok(blankFiles.includes(`app/deploy/private-delivery/${operatorScript}`), `release ${operatorScript}`);
  }
  assert.ok(blankFiles.includes("site-template/index.html"));
  for (const placeholder of [
    "app/deploy/private-delivery/compose-placeholders/relay-client-secret.disabled",
    "app/deploy/private-delivery/compose-placeholders/ad-hoc-diagnostic-api-token.disabled"
  ]) {
    assert.ok(blankFiles.includes(placeholder), `blank delivery must include disabled Compose input: ${placeholder}`);
    assert.equal((await readFile(path.join(blankRoot, ...placeholder.split("/")), "utf8")).trim(), "", `${placeholder} must not contain a credential`);
  }
  const blankAppRoot = path.join(blankRoot, "app");
  const blankConfigProbe = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { productionConfig } from './production-config.mjs'; console.log(JSON.stringify({ relay: productionConfig.relayClientSecret, adHoc: productionConfig.adHocDiagnosticApiToken }));"
  ], {
    cwd: blankAppRoot,
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TZ_BIND_HOST: "127.0.0.1",
      PORT: "43127",
      TZ_RELAY_BASE_URL: "",
      TZ_RELAY_INSTANCE_ID: "",
      TZ_RELAY_CLIENT_ID: "",
      TZ_RELAY_CLIENT_SECRET: "",
      TZ_RELAY_CLIENT_SECRET_FILE: "",
      TZ_AD_HOC_DIAGNOSTIC_API_TOKEN: "",
      TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE: ""
    }
  });
  assert.equal(blankConfigProbe.status, 0, `blank placeholder config probe failed: ${blankConfigProbe.stderr}`);
  assert.deepEqual(JSON.parse(blankConfigProbe.stdout), { relay: "", adHoc: "" });
  const productionCompose = await readFile(path.join(blankRoot, "app", "deploy", "docker-compose.production.yml"), "utf8");
  assert.match(productionCompose, /user:\s*["']0:0["']/);
  assert.match(productionCompose, /\/run\/tongzhuo-runtime-secrets:rw,noexec,nosuid,nodev,size=1m/);
  assert.match(productionCompose, /TZ_RELAY_CLIENT_SECRET_FILE:\s*\/run\/tongzhuo-runtime-secrets\/tz_relay_client_secret/);
  assert.match(productionCompose, /TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE:\s*\/run\/tongzhuo-runtime-secrets\/tz_ad_hoc_diagnostic_api_token/);
  assert.match(productionCompose, /tz_relay_client_secret:\s*\n\s*file: \$\{TZ_RELAY_CLIENT_SECRET_HOST_PATH:-\.\/private-delivery\/compose-placeholders\/relay-client-secret\.disabled\}/);
  assert.match(productionCompose, /tz_ad_hoc_diagnostic_api_token:\s*\n\s*file: \$\{TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH:-\.\/private-delivery\/compose-placeholders\/ad-hoc-diagnostic-api-token\.disabled\}/);
  assert.doesNotMatch(productionCompose, /^\s+TZ_RELAY_CLIENT_SECRET:\s/m, "production Compose must not accept a plaintext relay HMAC environment variable");
  assert.doesNotMatch(productionCompose, /^\s+TZ_AD_HOC_DIAGNOSTIC_API_TOKEN:\s/m, "production Compose must not accept a plaintext ad-hoc token environment variable");
  const privateAppEnvironment = await readFile(path.join(blankRoot, "app", "deploy", "private-delivery", "app.env.example"), "utf8");
  assert.doesNotMatch(privateAppEnvironment, /^TZ_RELAY_CLIENT_SECRET=/m, "private-delivery app.env template must not offer a plaintext relay HMAC field");
  assert.doesNotMatch(privateAppEnvironment, /^TZ_AD_HOC_DIAGNOSTIC_API_TOKEN=/m, "private-delivery app.env template must not offer a plaintext ad-hoc token field");
  const privateCutoverEnvironment = await readFile(path.join(blankRoot, "app", "deploy", "private-delivery", "cutover.env.example"), "utf8");
  assert.match(privateCutoverEnvironment, /^TZ_RELAY_CLIENT_SECRET_HOST_PATH=$/m);
  assert.match(privateCutoverEnvironment, /^TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH=$/m);
  const privateLibrary = await readFile(path.join(blankRoot, "app", "deploy", "private-delivery", "lib.sh"), "utf8");
  assert.match(privateLibrary, /pd_normalize_disabled_compose_secret_placeholders/);
  assert.match(privateLibrary, /chmod 600 "\$placeholder"/);
  const privateVerifier = await readFile(path.join(blankRoot, "app", "deploy", "private-delivery", "verify.sh"), "utf8");
  assert.match(privateVerifier, /TZ_RELAY_CLIENT_SECRET_HOST_PATH/);
  assert.match(privateVerifier, /TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH/);
  assert.match(privateVerifier, /plaintext relay or ad-hoc secret environment variable/);
  assert.match(privateVerifier, /tongzhuo-runtime-secrets/);
  assert.match(privateVerifier, /bootstrap did not create the expected root:node tmpfs/);
  const adminEntrypoint = await readFile(path.join(blankRoot, "app", "deploy", "geo-admin-entrypoint.sh"), "utf8");
  assert.match(adminEntrypoint, /su-exec node:node/);
  assert.match(adminEntrypoint, /\/run\/secrets\/tz_relay_client_secret/);
  const adminDockerfile = await readFile(path.join(blankRoot, "app", "Dockerfile"), "utf8");
  assert.match(adminDockerfile, /apk add --no-cache su-exec/);
  assert.match(adminDockerfile, /ENTRYPOINT \["\/app\/deploy\/geo-admin-entrypoint\.sh"\]/);
  const stagingCompose = await readFile(path.join(blankRoot, "app", "deploy", "docker-compose.staging.yml"), "utf8");
  for (const override of [
    "TZ_RELAY_BASE_URL: \"\"",
    "TZ_RELAY_CLIENT_SECRET: \"\"",
    "TZ_RELAY_CLIENT_SECRET_FILE: \"\"",
    "TZ_AD_HOC_DIAGNOSTIC_API_TOKEN: \"\"",
    "TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE: \"\""
  ]) assert.ok(stagingCompose.includes(override), `staging must explicitly disable production credential: ${override}`);
  assert.ok(!blankFiles.some((name) => {
    const blockedSegments = name.toLocaleLowerCase("en-US").split("/")
      .filter((segment) => ["data", "backups", "secrets", "migration"].includes(segment));
    const isCitationSnapshotDocument = /^app\/research-packages\/geo-citation-lab\/document-snapshots\/[a-f0-9]{40}\//i.test(name);
    const allowedSnapshotData = isCitationSnapshotDocument
      && blockedSegments.length > 0
      && blockedSegments.every((segment) => segment === "data");
    return blockedSegments.length > 0 && !allowedSnapshotData;
  }));
  assert.ok(!blankFiles.some((name) => /(^|\/)(?:\.env|master\.key|\.encryption-key|ai-providers\.json|publisher-state\.json|ai-generation-runs\.json)$/i.test(name)));
  const blankSqliteFiles = blankFiles.filter((name) => /\.sqlite(?:-|$)/i.test(name));
  assert.deepEqual(blankSqliteFiles, ["app/research-packages/geo-citation-lab/2.0.1/derived/citation-research.sqlite"]);
  const documentPackageRoot = path.join(blankRoot, "app", "research-packages", "geo-citation-lab");
  const documentActiveRelative = "app/research-packages/geo-citation-lab/.document-updates/document-active.json";
  assert.ok(blankFiles.includes(documentActiveRelative));
  const documentActive = JSON.parse(await readFile(path.join(blankRoot, ...documentActiveRelative.split("/")), "utf8"));
  assert.match(documentActive.activeCommit, /^[a-f0-9]{40}$/i);
  assert.equal(documentActive.snapshotRelativePath, `document-snapshots/${documentActive.activeCommit}`);
  const activeSnapshotRoot = path.join(documentPackageRoot, ...documentActive.snapshotRelativePath.split("/"));
  const activeSnapshotManifestPath = path.join(activeSnapshotRoot, ".citation-document-snapshot.json");
  const activeSnapshotManifestBuffer = await readFile(activeSnapshotManifestPath);
  assert.equal(
    crypto.createHash("sha256").update(activeSnapshotManifestBuffer).digest("hex"),
    documentActive.manifestSha256,
    "document-active.json must identify the packaged snapshot manifest"
  );
  const activeSnapshotManifest = JSON.parse(activeSnapshotManifestBuffer.toString("utf8"));
  assert.equal(activeSnapshotManifest.sourceCommit, documentActive.activeCommit);
  assert.ok(Array.isArray(activeSnapshotManifest.files) && activeSnapshotManifest.files.length > 0);
  for (const record of activeSnapshotManifest.files) {
    assert.match(record.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
    const packagedDocument = path.resolve(activeSnapshotRoot, ...record.path.split("/"));
    const relativeToSnapshot = path.relative(activeSnapshotRoot, packagedDocument);
    assert.ok(relativeToSnapshot && relativeToSnapshot !== ".." && !relativeToSnapshot.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeToSnapshot));
    const packagedDocumentBuffer = await readFile(packagedDocument);
    assert.equal(packagedDocumentBuffer.byteLength, record.sizeBytes, `snapshot size: ${record.path}`);
    assert.equal(
      crypto.createHash("sha256").update(packagedDocumentBuffer).digest("hex"),
      record.sha256,
      `snapshot checksum: ${record.path}`
    );
  }
  assert.ok(!blankFiles.some((name) => /app\/research-packages\/geo-citation-lab\/\.document-updates\/(?:state\.json|staging(?:\/|$))/i.test(name)));
  await assertSums(blankRoot);
  const staleBundle = path.join(blankOutput, "stale-private-delivery");
  await mkdir(staleBundle, { recursive: true });
  await writeFile(path.join(staleBundle, "manifest.json"), JSON.stringify({
    product: "tongzhuo-geo-private-delivery",
    format: "tongzhuo-private-delivery-manifest-v1"
  }));
  await writeFile(path.join(blankOutput, "stale-private-delivery.tar.gz"), "stale archive");
  await writeFile(path.join(blankOutput, "stale-private-delivery.tar.gz.sha256"), "stale checksum");
  await utimes(staleBundle, new Date(0), new Date(0));
  const overwriteRequired = runBuilder(["--mode", "blank", "--output", blankOutput, "--no-archive"], 1);
  assert.match(overwriteRequired.stderr, /--overwrite/);
  runBuilder(["--mode", "blank", "--output", blankOutput, "--no-archive", "--overwrite", "--prune-history", "--retain-builds", "1"]);
  await assertSums(blankRoot);
  assert.equal(await exists(staleBundle), false);
  assert.equal(await exists(path.join(blankOutput, "stale-private-delivery.tar.gz")), false);
  assert.equal(await exists(path.join(blankOutput, "stale-private-delivery.tar.gz.sha256")), false);

  const fixtureRoot = path.join(testRoot, "migration-fixture");
  const backupDir = await createBackupFixture(fixtureRoot);
  const migratedOutput = path.join(testRoot, "migrated-output");
  runBuilder([
    "--mode", "migrated",
    "--migration-input", backupDir,
    "--customer-id", "fixture-customer",
    "--acknowledge-sensitive-data",
    "--output", migratedOutput,
    "--no-archive"
  ]);
  const migratedRoot = path.join(migratedOutput, `tongzhuo-geo-private-${packageJson.version}-migrated-fixture-customer`);
  const migratedManifest = JSON.parse(await readFile(path.join(migratedRoot, "manifest.json"), "utf8"));
  assert.equal(migratedManifest.deliveryMode, "migrated");
  assert.equal(migratedManifest.security.containsCustomerData, true);
  assert.equal(migratedManifest.security.containsRecoverySecrets, true);
  assert.equal(migratedManifest.migration.customerId, "fixture-customer");
  assert.ok(migratedManifest.migration.verifiedComponents.includes("database"));
  await verifyProductionBackup(path.join(migratedRoot, "migration", "private-backup"));
  await assertSums(migratedRoot);

  const missingAcknowledgement = runBuilder([
    "--mode", "migrated",
    "--migration-input", backupDir,
    "--customer-id", "fixture-customer",
    "--output", path.join(testRoot, "must-fail"),
    "--no-archive"
  ], 1);
  assert.match(missingAcknowledgement.stderr, /acknowledge-sensitive-data/);

  const environmentKeyRoot = path.join(testRoot, "environment-key-fixture");
  const environmentKeyBackup = await createBackupFixture(environmentKeyRoot, {
    environmentMasterKey: crypto.randomBytes(32).toString("base64")
  });
  const environmentKeyMigration = runBuilder([
    "--mode", "migrated",
    "--migration-input", environmentKeyBackup,
    "--customer-id", "external-key-customer",
    "--acknowledge-sensitive-data",
    "--output", path.join(testRoot, "environment-key-must-fail"),
    "--no-archive"
  ], 1);
  assert.match(environmentKeyMigration.stderr, /TZ_MASTER_KEY|外部.*主密钥/);

  await writeFile(path.join(backupDir, "payload", "site-static", "index.html"), "tampered after backup");
  const tampered = runBuilder([
    "--mode", "migrated",
    "--migration-input", backupDir,
    "--customer-id", "fixture-customer",
    "--acknowledge-sensitive-data",
    "--output", path.join(testRoot, "tampered-must-fail"),
    "--no-archive"
  ], 1);
  assert.match(tampered.stderr, /SHA256|校验/);

  console.log("Private delivery bundle check passed");
} finally {
  await rm(testRoot, { recursive: true, force: true });
}
