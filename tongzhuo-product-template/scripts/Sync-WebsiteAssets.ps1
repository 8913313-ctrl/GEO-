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
$websiteRoot = Join-Path $rootPath 'website'
$assetRoots = @(
    (Join-Path $websiteRoot 'assets'),
    (Join-Path $rootPath 'geoflow-integration\server-overrides\public\assets')
)

if (-not (Test-Path -LiteralPath $websiteRoot)) {
    throw "Website root not found: $websiteRoot"
}

$assetNames = @(
    'corporate.css',
    'corporate-nav.js',
    'styles.css',
    'wukong-overrides.css',
    'site.js',
    'logo-mark-blue.png',
    'logo-zhuojian-blue.png',
    'short-video-production.jpg'
)

foreach ($assetRoot in $assetRoots) {
    New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
    foreach ($assetName in $assetNames) {
        $source = Join-Path $websiteRoot $assetName
        $destination = Join-Path $assetRoot $assetName
        if (-not (Test-Path -LiteralPath $source)) {
            throw "Website asset source not found: $source"
        }
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }
}

Write-Host "Website assets synchronized: $($assetRoots -join ', ')"
