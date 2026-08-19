import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';
import { extensionPlatformId, findPlatform, platformCatalog } from './platforms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, '.data');
const configPath = path.join(dataDir, 'config.json');
const profileDir = path.join(dataDir, 'browser-profile');
const configuredPort = Number(process.env.PUBLISHER_PORT || 19180);
const configuredHost = String(process.env.PUBLISHER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const configuredHeadless = String(process.env.BROWSER_HEADLESS || '').toLowerCase() === 'true';
const defaultConfig = {
  geoflowBaseUrl: process.env.GEOFLOW_BASE_URL || 'http://127.0.0.1:19080',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  apiToken: '',
  port: Number.isInteger(configuredPort) && configuredPort >= 1024 && configuredPort <= 65535 ? configuredPort : 19180,
  pollSeconds: Number(process.env.PUBLISHER_POLL_SECONDS) || 20,
  extensionDir: process.env.EXTENSION_DIR || '',
  browserChannel: process.env.BROWSER_CHANNEL || 'chromium',
  browserHeadless: configuredHeadless,
  publishMode: process.env.PUBLISH_MODE === 'draft' ? 'draft' : 'publish',
};

fs.mkdirSync(dataDir, { recursive: true });

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const stored = JSON.parse(raw);
    const merged = { ...defaultConfig, ...stored };
    return {
      ...merged,
      geoflowBaseUrl: process.env.GEOFLOW_BASE_URL || merged.geoflowBaseUrl,
      port: process.env.PUBLISHER_PORT ? configuredPort : merged.port,
      browserHeadless: process.env.BROWSER_HEADLESS ? configuredHeadless : Boolean(merged.browserHeadless),
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
    publishMode: config.publishMode === 'draft' ? 'draft' : 'publish',
    hasToken: Boolean(config.apiToken),
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
    if (runtime.context === context) runtime.context = null;
  }
}

async function browserContext() {
  if (runtime.context && !runtime.context.browser()?.isConnected()) {
    runtime.context = null;
  }
  if (runtime.context) return runtime.context;

  const args = extensionArgs();
  runtime.context = await chromium.launchPersistentContext(profileDir, {
    headless: Boolean(config.browserHeadless),
    channel: config.browserChannel === 'chromium' ? undefined : config.browserChannel,
    viewport: { width: 1440, height: 900 },
    args,
  });
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
async function triggerLocalAdapter(job, platformIds = job?.platforms || []) {
  const context = await browserContext();
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

async function loginPage(platform) {
  const context = await browserContext();
  const target = findPlatform(platform);
  if (!target) throw new Error(`未配置平台：${platform}`);
  if (target.mode === 'export') return { platform, url: '', mode: 'export_only' };
  const page = await context.newPage();
  await page.goto(target.url, { waitUntil: 'domcontentloaded' });
  await cleanupTemporaryPages(context, page);
  return { platform, url: page.url() };
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
    .filter((id) => findPlatform(id)?.mode !== 'export');
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
    const result = await triggerLocalAdapter(job, activePlatformIds);
    const selectedPlatforms = activePlatformIds.map(extensionPlatformId);
    const syncResult = result.result?.results ? result.result : result.result?.result;
    const platformResults = config.publishMode === 'publish' && syncResult?.results
      ? await finalizeLocalPlatforms(runtime.context, syncResult, selectedPlatforms)
      : Object.fromEntries(activePlatformIds.map((platform) => [platform, { state: 'draft_saved' }]));
    const states = Object.values(platformResults).map((item) => item.state);
    const hasFailure = states.some((state) => state === 'failed' || state === 'draft_saved');
    const allPublished = states.length > 0 && states.every((state) => state === 'published');
    const nextState = allPublished ? 'published' : (config.publishMode === 'draft' ? 'awaiting_confirmation' : 'awaiting_confirmation');
    const message = config.publishMode === 'publish'
      ? (hasFailure ? '部分平台已生成草稿，但有平台需要人工处理；请检查本地浏览器。' : '已尝试直接发布全部平台。')
      : '已在本地浏览器生成草稿，请检查平台并完成确认。';
    await reportResult(id, nextState, message, {
      remote_url: Object.values(platformResults).find((item) => item.remote_url)?.remote_url,
      platform_results: platformResults,
    });
    return { ...result, jobId: id, state: nextState, platformResults };
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
      browserChannel: String(body.browserChannel || config.browserChannel).trim() || 'chromium',
      browserHeadless: body.browserHeadless !== undefined ? Boolean(body.browserHeadless) : config.browserHeadless,
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
    response.json({ ok: true, result: await loginPage(String(request.params.platform)) });
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message });
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
    response.json({ ok: true, available, message: available ? '桐灼本地平台适配器已就绪。' : '未检测到桐灼本地平台适配器，请检查适配器目录和浏览器设置。' });
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
