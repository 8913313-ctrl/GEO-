import { EventEmitter } from 'node:events';
import { readConfig, writeConfig } from './config-store.js';
import { GeoFlowClient } from './geoflow-client.js';
import { RuntimeLogBuffer } from './log-buffer.js';
import { PlatformBrowser } from './platform-browser.js';
import { serializePlatformResult } from './platform-result.js';
import { buildResultPayload, retryDecision } from './job-state-machine.js';
import { buildDiagnostics, buildSupportBundle } from './diagnostics.js';
import { findPlatform, platforms } from './platforms.js';
import { agentVersion } from './version.js';
import { PublishPolicy } from './publish-policy.js';

const jobProtocolAliases = Object.freeze({
  auto: 'auto',
  dual: 'dual',
  legacy: 'legacy',
  v1: 'legacy',
  'platform-jobs': 'platform-jobs',
  platform_jobs: 'platform-jobs',
  platformjobs: 'platform-jobs',
  v2: 'platform-jobs',
});

export function normalizeJobProtocol(value, fallback = 'auto') {
  const key = String(value || '').trim().toLowerCase();
  return jobProtocolAliases[key] || fallback;
}

function responseJobItems(response) {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data?.jobs)) return response.data.jobs;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.jobs)) return response.jobs;
  return Array.isArray(response?.data) ? response.data : [];
}

export class TongzhuoDesktopAgent extends EventEmitter {
  constructor() {
    super();
    this.config = readConfig();
    this.client = new GeoFlowClient(this.config, {
      onInvalidPairing: (error) => this.invalidatePairing(error),
    });
    this.browser = new PlatformBrowser();
    this.jobs = [];
    this.sessions = [];
    this.lastPollAt = null;
    this.lastHeartbeatAt = null;
    this.lastError = null;
    this.activeJobId = null;
    this.activeJobs = new Map();
    this.platformJobsSupported = null;
    this.jobProtocol = 'auto';
    this.lastPollProtocols = [];
    this.pollInFlight = null;
    this.commandsInFlight = null;
    this.publishPolicy = new PublishPolicy({
      policy: { ...(this.config.publishPolicy || {}), platformPolicy: this.config.platformPolicy || {} },
      state: this.config.publishPolicyState,
    });
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.loginSyncTimer = null;
    this.loginSyncInFlight = false;
    this.loginWatchers = new Map();
    this.logBuffer = new RuntimeLogBuffer();
    this.log('info', 'agent.started', '发布节点已启动。', {
      device_id: this.config.deviceId,
      connection_mode: this.config.connectionMode,
    });
  }

  hasCredential() {
    if (this.config.apiToken) return true;
    return Boolean(this.config.pairedAt && (this.config.pairingToken || this.config.deviceSecret));
  }

  canRegister() {
    return Boolean(this.config.pairingCode);
  }

  publicStatus() {
    return {
      deviceId: this.config.deviceId,
      deviceName: this.config.deviceName,
      agentVersion,
      geoflowBaseUrl: this.config.geoflowBaseUrl,
      hasToken: Boolean(this.config.apiToken),
      hasPairingToken: Boolean(this.config.pairingToken),
      hasDeviceCredential: Boolean(this.config.pairedAt && this.config.deviceSecret),
      hasCredential: this.hasCredential(),
      isPaired: Boolean(this.config.pairedAt && this.config.connectionMode === 'paired' && this.hasCredential()),
      connectionMode: this.config.connectionMode,
      port: this.config.port,
      autoRun: Boolean(this.config.autoRun),
      pollSeconds: this.config.pollSeconds,
      loginCheckSeconds: this.config.loginCheckSeconds,
      maxJobAttempts: this.config.maxJobAttempts,
      capabilities: this.config.capabilities,
      activeGroupId: this.config.activeGroupId,
      accountGroups: this.config.accountGroups,
      sessions: this.sessions,
      jobs: this.jobs,
      browser: this.browser.status(),
      activeJobId: this.activeJobId || this.activeJobIds()[0] || null,
      jobProtocol: this.jobProtocol,
      lastPollProtocols: this.lastPollProtocols,
      platformJobsSupported: this.platformJobsSupported,
      activeJobs: [...this.activeJobs.entries()].map(([jobId, item]) => ({ jobId, ...item })),
      publishPolicy: this.publishPolicy.snapshot(),
      desiredStateVersion: Number(this.config.desiredStateVersion || 0),
      appliedStateVersion: Number(this.config.appliedStateVersion || 0),
      localOverride: Boolean(this.config.localOverride),
      enabledPlatforms: this.config.enabledPlatforms || [],
      lastPollAt: this.lastPollAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastError: this.lastError,
      logs: this.logBuffer.list(),
    };
  }

  invalidatePairing(error = null) {
    if (!this.config.pairedAt && !this.config.pairingToken && !this.config.apiToken) return false;
    const invalidatedAt = new Date().toISOString();
    const accountGroups = this.listAccountGroups().map((group) => ({
      ...group,
      updatedAt: invalidatedAt,
      accounts: Object.fromEntries(Object.entries(group.accounts || {}).map(([platformId, account]) => [platformId, {
        ...account,
        status: account?.status || 'unknown',
        syncState: 'waiting_for_pairing',
        lastSyncError: '后台绑定已失效，请重新配对。',
        lastErrorMessage: '后台绑定已失效，请重新配对后检测登录状态。',
        updatedAt: invalidatedAt,
      }])),
    }));
    this.config = writeConfig({
      apiToken: '',
      pairingToken: '',
      pairedAt: '',
      pairingCode: '',
      connectionMode: 'token',
      accountGroups,
    });
    this.client.updateConfig(this.config);
    this.sessions = [];
    this.jobs = [];
    this.lastHeartbeatAt = null;
    this.lastPollAt = null;
    this.lastError = '后台设备记录不存在或配对凭证已失效，请在 GEO 后台重新生成配对码。';
    this.restartTimers();
    this.log('warn', 'connection.pairing_invalidated', this.lastError, {
      status: Number(error?.status || 0) || null,
      code: error?.code || null,
      route: error?.route || null,
    });
    this.emit('status', this.publicStatus());
    return true;
  }

  listAccountGroups() {
    return Array.isArray(this.config.accountGroups) ? this.config.accountGroups : [];
  }

  accountGroupById(groupId = '') {
    const groups = this.listAccountGroups();
    return groups.find((group) => group.id === groupId) || groups.find((group) => group.id === this.config.activeGroupId) || groups[0] || null;
  }

  saveAccountGroups(groups, activeGroupId = this.config.activeGroupId) {
    const nextGroups = Array.isArray(groups) && groups.length ? groups : this.listAccountGroups();
    const nextActive = nextGroups.some((group) => group.id === activeGroupId) ? activeGroupId : nextGroups[0]?.id;
    this.config = writeConfig({ accountGroups: nextGroups, activeGroupId: nextActive });
    this.client.updateConfig(this.config);
    return this.publicStatus();
  }

  createAccountGroup(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('账号组名称不能为空。');
    const now = new Date().toISOString();
    const id = `group-${Date.now().toString(36)}`;
    const groups = [...this.listAccountGroups(), { id, name: cleanName, status: 'active', accounts: {}, createdAt: now, updatedAt: now }];
    this.log('info', 'account_group.created', `已创建账号组“${cleanName}”。`, { group_id: id });
    return this.saveAccountGroups(groups, id);
  }

  renameAccountGroup(groupId, name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('账号组名称不能为空。');
    const groups = this.listAccountGroups().map((group) => group.id === groupId ? { ...group, name: cleanName, updatedAt: new Date().toISOString() } : group);
    if (!groups.some((group) => group.id === groupId)) throw new Error('账号组不存在。');
    return this.saveAccountGroups(groups);
  }

