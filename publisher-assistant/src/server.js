import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';
import { createAccountStore } from './account-store.js';
import { extensionPlatformId, findPlatform, isPublishablePlatform, platformCatalog } from './platforms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, '.data');
const configPath = path.join(dataDir, 'config.json');
const profileDir = path.join(dataDir, 'browser-profile');
const profilesDir = path.join(dataDir, 'browser-profiles');
const accountsPath = path.join(dataDir, 'accounts.json');
const configuredPort = Number(process.env.PUBLISHER_PORT || 19180);
const configuredHost = String(process.env.PUBLISHER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const configuredHeadless = String(process.env.BROWSER_HEADLESS || '').toLowerCase() === 'true';
const configuredAutoRun = String(process.env.PUBLISHER_AUTO_RUN || '').toLowerCase() === 'true';
const browserDesktopUrl = process.env.PUBLISHER_VNC_URL || '/publisher-vnc/vnc.html?autoconnect=1&resize=scale&path=publisher-vnc%2Fwebsockify&reconnect=true';
const defaultConfig = {
  geoflowBaseUrl: process.env.GEOFLOW_BASE_URL || 'http://127.0.0.1:19080',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  apiToken: '',
  port: Number.isInteger(configuredPort) && configuredPort >= 1024 && configuredPort <= 65535 ? configuredPort : 19180,
  pollSeconds: Number(process.env.PUBLISHER_POLL_SECONDS) || 20,
  extensionDir: process.env.EXTENSION_DIR || '',
  browserChannel: process.env.BROWSER_CHANNEL || 'chrome',
  browserHeadless: configuredHeadless,
  autoRun: configuredAutoRun,
  publishMode: process.env.PUBLISH_MODE === 'draft' ? 'draft' : 'publish',
};

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(profilesDir, { recursive: true });
const accounts = createAccountStore(accountsPath);

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const stored = JSON.parse(raw);
    const merged = { ...defaultConfig, ...stored };
    return {
      ...merged,
      geoflowBaseUrl: process.env.GEOFLOW_BASE_URL || merged.geoflowBaseUrl,
      port: process.env.PUBLISHER_PORT ? configuredPort : merged.port,
      browserChannel: process.env.BROWSER_CHANNEL || merged.browserChannel,
      browserHeadless: process.env.BROWSER_HEADLESS ? configuredHeadless : Boolean(merged.browserHeadless),
      autoRun: process.env.PUBLISHER_AUTO_RUN ? configuredAutoRun : Boolean(merged.autoRun),
    };
  } catch {
    return { ...defaultConfig };
  }
}

let config = readConfig();

function writeConfig(next) {
  config = { ...defaultConfig, ...next };
  const temporaryPath = `${configPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(temporaryPath, configPath);
}

function publicConfig() {
  return {
    geoflowBaseUrl: config.geoflowBaseUrl,
    publicBaseUrl: config.publicBaseUrl,
    port: config.port,
    pollSeconds: config.pollSeconds,
    extensionDir: config.extensionDir,
    browserChannel: config.browserChannel,
    browserHeadless: Boolean(config.browserHeadless),
    autoRun: Boolean(config.autoRun),
    publishMode: config.publishMode === 'draft' ? 'draft' : 'publish',
    hasToken: Boolean(config.apiToken),
    browserDesktopUrl,
  };
}

function normalizePublishMode(value) {
  return String(value || '').trim() === 'draft' ? 'draft' : 'publish';
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('GEOFlow 地址必须以 http:// 或 https:// 开头');
  }
  return normalized;
}

function apiUrl(endpoint) {
  return `${normalizeBaseUrl(config.geoflowBaseUrl)}${endpoint}`;
}

async function geoflowRequest(endpoint, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const message = body?.error?.message || body?.message || `GEOFlow 请求失败（${response.status}）`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

const runtime = {
  context: null,
  contextAccountId: null,
  authPage: null,
  authPlatform: null,
  authAccountId: null,
  jobs: [],
  activeJobId: null,
  lastPollAt: null,
  lastError: null,
  pollTimer: null,
};

function workerId() {
  const machine = `${os.hostname()}-${os.userInfo().username}`;
  return `local-${crypto.createHash('sha256').update(machine).digest('hex').slice(0, 12)}`;
}

function extensionArgs() {
  const configured = String(config.extensionDir || '').trim();
  const extension = configured && path.isAbsolute(configured) ? configured : path.resolve(rootDir, configured);
  if (!extension || !fs.existsSync(path.join(extension, 'manifest.json'))) {
    return [];
  }
  return [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ];
}

function platformOrThrow(platformId) {
  const platform = findPlatform(platformId);
  if (!isPublishablePlatform(platformId)) throw new Error(`平台尚未接入本地发布器：${platformId}`);
  return platform;
}

function resolveAccount(platformId, accountId, { create = false } = {}) {
  const platform = platformOrThrow(platformId);
  if (accountId) {
    const account = accounts.get(accountId);
    if (!account) throw new Error('未找到该平台账号');
    if (account.platformId !== platform.id) throw new Error('账号与目标平台不匹配');
    if (account.state === 'disabled') throw new Error('该账号已停用');
    return account;
  }
  const existing = accounts.readyForPlatform(platform.id)
    || accounts.list().find((account) => account.platformId === platform.id && account.state !== 'disabled');
  if (existing) return accounts.get(existing.id);
  if (!create) return null;
  return accounts.create({ platformId: platform.id, platformName: platform.name });
}

function accountSummary(account) {
  return account ? accounts.publicAccount(account) : null;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTemporaryBrowserPage(page) {
  const url = page.url();
  return url === 'about:blank'
    || url.startsWith(`http://127.0.0.1:${config.port}/sync.html`)
    || url.startsWith('https://www.wechatsync.com/')
    || url.startsWith('https://fun0.netlify.app/');
}

