@extends('admin.layouts.app')

@section('content')
@php
    // product_workbench: cms_console geo_growth distribution_publisher lead_customer_delivery ai_visibility_loop reusable_product_template
    $workbench = $workbench ?? [];
    $stats = $workbench['stats'] ?? ($stats ?? []);
    $toneClasses = [
        'blue' => ['icon' => 'bg-blue-50 text-blue-700', 'bar' => 'bg-blue-600', 'hover' => 'hover:border-blue-300'],
        'violet' => ['icon' => 'bg-violet-50 text-violet-700', 'bar' => 'bg-violet-600', 'hover' => 'hover:border-violet-300'],
        'emerald' => ['icon' => 'bg-emerald-50 text-emerald-700', 'bar' => 'bg-emerald-600', 'hover' => 'hover:border-emerald-300'],
        'cyan' => ['icon' => 'bg-cyan-50 text-cyan-700', 'bar' => 'bg-cyan-600', 'hover' => 'hover:border-cyan-300'],
        'rose' => ['icon' => 'bg-rose-50 text-rose-700', 'bar' => 'bg-rose-600', 'hover' => 'hover:border-rose-300'],
        'slate' => ['icon' => 'bg-slate-100 text-slate-700', 'bar' => 'bg-slate-900', 'hover' => 'hover:border-slate-400'],
    ];
    $healthLabels = ['ready' => '正常', 'watch' => '待完善', 'risk' => '需处理'];
    $healthClasses = ['ready' => 'bg-emerald-50 text-emerald-700', 'watch' => 'bg-amber-50 text-amber-700', 'risk' => 'bg-red-50 text-red-700'];
    $deliveryLabels = [
        'website_assets' => '官网资产',
        'geo_assets' => 'GEO资产',
        'publishing_assets' => '发布资产',
        'measurement_assets' => '度量资产',
    ];
    $maturityGate = $workbench['product_maturity_gate'] ?? [];
    $maturityStatus = (string) ($maturityGate['status'] ?? 'build_required');
    $maturityStatusLabels = ['sales_ready' => '可销售交付', 'implementation_ready' => '可实施试点', 'build_required' => '待补齐'];
    $maturityStatusClasses = ['sales_ready' => 'bg-emerald-50 text-emerald-700', 'implementation_ready' => 'bg-blue-50 text-blue-700', 'build_required' => 'bg-amber-50 text-amber-700'];
@endphp

