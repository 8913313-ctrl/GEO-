@php
    // geo_attribution_dashboard: asset_quality_score ai_performance_score mention_rate recommendation_rate citation_recall competitor_gap distribution_to_leads
    $asset = $geoAttribution['asset'] ?? [];
    $ai = $geoAttribution['ai'] ?? [];
    $business = $geoAttribution['business'] ?? [];
    $scoreCards = [
        [
            'label' => '资产质量分',
            'value' => $geoAttribution['asset_quality_score'] ?? 0,
            'suffix' => '',
            'hint' => '事实库、问题地图、证据内容和FAQ准备度',
            'icon' => 'shield-check',
            'tone' => 'from-emerald-500 to-teal-500',
        ],
        [
            'label' => 'AI表现分',
            'value' => $geoAttribution['ai_performance_score'] ?? 0,
            'suffix' => '',
            'hint' => '品牌出现、推荐、引用、排名和竞品差距',
            'icon' => 'sparkles',
            'tone' => 'from-blue-500 to-indigo-500',
        ],
        [
            'label' => '品牌出现率',
            'value' => $ai['mention_rate'] ?? 0,
            'suffix' => '%',
            'hint' => 'AI回答中是否提到品牌',
            'icon' => 'badge-check',
            'tone' => 'from-cyan-500 to-sky-500',
        ],
        [
            'label' => '推荐率',
            'value' => $ai['recommendation_rate'] ?? 0,
            'suffix' => '%',
            'hint' => 'AI回答中是否推荐品牌',
            'icon' => 'thumbs-up',
            'tone' => 'from-violet-500 to-purple-500',
        ],
    ];
@endphp

