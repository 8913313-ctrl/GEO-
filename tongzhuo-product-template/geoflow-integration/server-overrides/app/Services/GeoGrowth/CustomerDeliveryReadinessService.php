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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;
use Throwable;

class CustomerDeliveryReadinessService
{
    /**
     * customer_delivery_readiness_contract: reusable_customer_instance website_admin_endpoints ai_crawl_files fact_question_content_loop publishing_loop lead_capture acceptance_evidence security_boundary
     *
     * @return array<string,mixed>
     */
    public function evaluate(TongzhuoCustomerProject $project): array
    {
        $checks = $this->checks($project);
        $passedWeight = array_sum(array_map(fn (array $check): int => ($check['passed'] ?? false) ? (int) $check['weight'] : 0, $checks));
        $totalWeight = max(1, array_sum(array_map(fn (array $check): int => (int) $check['weight'], $checks)));
        $score = (int) round(($passedWeight * 100) / $totalWeight);

        return [
            'score' => $score,
            'status' => $score >= 85 ? 'ready' : ($score >= 65 ? 'watch' : 'risk'),
            'checks' => $checks,
            'delivery_tasks' => $this->deliveryTasks($checks, $project),
            'passed_count' => count(array_filter($checks, fn (array $check): bool => (bool) ($check['passed'] ?? false))),
            'total_count' => count($checks),
            'blocking_gaps' => array_values(array_filter($checks, fn (array $check): bool => ! (bool) ($check['passed'] ?? false) && (bool) ($check['blocking'] ?? false))),
            'next_actions' => $this->nextActions($checks),
        ];
    }

