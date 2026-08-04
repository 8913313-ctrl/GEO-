@extends('admin.layouts.app')

@section('content')
<!-- cms_pages_index: page_builder filters status_filter template_filter seo_state module_count version_count -->
@php
    $publishedCount = $allPages->where('status', 'published')->count();
    $draftCount = $allPages->where('status', 'draft')->count();
@endphp
<div class="mx-auto max-w-[1500px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <div class="text-xs font-black tracking-[0.18em] text-blue-600">WEBSITE PAGE BUILDER</div>
                <h1 class="mt-1 text-2xl font-black text-slate-950">页面管理</h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">官网的每个基础页面都在这里维护。页面基础信息负责SEO和导航，内容模块负责前台展示，发布状态决定是否进入稳定官网信源。</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="{{ route('admin.tongzhuo-cms.dashboard') }}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="layout-dashboard" class="h-4 w-4"></i>CMS总览</a>
                <a href="{{ route('admin.tongzhuo-cms.pages.create') }}" class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="plus" class="h-4 w-4"></i>新建页面</a>
            </div>
        </div>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">全部页面</div><div class="mt-2 text-3xl font-black text-slate-950">{{ $allPages->count() }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">已发布</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ $publishedCount }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="text-sm font-bold text-slate-500">草稿</div><div class="mt-2 text-3xl font-black text-amber-600">{{ $draftCount }}</div></div>
    </section>

    <form method="GET" action="{{ route('admin.tongzhuo-cms.pages.index') }}" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
            <label class="block">
                <span class="text-xs font-bold text-slate-500">搜索页面</span>
                <input name="q" value="{{ $filters['q'] ?? '' }}" placeholder="输入页面名称、摘要或slug" class="mt-1 block w-full rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500">
            </label>
            <label class="block">
                <span class="text-xs font-bold text-slate-500">发布状态</span>
                <select name="status" class="mt-1 block w-full rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="all" @selected(($filters['status'] ?? 'all') === 'all')>全部状态</option>
                    <option value="published" @selected(($filters['status'] ?? 'all') === 'published')>已发布</option>
                    <option value="draft" @selected(($filters['status'] ?? 'all') === 'draft')>草稿</option>
                </select>
            </label>
            <label class="block">
                <span class="text-xs font-bold text-slate-500">页面模板</span>
                <select name="template" class="mt-1 block w-full rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="all" @selected(($filters['template'] ?? 'all') === 'all')>全部模板</option>
                    @foreach($templateOptions as $option)
                        <option value="{{ $option }}" @selected(($filters['template'] ?? 'all') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </label>
            <div class="flex items-end gap-2">
                <button class="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="search" class="h-4 w-4"></i>筛选</button>
                <a href="{{ route('admin.tongzhuo-cms.pages.index') }}" class="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">重置</a>
            </div>
        </div>
    </form>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="grid grid-cols-[minmax(260px,1.45fr)_140px_110px_120px_190px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-500">
            <div>页面内容</div>
            <div>模板</div>
            <div>模块</div>
            <div>状态</div>
            <div class="text-right">操作</div>
        </div>
        <div class="divide-y divide-slate-100">
            @forelse ($pages as $page)
                @php
                    $seoTitle = $page->seo['title'] ?? '';
                    $seoDescription = $page->seo['description'] ?? '';
                    $isBuiltIn = in_array($page->slug, $builtInSlugs ?? [], true);
                    $previewUrl = $page->path === '/' ? '/' : $page->path;
                @endphp
                <div class="grid grid-cols-1 gap-4 px-5 py-4 text-sm hover:bg-slate-50 lg:grid-cols-[minmax(260px,1.45fr)_140px_110px_120px_190px] lg:items-center">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="truncate font-black text-slate-950">{{ $page->title }}</div>
                            @if($isBuiltIn)<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">基础页</span>@endif
                        </div>
                        <div class="mt-1 truncate text-xs text-slate-500">{{ $page->description ?: '暂未填写页面摘要，建议补充一句能被AI理解的页面说明。' }}</div>
                        <div class="mt-2 flex flex-wrap gap-2 text-[11px]">
                            <a href="{{ $previewUrl }}" target="_blank" rel="noopener" class="font-mono font-bold text-blue-600 hover:underline">{{ $page->path }}</a>
                            <span class="{{ $seoTitle !== '' ? 'text-emerald-600' : 'text-amber-600' }}">{{ $seoTitle !== '' ? 'SEO标题已填' : '缺SEO标题' }}</span>
                            <span class="{{ $seoDescription !== '' ? 'text-emerald-600' : 'text-amber-600' }}">{{ $seoDescription !== '' ? 'SEO描述已填' : '缺SEO描述' }}</span>
                        </div>
                    </div>
                    <div><span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{{ $page->template_key }}</span></div>
                    <div class="text-sm font-bold text-slate-700">{{ $page->blocks_count ?? 0 }} 个模块<br><span class="text-xs font-normal text-slate-400">{{ $page->versions_count ?? 0 }} 个版本</span></div>
                    <div><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold {{ $page->status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700' }}">{{ $page->status === 'published' ? '已发布' : '草稿' }}</span></div>
                    <div class="flex items-center justify-start gap-3 lg:justify-end">
                        <a href="{{ route('admin.tongzhuo-cms.pages.edit', ['pageId' => $page->id]) }}" class="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800"><i data-lucide="file-pen-line" class="h-4 w-4"></i>编辑</a>
                        <a href="{{ $previewUrl }}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-slate-950"><i data-lucide="external-link" class="h-4 w-4"></i>预览</a>
                    </div>
                </div>
            @empty
                <div class="px-5 py-12 text-center">
                    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><i data-lucide="file-search" class="h-6 w-6"></i></div>
                    <div class="mt-4 font-bold text-slate-900">没有匹配的页面</div>
                    <p class="mt-1 text-sm text-slate-500">调整筛选条件，或新建一个自定义页面。</p>
                </div>
            @endforelse
        </div>
    </section>
</div>
@endsection
