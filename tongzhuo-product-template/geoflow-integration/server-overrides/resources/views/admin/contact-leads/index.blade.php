@extends('admin.layouts.app')

@section('content')
    @php
        $statusLabels = [
            'new' => '寰呰窡杩?,
            'contacted' => '宸茶仈绯?,
            'qualified' => '閲嶇偣瀹㈡埛',
            'closed' => '宸插叧闂?,
        ];
    @endphp

    <div class="space-y-6 px-4 sm:px-0">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
                <div class="text-sm font-medium text-blue-600">LEAD CENTER</div>
                <h1 class="mt-1 text-2xl font-bold text-gray-900">瀹㈡埛绾跨储</h1>
                <p class="mt-1 text-sm text-gray-600">瀹樼綉鎻愪氦鐨勪笟鍔¤瘖鏂渶姹備細鑷姩杩涘叆杩欓噷銆?/p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
                <a href="{{ route('admin.contact-leads.index') }}" class="rounded-md border px-3 py-2 {{ $status === '' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">鍏ㄩ儴 {{ $total }}</a>
                @foreach ($statusLabels as $key => $label)
                    <a href="{{ route('admin.contact-leads.index', ['status' => $key]) }}" class="rounded-md border px-3 py-2 {{ $status === $key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600' }}">{{ $label }} {{ $counts[$key] ?? 0 }}</a>
                @endforeach
            </div>
        </div>

        <div class="overflow-hidden rounded-lg bg-white shadow">
            @forelse ($leads as $lead)
                <article class="border-b border-gray-100 p-5 last:border-b-0">
                    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="text-lg font-semibold text-gray-900">{{ $lead->name }}</h2>
                                <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{{ $statusLabels[$lead->status] ?? $lead->status }}</span>
                                <span class="text-xs text-gray-400">#{{ $lead->id }} 路 {{ $lead->created_at?->format('Y-m-d H:i') }}</span>
                            </div>
                            <div class="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                                <div><span class="text-gray-400">鑱旂郴鐢佃瘽锛?/span><a class="text-blue-700 hover:underline" href="tel:{{ $lead->phone }}">{{ $lead->phone }}</a></div>
                                <div><span class="text-gray-400">浼佷笟鍚嶇О锛?/span>{{ $lead->company ?: '鏈～鍐? }}</div>
                                <div><span class="text-gray-400">鍏虫敞鏈嶅姟锛?/span>{{ $lead->service }}</div>
                                <div><span class="text-gray-400">瀹樼綉/璐﹀彿锛?/span>{{ $lead->website ?: '鏈～鍐? }}</div>
                            </div>
                            <div class="mt-4 rounded-md bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700 whitespace-pre-wrap">{{ $lead->message }}</div>
                            @if ($lead->note)
                                <div class="mt-3 text-sm text-gray-500"><span class="font-medium text-gray-700">璺熻繘澶囨敞锛?/span>{{ $lead->note }}</div>
                            @endif
                        </div>
                        <form method="POST" action="{{ route('admin.contact-leads.update', ['leadId' => $lead->id]) }}" class="w-full space-y-2 xl:w-72">
                            @csrf
                            @method('PATCH')
                            <label class="block text-xs font-medium text-gray-500" for="status-{{ $lead->id }}">鏇存柊鐘舵€?/label>
                            <select id="status-{{ $lead->id }}" name="status" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                @foreach ($statusLabels as $key => $label)
                                    <option value="{{ $key }}" @selected($lead->status === $key)>{{ $label }}</option>
                                @endforeach
                            </select>
                            <textarea name="note" rows="2" class="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="琛ュ厖璺熻繘澶囨敞">{{ $lead->note }}</textarea>
                            <button type="submit" class="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">淇濆瓨璺熻繘璁板綍</button>
                        </form>
                    </div>
                </article>
            @empty
                <div class="px-6 py-16 text-center text-sm text-gray-500">褰撳墠杩樻病鏈夊鎴锋彁浜よ瘖鏂渶姹傘€?/div>
            @endforelse
        </div>

        @if ($leads->hasPages())
            <div>{{ $leads->links() }}</div>
        @endif
    </div>
@endsection
