const $ = (selector) => document.querySelector(selector);

const elements = {
  notice: $('#notice'),
  checkList: $('#checkList'),
  diagnosticsList: $('#diagnosticsList'),
  accountRows: $('#accountRows'),
  accountSummary: $('#accountSummary'),
  windowList: $('#windowList'),
  summaryPill: $('#summaryPill'),
  blankPill: $('#blankPill'),
  lastUpdated: $('#lastUpdated'),
  refreshButton: $('#refreshButton'),
  probeButton: $('#probeButton'),
  probeResult: $('#probeResult'),
  platformSelect: $('#platformSelect'),
  openLoginButton: $('#openLoginButton'),
  loginResult: $('#loginResult'),
};

const state = { status: null, platforms: [], windows: [] };

function text(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function escapeHtml(value) {
  return text(value, '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : String(value);
}

function localApiHeaders() {
  return window.tongzhuoAgent?.requestHeaders?.() || {};
}

function request(url, options = {}) {
  return fetch(url, { cache: 'no-store', headers: { Accept: 'application/json', ...localApiHeaders(), ...(options.headers || {}) }, ...options })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.message || `请求失败：HTTP ${response.status}`);
      return payload;
    });
}

function stateClass(value) {
  if (value === 'ok' || value === 'synced' || value === 'ready') return 'ok';
  if (value === 'error' || value === 'needs_login' || value === 'needs_verification' || value === 'needs_captcha') return 'error';
  return 'warn';
}

function statusLabel(value) {
  const labels = {
    ready: '已登录', open: '已打开', needs_login: '待登录', needs_verification: '需要验证', needs_captcha: '需要验证码',
    unknown: '未知', disabled: '已禁用', error: '异常', synced: '后台已同步', pending: '后台待同步',
    waiting_for_pairing: '等待后台绑定', '': '未同步', ok: '通过', warn: '注意', error: '失败',
  };
  return labels[value] || text(value);
}

function setPill(element, label, kind = '') {
  element.textContent = label;
  element.className = `pill${kind ? ` ${kind}` : ''}`;
}

function setCard(id, value, hint, kind = '') {
  const card = $(id);
  card.querySelector('strong').textContent = value;
  card.querySelector('small').textContent = hint;
  card.className = `summary-card${kind ? ` ${kind}` : ''}`;
}

