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

$blockedDirectoryNames = @(
    '.data',
    'acceptance-reports',
    'desktop-agent-install',
    'dist',
    'logs',
    'node_modules',
    'temp',
    'tmp',
    'upgrade-plans',
    'vendor'
)

$blockedExactFileNames = @(
    '.env',
    'customer-manifest.json',
    'delivery-manifest.json',
    'release-manifest.json'
)

$blockedFilePatterns = @(
    '*.log',
    '*.tmp',
    '*.zip',
    '*.sha256',
    '*-DELIVERY-RELEASE-SUMMARY.md',
    '*-RELEASE-SUMMARY.md',
    '*-comparison.json',
    '*-comparison.md',
    '*-manifest.json',
    '*-readiness*.json',
    '*-validation.json',
    'acceptance-report-*.json',
    'acceptance-report-*.md',
    'upgrade-plan-*.json',
    'upgrade-plan-*.md'
)

$violations = @()

$blockedDirectories = @(Get-ChildItem -LiteralPath $rootPath -Recurse -Force -Directory -ErrorAction SilentlyContinue |
    Where-Object { $blockedDirectoryNames -contains $_.Name })
foreach ($directory in $blockedDirectories) {
    $violations += [pscustomobject]@{
        type = 'directory'
        path = $directory.FullName.Substring($rootPath.Length).TrimStart('\', '/')
        reason = "blocked runtime or generated directory: $($directory.Name)"
    }
}

$files = @(Get-ChildItem -LiteralPath $rootPath -Recurse -Force -File -ErrorAction SilentlyContinue)
foreach ($file in $files) {
    if ($blockedExactFileNames -contains $file.Name) {
        $violations += [pscustomobject]@{
            type = 'file'
            path = $file.FullName.Substring($rootPath.Length).TrimStart('\', '/')
            reason = "blocked generated or secret-bearing file: $($file.Name)"
        }
        continue
    }

    foreach ($pattern in $blockedFilePatterns) {
        if ($file.Name -like $pattern) {
            $violations += [pscustomobject]@{
                type = 'file'
                path = $file.FullName.Substring($rootPath.Length).TrimStart('\', '/')
                reason = "blocked generated artifact pattern: $pattern"
            }
            break
        }
    }
}

$configRoot = Join-Path $rootPath 'config'
if (Test-Path $configRoot) {
    $unexpectedConfigs = @(Get-ChildItem -LiteralPath $configRoot -Force -File -Filter '*.json' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'client-config.example.json' })
    foreach ($config in $unexpectedConfigs) {
        $violations += [pscustomobject]@{
            type = 'file'
            path = $config.FullName.Substring($rootPath.Length).TrimStart('\', '/')
            reason = 'customer config JSON must not be kept in the product template config directory'
        }
    }
}

if ($violations.Count -gt 0) {
    $violations | Sort-Object path | Format-Table -AutoSize
    throw "Template cleanliness validation failed: $($violations.Count) violation(s)"
}

Write-Host 'Template cleanliness validation passed.'
