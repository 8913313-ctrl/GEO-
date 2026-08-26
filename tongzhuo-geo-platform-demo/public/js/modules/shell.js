
function articleDisplayStatus(article) {
  if (article.status === "published") return "published";
  if (article.status === "publishing") return "publishing";
  if (article.reviewStatus === "approved") return "approved";
  if (article.reviewStatus === "pending" && article.reviewStage === "manual_review") return "pending_review";
  return "draft";
}

function articleReviewBadge(article) {
  if (article.reviewStatus === "approved") return statusBadge("approved");
  if (article.reviewStage === "manual_review") return statusBadge("pending_review");
  if (article.reviewStage === "revision_requested") return '<span class="status-badge status-review">退回修改</span>';
  return '<span class="status-badge status-draft">草稿未提交</span>';
}

function articleRiskBadge(article) {
  if (article.riskStatus === "blocked") return '<span class="status-badge status-error">已阻断</span>';
  if (article.riskStatus === "warning") return '<span class="status-badge status-review">需注意</span>';
  if (article.riskStatus === "stale") return '<span class="status-badge status-pending">结果已过期</span>';
  if (article.riskStatus === "unscanned") return '<span class="status-badge status-draft">未检测</span>';
  return '<span class="status-badge status-approved">已通过</span>';
}

function currentRoute() {
  const raw = location.hash.replace(/^#/, "").split("?")[0];
  return PAGE_META[raw] ? raw : "dashboard";
}

function navigate(route) {
  if (!PAGE_META[route]) route = "dashboard";
  if (location.hash === "#" + route) {
    ui.route = route;
    render();
  } else {
    location.hash = route;
  }
}

function pageHead(title, description, actions = "") {
  return '<div class="page-head"><div><h2>' + escapeHtml(title) + "</h2><p>" + escapeHtml(description) + '</p></div>' + (actions ? '<div class="page-actions">' + actions + "</div>" : "") + "</div>";
}

const ROUTES_WITH_WORKSPACE_SURFACE = new Set([
  "content",
  "publish",
  "assets",
  "assistant",
  "effect-diagnostic",
  "effect-monitor",
  "settings"
]);

function hydrateRouteWorkspaceSurface(root) {
  if (!root || !ROUTES_WITH_WORKSPACE_SURFACE.has(ui.route)) return;
  const page = root.querySelector(":scope > .page-container");
  const head = page?.querySelector(":scope > .page-head, :scope > .effect-aligned-head");
  if (!page || !head || head.nextElementSibling?.classList.contains("route-workspace-surface")) return;

  const surface = document.createElement("div");
  surface.className = `route-workspace-surface route-${ui.route}-workspace page-workspace-surface`;
  head.after(surface);
  while (surface.nextSibling) surface.appendChild(surface.nextSibling);
}

function customerFacingEffectText(value) {
  const raw = String(value || "");
  // 5xx/连接类错误：客户可读为"服务未连接"，技术细节不再直接糊在首屏。
  if (/服务器处理请求失败|请查看服务日志|ECONNREFUSED|连接被拒绝|请求超时|网络错误|fetch failed|失败，请查看服务日志/i.test(raw)) {
    return "检测服务未连接，请到系统设置完成服务配置后重试。";
  }
  return raw
    .replace(/桐灼中转站|中央中转站|中转站/gi, "灼见检测服务")
    .replace(/统一爱搜账号|爱搜账号|爱搜|AIDSO/gi, "AI 检测服务")
    .replace(/relay run/gi, "检测任务")
    .replace(/\bRelay\b/gi, "检测任务")
    .replace(/live evidence/gi, "实时检测证据")
    .replace(/diagnostic_evidence\(live\)/gi, "实时检测证据库")
    .replace(/reqId/gi, "任务追溯号")
    .replace(/([^。！？；]+[。！？])(?:\s*[；;、]\s*\1)+/g, "$1")
    .replace(/(服务器处理请求失败，请查看服务日志。)(?:\s*[；;、]\s*\1)+/g, "$1");
}

function hydrateCustomerFacingEffectCopy(root = document) {
  if (!["effect-search", "effect-diagnostic", "effect-monitor"].includes(ui.route)) return;
  const elements = [root, ...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const node of element.childNodes || []) {
      if (node.nodeType === 3 && node.nodeValue) node.nodeValue = customerFacingEffectText(node.nodeValue);
    }
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      if (element.hasAttribute?.(attribute)) element.setAttribute(attribute, customerFacingEffectText(element.getAttribute(attribute)));
    }
  }
}

function showToast(title, message, type = "success") {
  const root = document.getElementById("toast-root");
  const toast = document.createElement("div");
  const kind = ["success", "error", "warning", "info"].includes(type) ? type : "success";
  toast.className = "toast " + kind;
  const toastIcon = kind === "success" ? "check" : kind === "error" ? "alert" : kind === "warning" ? "alert" : "info";
  toast.innerHTML =
    "<span>" + icon(toastIcon) + "</span>" +
    "<div><b>" + escapeHtml(customerFacingEffectText(title)) + "</b><small>" + escapeHtml(customerFacingEffectText(message)) + "</small></div>" +
    '<button type="button" aria-label="关闭">×</button>';
  root.appendChild(toast);
  const remove = () => toast.remove();
  toast.querySelector("button").addEventListener("click", remove);
  window.setTimeout(remove, 3600);
}

function updateShell() {
  const meta = PAGE_META[ui.route];
  document.body.dataset.route = ui.route;
  const EFFECT_VIEW_TITLES = {
    dashboard: "数据看板",
    settings: "品牌监测",
    mentions: "提及率 / 排名",
    insight: "AI 洞察",
    sentiment: "舆情 / 情感",
    "product-cards": "商品卡分析",
    sources: "AI 引用来源",
    dialogs: "AI 对话记录",
    works: "作品引用追踪",
    runs: "历史运行",
    export: "导出报告",
    "question-bank": "AI 问题库"
  };
  const pageTitle = ui.route === "effect-monitor" ? (EFFECT_VIEW_TITLES[ui.effectMonitorView] || "数据看板") : meta.title;
  document.getElementById("page-title").textContent = pageTitle;
  document.getElementById("breadcrumb-current").textContent = pageTitle;
  document.title = pageTitle + " · 桐灼 GEO";
  document.querySelectorAll("[data-route]").forEach((link) => {
    // AI 效果子主题共享 effect-monitor 路由：按 data-effect-view 精确高亮，
    // 无 data-effect-view 的入口只在未指定子主题时高亮。
    let active = link.dataset.route === ui.route;
    if (active && link.dataset.route === "effect-monitor") {
      const navView = link.dataset.effectView || "";
      const currentView = ["dashboard", "settings", "mentions", "insight", "sentiment", "product-cards", "sources", "dialogs", "works", "runs", "export", "question-bank"].includes(ui.effectMonitorView) ? ui.effectMonitorView : "dashboard";
      active = !navView || navView === currentView;
    }
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const needsAction = state.publishTasks.some((task) =>
    Object.values(task?.targets || {}).some((target) => ["failed", "needs_login", "needs_verification", "result_unknown"].includes(target?.status))
  );
  const publishNavDot = document.getElementById("publish-nav-dot");
  publishNavDot?.classList.toggle("warning", needsAction);
}

function render() {
  ui.route = currentRoute();
  updateShell();
  const renderers = {
    dashboard: renderDashboard,
    planning: renderPlanning,
    content: renderContent,
    publish: renderPublish,
    assets: renderAssets,
    monitoring: renderMonitoring,
    "effect-search": renderEffectSearch,
    "effect-diagnostic": renderEffectDiagnostic,
    "effect-monitor": renderEffectMonitor,
    site: renderSite,
    knowledge: renderKnowledge,
    assistant: renderAssistant,
    settings: renderSettings
  };
  const view = document.getElementById("view");
  view.className = `route-view route-${ui.route}`;
  try {
    view.innerHTML = renderers[ui.route]();
  } catch (error) {
    // A transient empty API response must never leave the previous route's
    // DOM visible after the shell has already switched navigation state.
    // Render a small route-local recovery surface instead and let the user
    // retry once the customer service/API is ready.
    console.error("route_render_failed", { route: ui.route, error });
    view.innerHTML = `<div class="page-container route-render-error"><section class="card"><span class="effect-demo-kicker">页面暂时无法显示</span><h2>${escapeHtml(PAGE_META[ui.route]?.title || "当前页面")}</h2><p>页面数据正在同步，刚才的内容没有完整加载。请刷新当前页面重试。</p><button type="button" class="primary-button" data-action="route-render-retry">重新加载</button></section></div>`;
  }
  hydrateRouteWorkspaceSurface(view);
  if (ui.route === "effect-diagnostic") hydrateEffectDiagnosticCompetitorEditor(view);
  if (ui.route === "effect-diagnostic") hydrateEffectDiagnosticQuestionEditor(view);
  if (ui.route === "effect-diagnostic") hydrateEffectDiagnosticBrandIntroduction(view);
  if (["effect-search", "effect-diagnostic", "effect-monitor"].includes(ui.route)) hydrateEffectRelayExecutionNotice(view);
  hydrateCustomerFacingEffectCopy(view);
  hydrateIcons(view);
  hydrateBulkSelects(view);
  hydrateEffectMonitoringBudgetControl(view);
  enhanceArticleTaskSelection(view);
  hydratePublisherConnectivity();
  if (ui.route === "monitoring") animateMonitoringPage(view);
  if (ui.route === "dashboard") animateDashboardPage(view);
  if (ui.route === "knowledge") animateKnowledgePage(view);
  if (ui.route === "content") animateContentPage(view);
  document.body.classList.remove("sidebar-open");
}

/* 企业知识：企业事实完成度圆环（conic-gradient 变量动画）与指标数字滚动。 */
function animateKnowledgePage(root) {
  if (!root || !window.gsap) return;
  if (root.dataset.tzAnimated === "1") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.dataset.tzAnimated = "1";
  const gsap = window.gsap;

  const ring = root.querySelector(".completion-ring");
  const ringLabel = ring ? ring.querySelector("b") : null;
  if (ring) {
    const targetPct = Math.min(100, Math.max(0, parseFloat(String(ringLabel?.textContent || "0").replace(/[^\d.]/g, "")) || 0));
    const state = { pct: 0 };
    gsap.to(state, {
      pct: targetPct, duration: 1.3, ease: "power2.out",
      onUpdate: () => {
        ring.style.setProperty("--completion", `${state.pct}%`);
        if (ringLabel) ringLabel.textContent = `${Math.round(state.pct)}%`;
      }
    });
  }
  root.querySelectorAll(".knowledge-metrics .summary-card b").forEach((el) => {
    const target = parseFloat(String(el.textContent).replace(/[^\d.]/g, "")) || 0;
    const state = { v: 0 };
    gsap.to(state, { v: target, duration: 1, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(state.v).toLocaleString("zh-CN"); } });
  });
}

/* 内容生产：内容计划进度条从 0 填充到完成度。 */
function animateContentPage(root) {
  if (!root || !window.gsap) return;
  if (root.dataset.tzAnimated === "1") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.dataset.tzAnimated = "1";
  const gsap = window.gsap;
  root.querySelectorAll(".plan-progress-track i").forEach((el) => {
    const target = Math.min(100, Math.max(0, parseFloat(String(el.style.width || "0").replace(/[^\d.]/g, "")) || 0));
    const state = { v: 0 };
    gsap.to(state, { v: target, duration: .9, ease: "power2.out", onUpdate: () => { el.style.width = `${state.v}%`; } });
  });
}

/* 工作台（dashboard）：KPI / 健康度圆环 / 趋势图 / 步骤 入场与数字滚动动画。 */
function animateDashboardPage(root) {
  if (!root || !window.gsap) return;
  if (root.dataset.tzAnimated === "1") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.dataset.tzAnimated = "1";
  const gsap = window.gsap;

  const cards = root.querySelectorAll(".kpi, .grid-2 > .card, .table-card");
  gsap.from(cards, { y: 18, opacity: 0, duration: .55, stagger: .09, ease: "power2.out", clearProps: "all" });

  const countUp = (el, target, duration = 1.1) => {
    if (!el || target == null) return;
    const state = { v: 0 };
    gsap.to(state, { v: Number(target) || 0, duration, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(state.v).toLocaleString("zh-CN"); } });
  };
  root.querySelectorAll(".kpi .kpi-val").forEach((el) => countUp(el, el.textContent));
  root.querySelectorAll(".mini-kpis .mini b").forEach((el) => countUp(el, el.textContent, .8));

  const ring = root.querySelector(".health-ring .fg");
  const ringLabel = root.querySelector(".health-ring .label");
  if (ring && ringLabel) {
    const circumference = 226.2;
    const targetPct = Math.min(100, Math.max(0, parseFloat(String(ringLabel.textContent).replace(/[^\d.]/g, "")) || 0));
    const state = { pct: 0 };
    gsap.to(state, {
      pct: targetPct, duration: 1.4, ease: "power2.out",
      onUpdate: () => {
        ring.setAttribute("stroke-dashoffset", String(circumference * (1 - state.pct / 100)));
        ringLabel.textContent = Math.round(state.pct);
      }
    });
  }

  const steps = root.querySelectorAll(".steps .step");
  gsap.from(steps, { x: -14, opacity: 0, duration: .45, stagger: .1, delay: .25, ease: "power2.out", clearProps: "all" });
}

