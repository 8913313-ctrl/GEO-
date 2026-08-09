#!/usr/bin/env bash

# Shared helpers for the private-delivery operator scripts.  This file is
# sourced by the entry points in this directory; it is not an entry point by
# itself.

PD_OPERATOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

PD_DEFAULT_INSTALL_ROOT="/opt/tongzhuo-geo"
PD_MIN_FREE_KB="${TZ_PD_MIN_FREE_KB:-2097152}"

pd_log() { printf '[tongzhuo] %s\n' "$*" >&2; }
pd_warn() { printf '[tongzhuo] WARNING: %s\n' "$*" >&2; }
pd_die() { printf '[tongzhuo] ERROR: %s\n' "$*" >&2; exit 1; }

pd_require_command() {
  command -v "$1" >/dev/null 2>&1 || pd_die "Required command is not available: $1"
}

pd_validate_install_root() {
  local value="${1:-}"
  [[ -n "$value" && "$value" == /* ]] || pd_die "Install root must be an absolute Linux path."
  value="${value%/}"
  [[ -n "$value" ]] || value="/"
  case "$value" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var)
      pd_die "Refusing unsafe install root: $value"
      ;;
  esac
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || pd_die "Install root contains a newline."
  printf '%s\n' "$value"
}

pd_init_paths() {
  INSTALL_ROOT="$(pd_validate_install_root "${INSTALL_ROOT:-${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}}")"
  RELEASES_DIR="$INSTALL_ROOT/releases"
  SHARED_DIR="$INSTALL_ROOT/shared"
  STATE_DIR="$INSTALL_ROOT/state"
  BACKUPS_DIR="$INSTALL_ROOT/backups"
  SITE_DIR="$INSTALL_ROOT/site"
  CERTS_DIR="$INSTALL_ROOT/certs"
  TMP_DIR="$INSTALL_ROOT/tmp"
  RELAY_INPUTS_DIR="$SHARED_DIR/relay-inputs"
  CURRENT_LINK="$INSTALL_ROOT/current"
  PREVIOUS_LINK="$INSTALL_ROOT/previous"
  APP_ENV="$SHARED_DIR/app.env"
  CUTOVER_ENV="$SHARED_DIR/cutover.env"
  export INSTALL_ROOT RELEASES_DIR SHARED_DIR STATE_DIR BACKUPS_DIR SITE_DIR CERTS_DIR TMP_DIR RELAY_INPUTS_DIR
  export CURRENT_LINK PREVIOUS_LINK APP_ENV CUTOVER_ENV
}

pd_ensure_layout() {
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$STATE_DIR/upgrades" "$BACKUPS_DIR" "$SITE_DIR" "$CERTS_DIR" "$TMP_DIR" "$RELAY_INPUTS_DIR"
  chmod 700 "$SHARED_DIR" "$STATE_DIR" "$BACKUPS_DIR" "$CERTS_DIR" "$TMP_DIR" "$RELAY_INPUTS_DIR" 2>/dev/null || true
  # Static website files are public content and must be readable by the
  # unprivileged Node user through the bind mount.
  chmod 755 "$SITE_DIR" 2>/dev/null || true
}

pd_acquire_lock() {
  pd_require_command flock
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/operations.lock"
  flock -n 9 || pd_die "Another install, restore, upgrade, or rollback operation is already running."
}

pd_validate_app_source() {
  local root="${1:-}"
  [[ -d "$root" ]] || pd_die "Application source directory does not exist: $root"
  local required
  for required in \
    package.json Dockerfile server.mjs site-server.mjs \
    deploy/docker-compose.production.yml deploy/admin-tls.conf deploy/Dockerfile.site; do
    [[ -f "$root/$required" ]] || pd_die "Release is missing required file: $required"
  done
}

pd_discover_local_app() {
  local script_dir="$1"
  # Downloaded delivery bundles place entry points in operations/ and source
  # in the sibling app/ directory.
  if [[ -f "$script_dir/../app/package.json" ]]; then
    (cd "$script_dir/../app" && pwd -P)
    return
  fi
  # Installed/source-tree scripts live in app/deploy/private-delivery/.
  if [[ -f "$script_dir/../../package.json" ]]; then
    (cd "$script_dir/../.." && pwd -P)
    return
  fi
  pd_die "Cannot locate the application source relative to $script_dir. Pass --source explicitly."
}

pd_bundle_root_for_app() {
  local app_root="$1" parent
  parent="$(cd "$app_root/.." && pwd -P)"
  if [[ "$(basename "$app_root")" == "app" && ( -f "$parent/manifest.json" || -f "$parent/VERSION" ) ]]; then
    printf '%s\n' "$parent"
  else
    printf '%s\n' "$app_root"
  fi
}

pd_sanitize_release_id() {
  local value="${1:-}"
  value="$(printf '%s' "$value" | tr -cs 'A-Za-z0-9._-' '-')"
  value="${value#-}"
  value="${value%-}"
  [[ -n "$value" && ${#value} -le 120 ]] || pd_die "Release identifier is empty or too long."
  printf '%s\n' "$value"
}

pd_release_id() {
  local app_root="$1" bundle_root="$2" requested="${3:-}" version digest
  if [[ -n "$requested" ]]; then
    pd_sanitize_release_id "$requested"
    return
  fi
  if [[ -f "$bundle_root/VERSION" ]]; then
    version="$(tr -d '\r\n' < "$bundle_root/VERSION")"
  else
    version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$app_root/package.json" | head -n 1)"
  fi
  [[ -n "$version" ]] || version="release"
  if [[ -f "$bundle_root/manifest.json" ]]; then
    # The delivery manifest records every payload file, so its digest changes
    # for application, website, or operations-script updates alike.
    digest="$(sha256sum "$bundle_root/manifest.json" | awk '{print substr($1,1,12)}')"
  else
    digest="$({ sha256sum \
      "$app_root/package.json" \
      "$app_root/server.mjs" \
      "$app_root/site-server.mjs" \
      "$app_root/deploy/docker-compose.production.yml" \
      "$app_root/deploy/private-delivery/lib.sh" \
      "$app_root/deploy/private-delivery/verify.sh"; } | sha256sum | awk '{print substr($1,1,12)}')"
  fi
  pd_sanitize_release_id "${version}-${digest}"
}

pd_verify_bundle_checksums() {
  local bundle_root="$1" sums entry
  sums="$bundle_root/SHA256SUMS"
  [[ -f "$sums" ]] || return 0
  while IFS= read -r entry; do
    entry="${entry#*  }"
    entry="${entry#\*}"
    [[ -z "$entry" ]] && continue
    case "$entry" in
      /*|../*|*/../*|*/..|..|*\\*) pd_die "SHA256SUMS contains an unsafe path: $entry" ;;
    esac
  done < "$sums"
  pd_log "Verifying release checksums."
  (cd "$bundle_root" && sha256sum --check --strict SHA256SUMS) >&2 \
    || pd_die "Release checksum verification failed."
}

PD_PACKAGE_TEMP=""
PD_PACKAGE_ROOT=""
PD_PACKAGE_APP=""

pd_archive_paths_are_safe() {
  awk '
    BEGIN { bad = 0 }
    {
      path = $0
      sub(/^\.\//, "", path)
      if (path ~ /^\// || path ~ /(^|\/)\.\.($|\/)/ || path ~ /\\/) bad = 1
    }
    END { exit bad }
  '
}

pd_prepare_package_input() {
  local input="${1:-}" listing
  [[ -n "$input" ]] || pd_die "A release directory or archive is required."
  if [[ -d "$input" ]]; then
    PD_PACKAGE_ROOT="$(cd "$input" && pwd -P)"
  elif [[ -f "$input" ]]; then
    mkdir -p "$TMP_DIR"
    PD_PACKAGE_TEMP="$(mktemp -d "$TMP_DIR/package.XXXXXXXX")"
    case "$input" in
      *.tar.gz|*.tgz)
        tar -tzf "$input" | pd_archive_paths_are_safe || pd_die "Archive contains an unsafe path."
        tar --no-same-owner --no-same-permissions -xzf "$input" -C "$PD_PACKAGE_TEMP"
        ;;
      *.tar)
        tar -tf "$input" | pd_archive_paths_are_safe || pd_die "Archive contains an unsafe path."
        tar --no-same-owner --no-same-permissions -xf "$input" -C "$PD_PACKAGE_TEMP"
        ;;
      *.zip)
        pd_require_command unzip
        unzip -Z1 "$input" | pd_archive_paths_are_safe || pd_die "Archive contains an unsafe path."
        unzip -q "$input" -d "$PD_PACKAGE_TEMP"
        ;;
      *) pd_die "Supported release archives are .tar, .tar.gz, .tgz, and .zip." ;;
    esac
    PD_PACKAGE_ROOT="$PD_PACKAGE_TEMP"
    local entries
    mapfile -t entries < <(find "$PD_PACKAGE_TEMP" -mindepth 1 -maxdepth 1 -type d -print)
    if [[ ${#entries[@]} -eq 1 && ! -f "$PD_PACKAGE_TEMP/manifest.json" && ! -d "$PD_PACKAGE_TEMP/app" ]]; then
      PD_PACKAGE_ROOT="${entries[0]}"
    fi
  else
    pd_die "Release input does not exist: $input"
  fi

  if [[ -f "$PD_PACKAGE_ROOT/app/package.json" ]]; then
    PD_PACKAGE_APP="$PD_PACKAGE_ROOT/app"
  elif [[ -f "$PD_PACKAGE_ROOT/package.json" ]]; then
    PD_PACKAGE_APP="$PD_PACKAGE_ROOT"
  else
    pd_die "Release input does not contain app/package.json or package.json."
  fi
  PD_PACKAGE_APP="$(cd "$PD_PACKAGE_APP" && pwd -P)"
  pd_validate_app_source "$PD_PACKAGE_APP"
  pd_verify_bundle_checksums "$PD_PACKAGE_ROOT"
}

pd_cleanup_package_input() {
  [[ -n "${PD_PACKAGE_TEMP:-}" && -d "$PD_PACKAGE_TEMP" ]] || return 0
  case "$PD_PACKAGE_TEMP" in
    "$TMP_DIR"/package.*) rm -rf -- "$PD_PACKAGE_TEMP" ;;
    *) pd_warn "Refusing to remove unexpected temporary path: $PD_PACKAGE_TEMP" ;;
  esac
  PD_PACKAGE_TEMP=""
}

