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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-first-two-stages-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $outputPath = Join-Path $testRoot 'first-two-stages-preview.json'

    $resultJson = & (Join-Path $rootPath 'scripts\New-ProductFirstTwoStagesPreview.ps1') `
        -Root $rootPath `
        -OutputPath $outputPath
    $result = $resultJson | ConvertFrom-Json
    Assert-Condition ([string] $result.status -eq 'created') "Preview result mismatch: $($result.status)"
    Assert-Condition ([string] $result.preview_status -eq 'ready') "Preview status mismatch: $($result.preview_status)"
    Assert-Condition ([int] $result.failed_required_check_count -eq 0) "Preview should have zero failed checks: $($result.failed_required_check_count)"
    Assert-Condition (Test-Path $outputPath) 'Preview JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($outputPath, '.md'))) 'Preview Markdown was not created.'

    $preview = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $preview.preview_type -eq 'tongzhuo_product_first_two_stages_preview') 'Preview type mismatch.'
    Assert-Condition ([string] $preview.version -eq $expectedVersion) "Preview version mismatch. Expected $expectedVersion, got $($preview.version)"
    Assert-Condition ([string] $preview.status -eq 'ready') "Preview JSON status mismatch: $($preview.status)"
    Assert-Condition ([int] $preview.summary.stage_count -eq 2) 'Preview should contain two stages.'
    Assert-Condition ([string] $preview.summary.stage_1_status -eq 'ready') 'Stage 1 should be ready.'
    Assert-Condition ([string] $preview.summary.stage_2_status -eq 'ready') 'Stage 2 should be ready.'
    Assert-Condition ([int] $preview.summary.check_count -ge 25) 'Preview should include the standard first-two-stage checks.'
    Assert-Condition (@($preview.checks | Where-Object { [string] $_.id -eq 'wechat_ready' -and [bool] $_.passed }).Count -eq 1) 'WeChat MP ready check should pass.'
    Assert-Condition (@($preview.checks | Where-Object { [string] $_.id -eq 'zhihu_ready' -and [bool] $_.passed }).Count -eq 1) 'Zhihu ready check should pass.'
    Assert-Condition (@($preview.checks | Where-Object { [string] $_.id -eq 'toutiao_ready' -and [bool] $_.passed }).Count -eq 1) 'Toutiao ready check should pass.'
    Assert-Condition ([bool] $preview.boundaries.platform_credentials_stay_local) 'Preview must declare local platform credential boundary.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($outputPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Stage Summary*') 'Preview Markdown is missing Stage Summary.'
    Assert-Condition ($markdown -like '*Demo Flow*') 'Preview Markdown is missing Demo Flow.'
    Assert-Condition ($markdown -like '*Boundaries*') 'Preview Markdown is missing Boundaries.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Product first two stages preview validation passed.'
