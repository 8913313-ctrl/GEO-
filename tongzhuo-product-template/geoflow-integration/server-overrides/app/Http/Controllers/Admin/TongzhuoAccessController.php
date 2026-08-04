<?php

namespace App\Http\Controllers\Admin;

use App\Models\TongzhuoAccessApiKey;
use App\Models\TongzhuoAccessAuditLog;
use App\Models\TongzhuoAccessPermission;
use App\Models\TongzhuoAccessRole;
use App\Services\Access\AccessControlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TongzhuoAccessController
{
    public function __construct(private readonly AccessControlService $access) {}

    public function me(Request $request): JsonResponse
    {
        $admin = $this->access->currentAdmin();

        return $this->ok([
            'id' => $this->access->adminId($admin),
            'username' => $admin?->username,
            'is_super_admin' => $this->access->isSuperAdmin($admin),
            'roles' => $this->access->rolesFor($admin),
            'permissions' => $this->access->permissionsFor($admin),
            'api_context' => $request->attributes->get('access.auth'),
        ]);
    }

    public function users(): JsonResponse
    {
        if (! Schema::hasTable('admin_users')) {
            return $this->error('access_users_table_missing', '当前 GEOFlow 尚未初始化管理员账号表。', 503);
        }

        $columns = Schema::getColumnListing('admin_users');
        $allowed = array_values(array_intersect(['id', 'username', 'email', 'name', 'display_name', 'is_active', 'status', 'is_super_admin', 'created_at', 'last_login_at', 'disabled_at'], $columns));
        $rows = DB::table('admin_users')->orderBy('id')->get($allowed ?: ['id']);
        $roleMap = DB::table('tongzhuo_access_user_roles as ur')
            ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
            ->whereIn('ur.admin_user_id', $rows->pluck('id'))
            ->get(['ur.admin_user_id', 'r.id', 'r.name', 'r.slug'])
            ->groupBy('admin_user_id');

        return $this->ok($rows->map(function ($user) use ($roleMap): array {
            $item = (array) $user;
            $item['roles'] = $roleMap->get($user->id, collect())->map(fn ($role): array => [
                'id' => (int) $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
            ])->values()->all();
            unset($item['password'], $item['remember_token']);

            return $item;
        })->values()->all());
    }

    public function storeUser(Request $request): JsonResponse
    {
        if (! Schema::hasTable('admin_users')) {
            return $this->error('access_users_table_missing', '当前 GEOFlow 尚未初始化管理员账号表。', 503);
        }
        $payload = $request->validate([
            'username' => ['required', 'string', 'min:2', 'max:80'],
            'password' => ['required', 'string', 'min:10', 'max:200'],
            'email' => ['nullable', 'email', 'max:160'],
            'name' => ['nullable', 'string', 'max:120'],
            'display_name' => ['nullable', 'string', 'max:120'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:tongzhuo_access_roles,id'],
        ]);
        $columns = Schema::getColumnListing('admin_users');
        $usernameColumn = in_array('username', $columns, true) ? 'username' : (in_array('email', $columns, true) ? 'email' : null);
        if (! $usernameColumn) {
            return $this->error('access_users_schema_unsupported', '当前 GEOFlow 管理员表缺少登录标识字段。', 503);
        }
        if (! in_array('password', $columns, true)) {
            return $this->error('access_users_schema_unsupported', '当前 GEOFlow 管理员表缺少密码字段，不能安全创建账号。', 503);
        }
        if (DB::table('admin_users')->where($usernameColumn, $payload['username'])->exists()) {
            return $this->error('access_username_taken', '账号已存在。', 422);
        }
        if (! empty($payload['email']) && in_array('email', $columns, true) && DB::table('admin_users')->where('email', $payload['email'])->exists()) {
            return $this->error('access_email_taken', '邮箱已被其他账号使用。', 422);
        }

        $record = [];
        $record[$usernameColumn] = $payload['username'];
        $record['password'] = Hash::make($payload['password']);
        foreach (['email', 'name', 'display_name'] as $field) {
            if (isset($payload[$field]) && in_array($field, $columns, true)) {
                $record[$field] = $payload[$field];
            }
        }
        if (in_array('is_active', $columns, true)) {
            $record['is_active'] = true;
        }
        if (in_array('status', $columns, true)) {
            $record['status'] = 'active';
        }
        if (in_array('is_super_admin', $columns, true)) {
            $record['is_super_admin'] = false;
        }
        if (in_array('created_at', $columns, true)) {
            $record['created_at'] = now();
        }
        if (in_array('updated_at', $columns, true)) {
            $record['updated_at'] = now();
        }

        $adminId = (int) DB::table('admin_users')->insertGetId($record);
        $this->access->syncRoles($adminId, $payload['role_ids'] ?? [], $this->access->adminId($this->access->currentAdmin()));
        $this->access->audit('admin_user.created', 'admin_user', $adminId, ['username' => $payload['username']], $request);

        return $this->ok(['id' => $adminId], 201);
    }

    public function updateUser(Request $request, int $adminId): JsonResponse
    {
        if (! Schema::hasTable('admin_users') || ! DB::table('admin_users')->where('id', $adminId)->exists()) {
            return $this->error('access_user_not_found', '管理员账号不存在。', 404);
        }
        $payload = $request->validate([
            'password' => ['nullable', 'string', 'min:10', 'max:200'],
            'email' => ['nullable', 'email', 'max:160'],
            'name' => ['nullable', 'string', 'max:120'],
            'display_name' => ['nullable', 'string', 'max:120'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:tongzhuo_access_roles,id'],
        ]);
        if (array_key_exists('role_ids', $payload) && $this->wouldRemoveLastSuperAdmin($adminId, $payload['role_ids'] ?? [])) {
            return $this->error('access_last_super_admin_required', '必须至少保留一个超级管理员账号。', 422);
        }
        $columns = Schema::getColumnListing('admin_users');
        if (! empty($payload['email']) && in_array('email', $columns, true) && DB::table('admin_users')->where('email', $payload['email'])->where('id', '!=', $adminId)->exists()) {
            return $this->error('access_email_taken', '邮箱已被其他账号使用。', 422);
        }
        $record = [];
        foreach (['email', 'name', 'display_name'] as $field) {
            if (array_key_exists($field, $payload) && in_array($field, $columns, true)) {
                $record[$field] = $payload[$field];
            }
        }
        if (! empty($payload['password']) && in_array('password', $columns, true)) {
            $record['password'] = Hash::make($payload['password']);
        }
        if (in_array('updated_at', $columns, true)) {
            $record['updated_at'] = now();
        }
        if ($record !== []) {
            DB::table('admin_users')->where('id', $adminId)->update($record);
        }
        if (array_key_exists('role_ids', $payload)) {
            $this->access->syncRoles($adminId, $payload['role_ids'] ?? [], $this->access->adminId($this->access->currentAdmin()));
        }
        $this->access->audit('admin_user.updated', 'admin_user', $adminId, ['fields' => array_keys($record)], $request);

        return $this->ok(['id' => $adminId]);
    }

    public function toggleUser(Request $request, int $adminId): JsonResponse
    {
        if (! Schema::hasTable('admin_users') || ! DB::table('admin_users')->where('id', $adminId)->exists()) {
            return $this->error('access_user_not_found', '管理员账号不存在。', 404);
        }
        $columns = Schema::getColumnListing('admin_users');
        $active = $request->boolean('active', true);
        if (! $active && $this->isOnlySuperAdmin($adminId)) {
            return $this->error('access_last_super_admin_required', '必须至少保留一个启用的超级管理员账号。', 422);
        }
        $record = [];
        if (in_array('is_active', $columns, true)) {
            $record['is_active'] = $active;
        }
        if (in_array('status', $columns, true)) {
            $record['status'] = $active ? 'active' : 'disabled';
        }
        if (in_array('disabled_at', $columns, true)) {
            $record['disabled_at'] = $active ? null : now();
        }
        if (in_array('updated_at', $columns, true)) {
            $record['updated_at'] = now();
        }
        DB::table('admin_users')->where('id', $adminId)->update($record);
        $this->access->audit($active ? 'admin_user.enabled' : 'admin_user.disabled', 'admin_user', $adminId, [], $request);

        return $this->ok(['id' => $adminId, 'active' => $active]);
    }

    public function deleteUser(Request $request, int $adminId): JsonResponse
    {
        $currentId = $this->access->adminId($this->access->currentAdmin());
        if ($currentId === $adminId) {
            return $this->error('access_self_delete_forbidden', '不能删除当前登录账号。', 422);
        }
        if (! Schema::hasTable('admin_users') || ! DB::table('admin_users')->where('id', $adminId)->exists()) {
            return $this->error('access_user_not_found', '管理员账号不存在。', 404);
        }
        if ($this->isOnlySuperAdmin($adminId)) {
            return $this->error('access_last_super_admin_required', '必须至少保留一个超级管理员账号。', 422);
        }
        DB::transaction(function () use ($adminId): void {
            DB::table('tongzhuo_access_user_roles')->where('admin_user_id', $adminId)->delete();
            DB::table('admin_users')->where('id', $adminId)->delete();
        });
        $this->access->audit('admin_user.deleted', 'admin_user', $adminId, [], $request);

        return $this->ok(['id' => $adminId]);
    }

    public function roles(): JsonResponse
    {
        $roles = TongzhuoAccessRole::query()->with('permissions:id,name,slug,group_key')->orderBy('name')->get();

        return $this->ok($roles->map(fn (TongzhuoAccessRole $role): array => [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'description' => $role->description,
            'is_system' => $role->is_system,
            'is_active' => $role->is_active,
            'permissions' => $role->permissions->map(fn ($permission): array => [
                'id' => $permission->id,
                'name' => $permission->name,
                'slug' => $permission->slug,
                'group_key' => $permission->group_key,
            ])->all(),
        ])->all());
    }

    public function storeRole(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'slug' => ['required', 'string', 'max:80', 'regex:/^[a-z][a-z0-9._-]+$/', 'unique:tongzhuo_access_roles,slug'],
            'description' => ['nullable', 'string', 'max:255'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer', 'exists:tongzhuo_access_permissions,id'],
        ]);
        $role = TongzhuoAccessRole::query()->create([
            'name' => $payload['name'],
            'slug' => $payload['slug'],
            'description' => $payload['description'] ?? null,
            'is_system' => false,
            'is_active' => true,
            'created_by_admin_id' => $this->access->adminId($this->access->currentAdmin()),
        ]);
        $role->permissions()->sync($payload['permission_ids'] ?? []);
        $this->access->audit('access_role.created', 'role', $role->id, ['slug' => $role->slug], $request);

        return $this->ok(['id' => $role->id], 201);
    }

    public function updateRole(Request $request, int $roleId): JsonResponse
    {
        $role = TongzhuoAccessRole::query()->find($roleId);
        if (! $role) {
            return $this->error('access_role_not_found', '角色不存在。', 404);
        }
        if ($role->is_system && ($request->has('slug') || $request->boolean('replace_system'))) {
            return $this->error('access_system_role_locked', '系统角色不能修改标识。', 422);
        }
        $payload = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer', 'exists:tongzhuo_access_permissions,id'],
        ]);
        if ($role->slug === 'super_admin' && array_key_exists('is_active', $payload) && ! $payload['is_active']) {
            return $this->error('access_super_role_required', '超级管理员角色不能停用。', 422);
        }
        $role->fill(array_intersect_key($payload, array_flip(['name', 'description', 'is_active'])))->save();
        if (array_key_exists('permission_ids', $payload)) {
            $role->permissions()->sync($payload['permission_ids'] ?? []);
        }
        $this->access->audit('access_role.updated', 'role', $role->id, ['fields' => array_keys($payload)], $request);

        return $this->ok(['id' => $role->id]);
    }

    public function permissions(): JsonResponse
    {
        return $this->ok(TongzhuoAccessPermission::query()->orderBy('group_key')->orderBy('slug')->get([
            'id', 'name', 'slug', 'group_key', 'description', 'is_system',
        ]));
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->input('limit', 50), 1), 200);

        return $this->ok(TongzhuoAccessAuditLog::query()->latest('created_at')->limit($limit)->get());
    }

    public function apiKeys(): JsonResponse
    {
        return $this->ok(TongzhuoAccessApiKey::query()->latest()->get([
            'id', 'name', 'key_id', 'scopes', 'created_by_admin_id', 'last_used_at', 'expires_at', 'revoked_at', 'created_at',
        ]));
    }

    public function issueApiKey(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => ['string', Rule::in([
                'content.read',
                'content.write',
                'content.generate',
                'knowledge.manage',
            ])],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);
        $issued = $this->access->issueApiKey(
            $payload['name'],
            $payload['scopes'],
            isset($payload['expires_at']) ? new \DateTimeImmutable($payload['expires_at']) : null,
            $this->access->adminId($this->access->currentAdmin()),
        );
        $this->access->audit('access_api_key.created', 'api_key', $issued['key']->id, ['name' => $payload['name'], 'scopes' => $payload['scopes']], $request);

        return $this->ok([
            'key' => $issued['key']->only(['id', 'name', 'key_id', 'scopes', 'expires_at', 'created_at']),
            'token' => $issued['token'],
            'warning' => '完整 API 密钥只显示这一次，请立即保存到本地发布器或服务端密钥管理器。',
        ], 201);
    }

    public function revokeApiKey(Request $request, int $keyId): JsonResponse
    {
        $key = TongzhuoAccessApiKey::query()->find($keyId);
        if (! $key) {
            return $this->error('access_api_key_not_found', 'API 密钥不存在。', 404);
        }
        $key->forceFill(['revoked_at' => now()])->save();
        $this->access->audit('access_api_key.revoked', 'api_key', $key->id, [], $request);

        return $this->ok(['id' => $key->id, 'revoked_at' => $key->revoked_at]);
    }

    /** @param mixed $data */
    private function ok(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => $data], $status);
    }

    private function error(string $code, string $message, int $status = 422): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => ['code' => $code, 'message' => $message]], $status);
    }

    /** @param list<int|string> $newRoleIds */
    private function wouldRemoveLastSuperAdmin(int $adminId, array $newRoleIds): bool
    {
        $superRoleId = DB::table('tongzhuo_access_roles')->where('slug', 'super_admin')->value('id');
        if (! $superRoleId) {
            return false;
        }
        $currentlySuper = DB::table('tongzhuo_access_user_roles')
            ->where('admin_user_id', $adminId)
            ->where('role_id', $superRoleId)
            ->exists();
        $willRemainSuper = in_array((int) $superRoleId, array_map('intval', $newRoleIds), true);

        return $currentlySuper && ! $willRemainSuper && $this->superAdminCount() <= 1;
    }

    private function isOnlySuperAdmin(int $adminId): bool
    {
        $superRoleId = DB::table('tongzhuo_access_roles')->where('slug', 'super_admin')->value('id');
        if (! $superRoleId) {
            return false;
        }

        return DB::table('tongzhuo_access_user_roles')
            ->where('admin_user_id', $adminId)
            ->where('role_id', $superRoleId)
            ->exists() && $this->superAdminCount() <= 1;
    }

    private function superAdminCount(): int
    {
        $query = DB::table('tongzhuo_access_user_roles as ur')
            ->join('tongzhuo_access_roles as r', 'r.id', '=', 'ur.role_id')
            ->where('r.slug', 'super_admin')
            ->where('r.is_active', true);
        if (Schema::hasTable('admin_users')) {
            $query->join('admin_users as au', 'au.id', '=', 'ur.admin_user_id');
            if (Schema::hasColumn('admin_users', 'is_active')) {
                $query->where('au.is_active', true);
            } elseif (Schema::hasColumn('admin_users', 'status')) {
                $query->whereIn('au.status', ['active', 'enabled']);
            }
        }

        return (int) $query->distinct()->count('ur.admin_user_id');
    }
}
