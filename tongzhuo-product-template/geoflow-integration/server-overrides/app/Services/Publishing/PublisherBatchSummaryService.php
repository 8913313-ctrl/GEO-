<?php

namespace App\Services\Publishing;

use App\Models\ArticleDistribution;
use App\Models\PublisherPlatformJob;
use Illuminate\Support\Facades\DB;

class PublisherBatchSummaryService
{
    /**
     * Rebuilds the V1-compatible result fields after any V2 platform job changes.
     *
     * @return array<string,mixed>
     */
    public function refresh(ArticleDistribution $distribution): array
    {
        return DB::transaction(function () use ($distribution): array {
            $distribution = ArticleDistribution::query()->whereKey($distribution->id)->lockForUpdate()->firstOrFail();
            $jobs = $distribution->publisherPlatformJobs()
                ->lockForUpdate()
                ->orderBy('id')
                ->get();

            $platformResults = [];
            $stateCounts = [];
            foreach ($jobs as $job) {
                $status = (string) $job->status;
                $stateCounts[$status] = ($stateCounts[$status] ?? 0) + 1;
                $platformResults[(string) $job->platform_id] = $this->platformResult($job);
            }

            $summary = [
                'total' => $jobs->count(),
                'state_counts' => $stateCounts,
                'published' => (int) ($stateCounts['published'] ?? 0),
                'draft_saved' => (int) ($stateCounts['draft_saved'] ?? 0),
                'awaiting_confirmation' => (int) ($stateCounts['awaiting_confirmation'] ?? 0),
                'failed' => (int) ($stateCounts['failed'] ?? 0),
                'cancelled' => (int) ($stateCounts['cancelled'] ?? 0),
                'skipped' => (int) ($stateCounts['skipped'] ?? 0),
                'active' => $jobs->filter(fn (PublisherPlatformJob $job): bool => ! $job->isTerminal())->count(),
            ];
            $state = $this->batchState($summary, $stateCounts);
            $nextAction = $this->nextOperatorAction($jobs);
            $completedAt = $summary['active'] === 0
                ? ($distribution->completed_at ?? now())
                : null;

            $meta = is_array($distribution->remote_meta) ? $distribution->remote_meta : [];
            $existingAssistant = is_array($meta['publisher_assistant'] ?? null) ? $meta['publisher_assistant'] : [];
            $meta['publisher_assistant'] = array_replace($existingAssistant, [
                'protocol_version' => 'v2',
                'state' => $state,
                'updated_at' => now()->toIso8601String(),
                'completed_at' => $completedAt?->toIso8601String(),
                'platform_results' => $platformResults,
                'state_summary' => $summary,
                'next_operator_action' => $nextAction,
            ]);

            $distribution->forceFill([
                'status' => $this->legacyDistributionStatus($summary, $state),
                'started_at' => $distribution->started_at ?? ($summary['active'] < $summary['total'] ? now() : null),
                'completed_at' => $completedAt,
                'publisher_summary' => $summary,
                'remote_meta' => $meta,
                'last_error_message' => $state === 'failed' ? $this->firstError($jobs) : null,
            ])->save();

            return [
                'state' => $state,
                'summary' => $summary,
                'next_operator_action' => $nextAction,
                'platform_results' => $platformResults,
            ];
        });
    }

    /** @return array<string,mixed> */
    private function platformResult(PublisherPlatformJob $job): array
    {
        $result = is_array($job->result) ? $job->result : [];

        return array_replace($result, [
            'platform' => (string) $job->platform_id,
            'state' => (string) $job->status,
            'progress_step' => $job->progress_step,
            'progress_percent' => (int) $job->progress_percent,
            'attempt' => (int) $job->attempt_count,
            'max_attempts' => (int) $job->max_attempts,
            'remote_url' => $job->remote_url,
            'failure_category' => $job->error_category,
            'message' => $job->error_message ?? ($result['message'] ?? null),
            'next_action' => $job->next_operator_action,
        ]);
    }

    /** @param array<string,int> $summary
     *  @param array<string,int> $stateCounts */
    private function batchState(array $summary, array $stateCounts): string
    {
        if ($summary['total'] === 0) {
            return 'queued';
        }
        if (($stateCounts['verification_required'] ?? 0) > 0 || ($stateCounts['login_required'] ?? 0) > 0 || ($stateCounts['awaiting_confirmation'] ?? 0) > 0) {
            return 'awaiting_confirmation';
        }
        if ($summary['active'] > 0) {
            return 'processing';
        }
        if ($summary['failed'] > 0 && ($summary['published'] > 0 || $summary['draft_saved'] > 0)) {
            return 'partial_completed';
        }
        if ($summary['published'] > 0) {
            return 'published';
        }
        if ($summary['draft_saved'] > 0) {
            return 'draft_saved';
        }

        return 'failed';
    }

    /** @param array<string,int> $summary */
    private function legacyDistributionStatus(array $summary, string $state): string
    {
        if ($state === 'failed') {
            return 'failed';
        }
        if (in_array($state, ['published', 'draft_saved', 'partial_completed'], true)) {
            return 'synced';
        }
        if ($summary['active'] > 0 && $summary['active'] < $summary['total']) {
            return 'sending';
        }

        return 'queued';
    }

    /** @param iterable<PublisherPlatformJob> $jobs */
    private function nextOperatorAction(iterable $jobs): ?string
    {
        foreach ($jobs as $job) {
            if (in_array((string) $job->status, ['verification_required', 'login_required', 'awaiting_confirmation'], true)) {
                return $job->next_operator_action ?: '请在对应发布电脑完成登录、验证或最终确认。';
            }
        }
        foreach ($jobs as $job) {
            if ((string) $job->status === 'failed') {
                return $job->next_operator_action ?: '请检查失败平台后仅重试该平台。';
            }
        }

        return null;
    }

    /** @param iterable<PublisherPlatformJob> $jobs */
    private function firstError(iterable $jobs): ?string
    {
        foreach ($jobs as $job) {
            if ((string) $job->status === 'failed' && filled($job->error_message)) {
                return (string) $job->error_message;
            }
        }

        return null;
    }
}
