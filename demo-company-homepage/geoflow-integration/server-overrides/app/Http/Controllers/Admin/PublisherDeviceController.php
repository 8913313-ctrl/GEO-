<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PublisherDevice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PublisherDeviceController extends Controller
{
    public function index(Request $request): View
    {
        $status = (string) $request->query('status', '');
        if (! in_array($status, ['', 'online', 'offline', 'disabled', 'pending'], true)) {
            $status = '';
        }

        $devices = PublisherDevice::query()
            ->when($status === 'disabled', fn ($query) => $query->whereNotNull('disabled_at'))
            ->when($status === 'pending', fn ($query) => $query->where('status', 'pending')->whereNull('disabled_at'))
            ->when($status === 'online', fn ($query) => $query->whereNull('disabled_at')->where('last_seen_at', '>=', now()->subMinutes(2)))
            ->when($status === 'offline', fn ($query) => $query->whereNull('disabled_at')->where(function ($inner): void {
                $inner->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subMinutes(2));
            }))
            ->orderByRaw('last_seen_at is null')
            ->orderByDesc('last_seen_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        $all = PublisherDevice::query()->get();
        $counts = [
            'all' => $all->count(),
            'online' => $all->filter(fn (PublisherDevice $device): bool => $this->displayState($device) === 'online')->count(),
            'offline' => $all->filter(fn (PublisherDevice $device): bool => $this->displayState($device) === 'offline')->count(),
            'pending' => $all->filter(fn (PublisherDevice $device): bool => $this->displayState($device) === 'pending')->count(),
            'disabled' => $all->filter(fn (PublisherDevice $device): bool => $this->displayState($device) === 'disabled')->count(),
        ];

        return view('admin.publisher-devices.index', [
            'pageTitle' => '发布设备',
            'activeMenu' => 'publisher_devices',
            'adminSiteName' => config('app.name'),
            'devices' => $devices,
            'status' => $status,
            'counts' => $counts,
            'stateResolver' => fn (PublisherDevice $device): string => $this->displayState($device),
        ]);
    }

    public function disable(int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);
        $meta = is_array($device->meta) ? $device->meta : [];
        unset($meta['active_job_id']);

        $device->forceFill([
            'status' => 'disabled',
            'disabled_at' => now(),
            'meta' => $meta,
        ])->save();

        return back()->with('status', '发布设备已禁用，本地执行器将停止接收任务。');
    }

    public function enable(int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);

        $device->forceFill([
            'status' => 'offline',
            'disabled_at' => null,
        ])->save();

        return back()->with('status', '发布设备已恢复，等待本地执行器重新心跳。');
    }

    public function destroy(int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);
        $device->delete();

        return back()->with('status', '发布设备记录已删除。');
    }

    private function displayState(PublisherDevice $device): string
    {
        if ($device->disabled_at !== null) {
            return 'disabled';
        }
        if ((string) $device->status === 'pending') {
            return 'pending';
        }
        if ($device->last_seen_at && $device->last_seen_at->gte(now()->subMinutes(2))) {
            return 'online';
        }

        return 'offline';
    }
}
