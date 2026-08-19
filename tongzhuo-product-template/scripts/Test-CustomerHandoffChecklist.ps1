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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-handoff-checklist-' + [guid]::NewGuid().ToString('N'))

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

    $releaseSlug = "handoff-client-tongzhuo-geo-delivery-v$version"
    $deliveryPackagePath = Join-Path $testRoot "$releaseSlug.zip"
    $validationReportPath = Join-Path $testRoot "$releaseSlug-validation.json"
    $manifestPath = Join-Path $testRoot "$releaseSlug-manifest.json"
    $configReviewPath = Join-Path $testRoot "$releaseSlug-CONFIG-REVIEW.json"
    $archiveIndexPath = Join-Path $testRoot "$releaseSlug-archive-index.json"
    $checklistPath = Join-Path $testRoot "$releaseSlug-HANDOFF-CHECKLIST.md"
    $checklistJsonPath = Join-Path $testRoot "$releaseSlug-HANDOFF-CHECKLIST.json"

    Set-Content -LiteralPath $deliveryPackagePath -Value 'handoff delivery package fixture' -Encoding UTF8
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

    $configReview = [ordered]@{
        review_type = 'tongzhuo_customer_config_review'
        status = 'ready_with_warnings'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        customer = [ordered]@{
            slug = 'handoff-client'
            company_name = 'Handoff Client Network Technology Co Ltd'
            short_name = 'Handoff Client'
        }
        endpoints = [ordered]@{
            website = 'https://handoff.example.com'
            desktop_health = 'http://127.0.0.1:19380/healthz'
        }
        validation = [ordered]@{
            api_token_empty = $true
        }
        warnings = @(
            [ordered]@{ code = 'missing_email'; message = 'website.email is empty.' }
        )
    }
    $configReview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configReviewPath -Encoding UTF8

    $archiveIndex = [ordered]@{
        index_type = 'tongzhuo_customer_project_archive'
        product = [string] $product.product
        version = $version
        release_slug = $releaseSlug
        customer = [ordered]@{
            slug = 'handoff-client'
            company_name = 'Handoff Client Network Technology Co Ltd'
            site_url = 'https://handoff.example.com'
            geoflow_base_url = 'https://flow.handoff.example.com'
        }
        endpoints = [ordered]@{
            website = 'https://handoff.example.com'
            geoflow_admin = 'https://flow.handoff.example.com/geo_admin'
            publisher_assistant = 'https://flow.handoff.example.com/geo_admin/publisher-assistant'
            contact_leads = 'https://flow.handoff.example.com/geo_admin/contact-leads'
            llms_txt = 'https://handoff.example.com/llms.txt'
            sitemap = 'https://handoff.example.com/sitemap.xml'
            feed = 'https://handoff.example.com/feed.xml'
            desktop_health = 'http://127.0.0.1:19380/healthz'
        }
        artifacts = @()
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
    }
    $archiveIndex | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $archiveIndexPath -Encoding UTF8

    $manifest = [ordered]@{
        product = [string] $product.product
        version = $version
        release_slug = $releaseSlug
        customer_slug = 'handoff-client'
        company_name = 'Handoff Client Network Technology Co Ltd'
        short_name = 'Handoff Client'
        site_url = 'https://handoff.example.com'
        geoflow_base_url = 'https://flow.handoff.example.com'
        publisher_port = 19180
        desktop_agent_port = 19380
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        delivery_package = [ordered]@{
            path = $deliveryPackagePath
            file = Split-Path $deliveryPackagePath -Leaf
            sha256 = $deliveryHash
            bytes = [int64] $deliveryItem.Length
        }
        evidence = [ordered]@{
            validation_report = Split-Path $validationReportPath -Leaf
            config_review_json = Split-Path $configReviewPath -Leaf
            archive_index = Split-Path $archiveIndexPath -Leaf
        }
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $resultJson = & (Join-Path $rootPath 'scripts\New-CustomerHandoffChecklist.ps1') `
        -ReleaseManifestPath $manifestPath `
        -ValidationReportPath $validationReportPath `
        -ConfigReviewJsonPath $configReviewPath `
        -ArchiveIndexPath $archiveIndexPath `
        -OutputPath $checklistPath `
        -JsonOutputPath $checklistJsonPath
    $result = $resultJson | ConvertFrom-Json

    Assert-Condition ([string] $result.status -eq 'created') "Handoff checklist status mismatch: $($result.status)"
    Assert-Condition (Test-Path $checklistPath) 'Handoff checklist Markdown was not created.'
    Assert-Condition (Test-Path $checklistJsonPath) 'Handoff checklist JSON was not created.'

    $checklist = Get-Content -LiteralPath $checklistJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $checklist.checklist_type -eq 'tongzhuo_customer_handoff_checklist') "Handoff checklist type mismatch: $($checklist.checklist_type)"
    Assert-Condition ([string] $checklist.status -eq 'ready_for_signoff') "Handoff checklist status mismatch: $($checklist.status)"
    Assert-Condition (@($checklist.required_files).Count -eq 5) 'Handoff checklist should include five required files.'
    Assert-Condition (@($checklist.signoff_sections).Count -ge 5) 'Handoff checklist should include signoff sections.'
    Assert-Condition ([bool] $checklist.security_boundary.customer_api_tokens_excluded) 'Handoff checklist should declare API Token exclusion.'
    Assert-Condition ([string] $checklist.acceptance_commands.preflight_report -like '*PreflightReport*') 'Handoff checklist should include preflight report command.'
    Assert-Condition ([string] $checklist.acceptance_commands.onboarding_kit -like '*OnboardingKit*') 'Handoff checklist should include onboarding kit command.'
    Assert-Condition ([string] $checklist.acceptance_commands.operating_plan -like '*OperatingPlan*') 'Handoff checklist should include operating plan command.'
    Assert-Condition ([string] $checklist.acceptance_commands.sales_kit -like '*SalesKit*') 'Handoff checklist should include sales kit command.'
    Assert-Condition ([string] $checklist.acceptance_commands.success_review -like '*SuccessReview*') 'Handoff checklist should include success review command.'
    Assert-Condition ([string] $checklist.acceptance_commands.service_scope -like '*ServiceScope*') 'Handoff checklist should include service scope command.'
    Assert-Condition ([string] $checklist.acceptance_commands.product_manual -like '*ProductManual*') 'Handoff checklist should include product manual command.'
    Assert-Condition ([string] $checklist.acceptance_commands.operator_quickstart -like '*OperatorQuickstart*') 'Handoff checklist should include operator quickstart command.'
    Assert-Condition ([string] $checklist.acceptance_commands.go_live_checklist -like '*GoLiveChecklist*') 'Handoff checklist should include go-live checklist command.'
    Assert-Condition ([string] $checklist.acceptance_commands.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Handoff checklist should include publishing loop acceptance command.'
    Assert-Condition ([string] $checklist.acceptance_commands.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Handoff checklist should include publishing loop dry-run command.'
    Assert-Condition ([string] $checklist.acceptance_commands.operations_evidence_pack -like '*OperationsEvidencePack*') 'Handoff checklist should include operations evidence pack command.'
    Assert-Condition ([string] $checklist.acceptance_commands.support_bundle -like '*SupportBundle*') 'Handoff checklist should include support bundle command.'

    $markdown = Get-Content -LiteralPath $checklistPath -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*## Signoff*') 'Handoff checklist Markdown is missing Signoff section.'
    Assert-Condition ($markdown -like '*PreflightReport*') 'Handoff checklist Markdown should include preflight report command.'
    Assert-Condition ($markdown -like '*OnboardingKit*') 'Handoff checklist Markdown should include onboarding kit command.'
    Assert-Condition ($markdown -like '*OperatingPlan*') 'Handoff checklist Markdown should include operating plan command.'
    Assert-Condition ($markdown -like '*SalesKit*') 'Handoff checklist Markdown should include sales kit command.'
    Assert-Condition ($markdown -like '*SuccessReview*') 'Handoff checklist Markdown should include success review command.'
    Assert-Condition ($markdown -like '*ServiceScope*') 'Handoff checklist Markdown should include service scope command.'
    Assert-Condition ($markdown -like '*ProductManual*') 'Handoff checklist Markdown should include product manual command.'
    Assert-Condition ($markdown -like '*OperatorQuickstart*') 'Handoff checklist Markdown should include operator quickstart command.'
    Assert-Condition ($markdown -like '*GoLiveChecklist*') 'Handoff checklist Markdown should include go-live checklist command.'
    Assert-Condition ($markdown -like '*PublishingLoopAcceptance*') 'Handoff checklist Markdown should include publishing loop acceptance command.'
    Assert-Condition ($markdown -like '*PublishingLoopDryRun*') 'Handoff checklist Markdown should include publishing loop dry-run command.'
    Assert-Condition ($markdown -like '*OperationsEvidencePack*') 'Handoff checklist Markdown should include operations evidence pack command.'
    Assert-Condition ($markdown -like '*missing_email*') 'Handoff checklist Markdown should include config review warning.'
    Assert-Condition ($markdown -like '*Customer API Tokens are not included*') 'Handoff checklist Markdown should include security boundary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer handoff checklist validation passed.'
