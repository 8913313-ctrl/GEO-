#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INSTALL_ROOT="${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}"
TIMEOUT=180
REQUIRE_INITIALIZED=0

usage() {
  cat <<'EOF'
Usage: verify.sh [--install-root PATH] [--timeout SECONDS] [--require-initialized]

Validates immutable release links, protected Compose secret sources, Compose
state, HTTPS-only administration, health endpoints, first-run status, and the
public AI-readable website endpoints.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) [[ $# -ge 2 ]] || pd_die "--install-root requires a value"; INSTALL_ROOT="$2"; shift 2 ;;
    --timeout) [[ $# -ge 2 ]] || pd_die "--timeout requires a value"; TIMEOUT="$2"; shift 2 ;;
    --require-initialized) REQUIRE_INITIALIZED=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) pd_die "Unknown option: $1" ;;
  esac
done

[[ "$TIMEOUT" =~ ^[0-9]+$ ]] && (( TIMEOUT >= 5 && TIMEOUT <= 1800 )) \
  || pd_die "--timeout must be between 5 and 1800 seconds"

pd_init_paths
for command_name in docker curl openssl stat grep awk readlink tr cmp; do pd_require_command "$command_name"; done

CURRENT="$(pd_current_release)" || pd_die "No active release exists."
pd_assert_release_script_set "$CURRENT"
pd_link_shared_config "$CURRENT"
[[ -f "$SITE_DIR/index.html" ]] || pd_die "Shared website static root is missing index.html: $SITE_DIR"
[[ -f "$CERTS_DIR/admin.crt" && -f "$CERTS_DIR/admin.key" ]] || pd_die "Admin TLS certificate files are missing."
openssl x509 -in "$CERTS_DIR/admin.crt" -noout >/dev/null 2>&1 || pd_die "Admin TLS certificate is invalid."
openssl pkey -in "$CERTS_DIR/admin.key" -noout >/dev/null 2>&1 || pd_die "Admin TLS private key is invalid."

assert_private_file() {
  local file="$1" label="$2" mode
  [[ ! -L "$file" ]] || pd_die "$label must not be a symbolic link: $file"
  [[ -f "$file" ]] || pd_die "$label is missing: $file"
  mode="$(stat -c '%a' "$file")"
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || pd_die "Cannot interpret permissions for $label: $mode"
  if (( (8#$mode & 077) != 0 )); then
    pd_die "$label must not be readable or writable by group/other (current mode: $mode)."
  fi
}

assert_blank_app_env_value() {
  local key="$1" value
  value="$(pd_read_env_value "$APP_ENV" "$key")"
  [[ -z "$value" ]] || pd_die "$key must not be stored in app.env. Use the protected Compose secret source instead."
}

secret_file_has_value() {
  local file="$1"
  grep -q '[^[:space:]]' "$file"
}

assert_private_file "$APP_ENV" "Application environment"
assert_private_file "$CUTOVER_ENV" "Deployment environment"
assert_private_file "$CERTS_DIR/admin.key" "Admin TLS private key"
assert_private_file "$STATE_DIR/installed-release" "Installed-release transaction marker"
pd_assert_installed_release_marker "$CURRENT"

# app.env is a persistent deployment file. Direct credentials there are
# visible to application environment inspection and must never be accepted in
# a production private delivery. Compose injects the two *_FILE paths itself.
assert_blank_app_env_value "TZ_RELAY_CLIENT_SECRET"
assert_blank_app_env_value "TZ_AD_HOC_DIAGNOSTIC_API_TOKEN"

relay_base_url="$(pd_read_env_value "$APP_ENV" TZ_RELAY_BASE_URL)"
relay_instance_id="$(pd_read_env_value "$APP_ENV" TZ_RELAY_INSTANCE_ID)"
relay_client_id="$(pd_read_env_value "$APP_ENV" TZ_RELAY_CLIENT_ID)"
relay_identity_count=0
for relay_identity_value in "$relay_base_url" "$relay_instance_id" "$relay_client_id"; do
  [[ -z "$relay_identity_value" ]] || ((relay_identity_count += 1))
done
[[ "$relay_identity_count" == "0" || "$relay_identity_count" == "3" ]] \
  || pd_die "Relay provisioning requires TZ_RELAY_BASE_URL, TZ_RELAY_INSTANCE_ID, and TZ_RELAY_CLIENT_ID together."

relay_secret_source="$(pd_compose_secret_source_path TZ_RELAY_CLIENT_SECRET_HOST_PATH)"
ad_hoc_secret_source="$(pd_compose_secret_source_path TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH)"
if [[ -n "$relay_secret_source" ]]; then
  assert_private_file "$relay_secret_source" "Relay HMAC Compose secret source"
fi
if [[ -n "$ad_hoc_secret_source" ]]; then
  assert_private_file "$ad_hoc_secret_source" "Ad-hoc diagnostic Compose secret source"
fi
if [[ "$relay_identity_count" == "3" ]]; then
  [[ -n "$relay_secret_source" ]] \
    || pd_die "Relay identity is configured but TZ_RELAY_CLIENT_SECRET_HOST_PATH is empty in cutover.env."
  secret_file_has_value "$relay_secret_source" \
    || pd_die "Relay HMAC Compose secret source is empty."
elif [[ -n "$relay_secret_source" ]] && secret_file_has_value "$relay_secret_source"; then
  pd_die "A relay HMAC source is configured without the complete relay identity."
fi
if [[ -n "$relay_secret_source" && -n "$ad_hoc_secret_source" ]] \
    && secret_file_has_value "$relay_secret_source" && secret_file_has_value "$ad_hoc_secret_source" \
    && cmp -s "$relay_secret_source" "$ad_hoc_secret_source"; then
  pd_die "The optional ad-hoc diagnostic API token must not reuse the relay HMAC secret."
fi

cookie_secure="$(pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_COOKIE_SECURE)"
[[ "$cookie_secure" == "1" || "$cookie_secure" == "true" ]] \
  || pd_die "Production Secure Cookie protection must remain enabled."

admin_bind="$(pd_admin_bind)"
if [[ "$admin_bind" != "127.0.0.1" ]]; then
  pd_warn "Admin HTTPS is not loopback-only ($admin_bind); verify the customer firewall and certificate hostname."
fi

pd_compose "$CURRENT" config >/dev/null || pd_die "Docker Compose configuration is invalid."
admin_container="$(pd_compose "$CURRENT" ps -q geo-admin)"
[[ -n "$admin_container" ]] || pd_die "The admin application container does not exist."
admin_port_bindings="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$admin_container")"
[[ "$admin_port_bindings" == "{}" || "$admin_port_bindings" == "null" ]] \
  || pd_die "The plain HTTP admin application has an unexpected host port binding: $admin_port_bindings"
admin_secret_targets="$(docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$admin_container")"
for secret_target in /run/secrets/tz_relay_client_secret /run/secrets/tz_ad_hoc_diagnostic_api_token; do
  printf '%s\n' "$admin_secret_targets" | grep -Fxq "$secret_target" \
    || pd_die "geo-admin is missing the required Compose secret mount: $secret_target"
done
admin_environment="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$admin_container")"
printf '%s\n' "$admin_environment" | grep -Fxq 'TZ_RELAY_CLIENT_SECRET_FILE=/run/secrets/tz_relay_client_secret' \
  || pd_die "geo-admin does not use the relay Compose secret file path."
printf '%s\n' "$admin_environment" | grep -Fxq 'TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE=/run/secrets/tz_ad_hoc_diagnostic_api_token' \
  || pd_die "geo-admin does not use the ad-hoc Compose secret file path."
if printf '%s\n' "$admin_environment" | grep -Eq '^TZ_RELAY_CLIENT_SECRET=.+$|^TZ_AD_HOC_DIAGNOSTIC_API_TOKEN=.+$'; then
  pd_die "geo-admin received a plaintext relay or ad-hoc secret environment variable."
fi

deadline=$((SECONDS + TIMEOUT))
required_services=(geo-admin geo-admin-tls geo-site)
while true; do
  mapfile -t running_services < <(pd_compose "$CURRENT" ps --services --status running 2>/dev/null || true)
  missing=0
  for service in "${required_services[@]}"; do
    if ! printf '%s\n' "${running_services[@]}" | grep -qx "$service"; then missing=1; fi
  done
  (( missing == 0 )) && break
  (( SECONDS < deadline )) || {
    pd_compose "$CURRENT" ps >&2 || true
    pd_die "Not all production containers reached running state within ${TIMEOUT}s."
  }
  sleep 2
done

# A running/healthy container alone is insufficient after an interrupted
# upgrade: the current symlink, Compose file, and local image tag must all
# describe the same release transaction.
pd_assert_running_release_identity "$CURRENT"

admin_port="$(pd_admin_port)"
admin_health_url="https://127.0.0.1:${admin_port}/health/ready"
admin_status_url="https://127.0.0.1:${admin_port}/api/v1/auth/status"
site_bind="$(pd_read_env_value "$CUTOVER_ENV" TZ_PRODUCTION_SITE_BIND_ADDRESS)"
[[ -n "$site_bind" && "$site_bind" != "0.0.0.0" ]] || site_bind="127.0.0.1"
site_port="$(pd_site_port)"
site_health_url="http://${site_bind}:${site_port}/health/ready"

wait_ready() {
  local label="$1" url="$2"
  while ! curl -kfsS --connect-timeout 3 --max-time 10 "$url" 2>/dev/null | grep -q '"ok":true'; do
    (( SECONDS < deadline )) || pd_die "$label did not become ready: $url"
    sleep 2
  done
  pd_log "$label is ready."
}

wait_ready "Admin HTTPS API" "$admin_health_url"
wait_ready "Official site runtime" "$site_health_url"

auth_status="$(curl -kfsS --connect-timeout 5 --max-time 15 "$admin_status_url")" \
  || pd_die "Could not read administrator initialization status."
if grep -q '"initialized":true' <<<"$auth_status"; then
  admin_state="initialized"
else
  admin_state="setup-required"
  (( REQUIRE_INITIALIZED == 0 )) || pd_die "The first enterprise administrator has not been created."
fi

public_base="$(pd_site_url)"
[[ "$public_base" == http://* || "$public_base" == https://* ]] \
  || pd_die "Canonical website URL is invalid in deployment environment."
public_base="${public_base%/}"
for endpoint in / /robots.txt /sitemap.xml /llms.txt; do
  code="$(curl -kLsS --connect-timeout 8 --max-time 30 -o /dev/null -w '%{http_code}' "${public_base}${endpoint}" || true)"
  [[ "$code" == "200" ]] || pd_die "Public website acceptance failed for ${public_base}${endpoint} (HTTP ${code:-unreachable})."
done

pd_compose "$CURRENT" ps
pd_log "Acceptance passed: TLS admin, database readiness, website, robots, sitemap, and llms.txt."
printf 'release=%s\nadmin_state=%s\nadmin_url=https://127.0.0.1:%s/\nsite_url=%s\n' \
  "$(basename "$CURRENT")" "$admin_state" "$admin_port" "$public_base"
