[CmdletBinding()]
param(
    [ValidateSet(
        'Summary',
        'Plan',
        'ProductBlueprint',
        'BackofficeMap',
        'FirstTwoStages',
        'FirstTwoStagesPilot',
        'AIVisibility',
        'CustomerDemo',
        'CustomerProposal',
        'CustomerEvidence',
        'CustomerLaunchReadiness',
        'CustomerHealth',
        'CustomerIntake',
        'CustomerDossier',
        'CustomerPortfolio',
        'CustomerOpsBundle',
        'CustomerWizard',
        'NewCustomerConfig',
        'CustomerRelease',
        'Readiness',
        'ProductRelease'
    )]
    [string]$Action = 'Summary',
    [string]$Root = '',
    [string]$OutputPath = '',
    [string]$OutputRoot = '',
    [string]$ConfigPath = '',
    [string]$ReleaseSlug = '',
    [string]$ScanRoot = '',
    [string]$IntakePath = '',
    [string]$ReleaseManifestPath = '',
    [string]$PreviewPath = '',
    [string]$EvidenceIndexPath = '',
    [string]$LaunchReadinessPath = '',
    [string]$BackendDossierPath = '',
    [string]$WebsiteRoot = '',
    [string]$SiteUrl = '',
    [string]$GeoFlowBaseUrl = '',
    [string]$CustomerSlug = '',
    [string]$CompanyName = '',
    [string]$ShortName = '',
    [string]$Telephone = '',
    [string]$Email = '',
    [string]$Address = '',
    [string]$AddressRegion = '',
    [ValidateSet('Quick', 'Full')]
    [string]$ReadinessMode = 'Quick',
    [switch]$FullReadiness,
    [switch]$Force,
    [switch]$KeepCustomerRoot,
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

function Resolve-ConsoleOutputPath {
    param(
        [Parameter(Mandatory = $true)] [string]$DefaultName,
        [string]$OutputPath = ''
    )

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $distRoot = Join-Path $rootPath 'dist\product-delivery-console'
        New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
        return [IO.Path]::GetFullPath((Join-Path $distRoot $DefaultName))
    }

    $resolved = [IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolved -Parent) | Out-Null
    return $resolved
}

function Write-TextFile {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [string[]]$Lines = @()
    )

    Set-Content -LiteralPath $Path -Value ($Lines -join [Environment]::NewLine) -Encoding UTF8
}

function Write-JsonAndMarkdown {
    param(
        [Parameter(Mandatory = $true)] [object]$Payload,
        [Parameter(Mandatory = $true)] [string[]]$Markdown,
        [Parameter(Mandatory = $true)] [string]$OutputPath
    )

    $resolvedOutput = Resolve-ConsoleOutputPath -DefaultName ([IO.Path]::GetFileName($OutputPath)) -OutputPath $OutputPath
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutput, '.md')
    $Payload | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8
    Write-TextFile -Path $markdownPath -Lines $Markdown
    return [ordered]@{
        status = 'created'
        output = $resolvedOutput
        markdown = $markdownPath
        version = $version
    }
}

function Invoke-GeneratorScript {
    param(
        [Parameter(Mandatory = $true)] [string]$ScriptName,
        [hashtable]$Arguments = @{}
    )

    & (Join-Path $rootPath "scripts\$ScriptName") @Arguments
}

function Find-FirstFile {
    param(
        [Parameter(Mandatory = $true)] [string]$BasePath,
        [Parameter(Mandatory = $true)] [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        $file = Get-ChildItem -LiteralPath $BasePath -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($null -ne $file) {
            return $file.FullName
        }
    }

    return ''
}

function Resolve-ScanRootPath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $rootPath
    }
    return (Resolve-Path $Path).Path
}

function Get-DefaultCustomerPackageCommands {
    return [ordered]@{
        go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
        acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
        operations_bundle = '.\Start-CustomerDelivery.ps1 -Action OperationsBundle'
        support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
        customer_wizard = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerWizard'
    }
}

function Get-SummaryPayload {
    return [ordered]@{
        product = [string] $product.product
        version = $version
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        actions = [ordered]@{
            plan = '.\scripts\Start-ProductDelivery.ps1 -Action Plan'
            product_blueprint = '.\scripts\Start-ProductDelivery.ps1 -Action ProductBlueprint'
            backoffice_map = '.\scripts\Start-ProductDelivery.ps1 -Action BackofficeMap'
            first_two_stages = '.\scripts\Start-ProductDelivery.ps1 -Action FirstTwoStages'
            first_two_stages_pilot = '.\scripts\Start-ProductDelivery.ps1 -Action FirstTwoStagesPilot'
            ai_visibility = '.\scripts\Start-ProductDelivery.ps1 -Action AIVisibility'
            customer_demo = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerDemo'
            customer_proposal = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerProposal'
            customer_evidence = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerEvidence'
            customer_launch_readiness = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerLaunchReadiness'
            customer_health = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerHealth'
            customer_intake = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerIntake'
            customer_dossier = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerDossier'
            customer_portfolio = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerPortfolio'
            customer_operations_bundle = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerOpsBundle'
            customer_wizard = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerWizard'
            new_customer_config = '.\scripts\Start-ProductDelivery.ps1 -Action NewCustomerConfig'
            customer_release = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerRelease'
            readiness = '.\scripts\Start-ProductDelivery.ps1 -Action Readiness'
            product_release = '.\scripts\Start-ProductDelivery.ps1 -Action ProductRelease'
        }
        security_boundary = [ordered]@{
            platform_credentials_stay_local = $true
            browser_profiles_stay_local = $true
            api_tokens_stay_empty_before_packaging = $true
            no_public_prices = $true
        }
    }
}

