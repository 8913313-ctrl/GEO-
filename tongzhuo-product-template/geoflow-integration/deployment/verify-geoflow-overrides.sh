#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash verify-geoflow-overrides.sh --laravel-root /www/wwwroot/geoflow [--base-url https://example.com] [--admin-path geo_admin]

This script verifies that Tongzhuo GEOFlow server overrides are present after installation.
It checks required files, optional Laravel route registration, and optional public/admin URLs.
USAGE
}

LARAVEL_ROOT=""
BASE_URL=""
ADMIN_PATH="geo_admin"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --laravel-root)
      LARAVEL_ROOT="${2:-}"
      shift 2
      ;;
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

if [[ -z "$LARAVEL_ROOT" ]]; then
  echo "--laravel-root is required." >&2
  usage >&2
  exit 2
fi

LARAVEL_ROOT="$(cd "$LARAVEL_ROOT" && pwd)"

if [[ ! -f "$LARAVEL_ROOT/artisan" ]]; then
  echo "Laravel artisan not found under: $LARAVEL_ROOT" >&2
  exit 1
fi

cd "$LARAVEL_ROOT"

required_files=(
  "bootstrap/app.php"
  "config/publishing.php"
  "app/Console/Commands/ReconcilePublisherPlatformJobsCommand.php"
  "routes/publisher-assistant.php"
  "routes/publisher-device-sync.php"
  "routes/tongzhuo-access-api.php"
  "routes/tongzhuo-access-admin.php"
  "routes/tongzhuo-ai-api.php"
  "routes/tongzhuo-content-api.php"
  "routes/tongzhuo-rag-api.php"
  "routes/tongzhuo.php"
  "routes/tongzhuo-cms.php"
  "app/Http/Controllers/Admin/CustomerProjectController.php"
  "app/Http/Controllers/Admin/GeoGrowthController.php"
  "app/Http/Controllers/Admin/GeoOpportunityController.php"
  "app/Http/Controllers/Admin/GeoPlanController.php"
  "app/Http/Controllers/Admin/GeoAnswerTestController.php"
  "app/Http/Controllers/Admin/PublisherAssistantController.php"
  "app/Http/Controllers/Admin/PublisherDeviceController.php"
  "app/Http/Controllers/Admin/PublisherDeviceControlController.php"
  "app/Http/Controllers/Api/V1/PublisherAssistantController.php"
  "app/Http/Controllers/Api/V1/PublisherDeviceController.php"
  "app/Http/Controllers/Api/V1/PublisherDeviceShadowController.php"
  "app/Http/Controllers/Api/V1/PublisherDeviceEventController.php"
  "app/Http/Controllers/Api/V1/PublisherDeviceCommandController.php"
  "app/Http/Controllers/Api/V1/PublisherPlatformJobController.php"
  "app/Http/Controllers/Api/V1/ContentWorkflowController.php"
  "app/Http/Controllers/Api/V1/AiProviderController.php"
  "app/Http/Controllers/Api/Internal/KnowledgeDocumentController.php"
  "app/Http/Controllers/Api/Internal/RagController.php"
  "app/Http/Controllers/Admin/TongzhuoAccessController.php"
  "app/Http/Middleware/AuthenticateAccessApi.php"
  "app/Http/Middleware/AuditAccessApiRequest.php"
  "app/Http/Middleware/EnsureAccessScope.php"
  "app/Http/Middleware/EnsureAdminPermission.php"
  "app/Http/Middleware/EnforceAdminRbac.php"
  "app/Http/Middleware/EnsureSuperAdmin.php"
  "app/Models/TongzhuoCustomerProject.php"
  "app/Models/TongzhuoCmsSite.php"
  "app/Models/TongzhuoGeoOpportunity.php"
  "app/Models/TongzhuoGeoPlan.php"
  "app/Models/TongzhuoGeoAnswerTest.php"
  "app/Models/PublisherDevice.php"
  "app/Models/PublisherDeviceCommand.php"
  "app/Models/PublisherAccountGroup.php"
  "app/Models/PublisherAccountGroupItem.php"
  "app/Models/PublisherPlatform.php"
  "app/Models/PublisherPlatformJob.php"
  "app/Models/PublisherPlatformSession.php"
  "app/Models/TongzhuoContentBusinessLine.php"
  "app/Models/TongzhuoContentKeywordPack.php"
  "app/Models/TongzhuoContentManagedKeyword.php"
  "app/Models/TongzhuoContentQuestionLibraryItem.php"
  "app/Models/TongzhuoContentTopicCandidate.php"
  "app/Models/TongzhuoContentPlan.php"
  "app/Models/TongzhuoContentPlanItem.php"
  "app/Models/TongzhuoContentWritingAgent.php"
  "app/Models/TongzhuoContentGenerationRun.php"
  "app/Models/TongzhuoContentArticleCitation.php"
  "app/Models/TongzhuoContentArticleVersion.php"
  "app/Models/TongzhuoAccessRole.php"
  "app/Models/TongzhuoAccessPermission.php"
  "app/Models/TongzhuoAccessApiKey.php"
  "app/Models/AiProvider.php"
  "app/Models/AiGenerationRun.php"
  "app/Models/TongzhuoKnowledgeDocument.php"
  "app/Models/TongzhuoKnowledgeChunk.php"
  "app/Models/TongzhuoRagRun.php"
  "app/Models/TongzhuoRagCitation.php"
  "app/Services/Publishing/PublisherBatchSummaryService.php"
  "app/Services/Publishing/PublisherDeviceCredential.php"
  "app/Services/Publishing/PublisherPlatformCatalogService.php"
  "app/Services/Publishing/PublisherPlatformJobLifecycleService.php"
  "app/Services/Publishing/PublisherPreflightService.php"
  "app/Services/Publishing/PublisherSelectorHealthService.php"
  "app/Services/Publishing/PublishingCenterService.php"
  "app/Services/Access/AccessControlService.php"
  "app/Services/TongzhuoAi/AiModelGateway.php"
  "app/Services/Rag/KnowledgeChunker.php"
  "app/Services/Rag/KnowledgeIndexService.php"
  "app/Services/Rag/HybridKnowledgeRetriever.php"
  "app/Services/Rag/RagArticleGenerationService.php"
  "public/assets/styles.css"
  "public/assets/wukong-overrides.css"
  "public/assets/site.js"
  "public/assets/logo-mark-blue.png"
  "public/assets/logo-zhuojian-blue.png"
  "public/assets/short-video-production.jpg"
  "resources/views/admin/tongzhuo-cms/dashboard.blade.php"
  "resources/views/admin/tongzhuo-cms/pages/index.blade.php"
  "resources/views/admin/tongzhuo-cms/faqs/index.blade.php"
  "resources/views/admin/geo-growth/index.blade.php"
  "resources/views/admin/geo-opportunities/index.blade.php"
  "resources/views/admin/geo-plans/index.blade.php"
  "resources/views/admin/geo-answer-tests/index.blade.php"
  "resources/views/admin/customer-projects/index.blade.php"
  "resources/views/admin/customer-projects/show.blade.php"
  "resources/views/admin/customer-projects/handoff-report.blade.php"
  "resources/views/admin/publisher-assistant.blade.php"
  "resources/views/admin/publisher-devices/index.blade.php"
  "database/migrations/2026_07_20_000000_create_tongzhuo_cms_tables.php"
  "database/migrations/2026_07_21_000000_create_tongzhuo_faq_tables.php"
  "database/migrations/2026_07_21_010000_create_tongzhuo_geo_growth_tables.php"
  "database/migrations/2026_07_21_020000_create_tongzhuo_geo_opportunities_table.php"
  "database/migrations/2026_07_21_030000_create_tongzhuo_geo_plans_table.php"
  "database/migrations/2026_07_21_040000_create_tongzhuo_geo_answer_tests_table.php"
  "database/migrations/2026_07_21_050000_create_tongzhuo_customer_projects_table.php"
  "database/migrations/2026_07_17_000000_create_publisher_devices_table.php"
  "database/migrations/2026_07_21_085000_add_pairing_fields_to_publisher_devices_table.php"
  "database/migrations/2026_07_21_090000_create_publisher_device_pairings_table.php"
  "database/migrations/2026_07_21_091000_create_publisher_platform_sessions_table.php"
  "database/migrations/2026_07_22_100000_create_publishing_center_v2_tables.php"
  "database/migrations/2026_08_12_000000_add_publisher_shadow_and_lease_fields.php"
  "database/migrations/2026_08_13_000000_promote_verified_publisher_platforms.php"
  "database/migrations/2026_08_13_001000_harden_article_distribution_idempotency.php"
  "database/migrations/2026_08_15_000000_add_publisher_profile_lease_index.php"
  "database/migrations/2026_08_15_010000_add_publisher_account_group_source_fields.php"
  "database/migrations/2026_07_25_000000_create_tongzhuo_content_workflow_tables.php"
  "database/migrations/2026_07_25_000000_create_tongzhuo_access_control_tables.php"
  "database/migrations/2026_07_25_000000_create_ai_providers_table.php"
  "database/migrations/2026_07_25_010000_create_tongzhuo_rag_tables.php"
)

