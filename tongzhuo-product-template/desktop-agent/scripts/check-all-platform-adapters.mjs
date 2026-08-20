import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createAdapter } from '../src/adapters/index.js';
import { normalizeArticle } from '../src/article-payload.js';
import { buildSelectorTelemetry } from '../src/platform-result.js';
import { directPlatformProfiles, directShortPostPlatformIds } from '../src/direct-platform-profiles.js';
import {
  executablePlatformIds,
  directPublishPlatformIds,
  exportPlatformIds,
  findPlatform,
  platforms,
  runnablePlatformIds,
} from '../src/platforms.js';

const root = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures');
const fixtureUrl = (name) => pathToFileURL(path.join(fixtureRoot, name)).href;
const expectedPlatformCount = 27;
const imageUrl = 'https://assets.example.test/all-platform-cover.png';
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X7p7WQAAAABJRU5ErkJggg==';
const article = normalizeArticle({
  article: {
    title: '全平台离线发布契约测试',
    content_html: `<h2>富文本小标题</h2><p>这是用于验证<strong>全部平台适配器</strong>的正文。</p><p><img src="${imageUrl}" alt="测试图片"></p>`,
  },
  assets: { images: [{ source_url: imageUrl, filename: 'cover.png', mime_type: 'image/png', content_base64: imageBase64 }] },
});

const dedicatedPlatformIds = Object.freeze(['zhihu', 'wechat_mp', 'toutiao']);

// Dedicated fixtures use hyphenated names; direct-profile fixtures follow the
// {platformId}-editor.html convention.
const platformFixtureNames = Object.freeze({
  zhihu: 'zhihu-editor.html',
  wechat_mp: 'wechat-mp-editor.html',
  toutiao: 'toutiao-editor.html',
});
const fixtureName = (platformId) => platformFixtureNames[platformId] || `${platformId}-editor.html`;

const expectedAdapterNames = Object.freeze({
  zhihu: 'ZhihuAdapter',
  wechat_mp: 'WechatMpAdapter',
  toutiao: 'ToutiaoAdapter',
  baijiahao: 'PlatformDirectAdapter',
  xiaohongshu: 'PlatformDirectAdapter',
  weibo: 'PlatformDirectShortPostAdapter',
  juejin: 'PlatformDirectAdapter',
  csdn: 'PlatformDirectAdapter',
  jianshu: 'PlatformDirectAdapter',
  douyin: 'PlatformDirectAdapter',
  bilibili: 'PlatformDirectAdapter',
  yuque: 'PlatformDirectAdapter',
  douban: 'PlatformDirectAdapter',
  sohu: 'PlatformDirectAdapter',
  xueqiu: 'PlatformDirectShortPostAdapter',
  woshipm: 'PlatformDirectAdapter',
  dayu: 'PlatformDirectAdapter',
  yidian: 'PlatformDirectAdapter',
  '51cto': 'PlatformDirectAdapter',
  imooc: 'PlatformDirectAdapter',
  oschina: 'PlatformDirectAdapter',
  segmentfault: 'PlatformDirectAdapter',
  cnblogs: 'PlatformDirectAdapter',
  sohufocus: 'PlatformDirectAdapter',
  eastmoney: 'PlatformDirectAdapter',
  smzdm: 'PlatformDirectAdapter',
  netease: 'PlatformDirectAdapter',
});

function platformKind(platformId) {
  if (dedicatedPlatformIds.includes(platformId)) return 'dedicated';
  if (directShortPostPlatformIds.includes(platformId)) return 'short_post';
  const profile = directPlatformProfiles[platformId];
  if (profile && (profile.draftSelectors?.length ?? 0) > 0) return 'long_form_with_draft';
  return 'long_form_auto_save';
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    try {
      return await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      throw error;
    }
  }
}

function fixturePlatform(platform, editorUrl) {
  return {
    ...platform,
    loginUrl: editorUrl,
    editorUrl,
  };
}

