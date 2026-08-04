[CmdletBinding()]
param(
    [string]$ReleaseManifestPath = '',
    [string]$ReleaseRoot = '',
    [string]$ReleaseSlug = '',
    [Parameter(Mandatory = $true)] [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Assert-AbsoluteHttpUrl {
    param(
        [Parameter(Mandatory = $true)] [string]$Value,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    Assert-Condition (-not [string]::IsNullOrWhiteSpace($Value)) "$Name URL is empty."
    $uri = $null
    $isUri = [uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)
    Assert-Condition $isUri "$Name is not an absolute URL: $Value"
    Assert-Condition ($uri.Scheme -in @('http', 'https')) "$Name must use http or https: $Value"
    Assert-Condition (-not $Value.EndsWith('/')) "$Name must not end with a slash: $Value"
    Assert-Condition ($uri.AbsolutePath -notmatch '//+') "$Name contains duplicate slashes in its path: $Value"
}

function Assert-ArchiveEndpoint {
    param(
        [Parameter(Mandatory = $true)] [object]$Endpoints,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Expected
    )

    $value = [string] $Endpoints.$Name
    Assert-AbsoluteHttpUrl -Value $value -Name "Archive endpoint $Name"
    Assert-Condition ($value -eq $Expected) "Archive endpoint $Name mismatch. Expected $Expected, got $value"
}

function Resolve-ArtifactPath {
    param(
        [Parameter(Mandatory = $true)] [string]$ManifestDirectory,
        [Parameter(Mandatory = $true)] [string]$PathOrFile
    )

    if ([string]::IsNullOrWhiteSpace($PathOrFile)) {
        throw 'Artifact path is empty.'
    }

    $candidate = [IO.Path]::GetFullPath((Join-Path $ManifestDirectory (Split-Path $PathOrFile -Leaf)))
    if (Test-Path $candidate) {
        return $candidate
    }

    $absoluteCandidate = [IO.Path]::GetFullPath($PathOrFile)
    if (Test-Path $absoluteCandidate) {
        return $absoluteCandidate
    }

    throw "Artifact not found: $PathOrFile"
}

if ([string]::IsNullOrWhiteSpace($ReleaseManifestPath)) {
    if ([string]::IsNullOrWhiteSpace($ReleaseRoot) -or [string]::IsNullOrWhiteSpace($ReleaseSlug)) {
        throw 'Provide either -ReleaseManifestPath or both -ReleaseRoot and -ReleaseSlug.'
    }
    $ReleaseManifestPath = Join-Path ([IO.Path]::GetFullPath($ReleaseRoot)) "$ReleaseSlug-manifest.json"
}

$resolvedManifestPath = (Resolve-Path $ReleaseManifestPath).Path
$manifestDirectory = Split-Path $resolvedManifestPath -Parent
$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

Assert-Condition ([string] $manifest.version -eq $ExpectedVersion) "Customer delivery release manifest version mismatch. Expected $ExpectedVersion, got $($manifest.version)"
Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $manifest.release_slug)) 'Customer delivery release manifest is missing release_slug.'
Assert-Condition (-not [string]::IsNullOrWhiteSpace([string] $manifest.customer_slug)) 'Customer delivery release manifest is missing customer_slug.'
Assert-Condition ([bool] $manifest.gates.customer_config_validation) 'Customer delivery release manifest must declare customer_config_validation gate.'
Assert-Condition ([bool] $manifest.gates.customer_delivery_generation) 'Customer delivery release manifest must declare customer_delivery_generation gate.'
Assert-Condition ([bool] $manifest.gates.customer_delivery_package_validation) 'Customer delivery release manifest must declare customer_delivery_package_validation gate.'
Assert-Condition ([bool] $manifest.gates.excludes_customer_api_token) 'Customer delivery release manifest must declare customer API token exclusion.'
Assert-Condition ([bool] $manifest.gates.excludes_platform_credentials) 'Customer delivery release manifest must declare platform credential exclusion.'
Assert-Condition ([bool] $manifest.gates.excludes_browser_profiles) 'Customer delivery release manifest must declare browser profile exclusion.'
Assert-Condition ([bool] $manifest.gates.excludes_node_modules) 'Customer delivery release manifest must declare node_modules exclusion.'

$deliveryFile = [string] $manifest.delivery_package.file
if ([string]::IsNullOrWhiteSpace($deliveryFile)) {
    $deliveryFile = [string] $manifest.delivery_package.path
}
$deliveryZip = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile $deliveryFile
$validationReport = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.validation_report)
$checksumFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.checksum_file)
$configReviewFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.config_review)
$configReviewJsonFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.config_review_json)
$summaryFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.summary_file)
$releaseNotesFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.release_notes)
$releaseNotesJsonFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.release_notes_json)
$handoffChecklistFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.handoff_checklist)
$handoffChecklistJsonFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.handoff_checklist_json)
$firstTwoStagesPilotFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.first_two_stages_pilot_checklist)
$firstTwoStagesPilotJsonFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.first_two_stages_pilot_checklist_json)
$archiveIndexFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.archive_index)
$archiveIndexMarkdownFile = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $manifest.evidence.archive_index_markdown)

