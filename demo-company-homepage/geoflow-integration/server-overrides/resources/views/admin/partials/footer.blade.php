@php
    $appVersion = (string) config('geoflow.app_version', '2.0');
@endphp
<footer class="bg-white border-t border-gray-200 mt-12">
    <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:flex-wrap justify-center items-center gap-3 md:gap-4 text-sm text-gray-500 text-center">
            <span>© 2026 桐灼（淄博）网络科技有限公司</span>
            <span class="hidden md:inline">|</span>
            <span>桐灼 GEO 运营工作台</span>
            <span class="hidden md:inline">|</span>
            <span>版本 {{ $appVersion }}</span>
            <span class="hidden md:inline">|</span>
            <a href="/index.html" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline">官网首页</a>
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
