[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ConfigPath,
    [string]$OutputRoot = '',
    [string]$DeliveryOutputPath = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedConfig = (Resolve-Path $ConfigPath).Path
$validatedConfigJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedConfig
$validatedConfig = $validatedConfigJson | ConvertFrom-Json
$config = Get-Content -LiteralPath $resolvedConfig -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-RequiredValue {
    param(
        [Parameter(Mandatory = $true)] [object]$Value,
        [Parameter(Mandatory = $true)] [string]$Name
    )
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        throw "Missing required config value: $Name"
    }
    return [string]$Value
}

function Get-OptionalValue {
    param([object]$Value)
    if ($null -eq $Value) {
        return ''
    }
    return [string]$Value
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
    return Get-OptionalValue -Value $property.Value
}

$customerSlug = [string] $validatedConfig.customer_slug
$companyName = Get-RequiredValue -Value $config.company.legal_name -Name 'company.legal_name'
$shortName = Get-RequiredValue -Value $config.company.brand_name -Name 'company.brand_name'
$siteUrl = [uri](Get-RequiredValue -Value $config.website.site_url -Name 'website.site_url')
$geoflowBaseUrl = [string] $validatedConfig.geoflow_base_url

$workbenchUrlValue = Get-OptionalPropertyValue -Object $config.website -PropertyName 'workbench_url'
$telephone = Get-OptionalPropertyValue -Object $config.website -PropertyName 'telephone'
$email = Get-OptionalPropertyValue -Object $config.website -PropertyName 'email'
$streetAddress = Get-OptionalPropertyValue -Object $config.website -PropertyName 'address'
$addressRegion = Get-OptionalPropertyValue -Object $config.website -PropertyName 'address_region'
$creditCode = Get-OptionalPropertyValue -Object $config.company -PropertyName 'unified_social_credit_code'
$foundingDate = Get-OptionalPropertyValue -Object $config.company -PropertyName 'founding_date'

$publisherPort = [int] $validatedConfig.publisher_port
$desktopAgentPort = [int] $validatedConfig.desktop_agent_port
$desktopPollSeconds = [int] $validatedConfig.desktop_poll_seconds

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $rootPath 'dist\customers'
}
$resolvedOutputRoot = [IO.Path]::GetFullPath($OutputRoot)
New-Item -ItemType Directory -Force -Path $resolvedOutputRoot | Out-Null

$customerRoot = Join-Path $resolvedOutputRoot $customerSlug
if (Test-Path $customerRoot) {
    if (-not $Force) {
        throw "Customer output path already exists: $customerRoot. Use -Force to replace it."
    }
    Remove-Item -LiteralPath $customerRoot -Recurse -Force
}

$newCustomerArgs = @{
    CustomerSlug = $customerSlug
    CompanyName = $companyName
    ShortName = $shortName
    SiteUrl = $siteUrl
    GeoFlowBaseUrl = $geoflowBaseUrl
    PublisherPort = $publisherPort
    DesktopAgentPort = $desktopAgentPort
    DesktopPollSeconds = $desktopPollSeconds
    Telephone = $telephone
    Email = $email
    StreetAddress = $streetAddress
    AddressRegion = $addressRegion
    UnifiedSocialCreditCode = $creditCode
    FoundingDate = $foundingDate
    OutputPath = $customerRoot
}
if (-not [string]::IsNullOrWhiteSpace($workbenchUrlValue)) {
    $newCustomerArgs.WorkbenchUrl = [uri]$workbenchUrlValue
}

& (Join-Path $rootPath 'scripts\New-Customer.ps1') @newCustomerArgs

if ([string]::IsNullOrWhiteSpace($DeliveryOutputPath)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $DeliveryOutputPath = Join-Path $resolvedOutputRoot "$customerSlug-tongzhuo-geo-delivery-$stamp.zip"
}
$resolvedDeliveryOutput = [IO.Path]::GetFullPath($DeliveryOutputPath)
& (Join-Path $rootPath 'scripts\Package-CustomerDelivery.ps1') -Root $customerRoot -OutputPath $resolvedDeliveryOutput

$result = [ordered]@{
    customer_slug = $customerSlug
    customer_root = $customerRoot
    delivery_package = $resolvedDeliveryOutput
    geoflow_base_url = $geoflowBaseUrl.TrimEnd('/')
    site_url = $siteUrl.AbsoluteUri.TrimEnd('/')
    publisher_port = $publisherPort
    desktop_agent_port = $desktopAgentPort
}
$result | ConvertTo-Json -Depth 4 | Write-Output
