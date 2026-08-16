<?php

namespace App\Services\Publishing;

use App\Models\ArticleDistribution;
use App\Models\PublisherDevice;
use App\Models\PublisherPlatformJob;
use App\Models\PublisherPlatformSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the V2 platform-job queue moving when no worker request is currently
 * mutating a job.  The device API calls reconcile() before reading/claiming;
 * session updates and the admin retry action use the more focused methods.
 */
class PublisherPlatformJobLifecycleService
{
    public function __construct(
        private readonly PublisherBatchSummaryService $summary,
    ) {}

    /**
     * Promote due scheduled jobs, release expired leases and bind jobs waiting
     * for a device/session.  This method is deliberately idempotent and safe to
     * call from every polling request.
     *
     * @return array{scheduled:int,leases_released:int,bound:int,login_recovered:int}
     */
    public function reconcile(?Carbon $at = null): array
    {
        $at ??= now();
        $distributionIds = [];
        $counts = [
            'scheduled' => 0,
            'leases_released' => 0,
            'bound' => 0,
            'login_recovered' => 0,
        ];

        DB::transaction(function () use ($at, &$distributionIds, &$counts): void {
            $releasedJobIds = [];
            $due = PublisherPlatformJob::query()
                ->where('status', 'waiting_for_schedule')
                ->whereHas('distribution', fn ($query) => $query
                    ->whereNotNull('scheduled_at')
                    ->where('scheduled_at', '<=', $at))
                ->lockForUpdate()
                ->limit($this->reconcileLimit())
                ->get();

            foreach ($due as $job) {
                $job->forceFill([
                    'status' => 'queued',
                    'next_retry_at' => $at,
                    'progress_step' => '已到发布时间，等待发布节点',
                    'error_category' => null,
                    'error_message' => null,
                    'next_operator_action' => null,
                ])->save();
                $distributionIds[(int) $job->article_distribution_id] = true;
                $counts['scheduled']++;
            }

            $expired = PublisherPlatformJob::query()
                ->whereIn('status', ['processing', 'claimed'])
                ->whereNotNull('lease_expires_at')
                ->where('lease_expires_at', '<=', $at)
                ->lockForUpdate()
                ->limit($this->reconcileLimit())
                ->get();

            foreach ($expired as $job) {
                $attemptsExhausted = (int) $job->attempt_count >= max(1, (int) $job->max_attempts);
                $pinnedDeviceId = $this->pinnedDeviceId($job);
                $candidate = $attemptsExhausted
                    ? null
                    : $this->findReadySession($job, $at, (int) ($job->publisher_device_id ?? 0));
                $job->forceFill([
                    'publisher_device_id' => $candidate?->publisher_device_id ?: ($pinnedDeviceId > 0 ? $pinnedDeviceId : null),
                    'publisher_platform_session_id' => $candidate?->id ?: ($pinnedDeviceId > 0 ? $job->publisher_platform_session_id : null),
                    'status' => $attemptsExhausted
                        ? 'failed'
                        : ($candidate instanceof PublisherPlatformSession ? 'queued' : 'waiting_for_device'),
                    'claimed_at' => null,
                    'claimed_by' => null,
                    'lease_token' => null,
                    'lease_expires_at' => null,
                    'lease_heartbeat_at' => null,
                    'next_retry_at' => $attemptsExhausted ? null : $at,
                    'progress_step' => $attemptsExhausted
                        ? '发布节点租约过期，已达到最大尝试次数'
                        : ($candidate instanceof PublisherPlatformSession
                            ? '原租约已过期，已重新排队等待发布节点'
                            : '原租约已过期，等待可用发布节点'),
                    'error_category' => 'lease_expired',
                    'error_message' => '原发布节点租约已过期，任务已释放并等待接管。',
                    'next_operator_action' => $attemptsExhausted ? 'retry_platform' : null,
                    'finished_at' => $attemptsExhausted ? $at : null,
                ])->save();
                $distributionIds[(int) $job->article_distribution_id] = true;
                $releasedJobIds[] = (int) $job->id;
                $counts['leases_released']++;
                if ($candidate instanceof PublisherPlatformSession) {
                    $counts['bound']++;
                }
            }

            $waiting = PublisherPlatformJob::query()
                ->whereIn('status', ['waiting_for_device', 'login_required', 'verification_required'])
                ->when($releasedJobIds !== [], fn ($query) => $query->whereNotIn('id', $releasedJobIds))
                ->where(function ($query) use ($at): void {
                    $query->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $at);
                })
                ->whereColumn('attempt_count', '<', 'max_attempts')
                ->lockForUpdate()
                ->limit($this->reconcileLimit())
                ->get();

            foreach ($waiting as $job) {
                $candidate = $this->findReadySession($job, $at);
                if (! $candidate instanceof PublisherPlatformSession) {
                    continue;
                }
                $wasLoginBlocked = in_array((string) $job->status, ['login_required', 'verification_required'], true);
                $job->forceFill([
                    'publisher_device_id' => $candidate->publisher_device_id,
                    'publisher_platform_session_id' => $candidate->id,
                    'status' => 'queued',
                    'next_retry_at' => $at,
                    'progress_step' => $wasLoginBlocked ? '账号已恢复登录，重新进入发布队列' : '已绑定在线账号，等待发布节点',
                    'error_category' => null,
                    'error_message' => null,
                    'next_operator_action' => null,
                    'finished_at' => null,
                ])->save();
                $distributionIds[(int) $job->article_distribution_id] = true;
                $counts[$wasLoginBlocked ? 'login_recovered' : 'bound']++;
            }
        });

