@extends('admin.layouts.app')

@push('styles')
<style>
@media print {
    aside, header, .print-hidden, footer { display: none !important; }
    body { background: #fff !important; }
    main { padding: 0 !important; }
    .md\:pl-64 { padding-left: 0 !important; }
    .pt-14 { padding-top: 0 !important; }
    .report-page { box-shadow: none !important; border: 0 !important; }
}
</style>
@endpush

@section('content')
@php
    $profile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
    $checkedDelivery = is_array($profile['readiness'] ?? null) ? $profile['readiness'] : [];
    $deliveryTotal = max(1, count($deliveryChecklist));
    $deliveryDone = count(array_intersect(array_keys($deliveryChecklist), $checkedDelivery));
    $deliveryPercent = (int) round($deliveryDone / $deliveryTotal * 100);
    $serviceLineNames = collect(is_array($project->service_lines) ? $project->service_lines : [])
        ->map(fn ($line) => $serviceLines[$line] ?? $line)
        ->filter()
        ->values();
    $endpoints = is_array($project->endpoints) ? $project->endpoints : [];
    $acceptanceStatus = (string) ($profile['acceptance_status'] ?? 'pending');
    $renewalSignal = (string) ($profile['renewal_signal'] ?? 'none');
    $deliveryReadiness = $deliveryReadiness ?? [];
    $deliveryTasks = $deliveryReadiness['delivery_tasks'] ?? [];
@endphp

<div class="mx-auto max-w-[1120px] space-y-5">
    <div class="print-hidden flex flex-wrap items-center justify-between gap-3">
        <a href="{{ route('admin.customer-projects.show', ['projectId' => $project->id]) }}" class="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
            返回项目档案
        </a>
        <button type="button" onclick="window.print()" class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
            <i data-lucide="printer" class="h-4 w-4"></i>
            打印/保存PDF
        </button>
    </div>

    <article class="report-page rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <header class="border-b border-slate-200 pb-6">
            <div class="text-xs font-black tracking-[0.22em] text-blue-600">CUSTOMER HANDOFF REPORT</div>
            <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 class="text-3xl font-black text-slate-950">{{ $project->company_name }}</h1>
                    <p class="mt-2 text-sm font-semibold text-slate-500">{{ $project->name }}</p>
                </div>
                <div class="text-sm text-slate-500">
                    <div>报告日期：{{ now()->format('Y-m-d') }}</div>
                    <div>项目编号：#{{ $project->id }}</div>
                </div>
            </div>
        </header>

        <section class="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl bg-slate-50 p-4">
                <div class="text-xs font-bold text-slate-500">项目阶段</div>
                <div class="mt-2 text-sm font-black text-slate-950">{{ $stageLabels[$project->stage] ?? $project->stage }}</div>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
                <div class="text-xs font-bold text-slate-500">健康状态</div>
                <div class="mt-2 text-sm font-black text-slate-950">{{ $healthLabels[$project->health_status] ?? $project->health_status }}</div>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
                <div class="text-xs font-bold text-slate-500">验收状态</div>
                <div class="mt-2 text-sm font-black text-slate-950">{{ $acceptanceLabels[$acceptanceStatus] ?? '待验收' }}</div>
            </div>
            <div class="rounded-xl bg-blue-50 p-4">
                <div class="text-xs font-bold text-blue-700">交付进度</div>
                <div class="mt-2 text-sm font-black text-blue-800">{{ $deliveryDone }}/{{ $deliveryTotal }} 项 · {{ $deliveryPercent }}%</div>
            </div>
        </section>

        <section class="grid gap-6 border-t border-slate-200 py-6 lg:grid-cols-2">
            <div>
                <h2 class="font-black text-slate-950">客户与服务</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">联系人</dt><dd class="text-slate-800">{{ $project->contact_name ?: '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">联系方式</dt><dd class="text-slate-800">{{ $project->contact_phone ?: '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">服务线</dt><dd class="text-slate-800">{{ $serviceLineNames->isNotEmpty() ? $serviceLineNames->implode('、') : '未选择' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">上线日期</dt><dd class="text-slate-800">{{ $project->go_live_at?->format('Y-m-d') ?? '未填写' }}</dd></div>
                </dl>
            </div>
            <div>
                <h2 class="font-black text-slate-950">上线入口</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">官网</dt><dd class="break-all text-slate-800">{{ $endpoints['website'] ?? $project->website_url ?: '未配置' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">后台</dt><dd class="break-all text-slate-800">{{ $endpoints['admin'] ?? '未配置' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">llms.txt</dt><dd class="break-all text-slate-800">{{ $endpoints['llms'] ?? '未配置' }}</dd></div>
                </dl>
            </div>
        </section>

        <section class="border-t border-slate-200 py-6">
            <h2 class="font-black text-slate-950">标准交付清单</h2>
            <div class="mt-4 grid gap-3 lg:grid-cols-2">
                @foreach($deliveryChecklist as $key => $item)
                    @php($done = in_array($key, $checkedDelivery, true))
                    <div class="rounded-xl border {{ $done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white' }} p-4">
                        <div class="flex items-start gap-3">
                            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full {{ $done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500' }}">
                                <i data-lucide="{{ $done ? 'check' : 'minus' }}" class="h-3.5 w-3.5"></i>
                            </span>
                            <div>
                                <div class="text-sm font-black text-slate-950">{{ $item['label'] }}</div>
                                <p class="mt-1 text-xs leading-5 text-slate-500">{{ $item['description'] }}</p>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        </section>

        <!-- customer_handoff_task_board: owner deliverable acceptance_metric evidence_slot review_at -->
        <section class="border-t border-slate-200 py-6">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 class="font-black text-slate-950">交付补齐任务</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-500">以下任务来自系统成熟度检查，用于客户验收、内部交接和后续复盘。</p>
                </div>
                <div class="text-xs font-bold text-slate-400">{{ count($deliveryTasks) }} 项待处理</div>
            </div>
            <div class="mt-4 space-y-3">
                @forelse ($deliveryTasks as $task)
                    <div class="rounded-xl border {{ ($task['blocking'] ?? false) ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40' }} p-4">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3 class="text-sm font-black text-slate-950">{{ $task['title'] ?? '' }}</h3>
                                    @if($task['blocking'] ?? false)
                                        <span class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">关键阻塞</span>
                                    @endif
                                </div>
                                <p class="mt-1 text-xs leading-5 text-slate-600">{{ $task['next_action'] ?? '' }}</p>
                            </div>
                            <div class="shrink-0 text-xs font-bold text-slate-500">复查：{{ $task['review_at'] ?? '' }}</div>
                        </div>
                        <dl class="mt-4 grid gap-3 text-xs md:grid-cols-2">
                            <div class="rounded-lg bg-white p-3"><dt class="font-bold text-slate-500">负责人</dt><dd class="mt-1 font-black text-slate-800">{{ $task['owner'] ?? '' }}</dd></div>
                            <div class="rounded-lg bg-white p-3"><dt class="font-bold text-slate-500">证据归档位</dt><dd class="mt-1 break-all font-black text-slate-800">{{ $task['evidence_slot'] ?? '' }}</dd></div>
                            <div class="rounded-lg bg-white p-3"><dt class="font-bold text-slate-500">交付物</dt><dd class="mt-1 leading-5 text-slate-700">{{ $task['deliverable'] ?? '' }}</dd></div>
                            <div class="rounded-lg bg-white p-3"><dt class="font-bold text-slate-500">验收指标</dt><dd class="mt-1 leading-5 text-slate-700">{{ $task['acceptance_metric'] ?? '' }}</dd></div>
                        </dl>
                    </div>
                @empty
                    <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                        当前没有待补齐任务，可进入正式验收、培训或阶段复盘。
                    </div>
                @endforelse
            </div>
        </section>

        <section class="grid gap-6 border-t border-slate-200 py-6 lg:grid-cols-2">
            <div>
                <h2 class="font-black text-slate-950">验收证据</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">验收人</dt><dd class="text-slate-800">{{ $profile['accepted_by'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">培训日期</dt><dd class="text-slate-800">{{ $profile['training_at'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">交付版本</dt><dd class="text-slate-800">{{ $profile['last_release_version'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">证据链接</dt><dd class="break-all text-slate-800">{{ $profile['evidence_url'] ?? '未填写' }}</dd></div>
                </dl>
            </div>
            <div>
                <h2 class="font-black text-slate-950">持续运营</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">复盘日期</dt><dd class="text-slate-800">{{ $profile['success_review_at'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">续费信号</dt><dd class="text-slate-800">{{ $renewalLabels[$renewalSignal] ?? '暂无信号' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">跟进动作</dt><dd class="whitespace-pre-line text-slate-800">{{ $profile['renewal_next_action'] ?? '未填写' }}</dd></div>
                </dl>
            </div>
        </section>

        <section class="grid gap-6 border-t border-slate-200 py-6 lg:grid-cols-2">
            <div>
                <h2 class="font-black text-slate-950">版本升级记录</h2>
                <p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{{ $profile['upgrade_history'] ?? '暂无记录' }}</p>
            </div>
            <div>
                <h2 class="font-black text-slate-950">客户复盘摘要</h2>
                <p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{{ $profile['success_review_summary'] ?? '暂无记录' }}</p>
            </div>
        </section>

        <section class="border-t border-slate-200 pt-6">
            <h2 class="font-black text-slate-950">下一步动作</h2>
            <p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{{ $project->next_action ?: '暂无记录' }}</p>
            <h2 class="mt-6 font-black text-slate-950">交付备注</h2>
            <p class="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{{ $project->notes ?: '暂无记录' }}</p>
        </section>
    </article>
</div>
@endsection
