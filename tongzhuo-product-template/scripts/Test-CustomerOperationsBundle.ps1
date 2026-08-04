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

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-ops-bundle-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    $releaseRoot = Join-Path $testRoot 'release'
    New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
    Write-Json -Path (Join-Path $releaseRoot 'smoke-manifest.json') -Value ([ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        release_slug = 'smoke-release'
        customer_slug = 'smoke'
        company_name = 'Smoke Co., Ltd.'
        short_name = 'Smoke'
        site_url = 'https://smoke.example.com'
        geoflow_base_url = 'https://work.smoke.example.com'
        publisher_port = 18180
        desktop_agent_port = 18280
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        delivery_package = [ordered]@{ path = 'smoke.zip'; file = 'smoke.zip'; sha256 = 'abc'; bytes = 123 }
        evidence = [ordered]@{
            validation_report = 'validation.json'
            checksum_file = 'checksum.sha256'
            config_review = 'config-review.md'
            config_review_json = 'config-review.json'
            release_notes = 'notes.md'
            release_notes_json = 'notes.json'
            handoff_checklist = 'handoff.md'
            handoff_checklist_json = 'handoff.json'
            archive_index = 'archive.json'
            archive_index_markdown = 'archive.md'
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
    })
    Write-Json -Path (Join-Path $releaseRoot 'smoke-PROJECT-DOSSIER.json') -Value ([ordered]@{
        dossier_type = 'tongzhuo_customer_project_dossier'
        status = 'ready_for_launch'
        version = $expectedVersion
        release_slug = 'smoke-release'
        customer = [ordered]@{
            slug = 'smoke'
            company_name = 'Smoke Co., Ltd.'
            short_name = 'Smoke'
            site_url = 'https://smoke.example.com'
            geoflow_base_url = 'https://work.smoke.example.com'
            desktop_agent_port = 18280
        }
        artifact_inventory = @([ordered]@{ role = 'release_manifest' })
        lifecycle = @([ordered]@{ stage = 'intake' })
        validation = [ordered]@{
            release_validation_status = 'passed'
            validation_check_count = 4
            config_review_status = 'ready'
            config_warning_count = 0
            high_attention_count = 0
        }
        geoflow_backend_snapshot = [ordered]@{
            attached = $true
            schema = 'customer_project_dossier_export'
            schema_version = '1'
            exported_at = (Get-Date).ToUniversalTime().ToString('o')
            source_file = (Join-Path $releaseRoot 'smoke-manifest.json')
            project_id = 1
            project_name = 'Smoke Project'
            company_name = 'Smoke Co., Ltd.'
            delivery_status = 'ready'
            delivery_score = 92
            delivery_task_count = 3
            checklist_count = 2
            service_line_count = 3
            contains_credentials = $false
            contains_cookies = $false
            contains_browser_profiles = $false
        }
        launch_commands = [ordered]@{ extracted_launchpad = '.\\Start-CustomerDelivery.ps1 -Action LaunchPad' }
        management_next_actions = @('Archive acceptance evidence.')
        risk_flags = @()
    })

    foreach ($name in @('proposal-PROPOSAL-BRIEF.json','demo-DEMO-SCRIPT.json','intake-checklist.json','ai-visibility-audit.json','config-review.json')) {
        Write-Json -Path (Join-Path $testRoot $name) -Value ([ordered]@{ status = 'ready' })
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'acceptance-reports') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'operations-evidence-packs') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'support-bundles') | Out-Null
    Write-Json -Path (Join-Path $testRoot 'acceptance-reports\acceptance-report.json') -Value ([ordered]@{ acceptance_type = 'tongzhuo_customer_acceptance_report'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'operations-evidence-packs\operations-evidence-pack.json') -Value ([ordered]@{ evidence_pack_type = 'tongzhuo_customer_operations_evidence_pack'; status = 'ready' })
    Write-Json -Path (Join-Path $testRoot 'support-bundles\support-bundle.json') -Value ([ordered]@{ support_bundle_type = 'tongzhuo_customer_support_bundle'; status = 'ready' })

    $bundlePath = Join-Path $testRoot 'customer-ops-bundle.json'
    $resultJson = & (Join-Path $rootPath 'scripts\Start-ProductDelivery.ps1') `
        -Root $rootPath `
        -Action CustomerOpsBundle `
        -ScanRoot $testRoot `
        -ReleaseManifestPath (Join-Path $releaseRoot 'smoke-manifest.json') `
        -OutputPath $bundlePath
    $result = $resultJson | ConvertFrom-Json
    Assert-Condition ([string] $result.status -eq 'created') "CustomerOpsBundle result status mismatch: $($result.status)"
    Assert-Condition (Test-Path $bundlePath) 'Customer operations bundle JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($bundlePath, '.md'))) 'Customer operations bundle Markdown was not created.'

    $bundle = Get-Content -LiteralPath $bundlePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $bundle.bundle_type -eq 'tongzhuo_customer_operations_bundle') 'Customer operations bundle type mismatch.'
    Assert-Condition ([string] $bundle.status -in @('ready_for_archiving','needs_attention')) 'Customer operations bundle status mismatch.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $bundle.artifacts.evidence_index.status)) 'Customer operations bundle should include the evidence index.'
    Assert-Condition ([string] $bundle.artifacts.launch_readiness.status -like 'ready*') 'Customer operations bundle should include launch readiness.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $bundle.artifacts.health_scorecard.status)) 'Customer operations bundle should include health scorecard.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $bundle.artifacts.portfolio_index.status)) 'Customer operations bundle should include portfolio index.'
    Assert-Condition ([string] $bundle.artifacts.project_dossier.status -eq 'ready_for_launch') 'Customer operations bundle should include project dossier.'
    Assert-Condition ([string] $bundle.version -eq $expectedVersion) "Customer operations bundle version mismatch. Expected $expectedVersion, got $($bundle.version)"
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer operations bundle validation passed.'
