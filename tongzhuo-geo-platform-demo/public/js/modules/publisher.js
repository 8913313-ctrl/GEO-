
const PUBLISH_PLATFORM_ALIASES = { wechat: "wechat_mp", baijia: "baijiahao", blog: "cnblogs", tiktok: "douyin" };
const PUBLISH_PLATFORM_REVERSE_ALIASES = Object.fromEntries(Object.entries(PUBLISH_PLATFORM_ALIASES).map(([from, to]) => [to, from]));
const RETIRED_PUBLISH_PLATFORMS = new Set(["sohufocus", "smzdm", "oschina", "51cto"]);
let publisherSnapshot = { loaded: false, devices: [], accountGroups: [], sessions: [], jobs: [], platforms: [], readyPlatformIds: [], selectablePlatformIds: [], manualConfirmationPlatformIds: [], error: "" };
let aiProviderSnapshot = { loaded: false, loading: false, providers: [], error: "" };
let effectRelayConfigSnapshot = { loaded: false, loading: false, saving: false, testing: false, config: null, relay: null, test: null, error: "" };
let memberSnapshot = { loaded: false, loading: false, users: [], error: "" };
let auditSnapshot = { loaded: false, loading: false, items: [], error: "" };
let monitoringSnapshot = { loaded: false, loading: false, overview: null, traffic: null, liveToday: null, liveYesterday: null, diagnostics: [], error: "", loadedAt: null };
let monitoringDiagnosticPollTimer = null;
let monitoringDiagnosticPollReportId = null;
let monitoringDiagnosticRunInFlight = false;
const monitoringDiagnosticPollFailures = new Map();
// The effect-search page is a customer-facing client of the private relay API.
// Keep relay state outside the workspace demo snapshot so browser refreshes can
// rehydrate it from the customer's server instead of inventing local results.
let effectRelaySnapshot = {
  attempted: false,
  loaded: false,
  loading: false,
  capabilities: null,
  quota: null,
  projects: [],
  links: [],
  history: [],
  historyLoaded: false,
  historyError: "",
  activeRun: null,
  activeLink: null,
  quote: null,
  error: "",
  loadedAt: null
};
// The relay capability/quota cache is shared by the three customer products,
// but quote and active-run state are product-local. Keeping these separate
// prevents a realtime-search quote from appearing on the diagnostic page (or
// a monitoring run from being shown as a diagnostic run).
const effectFlowState = {
  realtime: { quote: null, activeRun: null, activeLink: null, error: "" },
  diagnostic: { quote: null, activeRun: null, activeLink: null, error: "" },
  monitoring: { quote: null, activeRun: null, activeLink: null, error: "" }
};
const effectRelayPollTimers = { realtime: null, diagnostic: null, monitoring: null };
// Monitoring plans have their own durable API and scheduler.  Do not fold
// them into relay history: a plan owns authorization and cadence while each
// occurrence owns an immutable relay run and its live evidence.
let effectMonitoringSnapshot = {
  attempted: false,
  loaded: false,
  loading: false,
  operating: false,
  plans: [],
  activePlan: null,
  runs: [],
  error: "",
  loadedAt: null
};
// One normalized read model powers every AIDSO monitoring view.  The API is
// intentionally separate from plan CRUD so the customer page never invents
// KPI values when a run has no verified live evidence.
let effectMonitoringAnalyticsSnapshot = {
  attempted: false,
  loaded: false,
  loading: false,
  planId: null,
  data: null,
  error: "",
  loadedAt: null
};
const CITATION_LAB_PACKAGE = Object.freeze({
  id: "RP-CITATION-LAB-CN-GEO-2.0.1",
  name: "GEO Citation Lab · CN-GEO",
  version: "2.0.1",
  releasedAt: "2026-07-14",
  citations: 214119,
  canonicalQuestions: 620,
  platforms: 12,
  canonicalSources: 9878,
  pages: 107659,
  license: "代码 MIT；原创报告与内容 CC BY 4.0",
  source: "yaojingang/geo-citation-lab"
});
const DIAGNOSTIC_TYPES = Object.freeze({
  industry_strategy: { label: "行业 GEO 优化策划", short: "行业策划", icon: "target", description: "基于行业问题与研究基线，形成内容、信源和执行路径。" },
  source_ecology: { label: "行业信源生态报告", short: "信源生态", icon: "link", description: "分析研究样本中的平台、域名和页面类型分布。" },
  site_content: { label: "官网与内容诊断", short: "官网内容", icon: "globe", description: "结合官网诊断、知识与内容资产定位可改进项。" },
  comprehensive: { label: "综合运营诊断", short: "综合诊断", icon: "chart", description: "综合行业基线、企业实测与运营执行健康。" }
});
let diagnosticSnapshot = {
  loaded: false,
  attempted: false,
  loading: false,
  projects: [],
  reports: [],
  actions: [],
  researchPackages: [],
  error: "",
  loadedAt: null
};
let analysisWorkbenchSnapshot = {
  loaded: false,
  attempted: false,
  loading: false,
  options: null,
  sessions: [],
  activeSession: null,
  activeRun: null,
  error: "",
  loadedAt: null
};
let analysisWorkbenchPollTimer = null;
let citationUpdateSnapshot = { loaded: false, loading: false, operating: false, update: null, error: "" };
let citationDocumentUpdateSnapshot = { loaded: false, loading: false, operating: false, update: null, error: "" };
let contentAssetSnapshot = { attempted: false, loaded: false, loading: false, syncing: false, items: [], error: "", loadedAt: null };

const ROLE_UI_LABELS = Object.freeze({ admin: "管理员", operator: "内容运营", reviewer: "审核人员", viewer: "只读成员" });
const ROLE_API_VALUES = Object.freeze(Object.fromEntries(Object.entries(ROLE_UI_LABELS).map(([key, label]) => [label, key])));

function currentUserCan(permission) {
  return Boolean(window.__TZ_AUTH__?.user?.permissions?.includes(permission));
}

function productionUserToMember(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.displayName || user.username,
    email: user.email || "",
    role: ROLE_UI_LABELS[user.role] || user.role,
    roleValue: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

async function refreshProductionMembers({ renderAfter = false } = {}) {
  if (!currentUserCan("users.manage")) {
    const own = window.__TZ_AUTH__?.user;
    memberSnapshot = { loaded: true, loading: false, users: own ? [own] : [], error: "" };
    return memberSnapshot;
  }
  memberSnapshot = { ...memberSnapshot, loading: true, error: "" };
  try {
    const payload = await productionApi("/api/v1/users");
    memberSnapshot = { loaded: true, loading: false, users: payload.data?.users || [], error: "" };
    state.settings.members = memberSnapshot.users.map(productionUserToMember);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "members") render();
    return memberSnapshot;
  } catch (error) {
    memberSnapshot = { ...memberSnapshot, loaded: false, loading: false, error: error.message };
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "members") render();
    return null;
  }
}

