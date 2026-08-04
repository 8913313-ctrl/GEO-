@php
    $currentAdmin = auth('admin')->user();
    $accessControl = app(\App\Services\Access\AccessControlService::class);
    $adminBrandName = $adminBrandName ?? \App\Support\AdminWeb::siteName();
    $isSuperAdmin = $accessControl->isSuperAdmin($currentAdmin);
    $grantedPermissions = $isSuperAdmin ? ['*'] : $accessControl->permissionsFor($currentAdmin);
    $adminRoles = $accessControl->rolesFor($currentAdmin);
    $adminRoleLabel = $isSuperAdmin
        ? __('admin.header.super_admin')
        : (collect($adminRoles)->pluck('name')->filter()->implode(' / ') ?: __('admin.header.admin'));
    $menu = [
        'dashboard' => ['route' => 'admin.dashboard', 'name' => '总览', 'icon' => 'layout-dashboard', 'desc' => '运营数据与待办'],
        'tongzhuo_cms' => ['route' => 'admin.tongzhuo-cms.dashboard', 'name' => '官网CMS', 'icon' => 'panels-top-left', 'desc' => '官网内容后台'],
        'tongzhuo_cms_pages' => ['route' => 'admin.tongzhuo-cms.pages.index', 'name' => '页面管理', 'icon' => 'file-stack', 'desc' => '页面与模块'],
        'tongzhuo_cms_faqs' => ['route' => 'admin.tongzhuo-cms.faqs.index', 'name' => '问题地图', 'icon' => 'circle-help', 'desc' => '动态FAQ内容库'],
        'tongzhuo_cms_nav' => ['route' => 'admin.tongzhuo-cms.navigation.index', 'name' => '导航管理', 'icon' => 'menu-square', 'desc' => '导航与页脚'],
        'tongzhuo_cms_settings' => ['route' => 'admin.tongzhuo-cms.settings.index', 'name' => '全站设置', 'icon' => 'settings', 'desc' => '品牌与SEO'],
        'fact_base' => ['route' => 'admin.fact-base.index', 'name' => '事实底座', 'icon' => 'database-zap', 'desc' => '事实与来源'],
        'articles' => ['route' => 'admin.articles.index', 'name' => '行业资讯', 'icon' => 'newspaper', 'desc' => '文章发布'],
        'contact_leads' => ['route' => 'admin.contact-leads.index', 'name' => '客户线索', 'icon' => 'message-square-more', 'desc' => '表单咨询'],
        'customer_projects' => ['route' => 'admin.customer-projects.index', 'name' => '客户项目', 'icon' => 'folder-kanban', 'desc' => '交付档案'],
        'geo_console' => ['route' => 'admin.geo-growth.index', 'name' => 'GEO工作台', 'icon' => 'sparkles', 'desc' => '诊断与内容增长'],
        'geo_opportunities' => ['route' => 'admin.geo-opportunities.index', 'name' => '问题机会', 'icon' => 'radar', 'desc' => 'AI问题与选题'],
        'geo_answer_tests' => ['route' => 'admin.geo-answer-tests.index', 'name' => 'AI问答测试', 'icon' => 'messages-square', 'desc' => '答案覆盖检测'],
        'geo_plans' => ['route' => 'admin.geo-plans.index', 'name' => '行动方案', 'icon' => 'calendar-range', 'desc' => '30/60/90天计划'],
        'materials' => ['route' => 'admin.materials.index', 'name' => '内容资产', 'icon' => 'database', 'desc' => '知识与素材'],
        'distribution' => ['route' => 'admin.distribution.index', 'name' => '分发管理', 'icon' => 'send', 'desc' => '渠道队列'],
        'publisher_assistant' => ['route' => 'admin.publisher-assistant', 'name' => '发布助手', 'icon' => 'monitor-up', 'desc' => '平台同步'],
        'analytics' => ['route' => 'admin.analytics', 'name' => '数据复盘', 'icon' => 'chart-no-axes-combined', 'desc' => '效果分析'],
        'system_settings' => ['route' => 'admin.site-settings.index', 'name' => '系统配置', 'icon' => 'sliders-horizontal', 'desc' => '底层配置'],
    ];
    if ($isSuperAdmin) {
        $menu['admin_users'] = ['route' => 'admin.admin-users.index', 'name' => '账号权限', 'icon' => 'shield-check', 'desc' => '管理员'];
    }
    $menuPermissions = [
        'dashboard' => ['dashboard.view'],
        'tongzhuo_cms' => ['website.manage'],
        'tongzhuo_cms_pages' => ['website.manage'],
        'tongzhuo_cms_faqs' => ['website.manage'],
        'tongzhuo_cms_nav' => ['website.manage'],
        'tongzhuo_cms_settings' => ['website.manage'],
        'fact_base' => ['knowledge.read'],
        'articles' => ['content.write', 'content.review', 'publishing.read'],
        'contact_leads' => ['customers.manage'],
        'customer_projects' => ['customers.manage'],
        'geo_console' => ['geo.read'],
        'geo_opportunities' => ['geo.read'],
        'geo_answer_tests' => ['geo.read'],
        'geo_plans' => ['geo.read'],
        'materials' => ['knowledge.read'],
        'distribution' => ['publishing.read'],
        'publisher_assistant' => ['publishing.read'],
        'analytics' => ['analytics.read'],
        'system_settings' => ['website.manage'],
        'admin_users' => ['roles.manage'],
    ];
    // A staged deployment may temporarily omit an optional GEO module. Do not
    // let a missing menu route take down every admin page.
    $menu = array_filter($menu, function (array $item, string $key) use ($menuPermissions, $grantedPermissions): bool {
        $required = $menuPermissions[$key] ?? ['dashboard.view'];
        return \Illuminate\Support\Facades\Route::has($item['route'])
            && (in_array('*', $grantedPermissions, true) || array_intersect($required, $grantedPermissions) !== []);
    }, ARRAY_FILTER_USE_BOTH);
    $menuGroups = [
        '工作台' => ['dashboard'],
        '官网CMS' => ['tongzhuo_cms', 'tongzhuo_cms_pages', 'tongzhuo_cms_faqs', 'tongzhuo_cms_nav', 'tongzhuo_cms_settings'],
        '内容增长' => ['fact_base', 'articles', 'materials'],
        '客户资产' => ['contact_leads', 'customer_projects'],
        'GEO运营' => ['geo_console', 'geo_opportunities', 'geo_answer_tests', 'geo_plans', 'distribution', 'publisher_assistant', 'analytics'],
        '系统' => $isSuperAdmin ? ['system_settings', 'admin_users'] : ['system_settings'],
    ];
    $subMap = [
        'admin.dashboard' => 'dashboard',
        'admin.analytics' => 'analytics',
        'admin.tongzhuo-cms.dashboard' => 'tongzhuo_cms',
        'admin.tongzhuo-cms.pages.index' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.create' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.edit' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.store' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.update' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.publish' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.draft' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.delete' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.blocks.store' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.blocks.update' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.blocks.delete' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.pages.blocks.reorder' => 'tongzhuo_cms_pages',
        'admin.tongzhuo-cms.faqs.index' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.categories.store' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.categories.update' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.items.store' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.items.update' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.items.status' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.faqs.items.delete' => 'tongzhuo_cms_faqs',
        'admin.tongzhuo-cms.navigation.index' => 'tongzhuo_cms_nav',
        'admin.tongzhuo-cms.navigation.save' => 'tongzhuo_cms_nav',
        'admin.tongzhuo-cms.settings.index' => 'tongzhuo_cms_settings',
        'admin.tongzhuo-cms.settings.save' => 'tongzhuo_cms_settings',
        'admin.geo-console' => 'geo_console',
        'admin.geo-growth.index' => 'geo_console',
        'admin.geo-growth.audits.store' => 'geo_console',
        'admin.geo-growth.audit' => 'geo_console',
        'admin.geo-growth.tasks.status' => 'geo_console',
        'admin.geo-growth.tasks.promote' => 'geo_console',
        'admin.geo-growth.tasks.promote-faq' => 'geo_console',
        'admin.geo-opportunities.index' => 'geo_opportunities',
        'admin.geo-opportunities.store' => 'geo_opportunities',
        'admin.geo-opportunities.seed-presets' => 'geo_opportunities',
        'admin.geo-opportunities.status' => 'geo_opportunities',
        'admin.geo-opportunities.promote' => 'geo_opportunities',
        'admin.geo-answer-tests.index' => 'geo_answer_tests',
        'admin.geo-answer-tests.store' => 'geo_answer_tests',
        'admin.geo-answer-tests.run' => 'geo_answer_tests',
        'admin.geo-answer-tests.sample' => 'geo_answer_tests',
        'admin.geo-answer-tests.promote-opportunity' => 'geo_answer_tests',
        'admin.geo-plans.index' => 'geo_plans',
        'admin.geo-plans.store' => 'geo_plans',
        'admin.geo-plans.show' => 'geo_plans',
        'admin.geo-plans.items.status' => 'geo_plans',
        'admin.fact-base.index' => 'fact_base',
        'admin.fact-base.store' => 'fact_base',
        'admin.fact-base.status' => 'fact_base',
        'admin.fact-base.delete' => 'fact_base',
        'admin.contact-leads.index' => 'contact_leads',
        'admin.contact-leads.update' => 'contact_leads',
        'admin.customer-projects.index' => 'customer_projects',
        'admin.customer-projects.store' => 'customer_projects',
        'admin.customer-projects.current-site' => 'customer_projects',
        'admin.customer-projects.show' => 'customer_projects',
        'admin.customer-projects.handoff' => 'customer_projects',
        'admin.customer-projects.update' => 'customer_projects',
        'admin.tasks.index' => 'geo_console',
        'admin.tasks.create' => 'geo_console',
        'admin.tasks.edit' => 'geo_console',
        'admin.distribution.index' => 'distribution',
        'admin.distribution.create' => 'distribution',
        'admin.distribution.store' => 'distribution',
        'admin.distribution.edit' => 'distribution',
        'admin.distribution.update' => 'distribution',
        'admin.distribution.show' => 'distribution',
        'admin.distribution.jobs' => 'distribution',
        'admin.publisher-assistant' => 'publisher_assistant',
        'admin.publisher-assistant.bootstrap-channel' => 'publisher_assistant',
        'admin.publisher-assistant.enqueue-published' => 'publisher_assistant',
        'admin.publisher-devices.index' => 'publisher_assistant',
        'admin.distribution.retry' => 'distribution',
        'admin.distribution.health' => 'distribution',
        'admin.distribution.pause' => 'distribution',
        'admin.distribution.activate' => 'distribution',
        'admin.distribution.rotate-secret' => 'distribution',
        'admin.articles.index' => 'articles',
        'admin.articles.create' => 'articles',
        'admin.articles.edit' => 'articles',
        'admin.materials.index' => 'materials',
        'admin.site-settings.index' => 'system_settings',
        'admin.site-settings.update' => 'system_settings',
        'admin.site-settings.theme' => 'system_settings',
        'admin.site-settings.ads' => 'system_settings',
        'admin.security-settings.index' => 'system_settings',
        'admin.api-tokens.index' => 'admin_users',
        'admin.api-tokens.store' => 'admin_users',
        'admin.api-tokens.revoke' => 'admin_users',
        'admin.admin-activity-logs' => 'admin_users',
    ];
    $routeName = request()->route()?->getName();
    $resolvedActive = $activeMenu ?: ($subMap[$routeName] ?? 'dashboard');
