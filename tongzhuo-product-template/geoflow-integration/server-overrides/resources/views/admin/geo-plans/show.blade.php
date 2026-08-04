@extends('admin.layouts.app')

@section('content')
@php
    $statusLabels = ['todo' => '待办', 'doing' => '处理中', 'done' => '已完成', 'skipped' => '已跳过'];
    $priorityLabels = ['high' => '高', 'medium' => '中', 'low' => '低'];
    $groupedItems = $plan->items->groupBy('phase');
@endphp

<div class="mx-auto max-w-[1600px] space-y-5">
    {{-- evidence_bound_plan: evidence_source current_question owner deliverable acceptance_metric resample_date --}}
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <a href="{{ route('admin.geo-plans.index') }}" class="text-sm font-bold text-blue-600 hover:underline">← 返回行动方案</a>
            <h1 class="mt-2 text-2xl font-black text-slate-950">{{ $plan->title }}</h1>
            <p class="mt-1 text-sm leading-6 text-slate-500">{{ $plan->summary }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            {{ $plan->start_date?->format('Y-m-d') ?? '--' }} 至 {{ $plan->end_date?->format('Y-m-d') ?? '--' }}
        </div>
    </div>

    <section class="grid gap-3 sm:grid-cols-5">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">事项总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $plan->items->count() }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">处理中</div><div class="mt-2 text-3xl font-black text-blue-600">{{ $plan->items->where('status', 'doing')->count() }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">已完成</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $plan->items->where('status', 'done')->count() }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">高优先级</div><div class="mt-2 text-3xl font-black text-red-600">{{ $plan->items->where('priority', 'high')->count() }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">待复采</div><div class="mt-2 text-3xl font-black text-cyan-600">{{ $plan->items->filter(fn($item) => $item->resample_date && $item->status !== 'done')->count() }}</div></div>
    </section>

    <div class="grid gap-5 xl:grid-cols-3">
        @foreach($phaseLabels as $phase => $phaseLabel)
            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">{{ $phaseLabel }}</h2>
                    <p class="mt-1 text-sm text-slate-500">{{ ($groupedItems[$phase] ?? collect())->count() }} 个执行事项</p>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse(($groupedItems[$phase] ?? collect()) as $item)
                        <article class="px-5 py-4">
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-md px-2 py-1 text-[11px] font-black {{ $item->priority === 'high' ? 'bg-red-50 text-red-700' : ($item->priority === 'low' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700') }}">{{ $priorityLabels[$item->priority] ?? $item->priority }}</span>
                                <div class="min-w-0 flex-1">
                                    <h3 class="font-black leading-6 text-slate-950">{{ $item->title }}</h3>
                                    @if($item->description)
                                        <p class="mt-2 text-sm leading-6 text-slate-600">{{ $item->description }}</p>
                                    @endif
                                    <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                        <div class="grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-2">
                                            <div>
                                                <div class="font-black text-slate-900">证据来源</div>
                                                <div>{{ $item->evidence_source ?: '未记录' }}</div>
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">当前问题</div>
                                                <div>{{ $item->current_question ?: $item->title }}</div>
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">负责人</div>
                                                <div>{{ $item->owner_name ?: 'GEO运营' }}</div>
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">复采日期</div>
                                                <div>{{ $item->resample_date?->format('Y-m-d') ?? '未安排' }}</div>
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">交付物</div>
                                                <div>{{ $item->deliverable ?: $item->expected_output ?: 'GEO运营资产' }}</div>
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">验收指标</div>
                                                <div>{{ $item->acceptance_metric ?: '完成交付物并记录结果。' }}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-3 flex flex-wrap gap-1.5">
                                        <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{{ $workstreamLabels[$item->workstream] ?? $item->workstream }}</span>
                                        @if($item->expected_output)
                                            <span class="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{{ $item->expected_output }}</span>
                                        @endif
                                        @if($item->task_id)
                                            <span class="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">任务 #{{ $item->task_id }}</span>
                                        @endif
                                        @if($item->opportunity_id)
                                            <span class="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">机会 #{{ $item->opportunity_id }}</span>
                                        @endif
                                    </div>
                                    <form method="POST" action="{{ route('admin.geo-plans.items.status', ['itemId' => $item->id]) }}" class="mt-3">
                                        @csrf
                                        <select name="status" onchange="this.form.submit()" class="rounded-md border-slate-200 py-1.5 text-xs">
                                            @foreach($statusLabels as $key => $label)
                                                <option value="{{ $key }}" @selected($item->status === $key)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                    </form>
                                </div>
                            </div>
                        </article>
                    @empty
                        <div class="px-5 py-12 text-center text-sm text-slate-500">这个阶段暂无事项。</div>
                    @endforelse
                </div>
            </section>
        @endforeach
    </div>
</div>
@endsection
