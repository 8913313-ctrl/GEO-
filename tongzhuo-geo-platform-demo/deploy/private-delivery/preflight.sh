#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INSTALL_ROOT="${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}"
SOURCE_ROOT=""
SITE_SOURCE=""
CHECK_PORTS=0
SITE_PORT=18080
ADMIN_PORT=18183

usage() {
  cat <<'EOF'
Usage: preflight.sh [options]

Checks the Linux host without installing packages or changing the running
system.

Options:
  --install-root PATH  Installation root (default: /opt/tongzhuo-geo)
  --source PATH        Application source root to validate
  --site-source PATH   Static website directory to validate
  --check-ports        Require website/admin ports to be unused
  --site-port PORT     Website host port checked with --check-ports (18080)
  --admin-port PORT    Admin HTTPS host port checked with --check-ports (18183)
  -h, --help           Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) [[ $# -ge 2 ]] || pd_die "--install-root requires a value"; INSTALL_ROOT="$2"; shift 2 ;;
    --source) [[ $# -ge 2 ]] || pd_die "--source requires a value"; SOURCE_ROOT="$2"; shift 2 ;;
    --site-source) [[ $# -ge 2 ]] || pd_die "--site-source requires a value"; SITE_SOURCE="$2"; shift 2 ;;
    --check-ports) CHECK_PORTS=1; shift ;;
    --site-port) [[ $# -ge 2 ]] || pd_die "--site-port requires a value"; SITE_PORT="$2"; shift 2 ;;
    --admin-port) [[ $# -ge 2 ]] || pd_die "--admin-port requires a value"; ADMIN_PORT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) pd_die "Unknown option: $1" ;;
  esac
done

pd_init_paths

[[ "$(uname -s)" == "Linux" ]] || pd_die "Private delivery scripts support Linux hosts only."
case "$(uname -m)" in
  x86_64|amd64|aarch64|arm64) ;;
  *) pd_warn "Host architecture $(uname -m) has not been acceptance-tested." ;;
esac

for command_name in docker curl openssl tar sha256sum awk sed grep find df stat readlink flock cmp; do
  pd_require_command "$command_name"
done

docker info >/dev/null 2>&1 || pd_die "Docker Engine is unavailable to the current user. Start Docker or run with the approved service account."
docker compose version >/dev/null 2>&1 || pd_die "Docker Compose v2 is required (the 'docker compose' command)."

if [[ -z "$SOURCE_ROOT" ]]; then
  SOURCE_ROOT="$(pd_discover_local_app "$SCRIPT_DIR")"
else
  SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"
fi
pd_validate_app_source "$SOURCE_ROOT"

while IFS= read -r link_path; do
  resolved="$(readlink -f "$link_path" || true)"
  if [[ -f "$APP_ENV" && "$link_path" == "$SOURCE_ROOT/.env" && "$resolved" == "$(readlink -f "$APP_ENV")" ]]; then
    continue
  fi
  case "$resolved" in
    "$SOURCE_ROOT"/*) ;;
    *) pd_die "Application source contains a symlink outside its root: $link_path" ;;
  esac
done < <(find "$SOURCE_ROOT" -path "$SOURCE_ROOT/node_modules" -prune -o -type l -print)

if [[ -n "$SITE_SOURCE" ]]; then
  SITE_SOURCE="$(cd "$SITE_SOURCE" && pwd -P)"
  [[ -f "$SITE_SOURCE/index.html" ]] || pd_die "Website source must contain index.html: $SITE_SOURCE"
  if find "$SITE_SOURCE" -type l -print -quit | grep -q .; then
    pd_die "Website source must not contain symbolic links."
  fi
fi

ancestor="$INSTALL_ROOT"
while [[ ! -e "$ancestor" ]]; do ancestor="$(dirname "$ancestor")"; done
[[ -d "$ancestor" ]] || pd_die "Install-root ancestor is not a directory: $ancestor"
[[ -w "$ancestor" ]] || pd_die "Current user cannot write beneath $ancestor. Use the approved installation service account."

available_kb="$(df -Pk "$ancestor" | awk 'NR==2 {print $4}')"
[[ "$available_kb" =~ ^[0-9]+$ ]] || pd_die "Could not determine free disk space."
if (( available_kb < PD_MIN_FREE_KB )); then
  pd_die "At least $((PD_MIN_FREE_KB / 1024)) MiB free disk space is required; only $((available_kb / 1024)) MiB is available."
fi

validate_port() {
  local value="$1" label="$2"
  [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= 65535 )) \
    || pd_die "$label port is invalid: $value"
}
validate_port "$SITE_PORT" "Website"
validate_port "$ADMIN_PORT" "Admin"

if (( CHECK_PORTS )); then
  if command -v ss >/dev/null 2>&1; then
    if ss -H -ltn | awk '{print $4}' | grep -Eq "(^|:)$SITE_PORT$"; then
      pd_die "Website port $SITE_PORT is already in use."
    fi
    if ss -H -ltn | awk '{print $4}' | grep -Eq "(^|:)$ADMIN_PORT$"; then
      pd_die "Admin HTTPS port $ADMIN_PORT is already in use."
    fi
  else
    pd_warn "The 'ss' command is unavailable; listener port conflicts were not checked."
  fi
fi

if [[ -f "$CUTOVER_ENV" && -L "$CURRENT_LINK" ]]; then
  current="$(pd_current_release)"
  pd_link_shared_config "$current"
  pd_compose "$current" config >/dev/null \
    || pd_die "Installed Docker Compose configuration is invalid."
fi

pd_log "Preflight passed: Docker, Compose, release files, permissions, and disk capacity are ready."
printf 'source=%s\ninstall_root=%s\nfree_mib=%s\n' "$SOURCE_ROOT" "$INSTALL_ROOT" "$((available_kb / 1024))"
