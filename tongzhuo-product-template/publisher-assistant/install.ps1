param(
    [string]$GeoFlowBaseUrl = '',
    [int]$PublisherPort = 19180,
    [string]$PublisherHost = '127.0.0.1',
    [switch]$BrowserHeadless
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($GeoFlowBaseUrl)) {
    $GeoFlowBaseUrl = if ($env:GEOFLOW_BASE_URL) { $env:GEOFLOW_BASE_URL } else { 'http://127.0.0.1:19080' }
}
if ($env:PUBLISHER_PORT) {
    $PublisherPort = [int]$env:PUBLISHER_PORT
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20 or later is required.'
}

Write-Host 'Installing publisher assistant dependencies...'
npm install
npx playwright install chromium

$extensionRoot = Join-Path $PSScriptRoot 'vendor\wechatsync-2.0.9'
$extensionZip = Join-Path $env:TEMP 'Tongzhuo-WechatSync.zip'
New-Item -ItemType Directory -Force -Path $extensionRoot | Out-Null

if (-not (Get-ChildItem -Path $extensionRoot -Filter manifest.json -Recurse -File -ErrorAction SilentlyContinue)) {
    Write-Host 'Preparing the local platform adapter...'
    Invoke-WebRequest -Uri 'https://wpics.oss-cn-shanghai.aliyuncs.com/wechatsync-2.0.9.zip?date=20260324' -OutFile $extensionZip
    Expand-Archive -Path $extensionZip -DestinationPath $extensionRoot -Force
}

$manifest = Get-ChildItem -Path $extensionRoot -Filter manifest.json -Recurse -File | Select-Object -First 1
if (-not $manifest) {
    throw 'Local platform adapter manifest.json was not found. Put the adapter in vendor\wechatsync-2.0.9 and retry.'
}

$extensionDir = $manifest.Directory.FullName
$bridgeSource = Join-Path $PSScriptRoot 'src\wechatsync-bridge.js'
$bridgeTarget = Join-Path $extensionDir 'tongzhuo-bridge.js'
Copy-Item -Path $bridgeSource -Destination $bridgeTarget -Force

$manifestJson = Get-Content $manifest.FullName -Raw | ConvertFrom-Json
foreach ($contentScript in @($manifestJson.content_scripts)) {
    if (@($contentScript.matches) -contains 'http://*/*') {
        $contentScript.js = @($contentScript.js | Where-Object { $_ -ne 'assets/Readability.js-DC-iE2S6.js' })
        if (@($contentScript.js) -notcontains 'tongzhuo-bridge.js') {
            $contentScript.js += 'tongzhuo-bridge.js'
        }
    }
}
$manifestJson | ConvertTo-Json -Depth 20 | Set-Content -Path $manifest.FullName -Encoding UTF8

$configPath = Join-Path $PSScriptRoot '.data\config.json'
New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null
if (-not (Test-Path $configPath)) {
    $config = @{ geoflowBaseUrl = $GeoFlowBaseUrl; apiToken = ''; port = $PublisherPort; pollSeconds = 20; extensionDir = $extensionDir; browserChannel = 'chromium'; browserHeadless = [bool]$BrowserHeadless; publishMode = 'publish' }
    $config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
} else {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $config.extensionDir = $extensionDir
    if ($null -eq $config.browserHeadless) { $config | Add-Member -NotePropertyName browserHeadless -NotePropertyValue ([bool]$BrowserHeadless) }
    $config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
}

Write-Host "Installation complete. Tongzhuo local adapter directory: $extensionDir"
Write-Host 'Run start.cmd. The browser will use an isolated local profile.'