pd_assert_release_fingerprint() {
  local release="$1" expected="$2" marker="$release/.tongzhuo-release-fingerprint" actual
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || pd_die "Verified delivery fingerprint is invalid."
  [[ -f "$marker" ]] || pd_die "Immutable release fingerprint is missing: $marker"
  actual="$(tr -d '\r\n' < "$marker")"
  [[ "$actual" == "$expected" ]] \
    || pd_die "Release directory does not match the verified delivery fingerprint: $release"
}

pd_normalize_disabled_compose_secret_placeholders() {
  local release="$1" placeholder
  for placeholder in \
    "$release/deploy/private-delivery/compose-placeholders/relay-client-secret.disabled" \
    "$release/deploy/private-delivery/compose-placeholders/ad-hoc-diagnostic-api-token.disabled"; do
    [[ -f "$placeholder" && ! -L "$placeholder" ]] \
      || pd_die "Disabled Compose secret placeholder is missing or unsafe: $placeholder"
    if grep -q '[^[:space:]]' "$placeholder"; then
      pd_die "Disabled Compose secret placeholder must remain empty: $placeholder"
    fi
    # The root bootstrap entrypoint reads these deliberately empty sources,
    # then drops to node. Keep source files private on the host even though
    # the application will receive no runtime secret for blank placeholders.
    chmod 600 "$placeholder"
  done
}