missing_files=0
for file in "${required_files[@]}"; do
  if [[ ! -f "$LARAVEL_ROOT/$file" ]]; then
    echo "Missing required file: $file" >&2
    missing_files=$((missing_files + 1))
  fi
done

if [[ "$missing_files" -gt 0 ]]; then
  echo "Tongzhuo GEOFlow override verification failed: missing files=$missing_files" >&2
  exit 1
fi

php_available="0"
route_check="skipped"
command_check="skipped"
schedule_check="skipped"
if command -v php >/dev/null 2>&1; then
  php_available="1"
  if php artisan route:list >/tmp/tongzhuo-route-list.$$ 2>/tmp/tongzhuo-route-list.err.$$; then
    route_check="passed"
    for route_pattern in \
      "${ADMIN_PATH}/publisher-assistant" \
      "${ADMIN_PATH}/publisher-devices" \
      "${ADMIN_PATH}/tongzhuo-cms" \
      "${ADMIN_PATH}/geo-growth" \
      "${ADMIN_PATH}/geo-opportunities" \
      "${ADMIN_PATH}/geo-plans" \
      "${ADMIN_PATH}/geo-answer-tests" \
      "${ADMIN_PATH}/customer-projects" \
      "api/v1/publisher" \
      "api/v1/publisher/devices" \
      "api/v1/publisher/devices/{device}/shadow" \
      "api/v1/publisher/devices/{device}/events" \
      "api/v1/publisher/devices/{device}/sessions" \
      "api/v1/publisher/devices/{device}/commands" \
      "api/v1/publisher/platform-jobs" \
      "api/v1/publisher/platform-jobs/{job}/progress" \
      "api/v1/publisher/platform-jobs/{job}/result" \
      "api/v1/content" \
      "api/v1/access" \
      "api/v1/ai" \
      "api/internal/v1/knowledge-documents" \
      "${ADMIN_PATH}/access" \
      "${ADMIN_PATH}/ai/providers"; do
      if ! grep -Fq "$route_pattern" /tmp/tongzhuo-route-list.$$; then
        echo "Route not found in php artisan route:list: $route_pattern" >&2
        route_check="failed"
      fi
    done
  else
    route_check="route-list-failed"
    cat /tmp/tongzhuo-route-list.err.$$ >&2 || true
  fi
  rm -f /tmp/tongzhuo-route-list.$$ /tmp/tongzhuo-route-list.err.$$

  if php artisan list --raw >/tmp/tongzhuo-command-list.$$ 2>/tmp/tongzhuo-command-list.err.$$; then
    command_check="passed"
    if ! grep -Fq "publisher:reconcile" /tmp/tongzhuo-command-list.$$; then
      echo "Artisan command not found: publisher:reconcile" >&2
      command_check="failed"
    fi
  else
    command_check="command-list-failed"
    cat /tmp/tongzhuo-command-list.err.$$ >&2 || true
  fi
  rm -f /tmp/tongzhuo-command-list.$$ /tmp/tongzhuo-command-list.err.$$

  if php artisan schedule:list --no-ansi >/tmp/tongzhuo-schedule-list.$$ 2>/tmp/tongzhuo-schedule-list.err.$$; then
    schedule_check="passed"
    if ! grep -Fq "publisher:reconcile" /tmp/tongzhuo-schedule-list.$$; then
      echo "Scheduled command not found: publisher:reconcile" >&2
      schedule_check="failed"
    fi
  else
    schedule_check="schedule-list-failed"
    cat /tmp/tongzhuo-schedule-list.err.$$ >&2 || true
  fi
  rm -f /tmp/tongzhuo-schedule-list.$$ /tmp/tongzhuo-schedule-list.err.$$
