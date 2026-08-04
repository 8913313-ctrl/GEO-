[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$ConfigPath = '',
    [string]$OutputPath = '',
    [string]$CustomerSlug = '',
    [string]$CompanyName = '',
    [string]$ShortName = '',
    [string]$SiteUrl = '',
    [string]$GeoFlowBaseUrl = '',
    [string]$Telephone = '',
    [string]$Email = '',
    [string]$Address = '',
    [string]$AddressRegion = ''
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
    $safe = ($Value -replace '[^a-z0-9-]', '-').ToLowerInvariant().Trim('-')
    if ([string]::IsNullOrWhiteSpace($safe)) {
        throw "Cannot create a safe slug from: $Value"
    }
    return $safe
}

function Get-RequiredText {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name
    )
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required parameter or config value: $Name"
    }
    return $Value
}

function Get-OptionalPropertyValue {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string]$PropertyName
    )
    $property = $Object.PSObject.Properties[$PropertyName]
    if ($null -eq $property -or $null -eq $property.Value) {
        return ''
    }
    return [string] $property.Value
}

function Get-NormalizedUrl {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name,
        [switch]$AllowHttp
    )
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is empty."
    }
    $uri = $null
    if (-not [uri]::TryCreate($Value, [UriKind]::Absolute, [ref] $uri)) {
        throw "$Name must be an absolute URL: $Value"
    }
    if ($uri.Scheme -notin @('http', 'https')) {
        throw "$Name must use http or https: $Value"
    }
    if (-not $AllowHttp -and $uri.Scheme -ne 'https') {
        throw "$Name should use https for production delivery: $Value"
    }
    return $uri.AbsoluteUri.TrimEnd('/')
}

$source = 'parameters'
$services = @('GEO optimization', 'Short video operations', 'Enterprise AI implementation')
$publisherPort = 18180
$desktopAgentPort = 18280

if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    $resolvedConfig = (Resolve-Path $ConfigPath).Path
    $validatedConfigJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedConfig
    $validatedConfig = $validatedConfigJson | ConvertFrom-Json
    $config = Get-Content -LiteralPath $resolvedConfig -Raw -Encoding UTF8 | ConvertFrom-Json

    $CustomerSlug = [string] $validatedConfig.customer_slug
    $CompanyName = [string] $validatedConfig.company_name
    $ShortName = [string] $validatedConfig.short_name
    $SiteUrl = [string] $validatedConfig.site_url
    $GeoFlowBaseUrl = [string] $validatedConfig.geoflow_base_url
    $Telephone = Get-OptionalPropertyValue -Object $config.website -PropertyName 'telephone'
    $Email = Get-OptionalPropertyValue -Object $config.website -PropertyName 'email'
    $Address = Get-OptionalPropertyValue -Object $config.website -PropertyName 'address'
    $AddressRegion = Get-OptionalPropertyValue -Object $config.website -PropertyName 'address_region'
    $services = @($config.company.services)
    $publisherPort = [int] $validatedConfig.publisher_port
    $desktopAgentPort = [int] $validatedConfig.desktop_agent_port
    $source = 'config'
}

