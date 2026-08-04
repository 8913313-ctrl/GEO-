import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config-store.js';
import { normalizeArticle } from './article-payload.js';

const exportsDir = path.join(dataDir, 'exports');

export function exportArticleBundle(rawArticle = {}) {
  const article = normalizeArticle(rawArticle);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = safeName(article.slug || article.title || 'article');
  const targetDir = path.join(exportsDir, `${stamp}-${slug}`);

  fs.mkdirSync(targetDir, { recursive: true });

  const markdown = toMarkdown(article);
  const html = toHtmlDocument(article);
  const payload = {
    exported_at: new Date().toISOString(),
    article,
    files: ['article.md', 'article.html', 'payload.json', 'README.txt'],
  };

  fs.writeFileSync(path.join(targetDir, 'article.md'), markdown, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'article.html'), html, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'payload.json'), JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'README.txt'), readme(article), 'utf8');

  return {
    platformId: 'zip-download',
    state: 'draft_saved',
    message: `本地导出包已生成：${targetDir}`,
    export_path: targetDir,
    files: payload.files,
  };
}

function toMarkdown(article) {
  const parts = [
    `# ${article.title || '未命名文章'}`,
    '',
  ];

  if (article.excerpt) {
    parts.push(`> ${article.excerpt}`, '');
  }

  if (article.keywords.length) {
    parts.push(`关键词：${article.keywords.join('、')}`, '');
  }

  parts.push(article.text || '');

  return `${parts.join('\n').trim()}\n`;
}

function toHtmlDocument(article) {
  const title = escapeHtml(article.title || '未命名文章');
  const description = escapeHtml(article.excerpt || '');
  const keywords = escapeHtml(article.keywords.join(','));
  const body = article.html || `<p>${escapeHtml(article.text || '').replace(/\n/g, '<br>')}</p>`;

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${title}</title>`,
    `  <meta name="description" content="${description}">`,
    `  <meta name="keywords" content="${keywords}">`,
    '</head>',
    '<body>',
    `  <article>${body}</article>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function readme(article) {
  return [
    '桐灼 GEO 本地发布导出包',
    '',
    `标题：${article.title || '未命名文章'}`,
    `关键词：${article.keywords.join('、') || '无'}`,
    '',
    '文件说明：',
    '- article.md：适合复制到支持 Markdown 的平台。',
    '- article.html：适合复制到富文本编辑器或作为官网归档页。',
    '- payload.json：保留 GEOFlow 结构化文章负载，方便二次处理。',
    '',
    '建议：复制到第三方平台后，请人工检查标题、封面、图片、敏感词和排版。',
    '',
  ].join('\n');
}

function safeName(value) {
  return String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'article';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