else
  echo "Warning: php command not found; skipping Laravel route, command, and schedule verification." >&2
fi

if [[ "$route_check" == "failed" || "$route_check" == "route-list-failed" ]]; then
  echo "Tongzhuo GEOFlow override verification failed: route_check=$route_check" >&2
  exit 1
fi

if [[ "$command_check" == "failed" || "$command_check" == "command-list-failed" ]]; then
  echo "Tongzhuo GEOFlow override verification failed: command_check=$command_check" >&2
  exit 1
fi

if [[ "$schedule_check" == "failed" || "$schedule_check" == "schedule-list-failed" ]]; then
  echo "Tongzhuo GEOFlow override verification failed: schedule_check=$schedule_check" >&2
  exit 1
fi

url_check="skipped"
if [[ -n "$BASE_URL" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "Warning: curl command not found; skipping URL verification." >&2
  else
    url_check="passed"
    base="${BASE_URL%/}"
    urls=(
      "$base/llms.txt"
      "$base/sitemap.xml"
      "$base/feed.xml"
      "$base/$ADMIN_PATH/publisher-assistant"
      "$base/$ADMIN_PATH/publisher-devices"
      "$base/$ADMIN_PATH/tongzhuo-cms"
      "$base/$ADMIN_PATH/geo-growth"
      "$base/$ADMIN_PATH/customer-projects"
    )
    for url in "${urls[@]}"; do
      status="$(curl -L -s -o /dev/null -w '%{http_code}' "$url" || true)"
      if [[ "$status" != "200" && "$status" != "302" && "$status" != "301" ]]; then
        echo "URL check failed: $url returned HTTP $status" >&2
        url_check="failed"
      fi
    done
  fi
fi

if [[ "$url_check" == "failed" ]]; then
  echo "Tongzhuo GEOFlow override verification failed: url_check=$url_check" >&2
  exit 1
fi

echo "Tongzhuo GEOFlow override verification passed."
echo "Laravel root: $LARAVEL_ROOT"
echo "Required files: ${#required_files[@]}"
echo "PHP available: $php_available"
echo "Route check: $route_check"
echo "Command check: $command_check"
echo "Schedule check: $schedule_check"
echo "URL check: $url_check"
