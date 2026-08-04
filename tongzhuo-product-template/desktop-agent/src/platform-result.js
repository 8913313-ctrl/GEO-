export function serializePlatformResult(result = {}) {
  const payload = {
    state: result.state,
    remote_url: result.remote_url,
    message: result.message,
  };

  if (result.selectors) payload.selectors = result.selectors;
  if (result.execution_mode) payload.execution_mode = result.execution_mode;
  if (result.next_action) payload.next_action = result.next_action;
  if (result.fill) payload.fill = result.fill;
  if (result.failure_category) payload.failure_category = result.failure_category;
  if (result.retryable !== undefined) payload.retryable = Boolean(result.retryable);
  if (result.verification_reason) payload.verification_reason = result.verification_reason;
  if (result.export_path) payload.export_path = result.export_path;
  if (Array.isArray(result.files)) payload.files = result.files;

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
