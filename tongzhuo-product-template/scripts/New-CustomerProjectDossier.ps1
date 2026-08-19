[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ReleaseManifestPath,
    [string]$Root = '',
    [string]$IntakePath = '',
    [string]$BackendDossierPath = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath

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
        [Parameter(Mandatory = $true)] [string]$Role,
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Owner,
        [Parameter(Mandatory = $true)] [string]$Purpose
    )

    $item = Get-Item -LiteralPath $Path
    return [ordered]@{
        role = $Role
        owner = $Owner
        purpose = $Purpose
        file = Split-Path $Path -Leaf
        path = $Path
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
    }
}

function New-StageRecord {
    param(
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Owner,
        [Parameter(Mandatory = $true)] [string]$Status,
        [Parameter(Mandatory = $true)] [string]$Evidence,
        [Parameter(Mandatory = $true)] [string]$NextAction
    )
    [ordered]@{
        stage = $Stage
        owner = $Owner
        status = $Status
        evidence = $Evidence
        next_action = $NextAction
    }
}

$resolvedManifestPath = (Resolve-Path $ReleaseManifestPath).Path
$releaseDirectory = Split-Path $resolvedManifestPath -Parent
$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$deliveryFile = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryFile)) {
    $deliveryFile = [string] $manifest.delivery_package.path
}

$deliveryPackage = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $deliveryFile
$validationReportPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.validation_report)
$configReviewPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.config_review_json)
$releaseNotesPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.release_notes_json)
$handoffChecklistPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.handoff_checklist_json)
$archiveIndexPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.archive_index)
$checksumPath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile ([string] $manifest.evidence.checksum_file)

$validationReport = Get-Content -LiteralPath $validationReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
$configReview = Get-Content -LiteralPath $configReviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
$releaseNotes = Get-Content -LiteralPath $releaseNotesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$handoffChecklist = Get-Content -LiteralPath $handoffChecklistPath -Raw -Encoding UTF8 | ConvertFrom-Json
$archiveIndex = Get-Content -LiteralPath $archiveIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json

$intake = $null
if (-not [string]::IsNullOrWhiteSpace($IntakePath)) {
    $resolvedIntakePath = (Resolve-Path $IntakePath).Path
    $intake = Get-Content -LiteralPath $resolvedIntakePath -Raw -Encoding UTF8 | ConvertFrom-Json
}

$backendDossier = $null
if (-not [string]::IsNullOrWhiteSpace($BackendDossierPath)) {
    $resolvedBackendDossierPath = (Resolve-Path $BackendDossierPath).Path
    $backendDossier = Get-Content -LiteralPath $resolvedBackendDossierPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string] $backendDossier.schema -ne 'customer_project_dossier_export') {
        throw "Backend dossier schema mismatch: $resolvedBackendDossierPath"
    }
}

$highWarnings = @($configReview.warnings | Where-Object { [string] $_.code -like '*https*' -or [string] $_.code -like '*local*' })
$validationStatus = [string] $validationReport.status
$releaseStatus = if ($validationStatus -eq 'passed' -and [string] $handoffChecklist.status -eq 'ready_for_signoff') {
    'ready_for_launch'
} else {
    'needs_attention'
}

