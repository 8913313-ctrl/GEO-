[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ReadinessReportPath,
    [string]$Root = '',
    [string]$ReleasePackagePath = '',
    [string]$ChecksumFile = '',
    [string]$ReleaseSlug = '',
    [string]$OutputPath = '',
    [string]$JsonOutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$resolvedReadinessReport = (Resolve-Path $ReadinessReportPath).Path
$report = Get-Content -LiteralPath $resolvedReadinessReport -Raw -Encoding UTF8 | ConvertFrom-Json

if ([string] $report.status -ne 'passed') {
    throw "Readiness report must be passed before release notes are generated. Status: $($report.status)"
}

$version = [string] $report.version
if ([string]::IsNullOrWhiteSpace($ReleaseSlug)) {
    $ReleaseSlug = "tongzhuo-geo-growth-suite-v$version"
}
$safeReleaseSlug = ($ReleaseSlug -replace '[^a-zA-Z0-9._-]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeReleaseSlug)) {
    throw 'ReleaseSlug resolved to an empty value.'
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Split-Path $resolvedReadinessReport -Parent) "$safeReleaseSlug-RELEASE-NOTES.md"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null

if ([string]::IsNullOrWhiteSpace($JsonOutputPath)) {
    $JsonOutputPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.json')
}
$resolvedJsonOutputPath = [IO.Path]::GetFullPath($JsonOutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutputPath -Parent) | Out-Null

function Get-ChangelogItems {
    param(
        [Parameter(Mandatory = $true)] [string]$ChangelogPath,
        [Parameter(Mandatory = $true)] [string]$TargetVersion
    )

    if (-not (Test-Path $ChangelogPath)) {
        throw "CHANGELOG.md not found: $ChangelogPath"
    }

    $text = Get-Content -LiteralPath $ChangelogPath -Raw -Encoding UTF8
    $pattern = "(?ms)^## \[$([regex]::Escape($TargetVersion))\].*?(?=^## \[|\z)"
    $match = [regex]::Match($text, $pattern)
    if (-not $match.Success) {
        return @()
    }

    $lines = @($match.Value -split '\r?\n' | ForEach-Object { $_.Trim() })
    return @($lines | Where-Object { $_ -like '- *' } | ForEach-Object { $_.Substring(2).Trim() })
}

function New-FileArtifact {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Role
    )

    $resolved = (Resolve-Path $Path).Path
    $item = Get-Item -LiteralPath $resolved
    return [ordered]@{
        role = $Role
        file = Split-Path $resolved -Leaf
        path = $resolved
        sha256 = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
    }
}

$changes = Get-ChangelogItems -ChangelogPath (Join-Path $rootPath 'CHANGELOG.md') -TargetVersion $version
if (@($changes).Count -eq 0) {
    $changes = @('No CHANGELOG.md items were found for this version.')
}

$checkRecords = @($report.checks | ForEach-Object {
    [ordered]@{
        name = [string] $_.name
        status = [string] $_.status
        duration_seconds = [decimal] $_.duration_seconds
    }
})
$failedChecks = @($checkRecords | Where-Object { $_.status -ne 'passed' })
if ($failedChecks.Count -gt 0) {
    throw "Readiness report contains failed checks; release notes cannot be generated."
}
$omittedChecks = if ($null -ne $report.PSObject.Properties['omitted_checks']) { @($report.omitted_checks) } else { @() }
$omittedCheckRecords = @($omittedChecks | ForEach-Object {
    [ordered]@{
        name = [string] $_.name
        reason = [string] $_.reason
        run_mode = [string] $_.run_mode
    }
})

$artifactRecords = @()
if (-not [string]::IsNullOrWhiteSpace($ReleasePackagePath)) {
    $artifactRecords += New-FileArtifact -Path $ReleasePackagePath -Role 'product_release_package'
}
if (-not [string]::IsNullOrWhiteSpace($ChecksumFile)) {
    $artifactRecords += New-FileArtifact -Path $ChecksumFile -Role 'checksum_file'
}
$artifactRecords += New-FileArtifact -Path $resolvedReadinessReport -Role 'readiness_report'