        $this->refreshDistributions(array_keys($distributionIds));

        return $counts;
    }

    /**
     * Requeue jobs affected by a session becoming ready after login.
     */
    public function onSessionUpdated(PublisherPlatformSession $session, ?string $previousState = null): int
    {
        if ((string) $session->login_state !== 'ready') {
            return 0;
        }
        if ($previousState !== null && $previousState === 'ready') {
            return 0;
        }

        $distributionIds = [];
        $count = 0;
        DB::transaction(function () use ($session, &$distributionIds, &$count): void {
            $jobs = PublisherPlatformJob::query()
                ->where('platform_id', $session->platform_id)
                ->whereIn('status', ['login_required', 'verification_required', 'waiting_for_device'])
                ->whereColumn('attempt_count', '<', 'max_attempts')
                ->where(function ($query) use ($session): void {
                    $query->where(function ($sameSession) use ($session): void {
                        $sameSession->where('publisher_platform_session_id', $session->id)
                            ->orWhere(function ($sameProfile) use ($session): void {
                                $sameProfile->whereNull('publisher_platform_session_id')
                                    ->where('publisher_device_id', $session->publisher_device_id)
                                    ->where('profile_key', $session->profile_key);
                            });
                    })
                        ->orWhere(function ($profile) use ($session): void {
                            $profile->whereNull('publisher_platform_session_id')
                                ->whereNull('publisher_device_id')
                                ->when(filled($session->profile_key), fn ($scoped) => $scoped->where('profile_key', $session->profile_key));
                        });
                })
                ->lockForUpdate()
                ->limit($this->reconcileLimit())
                ->get();

            foreach ($jobs as $job) {
                $job->forceFill([
                    'publisher_device_id' => $session->publisher_device_id,
                    'publisher_platform_session_id' => $session->id,
                    'status' => 'queued',
                    'next_retry_at' => now(),
                    'progress_step' => '账号已恢复登录，重新进入发布队列',
                    'error_category' => null,
                    'error_message' => null,
                    'next_operator_action' => null,
                    'finished_at' => null,
                    'claimed_at' => null,
                    'claimed_by' => null,
                    'lease_token' => null,
                    'lease_expires_at' => null,
                    'lease_heartbeat_at' => null,
                ])->save();
                $distributionIds[(int) $job->article_distribution_id] = true;
                $count++;
            }
        });

        $this->refreshDistributions(array_keys($distributionIds));

        return $count;
    }

    /**
     * Manual retry is intentionally platform-scoped: published/draft-saved
     * jobs remain terminal and only failed jobs are reset for another attempt.
     */
    public function retryFailedPlatforms(ArticleDistribution $distribution, bool $resetAttempts = true): int
    {
        $count = 0;
        DB::transaction(function () use ($distribution, $resetAttempts, &$count): void {
            $jobs = $distribution->publisherPlatformJobs()
                ->whereIn('status', ['failed', 'login_required', 'verification_required'])
                ->lockForUpdate()
                ->get();
            foreach ($jobs as $job) {
                $previousStatus = (string) $job->status;
                $result = is_array($job->result) ? $job->result : [];
                $result['manual_retry_at'] = now()->toIso8601String();
                $result['previous_status'] = $previousStatus;
                $job->forceFill([
                    'status' => 'queued',
                    'attempt_count' => $resetAttempts ? 0 : $job->attempt_count,
                    'next_retry_at' => now(),
                    'claimed_at' => null,
                    'claimed_by' => null,
                    'lease_token' => null,
                    'lease_expires_at' => null,
                    'lease_heartbeat_at' => null,
                    'started_at' => null,
                    'finished_at' => null,
                    'progress_step' => '已手动重试，等待发布节点',
                    'progress_percent' => 0,
                    'error_category' => null,
                    'error_message' => null,
                    'next_operator_action' => null,
                    'result' => $result,
                ])->save();
                $count++;
            }
        });

        if ($count > 0) {
            $this->summary->refresh($distribution->fresh());
        }

        return $count;
    }

    private function findReadySession(PublisherPlatformJob $job, Carbon $at, int $excludeDeviceId = 0): ?PublisherPlatformSession
    {
        $pinnedDeviceId = $this->pinnedDeviceId($job);

        return PublisherPlatformSession::query()
            ->with('device')
            ->where('platform_id', $job->platform_id)
            ->when($job->profile_key !== null && $job->profile_key !== '', fn ($query) => $query->where('profile_key', $job->profile_key))
            ->where('login_state', 'ready')
            ->when($pinnedDeviceId > 0, fn ($query) => $query->where('publisher_device_id', $pinnedDeviceId))
            ->when($pinnedDeviceId <= 0 && $excludeDeviceId > 0, fn ($query) => $query->where('publisher_device_id', '!=', $excludeDeviceId))
            ->whereHas('device', function ($query) use ($at): void {
                $query->whereNull('disabled_at')
                    ->whereNotNull('last_seen_at')
                    ->where('last_seen_at', '>=', $at->copy()->subMinutes($this->deviceOnlineMinutes()));
            })
            ->orderByDesc('last_verified_at')
            ->orderByDesc('last_seen_at')
            ->first();
    }

    private function pinnedDeviceId(PublisherPlatformJob $job): int
    {
        $distribution = $job->distribution;
        if (! $distribution instanceof ArticleDistribution) {
            return 0;
        }

        $isPinned = (string) $distribution->assigned_device_strategy === 'specified'
            || $distribution->publisher_account_group_id !== null;
        if (! $isPinned) {
            return 0;
        }

        $jobDeviceId = max(0, (int) ($job->publisher_device_id ?? 0));
        if ($jobDeviceId > 0) {
            return $jobDeviceId;
        }

        $preferredDeviceId = max(0, (int) ($distribution->publisherAssistantMeta()['preferred_device_id'] ?? 0));
        if ($preferredDeviceId > 0) {
            return $preferredDeviceId;
        }

        return max(0, (int) ($distribution->publisherAccountGroup?->publisher_device_id ?? 0));
    }

    private function refreshDistributions(array $ids): void
    {
        foreach (array_values(array_unique(array_map('intval', $ids))) as $id) {
            if ($id <= 0) {
                continue;
            }
            $distribution = ArticleDistribution::query()->find($id);
            if ($distribution instanceof ArticleDistribution) {
                $this->summary->refresh($distribution);
            }
        }
    }

    private function reconcileLimit(): int
    {
        return max(10, min(500, (int) config('publishing.job_reconcile_limit', 200)));
    }

    private function deviceOnlineMinutes(): int
    {
        return max(1, (int) config('publishing.device_online_minutes', 2));
    }
}
