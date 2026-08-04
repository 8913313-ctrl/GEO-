param(
    [string]$InstallDir = '',
    [switch]$InstallAutostart,
    [switch]$StartAfterInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'TongzhuoGEO\DesktopAgent'
}
$installPath = [IO.Path]::GetFullPath($InstallDir)
$sourcePath = $PSScriptRoot

function New-DesktopShortcut {
    param(
        [Parameter(Mandatory = $true)] [string]$InstallPath
    )

    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop '桐灼 GEO 发布执行器.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$InstallPath\run-agent.ps1`""
    $shortcut.WorkingDirectory = $InstallPath
    $shortcut.Description = 'Tongzhuo GEO Desktop Agent'
    $shortcut.Save()
}

if ($installPath.TrimEnd('\') -ieq $sourcePath.TrimEnd('\')) {
    Write-Host "Already installed at: $installPath"
} else {
    New-Item -ItemType Directory -Force -Path $installPath | Out-Null
    $preserveData = Test-Path (Join-Path $installPath '.data')
    $backupData = $null
    if ($preserveData) {
        $backupData = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-agent-data-' + [guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath (Join-Path $installPath '.data') -Destination $backupData -Force
    }

    try {
        Get-ChildItem -LiteralPath $installPath -Force | Where-Object { $_.Name -ne '.data' } | Remove-Item -Recurse -Force
        Get-ChildItem -LiteralPath $sourcePath -Force | Where-Object {
            $_.Name -notin @('node_modules', '.data')
        } | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $installPath $_.Name) -Recurse -Force
        }
    } finally {
        if ($backupData -and (Test-Path $backupData)) {
            Move-Item -LiteralPath $backupData -Destination (Join-Path $installPath '.data') -Force
        }
    }
}

Push-Location $installPath
try {
    powershell -ExecutionPolicy Bypass -File (Join-Path $installPath 'install.ps1')
    New-DesktopShortcut -InstallPath $installPath
    if ($InstallAutostart) {
        powershell -ExecutionPolicy Bypass -File (Join-Path $installPath 'install-autostart.ps1')
    }
    if ($StartAfterInstall) {
        Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$installPath\run-agent.ps1`""
    }
} finally {
    Pop-Location
}

Write-Host "Tongzhuo GEO Desktop Agent installed: $installPath"
