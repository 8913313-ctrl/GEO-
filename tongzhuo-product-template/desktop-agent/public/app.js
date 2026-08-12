const state = {
  status: null,
  platforms: [],
  groups: [],
  sessions: [],
  jobs: [],
  browserWindows: [],
  activeGroupId: '',
  view: 'overview',
  platformSearch: '',
  platformFilter: 'all',
  diagnostics: null,
  settingsEditing: false,
  noticeTimer: null,
};

const $ = (selector) => document.querySelector(selector);

const viewMeta = {
  overview: { kicker: 'WORKSPACE', title: '发布控制台', subtitle: '管理平台窗口、发布任务和节点运行状态。' },
  platforms: { kicker: 'PLATFORM WINDOWS', title: '平台窗口', subtitle: '每个平台都使用独立的本地 Profile；窗口可以重复打开、聚焦和关闭。' },
  accounts: { kicker: 'ACCOUNT GROUPS', title: '平台账号', subtitle: '按客户或业务线隔离账号和登录态。' },
  jobs: { kicker: 'PUBLISH QUEUE', title: '发布任务', subtitle: '选择目标平台后执行，真实发布回执会回写 GEOFlow。' },
  settings: { kicker: 'NODE SETTINGS', title: '节点设置', subtitle: '连接 GEOFlow，并控制任务轮询和自动执行策略。' },
  logs: { kicker: 'DIAGNOSTICS', title: '诊断日志', subtitle: '检查本地服务、节点凭证和平台执行能力。' },
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try { body = JSON.parse(text); } catch { body = { message: text }; }
  }
  if (!response.ok || body.ok === false) throw new Error(body.message || `请求失败：${response.status}`);
  return body;
}