  assignAccountToGroup(groupId, platformId, accountName = '') {
    const group = this.accountGroupById(groupId);
    if (!group || group.id !== groupId) throw new Error('账号组不存在。');
    const platform = platforms.find((item) => item.id === platformId);
    if (!platform || platform.support === 'export') throw new Error('该平台不能绑定本地账号。');
    const now = new Date().toISOString();
    const groups = this.listAccountGroups().map((item) => {
      if (item.id !== groupId) return item;
      const current = item.accounts?.[platformId] || {};
      return {
        ...item,
        updatedAt: now,
        accounts: {
          ...(item.accounts || {}),
          [platformId]: {
            platformId,
            accountName: String(accountName || current.accountName || '').trim(),
            status: current.status || 'needs_login',
            profileKey: current.profileKey || `${groupId}--${platformId}`,
            updatedAt: now,
          },
        },
      };
    });
    this.log('info', 'account_group.account_assigned', `已将${platform.name}加入账号组“${group.name}”。`, { group_id: groupId, platform_id: platformId });
    return this.saveAccountGroups(groups);
  }

  removeAccountFromGroup(groupId, platformId) {
    const groups = this.listAccountGroups().map((item) => {
      if (item.id !== groupId) return item;
      const accounts = { ...(item.accounts || {}) };
      delete accounts[platformId];
      return { ...item, accounts, updatedAt: new Date().toISOString() };
    });
    return this.saveAccountGroups(groups);
  }

  profileKeyFor(groupId, platformId) {
    const group = this.accountGroupById(groupId);
    return group?.accounts?.[platformId]?.profileKey || `${group?.id || 'group-default'}--${platformId}`;
  }

  updateAccountStatus(groupId, platformId, status, extra = {}) {
    const groups = this.listAccountGroups();
    const now = new Date().toISOString();
    let changed = false;
    const nextGroups = groups.map((group) => {
      if (group.id !== groupId || !group.accounts?.[platformId]) return group;
      changed = true;
      return {
        ...group,
        updatedAt: now,
        accounts: {
          ...group.accounts,
          [platformId]: {
            ...group.accounts[platformId],
            status,
            ...(extra.accountName ? { accountName: extra.accountName } : {}),
            ...(extra.lastErrorMessage !== undefined ? { lastErrorMessage: extra.lastErrorMessage } : {}),
            ...(extra.lastVerifiedAt !== undefined ? { lastVerifiedAt: extra.lastVerifiedAt || '' } : {}),
            ...(extra.syncState !== undefined ? { syncState: extra.syncState || '' } : {}),
            ...(extra.lastSyncedAt !== undefined ? { lastSyncedAt: extra.lastSyncedAt || '' } : {}),
            ...(extra.lastSyncError !== undefined ? { lastSyncError: extra.lastSyncError || '' } : {}),
            ...(extra.pendingSession !== undefined ? { pendingSession: extra.pendingSession } : {}),
            updatedAt: now,
          },
        },
      };
    });
    if (changed) this.saveAccountGroups(nextGroups);
    return this.accountGroupById(groupId)?.accounts?.[platformId] || null;
  }

  sessionPayload(groupId, platformId, payload = {}) {
    const account = this.accountGroupById(groupId)?.accounts?.[platformId] || {};
    const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
      ? payload.meta
      : {};
    return {
      profile_key: String(payload.profile_key || this.profileKeyFor(groupId, platformId)).trim(),
      account_name: String(payload.account_name || account.accountName || '').trim(),
      login_state: String(payload.login_state || account.status || 'unknown').trim(),
      last_verified_at: payload.last_verified_at || null,
      last_error_message: String(payload.last_error_message || '').trim(),
      auto_allowed: Boolean(payload.auto_allowed),
      meta,
    };
  }

  async syncAccountSession(groupId, platformId, payload = {}) {
    const session = this.sessionPayload(groupId, platformId, payload);
    const account = this.accountGroupById(groupId)?.accounts?.[platformId] || {};
    const localStatus = account.status || session.login_state || 'unknown';

    if (!this.hasCredential()) {
      const wasWaiting = account.syncState === 'waiting_for_pairing';
      this.updateAccountStatus(groupId, platformId, localStatus, {
        syncState: 'waiting_for_pairing',
        lastSyncError: '尚未完成后台设备绑定。',
        pendingSession: session,
      });
      if (!wasWaiting) {
        this.log('info', 'platform.session.sync.waiting_for_pairing', `${platformId} 本地登录状态已保存，等待设备绑定后同步。`, {
          platform_id: platformId,
          group_id: groupId,
        });
      }
      return { synced: false, queued: true, syncState: 'waiting_for_pairing' };
    }

    try {
      await this.client.reportSession(platformId, session);
      const syncedAt = new Date().toISOString();
      this.updateAccountStatus(groupId, platformId, localStatus, {
        syncState: 'synced',
        lastSyncedAt: syncedAt,
        lastSyncError: '',
        pendingSession: null,
      });
      return { synced: true, queued: false, syncState: 'synced', syncedAt };
    } catch (error) {
      // Explicit invalid-pairing responses synchronously clear credentials via
      // the client callback. Keep that state instead of overwriting it here.
      if (!this.hasCredential()) {
        const message = String(error?.message || 'Backend pairing was invalidated while syncing the session.');
        this.updateAccountStatus(groupId, platformId, localStatus, {
          syncState: 'waiting_for_pairing',
          lastSyncError: message,
          pendingSession: session,
        });
        return { synced: false, queued: true, syncState: 'waiting_for_pairing', error };
      }

      const message = String(error?.message || '后台会话同步失败。');
      this.updateAccountStatus(groupId, platformId, localStatus, {
        syncState: 'pending',
        lastSyncError: message,
        pendingSession: session,
      });
      this.log('warn', 'platform.session.sync.pending', `${platformId} 本地登录状态已保存，后台同步将在稍后重试。`, {
        platform_id: platformId,
        group_id: groupId,
        status: Number(error?.status || 0) || null,
        code: error?.code || null,
        error: message,
      });
      return { synced: false, queued: true, syncState: 'pending', error };
    }
  }

  async flushPendingSessions() {
    if (!this.hasCredential()) return [];
    const results = [];
    for (const group of this.listAccountGroups()) {
      for (const [platformId, account] of Object.entries(group.accounts || {})) {
        if (!account?.pendingSession || account.status === 'disabled') continue;
        results.push(await this.syncAccountSession(group.id, platformId, account.pendingSession));
      }
    }
    return results;
  }

  configure(next) {
    const remoteApply = Boolean(next?.__remoteApply);
    const cleaned = { ...(next || {}) };
    delete cleaned.__remoteApply;
    if (!remoteApply && (Object.prototype.hasOwnProperty.call(cleaned, 'autoRun') || Object.prototype.hasOwnProperty.call(cleaned, 'pollSeconds') || Object.prototype.hasOwnProperty.call(cleaned, 'loginCheckSeconds'))) cleaned.localOverride = true;
    this.config = writeConfig(cleaned);
    this.client.updateConfig(this.config);
    if (!remoteApply) this.publishPolicy = new PublishPolicy({ policy: { ...(this.config.publishPolicy || {}), platformPolicy: this.config.platformPolicy || {} }, state: this.publishPolicy.snapshot() });
    this.restartTimers();
    this.log('info', 'config.saved', '连接配置已保存。', {
      geoflow_base_url: this.config.geoflowBaseUrl,
      connection_mode: this.config.connectionMode,
      auto_run: Boolean(this.config.autoRun),
      poll_seconds: this.config.pollSeconds,
    });
    return this.publicStatus();
  }

