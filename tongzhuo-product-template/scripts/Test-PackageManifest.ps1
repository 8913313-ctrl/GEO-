[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion,
    [string]$ManifestName = 'package-manifest.json'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedPackage)
try {
    $entry = $archive.Entries | Where-Object {
        $normalized = $_.FullName -replace '\\', '/'
        $normalized -like "*/$ManifestName" -or $normalized -eq $ManifestName
    } | Select-Object -First 1
    if (-not $entry) {
        throw "Manifest not found in package: $ManifestName"
    }

    $reader = [IO.StreamReader]::new($entry.Open())
    try {
        $manifest = $reader.ReadToEnd() | ConvertFrom-Json
    } finally {
        $reader.Dispose()
    }

    if ([string] $manifest.version -ne $ExpectedVersion) {
        throw "Package manifest version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
    }

    Write-Host "Package manifest validation passed: $PackagePath"
} finally {
    $archive.Dispose()
}
