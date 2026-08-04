[CmdletBinding()]
param(
    [ValidateSet('Summary', 'LaunchPad', 'Verify', 'PreflightReport', 'OnboardingKit', 'OperatingPlan', 'SalesKit', 'SuccessReview', 'ServiceScope', 'ProductManual', 'OperatorQuickstart', 'GoLiveChecklist', 'PublishingLoopAcceptance', 'PublishingLoopDryRun', 'OperationsEvidencePack', 'OperationsBundle', 'ServerDryRunCommand', 'ServerInstallCommand', 'ServerVerifyCommand', 'PrepareDesktop', 'DesktopPreflightCommand', 'InstallDesktop', 'RollbackGuide', 'AcceptanceReport', 'UpgradePlan', 'SupportBundle')]
    [string]$Action = 'Summary',
    [string]$DeliveryRoot = '',
    [string]$LaravelRoot = '/www/wwwroot/geoflow',
    [string]$DesktopOutputPath = '',
    [string]$AcceptanceOutputPath = '',
    [string]$LaunchPadOutputPath = '',
    [string]$PreflightOutputPath = '',
    [string]$OnboardingOutputPath = '',
    [string]$OperatingPlanOutputPath = '',
    [string]$SalesKitOutputPath = '',
    [string]$SuccessReviewOutputPath = '',
    [string]$ServiceScopeOutputPath = '',
    [string]$ProductManualOutputPath = '',
    [string]$OperatorQuickstartOutputPath = '',
    [string]$GoLiveOutputPath = '',
    [string]$PublishingLoopOutputPath = '',
    [string]$PublishingLoopDryRunOutputPath = '',
    [string]$OperationsEvidenceOutputPath = '',
    [string]$UpgradeOutputPath = '',
    [string]$SupportOutputPath = '',
    [string]$CurrentVersion = '',
    [switch]$SkipMigrate,
    [switch]$StartDesktopAfterInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($DeliveryRoot)) {
    $DeliveryRoot = (Resolve-Path (Join-Path $PSScriptRoot '.')).Path
} else {
    $DeliveryRoot = (Resolve-Path $DeliveryRoot).Path
}

$manifestPath = Join-Path $DeliveryRoot 'delivery-manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "delivery-manifest.json not found. Run this script from the extracted customer delivery package."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedVersion = [string] $manifest.version
$desktopAgentPort = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 18280 }

function Resolve-PackagePath {
    param([Parameter(Mandatory = $true)] [string]$RelativePath)
    $fullPath = Join-Path $DeliveryRoot ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $fullPath)) {
        throw "Package not found: $RelativePath"
    }
    return (Resolve-Path $fullPath).Path
}

