#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INSTALL_ROOT="${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}"
ACTION="${1:-}"
[[ -n "$ACTION" ]] || ACTION="help"
shift || true
PACKAGE_INPUT=""
CONFIRM=0
TIMEOUT=300
RELEASE_ID_REQUESTED="${TZ_RELEASE_ID:-}"
RESTORE_ROLLBACK_DATA=0
PREBUILD_RELEASE=""
PREBUILD_PROJECT=""

usage() {
  cat <<'EOF'
Usage:
  upgrade.sh apply <bundle-directory|archive> [--install-root PATH] --yes
  upgrade.sh rollback [--install-root PATH] [--restore-pre-upgrade-data] --yes

Apply verifies package checksums, creates a complete pre-upgrade backup, then
prebuilds candidate images under an isolated Compose project while the current
release remains online. It atomically switches the release and runs acceptance
checks. A failed start or check automatically switches back and restores the
pre-upgrade backup.

Rollback is code-only by default so a later rollback cannot silently discard
new business data. Add --restore-pre-upgrade-data only for an incompatible
database migration after explicitly accepting that post-upgrade writes will
be replaced. A verified current-state safety backup is required before either
rollback mode can stop services or start older code against production data.
Releases, backups, and the named data volume are never deleted.
EOF
}

if [[ "$ACTION" == "apply" ]]; then
  PACKAGE_INPUT="${1:-}"
  [[ -n "$PACKAGE_INPUT" ]] || pd_die "apply requires a bundle directory or archive"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) [[ $# -ge 2 ]] || pd_die "--install-root requires a value"; INSTALL_ROOT="$2"; shift 2 ;;
    --release-id) [[ $# -ge 2 ]] || pd_die "--release-id requires a value"; RELEASE_ID_REQUESTED="$2"; shift 2 ;;
    --timeout) [[ $# -ge 2 ]] || pd_die "--timeout requires a value"; TIMEOUT="$2"; shift 2 ;;
    --restore-pre-upgrade-data) RESTORE_ROLLBACK_DATA=1; shift ;;
    --yes) CONFIRM=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) pd_die "Unknown option: $1" ;;
  esac
done

case "$ACTION" in
  apply|rollback) ;;
  help|-h|--help) usage; exit 0 ;;
  *) usage; pd_die "Unknown upgrade action: $ACTION" ;;
esac
if [[ "$ACTION" != "rollback" && "$RESTORE_ROLLBACK_DATA" -eq 1 ]]; then
  pd_die "--restore-pre-upgrade-data is valid only with rollback."
fi
(( CONFIRM )) || pd_die "$ACTION changes the active production release. Re-run with --yes after confirming the maintenance window and customer."
[[ "$TIMEOUT" =~ ^[0-9]+$ ]] && (( TIMEOUT >= 30 && TIMEOUT <= 1800 )) \
  || pd_die "--timeout must be between 30 and 1800 seconds"

pd_init_paths
pd_ensure_layout
pd_acquire_lock
CURRENT="$(pd_current_release)" || pd_die "No active deployment exists beneath $INSTALL_ROOT. Run install.sh first."
pd_link_shared_config "$CURRENT"

write_upgrade_metadata() {
  local release_id="$1" previous="$2" backup="$3" metadata
  metadata="$STATE_DIR/upgrades/$release_id"
  mkdir -p "$metadata"
  printf '%s\n' "$previous" > "$metadata/previous-release"
  printf '%s\n' "$backup" > "$metadata/pre-upgrade-backup"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$metadata/created-at"
  chmod -R go-rwx "$metadata" 2>/dev/null || true
}

recover_release() {
  local failed_release="$1" previous_release="$2" backup="$3" reason="$4"
  pd_warn "$reason Automatic rollback is starting."
  pd_stop_release "$failed_release" || true
  pd_atomic_symlink "$previous_release" "$CURRENT_LINK"
  pd_write_installed_release "$previous_release"
  pd_link_shared_config "$previous_release"
  pd_log "Rebuilding the previous application image before restoring its compatible backup."
  pd_compose "$previous_release" build geo-admin geo-site || return 1
  pd_restore_release "$previous_release" "$backup" || return 1
  pd_up_release "$previous_release" || return 1
  pd_verify_release "$previous_release" "$TIMEOUT" || return 1
  pd_log "Automatic rollback completed; the previous release and data are active."
}

