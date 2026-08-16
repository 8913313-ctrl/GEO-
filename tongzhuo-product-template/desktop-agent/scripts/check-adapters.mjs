import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createAdapter } from '../src/adapters/index.js';
import { normalizeArticle } from '../src/article-payload.js';
import { buildSelectorTelemetry } from '../src/platform-result.js';

const root = path.resolve(import.meta.dirname, '..');
const article = normalizeArticle({
  title: 'GEO 优化如何帮助企业获客',
  content_html: '<p>第一段内容</p><p>第二段内容</p>',
});

const successCases = [
  {
    id: 'zhihu',
    name: '知乎',
    fixture: 'zhihu-editor.html',
    support: 'ready',
    execution: { mode: 'dedicated', autoSubmit: true },
    expectedState: 'published',
    publishSuccessSelector: '#publish-success',
    titleSelector: 'textarea[placeholder*="标题"]',
    bodySelector: '[contenteditable="true"][data-placeholder*="正文"]',
  },
  {
    id: 'wechat_mp',
    name: '微信公众号',
    fixture: 'wechat-mp-editor.html',
    support: 'ready',
    execution: { mode: 'dedicated', autoSubmit: true },
    expectedState: 'published',
    publishSuccessSelector: '#publish-success',
    titleSelector: '#title',
    bodySelector: '#ueditor_0',
  },
  {
    id: 'toutiao',
    name: '头条号',
    fixture: 'toutiao-editor.html',
    support: 'ready',
    execution: { mode: 'dedicated', autoSubmit: true },
    expectedState: 'published',
    publishSuccessSelector: '#publish-success',
    titleSelector: '.article-title input',
    bodySelector: '.ProseMirror[contenteditable="true"]',
  },
  {
    id: 'baijiahao',
    name: '百家号',
    fixture: 'generic-editor.html',
    support: 'manual',
    execution: { mode: 'assisted' },
    expectedState: 'draft_saved',
    titleSelector: 'input[name="articleTitle"]',
    bodySelector: '.ql-editor[contenteditable="true"]',
  },
];

const nonSuccessCases = [
  {
    id: 'csdn',
    name: 'CSDN',
    fixture: 'generic-editor-no-save-confirmation.html',
    support: 'manual',
    execution: { mode: 'assisted' },
    expectedState: 'failed',
    expectedNextAction: 'operator_inspect_failed_platforms',
  },
  {
    id: 'juejin',
    name: '掘金',
    fixture: 'login-required.html',
    support: 'manual',
    execution: { mode: 'assisted' },
    expectedState: 'awaiting_login',
    expectedNextAction: 'operator_login_or_verify_platform',
  },
  {
    id: 'weibo',
    name: '微博',
    fixture: 'generic-editor-risk-after-save.html',
    support: 'manual',
    execution: { mode: 'assisted' },
    expectedState: 'awaiting_login',
    expectedNextAction: 'operator_login_or_verify_platform',
  },
];

const publishedCase = {
  id: 'segmentfault',
  name: 'SegmentFault',
  fixture: 'generic-editor-publish-success.html',
  support: 'manual',
  execution: { mode: 'assisted', autoSubmit: true },
  editorHints: {
    publishSelectors: ['#publish-article'],
    publishSuccessSelectors: ['[data-publish-state="published"]'],
  },
  titleSelector: 'input[name="articleTitle"]',
  bodySelector: '.ql-editor[contenteditable="true"]',
};

const shortPostCase = {
  id: 'x',
  name: 'X',
  fixture: 'short-post-publish-success.html',
  support: 'ready',
  execution: { mode: 'automated', autoSubmit: true },
  bodySelector: '[data-testid="tweetTextarea_0"]',
};

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

function platformFor(item, editorUrl) {
  return {
    id: item.id,
    name: item.name,
    editorUrl,
    loginUrl: editorUrl,
    support: item.support,
    execution: item.execution,
    editorHints: item.editorHints,
  };
}