function Read-ZipManifest {
    param(
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [string]$ManifestName = 'package-manifest.json'
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $entry = $archive.Entries | Where-Object {
            $normalized = $_.FullName -replace '\\', '/'
            $normalized -eq $ManifestName -or $normalized -like "*/$ManifestName"
        } | Select-Object -First 1
        if (-not $entry) {
            throw "Manifest not found in package: $ZipPath"
        }
        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            return $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Test-PackageVersion {
    param(
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [Parameter(Mandatory = $true)] [string]$Name
    )
    $packageManifest = Read-ZipManifest -ZipPath $ZipPath
    if ([string] $packageManifest.version -ne $expectedVersion) {
        throw "$Name version mismatch. Expected $expectedVersion, got $($packageManifest.version)"
    }
    return $packageManifest
}

function Test-PackageIntegrity {
    param(
        [Parameter(Mandatory = $true)] [string]$Key,
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    if ($null -eq $manifest.package_integrity) {
        return
    }
    $expected = $manifest.package_integrity.$Key
    if ($null -eq $expected) {
        throw "$Name integrity record missing in delivery-manifest.json."
    }

    $item = Get-Item -LiteralPath $ZipPath
    $actualHash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $expectedHash = ([string] $expected.sha256).ToLowerInvariant()
    $expectedBytes = [int64] $expected.bytes
    if ($actualHash -ne $expectedHash) {
        throw "$Name SHA256 mismatch. Expected $expectedHash, got $actualHash"
    }
    if ([int64] $item.Length -ne $expectedBytes) {
        throw "$Name size mismatch. Expected $expectedBytes bytes, got $($item.Length)"
    }
}

function Get-DeliveryPackages {
    $packages = $manifest.packages
    [ordered]@{
        Server = Resolve-PackagePath ([string] $packages.geoflow_server_overrides)
        Desktop = Resolve-PackagePath ([string] $packages.desktop_publisher_agent)
        Website = Resolve-PackagePath ([string] $packages.ai_readable_website)
    }
}

function Write-Summary {
    $packages = Get-DeliveryPackages
    Write-Host "Tongzhuo GEO Growth Suite delivery"
    Write-Host "Customer: $($manifest.company_name)"
    Write-Host "Version:  $expectedVersion"
    Write-Host "Site:     $($manifest.site_url)"
    Write-Host "GEOFlow:  $($manifest.geoflow_base_url)"
    Write-Host ''
    Write-Host 'Packages:'
    Write-Host "  Server:  $($packages.Server)"
    Write-Host "  Desktop: $($packages.Desktop)"
    Write-Host "  Website: $($packages.Website)"
    Write-Host ''
    Write-Host 'Common actions:'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action LaunchPad'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action Verify'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action PreflightReport'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action OnboardingKit'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action OperatingPlan'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action SalesKit'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action SuccessReview'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action ServiceScope'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action ProductManual'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action OperatorQuickstart'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action PrepareDesktop'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action OperationsBundle'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action SupportBundle'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion 1.6.1'
    Write-Host '  .\Start-CustomerDelivery.ps1 -Action RollbackGuide'
}

function New-LaunchPad {
    $packages = Get-DeliveryPackages
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')

    $packageInventory = @(
        [ordered]@{ component = 'GEOFlow server overrides'; path = $packages.Server; purpose = 'Install the GEOFlow workbench menus, publisher device APIs, distribution task writeback, and lead-management entrypoints.' },
        [ordered]@{ component = 'Windows desktop publisher agent'; path = $packages.Desktop; purpose = 'Run platform login, captcha/risk verification, browser state, article filling, and result writeback on the operator computer.' },
        [ordered]@{ component = 'AI-readable website'; path = $packages.Website; purpose = 'Deploy the public website, articles, sitemap, feed, llms.txt, and llms-full.txt for search engines and AI crawlers.' }
    )
    $packageInventory = @($packageInventory | ForEach-Object {
        $item = Get-Item -LiteralPath $_.path
        [ordered]@{
            component = $_.component
            file = Split-Path $_.path -Leaf
            path = $_.path
            purpose = $_.purpose
            sha256 = (Get-FileHash -LiteralPath $_.path -Algorithm SHA256).Hash.ToLowerInvariant()
            bytes = [int64] $item.Length
        }
    })

    $launchPad = [ordered]@{
        launchpad_type = 'tongzhuo_customer_delivery_launchpad'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer = [ordered]@{
            slug = [string] $manifest.customer_slug
            company_name = [string] $manifest.company_name
            site_url = $siteUrl
            geoflow_base_url = $geoflowUrl
            desktop_agent_port = $desktopAgentPort
        }
        endpoints = [ordered]@{
            website = $siteUrl
            geoflow_admin = "$geoflowUrl/geo_admin"
            publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            distribution = "$geoflowUrl/geo_admin/distribution"
            contact_leads = "$geoflowUrl/geo_admin/contact-leads"
            llms_txt = "$siteUrl/llms.txt"
            llms_full = "$siteUrl/llms-full.txt"
            sitemap = "$siteUrl/sitemap.xml"
            feed = "$siteUrl/feed.xml"
            desktop_health = "http://127.0.0.1:$desktopAgentPort/healthz"
        }
        package_inventory = $packageInventory
        role_paths = @(
            [ordered]@{ role = 'implementation'; start_here = 'IMPLEMENTATION-PLAN.md'; first_command = '.\Start-CustomerDelivery.ps1 -Action Verify'; outcome = 'Server, website, desktop agent, launch checks, and acceptance evidence are installed and verified.' },
            [ordered]@{ role = 'customer_operator'; start_here = 'docs/CUSTOMER-OPERATOR-QUICKSTART.md'; first_command = '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart'; outcome = 'Daily article publishing, desktop publisher status, and platform result writeback become repeatable.' },
            [ordered]@{ role = 'customer_success'; start_here = 'docs/CUSTOMER-SUCCESS-REVIEW.md'; first_command = '.\Start-CustomerDelivery.ps1 -Action SuccessReview'; outcome = 'First-month evidence, risks, renewal discussion, and next-month plan are archived.' },
            [ordered]@{ role = 'sales'; start_here = 'docs/CUSTOMER-SALES-KIT.md'; first_command = '.\Start-CustomerDelivery.ps1 -Action SalesKit'; outcome = 'Demo, discovery, proof points, objections, and non-price proposal narrative are ready.' },
            [ordered]@{ role = 'support'; start_here = 'docs/OPERATIONS-RUNBOOK.md'; first_command = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'; outcome = 'Sanitized troubleshooting evidence can be collected without platform credentials or browser profiles.' }
        )
        command_groups = [ordered]@{
            before_server = @(
                '.\Start-CustomerDelivery.ps1 -Action Verify',
                '.\Start-CustomerDelivery.ps1 -Action LaunchPad',
                '.\Start-CustomerDelivery.ps1 -Action PreflightReport',
                '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
            )
            launch_day = @(
                '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow',
                '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow',
                '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand',
                '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
            )
            publishing_loop = @(
                '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun',
                '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance',
                '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            )
            handoff = @(
                '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport',
                '.\Start-CustomerDelivery.ps1 -Action SupportBundle',
                '.\Start-CustomerDelivery.ps1 -Action UpgradePlan -CurrentVersion <current-version>'
            )
        }
        first_90_minutes = @(
            [ordered]@{ minute = '00-10'; owner = 'implementation'; action = 'Verify package integrity and open LAUNCHPAD.md.'; evidence = '.\Start-CustomerDelivery.ps1 -Action Verify' },
            [ordered]@{ minute = '10-25'; owner = 'implementation'; action = 'Generate preflight report and server dry-run command.'; evidence = '.\Start-CustomerDelivery.ps1 -Action PreflightReport' },
            [ordered]@{ minute = '25-45'; owner = 'server_operator'; action = 'Run server dry-run, confirm backup path, then install server overrides.'; evidence = '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow' },
            [ordered]@{ minute = '45-60'; owner = 'customer_operator'; action = 'Prepare desktop agent, configure GEOFlow URL and API Token locally, then login platforms locally.'; evidence = '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand' },
            [ordered]@{ minute = '60-75'; owner = 'content_operator'; action = 'Publish one website article and confirm AI-readable endpoints.'; evidence = "$siteUrl/llms.txt" },
            [ordered]@{ minute = '75-90'; owner = 'implementation'; action = 'Create one distribution task and confirm desktop result writeback.'; evidence = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance' }
        )
        ai_and_geo_outputs = @(
            "$siteUrl/llms.txt",
            "$siteUrl/llms-full.txt",
            "$siteUrl/sitemap.xml",
            "$siteUrl/feed.xml",
            "$siteUrl/insights.html"
        )
        acceptance_definition = @(
            'Website article can be published and appears in sitemap/feed/AI-readable files.',
            'GEOFlow distribution task can be created for a desktop publisher channel.',
            'Desktop agent can register, claim a job, and write back per-platform results.',
            'Lead capture page can submit data and contact leads can be viewed in GEOFlow.',
            'Acceptance report and operations evidence pack are generated and archived.'
        )
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_token_not_in_package = $true
            platform_credentials_stay_local = $true
            browser_profiles_not_in_package = $true
            server_does_not_store_platform_passwords = $true
            support_does_not_bypass_captcha_or_risk_controls = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($LaunchPadOutputPath)) {
        $launchRoot = Join-Path $DeliveryRoot 'launchpad'
        New-Item -ItemType Directory -Force -Path $launchRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $LaunchPadOutputPath = Join-Path $launchRoot "launchpad-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($LaunchPadOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $launchPad | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $packageRows = @($launchPad.package_inventory | ForEach-Object {
        "| $($_.component) | $($_.file) | $($_.bytes) | $($_.sha256) |"
    })
    $roleRows = @($launchPad.role_paths | ForEach-Object {
        "| $($_.role) | $($_.start_here) | $($_.first_command) | $($_.outcome) |"
    })
    $timelineRows = @($launchPad.first_90_minutes | ForEach-Object {
        "| $($_.minute) | $($_.owner) | $($_.action) | $($_.evidence) |"
    })
    $endpointRows = @($launchPad.endpoints.PSObject.Properties | ForEach-Object {
        "| $($_.Name) | $($_.Value) |"
    })
    $beforeServerLines = @($launchPad.command_groups.before_server | ForEach-Object { $_ })
    $launchDayLines = @($launchPad.command_groups.launch_day | ForEach-Object { $_ })
    $publishingLoopLines = @($launchPad.command_groups.publishing_loop | ForEach-Object { $_ })
    $handoffLines = @($launchPad.command_groups.handoff | ForEach-Object { $_ })
    $acceptanceLines = @($launchPad.acceptance_definition | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo Customer Delivery LaunchPad",
        '',
        "Status: $($launchPad.status)",
        "Product: $($launchPad.product)",
        "Version: $($launchPad.version)",
        "Customer: $($launchPad.customer.company_name)",
        "Website: $($launchPad.customer.site_url)",
        "GEOFlow: $($launchPad.customer.geoflow_base_url)",
        '',
        '## Start Here',
        '',
        'Run these commands from the extracted customer delivery folder:',
        '',
        '```powershell'
    ) + $beforeServerLines + @(
        '```',
        '',
        '## Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Package Inventory',
        '',
        '| Component | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $packageRows + @(
        '',
        '## Role Paths',
        '',
        '| Role | Start Here | First Command | Outcome |',
        '| --- | --- | --- | --- |'
    ) + $roleRows + @(
        '',
        '## Launch Day Commands',
        '',
        '```powershell'
    ) + $launchDayLines + @(
        '```',
        '',
        '## Publishing Loop Commands',
        '',
        '```powershell'
    ) + $publishingLoopLines + @(
        '```',
        '',
        '## Handoff Commands',
        '',
        '```powershell'
    ) + $handoffLines + @(
        '```',
        '',
        '## First 90 Minutes',
        '',
        '| Time | Owner | Action | Evidence |',
        '| --- | --- | --- | --- |'
    ) + $timelineRows + @(
        '',
        '## Acceptance Definition',
        ''
    ) + $acceptanceLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Token is configured after deployment and is not included in this package.',
        '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
        '- Server-side GEOFlow coordinates content, devices, tasks, leads, and result records; it does not store third-party platform passwords.',
        '- Support does not bypass third-party captcha or risk controls.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "LaunchPad created: $resolvedJsonOutput"
    Write-Host "LaunchPad summary created: $resolvedMarkdownOutput"
}

function Invoke-Verify {
    $packages = Get-DeliveryPackages
    Test-PackageVersion -ZipPath $packages.Server -Name 'Server package' | Out-Null
    Test-PackageVersion -ZipPath $packages.Desktop -Name 'Desktop package' | Out-Null
    Test-PackageVersion -ZipPath $packages.Website -Name 'Website package' | Out-Null
    Test-PackageIntegrity -Key 'geoflow_server_overrides' -ZipPath $packages.Server -Name 'Server package'
    Test-PackageIntegrity -Key 'desktop_publisher_agent' -ZipPath $packages.Desktop -Name 'Desktop package'
    Test-PackageIntegrity -Key 'ai_readable_website' -ZipPath $packages.Website -Name 'Website package'
    foreach ($doc in @('docs/SERVER-DEPLOYMENT.md', 'docs/CUSTOMER-RELEASE-PROCESS.md', 'docs/CUSTOMER-ACCEPTANCE-PROCESS.md', 'docs/CUSTOMER-ONBOARDING-PROCESS.md', 'docs/CUSTOMER-OPERATING-PLAN.md', 'docs/CUSTOMER-SALES-KIT.md', 'docs/CUSTOMER-SUCCESS-REVIEW.md', 'docs/CUSTOMER-SERVICE-SCOPE.md', 'docs/CUSTOMER-PRODUCT-MANUAL.md', 'docs/CUSTOMER-OPERATOR-QUICKSTART.md', 'docs/CUSTOMER-GO-LIVE-CHECKLIST.md', 'docs/CUSTOMER-PUBLISHING-LOOP.md', 'docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md', 'docs/CUSTOMER-UPGRADE-PROCESS.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/OPERATIONS-RUNBOOK.md', 'README.md', 'LAUNCHPAD.md', 'DELIVERY-SUMMARY.md', 'HANDOFF.md', 'IMPLEMENTATION-PLAN.md', 'DEPLOYMENT-PROFILE.json', 'DEPLOYMENT-PROFILE.md')) {
        $path = Join-Path $DeliveryRoot ($doc -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path $path)) {
            throw "Required delivery document missing: $doc"
        }
    }
    Write-Host "Delivery package verification passed. Version: $expectedVersion"
}

function Write-ServerInstallCommand {
    $packages = Get-DeliveryPackages
    $serverPackageName = Split-Path $packages.Server -Leaf
    $skip = if ($SkipMigrate) { ' --skip-migrate' } else { '' }
    Write-Host 'Run these commands on the Linux server after uploading the server package:'
    Write-Host ''
    Write-Host "mkdir -p /tmp/tongzhuo-geoflow && unzip -o $serverPackageName -d /tmp/tongzhuo-geoflow"
    Write-Host "cd /tmp/tongzhuo-geoflow/tongzhuo-geoflow-server-overrides"
    Write-Host "bash deployment/install-geoflow-overrides.sh --laravel-root $LaravelRoot --package-root .${skip}"
}

function Write-ServerVerifyCommand {
    $packages = Get-DeliveryPackages
    $serverPackageName = Split-Path $packages.Server -Leaf
    $baseUrl = ([string] $manifest.site_url).TrimEnd('/')
    $adminPath = 'geo_admin'
    Write-Host 'Run these commands on the Linux server after installing the server package:'
    Write-Host ''
    Write-Host "mkdir -p /tmp/tongzhuo-geoflow && unzip -o $serverPackageName -d /tmp/tongzhuo-geoflow"
    Write-Host "cd /tmp/tongzhuo-geoflow/tongzhuo-geoflow-server-overrides"
    Write-Host "bash deployment/verify-geoflow-overrides.sh --laravel-root $LaravelRoot --base-url $baseUrl --admin-path $adminPath"
}

function Write-ServerDryRunCommand {
    $packages = Get-DeliveryPackages
    $serverPackageName = Split-Path $packages.Server -Leaf
    $skip = if ($SkipMigrate) { ' --skip-migrate' } else { '' }
    Write-Host 'Run these commands on the Linux server before the real install:'
    Write-Host ''
    Write-Host "mkdir -p /tmp/tongzhuo-geoflow && unzip -o $serverPackageName -d /tmp/tongzhuo-geoflow"
    Write-Host "cd /tmp/tongzhuo-geoflow/tongzhuo-geoflow-server-overrides"
    Write-Host "bash deployment/install-geoflow-overrides.sh --laravel-root $LaravelRoot --package-root .${skip} --dry-run"
}

function Expand-DesktopPackage {
    $packages = Get-DeliveryPackages
    if ([string]::IsNullOrWhiteSpace($DesktopOutputPath)) {
        $DesktopOutputPath = Join-Path $DeliveryRoot 'desktop-agent-install'
    }
    if (Test-Path $DesktopOutputPath) {
        Remove-Item -LiteralPath $DesktopOutputPath -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $DesktopOutputPath | Out-Null
    Expand-Archive -LiteralPath $packages.Desktop -DestinationPath $DesktopOutputPath -Force
    $installer = Get-ChildItem -LiteralPath $DesktopOutputPath -Recurse -File -Filter 'install-desktop.ps1' | Select-Object -First 1
    if (-not $installer) {
        throw 'install-desktop.ps1 not found in desktop package.'
    }
    Write-Host "Desktop package prepared: $DesktopOutputPath"
    Write-Host "Installer: $($installer.FullName)"
    return $installer.FullName
}

function Write-DesktopPreflightCommand {
    $installer = Expand-DesktopPackage
    $agentRoot = Split-Path $installer -Parent
    $preflight = Join-Path $agentRoot 'preflight.ps1'
    if (-not (Test-Path $preflight)) {
        throw 'preflight.ps1 not found in desktop package.'
    }
    Write-Host 'Run this command on the Windows operator computer before installing or starting the desktop agent:'
    Write-Host ''
    Write-Host "powershell -ExecutionPolicy Bypass -File `"$preflight`""
}

function Invoke-InstallDesktop {
    $installer = Expand-DesktopPackage
    $arguments = @('-ExecutionPolicy', 'Bypass', '-File', $installer, '-InstallAutostart')
    if ($StartDesktopAfterInstall) {
        $arguments += '-StartAfterInstall'
    }
    & powershell.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Desktop installer failed with exit code $LASTEXITCODE"
    }
}

function Write-RollbackGuide {
    Write-Host 'Rollback guide:'
    Write-Host ''
    Write-Host '1. Server overrides create timestamped backups under:'
    Write-Host '   storage/app/tongzhuo-backups/geoflow-overrides-YYYYMMDD-HHMMSS'
    Write-Host '2. To roll back, copy files from the chosen backup directory back into the Laravel root.'
    Write-Host '3. Run: php artisan optimize:clear && php artisan route:clear && php artisan view:clear'
    Write-Host '4. Desktop agent rollback: uninstall the current desktop agent, then reinstall the previous desktop package.'
    Write-Host '5. Website rollback: redeploy the previous website static package or previous GEOFlow website templates.'
    Write-Host ''
    Write-Host 'See docs/OPERATIONS-RUNBOOK.md for the complete procedure.'
}

function New-PreflightReport {
    $script:preflightChecks = @()

    function Add-PreflightCheck {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [scriptblock]$Script,
            [ValidateSet('error', 'warn')] [string]$FailureState = 'error'
        )

        $started = Get-Date
        $check = [ordered]@{
            name = $Name
            status = 'running'
            started_at = $started.ToUniversalTime().ToString('o')
            finished_at = $null
            duration_seconds = $null
            message = $null
            error = $null
        }
        try {
            $message = & $Script
            $check.status = 'passed'
            if ($null -ne $message) {
                $check.message = [string] $message
            }
        } catch {
            $check.status = $FailureState
            $check.error = [string] $_.Exception.Message
        } finally {
            $finished = Get-Date
            $check.finished_at = $finished.ToUniversalTime().ToString('o')
            $check.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            $script:preflightChecks += $check
        }
    }

    function Assert-HttpUrl {
        param(
            [Parameter(Mandatory = $true)] [string]$Value,
            [Parameter(Mandatory = $true)] [string]$Name
        )

        if ([string]::IsNullOrWhiteSpace($Value)) {
            throw "$Name is empty."
        }
        $uri = $null
        $isUri = [uri]::TryCreate($Value, [UriKind]::Absolute, [ref] $uri)
        if (-not $isUri -or $uri.Scheme -notin @('http', 'https')) {
            throw "$Name must be an absolute http or https URL: $Value"
        }
        if ($Value.EndsWith('/')) {
            throw "$Name must not end with a slash: $Value"
        }
    }

    $packages = Get-DeliveryPackages
    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    $script:preflightDeploymentProfile = $null
    $packageRecords = [ordered]@{}
    foreach ($entry in @(
        @{ key = 'geoflow_server_overrides'; name = 'GEOFlow server overrides'; path = $packages.Server },
        @{ key = 'desktop_publisher_agent'; name = 'Desktop publisher agent'; path = $packages.Desktop },
        @{ key = 'ai_readable_website'; name = 'AI-readable website'; path = $packages.Website }
    )) {
        $item = Get-Item -LiteralPath $entry.path
        $hash = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash.ToLowerInvariant()
        $packageRecords[$entry.key] = [ordered]@{
            name = $entry.name
            path = $entry.path
            file = Split-Path $entry.path -Leaf
            sha256 = $hash
            bytes = [int64] $item.Length
        }
    }

    Add-PreflightCheck -Name 'customer_urls' -Script {
        Assert-HttpUrl -Value ([string] $manifest.site_url).TrimEnd('/') -Name 'site_url'
        Assert-HttpUrl -Value ([string] $manifest.geoflow_base_url).TrimEnd('/') -Name 'geoflow_base_url'
        'Website and GEOFlow URLs are valid absolute URLs.'
    }
    Add-PreflightCheck -Name 'desktop_port_plan' -Script {
        if ($desktopAgentPort -lt 1024 -or $desktopAgentPort -gt 65535) {
            throw "desktop_agent_port must be between 1024 and 65535. Got $desktopAgentPort."
        }
        if ($null -ne $manifest.publisher_port -and [int] $manifest.publisher_port -eq $desktopAgentPort) {
            throw "desktop_agent_port must differ from publisher_port. Both are $desktopAgentPort."
        }
        "Desktop agent health endpoint planned at http://127.0.0.1:$desktopAgentPort/healthz."
    }
    Add-PreflightCheck -Name 'deployment_profile' -Script {
        if (-not (Test-Path $deploymentProfilePath)) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        $script:preflightDeploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string] $script:preflightDeploymentProfile.profile_type -ne 'tongzhuo_customer_deployment_profile') {
            throw "Deployment profile type mismatch: $($script:preflightDeploymentProfile.profile_type)"
        }
        'Deployment profile loaded.'
    }
    Add-PreflightCheck -Name 'package_versions' -Script {
        Test-PackageVersion -ZipPath $packages.Server -Name 'Server package' | Out-Null
        Test-PackageVersion -ZipPath $packages.Desktop -Name 'Desktop package' | Out-Null
        Test-PackageVersion -ZipPath $packages.Website -Name 'Website package' | Out-Null
        'All component package versions match delivery manifest.'
    }
    Add-PreflightCheck -Name 'package_integrity' -Script {
        Test-PackageIntegrity -Key 'geoflow_server_overrides' -ZipPath $packages.Server -Name 'Server package'
        Test-PackageIntegrity -Key 'desktop_publisher_agent' -ZipPath $packages.Desktop -Name 'Desktop package'
        Test-PackageIntegrity -Key 'ai_readable_website' -ZipPath $packages.Website -Name 'Website package'
        'All component package SHA256 and byte-size checks passed.'
    }
    Add-PreflightCheck -Name 'required_documents' -Script {
        foreach ($doc in @('README.md', 'DELIVERY-SUMMARY.md', 'HANDOFF.md', 'IMPLEMENTATION-PLAN.md', 'DEPLOYMENT-PROFILE.json', 'DEPLOYMENT-PROFILE.md', 'docs/SERVER-DEPLOYMENT.md', 'docs/CUSTOMER-ONBOARDING-PROCESS.md', 'docs/CUSTOMER-OPERATING-PLAN.md', 'docs/CUSTOMER-SALES-KIT.md', 'docs/CUSTOMER-SUCCESS-REVIEW.md', 'docs/CUSTOMER-SERVICE-SCOPE.md', 'docs/CUSTOMER-PRODUCT-MANUAL.md', 'docs/CUSTOMER-OPERATOR-QUICKSTART.md', 'docs/CUSTOMER-GO-LIVE-CHECKLIST.md', 'docs/CUSTOMER-PUBLISHING-LOOP.md', 'docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/OPERATIONS-RUNBOOK.md')) {
            $path = Join-Path $DeliveryRoot ($doc -replace '/', [IO.Path]::DirectorySeparatorChar)
            if (-not (Test-Path $path)) {
                throw "Required preflight document missing: $doc"
            }
        }
        'Required implementation documents are present.'
    }
    Add-PreflightCheck -Name 'desktop_package_preflight_entry' -Script {
        $probeRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-preflight-desktop-' + [guid]::NewGuid().ToString('N'))
        try {
            New-Item -ItemType Directory -Force -Path $probeRoot | Out-Null
            Expand-Archive -LiteralPath $packages.Desktop -DestinationPath $probeRoot -Force
            $preflight = Get-ChildItem -LiteralPath $probeRoot -Recurse -File -Filter 'preflight.ps1' | Select-Object -First 1
            if (-not $preflight) {
                throw 'preflight.ps1 not found in desktop package.'
            }
            'Desktop package contains preflight.ps1.'
        } finally {
            if (Test-Path $probeRoot) {
                Remove-Item -LiteralPath $probeRoot -Recurse -Force
            }
        }
    }
    Add-PreflightCheck -Name 'server_command_generation' -Script {
        $serverPackageName = Split-Path $packages.Server -Leaf
        if ([string]::IsNullOrWhiteSpace($serverPackageName)) {
            throw 'Server package filename is empty.'
        }
        'Server dry-run, install, and verify commands can be generated from the delivery manifest.'
    }
    Add-PreflightCheck -Name 'local_desktop_health' -FailureState 'warn' -Script {
        $healthUrl = "http://127.0.0.1:$desktopAgentPort/healthz"
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
        "Desktop health endpoint responded with HTTP $([int] $response.StatusCode)."
    }

    if ($null -eq $script:preflightDeploymentProfile -and (Test-Path $deploymentProfilePath)) {
        $script:preflightDeploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    $checks = @($script:preflightChecks)
    $errors = @($checks | Where-Object { [string] $_.status -eq 'error' })
    $warnings = @($checks | Where-Object { [string] $_.status -eq 'warn' })
    $status = if ($errors.Count -gt 0) { 'blocked' } elseif ($warnings.Count -gt 0) { 'ready_with_warnings' } else { 'ready' }

    $preflight = [ordered]@{
        report_type = 'tongzhuo_customer_preflight'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
        delivery_root = $DeliveryRoot
        desktop_agent_port = $desktopAgentPort
        endpoints = if ($null -ne $script:preflightDeploymentProfile) { $script:preflightDeploymentProfile.endpoints } else { $null }
        packages = $packageRecords
        checks = $checks
        next_actions = @(
            'Resolve any blocked preflight checks before server installation.',
            'Run ServerDryRunCommand and execute the generated command on the Linux server.',
            'Run DesktopPreflightCommand on the Windows operator computer before installing the desktop agent.',
            'Generate AcceptanceReport after server and desktop validation.'
        )
        security_boundary = [ordered]@{
            excludes_api_tokens = $true
            excludes_platform_passwords = $true
            excludes_cookies = $true
            excludes_browser_profiles = $true
            platform_login_stays_local = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($PreflightOutputPath)) {
        $preflightRoot = Join-Path $DeliveryRoot 'preflight-reports'
        New-Item -ItemType Directory -Force -Path $preflightRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $PreflightOutputPath = Join-Path $preflightRoot "preflight-report-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($PreflightOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $preflight | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $packageRows = @($packageRecords.GetEnumerator() | ForEach-Object {
        $pkg = $_.Value
        "| $($pkg.name) | $($pkg.file) | $($pkg.bytes) | $($pkg.sha256) |"
    })
    $checkRows = @($checks | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.duration_seconds) | $($_.message) | $($_.error) |"
    })
    $nextActionLines = @($preflight.next_actions | ForEach-Object { "1. $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Preflight Report",
        '',
        "Status: $status",
        "Generated at: $($preflight.generated_at)",
        "Customer: $($preflight.company_name)",
        "Version: $expectedVersion",
        "Website: $($preflight.site_url)",
        "GEOFlow: $($preflight.geoflow_base_url)",
        "Desktop health: http://127.0.0.1:$desktopAgentPort/healthz",
        '',
        '## Packages',
        '',
        '| Component | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $packageRows + @(
        '',
        '## Checks',
        '',
        '| Check | Status | Seconds | Message | Error |',
        '| --- | --- | ---: | --- | --- |'
    ) + $checkRows + @(
        '',
        '## Next Actions',
        ''
    ) + $nextActionLines + @(
        '',
        '## Security Boundary',
        '',
        '- This preflight report does not include API Tokens.',
        '- This preflight report does not include platform passwords, cookies, browser profiles, .env files, screenshots, or verification codes.',
        '- Platform login state remains on the operator computer.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Preflight report created: $resolvedJsonOutput"
    Write-Host "Preflight summary created: $resolvedMarkdownOutput"
    if ($status -eq 'blocked') {
        throw "Preflight report contains blocked checks: $resolvedJsonOutput"
    }
}

function New-OnboardingKit {
    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    $deploymentProfile = $null
    if (Test-Path $deploymentProfilePath) {
        $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealthUrl = "http://127.0.0.1:$desktopAgentPort/healthz"
    $endpoints = [ordered]@{
        website = $siteUrl
        geoflow_admin = "$geoflowUrl/geo_admin"
        publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
        publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
        distribution = "$geoflowUrl/geo_admin/distribution"
        contact_leads = "$geoflowUrl/geo_admin/contact-leads"
        llms_txt = "$siteUrl/llms.txt"
        sitemap = "$siteUrl/sitemap.xml"
        feed = "$siteUrl/feed.xml"
        desktop_health = $desktopHealthUrl
    }
    if ($null -ne $deploymentProfile -and $null -ne $deploymentProfile.endpoints) {
        $endpoints.website = [string] $deploymentProfile.endpoints.website_home
        $endpoints.geoflow_admin = [string] $deploymentProfile.endpoints.admin_home
        $endpoints.publisher_assistant = [string] $deploymentProfile.endpoints.publisher_assistant
        $endpoints.publisher_devices = [string] $deploymentProfile.endpoints.publisher_devices
        $endpoints.distribution = [string] $deploymentProfile.endpoints.distribution
        $endpoints.contact_leads = [string] $deploymentProfile.endpoints.contact_leads
        $endpoints.llms_txt = [string] $deploymentProfile.endpoints.ai_llms
        $endpoints.sitemap = [string] $deploymentProfile.endpoints.sitemap
        $endpoints.feed = [string] $deploymentProfile.endpoints.rss
        $endpoints.desktop_health = [string] $deploymentProfile.endpoints.desktop_health
    }

    $kit = [ordered]@{
        kit_type = 'tongzhuo_customer_onboarding'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        desktop_agent_port = $desktopAgentPort
        endpoints = $endpoints
        kickoff_roles = @(
            [ordered]@{ role = 'customer_owner'; responsibility = 'Confirm business goals, domains, contacts, acceptance owner, and final signoff.' },
            [ordered]@{ role = 'content_operator'; responsibility = 'Maintain articles, industry insights, service pages, and weekly publishing cadence.' },
            [ordered]@{ role = 'desktop_operator'; responsibility = 'Keep the Windows desktop agent online and complete platform login or captcha steps locally.' },
            [ordered]@{ role = 'server_engineer'; responsibility = 'Deploy GEOFlow overrides, verify routes, and maintain backups.' },
            [ordered]@{ role = 'implementation_manager'; responsibility = 'Run preflight, coordinate training, record acceptance, and collect support evidence.' }
        )
        readiness_inputs = @(
            'Customer domain and DNS access.',
            'GEOFlow admin account for implementation.',
            'Windows operator computer with Node.js/npm access for the desktop publisher agent.',
            'Platform accounts to be used for publishing, prepared for local login on the operator computer.',
            'Initial service descriptions, target regions, core keywords, and frequently asked customer questions.',
            'Contact receiver for website leads and internal follow-up owner.'
        )
        training_agenda = @(
            'Product boundary: cloud GEOFlow manages content and tasks; desktop agent keeps platform login state local.',
            'Website and AI crawler surfaces: article pages, sitemap, RSS, llms.txt, and llms-full.txt.',
            'Article workflow: draft, review, publish to website, create distribution task, inspect result.',
            'Desktop agent workflow: configure GEOFlow URL and API Token locally, register device, log in platforms, run diagnostics.',
            'Lead workflow: submit contact form, review contact leads, assign follow-up notes.',
            'Support workflow: run PreflightReport, AcceptanceReport, SupportBundle, and collect non-secret evidence.'
        )
        first_week_plan = @(
            [ordered]@{ day = 'Day 1'; focus = 'Install server overrides, run PreflightReport, configure desktop agent, and verify core endpoints.' },
            [ordered]@{ day = 'Day 2'; focus = 'Publish one company profile article and verify website, sitemap, RSS, and llms.txt exposure.' },
            [ordered]@{ day = 'Day 3'; focus = 'Create one distribution task for a supported platform and confirm task result write-back.' },
            [ordered]@{ day = 'Day 4'; focus = 'Train operator on content categories, lead management, and local platform login boundary.' },
            [ordered]@{ day = 'Day 5'; focus = 'Generate AcceptanceReport and define next 30-day content cadence.' }
        )
        acceptance_targets = @(
            'One article is published on the website and visible to AI crawler files.',
            'One desktop publisher task is completed or returns a clear login/manual-action status.',
            'Publisher device appears in GEOFlow with latest heartbeat.',
            'Contact lead page can display a submitted test lead.',
            'Customer understands platform passwords, cookies, captcha, and API Tokens are not included in delivery artifacts.'
        )
        security_boundary = [ordered]@{
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            public_website_prices_excluded = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($OnboardingOutputPath)) {
        $onboardingRoot = Join-Path $DeliveryRoot 'onboarding'
        New-Item -ItemType Directory -Force -Path $onboardingRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $OnboardingOutputPath = Join-Path $onboardingRoot "onboarding-kit-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($OnboardingOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $kit | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $roleRows = @($kit.kickoff_roles | ForEach-Object {
        "| $($_.role) | $($_.responsibility) |  |"
    })
    $inputLines = @($kit.readiness_inputs | ForEach-Object { "- [ ] $_" })
    $agendaLines = @($kit.training_agenda | ForEach-Object { "1. $_" })
    $weekRows = @($kit.first_week_plan | ForEach-Object {
        "| $($_.day) | $($_.focus) |"
    })
    $targetLines = @($kit.acceptance_targets | ForEach-Object { "- [ ] $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Onboarding Kit",
        '',
        "Customer: $($kit.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($kit.generated_at)",
        "Website: $($kit.site_url)",
        "GEOFlow: $($kit.geoflow_base_url)",
        "Desktop health: $($kit.endpoints.desktop_health)",
        '',
        '## Key Endpoints',
        '',
        "| Name | URL |",
        "| --- | --- |",
        "| Website | $($kit.endpoints.website) |",
        "| GEOFlow admin | $($kit.endpoints.geoflow_admin) |",
        "| Publisher assistant | $($kit.endpoints.publisher_assistant) |",
        "| Publisher devices | $($kit.endpoints.publisher_devices) |",
        "| Distribution | $($kit.endpoints.distribution) |",
        "| Contact leads | $($kit.endpoints.contact_leads) |",
        "| llms.txt | $($kit.endpoints.llms_txt) |",
        "| Sitemap | $($kit.endpoints.sitemap) |",
        "| RSS | $($kit.endpoints.feed) |",
        '',
        '## Kickoff Roles',
        '',
        '| Role | Responsibility | Owner |',
        '| --- | --- | --- |'
    ) + $roleRows + @(
        '',
        '## Readiness Inputs',
        ''
    ) + $inputLines + @(
        '',
        '## Training Agenda',
        ''
    ) + $agendaLines + @(
        '',
        '## First Week Plan',
        '',
        '| Day | Focus |',
        '| --- | --- |'
    ) + $weekRows + @(
        '',
        '## Acceptance Targets',
        ''
    ) + $targetLines + @(
        '',
        '## Security Boundary',
        '',
        '- Customer API Tokens are not included in delivery artifacts.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- Public website packages must not contain service prices.',
        '- Use SupportBundle for troubleshooting; do not send third-party platform credentials.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Onboarding kit created: $resolvedJsonOutput"
    Write-Host "Onboarding kit summary created: $resolvedMarkdownOutput"
}

function New-OperatingPlan {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $customerName = [string] $manifest.company_name
    if ($manifest.PSObject.Properties['short_name'] -and -not [string]::IsNullOrWhiteSpace([string] $manifest.short_name)) {
        $shortName = [string] $manifest.short_name
    } else {
        $shortName = [string] $manifest.customer_slug
    }

    $articleTopics = @(
        [ordered]@{ category = 'GEO optimization'; title = "$shortName AI search entity clarity playbook"; intent = 'Explain company entity, service facts, contact points, and machine-readable pages.' },
        [ordered]@{ category = 'GEO optimization'; title = "$shortName service page FAQ, case, and structured-data guide"; intent = 'Build answer-friendly content blocks for AI citation and human trust.' },
        [ordered]@{ category = 'Short video operations'; title = "$shortName short-video account conversion content plan"; intent = 'Connect positioning, scripts, publishing rhythm, and lead capture.' },
        [ordered]@{ category = 'Short video operations'; title = "$shortName customer FAQ to 10 short-video topics"; intent = 'Turn sales objections and FAQs into reusable video hooks.' },
        [ordered]@{ category = 'Enterprise AI landing'; title = "$shortName low-risk enterprise AI landing scenarios"; intent = 'Identify knowledge base, sales material, customer service, and content workflow use cases.' },
        [ordered]@{ category = 'Enterprise AI landing'; title = "$shortName GEOFlow enterprise content asset workflow"; intent = 'Show the workflow from knowledge, draft, review, publish, distribute, and monitor.' }
    )

    $plan = [ordered]@{
        plan_type = 'tongzhuo_customer_30_day_operating_plan'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = $customerName
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        objectives = @(
            'Publish the first batch of AI-readable company and service content.',
            'Create a repeatable weekly article and short-video topic rhythm.',
            'Verify website, sitemap, RSS, llms.txt, and desktop publisher queue coverage.',
            'Capture first lead workflow evidence and support/acceptance records.',
            'Identify one low-risk enterprise AI workflow for follow-up implementation.'
        )
        weekly_plan = @(
            [ordered]@{
                week = 'Week 1'
                theme = 'Foundation and entity clarity'
                actions = @(
                    'Confirm company entity facts, service names, service regions, contact paths, and FAQ source material.',
                    'Publish one company/service foundation article to the website.',
                    'Verify sitemap, RSS, llms.txt, and llms-full.txt expose the new article.',
                    'Run OnboardingKit and assign content, desktop, lead, and server owners.'
                )
                evidence = @('Published website article URL', 'llms.txt entry', 'publisher device heartbeat', 'onboarding kit archive')
            }
            [ordered]@{
                week = 'Week 2'
                theme = 'GEO answer coverage'
                actions = @(
                    'Publish two answer-style industry insight articles.',
                    'Add FAQ and service-fit language that AI systems can quote cleanly.',
                    'Create one distribution task for a supported platform and record the result.',
                    'Review contact lead form and assign internal follow-up owner.'
                )
                evidence = @('Two article URLs', 'distribution job result', 'lead page screenshot or exported record')
            }
            [ordered]@{
                week = 'Week 3'
                theme = 'Short video conversion loop'
                actions = @(
                    'Turn three customer questions into short-video scripts.',
                    'Use the desktop publisher agent or export package to prepare platform drafts.',
                    'Publish or save drafts locally after platform login/captcha is completed by the operator.',
                    'Record which topics generated comments, messages, saves, or consultation intent.'
                )
                evidence = @('Three script drafts', 'desktop task result', 'platform draft or publish status')
            }
            [ordered]@{
                week = 'Week 4'
                theme = 'AI workflow and review'
                actions = @(
                    'Pick one internal AI landing scenario such as sales FAQ, content briefing, or customer-service replies.',
                    'Document the source materials needed for that scenario.',
                    'Generate AcceptanceReport and SupportBundle after the first production loop.',
                    'Review the 30-day evidence and define the next content calendar.'
                )
                evidence = @('AI scenario brief', 'AcceptanceReport', 'SupportBundle', 'next-month content backlog')
            }
        )
        article_topics = $articleTopics
        distribution_cadence = [ordered]@{
            website_articles_per_week = 2
            short_video_scripts_per_week = 3
            desktop_publisher_tasks_per_week = 1
            lead_review_frequency = 'Twice per week'
            ai_crawler_file_check = 'After every website article publish'
        }
        operating_metrics = @(
            'Published article count and article URL list.',
            'Sitemap, RSS, llms.txt, and llms-full.txt update evidence.',
            'Distribution job status: completed, awaiting login, awaiting confirmation, failed, or exported.',
            'Publisher device latest heartbeat.',
            'Lead count, lead source, follow-up status, and notes.',
            'Short-video draft count, publish count, and consultation signals.',
            'Enterprise AI scenario backlog and implementation readiness.'
        )
        review_rhythm = @(
            'Monday: confirm topics and source material.',
            'Wednesday: publish website article and check AI-readable files.',
            'Friday: run distribution task, review leads, and record platform status.',
            'End of month: generate acceptance/support evidence and prepare next-month calendar.'
        )
        security_boundary = [ordered]@{
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            public_website_prices_excluded = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($OperatingPlanOutputPath)) {
        $planRoot = Join-Path $DeliveryRoot 'operating-plans'
        New-Item -ItemType Directory -Force -Path $planRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $OperatingPlanOutputPath = Join-Path $planRoot "30-day-operating-plan-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($OperatingPlanOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $objectiveLines = @($plan.objectives | ForEach-Object { "- $_" })
    $weekSections = @($plan.weekly_plan | ForEach-Object {
        $actionLines = @($_.actions | ForEach-Object { "- [ ] $_" })
        $evidenceLines = @($_.evidence | ForEach-Object { "- $_" })
        @(
            "### $($_.week): $($_.theme)",
            '',
            'Actions:',
            ''
        ) + $actionLines + @(
            '',
            'Evidence:',
            ''
        ) + $evidenceLines + @('')
    })
    $topicRows = @($plan.article_topics | ForEach-Object {
        "| $($_.category) | $($_.title) | $($_.intent) |"
    })
    $metricLines = @($plan.operating_metrics | ForEach-Object { "- $_" })
    $rhythmLines = @($plan.review_rhythm | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite 30-Day Operating Plan",
        '',
        "Customer: $($plan.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($plan.generated_at)",
        "Website: $($plan.site_url)",
        "GEOFlow: $($plan.geoflow_base_url)",
        '',
        '## Objectives',
        ''
    ) + $objectiveLines + @(
        '',
        '## Weekly Plan',
        ''
    ) + $weekSections + @(
        '## Article Topic Backlog',
        '',
        '| Category | Topic | Intent |',
        '| --- | --- | --- |'
    ) + $topicRows + @(
        '',
        '## Distribution Cadence',
        '',
        "- Website articles per week: $($plan.distribution_cadence.website_articles_per_week)",
        "- Short-video scripts per week: $($plan.distribution_cadence.short_video_scripts_per_week)",
        "- Desktop publisher tasks per week: $($plan.distribution_cadence.desktop_publisher_tasks_per_week)",
        "- Lead review frequency: $($plan.distribution_cadence.lead_review_frequency)",
        "- AI crawler file check: $($plan.distribution_cadence.ai_crawler_file_check)",
        '',
        '## Operating Metrics',
        ''
    ) + $metricLines + @(
        '',
        '## Review Rhythm',
        ''
    ) + $rhythmLines + @(
        '',
        '## Security Boundary',
        '',
        '- Customer API Tokens are not included in this operating plan.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- Public website content must not contain service prices.',
        '- Use SupportBundle for troubleshooting; do not send third-party platform credentials.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Operating plan created: $resolvedJsonOutput"
    Write-Host "Operating plan summary created: $resolvedMarkdownOutput"
}

function New-SalesKit {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $customerName = [string] $manifest.company_name
    if ($manifest.PSObject.Properties['short_name'] -and -not [string]::IsNullOrWhiteSpace([string] $manifest.short_name)) {
        $shortName = [string] $manifest.short_name
    } else {
        $shortName = [string] $manifest.customer_slug
    }

    $kit = [ordered]@{
        kit_type = 'tongzhuo_customer_sales_enablement_kit'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = $customerName
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        positioning = [ordered]@{
            one_sentence = "$shortName uses Tongzhuo GEO Growth Suite to connect an AI-readable website, GEOFlow operations workbench, and local desktop publishing agent into one customer acquisition workflow."
            audience = @('business owner', 'marketing director', 'content operator', 'AI transformation owner', 'implementation partner')
            outcomes = @(
                'Make company and service facts easier for AI systems to understand and cite.',
                'Turn GEO articles, short-video topics, and enterprise AI use cases into a repeatable operating rhythm.',
                'Keep third-party platform login and captcha handling on the operator computer while GEOFlow manages content and tasks.',
                'Give sales, delivery, support, and customer operators the same archiveable delivery evidence.'
            )
        }
        service_lines = @(
            [ordered]@{ name = 'GEO optimization'; promise = 'Build machine-readable company, service, article, sitemap, RSS, and llms.txt coverage.'; demo_evidence = @('website article page', 'sitemap.xml', 'feed.xml', 'llms.txt', 'llms-full.txt') },
            [ordered]@{ name = 'Short video operations'; promise = 'Convert customer questions, objections, and service scenes into short-video topics and publishing tasks.'; demo_evidence = @('topic backlog', 'desktop publisher task', 'platform draft or export package') },
            [ordered]@{ name = 'Enterprise AI landing'; promise = 'Identify low-risk workflows such as sales FAQ, content briefing, knowledge base, and customer-service replies.'; demo_evidence = @('operating plan', 'AI scenario brief', 'support bundle evidence') }
        )
        demo_flow = @(
            [ordered]@{ step = 1; title = 'Show the AI-readable website'; talking_point = 'Open the home page, industry insight page, sitemap, RSS, and llms.txt to prove the content is visible to humans and crawlers.' },
            [ordered]@{ step = 2; title = 'Show GEOFlow workbench'; talking_point = 'Open article management, distribution, contact leads, publisher assistant, and publisher devices to show the operating center.' },
            [ordered]@{ step = 3; title = 'Show local desktop publishing boundary'; talking_point = 'Explain that platform login, captcha, cookies, and browser profiles stay on the operator computer.' },
            [ordered]@{ step = 4; title = 'Show the first 30-day operating plan'; talking_point = 'Use the generated OperatingPlan to connect GEO articles, short-video scripts, lead review, and enterprise AI scenarios.' },
            [ordered]@{ step = 5; title = 'Show delivery evidence'; talking_point = 'Open PreflightReport, OnboardingKit, AcceptanceReport, SupportBundle, and release notes to show the customer can be delivered and supported repeatedly.' }
        )
        discovery_questions = @(
            'Which products or services should AI systems understand first?',
            'Which customer questions most often appear before a consultation?',
            'Which platforms already have logged-in operator accounts?',
            'Who owns article review, video topic review, platform publishing, and lead follow-up?',
            'Which internal workflow is low-risk enough for the first enterprise AI landing scenario?',
            'What evidence does the customer need before considering the first month successful?'
        )
        objection_handling = @(
            [ordered]@{ objection = 'Can this directly publish to every platform from the server?'; response = 'No stable product should promise that. The safe architecture keeps login and captcha handling on the Windows operator computer, while GEOFlow manages content, tasks, and result records.' },
            [ordered]@{ objection = 'Will the public website expose service prices?'; response = 'No. Public pages focus on service facts, methods, cases, contact paths, and AI-readable structure. Prices stay out of the public website package.' },
            [ordered]@{ objection = 'What happens when a platform changes its editor page?'; response = 'The desktop agent records clear task status and supports draft/export fallback while adapters are updated.' },
            [ordered]@{ objection = 'Will customer tokens or platform passwords enter the delivery package?'; response = 'No. Delivery packages exclude API Tokens, platform passwords, cookies, browser profiles, logs, node_modules, and temporary files.' }
        )
        proof_points = @(
            'Customer delivery package contains component SHA256 and byte-size records.',
            'PreflightReport checks URL planning, desktop port planning, package integrity, and required documents before implementation.',
            'OnboardingKit aligns roles, accounts, training agenda, and first-week acceptance targets.',
            'OperatingPlan creates a first-month article, short-video, distribution, lead, and AI workflow calendar.',
            'SupportBundle creates sanitized troubleshooting evidence without collecting secrets.'
        )
        next_steps = @(
            'Confirm the primary service line and first-month topic scope.',
            'Generate OnboardingKit and OperatingPlan for the customer.',
            'Run PreflightReport before server deployment.',
            'Complete one website article publish and one desktop publisher task as acceptance evidence.',
            'Archive release notes, handoff checklist, acceptance report, and support bundle with the customer project record.'
        )
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($SalesKitOutputPath)) {
        $kitRoot = Join-Path $DeliveryRoot 'sales-kits'
        New-Item -ItemType Directory -Force -Path $kitRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $SalesKitOutputPath = Join-Path $kitRoot "sales-kit-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($SalesKitOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $kit | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $outcomeLines = @($kit.positioning.outcomes | ForEach-Object { "- $_" })
    $serviceRows = @($kit.service_lines | ForEach-Object {
        "| $($_.name) | $($_.promise) | $([string]::Join(', ', @($_.demo_evidence))) |"
    })
    $demoLines = @($kit.demo_flow | ForEach-Object { "1. $($_.title): $($_.talking_point)" })
    $questionLines = @($kit.discovery_questions | ForEach-Object { "- $_" })
    $objectionRows = @($kit.objection_handling | ForEach-Object {
        "| $($_.objection) | $($_.response) |"
    })
    $proofLines = @($kit.proof_points | ForEach-Object { "- $_" })
    $nextStepLines = @($kit.next_steps | ForEach-Object { "- [ ] $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Sales Kit",
        '',
        "Customer: $($kit.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($kit.generated_at)",
        "Website: $($kit.site_url)",
        "GEOFlow: $($kit.geoflow_base_url)",
        '',
        '## Positioning',
        '',
        $kit.positioning.one_sentence,
        '',
        '## Outcomes',
        ''
    ) + $outcomeLines + @(
        '',
        '## Service Lines',
        '',
        '| Service Line | Promise | Demo Evidence |',
        '| --- | --- | --- |'
    ) + $serviceRows + @(
        '',
        '## Demo Flow',
        ''
    ) + $demoLines + @(
        '',
        '## Discovery Questions',
        ''
    ) + $questionLines + @(
        '',
        '## Objection Handling',
        '',
        '| Objection | Response |',
        '| --- | --- |'
    ) + $objectionRows + @(
        '',
        '## Proof Points',
        ''
    ) + $proofLines + @(
        '',
        '## Next Steps',
        ''
    ) + $nextStepLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this sales kit or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- The server manages content, tasks, device status, leads, and result records; it does not store platform passwords.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Sales kit created: $resolvedJsonOutput"
    Write-Host "Sales kit summary created: $resolvedMarkdownOutput"
}

function New-SuccessReview {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $customerName = [string] $manifest.company_name

    $review = [ordered]@{
        review_type = 'tongzhuo_customer_success_review'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = $customerName
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        review_period = [ordered]@{
            label = 'first_30_days'
            recommended_timing = 'After the first month of website publishing, desktop distribution, lead review, and AI workflow discovery.'
        }
        evidence_checklist = @(
            'Published article URL list from the website.',
            'Sitemap, RSS, llms.txt, and llms-full.txt update evidence.',
            'Distribution task status records from GEOFlow.',
            'Publisher device heartbeat and task result evidence.',
            'Lead list, source, owner, follow-up status, and notes.',
            'Short-video topic backlog, drafts, published posts, or export packages.',
            'Enterprise AI landing scenario notes and source-material readiness.'
        )
        metric_fields = @(
            [ordered]@{ name = 'website_articles_published'; type = 'number'; owner = 'content_operator' },
            [ordered]@{ name = 'ai_crawler_files_verified'; type = 'number'; owner = 'implementation' },
            [ordered]@{ name = 'distribution_tasks_created'; type = 'number'; owner = 'content_operator' },
            [ordered]@{ name = 'distribution_tasks_completed_or_exported'; type = 'number'; owner = 'desktop_operator' },
            [ordered]@{ name = 'qualified_leads_captured'; type = 'number'; owner = 'sales_or_customer_success' },
            [ordered]@{ name = 'short_video_scripts_created'; type = 'number'; owner = 'video_operator' },
            [ordered]@{ name = 'ai_workflow_scenarios_identified'; type = 'number'; owner = 'ai_transformation_owner' }
        )
        service_line_review = @(
            [ordered]@{ service_line = 'GEO optimization'; questions = @('Which articles were published?', 'Which service facts became clearer for AI systems?', 'Which AI-readable endpoints were verified?', 'Which article topics should continue next month?') },
            [ordered]@{ service_line = 'Short video operations'; questions = @('Which customer questions became video topics?', 'Which drafts or posts generated comments, saves, messages, or consultation intent?', 'Which platform accounts need better login or publishing readiness?') },
            [ordered]@{ service_line = 'Enterprise AI landing'; questions = @('Which internal workflow was selected?', 'Which source materials are ready?', 'Which workflow has the lowest implementation risk next month?') }
        )
        risk_review = @(
            [ordered]@{ risk = 'Platform login or captcha blocks publishing.'; response = 'Keep login local, record task status, use draft/export fallback, and schedule adapter updates when needed.' },
            [ordered]@{ risk = 'Published content is not visible to crawlers.'; response = 'Verify sitemap, RSS, llms.txt, llms-full.txt, canonical URLs, and article detail pages after every publish.' },
            [ordered]@{ risk = 'Leads are captured but not followed up.'; response = 'Assign lead owner, follow-up status, next action, and review cadence inside the customer operating rhythm.' },
            [ordered]@{ risk = 'AI landing scope is too broad.'; response = 'Choose one low-risk workflow and define source materials before automation work begins.' }
        )
        next_month_plan = @(
            'Select 6-8 website article topics from proven customer questions and service gaps.',
            'Create 8-12 short-video scripts from the best-performing questions and objections.',
            'Run at least one desktop publisher task per week and record platform status.',
            'Review leads twice per week and attach follow-up notes.',
            'Prototype one low-risk enterprise AI workflow with approved source materials.',
            'Generate SupportBundle when implementation or platform publishing needs troubleshooting evidence.'
        )
        renewal_discussion = @(
            'Confirm which service line produced the clearest evidence.',
            'Confirm which operating bottleneck blocks scale.',
            'Confirm whether the next month should emphasize GEO content, short-video conversion, AI workflow landing, or platform adapter improvement.',
            'Discuss scope and priorities without adding public website prices to the package.'
        )
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($SuccessReviewOutputPath)) {
        $reviewRoot = Join-Path $DeliveryRoot 'success-reviews'
        New-Item -ItemType Directory -Force -Path $reviewRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $SuccessReviewOutputPath = Join-Path $reviewRoot "success-review-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($SuccessReviewOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $review | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $evidenceLines = @($review.evidence_checklist | ForEach-Object { "- [ ] $_" })
    $metricRows = @($review.metric_fields | ForEach-Object {
        "| $($_.name) | $($_.type) | $($_.owner) |  |"
    })
    $serviceSections = @($review.service_line_review | ForEach-Object {
        $questionLines = @($_.questions | ForEach-Object { "- $_" })
        @("### $($_.service_line)", '') + $questionLines + @('')
    })
    $riskRows = @($review.risk_review | ForEach-Object {
        "| $($_.risk) | $($_.response) |"
    })
    $nextMonthLines = @($review.next_month_plan | ForEach-Object { "- [ ] $_" })
    $renewalLines = @($review.renewal_discussion | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Success Review",
        '',
        "Customer: $($review.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($review.generated_at)",
        "Review period: $($review.review_period.label)",
        "Website: $($review.site_url)",
        "GEOFlow: $($review.geoflow_base_url)",
        '',
        '## Evidence Checklist',
        ''
    ) + $evidenceLines + @(
        '',
        '## Metric Fields',
        '',
        '| Metric | Type | Owner | Value |',
        '| --- | --- | --- | --- |'
    ) + $metricRows + @(
        '',
        '## Service Line Review',
        ''
    ) + $serviceSections + @(
        '## Risk Review',
        '',
        '| Risk | Response |',
        '| --- | --- |'
    ) + $riskRows + @(
        '',
        '## Next Month Plan',
        ''
    ) + $nextMonthLines + @(
        '',
        '## Renewal Discussion',
        ''
    ) + $renewalLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this success review or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- Use SupportBundle for troubleshooting; do not send third-party platform credentials.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Success review created: $resolvedJsonOutput"
    Write-Host "Success review summary created: $resolvedMarkdownOutput"
}

function New-ServiceScope {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $customerName = [string] $manifest.company_name

    $scope = [ordered]@{
        scope_type = 'tongzhuo_customer_service_scope'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = $customerName
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        service_lines = @(
            [ordered]@{ name = 'GEO optimization'; included = @('AI-readable website structure', 'industry insight publishing workflow', 'sitemap/RSS/llms.txt exposure', '30-day article operating plan'); evidence = @('website package', 'OperatingPlan', 'SuccessReview') },
            [ordered]@{ name = 'Short video operations'; included = @('short-video topic planning', 'desktop publisher task workflow', 'platform draft/export fallback boundary', 'monthly topic review'); evidence = @('SalesKit', 'OperatingPlan', 'desktop task result') },
            [ordered]@{ name = 'Enterprise AI landing'; included = @('low-risk AI workflow discovery', 'source material readiness review', 'first-month AI scenario notes'); evidence = @('OnboardingKit', 'OperatingPlan', 'SuccessReview') }
        )
        product_deliverables = @(
            'Customer delivery zip with server, desktop, website, docs, manifests, hashes, and unified entrypoint.',
            'GEOFlow server override package for admin pages, routes, publisher devices, distribution, and lead workflows.',
            'AI-readable website package with public pages, sitemap, RSS, llms.txt, and llms-full.txt.',
            'Windows desktop publisher agent package for local platform login, task polling, export fallback, and result records.',
            'PreflightReport, OnboardingKit, OperatingPlan, SalesKit, SuccessReview, AcceptanceReport, SupportBundle, UpgradePlan, and RollbackGuide actions.'
        )
        service_deliverables = @(
            'Customer kickoff and account readiness alignment.',
            'First-month content, distribution, lead, and AI workflow operating calendar.',
            'Customer demo and discovery materials for sales or renewal handoff.',
            'First-month success review template for evidence, metrics, risks, and next-month planning.',
            'Implementation handoff and acceptance evidence templates.'
        )
        out_of_scope = @(
            'Guaranteed server-side direct publishing to every third-party platform.',
            'Bypassing captcha, SMS, QR code, risk control, or platform verification.',
            'Storing third-party platform passwords, cookies, browser profiles, or verification data on the server.',
            'Public website service price display.',
            'Unlimited custom platform adapters without a separate change request.',
            'Customer server, domain, DNS, SSL, hosting, or third-party platform account procurement unless separately agreed.'
        )
        responsibilities = [ordered]@{
            tongzhuo_delivery = @(
                'Provide the delivery package, documentation, validation scripts, and implementation guidance.',
                'Explain platform login boundaries, acceptance process, rollback path, and support evidence collection.',
                'Support first delivery validation and adapter troubleshooting within the agreed scope.'
            )
            customer_or_operator = @(
                'Provide domain, server, GEOFlow access, platform accounts, and operator computer readiness.',
                'Complete third-party platform login, captcha, QR, or risk verification locally.',
                'Review and approve articles, short-video topics, leads, and AI workflow source materials.',
                'Keep API Tokens, passwords, cookies, and browser profiles private.'
            )
        }
        acceptance_criteria = @(
            'Delivery package passes Verify and package integrity checks.',
            'PreflightReport has no blocked checks before production install.',
            'GEOFlow server override install and server verification complete successfully.',
            'Website exposes at least one published article through page, sitemap, RSS, llms.txt, and llms-full.txt.',
            'Desktop publisher agent registers, reports heartbeat, and completes or clearly reports one desktop publisher task.',
            'AcceptanceReport is generated and archived with customer records.',
            'Public website contains no service prices.'
        )
        change_control = @(
            'Treat new platform adapters, deep workflow customization, custom data migration, or customer-specific UI rebuilds as change requests.',
            'Record requested change, business reason, acceptance criteria, owner, and risk before implementation.',
            'Do not add public prices, customer secrets, or platform credentials to generated artifacts.'
        )
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($ServiceScopeOutputPath)) {
        $scopeRoot = Join-Path $DeliveryRoot 'service-scopes'
        New-Item -ItemType Directory -Force -Path $scopeRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $ServiceScopeOutputPath = Join-Path $scopeRoot "service-scope-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($ServiceScopeOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $scope | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $serviceRows = @($scope.service_lines | ForEach-Object {
        "| $($_.name) | $([string]::Join('; ', @($_.included))) | $([string]::Join(', ', @($_.evidence))) |"
    })
    $productLines = @($scope.product_deliverables | ForEach-Object { "- $_" })
    $serviceLines = @($scope.service_deliverables | ForEach-Object { "- $_" })
    $outOfScopeLines = @($scope.out_of_scope | ForEach-Object { "- $_" })
    $tongzhuoLines = @($scope.responsibilities.tongzhuo_delivery | ForEach-Object { "- $_" })
    $customerLines = @($scope.responsibilities.customer_or_operator | ForEach-Object { "- $_" })
    $acceptanceLines = @($scope.acceptance_criteria | ForEach-Object { "- [ ] $_" })
    $changeLines = @($scope.change_control | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Service Scope",
        '',
        "Customer: $($scope.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($scope.generated_at)",
        "Website: $($scope.site_url)",
        "GEOFlow: $($scope.geoflow_base_url)",
        '',
        '## Service Lines',
        '',
        '| Service Line | Included Scope | Evidence |',
        '| --- | --- | --- |'
    ) + $serviceRows + @(
        '',
        '## Product Deliverables',
        ''
    ) + $productLines + @(
        '',
        '## Service Deliverables',
        ''
    ) + $serviceLines + @(
        '',
        '## Out Of Scope',
        ''
    ) + $outOfScopeLines + @(
        '',
        '## Responsibilities',
        '',
        '### Tongzhuo Delivery',
        ''
    ) + $tongzhuoLines + @(
        '',
        '### Customer Or Operator',
        ''
    ) + $customerLines + @(
        '',
        '## Acceptance Criteria',
        ''
    ) + $acceptanceLines + @(
        '',
        '## Change Control',
        ''
    ) + $changeLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this service scope or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- The server manages content, tasks, device status, leads, and result records; it does not store platform passwords.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Service scope created: $resolvedJsonOutput"
    Write-Host "Service scope summary created: $resolvedMarkdownOutput"
}

function New-ProductManual {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealth = "http://127.0.0.1:$desktopAgentPort/healthz"
    $shortName = if (($manifest.PSObject.Properties.Name -contains 'short_name') -and -not [string]::IsNullOrWhiteSpace([string] $manifest.short_name)) {
        [string] $manifest.short_name
    } else {
        [string] $manifest.company_name
    }

    $manual = [ordered]@{
        manual_type = 'tongzhuo_customer_product_manual'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        short_name = $shortName
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        positioning = 'Tongzhuo GEO Growth Suite combines a cloud GEOFlow workbench, AI-readable website, and Windows desktop publisher agent for repeatable enterprise customer acquisition operations.'
        modules = @(
            [ordered]@{ name = 'GEOFlow cloud workbench'; purpose = 'Manage articles, website publishing, distribution tasks, publisher devices, customer leads, and operating evidence.'; user_value = 'Operators work from one backend and keep publication status traceable.' },
            [ordered]@{ name = 'AI-readable company website'; purpose = 'Expose service pages, industry insights, article details, sitemap, RSS, llms.txt, llms-full.txt, and structured data.'; user_value = 'Customers and AI crawlers can understand the company, services, and latest viewpoints.' },
            [ordered]@{ name = 'Windows desktop publisher agent'; purpose = 'Keep third-party platform login local, poll GEOFlow tasks, help fill platform editors, and write results back.'; user_value = 'Platform verification stays on the operator computer while GEOFlow still coordinates publishing.' },
            [ordered]@{ name = 'Customer lead workflow'; purpose = 'Collect website contact leads and keep them visible inside GEOFlow.'; user_value = 'Content and GEO visibility can connect back to sales follow-up.' },
            [ordered]@{ name = 'Delivery evidence kit'; purpose = 'Generate preflight, onboarding, operating plan, sales kit, success review, service scope, acceptance, support, upgrade, and rollback records.'; user_value = 'Implementation and renewal discussions have repeatable evidence.' }
        )
        service_lines = @(
            [ordered]@{ name = 'GEO optimization'; promise = 'Build an AI-readable content base and keep article, crawler, and distribution evidence traceable.' },
            [ordered]@{ name = 'Short video operations'; promise = 'Plan topics, prepare distribution tasks, and keep platform publishing responsibility clear.' },
            [ordered]@{ name = 'Enterprise AI landing'; promise = 'Identify practical AI workflow scenarios and keep source material, owners, and review cadence visible.' }
        )
        core_workflows = @(
            'Create or approve an article in GEOFlow.',
            'Publish the article to the official website and make it available through sitemap, RSS, llms.txt, and llms-full.txt.',
            'Create distribution tasks for selected platforms.',
            'Use the Windows desktop publisher agent to complete local login, verification, editor filling, or manual confirmation.',
            'Write publish result, draft status, failure reason, or follow-up action back to GEOFlow.',
            'Review customer leads, article evidence, distribution status, and next operating actions weekly.'
        )
        operator_roles = @(
            [ordered]@{ role = 'Customer owner'; responsibility = 'Approves service scope, account readiness, content direction, and acceptance.' },
            [ordered]@{ role = 'Content operator'; responsibility = 'Creates articles, short-video topics, and distribution tasks in GEOFlow.' },
            [ordered]@{ role = 'Desktop publisher operator'; responsibility = 'Runs the Windows agent, logs in to platforms locally, handles captcha, and confirms publishing.' },
            [ordered]@{ role = 'Server engineer'; responsibility = 'Installs GEOFlow server overrides, verifies endpoints, and keeps backups.' },
            [ordered]@{ role = 'Customer success'; responsibility = 'Runs operating plan, success review, support bundle, and renewal evidence.' }
        )
        customer_first_steps = @(
            'Run Verify and PreflightReport from the extracted delivery package.',
            'Run ProductManual, ServiceScope, OnboardingKit, and OperatingPlan before kickoff.',
            'Install server overrides only after dry-run and backup are ready.',
            'Install the Windows desktop publisher agent on the operator computer.',
            'Register the desktop device with GEOFlow and confirm heartbeat.',
            'Publish one test article to the website and complete one desktop publisher task.',
            'Generate AcceptanceReport after first production validation.'
        )
        customer_success_metrics = @(
            'Published official website article count.',
            'AI crawler file availability: sitemap, RSS, llms.txt, and llms-full.txt.',
            'Distribution task completion or draft-confirmation rate.',
            'Desktop publisher device heartbeat and task result records.',
            'Qualified website lead records and follow-up status.',
            'Short-video topic backlog and execution cadence.',
            'Enterprise AI scenario notes with owner and next action.'
        )
        endpoints = [ordered]@{
            website = $siteUrl
            geoflow_admin = "$geoflowUrl/geo_admin"
            publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            distribution = "$geoflowUrl/geo_admin/distribution"
            contact_leads = "$geoflowUrl/geo_admin/contact-leads"
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
            desktop_health = $desktopHealth
        }
        common_actions = [ordered]@{
            verify = '.\Start-CustomerDelivery.ps1 -Action Verify'
            product_manual = '.\Start-CustomerDelivery.ps1 -Action ProductManual'
            service_scope = '.\Start-CustomerDelivery.ps1 -Action ServiceScope'
            onboarding_kit = '.\Start-CustomerDelivery.ps1 -Action OnboardingKit'
            operating_plan = '.\Start-CustomerDelivery.ps1 -Action OperatingPlan'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
        }
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($ProductManualOutputPath)) {
        $manualRoot = Join-Path $DeliveryRoot 'product-manuals'
        New-Item -ItemType Directory -Force -Path $manualRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $ProductManualOutputPath = Join-Path $manualRoot "product-manual-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($ProductManualOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $manual | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $moduleRows = @($manual.modules | ForEach-Object { "| $($_.name) | $($_.purpose) | $($_.user_value) |" })
    $serviceRows = @($manual.service_lines | ForEach-Object { "| $($_.name) | $($_.promise) |" })
    $workflowLines = @($manual.core_workflows | ForEach-Object { "1. $_" })
    $roleRows = @($manual.operator_roles | ForEach-Object { "| $($_.role) | $($_.responsibility) |" })
    $stepLines = @($manual.customer_first_steps | ForEach-Object { "- [ ] $_" })
    $metricLines = @($manual.customer_success_metrics | ForEach-Object { "- $_" })
    $endpointRows = @($manual.endpoints.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })
    $actionRows = @($manual.common_actions.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Product Manual",
        '',
        "Customer: $($manual.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($manual.generated_at)",
        "Website: $($manual.site_url)",
        "GEOFlow: $($manual.geoflow_base_url)",
        '',
        '## Positioning',
        '',
        $manual.positioning,
        '',
        '## Product Modules',
        '',
        '| Module | Purpose | Customer Value |',
        '| --- | --- | --- |'
    ) + $moduleRows + @(
        '',
        '## Service Lines',
        '',
        '| Service Line | Promise |',
        '| --- | --- |'
    ) + $serviceRows + @(
        '',
        '## Core Workflow',
        ''
    ) + $workflowLines + @(
        '',
        '## Operator Roles',
        '',
        '| Role | Responsibility |',
        '| --- | --- |'
    ) + $roleRows + @(
        '',
        '## Customer First Steps',
        ''
    ) + $stepLines + @(
        '',
        '## Customer Success Metrics',
        ''
    ) + $metricLines + @(
        '',
        '## Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Common Actions',
        '',
        '| Action | Command |',
        '| --- | --- |'
    ) + $actionRows + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this manual or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- GEOFlow coordinates content, tasks, devices, leads, and result records; it does not store platform passwords.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Product manual created: $resolvedJsonOutput"
    Write-Host "Product manual summary created: $resolvedMarkdownOutput"
}

function New-OperatorQuickstart {
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealth = "http://127.0.0.1:$desktopAgentPort/healthz"

    $quickstart = [ordered]@{
        quickstart_type = 'tongzhuo_operator_quickstart'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        daily_workflow = @(
            [ordered]@{ step = 1; name = 'Open GEOFlow'; action = "Open $geoflowUrl/geo_admin and confirm the article, distribution, publisher device, and contact lead menus are visible."; evidence = 'GEOFlow admin opens normally.' },
            [ordered]@{ step = 2; name = 'Check desktop publisher'; action = "Open $desktopHealth and confirm the Windows desktop publisher agent is running before platform distribution."; evidence = 'Desktop health endpoint responds or the local diagnostics page shows ready.' },
            [ordered]@{ step = 3; name = 'Publish website article'; action = 'Create or review an article, assign service line and category, then publish it to the official website.'; evidence = 'Article has a canonical website URL.' },
            [ordered]@{ step = 4; name = 'Confirm AI exposure'; action = 'Confirm the article can be found through the public page, sitemap, RSS, llms.txt, and llms-full.txt.'; evidence = 'AI crawler endpoints expose the article.' },
            [ordered]@{ step = 5; name = 'Create distribution task'; action = 'Select target platforms and create a desktop_publisher distribution task from GEOFlow.'; evidence = 'Distribution Management shows queued or processing task.' },
            [ordered]@{ step = 6; name = 'Handle local platform login'; action = 'Use the Windows desktop publisher agent to open target platforms and complete login, captcha, draft save, or manual confirmation locally.'; evidence = 'Platform result is draft_saved, awaiting_confirmation, published, or failed with reason.' },
            [ordered]@{ step = 7; name = 'Close out result'; action = 'In Distribution Management, confirm published URLs, record failed platform reasons, or retry after login/verification issues are fixed.'; evidence = 'GEOFlow shows state_summary, next_operator_action, platform_results, and operator confirmation when needed.' },
            [ordered]@{ step = 8; name = 'Archive evidence'; action = 'Generate OperationsEvidencePack after the first stable loop or before customer success review.'; evidence = 'Operations evidence JSON and Markdown are archived with the customer project.' }
        )
        troubleshooting = @(
            [ordered]@{ symptom = 'Desktop agent cannot open'; first_check = "Open $desktopHealth or the local diagnostics page."; next_action = 'Restart the desktop agent, then check whether the configured port is occupied.' },
            [ordered]@{ symptom = 'Platform asks for login or captcha'; first_check = 'Confirm the operator is using the customer Windows publishing computer.'; next_action = 'Complete verification locally; do not move platform passwords or cookies to the server.' },
            [ordered]@{ symptom = 'Task stays queued'; first_check = 'Check publisher device heartbeat and API Token configuration.'; next_action = 'Regenerate or reconfigure the desktop API Token locally after server deployment.' },
            [ordered]@{ symptom = 'A platform publish fails'; first_check = 'Read platform_results failure_category, message, and attempts.'; next_action = 'Retry transient errors; record manual failure for login, captcha, permission, or platform-risk issues.' },
            [ordered]@{ symptom = 'Website article is not visible to AI files'; first_check = 'Open sitemap, RSS, llms.txt, and llms-full.txt endpoints.'; next_action = 'Republish the article or run server verification if crawler files do not update.' }
        )
        evidence_checklist = @(
            'Published website article URL.',
            'Sitemap, RSS, llms.txt, and llms-full.txt article entries.',
            'Distribution task ID, channel type, target platforms, and current state.',
            'Publisher device ID, status, heartbeat time, and desktop agent version.',
            'Per-platform result state, attempts, failure category, remote URL, or export path.',
            'Operator confirmation URL/note or manual failure reason.',
            'OperationsEvidencePack JSON and Markdown file path.'
        )
        important_endpoints = [ordered]@{
            website = $siteUrl
            geoflow_admin = "$geoflowUrl/geo_admin"
            articles = "$geoflowUrl/geo_admin/articles"
            distribution = "$geoflowUrl/geo_admin/distribution"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            contact_leads = "$geoflowUrl/geo_admin/contact-leads"
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
            desktop_health = $desktopHealth
        }
        quick_commands = [ordered]@{
            verify_delivery = '.\Start-CustomerDelivery.ps1 -Action Verify'
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            operations_evidence_pack = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
        }
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            captcha_state_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($OperatorQuickstartOutputPath)) {
        $quickstartRoot = Join-Path $DeliveryRoot 'operator-quickstarts'
        New-Item -ItemType Directory -Force -Path $quickstartRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $OperatorQuickstartOutputPath = Join-Path $quickstartRoot "operator-quickstart-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($OperatorQuickstartOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $quickstart | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $workflowRows = @($quickstart.daily_workflow | ForEach-Object { "| $($_.step) | $($_.name) | $($_.action) | $($_.evidence) |" })
    $troubleshootingRows = @($quickstart.troubleshooting | ForEach-Object { "| $($_.symptom) | $($_.first_check) | $($_.next_action) |" })
    $evidenceLines = @($quickstart.evidence_checklist | ForEach-Object { "- [ ] $_" })
    $endpointRows = @($quickstart.important_endpoints.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })
    $commandRows = @($quickstart.quick_commands.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })

    $markdown = @(
        "# Tongzhuo GEO Operator Quickstart",
        '',
        "Customer: $($quickstart.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($quickstart.generated_at)",
        "Website: $($quickstart.site_url)",
        "GEOFlow: $($quickstart.geoflow_base_url)",
        '',
        '## Daily Workflow',
        '',
        '| Step | Name | Action | Evidence |',
        '| ---: | --- | --- | --- |'
    ) + $workflowRows + @(
        '',
        '## Troubleshooting',
        '',
        '| Symptom | First Check | Next Action |',
        '| --- | --- | --- |'
    ) + $troubleshootingRows + @(
        '',
        '## Evidence Checklist',
        ''
    ) + $evidenceLines + @(
        '',
        '## Important Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Quick Commands',
        '',
        '| Command | Usage |',
        '| --- | --- |'
    ) + $commandRows + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this quickstart or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- GEOFlow coordinates content, distribution tasks, publisher devices, lead records, and result evidence; it does not store platform passwords.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Operator quickstart created: $resolvedJsonOutput"
    Write-Host "Operator quickstart summary created: $resolvedMarkdownOutput"
}

function New-GoLiveChecklist {
    Invoke-Verify | Out-Null

    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealth = "http://127.0.0.1:$desktopAgentPort/healthz"
    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    if (-not (Test-Path $deploymentProfilePath)) {
        throw 'DEPLOYMENT-PROFILE.json is missing.'
    }
    $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json

    $checklist = [ordered]@{
        checklist_type = 'tongzhuo_go_live_checklist'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        desktop_health = $desktopHealth
        launch_goal = 'Move one customer from delivery package to stable production use with website publishing, AI crawler exposure, desktop publisher handoff, lead capture, rollback readiness, and customer signoff.'
        phases = @(
            [ordered]@{
                phase = 'pre_go_live'
                owner = 'implementation_lead'
                objective = 'Confirm package integrity, customer identity, backup plan, domain plan, and no-price public website boundary before touching production.'
                checks = @(
                    'Run Verify and PreflightReport from the extracted delivery package.',
                    'Confirm release zip SHA256, package sizes, and delivery-manifest.json match the release archive.',
                    'Confirm the existing GEOFlow server and website files are backed up or snapshot protected.',
                    'Confirm customer domain, GEOFlow base URL, desktop publisher port, and desktop agent port match DEPLOYMENT-PROFILE.json.',
                    'Confirm the public website contains no service pricing and no private customer credentials.'
                )
                evidence = @('Verify output', 'Preflight report JSON/Markdown', 'server backup or snapshot ID', 'DEPLOYMENT-PROFILE.json')
            },
            [ordered]@{
                phase = 'server_deployment'
                owner = 'server_engineer'
                objective = 'Install GEOFlow server overrides and website package with dry-run, install, and verification commands.'
                checks = @(
                    'Run ServerDryRunCommand and execute the printed command on the Linux server.',
                    'Install server overrides with docs/SERVER-DEPLOYMENT.md.',
                    'Run ServerInstallCommand only after dry-run output is reviewed.',
                    'Run ServerVerifyCommand after installation.',
                    'Confirm /geo_admin, distribution, publisher assistant, publisher devices, and contact leads routes open.'
                )
                evidence = @('server dry-run output', 'server install log', 'server verify output', 'GEOFlow admin route screenshots or URLs')
            },
            [ordered]@{
                phase = 'website_ai_verification'
                owner = 'content_operator'
                objective = 'Confirm the website is readable by humans and AI crawlers before distribution begins.'
                checks = @(
                    "Open $siteUrl and confirm the company homepage loads.",
                    "Open $siteUrl/sitemap.xml and confirm article URLs are listed.",
                    "Open $siteUrl/feed.xml and confirm industry insight entries are listed.",
                    "Open $siteUrl/llms.txt and $siteUrl/llms-full.txt and confirm service and article facts are exposed.",
                    'Confirm canonical article URLs are stable and do not expose draft-only content.'
                )
                evidence = @('website URL', 'sitemap URL', 'RSS URL', 'llms.txt URL', 'llms-full.txt URL')
            },
            [ordered]@{
                phase = 'desktop_publisher_setup'
                owner = 'windows_operator'
                objective = 'Install the Windows desktop publisher agent and keep platform login state local to the operator computer.'
                checks = @(
                    'Run DesktopPreflightCommand on the Windows operator computer.',
                    'Install the desktop publisher agent from the customer delivery package.',
                    'Configure GEOFlow base URL and API Token locally in the desktop agent.',
                    "Open $desktopHealth and confirm the local health endpoint responds.",
                    'Log in to target third-party platforms locally; do not upload passwords, cookies, captcha state, or browser profiles to the server.'
                )
                evidence = @('desktop preflight output', 'desktop health endpoint', 'publisher device heartbeat', 'operator local login confirmation')
            },
            [ordered]@{
                phase = 'publishing_loop_validation'
                owner = 'content_operator'
                objective = 'Prove article creation, official website publishing, distribution task creation, desktop job pickup, result writeback, and operator closeout.'
                checks = @(
                    'Create or select one test article in GEOFlow Article Management.',
                    'Publish the article to the official website and record the canonical URL.',
                    'Run PublishingLoopAcceptance to verify endpoint readiness.',
                    'Run PublishingLoopDryRun to simulate task claim and result writeback without real platform credentials.',
                    'Create a small real distribution task and confirm each platform result is published, draft_saved, awaiting_confirmation, or failed with a clear reason.'
                )
                evidence = @('article ID', 'official website URL', 'distribution task ID', 'platform_results', 'operator closeout note')
            },
            [ordered]@{
                phase = 'lead_capture_validation'
                owner = 'customer_success'
                objective = 'Confirm website consultation form submissions arrive in GEOFlow Contact Leads and can be handled by sales or operations.'
                checks = @(
                    'Submit one test lead from the public website contact form.',
                    'Open GEOFlow Contact Leads and confirm the test lead appears.',
                    'Confirm lead fields include name, contact method, service interest, message, source page, and submitted time.',
                    'Mark the test lead internally so it can be deleted or ignored after verification.'
                )
                evidence = @('test lead ID', 'Contact Leads URL', 'submitted timestamp', 'operator handling note')
            },
            [ordered]@{
                phase = 'rollback_readiness'
                owner = 'implementation_lead'
                objective = 'Keep a reversible path ready before customer signoff.'
                checks = @(
                    'Review RollbackGuide before production signoff.',
                    'Confirm original server files, database backup, and package archive are available.',
                    'Confirm the team knows which command or manual step restores the previous state.',
                    'Confirm the desktop agent can be stopped or uninstalled without deleting third-party platform accounts.'
                )
                evidence = @('rollback guide', 'backup path or snapshot ID', 'previous version record', 'desktop uninstall command')
            },
            [ordered]@{
                phase = 'customer_signoff'
                owner = 'customer_owner'
                objective = 'Record that the customer has seen the production website, GEOFlow workflow, desktop publisher boundary, lead capture, and evidence pack.'
                checks = @(
                    'Generate AcceptanceReport after production validation.',
                    'Generate OperationsEvidencePack after the first stable article-to-distribution loop.',
                    'Confirm customer understands third-party platform credentials stay on the local operator computer.',
                    'Confirm customer understands support does not include bypassing platform captcha or risk controls.',
                    'Archive signed acceptance notes with release notes, handoff checklist, and evidence pack.'
                )
                evidence = @('AcceptanceReport', 'OperationsEvidencePack', 'customer signoff note', 'release archive index')
            }
        )
        commands = [ordered]@{
            verify = '.\Start-CustomerDelivery.ps1 -Action Verify'
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            server_dry_run_command = '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
            server_install_command = '.\Start-CustomerDelivery.ps1 -Action ServerInstallCommand -LaravelRoot /www/wwwroot/geoflow'
            server_verify_command = '.\Start-CustomerDelivery.ps1 -Action ServerVerifyCommand -LaravelRoot /www/wwwroot/geoflow'
            operator_quickstart = '.\Start-CustomerDelivery.ps1 -Action OperatorQuickstart'
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            operations_evidence_pack = '.\Start-CustomerDelivery.ps1 -Action OperationsEvidencePack'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
            rollback_guide = '.\Start-CustomerDelivery.ps1 -Action RollbackGuide'
        }
        required_endpoints = [ordered]@{
            website = $siteUrl
            geoflow_admin = "$geoflowUrl/geo_admin"
            articles = "$geoflowUrl/geo_admin/articles"
            distribution = "$geoflowUrl/geo_admin/distribution"
            publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            contact_leads = "$geoflowUrl/geo_admin/contact-leads"
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
            desktop_health = $desktopHealth
        }
        source_profile = [ordered]@{
            profile_type = [string] $deploymentProfile.profile_type
            customer_slug = [string] $deploymentProfile.customer.slug
            package_count = @($deploymentProfile.packages).Count
        }
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            captcha_state_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
            support_does_not_bypass_platform_captcha_or_risk_controls = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($GoLiveOutputPath)) {
        $goLiveRoot = Join-Path $DeliveryRoot 'go-live-checklists'
        New-Item -ItemType Directory -Force -Path $goLiveRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $GoLiveOutputPath = Join-Path $goLiveRoot "go-live-checklist-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($GoLiveOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $checklist | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $phaseLines = @()
    foreach ($phase in $checklist.phases) {
        $phaseLines += "### $($phase.phase)"
        $phaseLines += ''
        $phaseLines += "Owner: $($phase.owner)"
        $phaseLines += ''
        $phaseLines += $phase.objective
        $phaseLines += ''
        $phaseLines += 'Checks:'
        $phaseLines += @($phase.checks | ForEach-Object { "- [ ] $_" })
        $phaseLines += ''
        $phaseLines += 'Evidence:'
        $phaseLines += @($phase.evidence | ForEach-Object { "- $_" })
        $phaseLines += ''
    }
    $commandRows = @($checklist.commands.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })
    $endpointRows = @($checklist.required_endpoints.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })

    $markdown = @(
        "# Tongzhuo GEO Go-Live Checklist",
        '',
        "Status: $($checklist.status)",
        "Customer: $($checklist.company_name)",
        "Version: $expectedVersion",
        "Generated at: $($checklist.generated_at)",
        "Website: $siteUrl",
        "GEOFlow: $geoflowUrl",
        '',
        '## Launch Goal',
        '',
        $checklist.launch_goal,
        '',
        '## Phases',
        ''
    ) + $phaseLines + @(
        '## Commands',
        '',
        '| Name | Command |',
        '| --- | --- |'
    ) + $commandRows + @(
        '',
        '## Required Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in the delivery package or go-live checklist.',
        '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- The server does not store third-party platform passwords.',
        '- Support does not bypass third-party platform captcha or risk-control verification.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Go-live checklist created: $resolvedJsonOutput"
    Write-Host "Go-live checklist summary created: $resolvedMarkdownOutput"
}

function New-PublishingLoopAcceptance {
    $script:publishingLoopChecks = @()

    function Add-PublishingLoopCheck {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [scriptblock]$Script
        )

        $started = Get-Date
        $check = [ordered]@{
            name = $Name
            status = 'running'
            started_at = $started.ToUniversalTime().ToString('o')
            finished_at = $null
            duration_seconds = $null
            message = $null
            error = $null
        }
        try {
            $message = & $Script
            $check.status = 'passed'
            $check.message = [string] $message
        } catch {
            $check.status = 'error'
            $check.error = [string] $_.Exception.Message
        } finally {
            $finished = Get-Date
            $check.finished_at = $finished.ToUniversalTime().ToString('o')
            $check.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            $script:publishingLoopChecks += $check
        }
    }

    $packages = Get-DeliveryPackages
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealth = "http://127.0.0.1:$desktopAgentPort/healthz"
    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    $deploymentProfile = $null
    if (Test-Path $deploymentProfilePath) {
        $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    Add-PublishingLoopCheck -Name 'official_website_ai_endpoints' -Script {
        if ($null -eq $deploymentProfile) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        foreach ($name in @('website_home', 'ai_llms', 'ai_llms_full', 'sitemap', 'rss')) {
            $value = [string] $deploymentProfile.endpoints.$name
            if ([string]::IsNullOrWhiteSpace($value)) {
                throw "Deployment profile endpoint is missing: $name"
            }
        }
        'Website, sitemap, RSS, llms.txt, and llms-full.txt endpoints are declared.'
    }
    Add-PublishingLoopCheck -Name 'geoflow_workbench_endpoints' -Script {
        if ($null -eq $deploymentProfile) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        foreach ($name in @('admin_home', 'distribution', 'publisher_assistant', 'publisher_devices', 'contact_leads')) {
            $value = [string] $deploymentProfile.endpoints.$name
            if ([string]::IsNullOrWhiteSpace($value)) {
                throw "Deployment profile endpoint is missing: $name"
            }
        }
        'GEOFlow admin, distribution, publisher assistant, publisher devices, and contact leads endpoints are declared.'
    }
    Add-PublishingLoopCheck -Name 'desktop_agent_health_endpoint' -Script {
        if ($null -eq $deploymentProfile) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        if ([string] $deploymentProfile.endpoints.desktop_health -ne $desktopHealth) {
            throw "Desktop health endpoint mismatch. Expected $desktopHealth, got $($deploymentProfile.endpoints.desktop_health)"
        }
        "Desktop health endpoint is declared at $desktopHealth."
    }
    Add-PublishingLoopCheck -Name 'component_packages_exist' -Script {
        foreach ($path in @($packages.Server, $packages.Desktop, $packages.Website)) {
            if (-not (Test-Path $path)) {
                throw "Package not found: $path"
            }
        }
        'Server, desktop publisher agent, and AI-readable website packages exist.'
    }
    Add-PublishingLoopCheck -Name 'component_versions_match' -Script {
        Test-PackageVersion -ZipPath $packages.Server -Name 'Server package' | Out-Null
        Test-PackageVersion -ZipPath $packages.Desktop -Name 'Desktop package' | Out-Null
        Test-PackageVersion -ZipPath $packages.Website -Name 'Website package' | Out-Null
        "All component package manifests match version $expectedVersion."
    }
    Add-PublishingLoopCheck -Name 'publisher_protocol_documented' -Script {
        $protocolPath = Join-Path $DeliveryRoot 'docs\PUBLISHER-DEVICE-PROTOCOL.md'
        if (-not (Test-Path $protocolPath)) {
            throw 'docs/PUBLISHER-DEVICE-PROTOCOL.md is missing.'
        }
        $protocolText = Get-Content -LiteralPath $protocolPath -Raw -Encoding UTF8
        foreach ($needle in @('/api/v1/publisher/jobs', '/claim', '/result', 'desktop_publisher')) {
            if ($protocolText -notlike "*$needle*") {
                throw "Publisher protocol is missing: $needle"
            }
        }
        'Publisher device protocol documents register, heartbeat, jobs, claim, result, and desktop_publisher scope.'
    }
    Add-PublishingLoopCheck -Name 'deployment_commands_declared' -Script {
        if ($null -eq $deploymentProfile) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        foreach ($name in @('verify_delivery', 'preflight_report', 'publishing_loop_acceptance', 'publishing_loop_dry_run', 'prepare_desktop', 'desktop_preflight', 'acceptance_report', 'support_bundle')) {
            $value = [string] $deploymentProfile.commands.$name
            if ([string]::IsNullOrWhiteSpace($value)) {
                throw "Deployment profile command is missing: $name"
            }
        }
        'Deployment profile declares verification, publishing loop acceptance, publishing loop dry run, desktop preparation, acceptance, and support commands.'
    }
    Add-PublishingLoopCheck -Name 'security_boundary_declared' -Script {
        if ($null -eq $deploymentProfile) {
            throw 'DEPLOYMENT-PROFILE.json is missing.'
        }
        if (-not [bool] $deploymentProfile.support_boundary.platform_credentials_stay_local) {
            throw 'Deployment profile must keep platform credentials local.'
        }
        if ([bool] $deploymentProfile.support_boundary.delivery_contains_api_tokens) {
            throw 'Deployment profile must not contain API Tokens.'
        }
        if ([bool] $deploymentProfile.support_boundary.delivery_contains_browser_profiles) {
            throw 'Deployment profile must not contain browser profiles.'
        }
        if ([bool] $deploymentProfile.support_boundary.public_website_shows_prices) {
            throw 'Deployment profile must not show public prices.'
        }
        'Security boundary keeps platform credentials local and excludes API Tokens, browser profiles, and public prices.'
    }

    $checks = @($script:publishingLoopChecks)
    $errors = @($checks | Where-Object { [string] $_.status -eq 'error' })
    $status = if ($errors.Count -gt 0) { 'blocked' } else { 'ready' }
    $loop = [ordered]@{
        acceptance_type = 'tongzhuo_publishing_loop_acceptance'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        desktop_agent_port = $desktopAgentPort
        workflow = @(
            'Article is created, reviewed, and published in GEOFlow.',
            'Official website exposes the article through public page, sitemap, RSS, llms.txt, and llms-full.txt.',
            'Distribution task is created for the desktop_publisher channel.',
            'Windows desktop publisher agent registers, heartbeats, polls jobs, claims a job, and opens the target platform workflow.',
            'Desktop agent records published, draft_saved, awaiting_confirmation, failed, or cancelled result through the result API.',
            'GEOFlow distribution management shows task status, platform result, remote URL or failure reason.'
        )
        evidence_to_collect = @(
            'Published website article URL.',
            'Sitemap/RSS/llms.txt entry for the article.',
            'GEOFlow distribution job ID and channel type.',
            'Publisher device ID, heartbeat time, and status.',
            'Desktop agent run result with platform_results.',
            'GEOFlow result record showing state, message, remote_url or failure reason.'
        )
        endpoints = [ordered]@{
            website = $siteUrl
            geoflow_distribution = "$geoflowUrl/geo_admin/distribution"
            publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            jobs_api = "$geoflowUrl/api/v1/publisher/jobs"
            result_api_pattern = "$geoflowUrl/api/v1/publisher/jobs/{distribution}/result"
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
            desktop_health = $desktopHealth
        }
        checks = $checks
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($PublishingLoopOutputPath)) {
        $loopRoot = Join-Path $DeliveryRoot 'publishing-loop-acceptance'
        New-Item -ItemType Directory -Force -Path $loopRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $PublishingLoopOutputPath = Join-Path $loopRoot "publishing-loop-acceptance-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($PublishingLoopOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $loop | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $workflowLines = @($loop.workflow | ForEach-Object { "1. $_" })
    $evidenceLines = @($loop.evidence_to_collect | ForEach-Object { "- [ ] $_" })
    $endpointRows = @($loop.endpoints.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })
    $checkRows = @($checks | ForEach-Object { "| $($_.name) | $($_.status) | $($_.duration_seconds) | $($_.message) | $($_.error) |" })

    $markdown = @(
        "# Tongzhuo GEO Publishing Loop Acceptance",
        '',
        "Status: $status",
        "Generated at: $($loop.generated_at)",
        "Customer: $($loop.company_name)",
        "Version: $expectedVersion",
        "Website: $($loop.site_url)",
        "GEOFlow: $($loop.geoflow_base_url)",
        '',
        '## Publishing Loop',
        ''
    ) + $workflowLines + @(
        '',
        '## Evidence To Collect',
        ''
    ) + $evidenceLines + @(
        '',
        '## Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Static Checks',
        '',
        '| Check | Status | Seconds | Message | Error |',
        '| --- | --- | ---: | --- | --- |'
    ) + $checkRows + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are not included in this acceptance report or delivery package.',
        '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
        '- GEOFlow coordinates content, distribution tasks, devices, leads, and result records; it does not store platform passwords.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Publishing loop acceptance created: $resolvedJsonOutput"
    Write-Host "Publishing loop acceptance summary created: $resolvedMarkdownOutput"
    if ($status -eq 'blocked') {
        throw "Publishing loop acceptance contains blocked checks: $resolvedJsonOutput"
    }
}

function New-PublishingLoopDryRun {
    Invoke-Verify | Out-Null

    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $slug = 'geoflow-dry-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    $articleId = 900001
    $distributionId = 780001
    $channelId = 660001
    $deviceId = 'desktop-publisher-dry-run'
    $articleUrl = "$siteUrl/insights/$slug.html"
    $jobsApi = "$geoflowUrl/api/v1/publisher/jobs"
    $claimApi = "$geoflowUrl/api/v1/publisher/jobs/$distributionId/claim"
    $resultApi = "$geoflowUrl/api/v1/publisher/jobs/$distributionId/result"
    $generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    $articleKeywords = @('GEO optimization', 'AI search optimization', 'enterprise lead generation', 'Tongzhuo')
    $articleBodyBlocks = @(
        [ordered]@{ type = 'heading'; level = 2; text = 'Why the GEO content loop matters' },
        [ordered]@{ type = 'paragraph'; text = 'The official website must serve human buyers and AI crawlers through pages, sitemap, RSS, llms.txt, and llms-full.txt.' },
        [ordered]@{ type = 'paragraph'; text = 'GEOFlow handles content, review, publishing, and distribution tasks; the desktop node handles third-party login, verification, and execution.' }
    )
    $targetPlatforms = @('zhihu', 'wechat_mp', 'toutiao')
    $deviceCapabilities = @('desktop_publisher', 'draft_saved', 'manual_confirm_publish', 'result_writeback')

    $articlePayload = [ordered]@{
        id = $articleId
        title = 'How GEO optimization helps enterprise content become easier for AI systems to cite'
        slug = $slug
        category = [ordered]@{
            name = 'Industry Insights'
            slug = 'insights'
        }
        service_line = 'GEO Optimization'
        excerpt = 'This dry-run article validates the website, GEOFlow distribution task, and desktop publisher payload structure.'
        keywords = $articleKeywords
        canonical_url = $articleUrl
        body_blocks = $articleBodyBlocks
        ai_crawler_signals = [ordered]@{
            sitemap_entry = "$siteUrl/sitemap.xml#$slug"
            rss_entry = "$siteUrl/feed.xml#$slug"
            llms_entry = "$siteUrl/llms.txt#$slug"
            llms_full_entry = "$siteUrl/llms-full.txt#$slug"
        }
    }

    $distributionTask = [ordered]@{
        id = $distributionId
        action = 'publish'
        status = 'queued'
        channel = [ordered]@{
            id = $channelId
            name = 'Desktop Publisher'
            channel_type = 'desktop_publisher'
            status = 'active'
        }
        platforms = $targetPlatforms
        payload = $articlePayload
        assistant = [ordered]@{
            state = 'queued'
            worker_id = $null
            platform_results = @()
        }
    }

    $publisherDevice = [ordered]@{
        device_id = $deviceId
        name = 'Dry Run Desktop Publisher'
        status = 'online'
        health_endpoint = "http://127.0.0.1:$desktopAgentPort/healthz"
        capabilities = $deviceCapabilities
        meta = [ordered]@{
            version = $expectedVersion
            runtime = 'node'
            mode = 'dry_run'
        }
        heartbeat_payload = [ordered]@{
            status = 'online'
            capabilities = $deviceCapabilities
            meta = [ordered]@{
                version = $expectedVersion
                dry_run = $true
            }
        }
    }

    $claimedTask = [ordered]@{
        id = $distributionId
        status = 'sending'
        assistant = [ordered]@{
            state = 'processing'
            worker_id = $deviceId
            claimed_at = $generatedAt
            last_error = $null
        }
    }

    $platformResults = @(
        [ordered]@{
            platform = 'zhihu'
            state = 'draft_saved'
            remote_url = $null
            message = 'Dry run generated a Zhihu draft payload for operator confirmation.'
        },
        [ordered]@{
            platform = 'wechat_mp'
            state = 'awaiting_confirmation'
            remote_url = $null
            message = 'Dry run prepared a WeChat official account draft and waits for final human confirmation.'
        },
        [ordered]@{
            platform = 'toutiao'
            state = 'draft_saved'
            remote_url = $null
            message = 'Dry run generated a Toutiao draft payload for operator confirmation.'
        }
    )

    $resultPayload = [ordered]@{
        state = 'draft_saved'
        worker_id = $deviceId
        message = 'Publishing loop dry run completed; platform drafts are ready for manual confirmation.'
        remote_url = $articleUrl
        platform_results = $platformResults
    }

    $finalDistribution = [ordered]@{
        id = $distributionId
        status = 'synced'
        remote_url = $articleUrl
        remote_meta = [ordered]@{
            publisher_assistant = [ordered]@{
                state = 'draft_saved'
                worker_id = $deviceId
                updated_at = $generatedAt
                completed_at = $generatedAt
                last_error = $null
                platform_results = $platformResults
            }
        }
    }

    $assertions = @()
    function Add-DryRunAssertion {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [bool]$Passed,
            [Parameter(Mandatory = $true)] [string]$Message
        )
        $script:dryRunAssertions += [ordered]@{
            name = $Name
            status = if ($Passed) { 'passed' } else { 'failed' }
            message = $Message
        }
    }

    $script:dryRunAssertions = @()
    Add-DryRunAssertion -Name 'article_payload_has_ai_entries' -Passed (
        -not [string]::IsNullOrWhiteSpace([string] $articlePayload.ai_crawler_signals.sitemap_entry) -and
        -not [string]::IsNullOrWhiteSpace([string] $articlePayload.ai_crawler_signals.rss_entry) -and
        -not [string]::IsNullOrWhiteSpace([string] $articlePayload.ai_crawler_signals.llms_entry) -and
        -not [string]::IsNullOrWhiteSpace([string] $articlePayload.ai_crawler_signals.llms_full_entry)
    ) -Message 'Article payload includes sitemap, RSS, llms.txt, and llms-full.txt signals.'
    Add-DryRunAssertion -Name 'distribution_uses_desktop_publisher' -Passed ([string] $distributionTask.channel.channel_type -eq 'desktop_publisher') -Message 'Distribution task uses the desktop_publisher channel.'
    Add-DryRunAssertion -Name 'device_can_claim_job' -Passed ([string] $claimedTask.assistant.worker_id -eq $deviceId -and [string] $claimedTask.assistant.state -eq 'processing') -Message 'Desktop device claim is represented by worker_id and processing state.'
    Add-DryRunAssertion -Name 'result_state_is_api_valid' -Passed ([string] $resultPayload.state -in @('awaiting_confirmation', 'draft_saved', 'published', 'failed', 'cancelled')) -Message 'Result payload uses a server-supported state.'
    Add-DryRunAssertion -Name 'platform_results_present' -Passed (@($platformResults).Count -ge 3) -Message 'Result payload includes per-platform states.'
    Add-DryRunAssertion -Name 'final_distribution_records_writeback' -Passed ([string] $finalDistribution.remote_meta.publisher_assistant.state -eq 'draft_saved') -Message 'Final distribution record contains assistant result writeback.'
    Add-DryRunAssertion -Name 'no_platform_credentials_in_fixture' -Passed (
        (($articlePayload | ConvertTo-Json -Depth 8) + ($distributionTask | ConvertTo-Json -Depth 8) + ($publisherDevice | ConvertTo-Json -Depth 8) + ($resultPayload | ConvertTo-Json -Depth 8)) -notmatch '(password|cookie|captcha|token)'
    ) -Message 'Dry-run fixture excludes passwords, cookies, captcha state, and API tokens.'

    $failed = @($script:dryRunAssertions | Where-Object { [string] $_.status -eq 'failed' })
    $status = if ($failed.Count -gt 0) { 'failed' } else { 'passed' }

    $dryRun = [ordered]@{
        dry_run_type = 'tongzhuo_publishing_loop_dry_run'
        status = $status
        generated_at = $generatedAt
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        simulated_article = $articlePayload
        website_exposure = [ordered]@{
            article_url = $articleUrl
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
        }
        publisher_device = $publisherDevice
        api_sequence = @(
            [ordered]@{ step = 1; name = 'register_device'; method = 'POST'; url = "$geoflowUrl/api/v1/publisher/devices/register"; expected_state = 'online' },
            [ordered]@{ step = 2; name = 'heartbeat'; method = 'POST'; url = "$geoflowUrl/api/v1/publisher/devices/$deviceId/heartbeat"; expected_state = 'online' },
            [ordered]@{ step = 3; name = 'poll_jobs'; method = 'GET'; url = $jobsApi; expected_state = 'queued_task_visible' },
            [ordered]@{ step = 4; name = 'claim_job'; method = 'POST'; url = $claimApi; expected_state = 'processing' },
            [ordered]@{ step = 5; name = 'write_result'; method = 'POST'; url = $resultApi; expected_state = 'draft_saved' }
        )
        state_transition = @(
            [ordered]@{ from = 'article_published'; to = 'queued'; owner = 'GEOFlow'; evidence = 'distribution task created' },
            [ordered]@{ from = 'queued'; to = 'processing'; owner = 'desktop_agent'; evidence = 'job claimed by worker_id' },
            [ordered]@{ from = 'processing'; to = 'draft_saved'; owner = 'desktop_agent'; evidence = 'result API accepted platform_results' },
            [ordered]@{ from = 'draft_saved'; to = 'operator_confirmation'; owner = 'operator'; evidence = 'platform draft URLs or manual confirmation screenshots' }
        )
        distribution_task_before_claim = $distributionTask
        distribution_task_after_claim = $claimedTask
        result_payload = $resultPayload
        distribution_task_after_result = $finalDistribution
        assertions = $script:dryRunAssertions
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            captcha_state_excluded = $true
            browser_profiles_excluded = $true
            platform_login_stays_local = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($PublishingLoopDryRunOutputPath)) {
        $dryRunRoot = Join-Path $DeliveryRoot 'publishing-loop-dry-runs'
        New-Item -ItemType Directory -Force -Path $dryRunRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $PublishingLoopDryRunOutputPath = Join-Path $dryRunRoot "publishing-loop-dry-run-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($PublishingLoopDryRunOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $dryRun | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $apiRows = @($dryRun.api_sequence | ForEach-Object { "| $($_.step) | $($_.method) | $($_.url) | $($_.expected_state) |" })
    $transitionRows = @($dryRun.state_transition | ForEach-Object { "| $($_.from) | $($_.to) | $($_.owner) | $($_.evidence) |" })
    $platformRows = @($platformResults | ForEach-Object { "| $($_.platform) | $($_.state) | $($_.remote_url) | $($_.message) |" })
    $assertionRows = @($script:dryRunAssertions | ForEach-Object { "| $($_.name) | $($_.status) | $($_.message) |" })

    $markdown = @(
        "# Tongzhuo GEO Publishing Loop Dry Run",
        '',
        "Status: $status",
        "Generated at: $generatedAt",
        "Customer: $($dryRun.company_name)",
        "Version: $expectedVersion",
        "Website article: $articleUrl",
        "GEOFlow jobs API: $jobsApi",
        '',
        '## Simulated Article',
        '',
        "- Title: $($articlePayload.title)",
        "- Category: $($articlePayload.category.name)",
        "- Service line: $($articlePayload.service_line)",
        "- Canonical URL: $($articlePayload.canonical_url)",
        '',
        '## API Sequence',
        '',
        '| Step | Method | URL | Expected State |',
        '| ---: | --- | --- | --- |'
    ) + $apiRows + @(
        '',
        '## State Transition',
        '',
        '| From | To | Owner | Evidence |',
        '| --- | --- | --- | --- |'
    ) + $transitionRows + @(
        '',
        '## Platform Results',
        '',
        '| Platform | State | Remote URL | Message |',
        '| --- | --- | --- | --- |'
    ) + $platformRows + @(
        '',
        '## Assertions',
        '',
        '| Assertion | Status | Message |',
        '| --- | --- | --- |'
    ) + $assertionRows + @(
        '',
        '## Security Boundary',
        '',
        '- Dry-run output does not include API Tokens, passwords, cookies, captcha state, browser profiles, screenshots, or verification codes.',
        '- Public website content does not include service prices.',
        '- Third-party platform login remains on the Windows operator computer or dedicated Windows publishing node.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Publishing loop dry run created: $resolvedJsonOutput"
    Write-Host "Publishing loop dry run summary created: $resolvedMarkdownOutput"
    if ($status -ne 'passed') {
        throw "Publishing loop dry run failed assertions: $resolvedJsonOutput"
    }
}

function New-OperationsEvidencePack {
    Invoke-Verify | Out-Null

    $script:operationsEvidenceChecks = @()

    function Add-OperationsEvidenceCheck {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [scriptblock]$Script
        )

        $started = Get-Date
        $check = [ordered]@{
            name = $Name
            status = 'running'
            started_at = $started.ToUniversalTime().ToString('o')
            finished_at = $null
            duration_seconds = $null
            message = $null
            error = $null
        }
        try {
            $message = & $Script
            $check.status = 'passed'
            if ($null -ne $message) {
                $check.message = [string] $message
            }
        } catch {
            $check.status = 'failed'
            $check.error = [string] $_.Exception.Message
        } finally {
            $finished = Get-Date
            $check.finished_at = $finished.ToUniversalTime().ToString('o')
            $check.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            $script:operationsEvidenceChecks += $check
        }
    }

    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    $desktopHealth = "http://127.0.0.1:$desktopAgentPort/healthz"
    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    if (-not (Test-Path $deploymentProfilePath)) {
        throw 'DEPLOYMENT-PROFILE.json is missing.'
    }
    $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $protocolPath = Join-Path $DeliveryRoot 'docs\PUBLISHER-DEVICE-PROTOCOL.md'
    $publishingLoopPath = Join-Path $DeliveryRoot 'docs\CUSTOMER-PUBLISHING-LOOP.md'

    Add-OperationsEvidenceCheck -Name 'deployment_profile_loaded' -Script {
        if ([string] $deploymentProfile.profile_type -ne 'tongzhuo_customer_deployment_profile') {
            throw "Deployment profile type mismatch: $($deploymentProfile.profile_type)"
        }
        'Deployment profile is available for endpoint and command evidence.'
    }
    Add-OperationsEvidenceCheck -Name 'ai_readable_website_endpoints_declared' -Script {
        foreach ($name in @('website_home', 'ai_llms', 'ai_llms_full', 'sitemap', 'rss')) {
            $value = [string] $deploymentProfile.endpoints.$name
            if ([string]::IsNullOrWhiteSpace($value)) {
                throw "Website evidence endpoint missing: $name"
            }
        }
        'Website, sitemap, RSS, llms.txt, and llms-full.txt endpoints are declared.'
    }
    Add-OperationsEvidenceCheck -Name 'geoflow_operations_endpoints_declared' -Script {
        foreach ($name in @('distribution', 'publisher_assistant', 'publisher_devices', 'contact_leads')) {
            $value = [string] $deploymentProfile.endpoints.$name
            if ([string]::IsNullOrWhiteSpace($value)) {
                throw "GEOFlow evidence endpoint missing: $name"
            }
        }
        'Distribution, publisher assistant, publisher devices, and contact leads endpoints are declared.'
    }
    Add-OperationsEvidenceCheck -Name 'desktop_health_endpoint_declared' -Script {
        if ([string] $deploymentProfile.endpoints.desktop_health -ne $desktopHealth) {
            throw "Desktop health endpoint mismatch. Expected $desktopHealth, got $($deploymentProfile.endpoints.desktop_health)"
        }
        "Desktop health endpoint is declared at $desktopHealth."
    }
    Add-OperationsEvidenceCheck -Name 'publisher_protocol_supports_result_writeback' -Script {
        if (-not (Test-Path $protocolPath)) {
            throw 'docs/PUBLISHER-DEVICE-PROTOCOL.md is missing.'
        }
        $protocolText = Get-Content -LiteralPath $protocolPath -Raw -Encoding UTF8
        foreach ($needle in @('/api/v1/publisher/jobs', '/claim', '/result', 'platform_results', 'state_summary', 'next_operator_action')) {
            if ($protocolText -notlike "*$needle*") {
                throw "Publisher protocol evidence is missing: $needle"
            }
        }
        'Publisher protocol documents job claim, result writeback, platform results, state summary, and next operator action.'
    }
    Add-OperationsEvidenceCheck -Name 'publishing_loop_manual_closeout_documented' -Script {
        if (-not (Test-Path $publishingLoopPath)) {
            throw 'docs/CUSTOMER-PUBLISHING-LOOP.md is missing.'
        }
        $loopText = Get-Content -LiteralPath $publishingLoopPath -Raw -Encoding UTF8
        foreach ($needle in @('operator', 'confirmation', 'failed', 'platform_results')) {
            if ($loopText -notlike "*$needle*") {
                throw "Publishing loop document is missing: $needle"
            }
        }
        'Publishing loop documentation covers operator closeout, failures, and platform results.'
    }
    Add-OperationsEvidenceCheck -Name 'operations_evidence_command_declared' -Script {
        $value = [string] $deploymentProfile.commands.operations_evidence_pack
        if ([string]::IsNullOrWhiteSpace($value) -or $value -notlike '*OperationsEvidencePack*') {
            throw 'Deployment profile must declare the OperationsEvidencePack command.'
        }
        'Deployment profile declares the operations evidence pack command.'
    }

    $checks = @($script:operationsEvidenceChecks)
    $failed = @($checks | Where-Object { [string] $_.status -eq 'failed' })
    $status = if ($failed.Count -gt 0) { 'blocked' } else { 'ready' }

    $evidenceStages = @(
        [ordered]@{
            stage = 'article_source'
            owner = 'GEOFlow editor'
            evidence = @('article_id', 'article_title', 'category', 'service_line', 'published_at', 'official_website_url')
            pass_rule = 'Article is published in GEOFlow and has one canonical website URL.'
        },
        [ordered]@{
            stage = 'ai_crawler_exposure'
            owner = 'Website package'
            evidence = @('article_url', 'sitemap_entry', 'rss_entry', 'llms_txt_entry', 'llms_full_txt_entry')
            pass_rule = 'The same article appears in public page, sitemap, RSS, llms.txt, and llms-full.txt.'
        },
        [ordered]@{
            stage = 'distribution_job'
            owner = 'GEOFlow distribution'
            evidence = @('distribution_id', 'channel_type', 'target_platforms', 'queued_at', 'status')
            pass_rule = 'Distribution job uses desktop_publisher channel and target platform list is explicit.'
        },
        [ordered]@{
            stage = 'publisher_device'
            owner = 'Windows desktop agent'
            evidence = @('device_id', 'device_name', 'heartbeat_at', 'agent_version', 'desktop_health')
            pass_rule = 'A publisher device is online or has a recent heartbeat before publishing.'
        },
        [ordered]@{
            stage = 'platform_execution'
            owner = 'Windows desktop agent'
            evidence = @('platform', 'state', 'attempts', 'failure_category', 'remote_url', 'message')
            pass_rule = 'Each platform has a published, draft_saved, awaiting_confirmation, or failed result.'
        },
        [ordered]@{
            stage = 'operator_closeout'
            owner = 'Customer operator'
            evidence = @('operator_action', 'platform', 'remote_url', 'note', 'confirmed_at')
            pass_rule = 'Draft or confirmation-required jobs are manually confirmed or marked failed in GEOFlow.'
        },
        [ordered]@{
            stage = 'support_boundary'
            owner = 'Implementation/support'
            evidence = @('support_bundle', 'distribution_row', 'device_status', 'server_log_time_range')
            pass_rule = 'Support evidence excludes API Tokens, platform passwords, cookies, captcha state, and browser profiles.'
        }
    )

    $sampleEvidenceRecord = [ordered]@{
        article_id = 'ART-0001'
        article_title = 'Sample GEO operations article'
        website_url = "$siteUrl/insights/sample-geo-operations-article.html"
        distribution_id = 'DIST-0001'
        channel_type = 'desktop_publisher'
        publisher_device_id = 'DESKTOP-001'
        platform_results = @(
            [ordered]@{ platform = 'zhihu'; state = 'draft_saved'; attempts = 1; remote_url = $null; next_action = 'operator_confirm_publish' },
            [ordered]@{ platform = 'wechat_mp'; state = 'awaiting_confirmation'; attempts = 1; remote_url = $null; next_action = 'operator_confirm_publish' },
            [ordered]@{ platform = 'toutiao'; state = 'published'; attempts = 1; remote_url = 'https://example.com/remote-article'; next_action = 'none' }
        )
        state_summary = [ordered]@{
            published = 1
            draft_saved = 1
            awaiting_confirmation = 1
            failed = 0
        }
        next_operator_action = 'operator_confirm_publish'
    }

    $pack = [ordered]@{
        pack_type = 'tongzhuo_operations_evidence_pack'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowUrl
        endpoints = [ordered]@{
            website = $siteUrl
            sitemap = "$siteUrl/sitemap.xml"
            rss = "$siteUrl/feed.xml"
            llms_txt = "$siteUrl/llms.txt"
            llms_full_txt = "$siteUrl/llms-full.txt"
            distribution = "$geoflowUrl/geo_admin/distribution"
            publisher_assistant = "$geoflowUrl/geo_admin/publisher-assistant"
            publisher_devices = "$geoflowUrl/geo_admin/publisher-devices"
            contact_leads = "$geoflowUrl/geo_admin/contact-leads"
            jobs_api = "$geoflowUrl/api/v1/publisher/jobs"
            result_api_pattern = "$geoflowUrl/api/v1/publisher/jobs/{distribution}/result"
            desktop_health = $desktopHealth
        }
        evidence_stages = $evidenceStages
        sample_evidence_record = $sampleEvidenceRecord
        operator_closeout_actions = @(
            'Confirm published platform result with platform id, remote URL, and note.',
            'Record manual platform failure with platform id and failure reason.',
            'Retry local publisher task after login, captcha, permission, or transient platform issue is resolved.'
        )
        required_screens = @(
            'GEOFlow article detail or article list row with published website URL.',
            'Official website article page and AI crawler endpoint entry.',
            'Distribution Management row with channel, state_summary, next_operator_action, and platform_results.',
            'Publisher Devices row showing device status and latest heartbeat.',
            'Desktop agent diagnostics page or exported support report.',
            'Platform editor or final published platform page when a platform needs manual confirmation.'
        )
        checks = $checks
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_passwords_excluded = $true
            cookies_excluded = $true
            captcha_state_excluded = $true
            browser_profiles_excluded = $true
            server_does_not_store_platform_passwords = $true
            platform_login_stays_local = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($OperationsEvidenceOutputPath)) {
        $evidenceRoot = Join-Path $DeliveryRoot 'operations-evidence-packs'
        New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $OperationsEvidenceOutputPath = Join-Path $evidenceRoot "operations-evidence-pack-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($OperationsEvidenceOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $pack | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $endpointRows = @($pack.endpoints.PSObject.Properties | ForEach-Object { "| $($_.Name) | $($_.Value) |" })
    $stageRows = @($evidenceStages | ForEach-Object {
        "| $($_.stage) | $($_.owner) | $([string]::Join(', ', @($_.evidence))) | $($_.pass_rule) |"
    })
    $checkRows = @($checks | ForEach-Object { "| $($_.name) | $($_.status) | $($_.duration_seconds) | $($_.message) | $($_.error) |" })
    $screenLines = @($pack.required_screens | ForEach-Object { "- [ ] $_" })
    $closeoutLines = @($pack.operator_closeout_actions | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo GEO Operations Evidence Pack",
        '',
        "Status: $status",
        "Generated at: $($pack.generated_at)",
        "Customer: $($pack.company_name)",
        "Version: $expectedVersion",
        "Website: $($pack.site_url)",
        "GEOFlow: $($pack.geoflow_base_url)",
        '',
        '## Evidence Stages',
        '',
        '| Stage | Owner | Evidence Fields | Pass Rule |',
        '| --- | --- | --- | --- |'
    ) + $stageRows + @(
        '',
        '## Endpoints',
        '',
        '| Name | URL |',
        '| --- | --- |'
    ) + $endpointRows + @(
        '',
        '## Required Screens And Records',
        ''
    ) + $screenLines + @(
        '',
        '## Operator Closeout Actions',
        ''
    ) + $closeoutLines + @(
        '',
        '## Static Checks',
        '',
        '| Check | Status | Seconds | Message | Error |',
        '| --- | --- | ---: | --- | --- |'
    ) + $checkRows + @(
        '',
        '## Sample Evidence Record',
        '',
        '```json',
        ($sampleEvidenceRecord | ConvertTo-Json -Depth 8),
        '```',
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- API Tokens, platform passwords, cookies, captcha state, browser profiles, screenshots, and verification codes are not included.',
        '- GEOFlow stores article, distribution, device, result, and operator confirmation records; platform login stays on the Windows desktop publisher agent.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Operations evidence pack created: $resolvedJsonOutput"
    Write-Host "Operations evidence summary created: $resolvedMarkdownOutput"
    if ($status -eq 'blocked') {
        throw "Operations evidence pack contains blocked checks: $resolvedJsonOutput"
    }
}

function New-AcceptanceReport {
    $script:acceptanceChecks = @()

    function Add-AcceptanceCheck {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [scriptblock]$Script
        )

        $started = Get-Date
        $check = [ordered]@{
            name = $Name
            status = 'running'
            started_at = $started.ToUniversalTime().ToString('o')
            finished_at = $null
            duration_seconds = $null
            error = $null
        }
        try {
            & $Script
            $check.status = 'passed'
        } catch {
            $check.status = 'failed'
            $check.error = [string] $_.Exception.Message
        } finally {
            $finished = Get-Date
            $check.finished_at = $finished.ToUniversalTime().ToString('o')
            $check.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            $script:acceptanceChecks += $check
        }
    }

    $packages = Get-DeliveryPackages
    Add-AcceptanceCheck -Name 'server_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Server -Name 'Server package' | Out-Null
    }
    Add-AcceptanceCheck -Name 'desktop_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Desktop -Name 'Desktop package' | Out-Null
    }
    Add-AcceptanceCheck -Name 'website_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Website -Name 'Website package' | Out-Null
    }
    Add-AcceptanceCheck -Name 'server_package_integrity' -Script {
        Test-PackageIntegrity -Key 'geoflow_server_overrides' -ZipPath $packages.Server -Name 'Server package'
    }
    Add-AcceptanceCheck -Name 'desktop_package_integrity' -Script {
        Test-PackageIntegrity -Key 'desktop_publisher_agent' -ZipPath $packages.Desktop -Name 'Desktop package'
    }
    Add-AcceptanceCheck -Name 'website_package_integrity' -Script {
        Test-PackageIntegrity -Key 'ai_readable_website' -ZipPath $packages.Website -Name 'Website package'
    }
    Add-AcceptanceCheck -Name 'required_documents' -Script {
        foreach ($doc in @('docs/SERVER-DEPLOYMENT.md', 'docs/CUSTOMER-RELEASE-PROCESS.md', 'docs/CUSTOMER-ACCEPTANCE-PROCESS.md', 'docs/CUSTOMER-ONBOARDING-PROCESS.md', 'docs/CUSTOMER-OPERATING-PLAN.md', 'docs/CUSTOMER-SALES-KIT.md', 'docs/CUSTOMER-SUCCESS-REVIEW.md', 'docs/CUSTOMER-SERVICE-SCOPE.md', 'docs/CUSTOMER-PRODUCT-MANUAL.md', 'docs/CUSTOMER-OPERATOR-QUICKSTART.md', 'docs/CUSTOMER-GO-LIVE-CHECKLIST.md', 'docs/CUSTOMER-PUBLISHING-LOOP.md', 'docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md', 'docs/CUSTOMER-UPGRADE-PROCESS.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/OPERATIONS-RUNBOOK.md', 'README.md', 'DELIVERY-SUMMARY.md', 'HANDOFF.md', 'IMPLEMENTATION-PLAN.md', 'DEPLOYMENT-PROFILE.json', 'DEPLOYMENT-PROFILE.md')) {
            $path = Join-Path $DeliveryRoot ($doc -replace '/', [IO.Path]::DirectorySeparatorChar)
            if (-not (Test-Path $path)) {
                throw "Required delivery document missing: $doc"
            }
        }
    }

    $checks = @($script:acceptanceChecks)
    $packageRecords = [ordered]@{}
    foreach ($entry in @(
        @{ key = 'geoflow_server_overrides'; name = 'GEOFlow server overrides'; path = $packages.Server },
        @{ key = 'desktop_publisher_agent'; name = 'Desktop publisher agent'; path = $packages.Desktop },
        @{ key = 'ai_readable_website'; name = 'AI-readable website'; path = $packages.Website }
    )) {
        $item = Get-Item -LiteralPath $entry.path
        $hash = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash.ToLowerInvariant()
        $packageRecords[$entry.key] = [ordered]@{
            name = $entry.name
            path = $entry.path
            file = Split-Path $entry.path -Leaf
            sha256 = $hash
            bytes = [int64] $item.Length
        }
    }

    $failed = @($checks | Where-Object { [string] $_.status -ne 'passed' })
    $status = if ($failed.Count -eq 0) { 'passed' } else { 'failed' }
    $report = [ordered]@{
        report_type = 'tongzhuo_customer_acceptance'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = [string] $manifest.site_url
        geoflow_base_url = [string] $manifest.geoflow_base_url
        delivery_root = $DeliveryRoot
        operator_environment = [ordered]@{
            computer_name = $env:COMPUTERNAME
            user_name = $env:USERNAME
            os = [System.Environment]::OSVersion.VersionString
            powershell_version = $PSVersionTable.PSVersion.ToString()
        }
        packages = $packageRecords
        checks = $checks
        next_steps = @(
            'Deploy GEOFlow server overrides with the dry-run command first.',
            'Install or upgrade the Windows desktop publisher agent on the operator computer.',
            'Configure GEOFlow API Token locally after deployment.',
            'Publish one test article to the website and one desktop publisher queue task.'
        )
    }

    if ([string]::IsNullOrWhiteSpace($AcceptanceOutputPath)) {
        $reportRoot = Join-Path $DeliveryRoot 'acceptance-reports'
        New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $AcceptanceOutputPath = Join-Path $reportRoot "acceptance-report-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($AcceptanceOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8
    $checkRows = @($checks | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.duration_seconds) | $($_.error) |"
    })
    $packageRows = @($packageRecords.GetEnumerator() | ForEach-Object {
        $pkg = $_.Value
        "| $($pkg.name) | $($pkg.file) | $($pkg.bytes) | $($pkg.sha256) |"
    })
    $markdown = @(
        "# Tongzhuo GEO Growth Suite Acceptance Report",
        '',
        "Status: $status",
        "Generated at: $($report.generated_at)",
        "Customer: $($report.company_name)",
        "Version: $expectedVersion",
        "Website: $($report.site_url)",
        "GEOFlow: $($report.geoflow_base_url)",
        '',
        '## Packages',
        '',
        '| Component | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $packageRows + @(
        '',
        '## Checks',
        '',
        '| Check | Status | Seconds | Error |',
        '| --- | --- | ---: | --- |'
    ) + $checkRows + @(
        '',
        '## Next Steps',
        '',
        '1. Run the server dry-run command before installation.',
        '2. Install the Windows desktop publisher agent on the operator computer.',
        '3. Configure the GEOFlow API Token locally after deployment.',
        '4. Publish one test article and confirm website plus desktop queue status.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Acceptance report created: $resolvedJsonOutput"
    Write-Host "Acceptance summary created: $resolvedMarkdownOutput"
    if ($status -ne 'passed') {
        throw "Acceptance report contains failed checks: $resolvedJsonOutput"
    }
}

function New-UpgradePlan {
    Invoke-Verify | Out-Null
    $packages = Get-DeliveryPackages
    $serverPackage = Split-Path $packages.Server -Leaf
    $desktopPackage = Split-Path $packages.Desktop -Leaf
    $websitePackage = Split-Path $packages.Website -Leaf
    $sourceVersion = if ([string]::IsNullOrWhiteSpace($CurrentVersion)) { 'unknown' } else { $CurrentVersion }
    $skip = if ($SkipMigrate) { ' --skip-migrate' } else { '' }

    $plan = [ordered]@{
        report_type = 'tongzhuo_customer_upgrade_plan'
        status = 'ready'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        current_version = $sourceVersion
        target_version = $expectedVersion
        site_url = [string] $manifest.site_url
        geoflow_base_url = [string] $manifest.geoflow_base_url
        delivery_root = $DeliveryRoot
        safety = [ordered]@{
            package_verified = $true
            backup_required = $true
            dry_run_required = $true
            preserves_desktop_data = $true
            platform_credentials_stay_local = $true
        }
        packages = [ordered]@{
            server = $serverPackage
            desktop = $desktopPackage
            website = $websitePackage
        }
        commands = [ordered]@{
            verify_delivery = '.\Start-CustomerDelivery.ps1 -Action Verify'
            server_dry_run = "bash deployment/install-geoflow-overrides.sh --laravel-root $LaravelRoot --package-root .${skip} --dry-run"
            server_install = "bash deployment/install-geoflow-overrides.sh --laravel-root $LaravelRoot --package-root .${skip}"
            server_verify = "bash deployment/verify-geoflow-overrides.sh --laravel-root $LaravelRoot --base-url $($manifest.site_url) --admin-path geo_admin"
            desktop_preflight = '.\Start-CustomerDelivery.ps1 -Action DesktopPreflightCommand'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            rollback_guide = '.\Start-CustomerDelivery.ps1 -Action RollbackGuide'
        }
        steps = @(
            'Record the current GEOFlow version, product version, database backup timestamp, and server code backup location.',
            'Run delivery verification from the extracted customer delivery folder.',
            'Upload the server override package to the Linux server and run the dry-run command.',
            'Back up the database and existing Laravel project before the real server install.',
            'Run the server install command only after dry-run and backup are confirmed.',
            'Upgrade the Windows desktop publisher agent if the desktop package changed; the installer preserves .data.',
            'Confirm /geo_admin/publisher-assistant, /geo_admin/publisher-devices, /geo_admin/distribution, /llms.txt, /sitemap.xml, and /feed.xml are accessible.',
            'Publish one test article to the website and one desktop publisher queue task.',
            'Generate a customer acceptance report after the upgrade.'
        )
        rollback = @(
            'Use .\Start-CustomerDelivery.ps1 -Action RollbackGuide before starting the upgrade.',
            'Server installer creates timestamped backups under storage/app/tongzhuo-backups/geoflow-overrides-YYYYMMDD-HHMMSS.',
            'If database migrations were executed, review whether they are reversible before attempting rollback.',
            'Desktop rollback requires uninstalling the current desktop agent and reinstalling the previous desktop package; local .data can be preserved.'
        )
    }

    if ([string]::IsNullOrWhiteSpace($UpgradeOutputPath)) {
        $planRoot = Join-Path $DeliveryRoot 'upgrade-plans'
        New-Item -ItemType Directory -Force -Path $planRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $UpgradeOutputPath = Join-Path $planRoot "upgrade-plan-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($UpgradeOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8
    $stepLines = @($plan.steps | ForEach-Object { "1. $_" })
    $rollbackLines = @($plan.rollback | ForEach-Object { "- $_" })
    $markdown = @(
        "# Tongzhuo GEO Growth Suite Upgrade Plan",
        '',
        "Customer: $($plan.company_name)",
        "Current version: $($plan.current_version)",
        "Target version: $($plan.target_version)",
        "Website: $($plan.site_url)",
        "GEOFlow: $($plan.geoflow_base_url)",
        "Generated at: $($plan.generated_at)",
        '',
        '## Packages',
        '',
        "- Server: $serverPackage",
        "- Desktop: $desktopPackage",
        "- Website: $websitePackage",
        '',
        '## Commands',
        '',
        '```powershell',
        $plan.commands.verify_delivery,
        $plan.commands.desktop_preflight,
        $plan.commands.acceptance_report,
        $plan.commands.rollback_guide,
        '```',
        '',
        '```bash',
        $plan.commands.server_dry_run,
        $plan.commands.server_install,
        $plan.commands.server_verify,
        '```',
        '',
        '## Upgrade Steps',
        ''
    ) + $stepLines + @(
        '',
        '## Rollback Notes',
        ''
    ) + $rollbackLines
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Upgrade plan created: $resolvedJsonOutput"
    Write-Host "Upgrade summary created: $resolvedMarkdownOutput"
}

function New-SupportBundle {
    $script:supportChecks = @()

    function Add-SupportCheck {
        param(
            [Parameter(Mandatory = $true)] [string]$Name,
            [Parameter(Mandatory = $true)] [scriptblock]$Script,
            [ValidateSet('error', 'warn')] [string]$FailureState = 'error'
        )

        $started = Get-Date
        $check = [ordered]@{
            name = $Name
            status = 'running'
            started_at = $started.ToUniversalTime().ToString('o')
            finished_at = $null
            duration_seconds = $null
            message = $null
            error = $null
        }
        try {
            $message = & $Script
            $check.status = 'passed'
            if ($null -ne $message) {
                $check.message = [string] $message
            }
        } catch {
            $check.status = $FailureState
            $check.error = [string] $_.Exception.Message
        } finally {
            $finished = Get-Date
            $check.finished_at = $finished.ToUniversalTime().ToString('o')
            $check.duration_seconds = [math]::Round(($finished - $started).TotalSeconds, 3)
            $script:supportChecks += $check
        }
    }

    $packages = Get-DeliveryPackages
    $packageRecords = [ordered]@{}
    foreach ($entry in @(
        @{ key = 'geoflow_server_overrides'; name = 'GEOFlow server overrides'; path = $packages.Server },
        @{ key = 'desktop_publisher_agent'; name = 'Desktop publisher agent'; path = $packages.Desktop },
        @{ key = 'ai_readable_website'; name = 'AI-readable website'; path = $packages.Website }
    )) {
        $item = Get-Item -LiteralPath $entry.path
        $hash = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash.ToLowerInvariant()
        $packageRecords[$entry.key] = [ordered]@{
            name = $entry.name
            path = $entry.path
            file = Split-Path $entry.path -Leaf
            sha256 = $hash
            bytes = [int64] $item.Length
        }
    }

    Add-SupportCheck -Name 'delivery_manifest_loaded' -Script {
        if ([string]::IsNullOrWhiteSpace([string] $manifest.customer_slug)) {
            throw 'delivery-manifest.json is missing customer_slug.'
        }
        "Delivery manifest loaded for $($manifest.customer_slug)."
    }
    Add-SupportCheck -Name 'server_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Server -Name 'Server package' | Out-Null
        'Server package version matches delivery manifest.'
    }
    Add-SupportCheck -Name 'desktop_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Desktop -Name 'Desktop package' | Out-Null
        'Desktop package version matches delivery manifest.'
    }
    Add-SupportCheck -Name 'website_package_version' -Script {
        Test-PackageVersion -ZipPath $packages.Website -Name 'Website package' | Out-Null
        'Website package version matches delivery manifest.'
    }
    Add-SupportCheck -Name 'package_integrity' -Script {
        Test-PackageIntegrity -Key 'geoflow_server_overrides' -ZipPath $packages.Server -Name 'Server package'
        Test-PackageIntegrity -Key 'desktop_publisher_agent' -ZipPath $packages.Desktop -Name 'Desktop package'
        Test-PackageIntegrity -Key 'ai_readable_website' -ZipPath $packages.Website -Name 'Website package'
        'All component package SHA256 and byte-size checks passed.'
    }
    Add-SupportCheck -Name 'required_documents' -Script {
        foreach ($doc in @('README.md', 'DELIVERY-SUMMARY.md', 'HANDOFF.md', 'IMPLEMENTATION-PLAN.md', 'DEPLOYMENT-PROFILE.json', 'DEPLOYMENT-PROFILE.md', 'docs/OPERATIONS-RUNBOOK.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/CUSTOMER-OPERATING-PLAN.md', 'docs/CUSTOMER-SALES-KIT.md', 'docs/CUSTOMER-SUCCESS-REVIEW.md', 'docs/CUSTOMER-SERVICE-SCOPE.md', 'docs/CUSTOMER-PRODUCT-MANUAL.md', 'docs/CUSTOMER-OPERATOR-QUICKSTART.md', 'docs/CUSTOMER-GO-LIVE-CHECKLIST.md', 'docs/CUSTOMER-PUBLISHING-LOOP.md', 'docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md')) {
            $path = Join-Path $DeliveryRoot ($doc -replace '/', [IO.Path]::DirectorySeparatorChar)
            if (-not (Test-Path $path)) {
                throw "Required support document missing: $doc"
            }
        }
        'Required support and handoff documents are present.'
    }
    Add-SupportCheck -Name 'local_desktop_health' -FailureState 'warn' -Script {
        $healthUrl = "http://127.0.0.1:$desktopAgentPort/healthz"
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
        "Desktop health endpoint responded with HTTP $([int] $response.StatusCode)."
    }

    $deploymentProfilePath = Join-Path $DeliveryRoot 'DEPLOYMENT-PROFILE.json'
    $deploymentProfile = $null
    if (Test-Path $deploymentProfilePath) {
        $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    $checks = @($script:supportChecks)
    $errors = @($checks | Where-Object { [string] $_.status -eq 'error' })
    $warnings = @($checks | Where-Object { [string] $_.status -eq 'warn' })
    $status = if ($errors.Count -gt 0) { 'needs_attention' } elseif ($warnings.Count -gt 0) { 'ready_with_warnings' } else { 'ready' }

    $support = [ordered]@{
        report_type = 'tongzhuo_customer_support_bundle'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
        delivery_root = $DeliveryRoot
        operator_environment = [ordered]@{
            computer_name = $env:COMPUTERNAME
            user_name = $env:USERNAME
            os = [System.Environment]::OSVersion.VersionString
            powershell_version = $PSVersionTable.PSVersion.ToString()
        }
        endpoints = if ($null -ne $deploymentProfile) { $deploymentProfile.endpoints } else { $null }
        packages = $packageRecords
        checks = $checks
        recommended_collection = @(
            'GEOFlow distribution task result screenshot or exported task row.',
            'Publisher device page screenshot showing online/offline and latest heartbeat.',
            "Desktop agent support report exported from http://127.0.0.1:$desktopAgentPort.",
            'Server Laravel log segment around the failed publish time.',
            'Platform name, login status, captcha/risk-verification state, and whether draft fallback appeared.'
        )
        security_boundary = [ordered]@{
            excludes_api_tokens = $true
            excludes_platform_passwords = $true
            excludes_cookies = $true
            excludes_browser_profiles = $true
            excludes_env_files = $true
        }
    }

    if ([string]::IsNullOrWhiteSpace($SupportOutputPath)) {
        $supportRoot = Join-Path $DeliveryRoot 'support-bundles'
        New-Item -ItemType Directory -Force -Path $supportRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $SupportOutputPath = Join-Path $supportRoot "support-bundle-$stamp.json"
    }
    $resolvedJsonOutput = [IO.Path]::GetFullPath($SupportOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutput -Parent) | Out-Null
    $resolvedMarkdownOutput = [IO.Path]::ChangeExtension($resolvedJsonOutput, '.md')

    $support | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutput -Encoding UTF8

    $packageRows = @($packageRecords.GetEnumerator() | ForEach-Object {
        $pkg = $_.Value
        "| $($pkg.name) | $($pkg.file) | $($pkg.bytes) | $($pkg.sha256) |"
    })
    $checkRows = @($checks | ForEach-Object {
        "| $($_.name) | $($_.status) | $($_.duration_seconds) | $($_.message) | $($_.error) |"
    })
    $collectionLines = @($support.recommended_collection | ForEach-Object { "- $_" })

    $markdown = @(
        "# Tongzhuo GEO Growth Suite Support Bundle",
        '',
        "Status: $status",
        "Generated at: $($support.generated_at)",
        "Customer: $($support.company_name)",
        "Version: $expectedVersion",
        "Website: $($support.site_url)",
        "GEOFlow: $($support.geoflow_base_url)",
        '',
        '## Operator Environment',
        '',
        "- Computer: $($support.operator_environment.computer_name)",
        "- User: $($support.operator_environment.user_name)",
        "- OS: $($support.operator_environment.os)",
        "- PowerShell: $($support.operator_environment.powershell_version)",
        '',
        '## Packages',
        '',
        '| Component | File | Bytes | SHA256 |',
        '| --- | --- | ---: | --- |'
    ) + $packageRows + @(
        '',
        '## Checks',
        '',
        '| Check | Status | Seconds | Message | Error |',
        '| --- | --- | ---: | --- | --- |'
    ) + $checkRows + @(
        '',
        '## Recommended Collection',
        ''
    ) + $collectionLines + @(
        '',
        '## Security Boundary',
        '',
        '- This support bundle does not include API Tokens.',
        '- This support bundle does not include platform passwords, cookies, browser profiles, .env files, screenshots, or verification codes.',
        '- Desktop login state remains on the operator computer.'
    )
    Set-Content -LiteralPath $resolvedMarkdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    Write-Host "Support bundle created: $resolvedJsonOutput"
    Write-Host "Support bundle summary created: $resolvedMarkdownOutput"
}

function New-OperationsBundle {
    $bundleRoot = Join-Path $DeliveryRoot 'operations-bundles'
    New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bundlePath = Join-Path $bundleRoot "operations-bundle-$stamp.json"
    $markdownPath = [IO.Path]::ChangeExtension($bundlePath, '.md')

    function Get-LatestJsonArtifact {
        param(
            [Parameter(Mandatory = $true)] [string]$Pattern,
            [Parameter(Mandatory = $true)] [string]$Kind
        )
        $matches = @(Get-ChildItem -LiteralPath $DeliveryRoot -Recurse -File -Filter $Pattern -ErrorAction SilentlyContinue |
            Where-Object {
                $relativePath = $_.FullName.Substring($DeliveryRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
                $relativePath -notmatch '(^|[\\/])(node_modules|vendor|\.data|tmp|temp)([\\/]|$)'
            } |
            Sort-Object LastWriteTimeUtc -Descending)
        if ($matches.Count -eq 0) {
            return [ordered]@{ kind = $Kind; status = 'missing'; path = ''; sha256 = ''; bytes = 0 }
        }
        $item = $matches[0]
        $json = $null
        try {
            $json = Get-Content -LiteralPath $item.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch {
            $json = $null
        }
        $status = if ($null -ne $json -and $null -ne $json.PSObject.Properties['status']) { [string] $json.status } else { 'present' }
        return [ordered]@{
            kind = $Kind
            status = $status
            path = $item.FullName
            file = $item.Name
            sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            bytes = [int64] $item.Length
        }
    }

    $artifacts = @(
        Get-LatestJsonArtifact -Pattern 'launchpad-*.json' -Kind 'launchpad'
        Get-LatestJsonArtifact -Pattern 'acceptance-report-*.json' -Kind 'acceptance_report'
        Get-LatestJsonArtifact -Pattern 'operations-evidence-pack-*.json' -Kind 'operations_evidence_pack'
        Get-LatestJsonArtifact -Pattern 'support-bundle-*.json' -Kind 'support_bundle'
        Get-LatestJsonArtifact -Pattern '*PROJECT-DOSSIER.json' -Kind 'customer_project_dossier'
        Get-LatestJsonArtifact -Pattern '*launch-readiness*.json' -Kind 'launch_readiness'
        Get-LatestJsonArtifact -Pattern '*health-scorecard*.json' -Kind 'health_scorecard'
    )
    $missing = @($artifacts | Where-Object { [string] $_.status -eq 'missing' })
    $status = if ($missing.Count -gt 0) { 'needs_attention' } else { 'ready_for_archive' }

    $bundle = [ordered]@{
        operations_bundle_type = 'tongzhuo_customer_delivery_operations_bundle'
        status = $status
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        product = [string] $manifest.product
        version = $expectedVersion
        customer_slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        site_url = ([string] $manifest.site_url).TrimEnd('/')
        geoflow_base_url = ([string] $manifest.geoflow_base_url).TrimEnd('/')
        delivery_root = $DeliveryRoot
        artifacts = $artifacts
        missing_artifacts = @($missing | ForEach-Object { [string] $_.kind })
        management_next_actions = @(
            'Archive this operations bundle with the customer project record.',
            'Generate missing launchpad, acceptance, operations evidence, support, dossier, launch readiness, or health artifacts before customer review.',
            'Refresh the bundle after a release upgrade, first stable publishing loop, or monthly customer success review.'
        )
        security_boundary = [ordered]@{
            no_public_prices = $true
            customer_api_tokens_excluded = $true
            platform_credentials_stay_local = $true
            browser_profiles_excluded = $true
            server_does_not_store_platform_passwords = $true
        }
    }

    $bundle | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $bundlePath -Encoding UTF8

    $artifactRows = @($artifacts | ForEach-Object {
        "| $($_.kind) | $($_.status) | $($_.bytes) | $($_.sha256) | $($_.path) |"
    })
    $missingLines = if ($missing.Count -gt 0) {
        @($missing | ForEach-Object { "- [ ] $($_.kind)" })
    } else {
        @('- No missing bundle artifacts.')
    }
    $nextLines = @($bundle.management_next_actions | ForEach-Object { "- [ ] $_" })
    $markdown = @(
        '# Tongzhuo Customer Delivery Operations Bundle',
        '',
        "Status: $status",
        "Customer: $($bundle.company_name)",
        "Version: $expectedVersion",
        "Website: $($bundle.site_url)",
        "GEOFlow: $($bundle.geoflow_base_url)",
        "Generated at: $($bundle.generated_at)",
        '',
        '## Artifacts',
        '',
        '| Kind | Status | Bytes | SHA256 | Path |',
        '| --- | --- | ---: | --- | --- |'
    ) + $artifactRows + @(
        '',
        '## Missing Artifacts',
        ''
    ) + $missingLines + @(
        '',
        '## Management Next Actions',
        ''
    ) + $nextLines + @(
        '',
        '## Security Boundary',
        '',
        '- Public website content does not include service prices.',
        '- Customer API Tokens are excluded from the bundle.',
        '- Platform credentials, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
        '- GEOFlow stores content, task, device, lead, and result records; it does not store third-party platform passwords.'
    )
    Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

    [ordered]@{
        status = 'created'
        bundle_status = $status
        operations_bundle = $bundlePath
        markdown = $markdownPath
        missing_artifacts = @($bundle.missing_artifacts)
        version = $expectedVersion
    } | ConvertTo-Json -Depth 5 | Write-Output
}

switch ($Action) {
    'Summary' { Write-Summary }
    'LaunchPad' { New-LaunchPad }
    'Verify' { Invoke-Verify }
    'PreflightReport' { New-PreflightReport }
    'OnboardingKit' { New-OnboardingKit }
    'OperatingPlan' { New-OperatingPlan }
    'SalesKit' { New-SalesKit }
    'SuccessReview' { New-SuccessReview }
    'ServiceScope' { New-ServiceScope }
    'ProductManual' { New-ProductManual }
    'OperatorQuickstart' { New-OperatorQuickstart }
    'GoLiveChecklist' { New-GoLiveChecklist }
    'PublishingLoopAcceptance' { New-PublishingLoopAcceptance }
    'PublishingLoopDryRun' { New-PublishingLoopDryRun }
    'OperationsEvidencePack' { New-OperationsEvidencePack }
    'OperationsBundle' { New-OperationsBundle }
    'ServerDryRunCommand' { Write-ServerDryRunCommand }
    'ServerInstallCommand' { Write-ServerInstallCommand }
    'ServerVerifyCommand' { Write-ServerVerifyCommand }
    'PrepareDesktop' { Expand-DesktopPackage | Out-Null }
    'DesktopPreflightCommand' { Write-DesktopPreflightCommand }
    'InstallDesktop' { Invoke-InstallDesktop }
    'RollbackGuide' { Write-RollbackGuide }
    'AcceptanceReport' { New-AcceptanceReport }
    'UpgradePlan' { New-UpgradePlan }
    'SupportBundle' { New-SupportBundle }
}
