@extends('admin.layouts.app')

@section('content')
<!-- cms_dashboard: operations_hub readiness_score operator_next_actions ai_crawl_endpoints recent_pages recent_articles -->
<div class="mx-auto max-w-[1500px] space-y-5">
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div class="p-6 lg:p-7">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-black tracking-[0.16em] text-blue-700">WEBSITE CMS</span>
                    <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">AI友好官网</span>
                </div>
                <h1 class="mt-4 text-2xl font-black leading-tight text-slate-950 lg:text-3xl">官网运营中枢</h1>
                <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-500">这里管理官网页面、行业资讯、问题地图、导航、全站设置和AI抓取入口。运营人员应该从这里判断：哪些内容已经对外发布，哪些信息还需要补齐，哪些入口正在服务AI读取。</p>
                <div class="mt-6 flex flex-wrap gap-2">
                    <a href="{{ route('admin.tongzhuo-cms.pages.index') }}" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="file-stack" class="h-4 w-4"></i>管理官网页面</a>
                    <a href="{{ route('admin.articles.create') }}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="newspaper" class="h-4 w-4"></i>写行业资讯</a>
                    <a href="{{ route('admin.tongzhuo-cms.faqs.index') }}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="circle-help" class="h-4 w-4"></i>维护问题地图</a>
                </div>
            </div>
            <div class="border-t border-slate-100 bg-slate-950 p-6 text-white xl:border-l xl:border-t-0">
                <div class="text-sm font-bold text-slate-300">内容发布完整度</div>
                <div class="mt-4 flex items-end gap-3">
                    <div class="text-5xl font-black">{{ $contentReadiness['score'] ?? 0 }}%</div>
                    <div class="pb-2 text-xs leading-5 text-slate-400">按官网基础页面发布状态计算<br>草稿页面：{{ $contentReadiness['draft_pages'] ?? 0 }} 个</div>
                </div>
                <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full rounded-full bg-blue-500" style="width: {{ $contentReadiness['score'] ?? 0 }}%"></div>
                </div>
                <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div class="rounded-xl bg-white/8 p-3"><div class="text-slate-400">已发布FAQ</div><div class="mt-1 text-xl font-black">{{ $contentReadiness['published_faq_items'] ?? 0 }}</div></div>
                    <div class="rounded-xl bg-white/8 p-3"><div class="text-slate-400">全站信息</div><div class="mt-1 text-xl font-black">{{ $contentReadiness['settings_score'] ?? 0 }}%</div></div>
                </div>
            </div>
        </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">页面总数</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $stats['pages'] ?? 0 }}</div><div class="mt-2 text-xs text-slate-400">模块 {{ $stats['blocks'] ?? 0 }} 个</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">已发布页面</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $stats['published'] ?? 0 }}</div><div class="mt-2 text-xs text-slate-400">草稿 {{ $stats['drafts'] ?? 0 }} 个</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">行业资讯</div><div class="mt-2 text-3xl font-black text-blue-600">{{ $stats['articles'] ?? 0 }}</div><div class="mt-2 text-xs text-slate-400">发布后进入官网信源</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">客户线索</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $stats['contacts'] ?? 0 }}</div><div class="mt-2 text-xs text-slate-400">来自官网表单</div></div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="space-y-5">
            <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <h2 class="font-black text-slate-950">运营待办</h2>
                        <p class="mt-1 text-sm text-slate-500">把官网维护动作拆成下一步，避免后台只有入口没有流程。</p>
                    </div>
                    <i data-lucide="list-checks" class="h-5 w-5 text-blue-600"></i>
                </div>
                <div class="divide-y divide-slate-100">
                    @foreach($nextActions as $action)
                        <a href="{{ $action['route'] }}" class="flex gap-4 px-5 py-4 transition hover:bg-slate-50">
                            <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {{ $action['level'] === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600' }}">
                                <i data-lucide="{{ $action['level'] === 'done' ? 'check' : 'alert-circle' }}" class="h-4 w-4"></i>
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="flex items-center justify-between gap-3">
                                    <span class="font-bold text-slate-950">{{ $action['title'] }}</span>
                                    <span class="text-xs font-bold text-slate-400">{{ $action['level'] === 'done' ? '已达标' : '待处理：'.$action['count'] }}</span>
                                </span>
                                <span class="mt-1 block text-sm leading-6 text-slate-500">{{ $action['description'] }}</span>
                            </span>
                        </a>
                    @endforeach
                </div>
            </div>

            <div class="grid gap-5 lg:grid-cols-2">
                <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div class="border-b border-slate-100 px-5 py-4"><h2 class="font-black text-slate-950">最近编辑页面</h2></div>
                    <div class="divide-y divide-slate-100">
                        @forelse($recentPages as $page)
                            <a href="{{ route('admin.tongzhuo-cms.pages.edit', ['pageId' => $page->id]) }}" class="block px-5 py-4 hover:bg-slate-50">
                                <div class="flex items-center justify-between gap-3"><span class="truncate font-bold text-slate-950">{{ $page->title }}</span><span class="shrink-0 rounded-full px-2 py-1 text-xs font-bold {{ $page->status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700' }}">{{ $page->status === 'published' ? '已发布' : '草稿' }}</span></div>
                                <div class="mt-1 text-xs text-slate-400">{{ $page->path }} · {{ $page->blocks_count ?? 0 }} 个模块</div>
                            </a>
                        @empty
                            <div class="px-5 py-8 text-sm text-slate-500">暂无页面。</div>
                        @endforelse
                    </div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div class="border-b border-slate-100 px-5 py-4"><h2 class="font-black text-slate-950">最近行业资讯</h2></div>
                    <div class="divide-y divide-slate-100">
                        @forelse($recentArticles as $article)
                            <a href="{{ route('admin.articles.edit', ['articleId' => $article->id]) }}" class="block px-5 py-4 hover:bg-slate-50">
                                <div class="truncate font-bold text-slate-950">{{ $article->title }}</div>
                                <div class="mt-1 text-xs text-slate-400">{{ $article->status ?? 'draft' }} · {{ $article->updated_at }}</div>
                            </a>
                        @empty
                            <div class="px-5 py-8 text-sm text-slate-500">还没有行业资讯，建议先从GEO问题机会生成选题。</div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>

        <aside class="space-y-5">
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between">
                    <div><h2 class="font-black text-slate-950">AI抓取入口</h2><p class="mt-1 text-sm text-slate-500">这些文件是官网做GEO优化的基础设施。</p></div>
                    <i data-lucide="bot" class="h-5 w-5 text-blue-600"></i>
                </div>
                <div class="mt-4 space-y-3">
                    @foreach($aiEndpoints as $endpoint)
                        <a href="{{ $endpoint['path'] }}" target="_blank" rel="noreferrer" class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50">
                            <span class="flex h-8 w-8 items-center justify-center rounded-lg {{ $endpoint['exists'] ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600' }}"><i data-lucide="{{ $endpoint['exists'] ? 'check' : 'x' }}" class="h-4 w-4"></i></span>
                            <span class="min-w-0 flex-1"><span class="block font-mono text-sm font-bold text-slate-900">{{ $endpoint['label'] }}</span><span class="mt-0.5 block truncate text-xs text-slate-400">{{ $endpoint['purpose'] }}</span></span>
                        </a>
                    @endforeach
                </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-black text-slate-950">官网CMS模块</h2>
                <div class="mt-4 grid gap-3">
                    <a href="{{ route('admin.tongzhuo-cms.pages.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>页面管理</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                    <a href="{{ route('admin.tongzhuo-cms.navigation.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>导航管理</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                    <a href="{{ route('admin.tongzhuo-cms.settings.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>全站设置</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                    <a href="{{ route('admin.contact-leads.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>客户线索</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                </div>
            </div>
        </aside>
    </section>
</div>
@endsection
