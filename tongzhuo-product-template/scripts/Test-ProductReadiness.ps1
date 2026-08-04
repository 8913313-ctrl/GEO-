[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputPath = '',
    [string]$ReleaseOutputPath = '',
    [ValidateSet('Quick', 'Full')] [string]$Mode = 'Quick',
    [switch]$KeepReleasePackage
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $reportRoot = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $reportRoot "tongzhuo-product-readiness-$version-$stamp.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-readiness-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$customerDeliveryReleaseArtifact = $null
if ([string]::IsNullOrWhiteSpace($ReleaseOutputPath)) {
    $releasePackage = Join-Path $tempRoot "tongzhuo-geo-growth-suite-v$version-readiness.zip"
    $retainReleasePackage = [bool] $KeepReleasePackage
} else {
    $releasePackage = [IO.Path]::GetFullPath($ReleaseOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $releasePackage -Parent) | Out-Null
    $retainReleasePackage = $true
}

$report = [ordered]@{
    product = [string] $product.product
    version = $version
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    root = $rootPath
    readiness_mode = $Mode
    status = 'running'
    checks = @()
    omitted_checks = @()
    artifacts = [ordered]@{}
    bill_of_materials = @()
}

function Save-Report {
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8
}

function Get-FileFingerprint {
    param([Parameter(Mandatory = $true)] [string]$RelativePath)

    $path = Join-Path $rootPath ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $path)) {
        throw "Readiness fingerprint target not found: $RelativePath"
    }

    $item = Get-Item -LiteralPath $path
    $hash = Get-FileHash -LiteralPath $path -Algorithm SHA256
    return [ordered]@{
        path = $RelativePath
        sha256 = $hash.Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
    }
}

function Invoke-ReadinessStep {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [scriptblock]$Script
    )

    $started = Get-Date
    $step = [ordered]@{
        name = $Name
        status = 'running'
        started_at = $started.ToUniversalTime().ToString('o')
        finished_at = $null
        duration_seconds = $null
        error = $null
    }
    $report.checks += $step
    try {
        & $Script
        $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
        if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int]$exitCodeVariable.Value -ne 0) {
            throw "$Name failed with exit code $($exitCodeVariable.Value)"
        }
        $step.status = 'passed'
    } catch {
        $step.status = 'failed'
        $step.error = [string] $_.Exception.Message
        $report.status = 'failed'
        Save-Report
        throw
    } finally {
        $finished = Get-Date
        $step.finished_at = $finished.ToUniversalTime().ToString('o')
        $step.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
    }
}

function Add-OmittedReadinessCheck {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Reason
    )

    $report.omitted_checks += [ordered]@{
        name = $Name
        reason = $Reason
        run_mode = $Mode
    }
}

