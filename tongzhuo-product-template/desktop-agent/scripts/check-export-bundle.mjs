import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../src/config-store.js';
import { exportArticleBundle } from '../src/export-bundle.js';

const result = exportArticleBundle({
  title: '导出包测试文章',
  slug: 'export-test',
  excerpt: '用于验证本地发布助手导出包。',
  content: '<p>第一段内容</p><p>第二段内容</p>',
  keywords: ['GEO', '发布助手'],
});

try {
  assert.equal(result.state, 'draft_saved');
  assert.ok(fs.existsSync(result.export_path));
  for (const file of ['article.md', 'article.html', 'payload.json', 'README.txt']) {
    assert.ok(fs.existsSync(path.join(result.export_path, file)), `${file} should exist`);
  }

  const markdown = fs.readFileSync(path.join(result.export_path, 'article.md'), 'utf8');
  assert.match(markdown, /导出包测试文章/);
  assert.match(markdown, /第一段内容/);

  console.log('Export bundle behavior passed.');
} finally {
  if (result.export_path) {
    fs.rmSync(result.export_path, { recursive: true, force: true });
  }
  fs.rmSync(path.join(dataDir, 'exports'), { recursive: true, force: true });
  try {
    fs.rmdirSync(dataDir);
  } catch {
    // Keep .data if another local test restored user data.
  }
}
