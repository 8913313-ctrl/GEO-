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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-config-review-' + [guid]::NewGuid().ToString('N'))

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

    $readyConfigPath = Join-Path $testRoot 'ready-client.json'
    $readyReviewPath = Join-Path $testRoot 'ready-client-CONFIG-REVIEW.md'
    $readyReviewJsonPath = Join-Path $testRoot 'ready-client-CONFIG-REVIEW.json'

    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'ready-client' `
        -CompanyName 'Ready Client Network Technology Co Ltd' `
        -ShortName 'Ready Client' `
        -AlternateName 'Ready Client AI' `
        -Description 'Ready client config review fixture.' `
        -SiteUrl 'https://ready-client.company.cn' `
        -GeoFlowBaseUrl 'https://flow.ready-client.company.cn' `
        -Telephone '+86-100-0000-0000' `
        -Email 'service@ready-client.company.cn' `
        -Address 'No. 1 Ready Road' `
        -AddressRegion 'Ready City' `
        -UnifiedSocialCreditCode '91370000READYCLIENT' `
        -FoundingDate '2024-01-01' `
        -LogoPath 'assets/ready-logo.png' `
        -FooterIcp 'ICP-READY-001' `
        -OutputPath $readyConfigPath `
        -Force | Out-Null

    $readyResultJson = & (Join-Path $rootPath 'scripts\New-CustomerConfigReview.ps1') `
        -Root $rootPath `
        -ConfigPath $readyConfigPath `
        -OutputPath $readyReviewPath `
        -JsonOutputPath $readyReviewJsonPath
    $readyResult = $readyResultJson | ConvertFrom-Json
    Assert-Condition ([string] $readyResult.status -eq 'created') "Ready review status mismatch: $($readyResult.status)"
    Assert-Condition ([string] $readyResult.review_status -eq 'ready') "Ready review should be ready, got $($readyResult.review_status)"
    Assert-Condition ([int] $readyResult.warning_count -eq 0) "Ready review warning count should be 0, got $($readyResult.warning_count)"

    $readyReview = Get-Content -LiteralPath $readyReviewJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $readyReview.review_type -eq 'tongzhuo_customer_config_review') "Config review type mismatch: $($readyReview.review_type)"
    Assert-Condition ([string] $readyReview.endpoints.llms_txt -eq 'https://ready-client.company.cn/llms.txt') 'Config review should include llms.txt endpoint.'
    Assert-Condition ([string] $readyReview.endpoints.desktop_health -eq 'http://127.0.0.1:18280/healthz') 'Config review should include default desktop health endpoint.'
    Assert-Condition ([bool] $readyReview.validation.api_token_empty) 'Config review should declare API Token is empty.'
    Assert-Condition ([bool] $readyReview.contacts.logo_present) 'Ready config review should confirm a customer logo.'
    Assert-Condition ([bool] $readyReview.contacts.footer_icp_present) 'Ready config review should confirm an ICP value.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $readyReview.customer.project_id)) 'Ready config review should include project identity.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $readyReview.customer.tenant_id)) 'Ready config review should include tenant identity.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $readyReview.customer.industry_template)) 'Ready config review should include industry identity.'
    Assert-Condition ([string] $readyReview.methodology.core_version -eq 'MVER-GEO-CORE-V1') 'Ready config review should pin the formal methodology version.'
    Assert-Condition ([string] $readyReview.methodology.prompt_version -eq 'PVER-GEO-ARTICLE-V1') 'Ready config review should pin the formal prompt version.'
    Assert-Condition ([string] $readyReview.methodology.quality_rule_pack -eq 'QRULE-GEO-CONTENT-V1') 'Ready config review should pin the formal quality-rule pack.'
    Assert-Condition ([bool] $readyReview.production_readiness.ready) 'Ready config review should be production-ready.'
    Assert-Condition ([int] $readyReview.production_readiness.blocking_warning_count -eq 0) 'Ready config review should not have production blockers.'

    $warningConfigPath = Join-Path $testRoot 'warning-client.json'
    $warningReviewPath = Join-Path $testRoot 'warning-client-CONFIG-REVIEW.md'
    $warningReviewJsonPath = Join-Path $testRoot 'warning-client-CONFIG-REVIEW.json'

    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'warning-client' `
        -CompanyName 'Warning Client Network Technology Co Ltd' `
        -ShortName 'Warning Client' `
        -AlternateName 'Warning Client AI' `
        -Description 'Warning client config review fixture.' `
        -SiteUrl 'https://warning.example.com' `
        -GeoFlowBaseUrl 'http://127.0.0.1:18080' `
        -DesktopAgentPort 19280 `
        -OutputPath $warningConfigPath `
        -Force | Out-Null

    $warningResultJson = & (Join-Path $rootPath 'scripts\New-CustomerConfigReview.ps1') `
        -Root $rootPath `
        -ConfigPath $warningConfigPath `
        -OutputPath $warningReviewPath `
        -JsonOutputPath $warningReviewJsonPath
    $warningResult = $warningResultJson | ConvertFrom-Json
    Assert-Condition ([string] $warningResult.review_status -eq 'ready_with_warnings') "Warning review should be ready_with_warnings, got $($warningResult.review_status)"
    Assert-Condition ([int] $warningResult.warning_count -ge 5) "Warning review should contain at least 5 warnings, got $($warningResult.warning_count)"

    $warningReview = Get-Content -LiteralPath $warningReviewJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $warningCodes = @($warningReview.warnings | ForEach-Object { [string] $_.code })
    foreach ($code in @('placeholder_site_url', 'local_geoflow_url', 'missing_telephone', 'missing_email', 'missing_address', 'missing_logo', 'missing_icp')) {
        Assert-Condition ($warningCodes -contains $code) "Warning review is missing warning code: $code"
    }
    Assert-Condition (-not [bool] $warningReview.production_readiness.ready) 'Warning config review must not be production-ready.'
    Assert-Condition ([int] $warningReview.production_readiness.blocking_warning_count -ge 7) 'Warning config review should report its production blockers.'
    Assert-Condition ([string] $warningReview.endpoints.desktop_health -eq 'http://127.0.0.1:19280/healthz') 'Config review should use custom desktop agent port.'

    $warningMarkdown = Get-Content -LiteralPath $warningReviewPath -Raw -Encoding UTF8
    Assert-Condition ($warningMarkdown -like '*## Warnings*') 'Config review Markdown is missing Warnings section.'
    Assert-Condition ($warningMarkdown -like '*placeholder_site_url*') 'Config review Markdown should include placeholder_site_url warning.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer config review validation passed.'