    /**
     * @return list<array<string,mixed>>
     */
    private function checks(TongzhuoCustomerProject $project): array
    {
        $profile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
        $readiness = is_array($profile['readiness'] ?? null) ? $profile['readiness'] : [];
        $endpoints = is_array($project->endpoints) ? $project->endpoints : [];
        $serviceLines = is_array($project->service_lines) ? $project->service_lines : [];

        return [
            $this->check(
                'website_admin_endpoints',
                '官网和后台入口',
                $this->filled($project->website_url) && $this->filled($project->geoflow_url) && $this->filled($endpoints['llms'] ?? null),
                '配置官网地址、GEOFlow后台地址和llms.txt入口，方便客户和AI都能定位系统。',
                12,
                true,
                route('admin.customer-projects.show', ['projectId' => $project->id])
            ),
            $this->check(
                'service_scope',
                '服务线和客户档案',
                count($serviceLines) > 0 && $this->filled($project->company_name),
                '确认客户公司、联系人和服务线，至少覆盖GEO优化、短视频运营或企业AI落地之一。',
                8,
                true,
                route('admin.customer-projects.show', ['projectId' => $project->id])
            ),
            $this->check(
                'cms_pages',
                '官网CMS页面',
                $this->count(TongzhuoCmsPage::class, 'tongzhuo_cms_pages', fn (Builder $query) => $query->where('status', 'published')) >= 8 || in_array('cms_pages', $readiness, true),
                '确认首页、关于我们、产品中心、行业资讯、问题地图、联系方式等页面可编辑并已发布。',
                10,
                true,
                route('admin.tongzhuo-cms.pages.index')
            ),
            $this->check(
                'ai_crawl_files',
                'AI抓取文件',
                in_array('ai_crawl_files', $readiness, true) || $this->filled($endpoints['llms'] ?? null),
                '检查robots.txt、sitemap.xml、feed.xml、llms.txt、llms-full.txt和结构化数据入口。',
                10,
                true,
                route('admin.tongzhuo-cms.dashboard')
            ),
            $this->check(
                'fact_base',
                '事实底座',
                $this->count(TongzhuoFactCard::class, 'tongzhuo_fact_cards', fn (Builder $query) => $query->where('status', 'confirmed')) >= 8,
                '沉淀企业实体、服务边界、案例、资质、禁用表达和来源，避免AI内容失真。',
                12,
                true,
                route('admin.fact-base.index')
            ),
            $this->check(
                'question_map',
                '问题地图',
                $this->count(TongzhuoGeoOpportunity::class, 'tongzhuo_geo_opportunities') >= 12,
                '建立问题簇、追问链路、查询重写、证据查询和对应页面/文章/FAQ。',
                10,
                false,
                route('admin.geo-opportunities.index')
            ),
            $this->check(
                'content_loop',
                '证据型内容',
                ($this->count(Article::class, 'articles', fn (Builder $query) => $query->where('status', 'published')) + $this->count(TongzhuoFaqItem::class, 'tongzhuo_faq_items', fn (Builder $query) => $query->where('status', 'published'))) >= 10,
                '至少准备一批可被AI引用的行业资讯和FAQ，内容要有事实、步骤、边界和更新时间。',
                10,
                false,
                route('admin.articles.index')
            ),
            $this->check(
                'publishing_loop',
                '分发发布闭环',
                $this->count(DistributionChannel::class, 'distribution_channels', fn (Builder $query) => $query->where('status', 'active')) > 0 && $this->count(ArticleDistribution::class, 'article_distributions') > 0,
                '确认文章发布后能进入分发队列，并由官网或本地发布助手回写结果。',
                10,
                false,
                route('admin.distribution.jobs')
            ),
            $this->check(
                'publisher_device',
                '发布执行器',
                $this->count(PublisherDevice::class, 'publisher_devices', fn (Builder $query) => $query->whereNull('disabled_at')) > 0 || in_array('publisher_flow', $readiness, true),
                '至少绑定一个客户授权的本地发布执行器，平台登录态不进入服务器。',
                6,
                false,
                route('admin.publisher-devices.index')
            ),
            $this->check(
                'ai_sampling',
                'AI采样基线',
                $this->count(TongzhuoGeoAnswerTest::class, 'tongzhuo_geo_answer_tests') >= 10,
                '对DeepSeek、豆包、千问、Kimi、ChatGPT等平台做同题采样，记录出现率、推荐率和引用。',
                8,
                false,
                route('admin.geo-answer-tests.index')
            ),
            $this->check(
                'lead_capture',
                '线索回收',
                $this->count(ContactLead::class, 'contact_leads') > 0 || in_array('lead_capture', $readiness, true),
                '确认官网表单可以直接进入后台线索管理，并能记录状态和跟进备注。',
                6,
                false,
                route('admin.contact-leads.index')
            ),
            $this->check(
                'acceptance_evidence',
                '验收证据',
                ($profile['acceptance_status'] ?? 'pending') === 'passed' && $this->filled($profile['evidence_url'] ?? null),
                '上线前归档验收链接、培训记录、版本号和客户确认信息。',
                8,
                true,
                route('admin.customer-projects.handoff', ['projectId' => $project->id])
            ),
            $this->check(
                'security_boundary',
                '安全边界',
                true,
                '后台不保存公开价格、第三方平台密码、Cookie、验证码状态、浏览器资料和客户API Token。',
                10,
                true,
                route('admin.customer-projects.show', ['projectId' => $project->id])
            ),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function check(string $key, string $label, bool $passed, string $nextAction, int $weight, bool $blocking, string $href): array
    {
        return compact('key', 'label', 'passed', 'nextAction', 'weight', 'blocking', 'href');
    }

    /**
     * @return list<array<string,mixed>>
     */
    private function nextActions(array $checks): array
    {
        return array_slice(array_values(array_filter($checks, fn (array $check): bool => ! (bool) ($check['passed'] ?? false))), 0, 5);
    }

    /**
     * customer_delivery_task_board_contract: owner deliverable acceptance_metric evidence_slot review_at
     *
     * @param list<array<string,mixed>> $checks
     * @return list<array<string,mixed>>
     */
    private function deliveryTasks(array $checks, TongzhuoCustomerProject $project): array
    {
        $blueprints = $this->taskBlueprints();
        $openChecks = array_values(array_filter($checks, fn (array $check): bool => ! (bool) ($check['passed'] ?? false)));

        return array_map(function (array $check) use ($blueprints, $project): array {
            $key = (string) ($check['key'] ?? '');
            $blueprint = $blueprints[$key] ?? $blueprints['default'];

            return [
                'key' => $key,
                'title' => (string) ($check['label'] ?? $blueprint['title']),
                'owner' => $blueprint['owner'],
                'deliverable' => $blueprint['deliverable'],
                'acceptance_metric' => $blueprint['acceptance_metric'],
                'evidence_slot' => $blueprint['evidence_slot'],
                'review_at' => $this->reviewDate($project, (int) $blueprint['days']),
                'blocking' => (bool) ($check['blocking'] ?? false),
                'href' => (string) ($check['href'] ?? '#'),
                'next_action' => (string) ($check['nextAction'] ?? ''),
            ];
        }, array_slice($openChecks, 0, 8));
    }

    /** @return array<string,array<string,string|int>> */
    private function taskBlueprints(): array
    {
        return [
            'website_admin_endpoints' => ['title' => '官网和后台入口', 'owner' => '实施/技术', 'deliverable' => '官网地址、后台地址、llms.txt 入口', 'acceptance_metric' => '客户和 AI 抓取入口均可访问', 'evidence_slot' => 'delivery_profile.evidence_url', 'days' => 1],
            'service_scope' => ['title' => '服务范围确认', 'owner' => '销售/客户成功', 'deliverable' => '客户档案、服务线和联系人信息', 'acceptance_metric' => '服务范围已确认并可用于交付报告', 'evidence_slot' => 'customer_project.basic_profile', 'days' => 1],
            'cms_pages' => ['title' => '官网 CMS 页面', 'owner' => '官网运营', 'deliverable' => '核心页面发布并可编辑', 'acceptance_metric' => '不少于 8 个核心页面已发布', 'evidence_slot' => 'cms_page_publish_log', 'days' => 3],
            'ai_crawl_files' => ['title' => 'AI 抓取文件', 'owner' => '技术/GEO运营', 'deliverable' => 'robots、sitemap、feed、llms 和 Schema', 'acceptance_metric' => '公开入口可访问且内容不含敏感信息', 'evidence_slot' => 'ai_crawl_check_record', 'days' => 3],
            'fact_base' => ['title' => '事实底座', 'owner' => 'GEO运营', 'deliverable' => '已确认事实卡、来源和禁用表达', 'acceptance_metric' => '至少 8 条已确认事实可被文章/FAQ 调用', 'evidence_slot' => 'fact_base_snapshot', 'days' => 5],
            'question_map' => ['title' => '问题地图', 'owner' => 'GEO运营', 'deliverable' => '问题簇、追问链路、查询重写和覆盖状态', 'acceptance_metric' => '至少 12 个问题机会进入内容任务池', 'evidence_slot' => 'question_map_snapshot', 'days' => 7],
            'content_loop' => ['title' => '证据型内容', 'owner' => '内容运营', 'deliverable' => '行业资讯、FAQ、证据页和更新时间', 'acceptance_metric' => '至少 10 个公开内容资产已发布', 'evidence_slot' => 'content_quality_record', 'days' => 10],
            'publishing_loop' => ['title' => '分发发布闭环', 'owner' => '发布运营', 'deliverable' => '渠道、队列、发布助手和结果回写', 'acceptance_metric' => '至少 1 个分发任务有明确结果', 'evidence_slot' => 'distribution_job_record', 'days' => 12],
            'publisher_device' => ['title' => '发布执行器', 'owner' => '发布运营/客户侧', 'deliverable' => '客户授权的本地发布执行器', 'acceptance_metric' => '设备已绑定且能领取任务或返回人工处理状态', 'evidence_slot' => 'publisher_device_record', 'days' => 12],
            'ai_sampling' => ['title' => 'AI 采样基线', 'owner' => 'GEO运营', 'deliverable' => '多平台同题采样记录', 'acceptance_metric' => '至少 10 条采样记录含出现率、推荐率、引用和竞品', 'evidence_slot' => 'ai_sampling_run', 'days' => 15],
            'lead_capture' => ['title' => '线索回收', 'owner' => '客户成功/销售', 'deliverable' => '官网表单和线索跟进记录', 'acceptance_metric' => '测试线索可进入后台并被标记状态', 'evidence_slot' => 'lead_capture_record', 'days' => 15],
            'acceptance_evidence' => ['title' => '验收证据', 'owner' => '项目负责人', 'deliverable' => '验收链接、培训记录、版本号和客户确认', 'acceptance_metric' => '验收状态为已通过且证据链接已归档', 'evidence_slot' => 'delivery_profile.evidence_url', 'days' => 20],
            'security_boundary' => ['title' => '安全边界', 'owner' => '技术负责人', 'deliverable' => '敏感信息排除和交付包扫描记录', 'acceptance_metric' => '交付包不含价格、密钥、Cookie、浏览器资料和运行日志', 'evidence_slot' => 'secret_scan_report', 'days' => 1],
            'default' => ['title' => '交付补齐项', 'owner' => '项目负责人', 'deliverable' => '补齐对应模块并归档证据', 'acceptance_metric' => '检查项通过并可在交付报告中复核', 'evidence_slot' => 'delivery_profile.review_notes', 'days' => 7],
        ];
    }

    private function reviewDate(TongzhuoCustomerProject $project, int $days): string
    {
        $base = $project->go_live_at ?: now();

        return $base->copy()->addDays($days)->format('Y-m-d');
    }

    private function filled(mixed $value): bool
    {
        return trim((string) $value) !== '';
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
}
