[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
& (Join-Path $PSScriptRoot 'Test-PackageSecrets.ps1') -PackagePath $resolvedPackage

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -gt 0) "Release package missing entry: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -eq 0) "Release package contains blocked entry: $Pattern"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedPackage)
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })

    $manifestEntry = $archive.Entries | Where-Object {
        $normalized = $_.FullName -replace '\\', '/'
        $normalized -eq 'release-manifest.json' -or $normalized -like '*/release-manifest.json'
    } | Select-Object -First 1
    Assert-Condition ($null -ne $manifestEntry) 'Release manifest not found.'

    $reader = [IO.StreamReader]::new($manifestEntry.Open())
    try {
        $manifest = $reader.ReadToEnd() | ConvertFrom-Json
    } finally {
        $reader.Dispose()
    }

    Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "Release manifest version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $manifest.release_slug)) 'Release manifest release_slug is missing.'
    Assert-Condition ([bool] $manifest.gates.excludes_runtime_artifacts) 'Release manifest must declare runtime artifact exclusion.'
    Assert-Condition ([bool] $manifest.gates.excludes_customer_data) 'Release manifest must declare customer data exclusion.'
    Assert-Condition ([bool] $manifest.gates.excludes_customer_config_files) 'Release manifest must declare customer config exclusion.'
    Assert-Condition ([bool] $manifest.gates.excludes_node_modules) 'Release manifest must declare node_modules exclusion.'
    Assert-Condition ([bool] $manifest.gates.excludes_secrets) 'Release manifest must declare secret exclusion.'
    Assert-Condition ([bool] $manifest.gates.package_secret_scan) 'Release manifest must declare package secret scanning.'
    Assert-Condition ([bool] $manifest.gates.product_architecture_contract) 'Release manifest must declare product architecture contract validation.'
    Assert-Condition ($null -ne $manifest.gates.PSObject.Properties['publisher_automation_contract']) 'Release manifest must declare publisher automation contract validation status.'
    Assert-Condition ([string] $manifest.entrypoints.product_delivery_console -eq 'scripts/Start-ProductDelivery.ps1') 'Release manifest must declare the product delivery console entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.customer_delivery_wizard -eq 'scripts/Start-CustomerDeliveryWizard.ps1') 'Release manifest must declare the customer delivery wizard entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_product_release_notes -eq 'scripts/New-ProductReleaseNotes.ps1') 'Release manifest must declare the product release notes generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_product_first_two_stages_preview -eq 'scripts/New-ProductFirstTwoStagesPreview.ps1') 'Release manifest must declare the first two stages preview generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_first_two_stages_pilot_checklist -eq 'scripts/New-FirstTwoStagesPilotChecklist.ps1') 'Release manifest must declare the first two stages pilot checklist generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_ai_visibility_audit -eq 'scripts/New-AIVisibilityAudit.ps1') 'Release manifest must declare the AI visibility audit generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_demo_script -eq 'scripts/New-CustomerDemoScript.ps1') 'Release manifest must declare the customer demo script generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_proposal_brief -eq 'scripts/New-CustomerProposalBrief.ps1') 'Release manifest must declare the customer proposal brief generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_evidence_index -eq 'scripts/New-CustomerEvidenceIndex.ps1') 'Release manifest must declare the customer evidence index generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_launch_readiness -eq 'scripts/New-CustomerLaunchReadiness.ps1') 'Release manifest must declare the customer launch readiness generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_health_scorecard -eq 'scripts/New-CustomerHealthScorecard.ps1') 'Release manifest must declare the customer health scorecard generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_config -eq 'scripts/New-CustomerConfig.ps1') 'Release manifest must declare the customer config generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_intake_checklist -eq 'scripts/New-CustomerIntakeChecklist.ps1') 'Release manifest must declare the customer intake checklist generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_project_dossier -eq 'scripts/New-CustomerProjectDossier.ps1') 'Release manifest must declare the customer project dossier generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_portfolio_index -eq 'scripts/New-CustomerPortfolioIndex.ps1') 'Release manifest must declare the customer portfolio index generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.generate_customer_handoff_checklist -eq 'scripts/New-CustomerHandoffChecklist.ps1') 'Release manifest must declare the customer handoff checklist generator entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.update_product_version -eq 'scripts/Update-ProductVersion.ps1') 'Release manifest must declare the product version updater entrypoint.'
    Assert-Condition ([string] $manifest.entrypoints.test_package_secrets -eq 'scripts/Test-PackageSecrets.ps1') 'Release manifest must declare the package secret scanner.'
    Assert-Condition ([string] $manifest.entrypoints.test_package_secrets_negative -eq 'scripts/Test-PackageSecretsNegative.ps1') 'Release manifest must declare the package secret negative test.'
    Assert-Condition ([string] $manifest.entrypoints.test_template_cleanliness -eq 'scripts/Test-TemplateCleanliness.ps1') 'Release manifest must declare the template cleanliness gate.'
    Assert-Condition ([string] $manifest.entrypoints.test_product_release_notes -eq 'scripts/Test-ProductReleaseNotes.ps1') 'Release manifest must declare the product release notes test.'
    Assert-Condition ([string] $manifest.entrypoints.test_product_first_two_stages_preview -eq 'scripts/Test-ProductFirstTwoStagesPreview.ps1') 'Release manifest must declare the first two stages preview test.'
    Assert-Condition ([string] $manifest.entrypoints.test_first_two_stages_pilot_checklist -eq 'scripts/Test-FirstTwoStagesPilotChecklist.ps1') 'Release manifest must declare the first two stages pilot checklist test.'
    Assert-Condition ([string] $manifest.entrypoints.test_product_version_updater -eq 'scripts/Test-ProductVersionUpdater.ps1') 'Release manifest must declare the product version updater test.'
    Assert-Condition ([string] $manifest.entrypoints.test_product_architecture -eq 'scripts/Test-ProductArchitecture.ps1') 'Release manifest must declare the product architecture contract test.'
    Assert-Condition ([string] $manifest.entrypoints.test_publisher_automation_contract -eq 'geoflow-integration/deployment/check-publisher-automation-contract.ps1') 'Release manifest must declare the publisher automation contract test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_handoff_checklist -eq 'scripts/Test-CustomerHandoffChecklist.ps1') 'Release manifest must declare the customer handoff checklist test.'
    Assert-Condition ([string] $manifest.entrypoints.test_product_delivery_console -eq 'scripts/Test-ProductDeliveryConsole.ps1') 'Release manifest must declare the product delivery console test.'
    Assert-Condition ([string] $manifest.entrypoints.test_ai_visibility_audit -eq 'scripts/Test-AIVisibilityAudit.ps1') 'Release manifest must declare the AI visibility audit test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_demo_script -eq 'scripts/Test-CustomerDemoScript.ps1') 'Release manifest must declare the customer demo script test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_proposal_brief -eq 'scripts/Test-CustomerProposalBrief.ps1') 'Release manifest must declare the customer proposal brief test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_evidence_index -eq 'scripts/Test-CustomerEvidenceIndex.ps1') 'Release manifest must declare the customer evidence index test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_launch_readiness -eq 'scripts/Test-CustomerLaunchReadiness.ps1') 'Release manifest must declare the customer launch readiness test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_health_scorecard -eq 'scripts/Test-CustomerHealthScorecard.ps1') 'Release manifest must declare the customer health scorecard test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_intake_checklist -eq 'scripts/Test-CustomerIntakeChecklist.ps1') 'Release manifest must declare the customer intake checklist test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_project_dossier -eq 'scripts/Test-CustomerProjectDossier.ps1') 'Release manifest must declare the customer project dossier test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_portfolio_index -eq 'scripts/Test-CustomerPortfolioIndex.ps1') 'Release manifest must declare the customer portfolio index test.'
    Assert-Condition ([string] $manifest.entrypoints.test_customer_delivery_wizard -eq 'scripts/Test-CustomerDeliveryWizard.ps1') 'Release manifest must declare the customer delivery wizard test.'

    foreach ($pattern in @(
        '*/product.json',
        '*/CHANGELOG.md',
        '*/README.md',
        '*/release-manifest.json',
        '*/config/client-config.example.json',
        '*/docs/AI-VISIBILITY-AUDIT.md',
        '*/docs/PRODUCT-ARCHITECTURE-CONTRACT.md',
        '*/docs/CUSTOMER-DEMO-SCRIPT.md',
        '*/docs/CUSTOMER-EVIDENCE-INDEX.md',
        '*/docs/CUSTOMER-LAUNCH-READINESS.md',
        '*/docs/CUSTOMER-HEALTH-SCORECARD.md',
        '*/docs/CUSTOMER-PROPOSAL-BRIEF.md',
        '*/docs/PRODUCT-FIRST-TWO-STAGES.md',
        '*/docs/PRODUCT-DELIVERY-CONSOLE.md',
        '*/docs/CUSTOMER-INTAKE-CHECKLIST.md',
        '*/docs/CUSTOMER-PROJECT-DOSSIER.md',
        '*/docs/CUSTOMER-PORTFOLIO-INDEX.md',
        '*/docs/CUSTOMER-DELIVERY-WIZARD.md',
        '*/docs/RELEASE-PROCESS.md',
        '*/docs/CUSTOMER-RELEASE-PROCESS.md',
        '*/docs/CUSTOMER-ACCEPTANCE-PROCESS.md',
        '*/docs/CUSTOMER-ONBOARDING-PROCESS.md',
        '*/docs/CUSTOMER-OPERATING-PLAN.md',
        '*/docs/CUSTOMER-SALES-KIT.md',
        '*/docs/CUSTOMER-SUCCESS-REVIEW.md',
        '*/docs/CUSTOMER-SERVICE-SCOPE.md',
        '*/docs/CUSTOMER-PRODUCT-MANUAL.md',
        '*/docs/CUSTOMER-PUBLISHING-LOOP.md',
        '*/docs/CUSTOMER-UPGRADE-PROCESS.md',
        '*/docs/DELIVERY-CHECKLIST.md',
        '*/docs/OPERATIONS-RUNBOOK.md',
        '*/scripts/New-Customer.ps1',
        '*/scripts/Start-ProductDelivery.ps1',
        '*/scripts/Start-CustomerDeliveryWizard.ps1',
        '*/scripts/New-ProductFirstTwoStagesPreview.ps1',
        '*/scripts/New-FirstTwoStagesPilotChecklist.ps1',
        '*/scripts/New-AIVisibilityAudit.ps1',
        '*/scripts/New-CustomerDemoScript.ps1',
        '*/scripts/New-CustomerEvidenceIndex.ps1',
        '*/scripts/New-CustomerLaunchReadiness.ps1',
        '*/scripts/New-CustomerHealthScorecard.ps1',
        '*/scripts/New-CustomerProposalBrief.ps1',
        '*/scripts/New-CustomerConfig.ps1',
        '*/scripts/New-CustomerIntakeChecklist.ps1',
        '*/scripts/New-CustomerProjectDossier.ps1',
        '*/scripts/New-CustomerPortfolioIndex.ps1',
        '*/scripts/New-ProductRelease.ps1',
        '*/scripts/New-ProductReleaseNotes.ps1',
        '*/scripts/New-CustomerDeliveryFromConfig.ps1',
        '*/scripts/New-CustomerDeliveryRelease.ps1',
        '*/scripts/New-CustomerHandoffChecklist.ps1',
        '*/scripts/Compare-CustomerDeliveryRelease.ps1',
        '*/scripts/Update-ProductVersion.ps1',
        '*/scripts/Package-CustomerDelivery.ps1',
        '*/scripts/Package-Website.ps1',
        '*/scripts/Package-ProductRelease.ps1',
        '*/scripts/Test-AIVisibilityAudit.ps1',
        '*/scripts/Test-CustomerDemoScript.ps1',
        '*/scripts/Test-CustomerEvidenceIndex.ps1',
        '*/scripts/Test-CustomerLaunchReadiness.ps1',
        '*/scripts/Test-CustomerHealthScorecard.ps1',
        '*/scripts/Test-CustomerProposalBrief.ps1',
        '*/scripts/Test-CustomerConfig.ps1',
        '*/scripts/Test-CustomerIntakeChecklist.ps1',
        '*/scripts/Test-CustomerProjectDossier.ps1',
        '*/scripts/Test-CustomerPortfolioIndex.ps1',
        '*/scripts/Test-CustomerConfigNegative.ps1',
        '*/scripts/Test-PackageSecrets.ps1',
        '*/scripts/Test-PackageSecretsNegative.ps1',
        '*/scripts/Test-PowerShellSyntax.ps1',
        '*/scripts/Test-ProductFirstTwoStagesPreview.ps1',
        '*/scripts/Test-ProductArchitecture.ps1',
        '*/scripts/Test-FirstTwoStagesPilotChecklist.ps1',
        '*/scripts/Test-TemplateCleanliness.ps1',
        '*/scripts/Test-TemplateSecrets.ps1',
        '*/scripts/Test-DesktopAgentPackage.ps1',
        '*/scripts/Test-GeoFlowServerPackage.ps1',
        '*/scripts/Test-WebsitePackage.ps1',
        '*/scripts/Test-ProductReleasePackage.ps1',
        '*/scripts/Test-ProductDeliveryConsole.ps1',
        '*/scripts/Test-CustomerDeliveryWizard.ps1',
        '*/scripts/Test-ProductReadiness.ps1',
        '*/scripts/Test-ProductReleaseNotes.ps1',
        '*/scripts/Test-Template.ps1',
        '*/scripts/Test-VersionConsistency.ps1',
        '*/scripts/Test-ProductVersionUpdater.ps1',
        '*/scripts/Test-CustomerDelivery.ps1',
        '*/scripts/Test-CustomerDeliveryPackage.ps1',
        '*/scripts/Test-CustomerDeliveryRelease.ps1',
        '*/scripts/Test-CustomerHandoffChecklist.ps1',
        '*/desktop-agent/package.json',
        '*/desktop-agent/preflight.ps1',
        '*/desktop-agent/src/version.js',
        '*/geoflow-integration/deployment/install-geoflow-overrides.sh',
        '*/geoflow-integration/deployment/check-publisher-automation-contract.ps1',
        '*/website/llms.txt'
    )) {
        Assert-ZipHas -Entries $entries -Pattern $pattern
    }

    $configEntries = @($entries | Where-Object { $_ -like '*/config/*.json' })
    Assert-Condition ($configEntries.Count -eq 1) "Release package must contain exactly one config JSON file. Got $($configEntries.Count)."
    Assert-Condition ($configEntries[0] -like '*/config/client-config.example.json') "Release package contains unexpected config JSON: $($configEntries[0])"

    foreach ($pattern in @(
        '*/.codex-staging/*',
        '*/node_modules/*',
        '*/.data/*',
        '*/dist/*',
        '*/logs/*',
        '*/tmp/*',
        '*/temp/*',
        '*/vendor/*',
        '*/.env',
        '*/customer-manifest.json',
        '*/.tmp-*',
        '*.log',
        '*.tmp',
        '*.zip'
    )) {
        Assert-ZipLacks -Entries $entries -Pattern $pattern
    }
} finally {
    $archive.Dispose()
}

Write-Host "Product release package validation passed: $resolvedPackage"