function setNotice(message, type = 'info') {
  const node = $('#notice');
  if (!node) return;
  window.clearTimeout(state.noticeTimer);
  node.textContent = message;
  node.className = `notice${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : ''}`;
  node.hidden = false;
  state.noticeTimer = window.setTimeout(() => { node.hidden = true; }, 4800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function relativeTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function platformById(id) { return state.platforms.find((item) => item.id === id) || null; }
function platformName(id) { return platformById(id)?.name || id || '未知平台'; }
function accountGroups() { return Array.isArray(state.groups) ? state.groups : []; }
function groupById(id) { return accountGroups().find((group) => group.id === id) || null; }
function activeGroup() { return groupById(state.activeGroupId) || accountGroups()[0] || null; }
function groupName(id) { return groupById(id)?.name || id || '未指定账号组'; }
function accountFor(groupId, platformId) { return groupById(groupId)?.accounts?.[platformId] || null; }

function sessionFor(groupId, platformId) {
  return state.sessions.find((session) => {
    if (session?.platform_id !== platformId) return false;
    const sessionGroup = session.meta?.group_id || session.group_id || (session.profile_key || '').split('--')[0];
    return !sessionGroup || sessionGroup === groupId;
  }) || null;
}

function profileKeyFor(groupId, platformId) {
  return accountFor(groupId, platformId)?.profileKey || `${groupId || 'group-default'}--${platformId}`;
}

function windowsFor(groupId, platformId) {
  const profileKey = profileKeyFor(groupId, platformId);
  return state.browserWindows.filter((item) => item.platformId === platformId && item.profileKey === profileKey);
}

function accountStatusLabel(value) {
  return {
    ready: '已登录', open: '窗口已打开', needs_login: '待登录', unknown: '待检测',
    needs_verification: '需要验证', needs_captcha: '需要验证码', expired: '已过期',
    error: '异常', disabled: '已停用',
  }[value] || value || '未记录';
}

function stateBadgeClass(value) {
  return {
    ready: 'is-ready', open: 'is-open', needs_login: 'is-needs-login',
    needs_verification: 'is-needs-verification', needs_captcha: 'is-needs-verification',
    error: 'is-error', expired: 'is-needs-login', export: 'is-export',
  }[value] || 'is-neutral';
}

function supportLabel(value) {
  return { ready: '已适配', planned: '规划中', export: '导出', manual: '人工完成', unknown: '未配置' }[value] || value || '未知';
}

function observedAt(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function syncStateLabel(account) {
  if (!account) return '未记录';
  return {
    synced: '后台已同步',
    pending: '后台待同步',
    waiting_for_pairing: '等待绑定后台',
  }[account.syncState] || (account.pendingSession ? '后台待同步' : '后台未记录');
}

function syncStateDetail(account) {
  if (!account) return '';
  if (account.lastSyncError) return account.lastSyncError;
  if (account.lastSyncedAt) return `最近同步：${formatTime(account.lastSyncedAt)}`;
  return syncStateLabel(account);
}

function platformState(platform, groupId = state.activeGroupId) {
  const account = accountFor(groupId, platform.id);
  const session = sessionFor(groupId, platform.id);
  const windows = windowsFor(groupId, platform.id);
  if (platform.support === 'export') return { state: 'export', account, session, windows };
  const localState = account?.status || '';
  const remoteState = session?.login_state || '';
  const localObservedAt = observedAt(account?.lastVerifiedAt || account?.updatedAt);
  const remoteObservedAt = observedAt(session?.last_seen_at || session?.last_verified_at);
  const localIsFallback = ['needs_login', 'unknown'].includes(localState)
    && !account?.lastVerifiedAt
    && !account?.lastErrorMessage
    && !account?.syncState;
  let mergedState = localState || remoteState || 'needs_login';
  if (remoteState && localState !== 'disabled' && (!localState || localIsFallback || remoteObservedAt > localObservedAt)) {
    mergedState = remoteState;
  }
  return { state: windows.length && mergedState !== 'ready' ? 'open' : mergedState, account, session, windows };
}

function connectionLabel(status) {
  if (status?.isPaired) return '已绑定';
  if (status?.hasCredential) return '已连接';
  return '未绑定';
}

function connectionClass(status) { return status?.isPaired || status?.hasCredential ? 'is-ok' : 'is-warn'; }

function jobStateLabel(value) {
  return { queued: '待处理', running: '执行中', claimed: '已领取', completed: '已完成', published: '已发布', failed: '执行失败', awaiting_login: '等待登录' }[value] || value || '待处理';
}

function jobStateClass(value) {
  if (['completed', 'published'].includes(value)) return 'is-ready';
  if (['failed'].includes(value)) return 'is-error';
  if (['running', 'claimed'].includes(value)) return 'is-open';
  return 'is-neutral';
}

function renderStatus(payload) {
  state.status = payload.status || {};
  if (Array.isArray(payload.platforms)) state.platforms = payload.platforms;
  state.groups = Array.isArray(state.status.accountGroups) ? state.status.accountGroups : state.groups;
  state.sessions = Array.isArray(state.status.sessions) ? state.status.sessions : [];
  state.jobs = Array.isArray(state.status.jobs) ? state.status.jobs : [];
  state.browserWindows = Array.isArray(state.status.browser?.windows) ? state.status.browser.windows : [];
  state.activeGroupId = state.status.activeGroupId || state.activeGroupId || state.groups[0]?.id || '';

  const status = state.status;
  const readyAccounts = Object.values(activeGroup()?.accounts || {}).filter((account) => account.status === 'ready').length;
  const accountCount = Object.keys(activeGroup()?.accounts || {}).length;
  const connection = connectionLabel(status);
  const connectionStateClass = connectionClass(status);

  $('#sideConnectionState').textContent = connection;
  $('#sideConnectionState').className = connectionStateClass;
  $('#sideStatusDot').className = `status-dot ${connectionStateClass}`;
  $('#sideDeviceName').textContent = status.deviceName || '-';
  $('#sideAgentVersion').textContent = status.agentVersion ? `v${status.agentVersion}` : '-';
  $('#topConnectionState').textContent = connection;
  $('#topConnectionState').className = `status-tag ${connectionStateClass}`;
  $('#settingsConnectionState').textContent = connection;
  $('#settingsConnectionState').className = `status-tag ${connectionStateClass}`;

  $('#statConnection').textContent = connection;
  $('#statConnectionHint').textContent = status.isPaired ? '节点正在接收任务' : '在节点设置中完成配对';
  $('#statReadyAccounts').textContent = `${readyAccounts} / ${accountCount}`;
  $('#statReadyAccountsHint').textContent = `${activeGroup()?.name || '当前账号组'} · 已登录账号`;
  $('#statOpenWindows').textContent = String(state.browserWindows.length);
  $('#statOpenWindowsHint').textContent = state.browserWindows.some((item) => item.driver === 'native') ? '系统浏览器登录中，请完成后正常关闭' : state.browserWindows.length ? '可聚焦或关闭' : '可重复打开';
  $('#statJobs').textContent = String(state.jobs.length);
  $('#statJobsHint').textContent = status.activeJobId ? `正在执行 #${status.activeJobId}` : '当前没有执行任务';
  $('#navWindowCount').textContent = String(state.browserWindows.length);
  $('#navJobCount').textContent = String(state.jobs.length);

  renderWorkspaceSelect();
  renderOverview();
  renderPlatforms();
  renderAccountGroups();
  renderJobs();
  renderDeviceDetail();
  if (!state.settingsEditing) renderSettingsForm();
  renderLogs(status.logs || []);
  renderView();
}

function renderWorkspaceSelect() {
  const select = $('#workspaceSelect');
  const groups = accountGroups();
  select.innerHTML = groups.length
    ? groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join('')
    : '<option value="">暂无账号组</option>';
  select.value = state.activeGroupId;
  select.disabled = !groups.length;
}

function renderNav() {
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === state.view && item.classList.contains('nav-item')));
}

function renderView() {
  const meta = viewMeta[state.view] || viewMeta.overview;
  document.querySelectorAll('.page-view').forEach((view) => {
    const visible = view.dataset.page === state.view;
    view.hidden = !visible;
    view.classList.toggle('is-visible', visible);
  });
  $('#pageKicker').textContent = meta.kicker;
  $('#pageTitle').textContent = meta.title;
  $('#pageSubtitle').textContent = meta.subtitle;
  renderNav();
  if (state.view === 'logs' && !state.diagnostics) loadDiagnostics(false).catch(() => {});
}

function switchView(view) {
  const next = viewMeta[view] ? view : 'overview';
  state.view = next;
  if (window.location.hash !== `#${next}`) window.location.hash = next;
  renderView();
}

function shortPlatformLabel(platform) {
  const name = String(platform?.name || platform?.id || '?');
  return name.slice(0, 2);
}

function windowRow(windowItem) {
  const native = windowItem.driver === 'native';
  const kind = native ? '系统浏览器人工登录' : windowItem.kind === 'publish' ? '发布窗口' : windowItem.kind === 'probe' ? '检测窗口' : '登录窗口';
  const title = windowItem.title || windowItem.url || '平台页面';
  const actions = native
    ? '<span class="muted">请在系统浏览器中操作并正常关闭</span>'
    : `<button class="button button-secondary" type="button" data-window-focus="${escapeHtml(windowItem.id)}">聚焦</button><button class="button button-secondary" type="button" data-window-close="${escapeHtml(windowItem.id)}">关闭</button>`;
  return `<div class="window-row">
    <div class="window-mark">${escapeHtml(shortPlatformLabel(platformById(windowItem.platformId)))}</div>
    <div class="window-main"><strong>${escapeHtml(platformName(windowItem.platformId))} · ${escapeHtml(kind)}</strong><span title="${escapeHtml(title)}">${escapeHtml(title)} · ${escapeHtml(relativeTime(windowItem.openedAt))}</span></div>
    <div class="window-actions">${actions}</div>
  </div>`;
}

function renderOverview() {
  const overviewWindows = $('#overviewWindowList');
  const windows = state.browserWindows.slice(0, 5);
  overviewWindows.innerHTML = windows.length ? windows.map(windowRow).join('') : '<div class="empty-state">还没有打开的平台窗口。<br>进入“平台会话”后点击“打开新窗口”。</div>';

  const overviewJobs = $('#overviewJobList');
  const jobs = state.jobs.slice(0, 5);
  overviewJobs.innerHTML = jobs.length ? jobs.map((job) => {
    const article = job.payload?.article || {};
    const value = job.assistant?.state || job.status || 'queued';
    return `<div class="compact-row"><div class="compact-main"><strong>#${escapeHtml(job.id)} · ${escapeHtml(article.title || '未命名文章')}</strong><span>${escapeHtml(job.platforms?.length || 0)} 个目标平台 · ${escapeHtml(relativeTime(job.updated_at || job.updatedAt || job.created_at || job.createdAt))}</span></div><span class="state-badge ${jobStateClass(value)}">${escapeHtml(jobStateLabel(value))}</span></div>`;
  }).join('') : '<div class="empty-state">暂无任务，绑定节点后点击“拉取任务”。</div>';

  const healthList = [...state.platforms].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).slice(0, 15);
  $('#platformHealthSummary').textContent = `${state.platforms.length} 个平台 · ${state.browserWindows.length} 个窗口`;
  $('#overviewPlatformList').innerHTML = healthList.length ? healthList.map((platform) => {
    const current = platformState(platform);
    return `<div class="health-item"><span class="health-indicator ${current.state === 'ready' ? 'is-ready' : current.state === 'open' ? 'is-open' : current.state === 'needs_login' ? 'is-needs-login' : ''}"></span><div><strong title="${escapeHtml(platform.name)}">${escapeHtml(platform.name)}</strong><span>${escapeHtml(accountStatusLabel(current.state))}${current.windows.length ? ` · ${current.windows.length} 窗口` : ''}</span></div></div>`;
  }).join('') : '<div class="empty-state">正在读取平台目录。</div>';
}

