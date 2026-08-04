@php
    $adminBrandName = '桐灼 GEO 运营工作台';
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@isset($pageTitle){{ $pageTitle }} · @endisset{{ $adminBrandName }}</title>
    <script src="{{ asset('js/tailwindcss.play-cdn.js') }}"></script>
    <script src="{{ asset('js/lucide.min.js') }}"></script>
    @stack('styles')
</head>
<body class="min-h-screen bg-[#f5f7fb] text-slate-800 antialiased">
@include('admin.partials.header', [
    'adminBrandName' => $adminBrandName,
    'adminSiteName' => $adminSiteName ?? $adminBrandName,
    'pageTitle' => $pageTitle ?? '',
    'activeMenu' => $activeMenu ?? '',
])
    <div class="min-h-screen pt-14 md:pl-64">
        <main class="w-full px-4 py-5 sm:px-5 lg:px-7 2xl:px-8">
            @if (session('message'))
                <div class="admin-flash-alert mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <span class="block sm:inline">{{ session('message') }}</span>
                </div>
            @endif
            @if (isset($errors) && $errors->any())
                <div class="admin-flash-alert mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    @foreach ($errors->all() as $err)
                        <div>{{ $err }}</div>
                    @endforeach
                </div>
            @endif
            @yield('content')
        </main>
        @include('admin.partials.footer')
    </div>
@include('admin.partials.welcome-modal')
@stack('scripts')
<script>
    if (window.lucide) window.lucide.createIcons();
</script>
</body>
</html>
