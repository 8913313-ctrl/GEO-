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
$files = @(Get-ChildItem -LiteralPath $rootPath -Recurse -File -Filter '*.ps1' | Where-Object {
    $_.FullName -notlike '*\node_modules\*' -and
    $_.FullName -notlike '*\.data\*' -and
    $_.FullName -notlike '*\dist\*'
})

$failures = @()
foreach ($file in $files) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $failures += [pscustomobject]@{
            path = $file.FullName.Substring($rootPath.Length).TrimStart('\')
            message = $errors[0].Message
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | Format-Table -AutoSize
    throw "PowerShell syntax validation failed: $($failures.Count) file(s)"
}

Write-Host "PowerShell syntax validation passed: $($files.Count) file(s)"
