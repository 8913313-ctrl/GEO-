#!/usr/bin/env node
// ui-audit.mjs -- UI 回归护栏：采集 + 基线对比 + 死按钮扫描
// 依赖：webbridge daemon（127.0.0.1:10086）、平台服务已启动（127.0.0.1:44127）且浏览器已登录
//
// 用法：
//   node tools/ui-audit.mjs            # 采集当前状态并与基线对比（改动后自查）
//   node tools/ui-audit.mjs --snapshot # 生成/刷新基线（确认改动正确后执行）
//   node tools/ui-audit.mjs --check    # 只对比不写基线（CI 模式，差异即退出码 1）
//
// 基线文件：tools/ui-baseline.json（入库，随代码一起演进）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'ui-baseline.json');
const DAEMON = 'http://127.0.0.1:10086/command';
const SESSION = 'ui-audit-guard';
const ROUTES = ['dashboard', 'planning', 'content', 'publish', 'assets', 'monitoring', 'effect-search', 'effect-diagnostic', 'effect-monitor', 'site', 'knowledge', 'assistant', 'settings'];

const mode = process.argv[2] || '--check';

async function wb(action, args) {
  const res = await fetch(DAEMON, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args, session: SESSION })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`webbridge ${action} 失败: ${JSON.stringify(json.error).slice(0, 150)}`);
  return json.data;
}

const COLLECT = `(async () => {
  const routes = ${JSON.stringify(ROUTES)};
  window.__auditErrors = [];
  if (!window.__auditHooked) {
    window.__auditHooked = true;
    window.addEventListener('error', e => window.__auditErrors.push('JS: ' + (e.message||'').slice(0,120)));
    window.addEventListener('unhandledrejection', e => window.__auditErrors.push('REJ: ' + String(e.reason?.message || e.reason).slice(0,120)));
  }
  const out = {};
  for (const r of routes) {
    location.hash = '#' + r;
    await new Promise(res => setTimeout(res, 450));
    const view = document.getElementById('view');
    const btns = [];
    document.querySelectorAll('#view button, #view [data-action], #view [data-nav]').forEach(el => {
      if (!el.offsetParent) return;
      btns.push(el.getAttribute('data-action') || el.getAttribute('data-nav') || null);
    });
    const overflow = [];
    document.querySelectorAll('#view *').forEach(el => {
      if (!el.offsetParent) return;
      const rc = el.getBoundingClientRect();
      if (rc.width > 2 && (rc.right > innerWidth + 8)) overflow.push(1);
    });
    out[r] = {
      viewLen: view ? view.innerHTML.length : 0,
      docH: document.documentElement.scrollHeight,
      btnCount: btns.length,
      actions: [...new Set(btns.filter(Boolean))].sort(),
      overflowCount: overflow.length,
      errors: window.__auditErrors.splice(0, 50)
    };
  }
  return JSON.stringify(out);
})()`;

async function collect() {
  await wb('navigate', { url: 'http://127.0.0.1:44127/', newTab: true });
  await new Promise(r => setTimeout(r, 2000));
  const raw = await wb('evaluate', { code: COLLECT });
  await wb('close_session', {}).catch(() => {});
  return JSON.parse(raw.value);
}

// 死按钮静态扫描（不需要浏览器）：渲染的 data-action/data-nav vs 处理分支
function deadActionScan() {
  const MOD_DIR = path.join(ROOT, 'public/js/modules');
  const files = fs.readdirSync(MOD_DIR).filter(f => f.endsWith('.js'));
  const registered = new Set();
  const navTargets = new Set();
  const rendered = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(MOD_DIR, f), 'utf8');
    for (const m of src.matchAll(/action\s*===?\s*"([a-z0-9-]+)"/g)) registered.add(m[1]);
    for (const m of src.matchAll(/data-action="([a-z0-9-]+)"/g)) rendered.add(m[1]);
    for (const m of src.matchAll(/navigate\("([a-z-]+)"/g)) navTargets.add(m[1]);
    // 参数化 data-action（动态值）记为 unknown，跳过
    for (const m of src.matchAll(/data-action="\$\{[^}]+\}"/g)) rendered.add('__dynamic__');
  }
  // index.html 里的 shell 按钮
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  for (const m of html.matchAll(/data-action="([a-z0-9-]+)"/g)) rendered.add(m[1]);
  for (const m of html.matchAll(/data-nav="([a-z0-9-]+)"/g)) rendered.add('nav:' + m[1]);
  for (const m of html.matchAll(/data-nav="([a-z0-9-]+)"/g)) navTargets.add(m[1]);
  // JS 里 data-nav 的目标
  for (const f of files) {
    const src = fs.readFileSync(path.join(MOD_DIR, f), 'utf8');
    for (const m of src.matchAll(/data-nav="([a-z0-9-]+)"/g)) rendered.add('nav:' + m[1]);
  }
  const dead = [...rendered].filter(a => {
    if (a === '__dynamic__') return false;
    if (a.startsWith('nav:')) return false; // data-nav 由统一委托处理
    return !registered.has(a);
  });
  return { dead, registeredCount: registered.size, renderedCount: rendered.size };
}

