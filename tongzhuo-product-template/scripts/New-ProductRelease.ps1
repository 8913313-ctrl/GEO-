[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputRoot = '',
    [string]$ReleaseSlug = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $rootPath 'dist\releases'
}
$resolvedOutputRoot = [IO.Path]::GetFullPath($OutputRoot)
New-Item -ItemType Directory -Force -Path $resolvedOutputRoot | Out-Null

if ([string]::IsNullOrWhiteSpace($ReleaseSlug)) {
    $ReleaseSlug = "tongzhuo-geo-growth-suite-v$version"
}
$safeReleaseSlug = ($ReleaseSlug -replace '[^a-zA-Z0-9._-]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeReleaseSlug)) {
    throw 'ReleaseSlug resolved to an empty value.'
}

$releaseZip = Join-Path $resolvedOutputRoot "$safeReleaseSlug.zip"
$readinessReport = Join-Path $resolvedOutputRoot "$safeReleaseSlug-readiness.json"
$checksumFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug.sha256"
$summaryFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-RELEASE-SUMMARY.md"
$releaseNotesFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-RELEASE-NOTES.md"
$releaseNotesJsonFile = Join-Path $resolvedOutputRoot "$safeReleaseSlug-RELEASE-NOTES.json"

foreach ($path in @($releaseZip, $readinessReport, $checksumFile, $summaryFile, $releaseNotesFile, $releaseNotesJsonFile)) {
    if ((Test-Path $path) -and -not $Force) {
        throw "Release artifact already exists: $path. Use -Force to replace it."
    }
}

foreach ($path in @($releaseZip, $readinessReport, $checksumFile, $summaryFile, $releaseNotesFile, $releaseNotesJsonFile)) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Force
    }
}

& (Join-Path $rootPath 'scripts\Test-ProductReadiness.ps1') `
    -Root $rootPath `
    -OutputPath $readinessReport `
    -ReleaseOutputPath $releaseZip
$exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int]$exitCodeVariable.Value -ne 0) {
    throw "Product readiness failed with exit code $($exitCodeVariable.Value)"
}

$report = Get-Content -LiteralPath $readinessReport -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string] $report.status -ne 'passed') {
    throw "Product readiness report did not pass. Status: $($report.status)"
}

$releaseItem = Get-Item -LiteralPath $releaseZip
$releaseHash = (Get-FileHash -LiteralPath $releaseZip -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumLine = "$releaseHash  $(Split-Path $releaseZip -Leaf)"
Set-Content -LiteralPath $checksumFile -Value $checksumLine -Encoding ASCII

$checkRows = @($report.checks | ForEach-Object {
    "| $($_.name) | $($_.status) | $($_.duration_seconds) |"
})
$omittedLines = @()
if ($null -ne $report.PSObject.Properties['omitted_checks']) {
    $omittedLines = @($report.omitted_checks | ForEach-Object { "- $($_.name): $($_.reason)" })
}
if ($omittedLines.Count -eq 0) {
    $omittedLines = @('- No checks omitted.')
}
$readinessMode = if ($null -ne $report.PSObject.Properties['readiness_mode']) { [string] $report.readiness_mode } else { 'Full' }
$summaryLines = @(
    "# $safeReleaseSlug Release Summary",
    '',
    "Product: $($report.product)",
    "Version: $($report.version)",
    "Generated at: $($report.generated_at)",
    "Status: $($report.status)",
    "Readiness mode: $readinessMode",
    '',
    '## Artifacts',
    '',
    "| File | Bytes | SHA256 |",
    "| --- | ---: | --- |",
    "| $(Split-Path $releaseZip -Leaf) | $($releaseItem.Length) | $releaseHash |",
    "| $(Split-Path $readinessReport -Leaf) | $((Get-Item -LiteralPath $readinessReport).Length) |  |",
    "| $(Split-Path $checksumFile -Leaf) | $((Get-Item -LiteralPath $checksumFile).Length) |  |",
    '',
    '## Readiness Checks',
    '',
    '| Check | Status | Seconds |',
    '| --- | --- | ---: |'
) + $checkRows + @(
    '',
    '## Verification',
    '',
    'Recalculate SHA256 for the release zip and compare it with the .sha256 file before copying this release to implementation, sales delivery, or archive storage.',
    '',
    '## Omitted Checks',
    ''
) + $omittedLines + @(
    '',
    'Quick readiness is intended for day-to-day product release packaging. Run Test-ProductReadiness.ps1 -Mode Full before major commercial release audits that require full customer delivery smoke packaging and formal customer release archive validation.'
)

Set-Content -LiteralPath $summaryFile -Value ($summaryLines -join [Environment]::NewLine) -Encoding UTF8

$releaseNotesResultJson = & (Join-Path $rootPath 'scripts\New-ProductReleaseNotes.ps1') `
    -Root $rootPath `
    -ReadinessReportPath $readinessReport `
    -ReleasePackagePath $releaseZip `
    -ChecksumFile $checksumFile `
    -ReleaseSlug $safeReleaseSlug `
    -OutputPath $releaseNotesFile `
    -JsonOutputPath $releaseNotesJsonFile
$releaseNotesResult = $releaseNotesResultJson | ConvertFrom-Json
if ([string] $releaseNotesResult.status -ne 'created') {
    throw "Release notes were not created. Status: $($releaseNotesResult.status)"
}

$result = [ordered]@{
    product = [string] $report.product
    version = [string] $report.version
    status = [string] $report.status
    release_slug = $safeReleaseSlug
    output_root = $resolvedOutputRoot
    release_package = $releaseZip
    readiness_report = $readinessReport
    checksum_file = $checksumFile
    release_summary = $summaryFile
    release_notes = $releaseNotesFile
    release_notes_json = $releaseNotesJsonFile
    sha256 = $releaseHash
    bytes = [int64] $releaseItem.Length
}
$result | ConvertTo-Json -Depth 4 | Write-Output