function watchExtensionPage(page) {
  const closeTemporaryPage = async () => {
    const url = page.url();
    if (url.startsWith('https://www.wechatsync.com/') || url.startsWith('https://fun0.netlify.app/')) {
      await page.close().catch(() => {});
    }
  };
  page.on('framenavigated', closeTemporaryPage);
  page.on('load', closeTemporaryPage);
  void closeTemporaryPage();
}

async function cleanupTemporaryPages(context, keepPage = null) {
  const pages = context.pages().filter((candidate) => candidate !== keepPage && isTemporaryBrowserPage(candidate));
  const onlyBlankPage = pages.length === 1 && pages[0].url() === 'about:blank' && context.pages().length === 1;
  const closablePages = onlyBlankPage ? [] : pages;
  await Promise.all(closablePages.map((candidate) => candidate.close().catch(() => {})));
}

async function closeIdleBrowserContext(context) {
  const pages = context.pages();
  if (pages.length === 1 && pages[0].url() === 'about:blank') {
    await context.close().catch(() => {});
    if (runtime.context === context) {
      runtime.context = null;
      runtime.contextAccountId = null;
    }
  }
}

function profileDirectory(account) {
  if (!account?.profileKey) return profileDir;
  const directory = path.join(profilesDir, account.profileKey);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function clearStaleProfileLocks(directory) {
  if (runtime.context) return;
  for (const filename of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try {
      fs.rmSync(path.join(directory, filename), { force: true });
    } catch {
      // Leave a live Chromium lock untouched if another process owns it.
    }
  }
}

async function closeBrowserContext() {
  if (runtime.authPage && !runtime.authPage.isClosed()) await runtime.authPage.close().catch(() => {});
  await runtime.context?.close().catch(() => {});
  runtime.context = null;
  runtime.contextAccountId = null;
  runtime.authPage = null;
  runtime.authPlatform = null;
  runtime.authAccountId = null;
}

async function browserContext(account = null) {
  const accountId = account?.id || null;
  if (runtime.context && !runtime.context.browser()?.isConnected()) {
    runtime.context = null;
    runtime.contextAccountId = null;
  }
  if (runtime.context && runtime.contextAccountId === accountId) return runtime.context;
  if (runtime.context) await closeBrowserContext();

  const directory = profileDirectory(account);
  clearStaleProfileLocks(directory);
  const args = extensionArgs();
  const launchOptions = {
    headless: Boolean(config.browserHeadless),
    channel: config.browserChannel === 'chromium' ? undefined : config.browserChannel,
    viewport: { width: 1440, height: 900 },
    args,
  };
  try {
    runtime.context = await chromium.launchPersistentContext(directory, launchOptions);
  } catch (error) {
    if (!launchOptions.channel) throw error;
    runtime.lastError = `完整 Chrome 不可用，已回退至 Chromium：${error.message}`;
    runtime.context = await chromium.launchPersistentContext(directory, { ...launchOptions, channel: undefined });
  }
  runtime.contextAccountId = accountId;
  runtime.context.on('page', watchExtensionPage);
  runtime.context.pages().forEach(watchExtensionPage);
  await cleanupTemporaryPages(runtime.context);
  return runtime.context;
}

function payloadForSync(job) {
  const article = job?.payload?.article || {};
  const assets = job?.payload?.assets?.images || [];
  const firstImage = assets.find((asset) => asset?.source_url)?.source_url || '';
  return {
    title: article.title || '',
    desc: article.excerpt || article.meta_description || '',
    content: article.content_html || article.content || '',
    html: article.content_html || article.content || '',
    thumb: firstImage,
    cover: firstImage,
    url: article.slug ? `${config.publicBaseUrl || config.geoflowBaseUrl}/article/${encodeURIComponent(article.slug)}` : '',
  };
}

// The bundled browser adapter is an implementation detail of Tongzhuo's workflow.
async function triggerLocalAdapter(job, platformIds = job?.platforms || [], account) {
  const context = await browserContext(account);
  const syncUrl = `http://127.0.0.1:${config.port}/sync.html`;
  let page = context.pages().find((candidate) => candidate.url().startsWith(syncUrl));
  if (!page) page = context.pages().find((candidate) => candidate.url() === 'about:blank') || await context.newPage();
  await page.goto(syncUrl, { waitUntil: 'domcontentloaded' });
  await cleanupTemporaryPages(context, page);
  await page.waitForTimeout(2500);

  const payload = payloadForSync(job);
  const platforms = platformIds.map(extensionPlatformId);
  const bridgeAvailable = await page.evaluate(() => new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) resolve(false);
    }, 3000);
    const listener = (event) => {
      if (event.data?.source !== 'tongzhuo-wechatsync' || event.data.type !== 'TONGZHUO_BRIDGE_READY') return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', listener);
      resolve(true);
    };
    window.addEventListener('message', listener);
    window.postMessage({ type: 'TONGZHUO_PING' }, '*');
  }));

  const bridgeResult = bridgeAvailable ? await page.evaluate(({ article, selectedPlatforms }) => new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) resolve({ available: true, timedOut: true });
    }, 120000);
    const listener = (event) => {
      if (event.data?.source !== 'tongzhuo-wechatsync') return;
      if (!['TONGZHUO_SYNC_RESULT', 'TONGZHUO_SYNC_ERROR'].includes(event.data.type)) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', listener);
      resolve({ available: true, type: event.data.type, result: event.data.result || null, error: event.data.error || null });
    };
    window.addEventListener('message', listener);
    window.postMessage({ type: 'TONGZHUO_START_SYNC', article, platforms: selectedPlatforms }, '*');
  }), { article: payload, selectedPlatforms: platforms }) : { available: false, reason: 'bridge_unavailable' };

  if (bridgeResult.available && bridgeResult.type === 'TONGZHUO_SYNC_ERROR') {
    throw new Error(bridgeResult.error || '桐灼本地平台适配器执行失败');
  }

  if (bridgeResult.available) {
    return { triggered: true, mode: 'native_bridge', result: bridgeResult.result, payload };
  }

  const triggered = await page.evaluate((article) => {
    if (typeof window.syncPost !== 'function') return false;
    window.syncPost(article);
    return true;
  }, payload);

  if (!triggered) {
    throw new Error('未检测到桐灼本地平台适配器。请检查适配器目录，或重新启动发布助手。');
  }

  return {
    triggered: true,
    mode: 'legacy_sdk',
    pageTitle: await page.title(),
    payload,
  };
}

