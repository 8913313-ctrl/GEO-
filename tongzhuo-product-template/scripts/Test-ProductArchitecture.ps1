[CmdletBinding()]
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path

function Assert-FileExists {
    param([Parameter(Mandatory = $true)] [string]$RelativePath)

    $path = Join-Path $rootPath ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required product architecture file is missing: $RelativePath"
    }
}

function Assert-TextContains {
    param(
        [Parameter(Mandatory = $true)] [string]$RelativePath,
        [Parameter(Mandatory = $true)] [string[]]$RequiredText
    )

    $path = Join-Path $rootPath ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    Assert-FileExists -RelativePath $RelativePath
    $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
    foreach ($item in $RequiredText) {
        if ($text -notlike "*$item*") {
            throw "$RelativePath is missing required product architecture text: $item"
        }
    }
}

$contractPath = 'docs/PRODUCT-ARCHITECTURE-CONTRACT.md'
Assert-TextContains -RelativePath $contractPath -RequiredText @(
    'tongzhuo_geo_growth_architecture_contract',
    'company_assets -> geo_diagnosis -> opportunities -> content -> website_ai_endpoints -> distribution -> leads -> customer_delivery',
    'georank_engine_only',
    'desktop_login_only',
    'no_public_prices',
    'no_customer_secrets'
)

