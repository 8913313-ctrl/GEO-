import { agentVersion } from './version.js';

export class GeoFlowRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GeoFlowRequestError';
    this.status = Number(options.status || 0) || null;
    this.code = String(options.code || '').trim() || null;
    this.route = String(options.route || '').trim() || null;
    this.details = options.details ?? null;
  }
}

export function isInvalidPairingResponse(error) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if ([
    'PUBLISHER_AUTH_REQUIRED',
    'PUBLISHER_DEVICE_NOT_FOUND',
    'PUBLISHER_DEVICE_UNAUTHORIZED',
    'PUBLISHER_PAIRING_REQUIRED',
    'DEVICE_NOT_FOUND',
    'PAIRING_REQUIRED',
  ].includes(code)) return true;
  // A missing route, an expired TLS certificate or a generic HTTP error must
  // stay visible as a connection problem instead of erasing local pairing.
  return /(publisher\s+device\s+(not\s+found|unauthorized)|publisher.*not\s+paired|pairing.*required|设备不存在|设备凭证无效|未完成配对|尚未配对|需要重新配对)/i.test(String(error.message || ''));
}

const retryableStatuses = new Set([408, 425, 429]);
const retryableMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sleep(milliseconds) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function crashTelemetry(environment = process.env, now = Date.now()) {
  const windowSeconds = boundedInteger(environment.TZ_AGENT_CRASH_WINDOW_SECONDS, 0, 0, 24 * 60 * 60);
  const fallbackCount = boundedInteger(environment.TZ_AGENT_CRASH_COUNT, 0, 0, 10000);
  const timestamps = String(environment.TZ_AGENT_CRASH_TIMESTAMPS || '')
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!windowSeconds || !timestamps.length) return { count: fallbackCount, windowSeconds };
  const cutoff = Number(now) - (windowSeconds * 1000);
  return {
    count: timestamps.filter((timestamp) => timestamp >= cutoff && timestamp <= Number(now) + 60000).length,
    windowSeconds,
  };
}
export function isRetryableGeoFlowError(error) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (['PUBLISHER_REQUEST_TIMEOUT', 'PUBLISHER_NETWORK_ERROR'].includes(code)) return true;
  const status = Number(error.status || 0);
  return retryableStatuses.has(status) || status >= 500;
}

async function fetchWithDeadline(url, init, timeoutMs, route) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let timeoutId = null;
  let externalAbortListener = null;
  const requestInit = { ...init, signal: controller.signal };
  const request = fetch(url, requestInit).then(async (response) => ({ response, text: await response.text() }));
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new GeoFlowRequestError(`GEOFlow request timed out after ${timeoutMs}ms`, {
        code: 'PUBLISHER_REQUEST_TIMEOUT',
        route,
      }));
    }, timeoutMs);
  });
  const externalAbort = externalSignal
    ? new Promise((_, reject) => {
      externalAbortListener = () => {
        controller.abort(externalSignal.reason);
        reject(new GeoFlowRequestError('GEOFlow request was cancelled', {
          code: 'PUBLISHER_REQUEST_ABORTED',
          route,
        }));
      };
      if (externalSignal.aborted) externalAbortListener();
      else externalSignal.addEventListener('abort', externalAbortListener, { once: true });
    })
    : null;
  try {
    return await Promise.race([request, timeout, ...(externalAbort ? [externalAbort] : [])]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (externalSignal && externalAbortListener) externalSignal.removeEventListener('abort', externalAbortListener);
  }
}

export class GeoFlowClient {
  constructor(config, options = {}) {
    this.config = config;
    this.onInvalidPairing = typeof options.onInvalidPairing === 'function' ? options.onInvalidPairing : null;
  }

  updateConfig(config) {
    this.config = config;
  }

  authToken() {
    return String(this.config.pairingToken || this.config.apiToken || this.config.deviceSecret || '').trim();
  }