$deliveryItem = Get-Item -LiteralPath $deliveryZip
$deliveryHash = (Get-FileHash -LiteralPath $deliveryZip -Algorithm SHA256).Hash.ToLowerInvariant()
Assert-Condition ($deliveryHash -eq ([string] $manifest.delivery_package.sha256).ToLowerInvariant()) 'Customer delivery release SHA256 mismatch.'
Assert-Condition ([int64] $deliveryItem.Length -eq [int64] $manifest.delivery_package.bytes) 'Customer delivery release byte size mismatch.'

$checksumText = (Get-Content -LiteralPath $checksumFile -Raw -Encoding ASCII).Trim()
$checksumParts = @($checksumText -split '\s+')
Assert-Condition ($checksumParts.Count -ge 2) 'Customer delivery release .sha256 file must contain hash and filename.'
Assert-Condition ($checksumParts[0].ToLowerInvariant() -eq $deliveryHash) 'Customer delivery release .sha256 hash does not match delivery package.'
Assert-Condition ($checksumParts[1] -eq (Split-Path $deliveryZip -Leaf)) 'Customer delivery release .sha256 filename does not match delivery package.'

$report = Get-Content -LiteralPath $validationReport -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $report.status -eq 'passed') "Customer delivery release validation report did not pass. Status: $($report.status)"
Assert-Condition ([string] $report.version -eq $ExpectedVersion) "Customer delivery release validation report version mismatch. Expected $ExpectedVersion, got $($report.version)"
foreach ($check in @($report.checks)) {
    Assert-Condition ([string] $check.status -eq 'passed') "Customer delivery release validation check failed: $($check.name)"
}

$summaryText = Get-Content -LiteralPath $summaryFile -Raw -Encoding UTF8
Assert-Condition ($summaryText -like "*$(Split-Path $deliveryZip -Leaf)*") 'Customer delivery release summary is missing delivery package filename.'
Assert-Condition ($summaryText -like "*$deliveryHash*") 'Customer delivery release summary is missing delivery package SHA256.'

$configReview = Get-Content -LiteralPath $configReviewJsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $configReview.review_type -eq 'tongzhuo_customer_config_review') "Customer config review type mismatch: $($configReview.review_type)"
Assert-Condition ([string] $configReview.customer.slug -eq ([string] $manifest.customer_slug)) 'Customer config review customer slug does not match release manifest.'
Assert-Condition ([string] $configReview.endpoints.website -eq ([string] $manifest.site_url).TrimEnd('/')) 'Customer config review website endpoint does not match release manifest.'
Assert-Condition ([bool] $configReview.validation.api_token_empty) 'Customer config review must declare API Token is empty.'
$configReviewMarkdown = Get-Content -LiteralPath $configReviewFile -Raw -Encoding UTF8
Assert-Condition ($configReviewMarkdown -like '*## Endpoints*') 'Customer config review Markdown is missing endpoint section.'
Assert-Condition ($configReviewMarkdown -like '*## Security Boundary*') 'Customer config review Markdown is missing security boundary.'