function platformCard(platform) {
  const groupId = state.activeGroupId;
  const current = platformState(platform, groupId);
  const canLogin = Boolean(platform.loginUrl && platform.loginUrl !== 'about:blank' && platform.support !== 'export' && platform.support !== 'planned');
  const nativeLoginOpen = current.windows.some((item) => item.driver === 'native');
  const canCheck = Boolean(current.account && canLogin && !nativeLoginOpen);
  const execution = platform.support === 'export' ? '本地导出，不需要登录' : platform.execution?.autoSubmit === true ? '自动发布并等待平台回执' : '自动填充平台编辑器';
  const status = current.state === 'export' ? 'export' : current.state;
  const syncLabel = status === 'export' ? '不需要同步' : syncStateLabel(current.account);
  const syncDetail = status === 'export' ? syncLabel : syncStateDetail(current.account);
  return `<article class="platform-card" data-platform-card="${escapeHtml(platform.id)}">
    <div class="platform-card-head"><div class="platform-mark">${escapeHtml(shortPlatformLabel(platform))}</div><div class="platform-card-title"><strong title="${escapeHtml(platform.name)}">${escapeHtml(platform.name)}</strong><span>${escapeHtml(platform.id)}</span></div><span class="state-badge ${stateBadgeClass(status)}">${escapeHtml(status === 'export' ? '导出' : accountStatusLabel(status))}</span></div>
    <div class="platform-card-meta"><div><b>账号：</b>${escapeHtml(current.account?.accountName || '未设置账号别名')}</div><div><b>能力：</b>${escapeHtml(execution)}</div><div><b>窗口：</b>${nativeLoginOpen ? '普通浏览器登录中 · 完成后请关闭窗口' : current.windows.length ? `${current.windows.length} 个已打开` : '未打开'}</div><div title="${escapeHtml(syncDetail)}"><b>后台：</b>${escapeHtml(syncLabel)}</div></div>
    <div class="platform-card-actions"><button class="button button-primary" type="button" data-platform-open="${escapeHtml(platform.id)}" ${canLogin && !nativeLoginOpen ? '' : 'disabled'}>${nativeLoginOpen ? '请完成并关闭登录窗口' : current.windows.length ? '再开一个窗口' : '打开新窗口'}</button><button class="button button-secondary" type="button" data-platform-check="${escapeHtml(platform.id)}" ${canCheck ? '' : 'disabled'}>${current.state === 'ready' ? '重新检测' : '检测登录'}</button></div>
  </article>`;
}

