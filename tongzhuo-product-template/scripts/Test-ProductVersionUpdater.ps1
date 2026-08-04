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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-version-updater-' + [guid]::NewGuid().ToString('N'))

function Copy-RequiredFile {
    param(
        [Parameter(Mandatory = $true)] [string]$RelativePath
    )

    $source = Join-Path $rootPath ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $source)) {
        throw "Version updater fixture source not found: $RelativePath"
    }
    $target = Join-Path $testRoot ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
}

try {
    foreach ($path in @(
        'product.json',
        'CHANGELOG.md',
        'desktop-agent/package.json',
        'desktop-agent/package-lock.json',
        'desktop-agent/src/version.js'
    )) {
        Copy-RequiredFile -RelativePath $path
    }

    $dryRunJson = & (Join-Path $rootPath 'scripts\Update-ProductVersion.ps1') `
        -Root $testRoot `
        -Version '9.8.7' `
        -ChangelogItem 'Version updater test dry run.'
    $dryRun = $dryRunJson | ConvertFrom-Json
    if ([string] $dryRun.status -ne 'dry_run') {
        throw "Version updater dry-run status mismatch: $($dryRun.status)"
    }

    $productBeforeApply = Get-Content -LiteralPath (Join-Path $testRoot 'product.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string] $productBeforeApply.version -eq '9.8.7') {
        throw 'Version updater dry-run modified product.json.'
    }

    $applyJson = & (Join-Path $rootPath 'scripts\Update-ProductVersion.ps1') `
        -Root $testRoot `
        -Version '9.8.7' `
        -ChangelogItem 'Version updater test release.' `
        -Apply
    $apply = $applyJson | ConvertFrom-Json
    if ([string] $apply.status -ne 'applied') {
        throw "Version updater apply status mismatch: $($apply.status)"
    }

    & (Join-Path $rootPath 'scripts\Test-VersionConsistency.ps1') -Root $testRoot | Out-Null
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int] $exitCodeVariable.Value -ne 0) {
        throw "Version consistency failed for version updater fixture with exit code $($exitCodeVariable.Value)"
    }

    $changelog = Get-Content -LiteralPath (Join-Path $testRoot 'CHANGELOG.md') -Raw -Encoding UTF8
    if ($changelog -notmatch '## \[9\.8\.7\]') {
        throw 'Version updater did not create the changelog entry.'
    }
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Product version updater validation passed.'
