<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\ArticleDistribution;
use App\Models\PublisherDevice;
use App\Models\PublisherPlatformJob;
use App\Models\PublisherPlatformSession;
use App\Services\Publishing\PublisherDeviceCredential;
use App\Services\Publishing\PublisherBatchSummaryService;
use App\Services\Publishing\PublisherPlatformCatalogService;
use App\Services\Publishing\PublisherPlatformJobLifecycleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Device-level V2 platform job queue.
 *
 * A claim is a renewable lease.  The lease token is deliberately returned
 * only on claim and is required for every subsequent mutation, so a worker
 * which was restarted cannot overwrite a job reclaimed by another worker.
 */
class PublisherPlatformJobController extends BaseApiController
{
    public function __construct(
        private readonly PublisherBatchSummaryService $summary,
        private readonly PublisherPlatformJobLifecycleService $lifecycle,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->assertFeatureEnabled();
        $deviceId = trim((string) ($request->query('device_id') ?: $request->header('X-Publisher-Worker')));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }
        $device = $this->authorizeDevice($request, $deviceId);
        $this->lifecycle->reconcile();
        $limit = max(1, min(50, $request->integer('limit', 20)));
        $now = now();
        $items = PublisherPlatformJob::query()
            ->with(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform'])
            ->where(function ($query) use ($device): void {
                $query->whereNull('publisher_device_id')->orWhere('publisher_device_id', $device->id);
            })
            ->whereIn('status', ['queued', 'processing', 'claimed'])
            ->where(function ($query) use ($now, $device): void {
                $query->where('status', 'queued')
                    ->orWhere(function ($active) use ($now, $device): void {
                        $active->whereIn('status', ['processing', 'claimed'])
                            ->where(function ($lease) use ($now, $device): void {
                                $lease->whereNull('lease_expires_at')
                                    ->orWhere('lease_expires_at', '<=', $now)
                                    ->orWhere(function ($owned) use ($now, $device): void {
                                        $owned->where('claimed_by', $device->device_id)
                                            ->where('lease_expires_at', '>', $now);
                                    });
                            });
                    });
            })
            ->where(function ($query) use ($now): void {
                $query->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $now);
            })
            ->where(function ($query) use ($now, $device): void {
                $query->whereColumn('attempt_count', '<', 'max_attempts')
                    ->orWhere(function ($owned) use ($now, $device): void {
                        $owned->whereIn('status', ['processing', 'claimed'])
                            ->where('claimed_by', $device->device_id)
                            ->whereNotNull('lease_token')
                            ->where(function ($lease) use ($now): void {
                                $lease->whereNull('lease_expires_at')->orWhere('lease_expires_at', '>', $now);
                            });
                    });
            })
            ->orderBy('id')
            ->limit($limit * 3)
            ->get()
            ->filter(fn (PublisherPlatformJob $job): bool => $this->canDeviceRun($job, $device))
            ->take($limit)
            ->map(fn (PublisherPlatformJob $job): array => $this->serializeJob($job))
            ->values()
            ->all();