$archiveIndex = Get-Content -LiteralPath $archiveIndexFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $archiveIndex.index_type -eq 'tongzhuo_customer_project_archive') "Archive index type mismatch: $($archiveIndex.index_type)"
Assert-Condition ([string] $archiveIndex.version -eq $ExpectedVersion) "Archive index version mismatch. Expected $ExpectedVersion, got $($archiveIndex.version)"
Assert-Condition ([string] $archiveIndex.release_slug -eq ([string] $manifest.release_slug)) 'Archive index release_slug does not match release manifest.'
Assert-Condition ([string] $archiveIndex.customer.slug -eq ([string] $manifest.customer_slug)) 'Archive index customer slug does not match release manifest.'
$archiveSiteUrl = ([string] $manifest.site_url).TrimEnd('/')
$archiveGeoflowUrl = ([string] $manifest.geoflow_base_url).TrimEnd('/')
$manifestDesktopAgentPort = if ($null -ne $manifest.desktop_agent_port) { [int] $manifest.desktop_agent_port } else { 18280 }
Assert-AbsoluteHttpUrl -Value $archiveSiteUrl -Name 'Release manifest site_url'
Assert-AbsoluteHttpUrl -Value $archiveGeoflowUrl -Name 'Release manifest geoflow_base_url'
Assert-Condition ([string] $archiveIndex.customer.site_url -eq $archiveSiteUrl) 'Archive index customer site_url does not match release manifest.'
Assert-Condition ([string] $archiveIndex.customer.geoflow_base_url -eq $archiveGeoflowUrl) 'Archive index customer geoflow_base_url does not match release manifest.'
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'website' -Expected $archiveSiteUrl
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'geoflow_admin' -Expected "$archiveGeoflowUrl/geo_admin"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'publisher_assistant' -Expected "$archiveGeoflowUrl/geo_admin/publisher-assistant"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'contact_leads' -Expected "$archiveGeoflowUrl/geo_admin/contact-leads"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'llms_txt' -Expected "$archiveSiteUrl/llms.txt"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'sitemap' -Expected "$archiveSiteUrl/sitemap.xml"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'feed' -Expected "$archiveSiteUrl/feed.xml"
Assert-ArchiveEndpoint -Endpoints $archiveIndex.endpoints -Name 'desktop_health' -Expected "http://127.0.0.1:$manifestDesktopAgentPort/healthz"
Assert-Condition ([string] $archiveIndex.acceptance.verify_delivery -like '*Verify*') 'Archive index is missing verify_delivery acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.preflight_report -like '*PreflightReport*') 'Archive index is missing preflight_report acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.onboarding_kit -like '*OnboardingKit*') 'Archive index is missing onboarding_kit acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.operating_plan -like '*OperatingPlan*') 'Archive index is missing operating_plan acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.sales_kit -like '*SalesKit*') 'Archive index is missing sales_kit acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.success_review -like '*SuccessReview*') 'Archive index is missing success_review acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.service_scope -like '*ServiceScope*') 'Archive index is missing service_scope acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.product_manual -like '*ProductManual*') 'Archive index is missing product_manual acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.operator_quickstart -like '*OperatorQuickstart*') 'Archive index is missing operator_quickstart acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.go_live_checklist -like '*GoLiveChecklist*') 'Archive index is missing go_live_checklist acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Archive index is missing publishing_loop_acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Archive index is missing publishing_loop_dry_run command.'
Assert-Condition ([string] $archiveIndex.acceptance.operations_evidence_pack -like '*OperationsEvidencePack*') 'Archive index is missing operations_evidence_pack command.'
Assert-Condition ([string] $archiveIndex.acceptance.server_dry_run -like '*ServerDryRunCommand*') 'Archive index is missing server dry-run acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.server_verify -like '*ServerVerifyCommand*') 'Archive index is missing server verify acceptance command.'
Assert-Condition ([string] $archiveIndex.acceptance.acceptance_report -like '*AcceptanceReport*') 'Archive index is missing acceptance report command.'
Assert-Condition ([string] $archiveIndex.acceptance.support_bundle -like '*SupportBundle*') 'Archive index is missing support bundle command.'
Assert-Condition ([string] $archiveIndex.acceptance.upgrade_plan -like '*UpgradePlan*') 'Archive index is missing upgrade plan command.'
Assert-Condition ([bool] $archiveIndex.support_boundary.platform_credentials_stay_local) 'Archive index must declare local platform credential boundary.'
Assert-Condition ([bool] $archiveIndex.support_boundary.customer_api_token_excluded) 'Archive index must declare customer API token exclusion.'
Assert-Condition ([bool] $archiveIndex.support_boundary.browser_profiles_excluded) 'Archive index must declare browser profile exclusion.'
Assert-Condition ([bool] $archiveIndex.support_boundary.server_passwords_excluded) 'Archive index must declare server password exclusion.'

