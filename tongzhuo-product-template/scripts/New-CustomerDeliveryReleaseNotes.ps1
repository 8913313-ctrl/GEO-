[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ReleaseManifestPath,
    [string]$ValidationReportPath = '',
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

function New-ArtifactReference {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Role
    )

    $item = Get-Item -LiteralPath $Path
    return [ordered]@{
        role = $Role
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
if ([string]::IsNullOrWhiteSpace($ArchiveIndexPath)) {
    $ArchiveIndexPath = [string] $manifest.evidence.archive_index
}

$resolvedValidationReportPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $ValidationReportPath
$resolvedArchiveIndexPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $ArchiveIndexPath
$deliveryFile = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryFile)) {
    $deliveryFile = [string] $manifest.delivery_package.path
}
$resolvedDeliveryPackagePath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $deliveryFile

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $releaseDirectory "$($manifest.release_slug)-DELIVERY-RELEASE-NOTES.md"
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
    throw "Customer delivery validation report must be passed before release notes are generated. Status: $($validationReport.status)"
}

$archiveIndex = Get-Content -LiteralPath $resolvedArchiveIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string] $archiveIndex.index_type -ne 'tongzhuo_customer_project_archive') {
    throw "Archive index type mismatch: $($archiveIndex.index_type)"
}

