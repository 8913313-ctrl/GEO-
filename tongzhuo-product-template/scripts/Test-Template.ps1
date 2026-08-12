[CmdletBinding()]
param(
    [string]$Root = '',
    [int]$PublisherPort = 18180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$PowerShellExecutable = (Get-Process -Id $PID -ErrorAction Stop).Path
if ([string]::IsNullOrWhiteSpace($PowerShellExecutable) -or -not (Test-Path -LiteralPath $PowerShellExecutable)) {
    throw 'Unable to resolve the current PowerShell executable.'
}

function Invoke-CheckedNpmScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ScriptName
    )

    $temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tongzhuo-template-npm-$([guid]::NewGuid().ToString('N'))"
    $temporaryComponent = Join-Path $temporaryRoot (Split-Path -Leaf $Path)
    New-Item -ItemType Directory -Path $temporaryComponent -Force | Out-Null
    try {
        Copy-Item -LiteralPath (Join-Path $Root 'product.json') -Destination $temporaryRoot -Force
        foreach ($item in Get-ChildItem -LiteralPath $Path -Force) {
            if ($item.Name -in @('node_modules', '.data', 'release', 'dist')) {
                continue
            }
            Copy-Item -LiteralPath $item.FullName -Destination $temporaryComponent -Recurse -Force
        }

        Push-Location $temporaryComponent
        npm.cmd ci --ignore-scripts --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed in temporary copy of $Path with exit code $LASTEXITCODE"
        }
        npm.cmd run $ScriptName
        if ($LASTEXITCODE -ne 0) {
            throw "npm run $ScriptName failed in $Path with exit code $LASTEXITCODE"
        }
    } finally {
        if ((Get-Location).Path -eq $temporaryComponent) {
            Pop-Location
        }
        if (Test-Path -LiteralPath $temporaryRoot) {
            Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
        }
    }
}

$checks = @()

