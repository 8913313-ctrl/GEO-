<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\PublisherDevice;
use App\Models\PublisherPlatformJob;
use App\Services\Publishing\PublisherBatchSummaryService;
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
    ) {}

    public function index(Request $request): JsonResponse
    {
        $deviceId = trim((string) ($request->query('device_id') ?: $request->header('X-Publisher-Worker')));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }
        $device = $this->authorizeDevice($request, $deviceId);
        $limit = max(1, min(50, $request->integer('limit', 20)));
        $now = now();
        $items = PublisherPlatformJob::query()
            ->with(['distribution.article', 'session'])
            ->where(function ($query) use ($device): void {
                $query->whereNull('publisher_device_id')->orWhere('publisher_device_id', $device->id);
            })
            ->whereIn('status', ['queued', 'waiting_for_device', 'processing', 'claimed'])
            ->where(function ($query) use ($now, $device): void {
                $query->whereIn('status', ['queued', 'waiting_for_device'])
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
        $deviceId = trim((string) ($request->header('X-Publisher-Worker') ?: $request->input('device_id')));
        if ($deviceId === '') {
            throw new ApiException('publisher_device_required', '缺少发布节点标识。', 401);
        }
        $device = $this->authorizeDevice($request, $deviceId);

        $claimed = DB::transaction(function () use ($job, $device): PublisherPlatformJob {
            /** @var PublisherPlatformJob|null $item */
            $item = PublisherPlatformJob::query()
                ->with(['distribution.article', 'session'])
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

            // A profile is a strict serialization boundary.  Different
            // account groups may run concurrently, but one profile never does.
            if ($this->profileHasActiveLease($item, $device)) {
                throw new ApiException('publisher_profile_busy', '该账号资料正在执行其他平台任务。', 409);
            }

            $item->forceFill([
                'publisher_device_id' => $device->id,
                'status' => 'processing',
                'attempt_count' => (int) $item->attempt_count + 1,
                'claimed_at' => $item->claimed_at ?? $now,
                'claimed_by' => $device->device_id,
                'lease_token' => bin2hex(random_bytes(32)),
                'lease_expires_at' => $now->copy()->addMinutes($this->leaseMinutes()),
                'lease_heartbeat_at' => $now,
                'started_at' => $item->started_at ?? $now,
                'last_progress_at' => $now,
                'progress_step' => $item->progress_step ?: '已领取，等待本地执行器处理',
            ])->save();

            return $item->fresh(['distribution.article', 'session']);
        });

        return $this->success($request, [
            'job' => $this->serializeJob($claimed, true),
            'lease_token' => $claimed->lease_token,
            'lease_expires_at' => $claimed->lease_expires_at?->toIso8601String(),
        ]);
    }

    public function heartbeat(Request $request, int $job): JsonResponse
    {
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

            return $item->fresh(['distribution.article', 'session']);
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
        $terminal = in_array($status, PublisherPlatformJob::TERMINAL_STATUSES, true);
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

        $updated = DB::transaction(function () use ($job, $device, $lease, $status, $terminal, $result, $message, $remoteUrl, $failureCategory, $nextOperatorAction, $progressStep, $progressPercent): array {
            $item = $this->lockedJob($job, $device, $lease);
            if ($item->isTerminal() && (string) $item->status !== $status) {
                throw new ApiException('publisher_platform_job_completed', '平台子任务已完成，不能用旧租约改写结果。', 409);
            }
            $now = now();
            $needsAttention = in_array($status, ['failed', 'login_required', 'verification_required', 'awaiting_confirmation'], true);
            $item->forceFill([
                'status' => $status,
                'progress_step' => $progressStep ?? $item->progress_step,
                'progress_percent' => $progressPercent ?? ($terminal ? 100 : $item->progress_percent),
                'remote_url' => $remoteUrl !== '' ? $remoteUrl : $item->remote_url,
                'error_category' => $status === 'failed' || $status === 'verification_required' ? $failureCategory : null,
                'error_message' => $needsAttention ? ($message !== '' ? $message : $item->error_message) : null,
                'next_operator_action' => $nextOperatorAction,
                'result' => array_replace($this->sanitizeResult(is_array($item->result) ? $item->result : []), $result),
                'last_progress_at' => $now,
                'finished_at' => $terminal ? ($item->finished_at ?? $now) : null,
                // Retain the token for duplicate delivery checks; expiration
                // still blocks stale workers after a non-terminal lease.
                'lease_expires_at' => $terminal ? null : $now->copy()->addMinutes($this->leaseMinutes()),
                'lease_heartbeat_at' => $now,
            ])->save();

            $distribution = $item->distribution()->lockForUpdate()->firstOrFail();
            $summary = $this->summary->refresh($distribution);

            return [
                'job' => $item->fresh(['distribution.article', 'session']),
                'batch' => $summary,
            ];
        });

        return $this->success($request, [
            'job' => $this->serializeJob($updated['job']),
            'batch' => $updated['batch'],
            'device_id' => $device->device_id,
        ]);
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
        $secret = trim((string) ($record->public_key ?? ''));
        if ($token === '' || $secret === '' || ! hash_equals($secret, $token)) {
            throw new ApiException('publisher_device_unauthorized', '设备凭证无效，请重新配对。', 401);
        }

        return $record;
    }

    private function leaseMinutes(): int
    {
        return max(1, (int) config('publishing.job_lease_minutes', 15));
    }

    private function canDeviceRun(PublisherPlatformJob $job, PublisherDevice $device): bool
    {
        $capabilities = is_array($device->capabilities) ? $device->capabilities : [];
        $platformId = (string) $job->platform_id;
        if ($capabilities !== [] && ! in_array($platformId, $capabilities, true)) {
            return false;
        }
        $session = $job->session;
        if ($session && (int) $session->publisher_device_id !== (int) $device->id) {
            return false;
        }
        if ($session && ! in_array((string) $session->login_state, ['ready', 'open'], true)
            && ! in_array((string) $job->status, ['waiting_for_device'], true)) {
            return false;
        }

        return true;
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
            ->exists();
    }

    /** @return array<string,mixed> */
    private function serializeJob(PublisherPlatformJob $job, bool $includeLease = false): array
    {
        $distribution = $job->distribution;
        $article = $distribution?->article;
        $payload = is_array($job->payload_snapshot) ? $job->payload_snapshot : [];
        $result = $this->sanitizeResult(is_array($job->result) ? $job->result : []);
        $data = [
            'id' => (int) $job->id,
            'article_distribution_id' => (int) $job->article_distribution_id,
            'distribution_id' => (int) $job->article_distribution_id,
            'platform_id' => (string) $job->platform_id,
            'publisher_device_id' => $job->publisher_device_id !== null ? (int) $job->publisher_device_id : null,
            'publisher_platform_session_id' => $job->publisher_platform_session_id !== null ? (int) $job->publisher_platform_session_id : null,
            'profile_key' => $job->profile_key,
            'publish_mode' => (string) $job->publish_mode,
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
