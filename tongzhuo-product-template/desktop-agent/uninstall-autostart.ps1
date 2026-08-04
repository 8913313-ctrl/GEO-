param(
    [string]$TaskName = 'Tongzhuo GEO Desktop Agent'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Autostart removed: $TaskName"
} else {
    Write-Host "Autostart task was not found: $TaskName"
}