  async register() {
    if (!this.canRegister()) {
      throw new Error('请先输入后台生成的配对码，再绑定发布节点。');
    }
    this.log('info', 'device.register.start', '正在向 GEOFlow 绑定发布节点。');
    const result = await this.client.registerDevice();
    const registration = result?.result || result?.data || result || {};
    this.config = writeConfig({
      connectionMode: 'paired',
      apiToken: '',
      pairingToken: registration.pairing_token || registration.pairingToken || this.config.deviceSecret,
      pairedAt: registration.paired_at || registration.pairedAt || new Date().toISOString(),
      pairingCode: '',
    });
    this.client.updateConfig(this.config);
    await this.heartbeat().catch(() => {});
    await this.flushPendingSessions().catch(() => {});
    await this.loadSessions().catch(() => {});
    this.restartTimers();
    this.log('info', 'device.register.done', '发布节点已完成绑定。');
    return result;
  }

  activeJobIds() {
    return [...this.activeJobs.keys()]
      .map((id) => Number(String(id).replace(/^[^:]+:/, '')))
      .filter(Number.isFinite);
  }

  activeJobRefs() {
    return [...this.activeJobs.entries()].map(([key, entry]) => ({
      id: Number(String(key).replace(/^[^:]+:/, '')),
      protocol: normalizeJobProtocol(entry?.protocol || (String(key).startsWith('platform:') ? 'platform-jobs' : 'legacy'), 'legacy'),
    })).filter((item) => Number.isFinite(item.id));
  }

  setJobProtocol(value, source = 'runtime') {
    const protocol = normalizeJobProtocol(value, null);
    if (!protocol) return false;
    const changed = protocol !== this.jobProtocol;
    this.jobProtocol = protocol;
    if (['dual', 'platform-jobs'].includes(protocol)) this.platformJobsSupported = null;
    if (changed) this.log('info', 'jobs.protocol.changed', `任务协议已切换为 ${protocol}。`, { protocol, source });
    return changed;
  }

  heartbeatJobProtocol(body = {}) {
    const desired = body?.desired_state || body?.device?.desired_state || {};
    const candidates = [
      body?.job_protocol,
      body?.jobProtocol,
      desired?.job_protocol,
      desired?.jobProtocol,
      body?.device?.job_protocol,
      body?.device?.jobProtocol,
      body?.device?.meta?.job_protocol,
    ];
    for (const candidate of candidates) {
      const protocol = normalizeJobProtocol(candidate, null);
      if (protocol) return protocol;
    }
    return null;
  }

  async heartbeat(extra = {}) {
    if (!this.hasCredential()) return null;
    const activeJobIds = this.activeJobIds();
    const activeJobRefs = this.activeJobRefs();
    const reportedState = {
      desired_version_seen: Number(this.config.desiredStateVersion || 0) || 0,
      applied_version: Number(this.config.appliedStateVersion || 0) || 0,
      apply_status: 'applied',
      local_override: Boolean(this.config.localOverride),
      effective_auto_run: Boolean(this.config.autoRun),
      active_job_ids: activeJobIds,
      publish_policy: this.publishPolicy.snapshot(),
      job_protocol: this.jobProtocol,
      active_job_refs: activeJobRefs,
    };
    const protocolMeta = {
      job_protocol: this.jobProtocol,
      job_protocol_effective: this.lastPollProtocols.length === 1 ? this.lastPollProtocols[0] : this.lastPollProtocols,
      active_job_refs: activeJobRefs,
    };
    let result;
    try {
      result = await this.client.shadowHeartbeat(reportedState, {
        active_job_id: this.activeJobId || activeJobIds[0] || null,
        active_job_ids: activeJobIds,
        ...protocolMeta,
        ...extra,
      });
    } catch (error) {
      // A deployed backend can be upgraded independently of the node. Keep
      // its legacy heartbeat functioning until the shadow route is available.
      if (![404, 405].includes(Number(error?.status || 0))) throw error;
      result = await this.client.heartbeat({
        active_job_id: this.activeJobId || activeJobIds[0] || null,
        active_job_ids: activeJobIds,
        ...protocolMeta,
        desired_state_report: reportedState,
        ...extra,
      });
    }
    const body = result?.data || result || {};
    this.setJobProtocol(this.heartbeatJobProtocol(body), 'heartbeat');
    await this.applyDesiredState(body.desired_state || body.device?.desired_state);
    this.lastHeartbeatAt = new Date().toISOString();
    this.lastError = null;
    if (Number(body?.commands_hint?.queued || 0) > 0) this.processCommands({ triggerPoll: false }).catch((error) => this.log('warn', 'device.commands.failed', error.message));
    return result;
  }

  async processCommands() {
    if (this.commandsInFlight) return this.commandsInFlight;
    this.commandsInFlight = this.processCommandsOnce().finally(() => { this.commandsInFlight = null; });
    return this.commandsInFlight;
  }

  async processCommandsOnce() {
    if (!this.hasCredential()) return [];
    let response;
    try { response = await this.client.commands(20); } catch (error) {
      if ([404, 405].includes(Number(error?.status || 0))) return [];
      throw error;
    }
    const commands = Array.isArray(response?.data?.items) ? response.data.items
      : Array.isArray(response?.data?.commands) ? response.data.commands
        : Array.isArray(response?.items) ? response.items : [];
    const results = [];
    for (const item of commands) {
      const id = Number(item?.id);
      if (!id) continue;
      let claimed;
      try { claimed = await this.client.claimCommand(id); } catch (error) {
        if (Number(error?.status || 0) === 409) continue;
        throw error;
      }
      const lease = claimed?.lease_token || claimed?.leaseToken;
      if (!lease) continue;
      const type = String(claimed.command_type || claimed.commandType || '');
      try {
        let result = {};
        if (type === 'login_check' || type === 'check_login') result = { sessions: await this.syncLoginStates() };
        else if (type === 'poll_now' || type === 'refresh_jobs') result = { jobs: await this.poll({ skipCommands: true }) };
        else if (type === 'apply_desired_state') result = await this.applyDesiredState(claimed.payload?.desired_state || claimed.payload || {});
        else result = { ignored: true, reason: 'unsupported_command_type', command_type: type };
        await this.client.ackCommand(id, lease, 'completed', result);
        results.push({ id, type, status: 'completed', result });
      } catch (error) {
        await this.client.ackCommand(id, lease, 'failed', { message: error.message }).catch(() => {});
        results.push({ id, type, status: 'failed', message: error.message });
      }
    }
    return results;
  }
  async applyDesiredState(desired) {
    if (!desired || typeof desired !== 'object' || Array.isArray(desired)) return null;
    const desiredProtocol = normalizeJobProtocol(desired.job_protocol ?? desired.jobProtocol, null);
    if (desiredProtocol) this.setJobProtocol(desiredProtocol, 'desired_state');
    const version = Number(desired.version || desired.desired_state_version || 0) || 0;
    const applied = Number(this.config.appliedStateVersion || 0) || 0;
    const takeoverRequired = Boolean(desired.takeover) && Boolean(this.config.localOverride);
    if (Boolean(this.config.localOverride) && !takeoverRequired) {
      return { appliedVersion: applied, status: 'local_override' };
    }
    // Version zero is the server's unconfigured/default shadow. It must not
    // overwrite local settings or restart timers on every heartbeat. A
    // takeover-only response is still allowed to clear a real local override.
    if (version <= applied && !takeoverRequired) {
      return { appliedVersion: applied, status: 'unchanged' };
    }
    const next = {};
    if (Object.prototype.hasOwnProperty.call(desired, 'auto_run')) next.autoRun = Boolean(desired.auto_run);
    if (Object.prototype.hasOwnProperty.call(desired, 'poll_seconds')) next.pollSeconds = desired.poll_seconds;
    if (Object.prototype.hasOwnProperty.call(desired, 'login_check_seconds')) next.loginCheckSeconds = desired.login_check_seconds;
    if (Object.prototype.hasOwnProperty.call(desired, 'max_job_attempts')) next.maxJobAttempts = desired.max_job_attempts;
    if (Object.prototype.hasOwnProperty.call(desired, 'max_concurrent_groups')) {
      next.publishPolicy = { ...(this.config.publishPolicy || {}), maxConcurrentGroups: desired.max_concurrent_groups };
    }
    if (desired.platform_policy && typeof desired.platform_policy === 'object' && !Array.isArray(desired.platform_policy)) {
      next.platformPolicy = desired.platform_policy;
    }
    if (Array.isArray(desired.enabled_platform_ids)) next.enabledPlatforms = desired.enabled_platform_ids;
    if (version > 0) {
      next.desiredStateVersion = version;
      next.appliedStateVersion = version;
    }
    if (takeoverRequired) next.localOverride = false;
    const changed = Object.keys(next).length > 0 && (version > applied || takeoverRequired);
    if (changed) {
      this.config = writeConfig(next);
      this.client.updateConfig(this.config);
      this.publishPolicy = new PublishPolicy({
        policy: { ...(this.config.publishPolicy || {}), platformPolicy: this.config.platformPolicy || {} },
        state: this.publishPolicy.snapshot(),
      });
      this.restartTimers();
      this.persistPublishPolicy();
    }
    return { appliedVersion: version || applied, status: changed ? 'applied' : 'unchanged' };
  }
  async loadSessions() {
    if (!this.hasCredential()) {
      this.sessions = [];
      return [];
    }
    const response = await this.client.listSessions();
    this.sessions = Array.isArray(response?.data?.sessions)
      ? response.data.sessions
      : Array.isArray(response?.sessions)
        ? response.sessions
        : [];
    return this.sessions;
  }