async function loginPage(platform, accountId = '') {
  const target = platformOrThrow(platform);
  if (runtime.authPage && !runtime.authPage.isClosed()) {
    await runtime.authPage.close().catch(() => {});
  }
  const account = resolveAccount(target.id, accountId, { create: true });
  const context = await browserContext(account);
  if (runtime.authPage && !runtime.authPage.isClosed()) {
    await runtime.authPage.close().catch(() => {});
  }
  const page = await context.newPage();
  runtime.authPage = page;
  runtime.authPlatform = target.id;
  runtime.authAccountId = account.id;
  accounts.update(account.id, { state: 'attention', lastError: '' });
  await page.goto(target.loginUrl || target.url || target.editorUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  return browserSnapshot();
}

async function browserSnapshot() {
  const page = runtime.authPage;
  if (!page || page.isClosed()) return { active: false };
  const image = await page.screenshot({ type: 'jpeg', quality: 72 });
  return {
    active: true,
    platform: runtime.authPlatform,
    account: accountSummary(accounts.get(runtime.authAccountId)),
    url: page.url(),
    title: await page.title().catch(() => ''),
    viewport: { width: 1440, height: 900 },
    image: `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}`,
    desktopUrl: browserDesktopUrl,
  };
}

async function browserAction(body = {}) {
  const page = runtime.authPage;
  if (!page || page.isClosed()) throw new Error('请先点击平台登录，打开后台授权窗口');
  const type = String(body.type || '').trim();
  if (type === 'click') {
    await page.mouse.click(Number(body.x) || 0, Number(body.y) || 0);
  } else if (type === 'drag') {
    const fromX = Number(body.fromX) || 0;
    const fromY = Number(body.fromY) || 0;
    const toX = Number(body.toX) || 0;
    const toY = Number(body.toY) || 0;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 18 });
    await page.waitForTimeout(120);
    await page.mouse.up();
  } else if (type === 'type') {
    await page.keyboard.type(String(body.text || ''));
  } else if (type === 'press') {
    await page.keyboard.press(String(body.key || 'Enter'));
  } else if (type === 'scroll') {
    await page.mouse.wheel(0, Number(body.deltaY) || 600);
  } else if (type === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    throw new Error('不支持的授权操作');
  }
  await page.waitForTimeout(500);
  return browserSnapshot();
}

