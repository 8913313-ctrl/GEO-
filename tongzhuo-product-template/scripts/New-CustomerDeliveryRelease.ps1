[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ConfigPath,
    [string]$Root = '',
    [string]$OutputRoot = '',
    [string]$ReleaseSlug = '',
    [switch]$Force,
    [switch]$KeepCustomerRoot,
    [string]$CustomerOutputRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$resolvedConfig = (Resolve-Path $ConfigPath).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version
$gitCommit = ''
$gitDirty = $null
try {
    $gitCommit = [string] (& git -C $rootPath rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitCommit)) {
        $gitStatus = @(& git -C $rootPath status --porcelain --untracked-files=normal 2>$null)
        $gitDirty = ($LASTEXITCODE -ne 0) -or ($gitStatus.Count -gt 0)
    } else { $gitCommit = '' }
} catch { $gitCommit = '' }
$global:LASTEXITCODE = 0

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $rootPath 'dist\customer-releases'
}
$resolvedOutputRoot = [IO.Path]::GetFullPath($OutputRoot)
New-Item -ItemType Directory -Force -Path $resolvedOutputRoot | Out-Null

$runRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-release-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
$validationReport = $null

$report = [ordered]@{
    product = [string] $product.product
    version = $version
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    config_path = $resolvedConfig
    status = 'running'
    customer_slug = $null
    customer_root = $null
    artifacts = [ordered]@{}
    checks = @()
}

function Invoke-DeliveryReleaseStep {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [scriptblock]$Script
    )

    $started = Get-Date
    $step = [ordered]@{
        name = $Name
        status = 'running'
        started_at = $started.ToUniversalTime().ToString('o')
        finished_at = $null
        duration_seconds = $null
        error = $null
    }
    $report.checks += $step
    try {
        & $Script
        $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
        if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int] $exitCodeVariable.Value -ne 0) {
            throw "$Name failed with exit code $($exitCodeVariable.Value)"
        }
        $step.status = 'passed'
    } catch {
        $step.status = 'failed'
        $step.error = [string] $_.Exception.Message
        $report.status = 'failed'
        throw
    } finally {
        $finished = Get-Date
        $step.finished_at = $finished.ToUniversalTime().ToString('o')
        $step.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
    }
}

function Get-SafeSlug {
    param([Parameter(Mandatory = $true)] [string]$Value)

    $safe = ($Value -replace '[^a-zA-Z0-9._-]', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($safe)) {
        throw 'Release slug resolved to an empty value.'
    }
    return $safe
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)] [object]$Value,
        [Parameter(Mandatory = $true)] [string]$Path
    )

    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