foreach ($path in @('product.json', 'CHANGELOG.md', 'config/client-config.example.json', 'docs/PRODUCT-ARCHITECTURE-CONTRACT.md', 'docs/AI-VISIBILITY-AUDIT.md', 'docs/CUSTOMER-DEMO-SCRIPT.md', 'docs/CUSTOMER-EVIDENCE-INDEX.md', 'docs/CUSTOMER-LAUNCH-READINESS.md', 'docs/CUSTOMER-HEALTH-SCORECARD.md', 'docs/CUSTOMER-PROPOSAL-BRIEF.md', 'docs/PRODUCT-FIRST-TWO-STAGES.md', 'docs/PRODUCT-BLUEPRINT.md', 'docs/GEO-PRODUCT-BLUEPRINT.md', 'docs/GEO-PRODUCT-BLUEPRINT-ANCHORS.md', 'docs/BACKOFFICE-MENU-CONTRACT.md', 'docs/BACKOFFICE-MENU-ANCHORS.md', 'docs/PUBLISHER-DEVICE-PROTOCOL.md', 'docs/PRODUCT-DELIVERY-CONSOLE.md', 'docs/CUSTOMER-INTAKE-CHECKLIST.md', 'docs/CUSTOMER-PROJECT-DOSSIER.md', 'docs/CUSTOMER-PORTFOLIO-INDEX.md', 'docs/CUSTOMER-DELIVERY-WIZARD.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/SERVER-DEPLOYMENT.md', 'docs/OPERATIONS-RUNBOOK.md', 'docs/RELEASE-PROCESS.md', 'docs/CUSTOMER-RELEASE-PROCESS.md', 'docs/CUSTOMER-ACCEPTANCE-PROCESS.md', 'docs/CUSTOMER-ONBOARDING-PROCESS.md', 'docs/CUSTOMER-OPERATING-PLAN.md', 'docs/CUSTOMER-SALES-KIT.md', 'docs/CUSTOMER-SUCCESS-REVIEW.md', 'docs/CUSTOMER-SERVICE-SCOPE.md', 'docs/CUSTOMER-PRODUCT-MANUAL.md', 'docs/CUSTOMER-OPERATOR-QUICKSTART.md', 'docs/CUSTOMER-GO-LIVE-CHECKLIST.md', 'docs/CUSTOMER-PUBLISHING-LOOP.md', 'docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md', 'docs/CUSTOMER-UPGRADE-PROCESS.md', 'scripts/Read-ProductMetadata.ps1', 'scripts/Start-ProductDelivery.ps1', 'scripts/Start-CustomerDeliveryWizard.ps1', 'scripts/Start-CustomerDelivery.ps1', 'scripts/New-ProductRelease.ps1', 'scripts/New-ProductReleaseNotes.ps1', 'scripts/New-ProductFirstTwoStagesPreview.ps1', 'scripts/New-FirstTwoStagesPilotChecklist.ps1', 'scripts/New-AIVisibilityAudit.ps1', 'scripts/New-CustomerDemoScript.ps1', 'scripts/New-CustomerProposalBrief.ps1', 'scripts/New-CustomerEvidenceIndex.ps1', 'scripts/New-CustomerLaunchReadiness.ps1', 'scripts/New-CustomerHealthScorecard.ps1', 'scripts/New-CustomerConfig.ps1', 'scripts/New-CustomerIntakeChecklist.ps1', 'scripts/New-CustomerProjectDossier.ps1', 'scripts/New-CustomerPortfolioIndex.ps1', 'scripts/New-CustomerConfigReview.ps1', 'scripts/New-CustomerDeliveryFromConfig.ps1', 'scripts/New-CustomerDeliveryRelease.ps1', 'scripts/New-CustomerDeliveryReleaseNotes.ps1', 'scripts/New-CustomerHandoffChecklist.ps1', 'scripts/Compare-CustomerDeliveryRelease.ps1', 'scripts/Update-ProductVersion.ps1', 'scripts/Sync-WebsiteAssets.ps1', 'scripts/Package-DesktopAgent.ps1', 'scripts/Package-GeoFlowServer.ps1', 'scripts/Package-Website.ps1', 'scripts/Package-CustomerDelivery.ps1', 'scripts/Package-ProductRelease.ps1', 'scripts/Test-ProductArchitecture.ps1', 'scripts/Test-AIVisibilityAudit.ps1', 'scripts/Test-CustomerDemoScript.ps1', 'scripts/Test-CustomerProposalBrief.ps1', 'scripts/Test-CustomerEvidenceIndex.ps1', 'scripts/Test-CustomerLaunchReadiness.ps1', 'scripts/Test-ProductFirstTwoStagesPreview.ps1', 'scripts/Test-FirstTwoStagesPilotChecklist.ps1', 'scripts/Test-CustomerConfig.ps1', 'scripts/Test-CustomerConfigNegative.ps1', 'scripts/Test-CustomerIntakeChecklist.ps1', 'scripts/Test-CustomerProjectDossier.ps1', 'scripts/Test-CustomerPortfolioIndex.ps1', 'scripts/Test-CustomerConfigReview.ps1', 'scripts/Test-CustomerDeliveryWizard.ps1', 'scripts/Test-CustomerHandoffChecklist.ps1', 'scripts/Test-PowerShellSyntax.ps1', 'scripts/Test-PackageSecrets.ps1', 'scripts/Test-PackageSecretsNegative.ps1', 'scripts/Test-TemplateCleanliness.ps1', 'scripts/Test-TemplateSecrets.ps1', 'scripts/Test-DesktopAgentPackage.ps1', 'scripts/Test-GeoFlowServerPackage.ps1', 'scripts/Test-WebsitePackage.ps1', 'scripts/Test-CustomerDeliveryPackage.ps1', 'scripts/Test-CustomerDeliveryRelease.ps1', 'scripts/Test-CustomerDeliveryReleaseNotes.ps1', 'scripts/Test-ProductDeliveryConsole.ps1', 'scripts/Test-ProductReleasePackage.ps1', 'scripts/Test-ProductReadiness.ps1', 'scripts/Test-ProductReleaseNotes.ps1', 'scripts/Test-VersionConsistency.ps1', 'scripts/Test-ProductVersionUpdater.ps1', 'scripts/Test-PackageManifest.ps1', 'scripts/Test-ServerOverrides.ps1', 'scripts/Test-CustomerDelivery.ps1', 'scripts/Test-PublisherDeviceProtocol.ps1', 'website/index.html', 'website/robots.txt', 'website/llms.txt', 'website/assets/styles.css', 'website/assets/wukong-overrides.css', 'website/assets/site.js', 'website/assets/logo-mark-blue.png', 'website/assets/logo-zhuojian-blue.png', 'website/assets/short-video-production.jpg', 'geoflow-integration/deployment/install-geoflow-overrides.sh', 'geoflow-integration/deployment/verify-geoflow-overrides.sh', 'geoflow-integration/routes/tongzhuo.php', 'geoflow-integration/server-overrides/public/assets/styles.css', 'geoflow-integration/server-overrides/public/assets/wukong-overrides.css', 'geoflow-integration/server-overrides/public/assets/site.js', 'geoflow-integration/server-overrides/public/assets/logo-mark-blue.png', 'geoflow-integration/server-overrides/public/assets/logo-zhuojian-blue.png', 'geoflow-integration/server-overrides/public/assets/short-video-production.jpg', 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/PublisherAssistantController.php', 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/PublisherDeviceController.php', 'geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php', 'geoflow-integration/server-overrides/app/Models/PublisherDevice.php', 'geoflow-integration/server-overrides/resources/views/admin/publisher-assistant.blade.php', 'geoflow-integration/server-overrides/resources/views/admin/publisher-devices/index.blade.php', 'publisher-assistant/src/server.js', 'publisher-assistant/install.ps1', 'publisher-assistant/keepalive-site.cmd', 'desktop-agent/install.ps1', 'desktop-agent/install-desktop.ps1', 'desktop-agent/uninstall-desktop.ps1', 'desktop-agent/run-agent.ps1', 'desktop-agent/preflight.ps1', 'desktop-agent/install-autostart.ps1', 'desktop-agent/uninstall-autostart.ps1', 'desktop-agent/start.cmd', 'desktop-agent/start-background.cmd', 'desktop-agent/public/index.html', 'desktop-agent/public/styles.css', 'desktop-agent/public/app.js', 'desktop-agent/src/main.js', 'desktop-agent/src/platforms.js', 'desktop-agent/src/platform-result.js', 'desktop-agent/src/job-state-machine.js', 'desktop-agent/src/version.js', 'desktop-agent/src/diagnostics.js', 'desktop-agent/src/export-bundle.js', 'desktop-agent/src/article-payload.js', 'desktop-agent/src/log-buffer.js', 'desktop-agent/src/adapters/index.js', 'desktop-agent/src/fill-tools.js', 'desktop-agent/src/adapters/zhihu-adapter.js', 'desktop-agent/src/adapters/wechat-mp-adapter.js', 'desktop-agent/src/adapters/toutiao-adapter.js', 'desktop-agent/scripts/check-adapters.mjs', 'desktop-agent/scripts/check-article-payload.mjs', 'desktop-agent/scripts/check-config-store.mjs', 'desktop-agent/scripts/check-log-buffer.mjs', 'desktop-agent/scripts/check-platform-catalog.mjs', 'desktop-agent/scripts/check-export-bundle.mjs', 'desktop-agent/scripts/check-agent-result.mjs', 'desktop-agent/scripts/check-job-state-machine.mjs', 'desktop-agent/scripts/check-diagnostics.mjs', 'desktop-agent/scripts/check-version.mjs', 'desktop-agent/package.json', 'desktop-agent/package-lock.json')) {
    $fullPath = Join-Path $Root $path
    $checks += [pscustomobject]@{ path = $path; exists = Test-Path $fullPath }
}

