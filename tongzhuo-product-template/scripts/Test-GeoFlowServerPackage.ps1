[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
& (Join-Path $PSScriptRoot 'Test-PackageSecrets.ps1') -PackagePath $resolvedPackage

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Get-ZipEntryNames {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        return @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
    } finally {
        $archive.Dispose()
    }
}

function Read-ZipManifest {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $entry = $archive.Entries | Where-Object {
            $normalized = $_.FullName -replace '\\', '/'
            $normalized -eq 'package-manifest.json' -or $normalized -like '*/package-manifest.json'
        } | Select-Object -First 1
        Assert-Condition ($null -ne $entry) 'GEOFlow server package manifest not found.'
        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            return $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -gt 0) "GEOFlow server package missing entry: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -eq 0) "GEOFlow server package contains blocked entry: $Pattern"
}

$manifest = Read-ZipManifest -ZipPath $resolvedPackage
Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "GEOFlow server package version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
Assert-Condition ([string] $manifest.component -eq 'geoflow-workbench') "GEOFlow server package component mismatch: $($manifest.component)"
Assert-Condition ([string] $manifest.install_command -like '*install-geoflow-overrides.sh*') 'GEOFlow server package manifest is missing install_command.'
Assert-Condition ([string] $manifest.dry_run_command -like '*--dry-run*') 'GEOFlow server package manifest is missing dry_run_command.'
Assert-Condition ([string] $manifest.verify_command -like '*verify-geoflow-overrides.sh*') 'GEOFlow server package manifest is missing verify_command.'
Assert-Condition ([string] $manifest.smoke_command -like '*smoke-geoflow-workbench.sh*') 'GEOFlow server package manifest is missing smoke_command.'
Assert-Condition ([string] $manifest.contract_check_command -like '*check-publisher-automation-contract.ps1*') 'GEOFlow server package manifest is missing publisher contract_check_command.'
Assert-Condition ([string] $manifest.publisher_automation.reconcile_command -eq 'php artisan publisher:reconcile --json') 'GEOFlow server package manifest is missing the reconcile command.'
Assert-Condition ([string] $manifest.publisher_automation.scheduler_verify_command -eq 'php artisan schedule:list') 'GEOFlow server package manifest is missing the scheduler verification command.'
Assert-Condition ([bool] $manifest.publisher_automation.scheduler_cron_required) 'GEOFlow server package must declare that system Cron is required.'
Assert-Condition ([bool] $manifest.publisher_automation.sse_proxy_buffering_must_be_disabled) 'GEOFlow server package must declare the SSE proxy buffering requirement.'
$featureFlags = @($manifest.publisher_automation.required_feature_flags)
foreach ($requiredFlag in @('PUBLISHING_CENTER_V2_ENABLED', 'PUBLISHER_PLATFORM_JOBS_ENABLED', 'PUBLISHER_DEVICE_COMMANDS_ENABLED', 'PUBLISHER_DEVICE_EVENTS_ENABLED')) {
    Assert-Condition ($featureFlags -contains $requiredFlag) "GEOFlow server package manifest is missing publisher feature flag: $requiredFlag"
}
Assert-Condition ([bool] $manifest.security.excludes_env) 'GEOFlow server package manifest must declare .env exclusion.'
Assert-Condition ([bool] $manifest.security.excludes_runtime_storage) 'GEOFlow server package manifest must declare runtime storage exclusion.'
Assert-Condition ([bool] $manifest.security.excludes_customer_tokens) 'GEOFlow server package manifest must declare customer token exclusion.'

