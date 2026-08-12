import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-agent-login-sync-'));
const originalDataDir = process.env.TZ_AGENT_DATA_DIR;
process.env.TZ_AGENT_DATA_DIR = temporaryDataDir;

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

try {
  const { readConfig, writeConfig } = await import('../src/config-store.js');
  const { TongzhuoDesktopAgent } = await import('../src/agent.js');
  const { GeoFlowRequestError, isInvalidPairingResponse } = await import('../src/geoflow-client.js');
  const { PlatformBrowser } = await import('../src/platform-browser.js');

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
  offlineAgent.client.reportSession = async () => {
    reportAttempts += 1;
    throw new Error('未配对时不应调用后台');
  };
  offlineAgent.browser = {
    probeLogin: async () => ({ loggedIn: true, url: 'https://example.com/editor' }),
    status: () => ({ windowCount: 0, profileCount: 0, windows: [] }),
    closeAll: async () => {},
  };

  const localResults = await offlineAgent.syncLoginStates();
  savedAccount = offlineAgent.publicStatus().accountGroups[0].accounts[platformId];
  assert.equal(localResults.length, 1);
  assert.equal(localResults[0].loginState, 'ready');
  assert.equal(savedAccount.status, 'ready');
  assert.equal(savedAccount.syncState, 'waiting_for_pairing');
  assert.equal(reportAttempts, 0);
  await offlineAgent.shutdown();

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
  assert.equal(openedReadyNative.loginDetection, 'after_native_window_close');
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

  console.log('Login sync and blank-page behavior passed.');
} finally {
  if (originalDataDir === undefined) delete process.env.TZ_AGENT_DATA_DIR;
  else process.env.TZ_AGENT_DATA_DIR = originalDataDir;
  fs.rmSync(temporaryDataDir, { recursive: true, force: true });
}
