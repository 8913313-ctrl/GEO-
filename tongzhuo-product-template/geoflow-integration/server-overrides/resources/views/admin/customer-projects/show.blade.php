@extends('admin.layouts.app')

@section('content')
@php
    $statusLabels = ['active' => '服务中', 'paused' => '已暂停', 'closed' => '已结束'];
    $healthClasses = [
        'normal' => 'bg-emerald-50 text-emerald-700',
        'watch' => 'bg-amber-50 text-amber-700',
        'risk' => 'bg-red-50 text-red-700',
    ];
    $selectedLines = is_array($project->service_lines) ? $project->service_lines : [];
    $endpoints = is_array($project->endpoints) ? $project->endpoints : [];
    $deliveryProfile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
    $checkedDelivery = is_array($deliveryProfile['readiness'] ?? null) ? $deliveryProfile['readiness'] : [];
    $deliveryTotal = max(1, count($deliveryChecklist));
    $deliveryDone = count(array_intersect(array_keys($deliveryChecklist), $checkedDelivery));
    $deliveryPercent = (int) round($deliveryDone / $deliveryTotal * 100);
    $acceptanceStatus = (string) ($deliveryProfile['acceptance_status'] ?? 'pending');
    $acceptanceClasses = [
        'pending' => 'bg-slate-100 text-slate-700',
        'passed' => 'bg-emerald-50 text-emerald-700',
        'blocked' => 'bg-red-50 text-red-700',
    ];
    $renewalSignal = (string) ($deliveryProfile['renewal_signal'] ?? 'none');
    $deliveryReadiness = $deliveryReadiness ?? [];
    $readinessStatus = (string) ($deliveryReadiness['status'] ?? 'watch');
    $readinessStatusLabels = ['ready' => '可交付', 'watch' => '待完善', 'risk' => '有阻塞'];
    $readinessStatusClasses = ['ready' => 'bg-emerald-50 text-emerald-700', 'watch' => 'bg-amber-50 text-amber-700', 'risk' => 'bg-red-50 text-red-700'];
    $deliveryTasks = $deliveryReadiness['delivery_tasks'] ?? [];
@endphp