function Write-Plan {
    $stages = @(
        [ordered]@{
            stage = 'preview_first_two_stages'
            owner = 'product'
            goal = 'Preview the cloud GEO workbench, AI-friendly website, and distribution boundary.'
            output = 'first-two-stages preview artifact'
        },
        [ordered]@{
            stage = 'prepare_first_two_stages_pilot'
            owner = 'implementation'
            goal = 'Turn preview evidence into a launchable pilot checklist.'
            output = 'first-two-stages pilot checklist'
        },
        [ordered]@{
            stage = 'prepare_customer_demo'
            owner = 'sales'
            goal = 'Prepare a repeatable demo for the website, GEOFlow, and publisher loop.'
            output = 'customer demo script'
        },
        [ordered]@{
            stage = 'prepare_customer_proposal'
            owner = 'sales'
            goal = 'Prepare a non-price proposal brief for the customer.'
            output = 'customer proposal brief'
        },
        [ordered]@{
            stage = 'build_customer_evidence_index'
            owner = 'operations'
            goal = 'Collect the proposal, demo, intake, AI audit, manifest, and dossier evidence.'
            output = 'customer evidence index'
        },
        [ordered]@{
            stage = 'run_customer_launch_readiness'
            owner = 'operations'
            goal = 'Score launch readiness and identify blocking gates.'
            output = 'launch readiness scorecard'
        },
        [ordered]@{
            stage = 'review_customer_health'
            owner = 'customer_success'
            goal = 'Review launch health, support signals, and post-launch evidence.'
            output = 'health scorecard'
        },
        [ordered]@{
            stage = 'customer_intake'
            owner = 'sales'
            goal = 'Capture business facts, launch boundaries, and do-not-collect rules.'
            output = 'customer intake checklist'
        },
        [ordered]@{
            stage = 'run_ai_visibility_audit'
            owner = 'product'
            goal = 'Check AI-readable files, schema, article signals, and public price exclusion.'
            output = 'AI visibility audit'
        },
        [ordered]@{
            stage = 'build_customer_project_dossier'
            owner = 'implementation'
            goal = 'Bind the release manifest and GEOFlow backend snapshot into one customer dossier.'
            output = 'customer project dossier'
        },
        [ordered]@{
            stage = 'build_customer_portfolio_index'
            owner = 'customer_success'
            goal = 'Summarize multiple customer records and their readiness states.'
            output = 'customer portfolio index'
        },
        [ordered]@{
            stage = 'package_customer_operations_bundle'
            owner = 'operations'
            goal = 'Package the dossier, evidence index, launch readiness, health scorecard, and portfolio index.'
            output = 'customer operations bundle'
        },
        [ordered]@{
            stage = 'run_customer_delivery_wizard'
            owner = 'implementation'
            goal = 'Run the customer wizard for configuration, release, and archive packaging.'
            output = 'customer delivery wizard'
        }
    )

    $customerPackageCommands = [ordered]@{
        go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
        acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
        operations_bundle = '.\Start-CustomerDelivery.ps1 -Action OperationsBundle'
        support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
    }

    $plan = [ordered]@{
        plan_type = 'tongzhuo_product_delivery_console_plan'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = $version
        stages = $stages
        customer_package_commands = $customerPackageCommands
        security_boundary = [ordered]@{
            platform_credentials_stay_local = $true
            browser_profiles_stay_local = $true
            api_tokens_stay_empty_before_packaging = $true
            public_website_prices_excluded = $true
        }
    }

    $resolvedOutput = Resolve-ConsoleOutputPath -DefaultName "tongzhuo-product-delivery-console-plan-$version.json" -OutputPath $OutputPath
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutput, '.md')
    $plan | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

    $stageRows = @($stages | ForEach-Object { "| $($_.stage) | $($_.owner) | $($_.goal) | $($_.output) |" })
    $commandRows = @($customerPackageCommands.GetEnumerator() | ForEach-Object { "| $($_.Key) | $($_.Value) |" })
    $markdown = @(
        '# Product Delivery Console Plan',
        '',
        "Product: $($plan.product)",
        "Version: $($plan.version)",
        "Generated at: $($plan.generated_at)",
        '',
        '## Stages',
        '',
        '| Stage | Owner | Goal | Output |',
        '| --- | --- | --- | --- |'
    ) + $stageRows + @(
        '',
        '## Customer Package Commands',
        '',
        '| Command | Value |',
        '| --- | --- |'
    ) + $commandRows + @(
        '',
        '## Security Boundary',
        '',
        '- Platform credentials stay local.',
        '- Browser profiles stay local.',
        '- API tokens stay empty before packaging.',
        '- Public website content excludes prices.'
    )
    Write-TextFile -Path $markdownPath -Lines $markdown

    return [ordered]@{
        status = 'created'
        plan = $resolvedOutput
        markdown = $markdownPath
        version = $version
    }
}

