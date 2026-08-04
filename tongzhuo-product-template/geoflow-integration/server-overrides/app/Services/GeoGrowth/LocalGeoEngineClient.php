<?php

namespace App\Services\GeoGrowth;

use Illuminate\Support\Facades\Http;

class LocalGeoEngineClient implements GeoEngineClient
{
    public function auditWebsite(string $url): array
    {
        $response = Http::timeout(12)
            ->connectTimeout(5)
            ->withHeaders(['User-Agent' => 'Tongzhuo-GEO-Audit/1.0'])
            ->get($url);

        $findings = [];
        $html = $response->successful() ? (string) $response->body() : '';
        $this->checkHttp($findings, $response->status(), $url);

        if ($html !== '') {
            $this->checkHtml($findings, $html);
        }

        $crawlRoot = $this->normalizeCrawlRoot($url);
        $this->checkResource($findings, $crawlRoot.'/robots.txt', 'robots', 'AI与搜索爬虫规则文件', '建议提供 robots.txt，并明确允许公开内容被正常抓取。', 'info');
        $this->checkResource($findings, $crawlRoot.'/sitemap.xml', 'sitemap', '站点地图', '建议提供可访问的 sitemap.xml，帮助搜索引擎发现官网内容。', 'info');
        $this->checkResource($findings, $crawlRoot.'/llms.txt', 'llms', 'AI说明文件', '建议提供 llms.txt，集中说明企业实体、服务边界与可信内容入口。', 'info');

        return [
            'engine' => 'local',
            'findings' => $findings,
            'summary' => [
                'checked_at' => now()->toIso8601String(),
                'html_bytes' => strlen($html),
                'http_status' => $response->status(),
            ],
        ];
    }

    public function runAnswerTest(string $question, array $context = []): array
    {
        $evidence = array_values(array_filter($context['evidence_sources'] ?? [], 'is_array'));
        $hasEvidence = count($evidence) > 0;
        $expectedAnswer = trim((string) ($context['expected_answer'] ?? ''));

        $lines = $hasEvidence
            ? ['本地内容覆盖检测找到以下官网依据，可作为AI回答的可信来源：']
            : ['本地内容覆盖检测没有在已发布文章和FAQ中找到可直接支撑该问题的依据。'];

        foreach (array_slice($evidence, 0, 6) as $item) {
            $type = ($item['type'] ?? '') === 'faq' ? 'FAQ' : '文章';
            $lines[] = '- '.$type.'：'.(string) ($item['title'] ?? '').'。'.(string) ($item['excerpt'] ?? '');
        }

        if ($expectedAnswer !== '') {
            $lines[] = '期望回答方向：'.$expectedAnswer;
        }

        return [
            'engine' => 'local',
            'verdict' => $hasEvidence ? 'covered' : 'gap',
            'observed_answer' => implode("\n", $lines),
            'gap_summary' => $hasEvidence
                ? '官网已有可引用内容，但仍建议检查答案是否覆盖服务边界、案例和下一步行动。'
                : '官网当前没有找到足够的文章或FAQ依据，建议把该问题转为问题机会并补充内容资产。',
            'evidence_sources' => $evidence,
        ];
    }

    public function expandOpportunities(array $context = []): array
    {
        $serviceLine = (string) ($context['service_line'] ?? 'geo');
        $companyName = (string) ($context['company_name'] ?? '企业');

        return [
            'engine' => 'local',
            'opportunities' => [
                [
                    'service_line' => $serviceLine,
                    'intent' => 'vendor',
                    'priority' => 'high',
                    'keyword' => 'GEO优化服务商',
                    'question' => $companyName.'选择GEO优化服务商时应该重点看哪些能力？',
                    'recommended_output' => 'article',
                    'answer_angle' => '围绕AI可读官网、问题地图、行业资讯、结构化数据、分发闭环和线索复盘建立判断标准。',
                ],
                [
                    'service_line' => $serviceLine,
                    'intent' => 'howto',
                    'priority' => 'medium',
                    'keyword' => 'AI搜索可见性',
                    'question' => $companyName.'官网如何提升被AI搜索理解和推荐的概率？',
                    'recommended_output' => 'faq',
                    'answer_angle' => '回答应覆盖企业实体、服务页、案例证据、FAQ、sitemap、RSS、llms.txt 和 JSON-LD。',
                ],
            ],
        ];
    }