@endphp

<aside class="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-slate-200 bg-white shadow-sm md:flex md:flex-col">
    <div class="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
        <a href="{{ route('admin.dashboard') }}" class="flex min-w-0 items-center gap-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">桐</span>
            <span class="min-w-0">
                <span class="block truncate text-sm font-black text-slate-950">桐灼工作台</span>
                <span class="block truncate text-[11px] font-medium text-slate-400">AI · GEO · CMS</span>
            </span>
        </a>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-4">
        <nav class="space-y-4">
            @foreach ($menuGroups as $groupName => $groupKeys)
                @php
                    $groupId = 'admin-nav-group-'.$loop->index;
                    $groupIsActive = in_array($resolvedActive, $groupKeys, true);
                    $visibleGroupCount = count(array_filter($groupKeys, fn ($key) => isset($menu[$key])));
                @endphp
                <div class="rounded-2xl border border-transparent px-1 py-1 transition data-[collapsed=true]:border-slate-100 data-[collapsed=true]:bg-slate-50/70" data-nav-group data-nav-group-key="{{ $loop->index }}" data-nav-active="{{ $groupIsActive ? '1' : '0' }}">
                    <button type="button" onclick="toggleNavGroup(this)" data-nav-group-toggle aria-expanded="true" aria-controls="{{ $groupId }}" class="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <span class="min-w-0 flex-1 truncate">{{ $groupName }}</span>
                        <span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-400">{{ $visibleGroupCount }}</span>
                        <i data-lucide="chevron-down" data-nav-group-chevron class="h-3.5 w-3.5 shrink-0 transition-transform"></i>
                    </button>
                    <div id="{{ $groupId }}" data-nav-group-body class="mt-1.5 space-y-1">
                        @foreach ($groupKeys as $key)
                            @continue(! isset($menu[$key]))
                            @php $item = $menu[$key]; $isActive = $resolvedActive === $key; @endphp
                            <a href="{{ route($item['route']) }}" class="@if($isActive) bg-slate-950 text-white shadow-sm @else text-slate-600 hover:bg-slate-100 hover:text-slate-950 @endif group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition">
                                <span class="@if($isActive) bg-white/15 text-white @else bg-white text-slate-500 ring-1 ring-slate-200 group-hover:text-blue-600 @endif flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition">
                                    <i data-lucide="{{ $item['icon'] }}" class="h-4 w-4"></i>
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-[13px] font-bold">{{ $item['name'] }}</span>
                                    <span class="@if($isActive) text-slate-300 @else text-slate-400 @endif block truncate text-[11px] leading-4">{{ $item['desc'] }}</span>
                                </span>
                            </a>
                        @endforeach
                    </div>
                </div>
            @endforeach
        </nav>
    </div>

    <div class="border-t border-slate-100 p-3">
        <a href="{{ url('/index.html') }}" target="_blank" rel="noreferrer" class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
            <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
            打开官网
        </a>
    </div>
