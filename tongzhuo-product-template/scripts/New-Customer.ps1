[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [ValidatePattern('^[a-z0-9][a-z0-9-]{1,40}$')] [string]$CustomerSlug,
    [Parameter(Mandatory = $true)] [string]$CompanyName,
    [Parameter(Mandatory = $true)] [string]$ShortName,
    [Parameter(Mandatory = $true)] [uri]$SiteUrl,
    [string]$GeoFlowBaseUrl = 'http://127.0.0.1:18080',
    [int]$PublisherPort = 18180,
    [int]$DesktopAgentPort = 18280,
    [int]$DesktopPollSeconds = 20,
    [uri]$WorkbenchUrl,
    [string]$Telephone = '',
    [string]$Email = '',
    [string]$StreetAddress = '',
    [string]$AddressRegion = '',
    [string]$UnifiedSocialCreditCode = '',
    [string]$FoundingDate = '',
    [Parameter(Mandatory = $true)] [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destinationRoot = [IO.Path]::GetFullPath($OutputPath)
if ($null -eq $WorkbenchUrl) {
    $WorkbenchUrl = $SiteUrl
}
if (Test-Path $destinationRoot) {
    throw "Output path already exists: $destinationRoot"
}

New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
foreach ($component in @('website', 'geoflow-integration', 'publisher-assistant', 'desktop-agent', 'docs')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $component) -Destination (Join-Path $destinationRoot $component) -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'scripts') -Destination (Join-Path $destinationRoot 'scripts') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'config') -Destination (Join-Path $destinationRoot 'config') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'product.json') -Destination (Join-Path $destinationRoot 'product.json') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $destinationRoot 'publisher-assistant\.data') | Out-Null

$oldSiteUrl = 'http://127.0.0.1:18080'
$oldWorkbenchUrl = 'http://127.0.0.1:18180'
$templateSiteUrl = 'https://www.example.com'
$defaultLegalName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5qGQ54G877yI5reE5Y2a77yJ572R57uc56eR5oqA5pyJ6ZmQ5YWs5Y+4'))
$defaultShortName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5qGQ54G856eR5oqA'))
$defaultAlternateName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('54G86KeBQUk='))
$defaultRootName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5qGQ54G8'))
$defaultStreetAddress = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5YWs5Zut6KGX6YGT5Yqe5LqL5aSE5YyX6KW/5YWt6LevMjDnlLI05Y+3NeWxgkE05Y+3'))
$defaultAddressRegion = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5bGx5Lic55yB5reE5Y2a5biC5byg5bqX5Yy6'))
$defaultTelephone = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('Kzg2LTE3OC01MjAzLTA3NTY='))
$defaultEmail = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('emh1b2ppYW5haUB5ZWFoLm5ldA=='))
$defaultCreditCode = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('OTEzNzAzMDNNQUVYVDc5WTVI'))
$replacements = [ordered]@{
    $defaultLegalName = $CompanyName
    $defaultShortName = $ShortName
    $defaultAlternateName = $ShortName
    $defaultRootName = $ShortName
    $oldSiteUrl = $SiteUrl.AbsoluteUri.TrimEnd('/')
    $oldWorkbenchUrl = $WorkbenchUrl.AbsoluteUri.TrimEnd('/')
    $templateSiteUrl = $SiteUrl.AbsoluteUri.TrimEnd('/')
    $defaultTelephone = $Telephone
    $defaultEmail = $Email
    $defaultCreditCode = $UnifiedSocialCreditCode
    '2025-09-19' = $FoundingDate
    $defaultStreetAddress = $StreetAddress
    $defaultAddressRegion = $AddressRegion
    '{{CUSTOMER_TELEPHONE}}' = $Telephone
    '{{CUSTOMER_EMAIL}}' = $Email
    '{{CUSTOMER_CREDIT_CODE}}' = $UnifiedSocialCreditCode
    '{{CUSTOMER_FOUNDING_DATE}}' = $FoundingDate
    '{{CUSTOMER_STREET_ADDRESS}}' = $StreetAddress
    '{{CUSTOMER_ADDRESS_REGION}}' = $AddressRegion
}
$textExtensions = @('.html', '.xml', '.txt', '.md', '.php', '.js', '.css', '.json', '.ps1', '.cmd', '.conf')
Get-ChildItem -LiteralPath $destinationRoot -Recurse -File | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() } | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
    $updated = $content
    foreach ($pair in $replacements.GetEnumerator()) {
        $updated = $updated.Replace($pair.Key, [string]$pair.Value)
    }
    if ($updated -ne $content) {
        Set-Content -LiteralPath $_.FullName -Value $updated -Encoding UTF8
    }
}

$publisherConfig = @{
    geoflowBaseUrl = $GeoFlowBaseUrl.TrimEnd('/')
    apiToken = ''
    port = $PublisherPort
    pollSeconds = 20
    extensionDir = 'vendor/wechatsync-2.0.9'
    browserChannel = 'chromium'
    publishMode = 'publish'
}
$publisherConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destinationRoot 'publisher-assistant\.data\config.json') -Encoding UTF8

New-Item -ItemType Directory -Force -Path (Join-Path $destinationRoot 'desktop-agent\.data') | Out-Null
$desktopAgentConfig = @{
    geoflowBaseUrl = $GeoFlowBaseUrl.TrimEnd('/')
    apiToken = ''
    port = $DesktopAgentPort
    pollSeconds = $DesktopPollSeconds
    autoRun = $false
    capabilities = @('zhihu', 'wechat_mp', 'toutiao', 'zip-download')
}
$desktopAgentConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destinationRoot 'desktop-agent\.data\config.json') -Encoding UTF8

$manifest = @{
    customer_slug = $CustomerSlug
    company_name = $CompanyName
    short_name = $ShortName
    site_url = $SiteUrl.AbsoluteUri.TrimEnd('/')
    geoflow_base_url = $GeoFlowBaseUrl.TrimEnd('/')
    publisher_port = $PublisherPort
    desktop_agent_port = $DesktopAgentPort
    desktop_agent_poll_seconds = $DesktopPollSeconds
    telephone = $Telephone
    email = $Email
    address = $StreetAddress
    address_region = $AddressRegion
    unified_social_credit_code = $UnifiedSocialCreditCode
    founding_date = $FoundingDate
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destinationRoot 'customer-manifest.json') -Encoding UTF8

Write-Host "Customer product generated: $destinationRoot"
