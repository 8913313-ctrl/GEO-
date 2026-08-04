[CmdletBinding()]
param(
    [string]$Root = '',
    [int]$Port = 18280,
    [switch]$ProbeLocal
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [bool]$Passed,
        [string]$Message = ''
    )

    $checks.Add([pscustomobject]@{
        name = $Name
        passed = $Passed
        message = $Message
    }) | Out-Null
}

function Get-Text {
    param([Parameter(Mandatory = $true)] [string]$RelativePath)
    $path = Join-Path $rootPath ($RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $path)) {
        throw "Required file not found: $RelativePath"
    }

    return Get-Content -LiteralPath $path -Raw -Encoding UTF8
}

$routeText = Get-Text 'geoflow-integration/server-overrides/routes/publisher-assistant.php'
$deviceControllerText = Get-Text 'geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php'
$assistantControllerText = Get-Text 'geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherAssistantController.php'
$agentText = Get-Text 'desktop-agent/src/agent.js'
$clientText = Get-Text 'desktop-agent/src/geoflow-client.js'
$mainText = Get-Text 'desktop-agent/src/main.js'
$startCmdText = Get-Text 'desktop-agent/start.cmd'
$startBackgroundText = Get-Text 'desktop-agent/start-background.cmd'
$installDesktopText = Get-Text 'desktop-agent/install-desktop.ps1'
$protocolText = Get-Text 'docs/PUBLISHER-DEVICE-PROTOCOL.md'

Add-Check 'publisher_routes_do_not_require_global_api_token' ($routeText -notmatch "middleware\(\['api\.auth'\]\)") 'publisher node routes should use device-level credentials, not global API token middleware.'
Add-Check 'register_route_is_throttled' ($routeText -match "devices/register'.*[\r\n\s\S]*throttle:20,1") 'register endpoint should retain abuse throttling.'
Add-Check 'device_controller_uses_pairing_code' ($deviceControllerText -match 'validPairing' -and $deviceControllerText -match 'pairing_code') 'first binding must use a short-lived pairing code.'
Add-Check 'device_controller_requires_device_secret' ($deviceControllerText -match 'device_secret' -and $deviceControllerText -match 'publisher_device_secret_required') 'registered devices must have a local device secret.'
Add-Check 'device_controller_checks_hash_equals' ($deviceControllerText -match 'hash_equals') 'device secret comparison must use constant-time comparison.'
Add-Check 'assistant_controller_authorizes_worker' ($assistantControllerText -match 'authorizeWorker' -and $assistantControllerText -match 'X-Publisher-Worker') 'job APIs must authenticate the publisher worker.'
Add-Check 'client_prefers_device_secret_after_pairing' ($clientText -match 'deviceSecret' -and $clientText -match 'Authorization') 'desktop client must send a device credential for publisher APIs.'
Add-Check 'agent_distinguishes_device_secret_from_bound_state' ($agentText -match 'hasDeviceCredential' -and $agentText -match 'isPaired' -and $agentText -match 'pairedAt') 'local status must separate local secret from successful pairing.'
Add-Check 'agent_reports_sessions' ($agentText -match 'loadSessions' -and $agentText -match 'sessions') 'local node should expose platform session status.'
Add-Check 'main_exposes_sessions_endpoint' ($mainText -match "/api/sessions") 'local node should expose a sessions endpoint for diagnostics.'
Add-Check 'start_cmd_does_not_open_local_console' ($startCmdText -notmatch 'Start-Process.*http://127\.0\.0\.1:18280') 'normal start must be silent.'
Add-Check 'start_cmd_launches_hidden_agent' ($startCmdText -match 'WindowStyle Hidden' -and $startCmdText -match 'run-agent\.ps1') 'normal start must launch the hidden background node.'
Add-Check 'background_start_does_not_open_local_console' ($startBackgroundText -notmatch 'Start-Process.*http://127\.0\.0\.1:18280') 'background start must be silent.'
Add-Check 'desktop_install_does_not_open_local_console' ($installDesktopText -notmatch 'Start-Process.*http://127\.0\.0\.1:18280') 'desktop install must not pop the local console.'
Add-Check 'desktop_install_creates_hidden_shortcut' ($installDesktopText -match 'WindowStyle Hidden' -and $installDesktopText -match 'powershell\.exe' -and $installDesktopText -match 'run-agent\.ps1') 'desktop shortcut should open the hidden node directly.'
Add-Check 'protocol_mentions_pairing_and_device_secret' ($protocolText -match 'pairing_code' -and $protocolText -match 'device_secret') 'protocol doc must describe pairing and long-lived device credentials.'
Add-Check 'protocol_mentions_desktop_publisher' ($protocolText -match 'desktop_publisher') 'protocol doc must describe desktop_publisher task routing.'
Add-Check 'protocol_states_sensitive_boundary' ($protocolText -match 'Cookie' -and $protocolText -match 'Profile') 'protocol doc must state the sensitive data boundary.'

if ($ProbeLocal) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 5
        Add-Check 'local_healthz_ok' ([bool] $health.ok) "healthz returned service=$($health.service)"
        Add-Check 'local_healthz_has_pairing_fields' ($null -ne $health.status.isPaired -and $null -ne $health.status.hasDeviceCredential) 'healthz should expose pairing/product fields.'
    } catch {
        Add-Check 'local_healthz_ok' $false $_.Exception.Message
    }
}

$failed = @($checks | Where-Object { -not $_.passed })
if ($failed.Count -gt 0) {
    $failed | Format-Table -AutoSize
    throw "Publisher device protocol validation failed: $($failed.Count) check(s)"
}

Write-Host "Publisher device protocol validation passed. Checks: $($checks.Count)"
