@extends('admin.layouts.app')

@section('content')
@php
    $typeClass = [
        'entity' => 'bg-blue-50 text-blue-700',
        'service' => 'bg-emerald-50 text-emerald-700',
        'product' => 'bg-indigo-50 text-indigo-700',
        'case' => 'bg-amber-50 text-amber-700',
        'qualification' => 'bg-purple-50 text-purple-700',
        'process' => 'bg-cyan-50 text-cyan-700',
        'boundary' => 'bg-slate-100 text-slate-700',
        'forbidden' => 'bg-red-50 text-red-700',
    ];
@endphp

<div class="mx-auto max-w-[1600px] space-y-5">
    {{-- fact_base_console: entity service case qualification source confidence confirmed pending forbidden fact_cards --}}
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.2em] text-emerald-600">FACT BASE</div>
                <h1 class="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">事实底座</h1>
                <p class="mt-2 max-w-3xl text-sm leading-7 text-slate-500">把企业实体、服务能力、案例、资质、交付流程和禁用表达做成可复用事实卡，供文章、FAQ、页面和AI Prompt引用。</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="{{ route('admin.geo-opportunities.index') }}" class="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100">
                    <i data-lucide="radar" class="h-4 w-4"></i>
                    问题地图
                </a>
                <a href="{{ route('admin.articles.index') }}" class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
                    <i data-lucide="newspaper" class="h-4 w-4"></i>
                    内容运营台
                </a>
            </div>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">事实卡总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['total'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">已确认</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['confirmed'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">待确认</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $stats['pending'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">禁用表达</div><div class="mt-2 text-3xl font-black text-red-600">{{ $stats['forbidden'] }}</div></div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="space-y-4">
            <form method="GET" action="{{ route('admin.fact-base.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="grid gap-3 md:grid-cols-4">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">事实类型</span>
                        <select name="fact_type" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部类型</option>
                            @foreach($factTypes as $key => $label)
                                <option value="{{ $key }}" @selected($filters['fact_type'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">确认状态</span>
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部状态</option>
                            @foreach($statusLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['status'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">可信等级</span>
                        <select name="confidence_level" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部等级</option>
                            @foreach($confidenceLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['confidence_level'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <div class="flex items-end gap-2">
                        <button class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700"><i data-lucide="filter" class="h-4 w-4"></i>筛选</button>
                        <a href="{{ route('admin.fact-base.index') }}" class="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">重置</a>
                    </div>
                </div>
            </form>

            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">事实卡</h2>
                    <p class="mt-1 text-sm text-slate-500">只有已确认、高可信的事实适合直接进入公开文章、FAQ和官网页面。</p>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse($facts as $fact)
                        @php
                            $serviceLineValues = is_array($fact->service_lines) ? $fact->service_lines : [];
                            $usageTargetValues = is_array($fact->usage_targets) ? $fact->usage_targets : [];
                            $forbiddenValues = is_array($fact->forbidden_phrases) ? $fact->forbidden_phrases : [];
                            $statusClass = match((string) $fact->status) {
                                'confirmed' => 'bg-emerald-50 text-emerald-700',
                                'pending' => 'bg-amber-50 text-amber-700',
                                'forbidden' => 'bg-red-50 text-red-700',
                                default => 'bg-slate-100 text-slate-600',
                            };
                        @endphp
                        <article class="px-5 py-5">
                            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full px-2.5 py-1 text-xs font-black {{ $typeClass[$fact->fact_type] ?? 'bg-slate-100 text-slate-600' }}">{{ $factTypes[$fact->fact_type] ?? $fact->fact_type }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $statusClass }}">{{ $statusLabels[$fact->status] ?? $fact->status }}</span>
                                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{{ $confidenceLabels[$fact->confidence_level] ?? $fact->confidence_level }}</span>
                                    </div>
                                    <h3 class="mt-3 text-lg font-black leading-7 text-slate-950">{{ $fact->title }}</h3>
                                    <p class="mt-2 text-sm leading-7 text-slate-600">{{ $fact->fact_text }}</p>
                                    <div class="mt-3 flex flex-wrap gap-1.5">
                                        @foreach($serviceLineValues as $line)
                                            <span class="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{{ $serviceLines[$line] ?? $line }}</span>
                                        @endforeach
                                        @foreach($usageTargetValues as $target)
                                            <span class="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{{ $usageTargets[$target] ?? $target }}</span>
                                        @endforeach
                                    </div>
                                    @if($fact->source_title || $fact->source_url || $fact->source_updated_at)
                                        <div class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                                            来源：{{ $fact->source_title ?: '未命名来源' }}
                                            @if($fact->source_url)
                                                · {{ $fact->source_url }}
                                            @endif
                                            @if($fact->source_updated_at)
                                                · 更新于 {{ $fact->source_updated_at->format('Y-m-d') }}
                                            @endif
                                        </div>
                                    @endif
                                    @if(! empty($forbiddenValues))
                                        <div class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">禁用表达：{{ implode('、', $forbiddenValues) }}</div>
                                    @endif
                                </div>
                                <div class="flex shrink-0 flex-wrap gap-2 xl:w-52 xl:justify-end">
                                    <form method="POST" action="{{ route('admin.fact-base.status', ['factId' => $fact->id]) }}" class="grid grid-cols-2 gap-2">
                                        @csrf
                                        <select name="status" class="h-9 rounded-lg border-slate-200 text-xs font-bold">
                                            @foreach($statusLabels as $key => $label)
                                                <option value="{{ $key }}" @selected($fact->status === $key)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                        <select name="confidence_level" onchange="this.form.submit()" class="h-9 rounded-lg border-slate-200 text-xs font-bold">
                                            @foreach($confidenceLabels as $key => $label)
                                                <option value="{{ $key }}" @selected($fact->confidence_level === $key)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                    </form>
                                    <form method="POST" action="{{ route('admin.fact-base.delete', ['factId' => $fact->id]) }}" onsubmit="return confirm('确认删除这张事实卡？')">
                                        @csrf
                                        <button class="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-black text-red-600 hover:bg-red-50"><i data-lucide="trash-2" class="h-3.5 w-3.5"></i></button>
                                    </form>
                                </div>
                            </div>
                        </article>
                    @empty
                        <div class="px-5 py-16 text-center">
                            <i data-lucide="database" class="mx-auto h-8 w-8 text-slate-300"></i>
                            <div class="mt-3 font-black text-slate-900">还没有事实卡</div>
                            <p class="mt-1 text-sm text-slate-500">先把企业主体、服务、案例和禁用表达沉淀下来，文章才有可信依据。</p>
                        </div>
                    @endforelse
                </div>
                @if($facts->hasPages())
                    <div class="border-t border-slate-100 px-5 py-4">{{ $facts->links() }}</div>
                @endif
            </div>
        </div>

        <aside class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:self-start">
            <h2 class="font-black text-slate-950">新增事实卡</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">事实卡要写清来源、可信等级和使用范围，待确认内容不要直接进入公开官网。</p>
            <form method="POST" action="{{ route('admin.fact-base.store') }}" class="mt-5 space-y-4">
                @csrf
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">事实类型</span>
                        <select name="fact_type" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($factTypes as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">确认状态</span>
                        <select name="status" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                            @foreach($statusLabels as $key => $label)
                                <option value="{{ $key }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">可信等级</span>
                    <select name="confidence_level" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                        @foreach($confidenceLabels as $key => $label)
                            <option value="{{ $key }}">{{ $label }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">标题</span>
                    <input name="title" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="180" required placeholder="例如：桐灼的三条核心服务线">
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">事实内容</span>
                    <textarea name="fact_text" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="5000" required placeholder="写成可被文章、FAQ和AI引用的事实表达。"></textarea>
                </label>
                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">来源标题</span>
                        <input name="source_title" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="180">
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">来源更新时间</span>
                        <input name="source_updated_at" type="date" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                    </label>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">来源链接</span>
                    <input name="source_url" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="500" placeholder="官网页面、客户材料或公开来源链接">
                </label>
                <div>
                    <div class="text-xs font-bold text-slate-500">关联服务线</div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-3">
                        @foreach($serviceLines as $key => $label)
                            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                                <input type="checkbox" name="service_lines[]" value="{{ $key }}" class="rounded border-slate-300 text-emerald-600">
                                {{ $label }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <div>
                    <div class="text-xs font-bold text-slate-500">可用场景</div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-2">
                        @foreach($usageTargets as $key => $label)
                            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                                <input type="checkbox" name="usage_targets[]" value="{{ $key }}" class="rounded border-slate-300 text-emerald-600">
                                {{ $label }}
                            </label>
                        @endforeach
                    </div>
                </div>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">禁用表达</span>
                    <textarea name="forbidden_phrases" rows="3" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="2000" placeholder="每行一个不能写进公开内容的表述"></textarea>
                </label>
                <button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
                    <i data-lucide="plus" class="h-4 w-4"></i>
                    保存事实卡
                </button>
            </form>
        </aside>
    </section>
</div>
@endsection
