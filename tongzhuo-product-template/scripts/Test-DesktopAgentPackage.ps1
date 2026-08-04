[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
$extractRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-desktop-package-verify-' + [guid]::NewGuid().ToString('N'))

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

function Read-ZipManifest {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $entry = $archive.Entries | Where-Object {
            $normalized = $_.FullName -replace '\\', '/'
            $normalized -eq 'package-manifest.json' -or $normalized -like '*/package-manifest.json'
        } | Select-Object -First 1
        Assert-Condition ($null -ne $entry) 'Desktop package manifest not found.'
        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            return $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -gt 0) "Desktop package missing entry: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -eq 0) "Desktop package contains blocked entry: $Pattern"
}

function Find-RequiredFile {
    param(
        [Parameter(Mandatory = $true)] [string]$BasePath,
        [Parameter(Mandatory = $true)] [string]$Filter
    )
    $file = Get-ChildItem -LiteralPath $BasePath -Recurse -File -Filter $Filter | Select-Object -First 1
    Assert-Condition ($null -ne $file) "Required desktop package file not found: $Filter"
    return $file.FullName
}

try {
    & (Join-Path $PSScriptRoot 'Test-PackageSecrets.ps1') -PackagePath $resolvedPackage

    $manifest = Read-ZipManifest -ZipPath $resolvedPackage
    Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "Desktop package version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
    Assert-Condition ([string] $manifest.component -eq 'desktop-publisher-agent') "Desktop package component mismatch: $($manifest.component)"
    Assert-Condition ([string] $manifest.preflight_command -like '*preflight.ps1*') 'Desktop package manifest is missing preflight_command.'
    Assert-Condition ([string] $manifest.install_command -like '*install-desktop.ps1*') 'Desktop package manifest is missing install_command.'
    Assert-Condition ([string] $manifest.silent_start_command -like '*WindowStyle Hidden*') 'Desktop package manifest must declare hidden startup.'
    Assert-Condition ([string] $manifest.health_endpoint -like '*127.0.0.1*healthz*') 'Desktop package manifest is missing local health endpoint.'
    Assert-Condition ([string] $manifest.operating_model.daily_entry -eq 'geoflow-admin') 'Desktop package must declare GEOFlow as the daily entry.'
    Assert-Condition ([bool] $manifest.operating_model.pairing_required) 'Desktop package must require backend pairing.'
    Assert-Condition ([int] $manifest.operating_model.pairing_ttl_minutes -eq 10) 'Desktop package must declare a 10 minute pairing code TTL.'
    Assert-Condition ([bool] $manifest.operating_model.local_console_for_support_only) 'Desktop package local console must be support-only.'
    Assert-Condition ([bool] $manifest.security.excludes_api_token) 'Desktop package manifest must declare API Token exclusion.'
    Assert-Condition ([bool] $manifest.security.excludes_browser_profiles) 'Desktop package manifest must declare browser profile exclusion.'
    Assert-Condition ([bool] $manifest.security.excludes_platform_credentials) 'Desktop package manifest must declare platform credential exclusion.'
    Assert-Condition ([bool] $manifest.security.keeps_platform_cookies_local) 'Desktop package must keep platform cookies local.'
    Assert-Condition ([bool] $manifest.security.device_credential_is_local) 'Desktop package must keep the device credential local.'

    $entries = Get-ZipEntryNames -ZipPath $resolvedPackage
    foreach ($pattern in @(
        '*/package-manifest.json',
        '*/package.json',
        '*/package-lock.json',
        '*/preflight.ps1',
        '*/install.ps1',
        '*/install-desktop.ps1',
        '*/install-autostart.ps1',
        '*/uninstall-desktop.ps1',
        '*/uninstall-autostart.ps1',
        '*/run-agent.ps1',
        '*/start.cmd',
        '*/start-background.cmd',
        '*/README.md',
        '*/public/index.html',
        '*/public/app.js',
        '*/src/main.js',
        '*/src/version.js',
        '*/src/job-state-machine.js',
        '*/src/diagnostics.js',
        '*/src/export-bundle.js',
        '*/src/adapters/index.js'
    )) {
        Assert-ZipHas -Entries $entries -Pattern $pattern
    }

    foreach ($pattern in @(
        '*/node_modules/*',
        '*/.data/profiles/*',
        '*/.data/browser-profile/*',
        '*/.data/browser-profiles/*',
        '*/logs/*',
        '*/tmp/*',
        '*/temp/*',
        '*/dist/*',
        '*.log',
        '*.tmp',
        '*/.env'
    )) {
        Assert-ZipLacks -Entries $entries -Pattern $pattern
    }

    Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $extractRoot -Force
    $root = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
    Assert-Condition ($null -ne $root) 'Expanded desktop package root not found.'

    if ([bool] $manifest.include_empty_config) {
        $configPath = Find-RequiredFile -BasePath $root.FullName -Filter 'config.json'
        $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $apiToken = if ($null -ne $config.apiToken) { [string] $config.apiToken } else { '' }
        Assert-Condition ([string]::IsNullOrWhiteSpace($apiToken)) 'Desktop package config contains apiToken.'
    }
} finally {
    if (Test-Path $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
}

Write-Host "Desktop agent package validation passed: $resolvedPackage"