$artifactRecords = @(
    New-FileRecord -Role 'release_manifest' -Path $resolvedManifestPath -Owner 'implementation' -Purpose 'Release identity, package hash, customer endpoints, and evidence pointers.'
    New-FileRecord -Role 'delivery_package' -Path $deliveryPackage -Owner 'implementation' -Purpose 'Customer install package for server, website, desktop agent, docs, and runtime entrypoints.'
    New-FileRecord -Role 'validation_report' -Path $validationReportPath -Owner 'implementation' -Purpose 'Proof that release generation and package validation passed.'
    New-FileRecord -Role 'config_review' -Path $configReviewPath -Owner 'sales_and_implementation' -Purpose 'Customer endpoint, contact, service, port, warning, and safety review.'
    New-FileRecord -Role 'release_notes' -Path $releaseNotesPath -Owner 'customer_handoff' -Purpose 'Deployment phases, endpoints, acceptance commands, and release evidence.'
    New-FileRecord -Role 'handoff_checklist' -Path $handoffChecklistPath -Owner 'customer_handoff' -Purpose 'Signoff checklist and pre-handoff/post-install requirements.'
    New-FileRecord -Role 'archive_index' -Path $archiveIndexPath -Owner 'delivery_archive' -Purpose 'Long-term customer project archive index.'
    New-FileRecord -Role 'checksum' -Path $checksumPath -Owner 'delivery_archive' -Purpose 'Delivery package SHA256 verification.'
)
if ($null -ne $intake) {
    $artifactRecords = @($artifactRecords) + @(
        New-FileRecord -Role 'customer_intake' -Path $resolvedIntakePath -Owner 'sales' -Purpose 'Sales-to-implementation required inputs, risks, and safety boundaries.'
    )
}
if ($null -ne $backendDossier) {
    $artifactRecords = @($artifactRecords) + @(
        New-FileRecord -Role 'geoflow_backend_dossier' -Path $resolvedBackendDossierPath -Owner 'customer_success' -Purpose 'GEOFlow backend customer project snapshot with delivery readiness, checklist, acceptance, and safety boundary.'
    )
}

$lifecycle = @(
    New-StageRecord -Stage 'intake' -Owner 'sales' -Status $(if ($null -ne $intake) { [string] $intake.status } else { 'not_attached' }) -Evidence $(if ($null -ne $intake) { $resolvedIntakePath } else { 'Run New-CustomerIntakeChecklist.ps1 before the next customer handoff.' }) -NextAction 'Confirm required inputs, do-not-collect boundary, and do-not-promise boundary.'
    New-StageRecord -Stage 'config_review' -Owner 'implementation' -Status ([string] $configReview.status) -Evidence $configReviewPath -NextAction 'Resolve or explicitly accept config review warnings before production launch.'
    New-StageRecord -Stage 'geoflow_backend_snapshot' -Owner 'customer_success' -Status $(if ($null -ne $backendDossier) { 'attached' } else { 'not_attached' }) -Evidence $(if ($null -ne $backendDossier) { $resolvedBackendDossierPath } else { 'Export the customer project dossier JSON from GEOFlow backend before formal customer review.' }) -NextAction 'Use the backend snapshot to compare live project readiness with packaged delivery evidence.'
    New-StageRecord -Stage 'release_validation' -Owner 'implementation' -Status $validationStatus -Evidence $validationReportPath -NextAction 'Recalculate SHA256 and keep release evidence together.'
    New-StageRecord -Stage 'handoff' -Owner 'implementation_and_customer' -Status ([string] $handoffChecklist.status) -Evidence $handoffChecklistPath -NextAction 'Collect signoff from sales, implementation, server engineer, operator, and customer.'
    New-StageRecord -Stage 'launch' -Owner 'implementation' -Status 'planned' -Evidence ([string] $archiveIndex.acceptance.go_live_checklist) -NextAction 'Extract customer package, run LaunchPad, PreflightReport, GoLiveChecklist, and server dry-run.'
    New-StageRecord -Stage 'acceptance' -Owner 'customer_success' -Status 'planned' -Evidence ([string] $archiveIndex.acceptance.acceptance_report) -NextAction 'Generate AcceptanceReport and OperationsEvidencePack after first production validation.'
    New-StageRecord -Stage 'support' -Owner 'support' -Status 'planned' -Evidence ([string] $archiveIndex.acceptance.support_bundle) -NextAction 'Use SupportBundle for sanitized escalation without credentials, cookies, or browser profiles.'
)

