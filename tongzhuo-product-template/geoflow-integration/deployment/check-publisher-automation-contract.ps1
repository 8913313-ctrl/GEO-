param(
    [string]$PackageRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$overrides = Join-Path (Resolve-Path $PackageRoot).Path 'server-overrides'
$requiredFiles = @(
    'app/Console/Commands/ReconcilePublisherPlatformJobsCommand.php',
    'app/Http/Controllers/Admin/PublisherDeviceControlController.php',
    'app/Http/Controllers/Admin/PublisherDeviceController.php',
    'app/Http/Controllers/Admin/PublisherAssistantController.php',
    'app/Http/Controllers/Api/V1/PublisherAssistantController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceShadowController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceCommandController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceEventController.php',
    'app/Http/Controllers/Api/V1/PublisherPlatformJobController.php',
    'app/Models/PublisherPlatformJob.php',
    'app/Models/PublisherAccountGroup.php',
    'app/Services/Publishing/PublisherPlatformCatalogService.php',
    'app/Services/Publishing/PublisherBatchSummaryService.php',
    'app/Services/Publishing/PublisherPlatformJobLifecycleService.php',
    'database/migrations/2026_07_21_085000_add_pairing_fields_to_publisher_devices_table.php',
    'database/migrations/2026_08_15_000000_add_publisher_profile_lease_index.php',
    'database/migrations/2026_08_15_010000_add_publisher_account_group_source_fields.php',
    'database/migrations/2026_08_19_000000_align_publisher_platform_capabilities.php',
    'app/Services/Publishing/PublisherPreflightService.php',
    'app/Services/Publishing/PublishingCenterService.php',
    'app/Services/Publishing/PublisherDeviceCredential.php',
    'app/Services/Publishing/PublisherSelectorHealthService.php',
    'bootstrap/app.php',
    'config/publishing.php',
    'routes/publisher-assistant.php',
    'routes/publisher-device-sync.php',
    'routes/web.php',
    'resources/views/admin/publisher-assistant.blade.php',
    'resources/views/admin/publisher-devices/index.blade.php'
)

foreach ($relative in $requiredFiles) {
    $path = Join-Path $overrides $relative
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required publisher automation file is missing: $relative"
    }
}

function Read-Override([string]$RelativePath) {
    return Get-Content -LiteralPath (Join-Path $overrides $RelativePath) -Raw -Encoding UTF8
}

function Assert-Contains([string]$Content, [string]$Needle, [string]$Message) {
    if (-not $Content.Contains($Needle)) {
        throw $Message
    }
}

$legacy = Read-Override 'app/Http/Controllers/Api/V1/PublisherAssistantController.php'
Assert-Contains $legacy "->whereDoesntHave('publisherPlatformJobs')" 'Legacy queue does not exclude V2 child jobs.'
Assert-Contains $legacy 'isV2PublisherDistribution' 'Legacy queue does not verify the V2 protocol marker.'
Assert-Contains $legacy 'protocol_version' 'Legacy queue protocol marker check is missing.'

