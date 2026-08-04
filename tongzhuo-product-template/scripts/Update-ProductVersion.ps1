[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$Version,
    [string]$Root = '',
    [string[]]$ChangelogItem = @('Prepared the product template for a new release.'),
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must use semver x.y.z. Got: $Version"
}

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path

$productPath = Join-Path $rootPath 'product.json'
$desktopPackagePath = Join-Path $rootPath 'desktop-agent\package.json'
$desktopLockPath = Join-Path $rootPath 'desktop-agent\package-lock.json'
$desktopVersionPath = Join-Path $rootPath 'desktop-agent\src\version.js'
$changelogPath = Join-Path $rootPath 'CHANGELOG.md'

foreach ($path in @($productPath, $desktopPackagePath, $desktopLockPath, $desktopVersionPath, $changelogPath)) {
    if (-not (Test-Path $path)) {
        throw "Version update target not found: $path"
    }
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)] [string]$Path)
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)] [object]$Value,
        [Parameter(Mandatory = $true)] [string]$Path
    )
    Write-Utf8NoBom -Path $Path -Value ($Value | ConvertTo-Json -Depth 30)
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Value
    )

    [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false))
}

function Set-JsonProperty {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [object]$Value
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        throw "JSON object is missing property: $Name"
    }
    $property.Value = $Value
}

function Update-ChangelogText {
    param(
        [Parameter(Mandatory = $true)] [string]$Text,
        [Parameter(Mandatory = $true)] [string]$TargetVersion,
        [Parameter(Mandatory = $true)] [string[]]$Items
    )

    $headerPattern = "(?m)^## \[$([regex]::Escape($TargetVersion))\]"
    if ($Text -match $headerPattern) {
        return $Text
    }

    $date = Get-Date -Format 'yyyy-MM-dd'
    $cleanItems = @($Items | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
        "- $($_.Trim())"
    })
    if ($cleanItems.Count -eq 0) {
        $cleanItems = @('- Prepared the product template for a new release.')
    }

    $section = @(
        "## [$TargetVersion] - $date",
        ''
    ) + $cleanItems + @('')
    $sectionText = [string]::Join([Environment]::NewLine, $section)

    $titlePattern = "(?s)^(# .+?\r?\n)"
    $match = [regex]::Match($Text, $titlePattern)
    if (-not $match.Success) {
        return ($sectionText + [Environment]::NewLine + [Environment]::NewLine + $Text)
    }

    $prefix = $match.Groups[1].Value.TrimEnd("`r", "`n")
    $remaining = $Text.Substring($match.Length).TrimStart("`r", "`n")
    return ($prefix + [Environment]::NewLine + [Environment]::NewLine + $sectionText + [Environment]::NewLine + $remaining)
}

$product = Read-JsonFile -Path $productPath
$desktopPackage = Read-JsonFile -Path $desktopPackagePath
$desktopLockSource = Get-Content -LiteralPath $desktopLockPath -Raw -Encoding UTF8
$desktopVersionSource = Get-Content -LiteralPath $desktopVersionPath -Raw -Encoding UTF8
$changelogSource = Get-Content -LiteralPath $changelogPath -Raw -Encoding UTF8

$currentVersion = [string] $product.version
Set-JsonProperty -Object $product -Name 'version' -Value $Version
Set-JsonProperty -Object $desktopPackage -Name 'version' -Value $Version

$lockRootVersionPattern = '("version"\s*:\s*")([^"]+)(")'
$lockPackageVersionPattern = '("packages"\s*:\s*\{\s*""\s*:\s*\{.*?"version"\s*:\s*")([^"]+)(")'
if (-not [regex]::Match($desktopLockSource, $lockRootVersionPattern).Success) {
    throw 'desktop-agent/package-lock.json root version was not found.'
}
if (-not [regex]::Match($desktopLockSource, $lockPackageVersionPattern, [Text.RegularExpressions.RegexOptions]::Singleline).Success) {
    throw 'desktop-agent/package-lock.json packages[""] version was not found.'
}
$rootVersionRegex = [regex]::new($lockRootVersionPattern)
$packageVersionRegex = [regex]::new($lockPackageVersionPattern, [Text.RegularExpressions.RegexOptions]::Singleline)
$updatedDesktopLockSource = $rootVersionRegex.Replace($desktopLockSource, "`${1}$Version`${3}", 1)
$updatedDesktopLockSource = $packageVersionRegex.Replace($updatedDesktopLockSource, "`${1}$Version`${3}", 1)

$versionPattern = "agentVersion\s*=\s*['""]([^'""]+)['""]"
if ($desktopVersionSource -notmatch $versionPattern) {
    throw 'desktop-agent/src/version.js does not contain agentVersion.'
}
$updatedDesktopVersionSource = [regex]::Replace(
    $desktopVersionSource,
    $versionPattern,
    "agentVersion = '$Version'"
)
$updatedChangelog = Update-ChangelogText -Text $changelogSource -TargetVersion $Version -Items $ChangelogItem

$plan = [ordered]@{
    status = if ($Apply) { 'applied' } else { 'dry_run' }
    root = $rootPath
    previous_version = $currentVersion
    target_version = $Version
    files = @(
        'product.json',
        'desktop-agent/package.json',
        'desktop-agent/package-lock.json',
        'desktop-agent/src/version.js',
        'CHANGELOG.md'
    )
}

if ($Apply) {
    Write-JsonFile -Value $product -Path $productPath
    Write-JsonFile -Value $desktopPackage -Path $desktopPackagePath
    Write-Utf8NoBom -Path $desktopLockPath -Value $updatedDesktopLockSource
    Write-Utf8NoBom -Path $desktopVersionPath -Value $updatedDesktopVersionSource
    Write-Utf8NoBom -Path $changelogPath -Value $updatedChangelog

    & (Join-Path $PSScriptRoot 'Test-VersionConsistency.ps1') -Root $rootPath | Out-Null
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int] $exitCodeVariable.Value -ne 0) {
        throw "Version consistency failed after updating to $Version with exit code $($exitCodeVariable.Value)"
    }
}

$plan | ConvertTo-Json -Depth 5 | Write-Output
