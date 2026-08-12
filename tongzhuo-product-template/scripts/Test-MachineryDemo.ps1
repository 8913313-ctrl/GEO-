[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-machinery-demo-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param([Parameter(Mandatory = $true)] [bool]$Condition, [Parameter(Mandatory = $true)] [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $configPath = Join-Path $testRoot 'machinery-demo.json'
    $deliveryRoot = Join-Path $testRoot 'delivery'
    $deliveryZip = Join-Path $testRoot 'machinery-demo-delivery.zip'
    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'machinery-demo' `
        -ProjectId 'machinery-demo' `
        -TenantId 'tenant_machinery_demo' `
        -IndustryTemplate 'machinery' `
        -CompanyName 'Machinery Industry Demo' `
        -ShortName 'Machinery Demo' `
        -AlternateName 'Machinery Demo' `
        -Description 'Demonstration configuration for machinery equipment selection and delivery information.' `
        -SiteUrl 'https://machinery.example.invalid' `
        -WorkbenchUrl 'https://machinery.example.invalid' `
        -GeoFlowBaseUrl 'http://127.0.0.1:18080' `
        -Services @('Equipment selection support', 'Technical parameter materials', 'Delivery and service guidance') `
        -PublishMode 'draft' `
        -OutputPath $configPath | Out-Null
    $validated = (& (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $configPath) | ConvertFrom-Json
    Assert-Condition ([string]$validated.project_id -eq 'machinery-demo') 'Machinery demo project ID mismatch.'
    Assert-Condition ([string]$validated.tenant_id -eq 'tenant_machinery_demo') 'Machinery demo tenant ID mismatch.'
    Assert-Condition ([string]$validated.industry_template -eq 'machinery') 'Machinery demo industry template mismatch.'
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string]$config.methodology.core_version -eq 'MVER-GEO-CORE-V1') 'Machinery demo must pin the formal methodology version.'
    Assert-Condition ([string]$config.methodology.prompt_version -eq 'PVER-GEO-ARTICLE-V1') 'Machinery demo must pin the formal prompt version.'
    Assert-Condition ([string]$config.methodology.quality_rule_pack -eq 'QRULE-GEO-CONTENT-V1') 'Machinery demo must pin the formal quality-rule pack.'
    Assert-Condition ([string]$config.website.telephone -eq '') 'Machinery demo must not invent a telephone number.'
    Assert-Condition ([string]$config.website.email -eq '') 'Machinery demo must not invent an email address.'
    Assert-Condition ([string]$config.site.footer_icp -eq '') 'Machinery demo must not invent an ICP filing.'
    $delivery = (& (Join-Path $rootPath 'scripts\New-CustomerDeliveryFromConfig.ps1') -ConfigPath $configPath -OutputRoot $deliveryRoot -DeliveryOutputPath $deliveryZip) | ConvertFrom-Json
    Assert-Condition (Test-Path $delivery.delivery_package) 'Machinery demo delivery ZIP was not created.'
    & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryPackage.ps1') -PackagePath $delivery.delivery_package -ExpectedVersion '1.8.14'
    $reviewPath = Join-Path $testRoot 'machinery-CONFIG-REVIEW.json'
    (& (Join-Path $rootPath 'scripts\New-CustomerConfigReview.ps1') -Root $rootPath -ConfigPath $configPath -JsonOutputPath $reviewPath) | Out-Null
    $review = Get-Content -LiteralPath $reviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition (-not [bool]$review.production_readiness.ready) 'Machinery demo must be blocked for production until real identity and contact data exists.'
    Assert-Condition (@($review.production_readiness.blocking_warning_codes) -contains 'placeholder_site_url') 'Machinery demo must expose its placeholder domain as a production blocker.'
    Write-Host 'Machinery demo config, formal GEO version pins, delivery package validation, no-invented-identity and production-blocker checks passed.'
} finally {
    if (Test-Path $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
