[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
& (Join-Path $PSScriptRoot 'Test-PackageSecrets.ps1') -PackagePath $resolvedPackage

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Get-ZipEntryNames {
    param([Parameter(Mandatory = $true)] [string]$ZipPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        return @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
    } finally {
        $archive.Dispose()
    }
}

function Read-ZipEntryText {
    param(
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $entry = $archive.Entries | Where-Object {
            ($_.FullName -replace '\\', '/') -like $Pattern
        } | Select-Object -First 1
        Assert-Condition ($null -ne $entry) "Website package entry not found: $Pattern"
        $reader = [IO.StreamReader]::new($entry.Open())
        try {
            return $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Read-ZipEntriesText {
    param(
        [Parameter(Mandatory = $true)] [string]$ZipPath,
        [Parameter(Mandatory = $true)] [string[]]$Patterns
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath).Path)
    try {
        $text = ''
        foreach ($entry in $archive.Entries) {
            $normalized = $entry.FullName -replace '\\', '/'
            $matched = $false
            foreach ($pattern in $Patterns) {
                if ($normalized -like $pattern) {
                    $matched = $true
                    break
                }
            }
            if ($matched) {
                $reader = [IO.StreamReader]::new($entry.Open())
                try {
                    $text += "`n" + $reader.ReadToEnd()
                } finally {
                    $reader.Dispose()
                }
            }
        }
        return $text
    } finally {
        $archive.Dispose()
    }
}

function Assert-ZipHas {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -gt 0) "Website package missing entry: $Pattern"
}

function Assert-ZipLacks {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Entries,
        [Parameter(Mandatory = $true)] [string]$Pattern
    )
    $matches = @($Entries | Where-Object { $_ -like $Pattern })
    Assert-Condition ($matches.Count -eq 0) "Website package contains blocked entry: $Pattern"
}

$entries = Get-ZipEntryNames -ZipPath $resolvedPackage
$manifest = (Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/package-manifest.json') | ConvertFrom-Json
Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "Website package version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
Assert-Condition ([string] $manifest.component -eq 'ai-readable-company-website') "Website package component mismatch: $($manifest.component)"
Assert-Condition ([bool] $manifest.security.excludes_prices) 'Website package manifest must declare price exclusion.'
Assert-Condition ([bool] $manifest.security.excludes_customer_tokens) 'Website package manifest must declare customer token exclusion.'
Assert-Condition ([bool] $manifest.security.excludes_runtime_storage) 'Website package manifest must declare runtime storage exclusion.'

foreach ($pattern in @(
    '*/package-manifest.json',
    '*/index.html',
    '*/products.html',
    '*/insights.html',
    '*/contact.html',
    '*/robots.txt',
    '*/sitemap.xml',
    '*/feed.xml',
    '*/llms.txt',
    '*/llms-full.txt',
    '*/styles.css',
    '*/site.js',
    '*/assets/styles.css',
    '*/assets/corporate.css',
    '*/assets/corporate-nav.js',
    '*/assets/wukong-overrides.css',
    '*/assets/site.js',
    '*/assets/logo-mark-blue.png',
    '*/assets/logo-zhuojian-blue.png',
    '*/assets/short-video-production.jpg'
)) {
    Assert-ZipHas -Entries $entries -Pattern $pattern
}

$declaredEntrypoints = @($manifest.ai_entrypoints | ForEach-Object { [string] $_ })
foreach ($entrypoint in @('robots.txt', 'sitemap.xml', 'feed.xml', 'llms.txt', 'llms-full.txt')) {
    Assert-Condition ($declaredEntrypoints -contains $entrypoint) "Website package manifest missing AI entrypoint: $entrypoint"
}

foreach ($pattern in @(
    '*/.env',
    '*/node_modules/*',
    '*/vendor/*',
    '*/storage/*',
    '*/.data/*',
    '*/logs/*',
    '*/tmp/*',
    '*/temp/*',
    '*.log',
    '*.tmp'
)) {
    Assert-ZipLacks -Entries $entries -Pattern $pattern
}

$publicText = Read-ZipEntriesText -ZipPath $resolvedPackage -Patterns @('*.html', '*.txt', '*.xml')
Assert-Condition ($publicText -like '*assets/corporate.css*') 'Website HTML must reference the packaged corporate stylesheet.'
Assert-Condition ($publicText -like '*assets/site.js*') 'Website HTML must reference the packaged site script.'
$corporateNav = Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/assets/corporate-nav.js'
foreach ($requiredText in @('normalizeCorporateNav', '/insights.html', '/issues.html', 'navItems')) {
    Assert-Condition ($corporateNav -like "*$requiredText*") "Corporate navigation script is missing stable navigation support: $requiredText"
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
    Assert-Condition ($publicText -notlike "*$blocked*") "Website package public content contains blocked price text: $blocked"
}

$robots = Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/robots.txt'
Assert-Condition ($robots -like '*Sitemap:*') 'robots.txt must include Sitemap.'
$llms = Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/llms.txt'
Assert-Condition ($llms -like '*GEO*' -or $llms -like '*Core*') 'llms.txt must describe core services.'
$sitemap = Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/sitemap.xml'
Assert-Condition ($sitemap -like '*<urlset*') 'sitemap.xml must contain urlset.'
$feed = Read-ZipEntryText -ZipPath $resolvedPackage -Pattern '*/feed.xml'
Assert-Condition ($feed -like '*<rss*') 'feed.xml must contain RSS markup.'

Write-Host "Website package validation passed: $resolvedPackage"