try {
    Invoke-ReadinessStep -Name 'version_consistency' -Script {
        & (Join-Path $rootPath 'scripts\Test-VersionConsistency.ps1') -Root $rootPath
    }

    Invoke-ReadinessStep -Name 'template_cleanliness' -Script {
        & (Join-Path $rootPath 'scripts\Test-TemplateCleanliness.ps1') -Root $rootPath
    }

    Invoke-ReadinessStep -Name 'template_validation' -Script {
        & (Join-Path $rootPath 'scripts\Test-Template.ps1') -Root $rootPath
    }

    Invoke-ReadinessStep -Name 'product_architecture_contract' -Script {
        & (Join-Path $rootPath 'scripts\Test-ProductArchitecture.ps1') -Root $rootPath
    }

if ($Mode -eq 'Full') {
        Add-OmittedReadinessCheck -Name 'customer_delivery_smoke_test' -Reason 'Full mode is covered by customer_delivery_release_archive, which generates a formal customer config, builds a complete customer release archive, validates the delivery package, validates the release manifest, and self-compares the release. This avoids duplicating the same server, desktop, website, delivery package, publishing loop, and secret-scan gates twice in one readiness run.'

        Invoke-ReadinessStep -Name 'customer_delivery_release_archive' -Script {
            $customerReleaseOutputRoot = Join-Path $tempRoot 'customer-release'
            $customerReleaseConfigPath = Join-Path $tempRoot 'readiness-customer.json'
            & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
                -CustomerSlug 'readiness-client' `
                -CompanyName 'Readiness Client Network Technology Co Ltd' `
                -ShortName 'Readiness Client' `
                -AlternateName 'Readiness Client AI' `
                -Description 'Readiness customer delivery release smoke test.' `
                -SiteUrl 'https://readiness.example.com' `
                -GeoFlowBaseUrl 'https://flow.readiness.example.com' `
                -OutputPath $customerReleaseConfigPath `
                -Force | Out-Null
            $customerReleaseResultJson = & (Join-Path $rootPath 'scripts\New-CustomerDeliveryRelease.ps1') `
                -ConfigPath $customerReleaseConfigPath `
                -Root $rootPath `
                -OutputRoot $customerReleaseOutputRoot `
                -ReleaseSlug "readiness-client-tongzhuo-geo-delivery-v$version" `
                -Force
            $customerReleaseResult = $customerReleaseResultJson | ConvertFrom-Json
            & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryRelease.ps1') `
                -ReleaseManifestPath ([string] $customerReleaseResult.release_manifest) `
                -ExpectedVersion $version
            $comparisonPath = Join-Path $customerReleaseOutputRoot 'readiness-client-release-comparison.json'
            & (Join-Path $rootPath 'scripts\Compare-CustomerDeliveryRelease.ps1') `
                -OldReleaseManifestPath ([string] $customerReleaseResult.release_manifest) `
                -NewReleaseManifestPath ([string] $customerReleaseResult.release_manifest) `
                -OutputPath $comparisonPath
            $comparison = Get-Content -LiteralPath $comparisonPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ([string] $comparison.status -ne 'unchanged') {
                throw "Customer delivery release self-comparison should be unchanged. Got: $($comparison.status)"
            }
            if (-not (Test-Path ([IO.Path]::ChangeExtension($comparisonPath, '.md')))) {
                throw 'Customer delivery release comparison did not create Markdown output.'
            }
            $script:customerDeliveryReleaseArtifact = [ordered]@{
                path = [string] $customerReleaseResult.delivery_package
                sha256 = [string] $customerReleaseResult.sha256
                bytes = [int64] $customerReleaseResult.bytes
                validation_report = [string] $customerReleaseResult.validation_report
                checksum_file = [string] $customerReleaseResult.checksum_file
                release_manifest = [string] $customerReleaseResult.release_manifest
                config_review = [string] $customerReleaseResult.config_review
                config_review_json = [string] $customerReleaseResult.config_review_json
                release_summary = [string] $customerReleaseResult.release_summary
                release_notes = [string] $customerReleaseResult.release_notes
                release_notes_json = [string] $customerReleaseResult.release_notes_json
                handoff_checklist = [string] $customerReleaseResult.handoff_checklist
                handoff_checklist_json = [string] $customerReleaseResult.handoff_checklist_json
                archive_index = [string] $customerReleaseResult.archive_index
                archive_index_markdown = [string] $customerReleaseResult.archive_index_markdown
                retained = $false
            }
        }
    } else {
        Add-OmittedReadinessCheck -Name 'customer_delivery_smoke_test' -Reason 'Quick mode uses Test-Template, product delivery console, customer delivery wizard, and product release package validation for day-to-day release readiness. Run -Mode Full for full customer delivery smoke packaging.'
        Add-OmittedReadinessCheck -Name 'customer_delivery_release_archive' -Reason 'Quick mode skips formal customer delivery release archive generation to keep product readiness fast. Run -Mode Full before major commercial release audits.'
    }

    Invoke-ReadinessStep -Name 'product_release_package' -Script {
        & (Join-Path $rootPath 'scripts\Package-ProductRelease.ps1') -Root $rootPath -OutputPath $releasePackage -SkipChecks
    }

    Invoke-ReadinessStep -Name 'product_release_package_validation' -Script {
        & (Join-Path $rootPath 'scripts\Test-ProductReleasePackage.ps1') -PackagePath $releasePackage -ExpectedVersion $version
    }

    $releaseItem = Get-Item -LiteralPath $releasePackage
    $releaseHash = Get-FileHash -LiteralPath $releasePackage -Algorithm SHA256
    $report.artifacts.release_package = [ordered]@{
        path = $releasePackage
        sha256 = $releaseHash.Hash.ToLowerInvariant()
        bytes = [int64] $releaseItem.Length
        retained = [bool] $retainReleasePackage
    }
    if ($null -ne $customerDeliveryReleaseArtifact) {
        $report.artifacts.customer_delivery_release = $customerDeliveryReleaseArtifact
    }

    $fingerprintPaths = @(
        'product.json',
        'config/client-config.example.json',
        'docs/PRODUCT-ARCHITECTURE-CONTRACT.md',
        'docs/CUSTOMER-RELEASE-PROCESS.md',
        'docs/CUSTOMER-ACCEPTANCE-PROCESS.md',
        'docs/CUSTOMER-ONBOARDING-PROCESS.md',
        'docs/CUSTOMER-OPERATING-PLAN.md',
        'docs/CUSTOMER-SALES-KIT.md',
        'docs/CUSTOMER-SUCCESS-REVIEW.md',
        'docs/CUSTOMER-SERVICE-SCOPE.md',
        'docs/CUSTOMER-PRODUCT-MANUAL.md',
        'docs/PRODUCT-DELIVERY-CONSOLE.md',
        'docs/CUSTOMER-DELIVERY-WIZARD.md',
        'docs/CUSTOMER-PUBLISHING-LOOP.md',
        'docs/CUSTOMER-UPGRADE-PROCESS.md',
        'scripts/New-ProductRelease.ps1',
        'scripts/New-ProductReleaseNotes.ps1',
        'scripts/Start-ProductDelivery.ps1',
        'scripts/Start-CustomerDeliveryWizard.ps1',
        'scripts/New-Customer.ps1',
        'scripts/New-CustomerConfig.ps1',
        'scripts/New-CustomerConfigReview.ps1',
        'scripts/New-CustomerDeliveryFromConfig.ps1',
        'scripts/New-CustomerDeliveryRelease.ps1',
        'scripts/New-CustomerDeliveryReleaseNotes.ps1',
        'scripts/New-CustomerHandoffChecklist.ps1',
        'scripts/Compare-CustomerDeliveryRelease.ps1',
        'scripts/Update-ProductVersion.ps1',
        'scripts/Package-CustomerDelivery.ps1',
        'scripts/Package-Website.ps1',
        'scripts/Package-ProductRelease.ps1',
        'scripts/Start-CustomerDelivery.ps1',
        'scripts/Test-CustomerConfig.ps1',
        'scripts/Test-CustomerConfigNegative.ps1',
        'scripts/Test-CustomerConfigReview.ps1',
        'scripts/Test-PackageSecrets.ps1',
        'scripts/Test-PackageSecretsNegative.ps1',
        'scripts/Test-PowerShellSyntax.ps1',
        'scripts/Test-ProductVersionUpdater.ps1',
        'scripts/Test-ProductArchitecture.ps1',
        'scripts/Test-TemplateCleanliness.ps1',
        'scripts/Test-TemplateSecrets.ps1',
        'scripts/Test-DesktopAgentPackage.ps1',
        'scripts/Test-GeoFlowServerPackage.ps1',
        'scripts/Test-GeoFlowServerDeployScript.ps1',
        'scripts/Test-WebsitePackage.ps1',
        'scripts/Test-CustomerDelivery.ps1',
        'scripts/Test-CustomerDeliveryPackage.ps1',
        'scripts/Test-CustomerDeliveryRelease.ps1',
        'scripts/Test-CustomerDeliveryReleaseNotes.ps1',
        'scripts/Test-CustomerHandoffChecklist.ps1',
        'scripts/Test-ProductDeliveryConsole.ps1',
        'scripts/Test-CustomerDeliveryWizard.ps1',
        'scripts/Test-ProductReadiness.ps1',
        'scripts/Test-ProductReleaseNotes.ps1',
        'scripts/Test-ProductReleasePackage.ps1',
        'desktop-agent/package.json',
        'desktop-agent/preflight.ps1',
        'desktop-agent/src/version.js',
        'scripts/Deploy-GeoFlowServer.ps1',
        'geoflow-integration/deployment/install-geoflow-overrides.sh',
        'geoflow-integration/deployment/verify-geoflow-overrides.sh',
        'geoflow-integration/deployment/smoke-geoflow-workbench.sh',
        'website/llms.txt'
    )
    $report.bill_of_materials = @($fingerprintPaths | ForEach-Object { Get-FileFingerprint -RelativePath $_ })

    $report.status = 'passed'
    Save-Report
} finally {
    if (-not $retainReleasePackage -and (Test-Path $releasePackage)) {
        Remove-Item -LiteralPath $releasePackage -Force
        if ($report.artifacts.release_package) {
            $report.artifacts.release_package.path = $null
            $report.artifacts.release_package.retained = $false
            Save-Report
        }
    }
    if (Test-Path $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

Write-Host "Product readiness passed. Report: $resolvedOutput"
