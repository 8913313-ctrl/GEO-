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
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-release-notes-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    $releaseSlug = "fixture-client-tongzhuo-geo-delivery-v$version"
    $deliveryPackagePath = Join-Path $testRoot "$releaseSlug.zip"
    $validationReportPath = Join-Path $testRoot "$releaseSlug-validation.json"
    $manifestPath = Join-Path $testRoot "$releaseSlug-manifest.json"
    $archiveIndexPath = Join-Path $testRoot "$releaseSlug-archive-index.json"
    $notesPath = Join-Path $testRoot "$releaseSlug-DELIVERY-RELEASE-NOTES.md"
    $notesJsonPath = Join-Path $testRoot "$releaseSlug-DELIVERY-RELEASE-NOTES.json"

    Set-Content -LiteralPath $deliveryPackagePath -Value 'customer delivery package fixture' -Encoding UTF8
    $deliveryItem = Get-Item -LiteralPath $deliveryPackagePath
    $deliveryHash = (Get-FileHash -LiteralPath $deliveryPackagePath -Algorithm SHA256).Hash.ToLowerInvariant()

    $validationReport = [ordered]@{
        product = [string] $product.product
        version = $version
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        status = 'passed'
        checks = @(
            [ordered]@{ name = 'customer_config_validation'; status = 'passed'; duration_seconds = 0.1 },
            [ordered]@{ name = 'customer_delivery_generation'; status = 'passed'; duration_seconds = 0.2 },
            [ordered]@{ name = 'customer_delivery_package_validation'; status = 'passed'; duration_seconds = 0.3 }
        )
    }
    $validationReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $validationReportPath -Encoding UTF8

    $manifest = [ordered]@{
        product = [string] $product.product
        version = $version
        release_slug = $releaseSlug
        customer_slug = 'fixture-client'
        company_name = 'Fixture Client Network Technology Co Ltd'
        short_name = 'Fixture Client'
        site_url = 'https://fixture.example.com'
        geoflow_base_url = 'https://flow.fixture.example.com'
        publisher_port = 18180
        desktop_agent_port = 18280
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        delivery_package = [ordered]@{
            path = $deliveryPackagePath
            file = Split-Path $deliveryPackagePath -Leaf
            sha256 = $deliveryHash
            bytes = [int64] $deliveryItem.Length
        }
        evidence = [ordered]@{
            validation_report = Split-Path $validationReportPath -Leaf
            archive_index = Split-Path $archiveIndexPath -Leaf
        }
        gates = [ordered]@{
            customer_config_validation = $true
            customer_delivery_generation = $true
            customer_delivery_package_validation = $true
            excludes_customer_api_token = $true
            excludes_platform_credentials = $true
            excludes_browser_profiles = $true
            excludes_node_modules = $true
        }
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $archiveIndex = [ordered]@{
        index_type = 'tongzhuo_customer_project_archive'
        product = [string] $product.product
        version = $version
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        release_slug = $releaseSlug
        customer = [ordered]@{
            slug = 'fixture-client'
            company_name = 'Fixture Client Network Technology Co Ltd'
            short_name = 'Fixture Client'
            site_url = 'https://fixture.example.com'
            geoflow_base_url = 'https://flow.fixture.example.com'
            publisher_port = 18180
            desktop_agent_port = 18280
        }
        endpoints = [ordered]@{
            website = 'https://fixture.example.com'
            geoflow_admin = 'https://flow.fixture.example.com/geo_admin'
            publisher_assistant = 'https://flow.fixture.example.com/geo_admin/publisher-assistant'
            contact_leads = 'https://flow.fixture.example.com/geo_admin/contact-leads'
            llms_txt = 'https://fixture.example.com/llms.txt'
            sitemap = 'https://fixture.example.com/sitemap.xml'
            feed = 'https://fixture.example.com/feed.xml'
            desktop_health = 'http://127.0.0.1:18280/healthz'
        }
        artifacts = @(
            [ordered]@{ role = 'customer_delivery_package'; audience = 'customer_handoff'; file = Split-Path $deliveryPackagePath -Leaf; sha256 = $deliveryHash; bytes = [int64] $deliveryItem.Length },
            [ordered]@{ role = 'release_validation_report'; audience = 'internal_delivery'; file = Split-Path $validationReportPath -Leaf; sha256 = 'fixture-validation-hash'; bytes = 10 },
            [ordered]@{ role = 'release_manifest'; audience = 'internal_delivery'; file = Split-Path $manifestPath -Leaf; sha256 = 'fixture-manifest-hash'; bytes = 10 },
            [ordered]@{ role = 'checksum'; audience = 'customer_handoff'; file = "$releaseSlug.sha256"; sha256 = 'fixture-checksum-hash'; bytes = 10 },
            [ordered]@{ role = 'release_summary'; audience = 'customer_handoff'; file = "$releaseSlug-DELIVERY-RELEASE-SUMMARY.md"; sha256 = 'fixture-summary-hash'; bytes = 10 }
        )
        acceptance = [ordered]@{
            verify_delivery = '.\Start-CustomerDelivery.ps1 -Action Verify'
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            onboarding_kit = '.\Start-CustomerDelivery.ps1 -Action OnboardingKit'
            operating_plan = '.\Start-CustomerDelivery.ps1 -Action OperatingPlan'
            sales_kit = '.\Start-CustomerDelivery.ps1 -Action SalesKit'
            success_review = '.\Start-CustomerDelivery.ps1 -Action SuccessReview'
            service_scope = '.\Start-CustomerDelivery.ps1 -Action ServiceScope'
            product_manual = '.\Start-CustomerDelivery.ps1 -Action ProductManual'
            operator_quickstart = '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart'
            go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            operations_evidence_pack = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            server_dry_run = '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
            server_verify = '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
            upgrade_plan = '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>'
        }
        support_boundary = [ordered]@{
            customer_api_token_excluded = $true
            platform_credentials_stay_local = $true
            browser_profiles_excluded = $true
            server_passwords_excluded = $true
        }
    }
    $archiveIndex | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $archiveIndexPath -Encoding UTF8

    $resultJson = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryReleaseNotes.ps1') `
        -ReleaseManifestPath $manifestPath `
        -ValidationReportPath $validationReportPath `
        -ArchiveIndexPath $archiveIndexPath `
        -OutputPath $notesPath `
        -JsonOutputPath $notesJsonPath
    $result = $resultJson | ConvertFrom-Json

    Assert-Condition ([string] $result.status -eq 'created') "Customer delivery release notes status mismatch: $($result.status)"
    Assert-Condition (Test-Path $notesPath) 'Customer delivery release notes Markdown was not created.'
    Assert-Condition (Test-Path $notesJsonPath) 'Customer delivery release notes JSON was not created.'

    $notes = Get-Content -LiteralPath $notesJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $notes.notes_type -eq 'tongzhuo_customer_delivery_release_notes') "Customer delivery release notes type mismatch: $($notes.notes_type)"
    Assert-Condition ([string] $notes.version -eq $version) "Customer delivery release notes version mismatch. Expected $version, got $($notes.version)"
    Assert-Condition ([string] $notes.customer.slug -eq 'fixture-client') 'Customer delivery release notes should include customer slug.'
    Assert-Condition ([string] $notes.endpoints.llms_txt -eq 'https://fixture.example.com/llms.txt') 'Customer delivery release notes should include AI endpoint.'
    Assert-Condition (@($notes.validation.checks).Count -eq 3) 'Customer delivery release notes should include validation checks.'
    Assert-Condition (@($notes.component_artifacts).Count -eq 5) 'Customer delivery release notes should include component artifact integrity.'
    Assert-Condition ([string] $notes.acceptance.preflight_report -like '*PreflightReport*') 'Customer delivery release notes should include preflight report command.'
    Assert-Condition ([string] $notes.acceptance.onboarding_kit -like '*OnboardingKit*') 'Customer delivery release notes should include onboarding kit command.'
    Assert-Condition ([string] $notes.acceptance.operating_plan -like '*OperatingPlan*') 'Customer delivery release notes should include operating plan command.'
    Assert-Condition ([string] $notes.acceptance.sales_kit -like '*SalesKit*') 'Customer delivery release notes should include sales kit command.'
    Assert-Condition ([string] $notes.acceptance.success_review -like '*SuccessReview*') 'Customer delivery release notes should include success review command.'
    Assert-Condition ([string] $notes.acceptance.service_scope -like '*ServiceScope*') 'Customer delivery release notes should include service scope command.'
    Assert-Condition ([string] $notes.acceptance.product_manual -like '*ProductManual*') 'Customer delivery release notes should include product manual command.'
    Assert-Condition ([string] $notes.acceptance.operator_quickstart -like '*OperatorQuickstart*') 'Customer delivery release notes should include operator quickstart command.'
    Assert-Condition ([string] $notes.acceptance.go_live_checklist -like '*GoLiveChecklist*') 'Customer delivery release notes should include go-live checklist command.'
    Assert-Condition ([string] $notes.acceptance.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Customer delivery release notes should include publishing loop acceptance command.'
    Assert-Condition ([string] $notes.acceptance.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Customer delivery release notes should include publishing loop dry-run command.'
    Assert-Condition ([string] $notes.acceptance.operations_evidence_pack -like '*OperationsEvidencePack*') 'Customer delivery release notes should include operations evidence pack command.'
    Assert-Condition ([string] $notes.acceptance.support_bundle -like '*SupportBundle*') 'Customer delivery release notes should include support bundle command.'
    Assert-Condition ([bool] $notes.support_boundary.platform_credentials_stay_local) 'Customer delivery release notes should declare platform credential boundary.'
    Assert-Condition ([bool] $notes.support_boundary.public_website_prices_excluded) 'Customer delivery release notes should declare public website price exclusion.'

    $markdown = Get-Content -LiteralPath $notesPath -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*## Customer Endpoints*') 'Customer delivery release notes Markdown is missing customer endpoints.'
    Assert-Condition ($markdown -like '*## Acceptance Commands*') 'Customer delivery release notes Markdown is missing acceptance commands.'
    Assert-Condition ($markdown -like '*PreflightReport*') 'Customer delivery release notes Markdown is missing preflight report command.'
    Assert-Condition ($markdown -like '*OnboardingKit*') 'Customer delivery release notes Markdown is missing onboarding kit command.'
    Assert-Condition ($markdown -like '*OperatingPlan*') 'Customer delivery release notes Markdown is missing operating plan command.'
    Assert-Condition ($markdown -like '*SalesKit*') 'Customer delivery release notes Markdown is missing sales kit command.'
    Assert-Condition ($markdown -like '*SuccessReview*') 'Customer delivery release notes Markdown is missing success review command.'
    Assert-Condition ($markdown -like '*ServiceScope*') 'Customer delivery release notes Markdown is missing service scope command.'
    Assert-Condition ($markdown -like '*ProductManual*') 'Customer delivery release notes Markdown is missing product manual command.'
    Assert-Condition ($markdown -like '*OperatorQuickstart*') 'Customer delivery release notes Markdown is missing operator quickstart command.'
    Assert-Condition ($markdown -like '*GoLiveChecklist*') 'Customer delivery release notes Markdown is missing go-live checklist command.'
    Assert-Condition ($markdown -like '*PublishingLoopAcceptance*') 'Customer delivery release notes Markdown is missing publishing loop acceptance command.'
    Assert-Condition ($markdown -like '*PublishingLoopDryRun*') 'Customer delivery release notes Markdown is missing publishing loop dry-run command.'
    Assert-Condition ($markdown -like '*OperationsEvidencePack*') 'Customer delivery release notes Markdown is missing operations evidence pack command.'
    Assert-Condition ($markdown -like '*platform credentials*') 'Customer delivery release notes Markdown is missing platform credential boundary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer delivery release notes validation passed.'