$publisher = Join-Path $Root 'publisher-assistant'
$checks += [pscustomobject]@{ path = 'publisher-assistant/node_modules'; exists = -not (Test-Path (Join-Path $publisher 'node_modules')); expected = 'excluded from product template' }
$checks += [pscustomobject]@{ path = 'publisher-assistant/.data'; exists = -not (Test-Path (Join-Path $publisher '.data')); expected = 'excluded from product template' }
$desktopAgent = Join-Path $Root 'desktop-agent'
$checks += [pscustomobject]@{ path = 'desktop-agent/node_modules'; exists = -not (Test-Path (Join-Path $desktopAgent 'node_modules')); expected = 'excluded from product template' }
$checks += [pscustomobject]@{ path = 'desktop-agent/.data'; exists = -not (Test-Path (Join-Path $desktopAgent '.data')); expected = 'excluded from product template' }
$checks += [pscustomobject]@{ path = 'scripts/Test-CustomerOperationsBundle.ps1'; exists = Test-Path (Join-Path $Root 'scripts\Test-CustomerOperationsBundle.ps1') }
$checks += [pscustomobject]@{ path = 'scripts/Test-CustomerDeliveryOperationsBundle.ps1'; exists = Test-Path (Join-Path $Root 'scripts\Test-CustomerDeliveryOperationsBundle.ps1') }
$configRoot = Join-Path $Root 'config'
$extraConfigFiles = @(Get-ChildItem -LiteralPath $configRoot -Force -File -Filter '*.json' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'client-config.example.json' })
$checks += [pscustomobject]@{ path = 'config/*.json'; exists = ($extraConfigFiles.Count -eq 0); expected = 'only client-config.example.json is allowed in product template' }