$archiveArtifacts = @($archiveIndex.artifacts)
foreach ($role in @('customer_delivery_package', 'release_validation_report', 'release_manifest', 'customer_config_review', 'customer_config_review_json', 'checksum', 'release_summary', 'handoff_checklist', 'handoff_checklist_json', 'first_two_stages_pilot_checklist', 'first_two_stages_pilot_checklist_json')) {
    $record = @($archiveArtifacts | Where-Object { [string] $_.role -eq $role } | Select-Object -First 1)
    Assert-Condition ($record.Count -eq 1) "Archive index missing artifact role: $role"
    $artifactPath = Resolve-ArtifactPath -ManifestDirectory $manifestDirectory -PathOrFile ([string] $record[0].file)
    $artifactItem = Get-Item -LiteralPath $artifactPath
    $artifactHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Condition ($artifactHash -eq ([string] $record[0].sha256).ToLowerInvariant()) "Archive index SHA256 mismatch for role: $role"
    Assert-Condition ([int64] $artifactItem.Length -eq [int64] $record[0].bytes) "Archive index byte size mismatch for role: $role"
}

$archiveIndexMarkdown = Get-Content -LiteralPath $archiveIndexMarkdownFile -Raw -Encoding UTF8
Assert-Condition ($archiveIndexMarkdown -like "*$(Split-Path $deliveryZip -Leaf)*") 'Archive index Markdown is missing delivery package filename.'
Assert-Condition ($archiveIndexMarkdown -like '*platform credentials*') 'Archive index Markdown is missing security boundary notes.'

