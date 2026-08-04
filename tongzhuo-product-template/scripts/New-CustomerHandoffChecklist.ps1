[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ReleaseManifestPath,
    [string]$ValidationReportPath = '',
    [string]$ConfigReviewJsonPath = '',
    [string]$ArchiveIndexPath = '',
    [string]$OutputPath = '',
    [string]$JsonOutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-ReleaseArtifactPath {
    param(
        [Parameter(Mandatory = $true)] [string]$BaseDirectory,
        [Parameter(Mandatory = $true)] [string]$PathOrFile
    )

    if ([string]::IsNullOrWhiteSpace($PathOrFile)) {
        throw 'Release artifact path is empty.'
    }

    $localCandidate = [IO.Path]::GetFullPath((Join-Path $BaseDirectory (Split-Path $PathOrFile -Leaf)))
    if (Test-Path $localCandidate) {
        return $localCandidate
    }

    $absoluteCandidate = [IO.Path]::GetFullPath($PathOrFile)
    if (Test-Path $absoluteCandidate) {
        return $absoluteCandidate
    }

    throw "Release artifact not found: $PathOrFile"
}

function New-FileRecord {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Role,
        [Parameter(Mandatory = $true)] [string]$Owner
    )

    $item = Get-Item -LiteralPath $Path
    return [ordered]@{
        role = $Role
        owner = $Owner
        file = Split-Path $Path -Leaf
        path = $Path
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
    }
}

$resolvedManifestPath = (Resolve-Path $ReleaseManifestPath).Path
$releaseDirectory = Split-Path $resolvedManifestPath -Parent
$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($ValidationReportPath)) {
    $ValidationReportPath = [string] $manifest.evidence.validation_report
}
if ([string]::IsNullOrWhiteSpace($ConfigReviewJsonPath)) {
    $ConfigReviewJsonPath = [string] $manifest.evidence.config_review_json
}
if ([string]::IsNullOrWhiteSpace($ArchiveIndexPath)) {
    $ArchiveIndexPath = [string] $manifest.evidence.archive_index
}

$resolvedValidationReportPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $ValidationReportPath
$resolvedConfigReviewPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $ConfigReviewJsonPath
$resolvedArchiveIndexPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $ArchiveIndexPath
$deliveryFile = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryFile)) {
    $deliveryFile = [string] $manifest.delivery_package.path
}
$resolvedDeliveryPackagePath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $deliveryFile

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $releaseDirectory "$($manifest.release_slug)-HANDOFF-CHECKLIST.md"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null

if ([string]::IsNullOrWhiteSpace($JsonOutputPath)) {
    $JsonOutputPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.json')
}
$resolvedJsonOutputPath = [IO.Path]::GetFullPath($JsonOutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutputPath -Parent) | Out-Null

$validationReport = Get-Content -LiteralPath $resolvedValidationReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string] $validationReport.status -ne 'passed') {
    throw "Validation report must be passed before handoff checklist generation. Status: $($validationReport.status)"
}
$configReview = Get-Content -LiteralPath $resolvedConfigReviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string] $configReview.review_type -ne 'tongzhuo_customer_config_review') {
    throw "Config review type mismatch: $($configReview.review_type)"
}
$archiveIndex = Get-Content -LiteralPath $resolvedArchiveIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string] $archiveIndex.index_type -ne 'tongzhuo_customer_project_archive') {
    throw "Archive index type mismatch: $($archiveIndex.index_type)"
}

$requiredFiles = @(
    New-FileRecord -Path $resolvedDeliveryPackagePath -Role 'customer_delivery_zip' -Owner 'implementation'
    New-FileRecord -Path $resolvedManifestPath -Role 'release_manifest' -Owner 'implementation'
    New-FileRecord -Path $resolvedValidationReportPath -Role 'validation_report' -Owner 'implementation'
    New-FileRecord -Path $resolvedConfigReviewPath -Role 'config_review_json' -Owner 'sales_and_implementation'
    New-FileRecord -Path $resolvedArchiveIndexPath -Role 'archive_index' -Owner 'delivery_archive'
)

