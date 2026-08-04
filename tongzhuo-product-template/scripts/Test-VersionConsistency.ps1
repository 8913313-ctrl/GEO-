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

function Read-JsonFile {
    param([Parameter(Mandatory = $true)] [string]$Path)
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

$productPath = Join-Path $rootPath 'product.json'
$desktopPackagePath = Join-Path $rootPath 'desktop-agent\package.json'
$desktopLockPath = Join-Path $rootPath 'desktop-agent\package-lock.json'
$desktopVersionPath = Join-Path $rootPath 'desktop-agent\src\version.js'
$changelogPath = Join-Path $rootPath 'CHANGELOG.md'

foreach ($path in @($productPath, $desktopPackagePath, $desktopLockPath, $desktopVersionPath, $changelogPath)) {
    if (-not (Test-Path $path)) {
        throw "Version consistency check failed. Missing file: $path"
    }
}

$product = Read-JsonFile -Path $productPath
$desktopPackage = Read-JsonFile -Path $desktopPackagePath
$desktopLockSource = Get-Content -LiteralPath $desktopLockPath -Raw -Encoding UTF8
$desktopVersionSource = Get-Content -LiteralPath $desktopVersionPath -Raw -Encoding UTF8
$changelog = Get-Content -LiteralPath $changelogPath -Raw -Encoding UTF8

$version = [string] $product.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "product.json version must use semver x.y.z. Got: $version"
}

$lockRootVersionMatch = [regex]::Match($desktopLockSource, '"version"\s*:\s*"([^"]+)"')
if (-not $lockRootVersionMatch.Success) {
    throw 'desktop-agent/package-lock.json root version was not found.'
}
$lockPackageVersionMatch = [regex]::Match($desktopLockSource, '"packages"\s*:\s*\{\s*""\s*:\s*\{.*?"version"\s*:\s*"([^"]+)"', [Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $lockPackageVersionMatch.Success) {
    throw 'desktop-agent/package-lock.json package version was not found.'
}

$checks = @(
    [pscustomobject]@{ name = 'desktop-agent/package.json'; value = [string] $desktopPackage.version },
    [pscustomobject]@{ name = 'desktop-agent/package-lock.json root'; value = [string] $lockRootVersionMatch.Groups[1].Value },
    [pscustomobject]@{ name = 'desktop-agent/package-lock.json package'; value = [string] $lockPackageVersionMatch.Groups[1].Value }
)

foreach ($check in $checks) {
    if ($check.value -ne $version) {
        throw "Version mismatch in $($check.name). Expected $version, got $($check.value)"
    }
}

$versionPattern = "agentVersion\s*=\s*['""]$([regex]::Escape($version))['""]"
if ($desktopVersionSource -notmatch $versionPattern) {
    throw "Version mismatch in desktop-agent/src/version.js. Expected agentVersion $version."
}

$changelogPattern = "## \[$([regex]::Escape($version))\]"
if ($changelog -notmatch $changelogPattern) {
    throw "CHANGELOG.md must contain an entry for version $version."
}

Write-Host "Version consistency passed: $version"