$riskFlags = @()
if ($null -ne $intake) {
    $riskFlags += @($intake.risk_flags)
}
$riskFlags += @($configReview.warnings | ForEach-Object {
    [ordered]@{ code = [string] $_.code; severity = 'review'; message = [string] $_.message }
})

$dossier = [ordered]@{
    dossier_type = 'tongzhuo_customer_project_dossier'
    status = $releaseStatus
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $product.product
    version = [string] $manifest.version
    release_slug = [string] $manifest.release_slug
    customer = [ordered]@{
        slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        short_name = [string] $manifest.short_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
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
    lifecycle = $lifecycle
    artifact_inventory = $artifactRecords
    validation = [ordered]@{
        release_validation_status = $validationStatus
        validation_check_count = @($validationReport.checks).Count
        config_review_status = [string] $configReview.status
        config_warning_count = @($configReview.warnings).Count
        high_attention_count = @($highWarnings).Count
    }
    geoflow_backend_snapshot = if ($null -ne $backendDossier) {
        [ordered]@{
            attached = $true
            schema = [string] $backendDossier.schema
            schema_version = [string] $backendDossier.schema_version
            exported_at = [string] $backendDossier.exported_at
            source_file = $resolvedBackendDossierPath
            project_id = if ($null -ne $backendDossier.project.id) { [int] $backendDossier.project.id } else { $null }
            project_name = [string] $backendDossier.project.name
            company_name = [string] $backendDossier.project.company_name
            delivery_status = [string] $backendDossier.delivery_readiness.status
            delivery_score = if ($null -ne $backendDossier.delivery_readiness.score) { [int] $backendDossier.delivery_readiness.score } else { 0 }
            delivery_task_count = @($backendDossier.delivery_readiness.delivery_tasks).Count
            checklist_count = @($backendDossier.delivery_checklist).Count
            service_line_count = @($backendDossier.service_lines).Count
            contains_credentials = [bool] $backendDossier.security_boundary.contains_credentials
            contains_cookies = [bool] $backendDossier.security_boundary.contains_cookies
            contains_browser_profiles = [bool] $backendDossier.security_boundary.contains_browser_profiles
        }
    } else {
        [ordered]@{
            attached = $false
            next_action = 'Export customer project dossier JSON from GEOFlow backend and rerun CustomerDossier with -BackendDossierPath.'
        }
    }
    launch_commands = [ordered]@{
        extracted_launchpad = '.\Start-CustomerDelivery.ps1 -Action LaunchPad'
        preflight = [string] $archiveIndex.acceptance.preflight_report
        go_live = [string] $archiveIndex.acceptance.go_live_checklist
        publishing_dry_run = [string] $archiveIndex.acceptance.publishing_loop_dry_run
        publishing_acceptance = [string] $archiveIndex.acceptance.publishing_loop_acceptance
        acceptance_report = [string] $archiveIndex.acceptance.acceptance_report
        support_bundle = [string] $archiveIndex.acceptance.support_bundle
    }
    management_next_actions = @(
        'Attach the GEOFlow backend dossier export so packaged delivery evidence can be compared with the live customer project state.',
        'Archive this dossier with the intake checklist, release manifest, delivery package, checksum, validation report, config review, release notes, handoff checklist, and archive index.',
        'Before launch, run LaunchPad and PreflightReport from the extracted customer package.',
        'After launch, attach AcceptanceReport and OperationsEvidencePack to this project record.',
        'For support, generate SupportBundle and do not collect platform passwords, cookies, browser profiles, or verification codes.',
        'For upgrades, compare old/new release manifests before replacing customer packages.'
    )
    risk_flags = @($riskFlags)
    security_boundary = [ordered]@{
        no_public_prices = $true
        customer_api_tokens_excluded = $true
        platform_credentials_stay_local = $true
        browser_profiles_excluded = $true
        server_does_not_store_platform_passwords = $true
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $releaseDirectory "$($manifest.release_slug)-PROJECT-DOSSIER.json"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
$markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

$dossier | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

$endpointRows = @($dossier.endpoints.PSObject.Properties | ForEach-Object {
    "| $($_.Name) | $($_.Value) |"
})
$lifecycleRows = @($dossier.lifecycle | ForEach-Object {
    "| $($_.stage) | $($_.owner) | $($_.status) | $($_.evidence) | $($_.next_action) |"
})
$artifactRows = @($dossier.artifact_inventory | ForEach-Object {
    "| $($_.role) | $($_.owner) | $($_.file) | $($_.bytes) | $($_.sha256) |"
})
$riskLines = if (@($dossier.risk_flags).Count -gt 0) {
    @($dossier.risk_flags | ForEach-Object { "- $($_.severity): $($_.code) - $($_.message)" })
} else {
    @('- No risk flags.')
}
$nextLines = @($dossier.management_next_actions | ForEach-Object { "- [ ] $_" })

$markdown = @(
    "# $($dossier.release_slug) Customer Project Dossier",
    '',
    "Status: $($dossier.status)",
    "Product: $($dossier.product)",
    "Version: $($dossier.version)",
    "Customer: $($dossier.customer.company_name)",
    "Website: $($dossier.customer.site_url)",
    "GEOFlow: $($dossier.customer.geoflow_base_url)",
    '',
    '## Endpoints',
    '',
    '| Name | URL |',
    '| --- | --- |'
) + $endpointRows + @(
    '',
    '## Lifecycle',
    '',
    '| Stage | Owner | Status | Evidence | Next Action |',
    '| --- | --- | --- | --- | --- |'
) + $lifecycleRows + @(
    '',
    '## Artifact Inventory',
    '',
    '| Role | Owner | File | Bytes | SHA256 |',
    '| --- | --- | --- | ---: | --- |'
) + $artifactRows + @(
    '',
    '## Validation',
    '',
    "- Release validation: $($dossier.validation.release_validation_status)",
    "- Validation checks: $($dossier.validation.validation_check_count)",
    "- Config review: $($dossier.validation.config_review_status)",
    "- Config warnings: $($dossier.validation.config_warning_count)",
    '',
    '## GEOFlow Backend Snapshot',
    '',
    "- Attached: $($dossier.geoflow_backend_snapshot.attached)",
    "- Delivery status: $($dossier.geoflow_backend_snapshot.delivery_status)",
    "- Delivery score: $($dossier.geoflow_backend_snapshot.delivery_score)",
    "- Delivery task count: $($dossier.geoflow_backend_snapshot.delivery_task_count)",
    "- Source file: $($dossier.geoflow_backend_snapshot.source_file)",
    '',
    '## Launch Commands',
    '',
    '```powershell',
    $dossier.launch_commands.extracted_launchpad,
    $dossier.launch_commands.preflight,
    $dossier.launch_commands.go_live,
    $dossier.launch_commands.publishing_dry_run,
    $dossier.launch_commands.publishing_acceptance,
    $dossier.launch_commands.acceptance_report,
    $dossier.launch_commands.support_bundle,
    '```',
    '',
    '## Management Next Actions',
    ''
) + $nextLines + @(
    '',
    '## Risk Flags',
    ''
) + $riskLines + @(
    '',
    '## Security Boundary',
    '',
    '- Public website content does not include service prices.',
    '- Customer API Tokens are excluded from release artifacts.',
    '- Platform credentials, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
    '- Server-side GEOFlow coordinates tasks, devices, leads, and result records; it does not store third-party platform passwords.'
)
Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    dossier_status = [string] $dossier.status
    dossier = $resolvedOutputPath
    markdown = $markdownPath
    release_slug = [string] $manifest.release_slug
    customer_slug = [string] $manifest.customer_slug
    version = [string] $manifest.version
} | ConvertTo-Json -Depth 4 | Write-Output
