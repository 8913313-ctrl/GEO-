<?php

namespace App\Services\GeoGrowth;

use App\Models\Article;
use App\Models\ArticleDistribution;
use App\Models\ContactLead;
use App\Models\DistributionChannel;
use App\Models\PublisherDevice;
use App\Models\TongzhuoCmsPage;
use App\Models\TongzhuoCustomerProject;
use App\Models\TongzhuoFactCard;
use App\Models\TongzhuoFaqItem;
use App\Models\TongzhuoGeoAnswerTest;
use App\Models\TongzhuoGeoOpportunity;
use App\Models\TongzhuoGeoPlanItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ProductWorkbenchService
{
    public function __construct(
        private readonly ProductMaturityGateService $maturityGate,
    ) {}

    /**
     * product_workbench_contract: cms_console geo_growth distribution_publisher lead_customer_delivery ai_visibility_loop reusable_product_template
     *
     * @return array<string,mixed>
     */
    public function summary(): array
    {
        $stats = $this->stats();

        return [
            'stats' => $stats,
            'module_cards' => $this->moduleCards($stats),
            'growth_loop' => $this->growthLoop($stats),
            'next_actions' => $this->nextActions($stats),
            'delivery_snapshot' => $this->deliverySnapshot($stats),
            'product_maturity_gate' => $this->maturityGate->evaluate($stats),
        ];
    }

    /** @return array<string,int|float> */
    private function stats(): array
    {
        $factTotal = $this->count(TongzhuoFactCard::class, 'tongzhuo_fact_cards');
        $confirmedFacts = $this->count(TongzhuoFactCard::class, 'tongzhuo_fact_cards', fn (Builder $query) => $query->where('status', 'confirmed'));
        $opportunities = $this->count(TongzhuoGeoOpportunity::class, 'tongzhuo_geo_opportunities');
        $coveredOpportunities = $this->count(TongzhuoGeoOpportunity::class, 'tongzhuo_geo_opportunities', function (Builder $query): void {
            $query->whereIn('coverage_status', ['covered', 'in_progress'])->orWhereNotNull('mapped_assets');
        });
        $articlesPublished = $this->count(Article::class, 'articles', fn (Builder $query) => $query->where('status', 'published'));
        $faqsPublished = $this->count(TongzhuoFaqItem::class, 'tongzhuo_faq_items', fn (Builder $query) => $query->where('status', 'published'));
        $answerTests = $this->count(TongzhuoGeoAnswerTest::class, 'tongzhuo_geo_answer_tests');
        $answerMentions = $this->count(TongzhuoGeoAnswerTest::class, 'tongzhuo_geo_answer_tests', fn (Builder $query) => $query->where('mention', true));
        $answerRecommendations = $this->count(TongzhuoGeoAnswerTest::class, 'tongzhuo_geo_answer_tests', fn (Builder $query) => $query->where('recommendation', true));
        $distributionTotal = $this->count(ArticleDistribution::class, 'article_distributions');
        $distributionSynced = $this->count(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->where('status', 'synced'));

        return [
            'cms_pages_total' => $this->count(TongzhuoCmsPage::class, 'tongzhuo_cms_pages'),
            'cms_pages_published' => $this->count(TongzhuoCmsPage::class, 'tongzhuo_cms_pages', fn (Builder $query) => $query->where('status', 'published')),
            'fact_total' => $factTotal,
            'confirmed_facts' => $confirmedFacts,
            'fact_readiness' => $this->percent($confirmedFacts, max(8, $factTotal)),
            'opportunities' => $opportunities,
            'covered_opportunities' => $coveredOpportunities,
            'opportunity_coverage' => $this->percent($coveredOpportunities, max(12, $opportunities)),
            'articles_total' => $this->count(Article::class, 'articles'),
            'articles_published' => $articlesPublished,
            'faqs_published' => $faqsPublished,
            'content_readiness' => $this->percent($articlesPublished + $faqsPublished, 30),
            'answer_tests' => $answerTests,
            'answer_mentions' => $answerMentions,
            'answer_recommendations' => $answerRecommendations,
            'mention_rate' => $this->percent($answerMentions, $answerTests),
            'recommendation_rate' => $this->percent($answerRecommendations, $answerTests),
            'channels_active' => $this->count(DistributionChannel::class, 'distribution_channels', fn (Builder $query) => $query->where('status', 'active')),
            'distribution_total' => $distributionTotal,
            'distribution_synced' => $distributionSynced,
            'distribution_pending' => $this->count(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->whereIn('status', ['queued', 'sending'])),
            'distribution_failed' => $this->count(ArticleDistribution::class, 'article_distributions', fn (Builder $query) => $query->where('status', 'failed')),
            'distribution_success_rate' => $this->percent($distributionSynced, $distributionTotal),
            'devices_online' => $this->count(PublisherDevice::class, 'publisher_devices', fn (Builder $query) => $query->whereNull('disabled_at')->where('last_seen_at', '>=', now()->subMinutes(2))),
            'leads_total' => $this->count(ContactLead::class, 'contact_leads'),
            'leads_new' => $this->count(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->where('status', 'new')),
            'leads_qualified' => $this->count(ContactLead::class, 'contact_leads', fn (Builder $query) => $query->where('status', 'qualified')),
            'customer_projects' => $this->count(TongzhuoCustomerProject::class, 'tongzhuo_customer_projects'),
            'risk_projects' => $this->count(TongzhuoCustomerProject::class, 'tongzhuo_customer_projects', fn (Builder $query) => $query->where('health_status', 'risk')),
            'plan_items_open' => $this->count(TongzhuoGeoPlanItem::class, 'tongzhuo_geo_plan_items', fn (Builder $query) => $query->whereIn('status', ['todo', 'doing'])),
        ];
    }

    /** @return list<array<string,mixed>> */
    private function moduleCards(array $stats): array
    {
        return [
            ['key' => 'cms_console', 'title' => '官网CMS', 'subtitle' => '页面、导航、FAQ、AI抓取入口', 'metric' => $stats['cms_pages_published'], 'unit' => '已发布页面', 'href' => route('admin.tongzhuo-cms.dashboard'), 'icon' => 'panels-top-left', 'tone' => 'blue', 'health' => $stats['cms_pages_published'] >= 8 ? 'ready' : 'watch'],
            ['key' => 'geo_growth', 'title' => 'GEO运营', 'subtitle' => '事实底座、问题地图、AI采样', 'metric' => $stats['covered_opportunities'], 'unit' => '已覆盖问题', 'href' => route('admin.geo-growth.index'), 'icon' => 'sparkles', 'tone' => 'violet', 'health' => $stats['opportunity_coverage'] >= 70 ? 'ready' : 'watch'],
            ['key' => 'content_ops', 'title' => '内容生产', 'subtitle' => '行业资讯、证据页、服务内容', 'metric' => $stats['articles_published'], 'unit' => '已发文章', 'href' => route('admin.articles.index'), 'icon' => 'newspaper', 'tone' => 'emerald', 'health' => $stats['content_readiness'] >= 70 ? 'ready' : 'watch'],
            ['key' => 'distribution_publisher', 'title' => '分发发布', 'subtitle' => '官网发布、平台同步、设备回写', 'metric' => $stats['distribution_pending'], 'unit' => '待处理任务', 'href' => route('admin.distribution.jobs'), 'icon' => 'send', 'tone' => 'cyan', 'health' => $stats['distribution_failed'] > 0 ? 'risk' : 'ready'],
            ['key' => 'lead_customer_delivery', 'title' => '线索与客户', 'subtitle' => '客户表单、项目档案、交付复盘', 'metric' => $stats['leads_new'], 'unit' => '待跟进线索', 'href' => route('admin.contact-leads.index'), 'icon' => 'message-square-more', 'tone' => 'rose', 'health' => $stats['leads_new'] > 0 ? 'watch' : 'ready'],
            ['key' => 'ai_visibility_loop', 'title' => '效果归因', 'subtitle' => 'AI出现率、推荐率、分发到线索', 'metric' => $stats['recommendation_rate'], 'unit' => '推荐率', 'href' => route('admin.analytics'), 'icon' => 'chart-no-axes-combined', 'tone' => 'slate', 'health' => $stats['answer_tests'] >= 10 ? 'ready' : 'watch'],
        ];
    }

    /** @return list<array<string,mixed>> */
    private function growthLoop(array $stats): array
    {
        return [
            ['label' => '事实底座', 'value' => $stats['confirmed_facts'], 'target' => 8, 'rate' => $stats['fact_readiness'], 'href' => route('admin.fact-base.index')],
            ['label' => '问题地图', 'value' => $stats['covered_opportunities'], 'target' => max(12, $stats['opportunities']), 'rate' => $stats['opportunity_coverage'], 'href' => route('admin.geo-opportunities.index')],
            ['label' => '证据内容', 'value' => $stats['articles_published'] + $stats['faqs_published'], 'target' => 30, 'rate' => $stats['content_readiness'], 'href' => route('admin.articles.index')],
            ['label' => '平台分发', 'value' => $stats['distribution_synced'], 'target' => max(1, $stats['distribution_total']), 'rate' => $stats['distribution_success_rate'], 'href' => route('admin.distribution.jobs')],
            ['label' => 'AI采样', 'value' => $stats['answer_tests'], 'target' => 10, 'rate' => min(100, $this->percent($stats['answer_tests'], 10)), 'href' => route('admin.geo-answer-tests.index')],
            ['label' => '线索回收', 'value' => $stats['leads_total'], 'target' => 1, 'rate' => min(100, $this->percent($stats['leads_total'], 1)), 'href' => route('admin.contact-leads.index')],
        ];
    }

    /** @return list<array<string,string>> */
    private function nextActions(array $stats): array
    {
        $actions = [];
        if ($stats['confirmed_facts'] < 8) {
            $actions[] = ['title' => '补齐事实底座', 'body' => '先录入企业实体、服务边界、案例、资质和禁用表达，避免内容生成失真。', 'href' => route('admin.fact-base.index'), 'icon' => 'database-zap'];
        }
        if ($stats['opportunity_coverage'] < 70) {
            $actions[] = ['title' => '整理问题地图', 'body' => '把客户会问、AI会改写的问题绑定到文章、FAQ或服务页。', 'href' => route('admin.geo-opportunities.index'), 'icon' => 'radar'];
        }
        if ($stats['articles_published'] < 10) {
            $actions[] = ['title' => '发布证据型行业资讯', 'body' => '文章要有直接回答、事实证据、操作步骤、FAQ和更新时间。', 'href' => route('admin.articles.index'), 'icon' => 'newspaper'];
        }
        if ($stats['distribution_failed'] > 0) {
            $actions[] = ['title' => '处理分发失败', 'body' => '失败任务会影响外部信源覆盖，优先进入分发队列重试或人工确认。', 'href' => route('admin.distribution.jobs', ['status' => 'failed']), 'icon' => 'send'];
        }
        if ($stats['answer_tests'] < 10) {
            $actions[] = ['title' => '建立AI采样基线', 'body' => '对DeepSeek、豆包、千问、Kimi、ChatGPT等平台做同题采样。', 'href' => route('admin.geo-answer-tests.index'), 'icon' => 'messages-square'];
        }
        if ($stats['leads_new'] > 0) {
            $actions[] = ['title' => '跟进客户线索', 'body' => '官网表单已进入后台，及时标记状态和沟通记录。', 'href' => route('admin.contact-leads.index', ['status' => 'new']), 'icon' => 'message-square-more'];
        }
        if ($actions === []) {
            $actions[] = ['title' => '进入周度复盘', 'body' => '当前链路健康，建议检查归因看板并安排下一轮内容和采样。', 'href' => route('admin.analytics'), 'icon' => 'chart-no-axes-combined'];
        }

        return array_slice($actions, 0, 5);
    }

    /** @return array<string,int> */
    private function deliverySnapshot(array $stats): array
    {
        return [
            'website_assets' => (int) round(min(100, ($stats['cms_pages_published'] * 100) / 8)),
            'geo_assets' => (int) round(($stats['fact_readiness'] * 0.35) + ($stats['opportunity_coverage'] * 0.35) + ($stats['content_readiness'] * 0.30)),
            'publishing_assets' => (int) round(($stats['channels_active'] > 0 ? 40 : 0) + ($stats['devices_online'] > 0 ? 30 : 0) + min(30, $stats['distribution_success_rate'] * 0.30)),
            'measurement_assets' => (int) round(min(100, ($stats['answer_tests'] * 8) + ($stats['leads_total'] > 0 ? 20 : 0) + ($stats['customer_projects'] > 0 ? 20 : 0))),
        ];
    }

    private function count(string $model, string $table, ?callable $scope = null): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        try {
            /** @var Builder $query */
            $query = $model::query();
            if ($scope !== null) {
                $scope($query);
            }

            return (int) $query->count();
        } catch (Throwable) {
            return 0;
        }
    }

    private function percent(int|float $value, int|float $total): float
    {
        return $total > 0 ? round(min(100, ($value * 100) / $total), 1) : 0.0;
    }
}
