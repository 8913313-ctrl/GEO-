#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INSTALL_ROOT="${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}"
SOURCE_ROOT=""
SITE_SOURCE=""
SITE_URL=""
SITE_BIND="0.0.0.0"
SITE_PORT="18080"
ADMIN_BIND="127.0.0.1"
ADMIN_PORT="18183"
ADMIN_NAME="localhost"
TLS_CERT_SOURCE=""
TLS_KEY_SOURCE=""
ALLOW_PUBLIC_ADMIN=0
SKIP_START=0
RELEASE_ID_REQUESTED="${TZ_RELEASE_ID:-}"
DEPLOYMENT_ID="tongzhuo-geo-production"
RESTORE_BACKUP=""
LEGACY_EXPORT=""
MIGRATION_DIR=""
APPLY_MIGRATION=0

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Installs one enterprise deployment beneath /opt/tongzhuo-geo. The command is
idempotent for the same release. Use upgrade.sh for a different release.

Required on a fresh installation:
  --site-url URL             Canonical public website URL
  --site-source PATH         Website static files (auto-detected from a bundle's site-template/)

Options:
  --install-root PATH        Installation root
  --source PATH              Application source root (default: package app/)
  --release-id ID            Explicit immutable release identifier
  --deployment-id ID         Compose/volume namespace (default: tongzhuo-geo-production)
  --site-bind ADDRESS        Website listener address (default: 0.0.0.0)
  --site-port PORT           Website host port (default: 18080)
  --admin-bind ADDRESS       Admin HTTPS listener (default: 127.0.0.1)
  --admin-port PORT          Admin HTTPS port (default: 18183)
  --admin-name NAME          TLS certificate DNS name (default: localhost)
  --tls-cert FILE            Existing PEM certificate (requires --tls-key)
  --tls-key FILE             Existing PEM private key (requires --tls-cert)
  --allow-public-admin       Permit a non-loopback admin bind; TLS files are required
  --restore-backup PATH      Restore a complete Tongzhuo private backup before first start
  --legacy-export FILE       Import a validated legacy GEOFlow export before first start
  --migration-dir PATH       Sensitive migration payload directory from a migrated bundle
  --apply-migration          Explicitly authorize applying the bundle migration payload
  --confirm-sensitive        Alias of --apply-migration
  --skip-start               Install and build, but do not start containers
  -h, --help                 Show this help

Administrator passwords are never accepted on the command line. After start,
open the HTTPS management entry to create the first enterprise administrator.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) [[ $# -ge 2 ]] || pd_die "--install-root requires a value"; INSTALL_ROOT="$2"; shift 2 ;;
    --source) [[ $# -ge 2 ]] || pd_die "--source requires a value"; SOURCE_ROOT="$2"; shift 2 ;;
    --release-id) [[ $# -ge 2 ]] || pd_die "--release-id requires a value"; RELEASE_ID_REQUESTED="$2"; shift 2 ;;
    --deployment-id) [[ $# -ge 2 ]] || pd_die "--deployment-id requires a value"; DEPLOYMENT_ID="$2"; shift 2 ;;
    --site-url) [[ $# -ge 2 ]] || pd_die "--site-url requires a value"; SITE_URL="$2"; shift 2 ;;
    --site-source) [[ $# -ge 2 ]] || pd_die "--site-source requires a value"; SITE_SOURCE="$2"; shift 2 ;;
    --site-bind) [[ $# -ge 2 ]] || pd_die "--site-bind requires a value"; SITE_BIND="$2"; shift 2 ;;
    --site-port) [[ $# -ge 2 ]] || pd_die "--site-port requires a value"; SITE_PORT="$2"; shift 2 ;;
    --admin-bind) [[ $# -ge 2 ]] || pd_die "--admin-bind requires a value"; ADMIN_BIND="$2"; shift 2 ;;
    --admin-port) [[ $# -ge 2 ]] || pd_die "--admin-port requires a value"; ADMIN_PORT="$2"; shift 2 ;;
    --admin-name) [[ $# -ge 2 ]] || pd_die "--admin-name requires a value"; ADMIN_NAME="$2"; shift 2 ;;
    --tls-cert) [[ $# -ge 2 ]] || pd_die "--tls-cert requires a value"; TLS_CERT_SOURCE="$2"; shift 2 ;;
    --tls-key) [[ $# -ge 2 ]] || pd_die "--tls-key requires a value"; TLS_KEY_SOURCE="$2"; shift 2 ;;
    --allow-public-admin) ALLOW_PUBLIC_ADMIN=1; shift ;;
    --restore-backup) [[ $# -ge 2 ]] || pd_die "--restore-backup requires a value"; RESTORE_BACKUP="$2"; shift 2 ;;
    --legacy-export) [[ $# -ge 2 ]] || pd_die "--legacy-export requires a value"; LEGACY_EXPORT="$2"; shift 2 ;;
    --migration-dir) [[ $# -ge 2 ]] || pd_die "--migration-dir requires a value"; MIGRATION_DIR="$2"; shift 2 ;;
    --apply-migration|--confirm-sensitive) APPLY_MIGRATION=1; shift ;;
    --skip-start) SKIP_START=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) pd_die "Unknown option: $1" ;;
  esac
done

pd_init_paths

if [[ -z "$SOURCE_ROOT" ]]; then
  SOURCE_ROOT="$(pd_discover_local_app "$SCRIPT_DIR")"
else
  [[ -d "$SOURCE_ROOT" ]] || pd_die "Application source does not exist: $SOURCE_ROOT"
  SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"
fi
pd_validate_app_source "$SOURCE_ROOT"
BUNDLE_ROOT="$(pd_bundle_root_for_app "$SOURCE_ROOT")"

if [[ -z "$SITE_SOURCE" && -d "$BUNDLE_ROOT/site-template" ]]; then
  SITE_SOURCE="$BUNDLE_ROOT/site-template"
fi
if [[ -z "$MIGRATION_DIR" && -d "$BUNDLE_ROOT/migration" ]]; then
  MIGRATION_DIR="$BUNDLE_ROOT/migration"
fi

if [[ -n "$MIGRATION_DIR" ]]; then
  MIGRATION_DIR="$(cd "$MIGRATION_DIR" && pwd -P)"
  (( APPLY_MIGRATION )) || pd_die "This package contains a sensitive migration payload. Re-run with --apply-migration after confirming the customer and backup source."
  if [[ -z "$RESTORE_BACKUP" && -f "$MIGRATION_DIR/manifest.json" ]] \
      && grep -Eq '"format"[[:space:]]*:[[:space:]]*"tongzhuo-private-backup-v[0-9]+"' "$MIGRATION_DIR/manifest.json"; then
    RESTORE_BACKUP="$MIGRATION_DIR"
  elif [[ -z "$RESTORE_BACKUP" && -f "$MIGRATION_DIR/private-backup/manifest.json" ]]; then
    RESTORE_BACKUP="$MIGRATION_DIR/private-backup"
  fi
  if [[ -z "$LEGACY_EXPORT" && -f "$MIGRATION_DIR/legacy-geoflow-export.json" ]]; then
    LEGACY_EXPORT="$MIGRATION_DIR/legacy-geoflow-export.json"
  fi
  if [[ -z "$SITE_SOURCE" && -f "$MIGRATION_DIR/site/index.html" ]]; then
    SITE_SOURCE="$MIGRATION_DIR/site"
  elif [[ -z "$SITE_SOURCE" && -f "$MIGRATION_DIR/index.html" ]]; then
    SITE_SOURCE="$MIGRATION_DIR"
  fi
fi

[[ -z "$RESTORE_BACKUP" || -z "$LEGACY_EXPORT" ]] \
  || pd_die "A full backup restore and a legacy additive import cannot be applied in the same installation."
if [[ -n "$RESTORE_BACKUP" ]]; then RESTORE_BACKUP="$(pd_validate_backup_dir "$RESTORE_BACKUP")"; fi
if [[ -n "$LEGACY_EXPORT" ]]; then
  [[ -f "$LEGACY_EXPORT" ]] || pd_die "Legacy export does not exist: $LEGACY_EXPORT"
  LEGACY_EXPORT="$(readlink -f "$LEGACY_EXPORT")"
fi

[[ "$ADMIN_PORT" =~ ^[0-9]+$ ]] && (( ADMIN_PORT >= 1 && ADMIN_PORT <= 65535 )) \
  || pd_die "Invalid admin port: $ADMIN_PORT"
[[ "$SITE_PORT" =~ ^[0-9]+$ ]] && (( SITE_PORT >= 1 && SITE_PORT <= 65535 )) \
  || pd_die "Invalid website port: $SITE_PORT"
[[ "$SITE_BIND" =~ ^[0-9.]+$ ]] || pd_die "--site-bind must be an IPv4 bind address."
[[ "$ADMIN_BIND" =~ ^[0-9.]+$ ]] || pd_die "--admin-bind must be an IPv4 bind address."
[[ "$ADMIN_NAME" =~ ^[A-Za-z0-9.-]+$ ]] || pd_die "--admin-name contains unsupported characters."
[[ "$DEPLOYMENT_ID" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] \
  || pd_die "--deployment-id must be 1-63 lowercase letters, digits, underscores, or hyphens."
case "$ADMIN_BIND" in
  127.0.0.1) ;;
  *)
    (( ALLOW_PUBLIC_ADMIN )) || pd_die "A non-loopback admin bind requires --allow-public-admin."
    [[ -n "$TLS_CERT_SOURCE" && -n "$TLS_KEY_SOURCE" ]] \
      || pd_die "A public admin bind requires an explicitly supplied TLS certificate and key."
    ;;
esac
[[ -z "$TLS_CERT_SOURCE" && -z "$TLS_KEY_SOURCE" || -n "$TLS_CERT_SOURCE" && -n "$TLS_KEY_SOURCE" ]] \
  || pd_die "--tls-cert and --tls-key must be supplied together."

FRESH_INSTALL=1
if [[ -L "$CURRENT_LINK" ]]; then FRESH_INSTALL=0; fi

preflight_args=(--install-root "$INSTALL_ROOT" --source "$SOURCE_ROOT" --site-port "$SITE_PORT" --admin-port "$ADMIN_PORT")
if [[ -n "$SITE_SOURCE" ]]; then preflight_args+=(--site-source "$SITE_SOURCE"); fi
if (( FRESH_INSTALL )); then preflight_args+=(--check-ports); fi
bash "$SCRIPT_DIR/preflight.sh" "${preflight_args[@]}"

pd_ensure_layout
pd_acquire_lock

dotenv_quote() {
  local value="$1"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || pd_die "Configuration value contains a newline."
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\$\$}"
  printf '"%s"' "$value"
}

write_default_app_env() {
  [[ ! -e "$APP_ENV" ]] || return 0
  cat > "$APP_ENV" <<'EOF'
NODE_ENV=production
TZ_BIND_HOST=0.0.0.0
PORT=43127
TZ_DATA_DIR=/app/data
TZ_DATABASE_PATH=/app/data/tongzhuo-production.sqlite
TZ_LOG_DIR=/app/data/logs
TZ_BACKUP_DIR=/app/data/backups
# Intentionally blank: the app creates /app/data/secrets/master.key with mode 0600.
# The complete backup must always include that file.
TZ_MASTER_KEY=
TZ_COOKIE_SECURE=1
TZ_SESSION_HOURS=12
TZ_TRUST_PROXY=0
TZ_AI_TIMEOUT_MS=90000
TZ_AI_MAX_RESPONSE_BYTES=2000000
TZ_AI_MAX_ATTEMPTS=2
TZ_EMBEDDING_PROVIDER_ID=
TZ_EMBEDDING_TIMEOUT_MS=30000
TZ_RAG_LOCAL_FALLBACK=1
TZ_OCR_ENDPOINT=
TZ_OCR_API_KEY=
TZ_OCR_TIMEOUT_MS=60000
TZ_VECTOR_STORE_URL=
TZ_VECTOR_STORE_API_KEY=
TZ_VECTOR_STORE_COLLECTION=knowledge_chunks
TZ_VECTOR_STORE_REQUIRED=0
TZ_VECTOR_STORE_TIMEOUT_MS=30000
TZ_KNOWLEDGE_ASYNC_INDEX=0
TZ_KNOWLEDGE_ASYNC_INDEX_CHARS=100000
TZ_MONITORING_REMOTE_PORTS=80,443
TZ_MONITORING_IP_SALT=
# Central Tongzhuo AI-effect relay. The operator issues these identities per
# private instance. The HMAC value is injected by Compose from a protected
# host file; never put TZ_RELAY_CLIENT_SECRET in app.env.
TZ_RELAY_BASE_URL=
TZ_RELAY_INSTANCE_ID=
TZ_RELAY_CLIENT_ID=
TZ_RELAY_DELIVERY_CONSUMER=
TZ_RELAY_TIMEOUT_MS=15000
TZ_RELAY_PULL_INTERVAL_MS=10000
TZ_RELAY_PULL_BATCH_SIZE=50
# Brand-monitoring occurrences always obtain a fresh relay quote and use the
# per-plan credit cap persisted by the authenticated customer operator.
TZ_BRAND_MONITORING_SCHEDULER_INTERVAL_MS=60000
TZ_BRAND_MONITORING_SCHEDULER_BATCH_SIZE=12
# Optional customer-server-only temporary-diagnostic API. It remains disabled
# until its separate Compose secret source is configured in cutover.env.
EOF
  chmod 600 "$APP_ENV"
}

write_default_cutover_env() {
  [[ ! -e "$CUTOVER_ENV" ]] || return 0
  [[ -n "$SITE_URL" ]] || pd_die "--site-url is required on a fresh installation."
  case "$SITE_URL" in
    http://*|https://*) ;;
    *) pd_die "--site-url must begin with http:// or https://" ;;
  esac
  [[ "$SITE_URL" != *[' '@]* && "$SITE_URL" != *$'\n'* && "$SITE_URL" != *$'\r'* ]] \
    || pd_die "--site-url contains credentials, whitespace, or a newline."
  {
    printf 'TZ_COMPOSE_PROJECT_NAME=%s\n' "$DEPLOYMENT_ID"
    printf 'TZ_SITE_STATIC_HOST_PATH=%s\n' "$(dotenv_quote "$SITE_DIR")"
    printf 'TZ_SITE_WORKSPACE_ID=default\n'
    printf 'TZ_STAGING_SITE_BIND_ADDRESS=127.0.0.1\n'
    printf 'TZ_STAGING_ADMIN_BIND_ADDRESS=127.0.0.1\n'
    printf 'TZ_STAGING_SITE_BASE_URL=http://127.0.0.1:18182\n'
    printf 'TZ_STAGING_DATA_VOLUME=tongzhuo-geo-staging-data\n'
    printf 'TZ_PRODUCTION_SITE_BIND_ADDRESS=%s\n' "$SITE_BIND"
    printf 'TZ_PRODUCTION_SITE_PORT=%s\n' "$SITE_PORT"
    printf 'TZ_PRODUCTION_SITE_BASE_URL=%s\n' "$(dotenv_quote "$SITE_URL")"
    printf 'TZ_PRODUCTION_ADMIN_BIND_ADDRESS=%s\n' "$ADMIN_BIND"
    printf 'TZ_PRODUCTION_ADMIN_PORT=%s\n' "$ADMIN_PORT"
    printf 'TZ_ADMIN_TLS_CERT_HOST_PATH=%s\n' "$(dotenv_quote "$CERTS_DIR")"
    printf 'TZ_PRODUCTION_DATA_VOLUME=%s-data\n' "$DEPLOYMENT_ID"
    printf 'TZ_PRODUCTION_TRUST_PROXY=0\n'
    printf 'TZ_PRODUCTION_COOKIE_SECURE=1\n'
    printf 'TZ_RELAY_CLIENT_SECRET_HOST_PATH=\n'
    printf 'TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH=\n'
  } > "$CUTOVER_ENV"
  chmod 600 "$CUTOVER_ENV"
}

install_site_template() {
  if [[ -f "$SITE_DIR/index.html" ]]; then
    pd_log "Preserving existing website static directory: $SITE_DIR"
    return 0
  fi
  [[ -n "$SITE_SOURCE" ]] || pd_die "--site-source is required because the shared website directory is empty."
  SITE_SOURCE="$(cd "$SITE_SOURCE" && pwd -P)"
  [[ -f "$SITE_SOURCE/index.html" ]] || pd_die "Website source must contain index.html."
  if find "$SITE_SOURCE" -type l -print -quit | grep -q .; then
    pd_die "Website source must not contain symbolic links."
  fi
  tar -C "$SITE_SOURCE" -cf - . | tar -C "$SITE_DIR" -xf -
  [[ -f "$SITE_DIR/index.html" ]] || pd_die "Website static copy did not produce index.html."
  chmod -R a+rX "$SITE_DIR"
  pd_log "Installed shared website static files."
}

verify_tls_pair() {
  local cert="$1" key="$2" cert_hash key_hash
  openssl x509 -in "$cert" -noout >/dev/null 2>&1 || pd_die "TLS certificate is not valid PEM."
  openssl pkey -in "$key" -noout >/dev/null 2>&1 || pd_die "TLS private key is not valid PEM."
  cert_hash="$(openssl x509 -in "$cert" -pubkey -noout | openssl pkey -pubin -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
  key_hash="$(openssl pkey -in "$key" -pubout -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
  [[ -n "$cert_hash" && "$cert_hash" == "$key_hash" ]] || pd_die "TLS certificate and private key do not match."
}

install_tls() {
  local cert_target="$CERTS_DIR/admin.crt" key_target="$CERTS_DIR/admin.key"
  if [[ -f "$cert_target" && -f "$key_target" && -z "$TLS_CERT_SOURCE" ]]; then
    verify_tls_pair "$cert_target" "$key_target"
    return 0
  fi
  if [[ -n "$TLS_CERT_SOURCE" ]]; then
    TLS_CERT_SOURCE="$(readlink -f "$TLS_CERT_SOURCE")"
    TLS_KEY_SOURCE="$(readlink -f "$TLS_KEY_SOURCE")"
    [[ -f "$TLS_CERT_SOURCE" && -f "$TLS_KEY_SOURCE" ]] || pd_die "TLS source files do not exist."
    verify_tls_pair "$TLS_CERT_SOURCE" "$TLS_KEY_SOURCE"
    install -m 0644 "$TLS_CERT_SOURCE" "${cert_target}.new"
    install -m 0600 "$TLS_KEY_SOURCE" "${key_target}.new"
  else
    pd_log "Generating a local self-signed administrator certificate. Replace it with the enterprise certificate before public exposure."
    openssl req -x509 -newkey rsa:3072 -sha256 -days 825 -nodes \
      -keyout "${key_target}.new" -out "${cert_target}.new" \
      -subj "/CN=$ADMIN_NAME" \
      -addext "subjectAltName=DNS:$ADMIN_NAME,DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
    chmod 600 "${key_target}.new"
    chmod 644 "${cert_target}.new"
  fi
  verify_tls_pair "${cert_target}.new" "${key_target}.new"
  mv -f "${cert_target}.new" "$cert_target"
  mv -f "${key_target}.new" "$key_target"
}

write_default_app_env
write_default_cutover_env
install_site_template
install_tls

RELEASE_ID="$(pd_release_id "$SOURCE_ROOT" "$BUNDLE_ROOT" "$RELEASE_ID_REQUESTED")"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"
RELEASE_FINGERPRINT=""
if [[ -f "$BUNDLE_ROOT/manifest.json" ]]; then
  RELEASE_FINGERPRINT="$(sha256sum "$BUNDLE_ROOT/manifest.json" | awk '{print $1}')"
fi

if (( ! FRESH_INSTALL )); then
  current="$(pd_current_release)"
  [[ "$current" == "$RELEASE_PATH" ]] \
    || pd_die "A different release is already installed ($(basename "$current")). Use upgrade.sh apply for $RELEASE_ID."
  [[ -z "$RESTORE_BACKUP" && -z "$LEGACY_EXPORT" ]] \
    || pd_die "Migration and restore options are accepted only during a fresh installation."
fi

pd_copy_release "$SOURCE_ROOT" "$RELEASE_PATH" "$RELEASE_FINGERPRINT"
pd_assert_release_script_set "$RELEASE_PATH"
pd_link_shared_config "$RELEASE_PATH"
pd_compose "$RELEASE_PATH" config >/dev/null || pd_die "Generated production Compose configuration is invalid."
pd_log "Building production images."
pd_compose "$RELEASE_PATH" build

if (( FRESH_INSTALL )); then
  if [[ -n "$RESTORE_BACKUP" ]]; then
    pd_restore_release "$RELEASE_PATH" "$RESTORE_BACKUP"
  elif [[ -n "$LEGACY_EXPORT" ]]; then
    pd_log "Importing validated legacy GEOFlow data into the new data volume."
    pd_compose "$RELEASE_PATH" run --rm --no-deps --user 0 \
      -v "$LEGACY_EXPORT:/migration/legacy-geoflow-export.json:ro" \
      -e TZ_GEO_ADMIN_MAINTENANCE_ROOT=1 \
      geo-admin node scripts/import-legacy-geoflow.mjs \
      --input /migration/legacy-geoflow-export.json --workspace default --initialize-workspace
  fi
  pd_atomic_symlink "$RELEASE_PATH" "$CURRENT_LINK"
fi

pd_write_installed_release "$RELEASE_PATH"

if (( SKIP_START )); then
  pd_log "Installation is staged but containers were not started (--skip-start)."
  pd_print_admin_instructions
  exit 0
fi

if ! pd_up_release "$RELEASE_PATH"; then
  pd_die "Container startup failed. Data and release files were preserved for diagnosis; run manage.sh logs."
fi
if ! pd_verify_release "$RELEASE_PATH" 240; then
  pd_die "Containers started but acceptance verification failed; run manage.sh logs and manage.sh status."
fi

pd_log "Private deployment installation completed: $RELEASE_ID"
pd_print_admin_instructions
