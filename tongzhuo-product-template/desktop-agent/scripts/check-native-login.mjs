import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.exitCode = null;
  }

  exit(code = 0) {
    this.exitCode = code;
    this.emit('exit', code, null);
  }
}

const original = {
  localAppData: process.env.LOCALAPPDATA,
  programFiles: process.env.PROGRAMFILES,
  programFilesX86: process.env['PROGRAMFILES(X86)'],
  executable: process.env.TZ_AGENT_BROWSER_EXECUTABLE,
  bundled: process.env.TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE,
};

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  process.env.LOCALAPPDATA = '';
  process.env.PROGRAMFILES = 'C:\\Program Files';
  process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';
  process.env.TZ_AGENT_BROWSER_EXECUTABLE = '';
  process.env.TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE = '';

  const { PlatformBrowser, nativeLoginCandidateForTesting } = await import('../src/platform-browser.js');
  const candidate = nativeLoginCandidateForTesting();
  assert.ok(candidate, 'an installed Chrome or Edge is required for native login');
  assert.ok(['Google Chrome', 'Microsoft Edge'].includes(candidate.label));

  for (const kind of ['publish', 'probe']) {
    const profileKey = `group-busy-${kind}--zhihu`;
    const activePage = {
      isClosed: () => false,
      url: () => `https://www.zhihu.com/${kind}`,
    };
    let managedCloseCalls = 0;
    let nativeSpawnCalls = 0;
    const busyBrowser = new PlatformBrowser({
      spawnNativeBrowser: () => {
        nativeSpawnCalls += 1;
        return new FakeChild(7000 + nativeSpawnCalls);
      },
    });
    const managedContext = {
      pages: () => [activePage],
      close: async () => {
        managedCloseCalls += 1;
      },
    };
    busyBrowser.contexts.set(profileKey, managedContext);
    busyBrowser.pages.set(`managed-${kind}`, {
      id: `managed-${kind}`,
      platformId: 'zhihu',
      profileKey,
      kind,
      openedAt: new Date().toISOString(),
      page: activePage,
    });

    await assert.rejects(
      busyBrowser.openLogin('zhihu', { profileKey }),
      `native login must reject an active managed ${kind} page`,
    );
    assert.equal(managedCloseCalls, 0, `native login must not close an active managed ${kind} context`);
    assert.equal(nativeSpawnCalls, 0, `native login must not start while a managed ${kind} page is active`);
    assert.equal(busyBrowser.contexts.get(profileKey), managedContext);
    assert.equal(busyBrowser.pages.get(`managed-${kind}`)?.page, activePage);
  }

  const calls = [];
  const children = [];
  const browser = new PlatformBrowser({
    spawnNativeBrowser: (executablePath, args) => {
      const child = new FakeChild(8000 + calls.length);
      calls.push({ executablePath, args: [...args] });
      children.push(child);
      return child;
    },
  });

  const first = await browser.openLogin('zhihu', { profileKey: 'group-default--zhihu' });
  assert.equal(first.driver, 'native');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executablePath, candidate.executablePath);
  assert.equal(calls[0].args.length, 3);
  assert.match(calls[0].args[0], /^--user-data-dir=/);
  assert.ok(calls[0].args[0].endsWith(path.join('profiles', 'group-default--zhihu')));
  assert.equal(calls[0].args[1], '--new-window');
  assert.match(calls[0].args[2], /^https:\/\/www\.zhihu\.com\/signin/);
  const serializedArgs = calls[0].args.join(' ').toLowerCase();
  for (const forbidden of ['remote-debugging', 'enable-automation', 'automationcontrolled', 'user-agent', 'about:blank']) {
    assert.equal(serializedArgs.includes(forbidden), false, `native login must not contain ${forbidden}`);
  }

  const status = browser.status();
  assert.equal(status.windowCount, 1);
  assert.equal(status.windows[0].driver, 'native');
  assert.equal(status.windows[0].canClose, false);
  assert.notEqual(status.windows[0].url, 'about:blank');

  const duplicate = await browser.openLogin('zhihu', { profileKey: 'group-default--zhihu' });
  assert.equal(duplicate.windowId, first.windowId);
  assert.equal(calls.length, 1, 'same profile must reuse an active native login');

  const inProgress = await browser.probeLogin('zhihu', { profileKey: 'group-default--zhihu' });
  assert.equal(inProgress.manualLoginInProgress, true);
  assert.equal(inProgress.reason, 'manual_login_in_progress');
  await assert.rejects(
    browser.openEditor('zhihu', { article: { title: 'x', text: 'x' } }, { profileKey: 'group-default--zhihu' }),
    /人工登录窗口仍在打开/,
  );

  const secondProfile = await browser.openLogin('zhihu', { profileKey: 'group-second--zhihu' });
  assert.equal(secondProfile.driver, 'native');
  assert.equal(calls.length, 2);

  let cleanupCalls = 0;
  const deleteNativeProcess = browser.nativeLoginProcesses.delete.bind(browser.nativeLoginProcesses);
  browser.nativeLoginProcesses.delete = (profileKey) => {
    cleanupCalls += 1;
    return deleteNativeProcess(profileKey);
  };
  const firstError = new Error('simulated native browser failure');
  children[0].emit('error', firstError);
  children[0].emit('exit', 1, null);
  children[0].emit('close', 1, null);
  assert.equal(cleanupCalls, 1, 'error, exit, and close must finalize a native login only once');
  const failedRecord = browser.nativeLoginRecords.get('group-default--zhihu');
  assert.equal(failedRecord?.closed, true);
  assert.equal(failedRecord?.error, firstError.message);
  assert.equal(browser.nativeLoginProcesses.has('group-default--zhihu'), false);
  browser.nativeLoginProcesses.delete = deleteNativeProcess;

  assert.equal(browser.isNativeLoginActive('group-default--zhihu'), false);
  assert.equal(browser.status().windows.some((item) => item.id === first.windowId), false);
  const reopened = await browser.openLogin('zhihu', { profileKey: 'group-default--zhihu' });
  assert.equal(reopened.driver, 'native');
  assert.equal(calls.length, 3);

  let closeCleanupCalls = 0;
  browser.nativeLoginProcesses.delete = (profileKey) => {
    closeCleanupCalls += 1;
    return deleteNativeProcess(profileKey);
  };
  children[2].emit('close', 0, null);
  children[2].emit('exit', 0, null);
  children[2].emit('error', new Error('late native browser error'));
  assert.equal(closeCleanupCalls, 1, 'a close event must release the profile without duplicate cleanup');
  browser.nativeLoginProcesses.delete = deleteNativeProcess;
  assert.equal(browser.isNativeLoginActive('group-default--zhihu'), false);
  const reopenedAfterClose = await browser.openLogin('zhihu', { profileKey: 'group-default--zhihu' });
  assert.equal(reopenedAfterClose.driver, 'native');
  assert.equal(calls.length, 4);

  await browser.closeAll();
  console.log('Native Zhihu login behavior passed.');
} finally {
  restore('LOCALAPPDATA', original.localAppData);
  restore('PROGRAMFILES', original.programFiles);
  restore('PROGRAMFILES(X86)', original.programFilesX86);
  restore('TZ_AGENT_BROWSER_EXECUTABLE', original.executable);
  restore('TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE', original.bundled);
}