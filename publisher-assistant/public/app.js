const $ = (selector) => document.querySelector(selector);
const assistantBasePath = new URL('.', document.baseURI).pathname.replace(/\/$/, '');
const state = { config: null, jobs: [], platforms: [], accounts: [], selectedPlatforms: [], busy: false, authPollTimer: null };
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
function isAssistantPublishable(platform) { return Boolean(platform?.enabled && platform.support === 'ready' && platform.adapter); }
function platformLabel(id) { return platformById(id)?.name || ({ weixin: '微信公众号' }[id] || id); }
function accountsForPlatform(platformId) { return state.accounts.filter((account) => account.platformId === platformId); }
function primaryAccountForPlatform(platformId) { return accountsForPlatform(platformId).find((account) => account.state === 'ready') || accountsForPlatform(platformId)[0] || null; }
function accountStateLabel(value) { return ({ new: '未登录', ready: '已授权', attention: '需要处理', disabled: '已停用' }[value] || value); }
function accountStateClass(value) { return ({ ready: 'ready', attention: 'attention', disabled: 'disabled', new: 'new' }[value] || 'new'); }

function selectedPlatformIds() {
  return state.selectedPlatforms.filter((id) => isAssistantPublishable(platformById(id)));
}

function savePlatformSelection() {
  window.localStorage.setItem(selectionStorageKey, JSON.stringify(selectedPlatformIds()));
  $('#selected-platform-count').textContent = `已选 ${selectedPlatformIds().length} 个平台`;
  $('#selected-platform-hint').textContent = selectedPlatformIds().length
    ? '执行任务时优先使用当前选择'
    : '未选择时按 GEOFlow 任务配置执行';
}

function setPlatformSelection(ids) {
  state.selectedPlatforms = [...new Set(ids)].filter((id) => isAssistantPublishable(platformById(id)));
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
    const publishable = platforms.filter(isAssistantPublishable);
    const allSelected = publishable.length > 0 && publishable.every((platform) => selected.has(platform.id));
    return `<div class="platform-group"><div class="group-heading"><h4>${escapeHtml(group)}</h4><div class="group-tools"><span>${platforms.length}</span>${publishable.length ? `<button class="group-action" data-action="group-select" data-group="${escapeHtml(group)}">${allSelected ? '取消全选' : '全选'}</button>` : ''}</div></div><div class="platform-grid">${platforms.map((platform) => {
      const account = primaryAccountForPlatform(platform.id);
      const publishable = isAssistantPublishable(platform);
      const note = platform.mode === 'export' ? '不需要登录' : publishable ? (account ? `${account.label} · ${accountStateLabel(account.state)}` : '未配置本地账号') : '待接入本地发布器，暂不可发布';
      const action = publishable ? `<button class="platform-login" data-platform-login="${escapeHtml(platform.id)}" data-account-id="${escapeHtml(account?.id || '')}">${account ? '打开账号登录' : '创建账号并登录'}</button>` : '';
      return `<div class="platform-card ${platform.mode === 'export' ? 'export' : ''} ${publishable ? '' : 'planned'} ${selected.has(platform.id) ? 'selected' : ''}"><label class="platform-select"><input type="checkbox" data-platform-select="${escapeHtml(platform.id)}" ${selected.has(platform.id) ? 'checked' : ''} ${publishable ? '' : 'disabled'}><span class="platform-name">${escapeHtml(platform.name)}</span><span class="platform-note">${escapeHtml(platform.note || note)}</span></label>${action}</div>`;
    }).join('')}</div></div>`;
  }).join('');
}

function renderAccountOptions() {
  const select = $('#account-platform-select');
  const value = select.value;
  select.innerHTML = '<option value="">选择平台</option>' + state.platforms
    .filter(isAssistantPublishable)
    .map((platform) => `<option value="${escapeHtml(platform.id)}">${escapeHtml(platform.name)}</option>`).join('');
  select.value = state.platforms.some((platform) => platform.id === value) ? value : '';
}