</aside>

<header class="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur md:left-64">
    <div class="flex h-14 items-center gap-3 px-4 sm:px-5 lg:px-7">
        <button onclick="toggleMobileMenu()" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 md:hidden" type="button" aria-label="打开导航">
            <i data-lucide="menu" class="h-4 w-4"></i>
        </button>
        <div class="min-w-0">
            <div class="truncate text-sm font-black text-slate-950">{{ $pageTitle ?: '运营工作台' }}</div>
            <div class="hidden text-[11px] text-slate-400 sm:block">官网CMS、GEO运营、内容分发统一后台</div>
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-2">
            <a href="{{ url('/index.html') }}" target="_blank" rel="noreferrer" class="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 lg:inline-flex">
                <i data-lucide="external-link" class="h-3.5 w-3.5 text-slate-400"></i>
                官网
            </a>
            <div class="relative">
                <button onclick="toggleUserMenu()" class="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 text-sm text-slate-600 hover:bg-slate-50" type="button">
                    <span class="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50"><i data-lucide="user" class="h-3.5 w-3.5 text-blue-600"></i></span>
                    <i data-lucide="chevron-down" class="h-3.5 w-3.5"></i>
                </button>
                <div id="user-menu" class="hidden absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl z-50">
                    <div class="border-b border-slate-100 px-4 py-3">
                        <div class="text-sm font-semibold text-slate-800">{{ __('admin.header.welcome', ['name' => $currentAdmin->username ?? '']) }}</div>
                        <div class="text-xs text-slate-400">{{ $adminRoleLabel }}</div>
                    </div>
                    <a href="{{ route('admin.dashboard') }}" class="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="home" class="mr-2 inline h-4 w-4"></i>首页</a>
                    <a href="{{ route('admin.site-settings.index') }}" class="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="settings" class="mr-2 inline h-4 w-4"></i>设置</a>
                    @if ($isSuperAdmin)
                        <a href="{{ route('admin.admin-users.index') }}" class="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="users" class="mr-2 inline h-4 w-4"></i>账号管理</a>
                    @endif
                    <div class="border-t border-slate-100"></div>
                    <form method="POST" action="{{ route('admin.logout') }}">
                        @csrf
                        <button type="submit" class="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><i data-lucide="log-out" class="mr-2 inline h-4 w-4"></i>退出登录</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    <div id="mobile-menu" class="hidden border-t border-slate-200 bg-white px-3 py-3 shadow-lg md:hidden">
        <div class="space-y-2">
            @foreach ($menuGroups as $groupName => $groupKeys)
                @php
                    $mobileGroupId = 'mobile-admin-nav-group-'.$loop->index;
                    $groupIsActive = in_array($resolvedActive, $groupKeys, true);
                    $visibleGroupCount = count(array_filter($groupKeys, fn ($key) => isset($menu[$key])));
                @endphp
                <div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-1" data-nav-group data-nav-group-key="{{ $loop->index }}" data-nav-active="{{ $groupIsActive ? '1' : '0' }}">
                    <button type="button" onclick="toggleNavGroup(this)" data-nav-group-toggle aria-expanded="true" aria-controls="{{ $mobileGroupId }}" class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-black text-slate-500 transition hover:bg-white">
                        <span class="min-w-0 flex-1 truncate">{{ $groupName }}</span>
                        <span class="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-400">{{ $visibleGroupCount }}</span>
                        <i data-lucide="chevron-down" data-nav-group-chevron class="h-3.5 w-3.5 shrink-0 transition-transform"></i>
                    </button>
                    <div id="{{ $mobileGroupId }}" data-nav-group-body class="space-y-1">
                        @foreach ($groupKeys as $key)
                            @continue(! isset($menu[$key]))
                            @php($item = $menu[$key])
                            <a href="{{ route($item['route']) }}" class="@if($resolvedActive === $key) bg-slate-950 text-white @else text-slate-600 hover:bg-white @endif flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition">
                                <i data-lucide="{{ $item['icon'] }}" class="h-4 w-4"></i>
                                {{ $item['name'] }}
                            </a>
                        @endforeach
                    </div>
                </div>
            @endforeach
        </div>
    </div>
