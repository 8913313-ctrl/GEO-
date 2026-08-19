import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-relay-deployment-tooling-"));

async function run(script, args = [], env = process.env) {
  return execFileAsync(process.execPath, [script, ...args], { cwd: projectRoot, env, windowsHide: true });
}

try {
  const sourceAidso = path.join(tempRoot, "source-aidso.token");
  const aidsoValue = "deployment-tooling-real-aidso-token";
  await writeFile(sourceAidso, `${aidsoValue}\n`, { mode: 0o600 });
  await chmod(sourceAidso, 0o600).catch(() => {});
  const secretDir = path.join(tempRoot, "secrets");
  const generated = await run("scripts/generate-relay-secrets.mjs", ["--production", "--output-dir", secretDir, "--aidso-token-file", sourceAidso]);
  const generatedResult = JSON.parse(generated.stdout);
  assert.equal(generatedResult.secretValuesPrinted, false);
  assert.equal(generated.stdout.includes(aidsoValue), false, "secret bootstrap output must not reveal the AIDSO token");
  const masterPath = path.join(secretDir, "relay-master.key");
  const adminPath = path.join(secretDir, "relay-admin.token");
  const aidsoPath = path.join(secretDir, "aidso.token");
  const masterValue = (await readFile(masterPath, "utf8")).trim();
  const originalAdminValue = (await readFile(adminPath, "utf8")).trim();
  assert.equal(Buffer.from(masterValue, "base64url").length, 32);
  assert.ok(originalAdminValue.length >= 32);
  assert.equal((await readFile(aidsoPath, "utf8")).trim(), aidsoValue);
  await assert.rejects(
    () => run("scripts/generate-relay-secrets.mjs", ["--production", "--output-dir", secretDir, "--aidso-token-file", sourceAidso]),
    /拒绝部分覆盖/
  );
  const invalidAidsoSource = path.join(tempRoot, "invalid-aidso.token");
  const invalidSecretDir = path.join(tempRoot, "invalid-secrets");
  await writeFile(invalidAidsoSource, "x\n", { mode: 0o600 });
  await assert.rejects(
    () => run("scripts/generate-relay-secrets.mjs", ["--production", "--output-dir", invalidSecretDir, "--aidso-token-file", invalidAidsoSource]),
    /长度异常/
  );
  assert.deepEqual((await readdir(invalidSecretDir)).filter((name) => !name.endsWith(".next")), [], "invalid AIDSO input must not leave a partial master/admin secret set");

  const rotated = await run("scripts/rotate-admin-token.mjs", ["--file", adminPath, "--force"]);
  const rotatedResult = JSON.parse(rotated.stdout);
  const rotatedAdminValue = (await readFile(adminPath, "utf8")).trim();
  assert.equal(rotatedResult.tokenPrinted, false);
  assert.notEqual(rotatedAdminValue, originalAdminValue);
  assert.equal(rotated.stdout.includes(rotatedAdminValue), false, "admin-token rotation output must not reveal the new token");

  const renderedNginx = path.join(tempRoot, "tongzhuo-relay.conf");
  const renderArgs = [
    "--output", renderedNginx,
    "--server-name", "relay.tongzhuo.cn",
    "--certificate", "/etc/letsencrypt/live/relay.tongzhuo.cn/fullchain.pem",
    "--certificate-key", "/etc/letsencrypt/live/relay.tongzhuo.cn/privkey.pem",
    "--admin-allow", "10.20.30.0/24",
    "--health-allow", "10.20.30.10"
  ];
  await run("scripts/render-nginx-config.mjs", renderArgs);
  const nginx = await readFile(renderedNginx, "utf8");
  assert.match(nginx, /server_name relay\.tongzhuo\.cn;/);
  assert.match(nginx, /allow 10\.20\.30\.0\/24;/);
  assert.match(nginx, /allow 10\.20\.30\.10;/);
  assert.doesNotMatch(nginx, /relay\.example\.com|203\.0\.113\.|replace with the real/i);
  await assert.rejects(
    () => run("scripts/render-nginx-config.mjs", [
      "--output", path.join(tempRoot, "unsafe-nginx.conf"),
      "--server-name", "relay.tongzhuo.cn",
      "--certificate", "/certs/fullchain.pem",
      "--certificate-key", "/certs/privkey.pem",
      "--admin-allow", "0.0.0.0/0"
    ]),
    /通配|窄网段/
  );

  const dataDir = path.join(tempRoot, "data");
  const backupDir = path.join(tempRoot, "backups");
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  const deploymentEnvironment = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    TZ_RELAY_DATA_DIR: dataDir,
    TZ_RELAY_DATABASE_PATH: path.join(dataDir, "tongzhuo-relay.sqlite"),
    TZ_RELAY_BACKUP_DIR: backupDir,
    TZ_RELAY_BACKUP_RETENTION_DAYS: "30",
    TZ_RELAY_MASTER_KEY: "",
    TZ_RELAY_MASTER_KEY_FILE: masterPath,
    TZ_RELAY_ADMIN_TOKEN: "",
    TZ_RELAY_ADMIN_TOKEN_FILE: adminPath,
    AIDSO_TOKEN: "",
    AIDSO_TOKEN_FILE: aidsoPath,
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_ALLOW_INSECURE_ADMIN: "0",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.tongzhuo.cn",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
    TZ_RELAY_REQUIRE_HTTPS_FOR_ADMIN: "1",
    TZ_RELAY_NGINX_CONFIG: renderedNginx,
    TZ_RELAY_ALERT_WEBHOOK_URL: "",
    TZ_RELAY_ALERT_EXIT_MONITORED: "1",
    TZ_RELAY_LOG_SINK: "journal"
  };
  const preflight = await run("scripts/check-production-deployment.mjs", [], deploymentEnvironment);
  const preflightResult = JSON.parse(preflight.stdout);
  assert.equal(preflightResult.status, "production-deployment-ready");
  assert.equal(preflightResult.demoSeed, false);
  assert.equal(preflightResult.secretSources.master, "secret_file");
  for (const secret of [masterValue, rotatedAdminValue, aidsoValue]) assert.equal(preflight.stdout.includes(secret), false, "preflight output must contain fingerprints only");

  const compose = await readFile(path.join(projectRoot, "deploy", "docker-compose.production.yml"), "utf8");
  const composeSecrets = await readFile(path.join(projectRoot, "deploy", "docker-compose.production.secrets.yml"), "utf8");
  assert.match(compose, /TZ_RELAY_SEED_DEMO:\s*"0"/);
  assert.match(compose, /\$\{TZ_RELAY_BIND_ADDRESS:-127\.0\.0\.1\}:44280:44280/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\r?\n\s*- ALL/);
  assert.match(compose, /max-size:\s*20m[\s\S]*max-file:\s*"5"/);
  for (const secretFile of ["TZ_RELAY_MASTER_KEY_FILE", "TZ_RELAY_ADMIN_TOKEN_FILE", "AIDSO_TOKEN_FILE"]) assert.match(composeSecrets, new RegExp(`${secretFile}: /run/secrets/`));
  assert.doesNotMatch(composeSecrets, /TZ_RELAY_(?:MASTER_KEY|ADMIN_TOKEN):\s*[^"\s]/, "compose must not embed production secret values");

  const serviceUnit = await readFile(path.join(projectRoot, "deploy", "tongzhuo-relay.service"), "utf8");
  for (const hardening of ["UMask=0077", "NoNewPrivileges=true", "ProtectSystem=strict", "ProtectKernelTunables=true", "ProtectKernelModules=true", "ProtectControlGroups=true", "RestrictSUIDSGID=true", "SystemCallArchitectures=native"]) assert.match(serviceUnit, new RegExp(hardening));
  for (const timerName of ["tongzhuo-relay-backup.timer", "tongzhuo-relay-backup-verify.timer", "tongzhuo-relay-ops.timer"]) {
    const timer = await readFile(path.join(projectRoot, "deploy", timerName), "utf8");
    assert.match(timer, /Persistent=true/);
  }

  console.log("Relay production deployment tooling checks passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
