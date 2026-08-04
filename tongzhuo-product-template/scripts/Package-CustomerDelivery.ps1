[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path

$manifestPath = Join-Path $rootPath 'customer-manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "customer-manifest.json not found. Run scripts/New-Customer.ps1 first, then package that customer instance."
}

$customerManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$product = & (Join-Path $PSScriptRoot 'Read-ProductMetadata.ps1') -Root $rootPath
$customerSlug = if ($customerManifest.customer_slug) { [string] $customerManifest.customer_slug } else { 'customer' }
$safeSlug = ($customerSlug -replace '[^a-zA-Z0-9-]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeSlug)) {
    $safeSlug = 'customer'
}
$siteUrlNormalized = ([string] $customerManifest.site_url).TrimEnd('/')
$geoflowBaseUrlNormalized = ([string] $customerManifest.geoflow_base_url).TrimEnd('/')
$desktopAgentPort = if ($null -ne $customerManifest.desktop_agent_port) { [int] $customerManifest.desktop_agent_port } else { 18280 }

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $distRoot = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $distRoot "$safeSlug-tongzhuo-geo-delivery-$stamp.zip"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $resolvedOutput -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-delivery-' + [guid]::NewGuid().ToString('N'))
$deliveryRoot = Join-Path $stagingRoot "$safeSlug-tongzhuo-geo-delivery"
$packagesRoot = Join-Path $deliveryRoot 'packages'
New-Item -ItemType Directory -Force -Path $packagesRoot | Out-Null

function Compress-Directory {
    param(
        [Parameter(Mandatory = $true)] [string]$Source,
        [Parameter(Mandatory = $true)] [string]$Destination
    )

    if (Test-Path $Destination) {
        Remove-Item -LiteralPath $Destination -Force
    }
    Compress-Archive -Path $Source -DestinationPath $Destination -Force
}

function Get-PackageIntegrity {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$RelativePath
    )

    $item = Get-Item -LiteralPath $Path
    $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
    return @{
        path = $RelativePath
        sha256 = $hash.Hash.ToLowerInvariant()
        bytes = [int64] $item.Length
    }
}

