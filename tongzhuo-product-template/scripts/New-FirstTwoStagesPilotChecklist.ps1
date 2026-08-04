[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$ReleaseManifestPath,
    [string]$PreviewPath = '',
    [string]$OutputPath = '',
    [string]$JsonOutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-ReleaseArtifactPath {
    param(
        [Parameter(Mandatory = $true)] [string]$BaseDirectory,
        [Parameter(Mandatory = $true)] [string]$PathOrFile
    )

    if ([string]::IsNullOrWhiteSpace($PathOrFile)) {
        throw 'Release artifact path is empty.'
    }

    $localCandidate = [IO.Path]::GetFullPath((Join-Path $BaseDirectory (Split-Path $PathOrFile -Leaf)))
    if (Test-Path $localCandidate) {
        return $localCandidate
    }

    $absoluteCandidate = [IO.Path]::GetFullPath($PathOrFile)
    if (Test-Path $absoluteCandidate) {
        return $absoluteCandidate
    }

    throw "Release artifact not found: $PathOrFile"
}

function New-PilotStep {
    param(
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Owner,
        [Parameter(Mandatory = $true)] [string]$Item,
        [Parameter(Mandatory = $true)] [string]$Evidence,
        [string]$Command = ''
    )
    [ordered]@{
        stage = $Stage
        owner = $Owner
        item = $Item
        evidence = $Evidence
        command = $Command
        status = 'unchecked'
    }
}

$resolvedManifestPath = (Resolve-Path $ReleaseManifestPath).Path
$releaseDirectory = Split-Path $resolvedManifestPath -Parent
$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$deliveryFile = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryFile)) {
    $deliveryFile = [string] $manifest.delivery_package.path
}
$resolvedDeliveryPackagePath = Resolve-ReleaseArtifactPath -BaseDirectory $releaseDirectory -PathOrFile $deliveryFile
$deliveryHash = (Get-FileHash -LiteralPath $resolvedDeliveryPackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedHash = ([string] $manifest.delivery_package.sha256).ToLowerInvariant()
if (-not [string]::IsNullOrWhiteSpace($expectedHash) -and $deliveryHash -ne $expectedHash) {
    throw "Delivery package hash mismatch. Expected $expectedHash, got $deliveryHash"
}

$preview = $null
if (-not [string]::IsNullOrWhiteSpace($PreviewPath)) {
    $resolvedPreviewPath = (Resolve-Path $PreviewPath).Path
    $preview = Get-Content -LiteralPath $resolvedPreviewPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string] $preview.status -ne 'ready') {
        throw "First two stages preview must be ready before pilot checklist generation. Status: $($preview.status)"
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $releaseDirectory "$($manifest.release_slug)-FIRST-TWO-STAGES-PILOT.md"
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null

if ([string]::IsNullOrWhiteSpace($JsonOutputPath)) {
    $JsonOutputPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.json')
}
$resolvedJsonOutputPath = [IO.Path]::GetFullPath($JsonOutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedJsonOutputPath -Parent) | Out-Null

$siteUrl = ([string] $manifest.site_url).TrimEnd('/')
$geoflowBaseUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
$adminBase = "$geoflowBaseUrl/geo_admin"
$desktopPort = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 18280 }

$checks = @(
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'server_engineer' -Item 'Extract the delivery package and verify the package hash.' -Evidence 'SHA256 matches release manifest and .sha256 file.' -Command '.\Start-CustomerDelivery.ps1 -Action Verify'
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'server_engineer' -Item 'Install or dry-run GEOFlow server overrides.' -Evidence 'GEOFlow admin routes, article routes, lead routes, distribution routes, and publisher device routes are available.' -Command '.\Start-CustomerDelivery.ps1 -Action ServerDryRunCommand -LaravelRoot /www/wwwroot/geoflow'
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'geo_operator' -Item 'Open the public website and confirm homepage, service pages, insights, article detail, about, and contact pages.' -Evidence "$siteUrl opens and pages use the customer brand."
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'geo_operator' -Item 'Confirm AI-readable entrypoints.' -Evidence "$siteUrl/robots.txt, $siteUrl/sitemap.xml, $siteUrl/feed.xml, $siteUrl/llms.txt, and $siteUrl/llms-full.txt return readable content."
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'geo_operator' -Item 'Publish one GEO optimization, short-video operation, or enterprise AI article from GEOFlow to the website.' -Evidence 'Article appears in industry insights list, article detail page, sitemap, feed, and llms entrypoints.'
    New-PilotStep -Stage 'stage_1_cloud_workbench_ai_website' -Owner 'sales_or_operator' -Item 'Submit one website contact lead without opening a mail client.' -Evidence "$adminBase/contact-leads shows the submitted lead."

    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'operator' -Item 'Install and start the Windows desktop publisher agent.' -Evidence "http://127.0.0.1:$desktopPort/healthz returns healthy."
    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'operator' -Item 'Bind the desktop agent to GEOFlow.' -Evidence "$adminBase/publisher-devices shows the device online."
    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'operator' -Item 'Log in to first-batch platforms on the local operator computer.' -Evidence 'WeChat MP, Zhihu, and Toutiao login state stays local; passwords, cookies, captcha state, and browser profiles are not uploaded.'
    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'geo_operator' -Item 'Create a distribution task from a published article.' -Evidence "$adminBase/distribution shows a task for wechat_mp, zhihu, toutiao, or zip-download."
    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'operator' -Item 'Let the desktop agent claim the distribution task.' -Evidence 'Task status changes to processing, draft, published, exported, failed, or needs manual confirmation.'
    New-PilotStep -Stage 'stage_2_distribution_desktop_agent' -Owner 'operator' -Item 'Verify result writeback.' -Evidence 'GEOFlow distribution job displays platform result, failure reason, platform URL, or local export path.'
)