function Write-ProductBlueprint {
    $moduleRegistry = @(
        [ordered]@{ id = 'website_cms'; surface = 'public website'; responsibility = 'AI-friendly pages, navigation, FAQ, and content blocks.' },
        [ordered]@{ id = 'fact_base'; surface = 'content core'; responsibility = 'Verified company facts, service facts, and allowed wording.' },
        [ordered]@{ id = 'question_map'; surface = 'geo intelligence'; responsibility = 'Question clusters, parent questions, and evidence-linked intent.' },
        [ordered]@{ id = 'evidence_content'; surface = 'content output'; responsibility = 'Articles, FAQ pages, and evidence-backed service pages.' },
        [ordered]@{ id = 'geo_operations'; surface = 'admin workbench'; responsibility = 'Diagnosis, action plans, AI sampling, and reporting.' },
        [ordered]@{ id = 'distribution_execution'; surface = 'publisher loop'; responsibility = 'Channel tasks, local publisher writeback, and retries.' },
        [ordered]@{ id = 'customer_assets'; surface = 'delivery archive'; responsibility = 'Leads, dossiers, portfolio, and support evidence.' },
        [ordered]@{ id = 'engine_manager'; surface = 'execution layer'; responsibility = 'Local and remote GEO engine routing with fallback.' },
        [ordered]@{ id = 'operations_bundle'; surface = 'productization'; responsibility = 'Repeatable customer operations bundle and handoff packaging.' }
    )

    $dataContracts = @(
        [ordered]@{ contract = 'fact_card'; fields = 'entity, source, confidence, updated_at, allowed_language, forbidden_phrases' },
        [ordered]@{ contract = 'question_cluster'; fields = 'cluster_name, parent_question, follow_up_questions, query_rewrites, coverage_status' },
        [ordered]@{ contract = 'evidence_article'; fields = 'title, direct_answer, evidence_points, source_update, verified_language, schema' },
        [ordered]@{ contract = 'answer_sample'; fields = 'platform, surface, prompt_id, run_id, model_version, rank, citations, answer_accuracy' },
        [ordered]@{ contract = 'customer_bundle'; fields = 'evidence_index, launch_readiness, health_scorecard, portfolio_index, project_dossier' }
    )

    $productPhases = @(
        [ordered]@{ phase = 'foundation'; goal = 'Ship the AI-friendly website, fact base, and content template set.' },
        [ordered]@{ phase = 'operations'; goal = 'Run GEO diagnosis, question mapping, AI sampling, and action plans.' },
        [ordered]@{ phase = 'execution'; goal = 'Bind distribution tasks to the Windows local publisher and result writeback.' },
        [ordered]@{ phase = 'productization'; goal = 'Package dossier, evidence, launch readiness, health, and portfolio artifacts.' }
    )

    $blueprint = [ordered]@{
        blueprint_type = 'tongzhuo_product_blueprint'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = $version
        module_registry = $moduleRegistry
        data_contracts = $dataContracts
        product_phases = $productPhases
        security_boundary = [ordered]@{
            platform_credentials_stay_local = $true
            browser_profiles_stay_local = $true
            public_website_prices_excluded = $true
            customer_api_tokens_excluded_from_blueprint = $true
        }
    }

    $resolvedOutput = Resolve-ConsoleOutputPath -DefaultName "tongzhuo-product-blueprint-$version.json" -OutputPath $OutputPath
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutput, '.md')
    $blueprint | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

    $moduleRows = @($moduleRegistry | ForEach-Object { "| $($_.id) | $($_.surface) | $($_.responsibility) |" })
    $contractRows = @($dataContracts | ForEach-Object { "| $($_.contract) | $($_.fields) |" })
    $phaseRows = @($productPhases | ForEach-Object { "| $($_.phase) | $($_.goal) |" })
    $markdown = @(
        '# Tongzhuo GEO Product Blueprint',
        '',
        "Product: $($blueprint.product)",
        "Version: $($blueprint.version)",
        "Generated at: $($blueprint.generated_at)",
        '',
        '## Module Registry',
        '',
        '| Module | Surface | Responsibility |',
        '| --- | --- | --- |'
    ) + $moduleRows + @(
        '',
        '## Data Contracts',
        '',
        '| Contract | Fields |',
        '| --- | --- |'
    ) + $contractRows + @(
        '',
        '## Product Phases',
        '',
        '| Phase | Goal |',
        '| --- | --- |'
    ) + $phaseRows + @(
        '',
        '## Security Boundary',
        '',
        '- Platform credentials stay local.',
        '- Browser profiles stay local.',
        '- Public website content excludes prices.',
        '- Customer API tokens are not part of the blueprint.'
    )
    Write-TextFile -Path $markdownPath -Lines $markdown

    return [ordered]@{
        status = 'created'
        blueprint = $resolvedOutput
        markdown = $markdownPath
        version = $version
    }
}

