[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ConfigPath,
    [string]$Root = '',
    [string]$OutputPath = '',
    [string]$JsonOutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$resolvedConfig = (Resolve-Path $ConfigPath).Path
$validatedConfigJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedConfig
$validated = $validatedConfigJson | ConvertFrom-Json
$config = Get-Content -LiteralPath $resolvedConfig -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-OptionalString {
    param([object]$Value)
    if ($null -eq $Value) {
        return ''
    }
    return [string] $Value
}

function Test-Present {
    param([object]$Value)
    return -not [string]::IsNullOrWhiteSpace((Get-OptionalString -Value $Value))
}

function Get-OptionalPropertyValue {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string]$PropertyName
    )
    $property = $Object.PSObject.Properties[$PropertyName]
    if ($null -eq $property) {
        return ''
    }
    return Get-OptionalString -Value $property.Value
}

function Add-Warning {
    param(
        [System.Collections.ArrayList]$Warnings,
        [Parameter(Mandatory = $true)] [string]$Code,
        [Parameter(Mandatory = $true)] [string]$Message
    )

    [void] $Warnings.Add([ordered]@{
        code = $Code
        message = $Message
    })
}

$customerSlug = [string] $validated.customer_slug
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Split-Path $resolvedConfig -Parent) "$customerSlug-CONFIG-REVIEW.md"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null

if ([string]::IsNullOrWhiteSpace($JsonOutputPath)) {
    $JsonOutputPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.json')
}
$resolvedJsonOutputPath = [IO.Path]::GetFullPath($JsonOutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutputPath -Parent) | Out-Null

$siteUrl = ([string] $validated.site_url).TrimEnd('/')
$geoflowBaseUrl = ([string] $validated.geoflow_base_url).TrimEnd('/')
$desktopAgentPort = [int] $validated.desktop_agent_port
$publisherPort = [int] $validated.publisher_port

$siteUri = [uri] $siteUrl
$geoflowUri = [uri] $geoflowBaseUrl
$warnings = [System.Collections.ArrayList]::new()

if ($siteUri.Host -like '*.example.com' -or $siteUri.Host -eq 'example.com') {
    Add-Warning -Warnings $warnings -Code 'placeholder_site_url' -Message 'website.site_url still uses an example.com domain.'
}
if ($geoflowUri.Host -in @('127.0.0.1', 'localhost')) {
    Add-Warning -Warnings $warnings -Code 'local_geoflow_url' -Message 'geoflow.base_url points to a local address; replace it before production handoff.'
}
if ($geoflowUri.Scheme -ne 'https' -and $geoflowUri.Host -notin @('127.0.0.1', 'localhost')) {
    Add-Warning -Warnings $warnings -Code 'geoflow_not_https' -Message 'geoflow.base_url should use HTTPS for production delivery.'
}
$telephone = Get-OptionalPropertyValue -Object $config.website -PropertyName 'telephone'
$email = Get-OptionalPropertyValue -Object $config.website -PropertyName 'email'
$address = Get-OptionalPropertyValue -Object $config.website -PropertyName 'address'
$creditCode = Get-OptionalPropertyValue -Object $config.company -PropertyName 'unified_social_credit_code'
$foundingDate = Get-OptionalPropertyValue -Object $config.company -PropertyName 'founding_date'

if (-not (Test-Present -Value $telephone)) {
    Add-Warning -Warnings $warnings -Code 'missing_telephone' -Message 'website.telephone is empty; public contact conversion may be weaker.'
}
if (-not (Test-Present -Value $email)) {
    Add-Warning -Warnings $warnings -Code 'missing_email' -Message 'website.email is empty; support and lead handoff records may be incomplete.'
}
if (-not (Test-Present -Value $address)) {
    Add-Warning -Warnings $warnings -Code 'missing_address' -Message 'website.address is empty; organization structured data will be less complete.'
}
if (-not (Test-Present -Value $creditCode)) {
    Add-Warning -Warnings $warnings -Code 'missing_credit_code' -Message 'company.unified_social_credit_code is empty; archive identity evidence is incomplete.'
}
if (-not (Test-Present -Value $foundingDate)) {
    Add-Warning -Warnings $warnings -Code 'missing_founding_date' -Message 'company.founding_date is empty; organization structured data is less complete.'
}