<section class="mb-8" data-geo-attribution-dashboard>
    <div class="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <h2 class="text-xl font-semibold text-gray-900">GEO增长归因看板</h2>
            <p class="mt-1 text-sm text-gray-600">把事实底座、问题地图、AI采样、内容质量、分发结果和客户线索放到同一条增长链路里。</p>
        </div>
        <div class="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            GEO attribution loop
        </div>
    </div>

    <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        @foreach ($scoreCards as $card)
            <div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
                <div class="h-1.5 bg-gradient-to-r {{ $card['tone'] }}"></div>
                <div class="p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-gray-600">{{ $card['label'] }}</div>
                            <div class="mt-2 text-3xl font-bold tracking-tight text-gray-950">
                                {{ is_numeric($card['value']) ? rtrim(rtrim(number_format((float) $card['value'], 1), '0'), '.') : $card['value'] }}{{ $card['suffix'] }}
                            </div>
                        </div>
                        <div class="rounded-lg bg-gray-50 p-2 text-gray-700">
                            <i data-lucide="{{ $card['icon'] }}" class="h-5 w-5"></i>
                        </div>
                    </div>
                    <p class="mt-3 text-xs leading-5 text-gray-500">{{ $card['hint'] }}</p>
                </div>
            </div>
        @endforeach
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 xl:col-span-2">
            <div class="mb-5 flex items-center justify-between">
                <div>
                    <h3 class="text-base font-semibold text-gray-900">增长链路拆解</h3>
                    <p class="mt-1 text-xs text-gray-500">从“被AI理解”到“被客户找到”的关键节点。</p>
                </div>
                <i data-lucide="workflow" class="h-5 w-5 text-gray-400"></i>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div class="rounded-lg bg-emerald-50 p-4">
                    <div class="text-xs font-semibold text-emerald-700">事实底座</div>
                    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <div class="text-2xl font-bold text-emerald-950">{{ number_format((int) ($asset['confirmed_facts'] ?? 0)) }}</div>
                            <div class="text-xs text-emerald-700">已确认事实</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-emerald-950">{{ number_format((int) ($asset['pending_facts'] ?? 0)) }}</div>
                            <div class="text-xs text-emerald-700">待确认</div>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg bg-blue-50 p-4">
                    <div class="text-xs font-semibold text-blue-700">问题地图</div>
                    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <div class="text-2xl font-bold text-blue-950">{{ number_format((int) ($asset['covered_opportunities'] ?? 0)) }}</div>
                            <div class="text-xs text-blue-700">已覆盖</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-blue-950">{{ number_format((int) ($asset['uncovered_opportunities'] ?? 0)) }}</div>
                            <div class="text-xs text-blue-700">待覆盖</div>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg bg-violet-50 p-4">
                    <div class="text-xs font-semibold text-violet-700">证据内容</div>
                    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <div class="text-2xl font-bold text-violet-950">{{ number_format((int) ($asset['published_articles'] ?? 0)) }}</div>
                            <div class="text-xs text-violet-700">已发文章</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-violet-950">{{ number_format((int) ($asset['published_faqs'] ?? 0)) }}</div>
                            <div class="text-xs text-violet-700">FAQ</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div class="rounded-lg border border-gray-200 p-4">
                    <div class="text-xs text-gray-500">引用召回率</div>
                    <div class="mt-1 text-xl font-bold text-gray-950">{{ $ai['citation_recall'] ?? 0 }}%</div>
                </div>
                <div class="rounded-lg border border-gray-200 p-4">
                    <div class="text-xs text-gray-500">平均排名</div>
                    <div class="mt-1 text-xl font-bold text-gray-950">{{ $ai['average_rank'] ?? 0 }}</div>
                </div>
                <div class="rounded-lg border border-gray-200 p-4">
                    <div class="text-xs text-gray-500">竞品提及</div>
                    <div class="mt-1 text-xl font-bold text-gray-950">{{ number_format((int) ($ai['competitor_gap'] ?? 0)) }}</div>
                </div>
                <div class="rounded-lg border border-gray-200 p-4">
                    <div class="text-xs text-gray-500">分发到线索</div>
                    <div class="mt-1 text-xl font-bold text-gray-950">{{ $business['distribution_to_leads'] ?? 0 }}%</div>
                </div>
            </div>
        </div>

        <div class="rounded-xl bg-slate-950 p-6 text-white shadow-sm">
            <div class="mb-5 flex items-center justify-between">
                <div>
                    <h3 class="text-base font-semibold">下一步动作</h3>
                    <p class="mt-1 text-xs text-slate-300">按影响链路优先级排序。</p>
                </div>
                <i data-lucide="list-checks" class="h-5 w-5 text-slate-300"></i>
            </div>
            <div class="space-y-3">
                @foreach (($geoAttribution['next_actions'] ?? []) as $action)
                    <div class="rounded-lg bg-white/8 p-4 ring-1 ring-white/10">
                        <div class="font-semibold text-white">{{ $action['label'] ?? '' }}</div>
                        <div class="mt-1 text-sm leading-6 text-slate-300">{{ $action['detail'] ?? '' }}</div>
                    </div>
                @endforeach
            </div>
        </div>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 xl:col-span-2">
            <div class="mb-4 flex items-center justify-between">
                <h3 class="text-base font-semibold text-gray-900">最近AI采样问题</h3>
                <span class="text-xs text-gray-500">{{ number_format((int) ($ai['sampled_count'] ?? 0)) }} 次采样</span>
            </div>
            <div class="divide-y divide-gray-100">
                @forelse (($geoAttribution['sample_rows'] ?? []) as $row)
                    <div class="grid gap-3 py-3 text-sm md:grid-cols-12 md:items-center">
                        <div class="md:col-span-5">
                            <div class="line-clamp-2 font-medium text-gray-900">{{ $row['question'] }}</div>
                            <div class="mt-1 text-xs text-gray-500">{{ $row['platform'] }} / {{ $row['surface'] }} / {{ $row['sampled_at'] }}</div>
                        </div>
                        <div class="md:col-span-2">
                            <span class="rounded-full {{ $row['mention'] ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500' }} px-2.5 py-1 text-xs font-semibold">
                                {{ $row['mention'] ? '已提及' : '未提及' }}
                            </span>
                        </div>
                        <div class="md:col-span-2">
                            <span class="rounded-full {{ $row['recommendation'] ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500' }} px-2.5 py-1 text-xs font-semibold">
                                {{ $row['recommendation'] ? '已推荐' : '未推荐' }}
                            </span>
                        </div>
                        <div class="text-gray-600 md:col-span-3">
                            排名 {{ $row['rank'] ?: '-' }} / 准确度 {{ $row['answer_accuracy'] ?: 0 }} / 竞品 {{ $row['competitor_count'] }}
                        </div>
                    </div>
                @empty
                    <div class="rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500">还没有AI平台采样数据。先在AI问答测试里建立基线，再回到这里看趋势。</div>
                @endforelse
            </div>
        </div>

        <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h3 class="text-base font-semibold text-gray-900">分发与线索</h3>
            <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-gray-50 p-4">
                    <div class="text-xs text-gray-500">成功分发</div>
                    <div class="mt-1 text-2xl font-bold text-gray-950">{{ number_format((int) ($business['distribution_synced'] ?? 0)) }}</div>
                </div>
                <div class="rounded-lg bg-gray-50 p-4">
                    <div class="text-xs text-gray-500">新增线索</div>
                    <div class="mt-1 text-2xl font-bold text-gray-950">{{ number_format((int) ($business['lead_total'] ?? 0)) }}</div>
                </div>
                <div class="rounded-lg bg-rose-50 p-4">
                    <div class="text-xs text-rose-600">失败分发</div>
                    <div class="mt-1 text-2xl font-bold text-rose-700">{{ number_format((int) ($business['distribution_failed'] ?? 0)) }}</div>
                </div>
                <div class="rounded-lg bg-amber-50 p-4">
                    <div class="text-xs text-amber-700">待处理</div>
                    <div class="mt-1 text-2xl font-bold text-amber-800">{{ number_format((int) ($business['distribution_pending'] ?? 0)) }}</div>
                </div>
            </div>

            <div class="mt-5 space-y-2">
                @forelse (($business['leads_by_service'] ?? []) as $row)
                    <div class="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span class="font-medium text-gray-700">{{ $row['service'] }}</span>
                        <span class="text-gray-500">{{ $row['count'] }}</span>
                    </div>
                @empty
                    <div class="rounded-lg bg-gray-50 px-4 py-5 text-sm text-gray-500">暂无按服务分类的线索。</div>
                @endforelse
            </div>
        </div>
    </div>
</section>