  async poll(options = {}) {
    if (this.pollInFlight) return this.pollInFlight;
    this.pollInFlight = this.pollOnce(options).finally(() => { this.pollInFlight = null; });
    return this.pollInFlight;
  }

  jobProtocolFor(job, fallback = 'legacy') {
    const protocol = normalizeJobProtocol(job?.job_protocol || job?._job_protocol, null);
    return ['legacy', 'platform-jobs'].includes(protocol) ? protocol : fallback;
  }

  jobTaskKey(protocol, id) {
    return `${protocol === 'platform-jobs' ? 'platform' : 'legacy'}:${id}`;
  }

  tagPolledJobs(items, protocol) {
    return items.filter((item) => item && typeof item === 'object').map((item) => {
      const platformId = item.platform_id || item.platformId || '';
      const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
      const article = item.article && typeof item.article === 'object' ? item.article : null;
      return {
        ...item,
        ...(protocol === 'platform-jobs' && !Array.isArray(item.platforms) ? { platforms: platformId ? [platformId] : [] } : {}),
        ...(protocol === 'platform-jobs' && article && !payload.article ? { payload: { ...payload, article } } : {}),
        job_protocol: protocol,
        task_key: this.jobTaskKey(protocol, item.id),
      };
    });
  }

  async fetchJobsForProtocol(protocol, options = {}) {
    try {
      const response = protocol === 'platform-jobs'
        ? await this.client.platformJobs(options.limit || 30)
        : await this.client.jobs(options.limit || 30);
      if (protocol === 'platform-jobs') this.platformJobsSupported = true;
      return { protocol, items: this.tagPolledJobs(responseJobItems(response), protocol), unsupported: false };
    } catch (error) {
      const unsupported = [404, 405].includes(Number(error?.status || 0));
      if (protocol === 'platform-jobs' && unsupported) this.platformJobsSupported = false;
      // Authentication invalidation also uses 404 on older servers. Never
      // hide that condition behind protocol fallback after credentials clear.
      if (!this.hasCredential()) throw error;
      if (unsupported && options.allowUnsupported) return { protocol, items: [], unsupported: true };
      throw error;
    }
  }

  async pollOnce(options = {}) {
    if (!this.hasCredential()) {
      this.lastError = null;
      return [];
    }
    this.log('info', 'jobs.poll.start', '正在读取分发任务。');
    const requestedProtocol = normalizeJobProtocol(options.jobProtocol || this.jobProtocol, 'auto');
    const batches = [];
    if (requestedProtocol === 'legacy') {
      batches.push(await this.fetchJobsForProtocol('legacy'));
    } else if (requestedProtocol === 'platform-jobs') {
      batches.push(await this.fetchJobsForProtocol('platform-jobs'));
    } else if (requestedProtocol === 'dual') {
      const platformBatch = await this.fetchJobsForProtocol('platform-jobs', { allowUnsupported: true });
      const legacyBatch = await this.fetchJobsForProtocol('legacy', { allowUnsupported: true });
      if (platformBatch.unsupported && legacyBatch.unsupported) {
        throw Object.assign(new Error('后台未提供可用的发布任务接口。'), { status: 404 });
      }
      if (!platformBatch.unsupported) batches.push(platformBatch);
      if (!legacyBatch.unsupported) batches.push(legacyBatch);
    } else {
      // Auto preserves V2 priority, but an empty V2 queue also probes V1 so
      // historical jobs are not stranded during a rolling migration.
      const platformBatch = await this.fetchJobsForProtocol('platform-jobs', { allowUnsupported: true });
      if (!platformBatch.unsupported) batches.push(platformBatch);
      if (platformBatch.unsupported || platformBatch.items.length === 0) {
        const legacyBatch = await this.fetchJobsForProtocol('legacy', { allowUnsupported: !platformBatch.unsupported });
        if (!legacyBatch.unsupported) batches.push(legacyBatch);
      }
    }
    const items = batches.flatMap((batch) => batch.items);
    const protocols = [...new Set(batches.filter((batch) => !batch.unsupported).map((batch) => batch.protocol))];
    this.jobs = items;
    this.lastPollProtocols = protocols;
    this.lastPollAt = new Date().toISOString();
    this.lastError = null;
    this.log('info', 'jobs.poll.done', `已读取 ${items.length} 个任务。`, { protocol: requestedProtocol, polled_protocols: protocols });
    await this.loadSessions().catch(() => {});
    if (this.config.autoRun) {
      if (!options.skipCommands) this.processCommands().catch((error) => this.log('warn', 'device.commands.failed', error.message));
      const pending = items.filter((job) => ['queued', 'pending', 'ready', 'waiting_for_device'].includes(String(job.status || '').toLowerCase()));
      const activeKeys = new Set([...this.activeJobs.keys()].map(String));
      const scheduledGroups = new Set([...this.activeJobs.values()].map((entry) => entry?.groupId).filter(Boolean));
      const available = Math.max(0, this.publishPolicy.maxConcurrentGroups - this.publishPolicy.activeCount());
      const ready = [];
      for (const next of pending) {
        if (ready.length >= available) break;
        const itemProtocol = this.jobProtocolFor(next);
        const taskKey = this.jobTaskKey(itemProtocol, next.id);
        if (activeKeys.has(taskKey)) continue;
        const groupId = next?.account_group_id || next?.group_id || next?.payload?.account_group_id || next?.payload?.group_id || this.groupIdForProfile(next?.profile_key) || this.config.activeGroupId;
        if (scheduledGroups.has(groupId)) continue;
        scheduledGroups.add(groupId);
        ready.push(next);
      }
      for (const next of ready) {
        const itemProtocol = this.jobProtocolFor(next);
        const taskKey = this.jobTaskKey(itemProtocol, next.id);
        if (this.activeJobs.has(taskKey)) continue;
        const runner = itemProtocol === 'platform-jobs'
          ? this.runPlatformJob(next, { automatic: true })
          : this.runJob(next.id, [], { automatic: true, jobHint: next });
        runner.catch((error) => {
          this.lastError = error.message;
          this.log('error', 'jobs.auto_run.failed', `自动执行任务 #${next.id} 失败：${error.message}`, { job_id: Number(next.id), protocol: itemProtocol });
        });
      }
    }
    return this.jobs;
  }

