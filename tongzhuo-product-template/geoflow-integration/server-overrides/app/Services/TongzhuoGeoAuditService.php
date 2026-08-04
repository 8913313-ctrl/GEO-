<?php

namespace App\Services;

use App\Models\TongzhuoGeoAudit;
use App\Services\GeoGrowth\GeoEngineManager;
use Illuminate\Support\Facades\DB;

class TongzhuoGeoAuditService
{
    public function __construct(private readonly GeoEngineManager $engines) {}

    public function run(TongzhuoGeoAudit $audit): TongzhuoGeoAudit
    {
        $audit->update(['status' => 'running', 'started_at' => now(), 'error_message' => null]);

        try {
            $engineResult = $this->engines->auditWebsite($audit->url);
            $findings = array_values(array_filter($engineResult['findings'] ?? [], 'is_array'));
            $score = isset($engineResult['score']) && is_numeric($engineResult['score'])
                ? max(0, min(100, (int) $engineResult['score']))
                : $this->score($findings);
            $summary = $this->summary($findings, $engineResult);

            DB::transaction(function () use ($audit, $findings, $score, $summary): void {
                $audit->tasks()->delete();
                $audit->findings()->delete();

                foreach ($findings as $finding) {
                    $record = $audit->findings()->create($this->normalizeFinding($finding));
                    if (in_array($record->severity, ['critical', 'warning'], true)) {
                        $audit->tasks()->create([
                            'site_id' => $audit->site_id,
                            'finding_id' => $record->id,
                            'type' => $this->taskType((string) $record->key),
                            'priority' => $record->severity === 'critical' ? 'high' : 'medium',
                            'status' => 'todo',
                            'title' => $record->title,
                            'description' => $record->suggestion,
                            'content_brief' => $this->contentBrief($record->key, $record->area),
                        ]);
                    }
                }

                $audit->update([
                    'status' => 'completed',
                    'score' => $score,
                    'summary' => $summary,
                    'completed_at' => now(),
                ]);
            });
        } catch (\Throwable $exception) {
            $audit->update([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'completed_at' => now(),
            ]);
        }

        return $audit->fresh(['findings', 'tasks']);
    }

    /** @param array<int,array<string,mixed>> $findings */
    private function score(array $findings): int
    {
        $penalty = collect($findings)->sum(fn (array $finding): int => match ($finding['severity'] ?? 'info') {
            'critical' => 25,
            'warning' => 12,
            default => 5,
        });

        return max(0, min(100, 100 - $penalty));
    }

    /**
     * @param array<int,array<string,mixed>> $findings
     * @param array<string,mixed> $engineResult
     * @return array<string,mixed>
     */
    private function summary(array $findings, array $engineResult): array
    {
        return array_merge(is_array($engineResult['summary'] ?? null) ? $engineResult['summary'] : [], [
            'engine' => (string) ($engineResult['engine'] ?? 'local'),
            'total' => count($findings),
            'critical' => collect($findings)->where('severity', 'critical')->count(),
            'warning' => collect($findings)->where('severity', 'warning')->count(),
            'info' => collect($findings)->where('severity', 'info')->count(),
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    /** @param array<string,mixed> $finding */
    private function normalizeFinding(array $finding): array
    {
        return [
            'key' => (string) ($finding['key'] ?? 'geo'),
            'area' => (string) ($finding['area'] ?? 'ai_visibility'),
            'severity' => in_array($finding['severity'] ?? '', ['critical', 'warning', 'info'], true) ? $finding['severity'] : 'warning',
            'title' => (string) ($finding['title'] ?? 'GEO优化建议'),
            'description' => (string) ($finding['description'] ?? ''),
            'suggestion' => (string) ($finding['suggestion'] ?? ''),
            'evidence' => is_array($finding['evidence'] ?? null) ? $finding['evidence'] : [],
            'status' => 'open',
        ];
    }

    private function taskType(string $key): string
    {
        return match ($key) {
            'title', 'description', 'h1' => 'content_fix',
            'schema', 'canonical', 'robots', 'sitemap', 'llms' => 'technical_fix',
            default => 'geo_opportunity',
        };
    }

    /** @return array<string,mixed> */
    private function contentBrief(string $findingKey, string $area): array
    {
        return [
            'source' => 'website_audit',
            'finding_key' => $findingKey,
            'area' => $area,
            'suggested_output' => in_array($findingKey, ['title', 'description', 'h1'], true) ? '官网页面优化' : 'GEO内容或技术优化',
        ];
    }
}