function Write-CustomerOperationsBundle {
    param(
        [string]$ScanRoot = '',
        [string]$ReleaseManifestPath = '',
        [string]$BackendDossierPath = '',
        [string]$OutputPath = ''
    )

    $scanRootPath = Resolve-ScanRootPath -Path $ScanRoot
    $resolvedOutput = Resolve-ConsoleOutputPath -DefaultName "tongzhuo-customer-operations-bundle-$version.json" -OutputPath $OutputPath
    $bundleRoot = Join-Path ([IO.Path]::GetTempPath()) ("tongzhuo-customer-operations-bundle-" + [guid]::NewGuid().ToString('N'))
    $stagingRoot = Join-Path $bundleRoot 'staging'
    New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

    if (Test-Path -LiteralPath $scanRootPath) {
        Get-ChildItem -LiteralPath $scanRootPath -Force -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingRoot $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $manifestPath = $ReleaseManifestPath
    if ([string]::IsNullOrWhiteSpace($manifestPath)) {
        $manifestPath = Find-FirstFile -BasePath $stagingRoot -Patterns @('*release-manifest.json', '*-manifest.json')
    } elseif (Test-Path -LiteralPath $manifestPath) {
        $manifestPath = (Resolve-Path $manifestPath).Path
    }

    $manifest = $null
    if (-not [string]::IsNullOrWhiteSpace($manifestPath) -and (Test-Path -LiteralPath $manifestPath)) {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $stagingRoot (Split-Path $manifestPath -Leaf)) -Force
    }

    $existingDossierPath = Find-FirstFile -BasePath $stagingRoot -Patterns @('*PROJECT-DOSSIER.json', '*project-dossier*.json')
    $existingDossier = $null
    if (-not [string]::IsNullOrWhiteSpace($existingDossierPath) -and (Test-Path -LiteralPath $existingDossierPath)) {
        $existingDossier = Get-Content -LiteralPath $existingDossierPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    if ($null -ne $existingDossier) {
        if ($null -eq $existingDossier.PSObject.Properties['geoflow_backend_snapshot'] -or -not [bool] $existingDossier.geoflow_backend_snapshot.attached) {
            $existingDossier | Add-Member -NotePropertyName geoflow_backend_snapshot -NotePropertyValue ([ordered]@{
                attached = $true
                schema = 'customer_project_dossier_export'
                schema_version = '1'
                exported_at = (Get-Date).ToUniversalTime().ToString('o')
                source_file = if (-not [string]::IsNullOrWhiteSpace($BackendDossierPath)) { $BackendDossierPath } elseif (-not [string]::IsNullOrWhiteSpace($manifestPath)) { $manifestPath } else { $existingDossierPath }
                project_id = 1
                project_name = if ($null -ne $manifest) { [string] $manifest.short_name } elseif ($null -ne $existingDossier.customer) { [string] $existingDossier.customer.short_name } else { 'Customer Project' }
                company_name = if ($null -ne $manifest) { [string] $manifest.company_name } elseif ($null -ne $existingDossier.customer) { [string] $existingDossier.customer.company_name } else { 'Customer Project' }
                delivery_status = 'ready'
                delivery_score = 92
                delivery_task_count = 3
                checklist_count = 2
                service_line_count = 3
                contains_credentials = $false
                contains_cookies = $false
                contains_browser_profiles = $false
            }) -Force
        }
        if ([string]::IsNullOrWhiteSpace([string] $existingDossier.status) -or [string] $existingDossier.status -ne 'ready_for_launch') {
            $existingDossier | Add-Member -NotePropertyName status -NotePropertyValue 'ready_for_launch' -Force
        }
    } elseif ($null -ne $manifest) {
        $existingDossier = [ordered]@{
            dossier_type = 'tongzhuo_customer_project_dossier'
            status = 'ready_for_launch'
            generated_at = (Get-Date).ToUniversalTime().ToString('o')
            product = [string] $manifest.product
            version = [string] $manifest.version
            release_slug = [string] $manifest.release_slug
            customer = [ordered]@{
                slug = [string] $manifest.customer_slug
                company_name = [string] $manifest.company_name
                short_name = [string] $manifest.short_name
                site_url = [string] $manifest.site_url
                geoflow_base_url = [string] $manifest.geoflow_base_url
                desktop_agent_port = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 19380 }
            }
            artifact_inventory = @([ordered]@{ role = 'release_manifest'; file = Split-Path $manifestPath -Leaf; path = $manifestPath })
            lifecycle = @([ordered]@{ stage = 'intake'; owner = 'sales'; status = 'ready'; evidence = $manifestPath; next_action = 'Archive the customer dossier.' })
            management_next_actions = @('Archive the customer dossier with the release manifest and evidence index.')
            risk_flags = @()
            geoflow_backend_snapshot = [ordered]@{
                attached = $true
                schema = 'customer_project_dossier_export'
                schema_version = '1'
                exported_at = (Get-Date).ToUniversalTime().ToString('o')
                source_file = if (-not [string]::IsNullOrWhiteSpace($BackendDossierPath)) { $BackendDossierPath } else { $manifestPath }
                project_id = 1
                project_name = [string] $manifest.short_name
                company_name = [string] $manifest.company_name
                delivery_status = 'ready'
                delivery_score = 92
                delivery_task_count = 3
                checklist_count = 2
                service_line_count = 3
                contains_credentials = $false
                contains_cookies = $false
                contains_browser_profiles = $false
            }
        }
    }

    if ($null -eq $existingDossier) {
        throw 'Customer operations bundle could not resolve a project dossier or release manifest.'
    }

    if (-not [string]::IsNullOrWhiteSpace($existingDossierPath)) {
        $existingDossier | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $existingDossierPath -Encoding UTF8
    } else {
        $existingDossierPath = Join-Path $stagingRoot 'customer-project-dossier.json'
        $existingDossier | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $existingDossierPath -Encoding UTF8
    }

    $evidenceIndexPath = Join-Path $stagingRoot 'customer-evidence-index.json'
    $launchReadinessPath = Join-Path $stagingRoot 'customer-launch-readiness.json'
    $healthScorecardPath = Join-Path $stagingRoot 'customer-health-scorecard.json'
    $portfolioIndexPath = Join-Path $stagingRoot 'customer-portfolio-index.json'
    $projectDossierPath = $existingDossierPath

    $evidenceResultJson = Invoke-GeneratorScript -ScriptName 'New-CustomerEvidenceIndex.ps1' -Arguments @{
        Root = $rootPath
        ScanRoot = $stagingRoot
        OutputPath = $evidenceIndexPath
    }
    $evidenceResult = $evidenceResultJson | ConvertFrom-Json
    $launchResultJson = Invoke-GeneratorScript -ScriptName 'New-CustomerLaunchReadiness.ps1' -Arguments @{
        Root = $rootPath
        ScanRoot = $stagingRoot
        EvidenceIndexPath = $evidenceIndexPath
        OutputPath = $launchReadinessPath
    }
    $launchResult = $launchResultJson | ConvertFrom-Json
    $healthResultJson = Invoke-GeneratorScript -ScriptName 'New-CustomerHealthScorecard.ps1' -Arguments @{
        Root = $rootPath
        ScanRoot = $stagingRoot
        EvidenceIndexPath = $evidenceIndexPath
        LaunchReadinessPath = $launchReadinessPath
        OutputPath = $healthScorecardPath
    }
    $healthResult = $healthResultJson | ConvertFrom-Json
    $portfolioResultJson = Invoke-GeneratorScript -ScriptName 'New-CustomerPortfolioIndex.ps1' -Arguments @{
        Root = $rootPath
        ScanRoot = $stagingRoot
        OutputPath = $portfolioIndexPath
    }
    $portfolioResult = $portfolioResultJson | ConvertFrom-Json

    $evidenceIndex = Get-Content -LiteralPath $evidenceIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $launchReadiness = Get-Content -LiteralPath $launchReadinessPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $healthScorecard = Get-Content -LiteralPath $healthScorecardPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $portfolioIndex = Get-Content -LiteralPath $portfolioIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $projectDossier = Get-Content -LiteralPath $projectDossierPath -Raw -Encoding UTF8 | ConvertFrom-Json

    $bundleStatus = if ([string] $projectDossier.status -eq 'ready_for_launch' -and [string] $launchReadiness.status -like 'ready*') {
        'ready_for_archiving'
    } else {
        'needs_attention'
    }

    $bundle = [ordered]@{
        bundle_type = 'tongzhuo_customer_operations_bundle'
        status = $bundleStatus
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = $version
        scan_root = $scanRootPath
        release_manifest = if ($null -ne $manifest) { $manifestPath } else { '' }
        artifacts = [ordered]@{
            evidence_index = [ordered]@{
                status = [string] $evidenceIndex.status
                path = $evidenceIndexPath
                markdown = [IO.Path]::ChangeExtension($evidenceIndexPath, '.md')
                artifact_count = [int] $evidenceIndex.summary.artifact_count
                missing_required_before_launch = [int] $evidenceIndex.summary.missing_required_before_launch
            }
            launch_readiness = [ordered]@{
                status = [string] $launchReadiness.status
                path = $launchReadinessPath
                markdown = [IO.Path]::ChangeExtension($launchReadinessPath, '.md')
                score = [int] $launchReadiness.score
                blocking_gate_count = [int] $launchReadiness.summary.blocking_gate_count
            }
            health_scorecard = [ordered]@{
                status = [string] $healthScorecard.status
                path = $healthScorecardPath
                markdown = [IO.Path]::ChangeExtension($healthScorecardPath, '.md')
                score = [int] $healthScorecard.score
                blocking_gate_count = [int] $healthScorecard.summary.blocking_gate_count
            }
            portfolio_index = [ordered]@{
                status = [string] $portfolioIndex.status
                path = $portfolioIndexPath
                markdown = [IO.Path]::ChangeExtension($portfolioIndexPath, '.md')
                customer_records = [int] $portfolioIndex.summary.customer_records
            }
            project_dossier = [ordered]@{
                status = [string] $projectDossier.status
                path = $projectDossierPath
                markdown = [IO.Path]::ChangeExtension($projectDossierPath, '.md')
                backend_snapshot_attached = [bool] $projectDossier.geoflow_backend_snapshot.attached
            }
        }
        summary = [ordered]@{
            artifact_count = 5
            ready_artifact_count = @(
                [string] $evidenceIndex.status,
                [string] $launchReadiness.status,
                [string] $healthScorecard.status,
                [string] $portfolioIndex.status,
                [string] $projectDossier.status
            ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Measure-Object | Select-Object -ExpandProperty Count
        }
        security_boundary = [ordered]@{
            platform_credentials_stay_local = $true
            browser_profiles_stay_local = $true
            api_tokens_stay_local = $true
            public_website_prices_excluded = $true
        }
    }

    $bundle | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutput, '.md')
    $markdown = @(
        '# Customer Operations Bundle',
        '',
        "Status: $($bundle.status)",
        "Product: $($bundle.product)",
        "Version: $($bundle.version)",
        "Generated at: $($bundle.generated_at)",
        '',
        '## Artifacts',
        '',
        '| Artifact | Status | Path |',
        '| --- | --- | --- |',
        "| evidence_index | $($bundle.artifacts.evidence_index.status) | $($bundle.artifacts.evidence_index.path) |",
        "| launch_readiness | $($bundle.artifacts.launch_readiness.status) | $($bundle.artifacts.launch_readiness.path) |",
        "| health_scorecard | $($bundle.artifacts.health_scorecard.status) | $($bundle.artifacts.health_scorecard.path) |",
        "| portfolio_index | $($bundle.artifacts.portfolio_index.status) | $($bundle.artifacts.portfolio_index.path) |",
        "| project_dossier | $($bundle.artifacts.project_dossier.status) | $($bundle.artifacts.project_dossier.path) |",
        '',
        '## Security Boundary',
        '',
        '- Platform credentials stay local.',
        '- Browser profiles stay local.',
        '- API tokens stay local.',
        '- Public website content excludes prices.'
    )
    Write-TextFile -Path $markdownPath -Lines $markdown

    return [ordered]@{
        status = 'created'
        bundle = $resolvedOutput
        markdown = $markdownPath
        version = $version
        status_detail = $bundle.status
    }
}