  async runQueuedJob(id, selectedPlatforms = [], options = {}) {
    const jobNumber = Number(id);
    const requested = normalizeJobProtocol(options.jobProtocol, null);
    const concreteRequested = ['legacy', 'platform-jobs'].includes(requested) ? requested : null;
    const candidates = this.jobs.filter((item) => Number(item?.id) === jobNumber);
    const matching = concreteRequested
      ? candidates.find((item) => this.jobProtocolFor(item) === concreteRequested)
      : candidates[0];
    const protocols = [...new Set(candidates.map((item) => this.jobProtocolFor(item)))];
    if (!concreteRequested && protocols.length > 1) {
      throw new Error('V1 与 V2 队列存在同号任务，请刷新页面后按任务协议执行。');
    }
    const protocol = concreteRequested || (matching ? this.jobProtocolFor(matching) : 'legacy');
    if (protocol === 'platform-jobs') {
      return this.runPlatformJob(matching || { id: jobNumber, job_protocol: protocol }, { automatic: false });
    }
    return this.runJob(jobNumber, selectedPlatforms, { automatic: false, jobHint: matching || undefined });
  }

  async runPlatformJob(jobHint, options = {}) {
    const automatic = options.automatic === true;
    const id = Number(jobHint?.id);
    const taskKey = `platform:${id}`;
    let leaseToken = '';
    let platformId = '';
    let resultReported = false;
    if (!id || this.activeJobs.has(taskKey)) throw new Error('平台子任务无效或已在执行。');
    const hintedGroupId = jobHint?.account_group_id || jobHint?.group_id || jobHint?.payload?.account_group_id || jobHint?.payload?.group_id || this.groupIdForProfile(jobHint?.profile_key) || this.config.activeGroupId;
    const groupPermit = this.publishPolicy.acquireGroup(hintedGroupId, automatic);
    if (!groupPermit.allowed) throw new Error(`任务暂缓执行：${groupPermit.reason}`);
    this.activeJobs.set(taskKey, { groupId: hintedGroupId, startedAt: new Date().toISOString(), automatic, protocol: 'platform-jobs' });
    try {
      const claimed = await this.client.claimPlatformJob(id);
      leaseToken = claimed?.lease_token || claimed?.leaseToken || '';
      if (!leaseToken) throw new Error('平台子任务领取响应缺少 lease_token。');
      platformId = claimed.platform_id || claimed.platformId || '';
      const groupId = claimed?.account_group_id || claimed?.group_id || claimed?.payload?.account_group_id || claimed?.payload?.group_id || this.groupIdForProfile(claimed.profile_key) || hintedGroupId;
      const group = this.accountGroupById(groupId);
      if (!group || !platformId) throw new Error('平台子任务缺少可用账号组或平台。');
      this.activeJobs.set(taskKey, { groupId, startedAt: this.activeJobs.get(taskKey)?.startedAt, automatic, protocol: 'platform-jobs' });
      await this.client.heartbeatPlatformJob(id, leaseToken, { progress_step: 'local_executor_started', progress_percent: 10 }).catch(() => {});
      const leaseTimer = setInterval(() => this.client.heartbeatPlatformJob(id, leaseToken, { progress_step: 'local_executor_running' }).catch(() => {}), 60000);
      let result;
      try {
        result = await this.runPlatformWithRetry(platformId, claimed, id, group, { automatic });
      } finally {
        clearInterval(leaseTimer);
      }
      const status = this.platformJobStatus(result);
      await this.client.reportPlatformJobResult(id, leaseToken, status, {
        ...result,
        selector_telemetry: result.selector_telemetry || result.selectorTelemetry || result.telemetry || null,
      });
      resultReported = true;
      return { jobId: id, platformId, state: status, result };
    } catch (error) {
      if (leaseToken && !resultReported) {
        await this.client.reportPlatformJobResult(id, leaseToken, 'failed', { platform: platformId, state: 'failed', message: error.message, failure_category: 'agent_runtime_error', retryable: false }).catch(() => {});
      }
      this.log('error', 'platform_job.failed', `平台子任务 #${id} 执行失败：${error.message}`, { job_id: id });
      throw error;
    } finally {
      const entry = this.activeJobs.get(taskKey);
      this.publishPolicy.releaseGroup(entry?.groupId || hintedGroupId);
      this.activeJobs.delete(taskKey);
      this.persistPublishPolicy();
      await this.heartbeat().catch(() => {});
    }
  }

  groupIdForProfile(profileKey = '') {
    const key = String(profileKey || '');
    const match = this.listAccountGroups().find((group) => key === group.id || key.startsWith(`${group.id}--`));
    return match?.id || '';
  }

  platformJobStatus(result = {}) {
    const state = String(result.state || 'failed').toLowerCase();
    if (['published', 'draft_saved', 'failed', 'cancelled', 'skipped', 'awaiting_confirmation', 'login_required', 'verification_required', 'needs_verification', 'needs_captcha'].includes(state)) return state;
    if (state === 'awaiting_login') return 'login_required';
    return 'failed';
  }
  async openLogin(platformId, options = {}) {
    let group = this.accountGroupById(options.groupId);
    const groupId = group?.id || this.config.activeGroupId;
    if (!group) throw new Error('当前没有可用账号组，请先创建账号组。');
    if (!group.accounts?.[platformId]) {
      this.assignAccountToGroup(groupId, platformId, options.accountName || '');
      group = this.accountGroupById(groupId);
    }
    const account = group?.accounts?.[platformId] || {};
    const profileKey = this.profileKeyFor(groupId, platformId);
    this.log('info', 'platform.login.open', `正在打开 ${platformId} 登录窗口。`, { platform_id: platformId, group_id: groupId });
    const result = await this.browser.openLogin(platformId, { profileKey });
    // Opening a page for an already verified profile must not downgrade it.
    const localState = account.status === 'ready' ? 'ready' : 'open';
    this.updateAccountStatus(groupId, platformId, localState, {
      accountName: options.accountName || account.accountName || '',
      lastErrorMessage: '',
    });
    const sync = await this.syncAccountSession(groupId, platformId, {
      profile_key: profileKey,
      account_name: options.accountName || account.accountName || '',
      login_state: localState,
      last_error_message: '',
      auto_allowed: false,
      meta: {
        event: 'login_window_opened',
        group_id: groupId,
        group_name: group?.name || '',
        url: result.url,
      },
    });
    if (sync.synced) await this.loadSessions().catch(() => {});
    if (localState !== 'ready' || result.driver === 'native') this.startLoginWatch(platformId, groupId);
    this.log('info', 'platform.login.opened', `${platformId} 登录窗口已打开。`, {
      platform_id: platformId,
      group_id: groupId,
      url: result.url,
      sync_state: sync.syncState,
    });
    return { ...result, loginDetection: result.driver === 'native' ? 'after_native_window_close' : 'automatic', syncState: sync.syncState };
  }

  browserWindows() {
    return this.browser.status();
  }

  async focusBrowserWindow(windowId) {
    const result = await this.browser.focusPage(windowId);
    this.log('info', 'platform.window.focused', `已聚焦 ${result.platformId} 平台窗口。`, {
      platform_id: result.platformId,
      window_id: result.id,
    });
    return result;
  }

  async closeBrowserWindow(windowId) {
    const result = await this.browser.closePage(windowId);
    this.log('info', 'platform.window.closed', '已关闭平台窗口。', { window_id: result.id });
    return result;
  }

