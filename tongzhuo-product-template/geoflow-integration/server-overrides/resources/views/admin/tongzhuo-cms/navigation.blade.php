@extends('admin.layouts.app')

@section('content')
<div class="mx-auto max-w-[1300px] space-y-5">
    <div><div class="text-xs font-black tracking-[0.18em] text-cyan-600">SITE STRUCTURE</div><h1 class="mt-1 text-2xl font-black text-slate-950">导航管理</h1><p class="mt-1 text-sm text-slate-500">这里的顶部导航会直接同步到官网。请保留清晰的页面名称和稳定链接。</p></div>
    <form method="POST" action="{{ route('admin.tongzhuo-cms.navigation.save') }}" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        @csrf
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 class="font-black text-slate-950">顶部导航</h2><p class="mt-1 text-sm text-slate-500">可新增、隐藏或调整显示顺序。</p></div><button type="button" id="add-nav-item" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">添加链接</button></div>
        <div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead class="bg-slate-50 text-xs font-bold text-slate-500"><tr><th class="px-5 py-3">名称</th><th class="px-5 py-3">链接</th><th class="px-5 py-3">区域</th><th class="px-5 py-3">排序</th><th class="px-5 py-3">显示</th><th class="px-5 py-3"></th></tr></thead><tbody id="nav-items">
            @foreach($items as $index => $item)
                <tr class="border-t border-slate-100"><td class="px-5 py-3"><input type="hidden" name="items[{{ $index }}][id]" value="{{ $item->id }}"><input name="items[{{ $index }}][label]" value="{{ $item->label }}" class="w-full rounded-lg border-slate-200 text-sm"></td><td class="px-5 py-3"><input name="items[{{ $index }}][url]" value="{{ $item->url }}" class="w-full rounded-lg border-slate-200 font-mono text-sm"></td><td class="px-5 py-3"><select name="items[{{ $index }}][area]" class="rounded-lg border-slate-200 text-sm"><option value="header" @selected($item->area === 'header')>顶部</option><option value="footer" @selected($item->area === 'footer')>页脚</option></select></td><td class="px-5 py-3"><input type="number" min="1" name="items[{{ $index }}][sort_order]" value="{{ $item->sort_order }}" class="w-20 rounded-lg border-slate-200 text-sm"></td><td class="px-5 py-3"><input type="checkbox" name="items[{{ $index }}][is_visible]" value="1" @checked($item->is_visible) class="rounded border-slate-300 text-blue-600"></td><td class="px-5 py-3 text-right"><button type="button" class="remove-nav text-sm font-bold text-rose-600">删除</button></td></tr>
            @endforeach
        </tbody></table></div>
        <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4"><p class="text-sm text-slate-500">内置页面可直接使用：@foreach($pages as $page)<span class="ml-2 font-mono text-xs text-slate-600">{{ $page->path === '/' ? 'index.html' : ltrim($page->path, '/') }}</span>@endforeach</p><button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">保存导航</button></div>
    </form>
</div>
<template id="nav-row-template"><tr class="border-t border-slate-100"><td class="px-5 py-3"><input name="items[__INDEX__][label]" required placeholder="导航名称" class="w-full rounded-lg border-slate-200 text-sm"></td><td class="px-5 py-3"><input name="items[__INDEX__][url]" required placeholder="about.html" class="w-full rounded-lg border-slate-200 font-mono text-sm"></td><td class="px-5 py-3"><select name="items[__INDEX__][area]" class="rounded-lg border-slate-200 text-sm"><option value="header">顶部</option><option value="footer">页脚</option></select></td><td class="px-5 py-3"><input type="number" min="1" name="items[__INDEX__][sort_order]" value="99" class="w-20 rounded-lg border-slate-200 text-sm"></td><td class="px-5 py-3"><input type="checkbox" name="items[__INDEX__][is_visible]" value="1" checked class="rounded border-slate-300 text-blue-600"></td><td class="px-5 py-3 text-right"><button type="button" class="remove-nav text-sm font-bold text-rose-600">删除</button></td></tr></template>
@push('scripts')
<script>
document.getElementById('add-nav-item')?.addEventListener('click', () => {
    const id = Date.now();
    const template = document.getElementById('nav-row-template').innerHTML.replaceAll('__INDEX__', id);
    document.getElementById('nav-items').insertAdjacentHTML('beforeend', template);
});
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-nav')) event.target.closest('tr').remove();
});
</script>
@endpush
@endsection