/* 运营诊断（官网实测）：GSAP 入场与数字滚动动画。
 * 私有化部署本地引入 /vendor/gsap.min.js；尊重 prefers-reduced-motion。 */
function animateMonitoringPage(root) {
  if (!root || !window.gsap) return;
  if (root.dataset.tzAnimated === "1") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.dataset.tzAnimated = "1";
  const gsap = window.gsap;
  const sections = root.querySelectorAll(".diagnostic-content > *");
  gsap.from(sections, { y: 32, opacity: 0, filter: "blur(6px)", duration: .7, stagger: .12, ease: "power3.out", clearProps: "all" });
  root.querySelectorAll(".diagnostic-stat-grid article, .monitoring-realtime-card, .diagnostic-evidence-card, .diagnostic-operation-section").forEach((el) => {
    gsap.from(el.querySelectorAll("[data-icon]"), { scale: .6, opacity: 0, duration: .5, ease: "back.out(1.8)", delay: .3, clearProps: "all" });
  });
  root.querySelectorAll(".diagnostic-traffic-stats .card b, .diagnostic-package-badge b, .monitoring-realtime-head b, .monitor-real-list li b").forEach((el) => {
    const parts = el.innerHTML.match(/^([\d,]+)([\s\S]*)$/);
    if (!parts) return;
    const target = parseFloat(parts[1].replace(/,/g, "")) || 0;
    if (target <= 0) return;
    const suffix = parts[2];
    const state = { v: 0 };
    gsap.to(state, { v: target, duration: 1.6, ease: "power2.out", onUpdate: () => { el.innerHTML = Math.round(state.v).toLocaleString("zh-CN") + suffix; } });
  });
}

// The monitoring budget control is kept as a real DOM field even when older
// cached bundles render the legacy form fragment.  This makes the monthly cap
// visible and editable without allowing it to leak into the realtime or
// diagnostic product flows.
function hydrateEffectMonitoringBudgetControl(root = document) {
  if (ui.route !== "effect-monitor") return;
  const perRun = root.querySelector("#effect-monitor-max-credits");
  if (!perRun || root.querySelector("#effect-monitor-max-monthly-credits")) return;
  const field = document.createElement("label");
  field.className = "effect-demo-input";
  field.innerHTML = `<span>${icon("credit-card")}月度积分上限</span><input id="effect-monitor-max-monthly-credits" type="number" min="0" value="${escapeHtml(ui.effectMonitorMaxMonthlyCredits || "0")}" /><small class="effect-input-hint">0 表示不额外限制，中央客户额度仍然生效。</small>`;
  perRun.closest("label")?.after(field);
  hydrateIcons(field);
}

function hydratePublisherConnectivity(root = document) {
  const devices = Array.isArray(publisherSnapshot.devices) ? publisherSnapshot.devices : [];
  const online = publisherSnapshot.loaded && devices.some((device) => device?.status === "online");
  const label = online ? "在线" : !publisherSnapshot.loaded ? "连接异常" : devices.length ? "离线" : "未配对";
  const navStatus = root.querySelector('[data-route="assistant"] em');
  if (navStatus) {
    navStatus.classList.toggle("is-offline", !online);
    navStatus.innerHTML = `<i></i>${label}`;
  }
  const headerStatus = root.querySelector(".assistant-pill");
  if (headerStatus) {
    headerStatus.classList.toggle("is-offline", !online);
    const text = headerStatus.querySelector("span");
    if (text) text.textContent = `发布助手${label}`;
  }
}


function contentPlanOwnerOptions() {
  const current = currentUserName() || "系统管理员";
  const members = (state.settings?.members || [])
    .filter((member) => member?.status !== "disabled" && member?.name)
    .map((member) => member.name);
  const names = [current, ...members.filter((name) => name !== current)];
  if (!names.length) names.push("系统管理员");
  return names.map((name) => `<option>${escapeHtml(name)}</option>`).join("");
}

function dashboardActivityItems() {
  const items = [];
  const recentArticles = [...state.articles].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 2);
  recentArticles.forEach((article) => {
    const label = article.reviewStatus === "approved" ? "文章通过人工审核" : article.status === "published" ? "文章已发布" : "文章内容更新";
    const icon = article.status === "published" ? "send" : article.reviewStatus === "approved" ? "check" : "file";
    items.push(`<div class="activity-item"><span class="activity-dot" data-icon="${icon}"></span><div class="activity-copy"><b>${label}</b><p>${escapeHtml(article.title)} · ${formatRelative(article.updatedAt)}</p></div></div>`);
  });
  const recentKnowledge = [...(state.knowledgeItems || [])].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 1);
  recentKnowledge.forEach((item) => {
    items.push(`<div class="activity-item"><span class="activity-dot" data-icon="database"></span><div class="activity-copy"><b>企业知识完成更新</b><p>${escapeHtml(item.title || item.question)} · ${formatRelative(item.updatedAt)}</p></div></div>`);
  });
  if (!items.length) return '<div class="dashboard-empty-state compact"><span data-icon="clock"></span><div><b>还没有业务动态</b><p>完成问题研究或创建内容计划后，最近活动会显示在这里。</p></div><button class="secondary-button button-small" type="button" data-nav="planning">进入问题研究</button></div>';
  return items.join("");
}

function dashboardGreeting() {
  const hour = new Date().getHours();
  const period = hour < 6 ? "凌晨好" : hour < 12 ? "上午好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  const user = window.__TZ_AUTH__?.user;
  const name = user?.displayName || user?.name || user?.username || "";
  return name ? `${period}，${name}` : period;
}