function setNotice(message = '', kind = '') {
  if (!message) { elements.notice.hidden = true; return; }
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ''}`;
  elements.notice.hidden = false;
}

function renderChecks(health, status, windows) {
  const healthy = Boolean(health?.ok);
  const version = text(status.agentVersion);
  const versionAvailable = Boolean(version && version !== '-');
  const hasBlank = windows.some((item) => String(item.url || '') === 'about:blank');
  const rows = [
    { label: '本地服务', state: healthy ? 'ok' : 'error', message: healthy ? `127.0.0.1:${status.port || 19380} 正常响应` : '本地服务未返回健康状态' },
    { label: '\u8FD0\u884C\u7248\u672C', state: versionAvailable ? 'ok' : 'error', message: versionAvailable ? `\u672C\u5730\u670D\u52A1\u8FD4\u56DE v${version}` : '\u672C\u5730\u670D\u52A1\u672A\u8FD4\u56DE\u7248\u672C' },
    { label: '设备绑定', state: status.isPaired ? 'ok' : 'warn', message: status.isPaired ? '设备已绑定 GEO 后台' : '设备尚未绑定；本地登录检测仍可使用，但后台同步会等待重新绑定' },
    { label: '受管窗口', state: hasBlank ? 'error' : 'ok', message: hasBlank ? '发现受管窗口 URL 为 about:blank' : `已检查 ${windows.length} 个受管窗口，未发现 about:blank` },
  ];
  elements.checkList.innerHTML = rows.map((item) => `<article class="check-row"><span class="state ${stateClass(item.state)}">${statusLabel(item.state)}</span><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.message)}</p></article>`).join('');
  const errors = rows.filter((item) => item.state === 'error').length;
  const warns = rows.filter((item) => item.state === 'warn').length;
  setPill(elements.summaryPill, errors ? `${errors} 项失败` : warns ? `${warns} 项注意` : '全部通过', errors ? 'error' : warns ? 'warn' : 'ok');
}

function renderDiagnostics(diagnostics) {
  const checks = Array.isArray(diagnostics?.checks) ? diagnostics.checks : [];
  elements.diagnosticsList.innerHTML = checks.length
    ? checks.map((item) => `<article class="diagnostic-row"><span class="state ${stateClass(item.state)}">${statusLabel(item.state)}</span><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.message)}</p></article>`).join('')
    : '<div class="empty">未返回本地诊断结果。</div>';
}

function renderWindows(windows) {
  const hasBlank = windows.some((item) => String(item.url || '') === 'about:blank');
  setPill(elements.blankPill, hasBlank ? '发现 about:blank' : `正常 · ${windows.length} 个窗口`, hasBlank ? 'error' : 'ok');
  elements.windowList.innerHTML = windows.length
    ? windows.map((item) => `<article class="window-row"><span class="state ${String(item.url || '') === 'about:blank' ? 'error' : 'ok'}">${String(item.url || '') === 'about:blank' ? '异常' : '正常'}</span><strong>${escapeHtml(item.platformId || '平台窗口')}</strong><p>${escapeHtml(item.url || '-')}</p></article>`).join('')
    : '<div class="empty">当前没有受管平台窗口。默认检查没有新开浏览器页面。</div>';
}

function accountItems() {
  const groups = Array.isArray(state.status?.accountGroups) ? state.status.accountGroups : [];
  return groups.flatMap((group) => Object.entries(group.accounts || {}).map(([platformId, account]) => ({ group, platformId, account: account || {} })));
}

function platformName(platformId) {
  return state.platforms.find((platform) => platform.id === platformId)?.name || platformId;
}

function renderAccounts() {
  const items = accountItems();
  elements.accountSummary.textContent = items.length ? `${items.length} 个已绑定平台账号` : '当前没有已绑定平台账号';
  elements.accountRows.innerHTML = items.length ? items.map(({ group, platformId, account }) => {
    const local = text(account.status, 'unknown');
    const sync = text(account.syncState, '');
    const timestamp = account.lastSyncedAt || account.lastVerifiedAt;
    return `<tr><td>${escapeHtml(group.name || group.id)}</td><td>${escapeHtml(platformName(platformId))}</td><td><span class="state ${stateClass(local)}">${escapeHtml(statusLabel(local))}</span></td><td><span class="state ${stateClass(sync)}">${escapeHtml(statusLabel(sync))}</span></td><td>${escapeHtml(formatTime(timestamp))}</td><td class="message">${escapeHtml(account.lastSyncError || account.lastErrorMessage || '-')}</td></tr>`;
  }).join('') : '<tr><td class="empty" colspan="6">请先在工作台的“平台账号”中添加平台，再进行登录联调。</td></tr>';
}

function renderLoginChoices() {
  const items = accountItems();
  elements.platformSelect.innerHTML = items.length
    ? `<option value="">请选择平台</option>${items.map(({ group, platformId }) => `<option value="${escapeHtml(`${group.id}::${platformId}`)}">${escapeHtml(group.name || group.id)} · ${escapeHtml(platformName(platformId))}</option>`).join('')}`
    : '<option value="">没有已绑定的平台账号</option>';
  elements.platformSelect.disabled = !items.length;
  elements.openLoginButton.disabled = !items.length;
  if (!items.length) elements.loginResult.textContent = '需要先在工作台添加平台账号。';
}

function renderSummary(health, status, windows) {
  const hasBlank = windows.some((item) => String(item.url || '') === 'about:blank');
  const versionAvailable = Boolean(text(status.agentVersion, '') && text(status.agentVersion, '') !== '-');
  setCard('#serviceCard', health?.ok ? '正常' : '失败', `127.0.0.1:${status.port || 19380}`, health?.ok ? 'ok' : 'error');
  setCard('#versionCard', versionAvailable ? `v${text(status.agentVersion)}` : '-', versionAvailable ? '\u5DF2\u4ECE\u672C\u5730\u670D\u52A1\u8BFB\u53D6\u7248\u672C' : '\u672C\u5730\u670D\u52A1\u672A\u8FD4\u56DE\u7248\u672C', versionAvailable ? 'ok' : 'error');
  setCard('#pairingCard', status.isPaired ? '已绑定' : '未绑定', status.hasCredential ? '具有后台凭证' : '暂无后台凭证', status.isPaired ? 'ok' : 'warn');
  setCard('#windowCard', String(windows.length), hasBlank ? '发现 about:blank' : '未发现 about:blank', hasBlank ? 'error' : 'ok');
}

async function refresh() {
  elements.refreshButton.disabled = true;
  setNotice('正在读取本机状态…');
  try {
    const [health, statusPayload, diagnosticsPayload, windowPayload] = await Promise.all([
      request('/healthz'), request('/api/status'), request('/api/diagnostics?probe=0'), request('/api/browser/windows'),
    ]);
    state.status = statusPayload.status || {};
    state.platforms = Array.isArray(statusPayload.platforms) ? statusPayload.platforms : [];
    state.windows = Array.isArray(windowPayload.browser?.windows) ? windowPayload.browser.windows : [];
    renderSummary(health, state.status, state.windows);
    renderChecks(health, state.status, state.windows);
    renderDiagnostics(diagnosticsPayload.diagnostics);
    renderWindows(state.windows);
    renderAccounts();
    renderLoginChoices();
    elements.lastUpdated.textContent = `最后读取：${new Date().toLocaleString('zh-CN', { hour12: false })}。默认检查未请求 GEO 后台。`;
    setNotice('本机只读检查已完成。');
  } catch (error) {
    setNotice(error.message || '读取本机状态失败。', 'error');
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function probeBackend() {
  elements.probeButton.disabled = true;
  elements.probeResult.className = 'action-result';
  elements.probeResult.textContent = '正在请求 GEO 后台，最长约 4 秒…';
  try {
    const payload = await request('/api/diagnostics?probe=1');
    const probe = payload.diagnostics?.checks?.find((item) => item.id === 'geoflow_probe');
    const kind = stateClass(probe?.state || 'warn');
    elements.probeResult.className = `action-result ${kind}`;
    elements.probeResult.textContent = probe?.message || '未返回后台连通性结果。';
  } catch (error) {
    elements.probeResult.className = 'action-result error';
    elements.probeResult.textContent = error.message || '后台连通性探测失败。';
  } finally {
    elements.probeButton.disabled = false;
  }
}

async function openLoginAndVerify() {
  const [groupId, platformId] = String(elements.platformSelect.value || '').split('::');
  if (!groupId || !platformId) { elements.loginResult.textContent = '请先选择已绑定的平台账号。'; return; }
  const account = accountItems().find((item) => item.group.id === groupId && item.platformId === platformId)?.account || {};
  if (!window.confirm(`将打开 ${platformName(platformId)} 的真实登录页，并写入本地窗口/登录状态。是否继续？`)) return;
  elements.openLoginButton.disabled = true;
  elements.loginResult.className = 'action-result';
  elements.loginResult.textContent = '正在打开登录页…';
  try {
    const before = await request('/api/browser/windows');
    const opened = await request(`/api/platforms/${encodeURIComponent(platformId)}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, accountName: account.accountName || '' }),
    });
    const after = await request('/api/browser/windows');
    const windows = Array.isArray(after.browser?.windows) ? after.browser.windows : [];
    const windowId = opened.result?.windowId;
    const current = windows.find((item) => item.id === windowId);
    const isBlank = String(current?.url || opened.result?.url || '') === 'about:blank';
    const delta = windows.length - (Array.isArray(before.browser?.windows) ? before.browser.windows.length : 0);
    const nativeLogin = opened.result?.driver === 'native';
    const driverMatches = Boolean(opened.result?.driver && current?.driver === opened.result.driver);
    const windowValid = Boolean(windowId && current && !isBlank && driverMatches);
    elements.loginResult.className = `action-result ${windowValid ? 'ok' : 'error'}`;
    elements.loginResult.textContent = windowValid
      ? nativeLogin
        ? `\u901A\u8FC7\uFF1A\u5DF2\u7531\u666E\u901A\u7CFB\u7EDF\u6D4F\u89C8\u5668\u6253\u5F00\uFF08\u65B0\u589E ${delta} \u4E2A\u7A97\u53E3\uFF09\u3002\u8BF7\u5B8C\u6210\u767B\u5F55\u5E76\u6B63\u5E38\u5173\u95ED\u6D4F\u89C8\u5668\u7A97\u53E3\u3002`
        : `\u901A\u8FC7\uFF1A\u65B0\u589E ${delta} \u4E2A\u53D7\u7BA1\u7A97\u53E3\uFF0C\u767B\u5F55\u9875 URL \u4E3A ${current.url || opened.result?.url || '-'}\u3002`
      : isBlank
        ? '失败：打开后窗口仍为 about:blank。'
        : '\u5931\u8D25\uFF1A\u672A\u627E\u5230\u4E0E\u8FD4\u56DE windowId \u53CA\u9A71\u52A8\u7C7B\u578B\u5339\u914D\u7684\u6D3B\u52A8\u767B\u5F55\u7A97\u53E3\u3002';
    await refresh();
  } catch (error) {
    elements.loginResult.className = 'action-result error';
    elements.loginResult.textContent = error.message || '打开登录页失败。';
  } finally {
    elements.openLoginButton.disabled = false;
  }
}

elements.refreshButton.addEventListener('click', refresh);
elements.probeButton.addEventListener('click', probeBackend);
elements.openLoginButton.addEventListener('click', openLoginAndVerify);
refresh();
