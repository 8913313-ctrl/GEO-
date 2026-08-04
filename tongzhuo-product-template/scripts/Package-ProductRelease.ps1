[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputPath = '',
    [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version
$releaseSlug = "tongzhuo-geo-growth-suite-v$version"

function Assert-LastExitCode {
    param([Parameter(Mandatory = $true)] [string]$Message)

    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    if ($null -ne $exitCodeVariable -and $null -ne $exitCodeVariable.Value -and [int] $exitCodeVariable.Value -ne 0) {
        throw "$Message with exit code $($exitCodeVariable.Value)"
    }
}

if (-not $SkipChecks) {
    & (Join-Path $rootPath 'scripts\Test-Template.ps1') -Root $rootPath
    Assert-LastExitCode -Message 'Template validation failed'

    & (Join-Path $rootPath 'scripts\Test-CustomerDelivery.ps1') -Root $rootPath
    Assert-LastExitCode -Message 'Customer delivery smoke test failed'
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $distRoot = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $distRoot "$releaseSlug-$stamp.zip"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $resolvedOutput -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-product-release-' + [guid]::NewGuid().ToString('N'))
$releaseRoot = Join-Path $stagingRoot $releaseSlug

$excludedDirectories = @(
    '.git',
    '.agents',
    '.codex',
    'node_modules',
    '.data',
    'dist',
    'logs',
    'tmp',
    'temp',
    'vendor'
)
$excludedFiles = @(
    '.env',
    'customer-manifest.json',
    '*.log',
    '*.tmp',
    '*.zip',
    'Thumbs.db',
    '.DS_Store'
)

function Test-ExcludedName {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string[]]$Patterns
    )
    foreach ($pattern in $Patterns) {
        if ($Name -like $pattern) {
            return $true
        }
    }
    return $false
}

function Assert-ReleaseClean {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $blockedNames = @('.git', '.agents', '.codex', 'node_modules', '.data', 'dist', 'logs', 'tmp', 'temp', 'vendor')
    foreach ($name in $blockedNames) {
        $matches = @(Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $name })
        if ($matches.Count -gt 0) {
            throw "Release package contains blocked directory: $name"
        }
    }

    $blockedFiles = @(Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -eq '.env' -or
        $_.Name -eq 'customer-manifest.json' -or
        $_.Name -like '*.log' -or
        $_.Name -like '*.tmp' -or
        $_.Name -like '*.zip'
    })
    if ($blockedFiles.Count -gt 0) {
        throw "Release package contains blocked file: $($blockedFiles[0].FullName)"
    }

    $configRoot = Join-Path $Path 'config'
    if (Test-Path $configRoot) {
        $unexpectedConfigs = @(Get-ChildItem -LiteralPath $configRoot -Force -File -Filter '*.json' |
            Where-Object { $_.Name -ne 'client-config.example.json' })
        if ($unexpectedConfigs.Count -gt 0) {
            throw "Release package contains customer config file: $($unexpectedConfigs[0].FullName)"
        }
    }
}

