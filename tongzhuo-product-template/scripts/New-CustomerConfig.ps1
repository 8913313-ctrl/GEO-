[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$CustomerSlug,
    [Parameter(Mandatory = $true)] [string]$CompanyName,
    [Parameter(Mandatory = $true)] [string]$ShortName,
    [Parameter(Mandatory = $true)] [uri]$SiteUrl,
    [uri]$GeoFlowBaseUrl,
    [uri]$WorkbenchUrl,
    [string]$OutputPath = '',
    [string]$AlternateName = '',
    [string]$Description = '',
    [string[]]$Services = @('GEO optimization', 'Short video operations', 'Enterprise AI implementation'),
    [string]$Telephone = '',
    [string]$Email = '',
    [string]$Address = '',
    [string]$AddressRegion = '',
    [string]$UnifiedSocialCreditCode = '',
    [string]$FoundingDate = '',
    [int]$PublisherPort = 18180,
    [int]$DesktopAgentPort = 18280,
    [int]$PollSeconds = 20,
    [int]$DesktopPollSeconds = 20,
    [ValidateSet('publish', 'draft')] [string]$PublishMode = 'publish',
    [ValidateSet('chromium', 'chrome', 'msedge')] [string]$BrowserChannel = 'chromium',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Join-Path $rootPath 'dist\configs') "$CustomerSlug.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
if ((Test-Path $resolvedOutput) -and -not $Force) {
    throw "Customer config already exists: $resolvedOutput. Use -Force to replace it."
}
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null

if ([string]::IsNullOrWhiteSpace($AlternateName)) {
    $AlternateName = $ShortName
}
if ([string]::IsNullOrWhiteSpace($Description)) {
    $Description = "$ShortName GEO growth suite customer configuration."
}
if ($null -eq $GeoFlowBaseUrl) {
    $GeoFlowBaseUrl = [uri]'http://127.0.0.1:18080'
}
if ($null -eq $WorkbenchUrl) {
    $WorkbenchUrl = $SiteUrl
}

$config = [ordered]@{
    customer_slug = $CustomerSlug
    company = [ordered]@{
        legal_name = $CompanyName
        brand_name = $ShortName
        alternate_name = $AlternateName
        description = $Description
        services = @($Services)
        unified_social_credit_code = $UnifiedSocialCreditCode
        founding_date = $FoundingDate
    }
    website = [ordered]@{
        site_url = $SiteUrl.AbsoluteUri.TrimEnd('/')
        workbench_url = $WorkbenchUrl.AbsoluteUri.TrimEnd('/')
        telephone = $Telephone
        email = $Email
        address = $Address
        address_region = $AddressRegion
        robots_enabled = $true
        ai_files_enabled = $true
    }
    geoflow = [ordered]@{
        base_url = $GeoFlowBaseUrl.AbsoluteUri.TrimEnd('/')
        admin_path = 'geo_admin'
        api_token = ''
    }
    publisher_assistant = [ordered]@{
        port = $PublisherPort
        poll_seconds = $PollSeconds
        publish_mode = $PublishMode
        browser_channel = $BrowserChannel
    }
    desktop_agent = [ordered]@{
        port = $DesktopAgentPort
        poll_seconds = $DesktopPollSeconds
        capabilities = @('zhihu', 'wechat_mp', 'toutiao', 'zip-download')
    }
}

$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8
$validatedConfigJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedOutput
$validatedConfig = $validatedConfigJson | ConvertFrom-Json

$result = [ordered]@{
    status = 'created'
    config_path = $resolvedOutput
    customer_slug = [string] $validatedConfig.customer_slug
    company_name = [string] $validatedConfig.company_name
    site_url = [string] $validatedConfig.site_url
    geoflow_base_url = [string] $validatedConfig.geoflow_base_url
    publisher_port = [int] $validatedConfig.publisher_port
    desktop_agent_port = [int] $validatedConfig.desktop_agent_port
}
$result | ConvertTo-Json -Depth 4 | Write-Output
