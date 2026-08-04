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
    $OutputPath = Join-Path (Get-Location).Path "$safeSlug-DEMO-SCRIPT.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null
$markdownOutput = [IO.Path]::ChangeExtension($resolvedOutput, '.md')

$demoFlow = @(
    [ordered]@{
        step = 'opening_positioning'
        minutes = 5
        operator = 'sales_or_implementation'
        show = 'Customer business goal and the cloud workbench plus Windows desktop publisher boundary.'
        proof = 'Confirm the product does not require third-party platform passwords on the server.'
    },
    [ordered]@{
        step = 'ai_readable_website'
        minutes = 8
        operator = 'geo_operator'
        show = "$site, /robots.txt, /sitemap.xml, /feed.xml, /llms.txt, /llms-full.txt"
        proof = 'AI visibility audit and public website package validation.'
    },
    [ordered]@{
        step = 'geoflow_content_workbench'
        minutes = 10
        operator = 'content_operator'
        show = "$adminUrl article management, industry insights, categories, and content workflow."
        proof = 'One article can be drafted, reviewed, published to the website, and included in the machine-readable entrypoints.'
    },
    [ordered]@{
        step = 'distribution_and_desktop_agent'
        minutes = 10
        operator = 'publisher_operator'
        show = 'Distribution task creation, publisher devices, platform account status, and desktop agent health.'
        proof = 'Desktop publisher receives a task and writes back per-platform result state without uploading platform credentials.'
    },
    [ordered]@{
        step = 'lead_capture_and_evidence'
        minutes = 7
        operator = 'customer_success'
        show = 'Contact leads, acceptance report, operations evidence pack, support bundle, and customer project dossier.'
        proof = 'Lead submission and publishing evidence can be archived for customer acceptance.'
    },
    [ordered]@{
        step = 'handoff_next_steps'
        minutes = 5
        operator = 'sales_or_implementation'
        show = 'Customer intake checklist, delivery wizard, go-live checklist, and success review cadence.'
        proof = 'Every next step has a command, artifact, owner, and pass rule.'
    }
)

$objections = @(
    [ordered]@{
        question = 'Can everything publish directly from the server?'
        answer = 'The workbench controls tasks, but third-party platform login, captcha, and browser state stay on the local Windows desktop publisher to reduce account risk.'
    },
    [ordered]@{
        question = 'Does the public website show service prices?'
        answer = 'No. Public website packages and AI visibility audits enforce price-text exclusion.'
    },
    [ordered]@{
        question = 'How do we prove GEO value?'
        answer = 'Use AI visibility audit, article publication evidence, sitemap/RSS/llms entrypoints, distribution result writeback, and monthly success review evidence.'
    },
    [ordered]@{
        question = 'What happens when a platform verification blocks automation?'
        answer = 'The desktop publisher keeps the article payload, allows human takeover, and writes back draft, blocked, or published status.'
    }
)

$demo = [ordered]@{
    demo_type = 'tongzhuo_customer_demo_script'
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
        services = $services
    }
    purpose = 'A repeatable 45-minute demo flow for showing the website, GEOFlow workbench, desktop publisher, distribution loop, lead capture, and acceptance evidence.'
    demo_length_minutes = 45
    preparation_checklist = @(
        'Confirm demo website URL opens in a normal browser.',
        'Confirm robots.txt, sitemap.xml, feed.xml, llms.txt, and llms-full.txt are reachable or available in the website package.',
        'Prepare one sample industry insight article.',
        'Start or screenshot the desktop publisher health endpoint.',
        'Prepare a fake lead submission and acceptance evidence path.',
        'Do not collect or display platform passwords, cookies, captcha state, or browser profiles.'
    )
    demo_flow = $demoFlow
    objection_handling = $objections
    closeout_questions = @(
        'Which service line should go live first: GEO optimization, short-video operations, or enterprise AI implementation?',
        'Who owns website content approval and platform account login on the customer side?',
        'Which domain and GEOFlow workbench URL will be used for production?',
        'What evidence must be archived before customer signoff?'
    )
    next_commands = [ordered]@{
        customer_intake = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerIntake -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain>'
        ai_visibility = '.\scripts\Start-ProductDelivery.ps1 -Action AIVisibility -SiteUrl <https://domain> -OutputPath <ai-visibility-audit.json>'
        customer_wizard = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerWizard -CustomerSlug <slug> -CompanyName <legal-name> -ShortName <brand> -SiteUrl <https://domain> -GeoFlowBaseUrl <https://work-domain> -OutputRoot <delivery-folder>'
        customer_dossier = '.\scripts\Start-ProductDelivery.ps1 -Action CustomerDossier -ReleaseManifestPath <release-manifest.json> -IntakePath <intake.json>'
    }
    security_boundary = [ordered]@{
        no_public_prices = $true
        no_platform_credentials_on_server = $true
        desktop_publisher_handles_login_and_captcha = $true
        demo_artifacts_contain_no_tokens = $true
    }
}

$demo | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

$flowRows = @($demoFlow | ForEach-Object {
    "| $($_.step) | $($_.minutes) | $($_.operator) | $($_.show) | $($_.proof) |"
})
$prepLines = @($demo.preparation_checklist | ForEach-Object { "- $_" })
$objectionRows = @($objections | ForEach-Object {
    "| $($_.question) | $($_.answer) |"
})
$questionLines = @($demo.closeout_questions | ForEach-Object { "- $_" })
$commandRows = @($demo.next_commands.GetEnumerator() | ForEach-Object {
    "| $($_.Key) | $($_.Value) |"
})

$markdown = @(
    "# $ShortName Customer Demo Script",
    '',
    "Status: $($demo.status)",
    "Product: $($demo.product) $($demo.version)",
    "Customer: $CompanyName",
    "Website: $site",
    "GEOFlow Admin: $adminUrl",
    "Demo length: $($demo.demo_length_minutes) minutes",
    '',
    '## Purpose',
    '',
    $demo.purpose,
    '',
    '## Preparation Checklist',
    ''
) + $prepLines + @(
    '',
    '## Demo Flow',
    '',
    '| Step | Minutes | Operator | Show | Proof |',
    '| --- | ---: | --- | --- | --- |'
) + $flowRows + @(
    '',
    '## Objection Handling',
    '',
    '| Question | Answer |',
    '| --- | --- |'
) + $objectionRows + @(
    '',
    '## Closeout Questions',
    ''
) + $questionLines + @(
    '',
    '## Next Commands',
    '',
    '| Action | Command |',
    '| --- | --- |'
) + $commandRows + @(
    '',
    '## Security Boundary',
    '',
    '- Public website content does not show service prices.',
    '- Third-party platform credentials, cookies, captcha state, and browser profiles stay on the local operator computer.',
    '- The server workbench controls tasks and evidence, while the desktop publisher handles platform login and verification.',
    '- Demo artifacts contain no customer API Tokens.'
)
Set-Content -LiteralPath $markdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    demo_script = $resolvedOutput
    markdown = $markdownOutput
    customer_slug = $CustomerSlug
    demo_length_minutes = 45
    version = [string] $product.version
} | ConvertTo-Json -Depth 4 | Write-Output