async function refreshProductionAudit({ renderAfter = false } = {}) {
  if (!currentUserCan("audit.read")) return null;
  auditSnapshot = { ...auditSnapshot, loading: true, error: "" };
  try {
    const payload = await productionApi("/api/v1/audit?limit=300");
    auditSnapshot = { loaded: true, loading: false, items: payload.data?.items || [], error: "" };
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "logs") render();
    return auditSnapshot;
  } catch (error) {
    auditSnapshot = { ...auditSnapshot, loaded: false, loading: false, error: error.message };
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "logs") render();
    return null;
  }
}

function canonicalPublishPlatformId(platformId) {
  const value = String(platformId || "").trim();
  return PUBLISH_PLATFORM_ALIASES[value] || value;
}

function uiPublishPlatformId(platformId) {
  const value = String(platformId || "").trim();
  return PUBLISH_PLATFORM_REVERSE_ALIASES[value] || value;
}

function publisherStoredAccount(group, platformId) {
  if (!group) return null;
  const canonical = canonicalPublishPlatformId(platformId);
  return group.accounts?.[platformId] || group.accounts?.[canonical] || null;
}

function publisherSessionGroupId(session = {}) {
  const explicitGroupId = String(session?.meta?.group_id || session?.group_id || "").trim();
  if (explicitGroupId) return explicitGroupId;
  const profileKey = String(session?.profile_key || "").trim();
  const separator = profileKey.lastIndexOf("--");
  return separator > 0 ? profileKey.slice(0, separator) : "";
}

function publisherSessionUpdatedAt(session = {}) {
  const value = Date.parse(session?.updated_at || session?.last_verified_at || "");
  return Number.isFinite(value) ? value : 0;
}

function publisherSessionForGroup(group, platformId) {
  if (!group) return null;
  const canonical = canonicalPublishPlatformId(platformId);
  const account = publisherStoredAccount(group, canonical);
  const groupId = String(group.id || "").trim();
  const profileKey = String(account?.profileKey || "").trim();
  const deviceId = String(group.deviceId || "").trim();
  return (publisherSnapshot.sessions || [])
    .filter((session) => canonicalPublishPlatformId(session?.platform_id) === canonical)
    .filter((session) => !deviceId || !session?.device_id || String(session.device_id) === deviceId)
    .filter((session) => {
      const sessionGroup = publisherSessionGroupId(session);
      return sessionGroup
        ? sessionGroup === groupId
        : Boolean(profileKey && String(session?.profile_key || "") === profileKey);
    })
    .sort((left, right) => publisherSessionUpdatedAt(right) - publisherSessionUpdatedAt(left))[0] || null;
}

function publisherConnectionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  // Login state is independent from an article/job result.  A saved draft or a
  // completed publish task must never make an account look logged in.
  if (["ready", "online"].includes(status)) return "online";
  if (status === "open") return "needs_login";
  return status || "needs_login";
}

function publisherAccountConnection(group, platformId) {
  const canonical = canonicalPublishPlatformId(platformId);
  const storedAccount = publisherStoredAccount(group, canonical);
  if (!publisherSnapshot.loaded) {
    return {
      account: storedAccount ? { ...storedAccount, platformId: canonical, status: "unknown" } : null,
      session: null,
      status: "unknown",
      ready: false
    };
  }
  const session = publisherSessionForGroup(group, canonical);
  const sessionState = String(session?.login_state || "").trim().toLowerCase();
  // A session reported by the local assistant is authoritative, including an
  // indeterminate probe. Do not let an old account cache keep showing
  // “已登录” after the live session has become unknown.
  const rawStatus = sessionState || storedAccount?.status;
  const status = publisherConnectionStatus(rawStatus);
  const account = storedAccount ? {
    ...storedAccount,
    platformId: canonical,
    name: session?.account_name || storedAccount.name || storedAccount.accountName || "未命名账号",
    accountName: session?.account_name || storedAccount.accountName || storedAccount.name || "",
    status,
    profileKey: session?.profile_key || storedAccount.profileKey || "",
    updatedAt: session?.updated_at || session?.last_verified_at || storedAccount.updatedAt
  } : null;
  return {
    account,
    session,
    status,
    ready: status === "online"
  };
}

function publisherAccount(group, platformId) {
  return publisherAccountConnection(group, platformId).account;
}

function publisherPlatform(platformId) {
  const canonical = canonicalPublishPlatformId(platformId);
  return publisherSnapshot.platforms.find((item) => item.id === canonical) || null;
}

function publisherPlatformSelectable(platformId) {
  const platform = publisherPlatform(platformId);
  // 平台能力必须来自当前发布器目录；断连时不允许用后台静态目录伪造可发布状态。
  return Boolean(publisherSnapshot.loaded && platform && platform.enabled !== false);
}

function publisherAccountReady(account) {
  return Boolean(account && ["online", "ready"].includes(account.status));
}

function publisherAccountReadyForGroup(group, platformId) {
  return publisherAccountConnection(group, platformId).ready;
}

function publisherConnectionMessage(connection) {
  const accountName = connection.account?.name || connection.account?.accountName || "账号";
  if (connection.ready) return `${accountName} · 已登录 · 可直接下发至本地助手`;
  if (!connection.account) return "当前账号组尚未绑定账号";
  if (connection.status === "unknown") return `${accountName} · 本地助手暂未确认登录状态`;
  if (["needs_verification", "needs_captcha"].includes(connection.status)) return `${accountName} · 请在本地发布器完成验证`;
  if (connection.status === "error") return `${accountName} · 本地登录状态异常，请重新登录`;
  return `${accountName} · 请在本地发布器完成登录`;
}

function mapPublisherGroup(group) {
  const accounts = {};
  Object.entries(group.accounts || {}).forEach(([platformId, account]) => {
    const uiId = canonicalPublishPlatformId(platformId);
    accounts[uiId] = {
      ...account,
      name: account.name || account.accountName || "未命名账号",
      status: account.status === "ready" ? "online" : account.status || "needs_login",
      platformId: uiId
    };
  });
  return { ...group, accounts };
}

function publisherGroupUpdatedAt(group) {
  const device = (publisherSnapshot.devices || []).find((item) => item.id === group?.deviceId);
  return [group?.updatedAt, device?.lastHeartbeatAt, ...Object.values(group?.accounts || {}).map((account) => account.updatedAt)].filter(Boolean).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || group?.updatedAt || Date.now();
}

