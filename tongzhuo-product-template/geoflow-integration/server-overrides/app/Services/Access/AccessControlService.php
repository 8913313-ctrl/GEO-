<?php

namespace App\Services\Access;

use App\Models\TongzhuoAccessApiKey;
use App\Models\TongzhuoAccessAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Throwable;

/**
 * RBAC for a single private GEOFlow installation.
 *
 * The service intentionally receives the vendor admin guard user as an
 * object and keeps role membership in prefixed tables. This means it works
 * with both the current and older GEOFlow AdminUser model without modifying
 * the vendor package.
 */
class AccessControlService
{
    /** @var array<string, string> */
    private const PERMISSION_ALIASES = [
        'content.manage' => 'content.write',
        'publishing.manage' => 'publishing.write',
        'geo.manage' => 'geo.write',
    ];

    public function currentAdmin(): mixed
    {
        try {
            return auth('admin')->user();
        } catch (Throwable) {
            return null;
        }
    }

    public function adminId(mixed $admin): ?int
    {
        $id = is_object($admin) ? ($admin->id ?? null) : (is_array($admin) ? ($admin['id'] ?? null) : null);

        return is_numeric($id) ? (int) $id : null;
    }

    public function isSuperAdmin(mixed $admin = null): bool
    {
        $admin ??= $this->currentAdmin();
        if (! $admin) {
            return false;
        }

        foreach (['is_super_admin', 'isSuperAdmin', 'super_admin'] as $attribute) {
            try {
                $value = is_object($admin) && method_exists($admin, $attribute)
                    ? $admin->{$attribute}()
                    : data_get($admin, $attribute);
                if (filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
                    return true;
                }
            } catch (Throwable) {
                // A vendor model may expose only one of these conventions.
            }
        }

        $id = $this->adminId($admin);
        if (! $id || ! $this->accessTablesReady()) {
            return false;
        }

        try {
            return DB::table('tongzhuo_access_user_roles as ur')
                ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
                ->where('ur.admin_user_id', $id)
                ->where('r.slug', 'super_admin')
                ->where('r.is_active', true)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }

    public function allows(string $permission, mixed $admin = null): bool
    {
        $admin ??= $this->currentAdmin();
        if (! $admin) {
            return false;
        }
        if ($this->isSuperAdmin($admin)) {
            return true;
        }

        $permission = self::PERMISSION_ALIASES[$permission] ?? $permission;
        $id = $this->adminId($admin);
        if (! $id || ! $this->accessTablesReady()) {
            return false;
        }

        try {
            return DB::table('tongzhuo_access_user_roles as ur')
                ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
                ->join('tongzhuo_access_role_permissions as rp', 'rp.role_id', '=', 'r.id')
                ->join('tongzhuo_access_permissions as p', 'p.id', '=', 'rp.permission_id')
                ->where('ur.admin_user_id', $id)
                ->where('r.is_active', true)
                ->where('p.slug', $permission)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }

    /** @param list<string> $permissions */
    public function allowsAny(array $permissions, mixed $admin = null): bool
    {
        foreach ($permissions as $permission) {
            if ($this->allows($permission, $admin)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<string> $permissions */
    public function authorize(array $permissions, mixed $admin = null): void
    {
        if (! $this->allowsAny($permissions, $admin)) {
            throw new AccessDeniedHttpException('当前账号没有执行此操作的权限。');
        }
    }

    /** @return list<string> */
    public function permissionsFor(mixed $admin = null): array
    {
        $admin ??= $this->currentAdmin();
        if (! $admin || ! $this->accessTablesReady()) {
            return [];
        }
        if ($this->isSuperAdmin($admin)) {
            return DB::table('tongzhuo_access_permissions')->orderBy('slug')->pluck('slug')->all();
        }

        $id = $this->adminId($admin);
        if (! $id) {
            return [];
        }

        return DB::table('tongzhuo_access_user_roles as ur')
            ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
            ->join('tongzhuo_access_role_permissions as rp', 'rp.role_id', '=', 'r.id')
            ->join('tongzhuo_access_permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('ur.admin_user_id', $id)
            ->where('r.is_active', true)
            ->distinct()
            ->orderBy('p.slug')
            ->pluck('p.slug')
            ->all();
    }

    /** @return list<array<string, mixed>> */
    public function rolesFor(mixed $admin = null): array
    {
        $id = $this->adminId($admin ?? $this->currentAdmin());
        if (! $id || ! $this->accessTablesReady()) {
            return [];
        }

        return DB::table('tongzhuo_access_user_roles as ur')
            ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
            ->where('ur.admin_user_id', $id)
            ->where('r.is_active', true)
            ->orderBy('r.name')
            ->get(['r.id', 'r.name', 'r.slug', 'r.description'])
            ->map(fn ($role): array => (array) $role)
            ->all();
    }

    /**
     * Assign roles after validating both the user and the role IDs. At least
     * one role is required for active accounts; an empty list is allowed only
     * when disabling an account.
     *
     * @param list<int|string> $roleIds
     */
    public function syncRoles(int $adminId, array $roleIds, ?int $assignedBy = null): void
    {
        if (! $this->accessTablesReady()) {
            return;
        }

        $ids = collect($roleIds)->filter(fn ($id): bool => is_numeric($id))->map(fn ($id): int => (int) $id)->unique()->values();
        $valid = DB::table('tongzhuo_access_roles')->whereIn('id', $ids)->where('is_active', true)->pluck('id');
        DB::transaction(function () use ($adminId, $valid, $assignedBy): void {
            DB::table('tongzhuo_access_user_roles')->where('admin_user_id', $adminId)->delete();
            $now = now();
            foreach ($valid as $roleId) {
                DB::table('tongzhuo_access_user_roles')->insert([
                    'admin_user_id' => $adminId,
                    'role_id' => $roleId,
                    'assigned_by_admin_id' => $assignedBy,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    /** @return array{token:string,key:TongzhuoAccessApiKey} */
    public function issueApiKey(string $name, array $scopes, ?\DateTimeInterface $expiresAt = null, ?int $createdBy = null): array
    {
        $keyId = Str::lower(Str::random(20));
        $secret = Str::random(64);
        $hash = hash_hmac('sha256', $secret, (string) config('app.key'));
        $key = TongzhuoAccessApiKey::query()->create([
            'name' => trim($name),
            'key_id' => $keyId,
            'secret_hash' => $hash,
            'scopes' => array_values(array_unique(array_filter(array_map('strval', $scopes)))),
            'created_by_admin_id' => $createdBy,
            'expires_at' => $expiresAt,
        ]);

        return ['token' => 'tgf_'.$keyId.'.'.$secret, 'key' => $key];
    }

    /**
     * Resolve a `tgf_<key id>.<secret>` bearer token. Returns null for an
     * invalid, revoked or expired key and never exposes the encrypted secret.
     *
     * @return array{type:string,key_id:string,scopes:list<string>,api_key_id:int}|null
     */
    public function authenticateApiKey(string $token): ?array
    {
        if (! preg_match('/^tgf_([a-z0-9]{12,40})\.([A-Za-z0-9_-]{32,128})$/', trim($token), $matches)) {
            return null;
        }

        $key = TongzhuoAccessApiKey::query()->where('key_id', $matches[1])->first();
        if (! $key || $key->revoked_at || ($key->expires_at && $key->expires_at->isPast())) {
            return null;
        }

        $providedHash = hash_hmac('sha256', $matches[2], (string) config('app.key'));
        if (! hash_equals((string) $key->secret_hash, $providedHash)) {
            return null;
        }

        $key->forceFill(['last_used_at' => now()])->save();

        return [
            'type' => 'api_key',
            'key_id' => (string) $key->key_id,
            'scopes' => array_values(array_map('strval', $key->scopes ?? [])),
            'api_key_id' => (int) $key->id,
        ];
    }

    public function audit(string $action, ?string $resourceType = null, int|string|null $resourceId = null, array $metadata = [], ?Request $request = null, ?int $adminId = null): void
    {
        if (! $this->accessTablesReady()) {
            return;
        }
        try {
            $request ??= request();
            TongzhuoAccessAuditLog::query()->create([
                'admin_user_id' => $adminId ?? $this->adminId($this->currentAdmin()),
                'action' => $action,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId === null ? null : (string) $resourceId,
                'ip_address' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'metadata' => $this->redactMetadata($metadata),
            ]);
        } catch (Throwable) {
            // An audit write must not turn a successful business operation into
            // a 500 during a partial migration or a read-only filesystem.
        }
    }

    public function accessTablesReady(): bool
    {
        try {
            return Schema::hasTable('tongzhuo_access_roles')
                && Schema::hasTable('tongzhuo_access_permissions')
                && Schema::hasTable('tongzhuo_access_user_roles');
        } catch (Throwable) {
            return false;
        }
    }

    /** @return array<string, mixed> */
    private function redactMetadata(array $metadata): array
    {
        foreach (array_keys($metadata) as $key) {
            if (preg_match('/pass(word)?|secret|token|api[_-]?key|cookie|authorization/i', (string) $key)) {
                $metadata[$key] = '[REDACTED]';
            }
        }

        return $metadata;
    }
}
