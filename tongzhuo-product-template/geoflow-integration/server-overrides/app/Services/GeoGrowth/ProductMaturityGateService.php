<?php

namespace App\Services\GeoGrowth;

class ProductMaturityGateService
{
    /**
     * product_maturity_gate_contract: reusable_delivery_gate sales_ready implementation_ready operations_ready evidence_ready security_ready
     *
     * @param array<string,int|float> $stats
     * @return array<string,mixed>
     */
    public function evaluate(array $stats): array
    {
        $gates = $this->gates($stats);
        $passedWeight = array_sum(array_map(fn (array $gate): int => ($gate['passed'] ?? false) ? (int) $gate['weight'] : 0, $gates));
        $totalWeight = max(1, array_sum(array_map(fn (array $gate): int => (int) $gate['weight'], $gates)));
        $score = (int) round(($passedWeight * 100) / $totalWeight);

        return [
            'score' => $score,
            'status' => $score >= 85 ? 'sales_ready' : ($score >= 65 ? 'implementation_ready' : 'build_required'),
            'gates' => $gates,
            'passed_count' => count(array_filter($gates, fn (array $gate): bool => (bool) ($gate['passed'] ?? false))),
            'total_count' => count($gates),
            'critical_gaps' => array_values(array_filter($gates, fn (array $gate): bool => ! (bool) ($gate['passed'] ?? false) && (bool) ($gate['critical'] ?? false))),
            'recommended_sequence' => array_slice(array_values(array_filter($gates, fn (array $gate): bool => ! (bool) ($gate['passed'] ?? false))), 0, 4),
        ];
    }

    /**
     * @param array<string,int|float> $stats
     * @return list<array<string,mixed>>
     */
    private function gates(array $stats): array
    {
        return [
            $this->gate(
                'website_cms_ready',
                '官网 CMS 可编辑',
                (int) ($stats['cms_pages_published'] ?? 0) >= 8,
                '至少完成首页、关于、产品、案例、行业资讯、FAQ、联系方式等核心页面，并可在后台编辑。',
                route('admin.tongzhuo-cms.pages.index'),
                14,
                true
            ),
            $this->gate(
                'ai_crawl_ready',
                'AI 抓取入口完整',
                (int) ($stats['cms_pages_published'] ?? 0) >= 8 && (int) ($stats['faqs_published'] ?? 0) > 0,
                '公开站点要保留 robots、sitemap、feed、llms、Schema 和可读取的 FAQ/行业资讯。',
                route('admin.tongzhuo-cms.dashboard'),
                12,
                true
            ),
            $this->gate(
                'fact_base_ready',
                '事实底座可用',
                (int) ($stats['confirmed_facts'] ?? 0) >= 8,
                '企业实体、服务边界、案例、资质、禁用表达和来源要先确认，内容生成不能凭空写。',
                route('admin.fact-base.index'),
                14,
                true
            ),
            $this->gate(
                'question_map_ready',
                '问题地图成型',
                (float) ($stats['opportunity_coverage'] ?? 0) >= 70,
                '问题簇、追问链路、查询重写和对应文章/FAQ/页面要能形成运营任务。',
                route('admin.geo-opportunities.index'),
                12,
                false
            ),
            $this->gate(
                'evidence_content_ready',
                '证据型内容足量',
                (float) ($stats['content_readiness'] ?? 0) >= 70,
                '行业资讯和 FAQ 要能回答真实问题，包含事实、步骤、边界、更新时间和可引用结构。',
                route('admin.articles.index'),
                12,
                false
            ),
            $this->gate(
                'publisher_loop_ready',
                '发布分发闭环',
                (int) ($stats['channels_active'] ?? 0) > 0 && ((int) ($stats['devices_online'] ?? 0) > 0 || (int) ($stats['distribution_synced'] ?? 0) > 0),
                '服务器只管理任务和结果，第三方平台登录状态留在本地执行器，并能回写成功、失败、草稿或人工确认。',
                route('admin.distribution.jobs'),
                12,
                false
            ),
            $this->gate(
                'ai_sampling_ready',
                'AI 采样有基线',
                (int) ($stats['answer_tests'] ?? 0) >= 10,
                '至少完成一轮多平台同题采样，记录出现率、推荐率、排名、引用和竞品提及。',
                route('admin.geo-answer-tests.index'),
                10,
                false
            ),
            $this->gate(
                'lead_attribution_ready',
                '线索归因可复盘',
                (int) ($stats['leads_total'] ?? 0) > 0 || (int) ($stats['customer_projects'] ?? 0) > 0,
                '官网表单、客户线索、客户项目和数据复盘要能连起来，证明增长闭环不是只发内容。',
                route('admin.contact-leads.index'),
                8,
                false
            ),
            $this->gate(
                'security_boundary_ready',
                '安全边界明确',
                true,
                '产品包不得包含客户密钥、平台密码、Cookie、浏览器资料、运行日志和公开价格。',
                route('admin.customer-projects.index'),
                6,
                true
            ),
        ];
    }

    /** @return array<string,mixed> */
    private function gate(string $key, string $title, bool $passed, string $action, string $href, int $weight, bool $critical): array
    {
        return compact('key', 'title', 'passed', 'action', 'href', 'weight', 'critical');
    }
}