pd_copy_release() {
  local source_root="$1" destination="$2" expected_fingerprint="${3:-}" temporary
  pd_validate_app_source "$source_root"
  if [[ -d "$destination" ]]; then
    pd_validate_app_source "$destination"
    pd_normalize_disabled_compose_secret_placeholders "$destination"
    if [[ -n "$expected_fingerprint" ]]; then
      pd_assert_release_fingerprint "$destination" "$expected_fingerprint"
    fi
    pd_log "Release already exists; reusing it: $destination"
    return 0
  fi
  temporary="${destination}.partial.$$"
  case "$temporary" in
    "$RELEASES_DIR"/*) ;;
    *) pd_die "Unsafe release destination: $temporary" ;;
  esac
  mkdir -p "$temporary"
  if ! tar -C "$source_root" \
      --exclude='./.git' --exclude='./.env' --exclude='./data' \
      --exclude='./node_modules' --exclude='./backups' --exclude='./coverage' \
      --exclude='./deploy/cutover.env' --exclude='./.encryption-key' \
      -cf - . | tar -C "$temporary" -xf -; then
    rm -rf -- "$temporary"
    pd_die "Could not stage release files."
  fi
  pd_validate_app_source "$temporary"
  pd_normalize_disabled_compose_secret_placeholders "$temporary"
  if [[ -n "$expected_fingerprint" ]]; then
    printf '%s\n' "$expected_fingerprint" > "$temporary/.tongzhuo-release-fingerprint"
    chmod 600 "$temporary/.tongzhuo-release-fingerprint"
  fi
  mv "$temporary" "$destination"
  pd_log "Staged release: $destination"
}

pd_link_shared_config() {
  local release="$1"
  [[ -f "$APP_ENV" ]] || pd_die "Shared application environment is missing: $APP_ENV"
  if [[ -e "$release/.env" && ! -L "$release/.env" ]]; then
    pd_die "Release contains an unexpected .env file; secrets are never accepted from a release package."
  fi
  ln -sfn "$APP_ENV" "$release/.env"
}

pd_current_release() {
  local resolved
  [[ -L "$CURRENT_LINK" ]] || return 1
  resolved="$(readlink -f "$CURRENT_LINK")"
  case "$resolved" in
    "$RELEASES_DIR"/*) ;;
    *) pd_die "Current release symlink points outside the releases directory." ;;
  esac
  pd_validate_app_source "$resolved"
  printf '%s\n' "$resolved"
}

pd_previous_release() {
  local resolved
  [[ -L "$PREVIOUS_LINK" ]] || return 1
  resolved="$(readlink -f "$PREVIOUS_LINK")"
  case "$resolved" in
    "$RELEASES_DIR"/*) ;;
    *) pd_die "Previous release symlink points outside the releases directory." ;;
  esac
  pd_validate_app_source "$resolved"
  printf '%s\n' "$resolved"
}

pd_atomic_symlink() {
  local target="$1" link="$2" temporary
  temporary="${link}.new.$$"
  [[ -d "$target" ]] || pd_die "Symlink target does not exist: $target"
  if [[ -e "$link" && ! -L "$link" ]]; then
    pd_die "Refusing to replace non-symlink path: $link"
  fi
  ln -s "$target" "$temporary"
  mv -Tf "$temporary" "$link"
}

pd_write_installed_release() {
  local release="$1" release_id temporary
  case "$(readlink -f "$release")" in
    "$RELEASES_DIR"/*) ;;
    *) pd_die "Refusing to record a release outside the releases directory: $release" ;;
  esac
  release_id="$(basename "$release")"
  temporary="$STATE_DIR/installed-release.new.$$"
  printf '%s\n' "$release_id" > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$STATE_DIR/installed-release"
}

pd_assert_installed_release_marker() {
  local release="$1" marker_file="$STATE_DIR/installed-release" marker active
  [[ -f "$marker_file" ]] || pd_die "Installed-release transaction marker is missing: $marker_file"
  marker="$(tr -d '\r\n' < "$marker_file")"
  active="$(basename "$(readlink -f "$release")")"
  [[ -n "$marker" && "$marker" == "$active" ]] \
    || pd_die "Active release link and installed-release transaction marker disagree (active: $active, marker: ${marker:-missing})."
}

pd_compose() {
  local release="$1"
  shift
  [[ -f "$CUTOVER_ENV" ]] || pd_die "Deployment environment is missing: $CUTOVER_ENV"
  docker compose --env-file "$CUTOVER_ENV" -f "$release/deploy/docker-compose.production.yml" "$@"
}

pd_compose_project_name() {
  local value
  value="$(pd_read_env_value "$CUTOVER_ENV" TZ_COMPOSE_PROJECT_NAME)"
  value="${value:-tongzhuo-geo-production}"
  [[ "$value" =~ ^[a-z0-9][a-z0-9_-]{0,126}$ ]] \
    || pd_die "Deployment Compose project name is invalid: $value"
  printf '%s\n' "$value"
}

pd_prebuild_project_name() {
  local release="$1" base digest prefix
  base="$(pd_compose_project_name)"
  digest="$(printf '%s' "$(basename "$release")" | sha256sum | awk '{print substr($1,1,12)}')"
  prefix="${base:0:40}"
  printf '%s\n' "${prefix}-prebuild-${digest}"
}

pd_prebuild_release() {
  local release="$1" project="${2:-}"
  [[ -n "$project" ]] || project="$(pd_prebuild_project_name "$release")"
  pd_log "Prebuilding the candidate release in isolated image tags: $project"
  # Building under a temporary Compose project prevents the candidate image
  # tags from replacing the tags used by the still-running production
  # containers. The final production `up --build` reuses this build cache.
  docker compose --project-name "$project" --env-file "$CUTOVER_ENV" \
    -f "$release/deploy/docker-compose.production.yml" build
}

pd_cleanup_prebuild_release() {
  local release="$1" project="$2"
  [[ -n "$release" && -n "$project" && -f "$release/deploy/docker-compose.production.yml" ]] || return 0
  docker compose --project-name "$project" --env-file "$CUTOVER_ENV" \
    -f "$release/deploy/docker-compose.production.yml" down --rmi local --remove-orphans >/dev/null 2>&1 \
    || pd_warn "Could not remove temporary prebuild image tags for $project; production data was not affected."
}

pd_assert_running_release_identity() {
  local release="$1" expected_config expected_project service container config_files project_label
  local configured_image running_image expected_image file resolved matched
  expected_config="$(readlink -f "$release/deploy/docker-compose.production.yml")"
  expected_project="$(pd_compose_project_name)"

  for service in geo-admin geo-admin-tls geo-site; do
    container="$(pd_compose "$release" ps -q "$service")"
    [[ -n "$container" ]] || pd_die "Cannot verify release identity because $service has no container."

    project_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$container" 2>/dev/null)" \
      || pd_die "Could not inspect the Compose project label for $service."
    [[ "$project_label" == "$expected_project" ]] \
      || pd_die "Running $service belongs to Compose project ${project_label:-unknown}, expected $expected_project."

    config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$container" 2>/dev/null)" \
      || pd_die "Could not inspect the Compose release label for $service."
    matched=0
    IFS=',' read -r -a compose_files <<<"$config_files"
    for file in "${compose_files[@]}"; do
      file="${file#"${file%%[![:space:]]*}"}"
      file="${file%"${file##*[![:space:]]}"}"
      [[ -n "$file" ]] || continue
      resolved="$(readlink -f "$file" 2>/dev/null || true)"
      if [[ "$resolved" == "$expected_config" ]]; then matched=1; break; fi
    done
    (( matched )) \
      || pd_die "Running $service was not created from the active release Compose file: $expected_config"

    case "$service" in
      geo-admin|geo-site)
        configured_image="$(docker inspect --format '{{.Config.Image}}' "$container" 2>/dev/null)" \
          || pd_die "Could not inspect the configured image for $service."
        running_image="$(docker inspect --format '{{.Image}}' "$container" 2>/dev/null)" \
          || pd_die "Could not inspect the running image for $service."
        expected_image="$(docker image inspect --format '{{.Id}}' "$configured_image" 2>/dev/null)" \
          || pd_die "Configured image for $service is unavailable locally: $configured_image"
        [[ -n "$running_image" && "$running_image" == "$expected_image" ]] \
          || pd_die "Running $service image does not match the active local image reference $configured_image. Reconcile the active release before accepting it."
        ;;
    esac
  done
}

pd_read_env_value() {
  local file="$1" key="$2"
  awk -v wanted="$key" '
    index($0, wanted "=") == 1 {
      value = substr($0, length(wanted) + 2)
      sub(/\r$/, "", value)
      if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) value = substr(value, 2, length(value) - 2)
      print value
      exit
    }
  ' "$file"
}

# Values in cutover.env name a protected host-side source file only.  The
# secret value itself is supplied to the application through Compose's
# /run/secrets mount and must never be placed in app.env.
pd_compose_secret_source_path() {
  local key="$1" value
  value="$(pd_read_env_value "$CUTOVER_ENV" "$key")"
  [[ -z "$value" || "$value" == /* ]] \
    || pd_die "$key must be an absolute host file path when configured."
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] \
    || pd_die "$key contains a newline."
  printf '%s\n' "$value"
}

pd_admin_port() {
  local value
  value="$(pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_ADMIN_PORT)"
  printf '%s\n' "${value:-18183}"
}

pd_admin_bind() {
  local value
  value="$(pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_ADMIN_BIND_ADDRESS)"
  printf '%s\n' "${value:-127.0.0.1}"
}

pd_site_port() {
  local value
  value="$(pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_SITE_PORT)"
  printf '%s\n' "${value:-18080}"
}

pd_site_url() {
  pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_SITE_BASE_URL
}

pd_backup_release() {
  local release="$1" label="${2:-manual}" stamp name container_path host_path
  label="$(printf '%s' "$label" | tr -cs 'A-Za-z0-9._-' '-')"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  name="${stamp}-${label}-$$"
  container_path="/app/data/backups/$name"
  host_path="$BACKUPS_DIR/$name"
  mkdir -p "$host_path"
  chmod 700 "$host_path" 2>/dev/null || true
  pd_log "Creating application-consistent backup: $name"
  # A one-off container shares the production data volume and receives the
  # customer website as a read-only mount. This lets backup v2 capture both
  # data and the exact static-site snapshot without broadening the long-lived
  # admin container's filesystem access.
  pd_compose "$release" run --rm --no-deps --user 0 \
    -v "$SITE_DIR:/site:ro" \
    -v "$release/deploy:/deployment-config/release:ro" \
    -v "$CUTOVER_ENV:/deployment-config/cutover.env:ro" \
    -e TZ_GEO_ADMIN_MAINTENANCE_ROOT=1 \
    -e TZ_SITE_STATIC_ROOT=/site \
    -e TZ_DEPLOY_CONFIG_DIR=/deployment-config \
    geo-admin node scripts/backup-production.mjs "$container_path" >&2
  # docker compose cp addresses the stable service container. Create it when
  # backup is invoked during recovery of an otherwise stopped deployment.
  pd_compose "$release" create geo-admin >/dev/null
  pd_compose "$release" cp "geo-admin:${container_path}/." "$host_path/" >&2
  [[ -s "$host_path/manifest.json" ]] || pd_die "Backup copy is incomplete; manifest.json is missing."
  chmod -R go-rwx "$host_path" 2>/dev/null || true
  printf '%s\n' "$host_path"
}

pd_validate_backup_dir() {
  local source="${1:-}" resolved
  [[ -d "$source" ]] || pd_die "Backup directory does not exist: $source"
  resolved="$(cd "$source" && pwd -P)"
  [[ -f "$resolved/manifest.json" ]] || pd_die "Backup does not contain manifest.json: $resolved"
  grep -Eq '"format"[[:space:]]*:[[:space:]]*"tongzhuo-private-backup-v[0-9]+"' "$resolved/manifest.json" \
    || pd_die "Backup manifest format is not recognized."
  printf '%s\n' "$resolved"
}

pd_restore_release() {
  local release="$1" source stamp container_site_stage container_config_stage host_site_stage site_history config_history
  source="$(pd_validate_backup_dir "$2")" || return 1
  stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$-${RANDOM}"
  container_site_stage="/app/data/site-restore-$stamp"
  container_config_stage="/app/data/deployment-config-restore-$stamp"
  host_site_stage="$INSTALL_ROOT/.site-restore-$stamp"
  site_history="$STATE_DIR/site-history/$stamp"
  config_history="$STATE_DIR/deployment-config-history/$stamp"
  pd_log "Restoring validated backup from: $source"
  # Restore website files into a unique directory in the data volume first.
  # A bind-mount root cannot be renamed atomically from inside a container;
  # after the validated application transaction commits, the host performs a
  # same-filesystem swap of the staged website directory.
  pd_compose "$release" run --rm --no-deps --user 0 \
    -v "$source:/restore:ro" \
    -e TZ_GEO_ADMIN_MAINTENANCE_ROOT=1 \
    -e "TZ_SITE_STATIC_ROOT=$container_site_stage" \
    -e "TZ_DEPLOY_CONFIG_DIR=$container_config_stage" \
    geo-admin sh -ceu 'node scripts/restore-production.mjs /restore --force; chown -R node:node /app/data' >&2 \
    || return 1

  mkdir -p "$host_site_stage" || return 1
  chmod 700 "$host_site_stage" 2>/dev/null || true
  # Ensure a service container exists as a safe docker-cp view of the named
  # data volume. This is also valid during a first-install restore.
  pd_compose "$release" create geo-admin >/dev/null || return 1
  mkdir -p "$config_history"
  if pd_compose "$release" cp "geo-admin:${container_config_stage}/." "$config_history/" >/dev/null 2>&1; then
    chmod -R go-rwx "$config_history" 2>/dev/null || true
    pd_log "Preserved the restored deployment snapshot for review at $config_history; active ports and certificates were not overwritten."
  else
    rmdir "$config_history" 2>/dev/null || true
  fi
  if pd_compose "$release" cp "geo-admin:${container_site_stage}/." "$host_site_stage/" >/dev/null 2>&1; then
    if [[ ! -f "$host_site_stage/index.html" ]]; then
      pd_warn "Restored website snapshot is missing index.html."
      return 1
    fi
    chmod -R a+rX "$host_site_stage"
    mkdir -p "$(dirname "$site_history")" || return 1
    if [[ -e "$SITE_DIR" ]]; then mv "$SITE_DIR" "$site_history" || return 1; fi
    mv "$host_site_stage" "$SITE_DIR" || return 1
    chmod 755 "$SITE_DIR" 2>/dev/null || true
    pd_log "Restored the website snapshot; previous static files are preserved at $site_history"
  else
    rmdir "$host_site_stage" 2>/dev/null || true
    pd_log "Backup has no website snapshot; existing shared static files were preserved."
  fi
}

pd_up_release() {
  local release="$1"
  # Every release lives at a different immutable path. Recreate all services,
  # including the unchanged TLS proxy, so Compose provenance labels point to
  # the active release and interrupted cutovers cannot pass acceptance using
  # containers created from an older release directory.
  pd_compose "$release" up -d --build --force-recreate --remove-orphans
}

pd_stop_release() {
  local release="$1"
  pd_compose "$release" stop
}

pd_verify_release() {
  local release="$1" timeout="${2:-180}" verifier
  verifier="$PD_OPERATOR_DIR/verify.sh"
  [[ -f "$verifier" ]] || pd_die "Operator acceptance script is missing: $verifier"
  # The operator that begins an upgrade owns the complete transaction. In
  # particular, a rollback to an older release must not silently downgrade
  # the acceptance rules to that older release's verifier.
  bash "$verifier" --install-root "$INSTALL_ROOT" --timeout "$timeout"
}

pd_print_admin_instructions() {
  local port bind
  port="$(pd_admin_port)"
  bind="$(pd_admin_bind)"
  printf '\nManagement entry (HTTPS): https://127.0.0.1:%s/\n' "$port"
  if [[ "$bind" == "127.0.0.1" || "$bind" == "::1" || "$bind" == "localhost" ]]; then
    printf 'For remote administration, open an SSH tunnel first:\n'
    printf '  ssh -L %s:127.0.0.1:%s <server-user>@<server-host>\n' "$port" "$port"
  else
    printf 'The admin listener is bound to %s. Restrict it with the customer firewall and use the certificate hostname.\n' "$bind"
  fi
  printf 'On an empty deployment this page opens the one-time enterprise administrator setup form.\n'
}

pd_assert_release_script_set() {
  local release="$1" file
  for file in lib.sh preflight.sh install.sh manage.sh verify.sh upgrade.sh; do
    [[ -f "$release/deploy/private-delivery/$file" ]] || pd_die "Release is missing private-delivery script: $file"
  done
}