$control = Read-Override 'app/Http/Controllers/Admin/PublisherDeviceControlController.php'
Assert-Contains $control '$state[''enabled_platform_ids_present''] = true' 'Desired-state presence is not persisted.'
Assert-Contains $control '$request->has(''enabled_platform_ids'')' 'Desired-state API callers cannot submit a platform allowlist without a form marker.'
Assert-Contains $control "'platform_filter_mode' => 'all'" 'Desired-state all mode is missing.'
Assert-Contains $control "'platform_filter_mode'] =" 'Desired-state mode normalization is missing.'
Assert-Contains $control "'default_daily_quota'" 'Desired-state daily quota control is missing.'
Assert-Contains $control "'platform_daily_quota'" 'Desired-state per-platform quota control is missing.'
Assert-Contains $control "'risk_pause_threshold'" 'Desired-state risk pause control is missing.'
Assert-Contains $control '$state[''takeover''] = $takeoverRequested' 'Force-takeover is not bound to a new desired-state version.'
if ($control.Contains('''local_override'' => $clearOverride')) {
    throw 'Admin control clears local_override before the device acknowledges the takeover.'
}

$deviceCredential = Read-Override 'app/Services/Publishing/PublisherDeviceCredential.php'
Assert-Contains $deviceCredential 'HASH_PREFIX' 'Device credentials are not stored as tagged hashes.'
Assert-Contains $deviceCredential 'Backward compatibility' 'Existing raw device credentials cannot be upgraded safely.'
foreach ($relative in @(
    'app/Http/Controllers/Api/V1/PublisherDeviceShadowController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceEventController.php',
    'app/Http/Controllers/Api/V1/PublisherPlatformJobController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceCommandController.php',
    'app/Http/Controllers/Api/V1/PublisherAssistantController.php',
    'app/Http/Controllers/Api/V1/PublisherDeviceController.php'
)) {
    Assert-Contains (Read-Override $relative) 'PublisherDeviceCredential::verify' "Device credential verification was not hardened: $relative"
}

$shadow = Read-Override 'app/Http/Controllers/Api/V1/PublisherDeviceShadowController.php'
Assert-Contains $shadow "'enabled_platform_ids_present'" 'Device shadow does not expose platform-list presence.'
Assert-Contains $shadow "'platform_filter_mode'" 'Device shadow does not expose platform filter mode.'
Assert-Contains $shadow "'none'" 'Device shadow does not model deny-all.'
Assert-Contains $shadow "'platform_daily_quota'" 'Device shadow does not expose per-platform quotas.'
Assert-Contains $shadow "'risk_pause_minutes'" 'Device shadow does not expose risk pause settings.'
Assert-Contains $shadow 'publisher_reported_state' 'Device shadow does not retain the node applied-state acknowledgement.'
Assert-Contains $shadow 'reportedStateSnapshot' 'Device shadow does not sanitize applied-state acknowledgement data.'
Assert-Contains $shadow 'desired_state_report' 'Device shadow does not accept the legacy heartbeat acknowledgement envelope.'
Assert-Contains $shadow 'DB::beginTransaction()' 'Device shadow heartbeats are not serialized in a transaction.'
Assert-Contains $shadow 'lockForUpdate()' 'Device shadow heartbeats do not lock the device row.'
Assert-Contains $shadow '$storedDesiredVersionSeen' 'Device shadow desired-version acknowledgement can regress.'
Assert-Contains $shadow 'array_replace($storedReportedState, $incomingReported)' 'Legacy heartbeats can clear the stored reported-state snapshot.'
Assert-Contains $shadow 'syncAccountGroups' 'Device heartbeat does not mirror local account groups into the publishing center.'
Assert-Contains $shadow 'publisher_device_id' 'Mirrored account groups are not scoped to their source device.'
$accountGroupMigration = Read-Override 'database/migrations/2026_08_15_010000_add_publisher_account_group_source_fields.php'
Assert-Contains $accountGroupMigration 'publisher_account_groups_device_external_unique' 'Mirrored account groups have no stable device/external identity.'
Assert-Contains $accountGroupMigration 'hasDeviceExternalUniqueIndex' 'Account-group source migration is not safe to rerun after a partial deployment.'

$events = Read-Override 'app/Http/Controllers/Api/V1/PublisherDeviceEventController.php'
Assert-Contains $events 'device_events_enabled' 'Device event stream is not guarded by a feature flag.'
Assert-Contains $events 'text/event-stream' 'Device event endpoint does not return SSE.'
Assert-Contains $events 'X-Accel-Buffering' 'Device event stream does not disable proxy buffering.'
Assert-Contains $events 'bearerToken' 'Device event stream does not authenticate the device credential.'
Assert-Contains $events 'desired_state_changed' 'Device event stream does not wake desired-state synchronization.'
Assert-Contains $events 'commands_available' 'Device event stream does not wake command processing.'
Assert-Contains $events 'jobs_available' 'Device event stream does not wake job polling.'

$deviceSyncRoutes = Read-Override 'routes/publisher-device-sync.php'
foreach ($fragment in @(
    'devices/register',
    'devices/{device}/heartbeat',
    'devices/{device}/shadow',
    'devices/{device}/events',
    'devices/{device}/sessions',
    'devices/{device}/commands'
)) {
    Assert-Contains $deviceSyncRoutes $fragment "Device sync route is missing: $fragment"
}
Assert-Contains $deviceSyncRoutes '$publisherDeviceRouteExists' 'Device sync route registrations are not duplicate-safe.'
foreach ($routeContract in @(
    "Route::post('devices/register'",
    "Route::post('devices/{device}/heartbeat'",
    "Route::post('devices/{device}/shadow/heartbeat'",
    "Route::get('devices/{device}/shadow'",
    "Route::get('devices/{device}/events'",
    "Route::get('devices/{device}/sessions'",
    "Route::post('devices/{device}/sessions'",
    "Route::get('devices/{device}/commands'",
    "Route::post('devices/{device}/commands/{command}/claim'",
    "Route::post('devices/{device}/commands/{command}/ack'",
    "Route::post('devices/{device}/commands/{command}/result'"
)) {
    Assert-Contains $deviceSyncRoutes $routeContract "Device sync HTTP contract is missing: $routeContract"
}

$publisherRoutes = Read-Override 'routes/publisher-assistant.php'
Assert-Contains $publisherRoutes 'platform-jobs' 'V2 platform-job routes are missing.'
Assert-Contains $publisherRoutes '$publisherRouteExists' 'Publisher V1/V2 route registrations are not duplicate-safe.'
if ($publisherRoutes.Contains('devices/{device}/')) {
    throw 'Publisher jobs route file must not duplicate device synchronization endpoints.'
}


$deviceSessions = Read-Override 'app/Http/Controllers/Api/V1/PublisherDeviceController.php'
Assert-Contains $deviceSessions '->limit(100)' 'Device session response still truncates the 28-platform catalog.'
Assert-Contains $deviceSessions 'PublisherDeviceShadowController' 'Legacy heartbeat does not delegate to the device-shadow handler.'
Assert-Contains $deviceSessions 'DB::transaction' 'Device pairing registration is not atomic.'
Assert-Contains $deviceSessions 'PublisherDevicePairing::query()' 'Device pairing registration does not lock the pairing row.'
Assert-Contains $deviceSessions '->lockForUpdate()' 'Device pairing registration does not use a database row lock.'
Assert-Contains $deviceSessions 'Serialize session upserts per device' 'Concurrent platform session reports are not serialized.'
Assert-Contains $deviceSessions 'PublisherAccountGroupItem::query()' 'Platform session updates do not reconnect mirrored account-group items.'
Assert-Contains $deviceSessions "->update(['publisher_platform_session_id' => `$session->id])" 'Session updates do not persist the repaired account-group relation.'

$pairingMigration = Read-Override 'database/migrations/2026_07_21_085000_add_pairing_fields_to_publisher_devices_table.php'
Assert-Contains $pairingMigration "Schema::hasTable('publisher_devices')" 'Pairing compatibility migration does not guard a missing device table.'
Assert-Contains $pairingMigration "Schema::hasColumn('publisher_devices', 'connection_mode')" 'Pairing compatibility migration still unconditionally adds existing columns.'

$catalog = Read-Override 'app/Services/Publishing/PublisherPlatformCatalogService.php'
Assert-Contains $catalog 'EXPECTED_EXTERNAL_PLATFORM_COUNT = 28' 'Backend catalog does not declare all 28 external platforms.'
Assert-Contains $catalog 'VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS' 'Backend catalog does not declare the verified direct-publish allowlist.'
Assert-Contains $catalog "'supports_direct_publish' => `$isVerifiedDirect" 'Backend catalog does not derive direct-publish capability from the verified allowlist.'
Assert-Contains $catalog "'supports_scheduled' => `$isVerifiedDirect" 'Backend catalog does not derive scheduled capability from the verified allowlist.'
$expectedPlatformIds = @(
    'wechat_mp', 'zhihu', 'weibo', 'xiaohongshu', 'juejin', 'csdn', 'jianshu', 'toutiao',
    'douyin', 'bilibili', 'baijiahao', 'yuque', 'douban', 'sohu', 'xueqiu', 'woshipm',
    'dayu', 'yidian', '51cto', 'imooc', 'oschina', 'segmentfault', 'cnblogs', 'sohufocus',
    'x', 'eastmoney', 'smzdm', 'netease'
)
$catalogIds = @([regex]::Matches($catalog, '\$this->platform\(''([^'']+)''') | ForEach-Object { $_.Groups[1].Value })
if ($catalogIds.Count -ne $expectedPlatformIds.Count -or @($catalogIds | Sort-Object -Unique).Count -ne $expectedPlatformIds.Count) {
    throw "Backend catalog must contain exactly $($expectedPlatformIds.Count) unique platform IDs; got $($catalogIds.Count)."
}
$missingPlatformIds = @($expectedPlatformIds | Where-Object { $_ -notin $catalogIds })
$unexpectedPlatformIds = @($catalogIds | Where-Object { $_ -notin $expectedPlatformIds })
if ($missingPlatformIds.Count -gt 0 -or $unexpectedPlatformIds.Count -gt 0) {
    throw "Backend catalog IDs diverge from the desktop contract. Missing: $($missingPlatformIds -join ', '); unexpected: $($unexpectedPlatformIds -join ', ')."
}
Assert-Contains $catalog "'support_level' => `$isHidden ? 'planned' : (`$isVerifiedDirect ? 'ready' : 'manual')" 'Backend catalog support levels do not enforce ready/manual/hidden policy.'
Assert-Contains $catalog "public const HIDDEN_PLATFORM_IDS = ['x']" 'Backend catalog does not retain the explicit hidden-platform policy.'
Assert-Contains $catalog "->whereNotIn('platform_id', self::HIDDEN_PLATFORM_IDS)" 'Hidden platforms are still exposed by the publishing-console catalog.'
$platformJobs = Read-Override 'app/Http/Controllers/Api/V1/PublisherPlatformJobController.php'
Assert-Contains $platformJobs 'desiredStateAllowsPlatform' 'V2 claim path does not enforce desired-state platform policy.'
Assert-Contains $platformJobs 'publisher_platform_job_not_claimable' 'V2 claim path can bypass scheduler or login holds.'
Assert-Contains $platformJobs "'support_level'" 'V2 job response does not expose support_level.'
Assert-Contains $platformJobs "'manual_confirmation'" 'V2 job response does not expose manual_confirmation.'
foreach ($field in @('requested_publish_mode', 'effective_publish_mode', 'execution_mode', 'capabilities', 'publisher_account_group_id', 'account_group_id', 'target_device_id', 'platform_details', 'payload', 'article')) {
    Assert-Contains $platformJobs "'$field'" "V2 job response does not expose $field."
}
Assert-Contains $platformJobs 'lockProfileClaimBoundary' 'V2 claim path does not serialize profile-level claim decisions.'
Assert-Contains $platformJobs 'PublisherDevice::query()' 'V2 profile claim boundary does not lock the device row.'

