@extends('admin.layouts.app')

@section('content')
@php
    $deliveryPipeline = [
        ['label' => '官网承载', 'value' => (int) ($stats['published_pages'] ?? 0), 'sub' => '页面 '.$stats['cms_pages'], 'icon' => 'panels-top-left', 'href' => route('admin.tongzhuo-cms.pages.index'), 'tone' => 'bg-blue-50 text-blue-700 ring-blue-100'],
        ['label' => 'GEO诊断', 'value' => (int) ($stats['audits'] ?? 0), 'sub' => '待处理 '.$stats['open_tasks'], 'icon' => 'scan-search', 'href' => '#audits', 'tone' => 'bg-cyan-50 text-cyan-700 ring-cyan-100'],
        ['label' => '问题机会', 'value' => (int) ($stats['opportunities'] ?? 0), 'sub' => 'AI问答缺口 '.$stats['answer_gaps'], 'icon' => 'radar', 'href' => route('admin.geo-opportunities.index'), 'tone' => 'bg-indigo-50 text-indigo-700 ring-indigo-100'],
        ['label' => '内容生产', 'value' => (int) ($stats['published_articles'] ?? 0), 'sub' => '草稿 '.$stats['draft_articles'], 'icon' => 'newspaper', 'href' => route('admin.articles.index'), 'tone' => 'bg-emerald-50 text-emerald-700 ring-emerald-100'],
        ['label' => '问题地图', 'value' => (int) ($stats['faqs'] ?? 0), 'sub' => '草稿 '.$stats['draft_faqs'], 'icon' => 'circle-help', 'href' => route('admin.tongzhuo-cms.faqs.index'), 'tone' => 'bg-teal-50 text-teal-700 ring-teal-100'],
        ['label' => '平台分发', 'value' => (int) ($stats['queued_jobs'] ?? 0), 'sub' => '失败 '.$stats['failed_jobs'].' · 渠道 '.$stats['channels_active'], 'icon' => 'send', 'href' => route('admin.distribution.jobs'), 'tone' => 'bg-violet-50 text-violet-700 ring-violet-100'],
        ['label' => '线索回收', 'value' => (int) ($stats['new_leads'] ?? 0), 'sub' => '累计 '.$stats['leads'], 'icon' => 'message-square-more', 'href' => route('admin.contact-leads.index'), 'tone' => 'bg-rose-50 text-rose-700 ring-rose-100'],
        ['label' => '客户交付', 'value' => (int) ($stats['customer_projects'] ?? 0), 'sub' => '风险 '.$stats['risk_projects'].' · 在线设备 '.$stats['devices_online'], 'icon' => 'folder-kanban', 'href' => route('admin.customer-projects.index'), 'tone' => 'bg-amber-50 text-amber-700 ring-amber-100'],
    ];
@endphp