$entries = Get-ZipEntryNames -ZipPath $resolvedPackage
foreach ($pattern in @(
    '*/package-manifest.json',
    '*/deployment/install-geoflow-overrides.sh',
    '*/deployment/verify-geoflow-overrides.sh',
    '*/deployment/smoke-geoflow-workbench.sh',
    '*/deployment/check-publisher-automation-contract.ps1',
    '*/server-overrides/app/Console/Commands/ReconcilePublisherPlatformJobsCommand.php',
    '*/server-overrides/app/Http/Controllers/Admin/CustomerProjectController.php',
    '*/server-overrides/app/Http/Controllers/Admin/GeoGrowthController.php',
    '*/server-overrides/app/Http/Controllers/Admin/GeoOpportunityController.php',
    '*/server-overrides/app/Http/Controllers/Admin/GeoPlanController.php',
    '*/server-overrides/app/Http/Controllers/Admin/GeoAnswerTestController.php',
    '*/server-overrides/app/Http/Controllers/Admin/PublisherAssistantController.php',
    '*/server-overrides/app/Http/Controllers/Admin/PublisherDeviceController.php',
    '*/server-overrides/app/Http/Controllers/Admin/PublisherDeviceControlController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherAssistantController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceShadowController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceEventController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceCommandController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/PublisherPlatformJobController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/ContentWorkflowController.php',
    '*/server-overrides/app/Http/Controllers/Api/V1/AiProviderController.php',
    '*/server-overrides/app/Http/Controllers/Api/Internal/RagController.php',
    '*/server-overrides/app/Http/Controllers/Api/Internal/KnowledgeDocumentController.php',
    '*/server-overrides/app/Http/Middleware/EnforceAdminRbac.php',
    '*/server-overrides/app/Models/TongzhuoCustomerProject.php',
    '*/server-overrides/app/Models/TongzhuoCmsSite.php',
    '*/server-overrides/app/Models/TongzhuoGeoOpportunity.php',
    '*/server-overrides/app/Models/TongzhuoGeoPlan.php',
    '*/server-overrides/app/Models/TongzhuoGeoAnswerTest.php',
    '*/server-overrides/app/Models/PublisherDevice.php',
    '*/server-overrides/app/Models/PublisherDeviceCommand.php',
    '*/server-overrides/app/Models/PublisherPlatformJob.php',
    '*/server-overrides/app/Models/PublisherPlatformSession.php',
    '*/server-overrides/app/Models/AiProvider.php',
    '*/server-overrides/app/Models/TongzhuoContentBusinessLine.php',
    '*/server-overrides/app/Models/TongzhuoKnowledgeDocument.php',
    '*/server-overrides/app/Services/Publishing/PublisherDeviceCredential.php',
    '*/server-overrides/app/Services/Publishing/PublisherPlatformCatalogService.php',
    '*/server-overrides/app/Services/Publishing/PublisherPlatformJobLifecycleService.php',
    '*/server-overrides/app/Services/Publishing/PublisherPreflightService.php',
    '*/server-overrides/app/Services/Publishing/PublisherSelectorHealthService.php',
    '*/server-overrides/app/Services/Publishing/PublishingCenterService.php',
    '*/server-overrides/bootstrap/app.php',
    '*/server-overrides/config/publishing.php',
    '*/server-overrides/app/Services/Access/AccessControlService.php',
    '*/server-overrides/app/Services/TongzhuoAi/AiModelGateway.php',
    '*/server-overrides/app/Services/Rag/HybridKnowledgeRetriever.php',
    '*/server-overrides/routes/tongzhuo-access-api.php',
    '*/server-overrides/routes/tongzhuo-content-api.php',
    '*/server-overrides/routes/tongzhuo-ai-api.php',
    '*/server-overrides/routes/tongzhuo-rag-api.php',
    '*/server-overrides/routes/publisher-assistant.php',
    '*/server-overrides/routes/publisher-device-sync.php',
    '*/server-overrides/public/assets/styles.css',
    '*/server-overrides/public/assets/wukong-overrides.css',
    '*/server-overrides/public/assets/site.js',
    '*/server-overrides/public/assets/logo-mark-blue.png',
    '*/server-overrides/public/assets/logo-zhuojian-blue.png',
    '*/server-overrides/public/assets/short-video-production.jpg',
    '*/server-overrides/resources/views/admin/publisher-assistant.blade.php',
    '*/server-overrides/resources/views/admin/publisher-devices/index.blade.php',
    '*/server-overrides/resources/views/admin/tongzhuo-cms/dashboard.blade.php',
    '*/server-overrides/resources/views/admin/tongzhuo-cms/pages/index.blade.php',
    '*/server-overrides/resources/views/admin/tongzhuo-cms/faqs/index.blade.php',
    '*/server-overrides/resources/views/admin/geo-growth/index.blade.php',
    '*/server-overrides/resources/views/admin/geo-opportunities/index.blade.php',
    '*/server-overrides/resources/views/admin/geo-plans/index.blade.php',
    '*/server-overrides/resources/views/admin/geo-answer-tests/index.blade.php',
    '*/server-overrides/resources/views/admin/customer-projects/index.blade.php',
    '*/server-overrides/resources/views/admin/customer-projects/show.blade.php',
    '*/server-overrides/resources/views/admin/customer-projects/handoff-report.blade.php',
    '*/server-overrides/database/migrations/2026_07_20_000000_create_tongzhuo_cms_tables.php',
    '*/server-overrides/database/migrations/2026_07_21_000000_create_tongzhuo_faq_tables.php',
    '*/server-overrides/database/migrations/2026_07_21_010000_create_tongzhuo_geo_growth_tables.php',
    '*/server-overrides/database/migrations/2026_07_21_020000_create_tongzhuo_geo_opportunities_table.php',
    '*/server-overrides/database/migrations/2026_07_21_030000_create_tongzhuo_geo_plans_table.php',
    '*/server-overrides/database/migrations/2026_07_21_040000_create_tongzhuo_geo_answer_tests_table.php',
    '*/server-overrides/database/migrations/2026_07_21_050000_create_tongzhuo_customer_projects_table.php',
    '*/server-overrides/database/migrations/2026_07_21_085000_add_pairing_fields_to_publisher_devices_table.php',
    '*/server-overrides/database/migrations/2026_07_21_090000_create_publisher_device_pairings_table.php',
    '*/server-overrides/database/migrations/2026_07_21_091000_create_publisher_platform_sessions_table.php',
    '*/server-overrides/database/migrations/2026_07_25_000000_create_tongzhuo_access_control_tables.php',
    '*/server-overrides/database/migrations/2026_07_25_000000_create_tongzhuo_content_workflow_tables.php',
    '*/server-overrides/database/migrations/2026_07_25_000000_create_ai_providers_table.php',
    '*/server-overrides/database/migrations/2026_07_25_010000_create_tongzhuo_rag_tables.php',
    '*/server-overrides/database/migrations/2026_08_12_000000_add_publisher_shadow_and_lease_fields.php',
    '*/server-overrides/database/migrations/2026_08_13_000000_promote_verified_publisher_platforms.php',
    '*/server-overrides/database/migrations/2026_08_13_001000_harden_article_distribution_idempotency.php',
    '*/server-overrides/database/migrations/2026_08_15_000000_add_publisher_profile_lease_index.php',
    '*/server-overrides/database/migrations/2026_08_15_010000_add_publisher_account_group_source_fields.php'
)) {
    Assert-ZipHas -Entries $entries -Pattern $pattern
}

