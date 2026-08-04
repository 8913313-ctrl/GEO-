<?php

namespace App\Services\GeoGrowth;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class RemoteGeoRankEngineClient implements GeoEngineClient
{
    public function auditWebsite(string $url): array
    {
        $payload = $this->post((string) config('geoflow.geo_engine.audit_path', '/api/geo/audits'), [
            'url' => $url,
            'source' => 'tongzhuo_geoflow',
        ]);

        return [
            'engine' => 'georank',
            'findings' => $this->normalizeFindings(Arr::get($payload, 'data.findings', Arr::get($payload, 'findings', []))),
            'summary' => Arr::get($payload, 'data.summary', Arr::get($payload, 'summary', [])),
            'score' => Arr::get($payload, 'data.score', Arr::get($payload, 'score')),
            'raw' => $payload,
        ];
    }

    public function runAnswerTest(string $question, array $context = []): array
    {
        $payload = $this->post((string) config('geoflow.geo_engine.answer_test_path', '/api/geo/answer-tests'), [
            'question' => $question,
            'context' => $context,
            'source' => 'tongzhuo_geoflow',
        ]);
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;

        return [
            'engine' => 'georank',
            'verdict' => $this->normalizeVerdict((string) Arr::get($data, 'verdict', 'unknown')),
            'observed_answer' => (string) Arr::get($data, 'observed_answer', Arr::get($data, 'answer', '')),
            'gap_summary' => (string) Arr::get($data, 'gap_summary', Arr::get($data, 'recommendation', '')),
            'evidence_sources' => $this->normalizeEvidence(Arr::get($data, 'evidence_sources', Arr::get($data, 'evidence', []))),
            'raw' => $payload,
        ];
    }

    public function expandOpportunities(array $context = []): array
    {
        $payload = $this->post((string) config('geoflow.geo_engine.opportunities_path', '/api/geo/opportunities'), [
            'context' => $context,
            'source' => 'tongzhuo_geoflow',
        ]);

        return [
            'engine' => 'georank',
            'opportunities' => $this->normalizeOpportunities(Arr::get($payload, 'data.opportunities', Arr::get($payload, 'opportunities', []))),
            'raw' => $payload,
        ];
    }

    public function generateActionPlan(array $context = []): array
    {
        $payload = $this->post((string) config('geoflow.geo_engine.plan_path', '/api/geo/action-plans'), [
            'context' => $context,
            'source' => 'tongzhuo_geoflow',
        ]);
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;

        return [
            'engine' => 'georank',
            'title' => (string) Arr::get($data, 'title', ''),
            'summary' => (string) Arr::get($data, 'summary', ''),
            'metrics' => is_array(Arr::get($data, 'metrics')) ? Arr::get($data, 'metrics') : [],
            'items' => $this->normalizePlanItems(Arr::get($data, 'items', [])),
            'raw' => $payload,
        ];
    }

    /** @param array<string,mixed> $body */
    private function post(string $path, array $body): array
    {
        $baseUrl = rtrim((string) config('geoflow.geo_engine.base_url', ''), '/');
        if ($baseUrl === '') {
            throw new RuntimeException('GEORank 引擎地址未配置。');
        }

        $request = Http::timeout((int) config('geoflow.geo_engine.timeout_seconds', 60))
            ->acceptJson()
            ->asJson();

        $apiKey = (string) config('geoflow.geo_engine.api_key', '');
        if ($apiKey !== '') {
            $request = $request->withToken($apiKey);
        }

        $response = $request->post($baseUrl.'/'.ltrim($path, '/'), $body);
        if (! $response->successful()) {
            throw new RuntimeException('GEORank 引擎返回异常：HTTP '.$response->status());
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new RuntimeException('GEORank 引擎返回格式不可识别。');
        }

        return $payload;
    }

    /**
     * @param mixed $items
     * @return array<int,array<string,mixed>>
     */
    private function normalizeFindings(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        $findings = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $findings[] = [
                'key' => (string) ($item['key'] ?? $item['code'] ?? 'georank'),
                'area' => (string) ($item['area'] ?? $item['category'] ?? 'ai_visibility'),
                'severity' => $this->normalizeSeverity((string) ($item['severity'] ?? $item['level'] ?? 'warning')),
                'status' => 'open',
                'title' => (string) ($item['title'] ?? $item['name'] ?? 'GEO可见性建议'),
                'description' => (string) ($item['description'] ?? $item['detail'] ?? ''),
                'suggestion' => (string) ($item['suggestion'] ?? $item['recommendation'] ?? ''),
                'evidence' => is_array($item['evidence'] ?? null) ? $item['evidence'] : ['raw' => $item],
            ];
        }

        return $findings;
    }

    private function normalizeSeverity(string $severity): string
    {
        return match (strtolower($severity)) {
            'critical', 'high', '严重', '高' => 'critical',
            'info', 'low', '提示', '低' => 'info',
            default => 'warning',
        };
    }

    private function normalizeVerdict(string $verdict): string
    {
        return match (strtolower($verdict)) {
            'covered', 'pass', 'ok', '已覆盖' => 'covered',
            'gap', 'missing', 'fail', '缺口' => 'gap',
            default => 'unknown',
        };
    }

    /**
     * @param mixed $items
     * @return array<int,array<string,mixed>>
     */
    private function normalizeEvidence(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        return collect($items)
            ->filter('is_array')
            ->map(fn (array $item): array => [
                'type' => (string) ($item['type'] ?? 'source'),
                'title' => (string) ($item['title'] ?? $item['name'] ?? ''),
                'url' => (string) ($item['url'] ?? ''),
                'excerpt' => (string) ($item['excerpt'] ?? $item['summary'] ?? ''),
            ])
            ->values()
            ->all();
    }

    /**
     * @param mixed $items
     * @return array<int,array<string,mixed>>
     */
    private function normalizeOpportunities(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        return collect($items)
            ->filter('is_array')
            ->map(fn (array $item): array => [
                'service_line' => (string) ($item['service_line'] ?? 'geo'),
                'intent' => (string) ($item['intent'] ?? 'question'),
                'priority' => (string) ($item['priority'] ?? 'medium'),
                'keyword' => (string) ($item['keyword'] ?? ''),
                'question' => (string) ($item['question'] ?? $item['title'] ?? ''),
                'recommended_output' => (string) ($item['recommended_output'] ?? 'article'),
                'answer_angle' => (string) ($item['answer_angle'] ?? $item['suggestion'] ?? ''),
            ])
            ->filter(fn (array $item): bool => $item['question'] !== '')
            ->values()
            ->all();
    }

    /**
     * @param mixed $items
     * @return array<int,array<string,mixed>>
     */
    private function normalizePlanItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        return collect($items)
            ->filter('is_array')
            ->map(fn (array $item): array => [
                'phase' => (string) ($item['phase'] ?? 'day_1_30'),
                'workstream' => (string) ($item['workstream'] ?? 'content'),
                'status' => 'todo',
                'priority' => (string) ($item['priority'] ?? 'medium'),
                'title' => (string) ($item['title'] ?? ''),
                'description' => (string) ($item['description'] ?? ''),
                'expected_output' => (string) ($item['expected_output'] ?? 'GEO运营资产'),
                'evidence' => is_array($item['evidence'] ?? null) ? $item['evidence'] : ['source' => 'georank'],
            ])
            ->filter(fn (array $item): bool => $item['title'] !== '')
            ->values()
            ->all();
    }
}
