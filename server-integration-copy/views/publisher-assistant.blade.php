@extends('admin.layouts.app')

@section('content')
    <div class="px-4 sm:px-0">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">TONGZHUO / DISTRIBUTION CONTROL</p>
                <h1 class="mt-2 text-2xl font-bold text-gray-900">发布助手</h1>
                <p class="mt-1 text-sm text-gray-600">从 GEOFlow 读取任务，统一选择平台并查看发布结果。</p>
            </div>
            <a href="{{ url('/publisher-assistant/healthz') }}" target="_blank" rel="noreferrer" class="text-sm font-medium text-blue-600 hover:text-blue-800">查看服务状态</a>
        </div>
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <iframe
                src="{{ url('/publisher-assistant/') }}"
                title="桐灼 GEOFlow 发布助手"
                class="block h-[calc(100vh-190px)] min-h-[780px] w-full border-0"
                loading="eager"></iframe>
        </div>
    </div>
@endsection