        return $this->success($request, [
            'device_id' => $device->device_id,
            'items' => $items,
            'jobs' => $items,
            'count' => count($items),
            'server_time' => $now->toIso8601String(),
        ]);
    }

    public function claim(Request $request, int $job): JsonResponse
    {
        $this->assertFeatureEnabled();
        $deviceId = trim((string) ($request->header('X-Publisher-Worker') ?: $request->input('device_id')));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }
        $device = $this->authorizeDevice($request, $deviceId);
        $this->lifecycle->reconcile();

        $claimed = DB::transaction(function () use ($job, $device): PublisherPlatformJob {
            /** @var PublisherPlatformJob|null $item */
            $item = PublisherPlatformJob::query()
                ->with(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform'])
                ->whereKey($job)
                ->lockForUpdate()
                ->first();
            if (! $item) {
                throw new ApiException('publisher_platform_job_not_found', '平台子任务不存在。', 404);
            }
            if ($item->publisher_device_id !== null && (int) $item->publisher_device_id !== (int) $device->id) {
                throw new ApiException('publisher_platform_job_not_assigned', '该平台子任务未分配给当前设备。', 409);
            }
            if ($item->isTerminal()) {
                throw new ApiException('publisher_platform_job_completed', '平台子任务已完成。', 409);
            }

            $now = now();
            $sameLiveClaim = in_array((string) $item->status, ['processing', 'claimed'], true)
                && (string) ($item->claimed_by ?? '') === (string) $device->device_id
                && filled($item->lease_token)
                && $item->lease_expires_at !== null
                && $item->lease_expires_at->isFuture();
            if ($sameLiveClaim) {
                // Network retries must receive the original lease instead of
                // creating a second attempt for the same device.
                return $item;
            }
            $expiredLeaseCanBeReclaimed = in_array((string) $item->status, ['processing', 'claimed'], true)
                && ($item->lease_expires_at === null || $item->lease_expires_at->lte($now));
            if ((string) $item->status !== 'queued'
                && ! $expiredLeaseCanBeReclaimed) {
                // Direct calls must not bypass the scheduler or a login/
                // verification hold merely because the job ID is known.
                throw new ApiException(
                    'publisher_platform_job_not_claimable',
                    'Publisher platform job is not ready to claim.',
                    409,
                );
            }
            if ($item->next_retry_at !== null && $item->next_retry_at->isFuture()) {
                throw new ApiException('publisher_platform_job_not_ready', '平台子任务尚未到重试时间。', 409);
            }
            if ((int) $item->attempt_count >= max(1, (int) $item->max_attempts)) {
                throw new ApiException('publisher_platform_job_attempts_exhausted', '平台子任务已达到最大尝试次数。', 409);
            }
            if (! $this->canDeviceRun($item, $device)) {
                throw new ApiException('publisher_platform_job_not_capable', '当前设备不具备该平台或账号的执行能力。', 409);
            }

            if (in_array((string) $item->status, ['processing', 'claimed'], true)
                && $item->lease_expires_at !== null
                && $item->lease_expires_at->isFuture()
                && (string) ($item->claimed_by ?? '') !== (string) $device->device_id) {
                throw new ApiException('publisher_platform_job_claimed', '平台子任务正在由其他节点处理。', 409);
            }

            // A profile is a strict serialization boundary. Different
            // account groups may run concurrently, but one profile never does.
            // The database mutex lasts only through this claim transaction;
            // it serializes check-and-claim without serializing execution.
            $this->lockProfileClaimBoundary($item, $device);
            if ($this->profileHasActiveLease($item, $device)) {
                throw new ApiException('publisher_profile_busy', '该账号资料正在执行其他平台任务。', 409);
            }

            $item->forceFill([
                'publisher_device_id' => $device->id,
                'status' => 'processing',
                'attempt_count' => (int) $item->attempt_count + 1,
                'claimed_at' => $expiredLeaseCanBeReclaimed ? $now : ($item->claimed_at ?? $now),
                'claimed_by' => $device->device_id,
                'lease_token' => bin2hex(random_bytes(32)),
                'lease_expires_at' => $now->copy()->addMinutes($this->leaseMinutes()),
                'lease_heartbeat_at' => $now,
                'started_at' => $item->started_at ?? $now,
                'last_progress_at' => $now,
                'progress_step' => $item->progress_step ?: '已领取，等待本地执行器处理',
            ])->save();

            return $item->fresh(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform']);
        });

        return $this->success($request, [
            'job' => $this->serializeJob($claimed, true),
            'lease_token' => $claimed->lease_token,
            'lease_expires_at' => $claimed->lease_expires_at?->toIso8601String(),
        ]);
    }

    public function heartbeat(Request $request, int $job): JsonResponse
    {
        $this->assertFeatureEnabled();
        $validated = $request->validate([
            'progress_step' => ['nullable', 'string', 'max:120'],
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'message' => ['nullable', 'string', 'max:1000'],
            'result' => ['nullable', 'array'],
        ]);
        $device = $this->requestDevice($request);
        $lease = $this->requestLease($request);
        $updated = DB::transaction(function () use ($job, $device, $lease, $validated): PublisherPlatformJob {
            $item = $this->lockedJob($job, $device, $lease);
            $now = now();
            $progressResult = isset($validated['result']) ? $this->sanitizeResult($validated['result']) : [];
            $message = trim((string) ($validated['message'] ?? ''));
            if ($message !== '') {
                $progressResult['message'] = $message;
            }
            $item->forceFill([
                'lease_expires_at' => $now->copy()->addMinutes($this->leaseMinutes()),
                'lease_heartbeat_at' => $now,
                'last_progress_at' => $now,
                'progress_step' => $validated['progress_step'] ?? $item->progress_step,
                'progress_percent' => $validated['progress_percent'] ?? $item->progress_percent,
                'result' => array_replace($this->sanitizeResult(is_array($item->result) ? $item->result : []), $progressResult),
            ])->save();

            return $item->fresh(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform']);
        });

        return $this->success($request, [
            'job' => $this->serializeJob($updated),
            'lease_expires_at' => $updated->lease_expires_at?->toIso8601String(),
        ]);
    }
    /** Alias used by the protocol specification. */
    public function progress(Request $request, int $job): JsonResponse
    {
        return $this->heartbeat($request, $job);
    }

    public function result(Request $request, int $job): JsonResponse
    {
        $this->assertFeatureEnabled();
        $reportedStatus = strtolower(trim((string) ($request->input('status') ?? $request->input('state') ?? 'failed')));
        $status = $this->normalizeJobStatus($reportedStatus);
        if ($status === null) {
            throw new ApiException('validation_failed', '平台子任务状态无效。', 422);
        }
        $providedResult = $request->input('result', []);
        if (! is_array($providedResult)) {
            throw new ApiException('validation_failed', 'result 必须是对象。', 422);
        }
        $result = $this->sanitizeResult($providedResult);
        if ($reportedStatus !== $status) {
            $result['reported_state'] = $reportedStatus;
        }
        $message = trim((string) ($request->input('error_message') ?? $request->input('message') ?? ($providedResult['message'] ?? '')));
        $remoteUrl = trim((string) ($request->input('remote_url') ?? ($providedResult['remote_url'] ?? '')));
        if ($remoteUrl !== '' && filter_var($remoteUrl, FILTER_VALIDATE_URL) === false) {
            throw new ApiException('validation_failed', 'remote_url 必须是有效 URL。', 422);
        }
        $device = $this->requestDevice($request);
        $lease = $this->requestLease($request);
        $failureCategory = $request->input('error_category') ?: ($providedResult['failure_category'] ?? null);
        if ($status === 'verification_required' && ! filled($failureCategory)) {
            $failureCategory = $reportedStatus === 'needs_captcha' ? 'captcha' : 'verification_required';
        }
        $nextOperatorAction = $request->input('next_operator_action');
        if (! filled($nextOperatorAction)) {
            $nextOperatorAction = $status === 'awaiting_confirmation'
                ? 'operator_confirm_publish'
                : (in_array($status, ['login_required', 'verification_required'], true) ? 'operator_login_or_verify_platform' : null);
        }
        $progressStep = $request->input('progress_step');
        $progressPercent = $request->has('progress_percent') ? max(0, min(100, (int) $request->input('progress_percent'))) : null;
        $retryable = filter_var($request->input('retryable', $providedResult['retryable'] ?? false), FILTER_VALIDATE_BOOLEAN);

        $updated = DB::transaction(function () use ($job, $device, $lease, $status, $result, $message, $remoteUrl, $failureCategory, $nextOperatorAction, $progressStep, $progressPercent, $retryable): array {
            $reference = PublisherPlatformJob::query()->whereKey($job)->first(['article_distribution_id']);
            if (! $reference) {
                throw new ApiException('publisher_platform_job_not_found', 'Publisher platform job not found.', 404);
            }
            $distribution = ArticleDistribution::query()
                ->whereKey($reference->article_distribution_id)
                ->lockForUpdate()
                ->first();
            if (! $distribution) {
                throw new ApiException('publisher_platform_job_not_found', 'Publisher platform job not found.', 404);
            }
            $item = $this->lockedJob($job, $device, $lease);
            if ($item->isTerminal()) {
                if ((string) $item->status !== $status) {
                    throw new ApiException('publisher_platform_job_completed', '平台子任务已完成，不能用旧租约改写结果。', 409);
                }

                // A worker may retry after losing the HTTP response. The same
                // terminal report is an idempotent read and cannot rewrite the
                // stored result, error, or remote URL.

                return [
                    'job' => $item->fresh(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform']),
                    'batch' => $this->summary->refresh($distribution),
                ];
            }
            $now = now();
            $shouldRetry = $status === 'failed'
                && $retryable
                && (int) $item->attempt_count < max(1, (int) $item->max_attempts);
            $effectiveStatus = $shouldRetry ? 'queued' : $status;
            $effectiveTerminal = in_array($effectiveStatus, PublisherPlatformJob::TERMINAL_STATUSES, true);
            $needsAttention = in_array($effectiveStatus, ['failed', 'login_required', 'verification_required', 'awaiting_confirmation'], true);
            $nextRetryAt = $shouldRetry
                ? $now->copy()->addSeconds($this->retryBackoffSeconds((int) $item->attempt_count))
                : null;
            $mergedResult = array_replace(
                $this->sanitizeResult(is_array($item->result) ? $item->result : []),
                $result,
                $shouldRetry ? [
                    'retry_scheduled' => true,
                    'retry_at' => $nextRetryAt->toIso8601String(),
                    'last_failure' => [
                        'message' => $message,
                        'failure_category' => $failureCategory,
                    ],
                ] : []
            );
            $item->forceFill([
                'status' => $effectiveStatus,
                'progress_step' => $shouldRetry ? '平台执行失败，等待自动重试' : ($progressStep ?? $item->progress_step),
                'progress_percent' => $progressPercent ?? ($effectiveTerminal ? 100 : $item->progress_percent),
                'remote_url' => $remoteUrl !== '' ? $remoteUrl : $item->remote_url,
                'error_category' => $status === 'failed' || $status === 'verification_required' ? $failureCategory : null,
                'error_message' => $shouldRetry ? null : ($needsAttention ? ($message !== '' ? $message : $item->error_message) : null),
                'next_operator_action' => $shouldRetry ? null : $nextOperatorAction,
                'result' => $mergedResult,
                'last_progress_at' => $now,
                'finished_at' => $effectiveTerminal ? ($item->finished_at ?? $now) : null,
                'next_retry_at' => $nextRetryAt,
                'claimed_at' => $shouldRetry ? null : $item->claimed_at,
                'claimed_by' => $shouldRetry ? null : $item->claimed_by,
                'lease_token' => $shouldRetry ? null : $item->lease_token,
                // Retain the token for duplicate delivery checks; expiration
                // still blocks stale workers after a non-terminal lease.
                'lease_expires_at' => $shouldRetry || $effectiveTerminal ? null : $now->copy()->addMinutes($this->leaseMinutes()),
                'lease_heartbeat_at' => $shouldRetry ? null : $now,
            ])->save();

            $summary = $this->summary->refresh($distribution);

            return [
                'job' => $item->fresh(['distribution.article', 'distribution.publisherAccountGroup', 'session.device', 'device', 'platform']),
                'batch' => $summary,
            ];
        });

        return $this->success($request, [
            'job' => $this->serializeJob($updated['job']),
            'batch' => $updated['batch'],
            'device_id' => $device->device_id,
        ]);
    }
    private function assertFeatureEnabled(): void
    {
        if (! (bool) config('publishing.platform_jobs_enabled', false)) {
            throw new ApiException('publisher_platform_jobs_disabled', 'Platform jobs API is disabled.', 404);
        }
    }

    private function requestDevice(Request $request): PublisherDevice
    {
        $deviceId = trim((string) ($request->header('X-Publisher-Worker') ?: $request->input('device_id')));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }

        return $this->authorizeDevice($request, $deviceId);
    }

    private function requestLease(Request $request): string
    {
        return trim((string) ($request->input('lease_token') ?: $request->header('X-Publisher-Lease')));
    }

    private function lockedJob(int $job, PublisherDevice $device, string $lease): PublisherPlatformJob
    {
        /** @var PublisherPlatformJob|null $item */
        $item = PublisherPlatformJob::query()->with('distribution')->whereKey($job)->lockForUpdate()->first();
        if (! $item) {
            throw new ApiException('publisher_platform_job_not_found', '平台子任务不存在。', 404);
        }
        $this->assertJobLease($item, $device, $lease);

        return $item;
    }

    private function assertJobLease(PublisherPlatformJob $item, PublisherDevice $device, string $lease): void
    {
        if ((int) $item->publisher_device_id !== (int) $device->id
            || $lease === ''
            || ! hash_equals((string) ($item->lease_token ?? ''), $lease)
            || (string) ($item->claimed_by ?? '') !== (string) $device->device_id) {
            throw new ApiException('publisher_platform_job_lease_invalid', '平台子任务租约无效。', 409);
        }
        if (! $item->isTerminal() && $item->lease_expires_at !== null && $item->lease_expires_at->isPast()) {
            throw new ApiException('publisher_platform_job_lease_expired', '平台子任务租约已过期。', 409);
        }
    }

    private function authorizeDevice(Request $request, string $deviceId): PublisherDevice
    {
        $record = PublisherDevice::query()->where('device_id', $deviceId)->first();
        if (! $record) {
            throw new ApiException('publisher_device_not_found', '发布设备不存在。', 404);
        }
        if ($record->disabled_at !== null) {
            throw new ApiException('publisher_device_disabled', '发布设备已被禁用。', 403);
        }
        $token = trim((string) $request->bearerToken());
        if (! PublisherDeviceCredential::verify($record, $token)) {
            throw new ApiException('publisher_device_unauthorized', '设备凭证无效，请重新配对。', 401);
        }

        return $record;
    }

    private function retryBackoffSeconds(int $attempt): int
    {
        $base = max(1, (int) config('publishing.job_retry_backoff_seconds', 30));
        $exponent = max(0, min(6, $attempt - 1));

        return min(3600, $base * (2 ** $exponent));
    }

    private function leaseMinutes(): int
    {
        return max(1, (int) config('publishing.job_lease_minutes', 15));
    }

    private function canDeviceRun(PublisherPlatformJob $job, PublisherDevice $device): bool
    {
        $capabilities = is_array($device->capabilities) ? $device->capabilities : [];
        $platformId = (string) $job->platform_id;
        if (! $this->desiredStateAllowsPlatform($device, $platformId)) {
            return false;
        }
        if (! in_array($platformId, $capabilities, true)) {
            return false;
        }
        $session = $job->session;
        if (! $session instanceof PublisherPlatformSession
            || (int) $session->publisher_device_id !== (int) $device->id
            || (string) $session->login_state !== 'ready') {
            return false;
        }
        $platform = $job->platform;
        if (! $platform) {
            return false;
        }
        $directIntent = in_array((string) $job->publish_mode, ['direct', 'scheduled'], true);
        if ($directIntent) {
            $allowsDirectSubmit = in_array(
                $platformId,
                PublisherPlatformCatalogService::VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS,
                true,
            ) && (bool) $platform->supports_direct_publish
                && (bool) $session->auto_allowed;

            // A direct request may have been created before the account was
            // verified or while unattended submission was disabled. The
            // serializer/preflight contract downgrades that job to draft;
            // allow the worker to claim it so the draft can be saved instead
            // of leaving the queue permanently blocked.
            return $allowsDirectSubmit || (bool) $platform->supports_draft;
        }

        return (bool) $platform->supports_draft;
    }

    /**
     * Serializes the active-lease check and the subsequent claim for a device.
     * This is intentionally a short-lived row lock: jobs for different
     * profiles can still execute in parallel once their leases are issued.
     */
    private function lockProfileClaimBoundary(PublisherPlatformJob $job, PublisherDevice $device): void
    {
        if (! filled($job->profile_key)) {
            return;
        }

        PublisherDevice::query()
            ->whereKey($device->id)
            ->lockForUpdate()
            ->first();
    }

    private function profileHasActiveLease(PublisherPlatformJob $job, PublisherDevice $device): bool
    {
        if (! filled($job->profile_key)) {
            return false;
        }
        return PublisherPlatformJob::query()
            ->where('publisher_device_id', $device->id)
            ->where('profile_key', $job->profile_key)
            ->whereIn('status', ['processing', 'claimed'])
            ->where('id', '!=', $job->id)
            ->where('lease_expires_at', '>', now())
            // Force a current read after obtaining the per-device mutex.
            // This avoids an older MySQL REPEATABLE READ snapshot.
            ->lockForUpdate()
            ->first(['id']) !== null;
    }

    /** @return array<string,mixed> */
    private function serializeJob(PublisherPlatformJob $job, bool $includeLease = false): array
    {
        $distribution = $job->distribution;
        $article = $distribution?->article;
        $accountGroup = $distribution?->publisherAccountGroup;
        $device = $job->device ?? $job->session?->device;
        $payload = is_array($job->payload_snapshot) ? $job->payload_snapshot : [];
        $result = $this->sanitizeResult(is_array($job->result) ? $job->result : []);
        $preflight = is_array($result['preflight'] ?? null) ? $result['preflight'] : [];
        $platform = $job->platform;
        $supportLevel = trim((string) ($preflight['support_level'] ?? $platform?->support_level ?? 'unknown')) ?: 'unknown';
        $isVerifiedDirect = in_array(
            (string) $job->platform_id,
            PublisherPlatformCatalogService::VERIFIED_DIRECT_PUBLISH_PLATFORM_IDS,
            true,
        );
        $snapshotAllowsDirect = ! array_key_exists('supports_direct_publish', $preflight)
            || (bool) $preflight['supports_direct_publish'];
        $snapshotAllowsScheduled = ! array_key_exists('supports_scheduled', $preflight)
            || (bool) $preflight['supports_scheduled'];
        $supportsDraft = (bool) ($platform?->supports_draft ?? $preflight['supports_draft'] ?? false);
        $supportsDirectPublish = $isVerifiedDirect
            && (bool) ($platform?->supports_direct_publish ?? false)
            && $snapshotAllowsDirect;
        $supportsScheduled = $supportsDirectPublish
            && (bool) ($platform?->supports_scheduled ?? false)
            && $snapshotAllowsScheduled;
        $sessionAllowsAuto = (bool) ($job->session?->auto_allowed ?? false);
        $storedPublishMode = trim((string) $job->publish_mode) ?: 'draft';
        $requestedPublishMode = trim((string) ($distribution?->publish_mode ?? '')) ?: $storedPublishMode;
        $effectivePublishMode = $storedPublishMode === 'scheduled' ? 'direct' : $storedPublishMode;
        $supportsRequestedPublish = $requestedPublishMode === 'scheduled'
            ? $supportsScheduled
            : $supportsDirectPublish;
        if (in_array($storedPublishMode, ['direct', 'scheduled'], true)
            && (! $supportsRequestedPublish || ! $sessionAllowsAuto)) {
            $effectivePublishMode = 'draft';
        }
        $snapshotManualConfirmation = (bool) ($preflight['manual_confirmation'] ?? false);
        $manualConfirmation = $snapshotManualConfirmation
            || $effectivePublishMode !== 'direct'
            || $supportLevel === 'manual'
            || ! $sessionAllowsAuto;
        $executionMode = $effectivePublishMode === 'direct' && ! $manualConfirmation
            ? 'assistant_submit'
            : 'assistant_confirm';
        $capabilities = [
            'draft' => $supportsDraft,
            'direct_publish' => $supportsDirectPublish,
            'scheduled' => $supportsScheduled,
        ];

        $sessionMeta = is_array($job->session?->meta) ? $job->session->meta : [];
        $accountGroupExternalId = trim((string) ($accountGroup?->external_id ?? ''));
        $snapshotGroupId = trim((string) ($result['account_group_external_id'] ?? ''));
        $sessionGroupId = trim((string) ($sessionMeta['group_id'] ?? ''));
        $localGroupId = $accountGroupExternalId !== ''
            ? $accountGroupExternalId
            : ($snapshotGroupId !== '' ? $snapshotGroupId : $sessionGroupId);
        $accountGroupData = $accountGroup || $localGroupId !== '' ? [
            'id' => $localGroupId !== '' ? $localGroupId : (string) $accountGroup?->id,
            'database_id' => $accountGroup?->id !== null ? (int) $accountGroup->id : null,
            'external_id' => $accountGroupExternalId !== '' ? $accountGroupExternalId : null,
            'name' => $accountGroup?->name,
        ] : null;

        $targetDeviceId = trim((string) ($device?->device_id ?? ''));
        $targetDevice = $device ? [
            'id' => $targetDeviceId !== '' ? $targetDeviceId : null,
            'database_id' => (int) $device->id,
            'device_id' => $targetDeviceId !== '' ? $targetDeviceId : null,
            'name' => (string) $device->name,
            'status' => (string) $device->status,
        ] : null;
        $platformDetails = [
            'id' => (string) $job->platform_id,
            'platform_id' => (string) $job->platform_id,
            'name' => (string) ($platform?->name ?? $job->platform_id),
            'support_level' => $supportLevel,
            'requested_publish_mode' => $requestedPublishMode,
            'publish_mode' => $effectivePublishMode,
            'effective_publish_mode' => $effectivePublishMode,
            'manual_confirmation' => $manualConfirmation,
            'supports_draft' => $supportsDraft,
            'supports_direct_publish' => $supportsDirectPublish,
            'supports_scheduled' => $supportsScheduled,
            'capabilities' => $capabilities,
            'execution_mode' => $executionMode,
        ];

        $data = [
            'id' => (int) $job->id,
            'article_distribution_id' => (int) $job->article_distribution_id,
            'distribution_id' => (int) $job->article_distribution_id,
            'platform_id' => (string) $job->platform_id,
            'platforms' => [(string) $job->platform_id],
            'platform_details' => [$platformDetails],
            'publisher_account_group_id' => $distribution?->publisher_account_group_id !== null
                ? (int) $distribution->publisher_account_group_id
                : null,
            'account_group_id' => $localGroupId !== '' ? $localGroupId : null,
            'group_id' => $localGroupId !== '' ? $localGroupId : null,
            'account_group' => $accountGroupData,
            'group' => $accountGroupData,
            'publisher_device_id' => $job->publisher_device_id !== null ? (int) $job->publisher_device_id : null,
            'device_id' => $targetDeviceId !== '' ? $targetDeviceId : null,
            'target_device_id' => $targetDeviceId !== '' ? $targetDeviceId : null,
            'device' => $targetDevice,
            'target_device' => $targetDevice,
            'publisher_platform_session_id' => $job->publisher_platform_session_id !== null ? (int) $job->publisher_platform_session_id : null,
            'profile_key' => $job->profile_key,
            'requested_publish_mode' => $requestedPublishMode,
            'publish_mode' => $effectivePublishMode,
            'effective_publish_mode' => $effectivePublishMode,
            'status' => (string) $job->status,
            'progress_step' => $job->progress_step,
            'progress_percent' => (int) $job->progress_percent,
            'attempt_count' => (int) $job->attempt_count,
            'max_attempts' => (int) $job->max_attempts,
            'claimed_at' => $job->claimed_at?->toIso8601String(),
            'lease_expires_at' => $includeLease ? $job->lease_expires_at?->toIso8601String() : null,
            'started_at' => $job->started_at?->toIso8601String(),
            'last_progress_at' => $job->last_progress_at?->toIso8601String(),
            'finished_at' => $job->finished_at?->toIso8601String(),
            'next_retry_at' => $job->next_retry_at?->toIso8601String(),
            'remote_url' => $job->remote_url,
            'error_category' => $job->error_category,
            'error_message' => $job->error_message,
            'next_operator_action' => $job->next_operator_action,
            'support_level' => $supportLevel,
            'manual_confirmation' => $manualConfirmation,
            'supports_draft' => $supportsDraft,
            'supports_direct_publish' => $supportsDirectPublish,
            'supports_scheduled' => $supportsScheduled,
            'capabilities' => $capabilities,
            'execution_mode' => $executionMode,
            'platform' => $platformDetails,
            'payload' => $payload,
            'payload_snapshot' => $payload,
            'result' => $result,
            'article' => $article ? ['id' => (int) $article->id, 'title' => (string) $article->title] : null,
        ];
        if ($includeLease) {
            $data['lease_token'] = $job->lease_token;
            $data['claimed_by'] = $job->claimed_by;
        }

        return $data;
    }

    /**
     * A missing legacy field means no server-side platform restriction. Once
     * enabled_platform_ids_present is true, an empty list is deliberately a
     * deny-all policy instead of falling back to every platform.
     */
    private function desiredStateAllowsPlatform(PublisherDevice $device, string $platformId): bool
    {
        $desired = is_array($device->desired_state) ? $device->desired_state : [];
        $ids = array_values(array_unique(array_filter(
            (array) ($desired['enabled_platform_ids'] ?? []),
            'is_string'
        )));
        $legacyAllowlist = ! array_key_exists('enabled_platform_ids_present', $desired) && $ids !== [];
        $hasExplicitFilter = array_key_exists('enabled_platform_ids_present', $desired)
            ? filter_var($desired['enabled_platform_ids_present'], FILTER_VALIDATE_BOOLEAN)
            : $legacyAllowlist;
        $mode = (string) ($desired['platform_filter_mode'] ?? '');

        if ($mode === 'all') {
            return true;
        }
        if ($mode === 'none') {
            return false;
        }
        if (! $hasExplicitFilter) {
            return true;
        }

        return in_array($platformId, $ids, true);
    }

    private function normalizeJobStatus(string $status): ?string
    {
        return match ($status) {
            'draft_saved', 'published', 'failed', 'cancelled', 'skipped', 'awaiting_confirmation', 'login_required', 'verification_required' => $status,
            'needs_verification', 'needs_captcha' => 'verification_required',
            default => null,
        };
    }

    /** @param array<string,mixed> $result
     *  @return array<string,mixed> */
    private function sanitizeResult(array $result): array
    {
        foreach (['lease_token', 'leaseToken', 'lease_expires_at', 'leaseExpiresAt', 'lease_heartbeat_at', 'leaseHeartbeatAt', 'device_id', 'deviceId', 'publisher_device_id', 'publisherDeviceId', 'claimed_by', 'claimedBy', 'job_id', 'jobId', 'platform_job_id', 'platformJobId'] as $key) {
            unset($result[$key]);
        }

        return $result;
    }

}