function mapPublisherJob(job) {
  const platforms = (job.platforms || []).map(canonicalPublishPlatformId);
  const group = state.accountGroups.find((item) => item.id === job.group_id || item.id === job.account_group_id);
  const resultFor = (platformId) => {
    const canonical = canonicalPublishPlatformId(platformId);
    return job.results?.[canonical] || job.results?.[platformId] || null;
  };
  const targetStatus = (platformId) => {
    const result = resultFor(platformId);
    const stateValue = String(result?.state || "").trim().toLowerCase();
    if (platformId === "web" && ["published", "success", "completed"].includes(stateValue)) return "success";
    if (platformId !== "web" && ["published", "success", "completed"].includes(stateValue)) return result?.verified === true ? "success" : "result_unknown";
    if (["manual_required", "awaiting_confirmation"].includes(stateValue) || result?.requires_manual_confirmation) return "needs_verification";
    if (stateValue === "draft_saved") return "draft_saved";
    if (stateValue === "partial_failed") return "partial_failed";
    if (stateValue === "result_unknown") return "result_unknown";
    if (stateValue === "failed") return "failed";
    if (stateValue === "cancelled") return "cancelled";
    if (stateValue === "awaiting_login") return "needs_login";
    if (stateValue === "needs_verification") return "needs_verification";
    if (job.status === "scheduled") return "scheduled";
    if (job.status === "cancelled") return "cancelled";
    if (job.status === "running") return "running";
    return "queued";
  };
  const targets = Object.fromEntries(platforms.map((platformId) => {
    const account = platformId === "web" ? state.site?.domain : publisherAccount(group, platformId);
    const result = resultFor(platformId);
    return [platformId, {
      status: targetStatus(platformId),
      account: platformId === "web" ? state.site?.domain : account?.name || account?.accountName || "未绑定账号",
      remoteUrl: result?.remote_url || result?.remoteUrl || "",
      updatedAt: result?.updated_at || job.updatedAt || Date.now(),
      message: result?.message || result?.error || job.message || "",
      requiresManualConfirmation: Boolean(result?.requires_manual_confirmation),
      executionMode: result?.execution_mode || publisherPlatform(platformId)?.executionMode || "publisher"
    }];
  }));
  const statuses = Object.values(targets).map((item) => item.status);
  const jobStatus = String(job.status || "").trim().toLowerCase();
  const status = statuses.length && statuses.every((item) => item === "success") ? "success"
    : statuses.some((item) => item === "partial_failed") ? "partial_failed"
      : statuses.some((item) => item === "result_unknown") ? "result_unknown"
        : jobStatus === "running" ? "running"
          : statuses.some((item) => item === "failed") ? "failed"
            : statuses.some((item) => ["draft_saved", "needs_verification"].includes(item)) ? "needs_verification"
              : ["published", "success", "completed"].includes(jobStatus) ? "result_unknown" : job.status || "queued";
  return {
    id: `REMOTE-${job.id}`,
    remoteJobId: job.id,
    articleId: job.localArticleId || job.payload?.article?.localArticleId || job.articleId,
    contentArticleId: job.articleId,
    articleTitle: job.articleTitle,
    version: job.version,
    groupId: job.group_id || job.account_group_id,
    groupName: job.group_name || group?.name || "未指定账号组",
    status,
    createdAt: job.createdAt || Date.now(),
    updatedAt: job.updatedAt || Date.now(),
    platformOrder: platforms,
    targets,
    logs: Object.entries(targets).map(([platformId, target]) => ({
      time: target.updatedAt ? formatTimeLabel(target.updatedAt) : "刚刚",
      platform: PLATFORM_META[platformId]?.name || publisherPlatform(platformId)?.name || platformId,
      message: target.message || (target.status === "success" ? "平台已回写发布地址" : target.status === "scheduled" ? "已进入定时队列" : target.status === "running" ? "本地发布器正在执行" : "等待本地发布器领取任务")
    }))
  };
}

async function publisherApi(path, options = {}) {
  const request = window.tzFetch || window.fetch.bind(window);
  const response = await request(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok || body.ok === false) throw new Error(body.message || `发布器接口请求失败（${response.status}）`);
  return body;
}

async function aiApi(path, options = {}) {
  const request = window.tzFetch || window.fetch.bind(window);
  const response = await request(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok || body.ok === false) {
    const error = body.error || {};
    const message = error.message || body.message || body.errorMessage || `模型接口请求失败（${response.status}）`;
    const failure = new Error(message);
    failure.code = error.code || body.code || `HTTP_${response.status}`;
    failure.details = error.details || body.details || null;
    failure.retryable = Boolean(error.retryable || body.retryable);
    throw failure;
  }
  return body;
}

async function refreshAiProviders({ renderAfter = false } = {}) {
  aiProviderSnapshot = { ...aiProviderSnapshot, loading: true, error: "" };
  if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
  try {
    const payload = await aiApi("/api/ai/providers");
    const providers = Array.isArray(payload.data?.providers) ? payload.data.providers : Array.isArray(payload.providers) ? payload.providers : [];
    aiProviderSnapshot = { loaded: true, loading: false, providers, error: "" };
    // A newly configured text provider should be usable immediately.  Older
    // demo state may have a display-only model name (for example “DeepSeek V3”)
    // but no provider binding, which otherwise makes every generation request
    // stop before it reaches the real model API.
    if (autoBindDefaultAiProvider("text")) saveState();
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
    return aiProviderSnapshot;
  } catch (error) {
    aiProviderSnapshot = { ...aiProviderSnapshot, loaded: false, loading: false, error: error.message || "模型服务未连接" };
    if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "models") render();
    return null;
  }
}

async function refreshEffectRelayConfig({ renderAfter = false } = {}) {
  effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, loading: true, error: "" };
  if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "effect-relay") render();
  try {
    const payload = await productionApi("/api/v1/diagnostics/relay/config");
    const data = payload.data || {};
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, loaded: true, loading: false, config: data.config || null, relay: data.relay || null, test: data.test || null, error: "" };
  } catch (error) {
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, loaded: false, loading: false, error: error.message || "AI 效果检测服务配置读取失败" };
  }
  if (renderAfter && currentRoute() === "settings" && ui.settingsTab === "effect-relay") render();
  return effectRelayConfigSnapshot;
}

function effectRelayStatusMarkup(config = {}, relay = {}) {
  if (config.source === "environment") return '<span class="status-badge status-online">环境变量接管</span>';
  if (config.lastTestStatus === "passed" || relay.configured) return '<span class="status-badge status-online">已连接</span>';
  if (config.lastTestStatus === "failed") return '<span class="status-badge status-error">连接失败</span>';
  if (config.configured) return '<span class="status-badge status-pending">待测试</span>';
  return '<span class="status-badge status-draft">未配置</span>';
}

