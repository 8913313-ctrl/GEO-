[CmdletBinding()]
param(
    [string]$Root = '',
    [Parameter(Mandatory = $true)] [string]$ScanRoot,
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$scanRootPath = (Resolve-Path $ScanRoot).Path

function Get-OptionalText {
    param([object]$Value)
    if ($null -eq $Value) {
        return ''
    }
    return [string] $Value
}

function New-CustomerRecordFromDossier {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $dossier = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string] $dossier.dossier_type -ne 'tongzhuo_customer_project_dossier') {
        throw "Project dossier type mismatch: $Path"
    }
    $riskCount = @($dossier.risk_flags).Count
    $nextAction = ''
    if ($null -ne $dossier.management_next_actions -and @($dossier.management_next_actions).Count -gt 0) {
        $nextAction = [string] @($dossier.management_next_actions)[0]
    }
    $backendSnapshot = $null
    if ($null -ne $dossier.PSObject.Properties['geoflow_backend_snapshot']) {
        $backendSnapshot = $dossier.geoflow_backend_snapshot
    }
    $backendSnapshotAttached = $null -ne $backendSnapshot -and [bool] $backendSnapshot.attached
    return [ordered]@{
        source = 'project_dossier'
        customer_slug = Get-OptionalText -Value $dossier.customer.slug
        company_name = Get-OptionalText -Value $dossier.customer.company_name
        short_name = Get-OptionalText -Value $dossier.customer.short_name
        version = Get-OptionalText -Value $dossier.version
        status = Get-OptionalText -Value $dossier.status
        release_slug = Get-OptionalText -Value $dossier.release_slug
        site_url = Get-OptionalText -Value $dossier.customer.site_url
        geoflow_base_url = Get-OptionalText -Value $dossier.customer.geoflow_base_url
        desktop_agent_port = if ($null -ne $dossier.customer.desktop_agent_port) { [int] $dossier.customer.desktop_agent_port } else { 19380 }
        artifact_count = @($dossier.artifact_inventory).Count
        lifecycle_count = @($dossier.lifecycle).Count
        geoflow_backend_snapshot_attached = [bool] $backendSnapshotAttached
        backend_delivery_status = if ($backendSnapshotAttached) { Get-OptionalText -Value $backendSnapshot.delivery_status } else { '' }
        backend_delivery_score = if ($backendSnapshotAttached -and $null -ne $backendSnapshot.delivery_score) { [int] $backendSnapshot.delivery_score } else { 0 }
        backend_delivery_task_count = if ($backendSnapshotAttached -and $null -ne $backendSnapshot.delivery_task_count) { [int] $backendSnapshot.delivery_task_count } else { 0 }
        risk_count = [int] $riskCount
        next_action = $nextAction
        path = $Path
    }
}

function New-CustomerRecordFromManifest {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $manifest = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string] $manifest.customer_slug) -or [string]::IsNullOrWhiteSpace([string] $manifest.release_slug)) {
        throw "Release manifest is missing customer_slug or release_slug: $Path"
    }
    return [ordered]@{
        source = 'release_manifest'
        customer_slug = Get-OptionalText -Value $manifest.customer_slug
        company_name = Get-OptionalText -Value $manifest.company_name
        short_name = Get-OptionalText -Value $manifest.short_name
        version = Get-OptionalText -Value $manifest.version
        status = 'release_created'
        release_slug = Get-OptionalText -Value $manifest.release_slug
        site_url = Get-OptionalText -Value $manifest.site_url
        geoflow_base_url = Get-OptionalText -Value $manifest.geoflow_base_url
        desktop_agent_port = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 19380 }
        artifact_count = 1
        lifecycle_count = 0
        geoflow_backend_snapshot_attached = $false
        backend_delivery_status = ''
        backend_delivery_score = 0
        backend_delivery_task_count = 0
        risk_count = 0
        next_action = 'Generate CustomerDossier for lifecycle and management tracking.'
        path = $Path
    }
}

$records = [System.Collections.ArrayList]::new()
$dossierFiles = @(Get-ChildItem -LiteralPath $scanRootPath -Recurse -File -Filter '*PROJECT-DOSSIER.json' -ErrorAction SilentlyContinue)
$dossierManifestSlugs = @{}
foreach ($file in $dossierFiles) {
    $record = New-CustomerRecordFromDossier -Path $file.FullName
    [void] $records.Add($record)
    if (-not [string]::IsNullOrWhiteSpace([string] $record.release_slug)) {
        $dossierManifestSlugs[[string] $record.release_slug] = $true
    }
}

