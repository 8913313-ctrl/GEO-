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
$scriptPath = Join-Path $rootPath 'scripts\Deploy-GeoFlowServer.ps1'

if (-not (Test-Path $scriptPath)) {
    throw "Deploy-GeoFlowServer.ps1 not found: $scriptPath"
}

$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -gt 0) {
    throw "Deploy-GeoFlowServer.ps1 syntax error: $($errors[0].Message)"
}

$text = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8
foreach ($requiredText in @(
    'Package-GeoFlowServer.ps1',
    'Test-ServerOverrides.ps1',
    'Test-GeoFlowServerPackage.ps1',
    'scp',
    'ssh',
    '--dry-run',
    'install-geoflow-overrides.sh',
    'verify-geoflow-overrides.sh',
    'smoke-geoflow-workbench.sh',
    '-Install',
    'SkipMigrate',
    'SkipSmoke'
)) {
    if ($text -notlike "*$requiredText*") {
        throw "Deploy script is missing required support text: $requiredText"
    }
}

foreach ($forbiddenText in @('Longnull', 'sshpass', 'password =', 'ConvertTo-SecureString')) {
    if ($text -like "*$forbiddenText*") {
        throw "Deploy script contains forbidden secret-handling text: $forbiddenText"
    }
}

Write-Host 'GEOFlow server deploy script validation passed.'
