[CmdletBinding()]
param(
    [ValidateSet('Plan', 'Run')]
    [string]$Action = 'Plan',
    [string]$Root = '',
    [string]$OutputRoot = '',
    [string]$OutputPath = '',
    [string]$ReleaseSlug = '',
    [Parameter(Mandatory = $true)] [string]$CustomerSlug,
    [Parameter(Mandatory = $true)] [string]$CompanyName,
    [Parameter(Mandatory = $true)] [string]$ShortName,
    [Parameter(Mandatory = $true)] [string]$SiteUrl,
    [string]$GeoFlowBaseUrl = '',
    [string]$Telephone = '',
    [string]$Email = '',
    [string]$Address = '',
    [string]$AddressRegion = '',
    [switch]$Force,
    [switch]$KeepCustomerRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$version = [string] $product.version

function Get-SafeSlug {
    param([Parameter(Mandatory = $true)] [string]$Value)
    $safe = ($Value -replace '[^a-zA-Z0-9-]', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($safe)) {
        throw "Cannot create a safe slug from: $Value"
    }
    return $safe
}

function Resolve-WizardRoot {
    if (-not [string]::IsNullOrWhiteSpace($OutputRoot)) {
        $resolved = [IO.Path]::GetFullPath($OutputRoot)
    } else {
        $resolved = Join-Path (Join-Path $rootPath 'dist\customer-wizard') (Get-SafeSlug -Value $CustomerSlug)
    }
    New-Item -ItemType Directory -Force -Path $resolved | Out-Null
    return $resolved
}

function Write-WizardArtifacts {
    param(
        [Parameter(Mandatory = $true)] [string]$WizardRoot,
        [Parameter(Mandatory = $true)] [string]$ConfigPath,
        [string]$ReleaseRoot = '',
        [string]$ManifestPath = '',
        [string]$DeliveryPackage = '',
        [string]$ValidationReport = '',
        [string]$ChecksumFile = '',
        [string]$HandoffChecklist = '',
        [string]$FirstTwoStagesPilotChecklist = '',
        [string]$FirstTwoStagesPilotChecklistJson = '',
        [string]$ArchiveIndex = '',
        [string]$ArchiveIndexMarkdown = '',
        [string]$ConfigReview = '',
        [string]$ReleaseSummary = '',
        [string]$ReleaseNotes = '',
        [Parameter(Mandatory = $true)] [string]$Status
    )

    $safeCustomerSlug = Get-SafeSlug -Value $CustomerSlug
    $effectiveReleaseSlug = if ([string]::IsNullOrWhiteSpace($ReleaseSlug)) {
        "$safeCustomerSlug-tongzhuo-geo-delivery-v$version"
    } else {
        Get-SafeSlug -Value $ReleaseSlug
    }

    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        $resolvedOutputPath = Join-Path $WizardRoot "$effectiveReleaseSlug-WIZARD.json"
    } else {
        $resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
        New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
    }
    $markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

    function Resolve-WizardArtifactPath {
        param(
            [string]$Path,
            [Parameter(Mandatory = $true)] [string]$DefaultFile
        )

        if (-not [string]::IsNullOrWhiteSpace($Path)) {
            return $Path
        }
        if (-not [string]::IsNullOrWhiteSpace($ReleaseRoot)) {
            return (Join-Path $ReleaseRoot $DefaultFile)
        }
        return ''
    }

    function New-WizardArtifact {
        param(
            [Parameter(Mandatory = $true)] [string]$Key,
            [Parameter(Mandatory = $true)] [string]$Label,
            [Parameter(Mandatory = $true)] [string]$Purpose,
            [string]$Path = '',
            [Parameter(Mandatory = $true)] [string]$Audience,
            [bool]$RequiredForRun = $true
        )

        $artifactStatus = if (-not [string]::IsNullOrWhiteSpace($Path) -and (Test-Path $Path)) {
            'ready'
        } elseif ($Status -eq 'planned') {
            'planned'
        } elseif ($RequiredForRun) {
            'missing'
        } else {
            'optional'
        }

        return [ordered]@{
            key = $Key
            label = $Label
            purpose = $Purpose
            audience = $Audience
            path = $Path
            status = $artifactStatus
            required_for_run = $RequiredForRun
        }
    }

    $artifactDefaults = [ordered]@{
        delivery_package = Resolve-WizardArtifactPath -Path $DeliveryPackage -DefaultFile "$effectiveReleaseSlug.zip"
        validation_report = Resolve-WizardArtifactPath -Path $ValidationReport -DefaultFile "$effectiveReleaseSlug-validation.json"
        checksum_file = Resolve-WizardArtifactPath -Path $ChecksumFile -DefaultFile "$effectiveReleaseSlug.sha256"
        handoff_checklist = Resolve-WizardArtifactPath -Path $HandoffChecklist -DefaultFile "$effectiveReleaseSlug-HANDOFF-CHECKLIST.md"
        first_two_stages_pilot_checklist = Resolve-WizardArtifactPath -Path $FirstTwoStagesPilotChecklist -DefaultFile "$effectiveReleaseSlug-FIRST-TWO-STAGES-PILOT.md"
        first_two_stages_pilot_checklist_json = Resolve-WizardArtifactPath -Path $FirstTwoStagesPilotChecklistJson -DefaultFile "$effectiveReleaseSlug-FIRST-TWO-STAGES-PILOT.json"
        archive_index = Resolve-WizardArtifactPath -Path $ArchiveIndex -DefaultFile "$effectiveReleaseSlug-archive-index.json"
        archive_index_markdown = Resolve-WizardArtifactPath -Path $ArchiveIndexMarkdown -DefaultFile "$effectiveReleaseSlug-archive-index.md"
        config_review = Resolve-WizardArtifactPath -Path $ConfigReview -DefaultFile "$effectiveReleaseSlug-CONFIG-REVIEW.md"
        release_summary = Resolve-WizardArtifactPath -Path $ReleaseSummary -DefaultFile "$effectiveReleaseSlug-DELIVERY-RELEASE-SUMMARY.md"
        release_notes = Resolve-WizardArtifactPath -Path $ReleaseNotes -DefaultFile "$effectiveReleaseSlug-DELIVERY-RELEASE-NOTES.md"
    }

    $deliveryArtifacts = @(
        New-WizardArtifact -Key 'customer_config' -Label 'Customer config' -Purpose 'Customer identity, website, GEOFlow, ports, and empty API Token boundary.' -Path $ConfigPath -Audience 'implementation'
        New-WizardArtifact -Key 'delivery_package' -Label 'Customer delivery zip' -Purpose 'Installable customer package for server overrides, website, desktop agent, docs, and verification entrypoints.' -Path $artifactDefaults.delivery_package -Audience 'customer_handoff'
        New-WizardArtifact -Key 'release_manifest' -Label 'Release manifest' -Purpose 'Machine-readable release record for version, customer, endpoints, package hash, and evidence files.' -Path $ManifestPath -Audience 'implementation'
        New-WizardArtifact -Key 'validation_report' -Label 'Validation report' -Purpose 'Proof that config validation, package generation, and package validation passed.' -Path $artifactDefaults.validation_report -Audience 'internal_delivery'
        New-WizardArtifact -Key 'checksum_file' -Label 'SHA256 checksum' -Purpose 'Package integrity record for pre-handoff and archive verification.' -Path $artifactDefaults.checksum_file -Audience 'customer_handoff'
        New-WizardArtifact -Key 'config_review' -Label 'Config review' -Purpose 'Endpoint, contact completeness, service scope, and launch warning review.' -Path $artifactDefaults.config_review -Audience 'implementation'
        New-WizardArtifact -Key 'release_summary' -Label 'Release summary' -Purpose 'Human-readable release summary with checks, artifact sizes, and security boundary.' -Path $artifactDefaults.release_summary -Audience 'customer_handoff'
        New-WizardArtifact -Key 'release_notes' -Label 'Release notes' -Purpose 'Customer-facing deployment phases, acceptance commands, endpoints, and release evidence.' -Path $artifactDefaults.release_notes -Audience 'customer_handoff'
        New-WizardArtifact -Key 'handoff_checklist' -Label 'Handoff checklist' -Purpose 'Launch and customer signoff checklist for implementation, operations, and support.' -Path $artifactDefaults.handoff_checklist -Audience 'customer_handoff'
        New-WizardArtifact -Key 'first_two_stages_pilot_checklist' -Label 'First two stages pilot checklist' -Purpose 'Pilot acceptance checklist for website, AI entrypoints, leads, GEOFlow distribution, desktop publisher binding, local platform login boundary, task claiming, and result writeback.' -Path $artifactDefaults.first_two_stages_pilot_checklist -Audience 'pilot_acceptance'
        New-WizardArtifact -Key 'first_two_stages_pilot_checklist_json' -Label 'First two stages pilot checklist JSON' -Purpose 'Machine-readable pilot acceptance checklist for the first two product stages.' -Path $artifactDefaults.first_two_stages_pilot_checklist_json -Audience 'delivery_archive'
        New-WizardArtifact -Key 'archive_index' -Label 'Archive index' -Purpose 'Long-term project archive index for evidence, acceptance commands, and support boundary.' -Path $artifactDefaults.archive_index -Audience 'delivery_archive'
        New-WizardArtifact -Key 'archive_index_markdown' -Label 'Archive index markdown' -Purpose 'Readable project archive index for humans.' -Path $artifactDefaults.archive_index_markdown -Audience 'delivery_archive'
    )

    $wizard = [ordered]@{
        wizard_type = 'tongzhuo_customer_delivery_wizard'
        status = $Status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = $version
        action = $Action
        customer = [ordered]@{
            slug = $safeCustomerSlug
            company_name = $CompanyName
            short_name = $ShortName
            site_url = ([uri]$SiteUrl).AbsoluteUri.TrimEnd('/')
            geoflow_base_url = if ([string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) { 'http://127.0.0.1:18080' } else { ([uri]$GeoFlowBaseUrl).AbsoluteUri.TrimEnd('/') }
            telephone = $Telephone
            email = $Email
            address = $Address
            address_region = $AddressRegion
        }
        paths = [ordered]@{
            wizard_root = $WizardRoot
            config = $ConfigPath
            release_root = $ReleaseRoot
            release_manifest = $ManifestPath
            delivery_package = $DeliveryPackage
            validation_report = $ValidationReport
            checksum_file = $ChecksumFile
            handoff_checklist = $HandoffChecklist
            first_two_stages_pilot_checklist = $artifactDefaults.first_two_stages_pilot_checklist
            first_two_stages_pilot_checklist_json = $artifactDefaults.first_two_stages_pilot_checklist_json
            archive_index = $ArchiveIndex
            archive_index_markdown = $artifactDefaults.archive_index_markdown
            config_review = $artifactDefaults.config_review
            release_summary = $artifactDefaults.release_summary
            release_notes = $artifactDefaults.release_notes
        }
        delivery_artifacts = $deliveryArtifacts
        stages = @(
            [ordered]@{ stage = 'customer_config'; status = if (Test-Path $ConfigPath) { 'ready' } else { 'planned' }; output = $ConfigPath },
            [ordered]@{ stage = 'customer_release'; status = if (-not [string]::IsNullOrWhiteSpace($ManifestPath) -and (Test-Path $ManifestPath)) { 'ready' } else { 'planned' }; output = $ManifestPath },
            [ordered]@{ stage = 'go_live'; status = 'next'; command = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist' },
            [ordered]@{ stage = 'acceptance'; status = 'next'; command = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport' },
            [ordered]@{ stage = 'support_evidence'; status = 'next'; command = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack; .\Start-CustomerDelivery.ps1 -Action SupportBundle' }
        )
        launch_commands = [ordered]@{
            verify_delivery = '.\Start-CustomerDelivery.ps1 -Action Verify'
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            server_dry_run = '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
            go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
            desktop_agent_health = 'Invoke-WebRequest http://127.0.0.1:18280/healthz'
        }
        acceptance_commands = [ordered]@{
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            server_verify = '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
        }
        support_commands = [ordered]@{
            operations_evidence_pack = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
            rollback_guide = '.\Start-CustomerDelivery.ps1 -Action RollbackGuide'
            upgrade_plan = '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>'
        }
        operator_handoff = [ordered]@{
            implementation_owner = 'Server deployment, website package, GEOFlow overrides, desktop agent install, first publishing loop, and acceptance evidence.'
            customer_operator = 'Third-party platform login remains on the local Windows desktop publisher agent; confirm articles and platform result writeback in GEOFlow.'
            customer_success = 'Archive release evidence, monitor first-week publishing tasks, and collect support bundle only after removing customer secrets.'
        }
        sales_handoff = [ordered]@{
            positioning = 'Cloud GEO workbench plus Windows desktop publisher agent for GEO content operations, AI-readable website, lead capture, and semi-automatic multi-platform distribution.'
            proof_points = @('No public service prices in website package.', 'AI-readable files and website articles are first-class delivery artifacts.', 'Platform passwords and captcha state stay on the customer operator computer.', 'Every customer delivery has manifest, checksum, validation report, handoff checklist, and archive index.')
            do_not_promise = @('Pure server-side login to third-party platforms.', 'Bypassing captchas or platform risk controls.', 'Publishing from data center IPs without local operator verification.')
        }
        implementation_checklist = @(
            [ordered]@{ item = 'Confirm release zip and SHA256 before extraction.'; evidence = $artifactDefaults.checksum_file },
            [ordered]@{ item = 'Run delivery verification from the extracted package.'; evidence = '.\Start-CustomerDelivery.ps1 -Action Verify' },
            [ordered]@{ item = 'Run preflight before touching the customer server.'; evidence = '.\Start-CustomerDelivery.ps1 -Action PreflightReport' },
            [ordered]@{ item = 'Install GEOFlow server overrides and website package.'; evidence = '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow' },
            [ordered]@{ item = 'Install and login through the Windows desktop publisher agent.'; evidence = 'http://127.0.0.1:18280/healthz' },
            [ordered]@{ item = 'Publish one website article and confirm AI-readable website outputs.'; evidence = "$(([uri]$SiteUrl).AbsoluteUri.TrimEnd('/'))/llms.txt" },
            [ordered]@{ item = 'Create one distribution task and confirm desktop result writeback.'; evidence = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance' },
            [ordered]@{ item = 'Generate acceptance report and operations evidence pack before signoff.'; evidence = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport' }
        )
        next_actions = @(
            'Extract the customer delivery zip on the implementation workstation.',
            'Run .\Start-CustomerDelivery.ps1 -Action Verify from the extracted package.',
            'Run .\Start-CustomerDelivery.ps1 -Action PreflightReport before touching the server.',
            'Run .\Start-CustomerDelivery.ps1 -Action GoLiveChecklist before production launch.',
            'Deploy server overrides and install the Windows desktop publisher agent.',
            'Publish one website article, create one distribution task, and confirm desktop publisher result writeback.',
            'Run AcceptanceReport and OperationsEvidencePack before customer signoff.'
        )
        security_boundary = [ordered]@{
            public_website_prices_excluded = $true
            geoflow_api_token_empty_before_packaging = $true
            platform_credentials_stay_local = $true
            browser_profiles_excluded = $true
            release_excludes_customer_runtime_data = $true
        }
    }

    $wizard | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

    $stageRows = @($wizard.stages | ForEach-Object {
        $outputProperty = $_.PSObject.Properties['output']
        $commandProperty = $_.PSObject.Properties['command']
        $output = if ($null -ne $outputProperty) { [string] $outputProperty.Value } elseif ($null -ne $commandProperty) { [string] $commandProperty.Value } else { '' }
        "| $($_.stage) | $($_.status) | $output |"
    })
    $pathRows = @($wizard.paths.PSObject.Properties | ForEach-Object {
        "| $($_.Name) | $($_.Value) |"
    })
    $artifactRows = @($wizard.delivery_artifacts | ForEach-Object {
        "| $($_.label) | $($_.status) | $($_.audience) | $($_.path) |"
    })
    $launchRows = @($wizard.launch_commands.PSObject.Properties | ForEach-Object {
        "| $($_.Name) | $($_.Value) |"
    })
    $acceptanceRows = @($wizard.acceptance_commands.PSObject.Properties | ForEach-Object {
        "| $($_.Name) | $($_.Value) |"
    })
    $supportRows = @($wizard.support_commands.PSObject.Properties | ForEach-Object {
        "| $($_.Name) | $($_.Value) |"
    })
    $checklistLines = @($wizard.implementation_checklist | ForEach-Object {
        "- [ ] $($_.item) Evidence: $($_.evidence)"
    })
    $salesProofLines = @($wizard.sales_handoff.proof_points | ForEach-Object { "- $_" })
    $salesBoundaryLines = @($wizard.sales_handoff.do_not_promise | ForEach-Object { "- $_" })
    $nextLines = @($wizard.next_actions | ForEach-Object { "- [ ] $_" })
    $markdown = @(
        "# Tongzhuo Customer Delivery Wizard",
        '',
        "Status: $($wizard.status)",
        "Product: $($wizard.product)",
        "Version: $version",
        "Customer: $($wizard.customer.company_name)",
        "Website: $($wizard.customer.site_url)",
        "GEOFlow: $($wizard.customer.geoflow_base_url)",
        '',
        '## Paths',
        '',
        '| Name | Path |',
        '| --- | --- |'
    ) + $pathRows + @(
        '',
        '## Stages',
        '',
        '| Stage | Status | Output or Command |',
        '| --- | --- | --- |'
    ) + $stageRows + @(
        '',
        '## Delivery Artifacts',
        '',
        '| Artifact | Status | Audience | Path |',
        '| --- | --- | --- | --- |'
    ) + $artifactRows + @(
        '',
        '## Launch Commands',
        '',
        '| Name | Command |',
        '| --- | --- |'
    ) + $launchRows + @(
        '',
        '## Acceptance Commands',
        '',
        '| Name | Command |',
        '| --- | --- |'
    ) + $acceptanceRows + @(
        '',
        '## Support Commands',
        '',
        '| Name | Command |',
        '| --- | --- |'
    ) + $supportRows + @(
        '',
        '## Implementation Checklist',
        ''
    ) + $checklistLines + @(
        '',
        '## Operator Handoff',
        '',
        "- Implementation owner: $($wizard.operator_handoff.implementation_owner)",
        "- Customer operator: $($wizard.operator_handoff.customer_operator)",
        "- Customer success: $($wizard.operator_handoff.customer_success)",
        '',
        '## Sales Handoff',
        '',
        $wizard.sales_handoff.positioning,
        '',
        '### Proof Points',
        ''
    ) + $salesProofLines + @(
        '',
        '### Do Not Promise',
        ''
    ) + $salesBoundaryLines + @(
        '',
        '## Next Actions',
        ''
    ) + $nextLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- GEOFlow API Token must stay empty before packaging.',
        '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- Customer release artifacts exclude runtime data and platform login state.'
    )
    Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    [ordered]@{
        status = $Status
        action = $Action
        wizard = $resolvedOutputPath
        markdown = $markdownPath
        config = $ConfigPath
        release_manifest = $ManifestPath
        delivery_package = $DeliveryPackage
        version = $version
    } | ConvertTo-Json -Depth 4 | Write-Output
}

$wizardRoot = Resolve-WizardRoot
$safeCustomerSlug = Get-SafeSlug -Value $CustomerSlug
$effectiveReleaseSlug = if ([string]::IsNullOrWhiteSpace($ReleaseSlug)) {
    "$safeCustomerSlug-tongzhuo-geo-delivery-v$version"
} else {
    Get-SafeSlug -Value $ReleaseSlug
}
$configRoot = Join-Path $wizardRoot 'configs'
$releaseRoot = Join-Path $wizardRoot 'releases'
$configPath = Join-Path $configRoot "$safeCustomerSlug.json"
$manifestPath = Join-Path $releaseRoot "$effectiveReleaseSlug-manifest.json"

if ($Action -eq 'Plan') {
    Write-WizardArtifacts -WizardRoot $wizardRoot -ConfigPath $configPath -ReleaseRoot $releaseRoot -ManifestPath $manifestPath -Status 'planned'
    return
}

New-Item -ItemType Directory -Force -Path $configRoot | Out-Null
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

$configArgs = @{
    Root = $rootPath
    Action = 'NewCustomerConfig'
    CustomerSlug = $safeCustomerSlug
    CompanyName = $CompanyName
    ShortName = $ShortName
    SiteUrl = $SiteUrl
    OutputPath = $configPath
    Telephone = $Telephone
    Email = $Email
    Address = $Address
    AddressRegion = $AddressRegion
    Force = [bool]$Force
}
if (-not [string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
    $configArgs.GeoFlowBaseUrl = $GeoFlowBaseUrl
}
& (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') @configArgs | Out-Null
if (-not (Test-Path $configPath)) {
    throw "Customer config was not created: $configPath"
}

$releaseArgs = @{
    Root = $rootPath
    Action = 'CustomerRelease'
    ConfigPath = $configPath
    OutputRoot = $releaseRoot
    ReleaseSlug = $effectiveReleaseSlug
    Force = [bool]$Force
}
& (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') @releaseArgs | Out-Null
if (-not (Test-Path $manifestPath)) {
    throw "Customer release manifest was not created: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$deliveryPackage = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryPackage)) {
    $deliveryPackage = [string] $manifest.delivery_package.path
}
if (-not [IO.Path]::IsPathRooted($deliveryPackage)) {
    $deliveryPackage = Join-Path $releaseRoot $deliveryPackage
}

Write-WizardArtifacts `
    -WizardRoot $wizardRoot `
    -ConfigPath $configPath `
    -ReleaseRoot $releaseRoot `
    -ManifestPath $manifestPath `
    -DeliveryPackage $deliveryPackage `
    -ValidationReport (Join-Path $releaseRoot "$effectiveReleaseSlug-validation.json") `
    -ChecksumFile (Join-Path $releaseRoot "$effectiveReleaseSlug.sha256") `
    -HandoffChecklist (Join-Path $releaseRoot "$effectiveReleaseSlug-HANDOFF-CHECKLIST.md") `
    -FirstTwoStagesPilotChecklist (Join-Path $releaseRoot "$effectiveReleaseSlug-FIRST-TWO-STAGES-PILOT.md") `
    -FirstTwoStagesPilotChecklistJson (Join-Path $releaseRoot "$effectiveReleaseSlug-FIRST-TWO-STAGES-PILOT.json") `
    -ArchiveIndex (Join-Path $releaseRoot "$effectiveReleaseSlug-archive-index.json") `
    -ArchiveIndexMarkdown (Join-Path $releaseRoot "$effectiveReleaseSlug-archive-index.md") `
    -ConfigReview (Join-Path $releaseRoot "$effectiveReleaseSlug-CONFIG-REVIEW.md") `
    -ReleaseSummary (Join-Path $releaseRoot "$effectiveReleaseSlug-DELIVERY-RELEASE-SUMMARY.md") `
    -ReleaseNotes (Join-Path $releaseRoot "$effectiveReleaseSlug-DELIVERY-RELEASE-NOTES.md") `
    -Status 'ready'
