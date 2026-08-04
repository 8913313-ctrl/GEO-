#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash install-geoflow-overrides.sh --laravel-root /www/wwwroot/geoflow [--package-root /tmp/tongzhuo-geoflow-overrides] [--skip-migrate] [--dry-run]

This script installs Tongzhuo GEOFlow server overrides into an existing Laravel GEOFlow project.
It creates a timestamped backup for every file that will be overwritten, runs PHP syntax checks
when PHP is available, copies the override files, runs migrations, and clears Laravel caches.

Use --dry-run first on a customer server to validate paths, PHP syntax, write access, and the
planned overwrite list without copying files, running migrations, or clearing caches.
USAGE
}

LARAVEL_ROOT=""
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_MIGRATE="0"
DRY_RUN="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --laravel-root)
      LARAVEL_ROOT="${2:-}"
      shift 2
      ;;
    --package-root)
      PACKAGE_ROOT="${2:-}"
      shift 2
      ;;
    --skip-migrate)
      SKIP_MIGRATE="1"
      shift
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$LARAVEL_ROOT" ]]; then
  echo "--laravel-root is required." >&2
  usage >&2
  exit 2
fi

LARAVEL_ROOT="$(cd "$LARAVEL_ROOT" && pwd)"
PACKAGE_ROOT="$(cd "$PACKAGE_ROOT" && pwd)"
OVERRIDES_ROOT="$PACKAGE_ROOT/server-overrides"

if [[ ! -d "$OVERRIDES_ROOT" ]]; then
  echo "server-overrides not found under: $PACKAGE_ROOT" >&2
  exit 1
fi

if [[ ! -f "$LARAVEL_ROOT/artisan" ]]; then
  echo "Laravel artisan not found under: $LARAVEL_ROOT" >&2
  exit 1
fi

if [[ ! -w "$LARAVEL_ROOT" ]]; then
  echo "Laravel root is not writable by current user: $LARAVEL_ROOT" >&2
  exit 1
fi

if [[ ! -d "$LARAVEL_ROOT/storage/app" ]]; then
  echo "Laravel storage/app directory not found under: $LARAVEL_ROOT" >&2
  exit 1
fi

if [[ ! -w "$LARAVEL_ROOT/storage/app" ]]; then
  echo "Laravel storage/app is not writable by current user: $LARAVEL_ROOT/storage/app" >&2
  exit 1
fi

cd "$LARAVEL_ROOT"

php_available="0"

if command -v php >/dev/null 2>&1; then
  php_available="1"
  while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null
  done < <(find "$OVERRIDES_ROOT" -type f -name '*.php' -print0)
else
  echo "Warning: php command not found; skipping PHP syntax checks." >&2
fi

if [[ "$DRY_RUN" == "1" ]]; then
  total_files="$(find "$OVERRIDES_ROOT" -type f | wc -l | tr -d ' ')"
  php_files="$(find "$OVERRIDES_ROOT" -type f -name '*.php' | wc -l | tr -d ' ')"
  overwrite_files="0"
  new_files="0"

  while IFS= read -r -d '' source_file; do
    relative_path="${source_file#$OVERRIDES_ROOT/}"
    target_file="$LARAVEL_ROOT/$relative_path"
    if [[ -f "$target_file" ]]; then
      overwrite_files=$((overwrite_files + 1))
    else
      new_files=$((new_files + 1))
    fi
  done < <(find "$OVERRIDES_ROOT" -type f -print0)

  echo "Tongzhuo GEOFlow overrides dry run passed."
  echo "Laravel root: $LARAVEL_ROOT"
  echo "Package root: $PACKAGE_ROOT"
  echo "Override files: $total_files"
  echo "PHP files checked: $php_files"
  echo "Existing files to back up and overwrite: $overwrite_files"
  echo "New files to copy: $new_files"
  echo "PHP available: $php_available"
  if [[ "$SKIP_MIGRATE" == "1" ]]; then
    echo "Migration command: skipped"
  else
    echo "Migration command: php artisan migrate --force"
  fi
  echo "Cache commands: php artisan optimize:clear; php artisan route:clear; php artisan view:clear"
  echo "No files were copied and no artisan command was executed."
  exit 0
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$LARAVEL_ROOT/storage/app/tongzhuo-backups/geoflow-overrides-$STAMP"
mkdir -p "$BACKUP_DIR"

while IFS= read -r -d '' source_file; do
  relative_path="${source_file#$OVERRIDES_ROOT/}"
  target_file="$LARAVEL_ROOT/$relative_path"
  if [[ -f "$target_file" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$relative_path")"
    cp -a "$target_file" "$BACKUP_DIR/$relative_path"
  fi
done < <(find "$OVERRIDES_ROOT" -type f -print0)

cp -a "$OVERRIDES_ROOT"/. "$LARAVEL_ROOT"/

if command -v php >/dev/null 2>&1; then
  if [[ "$SKIP_MIGRATE" != "1" ]]; then
    php artisan migrate --force
  fi
  php artisan optimize:clear
  php artisan route:clear || true
  php artisan view:clear || true
fi

echo "Tongzhuo GEOFlow overrides installed."
echo "Backup directory: $BACKUP_DIR"
