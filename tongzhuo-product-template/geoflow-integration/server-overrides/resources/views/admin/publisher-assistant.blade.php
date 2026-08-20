@extends('admin.layouts.app')

@section('content')
    @php
        $jobStatusLabels = [
            'queued' => '待处理',
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
            'paired' => '已配对',
            'pending' => '待连接',
            'disabled' => '已禁用',
        ];
        $deviceClasses = [
            'online' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'offline' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'paired' => 'bg-blue-50 text-blue-700 ring-blue-200',
            'pending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'disabled' => 'bg-red-50 text-red-700 ring-red-200',
        ];
        $pendingJobs = (int) ($jobCounts['queued'] ?? 0) + (int) ($jobCounts['sending'] ?? 0);
        $activeChannels = $localChannels->where('status', 'active')->count();
        $failedJobs = (int) ($jobCounts['failed'] ?? 0);
        $attentionJobs = (int) ($attentionJobs ?? 0);
        $syncedJobs = (int) ($jobCounts['synced'] ?? 0);
        $pairingStateClasses = [
            'pending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'claimed' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'expired' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'revoked' => 'bg-red-50 text-red-700 ring-red-200',
        ];
    @endphp

    <div class="space-y-6 px-4 sm:px-0">
        @if (session('message'))
            <div class="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                {{ session('message') }}
            </div>
        @endif

        @if ($errors->any())
            <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <div class="font-semibold">发布任务未创建</div>
                <ul class="mt-2 list-disc space-y-1 pl-5">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        <section class="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-sm">
            <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div class="max-w-3xl">
                    <div class="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100">
                        PUBLISHING CONSOLE
                    </div>
                    <h1 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">分发与发布助手</h1>
                    <p class="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                        文章在后台发布后进入分发队列，发布设备负责本地登录、打开平台编辑器、填写草稿并回写结果。
                        这里统一管理渠道初始化、设备在线状态、待确认任务和失败重试。
                    </p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <form method="POST" action="{{ route('admin.publisher-devices.pairings.store') }}">
                        @csrf
                        <button type="submit" class="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-50">
                            <i data-lucide="qr-code" class="mr-2 h-4 w-4"></i>
                            添加发布电脑
                        </button>
                    </form>
                    <form method="POST" action="{{ route('admin.publisher-assistant.bootstrap-channel') }}">
                        @csrf
                        <button type="submit" class="inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 hover:bg-cyan-400">
                            <i data-lucide="wand-2" class="mr-2 h-4 w-4"></i>
                            初始化发布渠道
                        </button>
                    </form>
                    <form method="POST" action="{{ route('admin.publisher-assistant.enqueue-published') }}">
                        @csrf
                        <button type="submit" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                            <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                            同步已发布文章
                        </button>
                    </form>
                    <a href="{{ route('admin.publisher-devices.index') }}" class="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                        <i data-lucide="monitor-up" class="mr-2 h-4 w-4"></i>
                        发布设备
                    </a>
                </div>
            </div>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">ONE-CLICK PUBLISH</p>
                    <h2 class="mt-2 text-2xl font-semibold text-slate-950">创建平台发布批次</h2>
                    <p class="mt-2 text-sm leading-6 text-slate-600">选择文章、账号组和平台。系统会先检查设备在线、账号登录和平台能力，再按平台拆分任务。</p>
                </div>
                <div class="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-200">
                    未通过真实直发验收的平台只保存草稿或等待人工确认，不会误点最终发布。
                </div>
            </div>

            <form method="POST" action="{{ route('admin.publisher-assistant.batches.store') }}" class="mt-6 space-y-6" data-publishing-batch-form>
                @csrf
                <input type="hidden" name="idempotency_key" value="{{ old('idempotency_key', $publishingRequestKey) }}">
                <div class="grid gap-5 lg:grid-cols-3">
                    <label class="block">
                        <span class="text-sm font-semibold text-slate-800">文章</span>
                        <select name="article_id" required class="mt-2 block w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">请选择已发布文章</option>
                            @foreach ($publishedArticles as $article)
                                <option value="{{ $article->id }}" @selected((string) old('article_id') === (string) $article->id)>#{{ $article->id }} · {{ $article->title }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-sm font-semibold text-slate-800">账号组</span>
                        <select name="account_group_id" class="mt-2 block w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">自动选择已登录账号</option>
                            @foreach ($accountGroups as $group)
                                <option value="{{ $group->id }}" @selected((string) old('account_group_id') === (string) $group->id)>
                                    {{ $group->name }}{{ $group->device ? ' · '.$group->device->name : '' }}
                                </option>
                            @endforeach
                        </select>
                    </label>
                    <label class="block">
                        <span class="text-sm font-semibold text-slate-800">发布方式</span>
                        <select name="publish_mode" required class="mt-2 block w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" data-publish-mode>
                            <option value="draft" @selected(old('publish_mode', 'direct') === 'draft')>保存草稿</option>
                            <option value="direct" @selected(old('publish_mode', 'direct') === 'direct')>立即发布</option>
                            <option value="scheduled" @selected(old('publish_mode') === 'scheduled')>定时发布</option>
                        </select>
                    </label>
                </div>

                <div class="grid gap-5 lg:grid-cols-2">
                    <label class="block" data-scheduled-at-field>
                        <span class="text-sm font-semibold text-slate-800">执行时间</span>
                        <input type="datetime-local" name="scheduled_at" value="{{ old('scheduled_at') }}" class="mt-2 block w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <span class="mt-1 block text-xs text-slate-500">由 GEO 后台到点释放任务；发布电脑离线时会保留等待并在恢复后处理。</span>
                    </label>
                    <label class="block">
                        <span class="text-sm font-semibold text-slate-800">指定发布电脑（可选）</span>
                        <input type="hidden" name="device_strategy" value="auto">
                        <select name="preferred_device_id" class="mt-2 block w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">自动选择在线设备</option>
                            @foreach ($devices as $device)
                                <option value="{{ $device->id }}" @selected((string) old('preferred_device_id') === (string) $device->id)>{{ $device->name }} · {{ $deviceStateResolver($device) }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>

                <fieldset>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <legend class="text-sm font-semibold text-slate-800">目标平台</legend>
                        <div class="flex gap-2 text-xs">
                            <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50" data-platform-select-all>全选</button>
                            <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50" data-platform-clear>清空</button>
                        </div>
                    </div>
                    <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        @foreach ($publisherPlatforms as $platform)
                            @php($selectedPlatformIds = old('platform_ids', []))
                            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-blue-300 hover:bg-blue-50/40">
                                <input type="checkbox" name="platform_ids[]" value="{{ $platform->platform_id }}" class="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500" @checked(in_array($platform->platform_id, $selectedPlatformIds, true))>
                                <span class="min-w-0">
                                    <span class="block truncate text-sm font-semibold text-slate-900">{{ $platform->name }}</span>
                                    <span class="mt-1 block text-xs {{ $platform->supports_direct_publish ? 'text-emerald-700' : 'text-amber-700' }}">
                                        {{ $platform->supports_direct_publish ? '已开放自动直发' : ($platform->supports_draft ? '草稿/人工确认' : '等待专用适配') }}
                                    </span>
                                </span>
                            </label>
                        @endforeach
                    </div>
                </fieldset>

                <div class="flex justify-end">
                    <button type="submit" class="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                        <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                        创建发布批次
                    </button>
                </div>
            </form>
        </section>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a href="{{ route('admin.distribution.index') }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300">
                <div class="text-sm text-slate-500">启用渠道</div>
                <div class="mt-2 text-3xl font-semibold text-slate-950">{{ $activeChannels }}</div>
                <div class="mt-2 text-xs text-slate-500">本地 / 半自动分发渠道</div>
            </a>
            <a href="{{ route('admin.distribution.jobs', ['status' => 'queued']) }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300">
                <div class="text-sm text-slate-500">待处理任务</div>
                <div class="mt-2 text-3xl font-semibold text-blue-700">{{ $pendingJobs }}</div>
                <div class="mt-2 text-xs text-slate-500">排队中或处理中</div>
            </a>
            <a href="{{ route('admin.publisher-devices.index') }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300">
                <div class="text-sm text-slate-500">在线设备</div>
                <div class="mt-2 text-3xl font-semibold text-emerald-700">{{ $onlineDevices }}</div>
                <div class="mt-2 text-xs text-slate-500">最近 2 分钟心跳</div>
            </a>
            <a href="{{ route('admin.distribution.jobs') }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300">
                <div class="text-sm text-slate-500">需要人工确认</div>
                <div class="mt-2 text-3xl font-semibold text-amber-700">{{ $attentionJobs }}</div>
                <div class="mt-2 text-xs text-slate-500">草稿、异常和待确认状态</div>
            </a>
        </section>

        <script>
            (function () {
                const form = document.querySelector('[data-publishing-batch-form]');
                if (!form) return;
                const mode = form.querySelector('[data-publish-mode]');
                const scheduledField = form.querySelector('[data-scheduled-at-field]');
                const scheduledInput = scheduledField?.querySelector('input');
                const syncSchedule = function () {
                    const scheduled = mode?.value === 'scheduled';
                    scheduledField?.classList.toggle('hidden', ! scheduled);
                    if (scheduledInput) scheduledInput.required = scheduled;
                };
                mode?.addEventListener('change', syncSchedule);
                form.querySelector('[data-platform-select-all]')?.addEventListener('click', function () {
                    form.querySelectorAll('input[name="platform_ids[]"]').forEach(function (input) { input.checked = true; });
                });
                form.querySelector('[data-platform-clear]')?.addEventListener('click', function () {
                    form.querySelectorAll('input[name="platform_ids[]"]').forEach(function (input) { input.checked = false; });
                });
                syncSchedule();
            })();
        </script>

        <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">WORKFLOW</p>
                        <h2 class="mt-2 text-2xl font-semibold text-slate-950">发布流程</h2>
                        <p class="mt-2 text-sm leading-6 text-slate-600">把发布动作拆成可追踪、可重试、可回写的四步，避免运营人员手工切换多个页面。</p>
                    </div>
                    <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                        查看任务队列
                        <i data-lucide="arrow-right" class="ml-1.5 h-4 w-4"></i>
                    </a>
                </div>

                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    <article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div class="flex items-center gap-3">
                            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">1</span>
                            <h3 class="font-semibold text-slate-950">文章发布到官网</h3>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-slate-600">文章先进入官网 CMS 与 AI 可见内容入口，保证页面、RSS、Sitemap 和结构化数据同步更新。</p>
                    </article>
                    <article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div class="flex items-center gap-3">
                            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">2</span>
                            <h3 class="font-semibold text-slate-950">生成分发任务</h3>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-slate-600">系统把文章拆分成各平台子任务，并根据设备能力自动进入本地发布队列。</p>
                    </article>
                    <article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div class="flex items-center gap-3">
                            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">3</span>
                            <h3 class="font-semibold text-slate-950">本地节点执行</h3>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-slate-600">桌面节点负责登录、验证码、编辑器填写和平台回写，后端不托管客户账号密码。</p>
                    </article>
                    <article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div class="flex items-center gap-3">
                            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">4</span>
                            <h3 class="font-semibold text-slate-950">结果回写与重试</h3>
                        </div>
                        <p class="mt-3 text-sm leading-6 text-slate-600">成功、失败、待确认和需人工验证都会记录在分发任务与设备会话里，方便追踪和复盘。</p>
                    </article>
                </div>
            </div>

            <aside class="space-y-6">
                <div class="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <h2 class="text-lg font-semibold text-cyan-950">添加发布电脑</h2>
                            <p class="mt-2 text-sm leading-6 text-cyan-900">后台生成配对码，运营电脑安装发布执行器后输入配对码即可绑定。</p>
                        </div>
                        <form method="POST" action="{{ route('admin.publisher-devices.pairings.store') }}" class="shrink-0">
                            @csrf
                            <button type="submit" class="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">
                                生成配对码
                            </button>
                        </form>
                    </div>

                    <div class="mt-5 space-y-3">
                        @forelse ($pairings as $pairing)
                            @php
                                $pairingState = (string) ($pairing->status ?? 'pending');
                            @endphp
                            <div class="rounded-xl border border-cyan-100 bg-white/80 px-4 py-3">
                                <div class="flex items-center justify-between gap-3">
                                    <code class="font-mono text-sm font-semibold text-slate-950">{{ $pairing->pairing_code }}</code>
                                    <span class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $pairingStateClasses[$pairingState] ?? $pairingStateClasses['pending'] }}">
                                        {{ $pairingState }}
                                    </span>
                                </div>
                                <div class="mt-2 text-xs leading-5 text-slate-500">
                                    过期：{{ $pairing->expires_at?->format('Y-m-d H:i') ?? '未知' }}
                                    @if ($pairing->claimed_device_id)
                                        · 设备：{{ $pairing->claimed_device_id }}
                                    @endif
                                </div>
                            </div>
                        @empty
                            <div class="rounded-xl border border-dashed border-cyan-200 bg-white/70 px-4 py-5 text-sm leading-6 text-cyan-900">
                                还没有配对码。点击“生成配对码”后，让运营电脑完成首次绑定。
                            </div>
                        @endforelse
                    </div>

                    <a href="{{ route('admin.publisher-devices.index') }}" class="mt-4 inline-flex items-center text-sm font-semibold text-cyan-800 hover:text-cyan-950">
                        查看全部发布设备
                        <i data-lucide="arrow-right" class="ml-1.5 h-4 w-4"></i>
                    </a>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 class="text-lg font-semibold text-slate-950">发布设备状态</h2>
                    <p class="mt-2 text-sm leading-6 text-slate-600">设备在线时才会主动领取任务。离线或待验证状态会保留在后台，方便重新绑定。</p>
                    <div class="mt-5 space-y-3">
                        @forelse ($devices as $device)
                            @php($deviceState = $deviceStateResolver($device))
                            <a href="{{ route('admin.publisher-devices.index') }}" class="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <div class="truncate text-sm font-semibold text-slate-950">{{ $device->name }}</div>
                                        <div class="mt-1 truncate font-mono text-xs text-slate-400">{{ $device->device_id }}</div>
                                    </div>
                                    <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $deviceClasses[$deviceState] ?? $deviceClasses['offline'] }}">
                                        {{ $deviceLabels[$deviceState] ?? $deviceState }}
                                    </span>
                                </div>
                                <div class="mt-2 text-xs text-slate-500">
                                    最近心跳：{{ $device->last_seen_at?->format('Y-m-d H:i:s') ?? '暂无' }}
                                </div>
                            </a>
                        @empty
                            <div class="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm leading-6 text-slate-500">
                                还没有发布设备。生成一个配对码后，在桌面节点中绑定即可。
                            </div>
                        @endforelse
                    </div>
                </div>

                <div class="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                    <h2 class="text-lg font-semibold text-amber-950">关键边界</h2>
                    <p class="mt-2 text-sm leading-6 text-amber-900">
                        账号登录、验证码和浏览器状态都保留在本地设备，服务器只记录任务、会话状态和发布结果，便于复制到不同客户环境。
                    </p>
                </div>
            </aside>
        </section>

        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-slate-950">最近发布任务</h2>
                    <p class="mt-1 text-sm text-slate-600">这里显示最近同步到本地发布助手的任务、状态和结果。</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="{{ route('admin.distribution.jobs') }}" class="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        全部任务
                    </a>
                    <a href="{{ route('admin.distribution.jobs', ['status' => 'queued']) }}" class="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">
                        待确认 {{ $attentionJobs }}
                    </a>
                    <a href="{{ route('admin.distribution.jobs', ['status' => 'synced']) }}" class="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                        已同步 {{ $syncedJobs }}
                    </a>
                    <a href="{{ route('admin.distribution.jobs', ['status' => 'failed']) }}" class="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                        失败 {{ $failedJobs }}
                    </a>
                </div>
            </div>
            @include('admin.distribution._jobs-table', ['jobs' => $recentJobs])
        </section>
    </div>
@endsection