async function saveEffectRelayConfig() {
  if (!currentUserCan("system.manage")) return showToast("没有配置权限", "只有管理员可以修改 AI 效果检测服务配置。", "error");
  const payload = {
    baseUrl: document.getElementById("effect-relay-base-url")?.value || "",
    instanceId: document.getElementById("effect-relay-instance-id")?.value || "",
    clientId: document.getElementById("effect-relay-client-id")?.value || "",
    clientSecret: document.getElementById("effect-relay-client-secret")?.value || "",
    deliveryConsumer: document.getElementById("effect-relay-delivery-consumer")?.value || ""
  };
  effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, saving: true, error: "" };
  render();
  try {
    const result = await productionApi("/api/v1/diagnostics/relay/config", { method: "PUT", body: payload });
    const data = result.data || {};
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, loaded: true, saving: false, config: data.config || null, relay: data.relay || null, test: null, error: "" };
    render();
    return showToast("配置已保存", "AI 效果检测服务已在当前后台运行时生效。", "success");
  } catch (error) {
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, saving: false, error: error.message || "配置保存失败" };
    render();
    return showToast("配置保存失败", effectRelayConfigSnapshot.error, "error");
  }
}

async function testEffectRelayConfig() {
  if (!currentUserCan("system.manage")) return showToast("没有测试权限", "只有管理员可以测试 AI 效果检测服务。", "error");
  effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, testing: true, error: "" };
  render();
  try {
    const result = await productionApi("/api/v1/diagnostics/relay/config/test", { method: "POST", body: {} });
    const data = result.data || {};
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, loaded: true, testing: false, config: data.config || effectRelayConfigSnapshot.config, relay: data.relay || effectRelayConfigSnapshot.relay, test: data.test || null, error: "" };
    render();
    const test = data.test || {};
    return showToast(test.status === "passed" ? "连接测试成功" : "连接测试失败", test.message || "中转服务未返回测试结果。", test.status === "passed" ? "success" : "error");
  } catch (error) {
    effectRelayConfigSnapshot = { ...effectRelayConfigSnapshot, testing: false, error: error.message || "连接测试失败" };
    render();
    return showToast("连接测试失败", effectRelayConfigSnapshot.error, "error");
  }
}

