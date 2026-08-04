param(
    [string]$PackageRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$overrides = Join-Path $PackageRoot 'server-overrides'

$requiredFiles = @(
    'routes/tongzhuo-ai-api.php',
    'app/Http/Controllers/Api/V1/AiProviderController.php',
    'app/Models/AiProvider.php',
    'app/Models/AiGenerationRun.php',
    'app/Services/TongzhuoAi/AiGatewayException.php',
    'app/Services/TongzhuoAi/AiModelGateway.php',
    'database/migrations/2026_07_25_000000_create_ai_providers_table.php'
)

foreach ($relative in $requiredFiles) {
    $file = Join-Path $overrides $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Missing AI provider file: $relative"
    }
}

$model = Get-Content -LiteralPath (Join-Path $overrides 'app/Models/AiProvider.php') -Raw -Encoding UTF8
foreach ($contract in @("'api_key' => 'encrypted'", "protected `$hidden", 'safePayload()', 'api_key_configured')) {
    if (-not $model.Contains($contract)) {
        throw "API key safety contract missing: $contract"
    }
}

$gateway = Get-Content -LiteralPath (Join-Path $overrides 'app/Services/TongzhuoAi/AiModelGateway.php') -Raw -Encoding UTF8
foreach ($contract in @('function chat(', 'function embeddings(', 'function test(', 'function generateArticle(', '/chat/completions', '/embeddings', 'max_retries', 'output_contract_snapshot')) {
    if (-not $gateway.Contains($contract)) {
        throw "AI gateway contract missing: $contract"
    }
}

$controller = Get-Content -LiteralPath (Join-Path $overrides 'app/Http/Controllers/Api/V1/AiProviderController.php') -Raw -Encoding UTF8
if ($controller.Contains("'raw' =>")) {
    throw 'AI API controller must not construct a raw upstream response field.'
}
if (-not $controller.Contains('withoutRaw(')) {
    throw 'AI API controller does not strip raw upstream responses.'
}

$routes = Get-Content -LiteralPath (Join-Path $overrides 'routes/tongzhuo-ai-api.php') -Raw -Encoding UTF8
foreach ($contract in @('access.auth', 'access.scope:content.generate', 'access.scope:knowledge.manage', 'admin.auth', 'admin.permission:models.manage')) {
    if (-not $routes.Contains($contract)) {
        throw "AI route access contract missing: $contract"
    }
}
if ($routes.Contains("'api.auth'")) {
    throw 'AI routes must not use the legacy api.auth middleware.'
}

$migration = Get-Content -LiteralPath (Join-Path $overrides 'database/migrations/2026_07_25_000000_create_ai_providers_table.php') -Raw -Encoding UTF8
foreach ($table in @('ai_providers', 'ai_generation_runs')) {
    if (-not $migration.Contains("Schema::create('$table'")) {
        throw "AI migration does not create table: $table"
    }
}

$bootstrap = Get-Content -LiteralPath (Join-Path $overrides 'bootstrap/app.php') -Raw -Encoding UTF8
if (-not $bootstrap.Contains("routes/tongzhuo-ai-api.php")) {
    throw 'Bootstrap does not load the independent AI API route file.'
}

$php = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $php) {
    foreach ($relative in $requiredFiles | Where-Object { $_.EndsWith('.php') }) {
        & $php.Source -l (Join-Path $overrides $relative) | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "PHP syntax check failed: $relative"
        }
    }
}

Write-Output "AI provider contract check passed. required_files=$($requiredFiles.Count); php_lint=$($null -ne $php)"
