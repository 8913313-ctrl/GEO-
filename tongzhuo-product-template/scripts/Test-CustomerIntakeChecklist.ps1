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

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-customer-intake-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    $intakePath = Join-Path $testRoot 'direct-intake.json'
    $directResultJson = & (Join-Path $rootPath 'scripts\New-CustomerIntakeChecklist.ps1') `
        -Root $rootPath `
        -CustomerSlug 'intake-smoke' `
        -CompanyName 'Intake Smoke Test Co., Ltd.' `
        -ShortName 'Intake Smoke' `
        -SiteUrl 'https://intake-smoke.example.com' `
        -GeoFlowBaseUrl 'https://work-intake-smoke.example.com' `
        -Telephone '400-000-0000' `
        -Email 'ops@example.com' `
        -Address 'Zibo, Shandong' `
        -OutputPath $intakePath
    $directResult = $directResultJson | ConvertFrom-Json
    Assert-Condition ([string] $directResult.status -eq 'created') "Direct intake result status mismatch: $($directResult.status)"
    Assert-Condition ([string] $directResult.version -eq $expectedVersion) "Direct intake version mismatch. Expected $expectedVersion, got $($directResult.version)"
    Assert-Condition (Test-Path $intakePath) 'Direct intake JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($intakePath, '.md'))) 'Direct intake Markdown was not created.'

    $direct = Get-Content -LiteralPath $intakePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $direct.intake_type -eq 'tongzhuo_customer_intake_checklist') "Direct intake type mismatch: $($direct.intake_type)"
    Assert-Condition ([string] $direct.status -eq 'ready') "Direct intake status mismatch: $($direct.status)"
    Assert-Condition ([string] $direct.version -eq $expectedVersion) "Direct intake file version mismatch. Expected $expectedVersion, got $($direct.version)"
    Assert-Condition (@($direct.required_inputs).Count -ge 10) 'Direct intake should include required inputs.'
    Assert-Condition (@($direct.kickoff_agenda).Count -ge 5) 'Direct intake should include kickoff agenda.'
    Assert-Condition (@($direct.implementation_gates).Count -ge 6) 'Direct intake should include implementation gates.'
    Assert-Condition (@($direct.do_not_collect).Count -ge 5) 'Direct intake should include do-not-collect boundary.'
    Assert-Condition (@($direct.do_not_promise).Count -ge 4) 'Direct intake should include do-not-promise boundary.'
    Assert-Condition ([bool] $direct.security_boundary.platform_credentials_stay_local) 'Direct intake must declare local platform credential boundary.'
    Assert-Condition ([string] $direct.next_commands.run_customer_wizard -like '*CustomerWizard*') 'Direct intake must include customer wizard next command.'

    $directMarkdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($intakePath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($directMarkdown -like '*Required Inputs*') 'Direct intake Markdown is missing required inputs.'
    Assert-Condition ($directMarkdown -like '*Do Not Collect*') 'Direct intake Markdown is missing do-not-collect boundary.'
    Assert-Condition ($directMarkdown -like '*Do Not Promise*') 'Direct intake Markdown is missing do-not-promise boundary.'

    $configPath = Join-Path $testRoot 'config-intake.json'
    & (Join-Path $rootPath 'scripts\New-CustomerConfig.ps1') `
        -CustomerSlug 'intake-config' `
        -CompanyName 'Intake Config Test Co., Ltd.' `
        -ShortName 'Intake Config' `
        -SiteUrl 'https://intake-config.example.com' `
        -GeoFlowBaseUrl 'https://work-intake-config.example.com' `
        -OutputPath $configPath `
        -Force | Out-Null

    $configIntakePath = Join-Path $testRoot 'config-intake-checklist.json'
    $configResultJson = & (Join-Path $rootPath 'scripts\New-CustomerIntakeChecklist.ps1') `
        -Root $rootPath `
        -ConfigPath $configPath `
        -OutputPath $configIntakePath
    $configResult = $configResultJson | ConvertFrom-Json
    Assert-Condition ([string] $configResult.status -eq 'created') "Config intake result status mismatch: $($configResult.status)"
    Assert-Condition (Test-Path $configIntakePath) 'Config intake JSON was not created.'

    $configIntake = Get-Content -LiteralPath $configIntakePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $configIntake.source -eq 'config') "Config intake source mismatch: $($configIntake.source)"
    Assert-Condition ([string] $configIntake.customer.slug -eq 'intake-config') 'Config intake customer slug mismatch.'
    Assert-Condition (@($configIntake.risk_flags | Where-Object { [string] $_.code -eq 'missing_telephone' }).Count -eq 1) 'Config intake should warn when telephone is missing.'
    Assert-Condition ([bool] $configIntake.security_boundary.api_token_empty_before_packaging) 'Config intake must declare empty API Token boundary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer intake checklist validation passed.'
