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
$overridesRoot = Join-Path $rootPath 'geoflow-integration\server-overrides'
$installerPath = Join-Path $rootPath 'geoflow-integration\deployment\install-geoflow-overrides.sh'
$verifierPath = Join-Path $rootPath 'geoflow-integration\deployment\verify-geoflow-overrides.sh'
$smokePath = Join-Path $rootPath 'geoflow-integration\deployment\smoke-geoflow-workbench.sh'
$deployScriptPath = Join-Path $rootPath 'scripts\Deploy-GeoFlowServer.ps1'

if (-not (Test-Path $overridesRoot)) {
    throw "server-overrides not found: $overridesRoot"
}
if (-not (Test-Path $installerPath)) {
    throw "Linux installer not found: $installerPath"
}
if (-not (Test-Path $verifierPath)) {
    throw "Linux verifier not found: $verifierPath"
}
if (-not (Test-Path $smokePath)) {
    throw "Linux smoke test not found: $smokePath"
}
if (-not (Test-Path $deployScriptPath)) {
    throw "Windows deployment helper not found: $deployScriptPath"
}

$installerText = Get-Content -LiteralPath $installerPath -Raw -Encoding UTF8
foreach ($requiredText in @('--dry-run', 'Tongzhuo GEOFlow overrides dry run passed', 'No files were copied and no artisan command was executed')) {
    if ($installerText -notlike "*$requiredText*") {
        throw "Linux installer is missing dry-run support text: $requiredText"
    }
}

$verifierText = Get-Content -LiteralPath $verifierPath -Raw -Encoding UTF8
foreach ($requiredText in @('--base-url', 'Tongzhuo GEOFlow override verification passed', 'php artisan route:list', 'llms.txt', 'publisher-devices', 'tongzhuo-cms', 'geo-growth', 'geo-opportunities', 'geo-plans', 'geo-answer-tests', 'customer-projects', 'handoff-report.blade.php')) {
    if ($verifierText -notlike "*$requiredText*") {
        throw "Linux verifier is missing required support text: $requiredText"
    }
}
$smokeText = Get-Content -LiteralPath $smokePath -Raw -Encoding UTF8
foreach ($requiredText in @('--base-url', 'Tongzhuo GEOFlow smoke test passed', 'Manual acceptance checklist after login', 'tongzhuo-cms', 'geo-growth', 'customer-projects', 'Save as PDF')) {
    if ($smokeText -notlike "*$requiredText*") {
        throw "Linux smoke test is missing required support text: $requiredText"
    }
}
$deployScriptText = Get-Content -LiteralPath $deployScriptPath -Raw -Encoding UTF8
foreach ($requiredText in @('Package-GeoFlowServer.ps1', 'scp', 'ssh', '--dry-run', 'verify-geoflow-overrides.sh', 'smoke-geoflow-workbench.sh', '-Install')) {
    if ($deployScriptText -notlike "*$requiredText*") {
        throw "Windows deployment helper is missing required support text: $requiredText"
    }
}

$forbidden = @('.env', 'node_modules', '.data', 'vendor', 'storage\logs')
foreach ($name in $forbidden) {
    $matches = @(Get-ChildItem -LiteralPath $overridesRoot -Force -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -like "*\$name" -or $_.FullName -like "*\$name\*"
    })
    if ($matches.Count -gt 0) {
        $matches | Select-Object FullName | Format-Table -AutoSize
        throw "Forbidden runtime path found in server-overrides: $name"
    }
}

$phpFiles = @(Get-ChildItem -LiteralPath $overridesRoot -Recurse -File -Filter '*.php')
if ($phpFiles.Count -eq 0) {
    throw 'No PHP files found in server-overrides.'
}

if (Get-Command php -ErrorAction SilentlyContinue) {
    foreach ($file in $phpFiles) {
        php -l $file.FullName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "PHP syntax check failed: $($file.FullName)"
        }
    }
} else {
    Write-Warning 'php command not found; PHP syntax checks will run on the Linux server during installation.'
}

