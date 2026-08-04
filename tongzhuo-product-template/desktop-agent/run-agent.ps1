param(
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$mutexName = 'Global\TongzhuoGeoDesktopAgent'
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
if (-not $mutex.WaitOne(0)) {
    Write-Host 'Tongzhuo GEO desktop agent is already running.'
    exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20 or later is required.'
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\express')) -or -not (Test-Path (Join-Path $PSScriptRoot '.data\config.json'))) {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install.ps1')
}

try {
    while ($true) {
        try {
            & node (Join-Path $PSScriptRoot 'src\main.js')
        } catch {
            Write-Host ("Tongzhuo GEO desktop agent crashed: " + $_.Exception.Message)
        }
        Start-Sleep -Seconds ([Math]::Max(3, $RestartDelaySeconds))
    }
} finally {
    try {
        $mutex.ReleaseMutex()
    } catch {
        # Process shutdown may already have released the mutex.
    }
    $mutex.Dispose()
}