$checklist = [ordered]@{
    checklist_type = 'tongzhuo_first_two_stages_pilot_checklist'
    status = 'ready_for_pilot'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $manifest.product
    version = [string] $manifest.version
    release_slug = [string] $manifest.release_slug
    customer = [ordered]@{
        slug = [string] $manifest.customer_slug
        company_name = [string] $manifest.company_name
        short_name = [string] $manifest.short_name
        site_url = $siteUrl
        geoflow_base_url = $geoflowBaseUrl
        admin_base = $adminBase
        desktop_agent_port = $desktopPort
    }
    package = [ordered]@{
        path = $resolvedDeliveryPackagePath
        sha256 = $deliveryHash
        bytes = [int64] (Get-Item -LiteralPath $resolvedDeliveryPackagePath).Length
    }
    preview = if ($null -ne $preview) {
        [ordered]@{
            status = [string] $preview.status
            stage_1_status = [string] $preview.summary.stage_1_status
            stage_2_status = [string] $preview.summary.stage_2_status
            failed_required_check_count = [int] $preview.summary.failed_required_check_count
        }
    } else {
        $null
    }
    steps = $checks
    acceptance_rule = 'All checklist steps must be checked by the assigned owner before the pilot is considered accepted.'
    security_boundary = [ordered]@{
        no_public_prices = $true
        customer_api_tokens_excluded = [bool] $manifest.gates.excludes_customer_api_token
        platform_credentials_excluded = [bool] $manifest.gates.excludes_platform_credentials
        browser_profiles_excluded = [bool] $manifest.gates.excludes_browser_profiles
        platform_login_state_stays_local = $true
    }
}

$checklist | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedJsonOutputPath -Encoding UTF8

$stepRows = @($checks | ForEach-Object {
    "| $($_.stage) | $($_.owner) | $($_.item) | $($_.evidence) | $($_.command) |  |"
})

$markdown = @(
    '# Tongzhuo First Two Stages Pilot Checklist',
    '',
    "Status: $($checklist.status)",
    "Product: $($checklist.product)",
    "Version: $($checklist.version)",
    "Release: $($checklist.release_slug)",
    "Customer: $($checklist.customer.company_name)",
    "Website: $siteUrl",
    "GEOFlow: $geoflowBaseUrl",
    "Desktop agent health: http://127.0.0.1:$desktopPort/healthz",
    '',
    '## Package',
    '',
    "- Delivery package: $resolvedDeliveryPackagePath",
    "- SHA256: $deliveryHash",
    '',
    '## Pilot Steps',
    '',
    '| Stage | Owner | Item | Evidence | Command | Signoff |',
    '| --- | --- | --- | --- | --- | --- |'
) + $stepRows + @(
    '',
    '## Acceptance Rule',
    '',
    $checklist.acceptance_rule,
    '',
    '## Security Boundary',
    '',
    '- Public website content does not include service prices.',
    '- GEOFlow API Tokens are excluded from the delivery package.',
    '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
    '- The server workbench tracks tasks and results but does not store third-party platform passwords.'
)
Set-Content -LiteralPath $resolvedOutputPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    pilot_status = [string] $checklist.status
    checklist = $resolvedOutputPath
    json = $resolvedJsonOutputPath
    step_count = [int] $checks.Count
    version = [string] $manifest.version
} | ConvertTo-Json -Depth 4 | Write-Output