const browser = await launchBrowser();
try {
  for (const item of successCases) {
    const page = await browser.newPage();
    const editorUrl = pathToFileURL(path.join(root, 'tests', 'fixtures', item.fixture)).href;
    const adapter = createAdapter(platformFor(item, editorUrl));
    const result = await adapter.publishDraft(page, article);

    assert.equal(result.state, item.expectedState, `${item.id} should return ${item.expectedState}`);
    assert.equal(result.next_action, item.execution?.autoSubmit === true ? 'none' : 'operator_confirm_publish', `${item.id} should expose the safe next action for its execution mode`);
    assert.notEqual(result.state, 'awaiting_confirmation', `${item.id} must not emit the retired manual-confirmation state`);
    await expectValue(page, item.titleSelector, article.title);
    await expectText(page, item.bodySelector, '第一段内容');
    await expectVisible(page, '[data-save-result="draft_saved"]');
    assert.equal(await page.locator('body').getAttribute('data-save-state'), 'saved');
    if (item.expectedState === 'published') {
      assert.equal(result.fill?.published, true);
      await expectVisible(page, item.publishSuccessSelector);
    } else {
      assert.notEqual(result.state, 'published', `${item.id} must not report final publication from a draft-save flow`);
    }
    const telemetry = buildSelectorTelemetry({ ...result, adapter: adapter.constructor.name });
    assert.equal(telemetry.platform_id, item.id, `${item.id} telemetry must retain platform identity`);
    assert.equal(telemetry.adapter, adapter.constructor.name, `${item.id} telemetry must retain adapter identity`);
    assert.equal(telemetry.steps.title.status, 'hit', `${item.id} title selector must report a hit`);
    assert.equal(telemetry.steps.body.status, 'hit', `${item.id} body selector must report a hit`);
    assert.ok(Number.isInteger(telemetry.steps.body.candidate_index), `${item.id} body telemetry must retain the matched fallback index`);
    assert.ok(telemetry.steps.body.attempted >= telemetry.steps.body.candidate_index + 1, `${item.id} body telemetry attempts must include the matched candidate`);
    assert.ok(telemetry.steps.body.candidate_count >= telemetry.steps.body.attempted, `${item.id} body telemetry candidate count must bound attempts for one-pass fills`);
    await page.close();

    if (item.execution?.mode === 'dedicated') {
      const guardedPage = await browser.newPage();
      const guardedPlatform = platformFor({
        ...item,
        execution: { ...item.execution, autoSubmit: false },
      }, editorUrl);
      const guardedAdapter = createAdapter(guardedPlatform);
      const guardedResult = await guardedAdapter.publishDraft(guardedPage, article);
      assert.equal(guardedResult.state, 'draft_saved', `${item.id} must stay at a saved draft when the task-level submit gate is closed`);
      assert.equal(guardedResult.fill?.draft_saved, true, `${item.id} must still verify its draft save`);
      assert.notEqual(guardedResult.fill?.published, true, `${item.id} must not click the final publish action when the task-level submit gate is closed`);
      assert.equal(await guardedPage.locator(item.publishSuccessSelector).isVisible(), false, `${item.id} must not expose a final publish acknowledgement on a guarded task`);
      await guardedPage.close();
    }
  }

  {
    const item = publishedCase;
    const page = await browser.newPage();
    const editorUrl = pathToFileURL(path.join(root, 'tests', 'fixtures', item.fixture)).href;
    const adapter = createAdapter(platformFor(item, editorUrl));
    const result = await adapter.publishDraft(page, article);
    assert.equal(result.state, 'published', 'a real submit acknowledgement should be reported as published');
    assert.equal(result.next_action, 'none');
    assert.equal(result.fill?.draft_saved, true);
    assert.equal(result.fill?.published, true);
    await expectValue(page, item.titleSelector, article.title);
    await expectText(page, item.bodySelector, '第一段内容');
    await expectVisible(page, '[data-save-result="draft_saved"]');
    await expectVisible(page, '[data-publish-state="published"]');
    await page.close();
  }

  {
    const item = shortPostCase;
    const page = await browser.newPage();
    const editorUrl = pathToFileURL(path.join(root, 'tests', 'fixtures', item.fixture)).href;
    const adapter = createAdapter(platformFor(item, editorUrl));
    const result = await adapter.publishDraft(page, article);
    assert.equal(result.state, 'published', 'short post adapter should publish after a visible sent acknowledgement');
    assert.equal(result.next_action, 'none');
    assert.equal(result.fill?.body, true);
    assert.equal(result.fill?.published, true);
    await expectText(page, item.bodySelector, article.title);
    await expectVisible(page, '[data-publish-state="sent"]');
    await page.close();
  }

  for (const item of nonSuccessCases) {
    const page = await browser.newPage();
    const editorUrl = pathToFileURL(path.join(root, 'tests', 'fixtures', item.fixture)).href;
    const adapter = createAdapter(platformFor(item, editorUrl));
    const result = await adapter.publishDraft(page, article);
    assert.equal(result.state, item.expectedState, `${item.id} should return ${item.expectedState}`);
    assert.equal(result.next_action, item.expectedNextAction, `${item.id} should provide a recoverable next action`);
    assert.notEqual(result.state, 'published', `${item.id} must not report a publish success`);
    assert.notEqual(result.state, 'awaiting_confirmation', `${item.id} must not leave the automatic path awaiting confirmation`);
    await page.close();
  }
  console.log('Adapter automatic-result contract passed.');
} finally {
  await browser.close();
}

async function expectValue(page, selector, expected) {
  const value = await page.locator(selector).first().inputValue();
  assert.equal(value, expected);
}

async function expectText(page, selector, expected) {
  const text = await page.locator(selector).first().innerText();
  assert.match(text, new RegExp(expected));
}

async function expectVisible(page, selector) {
  assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} should be visible`);
}
