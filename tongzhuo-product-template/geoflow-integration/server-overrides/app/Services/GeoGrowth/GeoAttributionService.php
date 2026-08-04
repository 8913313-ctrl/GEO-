<?php

namespace App\Services\GeoGrowth;

use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\ContactLead;
use App\Models\TongzhuoFactCard;
use App\Models\TongzhuoFaqItem;
use App\Models\TongzhuoGeoAnswerTest;
use App\Models\TongzhuoGeoOpportunity;
use App\Models\TongzhuoGeoPlanItem;
use App\Services\Admin\Analytics\AnalyticsFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class GeoAttributionService
{
    public function __construct(
        private readonly ArticleGeoQualityScorer $qualityScorer,
    ) {}

    /**
     * geo_attribution_contract: asset_quality_score ai_performance_score mention_rate recommendation_rate citation_recall competitor_gap distribution_to_leads
     *
     * @return array<string,mixed>
     */
    public function summary(AnalyticsFilter $filter): array
    {
        $asset = $this->assetQuality($filter);
        $ai = $this->aiPerformance($filter);
        $business = $this->businessOutcome($filter);

        return [
            'asset_quality_score' => $asset['score'],
            'ai_performance_score' => $ai['score'],
            'asset' => $asset,
            'ai' => $ai,
            'business' => $business,
            'next_actions' => $this->nextActions($asset, $ai, $business),
            'sample_rows' => $this->sampleRows($filter),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function assetQuality(AnalyticsFilter $filter): array
    {
        $factTotal = $this->countIfTable(TongzhuoFactCard::class, 'tongzhuo_fact_cards');
        $confirmedFacts = $this->countIfTable(TongzhuoFactCard::class, 'tongzhuo_fact_cards', fn (Builder $query) => $query->where('status', 'confirmed'));
        $pendingFacts = $this->countIfTable(TongzhuoFactCard::class, 'tongzhuo_fact_cards', fn (Builder $query) => $query->where('status', 'pending'));
        $forbiddenFacts = $this->countIfTable(TongzhuoFactCard::class, 'tongzhuo_fact_cards', fn (Builder $query) => $query->where('status', 'forbidden'));

        $opportunityTotal = $this->countIfTable(TongzhuoGeoOpportunity::class, 'tongzhuo_geo_opportunities');
        $coveredOpportunities = $this->countIfTable(TongzhuoGeoOpportunity::class, 'tongzhuo_geo_opportunities', function (Builder $query): void {
            $query->whereIn('coverage_status', ['covered', 'in_progress'])
                ->orWhereNotNull('mapped_assets');
        });
        $uncoveredOpportunities = max(0, $opportunityTotal - $coveredOpportunities);

        $publishedArticles = $this->articleQuery($filter)->where('status', 'published')->count();
        $publishedFaqs = $this->countIfTable(TongzhuoFaqItem::class, 'tongzhuo_faq_items', fn (Builder $query) => $query->where('status', 'published'));
        $quality = $this->contentQualitySample($filter);

        $factScore = $this->ratioScore($confirmedFacts, max(8, $factTotal + $pendingFacts));
        $coverageScore = $this->ratioScore($coveredOpportunities, max(12, $opportunityTotal));
        $contentScore = $this->ratioScore($publishedArticles + $publishedFaqs, 30);
        $qualityScore = (int) ($quality['average_score'] ?? 0);

        $score = (int) round(($factScore * 0.25) + ($coverageScore * 0.25) + ($contentScore * 0.20) + ($qualityScore * 0.30));

        return [
            'score' => $score,
            'fact_total' => $factTotal,
            'confirmed_facts' => $confirmedFacts,
            'pending_facts' => $pendingFacts,
            'forbidden_facts' => $forbiddenFacts,
            'opportunity_total' => $opportunityTotal,
            'covered_opportunities' => $coveredOpportunities,
            'uncovered_opportunities' => $uncoveredOpportunities,
            'published_articles' => (int) $publishedArticles,
            'published_faqs' => $publishedFaqs,
            'average_content_quality' => $qualityScore,
            'quality_ready_articles' => (int) ($quality['ready_count'] ?? 0),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function aiPerformance(AnalyticsFilter $filter): array
    {
        if (! Schema::hasTable('tongzhuo_geo_answer_tests')) {
            return [
                'score' => 0,
                'sampled_count' => 0,
                'mention_rate' => 0.0,
                'recommendation_rate' => 0.0,
                'citation_recall' => 0.0,
                'average_rank' => 0.0,
                'average_accuracy' => 0.0,
                'competitor_gap' => 0,
                'competitor_mentions' => 0,
            ];
        }

        $query = TongzhuoGeoAnswerTest::query()
            ->whereBetween('created_at', [$filter->start(), $filter->end()]);

        $sampled = (int) (clone $query)->count();
        $mentions = (int) (clone $query)->where('mention', true)->count();
        $recommendations = (int) (clone $query)->where('recommendation', true)->count();
        $ranked = (clone $query)->whereNotNull('rank');
        $averageRank = (float) ((clone $ranked)->avg('rank') ?? 0);
        $averageAccuracy = (float) ((clone $query)->whereNotNull('answer_accuracy')->avg('answer_accuracy') ?? 0);

        $citationRows = (clone $query)->whereNotNull('citations')->get(['citations', 'competitor_mentions']);
        $withCitations = 0;
        $competitorMentions = 0;
        foreach ($citationRows as $row) {
            $citations = is_array($row->citations) ? $row->citations : [];
            $competitors = is_array($row->competitor_mentions) ? $row->competitor_mentions : [];
            if (count($citations) > 0) {
                $withCitations++;
            }
            $competitorMentions += count($competitors);
        }

        $mentionRate = $this->percent($mentions, $sampled);
        $recommendationRate = $this->percent($recommendations, $sampled);
        $citationRecall = $this->percent($withCitations, $sampled);
        $rankScore = $averageRank > 0 ? max(0, 100 - (($averageRank - 1) * 18)) : 0;
        $competitorPenalty = min(25, $competitorMentions * 3);
        $score = (int) max(0, round(($mentionRate * 0.25) + ($recommendationRate * 0.30) + ($citationRecall * 0.20) + ($averageAccuracy * 0.15) + ($rankScore * 0.10) - $competitorPenalty));

        return [
            'score' => $score,
            'sampled_count' => $sampled,
            'mention_rate' => $mentionRate,
            'recommendation_rate' => $recommendationRate,
            'citation_recall' => $citationRecall,
            'average_rank' => round($averageRank, 1),
            'average_accuracy' => round($averageAccuracy, 1),
            'competitor_gap' => $competitorMentions,
            'competitor_mentions' => $competitorMentions,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function businessOutcome(AnalyticsFilter $filter): array
    {
        $distributionTotal = $this->countIfTable(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()]));
        $distributionSynced = $this->countIfTable(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()])->where('status', 'synced'));
        $distributionFailed = $this->countIfTable(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()])->where('status', 'failed'));
        $distributionPending = $this->countIfTable(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()])->whereIn('status', ['queued', 'sending']));

        $leadTotal = $this->countIfTable(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()]));
        $leadNew = $this->countIfTable(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->whereBetween('created_at', [$filter->start(), $filter->end()])->where('status', 'new'));

        return [
            'distribution_total' => $distributionTotal,
            'distribution_synced' => $distributionSynced,
            'distribution_failed' => $distributionFailed,
            'distribution_pending' => $distributionPending,
            'lead_total' => $leadTotal,
            'lead_new' => $leadNew,
            'distribution_to_leads' => $distributionSynced > 0 ? round(($leadTotal * 100) / $distributionSynced, 1) : 0.0,
            'leads_by_service' => $this->leadsByService($filter),
        ];
    }

    /**
     * @return list<array{label:string,detail:string,tone:string}>
     */
    private function nextActions(array $asset, array $ai, array $business): array
    {
        $actions = [];
        if (($asset['confirmed_facts'] ?? 0) < 8) {
            $actions[] = ['label' => '补齐事实底座', 'detail' => '先把企业实体、服务边界、案例和资质沉淀为可引用事实卡。', 'tone' => 'amber'];
        }
        if (($asset['uncovered_opportunities'] ?? 0) > 0) {
            $actions[] = ['label' => '处理未覆盖问题', 'detail' => '把问题地图中未覆盖的问题绑定到页面、文章或FAQ。', 'tone' => 'blue'];
        }
        if (($asset['average_content_quality'] ?? 0) < 75) {
            $actions[] = ['label' => '提升证据内容质量', 'detail' => '给文章补充直接回答、事实证据、对比、步骤、FAQ和更新时间。', 'tone' => 'violet'];
        }
        if (($ai['sampled_count'] ?? 0) < 10) {
            $actions[] = ['label' => '建立AI采样基线', 'detail' => '对DeepSeek、豆包、千问、Kimi等平台进行同题多次采样。', 'tone' => 'cyan'];
        } elseif (($ai['recommendation_rate'] ?? 0) < 40) {
            $actions[] = ['label' => '优化AI推荐率', 'detail' => '优先修正未被推荐的问题簇，补充外部信源和案例证据。', 'tone' => 'rose'];
        }
        if (($business['distribution_failed'] ?? 0) > 0) {
            $actions[] = ['label' => '处理分发失败', 'detail' => '检查发布助手回传状态，优先重试失败平台。', 'tone' => 'red'];
        }
        if (count($actions) === 0) {
            $actions[] = ['label' => '进入复采复盘', 'detail' => '当前闭环健康，建议按周复采AI表现并复盘线索质量。', 'tone' => 'emerald'];
        }

        return array_slice($actions, 0, 5);
    }

    /**
     * @return list<array<string,mixed>>
     */
    private function sampleRows(AnalyticsFilter $filter): array
    {
        if (! Schema::hasTable('tongzhuo_geo_answer_tests')) {
            return [];
        }

        return TongzhuoGeoAnswerTest::query()
            ->whereBetween('created_at', [$filter->start(), $filter->end()])
            ->orderByDesc('sampled_at')
            ->orderByDesc('created_at')
            ->select('question', 'platform', 'surface', 'mention', 'recommendation', 'rank', 'answer_accuracy', 'competitor_mentions', 'sampled_at')
            ->limit(6)
            ->get()
            ->map(function (TongzhuoGeoAnswerTest $test): array {
                return [
                    'question' => (string) $test->question,
                    'platform' => (string) ($test->platform ?: 'local'),
                    'surface' => (string) ($test->surface ?: 'web'),
                    'mention' => (bool) $test->mention,
                    'recommendation' => (bool) $test->recommendation,
                    'rank' => $test->rank,
                    'answer_accuracy' => $test->answer_accuracy,
                    'competitor_count' => count(is_array($test->competitor_mentions) ? $test->competitor_mentions : []),
                    'sampled_at' => $test->sampled_at instanceof Carbon ? $test->sampled_at->format('Y-m-d H:i') : '',
                ];
            })
            ->all();
    }

    /**
     * @return array{average_score:int,ready_count:int}
     */
    private function contentQualitySample(AnalyticsFilter $filter): array
    {
        $articles = $this->articleQuery($filter)
            ->where('status', 'published')
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        if ($articles->isEmpty()) {
            return ['average_score' => 0, 'ready_count' => 0];
        }

        $scores = $articles->map(fn (Article $article): array => $this->qualityScorer->score($article));

        return [
            'average_score' => (int) round($scores->avg('score') ?? 0),
            'ready_count' => (int) $scores->where('level', 'ready')->count(),
        ];
    }

    /**
     * @return list<array{service:string,count:int}>
     */
    private function leadsByService(AnalyticsFilter $filter): array
    {
        if (! Schema::hasTable('contact_leads')) {
            return [];
        }

        return ContactLead::query()
            ->whereBetween('created_at', [$filter->start(), $filter->end()])
            ->selectRaw('COALESCE(NULLIF(service, \'\'), \'未分类\') as service, COUNT(*) as count')
            ->groupBy('service')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn ($row): array => [
                'service' => (string) $row->service,
                'count' => (int) $row->count,
            ])
            ->all();
    }

    /**
     * @return Builder<Article>
     */
    private function articleQuery(AnalyticsFilter $filter): Builder
    {
        return Article::query()
            ->whereNull('deleted_at')
            ->whereBetween('created_at', [$filter->start(), $filter->end()]);
    }

    private function countIfTable(string $modelClass, string $table, ?callable $scope = null): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        /** @var Builder $query */
        $query = $modelClass::query();
        if ($scope !== null) {
            $scope($query);
        }

        return (int) $query->count();
    }

    private function ratioScore(int|float $value, int|float $target): int
    {
        return (int) min(100, round(($value * 100) / max(1, $target)));
    }

    private function percent(int|float $value, int|float $total): float
    {
        return $total > 0 ? round(($value * 100) / $total, 1) : 0.0;
    }
}
