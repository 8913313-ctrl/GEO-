param(
    [Parameter(Mandatory = $true)] [string]$Root
)

$productPath = Join-Path $Root 'product.json'
if (-not (Test-Path $productPath)) {
    throw "product.json not found: $productPath"
}

Get-Content -LiteralPath $productPath -Raw -Encoding UTF8 | ConvertFrom-Json
