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
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-first-two-stages-pilot-' + [guid]::NewGuid().ToString('N'))

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

    $releaseSlug = "pilot-client-tongzhuo-geo-delivery-v$expectedVersion"
    $deliveryPackagePath = Join-Path $testRoot "$releaseSlug.zip"
    $manifestPath = Join-Path $testRoot "$releaseSlug-manifest.json"
    $previewPath = Join-Path $testRoot 'first-two-stages-preview.json'
    $checklistPath = Join-Path $testRoot "$releaseSlug-FIRST-TWO-STAGES-PILOT.md"
    $checklistJsonPath = Join-Path $testRoot "$releaseSlug-FIRST-TWO-STAGES-PILOT.json"

    Set-Content -LiteralPath $deliveryPackagePath -Value 'pilot delivery package fixture' -Encoding UTF8
    $deliveryItem = Get-Item -LiteralPath $deliveryPackagePath
    $deliveryHash = (Get-FileHash -LiteralPath $deliveryPackagePath -Algorithm SHA256).Hash.ToLowerInvariant()

    [ordered]@{
        preview_type = 'tongzhuo_product_first_two_stages_preview'
        status = 'ready'
        product = [string] $product.product
        version = $expectedVersion
        summary = [ordered]@{
            stage_count = 2
            failed_required_check_count = 0
            stage_1_status = 'ready'
            stage_2_status = 'ready'
        }
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $previewPath -Encoding UTF8

    [ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        release_slug = $releaseSlug
        customer_slug = 'pilot-client'
        company_name = 'Pilot Client Network Technology Co Ltd'
        short_name = 'Pilot Client'
        site_url = 'https://www.pilot.example.com'
        geoflow_base_url = 'https://work.pilot.example.com'
        publisher_port = 19180
        desktop_agent_port = 19380
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        delivery_package = [ordered]@{
            path = $deliveryPackagePath
            file = Split-Path $deliveryPackagePath -Leaf
            sha256 = $deliveryHash
            bytes = [int64] $deliveryItem.Length
        }
        gates = [ordered]@{
            customer_config_validation = $true
            customer_delivery_generation = $true
            customer_delivery_package_validation = $true
            excludes_customer_api_token = $true
            excludes_platform_credentials = $true
            excludes_browser_profiles = $true
            excludes_node_modules = $true
        }
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $resultJson = & (Join-Path $rootPath 'scripts\New-FirstTwoStagesPilotChecklist.ps1') `
        -ReleaseManifestPath $manifestPath `
        -PreviewPath $previewPath `
        -OutputPath $checklistPath `
        -JsonOutputPath $checklistJsonPath
    $result = $resultJson | ConvertFrom-Json

    Assert-Condition ([string] $result.status -eq 'created') "Pilot checklist result mismatch: $($result.status)"
    Assert-Condition ([string] $result.pilot_status -eq 'ready_for_pilot') "Pilot checklist status mismatch: $($result.pilot_status)"
    Assert-Condition ([int] $result.step_count -eq 12) "Pilot checklist should include 12 steps: $($result.step_count)"
    Assert-Condition (Test-Path $checklistPath) 'Pilot checklist Markdown was not created.'
    Assert-Condition (Test-Path $checklistJsonPath) 'Pilot checklist JSON was not created.'

    $checklist = Get-Content -LiteralPath $checklistJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $checklist.checklist_type -eq 'tongzhuo_first_two_stages_pilot_checklist') "Pilot checklist type mismatch: $($checklist.checklist_type)"
    Assert-Condition ([string] $checklist.status -eq 'ready_for_pilot') "Pilot checklist JSON status mismatch: $($checklist.status)"
    Assert-Condition ([string] $checklist.preview.stage_1_status -eq 'ready') 'Pilot checklist should include ready stage 1 preview status.'
    Assert-Condition ([string] $checklist.preview.stage_2_status -eq 'ready') 'Pilot checklist should include ready stage 2 preview status.'
    Assert-Condition ([bool] $checklist.security_boundary.platform_login_state_stays_local) 'Pilot checklist should declare local platform login boundary.'
    Assert-Condition (@($checklist.steps | Where-Object { [string] $_.stage -eq 'stage_1_cloud_workbench_ai_website' }).Count -eq 6) 'Stage 1 should include six pilot steps.'
    Assert-Condition (@($checklist.steps | Where-Object { [string] $_.stage -eq 'stage_2_distribution_desktop_agent' }).Count -eq 6) 'Stage 2 should include six pilot steps.'

    $markdown = Get-Content -LiteralPath $checklistPath -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Pilot Steps*') 'Pilot checklist Markdown is missing Pilot Steps.'
    Assert-Condition ($markdown -like '*Security Boundary*') 'Pilot checklist Markdown is missing Security Boundary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'First two stages pilot checklist validation passed.'
