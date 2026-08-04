param(
    [string]$GeoFlowBaseUrl = '',
    [int]$AgentPort = 18280
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
    $GeoFlowBaseUrl = if ($env:GEOFLOW_BASE_URL) { $env:GEOFLOW_BASE_URL } else { 'http://127.0.0.1:43127' }
}
if ($env:TZ_AGENT_PORT) {
    $AgentPort = [int]$env:TZ_AGENT_PORT
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20 or later is required.'
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)] [string]$FilePath,
        [Parameter(Mandatory = $true)] [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Write-Host 'Installing Tongzhuo GEO desktop agent dependencies...'
Invoke-CheckedCommand -FilePath 'npm.cmd' -Arguments @('install')
Invoke-CheckedCommand -FilePath 'npx.cmd' -Arguments @('playwright', 'install', 'chromium')

$configPath = Join-Path $PSScriptRoot '.data\config.json'
New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null
if (-not (Test-Path $configPath)) {
    $config = @{
        geoflowBaseUrl = $GeoFlowBaseUrl.TrimEnd('/')
        apiToken = ''
        port = $AgentPort
        pollSeconds = 20
        autoRun = $false
        capabilities = @('zhihu', 'wechat_mp', 'toutiao', 'zip-download')
    }
    $config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
}

Write-Host "Installation complete. Use the desktop shortcut or start.cmd to run the silent background node."
