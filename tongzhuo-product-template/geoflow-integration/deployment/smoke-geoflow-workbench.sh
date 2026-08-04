#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash smoke-geoflow-workbench.sh --base-url https://example.com [--admin-path geo_admin]

This smoke test checks public AI-friendly endpoints and protected admin entry points after
Tongzhuo GEOFlow deployment. It does not log in, mutate data, create channels, or publish content.
Admin URLs may return 200, 301, or 302 depending on authentication state.
USAGE
}

BASE_URL=""
ADMIN_PATH="geo_admin"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --admin-path)
      ADMIN_PATH="${2:-}"
      shift 2
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

if [[ -z "$BASE_URL" ]]; then
  echo "--base-url is required." >&2
  usage >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl command not found." >&2
  exit 1
fi

base="${BASE_URL%/}"
failed=0

check_url() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local status
  status="$(curl -L -s -o /dev/null -w '%{http_code}' "$url" || true)"
  case "$expected" in
    public)
      if [[ "$status" != "200" ]]; then
        echo "FAIL public $label: $url returned HTTP $status" >&2
        failed=$((failed + 1))
      else
        echo "PASS public $label: HTTP $status"
      fi
      ;;
    admin)
      if [[ "$status" != "200" && "$status" != "301" && "$status" != "302" ]]; then
        echo "FAIL admin $label: $url returned HTTP $status" >&2
        failed=$((failed + 1))
      else
        echo "PASS admin $label: HTTP $status"
      fi
      ;;
    *)
      echo "Unknown expectation: $expected" >&2
      exit 2
      ;;
  esac
}

echo "Tongzhuo GEOFlow smoke test"
echo "Base URL: $base"
echo "Admin path: $ADMIN_PATH"
echo

check_url "home" "$base/" public
check_url "llms.txt" "$base/llms.txt" public
check_url "sitemap.xml" "$base/sitemap.xml" public
check_url "feed.xml" "$base/feed.xml" public
check_url "admin entry" "$base/$ADMIN_PATH" admin
check_url "CMS" "$base/$ADMIN_PATH/tongzhuo-cms" admin
check_url "GEO growth" "$base/$ADMIN_PATH/geo-growth" admin
check_url "GEO opportunities" "$base/$ADMIN_PATH/geo-opportunities" admin
check_url "GEO plans" "$base/$ADMIN_PATH/geo-plans" admin
check_url "AI answer tests" "$base/$ADMIN_PATH/geo-answer-tests" admin
check_url "publisher assistant" "$base/$ADMIN_PATH/publisher-assistant" admin
check_url "publisher devices" "$base/$ADMIN_PATH/publisher-devices" admin
check_url "distribution" "$base/$ADMIN_PATH/distribution" admin
check_url "contact leads" "$base/$ADMIN_PATH/contact-leads" admin
check_url "customer projects" "$base/$ADMIN_PATH/customer-projects" admin

echo
echo "Manual acceptance checklist after login:"
echo "  [ ] Open dashboard and confirm left navigation groups render correctly."
echo "  [ ] Open CMS dashboard, edit one page draft field, and save without PHP/Laravel errors."
echo "  [ ] Open FAQ manager and confirm categories/items can be listed."
echo "  [ ] Open GEO growth workspace and confirm closed-loop cards are visible."
echo "  [ ] Run one safe public URL GEO audit and confirm tasks are generated."
echo "  [ ] Create one customer project or current-site dossier."
echo "  [ ] Open customer project detail and save delivery checklist, acceptance evidence, and operations record."
echo "  [ ] Open customer handoff report and use browser print/Save as PDF."
echo "  [ ] Open publisher assistant and confirm channel/device status pages render."
echo "  [ ] Confirm no public website page displays service prices unless intentionally configured."

if [[ "$failed" -gt 0 ]]; then
  echo
  echo "Tongzhuo GEOFlow smoke test failed: failed_checks=$failed" >&2
  exit 1
fi

echo
echo "Tongzhuo GEOFlow smoke test passed."