function renderPlatforms() {
  const groupId = state.activeGroupId;
  const search = state.platformSearch.trim().toLowerCase();
  const list = state.platforms.filter((platform) => {
    const current = platformState(platform, groupId);
    const matchesSearch = !search || `${platform.name} ${platform.id}`.toLowerCase().includes(search);
    const matchesFilter = state.platformFilter === 'all'
      || (state.platformFilter === 'export' && platform.support === 'export')
      || (state.platformFilter === 'open' && current.windows.length > 0)
      || (state.platformFilter === 'ready' && current.state === 'ready')
      || (state.platformFilter === 'needs_login' && ['needs_login', 'needs_verification', 'unknown'].includes(current.state));
    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  $('#platformFilterResult').textContent = `${list.length} / ${state.platforms.length} 个平台`;
  $('#platformWindowCount').textContent = String(state.browserWindows.length);
  $('#platformGrid').innerHTML = list.length ? list.map(platformCard).join('') : '<div class="empty-state">没有符合当前筛选条件的平台。</div>';
  $('#platformWindowList').innerHTML = state.browserWindows.length ? state.browserWindows.map(windowRow).join('') : '<div class="empty-state">没有活动窗口。</div>';
  const searchInput = $('#platformSearch');
  if (searchInput && document.activeElement !== searchInput) searchInput.value = state.platformSearch;
  $('#platformFilter').value = state.platformFilter;
}

function availablePlatformOptions(group) {
  const bound = new Set(Object.keys(group?.accounts || {}));
  return state.platforms.filter((platform) => platform.support !== 'export' && platform.support !== 'planned' && !bound.has(platform.id));
}

function groupField(groupId, name) {
  return [...document.querySelectorAll(`[data-group-field="${name}"]`)].find((element) => element.dataset.groupId === groupId) || null;
}

function renderAccountGroups() {
  const list = $('#accountGroupList');
  const groups = accountGroups();
  if (!groups.length) { list.innerHTML = '<div class="empty-state">暂无账号组，请先新建一个账号组。</div>'; return; }
  list.innerHTML = groups.map((group) => {
    const accounts = Object.values(group.accounts || {});
    const rows = accounts.length ? accounts.map((account) => {
      const nativeLoginOpen = windowsFor(group.id, account.platformId).some((item) => item.driver === 'native');
      return `<div class="account-row"><div class="account-main"><strong>${escapeHtml(platformName(account.platformId))}</strong><span>${escapeHtml(account.accountName || '未设置账号别名')}</span><span class="state-badge ${stateBadgeClass(account.status)}">${escapeHtml(accountStatusLabel(account.status))}</span></div><div class="account-actions"><button class="button button-secondary" type="button" data-group-login="${escapeHtml(group.id)}" data-platform-id="${escapeHtml(account.platformId)}" ${nativeLoginOpen ? 'disabled' : ''}>${nativeLoginOpen ? '请完成并关闭登录窗口' : '打开新窗口'}</button><button class="button button-secondary" type="button" data-group-confirm="${escapeHtml(group.id)}" data-platform-id="${escapeHtml(account.platformId)}" ${nativeLoginOpen ? 'disabled' : ''}>${account.status === 'ready' ? '重新检测' : '检测登录'}</button><button class="button button-secondary danger-text" type="button" data-group-remove="${escapeHtml(group.id)}" data-platform-id="${escapeHtml(account.platformId)}">移除</button></div></div>`;
    }).join('') : '<div class="empty-state">还没有绑定平台账号。</div>';
    const options = availablePlatformOptions(group).map((platform) => `<option value="${escapeHtml(platform.id)}">${escapeHtml(platform.name)}</option>`).join('');
    return `<article class="account-group-card ${group.id === state.activeGroupId ? 'is-active' : ''}"><div class="account-group-head"><div><div class="account-group-title"><strong>${escapeHtml(group.name)}</strong>${group.id === state.activeGroupId ? '<span class="state-badge is-ready">当前使用</span>' : ''}</div><div class="account-group-meta">${accounts.length} 个平台账号 · ${escapeHtml(group.id)}</div></div><button class="button button-secondary" type="button" data-group-rename="${escapeHtml(group.id)}">重命名</button></div><div class="account-list">${rows}</div><div class="account-add"><select data-group-field="platform" data-group-id="${escapeHtml(group.id)}"><option value="">选择要绑定的平台</option>${options}</select><input data-group-field="name" data-group-id="${escapeHtml(group.id)}" placeholder="账号别名（可选）"><button class="button button-primary" type="button" data-group-add="${escapeHtml(group.id)}">加入账号组</button></div></article>`;
  }).join('');
}

function renderJobs() {
  const capabilities = Array.isArray(state.status?.capabilities) ? state.status.capabilities : [];
  const list = $('#jobList');
  if (!state.jobs.length) { list.innerHTML = '<div class="empty-state">暂无任务，绑定节点后点击“拉取任务”。</div>'; return; }
  list.innerHTML = state.jobs.map((job) => {
    const article = job.payload?.article || {};
    const platforms = Array.isArray(job.platforms) ? job.platforms : [];
    const groupId = job.account_group_id || job.group_id || job.payload?.account_group_id || job.payload?.group_id || state.activeGroupId;
    const group = groupById(groupId);
    const eligible = platforms.filter((id) => capabilities.includes(id) && (id === 'zip-download' || Boolean(accountFor(groupId, id))));
    const missing = platforms.filter((id) => capabilities.includes(id) && id !== 'zip-download' && !accountFor(groupId, id));
    const value = job.assistant?.state || job.status || 'queued';
    return `<article class="job-card"><div class="job-card-head"><div><h3>#${escapeHtml(job.id)} · ${escapeHtml(article.title || '未命名文章')}</h3><p class="job-summary">${escapeHtml(article.excerpt || article.meta_description || '暂无摘要')}</p></div><span class="state-badge ${jobStateClass(value)}">${escapeHtml(jobStateLabel(value))}</span></div><div class="job-meta">账号组：${escapeHtml(group?.name || '未指定账号组')} · ${platforms.length} 个目标平台</div><div class="platform-checks">${platforms.map((id) => { const canRun = capabilities.includes(id) && (id === 'zip-download' || Boolean(accountFor(groupId, id))); const reason = !capabilities.includes(id) ? supportLabel(platformById(id)?.support) : !canRun ? '请先绑定账号' : ''; return `<label class="platform-check ${canRun ? '' : 'is-disabled'}" title="${escapeHtml(reason)}"><input type="checkbox" value="${escapeHtml(id)}" ${canRun ? 'checked' : 'disabled'}><span>${escapeHtml(platformName(id))}${reason ? ` · ${escapeHtml(reason)}` : ''}</span></label>`; }).join('')}</div><div class="job-actions"><div>${missing.length ? `<span class="job-warning">${escapeHtml(missing.map((id) => platformName(id)).join('、'))} 未绑定账号</span>` : eligible.length ? '<span class="surface-head-meta">已选择可执行平台</span>' : '<span class="job-warning">当前账号组没有可执行平台</span>'}</div><button class="button button-primary" type="button" data-job-run="${escapeHtml(job.id)}" ${eligible.length && !state.status?.activeJobId ? '' : 'disabled'}>执行选中平台</button></div></article>`;
  }).join('');
}

function renderSettingsForm() {
  const form = $('#settingsForm');
  const status = state.status || {};
  if (!form) return;
  const field = (name) => form.elements.namedItem(name);
  field('deviceName').value = status.deviceName || '';
  field('pairingCode').value = '';
  field('pollSeconds').value = status.pollSeconds || 20;
  field('maxJobAttempts').value = status.maxJobAttempts || 2;
  field('autoRun').checked = Boolean(status.autoRun);
  field('geoflowBaseUrl').value = status.geoflowBaseUrl || '';
  field('connectionMode').value = status.connectionMode || 'token';
}

function renderDeviceDetail() {
  const status = state.status || {};
  const rows = [['设备 ID', status.deviceId], ['节点名称', status.deviceName], ['运行版本', status.agentVersion ? `v${status.agentVersion}` : '-'], ['本地端口', status.port], ['连接模式', status.connectionMode === 'paired' ? '配对模式' : '兼容模式'], ['最近心跳', formatTime(status.lastHeartbeatAt)]];
  $('#deviceDetailList').innerHTML = rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd title="${escapeHtml(value || '-')}">${escapeHtml(value || '-')}</dd></div>`).join('');
}

function renderDiagnostics(payload) {
  state.diagnostics = payload?.diagnostics || payload || null;
  const diagnostics = state.diagnostics || {};
  const summary = diagnostics.summary || 'warn';
  $('#diagnosticsSummary').textContent = summary === 'ok' ? '正常' : summary === 'error' ? '存在异常' : '待处理';
  $('#diagnosticsSummary').className = `status-tag ${summary === 'ok' ? 'is-ok' : summary === 'error' ? 'is-error' : 'is-warn'}`;
  $('#diagnosticsGeneratedAt').textContent = diagnostics.generatedAt ? `生成于 ${formatTime(diagnostics.generatedAt)}` : '-';
  const checks = Array.isArray(diagnostics.checks) ? diagnostics.checks : [];
  $('#diagnosticsList').innerHTML = checks.length ? checks.map((item) => `<article class="diagnostic-card is-${escapeHtml(item.state || 'warn')}"><div class="diagnostic-card-head"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.state === 'ok' ? '正常' : item.state === 'error' ? '异常' : '待处理')}</strong></div><p>${escapeHtml(item.message)}</p></article>`).join('') : '<div class="empty-state">暂无诊断结果。</div>';
}

function renderLogs(logs) {
  const list = $('#logList');
  if (!logs.length) { list.innerHTML = '<div class="empty-state">暂无运行日志。</div>'; return; }
  list.innerHTML = logs.map((log) => `<article class="log-row ${log.level === 'error' ? 'is-error' : ''}"><div class="log-meta"><span class="log-level">${escapeHtml(log.level || 'info')}</span><span>${escapeHtml(formatTime(log.at))}</span><span>${escapeHtml(log.event || '')}</span></div><div class="log-message">${escapeHtml(log.message || '')}</div></article>`).join('');
}

async function loadStatus() {
  const payload = await api('/api/status');
  if (!Array.isArray(payload.status?.accountGroups)) {
    const groups = await api('/api/account-groups').catch(() => ({ groups: [], activeGroupId: '' }));
    payload.status.accountGroups = groups.groups || [];
    payload.status.activeGroupId = groups.activeGroupId || payload.status.activeGroupId;
  }
  renderStatus(payload);
}

async function loadDiagnostics(probe = false) {
  const payload = await api(`/api/diagnostics?probe=${probe ? '1' : '0'}`);
  renderDiagnostics(payload);
}

async function openPlatform(platformId, groupId = state.activeGroupId, button = null) {
  if (button) button.disabled = true;
  try {
    const account = accountFor(groupId, platformId);
    const result = await api(`/api/platforms/${encodeURIComponent(platformId)}/login`, { method: 'POST', body: JSON.stringify({ groupId, accountName: account?.accountName || '' }) });
    const nativeLogin = result.result?.driver === 'native';
    setNotice(nativeLogin
      ? `${platformName(platformId)} 已在普通系统浏览器打开。完成验证码登录后，请正常关闭该窗口，再点击“检测登录”。`
      : `${platformName(platformId)} 已打开新窗口${result.result?.windowId ? ` · 窗口 ${result.result.windowId.slice(-8)}` : ''}`, 'success');
    await loadStatus();
  } catch (error) { setNotice(error.message, 'error'); } finally { if (button) button.disabled = false; }
}

async function checkPlatform(platformId, groupId = state.activeGroupId, button = null) {
  if (button) button.disabled = true;
  try {
    const account = accountFor(groupId, platformId);
    const result = await api(`/api/platforms/${encodeURIComponent(platformId)}/login/check`, { method: 'POST', body: JSON.stringify({ groupId, accountName: account?.accountName || '', recheck: account?.status === 'ready' }) });
    const details = result.result || {};
    setNotice(details.manualLoginInProgress
      ? `${platformName(platformId)} 正在普通系统浏览器中登录。请完成验证码并关闭该窗口后再检测。`
      : `${platformName(platformId)} ${details.loggedIn ? '登录检测通过' : '尚未检测到登录'}`, details.loggedIn ? 'success' : 'info');
    renderStatus({ status: result.status, platforms: state.platforms });
  } catch (error) { setNotice(error.message, 'error'); } finally { if (button) button.disabled = false; }
}

async function checkAllPlatforms() {
  const group = activeGroup();
  const targets = Object.keys(group?.accounts || {});
  if (!targets.length) { setNotice('当前账号组还没有绑定平台。'); return; }
  setNotice(`正在检测 ${targets.length} 个平台的登录状态，请稍候。`);
  for (const platformId of targets) await checkPlatform(platformId, group.id).catch(() => {});
  setNotice(`已完成 ${targets.length} 个平台的登录检测。`, 'success');
}

async function focusWindow(windowId) {
  try { await api(`/api/browser/windows/${encodeURIComponent(windowId)}/focus`, { method: 'POST', body: '{}' }); setNotice('平台窗口已聚焦。', 'success'); } catch (error) { setNotice(error.message, 'error'); }
  await loadStatus().catch(() => {});
}

async function closeWindow(windowId) {
  try { await api(`/api/browser/windows/${encodeURIComponent(windowId)}`, { method: 'DELETE' }); setNotice('平台窗口已关闭。', 'success'); } catch (error) { setNotice(error.message, 'error'); }
  await loadStatus().catch(() => {});
}

async function createGroup() {
  const name = window.prompt('请输入账号组名称', '新账号组');
  if (!name || !name.trim()) return;
  try { const result = await api('/api/account-groups', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }); setNotice(`账号组“${name.trim()}”已创建。`, 'success'); renderStatus({ status: result.status, platforms: state.platforms }); } catch (error) { setNotice(error.message, 'error'); }
}

async function renameGroup(groupId) {
  const group = groupById(groupId);
  const name = window.prompt('请输入新的账号组名称', group?.name || '');
  if (!name || !name.trim() || name.trim() === group?.name) return;
  try { const result = await api(`/api/account-groups/${encodeURIComponent(groupId)}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }); setNotice('账号组名称已更新。', 'success'); renderStatus({ status: result.status, platforms: state.platforms }); } catch (error) { setNotice(error.message, 'error'); }
}