async function closeBrowserAuth() {
  if (runtime.authPage && !runtime.authPage.isClosed()) await runtime.authPage.close().catch(() => {});
  runtime.authPage = null;
  runtime.authPlatform = null;
  runtime.authAccountId = null;
  return { active: false };
}

async function completeBrowserAuth() {
  const account = accounts.get(runtime.authAccountId);
  if (!account) throw new Error('当前没有可保存的账号授权');
  accounts.update(account.id, { state: 'ready', lastAuthorizedAt: new Date().toISOString(), lastError: '' });
  return { active: true, account: accountSummary(accounts.get(account.id)) };
}

async function clickVisibleAction(page, patterns) {
  for (const pattern of patterns) {
    const locator = page.locator('button, [role="button"], a').filter({ hasText: pattern }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 6000 });
      return true;
    }
  }
  return false;
}

async function finalizePlatform(context, platform, draftUrl) {
  const page = await context.newPage();
  try {
    await page.goto(draftUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1800);

    const publishClicked = await clickVisibleAction(page, [
      /^立即发布$/,
      /^发布文章$/,
      /^发布$/,
      /^发表$/,
      /^提交审核$/,
      /发布文章/,
      /提交审核/,
    ]);
    if (!publishClicked) {
      return { state: 'draft_saved', error: `${platform} 未找到可点击的发布按钮`, remote_url: page.url() };
    }

    await page.waitForTimeout(800);
    await clickVisibleAction(page, [
      /^确认发布$/,
      /^确认发表$/,
      /^确定发布$/,
      /^确认提交$/,
      /^确定提交$/,
    ]);
    await page.waitForTimeout(1800);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/发布失败|发表失败|提交失败|操作失败|验证码|安全验证/.test(bodyText)) {
      return { state: 'draft_saved', error: `${platform} 发布后需要人工处理验证或错误`, remote_url: page.url() };
    }

    return { state: 'published', remote_url: page.url() };
  } catch (error) {
    return { state: 'draft_saved', error: error.message, remote_url: page.url() };
  } finally {
    await page.close().catch(() => {});
  }
}

async function finalizeLocalPlatforms(context, syncResult, platforms) {
  const results = Array.isArray(syncResult?.results) ? syncResult.results : [];
  const finalized = {};
  for (const platform of platforms) {
    const result = results.find((item) => item?.platform === platform);
    if (!result?.success) {
      finalized[platform] = { state: 'failed', error: result?.error || '平台内容同步失败' };
      continue;
    }
    if (!result.postUrl) {
      finalized[platform] = { state: 'draft_saved', error: '平台未返回编辑地址' };
      continue;
    }
    finalized[platform] = await finalizePlatform(context, platform, result.postUrl);
  }
  return finalized;
}