function publisherArticleWebUrl(article) {
  const path = article?.siteUrl || `/insights/${siteSlug(article?.siteSlug || article?.title, String(article?.id || "article").toLowerCase())}/`;
  if (/^https?:\/\//i.test(path)) return path;
  const domain = String(state.site?.domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return domain ? `https://${domain}${path.startsWith("/") ? path : "/" + path}` : path;
}

function normalizeTrackedUrl(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "dclid", "msclkid", "yclid"].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function serverContentAssetForArticle(articleId) {
  return (contentAssetSnapshot.items || []).find((item) => String(item.articleId) === String(articleId)) || null;
}

function applyServerContentAssets(items = []) {
  contentAssetSnapshot = { ...contentAssetSnapshot, attempted: true, loaded: true, loading: false, items: Array.isArray(items) ? items : [], error: "", loadedAt: Date.now() };
  return contentAssetSnapshot.items;
}

async function refreshContentAssets({ renderAfter = false, silent = false } = {}) {
  if (contentAssetSnapshot.loading) return contentAssetSnapshot;
  contentAssetSnapshot = { ...contentAssetSnapshot, attempted: true, loading: true, error: "" };
  try {
    const payload = await productionApi("/api/v1/content-assets?publishedOnly=1&limit=2000");
    applyServerContentAssets(payload.data?.items || payload.items || []);
  } catch (error) {
    contentAssetSnapshot = { ...contentAssetSnapshot, attempted: true, loaded: false, loading: false, error: error.message || "内容资产服务暂不可用" };
    if (!silent) showToast("内容资产同步失败", contentAssetSnapshot.error, "error");
  }
  if (renderAfter && currentRoute() === "assets") render();
  return contentAssetSnapshot;
}

function localPublicationSyncPayload() {
  const migrateManual = !state.monitoring?.contentAssetServerMigrationAt;
  return (state.monitoring?.trackedWorks || []).flatMap((work) => {
    const article = (state.articles || []).find((item) => item.id === work.articleId) || null;
    return trackedWorkPublications(work).filter((publication) => migrateManual || publication.source !== "manual").map((publication) => ({
    articleId: article?.contentArticleId || work.articleId || publication.articleId,
    articleVersionId: publication.articleVersion || null,
    publisherJobId: publication.publisherJobId || null,
    platform: publication.platform || "manual",
    platformName: publication.platformName || "其他平台",
    source: publication.source === "manual" ? "manual" : "publish_sync",
    url: publication.url,
    publishedAt: publication.publishedAt || null,
    metadata: { migratedFromWorkspace: true }
  }));
  }).filter((item) => item.articleId && item.url);
}

async function syncLocalContentAssetsToServer({ renderAfter = false } = {}) {
  if (contentAssetSnapshot.syncing) return contentAssetSnapshot;
  const publications = localPublicationSyncPayload();
  if (!publications.length) return refreshContentAssets({ renderAfter, silent: true });
  contentAssetSnapshot = { ...contentAssetSnapshot, syncing: true };
  try {
    await productionApi("/api/v1/content-assets/sync", { method: "POST", body: { publications } });
    state.monitoring = state.monitoring || {};
    if (!state.monitoring.contentAssetServerMigrationAt) {
      state.monitoring.contentAssetServerMigrationAt = new Date().toISOString();
      saveState();
    }
    await refreshContentAssets({ renderAfter: false, silent: true });
  } catch (error) {
    contentAssetSnapshot = { ...contentAssetSnapshot, error: error.message || "历史内容资产迁移失败" };
  } finally {
    contentAssetSnapshot = { ...contentAssetSnapshot, syncing: false };
  }
  if (renderAfter && currentRoute() === "assets") render();
  return contentAssetSnapshot;
}

function trackedWorkPublications(work) {
  const values = Array.isArray(work?.publications) ? work.publications : [];
  if (work?.url && !values.some((item) => item?.url === work.url || item?.canonicalUrl === work.url)) values.push({
    platform: work.type === "官网" ? "web" : "manual",
    platformName: work.site || work.type || "其他平台",
    url: work.url,
    source: "manual",
    publishedAt: work.updatedAt || work.createdAt || Date.now()
  });
  const deduped = new Map();
  values.forEach((item) => {
    const url = normalizeTrackedUrl(item?.url || item?.canonicalUrl);
    if (!url) return;
    const canonicalUrl = normalizeTrackedUrl(item?.canonicalUrl || url) || url;
    const key = canonicalUrl;
    if (!deduped.has(key)) deduped.set(key, {
      id: item.id || uid("PUB"),
      articleId: item.articleId || work?.articleId || null,
      articleVersion: item.articleVersion || null,
      assetId: item.assetId || (work?.articleId ? `ASSET-${work.articleId}` : null),
      platform: item.platform || "manual",
      platformName: item.platformName || PLATFORM_META[item.platform]?.name || work?.site || "其他平台",
      url,
      canonicalUrl,
      source: item.source === "publish_sync" ? "publish_sync" : "manual",
      publishedAt: item.publishedAt || item.updatedAt || work?.updatedAt || work?.createdAt || Date.now(),
      updatedAt: item.updatedAt || work?.updatedAt || work?.createdAt || Date.now()
    });
  });
  return [...deduped.values()];
}

function ensureArticleTrackedWork(article) {
  if (!article?.id) return null;
  state.monitoring = state.monitoring || {};
  state.monitoring.trackedWorks = Array.isArray(state.monitoring.trackedWorks) ? state.monitoring.trackedWorks : [];
  let work = state.monitoring.trackedWorks.find((item) => item.articleId === article.id)
    || state.monitoring.trackedWorks.find((item) => !item.articleId && item.title === article.title);
  if (!work) {
    const siteDomain = String(state.site?.domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "") || domainFromUrl(article.siteUrl, "tongzhuo.com");
    work = {
      id: uid("WORK"), articleId: article.id, title: article.title || "未命名文章", site: "企业官网", type: "官网",
      sourceDomain: siteDomain, url: "", publications: [], autoTracked: true, citedDays: 0, questions: 0, citations: 0,
      status: "queued", questionIds: monitoringBindingsForArticle(article.id)?.questionIds || [], createdAt: Date.now(), updatedAt: Date.now()
    };
    state.monitoring.trackedWorks.unshift(work);
  } else {
    work.articleId = work.articleId || article.id;
    work.title = article.title || work.title;
    work.autoTracked = work.autoTracked !== false;
    work.publications = Array.isArray(work.publications) ? work.publications : [];
  }
  return work;
}

function upsertTrackedPublication(article, target = {}, options = {}) {
  if (!article?.id) return false;
  const url = normalizeTrackedUrl(options.url || target.remoteUrl || target.remote_url);
  if (!url) return false;
  const work = ensureArticleTrackedWork(article);
  if (!work) return false;
  const publications = trackedWorkPublications(work);
  const canonicalUrl = normalizeTrackedUrl(options.canonicalUrl || url) || url;
  const platform = canonicalPublishPlatformId(options.platform || target.platform || "manual") || "manual";
  const platformName = options.platformName || PLATFORM_META[platform]?.name || publisherPlatform(platform)?.name || target.platformName || "其他平台";
  const existing = publications.find((item) => item.canonicalUrl === canonicalUrl);
  const now = Date.now();
  if (existing) {
    Object.assign(existing, { articleId: article.id, articleVersion: article.version || existing.articleVersion || null, assetId: `ASSET-${article.id}`, platform, platformName, url, canonicalUrl, source: existing.source === "manual" && options.source !== "publish_sync" ? "manual" : (options.source || existing.source || "publish_sync"), updatedAt: now });
  } else {
    publications.push({ id: uid("PUB"), articleId: article.id, articleVersion: article.version || null, assetId: `ASSET-${article.id}`, platform, platformName, url, canonicalUrl, source: options.source || "publish_sync", publishedAt: options.publishedAt || now, updatedAt: now });
  }
  work.publications = publications;
  const primary = publications.find((item) => item.platform === "web") || publications[0];
  if (primary) {
    work.url = primary.url;
    work.site = primary.platformName || work.site;
    work.type = primary.platform === "web" ? "官网" : (work.type || "内容平台");
    work.sourceDomain = domainFromUrl(primary.url, work.sourceDomain || "tongzhuo.com");
  }
  work.autoTracked = true;
  work.updatedAt = now;
  return !existing;
}

function syncPublishedAssetTracking() {
  let changed = false;
  (state.articles || []).forEach((article) => {
    const tasks = (state.publishTasks || []).filter((task) => task.articleId === article.id && (!task.version || !article.version || task.version === article.version));
    tasks.forEach((task) => Object.entries(task.targets || {}).forEach(([platform, target]) => {
      if (target?.status !== "success" || !target.remoteUrl) return;
      changed = upsertTrackedPublication(article, { ...target, platform }, { platform, source: "publish_sync", publishedAt: target.updatedAt || task.updatedAt }) || changed;
    }));
    if ((article.status === "published" || article.siteStatus === "published") && (article.siteUrl || tasks.some((task) => task.targets?.web?.status === "success"))) {
      changed = upsertTrackedPublication(article, { platform: "web", remoteUrl: publisherArticleWebUrl(article) }, { platform: "web", source: "publish_sync", publishedAt: article.sitePublishedAt || article.publishedAt }) || changed;
    }
  });
  if (changed) queueMicrotask(() => syncLocalContentAssetsToServer({ renderAfter: currentRoute() === "assets" }));
  return changed;
}

function syncPublisherResultsToState() {
  let changed = false;
  (state.publishTasks || []).forEach((task) => {
    const article = state.articles.find((item) => item.id === task.articleId && (!task.version || item.version === task.version));
    if (!article) return;
    const targets = Object.entries(task.targets || {});
    const successful = targets.filter(([, target]) => target.status === "success");
    const active = targets.some(([, target]) => ["queued", "running"].includes(target.status));
    const actionable = targets.some(([, target]) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status));
    const website = successful.find(([platform]) => platform === "web")?.[1];
    if (website) {
      if (article.siteStatus !== "published") changed = true;
      article.siteStatus = "published";
      article.siteUrl = website.remoteUrl || article.siteUrl || publisherArticleWebUrl(article);
      article.sitePublishedAt = article.sitePublishedAt || new Date().toISOString();
    }
    if (successful.length) {
      if (article.status !== "published") changed = true;
      article.status = "published";
      article.publishedAt = article.publishedAt || new Date().toISOString();
    } else if (active && article.status === "draft") {
      article.status = "publishing";
      changed = true;
    } else if (actionable && article.status === "publishing") {
      article.status = "draft";
      changed = true;
    }
  });
  const trackingChanged = syncPublishedAssetTracking();
  if (changed || trackingChanged) saveState();
}

function syncPublisherSchedulesFromJobs() {
  const taskByRemoteId = new Map((state.publishTasks || []).filter((task) => task.remoteJobId !== undefined && task.remoteJobId !== null).map((task) => [String(task.remoteJobId), task]));
  let changed = false;
  (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled").forEach((schedule) => {
    (schedule.items || []).forEach((item) => {
      (item.targets || []).forEach((target) => {
        if (!target.remoteJobId) return;
        const task = taskByRemoteId.get(String(target.remoteJobId));
        const rawStatus = task?.targets?.[target.platform]?.status || task?.status;
        if (!rawStatus) return;
        const nextStatus = rawStatus === "scheduled" ? "waiting" : rawStatus;
        if (target.status !== nextStatus) {
          target.status = nextStatus;
          changed = true;
        }
      });
      const targetStates = (item.targets || []).map((target) => target.status);
      const nextItemStatus = targetStates.length && targetStates.every((status) => status === "success") ? "success"
        : targetStates.some((status) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(status)) ? "partial"
          : targetStates.some((status) => ["running", "queued"].includes(status)) ? "running"
            : targetStates.every((status) => status === "cancelled") ? "cancelled" : "waiting";
      if (item.status !== nextItemStatus) {
        item.status = nextItemStatus;
        changed = true;
      }
    });
    const itemStates = (schedule.items || []).map((item) => item.status);
    const nextScheduleStatus = itemStates.length && itemStates.every((status) => status === "success") ? "completed"
      : itemStates.some((status) => status === "partial") ? "partial"
        : itemStates.some((status) => status === "running") ? "running"
          : itemStates.every((status) => status === "cancelled") ? "cancelled" : "scheduled";
    if (schedule.status !== nextScheduleStatus) {
      schedule.status = nextScheduleStatus;
      changed = true;
    }
  });
  if (changed) saveState();
}

