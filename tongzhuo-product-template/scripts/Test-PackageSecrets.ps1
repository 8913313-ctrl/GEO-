[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$PackagePath,
    [int]$MaxTextBytes = 2097152
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedPackage = (Resolve-Path $PackagePath).Path
$scanRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-package-secret-scan-' + [guid]::NewGuid().ToString('N'))

function Add-Finding {
    param(
        [System.Collections.Generic.List[object]]$Findings,
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Rule,
        [Parameter(Mandatory = $true)] [string]$Detail
    )

    $Findings.Add([pscustomobject]@{
        path = $Path
        rule = $Rule
        detail = $Detail
    }) | Out-Null
}

function Test-TextFile {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$RelativePath,
        [System.Collections.Generic.List[object]]$Findings
    )

    $item = Get-Item -LiteralPath $Path
    if ($item.Length -gt $MaxTextBytes) {
        return
    }

    $binaryExtensions = @(
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.exe', '.dll', '.bin', '.woff', '.woff2', '.ttf'
    )
    if ($binaryExtensions -contains $item.Extension.ToLowerInvariant()) {
        return
    }

    $text = ''
    try {
        $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    } catch {
        return
    }

    $literalRules = @(
        @{ name = 'known_cloud_ip'; value = ('124.221.' + '70.55') },
        @{ name = 'known_ssh_password'; value = ('Long' + 'null123') },
        @{ name = 'ssh_root_login'; value = ('ssh root' + '@') }
    )
    foreach ($rule in $literalRules) {
        if ($text.Contains([string] $rule.value)) {
            Add-Finding -Findings $Findings -Path $RelativePath -Rule ([string] $rule.name) -Detail 'Blocked literal found.'
        }
    }

    $regexRules = @(
        @{ name = 'private_key'; pattern = '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----' },
        @{ name = 'openai_api_key'; pattern = 'sk-[A-Za-z0-9_-]{20,}' },
        @{ name = 'github_token'; pattern = 'gh[pousr]_[A-Za-z0-9_]{20,}' },
        @{ name = 'google_api_key'; pattern = 'AIza[0-9A-Za-z_-]{25,}' },
        @{ name = 'aws_access_key'; pattern = 'AKIA[0-9A-Z]{16}' },
        @{ name = 'slack_token'; pattern = 'xox[baprs]-[0-9A-Za-z-]{20,}' },
        @{ name = 'biji_live_token'; pattern = '[g]k_live_[0-9A-Za-z._-]{12,}' },
        @{ name = 'bearer_literal'; pattern = 'Authorization:\s*Bearer\s+[A-Za-z0-9._-]{16,}' },
        @{ name = 'http_basic_credentials'; pattern = 'https?://[^/\s:@]+:[^/\s:@]+@' },
        @{ name = 'env_secret_assignment'; pattern = '(?im)^\s*(API_TOKEN|GEOFLOW_API_TOKEN|PASSWORD|COOKIE|AUTHORIZATION|SECRET|ACCESS_TOKEN)\s*=\s*["'']?[^"'']{8,}' },
        @{ name = 'json_secret_value'; pattern = '(?i)"(apiToken|api_token|access_token|password|cookie|authorization|secret)"\s*:\s*"[^"]{8,}"' }
    )
    foreach ($rule in $regexRules) {
        if ($text -match [string] $rule.pattern) {
            Add-Finding -Findings $Findings -Path $RelativePath -Rule ([string] $rule.name) -Detail 'Blocked secret pattern found.'
        }
    }
}

try {
    New-Item -ItemType Directory -Force -Path $scanRoot | Out-Null

    $findings = [System.Collections.Generic.List[object]]::new()
    $nestedQueue = [System.Collections.Queue]::new()
    $nestedScanRoot = Join-Path $scanRoot '_nested-zips'
    $outerScanRoot = Join-Path $scanRoot '_outer-entries'
    New-Item -ItemType Directory -Force -Path $nestedScanRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $outerScanRoot | Out-Null

    $blockedNames = @('.env', 'cookies.json', 'localstorage.json')
    $binaryExtensions = @(
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.exe', '.dll', '.bin', '.woff', '.woff2', '.ttf'
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($resolvedPackage)
    try {
        $outerIndex = 0
        foreach ($entry in $archive.Entries) {
            if ([string]::IsNullOrWhiteSpace($entry.Name)) {
                continue
            }
            $outerIndex += 1
            $relativePath = ($entry.FullName -replace '\\', '/').TrimStart('/')
            $extension = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()

            if ($blockedNames -contains $entry.Name.ToLowerInvariant()) {
                Add-Finding -Findings $findings -Path $relativePath -Rule 'blocked_secret_filename' -Detail $entry.Name
            }

            if ($extension -eq '.zip') {
                $nestedPath = Join-Path $outerScanRoot ("nested-{0:D6}.zip" -f $outerIndex)
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $nestedPath, $true)
                $nestedQueue.Enqueue($nestedPath)
                continue
            }
            if ($entry.Length -gt $MaxTextBytes -or $binaryExtensions -contains $extension) {
                continue
            }

            $textPath = Join-Path $outerScanRoot ("text-{0:D6}{1}" -f $outerIndex, $extension)
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $textPath, $true)
            Test-TextFile -Path $textPath -RelativePath $relativePath -Findings $findings
        }
    } finally {
        $archive.Dispose()
    }

    $nestedIndex = 0
    while ($nestedQueue.Count -gt 0) {
        $nestedZip = [string] $nestedQueue.Dequeue()
        $nestedIndex += 1
        $nestedOutput = Join-Path $nestedScanRoot $nestedIndex
        New-Item -ItemType Directory -Force -Path $nestedOutput | Out-Null
        Expand-Archive -LiteralPath $nestedZip -DestinationPath $nestedOutput -Force
        $nestedFiles = @(Get-ChildItem -LiteralPath $nestedOutput -Recurse -Force -File -ErrorAction SilentlyContinue)
        foreach ($file in $nestedFiles) {
            $nestedRelative = $file.FullName.Substring($nestedOutput.Length).TrimStart('\', '/') -replace '\\', '/'
            $displayPath = ((Split-Path $nestedZip -Leaf) + '!' + $nestedRelative)

            if ($blockedNames -contains $file.Name.ToLowerInvariant()) {
                Add-Finding -Findings $findings -Path $displayPath -Rule 'blocked_secret_filename' -Detail $file.Name
            }

            if ($file.Extension.ToLowerInvariant() -eq '.zip') {
                $nestedQueue.Enqueue($file.FullName)
                continue
            }

            Test-TextFile -Path $file.FullName -RelativePath $displayPath -Findings $findings
        }
    }

    if ($findings.Count -gt 0) {
        $findings | Sort-Object path, rule | Format-Table -AutoSize
        throw "Package secret scan failed: $($findings.Count) finding(s)"
    }
} finally {
    if (Test-Path $scanRoot) {
        Remove-Item -LiteralPath $scanRoot -Recurse -Force
    }
}

Write-Host "Package secret scan passed: $resolvedPackage"
