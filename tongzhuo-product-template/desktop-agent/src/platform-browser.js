import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createAdapter } from './adapters/index.js';
import { detectAccessBlocked } from './adapters/fill-tools.js';
import { normalizeArticle } from './article-payload.js';
import { dataDir } from './config-store.js';
import { exportArticleBundle } from './export-bundle.js';
import { findPlatform } from './platforms.js';

const profilesDir = path.join(dataDir, 'profiles');

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

  // The desktop shell supplies its packaged Chromium through this variable.
  addExecutable('内置发布浏览器', process.env.TZ_AGENT_BROWSER_EXECUTABLE);
  addChannel('指定浏览器通道', process.env.TZ_AGENT_BROWSER_CHANNEL);

  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  for (const root of [localAppData, programFilesX86, programFiles]) {
    if (!root) continue;
    addExecutable('Microsoft Edge', path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  for (const root of [localAppData, programFiles, programFilesX86]) {
    if (!root) continue;
    addExecutable('Google Chrome', path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  addExecutable('Playwright Chromium', chromium.executablePath());

  return candidates;
}

async function launchPersistentBrowser(profile) {
  const candidates = browserLaunchCandidates();
  if (!candidates.length) {
    throw new Error('未找到可用的发布浏览器。请重新安装桐灼 GEO 发布器（安装包会自带浏览器运行时），或安装 Microsoft Edge / Google Chrome。');
  }

  for (const candidate of candidates) {
    const options = {
      headless: false,
      viewport: null,
      locale: 'zh-CN',
      acceptDownloads: true,
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

export class PlatformBrowser {
  constructor() {
    this.contexts = new Map();
    this.contextStarts = new Map();
    this.pages = new Map();
  }

  profileKey(platformId, requestedKey = '') {
    const raw = String(requestedKey || platformId || '').trim();
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || platformId;
  }

  async context(platformId, requestedProfileKey = '') {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    const profileKey = this.profileKey(platformId, requestedProfileKey);
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
      const context = await launchPersistentBrowser(profile);
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

  async managedPage(platformId, profileKey, kind = 'login') {
    let context = await this.context(platformId, profileKey);
    let page;
    try {
      page = await context.newPage();
    } catch (error) {
      // A persistent context becomes stale when the operator closes the
      // browser window. Recreate it once so the next click always works.
      if (!/(context|target|browser).*closed|has been closed/i.test(String(error?.message || ''))) throw error;
      this.contexts.delete(this.profileKey(platformId, profileKey));
      context = await this.context(platformId, profileKey);
      page = await context.newPage();
    }

    const windowId = `window-${randomUUID()}`;
    const record = {
      id: windowId,
      platformId,
      profileKey: this.profileKey(platformId, profileKey),
      kind,
      openedAt: new Date().toISOString(),
      url: page.url(),
      title: '',
      page,
    };
    this.pages.set(windowId, record);
    page.on('close', () => {
      if (this.pages.get(windowId) === record) this.pages.delete(windowId);
    });
    page.on('framenavigated', () => {
      record.url = page.url();
    });
    return record;
  }

  pageSnapshot(record) {
    return {
      id: record.id,
      platformId: record.platformId,
      profileKey: record.profileKey,
      kind: record.kind,
      openedAt: record.openedAt,
      url: record.page.url(),
      title: record.title || '',
      closed: record.page.isClosed(),
    };
  }

  listPages() {
    const result = [];
    for (const [windowId, record] of this.pages.entries()) {
      if (record.page.isClosed()) {
        this.pages.delete(windowId);
        continue;
      }
      result.push(this.pageSnapshot(record));
    }
    return result.sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));
  }

  status() {
    const windows = this.listPages();
    return {
      windowCount: windows.length,
      profileCount: this.contexts.size,
      windows,
    };
  }

  async focusPage(windowId) {
    const key = String(windowId || '');
    const record = this.pages.get(key);
    if (!record || record.page.isClosed()) {
      this.pages.delete(key);
      throw new Error('平台窗口已关闭，请重新打开。');
    }
    await record.page.bringToFront().catch(() => {});
    record.title = await record.page.title().catch(() => record.title || '');
    return this.pageSnapshot(record);
  }

  async closePage(windowId) {
    const key = String(windowId || '');
    const record = this.pages.get(key);
    if (!record) return { id: key, closed: true };
    await record.page.close().catch(() => {});
    this.pages.delete(key);
    return { id: key, closed: true };
  }

  async openLogin(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      throw new Error(`${platform.name}尚未接入本地发布器，暂不能登录或执行任务。`);
    }
    if (!platform.loginUrl || platform.loginUrl === 'about:blank') {
      throw new Error(`${platform.name}不需要或不支持本地登录。`);
    }
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    const record = await this.managedPage(platformId, profileKey, 'login');
    const page = record.page;
    await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.bringToFront().catch(() => {});
    record.url = page.url();
    record.title = await page.title().catch(() => '');
    return { platformId, profileKey, windowId: record.id, url: record.url, title: record.title };
  }

  /**
   * Probe a persistent local profile without changing the operator's login
   * page.  A separate short-lived tab visits the editor and checks for a
   * login/captcha/risk gate; the tab is closed immediately afterwards.
   */
  async probeLogin(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`未支持的平台：${platformId}`);
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      return { platformId, profileKey: this.profileKey(platformId, options.profileKey || platformId), loggedIn: false, reason: 'planned_platform' };
    }
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    const record = await this.managedPage(platformId, profileKey, 'probe');
    const page = record.page;
    try {
      await page.goto(platform.editorUrl || platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(700);
      const blocked = await detectAccessBlocked(page);
      return {
        platformId,
        profileKey,
        loggedIn: !blocked.blocked,
        reason: blocked.blocked ? blocked.reason : '',
        url: page.url(),
        title: await page.title().catch(() => ''),
      };
    } catch (error) {
      return {
        platformId,
        profileKey,
        loggedIn: false,
        reason: 'probe_failed',
        error: error.message,
        url: page.url(),
      };
    } finally {
      await this.closePage(record.id);
    }
  }

  /**
   * Check login state on pages the operator already opened.  Background login
   * watches must not create visible tabs in a persistent browser context.
   */
  async inspectLoginPages(platformId, options = {}) {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error(`链未支持的平台：${platformId}`);
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    const records = [...this.pages.values()].filter((record) => {
      return record.platformId === platformId
        && record.profileKey === profileKey
        && record.kind === 'login'
        && !record.page.isClosed();
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
      const blocked = await detectAccessBlocked(page);
      record.url = page.url();
      record.title = await page.title().catch(() => record.title || '');
      if (!blocked.blocked) {
        return {
          platformId,
          profileKey,
          loggedIn: true,
          windowOpen: true,
          windowId: record.id,
          url: record.url,
          title: record.title,
          checkedWindowCount: records.length,
        };
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
    if (platform?.support === 'export') {
      return exportArticleBundle(article);
    }
    if (platform.execution?.mode === 'planned' || platform.support === 'planned') {
      throw new Error(`${platform.name}尚未接入本地发布器，暂不能执行发布任务。`);
    }
    const profileKey = this.profileKey(platformId, options.profileKey || platformId);
    const record = await this.managedPage(platformId, profileKey, 'publish');
    const page = record.page;
    const adapter = createAdapter(platform);
    const result = await adapter.publishDraft(page, normalizeArticle(article));
    record.url = page.url();
    record.title = await page.title().catch(() => '');
    return { ...result, windowId: record.id, profileKey: record.profileKey };
  }

  async closeAll() {
    for (const context of this.contexts.values()) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();
    this.contextStarts.clear();
    this.pages.clear();
  }
}