$missing = @($checks | Where-Object { -not $_.exists })
if ($missing.Count -gt 0) {
    $missing | Format-Table -AutoSize
    throw "Template validation failed: $($missing.Count) check(s)"
}

Invoke-CheckedNpmScript -Path $publisher -ScriptName 'check'
Invoke-CheckedNpmScript -Path $desktopAgent -ScriptName 'check'

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-PowerShellSyntax.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "PowerShell syntax validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-TemplateSecrets.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Template secret scan failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-PackageSecretsNegative.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Package secret negative validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-TemplateCleanliness.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Template cleanliness validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-VersionConsistency.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Version consistency validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ProductVersionUpdater.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Product version updater validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ProductArchitecture.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Product architecture validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ProductReleaseNotes.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Product release notes validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ProductFirstTwoStagesPreview.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Product first two stages preview validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-FirstTwoStagesPilotChecklist.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "First two stages pilot checklist validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-AIVisibilityAudit.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "AI visibility audit validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerDemoScript.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer demo script validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerProposalBrief.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer proposal brief validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerEvidenceIndex.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer evidence index validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerLaunchReadiness.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer launch readiness validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerHealthScorecard.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer health scorecard validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerDeliveryReleaseNotes.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer delivery release notes validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerConfigReview.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer config review validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerHandoffChecklist.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer handoff checklist validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ProductDeliveryConsole.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Product delivery console validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerOperationsBundle.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer operations bundle validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerDeliveryOperationsBundle.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer delivery operations bundle validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerIntakeChecklist.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer intake checklist validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerProjectDossier.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer project dossier validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerPortfolioIndex.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer portfolio index validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerDeliveryWizard.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer delivery wizard validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-CustomerConfigNegative.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Customer config negative validation failed with exit code $LASTEXITCODE"
}

& $PowerShellExecutable -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\Test-ServerOverrides.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    throw "Server override validation failed with exit code $LASTEXITCODE"
}

Write-Host 'Template validation passed.'