$releaseNotes = Get-Content -LiteralPath $releaseNotesJsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $releaseNotes.notes_type -eq 'tongzhuo_customer_delivery_release_notes') "Customer delivery release notes type mismatch: $($releaseNotes.notes_type)"
Assert-Condition ([string] $releaseNotes.version -eq $ExpectedVersion) "Customer delivery release notes version mismatch. Expected $ExpectedVersion, got $($releaseNotes.version)"
Assert-Condition ([string] $releaseNotes.release_slug -eq ([string] $manifest.release_slug)) 'Customer delivery release notes release_slug does not match release manifest.'
Assert-Condition ([string] $releaseNotes.customer.slug -eq ([string] $manifest.customer_slug)) 'Customer delivery release notes customer slug does not match release manifest.'
Assert-Condition ([string] $releaseNotes.endpoints.website -eq $archiveSiteUrl) 'Customer delivery release notes website endpoint mismatch.'
Assert-Condition ([string] $releaseNotes.endpoints.geoflow_admin -eq "$archiveGeoflowUrl/geo_admin") 'Customer delivery release notes GEOFlow admin endpoint mismatch.'
Assert-Condition ([string] $releaseNotes.endpoints.publisher_assistant -eq "$archiveGeoflowUrl/geo_admin/publisher-assistant") 'Customer delivery release notes publisher assistant endpoint mismatch.'
Assert-Condition ([string] $releaseNotes.endpoints.llms_txt -eq "$archiveSiteUrl/llms.txt") 'Customer delivery release notes llms.txt endpoint mismatch.'
Assert-Condition (@($releaseNotes.validation.checks).Count -ge 3) 'Customer delivery release notes should include validation checks.'
Assert-Condition (@($releaseNotes.component_artifacts).Count -ge 5) 'Customer delivery release notes should include component artifact integrity.'
Assert-Condition ([string] $releaseNotes.acceptance.verify_delivery -like '*Verify*') 'Customer delivery release notes are missing verify delivery acceptance command.'
Assert-Condition ([string] $releaseNotes.acceptance.preflight_report -like '*PreflightReport*') 'Customer delivery release notes are missing preflight report command.'
Assert-Condition ([string] $releaseNotes.acceptance.onboarding_kit -like '*OnboardingKit*') 'Customer delivery release notes are missing onboarding kit command.'
Assert-Condition ([string] $releaseNotes.acceptance.operating_plan -like '*OperatingPlan*') 'Customer delivery release notes are missing operating plan command.'
Assert-Condition ([string] $releaseNotes.acceptance.sales_kit -like '*SalesKit*') 'Customer delivery release notes are missing sales kit command.'
Assert-Condition ([string] $releaseNotes.acceptance.success_review -like '*SuccessReview*') 'Customer delivery release notes are missing success review command.'
Assert-Condition ([string] $releaseNotes.acceptance.service_scope -like '*ServiceScope*') 'Customer delivery release notes are missing service scope command.'
Assert-Condition ([string] $releaseNotes.acceptance.product_manual -like '*ProductManual*') 'Customer delivery release notes are missing product manual command.'
Assert-Condition ([string] $releaseNotes.acceptance.operator_quickstart -like '*OperatorQuickstart*') 'Customer delivery release notes are missing operator quickstart command.'
Assert-Condition ([string] $releaseNotes.acceptance.go_live_checklist -like '*GoLiveChecklist*') 'Customer delivery release notes are missing go-live checklist command.'
Assert-Condition ([string] $releaseNotes.acceptance.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Customer delivery release notes are missing publishing loop acceptance command.'
Assert-Condition ([string] $releaseNotes.acceptance.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Customer delivery release notes are missing publishing loop dry-run command.'
Assert-Condition ([string] $releaseNotes.acceptance.operations_evidence_pack -like '*OperationsEvidencePack*') 'Customer delivery release notes are missing operations evidence pack command.'
Assert-Condition ([string] $releaseNotes.acceptance.server_verify -like '*ServerVerifyCommand*') 'Customer delivery release notes are missing server verify acceptance command.'
Assert-Condition ([string] $releaseNotes.acceptance.support_bundle -like '*SupportBundle*') 'Customer delivery release notes are missing support bundle command.'
Assert-Condition ([bool] $releaseNotes.support_boundary.platform_credentials_stay_local) 'Customer delivery release notes must declare local platform credential boundary.'
Assert-Condition ([bool] $releaseNotes.support_boundary.platform_passwords_excluded) 'Customer delivery release notes must declare platform password exclusion.'
Assert-Condition ([bool] $releaseNotes.support_boundary.public_website_prices_excluded) 'Customer delivery release notes must declare public website price exclusion.'

$releaseNotesMarkdown = Get-Content -LiteralPath $releaseNotesFile -Raw -Encoding UTF8
Assert-Condition ($releaseNotesMarkdown -like "*$(Split-Path $deliveryZip -Leaf)*") 'Customer delivery release notes Markdown is missing delivery package filename.'
Assert-Condition ($releaseNotesMarkdown -like '*## Acceptance Commands*') 'Customer delivery release notes Markdown is missing acceptance commands.'
Assert-Condition ($releaseNotesMarkdown -like '*platform credentials*') 'Customer delivery release notes Markdown is missing platform credential boundary.'

$handoffChecklist = Get-Content -LiteralPath $handoffChecklistJsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $handoffChecklist.checklist_type -eq 'tongzhuo_customer_handoff_checklist') "Handoff checklist type mismatch: $($handoffChecklist.checklist_type)"
Assert-Condition ([string] $handoffChecklist.status -eq 'ready_for_signoff') "Handoff checklist status mismatch: $($handoffChecklist.status)"
Assert-Condition ([string] $handoffChecklist.release_slug -eq ([string] $manifest.release_slug)) 'Handoff checklist release_slug does not match release manifest.'
Assert-Condition ([string] $handoffChecklist.customer.slug -eq ([string] $manifest.customer_slug)) 'Handoff checklist customer slug does not match release manifest.'
Assert-Condition (@($handoffChecklist.required_files).Count -ge 5) 'Handoff checklist should include required files.'
Assert-Condition (@($handoffChecklist.signoff_sections).Count -ge 5) 'Handoff checklist should include signoff sections.'
Assert-Condition ([bool] $handoffChecklist.security_boundary.customer_api_tokens_excluded) 'Handoff checklist must declare API Token exclusion.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.preflight_report -like '*PreflightReport*') 'Handoff checklist must include preflight report command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.onboarding_kit -like '*OnboardingKit*') 'Handoff checklist must include onboarding kit command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.operating_plan -like '*OperatingPlan*') 'Handoff checklist must include operating plan command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.sales_kit -like '*SalesKit*') 'Handoff checklist must include sales kit command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.success_review -like '*SuccessReview*') 'Handoff checklist must include success review command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.service_scope -like '*ServiceScope*') 'Handoff checklist must include service scope command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.product_manual -like '*ProductManual*') 'Handoff checklist must include product manual command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.operator_quickstart -like '*OperatorQuickstart*') 'Handoff checklist must include operator quickstart command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.go_live_checklist -like '*GoLiveChecklist*') 'Handoff checklist must include go-live checklist command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.publishing_loop_acceptance -like '*PublishingLoopAcceptance*') 'Handoff checklist must include publishing loop acceptance command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.publishing_loop_dry_run -like '*PublishingLoopDryRun*') 'Handoff checklist must include publishing loop dry-run command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.operations_evidence_pack -like '*OperationsEvidencePack*') 'Handoff checklist must include operations evidence pack command.'
Assert-Condition ([string] $handoffChecklist.acceptance_commands.support_bundle -like '*SupportBundle*') 'Handoff checklist must include support bundle command.'