<!-- geo_growth_workspace: workflow_stage_board operator_action_queue audit_to_content_loop distribution_feedback customer_delivery_loop georank_engine_status -->
<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.2em] text-cyan-300">GEO GROWTH WORKSPACE</div>
                <h1 class="mt-3 text-3xl font-black tracking-tight sm:text-4xl">从诊断到内容执行</h1>
                <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-300">先识别官网和AI可读性问题，再把问题转成可执行任务，最后连接文章、问题地图、官网发布、分发队列、线索回收和客户交付。</p>
                <div class="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                    <span class="rounded-full bg-white/10 px-3 py-1 text-slate-200">当前引擎：{{ $geoEngineDriver === 'georank' ? 'GEORank' : '本地规则' }}</span>
                    <span class="rounded-full bg-white/10 px-3 py-1 text-slate-200">在线发布设备：{{ $stats['devices_online'] }}</span>
                    <span class="rounded-full bg-white/10 px-3 py-1 text-slate-200">启用渠道：{{ $stats['channels_active'] }}</span>
                </div>
            </div>
            <form id="audit-form" method="POST" action="{{ route('admin.geo-growth.audits.store') }}" class="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
                @csrf
                <input name="url" type="url" required placeholder="输入客户官网，例如 https://example.com" class="min-w-0 flex-1 rounded-lg border-0 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-2 ring-transparent focus:ring-cyan-300">
                <button class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"><i data-lucide="scan-search" class="h-4 w-4"></i>开始诊断</button>
            </form>
        </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <h2 class="font-black text-slate-950">GEO运营阶段</h2>
                    <p class="mt-1 text-sm text-slate-500">一套项目从诊断到交付，必须能在这里看到闭环位置。</p>
                </div>
                <i data-lucide="workflow" class="h-5 w-5 text-blue-600"></i>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                @foreach($workflowStages as $stage)
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{{ $stage['key'] }}</div>
                        <div class="mt-2 text-lg font-black text-slate-950">{{ $stage['title'] }}</div>
                        <div class="mt-2 text-3xl font-black text-blue-600">{{ $stage['metric'] }}</div>
                        <div class="mt-2 text-xs leading-5 text-slate-500">{{ $stage['next'] }}</div>
                    </div>
                @endforeach
            </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-5 py-4">
                <h2 class="font-black text-slate-950">运营动作队列</h2>
                <p class="mt-1 text-sm text-slate-500">优先处理有风险或会阻断闭环的事项。</p>
            </div>
            <div class="divide-y divide-slate-100">
                @foreach($operationActions as $action)
                    <a href="{{ $action['href'] }}" class="flex gap-3 px-5 py-4 hover:bg-slate-50">
                        <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {{ $action['level'] === 'danger' ? 'bg-red-50 text-red-600' : ($action['level'] === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600') }}">
                            <i data-lucide="{{ $action['icon'] }}" class="h-4 w-4"></i>
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="flex items-center justify-between gap-3">
                                <span class="font-bold text-slate-950">{{ $action['title'] }}</span>
                                <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{{ $action['count'] }}</span>
                            </span>
                            <span class="mt-1 block text-xs leading-5 text-slate-500">{{ $action['description'] }}</span>
                        </span>
                    </a>
                @endforeach
            </div>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <a href="#audits" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm text-slate-500">诊断次数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['audits'] }}</div><div class="mt-1 text-xs text-slate-400">基础可读性检查</div></a>
        <a href="#audits" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm text-slate-500">最近诊断分</div><div class="mt-2 text-3xl font-black text-blue-600">{{ $stats['last_score'] === null ? '--' : $stats['last_score'] }}</div><div class="mt-1 text-xs text-slate-400">满分100</div></a>
        <a href="#tasks" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm text-slate-500">待处理任务</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $stats['open_tasks'] }}</div><div class="mt-1 text-xs text-slate-400">诊断结果自动生成</div></a>
        <a href="{{ route('admin.articles.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm text-slate-500">已发布内容</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['published_articles'] }}</div><div class="mt-1 text-xs text-slate-400">文章 {{ $stats['articles'] }} · FAQ {{ $stats['faqs'] }}</div></a>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 class="font-black text-slate-950">GEO增长闭环</h2>
                <p class="mt-1 text-sm text-slate-500">从官网基础设施到客户交付，每个环节都要有数据、有入口、有下一步动作。</p>
            </div>
            <a href="{{ route('admin.customer-projects.index') }}" class="inline-flex items-center gap-1.5 text-sm font-black text-blue-600 hover:text-blue-700">
                客户项目档案
                <i data-lucide="arrow-up-right" class="h-4 w-4"></i>
            </a>
        </div>
        <div class="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
            @foreach($deliveryPipeline as $item)
                <a href="{{ $item['href'] }}" class="bg-white p-5 hover:bg-slate-50">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-sm font-bold text-slate-500">{{ $item['label'] }}</div>
                            <div class="mt-2 text-3xl font-black text-slate-950">{{ $item['value'] }}</div>
                        </div>
                        <span class="flex h-10 w-10 items-center justify-center rounded-xl ring-1 {{ $item['tone'] }}">
                            <i data-lucide="{{ $item['icon'] }}" class="h-5 w-5"></i>
                        </span>
                    </div>
                    <div class="mt-3 truncate text-xs font-bold text-slate-400">{{ $item['sub'] }}</div>
                </a>
            @endforeach
        </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div id="audits" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 class="font-black text-slate-950">网站诊断记录</h2><p class="mt-1 text-sm text-slate-500">GEORank引擎接入前，先使用本地规则建立可验证的基础报告。</p></div><i data-lucide="scan-line" class="h-5 w-5 text-blue-600"></i></div>
            <div class="divide-y divide-slate-100">@forelse($audits as $audit)<a href="{{ route('admin.geo-growth.audit', ['auditId' => $audit->id]) }}" class="flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><div class="truncate font-bold text-slate-950">{{ $audit->url }}</div><div class="mt-1 text-xs text-slate-500">{{ $audit->completed_at?->format('Y-m-d H:i') ?? '执行中' }} · {{ $audit->findings_count }} 个发现 · {{ $audit->tasks_count }} 个任务</div></div><div class="flex items-center gap-3"><span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $audit->status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ($audit->status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700') }}">{{ $audit->status === 'completed' ? '已完成' : ($audit->status === 'failed' ? '失败' : '处理中') }}</span><strong class="text-xl text-slate-950">{{ $audit->score === null ? '--' : $audit->score }}</strong><i data-lucide="chevron-right" class="h-4 w-4 text-slate-400"></i></div></a>@empty<div class="px-5 py-12 text-center text-sm text-slate-500">还没有诊断记录。输入客户官网地址，生成第一份报告。</div>@endforelse</div>
        </div>

        <div id="tasks" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                    <h2 class="font-black text-slate-950">待处理任务</h2>
                    <p class="mt-1 text-sm text-slate-500">每个任务都应该落到官网、文章、FAQ或技术动作。</p>
                </div>
                <i data-lucide="list-checks" class="h-5 w-5 text-amber-600"></i>
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($tasks as $task)
                    @php($brief = is_array($task->content_brief) ? $task->content_brief : [])
                    <div class="px-5 py-4">
                        <div class="flex items-start gap-3">
                            <span class="mt-0.5 rounded-md px-2 py-1 text-[11px] font-black {{ $task->priority === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700' }}">{{ $task->priority === 'high' ? '高优先' : '待优化' }}</span>
                            <div class="min-w-0 flex-1">
                                <div class="font-bold leading-6 text-slate-950">{{ $task->title }}</div>
                                <p class="mt-1 text-xs leading-5 text-slate-500">{{ $task->description }}</p>
                                @if(! empty($brief['article_id']) || ! empty($brief['faq_id']))
                                    <div class="mt-2 flex flex-wrap gap-1.5">
                                        @if(! empty($brief['article_id']))
                                            <span class="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">文章草稿 #{{ $brief['article_id'] }}</span>
                                        @endif
                                        @if(! empty($brief['faq_id']))
                                            <span class="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">FAQ草稿 #{{ $brief['faq_id'] }}</span>
                                        @endif
                                    </div>
                                @endif
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap items-center gap-2 pl-14">
                            <form method="POST" action="{{ route('admin.geo-growth.tasks.status', ['taskId' => $task->id]) }}">
                                @csrf
                                <select name="status" onchange="this.form.submit()" class="rounded-md border-slate-200 py-1.5 text-xs">
                                    <option value="todo" @selected($task->status === 'todo')>待处理</option>
                                    <option value="doing" @selected($task->status === 'doing')>处理中</option>
                                    <option value="done">已完成</option>
                                    <option value="dismissed">已忽略</option>
                                </select>
                            </form>
                            @if(empty($brief['article_id']))
                                <form method="POST" action="{{ route('admin.geo-growth.tasks.promote', ['taskId' => $task->id]) }}">
                                    @csrf
                                    <button class="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700">生成文章草稿</button>
                                </form>
                            @endif
                            @if(empty($brief['faq_id']))
                                <form method="POST" action="{{ route('admin.geo-growth.tasks.promote-faq', ['taskId' => $task->id]) }}">
                                    @csrf
                                    <button class="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">生成FAQ草稿</button>
                                </form>
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="px-5 py-12 text-center text-sm text-slate-500">暂无待办任务。</div>
                @endforelse
            </div>
        </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-2">
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div><h2 class="font-black text-slate-950">最近内容产出</h2><p class="mt-1 text-sm text-slate-500">诊断任务最终要变成官网可抓取内容。</p></div>
                <a href="{{ route('admin.articles.index') }}" class="text-sm font-black text-blue-600 hover:text-blue-700">文章管理</a>
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($recentArticles as $article)
                    <a href="{{ route('admin.articles.edit', ['articleId' => $article->id]) }}" class="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                        <span class="min-w-0">
                            <span class="block truncate font-bold text-slate-950">{{ $article->title }}</span>
                            <span class="mt-1 block text-xs text-slate-500">{{ $article->updated_at }} · {{ $article->status }}</span>
                        </span>
                        <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold {{ $article->status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700' }}">{{ $article->status === 'published' ? '已发布' : '未发布' }}</span>
                    </a>
                @empty
                    <div class="px-5 py-10 text-center text-sm text-slate-500">暂无文章，建议先从GEO任务生成第一篇行业资讯草稿。</div>
                @endforelse
            </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div><h2 class="font-black text-slate-950">最近分发反馈</h2><p class="mt-1 text-sm text-slate-500">官网发布之后，继续关注平台同步和失败回写。</p></div>
                <a href="{{ route('admin.distribution.jobs') }}" class="text-sm font-black text-blue-600 hover:text-blue-700">分发任务</a>
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($recentDistributions as $job)
                    <a href="{{ route('admin.distribution.jobs') }}" class="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                        <span class="min-w-0">
                            <span class="block truncate font-bold text-slate-950">{{ $job->article?->title ?? '未关联文章' }}</span>
                            <span class="mt-1 block text-xs text-slate-500">{{ $job->channel?->name ?? '未知渠道' }} · {{ $job->updated_at }}</span>
                        </span>
                        <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold {{ $job->status === 'failed' ? 'bg-red-50 text-red-700' : (in_array($job->status, ['synced', 'success'], true) ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700') }}">{{ $job->status }}</span>
                    </a>
                @empty
                    <div class="px-5 py-10 text-center text-sm text-slate-500">暂无分发记录。文章发布后会自动进入分发流程。</div>
                @endforelse
            </div>
        </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <a href="{{ route('admin.knowledge-bases.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300"><i data-lucide="book-open" class="h-5 w-5 text-cyan-600"></i><h3 class="mt-4 font-black text-slate-950">企业知识库</h3><p class="mt-2 text-sm leading-6 text-slate-500">把产品、案例、销售资料和服务边界沉淀为内容生产依据。</p></a>
        <a href="{{ route('admin.geo-opportunities.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300"><i data-lucide="radar" class="h-5 w-5 text-indigo-600"></i><h3 class="mt-4 font-black text-slate-950">问题机会</h3><p class="mt-2 text-sm leading-6 text-slate-500">当前沉淀 {{ $stats['opportunities'] }} 条AI问题与内容机会，可转为文章或FAQ任务。</p></a>
        <a href="{{ route('admin.geo-answer-tests.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300"><i data-lucide="messages-square" class="h-5 w-5 text-cyan-600"></i><h3 class="mt-4 font-black text-slate-950">AI问答测试</h3><p class="mt-2 text-sm leading-6 text-slate-500">已有 {{ $stats['answer_tests'] }} 条测试，{{ $stats['answer_gaps'] }} 条内容缺口需要补齐。</p></a>
        <a href="{{ route('admin.geo-plans.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-purple-300"><i data-lucide="calendar-range" class="h-5 w-5 text-purple-600"></i><h3 class="mt-4 font-black text-slate-950">行动方案</h3><p class="mt-2 text-sm leading-6 text-slate-500">已有 {{ $stats['plans'] }} 份30/60/90天方案，用于排期、执行和复盘。</p></a>
        <a href="{{ route('admin.articles.create') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><i data-lucide="pen-line" class="h-5 w-5 text-blue-600"></i><h3 class="mt-4 font-black text-slate-950">创建内容</h3><p class="mt-2 text-sm leading-6 text-slate-500">把诊断问题转成文章、FAQ或官网页面的内容任务。</p></a>
        <a href="{{ route('admin.distribution.jobs') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-violet-300"><i data-lucide="send" class="h-5 w-5 text-violet-600"></i><h3 class="mt-4 font-black text-slate-950">查看分发队列</h3><p class="mt-2 text-sm leading-6 text-slate-500">文章发布到官网后，继续进入平台分发和发布助手。</p></a>
        <a href="{{ route('admin.publisher-assistant') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-300"><i data-lucide="monitor-up" class="h-5 w-5 text-orange-600"></i><h3 class="mt-4 font-black text-slate-950">发布助手</h3><p class="mt-2 text-sm leading-6 text-slate-500">查看设备连接、发布任务领取和平台同步结果。</p></a>
        <a href="{{ route('admin.customer-projects.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-300"><i data-lucide="folder-kanban" class="h-5 w-5 text-amber-600"></i><h3 class="mt-4 font-black text-slate-950">客户项目</h3><p class="mt-2 text-sm leading-6 text-slate-500">把客户官网、GEO后台、服务线、上线端点和下一步动作归档。</p></a>
    </section>
</div>
@endsection
