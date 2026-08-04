@extends('admin.layouts.app')

@section('content')
<div class="mx-auto max-w-[1600px] space-y-5">
    {{-- ai_sampling_console: platform surface prompt_id run_id model_version sampled_at mention recommendation rank citations competitor_mentions answer_accuracy dual_scoring --}}
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
            <div class="text-xs font-black tracking-[0.2em] text-cyan-600">AI ANSWER TESTS</div>
            <h1 class="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">AI问答测试</h1>
            <p class="mt-2 max-w-3xl text-sm leading-7 text-slate-500">先用本地内容覆盖做基础判断，再记录真实AI平台采样结果：品牌是否出现、是否推荐、排名、引用来源、竞品出现和答案准确度。</p>
        </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">测试总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['total'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">真实采样</div><div class="mt-2 text-3xl font-black text-cyan-600">{{ $stats['sampled'] }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">品牌出现率</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['mention_rate'] }}%</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm text-slate-500">推荐率 / 准确度</div><div class="mt-2 text-3xl font-black text-indigo-600">{{ $stats['recommendation_rate'] }}% <span class="text-lg text-slate-400">/ {{ $stats['avg_accuracy'] }}</span></div></div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="space-y-4">
            <form method="GET" action="{{ route('admin.geo-answer-tests.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                        <span class="text-xs font-bold text-slate-500">判断结果</span>
                        <select name="verdict" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部结果</option>
                            @foreach($verdictLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['verdict'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-xs font-bold text-slate-500">采样平台</span>
                        <select name="platform" class="mt-1 w-full rounded-lg border-slate-200 text-sm">
                            <option value="">全部平台</option>
                            @foreach($platformLabels as $key => $label)
                                <option value="{{ $key }}" @selected($filters['platform'] === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </label>
                    <div class="flex items-end gap-2">
                        <button class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white hover:bg-blue-700"><i data-lucide="filter" class="h-4 w-4"></i>筛选</button>
                        <a href="{{ route('admin.geo-answer-tests.index') }}" class="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">重置</a>
                    </div>
                </div>
            </form>

            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h2 class="font-black text-slate-950">测试记录</h2>
                    <p class="mt-1 text-sm text-slate-500">内容缺口要进入问题机会池，再转文章或FAQ任务。</p>
                </div>
                <div class="divide-y divide-slate-100">
                    @forelse($tests as $test)
                        @php
                            $evidence = is_array($test->evidence_sources) ? $test->evidence_sources : [];
                            $citations = is_array($test->citations) ? $test->citations : [];
                            $competitors = is_array($test->competitor_mentions) ? $test->competitor_mentions : [];
                            $samplingScore = is_array($test->metadata) ? (int) ($test->metadata['ai_performance_score'] ?? 0) : 0;
                        @endphp
                        <article class="px-5 py-5">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{{ $serviceLines[$test->service_line] ?? $test->service_line }}</span>
                                        <span class="rounded-full px-2.5 py-1 text-xs font-bold {{ $test->verdict === 'covered' ? 'bg-emerald-50 text-emerald-700' : ($test->verdict === 'gap' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500') }}">{{ $verdictLabels[$test->verdict] ?? $test->verdict }}</span>
                                        @if($test->last_run_at)
                                            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{{ $test->last_run_at->format('Y-m-d H:i') }}</span>
                                        @endif
                                        <span class="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{{ $platformLabels[$test->platform] ?? $test->platform ?? 'local' }} · {{ $surfaceLabels[$test->surface] ?? $test->surface ?? 'web' }}</span>
                                        @if($test->sampled_at)
                                            <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">AI表现 {{ $samplingScore }}分</span>
                                        @endif
                                    </div>
                                    <h3 class="mt-3 text-lg font-black leading-7 text-slate-950">{{ $test->question }}</h3>
                                    @if($test->expected_answer)
                                        <p class="mt-2 text-sm leading-6 text-slate-600">期望方向：{{ $test->expected_answer }}</p>
                                    @endif
                                    @if($test->observed_answer)
                                        <div class="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 whitespace-pre-line">{{ $test->observed_answer }}</div>
                                    @endif
                                    @if($test->gap_summary)
                                        <p class="mt-2 text-sm font-bold leading-6 {{ $test->verdict === 'gap' ? 'text-red-700' : 'text-emerald-700' }}">{{ $test->gap_summary }}</p>
                                    @endif
                                    @if($test->sampled_at)
                                        <div class="mt-3 grid gap-2 rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600 sm:grid-cols-4">
                                            <div><span class="font-black text-slate-900">出现</span><br>{{ $test->mention ? '是' : '否' }}</div>
                                            <div><span class="font-black text-slate-900">推荐</span><br>{{ $test->recommendation ? '是' : '否' }}</div>
                                            <div><span class="font-black text-slate-900">排名</span><br>{{ $test->rank ? '#'.$test->rank : '未记录' }}</div>
                                            <div><span class="font-black text-slate-900">准确度</span><br>{{ $test->answer_accuracy ?? '未评分' }}</div>
                                        </div>
                                    @endif
                                    @if(! empty($evidence))
                                        <div class="mt-3 flex flex-wrap gap-1.5">
                                            @foreach($evidence as $source)
                                                <span class="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{{ ($source['type'] ?? '') === 'faq' ? 'FAQ' : '文章' }}：{{ $source['title'] ?? '' }}</span>
                                            @endforeach
                                        </div>
                                    @endif
                                    @if(! empty($citations) || ! empty($competitors) || $test->sampling_notes)
                                        <div class="mt-3 grid gap-3 lg:grid-cols-2">
                                            @if(! empty($citations))
                                                <div class="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                                                    <div class="font-black">引用来源</div>
                                                    <div class="mt-1">{{ implode('、', array_slice($citations, 0, 6)) }}</div>
                                                </div>
                                            @endif
                                            @if(! empty($competitors))
                                                <div class="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                                    <div class="font-black">竞品出现</div>
                                                    <div class="mt-1">{{ implode('、', array_slice($competitors, 0, 6)) }}</div>
                                                </div>
                                            @endif
                                            @if($test->sampling_notes)
                                                <div class="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 lg:col-span-2">{{ $test->sampling_notes }}</div>
                                            @endif
                                        </div>
                                    @endif
                                </div>
                                <div class="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:justify-end">
                                    <form method="POST" action="{{ route('admin.geo-answer-tests.run', ['testId' => $test->id]) }}">
                                        @csrf
                                        <button class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800"><i data-lucide="play" class="h-3.5 w-3.5"></i>运行检测</button>
                                    </form>
                                    <details class="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                                        <summary class="cursor-pointer font-black text-slate-700">记录采样</summary>
                                        <form method="POST" action="{{ route('admin.geo-answer-tests.sample', ['testId' => $test->id]) }}" class="mt-3 space-y-2">
                                            @csrf
                                            <div class="grid gap-2 sm:grid-cols-2">
                                                <select name="platform" class="rounded-lg border-slate-200 text-xs" required>
                                                    @foreach($platformLabels as $key => $label)
                                                        <option value="{{ $key }}" @selected(($test->platform ?: 'deepseek') === $key)>{{ $label }}</option>
                                                    @endforeach
                                                </select>
                                                <select name="surface" class="rounded-lg border-slate-200 text-xs" required>
                                                    @foreach($surfaceLabels as $key => $label)
                                                        <option value="{{ $key }}" @selected(($test->surface ?: 'web') === $key)>{{ $label }}</option>
                                                    @endforeach
                                                </select>
                                            </div>
                                            <input name="model_version" class="w-full rounded-lg border-slate-200 text-xs" maxlength="120" placeholder="模型/版本">
                                            <div class="grid gap-2 sm:grid-cols-3">
                                                <input name="prompt_id" class="rounded-lg border-slate-200 text-xs" maxlength="80" placeholder="Prompt ID">
                                                <input name="run_id" class="rounded-lg border-slate-200 text-xs" maxlength="80" placeholder="Run ID">
                                                <input name="sampled_at" type="datetime-local" class="rounded-lg border-slate-200 text-xs">
                                            </div>
                                            <div class="grid gap-2 sm:grid-cols-2">
                                                <label class="inline-flex items-center gap-2 rounded-lg bg-white px-2 py-2 font-bold text-slate-600"><input type="checkbox" name="mention" value="1" class="rounded border-slate-300 text-cyan-600">提到品牌</label>
                                                <label class="inline-flex items-center gap-2 rounded-lg bg-white px-2 py-2 font-bold text-slate-600"><input type="checkbox" name="recommendation" value="1" class="rounded border-slate-300 text-cyan-600">明确推荐</label>
                                            </div>
                                            <div class="grid gap-2 sm:grid-cols-2">
                                                <input name="rank" type="number" min="1" max="50" class="rounded-lg border-slate-200 text-xs" placeholder="推荐排名">
                                                <input name="answer_accuracy" type="number" min="0" max="100" class="rounded-lg border-slate-200 text-xs" placeholder="准确度0-100">
                                            </div>
                                            <textarea name="observed_answer" rows="3" class="w-full rounded-lg border-slate-200 text-xs" maxlength="8000" placeholder="复制AI实际回答"></textarea>
                                            <textarea name="citations" rows="2" class="w-full rounded-lg border-slate-200 text-xs" maxlength="3000" placeholder="引用来源，每行一个"></textarea>
                                            <textarea name="competitor_mentions" rows="2" class="w-full rounded-lg border-slate-200 text-xs" maxlength="2000" placeholder="出现的竞品，每行一个"></textarea>
                                            <textarea name="sampling_notes" rows="2" class="w-full rounded-lg border-slate-200 text-xs" maxlength="3000" placeholder="采样备注"></textarea>
                                            <button class="inline-flex w-full items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 font-black text-white hover:bg-cyan-700">保存采样</button>
                                        </form>
                                    </details>
                                    @if(! $test->opportunity_id)
                                        <form method="POST" action="{{ route('admin.geo-answer-tests.promote-opportunity', ['testId' => $test->id]) }}">
                                            @csrf
                                            <button class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700"><i data-lucide="radar" class="h-3.5 w-3.5"></i>转机会</button>
                                        </form>
                                    @else
                                        <span class="inline-flex h-9 items-center rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700">机会 #{{ $test->opportunity_id }}</span>
                                    @endif
                                </div>
                            </div>
                        </article>
                    @empty
                        <div class="px-5 py-16 text-center">
                            <i data-lucide="messages-square" class="mx-auto h-8 w-8 text-slate-300"></i>
                            <div class="mt-3 font-black text-slate-900">还没有问答测试</div>
                            <p class="mt-1 text-sm text-slate-500">先录入一个客户会问AI的问题，检测官网内容是否有依据。</p>
                        </div>
                    @endforelse
                </div>
                @if($tests->hasPages())
                    <div class="border-t border-slate-100 px-5 py-4">{{ $tests->links() }}</div>
                @endif
            </div>
        </div>

        <aside class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:self-start">
            <h2 class="font-black text-slate-950">新增测试问题</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">建议录入客户真正会问AI的问题，例如“淄博企业做GEO优化应该怎么选服务商”。</p>
            <form method="POST" action="{{ route('admin.geo-answer-tests.store') }}" class="mt-5 space-y-4">
                @csrf
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">服务线</span>
                    <select name="service_line" class="mt-1 w-full rounded-lg border-slate-200 text-sm" required>
                        @foreach($serviceLines as $key => $label)
                            <option value="{{ $key }}">{{ $label }}</option>
                        @endforeach
                    </select>
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">测试问题</span>
                    <textarea name="question" rows="3" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="260" required placeholder="客户会向AI怎么问？"></textarea>
                </label>
                <label class="block">
                    <span class="text-xs font-bold text-slate-500">期望回答方向</span>
                    <textarea name="expected_answer" rows="5" class="mt-1 w-full rounded-lg border-slate-200 text-sm" maxlength="3000" placeholder="希望AI回答时提到哪些能力、事实、案例或服务边界。"></textarea>
                </label>
                <button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                    <i data-lucide="plus" class="h-4 w-4"></i>
                    保存测试
                </button>
            </form>
        </aside>
    </section>
</div>
@endsection