try {
    New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

    Get-ChildItem -LiteralPath $rootPath -Force | ForEach-Object {
        if ($_.PSIsContainer) {
            if ($excludedDirectories -contains $_.Name) {
                return
            }
            if ($_.Name -eq 'config') {
                $targetConfig = Join-Path $releaseRoot 'config'
                New-Item -ItemType Directory -Force -Path $targetConfig | Out-Null
                Copy-Item -LiteralPath (Join-Path $_.FullName 'client-config.example.json') -Destination (Join-Path $targetConfig 'client-config.example.json') -Force
                return
            }
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $releaseRoot $_.Name) -Recurse -Force
            return
        }

        if (Test-ExcludedName -Name $_.Name -Patterns $excludedFiles) {
            return
        }
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $releaseRoot $_.Name) -Force
    }

    foreach ($directory in $excludedDirectories) {
        Get-ChildItem -LiteralPath $releaseRoot -Recurse -Force -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $directory } |
            Remove-Item -Recurse -Force
    }
    foreach ($pattern in $excludedFiles) {
        Get-ChildItem -LiteralPath $releaseRoot -Recurse -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
            Remove-Item -Force
    }

    $releaseManifest = @{
        product = [string] $product.product
        version = $version
        release_slug = $releaseSlug
        packaged_at = (Get-Date).ToUniversalTime().ToString('o')
        components = $product.components
        entrypoints = @{
            product_delivery_console = 'scripts/Start-ProductDelivery.ps1'
            customer_delivery_wizard = 'scripts/Start-CustomerDeliveryWizard.ps1'
            formal_product_release = 'scripts/New-ProductRelease.ps1'
            generate_product_release_notes = 'scripts/New-ProductReleaseNotes.ps1'
            generate_product_first_two_stages_preview = 'scripts/New-ProductFirstTwoStagesPreview.ps1'
            generate_first_two_stages_pilot_checklist = 'scripts/New-FirstTwoStagesPilotChecklist.ps1'
            generate_ai_visibility_audit = 'scripts/New-AIVisibilityAudit.ps1'
            generate_customer_demo_script = 'scripts/New-CustomerDemoScript.ps1'
            generate_customer_proposal_brief = 'scripts/New-CustomerProposalBrief.ps1'
            generate_customer_evidence_index = 'scripts/New-CustomerEvidenceIndex.ps1'
            generate_customer_launch_readiness = 'scripts/New-CustomerLaunchReadiness.ps1'
            generate_customer_health_scorecard = 'scripts/New-CustomerHealthScorecard.ps1'
            generate_customer = 'scripts/New-Customer.ps1'
            generate_customer_config = 'scripts/New-CustomerConfig.ps1'
            generate_customer_intake_checklist = 'scripts/New-CustomerIntakeChecklist.ps1'
            generate_customer_project_dossier = 'scripts/New-CustomerProjectDossier.ps1'
            generate_customer_portfolio_index = 'scripts/New-CustomerPortfolioIndex.ps1'
            generate_customer_operations_bundle = 'scripts/Start-ProductDelivery.ps1 -Action CustomerOpsBundle'
            generate_customer_config_review = 'scripts/New-CustomerConfigReview.ps1'
            generate_customer_delivery_from_config = 'scripts/New-CustomerDeliveryFromConfig.ps1'
            generate_customer_delivery_release = 'scripts/New-CustomerDeliveryRelease.ps1'
            generate_customer_delivery_release_notes = 'scripts/New-CustomerDeliveryReleaseNotes.ps1'
            generate_customer_handoff_checklist = 'scripts/New-CustomerHandoffChecklist.ps1'
            compare_customer_delivery_release = 'scripts/Compare-CustomerDeliveryRelease.ps1'
            update_product_version = 'scripts/Update-ProductVersion.ps1'
            package_customer_delivery = 'scripts/Package-CustomerDelivery.ps1'
            package_website = 'scripts/Package-Website.ps1'
            test_ai_visibility_audit = 'scripts/Test-AIVisibilityAudit.ps1'
            test_customer_demo_script = 'scripts/Test-CustomerDemoScript.ps1'
            test_customer_proposal_brief = 'scripts/Test-CustomerProposalBrief.ps1'
            test_customer_evidence_index = 'scripts/Test-CustomerEvidenceIndex.ps1'
            test_customer_launch_readiness = 'scripts/Test-CustomerLaunchReadiness.ps1'
            test_customer_health_scorecard = 'scripts/Test-CustomerHealthScorecard.ps1'
            test_customer_config = 'scripts/Test-CustomerConfig.ps1'
            test_customer_config_negative = 'scripts/Test-CustomerConfigNegative.ps1'
            test_customer_intake_checklist = 'scripts/Test-CustomerIntakeChecklist.ps1'
            test_customer_project_dossier = 'scripts/Test-CustomerProjectDossier.ps1'
            test_customer_portfolio_index = 'scripts/Test-CustomerPortfolioIndex.ps1'
            test_customer_config_review = 'scripts/Test-CustomerConfigReview.ps1'
            test_package_secrets = 'scripts/Test-PackageSecrets.ps1'
            test_package_secrets_negative = 'scripts/Test-PackageSecretsNegative.ps1'
            test_product_first_two_stages_preview = 'scripts/Test-ProductFirstTwoStagesPreview.ps1'
            test_first_two_stages_pilot_checklist = 'scripts/Test-FirstTwoStagesPilotChecklist.ps1'
            test_powershell_syntax = 'scripts/Test-PowerShellSyntax.ps1'
            test_template_cleanliness = 'scripts/Test-TemplateCleanliness.ps1'
            test_template_secrets = 'scripts/Test-TemplateSecrets.ps1'
            test_desktop_agent_package = 'scripts/Test-DesktopAgentPackage.ps1'
            test_geoflow_server_package = 'scripts/Test-GeoFlowServerPackage.ps1'
            test_website_package = 'scripts/Test-WebsitePackage.ps1'
            test_template = 'scripts/Test-Template.ps1'
            test_product_delivery_console = 'scripts/Test-ProductDeliveryConsole.ps1'
            test_customer_delivery_wizard = 'scripts/Test-CustomerDeliveryWizard.ps1'
            test_product_release_notes = 'scripts/Test-ProductReleaseNotes.ps1'
            test_product_release_package = 'scripts/Test-ProductReleasePackage.ps1'
            test_product_readiness = 'scripts/Test-ProductReadiness.ps1'
            test_version_consistency = 'scripts/Test-VersionConsistency.ps1'
            test_product_version_updater = 'scripts/Test-ProductVersionUpdater.ps1'
            test_product_architecture = 'scripts/Test-ProductArchitecture.ps1'
            test_customer_delivery = 'scripts/Test-CustomerDelivery.ps1'
            test_customer_delivery_package = 'scripts/Test-CustomerDeliveryPackage.ps1'
            test_customer_delivery_release = 'scripts/Test-CustomerDeliveryRelease.ps1'
            test_customer_delivery_release_notes = 'scripts/Test-CustomerDeliveryReleaseNotes.ps1'
            test_customer_operations_bundle = 'scripts/Test-CustomerOperationsBundle.ps1'
            test_customer_handoff_checklist = 'scripts/Test-CustomerHandoffChecklist.ps1'
            package_product_release = 'scripts/Package-ProductRelease.ps1'
        }
        gates = @{
            template_validation = -not [bool]$SkipChecks
            customer_delivery_smoke_test = -not [bool]$SkipChecks
            excludes_runtime_artifacts = $true
            excludes_customer_data = $true
            excludes_customer_config_files = $true
            excludes_node_modules = $true
            excludes_secrets = $true
            package_secret_scan = $true
            product_architecture_contract = $true
            template_cleanliness = -not [bool]$SkipChecks
            version_consistency = -not [bool]$SkipChecks
        }
        excluded = @{
            directories = $excludedDirectories
            files = $excludedFiles + @('config/*.json except config/client-config.example.json')
        }
    }
    $releaseManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releaseRoot 'release-manifest.json') -Encoding UTF8

    Assert-ReleaseClean -Path $releaseRoot

    if (Test-Path $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }
    Compress-Archive -Path $releaseRoot -DestinationPath $resolvedOutput -Force

    & (Join-Path $rootPath 'scripts\Test-ProductReleasePackage.ps1') -PackagePath $resolvedOutput -ExpectedVersion $version
    Assert-LastExitCode -Message 'Product release package validation failed'
} finally {
    if (Test-Path $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Product release package created: $resolvedOutput"
