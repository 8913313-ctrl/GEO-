[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$OldReleaseManifestPath,
    [Parameter(Mandatory = $true)] [string]$NewReleaseManifestPath,
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-ArtifactPath {
    param(
        [Parameter(Mandatory = $true)] [string]$ManifestDirectory,
        [Parameter(Mandatory = $true)] [string]$PathOrFile
    )

    if ([string]::IsNullOrWhiteSpace($PathOrFile)) {
        return $null
    }

    $leafCandidate = [IO.Path]::GetFullPath((Join-Path $ManifestDirectory (Split-Path $PathOrFile -Leaf)))
    if (Test-Path $leafCandidate) {
        return $leafCandidate
    }

    $absoluteCandidate = [IO.Path]::GetFullPath($PathOrFile)
    if (Test-Path $absoluteCandidate) {
        return $absoluteCandidate
    }

    return $null
}

function Read-ReleaseManifest {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $resolvedPath = (Resolve-Path $Path).Path
    $directory = Split-Path $resolvedPath -Parent
    $manifest = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $deliveryPathValue = [string] $manifest.delivery_package.file
    if ([string]::IsNullOrWhiteSpace($deliveryPathValue)) {
        $deliveryPathValue = [string] $manifest.delivery_package.path
    }

    return [ordered]@{
        path = $resolvedPath
        directory = $directory
        manifest = $manifest
        delivery_zip = Resolve-ArtifactPath -ManifestDirectory $directory -PathOrFile $deliveryPathValue
    }
}

function Read-ZipJsonEntry {
    param(
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [Parameter(Mandatory = $true)] [string]$EntryName
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $entry = $archive.Entries | Where-Object {
            $normalized = $_.FullName -replace '\\', '/'
            $normalized -eq $EntryName -or $normalized -like "*/$EntryName"
        } | Select-Object -First 1
        if ($null -eq $entry) {
            return $null
        }
        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            return $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Add-Change {
    param(
        [System.Collections.ArrayList]$Changes,
        [Parameter(Mandatory = $true)] [string]$Name,
        [object]$OldValue,
        [object]$NewValue,
        [string]$Severity = 'info'
    )

    $oldText = if ($null -eq $OldValue) { '' } else { [string] $OldValue }
    $newText = if ($null -eq $NewValue) { '' } else { [string] $NewValue }
    if ($oldText -ne $newText) {
        [void] $Changes.Add([ordered]@{
            name = $Name
            severity = $Severity
            old = $oldText
            new = $newText
        })
    }
}

$oldRelease = Read-ReleaseManifest -Path $OldReleaseManifestPath
$newRelease = Read-ReleaseManifest -Path $NewReleaseManifestPath
$oldManifest = $oldRelease.manifest
$newManifest = $newRelease.manifest
$changes = [System.Collections.ArrayList]::new()

Add-Change -Changes $changes -Name 'product' -OldValue $oldManifest.product -NewValue $newManifest.product -Severity 'blocker'
Add-Change -Changes $changes -Name 'customer_slug' -OldValue $oldManifest.customer_slug -NewValue $newManifest.customer_slug -Severity 'blocker'
Add-Change -Changes $changes -Name 'company_name' -OldValue $oldManifest.company_name -NewValue $newManifest.company_name -Severity 'warning'
Add-Change -Changes $changes -Name 'site_url' -OldValue $oldManifest.site_url -NewValue $newManifest.site_url -Severity 'blocker'
Add-Change -Changes $changes -Name 'geoflow_base_url' -OldValue $oldManifest.geoflow_base_url -NewValue $newManifest.geoflow_base_url -Severity 'blocker'
Add-Change -Changes $changes -Name 'version' -OldValue $oldManifest.version -NewValue $newManifest.version -Severity 'info'
Add-Change -Changes $changes -Name 'delivery_package_sha256' -OldValue $oldManifest.delivery_package.sha256 -NewValue $newManifest.delivery_package.sha256 -Severity 'info'
Add-Change -Changes $changes -Name 'delivery_package_bytes' -OldValue $oldManifest.delivery_package.bytes -NewValue $newManifest.delivery_package.bytes -Severity 'info'

$oldDeliveryManifest = $null
$newDeliveryManifest = $null
if ($oldRelease.delivery_zip -and (Test-Path $oldRelease.delivery_zip)) {
    $oldDeliveryManifest = Read-ZipJsonEntry -ZipPath $oldRelease.delivery_zip -EntryName 'delivery-manifest.json'
}
if ($newRelease.delivery_zip -and (Test-Path $newRelease.delivery_zip)) {
    $newDeliveryManifest = Read-ZipJsonEntry -ZipPath $newRelease.delivery_zip -EntryName 'delivery-manifest.json'
}

foreach ($component in @('geoflow_server_overrides', 'desktop_publisher_agent', 'ai_readable_website')) {
    $oldRecord = if ($oldDeliveryManifest -and $oldDeliveryManifest.package_integrity) { $oldDeliveryManifest.package_integrity.$component } else { $null }
    $newRecord = if ($newDeliveryManifest -and $newDeliveryManifest.package_integrity) { $newDeliveryManifest.package_integrity.$component } else { $null }
    Add-Change -Changes $changes -Name "$component.sha256" -OldValue $(if ($oldRecord) { $oldRecord.sha256 } else { $null }) -NewValue $(if ($newRecord) { $newRecord.sha256 } else { $null }) -Severity 'info'
    Add-Change -Changes $changes -Name "$component.bytes" -OldValue $(if ($oldRecord) { $oldRecord.bytes } else { $null }) -NewValue $(if ($newRecord) { $newRecord.bytes } else { $null }) -Severity 'info'
}

$blockers = @($changes | Where-Object { $_.severity -eq 'blocker' })
$status = if ($blockers.Count -gt 0) {
    'blocked'
} elseif ($changes.Count -gt 0) {
    'changed'
} else {
    'unchanged'
}

$report = [ordered]@{
    report_type = 'tongzhuo_customer_delivery_release_comparison'
    status = $status
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    old_release = [ordered]@{
        manifest_path = [string] $oldRelease.path
        release_slug = [string] $oldManifest.release_slug
        version = [string] $oldManifest.version
        customer_slug = [string] $oldManifest.customer_slug
        delivery_zip = [string] $oldRelease.delivery_zip
    }
    new_release = [ordered]@{
        manifest_path = [string] $newRelease.path
        release_slug = [string] $newManifest.release_slug
        version = [string] $newManifest.version
        customer_slug = [string] $newManifest.customer_slug
        delivery_zip = [string] $newRelease.delivery_zip
    }
    artifact_checks = [ordered]@{
        old_delivery_manifest_read = $null -ne $oldDeliveryManifest
        new_delivery_manifest_read = $null -ne $newDeliveryManifest
    }
    changes = @($changes)
    upgrade_safety = [ordered]@{
        same_customer = [string] $oldManifest.customer_slug -eq [string] $newManifest.customer_slug
        same_site_url = [string] $oldManifest.site_url -eq [string] $newManifest.site_url
        same_geoflow_base_url = [string] $oldManifest.geoflow_base_url -eq [string] $newManifest.geoflow_base_url
        backup_required = $true
        dry_run_required = $true
        acceptance_report_required = $true
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $defaultRoot = Split-Path ((Resolve-Path $NewReleaseManifestPath).Path) -Parent
    $OutputPath = Join-Path $defaultRoot "delivery-release-comparison-$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

$markdownOutput = [IO.Path]::ChangeExtension($resolvedOutput, '.md')
$changeRows = @($changes | ForEach-Object {
    "| $($_.severity) | $($_.name) | $($_.old) | $($_.new) |"
})
if ($changeRows.Count -eq 0) {
    $changeRows = @('| info | no_changes |  |  |')
}
$markdown = @(
    '# Tongzhuo Customer Delivery Release Comparison',
    '',
    "Status: $status",
    "Generated at: $($report.generated_at)",
    '',
    '## Releases',
    '',
    "| Side | Release | Version | Customer |",
    "| --- | --- | --- | --- |",
    "| Old | $($report.old_release.release_slug) | $($report.old_release.version) | $($report.old_release.customer_slug) |",
    "| New | $($report.new_release.release_slug) | $($report.new_release.version) | $($report.new_release.customer_slug) |",
    '',
    '## Changes',
    '',
    '| Severity | Field | Old | New |',
    '| --- | --- | --- | --- |'
) + $changeRows + @(
    '',
    '## Upgrade Safety',
    '',
    "- Same customer: $($report.upgrade_safety.same_customer)",
    "- Same site URL: $($report.upgrade_safety.same_site_url)",
    "- Same GEOFlow URL: $($report.upgrade_safety.same_geoflow_base_url)",
    '- Backup required: True',
    '- Server dry-run required: True',
    '- Acceptance report required: True'
)
Set-Content -LiteralPath $markdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

Write-Host "Customer delivery release comparison created: $resolvedOutput"
Write-Host "Customer delivery release comparison summary created: $markdownOutput"
