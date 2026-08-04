[CmdletBinding()]
param(
    [string]$Root = '',
    [Parameter(Mandatory = $true)] [string]$ScanRoot,
    [string]$EvidenceIndexPath = '',
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

function New-Gate {
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
        status = if ($Passed) { 'passed' } elseif ($Blocking) { 'blocked' } else { 'warning' }
        evidence = $Evidence
        next_action = $NextAction
    }
}

$temporaryEvidenceIndex = $false
if ([string]::IsNullOrWhiteSpace($EvidenceIndexPath)) {
    $temporaryEvidenceIndex = $true
    $EvidenceIndexPath = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-launch-readiness-evidence-' + [guid]::NewGuid().ToString('N') + '.json')
    & (Join-Path $rootPath 'scripts\New-CustomerEvidenceIndex.ps1') `
        -Root $rootPath `
        -ScanRoot $scanRootPath `
        -OutputPath $EvidenceIndexPath | Out-Null
} else {
    $EvidenceIndexPath = (Resolve-Path $EvidenceIndexPath).Path
}

try {
    $evidenceIndex = Get-Content -LiteralPath $EvidenceIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $artifacts = @($evidenceIndex.artifacts)
    $missingRequired = @($evidenceIndex.missing_required_before_launch)
    $missingRecommended = @($evidenceIndex.missing_recommended_after_launch)

    $aiAudit = @($artifacts | Where-Object { [string] $_.artifact_type -eq 'ai_visibility_audit' })
    $releaseManifest = @($artifacts | Where-Object { [string] $_.artifact_type -eq 'customer_release_manifest' })
    $dossier = @($artifacts | Where-Object { [string] $_.artifact_type -eq 'customer_project_dossier' })
    $configReview = @($artifacts | Where-Object { [string] $_.artifact_type -eq 'customer_config_review' })
    $backendReadyDossier = @($dossier | Where-Object {
        [bool] $_.geoflow_backend_snapshot_attached -and
        [int] $_.backend_delivery_score -ge 80 -and
        [string] $_.backend_delivery_status -ne 'risk'
    })

    $dossierReady = @($dossier | Where-Object { [string] $_.status -eq 'ready_for_launch' }).Count -gt 0
    $backendSnapshotReady = $backendReadyDossier.Count -gt 0
    $aiAuditUsable = @($aiAudit | Where-Object { [string] $_.status -ne 'failed' }).Count -gt 0
    $securityBoundary = $true
    if ($null -ne $evidenceIndex.security_boundary) {
        $securityBoundary = [bool] $evidenceIndex.security_boundary.evidence_index_excludes_platform_credentials -and
            [bool] $evidenceIndex.security_boundary.evidence_index_excludes_api_tokens -and
            [bool] $evidenceIndex.security_boundary.evidence_index_excludes_browser_profiles
    }

    $gates = @(
        New-Gate -Id 'required_artifacts' -Name 'Required before launch artifacts' -Weight 25 `
            -Passed ($missingRequired.Count -eq 0) -Blocking $true `
            -Evidence "Missing required artifact count: $($missingRequired.Count)" `
            -NextAction 'Create the missing proposal, demo, intake, AI audit, release manifest, or project dossier artifact.'
        New-Gate -Id 'ai_visibility' -Name 'AI visibility audit usable' -Weight 20 `
            -Passed $aiAuditUsable -Blocking $true `
            -Evidence "AI audit artifacts: $($aiAudit.Count)" `
            -NextAction 'Run Start-ProductDelivery.ps1 -Action AIVisibility and resolve failed checks.'
        New-Gate -Id 'release_manifest' -Name 'Customer release manifest present' -Weight 15 `
            -Passed ($releaseManifest.Count -gt 0) -Blocking $true `
            -Evidence "Release manifest artifacts: $($releaseManifest.Count)" `
            -NextAction 'Create and validate a formal customer release before launch.'
        New-Gate -Id 'project_dossier' -Name 'Project dossier is launch-ready' -Weight 10 `
            -Passed $dossierReady -Blocking $true `
            -Evidence "Dossier artifacts: $($dossier.Count); ready_for_launch: $dossierReady" `
            -NextAction 'Generate CustomerDossier and resolve its release, config, and handoff warnings.'
        New-Gate -Id 'geoflow_backend_snapshot' -Name 'GEOFlow backend snapshot is launch-ready' -Weight 10 `
            -Passed $backendSnapshotReady -Blocking $true `
            -Evidence "Backend snapshots ready: $($backendReadyDossier.Count); dossier artifacts: $($dossier.Count)" `
            -NextAction 'Download the GEOFlow backend dossier JSON, attach it with -BackendDossierPath, and resolve delivery score or status gaps.'
        New-Gate -Id 'config_review' -Name 'Customer config review exists' -Weight 5 `
            -Passed ($configReview.Count -gt 0) -Blocking $false `
            -Evidence "Config review artifacts: $($configReview.Count)" `
            -NextAction 'Generate a customer config review and review production URL, ports, contacts, and token boundary.'
        New-Gate -Id 'security_boundary' -Name 'Evidence security boundary declared' -Weight 5 `
            -Passed $securityBoundary -Blocking $true `
            -Evidence "Platform credentials, API Tokens, and browser profiles excluded: $securityBoundary" `
            -NextAction 'Remove credentials from evidence artifacts and regenerate the evidence index.'
        New-Gate -Id 'post_launch_evidence' -Name 'Post-launch evidence archived' -Weight 10 `
            -Passed ($missingRecommended.Count -eq 0) -Blocking $false `
            -Evidence "Missing recommended after-launch artifacts: $($missingRecommended.Count)" `
            -NextAction 'After first production validation, archive AcceptanceReport, OperationsEvidencePack, and SupportBundle.'
    )

    $score = [int] (($gates | Where-Object { [bool] $_.passed } | Measure-Object -Property weight -Sum).Sum)
    $blockingGates = @($gates | Where-Object { [bool] $_.blocking -and -not [bool] $_.passed })
    $warningGates = @($gates | Where-Object { -not [bool] $_.blocking -and -not [bool] $_.passed })
    $status = if ($blockingGates.Count -gt 0) {
        'blocked'
    } elseif ($warningGates.Count -gt 0) {
        'ready_with_warnings'
    } else {
        'ready'
    }

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $OutputPath = Join-Path $scanRootPath 'tongzhuo-customer-launch-readiness.json'
    }
    $resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

    $readiness = [ordered]@{
        launch_readiness_type = 'tongzhuo_customer_launch_readiness'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = [string] $product.version
        scan_root = $scanRootPath
        evidence_index = [IO.Path]::GetFullPath($EvidenceIndexPath)
        score = $score
        summary = [ordered]@{
            gate_count = [int] $gates.Count
            passed_gate_count = [int] @($gates | Where-Object { [bool] $_.passed }).Count
            blocking_gate_count = [int] $blockingGates.Count
            warning_gate_count = [int] $warningGates.Count
            missing_required_before_launch = [int] $missingRequired.Count
            missing_recommended_after_launch = [int] $missingRecommended.Count
            geoflow_backend_snapshot_ready = [bool] $backendSnapshotReady
            geoflow_backend_snapshot_count = [int] $backendReadyDossier.Count
        }
        gates = $gates
        blocking_gates = @($blockingGates)
        warning_gates = @($warningGates)
        management_next_actions = @(
            'Do not launch while any blocking gate remains blocked.',
            'Resolve warning gates before customer signoff when the related evidence is available.',
            'Attach a fresh GEOFlow backend dossier export before customer launch review.',
            'Archive this readiness scorecard with the project dossier and evidence index.',
            'Re-run after domain, release, AI audit, dossier, acceptance, or support evidence changes.'
        )
        security_boundary = [ordered]@{
            scorecard_excludes_platform_credentials = $true
            scorecard_excludes_api_tokens = $true
            scorecard_excludes_browser_profiles = $true
            public_website_prices_excluded = $true
        }
    }

    $readiness | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

    $gateRows = @($gates | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.weight) | $($_.evidence) | $($_.next_action) |"
    })
    $blockingLines = if ($blockingGates.Count -gt 0) {
        @($blockingGates | ForEach-Object { "- [ ] $($_.name): $($_.next_action)" })
    } else {
        @('- No blocking gates.')
    }
    $warningLines = if ($warningGates.Count -gt 0) {
        @($warningGates | ForEach-Object { "- [ ] $($_.name): $($_.next_action)" })
    } else {
        @('- No warning gates.')
    }

    $markdown = @(
        '# Tongzhuo Customer Launch Readiness',
        '',
        "Status: $status",
        "Score: $score/100",
        "Product: $($readiness.product)",
        "Version: $($readiness.version)",
        "Scan root: $scanRootPath",
        '',
        '## Gate Results',
        '',
        '| Gate | Status | Weight | Evidence | Next Action |',
        '| --- | --- | ---: | --- | --- |'
    ) + $gateRows + @(
        '',
        '## Blocking Gates',
        ''
    ) + $blockingLines + @(
        '',
        '## Warning Gates',
        ''
    ) + $warningLines + @(
        '',
        '## Decision',
        '',
        '- `ready`: no blocking or warning gates remain.',
        '- `ready_with_warnings`: no launch blockers remain, but post-launch evidence or non-blocking review remains.',
        '- `blocked`: at least one required launch gate is not passed.',
        '',
        '## Security Boundary',
        '',
        '- The scorecard contains no platform credentials, API Tokens, cookies, captcha state, or browser profiles.',
        '- Public website content does not include service prices.'
    )
    Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    [ordered]@{
        status = 'created'
        readiness_status = $status
        score = $score
        readiness = $resolvedOutputPath
        markdown = $markdownPath
        blocking_gate_count = [int] $blockingGates.Count
        warning_gate_count = [int] $warningGates.Count
        version = [string] $product.version
    } | ConvertTo-Json -Depth 4 | Write-Output
} finally {
    if ($temporaryEvidenceIndex -and (Test-Path $EvidenceIndexPath)) {
        Remove-Item -LiteralPath $EvidenceIndexPath -Force -ErrorAction SilentlyContinue
        $temporaryMarkdown = [IO.Path]::ChangeExtension($EvidenceIndexPath, '.md')
        if (Test-Path $temporaryMarkdown) {
            Remove-Item -LiteralPath $temporaryMarkdown -Force -ErrorAction SilentlyContinue
        }
    }
}
