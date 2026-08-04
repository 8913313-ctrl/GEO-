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
$product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
$expectedVersion = [string] $product.version

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Write-Json {
    param(
        [Parameter(Mandatory = $true)] [object]$Value,
        [Parameter(Mandatory = $true)] [string]$Path
    )
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-portfolio-index-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    Write-Json -Path (Join-Path $testRoot 'alpha\alpha-PROJECT-DOSSIER.json') -Value ([ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'ready_for_launch'
        version = $expectedVersion
        release_slug = 'alpha-release'
        customer = [ordered]@{
            slug = 'alpha'
            company_name = 'Alpha Co., Ltd.'
            short_name = 'Alpha'
            site_url = 'https://alpha.example.com'
            geoflow_base_url = 'https://work-alpha.example.com'
            desktop_agent_port = 18280
        }
        artifact_inventory = @(
            [ordered]@{ role = 'release_manifest' },
            [ordered]@{ role = 'delivery_package' }
        )
        lifecycle = @(
            [ordered]@{ stage = 'intake' },
            [ordered]@{ stage = 'launch' }
        )
        geoflow_backend_snapshot = [ordered]@{
            attached = $true
            delivery_status = 'ready'
            delivery_score = 92
            delivery_task_count = 1
        }
        risk_flags = @()
        management_next_actions = @('Archive acceptance evidence.')
    })

    Write-Json -Path (Join-Path $testRoot 'beta\beta-PROJECT-DOSSIER.json') -Value ([ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'needs_attention'
        version = $expectedVersion
        release_slug = 'beta-release'
        customer = [ordered]@{
            slug = 'beta'
            company_name = 'Beta Co., Ltd.'
            short_name = 'Beta'
            site_url = 'https://beta.example.com'
            geoflow_base_url = 'https://work-beta.example.com'
            desktop_agent_port = 18280
        }
        artifact_inventory = @([ordered]@{ role = 'release_manifest' })
        lifecycle = @([ordered]@{ stage = 'intake' })
        risk_flags = @([ordered]@{ code = 'missing_email'; severity = 'medium'; message = 'Email missing.' })
        management_next_actions = @('Resolve missing email.')
    })

    Write-Json -Path (Join-Path $testRoot 'gamma\gamma-manifest.json') -Value ([ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        release_slug = 'gamma-release'
        customer_slug = 'gamma'
        company_name = 'Gamma Co., Ltd.'
        short_name = 'Gamma'
        site_url = 'https://gamma.example.com'
        geoflow_base_url = 'https://work-gamma.example.com'
        desktop_agent_port = 18280
    })

    $portfolioPath = Join-Path $testRoot 'portfolio.json'
    $resultJson = & (Join-Path $rootPath 'scripts\New-CustomerPortfolioIndex.ps1') `
        -Root $rootPath `
        -ScanRoot $testRoot `
        -OutputPath $portfolioPath
    $result = $resultJson | ConvertFrom-Json
    Assert-Condition ([string] $result.status -eq 'created') "Portfolio result status mismatch: $($result.status)"
    Assert-Condition ([string] $result.version -eq $expectedVersion) "Portfolio result version mismatch. Expected $expectedVersion, got $($result.version)"
    Assert-Condition ([int] $result.customer_records -eq 3) "Portfolio should include 3 customer records. Got $($result.customer_records)"
    Assert-Condition (Test-Path $portfolioPath) 'Portfolio JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($portfolioPath, '.md'))) 'Portfolio Markdown was not created.'

    $portfolio = Get-Content -LiteralPath $portfolioPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $portfolio.portfolio_type -eq 'tongzhuo_customer_portfolio_index') "Portfolio type mismatch: $($portfolio.portfolio_type)"
    Assert-Condition ([string] $portfolio.status -eq 'needs_attention') "Portfolio status mismatch: $($portfolio.status)"
    Assert-Condition ([int] $portfolio.summary.customer_records -eq 3) 'Portfolio summary customer count mismatch.'
    Assert-Condition ([int] $portfolio.summary.ready_for_launch -eq 1) 'Portfolio ready_for_launch count mismatch.'
    Assert-Condition ([int] $portfolio.summary.needs_attention -ge 1) 'Portfolio needs_attention count mismatch.'
    Assert-Condition ([int] $portfolio.summary.with_geoflow_backend_snapshot -eq 1) 'Portfolio backend snapshot count mismatch.'
    Assert-Condition ([int] $portfolio.summary.average_backend_delivery_score -eq 92) 'Portfolio backend delivery score average mismatch.'
    Assert-Condition ([int] $portfolio.summary.release_manifests_without_dossier -eq 1) 'Portfolio manifest-without-dossier count mismatch.'
    Assert-Condition (@($portfolio.customers | Where-Object { [string] $_.customer_slug -eq 'alpha' -and [int] $_.backend_delivery_score -eq 92 }).Count -eq 1) 'Portfolio should include alpha backend delivery score.'
    Assert-Condition (@($portfolio.customers | Where-Object { [string] $_.customer_slug -eq 'gamma' -and [string] $_.source -eq 'release_manifest' }).Count -eq 1) 'Portfolio should include gamma as release_manifest source.'
    Assert-Condition ([bool] $portfolio.security_boundary.portfolio_excludes_platform_credentials) 'Portfolio must declare platform credential exclusion.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($portfolioPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Customer Portfolio Index*') 'Portfolio Markdown is missing title.'
    Assert-Condition ($markdown -like '*Average backend delivery score*') 'Portfolio Markdown is missing backend score summary.'
    Assert-Condition ($markdown -like '*Backend Score*') 'Portfolio Markdown is missing backend score column.'
    Assert-Condition ($markdown -like '*Release manifests without dossier*') 'Portfolio Markdown is missing manifest-without-dossier summary.'
    Assert-Condition ($markdown -like '*Management Next Actions*') 'Portfolio Markdown is missing management next actions.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer portfolio index validation passed.'
