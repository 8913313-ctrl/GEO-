import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createAdapter } from './adapters/index.js';
import { detectAccessBlocked } from './adapters/fill-tools.js';
import { normalizeArticle } from './article-payload.js';
import { dataDir } from './config-store.js';
import { exportArticleBundle } from './export-bundle.js';
import { findPlatform } from './platforms.js';
import { buildSelectorTelemetry } from './platform-result.js';

const profilesDir = path.join(dataDir, 'profiles');
const privateEnvironmentKeys = new Set(['TZ_AGENT_LOCAL_TOKEN', 'TZ_AGENT_MASTER_KEY']);
const execFileAsync = promisify(execFile);

export function sanitizedBrowserEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) => !privateEnvironmentKeys.has(key)));
}

async function ownedHeadlessProbePids(profile) {
  if (process.platform !== 'win32' || !profile) return [];
  const script = [
    "$parentId = [int][Environment]::GetEnvironmentVariable('TZ_AGENT_PROBE_PARENT_PID')",
    "$profile = [Environment]::GetEnvironmentVariable('TZ_AGENT_PROBE_PROFILE')",
    "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $parentId -and @('chrome.exe','msedge.exe').Contains($_.Name) -and $_.CommandLine -and $_.CommandLine.Contains('--headless') -and $_.CommandLine.Contains($profile) } | ForEach-Object { [Console]::WriteLine($_.ProcessId) }",
  ].join('; ');
  try {
    const { stdout = '' } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: {
        ...sanitizedBrowserEnvironment(),
        TZ_AGENT_PROBE_PARENT_PID: String(process.pid),
        TZ_AGENT_PROBE_PROFILE: path.resolve(profile),
      },
      timeout: 4000,
      windowsHide: true,
      maxBuffer: 16 * 1024,
    });
    return String(stdout).split(/\r?\n/)
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

async function terminateOwnedHeadlessProbe(profile) {
  const terminated = [];
  for (const pid of await ownedHeadlessProbePids(profile)) {
    try {
      process.kill(pid, 'SIGTERM');
      terminated.push(pid);
    } catch {}
  }
  return terminated;
}

function existingExecutable(value) {
  const executablePath = String(value || '').trim();
  if (!executablePath || !fs.existsSync(executablePath)) return '';
  try {
    return fs.statSync(executablePath).isFile() ? executablePath : '';
  } catch {
    return '';
  }
}

function browserLaunchCandidates() {
  const candidates = [];
  const seen = new Set();
  const addExecutable = (label, value) => {
    const executablePath = existingExecutable(value);
    if (!executablePath) return;
    const key = `executable:${executablePath.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ label, executablePath });
  };
  const addChannel = (label, value) => {
    const channel = String(value || '').trim();
    if (!channel) return;
    const key = `channel:${channel.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ label, channel });
  };

  // Honor an explicit operator override before selecting an installed browser.
  addExecutable('指定浏览器', process.env.TZ_AGENT_BROWSER_EXECUTABLE);
  addChannel('指定浏览器通道', process.env.TZ_AGENT_BROWSER_CHANNEL);

  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  for (const root of [localAppData, programFiles, programFilesX86]) {
    if (!root) continue;
    addExecutable('Google Chrome', path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  for (const root of [localAppData, programFilesX86, programFiles]) {
    if (!root) continue;
    addExecutable('Microsoft Edge', path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  // The packaged runtime is a compatibility fallback, not an override for a
  // current browser installed by the operator.
  addExecutable('内置发布浏览器', process.env.TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE);
  addExecutable('Playwright Chromium', chromium.executablePath());

  return candidates;
}

function automationLaunchCandidates() {
  return browserLaunchCandidates();
}

function nativeLoginCandidate() {
  // A human verification flow must use a normal installed browser process.
  // Do not use a Playwright channel, bundled runtime, altered UA, or
  // anti-detection scripts here: the platform receives the browser unchanged.
  return browserLaunchCandidates().find((candidate) => candidate.executablePath
    && ['Google Chrome', 'Microsoft Edge'].includes(candidate.label)) || null;
}

async function allocateLoopbackPort() {
  return new Promise((resolve) => {
    const server = createServer();
    let settled = false;
    const finish = (port = null) => {
      if (settled) return;
      settled = true;
      resolve(port);
    };
    server.unref();
    server.once('error', () => finish(null));
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? Number(address.port || 0) : 0;
      server.close(() => finish(port > 0 ? port : null));
    });
  });
}

function isClosedBrowserTarget(error) {
  const message = String(error?.message || error || '');
  return /(?:target|page|browser|context).{0,100}(?:has been |is )?closed|(?:closed).{0,100}(?:target|page|browser|context)|browser context is not available/i.test(message);
}

const platformSessionSelectors = Object.freeze({
  zhihu: ['[data-za-detail-view-element_name="Avatar"]', '.AppHeader-profile'],
  wechat_mp: ['#js_home', '.weui-desktop-account'],
  toutiao: ['.article-title input', '.title-input', '.user-panel .user-auth-avator', '.user-auth-avator'],
  x: ['[data-testid="SideNav_AccountSwitcher_Button"]', '[data-testid="tweetTextarea_0"]'],
});

const genericEditorSessionSelectors = Object.freeze([
  'input[name*="title" i]',
  'textarea[name*="title" i]',
  'input[id*="title" i]',
  '.ProseMirror[contenteditable="true"]',
  '.ql-editor[contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
]);

async function firstVisibleSelector(page, selectors = []) {
  for (const selector of selectors) {
    const visible = await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false);
    if (visible) return selector;
  }
  return '';
}

