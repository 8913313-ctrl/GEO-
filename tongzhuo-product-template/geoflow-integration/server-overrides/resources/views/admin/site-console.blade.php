@extends('admin.layouts.app')

@section('content')
    @php
        $stats = $stats ?? [];
        $sitePages = $sitePages ?? [];
        $siteIdentity = $siteIdentity ?? [];
        $aiFiles = $aiFiles ?? [];
        $cmsSchema = $cmsSchema ?? ['ready' => false, 'tables' => 0, 'total' => 6];
        $articleStatusLabels = [
            'draft' => '鑽夌',
            'published' => '宸插彂甯?,
            'private' => '绉佸瘑',
            'archived' => '褰掓。',
        ];
        $healthItems = [
            ['label' => '瀹樼綉椤甸潰', 'value' => count($sitePages), 'desc' => '棣栭〉銆佸叧浜庛€佷骇鍝併€丗AQ銆佽仈绯荤瓑', 'href' => route('admin.site-console.pages'), 'icon' => 'panel-top', 'tone' => 'bg-blue-600'],
            ['label' => '宸插彂甯冩枃绔?, 'value' => (int) ($stats['articles_published'] ?? 0), 'desc' => '鍏紑琛屼笟璧勮锛屽彲琚獳I鎶撳彇', 'href' => route('admin.articles.index', ['status' => 'published']), 'icon' => 'file-check-2', 'tone' => 'bg-emerald-600'],
            ['label' => '寰呰窡杩涚嚎绱?, 'value' => (int) ($stats['leads_new'] ?? 0), 'desc' => '瀹樼綉琛ㄥ崟鎻愪氦鍚庣殑瀹㈡埛闇€姹?, 'href' => route('admin.contact-leads.index', ['status' => 'new']), 'icon' => 'inbox', 'tone' => 'bg-amber-600'],
            ['label' => 'AI鏂囦欢', 'value' => collect($aiFiles)->where('exists', true)->count(), 'desc' => 'Sitemap銆丷SS銆乴lms绛夊叆鍙?, 'href' => route('admin.site-console.ai-crawl'), 'icon' => 'bot', 'tone' => 'bg-cyan-600'],
            ['label' => 'CMS鏁版嵁琛?, 'value' => (int) ($cmsSchema['tables'] ?? 0).'/'.(int) ($cmsSchema['total'] ?? 6), 'desc' => !empty($cmsSchema['ready']) ? '妯″潡鍖栨ā鏉垮簳搴у凡灏辩华' : '绛夊緟鎵ц鏁版嵁搴撹縼绉?, 'href' => route('admin.site-console.pages'), 'icon' => 'blocks', 'tone' => !empty($cmsSchema['ready']) ? 'bg-violet-600' : 'bg-slate-500'],
        ];
        $operations = [
            ['title' => '缂栬緫瀹樼綉椤甸潰', 'desc' => '鏀归椤点€佸叧浜庢垜浠€佷骇鍝佷腑蹇冦€丗AQ銆佽仈绯绘柟寮忕瓑鍏紑椤甸潰銆?, 'href' => route('admin.site-console.pages'), 'icon' => 'pencil-ruler'],
            ['title' => '鍙戝竷琛屼笟璧勮', 'desc' => '鏂囩珷鍙戝竷鍚庤繘鍏ュ畼缃戣涓氳祫璁紝鍚屾椂鏈嶅姟GEO鍐呭璧勪骇銆?, 'href' => route('admin.articles.create'), 'icon' => 'pen-line'],
            ['title' => '缁存姢鍏徃淇℃伅', 'desc' => '鍏徃鍚嶇О銆佽仈绯绘柟寮忋€佸煙鍚嶃€侀〉鑴氫俊鎭粺涓€缁存姢銆?, 'href' => route('admin.site-console.settings'), 'icon' => 'building-2'],
            ['title' => '鍒锋柊AI鎶撳彇鍏ュ彛', 'desc' => '妫€鏌ュ苟鏇存柊 sitemap.xml銆乺obots.txt銆丷SS銆乴lms.txt銆?, 'href' => route('admin.site-console.ai-crawl'), 'icon' => 'refresh-cw'],
        ];
    @endphp

    <div class="mx-auto max-w-[1600px] space-y-6">
        @include('admin.partials.site-cms-nav', ['cmsActive' => 'overview'])

        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="grid gap-0 xl:grid-cols-[1fr_420px]">
                <div class="bg-slate-950 p-7 text-white sm:p-9">
                    <p class="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">Website CMS</p>
                    <h1 class="mt-6 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                        AI鍙嬪ソ瀹樻柟缃戠珯绠＄悊鍙?                    </h1>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                        瀹樼綉杩愯惀璐熻矗瀵瑰灞曠ず銆佽涓氳祫璁€佸鎴风嚎绱㈠拰AI鍙淇℃簮銆傝繍钀ヤ汉鍛樺湪杩欓噷绠＄悊椤甸潰銆佸彂甯冨唴瀹广€佸埛鏂版姄鍙栨枃浠讹紝璁╁鎴峰拰AI鐪嬪埌鍚屼竴濂楀噯纭祫鏂欍€?                    </p>
                    <div class="mt-7 flex flex-wrap gap-3">
                        <a href="{{ route('admin.site-console.pages') }}" class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-500">
                            <i data-lucide="panel-top" class="mr-2 h-4 w-4"></i>
                            绠＄悊瀹樼綉椤甸潰
                        </a>
                        <a href="{{ route('admin.articles.create') }}" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white hover:bg-white/15">
                            <i data-lucide="pen-line" class="mr-2 h-4 w-4"></i>
                            鍐欒涓氳祫璁?                        </a>
                        <a href="{{ url('/index.html') }}" target="_blank" rel="noreferrer" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white hover:bg-white/15">
                            <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
                            棰勮瀹樼綉
                        </a>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-px bg-slate-200">
                    @foreach ($healthItems as $item)
                        <a href="{{ $item['href'] }}" class="bg-white p-6 transition hover:bg-slate-50">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <div class="text-sm font-semibold text-slate-500">{{ $item['label'] }}</div>
                                    <div class="mt-2 text-3xl font-black text-slate-950">{{ $item['value'] }}</div>
                                    <div class="mt-2 text-xs leading-5 text-slate-500">{{ $item['desc'] }}</div>
                                </div>
                                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white {{ $item['tone'] }}">
                                    <i data-lucide="{{ $item['icon'] }}" class="h-5 w-5"></i>
                                </span>
                            </div>
                        </a>
                    @endforeach
                </div>
            </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Operator Flow</p>
                        <h2 class="mt-2 text-2xl font-black text-slate-950">瀹樼綉杩愯惀鏃ュ父鍔ㄤ綔</h2>
                        <p class="mt-2 text-sm leading-6 text-slate-500">鎶婅繍钀ュ悗鍙板仛鎴愭祦绋嬶紝鑰屼笉鏄浜哄埌澶勬壘鎸夐挳銆?/p>
                    </div>
                    <a href="{{ route('admin.geo-console') }}" class="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        杩涘叆GEO杩愯惀
                        <i data-lucide="arrow-right" class="ml-2 h-4 w-4"></i>
                    </a>
                </div>
                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    @foreach ($operations as $operation)
                        <a href="{{ $operation['href'] }}" class="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-blue-50/60">
                            <div class="flex items-start gap-4">
                                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                                    <i data-lucide="{{ $operation['icon'] }}" class="h-5 w-5"></i>
                                </span>
                                <span class="min-w-0">
                                    <span class="block text-base font-black text-slate-950">{{ $operation['title'] }}</span>
                                    <span class="mt-2 block text-sm leading-6 text-slate-600">{{ $operation['desc'] }}</span>
                                </span>
                            </div>
                        </a>
                    @endforeach
                </div>
            </div>

            <aside class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p class="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Site Identity</p>
                <h2 class="mt-2 text-xl font-black text-slate-950">{{ $siteIdentity['brand_name'] ?? '妗愮伡绉戞妧' }}</h2>
                <dl class="mt-5 space-y-3 text-sm">
                    <div class="flex justify-between gap-4">
                        <dt class="text-slate-500">鍏徃涓讳綋</dt>
                        <dd class="max-w-[220px] text-right font-semibold text-slate-900">{{ $siteIdentity['company_name'] ?? '-' }}</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-slate-500">瀹樼綉鍦板潃</dt>
                        <dd class="max-w-[220px] truncate text-right font-semibold text-slate-900">{{ $siteIdentity['base_url'] ?? url('/') }}</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-slate-500">鑱旂郴鐢佃瘽</dt>
                        <dd class="font-semibold text-slate-900">{{ $siteIdentity['telephone_display'] ?? '-' }}</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-slate-500">鍟嗗姟寰俊</dt>
                        <dd class="font-semibold text-slate-900">{{ $siteIdentity['wechat'] ?? '-' }}</dd>
                    </div>
                </dl>
                <a href="{{ route('admin.site-console.settings') }}" class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                    淇敼鍏ㄧ珯淇℃伅
                </a>
            </aside>
        </section>

        <section class="grid gap-6 xl:grid-cols-2">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 class="text-lg font-black text-slate-950">鏈€杩戣涓氳祫璁?/h2>
                    <a href="{{ route('admin.articles.index') }}" class="text-sm font-bold text-blue-600">鏂囩珷涓績</a>
                </div>
                @forelse ($recentArticles as $article)
                    <article class="border-b border-slate-100 px-6 py-4 last:border-b-0">
                        <div class="line-clamp-2 text-sm font-bold leading-6 text-slate-950">{{ $article->title }}</div>
                        <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>{{ $articleStatusLabels[(string) $article->status] ?? (string) $article->status }}</span>
                            <span>{{ $article->updated_at?->format('Y-m-d H:i') }}</span>
                        </div>
                    </article>
                @empty
                    <div class="px-6 py-10 text-sm text-slate-500">鏆傛棤鏂囩珷銆傚彲浠ヤ粠鈥滆涓氳祫璁€濆垱寤虹涓€绡囧畼缃戝唴瀹广€?/div>
                @endforelse
            </div>

            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 class="text-lg font-black text-slate-950">鏈€杩戣〃鍗曠嚎绱?/h2>
                    <a href="{{ route('admin.contact-leads.index') }}" class="text-sm font-bold text-blue-600">绾跨储绠＄悊</a>
                </div>
                @forelse ($recentLeads as $lead)
                    <article class="border-b border-slate-100 px-6 py-4 last:border-b-0">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="truncate text-sm font-bold text-slate-950">{{ $lead->name ?: '鏈～鍐欑О鍛? }}</div>
                                <div class="mt-1 truncate text-xs text-slate-500">{{ $lead->company ?: '鏈～鍐欎紒涓? }} 路 {{ $lead->service ?: '鏈€夋嫨鏈嶅姟' }}</div>
                            </div>
                            <span class="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{{ $lead->status ?: 'new' }}</span>
                        </div>
                        <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{{ $lead->message }}</p>
                    </article>
                @empty
                    <div class="px-6 py-10 text-sm text-slate-500">鏆傛棤绾跨储銆傚畼缃戣仈绯绘柟寮忚〃鍗曟彁浜ゅ悗浼氭樉绀哄湪杩欓噷銆?/div>
                @endforelse
            </div>
        </section>
    </div>
@endsection
