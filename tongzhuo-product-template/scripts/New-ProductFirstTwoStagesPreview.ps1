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
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath

function New-FileCheck {
    param(
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Id,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Purpose,
        [bool]$Required = $true
    )
    $fullPath = Join-Path $rootPath $Path
    $exists = Test-Path -LiteralPath $fullPath
    [pscustomobject][ordered]@{
        stage = $Stage
        id = $Id
        name = $Name
        path = $Path
        required = $Required
        passed = if ($Required) { $exists } else { $true }
        status = if ($exists) { 'present' } elseif ($Required) { 'missing' } else { 'optional' }
        purpose = $Purpose
    }
}

function New-TextCheck {
    param(
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Id,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Pattern,
        [Parameter(Mandatory = $true)] [string]$Purpose,
        [bool]$Required = $true
    )
    $fullPath = Join-Path $rootPath $Path
    $exists = Test-Path -LiteralPath $fullPath
    $matched = $false
    if ($exists) {
        $text = Get-Content -LiteralPath $fullPath -Raw -Encoding UTF8
        $matched = $text -match $Pattern
    }
    [pscustomobject][ordered]@{
        stage = $Stage
        id = $Id
        name = $Name
        path = $Path
        required = $Required
        passed = if ($Required) { $exists -and $matched } else { $true }
        status = if ($exists -and $matched) { 'matched' } elseif ($exists) { 'not_matched' } elseif ($Required) { 'missing' } else { 'optional' }
        purpose = $Purpose
    }
}

function New-PlatformReadyCheck {
    param(
        [Parameter(Mandatory = $true)] [string]$Stage,
        [Parameter(Mandatory = $true)] [string]$Id,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$PlatformId,
        [Parameter(Mandatory = $true)] [string]$Purpose
    )
    $path = 'desktop-agent/src/platforms.js'
    $fullPath = Join-Path $rootPath $path
    $exists = Test-Path -LiteralPath $fullPath
    $ready = $false
    if ($exists) {
        $moduleUri = ([uri] $fullPath).AbsoluteUri
        $probe = "import { platformSupport } from '$moduleUri'; if (platformSupport('$PlatformId') !== 'ready') process.exit(1);"
        & node --input-type=module -e $probe
        $ready = $LASTEXITCODE -eq 0
    }
    [pscustomobject][ordered]@{
        stage = $Stage
        id = $Id
        name = $Name
        path = $path
        required = $true
        passed = $exists -and $ready
        status = if ($exists -and $ready) { 'ready' } elseif ($exists) { 'not_ready' } else { 'missing' }
        purpose = $Purpose
    }
}