if [[ "$ACTION" == "apply" ]]; then
  cleanup_apply() {
    local status=$?
    pd_cleanup_package_input
    if [[ -n "$PREBUILD_RELEASE" && -n "$PREBUILD_PROJECT" ]]; then
      pd_cleanup_prebuild_release "$PREBUILD_RELEASE" "$PREBUILD_PROJECT"
    fi
    return "$status"
  }
  trap cleanup_apply EXIT
  pd_prepare_package_input "$PACKAGE_INPUT"
  if [[ -d "$PD_PACKAGE_ROOT/migration" ]]; then
    pd_die "Upgrade packages must not apply customer migration payloads. Use a blank code package; migration is accepted only by a fresh install with --apply-migration."
  fi
  bash "$SCRIPT_DIR/preflight.sh" --install-root "$INSTALL_ROOT" --source "$PD_PACKAGE_APP"

  BUNDLE_ROOT="$PD_PACKAGE_ROOT"
  [[ -f "$BUNDLE_ROOT/manifest.json" && -f "$BUNDLE_ROOT/SHA256SUMS" ]] \
    || pd_die "Upgrade requires a complete private-delivery bundle with manifest.json and SHA256SUMS."
  PACKAGE_FINGERPRINT="$(sha256sum "$BUNDLE_ROOT/manifest.json" | awk '{print $1}')"
  NEW_RELEASE_ID="$(pd_release_id "$PD_PACKAGE_APP" "$BUNDLE_ROOT" "$RELEASE_ID_REQUESTED")"
  NEW_RELEASE="$RELEASES_DIR/$NEW_RELEASE_ID"
  if [[ "$NEW_RELEASE" == "$CURRENT" ]]; then
    pd_assert_release_fingerprint "$CURRENT" "$PACKAGE_FINGERPRINT"
    pd_log "Release $NEW_RELEASE_ID is already active; reconciling containers and re-running acceptance."
    pd_write_installed_release "$CURRENT"
    pd_up_release "$CURRENT"
    pd_verify_release "$CURRENT" "$TIMEOUT"
    exit 0
  fi

  pd_verify_release "$CURRENT" "$TIMEOUT"
  pd_copy_release "$PD_PACKAGE_APP" "$NEW_RELEASE" "$PACKAGE_FINGERPRINT"
  pd_assert_release_script_set "$NEW_RELEASE"
  pd_link_shared_config "$NEW_RELEASE"
  pd_compose "$NEW_RELEASE" config >/dev/null || pd_die "New release Compose configuration is invalid."

  # Capture the current release before any candidate image is built. This
  # guarantees that backup tooling comes from the accepted running release,
  # not from an incoming image that happens to share the production tag.
  PRE_UPGRADE_BACKUP="$(pd_backup_release "$CURRENT" "pre-upgrade-${NEW_RELEASE_ID}")"
  PREBUILD_RELEASE="$NEW_RELEASE"
  PREBUILD_PROJECT="$(pd_prebuild_project_name "$NEW_RELEASE")"
  pd_prebuild_release "$NEW_RELEASE" "$PREBUILD_PROJECT"
  write_upgrade_metadata "$NEW_RELEASE_ID" "$CURRENT" "$PRE_UPGRADE_BACKUP"
  pd_atomic_symlink "$CURRENT" "$PREVIOUS_LINK"
  pd_atomic_symlink "$NEW_RELEASE" "$CURRENT_LINK"
  pd_write_installed_release "$NEW_RELEASE"

  apply_ok=0
  if pd_up_release "$NEW_RELEASE" && pd_verify_release "$NEW_RELEASE" "$TIMEOUT"; then
    apply_ok=1
  fi
  if (( ! apply_ok )); then
    if recover_release "$NEW_RELEASE" "$CURRENT" "$PRE_UPGRADE_BACKUP" "The new release failed startup or acceptance."; then
      pd_die "Upgrade failed; automatic rollback succeeded. Review the new release logs before retrying."
    fi
    pd_die "Upgrade and automatic rollback both failed. Services may be stopped; preserve $PRE_UPGRADE_BACKUP and perform supervised recovery."
  fi

  pd_log "Upgrade completed and passed acceptance: $NEW_RELEASE_ID"
  printf 'release=%s\nprevious_release=%s\npre_upgrade_backup=%s\n' \
    "$NEW_RELEASE_ID" "$(basename "$CURRENT")" "$PRE_UPGRADE_BACKUP"
  exit 0