foreach ($pattern in @(
    '*/.env',
    '*/node_modules/*',
    '*/vendor/*',
    '*/storage/*',
    '*/.data/*',
    '*/logs/*',
    '*/tmp/*',
    '*/temp/*',
    '*.log',
    '*.tmp'
)) {
    Assert-ZipLacks -Entries $entries -Pattern $pattern
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedPackage)
try {
    $installerEntry = $archive.Entries | Where-Object {
        ($_.FullName -replace '\\', '/') -like '*/deployment/install-geoflow-overrides.sh'
    } | Select-Object -First 1
    Assert-Condition ($null -ne $installerEntry) 'install-geoflow-overrides.sh not found in server package.'
    $reader = [IO.StreamReader]::new($installerEntry.Open())
    try {
        $installerText = $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
    Assert-Condition ($installerText -like '*--dry-run*') 'Server installer in package is missing --dry-run support.'
    Assert-Condition ($installerText -like '*No files were copied and no artisan command was executed*') 'Server installer dry-run safety message is missing.'

    $contractEntry = $archive.Entries | Where-Object {
        ($_.FullName -replace '\\', '/') -like '*/deployment/check-publisher-automation-contract.ps1'
    } | Select-Object -First 1
    Assert-Condition ($null -ne $contractEntry) 'check-publisher-automation-contract.ps1 not found in server package.'
    $reader = [IO.StreamReader]::new($contractEntry.Open())
    try {
        $contractText = $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
    Assert-Condition ($contractText -like '*Publisher automation contract: PASS*') 'Publisher contract success marker is missing.'
    Assert-Condition ($contractText -like '*2026_08_15_000000_add_publisher_profile_lease_index.php*') 'Publisher contract is missing the profile lease migration.'
    Assert-Condition ($contractText -like '*2026_08_15_010000_add_publisher_account_group_source_fields.php*') 'Publisher contract is missing the account-group source migration.'
    Assert-Condition ($contractText -like '*PublisherDeviceCredential.php*') 'Publisher contract is missing device credential hardening.'

    $verifierEntry = $archive.Entries | Where-Object {
        ($_.FullName -replace '\\', '/') -like '*/deployment/verify-geoflow-overrides.sh'
    } | Select-Object -First 1
    Assert-Condition ($null -ne $verifierEntry) 'verify-geoflow-overrides.sh not found in server package.'
    $reader = [IO.StreamReader]::new($verifierEntry.Open())
    try {
        $verifierText = $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
    Assert-Condition ($verifierText -like '*--base-url*') 'Server verifier in package is missing --base-url support.'
    Assert-Condition ($verifierText -like '*Tongzhuo GEOFlow override verification passed*') 'Server verifier success message is missing.'
    Assert-Condition ($verifierText -like '*customer-projects*') 'Server verifier in package is missing customer project checks.'
    Assert-Condition ($verifierText -like '*geo-growth*') 'Server verifier in package is missing GEO growth checks.'
    Assert-Condition ($verifierText -like '*tongzhuo-cms*') 'Server verifier in package is missing CMS checks.'
    Assert-Condition ($verifierText -like '*publisher:reconcile*') 'Server verifier in package is missing publisher reconcile checks.'
    Assert-Condition ($verifierText -like '*schedule:list*') 'Server verifier in package is missing scheduler checks.'
    Assert-Condition ($verifierText -like '*devices/{device}/events*') 'Server verifier in package is missing SSE route checks.'
    Assert-Condition ($verifierText -like '*devices/{device}/commands*') 'Server verifier in package is missing device command route checks.'
    Assert-Condition ($verifierText -like '*2026_08_15_000000_add_publisher_profile_lease_index.php*') 'Server verifier in package is missing the profile lease migration check.'
    Assert-Condition ($verifierText -like '*2026_08_15_010000_add_publisher_account_group_source_fields.php*') 'Server verifier in package is missing the account-group source migration check.'

    $smokeEntry = $archive.Entries | Where-Object {
        ($_.FullName -replace '\\', '/') -like '*/deployment/smoke-geoflow-workbench.sh'
    } | Select-Object -First 1
    Assert-Condition ($null -ne $smokeEntry) 'smoke-geoflow-workbench.sh not found in server package.'
    $reader = [IO.StreamReader]::new($smokeEntry.Open())
    try {
        $smokeText = $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
    Assert-Condition ($smokeText -like '*Manual acceptance checklist after login*') 'Server smoke test is missing manual acceptance checklist.'
    Assert-Condition ($smokeText -like '*customer-projects*') 'Server smoke test is missing customer project checks.'
    Assert-Condition ($smokeText -like '*geo-growth*') 'Server smoke test is missing GEO growth checks.'
    Assert-Condition ($smokeText -like '*tongzhuo-cms*') 'Server smoke test is missing CMS checks.'
} finally {
    $archive.Dispose()
}

Write-Host "GEOFlow server package validation passed: $resolvedPackage"
