[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$WebsiteRoot = '',
    [string]$SiteUrl = 'https://www.example.com',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
if ([string]::IsNullOrWhiteSpace($WebsiteRoot)) {
    $WebsiteRoot = Join-Path $rootPath 'website'
}
$websitePath = (Resolve-Path $WebsiteRoot).Path

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $websitePath "tongzhuo-ai-visibility-audit-$stamp.json"
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path $resolvedOutput -Parent) | Out-Null
$markdownOutput = [IO.Path]::ChangeExtension($resolvedOutput, '.md')

$siteBase = $SiteUrl.TrimEnd('/')
$warnings = [System.Collections.ArrayList]::new()
$failures = [System.Collections.ArrayList]::new()

function Add-Issue {
    param(
        [System.Collections.ArrayList]$Target,
        [Parameter(Mandatory = $true)] [string]$Code,
        [Parameter(Mandatory = $true)] [string]$Message,
        [string]$Path = ''
    )
    [void] $Target.Add([ordered]@{
        code = $Code
        message = $Message
        path = $Path
    })
}

function Test-Regex {
    param(
        [Parameter(Mandatory = $true)] [string]$Text,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    return [regex]::IsMatch($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Read-TextFile {
    param([Parameter(Mandatory = $true)] [string]$Path)
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

$requiredFiles = @(
    @{ name = 'robots.txt'; purpose = 'Crawler policy and sitemap pointer' },
    @{ name = 'sitemap.xml'; purpose = 'Canonical machine index for pages' },
    @{ name = 'feed.xml'; purpose = 'RSS feed for industry insights' },
    @{ name = 'llms.txt'; purpose = 'AI model short entrypoint' },
    @{ name = 'llms-full.txt'; purpose = 'AI model full company context' }
)

$entrypointResults = @()
foreach ($file in $requiredFiles) {
    $path = Join-Path $websitePath $file.name
    $exists = Test-Path -LiteralPath $path
    if (-not $exists) {
        Add-Issue -Target $failures -Code "missing_$($file.name.Replace('.', '_'))" -Message "Required AI entrypoint is missing: $($file.name)" -Path $file.name
    }
    $entrypointResults += [ordered]@{
        file = $file.name
        purpose = $file.purpose
        exists = [bool] $exists
        url = "$siteBase/$($file.name)"
    }
}

if (Test-Path -LiteralPath (Join-Path $websitePath 'robots.txt')) {
    $robots = Read-TextFile -Path (Join-Path $websitePath 'robots.txt')
    if ($robots -notlike '*Sitemap:*') {
        Add-Issue -Target $failures -Code 'robots_missing_sitemap' -Message 'robots.txt should include a Sitemap line.' -Path 'robots.txt'
    }
}
if (Test-Path -LiteralPath (Join-Path $websitePath 'sitemap.xml')) {
    $sitemap = Read-TextFile -Path (Join-Path $websitePath 'sitemap.xml')
    if ($sitemap -notlike '*<urlset*') {
        Add-Issue -Target $failures -Code 'sitemap_missing_urlset' -Message 'sitemap.xml should contain a urlset root.' -Path 'sitemap.xml'
    }
    if ($sitemap -notlike '*<loc>*') {
        Add-Issue -Target $warnings -Code 'sitemap_missing_locations' -Message 'sitemap.xml does not appear to include page loc entries.' -Path 'sitemap.xml'
    }
}
if (Test-Path -LiteralPath (Join-Path $websitePath 'feed.xml')) {
    $feed = Read-TextFile -Path (Join-Path $websitePath 'feed.xml')
    if ($feed -notlike '*<rss*') {
        Add-Issue -Target $failures -Code 'feed_missing_rss' -Message 'feed.xml should contain RSS markup.' -Path 'feed.xml'
    }
    if ($feed -notlike '*<item>*') {
        Add-Issue -Target $warnings -Code 'feed_missing_items' -Message 'feed.xml has no visible item entries.' -Path 'feed.xml'
    }
}
if (Test-Path -LiteralPath (Join-Path $websitePath 'llms.txt')) {
    $llms = Read-TextFile -Path (Join-Path $websitePath 'llms.txt')
    if (($llms -notlike '*GEO*') -and ($llms -notlike '*AI*')) {
        Add-Issue -Target $warnings -Code 'llms_weak_topic_signal' -Message 'llms.txt should clearly describe GEO or AI services.' -Path 'llms.txt'
    }
}

$htmlFiles = @(Get-ChildItem -LiteralPath $websitePath -File -Filter '*.html' -ErrorAction SilentlyContinue)
if ($htmlFiles.Count -eq 0) {
    Add-Issue -Target $failures -Code 'no_html_pages' -Message 'Website has no HTML pages to audit.'
}

$pageResults = @()
foreach ($file in $htmlFiles) {
    $relative = $file.Name
    $text = Read-TextFile -Path $file.FullName
    $title = Test-Regex -Text $text -Pattern '<title>[^<]{8,}</title>'
    $description = Test-Regex -Text $text -Pattern '<meta\s+name=["'']description["'']\s+content=["''][^"'']{30,}["'']'
    $canonical = Test-Regex -Text $text -Pattern '<link\s+rel=["'']canonical["'']\s+href=["''][^"'']+["'']'
    $robotsMeta = Test-Regex -Text $text -Pattern '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*index[^"'']*follow[^"'']*["'']'
    $h1 = Test-Regex -Text $text -Pattern '<h1[^>]*>.+?</h1>'
    $jsonLd = Test-Regex -Text $text -Pattern '<script\s+type=["'']application/ld\+json["'']'
    $hasOrgSignal = Test-Regex -Text $text -Pattern 'Organization|LocalBusiness|Service|Article|FAQPage|BreadcrumbList'
    $isArticle = ($file.Name -like 'article-*.html') -or (Test-Regex -Text $text -Pattern '"@type"\s*:\s*"Article"')
    $articleAuthor = -not $isArticle -or (Test-Regex -Text $text -Pattern 'author|writer')
    $articleDate = -not $isArticle -or (Test-Regex -Text $text -Pattern 'datePublished|datetime=|published')

    $checks = [ordered]@{
        title = [bool] $title
        description = [bool] $description
        canonical = [bool] $canonical
        robots_meta = [bool] $robotsMeta
        h1 = [bool] $h1
        json_ld = [bool] $jsonLd
        entity_or_schema_signal = [bool] $hasOrgSignal
        article_author = [bool] $articleAuthor
        article_date = [bool] $articleDate
    }

    foreach ($prop in $checks.GetEnumerator()) {
        if (-not [bool] $prop.Value) {
            Add-Issue -Target $warnings -Code "page_missing_$($prop.Key)" -Message "Page is missing recommended AI visibility signal: $($prop.Key)" -Path $relative
        }
    }

    $pageResults += [ordered]@{
        path = $relative
        url = if ($file.Name -eq 'index.html') { "$siteBase/" } else { "$siteBase/$($file.Name)" }
        article = [bool] $isArticle
        checks = $checks
    }
}

$publicFiles = @(Get-ChildItem -LiteralPath $websitePath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Extension -in @('.html', '.txt', '.xml')
})
$publicText = ''
foreach ($file in $publicFiles) {
    $publicText += "`n" + (Read-TextFile -Path $file.FullName)
}

$blockedPriceTexts = @(
    [string][char]0xFFE5,
    [string][char]0x00A5,
    [regex]::Unescape('\u62a5\u4ef7'),
    [regex]::Unescape('\u5957\u9910\u4ef7\u683c'),
    [regex]::Unescape('\u670d\u52a1\u4ef7\u683c'),
    [regex]::Unescape('\u6536\u8d39\u6807\u51c6'),
    'pricing',
    'price list'
)
foreach ($blocked in $blockedPriceTexts) {
    if ($publicText -like "*$blocked*") {
        Add-Issue -Target $failures -Code 'public_price_text_found' -Message "Public website contains blocked price text: $blocked"
    }
}

if ($publicText -match '\{\{CUSTOMER_[A-Z0-9_]+\}\}') {
    Add-Issue -Target $warnings -Code 'customer_placeholders_present' -Message 'Customer placeholders are still present. This is expected in the reusable template, but must be replaced in customer delivery.'
}
if ($publicText -like '*example.com*') {
    Add-Issue -Target $warnings -Code 'example_domain_present' -Message 'example.com appears in public files. Replace it during customer delivery.'
}

$totalChecks = 5 + ($htmlFiles.Count * 9)
$failedCheckCount = [int] $failures.Count
$warningCheckCount = [int] $warnings.Count
$score = if ($totalChecks -le 0) { 0 } else { [math]::Max(0, [math]::Round(100 - (($failedCheckCount * 10 + $warningCheckCount * 2) / [math]::Max(1, $totalChecks) * 100), 0)) }
$status = if ($failures.Count -gt 0) { 'failed' } elseif ($warnings.Count -gt 0) { 'ready_with_warnings' } else { 'ready' }

$audit = [ordered]@{
    audit_type = 'tongzhuo_ai_visibility_audit'
    status = $status
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    product = 'Tongzhuo GEO Growth Suite'
    website_root = $websitePath
    site_url = $siteBase
    score = [int] $score
    summary = [ordered]@{
        entrypoint_count = [int] $entrypointResults.Count
        html_page_count = [int] $htmlFiles.Count
        failure_count = [int] $failures.Count
        warning_count = [int] $warnings.Count
        price_text_excluded = @($failures | Where-Object { [string] $_.code -eq 'public_price_text_found' }).Count -eq 0
        ai_entrypoints_complete = @($entrypointResults | Where-Object { -not [bool] $_.exists }).Count -eq 0
    }
    ai_entrypoints = $entrypointResults
    pages = $pageResults
    failures = @($failures)
    warnings = @($warnings)
    management_next_actions = @(
        'Replace customer placeholders and example domains before production launch.',
        'Publish at least one current industry insight before customer acceptance.',
        'Archive this audit with the customer project dossier and go-live evidence.',
        'Re-run the audit after domain, sitemap, RSS, llms.txt, or service-page changes.'
    )
    security_boundary = [ordered]@{
        public_website_prices_excluded = $true
        customer_api_tokens_not_required = $true
        platform_credentials_not_required = $true
        reads_public_website_files_only = $true
    }
}

$audit | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

$entryRows = @($entrypointResults | ForEach-Object {
    "| $($_.file) | $($_.exists) | $($_.url) | $($_.purpose) |"
})
$pageRows = @($pageResults | ForEach-Object {
    $passed = @($_.checks.GetEnumerator() | Where-Object { [bool] $_.Value }).Count
    "| $($_.path) | $($_.article) | $passed/9 |"
})
$failureLines = if ($failures.Count -gt 0) {
    @($failures | ForEach-Object { "- $($_.code): $($_.message) $($_.path)" })
} else {
    @('- No failures.')
}
$warningLines = if ($warnings.Count -gt 0) {
    @($warnings | Select-Object -First 30 | ForEach-Object { "- $($_.code): $($_.message) $($_.path)" })
} else {
    @('- No warnings.')
}

$markdown = @(
    '# Tongzhuo AI Visibility Audit',
    '',
    "Status: $status",
    "Score: $score",
    "Site URL: $siteBase",
    "Generated at: $($audit.generated_at)",
    '',
    '## AI Entrypoints',
    '',
    '| File | Exists | URL | Purpose |',
    '| --- | --- | --- | --- |'
) + $entryRows + @(
    '',
    '## Page Signals',
    '',
    '| Page | Article | Passed Signals |',
    '| --- | --- | --- |'
) + $pageRows + @(
    '',
    '## Failures',
    ''
) + $failureLines + @(
    '',
    '## Warnings',
    ''
) + $warningLines + @(
    '',
    '## Management Next Actions',
    '',
    '- Replace customer placeholders and example domains before production launch.',
    '- Publish at least one current industry insight before customer acceptance.',
    '- Archive this audit with the customer project dossier and go-live evidence.',
    '- Re-run the audit after domain, sitemap, RSS, llms.txt, or service-page changes.',
    '',
    '## Security Boundary',
    '',
    '- The audit reads only public website files.',
    '- It does not require GEOFlow API Tokens.',
    '- It does not require third-party platform credentials.',
    '- Public website packages must not expose service prices.'
)
Set-Content -LiteralPath $markdownOutput -Value ($markdown -join [Environment]::NewLine) -Encoding UTF8

[ordered]@{
    status = 'created'
    audit_status = $status
    score = [int] $score
    audit = $resolvedOutput
    markdown = $markdownOutput
    failure_count = [int] $failures.Count
    warning_count = [int] $warnings.Count
} | ConvertTo-Json -Depth 4 | Write-Output
