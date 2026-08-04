@extends('admin.layouts.app')

@section('content')
@php
    $statusLabels = ['new' => '新机会', 'planned' => '已规划', 'promoted' => '已转任务', 'ignored' => '已忽略'];
    $priorityLabels = ['high' => '高', 'medium' => '中', 'low' => '低'];
    $coverageLabels = is_array($coverageLabels ?? null) ? $coverageLabels : ['unknown' => '未评估'];
@endphp

<div class="mx-auto max-w-[1600px] space-y-5">
    {{-- question_map_console: cluster parent_question follow_up_chain query_rewrites evidence_query coverage_status mapped_assets --}}
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.2em] text-blue-600">AI QUESTION OPPORTUNITIES</div>
                <h1 class="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">问题地图</h1>
                <p class="mt-2 max-w-3xl text-sm leading-7 text-slate-500">把客户可能向AI提出的问题整理成问题簇、追问链、查询重写和证据查询，再转成文章、FAQ、服务页优化或案例任务。</p>
            </div>
            <form method="POST" action="{{ route('admin.geo-opportunities.seed-presets') }}">
                @csrf
                <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
                    <i data-lucide="wand-sparkles" class="h-4 w-4"></i>
                    生成基础机会
                </button>
            </form>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">机会总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['total'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">新机会</div><div class="mt-2 text-3xl font-black text-blue-600">{{ $stats['new'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">已规划</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $stats['planned'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">已转任务</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['promoted'] }}</div></div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="space-y-4">
            <form method="GET" action="{{ route('admin.geo-opportunities.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="grid gap-3 md:grid-cols-4">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">服务线</span>
                        <select name="service_line" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部服务线</option>
                            @foreach($serviceLines as $key => $label)
                                <option value="{{ $key }}" @selected($filters['service_line'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">状态</span>
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部状态</option>
                            @foreach($statusLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['status'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">输出类型</span>
                        <select name="recommended_output" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部类型</option>
                            @foreach($outputs as $key => $label)
                                <option value="{{ $key }}" @selected($filters['recommended_output'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <div class="flex items-end gap-2">
                        <button class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white hover:bg-blue-700"><i data-lucide="filter" class="h-4 w-4"></i>筛选</button>
                        <a href="{{ route('admin.geo-opportunities.index') }}" class="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">重置</a>
                    </div>
                </div>
            </form>

            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">问题地图列表</h2>
                    <p class="mt-1 text-sm text-slate-500">优先处理高意图、高价值、未覆盖且能补齐官网可信内容的问题簇。</p>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse($opportunities as $opportunity)
                        @php
                            $followUps = is_array($opportunity->follow_up_questions) ? $opportunity->follow_up_questions : [];
                            $rewrites = is_array($opportunity->query_rewrites) ? $opportunity->query_rewrites : [];
                            $coverageClass = match((string) $opportunity->coverage_status) {
                                'validated' => 'bg-emerald-100 text-emerald-800',
                                'covered' => 'bg-green-50 text-green-700',
                                'partial' => 'bg-amber-50 text-amber-700',
                                'uncovered' => 'bg-red-50 text-red-700',
                                default => 'bg-slate-100 text-slate-600',
                            };
                        @endphp
                        <article class="px-5 py-5">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{{ $serviceLines[$opportunity->service_line] ?? $opportunity->service_line }}</span>
                                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{{ $intents[$opportunity->intent] ?? $opportunity->intent }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $opportunity->priority === 'high' ? 'bg-red-50 text-red-700' : ($opportunity->priority === 'low' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700') }}">优先级 {{ $priorityLabels[$opportunity->priority] ?? $opportunity->priority }}</span>
                                        <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{{ $outputs[$opportunity->recommended_output] ?? $opportunity->recommended_output }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $coverageClass }}">{{ $coverageLabels[$opportunity->coverage_status] ?? $opportunity->coverage_status }}</span>
                                    </div>
                                    @if($opportunity->cluster_name)
                                        <div class="mt-3 text-xs font-black tracking-[0.16em] text-blue-600">问题簇：{{ $opportunity->cluster_name }}</div>
                                    @endif
                                    <h3 class="mt-3 text-lg font-black leading-7 text-slate-950">{{ $opportunity->question }}</h3>
                                    @if($opportunity->parent_question)
                                        <div class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">父问题：{{ $opportunity->parent_question }}</div>
                                    @endif
                                    @if($opportunity->keyword)
                                        <div class="mt-2 text-sm font-bold text-slate-500">关键词：{{ $opportunity->keyword }}</div>
                                    @endif
                                    @if($opportunity->evidence_query)
                                        <div class="mt-2 text-sm font-bold text-indigo-600">证据查询：{{ $opportunity->evidence_query }}</div>
                                    @endif
                                    @if($opportunity->answer_angle)
                                        <p class="mt-2 text-sm leading-7 text-slate-600">{{ $opportunity->answer_angle }}</p>
                                    @endif
                                    @if(! empty($followUps) || ! empty($rewrites))
                                        <div class="mt-3 grid gap-3 lg:grid-cols-2">
                                            @if(! empty($followUps))
                                                <div class="rounded-lg border border-slate-100 bg-white p-3">
                                                    <div class="text-xs font-black text-slate-500">追问链路</div>
                                                    <div class="mt-2 flex flex-wrap gap-1.5">
                                                        @foreach(array_slice($followUps, 0, 5) as $item)
                                                            <span class="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{{ $item }}</span>
                                                        @endforeach
                                                    </div>
                                                </div>
                                            @endif
                                            @if(! empty($rewrites))
                                                <div class="rounded-lg border border-slate-100 bg-white p-3">
                                                    <div class="text-xs font-black text-slate-500">查询重写</div>
                                                    <div class="mt-2 flex flex-wrap gap-1.5">
                                                        @foreach(array_slice($rewrites, 0, 5) as $item)
                                                            <span class="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{{ $item }}</span>
                                                        @endforeach
                                                    </div>
                                                </div>
                                            @endif
                                        </div>
                                    @endif
                                    @if($opportunity->task)
                                        <div class="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                                            <i data-lucide="check-circle-2" class="h-4 w-4"></i>
                                            已生成任务 #{{ $opportunity->task->id }}
                                        </div>
                                    @endif
                                </div>
                                <div class="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:justify-end">
                                    <form method="POST" action="{{ route('admin.geo-opportunities.status', ['opportunityId' => $opportunity->id]) }}">
                                        @csrf
                                        <select name="status" onchange="this.form.submit()" class="h-9 rounded-lg border-slate-200 text-xs font-bold">
                                            @foreach($statusLabels as $key => $label)
                                                <option value="{{ $key }}" @selected($opportunity->status === $key)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                    </form>
                                    @if(! $opportunity->task_id && $opportunity->status !== 'ignored')
                                        <form method="POST" action="{{ route('admin.geo-opportunities.promote', ['opportunityId' => $opportunity->id]) }}">
                                            @csrf
                                            <button class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800">
                                                <i data-lucide="arrow-up-right" class="h-3.5 w-3.5"></i>
                                                转任务
                                            </button>
                                        </form>
                                    @endif
                                </div>
                            </div>
                        </article>
                    @empty
                        <div class="px-5 py-16 text-center">
                            <i data-lucide="radar" class="mx-auto h-8 w-8 text-slate-300"></i>
                            <div class="mt-3 font-black text-slate-900">还没有问题机会</div>
                            <p class="mt-1 text-sm text-slate-500">可以先生成基础机会，也可以手工录入客户真实问题。</p>
                        </div>
                    @endforelse
                </div>
                @if($opportunities->hasPages())
                    <div class="border-t border-slate-100 px-5 py-4">{{ $opportunities->links() }}</div>
                @endif
            </div>
        </div>

        <aside class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:self-start">
            <h2 class="font-black text-slate-950">新增问题机会</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">把客户真实会问的问题写进来，并补齐问题簇、追问链和证据查询，后面再转成文章、FAQ、案例或服务页优化。</p>
            <form method="POST" action="{{ route('admin.geo-opportunities.store') }}" class="mt-5 space-y-4">
                @csrf
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">服务线</span>
                        <select name="service_line" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($serviceLines as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">搜索意图</span>
                        <select name="intent" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($intents as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">优先级</span>
                        <select name="priority" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            <option value="high">高</option>
                            <option value="medium" selected>中</option>
                            <option value="low">低</option>
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">推荐输出</span>
                        <select name="recommended_output" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($outputs as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">关键词</span>
                    <input name="keyword" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="120" placeholder="例如：GEO优化服务商">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">问题簇</span>
                    <input name="cluster_name" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="120" placeholder="例如：GEO服务商选择">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">问题</span>
                    <input name="question" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="240" required placeholder="客户会向AI问什么？">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">父问题</span>
                    <input name="parent_question" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="240" placeholder="这个问题属于哪个更大的问题？">
                </label>
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">追问链路</span>
                        <textarea name="follow_up_questions" rows="4" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000" placeholder="每行一个追问"></textarea>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">查询重写</span>
                        <textarea name="query_rewrites" rows="4" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000" placeholder="每行一个AI/搜索可能改写的问法"></textarea>
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">证据查询</span>
                    <input name="evidence_query" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="240" placeholder="用来查找事实、来源和案例的检索词">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">当前覆盖状态</span>
                    <select name="coverage_status" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                        @foreach($coverageLabels as $key => $label)
                            <option value="{{ $key }}">{{ $label }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">回答角度</span>
                    <textarea name="answer_angle" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000" placeholder="写清楚这条内容要回答什么、证明什么、导向哪个服务。"></textarea>
                </label>
                <button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                    <i data-lucide="plus" class="h-4 w-4"></i>
                    保存机会
                </button>
            </form>
        </aside>
    </section>
</div>
@endsection
