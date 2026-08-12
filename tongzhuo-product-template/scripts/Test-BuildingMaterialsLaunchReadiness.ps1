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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-building-materials-readiness-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param([Parameter(Mandatory = $true)] [bool]$Condition, [Parameter(Mandatory = $true)] [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Write-Json {
    param([Parameter(Mandatory = $true)] [string]$Path, [Parameter(Mandatory = $true)] [object]$Value)
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $configPath = Join-Path $testRoot 'building-materials-demo.json'
    $releaseRoot = Join-Path $testRoot 'release'
    $configReviewPath = Join-Path $testRoot 'config-review.json'
    $configReviewMarkdown = Join-Path $testRoot 'config-review.md'

    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'building-materials-demo' `
        -ProjectId 'building-materials-demo' `
        -TenantId 'tenant_building_materials_demo' `
        -IndustryTemplate 'building-materials' `
        -CompanyName 'Building Materials Demo' `
        -ShortName 'Building Materials Demo' `
        -SiteUrl 'https://building-materials.example.invalid' `
        -GeoFlowBaseUrl 'http://127.0.0.1:18080' `
        -OutputPath $configPath | Out-Null

    $reviewResult = (& (Join-Path $rootPath 'scripts\New-CustomerConfigReview.ps1') -Root $rootPath -ConfigPath $configPath -OutputPath $configReviewMarkdown -JsonOutputPath $configReviewPath) | ConvertFrom-Json
    Assert-Condition ([string]$reviewResult.review_status -eq 'ready_with_warnings') 'Building demo config review should be warning-only for demo packaging.'
    $review = Get-Content -LiteralPath $configReviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $codes = @($review.warnings | ForEach-Object { [string]$_.code })
    foreach ($code in @('placeholder_site_url','local_geoflow_url','missing_telephone','missing_email','missing_address','missing_credit_code','missing_logo','missing_icp')) {
        Assert-Condition ($codes -contains $code) "Building demo config review is missing $code."
    }
    Assert-Condition (-not [bool]$review.production_readiness.ready) 'Building demo config must be blocked for production launch.'

    $releaseResult = (& (Join-Path $rootPath 'scripts\New-CustomerDeliveryRelease.ps1') -ConfigPath $configPath -OutputRoot $releaseRoot -Force) | ConvertFrom-Json
    Assert-Condition ([string]$releaseResult.status -eq 'passed') 'Building demo delivery release should be package-valid.'
    $manifest = Get-Content -LiteralPath $releaseResult.release_manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string]$manifest.project_id -eq 'building-materials-demo') 'Release project ID mismatch.'
    Assert-Condition ([string]$manifest.tenant_id -eq 'tenant_building_materials_demo') 'Release tenant ID mismatch.'
    Assert-Condition ([string]$manifest.industry_template -eq 'building-materials') 'Release industry template mismatch.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$manifest.source_control.git_commit)) 'Release must record Git commit.'
    Assert-Condition ([string]$manifest.methodology.prompt_version -eq 'PVER-GEO-ARTICLE-V1') 'Release prompt version mismatch.'
    Assert-Condition ([string]$manifest.methodology.quality_rule_pack -eq 'QRULE-GEO-CONTENT-V1') 'Release quality rule pack mismatch.'

    $evidenceRoot = Join-Path $testRoot 'evidence'
    New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
    Write-Json -Path (Join-Path $evidenceRoot 'proposal-PROPOSAL-BRIEF.json') -Value ([ordered]@{ proposal_type = 'tongzhuo_customer_proposal_brief'; status = 'ready' })
    Write-Json -Path (Join-Path $evidenceRoot 'demo-DEMO-SCRIPT.json') -Value ([ordered]@{ demo_type = 'tongzhuo_customer_demo_script'; status = 'ready' })
    Write-Json -Path (Join-Path $evidenceRoot 'intake-checklist.json') -Value ([ordered]@{ intake_type = 'tongzhuo_customer_intake_checklist'; status = 'ready' })
    Write-Json -Path (Join-Path $evidenceRoot 'ai-visibility-audit.json') -Value ([ordered]@{ audit_type = 'tongzhuo_ai_visibility_audit'; audit_status = 'ready' })
    Copy-Item -LiteralPath $releaseResult.config_review_json -Destination (Join-Path $evidenceRoot 'building-materials-CONFIG-REVIEW.json')
    New-Item -ItemType Directory -Force -Path (Join-Path $evidenceRoot 'release') | Out-Null
    Copy-Item -LiteralPath $releaseResult.release_manifest -Destination (Join-Path $evidenceRoot 'release\building-materials-manifest.json')
    Write-Json -Path (Join-Path $evidenceRoot 'release\building-materials-PROJECT-DOSSIER.json') -Value ([ordered]@{ dossier_type = 'tongzhuo_customer_project_dossier'; status = 'ready_for_launch'; geoflow_backend_snapshot = [ordered]@{ attached = $true; delivery_status = 'ready'; delivery_score = 92; delivery_task_count = 1 } })
    $evidenceIndexPath = Join-Path $evidenceRoot 'evidence-index.json'
    (& (Join-Path $rootPath 'scripts\New-CustomerEvidenceIndex.ps1') -Root $rootPath -ScanRoot $evidenceRoot -OutputPath $evidenceIndexPath) | Out-Null
    $readinessPath = Join-Path $evidenceRoot 'launch-readiness.json'
    $readinessResult = (& (Join-Path $rootPath 'scripts\New-CustomerLaunchReadiness.ps1') -Root $rootPath -ScanRoot $evidenceRoot -EvidenceIndexPath $evidenceIndexPath -OutputPath $readinessPath) | ConvertFrom-Json
    Assert-Condition ([string]$readinessResult.readiness_status -eq 'blocked') 'Building demo production readiness must be blocked.'
    $readiness = Get-Content -LiteralPath $readinessPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $configGate = @($readiness.blocking_gates | Where-Object { [string]$_.id -eq 'config_review' })
    Assert-Condition ($configGate.Count -eq 1) 'Readiness must expose the blocked config_review gate.'
    Assert-Condition ([string]$configGate[0].evidence -like '*placeholder_site_url*') 'Readiness config gate must expose placeholder-domain evidence.'

    Write-Host 'Building-materials demo delivery is package-valid, but production launch is correctly blocked by placeholder identity/domain/contact/logo/ICP evidence.'
} finally {
    if (Test-Path $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
