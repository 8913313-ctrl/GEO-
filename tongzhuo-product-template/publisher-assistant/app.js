const $ = (selector) => document.querySelector(selector);
const assistantBasePath = new URL('.', document.baseURI).pathname.replace(/\/$/, '');
const state = { config: null, jobs: [], platforms: [], selectedPlatforms: [], busy: false };
const selectionStorageKey = 'tongzhuo-selected-platforms';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function toast(message, kind = 'info') {
  const element = $('#toast');
  element.textContent = message;
  element.dataset.kind = kind;
  element.classList.add('show');
  window.setTimeout(() => element.classList.remove('show'), 3600);
}

function assistantState(job) { return job.assistant?.state || '待处理'; }

function stateLabel(value) {
  return ({ processing: '处理中', awaiting_confirmation: '等待确认', draft_saved: '草稿已保存', published: '已发布', failed: '失败', cancelled: '已取消', '待处理': '待处理' }[value] || value);
}

function stateClass(value) {
  return ({ processing: 'amber', awaiting_confirmation: 'blue', draft_saved: 'green', published: 'green', failed: 'red', cancelled: 'gray' }[value] || 'gray');
}

function platformById(id) { return state.platforms.find((platform) => platform.id === id || platform.extensionId === id); }
function platformLabel(id) { return platformById(id)?.name || ({ weixin: '微信公众号' }[id] || id); }

function selectedPlatformIds() {
  return state.selectedPlatforms.filter((id) => platformById(id)?.mode !== 'export');
}

function savePlatformSelection() {
  window.localStorage.setItem(selectionStorageKey, JSON.stringify(selectedPlatformIds()));
  $('#selected-platform-count').textContent = `已选 ${selectedPlatformIds().length} 个平台`;
  $('#selected-platform-hint').textContent = selectedPlatformIds().length
    ? '执行任务时优先使用当前选择'
    : '未选择时按 GEOFlow 任务配置执行';
}

function setPlatformSelection(ids) {
  const known = new Set(state.platforms.map((platform) => platform.id));
  state.selectedPlatforms = [...new Set(ids)].filter((id) => known.has(id));
  savePlatformSelection();
  renderPlatformCatalog();
}

function renderPlatformCatalog() {
  const root = $('#platform-catalog');
  $('#platform-count').textContent = state.platforms.length;
  $('#platform-count-badge').textContent = `${state.platforms.length} 个平台`;
  if (!state.platforms.length) { root.innerHTML = '<div class="loading">暂未读取到平台目录。</div>'; return; }
  const selected = new Set(selectedPlatformIds());
  const groups = new Map();
  state.platforms.forEach((platform) => { if (!groups.has(platform.group)) groups.set(platform.group, []); groups.get(platform.group).push(platform); });
  root.innerHTML = [...groups.entries()].map(([group, platforms]) => {
    const publishable = platforms.filter((platform) => platform.mode !== 'export');
    const allSelected = publishable.length > 0 && publishable.every((platform) => selected.has(platform.id));
    return `<div class="platform-group"><div class="group-heading"><h4>${escapeHtml(group)}</h4><div class="group-tools"><span>${platforms.length}</span>${publishable.length ? `<button class="group-action" data-action="group-select" data-group="${escapeHtml(group)}">${allSelected ? '取消全选' : '全选'}</button>` : ''}</div></div><div class="platform-grid">${platforms.map((platform) => `<div class="platform-card ${platform.mode === 'export' ? 'export' : ''} ${selected.has(platform.id) ? 'selected' : ''}"><label class="platform-select"><input type="checkbox" data-platform-select="${escapeHtml(platform.id)}" ${selected.has(platform.id) ? 'checked' : ''} ${platform.mode === 'export' ? 'disabled' : ''}><span class="platform-name">${escapeHtml(platform.name)}</span><span class="platform-note">${escapeHtml(platform.note || (platform.mode === 'export' ? '不需要登录' : '选择发布平台'))}</span></label>${platform.mode === 'export' ? '' : `<button class="platform-login" data-platform-login="${escapeHtml(platform.id)}">打开登录页</button>`}</div>`).join('')}</div></div>`;
  }).join('');
}