async function main() {
  let exitCode = 0;
  // 1. 死按钮扫描（始终跑）
  const scan = deadActionScan();
  console.log('== 死按钮扫描 ==');
  if (scan.dead.length) {
    console.log('  !! 渲染了但无处理分支（点击无反应）:', scan.dead.join(', '));
    exitCode = 1;
  } else {
    console.log('  OK：全部 data-action 均有处理分支');
  }

  // 2. 浏览器采集与基线对比
  let current;
  try {
    current = await collect();
  } catch (e) {
    console.log('\n== 浏览器采集 ==');
    console.log('  跳过（daemon/服务不可用）:', e.message.slice(0, 100));
    process.exit(exitCode);
  }
  console.log('\n== 运行时采集 ==');
  const errs = Object.entries(current).flatMap(([r, d]) => d.errors.map(e => r + ': ' + e));
  if (errs.length) { console.log('  !! JS 错误:', errs.slice(0, 5).join('\n     ')); exitCode = 1; }
  else console.log('  OK：13 路由零 JS 错误');

  const overflows = Object.entries(current).filter(([, d]) => d.overflowCount > 0).map(([r, d]) => `${r}(${d.overflowCount})`);
  if (overflows.length) { console.log('  !! 横向溢出:', overflows.join(', ')); exitCode = 1; }
  else console.log('  OK：无横向溢出');

  if (mode === '--snapshot') {
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 1));
    console.log(`\n基线已写入 ${path.relative(ROOT, BASELINE)}（${new Date().toISOString()}）`);
    process.exit(0);
  }

  // 3. 基线对比
  if (!fs.existsSync(BASELINE)) {
    console.log('\n== 基线对比 ==');
    console.log('  基线不存在，先跑 --snapshot 生成');
    process.exit(exitCode);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  console.log('\n== 基线对比（actions 集合 / 按钮数 / 渲染长度）==');
  let diffCount = 0;
  for (const r of ROUTES) {
    const b = base[r], c = current[r];
    if (!b) { console.log(`  ?? ${r}: 基线缺失`); continue; }
    const lost = b.actions.filter(a => !c.actions.includes(a));
    const gained = c.actions.filter(a => !b.actions.includes(a));
    const btnDelta = c.btnCount - b.btnCount;
    const lenDeltaPct = b.viewLen ? Math.round((c.viewLen - b.viewLen) / b.viewLen * 100) : 0;
    const problems = [];
    if (lost.length) problems.push(`丢失按钮: ${lost.join(',')}`);
    if (btnDelta < 0 && lost.length === 0 && Math.abs(lenDeltaPct) < 50) problems.push(`按钮数 ${b.btnCount}->${c.btnCount}`);
    if (Math.abs(lenDeltaPct) > 30) problems.push(`渲染量 ${lenDeltaPct > 0 ? '+' : ''}${lenDeltaPct}%`);
    if (problems.length) { console.log(`  !! ${r}: ${problems.join('；')}`); diffCount++; }
  }
  if (!diffCount) console.log('  OK：与基线一致（新增按钮属预期改动，不算差异）');
  process.exit(diffCount ? 1 : exitCode);
}

main().catch(e => { console.error('护栏执行失败:', e.message); process.exit(2); });