$manifestFiles = @(Get-ChildItem -LiteralPath $scanRootPath -Recurse -File -Filter '*-manifest.json' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*release-manifest.json' })
foreach ($file in $manifestFiles) {
    try {
        $manifest = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $releaseSlug = [string] $manifest.release_slug
        if (-not [string]::IsNullOrWhiteSpace($releaseSlug) -and -not $dossierManifestSlugs.ContainsKey($releaseSlug)) {
            [void] $records.Add((New-CustomerRecordFromManifest -Path $file.FullName))
        }
    } catch {
        Write-Verbose "Skipping non-customer manifest: $($file.FullName)"
    }
}

$recordList = @($records | Sort-Object customer_slug, release_slug)
$statusGroups = @{}
foreach ($record in $recordList) {
    $status = if ([string]::IsNullOrWhiteSpace([string] $record.status)) { 'unknown' } else { [string] $record.status }
    if (-not $statusGroups.ContainsKey($status)) {
        $statusGroups[$status] = 0
    }
    $statusGroups[$status] = [int] $statusGroups[$status] + 1
}

$riskCustomerCount = @($recordList | Where-Object { [int] $_.risk_count -gt 0 }).Count
$readyCount = @($recordList | Where-Object { [string] $_.status -eq 'ready_for_launch' }).Count
$needsAttentionCount = @($recordList | Where-Object { [string] $_.status -like '*attention*' -or [int] $_.risk_count -gt 0 }).Count
$backendSnapshotRecords = @($recordList | Where-Object { [bool] $_.geoflow_backend_snapshot_attached })
$backendScoreAverage = if ($backendSnapshotRecords.Count -gt 0) {
    [int] [Math]::Round((@($backendSnapshotRecords | ForEach-Object { [int] $_.backend_delivery_score }) | Measure-Object -Average).Average)
} else {
    0
}

$portfolio = [ordered]@{
    portfolio_type = 'tongzhuo_customer_portfolio_index'
    status = if ($recordList.Count -eq 0) { 'empty' } elseif ($needsAttentionCount -gt 0) { 'needs_attention' } else { 'ready' }
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $product.product
    version = [string] $product.version
    scan_root = $scanRootPath
    summary = [ordered]@{
        customer_records = [int] $recordList.Count
        ready_for_launch = [int] $readyCount
        needs_attention = [int] $needsAttentionCount
        with_risks = [int] $riskCustomerCount
        with_geoflow_backend_snapshot = [int] $backendSnapshotRecords.Count
        average_backend_delivery_score = [int] $backendScoreAverage
        project_dossiers = [int] $dossierFiles.Count
        release_manifests_without_dossier = [int] (@($recordList | Where-Object { [string] $_.source -eq 'release_manifest' }).Count)
    }
    status_counts = $statusGroups
    customers = $recordList
    management_next_actions = @(
        'Create CustomerDossier for any release_manifest-only customer record.',
        'Attach GEOFlow backend dossier exports for customer records that do not show a backend delivery score.',
        'Review all records with needs_attention or risk_count greater than zero before launch.',
        'Archive LaunchPad, AcceptanceReport, OperationsEvidencePack, and SupportBundle beside each project dossier.',
        'Use Compare-CustomerDeliveryRelease.ps1 before upgrading an existing customer package.',
        'Keep platform credentials, cookies, captcha state, browser profiles, and API Tokens outside portfolio artifacts.'
    )
    security_boundary = [ordered]@{
        portfolio_excludes_platform_credentials = $true
        portfolio_excludes_api_tokens = $true
        portfolio_excludes_browser_profiles = $true
        public_website_prices_excluded = $true
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $scanRootPath "tongzhuo-customer-portfolio-index.json"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
$markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

$portfolio | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

$customerRows = if ($recordList.Count -gt 0) {
    @($recordList | ForEach-Object {
        "| $($_.customer_slug) | $($_.company_name) | $($_.status) | $($_.version) | $($_.backend_delivery_score) | $($_.backend_delivery_status) | $($_.risk_count) | $($_.source) | $($_.path) |"
    })
} else {
    @('|  |  | empty |  | 0 |  | 0 |  |  |')
}
$statusRows = @($portfolio.status_counts.GetEnumerator() | Sort-Object Name | ForEach-Object {
    "| $($_.Key) | $($_.Value) |"
})
if ($statusRows.Count -eq 0) {
    $statusRows = @('| empty | 0 |')
}
$nextLines = @($portfolio.management_next_actions | ForEach-Object { "- [ ] $_" })

$markdown = @(
    '# Tongzhuo Customer Portfolio Index',
    '',
    "Status: $($portfolio.status)",
    "Product: $($portfolio.product)",
    "Version: $($portfolio.version)",
    "Scan root: $($portfolio.scan_root)",
    "Generated at: $($portfolio.generated_at)",
    '',
    '## Summary',
    '',
    "- Customer records: $($portfolio.summary.customer_records)",
    "- Ready for launch: $($portfolio.summary.ready_for_launch)",
    "- Needs attention: $($portfolio.summary.needs_attention)",
    "- With risks: $($portfolio.summary.with_risks)",
    "- With GEOFlow backend snapshot: $($portfolio.summary.with_geoflow_backend_snapshot)",
    "- Average backend delivery score: $($portfolio.summary.average_backend_delivery_score)",
    "- Project dossiers: $($portfolio.summary.project_dossiers)",
    "- Release manifests without dossier: $($portfolio.summary.release_manifests_without_dossier)",
    '',
    '## Status Counts',
    '',
    '| Status | Count |',
    '| --- | ---: |'
) + $statusRows + @(
    '',
    '## Customers',
    '',
    '| Customer | Company | Status | Version | Backend Score | Backend Status | Risks | Source | Path |',
    '| --- | --- | --- | --- | ---: | --- | ---: | --- | --- |'
) + $customerRows + @(
    '',
    '## Management Next Actions',
    ''
) + $nextLines + @(
    '',
    '## Security Boundary',
    '',
    '- Portfolio artifacts do not include platform credentials.',
    '- Portfolio artifacts do not include API Tokens.',
    '- Portfolio artifacts do not include cookies, captcha state, or browser profiles.',
    '- Public website content does not include service prices.'
)
Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    portfolio_status = [string] $portfolio.status
    portfolio = $resolvedOutputPath
    markdown = $markdownPath
    customer_records = [int] $recordList.Count
    version = [string] $product.version
} | ConvertTo-Json -Depth 4 | Write-Output