Assert-TextContains -RelativePath 'docs/GEO-GROWTH-OS-ARCHITECTURE.md' -RequiredText @(
    'Laravel/GEOFlow',
    'GEORank',
    'GEO_ENGINE_DRIVER',
    'runAnswerTest',
    'expandOpportunities',
    'generateActionPlan',
    'ai_sampling_contract',
    'evidence_bound_plan_contract',
    'dual_scoring',
    'local',
    'georank'
)
Assert-TextContains -RelativePath 'docs/GEO-METHOD-INTEGRATION-CONTRACT.md' -RequiredText @(
    'fact_base',
    'question_map',
    'evidence_content',
    'ai_sampling',
    'Dual Scoring',
    'GeoEngineManager',
    'GEORank'
)
Assert-TextContains -RelativePath 'docs/GEO-PRODUCT-BLUEPRINT-ANCHORS.md' -RequiredText @(
    'fact_base',
    'question_map',
    'evidence_content',
    'ai_sampling',
    'GeoEngineManager',
    'Operations Bundle',
    'GEOFlow / Laravel'
)
Assert-TextContains -RelativePath 'docs/BACKOFFICE-MENU-CONTRACT.md' -RequiredText @(
    'overview',
    'website_cms',
    'content_growth',
    'geo_operations',
    'distribution_execution',
    'customer_assets',
    'system'
)
Assert-TextContains -RelativePath 'docs/BACKOFFICE-MENU-ANCHORS.md' -RequiredText @(
    'fact_base',
    'question_map',
    'evidence_content',
    'ai_sampling',
    'geo_console',
    'publisher_assistant',
    'Operations Bundle'
)
Assert-TextContains -RelativePath 'docs/CUSTOMER-PROJECT-DOSSIER.md' -RequiredText @(
    'Backend Snapshot',
    'BackendDossierPath',
    'GEOFlow backend customer project snapshot',
    'delivery readiness score and status'
)
Assert-TextContains -RelativePath 'docs/PRODUCT-DELIVERY-CONSOLE.md' -RequiredText @(
    'BackendDossierPath',
    'GEOFlow backend project state',
    'CustomerOpsBundle'
)
Assert-TextContains -RelativePath 'scripts/New-CustomerProjectDossier.ps1' -RequiredText @(
    'BackendDossierPath',
    'customer_project_dossier_export',
    'geoflow_backend_snapshot',
    'geoflow_backend_dossier'
)
Assert-TextContains -RelativePath 'scripts/Start-ProductDelivery.ps1' -RequiredText @(
    'BackendDossierPath',
    'geoflow-backend-dossier.json'
)
Assert-TextContains -RelativePath 'scripts/New-CustomerPortfolioIndex.ps1' -RequiredText @(
    'geoflow_backend_snapshot_attached',
    'backend_delivery_score',
    'average_backend_delivery_score',
    'with_geoflow_backend_snapshot'
)
Assert-TextContains -RelativePath 'scripts/New-CustomerEvidenceIndex.ps1' -RequiredText @(
    'geoflow_backend_snapshot_attached',
    'backend_delivery_score',
    'average_backend_delivery_score',
    'with_geoflow_backend_snapshot'
)
Assert-TextContains -RelativePath 'scripts/New-CustomerLaunchReadiness.ps1' -RequiredText @(
    'geoflow_backend_snapshot_ready',
    'geoflow_backend_snapshot_count',
    'backend_delivery_score'
)
Assert-TextContains -RelativePath 'scripts/New-CustomerHealthScorecard.ps1' -RequiredText @(
    'geoflow_backend_snapshot',
    'geoflow_backend_snapshot_ready',
    'geoflow_backend_snapshot_count'
)
Assert-TextContains -RelativePath 'docs/CUSTOMER-PORTFOLIO-INDEX.md' -RequiredText @(
    'GEOFlow backend delivery score and status',
    'backend delivery score'
)
Assert-TextContains -RelativePath 'docs/CUSTOMER-PROJECT-DOSSIER.md' -RequiredText @(
    'Backend Snapshot',
    'BackendDossierPath',
    'delivery readiness score and status'
)

Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/partials/header.blade.php' -RequiredText @(
    'tongzhuo_cms',
    'tongzhuo_cms_pages',
    'tongzhuo_cms_faqs',
    'fact_base',
    'articles',
    'contact_leads',
    'customer_projects',
    'geo_console',
    'geo_opportunities',
    'geo_answer_tests',
    'geo_plans',
    'distribution',
    'publisher_assistant',
    'analytics',
    'system_settings'
)

Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/TongzhuoCmsController.php' -RequiredText @(
    'contentReadiness',
    'aiEndpoints',
    'nextActions',
    'published_faq_items',
    'templateOptions',
    'builtInSlugs',
    'editorSummary'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/GeoGrowthController.php' -RequiredText @(
    'operationActions',
    'workflowStages',
    'recentArticles',
    'recentDistributions',
    'geoEngineDriver'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/GeoAnswerTestController.php' -RequiredText @(
    'GeoEngineManager',
    'runAnswerTest',
    'manual_platform_sampling',
    'performanceScore',
    'platformLabels',
    'surfaceLabels',
    'geo_engine',
    'engine_metadata'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Models/TongzhuoGeoAnswerTest.php' -RequiredText @(
    'platform',
    'surface',
    'prompt_id',
    'run_id',
    'model_version',
    'sampled_at',
    'mention',
    'recommendation',
    'rank',
    'citations',
    'competitor_mentions',
    'answer_accuracy'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/GeoOpportunityController.php' -RequiredText @(
    'GeoEngineManager',
    'expandOpportunities',
    'opportunity_seed',
    'engine_metadata'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/GeoPlanController.php' -RequiredText @(
    'GeoEngineManager',
    'generateActionPlan',
    'evidence_source',
    'current_question',
    'owner_name',
    'deliverable',
    'acceptance_metric',
    'resample_date',
    'geo_engine',
    'engine_metadata'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/database/migrations/2026_07_21_080000_add_evidence_delivery_fields_to_geo_plan_items.php' -RequiredText @(
    'evidence_source',
    'current_question',
    'owner_name',
    'deliverable',
    'acceptance_metric',
    'resample_date'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Models/TongzhuoGeoPlanItem.php' -RequiredText @(
    'evidence_source',
    'current_question',
    'owner_name',
    'deliverable',
    'acceptance_metric',
    'resample_date'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/DistributionController.php' -RequiredText @(
    'recentJobs',
    'channelTypeSummary',
    'jobStats',
    'online_devices',
    'active_channels'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/ArticleController.php' -RequiredText @(
    'ArticleGeoQualityScorer',
    'loadContentOps',
    'loadServiceLineCards',
    'loadContentNextActions',
    'qualitySnapshot',
    'published_without_distribution'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/FactBaseController.php' -RequiredText @(
    'FactBaseController',
    'factTypes',
    'confidenceLabels',
    'forbidden_phrases',
    'manual_fact_base'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Models/TongzhuoFactCard.php' -RequiredText @(
    'class TongzhuoFactCard',
    'source_updated_at',
    'service_lines',
    'usage_targets',
    'forbidden_phrases'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Models/TongzhuoGeoOpportunity.php' -RequiredText @(
    'cluster_name',
    'parent_question',
    'follow_up_questions',
    'query_rewrites',
    'evidence_query',
    'coverage_status'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/ArticleGeoQualityScorer.php' -RequiredText @(
    'class ArticleGeoQualityScorer',
    'direct_answer',
    'evidence_points',
    'source_update',
    'verified_language'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/GeoAttributionService.php' -RequiredText @(
    'class GeoAttributionService',
    'geo_attribution_contract',
    'asset_quality_score',
    'ai_performance_score',
    'mention_rate',
    'recommendation_rate',
    'citation_recall',
    'competitor_gap',
    'distribution_to_leads'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/ProductWorkbenchService.php' -RequiredText @(
    'class ProductWorkbenchService',
    'product_workbench_contract',
    'ProductMaturityGateService',
    'product_maturity_gate',
    'cms_console',
    'geo_growth',
    'distribution_publisher',
    'lead_customer_delivery',
    'ai_visibility_loop',
    'reusable_product_template'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/ProductMaturityGateService.php' -RequiredText @(
    'class ProductMaturityGateService',
    'product_maturity_gate_contract',
    'reusable_delivery_gate',
    'sales_ready',
    'implementation_ready',
    'operations_ready',
    'evidence_ready',
    'security_ready'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/CustomerDeliveryReadinessService.php' -RequiredText @(
    'class CustomerDeliveryReadinessService',
    'customer_delivery_readiness_contract',
    'customer_delivery_task_board_contract',
    'reusable_customer_instance',
    'website_admin_endpoints',
    'ai_crawl_files',
    'fact_question_content_loop',
    'publishing_loop',
    'lead_capture',
    'acceptance_evidence',
    'security_boundary',
    'owner',
    'deliverable',
    'acceptance_metric',
    'evidence_slot',
    'review_at'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/DashboardController.php' -RequiredText @(
    'ProductWorkbenchService',
    'workbenchService',
    'workbench'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/CustomerProjectController.php' -RequiredText @(
    'CustomerDeliveryReadinessService',
    'deliveryReadiness',
    'backendSnapshotPreview',
    'exportDossier',
    'customer_project_dossier_export',
    'streamDownload'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/dashboard.blade.php' -RequiredText @(
    'product_workbench:',
    'cms_console',
    'geo_growth',
    'distribution_publisher',
    'lead_customer_delivery',
    'ai_visibility_loop',
    'reusable_product_template',
    'GEO GROWTH LOOP',
    'product_maturity_gate:',
    'PRODUCT MATURITY GATE'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/customer-projects/show.blade.php' -RequiredText @(
    'customer_delivery_readiness_panel:',
    'geoflow_backend_snapshot_panel:',
    'backendSnapshotPreview',
    'customer_delivery_task_board:',
    'reusable_customer_instance',
    'website_admin_endpoints',
    'ai_crawl_files',
    'fact_question_content_loop',
    'publishing_loop',
    'lead_capture',
    'acceptance_evidence',
    'security_boundary',
    'owner',
    'deliverable',
    'acceptance_metric',
    'evidence_slot',
    'review_at'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/customer-projects/handoff-report.blade.php' -RequiredText @(
    'CUSTOMER HANDOFF REPORT',
    'customer_handoff_task_board:',
    'deliveryTasks',
    'owner',
    'deliverable',
    'acceptance_metric',
    'evidence_slot',
    'review_at'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/customer-projects/dossier.blade.php' -RequiredText @(
    'CUSTOMER PROJECT DOSSIER',
    'customer_project_dossier:',
    'customer-projects.dossier.export',
    'geoflow_backend_snapshot_panel:',
    'backendSnapshotPreview',
    'delivery_tasks',
    'deliveryReadiness',
    'maturity_gate',
    'customer_handoff'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/tongzhuo-cms/dashboard.blade.php' -RequiredText @(
    'cms_dashboard:',
    'operations_hub',
    'readiness_score',
    'operator_next_actions',
    'ai_crawl_endpoints',
    'recent_pages',
    'recent_articles'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/tongzhuo-cms/pages/index.blade.php' -RequiredText @(
    'cms_pages_index:',
    'page_builder',
    'filters',
    'status_filter',
    'template_filter',
    'seo_state',
    'module_count',
    'version_count'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/tongzhuo-cms/pages/form.blade.php' -RequiredText @(
    'cms_page_editor:',
    'structured_editor',
    'page_settings',
    'seo_panel',
    'module_editor',
    'publish_panel',
    'version_history',
    'block_delete'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/geo-growth/index.blade.php' -RequiredText @(
    'geo_growth_workspace:',
    'workflow_stage_board',
    'operator_action_queue',
    'audit_to_content_loop',
    'distribution_feedback',
    'customer_delivery_loop',
    'georank_engine_status'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/distribution/index.blade.php' -RequiredText @(
    'distribution_console:',
    'channel_health',
    'distribution_queue',
    'local_publisher_boundary',
    'recent_jobs',
    'recent_logs',
    'operator_actions'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/distribution/jobs.blade.php' -RequiredText @(
    'distribution_jobs:',
    'queue_filters',
    'job_status_overview',
    'retry_failed',
    'operator_confirmation',
    'publisher_result_writeback'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/articles/index.blade.php' -RequiredText @(
    'content_ops_console:',
    'article_production',
    'website_publish',
    'distribution_queue',
    'geo_quality_gate',
    'service_line_matrix'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/fact-base/index.blade.php' -RequiredText @(
    'fact_base_console:',
    'entity',
    'source',
    'confidence',
    'confirmed',
    'pending',
    'forbidden',
    'fact_cards'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/geo-opportunities/index.blade.php' -RequiredText @(
    'question_map_console:',
    'cluster',
    'parent_question',
    'follow_up_chain',
    'query_rewrites',
    'evidence_query',
    'coverage_status'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/geo-answer-tests/index.blade.php' -RequiredText @(
    'ai_sampling_console:',
    'platform',
    'surface',
    'prompt_id',
    'run_id',
    'model_version',
    'sampled_at',
    'mention',
    'recommendation',
    'rank',
    'citations',
    'competitor_mentions',
    'answer_accuracy',
    'dual_scoring'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/geo-plans/show.blade.php' -RequiredText @(
    'evidence_bound_plan:',
    'evidence_source',
    'current_question',
    'owner',
    'deliverable',
    'acceptance_metric',
    'resample_date'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/resources/views/admin/analytics/_geo-attribution-section.blade.php' -RequiredText @(
    'geo_attribution_dashboard:',
    'asset_quality_score',
    'ai_performance_score',
    'mention_rate',
    'recommendation_rate',
    'citation_recall',
    'competitor_gap',
    'distribution_to_leads'
)

Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/GeoEngineClient.php' -RequiredText @(
    'interface GeoEngineClient',
    'auditWebsite',
    'runAnswerTest',
    'expandOpportunities',
    'generateActionPlan'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/LocalGeoEngineClient.php' -RequiredText @(
    'class LocalGeoEngineClient',
    'auditWebsite',
    'runAnswerTest',
    'expandOpportunities',
    'generateActionPlan'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/RemoteGeoRankEngineClient.php' -RequiredText @(
    'class RemoteGeoRankEngineClient',
    'config(''geoflow.geo_engine.base_url''',
    'answer_test_path',
    'opportunities_path',
    'plan_path',
    'source',
    'tongzhuo_geoflow'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/app/Services/GeoGrowth/GeoEngineManager.php' -RequiredText @(
    'geoflow.geo_engine.driver',
    'RemoteGeoRankEngineClient',
    'LocalGeoEngineClient',
    'callWithFallback'
)
Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/config/geoflow.php' -RequiredText @(
    'geo_engine',
    'GEO_ENGINE_DRIVER',
    'GEO_ENGINE_BASE_URL',
    'GEO_ENGINE_AUDIT_PATH',
    'GEO_ENGINE_ANSWER_TEST_PATH',
    'GEO_ENGINE_OPPORTUNITIES_PATH',
    'GEO_ENGINE_PLAN_PATH',
    'GEO_ENGINE_API_KEY',
    'GEO_ENGINE_TIMEOUT_SECONDS'
)

