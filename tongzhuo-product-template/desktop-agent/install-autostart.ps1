param(
    [string]$TaskName = 'Tongzhuo GEO Desktop Agent'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20 or later is required.'
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\express')) -or -not (Test-Path (Join-Path $PSScriptRoot '.data\config.json'))) {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install.ps1')
}

$scriptPath = Join-Path $PSScriptRoot 'run-agent.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 30) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Autostart installed: $TaskName"
Write-Host 'The desktop agent will start automatically when this Windows user logs in.'