function renderAccounts() {
  const root = $('#account-list');
  $('#account-count-badge').textContent = `${state.accounts.length} 个账号`;
  if (!state.accounts.length) {
    root.innerHTML = '<div class="empty">还没有本地账号。选择平台后创建账号，并在下方本机浏览器中完成登录。</div>';
    return;
  }
  root.innerHTML = state.accounts.map((account) => `<article class="account-card">
    <div class="account-card-main"><strong>${escapeHtml(account.label)}</strong><span>${escapeHtml(platformLabel(account.platformId))}</span><small>${account.lastAuthorizedAt ? `最近授权：${new Date(account.lastAuthorizedAt).toLocaleString('zh-CN')}` : '尚未完成登录'}</small></div>
    <span class="account-state ${accountStateClass(account.state)}">${escapeHtml(accountStateLabel(account.state))}</span>
    <div class="account-actions"><button class="link-button" data-account-login="${escapeHtml(account.id)}">打开登录</button>${account.state !== 'disabled' ? `<button class="link-button" data-account-disable="${escapeHtml(account.id)}">停用</button>` : `<button class="link-button green-text" data-account-enable="${escapeHtml(account.id)}">启用</button>`}</div>
  </article>`).join('');
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
  $('#runtime-mode').textContent = '本机浏览器执行';
  const runtimeNotice = $('#runtime-notice');
  runtimeNotice.hidden = false;
  runtimeNotice.innerHTML = state.config.autoRun
    ? '<strong>本地自动发布已开启：</strong>平台账号登录、验证码操作和文章发布都在当前电脑的浏览器中完成。登录态保存在本机，文章进入 GEOFlow 队列后会自动执行。'
    : '<strong>本地发布器在线：</strong>当前自动执行尚未开启，可在本机设置中开启。平台登录和验证仍在当前电脑的浏览器中完成。';
}

async function loadPlatforms() {
  state.platforms = (await request('/api/platforms')).platforms || [];
  try { state.selectedPlatforms = JSON.parse(window.localStorage.getItem(selectionStorageKey) || '[]'); } catch { state.selectedPlatforms = []; }
  savePlatformSelection();
  renderAccountOptions();
  renderPlatformCatalog();
}

async function loadAccounts() {
  state.accounts = (await request('/api/accounts')).accounts || [];
  renderAccounts();
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
  if (showMessage) toast('桐灼发布器设置已保存到本机', 'success');
}

function setConnection(connected, label) {
  $('#connection-pill').classList.toggle('connected', connected);
  $('#connection-text').textContent = label;
  $('#engine-status').textContent = connected ? '已连接' : '待连接';
}

async function connect() {
  try { await saveConfig(false); const body = await request('/api/connect', { method: 'POST', body: '{}' }); state.jobs = body.jobs || []; renderJobs(); setConnection(true, `已连接 · ${body.count} 个任务`); $('#connection-message').textContent = 'GEOFlow 已连接，任务会由本地发布器执行。'; $('#queue-updated').textContent = `刚刚更新 · ${new Date().toLocaleTimeString()}`; toast('GEOFlow 连接成功', 'success'); }
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
  const message = nextState === 'published' ? '已由后台操作员确认发布' : '已由后台操作员确认保留草稿';
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
  if (action?.dataset.action === 'select-all') { setPlatformSelection(state.platforms.filter(isAssistantPublishable).map((platform) => platform.id)); return; }
  if (action?.dataset.action === 'clear-selection') { setPlatformSelection([]); return; }
  if (action?.dataset.action === 'group-select') {
    const groupPlatforms = state.platforms.filter((platform) => platform.group === action.dataset.group && isAssistantPublishable(platform));
    const selected = new Set(selectedPlatformIds());
    const shouldSelect = groupPlatforms.some((platform) => !selected.has(platform.id));
    groupPlatforms.forEach((platform) => shouldSelect ? selected.add(platform.id) : selected.delete(platform.id));
    setPlatformSelection([...selected]);
    return;
  }
  const loginButton = event.target.closest('[data-platform-login]');
  if (loginButton) openLoginPage(loginButton.dataset.platformLogin, loginButton.dataset.accountId);
  const accountLogin = event.target.closest('[data-account-login]');
  if (accountLogin) {
    const account = state.accounts.find((item) => item.id === accountLogin.dataset.accountLogin);
    if (account) openLoginPage(account.platformId, account.id);
  }
  const accountDisable = event.target.closest('[data-account-disable]');
  if (accountDisable) updateAccountState(accountDisable.dataset.accountDisable, 'disabled');
  const accountEnable = event.target.closest('[data-account-enable]');
  if (accountEnable) updateAccountState(accountEnable.dataset.accountEnable, 'attention');
});

