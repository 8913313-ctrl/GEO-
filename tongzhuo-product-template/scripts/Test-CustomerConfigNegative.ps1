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
$validator = Join-Path $rootPath 'scripts\Test-CustomerConfig.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tongzhuo-config-negative-' + [guid]::NewGuid().ToString('N'))

function New-ValidConfig {
    return [ordered]@{
        customer_slug = 'valid-client'
        company = [ordered]@{
            legal_name = 'Valid Client Network Technology Co Ltd'
            brand_name = 'Valid Client'
            alternate_name = 'Valid Client AI'
            description = 'Valid customer config for negative test baseline.'
            services = @('GEO optimization', 'Short video operations', 'Enterprise AI implementation')
        }
        website = [ordered]@{
            site_url = 'https://valid.example.com'
            workbench_url = 'https://work.valid.example.com'
            telephone = ''
            email = ''
            address = ''
            robots_enabled = $true
            ai_files_enabled = $true
        }
        geoflow = [ordered]@{
            base_url = 'http://127.0.0.1:18080'
            admin_path = 'geo_admin'
            api_token = ''
        }
        publisher_assistant = [ordered]@{
            port = 18180
            poll_seconds = 20
            publish_mode = 'publish'
            browser_channel = 'chromium'
        }
        desktop_agent = [ordered]@{
            port = 18280
            poll_seconds = 20
            capabilities = @('zhihu', 'wechat_mp', 'toutiao', 'zip-download')
        }
    }
}

function Invoke-InvalidCase {
    param(
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [scriptblock]$Mutate,
        [Parameter(Mandatory = $true)] [string]$ExpectedMessage
    )

    $config = New-ValidConfig
    & $Mutate $config
    $path = Join-Path $testRoot "$Name.json"
    $config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8

    $failedAsExpected = $false
    $actualMessage = ''
    try {
        & $validator -ConfigPath $path | Out-Null
    } catch {
        $failedAsExpected = $true
        $actualMessage = [string] $_.Exception.Message
    }

    if (-not $failedAsExpected) {
        throw "Negative config case did not fail: $Name"
    }
    if ($actualMessage -notlike "*$ExpectedMessage*") {
        throw "Negative config case '$Name' failed with unexpected message. Expected '$ExpectedMessage', got '$actualMessage'"
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    Invoke-InvalidCase -Name 'invalid-slug' -ExpectedMessage 'customer_slug must match' -Mutate {
        param($config)
        $config.customer_slug = 'Invalid Client'
    }

    Invoke-InvalidCase -Name 'http-website' -ExpectedMessage 'website.site_url should use https' -Mutate {
        param($config)
        $config.website.site_url = 'http://valid.example.com'
    }

    Invoke-InvalidCase -Name 'filled-token' -ExpectedMessage 'geoflow.api_token must be empty' -Mutate {
        param($config)
        $config.geoflow.api_token = 'secret-token'
    }

    Invoke-InvalidCase -Name 'bad-port' -ExpectedMessage 'publisher_assistant.port must be between' -Mutate {
        param($config)
        $config.publisher_assistant.port = 80
    }

    Invoke-InvalidCase -Name 'bad-desktop-port' -ExpectedMessage 'desktop_agent.port must be between' -Mutate {
        param($config)
        $config.desktop_agent.port = 80
    }

    Invoke-InvalidCase -Name 'duplicate-desktop-port' -ExpectedMessage 'desktop_agent.port must be different' -Mutate {
        param($config)
        $config.desktop_agent.port = 18180
    }

    Invoke-InvalidCase -Name 'empty-services' -ExpectedMessage 'company.services must contain at least one service name' -Mutate {
        param($config)
        $config.company.services = @()
    }

    Invoke-InvalidCase -Name 'bad-publish-mode' -ExpectedMessage 'publisher_assistant.publish_mode must be publish or draft' -Mutate {
        param($config)
        $config.publisher_assistant.publish_mode = 'auto'
    }

    Write-Host 'Customer config negative validation passed.'
} finally {
    if (Test-Path $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
