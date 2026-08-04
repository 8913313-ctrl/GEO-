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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-demo-' + [guid]::NewGuid().ToString('N'))

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

    $configPath = Join-Path $testRoot 'demo-client.json'
    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'demo-client' `
        -CompanyName 'Demo Client Network Technology Co Ltd' `
        -ShortName 'Demo Client' `
        -AlternateName 'Demo Client AI' `
        -Description 'Demo script fixture.' `
        -SiteUrl 'https://demo-client.test' `
        -GeoFlowBaseUrl 'https://work.demo-client.test' `
        -Telephone '+86-100-0000-0000' `
        -Email 'service@demo-client.test' `
        -Address 'No. 1 Demo Road' `
        -AddressRegion 'Demo City' `
        -OutputPath $configPath `
        -Force | Out-Null

    $configDemoPath = Join-Path $testRoot 'demo-client-DEMO-SCRIPT.json'
    $configResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDemoScript.ps1') `
        -Root $rootPath `
        -ConfigPath $configPath `
        -OutputPath $configDemoPath
    $configResult = $configResultJson | ConvertFrom-Json
    Assert-Condition ([string] $configResult.status -eq 'created') "Config demo result mismatch: $($configResult.status)"
    Assert-Condition ([string] $configResult.version -eq $expectedVersion) "Config demo version mismatch. Expected $expectedVersion, got $($configResult.version)"
    Assert-Condition (Test-Path $configDemoPath) 'Config demo JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($configDemoPath, '.md'))) 'Config demo Markdown was not created.'

    $configDemo = Get-Content -LiteralPath $configDemoPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $configDemo.demo_type -eq 'tongzhuo_customer_demo_script') 'Demo type mismatch.'
    Assert-Condition ([int] $configDemo.demo_length_minutes -eq 45) 'Demo should be a 45-minute script.'
    Assert-Condition ([string] $configDemo.customer.slug -eq 'demo-client') 'Demo customer slug mismatch.'
    Assert-Condition ([string] $configDemo.customer.geoflow_admin -eq 'https://work.demo-client.test/geo_admin') 'Demo admin URL mismatch.'
    Assert-Condition (@($configDemo.demo_flow | Where-Object { [string] $_.step -eq 'distribution_and_desktop_agent' }).Count -eq 1) 'Demo flow must include distribution and desktop agent.'
    Assert-Condition ([bool] $configDemo.security_boundary.no_platform_credentials_on_server) 'Demo must declare platform credential boundary.'
    Assert-Condition ([string] $configDemo.next_commands.ai_visibility -like '*AIVisibility*') 'Demo must include AIVisibility next command.'

    $directDemoPath = Join-Path $testRoot 'direct-client-DEMO-SCRIPT.json'
    $directResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDemoScript.ps1') `
        -Root $rootPath `
        -CustomerSlug 'direct-client' `
        -CompanyName 'Direct Client Co Ltd' `
        -ShortName 'Direct Client' `
        -SiteUrl 'https://direct-client.test' `
        -GeoFlowBaseUrl 'https://work.direct-client.test' `
        -OutputPath $directDemoPath
    $directResult = $directResultJson | ConvertFrom-Json
    Assert-Condition ([string] $directResult.status -eq 'created') "Direct demo result mismatch: $($directResult.status)"

    $directDemo = Get-Content -LiteralPath $directDemoPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $directDemo.customer.slug -eq 'direct-client') 'Direct demo customer slug mismatch.'
    Assert-Condition (@($directDemo.preparation_checklist).Count -ge 5) 'Demo should include preparation checklist.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($directDemoPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Demo Flow*') 'Demo Markdown is missing Demo Flow section.'
    Assert-Condition ($markdown -like '*Objection Handling*') 'Demo Markdown is missing Objection Handling section.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Demo Markdown is missing Security Boundary section.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer demo script validation passed.'
