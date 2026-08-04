[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$WorkDir = '',
    [switch]$KeepArtifacts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$expectedVersion = [string] $product.version

if ([string]::IsNullOrWhiteSpace($WorkDir)) {
    $testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-delivery-smoke-' + [guid]::NewGuid().ToString('N'))
} else {
    $testRoot = Join-Path ([IO.Path]::GetFullPath($WorkDir)) ('tongzhuo-delivery-smoke-' + [guid]::NewGuid().ToString('N'))
}

$customerRoot = Join-Path $testRoot 'smoke-client'
$deliveryZip = Join-Path $testRoot 'smoke-client-tongzhuo-geo-delivery.zip'
$extractRoot = Join-Path $testRoot 'expanded'
$innerRoot = Join-Path $testRoot 'inner'

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Get-ZipEntryNames {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        return @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
    } finally {
        $archive.Dispose()
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $match = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($match.Count -gt 0) "Missing zip entry matching pattern: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $match = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($match.Count -eq 0) "Unexpected zip entry matching pattern: $Pattern"
}

function Find-RequiredFile {
    param(
        [Parameter(Mandatory = $true)] [string]$BasePath,
        [Parameter(Mandatory = $true)] [string]$Filter
    )
    $file = Get-ChildItem -LiteralPath $BasePath -Recurse -File -Filter $Filter | Select-Object -First 1
    Assert-Condition ($null -ne $file) "Required file not found: $Filter under $BasePath"
    return $file.FullName
}

function Assert-ManifestIntegrity {
    param(
        [Parameter(Mandatory = $true)] [object]$Manifest,
        [Parameter(Mandatory = $true)] [string]$Key,
        [Parameter(Mandatory = $true)] [string]$PackagePath
    )

    Assert-Condition ($null -ne $Manifest.package_integrity) 'delivery-manifest.json is missing package_integrity.'
    $record = $Manifest.package_integrity.$Key
    Assert-Condition ($null -ne $record) "delivery-manifest.json is missing package_integrity.$Key."
    $item = Get-Item -LiteralPath $PackagePath
    $actualHash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Condition (([string] $record.sha256).ToLowerInvariant() -eq $actualHash) "SHA256 mismatch for $Key."
    Assert-Condition ([int64] $record.bytes -eq [int64] $item.Length) "Size mismatch for $Key."
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    & (Join-Path $rootPath 'scripts\New-Customer.ps1') `
        -CustomerSlug 'smoke-client' `
        -CompanyName 'Smoke Client Network Technology Co Ltd' `
        -ShortName 'Smoke Client' `
        -SiteUrl 'https://smoke.example.com' `
        -GeoFlowBaseUrl 'https://flow.smoke.example.com' `
        -OutputPath $customerRoot

    & (Join-Path $rootPath 'scripts\Package-CustomerDelivery.ps1') -Root $customerRoot -OutputPath $deliveryZip

    & (Join-Path $rootPath 'scripts\Test-PackageManifest.ps1') `
        -PackagePath $deliveryZip `
        -ExpectedVersion $expectedVersion `
        -ManifestName 'delivery-manifest.json'

    $outerEntries = Get-ZipEntryNames -ZipPath $deliveryZip
    foreach ($pattern in @(
        '*/delivery-manifest.json',
        '*/customer-manifest.json',
        '*/product.json',
        '*/README.md',
        '*/LAUNCHPAD.md',
        '*/DELIVERY-SUMMARY.md',
        '*/HANDOFF.md',
        '*/Start-CustomerDelivery.ps1',
        '*/docs/SERVER-DEPLOYMENT.md',
        '*/docs/CUSTOMER-RELEASE-PROCESS.md',
        '*/docs/CUSTOMER-ACCEPTANCE-PROCESS.md',
        '*/docs/CUSTOMER-UPGRADE-PROCESS.md',
        '*/docs/DELIVERY-CHECKLIST.md',
        '*/docs/OPERATIONS-RUNBOOK.md',
        '*/*-geoflow-server-overrides.zip',
        '*/*-desktop-publisher-agent.zip',
        '*/*-ai-readable-website.zip'
    )) {
        Assert-ZipHas -Entries $outerEntries -Pattern $pattern
    }

    foreach ($pattern in @(
        '*/node_modules/*',
        '*/.env',
        '*/.data/profiles/*',
        '*/.data/browser-profile/*',
        '*/.data/browser-profiles/*',
        '*/storage/logs/*',
        '*/vendor/*'
    )) {
        Assert-ZipLacks -Entries $outerEntries -Pattern $pattern
    }

    Expand-Archive -LiteralPath $deliveryZip -DestinationPath $extractRoot -Force
    $serverZip = Find-RequiredFile -BasePath $extractRoot -Filter '*-geoflow-server-overrides.zip'
    $desktopZip = Find-RequiredFile -BasePath $extractRoot -Filter '*-desktop-publisher-agent.zip'
    $websiteZip = Find-RequiredFile -BasePath $extractRoot -Filter '*-ai-readable-website.zip'

    foreach ($packagePath in @($serverZip, $desktopZip, $websiteZip)) {
        & (Join-Path $rootPath 'scripts\Test-PackageManifest.ps1') -PackagePath $packagePath -ExpectedVersion $expectedVersion
    }
    & (Join-Path $rootPath 'scripts\Test-GeoFlowServerPackage.ps1') -PackagePath $serverZip -ExpectedVersion $expectedVersion
    & (Join-Path $rootPath 'scripts\Test-DesktopAgentPackage.ps1') -PackagePath $desktopZip -ExpectedVersion $expectedVersion
    & (Join-Path $rootPath 'scripts\Test-WebsitePackage.ps1') -PackagePath $websiteZip -ExpectedVersion $expectedVersion

    $deliveryRoot = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
    Assert-Condition ($null -ne $deliveryRoot) 'Expanded delivery root not found.'
    $deliveryManifest = Get-Content -LiteralPath (Join-Path $deliveryRoot.FullName 'delivery-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-ManifestIntegrity -Manifest $deliveryManifest -Key 'geoflow_server_overrides' -PackagePath $serverZip
    Assert-ManifestIntegrity -Manifest $deliveryManifest -Key 'desktop_publisher_agent' -PackagePath $desktopZip
    Assert-ManifestIntegrity -Manifest $deliveryManifest -Key 'ai_readable_website' -PackagePath $websiteZip
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action Verify | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 Verify failed with exit code $LASTEXITCODE"
    }

    $launchPadPath = Join-Path $extractRoot 'launchpad.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action LaunchPad -LaunchPadOutputPath $launchPadPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 LaunchPad failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $launchPadPath) 'LaunchPad did not create JSON output.'
    $launchPad = Get-Content -LiteralPath $launchPadPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $launchPad.launchpad_type -eq 'tongzhuo_customer_delivery_launchpad') "LaunchPad type mismatch: $($launchPad.launchpad_type)"
    Assert-Condition ([string] $launchPad.status -eq 'ready') "LaunchPad status mismatch: $($launchPad.status)"
    Assert-Condition ([string] $launchPad.version -eq $expectedVersion) "LaunchPad version mismatch. Expected $expectedVersion, got $($launchPad.version)"
    Assert-Condition (@($launchPad.package_inventory).Count -eq 3) 'LaunchPad should include three component packages.'
    Assert-Condition (@($launchPad.role_paths).Count -ge 5) 'LaunchPad should include role paths.'
    Assert-Condition (@($launchPad.first_90_minutes).Count -ge 6) 'LaunchPad should include first 90 minutes flow.'
    Assert-Condition ([string] $launchPad.command_groups.before_server[0] -like '*Verify*') 'LaunchPad should include Verify in before-server commands.'
    Assert-Condition ([bool] $launchPad.security_boundary.platform_credentials_stay_local) 'LaunchPad must declare local platform credential boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($launchPadPath, '.md'))) 'LaunchPad did not create Markdown output.'
    $launchPadMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($launchPadPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($launchPadMarkdown -like '*Role Paths*') 'LaunchPad Markdown is missing role paths.'
    Assert-Condition ($launchPadMarkdown -like '*First 90 Minutes*') 'LaunchPad Markdown is missing first 90 minutes.'
    Assert-Condition ($launchPadMarkdown -like '*Security Boundary*') 'LaunchPad Markdown is missing security boundary.'

    $serverEntries = Get-ZipEntryNames -ZipPath $serverZip
    foreach ($pattern in @('*/package-manifest.json', '*/deployment/install-geoflow-overrides.sh', '*/deployment/verify-geoflow-overrides.sh', '*/server-overrides/*')) {
        Assert-ZipHas -Entries $serverEntries -Pattern $pattern
    }
    foreach ($pattern in @('*/.env', '*/node_modules/*', '*/vendor/*', '*/storage/*', '*/.data/*')) {
        Assert-ZipLacks -Entries $serverEntries -Pattern $pattern
    }

    $desktopEntries = Get-ZipEntryNames -ZipPath $desktopZip
    foreach ($pattern in @(
        '*/package-manifest.json',
        '*/src/version.js',
        '*/src/diagnostics.js',
        '*/src/export-bundle.js',
        '*/preflight.ps1',
        '*/public/app.js',
        '*/.data/config.json'
    )) {
        Assert-ZipHas -Entries $desktopEntries -Pattern $pattern
    }
    foreach ($pattern in @(
        '*/node_modules/*',
        '*/.data/profiles/*',
        '*/.data/browser-profile/*',
        '*/.data/browser-profiles/*',
        '*/logs/*',
        '*/tmp/*',
        '*/temp/*',
        '*.log',
        '*.tmp'
    )) {
        Assert-ZipLacks -Entries $desktopEntries -Pattern $pattern
    }

    $desktopExtract = Join-Path $innerRoot 'desktop'
    Expand-Archive -LiteralPath $desktopZip -DestinationPath $desktopExtract -Force
    $desktopConfigPath = Find-RequiredFile -BasePath $desktopExtract -Filter 'config.json'
    $desktopConfig = Get-Content -LiteralPath $desktopConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $apiToken = if ($null -ne $desktopConfig.apiToken) { [string] $desktopConfig.apiToken } else { '' }
    Assert-Condition ([string]::IsNullOrWhiteSpace($apiToken)) 'Desktop package config contains apiToken.'
    Assert-Condition ([int] $desktopConfig.port -eq 18280) 'Desktop package config port should be 18280.'

    $websiteEntries = Get-ZipEntryNames -ZipPath $websiteZip
    foreach ($pattern in @(
        '*/package-manifest.json',
        '*/index.html',
        '*/robots.txt',
        '*/sitemap.xml',
        '*/feed.xml',
        '*/llms.txt',
        '*/llms-full.txt'
    )) {
        Assert-ZipHas -Entries $websiteEntries -Pattern $pattern
    }
    foreach ($pattern in @('*/.env', '*/node_modules/*', '*/.data/*', '*/vendor/*')) {
        Assert-ZipLacks -Entries $websiteEntries -Pattern $pattern
    }

    $configDrivenRoot = Join-Path $testRoot 'config-driven'
    $configDrivenConfigPath = Join-Path $testRoot 'config-driven-customer.json'
    $configDrivenDeliveryPath = Join-Path $testRoot 'config-driven-delivery.zip'
    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'config-smoke' `
        -CompanyName 'Config Smoke Network Technology Co Ltd' `
        -ShortName 'Config Smoke' `
        -AlternateName 'Config Smoke AI' `
        -Description 'Config driven smoke customer.' `
        -SiteUrl 'https://config-smoke.example.com' `
        -GeoFlowBaseUrl 'https://flow.config-smoke.example.com' `
        -DesktopAgentPort 19280 `
        -OutputPath $configDrivenConfigPath `
        -Force | Out-Null
    $configDrivenResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryFromConfig.ps1') `
        -ConfigPath $configDrivenConfigPath `
        -OutputRoot $configDrivenRoot `
        -DeliveryOutputPath $configDrivenDeliveryPath
    $configDrivenResult = $configDrivenResultJson | ConvertFrom-Json
    Assert-Condition (Test-Path ([string] $configDrivenResult.customer_root)) 'Config-driven customer root was not created.'
    Assert-Condition (Test-Path ([string] $configDrivenResult.delivery_package)) 'Config-driven delivery package was not created.'
    & (Join-Path $rootPath 'scripts\Test-PackageManifest.ps1') `
        -PackagePath ([string] $configDrivenResult.delivery_package) `
        -ExpectedVersion $expectedVersion `
        -ManifestName 'delivery-manifest.json'
    Assert-Condition ([int] $configDrivenResult.desktop_agent_port -eq 19280) 'Config-driven result should include custom desktop agent port.'
    $configDrivenExtract = Join-Path $testRoot 'config-driven-expanded'
    Expand-Archive -LiteralPath ([string] $configDrivenResult.delivery_package) -DestinationPath $configDrivenExtract -Force
    $configDrivenDesktopZip = Find-RequiredFile -BasePath $configDrivenExtract -Filter '*-desktop-publisher-agent.zip'
    $configDrivenDesktopExtract = Join-Path $innerRoot 'config-driven-desktop'
    Expand-Archive -LiteralPath $configDrivenDesktopZip -DestinationPath $configDrivenDesktopExtract -Force
    $configDrivenDesktopConfigPath = Find-RequiredFile -BasePath $configDrivenDesktopExtract -Filter 'config.json'
    $configDrivenDesktopConfig = Get-Content -LiteralPath $configDrivenDesktopConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([int] $configDrivenDesktopConfig.port -eq 19280) 'Config-driven desktop package config should use desktop_agent.port.'

    Write-Host "Customer delivery smoke test passed: $deliveryZip"
} finally {
    if ($KeepArtifacts) {
        Write-Host "Artifacts kept at: $testRoot"
    } elseif (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
