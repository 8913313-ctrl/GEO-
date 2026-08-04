@extends('admin.layouts.app')

@section('content')
    @php
        $stats = $stats ?? [];
        $articleStatusLabels = [
            'draft' => '鑽夌',
            'published' => '宸插彂甯?,
            'private' => '绉佸瘑',
            'archived' => '褰掓。',
        ];
        $jobStatusLabels = [
            'queued' => '寰呮墽琛?,
            'sending' => '澶勭悊涓?,
            'synced' => '宸插悓姝?,
            'failed' => '澶辫触',
        ];
        $assetCards = [
            ['label' => '鐭ヨ瘑搴?, 'value' => (int) ($stats['knowledge_bases'] ?? 0), 'href' => route('admin.knowledge-bases.index'), 'icon' => 'book-open-check', 'desc' => '鍏徃璧勬枡銆佹湇鍔℃柟娉曡銆佸鎴风礌鏉?],
            ['label' => '鍏抽敭璇嶅簱', 'value' => (int) ($stats['keyword_libraries'] ?? 0), 'href' => route('admin.keyword-libraries.index'), 'icon' => 'tags', 'desc' => 'GEO涓婚璇嶃€佽涓氳瘝銆佸鎴锋悳绱㈣瘝'],
            ['label' => '鏍囬搴?, 'value' => (int) ($stats['title_libraries'] ?? 0), 'href' => route('admin.title-libraries.index'), 'icon' => 'text-cursor-input', 'desc' => '鎵归噺閫夐涓庢枃绔犳爣棰樻ā鏉?],
            ['label' => '鍥剧墖搴?, 'value' => (int) ($stats['image_libraries'] ?? 0), 'href' => route('admin.image-libraries.index'), 'icon' => 'image', 'desc' => '瀹樼綉閰嶅浘鍜屽钩鍙板彂甯冪礌鏉?],
        ];
        $workflow = [
            ['title' => '閰嶇疆AI妯″瀷', 'desc' => '鍏堥厤缃唴瀹圭敓鎴愩€佹憳瑕併€佹敼鍐欏拰Embedding鎵€闇€妯″瀷銆?, 'href' => route('admin.ai-models.index'), 'button' => 'AI閰嶇疆', 'icon' => 'cpu'],
            ['title' => '鏁寸悊鍐呭璧勪骇', 'desc' => '鎶婄煡璇嗗簱銆佸叧閿瘝銆佹爣棰樸€佸浘鐗囥€佷綔鑰呰祫鏂欐暣鐞嗘垚鍙皟鐢ㄨ祫浜с€?, 'href' => route('admin.materials.index'), 'button' => '鍐呭璧勪骇', 'icon' => 'database'],
            ['title' => '鍒涘缓GEO浠诲姟', 'desc' => '鍥寸粫鏈嶅姟浜у搧銆佽涓氶棶棰樺拰瀹㈡埛鍦烘櫙鐢熸垚鏂囩珷浠诲姟銆?, 'href' => route('admin.tasks.create'), 'button' => '鏂板缓浠诲姟', 'icon' => 'workflow'],
            ['title' => '鍙戝竷涓庡鐩?, 'desc' => '鍙戝竷鍒板畼缃戝悗杩涘叆鍒嗗彂闃熷垪锛岃褰曟垚鍔熼摼鎺ャ€佸け璐ュ師鍥犲拰澶嶇洏鏁版嵁銆?, 'href' => route('admin.distribution.jobs'), 'button' => '鍒嗗彂浠诲姟', 'icon' => 'send-horizontal'],
        ];
    @endphp

    <div class="space-y-7 px-4 sm:px-0">
        <section class="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div class="grid gap-0 xl:grid-cols-[1fr_420px]">
                <div class="bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950 p-7 text-white sm:p-9">
                    <p class="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100">
                        GEO OPERATING SYSTEM
                    </p>
                    <h1 class="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                        GEO杩愯惀鍙?                    </h1>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                        杩欓噷璐熻矗浠庣礌鏉愭矇娣€銆丄I閰嶇疆銆佷换鍔＄敓鎴愩€佹枃绔犵敓浜у埌鍒嗗彂澶嶇洏鐨勫畬鏁碐EO杩愯惀閾捐矾銆傚畼缃戣繍钀ヨ礋璐ｅ澶栧憟鐜帮紝GEO杩愯惀璐熻矗鎸佺画鐢熶骇鍙鎼滅储寮曟搸鍜孉I寮曠敤鐨勫唴瀹硅祫浜с€?                    </p>
                    <div class="mt-7 flex flex-wrap gap-3">
                        <a href="{{ route('admin.tasks.create') }}" class="inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 hover:bg-cyan-400">
                            <i data-lucide="plus-circle" class="mr-2 h-4 w-4"></i>
                            鏂板缓GEO浠诲姟
                        </a>
                        <a href="{{ route('admin.materials.index') }}" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                            <i data-lucide="database" class="mr-2 h-4 w-4"></i>
                            绠＄悊鍐呭璧勪骇
                        </a>
                        <a href="{{ route('admin.articles.create') }}" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                            <i data-lucide="pen-line" class="mr-2 h-4 w-4"></i>
                            鍐欒涓氭枃绔?                        </a>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-px bg-slate-200">
                    <a href="{{ route('admin.tasks.index') }}" class="bg-white p-6 hover:bg-slate-50">
                        <div class="text-sm text-slate-500">杩愯惀浠诲姟</div>
                        <div class="mt-2 text-3xl font-semibold text-slate-950">{{ (int) ($stats['tasks_total'] ?? 0) }}</div>
                        <div class="mt-2 text-xs text-slate-500">閫夐涓庣敓浜т换鍔?/div>
                    </a>
                    <a href="{{ route('admin.articles.index') }}" class="bg-white p-6 hover:bg-slate-50">
                        <div class="text-sm text-slate-500">鏂囩珷璧勪骇</div>
                        <div class="mt-2 text-3xl font-semibold text-blue-700">{{ (int) ($stats['articles_total'] ?? 0) }}</div>
                        <div class="mt-2 text-xs text-slate-500">瀹樼綉鍜屽垎鍙戝唴瀹?/div>
                    </a>
                    <a href="{{ route('admin.distribution.index') }}" class="bg-white p-6 hover:bg-slate-50">
                        <div class="text-sm text-slate-500">鍚敤娓犻亾</div>
                        <div class="mt-2 text-3xl font-semibold text-emerald-700">{{ (int) ($stats['channels_active'] ?? 0) }}</div>
                        <div class="mt-2 text-xs text-slate-500">瀹樼綉/骞冲彴鍒嗗彂</div>
                    </a>
                    <a href="{{ route('admin.distribution.jobs', ['status' => 'failed']) }}" class="bg-white p-6 hover:bg-slate-50">
                        <div class="text-sm text-slate-500">澶辫触鍒嗗彂</div>
                        <div class="mt-2 text-3xl font-semibold text-red-700">{{ (int) ($stats['jobs_failed'] ?? 0) }}</div>
                        <div class="mt-2 text-xs text-slate-500">闇€瑕佸鐞?/div>
                    </a>
                </div>
            </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">GEO WORKFLOW</p>
                    <h2 class="mt-2 text-2xl font-semibold text-slate-950">浠庤祫鏂欏埌鍙戝竷鐨勮繍钀ラ摼璺?/h2>
                    <p class="mt-2 text-sm leading-6 text-slate-600">鎶奊EO鏃ュ父宸ヤ綔鎸夐『搴忔斁鍦ㄤ竴涓〉闈㈤噷锛岃繍钀ヤ汉鍛樼収鐫€璧板嵆鍙€?/p>
                </div>
                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    @foreach ($workflow as $step)
                        <a href="{{ $step['href'] }}" class="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-cyan-200 hover:bg-cyan-50/50">
                            <div class="flex items-start gap-4">
                                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                                    <i data-lucide="{{ $step['icon'] }}" class="h-5 w-5"></i>
                                </div>
                                <div class="min-w-0">
                                    <h3 class="text-base font-semibold text-slate-950">{{ $step['title'] }}</h3>
                                    <p class="mt-2 text-sm leading-6 text-slate-600">{{ $step['desc'] }}</p>
                                    <span class="mt-4 inline-flex items-center text-sm font-semibold text-cyan-700">
                                        {{ $step['button'] }}
                                        <i data-lucide="chevron-right" class="ml-1 h-4 w-4"></i>
                                    </span>
                                </div>
                            </div>
                        </a>
                    @endforeach
                </div>
            </div>

            <aside class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 class="text-lg font-semibold text-slate-950">鍐呭璧勪骇搴?/h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">GEO涓嶆槸鍙啓鏂囩珷锛屾牳蹇冩槸鎶婁紒涓氳祫鏂欏彉鎴愬彲鎸佺画璋冪敤鐨勫唴瀹硅祫浜с€?/p>
                <div class="mt-5 space-y-3">
                    @foreach ($assetCards as $card)
                        <a href="{{ $card['href'] }}" class="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                            <div class="flex items-start gap-3">
                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                                    <i data-lucide="{{ $card['icon'] }}" class="h-5 w-5"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="text-sm font-semibold text-slate-950">{{ $card['label'] }}</div>
                                        <div class="text-lg font-semibold text-slate-950">{{ $card['value'] }}</div>
                                    </div>
                                    <p class="mt-1 text-xs leading-5 text-slate-500">{{ $card['desc'] }}</p>
                                </div>
                            </div>
                        </a>
                    @endforeach
                </div>
            </aside>
        </section>

        <section class="grid gap-6 xl:grid-cols-2">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 class="text-lg font-semibold text-slate-950">鏈€杩戝唴瀹?/h2>
                    <a href="{{ route('admin.articles.index') }}" class="text-sm font-semibold text-cyan-700">鏂囩珷涓績</a>
                </div>
                @forelse ($recentArticles as $article)
                    <article class="border-b border-slate-100 px-6 py-4 last:border-b-0">
                        <div class="line-clamp-2 text-sm font-semibold leading-6 text-slate-950">{{ $article->title }}</div>
                        <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span class="rounded-full bg-slate-100 px-2 py-1">{{ $articleStatusLabels[(string) $article->status] ?? (string) $article->status }}</span>
                            <span>{{ $article->updated_at?->format('Y-m-d H:i') }}</span>
                        </div>
                    </article>
                @empty
                    <div class="px-6 py-12 text-sm text-slate-500">鏆傛棤鏂囩珷銆傚彲浠ヤ粠GEO浠诲姟鎴栨枃绔犱腑蹇冨紑濮嬬敓浜у唴瀹广€?/div>
                @endforelse
            </div>

            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 class="text-lg font-semibold text-slate-950">鏈€杩戝垎鍙?/h2>
                    <a href="{{ route('admin.distribution.jobs') }}" class="text-sm font-semibold text-cyan-700">浠诲姟闃熷垪</a>
                </div>
                @forelse ($recentJobs as $job)
                    <article class="border-b border-slate-100 px-6 py-4 last:border-b-0">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="line-clamp-2 text-sm font-semibold leading-6 text-slate-950">{{ $job->article?->title ?? '鏈叧鑱旀枃绔? }}</div>
                                <div class="mt-1 truncate text-xs text-slate-500">{{ $job->channel?->name ?? '鏈煡娓犻亾' }} 路 #{{ (int) $job->id }}</div>
                            </div>
                            <span class="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{{ $jobStatusLabels[(string) $job->status] ?? (string) $job->status }}</span>
                        </div>
                    </article>
                @empty
                    <div class="px-6 py-12 text-sm text-slate-500">鏆傛棤鍒嗗彂浠诲姟銆傛枃绔犲彂甯冨苟閰嶇疆娓犻亾鍚庝細杩涘叆闃熷垪銆?/div>
                @endforelse
            </div>
        </section>
    </div>
@endsection
