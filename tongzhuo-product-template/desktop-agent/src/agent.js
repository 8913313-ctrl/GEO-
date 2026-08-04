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
    return Boolean(this.config.apiToken || this.config.pairingCode);
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
      activeJobId: this.activeJobId,
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
        status: account?.status === 'disabled' ? 'disabled' : 'unknown',
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
            updatedAt: now,
          },
        },
      };
    });
    if (changed) this.saveAccountGroups(nextGroups);
    return this.accountGroupById(groupId)?.accounts?.[platformId] || null;
  }

  configure(next) {
    this.config = writeConfig(next);
    this.client.updateConfig(this.config);
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
    await this.loadSessions().catch(() => {});
    this.restartTimers();
    this.log('info', 'device.register.done', '发布节点已完成绑定。');
    return result;
  }

  async heartbeat(extra = {}) {
    if (!this.hasCredential()) return null;
    const result = await this.client.heartbeat({ active_job_id: this.activeJobId, ...extra });
    this.lastHeartbeatAt = new Date().toISOString();
    this.lastError = null;
    return result;
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

  async poll() {
    if (!this.hasCredential()) {
      this.lastError = null;
      return [];
    }
    this.log('info', 'jobs.poll.start', '正在读取分发任务。');
    const response = await this.client.jobs(30);
    const items = Array.isArray(response?.data?.items)
      ? response.data.items
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.data)
          ? response.data
          : [];
    this.jobs = items;
    this.lastPollAt = new Date().toISOString();
    this.lastError = null;
    this.log('info', 'jobs.poll.done', `已读取 ${this.jobs.length} 个任务。`);
    await this.loadSessions().catch(() => {});
    if (this.config.autoRun) {
      const next = this.jobs.find((job) => job.status === 'queued');
      if (next) await this.runJob(next.id);
    }
    return this.jobs;
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
    await this.client.reportSession(platformId, {
      profile_key: profileKey,
      account_name: options.accountName || account.accountName || '',
      login_state: 'open',
      last_error_message: '',
      auto_allowed: false,
      meta: {
        event: 'login_window_opened',
        group_id: groupId,
        group_name: group?.name || '',
        url: result.url,
      },
    }).catch(() => {});
    this.updateAccountStatus(groupId, platformId, 'open', {
      accountName: options.accountName || account.accountName || '',
      lastErrorMessage: '',
    });
    await this.loadSessions().catch(() => {});
    this.startLoginWatch(platformId, groupId);
    this.log('info', 'platform.login.opened', `${platformId} 登录窗口已打开。`, { platform_id: platformId, group_id: groupId, url: result.url });
    return { ...result, loginDetection: 'automatic' };
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
    if (options.existingWindowOnly && probe.windowOpen === false) {
      this.updateAccountStatus(groupId, platformId, 'needs_login', {
        lastErrorMessage: probe.reason || 'login_window_closed',
      });
      return {
        platformId,
        groupId,
        profileKey,
        loginState: 'needs_login',
        loggedIn: false,
        windowOpen: false,
        reason: probe.reason || 'login_window_closed',
      };
    }
    if (!probe.loggedIn) {
      const reason = String(probe.reason || 'login_not_detected').toLowerCase();
      const loginState = reason === 'probe_failed'
        ? 'unknown'
        : /(captcha|verification|verify|risk|blocked|challenge|登录|验证)/i.test(reason)
          ? 'needs_verification'
          : 'needs_login';
      await this.client.reportSession(platformId, {
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
      }).catch(() => {});
      this.updateAccountStatus(groupId, platformId, loginState, {
        lastErrorMessage: reason,
      });
      await this.loadSessions().catch(() => {});
      return {
        platformId,
        groupId,
        profileKey,
        loginState,
        loggedIn: false,
        reason,
        url: probe.url || '',
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
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const group = this.accountGroupById(groupId);
        const account = group?.accounts?.[platformId];
        if (!account || !['open', 'needs_verification'].includes(account.status)) return null;
        const result = await this.checkLogin(platformId, {
          groupId,
          source: 'automatic_open_window',
          existingWindowOnly: true,
        }).catch(() => null);
        if (result?.loggedIn) {
          this.log('info', 'platform.login.detected', `${platformId} 登录已自动同步到后台。`, {
            platform_id: platformId,
            group_id: groupId,
            profile_key: this.profileKeyFor(groupId, platformId),
          });
          return result;
        }
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
    if (!this.hasCredential() || this.loginSyncInFlight) return [];
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

    await this.client.reportSession(platformId, {
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
    });

    this.updateAccountStatus(groupId, platformId, 'ready', {
      accountName: options.accountName || account.accountName || '',
      lastErrorMessage: '',
    });
    await this.heartbeat({
      event: 'platform_login_confirmed',
      platform_id: platformId,
      group_id: groupId,
      login_state: 'ready',
    }).catch(() => {});
    await this.loadSessions().catch(() => {});

    const result = {
      platformId,
      groupId,
      profileKey,
      loginState: 'ready',
      verifiedAt,
      autoAllowed: !isGuided,
      recheck: Boolean(options.recheck),
    };
    this.log('info', 'platform.login.confirm.done', `${platform.name} 登录检测通过，状态已同步到后台。`, {
      platform_id: platformId,
      group_id: groupId,
      ...result,
    });
    return result;
  }

  async runJob(id, selectedPlatforms = []) {
    if (this.activeJobId) throw new Error('当前已有任务正在执行。');
    this.activeJobId = Number(id);
    try {
      this.log('info', 'job.start', `开始执行任务 #${id}。`, {
        job_id: Number(id),
        selected_platforms: selectedPlatforms,
      });
      await this.heartbeat().catch(() => {});
      const job = await this.client.claimJob(id);
      const groupId = job?.account_group_id || job?.group_id || job?.payload?.account_group_id || job?.payload?.group_id || this.config.activeGroupId;
      const group = this.accountGroupById(groupId);
      if (!group) throw new Error('当前任务没有可用账号组，请先在本地发布器创建账号组。');
      const targetPlatforms = this.choosePlatforms(job, selectedPlatforms);
      if (!targetPlatforms.length) {
        throw new Error('当前发布节点没有可处理的平台。请检查分发渠道或升级执行器适配器。');
      }
      this.log('info', 'job.claimed', `任务 #${id} 已领取，准备执行 ${targetPlatforms.length} 个平台。`, {
        job_id: Number(id),
        platforms: targetPlatforms,
      });
      const results = {};
      for (const platformId of targetPlatforms) {
        results[platformId] = await this.runPlatformWithRetry(platformId, job, Number(id), group);
      }
      const payload = buildResultPayload({
        workerId: this.config.deviceId,
        platformResults: results,
      });
      await this.client.reportResult(id, payload.state, payload.message, payload);
      this.log('info', 'job.reported', `任务 #${id} 已回写 GEOFlow：${payload.state}。`, {
        job_id: Number(id),
        state: payload.state,
        next_operator_action: payload.next_operator_action,
        state_counts: payload.state_summary.state_counts,
      });
      await this.poll().catch(() => {});
      return { jobId: id, state: payload.state, platformResults: results, stateSummary: payload.state_summary };
    } catch (error) {
      this.log('error', 'job.failed', `任务 #${id} 执行失败：${error.message}`, { job_id: Number(id) });
      await this.client.reportResult(id, 'failed', error.message).catch(() => {});
      throw error;
    } finally {
      this.activeJobId = null;
      await this.heartbeat().catch(() => {});
    }
  }

  async runPlatformWithRetry(platformId, job, jobId, group = this.accountGroupById()) {
    const maxAttempts = Math.max(1, Number(this.config.maxJobAttempts) || 1);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.log('info', 'platform.run.start', `开始处理平台 ${platformId}。`, {
        job_id: jobId,
        platform_id: platformId,
        attempt,
        max_attempts: maxAttempts,
      });
      try {
        const profileKey = this.profileKeyFor(group?.id, platformId);
        const result = await this.browser.openEditor(platformId, job?.payload || {}, { profileKey });
        const serialized = {
          ...serializePlatformResult(result),
          platform: platformId,
          window_id: result.windowId || null,
          attempt,
          max_attempts: maxAttempts,
        };
        await this.syncPlatformSession(platformId, serialized, group).catch(() => {});
        this.log(serialized.state === 'failed' ? 'error' : 'info', 'platform.run.done', `${platformId} 返回状态：${serialized.state}。`, {
          job_id: jobId,
          platform_id: platformId,
          state: serialized.state,
          message: serialized.message,
          remote_url: serialized.remote_url,
          attempt,
        });
        return serialized;
      } catch (error) {
        const decision = retryDecision(error, attempt, maxAttempts);
        this.log(decision.should_retry ? 'warn' : 'error', 'platform.run.failed', `${platformId} 执行失败：${error.message}`, {
          job_id: jobId,
          platform_id: platformId,
          attempt,
          max_attempts: maxAttempts,
          failure_category: decision.category,
          retryable: decision.retryable,
          should_retry: decision.should_retry,
        });
        if (decision.should_retry) continue;
        return {
          platform: platformId,
          state: 'failed',
          message: error.message,
          attempt,
          max_attempts: maxAttempts,
          failure_category: decision.category,
          retryable: decision.retryable,
          next_action: decision.next_action,
        };
      }
    }
    return {
      platform: platformId,
      state: 'failed',
      message: 'Platform execution failed after retry policy ended.',
      attempt: maxAttempts,
      max_attempts: maxAttempts,
      failure_category: 'retry_exhausted',
      retryable: false,
      next_action: 'operator_inspect_failed_platforms',
    };
  }

  choosePlatforms(job, selectedPlatforms) {
    const jobPlatforms = Array.isArray(job?.platforms) ? job.platforms : [];
    const selected = Array.isArray(selectedPlatforms) ? selectedPlatforms : [];
    const allowed = selected.length ? selected.filter((id) => jobPlatforms.includes(id)) : jobPlatforms;
    return allowed.filter((id) => this.config.capabilities.includes(id));
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
      || /(login|captcha|verify|verification|risk|登录|验证码|验证|风控)/i.test(String(result.message || ''));
    // A draft/submit result proves the profile was usable. Conversely, a
    // normal editor or save failure is not evidence that the account logged
    // out, so retain the last verified login state in that case.
    const preservedLoginState = ['published', 'draft_saved'].includes(state)
      ? 'ready'
      : authenticationFailure
        ? 'needs_verification'
        : normalizedExistingState;
    const isGuided = platform?.execution?.mode === 'assisted' || platform?.support === 'manual' || platform?.support === 'planned';

    await this.client.reportSession(platformId, {
      profile_key: profileKey,
      account_name: currentAccount.accountName || '',
      login_state: preservedLoginState,
      last_verified_at: ['published', 'draft_saved'].includes(state) ? new Date().toISOString() : null,
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
    });
    this.updateAccountStatus(group?.id, platformId, preservedLoginState, {
      lastErrorMessage: state === 'failed' ? (result.message || '') : '',
    });
    await this.loadSessions().catch(() => {});
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

    if (!this.hasCredential()) {
      this.log('warn', 'connection.waiting', '尚未完成设备绑定，当前仅保留本地控制台。');
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
