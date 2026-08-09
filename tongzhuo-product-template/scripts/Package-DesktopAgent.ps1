[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputPath = '',
    [switch]$IncludeEmptyConfig
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$agentRoot = Join-Path $rootPath 'desktop-agent'
if (-not (Test-Path $agentRoot)) {
    throw "desktop-agent not found under: $rootPath"
}
$product = & (Join-Path $PSScriptRoot 'Read-ProductMetadata.ps1') -Root $rootPath

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $packageDir = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $packageDir "tongzhuo-geo-desktop-agent-$stamp.zip"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $resolvedOutput -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$configPath = Join-Path $agentRoot '.data\config.json'
if (Test-Path $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $tokenValue = ''
    if ($null -ne $config.apiToken) {
        $tokenValue = [string]$config.apiToken
    }
    if (-not [string]::IsNullOrWhiteSpace($tokenValue)) {
        throw 'Refusing to package desktop-agent because .data/config.json contains apiToken.'
    }
}

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-agent-package-' + [guid]::NewGuid().ToString('N'))
$stagingAgent = Join-Path $stagingRoot 'tongzhuo-geo-desktop-agent'
New-Item -ItemType Directory -Force -Path $stagingAgent | Out-Null

$excludedDirectories = @(
    'node_modules',
    'browser-runtime',
    'release',
    '.data\profiles',
    '.data\browser-profile',
    '.data\browser-profiles',
    'dist',
    'logs',
    'tmp',
    'temp'
)
$excludedFiles = @(
    '*.log',
    '*.tmp',
    '.DS_Store',
    'Thumbs.db'
)

try {
    Get-ChildItem -LiteralPath $agentRoot -Force | ForEach-Object {
        $relative = $_.Name
        if ($excludedDirectories -contains $relative) {
            return
        }
        if ($relative -eq '.data') {
            if (-not $IncludeEmptyConfig -or -not (Test-Path $configPath)) {
                return
            }
            New-Item -ItemType Directory -Force -Path (Join-Path $stagingAgent '.data') | Out-Null
            Copy-Item -LiteralPath $configPath -Destination (Join-Path $stagingAgent '.data\config.json') -Force
            return
        }
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingAgent $relative) -Recurse -Force
    }

    if ($IncludeEmptyConfig -and -not (Test-Path (Join-Path $stagingAgent '.data\config.json'))) {
        $emptyConfigPath = Join-Path $stagingAgent '.data\config.json'
        New-Item -ItemType Directory -Force -Path (Split-Path $emptyConfigPath) | Out-Null
        $emptyConfig = @{
            geoflowBaseUrl = 'http://127.0.0.1:18080'
            apiToken = ''
            port = 18280
            pollSeconds = 20
            autoRun = $false
            maxJobAttempts = 2
            capabilities = @('zhihu', 'wechat_mp', 'toutiao', 'zip-download')
        }
        $emptyConfig | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $emptyConfigPath -Encoding UTF8
    }

    foreach ($directory in $excludedDirectories) {
        $target = Join-Path $stagingAgent $directory
        if (Test-Path $target) {
            Remove-Item -LiteralPath $target -Recurse -Force
        }
    }
    foreach ($pattern in $excludedFiles) {
        Get-ChildItem -LiteralPath $stagingAgent -Recurse -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
            Remove-Item -Force
    }

    $manifest = @{
        product = 'Tongzhuo GEO Desktop Agent'
        suite = [string] $product.product
        version = [string] $product.version
        component = 'desktop-publisher-agent'
        packaged_at = (Get-Date).ToUniversalTime().ToString('o')
        preflight_command = 'powershell -ExecutionPolicy Bypass -File .\preflight.ps1'
        install_command = 'double-click .\一键安装发布器.cmd (calls install-desktop.ps1)'
        silent_start_command = 'powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File .\run-agent.ps1'
        health_endpoint = 'http://127.0.0.1:18280/healthz'
        include_empty_config = [bool]$IncludeEmptyConfig
        excluded = $excludedDirectories
        operating_model = @{
            daily_entry = 'geoflow-admin'
            pairing_required = $true
            pairing_ttl_minutes = 10
            local_console_for_support_only = $true
            platform_login_storage = 'local-browser-profile'
        }
        security = @{
            excludes_api_token = $true
            excludes_browser_profiles = $true
            excludes_platform_credentials = $true
            keeps_platform_cookies_local = $true
            device_credential_is_local = $true
        }
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagingAgent 'package-manifest.json') -Encoding UTF8

    if (Test-Path $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }
    Compress-Archive -Path (Join-Path $stagingRoot 'tongzhuo-geo-desktop-agent') -DestinationPath $resolvedOutput -Force
    & (Join-Path $PSScriptRoot 'Test-DesktopAgentPackage.ps1') -PackagePath $resolvedOutput -ExpectedVersion ([string] $product.version)
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int]$exitCodeVariable.Value -ne 0) {
        throw "Desktop agent package validation failed with exit code $($exitCodeVariable.Value)"
    }
} finally {
    if (Test-Path $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Desktop agent package created: $resolvedOutput"
