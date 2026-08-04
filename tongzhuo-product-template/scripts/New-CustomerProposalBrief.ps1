[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$ConfigPath = '',
    [string]$CustomerSlug = '',
    [string]$CompanyName = '',
    [string]$ShortName = '',
    [string]$SiteUrl = '',
    [string]$GeoFlowBaseUrl = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath

function Assert-Required {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name
    )
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required value: $Name"
    }
}

if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    $resolvedConfig = (Resolve-Path $ConfigPath).Path
    $validatedJson = & (Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1') -ConfigPath $resolvedConfig
    $validated = $validatedJson | ConvertFrom-Json
    $config = Get-Content -LiteralPath $resolvedConfig -Raw -Encoding UTF8 | ConvertFrom-Json

    $CustomerSlug = [string] $validated.customer_slug
    $CompanyName = [string] $validated.company_name
    $ShortName = [string] $validated.short_name
    $SiteUrl = [string] $validated.site_url
    $GeoFlowBaseUrl = [string] $validated.geoflow_base_url
    $services = @($config.company.services | ForEach-Object { [string] $_ })
} else {
    Assert-Required -Value $CustomerSlug -Name 'CustomerSlug'
    Assert-Required -Value $CompanyName -Name 'CompanyName'
    Assert-Required -Value $ShortName -Name 'ShortName'
    Assert-Required -Value $SiteUrl -Name 'SiteUrl'
    if ([string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
        $GeoFlowBaseUrl = $SiteUrl.TrimEnd('/') + '/geo_admin'
    }
    $services = @('GEO optimization', 'short-video operations', 'enterprise AI implementation')
}

$site = $SiteUrl.TrimEnd('/')
$workbench = $GeoFlowBaseUrl.TrimEnd('/')
$adminUrl = if ($workbench -like '*/geo_admin') { $workbench } else { "$workbench/geo_admin" }

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $safeSlug = if ([string]::IsNullOrWhiteSpace($CustomerSlug)) { 'customer' } else { $CustomerSlug }
    $OutputPath = Join-Path (Get-Location).Path "$safeSlug-PROPOSAL-BRIEF.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null
$markdownOutput = [IO.Path]::ChangeExtension($resolvedOutput, '.md')

$serviceLines = @(
    [ordered]@{
        name = 'GEO optimization'
        purpose = 'Build an AI-readable company source through website structure, industry insights, sitemap, RSS, llms.txt, and structured data.'
        deliverables = @('AI-readable website package', 'industry insight workflow', 'AI visibility audit', 'customer acceptance evidence')
    },
    [ordered]@{
        name = 'Short-video operations'
        purpose = 'Turn business knowledge and service scenarios into repeatable content topics, scripts, and platform distribution tasks.'
        deliverables = @('topic planning', 'article-to-platform payload', 'distribution task queue', 'platform result writeback')
    },
    [ordered]@{
        name = 'Enterprise AI implementation'
        purpose = 'Connect company knowledge, content production, lead handling, and operator workflows into a practical AI-assisted operating loop.'
        deliverables = @('GEOFlow workbench', 'customer knowledge inputs', 'operator workflow', 'evidence and review cadence')
    }
)

$proposal = [ordered]@{
    proposal_type = 'tongzhuo_customer_proposal_brief'
    status = 'ready'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = [string] $product.product
    version = [string] $product.version
    customer = [ordered]@{
        slug = $CustomerSlug
        company_name = $CompanyName
        short_name = $ShortName
        site_url = $site
        geoflow_admin = $adminUrl
        requested_services = $services
    }
    positioning = "Use Tongzhuo GEO Growth Suite to turn $ShortName's company knowledge, public website, industry insights, distribution tasks, and lead capture into one repeatable GEO growth workflow."
    business_goals = @(
        'Make the company easier for AI answer systems and search engines to understand.',
        'Create a public content source that can continuously publish industry insight articles.',
        'Connect website publishing, distribution tasks, local platform login, and result evidence.',
        'Give operators a repeatable workflow instead of scattered manual publishing steps.'
    )
    service_solution = $serviceLines
    delivery_scope = @(
        'Customer config and intake checklist.',
        'AI-readable website and public machine entrypoints.',
        'GEOFlow workbench server overrides and admin entrypoints.',
        'Windows desktop publisher agent for local platform login and publishing execution.',
        'Lead capture and contact lead management entrypoint.',
        'AI visibility audit, customer demo script, handoff checklist, project dossier, and acceptance evidence.'
    )
    delivery_timeline = @(
        [ordered]@{ phase = 'discovery_and_intake'; target = 'Day 1'; output = 'Customer intake checklist, service scope, demo script, and proposal brief.' },
        [ordered]@{ phase = 'configuration_and_release'; target = 'Day 2-3'; output = 'Customer config, website package, GEOFlow package, desktop publisher package, and release manifest.' },
        [ordered]@{ phase = 'deployment_and_training'; target = 'Day 4-5'; output = 'Server install, website AI entrypoints, desktop publisher setup, operator quickstart, and go-live checklist.' },
        [ordered]@{ phase = 'acceptance_and_review'; target = 'First 7-30 days'; output = 'Publishing-loop acceptance, operations evidence pack, support bundle, and success review.' }
    )
    acceptance_evidence = @(
        'One website article published and visible on the public website.',
        'robots.txt, sitemap.xml, feed.xml, llms.txt, and llms-full.txt are available or packaged.',
        'One distribution task created and assigned to a desktop publisher device.',
        'Desktop publisher result writeback recorded in GEOFlow.',
        'One lead submission captured and visible in the workbench.',
        'Acceptance report and operations evidence pack archived.'
    )
    customer_responsibilities = @(
        'Confirm company legal name, public brand name, domain, service region, and contact fields.',
        'Provide business facts, first article topics, service boundaries, and forbidden claims.',
        'Assign a Windows operator computer for third-party platform login and verification.',
        'Approve published content and platform account owners.',
        'Keep third-party platform passwords, cookies, captcha state, and browser profiles local.'
    )
    non_price_boundary = @(
        'This proposal brief intentionally contains no service fees, quote, or package fees.',
        'Commercial terms, payment terms, and contract clauses should be handled in a separate business document.',
        'Public website packages and AI visibility audits must not expose service prices.'
    )
    risk_and_assumptions = @(
        'Third-party platforms can change editor UI, verification, and publishing rules.',
        'Direct publish may fall back to draft, blocked, or human-takeover status when platforms require verification.',
        'Server-side GEOFlow manages content, tasks, devices, leads, and evidence; it does not store platform passwords.',
        'Production launch requires valid domain, backup window, GEOFlow access, and customer operator availability.'
    )
    next_commands = [ordered]@{
        customer_demo = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerDemo -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain>'
        customer_intake = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerIntake -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain>'
        ai_visibility = '.\scripts\Start-ProductDelivery.ps1 -Action AIVisibility -SiteUrl <https://domain> -OutputPath <ai-visibility-audit.json>'
        customer_wizard = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerWizard -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain> -OutputRoot <delivery-folder>'
    }
    security_boundary = [ordered]@{
        no_prices_in_proposal = $true
        no_prices_in_public_website = $true
        no_platform_credentials_on_server = $true
        no_customer_api_tokens_in_brief = $true
        browser_profiles_stay_local = $true
    }
}

$proposal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

$businessLines = @($proposal.business_goals | ForEach-Object { "- $_" })
$scopeLines = @($proposal.delivery_scope | ForEach-Object { "- $_" })
$serviceRows = @($serviceLines | ForEach-Object {
    "| $($_.name) | $($_.purpose) | $(@($_.deliverables) -join '; ') |"
})
$timelineRows = @($proposal.delivery_timeline | ForEach-Object {
    "| $($_.phase) | $($_.target) | $($_.output) |"
})
$evidenceLines = @($proposal.acceptance_evidence | ForEach-Object { "- $_" })
$responsibilityLines = @($proposal.customer_responsibilities | ForEach-Object { "- $_" })
$boundaryLines = @($proposal.non_price_boundary | ForEach-Object { "- $_" })
$riskLines = @($proposal.risk_and_assumptions | ForEach-Object { "- $_" })
$commandRows = @($proposal.next_commands.GetEnumerator() | ForEach-Object {
    "| $($_.Key) | $($_.Value) |"
})

$markdown = @(
    "# $ShortName Proposal Brief",
    '',
    "Status: $($proposal.status)",
    "Product: $($proposal.product) $($proposal.version)",
    "Customer: $CompanyName",
    "Website: $site",
    "GEOFlow Admin: $adminUrl",
    '',
    '## Positioning',
    '',
    $proposal.positioning,
    '',
    '## Business Goals',
    ''
) + $businessLines + @(
    '',
    '## Service Solution',
    '',
    '| Service Line | Purpose | Deliverables |',
    '| --- | --- | --- |'
) + $serviceRows + @(
    '',
    '## Delivery Scope',
    ''
) + $scopeLines + @(
    '',
    '## Delivery Timeline',
    '',
    '| Phase | Target | Output |',
    '| --- | --- | --- |'
) + $timelineRows + @(
    '',
    '## Acceptance Evidence',
    ''
) + $evidenceLines + @(
    '',
    '## Customer Responsibilities',
    ''
) + $responsibilityLines + @(
    '',
    '## Non-Price Boundary',
    ''
) + $boundaryLines + @(
    '',
    '## Risks And Assumptions',
    ''
) + $riskLines + @(
    '',
    '## Next Commands',
    '',
    '| Action | Command |',
    '| --- | --- |'
) + $commandRows + @(
    '',
    '## Security Boundary',
    '',
    '- This proposal brief contains no prices, quotes, payment terms, or platform credentials.',
    '- Third-party platform passwords, cookies, captcha state, and browser profiles stay on the local operator computer.',
    '- Customer API Tokens are not written into this brief.',
    '- Public website content must not show service prices.'
)
Set-Content -LiteralPath $markdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    proposal_brief = $resolvedOutput
    markdown = $markdownOutput
    customer_slug = $CustomerSlug
    version = [string] $product.version
} | ConvertTo-Json -Depth 4 | Write-Output
