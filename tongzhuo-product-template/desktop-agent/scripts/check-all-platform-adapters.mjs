import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createAdapter } from '../src/adapters/index.js';
import { normalizeArticle } from '../src/article-payload.js';
import {
  executablePlatformIds,
  exportPlatformIds,
  findPlatform,
  platforms,
  runnablePlatformIds,
} from '../src/platforms.js';

const root = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures');
const fixtureUrl = (name) => pathToFileURL(path.join(fixtureRoot, name)).href;
const expectedPlatformCount = 28;
const imageUrl = 'https://assets.example.test/all-platform-cover.png';
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X7p7WQAAAABJRU5ErkJggg==';
const article = normalizeArticle({
  article: {
    title: '全平台离线发布契约测试',
    content_html: `<h2>富文本小标题</h2><p>这是用于验证<strong>全部平台适配器</strong>的正文。</p><p><img src="${imageUrl}" alt="测试图片"></p>`,
  },
  assets: { images: [{ source_url: imageUrl, filename: 'cover.png', mime_type: 'image/png', content_base64: imageBase64 }] },
});

const dedicatedFixtures = Object.freeze({
  zhihu: 'zhihu-editor.html',
  wechat_mp: 'wechat-mp-editor.html',
  toutiao: 'toutiao-editor.html',
  x: 'short-post-publish-success.html',
});

const expectedAdapterNames = Object.freeze({
  zhihu: 'ZhihuAdapter',
  wechat_mp: 'WechatMpAdapter',
  toutiao: 'ToutiaoAdapter',
  x: 'ShortPostAdapter',
});

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
  assert.equal(executablePlatformIds.length, expectedPlatformCount, 'exactly 28 remote publishing platforms must be executable');
  assert.deepEqual(exportPlatformIds, ['zip-download'], 'zip-download is the sole local export and is not one of the 28 remote platforms');
  assert.equal(runnablePlatformIds.length, expectedPlatformCount + 1, 'runnable catalog includes 28 remote platforms plus ZIP export');
  assert.equal(executablePlatformIds.includes('zip-download'), false, 'ZIP export must not be counted as a remote publishing platform');

  for (const platformId of executablePlatformIds) {
    const platform = findPlatform(platformId);
    assert.ok(platform, `${platformId} must resolve from the catalog`);
    assert.equal(platform.support, 'ready', `${platformId} must be advertised as ready`);
    assert.match(platform.loginUrl, /^https:\/\//, `${platformId} must have a real login URL`);
    assert.match(platform.editorUrl, /^https:\/\//, `${platformId} must have a real editor URL`);
    assert.notEqual(platform.editorUrl, 'about:blank', `${platformId} must not open about:blank`);
    assert.ok(['dedicated', 'automated'].includes(platform.execution?.mode), `${platformId} must have an executable mode`);
    assert.equal(platform.execution?.autoSubmit, true, `${platformId} must opt in to verified final submission`);
  }
}

async function checkSuccess(browser, platformId) {
  const catalogPlatform = findPlatform(platformId);
  const editorUrl = fixtureUrl(dedicatedFixtures[platformId] || 'generic-editor-publish-success.html');
  const platform = fixturePlatform(catalogPlatform, editorUrl);
  const adapter = createAdapter(platform);
  const expectedAdapter = expectedAdapterNames[platformId] || 'GenericEditorAdapter';
  assert.equal(adapter.constructor.name, expectedAdapter, `${platformId} must use ${expectedAdapter}`);

  const page = await browser.newPage();
  try {
    const result = await adapter.publishDraft(page, article);
    assert.equal(page.url(), editorUrl, `${platformId} must open its offline editor fixture`);
    assert.equal(result.platformId, platformId, `${platformId} result must preserve the platform id`);
    assert.equal(result.state, 'published', `${platformId} must reach a verified published state`);
    assert.equal(result.next_action, 'none', `${platformId} published result must require no operator action`);
    assert.equal(result.fill?.published, true, `${platformId} must record verified final submission`);
    assert.equal(result.remote_url, editorUrl, `${platformId} result must expose the opened editor URL`);
    assert.ok(result.selectors?.body, `${platformId} result must expose its matched body selector`);
    assert.ok(result.selectors?.publish, `${platformId} result must expose its matched publish selector`);

    if (platformId === 'x') {
      assert.match(await page.locator('[data-testid="tweetTextarea_0"]').innerText(), /全平台离线发布契约测试/);
    } else {
      assert.equal(result.fill?.title, true, `${platformId} must fill the title`);
      assert.equal(result.fill?.body, true, `${platformId} must fill the body`);
      assert.equal(result.fill?.body_format, 'html', `${platformId} must preserve rich HTML in a contenteditable editor`);
      assert.equal(result.fill?.images, 1, `${platformId} must insert the normalized image asset`);
      const bodyHtml = await page.locator(result.selectors.body).first().innerHTML();
      assert.match(bodyHtml, /<h2>富文本小标题<\/h2>/, `${platformId} must preserve rich-text headings`);
      assert.match(bodyHtml, /<strong>全部平台适配器<\/strong>/, `${platformId} must preserve inline formatting`);
      assert.match(bodyHtml, /src="data:image\/png;base64,/, `${platformId} must consume embedded image assets`);
      assert.equal(result.fill?.draft_saved, true, `${platformId} must verify its saved draft before final submission`);
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
