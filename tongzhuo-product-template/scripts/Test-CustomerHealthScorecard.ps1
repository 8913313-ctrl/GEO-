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
$expectedVersion = [string] $product.version
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-health-scorecard-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Write-Json {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [object]$Value
    )
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-RequiredArtifacts {
    param(
        [Parameter(Mandatory = $true)] [string]$Path
    )
    Write-Json -Path (Join-Path $Path 'proposal-PROPOSAL-BRIEF.json') -Value ([ordered]@{ proposal_type = 'tongzhuo_customer_proposal_brief'; status = 'ready' })
    Write-Json -Path (Join-Path $Path 'demo-DEMO-SCRIPT.json') -Value ([ordered]@{ demo_type = 'tongzhuo_customer_demo_script'; status = 'ready' })
    Write-Json -Path (Join-Path $Path 'intake-checklist.json') -Value ([ordered]@{ intake_type = 'tongzhuo_customer_intake_checklist'; status = 'ready' })
    Write-Json -Path (Join-Path $Path 'ai-visibility-audit.json') -Value ([ordered]@{ audit_type = 'tongzhuo_ai_visibility_audit'; audit_status = 'ready' })
    Write-Json -Path (Join-Path $Path 'config-review.json') -Value ([ordered]@{ review_type = 'tongzhuo_customer_config_review'; status = 'ready' })
    Write-Json -Path (Join-Path $Path 'release\customer-v1-manifest.json') -Value ([ordered]@{ release_slug = 'customer-v1'; delivery_package = [ordered]@{ file = 'customer-v1.zip' } })
    Write-Json -Path (Join-Path $Path 'release\customer-PROJECT-DOSSIER.json') -Value ([ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'ready_for_launch'
        geoflow_backend_snapshot = [ordered]@{
            attached = $true
            delivery_status = 'ready'
            delivery_score = 92
            delivery_task_count = 1
        }
    })
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    Write-RequiredArtifacts -Path $testRoot
    $pendingPath = Join-Path $testRoot 'pending-health-scorecard.json'
    $pendingResultJson = & (Join-Path $rootPath 'scripts\New-CustomerHealthScorecard.ps1') `
        -Root $rootPath `
        -ScanRoot $testRoot `
        -OutputPath $pendingPath
    $pendingResult = $pendingResultJson | ConvertFrom-Json
    Assert-Condition ([string] $pendingResult.status -eq 'created') "Pending health result mismatch: $($pendingResult.status)"
    Assert-Condition ([string] $pendingResult.health_status -eq 'needs_attention') "Pending health status mismatch: $($pendingResult.health_status)"
    Assert-Condition ([int] $pendingResult.blocking_gate_count -eq 0) 'Pending health should have no blocking gates.'
    Assert-Condition ([int] $pendingResult.watch_gate_count -eq 2) "Pending health should have two watch gates: $($pendingResult.watch_gate_count)"

    $pending = Get-Content -LiteralPath $pendingPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $pending.health_scorecard_type -eq 'tongzhuo_customer_health_scorecard') 'Health scorecard type mismatch.'
    Assert-Condition ([string] $pending.version -eq $expectedVersion) "Health scorecard version mismatch. Expected $expectedVersion, got $($pending.version)"
    Assert-Condition ([int] $pending.score -eq 70) "Pending health score mismatch: $($pending.score)"
    Assert-Condition ([bool] $pending.security_boundary.scorecard_excludes_platform_credentials) 'Health scorecard must exclude platform credentials.'
    Assert-Condition ([bool] $pending.summary.geoflow_backend_snapshot_ready) 'Pending health should record backend snapshot readiness.'
    Assert-Condition ([int] $pending.summary.geoflow_backend_snapshot_count -eq 1) 'Pending health backend snapshot count mismatch.'
    Assert-Condition (@($pending.risk_flags | Where-Object { [string] $_ -eq 'post_launch_evidence_incomplete' }).Count -eq 1) 'Pending health must flag incomplete post-launch evidence.'

    Write-Json -Path (Join-Path $testRoot 'acceptance-reports\acceptance-report.json') -Value ([ordered]@{ acceptance_type = 'tongzhuo_customer_acceptance_report'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'operations-evidence-packs\operations-evidence-pack.json') -Value ([ordered]@{ evidence_pack_type = 'tongzhuo_customer_operations_evidence_pack'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'support-bundles\support-bundle.json') -Value ([ordered]@{ support_bundle_type = 'tongzhuo_customer_support_bundle'; status = 'ready' })

    $completePath = Join-Path $testRoot 'complete-health-scorecard.json'
    $completeResultJson = & (Join-Path $rootPath 'scripts\New-CustomerHealthScorecard.ps1') `
        -Root $rootPath `
        -ScanRoot $testRoot `
        -OutputPath $completePath
    $completeResult = $completeResultJson | ConvertFrom-Json
    Assert-Condition ([string] $completeResult.health_status -eq 'healthy') "Complete health status mismatch: $($completeResult.health_status)"
    Assert-Condition ([int] $completeResult.score -eq 100) "Complete health score mismatch: $($completeResult.score)"
    Assert-Condition ([int] $completeResult.watch_gate_count -eq 0) 'Complete health should have no watch gates.'
    $complete = Get-Content -LiteralPath $completePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([bool] $complete.summary.geoflow_backend_snapshot_ready) 'Complete health should keep backend snapshot readiness.'

    $complete = Get-Content -LiteralPath $completePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([bool] $complete.summary.post_launch_complete) 'Complete health should mark post-launch evidence complete.'
    Assert-Condition (@($complete.next_month_actions).Count -ge 4) 'Complete health should include next-month actions.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($completePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Health Gates*') 'Health Markdown is missing Health Gates section.'
    Assert-Condition ($markdown -like '*Risk Flags*') 'Health Markdown is missing Risk Flags section.'
    Assert-Condition ($markdown -like '*Next Month Actions*') 'Health Markdown is missing Next Month Actions section.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Health Markdown is missing Security Boundary section.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer health scorecard validation passed.'
