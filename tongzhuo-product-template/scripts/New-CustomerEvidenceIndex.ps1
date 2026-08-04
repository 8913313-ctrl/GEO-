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

function Get-JsonProperty {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string]$Name
    )
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function New-ArtifactRecord {
    param(
        [Parameter(Mandatory = $true)] [string]$Type,
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Path,
        [object]$Json
    )

    $item = Get-Item -LiteralPath $Path
    $status = ''
    if ($null -ne $Json) {
        $status = Get-OptionalText -Value (Get-JsonProperty -Object $Json -Name 'status')
        if ([string]::IsNullOrWhiteSpace($status)) {
            $status = Get-OptionalText -Value (Get-JsonProperty -Object $Json -Name 'audit_status')
        }
        if ([string]::IsNullOrWhiteSpace($status)) {
            $status = Get-OptionalText -Value (Get-JsonProperty -Object $Json -Name 'review_status')
        }
    }
    if ([string]::IsNullOrWhiteSpace($status)) {
        $status = 'present'
    }
    $backendSnapshot = $null
    if ($Type -eq 'customer_project_dossier' -and $null -ne $Json -and $null -ne $Json.PSObject.Properties['geoflow_backend_snapshot']) {
        $backendSnapshot = $Json.geoflow_backend_snapshot
    }
    $backendSnapshotAttached = $null -ne $backendSnapshot -and [bool] $backendSnapshot.attached

    [ordered]@{
        artifact_type = $Type
        stage = $Stage
        status = $status
        file = Split-Path $Path -Leaf
        path = $Path
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
        geoflow_backend_snapshot_attached = [bool] $backendSnapshotAttached
        backend_delivery_status = if ($backendSnapshotAttached) { Get-OptionalText -Value $backendSnapshot.delivery_status } else { '' }
        backend_delivery_score = if ($backendSnapshotAttached -and $null -ne $backendSnapshot.delivery_score) { [int] $backendSnapshot.delivery_score } else { 0 }
        backend_delivery_task_count = if ($backendSnapshotAttached -and $null -ne $backendSnapshot.delivery_task_count) { [int] $backendSnapshot.delivery_task_count } else { 0 }
    }
}

function Get-ArtifactKind {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [object]$Json
    )

    $name = (Split-Path $Path -Leaf).ToLowerInvariant()
    if ($null -ne $Json) {
        foreach ($pair in @(
            @{ property = 'proposal_type'; value = 'tongzhuo_customer_proposal_brief'; type = 'customer_proposal_brief'; stage = 'sales_handoff' },
            @{ property = 'demo_type'; value = 'tongzhuo_customer_demo_script'; type = 'customer_demo_script'; stage = 'sales_handoff' },
            @{ property = 'intake_type'; value = 'tongzhuo_customer_intake_checklist'; type = 'customer_intake_checklist'; stage = 'implementation_intake' },
            @{ property = 'audit_type'; value = 'tongzhuo_ai_visibility_audit'; type = 'ai_visibility_audit'; stage = 'website_ai_readiness' },
            @{ property = 'review_type'; value = 'tongzhuo_customer_config_review'; type = 'customer_config_review'; stage = 'configuration' },
            @{ property = 'dossier_type'; value = 'tongzhuo_customer_project_dossier'; type = 'customer_project_dossier'; stage = 'management_archive' },
            @{ property = 'portfolio_type'; value = 'tongzhuo_customer_portfolio_index'; type = 'customer_portfolio_index'; stage = 'portfolio_management' }
        )) {
            $value = Get-OptionalText -Value (Get-JsonProperty -Object $Json -Name $pair.property)
            if ($value -eq $pair.value) {
                return [ordered]@{ type = $pair.type; stage = $pair.stage }
            }
        }
        if ($null -ne (Get-JsonProperty -Object $Json -Name 'release_slug') -and $null -ne (Get-JsonProperty -Object $Json -Name 'delivery_package')) {
            return [ordered]@{ type = 'customer_release_manifest'; stage = 'release_package' }
        }
        if ($null -ne (Get-JsonProperty -Object $Json -Name 'acceptance_type') -or $name -like '*acceptance-report*.json') {
            return [ordered]@{ type = 'acceptance_report'; stage = 'post_launch_acceptance' }
        }
        if ($null -ne (Get-JsonProperty -Object $Json -Name 'evidence_pack_type') -or $name -like '*operations-evidence*.json') {
            return [ordered]@{ type = 'operations_evidence_pack'; stage = 'post_launch_acceptance' }
        }
        if ($null -ne (Get-JsonProperty -Object $Json -Name 'support_bundle_type') -or $name -like '*support-bundle*.json') {
            return [ordered]@{ type = 'support_bundle'; stage = 'support_archive' }
        }
    }

    if ($name -like '*proposal-brief*.json') { return [ordered]@{ type = 'customer_proposal_brief'; stage = 'sales_handoff' } }
    if ($name -like '*demo-script*.json') { return [ordered]@{ type = 'customer_demo_script'; stage = 'sales_handoff' } }
    if ($name -like '*intake-checklist*.json') { return [ordered]@{ type = 'customer_intake_checklist'; stage = 'implementation_intake' } }
    if ($name -like '*ai-visibility-audit*.json') { return [ordered]@{ type = 'ai_visibility_audit'; stage = 'website_ai_readiness' } }
    if ($name -like '*config-review*.json') { return [ordered]@{ type = 'customer_config_review'; stage = 'configuration' } }
    if ($name -like '*-manifest.json' -and $name -notlike '*release-manifest.json') { return [ordered]@{ type = 'customer_release_manifest'; stage = 'release_package' } }
    if ($name -like '*project-dossier*.json') { return [ordered]@{ type = 'customer_project_dossier'; stage = 'management_archive' } }
    if ($name -like '*acceptance-report*.json') { return [ordered]@{ type = 'acceptance_report'; stage = 'post_launch_acceptance' } }
    if ($name -like '*operations-evidence*.json') { return [ordered]@{ type = 'operations_evidence_pack'; stage = 'post_launch_acceptance' } }
    if ($name -like '*support-bundle*.json') { return [ordered]@{ type = 'support_bundle'; stage = 'support_archive' } }

    return $null
}

