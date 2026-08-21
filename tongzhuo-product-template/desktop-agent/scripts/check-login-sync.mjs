import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

process.env.NODE_ENV = 'test';
process.env.TZ_AGENT_ALLOW_INSECURE_DEV_KEY = '1';

function testTempRoot() {
  const configured = String(process.env.TZ_AGENT_TEST_TMPDIR || '').trim();
  const root = path.resolve(configured || path.join(process.env.SystemDrive || 'C:', 'tmp'));
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeTemporaryDataDir(directory) {
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.promises.rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200,
      });
      if (!fs.existsSync(directory)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250 * (attempt + 1));
  }
  if (fs.existsSync(directory)) {
    const suffix = lastError ? `: ${lastError.message}` : '';
    throw new Error(`Unable to remove test data directory ${directory}${suffix}`);
  }
}

function loadAppStateHooks() {
  const appPath = new URL('../public/app.js', import.meta.url);
  const source = fs.readFileSync(appPath, 'utf8');
  const eventBinding = '\ndocument.addEventListener(\'click\',';
  const bindingStart = source.indexOf(eventBinding);
  assert.notEqual(bindingStart, -1, 'Unable to find app event bindings for isolated state test');
  const isolatedSource = `${source.slice(0, bindingStart)}\n;globalThis.__loginSyncTestHooks = { state, platformState, sessionFor, accountRowState };`;
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
    window: {},
    document: {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(isolatedSource, sandbox, { filename: appPath.pathname });
  return sandbox.__loginSyncTestHooks;
}

const temporaryDataDir = fs.mkdtempSync(path.join(testTempRoot(), 'tongzhuo-agent-login-sync-'));
process.once('exit', () => {
  try {
    fs.rmSync(temporaryDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    if (fs.existsSync(temporaryDataDir)) {
      console.error(`Unable to remove login-sync test data directory on exit: ${error.message}`);
      process.exitCode = 1;
    }
  }
});
const originalDataDir = process.env.TZ_AGENT_DATA_DIR;
process.env.TZ_AGENT_DATA_DIR = temporaryDataDir;
let restorePlatformBrowserContext = () => {};
const platformId = 'baijiahao';
const groupId = 'group-default';

function account(status = 'needs_login') {
  return {
    platformId,
    accountName: '测试账号',
    status,
    profileKey: `${groupId}--${platformId}`,
  };
}

function accountGroups(status = 'needs_login') {
  return [{
    id: groupId,
    name: '默认账号组',
    status: 'active',
    accounts: { [platformId]: account(status) },
  }];
}

function readOnlyPage({
  url = 'https://www.woshipm.com/',
  title = 'Platform page',
  visible = [],
  attached = [],
  bodyText = '',
} = {}) {
  const visibleSelectors = new Set(visible);
  const attachedSelectors = new Set(attached);
  return {
    url: () => url,
    title: async () => title,
    isClosed: () => false,
    goto: async () => {},
    waitForTimeout: async () => {},
    locator: (selector) => {
      const locator = {
        first: () => locator,
        isVisible: async () => visibleSelectors.has(selector),
        count: async () => attachedSelectors.has(selector) ? 1 : 0,
        evaluate: async () => selector === 'body' ? bodyText : '',
      };
      return locator;
    },
  };
}

try {
  const { readConfig, writeConfig } = await import('../src/config-store.js');
  const { TongzhuoDesktopAgent } = await import('../src/agent.js');
  const { GeoFlowRequestError, isInvalidPairingResponse } = await import('../src/geoflow-client.js');
  const { PlatformBrowser } = await import('../src/platform-browser.js');
  const { detectAccessBlocked } = await import('../src/adapters/fill-tools.js');
  // The unit-level checks below replace each Agent browser with a stub. Guard
  // the shared prototype too, so an accidental asynchronous probe cannot
  // launch Chrome/Edge and recreate the temporary profile during cleanup.
  const originalPlatformBrowserContext = PlatformBrowser.prototype.context;
  PlatformBrowser.prototype.context = async () => {
    throw new Error('Unexpected real browser context in check-login-sync.mjs');
  };
  restorePlatformBrowserContext = () => {
    PlatformBrowser.prototype.context = originalPlatformBrowserContext;
  };
  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'paired',
    pairingToken: 'paired-token',
    pairedAt: '2026-08-01T00:00:00.000Z',
    accountGroups: accountGroups(),
  });

  const onlineAgent = new TongzhuoDesktopAgent();
  onlineAgent.client.reportSession = async () => {
    throw new Error('后台暂时不可用');
  };
  onlineAgent.heartbeat = async () => null;

  const confirmed = await onlineAgent.confirmLogin(platformId, { groupId, source: 'automatic_probe' });
  let savedAccount = onlineAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(confirmed.loginState, 'ready');
  assert.equal(confirmed.syncState, 'pending');
  assert.equal(savedAccount.status, 'ready');
  assert.ok(savedAccount.lastVerifiedAt);
  assert.equal(savedAccount.syncState, 'pending');
  assert.equal(savedAccount.pendingSession.login_state, 'ready');
  assert.match(savedAccount.lastSyncError, /后台暂时不可用/);
  assert.equal(readConfig().accountGroups[0].accounts[platformId].status, 'ready');
  await onlineAgent.shutdown();

  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'paired',
    pairingToken: 'stale-pairing-token',
    pairedAt: '2026-08-01T00:00:00.000Z',
    accountGroups: accountGroups(),
  });

  const invalidatedAgent = new TongzhuoDesktopAgent();
  invalidatedAgent.client.reportSession = async () => {
    const error = new GeoFlowRequestError('publisher device gone', {
      status: 404,
      code: 'PUBLISHER_DEVICE_NOT_FOUND',
    });
    invalidatedAgent.invalidatePairing(error);
    throw error;
  };
  invalidatedAgent.heartbeat = async () => null;

  const invalidated = await invalidatedAgent.confirmLogin(platformId, { groupId, source: 'automatic_probe' });
  savedAccount = invalidatedAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(invalidated.syncState, 'waiting_for_pairing');
  assert.equal(savedAccount.status, 'ready');
  assert.equal(savedAccount.syncState, 'waiting_for_pairing');
  assert.equal(savedAccount.pendingSession.login_state, 'ready');
  assert.equal(readConfig().pairingToken, '');
  await invalidatedAgent.shutdown();
  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: accountGroups(),
  });

  const offlineAgent = new TongzhuoDesktopAgent();
  let reportAttempts = 0;
  let passiveInspectAttempts = 0;
  let scheduledProfileProbeAttempts = 0;
  offlineAgent.client.reportSession = async () => {
    reportAttempts += 1;
    throw new Error('未配对时不应调用后台');
  };
  offlineAgent.browser = {
    inspectLoginPages: async () => {
      passiveInspectAttempts += 1;
      return { loggedIn: false, windowOpen: false, reason: 'login_window_closed' };
    },
    probeLogin: async () => {
      scheduledProfileProbeAttempts += 1;
      return { loggedIn: true, url: 'https://example.com/editor' };
    },
    status: () => ({ windowCount: 0, profileCount: 0, windows: [] }),
    closeAll: async () => {},
  };

  const localResults = await offlineAgent.syncLoginStates();
  savedAccount = offlineAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(localResults.length, 1);
  assert.equal(localResults[0].loginState, 'ready');
  assert.equal(savedAccount.status, 'ready');
  assert.equal(passiveInspectAttempts, 0);
  assert.equal(scheduledProfileProbeAttempts, 1, 'scheduled login sync must probe a persisted profile when no login window exists');
  assert.equal(savedAccount.syncState, 'waiting_for_pairing');
  assert.equal(reportAttempts, 0);
  const manualResult = await offlineAgent.checkLogin(platformId, { groupId, source: 'operator_recheck' });
  assert.equal(manualResult.loginState, 'ready');
  savedAccount = offlineAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(savedAccount.syncState, 'waiting_for_pairing');
  assert.equal(scheduledProfileProbeAttempts, 2, 'an explicit operator check may probe the persistent profile again');
  await offlineAgent.shutdown();

  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: accountGroups('ready'),
  });
  const periodicOpenAgent = new TongzhuoDesktopAgent();
  let periodicOpenInspections = 0;
  let periodicOpenProfileProbes = 0;
  periodicOpenAgent.browser = {
    status: () => ({
      windows: [{
        platformId,
        profileKey: `${groupId}--${platformId}`,
        kind: 'login',
        driver: 'native',
        closed: false,
      }],
    }),
    inspectLoginPages: async () => {
      periodicOpenInspections += 1;
      return { loggedIn: true, windowOpen: true, url: 'https://example.com/editor' };
    },
    probeLogin: async () => {
      periodicOpenProfileProbes += 1;
      throw new Error('an open native page should be inspected instead of probing its locked profile');
    },
    closeAll: async () => {},
  };
  const periodicOpenResults = await periodicOpenAgent.syncLoginStates();
  assert.equal(periodicOpenResults[0].loginState, 'ready');
  assert.equal(periodicOpenInspections, 1, 'periodic sync must inspect an attached native login window');
  assert.equal(periodicOpenProfileProbes, 0);
  await periodicOpenAgent.shutdown();

  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: accountGroups('ready'),
  });
  const inconclusivePeriodicAgent = new TongzhuoDesktopAgent();
  let inconclusiveSyncAttempts = 0;
  inconclusivePeriodicAgent.syncAccountSession = async () => {
    inconclusiveSyncAttempts += 1;
    // A preserved ready account refreshes its backend session with
    // auto_allowed=true; it must never be reported as logged out.
    return { synced: true, queued: false, syncState: 'synced', syncedAt: new Date().toISOString() };
  };
  inconclusivePeriodicAgent.browser = {
    status: () => ({ windows: [] }),
    inspectLoginPages: async () => { throw new Error('there is no open window to inspect'); },
    probeLogin: async () => ({
      loggedIn: false,
      reason: 'authenticated_signal_not_found',
      inconclusive: true,
      url: 'https://example.com/',
    }),
    closeAll: async () => {},
  };
  const inconclusivePeriodicResults = await inconclusivePeriodicAgent.syncLoginStates();
  savedAccount = inconclusivePeriodicAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(inconclusivePeriodicResults[0].inconclusiveProbe, true);
  assert.equal(inconclusivePeriodicResults[0].loginState, 'ready');
  assert.equal(savedAccount.status, 'ready', 'absence of a known positive selector must not be treated as logged out');
  assert.equal(savedAccount.lastErrorMessage, 'session_signal_inconclusive');
  assert.equal(inconclusiveSyncAttempts, 1, 'a preserved ready account must refresh its backend session (auto_allowed=true)');
  await inconclusivePeriodicAgent.shutdown();

  // A captcha overlay on a previously verified editor session is a risk gate,
  // not proof of logout. Preserve the login state while disabling unattended
  // publishing in the session report. A real redirect to a login/verification
  // URL must still downgrade the same account.
  const verifiedBeforeChallenge = '2026-08-15T08:00:00.000Z';
  const challengeGroups = accountGroups('ready');
  challengeGroups[0].accounts[platformId].lastVerifiedAt = verifiedBeforeChallenge;
  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: challengeGroups,
  });
  const challengeAgent = new TongzhuoDesktopAgent();
  const challengeReports = [];
  let challengeReason = 'verification_overlay';
  challengeAgent.syncAccountSession = async (_groupId, _platformId, session) => {
    challengeReports.push(session);
    return { synced: true, syncState: 'synced' };
  };
  challengeAgent.loadSessions = async () => [];
  challengeAgent.browser = {
    status: () => ({ windowCount: 0, profileCount: 0, windows: [] }),
    probeLogin: async () => ({
      loggedIn: false,
      reason: challengeReason,
      url: challengeReason === 'verification_overlay'
        ? 'https://post.smzdm.com/'
        : 'https://example.com/login',
    }),
    closeAll: async () => {},
  };
  const challengeResult = await challengeAgent.checkLogin(platformId, {
    groupId,
    source: 'scheduled_probe',
  });
  savedAccount = challengeAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(challengeResult.loginState, 'ready');
  assert.equal(challengeResult.loggedIn, false, 'a risk challenge must not claim a fresh positive login probe');
  assert.equal(challengeResult.riskVerificationRequired, true);
  assert.equal(challengeResult.localStatePreserved, true);
  assert.equal(savedAccount.status, 'ready', 'a challenge overlay must not erase a previously verified login');
  assert.equal(savedAccount.lastVerifiedAt, verifiedBeforeChallenge);
  assert.equal(savedAccount.lastErrorMessage, 'verification_overlay');
  assert.equal(challengeReports[0].login_state, 'ready');
  assert.equal(challengeReports[0].auto_allowed, false, 'risk-gated sessions must not allow unattended publishing');
  assert.equal(challengeReports[0].last_verified_at, verifiedBeforeChallenge);
  assert.equal(challengeReports[0].meta.risk_verification_required, true);

  challengeReason = 'login_or_verification_url';
  const loginRedirectResult = await challengeAgent.checkLogin(platformId, {
    groupId,
    source: 'scheduled_probe',
  });
  savedAccount = challengeAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(loginRedirectResult.loginState, 'needs_verification');
  assert.equal(loginRedirectResult.localStatePreserved, undefined);
  assert.equal(savedAccount.status, 'needs_verification', 'an explicit login URL redirect must still invalidate ready');
  assert.equal(savedAccount.lastVerifiedAt, '');
  assert.equal(challengeReports[1].login_state, 'needs_verification');
  assert.equal(challengeReports[1].auto_allowed, false);
  await challengeAgent.shutdown();

  assert.equal(isInvalidPairingResponse(new GeoFlowRequestError('Not Found', { status: 404 })), false);
  assert.equal(isInvalidPairingResponse(new GeoFlowRequestError('设备不存在。', {
    status: 404,
    code: 'PUBLISHER_DEVICE_NOT_FOUND',
  })), true);

  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: accountGroups('ready'),
  });
  const nativeInProgressAgent = new TongzhuoDesktopAgent();
  let nativeReportAttempts = 0;
  nativeInProgressAgent.client.reportSession = async () => {
    nativeReportAttempts += 1;
    throw new Error('人工登录进行中不应上报降级状态');
  };
  nativeInProgressAgent.browser = {
    inspectLoginPages: async () => ({
      loggedIn: false,
      manualLoginInProgress: true,
      windowOpen: true,
      reason: 'manual_login_in_progress',
    }),
    probeLogin: async () => ({
      loggedIn: false,
      manualLoginInProgress: true,
      windowOpen: true,
      reason: 'manual_login_in_progress',
    }),
    status: () => ({ windowCount: 1, profileCount: 1, windows: [] }),
    closeAll: async () => {},
  };
  const nativeInProgress = await nativeInProgressAgent.checkLogin(platformId, {
    groupId,
    existingWindowOnly: true,
  });
  savedAccount = nativeInProgressAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(nativeInProgress.manualLoginInProgress, true);
  assert.equal(nativeInProgress.loginState, 'ready');
  assert.equal(savedAccount.status, 'ready');
  assert.equal(nativeReportAttempts, 0);
  await nativeInProgressAgent.shutdown();

  // A normal Chrome/Edge login page is observed read-only over its localhost
  // CDP endpoint. A positive Woshipm account avatar must be accepted while the
  // window is still open, before generic text such as a hidden login/logout
  // menu is interpreted as a verification gate.
  const liveProfileKey = `${groupId}--woshipm`;
  const livePage = readOnlyPage({
    visible: ['.pm--metabar__dropdown > img.avatar'],
    bodyText: '立即登录 退出登录',
  });
  let connectedEndpoint = '';
  const fakeCdpBrowser = {
    isConnected: () => true,
    contexts: () => [{ pages: () => [livePage] }],
    on: () => {},
  };
  const liveBrowser = new PlatformBrowser({
    connectOverCDP: async (endpoint) => {
      connectedEndpoint = endpoint;
      return fakeCdpBrowser;
    },
  });
  liveBrowser.nativeLoginRecords.set(liveProfileKey, {
    id: 'native-live-woshipm',
    platformId: 'woshipm',
    profileKey: liveProfileKey,
    openedAt: new Date().toISOString(),
    url: 'https://www.woshipm.com/',
    title: '人人都是产品经理',
    debugPort: 43125,
    closed: false,
  });
  liveBrowser.nativeLoginProcesses.set(liveProfileKey, { exitCode: null });
  const liveWindowResult = await liveBrowser.inspectLoginPages('woshipm', { profileKey: liveProfileKey });
  assert.equal(connectedEndpoint, 'http://127.0.0.1:43125');
  assert.equal(liveWindowResult.loggedIn, true, 'a positive native-page session signal must be emitted before the window closes');
  assert.equal(liveWindowResult.windowOpen, true);
  assert.equal(liveWindowResult.driver, 'native-cdp');
  assert.equal(liveWindowResult.loginSignal, '.pm--metabar__dropdown > img.avatar');

  const presencePage = readOnlyPage({
    attached: ['a[href="/me/posts"]'],
    bodyText: '退出登录',
  });
  fakeCdpBrowser.contexts = () => [{ pages: () => [presencePage] }];
  const presenceWindowResult = await liveBrowser.inspectLoginPages('woshipm', { profileKey: liveProfileKey });
  assert.equal(presenceWindowResult.loggedIn, true, 'safe hidden account controls may confirm a native session by attachment');
  assert.equal(presenceWindowResult.loginSignal, 'a[href="/me/posts"]');
  assert.equal(presenceWindowResult.loginSignalSource, 'platform_session_presence_selector');

  const hiddenLogoutOnly = readOnlyPage({ bodyText: '退出登录' });
  const hiddenLogoutResult = await detectAccessBlocked(hiddenLogoutOnly);
  assert.equal(hiddenLogoutResult.blocked, false, 'hidden/account-menu 退出登录 text must not become verification_message');

  const fallbackBrowser = new PlatformBrowser({
    connectOverCDP: async () => { throw new Error('endpoint not ready'); },
  });
  fallbackBrowser.nativeLoginRecords.set(liveProfileKey, {
    id: 'native-fallback-woshipm',
    platformId: 'woshipm',
    profileKey: liveProfileKey,
    openedAt: new Date().toISOString(),
    url: 'https://www.woshipm.com/',
    title: '人人都是产品经理',
    debugPort: 43126,
    closed: false,
  });
  fallbackBrowser.nativeLoginProcesses.set(liveProfileKey, { exitCode: null });
  const fallbackWindowResult = await fallbackBrowser.inspectLoginPages('woshipm', { profileKey: liveProfileKey });
  assert.equal(fallbackWindowResult.manualLoginInProgress, true, 'CDP attachment failure must preserve the native-window fallback');
  assert.equal(fallbackWindowResult.windowOpen, true);

  // Every platform uses the native Chrome/Edge login route. Once that browser
  // closes, the watcher must probe the persistent profile before stopping;
  // previously this post-close probe was limited to Zhihu.
  const nativeCloseWatchCalls = [];
  const nativeCloseWatchStub = {
    config: { activeGroupId: groupId },
    loginWatchers: new Map(),
    loginWatchRetryDelays: [0],
    accountGroupById: (id) => id === groupId ? accountGroups('needs_login')[0] : null,
    profileKeyFor: (id, targetPlatformId) => `${id}--${targetPlatformId}`,
    checkLogin: async (targetPlatformId, options = {}) => {
      nativeCloseWatchCalls.push({ targetPlatformId, ...options });
      return options.existingWindowOnly
        ? { platformId: targetPlatformId, windowOpen: false, reason: 'login_window_closed' }
        : { platformId: targetPlatformId, loggedIn: true, syncState: 'synced' };
    },
    log: () => {},
  };
  const nativeCloseWatchResult = await TongzhuoDesktopAgent.prototype.startLoginWatch.call(nativeCloseWatchStub, platformId, groupId);
  assert.equal(nativeCloseWatchResult.loggedIn, true, 'a generic native login must probe after its window closes');
  assert.equal(nativeCloseWatchCalls.length, 2, 'generic native login must make an existing-window check and a profile probe');
  assert.equal(nativeCloseWatchCalls[0].existingWindowOnly, true);
  assert.equal(nativeCloseWatchCalls[1].afterLoginWindowClose, true);

  const failedNativeCloseWatchCalls = [];
  const failedNativeCloseWatchStub = {
    ...nativeCloseWatchStub,
    loginWatchers: new Map(),
    checkLogin: async (targetPlatformId, options = {}) => {
      failedNativeCloseWatchCalls.push({ targetPlatformId, ...options });
      return options.existingWindowOnly
        ? { platformId: targetPlatformId, windowOpen: false, reason: 'login_window_closed' }
        : { platformId: targetPlatformId, loggedIn: false, loginState: 'needs_login', reason: 'authenticated_signal_not_found' };
    },
  };
  const failedNativeCloseWatchResult = await TongzhuoDesktopAgent.prototype.startLoginWatch.call(failedNativeCloseWatchStub, platformId, groupId);
  assert.equal(failedNativeCloseWatchResult.loggedIn, false);
  assert.equal(failedNativeCloseWatchCalls.length, 2, 'a failed post-close probe must stop instead of restarting every three seconds');

  const delayedProfileReleaseCalls = [];
  const delayedProfileReleaseStub = {
    ...nativeCloseWatchStub,
    loginWatchers: new Map(),
    loginWatchRetryDelays: [0, 0, 0],
    checkLogin: async (targetPlatformId, options = {}) => {
      delayedProfileReleaseCalls.push({ targetPlatformId, ...options });
      if (options.existingWindowOnly) {
        return { platformId: targetPlatformId, windowOpen: false, reason: 'login_window_closed' };
      }
      const postCloseCall = delayedProfileReleaseCalls.filter((item) => item.afterLoginWindowClose).length;
      return postCloseCall < 3
        ? { platformId: targetPlatformId, loggedIn: false, reason: 'profile_locked', transientProbeFailure: true }
        : { platformId: targetPlatformId, loggedIn: true, loginState: 'ready', syncState: 'synced' };
    },
  };
  const delayedProfileReleaseResult = await TongzhuoDesktopAgent.prototype.startLoginWatch.call(
    delayedProfileReleaseStub,
    platformId,
    groupId,
  );
  assert.equal(delayedProfileReleaseResult.loggedIn, true, 'the close watcher must keep retrying while Chrome releases its profile');
  assert.equal(delayedProfileReleaseCalls.length, 4, 'the bounded close watcher must retry transient profile locks until success');
  assert.equal(delayedProfileReleaseCalls[3]._profileReleaseRetryExhausted, true);

  let staleWatcherStarts = 0;
  const staleRestartStub = {
    config: { loginCheckSeconds: 300, pollSeconds: 20 },
    pollTimer: null,
    heartbeatTimer: null,
    loginSyncTimer: null,
    browser: { status: () => ({ windows: [] }) },
    stopEventStream: () => null,
    startEventStream: () => null,
    groupIdForProfile: () => groupId,
    startLoginWatch: () => { staleWatcherStarts += 1; },
    syncLoginStates: async () => [],
    hasCredential: () => false,
    log: () => {},
  };
  TongzhuoDesktopAgent.prototype.restartTimers.call(staleRestartStub);
  await Promise.resolve();
  clearInterval(staleRestartStub.loginSyncTimer);
  assert.equal(staleWatcherStarts, 0, 'restart must not recreate a watcher without a real login window');

  // A transient profile lock after closing Chrome/Edge must not downgrade the
  // account immediately. The post-close probe retries once and confirms the
  // persisted session when the profile becomes available.
  const profileReleaseProbeCalls = [];
  const profileReleaseRetryStub = {
    config: { activeGroupId: groupId },
    accountGroupById: (id) => id === groupId ? {
      id: groupId,
      name: 'Default group',
      accounts: {
        [platformId]: {
          platformId,
          accountName: 'Test account',
          status: 'needs_login',
          profileKey: `${groupId}--${platformId}`,
        },
      },
    } : null,
    profileKeyFor: (id, targetPlatformId) => `${id}--${targetPlatformId}`,
    browser: {
      probeLogin: async (targetPlatformId, options = {}) => {
        profileReleaseProbeCalls.push({ targetPlatformId, ...options });
        return profileReleaseProbeCalls.length === 1
          ? { loggedIn: false, reason: 'probe_failed', url: 'https://example.com/editor' }
          : { loggedIn: true, url: 'https://example.com/editor' };
      },
    },
    updateAccountStatus: () => {
      throw new Error('A retryable probe failure must not downgrade local login state.');
    },
    syncAccountSession: async () => {
      throw new Error('A retryable probe failure must not be synced as a logout.');
    },
    confirmLogin: async (targetPlatformId, options = {}) => ({
      platformId: targetPlatformId,
      groupId: options.groupId,
      loginState: 'ready',
      syncState: 'synced',
    }),
  };
  const profileReleaseRetryCalls = [];
  profileReleaseRetryStub.checkLogin = (...args) => {
    profileReleaseRetryCalls.push(args[1] || {});
    return TongzhuoDesktopAgent.prototype.checkLogin.call(profileReleaseRetryStub, ...args);
  };
  const profileReleaseRetry = await TongzhuoDesktopAgent.prototype.checkLogin.call(profileReleaseRetryStub, platformId, {
    groupId,
    afterLoginWindowClose: true,
  });
  assert.equal(profileReleaseRetry.loginState, 'ready');
  assert.equal(profileReleaseProbeCalls.length, 2, 'post-close probe_failed must retry once before changing login state');
  assert.equal(profileReleaseRetryCalls.length, 1, 'post-close probe_failed must re-enter checkLogin exactly once after the first retry');
  assert.equal(profileReleaseRetryCalls[0]._profileReleaseRetry, true);
  assert.equal(profileReleaseRetryCalls[0]._profileReleaseRetryAttempt, 1);
  assert.equal(profileReleaseRetryCalls[0].afterLoginWindowClose, true);
  const nativePlatformId = 'zhihu';
  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'token',
    pairingToken: '',
    pairedAt: '',
    accountGroups: [{
      id: groupId,
      name: '默认账号组',
      status: 'active',
      accounts: {
        [nativePlatformId]: {
          platformId: nativePlatformId,
          accountName: '已登录知乎账号',
          status: 'ready',
          profileKey: `${groupId}--${nativePlatformId}`,
        },
      },
    }],
  });
  const readyNativeAgent = new TongzhuoDesktopAgent();
  let watchCalls = 0;
  let openedProfileKey = '';
  const expectedWindow = {
    platformId: nativePlatformId,
    profileKey: `${groupId}--${nativePlatformId}`,
    windowId: 'native-window-ready-account',
    url: 'https://www.zhihu.com/signin?next=%2F',
    title: '知乎人工登录',
    driver: 'native',
  };
  readyNativeAgent.browser = {
    openLogin: async (openedPlatformId, options = {}) => {
      assert.equal(openedPlatformId, nativePlatformId);
      openedProfileKey = options.profileKey;
      return expectedWindow;
    },
    status: () => ({ windowCount: 1, profileCount: 1, windows: [expectedWindow] }),
    closeAll: async () => {},
  };
  readyNativeAgent.startLoginWatch = (watchedPlatformId, watchedGroupId) => {
    watchCalls += 1;
    assert.equal(watchedPlatformId, nativePlatformId);
    assert.equal(watchedGroupId, groupId);
    return Promise.resolve(null);
  };
  const openedReadyNative = await readyNativeAgent.openLogin(nativePlatformId, { groupId });
  savedAccount = readyNativeAgent.publicStatus().accountGroups[0].accounts[nativePlatformId];
  assert.equal(openedReadyNative.driver, 'native');
  assert.equal(openedReadyNative.loginDetection, 'live_native_or_after_close');
  assert.equal(openedProfileKey, `${groupId}--${nativePlatformId}`);
  assert.equal(savedAccount.status, 'ready', 'reopening native login must preserve an already ready account');
  assert.equal(watchCalls, 1, 'a ready account reopening native login must still start the watcher');
  await readyNativeAgent.shutdown();

  const initialBlankPage = {
    url: () => 'about:blank',
    isClosed: () => false,
    on: () => {},
  };
  let newPageCalls = 0;
  const fakeContext = {
    pages: () => [initialBlankPage],
    newPage: async () => {
      newPageCalls += 1;
      return initialBlankPage;
    },
  };
  const browser = new PlatformBrowser();
  browser.context = async () => fakeContext;
  const pageRecord = await browser.managedPage(platformId, `${groupId}--${platformId}`);
  assert.equal(pageRecord.page, initialBlankPage);
  assert.equal(newPageCalls, 0);

  let backgroundProbeUrl = 'about:blank';
  let backgroundProbeClosed = 0;
  const backgroundProbeLaunches = [];
  const backgroundProbePage = {
    url: () => backgroundProbeUrl,
    isClosed: () => false,
    goto: async (url) => { backgroundProbeUrl = url; },
    waitForTimeout: async () => {},
    title: async () => 'Background login probe',
    locator: () => {
      const locator = {
        first: () => locator,
        isVisible: async () => false,
        evaluate: async () => '',
      };
      return locator;
    },
  };
  const backgroundProbeContext = {
    pages: () => [backgroundProbePage],
    newPage: async () => { throw new Error('the headless startup page should be reused'); },
    close: async () => { backgroundProbeClosed += 1; },
  };
  const backgroundProbeBrowser = new PlatformBrowser({
    launchPersistentBrowser: async (profile, runtime) => {
      backgroundProbeLaunches.push({ profile, runtime });
      return backgroundProbeContext;
    },
  });
  const backgroundProbePlatformId = 'weibo';
  const backgroundProbeResult = await backgroundProbeBrowser.probeLogin(backgroundProbePlatformId, {
    profileKey: `${groupId}--${backgroundProbePlatformId}`,
  });
  assert.equal(backgroundProbeLaunches.length, 1);
  assert.equal(backgroundProbeLaunches[0].runtime.headless, true, 'profile probes must always use a headless browser');
  assert.equal(backgroundProbeClosed, 1, 'a successful profile probe must close its whole temporary context');
  assert.equal(backgroundProbeResult.reason, 'authenticated_signal_not_found');
  assert.equal(backgroundProbeBrowser.contexts.size, 0);
  assert.equal(backgroundProbeBrowser.pages.size, 0, 'a profile probe must not leave a tracked about:blank page');

  // A browser.close() request can hang after the probe has already produced a
  // result. The probe must invoke its strictly-owned process cleanup callback
  // instead of leaving a headless Chrome root process alive indefinitely.
  let forcedCleanupProfile = '';
  const hangingClosePage = readOnlyPage({ url: 'https://weibo.com/' });
  const hangingCloseContext = {
    pages: () => [hangingClosePage],
    newPage: async () => { throw new Error('the hanging-close probe should reuse its startup page'); },
    browser: () => ({ close: () => new Promise(() => {}) }),
    close: async () => {},
  };
  const hangingCloseBrowser = new PlatformBrowser({
    launchPersistentBrowser: async () => hangingCloseContext,
    transientProbeCloseTimeoutMs: 5,
    terminateTransientProbe: async (profile) => { forcedCleanupProfile = profile; return [12345]; },
  });
  const hangingCloseResult = await hangingCloseBrowser.probeLogin('weibo', {
    profileKey: groupId + '--weibo-hanging-close',
  });
  assert.equal(hangingCloseResult.reason, 'authenticated_signal_not_found');
  assert.match(forcedCleanupProfile, /group-default--weibo-hanging-close$/);
  assert.equal(hangingCloseBrowser.profileProbeStarts.size, 0);

  // Platform-catalog login markers that were observed on real creator pages
  // must remain positive profile-probe signals. Keep these exact selectors in
  // regression coverage because their names are not discoverable through the
  // generic editor-field fallback.
  const platformSelectorCases = [
    { platformId: 'cnblogs', selector: '.top-nav', url: 'https://i.cnblogs.com/' },
    { platformId: 'eastmoney', selector: '#topnav_login', url: 'https://www.eastmoney.com/' },
    { platformId: 'sohu', selector: '#header-user', url: 'https://mp.sohu.com/' },
    { platformId: 'toutiao', selector: '.user-auth-avator', url: 'https://mp.toutiao.com/' },
    {
      platformId: 'bilibili',
      selector: '.header a.avatar.el-popover__reference',
      url: 'https://member.bilibili.com/platform/upload/text/new-edit',
      verificationSelector: '[class*="captcha" i]',
      bodyText: 'risk-captcha 验证码',
    },
    {
      platformId: 'bilibili',
      selector: '.header .logout',
      url: 'https://member.bilibili.com/platform/upload/text/new-edit',
      presence: true,
    },
  ];
  for (const selectorCase of platformSelectorCases) {
    let transientBrowserCloseCalls = 0;
    let transientContextCloseCalls = 0;
    let transientCloseReason = '';
    const selectorPage = readOnlyPage({
      url: selectorCase.url,
      visible: [
        ...(selectorCase.presence ? [] : [selectorCase.selector]),
        ...(selectorCase.verificationSelector ? [selectorCase.verificationSelector] : []),
      ],
      attached: selectorCase.presence ? [selectorCase.selector] : [],
      bodyText: selectorCase.bodyText || '',
    });
    const transientBrowser = {
      close: async (options = {}) => {
        transientBrowserCloseCalls += 1;
        transientCloseReason = options.reason || '';
      },
    };
    const selectorContext = {
      pages: () => [selectorPage],
      newPage: async () => { throw new Error('the selector probe startup page should be reused'); },
      browser: () => transientBrowser,
      close: async () => { transientContextCloseCalls += 1; },
    };
    const selectorProbeBrowser = new PlatformBrowser({
      launchPersistentBrowser: async () => selectorContext,
    });
    const selectorResult = await selectorProbeBrowser.probeLogin(selectorCase.platformId, {
      profileKey: `${groupId}--${selectorCase.platformId}`,
    });
    assert.equal(selectorResult.loggedIn, true, `${selectorCase.platformId} must recognize ${selectorCase.selector}`);
    assert.equal(selectorResult.loginSignal, selectorCase.selector);
    assert.equal(
      selectorResult.loginSignalSource,
      selectorCase.presence ? 'platform_session_presence_selector' : 'platform_session_selector',
    );
    if (selectorCase.verificationSelector) {
      const publishGate = await detectAccessBlocked(selectorPage);
      assert.equal(publishGate.blocked, true, 'the same Bilibili page must retain its publish-time captcha gate');
      assert.equal(publishGate.reason, 'verification_overlay');
    }
    assert.equal(transientBrowserCloseCalls, 1, 'a short-lived profile probe must close its browser process exactly once');
    assert.equal(transientContextCloseCalls, 0, 'browser.close should own cleanup when the transient context exposes its browser');
    assert.equal(transientCloseReason, 'login_profile_probe_complete');
    assert.equal(selectorProbeBrowser.profileProbeStarts.size, 0);
  }

  // Regression coverage for the three direct-publish login contracts. Broad
  // shells and generic class names must not turn an unauthenticated page into
  // a ready session.
  async function probeWithPage(platformId, pageOptions) {
    let closeCalls = 0;
    const page = readOnlyPage(pageOptions);
    const context = {
      pages: () => [page],
      newPage: async () => { throw new Error('the login contract probe must reuse its startup page'); },
      close: async () => { closeCalls += 1; },
    };
    const browser = new PlatformBrowser({
      launchPersistentBrowser: async () => context,
    });
    const result = await browser.probeLogin(platformId, {
      profileKey: platformId + '-login-contract',
    });
    assert.equal(closeCalls, 1, platformId + ' login contract probe must close its context');
    return result;
  }

  const wechatLoginShell = await probeWithPage('wechat_mp', {
    url: 'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin',
    visible: ['.weui-desktop-layout'],
  });
  assert.equal(wechatLoginShell.loggedIn, false, 'WeChat login shell must not be treated as authenticated');
  assert.ok(wechatLoginShell.reason, 'WeChat login shell should expose a non-empty login/verification reason');
  const wechatHome = await probeWithPage('wechat_mp', {
    url: 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index',
  });
  assert.equal(wechatHome.loggedIn, true, 'WeChat authenticated home URL must be accepted');
  assert.equal(wechatHome.loginSignal, 'https://mp.weixin.qq.com/cgi-bin/home');
  const zhihuTextareaOnly = await probeWithPage('zhihu', {
    url: 'https://www.zhihu.com/signin',
    attached: ['textarea[placeholder="??????..."]'],
  });
  assert.equal(zhihuTextareaOnly.loggedIn, false, 'a generic Zhihu textarea must not prove login');
  const zhihuAvatar = await probeWithPage('zhihu', {
    url: 'https://zhuanlan.zhihu.com/write',
    visible: ['.AppHeader-profile'],
  });
  assert.equal(zhihuAvatar.loggedIn, true, 'Zhihu profile control must prove login');
  const toutiaoGenericCreator = await probeWithPage('toutiao', {
    url: 'https://mp.toutiao.com/',
    visible: ['[class*="creator"]'],
  });
  assert.equal(toutiaoGenericCreator.loggedIn, false, 'generic Toutiao creator class must not prove login');
  const toutiaoAvatar = await probeWithPage('toutiao', {
    url: 'https://mp.toutiao.com/',
    visible: ['.user-auth-avator'],
  });
  assert.equal(toutiaoAvatar.loggedIn, true, 'Toutiao account avatar must prove login');

  // Baijiahao's authenticated editor can render only a shell/iframe in a
  // headless profile, so its exact HTTPS origin + /builder/ path is a catalog
  // login signal. The public login URL, HTTP, and lookalike domains must stay
  // inconclusive rather than being accepted by a raw string prefix.
  const baijiahaoUrlCases = [
    { url: 'https://baijiahao.baidu.com/builder/rc/edit', authenticated: true },
    { url: 'https://baijiahao.baidu.com/', authenticated: false },
    { url: 'http://baijiahao.baidu.com/builder/rc/edit', authenticated: false },
    { url: 'https://example.com/builder/rc/edit', authenticated: false },
    { url: 'https://baijiahao.baidu.com.evil.example/builder/rc/edit', authenticated: false },
  ];
  for (const urlCase of baijiahaoUrlCases) {
    let closeCalls = 0;
    const urlPage = readOnlyPage({ url: urlCase.url, title: '百家号' });
    const urlContext = {
      pages: () => [urlPage],
      newPage: async () => { throw new Error('the Baijiahao URL probe startup page should be reused'); },
      close: async () => { closeCalls += 1; },
    };
    const urlProbeBrowser = new PlatformBrowser({
      launchPersistentBrowser: async () => urlContext,
    });
    const urlResult = await urlProbeBrowser.probeLogin('baijiahao', {
      profileKey: `${groupId}--baijiahao-url-${closeCalls}`,
    });
    assert.equal(urlResult.loggedIn, urlCase.authenticated, `unexpected Baijiahao URL signal for ${urlCase.url}`);
    if (urlCase.authenticated) {
      assert.equal(urlResult.loginSignal, 'https://baijiahao.baidu.com/builder/');
      assert.equal(urlResult.loginSignalSource, 'platform_session_url');
      assert.equal(urlResult.reason, '');
    } else {
      assert.equal(urlResult.loginSignal, null);
      assert.equal(urlResult.loginSignalSource, 'none');
      assert.equal(urlResult.inconclusive, true);
      assert.equal(urlResult.reason, 'authenticated_signal_not_found');
    }
    assert.equal(closeCalls, 1, 'every Baijiahao URL probe must close its transient context');
  }

  // Concurrent periodic/manual checks for the same profile must share one
  // in-flight probe. Starting two persistent contexts against one user-data
  // directory races Chromium's profile lock and used to produce false logout
  // results.
  let releaseConcurrentNavigation;
  const concurrentNavigation = new Promise((resolve) => { releaseConcurrentNavigation = resolve; });
  const concurrentPage = readOnlyPage({
    url: 'https://i.cnblogs.com/',
    visible: ['.top-nav'],
  });
  concurrentPage.goto = async () => concurrentNavigation;
  let concurrentLaunchCalls = 0;
  let concurrentBrowserCloseCalls = 0;
  let concurrentContextCloseCalls = 0;
  let concurrentCloseReason = '';
  const concurrentContext = {
    pages: () => [concurrentPage],
    newPage: async () => { throw new Error('the concurrent probe startup page should be reused'); },
    browser: () => ({
      close: async (options = {}) => {
        concurrentBrowserCloseCalls += 1;
        concurrentCloseReason = options.reason || '';
      },
    }),
    close: async () => { concurrentContextCloseCalls += 1; },
  };
  const concurrentProbeBrowser = new PlatformBrowser({
    launchPersistentBrowser: async () => {
      concurrentLaunchCalls += 1;
      return concurrentContext;
    },
  });
  const concurrentProfileKey = `${groupId}--cnblogs-concurrent`;
  const firstConcurrentProbe = concurrentProbeBrowser.probeLogin('cnblogs', { profileKey: concurrentProfileKey });
  const secondConcurrentProbe = concurrentProbeBrowser.probeLogin('cnblogs', { profileKey: concurrentProfileKey });
  assert.equal(concurrentProbeBrowser.profileProbeStarts.size, 1, 'same-profile probes must expose only one in-flight entry');
  releaseConcurrentNavigation();
  const [firstConcurrentResult, secondConcurrentResult] = await Promise.all([
    firstConcurrentProbe,
    secondConcurrentProbe,
  ]);
  assert.equal(concurrentLaunchCalls, 1, 'same-profile concurrent checks must launch one transient browser');
  assert.equal(firstConcurrentResult, secondConcurrentResult, 'same-profile callers must receive the shared probe result');
  assert.equal(firstConcurrentResult.loggedIn, true);
  assert.equal(concurrentBrowserCloseCalls, 1, 'the shared transient browser must close exactly once');
  assert.equal(concurrentContextCloseCalls, 0);
  assert.equal(concurrentCloseReason, 'login_profile_probe_complete');
  assert.equal(concurrentProbeBrowser.profileProbeStarts.size, 0, 'the in-flight probe entry must be cleared after completion');

  // SMZDM presents a Tencent risk captcha to every headless visit, while
  // NetEase redirects a valid saved session to /login.html under headless
  // Chromium. Scheduled probes must not launch an automated browser for either
  // profile; login is observed from the normal Chrome/Edge window instead.
  let nativeOnlyLaunchCalls = 0;
  const nativeOnlyProbeBrowser = new PlatformBrowser({
    launchPersistentBrowser: async () => {
      nativeOnlyLaunchCalls += 1;
      throw new Error('native-window-only login probes must not launch headless Chromium');
    },
  });
  for (const nativeOnlyPlatformId of ['smzdm', 'netease']) {
    const nativeOnlyResult = await nativeOnlyProbeBrowser.probeLogin(nativeOnlyPlatformId, {
      profileKey: groupId + '--' + nativeOnlyPlatformId,
    });
    assert.equal(nativeOnlyResult.loggedIn, false);
    assert.equal(nativeOnlyResult.inconclusive, true);
    assert.equal(nativeOnlyResult.windowOpen, false);
    assert.equal(nativeOnlyResult.reason, 'native_window_probe_required');
  }
  assert.equal(nativeOnlyLaunchCalls, 0);
  assert.equal(nativeOnlyProbeBrowser.profileProbeStarts.size, 0);

  // A user can close a Chromium window while its persistent context remains
  // briefly cached. The next action must rebuild that closed context once
  // rather than leaving a blank startup tab or surfacing a Playwright error.
  let staleContextClosed = false;
  let recoveredContextCalls = 0;
  const recoveredBlankPage = {
    url: () => 'about:blank',
    isClosed: () => false,
    on: () => {},
    close: async () => {},
  };
  const staleContext = {
    pages: () => { throw new Error('Target page, context or browser has been closed'); },
    close: async () => { staleContextClosed = true; },
  };
  const recoveredContext = {
    pages: () => [recoveredBlankPage],
    newPage: async () => { throw new Error('the reusable blank page should be used'); },
  };
  const recoveringBrowser = new PlatformBrowser();
  recoveringBrowser.context = async () => {
    recoveredContextCalls += 1;
    return recoveredContextCalls === 1 ? staleContext : recoveredContext;
  };
  const recoveredPageRecord = await recoveringBrowser.managedPage(platformId, `${groupId}--${platformId}`, 'probe');
  assert.equal(recoveredContextCalls, 2, 'a closed persistent context must be rebuilt once');
  assert.equal(staleContextClosed, true, 'the stale persistent context must be closed during recovery');
  assert.equal(recoveredPageRecord.page, recoveredBlankPage);
  assert.equal(recoveringBrowser.status().windowCount, 1, 'only the recovered page should remain tracked');
  // GEOFlow may still return an older session snapshot immediately after a
  // local login. Keep the locally confirmed state visible until the pending
  // session update has reached the backend, even if last_seen_at is newer.
  const appHooks = loadAppStateHooks();
  const appPlatformId = 'zhihu';
  const appGroupId = 'group-local-priority';
  appHooks.state.groups = [{
    id: appGroupId,
    name: 'Local priority group',
    accounts: {
      [appPlatformId]: {
        platformId: appPlatformId,
        profileKey: `${appGroupId}--${appPlatformId}`,
        status: 'ready',
        syncState: 'pending',
        pendingSession: { login_state: 'ready' },
        lastVerifiedAt: '2026-08-14T10:00:00.000Z',
      },
    },
  }];
  appHooks.state.activeGroupId = appGroupId;
  appHooks.state.browserWindows = [];
  appHooks.state.sessions = [{
    platform_id: appPlatformId,
    profile_key: `${appGroupId}--${appPlatformId}`,
    login_state: 'needs_login',
    last_seen_at: '2026-08-14T10:05:00.000Z',
  }];
  const localPriorityState = appHooks.platformState({ id: appPlatformId, support: 'ready' }, appGroupId);
  assert.equal(localPriorityState.state, 'ready', 'a pending local login update must not be overwritten by an older backend session');
  // The account-management view must use the same merged state as the
  // platform view. Otherwise a native login window makes the platform page
  // say "窗口已打开" while the accounts page incorrectly says "待检测".
  appHooks.state.groups[0].accounts[appPlatformId].status = 'unknown';
  appHooks.state.browserWindows = [{
    platformId: appPlatformId,
    profileKey: `${appGroupId}--${appPlatformId}`,
    driver: 'native',
  }];
  const nativeAccountRow = appHooks.accountRowState(appGroupId, appHooks.state.groups[0].accounts[appPlatformId]);
  assert.equal(nativeAccountRow.status, 'open', 'a native login window must be rendered as an open login state in account management');
  assert.equal(nativeAccountRow.nativeLoginOpen, true);
  // Multiple account groups can bind the same platform. A session with a
  // different (or absent and ambiguous) profile_key must never paint another
  // group as logged in.
  const multiAccountHooks = loadAppStateHooks();
  const firstProfileGroup = 'group-profile-first';
  const secondProfileGroup = 'group-profile-second';
  multiAccountHooks.state.groups = [firstProfileGroup, secondProfileGroup].map((id) => ({
    id,
    name: id,
    accounts: {
      [appPlatformId]: {
        platformId: appPlatformId,
        profileKey: `${id}--${appPlatformId}`,
        status: 'needs_login',
      },
    },
  }));
  multiAccountHooks.state.activeGroupId = firstProfileGroup;
  multiAccountHooks.state.browserWindows = [];
  multiAccountHooks.state.sessions = [
    {
      platform_id: appPlatformId,
      profile_key: `${secondProfileGroup}--${appPlatformId}`,
      login_state: 'ready',
    },
    {
      platform_id: appPlatformId,
      profile_key: '',
      login_state: 'ready',
    },
  ];
  assert.equal(multiAccountHooks.sessionFor(firstProfileGroup, appPlatformId), null, 'an ambiguous legacy session must not cross account groups');
  assert.equal(multiAccountHooks.platformState({ id: appPlatformId, support: 'ready' }, firstProfileGroup).state, 'needs_login');
  assert.equal(multiAccountHooks.sessionFor(secondProfileGroup, appPlatformId)?.profile_key, `${secondProfileGroup}--${appPlatformId}`);

  multiAccountHooks.state.sessions = [{
    platform_id: appPlatformId,
    profile_key: '',
    login_state: 'ready',
    meta: { group_id: firstProfileGroup },
  }];
  assert.equal(multiAccountHooks.sessionFor(firstProfileGroup, appPlatformId)?.meta?.group_id, firstProfileGroup, 'legacy sessions remain usable when their group metadata is explicit');
  assert.equal(multiAccountHooks.sessionFor(secondProfileGroup, appPlatformId), null, 'explicit metadata must not leak a legacy session to another group');
  const exactGroupAgent = Object.create(TongzhuoDesktopAgent.prototype);
  exactGroupAgent.config = {
    activeGroupId: firstProfileGroup,
    accountGroups: [firstProfileGroup, secondProfileGroup].map((id) => ({
      id,
      name: id,
      accounts: {
        [appPlatformId]: {
          platformId: appPlatformId,
          profileKey: `${id}--${appPlatformId}`,
          accountName: id,
        },
      },
    })),
  };
  assert.equal(exactGroupAgent.accountGroupById('missing-group'), null, 'an explicit unknown group must not fall back to the active group');
  const isolatedPayload = exactGroupAgent.sessionPayload(secondProfileGroup, appPlatformId, {
    profile_key: `${firstProfileGroup}--${appPlatformId}`,
    meta: { group_id: firstProfileGroup, marker: 'preserved' },
  });
  assert.equal(isolatedPayload.profile_key, `${secondProfileGroup}--${appPlatformId}`, 'session payload must use the requested group profile');
  assert.equal(isolatedPayload.meta.group_id, secondProfileGroup, 'session payload must use the requested group id');
  assert.equal(isolatedPayload.meta.marker, 'preserved');

  const recoveredHeartbeat = Object.create(TongzhuoDesktopAgent.prototype);
  Object.assign(recoveredHeartbeat, {
    config: { apiToken: 'test-token', desiredStateVersion: 0, appliedStateVersion: 0, localOverride: false, autoRun: false },
    activeJobs: new Map(),
    activeJobId: null,
    jobProtocol: 'auto',
    lastPollProtocols: [],
    heartbeatFailureStreak: 1,
    publishPolicy: { snapshot: () => ({}) },
    client: { shadowHeartbeat: async () => ({ data: { desired_state: { version: 0 } } }) },
  });
  recoveredHeartbeat.log = () => {};
  recoveredHeartbeat.applyDesiredState = async () => null;
  recoveredHeartbeat.pendingSessionEntries = () => [{ groupId: firstProfileGroup, platformId: appPlatformId }];
  let recoveredFlushCompleted = false;
  recoveredHeartbeat.flushPendingSessions = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    recoveredFlushCompleted = true;
    return [];
  };
  await recoveredHeartbeat.heartbeat();
  assert.equal(recoveredFlushCompleted, true, 'heartbeat recovery must await the pending-session flush');
  console.log('Login sync and blank-page behavior passed.');
} finally {
  restorePlatformBrowserContext();
  if (originalDataDir === undefined) delete process.env.TZ_AGENT_DATA_DIR;
  else process.env.TZ_AGENT_DATA_DIR = originalDataDir;
  await removeTemporaryDataDir(temporaryDataDir);
}