Assert-Contains $platformJobs "->first(['id']) !== null" 'V2 profile lease check is not a current locking read.'
Assert-Contains $platformJobs 'terminal report is an idempotent read' 'Duplicate terminal reports can rewrite completed platform results.'
Assert-Contains $platformJobs 'ArticleDistribution::query()' 'Concurrent platform results do not serialize on the parent distribution.'
$profileLeaseMigration = Read-Override 'database/migrations/2026_08_15_000000_add_publisher_profile_lease_index.php'
Assert-Contains $profileLeaseMigration 'publisher_platform_jobs_profile_lease_index' 'Profile-lease composite index migration is missing.'
Assert-Contains $profileLeaseMigration "['publisher_device_id', 'profile_key', 'status', 'lease_expires_at']" 'Profile-lease index columns are incomplete.'


$jobModel = Read-Override 'app/Models/PublisherPlatformJob.php'
Assert-Contains $jobModel 'function platform(): BelongsTo' 'V2 job model platform relation is missing.'

$center = Read-Override 'app/Services/Publishing/PublishingCenterService.php'
Assert-Contains $center "'preflight' => [" 'V2 job does not retain the creation-time preflight snapshot.'
Assert-Contains $center "'manual_confirmation' => (bool)" 'V2 preflight manual-confirmation snapshot is missing.'
Assert-Contains $center 'isIdempotencyUniqueViolation' 'Concurrent V2 batch creation is not recovered as an idempotent replay.'
Assert-Contains $center '$publishMode === ''scheduled'' ? ''direct''' 'Scheduled batches still downgrade verified platforms to draft execution.'
Assert-Contains $center 'PublisherPlatformCatalogService::HIDDEN_PLATFORM_IDS' 'Publishing center does not enforce the hidden-platform policy.'
Assert-Contains $center 'Hidden publisher platforms cannot receive tasks' 'Publishing center does not reject direct hidden-platform task requests.'
Assert-Contains $center '$groupItem?->publisher_device_id' 'Account-group jobs lose their source device while waiting for login.'
Assert-Contains $center '$groupItem?->publisher_platform_session_id' 'Account-group jobs lose their known session while waiting for login.'
Assert-Contains $center '$groupItem?->profile_key' 'Account-group jobs lose their profile identity while waiting for login.'