$customerDeliveryRelease = $null
$customerDeliveryReleaseProperty = if ($null -ne $report.artifacts) { $report.artifacts.PSObject.Properties['customer_delivery_release'] } else { $null }
if ($null -ne $customerDeliveryReleaseProperty -and $null -ne $customerDeliveryReleaseProperty.Value) {
    $cdr = $customerDeliveryReleaseProperty.Value
    $deliveryPackagePath = [string] $cdr.path
    $validationReportPath = [string] $cdr.validation_report
    $releaseManifestPath = [string] $cdr.release_manifest
    $configReviewPath = [string] $cdr.config_review
    $configReviewJsonPath = [string] $cdr.config_review_json
    $releaseSummaryPath = [string] $cdr.release_summary
    $releaseNotesPath = [string] $cdr.release_notes
    $releaseNotesJsonPath = [string] $cdr.release_notes_json
    $handoffChecklistPath = [string] $cdr.handoff_checklist
    $handoffChecklistJsonPath = [string] $cdr.handoff_checklist_json
    $archiveIndexPath = [string] $cdr.archive_index
    $archiveIndexMarkdownPath = [string] $cdr.archive_index_markdown
    $retainedProperty = $cdr.PSObject.Properties['retained']
    $isRetained = if ($null -ne $retainedProperty -and $null -ne $retainedProperty.Value) { [bool] $retainedProperty.Value } else { $false }
    $customerDeliveryRelease = [ordered]@{
        validated = $true
        retained = $isRetained
        delivery_package = if ($isRetained) { $deliveryPackagePath } else { $null }
        validation_report = if ($isRetained) { $validationReportPath } else { $null }
        release_manifest = if ($isRetained) { $releaseManifestPath } else { $null }
        config_review = if ($isRetained) { $configReviewPath } else { $null }
        config_review_json = if ($isRetained) { $configReviewJsonPath } else { $null }
        release_summary = if ($isRetained) { $releaseSummaryPath } else { $null }
        release_notes = if ($isRetained) { $releaseNotesPath } else { $null }
        release_notes_json = if ($isRetained) { $releaseNotesJsonPath } else { $null }
        handoff_checklist = if ($isRetained) { $handoffChecklistPath } else { $null }
        handoff_checklist_json = if ($isRetained) { $handoffChecklistJsonPath } else { $null }
        archive_index = if ($isRetained) { $archiveIndexPath } else { $null }
        archive_index_markdown = if ($isRetained) { $archiveIndexMarkdownPath } else { $null }
        delivery_package_file = if ([string]::IsNullOrWhiteSpace($deliveryPackagePath)) { '' } else { Split-Path $deliveryPackagePath -Leaf }
        validation_report_file = if ([string]::IsNullOrWhiteSpace($validationReportPath)) { '' } else { Split-Path $validationReportPath -Leaf }
        release_manifest_file = if ([string]::IsNullOrWhiteSpace($releaseManifestPath)) { '' } else { Split-Path $releaseManifestPath -Leaf }
        config_review_file = if ([string]::IsNullOrWhiteSpace($configReviewPath)) { '' } else { Split-Path $configReviewPath -Leaf }
        config_review_json_file = if ([string]::IsNullOrWhiteSpace($configReviewJsonPath)) { '' } else { Split-Path $configReviewJsonPath -Leaf }
        release_summary_file = if ([string]::IsNullOrWhiteSpace($releaseSummaryPath)) { '' } else { Split-Path $releaseSummaryPath -Leaf }
        release_notes_file = if ([string]::IsNullOrWhiteSpace($releaseNotesPath)) { '' } else { Split-Path $releaseNotesPath -Leaf }
        release_notes_json_file = if ([string]::IsNullOrWhiteSpace($releaseNotesJsonPath)) { '' } else { Split-Path $releaseNotesJsonPath -Leaf }
        handoff_checklist_file = if ([string]::IsNullOrWhiteSpace($handoffChecklistPath)) { '' } else { Split-Path $handoffChecklistPath -Leaf }
        handoff_checklist_json_file = if ([string]::IsNullOrWhiteSpace($handoffChecklistJsonPath)) { '' } else { Split-Path $handoffChecklistJsonPath -Leaf }
        archive_index_file = if ([string]::IsNullOrWhiteSpace($archiveIndexPath)) { '' } else { Split-Path $archiveIndexPath -Leaf }
        archive_index_markdown_file = if ([string]::IsNullOrWhiteSpace($archiveIndexMarkdownPath)) { '' } else { Split-Path $archiveIndexMarkdownPath -Leaf }
        sha256 = [string] $cdr.sha256
        bytes = if ($null -ne $cdr.bytes) { [int64] $cdr.bytes } else { 0 }
    }
}

