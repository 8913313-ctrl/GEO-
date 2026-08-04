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
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-project-dossier-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    $releaseSlug = 'dossier-smoke-tongzhuo-geo-delivery'
    $deliveryPackage = Join-Path $testRoot "$releaseSlug.zip"
    Set-Content -LiteralPath $deliveryPackage -Value 'fake delivery package for dossier test' -Encoding UTF8
    $deliveryItem = Get-Item -LiteralPath $deliveryPackage
    $deliveryHash = (Get-FileHash -LiteralPath $deliveryPackage -Algorithm SHA256).Hash.ToLowerInvariant()

    $validationPath = Join-Path $testRoot "$releaseSlug-validation.json"
    $configReviewPath = Join-Path $testRoot "$releaseSlug-CONFIG-REVIEW.json"
    $releaseNotesPath = Join-Path $testRoot "$releaseSlug-DELIVERY-RELEASE-NOTES.json"
    $handoffPath = Join-Path $testRoot "$releaseSlug-HANDOFF-CHECKLIST.json"
    $archivePath = Join-Path $testRoot "$releaseSlug-archive-index.json"
    $checksumPath = Join-Path $testRoot "$releaseSlug.sha256"
    $manifestPath = Join-Path $testRoot "$releaseSlug-manifest.json"
    $intakePath = Join-Path $testRoot "$releaseSlug-intake.json"
    $backendDossierPath = Join-Path $testRoot "$releaseSlug-geoflow-backend-dossier.json"
    $dossierPath = Join-Path $testRoot "$releaseSlug-PROJECT-DOSSIER.json"

    Set-Content -LiteralPath $checksumPath -Value "$deliveryHash  $(Split-Path $deliveryPackage -Leaf)" -Encoding ASCII

    Write-Json -Path $validationPath -Value ([ordered]@{
        status = 'passed'
        version = $expectedVersion
        checks = @(
            [ordered]@{ name = 'customer_config_validation'; status = 'passed' },
            [ordered]@{ name = 'customer_delivery_generation'; status = 'passed' },
            [ordered]@{ name = 'customer_delivery_package_validation'; status = 'passed' }
        )
    })
    Write-Json -Path $configReviewPath -Value ([ordered]@{
        review_type = 'tongzhuo_customer_config_review'
        status = 'ready'
        warnings = @()
    })
    Write-Json -Path $releaseNotesPath -Value ([ordered]@{
        notes_type = 'tongzhuo_customer_delivery_release_notes'
        version = $expectedVersion
        release_slug = $releaseSlug
    })
    Write-Json -Path $handoffPath -Value ([ordered]@{
        checklist_type = 'tongzhuo_customer_handoff_checklist'
        status = 'ready_for_signoff'
    })
    Write-Json -Path $archivePath -Value ([ordered]@{
        index_type = 'tongzhuo_customer_project_archive'
        version = $expectedVersion
        endpoints = [ordered]@{
            website = 'https://dossier-smoke.example.com'
            geoflow_admin = 'https://work-dossier-smoke.example.com/geo_admin'
            publisher_assistant = 'https://work-dossier-smoke.example.com/geo_admin/publisher-assistant'
            contact_leads = 'https://work-dossier-smoke.example.com/geo_admin/contact-leads'
            llms_txt = 'https://dossier-smoke.example.com/llms.txt'
            sitemap = 'https://dossier-smoke.example.com/sitemap.xml'
            feed = 'https://dossier-smoke.example.com/feed.xml'
            desktop_health = 'http://127.0.0.1:18280/healthz'
        }
        acceptance = [ordered]@{
            preflight_report = '.\Start-CustomerDelivery.ps1 -Action PreflightReport'
            go_live_checklist = '.\Start-CustomerDelivery.ps1 -Action GoLiveChecklist'
            publishing_loop_dry_run = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopDryRun'
            publishing_loop_acceptance = '.\Start-CustomerDelivery.ps1 -Action PublishingLoopAcceptance'
            acceptance_report = '.\Start-CustomerDelivery.ps1 -Action AcceptanceReport'
            support_bundle = '.\Start-CustomerDelivery.ps1 -Action SupportBundle'
        }
    })
    Write-Json -Path $intakePath -Value ([ordered]@{
        intake_type = 'tongzhuo_customer_intake_checklist'
        status = 'ready'
        risk_flags = @()
    })
    Write-Json -Path $backendDossierPath -Value ([ordered]@{
        schema = 'customer_project_dossier_export'
        schema_version = '1.0'
        exported_at = '2026-07-21T00:00:00+00:00'
        security_boundary = [ordered]@{
            contains_credentials = $false
            contains_cookies = $false
            contains_browser_profiles = $false
        }
        project = [ordered]@{
            id = 1001
            name = 'Dossier Smoke Backend Project'
            company_name = 'Dossier Smoke Test Co., Ltd.'
        }
        service_lines = @(
            [ordered]@{ value = 'geo'; label = 'GEO optimization' },
            [ordered]@{ value = 'enterprise_ai'; label = 'Enterprise AI' }
        )
        delivery_readiness = [ordered]@{
            status = 'ready'
            score = 92
            delivery_tasks = @(
                [ordered]@{ title = 'Attach acceptance evidence'; owner = 'customer_success' }
            )
        }
        delivery_checklist = @(
            [ordered]@{ key = 'brand_profile'; completed = $true },
            [ordered]@{ key = 'cms_pages'; completed = $true }
        )
    })
    Write-Json -Path $manifestPath -Value ([ordered]@{
        product = [string] $product.product
        version = $expectedVersion
        release_slug = $releaseSlug
        customer_slug = 'dossier-smoke'
        company_name = 'Dossier Smoke Test Co., Ltd.'
        short_name = 'Dossier Smoke'
        site_url = 'https://dossier-smoke.example.com'
        geoflow_base_url = 'https://work-dossier-smoke.example.com'
        desktop_agent_port = 18280
        delivery_package = [ordered]@{
            path = $deliveryPackage
            file = Split-Path $deliveryPackage -Leaf
            sha256 = $deliveryHash
            bytes = [int64] $deliveryItem.Length
        }
        evidence = [ordered]@{
            validation_report = Split-Path $validationPath -Leaf
            config_review_json = Split-Path $configReviewPath -Leaf
            release_notes_json = Split-Path $releaseNotesPath -Leaf
            handoff_checklist_json = Split-Path $handoffPath -Leaf
            archive_index = Split-Path $archivePath -Leaf
            checksum_file = Split-Path $checksumPath -Leaf
        }
    })

    $resultJson = & (Join-Path $rootPath 'scripts\New-CustomerProjectDossier.ps1') `
        -Root $rootPath `
        -ReleaseManifestPath $manifestPath `
        -IntakePath $intakePath `
        -BackendDossierPath $backendDossierPath `
        -OutputPath $dossierPath
    $result = $resultJson | ConvertFrom-Json
    Assert-Condition ([string] $result.status -eq 'created') "Dossier result status mismatch: $($result.status)"
    Assert-Condition ([string] $result.version -eq $expectedVersion) "Dossier result version mismatch. Expected $expectedVersion, got $($result.version)"
    Assert-Condition (Test-Path $dossierPath) 'Dossier JSON was not created.'
    Assert-Condition (Test-Path ([IO.Path]::ChangeExtension($dossierPath, '.md'))) 'Dossier Markdown was not created.'

    $dossier = Get-Content -LiteralPath $dossierPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ([string] $dossier.dossier_type -eq 'tongzhuo_customer_project_dossier') "Dossier type mismatch: $($dossier.dossier_type)"
    Assert-Condition ([string] $dossier.status -eq 'ready_for_launch') "Dossier status mismatch: $($dossier.status)"
    Assert-Condition ([string] $dossier.version -eq $expectedVersion) "Dossier version mismatch. Expected $expectedVersion, got $($dossier.version)"
    Assert-Condition (@($dossier.lifecycle).Count -ge 8) 'Dossier should include lifecycle stages, including the GEOFlow backend snapshot.'
    Assert-Condition (@($dossier.artifact_inventory).Count -ge 10) 'Dossier should include release, intake, and backend dossier artifacts.'
    Assert-Condition ([bool] $dossier.geoflow_backend_snapshot.attached) 'Dossier should attach the GEOFlow backend snapshot.'
    Assert-Condition ([string] $dossier.geoflow_backend_snapshot.schema -eq 'customer_project_dossier_export') 'Backend snapshot schema mismatch.'
    Assert-Condition ([int] $dossier.geoflow_backend_snapshot.delivery_score -eq 92) 'Backend snapshot delivery score mismatch.'
    Assert-Condition ([string] $dossier.geoflow_backend_snapshot.source_file -like '*geoflow-backend-dossier.json*') 'Backend snapshot source file mismatch.'
    Assert-Condition (-not [bool] $dossier.geoflow_backend_snapshot.contains_credentials) 'Backend snapshot must not contain credentials.'
    Assert-Condition ([string] $dossier.launch_commands.extracted_launchpad -like '*LaunchPad*') 'Dossier should include LaunchPad command.'
    Assert-Condition ([bool] $dossier.security_boundary.platform_credentials_stay_local) 'Dossier must declare local platform credential boundary.'

    $markdown = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($dossierPath, '.md')) -Raw -Encoding UTF8
    Assert-Condition ($markdown -like '*Lifecycle*') 'Dossier Markdown is missing lifecycle.'
    Assert-Condition ($markdown -like '*Artifact Inventory*') 'Dossier Markdown is missing artifact inventory.'
    Assert-Condition ($markdown -like '*GEOFlow Backend Snapshot*') 'Dossier Markdown is missing backend snapshot.'
    Assert-Condition ($markdown -like '*Management Next Actions*') 'Dossier Markdown is missing management next actions.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Customer project dossier validation passed.'
