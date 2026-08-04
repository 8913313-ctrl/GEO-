[CmdletBinding()]
param(
    [string]$Root = '',
    [Parameter(Mandatory = $true)] [string]$ScanRoot,
    [string]$EvidenceIndexPath = '',
    [string]$LaunchReadinessPath = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$scanRootPath = (Resolve-Path $ScanRoot).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath

function Get-OptionalText {
    param([object]$Value)
    if ($null -eq $Value) {
        return ''
    }
    return [string] $Value
}

function New-HealthGate {
    param(
        [Parameter(Mandatory = $true)] [string]$Id,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [int]$Weight,
        [Parameter(Mandatory = $true)] [bool]$Passed,
        [Parameter(Mandatory = $true)] [bool]$Blocking,
        [Parameter(Mandatory = $true)] [string]$Evidence,
        [Parameter(Mandatory = $true)] [string]$NextAction
    )
    [pscustomobject][ordered]@{
        id = $Id
        name = $Name
        weight = $Weight
        passed = $Passed
        blocking = $Blocking
        status = if ($Passed) { 'passed' } elseif ($Blocking) { 'blocked' } else { 'watch' }
        evidence = $Evidence
        next_action = $NextAction
    }
}

function Test-ArtifactPresent {
    param(
        [Parameter(Mandatory = $true)] [object[]]$Artifacts,
        [Parameter(Mandatory = $true)] [string]$Type
    )
    return @($Artifacts | Where-Object { [string] $_.artifact_type -eq $Type }).Count -gt 0
}

$temporaryEvidenceIndex = $false
$temporaryLaunchReadiness = $false
if ([string]::IsNullOrWhiteSpace($EvidenceIndexPath)) {
    $temporaryEvidenceIndex = $true
    $EvidenceIndexPath = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-health-evidence-' + [guid]::NewGuid().ToString('N') + '.json')
    & (Join-Path $rootPath 'scripts\New-CustomerEvidenceIndex.ps1') `
        -Root $rootPath `
        -ScanRoot $scanRootPath `
        -OutputPath $EvidenceIndexPath | Out-Null
} else {
    $EvidenceIndexPath = (Resolve-Path $EvidenceIndexPath).Path
}

if ([string]::IsNullOrWhiteSpace($LaunchReadinessPath)) {
    $temporaryLaunchReadiness = $true
    $LaunchReadinessPath = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-health-launch-' + [guid]::NewGuid().ToString('N') + '.json')
    & (Join-Path $rootPath 'scripts\New-CustomerLaunchReadiness.ps1') `
        -Root $rootPath `
        -ScanRoot $scanRootPath `
        -EvidenceIndexPath $EvidenceIndexPath `
        -OutputPath $LaunchReadinessPath | Out-Null
} else {
    $LaunchReadinessPath = (Resolve-Path $LaunchReadinessPath).Path
}

try {
    $evidenceIndex = Get-Content -LiteralPath $EvidenceIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $launchReadiness = Get-Content -LiteralPath $LaunchReadinessPath -Raw -Encoding UTF8 | ConvertFrom-Json

    $artifacts = @($evidenceIndex.artifacts)
    $missingRequired = @($evidenceIndex.missing_required_before_launch)
    $missingRecommended = @($evidenceIndex.missing_recommended_after_launch)

    $launchStatus = Get-OptionalText -Value $launchReadiness.status
    $launchScore = [int] $launchReadiness.score
    $blockingLaunchGates = @($launchReadiness.blocking_gates)
    $warningLaunchGates = @($launchReadiness.warning_gates)
    $backendSnapshotReady = $false
    $backendSnapshotCount = 0
    if ($null -ne $launchReadiness.summary) {
        if ($null -ne $launchReadiness.summary.PSObject.Properties['geoflow_backend_snapshot_ready']) {
            $backendSnapshotReady = [bool] $launchReadiness.summary.geoflow_backend_snapshot_ready
        }
        if ($null -ne $launchReadiness.summary.PSObject.Properties['geoflow_backend_snapshot_count']) {
            $backendSnapshotCount = [int] $launchReadiness.summary.geoflow_backend_snapshot_count
        }
    }

    $hasAcceptance = Test-ArtifactPresent -Artifacts $artifacts -Type 'acceptance_report'
    $hasOperationsEvidence = Test-ArtifactPresent -Artifacts $artifacts -Type 'operations_evidence_pack'
    $hasSupportBundle = Test-ArtifactPresent -Artifacts $artifacts -Type 'support_bundle'
    $hasAiAudit = Test-ArtifactPresent -Artifacts $artifacts -Type 'ai_visibility_audit'
    $postLaunchComplete = $hasAcceptance -and $hasOperationsEvidence -and $hasSupportBundle

    $aiAuditFailed = @($artifacts | Where-Object {
        [string] $_.artifact_type -eq 'ai_visibility_audit' -and [string] $_.status -eq 'failed'
    }).Count -gt 0
    $securityBoundary = $true
    if ($null -ne $evidenceIndex.security_boundary) {
        $securityBoundary = [bool] $evidenceIndex.security_boundary.evidence_index_excludes_platform_credentials -and
            [bool] $evidenceIndex.security_boundary.evidence_index_excludes_api_tokens -and
            [bool] $evidenceIndex.security_boundary.evidence_index_excludes_browser_profiles
    }
    if ($null -ne $launchReadiness.security_boundary) {
        $securityBoundary = $securityBoundary -and
            [bool] $launchReadiness.security_boundary.scorecard_excludes_platform_credentials -and
            [bool] $launchReadiness.security_boundary.scorecard_excludes_api_tokens -and
            [bool] $launchReadiness.security_boundary.scorecard_excludes_browser_profiles
    }

    $gates = @(
        New-HealthGate -Id 'launch_readiness' -Name 'Launch readiness remains usable' -Weight 30 `
            -Passed (($blockingLaunchGates.Count -eq 0) -and ($launchStatus -eq 'ready' -or $launchStatus -eq 'ready_with_warnings')) -Blocking $true `
            -Evidence "Launch status: $launchStatus; score: $launchScore; blocking gates: $($blockingLaunchGates.Count)" `
            -NextAction 'Resolve blocked launch gates before presenting the account as healthy.'
        New-HealthGate -Id 'delivery_evidence' -Name 'Required delivery evidence complete' -Weight 20 `
            -Passed ($missingRequired.Count -eq 0) -Blocking $true `
            -Evidence "Missing required-before-launch artifacts: $($missingRequired.Count)" `
            -NextAction 'Complete proposal, demo, intake, AI audit, release manifest, and project dossier evidence.'
        New-HealthGate -Id 'post_launch_acceptance' -Name 'Post-launch acceptance and operations evidence archived' -Weight 20 `
            -Passed ($hasAcceptance -and $hasOperationsEvidence) -Blocking $false `
            -Evidence "Acceptance report: $hasAcceptance; operations evidence pack: $hasOperationsEvidence" `
            -NextAction 'Archive customer acceptance and operations evidence after the first production validation.'
        New-HealthGate -Id 'support_archive' -Name 'Support bundle archived' -Weight 10 `
            -Passed $hasSupportBundle -Blocking $false `
            -Evidence "Support bundle present: $hasSupportBundle" `
            -NextAction 'Create a sanitized support bundle for customer success, rollback, and upgrade work.'
        New-HealthGate -Id 'geoflow_backend_snapshot' -Name 'GEOFlow backend snapshot remains usable' -Weight 10 `
            -Passed $backendSnapshotReady -Blocking $false `
            -Evidence "Backend snapshot ready: $backendSnapshotReady; ready snapshot count: $backendSnapshotCount" `
            -NextAction 'Refresh the GEOFlow backend dossier export and resolve delivery score or status gaps.'
        New-HealthGate -Id 'ai_visibility' -Name 'AI visibility evidence remains usable' -Weight 5 `
            -Passed ($hasAiAudit -and -not $aiAuditFailed) -Blocking $false `
            -Evidence "AI audit present: $hasAiAudit; failed audit found: $aiAuditFailed" `
            -NextAction 'Re-run AI visibility audit after website, article, sitemap, RSS, or llms entrypoint changes.'
        New-HealthGate -Id 'security_boundary' -Name 'Credential and price boundary preserved' -Weight 5 `
            -Passed $securityBoundary -Blocking $true `
            -Evidence "Credentials, API Tokens, browser profiles, and public prices excluded: $securityBoundary" `
            -NextAction 'Remove sensitive material from evidence and regenerate the scorecard.'
    )

    $score = [int] (($gates | Where-Object { [bool] $_.passed } | Measure-Object -Property weight -Sum).Sum)
    $blockingGates = @($gates | Where-Object { [bool] $_.blocking -and -not [bool] $_.passed })
    $watchGates = @($gates | Where-Object { -not [bool] $_.blocking -and -not [bool] $_.passed })

    $status = if ($blockingGates.Count -gt 0) {
        'blocked'
    } elseif (-not $postLaunchComplete) {
        'needs_attention'
    } elseif ($warningLaunchGates.Count -gt 0 -or $watchGates.Count -gt 0 -or $score -lt 90) {
        'watch'
    } else {
        'healthy'
    }

    $riskFlags = [System.Collections.ArrayList]::new()
    if ($blockingGates.Count -gt 0) {
        [void] $riskFlags.Add('blocking_delivery_or_security_gate')
    }
    if (-not $postLaunchComplete) {
        [void] $riskFlags.Add('post_launch_evidence_incomplete')
    }
    if ($warningLaunchGates.Count -gt 0) {
        [void] $riskFlags.Add('launch_readiness_warnings_remain')
    }
    if (-not $backendSnapshotReady) {
        [void] $riskFlags.Add('geoflow_backend_snapshot_missing_or_weak')
    }
    if ($score -lt 90) {
        [void] $riskFlags.Add('health_score_below_90')
    }

    $nextMonthActions = @(
        'Review article publication cadence, website article index, sitemap, RSS, and llms entrypoints with the customer.',
        'Confirm desktop publisher agent status, platform login health, failed distribution tasks, and evidence writeback.',
        'Archive acceptance, operations evidence, and support bundle updates after each customer success review.',
        'Refresh AI visibility audit after website structure, service page, or article strategy changes.',
        'Keep platform passwords, cookies, captcha state, browser profiles, and API Tokens out of customer artifacts.'
    )

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $OutputPath = Join-Path $scanRootPath 'tongzhuo-customer-health-scorecard.json'
    }
    $resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

    $scorecard = [ordered]@{
        health_scorecard_type = 'tongzhuo_customer_health_scorecard'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = [string] $product.version
        scan_root = $scanRootPath
        evidence_index = [IO.Path]::GetFullPath($EvidenceIndexPath)
        launch_readiness = [IO.Path]::GetFullPath($LaunchReadinessPath)
        score = $score
        summary = [ordered]@{
            gate_count = [int] $gates.Count
            passed_gate_count = [int] @($gates | Where-Object { [bool] $_.passed }).Count
            blocking_gate_count = [int] $blockingGates.Count
            watch_gate_count = [int] $watchGates.Count
            launch_status = $launchStatus
            launch_score = $launchScore
            missing_required_before_launch = [int] $missingRequired.Count
            missing_recommended_after_launch = [int] $missingRecommended.Count
            post_launch_complete = [bool] $postLaunchComplete
            geoflow_backend_snapshot_ready = [bool] $backendSnapshotReady
            geoflow_backend_snapshot_count = [int] $backendSnapshotCount
        }
        gates = $gates
        blocking_gates = $blockingGates
        watch_gates = $watchGates
        risk_flags = @($riskFlags)
        next_month_actions = $nextMonthActions
        status_rules = [ordered]@{
            healthy = 'Score is at least 90, no blocking gates remain, and post-launch evidence is complete.'
            watch = 'No blocking gate remains, but launch warnings or non-blocking health gaps should be reviewed.'
            needs_attention = 'Required launch evidence is usable, but post-launch acceptance, operations, or support evidence is incomplete.'
            blocked = 'A required delivery, launch, or security gate is not passed.'
        }
        security_boundary = [ordered]@{
            scorecard_excludes_platform_credentials = $true
            scorecard_excludes_api_tokens = $true
            scorecard_excludes_browser_profiles = $true
            public_website_prices_excluded = $true
        }
    }

    $scorecard | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

    $gateRows = @($gates | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.weight) | $($_.evidence) | $($_.next_action) |"
    })
    $riskLines = if ($riskFlags.Count -gt 0) {
        @($riskFlags | ForEach-Object { "- $_" })
    } else {
        @('- No active health risk flags.')
    }
    $actionLines = @($nextMonthActions | ForEach-Object { "- [ ] $_" })

    $markdown = @(
        '# Tongzhuo Customer Health Scorecard',
        '',
        "Status: $status",
        "Score: $score/100",
        "Product: $($scorecard.product)",
        "Version: $($scorecard.version)",
        "Scan root: $scanRootPath",
        '',
        '## Health Gates',
        '',
        '| Gate | Status | Weight | Evidence | Next Action |',
        '| --- | --- | ---: | --- | --- |'
    ) + $gateRows + @(
        '',
        '## Risk Flags',
        ''
    ) + $riskLines + @(
        '',
        '## Next Month Actions',
        ''
    ) + $actionLines + @(
        '',
        '## Status Rules',
        '',
        '- `healthy`: score is at least 90, no blocking gates remain, and post-launch evidence is complete.',
        '- `watch`: no blocking gate remains, but launch warnings or non-blocking health gaps should be reviewed.',
        '- `needs_attention`: required launch evidence is usable, but post-launch acceptance, operations, or support evidence is incomplete.',
        '- `blocked`: a required delivery, launch, or security gate is not passed.',
        '',
        '## Security Boundary',
        '',
        '- The scorecard contains no platform credentials, API Tokens, cookies, captcha state, or browser profiles.',
        '- Public website content does not include service prices.'
    )
    Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    [ordered]@{
        status = 'created'
        health_status = $status
        score = $score
        scorecard = $resolvedOutputPath
        markdown = $markdownPath
        blocking_gate_count = [int] $blockingGates.Count
        watch_gate_count = [int] $watchGates.Count
        version = [string] $product.version
    } | ConvertTo-Json -Depth 4 | Write-Output
} finally {
    if ($temporaryEvidenceIndex -and (Test-Path $EvidenceIndexPath)) {
        Remove-Item -LiteralPath $EvidenceIndexPath -Force -ErrorAction SilentlyContinue
        $temporaryEvidenceMarkdown = [IO.Path]::ChangeExtension($EvidenceIndexPath, '.md')
        if (Test-Path $temporaryEvidenceMarkdown) {
            Remove-Item -LiteralPath $temporaryEvidenceMarkdown -Force -ErrorAction SilentlyContinue
        }
    }
    if ($temporaryLaunchReadiness -and (Test-Path $LaunchReadinessPath)) {
        Remove-Item -LiteralPath $LaunchReadinessPath -Force -ErrorAction SilentlyContinue
        $temporaryLaunchMarkdown = [IO.Path]::ChangeExtension($LaunchReadinessPath, '.md')
        if (Test-Path $temporaryLaunchMarkdown) {
            Remove-Item -LiteralPath $temporaryLaunchMarkdown -Force -ErrorAction SilentlyContinue
        }
    }
}