$releaseNotes = [ordered]@{
    notes_type = 'tongzhuo_product_release_notes'
    product = [string] $report.product
    version = $version
    release_slug = $safeReleaseSlug
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    status = 'ready'
    changes = $changes
    readiness = [ordered]@{
        report = $resolvedReadinessReport
        generated_at = [string] $report.generated_at
        mode = if ($null -ne $report.PSObject.Properties['readiness_mode']) { [string] $report.readiness_mode } else { 'Full' }
        checks = $checkRecords
        omitted_checks = $omittedCheckRecords
    }
    artifacts = $artifactRecords
    customer_delivery_release = $customerDeliveryRelease
    delivery_boundary = [ordered]@{
        excludes_customer_api_tokens = $true
        excludes_platform_credentials = $true
        excludes_browser_profiles = $true
        excludes_runtime_artifacts = $true
        desktop_credentials_stay_local = $true
    }
    handoff = @(
        'Use New-CustomerConfig.ps1 to create a validated customer configuration.',
        'Use New-CustomerDeliveryRelease.ps1 to create a formal customer delivery release.',
        'Verify SHA256 before copying release files to implementation, sales, or archive storage.',
        'Run Start-CustomerDelivery.ps1 -Action Verify after extracting a customer package.'
    )
}

$releaseNotes | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutputPath -Encoding UTF8

$changeLines = @($changes | ForEach-Object { "- $_" })
$checkRows = @($checkRecords | ForEach-Object {
    "| $($_.name) | $($_.status) | $($_.duration_seconds) |"
})
$omittedLines = if ($omittedCheckRecords.Count -gt 0) {
    @($omittedCheckRecords | ForEach-Object { "- $($_.name): $($_.reason)" })
} else {
    @('- No checks omitted.')
}
$artifactRows = @($artifactRecords | ForEach-Object {
    "| $($_.role) | $($_.file) | $($_.bytes) | $($_.sha256) |"
})
$handoffLines = @($releaseNotes.handoff | ForEach-Object { "1. $_" })

$customerDeliveryLines = @()
if ($null -ne $customerDeliveryRelease) {
    if ([bool] $customerDeliveryRelease.retained) {
        $customerDeliveryLines = @(
            '',
            '## Customer Delivery Smoke Release',
            '',
            "- Package: $($customerDeliveryRelease.delivery_package)",
            "- Manifest: $($customerDeliveryRelease.release_manifest)",
            "- Config review: $($customerDeliveryRelease.config_review)",
            "- Delivery release notes: $($customerDeliveryRelease.release_notes)",
            "- Handoff checklist: $($customerDeliveryRelease.handoff_checklist)",
            "- Archive index: $($customerDeliveryRelease.archive_index)",
            "- SHA256: $($customerDeliveryRelease.sha256)"
        )
    } else {
        $customerDeliveryLines = @(
            '',
            '## Customer Delivery Smoke Release',
            '',
            'The readiness run generated and validated a customer delivery release smoke package. The smoke artifacts were temporary and intentionally not retained in the formal product release archive.',
            '',
            "- Package file: $($customerDeliveryRelease.delivery_package_file)",
            "- Manifest file: $($customerDeliveryRelease.release_manifest_file)",
            "- Config review file: $($customerDeliveryRelease.config_review_file)",
            "- Delivery release notes file: $($customerDeliveryRelease.release_notes_file)",
            "- Handoff checklist file: $($customerDeliveryRelease.handoff_checklist_file)",
            "- Archive index file: $($customerDeliveryRelease.archive_index_file)",
            "- SHA256: $($customerDeliveryRelease.sha256)"
        )
    }
}

$markdown = @(
    "# $safeReleaseSlug Release Notes",
    '',
    "Product: $($releaseNotes.product)",
    "Version: $version",
    "Status: $($releaseNotes.status)",
    "Generated at: $($releaseNotes.generated_at)",
    '',
    '## What Changed',
    ''
) + $changeLines + @(
    '',
    '## Release Artifacts',
    '',
    '| Role | File | Bytes | SHA256 |',
    '| --- | --- | ---: | --- |'
) + $artifactRows + @(
    '',
    '## Readiness Evidence',
    '',
    "Readiness report: $resolvedReadinessReport",
    "Readiness mode: $($releaseNotes.readiness.mode)",
    '',
    '| Check | Status | Seconds |',
    '| --- | --- | ---: |'
) + $checkRows + @(
    '',
    '## Omitted Readiness Checks',
    ''
) + $omittedLines + $customerDeliveryLines + @(
    '',
    '## Delivery Boundary',
    '',
    '- Customer API tokens are not included.',
    '- Third-party platform credentials, cookies, and browser profiles are not included.',
    '- Runtime folders, logs, temporary files, dependency folders, and customer config files are excluded from product releases.',
    '- Platform login state remains on the operator Windows desktop agent.',
    '',
    '## Handoff',
    ''
) + $handoffLines

Set-Content -LiteralPath $resolvedOutputPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

$result = [ordered]@{
    status = 'created'
    release_notes = $resolvedOutputPath
    release_notes_json = $resolvedJsonOutputPath
    version = $version
    release_slug = $safeReleaseSlug
}
$result | ConvertTo-Json -Depth 4 | Write-Output
