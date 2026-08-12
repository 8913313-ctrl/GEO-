[CmdletBinding()]
param(
    [string]$WorkDir = '',
    [switch]$KeepArtifacts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function powershell.exe { & ([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) @args }

$rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$demoCompany = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5Y2O5p2Q5bu65p2Q6KGM5Lia5ryU56S66aG555uu'))
$demoShortName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5Y2O5p2Q5bu65p2Q5ryU56S66aG555uu'))
$demoDescription = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('6Z2i5ZCR5bel56iL6YeH6LSt5LiO5pa95bel5Zui6Zif55qE5bu65p2Q5Lqn5ZOB44CB6KeE5qC85Y+C5pWw5ZKM5bqU55So5Zy65pmv5L+h5oGv5ryU56S644CC'))
$demoServices = @(
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5bu65p2Q6YCJ5Z6L5pSv5oyB')),
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('6LSo6YeP5LiO5qCH5YeG6LWE5paZ')),
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('6YeH6LSt5LiO5Lqk5LuY6K+05piO'))
)
$blockedIdentityPattern = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5qGQ54G8fOeBvOingSBBSXzpsoFJQ1DlpIcyMDI2MDIxNTg35Y+3LTJ8dG9uZ3podW8tbWFya3x6aHVvamlhbi1haQ=='))
$testRoot = if ([string]::IsNullOrWhiteSpace($WorkDir)) {
    Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-building-materials-demo-' + [guid]::NewGuid().ToString('N'))
} else {
    Join-Path ([IO.Path]::GetFullPath($WorkDir)) ('tongzhuo-building-materials-demo-' + [guid]::NewGuid().ToString('N'))
}

function Assert-Condition {
    param([Parameter(Mandatory = $true)] [bool]$Condition, [Parameter(Mandatory = $true)] [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $configPath = Join-Path $testRoot 'building-materials-demo.json'
    $deliveryRoot = Join-Path $testRoot 'delivery'
    $deliveryZip = Join-Path $testRoot 'building-materials-demo-delivery.zip'

    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'building-materials-demo' `
        -ProjectId 'building-materials-demo' `
        -TenantId 'tenant_building_materials_demo' `
        -CompanyName $demoCompany `
        -ShortName $demoShortName `
        -AlternateName 'Building Materials Demo' `
        -Description $demoDescription `
        -IndustryTemplate 'building-materials' `
        -SiteUrl 'https://building-materials.example.invalid' `
        -WorkbenchUrl 'https://building-materials.example.invalid' `
        -GeoFlowBaseUrl 'http://127.0.0.1:18080' `
        -Services $demoServices `
        -PublishMode 'draft' `
        -OutputPath $configPath | Out-Null

    $validated = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $configPath | ConvertFrom-Json
    Assert-Condition ([string]$validated.project_id -eq 'building-materials-demo') 'Building demo project ID mismatch.'
    Assert-Condition ([string]$validated.tenant_id -eq 'tenant_building_materials_demo') 'Building demo tenant ID mismatch.'
    Assert-Condition ([string]$validated.industry_template -eq 'building-materials') 'Building demo industry template mismatch.'

    $rawConfig = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string]$rawConfig.methodology.core_version -eq 'MVER-GEO-CORE-V1') 'Building demo must pin MVER-GEO-CORE-V1.'
    Assert-Condition ([string]$rawConfig.methodology.prompt_version -eq 'PVER-GEO-ARTICLE-V1') 'Building demo must pin PVER-GEO-ARTICLE-V1.'
    Assert-Condition ([string]$rawConfig.methodology.quality_rule_pack -eq 'QRULE-GEO-CONTENT-V1') 'Building demo must pin QRULE-GEO-CONTENT-V1.'
    Assert-Condition ([string]$rawConfig.company.legal_name -eq $demoCompany) 'Building demo must retain its explicit demo company boundary.'
    Assert-Condition ([string]$rawConfig.website.telephone -eq '') 'Demo customer must not invent a telephone number.'
    Assert-Condition ([string]$rawConfig.website.email -eq '') 'Demo customer must not invent an email address.'
    Assert-Condition ([string]$rawConfig.website.address -eq '') 'Demo customer must not invent an address.'
    Assert-Condition ([string]$rawConfig.site.footer_icp -eq '') 'Demo customer must not invent an ICP filing.'
    Assert-Condition ((ConvertTo-Json $rawConfig -Depth 12) -notmatch $blockedIdentityPattern) 'Building demo config leaks Tongzhuo identity.'

    $delivery = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryFromConfig.ps1') -ConfigPath $configPath -OutputRoot $deliveryRoot -DeliveryOutputPath $deliveryZip | ConvertFrom-Json
    Assert-Condition (Test-Path $delivery.delivery_package) 'Building demo delivery ZIP was not created.'
    & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryPackage.ps1') -PackagePath $delivery.delivery_package -ExpectedVersion ([string]$product.version)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $delivery.delivery_package).Path)
    try {
        $manifestEntry = @($archive.Entries | Where-Object { ($_.FullName -replace '\\', '/') -like '*/delivery-manifest.json' }) | Select-Object -First 1
        Assert-Condition ($null -ne $manifestEntry) 'Delivery manifest missing from building demo ZIP.'
        $reader = [IO.StreamReader]::new($manifestEntry.Open())
        try { $manifest = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
        Assert-Condition ([string]$manifest.project_id -eq 'building-materials-demo') 'Delivery manifest project ID mismatch.'
        Assert-Condition ([string]$manifest.tenant_id -eq 'tenant_building_materials_demo') 'Delivery manifest tenant ID mismatch.'
        Assert-Condition ([string]$manifest.industry_template -eq 'building-materials') 'Delivery manifest industry template mismatch.'
        Assert-Condition ([string]$manifest.company_name -eq $demoCompany) 'Delivery manifest company mismatch.'
    } finally { $archive.Dispose() }

    Write-Output "Building-materials demo config, version pins, isolated delivery package, manifest and no-invented-identity checks passed."
} finally {
    if (-not $KeepArtifacts -and (Test-Path $testRoot)) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
