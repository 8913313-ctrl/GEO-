param(
    [int]$AgentPort = 18280,
    [switch]$AllowPortInUse
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

function Add-Check {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [string]$Status,
        [string]$Detail = ''
    )

    return [pscustomobject]@{
        name = $Name
        status = $Status
        detail = $Detail
    }
}

function Get-NodeMajorVersion {
    $versionText = (& node --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($versionText)) {
        throw 'node --version failed.'
    }
    $normalized = ([string]$versionText).Trim().TrimStart('v')
    return [int]($normalized.Split('.')[0])
}

function Test-PortOpen {
    param([Parameter(Mandatory = $true)] [int]$Port)

    $client = [Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(500, $false)
        if ($connected) {
            $client.EndConnect($async)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

$checks = @()
$errors = @()

if ($PSVersionTable.PSVersion.Major -lt 5) {
    $errors += 'PowerShell 5 or later is required.'
    $checks += Add-Check -Name 'powershell' -Status 'failed' -Detail $PSVersionTable.PSVersion.ToString()
} else {
    $checks += Add-Check -Name 'powershell' -Status 'passed' -Detail $PSVersionTable.PSVersion.ToString()
}

foreach ($command in @('node', 'npm.cmd', 'npx.cmd')) {
    $resolved = Get-Command $command -ErrorAction SilentlyContinue
    if ($null -eq $resolved) {
        $errors += "$command is required."
        $checks += Add-Check -Name $command -Status 'failed' -Detail 'not found'
    } else {
        $checks += Add-Check -Name $command -Status 'passed' -Detail $resolved.Source
    }
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    try {
        $nodeMajor = Get-NodeMajorVersion
        if ($nodeMajor -lt 20) {
            $errors += "Node.js 20 or later is required. Current major version: $nodeMajor"
            $checks += Add-Check -Name 'node_version' -Status 'failed' -Detail "major=$nodeMajor"
        } else {
            $checks += Add-Check -Name 'node_version' -Status 'passed' -Detail "major=$nodeMajor"
        }
    } catch {
        $errors += $_.Exception.Message
        $checks += Add-Check -Name 'node_version' -Status 'failed' -Detail $_.Exception.Message
    }
}

foreach ($path in @('package.json', 'package-lock.json', 'src\main.js', 'public\index.html', 'install.ps1', 'run-agent.ps1', 'start.cmd')) {
    if (Test-Path (Join-Path $PSScriptRoot $path)) {
        $checks += Add-Check -Name "file:$path" -Status 'passed'
    } else {
        $errors += "Required desktop agent file missing: $path"
        $checks += Add-Check -Name "file:$path" -Status 'failed'
    }
}

$portInUse = Test-PortOpen -Port $AgentPort
if ($portInUse -and -not $AllowPortInUse) {
    $errors += "Local port $AgentPort is already in use."
    $checks += Add-Check -Name 'agent_port' -Status 'failed' -Detail "127.0.0.1:$AgentPort in use"
} elseif ($portInUse) {
    $checks += Add-Check -Name 'agent_port' -Status 'warning' -Detail "127.0.0.1:$AgentPort already in use"
} else {
    $checks += Add-Check -Name 'agent_port' -Status 'passed' -Detail "127.0.0.1:$AgentPort available"
}

$dataPath = Join-Path $PSScriptRoot '.data'
try {
    New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
    $probe = Join-Path $dataPath ('preflight-' + [guid]::NewGuid().ToString('N') + '.tmp')
    Set-Content -LiteralPath $probe -Value 'ok' -Encoding ASCII
    Remove-Item -LiteralPath $probe -Force
    $checks += Add-Check -Name 'data_directory' -Status 'passed' -Detail $dataPath
} catch {
    $errors += "Desktop agent .data directory is not writable: $($_.Exception.Message)"
    $checks += Add-Check -Name 'data_directory' -Status 'failed' -Detail $_.Exception.Message
}

$result = [ordered]@{
    status = if ($errors.Count -eq 0) { 'passed' } else { 'failed' }
    agent_port = $AgentPort
    root = $PSScriptRoot
    checks = $checks
    errors = $errors
}

$result | ConvertTo-Json -Depth 5 | Write-Output
if ($errors.Count -gt 0) {
    exit 1
}
