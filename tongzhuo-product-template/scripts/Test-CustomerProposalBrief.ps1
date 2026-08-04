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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-proposal-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    $configPath = Join-Path $testRoot 'proposal-client.json'
    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'proposal-client' `
        -CompanyName 'Proposal Client Network Technology Co Ltd' `
        -ShortName 'Proposal Client' `
        -AlternateName 'Proposal Client AI' `
        -Description 'Proposal brief fixture.' `
        -SiteUrl 'https://proposal-client.test' `
        -GeoFlowBaseUrl 'https://work.proposal-client.test' `
        -Telephone '+86-100-0000-0000' `
        -Email 'service@proposal-client.test' `
        -Address 'No. 1 Proposal Road' `
        -AddressRegion 'Proposal City' `
        -OutputPath $configPath `
        -Force | Out-Null

    $configProposalPath = Join-Path $testRoot 'proposal-client-PROPOSAL-BRIEF.json'
    $configResultJson = & (Join-Path $rootPath 'scripts\New-CustomerProposalBrief.ps1') `
        -Root $rootPath `
        -ConfigPath $configPath `
        -OutputPath $configProposalPath
    $configResult = $configResultJson | ConvertFrom-Json
    Assert-Condition ([string] $configResult.status -eq 'created') "Config proposal result mismatch: $($configResult.status)"
    Assert-Condition ([string] $configResult.version -eq $expectedVersion) "Config proposal version mismatch. Expected $expectedVersion, got $($configResult.version)"
    Assert-Condition (Test-Path $configProposalPath) 'Config proposal JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($configProposalPath, '.md'))) 'Config proposal Markdown was not created.'

    $configProposal = Get-Content -LiteralPath $configProposalPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $configProposal.proposal_type -eq 'tongzhuo_customer_proposal_brief') 'Proposal type mismatch.'
    Assert-Condition ([string] $configProposal.customer.slug -eq 'proposal-client') 'Proposal customer slug mismatch.'
    Assert-Condition ([string] $configProposal.customer.geoflow_admin -eq 'https://work.proposal-client.test/geo_admin') 'Proposal admin URL mismatch.'
    Assert-Condition (@($configProposal.service_solution).Count -eq 3) 'Proposal should include three service lines.'
    Assert-Condition (@($configProposal.acceptance_evidence).Count -ge 5) 'Proposal should include acceptance evidence.'
    Assert-Condition ([bool] $configProposal.security_boundary.no_prices_in_proposal) 'Proposal must declare no-prices boundary.'
    Assert-Condition ([string] $configProposal.next_commands.customer_demo -like '*CustomerDemo*') 'Proposal must include CustomerDemo next command.'

    $jsonText = Get-Content -LiteralPath $configProposalPath -Raw -Encoding UTF8
    foreach ($blocked in @('pricing', 'price list', 'quote amount', 'payment amount')) {
        Assert-Condition ($jsonText -notlike "*$blocked*") "Proposal JSON should not include blocked price text: $blocked"
    }

    $directProposalPath = Join-Path $testRoot 'direct-client-PROPOSAL-BRIEF.json'
    $directResultJson = & (Join-Path $rootPath 'scripts\New-CustomerProposalBrief.ps1') `
        -Root $rootPath `
        -CustomerSlug 'direct-proposal' `
        -CompanyName 'Direct Proposal Client Co Ltd' `
        -ShortName 'Direct Proposal' `
        -SiteUrl 'https://direct-proposal.test' `
        -GeoFlowBaseUrl 'https://work.direct-proposal.test' `
        -OutputPath $directProposalPath
    $directResult = $directResultJson | ConvertFrom-Json
    Assert-Condition ([string] $directResult.status -eq 'created') "Direct proposal result mismatch: $($directResult.status)"

    $directProposal = Get-Content -LiteralPath $directProposalPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $directProposal.customer.slug -eq 'direct-proposal') 'Direct proposal customer slug mismatch.'
    Assert-Condition (@($directProposal.delivery_timeline).Count -eq 4) 'Proposal should include four delivery timeline phases.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($directProposalPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Non-Price Boundary*') 'Proposal Markdown is missing Non-Price Boundary section.'
    Assert-Condition ($markdown -like '*Acceptance Evidence*') 'Proposal Markdown is missing Acceptance Evidence section.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Proposal Markdown is missing Security Boundary section.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer proposal brief validation passed.'