document.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-platform-select]');
  if (!checkbox) return;
  const selected = new Set(selectedPlatformIds());
  if (checkbox.checked) selected.add(checkbox.dataset.platformSelect); else selected.delete(checkbox.dataset.platformSelect);
  setPlatformSelection([...selected]);
});

async function openLoginPage(platformId, accountId = '') {
  try {
    const body = await request(`/api/browser/login/${platformId}`, { method: 'POST', body: JSON.stringify({ accountId }) });
    renderAuthSnapshot(body.result);
    startAuthPolling();
    await loadAccounts();
    toast(body.message || `已在本机浏览器打开${platformLabel(platformId)}授权窗口`, 'success');
  }
  catch (error) { toast(error.message, 'error'); }
}

function renderAuthSnapshot(snapshot) {
  const panel = $('#browser-auth-panel');
  if (!snapshot?.active) {
    panel.hidden = true;
    $('#browser-desktop').src = '';
    $('#browser-screen').src = '';
    return;
  }
  panel.hidden = false;
  const desktop = $('#browser-desktop');
  const image = $('#browser-screen');
  if (snapshot.desktopUrl) {
    const desktopUrl = new URL(snapshot.desktopUrl, document.baseURI).href;
    if (desktop.src !== desktopUrl) desktop.src = desktopUrl;
    desktop.hidden = false;
    image.hidden = true;
  } else {
    image.src = snapshot.image || '';
    image.hidden = false;
    desktop.hidden = true;
  }
  $('#auth-platform-name').textContent = snapshot.account?.label ? `${platformLabel(snapshot.platform)} · ${snapshot.account.label}` : platformLabel(snapshot.platform);
  $('#auth-page-title').textContent = snapshot.title || '平台授权页面';
  $('#auth-page-url').textContent = snapshot.url || '-';
}

function startAuthPolling() {
  if (state.authPollTimer) return;
  state.authPollTimer = window.setInterval(async () => {
    try { renderAuthSnapshot((await request('/api/browser/session')).result); }
    catch { stopAuthPolling(); }
  }, 1600);
}

function stopAuthPolling() {
  if (state.authPollTimer) window.clearInterval(state.authPollTimer);
  state.authPollTimer = null;
}

async function authAction(type, extra = {}) {
  try { renderAuthSnapshot((await request('/api/browser/session/action', { method: 'POST', body: JSON.stringify({ type, ...extra }) })).result); }
  catch (error) { toast(error.message, 'error'); }
}

async function createAccount(platformId, label = '', openLogin = true) {
  const body = await request('/api/accounts', { method: 'POST', body: JSON.stringify({ platformId, label }) });
  await loadAccounts();
  if (openLogin) await openLoginPage(platformId, body.account.id);
  return body.account;
}

