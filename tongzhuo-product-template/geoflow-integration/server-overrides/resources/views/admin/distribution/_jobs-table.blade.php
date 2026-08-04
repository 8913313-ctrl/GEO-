@if ($jobs->isEmpty())
    <div class="px-6 py-8 text-sm text-gray-500">{{ __('admin.distribution.empty_jobs') }}</div>
@else
    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.article') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.channel') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.action') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.status') }}</th>
                    <th class="min-w-[18rem] px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">发布助手</th>
                    <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.remote_url') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.attempt_count') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.distribution.field.last_error') }}</th>
                    <th class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ __('admin.common.actions') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                @foreach ($jobs as $job)
                    @php($statusClasses = [
                        'queued' => 'bg-blue-100 text-blue-800',
                        'sending' => 'bg-amber-100 text-amber-800',
                        'synced' => 'bg-green-100 text-green-800',
                        'failed' => 'bg-red-100 text-red-800',
                    ])
                    @php($jobActionKey = 'admin.distribution.action.'.(string) $job->action)
                    @php($jobActionLabel = trans()->has($jobActionKey) ? __($jobActionKey) : (string) $job->action)
                    @php($jobStatusKey = 'admin.distribution.job_status.'.(string) $job->status)
                    @php($jobStatusLabel = trans()->has($jobStatusKey) ? __($jobStatusKey) : (string) $job->status)
                    @php($isDeletedRemoteCopy = (string) $job->action === 'delete' && (string) $job->status === 'synced')
                    @php($isLocalPublisherJob = $job->channel?->isLocalPublisher() ?? false)
                    @php($isWechatSyncJob = $job->channel?->isWechatSyncManual() ?? false)
                    @php($assistant = method_exists($job, 'publisherAssistantMeta') ? $job->publisherAssistantMeta() : [])
                    @php($assistantState = (string) ($assistant['state'] ?? ''))
                    @php($assistantWorker = (string) ($assistant['worker_id'] ?? ''))
                    @php($platformResults = method_exists($job, 'publisherPlatformResults') ? $job->publisherPlatformResults() : (is_array($assistant['platform_results'] ?? null) ? $assistant['platform_results'] : []))
                    @php($hasUnconfirmedPlatform = collect($platformResults)->contains(function ($result): bool { $state = is_array($result) ? (string) ($result['state'] ?? '') : ''; return ! in_array($state, ['published', 'draft_saved'], true); }))
                    @php($effectiveAssistantState = $hasUnconfirmedPlatform && $assistantState === 'published' ? 'awaiting_confirmation' : $assistantState)
                    @php($stateSummary = method_exists($job, 'publisherStateSummary') ? $job->publisherStateSummary() : (is_array($assistant['state_summary'] ?? null) ? $assistant['state_summary'] : []))
                    @php($stateCounts = is_array($stateSummary['state_counts'] ?? null) ? $stateSummary['state_counts'] : [])
                    @php($nextOperatorAction = method_exists($job, 'publisherNextOperatorAction') ? $job->publisherNextOperatorAction() : (string) ($assistant['next_operator_action'] ?? ''))
                    @php($operatorConfirmations = method_exists($job, 'publisherOperatorConfirmations') ? $job->publisherOperatorConfirmations() : (is_array($assistant['operator_confirmations'] ?? null) ? $assistant['operator_confirmations'] : []))
                    @php($latestOperatorConfirmation = $operatorConfirmations !== [] ? end($operatorConfirmations) : null)
                    @php($lastError = $job->last_error_message ?: (string) ($assistant['last_error'] ?? ''))
                    @php($canRetryPublisherJob = $job->status === 'failed' || ($isLocalPublisherJob && in_array($nextOperatorAction, ['operator_inspect_failed_platforms', 'operator_login_or_verify_platform'], true)) || ($isLocalPublisherJob && $assistantState === 'failed'))
                    @php($assistantStateLabels = [
                        'processing' => '执行中',
                        'awaiting_confirmation' => '待人工确认',
                        'draft_saved' => '草稿已填充',
                        'published' => '已发布',
                        'failed' => '执行失败',
                        'cancelled' => '已取消',
                    ])
                    @php($operatorActionLabels = [
                        'operator_confirm_publish' => '下一步：人工确认发布',
                        'operator_login_or_verify_platform' => '下一步：本机登录/验证',
                        'operator_inspect_failed_platforms' => '下一步：查看失败并重试',
                        'none' => '无需处理',
                    ])
                    @php($operatorActionClasses = [
                        'operator_confirm_publish' => 'bg-indigo-50 text-indigo-700 ring-indigo-200',
                        'operator_login_or_verify_platform' => 'bg-amber-50 text-amber-700 ring-amber-200',
                        'operator_inspect_failed_platforms' => 'bg-red-50 text-red-700 ring-red-200',
                        'none' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                    ])
                    @php($assistantStateClasses = [
                        'processing' => 'bg-blue-50 text-blue-700 ring-blue-200',
                        'awaiting_confirmation' => 'bg-amber-50 text-amber-700 ring-amber-200',
                        'draft_saved' => 'bg-cyan-50 text-cyan-700 ring-cyan-200',
                        'published' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                        'failed' => 'bg-red-50 text-red-700 ring-red-200',
                        'cancelled' => 'bg-gray-100 text-gray-600 ring-gray-200',
                    ])
                    @php($platformStateLabels = [
                        'queued' => '排队',
                        'processing' => '执行中',
                        'awaiting_login' => '待登录',
                        'awaiting_confirmation' => '待确认',
                        'draft_saved' => '草稿',
                        'published' => '已发布',
                        'opened' => '已打开编辑器',
                        'failed' => '失败',
                    ])
                    @php($platformStateClasses = [
                        'queued' => 'bg-gray-100 text-gray-600',
                        'processing' => 'bg-blue-50 text-blue-700',
                        'awaiting_login' => 'bg-amber-50 text-amber-700',
                        'awaiting_confirmation' => 'bg-amber-50 text-amber-700',
                        'draft_saved' => 'bg-cyan-50 text-cyan-700',
                        'published' => 'bg-emerald-50 text-emerald-700',
                        'opened' => 'bg-amber-50 text-amber-700',
                        'failed' => 'bg-red-50 text-red-700',
                    ])
                    <tr>
                        <td class="min-w-[28rem] max-w-[42rem] break-words px-6 py-4 text-sm font-medium text-gray-900">{{ $job->article?->title ?? __('admin.common.none') }}</td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{{ $job->channel?->name ?? __('admin.common.none') }}</td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{{ $jobActionLabel }}</td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm">
                            <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium {{ $statusClasses[$job->status] ?? 'bg-gray-100 text-gray-700' }}">{{ $isLocalPublisherJob && $job->status === 'synced' ? '任务已送达' : $jobStatusLabel }}</span>
                        </td>
                        <td class="px-4 py-4 text-sm">
                            @if ($assistantState !== '' || $platformResults !== [])
                                <div class="space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        @if ($effectiveAssistantState !== '')
                                            <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 {{ $assistantStateClasses[$effectiveAssistantState] ?? 'bg-gray-100 text-gray-700 ring-gray-200' }}">
                                                {{ $assistantStateLabels[$effectiveAssistantState] ?? $effectiveAssistantState }}
                                            </span>
                                        @endif
                                        @if ($assistantWorker !== '')
                                            <span class="font-mono text-xs text-gray-400">{{ $assistantWorker }}</span>
                                        @endif
                                        @if ($nextOperatorAction !== '')
                                            <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 {{ $operatorActionClasses[$nextOperatorAction] ?? 'bg-gray-100 text-gray-700 ring-gray-200' }}">
                                                {{ $operatorActionLabels[$nextOperatorAction] ?? $nextOperatorAction }}
                                            </span>
                                        @endif
                                    </div>
                                    @if ($stateCounts !== [])
                                        <div class="flex flex-wrap gap-1.5 text-xs text-gray-500">
                                            @foreach ($stateCounts as $stateName => $count)
                                                <span class="rounded bg-gray-50 px-2 py-1 ring-1 ring-gray-200">
                                                    {{ $platformStateLabels[$stateName] ?? $stateName }}：{{ (int) $count }}
                                                </span>
                                            @endforeach
                                        </div>
                                    @endif
                                    @if ($platformResults !== [])
                                        <div class="flex max-w-md flex-wrap gap-1.5">
                                            @foreach ($platformResults as $platformId => $platformResult)
                                                @php($platformState = is_array($platformResult) ? (string) ($platformResult['state'] ?? '') : '')
                                                @php($platformError = is_array($platformResult) ? (string) ($platformResult['error'] ?? $platformResult['message'] ?? '') : '')
                                                @php($platformUrl = is_array($platformResult) ? (string) ($platformResult['remote_url'] ?? '') : '')
                                                @php($exportPath = is_array($platformResult) ? (string) ($platformResult['export_path'] ?? '') : '')
                                                @php($failureCategory = is_array($platformResult) ? (string) ($platformResult['failure_category'] ?? '') : '')
                                                @php($attempt = is_array($platformResult) ? (int) ($platformResult['attempt'] ?? 0) : 0)
                                                @php($maxAttempts = is_array($platformResult) ? (int) ($platformResult['max_attempts'] ?? 0) : 0)
                                                <span class="inline-flex max-w-full items-center gap-1 rounded px-2 py-1 text-xs {{ $platformStateClasses[$platformState] ?? 'bg-gray-100 text-gray-600' }}" title="{{ $platformError }}">
                                                    <span class="font-medium">{{ $platformId }}</span>
                                                    <span>{{ $platformStateLabels[$platformState] ?? ($platformState !== '' ? $platformState : '未知') }}</span>
                                                    @if ($attempt > 0)
                                                        <span class="text-[10px] opacity-70">{{ $attempt }}{{ $maxAttempts > 0 ? '/'.$maxAttempts : '' }}</span>
                                                    @endif
                                                    @if ($platformUrl !== '')
                                                        <a href="{{ $platformUrl }}" target="_blank" rel="noopener noreferrer" class="text-blue-700 underline">打开</a>
                                                    @endif
                                                </span>
                                                @if ($failureCategory !== '')
                                                    <span class="inline-flex max-w-full items-center rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                                        {{ $platformId }}：{{ $failureCategory }}
                                                    </span>
                                                @endif
                                                @if ($exportPath !== '')
                                                    <code class="block w-full break-all rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-500">导出目录：{{ $exportPath }}</code>
                                                @endif
                                            @endforeach
                                        </div>
                                    @endif
                                    @if ($lastError !== '')
                                        <div class="text-xs text-red-600">{{ $lastError }}</div>
                                    @endif
                                    @if (is_array($latestOperatorConfirmation))
                                        <div class="rounded bg-gray-50 px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-200">
                                            人工记录：{{ (string) ($latestOperatorConfirmation['state'] ?? '') }}
                                            @if (! empty($latestOperatorConfirmation['platform']))
                                                / {{ (string) $latestOperatorConfirmation['platform'] }}
                                            @endif
                                            @if (! empty($latestOperatorConfirmation['message']))
                                                - {{ (string) $latestOperatorConfirmation['message'] }}
                                            @endif
                                        </div>
                                    @endif
                                </div>
                            @elseif ($isLocalPublisherJob)
                                <span class="text-gray-400">等待本地执行器领取</span>
                            @else
                                <span class="text-gray-400">{{ __('admin.common.none') }}</span>
                            @endif
                        </td>
                        <td class="min-w-[18rem] max-w-[30rem] px-4 py-4 text-sm">
                            @if ($isWechatSyncJob && (string) $job->action !== 'delete')
                                <span class="inline-flex rounded-full bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-800">{{ __('admin.distribution.wechatsync.package_ready') }}</span>
                            @elseif ($isLocalPublisherJob && (string) $job->action !== 'delete')
                                <span class="inline-flex rounded-full bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-800">等待本地发布助手</span>
                            @elseif ($job->remote_url)
                                <a href="{{ $job->remote_url }}" target="_blank" rel="noopener noreferrer" class="break-all text-blue-600 hover:text-blue-800">{{ $job->remote_url }}</a>
                            @else
                                <span class="text-gray-400">{{ __('admin.common.none') }}</span>
                            @endif
                        </td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{{ (int) $job->attempt_count }}</td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{{ $lastError !== '' ? $lastError : __('admin.common.none') }}</td>
                        <td class="whitespace-nowrap px-4 py-4 text-sm text-gray-600" data-distribution-delete-status>
                            <div class="flex flex-wrap items-center gap-3">
                            @if ($isDeletedRemoteCopy)
                                <span class="text-gray-400">{{ __('admin.distribution.job_state.remote_copy_deleted') }}</span>
                            @elseif ($isWechatSyncJob && $job->article && (string) $job->action !== 'delete')
                                <a href="{{ route('admin.distribution.wechatsync-package', ['distributionId' => (int) $job->id]) }}" class="text-cyan-700 hover:text-cyan-900">{{ __('admin.distribution.button.download_wechat_sync_package') }}</a>
                                <a href="{{ route('admin.distribution.article.edit', ['distributionId' => (int) $job->id]) }}" class="text-blue-600 hover:text-blue-800">{{ __('admin.distribution.button.edit_publish_package') }}</a>
                            @elseif ($isLocalPublisherJob && $job->article && (string) $job->action !== 'delete')
                                <a href="{{ route('admin.distribution.article.edit', ['distributionId' => (int) $job->id]) }}" class="text-blue-600 hover:text-blue-800">{{ __('admin.distribution.button.edit_publish_package') }}</a>
                                @if (in_array($assistantState, ['awaiting_confirmation', 'draft_saved', 'failed'], true) || in_array($nextOperatorAction, ['operator_confirm_publish', 'operator_login_or_verify_platform', 'operator_inspect_failed_platforms'], true))
                                    <details class="w-full min-w-[18rem] rounded border border-gray-200 bg-gray-50 px-3 py-2">
                                        <summary class="cursor-pointer text-xs font-medium text-gray-700">记录人工处理结果</summary>
                                        <div class="mt-3 space-y-3">
                                            <form method="POST" action="{{ route('admin.distribution.publisher.confirm', ['distributionId' => (int) $job->id]) }}" class="space-y-2">
                                                @csrf
                                                <input type="text" name="platform" value="" placeholder="平台ID，可留空" class="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                                <input type="url" name="remote_url" value="{{ $job->remote_url }}" placeholder="已发布链接，可选" class="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                                <input type="text" name="note" value="" placeholder="确认备注，可选" class="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                                <button type="submit" class="inline-flex rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">确认已发布</button>
                                            </form>
                                            <form method="POST" action="{{ route('admin.distribution.publisher.fail', ['distributionId' => (int) $job->id]) }}" class="space-y-2 border-t border-gray-200 pt-3">
                                                @csrf
                                                <input type="text" name="platform" value="" placeholder="平台ID，可留空" class="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                                <input type="text" name="failure_reason" required placeholder="失败原因" class="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                                <button type="submit" class="inline-flex rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700">记录失败</button>
                                            </form>
                                        </div>
                                    </details>
                                @endif
                            @elseif ($job->article)
                                <a href="{{ route('admin.distribution.article.edit', ['distributionId' => (int) $job->id]) }}" class="text-blue-600 hover:text-blue-800">{{ __('admin.distribution.button.edit_remote_article') }}</a>
                                <form method="POST" action="{{ route('admin.distribution.article.delete', ['distributionId' => (int) $job->id]) }}" data-distribution-delete-form data-confirm-message="{{ __('admin.articles.confirm.delete_title') }}" data-deleting-label="{{ __('admin.distribution.job_state.remote_copy_deleting') }}" data-deleted-label="{{ __('admin.distribution.job_state.remote_copy_deleted') }}">
                                    @csrf
                                    <button type="submit" class="text-red-600 hover:text-red-800">{{ __('admin.distribution.button.delete_remote_article') }}</button>
                                </form>
                            @endif
                            @if ($canRetryPublisherJob)
                                <form method="POST" action="{{ route('admin.distribution.retry', ['distributionId' => (int) $job->id]) }}">
                                    @csrf
                                    <button type="submit" class="text-blue-600 hover:text-blue-800">{{ __('admin.distribution.button.retry') }}</button>
                                </form>
                            @endif
                            @if (! $job->article && $job->status !== 'failed')
                                <span class="text-gray-400">{{ __('admin.common.none') }}</span>
                            @endif
                            </div>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @if (method_exists($jobs, 'links') && ($jobs->lastPage() ?? 1) > 1)
        <div class="border-t border-gray-200 px-6 py-4">
            {{ $jobs->links() }}
        </div>
    @endif
