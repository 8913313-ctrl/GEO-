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

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-product-delivery-console-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    $summaryJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') -Root $rootPath -Action Summary
    $summary = $summaryJson | ConvertFrom-Json
    Assert-Condition ([string] $summary.version -eq $expectedVersion) "Console summary version mismatch. Expected $expectedVersion, got $($summary.version)"
    Assert-Condition ([string] $summary.actions.plan -like '*Start-ProductDelivery.ps1 -Action Plan*') 'Console summary is missing Plan action.'
    Assert-Condition ([string] $summary.actions.product_blueprint -like '*ProductBlueprint*') 'Console summary is missing ProductBlueprint action.'
    Assert-Condition ([string] $summary.actions.backoffice_map -like '*BackofficeMap*') 'Console summary is missing BackofficeMap action.'
    Assert-Condition ([string] $summary.actions.first_two_stages -like '*FirstTwoStages*') 'Console summary is missing FirstTwoStages action.'
    Assert-Condition ([string] $summary.actions.first_two_stages_pilot -like '*FirstTwoStagesPilot*') 'Console summary is missing FirstTwoStagesPilot action.'
    Assert-Condition ([string] $summary.actions.ai_visibility -like '*AIVisibility*') 'Console summary is missing AIVisibility action.'
    Assert-Condition ([string] $summary.actions.customer_demo -like '*CustomerDemo*') 'Console summary is missing CustomerDemo action.'
    Assert-Condition ([string] $summary.actions.customer_proposal -like '*CustomerProposal*') 'Console summary is missing CustomerProposal action.'
    Assert-Condition ([string] $summary.actions.customer_evidence -like '*CustomerEvidence*') 'Console summary is missing CustomerEvidence action.'
    Assert-Condition ([string] $summary.actions.customer_launch_readiness -like '*CustomerLaunchReadiness*') 'Console summary is missing CustomerLaunchReadiness action.'
    Assert-Condition ([string] $summary.actions.customer_health -like '*CustomerHealth*') 'Console summary is missing CustomerHealth action.'
    Assert-Condition ([string] $summary.actions.customer_intake -like '*CustomerIntake*') 'Console summary is missing CustomerIntake action.'
    Assert-Condition ([string] $summary.actions.customer_dossier -like '*CustomerDossier*') 'Console summary is missing CustomerDossier action.'
    Assert-Condition ([string] $summary.actions.customer_portfolio -like '*CustomerPortfolio*') 'Console summary is missing CustomerPortfolio action.'
    Assert-Condition ([string] $summary.actions.customer_operations_bundle -like '*CustomerOpsBundle*') 'Console summary is missing CustomerOpsBundle action.'
    Assert-Condition ([string] $summary.actions.customer_wizard -like '*CustomerWizard*') 'Console summary is missing CustomerWizard action.'
    Assert-Condition ([bool] $summary.security_boundary.platform_credentials_stay_local) 'Console summary must declare local platform credential boundary.'

    $planPath = Join-Path $testRoot 'delivery-console-plan.json'
    $planResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') -Root $rootPath -Action Plan -OutputPath $planPath
    $planResult = $planResultJson | ConvertFrom-Json
    Assert-Condition ([string] $planResult.status -eq 'created') "Console plan result mismatch: $($planResult.status)"
    Assert-Condition (Test-Path $planPath) 'Console plan JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($planPath, '.md'))) 'Console plan Markdown was not created.'

    $plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $plan.plan_type -eq 'tongzhuo_product_delivery_console_plan') "Console plan type mismatch: $($plan.plan_type)"
    Assert-Condition ([string] $plan.version -eq $expectedVersion) "Console plan version mismatch. Expected $expectedVersion, got $($plan.version)"
    Assert-Condition (@($plan.stages).Count -ge 8) 'Console plan must include the standard delivery stages.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'preview_first_two_stages' }).Count -eq 1) 'Console plan must include first two stages preview stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'prepare_first_two_stages_pilot' }).Count -eq 1) 'Console plan must include first two stages pilot stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'prepare_customer_demo' }).Count -eq 1) 'Console plan must include customer demo stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'prepare_customer_proposal' }).Count -eq 1) 'Console plan must include customer proposal stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'build_customer_evidence_index' }).Count -eq 1) 'Console plan must include customer evidence stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'run_customer_launch_readiness' }).Count -eq 1) 'Console plan must include customer launch readiness stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'review_customer_health' }).Count -eq 1) 'Console plan must include customer health stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'customer_intake' }).Count -eq 1) 'Console plan must include customer intake stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'run_ai_visibility_audit' }).Count -eq 1) 'Console plan must include AI visibility audit stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'build_customer_project_dossier' }).Count -eq 1) 'Console plan must include customer project dossier stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'build_customer_portfolio_index' }).Count -eq 1) 'Console plan must include customer portfolio index stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'package_customer_operations_bundle' }).Count -eq 1) 'Console plan must include customer operations bundle stage.'
    Assert-Condition (@($plan.stages | Where-Object { [string] $_.stage -eq 'run_customer_delivery_wizard' }).Count -eq 1) 'Console plan must include customer delivery wizard stage.'
    Assert-Condition ([string] $plan.customer_package_commands.go_live_checklist -like '*GoLiveChecklist*') 'Console plan must include GoLiveChecklist command.'
    Assert-Condition ([bool] $plan.security_boundary.platform_credentials_stay_local) 'Console plan must declare local platform credential boundary.'

    $planMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($planPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($planMarkdown -like '*Product Delivery Console Plan*') 'Console plan Markdown is missing title.'
    Assert-Condition ($planMarkdown -like '*preview_first_two_stages*') 'Console plan Markdown is missing first two stages preview stage.'
    Assert-Condition ($planMarkdown -like '*prepare_first_two_stages_pilot*') 'Console plan Markdown is missing first two stages pilot stage.'
    Assert-Condition ($planMarkdown -like '*prepare_customer_demo*') 'Console plan Markdown is missing customer demo stage.'
    Assert-Condition ($planMarkdown -like '*prepare_customer_proposal*') 'Console plan Markdown is missing customer proposal stage.'
    Assert-Condition ($planMarkdown -like '*build_customer_evidence_index*') 'Console plan Markdown is missing customer evidence stage.'
    Assert-Condition ($planMarkdown -like '*run_customer_launch_readiness*') 'Console plan Markdown is missing customer launch readiness stage.'
    Assert-Condition ($planMarkdown -like '*review_customer_health*') 'Console plan Markdown is missing customer health stage.'
    Assert-Condition ($planMarkdown -like '*run_ai_visibility_audit*') 'Console plan Markdown is missing AI visibility audit stage.'
    Assert-Condition ($planMarkdown -like '*customer_intake*') 'Console plan Markdown is missing customer intake stage.'
    Assert-Condition ($planMarkdown -like '*package_customer_operations_bundle*') 'Console plan Markdown is missing customer operations bundle stage.'
    Assert-Condition ($planMarkdown -like '*Customer Package Commands*') 'Console plan Markdown is missing customer package commands.'
    Assert-Condition ($planMarkdown -like '*Security Boundary*') 'Console plan Markdown is missing security boundary.'

    $blueprintPath = Join-Path $testRoot 'console-product-blueprint.json'
    $blueprintResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action ProductBlueprint `
        -OutputPath $blueprintPath
    $blueprintResult = $blueprintResultJson | ConvertFrom-Json
    Assert-Condition ([string] $blueprintResult.status -eq 'created') "Console product blueprint result mismatch: $($blueprintResult.status)"
    Assert-Condition (Test-Path $blueprintPath) 'Console product blueprint JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($blueprintPath, '.md'))) 'Console product blueprint Markdown was not created.'
    $blueprint = Get-Content -LiteralPath $blueprintPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $blueprint.blueprint_type -eq 'tongzhuo_product_blueprint') 'Console product blueprint type mismatch.'
    Assert-Condition (@($blueprint.module_registry).Count -ge 6) 'Console product blueprint must include module registry entries.'
    Assert-Condition (@($blueprint.data_contracts).Count -ge 4) 'Console product blueprint must include data contracts.'
    Assert-Condition (@($blueprint.product_phases).Count -eq 4) 'Console product blueprint must include four product phases.'

    $backofficePath = Join-Path $testRoot 'console-backoffice-map.json'
    $backofficeResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action BackofficeMap `
        -OutputPath $backofficePath
    $backofficeResult = $backofficeResultJson | ConvertFrom-Json
    Assert-Condition ([string] $backofficeResult.status -eq 'created') "Console backoffice map result mismatch: $($backofficeResult.status)"
    Assert-Condition (Test-Path $backofficePath) 'Console backoffice map JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($backofficePath, '.md'))) 'Console backoffice map Markdown was not created.'
    $backoffice = Get-Content -LiteralPath $backofficePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $backoffice.map_type -eq 'tongzhuo_backoffice_menu_contract') 'Console backoffice map type mismatch.'
    Assert-Condition (@($backoffice.menu_groups).Count -eq 7) 'Console backoffice map must include seven menu groups.'
    Assert-Condition (@($backoffice.workflow).Count -eq 7) 'Console backoffice map must include seven workflow steps.'
    Assert-Condition ([bool] $backoffice.boundaries.local_publish_login_only) 'Console backoffice map must declare local publish login boundary.'

    $firstTwoStagesPath = Join-Path $testRoot 'console-first-two-stages.json'
    $firstTwoStagesResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action FirstTwoStages `
        -OutputPath $firstTwoStagesPath
    $firstTwoStagesResult = $firstTwoStagesResultJson | ConvertFrom-Json
    Assert-Condition ([string] $firstTwoStagesResult.status -eq 'created') "Console first two stages result mismatch: $($firstTwoStagesResult.status)"
    Assert-Condition ([string] $firstTwoStagesResult.preview_status -eq 'ready') "Console first two stages status mismatch: $($firstTwoStagesResult.preview_status)"
    Assert-Condition (Test-Path $firstTwoStagesPath) 'Console first two stages preview was not created.'
    $firstTwoStages = Get-Content -LiteralPath $firstTwoStagesPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $firstTwoStages.preview_type -eq 'tongzhuo_product_first_two_stages_preview') 'Console first two stages preview type mismatch.'
    Assert-Condition ([int] $firstTwoStages.summary.stage_count -eq 2) 'Console first two stages preview should include two stages.'

    $pilotReleaseRoot = Join-Path $testRoot 'console-pilot-release'
    New-Item -ItemType Directory -Force -Path $pilotReleaseRoot | Out-Null
    $pilotDeliveryPackage = Join-Path $pilotReleaseRoot 'console-pilot-release.zip'
    Set-Content -LiteralPath $pilotDeliveryPackage -Value 'console pilot package fixture' -Encoding UTF8
    $pilotDeliveryItem = Get-Item -LiteralPath $pilotDeliveryPackage
    $pilotDeliveryHash = (Get-FileHash -LiteralPath $pilotDeliveryPackage -Algorithm SHA256).Hash.ToLowerInvariant()
    $pilotManifestPath = Join-Path $pilotReleaseRoot 'console-pilot-release-manifest.json'
    [ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        release_slug = 'console-pilot-release'
        customer_slug = 'console-pilot'
        company_name = 'Console Pilot Test Co., Ltd.'
        short_name = 'Console Pilot'
        site_url = 'https://console-pilot.example.com'
        geoflow_base_url = 'https://work-console-pilot.example.com'
        publisher_port = 18180
        desktop_agent_port = 18280
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        delivery_package = [ordered]@{
            path = $pilotDeliveryPackage
            file = Split-Path $pilotDeliveryPackage -Leaf
            sha256 = $pilotDeliveryHash
            bytes = [int64] $pilotDeliveryItem.Length
        }
        gates = [ordered]@{
            customer_config_validation = $true
            customer_delivery_generation = $true
            customer_delivery_package_validation = $true
            excludes_customer_api_token = $true
            excludes_platform_credentials = $true
            excludes_browser_profiles = $true
            excludes_node_modules = $true
        }
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $pilotManifestPath -Encoding UTF8
    Copy-Item -LiteralPath $firstTwoStagesPath -Destination (Join-Path $pilotReleaseRoot 'first-two-stages-preview.json') -Force
    $pilotChecklistPath = Join-Path $testRoot 'console-first-two-stages-pilot.md'
    $pilotResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action FirstTwoStagesPilot `
        -ReleaseManifestPath $pilotManifestPath `
        -ScanRoot $pilotReleaseRoot `
        -OutputPath $pilotChecklistPath
    $pilotResult = $pilotResultJson | ConvertFrom-Json
    Assert-Condition ([string] $pilotResult.status -eq 'created') "Console first two stages pilot result mismatch: $($pilotResult.status)"
    Assert-Condition ([string] $pilotResult.pilot_status -eq 'ready_for_pilot') "Console first two stages pilot status mismatch: $($pilotResult.pilot_status)"
    Assert-Condition (Test-Path $pilotChecklistPath) 'Console first two stages pilot Markdown was not created.'

    $aiVisibilityPath = Join-Path $testRoot 'console-ai-visibility.json'
    $aiVisibilityResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action AIVisibility `
        -SiteUrl 'https://console-ai.example.com' `
        -OutputPath $aiVisibilityPath
    $aiVisibilityResult = $aiVisibilityResultJson | ConvertFrom-Json
    Assert-Condition ([string] $aiVisibilityResult.status -eq 'created') "Console AI visibility result mismatch: $($aiVisibilityResult.status)"
    Assert-Condition (Test-Path $aiVisibilityPath) 'Console AI visibility audit was not created.'
    $aiVisibility = Get-Content -LiteralPath $aiVisibilityPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $aiVisibility.audit_type -eq 'tongzhuo_ai_visibility_audit') 'Console AI visibility audit type mismatch.'
    Assert-Condition ([int] $aiVisibility.summary.entrypoint_count -eq 5) 'Console AI visibility audit should list five AI entrypoints.'

    $demoPath = Join-Path $testRoot 'console-demo.json'
    $demoResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerDemo `
        -CustomerSlug 'console-demo' `
        -CompanyName 'Console Demo Test Co., Ltd.' `
        -ShortName 'Console Demo' `
        -SiteUrl 'https://console-demo.example.com' `
        -GeoFlowBaseUrl 'https://work-console-demo.example.com' `
        -OutputPath $demoPath
    $demoResult = $demoResultJson | ConvertFrom-Json
    Assert-Condition ([string] $demoResult.status -eq 'created') "Console customer demo result mismatch: $($demoResult.status)"
    Assert-Condition (Test-Path $demoPath) 'Console customer demo was not created.'
    $demo = Get-Content -LiteralPath $demoPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $demo.demo_type -eq 'tongzhuo_customer_demo_script') 'Console customer demo type mismatch.'
    Assert-Condition ([string] $demo.customer.slug -eq 'console-demo') 'Console customer demo slug mismatch.'

    $proposalPath = Join-Path $testRoot 'console-proposal.json'
    $proposalResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerProposal `
        -CustomerSlug 'console-proposal' `
        -CompanyName 'Console Proposal Test Co., Ltd.' `
        -ShortName 'Console Proposal' `
        -SiteUrl 'https://console-proposal.example.com' `
        -GeoFlowBaseUrl 'https://work-console-proposal.example.com' `
        -OutputPath $proposalPath
    $proposalResult = $proposalResultJson | ConvertFrom-Json
    Assert-Condition ([string] $proposalResult.status -eq 'created') "Console customer proposal result mismatch: $($proposalResult.status)"
    Assert-Condition (Test-Path $proposalPath) 'Console customer proposal was not created.'
    $proposal = Get-Content -LiteralPath $proposalPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $proposal.proposal_type -eq 'tongzhuo_customer_proposal_brief') 'Console customer proposal type mismatch.'
    Assert-Condition ([bool] $proposal.security_boundary.no_prices_in_proposal) 'Console customer proposal must declare no-price boundary.'

    $evidenceRoot = Join-Path $testRoot 'console-evidence'
    New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
    [ordered]@{
        proposal_type = 'tongzhuo_customer_proposal_brief'
        status = 'ready'
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot 'proposal-PROPOSAL-BRIEF.json') -Encoding UTF8
    [ordered]@{
        demo_type = 'tongzhuo_customer_demo_script'
        status = 'ready'
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot 'demo-DEMO-SCRIPT.json') -Encoding UTF8
    $evidencePath = Join-Path $testRoot 'console-evidence-index.json'
    $evidenceResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerEvidence `
        -ScanRoot $evidenceRoot `
        -OutputPath $evidencePath
    $evidenceResult = $evidenceResultJson | ConvertFrom-Json
    Assert-Condition ([string] $evidenceResult.status -eq 'created') "Console customer evidence result mismatch: $($evidenceResult.status)"
    Assert-Condition (Test-Path $evidencePath) 'Console customer evidence index was not created.'
    $evidence = Get-Content -LiteralPath $evidencePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $evidence.evidence_index_type -eq 'tongzhuo_customer_evidence_index') 'Console customer evidence type mismatch.'
    Assert-Condition ([int] $evidence.summary.artifact_count -eq 2) 'Console customer evidence should include two artifacts.'

    $readinessPath = Join-Path $testRoot 'console-launch-readiness.json'
    $readinessResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerLaunchReadiness `
        -ScanRoot $evidenceRoot `
        -OutputPath $readinessPath
    $readinessResult = $readinessResultJson | ConvertFrom-Json
    Assert-Condition ([string] $readinessResult.status -eq 'created') "Console customer launch readiness result mismatch: $($readinessResult.status)"
    Assert-Condition (Test-Path $readinessPath) 'Console customer launch readiness was not created.'
    $readiness = Get-Content -LiteralPath $readinessPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $readiness.launch_readiness_type -eq 'tongzhuo_customer_launch_readiness') 'Console customer launch readiness type mismatch.'
    Assert-Condition ([string] $readiness.status -eq 'blocked') 'Incomplete console evidence should result in blocked readiness.'

    $healthPath = Join-Path $testRoot 'console-health-scorecard.json'
    $healthResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerHealth `
        -ScanRoot $evidenceRoot `
        -OutputPath $healthPath
    $healthResult = $healthResultJson | ConvertFrom-Json
    Assert-Condition ([string] $healthResult.status -eq 'created') "Console customer health result mismatch: $($healthResult.status)"
    Assert-Condition (Test-Path $healthPath) 'Console customer health scorecard was not created.'
    $health = Get-Content -LiteralPath $healthPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $health.health_scorecard_type -eq 'tongzhuo_customer_health_scorecard') 'Console customer health scorecard type mismatch.'
    Assert-Condition ([string] $health.status -eq 'blocked') 'Incomplete console evidence should result in blocked health.'

    $intakePath = Join-Path $testRoot 'console-intake.json'
    $intakeResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerIntake `
        -CustomerSlug 'console-intake' `
        -CompanyName 'Console Intake Test Co., Ltd.' `
        -ShortName 'Console Intake' `
        -SiteUrl 'https://console-intake.example.com' `
        -GeoFlowBaseUrl 'https://work-console-intake.example.com' `
        -OutputPath $intakePath
    $intakeResult = $intakeResultJson | ConvertFrom-Json
    Assert-Condition ([string] $intakeResult.status -eq 'created') "Console customer intake result mismatch: $($intakeResult.status)"
    Assert-Condition (Test-Path $intakePath) 'Console customer intake was not created.'
    $intake = Get-Content -LiteralPath $intakePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $intake.intake_type -eq 'tongzhuo_customer_intake_checklist') 'Console customer intake type mismatch.'
    Assert-Condition ([string] $intake.next_commands.run_customer_wizard -like '*CustomerWizard*') 'Console customer intake must include CustomerWizard next command.'

    $portfolioRoot = Join-Path $testRoot 'portfolio-source'
    New-Item -ItemType Directory -Force -Path $portfolioRoot | Out-Null
    $portfolioDossierPath = Join-Path $portfolioRoot 'console-portfolio-PROJECT-DOSSIER.json'
    [ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'ready_for_launch'
        version = $expectedVersion
        release_slug = 'console-portfolio-release'
        customer = [ordered]@{
            slug = 'console-portfolio'
            company_name = 'Console Portfolio Test Co., Ltd.'
            short_name = 'Console Portfolio'
            site_url = 'https://console-portfolio.example.com'
            geoflow_base_url = 'https://work-console-portfolio.example.com'
            desktop_agent_port = 18280
        }
        artifact_inventory = @([ordered]@{ role = 'release_manifest' })
        lifecycle = @([ordered]@{ stage = 'intake' })
        risk_flags = @()
        management_next_actions = @('Archive acceptance evidence.')
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $portfolioDossierPath -Encoding UTF8
    $portfolioPath = Join-Path $testRoot 'console-portfolio.json'
    $portfolioResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerPortfolio `
        -ScanRoot $portfolioRoot `
        -OutputPath $portfolioPath
    $portfolioResult = $portfolioResultJson | ConvertFrom-Json
    Assert-Condition ([string] $portfolioResult.status -eq 'created') "Console customer portfolio result mismatch: $($portfolioResult.status)"
    Assert-Condition (Test-Path $portfolioPath) 'Console customer portfolio was not created.'
    $portfolio = Get-Content -LiteralPath $portfolioPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $portfolio.portfolio_type -eq 'tongzhuo_customer_portfolio_index') 'Console customer portfolio type mismatch.'
    Assert-Condition ([int] $portfolio.summary.customer_records -eq 1) 'Console customer portfolio should include one customer record.'

    $configPath = Join-Path $testRoot 'console-smoke.json'
    $configResultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action NewCustomerConfig `
        -CustomerSlug 'console-smoke' `
        -CompanyName 'Console Smoke Test Co., Ltd.' `
        -ShortName 'Console Smoke' `
        -SiteUrl 'https://console-smoke.example.com' `
        -GeoFlowBaseUrl 'https://work-console-smoke.example.com' `
        -OutputPath $configPath `
        -Force
    $configResult = $configResultJson | ConvertFrom-Json
    Assert-Condition ([string] $configResult.status -eq 'created') "Console customer config result mismatch: $($configResult.status)"
    Assert-Condition (Test-Path $configPath) 'Console customer config was not created.'
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $config.customer_slug -eq 'console-smoke') 'Console customer config slug mismatch.'
    Assert-Condition ([string] $config.geoflow.api_token -eq '') 'Console customer config must keep API Token empty.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Product delivery console validation passed.'