$preflight = Read-Override 'app/Services/Publishing/PublisherPreflightService.php'
Assert-Contains $preflight '?PublisherAccountGroup $accountGroup' 'Publishing preflight cannot scope sessions to a selected account group.'
Assert-Contains $preflight "['direct', 'scheduled']" 'Scheduled publishing does not use the direct-publish capability gate.'
Assert-Contains $preflight 'bool $manualConfirmation = true' 'Draft and blocked preflight items must default to manual confirmation.'

$adminAssistant = Read-Override 'app/Http/Controllers/Admin/PublisherAssistantController.php'
Assert-Contains $adminAssistant 'createPublishingBatch' 'Publishing console has no explicit one-click batch action.'
Assert-Contains $adminAssistant "publishMode: 'direct'" 'One-click publishing does not request direct mode explicitly.'
Assert-Contains $adminAssistant 'VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS' 'One-click publishing is not restricted to verified direct platforms.'
Assert-Contains $adminAssistant "'platform_ids' => ['required', 'array', 'min:1']" 'Publishing batch action does not require explicit target platforms.'
Assert-Contains $adminAssistant "'scheduled_at' => ['nullable', 'required_if:publish_mode,scheduled', 'date', 'after:now']" 'Publishing batch action does not require a future execution time for scheduled jobs.'
Assert-Contains $adminAssistant "'idempotency_key' => ['required', 'string', 'max:120']" 'Publishing batch action has no double-submit idempotency token.'
Assert-Contains $adminAssistant 'idempotencyKey: $validated[''idempotency_key'']' 'Publishing batch action does not pass its idempotency token to V2 creation.'
$adminWebRoutes = Read-Override 'routes/web.php'
Assert-Contains $adminWebRoutes 'publisher-assistant/batches' 'Publishing console batch route is missing.'
$assistantView = Read-Override 'resources/views/admin/publisher-assistant.blade.php'
Assert-Contains $assistantView 'name="account_group_id"' 'Publishing console cannot select an account group.'
Assert-Contains $assistantView 'name="platform_ids[]"' 'Publishing console cannot select target platforms.'
Assert-Contains $assistantView 'name="scheduled_at"' 'Publishing console cannot schedule a batch.'
Assert-Contains $assistantView 'name="idempotency_key"' 'Publishing console does not retain one request identity across retries.'

