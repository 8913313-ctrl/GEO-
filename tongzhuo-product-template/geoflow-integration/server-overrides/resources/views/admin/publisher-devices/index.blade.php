@extends('admin.layouts.app')

@section('content')
    @php
        $stateLabels = [
            'online' => '在线',
            'offline' => '离线',
            'pending' => '待连接',
            'paired' => '已配对',
            'disabled' => '已禁用',
        ];
        $stateClasses = [
            'online' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'offline' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'pending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'paired' => 'bg-blue-50 text-blue-700 ring-blue-200',
            'disabled' => 'bg-red-50 text-red-700 ring-red-200',
        ];
        $sessionLabels = [
            'unknown' => '未知',
            'open' => '已打开',
            'ready' => '可用',
            'needs_verification' => '待验证',
            'needs_captcha' => '需验证码',
            'expired' => '已过期',
            'disabled' => '已禁用',
            'error' => '异常',
        ];
        $sessionClasses = [
            'unknown' => 'bg-slate-100 text-slate-600 ring-slate-200',
            'open' => 'bg-cyan-50 text-cyan-700 ring-cyan-200',
            'ready' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'needs_verification' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'needs_captcha' => 'bg-orange-50 text-orange-700 ring-orange-200',
            'expired' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'disabled' => 'bg-red-50 text-red-700 ring-red-200',
            'error' => 'bg-red-50 text-red-700 ring-red-200',
        ];
        $pairings = $pairings ?? collect();
    @endphp

    <div class="space-y-6 px-4 sm:px-0">
        @if (session('status'))
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {{ session('status') }}
            </div>
        @endif

        <section class="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 text-white shadow-sm">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div class="max-w-3xl">
                    <div class="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100">
                        PUBLISHER DEVICES
                    </div>
                    <h1 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">发布设备工作台</h1>
                    <p class="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                        这里统一管理本地发布节点、10 分钟配对码、平台会话和设备状态。运营只需要在这里看见电脑是否在线、账号是否可用、配对码是否还有效。
                    </p>
                </div>
                <form method="POST" action="{{ route('admin.publisher-devices.pairings.store') }}">
                    @csrf
                    <button type="submit" class="inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 hover:bg-cyan-400">
                        <i data-lucide="qr-code" class="mr-2 h-4 w-4"></i>
                        生成配对码
                    </button>
                </form>
            </div>
        </section>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <a href="{{ route('admin.publisher-devices.index') }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300">
                <div class="text-sm font-medium text-slate-500">全部设备</div>
                <div class="mt-2 text-3xl font-black text-slate-950">{{ $counts['all'] ?? 0 }}</div>
            </a>
            @foreach (['online', 'paired', 'offline', 'pending', 'disabled'] as $key)
                <a href="{{ route('admin.publisher-devices.index', ['status' => $key]) }}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
                    <div class="text-sm font-medium text-slate-500">{{ $stateLabels[$key] ?? $key }}</div>
                    <div class="mt-2 text-3xl font-black text-slate-950">{{ $counts[$key] ?? 0 }}</div>
                </a>
            @endforeach
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">PAIRING CODES</p>
                        <h2 class="mt-2 text-2xl font-semibold text-slate-950">最近配对码</h2>
                        <p class="mt-2 text-sm leading-6 text-slate-600">后台生成的配对码 10 分钟有效，桌面节点输入后自动完成绑定并回写设备状态。</p>
                    </div>
                    <form method="POST" action="{{ route('admin.publisher-devices.pairings.store') }}">
                        @csrf
                        <button type="submit" class="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>
                            再生成一个
                        </button>
                    </form>
                </div>

                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    @forelse ($pairings as $pairing)
                        @php
                            $pairingState = (string) ($pairing->status ?? 'pending');
                            $pairingClass = match ($pairingState) {
                                'claimed' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                                'expired' => 'bg-gray-100 text-gray-600 ring-gray-200',
                                'revoked' => 'bg-red-50 text-red-700 ring-red-200',
                                default => 'bg-amber-50 text-amber-700 ring-amber-200',
                            };
                        @endphp
                        <article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div class="flex items-center justify-between gap-3">
                                <h3 class="font-semibold text-slate-950">{{ $pairing->pairing_code }}</h3>
                                <span class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $pairingClass }}">
                                    {{ ucfirst($pairingState) }}
                                </span>
                            </div>
                            <div class="mt-3 text-sm text-slate-600">
                                生成：{{ $pairing->issued_at?->format('Y-m-d H:i') ?? '未知' }}
                            </div>
                            <div class="mt-1 text-sm text-slate-600">
                                过期：{{ $pairing->expires_at?->format('Y-m-d H:i') ?? '未知' }}
                            </div>
                            @if ($pairing->claimed_device_id)
                                <div class="mt-1 text-sm text-slate-600">
                                    已绑定设备：{{ $pairing->claimed_device_id }}
                                </div>
                            @endif
                            @if ($pairingState === 'pending')
                                <form method="POST" action="{{ route('admin.publisher-devices.pairings.revoke', $pairing->pairing_code) }}" class="mt-4">
                                    @csrf
                                    <button type="submit" class="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                                        撤销配对码
                                    </button>
                                </form>
                            @endif
                        </article>
                    @empty
                        <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 md:col-span-2">
                            还没有配对码，先点右上角生成一个。
                        </div>
                    @endforelse
                </div>
            </div>

            <aside class="space-y-6">
                <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 class="text-lg font-semibold text-slate-950">使用说明</h2>
                    <ol class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                        <li>1. 管理员生成 10 分钟配对码。</li>
                        <li>2. 桌面发布节点输入配对码并注册。</li>
                        <li>3. 节点上线后，后台可看到设备状态和平台会话。</li>
                        <li>4. 平台登录窗口由本地节点打开，验证状态回写后台。</li>
                    </ol>
                </div>
                <div class="rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
                    <h2 class="text-lg font-semibold text-cyan-950">产品方向</h2>
                    <p class="mt-2 text-sm leading-6 text-cyan-900">
                        设备、会话和任务分离后，GEOFlow 就不再是一个本地工具，而是一套可以复制部署的运营工作台。
                    </p>
                </div>
            </aside>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-6 py-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">DEVICES</p>
                        <h2 class="mt-2 text-2xl font-semibold text-slate-950">发布设备列表</h2>
                        <p class="mt-2 text-sm leading-6 text-slate-600">这里显示设备连接模式、配对状态、最近心跳和平台会话。</p>
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm">
                        <a href="{{ route('admin.publisher-devices.index') }}" class="rounded-md border px-3 py-2 {{ $status === '' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">全部 {{ $counts['all'] ?? 0 }}</a>
                        @foreach (['online', 'paired', 'offline', 'pending', 'disabled'] as $key)
                            <a href="{{ route('admin.publisher-devices.index', ['status' => $key]) }}" class="rounded-md border px-3 py-2 {{ $status === $key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">{{ $stateLabels[$key] ?? $key }} {{ $counts[$key] ?? 0 }}</a>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">设备</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">状态</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">连接模式</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">平台会话</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">最近心跳</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">配对信息</th>
                            <th class="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">操作</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        @forelse ($devices as $device)
                            @php
                                $state = $stateResolver($device);
                                $capabilities = is_array($device->capabilities) ? $device->capabilities : [];
                                $meta = is_array($device->meta) ? $device->meta : [];
                                $sessions = $device->platformSessions ?? collect();
                            @endphp
                            <tr>
                                <td class="px-5 py-4">
                                    <div class="font-medium text-gray-900">{{ $device->name }}</div>
                                    <div class="mt-1 font-mono text-xs text-gray-400">{{ $device->device_id }}</div>
                                </td>
                                <td class="px-5 py-4">
                                    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $stateClasses[$state] ?? $stateClasses['offline'] }}">
                                        {{ $stateLabels[$state] ?? $state }}
                                    </span>
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    <div class="font-medium text-gray-900">{{ $device->connection_mode ?? 'token' }}</div>
                                    <div class="mt-1 text-xs text-gray-400">{{ count($capabilities) }} 个可执行能力</div>
                                </td>
                                <td class="px-5 py-4">
                                    <div class="flex max-w-sm flex-wrap gap-1.5">
                                        @forelse ($sessions->take(3) as $session)
                                            @php
                                                $sessionState = (string) ($session->login_state ?? 'unknown');
                                            @endphp
                                            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $sessionClasses[$sessionState] ?? $sessionClasses['unknown'] }}">
                                                {{ $session->platform_id }} · {{ $sessionLabels[$sessionState] ?? $sessionState }}
                                            </span>
                                        @empty
                                            <span class="text-sm text-gray-400">暂无会话</span>
                                        @endforelse
                                    </div>
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    {{ $device->last_seen_at?->format('Y-m-d H:i:s') ?? '暂无' }}
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    <div>配对码：{{ $device->pairing_code ?: '无' }}</div>
                                    <div class="mt-1 text-xs text-gray-400">
                                        {{ $device->paired_at ? '已配对 '.$device->paired_at->format('Y-m-d H:i') : '尚未配对' }}
                                    </div>
                                </td>
                                <td class="px-5 py-4">
                                    <div class="flex justify-end gap-2">
                                        @if ($state === 'disabled')
                                            <form method="POST" action="{{ route('admin.publisher-devices.enable', $device->id) }}">
                                                @csrf
                                                <button type="submit" class="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">启用</button>
                                            </form>
                                        @else
                                            <form method="POST" action="{{ route('admin.publisher-devices.disable', $device->id) }}" onsubmit="return confirm('确定禁用这台发布设备吗？')">
                                                @csrf
                                                <button type="submit" class="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">禁用</button>
                                            </form>
                                        @endif
                                        <form method="POST" action="{{ route('admin.publisher-devices.delete', $device->id) }}" onsubmit="return confirm('确定删除这台发布设备记录吗？')">
                                            @csrf
                                            <button type="submit" class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">删除</button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                            <tr class="bg-slate-50/50">
                                <td colspan="7" class="px-5 py-4">
                                    <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">平台会话详情</div>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        @forelse ($sessions as $session)
                                            @php
                                                $sessionState = (string) ($session->login_state ?? 'unknown');
                                            @endphp
                                            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $sessionClasses[$sessionState] ?? $sessionClasses['unknown'] }}">
                                                {{ $session->platform_id }}
                                                @if ($session->account_name)
                                                    · {{ $session->account_name }}
                                                @endif
                                                · {{ $sessionLabels[$sessionState] ?? $sessionState }}
                                            </span>
                                        @empty
                                            <span class="text-sm text-gray-400">暂无平台会话记录</span>
                                        @endforelse
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="px-6 py-16 text-center text-sm text-gray-500">暂无发布设备记录。</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            @if ($devices->hasPages())
                <div class="border-t border-slate-100 px-6 py-4">{{ $devices->links() }}</div>
            @endif
        </section>
    </div>
@endsection
