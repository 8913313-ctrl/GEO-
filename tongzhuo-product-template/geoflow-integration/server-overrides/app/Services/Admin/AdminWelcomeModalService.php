<?php

namespace App\Services\Admin;

use App\Models\Admin;

/**
 * 鍚庡彴銆屾杩庝娇鐢?GEOFlow銆嶅脊绐楋細璐熻矗鐗堟湰鎬佸垽鏂€佽嚜鍔ㄦ墦寮€涓€娆°€佷互鍙婂叧闂惤搴撴墍闇€鐨勬暟鎹€? */
class AdminWelcomeModalService
{
    public function __construct(
        private readonly AdminUpdateMetadataService $updateMetadataService
    ) {}

    /**
     * 涓?Blade 杈撳嚭鏋勯€?JSON 杞借嵎锛堝璇█鏂囨 + 杩愯鎬侊細鏄惁鑷姩鎵撳紑銆佸叧闂湴鍧€銆丆SRF銆佸閾撅級銆?     *
     * @return array{copy: array<string, mixed>, state: array<string, mixed>}
     */
    public function buildModalPayload(Admin $admin): array
    {
        $welcomeState = $this->resolveWelcomeState();
        $shouldAutoOpen = $this->prepareAutoOpen($admin, $welcomeState);
        $admin->refresh();

        $copy = ($welcomeState['mode'] ?? 'intro') === 'update'
            ? $this->buildUpdateCopy($welcomeState)
            : $this->buildIntroCopy();

        return [
            'copy' => $copy,
            'state' => [
                'mode' => $welcomeState['mode'] ?? 'intro',
                'shouldAutoOpen' => $shouldAutoOpen,
                'dismissUrl' => route('admin.welcome.dismiss'),
                'csrfToken' => csrf_token(),
                'links' => [
                    'x' => url('/index.html'),
                    'github' => url('/index.html'),
                    'changelog' => [
                        'zh-CN' => route('tongzhuo.insights'),
                        'en' => route('tongzhuo.insights'),
                    ],
                ],
            ],
        ];
    }

    /**
     * 鍏抽棴寮圭獥鏃跺啓鍏ョ殑鐗堟湰閿紝椤讳笌 {@see prepareAutoOpen} 浣跨敤鐨勯敭涓€鑷淬€?     */
    public function currentWelcomeVersionKey(): string
    {
        return $this->welcomeVersionKey($this->resolveWelcomeState());
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveWelcomeState(): array
    {
        $introVersion = (string) config('geoflow.welcome_intro_version', '2.0');
        $updateState = $this->updateMetadataService->fetchState($introVersion);

        if (! empty($updateState['is_update_available']) && empty($updateState['is_ignored'])) {
            return [
                'mode' => 'update',
                'version' => 'update:'.(string) ($updateState['latest_version'] ?? ''),
                'update' => $updateState,
            ];
        }

        return [
            'mode' => 'intro',
            'version' => 'intro:'.$introVersion,
            'update' => $updateState,
        ];
    }

    /**
     * @param  array<string, mixed>  $welcomeState
     */
    private function welcomeVersionKey(array $welcomeState): string
    {
        return (string) ($welcomeState['version'] ?? ('intro:'.config('geoflow.welcome_intro_version', '2.0')));
    }

    /**
     * 褰撳綋鍓嶆杩?鏇存柊鐗堟湰閿笌搴撲腑宸茶涓嶄竴鑷存椂锛氭湰璇锋眰搴旇嚜鍔ㄥ脊鍑猴紝骞跺啓鍏?`welcome_seen_version` 浠ュ厤閲嶅鎵撴壈銆?     *
     * @param  array<string, mixed>  $welcomeState
     */
    private function prepareAutoOpen(Admin $admin, array $welcomeState): bool
    {
        $versionKey = $this->welcomeVersionKey($welcomeState);
        $seen = (string) ($admin->welcome_seen_version ?? '');
        $shouldAutoOpen = $seen !== $versionKey;
        if ($shouldAutoOpen) {
            Admin::query()->whereKey($admin->id)->update([
                'welcome_seen_version' => $versionKey,
                'updated_at' => now(),
            ]);
        }

        return $shouldAutoOpen;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildIntroCopy(): array
    {
        /** @var array<string, mixed> $copy */
        $copy = require app_path('Support/AdminWelcome/intro_copy.php');

        return $copy;
    }

    /**
     * @param  array<string, mixed>  $welcomeState
     * @return array<string, mixed>
     */
    private function buildUpdateCopy(array $welcomeState): array
    {
        /** @var callable(array): array<string, mixed> $builder */
        $builder = require app_path('Support/AdminWelcome/update_welcome_copy.php');

        return $builder($welcomeState);
    }
}