$checklist = [ordered]@{
    checklist_type = 'tongzhuo_customer_handoff_checklist'
    status = 'ready_for_signoff'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $manifest.product
    version = [string] $manifest.version
    release_slug = [string] $manifest.release_slug
    customer = [ordered]@{
        slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        short_name = [string] $manifest.short_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
        desktop_agent_port = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 18280 }
    }
    required_files = $requiredFiles
    config_review = [ordered]@{
        status = [string] $configReview.status
        warning_count = @($configReview.warnings).Count
        warnings = @($configReview.warnings)
    }
    acceptance_commands = [ordered]@{
        verify_delivery = [string] $archiveIndex.acceptance.verify_delivery
        preflight_report = [string] $archiveIndex.acceptance.preflight_report
        onboarding_kit = [string] $archiveIndex.acceptance.onboarding_kit
        operating_plan = [string] $archiveIndex.acceptance.operating_plan
        sales_kit = [string] $archiveIndex.acceptance.sales_kit
        success_review = [string] $archiveIndex.acceptance.success_review
        service_scope = [string] $archiveIndex.acceptance.service_scope
        product_manual = [string] $archiveIndex.acceptance.product_manual
        operator_quickstart = [string] $archiveIndex.acceptance.operator_quickstart
        go_live_checklist = [string] $archiveIndex.acceptance.go_live_checklist
        publishing_loop_acceptance = [string] $archiveIndex.acceptance.publishing_loop_acceptance
        publishing_loop_dry_run = [string] $archiveIndex.acceptance.publishing_loop_dry_run
        operations_evidence_pack = [string] $archiveIndex.acceptance.operations_evidence_pack
        server_dry_run = [string] $archiveIndex.acceptance.server_dry_run
        server_verify = [string] $archiveIndex.acceptance.server_verify
        acceptance_report = [string] $archiveIndex.acceptance.acceptance_report
        support_bundle = [string] $archiveIndex.acceptance.support_bundle
        upgrade_plan = [string] $archiveIndex.acceptance.upgrade_plan
    }
    signoff_sections = @(
        [ordered]@{ owner = 'sales'; item = 'Customer identity, website domain, contact details, and service scope confirmed.' },
        [ordered]@{ owner = 'implementation'; item = 'Delivery zip hash, manifest, config review, archive index, and validation report archived together.' },
        [ordered]@{ owner = 'server_engineer'; item = 'Server dry-run command reviewed before production install.' },
        [ordered]@{ owner = 'operator'; item = 'Windows desktop publisher agent port and local login boundary explained.' },
        [ordered]@{ owner = 'customer'; item = 'Customer understands platform passwords, cookies, and API Tokens are not included in the handoff package.' }
    )
    pre_handoff_checks = @(
        'Recalculate SHA256 for the customer delivery zip and compare it with the .sha256 file.',
        'Review CONFIG-REVIEW warnings and confirm whether they are acceptable for this handoff.',
        'Run PreflightReport and resolve blocked checks before touching the customer server.',
        'Run OnboardingKit and confirm customer roles, platform account readiness, training agenda, and first-week cadence.',
        'Run OperatingPlan and confirm first-month article, short-video, distribution, lead, and AI workflow cadence.',
        'Run SalesKit and confirm customer demo flow, discovery questions, objection handling, proof points, and no-price public boundary.',
        'Run SuccessReview after the first month and confirm evidence, metrics, risks, next-month plan, and renewal discussion materials.',
        'Run ServiceScope and confirm included scope, excluded items, responsibilities, acceptance criteria, and change-control boundary.',
        'Run ProductManual and confirm customer-facing modules, workflow, roles, endpoints, first steps, and success metrics are clear.',
        'Run OperatorQuickstart and confirm the daily article, distribution, local publishing, closeout, and evidence workflow is clear to the customer operator.',
        'Run GoLiveChecklist and confirm backup, server deployment, website AI files, desktop publisher setup, publishing loop, lead capture, rollback, and customer signoff are covered before launch.',
        'Run PublishingLoopAcceptance and confirm article-to-website, distribution, desktop publisher, and result-writeback readiness.',
        'Run PublishingLoopDryRun and confirm simulated article payload, desktop job claim, result payload, per-platform states, and GEOFlow writeback are coherent.',
        'Run OperationsEvidencePack and confirm article, AI exposure, distribution, desktop publisher, platform result, operator closeout, and support-boundary evidence is collectable.',
        'Confirm public website contains no service pricing.',
        'Confirm GEOFlow API Token is not present in any release artifact.',
        'Confirm desktop platform credentials and browser profiles remain on the operator computer.'
    )
    post_install_checks = @(
        'Run Start-CustomerDelivery.ps1 -Action Verify after extraction.',
        'Run the server dry-run command before installing server overrides.',
        'Run the server verification command after installation.',
        'Install and start the Windows desktop publisher agent.',
        'Generate AcceptanceReport and SupportBundle after first production validation.'
    )
    security_boundary = [ordered]@{
        customer_api_tokens_excluded = $true
        platform_passwords_excluded = $true
        cookies_excluded = $true
        browser_profiles_excluded = $true
        public_website_prices_excluded = $true
    }
}

