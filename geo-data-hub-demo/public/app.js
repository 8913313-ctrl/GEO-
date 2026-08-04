const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/>',
  activity: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/><path d="M17 7h2v2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  alert: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  coins: '<ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v4c0 1.7 2.7 3 6 3 1.2 0 2.3-.2 3.2-.5M3 10v4c0 1.7 2.7 3 6 3h1"/><ellipse cx="16" cy="15" rx="5" ry="3"/><path d="M11 15v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-3"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M9 21v-4h3v4M8 7h1M12 7h1M8 11h1M12 11h1M17 9h3v12"/>',
  refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M15 7l2 2M18 4l2 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  power: '<path d="M12 2v10M5.6 5.6a9 9 0 1 0 12.8 0"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};

function icon(name) {
  const body = ICONS[name] || ICONS.file;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function injectIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

const routeMeta = {
  dashboard: ["运营总览", "统一查看客户、实例、积分、任务和上游服务健康状态"],
  customers: ["客户中心", "管理购买桐灼 GEO 数据服务的企业客户"],
  instances: ["部署实例", "为每个客户的私有化系统签发独立实例凭证"],
  billing: ["积分与订单", "管理客户充值、积分钱包、消费结算与平台价格"],
  jobs: ["查询任务", "查看实时搜索、品牌诊断和持续监测任务"],
  providers: ["上游数据源", "管理爱搜接口、上游余额、平台能力和健康状态"],
  analytics: ["经营分析", "对比客户收入、上游成本、毛利和消费结构"],
  settings: ["系统设置", "配置计费、安全、数据留存和运营告警规则"]
};

// These collections are populated only by the central operator API.  Keeping
// them empty until the first authenticated response prevents a disconnected
// production page from ever exposing fixture tenants, balances or tasks.
let customers = [];
let instances = [];
let jobs = [];
let transactions = [];
let capabilities = [];

// AI effect evidence is rendered only by each customer private platform.
// The central operator console exposes task state, billing and delivery audit
// records, but never carries fixture answers or the removed legacy renderer.
const ui = {
  route: "dashboard",
  customerSearch: "",
  customerStatus: "all",
  jobSearch: "",
  jobStatus: "all",
  chartPeriod: "30",
  settingsTab: "billing",
};

const relayRuntime = {
  connected: false,
  loading: false,
  error: "",
  lastUpdated: "",
  summary: null,
  analytics: null,
  attention: [],
  deadLetters: [],
  settings: null,
  audit: [],
  prices: [],
  paymentOrders: [],
  invoiceRequests: [],
  adminUsers: [],
  adminSession: null,
  authRequired: false,
  authPrompted: false
};

const adminRoleLabels = {
  super_admin: "超级管理员",
  operations: "运营管理员",
  finance: "财务管理员",
  support: "客户支持",
  auditor: "只读审计"
};

function adminHasPermission(permission) {
  const permissions = relayRuntime.adminSession?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}

try {
  // Older builds stored the long-lived root token in sessionStorage. A browser
  // must now hold only the HttpOnly server session cookie, so remove any stale
  // value as soon as this production console loads.
  sessionStorage.removeItem("tz-relay-admin-token");
} catch {
  // Session storage can be disabled without affecting cookie-based login.
}

const livePalette = [
  ["#376fe8", "#edf3ff"], ["#18865f", "#eaf8f2"], ["#7057c7", "#f2efff"],
  ["#b66b0c", "#fff6e6"], ["#0f9ca9", "#e8f8f8"], ["#c94451", "#fff0f2"]
];

const capabilityColors = { DB: "#1d9bea", DS: "#5775ed", YB: "#13b878", QW: "#4c68e9", BD: "#7a5ce4", WX: "#378ee5", KIMI: "#15171c", RED: "#e84c55" };

function shortTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function platformLabel(code) {
  const item = capabilities.find((entry) => entry.code === code);
  return item?.name || code || "—";
}

function mapCentralOverview(data) {
  const liveRuns = Array.isArray(data?.runs) ? data.runs : [];
  const liveInstances = Array.isArray(data?.instances) ? data.instances : [];
  const runByTenant = new Map();
  liveRuns.forEach((run) => {
    const current = runByTenant.get(run.tenantId) || { spend: 0, count: 0 };
    current.spend += Number(run.settledCustomerCredits || 0);
    current.count += 1;
    runByTenant.set(run.tenantId, current);
  });
  customers = (Array.isArray(data?.tenants) ? data.tenants : []).map((tenant, index) => {
    const [color, bg] = livePalette[index % livePalette.length];
    const usage = runByTenant.get(tenant.tenantId) || { spend: 0, count: 0 };
    const balance = Number(tenant.wallet?.availableCredits || 0);
    return {
      id: tenant.tenantId,
      name: tenant.displayName,
      short: String(tenant.displayName || "客").slice(0, 1),
      contact: "中央实例管理",
      phone: "—",
      plan: tenant.metadata?.plan || "统一积分套餐",
      instances: liveInstances.filter((instance) => instance.tenantId === tenant.tenantId).length,
      balance,
      spend: usage.spend,
      status: tenant.status === "active" ? (balance > 0 ? "active" : "low") : "paused",
      joined: shortTime(tenant.createdAt),
      color,
      bg
    };
  });
  instances = liveInstances.map((instance) => ({
    id: instance.instanceId,
    customerId: instance.tenantId,
    name: instance.displayName,
    domain: instance.clientId,
    version: `密钥 v${instance.secretVersion || 1}`,
    address: "私有化客户端",
    heartbeat: instance.lastSeenAt ? shortTime(instance.lastSeenAt) : "尚未心跳",
    status: instance.status === "active" ? (instance.lastSeenAt ? "online" : "warning") : "offline",
    rawStatus: instance.status,
    calls: liveRuns.filter((run) => run.instanceId === instance.instanceId).length
  }));
  jobs = liveRuns.map((run) => {
    const done = Number(run.completedItems || 0) + Number(run.failedItems || 0);
    const total = Math.max(1, Number(run.totalItems || 1));
    const status = run.status === "completed" ? "success" : run.status;
    const brand = run.brand?.name || run.clientRunId;
    return {
      id: run.relayRunId,
      customerId: run.tenantId,
      type: total > 1 ? "品牌诊断" : "实时搜索",
      detail: brand,
      channels: `${total}项 / ${done}已完成`,
      credits: Number(run.estimatedCustomerCredits || 0),
      progress: Math.round(done / total * 100),
      status,
      created: shortTime(run.submittedAt)
    };
  });
  transactions = (Array.isArray(data?.ledger) ? data.ledger : []).map((entry) => ({
    id: entry.ledgerId,
    customerId: entry.tenantId,
    entryType: entry.entryType,
    type: ({ top_up: "客户充值", freeze: "任务冻结", settle: "任务结算", release: "失败退回", adjustment: "人工调整", upstream_cost: "上游成本" })[entry.entryType] || entry.entryType,
    amount: Number(entry.availableDelta || 0),
    balance: entry.availableAfter ?? 0,
    note: entry.note || entry.relayRunId || "中转站账本",
    time: shortTime(entry.createdAt)
  }));
  const capabilitySnapshot = data?.providers?.find((provider) => provider.isDefault)?.capabilitySnapshot;
  capabilities = Array.isArray(capabilitySnapshot?.platforms)
    ? capabilitySnapshot.platforms
      .filter((platform) => String(platform?.code || "").trim())
      .map((platform) => ({
        name: platform.name || platform.code,
        code: String(platform.code).trim(),
        color: capabilityColors[platform.code] || "#376fe8",
        terminals: Array.isArray(platform.terminals) ? platform.terminals.map(String).filter(Boolean) : [],
        modes: Array.isArray(platform.modes) ? platform.modes.map(String).filter(Boolean) : [],
        tags: [...(platform.terminals || []), ...(platform.modes || [])]
      }))
    : [];
  relayRuntime.summary = data.summary || null;
  relayRuntime.attention = Array.isArray(data.attention) ? data.attention : [];
  relayRuntime.analytics = data.analytics || relayRuntime.analytics || null;
  relayRuntime.settings = data.settings || relayRuntime.settings || null;
  relayRuntime.audit = Array.isArray(data.audit) ? data.audit : relayRuntime.audit || [];
  relayRuntime.paymentOrders = Array.isArray(data.paymentOrders) ? data.paymentOrders : relayRuntime.paymentOrders || [];
  relayRuntime.invoiceRequests = Array.isArray(data.invoiceRequests) ? data.invoiceRequests : relayRuntime.invoiceRequests || [];
  relayRuntime.lastUpdated = data.serverTime || new Date().toISOString();
}

function syncRelayChrome() {
  const summary = relayRuntime.summary || {};
  const serviceStatus = document.getElementById("relay-service-status");
  if (serviceStatus) serviceStatus.innerHTML = relayRuntime.connected ? `<i></i>中央中转服务在线` : `<i></i>${escapeHtml(relayRuntime.loading ? "正在连接中央 API" : relayRuntime.authRequired ? "需要管理员授权" : "未连接生产 API")}`;
  const gatewayVersion = document.getElementById("relay-gateway-version");
  if (gatewayVersion) gatewayVersion.textContent = relayRuntime.connected ? `Relay API · ${shortTime(relayRuntime.lastUpdated)}` : relayRuntime.authRequired ? "Relay API · 需要授权" : "Relay API · 未连接";
  const customerCount = document.getElementById("nav-customer-count");
  if (customerCount) customerCount.textContent = String(summary.activeTenants ?? customers.length);
  const instanceCount = document.getElementById("nav-instance-count");
  if (instanceCount) instanceCount.textContent = String(summary.activeInstances ?? instances.length);
  const jobCount = document.getElementById("nav-job-count");
  if (jobCount) jobCount.textContent = String(summary.activeRuns ?? jobs.length);
  const upstreamTitle = document.getElementById("relay-upstream-title");
  const upstreamBalance = document.getElementById("relay-upstream-balance");
  const provider = relayRuntime.provider;
  if (upstreamTitle) upstreamTitle.textContent = provider?.status === "active" ? "爱搜中转可用" : relayRuntime.connected ? "爱搜等待配置" : "爱搜接口正常";
  if (upstreamBalance) upstreamBalance.textContent = provider?.lastKnownBalance === null || provider?.lastKnownBalance === undefined ? "—" : number(provider.lastKnownBalance);
  const accountButton = document.querySelector(".account-button");
  const accountName = accountButton?.querySelector("b");
  const accountRole = accountButton?.querySelector("small");
  const accountMark = accountButton?.querySelector(":scope > span");
  const session = relayRuntime.adminSession;
  if (accountName) accountName.textContent = session?.displayName || session?.username || (session?.emergency ? "应急管理员" : "管理员登录");
  if (accountRole) accountRole.textContent = session?.emergency ? "根凭证应急会话" : (adminRoleLabels[session?.role] || "未登录");
  if (accountMark) accountMark.textContent = (session?.displayName || session?.username || "管").slice(0, 1);
}

async function loadRelayOverview({ renderAfter = true } = {}) {
  if (relayRuntime.loading) return;
  relayRuntime.loading = true;
  syncRelayChrome();
  try {
    const response = await fetch("/api/v1/admin/overview", {
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    mapCentralOverview(payload);
    relayRuntime.provider = payload.providers?.find((provider) => provider.isDefault) || payload.providers?.[0] || null;
    relayRuntime.connected = true;
    relayRuntime.error = "";
    relayRuntime.authRequired = false;
    relayRuntime.adminSession = relayRuntime.adminSession || { authenticated: true, authType: "session" };
    // Overview is intentionally the only mandatory request. The optional
    // operational endpoints enrich the UI when the deployed API exposes
    // them; a missing endpoint must never make the dashboard fall back to
    // sample data.
    await Promise.all([
      centralApi(`/api/v1/admin/analytics?days=${encodeURIComponent(ui.chartPeriod)}`).then((data) => { relayRuntime.analytics = data; }).catch((error) => { relayRuntime.error = `经营分析读取失败：${error.message}`; }),
      centralApi("/api/v1/admin/settings").then((data) => { relayRuntime.settings = data.settings || data; }).catch(() => {}),
      centralApi("/api/v1/admin/audit?limit=100").then((data) => { relayRuntime.audit = data.events || []; }).catch(() => {}),
      centralApi("/api/v1/admin/deliveries/dead-letter?limit=100").then((data) => { relayRuntime.deadLetters = data.deliveries || []; }).catch(() => {}),
      centralApi("/api/v1/admin/prices").then((data) => { relayRuntime.prices = data.prices || []; }).catch(() => {}),
      centralApi("/api/v1/admin/session").then((data) => { relayRuntime.adminSession = data; }).catch(() => { relayRuntime.adminSession = null; }),
      centralApi("/api/v1/admin/users").then((data) => { relayRuntime.adminUsers = data.users || []; }).catch(() => { relayRuntime.adminUsers = []; })
    ]);
    if (renderAfter && !document.querySelector("#modal-root .modal")) render();
    return true;
  } catch (error) {
    relayRuntime.connected = false;
    relayRuntime.error = error.message || "无法连接中央中转服务";
    if (/HTTP 401|HTTP 403/.test(relayRuntime.error)) relayRuntime.adminSession = null;
    syncRelayChrome();
    relayRuntime.authRequired = /HTTP 401|HTTP 403/.test(relayRuntime.error);
    if (relayRuntime.authRequired) render();
    if (relayRuntime.authRequired && !relayRuntime.authPrompted && !document.querySelector("#modal-root .modal")) {
      relayRuntime.authPrompted = true;
      openAdminTokenModal();
    }
    return false;
  } finally {
    relayRuntime.loading = false;
    syncRelayChrome();
  }
}

async function centralApi(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `请求失败（HTTP ${response.status}）`);
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function number(value) { return Number(value || 0).toLocaleString("zh-CN"); }
function money(value) { return `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function moneyCents(value, currency = "CNY") { return `${currency === "CNY" ? "¥" : `${currency} `}${(Number(value || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function paymentChannelLabel(value) {
  return ({
    offline_bank: "对公转账",
    wechat_transfer: "微信收款",
    alipay_transfer: "支付宝收款",
    contract_grant: "合同赠送"
  })[value] || value || "—";
}
function paymentOrderStatusLabel(value) {
  return ({ pending_payment: ["待核验", "warning"], paid: ["已入账", ""], cancelled: ["已作废", "neutral"] })[value] || [value || "未知", "neutral"];
}
function invoiceStatusLabel(value) {
  return ({ requested: ["待开票", "warning"], issued: ["已开票", ""], voided: ["已作废", "neutral"] })[value] || [value || "未知", "neutral"];
}
function customBadge(meta) {
  const [label, tone] = meta;
  return `<span class="status-badge ${tone}">${escapeHtml(label)}</span>`;
}
function newIdempotencyKey(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}
function customerById(id) { return customers.find((item) => item.id === id); }
function customerName(id) { return customerById(id)?.name || "未知客户"; }
function statusMeta(status) {
  return {
    active: ["正常", ""], low: ["余额不足", "warning"], paused: ["已暂停", "danger"],
    online: ["在线", ""], warning: ["需升级", "warning"], offline: ["离线", "danger"],
    running: ["执行中", "blue"], queued: ["排队中", "neutral"], success: ["已完成", ""], partial: ["部分完成", "warning"], failed: ["执行失败", "danger"],
    pending: ["待确认", "warning"], completed: ["已完成", ""]
  }[status] || [status, "neutral"];
}

function badge(status) {
  const [label, tone] = statusMeta(status);
  return `<span class="status-badge ${tone}">${escapeHtml(label)}</span>`;
}

function companyCell(customer) {
  return `<span class="company-cell"><i class="company-avatar" style="--avatar-color:${customer.color};--avatar-bg:${customer.bg}">${escapeHtml(customer.short)}</i><span><b>${escapeHtml(customer.name)}</b><small>${escapeHtml(customer.id)}</small></span></span>`;
}

function pageHead(title, description, actions = "") {
  return `<header class="page-head"><div class="page-head-copy"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></header>`;
}

function metricCard({ iconName, value, label, note, tone = "", change = "", direction = "up" }) {
  return `<article class="metric-card ${tone}"><div class="metric-top"><i class="metric-icon">${icon(iconName)}</i>${change ? `<em class="metric-change ${direction}">${escapeHtml(change)}</em>` : ""}</div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></article>`;
}

function analyticsChart(series, customerKey = "customer", upstreamKey = "upstream") {
  const rows = Array.isArray(series) ? series.slice(-30) : [];
  if (!rows.length) return `<div class="empty-state" style="min-height:210px"><div><span>${icon("chart")}</span><b>暂无经营数据</b><p>完成任务结算后，收入、成本和毛利趋势会在这里显示。</p></div></div>`;
  const max = Math.max(1, ...rows.map((row) => Math.max(Number(row[customerKey] || row.customerSettledCredits || 0), Number(row[upstreamKey] || row.upstreamCostCredits || 0))));
  const points = (key, fallback) => rows.map((row, index) => {
    const value = Number(row[key] ?? row[fallback] ?? 0);
    const x = rows.length === 1 ? 450 : (index / (rows.length - 1)) * 900;
    const y = 190 - (value / max) * 160;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" L");
  const customerPath = points(customerKey, "customerSettledCredits");
  const upstreamPath = points(upstreamKey, "upstreamCostCredits");
  const area = `${customerPath} L900 210 L0 210 Z`;
  return `<svg class="chart-svg" viewBox="0 0 900 210" preserveAspectRatio="none" aria-label="经营趋势"><defs><linearGradient id="liveIncomeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#376fe8" stop-opacity=".2"/><stop offset="1" stop-color="#376fe8" stop-opacity="0"/></linearGradient></defs><path d="M${area}" fill="url(#liveIncomeArea)"/><path d="M${customerPath}" fill="none" stroke="#376fe8" stroke-width="3"/><path d="M${upstreamPath}" fill="none" stroke="#7057c7" stroke-width="2.5" stroke-dasharray="7 5"/></svg>`;
}

function renderDashboard() {
  const summary = relayRuntime.summary || {};
  const totalBalance = Number(summary.customerAvailableCredits || 0);
  const activeCustomers = Number(summary.activeTenants || 0);
  const activeInstances = Number(summary.activeInstances || 0);
  const heldCredits = Number(summary.customerHeldCredits || 0);
  const activeRuns = Number(summary.activeRuns || 0);
  const attentionItems = Number(summary.attentionItems || 0);
  const upstreamCredits = Number(summary.upstreamCreditsRecorded || 0);
  const settledCredits = Number(relayRuntime.analytics?.totals?.settledCustomerCredits || summary.settledCustomerCredits || 0);
  const successfulRuns = Number(relayRuntime.analytics?.totals?.successfulRuns || 0);
  const failedRuns = Number(relayRuntime.analytics?.totals?.failedRuns || 0);
  const provider = relayRuntime.provider;
  const period = Number(relayRuntime.analytics?.days || 30);
  return `${pageHead("中央运营总览", "统一查看多客户私有实例、积分账户、查询任务和上游服务状态", `
    <button class="secondary-button" type="button" data-action="open-recharge">${icon("coins")}人工充值</button>
    <button class="primary-button" type="button" data-action="open-customer">${icon("plus")}创建客户</button>`)}
    <div class="notice-bar"><i class="notice-icon">${icon("database")}</i><span><b>${relayRuntime.connected ? `统一爱搜账号已接入 · ${provider?.status === "active" ? "可调度" : "等待配置"}` : "正在连接中央中转服务"}</b><small>${relayRuntime.connected ? `当前有 ${activeRuns} 个运行批次，${heldCredits} 积分处于冻结状态；异常或提交不确定项不会自动重试。` : "连接成功后将显示中央任务、积分和上游健康状态。"}</small></span><em>${attentionItems} 项待处理</em><button class="text-button" type="button" data-route-link="providers">查看数据源</button></div>
    <section class="metric-grid">
      ${metricCard({ iconName: "users", value: number(activeCustomers), label: "有效客户", note: "中央多租户事实库", change: "实时" })}
      ${metricCard({ iconName: "server", value: number(activeInstances), label: "激活私有化实例", note: "实例以 HMAC 独立鉴权", tone: "green", change: "实时" })}
      ${metricCard({ iconName: "wallet", value: number(totalBalance), label: "客户可用积分", note: `另有 ${number(heldCredits)} 积分冻结中`, tone: "purple", change: "账本" })}
      ${metricCard({ iconName: "trend", value: number(settledCredits), label: "已结算客户积分", note: "按成功任务项结算", tone: "cyan", change: "任务" })}
      ${metricCard({ iconName: "database", value: number(upstreamCredits), label: "上游已记录成本", note: "爱搜实际消耗在中央账本留痕", tone: "amber", change: "成本" })}
      ${metricCard({ iconName: "chart", value: number(attentionItems), label: "待人工对账", note: "提交不确定项保持冻结", tone: "green", change: "风控" })}
    </section>
    <section class="dashboard-grid">
      <article class="card"><header class="card-header"><div><h2>积分消费与上游成本</h2><p>最近${period}天真实账本聚合（积分口径）</p></div><div class="card-tabs"><button class="${ui.chartPeriod === "7" ? "active" : ""}" type="button" data-chart-period="7">7天</button><button class="${ui.chartPeriod === "30" ? "active" : ""}" type="button" data-chart-period="30">30天</button><button class="${ui.chartPeriod === "90" ? "active" : ""}" type="button" data-chart-period="90">90天</button></div></header><div class="card-body"><div class="chart-wrap"><div class="chart-legend"><span><i></i>客户结算</span><span><i></i>上游成本</span></div><div class="chart-y-labels"><span>最高</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div>${analyticsChart(relayRuntime.analytics?.series || [], "customer", "upstream")}<div class="chart-x-labels">${(relayRuntime.analytics?.series || []).slice(-7).map((row) => `<span>${escapeHtml(row.label || row.day || "")}</span>`).join("") || "<span>暂无账本数据</span>"}</div></div><div class="chart-summary"><span><small>${period}天客户结算</small><b>${number(relayRuntime.analytics?.totals?.settledCustomerCredits || 0)} 积分</b></span><span><small>爱搜实际成本</small><b>${number(relayRuntime.analytics?.totals?.upstreamCostCredits || upstreamCredits)} 积分</b></span><span><small>积分毛利</small><b>${number((relayRuntime.analytics?.totals?.settledCustomerCredits || 0) - (relayRuntime.analytics?.totals?.upstreamCostCredits || upstreamCredits))} 积分</b></span></div></div></article>
      <article class="card"><header class="card-header"><div><h2>查询任务健康度</h2><p>最近${period}天真实运行统计</p></div><button class="text-button" type="button" data-route-link="jobs">全部任务</button></header><div class="card-body"><div class="health-layout"><div class="donut" style="--success-rate:${Number(relayRuntime.analytics?.totals?.successRate || 0)}%"><span><strong>${Number(relayRuntime.analytics?.totals?.successRate || 0).toFixed(1)}%</strong><small>成功交付</small></span></div><div class="health-list"><div><i></i><span>成功任务</span><b>${number(successfulRuns)}</b></div><div><i></i><span>执行中</span><b>${number(activeRuns)}</b></div><div><i></i><span>异常任务</span><b>${number(failedRuns + attentionItems)}</b></div></div><p class="health-note">${icon("clock")}数据来自中央任务和账本，不展示演示样本</p></div></div></article>
    </section>
    <section class="split-grid">
      <article class="card table-card"><header class="card-header"><div><h2>近期活跃客户</h2><p>按本月积分消费和最近调用排序</p></div><button class="text-button" type="button" data-route-link="customers">查看全部客户</button></header><div class="table-wrap"><table><thead><tr><th>客户企业</th><th>套餐</th><th>实例</th><th>积分余额</th><th>本月消费</th><th>状态</th><th></th></tr></thead><tbody>${customers.slice(0, 5).map((customer) => `<tr><td>${companyCell(customer)}</td><td><span class="tag">${escapeHtml(customer.plan)}</span></td><td>${customer.instances} 个</td><td class="balance-cell ${customer.balance < 1000 ? "low-balance" : ""}">${number(customer.balance)}</td><td>${number(customer.spend)}</td><td>${badge(customer.status)}</td><td><div class="row-actions"><button type="button" data-action="customer-detail" data-id="${customer.id}">详情</button><button type="button" data-action="recharge-customer" data-id="${customer.id}">充值</button></div></td></tr>`).join("")}</tbody></table></div></article>
      <article class="card"><header class="card-header"><div><h2>需要处理</h2><p>异常任务、提交不确定项和人工对账</p></div><span class="status-badge warning">${attentionItems}项</span></header><div class="card-body"><div class="attention-list">${relayRuntime.attention.slice(0, 6).map((item) => `<div class="attention-item danger"><i>${icon("alert")}</i><span><b>${escapeHtml(item.id || item.relayItemId || "异常任务")}</b><small>${escapeHtml(item.lastErrorMessage || item.error?.message || item.status || "需要人工处理")}</small></span><button class="text-button" type="button" data-action="open-attention" data-id="${escapeHtml(item.id || item.relayItemId || "")}">处理</button></div>`).join("") || `<div class="empty-state" style="min-height:120px"><div><span>${icon("check")}</span><b>当前没有待处理异常</b><p>中央账本和任务队列保持一致。</p></div></div>`}</div></div></article>
    </section>`;
}

function renderCustomers() {
  const query = ui.customerSearch.toLowerCase();
  const filtered = customers.filter((item) => (!query || `${item.name}${item.id}${item.contact}`.toLowerCase().includes(query)) && (ui.customerStatus === "all" || item.status === ui.customerStatus));
  const totalCustomers = customers.length;
  const activeCount = customers.filter((item) => item.status === "active").length;
  const lowBalanceCount = customers.filter((item) => item.status === "low").length;
  const topUps = Number(relayRuntime.analytics?.totals?.topUpCustomerCredits || 0);
  return `${pageHead("客户中心", "一个客户企业可绑定多个私有化部署实例，共享企业积分钱包", `<button class="secondary-button" type="button" data-action="export-customers">${icon("download")}导出客户</button><button class="primary-button" type="button" data-action="open-customer">${icon("plus")}创建客户</button>`)}
    <section class="summary-strip"><div><small>客户企业</small><strong>${number(totalCustomers)}</strong><em>来自中央租户表</em></div><div><small>有效客户</small><strong>${number(activeCount)}</strong><em>当前可提交任务</em></div><div><small>低余额客户</small><strong>${number(lowBalanceCount)}</strong><em>需要跟进充值</em></div><div><small>近期入账积分</small><strong>${number(topUps)}</strong><em>账本 top_up 汇总</em></div></section>
    <div class="toolbar"><label class="filter-search"><span>${icon("search")}</span><input id="customer-search" type="search" placeholder="搜索客户名称、编号或联系人" value="${escapeHtml(ui.customerSearch)}" /></label><select id="customer-status" aria-label="客户状态"><option value="all" ${ui.customerStatus === "all" ? "selected" : ""}>全部状态</option><option value="active" ${ui.customerStatus === "active" ? "selected" : ""}>正常</option><option value="low" ${ui.customerStatus === "low" ? "selected" : ""}>余额不足</option><option value="paused" ${ui.customerStatus === "paused" ? "selected" : ""}>已暂停</option></select><select aria-label="客户套餐"><option>全部套餐</option><option>企业标准版</option><option>企业专业版</option><option>定制服务</option></select><span class="toolbar-count">共 ${filtered.length} 个客户</span></div>
    <article class="card table-card"><div class="table-wrap"><table><thead><tr><th>客户企业</th><th>联系人</th><th>服务套餐</th><th>部署实例</th><th>可用积分</th><th>本月消费</th><th>开通日期</th><th>状态</th><th>操作</th></tr></thead><tbody>${filtered.map((customer) => `<tr><td>${companyCell(customer)}</td><td><b>${escapeHtml(customer.contact)}</b><br><span class="sub-cell">${escapeHtml(customer.phone)}</span></td><td><span class="tag">${escapeHtml(customer.plan)}</span></td><td>${customer.instances} 个</td><td class="balance-cell ${customer.balance < 1000 ? "low-balance" : ""}">${number(customer.balance)}</td><td>${number(customer.spend)}</td><td>${customer.joined}</td><td>${badge(customer.status)}</td><td><div class="row-actions"><button type="button" data-action="customer-detail" data-id="${customer.id}">详情</button><button type="button" data-action="recharge-customer" data-id="${customer.id}">充值</button><button type="button" data-action="create-instance" data-id="${customer.id}">新实例</button></div></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty-state"><div><span>${icon("search")}</span><b>没有匹配的客户</b><p>请调整搜索词或客户状态筛选。</p></div></div></td></tr>`}</tbody></table></div><footer class="pagination"><span>显示 1–${filtered.length} 条，共 ${totalCustomers} 条</span><span class="pagination-buttons"><button type="button" disabled>‹</button><button class="active" type="button">1</button><button type="button" disabled>›</button></span></footer></article>`;
}

function renderInstances() {
  const online = instances.filter((item) => item.status === "online").length;
  const warning = instances.filter((item) => item.status === "warning").length;
  const offline = instances.filter((item) => item.status === "offline").length;
  return `${pageHead("部署实例", "每个客户私有化系统使用独立凭证连接中央数据服务", `<button class="secondary-button" type="button" data-action="copy-install-command">${icon("copy")}复制接入说明</button><button class="primary-button" type="button" data-action="open-instance">${icon("plus")}创建实例</button>`)}
    <section class="summary-strip"><div><small>全部实例</small><strong>${number(instances.length)}</strong><em>中央实例注册表</em></div><div><small>当前在线</small><strong>${number(online)}</strong><em>按最近心跳判断</em></div><div><small>等待心跳</small><strong>${number(warning)}</strong><em>已签发但尚未活跃</em></div><div><small>已停用/离线</small><strong>${number(offline)}</strong><em>不可提交新任务</em></div></section>
    <div class="toolbar"><label class="filter-search"><span>${icon("search")}</span><input type="search" placeholder="搜索实例名称、客户或域名" /></label><select><option>全部状态</option><option>在线</option><option>离线</option><option>等待激活</option></select><select><option>全部版本</option><option>v1.0.8</option><option>v1.0.7</option><option>需要升级</option></select><span class="toolbar-count">展示最近活跃的 6 个实例</span></div>
    <section class="instance-grid">${instances.map((instance) => { const customer = customerById(instance.customerId); return `<article class="card instance-card"><div class="instance-card-head"><span>${icon("server")}</span>${badge(instance.status)}</div><h3>${escapeHtml(instance.name)}</h3><small>${escapeHtml(customer?.name)} · ${instance.id}</small><div class="instance-meta"><span><small>Client ID</small><b>${escapeHtml(instance.domain)}</b></span><span><small>实例用途</small><b>${escapeHtml(instance.address)}</b></span><span><small>密钥版本</small><b>${escapeHtml(instance.version)}</b></span><span><small>已知运行</small><b>${number(instance.calls)} 次</b></span></div><footer class="instance-card-footer"><span class="heartbeat"><i></i>最后心跳 ${escapeHtml(instance.heartbeat)}</span><div class="row-actions"><button type="button" data-action="instance-detail" data-id="${instance.id}">详情</button><button type="button" data-action="rotate-secret" data-id="${instance.id}">轮换密钥</button></div></footer></article>`; }).join("") || `<div class="empty-state"><div><span>${icon("server")}</span><b>尚未签发客户实例</b><p>先创建客户，再签发实例密钥。</p></div></div>`}</section>`;
}

function renderBilling() {
  const summary = relayRuntime.summary || {};
  const analytics = relayRuntime.analytics?.totals || {};
  const totalBalance = Number(summary.customerAvailableCredits || 0);
  const heldCredits = Number(summary.customerHeldCredits || 0);
  const orders = Array.isArray(relayRuntime.paymentOrders) ? relayRuntime.paymentOrders : [];
  const invoices = Array.isArray(relayRuntime.invoiceRequests) ? relayRuntime.invoiceRequests : [];
  const recentTopUps = transactions.filter((entry) => entry.entryType === "top_up").slice(0, 6);
  const pendingOrders = Number(summary.pendingPaymentOrders ?? orders.filter((order) => order.status === "pending_payment").length);
  const pendingInvoices = Number(summary.pendingInvoiceRequests ?? invoices.filter((invoice) => invoice.status === "requested").length);
  return `${pageHead("积分、订单与发票", "收款订单先由财务核验，再追加积分账本；没有支付商户凭证时，中转站不会伪造在线支付或自动退款。", `<button class="secondary-button" type="button" data-action="export-ledger">${icon("download")}导出流水</button><button class="primary-button" type="button" data-action="open-recharge">${icon("coins")}创建收款订单</button>`)}
    <section class="billing-grid"><article class="card wallet-hero"><div class="wallet-hero-top"><span><i>${icon("wallet")}</i>全部客户积分钱包</span><small>更新于 ${escapeHtml(shortTime(relayRuntime.lastUpdated))}</small></div><strong>${number(totalBalance)}</strong><small>客户可用积分总额</small><div class="wallet-stats"><span><small>冻结积分</small><b>${number(heldCredits)}</b></span><span><small>待核验订单</small><b>${number(pendingOrders)}</b></span><span><small>待开票申请</small><b>${number(pendingInvoices)}</b></span></div></article><article class="card"><header class="card-header"><div><h2>最近已入账充值</h2><p>账本只在收款订单经核验后追加；订单本身不会改变余额。</p></div><span class="status-badge ${recentTopUps.length ? "" : "neutral"}">${recentTopUps.length}笔</span></header><div class="card-body"><div class="attention-list">${recentTopUps.map((entry) => `<div class="attention-item info"><i>${icon("check")}</i><span><b>${escapeHtml(customerName(entry.customerId))}</b><small>${number(entry.amount)}积分 · ${escapeHtml(entry.note)} · ${escapeHtml(entry.time)}</small></span><span class="tag">已入账</span></div>`).join("") || `<div class="empty-state" style="min-height:120px"><div><span>${icon("receipt")}</span><b>暂无已核验充值</b><p>先创建收款订单，财务核验到账后再将积分写入账本。</p></div></div>`}</div></div></article></section>
    <article class="card table-card"><header class="card-header"><div><h2>收款订单</h2><p>支持对公转账、微信/支付宝转账和合同赠送的受审计确认；未接入支付商户时不生成支付二维码或付款链接。</p></div><button class="text-button" type="button" data-action="open-recharge">创建订单</button></header><div class="table-wrap"><table><thead><tr><th>订单编号</th><th>客户</th><th>渠道</th><th>金额</th><th>积分</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${orders.map((order) => `<tr><td><b>${escapeHtml(order.paymentOrderId)}</b><br><span class="sub-cell">${escapeHtml(order.externalOrderReference || "无外部单号")}</span></td><td>${escapeHtml(customerName(order.tenantId))}</td><td>${escapeHtml(paymentChannelLabel(order.paymentChannel))}</td><td>${moneyCents(order.amountCents, order.currency)}</td><td>${number(order.credits)}</td><td>${customBadge(paymentOrderStatusLabel(order.status))}</td><td>${escapeHtml(shortTime(order.createdAt))}</td><td><div class="row-actions">${order.status === "pending_payment" ? `<button type="button" data-action="confirm-payment-order" data-id="${escapeHtml(order.paymentOrderId)}">核验到账</button><button type="button" data-action="cancel-payment-order" data-id="${escapeHtml(order.paymentOrderId)}">作废</button>` : order.status === "paid" ? `<button type="button" data-action="open-invoice-request" data-id="${escapeHtml(order.paymentOrderId)}">申请开票</button>` : "—"}</div></td></tr>`).join("") || `<tr><td colspan="8"><div class="empty-state"><div><span>${icon("receipt")}</span><b>暂无收款订单</b><p>创建订单不会入账，待财务核验实际收款后再确认积分。</p></div></div></td></tr>`}</tbody></table></div></article>
    <section class="split-grid"><article class="card table-card"><header class="card-header"><div><h2>开票申请</h2><p>系统记录申请、外部发票号码和作废审计；正式电子发票仍由已签约的财税系统开具。</p></div><span class="status-badge ${pendingInvoices ? "warning" : "neutral"}">${number(pendingInvoices)}待处理</span></header><div class="table-wrap"><table><thead><tr><th>申请编号</th><th>客户</th><th>抬头</th><th>金额</th><th>状态</th><th>发票号码</th><th>操作</th></tr></thead><tbody>${invoices.map((invoice) => `<tr><td><b>${escapeHtml(invoice.invoiceRequestId)}</b></td><td>${escapeHtml(customerName(invoice.tenantId))}</td><td>${escapeHtml(invoice.billingTitle || "—")}</td><td>${moneyCents(invoice.amountCents, invoice.currency)}</td><td>${customBadge(invoiceStatusLabel(invoice.status))}</td><td>${escapeHtml(invoice.invoiceNumber || "—")}</td><td><div class="row-actions">${invoice.status === "requested" ? `<button type="button" data-action="issue-invoice" data-id="${escapeHtml(invoice.invoiceRequestId)}">登记开票</button><button type="button" data-action="void-invoice" data-id="${escapeHtml(invoice.invoiceRequestId)}">作废</button>` : invoice.status === "issued" ? `<button type="button" data-action="void-invoice" data-id="${escapeHtml(invoice.invoiceRequestId)}">登记作废</button>` : "—"}</div></td></tr>`).join("") || `<tr><td colspan="7"><div class="empty-state"><div><span>${icon("file")}</span><b>暂无开票申请</b><p>已确认到账的收款订单可提交开票申请。</p></div></div></td></tr>`}</tbody></table></div></article><article class="card"><header class="card-header"><div><h2>最近积分流水</h2><p>余额不允许直接修改，订单确认、任务结算和退款均追加不可变账本。</p></div><button class="text-button" type="button" data-action="export-ledger">导出全部</button></header><div class="card-body"><div class="attention-list">${transactions.slice(0, 8).map((item) => `<div class="attention-item info"><i>${icon("receipt")}</i><span><b>${escapeHtml(customerName(item.customerId))} · ${escapeHtml(item.type)}</b><small>${item.amount > 0 ? "+" : ""}${number(item.amount)}积分 · ${escapeHtml(item.note)} · ${escapeHtml(item.time)}</small></span></div>`).join("") || `<div class="empty-state" style="min-height:170px"><div><span>${icon("receipt")}</span><b>暂无账本流水</b><p>确认到账或任务产生结算后会在这里显示。</p></div></div>`}</div></div></article></section>`;
}

function renderJobs() {
  const query = ui.jobSearch.toLowerCase();
  const filtered = jobs.filter((item) => (!query || `${item.id}${item.detail}${customerName(item.customerId)}`.toLowerCase().includes(query)) && (ui.jobStatus === "all" || item.status === ui.jobStatus));
  const analytics = relayRuntime.analytics?.totals || {};
  const finished = Number(analytics.successfulRuns || jobs.filter((item) => item.status === "success").length);
  const failed = Number(analytics.failedRuns || jobs.filter((item) => ["failed", "attention"].includes(item.status)).length);
  const total = Math.max(finished + failed + jobs.filter((item) => ["running", "queued"].includes(item.status)).length, jobs.length);
  const successRate = total ? (finished / total) * 100 : 0;
  const reconciliations = Number((relayRuntime.summary || {}).attentionItems || relayRuntime.attention.length || 0);
  return `${pageHead("查询任务", "任务仅由客户私有化实例服务端签名提交；中央后台负责队列、计费与异常处置", `<button class="secondary-button" type="button" data-action="refresh-jobs">${icon("refresh")}刷新队列</button>`)}
    <div class="notice-bar"><i class="notice-icon">${icon("shield")}</i><span><b>客户实例提交边界</b><small>中央运营后台不创建测试或扣费任务。请在对应客户实例中完成授权、报价和提交；结果仅交付回该实例的 diagnostic_evidence(live)。</small></span></div>
    <section class="summary-strip"><div><small>当前任务</small><strong>${number(total)}</strong><em>来自中央运行表</em></div><div><small>正在执行</small><strong>${number(Number((relayRuntime.summary || {}).activeRuns || jobs.filter((item) => ["running", "queued"].includes(item.status)).length))}</strong><em>Worker 队列实时状态</em></div><div><small>成功率</small><strong>${successRate.toFixed(1)}%</strong><em>按运行终态计算</em></div><div><small>待人工对账</small><strong>${number(reconciliations)}</strong><em>提交不确定项不会自动重提</em></div></section>
    <div class="toolbar"><label class="filter-search"><span>${icon("search")}</span><input id="job-search" type="search" placeholder="搜索任务编号、客户或问题" value="${escapeHtml(ui.jobSearch)}" /></label><select id="job-status"><option value="all">全部状态</option><option value="running" ${ui.jobStatus === "running" ? "selected" : ""}>执行中</option><option value="queued" ${ui.jobStatus === "queued" ? "selected" : ""}>排队中</option><option value="success" ${ui.jobStatus === "success" ? "selected" : ""}>已完成</option><option value="failed" ${ui.jobStatus === "failed" ? "selected" : ""}>执行失败</option><option value="attention" ${ui.jobStatus === "attention" ? "selected" : ""}>待人工对账</option></select><span class="toolbar-count">共 ${filtered.length} 条任务</span></div>
    <article class="card table-card"><div class="table-wrap"><table><thead><tr><th>任务编号</th><th>客户企业</th><th>任务类型</th><th>查询通道</th><th>积分</th><th>执行进度</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead><tbody>${filtered.map((job) => `<tr><td><b>${escapeHtml(job.id)}</b></td><td>${escapeHtml(customerName(job.customerId))}</td><td><span class="task-type"><b>${escapeHtml(job.type)}</b><small>${escapeHtml(job.detail)}</small></span></td><td>${escapeHtml(job.channels)}</td><td>${number(job.credits)}</td><td><div class="task-progress"><span><small>${job.status === "failed" ? "未执行" : job.progress === 100 ? "已完成" : `已完成 ${job.progress}%`}</small><b>${job.progress}%</b></span><div class="progress-track ${job.status === "failed" ? "failed" : ""}"><i style="--progress:${job.progress}%"></i></div></div></td><td>${escapeHtml(job.created)}</td><td>${badge(job.status)}</td><td><div class="row-actions"><button type="button" data-action="job-detail" data-id="${escapeHtml(job.id)}">详情</button>${job.status === "failed" ? `<button type="button" data-action="retry-job" data-id="${escapeHtml(job.id)}">重试</button>` : ""}${job.status === "attention" ? `<button type="button" data-action="open-attention" data-run-id="${escapeHtml(job.id)}">对账</button>` : ""}</div></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty-state"><div><span>${icon("activity")}</span><b>暂无符合条件的任务</b><p>调整筛选条件，或等待客户实例提交新任务。</p></div></div></td></tr>`}</tbody></table></div><footer class="pagination"><span>当前展示 ${filtered.length} 条，数据由中央运行表返回</span><span class="pagination-buttons"><button class="active" type="button">1</button></span></footer></article>`;
}

function renderDeadLetterDeliveryPanel() {
  const deliveries = Array.isArray(relayRuntime.deadLetters) ? relayRuntime.deadLetters : [];
  if (!deliveries.length) return "";
  return `<article class="card table-card" style="margin-top:18px"><header class="card-header"><div><h2>客户交付死信</h2><p>客户实例多次未能落库并 ACK 的交付。重新入队不会改变任务或账本，只会再次交付给原实例。</p></div><span class="status-badge warning">${number(deliveries.length)} 项</span></header><div class="table-wrap"><table><thead><tr><th>交付编号</th><th>客户实例</th><th>运行</th><th>尝试次数</th><th>最后错误</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${deliveries.map((delivery) => `<tr><td><b>${escapeHtml(delivery.deliveryId)}</b></td><td>${escapeHtml(delivery.instanceId)}</td><td>${escapeHtml(delivery.relayRunId || "—")}</td><td>${number(delivery.attemptCount || 0)} / ${number(delivery.maxAttempts || 0)}</td><td>${escapeHtml(delivery.lastError || "—")}</td><td>${escapeHtml(shortTime(delivery.updatedAt))}</td><td><button type="button" data-action="open-dead-delivery" data-id="${escapeHtml(delivery.deliveryId)}">核查并重投</button></td></tr>`).join("")}</tbody></table></div></article>`;
}

function renderProviders() {
  const provider = relayRuntime.provider || {};
  const providerBadge = provider.status === "active" ? "active" : provider.status === "degraded" ? "warning" : "offline";
  const providerBalance = provider.lastKnownBalance === null || provider.lastKnownBalance === undefined ? "—" : number(provider.lastKnownBalance);
  const providerToken = provider.tokenConfigured ? "Token 已加密保存" : "Token 尚未配置";
  const providerHealth = provider.lastHealthAt ? `最近验证：${shortTime(provider.lastHealthAt)}` : "尚未执行上游探针";
  const providerCost = Number(relayRuntime.analytics?.totals?.upstreamCostCredits || 0);
  const activeCapabilities = capabilities.length;
  return `${pageHead("上游数据源", "统一管理爱搜 API Token、上游积分、平台能力、价格和接口健康", `<button class="secondary-button" type="button" data-action="test-provider">${icon("refresh")}测试连接</button><button class="primary-button" type="button" data-action="provider-config">${icon("settings")}接口配置</button>`)}
    <section class="provider-grid"><article class="card provider-hero"><div class="provider-title"><span>爱</span><div><h2>${escapeHtml(provider.displayName || "爱搜 GEO OpenAPI")}</h2><p>统一账号 · 中央 Worker 负责提交、轮询和成本留痕</p></div><span style="margin-left:auto">${badge(providerBadge)}</span></div><div class="provider-kpis"><div><small>上游积分余额</small><b>${providerBalance}</b></div><div><small>周期消耗成本</small><b>${number(providerCost)}</b></div><div><small>最大并发</small><b>${number(provider.maxInFlight || 0)}</b></div><div><small>能力平台数</small><b>${number(activeCapabilities)}</b></div></div><footer class="provider-actions"><small>${escapeHtml(providerToken)} · ${escapeHtml(providerHealth)}</small><button class="text-button" type="button" data-action="provider-config">管理凭证</button></footer></article><article class="card"><header class="card-header"><div><h2>上游健康检查</h2><p>状态由中央 Worker 探针返回</p></div><span class="status-badge ${provider.lastHealthStatus === "healthy" ? "" : "warning"}">${escapeHtml(provider.lastHealthStatus || "unknown")}</span></header><div class="card-body"><div class="health-layout" style="min-height:140px;grid-template-columns:126px 1fr"><div class="donut" style="width:112px;height:112px;background:conic-gradient(#376fe8 0 ${provider.lastHealthStatus === "healthy" ? "100%" : "0%"},#e9eef5 0 100%)"><span><strong>${provider.lastHealthStatus === "healthy" ? "OK" : "—"}</strong><small>${escapeHtml(providerHealth)}</small></span></div><div class="health-list"><div><i></i><span>Token</span><b>${provider.tokenConfigured ? "已配置" : "未配置"}</b></div><div><i></i><span>账号状态</span><b>${escapeHtml(provider.status || "unknown")}</b></div><div><i></i><span>最近探针</span><b>${escapeHtml(shortTime(provider.lastHealthAt) || "—")}</b></div></div></div></div></article></section>
    <article class="card"><header class="card-header"><div><h2>平台与检测通道</h2><p>平台能力由爱搜接口快照同步，销售价格由桐灼独立配置</p></div><span class="status-badge">${number(activeCapabilities)}个平台</span></header><div class="card-body"><div class="capability-grid">${capabilities.map((item) => `<div class="capability-card"><div class="capability-head"><i class="platform-logo" style="--platform:${item.color}">${escapeHtml(item.code)}</i><b>${escapeHtml(item.name)}</b></div><div class="capability-tags">${item.tags.map((tag) => `<span class="active">${escapeHtml(tag)}</span>`).join("")}</div></div>`).join("") || `<div class="empty-state"><div><span>${icon("database")}</span><b>尚未同步平台能力</b><p>请测试上游连接或配置统一爱搜账号。</p></div></div>`}</div></div></article>`;
}

function renderAnalytics() {
  const analytics = relayRuntime.analytics || { totals: {}, series: [] };
  const totals = analytics.totals || {};
  const settled = Number(totals.settledCustomerCredits || 0);
  const topUp = Number(totals.topUpCustomerCredits || 0);
  const cost = Number(totals.upstreamCostCredits || 0);
  const gross = settled - cost;
  const margin = settled > 0 ? (gross / settled) * 100 : 0;
  const avg = Number(totals.completedItems || 0) > 0 ? settled / Number(totals.completedItems) : 0;
  const ranked = [...customers].sort((a, b) => b.spend - a.spend).slice(0, 6);
  return `${pageHead("经营分析", "从客户充值、查询消费、爱搜成本和平台结构查看数据服务经营情况", `<button class="secondary-button" type="button" data-action="export-analytics">${icon("download")}导出月报</button>`)}
    <section class="metric-grid">${metricCard({ iconName: "coins", value: `${number(topUp)} 积分`, label: "周期内充值入账", note: `最近${Number(analytics.days || 30)}天 top_up`, change: "真实账本" })}${metricCard({ iconName: "activity", value: `${number(settled)} 积分`, label: "客户结算收入", note: `${number(totals.completedItems || 0)} 个已完成任务项`, tone: "purple", change: "已结算" })}${metricCard({ iconName: "database", value: `${number(cost)} 积分`, label: "爱搜上游成本", note: `成本率 ${settled > 0 ? (cost / settled * 100).toFixed(1) : "0.0"}%`, tone: "amber", change: "已留痕" })}${metricCard({ iconName: "chart", value: `${margin.toFixed(1)}%`, label: "积分毛利率", note: `${number(gross)} 积分毛利`, tone: "green", change: "结算口径" })}${metricCard({ iconName: "users", value: `${number(Number(totals.activeTenants || customers.length))}`, label: "活跃客户", note: `${number(Number(totals.activeInstances || instances.length))} 个在线/注册实例`, tone: "cyan", change: "实时" })}${metricCard({ iconName: "trend", value: `${avg.toFixed(2)} 积分`, label: "平均每项收入", note: "仅统计已完成任务项", change: "实测" })}</section>
    <section class="analytics-grid"><article class="card"><header class="card-header"><div><h2>收入、成本与毛利</h2><p>最近${Number(analytics.days || 30)}天真实账本趋势（积分口径）</p></div><button class="text-button" type="button" data-action="refresh-analytics">${icon("refresh")}刷新</button></header><div class="card-body"><div class="chart-wrap" style="height:290px"><div class="chart-legend"><span><i></i>客户结算</span><span><i></i>上游成本</span></div><div class="chart-y-labels"><span>最高</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div>${analyticsChart(analytics.series || [], "customerSettledCredits", "upstreamCostCredits")}<div class="chart-x-labels">${(analytics.series || []).slice(-7).map((row) => `<span>${escapeHtml(row.label || row.day || "")}</span>`).join("") || "<span>暂无数据</span>"}</div></div><div class="chart-summary"><span><small>结算收入</small><b>${number(settled)} 积分</b></span><span><small>上游成本</small><b>${number(cost)} 积分</b></span><span><small>毛利</small><b>${number(gross)} 积分 · ${margin.toFixed(1)}%</b></span></div></div></article><article class="card"><header class="card-header"><div><h2>客户消费排行</h2><p>按中央运行结算积分排序</p></div><button class="text-button" type="button" data-route-link="customers">客户中心</button></header><div class="card-body"><div class="ranking-list">${ranked.map((customer, index, list) => `<div class="ranking-item"><i class="rank-number">${index + 1}</i><span class="ranking-company"><span><b>${escapeHtml(customer.name.replace(/有限公司|研究院/g, ""))}</b><small>${escapeHtml(customer.plan)}</small></span><i style="--rank-width:${Math.max(18, Math.round(customer.spend / Math.max(1, list[0]?.spend || 1) * 100))}%"></i></span><b>${number(customer.spend)}</b></div>`).join("") || `<div class="empty-state"><div><span>${icon("users")}</span><b>暂无客户消费数据</b><p>任务结算后会自动进入排行。</p></div></div>`}</div></div></article></section>`;
}

function renderSettings() {
  const tabs = [["billing", "wallet", "计费与结算"], ["security", "shield", "接口安全"], ["storage", "database", "数据留存"], ["alerts", "bell", "运营告警"], ["audit", "file", "审计日志"], ...(adminHasPermission("admin_users.manage") ? [["administrators", "users", "管理员与权限"]] : [])];
  const title = ui.settingsTab === "billing" ? "计费与结算规则" : ui.settingsTab === "security" ? "接口和实例安全" : ui.settingsTab === "storage" ? "查询数据留存" : ui.settingsTab === "alerts" ? "运营告警规则" : ui.settingsTab === "administrators" ? "管理员与角色权限" : "安全审计记录";
  const editable = ui.settingsTab === "storage";
  const actions = editable
    ? `<button class="primary-button" type="submit" form="settings-form">保存设置</button>`
    : ui.settingsTab === "administrators"
      ? `<button class="secondary-button" type="button" data-action="refresh-admin-users">${icon("refresh")}刷新</button><button class="primary-button" type="button" data-action="open-admin-user">${icon("users")}添加管理员</button>`
      : `<button class="secondary-button" type="button" data-action="refresh-settings">${icon("refresh")}刷新审计</button>`;
  return `${pageHead("系统设置", "配置中央数据服务的计费、安全、留存和运营规则", actions)}<section class="settings-grid"><aside class="card settings-nav">${tabs.map(([id, iconName, label]) => `<button class="${ui.settingsTab === id ? "active" : ""}" type="button" data-settings-tab="${id}">${icon(iconName)}${label}</button>`).join("")}</aside><article class="card settings-section"><h2>${title}</h2><p>${ui.settingsTab === "administrators" ? "命名账号按角色授权；高风险操作要求 MFA，账号变更会撤销已有会话。" : editable ? "设置保存到中央数据库，并写入管理员审计事件。" : "管理员操作记录来自中央审计事件表。"}</p>${settingsContent(ui.settingsTab)}</article></section>`;
}

function settingsContent(tab) {
  const settings = relayRuntime.settings || {};
  const value = (section, key, fallback) => settings?.[section]?.[key] ?? fallback;
  const select = (section, key, current, options, label, hint) => `<div class="setting-row"><span><b>${label}</b><small>${hint}</small></span><select name="${section}.${key}">${options.map(([val, text]) => `<option value="${val}" ${String(value(section, key, current)) === String(val) ? "selected" : ""}>${text}</option>`).join("")}</select></div>`;
  if (tab === "administrators") {
    if (!adminHasPermission("admin_users.manage")) return `<div class="empty-state"><div><span>${icon("lock")}</span><b>仅超级管理员可管理账号</b><p>其他角色只能查看各自获准的业务数据。</p></div></div>`;
    const rows = (relayRuntime.adminUsers || []).map((user) => `<div class="attention-item ${user.status === "active" ? "info" : "danger"}"><i>${icon(user.mfaEnabled ? "shield" : "alert")}</i><span><b>${escapeHtml(user.displayName)} · ${escapeHtml(user.username)}</b><small>${escapeHtml(adminRoleLabels[user.role] || user.role)} · ${user.mfaEnabled ? "MFA 已启用" : "MFA 未启用"} · 最近登录 ${escapeHtml(shortTime(user.lastLoginAt) || "从未")}</small></span><span class="tag">${user.status === "active" ? "启用" : "停用"}</span><button class="text-button" type="button" data-action="edit-admin-user" data-id="${escapeHtml(user.adminUserId)}">管理</button></div>`).join("");
    return `<div class="notice-bar" style="margin-bottom:16px"><i class="notice-icon">${icon("shield")}</i><span><b>角色权限已在服务端强制执行</b><small>超级管理员管理账号；运营管理实例和任务；财务管理入账与发票；支持只处理重试；审计员只读。</small></span></div><div class="attention-list">${rows || `<div class="empty-state"><div><span>${icon("users")}</span><b>暂无命名管理员</b><p>请通过首次初始化创建超级管理员。</p></div></div>`}</div>`;
  }
  if (tab === "security") return `<div class="attention-list"><div class="attention-item info"><i>${icon("shield")}</i><span><b>实例签名强制启用</b><small>所有客户 API 请求均必须使用实例 HMAC、时间戳和 Nonce。生产环境不能在运营页关闭该保护。</small></span><span class="tag">强制</span></div><div class="attention-item info"><i>${icon("key")}</i><span><b>密钥轮换由实例管理执行</b><small>请在“部署实例”中轮换、暂停或吊销凭证；设置页不提供无效的开关。</small></span><span class="tag">审计</span></div></div>`;
  if (tab === "storage") return `<form id="settings-form" class="settings-form">${select("storage", "rawResponseRetentionDays", 90, [[0, "交付后立即清除"], [30, "30天"], [90, "90天"], [180, "180天"]], "原始爱搜响应留存", "仅影响 ACK/死信后的原始 raw/normalized 响应；部署上限优先，账本、任务哈希和审计记录不会清除。")}</form>`;
  if (tab === "alerts") return `<div class="attention-list"><div class="attention-item info"><i>${icon("bell")}</i><span><b>告警由运维检查任务执行</b><small>将 scripts/check-relay-ops.mjs 接入监控平台，并通过环境阈值和 Webhook 管理服务不可达、上游异常和人工对账项告警。</small></span><span class="tag">运维</span></div></div>`;
  if (tab === "audit") return `<div class="attention-list">${(relayRuntime.audit || []).map((event) => `<div class="attention-item info"><i>${icon("file")}</i><span><b>${escapeHtml(event.action || "管理员操作")}</b><small>${escapeHtml(event.actorType || "operator")} · ${escapeHtml(shortTime(event.createdAt))} · ${escapeHtml(event.entityType || "")}/${escapeHtml(event.entityId || "")}</small></span><span class="tag">审计</span></div>`).join("") || `<div class="empty-state" style="min-height:160px"><div><span>${icon("file")}</span><b>暂无审计事件</b><p>客户、实例、充值、重试和对账操作都会写入这里。</p></div></div>`}</div>`;
  return `<div class="attention-list"><div class="attention-item info"><i>${icon("wallet")}</i><span><b>计费规则为生产强制规则</b><small>客户任务在创建前冻结积分，完成后按不可变价格快照结算，失败/不确定任务按审计过的对账流程处理。合同价格请在上游数据源的价格版本中维护。</small></span><span class="tag">账本</span></div></div>`;
}

function renderAuthorizationRequired() {
  return `<section class="card" style="max-width:760px;margin:48px auto"><div class="empty-state" style="min-height:260px"><div><span>${icon("lock")}</span><b>需要中央运营登录</b><p>请使用命名管理员账号登录；根 Token 只用于首次初始化或灾难恢复。</p><button class="primary-button" type="button" data-action="account-menu">管理员登录</button></div></div></section>`;
}

function renderConnectionPending() {
  const message = relayRuntime.error
    ? `中央中转服务暂时不可用：${relayRuntime.error}`
    : "正在读取中央中转服务的实时客户、任务和账本数据。";
  return `<section class="card" style="max-width:860px;margin:48px auto"><div class="empty-state" style="min-height:260px"><div><span>${icon(relayRuntime.error ? "alert" : "refresh")}</span><b>${relayRuntime.error ? "无法读取生产数据" : "正在连接中央中转服务"}</b><p>${escapeHtml(message)}</p><button class="primary-button" type="button" data-action="retry-overview">${icon("refresh")}重新连接</button></div></div></section>`;
}

function render() {
  const route = routeMeta[ui.route] ? ui.route : "dashboard";
  ui.route = route;
  document.querySelectorAll("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  document.getElementById("topbar-title").textContent = routeMeta[route][0];
  if (relayRuntime.authRequired && !relayRuntime.connected) {
    document.getElementById("view").innerHTML = renderAuthorizationRequired();
    document.title = `${routeMeta[route][0]} · 桐灼 GEO 中央中转平台`;
    injectIcons(document.getElementById("view"));
    syncRelayChrome();
    return;
  }
  if (!relayRuntime.connected) {
    document.getElementById("view").innerHTML = renderConnectionPending();
    document.title = `${routeMeta[route][0]} · 桐灼 GEO 中央中转平台`;
    injectIcons(document.getElementById("view"));
    syncRelayChrome();
    return;
  }
  const renderers = { dashboard: renderDashboard, customers: renderCustomers, instances: renderInstances, billing: renderBilling, jobs: renderJobs, providers: renderProviders, analytics: renderAnalytics, settings: renderSettings };
  const view = document.getElementById("view");
  view.innerHTML = renderers[route]();
  if (route === "jobs") view.insertAdjacentHTML("beforeend", renderDeadLetterDeliveryPanel());
  document.title = `${routeMeta[route][0]} · 桐灼 GEO 数据服务`;
  injectIcons(view);
  syncRelayChrome();
}

function showToast(title, message, tone = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<span>${icon(tone === "error" ? "alert" : "check")}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(message)}</p></div>`;
  document.getElementById("toast-root").appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

async function copyTextToClipboard(value) {
  const text = String(value ?? "");
  if (!text) throw new Error("没有可复制的内容。");
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some managed browsers deny Clipboard API access even on HTTPS. Fall
      // through to the focused-document fallback before reporting failure.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = Boolean(document.execCommand?.("copy"));
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error("浏览器未授予剪贴板权限，请在受信任的 HTTPS 页面手动复制。");
}

function clientInstallInstructions() {
  const relayUrl = window.location.origin;
  return [
    "# 桐灼 GEO 客户实例接入（仅服务端）",
    `TZ_RELAY_BASE_URL=${relayUrl}`,
    "TZ_RELAY_CLIENT_ID=<由中央后台签发>",
    "TZ_RELAY_CLIENT_SECRET=<仅保存于客户服务器密钥管理系统>",
    "",
    "# 客户服务端对每个 /client/v1/* 请求附加：",
    "# X-TZ-Client-Id、X-TZ-Timestamp、X-TZ-Nonce、X-TZ-Signature",
    "# 签名串：METHOD\\nPATH_AND_QUERY\\nTIMESTAMP\\nNONCE\\nSHA256(RAW_BODY)",
    "# 先读取 /client/v1/capabilities，再通过 /client/v1/effect-runs 提交；",
    "# 客户实例主动拉取 /client/v1/deliveries，落库 diagnostic_evidence(live) 后 ACK。"
  ].join("\\n");
}

function closeModal() { document.getElementById("modal-root").innerHTML = ""; }
function openModal({ title, description = "", content, footer, wide = false }) {
  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><div class="modal-body">${content}</div><footer class="modal-footer">${footer}</footer></section></div>`;
}

function openAdminTokenModal() {
  openModal({
    title: "中央运营登录",
    description: "使用命名管理员账号登录；密码和动态验证码只提交到同源中央服务。",
    content: `<form id="relay-admin-auth-form" class="form-grid"><div class="field full"><label for="relay-admin-username">管理员账号 <em>*</em></label><input id="relay-admin-username" name="username" autocomplete="username" required placeholder="例如：admin.ops" /></div><div class="field full"><label for="relay-admin-password">密码 <em>*</em></label><input id="relay-admin-password" name="password" type="password" autocomplete="current-password" required /></div><div class="field full"><label for="relay-admin-totp">动态验证码</label><input id="relay-admin-totp" name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="已启用 MFA 时填写 6 位验证码" /><small>会话保存在 HttpOnly、SameSite=Strict Cookie 中；高风险操作必须通过 MFA。</small></div></form><div class="notice-bar" style="margin-top:14px"><i class="notice-icon">${icon("shield")}</i><span><b>根 Token 不用于日常登录</b><small>仅在首次初始化或灾难恢复时使用，并应保存在服务器密钥管理系统中。</small></span><button class="secondary-button button-small" type="button" data-action="open-admin-bootstrap">首次初始化</button></div>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="relay-admin-auth-form">安全登录</button>`
  });
  setTimeout(() => document.getElementById("relay-admin-username")?.focus(), 30);
}

function openAdminBootstrapModal() {
  openModal({
    title: "首次初始化超级管理员",
    description: "此入口仅在管理员表为空时可执行；根 Token 只用于这一次初始化请求。",
    content: `<form id="relay-admin-bootstrap-form" class="form-grid"><div class="field full"><label>服务器根 Token <em>*</em></label><input name="token" type="password" autocomplete="off" required /></div><div class="field"><label>管理员账号 <em>*</em></label><input name="username" required pattern="[a-z0-9._-]{3,64}" placeholder="admin" /></div><div class="field"><label>姓名 <em>*</em></label><input name="displayName" required placeholder="中央平台主管" /></div><div class="field full"><label>初始密码 <em>*</em></label><input name="password" type="password" autocomplete="new-password" minlength="12" required /><small>至少 12 位，并包含大写、小写、数字、符号中的三类。初始化后请立即启用 MFA。</small></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="account-menu">返回登录</button><button class="primary-button" type="submit" form="relay-admin-bootstrap-form">创建超级管理员</button>`
  });
}

function openAdminUserModal(adminUserId = "") {
  const user = (relayRuntime.adminUsers || []).find((item) => item.adminUserId === adminUserId);
  const roles = Object.entries(adminRoleLabels).map(([value, label]) => `<option value="${value}" ${user ? user.role === value ? "selected" : "" : value === "auditor" ? "selected" : ""}>${label}</option>`).join("");
  openModal({
    title: user ? "管理管理员账号" : "添加管理员",
    description: user ? `${user.username} · 账号、角色或状态变更后会撤销其已有会话。` : "创建命名账号并分配最小必要权限。",
    content: `<form id="admin-user-form" class="form-grid"><input type="hidden" name="adminUserId" value="${escapeHtml(user?.adminUserId || "")}" />${user ? `<div class="field full"><label>管理员账号</label><input value="${escapeHtml(user.username)}" readonly /></div>` : `<div class="field full"><label>管理员账号 <em>*</em></label><input name="username" required pattern="[a-z0-9._-]{3,64}" placeholder="例如：finance.zhang" /></div>`}<div class="field"><label>姓名 <em>*</em></label><input name="displayName" required value="${escapeHtml(user?.displayName || "")}" /></div><div class="field"><label>角色 <em>*</em></label><select name="role" required>${roles}</select></div><div class="field"><label>状态</label><select name="status"><option value="active" ${user?.status !== "disabled" ? "selected" : ""}>启用</option><option value="disabled" ${user?.status === "disabled" ? "selected" : ""}>停用</option></select></div><div class="field"><label>${user ? "重置密码（留空不变）" : "初始密码 *"}</label><input name="password" type="password" autocomplete="new-password" minlength="12" ${user ? "" : "required"} /></div></form><div class="notice-bar" style="margin-top:14px"><i class="notice-icon">${icon(user?.mfaEnabled ? "shield" : "alert")}</i><span><b>${user?.mfaEnabled ? "MFA 已启用" : "MFA 尚未启用"}</b><small>账号本人登录后绑定身份验证器；高风险操作只有在当前会话通过 MFA 后才能执行。</small></span></div>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button>${user ? `<button class="secondary-button" type="button" data-action="revoke-admin-sessions" data-id="${escapeHtml(user.adminUserId)}">撤销会话</button>${user.mfaEnabled ? `<button class="danger-button" type="button" data-action="disable-admin-mfa" data-id="${escapeHtml(user.adminUserId)}">停用 MFA</button>` : ""}` : ""}<button class="primary-button" type="submit" form="admin-user-form">保存管理员</button>`,
    wide: true
  });
}

async function openAdminMfaEnrollment() {
  try {
    const result = await centralApi("/api/v1/admin/me/mfa/enroll", { method: "POST", body: {} });
    openModal({
      title: "绑定身份验证器",
      description: "请将密钥添加到身份验证器，再输入当前显示的 6 位验证码完成确认。",
      content: `<div class="notice-bar" style="margin:0"><i class="notice-icon">${icon("key")}</i><span><b>一次性 TOTP 密钥</b><small class="secret-once">${escapeHtml(result.enrollment?.secret || "")}</small><small>URI：${escapeHtml(result.enrollment?.otpauthUri || "")}</small></span><button class="secondary-button button-small" type="button" data-action="copy-code" data-code="${escapeHtml(result.enrollment?.secret || "")}">${icon("copy")}复制密钥</button></div><form id="admin-mfa-confirm-form" class="form-grid" style="margin-top:16px"><div class="field full"><label>6 位动态验证码 <em>*</em></label><input name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></div></form>`,
      footer: `<button class="secondary-button" type="button" data-action="close-modal">稍后</button><button class="primary-button" type="submit" form="admin-mfa-confirm-form">确认启用 MFA</button>`
    });
  } catch (error) {
    showToast("无法开始 MFA 绑定", error.message || "请重新登录后再试。", "error");
  }
}

function customerOptions(selected = "") { return customers.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${escapeHtml(item.name)} · 余额 ${number(item.balance)}</option>`).join(""); }

function providerCapabilityDraft(provider) {
  const snapshot = provider?.capabilitySnapshot && typeof provider.capabilitySnapshot === "object" && !Array.isArray(provider.capabilitySnapshot)
    ? provider.capabilitySnapshot
    : { version: "manual-v1", provider: "aidso", syncedAt: null, platforms: [] };
  return JSON.stringify(snapshot, null, 2);
}

function openProviderConfigModal() {
  const provider = relayRuntime.provider;
  if (!provider?.providerAccountId) {
    showToast("无法配置爱搜账号", "请先连接中央平台并确认已初始化统一爱搜账号。", "error");
    return;
  }
  openModal({
    title: "统一爱搜账号配置",
    description: "Token 只会通过受保护的管理员 API 传到中央服务，并以加密形式保存；能力与价格必须以爱搜正式合同或已验证接口结果为准。",
    content: `<form id="provider-config-form" class="form-grid"><input type="hidden" name="providerAccountId" value="${escapeHtml(provider.providerAccountId)}" /><div class="field full"><label>显示名称 <em>*</em></label><input name="displayName" required value="${escapeHtml(provider.displayName || "爱搜 GEO OpenAPI（桐灼统一账号）")}" /></div><div class="field"><label>账号状态</label><select name="status"><option value="active" ${provider.status === "active" ? "selected" : ""}>可调度</option><option value="degraded" ${provider.status === "degraded" ? "selected" : ""}>降级观察</option><option value="disabled" ${provider.status === "disabled" ? "selected" : ""}>暂停调用</option></select></div><div class="field"><label>最大并发</label><input name="maxInFlight" type="number" min="1" max="1000" value="${Number(provider.maxInFlight || 8)}" required /></div><div class="field full"><label>已核验的平台能力快照（JSON）</label><textarea name="capabilitiesJson" rows="8" spellcheck="false" required>${escapeHtml(providerCapabilityDraft(provider))}</textarea><small>从爱搜正式文档、合同或已验收接口同步后粘贴。启用“可调度”前必须至少包含一个平台、终端和模式，不能使用演示能力。</small></div><div class="field full"><label>新的 AIDSO Token</label><input name="token" type="password" autocomplete="new-password" placeholder="留空则保持当前加密 Token" /><small>当前状态：${provider.tokenConfigured ? "已配置加密 Token" : "尚未配置 Token"}。保存新 Token 后，Worker 下一次提交/轮询会自动读取新凭证，无需重启。</small></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="provider-config-form">加密保存配置</button>`,
    wide: true
  });
}

async function openPriceEditor() {
  const provider = relayRuntime.provider;
  if (!provider?.providerAccountId) {
    showToast("无法配置价格", "请先连接中央平台。", "error");
    return;
  }
  try {
    const payload = await centralApi(`/api/v1/admin/prices?providerAccountId=${encodeURIComponent(provider.providerAccountId)}`);
    const rows = Array.isArray(payload.prices) ? payload.prices.slice(0, 24) : [];
    const priceRows = rows.length
      ? rows.map((row) => `<div class="price-row"><span>${escapeHtml(row.platform)}</span><span>${escapeHtml(row.terminal)}</span><span>${escapeHtml(row.mode)}</span><span>${number(row.customerCredits)} 积分</span></div>`).join("")
      : `<p class="sub-cell">当前还没有可用价格规则。</p>`;
    openModal({
      title: "统一计费价格",
      description: "新增一条价格版本后，后续任务按新规则报价；已创建任务始终使用创建时的价格快照。",
      content: `<div class="price-matrix"><div class="price-row header"><span>平台</span><span>终端</span><span>模式</span><span>客户积分</span></div>${priceRows}</div><form id="price-rule-form" class="form-grid" style="margin-top:18px"><input type="hidden" name="providerAccountId" value="${escapeHtml(provider.providerAccountId)}" /><div class="field"><label>平台代码</label><input name="platform" required placeholder="必须与已核验能力快照一致" /></div><div class="field"><label>终端</label><select name="terminal"><option value="web">web</option><option value="mobile">mobile</option><option value="commerce">commerce</option></select></div><div class="field"><label>模式</label><input name="mode" required value="fast" placeholder="必须与已核验能力快照一致" /></div><div class="field"><label>客户积分</label><input name="customerCredits" type="number" min="1" required placeholder="按客户合同填写" /></div><div class="field"><label>预估上游积分</label><input name="estimatedUpstreamCredits" type="number" min="0" required placeholder="按爱搜实际规则填写" /></div></form>`,
      footer: `<button class="secondary-button" type="button" data-action="close-modal">关闭</button><button class="primary-button" type="submit" form="price-rule-form">发布新价格版本</button>`,
      wide: true
    });
  } catch (error) {
    showToast("读取价格失败", error.message || "无法连接中央平台。", "error");
  }
}

function openCustomerModal() {
  openModal({ title: "创建客户企业", description: "创建企业账户后，可继续签发私有化部署实例和配置服务价格。", content: `<form id="customer-form" class="form-grid"><div class="field full"><label>客户企业名称 <em>*</em></label><input name="name" required placeholder="请输入企业工商名称" /></div><div class="field"><label>商务联系人 <em>*</em></label><input name="contact" required placeholder="姓名" /></div><div class="field"><label>联系电话</label><input name="phone" placeholder="手机号或固定电话" /></div><div class="field"><label>服务套餐 <em>*</em></label><select name="plan"><option>企业标准版</option><option selected>企业专业版</option><option>定制服务</option></select></div><div class="field"><label>初始积分</label><input name="balance" type="number" min="0" value="5000" /></div><div class="field full"><label>服务备注</label><textarea name="note" placeholder="合同编号、客户需求或价格说明"></textarea><small>客户员工账号继续由私有化系统管理，这里只创建企业服务账户。</small></div></form>`, footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="customer-form">创建客户</button>`, wide: true });
}

function openPaymentOrderModal(customerId = customers[0]?.id || "") {
  if (!customers.length) {
    showToast("请先创建客户", "至少创建一个客户企业后才能创建收款订单。", "error");
    return;
  }
  openModal({
    title: "创建收款订单",
    description: "创建订单不会改变积分余额。请在财务核验实际到账后，再由授权运营人员确认入账。",
    content: `<form id="payment-order-form" class="form-grid"><input type="hidden" name="idempotencyKey" value="${escapeHtml(newIdempotencyKey("payment-order"))}" /><div class="field full"><label>客户企业 <em>*</em></label><select name="tenantId">${customerOptions(customerId)}</select></div><div class="field"><label>充值积分 <em>*</em></label><input name="credits" type="number" min="1" step="1" value="5000" required /></div><div class="field"><label>应收金额（元） <em>*</em></label><input name="amountYuan" type="number" min="0" step="0.01" value="2500" required /></div><div class="field"><label>收款渠道 <em>*</em></label><select name="paymentChannel"><option value="offline_bank">对公转账</option><option value="wechat_transfer">微信收款</option><option value="alipay_transfer">支付宝收款</option><option value="contract_grant">合同赠送</option></select></div><div class="field"><label>外部订单号</label><input name="externalOrderReference" placeholder="合同号、销售订单号或内部单号" /></div><div class="field full"><label>订单说明</label><textarea name="note" placeholder="可记录合同、报价或收款核验范围；不要粘贴支付凭证图片、银行卡号或敏感个人信息。"></textarea><small>当前未接入支付商户，不会生成支付链接或二维码。接入已签约支付商户后，才可由支付适配器安全创建在线订单。</small></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="payment-order-form">创建待核验订单</button>`,
    wide: true
  });
}

function openPaymentConfirmModal(paymentOrderId) {
  const order = (relayRuntime.paymentOrders || []).find((entry) => entry.paymentOrderId === paymentOrderId);
  if (!order || order.status !== "pending_payment") {
    showToast("订单状态已变化", "请刷新订单列表后再进行到账核验。", "error");
    loadRelayOverview({ renderAfter: true }).catch(() => {});
    return;
  }
  openModal({
    title: "核验收款并入账",
    description: "此操作会立即向不可变积分账本追加 top_up 记录；请仅在财务已核实实际到账后提交。",
    content: `<form id="payment-confirm-form" class="form-grid"><input type="hidden" name="paymentOrderId" value="${escapeHtml(order.paymentOrderId)}" /><div class="field"><label>客户</label><input readonly value="${escapeHtml(customerName(order.tenantId))}" /></div><div class="field"><label>订单金额 / 积分</label><input readonly value="${escapeHtml(`${moneyCents(order.amountCents, order.currency)} / ${number(order.credits)} 积分`)}" /></div><div class="field full"><label>实际收款流水号或合同编号 <em>*</em></label><input name="paymentReference" required maxlength="512" placeholder="银行流水号、微信/支付宝商户单号或合同编号" /><small>同一收款参考只能确认一次，系统会拒绝跨订单重复入账。</small></div><div class="field full"><label>到账核验说明 <em>*</em></label><textarea name="note" required maxlength="1000" placeholder="记录核验时间、核验人或内部凭证索引；不要粘贴银行卡号或支付凭证原文。"></textarea></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="payment-confirm-form">确认到账并追加积分</button>`,
    wide: true
  });
}

function openPaymentCancelModal(paymentOrderId) {
  const order = (relayRuntime.paymentOrders || []).find((entry) => entry.paymentOrderId === paymentOrderId);
  if (!order || order.status !== "pending_payment") {
    showToast("订单状态已变化", "只有待核验订单可以作废。", "error");
    return;
  }
  openModal({
    title: "作废待核验订单",
    description: "作废不会修改客户积分或账本；已到账订单不得在中转站直接退款。",
    content: `<form id="payment-cancel-form" class="form-grid"><input type="hidden" name="paymentOrderId" value="${escapeHtml(order.paymentOrderId)}" /><div class="notice-bar" style="margin:0"><i class="notice-icon">${icon("shield")}</i><span><b>仅作废未到账订单</b><small>${escapeHtml(order.paymentOrderId)} 当前尚未写入积分账本。外部资金退款必须在真实收款渠道或财务系统中执行和留档。</small></span></div><div class="field full"><label>作废说明 <em>*</em></label><textarea name="note" required maxlength="1000" placeholder="例如：客户取消付款、合同作废或重复订单。"></textarea></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="payment-cancel-form">确认作废</button>`,
    wide: true
  });
}

function openInvoiceRequestModal(paymentOrderId) {
  const order = (relayRuntime.paymentOrders || []).find((entry) => entry.paymentOrderId === paymentOrderId);
  const existing = (relayRuntime.invoiceRequests || []).find((entry) => entry.paymentOrderId === paymentOrderId);
  if (!order || order.status !== "paid") {
    showToast("订单尚未入账", "只有已确认到账的收款订单可以申请开票。", "error");
    return;
  }
  if (existing) {
    showToast("已有开票申请", `订单 ${paymentOrderId} 已有关联开票申请 ${existing.invoiceRequestId}。`, "error");
    return;
  }
  openModal({
    title: "创建开票申请",
    description: "开票资料将使用中央主密钥加密保存；此处登记申请，不会伪造或自动开具电子发票。",
    content: `<form id="invoice-request-form" class="form-grid"><input type="hidden" name="paymentOrderId" value="${escapeHtml(order.paymentOrderId)}" /><input type="hidden" name="idempotencyKey" value="${escapeHtml(newIdempotencyKey("invoice-request"))}" /><div class="field"><label>客户</label><input readonly value="${escapeHtml(customerName(order.tenantId))}" /></div><div class="field"><label>可开票金额</label><input readonly value="${escapeHtml(moneyCents(order.amountCents, order.currency))}" /></div><div class="field full"><label>发票抬头 <em>*</em></label><input name="billingTitle" required maxlength="512" placeholder="企业全称或个人名称" /></div><div class="field"><label>纳税人识别号</label><input name="taxId" maxlength="128" placeholder="企业开票时填写" /></div><div class="field"><label>收票联系人</label><input name="recipientName" maxlength="240" /></div><div class="field full"><label>收票邮箱</label><input name="recipientEmail" type="email" maxlength="320" placeholder="用于财务交付，不在账本或审计日志中显示" /></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="invoice-request-form">提交开票申请</button>`,
    wide: true
  });
}

function openInvoiceIssueModal(invoiceRequestId) {
  const invoice = (relayRuntime.invoiceRequests || []).find((entry) => entry.invoiceRequestId === invoiceRequestId);
  if (!invoice || invoice.status !== "requested") {
    showToast("申请状态已变化", "只有待开票申请可以登记发票号码。", "error");
    return;
  }
  openModal({
    title: "登记已开具发票",
    description: "请在已签约、合规的财税系统中完成开票后，再记录外部发票号码。",
    content: `<form id="invoice-issue-form" class="form-grid"><input type="hidden" name="invoiceRequestId" value="${escapeHtml(invoice.invoiceRequestId)}" /><div class="field"><label>开票抬头</label><input readonly value="${escapeHtml(invoice.billingTitle)}" /></div><div class="field"><label>金额</label><input readonly value="${escapeHtml(moneyCents(invoice.amountCents, invoice.currency))}" /></div><div class="field full"><label>外部发票号码 <em>*</em></label><input name="invoiceNumber" required maxlength="256" placeholder="来自真实财税系统的发票号码" /></div><div class="field full"><label>开票备注</label><textarea name="note" maxlength="1000" placeholder="可记录开票系统、交付时间或内部工单号。"></textarea></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="invoice-issue-form">登记已开票</button>`,
    wide: true
  });
}

function openInvoiceVoidModal(invoiceRequestId) {
  const invoice = (relayRuntime.invoiceRequests || []).find((entry) => entry.invoiceRequestId === invoiceRequestId);
  if (!invoice || !["requested", "issued"].includes(invoice.status)) {
    showToast("申请状态已变化", "该开票申请不能再作废。", "error");
    return;
  }
  openModal({
    title: "登记开票申请作废",
    description: invoice.status === "issued" ? "请先在真实财税系统完成红冲或作废，再在此记录审计说明。" : "此操作只作废待开票申请，不会改变已入账积分。",
    content: `<form id="invoice-void-form" class="form-grid"><input type="hidden" name="invoiceRequestId" value="${escapeHtml(invoice.invoiceRequestId)}" /><div class="field full"><label>作废说明 <em>*</em></label><textarea name="note" required maxlength="1000" placeholder="记录真实财税系统的作废/红冲单号或客户撤销原因。"></textarea></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="invoice-void-form">确认登记作废</button>`,
    wide: true
  });
}

function openInstanceModal(customerId = customers[0]?.id || "") {
  if (!customers.length) {
    showToast("请先创建客户", "至少创建一个客户企业后才能签发私有化实例凭证。", "error");
    return;
  }
  if (!capabilities.length) {
    showToast("尚未同步上游能力", "请先在上游数据源同步爱搜能力快照，再签发受限的客户实例。", "error");
    return;
  }
  const capabilityOptions = capabilities.map((platform) => {
    const terminalLabel = platform.terminals.length ? `终端：${platform.terminals.join(" / ")}` : "";
    const modeLabel = platform.modes.length ? `模式：${platform.modes.join(" / ")}` : "";
    const detail = [terminalLabel, modeLabel].filter(Boolean).join(" · ") || "由中央能力快照限制";
    return `<label class="channel-option"><input name="allowedPlatform" value="${escapeHtml(platform.code)}" type="checkbox" /><b>${escapeHtml(platform.name)}</b><small>${escapeHtml(platform.code)} · ${escapeHtml(detail)}</small></label>`;
  }).join("");
  openModal({
    title: "签发部署实例",
    description: "客户实例使用独立 HMAC 凭证连接中央中转服务；签发时明确写入允许调用的平台策略。",
    content: `<form id="instance-form" class="form-grid"><div class="field full"><label>所属客户 <em>*</em></label><select name="customerId">${customerOptions(customerId)}</select></div><div class="field full"><label>实例名称 <em>*</em></label><input name="name" required placeholder="例如：客户生产环境" /></div><div class="field"><label>预计访问域名</label><input name="domain" placeholder="geo.customer.com" /></div><div class="field"><label>实例用途</label><select name="purpose"><option>生产环境</option><option>测试环境</option><option>分公司节点</option></select></div><div class="field full"><label>允许的上游平台 <em>*</em></label><small>仅勾选已获客户授权的平台；提交后会写入实例的 capability policy，取消全部选择会被拒绝以避免生成不受限凭证。</small><div class="channel-selector">${capabilityOptions}</div></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="instance-form">签发实例凭证</button>`,
    wide: true
  });
}

function openCustomerDetail(id) {
  const customer = customerById(id);
  if (!customer) return;
  const customerInstances = instances.filter((item) => item.customerId === id);
  openModal({ title: customer.name, description: `${customer.id} · ${customer.plan}`, content: `<section class="summary-strip"><div><small>可用积分</small><strong>${number(customer.balance)}</strong><em>${customer.balance < 1000 ? "建议尽快充值" : "账户余额正常"}</em></div><div><small>本月消费</small><strong>${number(customer.spend)}</strong><em>占余额${Math.round(customer.spend / Math.max(1, customer.balance + customer.spend) * 100)}%</em></div><div><small>部署实例</small><strong>${customer.instances}</strong><em>${customerInstances.filter((item) => item.status === "online").length}个当前在线</em></div><div><small>客户状态</small><strong style="font-size:14px;margin-top:9px">${statusMeta(customer.status)[0]}</strong><em>开通于${customer.joined}</em></div></section><div class="form-grid"><div class="field"><label>商务联系人</label><input value="${escapeHtml(customer.contact)}" readonly /></div><div class="field"><label>联系电话</label><input value="${escapeHtml(customer.phone)}" readonly /></div><div class="field full"><label>最近部署实例</label><div class="attention-list">${customerInstances.map((item) => `<div class="attention-item info"><i>${icon("server")}</i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.domain)} · ${escapeHtml(item.version)} · 心跳${escapeHtml(item.heartbeat)}</small></span>${badge(item.status)}</div>`).join("") || `<div class="empty-state" style="min-height:100px"><p>暂未创建部署实例</p></div>`}</div></div></div>`, footer: `<button class="secondary-button" type="button" data-action="close-modal">关闭</button><button class="ghost-button" type="button" data-action="recharge-customer" data-id="${customer.id}">${icon("coins")}充值</button><button class="primary-button" type="button" data-action="create-instance" data-id="${customer.id}">${icon("plus")}创建实例</button>`, wide: true });
}

async function openJobDetail(id) {
  try {
    const payload = await centralApi(`/api/v1/admin/runs/${encodeURIComponent(id)}`);
    const run = payload.run;
    if (!run) throw new Error("中央任务不存在。");
    const items = Array.isArray(run.items) ? run.items : [];
    const completed = Number(run.completedItems || 0);
    const failed = Number(run.failedItems || 0);
    const total = Math.max(1, Number(run.totalItems || items.length || 1));
    const progress = Math.round((completed + failed) / total * 100);
    const retryable = items.filter((item) => ["failed", "dead_letter"].includes(item.status));
    const itemRows = items.slice(0, 50).map((item) => `<div class="attention-item ${item.status === "completed" ? "info" : "danger"}"><i>${icon(item.status === "completed" ? "check" : "alert")}</i><span><b>${escapeHtml(item.clientItemId || item.relayItemId || "任务项")}</b><small>${escapeHtml(item.platform || "—")} · ${escapeHtml(item.status || "—")} · ${escapeHtml(item.lastError?.message || item.observedAt || "")}</small></span>${badge(item.status || "unknown")}</div>`).join("");
    openModal({
      title: `任务 ${run.relayRunId}`,
      description: `${escapeHtml(run.clientRunId || "中央检测任务")} · ${escapeHtml(run.tenantName || run.tenantId || "")}`,
      content: `<section class="summary-strip"><div><small>任务状态</small><strong style="font-size:14px;margin-top:9px">${escapeHtml(statusMeta(run.status)[0])}</strong><em>${escapeHtml(shortTime(run.updatedAt))}</em></div><div><small>任务项</small><strong>${number(total)}</strong><em>完成 ${number(completed)} · 失败 ${number(failed)}</em></div><div><small>积分</small><strong>${number(run.estimatedCustomerCredits || 0)}</strong><em>冻结 ${number(run.heldCustomerCredits || 0)} · 结算 ${number(run.settledCustomerCredits || 0)}</em></div><div><small>执行进度</small><strong>${progress}%</strong><em>${escapeHtml(run.billingStatus || "—")}</em></div></section><div class="attention-list">${itemRows || `<div class="empty-state" style="min-height:120px"><p>暂无任务项明细。</p></div>`}</div>`,
      footer: `<button class="secondary-button" type="button" data-action="close-modal">关闭</button>${retryable.length ? `<button class="primary-button" type="button" data-action="retry-job" data-id="${escapeHtml(run.relayRunId)}">${icon("refresh")}重试 ${retryable.length} 项</button>` : ""}`,
      wide: true
    });
  } catch (error) {
    showToast("读取任务详情失败", error.message || "中央任务接口暂不可用。", "error");
  }
}

function attentionById(id) {
  return (relayRuntime.attention || []).find((item) => item.relayItemId === id || item.id === id);
}

function openAttentionDetail(id) {
  const item = attentionById(id) || (relayRuntime.attention || []).find((entry) => entry.relayRunId === id);
  if (!item) {
    showToast("异常任务已刷新", "该任务可能已被其他管理员处理，正在重新读取中央队列。", "error");
    loadRelayOverview({ renderAfter: true }).catch(() => {});
    return;
  }
  const needsReconciliation = item.status === "submission_uncertain";
  openModal({
    title: `人工对账 · ${item.relayItemId}`,
    description: `${item.platform || "上游任务"} · ${item.status || "待处理"} · 运行 ${item.relayRunId || "—"}`,
    content: `<div class="attention-list"><div class="attention-item danger"><i>${icon("alert")}</i><span><b>${needsReconciliation ? "提交状态需要人工确认" : "任务已进入执行死信"}</b><small>${escapeHtml(item.lastError?.message || (needsReconciliation ? "爱搜提交结果不确定，系统已停止自动重提。请根据爱搜侧记录选择退款、继续轮询或确认未受理后重提。" : "任务超过自动重试上限。可重试任务项，或让客户服务端创建新的签名运行。"))}</small></span>${badge(item.status || "attention")}</div><div class="form-grid"><div class="field full"><label>问题</label><textarea readonly>${escapeHtml(item.prompt || "")}</textarea></div><div class="field"><label>平台</label><input readonly value="${escapeHtml(item.platform || "—")}" /></div><div class="field"><label>当前上游请求 ID</label><input readonly value="${escapeHtml(item.upstreamReqId || "—")}" /></div><div class="field"><label>客户积分</label><input readonly value="${number(item.customerCredits || 0)}" /></div><div class="field"><label>最近更新时间</label><input readonly value="${escapeHtml(shortTime(item.updatedAt))}" /></div></div>${needsReconciliation ? `<form id="reconcile-form" class="form-grid"><input type="hidden" name="itemId" value="${escapeHtml(item.relayItemId)}" /><div class="field"><label>对账结论 <em>*</em></label><select name="resolution"><option value="refund">爱搜未受理，退款并终止</option><option value="confirmed_success">爱搜已受理，录入 reqId 后继续轮询</option><option value="retry">爱搜未创建任务，安全重新提交</option></select></div><div class="field"><label>爱搜 reqId</label><input name="upstreamReqId" placeholder="仅“已受理”时必填" /></div><div class="field full"><label>核查说明 <em>*</em></label><textarea name="reason" required placeholder="记录爱搜后台查询时间、工单号或核查依据。"></textarea></div></form>` : `<div class="notice-bar" style="margin-top:16px"><i class="notice-icon">${icon("database")}</i><span><b>执行死信不改变账本</b><small>安全重试只会重排该任务项；若运行已结算或退款，必须由客户实例重新授权、报价并签名提交新运行。</small></span></div>`}</div>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button>${needsReconciliation ? `<button class="primary-button" type="submit" form="reconcile-form">${icon("shield")}提交对账结论</button>` : `<button class="primary-button" type="button" data-action="retry-attention" data-id="${escapeHtml(item.relayItemId)}">${icon("refresh")}安全重试</button>`}`,
    wide: true
  });
}

function openDeadLetterDelivery(deliveryId) {
  const delivery = (relayRuntime.deadLetters || []).find((entry) => entry.deliveryId === deliveryId);
  if (!delivery) {
    showToast("交付死信已刷新", "该交付可能已经被其他管理员重新入队，正在刷新列表。", "error");
    loadRelayOverview({ renderAfter: true }).catch(() => {});
    return;
  }
  openModal({
    title: `重新入队交付 · ${delivery.deliveryId}`,
    description: `客户实例 ${delivery.instanceId} · 运行 ${delivery.relayRunId || "—"}`,
    content: `<form id="dead-delivery-requeue-form" class="form-grid"><input type="hidden" name="deliveryId" value="${escapeHtml(delivery.deliveryId)}" /><div class="notice-bar" style="margin:0"><i class="notice-icon">${icon("shield")}</i><span><b>只重新交付，不会重新检测或扣费</b><small>此操作将交付状态从 dead_letter 变为 queued，并清零交付尝试次数。客户实例收到后仍会通过本地落库和 ACK 完成闭环。</small></span></div><div class="field"><label>当前尝试次数</label><input readonly value="${number(delivery.attemptCount || 0)} / ${number(delivery.maxAttempts || 0)}" /></div><div class="field"><label>最后错误</label><input readonly value="${escapeHtml(delivery.lastError || "—")}" /></div><div class="field full"><label>重投核查说明 <em>*</em></label><textarea name="note" required placeholder="例如：客户数据库恢复完成，已由客户管理员确认可以重新落库。"></textarea></div></form>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" form="dead-delivery-requeue-form">${icon("refresh")}确认重新交付</button>`,
    wide: true
  });
}

function openInstanceDetail(id) {
  const instance = instances.find((item) => item.id === id);
  if (!instance) return;
  const customer = customerById(instance.customerId);
  openModal({
    title: `实例详情 · ${instance.id}`,
    description: `${customer?.name || "未知客户"} · ${instance.name}`,
    content: `<section class="summary-strip"><div><small>实例状态</small><strong style="font-size:14px;margin-top:9px">${statusMeta(instance.status)[0]}</strong><em>最近心跳 ${escapeHtml(instance.heartbeat)}</em></div><div><small>Client ID</small><strong style="font-size:14px;margin-top:9px">${escapeHtml(instance.domain)}</strong><em>仅用于服务端签名</em></div><div><small>密钥版本</small><strong>${escapeHtml(instance.version)}</strong><em>可轮换旧密钥</em></div><div><small>已知运行</small><strong>${number(instance.calls)}</strong><em>中央运行表记录</em></div></section><div class="attention-list"><div class="attention-item info"><i>${icon("shield")}</i><span><b>密钥不会显示在浏览器</b><small>轮换后只在一次性响应中返回新的 Client Secret，请交付到客户服务器后端。</small></span></div></div>`,
    footer: `<button class="secondary-button" type="button" data-action="close-modal">关闭</button>${instance.rawStatus === "active" ? `<button class="secondary-button" type="button" data-action="instance-status" data-id="${escapeHtml(instance.id)}" data-status="suspended">暂停实例</button>` : instance.rawStatus === "suspended" ? `<button class="secondary-button" type="button" data-action="instance-status" data-id="${escapeHtml(instance.id)}" data-status="active">恢复实例</button>` : ""}${instance.rawStatus !== "revoked" ? `<button class="danger-button" type="button" data-action="revoke-instance" data-id="${escapeHtml(instance.id)}">吊销实例</button><button class="primary-button" type="button" data-action="rotate-secret" data-id="${escapeHtml(instance.id)}">${icon("refresh")}轮换密钥</button>` : `<span class="status-badge danger">已永久吊销</span>`}`,
    wide: true
  });
}

async function rotateInstanceSecret(id) {
  const instance = instances.find((item) => item.id === id);
  if (!instance) return;
  if (!window.confirm(`确认轮换实例 ${id} 的 Client Secret？旧密钥会立即吊销。`)) return;
  try {
    const result = await centralApi(`/api/v1/admin/instances/${encodeURIComponent(id)}/rotate-secret`, { method: "POST", body: { reason: "operator-ui" } });
    closeModal();
    await loadRelayOverview({ renderAfter: false });
    openModal({ title: "实例密钥已轮换", description: `${instance.name} · 请只保存到客户服务器后端`, content: `<div class="notice-bar" style="margin:0"><i class="notice-icon">${icon("key")}</i><span><b>Client ID</b><small>${escapeHtml(result.instance?.clientId || instance.domain || "—")}</small><b style="margin-top:10px">新的 Client Secret</b><small class="secret-once">${escapeHtml(result.clientSecret || "")}</small></span><button class="secondary-button button-small" type="button" data-action="copy-code" data-code="${escapeHtml(result.clientSecret || "")}">${icon("copy")}复制密钥</button></div><div class="attention-list" style="margin-top:15px"><div class="attention-item info"><i>${icon("shield")}</i><span><b>旧密钥已吊销</b><small>客户实例需要立即更新服务端凭证；浏览器不会保存新的密钥。</small></span></div></div>`, footer: `<button class="primary-button" type="button" data-action="close-modal">完成</button>` });
    render();
  } catch (error) {
    showToast("密钥轮换失败", error.message || "中央实例凭证接口暂不可用。", "error");
  }
}

async function changeInstanceStatus(id, status) {
  const instance = instances.find((item) => item.id === id);
  if (!instance) return;
  const actionLabel = status === "revoked" ? "永久吊销" : status === "suspended" ? "暂停" : "恢复";
  if (!window.confirm(`确认${actionLabel}实例 ${id}？${status === "revoked" ? "吊销后该实例的签名请求会立即失效。" : ""}`)) return;
  try {
    const path = status === "revoked" ? `/api/v1/admin/instances/${encodeURIComponent(id)}/revoke` : `/api/v1/admin/instances/${encodeURIComponent(id)}/status`;
    await centralApi(path, { method: "POST", body: status === "revoked" ? { reason: "operator-ui" } : { status } });
    closeModal();
    await loadRelayOverview({ renderAfter: true });
    showToast(`实例已${actionLabel}`, status === "active" ? "客户服务端可以继续使用当前有效密钥签名调用。" : "中央鉴权状态已立即更新并写入审计记录。", "success");
  } catch (error) {
    showToast(`${actionLabel}失败`, error.message || "中央实例状态接口暂不可用。", "error");
  }
}

function exportLiveData(kind) {
  const rows = kind === "customers"
    ? [["客户 ID", "客户名称", "状态", "可用积分", "实例数", "任务结算积分", "创建时间"], ...customers.map((item) => [item.id, item.name, item.status, item.balance, item.instances, item.spend, item.joined])]
    : kind === "ledger"
      ? [["流水 ID", "客户 ID", "类型", "可用积分变动", "变动后余额", "说明", "时间"], ...transactions.map((item) => [item.id, item.customerId, item.type, item.amount, item.balance, item.note, item.time])]
      : [["日期", "客户结算积分", "上游成本积分", "毛利积分"], ...(relayRuntime.analytics?.series || []).map((row) => [row.day || row.label, row.customerSettledCredits || 0, row.upstreamCostCredits || 0, Number(row.customerSettledCredits || 0) - Number(row.upstreamCostCredits || 0)])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tongzhuo-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("导出已完成", `已将当前中央 API 数据导出为 ${link.download}。`, "success");
}

async function retryRun(runId) {
  const detail = await centralApi(`/api/v1/admin/runs/${encodeURIComponent(runId)}`);
  const items = Array.isArray(detail.run?.items) ? detail.run.items : [];
  const retryable = items.filter((item) => ["failed", "dead_letter"].includes(item.status));
  if (!retryable.length) throw new Error("该运行没有可安全重试的任务项；提交不确定项请先完成人工对账。 ");
  if (["held", "awaiting_reconciliation"].includes(detail.run?.billingStatus)) {
    for (const item of retryable) {
      await centralApi(`/api/v1/admin/items/${encodeURIComponent(item.relayItemId)}/retry`, { method: "POST", body: {} });
    }
    await loadRelayOverview({ renderAfter: true });
    showToast("任务已重新排队", `${retryable.length} 个失败任务项已通过中央 API 重新排队。`, "success");
    return;
  }
  throw new Error("该运行已经结算或退款，中央后台不能代替客户实例重新提交。请由对应客户服务端完成授权、报价并使用实例签名创建新的运行。");
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === "relay-admin-auth-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const response = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
          totp: data.get("totp")
        }),
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      form.reset();
      if (!response.ok) throw new Error(payload?.error?.message || `登录失败（HTTP ${response.status}）`);
      relayRuntime.adminSession = payload;
      relayRuntime.authPrompted = false;
      closeModal();
      const connected = await loadRelayOverview({ renderAfter: true });
      if (connected) showToast("已安全登录中央平台", "已建立短期服务端会话；客户、实例、任务、账本和上游状态均来自中央 API。", "success");
      else showToast("会话已建立但读取失败", "请检查中转服务状态后重试。", "error");
    } catch (error) {
      form.reset();
      relayRuntime.authPrompted = false;
      showToast("管理员登录失败", error.message || "请检查账号、密码和动态验证码。", "error");
    }
    return;
  }
  if (form.id === "relay-admin-bootstrap-form") {
    event.preventDefault();
    const data = new FormData(form);
    const token = String(data.get("token") || "").trim();
    try {
      const response = await fetch("/api/v1/admin/bootstrap", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: data.get("username"), displayName: data.get("displayName"), password: data.get("password") }),
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      form.reset();
      if (!response.ok) throw new Error(payload?.error?.message || `初始化失败（HTTP ${response.status}）`);
      openAdminTokenModal();
      showToast("超级管理员已创建", "请使用命名账号登录，并立即绑定身份验证器。", "success");
    } catch (error) {
      form.reset();
      showToast("管理员初始化失败", error.message || "请确认根 Token 和账号信息。", "error");
    }
    return;
  }
  if (form.id === "admin-user-form") {
    event.preventDefault();
    const data = new FormData(form);
    const adminUserId = String(data.get("adminUserId") || "");
    const password = String(data.get("password") || "");
    try {
      if (adminUserId) {
        await centralApi(`/api/v1/admin/users/${encodeURIComponent(adminUserId)}`, {
          method: "PATCH",
          body: { displayName: data.get("displayName"), role: data.get("role"), status: data.get("status") }
        });
        if (password) await centralApi(`/api/v1/admin/users/${encodeURIComponent(adminUserId)}/password`, { method: "POST", body: { password } });
      } else {
        await centralApi("/api/v1/admin/users", {
          method: "POST",
          body: { username: data.get("username"), displayName: data.get("displayName"), role: data.get("role"), status: data.get("status"), password }
        });
      }
      closeModal();
      const users = await centralApi("/api/v1/admin/users");
      relayRuntime.adminUsers = users.users || [];
      render();
      showToast("管理员账号已保存", adminUserId ? "账号变更已生效，必要时已有会话已撤销。" : "新管理员可以使用命名账号登录。", "success");
    } catch (error) {
      showToast("管理员保存失败", error.message || "请检查角色、状态和密码要求。", "error");
    }
    return;
  }
  if (form.id === "admin-mfa-confirm-form") {
    event.preventDefault();
    const totp = String(new FormData(form).get("totp") || "");
    try {
      await centralApi("/api/v1/admin/me/mfa/confirm", { method: "POST", body: { totp } });
      relayRuntime.adminSession = await centralApi("/api/v1/admin/session");
      const users = await centralApi("/api/v1/admin/users").catch(() => ({ users: [] }));
      relayRuntime.adminUsers = users.users || [];
      closeModal();
      render();
      showToast("MFA 已启用", "当前会话已完成 MFA 验证，可以执行获准的高风险操作。", "success");
    } catch (error) {
      showToast("MFA 确认失败", error.message || "请使用身份验证器中当前显示的 6 位验证码。", "error");
    }
    return;
  }
  if (form.id === "provider-config-form") {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      providerAccountId: data.get("providerAccountId"),
      providerCode: "aidso",
      displayName: data.get("displayName"),
      status: data.get("status"),
      isDefault: true,
      maxInFlight: Number(data.get("maxInFlight") || 8)
    };
    try {
      body.capabilities = JSON.parse(String(data.get("capabilitiesJson") || ""));
      const platforms = Array.isArray(body.capabilities?.platforms) ? body.capabilities.platforms : [];
      const completePlatform = platforms.some((platform) => platform
        && String(platform.code || "").trim()
        && Array.isArray(platform.terminals) && platform.terminals.length
        && Array.isArray(platform.modes) && platform.modes.length);
      if (body.status === "active" && !completePlatform) {
        throw new Error("启用可调度账号前，必须保存至少一个包含平台代码、终端和模式的已核验能力快照。");
      }
    } catch (error) {
      showToast("能力快照无效", error.message || "请填写有效的能力 JSON。", "error");
      return;
    }
    const token = String(data.get("token") || "").trim();
    if (token) {
      body.token = token;
      body.tokenReference = `operator-ui:${new Date().toISOString()}`;
    }
    try {
      await centralApi("/api/v1/admin/providers/aidso", { method: "POST", body });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("爱搜账号配置已保存", "统一账号已加密写入中央中转站；Worker 会自动使用最新凭证。", "success");
    } catch (error) {
      showToast("爱搜账号配置失败", error.message || "无法保存中央账号配置。", "error");
    }
    return;
  }
  if (form.id === "price-rule-form") {
    event.preventDefault();
    const data = new FormData(form);
    const platform = String(data.get("platform") || "").trim().toUpperCase();
    const terminal = String(data.get("terminal") || "web").trim().toLowerCase();
    const mode = String(data.get("mode") || "fast").trim().toLowerCase();
    try {
      const result = await centralApi("/api/v1/admin/prices", {
        method: "POST",
        body: {
          providerAccountId: data.get("providerAccountId"),
          platform,
          terminal,
          mode,
          customerCredits: Number(data.get("customerCredits") || 0),
          estimatedUpstreamCredits: Number(data.get("estimatedUpstreamCredits") || 0),
          version: `operator-${Date.now()}`,
          status: "active",
          metadata: { source: "central-operator-ui" }
        }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("价格版本已发布", `${platform}/${terminal}/${mode} 当前客户积分为 ${number(result.price?.customerCredits || 0)}。`, "success");
    } catch (error) {
      showToast("价格发布失败", error.message || "无法保存价格规则。", "error");
    }
    return;
  }
  if (form.id === "customer-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await centralApi("/api/v1/admin/tenants", {
        method: "POST",
        body: {
          displayName: data.get("name"),
          initialCredits: Number(data.get("balance") || 0),
          metadata: { plan: data.get("plan"), contact: data.get("contact"), phone: data.get("phone") || "" }
        }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("客户已创建", `${data.get("name")}已写入中央中转平台，可继续签发私有化实例。`);
    } catch (error) {
      showToast("创建客户失败", error.message || "中央中转服务暂不可用。", "error");
    }
    return;
  }
  if (form.id === "payment-order-form") {
    event.preventDefault();
    const data = new FormData(form);
    const amountYuan = Number(data.get("amountYuan"));
    const paymentChannel = String(data.get("paymentChannel") || "").trim();
    const amountCents = Math.round(amountYuan * 100);
    if (!Number.isFinite(amountYuan) || amountYuan < 0 || !Number.isSafeInteger(amountCents)) {
      showToast("订单金额无效", "请输入不小于 0 的金额，最多保留两位小数。", "error");
      return;
    }
    if (paymentChannel !== "contract_grant" && amountCents <= 0) {
      showToast("订单金额无效", "实际收款订单金额必须大于 0。", "error");
      return;
    }
    try {
      const result = await centralApi("/api/v1/admin/payment-orders", {
        method: "POST",
        body: {
          tenantId: data.get("tenantId"),
          idempotencyKey: data.get("idempotencyKey"),
          paymentChannel,
          amountCents,
          currency: "CNY",
          credits: Number(data.get("credits") || 0),
          externalOrderReference: String(data.get("externalOrderReference") || "").trim(),
          metadata: { note: String(data.get("note") || "").trim(), source: "central-operator-ui" }
        }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast(result.created ? "收款订单已创建" : "收款订单已存在", "订单尚未入账，请在财务核验实际到账后执行“核验到账”。", "success");
    } catch (error) {
      showToast("创建收款订单失败", error.message || "中央收款订单接口暂不可用。", "error");
    }
    return;
  }
  if (form.id === "payment-confirm-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = await centralApi(`/api/v1/admin/payment-orders/${encodeURIComponent(String(data.get("paymentOrderId") || ""))}/confirm`, {
        method: "POST",
        body: { paymentReference: String(data.get("paymentReference") || "").trim(), note: String(data.get("note") || "").trim() }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast(result.idempotent ? "订单已确认" : "到账已核验并入账", `${number(result.order?.credits || 0)} 积分已追加到客户不可变账本。`, "success");
    } catch (error) {
      showToast("到账核验失败", error.message || "请检查订单状态和收款参考是否重复。", "error");
    }
    return;
  }
  if (form.id === "payment-cancel-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await centralApi(`/api/v1/admin/payment-orders/${encodeURIComponent(String(data.get("paymentOrderId") || ""))}/cancel`, {
        method: "POST",
        body: { note: String(data.get("note") || "").trim() }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("待核验订单已作废", "该操作未更改客户积分或账本。", "success");
    } catch (error) {
      showToast("作废订单失败", error.message || "已到账订单必须由实际财务渠道退款。", "error");
    }
    return;
  }
  if (form.id === "invoice-request-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = await centralApi("/api/v1/admin/invoice-requests", {
        method: "POST",
        body: {
          paymentOrderId: String(data.get("paymentOrderId") || "").trim(),
          idempotencyKey: String(data.get("idempotencyKey") || "").trim(),
          billingTitle: String(data.get("billingTitle") || "").trim(),
          taxId: String(data.get("taxId") || "").trim(),
          recipientName: String(data.get("recipientName") || "").trim(),
          recipientEmail: String(data.get("recipientEmail") || "").trim(),
          metadata: { source: "central-operator-ui" }
        }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast(result.created ? "开票申请已创建" : "开票申请已存在", "请在合规财税系统完成开票后登记真实发票号码。", "success");
    } catch (error) {
      showToast("创建开票申请失败", error.message || "请确认订单已到账且未重复申请。", "error");
    }
    return;
  }
  if (form.id === "invoice-issue-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await centralApi(`/api/v1/admin/invoice-requests/${encodeURIComponent(String(data.get("invoiceRequestId") || ""))}/issue`, {
        method: "POST",
        body: { invoiceNumber: String(data.get("invoiceNumber") || "").trim(), note: String(data.get("note") || "").trim() }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("已登记发票号码", "中央后台已保留开票审计记录。", "success");
    } catch (error) {
      showToast("登记开票失败", error.message || "请检查发票号码和申请状态。", "error");
    }
    return;
  }
  if (form.id === "invoice-void-form") {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await centralApi(`/api/v1/admin/invoice-requests/${encodeURIComponent(String(data.get("invoiceRequestId") || ""))}/void`, {
        method: "POST",
        body: { note: String(data.get("note") || "").trim() }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("已登记作废", "此操作不改变客户积分；已开票项目应先在真实财税系统完成对应处理。", "success");
    } catch (error) {
      showToast("登记作废失败", error.message || "请检查开票申请状态。", "error");
    }
    return;
  }
  // Retained only to make stale browser pages fail closed. Direct crediting
  // from a browser form is retired in favour of the payment-order workflow.
  if (false && form.id === "recharge-form") {
    event.preventDefault();
    const data = new FormData(form); const customer = customerById(data.get("customerId")); const credits = Number(data.get("credits") || 0);
    if (!customer || credits <= 0) return;
    const externalId = String(data.get("externalId") || `topup-ui-${Date.now()}`).trim();
    const amount = Number(data.get("amount") || 0);
    const method = String(data.get("method") || "manual").trim();
    const note = String(data.get("note") || "").trim();
    try {
      await centralApi(`/api/v1/admin/tenants/${encodeURIComponent(customer.id)}/credits`, {
        method: "POST",
        body: { credits, entryType: "top_up", idempotencyKey: `topup:${externalId}`, note: `${externalId} · ${method} · 实收 ${amount} 元${note ? ` · ${note}` : ""}` }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("充值已入账", `${customer.name}增加${number(credits)}积分，中央账本已更新。`);
    } catch (error) {
      showToast("充值失败", error.message || "中央中转服务暂不可用。", "error");
    }
    return;
  }
  if (form.id === "settings-form") {
    event.preventDefault();
    const body = {};
    for (const [name, value] of new FormData(form).entries()) {
      const [section, key] = String(name).split(".");
      if (!section || !key) continue;
      body[section] ||= {};
      body[section][key] = value;
    }
    form.querySelectorAll('input[type="checkbox"][name]').forEach((input) => {
      const [section, key] = String(input.name).split(".");
      if (!section || !key) return;
      body[section] ||= {};
      body[section][key] = input.checked;
    });
    for (const section of Object.keys(body)) {
      for (const key of Object.keys(body[section])) {
        if (["rawResponseRetentionDays", "ledgerRetentionDays", "priceSnapshotTtlMinutes"].includes(key)) body[section][key] = Number(body[section][key]);
      }
    }
    try {
      const result = await centralApi("/api/v1/admin/settings", { method: "PUT", body });
      relayRuntime.settings = result.settings || body;
      render();
      showToast("设置已保存", "新的服务规则已写入中央数据库，并生成审计事件。", "success");
    } catch (error) {
      showToast("设置保存失败", error.message || "中央设置接口暂不可用。", "error");
    }
    return;
  }
  if (form.id === "instance-form") {
    event.preventDefault();
    const data = new FormData(form);
    const customer = customerById(data.get("customerId"));
    const requestedPlatforms = data.getAll("allowedPlatform").map((value) => String(value || "").trim()).filter(Boolean);
    const capabilityByCode = new Map(capabilities.map((entry) => [entry.code, entry]));
    const allowedPlatforms = [...new Set(requestedPlatforms)];
    if (!customer) {
      showToast("客户不存在", "请刷新客户列表后重新签发实例凭证。", "error");
      return;
    }
    if (!allowedPlatforms.length) {
      showToast("请至少选择一个平台", "空 capability policy 会扩大实例权限，中央后台已拒绝签发。", "error");
      return;
    }
    if (allowedPlatforms.some((code) => !capabilityByCode.has(code))) {
      showToast("能力快照已变更", "请选择当前已同步的上游平台后重新签发。", "error");
      return;
    }
    const allowedItems = allowedPlatforms.flatMap((platform) => {
      const entry = capabilityByCode.get(platform);
      const terminals = Array.isArray(entry?.terminals) ? entry.terminals : [];
      const modes = Array.isArray(entry?.modes) ? entry.modes : [];
      if (!terminals.length || !modes.length) return [];
      return terminals.flatMap((terminal) => modes.map((mode) => ({ platform, terminal, mode })));
    });
    try {
      const result = await centralApi("/api/v1/admin/instances", {
        method: "POST",
        body: {
          tenantId: data.get("customerId"),
          displayName: data.get("name"),
          metadata: { domain: data.get("domain") || "", purpose: data.get("purpose") || "生产环境" },
          allowedCapabilities: {
            allowedPlatforms,
            ...(allowedItems.length ? { items: allowedItems } : {})
          }
        }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: false });
      const instance = result.instance || {};
      const clientSecret = result.clientSecret || "";
      openModal({ title: "私有化实例凭证已签发", description: `${customer?.name || "客户"} · 请只保存到客户服务器后端`, content: `<div class="notice-bar" style="margin:0"><i class="notice-icon">${icon("key")}</i><span><b>Client ID</b><small>${escapeHtml(instance.clientId || "—")}</small><b style="margin-top:10px">Client Secret</b><small class="secret-once">${escapeHtml(clientSecret)}</small></span><button class="secondary-button button-small" type="button" data-action="copy-code" data-code="${escapeHtml(clientSecret)}">${icon("copy")}复制密钥</button></div><div class="attention-list" style="margin-top:15px"><div class="attention-item info"><i>${icon("shield")}</i><span><b>此密钥只显示一次</b><small>客户实例用它生成 HMAC 签名；不要写入浏览器、日志或企业知识库。</small></span></div></div>`, footer: `<button class="primary-button" type="button" data-action="close-modal">完成</button>` });
      render();
    } catch (error) {
      showToast("签发实例失败", error.message || "中央中转服务暂不可用。", "error");
    }
    return;
  }
  if (form.id === "reconcile-form") {
    event.preventDefault();
    const data = new FormData(form);
    const itemId = String(data.get("itemId") || "").trim();
    const resolution = String(data.get("resolution") || "refund").trim();
    const note = String(data.get("reason") || "").trim();
    const upstreamReqId = String(data.get("upstreamReqId") || "").trim();
    if (!note) {
      showToast("需要核查说明", "请记录爱搜侧的核查依据后再提交对账。", "error");
      return;
    }
    if (resolution === "confirmed_success" && !upstreamReqId) {
      showToast("需要爱搜 reqId", "确认爱搜已受理时，必须录入对应的上游 reqId，系统才能安全继续轮询。", "error");
      return;
    }
    try {
      const result = await centralApi(`/api/v1/admin/items/${encodeURIComponent(itemId)}/reconcile`, {
        method: "POST",
        body: { resolution, note, ...(upstreamReqId ? { upstreamReqId } : {}) }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      const message = resolution === "refund"
        ? `${itemId} 已退款并生成审计记录。`
        : resolution === "confirmed_success"
          ? `${itemId} 已关联爱搜 reqId，Worker 将继续轮询结果。`
          : `${itemId} 已确认上游未建单，安全重新进入提交队列。`;
      showToast("人工对账已完成", message, "success");
    } catch (error) {
      showToast("人工对账失败", error.message || "中央对账接口暂不可用。", "error");
    }
    return;
  }
  if (form.id === "dead-delivery-requeue-form") {
    event.preventDefault();
    const data = new FormData(form);
    const deliveryId = String(data.get("deliveryId") || "").trim();
    const note = String(data.get("note") || "").trim();
    if (!note) {
      showToast("需要核查说明", "请记录客户实例恢复或重投依据。", "error");
      return;
    }
    try {
      await centralApi(`/api/v1/admin/deliveries/${encodeURIComponent(deliveryId)}/requeue`, {
        method: "POST",
        body: { note }
      });
      closeModal();
      await loadRelayOverview({ renderAfter: true });
      showToast("交付已重新入队", `${deliveryId} 将再次交付给原客户实例。`, "success");
    } catch (error) {
      showToast("重新交付失败", error.message || "中央交付接口暂不可用。", "error");
    }
    return;
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-route-link], [data-chart-period], [data-settings-tab]");
  if (!target) return;
  if (target.dataset.routeLink) { location.hash = target.dataset.routeLink; return; }
  if (target.dataset.chartPeriod) {
    ui.chartPeriod = target.dataset.chartPeriod;
    try {
      relayRuntime.analytics = await centralApi(`/api/v1/admin/analytics?days=${encodeURIComponent(ui.chartPeriod)}`);
      render();
      showToast("统计周期已切换", `已从中央账本读取最近${ui.chartPeriod}天的真实经营数据。`, "success");
    } catch (error) {
      showToast("统计周期切换失败", error.message || "经营分析接口暂不可用。", "error");
    }
    return;
  }
  if (target.dataset.settingsTab) { ui.settingsTab = target.dataset.settingsTab; render(); return; }
  const action = target.dataset.action;
  if (action === "open-sidebar") document.body.classList.add("sidebar-open");
  if (action === "close-sidebar") document.body.classList.remove("sidebar-open");
  if (action === "close-modal") closeModal();
  if (action === "modal-backdrop" && event.target === target) closeModal();
  if (action === "open-customer") openCustomerModal();
  if (action === "open-recharge") openPaymentOrderModal();
  if (action === "confirm-payment-order") openPaymentConfirmModal(target.dataset.id);
  if (action === "cancel-payment-order") openPaymentCancelModal(target.dataset.id);
  if (action === "open-invoice-request") openInvoiceRequestModal(target.dataset.id);
  if (action === "issue-invoice") openInvoiceIssueModal(target.dataset.id);
  if (action === "void-invoice") openInvoiceVoidModal(target.dataset.id);
  if (action === "open-instance") openInstanceModal();
  if (action === "retry-overview") { loadRelayOverview({ renderAfter: true }).then(() => showToast("中央数据已刷新", "已重新读取生产 API。", "success")).catch(() => {}); }
  if (action === "customer-detail") openCustomerDetail(target.dataset.id);
  if (action === "recharge-customer") { closeModal(); openPaymentOrderModal(target.dataset.id); }
  if (action === "create-instance") { closeModal(); openInstanceModal(target.dataset.id); }
  if (action === "job-detail") openJobDetail(target.dataset.id);
  if (action === "open-attention") openAttentionDetail(target.dataset.id || target.dataset.runId);
  if (action === "open-dead-delivery") openDeadLetterDelivery(target.dataset.id);
  if (action === "instance-detail") openInstanceDetail(target.dataset.id);
  if (action === "rotate-secret") rotateInstanceSecret(target.dataset.id);
  if (action === "instance-status") await changeInstanceStatus(target.dataset.id, target.dataset.status);
  if (action === "revoke-instance") await changeInstanceStatus(target.dataset.id, "revoked");
  if (action === "retry-job") { retryRun(target.dataset.id).catch((error) => showToast("任务重试失败", error.message || "中央重试接口暂不可用。", "error")); }
  if (action === "retry-attention") { const id = target.dataset.id; centralApi(`/api/v1/admin/items/${encodeURIComponent(id)}/retry`, { method: "POST", body: {} }).then(async () => { closeModal(); await loadRelayOverview({ renderAfter: true }); showToast("任务项已安全重试", `${id} 已重新进入 Worker 队列。`, "success"); }).catch((error) => { if (error.code === "RELAY_RETRY_REQUIRES_NEW_RUN") { closeModal(); showToast("需要客户实例重新提交", "该运行已经结算或退款。中央后台不能绕过实例签名创建新任务，请由客户服务端重新授权、报价并提交。", "error"); } else showToast("任务项重试失败", error.message || "该项可能需要先退款对账。", "error"); }); }
  if (action === "refresh-jobs") { loadRelayOverview({ renderAfter: true }).then(() => showToast("任务队列已刷新", "已从中央中转服务读取最新任务、结算和交付状态。")).catch(() => {}); }
  if (action === "test-provider") { centralApi("/api/v1/admin/providers/aidso/test", { method: "POST", body: {} }).then(async (result) => { await loadRelayOverview({ renderAfter: true }); showToast("爱搜适配器状态", result.message || "上游适配器可用。", result.status === "healthy" || result.status === "mock" ? "success" : "error"); }).catch((error) => showToast("爱搜适配器不可用", error.message || "请求失败。", "error")); }
  if (action === "provider-config") openProviderConfigModal();
  if (action === "copy-code" || action === "copy-install-command") {
    const value = action === "copy-code" ? target.dataset.code : clientInstallInstructions();
    const title = action === "copy-code" ? "实例密钥已复制" : "客户接入说明已复制";
    const message = action === "copy-code"
      ? "密钥已复制到系统剪贴板，请立即保存到客户服务器的密钥管理系统。"
      : "已复制仅包含服务端接入步骤的说明，不包含管理员或客户密钥。";
    copyTextToClipboard(value)
      .then(() => showToast(title, message, "success"))
      .catch((error) => showToast("复制失败", error.message || "浏览器未允许写入剪贴板。", "error"));
  }
  if (["export-customers", "export-ledger", "export-analytics"].includes(action)) exportLiveData(action.replace("export-", ""));
  if (action === "edit-prices") openPriceEditor();
  if (action === "open-admin-bootstrap") openAdminBootstrapModal();
  if (action === "open-admin-user") openAdminUserModal();
  if (action === "edit-admin-user") openAdminUserModal(target.dataset.id);
  if (action === "setup-admin-mfa") openAdminMfaEnrollment();
  if (action === "refresh-admin-users") {
    centralApi("/api/v1/admin/users").then((data) => {
      relayRuntime.adminUsers = data.users || [];
      render();
      showToast("管理员列表已刷新", "已读取最新账号、角色和 MFA 状态。", "success");
    }).catch((error) => showToast("管理员列表刷新失败", error.message || "当前账号无权读取管理员列表。", "error"));
  }
  if (action === "revoke-admin-sessions") {
    if (!window.confirm("确认撤销该管理员的全部活动会话？")) return;
    centralApi(`/api/v1/admin/users/${encodeURIComponent(target.dataset.id)}/sessions/revoke`, { method: "POST", body: { reason: "operator-ui" } })
      .then(() => { closeModal(); showToast("会话已撤销", "该管理员需要重新登录。", "success"); })
      .catch((error) => showToast("撤销失败", error.message || "高风险操作需要 MFA。", "error"));
  }
  if (action === "disable-admin-mfa") {
    if (!window.confirm("确认停用该管理员的 MFA？该账号全部会话会同时撤销。")) return;
    centralApi(`/api/v1/admin/users/${encodeURIComponent(target.dataset.id)}/mfa/disable`, { method: "POST", body: {} })
      .then(async () => {
        closeModal();
        const data = await centralApi("/api/v1/admin/users");
        relayRuntime.adminUsers = data.users || [];
        render();
        showToast("MFA 已停用", "该管理员全部会话已撤销，重新登录后应尽快重新绑定。", "success");
      })
      .catch((error) => showToast("停用 MFA 失败", error.message || "高风险操作需要 MFA。", "error"));
  }
  if (action === "save-settings") document.querySelector("#settings-form")?.requestSubmit();
  if (action === "refresh-settings") { loadRelayOverview({ renderAfter: true }).then(() => showToast("审计已刷新", "已读取中央管理员审计事件。", "success")).catch(() => {}); }
  if (action === "refresh-analytics") { centralApi(`/api/v1/admin/analytics?days=${encodeURIComponent(ui.chartPeriod)}`).then((data) => { relayRuntime.analytics = data; render(); showToast("经营数据已刷新", "收入、成本和毛利已重新读取中央账本。", "success"); }).catch((error) => showToast("经营数据刷新失败", error.message || "分析接口暂不可用。", "error")); }
  if (action === "toggle") target.classList.toggle("on");
  if (action === "show-notifications") {
    const attentionCount = Number(relayRuntime.summary?.attentionItems || relayRuntime.attention?.length || 0);
    showToast(attentionCount ? `${attentionCount} 项需要人工处理` : "暂无待处理事项", attentionCount ? "请在查询任务中完成异常对账或退款。" : "当前中央任务、账本和上游状态没有待处理告警。", attentionCount ? "error" : "success");
  }
  if (action === "account-menu") {
    if (!relayRuntime.connected || !relayRuntime.adminSession?.authenticated) openAdminTokenModal();
    else openModal({
      title: "中央运营会话",
      description: relayRuntime.adminSession?.emergency ? "当前为根凭证换取的应急会话，请完成处置后立即退出。" : "当前浏览器使用命名账号的服务端短期会话。",
      content: `<div class="attention-list"><div class="attention-item ${relayRuntime.adminSession?.emergency ? "danger" : "info"}"><i>${icon("shield")}</i><span><b>${escapeHtml(relayRuntime.adminSession?.displayName || relayRuntime.adminSession?.username || "应急管理员")}</b><small>${escapeHtml(adminRoleLabels[relayRuntime.adminSession?.role] || relayRuntime.adminSession?.role || "应急权限")} · ${relayRuntime.adminSession?.mfaVerified ? "MFA 已验证" : "MFA 未验证"} · 会话于 ${escapeHtml(shortTime(relayRuntime.adminSession?.expiresAt) || "服务端有效期")} 失效</small></span></div></div>`,
      footer: `<button class="secondary-button" type="button" data-action="relay-admin-logout">退出登录</button>${relayRuntime.adminSession?.adminUserId && !relayRuntime.adminSession?.mfaVerified ? `<button class="secondary-button" type="button" data-action="setup-admin-mfa">绑定 MFA</button>` : ""}<button class="primary-button" type="button" data-action="relay-admin-change">切换账号</button>`
    });
  }
  if (action === "relay-admin-change") { closeModal(); openAdminTokenModal(); }
  if (action === "relay-admin-logout") {
    centralApi("/api/v1/admin/session", { method: "DELETE" })
      .catch(() => {})
      .finally(() => {
        relayRuntime.adminSession = null;
        relayRuntime.connected = false;
        relayRuntime.authRequired = true;
        relayRuntime.authPrompted = false;
        closeModal();
        syncRelayChrome();
        openAdminTokenModal();
      });
  }
  if (action === "focus-search") { const input = document.querySelector(".filter-search input"); if (input) input.focus(); else { location.hash = "customers"; setTimeout(() => document.getElementById("customer-search")?.focus(), 30); } }
});

document.addEventListener("submit", handleSubmit);
document.addEventListener("input", (event) => {
  if (event.target.id === "customer-search") { ui.customerSearch = event.target.value; render(); document.getElementById("customer-search")?.focus(); }
  if (event.target.id === "job-search") { ui.jobSearch = event.target.value; render(); document.getElementById("job-search")?.focus(); }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "customer-status") { ui.customerStatus = event.target.value; render(); }
  if (event.target.id === "job-status") { ui.jobStatus = event.target.value; render(); }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeModal(); document.body.classList.remove("sidebar-open"); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector('[data-action="focus-search"]')?.click(); }
});
window.addEventListener("hashchange", () => { ui.route = location.hash.replace("#", "") || "dashboard"; document.body.classList.remove("sidebar-open"); render(); window.scrollTo(0, 0); });

injectIcons();
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
ui.route = location.hash.replace("#", "") || "dashboard";
render();
loadRelayOverview();
setInterval(() => {
  if (!document.hidden && !document.querySelector("#modal-root .modal")) loadRelayOverview();
}, 30_000);
window.scrollTo(0, 0);
