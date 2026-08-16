[CmdletBinding()]
param(
    [string]$SourceExecutable = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$agentRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if ([string]::IsNullOrWhiteSpace($SourceExecutable)) {
    Push-Location $agentRoot
    try {
        $SourceExecutable = (& node -e "import('playwright').then(({ chromium }) => process.stdout.write(chromium.executablePath()))").Trim()
    } finally {
        Pop-Location
    }
}

if ([string]::IsNullOrWhiteSpace($SourceExecutable)) {
    throw 'Playwright Chromium was not found. Run "npx playwright install chromium" before building the desktop installer.'
}

$sourcePath = [IO.Path]::GetFullPath($SourceExecutable)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Playwright Chromium executable was not found: $sourcePath"
}

$sourceDirectory = Split-Path -Parent $sourcePath
$runtimeDirectory = Join-Path $agentRoot 'browser-runtime'
$targetRoot = Join-Path $runtimeDirectory 'chromium'
$targetExecutable = Join-Path $targetRoot 'chrome-win64\chrome.exe'
$runtimePrefix = $runtimeDirectory.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if ($sourcePath.StartsWith($runtimePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The source Chromium must be outside browser-runtime so the build can refresh it safely.'
}

$stagingRoot = Join-Path $runtimeDirectory ('.chromium-staging-' + [guid]::NewGuid().ToString('N'))
$stagingBrowserDirectory = Join-Path $stagingRoot 'chrome-win64'
$backupRoot = Join-Path $runtimeDirectory ('.chromium-backup-' + [guid]::NewGuid().ToString('N'))
$backupCreated = $false
$targetInstalled = $false

try {
    New-Item -ItemType Directory -Force -Path $stagingBrowserDirectory | Out-Null
    Get-ChildItem -LiteralPath $sourceDirectory -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $stagingBrowserDirectory -Recurse -Force
    }
    if (-not (Test-Path -LiteralPath (Join-Path $stagingBrowserDirectory 'chrome.exe') -PathType Leaf)) {
        throw 'The copied Chromium runtime is incomplete: chrome.exe is missing.'
    }

    # Keep the previous runtime until the staged directory has been moved into
    # place. Both paths are under browser-runtime, so these are same-volume
    # directory renames instead of a destructive refresh.
    if (Test-Path -LiteralPath $targetRoot) {
        Move-Item -LiteralPath $targetRoot -Destination $backupRoot -Force
        $backupCreated = $true
    }

    try {
        Move-Item -LiteralPath $stagingRoot -Destination $targetRoot -Force
        $targetInstalled = $true
    } catch {
        if ($backupCreated -and (Test-Path -LiteralPath $backupRoot)) {
            if (Test-Path -LiteralPath $targetRoot) {
                Remove-Item -LiteralPath $targetRoot -Recurse -Force
            }
            Move-Item -LiteralPath $backupRoot -Destination $targetRoot -Force
            $backupCreated = $false
        }
        throw
    }

    if ($backupCreated -and (Test-Path -LiteralPath $backupRoot)) {
        Remove-Item -LiteralPath $backupRoot -Recurse -Force
        $backupCreated = $false
    }
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
    if (-not $targetInstalled -and $backupCreated -and (Test-Path -LiteralPath $backupRoot) -and -not (Test-Path -LiteralPath $targetRoot)) {
        Move-Item -LiteralPath $backupRoot -Destination $targetRoot -Force
    }
}

Write-Host "Bundled Chromium runtime prepared: $targetExecutable"
