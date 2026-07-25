@extends('admin.layouts.app')

@section('content')
    @php
        $stateLabels = [
            'online' => '在线',
            'offline' => '离线',
            'pending' => '待连接',
            'disabled' => '已禁用',
        ];
        $stateClasses = [
            'online' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            'offline' => 'bg-gray-100 text-gray-600 ring-gray-200',
            'pending' => 'bg-amber-50 text-amber-700 ring-amber-200',
            'disabled' => 'bg-red-50 text-red-700 ring-red-200',
        ];
    @endphp

    <div class="space-y-6 px-4 sm:px-0">
        @if (session('status'))
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {{ session('status') }}
            </div>
        @endif

        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
                <div class="text-sm font-medium text-blue-600">PUBLISHER DEVICES</div>
                <h1 class="mt-1 text-2xl font-bold text-gray-900">发布设备</h1>
                <p class="mt-1 text-sm text-gray-600">查看本地发布执行器的在线状态、平台能力和最近心跳。</p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
                <a href="{{ route('admin.publisher-devices.index') }}" class="rounded-md border px-3 py-2 {{ $status === '' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">全部 {{ $counts['all'] ?? 0 }}</a>
                @foreach (['online', 'offline', 'pending', 'disabled'] as $key)
                    <a href="{{ route('admin.publisher-devices.index', ['status' => $key]) }}" class="rounded-md border px-3 py-2 {{ $status === $key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">{{ $stateLabels[$key] }} {{ $counts[$key] ?? 0 }}</a>
                @endforeach
            </div>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">设备</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">状态</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">平台能力</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">当前任务</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">最后在线</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">客户端</th>
                            <th class="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">操作</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        @forelse ($devices as $device)
                            @php
                                $state = $stateResolver($device);
                                $capabilities = is_array($device->capabilities) ? $device->capabilities : [];
                                $meta = is_array($device->meta) ? $device->meta : [];
                                $activeJobId = $meta['active_job_id'] ?? null;
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
                                <td class="px-5 py-4">
                                    <div class="flex max-w-md flex-wrap gap-1.5">
                                        @forelse ($capabilities as $capability)
                                            <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ $capability }}</span>
                                        @empty
                                            <span class="text-sm text-gray-400">未上报</span>
                                        @endforelse
                                    </div>
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    @if ($activeJobId)
                                        <span class="font-mono text-blue-700">#{{ $activeJobId }}</span>
                                    @else
                                        <span class="text-gray-400">空闲</span>
                                    @endif
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    {{ $device->last_seen_at?->format('Y-m-d H:i:s') ?? '暂无心跳' }}
                                </td>
                                <td class="px-5 py-4 text-sm text-gray-600">
                                    <div>{{ $meta['version'] ?? '未知版本' }}</div>
                                    <div class="mt-1 text-xs text-gray-400">{{ $meta['platform'] ?? 'unknown' }} {{ $meta['arch'] ?? '' }}</div>
                                </td>
                                <td class="px-5 py-4">
                                    <div class="flex justify-end gap-2">
                                        @if ($state === 'disabled')
                                            <form method="POST" action="{{ route('admin.publisher-devices.enable', $device->id) }}">
                                                @csrf
                                                <button type="submit" class="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                                                    恢复
                                                </button>
                                            </form>
                                        @else
                                            <form method="POST" action="{{ route('admin.publisher-devices.disable', $device->id) }}" onsubmit="return confirm('确定禁用这台发布设备吗？禁用后它将停止接收分发任务。')">
                                                @csrf
                                                <button type="submit" class="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                                                    禁用
                                                </button>
                                            </form>
                                        @endif
                                        <form method="POST" action="{{ route('admin.publisher-devices.delete', $device->id) }}" onsubmit="return confirm('确定删除这台发布设备记录吗？本地软件重新注册后会生成新的记录。')">
                                            @csrf
                                            <button type="submit" class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                                                删除
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="px-6 py-16 text-center text-sm text-gray-500">还没有绑定本地发布执行器。</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        @if ($devices->hasPages())
            <div>{{ $devices->links() }}</div>
        @endif
    </div>
@endsection
