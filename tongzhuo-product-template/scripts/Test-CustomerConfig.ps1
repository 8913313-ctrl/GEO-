[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedConfig = (Resolve-Path $ConfigPath).Path
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

function Test-UriValue {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name,
        [switch]$AllowHttp
    )

    try {
        $uri = [uri]$Value
    } catch {
        throw "$Name must be a valid URL."
    }
    if (-not $uri.IsAbsoluteUri) {
        throw "$Name must be an absolute URL."
    }
    if ($uri.Scheme -notin @('http', 'https')) {
        throw "$Name must use http or https."
    }
    if (-not $AllowHttp -and $uri.Scheme -ne 'https') {
        throw "$Name should use https for production delivery."
    }
    return $uri
}

$customerSlug = Get-RequiredValue -Value $config.customer_slug -Name 'customer_slug'
if ($customerSlug -notmatch '^[a-z0-9][a-z0-9-]{1,40}$') {
    throw 'customer_slug must match: ^[a-z0-9][a-z0-9-]{1,40}$'
}

$companyName = Get-RequiredValue -Value $config.company.legal_name -Name 'company.legal_name'
$shortName = Get-RequiredValue -Value $config.company.brand_name -Name 'company.brand_name'
$siteUrl = Test-UriValue -Value (Get-RequiredValue -Value $config.website.site_url -Name 'website.site_url') -Name 'website.site_url'
$workbenchUrlValue = Get-OptionalValue -Value $config.website.workbench_url
if (-not [string]::IsNullOrWhiteSpace($workbenchUrlValue)) {
    Test-UriValue -Value $workbenchUrlValue -Name 'website.workbench_url' | Out-Null
}

$geoflowBaseUrl = Get-OptionalValue -Value $config.geoflow.base_url
if (-not [string]::IsNullOrWhiteSpace($geoflowBaseUrl)) {
    Test-UriValue -Value $geoflowBaseUrl -Name 'geoflow.base_url' -AllowHttp | Out-Null
}

$apiToken = Get-OptionalValue -Value $config.geoflow.api_token
if (-not [string]::IsNullOrWhiteSpace($apiToken)) {
    throw 'geoflow.api_token must be empty before packaging. Configure API Token after deployment.'
}

$publisherPort = 19180
if ($null -ne $config.publisher_assistant -and $null -ne $config.publisher_assistant.port) {
    $publisherPort = [int]$config.publisher_assistant.port
}
if ($publisherPort -lt 1024 -or $publisherPort -gt 65535) {
    throw 'publisher_assistant.port must be between 1024 and 65535.'
}

$pollSeconds = 20
if ($null -ne $config.publisher_assistant -and $null -ne $config.publisher_assistant.poll_seconds) {
    $pollSeconds = [int]$config.publisher_assistant.poll_seconds
}
if ($pollSeconds -lt 5 -or $pollSeconds -gt 3600) {
    throw 'publisher_assistant.poll_seconds must be between 5 and 3600.'
}

$desktopAgentPort = 19380
if ($null -ne $config.desktop_agent -and $null -ne $config.desktop_agent.port) {
    $desktopAgentPort = [int]$config.desktop_agent.port
}
if ($desktopAgentPort -lt 1024 -or $desktopAgentPort -gt 65535) {
    throw 'desktop_agent.port must be between 1024 and 65535.'
}
if ($desktopAgentPort -eq $publisherPort) {
    throw 'desktop_agent.port must be different from publisher_assistant.port.'
}

$desktopPollSeconds = 20
if ($null -ne $config.desktop_agent -and $null -ne $config.desktop_agent.poll_seconds) {
    $desktopPollSeconds = [int]$config.desktop_agent.poll_seconds
}
if ($desktopPollSeconds -lt 5 -or $desktopPollSeconds -gt 3600) {
    throw 'desktop_agent.poll_seconds must be between 5 and 3600.'
}

$publishMode = Get-OptionalValue -Value $config.publisher_assistant.publish_mode
if ([string]::IsNullOrWhiteSpace($publishMode)) {
    $publishMode = 'publish'
}
if ($publishMode -notin @('publish', 'draft')) {
    throw 'publisher_assistant.publish_mode must be publish or draft.'
}

$browserChannel = Get-OptionalValue -Value $config.publisher_assistant.browser_channel
if ([string]::IsNullOrWhiteSpace($browserChannel)) {
    $browserChannel = 'chromium'
}
if ($browserChannel -notin @('chromium', 'chrome', 'msedge')) {
    throw 'publisher_assistant.browser_channel must be chromium, chrome, or msedge.'
}

$services = @()
if ($null -ne $config.company.services) {
    $services = @($config.company.services)
}
if ($services.Count -eq 0) {
    throw 'company.services must contain at least one service name.'
}

$result = [ordered]@{
    customer_slug = $customerSlug
    company_name = $companyName
    short_name = $shortName
    site_url = $siteUrl.AbsoluteUri.TrimEnd('/')
    geoflow_base_url = if ([string]::IsNullOrWhiteSpace($geoflowBaseUrl)) { 'http://127.0.0.1:19080' } else { $geoflowBaseUrl.TrimEnd('/') }
    publisher_port = $publisherPort
    desktop_agent_port = $desktopAgentPort
    poll_seconds = $pollSeconds
    desktop_poll_seconds = $desktopPollSeconds
    publish_mode = $publishMode
    browser_channel = $browserChannel
    service_count = $services.Count
}
$result | ConvertTo-Json -Depth 4 | Write-Output