@endif

@once
    @push('scripts')
        <script>
            document.addEventListener('submit', async (event) => {
                const form = event.target.closest('[data-distribution-delete-form]');
                if (! form) return;

                event.preventDefault();

                const confirmMessage = form.dataset.confirmMessage || '';
                if (confirmMessage && ! window.confirm(confirmMessage)) return;

                const button = form.querySelector('button[type="submit"]');
                const statusCell = form.closest('[data-distribution-delete-status]');
                const deletedLabel = form.dataset.deletedLabel || '';
                const deletingLabel = form.dataset.deletingLabel || '';
                if (button) {
                    button.disabled = true;
                    button.classList.add('opacity-50', 'cursor-not-allowed');
                    if (deletingLabel) button.textContent = deletingLabel;
                }

                try {
                    const response = await fetch(form.action, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: new FormData(form),
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (! response.ok || ! payload.ok) {
                        throw new Error(payload.message || 'delete failed');
                    }

                    if (statusCell && deletedLabel) {
                        statusCell.innerHTML = `<span class="text-gray-400">${deletedLabel}</span>`;
                    }
                } catch (error) {
                    if (button) {
                        button.disabled = false;
                        button.classList.remove('opacity-50', 'cursor-not-allowed');
                        button.textContent = @js(__('admin.distribution.button.delete_remote_article'));
                    }
                    console.error(error);
                }
            });
        </script>
    @endpush
@endonce