$command = Read-Override 'app/Console/Commands/ReconcilePublisherPlatformJobsCommand.php'
Assert-Contains $command 'publisher:reconcile' 'Publisher reconcile command signature is missing.'
$batchSummary = Read-Override 'app/Services/Publishing/PublisherBatchSummaryService.php'
Assert-Contains $batchSummary 'DB::transaction' 'Publisher batch summaries are not updated transactionally.'
Assert-Contains $batchSummary 'lockForUpdate()' 'Publisher batch summaries can be overwritten by concurrent platform results.'
Assert-Contains $batchSummary '$completedAt' 'Repeated summary refreshes can move the batch completion timestamp.'

Assert-Contains $command 'PublisherPlatformJobLifecycleService' 'Publisher reconcile command is not wired to the lifecycle service.'
$lifecycle = Read-Override 'app/Services/Publishing/PublisherPlatformJobLifecycleService.php'
Assert-Contains $lifecycle 'pinnedDeviceId' 'Account-group or specified-device jobs can drift to another publishing computer.'
Assert-Contains $lifecycle '$distribution->publisher_account_group_id !== null' 'Account-group jobs are not treated as device-pinned during reconciliation.'

$bootstrap = Read-Override 'bootstrap/app.php'
Assert-Contains $bootstrap 'ReconcilePublisherPlatformJobsCommand::class' 'Publisher reconcile command is not registered.'
Assert-Contains $bootstrap '->withSchedule(' 'Laravel Scheduler hook is missing.'
Assert-Contains $bootstrap "->command('publisher:reconcile')" 'Publisher reconcile schedule entry is missing.'
Assert-Contains $bootstrap '->withoutOverlapping(5)' 'Publisher reconcile overlap lock is missing.'
Assert-Contains $bootstrap "require __DIR__.'/../routes/publisher-device-sync.php'" 'Bootstrap does not load device synchronization independently.'
if ($bootstrap.Contains("if (Route::getRoutes()->getByName('api.v1.publisher.jobs.index') === null)")) {
    throw 'Device synchronization must not be gated by the legacy V1 jobs route.'
}

