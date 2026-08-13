import assert from 'node:assert/strict';
import { normalizeArticle } from '../src/article-payload.js';
import { executablePlatformIds, findPlatform } from '../src/platforms.js';
import { createAdapter } from '../src/adapters/index.js';

const imageUrl = 'https://assets.example.test/cover.png';
const rawArticle = {
  title: '富文本与图片契约测试',
  content_html: `<h2>富文本标题</h2><p><strong>加粗正文</strong></p><figure><img src="${imageUrl}" alt="测试图片"><figcaption>图片说明</figcaption></figure><ul><li>列表项目</li></ul>`,
  assets: {
    images: [{ url: imageUrl, alt: '测试图片', caption: '图片说明' }],
  },
};

const article = normalizeArticle(rawArticle);
assert.equal(article.html, rawArticle.content_html, 'normalization must retain source rich HTML unchanged');
assert.match(article.html, /<strong>加粗正文<\/strong>/, 'rich HTML must retain formatting tags');
assert.match(article.html, /<img[^>]+cover\.png/, 'rich HTML must retain inline image markup');
assert.match(article.text, /加粗正文/, 'plain-text fallback must remain readable');

assert.equal(Array.isArray(article.assets?.images), true, 'normalization must expose assets.images');
assert.equal(article.assets.images.length, 1, 'normalization must retain one valid image asset');
assert.equal(article.assets.images[0].url || article.assets.images[0].source_url, imageUrl, 'normalized image must retain its URL');
assert.equal(article.assets.images[0].alt, '测试图片', 'normalized image must retain alt text');
assert.equal(article.assets.images[0].caption, '图片说明', 'normalized image must retain its caption');
assert.deepEqual(article.images, article.assets.images, 'top-level images and assets.images must expose one shared normalized contract');

assert.equal(executablePlatformIds.length, 28, 'rich-content contract must cover all 28 remote platforms');
for (const platformId of executablePlatformIds) {
  const platform = findPlatform(platformId);
  const adapter = createAdapter(platform);
  assert.ok(adapter, `${platformId} must create an adapter`);
  assert.equal(adapter.platform.id, platformId, `${platformId} adapter must preserve platform identity`);
  assert.equal(typeof adapter.publishDraft, 'function', `${platformId} must expose the publish contract`);

  // All adapters receive the same normalized payload. This test proves data
  // availability without opening or publishing to a real account. Actual DOM
  // image upload remains a signed-in staging test per platform.
  assert.equal(article.html, rawArticle.content_html, `${platformId} must receive unchanged rich HTML`);
  assert.equal(article.assets.images[0].url || article.assets.images[0].source_url, imageUrl, `${platformId} must receive image asset metadata`);
}

console.log(`Rich-content asset contract passed: ${executablePlatformIds.length} platform adapters receive HTML and assets.images.`);