async function addAccount(groupId) {
  const platform = groupField(groupId, 'platform');
  const name = groupField(groupId, 'name');
  if (!platform?.value) { setNotice('请先选择要绑定的平台。', 'error'); return; }
  try { const result = await api(`/api/account-groups/${encodeURIComponent(groupId)}/platforms`, { method: 'POST', body: JSON.stringify({ platformId: platform.value, accountName: name?.value?.trim() || '' }) }); setNotice(`${platformName(platform.value)} 已加入账号组。`, 'success'); renderStatus({ status: result.status, platforms: state.platforms }); } catch (error) { setNotice(error.message, 'error'); }
}

async function removeAccount(groupId, platformId) {
  if (!window.confirm(`确定从账号组移除 ${platformName(platformId)} 吗？`)) return;
  try { const result = await api(`/api/account-groups/${encodeURIComponent(groupId)}/platforms/${encodeURIComponent(platformId)}`, { method: 'DELETE' }); setNotice(`${platformName(platformId)} 已移除。`, 'success'); renderStatus({ status: result.status, platforms: state.platforms }); } catch (error) { setNotice(error.message, 'error'); }
}

async function runJob(jobId, button) {
  const card = button.closest('.job-card');
  const selectedPlatforms = [...card.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  button.disabled = true;
  try { const result = await api(`/api/jobs/${encodeURIComponent(jobId)}/run`, { method: 'POST', body: JSON.stringify({ platforms: selectedPlatforms }) }); setNotice(`任务 #${result.result.jobId} 已执行，状态：${jobStateLabel(result.result.state)}`, result.result.state === 'failed' ? 'error' : 'success'); await loadStatus(); } catch (error) { setNotice(error.message, 'error'); } finally { button.disabled = false; }
}

async function pollJobs() {
  const button = document.querySelector('[data-action="poll"]');
  if (button) button.disabled = true;
  try { const result = await api('/api/poll', { method: 'POST' }); setNotice(`已拉取 ${result.jobs.length} 个任务。`, 'success'); await loadStatus(); } catch (error) { setNotice(error.message, 'error'); } finally { if (button) button.disabled = false; }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const field = (name) => form.elements.namedItem(name);
  const payload = { geoflowBaseUrl: field('geoflowBaseUrl').value.trim(), connectionMode: field('connectionMode').value, deviceName: field('deviceName').value.trim(), pairingCode: field('pairingCode').value.trim() || undefined, pollSeconds: Number(field('pollSeconds').value || 20), maxJobAttempts: Number(field('maxJobAttempts').value || 2), autoRun: field('autoRun').checked };
  try { const result = await api('/api/config', { method: 'POST', body: JSON.stringify(payload) }); if (payload.pairingCode) { await api('/api/register', { method: 'POST' }); setNotice('节点设置已保存，并已完成绑定。', 'success'); } else setNotice('节点设置已保存。', 'success'); state.settingsEditing = false; renderStatus({ status: result.status, platforms: state.platforms }); await loadStatus(); } catch (error) { setNotice(error.message, 'error'); }
}

async function registerDevice() {
  const button = $('#registerButton');
  button.disabled = true;
  try { await api('/api/register', { method: 'POST' }); setNotice('发布节点已绑定到 GEOFlow。', 'success'); await loadStatus(); } catch (error) { setNotice(error.message, 'error'); } finally { button.disabled = false; }
}

async function clearLogs() {
  const button = $('#clearLogsButton');
  button.disabled = true;
  try { const result = await api('/api/logs/clear', { method: 'POST' }); renderStatus({ status: result.status, platforms: state.platforms }); setNotice('运行日志已清空。', 'success'); } catch (error) { setNotice(error.message, 'error'); } finally { button.disabled = false; }
}

async function runDiagnostics() {
  const button = $('#diagnosticsButton');
  button.disabled = true;
  try { await loadDiagnostics(true); setNotice('节点诊断已完成。', 'success'); } catch (error) { setNotice(error.message, 'error'); } finally { button.disabled = false; }
}

async function downloadSupportBundle() {
  const button = $('#supportBundleButton');
  button.disabled = true;
  try { const response = await fetch('/api/support-bundle?probe=1'); if (!response.ok) throw new Error(`支持包导出失败：${response.status}`); const blob = await response.blob(); const url = URL.createObjectURL(blob); const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `tongzhuo-desktop-agent-support-${new Date().toISOString().slice(0, 10)}.json`; const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setNotice('支持包已导出。', 'success'); } catch (error) { setNotice(error.message, 'error'); } finally { button.disabled = false; }
}

async function switchWorkspace(groupId) {
  if (!groupId || groupId === state.activeGroupId) return;
  try { const result = await api('/api/config', { method: 'POST', body: JSON.stringify({ activeGroupId: groupId }) }); state.activeGroupId = groupId; renderStatus({ status: result.status, platforms: state.platforms }); setNotice(`当前账号组已切换为“${groupName(groupId)}”。`, 'success'); } catch (error) { setNotice(error.message, 'error'); }
}

document.addEventListener('click', (event) => {
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) { switchView(viewTarget.dataset.view); return; }
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) {
    if (actionTarget.dataset.action === 'poll') pollJobs();
    if (actionTarget.dataset.action === 'check-all') checkAllPlatforms();
    return;
  }
  const platformOpen = event.target.closest('[data-platform-open]');
  if (platformOpen) { openPlatform(platformOpen.dataset.platformOpen, state.activeGroupId, platformOpen); return; }
  const platformCheck = event.target.closest('[data-platform-check]');
  if (platformCheck) { checkPlatform(platformCheck.dataset.platformCheck, state.activeGroupId, platformCheck); return; }
  const groupLogin = event.target.closest('[data-group-login]');
  if (groupLogin) { openPlatform(groupLogin.dataset.platformId, groupLogin.dataset.groupLogin, groupLogin); return; }
  const groupConfirm = event.target.closest('[data-group-confirm]');
  if (groupConfirm) { checkPlatform(groupConfirm.dataset.platformId, groupConfirm.dataset.groupConfirm, groupConfirm); return; }
  const groupRemove = event.target.closest('[data-group-remove]');
  if (groupRemove) { removeAccount(groupRemove.dataset.groupRemove, groupRemove.dataset.platformId); return; }
  const groupAdd = event.target.closest('[data-group-add]');
  if (groupAdd) { addAccount(groupAdd.dataset.groupAdd); return; }
  const groupRename = event.target.closest('[data-group-rename]');
  if (groupRename) { renameGroup(groupRename.dataset.groupRename); return; }
  const windowFocus = event.target.closest('[data-window-focus]');
  if (windowFocus) { focusWindow(windowFocus.dataset.windowFocus); return; }
  const windowClose = event.target.closest('[data-window-close]');
  if (windowClose) { closeWindow(windowClose.dataset.windowClose); return; }
  const jobRun = event.target.closest('[data-job-run]');
  if (jobRun) runJob(jobRun.dataset.jobRun, jobRun);
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'workspaceSelect') switchWorkspace(event.target.value);
  if (event.target.id === 'platformFilter') { state.platformFilter = event.target.value; renderPlatforms(); }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'platformSearch') { state.platformSearch = event.target.value; renderPlatforms(); }
});