$deliveryItem = Get-Item -LiteralPath $resolvedDeliveryPackagePath
$deliveryHash = (Get-FileHash -LiteralPath $resolvedDeliveryPackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($deliveryHash -ne ([string] $manifest.delivery_package.sha256).ToLowerInvariant()) {
    throw 'Customer delivery package hash does not match release manifest.'
}
if ([int64] $deliveryItem.Length -ne [int64] $manifest.delivery_package.bytes) {
    throw 'Customer delivery package byte size does not match release manifest.'
}

$validationChecks = @($validationReport.checks | ForEach-Object {
    [ordered]@{
        name = [string] $_.name
        status = [string] $_.status
        duration_seconds = [decimal] $_.duration_seconds
    }
})

$acceptanceCommands = [ordered]@{
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

$componentArtifacts = @($archiveIndex.artifacts | ForEach-Object {
    [ordered]@{
        role = [string] $_.role
        file = [string] $_.file
        sha256 = [string] $_.sha256
        bytes = [int64] $_.bytes
        audience = [string] $_.audience
    }
})

$releaseArtifacts = @(
    New-ArtifactReference -Path $resolvedDeliveryPackagePath -Role 'customer_delivery_package'
    New-ArtifactReference -Path $resolvedValidationReportPath -Role 'release_validation_report'
    New-ArtifactReference -Path $resolvedManifestPath -Role 'release_manifest'
    New-ArtifactReference -Path $resolvedArchiveIndexPath -Role 'project_archive_index'
)

$notes = [ordered]@{
    notes_type = 'tongzhuo_customer_delivery_release_notes'
    product = [string] $manifest.product
    version = [string] $manifest.version
    release_slug = [string] $manifest.release_slug
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    status = 'ready_for_customer_handoff'
    customer = [ordered]@{
        slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        short_name = [string] $manifest.short_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
        publisher_port = [int] $manifest.publisher_port
        desktop_agent_port = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 19380 }
    }
    endpoints = [ordered]@{
        website = [string] $archiveIndex.endpoints.website
        geoflow_admin = [string] $archiveIndex.endpoints.geoflow_admin
        publisher_assistant = [string] $archiveIndex.endpoints.publisher_assistant
        contact_leads = [string] $archiveIndex.endpoints.contact_leads
        llms_txt = [string] $archiveIndex.endpoints.llms_txt
        sitemap = [string] $archiveIndex.endpoints.sitemap
        feed = [string] $archiveIndex.endpoints.feed
        desktop_health = [string] $archiveIndex.endpoints.desktop_health
    }
    artifacts = $releaseArtifacts
    component_artifacts = $componentArtifacts
    validation = [ordered]@{
        report = $resolvedValidationReportPath
        checks = $validationChecks
    }
    acceptance = $acceptanceCommands
    deployment_phases = @(
        'Confirm release files and SHA256 before copying to implementation storage.',
        'Extract the customer delivery zip on the implementation workstation.',
        'Run Start-CustomerDelivery.ps1 -Action Verify before server upload.',
        'Run Start-CustomerDelivery.ps1 -Action PreflightReport before touching the customer server.',
        'Run Start-CustomerDelivery.ps1 -Action OnboardingKit to confirm kickoff roles, training agenda, and first-week operating cadence.',
        'Run Start-CustomerDelivery.ps1 -Action OperatingPlan to generate the first 30-day GEO operations calendar.',
        'Run Start-CustomerDelivery.ps1 -Action SalesKit to generate the customer demo, discovery, objection-handling, and proof package.',
        'Run Start-CustomerDelivery.ps1 -Action SuccessReview after the first month to generate evidence, risk, next-month, and renewal discussion materials.',
        'Run Start-CustomerDelivery.ps1 -Action ServiceScope to confirm included scope, excluded items, responsibilities, acceptance criteria, and change-control boundary.',
        'Run Start-CustomerDelivery.ps1 -Action ProductManual to generate the customer-readable product, workflow, endpoint, role, and metric guide.',
        'Run Start-CustomerDelivery.ps1 -Action OperatorQuickstart to generate the short daily publishing checklist for customer operators.',
        'Run Start-CustomerDelivery.ps1 -Action GoLiveChecklist before production launch to coordinate backup, server deployment, website AI verification, desktop publisher setup, publishing loop, lead capture, rollback, and customer signoff.',
        'Run Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance to verify website, distribution, publisher device, desktop agent, and result-writeback readiness.',
        'Run Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun to simulate the article payload, desktop job claim, result payload, per-platform result states, and GEOFlow writeback before using real platform accounts.',
        'Run Start-CustomerDelivery.ps1 -Action OperationsEvidencePack to create the reusable operations proof checklist for article, AI exposure, distribution, desktop publisher, platform result, operator closeout, and support-boundary evidence.',
        'Run the server dry-run command against the target GEOFlow root.',
        'Install server overrides, website package, and desktop publisher agent according to the generated implementation plan.',
        'Run server verification and customer acceptance report after deployment.',
        'Archive the release manifest, checksum, release notes, archive index, validation report, and acceptance report together.'
    )
    support_boundary = [ordered]@{
        customer_api_token_excluded = $true
        platform_credentials_stay_local = $true
        platform_passwords_excluded = $true
        browser_profiles_excluded = $true
        server_passwords_excluded = $true
        public_website_prices_excluded = $true
    }
}

$notes | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutputPath -Encoding UTF8

$artifactRows = @($releaseArtifacts | ForEach-Object {
    "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
})
$componentRows = @($componentArtifacts | ForEach-Object {
    "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
})
$checkRows = @($validationChecks | ForEach-Object {
    "| $($_.name) | $($_.status) | $($_.duration_seconds) |"
})
$phaseLines = @($notes.deployment_phases | ForEach-Object { "1. $_" })

$markdown = @(
    "# $($notes.release_slug) Customer Delivery Release Notes",
    '',
    "Product: $($notes.product)",
    "Version: $($notes.version)",
    "Status: $($notes.status)",
    "Customer: $($notes.customer.company_name)",
    "Customer slug: $($notes.customer.slug)",
    "Generated at: $($notes.generated_at)",
    '',
    '## Customer Endpoints',
    '',
    "- Website: $($notes.endpoints.website)",
    "- GEOFlow admin: $($notes.endpoints.geoflow_admin)",
    "- Publisher assistant: $($notes.endpoints.publisher_assistant)",
    "- Contact leads: $($notes.endpoints.contact_leads)",
    "- llms.txt: $($notes.endpoints.llms_txt)",
    "- Sitemap: $($notes.endpoints.sitemap)",
    "- Feed: $($notes.endpoints.feed)",
    "- Desktop health: $($notes.endpoints.desktop_health)",
    '',
    '## Release Artifacts',
    '',
    '| Role | File | Bytes | SHA256 |',
    '| --- | --- | ---: | --- |'
) + $artifactRows + @(
    '',
    '## Component Integrity',
    '',
    '| Role | File | Bytes | SHA256 |',
    '| --- | --- | ---: | --- |'
) + $componentRows + @(
    '',
    '## Validation Evidence',
    '',
    "Validation report: $resolvedValidationReportPath",
    '',
    '| Check | Status | Seconds |',
    '| --- | --- | ---: |'
) + $checkRows + @(
    '',
    '## Acceptance Commands',
    '',
    '```powershell',
    $notes.acceptance.verify_delivery,
    $notes.acceptance.preflight_report,
    $notes.acceptance.onboarding_kit,
    $notes.acceptance.operating_plan,
    $notes.acceptance.sales_kit,
    $notes.acceptance.success_review,
    $notes.acceptance.service_scope,
    $notes.acceptance.product_manual,
    $notes.acceptance.operator_quickstart,
    $notes.acceptance.go_live_checklist,
    $notes.acceptance.publishing_loop_acceptance,
    $notes.acceptance.publishing_loop_dry_run,
    $notes.acceptance.operations_evidence_pack,
    $notes.acceptance.server_dry_run,
    $notes.acceptance.server_verify,
    $notes.acceptance.acceptance_report,
    $notes.acceptance.support_bundle,
    $notes.acceptance.upgrade_plan,
    '```',
    '',
    '## Deployment Phases',
    ''
) + $phaseLines + @(
    '',
    '## Security And Support Boundary',
    '',
    '- Customer API tokens are not included.',
    '- Third-party platform passwords, cookies, and platform credentials stay on the local operator computer.',
    '- Browser profiles, server passwords, logs, temporary files, and dependency folders are excluded.',
    '- Public website packages must not contain service prices.',
    '- Server-side GEOFlow coordinates tasks; third-party login and verification remain in the Windows desktop publisher agent.'
)

Set-Content -LiteralPath $resolvedOutputPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

$result = [ordered]@{
    status = 'created'
    release_notes = $resolvedOutputPath
    release_notes_json = $resolvedJsonOutputPath
    release_slug = [string] $manifest.release_slug
    customer_slug = [string] $manifest.customer_slug
    version = [string] $manifest.version
}
$result | ConvertTo-Json -Depth 4 | Write-Output
