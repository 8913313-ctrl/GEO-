[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$PackagePath = '',
    [Parameter(Mandatory = $true)] [string]$ServerHost,
    [string]$SshUser = 'root',
    [string]$RemotePackageDir = '/tmp',
    [string]$LaravelRoot = '/www/wwwroot/geoflow',
    [string]$BaseUrl = '',
    [string]$AdminPath = 'geo_admin',
    [switch]$Install,
    [switch]$SkipMigrate,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path

function Assert-Command {
    param([Parameter(Mandatory = $true)] [string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name command not found. Install OpenSSH client or run this script from a shell that has $Name."
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)] [string]$FilePath,
        [Parameter(Mandatory = $true)] [string[]]$Arguments
    )

    Write-Host ">> $FilePath $($Arguments -join ' ')"
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
}

function ConvertTo-BashSingleQuoted {
    param([Parameter(Mandatory = $true)] [string]$Value)

    return "'" + ($Value -replace "'", "'\''") + "'"
}

Assert-Command -Name 'scp'
Assert-Command -Name 'ssh'

& (Join-Path $rootPath 'scripts\Test-ServerOverrides.ps1') -Root $rootPath

if ([string]::IsNullOrWhiteSpace($PackagePath)) {
    $distDir = Join-Path $rootPath 'dist'
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $PackagePath = Join-Path $distDir "tongzhuo-geoflow-server-overrides-$stamp.zip"
    & (Join-Path $rootPath 'scripts\Package-GeoFlowServer.ps1') -Root $rootPath -OutputPath $PackagePath
} else {
    $PackagePath = (Resolve-Path $PackagePath).Path
    $product = & (Join-Path $rootPath 'scripts\Read-ProductMetadata.ps1') -Root $rootPath
    & (Join-Path $rootPath 'scripts\Test-GeoFlowServerPackage.ps1') -PackagePath $PackagePath -ExpectedVersion ([string] $product.version)
}

$resolvedPackage = (Resolve-Path $PackagePath).Path
$zipName = [IO.Path]::GetFileName($resolvedPackage)
$remote = "$SshUser@$ServerHost"
$remotePackageDir = $RemotePackageDir.TrimEnd('/')
$remoteZipPath = "$remotePackageDir/$zipName"
$remotePackageRoot = "$remotePackageDir/tongzhuo-geoflow-server-overrides"
$laravelRootQuoted = ConvertTo-BashSingleQuoted -Value $LaravelRoot
$packageRootQuoted = ConvertTo-BashSingleQuoted -Value $remotePackageRoot
$remoteZipQuoted = ConvertTo-BashSingleQuoted -Value $remoteZipPath
$remotePackageDirQuoted = ConvertTo-BashSingleQuoted -Value $remotePackageDir

Write-Host "Uploading package to ${remote}:$remoteZipPath"
Invoke-Checked -FilePath 'ssh' -Arguments @($remote, "mkdir -p $remotePackageDirQuoted")
Invoke-Checked -FilePath 'scp' -Arguments @($resolvedPackage, "${remote}:$remoteZipPath")

Invoke-Checked -FilePath 'ssh' -Arguments @(
    $remote,
    "rm -rf $packageRootQuoted && unzip -oq $remoteZipQuoted -d $remotePackageDirQuoted"
)

$dryRunCommand = "cd $packageRootQuoted && bash deployment/install-geoflow-overrides.sh --laravel-root $laravelRootQuoted --package-root . --dry-run"
if ($SkipMigrate) {
    $dryRunCommand += ' --skip-migrate'
}
Invoke-Checked -FilePath 'ssh' -Arguments @($remote, $dryRunCommand)

if (-not $Install) {
    Write-Host 'Remote dry-run passed. Re-run with -Install to copy files, run migrations, clear caches, and run verification.'
    Write-Host "Package: $resolvedPackage"
    exit 0
}

$installCommand = "cd $packageRootQuoted && bash deployment/install-geoflow-overrides.sh --laravel-root $laravelRootQuoted --package-root ."
if ($SkipMigrate) {
    $installCommand += ' --skip-migrate'
}
Invoke-Checked -FilePath 'ssh' -Arguments @($remote, $installCommand)

$verifyCommand = "cd $packageRootQuoted && bash deployment/verify-geoflow-overrides.sh --laravel-root $laravelRootQuoted --admin-path $(ConvertTo-BashSingleQuoted -Value $AdminPath)"
if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    $verifyCommand += " --base-url $(ConvertTo-BashSingleQuoted -Value $BaseUrl)"
}
Invoke-Checked -FilePath 'ssh' -Arguments @($remote, $verifyCommand)

if (-not $SkipSmoke -and -not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    $smokeCommand = "cd $packageRootQuoted && bash deployment/smoke-geoflow-workbench.sh --base-url $(ConvertTo-BashSingleQuoted -Value $BaseUrl) --admin-path $(ConvertTo-BashSingleQuoted -Value $AdminPath)"
    Invoke-Checked -FilePath 'ssh' -Arguments @($remote, $smokeCommand)
} elseif (-not $SkipSmoke) {
    Write-Warning 'BaseUrl was not provided; smoke test skipped. Re-run with -BaseUrl to check public/admin HTTP endpoints.'
}

Write-Host 'Tongzhuo GEOFlow server deployment completed.'