$('#settingsForm').addEventListener('submit', saveSettings);
$('#settingsForm').addEventListener('focusin', () => { state.settingsEditing = true; });
$('#settingsForm').addEventListener('focusout', () => { window.setTimeout(() => { state.settingsEditing = Boolean($('#settingsForm')?.contains(document.activeElement)); }, 0); });
$('#createGroupButton').addEventListener('click', createGroup);
$('#accountsCreateGroupButton').addEventListener('click', createGroup);
$('#registerButton').addEventListener('click', registerDevice);
$('#refreshButton').addEventListener('click', () => loadStatus().catch((error) => setNotice(error.message, 'error')));
$('#diagnosticsButton').addEventListener('click', runDiagnostics);
$('#supportBundleButton').addEventListener('click', downloadSupportBundle);
$('#clearLogsButton').addEventListener('click', clearLogs);

window.addEventListener('hashchange', () => { state.view = window.location.hash.slice(1) || 'overview'; if (!viewMeta[state.view]) state.view = 'overview'; renderView(); });

async function boot() {
  state.view = viewMeta[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'overview';
  try { await loadStatus(); } catch (error) { setNotice(error.message, 'error'); }
  loadDiagnostics(false).catch(() => {});
}

boot();
window.setInterval(() => loadStatus().catch(() => {}), 15000);
