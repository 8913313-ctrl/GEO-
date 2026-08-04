@extends('admin.layouts.app')

@section('content')
<!-- distribution_console: channel_health distribution_queue local_publisher_boundary recent_jobs recent_logs operator_actions -->
@php
    $typeLabels = [
        'geoflow_agent' => 'GEOFlow目标站',
        'wordpress_rest' => 'WordPress REST',
        'desktop_publisher' => '桌面发布器',
        'wechatsync_manual' => '半自动多平台',
    ];
    $statusClasses = [
        'active' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        'paused' => 'bg-slate-100 text-slate-600 ring-slate-200',
    ];
@endphp
<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="grid xl:grid-cols-[minmax(0,1fr)_420px]">
            <div class="bg-slate-950 p-6 text-white sm:p-8">
                <div class="text-xs font-black tracking-[0.2em] text-cyan-300">DISTRIBUTION CONSOLE</div>
                <h1 class="mt-3 text-3xl font-black tracking-tight">分发管理</h1>
                <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-300">这里管理官网文章进入外部平台的发布链路：渠道、任务、设备、失败重试和人工确认。服务器只保存任务和结果，第三方平台登录态留在本地授权设备。</p>
                <div class="mt-6 flex flex-wrap gap-2">
                    <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300"><i data-lucide="list-checks" class="h-4 w-4"></i>处理分发任务</a>
                    <a href="{{ route('admin.distribution.create') }}" class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"><i data-lucide="plus" class="h-4 w-4"></i>新增渠道</a>
                    <a href="{{ route('admin.publisher-assistant') }}" class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"><i data-lucide="monitor-up" class="h-4 w-4"></i>发布助手</a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-px bg-slate-200">
                <a href="{{ route('admin.distribution.index') }}" class="bg-white p-5 hover:bg-slate-50"><div class="text-sm font-bold text-slate-500">启用渠道</div><div class="mt-2 text-3xl font-black text-emerald-600">{{ (int) ($stats['active'] ?? 0) }}</div><div class="mt-2 text-xs text-slate-400">暂停 {{ (int) ($stats['paused'] ?? 0) }}</div></a>
                <a href="{{ route('admin.distribution.jobs', ['status' => 'queued']) }}" class="bg-white p-5 hover:bg-slate-50"><div class="text-sm font-bold text-slate-500">待处理任务</div><div class="mt-2 text-3xl font-black text-blue-600">{{ (int) ($stats['pending'] ?? 0) }}</div><div class="mt-2 text-xs text-slate-400">排队或处理中</div></a>
                <a href="{{ route('admin.distribution.jobs', ['status' => 'failed']) }}" class="bg-white p-5 hover:bg-slate-50"><div class="text-sm font-bold text-slate-500">失败任务</div><div class="mt-2 text-3xl font-black text-red-600">{{ (int) ($stats['failed'] ?? 0) }}</div><div class="mt-2 text-xs text-slate-400">需要排查</div></a>
                <a href="{{ route('admin.publisher-devices.index') }}" class="bg-white p-5 hover:bg-slate-50"><div class="text-sm font-bold text-slate-500">在线设备</div><div class="mt-2 text-3xl font-black text-amber-600">{{ (int) ($stats['online_devices'] ?? 0) }}</div><div class="mt-2 text-xs text-slate-400">本地执行器</div></a>
            </div>
        </div>
    </section>

    @if (session('distribution_secret'))
        @php($secret = session('distribution_secret'))
        <section class="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div class="flex items-start gap-3">
                <i data-lucide="key-round" class="mt-0.5 h-5 w-5 text-amber-700"></i>
                <div class="min-w-0 flex-1">
                    <h2 class="font-black text-amber-950">{{ __('admin.distribution.secret_notice_title') }}</h2>
                    <p class="mt-1 text-sm leading-6 text-amber-800">{{ __('admin.distribution.secret_notice_desc') }}</p>
                    <div class="mt-4 grid gap-3 md:grid-cols-3">
                        <code class="break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">{{ $secret['key_id'] ?? '' }}</code>
                        <code class="break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">{{ $secret['secret'] ?? '' }}</code>
                        <code class="break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">{{ $secret['endpoint_url'] ?? '' }}</code>
                    </div>
                </div>
            </div>
        </section>
    @endif

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 class="font-black text-slate-950">渠道健康</h2>
                    <p class="mt-1 text-sm text-slate-500">渠道决定文章发布后进入哪些目标站或本地发布流程。</p>
                </div>
                <div class="flex flex-wrap gap-2 text-xs font-bold">
                    @foreach($typeLabels as $type => $label)
                        @if((int) ($channelTypeSummary[$type] ?? 0) > 0)
                            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{{ $label }} {{ (int) $channelTypeSummary[$type] }}</span>
                        @endif
                    @endforeach
                </div>
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($channels as $channel)
                    @php($type = $channel->channelType())
                    <div class="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_150px] lg:items-center">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="truncate font-bold text-slate-950">{{ $channel->name }}</span>
                                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{{ $typeLabels[$type] ?? $type }}</span>
                            </div>
                            <div class="mt-1 truncate text-xs text-slate-500">{{ $channel->domain }} · {{ $channel->endpoint_url }}</div>
                            @if($channel->last_error_message)
                                <div class="mt-1 truncate text-xs text-red-600">{{ $channel->last_error_message }}</div>
                            @endif
                        </div>
                        <div><span class="rounded-full px-2.5 py-1 text-xs font-bold ring-1 {{ $statusClasses[$channel->status] ?? 'bg-slate-100 text-slate-600 ring-slate-200' }}">{{ $channel->status === 'active' ? '启用' : '暂停' }}</span></div>
                        <div class="text-sm font-bold text-slate-700">待处理 {{ (int) $channel->pending_count }}<br><span class="text-xs font-normal text-red-500">失败 {{ (int) $channel->failed_count }}</span></div>
                        <div class="flex gap-3 lg:justify-end">
                            <a href="{{ route('admin.distribution.show', ['channelId' => (int) $channel->id]) }}" class="font-bold text-blue-600 hover:text-blue-800">查看</a>
                            <a href="{{ route('admin.distribution.edit', ['channelId' => (int) $channel->id]) }}" class="font-bold text-slate-600 hover:text-slate-950">编辑</a>
                        </div>
                    </div>
                @empty
                    <div class="px-5 py-12 text-center text-sm text-slate-500">还没有分发渠道。先新增一个本地发布器或目标站渠道。</div>
                @endforelse
            </div>
        </div>

        <aside class="space-y-5">
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-black text-slate-950">发布边界</h2>
                <p class="mt-2 text-sm leading-6 text-slate-500">后台负责文章、平台选择、任务状态和结果回写；平台账号、验证码和登录态由本地授权设备处理。</p>
                <div class="mt-4 grid gap-2">
                    <a href="{{ route('admin.publisher-devices.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>发布设备</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                    <a href="{{ route('admin.publisher-assistant') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>发布助手</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                    <a href="{{ route('admin.articles.index') }}" class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><span>文章管理</span><i data-lucide="arrow-right" class="h-4 w-4"></i></a>
                </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 class="font-black text-slate-950">最近日志</h2>
                <div class="mt-4 space-y-3">
                    @forelse($logs as $log)
                        <div class="border-l-2 border-slate-200 pl-3">
                            <div class="line-clamp-2 text-sm font-bold text-slate-800">{{ $log->message }}</div>
                            <div class="mt-1 text-xs text-slate-400">{{ $log->channel?->name ?? '无渠道' }} · {{ $log->created_at?->format('Y-m-d H:i') }}</div>
                        </div>
                    @empty
                        <p class="text-sm text-slate-500">暂无分发日志。</p>
                    @endforelse
                </div>
            </div>
        </aside>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 class="font-black text-slate-950">最近分发任务</h2>
                <p class="mt-1 text-sm text-slate-500">失败任务要及时重试或记录人工处理结果。</p>
            </div>
            <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="list-checks" class="h-4 w-4"></i>全部任务</a>
        </div>
        @include('admin.distribution._jobs-table', ['jobs' => $recentJobs])
    </section>
</div>
@endsection
