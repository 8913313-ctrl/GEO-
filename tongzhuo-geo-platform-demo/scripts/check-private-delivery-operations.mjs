import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Keep the Git Bash harness on the same drive as the project. On locked-down
// Windows hosts the OS temp directory can resolve to a user profile path that
// Git Bash is not allowed to create, even though Node can write there.
const testRoot = await mkdtemp(path.join(projectRoot, ".tmp-upgrade-contract-"));

function bashPath(value) {
  const normalized = path.resolve(value).replaceAll("\\", "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  return match ? `/${match[1].toLowerCase()}/${match[2]}` : normalized;
}

function findBash() {
  const candidates = [
    process.env.BASH,
    "bash",
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8", windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("Bash is required to test private-delivery upgrade and rollback semantics.");
}

const bash = findBash();

function runBash(script, env = {}) {
  return spawnSync(bash, [bashPath(script)], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
}

const mockLibrary = String.raw`#!/usr/bin/env bash
PD_DEFAULT_INSTALL_ROOT="/mock/install"
PD_PACKAGE_ROOT=""
PD_PACKAGE_APP=""
pd_log() { :; }
pd_warn() { printf 'warning:%s\n' "$*" >&2; }
pd_die() { printf 'error:%s\n' "$*" >&2; exit 1; }
pd_init_paths() {
  INSTALL_ROOT="${"$"}{INSTALL_ROOT:-$MOCK_INSTALL_ROOT}"
  RELEASES_DIR="$INSTALL_ROOT/releases"
  SHARED_DIR="$INSTALL_ROOT/shared"
  STATE_DIR="$INSTALL_ROOT/state"
  BACKUPS_DIR="$INSTALL_ROOT/backups"
  SITE_DIR="$INSTALL_ROOT/site"
  CERTS_DIR="$INSTALL_ROOT/certs"
  TMP_DIR="$INSTALL_ROOT/tmp"
  CURRENT_LINK="$INSTALL_ROOT/current"
  PREVIOUS_LINK="$INSTALL_ROOT/previous"
  APP_ENV="$SHARED_DIR/app.env"
  CUTOVER_ENV="$SHARED_DIR/cutover.env"
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$STATE_DIR/upgrades" "$BACKUPS_DIR" "$SITE_DIR" "$CERTS_DIR" "$TMP_DIR"
}
pd_ensure_layout() { mkdir -p "$STATE_DIR/upgrades" "$BACKUPS_DIR"; }
pd_acquire_lock() { :; }
pd_current_release() { printf '%s\n' "$MOCK_CURRENT"; }
pd_previous_release() { printf '%s\n' "$MOCK_PREVIOUS"; }
pd_link_shared_config() { :; }
pd_prepare_package_input() { PD_PACKAGE_ROOT="$MOCK_PACKAGE_ROOT"; PD_PACKAGE_APP="$MOCK_PACKAGE_ROOT/app"; }
pd_cleanup_package_input() { printf 'cleanup-package\n' >> "$MOCK_LOG"; }
pd_release_id() { printf '%s\n' "new-release"; }
pd_assert_release_fingerprint() { :; }
pd_verify_release() {
  local release_id
  release_id="$(basename "$1")"
  printf 'verify:%s\n' "$release_id" >> "$MOCK_LOG"
  if [[ "${"$"}{MOCK_FAIL_PREVIOUS_VERIFY:-0}" == "1" && "$release_id" == "previous-release" ]]; then return 1; fi
}
pd_copy_release() { mkdir -p "$2/deploy/private-delivery"; }
pd_assert_release_script_set() { :; }
pd_compose() { local release="$1"; shift; printf 'compose:%s:%s\n' "$(basename "$release")" "$*" >> "$MOCK_LOG"; }
pd_backup_release() {
  local release="$1" label="$2" target
  printf 'backup:%s:%s\n' "$(basename "$release")" "$label" >> "$MOCK_LOG"
  if [[ "${"$"}{MOCK_FAIL_SAFETY_BACKUP:-0}" == "1" && "$label" == pre-rollback-* ]]; then return 1; fi
  target="$BACKUPS_DIR/$label"
  mkdir -p "$target"
  printf '{"format":"tongzhuo-private-backup-v2"}\n' > "$target/manifest.json"
  printf '%s\n' "$target"
}
pd_validate_backup_dir() { printf '%s\n' "$1"; }
pd_restore_release() { printf 'restore:%s:%s\n' "$(basename "$1")" "$(basename "$2")" >> "$MOCK_LOG"; }
pd_up_release() { printf 'up:%s\n' "$(basename "$1")" >> "$MOCK_LOG"; }
pd_stop_release() { printf 'stop:%s\n' "$(basename "$1")" >> "$MOCK_LOG"; }
pd_atomic_symlink() { mkdir -p "$(dirname "$2")"; printf '%s\n' "$1" > "$2"; printf 'link:%s:%s\n' "$(basename "$2")" "$(basename "$1")" >> "$MOCK_LOG"; }
pd_write_installed_release() { printf 'installed:%s\n' "$(basename "$1")" >> "$MOCK_LOG"; }
pd_prebuild_project_name() { printf '%s\n' "mock-prebuild"; }
pd_prebuild_release() { printf 'prebuild:%s:%s\n' "$(basename "$1")" "$2" >> "$MOCK_LOG"; }
pd_cleanup_prebuild_release() { printf 'cleanup-prebuild:%s\n' "$2" >> "$MOCK_LOG"; }
`;

async function createUpgradeRuntime(name, currentId = "current-release", previousId = "previous-release") {
  const root = path.join(testRoot, name);
  const operations = path.join(root, "operations");
  const install = path.join(root, "install");
  const current = path.join(install, "releases", currentId);
  const previous = path.join(install, "releases", previousId);
  const packageRoot = path.join(root, "package");
  const log = path.join(root, "events.log");
  await Promise.all([
    mkdir(operations, { recursive: true }),
    mkdir(path.join(current, "deploy", "private-delivery"), { recursive: true }),
    mkdir(path.join(previous, "deploy", "private-delivery"), { recursive: true }),
    mkdir(path.join(packageRoot, "app"), { recursive: true })
  ]);
  await writeFile(path.join(packageRoot, "manifest.json"), '{"format":"test-delivery"}\n', "utf8");
  await writeFile(path.join(packageRoot, "SHA256SUMS"), "test fixture\n", "utf8");
  await copyFile(path.join(projectRoot, "deploy", "private-delivery", "upgrade.sh"), path.join(operations, "upgrade.sh"));
  await writeFile(path.join(operations, "lib.sh"), mockLibrary, "utf8");
  await writeFile(path.join(operations, "preflight.sh"), "#!/usr/bin/env bash\nexit 0\n", "utf8");
  await writeFile(log, "", "utf8");
  return { root, operations, install, current, previous, packageRoot, log, currentId };
}

function runtimeEnv(runtime, extra = {}) {
  return {
    MOCK_INSTALL_ROOT: bashPath(runtime.install),
    MOCK_CURRENT: bashPath(runtime.current),
    MOCK_PREVIOUS: bashPath(runtime.previous),
    MOCK_PACKAGE_ROOT: bashPath(runtime.packageRoot),
    MOCK_LOG: bashPath(runtime.log),
    ...extra
  };
}

async function writeRollbackMetadata(runtime) {
  const metadata = path.join(runtime.install, "state", "upgrades", runtime.currentId);
  const backup = path.join(runtime.install, "backups", "recorded-pre-upgrade");
  await mkdir(metadata, { recursive: true });
  await mkdir(backup, { recursive: true });
  await writeFile(path.join(backup, "manifest.json"), '{"format":"tongzhuo-private-backup-v2"}\n');
  await writeFile(path.join(metadata, "previous-release"), `${bashPath(runtime.previous)}\n`);
  await writeFile(path.join(metadata, "pre-upgrade-backup"), `${bashPath(backup)}\n`);
}

async function checkUpgradeBackupOrdering() {
  const runtime = await createUpgradeRuntime("apply-order");
  const result = runBash(path.join(runtime.operations, "upgrade.sh"), {
    ...runtimeEnv(runtime),
    TZ_INSTALL_ROOT: bashPath(runtime.install),
    MOCK_ACTION_ARGS: ""
  });
  // The wrapper script below supplies deterministic arguments without a
  // shell command string, keeping path quoting identical on Windows/Linux.
  assert.equal(result.status, 0, "upgrade.sh without arguments must show help successfully");

  const wrapper = path.join(runtime.root, "run-apply.sh");
  await writeFile(wrapper, `#!/usr/bin/env bash\nbash "${bashPath(path.join(runtime.operations, "upgrade.sh"))}" apply "${bashPath(runtime.packageRoot)}" --install-root "${bashPath(runtime.install)}" --yes --timeout 60\n`, "utf8");
  const applied = runBash(wrapper, runtimeEnv(runtime));
  assert.equal(applied.status, 0, `apply harness failed\nstdout:${applied.stdout}\nstderr:${applied.stderr}`);
  const events = (await readFile(runtime.log, "utf8")).trim().split(/\r?\n/);
  const backup = events.findIndex((event) => event.startsWith("backup:current-release:pre-upgrade-new-release"));
  const prebuild = events.findIndex((event) => event === "prebuild:new-release:mock-prebuild");
  assert.ok(backup >= 0 && prebuild >= 0 && backup < prebuild, `candidate build preceded accepted-release backup:\n${events.join("\n")}`);
}

async function checkFailedSafetyBackupStopsRollback(restoreData) {
  const runtime = await createUpgradeRuntime(restoreData ? "failed-safety-data" : "failed-safety-code", "new-release", "previous-release");
  await writeRollbackMetadata(runtime);
  const wrapper = path.join(runtime.root, "run-rollback.sh");
  const restoreArgument = restoreData ? " --restore-pre-upgrade-data" : "";
  await writeFile(wrapper, `#!/usr/bin/env bash\nbash "${bashPath(path.join(runtime.operations, "upgrade.sh"))}" rollback --install-root "${bashPath(runtime.install)}"${restoreArgument} --yes --timeout 60\n`, "utf8");
  const result = runBash(wrapper, runtimeEnv(runtime, { MOCK_FAIL_SAFETY_BACKUP: "1" }));
  assert.notEqual(result.status, 0, `${restoreData ? "data-restoring" : "code-only"} rollback must fail when the safety backup fails`);
  assert.match(result.stderr, /safety backup failed/i);
  const events = await readFile(runtime.log, "utf8");
  assert.doesNotMatch(events, /^(?:stop|link|restore|up|compose):/m, `rollback changed runtime state after failed safety backup:\n${events}`);
}

async function checkFailedCodeRollbackRestoresSafetySnapshot() {
  const runtime = await createUpgradeRuntime("failed-code-recovery", "new-release", "previous-release");
  await writeRollbackMetadata(runtime);
  const wrapper = path.join(runtime.root, "run-code-recovery.sh");
  await writeFile(wrapper, `#!/usr/bin/env bash\nbash "${bashPath(path.join(runtime.operations, "upgrade.sh"))}" rollback --install-root "${bashPath(runtime.install)}" --yes --timeout 60\n`, "utf8");
  const result = runBash(wrapper, runtimeEnv(runtime, { MOCK_FAIL_PREVIOUS_VERIFY: "1" }));
  assert.notEqual(result.status, 0, "failed code rollback must report failure after recovering the original release");
  const events = await readFile(runtime.log, "utf8");
  assert.match(events, /^restore:new-release:pre-rollback-new-release$/m, `failed code rollback did not restore its safety snapshot:\n${events}`);
  assert.match(events, /^verify:new-release$/m, `failed code rollback did not re-verify the recovered release:\n${events}`);
}

async function checkRunningImageAndReleaseIdentity() {
  const root = path.join(testRoot, "image-identity");
  const release = path.join(root, "release");
  const bin = path.join(root, "bin");
  const compose = path.join(release, "deploy", "docker-compose.production.yml");
  const cutover = path.join(root, "cutover.env");
  const state = path.join(root, "state");
  const marker = path.join(state, "installed-release");
  await mkdir(path.dirname(compose), { recursive: true });
  await mkdir(bin, { recursive: true });
  await mkdir(state, { recursive: true });
  await writeFile(compose, "services: {}\n", "utf8");
  await writeFile(cutover, "TZ_COMPOSE_PROJECT_NAME=mock-project\n", "utf8");
  await writeFile(marker, `${path.basename(release)}\n`, "utf8");
  const dockerMock = path.join(bin, "docker");
  await writeFile(dockerMock, String.raw`#!/usr/bin/env bash
if [[ "$1" == "inspect" ]]; then
  format="$3"
  container="$4"
  service="${"$"}{container#container-}"
  case "$format" in
    *project.config_files*)
      if [[ "${"$"}{MOCK_CONFIG_MISMATCH:-0}" == "1" ]]; then printf '%s\n' "/opt/old-release/docker-compose.production.yml"; else printf '%s\n' "$MOCK_CONFIG_FILE"; fi
      ;;
    *com.docker.compose.project*) printf '%s\n' "mock-project" ;;
    *Config.Image*) printf 'mock-%s\n' "$service" ;;
    *'.Image'*) printf 'sha256:%s-running\n' "$service" ;;
    *) exit 2 ;;
  esac
elif [[ "$1" == "image" && "$2" == "inspect" ]]; then
  service="${"$"}{5#mock-}"
  if [[ "${"$"}{MOCK_IMAGE_MISMATCH:-0}" == "1" && "$service" == "geo-site" ]]; then
    printf 'sha256:%s-candidate\n' "$service"
  else
    printf 'sha256:%s-running\n' "$service"
  fi
else
  exit 2
fi
`, "utf8");
  await chmod(dockerMock, 0o755).catch(() => {});

  const harness = path.join(root, "check-identity.sh");
  await writeFile(harness, `#!/usr/bin/env bash\nset -Eeuo pipefail\nsource "${bashPath(path.join(projectRoot, "deploy", "private-delivery", "lib.sh"))}"\nCUTOVER_ENV="${bashPath(cutover)}"\nSTATE_DIR="${bashPath(state)}"\nexport PATH="${bashPath(bin)}:$PATH"\npd_compose() { local selected_release="$1"; shift; [[ "$1" == "ps" && "$2" == "-q" ]]; printf 'container-%s\\n' "$3"; }\npd_assert_installed_release_marker "${bashPath(release)}"\npd_assert_running_release_identity "${bashPath(release)}"\n`, "utf8");
  const baseEnv = { MOCK_CONFIG_FILE: bashPath(compose) };
  const accepted = runBash(harness, baseEnv);
  assert.equal(accepted.status, 0, `matching release identity was rejected\n${accepted.stderr}`);
  await writeFile(marker, "old-release\n", "utf8");
  const markerMismatch = runBash(harness, baseEnv);
  assert.notEqual(markerMismatch.status, 0, "installed-release marker mismatch must fail acceptance");
  assert.match(markerMismatch.stderr, /transaction marker disagree/i);
  await writeFile(marker, `${path.basename(release)}\n`, "utf8");
  const imageMismatch = runBash(harness, { ...baseEnv, MOCK_IMAGE_MISMATCH: "1" });
  assert.notEqual(imageMismatch.status, 0, "stale running image must fail acceptance");
  assert.match(imageMismatch.stderr, /image does not match/i);
  const configMismatch = runBash(harness, { ...baseEnv, MOCK_CONFIG_MISMATCH: "1" });
  assert.notEqual(configMismatch.status, 0, "container from a different release Compose file must fail acceptance");
  assert.match(configMismatch.stderr, /not created from the active release/i);
}

async function checkOperatorVerifierOwnsRollbackAcceptance() {
  const root = path.join(testRoot, "operator-verifier");
  const operator = path.join(root, "operator");
  const oldRelease = path.join(root, "old-release");
  const log = path.join(root, "operator.log");
  await mkdir(operator, { recursive: true });
  await mkdir(path.join(oldRelease, "deploy", "private-delivery"), { recursive: true });
  await writeFile(path.join(operator, "verify.sh"), '#!/usr/bin/env bash\nprintf "operator:%s\\n" "$*" > "$MOCK_OPERATOR_LOG"\n', "utf8");
  await writeFile(path.join(oldRelease, "deploy", "private-delivery", "verify.sh"), "#!/usr/bin/env bash\nexit 99\n", "utf8");
  const harness = path.join(root, "check-operator.sh");
  await writeFile(harness, `#!/usr/bin/env bash\nset -Eeuo pipefail\nsource "${bashPath(path.join(projectRoot, "deploy", "private-delivery", "lib.sh"))}"\nPD_OPERATOR_DIR="${bashPath(operator)}"\nINSTALL_ROOT="${bashPath(root)}"\npd_verify_release "${bashPath(oldRelease)}" 77\n`, "utf8");
  const result = runBash(harness, { MOCK_OPERATOR_LOG: bashPath(log) });
  assert.equal(result.status, 0, `rollback acceptance used the old release verifier\n${result.stderr}`);
  assert.match(await readFile(log, "utf8"), /--timeout 77/);
}

try {
  await checkUpgradeBackupOrdering();
  await checkFailedSafetyBackupStopsRollback(false);
  await checkFailedSafetyBackupStopsRollback(true);
  await checkFailedCodeRollbackRestoresSafetySnapshot();
  await checkRunningImageAndReleaseIdentity();
  await checkOperatorVerifierOwnsRollbackAcceptance();
  console.log("Private delivery upgrade/rollback safety checks passed");
} finally {
  await rm(testRoot, { recursive: true, force: true });
}
