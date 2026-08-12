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

  async request(route, options = {}) {
    const token = this.authToken();
    if (!token) {
      throw new Error('请先完成设备绑定或配置连接凭证。');
    }

    const response = await fetch(this.endpoint(route), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        'X-Publisher-Worker': this.config.deviceId,
        'X-Publisher-Connection-Mode': this.config.connectionMode || 'token',
        ...(options.headers || {}),
      },
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    });

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }

    if (!response.ok) {
      const error = new GeoFlowRequestError(
        body?.message || body?.error?.message || `GEOFlow request failed: ${response.status}`,
        {
          status: response.status,
          code: body?.code || body?.error?.code,
          route,
          details: body?.details || body?.error?.details,
        },
      );
      if (isInvalidPairingResponse(error)) this.onInvalidPairing?.(error);
      throw error;
    }

    return body;
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

  heartbeat(extra = {}) {
    return this.request(`/api/v1/publisher/devices/${encodeURIComponent(this.config.deviceId)}/heartbeat`, {
      method: 'POST',
      body: {
        status: 'online',
        connection_mode: this.config.connectionMode || 'token',
        capabilities: this.config.capabilities,
        meta: { ...this.meta(), ...extra },
      },
    });
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