$config = Read-Override 'config/publishing.php'
Assert-Contains $config 'PUBLISHER_JOB_RECONCILE_SCHEDULE_ENABLED' 'Publisher reconcile schedule feature flag is missing.'

Assert-Contains $config 'PUBLISHER_DEVICE_EVENTS_ENABLED' 'Device event stream feature flag is missing.'
Assert-Contains $config 'PUBLISHER_SELECTOR_HEALTH_MIN_SAMPLES' 'Selector health minimum sample threshold is missing.'
Assert-Contains $config 'PUBLISHER_SELECTOR_HEALTH_ALERT_RATE' 'Selector health alert threshold is missing.'

$selectorHealth = Read-Override 'app/Services/Publishing/PublisherSelectorHealthService.php'
Assert-Contains $selectorHealth 'selector_telemetry' 'Selector health service does not read node telemetry.'
Assert-Contains $selectorHealth 'PublisherPlatformJob' 'Selector health service does not aggregate V2 job results.'
Assert-Contains $selectorHealth 'publisherPlatformResults' 'Selector health service does not aggregate V1 job results.'
Assert-Contains $selectorHealth "'hit_rate'" 'Selector health service does not calculate a hit rate.'

$view = Read-Override 'resources/views/admin/publisher-devices/index.blade.php'
Assert-Contains $view 'name="platform_filter_mode"' 'Device admin page has no explicit platform filter mode.'
Assert-Contains $view 'value="none"' 'Device admin page has no deny-all option.'
Assert-Contains $view 'selectorHealth' 'Device admin page does not render selector health.'
Assert-Contains $view 'default_daily_quota' 'Device admin page has no default daily quota control.'
Assert-Contains $view 'platform_daily_quota_json' 'Device admin page has no per-platform quota control.'
Assert-Contains $view '$reportedAutoRun' 'Device admin page does not show the node reported effective state.'

$adminDevices = Read-Override 'app/Http/Controllers/Admin/PublisherDeviceController.php'
Assert-Contains $adminDevices 'PublisherSelectorHealthService' 'Device admin controller does not inject selector health aggregation.'
Assert-Contains $adminDevices "'selectorHealth'" 'Device admin controller does not expose selector health to the view.'


$operations = Join-Path (Resolve-Path $PackageRoot).Path 'docs/PUBLISHER-AUTOMATION-OPERATIONS.md'
if (-not (Test-Path -LiteralPath $operations)) {
    throw 'Publisher automation operations document is missing.'
}

$php = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $php) {
    foreach ($relative in $requiredFiles | Where-Object { $_ -like '*.php' }) {
        & $php.Source -l (Join-Path $overrides $relative) | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "PHP syntax check failed: $relative"
        }
    }

    Write-Host 'PHP syntax: PASS'
} else {
    Write-Host 'PHP syntax: SKIPPED (php executable is unavailable)'
}

Write-Host 'Publisher automation contract: PASS'
