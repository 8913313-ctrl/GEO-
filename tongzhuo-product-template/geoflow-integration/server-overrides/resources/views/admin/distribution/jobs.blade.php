@extends('admin.layouts.app')

@section('content')
<!-- distribution_jobs: queue_filters job_status_overview retry_failed operator_confirmation publisher_result_writeback -->
@php
    $statusCards = [
        ['key' => 'queued', 'label' => '待执行', 'value' => (int) ($jobStats['queued'] ?? 0), 'tone' => 'text-blue-600', 'href' => route('admin.distribution.jobs', ['status' => 'queued'])],
        ['key' => 'sending', 'label' => '处理中', 'value' => (int) ($jobStats['sending'] ?? 0), 'tone' => 'text-amber-600', 'href' => route('admin.distribution.jobs', ['status' => 'sending'])],
        ['key' => 'synced', 'label' => '已送达', 'value' => (int) ($jobStats['synced'] ?? 0), 'tone' => 'text-emerald-600', 'href' => route('admin.distribution.jobs', ['status' => 'synced'])],
        ['key' => 'failed', 'label' => '失败', 'value' => (int) ($jobStats['failed'] ?? 0), 'tone' => 'text-red-600', 'href' => route('admin.distribution.jobs', ['status' => 'failed'])],
    ];
@endphp
<div class="mx-auto max-w-[1600px] space-y-5">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
                <a href="{{ route('admin.distribution.index') }}" class="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800"><i data-lucide="arrow-left" class="h-4 w-4"></i>返回分发管理</a>
                <div class="mt-4 text-xs font-black tracking-[0.18em] text-blue-600">DISTRIBUTION QUEUE</div>
                <h1 class="mt-1 text-2xl font-black text-slate-950">分发任务队列</h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">文章发布后会进入这里。运营人员可以筛选任务、查看发布助手回写、记录人工确认、重试失败任务。</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="{{ route('admin.publisher-assistant') }}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><i data-lucide="monitor-up" class="h-4 w-4"></i>发布助手</a>
                <a href="{{ route('admin.articles.index') }}" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="newspaper" class="h-4 w-4"></i>文章管理</a>
            </div>
        </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        @foreach($statusCards as $card)
            <a href="{{ $card['href'] }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
                <div class="text-sm font-bold text-slate-500">{{ $card['label'] }}</div>
                <div class="mt-2 text-3xl font-black {{ $card['tone'] }}">{{ $card['value'] }}</div>
            </a>
        @endforeach
        <a href="{{ route('admin.publisher-devices.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm font-bold text-slate-500">在线设备</div><div class="mt-2 text-3xl font-black text-cyan-600">{{ (int) ($jobStats['online_devices'] ?? 0) }}</div></a>
        <a href="{{ route('admin.distribution.index') }}" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div class="text-sm font-bold text-slate-500">启用渠道</div><div class="mt-2 text-3xl font-black text-slate-950">{{ (int) ($jobStats['active_channels'] ?? 0) }}</div></a>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <form method="GET" action="{{ route('admin.distribution.jobs') }}" class="grid gap-4 border-b border-slate-100 px-5 py-4 md:grid-cols-[180px_minmax(180px,260px)_auto]">
            <label class="block">
                <span class="text-xs font-bold text-slate-500">{{ __('admin.distribution.field.status') }}</span>
                <select id="status" name="status" class="mt-1 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">{{ __('admin.distribution.filter.all_statuses') }}</option>
                    @foreach (['queued', 'sending', 'synced', 'failed'] as $status)
                        <option value="{{ $status }}" @selected(($filters['status'] ?? '') === $status)>{{ __('admin.distribution.job_status.'.$status) }}</option>
                    @endforeach
                </select>
            </label>
            <label class="block">
                <span class="text-xs font-bold text-slate-500">{{ __('admin.distribution.field.channel') }}</span>
                <select id="channel_id" name="channel_id" class="mt-1 block w-full rounded-lg border-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="0">{{ __('admin.distribution.filter.all_channels') }}</option>
                    @foreach ($channels as $channel)
                        <option value="{{ (int) $channel->id }}" @selected((int) ($filters['channel_id'] ?? 0) === (int) $channel->id)>{{ $channel->name }}</option>
                    @endforeach
                </select>
            </label>
            <div class="flex items-end gap-2">
                <button type="submit" class="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"><i data-lucide="filter" class="h-4 w-4"></i>{{ __('admin.button.filter') }}</button>
                <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">{{ __('admin.button.reset') }}</a>
            </div>
        </form>
        <div class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 class="font-black text-slate-950">{{ __('admin.distribution.jobs_title') }}</h2>
                <p class="mt-1 text-sm text-slate-500">表格内可直接查看发布助手状态、平台结果、失败原因和人工确认入口。</p>
            </div>
            <div class="text-xs font-bold text-slate-400">当前筛选：{{ $filters['status'] ?: '全部状态' }}</div>
        </div>
        @include('admin.distribution._jobs-table', ['jobs' => $jobs])
    </section>
</div>
@endsection
