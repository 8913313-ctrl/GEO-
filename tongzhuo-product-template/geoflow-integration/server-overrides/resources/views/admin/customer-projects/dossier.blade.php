@extends('admin.layouts.app')

@push('styles')
<style>
@media print {
    aside, header, .print-hidden, footer { display: none !important; }
    body { background: #fff !important; }
    main { padding: 0 !important; }
    .md\:pl-64 { padding-left: 0 !important; }
    .pt-14 { padding-top: 0 !important; }
    .dossier-page { box-shadow: none !important; border: 0 !important; }
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
    $readinessStatus = (string) ($deliveryReadiness['status'] ?? 'watch');
    $readinessStatusLabels = ['ready' => '可交付', 'watch' => '待完善', 'risk' => '有阻塞'];
    $readinessStatusClasses = ['ready' => 'bg-emerald-50 text-emerald-700', 'watch' => 'bg-amber-50 text-amber-700', 'risk' => 'bg-red-50 text-red-700'];
@endphp

<div class="mx-auto max-w-[1240px] space-y-5">
    <div class="print-hidden flex flex-wrap items-center justify-between gap-3">
        <a href="{{ route('admin.customer-projects.show', ['projectId' => $project->id]) }}" class="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
            返回项目详情
        </a>
        <a href="{{ route('admin.customer-projects.dossier.export', ['projectId' => $project->id]) }}" class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-blue-200 hover:text-blue-600">
            <i data-lucide="download" class="h-4 w-4"></i>
            下载档案 JSON
        </a>
        <button type="button" onclick="window.print()" class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
            <i data-lucide="printer" class="h-4 w-4"></i>
            打印 / 保存 PDF
        </button>
    </div>

    <!-- customer_project_dossier: maturity_gate delivery_tasks evidence_archive customer_handoff -->
    <article class="dossier-page rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <header class="border-b border-slate-200 pb-6">
            <div class="text-xs font-black tracking-[0.22em] text-blue-600">CUSTOMER PROJECT DOSSIER</div>
            <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 class="text-3xl font-black text-slate-950">{{ $project->company_name }}</h1>
                    <p class="mt-2 text-sm font-semibold text-slate-500">{{ $project->name }}</p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <div>档案日期：{{ now()->format('Y-m-d') }}</div>
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
                <div class="text-xs font-bold text-slate-500">交付进度</div>
                <div class="mt-2 text-sm font-black text-slate-950">{{ $deliveryDone }}/{{ $deliveryTotal }} 项，{{ $deliveryPercent }}%</div>
            </div>
            <div class="rounded-xl bg-blue-50 p-4">
                <div class="text-xs font-bold text-blue-700">成熟度</div>
                <div class="mt-2 flex items-center justify-between gap-3">
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $readinessStatusClasses[$readinessStatus] ?? $readinessStatusClasses['watch'] }}">{{ $readinessStatusLabels[$readinessStatus] ?? '待完善' }}</span>
                    <span class="text-3xl font-black text-blue-800">{{ (int) ($deliveryReadiness['score'] ?? 0) }}</span>
                </div>
            </div>
        </section>

        <!-- geoflow_backend_snapshot_panel: attached delivery_status delivery_score delivery_task_count checklist_count accepted_count source_file -->
        <section class="grid gap-4 border-t border-slate-200 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div class="text-xs font-black tracking-[0.22em] text-blue-600">GEOFLOW BACKEND SNAPSHOT</div>
                        <h2 class="mt-2 font-black text-slate-950">后台项目状态快照</h2>
                        <p class="mt-1 text-sm leading-6 text-slate-500">直接展示后台交付分、状态、任务数和归档边界，方便导出前先确认这份快照本身是否可用。</p>
                    </div>
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ ($backendSnapshotPreview['delivery_score'] ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700' }}">
                        {{ $backendSnapshotPreview['delivery_status'] ?? 'watch' }}
                    </span>
                </div>
                <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                        <div class="text-xs font-bold text-slate-500">交付分</div>
                        <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['delivery_score'] ?? 0) }}</div>
                    </div>
                    <div class="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                        <div class="text-xs font-bold text-slate-500">任务数</div>
                        <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['delivery_task_count'] ?? 0) }}</div>
                    </div>
                    <div class="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                        <div class="text-xs font-bold text-slate-500">清单完成</div>
                        <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['accepted_count'] ?? 0) }}/{{ (int) ($backendSnapshotPreview['checklist_count'] ?? 0) }}</div>
                    </div>
                    <div class="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                        <div class="text-xs font-bold text-slate-500">源码边界</div>
                        <div class="mt-2 text-sm font-black text-slate-950">{{ ($backendSnapshotPreview['contains_credentials'] ?? false) ? '需复查' : '已隔离' }}</div>
                        <div class="mt-1 text-xs text-slate-500">{{ $backendSnapshotPreview['source_file'] ?? '' }}</div>
                    </div>
                </div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-5">
                <div class="text-xs font-black tracking-[0.22em] text-blue-600">SNAPSHOT SUMMARY</div>
                <div class="mt-3 space-y-3 text-sm text-slate-600">
                    <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                        <span>项目名称</span>
                        <span class="font-black text-slate-950">{{ $backendSnapshotPreview['project_name'] ?? '' }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                        <span>公司</span>
                        <span class="font-black text-slate-950">{{ $backendSnapshotPreview['company_name'] ?? '' }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                        <span>服务线数量</span>
                        <span class="font-black text-slate-950">{{ (int) ($backendSnapshotPreview['service_line_count'] ?? 0) }}</span>
                    </div>
                </div>
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
                <h2 class="font-black text-slate-950">公开入口</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">官网</dt><dd class="break-all text-slate-800">{{ $endpoints['website'] ?? $project->website_url ?: '未配置' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">后台</dt><dd class="break-all text-slate-800">{{ $endpoints['admin'] ?? '未配置' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">llms.txt</dt><dd class="break-all text-slate-800">{{ $endpoints['llms'] ?? '未配置' }}</dd></div>
                </dl>
            </div>
        </section>

        <section class="border-t border-slate-200 py-6">
            <h2 class="font-black text-slate-950">交付任务板</h2>
            <div class="mt-4 grid gap-3 lg:grid-cols-2">
                @forelse ($deliveryTasks as $task)
                    <div class="rounded-xl border {{ ($task['blocking'] ?? false) ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40' }} p-4">
                        <div class="flex items-start justify-between gap-3">
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
                    <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">当前没有待补齐任务。</div>
                @endforelse
            </div>
        </section>

        <section class="grid gap-6 border-t border-slate-200 py-6 lg:grid-cols-2">
            <div>
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
            </div>
            <div>
                <h2 class="font-black text-slate-950">验收证据</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">验收人</dt><dd class="text-slate-800">{{ $profile['accepted_by'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">培训日期</dt><dd class="text-slate-800">{{ $profile['training_at'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">交付版本</dt><dd class="text-slate-800">{{ $profile['last_release_version'] ?? '未填写' }}</dd></div>
                    <div class="flex gap-3"><dt class="w-24 shrink-0 font-bold text-slate-500">证据链接</dt><dd class="break-all text-slate-800">{{ $profile['evidence_url'] ?? '未填写' }}</dd></div>
                </dl>
            </div>
        </section>
    </article>
</div>
@endsection
