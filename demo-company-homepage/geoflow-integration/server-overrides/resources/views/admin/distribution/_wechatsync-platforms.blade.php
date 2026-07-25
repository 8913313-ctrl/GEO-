@php($selectedPlatforms = old('wechatsync_platforms', $selectedPlatforms ?? ['wechat_mp', 'zhihu', 'toutiao', 'juejin', 'csdn']))
@php($selectedPlatforms = is_array($selectedPlatforms) ? array_map('strval', $selectedPlatforms) : [])
@php($platformOptions = [
    'wechat_mp',
    'zhihu',
    'weibo',
    'xiaohongshu',
    'juejin',
    'csdn',
    'jianshu',
    'toutiao',
    'douyin',
    'bilibili',
    'baijiahao',
    'yuque',
    'douban',
    'sohu',
    'xueqiu',
    'woshipm',
    'dayu',
    'yidian',
    '51cto',
    'imooc',
    'oschina',
    'segmentfault',
    'cnblogs',
    'sohufocus',
    'x',
    'eastmoney',
    'smzdm',
    'netease',
    'zip-download',
])

<div class="rounded-lg border border-cyan-100 bg-cyan-50 p-5">
    <div class="mb-5">
        <h2 class="text-lg font-medium text-gray-900">{{ __('admin.distribution.wechatsync.section_title') }}</h2>
        <p class="mt-1 text-sm leading-6 text-gray-600">{{ __('admin.distribution.wechatsync.section_desc') }}</p>
    </div>

    <div>
        <div class="text-sm font-medium text-gray-700">{{ __('admin.distribution.wechatsync.platforms_title') }}</div>
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @foreach ($platformOptions as $platform)
                <label class="flex cursor-pointer items-start gap-3 rounded-md border border-cyan-100 bg-white px-4 py-3 hover:border-cyan-300">
                    <input type="checkbox" name="wechatsync_platforms[]" value="{{ $platform }}" class="mt-1 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" @checked(in_array($platform, $selectedPlatforms, true))>
                    <span>
                        <span class="block text-sm font-semibold text-gray-900">{{ __('admin.distribution.wechatsync.platforms.'.$platform) }}</span>
                        <span class="mt-1 block text-xs leading-5 text-gray-500">{{ __('admin.distribution.wechatsync.platform_hints.'.$platform) }}</span>
                    </span>
                </label>
            @endforeach
        </div>
        <p class="mt-3 text-xs leading-5 text-gray-500">{{ __('admin.distribution.wechatsync.platforms_help') }}</p>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-3">
        <div class="rounded-md border border-cyan-100 bg-white px-3 py-3">
            <div class="font-medium text-gray-900">{{ __('admin.distribution.wechatsync.feature_package') }}</div>
            <div class="mt-1 text-xs leading-5 text-gray-500">Markdown / HTML / metadata / images</div>
        </div>
        <div class="rounded-md border border-cyan-100 bg-white px-3 py-3">
            <div class="font-medium text-gray-900">{{ __('admin.distribution.wechatsync.feature_local') }}</div>
            <div class="mt-1 text-xs leading-5 text-gray-500">{{ __('admin.distribution.wechatsync.feature_local_desc') }}</div>
        </div>
        <div class="rounded-md border border-cyan-100 bg-white px-3 py-3">
            <div class="font-medium text-gray-900">{{ __('admin.distribution.wechatsync.feature_review') }}</div>
            <div class="mt-1 text-xs leading-5 text-gray-500">{{ __('admin.distribution.wechatsync.feature_review_desc') }}</div>
        </div>
    </div>
</div>