<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0">
                <a href="{{ route('admin.customer-projects.index') }}" class="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
                    <i data-lucide="arrow-left" class="h-4 w-4"></i>
                    返回客户项目
                </a>
                <a href="{{ route('admin.customer-projects.handoff', ['projectId' => $project->id]) }}" class="ml-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700">
                    <i data-lucide="file-text" class="h-4 w-4"></i>
                    交付报告
                </a>
                <a href="{{ route('admin.customer-projects.dossier', ['projectId' => $project->id]) }}" class="ml-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700">
                    <i data-lucide="folder-open" class="h-4 w-4"></i>
                    椤圭洰妗ｆ
                </a>
                <div class="mt-4 flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{{ $stageLabels[$project->stage] ?? $project->stage }}</span>
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $healthClasses[$project->health_status] ?? 'bg-slate-100 text-slate-600' }}">{{ $healthLabels[$project->health_status] ?? $project->health_status }}</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{{ $statusLabels[$project->status] ?? $project->status }}</span>
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $acceptanceClasses[$acceptanceStatus] ?? 'bg-slate-100 text-slate-700' }}">{{ $acceptanceLabels[$acceptanceStatus] ?? '待验收' }}</span>
                </div>
                <h1 class="mt-3 break-words text-2xl font-black text-slate-950 sm:text-3xl">{{ $project->company_name }}</h1>
                <p class="mt-2 text-sm font-semibold text-slate-500">{{ $project->name }}</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:w-[540px]">
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">上线时间</div>
                    <div class="mt-2 text-sm font-black text-slate-950">{{ $project->go_live_at?->format('Y-m-d') ?? '未填写' }}</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">最近更新</div>
                    <div class="mt-2 text-sm font-black text-slate-950">{{ $project->last_reviewed_at?->format('Y-m-d H:i') ?? $project->updated_at?->format('Y-m-d H:i') }}</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">项目编号</div>
                    <div class="mt-2 text-sm font-black text-slate-950">#{{ $project->id }}</div>
                </div>
                <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div class="flex items-center justify-between text-xs font-bold text-blue-700">
                        <span>交付进度</span>
                        <span>{{ $deliveryPercent }}%</span>
                    </div>
                    <div class="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div class="h-full rounded-full bg-blue-600" style="width: {{ $deliveryPercent }}%"></div>
                    </div>
                    <div class="mt-2 text-xs font-bold text-blue-700">{{ $deliveryDone }}/{{ $deliveryTotal }} 项完成</div>
                </div>
            </div>
        </div>
    </section>

    <!-- customer_delivery_readiness_panel: reusable_customer_instance website_admin_endpoints ai_crawl_files fact_question_content_loop publishing_loop lead_capture acceptance_evidence security_boundary -->
    <section class="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-xs font-black tracking-[0.18em] text-blue-600">DELIVERY READINESS</div>
                    <h2 class="mt-2 font-black text-slate-950">交付健康检查</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-500">判断这个客户实例是否已经达到可复制交付标准。</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $readinessStatusClasses[$readinessStatus] ?? $readinessStatusClasses['watch'] }}">
                    {{ $readinessStatusLabels[$readinessStatus] ?? '待完善' }}
                </span>
            </div>
            <div class="mt-5 text-5xl font-black text-slate-950">{{ (int) ($deliveryReadiness['score'] ?? 0) }}</div>
            <div class="mt-2 text-xs font-bold text-slate-400">{{ (int) ($deliveryReadiness['passed_count'] ?? 0) }} / {{ (int) ($deliveryReadiness['total_count'] ?? 0) }} 项通过</div>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-blue-600" style="width: {{ (int) ($deliveryReadiness['score'] ?? 0) }}%"></div>
            </div>
            <a href="{{ route('admin.customer-projects.handoff', ['projectId' => $project->id]) }}" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
                <i data-lucide="file-text" class="h-4 w-4"></i>
                查看交付报告
            </a>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 class="font-black text-slate-950">标准交付项</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-500">系统自动检查官网、GEO、发布、线索、验收和安全边界。阻塞项会影响客户正式交付。</p>
                </div>
                <div class="text-xs font-bold text-slate-400">阻塞项 {{ count($deliveryReadiness['blocking_gaps'] ?? []) }}</div>
            </div>
            <div class="mt-5 grid gap-3 lg:grid-cols-2">
                @foreach (($deliveryReadiness['checks'] ?? []) as $check)
                    @php($passed = (bool) ($check['passed'] ?? false))
                    <a href="{{ $check['href'] ?? '#' }}" class="rounded-xl border {{ $passed ? 'border-emerald-100 bg-emerald-50/40' : (($check['blocking'] ?? false) ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50') }} p-4 hover:bg-white">
                        <div class="flex items-start gap-3">
                            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {{ $passed ? 'bg-emerald-100 text-emerald-700' : (($check['blocking'] ?? false) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700') }}">
                                <i data-lucide="{{ $passed ? 'check' : 'alert-triangle' }}" class="h-4 w-4"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3 class="font-black text-slate-950">{{ $check['label'] ?? '' }}</h3>
                                    @if(! $passed && ($check['blocking'] ?? false))
                                        <span class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">阻塞</span>
                                    @endif
                                </div>
                                <p class="mt-1 text-xs leading-5 text-slate-600">{{ $check['nextAction'] ?? '' }}</p>
                            </div>
                        </div>
                    </a>
                @endforeach
            </div>
        </div>
    </section>

    <!-- customer_delivery_task_board: owner deliverable acceptance_metric evidence_slot review_at -->
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.18em] text-blue-600">DELIVERY TASK BOARD</div>
                <h2 class="mt-2 font-black text-slate-950">交付补齐任务</h2>
                <p class="mt-1 text-sm leading-6 text-slate-500">把未通过的成熟度检查转成可执行任务，明确负责人、交付物、验收指标、证据归档位和复查日期。</p>
            </div>
            <div class="text-xs font-bold text-slate-400">{{ count($deliveryTasks) }} 项待处理</div>
        </div>

        <div class="mt-5 grid gap-3 xl:grid-cols-2">
            @forelse ($deliveryTasks as $task)
                <a href="{{ $task['href'] ?? '#' }}" class="rounded-xl border {{ ($task['blocking'] ?? false) ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50' }} p-4 hover:bg-white">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="font-black text-slate-950">{{ $task['title'] ?? '' }}</h3>
                                @if($task['blocking'] ?? false)
                                    <span class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">关键阻塞</span>
                                @endif
                            </div>
                            <p class="mt-1 text-xs leading-5 text-slate-600">{{ $task['next_action'] ?? '' }}</p>
                        </div>
                        <div class="shrink-0 rounded-lg bg-white px-3 py-2 text-right ring-1 ring-slate-200">
                            <div class="text-[11px] font-bold text-slate-400">复查日期</div>
                            <div class="mt-1 text-sm font-black text-slate-950">{{ $task['review_at'] ?? '' }}</div>
                        </div>
                    </div>
                    <div class="mt-4 grid gap-3 md:grid-cols-2">
                        <div class="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                            <div class="text-[11px] font-bold text-slate-400">负责人</div>
                            <div class="mt-1 text-sm font-black text-slate-800">{{ $task['owner'] ?? '' }}</div>
                        </div>
                        <div class="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                            <div class="text-[11px] font-bold text-slate-400">证据归档位</div>
                            <div class="mt-1 break-all text-sm font-black text-slate-800">{{ $task['evidence_slot'] ?? '' }}</div>
                        </div>
                        <div class="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                            <div class="text-[11px] font-bold text-slate-400">交付物</div>
                            <div class="mt-1 text-sm font-semibold leading-5 text-slate-700">{{ $task['deliverable'] ?? '' }}</div>
                        </div>
                        <div class="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                            <div class="text-[11px] font-bold text-slate-400">验收指标</div>
                            <div class="mt-1 text-sm font-semibold leading-5 text-slate-700">{{ $task['acceptance_metric'] ?? '' }}</div>
                        </div>
                    </div>
                </a>
            @empty
                <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
                    当前没有阻塞任务，可以进入正式交付、客户培训或阶段复盘。
                </div>
            @endforelse
        </div>
    </section>

    <!-- geoflow_backend_snapshot_panel: attached delivery_status delivery_score delivery_task_count checklist_count accepted_count source_file -->
    <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div class="text-xs font-black tracking-[0.18em] text-blue-600">GEOFLOW BACKEND SNAPSHOT</div>
                    <h2 class="mt-2 font-black text-slate-950">后端项目状态快照</h2>
                    <p class="mt-1 text-sm leading-6 text-slate-500">直接反映后台当前交付分、交付状态、任务数量和归档边界，方便运营和验收一起看。</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $backendSnapshotPreview['delivery_score'] >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700' }}">
                    {{ $backendSnapshotPreview['delivery_status'] ?? 'watch' }}
                </span>
            </div>
            <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-xl bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">交付分</div>
                    <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['delivery_score'] ?? 0) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">任务数</div>
                    <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['delivery_task_count'] ?? 0) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">清单完成</div>
                    <div class="mt-2 text-2xl font-black text-slate-950">{{ (int) ($backendSnapshotPreview['accepted_count'] ?? 0) }}/{{ (int) ($backendSnapshotPreview['checklist_count'] ?? 0) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4">
                    <div class="text-xs font-bold text-slate-500">源码边界</div>
                    <div class="mt-2 text-sm font-black text-slate-950">{{ ($backendSnapshotPreview['contains_credentials'] ?? false) ? '需复查' : '已隔离' }}</div>
                    <div class="mt-1 text-xs text-slate-500">{{ $backendSnapshotPreview['source_file'] ?? '' }}</div>
                </div>
            </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div class="text-xs font-black tracking-[0.18em] text-blue-600">SNAPSHOT SUMMARY</div>
            <div class="mt-3 space-y-3 text-sm text-slate-600">
                <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <span>项目名称</span>
                    <span class="font-black text-slate-950">{{ $backendSnapshotPreview['project_name'] ?? '' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <span>公司</span>
                    <span class="font-black text-slate-950">{{ $backendSnapshotPreview['company_name'] ?? '' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <span>服务线数量</span>
                    <span class="font-black text-slate-950">{{ (int) ($backendSnapshotPreview['service_line_count'] ?? 0) }}</span>
                </div>
            </div>
        </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form method="POST" action="{{ route('admin.customer-projects.update', ['projectId' => $project->id]) }}" class="space-y-5">
            @csrf
            @method('PUT')

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">基础资料</h2>
                    <p class="mt-1 text-sm text-slate-500">用于客户交付、运营跟进和后续复制部署。</p>
                </div>
                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">项目名称</span>
                        <input name="name" value="{{ old('name', $project->name) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="120" required>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">客户公司</span>
                        <input name="company_name" value="{{ old('company_name', $project->company_name) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="180" required>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">联系人</span>
                        <input name="contact_name" value="{{ old('contact_name', $project->contact_name) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">联系方式</span>
                        <input name="contact_phone" value="{{ old('contact_phone', $project->contact_phone) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80">
                    </label>
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">项目状态</h2>
                    <p class="mt-1 text-sm text-slate-500">让运营人员一眼知道这个客户现在处在什么阶段。</p>
                </div>
                <div class="mt-5 grid gap-4 md:grid-cols-3">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">项目状态</span>
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($statusLabels as $key => $label)
                                <option value="{{ $key }}" @selected(old('status', $project->status) === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">项目阶段</span>
                        <select name="stage" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($stageLabels as $key => $label)
                                <option value="{{ $key }}" @selected(old('stage', $project->stage) === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">健康状态</span>
                        <select name="health_status" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($healthLabels as $key => $label)
                                <option value="{{ $key }}" @selected(old('health_status', $project->health_status) === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <div class="mt-5">
                    <div class="text-xs font-bold text-slate-500">服务线</div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-3">
                        @foreach($serviceLines as $key => $label)
                            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                                <input type="checkbox" name="service_lines[]" value="{{ $key }}" class="rounded border-slate-300 text-blue-600" @checked(in_array($key, old('service_lines', $selectedLines), true))>
                                {{ $label }}
                            </label>
                        @endforeach
                    </div>
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">标准交付清单</h2>
                    <p class="mt-1 text-sm text-slate-500">这套清单用于复制交付，每个客户上线前都按同一套标准检查。</p>
                </div>
                <div class="mt-5 grid gap-3 lg:grid-cols-2">
                    @foreach($deliveryChecklist as $key => $item)
                        <label class="flex gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/40">
                            <input type="checkbox" name="delivery_profile[readiness][]" value="{{ $key }}" class="mt-1 rounded border-slate-300 text-blue-600" @checked(in_array($key, old('delivery_profile.readiness', $checkedDelivery), true))>
                            <span>
                                <span class="block text-sm font-black text-slate-950">{{ $item['label'] }}</span>
                                <span class="mt-1 block text-xs leading-5 text-slate-500">{{ $item['description'] }}</span>
                            </span>
                        </label>
                    @endforeach
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">验收证据</h2>
                    <p class="mt-1 text-sm text-slate-500">记录客户上线、培训、版本交付和验收证据，后续复盘和续费都能追溯。</p>
                </div>
                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">验收状态</span>
                        <select name="delivery_profile[acceptance_status]" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            @foreach($acceptanceLabels as $key => $label)
                                <option value="{{ $key }}" @selected(old('delivery_profile.acceptance_status', $acceptanceStatus) === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">验收人</span>
                        <input name="delivery_profile[accepted_by]" value="{{ old('delivery_profile.accepted_by', $deliveryProfile['accepted_by'] ?? '') }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80" placeholder="客户或内部验收人">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">培训日期</span>
                        <input name="delivery_profile[training_at]" type="date" value="{{ old('delivery_profile.training_at', $deliveryProfile['training_at'] ?? '') }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">交付版本</span>
                        <input name="delivery_profile[last_release_version]" value="{{ old('delivery_profile.last_release_version', $deliveryProfile['last_release_version'] ?? '') }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="80" placeholder="例如 v1.2.0">
                    </label>
                    <label class="block lg:col-span-2">
                        <span class="text-xs font-bold text-slate-500">证据链接</span>
                        <input name="delivery_profile[evidence_url]" value="{{ old('delivery_profile.evidence_url', $deliveryProfile['evidence_url'] ?? '') }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="500" placeholder="验收文档、截图目录、录屏或交付包链接">
                    </label>
                    <label class="block lg:col-span-2">
                        <span class="text-xs font-bold text-slate-500">复盘备注</span>
                        <textarea name="delivery_profile[review_notes]" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="3000" placeholder="记录客户反馈、待优化事项、续费机会和版本升级注意点。">{{ old('delivery_profile.review_notes', $deliveryProfile['review_notes'] ?? '') }}</textarea>
                    </label>
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">持续运营记录</h2>
                    <p class="mt-1 text-sm text-slate-500">记录版本升级、客户复盘、运营反馈和续费跟进动作，让项目能长期运营。</p>
                </div>
                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">最近复盘日期</span>
                        <input name="delivery_profile[success_review_at]" type="date" value="{{ old('delivery_profile.success_review_at', $deliveryProfile['success_review_at'] ?? '') }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">续费信号</span>
                        <select name="delivery_profile[renewal_signal]" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            @foreach($renewalLabels as $key => $label)
                                <option value="{{ $key }}" @selected(old('delivery_profile.renewal_signal', $renewalSignal) === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block lg:col-span-2">
                        <span class="text-xs font-bold text-slate-500">版本升级记录</span>
                        <textarea name="delivery_profile[upgrade_history]" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="5000" placeholder="按时间记录：升级版本、变更内容、影响范围、回滚说明。">{{ old('delivery_profile.upgrade_history', $deliveryProfile['upgrade_history'] ?? '') }}</textarea>
                    </label>
                    <label class="block lg:col-span-2">
                        <span class="text-xs font-bold text-slate-500">客户复盘摘要</span>
                        <textarea name="delivery_profile[success_review_summary]" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="3000" placeholder="记录内容发布、AI可见性、线索、平台分发、客户反馈和下月重点。">{{ old('delivery_profile.success_review_summary', $deliveryProfile['success_review_summary'] ?? '') }}</textarea>
                    </label>
                    <label class="block lg:col-span-2">
                        <span class="text-xs font-bold text-slate-500">续费跟进动作</span>
                        <textarea name="delivery_profile[renewal_next_action]" rows="4" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="1500" placeholder="下一次跟进对象、时间、要展示的数据或需要补齐的交付项。">{{ old('delivery_profile.renewal_next_action', $deliveryProfile['renewal_next_action'] ?? '') }}</textarea>
                    </label>
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">上线端点</h2>
                    <p class="mt-1 text-sm text-slate-500">官网、后台和AI抓取文件需要能被快速定位。</p>
                </div>
                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">官网地址</span>
                        <input name="website_url" value="{{ old('website_url', $project->website_url) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="500" placeholder="https://www.example.com">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">GEOFlow后台地址</span>
                        <input name="geoflow_url" value="{{ old('geoflow_url', $project->geoflow_url) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="500" placeholder="https://work.example.com">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">合同开始日期</span>
                        <input name="contract_started_at" type="date" value="{{ old('contract_started_at', $project->contract_started_at?->format('Y-m-d')) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">上线日期</span>
                        <input name="go_live_at" type="date" value="{{ old('go_live_at', $project->go_live_at?->format('Y-m-d')) }}" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                    </label>
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="border-b border-slate-100 pb-4">
                    <h2 class="font-black text-slate-950">运营记录</h2>
                    <p class="mt-1 text-sm text-slate-500">记录下一步动作和交付备注，不写价格、不放第三方账号密码。</p>
                </div>
                <div class="mt-5 grid gap-4">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">下一步动作</span>
                        <textarea name="next_action" rows="4" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000">{{ old('next_action', $project->next_action) }}</textarea>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">交付备注</span>
                        <textarea name="notes" rows="6" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="5000">{{ old('notes', $project->notes) }}</textarea>
                    </label>
                </div>
            </section>

            <div class="sticky bottom-4 z-10 flex justify-end">
                <button class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
                    <i data-lucide="save" class="h-4 w-4"></i>
                    保存项目档案
                </button>
            </div>
        </form>

        <aside class="space-y-5">
            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-black text-slate-950">交付入口</h2>
                <div class="mt-4 space-y-3">
                    @foreach(['website' => '官网', 'admin' => '后台', 'llms' => 'llms.txt'] as $key => $label)
                        @php($url = $endpoints[$key] ?? null)
                        @if($url)
                            <a href="{{ $url }}" target="_blank" rel="noreferrer" class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                                <span class="min-w-0 truncate">{{ $label }}</span>
                                <i data-lucide="external-link" class="h-4 w-4 shrink-0"></i>
                            </a>
                        @else
                            <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-400">
                                <span>{{ $label }}</span>
                                <span class="text-xs">未配置</span>
                            </div>
                        @endif
                    @endforeach
                </div>
            </section>

            <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-black text-slate-950">运营闭环</h2>
                <div class="mt-4 space-y-2">
                    <a href="{{ route('admin.tongzhuo-cms.dashboard') }}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="panels-top-left" class="h-4 w-4 text-slate-400"></i>官网CMS</a>
                    <a href="{{ route('admin.geo-growth.index') }}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="sparkles" class="h-4 w-4 text-slate-400"></i>GEO工作台</a>
                    <a href="{{ route('admin.articles.index') }}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="newspaper" class="h-4 w-4 text-slate-400"></i>行业资讯</a>
                    <a href="{{ route('admin.distribution.jobs') }}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="send" class="h-4 w-4 text-slate-400"></i>分发队列</a>
                    <a href="{{ route('admin.contact-leads.index') }}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="message-square-more" class="h-4 w-4 text-slate-400"></i>客户线索</a>
                </div>
            </section>

            <section class="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div class="flex gap-3">
                    <i data-lucide="shield-alert" class="mt-0.5 h-5 w-5 shrink-0 text-amber-600"></i>
                    <div>
                        <h2 class="font-black text-amber-950">交付纪律</h2>
                        <p class="mt-1 text-sm leading-6 text-amber-800">这里不保存第三方平台账号、密码、Cookie、报价和合同金额。发布平台登录态仍然留在客户授权的发布执行器里。</p>
                    </div>
                </div>
            </section>
        </aside>
    </section>
</div>
@endsection