async function firstAttachedSelector(page, selectors = []) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (typeof locator?.count !== 'function') continue;
    const count = await locator.count().catch(() => 0);
    if (count > 0) return selector;
  }
  return '';
}

function selectorList(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' && value.trim() ? [value] : [];
}

function authenticatedSelectors(platform) {
  const configured = [
    platform?.sessionSelectors,
    platform?.authenticatedSelectors,
    platform?.loginSignals?.authenticated,
    platform?.loginSelectors?.authenticated,
    platform?.execution?.sessionSelectors,
    platform?.execution?.authenticatedSelectors,
  ].flatMap(selectorList);
  return [...new Set([...configured, ...(platformSessionSelectors[platform.id] || [])])];
}

function authenticatedPresenceSelectors(platform) {
  return [...new Set([
    ...selectorList(platform?.sessionPresenceSelectors),
    ...selectorList(platform?.loginSignals?.present),
    ...selectorList(platform?.loginSelectors?.present),
    ...selectorList(platform?.execution?.sessionPresenceSelectors),
  ])];
}

function authenticatedUrlPrefixes(platform) {
  return [...new Set([
    ...selectorList(platform?.sessionUrlPrefixes),
    ...selectorList(platform?.loginSignals?.urlPrefixes),
    ...selectorList(platform?.loginSelectors?.urlPrefixes),
    ...selectorList(platform?.execution?.sessionUrlPrefixes),
  ])];
}

function authenticatedUrlSignal(page, platform) {
  let current;
  try {
    current = new URL(page.url());
  } catch {
    return '';
  }
  for (const rawPrefix of authenticatedUrlPrefixes(platform)) {
    try {
      const prefix = new URL(rawPrefix);
      // URL-only authentication is intentionally stricter than a string
      // startsWith check: require HTTPS, the exact origin, and a path-prefix
      // boundary so lookalike hosts cannot become positive session signals.
      if (prefix.protocol !== 'https:' || current.protocol !== 'https:') continue;
      if (current.origin !== prefix.origin) continue;
      const prefixPath = prefix.pathname.endsWith('/')
        ? prefix.pathname
        : `${prefix.pathname}/`;
      if (current.pathname === prefix.pathname || current.pathname.startsWith(prefixPath)) {
        return rawPrefix;
      }
    } catch {
      // Invalid catalog values are ignored instead of broadening detection.
    }
  }
  return '';
}

async function authenticatedSessionSignal(page, platform) {
  const authenticatedUrl = authenticatedUrlSignal(page, platform);
  if (authenticatedUrl) return { authenticated: true, selector: authenticatedUrl, source: 'platform_session_url' };
  const specific = await firstVisibleSelector(page, authenticatedSelectors(platform));
  if (specific) return { authenticated: true, selector: specific, source: 'platform_session_selector' };
  // Presence selectors are deliberately restricted by platforms.js to
  // account-only controls such as logout links. They may live inside hidden
  // dropdowns, so use an attached/count check only; never broaden arbitrary
  // hidden DOM into a login signal.
  const present = await firstAttachedSelector(page, authenticatedPresenceSelectors(platform));
  if (present) return { authenticated: true, selector: present, source: 'platform_session_presence_selector' };
  const title = await firstVisibleSelector(page, genericEditorSessionSelectors.slice(0, 3));
  const body = await firstVisibleSelector(page, genericEditorSessionSelectors.slice(3));
  if (title && body) return { authenticated: true, selector: `${title} + ${body}`, source: 'editor_fields' };
  return { authenticated: false, selector: '', source: 'none' };
}