$checklist | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutputPath -Encoding UTF8

$fileRows = @($requiredFiles | ForEach-Object {
    "| $($_.role) | $($_.file) | $($_.owner) | $($_.bytes) | $($_.sha256) |"
})
$warningLines = if (@($configReview.warnings).Count -gt 0) {
    @($configReview.warnings | ForEach-Object { "- $($_.code): $($_.message)" })
} else {
    @('- No config review warnings.')
}
$signoffRows = @($checklist.signoff_sections | ForEach-Object {
    "| $($_.owner) | $($_.item) |  |"
})
$preLines = @($checklist.pre_handoff_checks | ForEach-Object { "- [ ] $_" })
$postLines = @($checklist.post_install_checks | ForEach-Object { "- [ ] $_" })

$markdown = @(
    "# $($checklist.release_slug) Handoff Checklist",
    '',
    "Status: $($checklist.status)",
    "Generated at: $($checklist.generated_at)",
    "Customer: $($checklist.customer.company_name)",
    "Website: $($checklist.customer.site_url)",
    "GEOFlow: $($checklist.customer.geoflow_base_url)",
    "Desktop agent port: $($checklist.customer.desktop_agent_port)",
    '',
    '## Required Files',
    '',
    '| Role | File | Owner | Bytes | SHA256 |',
    '| --- | --- | --- | ---: | --- |'
) + $fileRows + @(
    '',
    '## Config Review',
    '',
    "Status: $($checklist.config_review.status)",
    "Warning count: $($checklist.config_review.warning_count)",
    ''
) + $warningLines + @(
    '',
    '## Pre-Handoff Checks',
    ''
) + $preLines + @(
    '',
    '## Post-Install Checks',
    ''
) + $postLines + @(
    '',
    '## Acceptance Commands',
    '',
    '```powershell',
    $checklist.acceptance_commands.verify_delivery,
    $checklist.acceptance_commands.preflight_report,
    $checklist.acceptance_commands.onboarding_kit,
    $checklist.acceptance_commands.operating_plan,
    $checklist.acceptance_commands.sales_kit,
    $checklist.acceptance_commands.success_review,
    $checklist.acceptance_commands.service_scope,
    $checklist.acceptance_commands.product_manual,
    $checklist.acceptance_commands.operator_quickstart,
    $checklist.acceptance_commands.publishing_loop_acceptance,
    $checklist.acceptance_commands.publishing_loop_dry_run,
    $checklist.acceptance_commands.operations_evidence_pack,
    $checklist.acceptance_commands.server_dry_run,
    $checklist.acceptance_commands.server_verify,
    $checklist.acceptance_commands.acceptance_report,
    $checklist.acceptance_commands.support_bundle,
    $checklist.acceptance_commands.upgrade_plan,
    '```',
    '',
    '## Signoff',
    '',
    '| Owner | Confirmation | Signed/Date |',
    '| --- | --- | --- |'
) + $signoffRows + @(
    '',
    '## Security Boundary',
    '',
    '- Customer API Tokens are not included.',
    '- Third-party platform passwords, cookies, and browser profiles are not included.',
    '- Public website packages must not contain service prices.',
    '- Desktop platform login remains on the local operator computer.'
)

Set-Content -LiteralPath $resolvedOutputPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

$result = [ordered]@{
    status = 'created'
    handoff_checklist = $resolvedOutputPath
    handoff_checklist_json = $resolvedJsonOutputPath
    release_slug = [string] $manifest.release_slug
    customer_slug = [string] $manifest.customer_slug
}
$result | ConvertTo-Json -Depth 4 | Write-Output