$checks = @(
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'website_home' -Name 'Website home' -Path 'website/index.html' -Purpose 'Company homepage for human visitors and AI discovery.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'website_products' -Name 'Service product pages' -Path 'website/products.html' -Purpose 'Service overview for GEO optimization, short video operation, and enterprise AI landing.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'website_insights' -Name 'Industry insights list' -Path 'website/insights.html' -Purpose 'Blog-style article list for industry views and GEO content publishing.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'website_contact' -Name 'Contact and lead page' -Path 'website/contact.html' -Purpose 'Lead capture entrypoint for customer inquiries.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'robots' -Name 'robots.txt' -Path 'website/robots.txt' -Purpose 'Crawler access policy.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'sitemap' -Name 'sitemap.xml' -Path 'website/sitemap.xml' -Purpose 'Search and AI crawler URL discovery.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'feed' -Name 'feed.xml' -Path 'website/feed.xml' -Purpose 'RSS/Atom-style article feed for content discovery.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'llms' -Name 'llms.txt' -Path 'website/llms.txt' -Purpose 'AI-readable site summary and important URLs.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'llms_full' -Name 'llms-full.txt' -Path 'website/llms-full.txt' -Purpose 'Expanded AI-readable company and service context.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'site_article_controller' -Name 'GEOFlow site article controller' -Path 'geoflow-integration/server-overrides/app/Http/Controllers/Site/ArticleController.php' -Purpose 'Connect published GEOFlow articles to website pages and feeds.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'contact_leads' -Name 'Lead management' -Path 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/ContactLeadController.php' -Purpose 'Admin-side customer lead management.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'lead_api' -Name 'Lead submit API' -Path 'geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/ContactLeadController.php' -Purpose 'Website form submit API.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'contact_lead_model' -Name 'Lead data model' -Path 'geoflow-integration/server-overrides/app/Models/ContactLead.php' -Purpose 'Persist website customer inquiries.'
    New-FileCheck -Stage 'stage_1_cloud_workbench_ai_website' -Id 'contact_lead_admin_view' -Name 'Lead admin view' -Path 'geoflow-integration/server-overrides/resources/views/admin/contact-leads/index.blade.php' -Purpose 'Admin table for submitted website leads.'

    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'desktop_agent_entry' -Name 'Desktop agent entry' -Path 'desktop-agent/src/main.js' -Purpose 'Windows local publisher runtime entrypoint.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'desktop_agent_ui' -Name 'Desktop agent local console' -Path 'desktop-agent/public/index.html' -Purpose 'Local status, diagnostics, and operator console.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'geoflow_client' -Name 'GEOFlow client' -Path 'desktop-agent/src/geoflow-client.js' -Purpose 'Claim tasks, heartbeat, and write result back to GEOFlow.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'platform_browser' -Name 'Platform browser runtime' -Path 'desktop-agent/src/platform-browser.js' -Purpose 'Local browser automation and profile boundary.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'platform_catalog' -Name 'Platform catalog' -Path 'desktop-agent/src/platforms.js' -Purpose 'Supported platform directory and support state.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'wechat_adapter' -Name 'WeChat MP adapter' -Path 'desktop-agent/src/adapters/wechat-mp-adapter.js' -Purpose 'First-batch ready platform adapter.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'zhihu_adapter' -Name 'Zhihu adapter' -Path 'desktop-agent/src/adapters/zhihu-adapter.js' -Purpose 'First-batch ready platform adapter.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'toutiao_adapter' -Name 'Toutiao adapter' -Path 'desktop-agent/src/adapters/toutiao-adapter.js' -Purpose 'First-batch ready platform adapter.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'publisher_device_api' -Name 'Publisher device API' -Path 'geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php' -Purpose 'Device registration, heartbeat, task claim, and result writeback.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'publisher_device_model' -Name 'Publisher device model' -Path 'geoflow-integration/server-overrides/app/Models/PublisherDevice.php' -Purpose 'Persist local execution device state.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'distribution_controller' -Name 'Distribution controller' -Path 'geoflow-integration/server-overrides/app/Http/Controllers/Admin/DistributionController.php' -Purpose 'Admin distribution task management.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'distribution_admin_view' -Name 'Distribution admin view' -Path 'geoflow-integration/server-overrides/resources/views/admin/distribution/index.blade.php' -Purpose 'Admin-side distribution channel and task surface.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'publisher_devices_view' -Name 'Publisher devices view' -Path 'geoflow-integration/server-overrides/resources/views/admin/publisher-devices/index.blade.php' -Purpose 'Admin-side local device status surface.'
    New-FileCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'device_protocol_doc' -Name 'Publisher device protocol' -Path 'docs/PUBLISHER-DEVICE-PROTOCOL.md' -Purpose 'Cloud workbench and desktop agent protocol boundary.'
    New-PlatformReadyCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'wechat_ready' -Name 'WeChat MP ready platform' -PlatformId 'wechat_mp' -Purpose 'WeChat MP is included in the first ready platform batch.'
    New-PlatformReadyCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'zhihu_ready' -Name 'Zhihu ready platform' -PlatformId 'zhihu' -Purpose 'Zhihu is included in the first ready platform batch.'
    New-PlatformReadyCheck -Stage 'stage_2_distribution_desktop_agent' -Id 'toutiao_ready' -Name 'Toutiao ready platform' -PlatformId 'toutiao' -Purpose 'Toutiao is included in the first ready platform batch.'
)

$stage1Checks = @($checks | Where-Object { [string] $_.stage -eq 'stage_1_cloud_workbench_ai_website' })
$stage2Checks = @($checks | Where-Object { [string] $_.stage -eq 'stage_2_distribution_desktop_agent' })

function New-StageSummary {
    param(
        [Parameter(Mandatory = $true)] [string]$Id,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [object[]]$StageChecks
    )
    $required = @($StageChecks | Where-Object { [bool] $_.required })
    $failed = @($required | Where-Object { -not [bool] $_.passed })
    [ordered]@{
        id = $Id
        name = $Name
        status = if ($failed.Count -eq 0) { 'ready' } else { 'needs_attention' }
        check_count = [int] $StageChecks.Count
        required_check_count = [int] $required.Count
        failed_required_check_count = [int] $failed.Count
        failed_required_checks = @($failed | ForEach-Object { [string] $_.id })
    }
}

