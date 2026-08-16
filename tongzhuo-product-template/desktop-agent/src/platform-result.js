function selectedValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => String(item || '').trim()).filter(Boolean);
}

function selectorStep(name, value, result) {
  const selectors = selectedValues(value);
  const detail = result.selector_details?.[name] || result.selectorDetails?.[name] || {};
  const fillKey = name === 'draft_success' ? 'draft_saved' : name;
  const explicitMiss = Object.prototype.hasOwnProperty.call(result.selectors || {}, name)
    || result.fill?.[fillKey] === false;
  const failureLooksLikeSelector = result.state === 'failed'
    && /(selector|field|editor|action_not_found|success_not_confirmed)/i.test(String(result.failure_category || ''));
  const candidateIndex = Number(detail.candidate_index ?? detail.candidateIndex);
  const attempted = Number(detail.attempted);
  const candidateCount = Number(detail.candidate_count ?? detail.candidateCount);
  return {
    status: selectors.length ? 'hit' : (explicitMiss || failureLooksLikeSelector ? 'miss' : 'not_attempted'),
    selector: selectors[0] || null,
    selectors: selectors.length > 1 ? selectors : undefined,
    candidate_index: Number.isFinite(candidateIndex) ? candidateIndex : null,
    attempted: Number.isFinite(attempted) ? attempted : null,
    candidate_count: Number.isFinite(candidateCount) ? candidateCount : null,
  };
}

export function buildSelectorTelemetry(result = {}) {
  if (result.selector_telemetry && typeof result.selector_telemetry === 'object') return result.selector_telemetry;
  const selectors = result.selectors && typeof result.selectors === 'object' && !Array.isArray(result.selectors)
    ? result.selectors
    : {};
  const names = new Set([...Object.keys(selectors), ...Object.keys(result.selector_details || result.selectorDetails || {})]);
  if (!names.size) return null;
  const steps = Object.fromEntries([...names].map((name) => [name, selectorStep(name, selectors[name], result)]));
  return {
    schema_version: 1,
    adapter: String(result.adapter || result.adapter_name || result.adapterName || 'unknown'),
    platform_id: String(result.platformId || result.platform_id || result.platform || ''),
    state: String(result.state || 'unknown'),
    steps,
  };
}

export function serializePlatformResult(result = {}) {
  const payload = {
    state: result.state,
    remote_url: result.remote_url,
    message: result.message,
  };

  const explicitTelemetry = result.selector_telemetry || result.selectorTelemetry || result.telemetry;
  // Keep legacy callers byte-for-byte compatible. The browser entry point
  // decorates real adapter results with an adapter identity before calling us.
  const canBuildTelemetry = Boolean(result.adapter || result.adapter_name || result.adapterName
    || result.selector_details || result.selectorDetails);
  const selectorTelemetry = explicitTelemetry || (canBuildTelemetry ? buildSelectorTelemetry(result) : null);

  if (result.selectors) payload.selectors = result.selectors;
  if (selectorTelemetry) payload.selector_telemetry = selectorTelemetry;
  if (result.execution_mode) payload.execution_mode = result.execution_mode;
  if (result.next_action) payload.next_action = result.next_action;
  if (result.fill) payload.fill = result.fill;
  if (result.selector_details || result.selectorDetails) payload.selector_details = result.selector_details || result.selectorDetails;
  if (result.failure_category) payload.failure_category = result.failure_category;
  if (result.retryable !== undefined) payload.retryable = Boolean(result.retryable);
  if (result.verification_reason) payload.verification_reason = result.verification_reason;
  if (result.export_path) payload.export_path = result.export_path;
  if (Array.isArray(result.files)) payload.files = result.files;

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