async function fetchJobs() {
  if (!config.apiToken) throw new Error('请先填写 GEOFlow API Token');
  const response = await geoflowRequest('/api/v1/publisher/jobs?limit=30');
  runtime.jobs = response?.data?.items || [];
  runtime.lastPollAt = new Date().toISOString();
  runtime.lastError = null;
  return runtime.jobs;
}

async function claimJob(id) {
  const response = await geoflowRequest(`/api/v1/publisher/jobs/${id}/claim`, {
    method: 'POST',
    headers: { 'X-Publisher-Worker': workerId() },
    body: {},
  });
  return response?.data;
}

async function reportResult(id, state, message = '', extra = {}) {
  const response = await geoflowRequest(`/api/v1/publisher/jobs/${id}/result`, {
    method: 'POST',
    headers: { 'X-Publisher-Worker': workerId() },
    body: {
      state,
      worker_id: workerId(),
      message,
      ...extra,
    },
  });
  return response?.data;
}

function canonicalPlatformId(id) {
  return findPlatform(id)?.id || String(id || '').trim();
}

function publishablePlatformIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(canonicalPlatformId))]
    .filter((id) => isPublishablePlatform(id));
}

function chooseJobPlatforms(job, requestedPlatforms) {
  const jobPlatforms = publishablePlatformIds(job.platforms || []);
  const requested = publishablePlatformIds(requestedPlatforms);
  if (!requested.length) return jobPlatforms;
  const allowed = jobPlatforms.length ? requested.filter((id) => jobPlatforms.includes(id)) : requested;
  if (!allowed.length) throw new Error('当前任务没有包含你选中的平台，请先在 GEOFlow 分发任务中绑定对应平台。');
  return allowed;
}

async function runJob(id, requestedPlatforms = []) {
  if (runtime.activeJobId) throw new Error('当前已有一个发布任务正在处理');
  runtime.activeJobId = Number(id);
  try {
    const job = await claimJob(id);
    const activePlatformIds = chooseJobPlatforms(job, requestedPlatforms);
    if (!activePlatformIds.length) throw new Error('当前任务没有可执行的平台。');

    const missingAccounts = activePlatformIds.filter((platformId) => !accounts.readyForPlatform(platformId));
    if (missingAccounts.length) {
      const platformResults = Object.fromEntries(activePlatformIds.map((platformId) => [platformId, missingAccounts.includes(platformId)
        ? { state: 'awaiting_login', error: '尚未完成本地账号授权' }
        : { state: 'queued' }]));
      const names = missingAccounts.map((platformId) => platformOrThrow(platformId).name).join('、');
      await reportResult(id, 'awaiting_confirmation', `请先在发布器的账号中心完成 ${names} 的本地登录。`, { platform_results: platformResults });
      return { jobId: id, state: 'awaiting_confirmation', platformResults };
    }

    const platformResults = {};
    const executionResults = [];
    for (const platformId of activePlatformIds) {
      const account = accounts.readyForPlatform(platformId);
      try {
        const result = await triggerLocalAdapter(job, [platformId], account);
        const extensionId = extensionPlatformId(platformId);
        const syncResult = result.result?.results ? result.result : result.result?.result;
        const finalized = config.publishMode === 'publish' && syncResult?.results
          ? await finalizeLocalPlatforms(runtime.context, syncResult, [extensionId])
          : { [extensionId]: { state: 'draft_saved' } };
        platformResults[platformId] = finalized[extensionId] || { state: 'draft_saved', error: '平台未返回可确认的执行结果' };
        accounts.update(account.id, {
          state: platformResults[platformId].state === 'published' ? 'ready' : 'attention',
          lastUsedAt: new Date().toISOString(),
          lastError: platformResults[platformId].error || '',
        });
        executionResults.push({ platformId, accountId: account.id, mode: result.mode });
      } catch (error) {
        platformResults[platformId] = { state: 'draft_saved', error: error.message };
        accounts.update(account.id, { state: 'attention', lastError: error.message, lastUsedAt: new Date().toISOString() });
      }
    }
    const states = Object.values(platformResults).map((item) => item.state);
    const hasFailure = states.some((state) => state === 'failed' || state === 'draft_saved');
    const allPublished = states.length > 0 && states.every((state) => state === 'published');
    const nextState = allPublished ? 'published' : (config.publishMode === 'draft' ? 'awaiting_confirmation' : 'awaiting_confirmation');
    const message = config.publishMode === 'publish'
      ? (hasFailure ? '部分平台已生成草稿，但有平台需要人工处理；请检查本机浏览器。' : '已尝试直接发布全部平台。')
      : '已在本机浏览器生成草稿，请检查平台并完成确认。';
    await reportResult(id, nextState, message, {
      remote_url: Object.values(platformResults).find((item) => item.remote_url)?.remote_url,
      platform_results: platformResults,
    });
    return { jobId: id, state: nextState, platformResults, executionResults };
  } catch (error) {
    try {
      await reportResult(id, 'failed', error.message);
    } catch {
      // Keep the original error visible in the local dashboard.
    }
    throw error;
  } finally {
    runtime.activeJobId = null;
    await fetchJobs().catch((error) => { runtime.lastError = error.message; });
  }
}