  async checkLogin(platformId, options = {}) {
    const group = this.accountGroupById(options.groupId);
    const groupId = group?.id || this.config.activeGroupId;
    if (!group) throw new Error('当前没有可用账号组，请先创建账号组。');
    const account = group.accounts?.[platformId];
    if (!account) throw new Error('请先把平台加入当前账号组。');
    const profileKey = this.profileKeyFor(groupId, platformId);
    const probe = options.existingWindowOnly
      ? await this.browser.inspectLoginPages(platformId, { profileKey })
      : await this.browser.probeLogin(platformId, { profileKey });
    if (probe.manualLoginInProgress) {
      const preservedState = account.status === 'ready' ? 'ready' : 'open';
      if (account.status !== preservedState) {
        this.updateAccountStatus(groupId, platformId, preservedState, {
          lastErrorMessage: '',
          lastVerifiedAt: account.lastVerifiedAt || '',
        });
      }
      return {
        platformId,
        groupId,
        profileKey,
        loginState: preservedState,
        loggedIn: false,
        windowOpen: true,
        manualLoginInProgress: true,
        reason: 'manual_login_in_progress',
        localStatePreserved: account.status === 'ready',
      };
    }    if (options.existingWindowOnly && probe.windowOpen === false) {
      // Closing a visible login tab does not clear the persistent profile.
      const preservedState = account.status === 'ready' ? 'ready' : 'unknown';
      this.updateAccountStatus(groupId, platformId, preservedState, {
        lastErrorMessage: preservedState === 'ready' ? '' : (probe.reason || 'login_window_closed'),
      });
      return {
        platformId,
        groupId,
        profileKey,
        loginState: preservedState,
        loggedIn: false,
        windowOpen: false,
        reason: probe.reason || 'login_window_closed',
        localStatePreserved: preservedState === 'ready',
      };
    }
    if (!probe.loggedIn) {
      const reason = String(probe.reason || 'login_not_detected').toLowerCase();
      if (reason === 'probe_failed' && account.status === 'ready' && !options._profileReleaseRetry) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return this.checkLogin(platformId, { ...options, _profileReleaseRetry: true });
      }
      const loginState = reason === 'probe_failed'
        ? 'unknown'
        : /(captcha|verification|verify|risk|blocked|challenge|登录|验证)/i.test(reason)
          ? 'needs_verification'
          : 'needs_login';
      const lastVerifiedAt = loginState === 'unknown' ? (account.lastVerifiedAt || '') : '';
      this.updateAccountStatus(groupId, platformId, loginState, {
        lastErrorMessage: reason,
        lastVerifiedAt,
      });
      const sync = await this.syncAccountSession(groupId, platformId, {
        profile_key: profileKey,
        account_name: account.accountName || '',
        login_state: loginState,
        last_verified_at: null,
        last_error_message: reason,
        auto_allowed: false,
        meta: {
          event: 'login_probe_failed',
          group_id: groupId,
          group_name: group.name || '',
          reason,
          url: probe.url || '',
        },
      });
      if (sync.synced) await this.loadSessions().catch(() => {});
      return {
        platformId,
        groupId,
        profileKey,
        loginState,
        loggedIn: false,
        reason,
        url: probe.url || '',
        syncState: sync.syncState,
      };
    }
    const ready = await this.confirmLogin(platformId, {
      groupId,
      accountName: account.accountName || '',
      source: options.source || 'automatic_probe',
      recheck: true,
    });
    return { ...ready, loggedIn: true, probe };
  }

  startLoginWatch(platformId, groupId = this.config.activeGroupId) {
    const key = `${groupId}:${platformId}`;
    if (this.loginWatchers.has(key)) return this.loginWatchers.get(key);
    const task = (async () => {
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const group = this.accountGroupById(groupId);
        const account = group?.accounts?.[platformId];
        if (!account || !['open', 'needs_verification', 'needs_login', 'unknown', 'ready'].includes(account.status)) return null;
        let result;
        try {
          result = await this.checkLogin(platformId, {
            groupId,
            source: 'automatic_open_window',
            existingWindowOnly: true,
          });
          if (result?.manualLoginInProgress) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          if (platformId === 'zhihu' && result?.windowOpen === false) {
            // The native browser has released the profile. Probe the editor
            // once before claiming that login succeeded or failed.
            await new Promise((resolve) => setTimeout(resolve, 1200));
            result = await this.checkLogin(platformId, {
              groupId,
              source: 'automatic_probe',
            });
          }
        } catch (error) {
          this.log('warn', 'platform.login.watch.failed', `${platformId} 登录窗口检测失败，将继续重试。`, {
            platform_id: platformId,
            group_id: groupId,
            error: error.message,
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
        if (result?.loggedIn) {
          this.log('info', 'platform.login.detected', `${platformId} 本地登录已确认。`, {
            platform_id: platformId,
            group_id: groupId,
            profile_key: this.profileKeyFor(groupId, platformId),
            sync_state: result.syncState || 'synced',
          });
          return result;
        }
        if (platformId === 'zhihu' || result?.windowOpen === false) return result;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return null;
    })().finally(() => this.loginWatchers.delete(key));
    this.loginWatchers.set(key, task);
    return task;
  }
  /**
   * Re-check every bound local browser profile on a modest cadence. The
   * backend receives the exact probe result, so an expired cookie cannot stay
   * displayed as an authenticated account after the assistant detects it.
   */
  async syncLoginStates() {
    if (this.loginSyncInFlight) return [];
    this.loginSyncInFlight = true;
    try {
      const targets = [];
      for (const group of this.listAccountGroups()) {
        for (const [platformId, account] of Object.entries(group.accounts || {})) {
          if (account?.status === 'disabled') continue;
          if (this.loginWatchers.has(`${group.id}:${platformId}`)) continue;
          targets.push({ platformId, groupId: group.id });
        }
      }

      const results = [];
      if (this.hasCredential()) await this.flushPendingSessions();
      for (const target of targets) {
        try {
          results.push(await this.checkLogin(target.platformId, {
            groupId: target.groupId,
            source: 'scheduled_probe',
          }));
        } catch (error) {
          this.log('warn', 'platform.login.probe.failed', `${target.platformId} 登录状态检测失败。`, {
            platform_id: target.platformId,
            group_id: target.groupId,
            error: error.message,
          });
        }
      }
      return results;
    } finally {
      this.loginSyncInFlight = false;
    }
  }

  /**
   * Records a login only after the persistent local browser profile has been
   * probed successfully. The check endpoint is the single source of truth;
   * this method must not be used to claim a login without a real probe.
   */
  async confirmLogin(platformId, options = {}) {
    const group = this.accountGroupById(options.groupId);
    const groupId = group?.id || this.config.activeGroupId;
    if (!group) throw new Error('当前没有可用账号组，请先创建账号组。');

    const platform = findPlatform(platformId);
    if (!platform || platform.support === 'export') {
      throw new Error('该平台不支持本地账号登录确认。');
    }

    const account = group.accounts?.[platformId];
    if (!account) {
      throw new Error(`请先将 ${platform.name} 加入当前账号组，再完成登录确认。`);
    }

    const profileKey = this.profileKeyFor(groupId, platformId);
    const verifiedAt = new Date().toISOString();
    const isGuided = platform.execution?.mode === 'assisted' || platform.support === 'manual' || platform.support === 'planned';
    const automatic = ['automatic_probe', 'scheduled_probe'].includes(options.source);
    const event = automatic
      ? 'login_detected_automatically'
      : options.recheck
        ? 'login_rechecked_by_operator'
        : 'login_confirmed_by_operator';

    this.log('info', 'platform.login.confirm.start', `正在检测 ${platform.name} 的本地登录状态。`, {
      platform_id: platformId,
      group_id: groupId,
      recheck: Boolean(options.recheck),
    });

    const session = {
      profile_key: profileKey,
      account_name: options.accountName || account.accountName || '',
      login_state: 'ready',
      last_verified_at: verifiedAt,
      last_error_message: '',
      // This flag controls backend dispatch only; platform results still
      // distinguish draft saves, verified publications and failures.
      auto_allowed: !isGuided,
      meta: {
        event,
        group_id: groupId,
        group_name: group.name || '',
        execution_mode: platform.execution?.mode || 'unknown',
        confirmation_source: automatic ? 'automatic_probe' : 'local_operator',
      },
    };
    this.updateAccountStatus(groupId, platformId, 'ready', {
      accountName: options.accountName || account.accountName || '',
      lastErrorMessage: '',
      lastVerifiedAt: verifiedAt,
    });
    const sync = await this.syncAccountSession(groupId, platformId, session);
    if (this.hasCredential()) {
      await this.heartbeat({
        event: 'platform_login_confirmed',
        platform_id: platformId,
        group_id: groupId,
        login_state: 'ready',
      }).catch(() => {});
    }
    if (sync.synced) await this.loadSessions().catch(() => {});

    const result = {
      platformId,
      groupId,
      profileKey,
      loginState: 'ready',
      verifiedAt,
      autoAllowed: !isGuided,
      recheck: Boolean(options.recheck),
      syncState: sync.syncState,
    };
    this.log(sync.synced ? 'info' : 'warn', 'platform.login.confirm.done', sync.synced
      ? `${platform.name} 登录检测通过，状态已同步到后台。`
      : `${platform.name} 登录检测通过，本地状态已保存，后台等待同步。`, {
      platform_id: platformId,
      group_id: groupId,
      ...result,
    });
    return result;
  }

  async runJob(id, selectedPlatforms = [], options = {}) {
    const automatic = options.automatic === true;
    const jobNumber = Number(id);
    const taskKey = this.jobTaskKey('legacy', jobNumber);
    if (!automatic && this.activeJobs.size > 0) throw new Error('当前已有任务正在执行。');
    if (this.activeJobs.has(taskKey)) throw new Error('该任务已在执行。');
    const hint = options.jobHint || this.jobs.find((item) => Number(item.id) === jobNumber && this.jobProtocolFor(item) === 'legacy') || {};
    const hintedGroupId = hint?.account_group_id || hint?.group_id || hint?.payload?.account_group_id || hint?.payload?.group_id || this.config.activeGroupId;
    const groupPermit = this.publishPolicy.acquireGroup(hintedGroupId, automatic);
    if (!groupPermit.allowed) throw new Error(`任务暂缓执行：${groupPermit.reason}`);
    this.activeJobs.set(taskKey, { groupId: hintedGroupId, startedAt: new Date().toISOString(), automatic, protocol: 'legacy' });
    this.activeJobId = jobNumber;
    try {
      this.log('info', 'job.start', `开始执行任务 #${id}。`, { job_id: jobNumber, selected_platforms: selectedPlatforms, automatic });
      await this.heartbeat().catch(() => {});
      const job = await this.client.claimJob(id);
      const groupId = job?.account_group_id || job?.group_id || job?.payload?.account_group_id || job?.payload?.group_id || hintedGroupId;
      const group = this.accountGroupById(groupId);
      if (!group) throw new Error('当前任务没有可用账号组，请先在本地发布器创建账号组。');
      this.activeJobs.set(taskKey, { groupId, startedAt: this.activeJobs.get(taskKey)?.startedAt, automatic, protocol: 'legacy' });
      const targetPlatforms = this.choosePlatforms(job, selectedPlatforms);
      if (!targetPlatforms.length) throw new Error('当前发布节点没有可处理的平台。请检查分发渠道或升级执行器适配器。');
      const results = this.completedPlatformResults(job, targetPlatforms);
      for (const platformId of targetPlatforms) {
        if (results[platformId] && ['published', 'draft_saved'].includes(String(results[platformId].state || ''))) continue;
        results[platformId] = await this.runPlatformWithRetry(platformId, job, jobNumber, group, { automatic });
      }
      const payload = buildResultPayload({ workerId: this.config.deviceId, platformResults: results });
      await this.client.reportResult(id, payload.state, payload.message, payload);
      this.log('info', 'job.reported', `任务 #${id} 已回写 GEOFlow：${payload.state}。`, { job_id: jobNumber, state: payload.state, next_operator_action: payload.next_operator_action, state_counts: payload.state_summary.state_counts });
      await this.poll().catch(() => {});
      return { jobId: id, state: payload.state, platformResults: results, stateSummary: payload.state_summary };
    } catch (error) {
      this.log('error', 'job.failed', `任务 #${id} 执行失败：${error.message}`, { job_id: jobNumber });
      await this.client.reportResult(id, 'failed', error.message).catch(() => {});
      throw error;
    } finally {
      const entry = this.activeJobs.get(taskKey);
      this.publishPolicy.releaseGroup(entry?.groupId || hintedGroupId);
      this.activeJobs.delete(taskKey);
      this.activeJobId = this.activeJobIds()[0] || null;
      this.persistPublishPolicy();
      await this.heartbeat().catch(() => {});
    }
  }
  async runPlatformWithRetry(platformId, job, jobId, group = this.accountGroupById(), options = {}) {
    const maxAttempts = Math.max(1, Number(this.config.maxJobAttempts) || 1);
    const profileKey = this.profileKeyFor(group?.id, platformId);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const permit = this.publishPolicy.acquireProfile({
        groupId: group?.id,
        profileKey,
        platformId,
        platformPolicy: this.config.platformPolicy || this.config.publishPolicy?.platformPolicy,
        automatic: options.automatic === true,
      });
      if (!permit.allowed) {
        return { platform: platformId, state: 'failed', message: `发布策略暂缓执行：${permit.reason}`, attempt, max_attempts: maxAttempts, failure_category: `policy_${permit.reason}`, retryable: false, next_action: 'retry_platform' };
      }
      this.log('info', 'platform.run.start', `开始处理平台 ${platformId}。`, { job_id: jobId, platform_id: platformId, attempt, max_attempts: maxAttempts });
      try {
        const delayMs = await this.publishPolicy.waitBeforePublish(platformId, this.config.platformPolicy || this.config.publishPolicy?.platformPolicy, options);
        const result = await this.browser.openEditor(platformId, job?.payload || {}, { profileKey });
        const serialized = { ...serializePlatformResult(result), platform: platformId, window_id: result.windowId || null, attempt, max_attempts: maxAttempts, ...(delayMs ? { policy_delay_ms: delayMs } : {}) };
        this.publishPolicy.recordOutcome(platformId, serialized, this.config.platformPolicy || this.config.publishPolicy?.platformPolicy);
        await this.syncPlatformSession(platformId, serialized, group).catch(() => {});
        this.log(serialized.state === 'failed' ? 'error' : 'info', 'platform.run.done', `${platformId} 返回状态：${serialized.state}。`, { job_id: jobId, platform_id: platformId, state: serialized.state, message: serialized.message, remote_url: serialized.remote_url, attempt });
        this.publishPolicy.releaseProfile({ groupId: group?.id, profileKey, platformId });
        this.persistPublishPolicy();
        return serialized;
      } catch (error) {
        const decision = retryDecision(error, attempt, maxAttempts);
        const outcome = this.publishPolicy.recordOutcome(platformId, { state: 'failed', message: error.message }, this.config.platformPolicy || this.config.publishPolicy?.platformPolicy);
        this.log(decision.should_retry && outcome.retryable ? 'warn' : 'error', 'platform.run.failed', `${platformId} 执行失败：${error.message}`, { job_id: jobId, platform_id: platformId, attempt, max_attempts: maxAttempts, failure_category: decision.category, retryable: decision.retryable, should_retry: decision.should_retry && outcome.retryable });
        this.publishPolicy.releaseProfile({ groupId: group?.id, profileKey, platformId });
        this.persistPublishPolicy();
        if (decision.should_retry && outcome.retryable) continue;
        return { platform: platformId, state: 'failed', message: error.message, attempt, max_attempts: maxAttempts, failure_category: decision.category, retryable: decision.retryable && outcome.retryable, next_action: decision.next_action };
      }
    }
    return { platform: platformId, state: 'failed', message: 'Platform execution failed after retry policy ended.', attempt: maxAttempts, max_attempts: maxAttempts, failure_category: 'retry_exhausted', retryable: false, next_action: 'operator_inspect_failed_platforms' };
  }

  completedPlatformResults(job, targetPlatforms = []) {
    const source = job?.platform_results || job?.platformResults || job?.result?.platform_results || job?.result?.platformResults || job?.payload?.platform_results || job?.payload?.platformResults || {};
    const normalized = Array.isArray(source) ? Object.fromEntries(source.filter((item) => item?.platform).map((item) => [item.platform, item])) : (source && typeof source === 'object' ? source : {});
    return Object.fromEntries((targetPlatforms || []).filter((platformId) => normalized[platformId] && ['published', 'draft_saved'].includes(String(normalized[platformId].state || ''))).map((platformId) => [platformId, { platform: platformId, ...normalized[platformId] }]));
  }

  persistPublishPolicy() {
    try {
      this.config = writeConfig({ publishPolicyState: this.publishPolicy.snapshot() });
      this.client.updateConfig(this.config);
    } catch (error) {
      this.log('warn', 'publish.policy.persist.failed', `保存发布策略状态失败：${error.message}`);
    }
  }
  choosePlatforms(job, selectedPlatforms) {
    const jobPlatforms = Array.isArray(job?.platforms) ? job.platforms : [];
    const selected = Array.isArray(selectedPlatforms) ? selectedPlatforms : [];
    const allowed = selected.length ? selected.filter((id) => jobPlatforms.includes(id)) : jobPlatforms;
    const remotelyEnabled = Array.isArray(this.config.enabledPlatforms) && this.config.enabledPlatforms.length
      ? new Set(this.config.enabledPlatforms)
      : null;
    return allowed.filter((id) => this.config.capabilities.includes(id) && (!remotelyEnabled || remotelyEnabled.has(id)));
  }

  async syncPlatformSession(platformId, result = {}, group = this.accountGroupById()) {
    const state = String(result.state || '');
    const platform = findPlatform(platformId);
    const profileKey = this.profileKeyFor(group?.id, platformId);
    const currentAccount = group?.accounts?.[platformId] || {};
    const currentSession = this.sessions.find((session) => {
      if (session?.platform_id !== platformId) return false;
      return !session.profile_key || session.profile_key === profileKey;
    });
    const existingLoginState = currentSession?.login_state || currentAccount.status || 'unknown';
    const normalizedExistingState = existingLoginState === 'online' ? 'ready' : existingLoginState;
    const authenticationFailure = [
      'awaiting_login',
      'login_required',
      'needs_verification',
      'needs_captcha',
    ].includes(state) || Boolean(result.verification_reason)
      || /(login|captcha|verify|verification|risk|code|challenge)/i.test(String(result.message || ''));
    // A draft/submit result proves the profile was usable. Conversely, a
    // normal editor or save failure is not evidence that the account logged
    // out, so retain the last verified login state in that case.
    const preservedLoginState = ['published', 'draft_saved'].includes(state)
      ? 'ready'
      : authenticationFailure
        ? 'needs_verification'
        : normalizedExistingState;
    const isGuided = platform?.execution?.mode === 'assisted' || platform?.support === 'manual' || platform?.support === 'planned';

    const verifiedAt = ['published', 'draft_saved'].includes(state) ? new Date().toISOString() : null;
    const session = {
      profile_key: profileKey,
      account_name: currentAccount.accountName || '',
      login_state: preservedLoginState,
      last_verified_at: verifiedAt,
      last_error_message: state === 'failed' ? (result.message || '') : '',
      // A guided platform may fill content, but it must never be treated as an
      // unattended publishing channel by the server scheduler.
      auto_allowed: preservedLoginState === 'ready' && !isGuided,
      meta: {
        group_id: group?.id || '',
        group_name: group?.name || '',
        state,
        execution_mode: platform?.execution?.mode || 'unknown',
        remote_url: result.remote_url || '',
        attempt: result.attempt || null,
      },
    };
    this.updateAccountStatus(group?.id, platformId, preservedLoginState, {
      lastErrorMessage: state === 'failed' ? (result.message || '') : '',
      lastVerifiedAt: verifiedAt || (authenticationFailure ? '' : (currentAccount.lastVerifiedAt || '')),
    });
    const sync = await this.syncAccountSession(group?.id, platformId, session);
    if (sync.synced) await this.loadSessions().catch(() => {});
    return sync;
  }

  log(level, event, message, context = {}) {
    this.logBuffer.add(level, event, message, context);
  }

  clearLogs() {
    return this.logBuffer.clear();
  }

  diagnostics(options = {}) {
    return buildDiagnostics({
      ...this.publicStatus(),
      apiToken: this.config.apiToken,
      pairingToken: this.config.pairingToken,
      deviceSecret: this.config.deviceSecret,
      hasCredential: this.hasCredential(),
    }, platforms, options);
  }

  async supportBundle(options = {}) {
    const status = this.publicStatus();
    const diagnostics = await buildDiagnostics({
      ...status,
      apiToken: this.config.apiToken,
      pairingToken: this.config.pairingToken,
      deviceSecret: this.config.deviceSecret,
      hasCredential: this.hasCredential(),
    }, platforms, options);
    return buildSupportBundle(status, diagnostics, platforms);
  }

  restartTimers() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.loginSyncTimer) clearInterval(this.loginSyncTimer);
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.loginSyncTimer = null;

    const loginSyncMs = Math.max(60, Number(this.config.loginCheckSeconds) || 300) * 1000;
    this.loginSyncTimer = setInterval(() => this.syncLoginStates().catch((error) => {
      this.lastError = error.message;
      this.log('warn', 'platform.login.probe.loop.failed', `登录状态同步失败：${error.message}`);
    }), loginSyncMs);

    for (const group of this.listAccountGroups()) {
      for (const [platformId, account] of Object.entries(group.accounts || {})) {
        if (account.status === 'open' || account.status === 'needs_verification') {
          this.startLoginWatch(platformId, group.id);
        }
      }
    }
    this.syncLoginStates().catch((error) => {
      this.lastError = error.message;
      this.log('warn', 'platform.login.probe.initial.failed', `登录状态初次同步失败：${error.message}`);
    });

    // Browser-profile login checks are local-only and remain available before
    // the GEOFlow device pairing has been completed.
    if (!this.hasCredential()) {
      this.log('warn', 'connection.waiting', '尚未完成设备绑定，平台登录状态将在本机检测并等待同步。');
      return;
    }

    const pollMs = Math.max(10, Number(this.config.pollSeconds) || 20) * 1000;
    this.pollTimer = setInterval(() => this.poll().catch((error) => {
      this.lastError = error.message;
      this.log('error', 'jobs.poll.failed', `读取任务失败：${error.message}`);
    }), pollMs);
    this.heartbeatTimer = setInterval(() => this.heartbeat().catch((error) => {
      this.lastError = error.message;
      this.log('error', 'device.heartbeat.failed', `设备心跳失败：${error.message}`);
    }), 30000);
  }

  async shutdown() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.loginSyncTimer) clearInterval(this.loginSyncTimer);
    this.loginWatchers.clear();
    await this.browser.closeAll();
  }
}

export { serializePlatformResult };