function latestKnowledgeUpdatedAt() {
  const items = [...(state.knowledgeItems || [])].map((item) => Number(item.updatedAt || 0)).filter((ts) => ts > 0);
  if (!items.length) return "暂无";
  return formatRelative(Math.max(...items));
}

function enterpriseFactEntries(profile = state.enterpriseProfile) {
  const source = profile || {};
  return [
    ["企业主体", source.companyName, "经人工确认的企业全称"],
    ["品牌名称", source.brandName, "官网与内容平台统一使用"],
    ["主营服务", source.primaryService, source.serviceDescription],
    ["服务客户", source.audience, "用于限定文章适用范围"],
    ["服务区域", source.serviceArea, "公开对外服务范围"],
    ["官方信源", source.officialDomain, "企业可长期控制的公开信源"]
  ];
}

function enterpriseFactCompletion(profile = state.enterpriseProfile) {
  const facts = enterpriseFactEntries(profile);
  const completed = facts.filter(([, value]) => String(value || "").trim()).length;
  return facts.length ? Math.round((completed / facts.length) * 100) : 0;
}

function dashboardKnowledgeSummary() {
  const items = Array.isArray(state.knowledgeItems) ? state.knowledgeItems : [];
  const approved = items.filter((item) => item.status === "approved" || item.reviewStatus === "approved").length;
  const pending = items.filter((item) => ["pending", "pending_review", "pending_ocr", "processing", "draft"].includes(item.status) || ["pending_ocr", "processing"].includes(item.importStatus)).length;
  const rejected = items.filter((item) => ["rejected", "changes_requested", "failed"].includes(item.status)).length;
  const gaps = enterpriseFactEntries().filter(([, value]) => !String(value || "").trim()).length;
  return { total: items.length, approved, pending, rejected, gaps };
}

function dashboardEffectSummary() {
  const data = effectMonitoringAnalyticsSnapshot?.data;
  const overview = data?.overview || {};
  const verified = Number(overview.verified || 0);
  const hasEvidence = verified > 0;
  const hasPlan = Boolean(effectMonitoringSnapshot?.activePlan?.id || (effectMonitoringSnapshot?.plans || []).length);
  return {
    hasEvidence,
    hasPlan,
    verified,
    mentionRate: overview.mentionRate === null || overview.mentionRate === undefined ? null : Number(overview.mentionRate),
    citations: overview.citations === null || overview.citations === undefined ? null : Number(overview.citations),
    lastObservedAt: overview.lastObservedAt || null,
    status: hasEvidence ? "已有真实证据" : hasPlan ? "已配置，等待运行" : "尚未配置监测"
  };
}

function dashboardTrendSeries() {
  const sources = [
    ...(state.articles || []).map((item) => ({ type: "article", time: item.createdAt || item.updatedAt })),
    ...(state.contentPlans || []).map((item) => ({ type: "plan", time: item.createdAt || item.updatedAt })),
    ...(state.knowledgeItems || []).map((item) => ({ type: "knowledge", time: item.createdAt || item.updatedAt }))
  ].map((item) => ({ ...item, time: new Date(item.time || 0).getTime() })).filter((item) => Number.isFinite(item.time) && item.time > 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const start = day.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const rows = sources.filter((item) => item.time >= start && item.time < end);
    return {
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      article: rows.filter((item) => item.type === "article").length,
      plan: rows.filter((item) => item.type === "plan").length,
      knowledge: rows.filter((item) => item.type === "knowledge").length,
      total: rows.length
    };
  });
}

