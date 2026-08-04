import assert from 'node:assert/strict';
import { normalizeArticle } from '../src/article-payload.js';

const article = normalizeArticle({
  article: {
    title: 'GEO 优化如何帮助企业获客',
    excerpt: '摘要',
    content_html: '<h1>标题</h1><p>第一段&nbsp;内容</p><p>第二段 &amp; 结论</p>',
    keywords: ['GEO优化', '', 'AI搜索'],
  },
});

assert.equal(article.title, 'GEO 优化如何帮助企业获客');
assert.match(article.text, /第一段 内容/);
assert.match(article.text, /第二段 & 结论/);
assert.deepEqual(article.keywords, ['GEO优化', 'AI搜索']);

console.log('Article payload normalization passed.');