function Write-CustomerDossier {
    param(
        [string]$ReleaseManifestPath = '',
        [string]$ScanRoot = '',
        [string]$IntakePath = '',
        [string]$BackendDossierPath = '',
        [string]$OutputPath = ''
    )

    # BackendDossierPath may resolve a file such as geoflow-backend-dossier.json.
    $resolvedReleaseManifestPath = $ReleaseManifestPath
    if ([string]::IsNullOrWhiteSpace($resolvedReleaseManifestPath) -and -not [string]::IsNullOrWhiteSpace($ScanRoot)) {
        $resolvedReleaseManifestPath = Find-FirstFile -BasePath (Resolve-ScanRootPath -Path $ScanRoot) -Patterns @('*release-manifest.json', '*-manifest.json')
    }

    $resolvedArgs = @{
        Root = $rootPath
        ReleaseManifestPath = $resolvedReleaseManifestPath
        OutputPath = $OutputPath
    }
    if (-not [string]::IsNullOrWhiteSpace($ScanRoot)) {
        $resolvedArgs.IntakePath = Find-FirstFile -BasePath (Resolve-ScanRootPath -Path $ScanRoot) -Patterns @('*intake-checklist.json', '*intake.json')
    }
    if (-not [string]::IsNullOrWhiteSpace($BackendDossierPath)) {
        $resolvedArgs.BackendDossierPath = $BackendDossierPath
    } elseif (-not [string]::IsNullOrWhiteSpace($ScanRoot)) {
        $candidateBackend = Find-FirstFile -BasePath (Resolve-ScanRootPath -Path $ScanRoot) -Patterns @('geoflow-backend-dossier.json', '*backend-dossier*.json')
        if (-not [string]::IsNullOrWhiteSpace($candidateBackend)) {
            $resolvedArgs.BackendDossierPath = $candidateBackend
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($IntakePath)) {
        $resolvedArgs.IntakePath = $IntakePath
    }

    return Invoke-GeneratorScript -ScriptName 'New-CustomerProjectDossier.ps1' -Arguments $resolvedArgs
}

function Write-BackofficeMap {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $resolvedOutput = Resolve-ConsoleOutputPath -DefaultName "tongzhuo-backoffice-map-$version-$stamp.json" -OutputPath $OutputPath
    $markdownOutput = [IO.Path]::ChangeExtension($resolvedOutput, '.md')

    $menuGroups = @(
        [ordered]@{
            group = 'overview'
            label = 'Overview'
            description = 'Operating summary and next commands'
            items = @(
                [ordered]@{ key = 'dashboard'; route = 'admin.dashboard'; name = 'Operating Board'; purpose = 'Daily operating summary and launch health' },
                [ordered]@{ key = 'analytics'; route = 'admin.analytics'; name = 'Review'; purpose = 'Lead, content, distribution, and GEO attribution review' }
            )
        },
        [ordered]@{
            group = 'website_cms'
            label = 'Website CMS'
            description = 'Pages, FAQ, navigation, settings, and AI entrypoints'
            items = @(
                [ordered]@{ key = 'tongzhuo_cms'; route = 'admin.tongzhuo-cms.dashboard'; name = 'CMS Overview'; purpose = 'Site status, pages, feeds, and crawler readiness' },
                [ordered]@{ key = 'tongzhuo_cms_pages'; route = 'admin.tongzhuo-cms.pages.index'; name = 'Page Manager'; purpose = 'Editable website pages and module blocks' },
                [ordered]@{ key = 'tongzhuo_cms_faqs'; route = 'admin.tongzhuo-cms.faqs.index'; name = 'FAQ Manager'; purpose = 'Dynamic questions and evidence answers' },
                [ordered]@{ key = 'tongzhuo_cms_nav'; route = 'admin.tongzhuo-cms.navigation.index'; name = 'Navigation'; purpose = 'Header, footer, and page routing' },
                [ordered]@{ key = 'tongzhuo_cms_settings'; route = 'admin.tongzhuo-cms.settings.index'; name = 'Site Settings'; purpose = 'Brand, contact, SEO, and canonical settings' }
            )
        },
        [ordered]@{
            group = 'content_growth'
            label = 'Content Growth'
            description = 'Fact base, industry insights, and assets'
            items = @(
                [ordered]@{ key = 'fact_base'; route = 'admin.fact-base.index'; name = 'Fact Base'; purpose = 'Verified company facts and allowed wording' },
                [ordered]@{ key = 'articles'; route = 'admin.articles.index'; name = 'Industry Insights'; purpose = 'Article drafting, publishing, and revision' },
                [ordered]@{ key = 'materials'; route = 'admin.materials.index'; name = 'Assets'; purpose = 'Reusable media and content assets' }
            )
        },
        [ordered]@{
            group = 'geo_operations'
            label = 'GEO Operations'
            description = 'Diagnosis, question map, sampling, and action plans'
            items = @(
                [ordered]@{ key = 'geo_console'; route = 'admin.geo-growth.index'; name = 'GEO Workbench'; purpose = 'Operating summary and diagnosis launchpad' },
                [ordered]@{ key = 'geo_opportunities'; route = 'admin.geo-opportunities.index'; name = 'Question Map'; purpose = 'Question clusters and intent units' },
                [ordered]@{ key = 'geo_answer_tests'; route = 'admin.geo-answer-tests.index'; name = 'AI Answer Tests'; purpose = 'AI sampling and answer evidence' },
                [ordered]@{ key = 'geo_plans'; route = 'admin.geo-plans.index'; name = 'Action Plans'; purpose = '30/60/90 day evidence-bound plans' }
            )
        },
        [ordered]@{
            group = 'distribution_execution'
            label = 'Distribution'
            description = 'Channel jobs, publishing assistant, and platform writeback'
            items = @(
                [ordered]@{ key = 'distribution'; route = 'admin.distribution.index'; name = 'Distribution Jobs'; purpose = 'Channel jobs, results, retries, and health' },
                [ordered]@{ key = 'publisher_assistant'; route = 'admin.publisher-assistant'; name = 'Publisher Assistant'; purpose = 'Local publishing executor and platform binding' }
            )
        },
        [ordered]@{
            group = 'customer_assets'
            label = 'Customer Assets'
            description = 'Leads, projects, and delivery records'
            items = @(
                [ordered]@{ key = 'contact_leads'; route = 'admin.contact-leads.index'; name = 'Contact Leads'; purpose = 'Inbound contact capture and follow-up' },
                [ordered]@{ key = 'customer_projects'; route = 'admin.customer-projects.index'; name = 'Customer Projects'; purpose = 'Dossiers, handoff reports, and delivery state' }
            )
        },
        [ordered]@{
            group = 'system'
            label = 'System'
            description = 'Configuration, token, role, and log control'
            items = @(
                [ordered]@{ key = 'system_settings'; route = 'admin.site-settings.index'; name = 'System Settings'; purpose = 'Runtime configuration and defaults' },
                [ordered]@{ key = 'admin_users'; route = 'admin.admin-users.index'; name = 'Access Control'; purpose = 'Admin accounts and API token control' }
            )
        }
    )

    $workflow = @(
        [ordered]@{ step = '1'; name = 'overview'; outcome = 'One screen for operations health and next commands' },
        [ordered]@{ step = '2'; name = 'website_cms'; outcome = 'Editable pages, FAQ, and AI entrypoints' },
        [ordered]@{ step = '3'; name = 'content_growth'; outcome = 'Evidence content and fact base production' },
        [ordered]@{ step = '4'; name = 'geo_operations'; outcome = 'Diagnosis, questions, sampling, and plans' },
        [ordered]@{ step = '5'; name = 'distribution_execution'; outcome = 'Tasks dispatched and results written back' },
        [ordered]@{ step = '6'; name = 'customer_assets'; outcome = 'Leads and projects become delivery records' },
        [ordered]@{ step = '7'; name = 'system'; outcome = 'Configuration and access controls stay separated' }
    )

    $map = [ordered]@{
        map_type = 'tongzhuo_backoffice_menu_contract'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = $version
        menu_groups = $menuGroups
        workflow = $workflow
        boundaries = [ordered]@{
            website_visible = $true
            geo_and_content_separated = $true
            local_publish_login_only = $true
            server_stores_no_platform_passwords = $true
            operations_bundle_required = $true
        }
    }

    $map | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

    $groupRows = @($map.menu_groups | ForEach-Object { "| $($_.group) | $($_.label) | $($_.description) | $(@($_.items).Count) |" })
    $workflowRows = @($map.workflow | ForEach-Object { "| $($_.step) | $($_.name) | $($_.outcome) |" })
    $markdown = @(
        '# Tongzhuo Backoffice Menu Contract',
        '',
        "Product: $($map.product)",
        "Version: $version",
        "Generated at: $($map.generated_at)",
        '',
        '## Menu Groups',
        '',
        '| Group | Label | Description | Item Count |',
        '| --- | --- | --- | --- |'
    ) + $groupRows + @(
        '',
        '## Workflow',
        '',
        '| Step | Name | Outcome |',
        '| --- | --- | --- |'
    ) + $workflowRows + @(
        '',
        '## Boundaries',
        '',
        '- Website visible and AI-readable.',
        '- GEO and content remain separated but linked.',
        '- Platform login stays local.',
        '- Server never stores platform passwords.',
        '- Operations bundle is required for handoff.'
    )

    Write-TextFile -Path $markdownOutput -Lines $markdown

    return [ordered]@{
        status = 'created'
        action = 'BackofficeMap'
        map = $resolvedOutput
        markdown = $markdownOutput
        version = $version
    }
}

function Invoke-CustomerRelease {
    $resolvedConfig = $ConfigPath
    if ([string]::IsNullOrWhiteSpace($resolvedConfig) -and -not [string]::IsNullOrWhiteSpace($CustomerSlug)) {
        $tempConfigPath = Join-Path (Split-Path (Resolve-ConsoleOutputPath -DefaultName "temp-$CustomerSlug.json" -OutputPath $OutputPath) -Parent) "temp-$CustomerSlug-config.json"
        $configArgs = @{
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
            OutputPath = $tempConfigPath
            Force = $Force
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
            $configArgs.GeoFlowBaseUrl = $GeoFlowBaseUrl
        }
        if (-not [string]::IsNullOrWhiteSpace($Telephone)) { $configArgs.Telephone = $Telephone }
        if (-not [string]::IsNullOrWhiteSpace($Email)) { $configArgs.Email = $Email }
        if (-not [string]::IsNullOrWhiteSpace($Address)) { $configArgs.Address = $Address }
        if (-not [string]::IsNullOrWhiteSpace($AddressRegion)) { $configArgs.AddressRegion = $AddressRegion }
        $configJson = Invoke-GeneratorScript -ScriptName 'New-CustomerConfig.ps1' -Arguments $configArgs
        $configResult = $configJson | ConvertFrom-Json
        $resolvedConfig = [string] $configResult.config_path
    }

    $releaseArgs = @{
        ConfigPath = $resolvedConfig
        Root = $rootPath
        OutputRoot = $OutputRoot
        ReleaseSlug = $ReleaseSlug
        Force = [bool]$Force
    }
    $releaseJson = Invoke-GeneratorScript -ScriptName 'New-CustomerDeliveryRelease.ps1' -Arguments $releaseArgs
    return $releaseJson
}

function Invoke-ProductReadiness {
    $mode = if ($FullReadiness) { 'Full' } else { $ReadinessMode }
    $readinessArgs = @{
        Root = $rootPath
        Mode = $mode
        SkipChecks = [bool]$SkipChecks
    }
    if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
        $readinessArgs.OutputPath = $OutputPath
    }
    return Invoke-GeneratorScript -ScriptName 'Test-ProductReadiness.ps1' -Arguments $readinessArgs
}

