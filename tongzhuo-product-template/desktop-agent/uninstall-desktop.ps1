param(
    [string]$InstallDir = '',
    [switch]$RemoveData
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'TongzhuoGEO\DesktopAgent'
}
$installPath = [IO.Path]::GetFullPath($InstallDir)

$uninstallAutostart = Join-Path $installPath 'uninstall-autostart.ps1'
if (Test-Path $uninstallAutostart) {
    powershell -ExecutionPolicy Bypass -File $uninstallAutostart
}

$desktop = [Environment]::GetFolderPath('Desktop')
foreach ($shortcutName in @('桐灼 GEO 发布执行器.lnk', 'Tongzhuo GEO Desktop Agent.lnk')) {
    $shortcutPath = Join-Path $desktop $shortcutName
    if (Test-Path $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath -Force
    }
}

if (Test-Path $installPath) {
    if ($RemoveData) {
        Remove-Item -LiteralPath $installPath -Recurse -Force
    } else {
        Get-ChildItem -LiteralPath $installPath -Force | Where-Object { $_.Name -ne '.data' } | Remove-Item -Recurse -Force
        Write-Host "Program files removed. Data preserved at: $(Join-Path $installPath '.data')"
    }
}

Write-Host 'Tongzhuo GEO Desktop Agent uninstalled.'
