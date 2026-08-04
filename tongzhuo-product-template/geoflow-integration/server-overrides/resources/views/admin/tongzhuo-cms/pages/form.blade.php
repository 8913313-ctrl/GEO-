@extends('admin.layouts.app')

@section('content')
<!-- cms_page_editor: structured_editor page_settings seo_panel module_editor publish_panel version_history block_delete -->
@php
    $isEditing = $page !== null;
    $seo = $page->seo ?? [];
    $previewUrl = $isEditing ? ($page->path === '/' ? '/' : $page->path) : null;
@endphp
<div class="mx-auto max-w-[1560px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div class="min-w-0">
                <div class="text-xs font-black tracking-[0.18em] text-blue-600">PAGE BUILDER</div>
                <h1 class="mt-1 truncate text-2xl font-black text-slate-950">{{ $isEditing ? $page->title : '新建自定义页面' }}</h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">按“基础信息、SEO、内容模块、发布检查”的顺序维护页面。这里的内容会进入官网页面源代码，服务人类访问，也服务AI抓取。</p>
            </div>
            <div class="flex flex-wrap gap-2">
                @if($isEditing)
                    <a href="{{ $previewUrl }}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="external-link" class="h-4 w-4"></i>打开预览</a>
                @endif
                <a href="{{ route('admin.tongzhuo-cms.pages.index') }}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="arrow-left" class="h-4 w-4"></i>页面列表</a>
            </div>
        </div>
    </section>

    <div class="grid gap-5 2xl:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside class="space-y-4 2xl:sticky 2xl:top-20 2xl:self-start">
            <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-sm font-black text-slate-950">编辑流程</h2>
                <div class="mt-4 space-y-2">
                    <a href="#page-settings" class="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"><i data-lucide="settings-2" class="h-4 w-4"></i>基础信息</a>
                    <a href="#seo-settings" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"><i data-lucide="search" class="h-4 w-4"></i>SEO设置</a>
                    @if($isEditing)
                        <a href="#content-blocks" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"><i data-lucide="blocks" class="h-4 w-4"></i>内容模块</a>
                        <a href="#publish-panel" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"><i data-lucide="send" class="h-4 w-4"></i>发布检查</a>
                    @endif
                </div>
            </section>

            @if($isEditing)
                <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 class="text-sm font-black text-slate-950">模块目录</h2>
                    <div class="mt-3 space-y-2">
                        @forelse($blocks as $block)
                            <a href="#block-{{ $block->id }}" class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                                <span class="min-w-0 truncate font-bold text-slate-700">{{ $block->label }}</span>
                                <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold {{ $block->is_visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500' }}">{{ $block->is_visible ? '显示' : '隐藏' }}</span>
                            </a>
                        @empty
                            <p class="text-sm text-slate-500">暂无模块。</p>
                        @endforelse
                    </div>
                </section>
            @endif
        </aside>

        <main class="space-y-5">
            <form id="page-settings" method="POST" action="{{ $isEditing ? route('admin.tongzhuo-cms.pages.update', ['pageId' => $page->id]) : route('admin.tongzhuo-cms.pages.store') }}" class="rounded-xl border border-slate-200 bg-white shadow-sm">
                @csrf
                @if($isEditing) @method('PUT') @endif
                <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 class="font-black text-slate-950">页面基础信息</h2>
                        <p class="mt-1 text-sm text-slate-500">控制页面标题、URL、导航名称和页面摘要。</p>
                    </div>
                    <button class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="save" class="h-4 w-4"></i>保存页面</button>
                </div>
                <div class="p-5">
                    <div class="grid gap-4 md:grid-cols-2">
                        <label class="block text-sm font-bold text-slate-700">页面名称<input name="title" required value="{{ old('title', $page->title ?? '') }}" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"></label>
                        <label class="block text-sm font-bold text-slate-700">导航名称<input name="navigation_label" value="{{ old('navigation_label', $page->navigation_label ?? '') }}" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"></label>
                        <label class="block text-sm font-bold text-slate-700">页面标识<input name="slug" required {{ $isBuiltIn ? 'readonly' : '' }} value="{{ old('slug', $page->slug ?? '') }}" class="mt-2 block w-full rounded-lg border-slate-200 {{ $isBuiltIn ? 'bg-slate-50' : 'bg-white' }} font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"><span class="mt-1 block text-xs font-normal text-slate-400">{{ $isBuiltIn ? '基础页面地址保持固定，避免官网链接失效。' : '仅小写英文、数字和连字符。' }}</span></label>
                        <label class="block text-sm font-bold text-slate-700">页面模板<select name="template_key" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"><option value="standard" @selected(old('template_key', $page->template_key ?? '') === 'standard')>标准内容页</option><option value="services" @selected(old('template_key', $page->template_key ?? '') === 'services')>服务介绍页</option><option value="faq" @selected(old('template_key', $page->template_key ?? '') === 'faq')>FAQ页面</option><option value="contact" @selected(old('template_key', $page->template_key ?? '') === 'contact')>联系页面</option><option value="company" @selected(old('template_key', $page->template_key ?? '') === 'company')>公司介绍页</option><option value="home" @selected(old('template_key', $page->template_key ?? '') === 'home')>首页</option><option value="cases" @selected(old('template_key', $page->template_key ?? '') === 'cases')>案例页</option><option value="careers" @selected(old('template_key', $page->template_key ?? '') === 'careers')>招聘页</option></select></label>
                        <label class="block text-sm font-bold text-slate-700 md:col-span-2">页面摘要<textarea name="description" rows="3" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">{{ old('description', $page->description ?? '') }}</textarea><span class="mt-1 block text-xs font-normal text-slate-400">建议一句话说清楚页面面向谁、解决什么问题。</span></label>
                        @if($isEditing)
                            <label class="block text-sm font-bold text-slate-700">排序<input type="number" min="0" name="sort_order" value="{{ old('sort_order', $page->sort_order) }}" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"></label>
                        @endif
                    </div>
                </div>

                <div id="seo-settings" class="border-t border-slate-100 p-5">
                    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div class="grid gap-4 md:grid-cols-2">
                            <label class="block text-sm font-bold text-slate-700">SEO标题<input name="seo[title]" value="{{ old('seo.title', $seo['title'] ?? $page->title ?? '') }}" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"></label>
                            <label class="block text-sm font-bold text-slate-700">SEO描述<input name="seo[description]" value="{{ old('seo.description', $seo['description'] ?? $page->description ?? '') }}" class="mt-2 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"></label>
                        </div>
                        <div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <div class="text-xs font-black tracking-[0.14em] text-blue-700">SEARCH PREVIEW</div>
                            <div class="mt-2 truncate text-sm font-bold text-blue-900">{{ old('seo.title', $seo['title'] ?? $page->title ?? '页面标题') }}</div>
                            <div class="mt-1 truncate text-xs text-emerald-700">{{ $isEditing ? ($site->settings['base_url'] ?? request()->getSchemeAndHttpHost()).$page->path : ($site->settings['base_url'] ?? request()->getSchemeAndHttpHost()).'/new-page.html' }}</div>
                            <p class="mt-2 text-xs leading-5 text-slate-600">{{ old('seo.description', $seo['description'] ?? $page->description ?? '这里显示页面摘要，用于搜索和AI理解页面主题。') }}</p>
                        </div>
                    </div>
                </div>
            </form>

            @if($isEditing)
                <section id="content-blocks" class="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h2 class="font-black text-slate-950">内容模块</h2>
                            <p class="mt-1 text-sm text-slate-500">模块保存后会进入官网预览；隐藏模块不会对外展示。</p>
                        </div>
                        <form method="POST" action="{{ route('admin.tongzhuo-cms.pages.blocks.store', ['pageId' => $page->id]) }}" class="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                            @csrf
                            <select name="type" class="rounded-lg border-slate-200 text-sm"><option value="text">图文内容</option><option value="cards">服务卡片</option><option value="faq">常见问题</option><option value="cta">行动引导</option></select>
                            <input name="label" required placeholder="模块名称" class="rounded-lg border-slate-200 text-sm">
                            <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="plus" class="h-4 w-4"></i>添加模块</button>
                        </form>
                    </div>
                    <div class="space-y-4 p-5">
                        @forelse($blocks as $block)
                            @php($content = $block->content ?? [])
                            <article id="block-{{ $block->id }}" class="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                <form method="POST" action="{{ route('admin.tongzhuo-cms.pages.blocks.update', ['blockId' => $block->id]) }}">
                                    @csrf
                                    @method('PUT')
                                    <div class="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center">
                                        <input name="label" value="{{ old('label', $block->label) }}" class="min-w-0 flex-1 rounded-lg border-slate-200 bg-white text-sm font-bold">
                                        <span class="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{{ $blockTypes[$block->type] ?? $block->type }}</span>
                                        <label class="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" name="is_visible" value="1" @checked($block->is_visible) class="rounded border-slate-300 text-blue-600">前台显示</label>
                                        <button class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="save" class="h-4 w-4"></i>保存模块</button>
                                    </div>
                                    <div class="grid gap-4 p-4 md:grid-cols-2">
                                        <label class="text-xs font-bold text-slate-600">小标题<input name="content[eyebrow]" value="{{ old('content.eyebrow', $content['eyebrow'] ?? '') }}" class="mt-1 block w-full rounded-lg border-slate-200 bg-white text-sm"></label>
                                        <label class="text-xs font-bold text-slate-600">主标题<input name="content[heading]" value="{{ old('content.heading', $content['heading'] ?? '') }}" class="mt-1 block w-full rounded-lg border-slate-200 bg-white text-sm"></label>
                                        <label class="text-xs font-bold text-slate-600 md:col-span-2">正文<textarea name="content[body]" rows="5" class="mt-1 block w-full rounded-lg border-slate-200 bg-white text-sm leading-6">{{ old('content.body', $content['body'] ?? '') }}</textarea></label>
                                        <label class="text-xs font-bold text-slate-600">按钮文字<input name="content[button_label]" value="{{ old('content.button_label', $content['button_label'] ?? '') }}" class="mt-1 block w-full rounded-lg border-slate-200 bg-white text-sm"></label>
                                        <label class="text-xs font-bold text-slate-600">按钮链接<input name="content[button_url]" value="{{ old('content.button_url', $content['button_url'] ?? '') }}" class="mt-1 block w-full rounded-lg border-slate-200 bg-white text-sm"></label>
                                    </div>
                                </form>
                                @if($block->block_key !== 'hero')
                                    <form method="POST" action="{{ route('admin.tongzhuo-cms.pages.blocks.delete', ['blockId' => $block->id]) }}" onsubmit="return confirm('确认删除这个内容模块吗？')" class="border-t border-slate-200 bg-white px-4 py-3 text-right">
                                        @csrf
                                        <button class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"><i data-lucide="trash-2" class="h-4 w-4"></i>删除模块</button>
                                    </form>
                                @endif
                            </article>
                        @empty
                            <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">还没有内容模块。先添加一个图文内容或行动引导模块。</div>
                        @endforelse
                    </div>
                </section>
            @endif
        </main>

        @if($isEditing)
            <aside id="publish-panel" class="space-y-4 2xl:sticky 2xl:top-20 2xl:self-start">
                <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h2 class="font-black text-slate-950">发布状态</h2>
                            <p class="mt-1 text-sm text-slate-500">当前：<span class="font-bold {{ $page->status === 'published' ? 'text-emerald-600' : 'text-amber-600' }}">{{ $page->status === 'published' ? '已发布' : '草稿' }}</span></p>
                        </div>
                        <span class="flex h-10 w-10 items-center justify-center rounded-xl {{ $page->status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600' }}"><i data-lucide="{{ $page->status === 'published' ? 'check' : 'file-pen-line' }}" class="h-5 w-5"></i></span>
                    </div>
                    <div class="mt-4 grid gap-2">
                        @if($page->status !== 'published')
                            <form method="POST" action="{{ route('admin.tongzhuo-cms.pages.publish', ['pageId' => $page->id]) }}">@csrf<button class="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">发布到官网</button></form>
                        @else
                            <form method="POST" action="{{ route('admin.tongzhuo-cms.pages.draft', ['pageId' => $page->id]) }}">@csrf<button class="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100">转为草稿</button></form>
                        @endif
                    </div>
                </section>

                <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 class="font-black text-slate-950">发布检查</h2>
                    <div class="mt-4 space-y-3 text-sm">
                        <div class="flex items-center justify-between gap-3"><span class="text-slate-600">页面摘要</span><span class="font-bold {{ $editorSummary['has_description'] ? 'text-emerald-600' : 'text-amber-600' }}">{{ $editorSummary['has_description'] ? '已填写' : '待补充' }}</span></div>
                        <div class="flex items-center justify-between gap-3"><span class="text-slate-600">SEO标题</span><span class="font-bold {{ $editorSummary['has_seo_title'] ? 'text-emerald-600' : 'text-amber-600' }}">{{ $editorSummary['has_seo_title'] ? '已填写' : '待补充' }}</span></div>
                        <div class="flex items-center justify-between gap-3"><span class="text-slate-600">SEO描述</span><span class="font-bold {{ $editorSummary['has_seo_description'] ? 'text-emerald-600' : 'text-amber-600' }}">{{ $editorSummary['has_seo_description'] ? '已填写' : '待补充' }}</span></div>
                        <div class="flex items-center justify-between gap-3"><span class="text-slate-600">可见模块</span><span class="font-bold text-slate-900">{{ $editorSummary['visible_blocks'] }} 个</span></div>
                        <div class="flex items-center justify-between gap-3"><span class="text-slate-600">隐藏模块</span><span class="font-bold text-slate-500">{{ $editorSummary['hidden_blocks'] }} 个</span></div>
                    </div>
                </section>

                <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 class="font-black text-slate-950">页面信息</h2>
                    <div class="mt-4 space-y-3 text-sm text-slate-600">
                        <div><span class="font-bold text-slate-900">路径：</span><a href="{{ $previewUrl }}" target="_blank" rel="noopener" class="font-mono text-blue-600 hover:underline">{{ $page->path }}</a></div>
                        <div><span class="font-bold text-slate-900">模板：</span>{{ $page->template_key }}</div>
                        <div><span class="font-bold text-slate-900">更新时间：</span>{{ $page->updated_at }}</div>
                    </div>
                </section>

                <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 class="font-black text-slate-950">最近版本</h2>
                    <div class="mt-3 space-y-3">
                        @forelse($versions as $version)
                            <div class="border-l-2 border-slate-200 pl-3 text-sm">
                                <div class="font-bold text-slate-700">V{{ $version->version_number }} · {{ $version->status }}</div>
                                <div class="mt-1 text-xs text-slate-400">{{ $version->created_at }}</div>
                            </div>
                        @empty
                            <p class="text-sm text-slate-500">保存后会自动生成版本记录。</p>
                        @endforelse
                    </div>
                </section>
            </aside>
        @endif
    </div>
</div>
@endsection