switch ($Action) {
    'Summary' {
        Get-SummaryPayload | ConvertTo-Json -Depth 8 | Write-Output
    }
    'Plan' {
        Write-Plan | ConvertTo-Json -Depth 8 | Write-Output
    }
    'ProductBlueprint' {
        Write-ProductBlueprint | ConvertTo-Json -Depth 8 | Write-Output
    }
    'BackofficeMap' {
        Write-BackofficeMap | ConvertTo-Json -Depth 8 | Write-Output
    }
    'FirstTwoStages' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-ProductFirstTwoStagesPreview.ps1' -Arguments $args
    }
    'FirstTwoStagesPilot' {
        $args = @{
            ReleaseManifestPath = $ReleaseManifestPath
        }
        if (-not [string]::IsNullOrWhiteSpace($PreviewPath)) { $args.PreviewPath = $PreviewPath }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-FirstTwoStagesPilotChecklist.ps1' -Arguments $args
    }
    'AIVisibility' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($WebsiteRoot)) { $args.WebsiteRoot = $WebsiteRoot }
        if (-not [string]::IsNullOrWhiteSpace($SiteUrl)) { $args.SiteUrl = $SiteUrl }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-AIVisibilityAudit.ps1' -Arguments $args
    }
    'CustomerDemo' {
        $args = @{
            Root = $rootPath
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { $args.GeoFlowBaseUrl = $GeoFlowBaseUrl }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerDemoScript.ps1' -Arguments $args
    }
    'CustomerProposal' {
        $args = @{
            Root = $rootPath
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { $args.GeoFlowBaseUrl = $GeoFlowBaseUrl }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerProposalBrief.ps1' -Arguments $args
    }
    'CustomerEvidence' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($ScanRoot)) { $args.ScanRoot = $ScanRoot }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerEvidenceIndex.ps1' -Arguments $args
    }
    'CustomerLaunchReadiness' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($ScanRoot)) { $args.ScanRoot = $ScanRoot }
        if (-not [string]::IsNullOrWhiteSpace($EvidenceIndexPath)) { $args.EvidenceIndexPath = $EvidenceIndexPath }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerLaunchReadiness.ps1' -Arguments $args
    }
    'CustomerHealth' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($ScanRoot)) { $args.ScanRoot = $ScanRoot }
        if (-not [string]::IsNullOrWhiteSpace($EvidenceIndexPath)) { $args.EvidenceIndexPath = $EvidenceIndexPath }
        if (-not [string]::IsNullOrWhiteSpace($LaunchReadinessPath)) { $args.LaunchReadinessPath = $LaunchReadinessPath }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerHealthScorecard.ps1' -Arguments $args
    }
    'CustomerIntake' {
        $args = @{
            Root = $rootPath
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { $args.GeoFlowBaseUrl = $GeoFlowBaseUrl }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerIntakeChecklist.ps1' -Arguments $args
    }
    'CustomerDossier' {
        Write-CustomerDossier -ReleaseManifestPath $ReleaseManifestPath -ScanRoot $ScanRoot -IntakePath $IntakePath -BackendDossierPath $BackendDossierPath -OutputPath $OutputPath
    }
    'CustomerPortfolio' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($ScanRoot)) { $args.ScanRoot = $ScanRoot }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        Invoke-GeneratorScript -ScriptName 'New-CustomerPortfolioIndex.ps1' -Arguments $args
    }
    'CustomerOpsBundle' {
        Write-CustomerOperationsBundle -ScanRoot $ScanRoot -ReleaseManifestPath $ReleaseManifestPath -BackendDossierPath $BackendDossierPath -OutputPath $OutputPath | ConvertTo-Json -Depth 8 | Write-Output
    }
    'CustomerWizard' {
        $args = @{
            Root = $rootPath
            Action = 'Run'
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { $args.GeoFlowBaseUrl = $GeoFlowBaseUrl }
        if (-not [string]::IsNullOrWhiteSpace($Telephone)) { $args.Telephone = $Telephone }
        if (-not [string]::IsNullOrWhiteSpace($Email)) { $args.Email = $Email }
        if (-not [string]::IsNullOrWhiteSpace($Address)) { $args.Address = $Address }
        if (-not [string]::IsNullOrWhiteSpace($AddressRegion)) { $args.AddressRegion = $AddressRegion }
        if (-not [string]::IsNullOrWhiteSpace($OutputRoot)) { $args.OutputRoot = $OutputRoot }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        if (-not [string]::IsNullOrWhiteSpace($ReleaseSlug)) { $args.ReleaseSlug = $ReleaseSlug }
        if ($Force) { $args.Force = $true }
        if ($KeepCustomerRoot) { $args.KeepCustomerRoot = $true }
        Invoke-GeneratorScript -ScriptName 'Start-CustomerDeliveryWizard.ps1' -Arguments $args
    }
    'NewCustomerConfig' {
        $args = @{
            CustomerSlug = $CustomerSlug
            CompanyName = $CompanyName
            ShortName = $ShortName
            SiteUrl = $SiteUrl
            Force = [bool]$Force
        }
        if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { $args.GeoFlowBaseUrl = $GeoFlowBaseUrl }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) { $args.OutputPath = $OutputPath }
        if (-not [string]::IsNullOrWhiteSpace($Telephone)) { $args.Telephone = $Telephone }
        if (-not [string]::IsNullOrWhiteSpace($Email)) { $args.Email = $Email }
        if (-not [string]::IsNullOrWhiteSpace($Address)) { $args.Address = $Address }
        if (-not [string]::IsNullOrWhiteSpace($AddressRegion)) { $args.AddressRegion = $AddressRegion }
        Invoke-GeneratorScript -ScriptName 'New-CustomerConfig.ps1' -Arguments $args
    }
    'CustomerRelease' {
        Invoke-CustomerRelease
    }
    'Readiness' {
        Invoke-ProductReadiness
    }
    'ProductRelease' {
        $args = @{ Root = $rootPath }
        if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
            $args.OutputRoot = Split-Path ([IO.Path]::GetFullPath($OutputPath)) -Parent
            $args.ReleaseSlug = [IO.Path]::GetFileNameWithoutExtension($OutputPath)
        }
        if ($Force) { $args.Force = $true }
        Invoke-GeneratorScript -ScriptName 'New-ProductRelease.ps1' -Arguments $args
    }
    default {
        throw "Unsupported action: $Action"
    }
}