fi

# Explicit rollback path.
PREVIOUS="$(pd_previous_release)" || pd_die "No previous release is recorded."
CURRENT_ID="$(basename "$CURRENT")"
metadata="$STATE_DIR/upgrades/$CURRENT_ID"
[[ -f "$metadata/previous-release" && -f "$metadata/pre-upgrade-backup" ]] \
  || pd_die "Rollback metadata for $CURRENT_ID is incomplete; no safe data downgrade can be inferred."
RECORDED_PREVIOUS="$(<"$metadata/previous-release")"
RECORDED_BACKUP="$(<"$metadata/pre-upgrade-backup")"
[[ "$(readlink -f "$RECORDED_PREVIOUS")" == "$PREVIOUS" ]] \
  || pd_die "Previous-release symlink does not match the recorded upgrade transaction."
if (( RESTORE_ROLLBACK_DATA )); then
  RECORDED_BACKUP="$(pd_validate_backup_dir "$RECORDED_BACKUP")"
  pd_warn "Rollback will replace all post-upgrade production data with the recorded pre-upgrade backup."
fi

SAFETY_BACKUP=""
if SAFETY_BACKUP="$(pd_backup_release "$CURRENT" "pre-rollback-${CURRENT_ID}")"; then
  pd_log "Current-state safety backup completed: $SAFETY_BACKUP"
else
  pd_die "Current-state safety backup failed. Rollback was cancelled before services stopped, release links changed, or production data was touched."
fi

pd_stop_release "$CURRENT" || true
pd_atomic_symlink "$PREVIOUS" "$CURRENT_LINK"
pd_write_installed_release "$PREVIOUS"
pd_link_shared_config "$PREVIOUS"
rollback_ok=0
if pd_compose "$PREVIOUS" build geo-admin geo-site; then
  if (( RESTORE_ROLLBACK_DATA )); then
    if pd_restore_release "$PREVIOUS" "$RECORDED_BACKUP" \
        && pd_up_release "$PREVIOUS" \
        && pd_verify_release "$PREVIOUS" "$TIMEOUT"; then
      rollback_ok=1
    fi
  elif pd_up_release "$PREVIOUS" && pd_verify_release "$PREVIOUS" "$TIMEOUT"; then
    rollback_ok=1
  fi
fi

if (( ! rollback_ok )); then
  pd_warn "Rollback failed. Attempting to recover the release that was active when rollback began."
  pd_stop_release "$PREVIOUS" || true
  pd_atomic_symlink "$CURRENT" "$CURRENT_LINK"
  pd_write_installed_release "$CURRENT"
  pd_link_shared_config "$CURRENT"
  pd_compose "$CURRENT" build geo-admin geo-site || true
  # Even a nominally code-only rollback may let incompatible old code touch
  # the current schema before acceptance fails. Recover the exact snapshot
  # taken immediately before every manual rollback mode.
  pd_restore_release "$CURRENT" "$SAFETY_BACKUP" \
    || pd_die "Rollback failed and the current-state safety backup could not be restored. Services remain stopped; preserve both backups for supervised recovery."
  pd_up_release "$CURRENT" && pd_verify_release "$CURRENT" "$TIMEOUT" \
    || pd_die "Rollback and recovery failed. Preserve both backups and perform supervised recovery."
  pd_die "Rollback failed; the release and data active before rollback were recovered."
fi

pd_atomic_symlink "$CURRENT" "$PREVIOUS_LINK"
pd_write_installed_release "$PREVIOUS"
if (( RESTORE_ROLLBACK_DATA )); then
  pd_log "Rollback completed and restored the recorded pre-upgrade data snapshot."
  restored_label="$RECORDED_BACKUP"
else
  pd_log "Code rollback completed; current production data was preserved."
  restored_label="not-restored"
fi
printf 'release=%s\nrolled_back_from=%s\nrestored_backup=%s\nsafety_backup=%s\n' \
  "$(basename "$PREVIOUS")" "$CURRENT_ID" "$restored_label" "${SAFETY_BACKUP:-unavailable}"