$publisherApiPath = Join-Path $overridesRoot 'app\Http\Controllers\Api\V1\PublisherAssistantController.php'
$publisherAssistantControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\PublisherAssistantController.php'
$publisherAssistantViewPath = Join-Path $overridesRoot 'resources\views\admin\publisher-assistant.blade.php'
$distributionViewPath = Join-Path $overridesRoot 'resources\views\admin\distribution\_jobs-table.blade.php'
$distributionControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\DistributionController.php'
$articleControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\ArticleController.php'
$factBaseControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\FactBaseController.php'
$articleQualityScorerPath = Join-Path $overridesRoot 'app\Services\GeoGrowth\ArticleGeoQualityScorer.php'
$geoAttributionServicePath = Join-Path $overridesRoot 'app\Services\GeoGrowth\GeoAttributionService.php'
$productWorkbenchServicePath = Join-Path $overridesRoot 'app\Services\GeoGrowth\ProductWorkbenchService.php'
$productMaturityGateServicePath = Join-Path $overridesRoot 'app\Services\GeoGrowth\ProductMaturityGateService.php'
$customerDeliveryReadinessServicePath = Join-Path $overridesRoot 'app\Services\GeoGrowth\CustomerDeliveryReadinessService.php'
$dashboardControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\DashboardController.php'
$factCardModelPath = Join-Path $overridesRoot 'app\Models\TongzhuoFactCard.php'
$geoOpportunityModelPath = Join-Path $overridesRoot 'app\Models\TongzhuoGeoOpportunity.php'
$webRoutesPath = Join-Path $overridesRoot 'routes\web.php'
$geoOpportunityControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\GeoOpportunityController.php'
$geoPlanControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\GeoPlanController.php'
$geoAnswerTestControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\GeoAnswerTestController.php'
$geoGrowthControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\GeoGrowthController.php'
$customerProjectControllerPath = Join-Path $overridesRoot 'app\Http\Controllers\Admin\CustomerProjectController.php'
$geoGrowthIndexViewPath = Join-Path $overridesRoot 'resources\views\admin\geo-growth\index.blade.php'
$dashboardViewPath = Join-Path $overridesRoot 'resources\views\admin\dashboard.blade.php'
$geoOpportunityViewPath = Join-Path $overridesRoot 'resources\views\admin\geo-opportunities\index.blade.php'
$geoPlanIndexViewPath = Join-Path $overridesRoot 'resources\views\admin\geo-plans\index.blade.php'
$geoPlanShowViewPath = Join-Path $overridesRoot 'resources\views\admin\geo-plans\show.blade.php'
$geoAnswerTestViewPath = Join-Path $overridesRoot 'resources\views\admin\geo-answer-tests\index.blade.php'
$geoAttributionViewPath = Join-Path $overridesRoot 'resources\views\admin\analytics\_geo-attribution-section.blade.php'
$articleIndexViewPath = Join-Path $overridesRoot 'resources\views\admin\articles\index.blade.php'
$factBaseIndexViewPath = Join-Path $overridesRoot 'resources\views\admin\fact-base\index.blade.php'
$customerProjectIndexViewPath = Join-Path $overridesRoot 'resources\views\admin\customer-projects\index.blade.php'
$customerProjectShowViewPath = Join-Path $overridesRoot 'resources\views\admin\customer-projects\show.blade.php'
$customerProjectDossierViewPath = Join-Path $overridesRoot 'resources\views\admin\customer-projects\dossier.blade.php'
$customerProjectHandoffViewPath = Join-Path $overridesRoot 'resources\views\admin\customer-projects\handoff-report.blade.php'
$adminHeaderPath = Join-Path $overridesRoot 'resources\views\admin\partials\header.blade.php'
foreach ($path in @($publisherApiPath, $publisherAssistantControllerPath, $publisherAssistantViewPath, $distributionViewPath, $distributionControllerPath, $articleControllerPath, $factBaseControllerPath, $articleQualityScorerPath, $geoAttributionServicePath, $productWorkbenchServicePath, $productMaturityGateServicePath, $customerDeliveryReadinessServicePath, $dashboardControllerPath, $factCardModelPath, $geoOpportunityModelPath, $webRoutesPath, $geoOpportunityControllerPath, $geoPlanControllerPath, $geoAnswerTestControllerPath, $geoGrowthControllerPath, $customerProjectControllerPath, $dashboardViewPath, $geoGrowthIndexViewPath, $geoOpportunityViewPath, $geoPlanIndexViewPath, $geoPlanShowViewPath, $geoAnswerTestViewPath, $geoAttributionViewPath, $articleIndexViewPath, $factBaseIndexViewPath, $customerProjectIndexViewPath, $customerProjectShowViewPath, $customerProjectDossierViewPath, $customerProjectHandoffViewPath, $adminHeaderPath)) {
    if (-not (Test-Path $path)) {
        throw "Required publishing operation file missing: $path"
    }
}
$publisherApiText = Get-Content -LiteralPath $publisherApiPath -Raw -Encoding UTF8
foreach ($requiredText in @('state_summary', 'next_operator_action', 'platform_results')) {
    if ($publisherApiText -notlike "*$requiredText*") {
        throw "Publisher assistant API is missing result state-machine support text: $requiredText"
    }
}
$publisherAssistantControllerText = Get-Content -LiteralPath $publisherAssistantControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('PublisherDevicePairing', 'pairings', 'deviceState', 'paired_at')) {
    if ($publisherAssistantControllerText -notlike "*$requiredText*") {
        throw "Publisher assistant controller is missing pairing workflow support text: $requiredText"
    }
}
$publisherAssistantViewText = Get-Content -LiteralPath $publisherAssistantViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('publisher-devices.pairings.store', 'pairingStateClasses', 'pairings as $pairing', 'claimed_device_id', 'admin.publisher-devices.index')) {
    if ($publisherAssistantViewText -notlike "*$requiredText*") {
        throw "Publisher assistant view is missing pairing cockpit support text: $requiredText"
    }
}
$distributionViewText = Get-Content -LiteralPath $distributionViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('publisherStateSummary', 'publisherNextOperatorAction', 'publisherOperatorConfirmations', 'operator_inspect_failed_platforms', 'failure_category', 'publisher.confirm', 'publisher.fail')) {
    if ($distributionViewText -notlike "*$requiredText*") {
        throw "Distribution jobs table is missing operations cockpit support text: $requiredText"
    }
}
$distributionControllerText = Get-Content -LiteralPath $distributionControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('previous_publisher_assistant', 'next_operator_action', 'state_summary', 'confirmPublisherResult', 'failPublisherResult', 'operator_confirmations')) {
    if ($distributionControllerText -notlike "*$requiredText*") {
        throw "Distribution retry flow is missing publisher state reset support text: $requiredText"
    }
}
$articleControllerText = Get-Content -LiteralPath $articleControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('ArticleGeoQualityScorer', 'loadContentOps', 'loadServiceLineCards', 'loadContentNextActions', 'qualitySnapshot', 'published_without_distribution')) {
    if ($articleControllerText -notlike "*$requiredText*") {
        throw "Article content operations controller is missing required support text: $requiredText"
    }
}
$articleQualityScorerText = Get-Content -LiteralPath $articleQualityScorerPath -Raw -Encoding UTF8
foreach ($requiredText in @('direct_answer', 'evidence_points', 'source_update', 'verified_language')) {
    if ($articleQualityScorerText -notlike "*$requiredText*") {
        throw "Article GEO quality scorer is missing required gate text: $requiredText"
    }
}
$geoAttributionServiceText = Get-Content -LiteralPath $geoAttributionServicePath -Raw -Encoding UTF8
foreach ($requiredText in @('GeoAttributionService', 'geo_attribution_contract', 'asset_quality_score', 'ai_performance_score', 'mention_rate', 'recommendation_rate', 'citation_recall', 'competitor_gap', 'distribution_to_leads')) {
    if ($geoAttributionServiceText -notlike "*$requiredText*") {
        throw "GEO attribution service is missing required support text: $requiredText"
    }
}
$productWorkbenchServiceText = Get-Content -LiteralPath $productWorkbenchServicePath -Raw -Encoding UTF8
foreach ($requiredText in @('ProductWorkbenchService', 'product_workbench_contract', 'ProductMaturityGateService', 'product_maturity_gate', 'cms_console', 'geo_growth', 'distribution_publisher', 'lead_customer_delivery', 'ai_visibility_loop', 'reusable_product_template')) {
    if ($productWorkbenchServiceText -notlike "*$requiredText*") {
        throw "Product workbench service is missing required support text: $requiredText"
    }
}
$productMaturityGateServiceText = Get-Content -LiteralPath $productMaturityGateServicePath -Raw -Encoding UTF8
foreach ($requiredText in @('ProductMaturityGateService', 'product_maturity_gate_contract', 'reusable_delivery_gate', 'sales_ready', 'implementation_ready', 'operations_ready', 'evidence_ready', 'security_ready')) {
    if ($productMaturityGateServiceText -notlike "*$requiredText*") {
        throw "Product maturity gate service is missing required support text: $requiredText"
    }
}
$customerDeliveryReadinessServiceText = Get-Content -LiteralPath $customerDeliveryReadinessServicePath -Raw -Encoding UTF8
foreach ($requiredText in @('CustomerDeliveryReadinessService', 'customer_delivery_readiness_contract', 'customer_delivery_task_board_contract', 'reusable_customer_instance', 'website_admin_endpoints', 'ai_crawl_files', 'fact_question_content_loop', 'publishing_loop', 'lead_capture', 'acceptance_evidence', 'security_boundary', 'owner', 'deliverable', 'acceptance_metric', 'evidence_slot', 'review_at')) {
    if ($customerDeliveryReadinessServiceText -notlike "*$requiredText*") {
        throw "Customer delivery readiness service is missing required support text: $requiredText"
    }
}
$dashboardControllerText = Get-Content -LiteralPath $dashboardControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('ProductWorkbenchService', 'workbenchService', 'workbench')) {
    if ($dashboardControllerText -notlike "*$requiredText*") {
        throw "Dashboard controller is missing product workbench support text: $requiredText"
    }
}
$factBaseControllerText = Get-Content -LiteralPath $factBaseControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('FactBaseController', 'factTypes', 'confidenceLabels', 'forbidden_phrases', 'manual_fact_base')) {
    if ($factBaseControllerText -notlike "*$requiredText*") {
        throw "Fact base controller is missing required support text: $requiredText"
    }
}
$factCardModelText = Get-Content -LiteralPath $factCardModelPath -Raw -Encoding UTF8
foreach ($requiredText in @('TongzhuoFactCard', 'source_updated_at', 'service_lines', 'usage_targets', 'forbidden_phrases')) {
    if ($factCardModelText -notlike "*$requiredText*") {
        throw "Fact card model is missing required support text: $requiredText"
    }
}
$geoOpportunityModelText = Get-Content -LiteralPath $geoOpportunityModelPath -Raw -Encoding UTF8
foreach ($requiredText in @('cluster_name', 'parent_question', 'follow_up_questions', 'query_rewrites', 'evidence_query', 'coverage_status')) {
    if ($geoOpportunityModelText -notlike "*$requiredText*") {
        throw "Question map opportunity model is missing required support text: $requiredText"
    }
}
$webRoutesText = Get-Content -LiteralPath $webRoutesPath -Raw -Encoding UTF8
foreach ($requiredText in @('publisher-confirm', 'publisher-fail', 'publisher.confirm', 'publisher.fail')) {
    if ($webRoutesText -notlike "*$requiredText*") {
        throw "Distribution routes are missing publisher operator result support text: $requiredText"
    }
}
foreach ($requiredText in @('fact-base', 'FactBaseController', 'geo-opportunities', 'geo-plans', 'geo-answer-tests', 'sample', 'GeoOpportunityController', 'GeoPlanController', 'GeoAnswerTestController', 'promote-faq')) {
    if ($webRoutesText -notlike "*$requiredText*") {
        throw "GEO growth routes are missing required module text: $requiredText"
    }
}
foreach ($requiredText in @('customer-projects', 'CustomerProjectController', 'current-site', 'dossier', 'handoff')) {
    if ($webRoutesText -notlike "*$requiredText*") {
        throw "Customer project routes are missing required module text: $requiredText"
    }
}
foreach ($requiredText in @('dossier.export', 'exportDossier')) {
    if ($webRoutesText -notlike "*$requiredText*") {
        throw "Customer project export routes or controller support text is missing: $requiredText"
    }
}