    public function generateActionPlan(array $context = []): array
    {
        $startDate = (string) ($context['start_date'] ?? now()->toDateString());

        return [
            'engine' => 'local',
            'title' => 'GEO 90天行动方案 - '.$startDate,
            'summary' => '根据当前网站诊断任务、问题机会和内容资产生成的90天GEO运营计划。',
            'metrics' => [
                'target_articles' => 12,
                'target_faqs' => 18,
                'target_distribution_jobs' => 24,
                'review_cycle_days' => 14,
            ],
            'items' => [],
        ];
    }

    /** @param array<int, array<string, mixed>> $findings */
    private function checkHttp(array &$findings, int $status, string $url): void
    {
        if ($status >= 200 && $status < 400) {
            return;
        }

        $findings[] = $this->finding('http', 'technical', 'critical', '官网无法正常访问', "访问 {$url} 返回 HTTP {$status}。", '先确保官网首页可以从公网稳定访问，再进行内容和AI可读性优化。', ['http_status' => $status]);
    }

    private function normalizeCrawlRoot(string $url): string
    {
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return rtrim($url, '/');
        }

        $root = strtolower((string) $parts['scheme']).'://'.$parts['host'];
        if (! empty($parts['port'])) {
            $root .= ':'.$parts['port'];
        }

        return rtrim($root, '/');
    }

    /** @param array<int, array<string, mixed>> $findings */
    private function checkHtml(array &$findings, string $html): void
    {
        $title = '';
        if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $matches)) {
            $title = trim(preg_replace('/\s+/u', ' ', strip_tags($matches[1])) ?: '');
        }
        if ($title === '') {
            $findings[] = $this->finding('title', 'content', 'warning', '缺少页面标题', '首页没有读取到有效的 title。', '为首页设置包含品牌名、核心服务和服务地区的清晰标题。');
        }

        $description = preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']/is', $html, $matches) ? trim($matches[1]) : '';
        if ($description === '') {
            $findings[] = $this->finding('description', 'content', 'warning', '缺少页面摘要', '首页没有读取到 meta description。', '补充一段能够直接说明企业服务、客户对象和地区的页面摘要。');
        }

        preg_match_all('/<h1\b[^>]*>/i', $html, $h1Matches);
        $h1Count = count($h1Matches[0]);
        if ($h1Count !== 1) {
            $findings[] = $this->finding('h1', 'content', 'warning', 'H1层级不清晰', "页面检测到 {$h1Count} 个 H1，建议保持一个明确的页面主标题。", '为页面保留唯一H1，并让H2承接服务、案例或问题分类。', ['h1_count' => $h1Count]);
        }

        if (! preg_match('/application\/ld\+json/i', $html)) {
            $findings[] = $this->finding('schema', 'technical', 'warning', '未发现结构化数据', '页面没有检测到 JSON-LD 结构化数据。', '至少补充 Organization、WebSite、Service、Article 或 FAQPage 中适用的结构化数据。');
        }
        if (! preg_match('/<link[^>]+rel=["\']canonical["\']/i', $html)) {
            $findings[] = $this->finding('canonical', 'technical', 'info', '未发现Canonical', '页面没有检测到规范链接。', '为可索引页面设置唯一 canonical，避免重复地址分散收录信号。');
        }
    }

    /** @param array<int, array<string, mixed>> $findings */
    private function checkResource(array &$findings, string $url, string $key, string $title, string $suggestion, string $severity): void
    {
        try {
            $response = Http::timeout(6)->connectTimeout(3)->withHeaders(['User-Agent' => 'Tongzhuo-GEO-Audit/1.0'])->get($url);
            if ($response->successful()) {
                return;
            }
        } catch (\Throwable) {
            // Missing optional crawl resources are reported below.
        }

        $findings[] = $this->finding($key, 'crawl', $severity, $title.'不可访问', "没有读取到 {$url}。", $suggestion);
    }

    /** @return array<string, mixed> */
    private function finding(string $key, string $area, string $severity, string $title, string $description, string $suggestion, array $evidence = []): array
    {
        return compact('key', 'area', 'severity', 'title', 'description', 'suggestion', 'evidence') + ['status' => 'open'];
    }
}
