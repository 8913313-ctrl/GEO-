param(
    [string]$PackageRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$overrides = Join-Path $PackageRoot 'server-overrides'

$requiredFiles = @(
    'routes/tongzhuo-content-api.php',
    'app/Http/Controllers/Api/V1/ContentWorkflowController.php',
    'app/Http/Controllers/Api/V1/ContentAiDiscoveryController.php',
    'app/Services/GeoFlow/ContentDiscoveryService.php',
    'database/migrations/2026_07_25_000000_create_tongzhuo_content_workflow_tables.php',
    'database/migrations/2026_07_25_020000_add_content_discovery_hashes.php',
    'app/Models/TongzhuoContentBusinessLine.php',
    'app/Models/TongzhuoContentKeywordPack.php',
    'app/Models/TongzhuoContentManagedKeyword.php',
    'app/Models/TongzhuoContentQuestionLibraryItem.php',
    'app/Models/TongzhuoContentTopicCandidate.php',
    'app/Models/TongzhuoContentPlan.php',
    'app/Models/TongzhuoContentPlanItem.php',
    'app/Models/TongzhuoContentWritingAgent.php',
    'app/Models/TongzhuoContentGenerationRun.php',
    'app/Models/TongzhuoContentArticleCitation.php',
    'app/Models/TongzhuoContentArticleVersion.php'
)

foreach ($relative in $requiredFiles) {
    $file = Join-Path $overrides $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Missing content workflow file: $relative"
    }
}

$migration = Get-Content -LiteralPath (Join-Path $overrides 'database/migrations/2026_07_25_000000_create_tongzhuo_content_workflow_tables.php') -Raw -Encoding UTF8
$tables = @(
    'tongzhuo_content_business_lines',
    'tongzhuo_content_keyword_packs',
    'tongzhuo_content_managed_keywords',
    'tongzhuo_content_question_library',
    'tongzhuo_content_topic_candidates',
    'tongzhuo_content_plans',
    'tongzhuo_content_plan_items',
    'tongzhuo_content_writing_agents',
    'tongzhuo_content_generation_runs',
    'tongzhuo_content_article_citations',
    'tongzhuo_content_article_versions'
)
foreach ($table in $tables) {
    if (-not $migration.Contains("Schema::create('$table'")) {
        throw "Migration does not create table: $table"
    }
}
if ($migration.IndexOf("Schema::create('tongzhuo_content_writing_agents'") -gt $migration.IndexOf("Schema::create('tongzhuo_content_plan_items'")) {
    throw 'Writing agents must be created before plan items because of the foreign key.'
}

$routes = Get-Content -LiteralPath (Join-Path $overrides 'routes/tongzhuo-content-api.php') -Raw -Encoding UTF8
foreach ($routeFragment in @('business-lines', 'questions/{question}/promote-to-topic', 'topics/{topic}/promote-to-plan', 'generation-runs', 'articles/{article}/citations', 'articles/{article}/versions', 'ai/question-candidates', 'ai/topic-candidates')) {
    if (-not $routes.Contains($routeFragment)) {
        throw "Route contract missing: $routeFragment"
    }
}
foreach ($middleware in @('access.auth', 'access.scope:content.read', 'access.scope:content.write')) {
    if (-not $routes.Contains($middleware)) {
        throw "Access middleware contract missing: $middleware"
    }
}

$bootstrap = Get-Content -LiteralPath (Join-Path $overrides 'bootstrap/app.php') -Raw -Encoding UTF8
if (-not $bootstrap.Contains("require __DIR__.'/../routes/tongzhuo-content-api.php'")) {
    throw 'Bootstrap does not load the independent content API route file.'
}
$publisherRoutes = Get-Content -LiteralPath (Join-Path $overrides 'routes/publisher-assistant.php') -Raw -Encoding UTF8
if ($publisherRoutes.Contains('tongzhuo-content-api.php')) {
    throw 'Content API must not depend on publisher-assistant route loading.'
}

$php = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $php) {
    Get-ChildItem -LiteralPath $overrides -Recurse -Filter '*.php' |
        ForEach-Object {
            & $php.Source -l $_.FullName | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "PHP syntax check failed: $($_.FullName)"
            }
        }
}

Write-Output "Content workflow contract check passed. Tables=$($tables.Count); required_files=$($requiredFiles.Count); php_lint=$($null -ne $php)"