function renderJobs() {
  const body = $('#jobs-body');
  $('#job-count').textContent = state.jobs.length;
  if (!state.jobs.length) { body.innerHTML = '<tr><td colspan="5" class="empty">当前没有待处理的 GEOFlow 分发任务。</td></tr>'; return; }
  body.innerHTML = state.jobs.map((job) => {
    const currentState = assistantState(job);
    const platforms = (job.platforms || []).map((platform) => escapeHtml(platformLabel(platform))).join(' · ');
    const action = currentState === 'awaiting_confirmation'
      ? `<button class="link-button green-text" data-action="complete" data-id="${job.id}" data-state="published">标记已发布</button><button class="link-button" data-action="complete" data-id="${job.id}" data-state="draft_saved">保留草稿</button>`
      : `<button class="button small primary" data-action="run" data-id="${job.id}">开始执行</button>`;
    return `<tr><td><div class="article-title">${escapeHtml(job.payload?.article?.title || '未命名文章')}</div><div class="article-meta">任务 #${job.id} · ${escapeHtml(job.payload?.article?.category?.name || '未分类')}</div></td><td>${escapeHtml(job.channel?.name || '-')}</td><td class="platforms">${platforms || '-'}</td><td><span class="status ${stateClass(currentState)}">${escapeHtml(stateLabel(currentState))}</span></td><td><div class="row-actions">${action}</div></td></tr>`;
  }).join('');
}

async function request(url, options = {}) {
  const response = await fetch(`${assistantBasePath}${url}`, { headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.message || `请求失败（${response.status}）`);
  return body;
}

async function loadConfig() {
  const body = await request('/api/config');
  state.config = body.config;
  $('#geoflow-base-url').value = state.config.publicBaseUrl || state.config.geoflowBaseUrl;
  $('#extension-dir').value = state.config.extensionDir || '';
  $('#publish-mode').value = state.config.publishMode === 'draft' ? 'draft' : 'publish';
  $('#api-token').placeholder = state.config.hasToken ? 'Token 已保存，留空表示不修改' : '粘贴后台生成的 Token';
  $('#worker-id').textContent = body.workerId;
  $('#worker-short').textContent = body.workerId.slice(-6);
  $('#footer-worker').textContent = body.workerId;
  $('#mode-status').textContent = state.config.publishMode === 'draft' ? '仅草稿' : '直接发布';
}

async function loadPlatforms() {
  state.platforms = (await request('/api/platforms')).platforms || [];
  try { state.selectedPlatforms = JSON.parse(window.localStorage.getItem(selectionStorageKey) || '[]'); } catch { state.selectedPlatforms = []; }
  savePlatformSelection();
  renderPlatformCatalog();
}

async function saveConfig(showMessage = true) {
  const tokenInput = $('#api-token').value.trim();
  const displayBaseUrl = $('#geoflow-base-url').value.trim();
  const body = await request('/api/config', { method: 'POST', body: JSON.stringify({ geoflowBaseUrl: state.config?.geoflowBaseUrl || displayBaseUrl, publicBaseUrl: displayBaseUrl, apiToken: tokenInput || undefined, extensionDir: $('#extension-dir').value.trim(), publishMode: $('#publish-mode').value }) });
  state.config = body.config;
  $('#api-token').value = '';
  $('#api-token').placeholder = state.config.hasToken ? 'Token 已保存，留空表示不修改' : '粘贴后台生成的 Token';
  $('#mode-status').textContent = state.config.publishMode === 'draft' ? '仅草稿' : '直接发布';
  if (showMessage) toast('桐灼发布设置已保存到本机', 'success');
}

function setConnection(connected, label) {
  $('#connection-pill').classList.toggle('connected', connected);
  $('#connection-text').textContent = label;
  $('#engine-status').textContent = connected ? '已连接' : '待连接';
}

async function connect() {
  try { await saveConfig(false); const body = await request('/api/connect', { method: 'POST', body: '{}' }); state.jobs = body.jobs || []; renderJobs(); setConnection(true, `已连接 · ${body.count} 个任务`); $('#connection-message').textContent = 'GEOFlow 已连接，任务会按本机发布模式执行。'; $('#queue-updated').textContent = `刚刚更新 · ${new Date().toLocaleTimeString()}`; toast('GEOFlow 连接成功', 'success'); }
  catch (error) { setConnection(false, '连接失败'); $('#connection-message').textContent = error.message; toast(error.message, 'error'); }
}

async function refresh() {
  try { const body = await request('/api/status'); state.jobs = body.jobs || []; renderJobs(); if (body.lastError) setConnection(false, '连接异常'); else if (state.config?.hasToken) setConnection(true, `已连接 · ${state.jobs.length} 个任务`); $('#queue-updated').textContent = `更新于 ${new Date().toLocaleTimeString()}`; }
  catch (error) { toast(error.message, 'error'); }
}

async function runJob(id) {
  if (state.busy) return;
  state.busy = true;
  toast(state.config?.publishMode === 'publish' ? '正在执行本地发布流程…' : '正在生成平台草稿…');
  const platforms = selectedPlatformIds();
  try { await request(`/api/jobs/${id}/run`, { method: 'POST', body: JSON.stringify({ platforms }) }); await refresh(); toast('任务执行完成，请查看各平台结果', 'success'); }
  catch (error) { toast(error.message, 'error'); }
  finally { state.busy = false; }
}

async function completeJob(id, nextState) {
  const message = nextState === 'published' ? '已由本地操作员确认发布' : '已由本地操作员确认保留草稿';
  try { await request(`/api/jobs/${id}/result`, { method: 'POST', body: JSON.stringify({ state: nextState, message }) }); await refresh(); toast(nextState === 'published' ? '任务已回写为已发布' : '任务已保留为草稿', 'success'); }
  catch (error) { toast(error.message, 'error'); }
}

async function checkExtension() {
  try { const body = await request('/api/browser/check', { method: 'POST', body: '{}' }); toast(body.message, body.available ? 'success' : 'error'); }
  catch (error) { toast(error.message, 'error'); }
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action?.dataset.action === 'run') runJob(action.dataset.id);
  if (action?.dataset.action === 'complete') completeJob(action.dataset.id, action.dataset.state);
  if (action?.dataset.action === 'select-all') { setPlatformSelection(state.platforms.filter((platform) => platform.mode !== 'export').map((platform) => platform.id)); return; }
  if (action?.dataset.action === 'clear-selection') { setPlatformSelection([]); return; }
  if (action?.dataset.action === 'group-select') {
    const groupPlatforms = state.platforms.filter((platform) => platform.group === action.dataset.group && platform.mode !== 'export');
    const selected = new Set(selectedPlatformIds());
    const shouldSelect = groupPlatforms.some((platform) => !selected.has(platform.id));
    groupPlatforms.forEach((platform) => shouldSelect ? selected.add(platform.id) : selected.delete(platform.id));
    setPlatformSelection([...selected]);
    return;
  }
  const loginButton = event.target.closest('[data-platform-login]');
  if (loginButton) openLoginPage(loginButton.dataset.platformLogin);
});

