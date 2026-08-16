<?php

namespace App\Services\Publishing;

use App\Models\ArticleDistribution;
use App\Models\PublisherPlatformJob;

/**
 * Aggregates selector hit/miss telemetry retained in V1/V2 job results.
 *
 * No new table is required: V2 stores the result JSON on
 * publisher_platform_jobs and V1 stores platform_results in remote_meta.
 * Query failures are treated as an empty sample set so the admin page stays
 * usable while an installation is being migrated.
 */
class PublisherSelectorHealthService
{
    /** @return array<string,mixed> */
    public function summary(?int $lookbackDays = null): array
    {
        $days = max(1, min(90, (int) ($lookbackDays ?? config('publishing.selector_health_lookback_days', 7))));
        $minimum = max(1, (int) config('publishing.selector_health_min_samples', 5));
        $alertRate = max(0.01, min(1, (float) config('publishing.selector_health_alert_rate', 0.8)));
        $cutoff = now()->subDays($days);
        $buckets = [];

        $this->collectV2($buckets, $cutoff);
        $this->collectV1($buckets, $cutoff);

        $rows = [];
        foreach ($buckets as $bucket) {
            $attemptedSamples = $bucket['hits'] + $bucket['misses'];
            $hitRate = $attemptedSamples > 0 ? $bucket['hits'] / $attemptedSamples : null;
            $state = $attemptedSamples < $minimum
                ? 'insufficient_data'
                : ($hitRate < $alertRate ? 'attention' : 'healthy');
            $rows[] = [
                'platform_id' => $bucket['platform_id'],
                'step' => $bucket['step'],
                'adapters' => array_values(array_unique($bucket['adapters'])),
                'samples' => $attemptedSamples,
                'hits' => $bucket['hits'],
                'misses' => $bucket['misses'],
                'not_attempted' => $bucket['not_attempted'],
                'hit_rate' => $hitRate,
                'average_attempted' => $attemptedSamples > 0 ? round($bucket['attempted_total'] / $attemptedSamples, 2) : null,
                'average_fallbacks' => $attemptedSamples > 0 ? round($bucket['fallback_total'] / $attemptedSamples, 2) : null,
                'last_seen_at' => $bucket['last_seen_at'],
                'state' => $state,
            ];
        }

        usort($rows, static function (array $left, array $right): int {
            $stateOrder = ['attention' => 0, 'insufficient_data' => 1, 'healthy' => 2];
            return ($stateOrder[$left['state']] ?? 9) <=> ($stateOrder[$right['state']] ?? 9)
                ?: strcmp($left['platform_id'].$left['step'], $right['platform_id'].$right['step']);
        });

        return [
            'lookback_days' => $days,
            'minimum_samples' => $minimum,
            'alert_rate' => $alertRate,
            'rows' => $rows,
            'alerts' => array_values(array_filter($rows, static fn (array $row): bool => $row['state'] === 'attention')),
            'sample_count' => array_sum(array_column($rows, 'samples')),
        ];
    }

    /** @param array<string,array<string,mixed>> $buckets */
    private function collectV2(array &$buckets, $cutoff): void
    {
        try {
            $jobs = PublisherPlatformJob::query()
                ->where('updated_at', '>=', $cutoff)
                ->whereNotNull('result')
                ->orderByDesc('updated_at')
                ->limit(5000)
                ->get(['platform_id', 'result', 'updated_at']);
        } catch (\Throwable) {
            return;
        }

        foreach ($jobs as $job) {
            $result = is_array($job->result) ? $job->result : [];
            $this->addTelemetry($buckets, $result, (string) $job->platform_id, $job->updated_at?->toIso8601String());
        }
    }

    /** @param array<string,array<string,mixed>> $buckets */
    private function collectV1(array &$buckets, $cutoff): void
    {
        try {
            $distributions = ArticleDistribution::query()
                ->where('updated_at', '>=', $cutoff)
                ->whereNotNull('remote_meta')
                // V2 summaries are mirrored into remote_meta; aggregate them from
                // publisher_platform_jobs only so each telemetry sample is counted once.
                ->whereDoesntHave('publisherPlatformJobs')
                ->orderByDesc('updated_at')
                ->limit(2000)
                ->get(['remote_meta', 'updated_at']);
        } catch (\Throwable) {
            return;
        }

        foreach ($distributions as $distribution) {
            foreach ($distribution->publisherPlatformResults() as $platformId => $result) {
                $this->addTelemetry($buckets, is_array($result) ? $result : [], (string) $platformId, $distribution->updated_at?->toIso8601String());
            }
        }
    }

    /** @param array<string,array<string,mixed>> $buckets */
    private function addTelemetry(array &$buckets, array $result, string $fallbackPlatform, ?string $seenAt): void
    {
        $telemetry = $result['selector_telemetry'] ?? $result['selectorTelemetry'] ?? null;
        if (! is_array($telemetry)) return;
        $platformId = trim((string) ($telemetry['platform_id'] ?? $result['platform_id'] ?? $result['platform'] ?? $fallbackPlatform));
        if ($platformId === '') return;
        $adapter = trim((string) ($telemetry['adapter'] ?? $result['adapter'] ?? 'unknown'));
        $steps = is_array($telemetry['steps'] ?? null) ? $telemetry['steps'] : [];

        foreach ($steps as $stepName => $step) {
            if (! is_array($step)) continue;
            $stepName = trim((string) $stepName);
            if ($stepName === '') continue;
            $key = $platformId.'|'.$stepName;
            if (! isset($buckets[$key])) {
                $buckets[$key] = [
                    'platform_id' => $platformId,
                    'step' => $stepName,
                    'adapters' => [],
                    'hits' => 0,
                    'misses' => 0,
                    'not_attempted' => 0,
                    'attempted_total' => 0,
                    'fallback_total' => 0,
                    'last_seen_at' => null,
                ];
            }
            if ($adapter !== '') $buckets[$key]['adapters'][] = $adapter;
            $status = strtolower(trim((string) ($step['status'] ?? 'not_attempted')));
            if ($status === 'hit') $buckets[$key]['hits']++;
            elseif ($status === 'miss') $buckets[$key]['misses']++;
            else $buckets[$key]['not_attempted']++;

            $attempted = max(0, (int) ($step['attempted'] ?? 0));
            $candidateIndex = max(-1, (int) ($step['candidate_index'] ?? -1));
            if ($status === 'hit' || $status === 'miss') {
                $buckets[$key]['attempted_total'] += $attempted;
                $buckets[$key]['fallback_total'] += max(0, $candidateIndex);
            }
            if ($seenAt && (! $buckets[$key]['last_seen_at'] || $seenAt > $buckets[$key]['last_seen_at'])) {
                $buckets[$key]['last_seen_at'] = $seenAt;
            }
        }
    }
}
