#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INSTALL_ROOT="${TZ_INSTALL_ROOT:-$PD_DEFAULT_INSTALL_ROOT}"

usage() {
  cat <<'EOF'
Usage: manage.sh [--install-root PATH] <command> [arguments]

Commands:
  status                         Show release and container state
  verify [--timeout SECONDS]     Run deployment acceptance checks
  start                          Start/reconcile containers, then verify
  stop                           Stop containers without deleting data
  restart                        Recreate containers, then verify
  logs [SERVICE] [--tail N] [-f] Show redacted application/container logs
  backup [LABEL]                 Create and copy a complete host backup
  restore BACKUP --yes           Safety-backup, restore, start, and verify
  init-admin                     Show first-administrator HTTPS entry/status
  upgrade PACKAGE --yes          Apply a verified release package
  rollback --yes                 Return to previous code; preserve current data
  config-check                   Validate Compose and immutable release links

Services accepted by logs: geo-admin, geo-admin-tls, geo-site, or all.
No command deletes the Docker data volume, release, or backup history.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) [[ $# -ge 2 ]] || pd_die "--install-root requires a value"; INSTALL_ROOT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) break ;;
  esac
done

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { usage; exit 1; }
shift

pd_init_paths
CURRENT="$(pd_current_release)" || pd_die "No active private deployment exists beneath $INSTALL_ROOT."
pd_link_shared_config "$CURRENT"

verify_timeout=180

case "$COMMAND" in
  status)
    [[ $# -eq 0 ]] || pd_die "status does not accept arguments"
    printf 'install_root=%s\ncurrent_release=%s\n' "$INSTALL_ROOT" "$(basename "$CURRENT")"
    if previous="$(pd_previous_release 2>/dev/null)"; then
      printf 'previous_release=%s\n' "$(basename "$previous")"
    else
      printf 'previous_release=none\n'
    fi
    pd_compose "$CURRENT" ps
    ;;

  verify)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --timeout) [[ $# -ge 2 ]] || pd_die "--timeout requires a value"; verify_timeout="$2"; shift 2 ;;
        *) pd_die "Unknown verify option: $1" ;;
      esac
    done
    pd_verify_release "$CURRENT" "$verify_timeout"
    ;;

  config-check)
    [[ $# -eq 0 ]] || pd_die "config-check does not accept arguments"
    pd_assert_release_script_set "$CURRENT"
    pd_compose "$CURRENT" config >/dev/null
    pd_log "Configuration and release links are valid."
    ;;

  start)
    [[ $# -eq 0 ]] || pd_die "start does not accept arguments"
    pd_ensure_layout
    pd_acquire_lock
    pd_write_installed_release "$CURRENT"
    pd_up_release "$CURRENT"
    pd_verify_release "$CURRENT" 240
    ;;

  stop)
    [[ $# -eq 0 ]] || pd_die "stop does not accept arguments"
    pd_ensure_layout
    pd_acquire_lock
    pd_stop_release "$CURRENT"
    pd_log "Containers stopped. Named data volume and backups were preserved."
    ;;

  restart)
    [[ $# -eq 0 ]] || pd_die "restart does not accept arguments"
    pd_ensure_layout
    pd_acquire_lock
    pd_write_installed_release "$CURRENT"
    pd_compose "$CURRENT" up -d --force-recreate --remove-orphans
    pd_verify_release "$CURRENT" 240
    ;;

  logs)
    service="all"
    tail_lines=200
    follow=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -f|--follow) follow=1; shift ;;
        --tail) [[ $# -ge 2 ]] || pd_die "--tail requires a value"; tail_lines="$2"; shift 2 ;;
        geo-admin|geo-admin-tls|geo-site|all) service="$1"; shift ;;
        *) pd_die "Unknown logs argument: $1" ;;
      esac
    done
    [[ "$tail_lines" =~ ^[0-9]+$ ]] && (( tail_lines >= 1 && tail_lines <= 100000 )) \
      || pd_die "--tail must be between 1 and 100000"
    log_args=(logs --tail "$tail_lines")
    (( follow )) && log_args+=(--follow)
    if [[ "$service" != "all" ]]; then log_args+=("$service"); fi
    pd_compose "$CURRENT" "${log_args[@]}"
    ;;

  backup)
    [[ $# -le 1 ]] || pd_die "backup accepts at most one label"
    label="${1:-manual}"
    pd_ensure_layout
    pd_acquire_lock
    backup_path="$(pd_backup_release "$CURRENT" "$label")"
    printf 'backup=%s\n' "$backup_path"
    ;;

  restore)
    backup_input="${1:-}"
    [[ -n "$backup_input" ]] || pd_die "restore requires a backup directory"
    shift
    confirm=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --yes) confirm=1; shift ;;
        *) pd_die "Unknown restore option: $1" ;;
      esac
    done
    (( confirm )) || pd_die "Restore changes production data. Re-run with --yes after confirming the customer and backup timestamp."
    restore_source="$(pd_validate_backup_dir "$backup_input")"
    pd_ensure_layout
    pd_acquire_lock
    safety_backup="$(pd_backup_release "$CURRENT" pre-restore)"
    pd_log "Safety backup completed: $safety_backup"
    pd_stop_release "$CURRENT"
    restore_ok=0
    if pd_restore_release "$CURRENT" "$restore_source" \
        && pd_up_release "$CURRENT" \
        && pd_verify_release "$CURRENT" 240; then
      restore_ok=1
    fi
    if (( restore_ok )); then
      pd_log "Restore completed and passed acceptance checks."
      printf 'safety_backup=%s\n' "$safety_backup"
    else
      pd_warn "Restore or acceptance failed. Restoring the automatic safety backup."
      pd_stop_release "$CURRENT" || true
      pd_restore_release "$CURRENT" "$safety_backup" \
        || pd_die "Automatic recovery failed. Services remain stopped; preserve $safety_backup and inspect logs before any further change."
      pd_up_release "$CURRENT" \
        && pd_verify_release "$CURRENT" 240 \
        || pd_die "Original data was restored but service recovery still failed. Inspect manage.sh logs."
      pd_die "Requested restore failed; the original pre-restore state has been recovered."
    fi
    ;;

  init-admin)
    [[ $# -eq 0 ]] || pd_die "init-admin does not accept arguments"
    port="$(pd_admin_port)"
    response="$(curl -kfsS --connect-timeout 5 --max-time 15 "https://127.0.0.1:${port}/api/v1/auth/status")" \
      || pd_die "Admin HTTPS service is not ready. Run manage.sh status and manage.sh logs geo-admin."
    if grep -q '"initialized":true' <<<"$response"; then
      pd_log "The enterprise administrator already exists; use the HTTPS entry to log in."
    else
      pd_log "The deployment is empty and ready for one-time enterprise administrator creation."
    fi
    pd_print_admin_instructions
    ;;

  upgrade)
    package="${1:-}"
    [[ -n "$package" ]] || pd_die "upgrade requires a package directory or archive"
    shift
    exec bash "$CURRENT/deploy/private-delivery/upgrade.sh" apply "$package" --install-root "$INSTALL_ROOT" "$@"
    ;;

  rollback)
    exec bash "$CURRENT/deploy/private-delivery/upgrade.sh" rollback --install-root "$INSTALL_ROOT" "$@"
    ;;

  *)
    usage
    pd_die "Unknown command: $COMMAND"
    ;;
esac