$geoOpportunityControllerText = Get-Content -LiteralPath $geoOpportunityControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('seedPresets', 'promote', 'service_line', 'recommended_output', 'cluster_name', 'follow_up_questions', 'query_rewrites', 'evidence_query', 'coverageLabels')) {
    if ($geoOpportunityControllerText -notlike "*$requiredText*") {
        throw "GEO opportunity controller is missing required support text: $requiredText"
    }
}
$geoPlanControllerText = Get-Content -LiteralPath $geoPlanControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('buildPlanItems', 'baselineItems', 'day_1_30', 'day_31_60', 'day_61_90')) {
    if ($geoPlanControllerText -notlike "*$requiredText*") {
        throw "GEO plan controller is missing required support text: $requiredText"
    }
}
$geoAnswerTestControllerText = Get-Content -LiteralPath $geoAnswerTestControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('GeoEngineManager', 'runAnswerTest', 'manual_platform_sampling', 'performanceScore', 'platformLabels', 'surfaceLabels', 'collectEvidence', 'promoteOpportunity', 'geo_engine', 'engine_metadata')) {
    if ($geoAnswerTestControllerText -notlike "*$requiredText*") {
        throw "GEO answer test controller is missing required support text: $requiredText"
    }
}
$localGeoEngineClientText = Get-Content -LiteralPath (Join-Path $overridesRoot 'app\Services\GeoGrowth\LocalGeoEngineClient.php') -Raw -Encoding UTF8
foreach ($requiredText in @('normalizeCrawlRoot', '$crawlRoot', "/robots.txt", "/sitemap.xml", "/llms.txt")) {
    if ($localGeoEngineClientText -notlike "*$requiredText*") {
        throw "Local GEO engine is missing crawl root normalization support text: $requiredText"
    }
}
$geoAnswerTestModelPath = Join-Path $overridesRoot 'app\Models\TongzhuoGeoAnswerTest.php'
$geoAnswerTestModelText = Get-Content -LiteralPath $geoAnswerTestModelPath -Raw -Encoding UTF8
foreach ($requiredText in @('platform', 'surface', 'prompt_id', 'run_id', 'model_version', 'sampled_at', 'mention', 'recommendation', 'rank', 'citations', 'competitor_mentions', 'answer_accuracy')) {
    if ($geoAnswerTestModelText -notlike "*$requiredText*") {
        throw "GEO answer test model is missing AI sampling support text: $requiredText"
    }
}
$articleIndexText = Get-Content -LiteralPath $articleIndexViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('content_ops_console:', 'article_production', 'website_publish', 'distribution_queue', 'geo_quality_gate', 'service_line_matrix')) {
    if ($articleIndexText -notlike "*$requiredText*") {
        throw "Article content operations view is missing required support text: $requiredText"
    }
}
$factBaseIndexText = Get-Content -LiteralPath $factBaseIndexViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('fact_base_console:', 'entity', 'source', 'confidence', 'confirmed', 'pending', 'forbidden', 'fact_cards')) {
    if ($factBaseIndexText -notlike "*$requiredText*") {
        throw "Fact base view is missing required support text: $requiredText"
    }
}
$geoOpportunityViewText = Get-Content -LiteralPath $geoOpportunityViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('question_map_console:', 'cluster', 'parent_question', 'follow_up_chain', 'query_rewrites', 'evidence_query', 'coverage_status')) {
    if ($geoOpportunityViewText -notlike "*$requiredText*") {
        throw "Question map view is missing required support text: $requiredText"
    }
}
$geoAnswerTestViewText = Get-Content -LiteralPath $geoAnswerTestViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('ai_sampling_console:', 'platform', 'surface', 'prompt_id', 'run_id', 'model_version', 'sampled_at', 'mention', 'recommendation', 'rank', 'citations', 'competitor_mentions', 'answer_accuracy', 'dual_scoring')) {
    if ($geoAnswerTestViewText -notlike "*$requiredText*") {
        throw "AI sampling view is missing required support text: $requiredText"
    }
}
$geoAttributionViewText = Get-Content -LiteralPath $geoAttributionViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('geo_attribution_dashboard:', 'asset_quality_score', 'ai_performance_score', 'mention_rate', 'recommendation_rate', 'citation_recall', 'competitor_gap', 'distribution_to_leads')) {
    if ($geoAttributionViewText -notlike "*$requiredText*") {
        throw "GEO attribution dashboard view is missing required support text: $requiredText"
    }
}
$geoGrowthControllerText = Get-Content -LiteralPath $geoGrowthControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('TongzhuoCustomerProject', 'TongzhuoCmsPage', 'PublisherDevice', 'channels_active', 'risk_projects')) {
    if ($geoGrowthControllerText -notlike "*$requiredText*") {
        throw "GEO growth controller is missing closed-loop support text: $requiredText"
    }
}
$geoGrowthIndexText = Get-Content -LiteralPath $geoGrowthIndexViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('deliveryPipeline', 'customer-projects.index', 'publisher-assistant', 'distribution.jobs', 'tongzhuo-cms.faqs.index')) {
    if ($geoGrowthIndexText -notlike "*$requiredText*") {
        throw "GEO growth index view is missing closed-loop support text: $requiredText"
    }
}
$dashboardViewText = Get-Content -LiteralPath $dashboardViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('product_workbench:', 'cms_console', 'geo_growth', 'distribution_publisher', 'lead_customer_delivery', 'ai_visibility_loop', 'reusable_product_template', 'GEO GROWTH LOOP', 'product_maturity_gate:', 'PRODUCT MATURITY GATE')) {
    if ($dashboardViewText -notlike "*$requiredText*") {
        throw "Dashboard workbench view is missing product support text: $requiredText"
    }
}
$customerProjectControllerText = Get-Content -LiteralPath $customerProjectControllerPath -Raw -Encoding UTF8
foreach ($requiredText in @('CustomerDeliveryReadinessService', 'deliveryReadiness', 'backendSnapshotPreview', 'createCurrentSiteProject', 'handoffReport', 'dossier', 'serviceLines', 'deliveryChecklist', 'acceptanceLabels', 'renewalLabels', 'delivery_profile', 'acceptance_status', 'evidence_url', 'training_at', 'last_release_version', 'upgrade_history', 'success_review_at', 'success_review_summary', 'renewal_signal', 'renewal_next_action', 'endpoints', 'last_reviewed_at')) {
    if ($customerProjectControllerText -notlike "*$requiredText*") {
        throw "Customer project controller is missing required support text: $requiredText"
    }
}
foreach ($requiredText in @('exportDossier', 'customer_project_dossier_export', 'streamDownload')) {
    if ($customerProjectControllerText -notlike "*$requiredText*") {
        throw "Customer project controller export support is missing required text: $requiredText"
    }
}
$customerProjectDossierText = Get-Content -LiteralPath $customerProjectDossierViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('CUSTOMER PROJECT DOSSIER', 'customer_project_dossier:', 'customer-projects.dossier.export', 'geoflow_backend_snapshot_panel:', 'backendSnapshotPreview', 'delivery_tasks', 'deliveryReadiness', 'maturity_gate', 'customer_handoff', 'owner', 'deliverable', 'acceptance_metric', 'evidence_slot', 'review_at')) {
    if ($customerProjectDossierText -notlike "*$requiredText*") {
        throw "Customer project dossier view is missing required support text: $requiredText"
    }
}
$adminHeaderText = Get-Content -LiteralPath $adminHeaderPath -Raw -Encoding UTF8
foreach ($requiredText in @('fact_base', 'admin.fact-base.index', 'customer_projects', 'contact_leads', 'admin.customer-projects.index', 'admin.customer-projects.handoff')) {
    if ($adminHeaderText -notlike "*$requiredText*") {
        throw "Admin navigation is missing customer project support text: $requiredText"
    }
}
foreach ($requiredText in @('data-nav-group-toggle', 'data-nav-group-body', 'tongzhuo_admin_nav_collapsed', 'toggleNavGroup')) {
    if ($adminHeaderText -notlike "*$requiredText*") {
        throw "Admin navigation is missing collapsible group support text: $requiredText"
    }
}
$corporateNavPath = Join-Path $overridesRoot 'public\assets\corporate-nav.js'
$corporateNavText = Get-Content -LiteralPath $corporateNavPath -Raw -Encoding UTF8
foreach ($requiredText in @('normalizeCorporateNav', '/insights.html', '/issues.html', 'navItems')) {
    if ($corporateNavText -notlike "*$requiredText*") {
        throw "Public corporate navigation is missing stable route support text: $requiredText"
    }
}
$customerProjectIndexText = Get-Content -LiteralPath $customerProjectIndexViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('customer-projects.index', 'customer-projects.current-site', 'customer-projects.store', 'service_lines', 'deliveryPercent', 'acceptanceStatus', 'renewalSignal')) {
    if ($customerProjectIndexText -notlike "*$requiredText*") {
        throw "Customer project index view is missing required support text: $requiredText"
    }
}
$customerProjectShowText = Get-Content -LiteralPath $customerProjectShowViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('customer_delivery_readiness_panel:', 'geoflow_backend_snapshot_panel:', 'backendSnapshotPreview', 'customer_delivery_task_board:', 'reusable_customer_instance', 'website_admin_endpoints', 'ai_crawl_files', 'fact_question_content_loop', 'publishing_loop', 'lead_capture', 'acceptance_evidence', 'security_boundary', 'owner', 'deliverable', 'acceptance_metric', 'evidence_slot', 'review_at', 'customer-projects.update', 'delivery_profile', 'readiness', 'acceptance_status', 'accepted_by', 'evidence_url', 'training_at', 'last_release_version', 'upgrade_history', 'success_review_at', 'success_review_summary', 'renewal_signal', 'renewal_next_action', 'review_notes', 'deliveryChecklist', 'deliveryPercent', 'tongzhuo-cms.dashboard', 'geo-growth.index', 'distribution.jobs', 'contact-leads.index')) {
    if ($customerProjectShowText -notlike "*$requiredText*") {
        throw "Customer project show view is missing required support text: $requiredText"
    }
}
$customerProjectHandoffText = Get-Content -LiteralPath $customerProjectHandoffViewPath -Raw -Encoding UTF8
foreach ($requiredText in @('CUSTOMER HANDOFF REPORT', 'window.print', 'deliveryChecklist', 'deliveryReadiness', 'deliveryTasks', 'customer_handoff_task_board:', 'owner', 'deliverable', 'acceptance_metric', 'evidence_slot', 'review_at', 'upgrade_history', 'success_review_summary', 'renewal_next_action', 'customer-projects.show')) {
    if ($customerProjectHandoffText -notlike "*$requiredText*") {
        throw "Customer project handoff report view is missing required support text: $requiredText"
    }
}

Write-Host 'Server override validation passed.'
