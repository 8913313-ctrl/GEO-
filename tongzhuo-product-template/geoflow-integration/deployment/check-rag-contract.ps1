[CmdletBinding()]
param(
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$overrides = Join-Path (Resolve-Path $Root).Path 'server-overrides'

$required = @(
    'database\migrations\2026_07_25_010000_create_tongzhuo_rag_tables.php',
    'app\Models\TongzhuoKnowledgeDocument.php',
    'app\Models\TongzhuoKnowledgeChunk.php',
    'app\Models\TongzhuoRagRun.php',
    'app\Models\TongzhuoRagCitation.php',
    'app\Services\Rag\KnowledgeChunker.php',
    'app\Services\Rag\KnowledgeIndexService.php',
    'app\Services\Rag\HybridKnowledgeRetriever.php',
    'app\Services\Rag\RagArticleGenerationService.php',
    'app\Http\Controllers\Api\Internal\KnowledgeDocumentController.php',
    'app\Http\Controllers\Api\Internal\RagController.php',
    'routes\tongzhuo-rag-api.php'
)
foreach ($relative in $required) {
    $path = Join-Path $overrides $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "RAG file missing: $relative"
    }
}

$migration = Get-Content -LiteralPath (Join-Path $overrides $required[0]) -Raw -Encoding UTF8
foreach ($token in @('tongzhuo_knowledge_documents', 'tongzhuo_knowledge_chunks', 'embedding_json', 'embedding_vector vector', 'tongzhuo_rag_runs', 'tongzhuo_rag_citations', 'content_hash', 'document_version')) {
    if ($migration -notlike "*$token*") { throw "RAG migration contract missing: $token" }
}

$indexer = Get-Content -LiteralPath (Join-Path $overrides 'app\Services\Rag\KnowledgeIndexService.php') -Raw -Encoding UTF8
foreach ($token in @('AiModelGateway', '->embeddings(', 'pgvectorAvailable', 'embedding_json', 'status'' => ''failed')) {
    if ($indexer -notlike "*$token*") { throw "Knowledge indexing contract missing: $token" }
}

$retriever = Get-Content -LiteralPath (Join-Path $overrides 'app\Services\Rag\HybridKnowledgeRetriever.php') -Raw -Encoding UTF8
foreach ($token in @('pgvector_hybrid', 'json_vector_hybrid', 'keyword_fallback', 'vector_weight', 'TongzhuoRagCitation', "'K'.(`$index + 1)")) {
    if ($retriever -notlike "*$token*") { throw "Hybrid retrieval contract missing: $token" }
}

$generator = Get-Content -LiteralPath (Join-Path $overrides 'app\Services\Rag\RagArticleGenerationService.php') -Raw -Encoding UTF8
foreach ($token in @('generateArticle(', 'citation_check', 'TongzhuoContentArticleVersion', "'status' => 'draft'", "'status' => 'failed'", 'preparePlanItem')) {
    if ($generator -notlike "*$token*") { throw "RAG article generation contract missing: $token" }
}

$routes = Get-Content -LiteralPath (Join-Path $overrides 'routes\tongzhuo-rag-api.php') -Raw -Encoding UTF8
foreach ($token in @('api/internal/v1', 'admin.auth', 'admin.permission:knowledge.read', 'admin.permission:content.generate', 'rag/generate-article')) {
    if ($routes -notlike "*$token*") { throw "RAG route contract missing: $token" }
}

$web = Get-Content -LiteralPath (Join-Path $overrides 'routes\web.php') -Raw -Encoding UTF8
if ($web -notlike '*tongzhuo-rag-api.php*') { throw 'RAG routes are not loaded by the authenticated web route stack.' }
$bootstrap = Get-Content -LiteralPath (Join-Path $overrides 'bootstrap\app.php') -Raw -Encoding UTF8
if (([regex]::Matches($bootstrap, '\bthen\s*:')).Count -ne 1) { throw 'bootstrap/app.php must contain exactly one withRouting then callback.' }

$php = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $php) {
    foreach ($relative in $required | Where-Object { $_ -like '*.php' }) {
        & $php.Source -l (Join-Path $overrides $relative) | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "PHP syntax check failed: $relative" }
    }
} else {
    Write-Warning 'php command not found; syntax checks will run on the Linux Laravel host.'
}

Write-Host 'RAG contract validation passed.'
