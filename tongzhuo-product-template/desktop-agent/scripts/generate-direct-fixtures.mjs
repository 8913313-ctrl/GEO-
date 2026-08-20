// One-off fixture generator for direct-platform profiles. Run with node from
// the repo root; writes tests/fixtures/{id}-editor.html for every profile.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { directPlatformProfiles } from '../src/direct-platform-profiles.js';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

function titleAttrs(selector) {
  if (selector.includes('#')) {
    const id = selector.match(/#([\w-]+)/)[1];
    return `id="${id}"`;
  }
  if (selector.includes('.')) {
    const cls = selector.match(/\.([\w-]+)/)[1];
    return `class="${cls}"`;
  }
  const attr = selector.match(/\[([\w-]+)="([^"]+)"\]/);
  if (attr) return `${attr[1]}="${attr[2]}"`;
  return 'name="title"';
}

function titleHtml(selector, isShortPost) {
  const nested = selector.match(/^\.([\w-]+)\s+(input|textarea)$/);
  if (nested) {
    const tag = nested[2];
    return `<div class="${nested[1]}"><${tag} placeholder="${isShortPost ? '分享内容' : '输入标题'}"></${tag}></div>`;
  }
  const tag = isShortPost ? 'textarea' : 'input';
  const placeholder = isShortPost ? '分享内容' : '输入标题';
  return `<${tag} ${titleAttrs(selector)} placeholder="${placeholder}"></${tag}>`;
}

function bodyHtml(selector) {
  // Descendant form ".outer [contenteditable=true]" / "#outer [contenteditable=true]"
  if (/[.#][\w-]+\s+\[contenteditable="true"\]$/.test(selector)) {
    const outer = selector.replace(/\s*\[contenteditable="true"\]$/, '').trim();
    let tag = 'div';
    let attrs = '';
    if (outer.startsWith('#')) attrs = `id="${outer.slice(1)}"`;
    else if (outer.startsWith('.')) attrs = `class="${outer.slice(1)}"`;
    else if (/^[\w-]+$/.test(outer)) { tag = outer; }
    return `<${tag} ${attrs}><div contenteditable="true"></div></${tag}>`;
  }
  // Same-element form ".class[contenteditable=true]" / "#id[contenteditable=true]"
  const same = selector.match(/^([.#][\w-]+)\[contenteditable="true"\]$/);
  if (same) {
    const prefix = same[1];
    return prefix.startsWith('.')
      ? `<div class="${prefix.slice(1)}" contenteditable="true"></div>`
      : `<div id="${prefix.slice(1)}" contenteditable="true"></div>`;
  }
  if (selector.startsWith('.')) return `<div class="${selector.slice(1)}" contenteditable="true"></div>`;
  if (selector.startsWith('#')) return `<div id="${selector.slice(1)}" contenteditable="true"></div>`;
  return '<div contenteditable="true"></div>';
}

function buttonAttrs(selector) {
  if (selector.includes('#')) {
    const id = selector.match(/#([\w-]+)/)[1];
    return `id="${id}"`;
  }
  if (selector.includes('.')) {
    const cls = selector.match(/\.([\w-]+)/)[1];
    return `class="${cls}"`;
  }
  const attr = selector.match(/\[([\w-]+)="([^"]+)"\]/);
  if (attr) return `${attr[1]}="${attr[2]}"`;
  return 'data-action="publish"';
}

function buttonLabel(selector) {
  const hasText = selector.match(/:has-text\("([^"]+)"\)/);
  return hasText ? hasText[1] : '发布';
}

const names = {
  juejin: 'Juejin', csdn: 'CSDN', jianshu: 'Jianshu', bilibili: 'Bilibili', yuque: 'Yuque',
  cnblogs: 'Cnblogs', segmentfault: 'SegmentFault', oschina: 'Oschina', '51cto': '51CTO',
  woshipm: 'Woshipm', baijiahao: 'Baijiahao', xiaohongshu: 'Xiaohongshu', douyin: 'Douyin',
  douban: 'Douban', sohu: 'Sohu', dayu: 'Dayu', yidian: 'Yidian', imooc: 'Imooc',
  sohufocus: 'Sohufocus', eastmoney: 'Eastmoney', smzdm: 'Smzdm', netease: 'Netease',
  weibo: 'Weibo', xueqiu: 'Xueqiu',
};

let written = 0;
for (const [id, profile] of Object.entries(directPlatformProfiles)) {
  const isShortPost = Array.isArray(profile.postSelectors) && profile.postSelectors.length > 0;
  const title = titleHtml(isShortPost ? profile.postSelectors[0] : profile.titleSelectors[0], isShortPost);
  const body = isShortPost ? '' : `<section class="editor">${bodyHtml(profile.bodySelectors[0])}</section>`;
  const hasDraft = !isShortPost && (profile.draftSelectors?.length ?? 0) > 0;
  const draft = hasDraft
    ? `<button ${buttonAttrs(profile.draftSelectors[0])} type="button" onclick='document.body.dataset.saveState="saved";document.getElementById("draft-success").hidden=false;'>保存草稿</button>\n    <p id="draft-success" ${buttonAttrs(profile.draftSuccessSelectors[0])} hidden>草稿保存成功</p>`
    : '';
  const publish = `<button ${buttonAttrs(profile.publishSelectors[0])} type="button" onclick='document.body.dataset.publishState="published";document.getElementById("publish-success").hidden=false;'>${buttonLabel(profile.publishSelectors[0])}</button>\n    <p id="publish-success" ${buttonAttrs(profile.publishSuccessSelectors[0])} hidden>发布成功</p>`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${names[id] || id} Editor Fixture</title>
</head>
<body data-save-state="unsaved" data-publish-state="unpublished">
  <main>
    ${title}
    ${body}
    ${draft}
    ${publish}
  </main>
</body>
</html>
`;
  const target = path.join(outDir, `${id}-editor.html`);
  fs.writeFileSync(target, html, 'utf8');
  written += 1;
}
console.log(`Generated ${written} fixtures into ${outDir}`);
