@extends('admin.layouts.app')

@section('content')
    @php
        $jobStatusLabels = [
            'queued' => '待执行',
            'sending' => '处理中',
            'synced' => '已同步',
            'failed' => '失败',
        ];
        $jobStatusClasses = [
            'queued' => 'bg-blue-50 text-blue-700 ring-blue-200',
            'sending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'synced' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'failed' => 'bg-red-50 text-red-700 ring-red-200',
        ];
        $deviceLabels = [
            'online' => '在线',
            'offline' => '离线',
            'pending' => '待连接',
            'disabled' => '已禁用',
        ];
        $deviceClasses = [
            'online' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'offline' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'pending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'disabled' => 'bg-red-50 text-red-700 ring-red-200',
        ];
        $pendingJobs = (int) ($jobCounts['queued'] ?? 0) + (int) ($jobCounts['sending'] ?? 0);
        $activeChannels = $localChannels->where('status', 'active')->count();
    @endphp

    <div class="space-y-6 px-4 sm:px-0">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">TONGZHUO LOCAL PUBLISHER</p>
                <h1 class="mt-2 text-2xl font-bold text-gray-950">桐灼本地发布助手</h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                    GEOFlow 负责任务队列、文章载荷和结果回写；客户电脑上的本地发布助手负责平台登录、草稿填充、验证码人工接管和发布确认。
                </p>
            </div>
            <div class="flex flex-wrap gap-3">
                <a href="http://127.0.0.1:18280/" target="_blank" rel="noreferrer" class="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
                    <i data-lucide="monitor-up" class="mr-2 h-4 w-4"></i>
                    打开本机助手
                </a>
                <form method="POST" action="{{ route('admin.publisher-assistant.bootstrap-channel') }}">
                    @csrf
                    <button type="submit" class="inline-flex items-center rounded-md border border-cyan-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50">
                        <i data-lucide="wand-2" class="mr-2 h-4 w-4"></i>
                        初始化默认渠道
                    </button>
                </form>
                <form method="POST" action="{{ route('admin.publisher-assistant.enqueue-published') }}">
                    @csrf
                    <button type="submit" class="inline-flex items-center rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                        <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                        同步已发布文章
                    </button>
                </form>
                <a href="{{ route('admin.distribution.create') }}" class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                    新建发布渠道
                </a>
            </div>
        </div>

        @if ($activeChannels === 0)
            <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-5 py-4">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div class="text-sm font-semibold text-cyan-950">还没有启用的本地发布渠道</div>
                        <p class="mt-1 text-sm leading-6 text-cyan-800">点击初始化后，系统会创建“桐灼本地发布助手”渠道，并默认选择微信公众号、知乎、头条号和本地导出包。</p>
                    </div>
                    <form method="POST" action="{{ route('admin.publisher-assistant.bootstrap-channel') }}" class="flex-none">
                        @csrf
                        <button type="submit" class="inline-flex w-full items-center justify-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 md:w-auto">
                            <i data-lucide="sparkles" class="mr-2 h-4 w-4"></i>
                            一键创建默认渠道
                        </button>
                    </form>
                </div>
            </div>
        @endif

        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <article class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">本地发布渠道</div>
                <div class="mt-2 text-3xl font-semibold text-gray-950">{{ $activeChannels }}</div>
                <div class="mt-1 text-xs text-gray-500">启用中的 desktop_publisher 渠道</div>
            </article>
            <article class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">待处理任务</div>
                <div class="mt-2 text-3xl font-semibold text-gray-950">{{ $pendingJobs }}</div>
                <div class="mt-1 text-xs text-gray-500">排队和处理中任务</div>
            </article>
            <article class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">在线设备</div>
                <div class="mt-2 text-3xl font-semibold text-gray-950">{{ $onlineDevices }}</div>
                <div class="mt-1 text-xs text-gray-500">最近 2 分钟有心跳</div>
            </article>
            <article class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">失败任务</div>
                <div class="mt-2 text-3xl font-semibold text-gray-950">{{ (int) ($jobCounts['failed'] ?? 0) }}</div>
                <div class="mt-1 text-xs text-gray-500">需要检查平台登录或页面变化</div>
            </article>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section class="rounded-lg bg-white p-6 shadow-sm lg:col-span-2">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-lg font-semibold text-gray-950">使用流程</h2>
                        <p class="mt-1 text-sm text-gray-600">先把通道和本地设备连起来，再从文章管理发布内容。</p>
                    </div>
                    <a href="{{ route('admin.distribution.jobs') }}" class="text-sm font-medium text-cyan-700 hover:text-cyan-900">查看全部任务</a>
                </div>
                <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-3">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">1</span>
                            <div class="font-medium text-gray-950">创建本地发布渠道</div>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-gray-600">在分发管理中新建“桐灼本地发布助手”，选择知乎、公众号、头条和本地导出包等需要执行的平台。</p>
                    </div>
                    <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-3">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">2</span>
                            <div class="font-medium text-gray-950">安装并注册本地助手</div>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-gray-600">客户电脑安装桌面执行器，填写 GEOFlow 地址和 API Token，注册后后台会出现发布设备。</p>
                    </div>
                    <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-3">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">3</span>
                            <div class="font-medium text-gray-950">完成平台登录</div>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-gray-600">在本地助手中打开平台登录窗口，扫码、验证码和滑块都在客户本机处理，登录态不进入服务器。</p>
                    </div>
                    <div class="rounded-md border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-3">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">4</span>
                            <div class="font-medium text-gray-950">发布文章并回写结果</div>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-gray-600">文章发布后自动进入队列，本地助手领取任务，完成草稿填充或发布确认后把结果写回 GEOFlow。</p>
                    </div>
                </div>
            </section>

            <section class="rounded-lg bg-white p-6 shadow-sm">
                <h2 class="text-lg font-semibold text-gray-950">操作入口</h2>
                <div class="mt-5 space-y-3">
                    <a href="{{ route('admin.distribution.create') }}" class="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        <span>创建发布渠道</span>
                        <i data-lucide="chevron-right" class="h-4 w-4 text-gray-400"></i>
                    </a>
                    <a href="{{ route('admin.distribution.jobs') }}" class="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        <span>查看分发任务</span>
                        <i data-lucide="chevron-right" class="h-4 w-4 text-gray-400"></i>
                    </a>
                    <a href="{{ route('admin.publisher-devices.index') }}" class="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        <span>管理发布设备</span>
                        <i data-lucide="chevron-right" class="h-4 w-4 text-gray-400"></i>
                    </a>
                    <a href="{{ route('admin.articles.index') }}" class="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        <span>进入文章管理</span>
                        <i data-lucide="chevron-right" class="h-4 w-4 text-gray-400"></i>
                    </a>
                </div>
                <div class="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    目前成熟适配器优先支持知乎、微信公众号和头条号；本地导出包可作为所有平台的人工发布兜底。其他平台会进入“待适配”状态，后续按客户需求逐个平台补齐。
                </div>
            </section>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section class="overflow-hidden rounded-lg bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h2 class="text-lg font-semibold text-gray-950">最近本地发布任务</h2>
                    <a href="{{ route('admin.distribution.jobs') }}" class="text-sm font-medium text-cyan-700 hover:text-cyan-900">全部任务</a>
                </div>
                @if ($recentJobs->isEmpty())
                    <div class="px-6 py-10 text-sm text-gray-500">还没有本地发布任务。创建本地发布渠道后，文章发布会自动进入这里。</div>
                @else
                    <div class="divide-y divide-gray-100">
                        @foreach ($recentJobs as $job)
                            @php
                                $remoteMeta = is_array($job->remote_meta) ? $job->remote_meta : [];
                                $assistant = is_array($remoteMeta['publisher_assistant'] ?? null) ? $remoteMeta['publisher_assistant'] : [];
                                $assistantState = (string) ($assistant['state'] ?? '');
                            @endphp
                            <article class="px-6 py-4">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-medium text-gray-950">{{ $job->article?->title ?? '未关联文章' }}</div>
                                        <div class="mt-1 text-xs text-gray-500">{{ $job->channel?->name ?? '未知渠道' }} · #{{ (int) $job->id }}</div>
                                    </div>
                                    <span class="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $jobStatusClasses[(string) $job->status] ?? 'bg-gray-100 text-gray-700 ring-gray-200' }}">
                                        {{ $jobStatusLabels[(string) $job->status] ?? (string) $job->status }}
                                    </span>
                                </div>
                                <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    @if ($assistantState !== '')
                                        <span class="rounded bg-gray-100 px-2 py-1">助手：{{ $assistantState }}</span>
                                    @endif
                                    @if ($job->last_error_message)
                                        <span class="text-red-600">{{ $job->last_error_message }}</span>
                                    @endif
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif
            </section>

            <section class="overflow-hidden rounded-lg bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h2 class="text-lg font-semibold text-gray-950">最近发布设备</h2>
                    <a href="{{ route('admin.publisher-devices.index') }}" class="text-sm font-medium text-cyan-700 hover:text-cyan-900">设备管理</a>
                </div>
                @if ($devices->isEmpty())
                    <div class="px-6 py-10 text-sm text-gray-500">还没有注册本地发布设备。安装桌面执行器并填写 Token 后会显示在这里。</div>
                @else
                    <div class="divide-y divide-gray-100">
                        @foreach ($devices as $device)
                            @php($deviceState = $deviceStateResolver($device))
                            <article class="px-6 py-4">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-medium text-gray-950">{{ $device->name }}</div>
                                        <div class="mt-1 font-mono text-xs text-gray-400">{{ $device->device_id }}</div>
                                    </div>
                                    <span class="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $deviceClasses[$deviceState] ?? $deviceClasses['offline'] }}">
                                        {{ $deviceLabels[$deviceState] ?? $deviceState }}
                                    </span>
                                </div>
                                <div class="mt-3 text-xs text-gray-500">
                                    最后心跳：{{ $device->last_seen_at?->format('Y-m-d H:i:s') ?? '暂无' }}
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif
            </section>
        </div>
    </div>
@endsection
