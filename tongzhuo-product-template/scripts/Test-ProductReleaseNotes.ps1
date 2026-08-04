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
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-release-notes-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $readinessPath = Join-Path $testRoot 'readiness.json'
    $releasePackagePath = Join-Path $testRoot "tongzhuo-geo-growth-suite-v$version.zip"
    $checksumPath = Join-Path $testRoot "tongzhuo-geo-growth-suite-v$version.sha256"
    $notesPath = Join-Path $testRoot "tongzhuo-geo-growth-suite-v$version-RELEASE-NOTES.md"
    $notesJsonPath = Join-Path $testRoot "tongzhuo-geo-growth-suite-v$version-RELEASE-NOTES.json"

    Set-Content -LiteralPath $releasePackagePath -Value 'release package fixture' -Encoding UTF8
    $hash = (Get-FileHash -LiteralPath $releasePackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $checksumPath -Value "$hash  $(Split-Path $releasePackagePath -Leaf)" -Encoding ASCII

    $readiness = [ordered]@{
        product = [string] $product.product
        version = $version
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        status = 'passed'
        checks = @(
            [ordered]@{ name = 'version_consistency'; status = 'passed'; duration_seconds = 0.1 },
            [ordered]@{ name = 'template_validation'; status = 'passed'; duration_seconds = 0.2 },
            [ordered]@{ name = 'product_release_package_validation'; status = 'passed'; duration_seconds = 0.3 }
        )
        artifacts = [ordered]@{
            customer_delivery_release = [ordered]@{
                path = 'C:\tmp\customer-delivery.zip'
                validation_report = 'C:\tmp\customer-validation.json'
                release_manifest = 'C:\tmp\customer-manifest.json'
                config_review = 'C:\tmp\customer-config-review.md'
                config_review_json = 'C:\tmp\customer-config-review.json'
                release_summary = 'C:\tmp\customer-summary.md'
                release_notes = 'C:\tmp\customer-delivery-release-notes.md'
                release_notes_json = 'C:\tmp\customer-delivery-release-notes.json'
                handoff_checklist = 'C:\tmp\customer-handoff-checklist.md'
                handoff_checklist_json = 'C:\tmp\customer-handoff-checklist.json'
                archive_index = 'C:\tmp\customer-archive-index.json'
                archive_index_markdown = 'C:\tmp\customer-archive-index.md'
                sha256 = 'abc123'
                bytes = 123
            }
        }
    }
    $readiness | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $readinessPath -Encoding UTF8

    $resultJson = & (Join-Path $rootPath 'scripts\New-ProductReleaseNotes.ps1') `
        -Root $rootPath `
        -ReadinessReportPath $readinessPath `
        -ReleasePackagePath $releasePackagePath `
        -ChecksumFile $checksumPath `
        -ReleaseSlug "tongzhuo-geo-growth-suite-v$version" `
        -OutputPath $notesPath `
        -JsonOutputPath $notesJsonPath
    $result = $resultJson | ConvertFrom-Json

    Assert-Condition ([string] $result.status -eq 'created') "Release notes generator status mismatch: $($result.status)"
    Assert-Condition (Test-Path $notesPath) 'Release notes Markdown was not created.'
    Assert-Condition (Test-Path $notesJsonPath) 'Release notes JSON was not created.'

    $notes = Get-Content -LiteralPath $notesJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $notes.notes_type -eq 'tongzhuo_product_release_notes') "Release notes type mismatch: $($notes.notes_type)"
    Assert-Condition ([string] $notes.version -eq $version) "Release notes version mismatch. Expected $version, got $($notes.version)"
    Assert-Condition (@($notes.changes).Count -gt 0) 'Release notes should include changelog items.'
    Assert-Condition (@($notes.readiness.checks).Count -eq 3) 'Release notes should include readiness checks.'
    Assert-Condition ([bool] $notes.delivery_boundary.excludes_platform_credentials) 'Release notes should declare platform credential boundary.'
    Assert-Condition (-not [bool] $notes.customer_delivery_release.retained) 'Release notes fixture customer smoke release should not be retained.'
    Assert-Condition ([string] $notes.customer_delivery_release.config_review_file -like '*config-review.md') 'Release notes should include customer config review filename.'
    Assert-Condition ([string] $notes.customer_delivery_release.release_notes_file -like '*release-notes.md') 'Release notes should include customer delivery release notes filename.'
    Assert-Condition ([string] $notes.customer_delivery_release.handoff_checklist_file -like '*handoff-checklist.md') 'Release notes should include customer handoff checklist filename.'
    Assert-Condition ([string] $notes.customer_delivery_release.archive_index_file -like '*archive-index.json') 'Release notes should include customer archive index filename.'

    $markdown = Get-Content -LiteralPath $notesPath -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*## What Changed*') 'Release notes Markdown is missing What Changed.'
    Assert-Condition ($markdown -like '*## Readiness Evidence*') 'Release notes Markdown is missing Readiness Evidence.'
    Assert-Condition ($markdown -like '*## Delivery Boundary*') 'Release notes Markdown is missing Delivery Boundary.'
    Assert-Condition ($markdown -like '*platform credentials*') 'Release notes Markdown is missing platform credential boundary.'
    Assert-Condition ($markdown -like '*Config review file*') 'Release notes Markdown is missing customer config review file.'
    Assert-Condition ($markdown -like '*Delivery release notes file*') 'Release notes Markdown is missing customer delivery release notes file.'
    Assert-Condition ($markdown -like '*Handoff checklist file*') 'Release notes Markdown is missing customer handoff checklist file.'
    Assert-Condition ($markdown -like '*intentionally not retained*') 'Release notes Markdown should explain temporary smoke artifacts.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Product release notes validation passed.'
