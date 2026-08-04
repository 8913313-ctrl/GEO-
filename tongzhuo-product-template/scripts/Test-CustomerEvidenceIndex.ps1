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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-evidence-' + [guid]::NewGuid().ToString('N'))

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

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    Write-Json -Path (Join-Path $testRoot 'proposal-PROPOSAL-BRIEF.json') -Value ([ordered]@{ proposal_type = 'tongzhuo_customer_proposal_brief'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'demo-DEMO-SCRIPT.json') -Value ([ordered]@{ demo_type = 'tongzhuo_customer_demo_script'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'intake-checklist.json') -Value ([ordered]@{ intake_type = 'tongzhuo_customer_intake_checklist'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'ai-visibility-audit.json') -Value ([ordered]@{ audit_type = 'tongzhuo_ai_visibility_audit'; audit_status = 'ready_with_warnings' })
    Write-Json -Path (Join-Path $testRoot 'release\customer-v1-manifest.json') -Value ([ordered]@{ release_slug = 'customer-v1'; delivery_package = [ordered]@{ file = 'customer-v1.zip' } })
    Write-Json -Path (Join-Path $testRoot 'release\customer-PROJECT-DOSSIER.json') -Value ([ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'ready_for_launch'
        geoflow_backend_snapshot = [ordered]@{
            attached = $true
            delivery_status = 'ready'
            delivery_score = 92
            delivery_task_count = 1
        }
    })

    $pendingPath = Join-Path $testRoot 'evidence-index.json'
    $pendingResultJson = & (Join-Path $rootPath 'scripts\New-CustomerEvidenceIndex.ps1') -Root $rootPath -ScanRoot $testRoot -OutputPath $pendingPath
    $pendingResult = $pendingResultJson | ConvertFrom-Json
    Assert-Condition ([string] $pendingResult.status -eq 'created') "Pending evidence result mismatch: $($pendingResult.status)"
    Assert-Condition ([string] $pendingResult.evidence_status -eq 'ready_for_launch_evidence_pending') "Pending evidence status mismatch: $($pendingResult.evidence_status)"
    Assert-Condition ([int] $pendingResult.missing_required_before_launch -eq 0) 'Required-before-launch artifacts should be complete.'

    $pendingIndex = Get-Content -LiteralPath $pendingPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $pendingIndex.evidence_index_type -eq 'tongzhuo_customer_evidence_index') 'Evidence index type mismatch.'
    Assert-Condition ([string] $pendingIndex.version -eq $expectedVersion) "Evidence index version mismatch. Expected $expectedVersion, got $($pendingIndex.version)"
    Assert-Condition (@($pendingIndex.artifacts | Where-Object { [string] $_.artifact_type -eq 'customer_release_manifest' }).Count -eq 1) 'Evidence index should include release manifest.'
    Assert-Condition (@($pendingIndex.missing_recommended_after_launch).Count -eq 3) 'Pending evidence should miss three after-launch artifacts.'
    Assert-Condition ([int] $pendingIndex.summary.customer_project_dossiers -eq 1) 'Evidence index should count one customer project dossier.'
    Assert-Condition ([int] $pendingIndex.summary.with_geoflow_backend_snapshot -eq 1) 'Evidence index should count one GEOFlow backend snapshot.'
    Assert-Condition ([int] $pendingIndex.summary.average_backend_delivery_score -eq 92) 'Evidence index backend delivery score mismatch.'

    Write-Json -Path (Join-Path $testRoot 'acceptance-reports\acceptance-report.json') -Value ([ordered]@{ acceptance_type = 'tongzhuo_customer_acceptance_report'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'operations-evidence-packs\operations-evidence-pack.json') -Value ([ordered]@{ evidence_pack_type = 'tongzhuo_customer_operations_evidence_pack'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'support-bundles\support-bundle.json') -Value ([ordered]@{ support_bundle_type = 'tongzhuo_customer_support_bundle'; status = 'ready' })

    $completePath = Join-Path $testRoot 'complete-evidence-index.json'
    $completeResultJson = & (Join-Path $rootPath 'scripts\New-CustomerEvidenceIndex.ps1') -Root $rootPath -ScanRoot $testRoot -OutputPath $completePath
    $completeResult = $completeResultJson | ConvertFrom-Json
    Assert-Condition ([string] $completeResult.evidence_status -eq 'complete') "Complete evidence status mismatch: $($completeResult.evidence_status)"

    $completeIndex = Get-Content -LiteralPath $completePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition (@($completeIndex.missing_required_before_launch).Count -eq 0) 'Complete evidence should have no missing required artifacts.'
    Assert-Condition (@($completeIndex.missing_recommended_after_launch).Count -eq 0) 'Complete evidence should have no missing recommended artifacts.'
    Assert-Condition ([bool] $completeIndex.security_boundary.evidence_index_excludes_platform_credentials) 'Evidence index must declare platform credential boundary.'
    Assert-Condition (@($completeIndex.artifacts | Where-Object { [bool] $_.geoflow_backend_snapshot_attached }).Count -eq 1) 'Complete evidence should mark backend snapshot attachment.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($completePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Customer Evidence Index*') 'Evidence index Markdown is missing title.'
    Assert-Condition ($markdown -like '*Missing Required Before Launch*') 'Evidence index Markdown is missing required section.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Evidence index Markdown is missing security boundary.'
    Assert-Condition ($markdown -like '*Average backend delivery score*') 'Evidence index Markdown is missing backend score summary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer evidence index validation passed.'