try {
    $validatedConfig = $null
    Invoke-DeliveryReleaseStep -Name 'customer_config_validation' -Script {
        $validatedConfigJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedConfig
        $script:validatedConfig = $validatedConfigJson | ConvertFrom-Json
        $report.customer_slug = [string] $script:validatedConfig.customer_slug
    }

    $customerSlug = [string] $validatedConfig.customer_slug
    if ([string]::IsNullOrWhiteSpace($ReleaseSlug)) {
        $ReleaseSlug = "$customerSlug-tongzhuo-geo-delivery-v$version"
    }
    $safeReleaseSlug = Get-SafeSlug -Value $ReleaseSlug

    $deliveryZip = Join-Path $resolvedOutputRoot "$safeReleaseSlug.zip"
    $validationReport = Join-Path $resolvedOutputRoot "$safeReleaseSlug-validation.json"
    $checksumFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug.sha256"
    $manifestFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-manifest.json"
    $configReviewFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-CONFIG-REVIEW.md"
    $configReviewJsonFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-CONFIG-REVIEW.json"
    $summaryFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-DELIVERY-RELEASE-SUMMARY.md"
    $releaseNotesFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-DELIVERY-RELEASE-NOTES.md"
    $releaseNotesJsonFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-DELIVERY-RELEASE-NOTES.json"
    $handoffChecklistFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-HANDOFF-CHECKLIST.md"
    $handoffChecklistJsonFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-HANDOFF-CHECKLIST.json"
    $firstTwoStagesPilotFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-FIRST-TWO-STAGES-PILOT.md"
    $firstTwoStagesPilotJsonFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-FIRST-TWO-STAGES-PILOT.json"
    $archiveIndexFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-archive-index.json"
    $archiveIndexMarkdownFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-archive-index.md"

    foreach ($path in @($deliveryZip, $validationReport, $checksumFile, $manifestFile, $configReviewFile, $configReviewJsonFile, $summaryFile, $releaseNotesFile, $releaseNotesJsonFile, $handoffChecklistFile, $handoffChecklistJsonFile, $firstTwoStagesPilotFile, $firstTwoStagesPilotJsonFile, $archiveIndexFile, $archiveIndexMarkdownFile)) {
        if ((Test-Path $path) -and -not $Force) {
            throw "Customer delivery release artifact already exists: $path. Use -Force to replace it."
        }
    }
    foreach ($path in @($deliveryZip, $validationReport, $checksumFile, $manifestFile, $configReviewFile, $configReviewJsonFile, $summaryFile, $releaseNotesFile, $releaseNotesJsonFile, $handoffChecklistFile, $handoffChecklistJsonFile, $firstTwoStagesPilotFile, $firstTwoStagesPilotJsonFile, $archiveIndexFile, $archiveIndexMarkdownFile)) {
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    if ($KeepCustomerRoot) {
        if ([string]::IsNullOrWhiteSpace($CustomerOutputRoot)) {
            $CustomerOutputRoot = Join-Path $resolvedOutputRoot "$safeReleaseSlug-customer-instance"
        }
        $customerGenerationRoot = [IO.Path]::GetFullPath($CustomerOutputRoot)
        New-Item -ItemType Directory -Force -Path $customerGenerationRoot | Out-Null
    } else {
        $customerGenerationRoot = Join-Path $runRoot 'customer-instance'
    }

    Invoke-DeliveryReleaseStep -Name 'customer_delivery_generation' -Script {
        $deliveryResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryFromConfig.ps1') `
            -ConfigPath $resolvedConfig `
            -OutputRoot $customerGenerationRoot `
            -DeliveryOutputPath $deliveryZip `
            -Force
        $deliveryResult = $deliveryResultJson | ConvertFrom-Json
        $report.customer_root = [string] $deliveryResult.customer_root
        $report.artifacts.delivery_package = [ordered]@{
            path = $deliveryZip
            generated = Test-Path $deliveryZip
        }
    }

    Invoke-DeliveryReleaseStep -Name 'customer_delivery_package_validation' -Script {
        & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryPackage.ps1') -PackagePath $deliveryZip -ExpectedVersion $version
    }

    $deliveryItem = Get-Item -LiteralPath $deliveryZip
    $deliveryHash = (Get-FileHash -LiteralPath $deliveryZip -Algorithm SHA256).Hash.ToLowerInvariant()
    $checksumLine = "$deliveryHash  $(Split-Path $deliveryZip -Leaf)"
    Set-Content -LiteralPath $checksumFile -Value $checksumLine -Encoding ASCII

    $configReviewResultJson = & (Join-Path $rootPath 'scripts\New-CustomerConfigReview.ps1') `
        -Root $rootPath `
        -ConfigPath $resolvedConfig `
        -OutputPath $configReviewFile `
        -JsonOutputPath $configReviewJsonFile
    $configReviewResult = $configReviewResultJson | ConvertFrom-Json
    if ([string] $configReviewResult.status -ne 'created') {
        throw "Customer config review was not created. Status: $($configReviewResult.status)"
    }

    $releaseManifest = [ordered]@{
        product = [string] $product.product
        version = $version
        release_slug = $safeReleaseSlug
        customer_slug = $customerSlug
        project_id = [string] $validatedConfig.project_id
        tenant_id = [string] $validatedConfig.tenant_id
        industry_template = [string] $validatedConfig.industry_template
        company_name = [string] $validatedConfig.company_name
        short_name = [string] $validatedConfig.short_name
        site_url = [string] $validatedConfig.site_url
        geoflow_base_url = [string] $validatedConfig.geoflow_base_url
        publisher_port = [int] $validatedConfig.publisher_port
        desktop_agent_port = [int] $validatedConfig.desktop_agent_port
        generated_at = $report.generated_at
        source_control = [ordered]@{
            git_commit = $gitCommit
            working_tree_dirty = $gitDirty
        }
        methodology = [ordered]@{
            core_version = 'MVER-GEO-CORE-V1'
            prompt_version = 'PVER-GEO-ARTICLE-V1'
            quality_rule_pack = 'QRULE-GEO-CONTENT-V1'
        }
        delivery_package = [ordered]@{
            path = $deliveryZip
            file = Split-Path $deliveryZip -Leaf
            sha256 = $deliveryHash
            bytes = [int64] $deliveryItem.Length
        }
        evidence = [ordered]@{
            validation_report = Split-Path $validationReport -Leaf
            checksum_file = Split-Path $checksumFile -Leaf
            config_review = Split-Path $configReviewFile -Leaf
            config_review_json = Split-Path $configReviewJsonFile -Leaf
            summary_file = Split-Path $summaryFile -Leaf
            release_notes = Split-Path $releaseNotesFile -Leaf
            release_notes_json = Split-Path $releaseNotesJsonFile -Leaf
            handoff_checklist = Split-Path $handoffChecklistFile -Leaf
            handoff_checklist_json = Split-Path $handoffChecklistJsonFile -Leaf
            first_two_stages_pilot_checklist = Split-Path $firstTwoStagesPilotFile -Leaf
            first_two_stages_pilot_checklist_json = Split-Path $firstTwoStagesPilotJsonFile -Leaf
            archive_index = Split-Path $archiveIndexFile -Leaf
            archive_index_markdown = Split-Path $archiveIndexMarkdownFile -Leaf
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
    Write-JsonFile -Value $releaseManifest -Path $manifestFile

    $report.status = 'passed'
    $report.artifacts.delivery_package = [ordered]@{
        path = $deliveryZip
        sha256 = $deliveryHash
        bytes = [int64] $deliveryItem.Length
    }
    $report.artifacts.checksum_file = [ordered]@{
        path = $checksumFile
        bytes = [int64] (Get-Item -LiteralPath $checksumFile).Length
    }
    $report.artifacts.release_manifest = [ordered]@{
        path = $manifestFile
        bytes = [int64] (Get-Item -LiteralPath $manifestFile).Length
    }
    Write-JsonFile -Value $report -Path $validationReport

    $checkRows = @($report.checks | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.duration_seconds) |"
    })
    $summaryLines = @(
        "# $safeReleaseSlug Customer Delivery Release Summary",
        '',
        "Product: $($releaseManifest.product)",
        "Version: $version",
        "Customer: $($releaseManifest.company_name)",
        "Customer slug: $customerSlug",
        "Website: $($releaseManifest.site_url)",
        "GEOFlow: $($releaseManifest.geoflow_base_url)",
        "Generated at: $($report.generated_at)",
        '',
        '## Artifacts',
        '',
        '| File | Bytes | SHA256 |',
        '| --- | ---: | --- |',
        "| $(Split-Path $deliveryZip -Leaf) | $($deliveryItem.Length) | $deliveryHash |",
        "| $(Split-Path $validationReport -Leaf) | $((Get-Item -LiteralPath $validationReport).Length) |  |",
        "| $(Split-Path $manifestFile -Leaf) | $((Get-Item -LiteralPath $manifestFile).Length) |  |",
        "| $(Split-Path $checksumFile -Leaf) | $((Get-Item -LiteralPath $checksumFile).Length) |  |",
        '',
        '## Validation Checks',
        '',
        '| Check | Status | Seconds |',
        '| --- | --- | ---: |'
    ) + $checkRows + @(
        '',
        '## Verification',
        '',
        'Before handoff, recalculate SHA256 for the customer delivery zip and compare it with the .sha256 file.',
        '',
        'After extracting the customer delivery zip, run:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '```',
        '',
        '## Security Boundary',
        '',
        'This release does not include customer API tokens, third-party platform passwords, cookies, browser profiles, node_modules, logs, or temporary files. Platform login remains on the local operator computer.'
    )
    Set-Content -LiteralPath $summaryFile -Value ($summaryLines -join [Environment]::NewLine) -Encoding UTF8

    $deploymentProfileExtractRoot = Join-Path $runRoot 'deployment-profile-extract'
    if (Test-Path $deploymentProfileExtractRoot) {
        Remove-Item -LiteralPath $deploymentProfileExtractRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $deploymentProfileExtractRoot | Out-Null
    Expand-Archive -LiteralPath $deliveryZip -DestinationPath $deploymentProfileExtractRoot -Force
    $deploymentProfilePath = Get-ChildItem -LiteralPath $deploymentProfileExtractRoot -Recurse -File -Filter 'DEPLOYMENT-PROFILE.json' |
        Select-Object -First 1 |
        ForEach-Object { $_.FullName }
    if ([string]::IsNullOrWhiteSpace($deploymentProfilePath) -or -not (Test-Path $deploymentProfilePath)) {
        throw "Deployment profile not found in delivery package for archive index: $deliveryZip"
    }
    $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json

    function New-ArchiveArtifactRecord {
        param(
            [Parameter(Mandatory = $true)] [string]$Path,
            [Parameter(Mandatory = $true)] [string]$Role,
            [Parameter(Mandatory = $true)] [string]$Audience
        )

        $item = Get-Item -LiteralPath $Path
        return [ordered]@{
            role = $Role
            audience = $Audience
            file = Split-Path $Path -Leaf
            path = $Path
            sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
            bytes = [int64] $item.Length
        }
    }

    $archiveArtifacts = @(
        New-ArchiveArtifactRecord -Path $deliveryZip -Role 'customer_delivery_package' -Audience 'customer_handoff'
        New-ArchiveArtifactRecord -Path $validationReport -Role 'release_validation_report' -Audience 'internal_delivery'
        New-ArchiveArtifactRecord -Path $manifestFile -Role 'release_manifest' -Audience 'internal_delivery'
        New-ArchiveArtifactRecord -Path $configReviewFile -Role 'customer_config_review' -Audience 'implementation_handoff'
        New-ArchiveArtifactRecord -Path $configReviewJsonFile -Role 'customer_config_review_json' -Audience 'implementation_handoff'
        New-ArchiveArtifactRecord -Path $checksumFile -Role 'checksum' -Audience 'customer_handoff'
        New-ArchiveArtifactRecord -Path $summaryFile -Role 'release_summary' -Audience 'customer_handoff'
    )

    $archiveIndex = [ordered]@{
        index_type = 'tongzhuo_customer_project_archive'
        product = [string] $product.product
        version = $version
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        release_slug = $safeReleaseSlug
        customer = [ordered]@{
            slug = $customerSlug
            project_id = [string] $validatedConfig.project_id
            tenant_id = [string] $validatedConfig.tenant_id
            industry_template = [string] $validatedConfig.industry_template
            company_name = [string] $validatedConfig.company_name
            short_name = [string] $validatedConfig.short_name
            site_url = [string] $validatedConfig.site_url
            geoflow_base_url = [string] $validatedConfig.geoflow_base_url
            publisher_port = [int] $validatedConfig.publisher_port
            desktop_agent_port = [int] $validatedConfig.desktop_agent_port
        }
        endpoints = [ordered]@{
            website = [string] $deploymentProfile.endpoints.website_home
            geoflow_admin = [string] $deploymentProfile.endpoints.admin_home
            publisher_assistant = [string] $deploymentProfile.endpoints.publisher_assistant
            contact_leads = [string] $deploymentProfile.endpoints.contact_leads
            llms_txt = [string] $deploymentProfile.endpoints.ai_llms
            sitemap = [string] $deploymentProfile.endpoints.sitemap
            feed = [string] $deploymentProfile.endpoints.rss
            desktop_health = [string] $deploymentProfile.endpoints.desktop_health
        }
        artifacts = $archiveArtifacts
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
        source_control = [ordered]@{ git_commit = $gitCommit; working_tree_dirty = $gitDirty }
        methodology = [ordered]@{ core_version = 'MVER-GEO-CORE-V1'; prompt_version = 'PVER-GEO-ARTICLE-V1'; quality_rule_pack = 'QRULE-GEO-CONTENT-V1' }
    }
    Write-JsonFile -Value $archiveIndex -Path $archiveIndexFile

    $archiveArtifactRows = @($archiveArtifacts | ForEach-Object {
        "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
    })
    $archiveMarkdown = @(
        "# $safeReleaseSlug Project Archive Index",
        '',
        "Product: $($archiveIndex.product)",
        "Version: $version",
        "Customer: $($archiveIndex.customer.company_name)",
        "Customer slug: $customerSlug",
        "Website: $($archiveIndex.customer.site_url)",
        "GEOFlow: $($archiveIndex.customer.geoflow_base_url)",
        "Generated at: $($archiveIndex.generated_at)",
        '',
        '## Customer Endpoints',
        '',
        "- Website: $($archiveIndex.endpoints.website)",
        "- GEOFlow admin: $($archiveIndex.endpoints.geoflow_admin)",
        "- Publisher assistant: $($archiveIndex.endpoints.publisher_assistant)",
        "- Contact leads: $($archiveIndex.endpoints.contact_leads)",
        "- llms.txt: $($archiveIndex.endpoints.llms_txt)",
        "- Sitemap: $($archiveIndex.endpoints.sitemap)",
        "- Feed: $($archiveIndex.endpoints.feed)",
        "- Desktop health: $($archiveIndex.endpoints.desktop_health)",
        '',
        '## Artifacts',
        '',
        '| Role | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $archiveArtifactRows + @(
        '',
        '## Acceptance Commands',
        '',
        '```powershell',
        $archiveIndex.acceptance.verify_delivery,
        $archiveIndex.acceptance.preflight_report,
        $archiveIndex.acceptance.onboarding_kit,
        $archiveIndex.acceptance.operating_plan,
        $archiveIndex.acceptance.sales_kit,
        $archiveIndex.acceptance.success_review,
        $archiveIndex.acceptance.service_scope,
        $archiveIndex.acceptance.product_manual,
        $archiveIndex.acceptance.operator_quickstart,
        $archiveIndex.acceptance.publishing_loop_acceptance,
        $archiveIndex.acceptance.publishing_loop_dry_run,
        $archiveIndex.acceptance.operations_evidence_pack,
        $archiveIndex.acceptance.server_dry_run,
        $archiveIndex.acceptance.server_verify,
        $archiveIndex.acceptance.acceptance_report,
        $archiveIndex.acceptance.support_bundle,
        $archiveIndex.acceptance.upgrade_plan,
        '```',
        '',
        '## Security Boundary',
        '',
        'Customer API tokens, third-party platform credentials, browser profiles, server passwords, node_modules, logs, and temporary runtime files are excluded from the release archive.'
    )
    Set-Content -LiteralPath $archiveIndexMarkdownFile -Value ($archiveMarkdown -join [Environment]::NewLine) -Encoding UTF8

    $handoffChecklistResultJson = & (Join-Path $rootPath 'scripts\New-CustomerHandoffChecklist.ps1') `
        -ReleaseManifestPath $manifestFile `
        -ValidationReportPath $validationReport `
        -ConfigReviewJsonPath $configReviewJsonFile `
        -ArchiveIndexPath $archiveIndexFile `
        -OutputPath $handoffChecklistFile `
        -JsonOutputPath $handoffChecklistJsonFile
    $handoffChecklistResult = $handoffChecklistResultJson | ConvertFrom-Json
    if ([string] $handoffChecklistResult.status -ne 'created') {
        throw "Customer handoff checklist was not created. Status: $($handoffChecklistResult.status)"
    }

    $archiveArtifacts = @($archiveArtifacts) + @(
        New-ArchiveArtifactRecord -Path $handoffChecklistFile -Role 'handoff_checklist' -Audience 'customer_handoff'
        New-ArchiveArtifactRecord -Path $handoffChecklistJsonFile -Role 'handoff_checklist_json' -Audience 'delivery_archive'
    )
    $archiveIndex.artifacts = $archiveArtifacts
    Write-JsonFile -Value $archiveIndex -Path $archiveIndexFile

    $archiveArtifactRows = @($archiveArtifacts | ForEach-Object {
        "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
    })
    $archiveMarkdown = @(
        "# $safeReleaseSlug Project Archive Index",
        '',
        "Product: $($archiveIndex.product)",
        "Version: $version",
        "Customer: $($archiveIndex.customer.company_name)",
        "Customer slug: $customerSlug",
        "Website: $($archiveIndex.customer.site_url)",
        "GEOFlow: $($archiveIndex.customer.geoflow_base_url)",
        "Generated at: $($archiveIndex.generated_at)",
        '',
        '## Customer Endpoints',
        '',
        "- Website: $($archiveIndex.endpoints.website)",
        "- GEOFlow admin: $($archiveIndex.endpoints.geoflow_admin)",
        "- Publisher assistant: $($archiveIndex.endpoints.publisher_assistant)",
        "- Contact leads: $($archiveIndex.endpoints.contact_leads)",
        "- llms.txt: $($archiveIndex.endpoints.llms_txt)",
        "- Sitemap: $($archiveIndex.endpoints.sitemap)",
        "- Feed: $($archiveIndex.endpoints.feed)",
        "- Desktop health: $($archiveIndex.endpoints.desktop_health)",
        '',
        '## Artifacts',
        '',
        '| Role | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $archiveArtifactRows + @(
        '',
        '## Acceptance Commands',
        '',
        '```powershell',
        $archiveIndex.acceptance.verify_delivery,
        $archiveIndex.acceptance.preflight_report,
        $archiveIndex.acceptance.onboarding_kit,
        $archiveIndex.acceptance.operating_plan,
        $archiveIndex.acceptance.sales_kit,
        $archiveIndex.acceptance.success_review,
        $archiveIndex.acceptance.service_scope,
        $archiveIndex.acceptance.product_manual,
        $archiveIndex.acceptance.operator_quickstart,
        $archiveIndex.acceptance.publishing_loop_acceptance,
        $archiveIndex.acceptance.publishing_loop_dry_run,
        $archiveIndex.acceptance.operations_evidence_pack,
        $archiveIndex.acceptance.server_dry_run,
        $archiveIndex.acceptance.server_verify,
        $archiveIndex.acceptance.acceptance_report,
        $archiveIndex.acceptance.support_bundle,
        $archiveIndex.acceptance.upgrade_plan,
        '```',
        '',
        '## Security Boundary',
        '',
        'Customer API tokens, third-party platform credentials, browser profiles, server passwords, node_modules, logs, and temporary runtime files are excluded from the release archive.'
    )
    Set-Content -LiteralPath $archiveIndexMarkdownFile -Value ($archiveMarkdown -join [Environment]::NewLine) -Encoding UTF8

    $firstTwoStagesPilotResultJson = & (Join-Path $rootPath 'scripts\New-FirstTwoStagesPilotChecklist.ps1') `
        -ReleaseManifestPath $manifestFile `
        -OutputPath $firstTwoStagesPilotFile `
        -JsonOutputPath $firstTwoStagesPilotJsonFile
    $firstTwoStagesPilotResult = $firstTwoStagesPilotResultJson | ConvertFrom-Json
    if ([string] $firstTwoStagesPilotResult.status -ne 'created') {
        throw "First two stages pilot checklist was not created. Status: $($firstTwoStagesPilotResult.status)"
    }

    $archiveArtifacts = @($archiveArtifacts) + @(
        New-ArchiveArtifactRecord -Path $firstTwoStagesPilotFile -Role 'first_two_stages_pilot_checklist' -Audience 'pilot_acceptance'
        New-ArchiveArtifactRecord -Path $firstTwoStagesPilotJsonFile -Role 'first_two_stages_pilot_checklist_json' -Audience 'delivery_archive'
    )
    $archiveIndex.artifacts = $archiveArtifacts
    Write-JsonFile -Value $archiveIndex -Path $archiveIndexFile

    $archiveArtifactRows = @($archiveArtifacts | ForEach-Object {
        "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
    })
    $archiveMarkdown = @(
        "# $safeReleaseSlug Project Archive Index",
        '',
        "Product: $($archiveIndex.product)",
        "Version: $version",
        "Customer: $($archiveIndex.customer.company_name)",
        "Customer slug: $customerSlug",
        "Website: $($archiveIndex.customer.site_url)",
        "GEOFlow: $($archiveIndex.customer.geoflow_base_url)",
        "Generated at: $($archiveIndex.generated_at)",
        '',
        '## Customer Endpoints',
        '',
        "- Website: $($archiveIndex.endpoints.website)",
        "- GEOFlow admin: $($archiveIndex.endpoints.geoflow_admin)",
        "- Publisher assistant: $($archiveIndex.endpoints.publisher_assistant)",
        "- Contact leads: $($archiveIndex.endpoints.contact_leads)",
        "- llms.txt: $($archiveIndex.endpoints.llms_txt)",
        "- Sitemap: $($archiveIndex.endpoints.sitemap)",
        "- Feed: $($archiveIndex.endpoints.feed)",
        "- Desktop health: $($archiveIndex.endpoints.desktop_health)",
        '',
        '## Artifacts',
        '',
        '| Role | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $archiveArtifactRows + @(
        '',
        '## Acceptance Commands',
        '',
        '```powershell',
        $archiveIndex.acceptance.verify_delivery,
        $archiveIndex.acceptance.preflight_report,
        $archiveIndex.acceptance.onboarding_kit,
        $archiveIndex.acceptance.operating_plan,
        $archiveIndex.acceptance.sales_kit,
        $archiveIndex.acceptance.success_review,
        $archiveIndex.acceptance.service_scope,
        $archiveIndex.acceptance.product_manual,
        $archiveIndex.acceptance.operator_quickstart,
        $archiveIndex.acceptance.publishing_loop_acceptance,
        $archiveIndex.acceptance.publishing_loop_dry_run,
        $archiveIndex.acceptance.operations_evidence_pack,
        $archiveIndex.acceptance.server_dry_run,
        $archiveIndex.acceptance.server_verify,
        $archiveIndex.acceptance.acceptance_report,
        $archiveIndex.acceptance.support_bundle,
        $archiveIndex.acceptance.upgrade_plan,
        '```',
        '',
        '## Security Boundary',
        '',
        'Customer API tokens, third-party platform credentials, browser profiles, server passwords, node_modules, logs, and temporary runtime files are excluded from the release archive.'
    )
    Set-Content -LiteralPath $archiveIndexMarkdownFile -Value ($archiveMarkdown -join [Environment]::NewLine) -Encoding UTF8

    $releaseNotesResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryReleaseNotes.ps1') `
        -ReleaseManifestPath $manifestFile `
        -ValidationReportPath $validationReport `
        -ArchiveIndexPath $archiveIndexFile `
        -OutputPath $releaseNotesFile `
        -JsonOutputPath $releaseNotesJsonFile
    $releaseNotesResult = $releaseNotesResultJson | ConvertFrom-Json
    if ([string] $releaseNotesResult.status -ne 'created') {
        throw "Customer delivery release notes were not created. Status: $($releaseNotesResult.status)"
    }

    & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryRelease.ps1') `
        -ReleaseManifestPath $manifestFile `
        -ExpectedVersion $version | Out-Null

    $result = [ordered]@{
        product = [string] $product.product
        version = $version
        status = 'passed'
        release_slug = $safeReleaseSlug
        customer_slug = $customerSlug
        output_root = $resolvedOutputRoot
        delivery_package = $deliveryZip
        validation_report = $validationReport
        checksum_file = $checksumFile
        release_manifest = $manifestFile
        config_review = $configReviewFile
        config_review_json = $configReviewJsonFile
        release_summary = $summaryFile
        release_notes = $releaseNotesFile
        release_notes_json = $releaseNotesJsonFile
        handoff_checklist = $handoffChecklistFile
        handoff_checklist_json = $handoffChecklistJsonFile
        first_two_stages_pilot_checklist = $firstTwoStagesPilotFile
        first_two_stages_pilot_checklist_json = $firstTwoStagesPilotJsonFile
        archive_index = $archiveIndexFile
        archive_index_markdown = $archiveIndexMarkdownFile
        sha256 = $deliveryHash
        bytes = [int64] $deliveryItem.Length
        customer_root = if ($KeepCustomerRoot) { [string] $report.customer_root } else { $null }
    }
    $result | ConvertTo-Json -Depth 5 | Write-Output
} catch {
    if ($null -ne $validationReport -and -not [string]::IsNullOrWhiteSpace($validationReport)) {
        Write-JsonFile -Value $report -Path $validationReport
    }
    throw
} finally {
    if (-not $KeepCustomerRoot -and (Test-Path $runRoot)) {
        Remove-Item -LiteralPath $runRoot -Recurse -Force
    }
}
