@extends('admin.layouts.app')

@section('content')
@php
    $statusLabels = ['active' => '服务中', 'paused' => '已暂停', 'closed' => '已结束'];
    $healthClasses = [
        'normal' => 'bg-emerald-50 text-emerald-700',
        'watch' => 'bg-amber-50 text-amber-700',
        'risk' => 'bg-red-50 text-red-700',
    ];
    $acceptanceClasses = [
        'pending' => 'bg-slate-100 text-slate-700',
        'passed' => 'bg-emerald-50 text-emerald-700',
        'blocked' => 'bg-red-50 text-red-700',
    ];
    $renewalClasses = [
        'none' => 'bg-slate-100 text-slate-600',
        'watch' => 'bg-amber-50 text-amber-700',
        'high' => 'bg-emerald-50 text-emerald-700',
    ];
@endphp

<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.2em] text-cyan-600">CUSTOMER DELIVERY</div>
                <h1 class="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">客户项目</h1>
                <p class="mt-2 max-w-3xl text-sm leading-7 text-slate-500">把每个客户的官网、GEO后台、发布执行器、服务线和下一步动作放在同一个档案里，后续交付、复盘、续费都从这里进入。</p>
            </div>
            <form method="POST" action="{{ route('admin.customer-projects.current-site') }}">
                @csrf
                <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
                    <i data-lucide="file-plus-2" class="h-4 w-4"></i>
                    生成当前站点档案
                </button>
            </form>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-sm text-slate-500">项目总数</div>
            <div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['total'] }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-sm text-slate-500">交付中</div>
            <div class="mt-2 text-3xl font-black text-blue-600">{{ $stats['delivery'] }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-sm text-slate-500">持续运营</div>
            <div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['operations'] }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-sm text-slate-500">风险项目</div>
            <div class="mt-2 text-3xl font-black text-red-600">{{ $stats['risk'] }}</div>
        </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="space-y-4">
            <form method="GET" action="{{ route('admin.customer-projects.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">项目阶段</span>
                        <select name="stage" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部阶段</option>
                            @foreach($stageLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['stage'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">健康状态</span>
                        <select name="health_status" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部状态</option>
                            @foreach($healthLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['health_status'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <div class="flex items-end gap-2">
                        <button class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">
                            <i data-lucide="filter" class="h-4 w-4"></i>
                            筛选
                        </button>
                        <a href="{{ route('admin.customer-projects.index') }}" class="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">重置</a>
                    </div>
                </div>
            </form>

            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">项目档案</h2>
                    <p class="mt-1 text-sm text-slate-500">每个档案对应一个客户实例，包含官网、后台、AI抓取文件和交付状态。</p>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse($projects as $project)
                        @php
                            $lines = is_array($project->service_lines) ? $project->service_lines : [];
                            $healthClass = $healthClasses[$project->health_status] ?? 'bg-slate-100 text-slate-600';
                            $profile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
                            $checkedDelivery = is_array($profile['readiness'] ?? null) ? $profile['readiness'] : [];
                            $deliveryTotal = max(1, count($deliveryChecklist));
                            $deliveryDone = count(array_intersect(array_keys($deliveryChecklist), $checkedDelivery));
                            $deliveryPercent = (int) round($deliveryDone / $deliveryTotal * 100);
                            $acceptanceStatus = (string) ($profile['acceptance_status'] ?? 'pending');
                            $renewalSignal = (string) ($profile['renewal_signal'] ?? 'none');
                        @endphp
                        <a href="{{ route('admin.customer-projects.show', ['projectId' => $project->id]) }}" class="block px-5 py-5 hover:bg-slate-50">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{{ $stageLabels[$project->stage] ?? $project->stage }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $healthClass }}">{{ $healthLabels[$project->health_status] ?? $project->health_status }}</span>
                                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{{ $statusLabels[$project->status] ?? $project->status }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $acceptanceClasses[$acceptanceStatus] ?? 'bg-slate-100 text-slate-700' }}">{{ $acceptanceLabels[$acceptanceStatus] ?? '待验收' }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $renewalClasses[$renewalSignal] ?? 'bg-slate-100 text-slate-600' }}">{{ $renewalLabels[$renewalSignal] ?? '暂无信号' }}</span>
                                    </div>
                                    <h3 class="mt-3 truncate text-lg font-black text-slate-950">{{ $project->company_name }}</h3>
                                    <div class="mt-1 text-sm font-semibold text-slate-500">{{ $project->name }}</div>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        @forelse($lines as $line)
                                            <span class="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{{ $serviceLines[$line] ?? $line }}</span>
                                        @empty
                                            <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">未选择服务线</span>
                                        @endforelse
                                    </div>
                                    @if($project->next_action)
                                        <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{{ $project->next_action }}</p>
                                    @endif
                                    <div class="mt-4 max-w-xl">
                                        <div class="flex items-center justify-between text-xs font-bold">
                                            <span class="text-slate-500">交付进度</span>
                                            <span class="text-slate-700">{{ $deliveryDone }}/{{ $deliveryTotal }} · {{ $deliveryPercent }}%</span>
                                        </div>
                                        <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                            <div class="h-full rounded-full bg-blue-600" style="width: {{ $deliveryPercent }}%"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="shrink-0 text-sm text-slate-500 lg:w-64">
                                    <div class="flex items-center gap-2">
                                        <i data-lucide="user-round" class="h-4 w-4 text-slate-400"></i>
                                        <span class="truncate">{{ $project->contact_name ?: '未填写联系人' }}</span>
                                    </div>
                                    <div class="mt-2 flex items-center gap-2">
                                        <i data-lucide="globe-2" class="h-4 w-4 text-slate-400"></i>
                                        <span class="truncate">{{ $project->website_url ?: '未配置官网' }}</span>
                                    </div>
                                    <div class="mt-2 flex items-center gap-2">
                                        <i data-lucide="clock-3" class="h-4 w-4 text-slate-400"></i>
                                        <span>{{ $project->updated_at?->format('Y-m-d') ?? '--' }}</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    @empty
                        <div class="px-5 py-16 text-center">
                            <i data-lucide="folder-kanban" class="mx-auto h-9 w-9 text-slate-300"></i>
                            <div class="mt-3 font-black text-slate-900">还没有客户项目</div>
                            <p class="mt-1 text-sm text-slate-500">先创建当前站点档案，或者手工新增一个客户项目。</p>
                        </div>
                    @endforelse
                </div>
                @if($projects->hasPages())
                    <div class="border-t border-slate-100 px-5 py-4">{{ $projects->links() }}</div>
                @endif
            </div>
        </div>

        <aside class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:self-start">
            <h2 class="font-black text-slate-950">新增客户项目</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">用于新客户交付或内部样板站。公开官网不显示价格，项目合同和报价信息不放在这里。</p>
            <form method="POST" action="{{ route('admin.customer-projects.store') }}" class="mt-5 space-y-4">
                @csrf
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">项目名称</span>
                    <input name="name" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="120" required placeholder="例如：某某企业GEO增长交付">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">客户公司</span>
                    <input name="company_name" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="180" required placeholder="客户主体名称">
                </label>
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">项目状态</span>
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($statusLabels as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">健康状态</span>
                        <select name="health_status" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($healthLabels as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">项目阶段</span>
                    <select name="stage" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                        @foreach($stageLabels as $key => $label)
                            <option value="{{ $key }}">{{ $label }}</option>
                        @endforeach
                    </select>
                </label>
                <div>
                    <div class="text-xs font-bold text-slate-500">服务线</div>
                    <div class="mt-2 grid gap-2">
                        @foreach($serviceLines as $key => $label)
                            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                                <input type="checkbox" name="service_lines[]" value="{{ $key }}" class="rounded border-slate-300 text-blue-600">
                                {{ $label }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">联系人</span>
                        <input name="contact_name" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">联系方式</span>
                        <input name="contact_phone" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80">
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">下一步动作</span>
                    <textarea name="next_action" rows="4" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000" placeholder="写清楚下一次要推动什么。"></textarea>
                </label>
                <button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                    <i data-lucide="plus" class="h-4 w-4"></i>
                    保存项目
                </button>
            </form>
        </aside>
    </section>
</div>
@endsection