  endpoint(route) {
    const base = String(this.config.geoflowBaseUrl || '').replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) {
      throw new Error('GEOFlow 地址必须以 http:// 或 https:// 开头。');
    }
    return `${base}${route}`;
  }

  requestTimeoutMs(value) {
    return boundedInteger(value ?? this.config.requestTimeoutMs, 15000, 1, 120000);
  }

  requestRetries(value) {
    return boundedInteger(value ?? this.config.requestRetryCount, 2, 0, 5);
  }

  async request(route, options = {}) {
    const token = this.authToken();
    if (!token) {
      throw new Error('请先完成设备绑定或配置连接凭证。');
    }

    const {
      timeoutMs,
      retries,
      retryUnsafe = false,
      retryBaseDelayMs = 250,
      retryMaxDelayMs = 4000,
      signal,
      ...requestOptions
    } = options;
    const method = String(requestOptions.method || 'GET').toUpperCase();
    const retryAllowed = retryUnsafe === true || retryableMethods.has(method);
    const retryCount = retryAllowed ? this.requestRetries(retries) : 0;
    const deadline = this.requestTimeoutMs(timeoutMs);
    const baseDelay = boundedInteger(retryBaseDelayMs, 250, 0, 30000);
    const maximumDelay = boundedInteger(retryMaxDelayMs, 4000, 0, 60000);
    let latestError = null;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        const { response, text } = await fetchWithDeadline(this.endpoint(route), {
          ...requestOptions,
          signal,
          headers: {
            Accept: 'application/json',
            ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            'X-Publisher-Worker': this.config.deviceId,
            'X-Publisher-Connection-Mode': this.config.connectionMode || 'token',
            ...(requestOptions.headers || {}),
          },
          body: requestOptions.body && typeof requestOptions.body !== 'string' ? JSON.stringify(requestOptions.body) : requestOptions.body,
        }, deadline, route);
        let body = null;
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            body = { message: text };
          }
        }
        if (!response.ok) {
          throw new GeoFlowRequestError(
            body?.message || body?.error?.message || `GEOFlow request failed: ${response.status}`,
            {
              status: response.status,
              code: body?.code || body?.error?.code,
              route,
              details: body?.details || body?.error?.details,
            },
          );
        }
        return body;
      } catch (error) {
        const normalized = error instanceof GeoFlowRequestError
          ? error
          : new GeoFlowRequestError(`GEOFlow network request failed: ${error?.message || 'unknown error'}`, {
            code: 'PUBLISHER_NETWORK_ERROR',
            route,
          });
        if (isInvalidPairingResponse(normalized)) {
          this.onInvalidPairing?.(normalized);
          throw normalized;
        }
        latestError = normalized;
        if (!isRetryableGeoFlowError(normalized) || attempt >= retryCount) throw normalized;
        const delay = Math.min(maximumDelay, baseDelay * (2 ** attempt));
        await sleep(delay);
      }
    }
    throw latestError || new GeoFlowRequestError('GEOFlow request failed without a response', { route });
  }

  registerDevice() {
    return this.request('/api/v1/publisher/devices/register', {
      method: 'POST',
      body: {
        device_id: this.config.deviceId,
        name: this.config.deviceName,
        public_key: this.config.deviceSecret || '',
        device_secret: this.config.deviceSecret || '',
        pairing_code: this.config.pairingCode || '',
        connection_mode: this.config.connectionMode || 'token',
        capabilities: this.config.capabilities,
        meta: this.meta(),
      },
    });
  }

  shadowHeartbeat(reportedState = {}, extra = {}) {
    const route = `/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/shadow/heartbeat`;
    return this.request(route, {
      method: 'POST',
      retryUnsafe: true,
      body: {
        status: 'online',
        connection_mode: this.config.connectionMode || 'token',
        capabilities: this.config.capabilities,
        meta: { ...this.meta(), ...extra },
        reported_state: reportedState,
      },
    });
  }
  heartbeat(extra = {}) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/heartbeat`, {
      method: 'POST',
      retryUnsafe: true,
      body: {
        status: 'online',
        connection_mode: this.config.connectionMode || 'token',
        capabilities: this.config.capabilities,
        meta: { ...this.meta(), ...extra },
      },
    });
  }

  /**
   * Open the device-initiated Server-Sent Events wake-up stream. Event data
   * contains only state-change hints; protected task/config data is pulled
   * through the normal authenticated API afterwards.
   */
  async deviceEvents(options = {}) {
    const token = this.authToken();
    if (!token) throw new Error('Please pair this publisher device before opening the event stream.');
    const route = `/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/events`;
    let response;
    try {
      response = await fetch(this.endpoint(route), {
        method: 'GET',
        signal: options.signal,
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'X-Publisher-Worker': this.config.deviceId,
          'X-Publisher-Connection-Mode': this.config.connectionMode || 'token',
        },
      });
    } catch (error) {
      const aborted = options.signal?.aborted || error?.name === 'AbortError';
      const normalized = new GeoFlowRequestError(
        aborted ? 'Publisher event stream was cancelled' : `Publisher event stream connection failed: ${error?.message || 'unknown error'}`,
        { code: aborted ? 'PUBLISHER_REQUEST_ABORTED' : 'PUBLISHER_NETWORK_ERROR', route },
      );
      if (isInvalidPairingResponse(normalized)) this.onInvalidPairing?.(normalized);
      throw normalized;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
      const error = new GeoFlowRequestError(
        body?.message || body?.error?.message || `Publisher event stream failed: ${response.status}`,
        { status: response.status, code: body?.code || body?.error?.code, route, details: body?.details || body?.error?.details },
      );
      if (isInvalidPairingResponse(error)) this.onInvalidPairing?.(error);
      throw error;
    }

    const contentType = String(response.headers?.get?.('content-type') || '');
    if (!/text\/event-stream/i.test(contentType)) {
      const cancellation = response.body?.cancel?.();
      if (cancellation) await cancellation.catch(() => {});
      throw new GeoFlowRequestError('Publisher event endpoint did not return Server-Sent Events.', {
        code: 'PUBLISHER_EVENT_STREAM_INVALID',
        route,
      });
    }
    return response;
  }

  jobs(limit = 20) {
    return this.request(`/api/v1/publisher/jobs?limit=${limit}`);
  }

  claimJob(id) {
    return this.request(`/api/v1/publisher/jobs/${id}/claim`, { method: 'POST', body: {} }).then((response) => response?.data?.job || response?.data || response?.job || response);
  }

  reportResult(id, state, message = '', extra = {}) {
    return this.request(`/api/v1/publisher/jobs/${id}/result`, {
      method: 'POST',
      body: {
        state,
        worker_id: this.config.deviceId,
        message,
        ...extra,
      },
    });
  }


  platformJobs(limit = 20) {
    return this.request(`/api/v1/publisher/platform-jobs?limit=${Math.max(1, Math.min(50, Number(limit) || 20))}&leaseable=1`);
  }

  claimPlatformJob(id) {
    return this.request(`/api/v1/publisher/platform-jobs/${encodeURIComponent(id)}/claim`, { method: 'POST', body: {} })
      .then((response) => response?.data?.job || response?.job || response?.data || response);
  }

  heartbeatPlatformJob(id, leaseToken, progress = {}) {
    return this.request(`/api/v1/publisher/platform-jobs/${encodeURIComponent(id)}/heartbeat`, {
      method: 'POST',
      headers: { 'X-Publisher-Lease': leaseToken },
      body: { lease_token: leaseToken, ...progress },
    });
  }

  reportPlatformJobResult(id, leaseToken, status, result = {}) {
    return this.request(`/api/v1/publisher/platform-jobs/${encodeURIComponent(id)}/result`, {
      method: 'POST',
      headers: { 'X-Publisher-Lease': leaseToken },
      body: { lease_token: leaseToken, status, result, ...result },
    });
  }

  commands(limit = 20) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/commands?limit=${Math.max(1, Math.min(50, Number(limit) || 20))}`);
  }

  claimCommand(id) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/commands/${encodeURIComponent(id)}/claim`, { method: 'POST', body: {} })
      .then((response) => response?.data?.command || response?.command || response?.data || response);
  }

  ackCommand(id, leaseToken, status = 'completed', result = {}) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/commands/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      headers: { 'X-Publisher-Lease': leaseToken },
      body: { lease_token: leaseToken, status, result },
    });
  }
  reportSession(platformId, session = {}) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/sessions`, {
      method: 'POST',
      body: {
        platform_id: platformId,
        profile_key: session.profile_key || platformId,
        account_name: session.account_name || '',
        login_state: session.login_state || 'unknown',
        last_verified_at: session.last_verified_at || null,
        last_error_message: session.last_error_message || '',
        auto_allowed: Boolean(session.auto_allowed),
        meta: {
          ...session.meta,
          connection_mode: this.config.connectionMode || 'token',
          pairing_code: this.config.pairingCode || '',
        },
      },
    });
  }

  listSessions() {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/sessions`);
  }

  meta() {
    const crash = crashTelemetry();
    return {
      version: agentVersion,
      runtime: 'node',
      platform: process.platform,
      arch: process.arch,
      device_name: this.config.deviceName || '',
      connection_mode: this.config.connectionMode || 'token',
      pairing_code: this.config.pairingCode || '',
      paired_at: this.config.pairedAt || '',
      has_pairing_token: Boolean(this.config.pairingToken),
      has_api_token: Boolean(this.config.apiToken),
      crash_count_last_window: crash.count,
      crash_window_seconds: crash.windowSeconds,
      active_group_id: this.config.activeGroupId || '',
      account_groups: Array.isArray(this.config.accountGroups)
        ? this.config.accountGroups.map((group) => ({
          id: group.id,
          name: group.name,
          status: group.status,
          accounts: group.accounts || {},
          updatedAt: group.updatedAt || '',
        }))
        : [],
    };
  }
}