foreach ($relativePath in @(
    'website/index.html',
    'website/insights.html',
    'website/issues.html',
    'website/contact.html',
    'website/robots.txt',
    'website/sitemap.xml',
    'website/feed.xml',
    'website/llms.txt',
    'website/llms-full.txt'
)) {
    Assert-FileExists -RelativePath $relativePath
}

Assert-TextContains -RelativePath 'geoflow-integration/server-overrides/routes/web.php' -RequiredText @(
    'tongzhuo-cms',
    'fact-base',
    'geo-growth',
    'geo-opportunities',
    'geo-answer-tests',
    'sample',
    'geo-plans',
    'distribution',
    'publisher-assistant',
    'publisher-devices',
    'customer-projects',
    'dossier',
    'dossier.export',
    'contact-leads'
)

foreach ($relativePath in @(
    'desktop-agent/src/agent.js',
    'desktop-agent/src/geoflow-client.js',
    'desktop-agent/src/platform-browser.js',
    'desktop-agent/src/job-state-machine.js',
    'desktop-agent/src/diagnostics.js',
    'desktop-agent/src/export-bundle.js',
    'desktop-agent/src/adapters/zhihu-adapter.js',
    'desktop-agent/src/adapters/wechat-mp-adapter.js',
    'desktop-agent/src/adapters/toutiao-adapter.js',
    'desktop-agent/preflight.ps1',
    'desktop-agent/install-desktop.ps1'
)) {
    Assert-FileExists -RelativePath $relativePath
}

foreach ($relativePath in @(
    'scripts/New-Customer.ps1',
    'scripts/New-CustomerConfig.ps1',
    'scripts/New-CustomerDeliveryFromConfig.ps1',
    'scripts/Package-CustomerDelivery.ps1',
    'scripts/Package-GeoFlowServer.ps1',
    'scripts/Deploy-GeoFlowServer.ps1',
    'scripts/Test-TemplateSecrets.ps1',
    'scripts/Test-PackageSecrets.ps1',
    'scripts/Test-CustomerDeliveryPackage.ps1',
    'scripts/Test-GeoFlowServerPackage.ps1',
    'geoflow-integration/deployment/install-geoflow-overrides.sh',
    'geoflow-integration/deployment/verify-geoflow-overrides.sh',
    'geoflow-integration/deployment/smoke-geoflow-workbench.sh'
)) {
    Assert-FileExists -RelativePath $relativePath
}

Write-Host 'Product architecture contract validation passed.'