$review = [ordered]@{
    review_type = 'tongzhuo_customer_config_review'
    status = if ($warnings.Count -gt 0) { 'ready_with_warnings' } else { 'ready' }
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    config_path = $resolvedConfig
    customer = [ordered]@{
        slug = $customerSlug
        company_name = [string] $validated.company_name
        short_name = [string] $validated.short_name
        service_count = [int] $validated.service_count
    }
    endpoints = [ordered]@{
        website = $siteUrl
        llms_txt = "$siteUrl/llms.txt"
        llms_full = "$siteUrl/llms-full.txt"
        sitemap = "$siteUrl/sitemap.xml"
        feed = "$siteUrl/feed.xml"
        geoflow_admin = "$geoflowBaseUrl/geo_admin"
        publisher_assistant = "$geoflowBaseUrl/geo_admin/publisher-assistant"
        publisher_devices = "$geoflowBaseUrl/geo_admin/publisher-devices"
        distribution = "$geoflowBaseUrl/geo_admin/distribution"
        contact_leads = "$geoflowBaseUrl/geo_admin/contact-leads"
        desktop_health = "http://127.0.0.1:$desktopAgentPort/healthz"
    }
    ports = [ordered]@{
        legacy_publisher_assistant = $publisherPort
        desktop_agent = $desktopAgentPort
        separated = ($publisherPort -ne $desktopAgentPort)
    }
    content = [ordered]@{
        services = @($config.company.services)
        robots_enabled = [bool] $config.website.robots_enabled
        ai_files_enabled = [bool] $config.website.ai_files_enabled
    }
    contacts = [ordered]@{
        telephone_present = Test-Present -Value $telephone
        email_present = Test-Present -Value $email
        address_present = Test-Present -Value $address
        credit_code_present = Test-Present -Value $creditCode
        founding_date_present = Test-Present -Value $foundingDate
    }
    validation = [ordered]@{
        strict_config_validation = 'passed'
        api_token_empty = $true
        desktop_and_legacy_ports_different = ($publisherPort -ne $desktopAgentPort)
    }
    warnings = @($warnings)
    security_boundary = [ordered]@{
        geoflow_api_token_must_be_empty_before_packaging = $true
        platform_credentials_stay_local = $true
        browser_profiles_excluded_from_delivery = $true
        public_website_prices_excluded = $true
    }
}

$review | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutputPath -Encoding UTF8

$endpointRows = @($review.endpoints.GetEnumerator() | ForEach-Object {
    "| $($_.Key) | $($_.Value) |"
})
$serviceLines = @($review.content.services | ForEach-Object { "- $_" })
$warningLines = if ($warnings.Count -gt 0) {
    @($warnings | ForEach-Object { "- $($_.code): $($_.message)" })
} else {
    @('- No warnings.')
}

$markdown = @(
    "# $customerSlug Customer Config Review",
    '',
    "Status: $($review.status)",
    "Generated at: $($review.generated_at)",
    "Customer: $($review.customer.company_name)",
    "Short name: $($review.customer.short_name)",
    '',
    '## Endpoints',
    '',
    '| Name | URL |',
    '| --- | --- |'
) + $endpointRows + @(
    '',
    '## Ports',
    '',
    "- Legacy publisher assistant: $publisherPort",
    "- Desktop agent: $desktopAgentPort",
    "- Separated: $($review.ports.separated)",
    '',
    '## Services',
    ''
) + $serviceLines + @(
    '',
    '## Contact Completeness',
    '',
    "- Telephone present: $($review.contacts.telephone_present)",
    "- Email present: $($review.contacts.email_present)",
    "- Address present: $($review.contacts.address_present)",
    "- Credit code present: $($review.contacts.credit_code_present)",
    "- Founding date present: $($review.contacts.founding_date_present)",
    '',
    '## Warnings',
    ''
) + $warningLines + @(
    '',
    '## Security Boundary',
    '',
    '- GEOFlow API Token must remain empty before packaging.',
    '- Third-party platform credentials stay on the local operator computer.',
    '- Browser profiles and runtime data are excluded from delivery packages.',
    '- Public website packages must not contain service prices.'
)

Set-Content -LiteralPath $resolvedOutputPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

$result = [ordered]@{
    status = 'created'
    review_status = [string] $review.status
    config_review = $resolvedOutputPath
    config_review_json = $resolvedJsonOutputPath
    warning_count = [int] $warnings.Count
    customer_slug = $customerSlug
}
$result | ConvertTo-Json -Depth 4 | Write-Output
