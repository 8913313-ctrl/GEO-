@extends('admin.layouts.app')

@section('content')
    @php
        $sitePages = $sitePages ?? [];
        $homeServices = $homeServices ?? [];
        $faqItems = $faqItems ?? [];
    @endphp

    <div class="mx-auto max-w-[1600px] space-y-6">
        @include('admin.partials.site-cms-nav', ['cmsActive' => 'pages'])

        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Page Manager</p>
                    <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">瀹樼綉椤甸潰绠＄悊</h1>
                    <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        姣忎釜鍏紑椤甸潰閮芥槸涓€涓彲缁存姢妯″潡銆傚綋鍓嶇増鏈厛缂栬緫椤甸潰SEO銆侀灞忔枃妗堛€侀椤垫湇鍔″崱鐗囧拰FAQ闂瓟锛涗笅涓€姝ヤ細鍗囩骇涓烘暟鎹簱妯″潡鍖栫紪杈戙€佽崏绋裤€佺増鏈洖婊氬拰妯℃澘澶嶅埗銆?                    </p>
                </div>
                <a href="{{ url('/index.html') }}" target="_blank" rel="noreferrer" class="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                    <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
                    棰勮瀹樼綉
                </a>
            </div>
        </section>

        <section class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            @foreach ($sitePages as $key => $page)
                <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                    <div class="flex items-start gap-4">
                        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <i data-lucide="{{ $page['icon'] }}" class="h-5 w-5"></i>
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h2 class="text-lg font-black text-slate-950">{{ $page['name'] }}</h2>
                                    <p class="mt-1 text-sm leading-6 text-slate-500">{{ $page['desc'] }}</p>
                                </div>
                                <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-black {{ !empty($page['writable']) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700' }}">
                                    {{ !empty($page['writable']) ? '鍙紪杈? : '涓嶅彲鍐? }}
                                </span>
                            </div>
                            <dl class="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                                <div class="flex justify-between gap-3">
                                    <dt>鏂囦欢</dt>
                                    <dd class="font-semibold text-slate-800">{{ $page['file'] }}</dd>
                                </div>
                                <div class="flex justify-between gap-3">
                                    <dt>鏇存柊</dt>
                                    <dd class="font-semibold text-slate-800">{{ $page['updated_at'] ?: '-' }}</dd>
                                </div>
                                <div class="flex justify-between gap-3">
                                    <dt>鏍囬</dt>
                                    <dd class="max-w-[240px] truncate font-semibold text-slate-800">{{ $page['title'] ?: '鏈鍙栧埌鏍囬' }}</dd>
                                </div>
                            </dl>
                            <div class="mt-4 flex flex-wrap gap-2">
                                <a href="{{ route('admin.site-console.pages.edit', ['page' => $key]) }}" class="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700">
                                    <i data-lucide="pencil" class="mr-1.5 h-4 w-4"></i>
                                    缂栬緫
                                </a>
                                <a href="{{ $page['preview'] }}" target="_blank" rel="noreferrer" class="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    <i data-lucide="external-link" class="mr-1.5 h-4 w-4"></i>
                                    鏌ョ湅
                                </a>
                            </div>
                        </div>
                    </div>
                </article>
            @endforeach
        </section>

        <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <form method="POST" action="{{ route('admin.site-console.home-services.update') }}" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                @csrf
                <div class="border-b border-slate-100 p-6">
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Homepage Services</p>
                    <h2 class="mt-2 text-2xl font-black text-slate-950">棣栭〉涓夐」鏍稿績鏈嶅姟</h2>
                    <p class="mt-2 text-sm leading-6 text-slate-500">杩欎笁鍧楀搴?GEO浼樺寲銆佺煭瑙嗛杩愯惀銆佷紒涓欰I钀藉湴锛屾槸瀹樼綉棣栭〉鏈€閲嶈鐨勬湇鍔″叆鍙ｃ€?/p>
                </div>
                <div class="space-y-4 p-6">
                    @foreach ($homeServices as $index => $service)
                        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div class="grid gap-4 md:grid-cols-[72px_1fr]">
                                <div>
                                    <label class="block text-xs font-bold text-slate-500" for="service-index-{{ $index }}">搴忓彿</label>
                                    <input id="service-index-{{ $index }}" name="services[{{ $index }}][index]" value="{{ old('services.'.$index.'.index', $service['index'] ?? '') }}" required maxlength="8" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-500" for="service-title-{{ $index }}">鏈嶅姟鍚嶇О</label>
                                    <input id="service-title-{{ $index }}" name="services[{{ $index }}][title]" value="{{ old('services.'.$index.'.title', $service['title'] ?? '') }}" required maxlength="40" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
                                </div>
                            </div>
                            <label class="mt-4 block text-xs font-bold text-slate-500" for="service-summary-{{ $index }}">鏈嶅姟璇存槑</label>
                            <textarea id="service-summary-{{ $index }}" name="services[{{ $index }}][summary]" required maxlength="180" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">{{ old('services.'.$index.'.summary', $service['summary'] ?? '') }}</textarea>
                            <label class="mt-4 block text-xs font-bold text-slate-500" for="service-href-{{ $index }}">璇︽儏閾炬帴</label>
                            <input id="service-href-{{ $index }}" name="services[{{ $index }}][href]" value="{{ old('services.'.$index.'.href', $service['href'] ?? '') }}" required maxlength="120" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
                        </div>
                    @endforeach
                </div>
                <div class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span class="text-xs leading-5 text-slate-500">淇濆瓨鍚庡啓鍥為椤礖TML锛屽苟淇濈暀鍘熸枃浠跺浠姐€?/span>
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700">
                        <i data-lucide="save" class="mr-2 h-4 w-4"></i>
                        淇濆瓨鏈嶅姟鍗＄墖
                    </button>
                </div>
            </form>

            <form method="POST" action="{{ route('admin.site-console.faqs.update') }}" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                @csrf
                <div class="border-b border-slate-100 p-6">
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">FAQ Knowledge</p>
                    <h2 class="mt-2 text-2xl font-black text-slate-950">甯歌闂涓嶢I闂瓟搴?/h2>
                    <p class="mt-2 text-sm leading-6 text-slate-500">FAQ鏃㈢粰瀹㈡埛鐪嬶紝涔熺粰AI鎶撳彇銆傚缓璁敤鐪熷疄瀹㈡埛闂琛ㄨ揪锛屽洖绛旇鍏蜂綋銆佺ǔ瀹氥€佸彲寮曠敤銆?/p>
                </div>
                <div class="space-y-4 p-6">
                    @foreach ($faqItems as $index => $faq)
                        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div class="grid gap-4 md:grid-cols-[150px_1fr]">
                                <div>
                                    <label class="block text-xs font-bold text-slate-500" for="faq-category-{{ $index }}">鍒嗙被</label>
                                    <input id="faq-category-{{ $index }}" name="faqs[{{ $index }}][category]" value="{{ old('faqs.'.$index.'.category', $faq['category'] ?? '') }}" required maxlength="40" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-slate-500" for="faq-question-{{ $index }}">闂</label>
                                    <input id="faq-question-{{ $index }}" name="faqs[{{ $index }}][question]" value="{{ old('faqs.'.$index.'.question', $faq['question'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                                </div>
                            </div>
                            <label class="mt-4 block text-xs font-bold text-slate-500" for="faq-answer-{{ $index }}">鍥炵瓟</label>
                            <textarea id="faq-answer-{{ $index }}" name="faqs[{{ $index }}][answer]" required maxlength="260" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{{ old('faqs.'.$index.'.answer', $faq['answer'] ?? '') }}</textarea>
                        </div>
                    @endforeach
                </div>
                <div class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span class="text-xs leading-5 text-slate-500">淇濆瓨鍚庡悓姝AQ缁撴瀯鍖栨暟鎹紝鎻愬崌AI鐞嗚В璐ㄩ噺銆?/span>
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                        <i data-lucide="save" class="mr-2 h-4 w-4"></i>
                        淇濆瓨FAQ闂瓟
                    </button>
                </div>
            </form>
        </section>
    </div>
@endsection