async function ensurePublisherIntegration() {
  if (!publisherSnapshot.loaded) await refreshPublisherSnapshot();
  if (publisherSnapshot.loaded) return true;
  showToast("本地发布器服务未连接", publisherSnapshot.error || "请确认后台发布服务正在运行，并在发布助手页面重新同步。", "error");
  return false;
}

async function refreshPublisherSnapshot({ renderAfter = false } = {}) {
  try {
    const payload = await publisherApi("/api/publisher/overview");
    const data = payload.data || {};
    publisherSnapshot = {
      loaded: true,
      devices: Array.isArray(data.devices) ? data.devices : [],
      accountGroups: Array.isArray(data.accountGroups) ? data.accountGroups.map(mapPublisherGroup) : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      jobs: Array.isArray(data.jobs) ? data.jobs : [],
      platforms: Array.isArray(data.platforms) ? data.platforms : [],
      readyPlatformIds: Array.isArray(data.readyPlatformIds) ? data.readyPlatformIds : [],
      selectablePlatformIds: Array.isArray(data.selectablePlatformIds) ? data.selectablePlatformIds : (Array.isArray(data.platforms) ? data.platforms.filter((platform) => platform.enabled !== false).map((platform) => platform.id) : []),
      manualConfirmationPlatformIds: Array.isArray(data.manualConfirmationPlatformIds) ? data.manualConfirmationPlatformIds : (Array.isArray(data.platforms) ? data.platforms.filter((platform) => platform.requiresManualConfirmation || platform.support === "manual").map((platform) => platform.id) : []),
      error: ""
    };
    state.accountGroups = publisherSnapshot.accountGroups.length
      ? publisherSnapshot.accountGroups
      : [{ id: "unpaired", name: "未连接本地发布器", deviceId: "", deviceName: "请先配对桌面软件", updatedAt: Date.now(), accounts: {} }];
    state.publishTasks = publisherSnapshot.jobs.map(mapPublisherJob);
    syncPublisherResultsToState();
    syncPublisherSchedulesFromJobs();
    if (renderAfter) render();
    else hydratePublisherConnectivity();
    return publisherSnapshot;
  } catch (error) {
    publisherSnapshot = { ...publisherSnapshot, loaded: false, devices: [], accountGroups: [], sessions: [], jobs: [], platforms: [], readyPlatformIds: [], selectablePlatformIds: [], manualConfirmationPlatformIds: [], error: error.message };
    if (renderAfter) render();
    else hydratePublisherConnectivity();
    return null;
  }
}

function writingAgentById(agentId) {
  return (state.writingAgents || []).find((agent) => agent.id === agentId) || null;
}

function writingAgentSupports(agent, lineId, contentType = null) {
  if (!agent || agent.status !== "active") return false;
  const lineAllowed = !agent.businessLineIds?.length || agent.businessLineIds.includes(lineId);
  const typeAllowed = !contentType || !agent.contentTypes?.length || agent.contentTypes.includes(contentType);
  return lineAllowed && typeAllowed;
}

function activeWritingAgents(lineId = null, contentType = null) {
  return (state.writingAgents || []).filter((agent) => writingAgentSupports(agent, lineId, contentType));
}

function defaultAgentForLine(line, contentType = null) {
  const lineAgent = writingAgentById(line?.defaultWritingAgentId);
  if (writingAgentSupports(lineAgent, line?.id, contentType)) return lineAgent;
  const systemAgent = writingAgentById(state.settings.defaultWritingAgentId);
  if (writingAgentSupports(systemAgent, line?.id, contentType)) return systemAgent;
  return activeWritingAgents(line?.id, contentType)[0] || null;
}

function snapshotWritingAgent(agent, options = {}) {
  return createWritingAgentSnapshot(agent, { modelName: state.settings.model, selectedBy: currentUserName() || "系统管理员", ...options });
}

function resolvePlanWritingAgent(plan) {
  if (!plan?.writingAgentSnapshot) return null;
  return { snapshot: plan.writingAgentSnapshot, agent: writingAgentById(plan.writingAgentSnapshot.agentId || plan.writingAgentId) };
}

function planExpectedPlatformIds(plan) {
  const ids = Array.isArray(plan?.writingHints?.expectedPlatformIds) ? plan.writingHints.expectedPlatformIds : [];
  return [...new Set(ids)].filter((id) => PLATFORM_META[id]);
}

function planExpectedPlatformNames(plan) {
  const nameSnapshots = plan?.writingHints?.expectedPlatformNames || {};
  return planExpectedPlatformIds(plan).map((id) => nameSnapshots[id] || publishPlatformName(id));
}

function planExpectedPlatformGuidance(plan) {
  const guidanceSnapshots = plan?.writingHints?.expectedPlatformGuidance || {};
  return planExpectedPlatformIds(plan).map((id) => ({ id, name: publishPlatformName(id), guidance: guidanceSnapshots[id] || PLATFORM_STYLE_HINTS[id] }));
}

function writingAgentUsageCount(agentId) {
  const plans = state.contentPlans.filter((plan) => plan.writingAgentId === agentId || plan.writingAgentSnapshot?.agentId === agentId).length;
  const articles = state.articles.filter((article) => article.writingAgentId === agentId || article.generationSnapshot?.writingAgent?.agentId === agentId).length;
  return plans + articles;
}

