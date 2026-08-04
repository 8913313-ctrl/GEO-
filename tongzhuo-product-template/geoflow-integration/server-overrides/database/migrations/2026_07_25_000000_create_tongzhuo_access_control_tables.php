<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The private-deployment access layer deliberately uses its own prefixed
     * tables.  GEOFlow installations can therefore receive this override
     * without changing the vendor admin user model or adding a tenant column.
     */
    public function up(): void
    {
        if (! Schema::hasTable('tongzhuo_access_roles')) {
            Schema::create('tongzhuo_access_roles', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 80);
                $table->string('slug', 80)->unique();
                $table->string('description', 255)->nullable();
                $table->boolean('is_system')->default(false)->index();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_access_permissions')) {
            Schema::create('tongzhuo_access_permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 100);
                $table->string('slug', 120)->unique();
                $table->string('group_key', 60)->default('system')->index();
                $table->string('description', 255)->nullable();
                $table->boolean('is_system')->default(true)->index();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tongzhuo_access_role_permissions')) {
            Schema::create('tongzhuo_access_role_permissions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('role_id');
                $table->unsignedBigInteger('permission_id');
                $table->timestamps();
                $table->unique(['role_id', 'permission_id'], 'tz_access_role_permission_unique');
                $table->foreign('role_id', 'tz_access_role_permission_role_fk')
                    ->references('id')->on('tongzhuo_access_roles')->cascadeOnDelete();
                $table->foreign('permission_id', 'tz_access_role_permission_permission_fk')
                    ->references('id')->on('tongzhuo_access_permissions')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_access_user_roles')) {
            Schema::create('tongzhuo_access_user_roles', function (Blueprint $table): void {
                $table->id();
                // Do not add a foreign key to the vendor admin_users table: old
                // GEOFlow releases used different table engines and migration
                // names. The id is still indexed and validated by the service.
                $table->unsignedBigInteger('admin_user_id')->index();
                $table->unsignedBigInteger('role_id');
                $table->unsignedBigInteger('assigned_by_admin_id')->nullable()->index();
                $table->timestamps();
                $table->unique(['admin_user_id', 'role_id'], 'tz_access_user_role_unique');
                $table->foreign('role_id', 'tz_access_user_role_role_fk')
                    ->references('id')->on('tongzhuo_access_roles')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('tongzhuo_access_audit_logs')) {
            Schema::create('tongzhuo_access_audit_logs', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('admin_user_id')->nullable()->index();
                $table->string('action', 80)->index();
                $table->string('resource_type', 120)->nullable()->index();
                $table->string('resource_id', 120)->nullable();
                $table->string('ip_address', 64)->nullable();
                $table->text('user_agent')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('created_at')->useCurrent()->index();
            });
        }

        if (! Schema::hasTable('tongzhuo_access_api_keys')) {
            Schema::create('tongzhuo_access_api_keys', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120);
                // key_id is safe to display; the secret is only returned once.
                $table->string('key_id', 40)->unique();
                $table->string('secret_hash', 128);
                $table->json('scopes')->nullable();
                $table->unsignedBigInteger('created_by_admin_id')->nullable()->index();
                $table->timestamp('last_used_at')->nullable()->index();
                $table->timestamp('expires_at')->nullable()->index();
                $table->timestamp('revoked_at')->nullable()->index();
                $table->timestamps();
            });
        }

        // Keep the vendor admin table untouched when an old installation does
        // not have it yet. These optional columns are useful to integrations,
        // while role membership remains in the prefixed pivot table above.
        if (Schema::hasTable('admin_users')) {
            Schema::table('admin_users', function (Blueprint $table): void {
                if (! Schema::hasColumn('admin_users', 'last_login_at')) {
                    $table->timestamp('last_login_at')->nullable()->index();
                }
                if (! Schema::hasColumn('admin_users', 'disabled_at')) {
                    $table->timestamp('disabled_at')->nullable()->index();
                }
                if (! Schema::hasColumn('admin_users', 'access_meta')) {
                    $table->json('access_meta')->nullable();
                }
            });
        }

        $this->seedDefaults();
    }

    private function seedDefaults(): void
    {
        $now = now();
        $permissions = [
            ['name' => '查看工作台', 'slug' => 'dashboard.view', 'group_key' => 'dashboard'],
            ['name' => '管理账号', 'slug' => 'users.manage', 'group_key' => 'system'],
            ['name' => '管理角色权限', 'slug' => 'roles.manage', 'group_key' => 'system'],
            ['name' => '管理 AI 模型', 'slug' => 'models.manage', 'group_key' => 'system'],
            ['name' => '管理官网', 'slug' => 'website.manage', 'group_key' => 'system'],
            ['name' => '管理客户与线索', 'slug' => 'customers.manage', 'group_key' => 'system'],
            ['name' => '查看知识库', 'slug' => 'knowledge.read', 'group_key' => 'knowledge'],
            ['name' => '编辑知识库', 'slug' => 'knowledge.write', 'group_key' => 'knowledge'],
            ['name' => '管理知识库', 'slug' => 'knowledge.manage', 'group_key' => 'knowledge'],
            ['name' => '管理选题与计划', 'slug' => 'planning.write', 'group_key' => 'content'],
            ['name' => '编辑文章', 'slug' => 'content.write', 'group_key' => 'content'],
            ['name' => '调用文章生成', 'slug' => 'content.generate', 'group_key' => 'content'],
            ['name' => '审核文章', 'slug' => 'content.review', 'group_key' => 'content'],
            ['name' => '发布文章', 'slug' => 'publishing.write', 'group_key' => 'publishing'],
            ['name' => '查看发布记录', 'slug' => 'publishing.read', 'group_key' => 'publishing'],
            ['name' => '查看 GEO 监测', 'slug' => 'geo.read', 'group_key' => 'geo'],
            ['name' => '执行 GEO 采样', 'slug' => 'geo.write', 'group_key' => 'geo'],
            ['name' => '查看分析报表', 'slug' => 'analytics.read', 'group_key' => 'analytics'],
            ['name' => '管理 API 密钥', 'slug' => 'api.manage', 'group_key' => 'system'],
        ];

        foreach ($permissions as $permission) {
            DB::table('tongzhuo_access_permissions')->updateOrInsert(
                ['slug' => $permission['slug']],
                array_merge($permission, ['updated_at' => $now, 'created_at' => $now])
            );
        }

        $roles = [
            ['name' => '超级管理员', 'slug' => 'super_admin', 'description' => '私有化实例全部权限', 'is_system' => true],
            ['name' => '运营管理员', 'slug' => 'operator', 'description' => '负责知识、选题、文章和发布运营', 'is_system' => true],
            ['name' => '内容编辑', 'slug' => 'editor', 'description' => '负责选题和文章编辑，不能发布', 'is_system' => true],
            ['name' => '审核员', 'slug' => 'reviewer', 'description' => '负责文章人工审核', 'is_system' => true],
            ['name' => '发布员', 'slug' => 'publisher', 'description' => '负责审核通过内容的发布任务', 'is_system' => true],
            ['name' => '只读分析员', 'slug' => 'analyst', 'description' => '只读 GEO 与运营数据', 'is_system' => true],
        ];

        foreach ($roles as $role) {
            DB::table('tongzhuo_access_roles')->updateOrInsert(
                ['slug' => $role['slug']],
                array_merge($role, ['is_active' => true, 'updated_at' => $now, 'created_at' => $now])
            );
        }

        $all = DB::table('tongzhuo_access_permissions')->pluck('id', 'slug');
        $rolePermissionMap = [
            'super_admin' => array_keys($permissions),
            'operator' => ['dashboard.view', 'website.manage', 'customers.manage', 'knowledge.read', 'knowledge.write', 'knowledge.manage', 'planning.write', 'content.write', 'content.generate', 'content.review', 'publishing.read', 'publishing.write', 'geo.read', 'geo.write', 'analytics.read'],
            'editor' => ['dashboard.view', 'knowledge.read', 'planning.write', 'content.write', 'content.generate', 'publishing.read'],
            'reviewer' => ['dashboard.view', 'knowledge.read', 'content.review', 'publishing.read'],
            'publisher' => ['dashboard.view', 'publishing.read', 'publishing.write'],
            'analyst' => ['dashboard.view', 'knowledge.read', 'publishing.read', 'geo.read', 'analytics.read'],
        ];

        foreach ($rolePermissionMap as $roleSlug => $permissionSlugs) {
            $roleId = DB::table('tongzhuo_access_roles')->where('slug', $roleSlug)->value('id');
            if (! $roleId) {
                continue;
            }
            foreach ($permissionSlugs as $permissionKey) {
                // super_admin intentionally receives every permission.
                $permissionSlug = is_int($permissionKey) ? $permissions[$permissionKey]['slug'] : $permissionKey;
                $permissionId = $all[$permissionSlug] ?? null;
                if ($permissionId) {
                    DB::table('tongzhuo_access_role_permissions')->updateOrInsert(
                        ['role_id' => $roleId, 'permission_id' => $permissionId],
                        ['updated_at' => $now, 'created_at' => $now]
                    );
                }
            }
        }

        // Preserve an existing vendor super-admin flag when available. On an
        // older installation without that flag, bootstrap only the oldest
        // account as super admin instead of silently elevating every user.
        if (Schema::hasTable('admin_users')) {
            $roleId = DB::table('tongzhuo_access_roles')->where('slug', 'super_admin')->value('id');
            if ($roleId) {
                $users = DB::table('admin_users')->orderBy('id');
                $userIds = Schema::hasColumn('admin_users', 'is_super_admin')
                    ? $users->where('is_super_admin', true)->pluck('id')
                    : collect([$users->value('id')])->filter();
                if ($userIds->isEmpty()) {
                    $userIds = collect([DB::table('admin_users')->min('id')])->filter();
                }
                foreach ($userIds as $userId) {
                    DB::table('tongzhuo_access_user_roles')->updateOrInsert(
                        ['admin_user_id' => $userId, 'role_id' => $roleId],
                        ['assigned_by_admin_id' => null, 'updated_at' => $now, 'created_at' => $now]
                    );
                }
            }
        }
    }

    public function down(): void
    {
        // The optional admin_users columns are deliberately retained on
        // rollback: this migration cannot know whether an older GEOFlow
        // release created a column before the override was installed.
        Schema::dropIfExists('tongzhuo_access_api_keys');
        Schema::dropIfExists('tongzhuo_access_audit_logs');
        Schema::dropIfExists('tongzhuo_access_user_roles');
        Schema::dropIfExists('tongzhuo_access_role_permissions');
        Schema::dropIfExists('tongzhuo_access_permissions');
        Schema::dropIfExists('tongzhuo_access_roles');
    }
};
