@extends('admin.layouts.app')

@section('content')
    @php
        $sitePages = $sitePages ?? [];
        $activeSitePageKey = $activeSitePageKey ?? 'home';
        $activeSitePage = $activeSitePage ?? [];
    @endphp

    <div class="mx-auto max-w-[1600px] space-y-6">
        @include('admin.partials.site-cms-nav', ['cmsActive' => 'pages'])

        <section class="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <aside class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="px-2 pb-3">
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Pages</p>
                    <h2 class="mt-2 text-lg font-black text-slate-950">閫夋嫨椤甸潰</h2>
                </div>
                <nav class="space-y-2">
                    @foreach ($sitePages as $key => $page)
                        <a href="{{ route('admin.site-console.pages.edit', ['page' => $key]) }}"
                           class="@if($activeSitePageKey === $key) border-blue-100 bg-blue-50 text-blue-700 @else border-slate-200 bg-white text-slate-700 hover:bg-slate-50 @endif flex gap-3 rounded-xl border p-3 transition">
                            <span class="@if($activeSitePageKey === $key) bg-blue-600 text-white @else bg-slate-100 text-slate-500 @endif flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                                <i data-lucide="{{ $page['icon'] }}" class="h-5 w-5"></i>
                            </span>
                            <span class="min-w-0">
                                <span class="block text-sm font-black">{{ $page['name'] }}</span>
                                <span class="mt-1 block truncate text-xs {{ $activeSitePageKey === $key ? 'text-blue-500' : 'text-slate-500' }}">{{ $page['file'] }}</span>
                            </span>
                        </a>
                    @endforeach
                </nav>
            </aside>

            <form method="POST" action="{{ route('admin.site-console.pages.update', ['page' => $activeSitePageKey]) }}" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                @csrf
                <div class="border-b border-slate-100 p-6">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Edit Page</p>
                            <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">{{ $activeSitePage['name'] ?? '瀹樼綉椤甸潰' }}</h1>
                            <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{{ $activeSitePage['desc'] ?? '' }}</p>
                        </div>
                        <a href="{{ $activeSitePage['preview'] ?? url('/index.html') }}" target="_blank" rel="noreferrer" class="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
                            棰勮椤甸潰
                        </a>
                    </div>
                </div>

                <div class="space-y-6 p-6">
                    <div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <div class="flex items-start gap-3">
                            <i data-lucide="info" class="mt-0.5 h-5 w-5 shrink-0 text-blue-700"></i>
                            <p class="text-sm leading-6 text-blue-900">
                                褰撳墠缂栬緫鐨勬槸闈欐€佸畼缃戞枃浠朵腑鐨勬牳蹇冨尯鍩熴€備繚瀛樹細鑷姩澶囦唤鍘烪TML锛屽悗缁骇鍝佸寲鐗堟湰浼氭妸杩欎簺瀛楁杩佺Щ鎴愭暟鎹簱妯″潡锛屾敮鎸佽崏绋裤€侀瑙堝拰鐗堟湰鍥炴粴銆?                            </p>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-black text-slate-900" for="title">SEO鏍囬 / 娴忚鍣ㄦ爣棰?/label>
                        <input id="title" name="title" value="{{ old('title', $activeSitePage['title'] ?? '') }}" required maxlength="120" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                        <p class="mt-1.5 text-xs text-slate-500">寤鸿鍖呭惈鍏徃鍚嶃€侀〉闈富棰樺拰鏍稿績鏈嶅姟璇嶃€?/p>
                    </div>

                    <div>
                        <label class="block text-sm font-black text-slate-900" for="description">SEO鎻忚堪 / AI鎽樿</label>
                        <textarea id="description" name="description" required maxlength="240" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{{ old('description', $activeSitePage['description'] ?? '') }}</textarea>
                        <p class="mt-1.5 text-xs text-slate-500">杩欐鍐欏叆 meta description锛屾槸鎼滅储寮曟搸鍜孉I鐞嗚В椤甸潰鐨勯噸瑕佹憳瑕併€?/p>
                    </div>

                    <div class="grid gap-5 lg:grid-cols-[220px_1fr]">
                        <div>
                            <label class="block text-sm font-black text-slate-900" for="hero_eyebrow">棣栧睆鏍囩</label>
                            <input id="hero_eyebrow" name="hero_eyebrow" value="{{ old('hero_eyebrow', $activeSitePage['hero_eyebrow'] ?? '') }}" maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                        </div>
                        <div>
                            <label class="block text-sm font-black text-slate-900" for="hero_title">棣栧睆涓绘爣棰?/label>
                            <textarea id="hero_title" name="hero_title" required maxlength="120" rows="2" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{{ old('hero_title', $activeSitePage['hero_title'] ?? '') }}</textarea>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-black text-slate-900" for="hero_summary">棣栧睆涓绘枃妗?/label>
                        <textarea id="hero_summary" name="hero_summary" required maxlength="360" rows="5" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{{ old('hero_summary', $activeSitePage['hero_summary'] ?? '') }}</textarea>
                    </div>
                </div>

                <div class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <a href="{{ route('admin.site-console.pages') }}" class="inline-flex items-center text-sm font-bold text-slate-600 hover:text-slate-950">
                        <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>
                        杩斿洖椤甸潰绠＄悊
                    </a>
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">
                        <i data-lucide="save" class="mr-2 h-4 w-4"></i>
                        淇濆瓨骞舵洿鏂板畼缃?                    </button>
                </div>
            </form>

            <aside class="space-y-6">
                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 class="text-base font-black text-slate-950">椤甸潰鏂囦欢鐘舵€?/h2>
                    <dl class="mt-4 space-y-3 text-sm">
                        <div class="flex justify-between gap-4"><dt class="text-slate-500">鏂囦欢</dt><dd class="font-semibold text-slate-900">{{ $activeSitePage['file'] ?? '-' }}</dd></div>
                        <div class="flex justify-between gap-4"><dt class="text-slate-500">鍙紪杈?/dt><dd class="font-semibold {{ !empty($activeSitePage['writable']) ? 'text-emerald-700' : 'text-red-600' }}">{{ !empty($activeSitePage['writable']) ? '鏄? : '鍚? }}</dd></div>
                        <div class="flex justify-between gap-4"><dt class="text-slate-500">澶у皬</dt><dd class="font-semibold text-slate-900">{{ number_format(((int) ($activeSitePage['size'] ?? 0)) / 1024, 1) }} KB</dd></div>
                        <div class="flex justify-between gap-4"><dt class="text-slate-500">鏇存柊鏃堕棿</dt><dd class="font-semibold text-slate-900">{{ $activeSitePage['updated_at'] ?: '-' }}</dd></div>
                    </dl>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 class="text-base font-black text-slate-950">鍙戝竷妫€鏌?/h2>
                    <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>鏍囬鍜屾弿杩拌鑳界嫭绔嬭鏄庨〉闈环鍊笺€?/li>
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>棣栧睆鏂囨閬垮厤绌烘硾锛屽敖閲忓啓娓呮湇鍔″璞″拰缁撴灉銆?/li>
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>淇濆瓨鍚庢墦寮€棰勮椤甸潰妫€鏌ユ崲琛屽拰绉诲姩绔睍绀恒€?/li>
                    </ul>
                </div>
            </aside>
        </section>
    </div>
@endsection
