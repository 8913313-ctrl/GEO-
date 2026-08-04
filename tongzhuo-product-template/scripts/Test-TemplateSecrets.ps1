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

function Convert-ToRelativePath {
    param([Parameter(Mandatory = $true)] [string]$Path)
    return $Path.Substring($rootPath.Length).TrimStart('\') -replace '\\', '/'
}

function Add-Finding {
    param(
        [System.Collections.Generic.List[object]]$Findings,
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Rule,
        [Parameter(Mandatory = $true)] [string]$Detail
    )
    $Findings.Add([pscustomobject]@{
        path = Convert-ToRelativePath -Path $Path
        rule = $Rule
        detail = $Detail
    }) | Out-Null
}

$blockedDirectories = @(
    '.git',
    '.agents',
    '.codex',
    'node_modules',
    '.data',
    'dist',
    'vendor',
    'logs',
    'tmp',
    'temp'
)
$binaryExtensions = @(
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
    '.zip', '.7z', '.rar', '.gz', '.tar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.exe', '.dll', '.bin'
)
$allowedConfigPath = 'config/client-config.example.json'

$literalRules = @(
    @{ name = 'known_cloud_ip'; value = ('124.221.' + '70.55') },
    @{ name = 'known_ssh_password'; value = ('Long' + 'null123') },
    @{ name = 'ssh_root_login'; value = ('ssh root' + '@') }
)

$regexRules = @(
    @{ name = 'private_key'; pattern = '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----' },
    @{ name = 'openai_api_key'; pattern = 'sk-[A-Za-z0-9_-]{20,}' },
    @{ name = 'github_token'; pattern = 'gh[pousr]_[A-Za-z0-9_]{20,}' },
    @{ name = 'google_api_key'; pattern = 'AIza[0-9A-Za-z_-]{25,}' },
    @{ name = 'aws_access_key'; pattern = 'AKIA[0-9A-Z]{16}' },
    @{ name = 'slack_token'; pattern = 'xox[baprs]-[0-9A-Za-z-]{20,}' },
    @{ name = 'biji_live_token'; pattern = '[g]k_live_[0-9A-Za-z._-]{12,}' },
    @{ name = 'bearer_literal'; pattern = 'Authorization:\s*Bearer\s+[A-Za-z0-9._-]{16,}' },
    @{ name = 'http_basic_credentials'; pattern = 'https?://[^/\s:@]+:[^/\s:@]+@' }
)

$findings = [System.Collections.Generic.List[object]]::new()

$blockedRuntimePaths = @(Get-ChildItem -LiteralPath $rootPath -Force -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
    $blockedDirectories -contains $_.Name
})
foreach ($directory in $blockedRuntimePaths) {
    Add-Finding -Findings $findings -Path $directory.FullName -Rule 'blocked_runtime_directory' -Detail $directory.Name
}

$configFiles = @(Get-ChildItem -LiteralPath (Join-Path $rootPath 'config') -Force -File -Filter '*.json' -ErrorAction SilentlyContinue)
foreach ($file in $configFiles) {
    $relative = Convert-ToRelativePath -Path $file.FullName
    if ($relative -ne $allowedConfigPath) {
        Add-Finding -Findings $findings -Path $file.FullName -Rule 'unexpected_customer_config' -Detail 'Only config/client-config.example.json is allowed in the product template.'
    }
}

$files = @(Get-ChildItem -LiteralPath $rootPath -Force -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $fullName = $_.FullName
    $underBlockedDirectory = $false
    foreach ($directoryName in $blockedDirectories) {
        if ($fullName -like "*\$directoryName\*") {
            $underBlockedDirectory = $true
            break
        }
    }
    -not $underBlockedDirectory -and ($binaryExtensions -notcontains $_.Extension.ToLowerInvariant())
})

foreach ($file in $files) {
    $text = ''
    try {
        $text = [string](Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8)
    } catch {
        continue
    }

    foreach ($rule in $literalRules) {
        if ($text.Contains([string] $rule.value)) {
            Add-Finding -Findings $findings -Path $file.FullName -Rule ([string] $rule.name) -Detail 'Blocked literal found.'
        }
    }

    foreach ($rule in $regexRules) {
        if ($text -match [string] $rule.pattern) {
            Add-Finding -Findings $findings -Path $file.FullName -Rule ([string] $rule.name) -Detail 'Blocked secret pattern found.'
        }
    }
}

if ($findings.Count -gt 0) {
    $findings | Format-Table -AutoSize
    throw "Template secret scan failed: $($findings.Count) finding(s)"
}

Write-Host "Template secret scan passed: $($files.Count) file(s)"
