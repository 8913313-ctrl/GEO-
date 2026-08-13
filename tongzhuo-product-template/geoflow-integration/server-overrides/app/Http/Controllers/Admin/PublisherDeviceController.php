<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PublisherDevice;
use App\Models\PublisherDevicePairing;
use App\Services\Publishing\PublisherPlatformCatalogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class PublisherDeviceController extends Controller
{
    public function __construct(
        private readonly PublisherPlatformCatalogService $platformCatalog,
    ) {}

    public function index(Request $request): View
    {
        $status = (string) $request->query('status', '');
        if (! in_array($status, ['', 'online', 'offline', 'disabled', 'pending', 'paired'], true)) {
            $status = '';
        }

        $devices = PublisherDevice::query()
            ->with(['platformSessions' => fn ($query) => $query->orderByDesc('last_seen_at')->orderByDesc('id')])
            ->when($status === 'disabled', fn ($query) => $query->whereNotNull('disabled_at'))
            ->when($status === 'pending', fn ($query) => $query->where('status', 'pending')->whereNull('disabled_at'))
            ->when($status === 'online', fn ($query) => $query->whereNull('disabled_at')->where('last_seen_at', '>=', now()->subMinutes(2)))
            ->when($status === 'offline', fn ($query) => $query->whereNull('disabled_at')->where(function ($inner): void {
                $inner->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subMinutes(2));
            }))
            ->when($status === 'paired', fn ($query) => $query->whereNotNull('paired_at')->whereNull('disabled_at'))
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
            'paired' => $all->filter(fn (PublisherDevice $device): bool => $this->displayState($device) === 'paired')->count(),
        ];

        $pairings = PublisherDevicePairing::query()
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        return view('admin.publisher-devices.index', [
            'pageTitle' => '发布设备',
            'activeMenu' => 'publisher_devices',
            'adminSiteName' => config('app.name'),
            'devices' => $devices,
            'pairings' => $pairings,
            'status' => $status,
            'counts' => $counts,
            'stateResolver' => fn (PublisherDevice $device): string => $this->displayState($device),
            'platformOptions' => $this->platformCatalog->activePlatforms(),
            'jobProtocol' => $this->jobProtocol(),
            'deviceCommandsEnabled' => (bool) config('publishing.device_commands_enabled', false),
        ]);
    }

    public function issuePairingCode(Request $request): RedirectResponse
    {
        $code = Str::upper(Str::random(10));

        PublisherDevicePairing::query()->create([
            'pairing_code' => $code,
            'status' => 'pending',
            'requested_by' => (string) optional(auth('admin')->user())->username,
            'issued_at' => now(),
            'expires_at' => now()->addMinutes(10),
            'meta' => [
                'source' => 'admin.publisher-devices',
                'admin_id' => auth('admin')->id(),
            ],
        ]);

        return back()->with('status', "已生成配对码 {$code}，有效期 10 分钟。");
    }

    public function revokePairingCode(string $pairingCode): RedirectResponse
    {
        $pairing = PublisherDevicePairing::query()->where('pairing_code', $pairingCode)->firstOrFail();
        $pairing->forceFill(['status' => 'revoked'])->save();

        return back()->with('status', '配对码已撤销。');
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

        return back()->with('status', '已禁用这台发布设备。');
    }

    public function enable(int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);

        $device->forceFill([
            'status' => 'offline',
            'disabled_at' => null,
        ])->save();

        return back()->with('status', '已恢复这台发布设备。');
    }

    public function destroy(int $deviceId): RedirectResponse
    {
        $device = PublisherDevice::query()->findOrFail($deviceId);
        $device->delete();

        return back()->with('status', '已删除发布设备记录。');
    }

    private function jobProtocol(): string
    {
        if (! (bool) config('publishing.center_v2_enabled', false)
            || ! (bool) config('publishing.platform_jobs_enabled', false)) {
            return 'legacy';
        }

        $configured = strtolower(trim((string) config('publishing.job_protocol', '')));

        return in_array($configured, ['legacy', 'platform-jobs', 'dual', 'auto'], true) ? $configured : 'dual';
    }

    private function displayState(PublisherDevice $device): string
    {
        if ($device->disabled_at !== null) {
            return 'disabled';
        }
        if ($device->paired_at !== null) {
            return $device->last_seen_at && $device->last_seen_at->gte(now()->subMinutes(2))
                ? 'online'
                : 'paired';
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