$safeCustomerSlug = Get-SafeSlug -Value (Get-RequiredText -Value $CustomerSlug -Name 'CustomerSlug')
$companyNameValue = Get-RequiredText -Value $CompanyName -Name 'CompanyName'
$shortNameValue = Get-RequiredText -Value $ShortName -Name 'ShortName'
$siteUrlValue = Get-NormalizedUrl -Value (Get-RequiredText -Value $SiteUrl -Name 'SiteUrl') -Name 'SiteUrl'
$geoflowValue = if ([string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
    'http://127.0.0.1:18080'
} else {
    Get-NormalizedUrl -Value $GeoFlowBaseUrl -Name 'GeoFlowBaseUrl' -AllowHttp
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputRoot = Join-Path $rootPath 'dist\customer-intake'
    New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
    $OutputPath = Join-Path $outputRoot "$safeCustomerSlug-intake-checklist.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null
$markdownPath = [IO.Path]::ChangeExtension($resolvedOutput, '.md')

function New-ChecklistItem {
    param(
        [Parameter(Mandatory = $true)] [string]$Area,
        [Parameter(Mandatory = $true)] [string]$Item,
        [Parameter(Mandatory = $true)] [string]$Owner,
        [Parameter(Mandatory = $true)] [string]$Evidence,
        [ValidateSet('required', 'recommended', 'optional')] [string]$Priority = 'required',
        [ValidateSet('ready', 'missing', 'confirm')] [string]$Status = 'confirm'
    )
    [ordered]@{
        area = $Area
        item = $Item
        owner = $Owner
        priority = $Priority
        status = $Status
        evidence = $Evidence
    }
}

$telephoneStatus = if ([string]::IsNullOrWhiteSpace($Telephone)) { 'missing' } else { 'ready' }
$emailStatus = if ([string]::IsNullOrWhiteSpace($Email)) { 'missing' } else { 'ready' }
$addressStatus = if ([string]::IsNullOrWhiteSpace($Address)) { 'missing' } else { 'ready' }
$geoHttpsStatus = if ($geoflowValue -like 'https://*' -or $geoflowValue -like 'http://127.0.0.1*' -or $geoflowValue -like 'http://localhost*') { 'ready' } else { 'confirm' }

$checklistItems = @(
    New-ChecklistItem -Area 'company_identity' -Item 'Confirm legal company name, brand name, services, and public organization description.' -Owner 'sales' -Evidence 'Signed customer intake or company business profile.' -Status 'ready'
    New-ChecklistItem -Area 'website_and_ai' -Item 'Confirm production domain, ICP/domain ownership if applicable, sitemap, feed, llms.txt, and llms-full.txt exposure plan.' -Owner 'implementation' -Evidence $siteUrlValue -Status 'ready'
    New-ChecklistItem -Area 'contact_conversion' -Item 'Confirm public telephone for website and lead notification handoff.' -Owner 'customer' -Evidence 'website.telephone' -Status $telephoneStatus
    New-ChecklistItem -Area 'contact_conversion' -Item 'Confirm public email or internal lead receiver for customer inquiries.' -Owner 'customer' -Evidence 'website.email' -Status $emailStatus
    New-ChecklistItem -Area 'contact_conversion' -Item 'Confirm public address or service region for organization structured data.' -Owner 'customer' -Evidence 'website.address' -Status $addressStatus -Priority 'recommended'
    New-ChecklistItem -Area 'geoflow_server' -Item 'Confirm GEOFlow base URL, admin path, server access window, backup owner, and rollback owner.' -Owner 'implementation' -Evidence $geoflowValue -Status $geoHttpsStatus
    New-ChecklistItem -Area 'desktop_publisher' -Item 'Confirm Windows operator computer, desktop agent port, allowed browser channel, and local startup policy.' -Owner 'customer_operator' -Evidence "Desktop agent health: http://127.0.0.1:$desktopAgentPort/healthz" -Status 'confirm'
    New-ChecklistItem -Area 'platform_accounts' -Item 'Confirm third-party platform list and account owners without collecting passwords, cookies, captcha state, or browser profiles.' -Owner 'customer_operator' -Evidence 'Account owner list only; no credentials.' -Status 'confirm'
    New-ChecklistItem -Area 'content_assets' -Item 'Collect first 10 article topics, brand facts, service scope, case material, and forbidden claims.' -Owner 'content_operator' -Evidence 'Content brief or knowledge base folder.' -Status 'confirm'
    New-ChecklistItem -Area 'acceptance' -Item 'Confirm acceptance test: one website article, one distribution task, one desktop result writeback, one lead submission, one evidence archive.' -Owner 'implementation' -Evidence 'AcceptanceReport and OperationsEvidencePack.' -Status 'confirm'
)

$riskFlags = @()
if ($telephoneStatus -eq 'missing') {
    $riskFlags += [ordered]@{ code = 'missing_telephone'; severity = 'medium'; message = 'Public telephone is empty; lead conversion and organization structured data are weaker.' }
}
if ($emailStatus -eq 'missing') {
    $riskFlags += [ordered]@{ code = 'missing_email'; severity = 'medium'; message = 'Public email is empty; support and lead routing handoff should be confirmed.' }
}
if ($geoflowValue -notlike 'https://*' -and $geoflowValue -notlike 'http://127.0.0.1*' -and $geoflowValue -notlike 'http://localhost*') {
    $riskFlags += [ordered]@{ code = 'geoflow_not_https'; severity = 'high'; message = 'GEOFlow production base URL should use HTTPS before customer launch.' }
}
if ($publisherPort -eq $desktopAgentPort) {
    $riskFlags += [ordered]@{ code = 'port_conflict'; severity = 'high'; message = 'Publisher assistant port and desktop agent port must be different.' }
}

$intake = [ordered]@{
    intake_type = 'tongzhuo_customer_intake_checklist'
    status = if (@($riskFlags | Where-Object { [string] $_.severity -eq 'high' }).Count -gt 0) { 'needs_attention' } elseif ($riskFlags.Count -gt 0) { 'ready_with_warnings' } else { 'ready' }
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    source = $source
    product = [string] $product.product
    version = $version
    customer = [ordered]@{
        slug = $safeCustomerSlug
        company_name = $companyNameValue
        short_name = $shortNameValue
        site_url = $siteUrlValue
        geoflow_base_url = $geoflowValue
        services = @($services)
        telephone_present = -not [string]::IsNullOrWhiteSpace($Telephone)
        email_present = -not [string]::IsNullOrWhiteSpace($Email)
        address_present = -not [string]::IsNullOrWhiteSpace($Address)
    }
    required_inputs = $checklistItems
    kickoff_agenda = @(
        'Confirm product boundary: cloud GEOFlow workbench plus Windows desktop publisher agent.',
        'Confirm public website, AI-readable files, industry articles, lead capture, and GEOFlow content workflow.',
        'Confirm local platform login plan; do not collect passwords, cookies, browser profiles, or verification codes.',
        'Confirm first-week content plan and first acceptance article.',
        'Confirm launch-day backup, server install window, desktop operator, and rollback owner.'
    )
    implementation_gates = @(
        'Customer config validates and keeps geoflow.api_token empty before packaging.',
        'PreflightReport has no blocking errors before server install.',
        'Server dry-run command is reviewed before real install.',
        'Desktop publisher agent health endpoint is reachable on the operator computer.',
        'PublishingLoopDryRun and PublishingLoopAcceptance are generated before customer signoff.',
        'AcceptanceReport and OperationsEvidencePack are archived.'
    )
    do_not_collect = @(
        'Third-party platform passwords.',
        'Cookies, browser profiles, captcha state, verification codes, or private screenshots.',
        'Customer API Token before package generation.',
        'Server passwords in product release artifacts.',
        'Public service prices for the website package.'
    )
    do_not_promise = @(
        'Pure server-side login to third-party platforms.',
        'Bypassing captcha or platform risk controls.',
        'Publishing from data-center IPs without local operator verification.',
        'Guaranteed direct publish on every third-party platform when platform policy or verification blocks automation.'
    )
    risk_flags = @($riskFlags)
    next_commands = [ordered]@{
        create_config = '.\scripts\Start-ProductDelivery.ps1 -Action NewCustomerConfig -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain>'
        run_customer_wizard = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerWizard -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain> -OutputRoot <delivery-folder>'
        extracted_launchpad = '.\Start-CustomerDelivery.ps1 -Action LaunchPad'
        extracted_preflight = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
    }
    security_boundary = [ordered]@{
        no_public_prices = $true
        api_token_empty_before_packaging = $true
        platform_credentials_stay_local = $true
        browser_profiles_excluded = $true
        server_does_not_store_platform_passwords = $true
    }
}

$intake | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

$inputRows = @($intake.required_inputs | ForEach-Object {
    "| $($_.area) | $($_.item) | $($_.owner) | $($_.priority) | $($_.status) | $($_.evidence) |"
})
$riskLines = if ($riskFlags.Count -gt 0) {
    @($riskFlags | ForEach-Object { "- $($_.severity): $($_.code) - $($_.message)" })
} else {
    @('- No risk flags.')
}
$agendaLines = @($intake.kickoff_agenda | ForEach-Object { "1. $_" })
$gateLines = @($intake.implementation_gates | ForEach-Object { "- [ ] $_" })
$doNotCollectLines = @($intake.do_not_collect | ForEach-Object { "- $_" })
$doNotPromiseLines = @($intake.do_not_promise | ForEach-Object { "- $_" })

$markdown = @(
    "# Tongzhuo Customer Intake Checklist",
    '',
    "Status: $($intake.status)",
    "Product: $($intake.product)",
    "Version: $version",
    "Customer: $($intake.customer.company_name)",
    "Website: $($intake.customer.site_url)",
    "GEOFlow: $($intake.customer.geoflow_base_url)",
    '',
    '## Required Inputs',
    '',
    '| Area | Item | Owner | Priority | Status | Evidence |',
    '| --- | --- | --- | --- | --- | --- |'
) + $inputRows + @(
    '',
    '## Kickoff Agenda',
    ''
) + $agendaLines + @(
    '',
    '## Implementation Gates',
    ''
) + $gateLines + @(
    '',
    '## Risk Flags',
    ''
) + $riskLines + @(
    '',
    '## Do Not Collect',
    ''
) + $doNotCollectLines + @(
    '',
    '## Do Not Promise',
    ''
) + $doNotPromiseLines + @(
    '',
    '## Next Commands',
    '',
    '```powershell',
    $intake.next_commands.create_config,
    $intake.next_commands.run_customer_wizard,
    '```',
    '',
    'After extracting the customer package:',
    '',
    '```powershell',
    $intake.next_commands.extracted_launchpad,
    $intake.next_commands.extracted_preflight,
    '```',
    '',
    '## Security Boundary',
    '',
    '- Public website content does not include service prices.',
    '- Customer API Token stays empty before packaging.',
    '- Platform credentials, cookies, captcha state, and browser profiles stay on the Windows operator computer.',
    '- Server-side GEOFlow coordinates tasks and result records; it does not store third-party platform passwords.'
)
Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    intake_status = [string] $intake.status
    intake = $resolvedOutput
    markdown = $markdownPath
    customer_slug = $safeCustomerSlug
    version = $version
    risk_count = [int] $riskFlags.Count
} | ConvertTo-Json -Depth 4 | Write-Output
