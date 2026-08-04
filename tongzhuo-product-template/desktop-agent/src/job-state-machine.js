// Top-level job states that the desktop agent actively writes back.  Platform
// details may additionally contain awaiting_login so the backend can identify
// exactly which account needs a local verification.
export const serverResultStates = Object.freeze([
  'draft_saved',
  'published',
  'failed',
  'cancelled',
]);

export const operatorActions = Object.freeze({
  none: 'none',
  loginRequired: 'operator_login_or_verify_platform',
  inspectFailure: 'operator_inspect_failed_platforms',
  retryPlatform: 'retry_platform',
});

const transientPatterns = [
  /timeout/i,
  /timed out/i,
  /net::/i,
  /network/i,
  /socket/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ERR_/i,
];

const localActionPatterns = [
  /login/i,
  /captcha/i,
  /verify/i,
  /verification/i,
  /risk/i,
  /forbidden/i,
  /unauthorized/i,
  /403/,
  /401/,
  /登录/,
  /验证码/,
  /验证/,
  /风控/,
  /安全/,
  /访问受限/,
];

export function classifyExecutionError(error) {
  const message = String(error?.message || error || '').trim();
  if (!message) return { category: 'unknown', retryable: false };
  if (localActionPatterns.some((pattern) => pattern.test(message))) {
    return { category: 'operator_action_required', retryable: false };
  }
  if (transientPatterns.some((pattern) => pattern.test(message))) {
    return { category: 'transient_runtime_error', retryable: true };
  }
  return { category: 'adapter_runtime_error', retryable: false };
}

export function retryDecision(error, attempt, maxAttempts = 1) {
  const classification = classifyExecutionError(error);
  const attemptsAllowed = Math.max(1, Number(maxAttempts) || 1);
  const shouldRetry = classification.retryable && Number(attempt) < attemptsAllowed;
  return {
    ...classification,
    attempt: Number(attempt) || 1,
    max_attempts: attemptsAllowed,
    should_retry: shouldRetry,
    next_action: shouldRetry
      ? operatorActions.retryPlatform
      : classification.category === 'operator_action_required'
        ? operatorActions.loginRequired
        : operatorActions.inspectFailure,
  };
}

export function normalizePlatformResults(results = {}) {
  if (Array.isArray(results)) {
    return Object.fromEntries(results
      .filter((item) => item?.platform)
      .map((item) => [item.platform, { ...item }]));
  }
  return Object.fromEntries(Object.entries(results || {}).map(([platform, result]) => [
    platform,
    { platform, ...(result || {}) },
  ]));
}

/**
 * The worker must never collapse a mixed outcome into "awaiting confirmation".
 * A fully automated run is either completed (published/draft_saved) or failed,
 * while platform_results retain the granular reason and retry target.
 */
export function summarizePlatformResults(results = {}) {
  const normalized = normalizePlatformResults(results);
  const entries = Object.entries(normalized);
  const states = entries.map(([, result]) => String(result.state || 'failed'));
  const stateCounts = states.reduce((counts, state) => {
    counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, {});
  const loginRequiredPlatforms = entries
    .filter(([, result]) => ['awaiting_login', 'login_required', 'needs_verification', 'needs_captcha'].includes(String(result.state || '')))
    .map(([platform]) => platform);
  const legacyConfirmationPlatforms = entries
    .filter(([, result]) => String(result.state || '') === 'awaiting_confirmation')
    .map(([platform]) => platform);
  const failedPlatforms = entries
    .filter(([, result]) => ['failed', 'cancelled'].includes(String(result.state || '')))
    .map(([platform]) => platform);
  const unresolvedPlatforms = [...new Set([...loginRequiredPlatforms, ...legacyConfirmationPlatforms, ...failedPlatforms])];
  const publishedPlatforms = entries
    .filter(([, result]) => String(result.state || '') === 'published')
    .map(([platform]) => platform);
  const draftSavedPlatforms = entries
    .filter(([, result]) => String(result.state || '') === 'draft_saved')
    .map(([platform]) => platform);

  const hasResults = entries.length > 0;
  const allPublished = hasResults && states.every((state) => state === 'published');
  const allCancelled = hasResults && states.every((state) => state === 'cancelled');
  const hasUnresolved = unresolvedPlatforms.length > 0;
  const hasSuccessfulResult = publishedPlatforms.length > 0 || draftSavedPlatforms.length > 0;

  let state = 'failed';
  let operatorAction = operatorActions.inspectFailure;
  let message = 'Desktop agent could not complete any target platform. Review the platform results and retry after fixing the cause.';

  if (allCancelled) {
    state = 'cancelled';
    operatorAction = operatorActions.none;
    message = 'Desktop agent cancelled all target platform operations.';
  } else if (hasUnresolved) {
    state = 'failed';
    operatorAction = loginRequiredPlatforms.length ? operatorActions.loginRequired : operatorActions.inspectFailure;
    message = loginRequiredPlatforms.length
      ? 'Some platforms require local login, captcha, or risk verification before automatic execution can continue.'
      : 'Some platforms did not return a verified save or publish result. Review the failed platform results and retry.';
  } else if (allPublished) {
    state = 'published';
    operatorAction = operatorActions.none;
    message = 'Desktop agent confirmed publishing on all target platforms.';
  } else if (hasSuccessfulResult) {
    // A draft result is a completed automatic save, but it is deliberately not
    // reported as a public publish.  A mix of published and drafts therefore
    // remains draft_saved at the top level with exact counts below.
    state = 'draft_saved';
    operatorAction = operatorActions.none;
    message = publishedPlatforms.length
      ? 'Desktop agent completed automatic processing: some platforms confirmed publishing and the remaining platforms confirmed draft saves.'
      : 'Desktop agent confirmed draft saves on all target platforms.';
  }

  return {
    state,
    message,
    operator_action: operatorAction,
    state_counts: stateCounts,
    failed_platforms: failedPlatforms,
    unresolved_platforms: unresolvedPlatforms,
    login_required_platforms: loginRequiredPlatforms,
    published_platforms: publishedPlatforms,
    draft_saved_platforms: draftSavedPlatforms,
    total_platforms: entries.length,
  };
}

export function buildResultPayload({ workerId, platformResults, messagePrefix = '' } = {}) {
  const normalized = normalizePlatformResults(platformResults);
  const summary = summarizePlatformResults(normalized);
  const remoteUrl = Object.values(normalized).find((item) => item.remote_url)?.remote_url;
  const message = messagePrefix ? `${messagePrefix} ${summary.message}` : summary.message;
  return {
    state: summary.state,
    worker_id: workerId,
    message,
    remote_url: remoteUrl,
    platform_results: normalized,
    state_summary: summary,
    next_operator_action: summary.operator_action,
  };
}