$artifactRecords = [System.Collections.ArrayList]::new()
$jsonFiles = @(Get-ChildItem -LiteralPath $scanRootPath -Recurse -File -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object {
    $relativePath = $_.FullName.Substring($scanRootPath.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $relativePath -notmatch '(^|[\\/])(node_modules|vendor|\.data|storage|logs|tmp|temp)([\\/]|$)'
})

foreach ($file in $jsonFiles) {
    $json = $null
    try {
        $json = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        $json = $null
    }
    $kind = Get-ArtifactKind -Path $file.FullName -Json $json
    if ($null -ne $kind) {
        [void] $artifactRecords.Add((New-ArtifactRecord -Type ([string] $kind.type) -Stage ([string] $kind.stage) -Path $file.FullName -Json $json))
    }
}

$records = @($artifactRecords | Sort-Object stage, artifact_type, file)
$requiredBeforeLaunch = @(
    'customer_proposal_brief',
    'customer_demo_script',
    'customer_intake_checklist',
    'ai_visibility_audit',
    'customer_release_manifest',
    'customer_project_dossier'
)
$recommendedAfterLaunch = @(
    'acceptance_report',
    'operations_evidence_pack',
    'support_bundle'
)

$presentTypes = @{}
foreach ($record in $records) {
    $presentTypes[[string] $record.artifact_type] = $true
}

$missingRequired = @($requiredBeforeLaunch | Where-Object { -not $presentTypes.ContainsKey($_) })
$missingRecommended = @($recommendedAfterLaunch | Where-Object { -not $presentTypes.ContainsKey($_) })
$dossierRecords = @($records | Where-Object { [string] $_.artifact_type -eq 'customer_project_dossier' })
$backendSnapshotRecords = @($dossierRecords | Where-Object { [bool] $_.geoflow_backend_snapshot_attached })
$backendScoreAverage = if ($backendSnapshotRecords.Count -gt 0) {
    [int] [Math]::Round((@($backendSnapshotRecords | ForEach-Object { [int] $_.backend_delivery_score }) | Measure-Object -Average).Average)
} else {
    0
}

$stageCounts = @{}
foreach ($record in $records) {
    $stage = [string] $record.stage
    if (-not $stageCounts.ContainsKey($stage)) {
        $stageCounts[$stage] = 0
    }
    $stageCounts[$stage] = [int] $stageCounts[$stage] + 1
}

$status = if ($records.Count -eq 0) {
    'empty'
} elseif ($missingRequired.Count -gt 0) {
    'needs_attention'
} elseif ($missingRecommended.Count -gt 0) {
    'ready_for_launch_evidence_pending'
} else {
    'complete'
}

$index = [ordered]@{
    evidence_index_type = 'tongzhuo_customer_evidence_index'
    status = $status
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $product.product
    version = [string] $product.version
    scan_root = $scanRootPath
    summary = [ordered]@{
        artifact_count = [int] $records.Count
        required_before_launch = [int] $requiredBeforeLaunch.Count
        missing_required_before_launch = [int] $missingRequired.Count
        recommended_after_launch = [int] $recommendedAfterLaunch.Count
        missing_recommended_after_launch = [int] $missingRecommended.Count
        customer_project_dossiers = [int] $dossierRecords.Count
        with_geoflow_backend_snapshot = [int] $backendSnapshotRecords.Count
        average_backend_delivery_score = [int] $backendScoreAverage
    }
    stage_counts = $stageCounts
    required_before_launch = $requiredBeforeLaunch
    recommended_after_launch = $recommendedAfterLaunch
    missing_required_before_launch = $missingRequired
    missing_recommended_after_launch = $missingRecommended
    artifacts = $records
    management_next_actions = @(
        'Create missing required-before-launch artifacts before customer go-live.',
        'Archive acceptance report, operations evidence pack, and support bundle after first production validation.',
        'Keep this evidence index beside the customer project dossier and portfolio index.',
        'Do not add platform passwords, cookies, captcha state, browser profiles, or API Tokens to evidence artifacts.'
    )
    security_boundary = [ordered]@{
        evidence_index_excludes_platform_credentials = $true
        evidence_index_excludes_api_tokens = $true
        evidence_index_excludes_browser_profiles = $true
        public_website_prices_excluded = $true
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $scanRootPath 'tongzhuo-customer-evidence-index.json'
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
$markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

$index | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

$artifactRows = if ($records.Count -gt 0) {
    @($records | ForEach-Object {
        "| $($_.stage) | $($_.artifact_type) | $($_.status) | $($_.backend_delivery_score) | $($_.backend_delivery_status) | $($_.file) | $($_.bytes) | $($_.sha256) |"
    })
} else {
    @('|  |  | empty | 0 |  |  | 0 |  |')
}
$stageRows = if ($stageCounts.Count -gt 0) {
    @($stageCounts.GetEnumerator() | Sort-Object Name | ForEach-Object { "| $($_.Key) | $($_.Value) |" })
} else {
    @('| empty | 0 |')
}
$missingRequiredLines = if ($missingRequired.Count -gt 0) {
    @($missingRequired | ForEach-Object { "- [ ] $_" })
} else {
    @('- No required-before-launch artifacts missing.')
}
$missingRecommendedLines = if ($missingRecommended.Count -gt 0) {
    @($missingRecommended | ForEach-Object { "- [ ] $_" })
} else {
    @('- No recommended-after-launch artifacts missing.')
}
$nextLines = @($index.management_next_actions | ForEach-Object { "- [ ] $_" })

$markdown = @(
    '# Tongzhuo Customer Evidence Index',
    '',
    "Status: $($index.status)",
    "Product: $($index.product)",
    "Version: $($index.version)",
    "Scan root: $($index.scan_root)",
    "Generated at: $($index.generated_at)",
    '',
    '## Summary',
    '',
    "- Artifact count: $($index.summary.artifact_count)",
    "- Missing required before launch: $($index.summary.missing_required_before_launch)",
    "- Missing recommended after launch: $($index.summary.missing_recommended_after_launch)",
    "- Customer project dossiers: $($index.summary.customer_project_dossiers)",
    "- With GEOFlow backend snapshot: $($index.summary.with_geoflow_backend_snapshot)",
    "- Average backend delivery score: $($index.summary.average_backend_delivery_score)",
    '',
    '## Stage Counts',
    '',
    '| Stage | Count |',
    '| --- | ---: |'
) + $stageRows + @(
    '',
    '## Missing Required Before Launch',
    ''
) + $missingRequiredLines + @(
    '',
    '## Missing Recommended After Launch',
    ''
) + $missingRecommendedLines + @(
    '',
    '## Artifacts',
    '',
    '| Stage | Type | Status | Backend Score | Backend Status | File | Bytes | SHA256 |',
    '| --- | --- | --- | ---: | --- | --- | ---: | --- |'
) + $artifactRows + @(
    '',
    '## Management Next Actions',
    ''
) + $nextLines + @(
    '',
    '## Security Boundary',
    '',
    '- Evidence index artifacts do not include platform credentials.',
    '- Evidence index artifacts do not include API Tokens.',
    '- Evidence index artifacts do not include cookies, captcha state, or browser profiles.',
    '- Public website content does not include service prices.'
)
Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    evidence_status = [string] $index.status
    evidence_index = $resolvedOutputPath
    markdown = $markdownPath
    artifact_count = [int] $records.Count
    missing_required_before_launch = [int] $missingRequired.Count
    version = [string] $product.version
} | ConvertTo-Json -Depth 4 | Write-Output
