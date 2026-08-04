@php
    $cmsActive = $cmsActive ?? 'overview';
    $cmsTabs = [
        'overview' => ['label' => '瀹樼綉姒傝', 'href' => route('admin.site-console'), 'icon' => 'layout-dashboard'],
        'pages' => ['label' => '椤甸潰绠＄悊', 'href' => route('admin.site-console.pages'), 'icon' => 'panel-top'],
        'settings' => ['label' => '鍏ㄧ珯璁剧疆', 'href' => route('admin.site-console.settings'), 'icon' => 'settings'],
        'ai' => ['label' => 'AI鎶撳彇璁剧疆', 'href' => route('admin.site-console.ai-crawl'), 'icon' => 'bot'],
        'leads' => ['label' => '琛ㄥ崟绾跨储', 'href' => route('admin.contact-leads.index'), 'icon' => 'inbox'],
        'articles' => ['label' => '琛屼笟璧勮', 'href' => route('admin.articles.index'), 'icon' => 'newspaper'],
    ];
@endphp

<div class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
    <nav class="flex flex-wrap gap-2">
        @foreach ($cmsTabs as $key => $tab)
            <a href="{{ $tab['href'] }}"
               class="@if($cmsActive === $key) bg-slate-950 text-white shadow-sm @else text-slate-600 hover:bg-slate-50 hover:text-slate-950 @endif inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-bold transition">
                <i data-lucide="{{ $tab['icon'] }}" class="mr-2 h-4 w-4"></i>
                {{ $tab['label'] }}
            </a>
        @endforeach
    </nav>
</div>