function assertCatalogContract() {
  const catalogIds = platforms.map((platform) => platform.id);
  assert.equal(new Set(catalogIds).size, catalogIds.length, 'platform catalog ids must be unique');
  assert.equal(executablePlatformIds.length, expectedPlatformCount, 'exactly 27 currently visible remote publishing platforms must be executable');
  assert.deepEqual(Object.keys(expectedAdapterNames).sort(), [...executablePlatformIds].sort(),
    'the adapter matrix must explicitly cover every remote platform');
  assert.deepEqual(exportPlatformIds, ['zip-download'], 'zip-download is the sole local export and is not a remote platform');
  assert.equal(runnablePlatformIds.length, expectedPlatformCount + 1, 'runnable catalog includes 27 visible remote platforms plus ZIP export');
  assert.equal(findPlatform('x')?.hidden, true, 'X remains in the source catalog but is hidden for now');
  assert.equal(executablePlatformIds.includes('x'), false, 'hidden X must not be executable or task-selectable');
  assert.equal(executablePlatformIds.includes('zip-download'), false, 'ZIP export must not be counted as a remote publishing platform');

  for (const platformId of executablePlatformIds) {
    const platform = findPlatform(platformId);
    assert.ok(platform, `${platformId} must resolve from the catalog`);
    assert.equal(platform.support, 'ready', `${platformId} must be advertised as ready`);
    assert.match(platform.loginUrl, /^https:\/\//, `${platformId} must have a real login URL`);
    assert.match(platform.editorUrl, /^https:\/\//, `${platformId} must have a real editor URL`);
    assert.notEqual(platform.editorUrl, 'about:blank', `${platformId} must not open about:blank`);
    assert.ok(['dedicated', 'automated', 'assisted'].includes(platform.execution?.mode), `${platformId} must have an executable mode`);
    if (directPublishPlatformIds.includes(platformId)) assert.equal(platform.execution?.autoSubmit, true, `${platformId} must opt in to verified final submission`);
    else assert.equal(platform.execution?.autoSubmit, false, `${platformId} must require operator confirmation until live verification`);

    const kind = platformKind(platformId);
    if (kind !== 'dedicated') {
      const profile = directPlatformProfiles[platformId];
      assert.ok(profile, `${platformId} must have a verified direct selector profile`);
      const requiredKeys = kind === 'short_post'
        ? ['postSelectors', 'publishSelectors', 'publishSuccessSelectors']
        : ['titleSelectors', 'bodySelectors', 'publishSelectors', 'publishSuccessSelectors'];
      for (const key of requiredKeys) {
        assert.ok(Array.isArray(profile[key]) && profile[key].length > 0, `${platformId} profile must define ${key}`);
      }
      assert.equal(profile.replaceDefaultPublishSelectors, true, `${platformId} profile must replace generic publish selectors`);
      assert.equal(profile.replaceDefaultPublishSuccessSelectors, true, `${platformId} profile must replace generic success selectors`);
    }
  }
}

function assertSuccessTelemetry(platformId, adapter, result, directPublish) {
  const telemetry = buildSelectorTelemetry({ ...result, adapter: adapter.constructor.name });
  assert.ok(telemetry, `${platformId} must expose selector telemetry`);
  assert.equal(telemetry.platform_id, platformId, `${platformId} telemetry must retain the platform id`);
  assert.equal(telemetry.adapter, adapter.constructor.name, `${platformId} telemetry must retain the adapter id`);

  const kind = platformKind(platformId);
  const requiredSteps = kind === 'short_post'
    ? ['body', 'publish', 'publish_success']
    : ['title', 'body', 'publish', 'publish_success'];
  if (kind === 'dedicated' || kind === 'long_form_with_draft') requiredSteps.splice(2, 0, 'draft', 'draft_success');
  for (const name of requiredSteps) {
    const step = telemetry.steps[name];
    assert.ok(step, `${platformId} telemetry must include ${name}`);
    assert.equal(step.status, 'hit', `${platformId} ${name} selector must be a hit`);
    assert.ok(step.selector, `${platformId} ${name} telemetry must retain the matched selector`);
    assert.ok(Number.isInteger(step.candidate_index) && step.candidate_index >= 0,
      `${platformId} ${name} telemetry must retain the fallback index`);
    assert.ok(Number.isInteger(step.attempted) && step.attempted >= step.candidate_index + 1,
      `${platformId} ${name} telemetry must retain attempted selectors`);
  }
}

async function checkSuccess(browser, platformId) {
  const catalogPlatform = findPlatform(platformId);
  const editorUrl = fixtureUrl(fixtureName(platformId));
  const platform = fixturePlatform(catalogPlatform, editorUrl);
  const adapter = createAdapter(platform);
  const expectedAdapter = expectedAdapterNames[platformId];
  assert.ok(expectedAdapter, `${platformId} must have an explicit adapter matrix entry`);
  const directPublish = directPublishPlatformIds.includes(platformId);
  const kind = platformKind(platformId);
  assert.equal(adapter.constructor.name, expectedAdapter, `${platformId} must use ${expectedAdapter}`);

  const page = await browser.newPage();
  try {
    const result = await adapter.publishDraft(page, article);
    assert.equal(page.url(), editorUrl, `${platformId} must open its offline editor fixture`);
    assert.equal(result.platformId, platformId, `${platformId} result must preserve the platform id`);
    assert.equal(result.state, 'published', `${platformId} must return its verified published state`);
    assert.equal(result.next_action, 'none', `${platformId} must expose the completed next action`);
    assert.equal(result.execution_mode, catalogPlatform.execution?.mode, `${platformId} must preserve the catalog execution mode`);
    assert.equal(result.fill?.published, true, `${platformId} must record verified final submission`);
    assertSuccessTelemetry(platformId, adapter, result, directPublish);
    assert.equal(result.remote_url, editorUrl, `${platformId} result must expose the opened editor URL`);
    assert.ok(result.selectors?.body, `${platformId} result must expose its matched body selector`);
    assert.ok(result.selectors?.publish, `${platformId} result must expose its matched publish selector`);

    if (kind === 'short_post') {
      assert.equal(result.fill?.body, true, `${platformId} must fill the post body`);
    } else {
      assert.equal(result.fill?.title, true, `${platformId} must fill the title`);
      assert.equal(result.fill?.body, true, `${platformId} must fill the body`);
      assert.equal(result.fill?.body_format, 'html', `${platformId} must preserve rich HTML in a contenteditable editor`);
      assert.equal(result.fill?.images, 1, `${platformId} must insert the normalized image asset`);
      const bodyHtml = await page.locator(result.selectors.body).first().innerHTML();
      assert.match(bodyHtml, /<h2>富文本小标题<\/h2>/, `${platformId} must preserve rich-text headings`);
      assert.match(bodyHtml, /<strong>全部平台适配器<\/strong>/, `${platformId} must preserve inline formatting`);
      assert.match(bodyHtml, /src="data:image\/png;base64,/, `${platformId} must consume embedded image assets`);
      if (kind === 'dedicated' || kind === 'long_form_with_draft') {
        assert.equal(result.fill?.draft_saved, true, `${platformId} must verify its saved draft before final submission`);
      } else {
        assert.equal(result.fill?.draft_saved, false, `${platformId} must not claim a draft action it does not own`);
      }
    }
  } finally {
    await page.close();
  }
}

async function checkObservableFailure(browser, platformId) {
  const catalogPlatform = findPlatform(platformId);
  const editorUrl = fixtureUrl('login-required.html');
  const adapter = createAdapter(fixturePlatform(catalogPlatform, editorUrl));
  const page = await browser.newPage();
  try {
    const result = await adapter.publishDraft(page, article);
    assert.equal(page.url(), editorUrl, `${platformId} must open its offline login fixture`);
    assert.equal(result.platformId, platformId, `${platformId} failure must preserve the platform id`);
    assert.equal(result.execution_mode, catalogPlatform.execution?.mode, `${platformId} login block must retain the catalog execution mode`);
    assert.equal(result.state, 'awaiting_login', `${platformId} must expose login or verification blocking`);
    assert.equal(result.next_action, 'operator_login_or_verify_platform', `${platformId} must expose a recoverable operator action`);
    assert.ok(result.verification_reason, `${platformId} must expose a verification reason`);
    assert.equal(result.remote_url, editorUrl, `${platformId} failure must expose the observed page URL`);
    assert.notEqual(result.state, 'published', `${platformId} must never report blocked pages as published`);
  } finally {
    await page.close();
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

assertCatalogContract();
const browser = await launchBrowser();
try {
  await runWithConcurrency(executablePlatformIds, 8, (platformId) => checkSuccess(browser, platformId));
  await runWithConcurrency(executablePlatformIds, 8, (platformId) => checkObservableFailure(browser, platformId));
} finally {
  await browser.close();
}

console.log(`All-platform adapter contract passed: ${executablePlatformIds.length} remote platforms; ZIP export excluded.`);
