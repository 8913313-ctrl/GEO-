@php
    $appVersion = (string) config('geoflow.app_version', '2.0');
@endphp
<footer class="bg-white border-t border-gray-200 mt-12">
    <div class="w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
        <div class="flex flex-col md:flex-row md:flex-wrap justify-center items-center gap-3 md:gap-4 text-sm text-gray-500 text-center">
            <span>漏 2026 妗愮伡锛堟穭鍗氾級缃戠粶绉戞妧鏈夐檺鍏徃</span>
            <span class="hidden md:inline">|</span>
            <span>妗愮伡 GEO 杩愯惀宸ヤ綔鍙?/span>
            <span class="hidden md:inline">|</span>
            <span>鐗堟湰 {{ $appVersion }}</span>
            <span class="hidden md:inline">|</span>
            <a href="/index.html" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline">瀹樼綉棣栭〉</a>
        </div>
    </div>
</footer>
<script>
    window.ADMIN_BASE_PATH = @json('/'.\App\Support\AdminWeb::basePath());
    window.adminUrl = function (path) {
        const base = window.ADMIN_BASE_PATH || '';
        if (!path) return base + '/';
        return base + '/' + String(path).replace(/^\/+/, '');
    };
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
</script>