async function poll() {
  if (!config.apiToken || runtime.activeJobId) return;
  try {
    await fetchJobs();
    if (!config.autoRun) return;
    const nextJob = runtime.jobs.find((job) => {
      const state = String(job.assistant?.state || '').trim();
      return job.status === 'queued' && !['processing', 'awaiting_confirmation', 'published', 'completed', 'cancelled'].includes(state);
    });
    if (nextJob) await runJob(nextJob.id);
  } catch (error) {
    runtime.lastError = error.message;
  }
}

function resetPollTimer() {
  if (runtime.pollTimer) clearInterval(runtime.pollTimer);
  runtime.pollTimer = setInterval(poll, Math.max(10, Number(config.pollSeconds) || 20) * 1000);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((request, response, next) => {
  const origin = request.get('Origin');
  const allowedOrigins = new Set();
  for (const value of [config.publicBaseUrl, config.geoflowBaseUrl]) {
    try { allowedOrigins.add(new URL(value).origin); } catch { /* Ignore an unset URL. */ }
  }
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
});
app.use(express.static(publicDir));

app.get('/api/config', (_request, response) => {
  response.json({ ok: true, config: publicConfig(), workerId: workerId() });
});

app.get('/healthz', (_request, response) => {
  response.json({ ok: true, service: 'tongzhuo-publisher-assistant', workerId: workerId() });
});

app.get('/api/platforms', (_request, response) => {
  response.json({ ok: true, platforms: platformCatalog });
});

app.get('/api/accounts', (_request, response) => {
  response.json({ ok: true, accounts: accounts.list() });
});

app.post('/api/accounts', (request, response) => {
  try {
    const platform = platformOrThrow(request.body?.platformId);
    const account = accounts.create({
      platformId: platform.id,
      platformName: platform.name,
      label: request.body?.label,
    });
    response.status(201).json({ ok: true, account: accountSummary(account) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.patch('/api/accounts/:id', (request, response) => {
  const account = accounts.update(request.params.id, {
    label: request.body?.label,
    state: request.body?.state,
  });
  if (!account) {
    response.status(404).json({ ok: false, message: '未找到账号' });
    return;
  }
  response.json({ ok: true, account: accountSummary(account) });
});

app.post('/api/config', (request, response) => {
  try {
    const body = request.body || {};
    writeConfig({
      geoflowBaseUrl: normalizeBaseUrl(body.geoflowBaseUrl || config.geoflowBaseUrl),
      publicBaseUrl: body.publicBaseUrl !== undefined ? normalizeBaseUrl(body.publicBaseUrl) : config.publicBaseUrl,
      apiToken: body.apiToken !== undefined ? String(body.apiToken).trim() : config.apiToken,
      port: Math.max(1024, Math.min(65535, Number(body.port || config.port))),
      pollSeconds: Math.max(10, Math.min(3600, Number(body.pollSeconds || config.pollSeconds))),
      extensionDir: String(body.extensionDir || config.extensionDir).trim(),
      browserChannel: String(body.browserChannel || config.browserChannel).trim() || 'chrome',
      browserHeadless: body.browserHeadless !== undefined ? Boolean(body.browserHeadless) : config.browserHeadless,
      autoRun: body.autoRun !== undefined ? Boolean(body.autoRun) : config.autoRun,
      publishMode: normalizePublishMode(body.publishMode || config.publishMode),
    });
    resetPollTimer();
    response.json({ ok: true, config: publicConfig(), workerId: workerId() });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.get('/api/status', (_request, response) => {
  response.json({
    ok: true,
    config: publicConfig(),
    workerId: workerId(),
    activeJobId: runtime.activeJobId,
    lastPollAt: runtime.lastPollAt,
    lastError: runtime.lastError,
    jobs: runtime.jobs,
  });
});

app.post('/api/connect', async (_request, response) => {
  try {
    const jobs = await fetchJobs();
    response.json({ ok: true, count: jobs.length, jobs });
  } catch (error) {
    runtime.lastError = error.message;
    response.status(error.status && error.status < 500 ? error.status : 502).json({ ok: false, message: error.message, details: error.body || null });
  }
});

app.post('/api/jobs/:id/run', async (request, response) => {
  try {
    const result = await runJob(Number(request.params.id), request.body?.platforms || []);
    response.json({ ok: true, result });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/jobs/:id/result', async (request, response) => {
  try {
    const state = String(request.body?.state || '');
    if (!['draft_saved', 'published', 'cancelled', 'failed'].includes(state)) {
      response.status(422).json({ ok: false, message: '状态无效' });
      return;
    }
    const result = await reportResult(Number(request.params.id), state, String(request.body?.message || ''), {
      remote_url: request.body?.remote_url || undefined,
      platform_results: request.body?.platform_results || undefined,
    });
    await fetchJobs().catch((error) => { runtime.lastError = error.message; });
    response.json({ ok: true, result });
  } catch (error) {
    response.status(error.status && error.status < 500 ? error.status : 502).json({ ok: false, message: error.message });
  }
});

app.post('/api/browser/login/:platform', async (request, response) => {
  try {
    const result = await loginPage(String(request.params.platform), String(request.body?.accountId || ''));
    response.json({ ok: true, result, message: `${result.account?.label || result.platform} 授权窗口已打开，请直接在当前后台完成登录` });
  } catch (error) {
    response.status(error.status || 500).json({ ok: false, message: error.message });
  }
});

app.get('/api/browser/session', async (_request, response) => {
  try {
    response.json({ ok: true, result: await browserSnapshot() });
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/browser/session/action', async (request, response) => {
  try {
    response.json({ ok: true, result: await browserAction(request.body || {}) });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/browser/session/close', async (_request, response) => {
  response.json({ ok: true, result: await closeBrowserAuth() });
});

app.post('/api/browser/session/complete', async (_request, response) => {
  try {
    response.json({ ok: true, result: await completeBrowserAuth() });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/browser/check', async (_request, response) => {
  const hadContext = Boolean(runtime.context);
  let context = null;
  let page = null;
  let createdPage = false;
  try {
    context = await browserContext();
    await wait(700);
    page = context.pages().find((candidate) => candidate.url().startsWith(`http://127.0.0.1:${config.port}/sync.html`))
      || context.pages().find((candidate) => candidate.url() === 'about:blank');
    if (!page) { page = await context.newPage(); createdPage = true; }
    await page.goto(`http://127.0.0.1:${config.port}/sync.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const available = await page.evaluate(() => new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) resolve(false);
      }, 3000);
      const listener = (event) => {
        if (event.data?.source !== 'tongzhuo-wechatsync' || event.data.type !== 'TONGZHUO_BRIDGE_READY') return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('message', listener);
        resolve(true);
      };
      window.addEventListener('message', listener);
      window.postMessage({ type: 'TONGZHUO_PING' }, '*');
    }));
    response.json({
      ok: true,
      available: true,
      compatibilityAdapterAvailable: available,
      message: available
        ? '本机 Chrome 与兼容平台适配器均已就绪。'
        : '本机 Chrome 已就绪。旧兼容适配器未加载，不影响账号登录和人工接管。',
    });
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
  } finally {
    if (page) await page.close().catch(() => {});
    if (context && !hadContext) {
      await context.close().catch(() => {});
      runtime.context = null;
    } else if (context) {
      await cleanupTemporaryPages(context);
      await closeIdleBrowserContext(context);
    }
  }
});

const server = app.listen(Number(config.port), configuredHost, () => {
  resetPollTimer();
  console.log(`桐灼 GEOFlow 发布助手已启动：http://127.0.0.1:${config.port}`);
});

function shutdown() {
  clearInterval(runtime.pollTimer);
  server.close();
  runtime.context?.close().catch(() => {});
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