try {
    $serverPackage = Join-Path $packagesRoot "$safeSlug-geoflow-server-overrides.zip"
    $desktopPackage = Join-Path $packagesRoot "$safeSlug-desktop-publisher-agent.zip"
    $websitePackage = Join-Path $packagesRoot "$safeSlug-ai-readable-website.zip"

    & (Join-Path $rootPath 'scripts\Package-GeoFlowServer.ps1') -Root $rootPath -OutputPath $serverPackage
    & (Join-Path $rootPath 'scripts\Package-DesktopAgent.ps1') -Root $rootPath -OutputPath $desktopPackage -IncludeEmptyConfig

    & (Join-Path $rootPath 'scripts\Package-Website.ps1') -Root $rootPath -OutputPath $websitePackage

    Copy-Item -LiteralPath (Join-Path $rootPath 'docs') -Destination (Join-Path $deliveryRoot 'docs') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $rootPath 'scripts\Start-CustomerDelivery.ps1') -Destination (Join-Path $deliveryRoot 'Start-CustomerDelivery.ps1') -Force
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $deliveryRoot 'customer-manifest.json') -Force
    Copy-Item -LiteralPath (Join-Path $rootPath 'product.json') -Destination (Join-Path $deliveryRoot 'product.json') -Force

    $readmeLines = @(
        "# $($customerManifest.short_name) Tongzhuo GEO Growth Suite Delivery",
        '',
        '## Included',
        '',
        "- packages/$safeSlug-geoflow-server-overrides.zip: GEOFlow server override package",
        "- packages/$safeSlug-desktop-publisher-agent.zip: Windows desktop publisher agent",
        "- packages/$safeSlug-ai-readable-website.zip: AI-readable website static package",
        '- docs/: product blueprint, publisher protocol, server deployment guide, and delivery checklist',
        '- Start-CustomerDelivery.ps1: one entrypoint for summary, launchpad, verification, preflight reports, onboarding kits, 30-day operating plans, sales kits, success reviews, service scopes, product manuals, operator quickstarts, go-live checklists, publishing-loop acceptance, publishing-loop dry runs, operations evidence packs, install commands, desktop preparation, acceptance reports, support bundles, and rollback guidance',
        '- LAUNCHPAD.md: first page for implementation, customer operators, sales, customer success, and support',
        '- IMPLEMENTATION-PLAN.md: staged implementation plan for server, desktop, content, acceptance, and rollback',
        '- DEPLOYMENT-PROFILE.json and DEPLOYMENT-PROFILE.md: customer deployment identity, package integrity, commands, and support boundary',
        '- customer-manifest.json: customer instance metadata',
        '- delivery-manifest.json: package manifest',
        '',
        '## First Command',
        '',
        'Run this from the extracted delivery folder:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action LaunchPad',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
        '.\Start-CustomerDelivery.ps1 -Action OnboardingKit',
        '.\Start-CustomerDelivery.ps1 -Action OperatingPlan',
        '.\Start-CustomerDelivery.ps1 -Action SalesKit',
        '.\Start-CustomerDelivery.ps1 -Action SuccessReview',
        '.\Start-CustomerDelivery.ps1 -Action ServiceScope',
        '.\Start-CustomerDelivery.ps1 -Action ProductManual',
        '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart',
        '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
        '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack',
        '```',
        '',
        '## Recommended Rollout',
        '',
        '1. Run .\Start-CustomerDelivery.ps1 -Action PreflightReport and resolve blocked checks before touching the server.',
        '2. Generate .\Start-CustomerDelivery.ps1 -Action OnboardingKit and confirm roles, training agenda, first-week plan, and acceptance targets with the customer.',
        '3. Generate .\Start-CustomerDelivery.ps1 -Action OperatingPlan and use it as the first 30-day GEO operations calendar.',
        '4. Generate .\Start-CustomerDelivery.ps1 -Action SalesKit when sales, customer success, or renewal teams need a reusable demo and discovery script.',
        '5. Generate .\Start-CustomerDelivery.ps1 -Action SuccessReview after the first month to summarize evidence, risks, next-month plan, and renewal discussion.',
        '6. Generate .\Start-CustomerDelivery.ps1 -Action ServiceScope to confirm included scope, out-of-scope items, responsibilities, acceptance criteria, and change-control boundaries.',
        '7. Generate .\Start-CustomerDelivery.ps1 -Action ProductManual when customer operators need a readable product, workflow, endpoint, and metric guide.',
        '8. Generate .\Start-CustomerDelivery.ps1 -Action OperatorQuickstart when the customer operator needs a short daily publishing checklist.',
        '9. Generate .\Start-CustomerDelivery.ps1 -Action GoLiveChecklist before production launch to coordinate backup, server deployment, website AI verification, desktop publisher setup, publishing loop, lead capture, rollback, and signoff.',
        '10. Generate .\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance to verify the website, distribution, publisher device, desktop agent, and result-writeback loop.',
        '11. Generate .\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun to simulate article payload, desktop job claim, result API payload, and GEOFlow writeback before touching real platforms.',
        '12. Generate .\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack to prepare the reusable operations proof checklist for article, AI exposure, distribution, desktop publisher, platform result, and operator closeout evidence.',
        '13. Run .\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand, then execute the generated dry-run command on the Linux server.',
        '14. Deploy the GEOFlow server override package with docs/SERVER-DEPLOYMENT.md.',
        '15. Run .\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand, then execute the generated verification command on the Linux server.',
        '16. Open /geo_admin/publisher-assistant and initialize the default desktop publisher channel.',
        '17. Run the desktop preflight command on the Windows operator computer, then install the Windows desktop publisher agent.',
        '18. Configure GEOFlow base URL and API Token in the local desktop agent, log in to supported platforms locally, then publish one article to verify the queue loop.',
        '19. Generate acceptance evidence with .\Start-CustomerDelivery.ps1 -Action AcceptanceReport.',
        '20. Generate a support bundle with .\Start-CustomerDelivery.ps1 -Action SupportBundle when implementation or customer support needs a sanitized diagnostic record.',
        '21. For upgrades, generate an upgrade plan with .\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>.',
        '',
        '## Security Boundary',
        '',
        'This delivery package does not include third-party platform passwords, cookies, verification data, browser profiles, or customer API tokens.'
    )
    $readme = $readmeLines -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'README.md') -Value $readme -Encoding UTF8

    $handoffLines = @(
        "# $($customerManifest.short_name) Delivery Handoff",
        '',
        'This file is the first operational checklist for the customer delivery package. Use it before handing the package to implementation, support, or the customer operator.',
        '',
        '## First Actions',
        '',
        '1. Run package verification from this folder:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action LaunchPad',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '```',
        '',
        '2. Generate the preflight report and resolve blocked checks before touching the server:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
        '```',
        '',
        '3. Generate the customer onboarding kit and confirm responsibilities with the customer:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action OnboardingKit',
        '```',
        '',
        '4. Generate the first 30-day operating plan:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action OperatingPlan',
        '```',
        '',
        '5. Generate the customer sales kit for demo, discovery, and renewal handoff:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action SalesKit',
        '```',
        '',
        '6. Generate the customer success review after the first month:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action SuccessReview',
        '```',
        '',
        '7. Generate the customer service scope and boundary document:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServiceScope',
        '```',
        '',
        '8. Generate the customer product manual:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ProductManual',
        '```',
        '',
        '9. Generate the operator quickstart:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart',
        '```',
        '',
        '10. Generate the go-live checklist before production launch:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist',
        '```',
        '',
        '11. Generate the publishing-loop acceptance document:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
        '```',
        '',
        '12. Generate the publishing loop dry-run fixture before touching real platform accounts:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
        '```',
        '',
        '13. Generate the operations evidence pack for reusable customer proof and support handoff:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack',
        '```',
        '',
        '14. Generate the server dry-run command and execute it on the Linux server:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        '15. After dry-run passes, generate the server install command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        '16. Deploy the GEOFlow server override package on the Linux server, then open the GEOFlow admin publisher assistant page.',
        '17. Generate and execute the server verification command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        '18. Prepare and install the Windows desktop publisher agent on the operator computer:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PrepareDesktop',
        '```',
        '',
        'Then run the generated desktop preflight command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand',
        '```',
        '',
        'After preflight passes, configure the desktop agent with the customer GEOFlow base URL and API Token, register the device, log in to platforms locally, and publish one test article.',
        '',
        'Generate the customer acceptance report before handoff sign-off:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport',
        '```',
        '',
        'Generate a sanitized support bundle for support or implementation escalation:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action SupportBundle',
        '```',
        '',
        'For an existing customer upgrade, generate the upgrade plan before changing the server:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>',
        '```',
        '',
        '## Customer URLs',
        '',
        "- Website: $($customerManifest.site_url)",
        "- GEOFlow: $($customerManifest.geoflow_base_url)",
        '',
        '## Setup Checklist',
        '',
        '- GEOFlow override package deployed and Laravel caches cleared.',
        '- Database migrations completed unless deployment intentionally used skip-migrate.',
        '- Publisher assistant menu opens inside GEOFlow admin.',
        '- Desktop publisher agent installed on a Windows operator computer.',
        '- Desktop agent API Token configured after deployment, not before packaging.',
        '- Publisher device appears online in GEOFlow.',
        '- At least one target platform is logged in locally on the operator computer.',
        '- One test article has been published to the website and sent to the desktop publishing queue.',
        '',
        '## Support Collection',
        '',
        'When the customer reports that publishing does not work, collect these items first:',
        '',
        '1. Screenshot of the GEOFlow distribution task result.',
        '2. Screenshot of the publisher device status in GEOFlow.',
        '3. Desktop agent support report exported from the local diagnostics page.',
        '4. The delivery package version and SHA256 from DELIVERY-SUMMARY.md.',
        '5. The platform name, login status, and whether captcha or risk verification appeared.',
        '',
        '## Security Boundary',
        '',
        'This package must not contain platform passwords, cookies, browser profiles, API Tokens, .env files, node_modules, logs, or temporary files. Platform login remains on the local operator computer.'
    )
    $handoff = $handoffLines -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'HANDOFF.md') -Value $handoff -Encoding UTF8

    $implementationPlanLines = @(
        "# $($customerManifest.short_name) Implementation Plan",
        '',
        "Customer: $($customerManifest.company_name)",
        "Website: $($customerManifest.site_url)",
        "GEOFlow: $($customerManifest.geoflow_base_url)",
        "Product version: $($product.version)",
        '',
        '## Phase 1 - Package Verification and Preflight',
        '',
        'Run these commands from the extracted delivery folder before touching the customer server:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action Summary',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
        '.\Start-CustomerDelivery.ps1 -Action OnboardingKit',
        '.\Start-CustomerDelivery.ps1 -Action OperatingPlan',
        '.\Start-CustomerDelivery.ps1 -Action SalesKit',
        '.\Start-CustomerDelivery.ps1 -Action SuccessReview',
        '.\Start-CustomerDelivery.ps1 -Action ServiceScope',
        '.\Start-CustomerDelivery.ps1 -Action ProductManual',
        '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart',
        '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
        '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack',
        '```',
        '',
        'Expected result: package versions, SHA256 hashes, file sizes, required documents, URL planning, desktop port planning, deployment profile, desktop package preflight entry, customer onboarding plan, 30-day operating plan, sales kit, success review template, service scope, product manual, operator quickstart, go-live checklist, publishing-loop acceptance, publishing-loop dry-run fixture, and operations evidence pack are ready. A stopped local desktop agent may appear as a warning before installation.',
        '',
        '## Phase 2 - Server Dry Run',
        '',
        'Generate the Linux dry-run command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        'Run the generated command on the Linux server. It must finish without copying files, running migrations, or clearing caches.',
        '',
        '## Phase 3 - Server Install',
        '',
        'Back up the GEOFlow database and Laravel project, then generate the install command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        'Run the generated command on the Linux server only after the dry run and backup are confirmed.',
        '',
        '## Phase 4 - Server Verification',
        '',
        'Generate the post-install verification command:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        'Run the generated command on the Linux server. It checks required files, routes, and optional URL health.',
        '',
        '## Phase 5 - Desktop Publisher Agent',
        '',
        'Prepare the desktop package and run preflight on the Windows operator computer:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PrepareDesktop',
        '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand',
        '```',
        '',
        'After preflight passes, install the desktop agent, configure GEOFlow base URL and API Token locally, then register the device.',
        '',
        '## Phase 6 - Content Loop Acceptance',
        '',
        'Confirm these workflows:',
        '',
        '- GEOFlow can publish one article to the website.',
        '- The website exposes the article through the page, sitemap, RSS, llms.txt, and llms-full.txt.',
        '- GEOFlow can create one desktop publisher task.',
        '- The Windows desktop agent receives the task and opens at least one supported platform.',
        '- The task result is written back to GEOFlow.',
        '',
        '## Phase 7 - Acceptance Evidence',
        '',
        'Generate acceptance evidence after server and desktop checks:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport',
        '```',
        '',
        'Store the generated JSON and Markdown report with the customer project records.',
        '',
        '## Phase 8 - Support Bundle',
        '',
        'When implementation or customer support needs a sanitized diagnostic package, run:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action SupportBundle',
        '```',
        '',
        'The generated JSON and Markdown files include package integrity, required document checks, local desktop health probe status, endpoint references, and support collection instructions. They do not include API Tokens, platform passwords, cookies, browser profiles, screenshots, or verification codes.',
        '',
        '## Upgrade Path',
        '',
        'For existing customers, generate an upgrade plan before changing the server:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>',
        '```',
        '',
        '## Rollback',
        '',
        'Before install, review rollback guidance:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action RollbackGuide',
        '```',
        '',
        'Do not proceed without a database backup, a Laravel project backup, and a known previous desktop agent package for existing customers.',
        '',
        '## Security Rules',
        '',
        '- Do not write platform passwords or cookies into GEOFlow.',
        '- Do not place customer API Tokens inside this delivery package.',
        '- Keep third-party platform login on the Windows operator computer.',
        '- Do not upload browser profiles or desktop `.data` folders to the server.'
    )
    $implementationPlan = $implementationPlanLines -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'IMPLEMENTATION-PLAN.md') -Value $implementationPlan -Encoding UTF8

    $deliveryManifest = @{
        product = [string] $product.product
        version = [string] $product.version
        customer_slug = $safeSlug
        company_name = [string] $customerManifest.company_name
        site_url = $siteUrlNormalized
        geoflow_base_url = $geoflowBaseUrlNormalized
        publisher_port = [int] $customerManifest.publisher_port
        desktop_agent_port = $desktopAgentPort
        packaged_at = (Get-Date).ToUniversalTime().ToString('o')
        packages = @{
            geoflow_server_overrides = "packages/$safeSlug-geoflow-server-overrides.zip"
            desktop_publisher_agent = "packages/$safeSlug-desktop-publisher-agent.zip"
            ai_readable_website = "packages/$safeSlug-ai-readable-website.zip"
        }
        package_integrity = @{
            geoflow_server_overrides = Get-PackageIntegrity -Path $serverPackage -RelativePath "packages/$safeSlug-geoflow-server-overrides.zip"
            desktop_publisher_agent = Get-PackageIntegrity -Path $desktopPackage -RelativePath "packages/$safeSlug-desktop-publisher-agent.zip"
            ai_readable_website = Get-PackageIntegrity -Path $websitePackage -RelativePath "packages/$safeSlug-ai-readable-website.zip"
        }
        security = @{
            publisher_credentials_stay_local = $true
            excludes_tokens = $true
            excludes_browser_profiles = $true
            excludes_node_modules = $true
        }
    }
    $deliveryManifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $deliveryRoot 'delivery-manifest.json') -Encoding UTF8

    $deploymentProfile = [ordered]@{
        profile_type = 'tongzhuo_customer_deployment_profile'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $product.product
        version = [string] $product.version
        customer = [ordered]@{
            slug = $safeSlug
            company_name = [string] $customerManifest.company_name
            short_name = [string] $customerManifest.short_name
            site_url = $siteUrlNormalized
            geoflow_base_url = $geoflowBaseUrlNormalized
            geoflow_admin_path = 'geo_admin'
            publisher_port = [int] $customerManifest.publisher_port
            desktop_agent_port = $desktopAgentPort
            telephone = [string] $customerManifest.telephone
            email = [string] $customerManifest.email
        }
        endpoints = [ordered]@{
            website_home = $siteUrlNormalized
            ai_llms = "$siteUrlNormalized/llms.txt"
            ai_llms_full = "$siteUrlNormalized/llms-full.txt"
            sitemap = "$siteUrlNormalized/sitemap.xml"
            rss = "$siteUrlNormalized/feed.xml"
            admin_home = "$geoflowBaseUrlNormalized/geo_admin"
            publisher_assistant = "$geoflowBaseUrlNormalized/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowBaseUrlNormalized/geo_admin/publisher-devices"
            distribution = "$geoflowBaseUrlNormalized/geo_admin/distribution"
            contact_leads = "$geoflowBaseUrlNormalized/geo_admin/contact-leads"
            desktop_health = "http://127.0.0.1:$desktopAgentPort/healthz"
        }
        packages = $deliveryManifest.package_integrity
        commands = [ordered]@{
            launchpad = '.\Start-CustomerDelivery.ps1 -Action LaunchPad'
            verify_delivery = '.\Start-CustomerDelivery.ps1 -Action Verify'
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            onboarding_kit = '.\Start-CustomerDelivery.ps1 -Action OnboardingKit'
            operating_plan = '.\Start-CustomerDelivery.ps1 -Action OperatingPlan'
            sales_kit = '.\Start-CustomerDelivery.ps1 -Action SalesKit'
            success_review = '.\Start-CustomerDelivery.ps1 -Action SuccessReview'
            service_scope = '.\Start-CustomerDelivery.ps1 -Action ServiceScope'
            product_manual = '.\Start-CustomerDelivery.ps1 -Action ProductManual'
            operator_quickstart = '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart'
            go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            operations_evidence_pack = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            server_dry_run = '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
            server_install = '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow'
            server_verify = '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow'
            prepare_desktop = '.\Start-CustomerDelivery.ps1 -Action PrepareDesktop'
            desktop_preflight = '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
            upgrade_plan = '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>'
            rollback_guide = '.\Start-CustomerDelivery.ps1 -Action RollbackGuide'
        }
        support_boundary = [ordered]@{
            platform_credentials_stay_local = $true
            server_stores_platform_passwords = $false
            delivery_contains_api_tokens = $false
            delivery_contains_browser_profiles = $false
            public_website_shows_prices = $false
        }
    }
    $deploymentProfile | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $deliveryRoot 'DEPLOYMENT-PROFILE.json') -Encoding UTF8

    $profilePackageRows = @(
        "| GEOFlow server overrides | $($deploymentProfile.packages.geoflow_server_overrides.path) | $($deploymentProfile.packages.geoflow_server_overrides.bytes) | $($deploymentProfile.packages.geoflow_server_overrides.sha256) |",
        "| Desktop publisher agent | $($deploymentProfile.packages.desktop_publisher_agent.path) | $($deploymentProfile.packages.desktop_publisher_agent.bytes) | $($deploymentProfile.packages.desktop_publisher_agent.sha256) |",
        "| AI-readable website | $($deploymentProfile.packages.ai_readable_website.path) | $($deploymentProfile.packages.ai_readable_website.bytes) | $($deploymentProfile.packages.ai_readable_website.sha256) |"
    )
    $deploymentProfileMarkdown = @(
        "# $($customerManifest.short_name) Deployment Profile",
        '',
        "Product: $($deploymentProfile.product)",
        "Version: $($deploymentProfile.version)",
        "Customer: $($deploymentProfile.customer.company_name)",
        "Website: $($deploymentProfile.customer.site_url)",
        "GEOFlow: $($deploymentProfile.customer.geoflow_base_url)",
        "Admin path: $($deploymentProfile.customer.geoflow_admin_path)",
        "Desktop health: $($deploymentProfile.endpoints.desktop_health)",
        '',
        '## Key Endpoints',
        '',
        "| Name | URL |",
        "| --- | --- |",
        "| Website | $($deploymentProfile.endpoints.website_home) |",
        "| llms.txt | $($deploymentProfile.endpoints.ai_llms) |",
        "| llms-full.txt | $($deploymentProfile.endpoints.ai_llms_full) |",
        "| Sitemap | $($deploymentProfile.endpoints.sitemap) |",
        "| RSS | $($deploymentProfile.endpoints.rss) |",
        "| Admin | $($deploymentProfile.endpoints.admin_home) |",
        "| Publisher assistant | $($deploymentProfile.endpoints.publisher_assistant) |",
        "| Publisher devices | $($deploymentProfile.endpoints.publisher_devices) |",
        "| Distribution | $($deploymentProfile.endpoints.distribution) |",
        "| Contact leads | $($deploymentProfile.endpoints.contact_leads) |",
        '',
        '## Package Integrity',
        '',
        '| Component | Path | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $profilePackageRows + @(
        '',
        '## Operational Commands',
        '',
        '```powershell',
        $deploymentProfile.commands.launchpad,
        $deploymentProfile.commands.verify_delivery,
        $deploymentProfile.commands.preflight_report,
        $deploymentProfile.commands.onboarding_kit,
        $deploymentProfile.commands.operating_plan,
        $deploymentProfile.commands.sales_kit,
        $deploymentProfile.commands.success_review,
        $deploymentProfile.commands.service_scope,
        $deploymentProfile.commands.product_manual,
        $deploymentProfile.commands.operator_quickstart,
        $deploymentProfile.commands.go_live_checklist,
        $deploymentProfile.commands.publishing_loop_acceptance,
        $deploymentProfile.commands.publishing_loop_dry_run,
        $deploymentProfile.commands.operations_evidence_pack,
        $deploymentProfile.commands.server_dry_run,
        $deploymentProfile.commands.server_install,
        $deploymentProfile.commands.server_verify,
        $deploymentProfile.commands.prepare_desktop,
        $deploymentProfile.commands.desktop_preflight,
        $deploymentProfile.commands.acceptance_report,
        $deploymentProfile.commands.support_bundle,
        $deploymentProfile.commands.upgrade_plan,
        $deploymentProfile.commands.rollback_guide,
        '```',
        '',
        '## Support Boundary',
        '',
        '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
        '- The delivery package does not contain API Tokens.',
        '- The public website must not show service prices.',
        '- Use DEPLOYMENT-PROFILE.json for customer project archiving and support lookup.'
    )
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'DEPLOYMENT-PROFILE.md') -Value ($deploymentProfileMarkdown -join [Environment]::NewLine) -Encoding UTF8

    $launchPadLines = @(
        "# $($customerManifest.short_name) Delivery LaunchPad",
        '',
        "Product: $($deploymentProfile.product)",
        "Version: $($deploymentProfile.version)",
        "Customer: $($deploymentProfile.customer.company_name)",
        "Website: $($deploymentProfile.customer.site_url)",
        "GEOFlow: $($deploymentProfile.customer.geoflow_base_url)",
        "Desktop health: $($deploymentProfile.endpoints.desktop_health)",
        '',
        '## Start Here',
        '',
        'Run the LaunchPad generator when implementation needs a timestamped JSON and Markdown handoff record:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action LaunchPad',
        '```',
        '',
        'Then run the minimum pre-server checks:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
        '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow',
        '```',
        '',
        '## Key Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |',
        "| Website | $($deploymentProfile.endpoints.website_home) |",
        "| GEOFlow admin | $($deploymentProfile.endpoints.admin_home) |",
        "| Publisher assistant | $($deploymentProfile.endpoints.publisher_assistant) |",
        "| Publisher devices | $($deploymentProfile.endpoints.publisher_devices) |",
        "| Distribution | $($deploymentProfile.endpoints.distribution) |",
        "| Contact leads | $($deploymentProfile.endpoints.contact_leads) |",
        "| llms.txt | $($deploymentProfile.endpoints.ai_llms) |",
        "| llms-full.txt | $($deploymentProfile.endpoints.ai_llms_full) |",
        "| Sitemap | $($deploymentProfile.endpoints.sitemap) |",
        "| Feed | $($deploymentProfile.endpoints.rss) |",
        "| Desktop health | $($deploymentProfile.endpoints.desktop_health) |",
        '',
        '## Role Paths',
        '',
        '| Role | Start Here | First Command |',
        '| --- | --- | --- |',
        '| Implementation | IMPLEMENTATION-PLAN.md | .\Start-CustomerDelivery.ps1 -Action Verify |',
        '| Customer operator | docs/CUSTOMER-OPERATOR-QUICKSTART.md | .\Start-CustomerDelivery.ps1 -Action OperatorQuickstart |',
        '| Customer success | docs/CUSTOMER-SUCCESS-REVIEW.md | .\Start-CustomerDelivery.ps1 -Action SuccessReview |',
        '| Sales | docs/CUSTOMER-SALES-KIT.md | .\Start-CustomerDelivery.ps1 -Action SalesKit |',
        '| Support | docs/OPERATIONS-RUNBOOK.md | .\Start-CustomerDelivery.ps1 -Action SupportBundle |',
        '',
        '## Launch Day Commands',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow',
        '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow',
        '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand',
        '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist',
        '```',
        '',
        '## Publishing Loop Commands',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
        '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack',
        '```',
        '',
        '## Handoff Commands',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport',
        '.\Start-CustomerDelivery.ps1 -Action SupportBundle',
        '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>',
        '```',
        '',
        '## Acceptance Definition',
        '',
        '- Website article can be published and appears in sitemap, feed, llms.txt, and llms-full.txt.',
        '- GEOFlow distribution task can be created for a desktop publisher channel.',
        '- Desktop agent can register, claim a job, and write back per-platform results.',
        '- Lead capture page can submit data and contact leads can be viewed in GEOFlow.',
        '- Acceptance report and operations evidence pack are generated and archived.',
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Token is configured after deployment and is not included in this package.',
        '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
        '- Server-side GEOFlow coordinates content, devices, tasks, leads, and result records; it does not store third-party platform passwords.',
        '- Support does not bypass third-party captcha or risk controls.'
    )
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'LAUNCHPAD.md') -Value ($launchPadLines -join [Environment]::NewLine) -Encoding UTF8

    $integrity = $deliveryManifest.package_integrity
    $summaryLines = @(
        "# $($customerManifest.short_name) Delivery Summary",
        '',
        "Product: $($deliveryManifest.product)",
        "Version: $($deliveryManifest.version)",
        "Customer: $($deliveryManifest.company_name)",
        "Site URL: $($deliveryManifest.site_url)",
        "GEOFlow URL: $($deliveryManifest.geoflow_base_url)",
        "Packaged at: $($deliveryManifest.packaged_at)",
        '',
        '## Component Packages',
        '',
        '| Component | Path | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |',
        "| GEOFlow server overrides | $($integrity.geoflow_server_overrides.path) | $($integrity.geoflow_server_overrides.bytes) | $($integrity.geoflow_server_overrides.sha256) |",
        "| Desktop publisher agent | $($integrity.desktop_publisher_agent.path) | $($integrity.desktop_publisher_agent.bytes) | $($integrity.desktop_publisher_agent.sha256) |",
        "| AI-readable website | $($integrity.ai_readable_website.path) | $($integrity.ai_readable_website.bytes) | $($integrity.ai_readable_website.sha256) |",
        '',
        '## Verification',
        '',
        'Run this command from the extracted delivery folder:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action Verify',
        '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
        '.\Start-CustomerDelivery.ps1 -Action OnboardingKit',
        '.\Start-CustomerDelivery.ps1 -Action OperatingPlan',
        '.\Start-CustomerDelivery.ps1 -Action SalesKit',
        '.\Start-CustomerDelivery.ps1 -Action SuccessReview',
        '.\Start-CustomerDelivery.ps1 -Action ServiceScope',
        '.\Start-CustomerDelivery.ps1 -Action ProductManual',
        '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart',
        '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
        '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
        '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack',
        '```',
        '',
        'Verification checks package versions, SHA256 hashes, file sizes, and required delivery documents. Preflight also checks URL planning, desktop port planning, deployment profile, desktop package preflight entry, command readiness, and local desktop health as a non-blocking warning before installation. OnboardingKit creates the customer kickoff plan, training agenda, first-week cadence, and acceptance targets. OperatingPlan creates the first 30-day GEO operations calendar. SalesKit creates a reusable demo, discovery, proof, and objection-handling package without prices. SuccessReview creates the first-month evidence, metric, risk, next-month, and renewal discussion template. ServiceScope creates included scope, out-of-scope, responsibility, acceptance, and change-control boundaries. ProductManual creates a customer-readable guide for modules, workflows, roles, endpoints, first steps, and success metrics. OperatorQuickstart creates the daily operator flow. GoLiveChecklist coordinates backup, deployment, website AI verification, desktop publisher setup, publishing-loop validation, lead capture, rollback readiness, and customer signoff. PublishingLoopAcceptance verifies the website, distribution, publisher device, desktop agent, and result-writeback loop. PublishingLoopDryRun simulates the article payload, desktop publisher claim, result payload, per-platform results, and GEOFlow writeback without real platform credentials. OperationsEvidencePack creates the reusable proof checklist for article, AI exposure, distribution, desktop publisher, platform result, operator closeout, and support-boundary evidence.',
        '',
        'For support escalation, generate a sanitized support bundle:',
        '',
        '```powershell',
        '.\Start-CustomerDelivery.ps1 -Action SupportBundle',
        '```',
        '',
        '## Security Boundary',
        '',
        'This package excludes API tokens, third-party platform credentials, browser profiles, node_modules, runtime logs, and temporary files.'
    )
    $summary = $summaryLines -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $deliveryRoot 'DELIVERY-SUMMARY.md') -Value $summary -Encoding UTF8

    if (Test-Path $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }
    Compress-Archive -Path $deliveryRoot -DestinationPath $resolvedOutput -Force

    & (Join-Path $rootPath 'scripts\Test-CustomerDeliveryPackage.ps1') -PackagePath $resolvedOutput -ExpectedVersion ([string] $product.version)
    if ($LASTEXITCODE -ne 0) {
        throw "Customer delivery package validation failed with exit code $LASTEXITCODE"
    }
} finally {
    if (Test-Path $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Customer delivery package created: $resolvedOutput"
