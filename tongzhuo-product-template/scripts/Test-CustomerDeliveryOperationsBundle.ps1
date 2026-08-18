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

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [object]$Value
    )
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-delivery-ops-bundle-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    Write-JsonFile -Path (Join-Path $testRoot 'delivery-manifest.json') -Value ([ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        customer_slug = 'ops-smoke'
        company_name = 'Ops Smoke Co., Ltd.'
        site_url = 'https://ops-smoke.example.com'
        geoflow_base_url = 'https://work.ops-smoke.example.com'
        desktop_agent_port = 19380
        package_integrity = [ordered]@{}
    })
    foreach ($artifact in @(
        @{ path = 'launchpad\launchpad-20260721-000001.json'; type = 'tongzhuo_customer_delivery_launchpad'; status = 'ready' },
        @{ path = 'acceptance-reports\acceptance-report-20260721-000001.json'; type = 'tongzhuo_customer_acceptance_report'; status = 'ready' },
        @{ path = 'operations-evidence-packs\operations-evidence-pack-20260721-000001.json'; type = 'tongzhuo_customer_operations_evidence_pack'; status = 'ready' },
        @{ path = 'support-bundles\support-bundle-20260721-000001.json'; type = 'tongzhuo_customer_support_bundle'; status = 'ready' },
        @{ path = 'project\customer-PROJECT-DOSSIER.json'; type = 'tongzhuo_customer_project_dossier'; status = 'ready_for_launch' },
        @{ path = 'project\customer-launch-readiness.json'; type = 'tongzhuo_customer_launch_readiness'; status = 'ready' },
        @{ path = 'project\customer-health-scorecard.json'; type = 'tongzhuo_customer_health_scorecard'; status = 'healthy' }
    )) {
        Write-JsonFile -Path (Join-Path $testRoot $artifact.path) -Value ([ordered]@{
            artifact_type = $artifact.type
            status = $artifact.status
            geoflow_backend_snapshot = [ordered]@{ attached = $true }
        })
    }

    $resultJson = & (Join-Path $rootPath 'scripts\Start-CustomerDelivery.ps1') -DeliveryRoot $testRoot -Action OperationsBundle
    $result = $resultJson | ConvertFrom-Json
    Assert-Condition ([string] $result.status -eq 'created') "OperationsBundle result status mismatch: $($result.status)"
    Assert-Condition ([string] $result.bundle_status -eq 'ready_for_archive') "OperationsBundle status mismatch: $($result.bundle_status)"
    Assert-Condition (Test-Path ([string] $result.operations_bundle)) 'OperationsBundle JSON was not created.'
    Assert-Condition (Test-Path ([string] $result.markdown)) 'OperationsBundle Markdown was not created.'

    $bundle = Get-Content -LiteralPath ([string] $result.operations_bundle) -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $bundle.operations_bundle_type -eq 'tongzhuo_customer_delivery_operations_bundle') 'OperationsBundle type mismatch.'
    Assert-Condition (@($bundle.artifacts).Count -eq 7) 'OperationsBundle should include seven managed artifacts.'
    Assert-Condition (@($bundle.missing_artifacts).Count -eq 0) 'OperationsBundle should not report missing artifacts.'
    Assert-Condition ([bool] $bundle.security_boundary.platform_credentials_stay_local) 'OperationsBundle must declare local credential boundary.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer delivery operations bundle validation passed.'