async function updateAccountState(accountId, stateValue) {
  try {
    await request(`/api/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify({ state: stateValue }) });
    await loadAccounts();
    toast(stateValue === 'disabled' ? '账号已停用，不会再自动执行任务' : '账号已启用，请重新完成登录后发布', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

$('#account-create-button').addEventListener('click', async () => {
  const platformId = $('#account-platform-select').value;
  if (!platformId) { toast('请先选择要登录的平台', 'info'); return; }
  const button = $('#account-create-button');
  button.disabled = true;
  try {
    await createAccount(platformId, $('#account-label-input').value.trim());
    $('#account-label-input').value = '';
    toast('本地账号已创建，请在下方浏览器完成登录', 'success');
  } catch (error) { toast(error.message, 'error'); }
  finally { button.disabled = false; }
});

$('#create-selected-accounts-button').addEventListener('click', async () => {
  const platforms = selectedPlatformIds().filter((platformId) => !primaryAccountForPlatform(platformId));
  if (!platforms.length) { toast('所选平台都已有账号，可直接在账号中心打开登录', 'info'); return; }
  try {
    for (const platformId of platforms) await createAccount(platformId, '', false);
    const first = primaryAccountForPlatform(platforms[0]);
    if (first) await openLoginPage(first.platformId, first.id);
    toast(`已创建 ${platforms.length} 个本地账号，请逐个完成登录`, 'success');
  } catch (error) { toast(error.message, 'error'); }
});

$('#save-button').addEventListener('click', () => saveConfig().catch((error) => toast(error.message, 'error')));
$('#connect-button').addEventListener('click', connect);
$('#refresh-button').addEventListener('click', refresh);
$('#check-extension-button').addEventListener('click', checkExtension);
$('#publish-mode').addEventListener('change', () => { $('#mode-status').textContent = $('#publish-mode').value === 'draft' ? '仅草稿' : '直接发布'; });
let authPointerStart = null;

function authScreenPoint(event) {
  const image = event.currentTarget;
  const rect = image.getBoundingClientRect();
  const viewportWidth = 1440;
  const viewportHeight = 900;
  return {
    x: Math.max(0, Math.min(viewportWidth, (event.clientX - rect.left) * viewportWidth / rect.width)),
    y: Math.max(0, Math.min(viewportHeight, (event.clientY - rect.top) * viewportHeight / rect.height)),
  };
}

$('#browser-screen').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  authPointerStart = authScreenPoint(event);
});

$('#browser-screen').addEventListener('pointerup', (event) => {
  event.preventDefault();
  if (!authPointerStart) return;
  const end = authScreenPoint(event);
  const distance = Math.hypot(end.x - authPointerStart.x, end.y - authPointerStart.y);
  if (distance > 8) {
    authAction('drag', { fromX: authPointerStart.x, fromY: authPointerStart.y, toX: end.x, toY: end.y });
  } else {
    authAction('click', end);
  }
  authPointerStart = null;
});

$('#browser-screen').addEventListener('pointercancel', () => { authPointerStart = null; });
$('#auth-type-button').addEventListener('click', () => {
  const input = $('#auth-text-input');
  if (!input.value) { toast('请先输入文字', 'info'); return; }
  authAction('type', { text: input.value });
  input.value = '';
});
$('#auth-enter-button').addEventListener('click', () => authAction('press', { key: 'Enter' }));
$('#auth-scroll-button').addEventListener('click', () => authAction('scroll', { deltaY: 620 }));
$('#auth-reload-button').addEventListener('click', () => authAction('reload'));
$('#close-auth-button').addEventListener('click', async () => {
  stopAuthPolling();
  await request('/api/browser/session/close', { method: 'POST', body: '{}' }).catch(() => {});
  renderAuthSnapshot({ active: false });
});
$('#auth-finish-button').addEventListener('click', () => {
  request('/api/browser/session/complete', { method: 'POST', body: '{}' })
    .then(async () => { await loadAccounts(); toast('本机登录态已保存，后续任务可以自动执行', 'success'); stopAuthPolling(); })
    .catch((error) => toast(error.message, 'error'));
});

Promise.all([loadConfig(), loadPlatforms(), loadAccounts()]).then(refresh).catch((error) => toast(error.message, 'error'));
window.setInterval(refresh, 10000);