const ui = {
  route: "dashboard",
  planningTab: "keywords",
  planningArchiveKind: "questions",
  planningCategory: "all",
  selectedBusinessLineId: state.businessLines.find((line) => line.status === "active")?.id || state.businessLines[0]?.id || null,
  businessKeywordInput: "",
  businessKeywordError: "",
  questionInput: "",
  questionError: "",
  businessLineError: "",
  planError: "",
  seedInput: "",
  seedError: "",
  selectedCoreKeywordIds: [],
  seedExpanding: false,
  selectedPackId: state.keywordPacks[0]?.id || null,
  expanding: false,
  topicGenerating: false,
  topicGenerationProgress: null,
  topicLibrarySort: null,
  keywordResultSort: null,
  archiveTopicSort: null,
  contentView: "articles",
  studioWorkspaceId: null,
  studioArticleId: null,
  studioPane: "editor",
  studioComposerDraft: "",
  studioTopicDraft: "",
  studioContentType: "深度文章",
  studioAgentId: null,
  studioWebSearch: false,
  studioPicker: null,
  studioSelectionText: "",
  studioGenerating: false,
  studioNotice: "",
  articleTab: "all",
  articleTaskView: "plans",
  articlePlanFilterId: "all",
  articleSearch: "",
  articleRiskFilter: "all",
  articleKnowledgeFilter: "all",
  articleFilterExpanded: false,
  publishTab: "all",
  publishView: "tasks",
  publishBatchCategory: "self_media",
  publishBatchSearch: "",
  publishBatchArticleSearch: "",
  publishBatchSelection: null,
  assistantCatalogGroupId: null,
  assistantCatalogSearch: "",
  assistantCatalogStatus: "all",
  assistantCatalogCategory: "all",
  pairingCode: null,
  pairingExpiresAt: null,
  assetTab: "all",
  assetExpandedId: null,
  assetPlanFilterId: "all",
  assetSearch: "",
  siteTab: "overview",
  sitePageId: "home",
  siteCatalogTab: "services",
  siteContentTab: "articles",
  siteCategoryFilter: "all",
  knowledgeTab: "libraries",
  knowledgeKindFilter: "all",
  knowledgeAssetLibraryFilter: "all",
  knowledgeAssetSearch: "",
  monitoringTab: "overview",
  monitoringPlatform: "all",
  monitoringRange: "30",
  monitoringRefreshing: false,
  monitoringSuggestionGeneration: false,
  monitoringSuggestionProviderId: state.settings?.modelProviderId || "",
  // A private deployment starts with no customer content or platform scope.
  // Capabilities and quota are loaded from its signed relay instance; an
  // operator must explicitly choose the question, brand and target channels.
  effectSearchQuestion: "",
  effectSearchBrand: "",
  effectSearchCompleted: false,
  effectSearchRecords: [],
  effectSearchIndustry: "",
  effectSearchExternalConsent: true,
  effectSearchSubmitting: false,
  effectSearchQuoteReady: false,
  effectSearchProjectId: null,
  effectSearchQuestionSetId: null,
  effectSearchProjectSignature: "",
  effectSearchRunId: null,
  effectSearchRelayRunId: null,
  effectSearchClientRunId: null,
  effectSearchReport: null,
  effectSearchReportLoading: false,
  effectSearchReportError: "",
  effectSearchReportAttemptedRunId: null,
  effectSearchRequestHash: "",
  effectSearchFrozenQuestions: [],
  effectPlatforms: [],
  effectPlatformScopes: [],
  effectPlatformModes: ["快速"],
  effectSearchScopeSelectionTouched: false,
  // Brand diagnosis is intentionally a separate, batch-oriented product flow.
  // It never shares a quote, a frozen question set, or a run with real-time
  // search, even though both use the same signed customer relay underneath.
  effectDiagnosticBrand: "",
  effectDiagnosticSite: "",
  effectDiagnosticIndustry: "",
  effectDiagnosticIntroduction: "",
  effectDiagnosticBrandTerms: [],
  effectDiagnosticCompetitors: [],
  effectDiagnosticQuestions: [],
  effectDiagnosticQuestionDraftInitialized: false,
  effectDiagnosticQuestionGenerating: false,
  effectDiagnosticScopes: [],
  effectDiagnosticModes: ["快速"],
  effectDiagnosticStarted: false,
  effectDiagnosticScopeSelectionTouched: false,
  effectDiagnosticRounds: 1,
  effectDiagnosticPlatformRounds: {},
  effectDiagnosticExternalConsent: false,
  effectDiagnosticSubmitting: false,
  effectDiagnosticQuoteReady: false,
  effectDiagnosticProjectId: null,
  effectDiagnosticQuestionSetId: null,
  effectDiagnosticProjectSignature: "",
  effectDiagnosticFrozenQuestions: [],
  effectDiagnosticRunId: null,
  effectDiagnosticRelayRunId: null,
  effectDiagnosticClientRunId: null,
  effectDiagnosticReportRunId: null,
  effectDiagnosticReportId: null,
  effectDiagnosticReportVersion: null,
  effectDiagnosticReport: null,
  effectDiagnosticReportGenerating: false,
  effectDiagnosticCompleted: false,
  effectMonitorPlanId: null,
  effectMonitorBrand: state.enterpriseProfile?.brandName || "",
  effectMonitorSite: "",
  effectMonitorIndustry: "",
  effectMonitorAliases: [],
  effectMonitorCompetitors: [],
  effectMonitorQuestions: [],
  effectMonitorQuestionDefaultsInitialized: false,
  effectMonitorScopes: [],
  effectMonitorModes: ["快速"],
  effectMonitorCadence: "daily",
  effectMonitorIntervalHours: "24",
  effectMonitorMaxCredits: "100",
  effectMonitorMaxMonthlyCredits: "0",
  effectMonitorAuthorizationReference: "",
  effectMonitorAuthorizationExpiresAt: "",
  effectMonitorExternalConsent: false,
  effectMonitorProjectId: null,
  effectMonitorQuestionSetId: null,
  effectMonitorProjectSignature: "",
  effectMonitorFrozenQuestions: [],
  // The AIDSO monitoring product has its own nine-view workspace.  Keep this
  // separate from the legacy operations-monitoring tabs above.
  effectMonitorView: "dashboard",
  effectMonitorCreating: false,
  effectMonitorPlatform: "all",
  effectMonitorRange: "30",
  // 官网实测是运营诊断的日常入口；行业分析仍保留为独立工作台，避免
  // 将抓取/访问证据与 AI 分析报告混在同一首屏。
  diagnosticSection: "evidence",
  diagnosticWizardOpen: false,
  diagnosticProjectId: null,
  diagnosticReportId: null,
  diagnosticBusinessLineId: state.businessLines.find((line) => line.status === "active")?.id || state.businessLines[0]?.id || null,
  diagnosticType: "comprehensive",
  diagnosticIndustry: "",
  diagnosticGoal: "",
  diagnosticQuestionIds: [],
  diagnosticQuestionSetFrozen: false,
  diagnosticCreating: false,
  diagnosticGeneratingId: null,
  diagnosticActionId: null,
  analysisSessionId: null,
  analysisPrompt: "",
  analysisIndustry: "",
  analysisProviderId: state.settings?.modelProviderId || "",
  analysisDataSources: ["citation_lab"],
  analysisPlatforms: ["豆包", "DeepSeek", "千问", "元宝"],
  analysisReportDepth: "detailed",
  analysisCustomDepth: "",
  analysisPlan: null,
  analysisPlanning: false,
  analysisAdvancedOpen: false,
  analysisFollowUp: "",
  analysisFollowUpConsent: false,
  analysisEvidenceOpen: false,
  analysisSubmitting: false,
  onboardingStep: 1,
  monitorPlatformSelection: null,
  settingsTab: "general",
  modal: null,
  publishSelection: null,
  articleSelection: [],
  scheduleSelection: null,
  submittingSchedule: false,
  submittingPublish: false,
  commandQuery: ""
};

