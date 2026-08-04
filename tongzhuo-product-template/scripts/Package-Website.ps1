[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$websiteRoot = Join-Path $rootPath 'website'
if (-not (Test-Path $websiteRoot)) {
    throw "website not found under: $rootPath"
}
$product = & (Join-Path $PSScriptRoot 'Read-ProductMetadata.ps1') -Root $rootPath

& (Join-Path $PSScriptRoot 'Sync-WebsiteAssets.ps1') -Root $rootPath

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $packageDir = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $packageDir "tongzhuo-ai-readable-website-$stamp.zip"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $resolvedOutput -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-website-package-' + [guid]::NewGuid().ToString('N'))
$stagingWebsite = Join-Path $stagingRoot 'tongzhuo-ai-readable-website'

try {
    Copy-Item -LiteralPath $websiteRoot -Destination $stagingWebsite -Recurse -Force
    foreach ($blockedDirectory in @('node_modules', '.data', 'vendor', 'storage', 'logs', 'tmp', 'temp', 'dist')) {
        Get-ChildItem -LiteralPath $stagingWebsite -Recurse -Force -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $blockedDirectory } |
            Remove-Item -Recurse -Force
    }
    foreach ($pattern in @('.env', '*.log', '*.tmp', '*.zip')) {
        Get-ChildItem -LiteralPath $stagingWebsite -Recurse -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
            Remove-Item -Force
    }

    $manifest = @{
        product = 'Tongzhuo AI-readable Website'
        suite = [string] $product.product
        version = [string] $product.version
        component = 'ai-readable-company-website'
        packaged_at = (Get-Date).ToUniversalTime().ToString('o')
        source = 'website'
        ai_entrypoints = @('robots.txt', 'sitemap.xml', 'feed.xml', 'llms.txt', 'llms-full.txt')
        security = @{
            excludes_prices = $true
            excludes_customer_tokens = $true
            excludes_runtime_storage = $true
        }
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagingWebsite 'package-manifest.json') -Encoding UTF8

    if (Test-Path $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }
    Compress-Archive -Path $stagingWebsite -DestinationPath $resolvedOutput -Force
    & (Join-Path $PSScriptRoot 'Test-WebsitePackage.ps1') -PackagePath $resolvedOutput -ExpectedVersion ([string] $product.version)
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int]$exitCodeVariable.Value -ne 0) {
        throw "Website package validation failed with exit code $($exitCodeVariable.Value)"
    }
} finally {
    if (Test-Path $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Website package created: $resolvedOutput"