</header>

<script>
function toggleUserMenu(){const m=document.getElementById('user-menu'); if(m)m.classList.toggle('hidden');}
function toggleMobileMenu(){const m=document.getElementById('mobile-menu'); if(m)m.classList.toggle('hidden');}
const adminNavCollapseKey='tongzhuo_admin_nav_collapsed';
function readAdminNavCollapsed(){
 try{return JSON.parse(localStorage.getItem(adminNavCollapseKey)||'{}')||{};}catch(e){return {};}
}
function writeAdminNavCollapsed(state){
 try{localStorage.setItem(adminNavCollapseKey,JSON.stringify(state));}catch(e){}
}
function setAdminNavGroupCollapsed(group,collapsed){
 const body=group.querySelector('[data-nav-group-body]');
 const button=group.querySelector('[data-nav-group-toggle]');
 const chevron=group.querySelector('[data-nav-group-chevron]');
 if(body) body.classList.toggle('hidden',collapsed);
 if(button) button.setAttribute('aria-expanded',String(!collapsed));
 if(chevron) chevron.classList.toggle('-rotate-90',collapsed);
 group.dataset.collapsed=collapsed?'true':'false';
}
function toggleNavGroup(button){
 const group=button.closest('[data-nav-group]');
 if(!group) return;
 const key=group.dataset.navGroupKey;
 const nextCollapsed=group.dataset.collapsed!=='true';
 document.querySelectorAll(`[data-nav-group][data-nav-group-key="${key}"]`).forEach((item)=>setAdminNavGroupCollapsed(item,nextCollapsed));
 const state=readAdminNavCollapsed();
 state[key]=nextCollapsed;
 writeAdminNavCollapsed(state);
}
function initAdminNavGroups(){
 const state=readAdminNavCollapsed();
 document.querySelectorAll('[data-nav-group]').forEach((group)=>{
  const key=group.dataset.navGroupKey;
  const collapsed=group.dataset.navActive==='1'?false:state[key]===true;
  setAdminNavGroupCollapsed(group,collapsed);
 });
}
document.addEventListener('click',function(e){
 const u=document.getElementById('user-menu'); const m=document.getElementById('mobile-menu');
 if(u && !e.target.closest('[onclick="toggleUserMenu()"]') && !u.contains(e.target)) u.classList.add('hidden');
 if(m && !e.target.closest('[onclick="toggleMobileMenu()"]') && !m.contains(e.target)) m.classList.add('hidden');
});
initAdminNavGroups();
</script>