function renderDashboard() {
  const pendingReview = state.articles.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length;
  const readyToPublish = state.articles.filter((article) => article.reviewStatus === "approved" && article.status === "draft").length;
  const activeTargets = state.publishTasks.reduce(
    (total, task) => total + Object.values(task?.targets || {}).filter((target) => ["queued", "running"].includes(target?.status)).length,
    0
  );
  const actionTargets = state.publishTasks.reduce(
    (total, task) => total + Object.values(task?.targets || {}).filter((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target?.status)).length,
    0
  );
  const line = activeBusinessLine();
  const knowledge = dashboardKnowledgeSummary();
  const effect = dashboardEffectSummary();
  const activeQuestions = (state.questionLibrary || []).filter((item) => item.status !== "archived").length;
  const selectedQuestions = (state.questionLibrary || []).filter((item) => item.status !== "archived" && item.selected).length;
  const enterpriseCompletion = enterpriseFactCompletion();
  const incompleteEnterpriseFacts = enterpriseFactEntries().filter(([, value]) => !String(value || "").trim()).length;
  const recentArticles = [...state.articles].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
  const failedTargets = state.publishTasks.reduce((total, task) => total + Object.values(task.targets || {}).filter((target) => ["failed", "partial_failed"].includes(target.status)).length, 0);
  const verificationTargets = state.publishTasks.reduce((total, task) => total + Object.values(task.targets || {}).filter((target) => ["needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status)).length, 0);
  const trendSeries = dashboardTrendSeries();
  const trendMax = Math.max(...trendSeries.map((item) => item.total), 0);
  const trendPlotHeight = 96;
  const urgentCount = failedTargets + verificationTargets + pendingReview + (knowledge.rejected || 0);
  const actionCount = urgentCount + readyToPublish + knowledge.gaps + (!effect.hasEvidence ? 1 : 0);
  const effectValue = effect.hasEvidence && Number.isFinite(effect.mentionRate) ? `${effect.mentionRate}%` : "—";
  const effectMeta = effect.hasEvidence ? `${effect.verified} 条已验收证据${effect.lastObservedAt ? ` · ${formatRelative(effect.lastObservedAt)}` : ""}` : effect.status;
  const taskRows = [];
  if (failedTargets) taskRows.push(`<button class="dashboard-task-row is-blocking" type="button" data-nav="publish"><span class="dashboard-task-icon" data-icon="alert"></span><span class="dashboard-task-copy"><b>${failedTargets} 个发布目标失败</b><small>平台执行未完成，需要重试或人工处理</small></span><span class="dashboard-task-action">去发布任务 <span aria-hidden="true">→</span></span></button>`);
  if (verificationTargets) taskRows.push(`<button class="dashboard-task-row is-warning" type="button" data-nav="publish"><span class="dashboard-task-icon" data-icon="shield"></span><span class="dashboard-task-copy"><b>${verificationTargets} 个发布目标需要验证</b><small>登录、结果回执或草稿状态仍待确认</small></span><span class="dashboard-task-action">查看执行 <span aria-hidden="true">→</span></span></button>`);
  if (pendingReview) taskRows.push(`<button class="dashboard-task-row is-pending" type="button" data-action="show-pending-articles"><span class="dashboard-task-icon" data-icon="file"></span><span class="dashboard-task-copy"><b>${pendingReview} 篇文章等待审核</b><small>审核通过后才能进入发布批次</small></span><span class="dashboard-task-action">进入文章管理 <span aria-hidden="true">→</span></span></button>`);
  if (readyToPublish) taskRows.push(`<button class="dashboard-task-row is-pending" type="button" data-nav="publish"><span class="dashboard-task-icon" data-icon="send"></span><span class="dashboard-task-copy"><b>${readyToPublish} 篇文章已审核可发布</b><small>内容版本已就绪，等待创建发布任务</small></span><span class="dashboard-task-action">创建发布任务 <span aria-hidden="true">→</span></span></button>`);
  if (knowledge.gaps) taskRows.push(`<button class="dashboard-task-row is-warning" type="button" data-nav="knowledge"><span class="dashboard-task-icon" data-icon="book"></span><span class="dashboard-task-copy"><b>${knowledge.gaps} 项企业事实存在缺口</b><small>补齐后才能安全支撑内容生产与证据回溯</small></span><span class="dashboard-task-action">补充企业知识 <span aria-hidden="true">→</span></span></button>`);
  if (!effect.hasEvidence) taskRows.push(`<button class="dashboard-task-row is-neutral" type="button" data-nav="effect-monitor"><span class="dashboard-task-icon" data-icon="chart"></span><span class="dashboard-task-copy"><b>${effect.status === "尚未配置监测" ? "尚未配置品牌监测" : "品牌监测等待首次运行"}</b><small>没有真实 live evidence，不显示估算分数</small></span><span class="dashboard-task-action">查看 AI 效果 <span aria-hidden="true">→</span></span></button>`);
  taskRows.push(`<button class="dashboard-task-row is-neutral" type="button" data-action="effect-monitor-view" data-view="mentions"><span class="dashboard-task-icon" data-icon="chart"></span><span class="dashboard-task-copy"><b>查看品牌 AI 表现</b><small>平台×品牌提及率、排名与竞品对比全视图</small></span><span class="dashboard-task-action">查看平台表现 <span aria-hidden="true">→</span></span></button>`);
  if (!taskRows.length) taskRows.push(`<div class="dashboard-empty-state"><span class="dashboard-empty-icon" data-icon="check"></span><div><b>当前没有阻塞任务</b><p>内容、发布与知识状态都没有需要立即处理的异常。</p></div><button class="secondary-button button-small" type="button" data-nav="content">继续内容生产</button></div>`);

  const loopSteps = [
    { label: "知识", icon: "book", nav: "knowledge", value: knowledge.total ? `${knowledge.approved} 条已审核` : "尚未建立", detail: knowledge.gaps ? `${knowledge.gaps} 项事实缺口` : knowledge.pending ? `${knowledge.pending} 条待审核` : "可进入内容生产", tone: knowledge.gaps || knowledge.pending ? "warning" : "ok" },
    { label: "问题", icon: "search", nav: "planning", value: activeQuestions ? `${activeQuestions} 个问题` : "尚未研究", detail: selectedQuestions ? `${selectedQuestions} 个已进入选题` : "进入问题研究", tone: activeQuestions ? "ok" : "neutral" },
    { label: "内容", icon: "file", nav: "content", value: state.articles.length ? `${state.articles.length} 篇文章` : "尚未生产", detail: pendingReview ? `${pendingReview} 篇待审核` : readyToPublish ? `${readyToPublish} 篇可发布` : "进入创作工作区", tone: pendingReview ? "warning" : "ok" },
    { label: "发布", icon: "send", nav: "publish", value: state.publishTasks.length ? `${state.publishTasks.length} 个任务` : "尚未发布", detail: failedTargets ? `${failedTargets} 个失败` : actionTargets ? `${actionTargets} 个目标待处理` : activeTargets ? `${activeTargets} 个目标执行中` : "进入发布任务", tone: failedTargets || actionTargets ? "warning" : activeTargets ? "running" : "neutral" },
    { label: "AI 效果", icon: "chart", nav: "effect-monitor", value: effect.hasEvidence ? (effect.mentionRate === null ? `${effect.verified} 条证据` : `${effect.mentionRate}% 提及率`) : "尚未运行", detail: effect.hasEvidence ? `${effect.citations ?? "—"} 条引用来源` : "进入品牌监测", tone: effect.hasEvidence ? "ok" : "neutral" },
    { label: "回流", icon: "refresh", nav: effect.hasEvidence ? "effect-monitor" : "knowledge", value: effect.hasEvidence ? (effect.citations === null ? "已有证据" : `${effect.citations} 条引用`) : knowledge.gaps ? `${knowledge.gaps} 项缺口` : "等待首轮检测", detail: effect.hasEvidence ? "查看来源与对话" : knowledge.gaps ? "回到企业知识" : "建立可追溯回流", tone: effect.hasEvidence ? "ok" : knowledge.gaps ? "warning" : "neutral" }
  ];
  const recentArticleRows = recentArticles.map((article) => `<tr>
    <td><b>${escapeHtml(article.title)}</b><br><span class="table-sub">${escapeHtml(article.id)} · ${escapeHtml(article.version)} · 更新于 ${formatRelative(article.updatedAt)}</span></td>
    <td><span class="tag-line">${escapeHtml(article.category || "未分类")}</span></td>
    <td>${articleReviewBadge(article)}</td>
    <td>${escapeHtml(article.author || "未署名")}</td>
    <td class="text-right text-nowrap"><div class="dashboard-table-actions"><button class="link-button dashboard-table-action dashboard-table-action-secondary" type="button" data-action="open-article" data-article-id="${escapeHtml(article.id)}">打开</button><button class="link-button dashboard-table-action dashboard-table-action-primary" type="button" data-action="open-article-studio" data-article-id="${escapeHtml(article.id)}">AI 协作</button></div></td>
  </tr>`).join("");

  return `
    <div class="page-container dashboard-workbench">
      <header class="page-head page-head-terminal dashboard-workbench-head">
        <div>
          <div class="page-eyebrow">WORKSPACE / ${escapeHtml(line?.name || "当前业务线")}</div>
          <h2>${dashboardGreeting()}，今天先处理最影响闭环的事情</h2>
          <p>${actionCount ? `当前有 ${actionCount} 项工作需要关注；优先处理阻塞和异常，再继续推进内容与发布。` : "当前没有阻塞任务，可以继续推进问题、内容和效果回流。"}</p>
        </div>
        <div class="dashboard-head-actions"><button class="secondary-button button-small" type="button" data-nav="content"><span data-icon="file"></span>内容生产</button><button class="primary-button button-small" type="button" data-nav="publish"><span data-icon="send"></span>发布任务</button></div>
      </header>

      <section class="dashboard-status-grid" aria-label="当前状态">
        <button class="dashboard-status-card ${pendingReview ? "is-warning" : "is-ok"}" type="button" data-action="show-pending-articles">
          <span class="dashboard-status-icon" data-icon="file"></span><span class="dashboard-status-label">内容状态</span><b class="dashboard-status-value">${pendingReview}</b><span class="dashboard-status-detail">${pendingReview ? `${pendingReview} 篇文章等待审核` : readyToPublish ? `${readyToPublish} 篇已审核可发布` : "当前没有待审核文章"}</span><span class="dashboard-status-cta">${pendingReview ? "进入文章管理" : "查看内容生产"} <span aria-hidden="true">→</span></span>
        </button>
        <button class="dashboard-status-card ${failedTargets ? "is-blocking" : actionTargets ? "is-warning" : "is-ok"}" type="button" data-nav="publish">
          <span class="dashboard-status-icon" data-icon="send"></span><span class="dashboard-status-label">发布状态</span><b class="dashboard-status-value">${failedTargets || actionTargets}</b><span class="dashboard-status-detail">${failedTargets ? `${failedTargets} 个目标失败` : actionTargets ? `${actionTargets} 个目标需要处理` : activeTargets ? `${activeTargets} 个目标执行中` : "暂无异常目标"}</span><span class="dashboard-status-cta">查看发布任务 <span aria-hidden="true">→</span></span>
        </button>
        <button class="dashboard-status-card ${knowledge.gaps || knowledge.pending ? "is-warning" : "is-ok"}" type="button" data-nav="knowledge">
          <span class="dashboard-status-icon" data-icon="book"></span><span class="dashboard-status-label">知识可用状态</span><b class="dashboard-status-value">${knowledge.approved}</b><span class="dashboard-status-detail">${knowledge.total ? `${knowledge.approved} / ${knowledge.total} 条已审核` : "尚未建立企业知识"}${knowledge.gaps ? ` · ${knowledge.gaps} 项事实缺口` : ""}</span><span class="dashboard-status-cta">进入企业知识 <span aria-hidden="true">→</span></span>
        </button>
        <button class="dashboard-status-card ${effect.hasEvidence ? "is-ok" : "is-neutral"}" type="button" data-nav="effect-monitor">
          <span class="dashboard-status-icon" data-icon="chart"></span><span class="dashboard-status-label">AI 效果摘要</span><b class="dashboard-status-value">${effectValue}</b><span class="dashboard-status-detail">${effectMeta}</span><span class="dashboard-status-cta">查看品牌监测 <span aria-hidden="true">→</span></span>
        </button>
      </section>

      <section class="dashboard-main-grid">
        <section class="card dashboard-action-card">
          <div class="dashboard-section-head"><div><h3>需要处理</h3><p>按阻塞 → 异常 → 待处理排序，点击直接进入对应工作区。</p></div><span class="dashboard-section-count ${urgentCount ? "has-alert" : ""}">${urgentCount || "0"} 项异常</span></div>
          <div class="dashboard-task-list">${taskRows.join("")}</div>
        </section>
        <section class="card dashboard-state-card">
          <div class="dashboard-section-head"><div><h3>工作区状态</h3><p>当前业务线与关键对象的真实数量。</p></div><span class="dashboard-live-status"><i></i>实时</span></div>
          <div class="dashboard-state-list">
            <div><span>当前业务线</span><b>${escapeHtml(line?.name || "未选择")}</b></div>
            <div><span>问题研究</span><b>${activeQuestions.toLocaleString("zh-CN")} 个问题</b></div>
            <div><span>内容生产</span><b>${state.articles.length.toLocaleString("zh-CN")} 篇文章</b></div>
            <div><span>发布目标</span><b>${activeTargets.toLocaleString("zh-CN")} 个执行中</b></div>
            <div><span>AI 证据</span><b>${effect.hasEvidence ? `${effect.verified} 条已验收` : "尚未运行"}</b></div>
          </div>
        </section>
      </section>

      <section class="card dashboard-loop-card">
        <div class="dashboard-section-head"><div><h3>GEO 闭环</h3><p>每个阶段都是可进入的工作入口；当前状态来自真实对象和已验收证据。</p></div><span class="dashboard-loop-caption">知识 → 问题 → 内容 → 发布 → AI 效果 → 回流</span></div>
        <div class="dashboard-loop-grid">${loopSteps.map((step, index) => `<button class="dashboard-loop-step is-${step.tone}" type="button" data-nav="${step.nav}"><span class="dashboard-loop-index">${String(index + 1).padStart(2, "0")}</span><span class="dashboard-loop-icon" data-icon="${step.icon}"></span><b>${step.label}</b><strong>${escapeHtml(step.value)}</strong><small>${escapeHtml(step.detail)}</small><em>进入 <span aria-hidden="true">→</span></em></button>`).join("")}</div>
      </section>

      <section class="dashboard-secondary-grid">
        <section class="card dashboard-trend-card">
          <div class="dashboard-section-head"><div><h3>近 7 天新增</h3><p>按真实创建时间统计文章、内容计划和企业知识。</p></div><span class="dashboard-trend-total">${trendSeries.reduce((sum, item) => sum + item.total, 0)} 项</span></div>
          ${trendMax ? `<div class="dashboard-trend-bars" aria-label="近 7 天新增业务对象趋势">${trendSeries.map((item) => { const totalHeight = Math.round((item.total / trendMax) * trendPlotHeight); return `<div class="dashboard-trend-bar-col"><div class="dashboard-trend-bar-track" style="--bar-height:${totalHeight}px" aria-label="${item.label}，新增 ${item.total} 项"><span class="dashboard-trend-bar-value">${item.total}</span><i class="article" style="height:${Math.round((item.article / trendMax) * 100)}%"></i><i class="plan" style="height:${Math.round((item.plan / trendMax) * 100)}%"></i><i class="knowledge" style="height:${Math.round((item.knowledge / trendMax) * 100)}%"></i></div><small>${item.label}</small></div>`; }).join("")}</div><div class="dashboard-trend-legend"><span><i class="article"></i>文章 ${trendSeries.reduce((sum, item) => sum + item.article, 0)}</span><span><i class="plan"></i>计划 ${trendSeries.reduce((sum, item) => sum + item.plan, 0)}</span><span><i class="knowledge"></i>知识 ${trendSeries.reduce((sum, item) => sum + item.knowledge, 0)}</span></div>` : `<div class="dashboard-empty-state compact"><span data-icon="chart"></span><div><b>近 7 天没有新增业务对象</b><p>创建问题、内容计划或企业知识后，这里会显示真实趋势。</p></div><button class="secondary-button button-small" type="button" data-nav="planning">开始问题研究</button></div>`}
        </section>
        <section class="card dashboard-knowledge-card">
          <div class="dashboard-section-head"><div><h3>知识健康</h3><p>关注知识是否能安全进入内容生产，而不是只看库存。</p></div><button class="link-button" type="button" data-nav="knowledge">查看详情 →</button></div>
          <div class="dashboard-knowledge-score"><div class="dashboard-knowledge-ring" style="--dashboard-knowledge-completion:${enterpriseCompletion}%"><span>${enterpriseCompletion}%</span></div><div><b>${knowledge.approved} 条已审核可用</b><p>${knowledge.pending ? `${knowledge.pending} 条待审核` : "没有待审核知识"} · ${knowledge.gaps ? `${knowledge.gaps} 项企业事实缺口` : "企业事实完整"}</p></div></div>
          <div class="dashboard-knowledge-metrics"><span><b>${knowledge.total}</b>总资料</span><span><b>${knowledge.pending}</b>待审核</span><span><b>${knowledge.rejected}</b>需处理</span></div>
        </section>
      </section>

      <section class="dashboard-detail-grid">
        <section class="card table-card dashboard-recent-card"><div class="dashboard-section-head"><div><h3>最近文章</h3><p>快速打开最近更新的文章，不承担主要工作入口。</p></div><button class="link-button dashboard-view-all-button" type="button" data-nav="content">查看全部 <span aria-hidden="true">→</span></button></div>${recentArticleRows ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>文章 / 任务</th><th>分类</th><th>状态</th><th>作者</th><th class="text-right">操作</th></tr></thead><tbody>${recentArticleRows}</tbody></table></div>` : `<div class="dashboard-empty-state compact"><span data-icon="file"></span><div><b>还没有文章</b><p>从问题研究或创作工作区开始第一篇内容。</p></div><button class="secondary-button button-small" type="button" data-nav="content">进入内容生产</button></div>`}</section>
        <section class="card dashboard-activity-card"><div class="dashboard-section-head"><div><h3>最近活动</h3><p>文章、知识和发布动作的最近变更。</p></div><span class="dashboard-section-count">次级信息</span></div><div class="dashboard-activity-list">${dashboardActivityItems()}</div></section>
      </section>
    </div>
  `;
}

function activeBusinessLine() {
  const activeLines = state.businessLines.filter((line) => line.status === "active");
  return activeLines.find((line) => line.id === ui.selectedBusinessLineId) || activeLines[0] || state.businessLines[0];
}

function aiBusinessLinePayload(line) {
  return {
    id: line?.id || "",
    name: line?.name || line?.product || "",
    product: line?.product || "",
    description: line?.description || "",
    audience: line?.audience || "",
    scenario: line?.scenario || "",
    businessProfile: line?.businessProfile || line?.business_profile || "",
    targetUsers: Array.isArray(line?.targetUsers) ? line.targetUsers : [],
    blockedTerms: Array.isArray(line?.blockedTerms) ? line.blockedTerms : [],
    serviceScope: line?.serviceScope || ""
  };
}

function knowledgeBaseById(baseId) {
  return (state.knowledgeBases || []).find((base) => base.id === baseId) || null;
}

function knowledgeItemById(itemId) {
  return (state.knowledgeItems || []).find((item) => item.id === itemId) || null;
}

function knowledgeVersionById(versionId) {
  return (state.knowledgeVersions || []).find((version) => version.id === versionId) || null;
}

function knowledgeBaseItems(baseId) {
  return (state.knowledgeItems || []).filter((item) => item.knowledgeBaseId === baseId);
}

function approvedKnowledgeItems(baseId) {
  return knowledgeBaseItems(baseId).filter((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const blockedExtractionStatuses = new Set(["queued", "processing", "pending", "pending_ocr", "pending_parse", "failed"]);
    const extractionReady = [item.importStatus, version?.extractionStatus]
      .filter(Boolean)
      .every((status) => !blockedExtractionStatuses.has(String(status).toLowerCase()));
    return item.status === "approved" && item.enabled !== false && version?.reviewStatus === "approved" && extractionReady;
  });
}

function enterpriseKnowledgeBaseIds() {
  return (state.knowledgeBases || [])
    .filter((base) => base.scope === "enterprise" && base.status !== "archived")
    .map((base) => base.id);
}

function inheritedKnowledgeBaseIds(line = activeBusinessLine()) {
  return [...new Set([...enterpriseKnowledgeBaseIds(), ...(line?.knowledgeBaseIds || [])])];
}

function normalizeKnowledgeScope(plan, line = state.businessLines.find((item) => item.id === plan?.businessLineId) || activeBusinessLine()) {
  const inherited = plan?.knowledgeScope?.inheritedBaseIds || inheritedKnowledgeBaseIds(line);
  const added = plan?.knowledgeScope?.addedBaseIds || [];
  const excluded = plan?.knowledgeScope?.excludedBaseIds || [];
  const resolved = plan?.knowledgeScope?.resolvedBaseIds || plan?.knowledgeBaseIds || [...new Set([...inherited, ...added])].filter((id) => !excluded.includes(id));
  return {
    inheritedBaseIds: [...new Set(inherited)],
    addedBaseIds: [...new Set(added)],
    excludedBaseIds: [...new Set(excluded)],
    resolvedBaseIds: [...new Set(resolved)],
    snapshottedAt: plan?.knowledgeScope?.snapshottedAt || plan?.createdAt || Date.now()
  };
}

function planKnowledgeSummary(plan) {
  const scope = normalizeKnowledgeScope(plan);
  const approved = scope.resolvedBaseIds.reduce((total, id) => total + approvedKnowledgeItems(id).length, 0);
  return { scope, approved };
}

function knowledgeKindLabel(kind) {
  return kind === "qa" ? "问答库" : "文档库";
}

function knowledgeScopeLabel(base) {
  if (base.scope === "enterprise") return "全企业共享";
  const line = state.businessLines.find((item) => item.id === base.businessLineId);
  return line ? line.name : "业务线专用";
}

function knowledgeSourceLabel(item, version) {
  return item.sourceName || item.fileName || item.url || version?.sourceName || (item.kind === "qa" ? "企业标准问答" : "企业资料");
}

function knowledgeLocator(item, version) {
  return item.locator || item.page || item.url || version?.locator || version?.page || version?.url || (item.kind === "qa" ? "标准答案" : "正文");
}

function topicBusinessLineId(topic) {
  if (topic.businessLineId) return topic.businessLineId;
  const question = state.questionLibrary.find((item) => item.topicId === topic.id);
  if (question) return question.businessLineId;
  return state.keywordPacks.find((pack) => pack.id === topic.packId)?.businessLineId || null;
}

function planningQuestionTopics(question) {
  if (!question) return [];
  return state.topics.filter((topic) => topic.questionId === question.id || topic.id === question.topicId);
}

function planningTopicPlans(topic) {
  if (!topic) return [];
  return state.contentPlans.filter((plan) => Array.isArray(plan.topicIds) && plan.topicIds.includes(topic.id));
}

function planningTopicArticles(topic) {
  if (!topic) return [];
  return state.articles.filter((article) => article.topicId === topic.id || article.sourceTopicId === topic.id || article.generationSnapshot?.sourceTopicId === topic.id);
}

function planningQuestionReferences(question) {
  const topics = planningQuestionTopics(question);
  const plans = [...new Map(topics.flatMap((topic) => planningTopicPlans(topic)).map((plan) => [plan.id, plan])).values()];
  const articles = [...new Map(topics.flatMap((topic) => planningTopicArticles(topic)).map((article) => [article.id, article])).values()];
  return { topics, plans, articles };
}

function planningTopicReferences(topic) {
  return { question: state.questionLibrary.find((question) => question.id === topic?.questionId || question.topicId === topic?.id) || null, plans: planningTopicPlans(topic), articles: planningTopicArticles(topic) };
}

function planningArchiveCount(lineId) {
  return state.questionLibrary.filter((question) => question.businessLineId === lineId && question.status === "archived").length + state.topics.filter((topic) => topicBusinessLineId(topic) === lineId && topic.status === "archived").length;
}

function planningTabs() {
  const line = activeBusinessLine();
  const counts = {
    keywords: state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active" && !isSeedKeyword(item)).length,
    questions: state.questionLibrary.filter((item) => item.businessLineId === line?.id && item.status === "active" && !planningQuestionTopics(item).some((topic) => topic.status !== "archived")).length,
    topics: state.topics.filter((item) => topicBusinessLineId(item) === line?.id && item.status !== "archived" && !planningTopicPlans(item).length).length,
    plans: state.contentPlans.filter((item) => item.businessLineId === line?.id).length,
    archive: planningArchiveCount(line?.id)
  };
  const tabs = [["keywords", "问题发现"], ["questions", "正式问题"], ["topics", "选题"], ["plans", "内容计划"], ["archive", "历史归档"]];
  return '<div class="tabs topic-center-tabs" role="tablist" aria-label="问题研究生命周期">' + tabs.map(([id, label]) => '<button class="tab-button ' + (ui.planningTab === id ? "active" : "") + '" type="button" role="tab" aria-selected="' + (ui.planningTab === id ? "true" : "false") + '" data-action="planning-tab" data-tab="' + id + '">' + label + " · " + counts[id] + "</button>").join("") + "</div>";
}

function planningLifecycle() {
  const line = activeBusinessLine();
  const counts = {
    keywords: state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active" && !isSeedKeyword(item)).length,
    questions: state.questionLibrary.filter((item) => item.businessLineId === line?.id && item.status === "active" && !planningQuestionTopics(item).some((topic) => topic.status !== "archived")).length,
    topics: state.topics.filter((item) => topicBusinessLineId(item) === line?.id && item.status !== "archived" && !planningTopicPlans(item).length).length,
    plans: state.contentPlans.filter((item) => item.businessLineId === line?.id).length,
    archive: planningArchiveCount(line?.id)
  };
  const stages = [
    ["keywords", "问题发现", "关键词 → 候选问题"],
    ["questions", "正式问题", "确认可生产的问题"],
    ["topics", "选题", "决定要解决什么"],
    ["plans", "内容计划", "安排生产与负责人"]
  ];
  return '<div class="planning-lifecycle" role="tablist" aria-label="问题研究生命周期">' + stages.map(([id, label, hint], index) => '<button class="planning-lifecycle-step ' + (ui.planningTab === id ? "active" : "") + '" type="button" role="tab" aria-selected="' + (ui.planningTab === id ? "true" : "false") + '" data-action="planning-tab" data-tab="' + id + '"><span class="planning-lifecycle-index">' + (index + 1) + '</span><span class="planning-lifecycle-copy"><b>' + label + '</b><small>' + hint + '</small></span><em>' + counts[id] + '</em></button>').join("") + '<button class="planning-lifecycle-step planning-lifecycle-history ' + (ui.planningTab === "archive" ? "active" : "") + '" type="button" role="tab" aria-selected="' + (ui.planningTab === "archive" ? "true" : "false") + '" data-action="planning-tab" data-tab="archive"><span class="planning-lifecycle-index">↺</span><span class="planning-lifecycle-copy"><b>历史归档</b><small>回看已归档记录</small></span><em>' + counts.archive + '</em></button></div>';
}

function renderBusinessScope() {
  const line = activeBusinessLine();
  const options = state.businessLines.filter((item) => item.status === "active").map((item) => '<option value="' + item.id + '" ' + (item.id === line?.id ? "selected" : "") + '>' + escapeHtml(item.name) + "</option>").join("");
  const keywordCount = state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active" && !isSeedKeyword(item)).length;
  const questionCount = state.questionLibrary.filter((item) => item.businessLineId === line?.id && item.status === "active" && !planningQuestionTopics(item).some((topic) => topic.status !== "archived")).length;
  return `
    <section class="business-scope-card planning-scope-card planning-context-bar" aria-label="当前研究范围">
      <div class="planning-context-switcher"><span>当前研究范围</span><div class="field"><select class="select" id="business-line-select" data-planning-business aria-label="当前产品 / 业务线">${options}</select></div></div>
      <div class="business-scope-copy"><b>${escapeHtml(line?.product || "尚未配置产品")}</b><span>${escapeHtml(line?.audience || "请补充目标客户")} · ${escapeHtml(line?.scenario || "请补充核心场景")}</span></div>
      <div class="business-scope-stats"><span><b>${keywordCount}</b>核心关键词</span><span><b>${questionCount}</b>正式问题</span></div>
      <div class="business-scope-actions"><button class="ghost-button button-small" type="button" data-action="manage-business-lines"><span data-icon="settings"></span>管理</button><button class="secondary-button button-small" type="button" data-action="open-business-line"><span data-icon="plus"></span>新增业务线</button></div>
    </section>
  `;
}

function isSeedKeyword(item) {
  return item?.keywordRole === "seed" || (Array.isArray(item?.sourceCoreKeywordIds) && item.sourceCoreKeywordIds.length > 0);
}

function priorityScoreCell(rawValue) {
  const value = Number(rawValue);
  if (Number.isFinite(value)) {
    const cls = value >= 90 ? "score-high" : value >= 75 ? "score-mid" : "score-low";
    return '<span class="topic-score"><b class="' + cls + '">' + value + '</b><small>优先级</small></span>';
  }
  return '<span class="topic-score"><b class="score-pending">—</b><small>优先级</small></span>';
}

function sortableHeader(label, scope, field, currentSort) {
  const active = currentSort && currentSort.field === field;
  const dir = currentSort && currentSort.dir;
  const icon = active ? (dir === "desc" ? "↓" : "↑") : "⇅";
  const title = active ? (dir === "desc" ? "按优先级从高到低（再次点击切换）" : "按优先级从低到高（再次点击恢复默认）") : "点击按优先级排序";
  return '<button type="button" class="topic-sort-trigger' + (active ? " is-active" : "") + '" data-action="sort-score" data-sort-scope="' + escapeHtml(scope) + '" data-sort-field="' + escapeHtml(field) + '" title="' + title + '" aria-label="' + title + '"><span>' + label + '</span><i class="topic-sort-icon">' + icon + '</i></button>';
}

function sortByPriority(list, getValue, currentSort) {
  const dir = currentSort?.dir;
  return [...list].sort((a, b) => {
    const av = Number(getValue(a));
    const bv = Number(getValue(b));
    const aFinite = Number.isFinite(av);
    const bFinite = Number.isFinite(bv);
    if (aFinite && !bFinite) return -1;
    if (!aFinite && bFinite) return 1;
    if (!aFinite && !bFinite) return 0;
    return dir === "asc" ? av - bv : bv - av;
  });
}

function renderKeywordWorkspace() {
  const line = activeBusinessLine();
  const lineKeywords = state.keywords.filter((item) => item.businessLineId === line?.id && item.status === "active");
  const coreKeywords = lineKeywords.filter((item) => !isSeedKeyword(item));
  const linePacks = state.keywordPacks.filter((pack) => pack.businessLineId === line?.id);
  const activePack = linePacks.find((pack) => pack.id === ui.selectedPackId) || linePacks[0];
  const packQuestions = state.questionLibrary.filter((question) => question.packId === activePack?.id && question.status === "candidate");
  const visibleQuestions = ui.planningCategory === "all" ? packQuestions : packQuestions.filter((question) => question.dimension === ui.planningCategory);
  const visibleSelectedQuestions = visibleQuestions.filter((question) => question.selected);
  const visibleCandidateQuestions = visibleQuestions.filter((question) => question.status === "candidate");
  const selectedCandidateQuestions = visibleCandidateQuestions.filter((question) => question.selected);
  const selectedQuestions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status !== "archived" && question.selected);
  const selectedCoreIds = new Set(ui.selectedCoreKeywordIds || []);
  const selectedSeedTerms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean);
  const keywordChips = coreKeywords.map((keyword) => `
    <span class="keyword-chip ${selectedCoreIds.has(keyword.id) ? "selected" : ""}"><input class="checkbox" type="checkbox" data-core-select="${escapeHtml(keyword.id)}" ${selectedCoreIds.has(keyword.id) ? "checked" : ""} aria-label="选择核心关键词：${escapeHtml(keyword.term)}" /><button class="keyword-name-button" type="button" data-action="toggle-core-keyword" data-keyword-id="${escapeHtml(keyword.id)}">${escapeHtml(keyword.term)}</button><small>核心关键词</small><button class="keyword-archive-button" type="button" data-action="archive-business-keyword" data-keyword-id="${keyword.id}" aria-label="归档核心关键词 ${escapeHtml(keyword.term)}">×</button></span>
  `).join("");
  const packageItems = linePacks.map((pack) => `
    <div class="package-item-wrap"><button class="package-item ${pack.id === activePack?.id ? "active" : ""}" type="button" data-action="select-pack" data-pack-id="${pack.id}"><strong>${escapeHtml(pack.title)}</strong><span><em>${escapeHtml(pack.source)}</em><b>${pack.total} 条</b></span></button><button class="package-delete-button" type="button" data-action="delete-keyword-pack" data-pack-id="${escapeHtml(pack.id)}" aria-label="删除历史词包：${escapeHtml(pack.title)}">删除</button></div>
  `).join("");
  const archivedKeywords = (state.keywords || []).filter((item) => item.businessLineId === line?.id && item.status === "archived");
  const archivedKeywordRow = archivedKeywords.length ? `<div class="archived-keyword-row"><span>已归档核心关键词（${archivedKeywords.length}）</span>${archivedKeywords.slice(0, 6).map((kw) => `<button class="keyword-restore-button" type="button" data-action="restore-business-keyword" data-keyword-id="${escapeHtml(kw.id)}">恢复 ${escapeHtml(kw.term)}</button>`).join("")}</div>` : "";
  const keywordChipsWithArchive = keywordChips + archivedKeywordRow;
  const categoryTabs = DIMENSIONS.map((dimension) => {
    const count = dimension.id === "all" ? packQuestions.length : packQuestions.filter((question) => question.dimension === dimension.id).length;
    return '<button class="category-tab ' + (ui.planningCategory === dimension.id ? "active" : "") + '" type="button" data-action="planning-category" data-category="' + dimension.id + '">' + dimension.label + "<i>" + count + "</i></button>";
  }).join("");
  let resultItems = "";
  if (ui.expanding) {
    resultItems = '<div class="topic-list">' + Array.from({ length: 5 }).map((_, index) => '<div class="topic-item" aria-hidden="true"><span class="skeleton skeleton-sm"></span><div><div class="skeleton" style="height:15px;width:' + (78 - index * 5) + '%"></div><div class="skeleton" style="height:10px;width:92%;margin-top:10px"></div></div><div class="skeleton" style="height:16px;width:50px"></div></div>').join("") + '</div>';
  } else if (!visibleQuestions.length) {
    resultItems = '<div class="empty-state"><div><span data-icon="compass"></span><h3>还没有问题词包</h3><p>先拓展并确认种子词，再根据种子词生成问题词包。</p></div></div>';
  } else {
    const sortedQuestions = ui.keywordResultSort ? sortByPriority(visibleQuestions, (question) => calculateQuestionPriorityScore(question), ui.keywordResultSort) : visibleQuestions;
    const rowsHtml = sortedQuestions.map((question) => {
      const deleteAction = question.status === "candidate"
        ? `<button class="link-button danger-text" type="button" data-action="delete-keyword-candidate" data-question-id="${escapeHtml(question.id)}" title="删除此候选问题" aria-label="删除候选问题：${escapeHtml(question.question)}">删除</button>`
        : "";
      return `<tr class="planning-question-row ${question.selected ? "is-selected" : ""}"><td><input class="checkbox" type="checkbox" data-question-select="${question.id}" ${question.selected ? "checked" : ""} aria-label="选择问题：${escapeHtml(question.question)}" /></td><td class="article-title-cell planning-question-copy"><b>${escapeHtml(question.question)}</b><small><span>种子词：${escapeHtml(question.sourceKeyword)}</span><span>${escapeHtml(question.source)}</span></small></td><td><span class="status-badge status-review">候选</span></td><td>${priorityScoreCell(calculateQuestionPriorityScore(question))}</td><td><div class="table-actions">${deleteAction}</div></td></tr>`;
    }).join("");
    resultItems = '<div class="table-scroll"><table class="data-table topic-center-table topic-management-table keyword-result-table"><thead><tr><th></th><th>问题</th><th>状态</th><th>' + sortableHeader("优先级", "keyword-result", "priority", ui.keywordResultSort) + '</th><th>操作</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  }
  const basket = selectedQuestions.length ? selectedQuestions.map((question) => `<div class="basket-item"><b>${escapeHtml(question.question)}</b><span>${escapeHtml(question.sourceKeyword)}</span><button class="basket-remove" type="button" data-action="remove-question" data-question-id="${question.id}" aria-label="移除">×</button></div>`).join("") : '<div class="basket-empty"><div><span data-icon="clipboard"></span><b>问题篮还是空的</b><p>勾选候选问题后确认入库。</p></div></div>';
  return `
    <section class="planning-research-tools planning-research-context" aria-label="问题发现工具">
      <div class="planning-workbench-section-head"><div><span class="planning-section-kicker">研究上下文</span><h3>定义本轮问题研究范围</h3></div><span class="planning-workbench-context"><i></i>当前研究中</span></div>
    <div class="keyword-foundation-grid planning-tool-grid">
    <section class="keyword-manager-card planning-stage-card planning-tool-panel">
      <div class="card-header"><div><h3>核心关键词</h3><p>选择核心关键词，拓展种子词。</p></div><span class="small-tag blue">${coreKeywords.length} 个</span></div>
      <div class="keyword-manager-body"><div class="keyword-input-row"><div class="field grow"><label for="business-keyword-input">核心关键词（可输入新词，也可勾选下方已有词）</label><input class="input ${ui.businessKeywordError ? "input-error" : ""}" id="business-keyword-input" value="${escapeHtml(ui.businessKeywordInput)}" placeholder="例如：激光清洗机，激光除锈" autocomplete="off" />${ui.businessKeywordError ? '<small class="error-text">' + escapeHtml(ui.businessKeywordError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="expand-seeds" ${ui.seedExpanding ? "disabled" : ""}>${ui.seedExpanding ? '<span class="loading-spinner"></span>正在拓展种子词' : '<span data-icon="sparkle"></span>智能拓展种子词'}</button></div><div class="keyword-chip-list">${keywordChips || '<span class="empty-inline">输入一个核心关键词后，即可智能拓展种子词。</span>'}</div><div class="keyword-selection-hint">${selectedCoreIds.size ? `已选择 ${selectedCoreIds.size} 个核心关键词` : "未勾选时使用当前业务线的全部核心关键词"}</div></div>
    </section>
    <section class="seed-manager-card planning-stage-card planning-tool-panel"><div class="card-header"><div><h3>种子词与问题生成</h3><p>编辑种子词，生成候选问题。</p></div><span class="small-tag teal">${selectedSeedTerms.length} 个种子词</span></div><div class="seed-input-row"><div class="field grow"><label for="seed-input">拓展种子词（1–8 个，可直接编辑）</label><input class="input ${ui.seedError ? "input-error" : ""}" id="seed-input" value="${escapeHtml(ui.seedInput)}" placeholder="智能拓展后直接显示在这里，也可手动输入并用逗号分隔" autocomplete="off" />${ui.seedError ? '<small class="error-text">' + escapeHtml(ui.seedError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="generate-question-pack" ${ui.expanding || ui.seedExpanding ? "disabled" : ""}>${ui.expanding ? '<span class="loading-spinner"></span>正在生成问题词包' : '<span data-icon="sparkle"></span>生成问题词包'}</button></div></section>
    </div>
    </section>
    <div class="planning-section-heading planning-section-heading-results"><div><span class="planning-section-kicker">候选问题研究</span><h3>筛选值得进入正式问题库的问题</h3></div><p>问题内容是判断核心；状态、来源和优先级用于辅助决策。</p></div>
    <div class="planning-layout">
      <section class="card planning-candidate-panel planning-research-surface"><div class="planning-candidate-head"><div><span class="planning-section-kicker">当前问题词包</span><h3>${escapeHtml(activePack?.title || "问题词包结果")}</h3><p>种子词：${escapeHtml(activePack?.seeds?.join(" / ") || "—")}</p></div><div class="planning-candidate-summary"><b>${packQuestions.length}</b><span>条候选问题</span></div></div><div class="planning-candidate-toolbar"><div class="category-tabs">${categoryTabs}</div><div class="model-note"><span data-icon="info"></span><span>勾选后进入问题篮，确认后加入正式问题库。</span></div></div>${visibleQuestions.length ? '<div class="bulk-select-row keyword-bulk-row">' + renderSelectAllControl("keyword-questions", visibleQuestions.length, visibleSelectedQuestions.length, "全选当前栏目", 'data-select-pack-id="' + escapeHtml(activePack?.id || "") + '" data-select-dimension="' + escapeHtml(ui.planningCategory) + '"') + (visibleCandidateQuestions.length ? '<button class="danger-button button-small keyword-bulk-delete" type="button" data-action="delete-keyword-candidates" data-pack-id="' + escapeHtml(activePack?.id || "") + '" data-dimension="' + escapeHtml(ui.planningCategory) + '" title="删除已选择的候选问题" aria-label="删除已选择的候选问题" ' + (selectedCandidateQuestions.length ? "" : "disabled") + '>删除已选候选</button>' : "") + '</div>' : ""}${resultItems}</section>
      <div class="planning-support-rail">
        <aside class="planning-support-panel planning-history-panel"><div class="card-header"><div><h3>历史词包</h3><p>切换或清理历史研究结果</p></div><span class="small-tag gray">${linePacks.length}</span></div><div class="package-list">${packageItems || '<div class="empty-package">暂无词包</div>'}</div></aside>
        <aside class="planning-support-panel planning-basket-panel ${selectedQuestions.length ? "has-selection" : "is-empty"}"><div class="card-header"><div><h3>问题篮</h3><p>当前研究决策</p></div><span class="small-tag blue">${selectedQuestions.length} 个</span></div><div class="basket-list">${basket}</div><div class="basket-actions"><button class="primary-button" type="button" data-action="save-selected-questions" ${selectedQuestions.length ? "" : "disabled"}><span data-icon="book"></span>加入正式问题</button><button class="ghost-button" type="button" data-action="clear-questions" ${selectedQuestions.length ? "" : "disabled"}>清空选择</button></div></aside>
      </div>
    </div>
  `;
}

function renderQuestionLibrary() {
  const line = activeBusinessLine();
  const libraryKeyword = String(ui.questionLibrarySearch || "").trim().toLowerCase();
  let questions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "active" && !planningQuestionTopics(question).some((topic) => topic.status !== "archived"));
  if (libraryKeyword) questions = questions.filter((question) => [question.question, question.sourceSeedKeyword, question.sourceKeyword, question.sourceCoreKeywords?.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(libraryKeyword));
  const selected = questions.filter((question) => question.selected);
  const generationProgress = ui.topicGenerating ? ui.topicGenerationProgress : null;
  const generatingQuestionIds = new Set(generationProgress?.questionIds || []);
  const generationPercent = generationProgress?.total ? Math.min(100, Math.round(generationProgress.completed / generationProgress.total * 100)) : 0;
  const generationProgressMarkup = generationProgress ? `<div class="topic-generation-progress" role="status" aria-live="polite"><div class="topic-generation-progress-copy"><span class="topic-generation-progress-icon"><span class="loading-spinner dark"></span></span><span><b>正在生成选题</b><small>已处理 ${generationProgress.completed} / ${generationProgress.total} 个问题${generationProgress.failed ? ` · ${generationProgress.failed} 个待重试` : ""}</small></span><strong>${generationPercent}%</strong></div><div class="topic-generation-progress-track" role="progressbar" aria-label="选题生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${generationPercent}"><i style="width:${generationPercent}%"></i></div></div>` : "";
  const rows = questions.map((question) => {
    const refs = planningQuestionReferences(question);
    const activeTopics = refs.topics.filter((topic) => topic.status !== "archived");
    const archivedTopics = refs.topics.filter((topic) => topic.status === "archived");
    const questionGenerating = generatingQuestionIds.has(String(question.id));
    const topicState = activeTopics.length ? `<span class="status-badge status-approved">${activeTopics.length} 个选题</span>` : archivedTopics.length ? `<span class="status-badge status-archived">${archivedTopics.length} 个已归档</span>` : questionGenerating ? '<span class="status-badge status-running"><span class="loading-spinner dark"></span>生成中</span>' : '<span class="status-badge status-review">待生成</span>';
    const referenceText = refs.plans.length || refs.articles.length ? `${refs.plans.length} 计划 · ${refs.articles.length} 文章` : "暂无引用";
    const topicAction = activeTopics.length ? "" : `<button class="link-button" type="button" data-action="question-to-topic" data-question-id="${escapeHtml(question.id)}" ${ui.topicGenerating ? "disabled" : ""}>${questionGenerating ? "生成中" : "生成选题"}</button>`;
    const coreKeywordText = (question.sourceCoreKeywords || []).join("、");
    return `<tr><td><input class="checkbox" type="checkbox" data-question-select="${question.id}" aria-label="选择问题 ${escapeHtml(question.question)}" ${question.selected ? "checked" : ""} /></td><td class="article-title-cell"><b>${escapeHtml(question.question)}</b><small>${escapeHtml(question.id)} · v${escapeHtml(question.version || 1)} · ${escapeHtml(question.source)}</small></td><td><b>${escapeHtml(question.sourceSeedKeyword || question.sourceKeyword)}</b>${coreKeywordText ? `<small class="block-subtext">核心词：${escapeHtml(coreKeywordText)}</small>` : ""}</td><td><span class="small-tag ${question.coverage === "未覆盖" ? "teal" : ""}">${escapeHtml(question.coverage)}</span></td><td>${topicState}</td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions">${topicAction}<button class="link-button" type="button" data-action="edit-question" data-question-id="${escapeHtml(question.id)}">编辑</button><button class="link-button danger-text" type="button" data-action="archive-question" data-question-id="${escapeHtml(question.id)}">归档</button></div></td></tr>`;
  }).join("");
  return `
    <section class="card toolbar-card question-add-bar"><div class="field grow"><label for="question-input">手动添加客户问题</label><input class="input ${ui.questionError ? "input-error" : ""}" id="question-input" value="${escapeHtml(ui.questionInput)}" placeholder="例如：制造企业如何开始做 AI 搜索优化？" autocomplete="off" />${ui.questionError ? '<small class="error-text">' + escapeHtml(ui.questionError) + "</small>" : ""}</div><button class="primary-button" type="button" data-action="add-question"><span data-icon="plus"></span>添加问题</button></section>
    <section class="card table-card planning-library-panel"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 正式问题库</h3><p>这里只保留已确认、可以进入选题的问题；候选问题请先在“问题发现”中筛选。</p></div><div class="card-header-tools"><input class="input" placeholder="搜索问题或来源词" value="${escapeHtml(ui.questionLibrarySearch || "")}" data-question-library-search /><span class="small-tag blue">${questions.length} 个正式问题</span></div></div>${generationProgressMarkup}${questions.length ? '<div class="bulk-select-row table-select-row">' + renderSelectAllControl("question-library", questions.length, selected.length, "全选问题") + '</div>' : ""}<div class="table-scroll"><table class="data-table topic-center-table topic-management-table"><thead><tr><th></th><th>标准问题</th><th>来源种子词 / 核心词</th><th>覆盖</th><th>选题状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="help"></span><h3>还没有正式问题</h3><p>先到问题发现生成候选问题，确认后再进入正式问题库。</p><button class="secondary-button button-small" type="button" data-action="planning-tab" data-tab="keywords">去问题发现</button></div></div>'}</section>
    ${selected.length ? '<div class="selection-bar"><span>已选择 <b>' + selected.length + '</b> 个问题</span><button class="primary-button button-small" type="button" data-action="questions-to-topics" ' + (ui.topicGenerating ? "disabled" : "") + '><span data-icon="arrow"></span>' + (ui.topicGenerating ? "正在生成…" : "生成选题") + '</button></div>' : ""}
  `;
}

function renderTopicLibrary() {
  const line = activeBusinessLine();
  const topicKeyword = String(ui.topicLibrarySearch || "").trim().toLowerCase();
  const topics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status !== "archived" && !planningTopicPlans(topic).length);
  const filteredTopics = topicKeyword ? topics.filter((topic) => [topic.title, topic.intent, topic.recommendation, topic.sourceQuestion].filter(Boolean).join(" ").toLowerCase().includes(topicKeyword)) : topics;
  const sortField = ui.topicLibrarySort?.field;
  const sortedTopics = sortField === "priority" ? sortByPriority(filteredTopics, (topic) => topic.recommendation, ui.topicLibrarySort) : filteredTopics;
  const selectableTopics = topics;
  const selected = selectableTopics.filter((topic) => topic.selected);
  const rows = sortedTopics.map((topic) => {
    const refs = planningTopicReferences(topic);
    const brief = topic.geoBrief || buildGeoTopicBrief(topic, refs.question);
    const question = refs.question;
    const plans = refs.plans;
    const articles = refs.articles;
    const article = articles[0];
    const coreQuestion = topic.coreQuestion || brief.coreQuestion || question?.question || topic.title || "—";
    const lifecycle = article ? '<span class="status-badge status-approved">已创建内容</span>' : plans.length ? '<span class="status-badge status-publishing">已规划</span>' : '<span class="status-badge status-review">待计划</span>';
    const referenceText = `${plans.length} 计划 · ${articles.length} 文章`;
    const directAction = `<button class="link-button topic-direct-button" type="button" data-action="direct-generate-topic" data-topic-id="${escapeHtml(topic.id)}">${article ? "查看文章" : "直接生成文章"}</button>`;
    const planAction = article ? "" : `<button class="link-button" type="button" data-action="topic-to-plan" data-topic-id="${escapeHtml(topic.id)}">加入计划</button>`;
    return `<tr><td><input class="checkbox" type="checkbox" data-topic-select="${topic.id}" aria-label="选择选题 ${escapeHtml(topic.title)}" ${topic.selected ? "checked" : ""} /></td><td class="article-title-cell"><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)}</small></td><td class="article-title-cell"><b>${escapeHtml(coreQuestion)}</b></td><td><span class="source-tag">${escapeHtml(DIMENSIONS.find((item) => item.id === topic.dimension)?.label || topic.dimension)}</span></td><td>${priorityScoreCell(topic.recommendation)}</td><td>${lifecycle}</td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions">${planAction}${directAction}<button class="link-button" type="button" data-action="edit-topic" data-topic-id="${escapeHtml(topic.id)}">编辑</button><button class="link-button danger-text" type="button" data-action="archive-topic" data-topic-id="${escapeHtml(topic.id)}">归档</button></div></td></tr>`;
  }).join("");
  return `
    <section class="card table-card planning-library-panel"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 选题库</h3><p>从正式问题形成可生产的内容方向；优先加入内容计划，再进入内容生产。</p></div><div class="card-header-tools"><input class="input" placeholder="搜索选题或意图" value="${escapeHtml(ui.topicLibrarySearch || "")}" data-topic-library-search /><span class="small-tag blue">${topics.length} 个选题</span></div></div>${selectableTopics.length ? '<div class="bulk-select-row table-select-row">' + renderSelectAllControl("topic-library", selectableTopics.length, selected.length, "全选选题") + '</div>' : ""}<div class="table-scroll"><table class="data-table topic-center-table topic-management-table"><thead><tr><th></th><th>选题标题</th><th>核心回答问题</th><th>内容方向</th><th>${sortableHeader("优先级", "topic-library", "priority", ui.topicLibrarySort)}</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="clipboard"></span><h3>还没有选题</h3><p>先在正式问题库选择问题并生成选题。</p><button class="primary-button button-small" type="button" data-action="planning-tab" data-tab="questions">去正式问题库</button></div></div>'}</section>
    ${selected.length ? '<div class="selection-bar"><span>已选择 <b>' + selected.length + '</b> 个选题</span><div><button class="ghost-button button-small" type="button" data-action="clear-topics">清空</button><button class="primary-button button-small" type="button" data-action="open-plan"><span data-icon="clock"></span>创建内容计划</button></div></div>' : ""}
  `;
}