$handoffChecklistMarkdown = Get-Content -LiteralPath $handoffChecklistFile -Raw -Encoding UTF8
Assert-Condition ($handoffChecklistMarkdown -like '*## Signoff*') 'Handoff checklist Markdown is missing signoff section.'
Assert-Condition ($handoffChecklistMarkdown -like '*Customer API Tokens are not included*') 'Handoff checklist Markdown is missing API Token boundary.'

$pilotChecklist = Get-Content -LiteralPath $firstTwoStagesPilotJsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ([string] $pilotChecklist.checklist_type -eq 'tongzhuo_first_two_stages_pilot_checklist') "First two stages pilot checklist type mismatch: $($pilotChecklist.checklist_type)"
Assert-Condition ([string] $pilotChecklist.status -eq 'ready_for_pilot') "First two stages pilot checklist status mismatch: $($pilotChecklist.status)"
Assert-Condition ([string] $pilotChecklist.release_slug -eq ([string] $manifest.release_slug)) 'First two stages pilot checklist release_slug does not match release manifest.'
Assert-Condition ([string] $pilotChecklist.customer.slug -eq ([string] $manifest.customer_slug)) 'First two stages pilot checklist customer slug does not match release manifest.'
Assert-Condition (@($pilotChecklist.steps | Where-Object { [string] $_.stage -eq 'stage_1_cloud_workbench_ai_website' }).Count -eq 6) 'First two stages pilot checklist should include six stage 1 steps.'
Assert-Condition (@($pilotChecklist.steps | Where-Object { [string] $_.stage -eq 'stage_2_distribution_desktop_agent' }).Count -eq 6) 'First two stages pilot checklist should include six stage 2 steps.'
Assert-Condition ([bool] $pilotChecklist.security_boundary.platform_login_state_stays_local) 'First two stages pilot checklist must declare local platform login boundary.'
$pilotChecklistMarkdown = Get-Content -LiteralPath $firstTwoStagesPilotFile -Raw -Encoding UTF8
Assert-Condition ($pilotChecklistMarkdown -like '*Pilot Steps*') 'First two stages pilot checklist Markdown is missing Pilot Steps.'
Assert-Condition ($pilotChecklistMarkdown -like '*Security Boundary*') 'First two stages pilot checklist Markdown is missing Security Boundary.'

& (Join-Path $PSScriptRoot 'Test-CustomerDeliveryPackage.ps1') -PackagePath $deliveryZip -ExpectedVersion $ExpectedVersion
if ($LASTEXITCODE -ne 0) {
    throw "Customer delivery package validation failed with exit code $LASTEXITCODE"
}

Write-Host "Customer delivery release validation passed: $resolvedManifestPath"
