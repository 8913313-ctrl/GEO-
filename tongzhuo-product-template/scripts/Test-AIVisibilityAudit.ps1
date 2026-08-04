[CmdletBinding()]
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-ai-visibility-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Write-Utf8 {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Value
    )
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    Set-Content -LiteralPath $Path -Value $Value -Encoding UTF8
}

try {
    $readyRoot = Join-Path $testRoot 'ready-site'
    New-Item -ItemType Directory -Force -Path $readyRoot | Out-Null
    Write-Utf8 -Path (Join-Path $readyRoot 'robots.txt') -Value "User-agent: *`nAllow: /`nSitemap: https://ready.test/sitemap.xml"
    Write-Utf8 -Path (Join-Path $readyRoot 'sitemap.xml') -Value '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://ready.test/</loc></url><url><loc>https://ready.test/article-one.html</loc></url></urlset>'
    Write-Utf8 -Path (Join-Path $readyRoot 'feed.xml') -Value '<?xml version="1.0"?><rss version="2.0"><channel><title>Ready Feed</title><item><title>GEO Insight</title><link>https://ready.test/article-one.html</link></item></channel></rss>'
    Write-Utf8 -Path (Join-Path $readyRoot 'llms.txt') -Value '# Ready Company GEO and AI services'
    Write-Utf8 -Path (Join-Path $readyRoot 'llms-full.txt') -Value '# Ready Company full AI-readable context'
    Write-Utf8 -Path (Join-Path $readyRoot 'index.html') -Value '<!doctype html><html><head><title>Ready Company GEO Services</title><meta name="description" content="Ready Company provides GEO optimization and enterprise AI services for growth teams."><meta name="robots" content="index,follow"><link rel="canonical" href="https://ready.test/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Ready Company"}</script></head><body><h1>Ready Company</h1></body></html>'
    Write-Utf8 -Path (Join-Path $readyRoot 'article-one.html') -Value '<!doctype html><html><head><title>How GEO content becomes an AI source</title><meta name="description" content="A practical article about how GEO content becomes an AI-readable source for business discovery."><meta name="robots" content="index,follow"><link rel="canonical" href="https://ready.test/article-one.html"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"How GEO content becomes an AI source","datePublished":"2026-07-17","author":{"@type":"Organization","name":"Ready Research"}}</script></head><body><h1>How GEO content becomes an AI source</h1><time datetime="2026-07-17">2026-07-17</time></body></html>'

    $readyOutput = Join-Path $testRoot 'ready-audit.json'
    $readyResultJson = & (Join-Path $rootPath 'scripts\New-AIVisibilityAudit.ps1') -Root $rootPath -WebsiteRoot $readyRoot -SiteUrl 'https://ready.test' -OutputPath $readyOutput
    $readyResult = $readyResultJson | ConvertFrom-Json
    Assert-Condition ([string] $readyResult.status -eq 'created') "Ready audit result status mismatch: $($readyResult.status)"
    Assert-Condition ([string] $readyResult.audit_status -eq 'ready') "Ready audit should be ready, got $($readyResult.audit_status)"
    Assert-Condition ([int] $readyResult.failure_count -eq 0) "Ready audit should have no failures, got $($readyResult.failure_count)"

    $readyAudit = Get-Content -LiteralPath $readyOutput -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $readyAudit.audit_type -eq 'tongzhuo_ai_visibility_audit') 'Audit type mismatch.'
    Assert-Condition ([bool] $readyAudit.summary.ai_entrypoints_complete) 'Ready audit should have complete AI entrypoints.'
    Assert-Condition ([bool] $readyAudit.summary.price_text_excluded) 'Ready audit should declare price text exclusion.'
    Assert-Condition ([int] $readyAudit.summary.html_page_count -eq 2) "Ready audit should see two pages, got $($readyAudit.summary.html_page_count)"

    $templateOutput = Join-Path $testRoot 'template-audit.json'
    $templateResultJson = & (Join-Path $rootPath 'scripts\New-AIVisibilityAudit.ps1') -Root $rootPath -SiteUrl 'https://www.example.com' -OutputPath $templateOutput
    $templateResult = $templateResultJson | ConvertFrom-Json
    Assert-Condition ([string] $templateResult.status -eq 'created') "Template audit did not create output: $($templateResult.status)"
    Assert-Condition ([int] $templateResult.failure_count -eq 0) "Reusable template audit should not have failures, got $($templateResult.failure_count)"

    $templateAudit = Get-Content -LiteralPath $templateOutput -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([int] $templateAudit.summary.html_page_count -ge 5) 'Template audit should see the reusable website pages.'
    Assert-Condition ([int] $templateAudit.summary.entrypoint_count -eq 5) 'Template audit should list five AI entrypoints.'
    $warningCodes = @($templateAudit.warnings | ForEach-Object { [string] $_.code })
    Assert-Condition ($warningCodes -contains 'example_domain_present') 'Template audit should warn about example.com placeholders.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($templateOutput, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*AI Entrypoints*') 'Audit markdown should include AI Entrypoints section.'
    Assert-Condition ($markdown -like '*Management Next Actions*') 'Audit markdown should include management next actions.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'AI visibility audit validation passed.'
