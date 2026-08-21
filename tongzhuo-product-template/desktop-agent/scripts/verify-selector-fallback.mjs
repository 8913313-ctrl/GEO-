// Local verification: a platform whose profile selectors MISS the live DOM
// must fall back to the generic editor candidates and still publish.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createAdapter } from '../src/adapters/index.js';
import { findPlatform } from '../src/platforms.js';
import { normalizeArticle } from '../src/article-payload.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = pathToFileURL(path.join(root, 'tests', 'fixtures', 'generic-editor-publish-success.html')).href;
const article = normalizeArticle({
  article: {
    title: '兜底发布契约测试',
    content_html: '<h2>小标题</h2><p>这是<strong>兜底</strong>正文。</p>',
  },
});

// baijiahao profile selectors (#articleTitle, .article-content ...) do NOT
// exist in generic-editor-publish-success.html, so every profile candidate
// misses; the generic candidates must take over.
const browser = await chromium.launch({ headless: true });
try {
  for (const platformId of ['baijiahao', 'xiaohongshu', 'sohu', 'netease']) {
    const platform = findPlatform(platformId);
    const page = await browser.newPage();
    const adapter = createAdapter({ ...platform, loginUrl: fixture, editorUrl: fixture });
    const result = await adapter.publishDraft(page, article);
    assert.equal(result.state, 'published', `${platformId} fallback must publish on the generic fixture`);
    assert.equal(result.fill?.title, true, `${platformId} fallback must fill the title`);
    assert.equal(result.fill?.body, true, `${platformId} fallback must fill the body`);
    assert.equal(result.fill?.published, true, `${platformId} fallback must verify the success signal`);
    assert.ok(result.selectors?.title, `${platformId} fallback must record the matched title selector`);
    assert.ok(result.selectors?.body, `${platformId} fallback must record the matched body selector`);
    console.log(`${platformId}: fallback publish OK (title=${result.selectors.title} body=${result.selectors.body} draft=${result.selectors.draft})`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('FALLBACK VERIFY: ALL PASSED');
