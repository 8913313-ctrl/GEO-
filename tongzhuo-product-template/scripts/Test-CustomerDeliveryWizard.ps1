[CmdletBinding()]
param(
    [string]$Root = '',
    [switch]$RunFull
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$expectedVersion = [string] $product.version

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-delivery-wizard-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    $wizardOutput = Join-Path $testRoot 'wizard-plan.json'
    $resultJson = & (Join-Path $rootPath 'scripts\Start-CustomerDeliveryWizard.ps1') `
        -Root $rootPath `
        -Action Plan `
        -CustomerSlug 'wizard-smoke' `
        -CompanyName 'Wizard Smoke Test Co., Ltd.' `
        -ShortName 'Wizard Smoke' `
        -SiteUrl 'https://wizard-smoke.example.com' `
        -GeoFlowBaseUrl 'https://work-wizard-smoke.example.com' `
        -OutputRoot $testRoot `
        -OutputPath $wizardOutput
    $result = $resultJson | ConvertFrom-Json

    Assert-Condition ([string] $result.status -eq 'planned') "Wizard plan result status mismatch: $($result.status)"
    Assert-Condition ([string] $result.version -eq $expectedVersion) "Wizard plan result version mismatch. Expected $expectedVersion, got $($result.version)"
    Assert-Condition (Test-Path $wizardOutput) 'Wizard plan JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($wizardOutput, '.md'))) 'Wizard plan Markdown was not created.'

    $wizard = Get-Content -LiteralPath $wizardOutput -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $wizard.wizard_type -eq 'tongzhuo_customer_delivery_wizard') "Wizard type mismatch: $($wizard.wizard_type)"
    Assert-Condition ([string] $wizard.status -eq 'planned') "Wizard status mismatch: $($wizard.status)"
    Assert-Condition ([string] $wizard.version -eq $expectedVersion) "Wizard version mismatch. Expected $expectedVersion, got $($wizard.version)"
    Assert-Condition ([string] $wizard.customer.slug -eq 'wizard-smoke') 'Wizard customer slug mismatch.'
    Assert-Condition ([string] $wizard.paths.config -like '*configs*wizard-smoke.json') 'Wizard config path should point to configs/wizard-smoke.json.'
    Assert-Condition ([string] $wizard.paths.release_manifest -like '*wizard-smoke-tongzhuo-geo-delivery*manifest.json') 'Wizard release manifest path should be planned.'
    Assert-Condition (@($wizard.delivery_artifacts).Count -ge 10) 'Wizard should include a delivery artifact catalog.'
    Assert-Condition (@($wizard.delivery_artifacts | Where-Object { [string] $_.key -eq 'delivery_package' }).Count -eq 1) 'Wizard artifacts must include the customer delivery package.'
    Assert-Condition (@($wizard.delivery_artifacts | Where-Object { [string] $_.key -eq 'first_two_stages_pilot_checklist' }).Count -eq 1) 'Wizard artifacts must include the first two stages pilot checklist.'
    Assert-Condition ([string] $wizard.paths.first_two_stages_pilot_checklist -like '*FIRST-TWO-STAGES-PILOT.md') 'Wizard paths must include first two stages pilot checklist Markdown.'
    Assert-Condition ([string] $wizard.launch_commands.verify_delivery -like '*Verify*') 'Wizard must include launch verification command.'
    Assert-Condition ([string] $wizard.acceptance_commands.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Wizard must include publishing loop acceptance command.'
    Assert-Condition ([string] $wizard.support_commands.support_bundle -like '*SupportBundle*') 'Wizard must include support bundle command.'
    Assert-Condition (@($wizard.implementation_checklist).Count -ge 7) 'Wizard should include implementation checklist.'
    Assert-Condition ([string] $wizard.sales_handoff.positioning -like '*desktop publisher agent*') 'Wizard should include sales handoff positioning.'
    Assert-Condition (@($wizard.stages).Count -ge 5) 'Wizard should include customer config, release, go-live, acceptance, and support stages.'
    Assert-Condition ([bool] $wizard.security_boundary.geoflow_api_token_empty_before_packaging) 'Wizard must declare empty API Token boundary.'
    Assert-Condition ([bool] $wizard.security_boundary.platform_credentials_stay_local) 'Wizard must declare local platform credential boundary.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($wizardOutput, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Customer Delivery Wizard*') 'Wizard Markdown is missing title.'
    Assert-Condition ($markdown -like '*Delivery Artifacts*') 'Wizard Markdown is missing delivery artifacts.'
    Assert-Condition ($markdown -like '*Launch Commands*') 'Wizard Markdown is missing launch commands.'
    Assert-Condition ($markdown -like '*Implementation Checklist*') 'Wizard Markdown is missing implementation checklist.'
    Assert-Condition ($markdown -like '*Sales Handoff*') 'Wizard Markdown is missing sales handoff.'
    Assert-Condition ($markdown -like '*Next Actions*') 'Wizard Markdown is missing next actions.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Wizard Markdown is missing security boundary.'

    $summaryJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') -Root $rootPath -Action Summary
    $summary = $summaryJson | ConvertFrom-Json
    Assert-Condition ([string] $summary.actions.customer_wizard -like '*CustomerWizard*') 'Product delivery console summary must include CustomerWizard action.'

    if ($RunFull) {
        $runRoot = Join-Path $testRoot 'run'
        $runOutput = Join-Path $runRoot 'wizard-run.json'
        $runResultJson = & (Join-Path $rootPath 'scripts\Start-CustomerDeliveryWizard.ps1') `
            -Root $rootPath `
            -Action Run `
            -CustomerSlug 'wizard-run-smoke' `
            -CompanyName 'Wizard Run Smoke Test Co., Ltd.' `
            -ShortName 'Wizard Run Smoke' `
            -SiteUrl 'https://wizard-run-smoke.example.com' `
            -GeoFlowBaseUrl 'https://work-wizard-run-smoke.example.com' `
            -OutputRoot $runRoot `
            -OutputPath $runOutput `
            -Force
        $runResult = $runResultJson | ConvertFrom-Json
        Assert-Condition ([string] $runResult.status -eq 'ready') "Wizard run result status mismatch: $($runResult.status)"
        Assert-Condition (Test-Path $runOutput) 'Wizard run JSON was not created.'
        Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($runOutput, '.md'))) 'Wizard run Markdown was not created.'
        Assert-Condition (Test-Path ([string] $runResult.delivery_package)) 'Wizard run delivery package was not created.'
        Assert-Condition (Test-Path ([string] $runResult.release_manifest)) 'Wizard run release manifest was not created.'

        $runWizard = Get-Content -LiteralPath $runOutput -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-Condition ([string] $runWizard.status -eq 'ready') "Wizard run file status mismatch: $($runWizard.status)"
        Assert-Condition (@($runWizard.delivery_artifacts | Where-Object { [string] $_.required_for_run -eq 'True' -and [string] $_.status -ne 'ready' }).Count -eq 0) 'Wizard run should mark every required delivery artifact ready.'
        Assert-Condition (Test-Path ([string] $runWizard.paths.release_notes)) 'Wizard run release notes path should exist.'
        Assert-Condition (Test-Path ([string] $runWizard.paths.config_review)) 'Wizard run config review path should exist.'
        Assert-Condition (Test-Path ([string] $runWizard.paths.archive_index_markdown)) 'Wizard run archive index Markdown path should exist.'
        Assert-Condition (Test-Path ([string] $runWizard.paths.first_two_stages_pilot_checklist)) 'Wizard run first two stages pilot checklist path should exist.'
        Assert-Condition (Test-Path ([string] $runWizard.paths.first_two_stages_pilot_checklist_json)) 'Wizard run first two stages pilot checklist JSON path should exist.'
    }
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer delivery wizard validation passed.'