$stageSummaries = @(
    New-StageSummary -Id 'stage_1_cloud_workbench_ai_website' -Name 'Stage 1: cloud GEO workbench plus AI-friendly website' -StageChecks $stage1Checks
    New-StageSummary -Id 'stage_2_distribution_desktop_agent' -Name 'Stage 2: GEOFlow distribution plus Windows desktop publisher agent' -StageChecks $stage2Checks
)

$failedChecks = @($checks | Where-Object { [bool] $_.required -and -not [bool] $_.passed })
$status = if ($failedChecks.Count -eq 0) { 'ready' } else { 'needs_attention' }

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $distRoot = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
    $OutputPath = Join-Path $distRoot 'tongzhuo-product-first-two-stages-preview.json'
}
$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutputPath -Parent) | Out-Null
$markdownPath = [IO.Path]::ChangeExtension($resolvedOutputPath, '.md')

$preview = [ordered]@{
    preview_type = 'tongzhuo_product_first_two_stages_preview'
    status = $status
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $product.product
    version = [string] $product.version
    root = $rootPath
    stages = $stageSummaries
    summary = [ordered]@{
        stage_count = [int] $stageSummaries.Count
        check_count = [int] $checks.Count
        failed_required_check_count = [int] $failedChecks.Count
        stage_1_status = [string] $stageSummaries[0].status
        stage_2_status = [string] $stageSummaries[1].status
    }
    checks = $checks
    demo_flow = @(
        'Open the public website home, service pages, insights list, article detail, and contact page.',
        'Publish one GEOFlow article to the website and confirm sitemap, feed, llms.txt, and llms-full.txt expose AI-readable entrypoints.',
        'Submit one contact form and confirm the lead appears in the GEOFlow admin lead list.',
        'Start the Windows desktop publisher agent and confirm the local console diagnostics are healthy.',
        'Bind the desktop agent to GEOFlow and confirm the publisher device appears online in the admin workbench.',
        'Create a distribution task for WeChat MP, Zhihu, or Toutiao and confirm the desktop agent claims it.',
        'Publish, save draft, or export fallback content locally, then confirm status and evidence are written back to GEOFlow.'
    )
    boundaries = [ordered]@{
        no_public_prices = $true
        platform_credentials_stay_local = $true
        browser_profiles_excluded_from_product_release = $true
        server_does_not_store_platform_passwords = $true
        direct_publish_must_have_draft_or_manual_fallback = $true
    }
}

$preview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

$stageRows = @($stageSummaries | ForEach-Object {
    "| $($_.name) | $($_.status) | $($_.check_count) | $($_.failed_required_check_count) |"
})
$checkRows = @($checks | ForEach-Object {
    "| $($_.stage) | $($_.name) | $($_.status) | $($_.path) | $($_.purpose) |"
})
$demoLines = @($preview.demo_flow | ForEach-Object { "- [ ] $_" })

$markdown = @(
    '# Tongzhuo Product First Two Stages Preview',
    '',
    "Status: $status",
    "Product: $($preview.product)",
    "Version: $($preview.version)",
    "Generated at: $($preview.generated_at)",
    '',
    '## Stage Summary',
    '',
    '| Stage | Status | Checks | Failed Required |',
    '| --- | --- | ---: | ---: |'
) + $stageRows + @(
    '',
    '## Demo Flow',
    ''
) + $demoLines + @(
    '',
    '## Checks',
    '',
    '| Stage | Name | Status | Path | Purpose |',
    '| --- | --- | --- | --- | --- |'
) + $checkRows + @(
    '',
    '## Boundaries',
    '',
    '- Public website content does not include service prices.',
    '- Platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
    '- The server workbench creates and tracks distribution tasks but does not store third-party platform passwords.',
    '- Direct publishing must keep draft, export, or manual confirmation fallback paths.'
)
Set-Content -LiteralPath $markdownPath -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    preview_status = $status
    preview = $resolvedOutputPath
    markdown = $markdownPath
    failed_required_check_count = [int] $failedChecks.Count
    version = [string] $product.version
} | ConvertTo-Json -Depth 4 | Write-Output