async function closeTransientContext(context, options = {}) {
  if (!context) return;
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || 5000);
  const browser = typeof context.browser === 'function' ? context.browser() : null;
  let close;
  try {
    close = browser && typeof browser.close === 'function'
      ? browser.close({ reason: 'login_profile_probe_complete' })
      : context.close();
  } catch {
    close = Promise.reject(new Error('transient_browser_close_failed'));
  }
  let timer = null;
  let outcome = 'closed';
  try {
    outcome = await Promise.race([
      Promise.resolve(close).then(() => 'closed', () => 'failed'),
      new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (outcome !== 'closed' && typeof options.forceClose === 'function') {
    await Promise.resolve(options.forceClose()).catch(() => {});
  }
  return outcome;
}

async function launchPersistentBrowser(profile, runtime = {}) {
  const candidates = automationLaunchCandidates();
  if (!candidates.length) {
    throw new Error('未找到可用的发布浏览器。请重新安装桐灼 GEO 发布器（安装包会自带浏览器运行时），或安装 Microsoft Edge / Google Chrome。');
  }

  const headless = runtime.headless === true;
  for (const candidate of candidates) {
    const options = {
      headless,
      viewport: headless ? { width: 1280, height: 720 } : null,
      locale: 'zh-CN',
      acceptDownloads: true,
      env: sanitizedBrowserEnvironment(),
    };
    if (candidate.executablePath) options.executablePath = candidate.executablePath;
    if (candidate.channel) options.channel = candidate.channel;
    try {
      return await chromium.launchPersistentContext(profile, options);
    } catch (error) {
      // Keep diagnostics in the local service log while returning a useful,
      // stable error message to the customer instead of Playwright internals.
      console.warn(`[browser] ${candidate.label} launch failed: ${String(error?.message || error).split('\n')[0]}`);
    }
  }

  throw new Error('发布浏览器未能启动。请关闭已经打开的发布器浏览器窗口后重试；若问题持续，请重新安装桐灼 GEO 发布器。');
}

export function browserLaunchCandidatesForTesting() {
  return browserLaunchCandidates();
}

export function nativeLoginCandidateForTesting() {
  return nativeLoginCandidate();
}
export class PlatformBrowser {
  constructor(options = {}) {
    this.contexts = new Map();
    this.contextStarts = new Map();
    this.profileProbeStarts = new Map();
    this.pages = new Map();
    this.nativeLoginProcesses = new Map();
    this.nativeLoginRecords = new Map();
    this.launchPersistentBrowser = options.launchPersistentBrowser || launchPersistentBrowser;
    this.transientProbeCloseTimeoutMs = Math.max(1, Number(options.transientProbeCloseTimeoutMs) || 5000);
    this.terminateTransientProbe = options.terminateTransientProbe || terminateOwnedHeadlessProbe;
    this.allocateNativeDebugPort = options.allocateNativeDebugPort || allocateLoopbackPort;
    this.connectOverCDP = options.connectOverCDP || ((endpoint, connectOptions) => chromium.connectOverCDP(endpoint, connectOptions));
    this.spawnNativeBrowser = options.spawnNativeBrowser || ((executablePath, args) => spawn(executablePath, args, {
      detached: false,
      windowsHide: false,
      stdio: 'ignore',
      env: sanitizedBrowserEnvironment(),
    }));
  }

  profileKey(platformId, requestedKey = '') {
    const raw = String(requestedKey || platformId || '').trim();
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || platformId;
  }

  async context(platformId, requestedProfileKey = '') {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    const profileKey = this.profileKey(platformId, requestedProfileKey);
    if (this.isNativeLoginActive(profileKey)) {
      throw new Error('人工登录窗口仍在使用该账号资料。请先完成登录并关闭该浏览器窗口，再检测登录或执行发布。');
    }
    const existing = this.contexts.get(profileKey);
    if (existing) {
      try {
        existing.pages();
        return existing;
      } catch {
        this.contexts.delete(profileKey);
      }
    }

    const pending = this.contextStarts.get(profileKey);
    if (pending) return pending;

    const start = (async () => {
      const profile = path.join(profilesDir, profileKey);
      fs.mkdirSync(profile, { recursive: true });
      const context = await this.launchPersistentBrowser(profile, { headless: false });
      context.on('close', () => {
        if (this.contexts.get(profileKey) === context) this.contexts.delete(profileKey);
        for (const [windowId, record] of this.pages.entries()) {
          if (record.profileKey === profileKey) this.pages.delete(windowId);
        }
      });
      this.contexts.set(profileKey, context);
      return context;
    })();
    this.contextStarts.set(profileKey, start);
    try {
      return await start;
    } finally {
      if (this.contextStarts.get(profileKey) === start) this.contextStarts.delete(profileKey);
    }
  }

  nativeLoginRecord(profileKey) {
    const key = this.profileKey('', profileKey);
    const record = this.nativeLoginRecords.get(key);
    if (!record) return null;
    const child = this.nativeLoginProcesses.get(key);
    if (record.closed || (child && child.exitCode !== null && child.exitCode !== undefined)) {
      record.closed = true;
      this.nativeLoginProcesses.delete(key);
    }
    return record;
  }

  isNativeLoginActive(profileKey) {
    const record = this.nativeLoginRecord(profileKey);
    return Boolean(record && !record.closed);
  }

  nativePageSnapshot(record) {
    return {
      id: record.id,
      platformId: record.platformId,
      profileKey: record.profileKey,
      kind: 'login',
      driver: 'native',
      openedAt: record.openedAt,
      url: record.url,
      title: record.title,
      closed: Boolean(record.closed),
      liveInspection: Boolean(record.debugPort),
      liveInspectionConnected: Boolean(record.cdpBrowser?.isConnected?.()),
      canFocus: false,
      canClose: false,
    };
  }

  async attachNativeLoginRecord(record) {
    if (!record || record.closed || !record.debugPort) return null;
    if (record.cdpBrowser?.isConnected?.()) return record.cdpBrowser;
    if (record.cdpAttachmentPromise) return record.cdpAttachmentPromise;
    if (Number(record.nextCdpAttachAt || 0) > Date.now()) return null;

    const endpoint = `http://127.0.0.1:${record.debugPort}`;
    const pending = Promise.resolve()
      .then(() => this.connectOverCDP(endpoint, { timeout: 1200 }))
      .then((browser) => {
        if (record.closed) return null;
        record.cdpBrowser = browser;
        record.cdpAttachedAt = new Date().toISOString();
        record.cdpAttachError = '';
        record.nextCdpAttachAt = 0;
        browser.on?.('disconnected', () => {
          if (record.cdpBrowser === browser) record.cdpBrowser = null;
        });
        return browser;
      })
      .catch((error) => {
        record.cdpAttachError = String(error?.message || error || 'cdp_attach_failed');
        record.nextCdpAttachAt = Date.now() + 500;
        return null;
      })
      .finally(() => {
        if (record.cdpAttachmentPromise === pending) record.cdpAttachmentPromise = null;
      });
    record.cdpAttachmentPromise = pending;
    return pending;
  }

  async nativeLoginPages(record) {
    const browser = await this.attachNativeLoginRecord(record);
    if (!browser) return [];
    try {
      return browser.contexts()
        .flatMap((context) => context.pages())
        .filter((page) => !this.isPageClosed(page) && this.pageUrl(page) !== 'about:blank');
    } catch {
      return [];
    }
  }

  async closeManagedProfile(profileKey) {
    const key = this.profileKey('', profileKey);
    const context = this.contexts.get(key);
    if (!context) return;
    await context.close().catch(() => {});
    this.contexts.delete(key);
    for (const [windowId, record] of this.pages.entries()) {
      if (record.profileKey === key) this.pages.delete(windowId);
    }
  }


  isPageClosed(page) {
    try {
      return !page || page.isClosed();
    } catch {
      return true;
    }
  }

  pageUrl(page) {
    try {
      return page?.url?.() || '';
    } catch {
      return '';
    }
  }

  async discardStaleContext(profileKey, context = null) {
    const key = this.profileKey('', profileKey);
    if (!context || this.contexts.get(key) === context) this.contexts.delete(key);
    for (const [windowId, record] of this.pages.entries()) {
      if (record.profileKey === key && (!context || !record.context || record.context === context)) {
        this.pages.delete(windowId);
      }
    }
    if (typeof context?.close === 'function') await context.close().catch(() => {});
  }
  async openNativeLogin(platform, profileKey) {
    const key = this.profileKey(platform.id, profileKey);
    const current = this.nativeLoginRecord(key);
    if (current && !current.closed) {
      return this.nativePageSnapshot(current);
    }

    const activeManagedPages = [...this.pages.values()].filter((record) => {
      return record.profileKey === key && !this.isPageClosed(record.page);
    });
    if (activeManagedPages.length) {
      throw new Error('该账号资料正在被发布或检测窗口使用。请先关闭该窗口，再打开平台人工登录。');
    }
    if (this.contextStarts.has(key)) {
      throw new Error('该账号资料正在准备浏览器窗口。请稍候再打开平台人工登录。');
    }
    await this.closeManagedProfile(key);

    const candidate = nativeLoginCandidate();
    if (!candidate) {
      throw new Error('平台人工登录需要本机安装 Google Chrome 或 Microsoft Edge。');
    }
    const profile = path.join(profilesDir, key);
    fs.mkdirSync(profile, { recursive: true });
    let debugPort = null;
    for (let attempt = 0; attempt < 4 && !debugPort; attempt += 1) {
      const candidatePort = await this.allocateNativeDebugPort().catch(() => null);
      const alreadyAssigned = [...this.nativeLoginRecords.values()]
        .some((record) => !record.closed && Number(record.debugPort || 0) === Number(candidatePort || 0));
      if (candidatePort && !alreadyAssigned) debugPort = candidatePort;
    }
    const args = [`--user-data-dir=${profile}`];
    if (debugPort) {
      // An explicit non-zero localhost port makes the operator's normal
      // Chrome/Edge page observable without --enable-automation or
      // --remote-debugging-port=0 (both can expose navigator.webdriver).
      args.push('--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`);
    }
    args.push('--new-window', platform.loginUrl);
    const child = this.spawnNativeBrowser(candidate.executablePath, args);
    const record = {
      id: `window-${randomUUID()}`,
      platformId: platform.id,
      profileKey: key,
      kind: 'login',
      driver: 'native',
      openedAt: new Date().toISOString(),
      url: platform.loginUrl,
      title: `${platform.name} 人工登录`,
      browserLabel: candidate.label,
      browserExecutable: candidate.executablePath,
      debugPort: debugPort || null,
      pid: Number(child.pid || 0) || null,
      closed: false,
    };
    const closeOnce = (error = null) => {
      if (record.closed) return;
      record.closed = true;
      record.closedAt = new Date().toISOString();
      if (error) record.error = String(error.message || error);
      record.cdpBrowser = null;
      record.cdpAttachmentPromise = null;
      this.nativeLoginProcesses.delete(key);
    };
    this.nativeLoginProcesses.set(key, child);
    this.nativeLoginRecords.set(key, record);
    child.once?.('error', closeOnce);
    child.once?.('exit', () => closeOnce());
    child.once?.('close', () => closeOnce());
    return this.nativePageSnapshot(record);
  }
  findReusableBlankPage(context) {
    const managedPages = new Set([...this.pages.values()].map((record) => record.page));
    return context.pages().find((page) => {
      try {
        return !managedPages.has(page) && !page.isClosed() && page.url() === 'about:blank';
      } catch {
        return false;
      }
    }) || null;
  }

  async managedPage(platformId, profileKey, kind = 'login') {
    const key = this.profileKey(platformId, profileKey);
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let context = null;
      let page = null;
      try {
        context = await this.context(platformId, key);
        page = this.findReusableBlankPage(context) || await context.newPage();
        if (this.isPageClosed(page)) throw new Error('Target page, context or browser has been closed');

        const windowId = `window-${randomUUID()}`;
        const record = {
          id: windowId,
          platformId,
          profileKey: key,
          kind,
          openedAt: new Date().toISOString(),
          url: this.pageUrl(page),
          title: '',
          page,
          context,
        };
        this.pages.set(windowId, record);
        page.on?.('close', () => {
          // A dedicated adapter may promote a popup; closing the original
          // dashboard page must not delete the managed record now attached to
          // the promoted editor page.
          if (this.pages.get(windowId) === record && record.page === page) this.pages.delete(windowId);
        });
        page.on?.('framenavigated', () => {
          record.url = this.pageUrl(page);
        });
        return record;
      } catch (error) {
        lastError = error;
        // A persistent context can become stale after an operator closes a
        // window. Discard it and rebuild once; never leave its startup tab in
        // the window list when the recovery attempt fails.
        if (page && !this.isPageClosed(page) && this.pageUrl(page) === 'about:blank' && typeof page.close === 'function') {
          await page.close().catch(() => {});
        }
        if (attempt === 0 && isClosedBrowserTarget(error)) {
          await this.discardStaleContext(key, context);
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('Unable to create a platform browser page.');
  }

  pageSnapshot(record) {
    return {
      id: record.id,
      platformId: record.platformId,
      profileKey: record.profileKey,
      kind: record.kind,
      openedAt: record.openedAt,
      url: this.pageUrl(record.page),
      title: record.title || '',
      closed: this.isPageClosed(record.page),
    };
  }

  listPages() {
    const result = [];
    for (const [windowId, record] of this.pages.entries()) {
      if (this.isPageClosed(record.page)) {
        this.pages.delete(windowId);
        continue;
      }
      result.push(this.pageSnapshot(record));
    }
    for (const record of this.nativeLoginRecords.values()) {
      if (!this.isNativeLoginActive(record.profileKey)) continue;
      result.push(this.nativePageSnapshot(record));
    }
    return result.sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));
  }

  status() {
    const windows = this.listPages();
    return {
      windowCount: windows.length,
      profileCount: new Set([
        ...this.contexts.keys(),
        ...windows.map((item) => item.profileKey),
      ]).size,
      windows,
    };
  }

  async focusPage(windowId) {
    const key = String(windowId || '');
    const nativeRecord = [...this.nativeLoginRecords.values()].find((item) => item.id === key);
    if (nativeRecord && this.isNativeLoginActive(nativeRecord.profileKey)) {
      throw new Error('这是普通系统浏览器登录窗口，请从 Windows 任务栏切换到该窗口。');
    }
    const record = this.pages.get(key);
    if (!record || this.isPageClosed(record.page)) {
      this.pages.delete(key);
      throw new Error('平台窗口已关闭，请重新打开。');
    }
    await record.page.bringToFront().catch(() => {});
    record.title = await record.page.title().catch(() => record.title || '');
    return this.pageSnapshot(record);
  }

  async closePage(windowId) {
    const key = String(windowId || '');
    const nativeRecord = [...this.nativeLoginRecords.values()].find((item) => item.id === key);
    if (nativeRecord && this.isNativeLoginActive(nativeRecord.profileKey)) {
      throw new Error('请在系统浏览器中正常关闭人工登录窗口，以确保 Cookie 和账号资料完整保存。');
    }
    const record = this.pages.get(key);
    if (!record) return { id: key, closed: true };
    await record.page.close().catch(() => {});
    this.pages.delete(key);
    return { id: key, closed: true };
  }

  async openLogin(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    if (platform.hidden === true) throw new Error(`${platform.name}当前已隐藏，暂不处理登录或发布任务。`);
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      throw new Error(`${platform.name}尚未接入本地发布器，暂不能登录或执行任务。`);
    }
    if (!platform.loginUrl || platform.loginUrl === 'about:blank') {
      throw new Error(`${platform.name}不需要或不支持本地登录。`);
    }
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    if (options.forceManaged !== true && nativeLoginCandidate()) {
      const record = await this.openNativeLogin(platform, profileKey);
      return {
        platformId,
        profileKey,
        windowId: record.id,
        url: record.url,
        title: record.title,
        driver: 'native',
        browserLabel: this.nativeLoginRecords.get(profileKey)?.browserLabel || '',
        instructions: '请在普通浏览器中完成登录。发布器会实时检测；若本机实时观察不可用，正常关闭窗口后仍会自动检测已保存的登录状态。',
      };
    }
    const record = await this.managedPage(platformId, profileKey, 'login');
    const page = record.page;
    try {
      await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (error) {
      // Do not leave a visible Chromium startup tab behind when navigation fails.
      if (this.pageUrl(page) === 'about:blank') await this.closePage(record.id);
      throw error;
    }
    await page.bringToFront().catch(() => {});
    record.url = this.pageUrl(page);
    record.title = await page.title().catch(() => '');
    return { platformId, profileKey, windowId: record.id, url: record.url, title: record.title, driver: 'managed' };
  }
  /**
   * Probe a persistent local profile without creating a visible browser
   * window. Scheduled checks run in a short-lived headless context and close
   * the whole context afterwards, so no startup about:blank tab survives.
   */
  async probeLogin(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    if (platform.hidden === true) {
      return { platformId, profileKey, loggedIn: false, reason: 'hidden_platform' };
    }
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      return { platformId, profileKey, loggedIn: false, reason: 'planned_platform' };
    }
    if (this.isNativeLoginActive(profileKey)) {
      return this.inspectLoginPages(platformId, { profileKey });
    }
    // Some platforms challenge every automated/headless navigation even when
    // the saved account session is valid. For those platforms, only inspect a
    // normal Chrome/Edge login window over the read-only localhost CDP bridge;
    // a background probe would manufacture a false "logged out" state and can
    // unnecessarily increase account risk.
    if (platform.sessionProbeMode === 'native_window_only') {
      return {
        platformId,
        profileKey,
        loggedIn: false,
        windowOpen: false,
        reason: 'native_window_probe_required',
        inconclusive: true,
      };
    }
    if (this.contextStarts.has(profileKey) || this.contexts.has(profileKey)) {
      return {
        platformId,
        profileKey,
        loggedIn: false,
        windowOpen: true,
        reason: 'profile_locked',
      };
    }
    const pendingProbe = this.profileProbeStarts.get(profileKey);
    if (pendingProbe) return pendingProbe;
    const probe = this.probeLoginOnce(platform, platformId, profileKey);
    this.profileProbeStarts.set(profileKey, probe);
    try {
      return await probe;
    } finally {
      if (this.profileProbeStarts.get(profileKey) === probe) this.profileProbeStarts.delete(profileKey);
    }
  }

  async probeLoginOnce(platform, platformId, profileKey) {
    let context = null;
    let page = null;
    const profile = path.join(profilesDir, profileKey);
    try {
      fs.mkdirSync(profile, { recursive: true });
      context = await this.launchPersistentBrowser(profile, { headless: true });
      page = context.pages().find((candidate) => !this.isPageClosed(candidate)) || await context.newPage();
      await page.goto(platform.editorUrl || platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
      const signal = await authenticatedSessionSignal(page, platform);
      const blocked = signal.authenticated
        ? { blocked: false, url: this.pageUrl(page) }
        : await detectAccessBlocked(page);
      return {
        platformId,
        profileKey,
        loggedIn: signal.authenticated,
        reason: blocked.blocked ? blocked.reason : (signal.authenticated ? '' : 'authenticated_signal_not_found'),
        inconclusive: !signal.authenticated && !blocked.blocked,
        loginSignal: signal.selector || null,
        loginSignalSource: signal.source,
        url: this.pageUrl(page),
        title: await page.title().catch(() => ''),
      };
    } catch (error) {
      const message = String(error?.message || '');
      const profileLocked = /profile|user data|singleton|lock|in use/i.test(message);
      return {
        platformId,
        profileKey,
        loggedIn: false,
        reason: profileLocked ? 'profile_locked' : 'probe_failed',
        error: message,
        url: this.pageUrl(page),
      };
    } finally {
      await closeTransientContext(context, {
        timeoutMs: this.transientProbeCloseTimeoutMs,
        forceClose: () => this.terminateTransientProbe(profile),
      });
    }
  }

  /**
   * Check login state on pages the operator already opened.  Background login
   * watches must not create visible tabs in a persistent browser context.
   */
  async inspectLoginPages(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`不支持的平台：${platformId}`);
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    const nativeRecord = this.nativeLoginRecord(profileKey);
    if (nativeRecord && !nativeRecord.closed) {
      const nativePages = await this.nativeLoginPages(nativeRecord);
      const blockedResults = [];
      for (const page of nativePages) {
        const url = this.pageUrl(page);
        const title = await page.title().catch(() => nativeRecord.title || '');

        // A positive account/session marker wins over generic page text.  In
        // particular, authenticated menus often contain a hidden "退出登录"
        // item whose text includes the word "登录".
        const signal = await authenticatedSessionSignal(page, platform);
        if (signal.authenticated) {
          nativeRecord.url = url || nativeRecord.url;
          nativeRecord.title = title || nativeRecord.title;
          return {
            platformId,
            profileKey,
            loggedIn: true,
            windowOpen: true,
            windowId: nativeRecord.id,
            driver: 'native-cdp',
            url: nativeRecord.url,
            title: nativeRecord.title,
            loginSignal: signal.selector || null,
            loginSignalSource: signal.source,
            checkedWindowCount: nativePages.length,
          };
        }

        const blocked = await detectAccessBlocked(page);
        blockedResults.push({ url, title, blocked });
      }

      const latest = blockedResults[blockedResults.length - 1];
      if (latest) {
        nativeRecord.url = latest.url || nativeRecord.url;
        nativeRecord.title = latest.title || nativeRecord.title;
      }
      return {
        platformId,
        profileKey,
        loggedIn: false,
        manualLoginInProgress: true,
        windowOpen: true,
        reason: latest?.blocked?.reason || 'manual_login_in_progress',
        windowId: nativeRecord.id,
        url: nativeRecord.url,
        title: nativeRecord.title,
        liveInspection: Boolean(nativeRecord.debugPort),
        liveInspectionConnected: Boolean(nativeRecord.cdpBrowser?.isConnected?.()),
        checkedWindowCount: nativePages.length,
      };
    }
    const records = [...this.pages.values()].filter((record) => {
      return record.platformId === platformId
        && record.profileKey === profileKey
        && record.kind === 'login'
        && !this.isPageClosed(record.page);
    });

    if (!records.length) {
      return {
        platformId,
        profileKey,
        loggedIn: false,
        windowOpen: false,
        reason: 'login_window_closed',
      };
    }

    const blockedResults = [];
    for (const record of records) {
      const page = record.page;
      record.url = this.pageUrl(page);
      record.title = await page.title().catch(() => record.title || '');
      const signal = await authenticatedSessionSignal(page, platform);
      if (signal.authenticated) {
        return {
          platformId,
          profileKey,
          loggedIn: true,
          windowOpen: true,
          windowId: record.id,
          url: record.url,
          title: record.title,
          loginSignal: signal.selector || null,
          loginSignalSource: signal.source,
          checkedWindowCount: records.length,
        };
      }

      const blocked = await detectAccessBlocked(page);
      if (!blocked.blocked) {
        blockedResults.push({ record, blocked: { blocked: true, reason: 'authenticated_signal_not_found' } });
        continue;
      }
      blockedResults.push({ record, blocked });
    }

    const latest = blockedResults[blockedResults.length - 1];
    return {
      platformId,
      profileKey,
      loggedIn: false,
      windowOpen: true,
      reason: latest?.blocked?.reason || 'login_not_detected',
      windowId: latest?.record?.id || null,
      url: latest?.record?.url || '',
      title: latest?.record?.title || '',
      checkedWindowCount: records.length,
    };
  }

  async openEditor(platformId, article, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    if (platform.hidden === true) throw new Error(`${platform.name}当前已隐藏，暂不处理发布任务。`);
    if (platform?.support === 'export') {
      return exportArticleBundle(article);
    }
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      throw new Error(`${platform.name}尚未接入本地发布器，暂不能执行发布任务。`);
    }
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    if (this.isNativeLoginActive(profileKey)) {
      throw new Error('平台人工登录窗口仍在打开。请完成登录并正常关闭该窗口后，再执行发布任务。');
    }
    const record = await this.managedPage(platformId, profileKey, 'publish');
    const page = record.page;
    // The catalog only describes the local adapter's maximum capability. A
    // concrete job must independently opt in to a final public submission.
    // Defaulting this runtime gate to false also keeps direct openEditor()
    // callers and incomplete/legacy job envelopes on the draft-safe path.
    const adapterPlatform = {
      ...platform,
      execution: {
        ...(platform.execution || {}),
        autoSubmit: platform.execution?.autoSubmit === true && options.allowFinalSubmit === true,
      },
    };
    const adapter = createAdapter(adapterPlatform);
    let result;
    try {
      result = await adapter.publishDraft(page, normalizeArticle(article));
    } catch (error) {
      // A failed editor navigation otherwise appears to the operator as a stray blank tab.
      if (this.pageUrl(page) === 'about:blank') await this.closePage(record.id);
      throw error;
    }
    const activePage = adapter.activePage || page;
    if (activePage !== page) {
      // Dedicated adapters may promote a popup into the real editor. Keep the
      // managed window record attached to that page so status, close and
      // result URLs never point back to the dashboard shell.
      const originalPage = record.page;
      record.page = activePage;
      activePage.on?.('close', () => {
        if (this.pages.get(record.id) === record && record.page === activePage) this.pages.delete(record.id);
      });
      activePage.on?.('framenavigated', () => {
        record.url = this.pageUrl(record.page);
      });
      await originalPage.close?.({ runBeforeUnload: false }).catch(() => {});
    }
    record.url = this.pageUrl(activePage);
    record.title = await activePage.title().catch(() => '');
    const decorated = { ...result, adapter: result.adapter || adapter.constructor.name };
    const selectorTelemetry = buildSelectorTelemetry(decorated);
    return {
      ...decorated,
      ...(selectorTelemetry ? { selector_telemetry: selectorTelemetry } : {}),
      windowId: record.id,
      profileKey: record.profileKey,
    };
  }

  async closeAll() {
    for (const context of this.contexts.values()) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();
    this.contextStarts.clear();
    this.profileProbeStarts.clear();
    this.pages.clear();
    // Native login windows are owned by the operator. Do not terminate them
    // during service restart; the dedicated profile will be probed next time.
    this.nativeLoginProcesses.clear();
    this.nativeLoginRecords.clear();
  }
}
