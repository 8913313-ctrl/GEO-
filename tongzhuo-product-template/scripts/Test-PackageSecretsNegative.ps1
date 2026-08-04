[CmdletBinding()]
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$rootPath = (Resolve-Path $Root).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-package-secrets-negative-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)] [bool]$Condition,
        [Parameter(Mandatory = $true)] [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function New-ZipFixture {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [scriptblock]$Build
    )

    $fixtureRoot = Join-Path $testRoot $Name
    $contentRoot = Join-Path $fixtureRoot 'content'
    $zipPath = Join-Path $fixtureRoot "$Name.zip"
    New-Item -ItemType Directory -Force -Path $contentRoot | Out-Null
    & $Build $contentRoot
    Compress-Archive -Path (Join-Path $contentRoot '*') -DestinationPath $zipPath -Force
    return $zipPath
}

function Invoke-ScanExpectPass {
    param(
        [Parameter(Mandatory = $true)] [string]$PackagePath,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    & (Join-Path $rootPath 'scripts\Test-PackageSecrets.ps1') -PackagePath $PackagePath | Out-Null
}

function Invoke-ScanExpectFailure {
    param(
        [Parameter(Mandatory = $true)] [string]$PackagePath,
        [Parameter(Mandatory = $true)] [string]$Name
    )

    $failed = $false
    $message = ''
    try {
        & (Join-Path $rootPath 'scripts\Test-PackageSecrets.ps1') -PackagePath $PackagePath | Out-Null
    } catch {
        $failed = $true
        $message = [string] $_.Exception.Message
    }

    Assert-Condition $failed "Expected package secret scan to fail for fixture: $Name"
    Assert-Condition ($message -like '*Package secret scan failed*') "Unexpected failure message for $Name`: $message"
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    $cleanZip = New-ZipFixture -Name 'clean-package' -Build {
        param([string]$ContentRoot)
        Set-Content -LiteralPath (Join-Path $ContentRoot 'README.md') -Value 'This package contains no credentials.' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $ContentRoot 'config.json') -Value '{"mode":"demo","enabled":true}' -Encoding UTF8
    }
    Invoke-ScanExpectPass -PackagePath $cleanZip -Name 'clean-package'

    $blockedFileZip = New-ZipFixture -Name 'blocked-env-file' -Build {
        param([string]$ContentRoot)
        Set-Content -LiteralPath (Join-Path $ContentRoot '.env') -Value 'PLACEHOLDER=1' -Encoding UTF8
    }
    Invoke-ScanExpectFailure -PackagePath $blockedFileZip -Name 'blocked-env-file'

    $privateKeyZip = New-ZipFixture -Name 'private-key' -Build {
        param([string]$ContentRoot)
        $privateKey = ('-----BEGIN ' + 'OPENSSH ' + 'PRIVATE KEY-----')
        Set-Content -LiteralPath (Join-Path $ContentRoot 'key.txt') -Value $privateKey -Encoding UTF8
    }
    Invoke-ScanExpectFailure -PackagePath $privateKeyZip -Name 'private-key'

    $jsonSecretZip = New-ZipFixture -Name 'json-secret' -Build {
        param([string]$ContentRoot)
        $tokenValue = ('local_' + 'publisher_' + 'token_12345')
        $json = '{"api' + 'Token":"' + $tokenValue + '"}'
        Set-Content -LiteralPath (Join-Path $ContentRoot 'config.json') -Value $json -Encoding UTF8
    }
    Invoke-ScanExpectFailure -PackagePath $jsonSecretZip -Name 'json-secret'

    $knownLiteralZip = New-ZipFixture -Name 'known-literal' -Build {
        param([string]$ContentRoot)
        $knownIp = ('124.221.' + '70.55')
        Set-Content -LiteralPath (Join-Path $ContentRoot 'server.txt') -Value "Server: $knownIp" -Encoding UTF8
    }
    Invoke-ScanExpectFailure -PackagePath $knownLiteralZip -Name 'known-literal'

    $nestedSecretZip = New-ZipFixture -Name 'nested-secret' -Build {
        param([string]$ContentRoot)
        $innerRoot = Join-Path $ContentRoot 'inner'
        $innerZip = Join-Path $ContentRoot 'inner.zip'
        New-Item -ItemType Directory -Force -Path $innerRoot | Out-Null
        $tokenValue = ('nested_' + 'access_' + 'token_12345')
        Set-Content -LiteralPath (Join-Path $innerRoot 'token.txt') -Value ("ACCESS_TOKEN=" + $tokenValue) -Encoding UTF8
        Compress-Archive -Path (Join-Path $innerRoot '*') -DestinationPath $innerZip -Force
        Remove-Item -LiteralPath $innerRoot -Recurse -Force
    }
    Invoke-ScanExpectFailure -PackagePath $nestedSecretZip -Name 'nested-secret'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host 'Package secret negative validation passed.'
