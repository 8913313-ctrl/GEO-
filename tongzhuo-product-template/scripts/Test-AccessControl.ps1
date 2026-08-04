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
$overridesRoot = Join-Path $rootPath 'geoflow-integration\server-overrides'

$required = @(
    'database\migrations\2026_07_25_000000_create_tongzhuo_access_control_tables.php',
    'app\Models\TongzhuoAccessRole.php',
    'app\Models\TongzhuoAccessPermission.php',
    'app\Models\TongzhuoAccessApiKey.php',
    'app\Models\TongzhuoAccessAuditLog.php',
    'app\Services\Access\AccessControlService.php',
    'app\Http\Middleware\EnsureAdminPermission.php',
    'app\Http\Middleware\EnforceAdminRbac.php',
    'app\Http\Middleware\EnsureSuperAdmin.php',
    'app\Http\Middleware\AuthenticateAccessApi.php',
    'app\Http\Middleware\AuditAccessApiRequest.php',
    'app\Http\Middleware\EnsureAccessScope.php',
    'app\Http\Controllers\Admin\TongzhuoAccessController.php',
    'routes\tongzhuo-access-api.php',
    'routes\tongzhuo-access-admin.php'
)

foreach ($relative in $required) {
    $path = Join-Path $overridesRoot $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Access-control file missing: $path"
    }
}

$serviceText = Get-Content -LiteralPath (Join-Path $overridesRoot 'app\Services\Access\AccessControlService.php') -Raw -Encoding UTF8
foreach ($requiredText in @('auth(''admin'')', 'hash_hmac', 'hash_equals', 'audit(', 'super_admin')) {
    if ($serviceText -notlike "*$requiredText*") {
        throw "Access-control service is missing required security contract: $requiredText"
    }
}

$migrationText = Get-Content -LiteralPath (Join-Path $overridesRoot 'database\migrations\2026_07_25_000000_create_tongzhuo_access_control_tables.php') -Raw -Encoding UTF8
foreach ($requiredText in @('tongzhuo_access_roles', 'tongzhuo_access_permissions', 'tongzhuo_access_user_roles', 'tongzhuo_access_audit_logs', 'tongzhuo_access_api_keys', 'knowledge.manage', 'content.generate', 'secret_hash')) {
    if ($migrationText -notlike "*$requiredText*") {
        throw "Access-control migration is missing required table/field: $requiredText"
    }
}

$middlewareText = Get-Content -LiteralPath (Join-Path $overridesRoot 'app\Http\Middleware\EnsureAdminPermission.php') -Raw -Encoding UTF8
if ($middlewareText -notlike '*allowsAny*') {
    throw 'Admin permission middleware is not wired to AccessControlService.'
}

$apiRouteText = Get-Content -LiteralPath (Join-Path $overridesRoot 'routes\tongzhuo-access-api.php') -Raw -Encoding UTF8
$adminRouteText = Get-Content -LiteralPath (Join-Path $overridesRoot 'routes\tongzhuo-access-admin.php') -Raw -Encoding UTF8
$routeText = $apiRouteText + $adminRouteText
foreach ($requiredText in @('api/v1/access', 'access.auth', 'access.audit', 'admin.permission:roles.manage', 'api-keys')) {
    if ($routeText -notlike "*$requiredText*") {
        throw "Access-control route is missing required endpoint/middleware: $requiredText"
    }
}
if ($apiRouteText -match "Route::(post|patch|delete)\('(?:users|roles|api-keys)") {
    throw 'Bearer access API must not mutate employee accounts, roles, or integration keys.'
}

$php = Get-Command php -ErrorAction SilentlyContinue
if ($null -ne $php) {
    foreach ($relative in $required | Where-Object { $_ -like '*.php' }) {
        $path = Join-Path $overridesRoot $relative
        & $php.Source -l $path | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "PHP syntax check failed: $path"
        }
    }
} else {
    Write-Warning 'php command not found; syntax checks will run on the Linux Laravel host.'
}

Write-Host 'Access-control validation passed.'
