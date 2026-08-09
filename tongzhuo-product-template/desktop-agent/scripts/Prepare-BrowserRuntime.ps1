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
if ($sourcePath -ieq $targetExecutable) {
    throw 'The source Chromium must be outside browser-runtime so the build can refresh it safely.'
}

$stagingRoot = Join-Path $runtimeDirectory ('.chromium-staging-' + [guid]::NewGuid().ToString('N'))
$stagingBrowserDirectory = Join-Path $stagingRoot 'chrome-win64'

try {
    New-Item -ItemType Directory -Force -Path $stagingBrowserDirectory | Out-Null
    Get-ChildItem -LiteralPath $sourceDirectory -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $stagingBrowserDirectory -Recurse -Force
    }
    if (-not (Test-Path -LiteralPath (Join-Path $stagingBrowserDirectory 'chrome.exe') -PathType Leaf)) {
        throw 'The copied Chromium runtime is incomplete: chrome.exe is missing.'
    }

    if (Test-Path -LiteralPath $targetRoot) {
        Remove-Item -LiteralPath $targetRoot -Recurse -Force
    }
    Move-Item -LiteralPath $stagingRoot -Destination $targetRoot -Force
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Bundled Chromium runtime prepared: $targetExecutable"