document.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-platform-select]');
  if (!checkbox) return;
  const selected = new Set(selectedPlatformIds());
  if (checkbox.checked) selected.add(checkbox.dataset.platformSelect); else selected.delete(checkbox.dataset.platformSelect);
  setPlatformSelection([...selected]);
});

async function openLoginPage(platformId) {
  try { await request(`/api/browser/login/${platformId}`, { method: 'POST', body: '{}' }); toast(`已打开${platformLabel(platformId)}登录页`, 'success'); }
  catch (error) { toast(error.message, 'error'); }
}

$('#login-selected-button').addEventListener('click', async () => {
  const platforms = selectedPlatformIds();
  if (!platforms.length) { toast('请先勾选需要登录的平台', 'info'); return; }
  const results = await Promise.allSettled(platforms.map((platform) => request(`/api/browser/login/${platform}`, { method: 'POST', body: '{}' })));
  const opened = results.filter((result) => result.status === 'fulfilled').length;
  toast(`已打开 ${opened} 个平台登录页`, opened === platforms.length ? 'success' : 'error');
});

$('#save-button').addEventListener('click', () => saveConfig().catch((error) => toast(error.message, 'error')));
$('#connect-button').addEventListener('click', connect);
$('#refresh-button').addEventListener('click', refresh);
$('#check-extension-button').addEventListener('click', checkExtension);
$('#publish-mode').addEventListener('change', () => { $('#mode-status').textContent = $('#publish-mode').value === 'draft' ? '仅草稿' : '直接发布'; });

Promise.all([loadConfig(), loadPlatforms()]).then(refresh).catch((error) => toast(error.message, 'error'));
window.setInterval(refresh, 10000);