const simulationTimers = new Map();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (siteCmsRuntime.loaded) {
    const cmsJson = JSON.stringify(state.site?.cms || {});
    if (cmsJson !== siteCmsRuntime.lastSnapshotJson) {
      siteCmsRuntime.localDirty = true;
      queueSiteCmsDraftSync();
    }
  }
  queueWorkspaceSync();
}

function addOperationLog(category, detail, actor = currentUserName() || "系统管理员") {
  const logs = state.settings.operationLogs = Array.isArray(state.settings.operationLogs) ? state.settings.operationLogs : [];
  logs.unshift({ id: uid("LOG"), occurredAt: Date.now(), category, actor, detail });
  if (logs.length > 120) logs.length = 120;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function csvValue(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer || 0);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function monitoringBindingsForArticle(articleId) {
  return (state.monitoring.queryBindings || []).find((binding) => binding.articleId === articleId) || null;
}

function monitoredQuestionLabel(questionId) {
  const fromLibrary = state.questionLibrary.find((question) => question.id === questionId);
  const fromSamples = state.monitoring.questions.find((question) => question.id === questionId);
  const fromCustom = (state.monitoring.customQueries || []).find((question) => question.id === questionId);
  return fromLibrary?.question || fromSamples?.question || fromCustom?.question || "已删除的问题";
}


function sanitizeStudioHtml(html) {
  if (!html || typeof document === "undefined") return String(html || "");
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("script,style,iframe,object,embed,form,meta,link").forEach((node) => node.remove());
  const allowedAttributes = new Set(["class", "id", "title", "role", "aria-label", "contenteditable", "data-action", "data-citation-id", "data-asset-id", "data-icon", "href", "target", "rel", "style", "src", "alt", "loading", "width", "height"]);
  template.content.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || !allowedAttributes.has(attribute.name) && !allowedAttributes.has(name)) element.removeAttribute(attribute.name);
    });
    if (element.hasAttribute("href")) {
      try {
        const href = new URL(element.getAttribute("href"), window.location.origin);
        if (!["http:", "https:", "mailto:"].includes(href.protocol)) element.removeAttribute("href");
        else element.setAttribute("href", href.href);
      } catch { element.removeAttribute("href"); }
    }
    if (element.hasAttribute("src")) {
      // Images in the writing studio must come from the authenticated
      // knowledge-asset endpoint.  This keeps pasted HTML from turning the
      // editor into an arbitrary remote-resource or tracking surface while
      // preserving the real binary image URL used by the article.
      try {
        const src = new URL(element.getAttribute("src"), window.location.origin);
        const allowed = src.origin === window.location.origin
          && /^\/api\/v1\/knowledge\/assets\/[A-Za-z0-9._:-]+\/content$/.test(src.pathname);
        if (!allowed || element.tagName !== "IMG") element.removeAttribute("src");
        else element.setAttribute("src", `${src.pathname}${src.search}`);
      } catch { element.removeAttribute("src"); }
    }
    if (element.tagName === "IMG" && element.hasAttribute("loading") && !["lazy", "eager"].includes(element.getAttribute("loading"))) element.removeAttribute("loading");
    if (element.hasAttribute("alt")) element.setAttribute("alt", element.getAttribute("alt").slice(0, 500));
    for (const dimension of ["width", "height"]) {
      if (!element.hasAttribute(dimension)) continue;
      const value = Number.parseInt(element.getAttribute(dimension), 10);
      if (!Number.isInteger(value) || value < 1 || value > 10_000) element.removeAttribute(dimension);
      else element.setAttribute(dimension, String(value));
    }
    if (element.hasAttribute("data-action")) {
      const safeCitationAction = element.tagName === "BUTTON" && element.getAttribute("data-action") === "open-citation" && element.hasAttribute("data-citation-id");
      if (!safeCitationAction) element.removeAttribute("data-action");
    }
    if (element.hasAttribute("style")) {
      const alignment = element.style.textAlign;
      if (["left", "center", "right", "justify"].includes(alignment)) element.setAttribute("style", `text-align:${alignment}`);
      else element.removeAttribute("style");
    }
  });
  return template.innerHTML;
}

function icon(name) {
  const paths = ICONS[name] || ICONS.info;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

function renderSelectAllControl(scope, total, selected, label = "全选", attributes = "") {
  const count = Number(total) || 0;
  const selectedCount = Number(selected) || 0;
  const checked = count > 0 && selectedCount === count;
  const indeterminate = selectedCount > 0 && selectedCount < count;
  return `<label class="select-all-control"><input class="checkbox" type="checkbox" data-select-all="${scope}" data-select-total="${count}" data-select-selected="${selectedCount}" ${attributes} ${checked ? "checked" : ""} ${indeterminate ? 'data-indeterminate="true"' : ""} aria-label="${label}" aria-checked="${indeterminate ? "mixed" : checked ? "true" : "false"}" /><span>${label}</span><small>${selectedCount}/${count}</small></label>`;
}

function syncBulkSelectControl(input, total = input?.dataset.selectTotal, selected = input?.dataset.selectSelected) {
  if (!input) return;
  const count = Number(total) || 0;
  const selectedCount = Number(selected) || 0;
  input.dataset.selectTotal = String(count);
  input.dataset.selectSelected = String(selectedCount);
  input.checked = count > 0 && selectedCount === count;
  input.indeterminate = selectedCount > 0 && selectedCount < count;
  input.dataset.indeterminate = input.indeterminate ? "true" : "false";
  input.setAttribute("aria-checked", input.indeterminate ? "mixed" : input.checked ? "true" : "false");
  const counter = input.parentElement?.querySelector("small");
  if (counter) counter.textContent = selectedCount + "/" + count;
}

function hydrateBulkSelects(root = document) {
  root.querySelectorAll("[data-select-all]").forEach((input) => {
    syncBulkSelectControl(input);
  });
}

function formatRelative(timestamp) {
  const numericTimestamp = Number(timestamp);
  const parsedTimestamp = Number.isFinite(numericTimestamp) ? numericTimestamp : new Date(String(timestamp || "")).getTime();
  const diff = Math.max(0, Date.now() - (Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now()));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + " 分钟前";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " 小时前";
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨天" : days + " 天前";
}

function statusBadge(status) {
  const meta = STATUS_META[status] || [status, "status-draft"];
  return '<span class="status-badge ' + meta[1] + '">' + escapeHtml(meta[0]) + "</span>";
}

function platformLogo(platform) {
  const meta = PLATFORM_META[platform] || { short: "平", logoClass: "generic" };
  const iconUrl = "/platform-icons/" + encodeURIComponent(platform) + ".png";
  return '<span class="platform-logo ' + meta.logoClass + '"><img src="' + iconUrl + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;platform-logo-fallback&quot;>' + meta.short + '</span>\'"></span>';
}
