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
$integrationRoot = Join-Path $rootPath 'geoflow-integration'
$overridesRoot = Join-Path $integrationRoot 'server-overrides'
$installerPath = Join-Path $integrationRoot 'deployment\install-geoflow-overrides.sh'
$verifierPath = Join-Path $integrationRoot 'deployment\verify-geoflow-overrides.sh'
$smokePath = Join-Path $integrationRoot 'deployment\smoke-geoflow-workbench.sh'
$publisherContractPath = Join-Path $integrationRoot 'deployment\check-publisher-automation-contract.ps1'

if (-not (Test-Path $overridesRoot)) {
    throw "server-overrides not found: $overridesRoot"
}
if (-not (Test-Path $installerPath)) {
    throw "Linux installer not found: $installerPath"
}
if (-not (Test-Path $verifierPath)) {
    throw "Linux verifier not found: $verifierPath"
}
if (-not (Test-Path $smokePath)) {
    throw "Linux smoke test not found: $smokePath"
}
if (-not (Test-Path $publisherContractPath)) {
    throw "Publisher automation contract check not found: $publisherContractPath"
}
& $publisherContractPath -PackageRoot $integrationRoot
$product = & (Join-Path $PSScriptRoot 'Read-ProductMetadata.ps1') -Root $rootPath

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $packageDir = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $packageDir "tongzhuo-geoflow-server-overrides-$stamp.zip"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $resolvedOutput -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-geoflow-server-' + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stagingRoot 'tongzhuo-geoflow-server-overrides'
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

try {
    Copy-Item -LiteralPath $overridesRoot -Destination (Join-Path $packageRoot 'server-overrides') -Recurse -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'deployment') | Out-Null
    Copy-Item -LiteralPath $installerPath -Destination (Join-Path $packageRoot 'deployment\install-geoflow-overrides.sh') -Force
    Copy-Item -LiteralPath $verifierPath -Destination (Join-Path $packageRoot 'deployment\verify-geoflow-overrides.sh') -Force
    Copy-Item -LiteralPath $smokePath -Destination (Join-Path $packageRoot 'deployment\smoke-geoflow-workbench.sh') -Force
    Copy-Item -LiteralPath $publisherContractPath -Destination (Join-Path $packageRoot 'deployment\check-publisher-automation-contract.ps1') -Force

    $manifest = @{
        product = 'Tongzhuo GEOFlow Server Overrides'
        suite = [string] $product.product
        version = [string] $product.version
        component = 'geoflow-workbench'
        packaged_at = (Get-Date).ToUniversalTime().ToString('o')
        source = 'geoflow-integration/server-overrides'
        install_command = 'bash deployment/install-geoflow-overrides.sh --laravel-root /path/to/geoflow --package-root .'
        dry_run_command = 'bash deployment/install-geoflow-overrides.sh --laravel-root /path/to/geoflow --package-root . --dry-run'
        verify_command = 'bash deployment/verify-geoflow-overrides.sh --laravel-root /path/to/geoflow --base-url https://example.com'
        smoke_command = 'bash deployment/smoke-geoflow-workbench.sh --base-url https://example.com'
        contract_check_command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File deployment/check-publisher-automation-contract.ps1 -PackageRoot .'
        excludes = @('.env', 'storage', 'vendor', 'node_modules', '.data')
        publisher_automation = @{
            reconcile_command = 'php artisan publisher:reconcile --json'
            scheduler_verify_command = 'php artisan schedule:list'
            scheduler_cron_required = $true
            required_feature_flags = @(
                'PUBLISHING_CENTER_V2_ENABLED',
                'PUBLISHER_PLATFORM_JOBS_ENABLED',
                'PUBLISHER_DEVICE_COMMANDS_ENABLED',
                'PUBLISHER_DEVICE_EVENTS_ENABLED'
            )
            sse_proxy_buffering_must_be_disabled = $true
        }
        security = @{
            excludes_env = $true
            excludes_runtime_storage = $true
            excludes_customer_tokens = $true
        }
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $packageRoot 'package-manifest.json') -Encoding UTF8

    if (Test-Path $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }
    Compress-Archive -Path $packageRoot -DestinationPath $resolvedOutput -Force
    & (Join-Path $PSScriptRoot 'Test-GeoFlowServerPackage.ps1') -PackagePath $resolvedOutput -ExpectedVersion ([string] $product.version)
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int]$exitCodeVariable.Value -ne 0) {
        throw "GEOFlow server package validation failed with exit code $($exitCodeVariable.Value)"
    }
} finally {
    if (Test-Path $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "GEOFlow server override package created: $resolvedOutput"
