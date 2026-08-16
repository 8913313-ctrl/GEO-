[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$prepareScript = Join-Path $PSScriptRoot 'Prepare-BrowserRuntime.ps1'
if (-not (Test-Path -LiteralPath $prepareScript -PathType Leaf)) {
    throw "Browser runtime preparation script is missing: $prepareScript"
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-browser-runtime-check-' + [guid]::NewGuid().ToString('N'))
$agentRoot = Join-Path $testRoot 'desktop-agent'
$scriptDirectory = Join-Path $agentRoot 'scripts'
$sourceOne = Join-Path $testRoot 'source-one'
$sourceTwo = Join-Path $testRoot 'source-two'
$targetRuntimeDirectory = Join-Path $agentRoot 'browser-runtime'
$targetExecutable = Join-Path $targetRuntimeDirectory 'chromium\chrome-win64\chrome.exe'

function Invoke-Preparation([string]$scriptPath, [string]$sourceExecutable) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -SourceExecutable $sourceExecutable | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Browser runtime preparation failed for $sourceExecutable"
    }
}

try {
    New-Item -ItemType Directory -Force -Path $scriptDirectory, $sourceOne, $sourceTwo | Out-Null
    $copiedPrepareScript = Join-Path $scriptDirectory 'Prepare-BrowserRuntime.ps1'
    Copy-Item -LiteralPath $prepareScript -Destination $copiedPrepareScript

    [IO.File]::WriteAllText((Join-Path $sourceOne 'chrome.exe'), 'runtime-v1')
    [IO.File]::WriteAllText((Join-Path $sourceOne 'chrome.dll'), 'runtime-v1-dll')
    [IO.File]::WriteAllText((Join-Path $sourceTwo 'chrome.exe'), 'runtime-v2')
    [IO.File]::WriteAllText((Join-Path $sourceTwo 'chrome.dll'), 'runtime-v2-dll')

    Invoke-Preparation $copiedPrepareScript (Join-Path $sourceOne 'chrome.exe')
    if ([IO.File]::ReadAllText($targetExecutable) -ne 'runtime-v1') {
        throw 'First runtime installation did not preserve the staged executable.'
    }

    Invoke-Preparation $copiedPrepareScript (Join-Path $sourceTwo 'chrome.exe')
    if ([IO.File]::ReadAllText($targetExecutable) -ne 'runtime-v2') {
        throw 'Runtime replacement did not install the new staged executable.'
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # The child script must fail for this case. Avoid treating that expected
        # native-process exit code as a terminating test failure.
        $ErrorActionPreference = 'Continue'
        $selfCopyOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $copiedPrepareScript -SourceExecutable $targetExecutable 2>&1
        $selfCopyExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($selfCopyExitCode -eq 0) {
        throw 'Runtime preparation accepted its own target directory as the source.'
    }
    if ([IO.File]::ReadAllText($targetExecutable) -ne 'runtime-v2') {
        throw 'Rejected self-copy changed the active runtime.'
    }

    $leftovers = Get-ChildItem -LiteralPath $targetRuntimeDirectory -Force |
        Where-Object { $_.Name -like '.chromium-staging-*' -or $_.Name -like '.chromium-backup-*' }
    if ($leftovers) {
        throw 'Runtime preparation left a staging or backup directory behind.'
    }

    Write-Host 'Browser runtime preparation behavior passed.'
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
