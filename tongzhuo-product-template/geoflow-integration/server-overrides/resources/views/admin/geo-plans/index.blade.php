@extends('admin.layouts.app')

@section('content')
<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.2em] text-indigo-600">GEO ACTION PLAN</div>
                <h1 class="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">行动方案</h1>
                <p class="mt-2 max-w-3xl text-sm leading-7 text-slate-500">把诊断任务、问题机会、内容生产和分发节奏整理成可执行的30/60/90天计划。现在使用本地规则生成，后续可接入GEORank方案引擎。</p>
            </div>
            <form method="POST" action="{{ route('admin.geo-plans.store') }}" class="grid w-full gap-2 sm:grid-cols-[1fr_150px_auto] xl:max-w-2xl">
                @csrf
                <input name="title" class="rounded-lg border-slate-200 text-sm" maxlength="180" placeholder="方案标题，可留空自动生成">
                <input name="start_date" type="date" class="rounded-lg border-slate-200 text-sm" value="{{ now()->format('Y-m-d') }}">
                <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
                    <i data-lucide="calendar-plus" class="h-4 w-4"></i>
                    生成方案
                </button>
            </form>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">方案总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['plans'] }}</div></div>
        <a href="{{ route('admin.geo-growth.index') }}#tasks" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-300"><div class="text-sm text-slate-500">待处理GEO任务</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $stats['open_tasks'] }}</div></a>
        <a href="{{ route('admin.geo-opportunities.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300"><div class="text-sm text-slate-500">待规划问题机会</div><div class="mt-2 text-3xl font-black text-indigo-600">{{ $stats['new_opportunities'] }}</div></a>
    </section>

    @if($latestPlan)
        <section class="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div class="text-xs font-black tracking-[0.18em] text-indigo-600">LATEST PLAN</div>
                    <h2 class="mt-1 text-xl font-black text-slate-950">{{ $latestPlan->title }}</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-600">{{ $latestPlan->summary }}</p>
                </div>
                <a href="{{ route('admin.geo-plans.show', ['planId' => $latestPlan->id]) }}" class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700">
                    <i data-lucide="arrow-up-right" class="h-4 w-4"></i>
                    查看执行清单
                </a>
            </div>
        </section>
    @endif

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-5 py-4">
            <h2 class="font-black text-slate-950">历史方案</h2>
            <p class="mt-1 text-sm text-slate-500">每次生成方案都会保留一份快照，便于客户交付、复盘和续费沟通。</p>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse($plans as $plan)
                <a href="{{ route('admin.geo-plans.show', ['planId' => $plan->id]) }}" class="flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between">
                    <div class="min-w-0">
                        <div class="truncate font-black text-slate-950">{{ $plan->title }}</div>
                        <div class="mt-1 text-xs text-slate-500">{{ $plan->start_date?->format('Y-m-d') ?? '--' }} 至 {{ $plan->end_date?->format('Y-m-d') ?? '--' }} · {{ $plan->items_count }} 个事项 · {{ $plan->source === 'local' ? '本地规则' : 'GEORank引擎' }}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{{ $plan->status === 'active' ? '执行中' : $plan->status }}</span>
                        <i data-lucide="chevron-right" class="h-4 w-4 text-slate-400"></i>
                    </div>
                </a>
            @empty
                <div class="px-5 py-16 text-center">
                    <i data-lucide="calendar-range" class="mx-auto h-8 w-8 text-slate-300"></i>
                    <div class="mt-3 font-black text-slate-900">还没有行动方案</div>
                    <p class="mt-1 text-sm text-slate-500">先生成一份90天计划，把任务和问题机会排进执行节奏。</p>
                </div>
            @endforelse
        </div>
        @if($plans->hasPages())
            <div class="border-t border-slate-100 px-5 py-4">{{ $plans->links() }}</div>
        @endif
    </section>
</div>
@endsection
