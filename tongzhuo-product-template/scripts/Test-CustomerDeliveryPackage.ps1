[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function powershell.exe { & ([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) @args }

$resolvedPackage = (Resolve-Path $PackagePath).Path
$extractRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-delivery-verify-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Get-ZipEntryNames {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        return @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
    } finally {
        $archive.Dispose()
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -gt 0) "Delivery package missing entry: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -eq 0) "Delivery package contains blocked entry: $Pattern"
}

function Find-RequiredFile {
    param(
        [Parameter(Mandatory = $true)] [string]$BasePath,
        [Parameter(Mandatory = $true)] [string]$Filter
    )
    $file = Get-ChildItem -LiteralPath $BasePath -Recurse -File -Filter $Filter | Select-Object -First 1
    Assert-Condition ($null -ne $file) "Required file not found: $Filter"
    return $file.FullName
}

function Assert-ManifestIntegrity {
    param(
        [Parameter(Mandatory = $true)] [object]$Manifest,
        [Parameter(Mandatory = $true)] [string]$Key,
        [Parameter(Mandatory = $true)] [string]$PackagePath
    )

    Assert-Condition ($null -ne $Manifest.package_integrity) 'delivery-manifest.json is missing package_integrity.'
    $record = $Manifest.package_integrity.$Key
    Assert-Condition ($null -ne $record) "delivery-manifest.json is missing package_integrity.$Key."
    $item = Get-Item -LiteralPath $PackagePath
    $actualHash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Condition (([string] $record.sha256).ToLowerInvariant() -eq $actualHash) "SHA256 mismatch for $Key."
    Assert-Condition ([int64] $record.bytes -eq [int64] $item.Length) "Size mismatch for $Key."
}

function Assert-AbsoluteHttpUrl {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    Assert-Condition (-not [string]::IsNullOrWhiteSpace($Value)) "$Name URL is empty."
    $uri = $null
    $isUri = [uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)
    Assert-Condition $isUri "$Name is not an absolute URL: $Value"
    Assert-Condition ($uri.Scheme -in @('http', 'https')) "$Name must use http or https: $Value"
    Assert-Condition (-not $Value.EndsWith('/')) "$Name must not end with a slash: $Value"
    Assert-Condition ($uri.AbsolutePath -notmatch '//+') "$Name contains duplicate slashes in its path: $Value"
}

function Assert-Endpoint {
    param(
        [Parameter(Mandatory = $true)] [object]$Endpoints,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Expected
    )

    $value = [string] $Endpoints.$Name
    Assert-AbsoluteHttpUrl -Value $value -Name "Deployment endpoint $Name"
    Assert-Condition ($value -eq $Expected) "Deployment endpoint $Name mismatch. Expected $Expected, got $value"
}

function Assert-ProfilePackageIntegrity {
    param(
        [Parameter(Mandatory = $true)] [object]$Profile,
        [Parameter(Mandatory = $true)] [object]$Manifest,
        [Parameter(Mandatory = $true)] [string]$Key,
        [Parameter(Mandatory = $true)] [string]$PackagePath
    )

    $profileRecord = $Profile.packages.$Key
    $manifestRecord = $Manifest.package_integrity.$Key
    Assert-Condition ($null -ne $profileRecord) "Deployment profile missing package integrity: $Key"
    Assert-Condition ($null -ne $manifestRecord) "Delivery manifest missing package integrity: $Key"
    Assert-Condition ([string] $profileRecord.path -eq [string] $manifestRecord.path) "Deployment profile package path mismatch for $Key."
    Assert-Condition (([string] $profileRecord.sha256).ToLowerInvariant() -eq ([string] $manifestRecord.sha256).ToLowerInvariant()) "Deployment profile package SHA256 mismatch for $Key."
    Assert-Condition ([int64] $profileRecord.bytes -eq [int64] $manifestRecord.bytes) "Deployment profile package byte size mismatch for $Key."

    $item = Get-Item -LiteralPath $PackagePath
    $actualHash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Condition ($actualHash -eq ([string] $profileRecord.sha256).ToLowerInvariant()) "Deployment profile package SHA256 does not match actual file for $Key."
    Assert-Condition ([int64] $item.Length -eq [int64] $profileRecord.bytes) "Deployment profile package byte size does not match actual file for $Key."
}

try {
    & (Join-Path $PSScriptRoot 'Test-PackageSecrets.ps1') -PackagePath $resolvedPackage

    $outerEntries = Get-ZipEntryNames -ZipPath $resolvedPackage
    foreach ($pattern in @(
        '*/delivery-manifest.json',
        '*/customer-manifest.json',
        '*/product.json',
        '*/README.md',
        '*/LAUNCHPAD.md',
        '*/DELIVERY-SUMMARY.md',
        '*/HANDOFF.md',
        '*/IMPLEMENTATION-PLAN.md',
        '*/DEPLOYMENT-PROFILE.json',
        '*/DEPLOYMENT-PROFILE.md',
        '*/Start-CustomerDelivery.ps1',
        '*/docs/SERVER-DEPLOYMENT.md',
        '*/docs/CUSTOMER-RELEASE-PROCESS.md',
        '*/docs/CUSTOMER-ACCEPTANCE-PROCESS.md',
        '*/docs/CUSTOMER-ONBOARDING-PROCESS.md',
        '*/docs/CUSTOMER-OPERATING-PLAN.md',
        '*/docs/CUSTOMER-SALES-KIT.md',
        '*/docs/CUSTOMER-SUCCESS-REVIEW.md',
        '*/docs/CUSTOMER-SERVICE-SCOPE.md',
        '*/docs/CUSTOMER-PRODUCT-MANUAL.md',
        '*/docs/CUSTOMER-OPERATOR-QUICKSTART.md',
        '*/docs/CUSTOMER-GO-LIVE-CHECKLIST.md',
        '*/docs/CUSTOMER-PUBLISHING-LOOP.md',
        '*/docs/CUSTOMER-OPERATIONS-EVIDENCE-PACK.md',
        '*/docs/CUSTOMER-UPGRADE-PROCESS.md',
        '*/docs/DELIVERY-CHECKLIST.md',
        '*/docs/OPERATIONS-RUNBOOK.md',
        '*/*-geoflow-server-overrides.zip',
        '*/*-desktop-publisher-agent.zip',
        '*/*-ai-readable-website.zip'
    )) {
        Assert-ZipHas -Entries $outerEntries -Pattern $pattern
    }

    foreach ($pattern in @(
        '*/node_modules/*',
        '*/.env',
        '*/.data/profiles/*',
        '*/.data/browser-profile/*',
        '*/.data/browser-profiles/*',
        '*/storage/logs/*',
        '*/vendor/*',
        '*.log',
        '*.tmp'
    )) {
        Assert-ZipLacks -Entries $outerEntries -Pattern $pattern
    }

    Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $extractRoot -Force
    $deliveryRoot = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
    Assert-Condition ($null -ne $deliveryRoot) 'Expanded delivery root not found.'

    $manifestPath = Join-Path $deliveryRoot.FullName 'delivery-manifest.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "Delivery manifest version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
    $manifestDesktopAgentPort = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 18280 }
    Assert-Condition ($manifestDesktopAgentPort -ge 1024 -and $manifestDesktopAgentPort -le 65535) "Delivery manifest desktop_agent_port must be between 1024 and 65535. Got $manifestDesktopAgentPort"
    $implementationPlanPath = Join-Path $deliveryRoot.FullName 'IMPLEMENTATION-PLAN.md'
    Assert-Condition (Test-Path $implementationPlanPath) 'IMPLEMENTATION-PLAN.md not found.'
    $implementationPlan = Get-Content -LiteralPath $implementationPlanPath -Raw -Encoding UTF8
    Assert-Condition ($implementationPlan -like '*PreflightReport*') 'IMPLEMENTATION-PLAN.md must mention PreflightReport.'
    Assert-Condition ($implementationPlan -like '*OnboardingKit*') 'IMPLEMENTATION-PLAN.md must mention OnboardingKit.'
    Assert-Condition ($implementationPlan -like '*OperatingPlan*') 'IMPLEMENTATION-PLAN.md must mention OperatingPlan.'
    Assert-Condition ($implementationPlan -like '*SalesKit*') 'IMPLEMENTATION-PLAN.md must mention SalesKit.'
    Assert-Condition ($implementationPlan -like '*SuccessReview*') 'IMPLEMENTATION-PLAN.md must mention SuccessReview.'
    Assert-Condition ($implementationPlan -like '*ServiceScope*') 'IMPLEMENTATION-PLAN.md must mention ServiceScope.'
    Assert-Condition ($implementationPlan -like '*ProductManual*') 'IMPLEMENTATION-PLAN.md must mention ProductManual.'
    Assert-Condition ($implementationPlan -like '*OperatorQuickstart*') 'IMPLEMENTATION-PLAN.md must mention OperatorQuickstart.'
    Assert-Condition ($implementationPlan -like '*GoLiveChecklist*') 'IMPLEMENTATION-PLAN.md must mention GoLiveChecklist.'
    Assert-Condition ($implementationPlan -like '*PublishingLoopAcceptance*') 'IMPLEMENTATION-PLAN.md must mention PublishingLoopAcceptance.'
    Assert-Condition ($implementationPlan -like '*ServerVerifyCommand*') 'IMPLEMENTATION-PLAN.md must mention ServerVerifyCommand.'
    Assert-Condition ($implementationPlan -like '*AcceptanceReport*') 'IMPLEMENTATION-PLAN.md must mention AcceptanceReport.'
    Assert-Condition ($implementationPlan -like '*SupportBundle*') 'IMPLEMENTATION-PLAN.md must mention SupportBundle.'
    Assert-Condition ($implementationPlan -like '*UpgradePlan*') 'IMPLEMENTATION-PLAN.md must mention UpgradePlan.'
    $deploymentProfilePath = Join-Path $deliveryRoot.FullName 'DEPLOYMENT-PROFILE.json'
    Assert-Condition (Test-Path $deploymentProfilePath) 'DEPLOYMENT-PROFILE.json not found.'
    $deploymentProfile = Get-Content -LiteralPath $deploymentProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $deploymentProfile.profile_type -eq 'tongzhuo_customer_deployment_profile') "Deployment profile type mismatch: $($deploymentProfile.profile_type)"
    Assert-Condition ([string] $deploymentProfile.version -eq $ExpectedVersion) "Deployment profile version mismatch. Expected $ExpectedVersion, got $($deploymentProfile.version)"
    Assert-Condition ([string] $deploymentProfile.customer.slug -eq ([string] $manifest.customer_slug)) 'Deployment profile customer slug does not match delivery manifest.'
    Assert-Condition ([string] $deploymentProfile.customer.company_name -eq ([string] $manifest.company_name)) 'Deployment profile company name does not match delivery manifest.'
    $siteUrl = ([string] $manifest.site_url).TrimEnd('/')
    $geoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
    Assert-AbsoluteHttpUrl -Value $siteUrl -Name 'Delivery manifest site_url'
    Assert-AbsoluteHttpUrl -Value $geoflowUrl -Name 'Delivery manifest geoflow_base_url'
    Assert-Condition ([string] $deploymentProfile.customer.site_url -eq $siteUrl) 'Deployment profile customer site_url does not match delivery manifest.'
    Assert-Condition ([string] $deploymentProfile.customer.geoflow_base_url -eq $geoflowUrl) 'Deployment profile customer geoflow_base_url does not match delivery manifest.'
    Assert-Condition ([int] $deploymentProfile.customer.desktop_agent_port -eq [int] $manifest.desktop_agent_port) 'Deployment profile desktop_agent_port does not match delivery manifest.'
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'website_home' -Expected $siteUrl
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'ai_llms' -Expected "$siteUrl/llms.txt"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'ai_llms_full' -Expected "$siteUrl/llms-full.txt"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'sitemap' -Expected "$siteUrl/sitemap.xml"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'rss' -Expected "$siteUrl/feed.xml"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'admin_home' -Expected "$geoflowUrl/geo_admin"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'publisher_assistant' -Expected "$geoflowUrl/geo_admin/publisher-assistant"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'publisher_devices' -Expected "$geoflowUrl/geo_admin/publisher-devices"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'distribution' -Expected "$geoflowUrl/geo_admin/distribution"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'contact_leads' -Expected "$geoflowUrl/geo_admin/contact-leads"
    Assert-Endpoint -Endpoints $deploymentProfile.endpoints -Name 'desktop_health' -Expected "http://127.0.0.1:$manifestDesktopAgentPort/healthz"
    Assert-Condition ([string] $deploymentProfile.commands.launchpad -like '*LaunchPad*') 'Deployment profile must include launchpad command.'
    Assert-Condition ([string] $deploymentProfile.commands.server_verify -like '*ServerVerifyCommand*') 'Deployment profile must include server_verify command.'
    Assert-Condition ([string] $deploymentProfile.commands.preflight_report -like '*PreflightReport*') 'Deployment profile must include preflight_report command.'
    Assert-Condition ([string] $deploymentProfile.commands.onboarding_kit -like '*OnboardingKit*') 'Deployment profile must include onboarding_kit command.'
    Assert-Condition ([string] $deploymentProfile.commands.operating_plan -like '*OperatingPlan*') 'Deployment profile must include operating_plan command.'
    Assert-Condition ([string] $deploymentProfile.commands.sales_kit -like '*SalesKit*') 'Deployment profile must include sales_kit command.'
    Assert-Condition ([string] $deploymentProfile.commands.success_review -like '*SuccessReview*') 'Deployment profile must include success_review command.'
    Assert-Condition ([string] $deploymentProfile.commands.service_scope -like '*ServiceScope*') 'Deployment profile must include service_scope command.'
    Assert-Condition ([string] $deploymentProfile.commands.product_manual -like '*ProductManual*') 'Deployment profile must include product_manual command.'
    Assert-Condition ([string] $deploymentProfile.commands.operator_quickstart -like '*OperatorQuickstart*') 'Deployment profile must include operator_quickstart command.'
    Assert-Condition ([string] $deploymentProfile.commands.go_live_checklist -like '*GoLiveChecklist*') 'Deployment profile must include go_live_checklist command.'
    Assert-Condition ([string] $deploymentProfile.commands.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Deployment profile must include publishing_loop_acceptance command.'
    Assert-Condition ([string] $deploymentProfile.commands.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Deployment profile must include publishing_loop_dry_run command.'
    Assert-Condition ([string] $deploymentProfile.commands.operations_evidence_pack -like '*OperationsEvidencePack*') 'Deployment profile must include operations_evidence_pack command.'
    Assert-Condition ([string] $deploymentProfile.commands.acceptance_report -like '*AcceptanceReport*') 'Deployment profile must include acceptance_report command.'
    Assert-Condition ([string] $deploymentProfile.commands.support_bundle -like '*SupportBundle*') 'Deployment profile must include support_bundle command.'
    Assert-Condition ([string] $deploymentProfile.commands.upgrade_plan -like '*UpgradePlan*') 'Deployment profile must include upgrade_plan command.'
    Assert-Condition ([bool] $deploymentProfile.support_boundary.platform_credentials_stay_local) 'Deployment profile must declare local platform credential boundary.'
    Assert-Condition (-not [bool] $deploymentProfile.support_boundary.server_stores_platform_passwords) 'Deployment profile must declare that server does not store platform passwords.'
    Assert-Condition (-not [bool] $deploymentProfile.support_boundary.delivery_contains_api_tokens) 'Deployment profile must declare API tokens are excluded.'
    Assert-Condition (-not [bool] $deploymentProfile.support_boundary.delivery_contains_browser_profiles) 'Deployment profile must declare browser profiles are excluded.'
    Assert-Condition (-not [bool] $deploymentProfile.support_boundary.public_website_shows_prices) 'Deployment profile must declare public website does not show prices.'
    Assert-Condition ($null -ne $deploymentProfile.packages.geoflow_server_overrides) 'Deployment profile missing server package integrity.'
    Assert-Condition (Test-Path (Join-Path $deliveryRoot.FullName 'DEPLOYMENT-PROFILE.md')) 'DEPLOYMENT-PROFILE.md not found.'

    $serverZip = Find-RequiredFile -BasePath $deliveryRoot.FullName -Filter '*-geoflow-server-overrides.zip'
    $desktopZip = Find-RequiredFile -BasePath $deliveryRoot.FullName -Filter '*-desktop-publisher-agent.zip'
    $websiteZip = Find-RequiredFile -BasePath $deliveryRoot.FullName -Filter '*-ai-readable-website.zip'

    & (Join-Path $PSScriptRoot 'Test-PackageManifest.ps1') -PackagePath $serverZip -ExpectedVersion $ExpectedVersion
    & (Join-Path $PSScriptRoot 'Test-PackageManifest.ps1') -PackagePath $desktopZip -ExpectedVersion $ExpectedVersion
    & (Join-Path $PSScriptRoot 'Test-PackageManifest.ps1') -PackagePath $websiteZip -ExpectedVersion $ExpectedVersion
    & (Join-Path $PSScriptRoot 'Test-GeoFlowServerPackage.ps1') -PackagePath $serverZip -ExpectedVersion $ExpectedVersion
    & (Join-Path $PSScriptRoot 'Test-DesktopAgentPackage.ps1') -PackagePath $desktopZip -ExpectedVersion $ExpectedVersion
    & (Join-Path $PSScriptRoot 'Test-WebsitePackage.ps1') -PackagePath $websiteZip -ExpectedVersion $ExpectedVersion

    Assert-ManifestIntegrity -Manifest $manifest -Key 'geoflow_server_overrides' -PackagePath $serverZip
    Assert-ManifestIntegrity -Manifest $manifest -Key 'desktop_publisher_agent' -PackagePath $desktopZip
    Assert-ManifestIntegrity -Manifest $manifest -Key 'ai_readable_website' -PackagePath $websiteZip
    Assert-ProfilePackageIntegrity -Profile $deploymentProfile -Manifest $manifest -Key 'geoflow_server_overrides' -PackagePath $serverZip
    Assert-ProfilePackageIntegrity -Profile $deploymentProfile -Manifest $manifest -Key 'desktop_publisher_agent' -PackagePath $desktopZip
    Assert-ProfilePackageIntegrity -Profile $deploymentProfile -Manifest $manifest -Key 'ai_readable_website' -PackagePath $websiteZip

    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action Verify | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 Verify failed with exit code $LASTEXITCODE"
    }

    $launchPadPath = Join-Path $extractRoot 'launchpad.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action LaunchPad -LaunchPadOutputPath $launchPadPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 LaunchPad failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $launchPadPath) 'LaunchPad did not create JSON output.'
    $launchPad = Get-Content -LiteralPath $launchPadPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $launchPad.launchpad_type -eq 'tongzhuo_customer_delivery_launchpad') "LaunchPad type mismatch: $($launchPad.launchpad_type)"
    Assert-Condition ([string] $launchPad.version -eq $ExpectedVersion) "LaunchPad version mismatch. Expected $ExpectedVersion, got $($launchPad.version)"
    Assert-Condition (@($launchPad.package_inventory).Count -eq 3) 'LaunchPad should include three component packages.'
    Assert-Condition (@($launchPad.role_paths).Count -ge 5) 'LaunchPad should include role paths.'
    Assert-Condition (@($launchPad.first_90_minutes).Count -ge 6) 'LaunchPad should include first 90 minutes flow.'
    Assert-Condition ([bool] $launchPad.security_boundary.platform_credentials_stay_local) 'LaunchPad must declare local platform credential boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($launchPadPath, '.md'))) 'LaunchPad did not create Markdown output.'
    $launchPadMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($launchPadPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($launchPadMarkdown -like '*Role Paths*') 'LaunchPad Markdown is missing role paths.'
    Assert-Condition ($launchPadMarkdown -like '*First 90 Minutes*') 'LaunchPad Markdown is missing first 90 minutes.'
    Assert-Condition ($launchPadMarkdown -like '*Security Boundary*') 'LaunchPad Markdown is missing security boundary.'

    $dryRunOutput = powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action ServerDryRunCommand -LaravelRoot '/www/wwwroot/geoflow'
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 ServerDryRunCommand failed with exit code $LASTEXITCODE"
    }
    $dryRunText = [string]::Join([Environment]::NewLine, @($dryRunOutput))
    Assert-Condition ($dryRunText -like '*--dry-run*') 'ServerDryRunCommand output is missing --dry-run.'
    Assert-Condition ($dryRunText -like '*install-geoflow-overrides.sh*') 'ServerDryRunCommand output is missing installer command.'
    $serverVerifyOutput = powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action ServerVerifyCommand -LaravelRoot '/www/wwwroot/geoflow'
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 ServerVerifyCommand failed with exit code $LASTEXITCODE"
    }
    $serverVerifyText = [string]::Join([Environment]::NewLine, @($serverVerifyOutput))
    Assert-Condition ($serverVerifyText -like '*verify-geoflow-overrides.sh*') 'ServerVerifyCommand output is missing verifier command.'
    Assert-Condition ($serverVerifyText -like '*--base-url*') 'ServerVerifyCommand output is missing --base-url.'

    $preflightReportPath = Join-Path $extractRoot 'preflight-report.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action PreflightReport -PreflightOutputPath $preflightReportPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 PreflightReport failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $preflightReportPath) 'PreflightReport did not create JSON output.'
    $preflightReport = Get-Content -LiteralPath $preflightReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $preflightReport.report_type -eq 'tongzhuo_customer_preflight') "PreflightReport report type mismatch: $($preflightReport.report_type)"
    Assert-Condition ([string] $preflightReport.version -eq $ExpectedVersion) "PreflightReport version mismatch. Expected $ExpectedVersion, got $($preflightReport.version)"
    Assert-Condition ([string] $preflightReport.status -in @('ready', 'ready_with_warnings')) "PreflightReport status mismatch: $($preflightReport.status)"
    Assert-Condition (@($preflightReport.checks).Count -ge 8) 'PreflightReport should include at least 8 checks.'
    Assert-Condition ([bool] $preflightReport.security_boundary.excludes_api_tokens) 'PreflightReport must declare API Token exclusion.'
    Assert-Condition ([bool] $preflightReport.security_boundary.platform_login_stays_local) 'PreflightReport must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($preflightReportPath, '.md'))) 'PreflightReport did not create Markdown output.'
    $preflightMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($preflightReportPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($preflightMarkdown -like '*Security Boundary*') 'PreflightReport Markdown is missing security boundary.'
    Assert-Condition ($preflightMarkdown -like '*does not include API Tokens*') 'PreflightReport Markdown must state API Tokens are excluded.'

    $onboardingKitPath = Join-Path $extractRoot 'onboarding-kit.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action OnboardingKit -OnboardingOutputPath $onboardingKitPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 OnboardingKit failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $onboardingKitPath) 'OnboardingKit did not create JSON output.'
    $onboardingKit = Get-Content -LiteralPath $onboardingKitPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $onboardingKit.kit_type -eq 'tongzhuo_customer_onboarding') "OnboardingKit type mismatch: $($onboardingKit.kit_type)"
    Assert-Condition ([string] $onboardingKit.version -eq $ExpectedVersion) "OnboardingKit version mismatch. Expected $ExpectedVersion, got $($onboardingKit.version)"
    Assert-Condition (@($onboardingKit.kickoff_roles).Count -ge 5) 'OnboardingKit should include kickoff roles.'
    Assert-Condition (@($onboardingKit.training_agenda).Count -ge 5) 'OnboardingKit should include training agenda.'
    Assert-Condition (@($onboardingKit.first_week_plan).Count -ge 5) 'OnboardingKit should include first week plan.'
    Assert-Condition ([bool] $onboardingKit.security_boundary.customer_api_tokens_excluded) 'OnboardingKit must declare API Token exclusion.'
    Assert-Condition ([bool] $onboardingKit.security_boundary.platform_login_stays_local) 'OnboardingKit must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($onboardingKitPath, '.md'))) 'OnboardingKit did not create Markdown output.'
    $onboardingMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($onboardingKitPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($onboardingMarkdown -like '*Kickoff Roles*') 'OnboardingKit Markdown is missing kickoff roles.'
    Assert-Condition ($onboardingMarkdown -like '*Training Agenda*') 'OnboardingKit Markdown is missing training agenda.'
    Assert-Condition ($onboardingMarkdown -like '*Security Boundary*') 'OnboardingKit Markdown is missing security boundary.'

    $operatingPlanPath = Join-Path $extractRoot 'operating-plan.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action OperatingPlan -OperatingPlanOutputPath $operatingPlanPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 OperatingPlan failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $operatingPlanPath) 'OperatingPlan did not create JSON output.'
    $operatingPlan = Get-Content -LiteralPath $operatingPlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $operatingPlan.plan_type -eq 'tongzhuo_customer_30_day_operating_plan') "OperatingPlan type mismatch: $($operatingPlan.plan_type)"
    Assert-Condition ([string] $operatingPlan.version -eq $ExpectedVersion) "OperatingPlan version mismatch. Expected $ExpectedVersion, got $($operatingPlan.version)"
    Assert-Condition (@($operatingPlan.weekly_plan).Count -eq 4) 'OperatingPlan should include four weekly plans.'
    Assert-Condition (@($operatingPlan.article_topics).Count -ge 6) 'OperatingPlan should include article topic backlog.'
    Assert-Condition ([bool] $operatingPlan.security_boundary.customer_api_tokens_excluded) 'OperatingPlan must declare API Token exclusion.'
    Assert-Condition ([bool] $operatingPlan.security_boundary.public_website_prices_excluded) 'OperatingPlan must declare public website price exclusion.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($operatingPlanPath, '.md'))) 'OperatingPlan did not create Markdown output.'
    $operatingMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($operatingPlanPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($operatingMarkdown -like '*Weekly Plan*') 'OperatingPlan Markdown is missing weekly plan.'
    Assert-Condition ($operatingMarkdown -like '*Article Topic Backlog*') 'OperatingPlan Markdown is missing topic backlog.'
    Assert-Condition ($operatingMarkdown -like '*Security Boundary*') 'OperatingPlan Markdown is missing security boundary.'

    $salesKitPath = Join-Path $extractRoot 'sales-kit.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action SalesKit -SalesKitOutputPath $salesKitPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 SalesKit failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $salesKitPath) 'SalesKit did not create JSON output.'
    $salesKit = Get-Content -LiteralPath $salesKitPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $salesKit.kit_type -eq 'tongzhuo_customer_sales_enablement_kit') "SalesKit type mismatch: $($salesKit.kit_type)"
    Assert-Condition ([string] $salesKit.version -eq $ExpectedVersion) "SalesKit version mismatch. Expected $ExpectedVersion, got $($salesKit.version)"
    Assert-Condition (@($salesKit.service_lines).Count -eq 3) 'SalesKit should include three service lines.'
    Assert-Condition (@($salesKit.demo_flow).Count -ge 5) 'SalesKit should include a demo flow.'
    Assert-Condition (@($salesKit.discovery_questions).Count -ge 5) 'SalesKit should include discovery questions.'
    Assert-Condition (@($salesKit.objection_handling).Count -ge 4) 'SalesKit should include objection handling.'
    Assert-Condition ([bool] $salesKit.security_boundary.no_public_prices) 'SalesKit must declare public price exclusion.'
    Assert-Condition ([bool] $salesKit.security_boundary.platform_login_stays_local) 'SalesKit must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($salesKitPath, '.md'))) 'SalesKit did not create Markdown output.'
    $salesMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($salesKitPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($salesMarkdown -like '*Demo Flow*') 'SalesKit Markdown is missing demo flow.'
    Assert-Condition ($salesMarkdown -like '*Discovery Questions*') 'SalesKit Markdown is missing discovery questions.'
    Assert-Condition ($salesMarkdown -like '*Objection Handling*') 'SalesKit Markdown is missing objection handling.'
    Assert-Condition ($salesMarkdown -like '*Public website content does not include service prices*') 'SalesKit Markdown must state public prices are excluded.'

    $successReviewPath = Join-Path $extractRoot 'success-review.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action SuccessReview -SuccessReviewOutputPath $successReviewPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 SuccessReview failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $successReviewPath) 'SuccessReview did not create JSON output.'
    $successReview = Get-Content -LiteralPath $successReviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $successReview.review_type -eq 'tongzhuo_customer_success_review') "SuccessReview type mismatch: $($successReview.review_type)"
    Assert-Condition ([string] $successReview.version -eq $ExpectedVersion) "SuccessReview version mismatch. Expected $ExpectedVersion, got $($successReview.version)"
    Assert-Condition (@($successReview.evidence_checklist).Count -ge 7) 'SuccessReview should include evidence checklist.'
    Assert-Condition (@($successReview.metric_fields).Count -ge 7) 'SuccessReview should include metric fields.'
    Assert-Condition (@($successReview.service_line_review).Count -eq 3) 'SuccessReview should include three service line reviews.'
    Assert-Condition (@($successReview.risk_review).Count -ge 4) 'SuccessReview should include risk review.'
    Assert-Condition ([bool] $successReview.security_boundary.no_public_prices) 'SuccessReview must declare public price exclusion.'
    Assert-Condition ([bool] $successReview.security_boundary.platform_login_stays_local) 'SuccessReview must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($successReviewPath, '.md'))) 'SuccessReview did not create Markdown output.'
    $successMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($successReviewPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($successMarkdown -like '*Evidence Checklist*') 'SuccessReview Markdown is missing evidence checklist.'
    Assert-Condition ($successMarkdown -like '*Metric Fields*') 'SuccessReview Markdown is missing metric fields.'
    Assert-Condition ($successMarkdown -like '*Risk Review*') 'SuccessReview Markdown is missing risk review.'
    Assert-Condition ($successMarkdown -like '*Renewal Discussion*') 'SuccessReview Markdown is missing renewal discussion.'
    Assert-Condition ($successMarkdown -like '*Public website content does not include service prices*') 'SuccessReview Markdown must state public prices are excluded.'

    $serviceScopePath = Join-Path $extractRoot 'service-scope.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action ServiceScope -ServiceScopeOutputPath $serviceScopePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 ServiceScope failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $serviceScopePath) 'ServiceScope did not create JSON output.'
    $serviceScope = Get-Content -LiteralPath $serviceScopePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $serviceScope.scope_type -eq 'tongzhuo_customer_service_scope') "ServiceScope type mismatch: $($serviceScope.scope_type)"
    Assert-Condition ([string] $serviceScope.version -eq $ExpectedVersion) "ServiceScope version mismatch. Expected $ExpectedVersion, got $($serviceScope.version)"
    Assert-Condition (@($serviceScope.service_lines).Count -eq 3) 'ServiceScope should include three service lines.'
    Assert-Condition (@($serviceScope.product_deliverables).Count -ge 5) 'ServiceScope should include product deliverables.'
    Assert-Condition (@($serviceScope.out_of_scope).Count -ge 6) 'ServiceScope should include out-of-scope items.'
    Assert-Condition (@($serviceScope.acceptance_criteria).Count -ge 7) 'ServiceScope should include acceptance criteria.'
    Assert-Condition ([bool] $serviceScope.security_boundary.no_public_prices) 'ServiceScope must declare public price exclusion.'
    Assert-Condition ([bool] $serviceScope.security_boundary.platform_login_stays_local) 'ServiceScope must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($serviceScopePath, '.md'))) 'ServiceScope did not create Markdown output.'
    $serviceScopeMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($serviceScopePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($serviceScopeMarkdown -like '*Service Lines*') 'ServiceScope Markdown is missing service lines.'
    Assert-Condition ($serviceScopeMarkdown -like '*Out Of Scope*') 'ServiceScope Markdown is missing out-of-scope section.'
    Assert-Condition ($serviceScopeMarkdown -like '*Responsibilities*') 'ServiceScope Markdown is missing responsibilities.'
    Assert-Condition ($serviceScopeMarkdown -like '*Acceptance Criteria*') 'ServiceScope Markdown is missing acceptance criteria.'
    Assert-Condition ($serviceScopeMarkdown -like '*Public website content does not include service prices*') 'ServiceScope Markdown must state public prices are excluded.'

    $productManualPath = Join-Path $extractRoot 'product-manual.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action ProductManual -ProductManualOutputPath $productManualPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 ProductManual failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $productManualPath) 'ProductManual did not create JSON output.'
    $productManual = Get-Content -LiteralPath $productManualPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $productManual.manual_type -eq 'tongzhuo_customer_product_manual') "ProductManual type mismatch: $($productManual.manual_type)"
    Assert-Condition ([string] $productManual.version -eq $ExpectedVersion) "ProductManual version mismatch. Expected $ExpectedVersion, got $($productManual.version)"
    Assert-Condition (@($productManual.modules).Count -ge 5) 'ProductManual should include product modules.'
    Assert-Condition (@($productManual.service_lines).Count -eq 3) 'ProductManual should include three service lines.'
    Assert-Condition (@($productManual.core_workflows).Count -ge 6) 'ProductManual should include core workflows.'
    Assert-Condition (@($productManual.operator_roles).Count -ge 5) 'ProductManual should include operator roles.'
    Assert-Condition (@($productManual.customer_success_metrics).Count -ge 7) 'ProductManual should include customer success metrics.'
    Assert-Condition ([bool] $productManual.security_boundary.no_public_prices) 'ProductManual must declare public price exclusion.'
    Assert-Condition ([bool] $productManual.security_boundary.platform_login_stays_local) 'ProductManual must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($productManualPath, '.md'))) 'ProductManual did not create Markdown output.'
    $productManualMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($productManualPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($productManualMarkdown -like '*Product Modules*') 'ProductManual Markdown is missing product modules.'
    Assert-Condition ($productManualMarkdown -like '*Core Workflow*') 'ProductManual Markdown is missing core workflow.'
    Assert-Condition ($productManualMarkdown -like '*Operator Roles*') 'ProductManual Markdown is missing operator roles.'
    Assert-Condition ($productManualMarkdown -like '*Customer Success Metrics*') 'ProductManual Markdown is missing success metrics.'
    Assert-Condition ($productManualMarkdown -like '*Public website content does not include service prices*') 'ProductManual Markdown must state public prices are excluded.'

    $operatorQuickstartPath = Join-Path $extractRoot 'operator-quickstart.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action OperatorQuickstart -OperatorQuickstartOutputPath $operatorQuickstartPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 OperatorQuickstart failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $operatorQuickstartPath) 'OperatorQuickstart did not create JSON output.'
    $operatorQuickstart = Get-Content -LiteralPath $operatorQuickstartPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $operatorQuickstart.quickstart_type -eq 'tongzhuo_operator_quickstart') "OperatorQuickstart type mismatch: $($operatorQuickstart.quickstart_type)"
    Assert-Condition ([string] $operatorQuickstart.version -eq $ExpectedVersion) "OperatorQuickstart version mismatch. Expected $ExpectedVersion, got $($operatorQuickstart.version)"
    Assert-Condition (@($operatorQuickstart.daily_workflow).Count -ge 8) 'OperatorQuickstart should include daily workflow steps.'
    Assert-Condition (@($operatorQuickstart.troubleshooting).Count -ge 5) 'OperatorQuickstart should include troubleshooting items.'
    Assert-Condition (@($operatorQuickstart.evidence_checklist).Count -ge 7) 'OperatorQuickstart should include evidence checklist.'
    Assert-Condition ([bool] $operatorQuickstart.security_boundary.platform_login_stays_local) 'OperatorQuickstart must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($operatorQuickstartPath, '.md'))) 'OperatorQuickstart did not create Markdown output.'
    $operatorQuickstartMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($operatorQuickstartPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($operatorQuickstartMarkdown -like '*Daily Workflow*') 'OperatorQuickstart Markdown is missing daily workflow.'
    Assert-Condition ($operatorQuickstartMarkdown -like '*Troubleshooting*') 'OperatorQuickstart Markdown is missing troubleshooting.'
    Assert-Condition ($operatorQuickstartMarkdown -like '*Evidence Checklist*') 'OperatorQuickstart Markdown is missing evidence checklist.'

    $goLiveChecklistPath = Join-Path $extractRoot 'go-live-checklist.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action GoLiveChecklist -GoLiveOutputPath $goLiveChecklistPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 GoLiveChecklist failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $goLiveChecklistPath) 'GoLiveChecklist did not create JSON output.'
    $goLiveChecklist = Get-Content -LiteralPath $goLiveChecklistPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $goLiveChecklist.checklist_type -eq 'tongzhuo_go_live_checklist') "GoLiveChecklist type mismatch: $($goLiveChecklist.checklist_type)"
    Assert-Condition ([string] $goLiveChecklist.status -eq 'ready') "GoLiveChecklist status mismatch: $($goLiveChecklist.status)"
    Assert-Condition ([string] $goLiveChecklist.version -eq $ExpectedVersion) "GoLiveChecklist version mismatch. Expected $ExpectedVersion, got $($goLiveChecklist.version)"
    Assert-Condition (@($goLiveChecklist.phases).Count -ge 8) 'GoLiveChecklist should include launch phases.'
    Assert-Condition ([string] $goLiveChecklist.commands.server_install_command -like '*ServerInstallCommand*') 'GoLiveChecklist should include server install command.'
    Assert-Condition ([string] $goLiveChecklist.required_endpoints.llms_full_txt -like '*/llms-full.txt') 'GoLiveChecklist should include llms-full.txt endpoint.'
    Assert-Condition ([bool] $goLiveChecklist.security_boundary.platform_login_stays_local) 'GoLiveChecklist must declare local platform login boundary.'
    Assert-Condition ([bool] $goLiveChecklist.security_boundary.support_does_not_bypass_platform_captcha_or_risk_controls) 'GoLiveChecklist must declare captcha and risk-control support boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($goLiveChecklistPath, '.md'))) 'GoLiveChecklist did not create Markdown output.'
    $goLiveChecklistMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($goLiveChecklistPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($goLiveChecklistMarkdown -like '*Phases*') 'GoLiveChecklist Markdown is missing phases.'
    Assert-Condition ($goLiveChecklistMarkdown -like '*lead_capture_validation*') 'GoLiveChecklist Markdown is missing lead capture phase.'
    Assert-Condition ($goLiveChecklistMarkdown -like '*Security Boundary*') 'GoLiveChecklist Markdown is missing security boundary.'

    $publishingLoopPath = Join-Path $extractRoot 'publishing-loop-acceptance.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action PublishingLoopAcceptance -PublishingLoopOutputPath $publishingLoopPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 PublishingLoopAcceptance failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $publishingLoopPath) 'PublishingLoopAcceptance did not create JSON output.'
    $publishingLoop = Get-Content -LiteralPath $publishingLoopPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $publishingLoop.acceptance_type -eq 'tongzhuo_publishing_loop_acceptance') "PublishingLoopAcceptance type mismatch: $($publishingLoop.acceptance_type)"
    Assert-Condition ([string] $publishingLoop.status -eq 'ready') "PublishingLoopAcceptance status mismatch: $($publishingLoop.status)"
    Assert-Condition ([string] $publishingLoop.version -eq $ExpectedVersion) "PublishingLoopAcceptance version mismatch. Expected $ExpectedVersion, got $($publishingLoop.version)"
    Assert-Condition (@($publishingLoop.workflow).Count -ge 6) 'PublishingLoopAcceptance should include workflow steps.'
    Assert-Condition (@($publishingLoop.evidence_to_collect).Count -ge 6) 'PublishingLoopAcceptance should include evidence items.'
    Assert-Condition (@($publishingLoop.checks).Count -ge 8) 'PublishingLoopAcceptance should include static checks.'
    Assert-Condition ([string] $publishingLoop.endpoints.result_api_pattern -like '*/api/v1/publisher/jobs/{distribution}/result') 'PublishingLoopAcceptance should include result API pattern.'
    Assert-Condition ([bool] $publishingLoop.security_boundary.no_public_prices) 'PublishingLoopAcceptance must declare public price exclusion.'
    Assert-Condition ([bool] $publishingLoop.security_boundary.platform_login_stays_local) 'PublishingLoopAcceptance must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($publishingLoopPath, '.md'))) 'PublishingLoopAcceptance did not create Markdown output.'
    $publishingLoopMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($publishingLoopPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($publishingLoopMarkdown -like '*Publishing Loop*') 'PublishingLoopAcceptance Markdown is missing publishing loop.'
    Assert-Condition ($publishingLoopMarkdown -like '*Evidence To Collect*') 'PublishingLoopAcceptance Markdown is missing evidence section.'
    Assert-Condition ($publishingLoopMarkdown -like '*Static Checks*') 'PublishingLoopAcceptance Markdown is missing static checks.'
    Assert-Condition ($publishingLoopMarkdown -like '*result-writeback*' -or $publishingLoopMarkdown -like '*result records*') 'PublishingLoopAcceptance Markdown must mention result writeback.'

    $publishingLoopDryRunPath = Join-Path $extractRoot 'publishing-loop-dry-run.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action PublishingLoopDryRun -PublishingLoopDryRunOutputPath $publishingLoopDryRunPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 PublishingLoopDryRun failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $publishingLoopDryRunPath) 'PublishingLoopDryRun did not create JSON output.'
    $publishingLoopDryRun = Get-Content -LiteralPath $publishingLoopDryRunPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $publishingLoopDryRun.dry_run_type -eq 'tongzhuo_publishing_loop_dry_run') "PublishingLoopDryRun type mismatch: $($publishingLoopDryRun.dry_run_type)"
    Assert-Condition ([string] $publishingLoopDryRun.status -eq 'passed') "PublishingLoopDryRun status mismatch: $($publishingLoopDryRun.status)"
    Assert-Condition ([string] $publishingLoopDryRun.version -eq $ExpectedVersion) "PublishingLoopDryRun version mismatch. Expected $ExpectedVersion, got $($publishingLoopDryRun.version)"
    Assert-Condition ([string] $publishingLoopDryRun.distribution_task_before_claim.channel.channel_type -eq 'desktop_publisher') 'PublishingLoopDryRun should use desktop_publisher channel.'
    Assert-Condition ([string] $publishingLoopDryRun.result_payload.state -eq 'draft_saved') 'PublishingLoopDryRun result payload should use draft_saved state.'
    Assert-Condition (@($publishingLoopDryRun.api_sequence).Count -ge 5) 'PublishingLoopDryRun should include register, heartbeat, jobs, claim, and result API sequence.'
    Assert-Condition (@($publishingLoopDryRun.result_payload.platform_results).Count -ge 3) 'PublishingLoopDryRun should include per-platform results.'
    Assert-Condition (@($publishingLoopDryRun.assertions | Where-Object { [string] $_.status -eq 'failed' }).Count -eq 0) 'PublishingLoopDryRun should not include failed assertions.'
    Assert-Condition ([bool] $publishingLoopDryRun.security_boundary.customer_api_tokens_excluded) 'PublishingLoopDryRun must declare API Token exclusion.'
    Assert-Condition ([bool] $publishingLoopDryRun.security_boundary.platform_login_stays_local) 'PublishingLoopDryRun must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($publishingLoopDryRunPath, '.md'))) 'PublishingLoopDryRun did not create Markdown output.'
    $publishingLoopDryRunMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($publishingLoopDryRunPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($publishingLoopDryRunMarkdown -like '*API Sequence*') 'PublishingLoopDryRun Markdown is missing API sequence.'
    Assert-Condition ($publishingLoopDryRunMarkdown -like '*State Transition*') 'PublishingLoopDryRun Markdown is missing state transition.'
    Assert-Condition ($publishingLoopDryRunMarkdown -like '*Platform Results*') 'PublishingLoopDryRun Markdown is missing platform results.'

    $operationsEvidencePath = Join-Path $extractRoot 'operations-evidence-pack.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action OperationsEvidencePack -OperationsEvidenceOutputPath $operationsEvidencePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 OperationsEvidencePack failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $operationsEvidencePath) 'OperationsEvidencePack did not create JSON output.'
    $operationsEvidence = Get-Content -LiteralPath $operationsEvidencePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $operationsEvidence.pack_type -eq 'tongzhuo_operations_evidence_pack') "OperationsEvidencePack type mismatch: $($operationsEvidence.pack_type)"
    Assert-Condition ([string] $operationsEvidence.status -eq 'ready') "OperationsEvidencePack status mismatch: $($operationsEvidence.status)"
    Assert-Condition ([string] $operationsEvidence.version -eq $ExpectedVersion) "OperationsEvidencePack version mismatch. Expected $ExpectedVersion, got $($operationsEvidence.version)"
    Assert-Condition (@($operationsEvidence.evidence_stages).Count -ge 7) 'OperationsEvidencePack should include evidence stages.'
    Assert-Condition (@($operationsEvidence.sample_evidence_record.platform_results).Count -ge 3) 'OperationsEvidencePack should include sample platform results.'
    Assert-Condition (@($operationsEvidence.required_screens).Count -ge 6) 'OperationsEvidencePack should include required screens.'
    Assert-Condition ([string] $operationsEvidence.endpoints.result_api_pattern -like '*/api/v1/publisher/jobs/{distribution}/result') 'OperationsEvidencePack should include result API pattern.'
    Assert-Condition ([bool] $operationsEvidence.security_boundary.customer_api_tokens_excluded) 'OperationsEvidencePack must declare API Token exclusion.'
    Assert-Condition ([bool] $operationsEvidence.security_boundary.platform_login_stays_local) 'OperationsEvidencePack must declare local platform login boundary.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($operationsEvidencePath, '.md'))) 'OperationsEvidencePack did not create Markdown output.'
    $operationsEvidenceMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($operationsEvidencePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($operationsEvidenceMarkdown -like '*Evidence Stages*') 'OperationsEvidencePack Markdown is missing evidence stages.'
    Assert-Condition ($operationsEvidenceMarkdown -like '*Operator Closeout Actions*') 'OperationsEvidencePack Markdown is missing operator closeout actions.'
    Assert-Condition ($operationsEvidenceMarkdown -like '*Sample Evidence Record*') 'OperationsEvidencePack Markdown is missing sample evidence record.'

    $desktopPreflightOutput = powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action DesktopPreflightCommand
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 DesktopPreflightCommand failed with exit code $LASTEXITCODE"
    }
    $desktopPreflightText = [string]::Join([Environment]::NewLine, @($desktopPreflightOutput))
    Assert-Condition ($desktopPreflightText -like '*preflight.ps1*') 'DesktopPreflightCommand output is missing preflight.ps1.'
    Assert-Condition ($desktopPreflightText -like '*powershell -ExecutionPolicy Bypass*') 'DesktopPreflightCommand output is missing PowerShell command.'

    $acceptanceReportPath = Join-Path $extractRoot 'acceptance-report.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action AcceptanceReport -AcceptanceOutputPath $acceptanceReportPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 AcceptanceReport failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $acceptanceReportPath) 'AcceptanceReport did not create JSON output.'
    $acceptanceReport = Get-Content -LiteralPath $acceptanceReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $acceptanceReport.status -eq 'passed') "AcceptanceReport status mismatch: $($acceptanceReport.status)"
    Assert-Condition ([string] $acceptanceReport.version -eq $ExpectedVersion) "AcceptanceReport version mismatch. Expected $ExpectedVersion, got $($acceptanceReport.version)"
    Assert-Condition (@($acceptanceReport.checks).Count -ge 7) 'AcceptanceReport should include at least 7 checks.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($acceptanceReportPath, '.md'))) 'AcceptanceReport did not create Markdown output.'

    $supportBundlePath = Join-Path $extractRoot 'support-bundle.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action SupportBundle -SupportOutputPath $supportBundlePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 SupportBundle failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $supportBundlePath) 'SupportBundle did not create JSON output.'
    $supportBundle = Get-Content -LiteralPath $supportBundlePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $supportBundle.report_type -eq 'tongzhuo_customer_support_bundle') "SupportBundle report type mismatch: $($supportBundle.report_type)"
    Assert-Condition ([string] $supportBundle.version -eq $ExpectedVersion) "SupportBundle version mismatch. Expected $ExpectedVersion, got $($supportBundle.version)"
    Assert-Condition (@($supportBundle.checks).Count -ge 7) 'SupportBundle should include at least 7 checks.'
    Assert-Condition ([bool] $supportBundle.security_boundary.excludes_api_tokens) 'SupportBundle must declare API Token exclusion.'
    Assert-Condition ([bool] $supportBundle.security_boundary.excludes_cookies) 'SupportBundle must declare cookie exclusion.'
    Assert-Condition ([bool] $supportBundle.security_boundary.excludes_browser_profiles) 'SupportBundle must declare browser profile exclusion.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($supportBundlePath, '.md'))) 'SupportBundle did not create Markdown output.'
    $supportBundleMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($supportBundlePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($supportBundleMarkdown -like '*Security Boundary*') 'SupportBundle Markdown is missing security boundary.'
    Assert-Condition ($supportBundleMarkdown -like '*does not include API Tokens*') 'SupportBundle Markdown must state API Tokens are excluded.'

    $upgradePlanPath = Join-Path $extractRoot 'upgrade-plan.json'
    powershell.exe -ExecutionPolicy Bypass -File (Join-Path $deliveryRoot.FullName 'Start-CustomerDelivery.ps1') -Action UpgradePlan -CurrentVersion '1.6.1' -UpgradeOutputPath $upgradePlanPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Start-CustomerDelivery.ps1 UpgradePlan failed with exit code $LASTEXITCODE"
    }
    Assert-Condition (Test-Path $upgradePlanPath) 'UpgradePlan did not create JSON output.'
    $upgradePlan = Get-Content -LiteralPath $upgradePlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $upgradePlan.target_version -eq $ExpectedVersion) "UpgradePlan target version mismatch. Expected $ExpectedVersion, got $($upgradePlan.target_version)"
    Assert-Condition ([string] $upgradePlan.current_version -eq '1.6.1') "UpgradePlan current version mismatch. Got $($upgradePlan.current_version)"
    Assert-Condition ([bool] $upgradePlan.safety.backup_required) 'UpgradePlan must require backup.'
    Assert-Condition ([bool] $upgradePlan.safety.dry_run_required) 'UpgradePlan must require dry-run.'
    Assert-Condition ([string] $upgradePlan.commands.server_dry_run -like '*--dry-run*') 'UpgradePlan server dry-run command is missing --dry-run.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($upgradePlanPath, '.md'))) 'UpgradePlan did not create Markdown output.'
} finally {
    if (Test-Path $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
}

Write-Host "Customer delivery package validation passed: $resolvedPackage"
