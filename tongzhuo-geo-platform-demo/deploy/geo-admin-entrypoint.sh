#!/bin/sh
set -eu

# Production Compose starts this entrypoint as root only long enough to copy
# file-backed Docker secrets into a container-local tmpfs.  The application
# itself always runs as the unprivileged node user.
if [ "$(id -u)" -ne 0 ]; then
  exec "$@"
fi

RUNTIME_SECRET_DIR=/run/tongzhuo-runtime-secrets
mkdir -p "$RUNTIME_SECRET_DIR"
chown root:node "$RUNTIME_SECRET_DIR"
chmod 0710 "$RUNTIME_SECRET_DIR"

stage_secret() {
  source_path="$1"
  destination="$2"
  variable_name="$3"

  if [ ! -f "$source_path" ] || [ -L "$source_path" ]; then
    echo "Required Compose secret source is missing or unsafe: $source_path" >&2
    exit 1
  fi

  if grep -q '[^[:space:]]' "$source_path"; then
    has_value=1
  else
    grep_status=$?
    if [ "$grep_status" -ne 1 ]; then
      echo "Required Compose secret source cannot be read: $source_path" >&2
      exit 1
    fi
    has_value=0
  fi

  if [ "$has_value" -eq 0 ]; then
    rm -f "$destination"
    unset "$variable_name" || true
    return 0
  fi

  umask 077
  cat "$source_path" > "$destination"
  chown node:node "$destination"
  chmod 0400 "$destination"
  export "$variable_name=$destination"
}

stage_secret /run/secrets/tz_relay_client_secret \
  "$RUNTIME_SECRET_DIR/tz_relay_client_secret" \
  TZ_RELAY_CLIENT_SECRET_FILE
stage_secret /run/secrets/tz_ad_hoc_diagnostic_api_token \
  "$RUNTIME_SECRET_DIR/tz_ad_hoc_diagnostic_api_token" \
  TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_FILE

if [ "${TZ_GEO_ADMIN_MAINTENANCE_ROOT:-}" = "1" ]; then
  exec "$@"
fi

exec su-exec node:node "$@"
