@extends('admin.layouts.app')

@section('content')
    @php($siteIdentity = $siteIdentity ?? [])

    <div class="mx-auto max-w-[1400px] space-y-6">
        @include('admin.partials.site-cms-nav', ['cmsActive' => 'settings'])

        <form method="POST" action="{{ route('admin.site-console.site-identity.update') }}" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            @csrf
            <div class="border-b border-slate-100 p-6">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Site Settings</p>
                        <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">鍏ㄧ珯鍩虹淇℃伅</h1>
                        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                            杩欓噷缁存姢鍏徃涓讳綋銆佽仈绯绘柟寮忋€佸畼缃戞寮忓煙鍚嶅拰椤佃剼鏂囨銆備繚瀛樺悗浼氬悓姝ュ畼缃戦〉闈€佺粨鏋勫寲鏁版嵁銆丼itemap銆丷obots 鍜?llms 鏂囦欢銆?                        </p>
                    </div>
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                        <i data-lucide="save" class="mr-2 h-4 w-4"></i>
                        淇濆瓨鍏ㄧ珯淇℃伅
                    </button>
                </div>
            </div>

            <div class="grid gap-8 p-6 xl:grid-cols-[1fr_360px]">
                <div class="space-y-8">
                    <section>
                        <h2 class="text-lg font-black text-slate-950">鍏徃涓庡搧鐗?/h2>
                        <div class="mt-4 grid gap-5 lg:grid-cols-2">
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="company_name">鍏徃鍏ㄧО</label>
                                <input id="company_name" name="company_name" value="{{ old('company_name', $siteIdentity['company_name'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="brand_name">鍝佺墝绠€绉?/label>
                                <input id="brand_name" name="brand_name" value="{{ old('brand_name', $siteIdentity['brand_name'] ?? '') }}" required maxlength="40" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="brand_aliases">鍝佺墝鍒悕</label>
                                <input id="brand_aliases" name="brand_aliases" value="{{ old('brand_aliases', $siteIdentity['brand_aliases'] ?? '') }}" maxlength="120" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="base_url">瀹樼綉姝ｅ紡鍦板潃</label>
                                <input id="base_url" name="base_url" value="{{ old('base_url', $siteIdentity['base_url'] ?? url('/')) }}" required maxlength="160" placeholder="https://浣犵殑鍩熷悕" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="founding_date">鎴愮珛鏃ユ湡</label>
                                <input id="founding_date" name="founding_date" value="{{ old('founding_date', $siteIdentity['founding_date'] ?? '') }}" maxlength="30" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="credit_code">缁熶竴绀句細淇＄敤浠ｇ爜</label>
                                <input id="credit_code" name="credit_code" value="{{ old('credit_code', $siteIdentity['credit_code'] ?? '') }}" maxlength="60" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 class="text-lg font-black text-slate-950">鑱旂郴涓庡湴鍧€</h2>
                        <div class="mt-4 grid gap-5 lg:grid-cols-2">
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="telephone">鑱旂郴鐢佃瘽</label>
                                <input id="telephone" name="telephone" value="{{ old('telephone', $siteIdentity['telephone'] ?? '') }}" required maxlength="30" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="telephone_display">鐢佃瘽灞曠ず鏍煎紡</label>
                                <input id="telephone_display" name="telephone_display" value="{{ old('telephone_display', $siteIdentity['telephone_display'] ?? '') }}" required maxlength="40" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="wechat">鍟嗗姟寰俊</label>
                                <input id="wechat" name="wechat" value="{{ old('wechat', $siteIdentity['wechat'] ?? '') }}" required maxlength="60" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="email">鍟嗗姟閭</label>
                                <input id="email" name="email" value="{{ old('email', $siteIdentity['email'] ?? '') }}" maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="address_region">鐪佷唤</label>
                                <input id="address_region" name="address_region" value="{{ old('address_region', $siteIdentity['address_region'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="address_locality">鍩庡競/鍖哄幙</label>
                                <input id="address_locality" name="address_locality" value="{{ old('address_locality', $siteIdentity['address_locality'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div class="lg:col-span-2">
                                <label class="block text-sm font-bold text-slate-900" for="street_address">璇︾粏鍦板潃</label>
                                <input id="street_address" name="street_address" value="{{ old('street_address', $siteIdentity['street_address'] ?? '') }}" required maxlength="120" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 class="text-lg font-black text-slate-950">椤佃剼涓庢湇鍔¤寖鍥?/h2>
                        <div class="mt-4 grid gap-5 lg:grid-cols-2">
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="service_area">鏈嶅姟鍖哄煙</label>
                                <input id="service_area" name="service_area" value="{{ old('service_area', $siteIdentity['service_area'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-900" for="footer_slogan">椤佃剼鍙充晶鐭</label>
                                <input id="footer_slogan" name="footer_slogan" value="{{ old('footer_slogan', $siteIdentity['footer_slogan'] ?? '') }}" required maxlength="80" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                            </div>
                            <div class="lg:col-span-2">
                                <label class="block text-sm font-bold text-slate-900" for="footer_summary">椤佃剼鍏徃璇存槑</label>
                                <textarea id="footer_summary" name="footer_summary" required maxlength="160" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{{ old('footer_summary', $siteIdentity['footer_summary'] ?? '') }}</textarea>
                            </div>
                        </div>
                    </section>
                </div>

                <aside class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h2 class="text-base font-black text-slate-950">淇濆瓨鍚庝細鍚屾</h2>
                    <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>瀹樼綉椤佃剼銆佽仈绯绘柟寮忋€佺粨鏋勫寲鍏徃淇℃伅銆?/li>
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>sitemap.xml銆乺obots.txt銆乴lms.txt銆乴lms-full.txt銆?/li>
                        <li class="flex gap-2"><i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"></i>鏂板鎴峰鍒舵ā鏉挎椂锛屽彧闇€瑕佹浛鎹㈣繖閲岀殑鍏徃閰嶇疆銆?/li>
                    </ul>
                    <button type="submit" class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
                        <i data-lucide="save" class="mr-2 h-4 w-4"></i>
                        淇濆瓨骞跺悓姝?                    </button>
                </aside>
            </div>
        </form>
    </div>
@endsection