<div class="mx-auto max-w-[1680px] space-y-6">
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="grid min-h-[300px] xl:grid-cols-[minmax(0,1fr)_460px]">
            <div class="bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10">
                <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black tracking-[0.18em] text-cyan-200">
                    TONGZHUO GEO GROWTH SUITE
                </div>
                <h1 class="mt-6 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                    桐灼 GEO 增长工作台
                </h1>
                <p class="mt-4 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
                    面向客户交付的统一后台：官网 CMS、事实底座、问题地图、证据型内容、多平台分发、AI 采样和线索归因在同一条链路里运转。每个客户实例都可以按这套模板复制、配置、上线和复盘。
                </p>
                <div class="mt-7 flex flex-wrap gap-3">
                    <a href="{{ route('admin.tongzhuo-cms.dashboard') }}" class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-50">
                        <i data-lucide="panels-top-left" class="h-4 w-4"></i>官网运营
                    </a>
                    <a href="{{ route('admin.geo-growth.index') }}" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                        <i data-lucide="sparkles" class="h-4 w-4"></i>GEO运营
                    </a>
                    <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                        <i data-lucide="send" class="h-4 w-4"></i>发布队列
                    </a>
                    <a href="{{ route('admin.analytics') }}" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                        <i data-lucide="chart-no-axes-combined" class="h-4 w-4"></i>增长归因
                    </a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-px bg-slate-200">
                <a href="{{ route('admin.fact-base.index') }}" class="bg-white p-6 hover:bg-slate-50">
                    <div class="text-sm font-bold text-slate-500">已确认事实</div>
                    <div class="mt-3 text-4xl font-black text-slate-950">{{ (int) ($stats['confirmed_facts'] ?? 0) }}</div>
                    <div class="mt-2 text-xs text-slate-500">事实准备度 {{ $stats['fact_readiness'] ?? 0 }}%</div>
                </a>
                <a href="{{ route('admin.geo-opportunities.index') }}" class="bg-white p-6 hover:bg-slate-50">
                    <div class="text-sm font-bold text-slate-500">问题覆盖</div>
                    <div class="mt-3 text-4xl font-black text-blue-700">{{ (int) ($stats['covered_opportunities'] ?? 0) }}</div>
                    <div class="mt-2 text-xs text-slate-500">覆盖率 {{ $stats['opportunity_coverage'] ?? 0 }}%</div>
                </a>
                <a href="{{ route('admin.articles.index') }}" class="bg-white p-6 hover:bg-slate-50">
                    <div class="text-sm font-bold text-slate-500">已发内容</div>
                    <div class="mt-3 text-4xl font-black text-emerald-700">{{ (int) ($stats['articles_published'] ?? 0) + (int) ($stats['faqs_published'] ?? 0) }}</div>
                    <div class="mt-2 text-xs text-slate-500">文章 + FAQ</div>
                </a>
                <a href="{{ route('admin.contact-leads.index') }}" class="bg-white p-6 hover:bg-slate-50">
                    <div class="text-sm font-bold text-slate-500">新增线索</div>
                    <div class="mt-3 text-4xl font-black text-rose-700">{{ (int) ($stats['leads_new'] ?? 0) }}</div>
                    <div class="mt-2 text-xs text-slate-500">总线索 {{ (int) ($stats['leads_total'] ?? 0) }}</div>
                </a>
            </div>
        </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        @foreach (($workbench['module_cards'] ?? []) as $card)
            @php
                $tone = $toneClasses[$card['tone'] ?? 'slate'] ?? $toneClasses['slate'];
                $health = $card['health'] ?? 'watch';
            @endphp
            <a href="{{ $card['href'] }}" class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition {{ $tone['hover'] }}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex min-w-0 gap-4">
                        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {{ $tone['icon'] }}">
                            <i data-lucide="{{ $card['icon'] }}" class="h-5 w-5"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="font-black text-slate-950">{{ $card['title'] }}</h2>
                                <span class="rounded-full px-2 py-0.5 text-[11px] font-bold {{ $healthClasses[$health] ?? $healthClasses['watch'] }}">{{ $healthLabels[$health] ?? '待完善' }}</span>
                            </div>
                            <p class="mt-1 text-sm leading-6 text-slate-500">{{ $card['subtitle'] }}</p>
                        </div>
                    </div>
                    <i data-lucide="arrow-up-right" class="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-700"></i>
                </div>
                <div class="mt-5 flex items-end justify-between gap-4">
                    <div>
                        <div class="text-3xl font-black text-slate-950">{{ $card['metric'] }}</div>
                        <div class="mt-1 text-xs font-bold text-slate-400">{{ $card['unit'] }}</div>
                    </div>
                    <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div class="h-full rounded-full {{ $tone['bar'] }}" style="width: {{ min(100, max(18, (int) ($card['metric'] ?? 0) * 10)) }}%"></div>
                    </div>
                </div>
            </a>
        @endforeach
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div class="text-xs font-black tracking-[0.18em] text-blue-600">GEO GROWTH LOOP</div>
                    <h2 class="mt-2 text-xl font-black text-slate-950">从事实到线索的交付链路</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-500">这条链路是产品复制给客户时的主流程，也是运营团队每天应该检查的顺序。</p>
                </div>
                <a href="{{ route('admin.analytics') }}" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    <i data-lucide="chart-no-axes-combined" class="h-4 w-4"></i>查看归因
                </a>
            </div>

            <div class="mt-6 grid gap-3 lg:grid-cols-6">
                @foreach (($workbench['growth_loop'] ?? []) as $index => $stage)
                    <a href="{{ $stage['href'] }}" class="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-blue-50 hover:border-blue-200">
                        <div class="flex items-center justify-between gap-2">
                            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">{{ $index + 1 }}</span>
                            <span class="text-xs font-bold text-slate-400">{{ $stage['rate'] }}%</span>
                        </div>
                        <div class="mt-4 font-black text-slate-950">{{ $stage['label'] }}</div>
                        <div class="mt-1 text-xs text-slate-500">{{ $stage['value'] }} / {{ $stage['target'] }}</div>
                        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                            <div class="h-full rounded-full bg-blue-600" style="width: {{ $stage['rate'] }}%"></div>
                        </div>
                    </a>
                @endforeach
            </div>
        </div>

        <aside class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <h2 class="font-black text-slate-950">下一步动作</h2>
                    <p class="mt-1 text-sm text-slate-500">按当前链路短板自动排序。</p>
                </div>
                <i data-lucide="list-checks" class="h-5 w-5 text-slate-400"></i>
            </div>
            <div class="mt-5 space-y-3">
                @foreach (($workbench['next_actions'] ?? []) as $action)
                    <a href="{{ $action['href'] }}" class="block rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/40">
                        <div class="flex gap-3">
                            <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <i data-lucide="{{ $action['icon'] }}" class="h-4 w-4"></i>
                            </div>
                            <div>
                                <div class="font-black text-slate-950">{{ $action['title'] }}</div>
                                <p class="mt-1 text-sm leading-6 text-slate-500">{{ $action['body'] }}</p>
                            </div>
                        </div>
                    </a>
                @endforeach
            </div>
        </aside>
    </section>

    <section class="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="font-black text-slate-950">客户交付成熟度</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">用于判断当前实例是否可以复制交付给客户。</p>
            <div class="mt-5 space-y-4">
                @foreach (($workbench['delivery_snapshot'] ?? []) as $key => $value)
                    <div>
                        <div class="flex items-center justify-between text-sm font-bold">
                            <span class="text-slate-700">{{ $deliveryLabels[$key] ?? $key }}</span>
                            <span class="text-slate-500">{{ $value }}%</span>
                        </div>
                        <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div class="h-full rounded-full bg-slate-950" style="width: {{ $value }}%"></div>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>

        <!-- product_maturity_gate: reusable_delivery_gate sales_ready implementation_ready operations_ready evidence_ready security_ready -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div class="text-xs font-black tracking-[0.18em] text-blue-600">PRODUCT MATURITY GATE</div>
                    <h2 class="mt-2 text-xl font-black text-slate-950">产品化交付门禁</h2>
                    <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">按可复制产品标准检查官网、GEO 方法、内容证据、发布执行、AI 采样、线索归因和安全边界。</p>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $maturityStatusClasses[$maturityStatus] ?? $maturityStatusClasses['build_required'] }}">{{ $maturityStatusLabels[$maturityStatus] ?? '待补齐' }}</span>
                    <div class="mt-3 text-4xl font-black text-slate-950">{{ (int) ($maturityGate['score'] ?? 0) }}</div>
                    <div class="text-xs font-bold text-slate-400">{{ (int) ($maturityGate['passed_count'] ?? 0) }} / {{ (int) ($maturityGate['total_count'] ?? 0) }} 项通过</div>
                </div>
            </div>

            <div class="mt-6 grid gap-3 lg:grid-cols-3">
                @foreach (($maturityGate['gates'] ?? []) as $gate)
                    @php($passed = (bool) ($gate['passed'] ?? false))
                    <a href="{{ $gate['href'] ?? '#' }}" class="rounded-xl border {{ $passed ? 'border-emerald-100 bg-emerald-50/40' : (($gate['critical'] ?? false) ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50') }} p-4 hover:bg-white">
                        <div class="flex items-start gap-3">
                            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {{ $passed ? 'bg-emerald-100 text-emerald-700' : (($gate['critical'] ?? false) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700') }}">
                                <i data-lucide="{{ $passed ? 'check' : 'alert-triangle' }}" class="h-4 w-4"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3 class="font-black text-slate-950">{{ $gate['title'] ?? '' }}</h3>
                                    @if(! $passed && ($gate['critical'] ?? false))
                                        <span class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">关键</span>
                                    @endif
                                </div>
                                <p class="mt-1 text-xs leading-5 text-slate-600">{{ $gate['action'] ?? '' }}</p>
                            </div>
                        </div>
                    </a>
                @endforeach
            </div>

            @if(count($maturityGate['recommended_sequence'] ?? []) > 0)
                <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="text-sm font-black text-slate-950">优先补齐顺序</div>
                    <div class="mt-3 grid gap-2 md:grid-cols-2">
                        @foreach (($maturityGate['recommended_sequence'] ?? []) as $index => $gate)
                            <a href="{{ $gate['href'] ?? '#' }}" class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:text-blue-700">
                                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-black text-white">{{ $index + 1 }}</span>
                                <span class="truncate">{{ $gate['title'] ?? '' }}</span>
                            </a>
                        @endforeach
                    </div>
                </div>
            @endif
        </div>

        <div class="grid gap-6 lg:grid-cols-2 xl:col-span-2">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">最近内容</h2>
                    <a href="{{ route('admin.articles.index') }}" class="text-sm font-bold text-blue-600">文章管理</a>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse ($recentArticles as $article)
                        <a href="{{ route('admin.articles.edit', ['articleId' => $article->id]) }}" class="block px-5 py-4 hover:bg-slate-50">
                            <div class="line-clamp-2 text-sm font-bold leading-6 text-slate-950">{{ $article->title }}</div>
                            <div class="mt-1 text-xs text-slate-400">{{ $article->status }} / {{ $article->updated_at?->format('Y-m-d H:i') }}</div>
                        </a>
                    @empty
                        <div class="px-5 py-12 text-sm text-slate-500">还没有内容，先从行业资讯创建第一篇证据型文章。</div>
                    @endforelse
                </div>
            </div>

            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">最近分发</h2>
                    <a href="{{ route('admin.distribution.jobs') }}" class="text-sm font-bold text-blue-600">分发队列</a>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse ($recentJobs as $job)
                        <a href="{{ route('admin.distribution.jobs', ['article_id' => $job->article_id]) }}" class="block px-5 py-4 hover:bg-slate-50">
                            <div class="line-clamp-2 text-sm font-bold leading-6 text-slate-950">{{ $job->article?->title ?? '未关联文章' }}</div>
                            <div class="mt-1 text-xs text-slate-400">{{ $job->channel?->name ?? '未关联渠道' }} / {{ $job->status }} / #{{ $job->id }}</div>
                        </a>
                    @empty
                        <div class="px-5 py-12 text-sm text-slate-500">还没有分发任务，文章发布后可以送入发布助手。</div>
                    @endforelse
                </div>
            </div>
        </div>
    </section>
</div>
@endsection
