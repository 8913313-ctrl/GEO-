@extends('admin.layouts.app')

@section('content')
    @php
        $aiFiles = $aiFiles ?? [];
        $sitePages = $sitePages ?? [];
        $siteIdentity = $siteIdentity ?? [];
        $publicAssets = [
            ['label' => '瀹樼綉棣栭〉', 'href' => url('/index.html'), 'desc' => '瀹㈡埛鍜孉I鐨勭涓€璁块棶鍏ュ彛'],
            ['label' => '琛屼笟璧勮', 'href' => url('/insights.html'), 'desc' => '宸插彂甯冩枃绔犵殑鍏紑鍒楄〃'],
            ['label' => 'Sitemap', 'href' => url('/sitemap.xml'), 'desc' => '鎼滅储寮曟搸鎶撳彇鍦板浘'],
            ['label' => 'RSS Feed', 'href' => url('/feed.xml'), 'desc' => '璧勮璁㈤槄涓庡悓姝ュ叆鍙?],
            ['label' => 'llms.txt', 'href' => url('/llms.txt'), 'desc' => '缁橝I妯″瀷鐪嬬殑绔欑偣鎽樿'],
            ['label' => 'llms-full.txt', 'href' => url('/llms-full.txt'), 'desc' => '瀹屾暣鍏徃銆佹湇鍔′笌FAQ璇存槑'],
        ];
    @endphp

    <div class="mx-auto max-w-[1500px] space-y-6">
        @include('admin.partials.site-cms-nav', ['cmsActive' => 'ai'])

        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">AI Crawl</p>
                    <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">AI鎶撳彇涓嶨EO淇℃簮璁剧疆</h1>
                    <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        瀹樼綉瑕佺粰浜虹湅锛屼篃瑕佺粰AI鐪嬨€傝繖閲岄泦涓鏌ュ叕寮€鍏ュ彛銆佹姄鍙栨枃浠躲€佺粨鏋勫寲鏁版嵁鍜岀珯鐐瑰熀纭€淇℃伅锛屼繚璇丟EO杩愯惀杈撳嚭鑳藉琚ǔ瀹氳鍙栥€?                    </p>
                </div>
                <form method="POST" action="{{ route('admin.site-console.ai-files.refresh') }}">
                    @csrf
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                        <i data-lucide="refresh-cw" class="mr-2 h-4 w-4"></i>
                        鍒锋柊AI鏂囦欢
                    </button>
                </form>
            </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 p-6">
                    <h2 class="text-xl font-black text-slate-950">鎶撳彇鏂囦欢鐘舵€?/h2>
                    <p class="mt-2 text-sm leading-6 text-slate-500">杩欎簺鏂囦欢蹇呴』淇濇寔鍙闂紝骞朵笖涓嶈兘娈嬬暀妯℃澘鍗犱綅绗︺€?/p>
                </div>
                <div class="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                    @foreach ($aiFiles as $file)
                        <a href="{{ $file['url'] }}" target="_blank" rel="noreferrer" class="bg-white p-5 hover:bg-slate-50">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h3 class="text-base font-black text-slate-950">{{ $file['file'] }}</h3>
                                    <p class="mt-2 text-xs leading-5 text-slate-500">{{ $file['exists'] ? number_format(((int) $file['size']) / 1024, 1).' KB 路 '.$file['updated_at'] : '鏂囦欢涓嶅瓨鍦? }}</p>
                                </div>
                                <span class="rounded-full px-2.5 py-1 text-xs font-black {{ $file['has_placeholders'] ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700' }}">
                                    {{ $file['has_placeholders'] ? '闇€鍒锋柊' : '姝ｅ父' }}
                                </span>
                            </div>
                            <div class="mt-5 inline-flex items-center text-sm font-bold text-blue-600">
                                鎵撳紑妫€鏌?                                <i data-lucide="external-link" class="ml-1.5 h-4 w-4"></i>
                            </div>
                        </a>
                    @endforeach
                </div>
            </div>

            <aside class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 class="text-xl font-black text-slate-950">GEO淇℃簮瑙勫垯</h2>
                <ul class="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                    <li class="flex gap-3"><i data-lucide="badge-check" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"></i>鍏徃涓讳綋銆佹湇鍔¤寖鍥淬€佽仈绯绘柟寮忚鍦ㄥ叏绔欎繚鎸佷竴鑷淬€?/li>
                    <li class="flex gap-3"><i data-lucide="badge-check" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"></i>琛屼笟璧勮鍙睍绀哄悗鍙板凡鍙戝竷鍐呭锛岃崏绋夸笉杩涘叆鍏紑鍏ュ彛銆?/li>
                    <li class="flex gap-3"><i data-lucide="badge-check" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"></i>FAQ銆佷骇鍝侀〉銆佹枃绔犻〉瑕佸敖閲忎娇鐢ㄥ畬鏁撮棶绛斿拰涓氬姟鎻忚堪銆?/li>
                    <li class="flex gap-3"><i data-lucide="badge-check" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"></i>鍒锋柊鏂囦欢鍚庢鏌ュ煙鍚嶆槸鍚︿负姝ｅ紡鍩熷悕锛歿{ $siteIdentity['base_url'] ?? url('/') }}</li>
                </ul>
            </aside>
        </section>

        <section class="grid gap-6 xl:grid-cols-[420px_1fr]">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 class="text-xl font-black text-slate-950">鍏紑鍏ュ彛</h2>
                <div class="mt-5 space-y-3">
                    @foreach ($publicAssets as $asset)
                        <a href="{{ $asset['href'] }}" target="_blank" rel="noreferrer" class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                            <span class="min-w-0">
                                <span class="block truncate text-sm font-black text-slate-950">{{ $asset['label'] }}</span>
                                <span class="mt-0.5 block truncate text-xs text-slate-500">{{ $asset['desc'] }}</span>
                            </span>
                            <i data-lucide="external-link" class="h-4 w-4 shrink-0 text-slate-400"></i>
                        </a>
                    @endforeach
                </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 class="text-xl font-black text-slate-950">椤甸潰鏀跺綍娓呭崟</h2>
                <div class="mt-5 grid gap-3 md:grid-cols-2">
                    @foreach ($sitePages as $key => $page)
                        <a href="{{ $page['preview'] }}" target="_blank" rel="noreferrer" class="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-blue-200 hover:bg-blue-50/50">
                            <div class="flex items-center gap-3">
                                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
                                    <i data-lucide="{{ $page['icon'] }}" class="h-5 w-5"></i>
                                </span>
                                <span class="min-w-0">
                                    <span class="block text-sm font-black text-slate-950">{{ $page['name'] }}</span>
                                    <span class="mt-1 block truncate text-xs text-slate-500">{{ $page['file'] }}</span>
                                </span>
                            </div>
                        </a>
                    @endforeach
                </div>
            </div>
        </section>
    </div>
@endsection
