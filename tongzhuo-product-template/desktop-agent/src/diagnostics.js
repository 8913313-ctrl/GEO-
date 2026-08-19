import os from 'node:os';
import { runnablePlatformIds } from './platforms.js';
import { agentName, agentVersion } from './version.js';

function check(id, label, state, message, meta = {}) {
  return { id, label, state, message, meta };
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isRecentHeartbeat(value, windowMs = 120000) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= windowMs;
}

function summarize(checks) {
  if (checks.some((item) => item.state === 'error')) return 'error';
  if (checks.some((item) => item.state === 'warn')) return 'warn';
  return 'ok';
}

function authToken(status = {}) {
  return String(status.pairingToken || status.apiToken || status.deviceSecret || '').trim();
}

export function buildLocalDiagnostics(status = {}, platformCatalog = []) {
  const baseUrl = normalizeBaseUrl(status.geoflowBaseUrl);
  const hasValidBaseUrl = /^https?:\/\/[^/\s]+/i.test(baseUrl);
  const capabilities = Array.isArray(status.capabilities) ? status.capabilities : [];
  const executable = capabilities.filter((id) => runnablePlatformIds.includes(id));
  const configuredPlatforms = capabilities
    .map((id) => platformCatalog.find((platform) => platform.id === id)?.name || id)
    .filter(Boolean);
  const hasCredential = Boolean(status.hasCredential ?? status.hasToken ?? status.hasDeviceCredential ?? false);

  const checks = [
    check('local_service', '本地服务', 'ok', `本地节点正在 127.0.0.1:${status.port || 19380} 运行。`),
    hasValidBaseUrl
      ? check('geoflow_url', 'GEOFlow 地址', 'ok', baseUrl)
      : check('geoflow_url', 'GEOFlow 地址', 'error', '请填写以 http:// 或 https:// 开头的 GEOFlow 地址。'),
    hasCredential
      ? check('api_token', '设备凭证', 'ok', '设备已具备连接凭证，可以向后台心跳、读取任务和回写状态。')
      : check('api_token', '设备凭证', 'warn', '尚未完成设备绑定。请在后台生成配对码后绑定。'),
    status.deviceId
      ? check('device_id', '设备 ID', 'ok', String(status.deviceId))
      : check('device_id', '设备 ID', 'warn', '设备 ID 尚未生成，请保存一次配置。'),
    isRecentHeartbeat(status.lastHeartbeatAt)
      ? check('heartbeat', '最近心跳', 'ok', `最近心跳：${status.lastHeartbeatAt}`)
      : check('heartbeat', '最近心跳', 'warn', status.lastHeartbeatAt ? `心跳较久未更新：${status.lastHeartbeatAt}` : '尚未向 GEOFlow 上报心跳。'),
    executable.length > 0
      ? check('capabilities', '可执行平台', 'ok', `已启用 ${executable.length} 个本地处理能力；只有取得平台成功回执才会标记为已发布。`, { capabilities, configuredPlatforms })
      : check('capabilities', '可执行平台', 'error', '没有启用任何可执行平台，请至少保留一个已接入平台或本地导出。', { capabilities, configuredPlatforms }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: summarize(checks),
    checks,
    runtime: {
      agentName,
      agentVersion,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      user: os.userInfo().username,
    },
  };
}

export async function probeGeoFlow(status = {}, timeoutMs = 4000) {
  const baseUrl = normalizeBaseUrl(status.geoflowBaseUrl);
  if (!/^https?:\/\/[^/\s]+/i.test(baseUrl)) {
    return check('geoflow_probe', '后台连通性', 'error', 'GEOFlow 地址格式不正确，已跳过连通性探测。');
  }
  if (!status.hasCredential) {
    return check('geoflow_probe', '后台连通性', 'warn', '尚未完成绑定，已跳过鉴权探测。');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetch(`${baseUrl}/api/v1/publisher/jobs?limit=1`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authToken(status)}`,
        'X-Publisher-Worker': status.deviceId || 'diagnostics',
      },
      signal: controller.signal,
    });
    if (response.ok) {
      return check('geoflow_probe', '后台连通性', 'ok', `GEOFlow 接口可访问：HTTP ${response.status}`);
    }
    return check('geoflow_probe', '后台连通性', 'error', `GEOFlow 返回 HTTP ${response.status}，请检查地址、凭证或服务器状态。`);
  } catch (error) {
    return check('geoflow_probe', '后台连通性', 'error', `无法连接 GEOFlow：${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function buildDiagnostics(status = {}, platformCatalog = [], options = {}) {
  const diagnostics = buildLocalDiagnostics(status, platformCatalog);
  if (options.probe) {
    diagnostics.checks.push(await probeGeoFlow(status, options.timeoutMs || 4000));
    diagnostics.summary = summarize(diagnostics.checks);
  }
  return diagnostics;
}

export function sanitizeStatus(status = {}) {
  return {
    deviceId: status.deviceId || '',
    deviceName: status.deviceName || '',
    agentVersion: status.agentVersion || agentVersion,
    geoflowBaseUrl: normalizeBaseUrl(status.geoflowBaseUrl),
    hasToken: Boolean(status.hasToken),
    hasPairingToken: Boolean(status.hasPairingToken),
    hasDeviceCredential: Boolean(status.hasDeviceCredential),
    hasCredential: Boolean(status.hasCredential ?? status.hasToken ?? status.hasPairingToken ?? status.hasDeviceCredential),
    isPaired: Boolean(status.isPaired),
    connectionMode: status.connectionMode || 'token',
    port: status.port || 19380,
    autoRun: Boolean(status.autoRun),
    pollSeconds: status.pollSeconds,
    maxJobAttempts: status.maxJobAttempts,
    capabilities: Array.isArray(status.capabilities) ? status.capabilities : [],
    sessions: Array.isArray(status.sessions) ? status.sessions : [],
    activeJobId: status.activeJobId || null,
    lastPollAt: status.lastPollAt || null,
    lastHeartbeatAt: status.lastHeartbeatAt || null,
    lastError: status.lastError || null,
    jobCount: Array.isArray(status.jobs) ? status.jobs.length : 0,
  };
}
function redactUrl(value) {
  const raw = String(value || '');
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|cookie|password|secret|authorization|signature|sig|key/i.test(key)) url.searchParams.set(key, '[redacted]');
    }
    url.hash = '';
    return url.toString();
  } catch {
    return raw.replace(/([?&](?:token|cookie|password|secret|authorization|signature|sig|key)=[^&#\s]+)/gi, '$1[redacted]');
  }
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/token|cookie|password|secret|authorization/i.test(key)) {
      return [key, '[redacted]'];
    }
    if (/(?:url|uri|href)$/i.test(key) && typeof item === 'string') return [key, redactUrl(item)];
    return [key, redactSensitive(item)];
  }));
}

export function buildSupportBundle(status = {}, diagnostics = {}, platformCatalog = []) {
  const logs = Array.isArray(status.logs) ? status.logs : [];
  return {
    product: agentName,
    version: agentVersion,
    generatedAt: new Date().toISOString(),
    status: sanitizeStatus(status),
    diagnostics,
    platforms: platformCatalog.map((platform) => ({
      id: platform.id,
      name: platform.name,
      support: platform.support,
    })),
    logs: logs.slice(0, 200).map((log) => ({
      at: log.at,
      level: log.level,
      event: log.event,
      message: log.message,
      context: redactSensitive(log.context || {}),
    })),
    security: {
      excludesApiToken: true,
      excludesCookies: true,
      excludesBrowserProfiles: true,
      excludesPlatformPasswords: true,
    },
  };
}
