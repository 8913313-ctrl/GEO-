
function monitoringDiagnosticEvidenceMarkup(diagnostic) {
  if (!monitoringDiagnosticIsCompleted(diagnostic)) {
    return '<details class="monitoring-diagnostic-details"><summary>查看检查证据与建议</summary><div class="monitoring-diagnostic-empty">诊断完成后会在这里保留四项检查证据、建议来源与优先建议。</div></details>';
  }
  const schema = diagnostic?.schema || diagnostic?.schemaAnalysis || {};
  const content = diagnostic?.content || diagnostic?.contentAnalysis || {};
  const meta = diagnostic?.meta || diagnostic?.metaAnalysis || {};
  const citation = diagnostic?.citation || diagnostic?.citationAnalysis || {};
  const source = monitoringRecommendationSourceMeta(diagnostic);
  const priority = monitoringPriorityRecommendation(diagnostic);
  const metaChecks = meta.checks && typeof meta.checks === "object" ? meta.checks : {};
  const metaFlagLabels = {
    title: "Title", metaDescription: "描述", canonical: "Canonical", viewport: "Viewport", robots: "Robots", favicon: "Favicon",
    htmlLang: "Lang", ogTitle: "OG 标题", ogDescription: "OG 描述", ogImage: "OG 图片", ogType: "OG 类型", ogLocale: "OG 语言", twitterCard: "Twitter Card"
  };
  const metaFlags = Object.entries(metaFlagLabels).map(([key, label]) => monitoringEvidenceFlag(label, Boolean(metaChecks[key]))).join("");
  const authorityLinks = Array.isArray(citation.authorityLinks || citation.authority_links) ? (citation.authorityLinks || citation.authority_links).slice(0, 3) : [];
  const citationEvidence = citation.evidence && typeof citation.evidence === "object" ? citation.evidence : {};
  const sourceLinkCount = monitoringNumber(citation.sourceLinkCount ?? citation.source_link_count ?? citationEvidence.source_link_count) ?? 0;
  const sourceLinks = (Array.isArray(citation.sourceLinks || citation.source_links)
    ? (citation.sourceLinks || citation.source_links)
    : Array.isArray(citationEvidence.source_links) ? citationEvidence.source_links : [])
    .map((item) => typeof item === "string" ? item : item?.href)
    .filter(Boolean)
    .slice(0, 5);
  const recognizedLinks = sourceLinks.length ? sourceLinks : authorityLinks;
  const recognizedLinkLabel = sourceLinks.length || sourceLinkCount > 0 ? "可识别来源链接" : "权威来源链接";
  const recognizedLinkMarkup = recognizedLinks.length
    ? recognizedLinks.map((item) => `<a href="${escapeHtml(String(item))}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(item))}</a>`).join("<br />")
    : sourceLinkCount > 0 ? `已识别 ${monitoringDisplayNumber(sourceLinkCount)} 条来源链接` : "未发现权威来源链接";
  return `
    <details class="monitoring-diagnostic-details">
      <summary>查看检查证据与建议</summary>
      <div class="monitoring-evidence-grid">
        <article class="monitoring-evidence-group"><header><b>Schema</b><em>${monitoringDisplayNumber(schema.score ?? schema.schemaScore ?? schema.schema_score)} 分</em></header><dl><div><dt>已发现类型</dt><dd>${monitoringEvidenceText(schema.foundTypes || schema.found_types)}</dd></div><div><dt>建议补充</dt><dd>${monitoringEvidenceText(schema.missingRecommended || schema.missing_recommended, "暂无")}</dd></div><div><dt>JSON-LD</dt><dd>${monitoringDisplayNumber(schema.schemaCount ?? schema.jsonldCount ?? schema.jsonld_count)} 段 · 覆盖 ${monitoringDisplayNumber(schema.coverageRatio ?? schema.coverage_ratio, "%")}</dd></div></dl></article>
        <article class="monitoring-evidence-group"><header><b>内容结构</b><em>${monitoringDisplayNumber(content.score ?? content.contentScore ?? content.content_score)} 分</em></header><dl><div><dt>标题层级</dt><dd>H1 ${monitoringDisplayNumber(content.h1Count ?? content.h1_count)} · H2 ${monitoringDisplayNumber(content.h2Count ?? content.h2_count)} · H3 ${monitoringDisplayNumber(content.h3Count ?? content.h3_count)}</dd></div><div><dt>正文与首段</dt><dd>${monitoringDisplayNumber(content.characterCount ?? content.character_count)} 字符 · ${(content.firstParagraphHasDirectAnswer ?? content.first_paragraph_has_direct_answer ?? content.firstParagraphQuality ?? content.first_paragraph_quality) ? "首段可直接回答" : "首段需补充直答"}</dd></div><div><dt>结构信号</dt><dd>FAQ ${monitoringDisplayNumber(content.faqLikeSections ?? content.faq_like_sections)} · 列表 ${monitoringDisplayNumber(content.listCount ?? content.list_count)} · CTA ${monitoringDisplayNumber(content.ctaCount ?? content.cta_count)}</dd></div><div><dt>图片 Alt</dt><dd>${monitoringDisplayNumber(content.imageWithAltCount ?? content.image_with_alt_count)} / ${monitoringDisplayNumber(content.imageCount ?? content.image_count)} · ${monitoringDisplayNumber(content.imageAltRatio ?? content.image_alt_ratio, "%")}</dd></div></dl></article>
        <article class="monitoring-evidence-group"><header><b>Meta 与预览</b><em>${monitoringDisplayNumber(meta.score ?? meta.metaScore ?? meta.meta_score)} 分 · 预览 ${monitoringDisplayNumber(meta.previewScore ?? meta.preview_score)} 分</em></header><div class="monitoring-evidence-flags">${metaFlags || '<span class="monitoring-evidence-empty">暂无 Meta 检查值</span>'}</div><dl><div><dt>缺失项</dt><dd>${monitoringEvidenceText(meta.missing, "暂无")}</dd></div></dl></article>
         <article class="monitoring-evidence-group"><header><b>引用与链接</b><em>${monitoringDisplayNumber(citation.score ?? citation.citationScore ?? citation.citation_score)} 分</em></header><dl><div><dt>链接结构</dt><dd>外部 ${monitoringDisplayNumber(citation.externalLinkCount ?? citation.external_link_count)} · 权威 ${monitoringDisplayNumber(citation.authorityLinkCount ?? citation.authority_link_count)} · 内链 ${monitoringDisplayNumber(citation.internalLinkCount ?? citation.internal_link_count)} · 社交 ${monitoringDisplayNumber(citation.socialLinkCount ?? citation.social_link_count)}</dd></div><div><dt>${recognizedLinkLabel}</dt><dd>${recognizedLinkMarkup}</dd></div></dl></article>
      </div>
      <section class="monitoring-suggestion-summary"><div><span>建议来源</span><b>${escapeHtml(source.label)}</b><small>${escapeHtml(source.description)}${source.modelLabel ? ` ${escapeHtml(source.modelLabel)}` : ""}</small></div><div><span>优先建议</span><p>${escapeHtml(priority || "当前未返回优先建议；可先根据四项检查证据补齐缺失项。")}</p></div></section>
    </details>`;
}

function monitoringTrafficLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  const labels = {
    human: "浏览器 UA 请求",
    ai_bot: "AI 爬虫页面请求",
    search_bot: "搜索爬虫页面请求",
    other_bot: "其他自动化请求",
    unknown: "无 / 未识别 UA"
  };
  return labels[key] || String(value || "未知请求");
}

function monitoringTrendLabel(value) {
  const source = String(value || "").trim();
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : source;
}

function monitoringDiagnosticScores(diagnostic) {
  // A failed report is still auditable, but it does not carry a score.  Do
  // not turn missing fields into 0, otherwise an unreachable site looks like
  // a completed zero-score diagnosis.
  if (!monitoringDiagnosticIsCompleted(diagnostic)) return { total: null, schema: null, content: null, meta: null, authority: null };
  const scores = diagnostic?.scores || diagnostic?.scoreBreakdown || diagnostic?.breakdown || diagnostic?.checks || diagnostic?.components || {};
  return {
    total: monitoringMetric(diagnostic, ["totalScore", "score", "geoScore", "overallScore"]) ?? monitoringMetric(scores, ["total", "overall"]),
    schema: monitoringMetric(scores, ["schema", "structuredData", "schemaScore"]) ?? monitoringMetric(diagnostic, ["schemaScore"]),
    content: monitoringMetric(scores, ["content", "contentScore", "semanticContent"]) ?? monitoringMetric(diagnostic, ["contentScore"]),
    meta: monitoringMetric(scores, ["meta", "metadata", "metaScore", "technicalMeta"]) ?? monitoringMetric(diagnostic, ["metaScore"]),
    authority: monitoringMetric(scores, ["authority", "authorityLinks", "backlinks", "authorityScore", "externalLinks"]) ?? monitoringMetric(diagnostic, ["authorityScore", "backlinkScore"])
  };
}

function monitoringTrafficRecord() {
  const overview = monitoringSnapshot.overview || {};
  return monitoringSnapshot.traffic || overview.traffic || overview.crawlerTraffic || null;
}

function monitoringTrafficPoints(traffic) {
  const candidates = traffic?.trend || traffic?.series || traffic?.daily || traffic?.points || [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((item, index) => ({
    label: String(item?.label || item?.date || item?.day || index + 1),
    value: monitoringNumber(item?.allPv ?? item?.totalPv ?? item?.pv ?? item?.visits ?? item?.value ?? item?.count) ?? 0,
    humanPv: monitoringNumber(item?.humanPv ?? item?.human ?? item?.browserPv) ?? 0,
    aiBotPv: monitoringNumber(item?.aiBotPv ?? item?.aiBot) ?? 0,
    searchBotPv: monitoringNumber(item?.searchBotPv ?? item?.searchBot) ?? 0,
    otherBotPv: monitoringNumber(item?.otherBotPv ?? item?.otherBot) ?? 0,
    unknownPv: monitoringNumber(item?.unknownPv ?? item?.unknown) ?? 0
  })).filter((item) => item.label);
}

function monitoringLiveTrafficRecord(kind) {
  const record = monitoringSnapshot[kind];
  return record && typeof record === "object" ? record : null;
}

function monitoringLiveMetric(record, keys) {
  const kpis = record?.kpis || {};
  return monitoringMetric(kpis, keys) ?? monitoringMetric(record || {}, keys) ?? 0;
}

function monitoringLocalDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + Number(offsetDays || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monitoringRangeLabel(value) {
  return ({ today: "今天", yesterday: "昨天", "7": "近 7 天", "30": "近 30 天", "90": "近 90 天" })[String(value)] || `近 ${value} 天`;
}

function monitoringTrendTooltipMarkup(point) {
  return `<b>${escapeHtml(monitoringTrendLabel(point.label))}</b><span>成功页面请求 <strong>${monitoringDisplayNumber(point.value)}</strong></span><span>浏览器 UA <strong>${monitoringDisplayNumber(point.humanPv)}</strong></span><span>AI 爬虫 <strong>${monitoringDisplayNumber(point.aiBotPv)}</strong></span><span>搜索爬虫 <strong>${monitoringDisplayNumber(point.searchBotPv)}</strong></span><span>其他自动化 <strong>${monitoringDisplayNumber(point.otherBotPv)}</strong></span><span>未分类 <strong>${monitoringDisplayNumber(point.unknownPv)}</strong></span>`;
}

function monitoringTrendBars(points) {
  const values = points.map((item) => Math.max(0, Number(item.value) || 0));
  if (!points.length || !values.some((value) => value > 0)) return '<div class="monitor-real-empty">所选周期暂无成功页面请求</div>';
  const width = 720; const height = 150; const left = 14; const right = 14; const top = 12; const bottom = 28;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom; const max = Math.max(...values, 1);
  const x = (index) => left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth);
  const y = (value) => top + plotHeight - value / max * plotHeight;
  const line = points.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(values[index]).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(points.length - 1).toFixed(2)} ${top + plotHeight} L ${x(0).toFixed(2)} ${top + plotHeight} Z`;
  const tickCount = Math.min(6, points.length); const tickIndexes = [...new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, tickCount - 1))))];
  const ticks = tickIndexes.map((index) => `<span>${escapeHtml(monitoringTrendLabel(points[index].label))}</span>`).join("");
  const firstActiveIndex = values.findIndex((value) => value > 0);
  const dataStartNote = firstActiveIndex > 0 ? `<div class="monitor-real-trend-note">自 ${escapeHtml(monitoringTrendLabel(points[firstActiveIndex].label))} 起开始采集，此前无成功页面请求记录</div>` : "";
  const dots = points.map((item, index) => `<circle tabindex="0" role="button" aria-label="${escapeHtml(monitoringTrendLabel(item.label))} ${monitoringDisplayNumber(item.value)} 次成功页面请求" data-monitor-point data-index="${index}" data-label="${escapeHtml(item.label)}" data-value="${item.value}" data-human="${item.humanPv}" data-ai="${item.aiBotPv}" data-search="${item.searchBotPv}" data-other="${item.otherBotPv}" data-unknown="${item.unknownPv}" cx="${x(index).toFixed(2)}" cy="${y(values[index]).toFixed(2)}" r="${index === points.length - 1 ? 3.5 : 2.6}"></circle>`).join("");
  return `<div class="monitor-real-trend-chart" role="img" aria-label="${escapeHtml(points.length)} 天成功页面请求趋势"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="tz-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(184, 68, 47, .3)"/><stop offset="100%" stop-color="rgba(184, 68, 47, 0)"/></linearGradient></defs><line class="monitor-real-chart-grid" x1="${left}" y1="${top}" x2="${width - right}" y2="${top}" /><line class="monitor-real-chart-grid" x1="${left}" y1="${top + plotHeight / 2}" x2="${width - right}" y2="${top + plotHeight / 2}" /><line class="monitor-real-chart-grid" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" /><path class="monitor-real-chart-area" d="${area}" /><path class="monitor-real-chart-line" pathLength="1" d="${line}" />${dots}</svg><div class="monitor-real-trend-labels">${ticks}</div>${dataStartNote}<div class="monitor-real-tooltip" data-monitor-tooltip hidden></div></div>`;
}
function monitoringProductionStats() {
  const overview = monitoringSnapshot.overview || {};
  const production = overview.production || overview.operations || overview.runOverview || {};
  const remoteArticles = production.articles || overview.articles || {};
  const remotePublishing = production.publishing || production.publish || overview.publishing || {};
  const articles = state.articles || [];
  const localJobs = publisherSnapshot.loaded ? (publisherSnapshot.jobs || []) : (state.publishTasks || []);
  const targets = localJobs.flatMap((job) => Array.isArray(job.targets) ? job.targets : Object.values(job.targets || {}));
  const draft = articles.filter((article) => article.reviewStatus !== "approved").length;
  const approved = articles.filter((article) => article.reviewStatus === "approved" && article.status === "draft").length;
  const published = articles.filter((article) => article.status === "published").length;
  const running = targets.filter((target) => ["queued", "running", "pending"].includes(target?.status)).length;
  const failed = targets.filter((target) => ["failed", "needs_login", "needs_verification", "result_unknown"].includes(target?.status)).length;
  return {
    articleTotal: monitoringMetric(remoteArticles, ["total", "count"]) ?? articles.length,
    draft: monitoringMetric(remoteArticles, ["draft", "pendingReview", "inReview"]) ?? draft,
    approved: monitoringMetric(remoteArticles, ["approved", "readyToPublish"]) ?? approved,
    published: monitoringMetric(remoteArticles, ["published", "completed"]) ?? published,
    taskTotal: monitoringMetric(production, ["contentTasks", "tasks", "articleTasks"]) ?? (state.contentPlans || []).length,
    publishRunning: monitoringMetric(remotePublishing, ["running", "queued", "active"]) ?? running,
    publishFailed: monitoringMetric(remotePublishing, ["failed", "needsAction", "exceptions"]) ?? failed,
    publishTotal: monitoringMetric(remotePublishing, ["total", "count", "jobs"]) ?? targets.length
  };
}

async function refreshRealMonitoring(options = {}) {
  if (monitoringSnapshot.loading) return monitoringSnapshot;
  monitoringSnapshot = { ...monitoringSnapshot, loading: true, error: "" };
  ui.monitoringRefreshing = true;
  if (!options.silent && currentRoute() === "monitoring") render();
  const selectedRange = String(ui.monitoringRange || "30");
  const days = Math.max(1, Math.min(365, Number(selectedRange) || (selectedRange === "today" || selectedRange === "yesterday" ? 1 : 30)));
  const selectedDateTo = selectedRange === "yesterday" ? monitoringLocalDate(-1) : "";
  const selectedQuery = `days=${days}${selectedDateTo ? `&dateTo=${encodeURIComponent(selectedDateTo)}` : ""}`;
  const [overviewResult, trafficResult, diagnosticsResult, todayResult, yesterdayResult] = await Promise.allSettled([
    productionApi(`/api/v1/monitoring/overview?${selectedQuery}`),
    productionApi(`/api/v1/monitoring/traffic?${selectedQuery}`),
    productionApi("/api/v1/monitoring/diagnostics"),
    productionApi("/api/v1/monitoring/traffic?days=1"),
    productionApi(`/api/v1/monitoring/traffic?days=1&dateTo=${encodeURIComponent(monitoringLocalDate(-1))}`)
  ]);
  const errors = [overviewResult, trafficResult, diagnosticsResult].filter((result) => result.status === "rejected").map((result) => result.reason?.message || "监测服务暂不可用");
  const overview = overviewResult.status === "fulfilled" ? monitoringApiRecord(overviewResult.value, ["overview"]) : null;
  const traffic = trafficResult.status === "fulfilled" ? monitoringApiRecord(trafficResult.value, ["traffic"]) : null;
  const diagnosticsRaw = diagnosticsResult.status === "fulfilled" ? monitoringApiRecord(diagnosticsResult.value, ["items", "diagnostics", "reports"]) : [];
  const liveToday = todayResult.status === "fulfilled" ? monitoringApiRecord(todayResult.value, ["traffic"]) : null;
  const liveYesterday = yesterdayResult.status === "fulfilled" ? monitoringApiRecord(yesterdayResult.value, ["traffic"]) : null;
  monitoringSnapshot = {
    loaded: Boolean(overview || traffic || liveToday || liveYesterday || diagnosticsResult.status === "fulfilled"),
    loading: false,
    overview,
    traffic,
    liveToday,
    liveYesterday,
    diagnostics: Array.isArray(diagnosticsRaw) ? diagnosticsRaw : (diagnosticsRaw?.items || []),
    error: errors.join("；"),
    loadedAt: Date.now()
  };
  ui.monitoringRefreshing = false;
  if (currentRoute() === "monitoring") render();
  if (!options.silent && errors.length) showToast("部分监测数据暂不可用", errors[0], "warning");
  return monitoringSnapshot;
}
async function monitoringDiagnosticRequest(path, options = {}) {
  const request = window.tzFetch || window.fetch.bind(window);
  const response = await request(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const responseText = await response.text();
  let payload = {};
  try { payload = responseText ? JSON.parse(responseText) : {}; } catch { payload = { message: responseText }; }
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.message || `网站诊断请求失败（${response.status}）`);
    error.status = response.status;
    error.code = payload.code || `HTTP_${response.status}`;
    error.body = payload;
    throw error;
  }
  return { responseStatus: response.status, payload };
}

function monitoringUpsertDiagnostic(diagnostic) {
  if (!diagnostic?.id) return diagnostic || null;
  const existing = monitoringDiagnostics().filter((item) => String(item?.id || "") !== String(diagnostic.id));
  monitoringSnapshot = { ...monitoringSnapshot, loaded: true, loading: false, diagnostics: [diagnostic, ...existing] };
  return diagnostic;
}

function stopMonitoringDiagnosticPolling() {
  if (monitoringDiagnosticPollTimer) window.clearTimeout(monitoringDiagnosticPollTimer);
  if (monitoringDiagnosticPollReportId) monitoringDiagnosticPollFailures.delete(monitoringDiagnosticPollReportId);
  monitoringDiagnosticPollTimer = null;
  monitoringDiagnosticPollReportId = null;
}

function scheduleMonitoringDiagnosticPoll(reportId, delay = 1_200) {
  if (!reportId) return;
  if (monitoringDiagnosticPollTimer) window.clearTimeout(monitoringDiagnosticPollTimer);
  monitoringDiagnosticPollReportId = String(reportId);
  monitoringDiagnosticPollTimer = window.setTimeout(() => pollMonitoringDiagnostic(reportId), delay);
}

async function pollMonitoringDiagnostic(reportId) {
  if (!reportId || monitoringDiagnosticPollReportId !== String(reportId)) return;
  try {
    const payload = await productionApi(`/api/v1/monitoring/diagnostics/${encodeURIComponent(reportId)}`);
    // A newer run can supersede this one while the request is in flight.
    // Never let a late response move the older report back to the top.
    if (monitoringDiagnosticPollReportId !== String(reportId)) return;
    const diagnostic = monitoringApiRecord(payload, ["diagnostic", "report", "item"]);
    if (!diagnostic?.id) throw new Error("诊断报告暂未返回可读取的状态。");
    monitoringDiagnosticPollFailures.delete(String(reportId));
    monitoringUpsertDiagnostic(diagnostic);
    if (currentRoute() === "monitoring") render();
    if (!monitoringDiagnosticIsTerminal(diagnostic)) return scheduleMonitoringDiagnosticPoll(reportId);
    stopMonitoringDiagnosticPolling();
    await refreshRealMonitoring({ silent: true });
    const state = monitoringDiagnosticStateMeta(diagnostic);
    const scores = monitoringDiagnosticScores(diagnostic);
    showToast(
      monitoringDiagnosticIsCompleted(diagnostic) ? "网站 GEO 诊断已完成" : "网站 GEO 诊断失败",
      monitoringDiagnosticIsCompleted(diagnostic)
        ? `本次总分 ${monitoringDisplayNumber(scores.total)} / 100；分数只反映当前页面的结构、内容、预览与链接基础。`
        : state.message,
      monitoringDiagnosticIsCompleted(diagnostic) ? "success" : "error"
    );
  } catch (error) {
    if (monitoringDiagnosticPollReportId !== String(reportId)) return;
    const failureCount = (monitoringDiagnosticPollFailures.get(String(reportId)) || 0) + 1;
    monitoringDiagnosticPollFailures.set(String(reportId), failureCount);
    const permanent = [401, 403, 404].includes(Number(error?.status)) || failureCount >= 5;
    const fallback = permanent ? "诊断状态无法继续读取，请刷新页面后重试。" : "诊断状态暂时无法读取，正在重试。";
    monitoringSnapshot = { ...monitoringSnapshot, loading: false, error: error.message || fallback };
    if (currentRoute() === "monitoring") render();
    if (permanent) {
      stopMonitoringDiagnosticPolling();
      showToast("网站 GEO 诊断状态读取失败", monitoringSnapshot.error, "error");
      return;
    }
    scheduleMonitoringDiagnosticPoll(reportId, Math.min(10_000, 1_200 * (2 ** Math.min(3, failureCount))));
  }
}

async function monitoringSuggestionGenerationPayload() {
  const enabled = document.getElementById("monitoring-suggestion-generation")?.checked ?? Boolean(ui.monitoringSuggestionGeneration);
  if (!enabled) return { suggestionGeneration: { mode: "rules" }, fallbackMessage: "" };
  if (!aiProviderSnapshot.loaded) await refreshAiProviders({ renderAfter: false }).catch(() => null);
  const selectedProviderId = String(document.getElementById("monitoring-suggestion-provider")?.value || ui.monitoringSuggestionProviderId || selectedTextProviderId() || "").trim();
  const providers = enabledAiProviders("text");
  const provider = providers.find((item) => item.id === selectedProviderId)
    || providers.find((item) => item.id === selectedTextProviderId())
    || providers[0]
    || null;
  if (!provider) {
    return {
      suggestionGeneration: { mode: "rules" },
      fallbackMessage: "未找到可用的已配置文本模型，本次已自动改用规则建议。"
    };
  }
  return {
    suggestionGeneration: {
      mode: "llm",
      providerId: provider.id,
      model: provider.model || provider.modelId || selectedTextModelName() || ""
    },
    fallbackMessage: ""
  };
}

async function runMonitoringDiagnostic() {
  const input = document.getElementById("monitoring-diagnostic-url");
  let url = input?.value.trim() || state.site?.remoteUrl || state.site?.domain || "";
  if (!url) return showToast("请填写官网地址", "需要提供已部署官网的完整地址后才能运行 GEO 诊断。", "error");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try { url = new URL(url).toString(); } catch { return showToast("官网地址格式不正确", "请输入如 https://www.example.com/ 的地址。", "error"); }
  if (monitoringDiagnosticRunInFlight || monitoringSnapshot.loading || monitoringDiagnosticPollReportId) {
    return showToast("已有网站诊断正在进行", "请等待当前诊断完成或失败后再发起新的检测。", "warning");
  }
  monitoringDiagnosticRunInFlight = true;
  monitoringSnapshot = { ...monitoringSnapshot, loading: true, error: "" };
  if (currentRoute() === "monitoring") render();
  let suggestion;
  try {
    suggestion = await monitoringSuggestionGenerationPayload();
  } catch (error) {
    monitoringDiagnosticRunInFlight = false;
    monitoringSnapshot = { ...monitoringSnapshot, loading: false, error: error.message || "无法准备诊断建议配置。" };
    if (currentRoute() === "monitoring") render();
    showToast("网站 GEO 诊断未创建", monitoringSnapshot.error, "error");
    return;
  }
  try {
    const { responseStatus, payload } = await monitoringDiagnosticRequest("/api/v1/monitoring/diagnostics", { method: "POST", body: { url, suggestionGeneration: suggestion.suggestionGeneration } });
    const diagnostic = monitoringApiRecord(payload, ["diagnostic", "report", "item"]);
    monitoringUpsertDiagnostic(diagnostic);
    if (!diagnostic?.id) monitoringSnapshot = { ...monitoringSnapshot, loading: false };
    await refreshRealMonitoring({ silent: true });
    const currentDiagnostic = diagnostic?.id
      ? monitoringDiagnostics().find((item) => String(item?.id || "") === String(diagnostic.id)) || diagnostic
      : monitoringLatestDiagnostic();
    const scores = monitoringDiagnosticScores(currentDiagnostic);
    const completed = monitoringDiagnosticIsCompleted(currentDiagnostic);
    const terminalFailure = monitoringDiagnosticIsTerminal(currentDiagnostic) && !completed;
    const pending = Boolean(currentDiagnostic?.id) && !monitoringDiagnosticIsTerminal(currentDiagnostic);
    if ((responseStatus === 202 || pending) && currentDiagnostic?.id) scheduleMonitoringDiagnosticPoll(currentDiagnostic.id);
    showToast(
      completed ? "网站 GEO 诊断已完成" : terminalFailure ? "网站 GEO 诊断失败" : "网站 GEO 诊断已创建",
      completed
        ? `本次总分 ${monitoringDisplayNumber(scores.total)} / 100；仅代表网站结构与公开信源基础，不等同于 AI 引用或排名。${suggestion.fallbackMessage ? ` ${suggestion.fallbackMessage}` : ""}`
        : terminalFailure
          ? monitoringDiagnosticStateMeta(currentDiagnostic).message
        : `检测完成前不会显示分数；页面会保留本次状态和可读错误信息。${suggestion.fallbackMessage ? ` ${suggestion.fallbackMessage}` : ""}`,
      terminalFailure ? "error" : "success"
    );
  } catch (error) {
    const failureMessage = error.message || "网站诊断服务暂不可用";
    monitoringSnapshot = { ...monitoringSnapshot, loading: false, error: failureMessage };
    // The server persists failed runs for auditability. Refresh immediately so
    // the card can show that failure (instead of falling back to an apparent
    // zero-score / "not run" state until the operator clicks refresh).
    await refreshRealMonitoring({ silent: true });
    if (currentRoute() === "monitoring") render();
    showToast("网站 GEO 诊断失败", failureMessage, "error");
  } finally {
    monitoringDiagnosticRunInFlight = false;
  }
}

function diagnosticApiItems(payload, aliases = []) {
  const data = payload?.data ?? payload ?? {};
  if (Array.isArray(data)) return data;
  for (const key of aliases) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.[key]?.items)) return data[key].items;
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function diagnosticApiEntity(payload, aliases = []) {
  const data = payload?.data ?? payload ?? {};
  for (const key of aliases) {
    if (data?.[key] && typeof data[key] === "object") return data[key];
    if (payload?.[key] && typeof payload[key] === "object") return payload[key];
  }
  return data && typeof data === "object" ? data : null;
}

function diagnosticMergeReports(freshReports, currentReports) {
  const current = new Map((currentReports || []).map((item) => [String(item.id || item.reportId || ""), item]));
  return (freshReports || []).map((item) => {
    const existing = current.get(String(item.id || item.reportId || ""));
    if (!existing) return item;
    return {
      ...existing,
      ...item,
      sections: item.sections ?? existing.sections,
      recommendations: item.recommendations ?? existing.recommendations,
      actions: item.actions ?? existing.actions
    };
  });
}

function diagnosticTypeOf(record) {
  const type = record?.type || record?.diagnosticType || record?.reportType || "comprehensive";
  return type === "source_ecosystem" ? "source_ecology" : type;
}

function diagnosticApiType(type) {
  return type === "source_ecology" ? "source_ecosystem" : type;
}

function diagnosticTypeMeta(record) {
  return DIAGNOSTIC_TYPES[diagnosticTypeOf(record)] || DIAGNOSTIC_TYPES.comprehensive;
}

function diagnosticStatus(record) {
  return String(record?.status || record?.state || record?.runStatus || "draft").toLowerCase();
}

function diagnosticStatusBadge(record) {
  const status = diagnosticStatus(record);
  const labels = {
    draft: ["待生成", "status-draft"],
    active: ["进行中", "status-publishing"],
    pending: ["等待处理", "status-pending"],
    queued: ["排队中", "status-pending"],
    running: ["分析中", "status-publishing"],
    processing: ["分析中", "status-publishing"],
    completed: ["已完成", "status-approved"],
    complete: ["已完成", "status-approved"],
    final: ["已完成", "status-approved"],
    published: ["已完成", "status-approved"],
    applied: ["已回流", "status-approved"],
    failed: ["失败", "status-failed"],
    error: ["失败", "status-failed"]
  };
  const [label, className] = labels[status] || [record?.status || "待处理", "status-draft"];
  return `<span class="status-badge ${className}">${escapeHtml(label)}</span>`;
}

function diagnosticQuestionPool(businessLineId) {
  const sources = [
    ...(Array.isArray(state.questionLibrary) ? state.questionLibrary : []),
    ...(Array.isArray(state.questions) ? state.questions : []),
    ...(Array.isArray(state.monitoring?.questions) ? state.monitoring.questions : [])
  ];
  const seen = new Set();
  return sources.map((item, index) => ({
    id: String(item.id || item.questionId || `QUESTION-${index + 1}`),
    question: String(item.question || item.title || item.query || "").trim(),
    businessLineId: item.businessLineId || item.lineId || null,
    source: item.source || (index < (state.questionLibrary || []).length ? "问题词库" : "运营问题"),
    status: item.status || "active"
  })).filter((item) => {
    if (!item.question || item.status === "archived") return false;
    if (businessLineId && item.businessLineId && item.businessLineId !== businessLineId) return false;
    const key = item.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function diagnosticProjectReports(projectId) {
  return (diagnosticSnapshot.reports || []).filter((report) => String(report.projectId || report.diagnosticProjectId || report.project?.id || "") === String(projectId || ""));
}

function diagnosticReportById(reportId) {
  return (diagnosticSnapshot.reports || []).find((report) => String(report.id || report.reportId) === String(reportId || "")) || null;
}

function diagnosticProjectById(projectId) {
  return (diagnosticSnapshot.projects || []).find((project) => String(project.id || project.projectId) === String(projectId || "")) || null;
}

function diagnosticInstalledPackage() {
  return (diagnosticSnapshot.researchPackages || []).find((item) => String(item.version || item.dataVersion || item.datasetVersion || "") === CITATION_LAB_PACKAGE.version)
    || (diagnosticSnapshot.researchPackages || [])[0]
    || null;
}

const ANALYSIS_DATA_SOURCE_META = Object.freeze({
  citation_lab: { label: "Citation Lab", description: "四平台历史引用、信源、格式、日期和问题类型统计", icon: "database" },
  enterprise_knowledge: { label: "企业知识库", description: "仅检索当前企业已审核、允许用于分析的知识片段", icon: "book" },
  site_operations: { label: "官网与运营数据", description: "读取官网诊断、内容生产和发布运行摘要", icon: "globe" }
});
const ANALYSIS_PLATFORM_META = Object.freeze({
  "豆包": { short: "豆" },
  DeepSeek: { short: "D" },
  "千问": { short: "千" },
  "元宝": { short: "元" }
});
const ANALYSIS_RUN_TERMINAL = new Set(["completed", "failed"]);

function workbenchData(payload = {}) {
  return payload?.data || payload || {};
}

function workbenchConfiguredProviders() {
  return (aiProviderSnapshot.providers || []).filter((provider) => provider.kind === "text" && provider.status !== "disabled" && provider.hasApiKey === true);
}

function analysisWorkbenchProvider() {
  const providers = workbenchConfiguredProviders();
  const selected = String(ui.analysisProviderId || selectedTextProviderId() || "");
  return providers.find((provider) => provider.id === selected) || providers[0] || null;
}

function analysisWorkbenchActiveRun() {
  const session = analysisWorkbenchSnapshot.activeSession;
  const run = analysisWorkbenchSnapshot.activeRun;
  if (run && (!session || run.sessionId === session.id)) return run;
  return session?.runs?.[0] || null;
}

function stopAnalysisWorkbenchPolling() {
  if (analysisWorkbenchPollTimer) window.clearTimeout(analysisWorkbenchPollTimer);
  analysisWorkbenchPollTimer = null;
}

function scheduleAnalysisWorkbenchPoll(runId) {
  stopAnalysisWorkbenchPolling();
  if (!runId) return;
  analysisWorkbenchPollTimer = window.setTimeout(() => pollAnalysisWorkbenchRun(runId), 900);
}

async function refreshAnalysisWorkbench(options = {}) {
  if (analysisWorkbenchSnapshot.loading) return analysisWorkbenchSnapshot;
  analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, attempted: true, loading: true, error: "" };
  if (options.renderAfter && currentRoute() === "monitoring") render();
  try {
    if (!aiProviderSnapshot.loaded && !aiProviderSnapshot.loading) await refreshAiProviders().catch(() => null);
    const [sessionsPayload, optionsPayload] = await Promise.all([
      productionApi("/api/v1/analysis-sessions?status=active&limit=100"),
      productionApi("/api/v1/analysis-sessions/options")
    ]);
    const sessions = workbenchData(sessionsPayload).items || [];
    const workbenchOptions = workbenchData(optionsPayload);
    const selectedId = ui.analysisSessionId || null;
    let activeSession = analysisWorkbenchSnapshot.activeSession;
    if (selectedId) {
      const sessionPayload = await productionApi(`/api/v1/analysis-sessions/${encodeURIComponent(selectedId)}`);
      activeSession = workbenchData(sessionPayload).session || null;
      ui.analysisSessionId = activeSession?.id || null;
    } else {
      activeSession = null;
      ui.analysisSessionId = null;
    }
    const activeRun = activeSession?.runs?.[0] || null;
    analysisWorkbenchSnapshot = {
      loaded: true, attempted: true, loading: false, options: workbenchOptions, sessions,
      activeSession, activeRun, error: "", loadedAt: Date.now()
    };
    const provider = analysisWorkbenchProvider();
    if (!ui.analysisProviderId && provider) ui.analysisProviderId = provider.id;
    if (activeRun && !ANALYSIS_RUN_TERMINAL.has(activeRun.status)) scheduleAnalysisWorkbenchPoll(activeRun.id);
  } catch (error) {
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, loading: false, attempted: true, error: error.message || "AI 分析工作台暂不可用" };
  }
  if (options.renderAfter && currentRoute() === "monitoring") render();
  return analysisWorkbenchSnapshot;
}

function citationUpdatePayload(payload) {
  return payload?.data?.update || payload?.update || payload?.data || payload || null;
}

async function refreshCitationPackageUpdate(options = {}) {
  if (citationUpdateSnapshot.loading) return citationUpdateSnapshot;
  citationUpdateSnapshot = { ...citationUpdateSnapshot, loading: true, error: "" };
  if (options.renderAfter && currentRoute() === "monitoring") render();
  try {
    const payload = await productionApi("/api/v1/citation-package-updates/status");
    citationUpdateSnapshot = { loaded: true, loading: false, operating: false, update: citationUpdatePayload(payload), error: "" };
  } catch (error) {
    citationUpdateSnapshot = { ...citationUpdateSnapshot, loaded: false, loading: false, operating: false, error: error.message || "数据版本服务读取失败" };
  }
  if (options.renderAfter && currentRoute() === "monitoring") render();
  return citationUpdateSnapshot;
}

async function operateCitationPackageUpdate(action) {
  if (citationUpdateSnapshot.operating) return;
  const update = citationUpdateSnapshot.update || {};
  const candidate = update.candidate || {};
  let body = {};
  if (action === "stage") {
    if (!await uiConfirm("确认把官方完整数据包下载到隔离暂存区？此操作不会切换生产版本。")) return;
    body = { candidateId: candidate.id, confirm: true };
  } else if (action === "validate") body = { candidateId: candidate.id };
  else if (action === "discard") {
    if (!await uiConfirm("确认丢弃当前未激活候选包？已安装版本不会受影响。")) return;
    body = { candidateId: candidate.id, confirm: true };
  } else if (action === "activate") {
    if (!await uiConfirm(`确认激活 Citation Lab ${candidate.datasetVersion || "新版本"}？切换后需要重启研究分析服务，历史报告不会改变。`)) return;
    body = { candidateId: candidate.id, expectedCurrentVersion: update.current?.version || "", confirm: true };
  } else if (action === "rollback") {
    const target = (update.installed || []).find((item) => item.version !== update.current?.version && item.installed && item.validManifest);
    if (!target) return showToast("没有可回滚版本", "当前没有其他经过验证的已安装数据版本。", "error");
    if (!await uiConfirm(`确认从 ${update.current?.version || "当前版本"} 回滚到 ${target.version}？切换后需要重启研究分析服务。`)) return;
    body = { targetVersion: target.version, expectedCurrentVersion: update.current?.version || "", confirm: true };
  }
  citationUpdateSnapshot = { ...citationUpdateSnapshot, operating: true, error: "" };
  render();
  try {
    const payload = await productionApi(`/api/v1/citation-package-updates/${action}`, { method: "POST", body });
    citationUpdateSnapshot = { loaded: true, loading: false, operating: false, update: citationUpdatePayload(payload), error: "" };
    const restart = ["activate", "rollback"].includes(action);
    showToast(restart ? "数据版本已切换" : "更新操作已完成", restart ? "请按私有化运维流程重启后台，使新的只读研究库生效。" : "状态和校验结果已经刷新。", "success");
  } catch (error) {
    citationUpdateSnapshot = { ...citationUpdateSnapshot, operating: false, error: error.message || "更新操作失败" };
    showToast("数据更新操作失败", citationUpdateSnapshot.error, "error");
  }
  render();
}

async function refreshCitationDocumentUpdate(options = {}) {
  if (citationDocumentUpdateSnapshot.loading) return citationDocumentUpdateSnapshot;
  citationDocumentUpdateSnapshot = { ...citationDocumentUpdateSnapshot, loading: true, error: "" };
  if (options.renderAfter && currentRoute() === "monitoring") render();
  try {
    const payload = await productionApi("/api/v1/citation-document-updates/status");
    citationDocumentUpdateSnapshot = { loaded: true, loading: false, operating: false, update: citationUpdatePayload(payload), error: "" };
  } catch (error) {
    citationDocumentUpdateSnapshot = { ...citationDocumentUpdateSnapshot, loaded: false, loading: false, operating: false, error: error.message || "仓库研究资料状态读取失败" };
  }
  if (options.renderAfter && currentRoute() === "monitoring") render();
  return citationDocumentUpdateSnapshot;
}

async function operateCitationDocumentUpdate(action) {
  if (citationDocumentUpdateSnapshot.operating) return;
  const update = citationDocumentUpdateSnapshot.update || {};
  const candidate = update.candidate || {};
  let body = {};
  if (action === "stage") {
    if (!await uiConfirm(`确认从姚金刚官方仓库下载提交 ${String(candidate.sourceCommit || "").slice(0, 12)} 的研究文档？文件只会进入隔离暂存区。`)) return;
    body = { candidateId: candidate.id, confirm: true };
  } else if (action === "validate") body = { candidateId: candidate.id };
  else if (action === "discard") {
    if (!await uiConfirm("确认丢弃当前未激活的研究文档候选快照？当前报告与活动快照不会受影响。")) return;
    body = { candidateId: candidate.id, confirm: true };
  } else if (action === "activate") {
    if (!await uiConfirm(`确认激活研究文档提交 ${String(candidate.sourceCommit || "").slice(0, 12)}？统计数据库版本不会随之改变。`)) return;
    body = { candidateId: candidate.id, expectedCurrentCommit: update.current?.sourceCommit || "", confirm: true };
  } else if (action === "rollback") {
    const target = (update.installed || []).find((item) => item.verified && item.sourceCommit !== update.current?.sourceCommit);
    if (!target) return showToast("没有可回滚快照", "当前没有其他经过完整校验的研究文档快照。", "error");
    if (!await uiConfirm(`确认把研究文档从 ${String(update.current?.sourceCommit || "").slice(0, 12)} 回滚到 ${String(target.sourceCommit).slice(0, 12)}？`)) return;
    body = { targetCommit: target.sourceCommit, expectedCurrentCommit: update.current?.sourceCommit || "", confirm: true };
  }
  citationDocumentUpdateSnapshot = { ...citationDocumentUpdateSnapshot, operating: true, error: "" };
  render();
  try {
    const payload = await productionApi(`/api/v1/citation-document-updates/${action}`, { method: "POST", body });
    const runtime = payload?.data?.runtimeDocuments || null;
    citationDocumentUpdateSnapshot = { loaded: true, loading: false, operating: false, update: citationUpdatePayload(payload), error: "" };
    const switched = ["activate", "rollback"].includes(action);
    showToast(switched ? "研究资料快照已切换" : "研究资料操作已完成", switched
      ? runtime?.ok ? "新的只读文档索引已在当前后台生效，统计数据库版本保持不变。" : "版本指针已切换；请重启后台使新的只读文档索引生效。"
      : "状态、文件清单和完整性校验结果已经刷新。", "success");
  } catch (error) {
    citationDocumentUpdateSnapshot = { ...citationDocumentUpdateSnapshot, operating: false, error: error.message || "研究资料更新操作失败" };
    showToast("研究资料更新失败", citationDocumentUpdateSnapshot.error, "error");
  }
  render();
}

async function openAnalysisWorkbenchSession(sessionId) {
  if (!sessionId) return;
  stopAnalysisWorkbenchPolling();
  ui.analysisSessionId = sessionId;
  analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, loading: true, error: "" };
  render();
  try {
    const payload = await productionApi(`/api/v1/analysis-sessions/${encodeURIComponent(sessionId)}`);
    const activeSession = workbenchData(payload).session;
    const activeRun = activeSession?.runs?.[0] || null;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, loaded: true, loading: false, activeSession, activeRun };
    if (activeRun && !ANALYSIS_RUN_TERMINAL.has(activeRun.status)) scheduleAnalysisWorkbenchPoll(activeRun.id);
  } catch (error) {
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, loading: false, error: error.message || "分析会话读取失败" };
    showToast("会话读取失败", analysisWorkbenchSnapshot.error, "error");
  }
  if (currentRoute() === "monitoring") render();
}

async function deleteAnalysisSession(sessionId) {
  if (!sessionId) return;
  const session = (analysisWorkbenchSnapshot.sessions || []).find((item) => item.id === sessionId)
    || (analysisWorkbenchSnapshot.activeSession?.id === sessionId ? analysisWorkbenchSnapshot.activeSession : null);
  if (!session) return;
  const reportCount = Number(session.artifactCount || 0);
  const title = session.title || "未命名分析报告";
  const confirmed = await uiConfirm(`确认删除“${title}”？${reportCount ? `将同时删除该会话下的 ${reportCount} 个报告版本、证据台账和追问记录。` : "该会话没有已生成报告。"}删除后不可恢复。`);
  if (!confirmed) return;
  try {
    await productionApi(`/api/v1/analysis-sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE", body: { confirm: true } });
    if (ui.analysisSessionId === sessionId) {
      stopAnalysisWorkbenchPolling();
      ui.analysisSessionId = null;
      analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, activeSession: null, activeRun: null };
    }
    await refreshAnalysisWorkbench({ renderAfter: false });
    if (currentRoute() === "monitoring") render();
    showToast("报告已删除", `“${title}”及其证据记录已从报告中心移除。`, "success");
  } catch (error) {
    showToast("报告删除失败", error.message || "请稍后重试；正在运行的分析需要结束后才能删除。", "error");
  }
}

async function pollAnalysisWorkbenchRun(runId) {
  try {
    const payload = await productionApi(`/api/v1/analysis-runs/${encodeURIComponent(runId)}`);
    const run = workbenchData(payload).run || null;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, activeRun: run };
    if (currentRoute() === "monitoring") render();
    if (run && !ANALYSIS_RUN_TERMINAL.has(run.status)) return scheduleAnalysisWorkbenchPoll(run.id);
    if (run?.sessionId) {
      await openAnalysisWorkbenchSession(run.sessionId);
      await refreshAnalysisWorkbench({ renderAfter: false });
      if (run.status === "completed") showToast("分析报告已生成", "报告、证据台账和工具调用已经保存。", "success");
      if (run.status === "failed") showToast("分析任务失败", run.errorMessage || "请检查模型配置或数据源后重试。", "error");
    }
  } catch (error) {
    stopAnalysisWorkbenchPolling();
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, error: error.message || "分析进度读取失败" };
    if (currentRoute() === "monitoring") render();
  }
}

function captureAnalysisWorkbenchDraft(followUp = false) {
  if (followUp) {
    ui.analysisFollowUp = document.getElementById("analysis-follow-up")?.value.trim() || "";
    ui.analysisFollowUpConsent = true;
    return;
  }
  ui.analysisPrompt = document.getElementById("analysis-prompt")?.value.trim() || "";
  ui.analysisIndustry = document.getElementById("analysis-industry")?.value.trim() || "";
  ui.analysisProviderId = document.getElementById("analysis-provider")?.value || ui.analysisProviderId;
  ui.analysisReportDepth = document.querySelector('[name="analysis-depth"]:checked')?.value || ui.analysisReportDepth;
  ui.analysisCustomDepth = document.getElementById("analysis-custom-depth")?.value.trim() || "";
  ui.analysisDataSources = [...document.querySelectorAll("[data-analysis-source]:checked")].map((node) => node.dataset.analysisSource);
  const planPlatformNodes = [...document.querySelectorAll("[data-analysis-plan-platform]")];
  if (ui.analysisPlan?.intent && planPlatformNodes.length) {
    const selectedPlatforms = new Set(planPlatformNodes.filter((node) => node.checked).map((node) => node.dataset.analysisPlanPlatform));
    const platforms = ["豆包", "DeepSeek", "千问", "元宝"].filter((item) => selectedPlatforms.has(item));
    const industry = document.getElementById("analysis-plan-industry")?.value.trim() || "";
    const representativeQuestions = (document.getElementById("analysis-plan-questions")?.value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 40);
    ui.analysisPlan.intent = {
      ...ui.analysisPlan.intent,
      industry,
      platforms,
      representativeQuestions
    };
    ui.analysisIndustry = industry;
    ui.analysisPlatforms = platforms;
  } else {
    ui.analysisPlatforms = [...document.querySelectorAll("[data-analysis-platform]:checked")].map((node) => node.dataset.analysisPlatform);
  }
}

function analysisWorkbenchRequestBody(prompt, consent, session = null) {
  const provider = analysisWorkbenchProvider();
  const customInstruction = ui.analysisReportDepth === "custom" && ui.analysisCustomDepth ? `\n\n自定义报告要求：${ui.analysisCustomDepth}` : "";
  const intent = !session && ui.analysisPlan?.intent ? ui.analysisPlan.intent : null;
  return {
    prompt: `${prompt}${customInstruction}`,
    providerId: session?.providerId || provider?.id || ui.analysisProviderId || "",
    model: session?.model || provider?.model || selectedTextModelName() || "",
    dataSources: session?.dataSources || ui.analysisDataSources,
    platforms: session?.platforms || intent?.platforms || ui.analysisPlatforms,
    reportDepth: session?.reportDepth || intent?.reportDepth || ui.analysisReportDepth,
    outputFormat: "interactive",
    industry: intent?.industry || ui.analysisIndustry,
    researchIntent: intent,
    businessLineId: ui.diagnosticBusinessLineId || "",
    externalDataConsent: consent,
    externalDataConsentAt: new Date().toISOString(),
    externalDataConsentMethod: session ? "explicit_follow_up_checkbox" : "system_default"
  };
}

async function previewAnalysisWorkbenchPlan() {
  if (ui.analysisPlanning || ui.analysisSubmitting) return;
  captureAnalysisWorkbenchDraft(false);
  const prompt = ui.analysisPrompt;
  if (!prompt) return showToast("请输入分析需求", "请直接写清楚行业、目标平台、要分析的问题和期望输出。", "error");
  const provider = analysisWorkbenchProvider();
  if (!provider) {
    ui.settingsTab = "models";
    navigate("settings");
    return showToast("请先配置文本大模型", "在系统设置中保存并启用 API Key 后，再生成研究计划。", "error");
  }
  if (!ui.analysisDataSources.length) return showToast("请选择数据源", "至少保留 Citation Lab、企业知识库或官网与运营数据中的一项。", "error");
  ui.analysisPlanning = true;
  let shouldStartAnalysis = false;
  analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, error: "" };
  render();
  try {
    const payload = await productionApi("/api/v1/analysis-plans", {
      method: "POST",
      body: {
        ...analysisWorkbenchRequestBody(prompt, true),
        researchIntent: null
      }
    });
    const data = workbenchData(payload);
    ui.analysisPlan = {
      intent: data.intent || null,
      plan: Array.isArray(data.plan) ? data.plan : [],
      plannerRun: data.plannerRun || null,
      plannerFallback: data.plannerFallback || null,
      dataSources: data.dataSources || ui.analysisDataSources,
      sourcePrompt: prompt
    };
    if (ui.analysisPlan.intent) {
      ui.analysisIndustry = ui.analysisPlan.intent.industry || "";
      ui.analysisPlatforms = ui.analysisPlan.intent.platforms || ui.analysisPlatforms;
      ui.analysisReportDepth = ui.analysisPlan.intent.reportDepth || ui.analysisReportDepth;
    }
    shouldStartAnalysis = true;
    showToast("研究计划已生成", ui.analysisPlan.plannerFallback?.applied
      ? "模型解析超时，系统已按本地规则生成受控计划并自动开始真实分析。"
      : "系统将按受控研究计划自动开始真实分析。", "success");
  } catch (error) {
    ui.analysisPlan = null;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, error: error.message || "研究计划生成失败" };
    showToast("研究计划生成失败", analysisWorkbenchSnapshot.error, "error");
  } finally {
    ui.analysisPlanning = false;
    if (currentRoute() === "monitoring") render();
  }
  if (shouldStartAnalysis) return submitAnalysisWorkbench(false);
}

async function submitAnalysisWorkbench(followUp = false) {
  if (ui.analysisSubmitting) return;
  captureAnalysisWorkbenchDraft(followUp);
  const session = followUp ? analysisWorkbenchSnapshot.activeSession : null;
  const prompt = followUp ? ui.analysisFollowUp : ui.analysisPrompt;
  const consent = true;
  if (!prompt) return showToast("请输入分析需求", followUp ? "请说明要继续追问或调整的内容。" : "请写清楚要分析的行业、问题和期望输出。", "error");
  if (!followUp && (!ui.analysisPlan?.intent || ui.analysisPlan.sourcePrompt !== prompt)) return previewAnalysisWorkbenchPlan();
  if (!analysisWorkbenchProvider()) {
    ui.settingsTab = "models";
    navigate("settings");
    return showToast("请先配置文本大模型", "在系统设置中保存并启用 API Key 后，再开始真实分析。", "error");
  }
  if (!consent) return showToast("请确认数据发送范围", "勾选确认后，系统只会发送分析需求和所选数据源的受控摘要，不发送 API Key 或整库数据。", "error");
  if (!followUp && !ui.analysisDataSources.length) return showToast("请选择数据源", "至少选择 Citation Lab、企业知识库或官网与运营数据中的一项。", "error");
  if (!followUp && ui.analysisDataSources.includes("citation_lab") && !ui.analysisPlatforms.length) return showToast("请选择分析平台", "使用 Citation Lab 时至少选择一个平台。", "error");
  ui.analysisSubmitting = true;
  render();
  try {
    const endpoint = followUp ? `/api/v1/analysis-sessions/${encodeURIComponent(session.id)}/messages` : "/api/v1/analysis-sessions";
    const payload = await productionApi(endpoint, { method: "POST", body: analysisWorkbenchRequestBody(prompt, consent, session) });
    const data = workbenchData(payload);
    const createdSession = data.session || session;
    const run = data.run || null;
    ui.analysisSessionId = createdSession?.id || run?.sessionId || null;
    ui.analysisFollowUp = "";
    ui.analysisFollowUpConsent = false;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, loaded: true, activeSession: createdSession, activeRun: run, error: "" };
    if (run?.id) scheduleAnalysisWorkbenchPoll(run.id);
    showToast("分析任务已开始", "系统正在运行本地受控统计工具，随后由所选大模型形成报告。", "success");
  } catch (error) {
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, error: error.message || "分析任务创建失败" };
    showToast("分析任务未创建", analysisWorkbenchSnapshot.error, "error");
  } finally {
    ui.analysisSubmitting = false;
    if (currentRoute() === "monitoring") render();
  }
}

async function refreshOperationDiagnostics(options = {}) {
  if (diagnosticSnapshot.loading) return diagnosticSnapshot;
  diagnosticSnapshot = { ...diagnosticSnapshot, loading: true, error: "" };
  if (!options.silent && currentRoute() === "monitoring") render();
  const [projectsResult, reportsResult, actionsResult, packagesResult] = await Promise.allSettled([
    productionApi("/api/v1/diagnostics/projects"),
    productionApi("/api/v1/diagnostics/reports"),
    productionApi("/api/v1/diagnostics/actions"),
    productionApi("/api/v1/research-packages")
  ]);
  const successes = [projectsResult, reportsResult, actionsResult, packagesResult].filter((result) => result.status === "fulfilled");
  const errors = [projectsResult, reportsResult, actionsResult, packagesResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "运营诊断服务暂不可用");
  const freshReports = reportsResult.status === "fulfilled" ? diagnosticApiItems(reportsResult.value, ["reports", "diagnosticReports"]) : null;
  diagnosticSnapshot = {
    loaded: successes.length > 0,
    attempted: true,
    loading: false,
    projects: projectsResult.status === "fulfilled" ? diagnosticApiItems(projectsResult.value, ["projects", "diagnosticProjects"]) : diagnosticSnapshot.projects,
    reports: freshReports ? diagnosticMergeReports(freshReports, diagnosticSnapshot.reports) : diagnosticSnapshot.reports,
    actions: actionsResult.status === "fulfilled" ? diagnosticApiItems(actionsResult.value, ["actions", "diagnosticActions"]) : diagnosticSnapshot.actions,
    researchPackages: packagesResult.status === "fulfilled" ? diagnosticApiItems(packagesResult.value, ["packages", "researchPackages"]) : diagnosticSnapshot.researchPackages,
    error: errors.join("；"),
    loadedAt: Date.now()
  };
  if (currentRoute() === "monitoring") render();
  if (!options.silent && errors.length) showToast("部分诊断服务待连接", errors[0], "error");
  return diagnosticSnapshot;
}

function diagnosticCaptureDraft() {
  ui.diagnosticBusinessLineId = document.getElementById("diagnostic-business-line")?.value || ui.diagnosticBusinessLineId;
  ui.diagnosticType = document.querySelector('[name="diagnostic-type"]:checked')?.value || ui.diagnosticType;
  ui.diagnosticIndustry = document.getElementById("diagnostic-industry")?.value.trim() || "";
  ui.diagnosticGoal = document.getElementById("diagnostic-goal")?.value.trim() || "";
  ui.diagnosticQuestionIds = [...document.querySelectorAll("[data-diagnostic-question]:checked")].map((input) => input.dataset.diagnosticQuestion).filter(Boolean);
}

function freezeDiagnosticQuestionSet() {
  diagnosticCaptureDraft();
  if (!ui.diagnosticQuestionIds.length) return showToast("请选择诊断问题", "至少选择 1 个真实客户问题后才能冻结问题集。", "error");
  ui.diagnosticQuestionSetFrozen = true;
  render();
  showToast("问题集已冻结", `本次诊断将使用固定的 ${ui.diagnosticQuestionIds.length} 个问题，后续报告可追溯。`);
}

async function createDiagnosticProject() {
  if (ui.diagnosticCreating) return;
  diagnosticCaptureDraft();
  const line = state.businessLines.find((item) => item.id === ui.diagnosticBusinessLineId);
  const selected = diagnosticQuestionPool(ui.diagnosticBusinessLineId).filter((item) => ui.diagnosticQuestionIds.includes(item.id));
  if (!line) return showToast("请选择业务线", "诊断项目必须绑定一个产品 / 业务线。", "error");
  if (!ui.diagnosticIndustry) return showToast("请填写所在行业", "行业是匹配研究基线和解释适用范围的必要条件。", "error");
  if (!ui.diagnosticGoal) return showToast("请填写诊断目标", "请说明希望解决的行业优化或信源问题。", "error");
  if (!ui.diagnosticQuestionSetFrozen || !selected.length) return showToast("请先冻结问题集", "确认问题范围后再创建项目，避免不同轮次口径发生变化。", "error");
  ui.diagnosticCreating = true;
  render();
  const frozenAt = new Date().toISOString();
  try {
    const payload = await productionApi("/api/v1/diagnostics/projects", {
      method: "POST",
      body: {
        name: `${ui.diagnosticIndustry} · ${DIAGNOSTIC_TYPES[ui.diagnosticType]?.short || "运营诊断"}`,
        type: ui.diagnosticType,
        diagnosticType: diagnosticApiType(ui.diagnosticType),
        businessLineId: line.id,
        businessLineSnapshot: { id: line.id, name: line.name, product: line.product || "" },
        industry: ui.diagnosticIndustry,
        goal: ui.diagnosticGoal,
        objective: ui.diagnosticGoal,
        scope: { businessLineSnapshot: { id: line.id, name: line.name, product: line.product || "" }, questionCount: selected.length, questionSetFrozenAt: frozenAt },
        questionSetSnapshot: { name: "项目初始问题集", version: 1, frozenAt, questions: selected },
        researchPackageId: diagnosticInstalledPackage()?.id || CITATION_LAB_PACKAGE.id,
        researchPackage: { id: CITATION_LAB_PACKAGE.id, version: CITATION_LAB_PACKAGE.version }
      }
    });
    const project = diagnosticApiEntity(payload, ["project", "diagnosticProject"]);
    if (project?.id || project?.projectId) {
      const id = project.id || project.projectId;
      diagnosticSnapshot.projects = [project, ...diagnosticSnapshot.projects.filter((item) => String(item.id || item.projectId) !== String(id))];
      ui.diagnosticProjectId = id;
    }
    ui.diagnosticWizardOpen = false;
    ui.diagnosticQuestionSetFrozen = false;
    ui.diagnosticQuestionIds = [];
    await refreshOperationDiagnostics({ silent: true });
    showToast("诊断项目已创建", "问题集和研究数据版本已冻结，可以开始生成真实报告。", "success");
  } catch (error) {
    diagnosticSnapshot = { ...diagnosticSnapshot, error: error.message || "诊断项目接口待连接" };
    showToast("项目未创建", `${diagnosticSnapshot.error}。页面不会在本地伪造项目。`, "error");
  } finally {
    ui.diagnosticCreating = false;
    if (currentRoute() === "monitoring") render();
  }
}

async function generateDiagnosticReport(projectId) {
  if (!projectId || ui.diagnosticGeneratingId) return;
  const project = diagnosticProjectById(projectId);
  if (!project) return showToast("项目不存在", "请刷新项目列表后重试。", "error");
  let providerId = selectedTextProviderId();
  if (!providerId) {
    await refreshAiProviders().catch(() => null);
    autoBindDefaultAiProvider("text");
    providerId = selectedTextProviderId();
  }
  const provider = (aiProviderSnapshot.providers || []).find((item) => item.id === providerId && item.kind === "text" && item.status !== "disabled" && item.hasApiKey === true);
  if (!provider) {
    showToast("请先配置文本大模型", "运营诊断必须使用已启用且已保存 API Key 的文本模型。请到系统设置 → AI 模型完成配置。", "error");
    ui.settingsTab = "models";
    navigate("settings");
    return;
  }
  const reportType = diagnosticApiType(diagnosticTypeOf(project));
  const researchOnly = ["industry_strategy", "source_ecosystem", "comprehensive"].includes(reportType);
  const consentActive = String(ui.diagnosticConsentProjectId || "") === String(projectId)
    && Number(ui.diagnosticConsentExpiresAt || 0) > Date.now();
  if (!consentActive) {
    ui.diagnosticConsentProjectId = projectId;
    ui.diagnosticConsentExpiresAt = Date.now() + 60_000;
    showToast(
      "请再次点击“生成报告”",
      researchOnly
        ? `将把诊断目标（行业与分析要求）和 Citation Lab 四平台统计事实包发送给 ${provider.name || provider.model || "所选大模型"}；不发送冻结问题、企业知识片段、运营快照、API Key 或整库资料。`
        : `将把本项目问题、Citation Lab 匹配摘要、命中的企业知识片段和运营快照发送给 ${provider.name || provider.model || "所选大模型"}；不发送 API Key 或整库资料。`,
      "info"
    );
    return;
  }
  ui.diagnosticConsentProjectId = null;
  ui.diagnosticConsentExpiresAt = 0;
  ui.diagnosticGeneratingId = projectId;
  render();
  try {
    const payload = await productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/reports`, {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName() || provider.model || provider.modelId || "",
        externalDataConsent: true,
        externalDataConsentAt: new Date().toISOString(),
        externalDataConsentMethod: "two_step_generate_action",
        researchOnly,
        analysisMode: researchOnly ? "citation_lab_research" : "combined_evidence",
        report: { reportType }
      }
    });
    const report = diagnosticApiEntity(payload, ["report", "diagnosticReport"]);
    if (report?.id || report?.reportId) {
      const id = report.id || report.reportId;
      diagnosticSnapshot.reports = [report, ...diagnosticSnapshot.reports.filter((item) => String(item.id || item.reportId) !== String(id))];
      ui.diagnosticReportId = id;
      ui.diagnosticSection = "reports";
    }
    const createdActions = diagnosticApiItems(payload, ["actions"]);
    if (createdActions.length) diagnosticSnapshot.actions = [...createdActions, ...diagnosticSnapshot.actions.filter((item) => !createdActions.some((created) => created.id === item.id))];
    await refreshOperationDiagnostics({ silent: true });
    showToast(
      "真实诊断报告已生成",
      researchOnly
        ? `已使用 ${provider.name || provider.model || "文本大模型"} 分析 Citation Lab 四平台历史事实包；本次未发送企业知识或运营快照。`
        : `已使用 ${provider.name || provider.model || "文本大模型"} 分析 Citation Lab、企业知识与运营证据；无证据结论已被拦截。`,
      "success"
    );
  } catch (error) {
    diagnosticSnapshot = { ...diagnosticSnapshot, error: error.message || "报告生成接口待连接" };
    showToast("报告未生成", `${diagnosticSnapshot.error}。没有创建演示结论。`, "error");
  } finally {
    ui.diagnosticGeneratingId = null;
    if (currentRoute() === "monitoring") render();
  }
}

async function openDiagnosticReport(reportId) {
  if (!reportId) return;
  ui.diagnosticSection = "reports";
  ui.diagnosticReportId = reportId;
  render();
  try {
    const payload = await productionApi(`/api/v1/diagnostics/reports/${encodeURIComponent(reportId)}`);
    const report = diagnosticApiEntity(payload, ["report", "diagnosticReport"]);
    if (report?.id || report?.reportId) {
      const id = report.id || report.reportId;
      diagnosticSnapshot.reports = [report, ...diagnosticSnapshot.reports.filter((item) => String(item.id || item.reportId) !== String(id))];
      const projectId = report.projectId || report.diagnosticProjectId;
      if (projectId) {
        const actionsPayload = await productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/actions`).catch(() => null);
        const actions = diagnosticApiItems(actionsPayload, ["actions"]);
        if (actions.length) diagnosticSnapshot.actions = [...actions, ...diagnosticSnapshot.actions.filter((item) => !actions.some((fresh) => fresh.id === item.id))];
      }
    }
  } catch (error) {
    showToast("报告详情暂不可用", error.message || "请稍后刷新重试。", "error");
  }
  if (currentRoute() === "monitoring") render();
}

function diagnosticActionTargetLabel(target) {
  return { question_library: "问题词库", knowledge: "企业知识库", cms: "官网 CMS", content_plan: "内容计划" }[target] || target || "待选择";
}

function diagnosticActionTarget(actionType) {
  return {
    question_library_candidate: "question_library",
    knowledge_gap: "knowledge",
    cms_task: "cms",
    content_plan: "content_plan",
    topic_candidate: "content_plan",
    publishing_strategy: "content_plan"
  }[actionType] || "question_library";
}

async function confirmDiagnosticAction(reportId, actionId) {
  if (!reportId || !actionId || ui.diagnosticActionId) return;
  const action = (diagnosticSnapshot.actions || []).find((item) => String(item.id || item.actionId) === String(actionId));
  const target = diagnosticActionTarget(action?.actionType || action?.type);
  if (!await uiConfirm(`确认将这条建议回流到“${diagnosticActionTargetLabel(target)}”？\n\n系统只创建待确认内容，不会自动发布。`)) return;
  ui.diagnosticActionId = actionId;
  render();
  try {
    const payload = await productionApi(`/api/v1/diagnostics/actions/${encodeURIComponent(actionId)}/confirm`, {
      method: "POST",
      body: { reportId, target, confirmedAt: new Date().toISOString() }
    });
    const appliedAction = diagnosticApiEntity(payload, ["action"]);
    if (appliedAction?.id || appliedAction?.actionId) {
      const id = appliedAction.id || appliedAction.actionId;
      diagnosticSnapshot.actions = [appliedAction, ...diagnosticSnapshot.actions.filter((item) => String(item.id || item.actionId) !== String(id))];
    }
    await hydrateWorkspaceFromServer();
    await refreshOperationDiagnostics({ silent: true });
    await openDiagnosticReport(reportId);
    showToast("建议已确认回流", `已写入${diagnosticActionTargetLabel(target)}的待处理内容；不会自动发布。`, "success");
  } catch (error) {
    showToast("回流未执行", `${error.message || "诊断回流接口待连接"}。没有写入未经验证的数据。`, "error");
  } finally {
    ui.diagnosticActionId = null;
    if (currentRoute() === "monitoring") render();
  }
}


function diagnosticDataState() {
  if (diagnosticSnapshot.loading) return '<div class="monitor-real-note"><span class="loading-spinner dark"></span><div><b>正在读取研究数据服务</b><small>同步 Citation Lab 数据版本、仓库资料和诊断规则。</small></div></div>';
  if (diagnosticSnapshot.loaded) return `<div class="monitor-real-note success"><span data-icon="check"></span><div><b>研究数据服务已连接</b><small>当前研究基线为 Citation Lab ${CITATION_LAB_PACKAGE.version}，历史分析报告继续绑定原数据版本。</small></div></div>`;
  return `<div class="monitor-real-note warning"><span data-icon="alert"></span><div><b>研究数据服务待连接</b><small>${escapeHtml(diagnosticSnapshot.error || "尚未读取研究数据包与更新状态。官网实测仍可独立使用。")}</small></div></div>`;
}

function analysisRunStatusMeta(status) {
  return {
    queued: ["排队中", "pending"],
    running: ["分析中", "running"],
    completed: ["已完成", "completed"],
    failed: ["分析失败", "failed"]
  }[String(status || "").toLowerCase()] || ["等待开始", "pending"];
}

function analysisRunBadge(status) {
  const [label, tone] = analysisRunStatusMeta(status);
  return `<span class="analysis-run-badge ${tone}">${tone === "running" ? '<span class="loading-spinner dark"></span>' : `<i></i>`}${escapeHtml(label)}</span>`;
}

function analysisToolLabel(toolName) {
  const tool = (analysisWorkbenchSnapshot.options?.tools || []).find((item) => item.name === toolName);
  const local = {
    dataset_overview: "读取数据集范围", platform_profile: "计算四平台引用画像", source_mix: "统计信源类型与生态",
    content_format_mix: "统计内容格式与摘要特征", date_distribution: "统计被引页面日期分布", top_domains: "统计高频与独有域名",
    domain_overlap: "计算平台信源重叠", question_segment_matrix: "计算问题类型 × 平台矩阵", industry_coverage: "检查目标行业样本覆盖",
    enterprise_knowledge_search: "检索企业知识库", site_operations_snapshot: "读取官网与运营摘要"
  };
  return tool?.label || local[toolName] || toolName || "分析工具";
}

function analysisConsentScope(dataSources = ui.analysisDataSources) {
  const parts = ["本次分析需求"];
  if (dataSources.includes("citation_lab")) parts.push("Citation Lab 受控统计摘要");
  if (dataSources.includes("enterprise_knowledge")) parts.push("企业知识库检索命中的片段");
  if (dataSources.includes("site_operations")) parts.push("官网与运营汇总数据");
  return `${parts.join("、")}会发送给所选大模型；不会发送 API Key、整库文件、未命中知识或任意 SQL。`;
}

const ANALYSIS_CONTENT_LABELS = Object.freeze({
  summary: "核心结论", overview: "核心结论", table: "数据明细", rows: "数据明细", columns: "指标", headers: "指标",
  platforms: "平台对比", platformStrategies: "平台策略", recommendedFormats: "推荐内容形式", recommendedActions: "建议动作",
  phases: "执行阶段", scope: "数据口径", platform: "平台", label: "平台", pair: "平台组合", phase: "阶段",
  activities: "重点工作", focus: "重点方向", questionType: "问题类型", qCount: "问题数", sharedDomains: "共同域名",
  jaccard: "重合度", topCategory: "主要信源", topEcosystem: "主要生态", rankingShare: "榜单内容占比",
  guideShare: "指南内容占比", avgSnippet: "平均摘要长度", highest: "最高重叠", lowest: "最低重叠", overlap: "平台重叠情况", citationObservationCount: "引用观察数",
  preferredCitationObservationCount: "偏好引用观察数", questionCount: "问题数", citationsPerQuestion: "每问题引用数",
  sourceCount: "信源数", pageCount: "页面数", domainCount: "域名数", exclusiveDomainCount: "独有域名数",
  exclusiveDomainSharePct: "独有域名占比", averageQuotePosition: "平均引用位置", averageSnippetLength: "平均摘要长度",
  longSnippetSharePct: "长摘要占比", sourceCategories: "信源类别", sourceTypes: "信源类型", ecosystems: "平台生态",
  contentFormats: "内容形式", releaseYear: "发布年份", publicationYears: "页面年份分布", missingDateShare: "日期缺失占比",
  questionCoveragePct: "问题覆盖率", title: "标题", category: "类别", path: "路径", sourceUrl: "来源地址", score: "匹配度"
});

const ANALYSIS_SECTION_KIND_LABELS = Object.freeze({
  overview: "研究范围", table: "数据对比", platform: "平台洞察", strategy: "策略建议", roadmap: "执行路线", analysis: "分析洞察"
});

function analysisContentLabel(key) {
  const source = String(key || "").trim();
  if (!source) return "内容";
  return ANALYSIS_CONTENT_LABELS[source] || source.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function analysisTableCell(value, depth = 0) {
  if (value === null || value === undefined || value === "") return '<span class="analysis-empty-value">—</span>';
  if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
    return `<div class="analysis-inline-list">${value.map((item) => `<span>${escapeHtml(String(item))}</span>`).join("")}</div>`;
  }
  if (typeof value === "object") return analysisContentValue(value, depth + 1);
  return `<span>${escapeHtml(String(value))}</span>`;
}

function analysisRowsTable(rows, depth = 0) {
  const items = rows.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  if (!items.length) return `<ul class="analysis-value-list">${rows.map((item) => `<li>${analysisContentValue(item, depth + 1)}</li>`).join("")}</ul>`;
  const keys = [...new Set(items.flatMap((item) => Object.keys(item)))].slice(0, 10);
  if (!keys.length) return '<span class="analysis-empty-value">暂无数据</span>';
  return `<div class="analysis-data-table-wrap"><table class="analysis-data-table"><thead><tr>${keys.map((key) => `<th>${escapeHtml(analysisContentLabel(key))}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr>${keys.map((key) => `<td>${analysisTableCell(item[key], depth + 1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function analysisMatrixTable(value, depth = 0) {
  const columns = Array.isArray(value?.columns) ? value.columns : Array.isArray(value?.headers) ? value.headers : [];
  const rows = Array.isArray(value?.rows) ? value.rows : [];
  if (!columns.length || !rows.length) return null;
  return `<div class="analysis-data-table-wrap"><table class="analysis-data-table"><thead><tr>${columns.map((column) => `<th>${escapeHtml(analysisContentLabel(column))}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => { const cells = Array.isArray(row) ? row : columns.map((column) => row?.[column]); return `<tr>${cells.map((cell) => `<td>${analysisTableCell(cell, depth + 1)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}

function analysisContentValue(value, depth = 0) {
  if (value === null || value === undefined || value === "") return '<span class="analysis-empty-value">暂无数据</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="analysis-empty-value">暂无数据</span>';
    if (value.every((item) => item && typeof item === "object" && !Array.isArray(item))) return analysisRowsTable(value, depth + 1);
    return `<ul class="analysis-value-list">${value.map((item) => `<li>${analysisContentValue(item, depth + 1)}</li>`).join("")}</ul>`;
  }
  if (typeof value === "object") {
    const matrix = analysisMatrixTable(value, depth + 1);
    if (matrix) return matrix;
    return `<dl class="analysis-value-map">${Object.entries(value).map(([key, item]) => `<div><dt>${escapeHtml(analysisContentLabel(key))}</dt><dd>${analysisContentValue(item, depth + 1)}</dd></div>`).join("")}</dl>`;
  }
  return `<span>${escapeHtml(String(value))}</span>`;
}

function analysisSectionContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return analysisContentValue(value);
  const matrix = analysisMatrixTable(value);
  if (matrix) {
    const supportingEntries = Object.entries(value).filter(([key]) => !["columns", "headers", "rows"].includes(key));
    return `<div class="analysis-content-structured">${matrix}${supportingEntries.length ? `<div class="analysis-content-groups">${supportingEntries.map(([key, item]) => `<section class="analysis-content-group"><h4>${escapeHtml(analysisContentLabel(key))}</h4>${analysisContentValue(item, 1)}</section>`).join("")}</div>` : ""}</div>`;
  }
  const summary = typeof value.summary === "string" ? value.summary : typeof value.overview === "string" ? value.overview : "";
  const entries = Object.entries(value).filter(([key]) => !["summary", "overview"].includes(key));
  return `<div class="analysis-content-structured">${summary ? `<p class="analysis-content-summary">${escapeHtml(summary)}</p>` : ""}${entries.length ? `<div class="analysis-content-groups">${entries.map(([key, item]) => `<section class="analysis-content-group"><h4>${escapeHtml(analysisContentLabel(key))}</h4>${analysisContentValue(item, 1)}</section>`).join("")}</div>` : ""}${!summary && !entries.length ? '<span class="analysis-empty-value">暂无数据</span>' : ""}</div>`;
}

function analysisEvidenceShortLabel(value) {
  const source = String(value || "");
  const ordinal = source.match(/-(\d{2})$/)?.[1];
  return ordinal ? `证据 ${ordinal}` : "查看证据";
}

const ANALYSIS_DIMENSION_LABELS = Object.freeze({
  platform_profile: "平台引用画像", source_preferences: "信源类型与生态", content_formats: "内容格式", top_domains: "高频域名",
  platform_overlap: "平台重叠差异", question_patterns: "问题类型", publication_time: "页面时效", content_strategy: "内容策略",
  source_strategy: "信源策略", execution_roadmap: "执行路线"
});

function renderAnalysisPlanReview() {
  const intent = ui.analysisPlan?.intent;
  if (!intent) return "";
  const platforms = Object.entries(ANALYSIS_PLATFORM_META).map(([name, meta]) => {
    const checked = (intent.platforms || []).includes(name);
    return `<label class="analysis-platform-chip ${checked ? "selected" : ""}"><input type="checkbox" data-analysis-plan-platform="${escapeHtml(name)}" ${checked ? "checked" : ""}/><i>${escapeHtml(meta.short)}</i><span>${escapeHtml(name)}</span><b data-icon="check"></b></label>`;
  }).join("");
  const dimensions = (intent.dimensions || []).map((item) => `<span>${escapeHtml(ANALYSIS_DIMENSION_LABELS[item] || item)}</span>`).join("");
  const questions = (intent.representativeQuestions || []).join("\n");
  const executionPlan = [
    { toolName: "interpret_research_request" },
    ...(ui.analysisPlan.plan || []).filter((item) => item?.toolName !== "interpret_research_request")
  ];
  const plan = executionPlan.map((item, index) => `<li><i>${String(index + 1).padStart(2, "0")}</i><span><b>${escapeHtml(analysisToolLabel(item.toolName))}</b><small>${escapeHtml(item.toolName)}</small></span></li>`).join("");
  return `<section class="card analysis-plan-review">
    <header><span data-icon="check"></span><div><small>AI 已完成任务理解</small><h3>核对研究计划后开始查库</h3><p>这里显示的是查询计划，不是分析结论；你可以修改行业、平台和代表问题。</p></div><em>${escapeHtml(intent.scopeMode === "global_baseline" ? "只用全库基线" : "自动验证行业样本")}</em></header>
    <div class="analysis-plan-grid">
      <label><span>目标行业 / 业务领域</span><input class="input" id="analysis-plan-industry" value="${escapeHtml(intent.industry || "")}" placeholder="如：GEO运营、工业品制造"/></label>
      <div><span>目标平台</span><div class="analysis-platform-row">${platforms}</div></div>
    </div>
    <div class="analysis-plan-dimensions"><b>分析维度</b><div>${dimensions || "<span>按提示词生成</span>"}</div></div>
    <label class="analysis-plan-questions"><span>代表性客户问题 <small>用于检查仓库是否有相关问题样本；没有匹配时会明确回退全库基线</small></span><textarea id="analysis-plan-questions" rows="5" placeholder="每行一个问题">${escapeHtml(questions)}</textarea></label>
    <details class="analysis-plan-tools"><summary>查看将运行的 ${executionPlan.length} 个受控工具</summary><ol>${plan}</ol></details>
    <div class="analysis-plan-boundary"><span data-icon="info"></span><p><b>证据边界：</b>系统会先检查直接行业样本。若 Citation Lab 没有“${escapeHtml(intent.industry || "目标行业")}”标签，报告会明确写成“四平台全库历史基线 + 行业策略推演”，不会伪装成该行业实测。</p></div>
  </section>`;
}

function renderAnalysisComposer() {
  const providers = workbenchConfiguredProviders();
  const selectedProvider = analysisWorkbenchProvider();
  const sourceCards = Object.entries(ANALYSIS_DATA_SOURCE_META).map(([id, meta]) => {
    const checked = ui.analysisDataSources.includes(id);
    return `<label class="analysis-choice-card ${checked ? "selected" : ""}"><input type="checkbox" data-analysis-source="${id}" ${checked ? "checked" : ""}/><span data-icon="${meta.icon}"></span><b>${escapeHtml(meta.label)}</b><small>${escapeHtml(meta.description)}</small><i></i></label>`;
  }).join("");
  const providerOptions = providers.map((provider) => `<option value="${escapeHtml(provider.id)}" ${provider.id === selectedProvider?.id ? "selected" : ""}>${escapeHtml(provider.name || provider.model || provider.id)} · ${escapeHtml(provider.model || "默认模型")}</option>`).join("");
  const hasPlan = Boolean(ui.analysisPlan?.intent);
  return `<div class="analysis-composer">
    <section class="analysis-intro">
      <span class="analysis-kicker"><i data-icon="sparkle"></i> Citation Lab 数据库 × 仓库研究资料 × 大模型</span>
      <h2>直接告诉 AI，你要研究什么</h2>
      <p>系统先把自然语言要求转换成可核对的研究计划，再查询本地真实数据和仓库资料，最后生成带证据的报告。</p>
    </section>
    <section class="card analysis-prompt-card ${hasPlan ? "has-plan" : ""}">
      <label for="analysis-prompt">分析要求</label>
      <textarea id="analysis-prompt" rows="8" placeholder="例如：我现在在 GEO运营行业，请基于本地 Citation Lab 数据分析豆包、DeepSeek、千问和元宝的引用偏好，并结合洞察制定内容与信源策略。">${escapeHtml(ui.analysisPrompt)}</textarea>
      <div class="analysis-prompt-foot"><span><i data-icon="info"></i>行业、平台、分析维度和期望输出都可以直接写在这里</span><b>${ui.analysisPrompt.length.toLocaleString("zh-CN")} / 40,000</b></div>
    </section>
    <section class="analysis-primary-controls"><div><label>分析模型</label><select class="input" id="analysis-provider" ${!providers.length ? "disabled" : ""}>${providerOptions || '<option value="">尚未配置可用模型</option>'}</select></div><button class="secondary-button" type="button" data-action="analysis-open-model-settings"><span data-icon="settings"></span>${providers.length ? "管理模型" : "配置 API"}</button><button class="text-button" type="button" data-action="analysis-toggle-advanced"><span data-icon="settings"></span>${ui.analysisAdvancedOpen ? "收起高级设置" : "高级设置"}</button></section>
    <section class="analysis-advanced" ${ui.analysisAdvancedOpen ? "" : "hidden"}>
      <div class="analysis-config-section"><div class="analysis-config-title"><i>01</i><span><b>可用数据源</b><small>Citation Lab 默认启用；企业数据只有勾选后才会读取</small></span></div><div class="analysis-source-grid">${sourceCards}</div></div>
      <div class="analysis-config-section"><div class="analysis-config-title"><i>02</i><span><b>默认报告深度</b><small>AI 也会根据提示词识别，确认计划时可以复核</small></span></div><div class="analysis-depth-row">${[["quick", "快速分析", "核心事实与建议"], ["detailed", "详细报告", "平台、信源、内容与路线"], ["custom", "自定义", "追加具体结构要求"]].map(([id, label, description]) => `<label class="analysis-depth-card ${ui.analysisReportDepth === id ? "selected" : ""}"><input type="radio" name="analysis-depth" value="${id}" ${ui.analysisReportDepth === id ? "checked" : ""}/><b>${label}</b><small>${description}</small><i></i></label>`).join("")}</div>${ui.analysisReportDepth === "custom" ? `<textarea class="input analysis-custom-depth" id="analysis-custom-depth" rows="3" placeholder="补充报告结构或关注点。">${escapeHtml(ui.analysisCustomDepth)}</textarea>` : ""}</div>
    </section>
    ${renderAnalysisPlanReview()}
    ${analysisWorkbenchSnapshot.error ? `<div class="monitor-real-note warning"><span data-icon="alert"></span><div><b>分析工作台提示</b><small>${escapeHtml(analysisWorkbenchSnapshot.error)}</small></div></div>` : ""}
    <div class="analysis-submit-row"><span><i data-icon="lock"></i>模型只负责理解任务和分析受控证据，不能执行任意 SQL，也不能读取整库。</span><div>${hasPlan ? '<button class="secondary-button" type="button" data-action="analysis-plan-preview">重新解析并执行</button>' : ""}<button class="primary-button analysis-submit-button" type="button" data-action="${hasPlan ? "analysis-confirm-run" : "analysis-plan-preview"}" ${ui.analysisPlanning || ui.analysisSubmitting || !providers.length ? "disabled" : ""}>${ui.analysisPlanning ? '<span class="loading-spinner"></span>正在理解要求' : ui.analysisSubmitting ? '<span class="loading-spinner"></span>正在创建任务' : hasPlan ? '<span data-icon="sparkle"></span>重新开始真实分析' : '<span data-icon="sparkle"></span>开始真实分析'}</button></div></div>
  </div>`;
}

function renderAnalysisRun(run) {
  if (!run) return "";
  const planned = Array.isArray(run.plan) ? run.plan : [];
  const calls = Array.isArray(run.toolCalls) ? run.toolCalls : [];
  const entries = calls.length ? calls : planned.map((item, index) => ({ id: `planned-${index}`, ordinal: index + 1, toolName: item.toolName, status: "queued", evidenceId: "" }));
  const completed = entries.filter((item) => item.status === "completed").length;
  const percent = run.status === "completed" ? 100 : entries.length ? Math.round((completed / entries.length) * 78) + (run.status === "running" ? 12 : 0) : run.status === "running" ? 12 : 0;
  return `<section class="card analysis-run-card"><div class="analysis-run-head"><div><small>本次分析运行</small><h3>受控工具与证据进度</h3><p>先生成事实台账，再由大模型组织报告；模型不能直接查询数据库。</p></div>${analysisRunBadge(run.status)}</div><div class="analysis-progress"><i style="width:${Math.min(100, percent)}%"></i></div><div class="analysis-tool-list">${entries.map((tool) => `<div class="analysis-tool-row ${escapeHtml(tool.status || "queued")}"><i>${String(Number(tool.ordinal || 0)).padStart(2, "0")}</i><span><b>${escapeHtml(analysisToolLabel(tool.toolName))}</b><small>${tool.evidenceId ? `证据 ${escapeHtml(tool.evidenceId)}` : tool.status === "running" ? "正在计算并固化证据" : tool.status === "failed" ? escapeHtml(tool.errorMessage || "执行失败") : "等待执行"}</small></span>${tool.status === "completed" ? '<b data-icon="check"></b>' : tool.status === "running" ? '<span class="loading-spinner dark"></span>' : tool.status === "failed" ? '<b class="failed" data-icon="alert"></b>' : '<em></em>'}</div>`).join("") || '<div class="analysis-tool-empty">正在规划所需的本地统计工具…</div>'}</div>${run.status === "failed" ? `<div class="analysis-run-error"><span data-icon="alert"></span><div><b>${escapeHtml(run.errorCode || "分析运行失败")}</b><p>${escapeHtml(run.errorMessage || "请检查模型配置、网络或数据源后重新分析。")}</p></div></div>` : ""}</section>`;
}

function renderAnalysisReport(session, artifact) {
  if (!artifact) return "";
  const run = (session.runs || []).find((item) => item.id === artifact.runId) || analysisWorkbenchActiveRun();
  const evidence = run?.toolCalls || [];
  const model = artifact.methodology?.model || {};
  const researchIntent = artifact.methodology?.researchIntent || {};
  const cohort = artifact.methodology?.cohort || null;
  const cohortLabel = cohort?.mode === "industry_label" ? `直接行业样本 · ${cohort.questionCount || 0} 个问题`
    : cohort?.mode === "matched_representative_questions" ? `相关问题样本 · ${cohort.questionCount || 0} 个问题`
      : cohort?.mode === "explicit_question_ids" ? `指定问题样本 · ${cohort.questionCount || 0} 个问题`
        : "四平台全库历史基线";
  const sectionRows = artifact.sections || [];
  const sectionNavigation = sectionRows.map((section, index) => `<button type="button" data-action="analysis-jump-section" data-section-target="analysis-report-section-${index + 1}"><i>${String(index + 1).padStart(2, "0")}</i><span>${escapeHtml(section.title || `第 ${index + 1} 部分`)}</span></button>`).join("");
  const sections = sectionRows.map((section, index) => `<article class="analysis-report-section ${escapeHtml(section.kind || "analysis")}" id="analysis-report-section-${index + 1}"><header><i>${String(index + 1).padStart(2, "0")}</i><div><small>${escapeHtml(ANALYSIS_SECTION_KIND_LABELS[section.kind] || "分析洞察")}</small><h3>${escapeHtml(section.title || `第 ${index + 1} 部分`)}</h3></div></header><div class="analysis-report-content">${analysisSectionContent(section.content)}</div><footer><b>数据依据</b>${(section.evidenceIds || []).map((id) => `<span title="${escapeHtml(id)}">${escapeHtml(analysisEvidenceShortLabel(id))}</span>`).join("")}</footer></article>`).join("");
  const recommendations = (artifact.recommendations || []).map((item, index) => `<article class="analysis-recommendation ${escapeHtml(item.priority || "medium")}"><header><i>${index + 1}</i><span>${escapeHtml({ critical: "立即处理", high: "高优先级", medium: "中优先级", low: "低优先级" }[item.priority] || "执行建议")}</span></header><div><h4>${escapeHtml(item.title || "GEO 行动建议")}</h4><p>${escapeHtml(item.rationale || "")}</p>${item.expectedOutcome ? `<small><b>验收目标</b>${escapeHtml(item.expectedOutcome)}</small>` : ""}<footer>${(item.evidenceIds || []).map((id) => `<em title="${escapeHtml(id)}">${escapeHtml(analysisEvidenceShortLabel(id))}</em>`).join("")}</footer></div></article>`).join("");
  const limitations = (artifact.limitations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const suggestions = (artifact.followUpSuggestions || []).map((item) => `<button type="button" data-action="analysis-use-suggestion" data-suggestion="${escapeHtml(item)}"><span data-icon="arrow"></span>${escapeHtml(item)}</button>`).join("");
  const executiveSummary = String(artifact.executiveSummary || "").trim();
  const executivePreview = executiveSummary.length > 330 ? `${executiveSummary.slice(0, 330).replace(/[，；、：\s]+$/u, "")}……` : executiveSummary;
  const completedEvidence = evidence.filter((item) => item.status === "completed").length;
  const platformCount = (researchIntent.platforms || session.platforms || []).length;
  return `<div class="analysis-report">
    <section class="analysis-report-cover"><div class="analysis-report-cover-copy"><span>运营诊断报告 · V${Number(artifact.version || 1)}</span><h2>${escapeHtml(artifact.title)}</h2><div class="analysis-executive-summary"><b>执行摘要</b><p>${escapeHtml(executivePreview || "本报告暂无执行摘要。")}</p>${executiveSummary.length > 330 ? `<details><summary>展开完整摘要</summary><p>${escapeHtml(executiveSummary)}</p></details>` : ""}</div><div class="analysis-report-meta"><em>${escapeHtml(model.providerName || model.providerId || "已配置模型")}</em><em>${escapeHtml(model.model || session.model || "默认模型")}</em><em>${escapeHtml(formatDateTime(artifact.createdAt))}</em></div></div><div class="analysis-report-facts"><div><small>研究口径</small><b>${escapeHtml(cohortLabel)}</b></div><div><small>目标平台</small><b>${platformCount || "—"} 个</b></div><div><small>数据版本</small><b>${escapeHtml(artifact.methodology?.dataVersion || "—")}</b></div><div><small>固化证据</small><b>${completedEvidence} 条</b></div></div></section>
    <section class="analysis-report-scope"><span data-icon="database"></span><div><b>数据范围与可追溯性</b><p>${escapeHtml((session.dataSources || []).map((id) => ANALYSIS_DATA_SOURCE_META[id]?.label || id).join("、"))} · ${escapeHtml((researchIntent.platforms || session.platforms || []).join("、"))} · ${escapeHtml(cohortLabel)} · 数据版本 ${escapeHtml(artifact.methodology?.dataVersion || "—")}。所有正式章节都引用本次运行生成的 AFE 证据 ID。</p></div><button class="secondary-button button-small" type="button" data-action="analysis-toggle-evidence">${ui.analysisEvidenceOpen ? "收起证据" : "查看证据台账"}</button></section>
    <div class="analysis-evidence-ledger" ${ui.analysisEvidenceOpen ? "" : "hidden"}>${evidence.map((tool) => `<article class="analysis-evidence-entry"><header><span>${escapeHtml(analysisEvidenceShortLabel(tool.evidenceId))}</span><div><b>${escapeHtml(analysisToolLabel(tool.toolName))}</b><small title="${escapeHtml(tool.evidenceId || "")}">${escapeHtml(tool.evidenceId || "—")}</small></div><em>${escapeHtml(tool.status === "completed" ? "已保存" : tool.errorMessage || tool.status || "等待执行")}</em></header>${tool.status === "completed" ? `<details><summary>查看查询口径与原始结果</summary><div>${analysisContentValue({ arguments: tool.arguments || {}, result: tool.result || {} })}</div></details>` : ""}</article>`).join("") || '<p>本报告没有可展示的工具证据。</p>'}</div>
    <section class="analysis-report-body"><div class="analysis-report-heading"><span>报告正文</span><h3>依据本地事实台账形成的分析</h3><p>先看结论，再查看数据明细；右侧证据标签可在上方证据台账中复核。</p></div><div class="analysis-report-reading-layout"><nav class="analysis-report-toc"><b>报告目录</b>${sectionNavigation}</nav><div class="analysis-report-sections">${sections}</div></div></section>
    ${recommendations ? `<section class="analysis-report-block"><div class="analysis-report-heading"><span>执行路径</span><h3>按优先级推进的 GEO 行动建议</h3></div><div class="analysis-recommendation-list">${recommendations}</div></section>` : ""}
    ${limitations ? `<section class="analysis-limitations"><span data-icon="alert"></span><div><b>数据边界与限制</b><ul>${limitations}</ul></div></section>` : ""}
    <section class="card analysis-follow-up"><div><span data-icon="sparkle"></span><span><b>继续与 AI 协作</b><small>追问会保留本会话的报告和证据上下文，并生成新版本报告</small></span></div>${suggestions ? `<div class="analysis-suggestions">${suggestions}</div>` : ""}<textarea id="analysis-follow-up" rows="4" placeholder="例如：把执行建议改成适合 3 人运营团队的 30/60/90 天计划，并明确每周产出数量。">${escapeHtml(ui.analysisFollowUp)}</textarea><div class="analysis-follow-up-foot"><span class="analysis-consent-note"><span data-icon="check"></span>自动沿用本会话已选数据摘要与模型</span><button class="primary-button" type="button" data-action="analysis-follow-up-submit" ${ui.analysisSubmitting ? "disabled" : ""}><span data-icon="send"></span>发送并生成新版报告</button></div></section>
  </div>`;
}

function renderAnalysisSessionList() {
  const sessions = analysisWorkbenchSnapshot.sessions || [];
  return `<aside class="analysis-session-panel"><div class="analysis-session-head"><span><b>分析会话</b><small>${sessions.length} 个已保存会话</small></span><button type="button" data-action="analysis-new-session" title="新建分析"><span data-icon="plus"></span></button></div><div class="analysis-session-list">${sessions.map((session) => { const [status] = analysisRunStatusMeta(session.latestRunStatus); return `<div class="analysis-session-row ${ui.analysisSessionId === session.id ? "active" : ""}"><button type="button" class="analysis-session-item ${ui.analysisSessionId === session.id ? "active" : ""}" data-action="analysis-open-session" data-session-id="${escapeHtml(session.id)}"><i data-icon="chart"></i><span><b>${escapeHtml(session.title)}</b><small>V${Number(session.artifactCount || 0)} · ${escapeHtml(status)} · ${escapeHtml(formatDateTime(session.updatedAt))}</small></span><em data-icon="arrow"></em></button><button type="button" class="analysis-session-delete" data-action="analysis-delete-session" data-session-id="${escapeHtml(session.id)}" aria-label="删除报告：${escapeHtml(session.title)}" title="删除报告"><span data-icon="trash"></span></button></div>`; }).join("") || '<div class="analysis-session-empty"><span data-icon="file"></span><b>还没有分析会话</b><p>完成第一次真实分析后，报告和追问会保存在这里。</p></div>'}</div></aside>`;
}

function renderAnalysisWorkbench() {
  if (!analysisWorkbenchSnapshot.attempted && !analysisWorkbenchSnapshot.loading) queueMicrotask(() => refreshAnalysisWorkbench({ renderAfter: true }));
  const session = analysisWorkbenchSnapshot.activeSession;
  const run = analysisWorkbenchActiveRun();
  const artifact = session?.latestArtifact || session?.artifacts?.[0] || null;
  const sessionBody = run && (!ANALYSIS_RUN_TERMINAL.has(run.status) || run.status === "failed")
    ? renderAnalysisRun(run)
    : artifact
      ? renderAnalysisReport(session, artifact)
      : run?.status === "completed"
        ? '<div class="monitor-real-note warning"><span data-icon="alert"></span><div><b>报告制品未返回</b><small>运行已完成，但页面尚未读取到报告，请刷新会话。</small></div></div>'
        : renderAnalysisRun(run);
  const main = session ? `<div class="analysis-session-view"><div class="analysis-session-toolbar"><button class="text-button" type="button" data-action="analysis-new-session"><span data-icon="arrow"></span>返回新建分析</button><div><span>${escapeHtml((session.dataSources || []).map((id) => ANALYSIS_DATA_SOURCE_META[id]?.label || id).join(" + "))}</span>${analysisRunBadge(run?.status)}</div></div>${sessionBody}</div>` : renderAnalysisComposer();
  return `<div class="analysis-workbench-shell ${session && artifact ? "report-open" : ""}">${renderAnalysisSessionList()}<main class="analysis-workbench-main">${analysisWorkbenchSnapshot.loading && !session ? '<div class="analysis-loading"><span class="loading-spinner dark"></span><b>正在连接分析工作台</b></div>' : main}</main></div>`;
}

function legacyRenderDiagnosticOperationalEvidence() {
  const diagnostic = monitoringLatestDiagnostic();
  const lastCompletedDiagnostic = monitoringLatestCompletedDiagnostic();
  const diagnosticState = monitoringDiagnosticStateMeta(diagnostic);
  const scores = monitoringDiagnosticScores(diagnostic);
  const traffic = monitoringTrafficRecord();
  const points = traffic?.hasData === false ? [] : monitoringTrafficPoints(traffic);
  const rangeLabel = monitoringRangeLabel(ui.monitoringRange);
  const topPaths = Array.isArray(traffic?.topPaths || traffic?.paths) ? (traffic.topPaths || traffic.paths) : [];
  const bots = Array.isArray(traffic?.bots || traffic?.botDistribution || traffic?.robots) ? (traffic.bots || traffic.botDistribution || traffic.robots) : [];
  const pv = monitoringMetric(traffic || {}, ["pv", "totalPv", "visits", "pageViews", "total"]);
  const production = monitoringProductionStats();
  const diagnosticUrl = diagnostic?.url || diagnostic?.sourceUrl || siteCms()?.settings?.diagnosticUrl || state.site?.remoteUrl || (state.site?.domain ? `https://${state.site.domain}` : "");
  const updatedAt = diagnostic?.completedAt || diagnostic?.createdAt || diagnostic?.updatedAt || null;
  const lastCompletedAt = lastCompletedDiagnostic?.completedAt || lastCompletedDiagnostic?.createdAt || lastCompletedDiagnostic?.updatedAt || null;
  const textProviders = enabledAiProviders("text");
  const selectedSuggestionProviderId = String(ui.monitoringSuggestionProviderId || selectedTextProviderId() || textProviders[0]?.id || "");
  const suggestionProviderOptions = textProviders.length
    ? textProviders.map((provider) => `<option value="${escapeHtml(provider.id)}" ${provider.id === selectedSuggestionProviderId ? "selected" : ""}>${escapeHtml(provider.name || provider.id)} · ${escapeHtml(provider.model || provider.modelId || "默认模型")}</option>`).join("")
    : '<option value="">暂无可用文本模型</option>';
  const pathRows = topPaths.slice(0, 4).map((item) => `<li><span>${escapeHtml(String(item.path || item.url || item.name || "—"))}</span><b>${monitoringDisplayNumber(item.pv ?? item.visits ?? item.value ?? item.count)}</b></li>`).join("");
  const botRows = bots.slice(0, 4).map((item) => `<li><span>${escapeHtml(monitoringTrafficLabel(item.name || item.bot || item.userAgent))}</span><b>${monitoringDisplayNumber(item.pv ?? item.visits ?? item.value ?? item.count)}</b></li>`).join("");
  const diagnosticFoot = diagnosticState.key === "completed"
    ? `最近完成：${escapeHtml(formatDateTime(updatedAt))}`
    : diagnosticState.key === "failed"
      ? `失败时间：${updatedAt ? escapeHtml(formatDateTime(updatedAt)) : "—"}${lastCompletedAt ? ` · 最近成功：${escapeHtml(formatDateTime(lastCompletedAt))}` : ""}`
      : diagnosticState.key === "running"
        ? "检测完成前不会计算或显示分数"
        : "尚无服务端诊断报告";
  return `
    <section class="diagnostic-evidence-section">
      <div class="diagnostic-section-title"><div><span>企业实测证据</span><h3>官网信源能力、抓取可达性与运营执行健康</h3><p>官网检测、访问日志和运营执行分开呈现；机器人访问只说明可达，不代表已被 AI 回答引用。</p></div></div>
      <div class="diagnostic-evidence-grid">
        <article class="card diagnostic-evidence-card website"><div class="diagnostic-evidence-card-head"><span data-icon="globe"></span><div><small>官网信源能力</small><h4>网站 GEO 诊断</h4></div><b>${monitoringDisplayNumber(scores.total)}<em>/100</em></b></div><div class="diagnostic-run-status ${escapeHtml(diagnosticState.className)}"><b>${escapeHtml(diagnosticState.label)}</b><small>${escapeHtml(diagnosticState.message)}</small></div><div class="diagnostic-mini-metrics"><span>Schema <b>${monitoringDisplayNumber(scores.schema)}</b></span><span>内容 <b>${monitoringDisplayNumber(scores.content)}</b></span><span>Meta <b>${monitoringDisplayNumber(scores.meta)}</b></span><span>权威外链 <b>${monitoringDisplayNumber(scores.authority)}</b></span></div><div class="diagnostic-run-row"><input class="input" id="monitoring-diagnostic-url" value="${escapeHtml(diagnosticUrl)}" placeholder="https://www.example.com/" /><button class="secondary-button button-small" type="button" data-action="run-monitoring-diagnostic">开始实测</button></div><small class="diagnostic-url-help">仅填写可公开访问的 HTTP/HTTPS 地址；使用 HTTPS 时请确认该端口已配置证书。</small><small class="diagnostic-card-foot">${diagnosticFoot}</small></article>
        <article class="card diagnostic-evidence-card traffic"><div class="diagnostic-evidence-card-head"><span data-icon="chart"></span><div><small>访问与抓取</small><h4>${ui.monitoringRange} 天官网访问趋势</h4></div><b>${monitoringDisplayNumber(pv)}<em> PV</em></b></div>${monitoringTrendBars(points)}<div class="diagnostic-list-pair"><div class="monitor-real-list"><h4>Top 路径</h4><ul>${pathRows || '<li class="empty"><span>等待访问日志</span><b>—</b></li>'}</ul></div><div class="monitor-real-list"><h4>访问类型分布</h4><ul>${botRows || '<li class="empty"><span>等待访问分类</span><b>—</b></li>'}</ul></div></div><small class="diagnostic-card-foot">AI/搜索爬虫访问 ≠ AI 引用、推荐或排名</small></article>
      </div>
      <div class="monitor-real-production-grid diagnostic-production-grid"><article class="card"><span data-icon="file"></span><small>文章总数</small><b>${monitoringDisplayNumber(production.articleTotal)}</b><p>草稿 / 审核中：${monitoringDisplayNumber(production.draft)}</p></article><article class="card"><span data-icon="check"></span><small>可发布文章</small><b>${monitoringDisplayNumber(production.approved)}</b><p>已发布：${monitoringDisplayNumber(production.published)}</p></article><article class="card"><span data-icon="target"></span><small>内容任务</small><b>${monitoringDisplayNumber(production.taskTotal)}</b><p>计划与文章任务汇总</p></article><article class="card"><span data-icon="send"></span><small>发布运行</small><b>${monitoringDisplayNumber(production.publishRunning)}</b><p>总目标 ${monitoringDisplayNumber(production.publishTotal)} · 异常 ${monitoringDisplayNumber(production.publishFailed)}</p></article></div>
    </section>`;
}


function renderDiagnosticOperationalEvidence() {
  const diagnostic = monitoringLatestDiagnostic();
  const lastCompletedDiagnostic = monitoringLatestCompletedDiagnostic();
  const diagnosticState = monitoringDiagnosticStateMeta(diagnostic);
  const scores = monitoringDiagnosticScores(diagnostic);
  const traffic = monitoringTrafficRecord();
  const points = traffic?.hasData === false ? [] : monitoringTrafficPoints(traffic);
  const rangeLabel = monitoringRangeLabel(ui.monitoringRange);
  const topPaths = Array.isArray(traffic?.topPaths || traffic?.paths) ? (traffic.topPaths || traffic.paths) : [];
  const bots = Array.isArray(traffic?.bots || traffic?.botDistribution || traffic?.robots) ? (traffic.bots || traffic.botDistribution || traffic.robots) : [];
  const pv = monitoringMetric(traffic || {}, ["pv", "totalPv", "pageViews", "total"]);
  const excludedRequests = monitoringMetric(traffic?.kpis || {}, ["excludedRequests"]) ?? 0;
  const production = monitoringProductionStats();
  const diagnosticUrl = diagnostic?.url || diagnostic?.sourceUrl || siteCms()?.settings?.diagnosticUrl || state.site?.remoteUrl || (state.site?.domain ? `https://${state.site.domain}` : "");
  const updatedAt = diagnostic?.completedAt || diagnostic?.createdAt || diagnostic?.updatedAt || null;
  const lastCompletedAt = lastCompletedDiagnostic?.completedAt || lastCompletedDiagnostic?.createdAt || lastCompletedDiagnostic?.updatedAt || null;
  const textProviders = enabledAiProviders("text");
  const selectedSuggestionProviderId = String(ui.monitoringSuggestionProviderId || selectedTextProviderId() || textProviders[0]?.id || "");
  const suggestionProviderOptions = textProviders.length
    ? textProviders.map((provider) => `<option value="${escapeHtml(provider.id)}" ${provider.id === selectedSuggestionProviderId ? "selected" : ""}>${escapeHtml(provider.name || provider.id)} · ${escapeHtml(provider.model || provider.modelId || "默认模型")}</option>`).join("")
    : '<option value="">暂无可用文本模型</option>';
  const pathRows = topPaths.slice(0, 4).map((item) => `<li><span>${escapeHtml(String(item.path || item.url || item.name || "—"))}</span><b>${monitoringDisplayNumber(item.pv ?? item.visits ?? item.value ?? item.count)}</b></li>`).join("");
  const botRows = bots.slice(0, 5).map((item) => `<li><span>${escapeHtml(monitoringTrafficLabel(item.name || item.bot || item.userAgent))}</span><b>${monitoringDisplayNumber(item.pv ?? item.visits ?? item.value ?? item.count)}</b></li>`).join("");
  const diagnosticFoot = diagnosticState.key === "completed"
    ? `最近完成：${escapeHtml(formatDateTime(updatedAt))}`
    : diagnosticState.key === "failed"
      ? `失败时间：${updatedAt ? escapeHtml(formatDateTime(updatedAt)) : "—"}${lastCompletedAt ? ` · 最近成功：${escapeHtml(formatDateTime(lastCompletedAt))}` : ""}`
      : diagnosticState.key === "running"
        ? "检测完成前不会计算或显示分数"
        : "尚无服务端诊断报告";
  const monitoringError = String(monitoringSnapshot.error || "").trim();
  const monitoringErrorMarkup = monitoringError
    ? `<div class="diagnostic-run-status error monitoring-inline-error" role="alert"><b>监测服务提示</b><small>${escapeHtml(monitoringError)}</small></div>`
    : "";
  const diagnosticBusy = monitoringSnapshot.loading || monitoringDiagnosticRunInFlight || Boolean(monitoringDiagnosticPollReportId);
  const requestScope = excludedRequests > 0
    ? `已排除 ${monitoringDisplayNumber(excludedRequests)} 条资源、协议入口、跳转或错误请求。`
    : "仅统计服务器成功返回的官网页面请求。";
  const operationCards = [
    ["file", `近 ${ui.monitoringRange} 天新增文章`, production.articleTotal, `草稿 / 审核中：${monitoringDisplayNumber(production.draft)}`],
    ["check", "审核通过", production.approved, `已发布：${monitoringDisplayNumber(production.published)}`],
    ["target", "内容任务", production.taskTotal, "按计划与文章任务汇总"],
    ["send", "发布运行中", production.publishRunning, `异常 ${monitoringDisplayNumber(production.publishFailed)} · 总目标 ${monitoringDisplayNumber(production.publishTotal)}`]
  ];
  return `
    <section class="diagnostic-evidence-section">
      <div class="diagnostic-section-title"><div><span>官网与运营实测</span><h3>把网站质量、有效页面请求和执行状态分开看</h3><p>所有访问统计均按东八区日界计算；页面请求不等同于真实访客、AI 引用、推荐或排名。</p></div></div>
      ${monitoringErrorMarkup}
      <div class="diagnostic-evidence-grid">
        <article class="card diagnostic-evidence-card website">
          <div class="diagnostic-evidence-card-head">${icon("globe")}<div><small>官网信源能力</small><h4>网站 GEO 诊断</h4></div><b>${monitoringDisplayNumber(scores.total)}<em>/100</em></b></div>
          <div class="diagnostic-run-status ${escapeHtml(diagnosticState.className)}"><b>${escapeHtml(diagnosticState.label)}</b><small>${escapeHtml(diagnosticState.message)}</small></div>
          <div class="diagnostic-mini-metrics"><span style="--score:${Math.min(100, Math.max(0, Number(scores.schema) || 0))}">Schema <b>${monitoringDisplayNumber(scores.schema)}</b></span><span style="--score:${Math.min(100, Math.max(0, Number(scores.content) || 0))}">内容 <b>${monitoringDisplayNumber(scores.content)}</b></span><span style="--score:${Math.min(100, Math.max(0, Number(scores.meta) || 0))}">Meta <b>${monitoringDisplayNumber(scores.meta)}</b></span><span style="--score:${Math.min(100, Math.max(0, Number(scores.authority) || 0))}">引用与链接 <b>${monitoringDisplayNumber(scores.authority)}</b></span></div>
          <div class="diagnostic-run-row"><input class="input" id="monitoring-diagnostic-url" value="${escapeHtml(diagnosticUrl)}" placeholder="https://www.example.com/" /><button class="secondary-button button-small" type="button" data-action="run-monitoring-diagnostic" ${diagnosticBusy ? "disabled" : ""}>开始实测</button></div>
          <div class="monitoring-suggestion-control"><label><input type="checkbox" id="monitoring-suggestion-generation" ${ui.monitoringSuggestionGeneration ? "checked" : ""} /> <span>使用已配置文本模型整理建议</span></label><select class="select" id="monitoring-suggestion-provider" ${!textProviders.length ? "disabled" : ""}>${suggestionProviderOptions}</select><small>默认仅使用规则建议；勾选后，模型只会整理已发现的问题和证据，不参与评分。</small></div>
          ${monitoringDiagnosticEvidenceMarkup(diagnostic)}
          <small class="diagnostic-url-help">仅填写可公开访问的 HTTP/HTTPS 地址；使用 HTTPS 时请确认该端口已配置证书。</small><small class="diagnostic-card-foot">${diagnosticFoot}</small>
        </article>
        <article class="card diagnostic-evidence-card traffic"><div class="diagnostic-evidence-card-head">${icon("chart")}<div><small>有效页面请求</small><h4>${rangeLabel}成功页面趋势</h4></div><b>${monitoringDisplayNumber(pv)}<em> 次</em></b></div>${monitoringTrendBars(points)}<div class="diagnostic-list-pair"><div class="monitor-real-list"><h4>Top 页面</h4><ul>${pathRows || '<li class="empty"><span>暂无成功页面请求</span><b>—</b></li>'}</ul></div><div class="monitor-real-list"><h4>请求类型</h4><ul>${botRows || '<li class="empty"><span>暂无可分类请求</span><b>—</b></li>'}</ul></div></div><small class="diagnostic-card-foot">${escapeHtml(requestScope)} UA 分类仅用于识别自动化流量。</small></article>
      </div>
      <section class="diagnostic-operation-section"><div class="diagnostic-operation-head"><div><span>内容与发布</span><h4>${rangeLabel}运营执行</h4></div><small>按所选周期汇总，不把历史总量混入当前任务。</small></div><div class="diagnostic-operation-grid">${operationCards.map(([iconName, label, value, note]) => `<article class="card diagnostic-operation-card"><span class="diagnostic-operation-icon">${icon(iconName)}</span><div><small>${escapeHtml(label)}</small><b>${monitoringDisplayNumber(value)}</b><p>${escapeHtml(note)}</p></div></article>`).join("")}</div></section>
    </section>`;
}

function monitoringRealtimeCard(title, record, note, accent = "blue") {
  const pv = monitoringLiveMetric(record, ["pv", "allPv", "totalPv", "pageViews", "total"]);
  const browser = monitoringLiveMetric(record, ["humanPv", "human"]);
  const ai = monitoringLiveMetric(record, ["aiBotPv", "aiBot"]);
  const search = monitoringLiveMetric(record, ["searchBotPv", "searchBot"]);
  return `<article class="card monitoring-realtime-card ${accent}"><div class="monitoring-realtime-head"><div><span>${escapeHtml(title)}</span><b>${monitoringDisplayNumber(pv)}<em> 次</em></b></div><i>${accent === "green" ? "昨日对比" : "LIVE"}</i></div><div class="monitoring-realtime-breakdown"><span>浏览器 <b>${monitoringDisplayNumber(browser)}</b></span><span>AI 爬虫 <b>${monitoringDisplayNumber(ai)}</b></span><span>搜索爬虫 <b>${monitoringDisplayNumber(search)}</b></span></div><small>${escapeHtml(note)}</small></article>`;
}

function renderDiagnosticEvidencePage() {
  const traffic = monitoringTrafficRecord();
  const kpis = traffic?.kpis || {};
  const totalPv = monitoringMetric(traffic || {}, ["pv", "totalPv", "pageViews", "total"]);
  const browserUaPv = monitoringMetric(kpis, ["humanPv", "human"]) ?? monitoringMetric(traffic || {}, ["humanPv", "human"]);
  const aiBotPv = monitoringMetric(kpis, ["aiBotPv", "aiBot"]) ?? monitoringMetric(traffic || {}, ["aiBotPv", "aiBot"]);
  const searchBotPv = monitoringMetric(kpis, ["searchBotPv", "searchBot"]) ?? monitoringMetric(traffic || {}, ["searchBotPv", "searchBot"]);
  const excludedRequests = monitoringMetric(kpis, ["excludedRequests"]) ?? 0;
  const rangeLabel = monitoringRangeLabel(ui.monitoringRange);
  const liveToday = monitoringLiveTrafficRecord("liveToday");
  const liveYesterday = monitoringLiveTrafficRecord("liveYesterday");
  return `
    <section class="diagnostic-hero diagnostic-evidence-hero card"><div><span class="diagnostic-kicker">官网访问与抓取实测</span><h2>官网实测看板</h2><p>这里仅统计服务器成功返回的官网页面请求，并按 User-Agent 识别浏览器与自动化流量。鼠标悬停趋势节点可查看当天完整数据。</p><label class="diagnostic-range-control"><span>统计周期</span><select class="select" data-monitor-filter="range">${[["today", "今天实时"], ["yesterday", "昨天"], ["7", "最近 7 天"], ["30", "最近 30 天"], ["90", "最近 90 天"], ["180", "最近 180 天"], ["365", "最近 1 年"]].map(([value, label]) => `<option value="${value}" ${String(ui.monitoringRange) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><div class="diagnostic-package-badge diagnostic-traffic-badge">${icon("chart")}<small>${escapeHtml(rangeLabel)}有效页面请求</small><b>${monitoringDisplayNumber(totalPv)} 次</b><em>东八区 · 服务端日志</em></div></section>
    <div class="monitoring-realtime-grid">${monitoringRealtimeCard("今天实时", liveToday, "实时滚动统计 · 页面请求截至当前时刻", "blue")}${monitoringRealtimeCard("昨天", liveYesterday, "完整自然日 · 用于和今天实时数据对比", "green")}</div>
    <div class="diagnostic-stat-grid diagnostic-traffic-stats"><article class="card"><small>成功页面请求</small><b>${monitoringDisplayNumber(totalPv)}</b><p>仅 GET + 2xx 的页面响应</p></article><article class="card"><small>浏览器 UA 请求</small><b>${monitoringDisplayNumber(browserUaPv)}</b><p>未命中已知自动化 UA</p></article><article class="card"><small>AI 爬虫页面请求</small><b>${monitoringDisplayNumber(aiBotPv)}</b><p>可达性信号，不代表被引用</p></article><article class="card"><small>搜索爬虫页面请求</small><b>${monitoringDisplayNumber(searchBotPv)}</b><p>搜索引擎抓取信号</p></article></div>
    <div class="diagnostic-traffic-disclosure">${icon("info")}<span>${excludedRequests > 0 ? `已从主指标排除 ${monitoringDisplayNumber(excludedRequests)} 条资源、sitemap / robots、跳转或错误请求。` : "主指标不包含资源、协议入口、跳转或错误请求。"}</span></div>
    ${renderDiagnosticOperationalEvidence()}`;
}
function diagnosticActionRows(reports = diagnosticSnapshot.reports) {
  return reports.flatMap((report) => {
    const reportId = report.id || report.reportId;
    const directActions = Array.isArray(report.actions) ? report.actions : [];
    if (directActions.length) return directActions.map((item) => ({ ...item, id: item.id || item.actionId, reportId }));
    const recommendations = report.recommendations || report.suggestions || [];
    return (Array.isArray(recommendations) ? recommendations : []).map((item, index) => {
      const recommendation = typeof item === "string" ? { id: `${reportId}-REC-${index + 1}`, title: item } : item;
      const action = (diagnosticSnapshot.actions || []).find((candidate) => String(candidate.recommendationId || "") === String(recommendation.id || recommendation.recommendationId || ""));
      return {
        ...recommendation,
        id: action?.id || action?.actionId || "",
        actionType: action?.actionType || recommendation.actionType || "",
        status: action?.status || recommendation.status || "proposed",
        actionAvailable: Boolean(action?.id || action?.actionId),
        reportId
      };
    });
  });
}

function renderDiagnosticWorkspace() {
  const projects = diagnosticSnapshot.projects || [];
  const reports = diagnosticSnapshot.reports || [];
  const pendingActions = (diagnosticSnapshot.actions || []).filter((item) => !["confirmed", "completed", "applied", "rejected", "cancelled"].includes(String(item.status || "").toLowerCase()));
  const installed = diagnosticInstalledPackage();
  const packageState = installed?.installState || installed?.status || "";
  const packageStateLabel = packageState === "ready" || packageState === "installed" ? "数据制品已校验安装" : installed ? "服务端已登记元数据" : "元数据已登记 · 服务待连接";
  const recent = projects.slice(0, 4).map((project) => {
    const id = project.id || project.projectId;
    const meta = diagnosticTypeMeta(project);
    return `<button class="diagnostic-project-mini" type="button" data-action="diagnostic-open-project" data-project-id="${escapeHtml(String(id || ""))}"><span data-icon="${meta.icon}"></span><span><b>${escapeHtml(project.name || project.title || meta.label)}</b><small>${escapeHtml(project.industry || project.businessLineSnapshot?.name || "未填写行业")} · ${formatDateTime(project.updatedAt || project.createdAt)}</small></span>${diagnosticStatusBadge(project)}</button>`;
  }).join("");
  return `
    <section class="diagnostic-hero card"><div><span class="diagnostic-kicker">运营诊断</span><h2>把行业研究与企业真实运营证据，转成下一步工作</h2><p>研究数据回答“行业通常引用什么”，企业实测回答“我们现在具备什么”，实时采样未接入前不输出品牌排名、推荐率或周期趋势。</p><div class="diagnostic-hero-actions"><button class="primary-button" type="button" data-action="diagnostic-new-project"><span data-icon="plus"></span>新建诊断</button><button class="secondary-button" type="button" data-action="diagnostic-section" data-section="reports">查看报告</button></div></div><div class="diagnostic-package-badge"><span data-icon="book"></span><small>当前研究基线</small><b>Citation Lab ${CITATION_LAB_PACKAGE.version}</b><em>${escapeHtml(packageStateLabel)}</em></div></section>
    <div class="diagnostic-stat-grid"><article class="card"><small>诊断项目</small><b>${projects.length}</b><p>问题集和数据版本固定可追溯</p></article><article class="card"><small>已生成报告</small><b>${reports.length}</b><p>仅统计服务端返回的报告</p></article><article class="card"><small>待确认建议</small><b>${pendingActions.length}</b><p>确认后才会回流业务模块</p></article><article class="card"><small>实时 AI 采样</small><b class="diagnostic-unavailable">未接入</b><p>第一阶段不提供品牌提及排名</p></article></div>
    <div class="diagnostic-workspace-grid"><section class="card diagnostic-recent"><div class="card-header"><div><h3>最近诊断项目</h3><p>从项目进入可保持行业、问题集和研究版本口径一致</p></div><button class="text-button" type="button" data-action="diagnostic-section" data-section="projects">查看全部 <span data-icon="arrow"></span></button></div><div>${recent || '<div class="monitor-real-empty">还没有服务端诊断项目，点击“新建诊断”开始。</div>'}</div></section><section class="card diagnostic-method"><div class="card-header"><div><h3>三类证据口径</h3><p>报告结论必须标明证据来源与适用范围</p></div></div><div class="diagnostic-method-list"><div class="ready"><i>1</i><span><b>研究基线</b><small>Citation Lab 历史引用与页面特征，只用于行业参照。</small></span></div><div class="ready"><i>2</i><span><b>企业实测</b><small>官网、知识、内容和发布运行数据，属于当前企业证据。</small></span></div><div><i>3</i><span><b>实时采样</b><small>未来保存完整回答、引用 URL、模型版本与采样时间。</small></span></div></div></section></div>
    ${renderDiagnosticOperationalEvidence()}`;
}

function renderDiagnosticWizard() {
  if (!ui.diagnosticWizardOpen) return "";
  const lines = (state.businessLines || []).filter((line) => line.status !== "archived");
  const lineId = ui.diagnosticBusinessLineId || lines[0]?.id || "";
  const questions = diagnosticQuestionPool(lineId);
  const selected = new Set(ui.diagnosticQuestionIds || []);
  const typeCards = Object.entries(DIAGNOSTIC_TYPES).map(([id, meta]) => `<label class="diagnostic-type-card ${ui.diagnosticType === id ? "selected" : ""}"><input type="radio" name="diagnostic-type" value="${id}" ${ui.diagnosticType === id ? "checked" : ""} ${ui.diagnosticQuestionSetFrozen ? "disabled" : ""} /><span data-icon="${meta.icon}"></span><b>${escapeHtml(meta.label)}</b><small>${escapeHtml(meta.description)}</small></label>`).join("");
  const questionRows = questions.map((item) => `<label class="diagnostic-question-option"><input class="checkbox" type="checkbox" data-diagnostic-question="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""} ${ui.diagnosticQuestionSetFrozen ? "disabled" : ""} /><span><b>${escapeHtml(item.question)}</b><small>${escapeHtml(item.source)}</small></span></label>`).join("");
  return `<section class="card diagnostic-wizard"><div class="diagnostic-wizard-head"><div><span>新建诊断项目</span><h3>先固定业务范围与问题口径，再调用研究数据生成报告</h3></div><button class="icon-button" type="button" data-action="diagnostic-close-wizard" aria-label="关闭"><span data-icon="x"></span></button></div><div class="diagnostic-wizard-body"><div class="diagnostic-form-grid"><div class="field"><label for="diagnostic-business-line">产品 / 业务线 *</label><select class="select" id="diagnostic-business-line" data-diagnostic-business-line ${ui.diagnosticQuestionSetFrozen ? "disabled" : ""}>${lines.map((line) => `<option value="${escapeHtml(line.id)}" ${line.id === lineId ? "selected" : ""}>${escapeHtml(line.name)}</option>`).join("")}</select></div><div class="field"><label for="diagnostic-industry">所在行业 *</label><input class="input" id="diagnostic-industry" value="${escapeHtml(ui.diagnosticIndustry)}" placeholder="例如：工业激光设备、精密制造" ${ui.diagnosticQuestionSetFrozen ? "disabled" : ""} /></div><div class="field diagnostic-goal-field"><label for="diagnostic-goal">本次诊断目标 *</label><textarea class="textarea" id="diagnostic-goal" rows="3" placeholder="例如：分析行业常见信源类型，找到官网与内容建设的优先级" ${ui.diagnosticQuestionSetFrozen ? "disabled" : ""}>${escapeHtml(ui.diagnosticGoal)}</textarea></div></div><div><label class="diagnostic-field-label">诊断类型 *</label><div class="diagnostic-type-grid">${typeCards}</div></div><div class="diagnostic-question-picker"><div class="diagnostic-question-head"><div><b>诊断问题集</b><small>来自当前业务线的问题词库；冻结后与报告版本绑定。</small></div><span class="small-tag ${ui.diagnosticQuestionSetFrozen ? "teal" : "blue"}">${ui.diagnosticQuestionSetFrozen ? `已冻结 ${selected.size} 个` : `已选 ${selected.size} / ${questions.length}`}</span></div><div class="diagnostic-question-list">${questionRows || '<div class="monitor-real-empty">当前业务线没有可用问题，请先在选题中心建立问题词库。</div>'}</div></div></div><div class="diagnostic-wizard-foot"><span>${ui.diagnosticQuestionSetFrozen ? `问题集冻结于本次创建流程 · Citation Lab ${CITATION_LAB_PACKAGE.version}` : "冻结只锁定本次诊断快照，不会锁定原问题词库。"}</span><div>${ui.diagnosticQuestionSetFrozen ? '<button class="secondary-button" type="button" data-action="diagnostic-unfreeze-questions">重新选择</button>' : '<button class="secondary-button" type="button" data-action="diagnostic-freeze-questions">冻结问题集</button>'}<button class="primary-button" type="button" data-action="diagnostic-create-project" ${ui.diagnosticCreating || !ui.diagnosticQuestionSetFrozen ? "disabled" : ""}>${ui.diagnosticCreating ? '<span class="loading-spinner"></span>正在创建' : '<span data-icon="plus"></span>创建诊断项目'}</button></div></div></section>`;
}

function renderDiagnosticProjects() {
  const projects = diagnosticSnapshot.projects || [];
  const rows = projects.map((project) => {
    const id = project.id || project.projectId;
    const meta = diagnosticTypeMeta(project);
    const questionCount = project.questionSet?.questions?.length || project.questionSet?.questionIds?.length || project.questionSetSnapshot?.questions?.length || project.scope?.questionCount || project.questionCount || 0;
    const reportCount = diagnosticProjectReports(id).length;
    return `<article class="card diagnostic-project-card"><div class="diagnostic-project-icon" data-tone="${escapeHtml(diagnosticTypeOf(project))}"><span data-icon="${meta.icon}"></span></div><div class="diagnostic-project-main"><div><span>${escapeHtml(meta.label)}</span><h3>${escapeHtml(project.name || project.title || `${project.industry || "未命名行业"}诊断`)}</h3><p>${escapeHtml(project.goal || project.objective || "尚未填写诊断目标")}</p></div><div class="diagnostic-project-meta"><span>业务线 <b>${escapeHtml(project.businessLineSnapshot?.name || project.scope?.businessLineSnapshot?.name || state.businessLines.find((line) => line.id === project.businessLineId)?.name || "—")}</b></span><span>行业 <b>${escapeHtml(project.industry || "—")}</b></span><span>冻结问题 <b>${questionCount}</b></span><span>报告 <b>${reportCount}</b></span></div></div><div class="diagnostic-project-side">${diagnosticStatusBadge(project)}<small>${formatDateTime(project.updatedAt || project.createdAt)}</small><button class="primary-button button-small" type="button" data-action="diagnostic-generate-report" data-project-id="${escapeHtml(String(id || ""))}" ${String(ui.diagnosticGeneratingId || "") === String(id || "") ? "disabled" : ""}>${String(ui.diagnosticGeneratingId || "") === String(id || "") ? "正在生成" : "生成报告"}</button>${reportCount ? `<button class="text-button" type="button" data-action="diagnostic-project-reports" data-project-id="${escapeHtml(String(id || ""))}">查看报告</button>` : ""}</div></article>`;
  }).join("");
  return `${renderDiagnosticWizard()}<div class="diagnostic-list-head"><div><h3>诊断项目</h3><p>一个项目固定一条业务线、一个行业、一个问题集版本和一个研究数据版本。</p></div><button class="primary-button" type="button" data-action="diagnostic-new-project"><span data-icon="plus"></span>新建诊断</button></div><div class="diagnostic-project-list">${rows || '<section class="card monitor-real-empty diagnostic-empty"><div><span data-icon="target"></span><h3>还没有诊断项目</h3><p>创建后才会调用服务端生成报告，页面不提供虚构的演示结论。</p><button class="primary-button" type="button" data-action="diagnostic-new-project">新建第一个诊断</button></div></section>'}</div>`;
}

function diagnosticReportActions(report) {
  const reportId = report.id || report.reportId;
  const rows = diagnosticActionRows([report]);
  if (!rows.length) return '<div class="monitor-real-empty">当前报告没有服务端建议项。报告完成后才能人工确认回流。</div>';
  return `<div class="diagnostic-action-list">${rows.map((item) => {
    const status = String(item.status || "").toLowerCase();
    const completed = ["confirmed", "completed", "applied", "converted"].includes(status);
    const available = item.actionAvailable !== false && Boolean(item.id);
    const target = diagnosticActionTarget(item.actionType);
    return `<div class="diagnostic-action-row"><span data-icon="arrow"></span><div><b>${escapeHtml(item.title || item.name || item.action || "未命名建议")}</b><small>${escapeHtml(item.rationale || item.reason || item.description || item.detail || "需由运营人员确认后再回流，不自动发布。")}</small></div><span class="diagnostic-action-target">回流至 <b>${escapeHtml(diagnosticActionTargetLabel(target))}</b></span><button class="secondary-button button-small" type="button" data-action="diagnostic-confirm-action" data-report-id="${escapeHtml(String(reportId || ""))}" data-diagnostic-action-id="${escapeHtml(String(item.id || ""))}" ${!available || completed || String(ui.diagnosticActionId) === String(item.id) ? "disabled" : ""}>${completed ? "已回流" : !available ? "动作待生成" : String(ui.diagnosticActionId) === String(item.id) ? "处理中" : status === "failed" ? "重试回流" : "确认回流"}</button></div>`;
  }).join("")}</div>`;
}

function diagnosticStructuredValue(value, depth = 0) {
  if (value === null || value === undefined || value === "") return '<span class="diagnostic-value-empty">暂无数据</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="diagnostic-value-empty">暂无数据</span>';
    return `<ul class="diagnostic-value-list">${value.map((item) => `<li>${diagnosticStructuredValue(item, depth + 1)}</li>`).join("")}</ul>`;
  }
  if (typeof value === "object") {
    return `<dl class="diagnostic-value-map">${Object.entries(value).map(([key, item]) => `<div><dt>${escapeHtml(key)}</dt><dd>${diagnosticStructuredValue(item, depth + 1)}</dd></div>`).join("")}</dl>`;
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return `<a class="link-button" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
  }
  return `<span>${escapeHtml(String(value))}</span>`;
}

function renderDiagnosticReportDetail(report) {
  const reportId = report.id || report.reportId;
  const project = diagnosticProjectById(report.projectId || report.diagnosticProjectId);
  const meta = diagnosticTypeMeta(report);
  const evidence = report.evidence || report.evidenceSummary || {};
  const dataScope = report.dataScope && typeof report.dataScope === "object" ? report.dataScope : {};
  const liveCount = Number(dataScope.evidenceCounts?.live || dataScope.verifiedEvidenceCounts?.live || 0);
  const realtime = evidence.realtimeSampling || evidence.realtime || report.realtimeSampling || (liveCount > 0 ? { sampleCount: liveCount } : null);
  const sections = Array.isArray(report.sections) ? [...report.sections] : [];
  const methodology = report.methodology && typeof report.methodology === "object" ? report.methodology : {};
  const researchOnly = methodology.analysisMode === "citation_lab_research";
  const generation = methodology.modelAnalysis || methodology.generation || methodology.ai || methodology.model || {};
  if (generation.model || generation.modelName || generation.providerName || methodology.modelName) {
    sections.unshift({
      title: "分析引擎与数据样本",
      content: {
        模型供应商: generation.providerName || generation.provider || methodology.providerName || "已配置文本模型",
        模型: generation.model || generation.modelName || methodology.modelName || "—",
        客户问题数: methodology.questionCount || methodology.research?.inputQuestionCount || report.run?.inputSnapshot?.questionSet?.questions?.length || "—",
        匹配研究问题数: methodology.research?.matchedQuestionCount || methodology.matchedQuestionCount || "—",
        历史匹配引用观察数: methodology.research?.citationObservationCountAcrossQuestionAnalyses || methodology.research?.citationSampleCount || methodology.research?.deduplicatedCitationCount || methodology.citationSampleCount || "—",
        企业知识证据数: methodology.rag?.evidenceCount || methodology.enterpriseRag?.evidenceCount || "—"
      }
    });
  }
  if (researchOnly) {
    sections.unshift({
      title: "本报告的数据发送范围",
      content: "仅使用诊断目标中的行业与分析要求，以及 Citation Lab 四平台历史事实包；未发送冻结问题、企业知识库、官网运营快照或整库资料。"
    });
  }
  if (Array.isArray(report.evidence) && report.evidence.length) {
    sections.push({
      title: `证据索引（${report.evidence.length} 条）`,
      content: report.evidence.slice(0, 80).map((item) => ({
        evidenceId: item.id,
        类型: item.evidenceType,
        标题: item.title || item.claim || item.sourceId,
        来源: item.sourceUrl || item.sourceKind,
        核验状态: item.verificationStatus
      }))
    });
  }
  const summary = report.summary || report.executiveSummary || report.conclusion || "";
  const packageVersion = report.researchPackageVersion || report.researchPackage?.version || dataScope.researchPackage?.datasetVersion || project?.researchPackage?.version || CITATION_LAB_PACKAGE.version;
  const diagnostic = researchOnly ? null : monitoringLatestDiagnostic();
  const scores = researchOnly ? {} : monitoringDiagnosticScores(diagnostic);
  const production = researchOnly ? {} : monitoringProductionStats();
  const scopeText = report.applicability || report.scope?.description || (dataScope.supportsCurrentAiRanking
    ? "实时结论仅适用于本报告列明且带采集时间的已核验样本，不能外推到其他平台、模型或时间。"
    : "适用于行业信源生态、页面特征、企业官网与内容缺口分析；当前没有已核验实时 AI 样本，不用于证明品牌推荐排名、提及率、情感或实时引用表现。");
  const enterpriseEvidenceCount = Number(dataScope.evidenceCounts?.enterprise || 0);
  const enterpriseReady = !researchOnly && (monitoringSnapshot.loaded || enterpriseEvidenceCount > 0);
  return `<div class="diagnostic-report-detail"><button class="text-button diagnostic-back" type="button" data-action="diagnostic-back-reports"><span data-icon="arrow"></span>返回报告中心</button><section class="card diagnostic-report-cover"><div><span>${escapeHtml(meta.label)} · ${escapeHtml(String(reportId || ""))}</span><h2>${escapeHtml(report.title || report.name || project?.name || meta.label)}</h2><p>${escapeHtml(summary || "服务端报告尚未返回摘要；当前不生成替代性演示结论。")}</p><div class="diagnostic-report-tags"><em>研究包 ${escapeHtml(String(packageVersion))}</em><em>${escapeHtml(project?.industry || report.industry || "行业未填写")}</em><em>${escapeHtml(formatDateTime(report.finalizedAt || report.completedAt || report.updatedAt || report.createdAt))}</em></div></div>${diagnosticStatusBadge(report)}</section><section class="diagnostic-report-block"><div class="diagnostic-section-title"><div><span>证据与边界</span><h3>这份报告使用了什么，不能说明什么</h3></div></div><div class="diagnostic-evidence-layers"><article class="card ready"><i>1</i><span><small>研究基线</small><b>Citation Lab ${escapeHtml(String(packageVersion))}</b><p>${CITATION_LAB_PACKAGE.citations.toLocaleString("zh-CN")} 条历史引用 · ${CITATION_LAB_PACKAGE.canonicalQuestions} 个规范问题 · ${CITATION_LAB_PACKAGE.platforms} 个平台/终端</p></span><em>固定研究数据</em></article><article class="card ${enterpriseReady ? "ready" : ""}"><i>2</i><span><small>企业实测</small><b>官网与运营系统</b><p>官网诊断 ${monitoringDisplayNumber(scores.total)}/100 · 文章 ${monitoringDisplayNumber(production.articleTotal)} 篇 · 已发布 ${monitoringDisplayNumber(production.published)} 篇${enterpriseEvidenceCount ? ` · 报告证据 ${enterpriseEvidenceCount} 条` : ""}</p></span><em>${enterpriseReady ? "有数据" : "待连接"}</em></article><article class="card ${realtime ? "ready" : ""}"><i>3</i><span><small>实时采样</small><b>${realtime ? "本报告包含实时采样" : "未接入"}</b><p>${realtime ? escapeHtml(realtime.summary || realtime.description || `已记录 ${realtime.sampleCount || realtime.count || liveCount || "—"} 个样本`) : "未保存完整 AI 回答、引用 URL、模型版本和采集时间，因此不能计算当前品牌排名、提及率或周期趋势。"}</p></span><em>${realtime ? "有证据" : "无数据"}</em></article></div><div class="diagnostic-scope-note"><span data-icon="info"></span><div><b>适用范围</b><p>${escapeHtml(scopeText)}</p></div></div></section>${sections.length ? `<section class="diagnostic-report-block"><div class="diagnostic-section-title"><div><span>报告正文</span><h3>诊断发现</h3></div></div><div class="diagnostic-report-sections">${sections.map((section, index) => `<article class="card" data-report-kind="${escapeHtml(section.kind || section.key || "content")}"><i>${String(index + 1).padStart(2, "0")}</i><div><h3>${escapeHtml(section.title || section.name || `第 ${index + 1} 部分`)}</h3><div class="diagnostic-section-body">${diagnosticStructuredValue(section.content ?? section.items ?? section.summary ?? section.text ?? "该部分尚未返回内容。")}</div></div></article>`).join("")}</div></section>` : `<div class="monitor-real-note warning"><span data-icon="info"></span><div><b>报告正文待服务端返回</b><small>当前只展示可验证的项目、证据元数据和状态，不填充虚构诊断发现。</small></div></div>`}<section class="diagnostic-report-block"><div class="diagnostic-section-title"><div><span>执行建议</span><h3>人工确认后回流业务系统</h3><p>回流只创建待确认内容，不自动发布；每一项都由运营人员单独确认。</p></div></div>${diagnosticReportActions(report)}</section></div>`;
}

function renderDiagnosticReports() {
  if (!analysisWorkbenchSnapshot.attempted && !analysisWorkbenchSnapshot.loading) queueMicrotask(() => refreshAnalysisWorkbench({ renderAfter: true }));
  const analysisCards = (analysisWorkbenchSnapshot.sessions || []).filter((session) => Number(session.artifactCount || 0) > 0).map((session) => {
    const [status, tone] = analysisRunStatusMeta(session.latestRunStatus);
    return `<div class="analysis-report-library-item"><button class="card diagnostic-report-card analysis-report-library-card" type="button" data-action="analysis-open-report" data-session-id="${escapeHtml(session.id)}"><span class="diagnostic-report-icon" data-icon="chart"></span><span><small>AI 分析报告 · V${Number(session.artifactCount || 1)}</small><b>${escapeHtml(session.title || "未命名分析报告")}</b><p>${escapeHtml((session.dataSources || []).map((id) => ANALYSIS_DATA_SOURCE_META[id]?.label || id).join(" + ") || "受控数据分析")}</p><em>${escapeHtml((session.platforms || []).join("、") || "未限定平台")} · ${formatDateTime(session.updatedAt)}</em></span><span class="analysis-run-badge ${escapeHtml(tone)}"><i></i>${escapeHtml(status)}</span></button><button class="analysis-report-delete" type="button" data-action="analysis-delete-session" data-session-id="${escapeHtml(session.id)}" aria-label="删除报告：${escapeHtml(session.title || "未命名分析报告")}" title="删除报告"><span data-icon="trash"></span></button></div>`;
  }).join("");
  return `<div class="diagnostic-list-head"><div><h3>报告中心</h3><p>统一管理 AI 分析工作台生成的报告；追问产生新版本，原始数据范围和证据链保持可追溯。</p></div></div><div class="diagnostic-report-grid">${analysisCards || '<section class="card monitor-real-empty diagnostic-empty"><div><span data-icon="file"></span><h3>暂无真实诊断报告</h3><p>在 AI 分析工作台提交分析要求后，完成的报告会自动进入这里。</p><button class="primary-button" type="button" data-action="diagnostic-section" data-section="analysis">前往 AI 分析工作台</button></div></section>'}</div>`;
}

function renderCitationDocumentUpdatePanel() {
  if (!citationDocumentUpdateSnapshot.loaded && !citationDocumentUpdateSnapshot.loading) queueMicrotask(() => refreshCitationDocumentUpdate({ renderAfter: true }));
  const update = citationDocumentUpdateSnapshot.update || {};
  const current = update.current || null;
  const candidate = update.candidate?.lifecycle === "activated" ? null : update.candidate || null;
  const installed = update.installed || [];
  const busy = citationDocumentUpdateSnapshot.loading || citationDocumentUpdateSnapshot.operating;
  const actions = [];
  if (candidate?.lifecycle === "discovered") actions.push('<button class="primary-button button-small" type="button" data-action="citation-doc-update-stage">下载到暂存区</button>');
  if (candidate?.lifecycle === "staged") actions.push('<button class="primary-button button-small" type="button" data-action="citation-doc-update-validate">校验文档快照</button>');
  if (candidate?.lifecycle === "validated") actions.push('<button class="primary-button button-small" type="button" data-action="citation-doc-update-activate">激活研究资料</button>');
  if (["staged", "validated"].includes(candidate?.lifecycle)) actions.push('<button class="secondary-button button-small" type="button" data-action="citation-doc-update-discard">丢弃候选</button>');
  if (installed.filter((item) => item.verified).some((item) => item.sourceCommit !== current?.sourceCommit)) actions.push('<button class="secondary-button button-small" type="button" data-action="citation-doc-update-rollback">回滚文档快照</button>');
  const candidateText = candidate
    ? candidate.sourceCommit === current?.sourceCommit && current?.verified !== true ? "把当前旧镜像转换为可校验快照" : "发现新的仓库研究资料"
    : update.lastCheck?.state === "completed" ? "研究资料已跟随官方最新提交" : "等待首次检查";
  const versions = installed.map((item) => `<li class="${item.sourceCommit === current?.sourceCommit ? "active" : ""}"><span><b>${escapeHtml(String(item.sourceCommit || "").slice(0, 12))}</b><small>${escapeHtml(item.sourceCommit || "无 commit")}</small></span><em>${item.sourceCommit === current?.sourceCommit ? "当前使用" : item.verified ? "已验证保留" : "校验异常"}</em></li>`).join("");
  if (citationDocumentUpdateSnapshot.loading && !citationDocumentUpdateSnapshot.loaded) {
    return '<section class="card citation-update-card"><div class="analysis-loading"><span class="loading-spinner dark"></span><b>正在读取仓库研究资料状态</b></div></section>';
  }
  return `<section class="card citation-update-card citation-document-update-card"><div class="card-header"><div><h3>仓库研究资料快照</h3><p>方法论、研究报告与数据契约独立更新；不会改写 Citation Lab 统计数据库。</p></div><div class="citation-update-actions"><button class="secondary-button button-small" type="button" data-action="citation-doc-update-refresh" ${busy ? "disabled" : ""}><span data-icon="refresh"></span>刷新状态</button><button class="primary-button button-small" type="button" data-action="citation-doc-update-check" ${busy ? "disabled" : ""}>${busy ? '<span class="loading-spinner"></span>处理中' : "检查仓库文档"}</button></div></div>
    ${citationDocumentUpdateSnapshot.error ? `<div class="monitor-real-note warning"><span data-icon="alert"></span><div><b>研究资料服务提示</b><small>${escapeHtml(citationDocumentUpdateSnapshot.error)}</small></div></div>` : ""}
    <div class="citation-update-status"><div class="${current?.verified ? "ready" : "warning"}"><small>当前文档提交</small><b>${escapeHtml(String(current?.sourceCommit || "未连接").slice(0, 12))}</b><span>${escapeHtml(current?.verified ? "已校验只读快照" : current?.legacy ? "现有固定镜像，等待转换" : "等待服务端状态")}</span></div><div><small>最近检查</small><b>${escapeHtml(update.lastCheck?.state === "completed" ? "已完成" : update.updatePolicy?.checkDue ? "等待检查" : "未检查")}</b><span>${escapeHtml(update.lastCheck?.checkedAt ? formatDateTime(update.lastCheck.checkedAt) : `自动间隔 ${update.updatePolicy?.checkIntervalHours || 24} 小时`)}</span></div><div class="${candidate ? "warning" : "ready"}"><small>仓库状态</small><b>${escapeHtml(candidateText)}</b><span>${escapeHtml(candidate?.sourceCommit ? `提交 ${candidate.sourceCommit}` : "当前没有待处理快照")}</span></div></div>
    ${candidate ? `<div class="citation-update-candidate"><span data-icon="book"></span><div><b>${escapeHtml(candidateText)}</b><p>将下载 ${Number(candidate.counts?.documents || 0)} 份允许格式的研究文档，共 ${formatBytes(Number(candidate.totalBytes || 0))}；每个文件同时核验 Git blob SHA 与 SHA-256。</p><small>生命周期：${escapeHtml(candidate.lifecycle || "discovered")} · 数据库版本保持 ${escapeHtml(CITATION_LAB_PACKAGE.version)}</small></div><div>${actions.join("")}</div></div>` : ""}
    <div class="citation-installed-list"><h4>已验证和可回滚的文档快照</h4><ul>${versions || `<li><span><b>${escapeHtml(String(current?.sourceCommit || "固定镜像").slice(0, 12))}</b><small>${current?.legacy ? "当前固定镜像尚未转为独立快照" : "暂无独立快照"}</small></span><em>${current ? "当前读取" : "待连接"}</em></li>`}</ul></div>
    <div class="citation-update-policy"><span data-icon="lock"></span><p>系统只从姚金刚官方仓库的固定 commit 下载白名单内 UTF-8 文档，不执行 git pull、不运行仓库代码、不下载论文 PDF 或大规模原始数据。激活前必须完成路径、许可、文件数量、字节数和双哈希校验；旧快照继续保留以便回滚。</p></div></section>`;
}

function renderDiagnosticRules() {
  if (!citationUpdateSnapshot.loaded && !citationUpdateSnapshot.loading) queueMicrotask(() => refreshCitationPackageUpdate({ renderAfter: true }));
  const installed = diagnosticInstalledPackage();
  const packageStatus = installed?.installState || installed?.status || "not_connected";
  const packageLabel = packageStatus === "ready" || packageStatus === "installed" ? "数据制品已安装" : installed ? "仅元数据" : "服务待连接";
  const update = citationUpdateSnapshot.update || {};
  const current = update.current || null;
  const candidate = update.candidate || null;
  const installedVersions = update.installed || [];
  const busy = citationUpdateSnapshot.loading || citationUpdateSnapshot.operating;
  const candidateState = candidate?.installability?.state || "up_to_date";
  const candidateText = candidateState === "installable_package_declared" ? "发现可安装数据包" : candidateState === "source_update_only" ? "发现仓库变化，暂无可安装数据包" : "未发现新版本";
  const updateActions = [];
  if (candidate?.installability?.installable && candidate.lifecycle === "discovered") updateActions.push('<button class="primary-button button-small" type="button" data-action="citation-update-stage">下载到暂存区</button>');
  if (candidate?.lifecycle === "staged") updateActions.push('<button class="primary-button button-small" type="button" data-action="citation-update-validate">执行完整校验</button>');
  if (candidate?.lifecycle === "validated") updateActions.push('<button class="primary-button button-small" type="button" data-action="citation-update-activate">激活新版本</button>');
  if (["staged", "validated"].includes(candidate?.lifecycle)) updateActions.push('<button class="secondary-button button-small" type="button" data-action="citation-update-discard">丢弃候选</button>');
  if (installedVersions.filter((item) => item.installed && item.validManifest).length > 1) updateActions.push('<button class="secondary-button button-small" type="button" data-action="citation-update-rollback">回滚版本</button>');
  const versions = installedVersions.map((item) => `<li class="${item.version === current?.version ? "active" : ""}"><span><b>v${escapeHtml(item.version)}</b><small>${escapeHtml(item.sourceCommit || "无 commit")}</small></span><em>${item.version === current?.version ? "当前使用" : item.validManifest ? "已验证保留" : "校验异常"}</em></li>`).join("");
  const updatePanel = citationUpdateSnapshot.loading && !citationUpdateSnapshot.loaded
    ? '<section class="card citation-update-card"><div class="analysis-loading"><span class="loading-spinner dark"></span><b>正在读取数据版本状态</b></div></section>'
    : `<section class="card citation-update-card"><div class="card-header"><div><h3>官方仓库更新中心</h3><p>每天自动检查一次；下载、激活和回滚必须由管理员确认。</p></div><div class="citation-update-actions"><button class="secondary-button button-small" type="button" data-action="citation-update-refresh" ${busy ? "disabled" : ""}><span data-icon="refresh"></span>刷新状态</button><button class="primary-button button-small" type="button" data-action="citation-update-check" ${busy ? "disabled" : ""}>${busy ? '<span class="loading-spinner"></span>处理中' : "立即检查姚金刚仓库"}</button></div></div>
      ${citationUpdateSnapshot.error ? `<div class="monitor-real-note warning"><span data-icon="alert"></span><div><b>版本服务提示</b><small>${escapeHtml(citationUpdateSnapshot.error)}</small></div></div>` : ""}
      <div class="citation-update-status"><div><small>当前运行版本</small><b>${escapeHtml(current?.version || CITATION_LAB_PACKAGE.version)}</b><span>${escapeHtml(current?.sourceCommit || "等待服务端状态")}</span></div><div><small>最近检查</small><b>${escapeHtml(update.lastCheck?.state === "completed" ? "已完成" : update.updatePolicy?.checkDue ? "等待检查" : "未检查")}</b><span>${escapeHtml(update.lastCheck?.checkedAt ? formatDateTime(update.lastCheck.checkedAt) : `自动间隔 ${update.updatePolicy?.checkIntervalHours || 24} 小时`)}</span></div><div class="${candidateState === "installable_package_declared" ? "ready" : candidateState === "source_update_only" ? "warning" : ""}"><small>上游状态</small><b>${escapeHtml(candidateText)}</b><span>${escapeHtml(candidate?.datasetVersion ? `候选数据版本 ${candidate.datasetVersion}` : candidate?.sourceCommit ? `提交 ${candidate.sourceCommit}` : "当前没有候选数据包")}</span></div></div>
      ${candidate ? `<div class="citation-update-candidate"><span data-icon="${candidate.installability?.installable ? "check" : "info"}"></span><div><b>${escapeHtml(candidateText)}</b><p>${escapeHtml(candidate.installability?.explanation || "仓库变化与可安装数据版本是两个独立状态。")}</p><small>生命周期：${escapeHtml(candidate.lifecycle || "discovered")} · 原因：${escapeHtml(candidate.installability?.reasonCode || "—")}</small></div><div>${updateActions.join("")}</div></div>` : ""}
      <div class="citation-installed-list"><h4>已安装和可回滚版本</h4><ul>${versions || `<li><span><b>v${escapeHtml(CITATION_LAB_PACKAGE.version)}</b><small>本地固定研究包</small></span><em>当前使用</em></li>`}</ul></div>
      <div class="citation-update-policy"><span data-icon="lock"></span><p>系统不会对生产目录执行 git pull。只有官方 Release 提供完整文件清单、字节数、SHA-256、许可声明和可验证 SQLite 时才允许进入暂存；激活后需重启研究分析服务。</p></div></section>`;
  return `<section class="diagnostic-rules-hero card"><div><span data-icon="book"></span><div><small>研究数据包</small><h2>${escapeHtml(CITATION_LAB_PACKAGE.name)} ${escapeHtml(current?.version || CITATION_LAB_PACKAGE.version)}</h2><p>统计数据和仓库研究资料采用两条独立版本链；更新文档不会篡改历史统计或报告。</p></div></div><span class="status-badge ${packageStatus === "ready" || packageStatus === "installed" ? "status-approved" : "status-pending"}">${escapeHtml(packageLabel)}</span></section>${updatePanel}${renderCitationDocumentUpdatePanel()}<div class="diagnostic-rule-grid"><section class="card"><div class="card-header"><div><h3>当前研究包元数据</h3><p>页面展示的是公开仓库历史研究事实，不代表客户当前表现。</p></div></div><dl class="diagnostic-package-meta"><div><dt>数据版本</dt><dd>${escapeHtml(current?.version || CITATION_LAB_PACKAGE.version)}</dd></div><div><dt>发布日期</dt><dd>${CITATION_LAB_PACKAGE.releasedAt}</dd></div><div><dt>引用记录</dt><dd>${CITATION_LAB_PACKAGE.citations.toLocaleString("zh-CN")}</dd></div><div><dt>规范问题</dt><dd>${CITATION_LAB_PACKAGE.canonicalQuestions}</dd></div><div><dt>平台 / 终端</dt><dd>${CITATION_LAB_PACKAGE.platforms}</dd></div><div><dt>规范信源</dt><dd>${CITATION_LAB_PACKAGE.canonicalSources.toLocaleString("zh-CN")}</dd></div><div><dt>页面记录</dt><dd>${CITATION_LAB_PACKAGE.pages.toLocaleString("zh-CN")}</dd></div><div><dt>来源</dt><dd>${CITATION_LAB_PACKAGE.source}</dd></div></dl></section><section class="card"><div class="card-header"><div><h3>安全更新流程</h3><p>自动任务只检查，不自动下载或激活。</p></div></div><ol class="diagnostic-update-flow"><li><i>1</i><span><b>检查官方版本</b><small>分别读取数据 Release 与仓库 commit。</small></span></li><li><i>2</i><span><b>隔离暂存与校验</b><small>统计包核验 Schema；文档核验路径、许可和双哈希。</small></span></li><li><i>3</i><span><b>管理员确认激活</b><small>数据与文档分别切换，不互相覆盖。</small></span></li><li><i>4</i><span><b>原子切换与回滚</b><small>历史报告继续绑定原数据与证据版本。</small></span></li></ol></section></div><section class="card diagnostic-boundaries"><div class="card-header"><div><h3>数据边界与许可</h3><p>私有化交付时必须保留来源、版本和修改说明。</p></div></div><div><span data-icon="alert"></span><p><b>不能由当前研究包得出：</b>当前品牌排名、推荐率、情感、严格实时引用位置与周期趋势。仓库缺少完整回答、可靠 response_id、统一模型版本与统一采集时间。</p></div><div><span data-icon="lock"></span><p><b>许可：</b>${escapeHtml(CITATION_LAB_PACKAGE.license)}；第三方论文和数据维持原许可。</p></div></section>`;
}

const EFFECT_RELAY_PLATFORM_CODES = Object.freeze({
  "豆包": "DB", DeepSeek: "DS", "元宝": "YB", "千问": "QW", "百度AI": "BD", "文心一言": "WX", Kimi: "KIMI", "AI抖音": "DYAI", "红书问一问": "RED"
});
const EFFECT_RELAY_PLATFORM_NAMES = Object.freeze({ DB: "豆包", DS: "DeepSeek", YB: "元宝", QW: "千问", BD: "百度AI", WX: "文心一言", KIMI: "Kimi", DYAI: "AI抖音", RED: "红书问一问" });
const EFFECT_RELAY_PLATFORM_UI = Object.freeze({
  DB: { code: "豆", color: "#18a7e9" }, DS: { code: "DS", color: "#647cf0" }, YB: { code: "元", color: "#13b878" },
  QW: { code: "千", color: "#4c68e9" }, BD: { code: "百", color: "#7856e8" }, WX: { code: "文", color: "#378ee5" },
  KIMI: { code: "Km", color: "#17191d" }, DYAI: { code: "抖", color: "#17191d" }, RED: { code: "书", color: "#f0445b" }
});
const EFFECT_RELAY_TERMINALS = Object.freeze({ "网页": "web", "手机": "mobile", "电商": "commerce" });
const EFFECT_RELAY_MODES = Object.freeze({ "快速": "fast", "深度": "deep", "专家": "expert", "思考": "thinking", "深度思考": "deep" });
const EFFECT_RELAY_TERMINAL_NAMES = Object.freeze({ web: "网页", mobile: "手机", commerce: "电商" });
const EFFECT_RELAY_MODE_NAMES = Object.freeze({ fast: "快速", deep: "深度", expert: "专家", thinking: "思考" });

function effectRelayData(payload) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
}

function effectRelayCapabilityItems() {
  const items = effectRelaySnapshot.capabilities?.items;
  return Array.isArray(items) ? items : [];
}

function effectRelayExecutionMode() {
  return String(effectRelaySnapshot.capabilities?.provider?.executionMode || "").trim().toLowerCase();
}

function effectRelayPlatformCode(platform) {
  return EFFECT_RELAY_PLATFORM_CODES[platform] || String(platform || "").trim();
}

function effectRelayTerminalCode(terminal) {
  return EFFECT_RELAY_TERMINALS[terminal] || String(terminal || "web").trim().toLowerCase();
}

function effectRelayModeCode(mode) {
  return EFFECT_RELAY_MODES[mode] || String(mode || "fast").trim().toLowerCase();
}

function effectRelayItemAvailable(platform, terminal, mode) {
  if (!effectRelaySnapshot.capabilities) return false;
  const code = effectRelayPlatformCode(platform);
  const terminalCode = effectRelayTerminalCode(terminal);
  const modeCode = effectRelayModeCode(mode);
  return effectRelayCapabilityItems().some((item) => String(item.platform) === code && String(item.terminal) === terminalCode && String(item.mode) === modeCode);
}

function effectRelayScopeKey(platform, terminal) {
  return `${String(platform || "").trim()}|${String(terminal || "").trim()}`;
}

function effectRelayNormalizeScope(scope) {
  const [platform = "", terminal = "web"] = String(scope || "").split("|");
  return effectRelayScopeKey(effectRelayPlatformCode(platform), effectRelayTerminalCode(terminal));
}

function effectRelayCapabilityScopeKeys() {
  return [...new Set(effectRelayCapabilityItems().map((item) => effectRelayScopeKey(item.platform, item.terminal)))];
}

const EFFECT_REALTIME_PLATFORM_LAYOUT = Object.freeze({
  DB: [{ terminal: "web", modes: ["fast", "expert"] }, { terminal: "mobile", modes: ["fast", "expert"], badge: "电商" }],
  DS: [{ terminal: "web", modes: ["fast", "deep"] }, { terminal: "mobile", modes: ["fast", "deep"] }],
  YB: [{ terminal: "web", modes: ["fast", "deep"], badge: "电商" }],
  QW: [{ terminal: "web", modes: ["fast", "deep"] }, { terminal: "mobile", modes: ["fast", "deep"] }],
  BD: [{ terminal: "web", modes: ["fast"] }],
  WX: [{ terminal: "web", modes: ["fast", "deep"] }],
  KIMI: [{ terminal: "web", modes: ["fast", "thinking"] }],
  DYAI: [{ terminal: "web", modes: ["fast", "deep"] }],
  RED: [{ terminal: "mobile", modes: ["fast"] }]
});

function effectRealtimeCapabilityScopeKeys() {
  const available = new Set(effectRelayCapabilityScopeKeys());
  return Object.entries(EFFECT_REALTIME_PLATFORM_LAYOUT).flatMap(([platform, rows]) => rows
    .map((row) => effectRelayScopeKey(platform, row.terminal))
    .filter((scope) => available.has(scope)));
}

function effectSearchQuestionList(value = ui.effectSearchQuestion) {
  return [...new Set(String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean))].slice(0, 20);
}

function effectSearchDraftQuestions() {
  return effectSearchQuestionList().map((text, index) => ({ id: `draft-question-${index + 1}`, text }));
}

function effectSearchEstimatedCredits(items = []) {
  const prices = new Map(effectRelayCapabilityItems().map((item) => [
    [item.platform, item.terminal, item.mode].map((value) => String(value || "").trim()).join("|"),
    Number(item.customerCredits || 0)
  ]));
  return (Array.isArray(items) ? items : []).reduce((total, item) => total + Number(prices.get([item.platform, item.terminal, item.mode].join("|")) || 0), 0);
}

function updateEffectSearchComposerState() {
  if (currentRoute() !== "effect-search") return;
  const question = document.getElementById("effect-search-question")?.value.trim() || "";
  const items = effectRelaySupportedItems(ui.effectPlatformScopes, ui.effectPlatformModes, question ? [{ id: "realtime-draft", text: question }] : []);
  const estimate = document.querySelector("[data-effect-search-estimate]");
  const submit = document.querySelector('[data-action="effect-search-run"]');
  if (estimate) {
    estimate.hidden = !question;
    estimate.innerHTML = question ? `<span>${icon("credit-card")}</span><b>本次预计消耗 ${effectSearchEstimatedCredits(items).toLocaleString("zh-CN")} 积分</b><small>发送时会按最新价格自动校验</small>` : "";
    hydrateIcons(estimate);
  }
  if (submit) submit.disabled = ui.effectSearchSubmitting || !question || !items.length;
}

function effectRelaySupportedItems(scopes = ui.effectPlatformScopes || [], modes = ui.effectPlatformModes || ["fast"], questions = effectSearchDraftQuestions(), requestContext = {}) {
  const selectedScopes = new Set((scopes || []).map(effectRelayNormalizeScope));
  const selectedModes = new Set((modes || []).map(effectRelayModeCode));
  const selectedCapabilities = effectRelayCapabilityItems().filter((item) =>
    selectedScopes.has(effectRelayScopeKey(item.platform, item.terminal)) && selectedModes.has(String(item.mode || "").trim())
  );
  const normalizedQuestions = (Array.isArray(questions) ? questions : []).map((question, index) => ({
    id: String(question?.id || `draft-question-${index + 1}`),
    text: String(question?.text || question?.prompt || "").trim()
  })).filter((question) => question.text);
  return normalizedQuestions.flatMap((question) => selectedCapabilities.map((capability) => {
    const platform = String(capability.platform || "").trim();
    const terminal = String(capability.terminal || "").trim();
    const mode = String(capability.mode || "").trim();
    const itemId = `${question.id}-${platform}-${terminal}-${mode}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return {
      itemId,
      clientItemId: itemId,
      questionId: question.id,
      prompt: question.text,
      platform,
      terminal,
      mode,
      metadata: {
        displayPlatform: EFFECT_RELAY_PLATFORM_NAMES[platform] || platform,
        displayTerminal: EFFECT_RELAY_TERMINAL_NAMES[terminal] || terminal,
        displayMode: EFFECT_RELAY_MODE_NAMES[mode] || mode,
        source: requestContext.source || "customer_ui",
        feature: requestContext.feature || ""
      }
    };
  }));
}

// A brand diagnostic does not mean one long, stateful chat session.  AIDSO
// executes independent tasks, so the UI's "conversation count" is modelled as
// N independently traceable samples under the exact same condition.  The
// round is carried in item metadata and the item id, allowing delivery and the
// report to distinguish every sample without inventing a multi-turn dialogue.
function effectDiagnosticRoundCount(scope) {
  const normalizedScope = effectRelayNormalizeScope(scope);
  const configured = Number(ui.effectDiagnosticPlatformRounds?.[normalizedScope] || 1);
  return Math.max(1, Math.min(20, Math.floor(Number.isFinite(configured) ? configured : 1)));
}

function effectDiagnosticSupportedItems(
  scopes = ui.effectDiagnosticScopes || [],
  modes = ui.effectDiagnosticModes || ["fast"],
  questions = effectDiagnosticDraftQuestions(),
  requestContext = {}
) {
  const selectedScopes = new Set((scopes || []).map(effectRelayNormalizeScope));
  const selectedModes = new Set((modes || []).map(effectRelayModeCode));
  const selectedCapabilities = effectRelayCapabilityItems().filter((item) =>
    selectedScopes.has(effectRelayScopeKey(item.platform, item.terminal)) && selectedModes.has(String(item.mode || "").trim())
  );
  const normalizedQuestions = (Array.isArray(questions) ? questions : []).map((question, index) => ({
    id: String(question?.id || `diagnostic-question-${index + 1}`),
    text: String(question?.text || question?.prompt || "").trim()
  })).filter((question) => question.text);
  const seenCapabilities = new Set();
  const items = [];
  for (const question of normalizedQuestions) {
    for (const capability of selectedCapabilities) {
      const platform = String(capability.platform || "").trim();
      const terminal = String(capability.terminal || "").trim();
      const mode = String(capability.mode || "").trim();
      const capabilityKey = `${platform}|${terminal}|${mode}`;
      if (!platform || !terminal || !mode || seenCapabilities.has(`${question.id}|${capabilityKey}`)) continue;
      seenCapabilities.add(`${question.id}|${capabilityKey}`);
      const scope = effectRelayScopeKey(platform, terminal);
      const rounds = effectDiagnosticRoundCount(scope);
      for (let round = 1; round <= rounds; round += 1) {
        const itemId = `${question.id}-${platform}-${terminal}-${mode}-sample-${round}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
        items.push({
          itemId,
          clientItemId: itemId,
          questionId: question.id,
          prompt: question.text,
          platform,
          terminal,
          mode,
          round,
          metadata: {
            displayPlatform: EFFECT_RELAY_PLATFORM_NAMES[platform] || platform,
            displayTerminal: EFFECT_RELAY_TERMINAL_NAMES[terminal] || terminal,
            displayMode: EFFECT_RELAY_MODE_NAMES[mode] || mode,
            source: requestContext.source || "effect_diagnostic",
            feature: requestContext.feature || "aidso_brand_diagnostic",
            samplingRound: round,
            samplingCount: rounds,
            samplingScope: scope
          }
        });
      }
    }
  }
  return items;
}

function effectSearchInputSignature(question = ui.effectSearchQuestion, brand = ui.effectSearchBrand) {
  const normalizedQuestionSet = effectSearchQuestionList(question).join("\n");
  return [normalizedQuestionSet, brand, ui.effectSearchIndustry, ...(ui.effectPlatformScopes || []).map(effectRelayNormalizeScope).sort(), ...(ui.effectPlatformModes || []).map(effectRelayModeCode).sort()].join("|");
}

function effectRelayRunStatus(link = effectRelaySnapshot.activeLink, run = effectRelaySnapshot.activeRun) {
  // The relay link preserves statuses such as partial / attention / cancelled
  // that the local diagnostic run intentionally folds for storage purposes.
  return String(link?.status || run?.status || "idle").toLowerCase();
}

function effectRelayRunLabel(status = effectRelayRunStatus()) {
  return ({
    idle: "尚未提交", pending: "等待系统确认", submitted: "已提交", queued: "排队中", running: "AI 检测中",
    completed: "已完成", partial: "部分完成", failed: "执行失败", attention: "需要对账", cancelled: "已取消"
  })[status] || status || "未连接";
}

function effectRelayStageState(status = "idle", stats = {}) {
  const normalized = String(status || "idle").toLowerCase();
  const delivered = Number(stats.delivered || 0);
  const verified = Number(stats.verified || 0);
  const hasReturnedEvidence = delivered > 0 || verified > 0;
  if (normalized === "completed") return { current: 4, tone: "complete" };
  if (normalized === "partial") return { current: 4, tone: "partial" };
  if (["failed", "attention"].includes(normalized)) return { current: hasReturnedEvidence ? 3 : 2, tone: "error" };
  if (normalized === "cancelled") return { current: hasReturnedEvidence ? 3 : 1, tone: "cancelled" };
  if (normalized === "running") return { current: hasReturnedEvidence ? 3 : 2, tone: "active" };
  if (["pending", "submitted", "queued"].includes(normalized)) return { current: 1, tone: "active" };
  return { current: 0, tone: "idle" };
}

const EFFECT_RELAY_FEATURES = Object.freeze({
  realtime: ["aidso_realtime_search", "real_time_search", "effect_search"],
  diagnostic: ["aidso_brand_diagnostic", "brand_diagnostic", "effect_diagnostic"],
  monitoring: ["aidso_brand_monitoring", "brand_monitor", "brand_monitoring", "effect_monitor"]
});

function effectRelayEntryFeature(entry) {
  const request = entry?.link?.request || {};
  return String(
    request.requestMetadata?.feature
    || request.analysisScope?.feature
    || request.items?.[0]?.metadata?.feature
    || ""
  ).trim();
}

function effectRelayEntryMatchesFlow(entry, flow = "") {
  if (!flow) return true;
  const accepted = EFFECT_RELAY_FEATURES[flow] || [flow];
  return accepted.includes(effectRelayEntryFeature(entry));
}

function effectFlowStateFor(flow = "realtime") {
  return effectFlowState[flow] || effectFlowState.realtime;
}

function effectRelayQuoteFor(flow = "realtime") {
  return effectFlowStateFor(flow).quote;
}

function setEffectRelayQuote(flow, quote) {
  effectFlowStateFor(flow).quote = quote || null;
  // Keep the legacy snapshot field for shared status consumers, but never use
  // it as the source of truth for a product renderer.
  if (currentRoute() === (flow === "diagnostic" ? "effect-diagnostic" : flow === "monitoring" ? "effect-monitor" : "effect-search")) {
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: quote || null };
  }
}

function setEffectFlowError(flow, error = "") {
  effectFlowStateFor(flow).error = String(error || "");
}

function effectRelayHistoryEntriesForFlow(flow) {
  return effectRelayHistoryEntries(flow);
}

function effectRelaySearchProject(projects = effectRelaySnapshot.projects) {
  const rows = Array.isArray(projects) ? projects : [];
  return rows.find((project) => project.scope?.feature === "aidso_realtime_search" && String(project.id) === String(ui.effectSearchProjectId))
    || rows.find((project) => project.scope?.feature === "aidso_realtime_search" && project.status !== "archived")
    || null;
}

function effectRelayDiagnosticProject(projects = effectRelaySnapshot.projects) {
  const rows = Array.isArray(projects) ? projects : [];
  return rows.find((project) => project.scope?.feature === "aidso_brand_diagnostic" && String(project.id) === String(ui.effectDiagnosticProjectId))
    || rows.find((project) => project.scope?.feature === "aidso_brand_diagnostic" && project.status !== "archived")
    || null;
}

function effectRelayRecordFromEvidence(evidence, link = effectRelaySnapshot.activeLink) {
  const payload = evidence?.payload || {};
  const delivery = payload.delivery || {};
  const normalized = delivery.normalized || {};
  const request = payload.request || (link?.request?.items || []).find((item) => item.itemId === delivery.itemId || item.clientItemId === delivery.itemId) || {};
  const upstream = delivery.upstream || {};
  const platformCode = upstream.platform || request.platform || evidence?.provenance?.platform || "";
  const terminalCode = upstream.terminal || request.terminal || evidence?.provenance?.terminal || "web";
  const modeCode = upstream.mode || request.mode || evidence?.provenance?.mode || "fast";
  const quotes = Array.isArray(normalized.quotes) ? normalized.quotes.map((quote) => ({
    title: quote.title || quote.siteName || quote.domain || quote.url || "引用来源",
    domain: quote.domain || quote.siteName || "",
    url: quote.url || ""
  })) : [];
  const answer = normalized.answerText || evidence.claim || evidence.excerpt || "检测服务未返回可展示的回答。";
  const brand = request.brand?.name || link?.request?.brand?.name || "";
  const aliases = request.brand?.aliases || link?.request?.brand?.aliases || effectSearchBrandTerms(brand);
  const mentioned = normalized.brandMentioned === true || Number(normalized.brandMentionCount || 0) > 0;
  return {
    id: evidence.id || `live-${delivery.deliveryId || Date.now()}`,
    questionId: request.questionId || null,
    question: request.prompt || "",
    brandTerms: Array.isArray(aliases) ? aliases : effectSearchBrandTerms(brand),
    platform: EFFECT_RELAY_PLATFORM_NAMES[platformCode] || platformCode || "未知平台",
    terminal: EFFECT_RELAY_TERMINAL_NAMES[terminalCode] || terminalCode || "网页",
    mode: EFFECT_RELAY_MODE_NAMES[modeCode] || modeCode || "快速",
    answer,
    fullDialogue: [{ role: "user", content: request.prompt || "" }, { role: "assistant", content: answer }],
    brandMentionCount: Number(normalized.brandMentionCount || 0),
    mentionedBrands: mentioned && brand ? [effectSearchBrandTerms(brand)[0]] : [],
    citationSources: quotes,
    observedAt: evidence.observedAt || delivery.observedAt || new Date().toISOString(),
    evidenceId: evidence.id || delivery.deliveryId || "",
    status: evidence.verificationStatus || normalized.qualityStatus || "supplied",
    source: "relay",
    relayRunId: delivery.relayRunId || link?.relayRunId || null,
    diagnosticRunId: evidence.runId || link?.diagnosticRunId || null,
    projectId: link?.request?.projectId || null,
    deliveryId: delivery.deliveryId || null,
    upstreamReqId: evidence.provenance?.upstreamReqId || upstream.reqId || null,
    itemStatus: delivery.status || "unknown",
    itemId: delivery.itemId || request.itemId || request.clientItemId || evidence.provenance?.itemId || null,
    firstMentionRank: Number.isFinite(Number(normalized.firstMentionRank ?? normalized.brandRank ?? normalized.rank)) && Number(normalized.firstMentionRank ?? normalized.brandRank ?? normalized.rank) > 0
      ? Number(normalized.firstMentionRank ?? normalized.brandRank ?? normalized.rank)
      : null,
    sentiment: String(normalized.sentiment || normalized.sentimentLabel || "").trim() || null,
    round: Math.max(1, Number(request?.metadata?.samplingRound || request?.round || evidence?.provenance?.samplingRound || 1) || 1),
    samplingCount: Math.max(1, Number(request?.metadata?.samplingCount || 1) || 1)
  };
}

function effectRelayRecordsFromRun(run, link = effectRelaySnapshot.activeLink) {
  const evidence = Array.isArray(run?.evidence) ? run.evidence.filter((item) => item.evidenceType === "live") : [];
  return evidence.map((item) => effectRelayRecordFromEvidence(item, link));
}

function effectRelayFlowForEntry(entry) {
  const feature = effectRelayEntryFeature(entry);
  if (EFFECT_RELAY_FEATURES.realtime.includes(feature)) return "realtime";
  if (EFFECT_RELAY_FEATURES.diagnostic.includes(feature)) return "diagnostic";
  if (EFFECT_RELAY_FEATURES.monitoring.includes(feature)) return "monitoring";
  return "";
}

function effectRelayHistoryEntries(flow = "") {
  return (Array.isArray(effectRelaySnapshot.history) ? effectRelaySnapshot.history : [])
    .filter((entry) => entry?.link?.diagnosticRunId)
    .filter((entry) => effectRelayEntryMatchesFlow(entry, flow))
    .slice()
    .sort((left, right) => String(right.link.createdAt || "").localeCompare(String(left.link.createdAt || "")));
}

function effectRelayHistoryEntry(runId = ui.effectSearchRunId, flow = "") {
  return effectRelayHistoryEntries(flow).find((entry) => String(entry.link.diagnosticRunId) === String(runId)) || null;
}

function effectRelayHistoryRecords(flow = "") {
  return effectRelayHistoryEntries(flow).flatMap((entry) => effectRelayRecordsFromRun(entry.run, entry.link));
}

function effectRelaySetActiveEntry(entry, flow = "realtime") {
  if (!entry?.link) return null;
  const flowState = effectFlowStateFor(flow);
  flowState.activeRun = entry.run || null;
  flowState.activeLink = entry.link;
  flowState.error = "";
  if (flow === "diagnostic") {
    ui.effectDiagnosticRunId = entry.link.diagnosticRunId;
    ui.effectDiagnosticRelayRunId = entry.link.relayRunId || null;
  } else if (flow === "realtime") {
    if (String(ui.effectSearchReport?.runId || "") !== String(entry.link.diagnosticRunId || "")) {
      ui.effectSearchReport = null;
      ui.effectSearchReportError = "";
      ui.effectSearchReportAttemptedRunId = null;
    }
    ui.effectSearchRunId = entry.link.diagnosticRunId;
    ui.effectSearchRelayRunId = entry.link.relayRunId || null;
    ui.effectSearchRecords = effectRelayRecordsFromRun(entry.run, entry.link);
  }
  effectRelaySnapshot = { ...effectRelaySnapshot, activeLink: entry.link, activeRun: entry.run || null };
  return entry;
}

function effectRelayReconcileCapabilities() {
  const previousScopes = (ui.effectPlatformScopes || []).map(effectRelayNormalizeScope).sort().join("|");
  const previousModes = (ui.effectPlatformModes || []).map(effectRelayModeCode).sort().join("|");
  const scopes = new Set(effectRelayCapabilityScopeKeys());
  const modes = new Set(effectRelayCapabilityItems().map((item) => String(item.mode || "").trim()).filter(Boolean));
  ui.effectPlatformScopes = [...new Set((ui.effectPlatformScopes || []).map(effectRelayNormalizeScope).filter((scope) => scopes.has(scope)))];
  ui.effectPlatformModes = [...new Set((ui.effectPlatformModes || []).map(effectRelayModeCode).filter((mode) => modes.has(mode)))];
  ui.effectPlatforms = [...new Set(ui.effectPlatformScopes.map((scope) => {
    const [platform] = scope.split("|");
    return EFFECT_RELAY_PLATFORM_NAMES[platform] || platform;
  }))];
  if (!ui.effectSearchScopeSelectionTouched && !ui.effectPlatformScopes.length && scopes.size) {
    ui.effectPlatformScopes = effectRealtimeCapabilityScopeKeys();
    ui.effectPlatformModes = [modes.has("fast") ? "fast" : [...modes][0]].filter(Boolean);
    ui.effectPlatforms = [...new Set(ui.effectPlatformScopes.map((scope) => {
      const [platform] = scope.split("|");
      return EFFECT_RELAY_PLATFORM_NAMES[platform] || platform;
    }))];
  }
  const selectionChanged = previousScopes !== ui.effectPlatformScopes.slice().sort().join("|") || previousModes !== ui.effectPlatformModes.slice().sort().join("|");
  if (selectionChanged && ui.effectSearchQuoteReady) {
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
  }
  const diagnosticScopes = [...new Set((ui.effectDiagnosticScopes || []).map(effectRelayNormalizeScope).filter((scope) => scopes.has(scope)))];
  const diagnosticModes = [...new Set((ui.effectDiagnosticModes || []).map(effectRelayModeCode).filter((mode) => modes.has(mode)))];
  const diagnosticChanged = diagnosticScopes.slice().sort().join("|") !== (ui.effectDiagnosticScopes || []).map(effectRelayNormalizeScope).sort().join("|")
    || diagnosticModes.slice().sort().join("|") !== (ui.effectDiagnosticModes || []).map(effectRelayModeCode).sort().join("|");
  ui.effectDiagnosticScopes = diagnosticScopes;
  ui.effectDiagnosticModes = diagnosticModes;
  // The AIDSO completeAnalysis flow opens with the capability snapshot
  // selected, matching the product's multi-platform diagnostic setup.  Keep
  // an explicit empty selection when the user has already changed it.
  if (ui.effectDiagnosticStarted && !ui.effectDiagnosticScopeSelectionTouched && !ui.effectDiagnosticScopes.length && scopes.size) {
    ui.effectDiagnosticScopes = [...scopes];
    ui.effectDiagnosticPlatformRounds = Object.fromEntries(ui.effectDiagnosticScopes.map((scope) => [scope, Number(ui.effectDiagnosticPlatformRounds?.[scope] || 1)]));
  }
  if (ui.effectDiagnosticStarted && !ui.effectDiagnosticModes.length && modes.size) {
    ui.effectDiagnosticModes = [modes.has("fast") ? "fast" : [...modes][0]];
  }
  if (diagnosticChanged && ui.effectDiagnosticQuoteReady) {
    ui.effectDiagnosticQuoteReady = false;
    ui.effectDiagnosticClientRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
  }
}

async function refreshEffectRelay({ renderAfter = false } = {}) {
  if (effectRelaySnapshot.loading) return effectRelaySnapshot;
  effectRelaySnapshot = { ...effectRelaySnapshot, attempted: true, loading: true, error: "" };
  try {
    const [capabilitiesResult, quotaResult, projectsResult, historyResult] = await Promise.allSettled([
      productionApi("/api/v1/diagnostics/relay/capabilities"),
      productionApi("/api/v1/diagnostics/relay/quota"),
      productionApi("/api/v1/diagnostics/projects?limit=100"),
      productionApi("/api/v1/diagnostics/relay-runs?limit=50&includeEvidence=true")
    ]);
    const failures = [capabilitiesResult, quotaResult, projectsResult].filter((item) => item.status === "rejected");
    const projects = projectsResult.status === "fulfilled" ? diagnosticApiItems(projectsResult.value, ["projects"]) : effectRelaySnapshot.projects;
    const historyPayload = historyResult.status === "fulfilled" ? effectRelayData(historyResult.value) : null;
    let history = Array.isArray(historyPayload?.items)
      ? historyPayload.items.filter((entry) => entry?.link?.diagnosticRunId)
      : effectRelaySnapshot.history;
    let historyLoaded = historyResult.status === "fulfilled";
    let historyError = historyResult.status === "rejected" ? (historyResult.reason?.message || "任务历史读取失败") : "";
    // A rolling client upgrade can briefly pair the new page with a customer
    // server that has not restarted yet.  Fall back to the older per-project
    // read API without ever manufacturing task rows or evidence.
    if (!historyLoaded && projectsResult.status === "fulfilled") {
      try {
        const relayProjects = projects.filter((project) => ["aidso_realtime_search", "aidso_brand_diagnostic", "aidso_brand_monitoring"].includes(project.scope?.feature));
        const linkResults = await Promise.allSettled(relayProjects.map((project) => productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(project.id)}/relay-runs?limit=50`)));
        const links = linkResults.flatMap((result) => result.status === "fulfilled" ? diagnosticApiItems(result.value, ["items", "links"]) : []);
        const runResults = await Promise.allSettled(links.map((link) => productionApi(`/api/v1/diagnostics/relay-runs/${encodeURIComponent(link.diagnosticRunId)}`)));
        history = runResults.flatMap((result) => {
          if (result.status !== "fulfilled") return [];
          const data = effectRelayData(result.value);
          return data.link?.diagnosticRunId ? [{ link: data.link, run: data.run || null }] : [];
        });
        historyLoaded = true;
        historyError = "";
      } catch (error) {
        historyError = error.message || historyError;
      }
    }
    effectRelaySnapshot = {
      ...effectRelaySnapshot,
      loaded: failures.length < 3,
      loading: false,
      capabilities: capabilitiesResult.status === "fulfilled" ? effectRelayData(capabilitiesResult.value).capabilities || null : effectRelaySnapshot.capabilities,
      quota: quotaResult.status === "fulfilled" ? effectRelayData(quotaResult.value).quota || null : effectRelaySnapshot.quota,
      projects,
      history,
      historyLoaded,
      historyError,
      links: history.map((entry) => entry.link),
      error: failures.length === 3 ? customerFacingEffectText(failures[0].reason?.message || "AI 检测服务暂不可用") : customerFacingEffectText(failures.map((item) => item.reason?.message).filter(Boolean).join("；")),
      loadedAt: Date.now()
    };
    if (capabilitiesResult.status === "fulfilled") effectRelayReconcileCapabilities();
    const project = effectRelaySearchProject(projects);
    if (project && !ui.effectSearchProjectId) ui.effectSearchProjectId = project.id;
    const diagnosticProject = effectRelayDiagnosticProject(projects);
    if (diagnosticProject && !ui.effectDiagnosticProjectId) ui.effectDiagnosticProjectId = diagnosticProject.id;
    for (const [flow, runId] of [
      ["realtime", ui.effectSearchRunId],
      ["diagnostic", ui.effectDiagnosticRunId],
      ["monitoring", null]
   ]) {
      const activeEntry = runId
        ? effectRelayHistoryEntry(runId, flow)
        : flow === "diagnostic" ? null : effectRelayHistoryEntries(flow)[0] || null;
      if (!activeEntry) continue;
      effectRelaySetActiveEntry(activeEntry, flow);
      const status = effectRelayRunStatus(activeEntry.link, activeEntry.run);
      if (["pending", "submitted", "queued", "running"].includes(status)) scheduleEffectRelayPoll(activeEntry.link.diagnosticRunId, flow);
    }
  } catch (error) {
    effectRelaySnapshot = { ...effectRelaySnapshot, loading: false, loaded: false, error: customerFacingEffectText(error.message || "AI 检测服务连接失败"), loadedAt: Date.now() };
  }
  if (renderAfter && ["effect-search", "effect-diagnostic", "effect-monitor"].includes(currentRoute())) render();
  return effectRelaySnapshot;
}

function scheduleEffectRelayPoll(runId, flow = "realtime") {
  const timer = effectRelayPollTimers[flow] || null;
  if (timer) window.clearTimeout(timer);
  if (!runId) return;
  effectRelayPollTimers[flow] = window.setTimeout(() => {
    effectRelayPollTimers[flow] = null;
    return refreshEffectRelayRun({ runId, pull: true, renderAfter: true, flow });
  }, 1_800);
}

async function loadEffectSearchReport(runId = ui.effectSearchRunId) {
  if (!runId) return null;
  try {
    const listPayload = await productionApi(`/api/v1/diagnostics/reports?runId=${encodeURIComponent(runId)}&status=final&limit=10`);
    const reports = diagnosticApiItems(listPayload, ["items", "reports"]);
    const summary = reports.find((item) => item?.methodology?.analysisMode === "full_live_effect") || null;
    const reportId = summary?.id || summary?.reportId || null;
    if (!reportId) return null;
    const detailPayload = await productionApi(`/api/v1/diagnostics/reports/${encodeURIComponent(reportId)}`);
    const report = diagnosticApiEntity(detailPayload, ["report", "diagnosticReport"]) || summary;
    if (report?.methodology?.analysisMode !== "full_live_effect") return null;
    ui.effectSearchReport = report;
    ui.effectSearchReportError = "";
    ui.effectSearchReportAttemptedRunId = runId;
    return report;
  } catch {
    return null;
  }
}

async function generateEffectSearchReport(runId = ui.effectSearchRunId) {
  if (!runId || ui.effectSearchReportLoading || ui.effectSearchReportAttemptedRunId === runId) return null;
  const entry = effectRelayHistoryEntry(runId, "realtime");
  const status = effectRelayRunStatus(entry?.link, entry?.run);
  const verified = effectRelayRecordsFromRun(entry?.run, entry?.link).filter((record) => record.status === "verified");
  const projectId = entry?.link?.projectId || entry?.run?.projectId || ui.effectSearchProjectId;
  if (!projectId || !["completed", "partial"].includes(status) || !verified.length) return null;
  const providerId = typeof selectedTextProviderId === "function" ? selectedTextProviderId() : String(state.settings?.modelProviderId || "").trim();
  if (!providerId) return null;
  ui.effectSearchReportAttemptedRunId = runId;
  ui.effectSearchReportLoading = true;
  ui.effectSearchReportError = "";
  render();
  try {
    const existing = await loadEffectSearchReport(runId);
    if (existing) return existing;
    const payload = await productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/relay-runs/${encodeURIComponent(runId)}/report`, {
      method: "POST",
      body: {
        reportMode: "full_live_effect",
        title: `${ui.effectSearchBrand || entry.link.request?.brand?.name || "品牌"} AI 效果分析报告`,
        providerId,
        model: typeof selectedTextModelName === "function" ? selectedTextModelName() : String(state.settings?.model || "").trim(),
        externalDataConsent: true,
        externalDataConsentAt: new Date().toISOString(),
        externalDataConsentMethod: "effect_search_user_confirm"
      }
    });
    const data = effectRelayData(payload);
    ui.effectSearchReport = data.report || null;
    if (!ui.effectSearchReport) throw new Error("服务端未返回分析报告。");
    ui.effectSearchReportError = "";
    showToast("分析报告已生成", "报告只使用本次已验证的实时检测数据。", "success");
    return ui.effectSearchReport;
  } catch (error) {
    ui.effectSearchReportError = customerFacingEffectText(error.message || "分析报告生成失败");
    showToast("分析报告未生成", ui.effectSearchReportError, "error");
    return null;
  } finally {
    ui.effectSearchReportLoading = false;
    render();
  }
}

async function refreshEffectRelayRun({ runId = ui.effectSearchRunId, pull = true, renderAfter = false, flow = "realtime" } = {}) {
  if (!runId) return null;
  try {
    if (pull) await productionApi(`/api/v1/diagnostics/relay-runs/${encodeURIComponent(runId)}/pull`, { method: "POST", body: { limit: 50 } }).catch(() => null);
    const payload = await productionApi(`/api/v1/diagnostics/relay-runs/${encodeURIComponent(runId)}`);
    const data = effectRelayData(payload);
    const entry = { link: data.link || null, run: data.run || null };
    const flowState = effectFlowStateFor(flow);
    const existing = effectRelayHistoryEntries().filter((item) => String(item.link.diagnosticRunId) !== String(runId));
    if (entry.link?.diagnosticRunId) existing.unshift(entry);
    effectRelaySnapshot = {
      ...effectRelaySnapshot,
      history: existing,
      historyLoaded: true,
      links: existing.map((item) => item.link),
      activeLink: entry.link,
      activeRun: entry.run,
      error: "",
      loaded: true,
      loadedAt: Date.now()
    };
    flowState.activeLink = entry.link;
    flowState.activeRun = entry.run;
    flowState.error = "";
    const records = effectRelayRecordsFromRun(entry.run, entry.link);
    if (flow === "diagnostic") {
      ui.effectDiagnosticRunId = runId;
      ui.effectDiagnosticRelayRunId = entry.link?.relayRunId || null;
    } else {
      if (String(ui.effectSearchReport?.runId || "") !== String(runId)) {
        ui.effectSearchReport = null;
        ui.effectSearchReportError = "";
        ui.effectSearchReportAttemptedRunId = null;
      }
      ui.effectSearchRunId = runId;
      ui.effectSearchRelayRunId = entry.link?.relayRunId || null;
      ui.effectSearchRecords = records;
    }
    const status = effectRelayRunStatus(entry.link, entry.run);
    const expected = data.link?.request?.items?.length || 0;
    const evidenceCount = records.length;
    const completed = ["completed", "partial", "failed", "attention", "cancelled"].includes(status) && (status !== "completed" || !expected || evidenceCount >= expected);
    if (flow === "diagnostic") ui.effectDiagnosticCompleted = completed;
    else ui.effectSearchCompleted = completed;
    if (!completed || (status === "completed" && expected > evidenceCount)) scheduleEffectRelayPoll(runId, flow);
    else if (effectRelayPollTimers[flow]) { window.clearTimeout(effectRelayPollTimers[flow]); effectRelayPollTimers[flow] = null; }
    if (flow === "realtime" && ["completed", "partial"].includes(status) && records.some((record) => record.status === "verified")) {
      void generateEffectSearchReport(runId);
    }
  } catch (error) {
    effectFlowStateFor(flow).error = error.message || "检测进度读取失败";
    effectRelaySnapshot = { ...effectRelaySnapshot, error: error.message || "检测进度读取失败" };
    scheduleEffectRelayPoll(runId, flow);
  }
  if (renderAfter && ["effect-search", "effect-diagnostic", "effect-monitor"].includes(currentRoute())) render();
  return effectRelaySnapshot.activeRun;
}

async function ensureEffectSearchProject({ question, brand = "" }) {
  const questionText = String(question || "").trim();
  if (!questionText) throw new Error("实时搜索需要一个问题。");
  const signature = effectSearchInputSignature(questionText, brand);
  const brandProfile = effectSearchBrandProfile(brand);
  if (ui.effectSearchProjectId && ui.effectSearchQuestionSetId && ui.effectSearchProjectSignature === signature) {
    return { projectId: ui.effectSearchProjectId, questionSetId: ui.effectSearchQuestionSetId, questions: ui.effectSearchFrozenQuestions };
  }
  const officialDomain = state.enterpriseProfile?.officialDomain || state.site?.domain || "";
  const websiteUrl = officialDomain ? (/^https?:\/\//i.test(officialDomain) ? officialDomain : `https://${officialDomain}`) : "";
  const createdAt = Date.now();
  const frozenQuestions = [{
    id: `effect-search-q-${createdAt}-1`,
    text: questionText,
    type: "aidso_realtime_search",
    source: "customer_input"
  }];
  const payload = await productionApi("/api/v1/diagnostics/projects", {
    method: "POST",
    body: {
      name: `实时搜索 · ${questionText.slice(0, 56)}`,
      diagnosticType: "comprehensive",
      industry: ui.effectSearchIndustry || "未填写行业",
      targetBrand: brandProfile.name,
      websiteUrl,
      objective: "人工发起一次实时 AI 搜索，仅查看该问题在所选能力组合中的原始回答与引用。",
      scope: {
        source: "effect_search",
        feature: "aidso_realtime_search",
        aidsoProduct: "question",
        mode: "single_question",
        customerUi: true,
        platformScopes: ui.effectPlatformScopes,
        modes: ui.effectPlatformModes
      },
      questionSetSnapshot: { name: "实时搜索问题", version: 1, frozenAt: new Date().toISOString(), questions: frozenQuestions }
    }
  });
  const data = effectRelayData(payload);
  const project = data.project || diagnosticApiEntity(payload, ["project"]);
  const questionSet = data.questionSet || null;
  if (!project?.id || !questionSet?.id) throw new Error("中转检测项目未返回冻结问题集");
  ui.effectSearchProjectId = project.id;
  ui.effectSearchQuestionSetId = questionSet.id;
  ui.effectSearchProjectSignature = signature;
  ui.effectSearchFrozenQuestions = Array.isArray(questionSet.questions) ? questionSet.questions : frozenQuestions;
  effectRelaySnapshot.projects = [project, ...effectRelaySnapshot.projects.filter((item) => item.id !== project.id)];
  return { projectId: project.id, questionSetId: questionSet.id, questions: ui.effectSearchFrozenQuestions };
}

async function prepareEffectSearchRun() {
  if (ui.effectSearchSubmitting) return;
  const questionInput = document.getElementById("effect-search-question")?.value.trim();
  const questions = effectSearchQuestionList(questionInput);
  const question = questions[0] || "";
  const brand = document.getElementById("effect-search-brand")?.value.trim();
  const industry = document.getElementById("effect-search-industry")?.value.trim();
  if (!question) return showToast("请输入问题", "实时搜索一次只能提交一个 AI 问题。", "error");
  if (questions.length !== 1) return showToast("实时搜索仅支持单问题", "多问题批量检测请使用“品牌诊断”。", "error");
  if (!(ui.effectPlatformScopes || []).length) return showToast("请至少选择一个平台终端", "这个问题会独立提交到每一个已选能力组合。", "error");
  if (!(ui.effectPlatformModes || []).length) return showToast("请至少选择一种检测模式", "请从当前客户允许的检测模式中至少选择一种。", "error");
  ui.effectSearchQuestion = question;
  ui.effectSearchBrand = brand;
  ui.effectSearchIndustry = industry || ui.effectSearchIndustry;
  ui.effectSearchExternalConsent = true;
  ui.effectSearchSubmitting = true;
  ui.effectSearchCompleted = false;
  ui.effectSearchClientRunId = null;
  ui.effectSearchReport = null;
  ui.effectSearchReportError = "";
  ui.effectSearchReportAttemptedRunId = null;
  render();
  try {
    const project = await ensureEffectSearchProject({ question, brand });
    const items = effectRelaySupportedItems(ui.effectPlatformScopes, ui.effectPlatformModes, project.questions, { source: "effect_search", feature: "aidso_realtime_search" });
    if (!items.length) throw new Error("当前客户实例没有可用的平台、终端或模式价格规则。");
    const quotePayload = await productionApi("/api/v1/diagnostics/relay/quote", { method: "POST", body: { ...project, items } });
    const quote = effectRelayData(quotePayload).quote || null;
    setEffectRelayQuote("realtime", quote);
    setEffectFlowError("realtime", "");
    effectRelaySnapshot = { ...effectRelaySnapshot, quote, error: "" };
    ui.effectSearchQuoteReady = true;
    ui.effectSearchSubmitting = false;
    await submitEffectSearchRun();
  } catch (error) {
    setEffectRelayQuote("realtime", null);
    setEffectFlowError("realtime", customerFacingEffectText(error.message || "检测报价失败"));
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null, error: customerFacingEffectText(error.message || "检测报价失败") };
    showToast("无法获取检测报价", effectRelaySnapshot.error, "error");
  } finally {
    ui.effectSearchSubmitting = false;
    render();
  }
}

async function submitEffectSearchRun() {
  if (ui.effectSearchSubmitting || !ui.effectSearchQuoteReady) return;
  const projectId = ui.effectSearchProjectId;
  const questionSetId = ui.effectSearchQuestionSetId;
  if (!projectId || !questionSetId) return showToast("检测配置已失效", "请重新获取报价后再提交。", "error");
  const items = effectRelaySupportedItems(ui.effectPlatformScopes, ui.effectPlatformModes, ui.effectSearchFrozenQuestions, { source: "effect_search", feature: "aidso_realtime_search" });
  if (!items.length) return showToast("没有可执行的检测项", "请重新选择当前可用的平台终端和模式。", "error");
  ui.effectSearchSubmitting = true;
  render();
  // Every confirmation is a new observation.  Only retries of the same HTTP
  // request reuse an idempotency key on the customer server; clicking submit
  // again later must never silently return an old real-time answer.
  const clientRunId = uid("EFFECT_SEARCH");
  const idempotencyKey = `effect-search:${projectId}:${clientRunId}`;
  ui.effectSearchClientRunId = clientRunId;
  try {
    const payload = await productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/relay-runs`, {
      method: "POST",
      body: {
        questionSetId,
        clientRunId,
        idempotencyKey,
        items,
        brand: effectSearchBrandProfile(),
        analysisScope: {
          source: "effect_search",
          feature: "aidso_realtime_search",
          aidsoProduct: "question",
          mode: "single_question",
          industry: ui.effectSearchIndustry,
          questionCount: 1
        },
        requestMetadata: { client: "tongzhuo-geo-platform", page: "effect-search", feature: "aidso_realtime_search", aidsoProduct: "question", flow: "single_question" },
        consent: { externalDataConsent: true, consentedAt: new Date().toISOString(), method: "effect_search_user_confirm" }
      }
    });
    const data = effectRelayData(payload);
    ui.effectSearchRunId = data.run?.id || data.link?.diagnosticRunId || null;
    ui.effectSearchRelayRunId = data.link?.relayRunId || null;
    ui.effectSearchQuoteReady = false;
    // Preserve the shared local cache for all three products. Views apply a
    // feature filter when reading it; replacing it with only realtime rows
    // would make a diagnostic/monitoring history temporarily disappear after
    // submitting a realtime search.
    const history = (Array.isArray(effectRelaySnapshot.history) ? effectRelaySnapshot.history : [])
      .filter((entry) => String(entry?.link?.diagnosticRunId) !== String(ui.effectSearchRunId));
    if (data.link?.diagnosticRunId) history.unshift({ link: data.link, run: data.run || null });
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null, history, links: history.map((entry) => entry.link), activeRun: data.run || null, activeLink: data.link || null, error: "", loaded: true };
    effectFlowStateFor("realtime").activeRun = data.run || null;
    effectFlowStateFor("realtime").activeLink = data.link || null;
    effectFlowStateFor("realtime").error = "";
    ui.effectSearchRecords = effectRelayRecordsFromRun(data.run, data.link);
    ui.effectSearchCompleted = false;
    if (ui.effectSearchRunId) await refreshEffectRelayRun({ runId: ui.effectSearchRunId, pull: true, renderAfter: false, flow: "realtime" });
    showToast("检测任务已提交", "灼见检测服务会持续获取任务结果；完成后将写入实时检测证据并显示在本页。", "success");
  } catch (error) {
    effectRelaySnapshot = { ...effectRelaySnapshot, error: error.message || "检测任务提交失败" };
    showToast("检测任务未提交", effectRelaySnapshot.error, "error");
  } finally {
    ui.effectSearchSubmitting = false;
    render();
  }
}

async function cancelEffectRelayRun(runId = ui.effectSearchRunId, flow = "realtime") {
  const submitting = flow === "diagnostic" ? ui.effectDiagnosticSubmitting : ui.effectSearchSubmitting;
  if (!runId || submitting) return;
  if (!await uiConfirm("确认取消该 AI 检测任务？尚未结算的积分会以系统最终结果为准。")) return;
  if (flow === "diagnostic") {
    ui.effectDiagnosticSubmitting = true;
    ui.effectDiagnosticRunId = runId;
  } else {
    ui.effectSearchSubmitting = true;
    ui.effectSearchRunId = runId;
  }
  render();
  try {
    await productionApi(`/api/v1/diagnostics/relay-runs/${encodeURIComponent(runId)}/cancel`, { method: "POST", body: {} });
    await refreshEffectRelayRun({ runId, pull: false, renderAfter: false, flow });
    showToast("检测任务已取消", "客户后台已记录取消状态；任务中心会保留该次真实任务记录。", "success");
  } catch (error) {
    showToast("取消任务失败", error.message || "请刷新后重试。", "error");
  } finally {
    if (flow === "diagnostic") ui.effectDiagnosticSubmitting = false;
    else ui.effectSearchSubmitting = false;
    render();
  }
}

function effectRelayStatusPanel({ flow = currentRoute() === "effect-diagnostic" ? "diagnostic" : currentRoute() === "effect-monitor" ? "monitoring" : "realtime", entry = null, quote = effectRelayQuoteFor(flow), scopes = ui.effectPlatformScopes, modes = ui.effectPlatformModes, questions = effectSearchDraftQuestions(), cancelAction = "effect-search-cancel", cancelRunId = "" } = {}) {
  const flowState = effectFlowStateFor(flow);
  const link = entry?.link || flowState.activeLink;
  const run = entry?.run || flowState.activeRun;
  const status = effectRelayRunStatus(link, run);
  const stats = effectRelayEntryStats({ link, run });
  const quota = effectRelaySnapshot.quota || {};
  const capabilityCount = effectRelayCapabilityItems().length;
  const unsupported = effectRelaySupportedItems(scopes, modes, questions).length === 0 && (scopes || []).length && (modes || []).length;
  const runId = cancelRunId || link?.diagnosticRunId || "";
  const canCancel = ["pending", "submitted", "queued", "running"].includes(status) && runId;
  const statusText = customerFacingEffectText(flowState.error || effectRelaySnapshot.error || (capabilityCount ? `当前可用 ${capabilityCount} 个检测能力项` : "正在读取检测能力与额度"));
  const stageState = effectRelayStageState(status, stats);
  const stages = ["配置", "排队", "分析", "校验", "完成"];
  const progressKey = runId || run?.id || `${flow}-draft`;
  const stageFlow = `<ol class="effect-run-stages ${stageState.tone}" data-effect-stage-flow data-effect-stage-key="${escapeHtml(String(progressKey))}" data-effect-stage-current="${stageState.current}" data-effect-stage-status="${escapeHtml(status)}" aria-label="检测过程">${stages.map((label, index) => {
    const complete = index < stageState.current || (stageState.tone === "complete" && index === stageState.current);
    const current = index === stageState.current;
    return `<li class="${complete ? "is-complete" : ""} ${current ? "is-current" : ""}" ${current ? 'aria-current="step"' : ""}><span>${complete ? icon("check") : index + 1}</span><b>${label}</b></li>`;
  }).join("")}</ol>`;
  const verifiedRatio = stats.requested ? Math.min(1, Math.max(0, stats.verified / stats.requested)) : 0;
  const progress = stats.requested
    ? `<div class="effect-run-progress" data-effect-progress data-effect-progress-key="${escapeHtml(String(progressKey))}" data-effect-progress-value="${verifiedRatio}" aria-label="检测结果校验进度"><div class="effect-run-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${stats.requested}" aria-valuenow="${stats.verified}" aria-valuetext="已校验 ${stats.verified} / ${stats.requested}"><i data-effect-progress-fill style="transform:scaleX(${verifiedRatio})"></i></div><small>已回传 ${stats.delivered} / ${stats.requested} · 已校验 ${stats.verified} / ${stats.requested}</small></div>`
    : "";
  const serviceIssue = Boolean(effectRelaySnapshot.error || flowState.error);
  const serviceLabel = serviceIssue ? "服务异常" : effectRelaySnapshot.loaded ? "已连接" : "连接中";
  return `<div class="effect-relay-status ${serviceIssue ? "is-error" : ""}"><span data-icon="server"></span><div><b>灼见 AI 检测服务 · ${escapeHtml(serviceLabel)}</b><small>${escapeHtml(statusText)}</small></div><em>${escapeHtml(effectRelayRunLabel(status))}</em>${stageFlow}${progress}${quota.availableCredits !== undefined ? `<span class="effect-relay-quota">可用 ${Number(quota.availableCredits).toLocaleString("zh-CN")} 积分</span>` : ""}${quote ? `<span class="effect-relay-quote">本次预计 ${Number(quote.estimatedCustomerCredits || 0).toLocaleString("zh-CN")} 积分</span>` : ""}${unsupported ? '<span class="effect-relay-warning">当前选择没有可执行能力项</span>' : ""}${canCancel ? `<button class="link-button" type="button" data-action="${escapeHtml(cancelAction)}" data-effect-run-id="${escapeHtml(runId)}">取消任务</button>` : ""}<button class="link-button" type="button" data-action="effect-relay-refresh">${icon("refresh")}刷新</button></div>`;
}

function effectPlatformCatalog() {
  return [
    { name: "豆包", code: "豆", color: "#1d9bea", rows: [{ device: "网页", modes: ["快速", "专家"] }, { device: "手机", badge: "电商", modes: ["快速", "专家"] }] },
    { name: "DeepSeek", code: "DS", color: "#5775ed", rows: [{ device: "网页", modes: ["快速", "深度"] }, { device: "手机", modes: ["快速", "深度"] }] },
    { name: "元宝", code: "元", color: "#13b878", rows: [{ device: "网页", badge: "电商", modes: ["快速", "深度"] }, { device: "手机", badge: "电商", modes: ["快速", "深度"] }] },
    { name: "千问", code: "千", color: "#4c68e9", rows: [{ device: "网页", modes: ["快速", "深度"] }, { device: "手机", badge: "电商", modes: ["快速", "深度"] }] },
    { name: "百度AI", code: "百", color: "#7a5ce4", rows: [{ device: "网页", modes: ["快速", "深度"] }] },
    { name: "文心一言", code: "文", color: "#378ee5", rows: [{ device: "网页", modes: ["快速", "深度"] }] },
    { name: "Kimi", code: "Km", color: "#15171c", rows: [{ device: "网页", modes: ["快速", "思考"] }] },
    { name: "AI抖音", code: "抖", color: "#111827", rows: [{ device: "网页", modes: ["快速", "深度"] }] },
    { name: "红书问一问", code: "书", color: "#f04d63", rows: [{ device: "手机", modes: ["快速"] }] }
  ];
}

function effectPlatformPicker(options = {}) {
  const catalog = effectPlatformCatalog();
  const selectedScopes = new Set(options.scopes || []);
  const activeModes = new Set(options.modes || ["快速"]);
  const availability = typeof options.availability === "function" ? options.availability : null;
  const scopeAttribute = options.scopeAttribute || "data-effect-platform-scope";
  const selectAllAttribute = options.selectAllAttribute || "data-effect-platform-select-all";
  const modeAttribute = options.modeAttribute || "data-effect-platform-mode";
  const allScopes = catalog.flatMap((platform) => platform.rows
    .filter((row) => !availability || row.modes.some((mode) => availability(platform.name, row.device, mode)))
    .map((row) => `${platform.name}|${row.device}`));
  const allSelected = allScopes.length > 0 && allScopes.every((scope) => selectedScopes.has(scope));
  const cards = catalog.map((platform) => {
    const selectedRows = platform.rows.filter((row) => selectedScopes.has(`${platform.name}|${row.device}`)).length;
    return `<article class="effect-platform-card ${selectedRows ? "selected" : ""}">
      <header class="effect-platform-card-head"><span class="effect-platform-logo" style="--platform:${platform.color}">${platform.code}</span><b>${platform.name}</b><small>${selectedRows}/${platform.rows.length}</small></header>
      <div class="effect-platform-card-body">${platform.rows.map((row) => {
        const scope = `${platform.name}|${row.device}`;
        const available = !availability || row.modes.some((mode) => availability(platform.name, row.device, mode));
        const checked = selectedScopes.has(scope) && available;
        return `<label class="effect-platform-row ${checked ? "checked" : ""} ${available ? "" : "unavailable"}"><span class="effect-platform-row-main"><input type="checkbox" value="${escapeHtml(scope)}" ${scopeAttribute} ${checked ? "checked" : ""} ${available ? "" : "disabled"} /><i class="effect-platform-check">${icon("check")}</i><b>${row.device}</b>${row.badge ? `<em>${row.badge}</em>` : ""}</span><span class="effect-platform-modes">${row.modes.map((mode) => `<span class="effect-platform-mode ${activeModes.has(mode) && (!availability || availability(platform.name, row.device, mode)) ? "active" : ""}">${mode}</span>`).join("")}</span></label>`;
      }).join("")}</div>
    </article>`;
  }).join("");
  const modeAvailable = (mode) => !availability || catalog.some((platform) => platform.rows.some((row) => availability(platform.name, row.device, mode)));
  const toolbar = `<div class="effect-platform-toolbar"><label><input type="checkbox" ${selectAllAttribute} ${allSelected ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>全选</b></label><label class="${modeAvailable("快速") ? "" : "unavailable"}"><input type="checkbox" value="快速" ${modeAttribute} ${activeModes.has("快速") ? "checked" : ""} ${modeAvailable("快速") ? "" : "disabled"} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>快速模式</b></label><label class="${modeAvailable("深度") ? "" : "unavailable"}"><input type="checkbox" value="深度" ${modeAttribute} ${activeModes.has("深度") ? "checked" : ""} ${modeAvailable("深度") ? "" : "disabled"} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>深度思考</b></label></div>`;
  return `<div class="effect-platform-picker"><div class="effect-platform-grid">${cards}</div>${options.hideToolbar ? "" : toolbar}</div>`;
}

function effectRelayCapabilityPicker(options = {}) {
  const items = effectRelayCapabilityItems();
  if (!effectRelaySnapshot.capabilities) return '<div class="effect-capability-empty">正在读取当前可用的 AI 检测能力…</div>';
  if (!items.length) return '<div class="effect-capability-empty">当前客户尚未配置 AI 检测能力，请联系灼见运营人员。</div>';
  const selectedScopes = new Set((options.scopes || ui.effectPlatformScopes || []).map(effectRelayNormalizeScope));
  const activeModes = new Set((options.modes || ui.effectPlatformModes || []).map(effectRelayModeCode));
  const scopeAttribute = options.scopeAttribute || "data-effect-platform-scope";
  const selectAllAttribute = options.selectAllAttribute || "data-effect-platform-select-all";
  const modeAttribute = options.modeAttribute || "data-effect-platform-mode";
  const realtimeLayout = options.realtimeLayout === true;
  const catalogOrder = ["DB", "DS", "YB", "QW", "BD", "WX", "KIMI", "DYAI", "RED"];
  const capabilitySnapshot = effectRelaySnapshot.capabilities?.provider?.capabilitySnapshot || {};
  const snapshotPlatforms = Array.isArray(capabilitySnapshot.platforms) ? capabilitySnapshot.platforms : [];
  const snapshotTrusted = !["development-capability-book", "demo", "mock"].includes(String(capabilitySnapshot.source || "").trim().toLowerCase());
  const platformCodes = [...new Set([...catalogOrder, ...snapshotPlatforms.map((entry) => String(entry?.code || "").trim()), ...items.map((entry) => String(entry?.platform || "").trim())].filter(Boolean))];
  const platforms = platformCodes.map((platform) => {
    const snapshot = snapshotTrusted ? snapshotPlatforms.find((entry) => String(entry?.code || "").trim() === platform) || {} : {};
    const declaredTerminals = Array.isArray(snapshot.terminals) ? snapshot.terminals.map(String) : [];
    const declaredModes = Array.isArray(snapshot.modes) ? snapshot.modes.map(String) : [];
    if (realtimeLayout && EFFECT_REALTIME_PLATFORM_LAYOUT[platform]) {
      return { platform, terminals: EFFECT_REALTIME_PLATFORM_LAYOUT[platform].map((row) => ({ ...row })) };
    }
    const terminalCodes = [...new Set([...declaredTerminals, ...items.filter((entry) => String(entry.platform) === platform).map((entry) => String(entry.terminal || "").trim())].filter(Boolean))];
    return { platform, terminals: terminalCodes.map((terminal) => ({
      terminal,
      modes: [...new Set([...declaredModes, ...items.filter((entry) => String(entry.platform) === platform && String(entry.terminal) === terminal).map((entry) => String(entry.mode || "").trim())].filter(Boolean))]
    })) };
  });
  for (const item of items) {
    const platform = String(item.platform || "").trim();
    const terminal = String(item.terminal || "").trim();
    const mode = String(item.mode || "").trim();
    if (!platform || !terminal || !mode) continue;
    if (realtimeLayout && EFFECT_REALTIME_PLATFORM_LAYOUT[platform]
      && !EFFECT_REALTIME_PLATFORM_LAYOUT[platform].some((row) => row.terminal === terminal)) continue;
    let group = platforms.find((entry) => entry.platform === platform);
    if (!group) { group = { platform, terminals: [] }; platforms.push(group); }
    let terminalGroup = group.terminals.find((entry) => entry.terminal === terminal);
    if (!terminalGroup) { terminalGroup = { terminal, modes: [] }; group.terminals.push(terminalGroup); }
    if (!terminalGroup.modes.includes(mode)) terminalGroup.modes.push(mode);
  }
  const scopeKeys = realtimeLayout ? effectRealtimeCapabilityScopeKeys() : effectRelayCapabilityScopeKeys();
  const allSelected = scopeKeys.length > 0 && scopeKeys.every((scope) => selectedScopes.has(scope));
  const modeKeys = [...new Set(items.map((item) => String(item.mode || "").trim()).filter(Boolean))];
  const quickModes = modeKeys.filter((mode) => mode === "fast");
  const advancedModes = modeKeys.filter((mode) => mode !== "fast");
  const cards = platforms.map((group) => {
    const selectedCount = group.terminals.filter((terminal) => selectedScopes.has(effectRelayScopeKey(group.platform, terminal.terminal))).length;
    const platformName = EFFECT_RELAY_PLATFORM_NAMES[group.platform] || group.platform;
    const platformUi = EFFECT_RELAY_PLATFORM_UI[group.platform] || { code: platformName.slice(0, 2), color: "#64748b" };
    const availableTerminals = group.terminals.filter((terminalGroup) => items.some((item) => String(item.platform) === group.platform && String(item.terminal) === terminalGroup.terminal));
    const selectionMeta = realtimeLayout ? "" : `<small>${availableTerminals.length ? `${selectedCount}/${availableTerminals.length}` : "暂未开通"}</small>`;
    return `<article class="effect-platform-card ${selectedCount ? "selected" : ""} ${availableTerminals.length ? "" : "unavailable"}"><header class="effect-platform-card-head"><span class="effect-platform-logo" style="--platform:${platformUi.color}">${escapeHtml(platformUi.code)}</span><b>${escapeHtml(platformName)}</b>${selectionMeta}</header><div class="effect-platform-card-body">${group.terminals.length ? group.terminals.map((terminalGroup) => {
      const scope = effectRelayScopeKey(group.platform, terminalGroup.terminal);
      const checked = selectedScopes.has(scope);
      const terminalName = EFFECT_RELAY_TERMINAL_NAMES[terminalGroup.terminal] || terminalGroup.terminal;
      const executableModes = terminalGroup.modes.filter((mode) => items.some((item) => String(item.platform) === group.platform && String(item.terminal) === terminalGroup.terminal && String(item.mode) === mode));
      const available = executableModes.length > 0;
      return `<label class="effect-platform-row ${checked ? "checked" : ""} ${available ? "" : "unavailable"}"><span class="effect-platform-row-main"><input type="checkbox" value="${escapeHtml(scope)}" ${scopeAttribute} ${checked ? "checked" : ""} ${available ? "" : "disabled"} /><i class="effect-platform-check">${icon("check")}</i><b>${escapeHtml(terminalName)}</b>${terminalGroup.badge ? `<em>${escapeHtml(terminalGroup.badge)}</em>` : ""}</span><span class="effect-platform-modes">${terminalGroup.modes.map((mode) => `<span class="effect-platform-mode ${activeModes.has(mode) && executableModes.includes(mode) ? "active" : ""} ${executableModes.includes(mode) ? "" : "unavailable"}">${escapeHtml(EFFECT_RELAY_MODE_NAMES[mode] || mode)}</span>`).join("")}</span></label>`;
    }).join("") : '<div class="effect-platform-pending">待开通</div>'}</div></article>`;
  }).join("");
  const groupedModes = scopeAttribute === "data-effect-platform-scope";
  const toolbar = groupedModes
    ? `<div class="effect-platform-toolbar"><label><input type="checkbox" ${selectAllAttribute} ${allSelected ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>全选</b></label>${quickModes.length ? `<label><input type="checkbox" value="fast" data-effect-platform-mode-family="quick" ${modeAttribute} ${quickModes.every((mode) => activeModes.has(mode)) ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>快速模式</b></label>` : ""}${advancedModes.length ? `<label><input type="checkbox" value="advanced" data-effect-platform-mode-family="advanced" ${modeAttribute} ${advancedModes.every((mode) => activeModes.has(mode)) ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>深度思考</b></label>` : ""}</div>`
    : `<div class="effect-platform-toolbar"><label><input type="checkbox" ${selectAllAttribute} ${allSelected ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>全选</b></label>${modeKeys.map((mode) => `<label><input type="checkbox" value="${escapeHtml(mode)}" ${modeAttribute} ${activeModes.has(mode) ? "checked" : ""} /><span class="effect-platform-toolbar-check">${icon("check")}</span><b>${escapeHtml(EFFECT_RELAY_MODE_NAMES[mode] || mode)}</b></label>`).join("")}</div>`;
  return `<div class="effect-platform-picker effect-capability-picker"><div class="effect-platform-grid">${cards}</div>${toolbar}</div>`;
}

function effectSearchPlatforms() {
  return effectRelayCapabilityPicker({ realtimeLayout: true });
}

function effectSearchBrandTerms(value) {
  return [...new Set(String(value || "").split(/[、,，;；\n]+/).map((item) => item.trim()).filter(Boolean))];
}

function effectSearchBrandProfile(value = ui.effectSearchBrand) {
  const aliases = effectSearchBrandTerms(value);
  return { name: aliases[0] || String(value || "").trim(), aliases };
}

function effectSearchRecordsForView() {
  return Array.isArray(ui.effectSearchRecords) ? ui.effectSearchRecords : [];
}

function effectSearchReportPlatformRows(records = []) {
  const groups = new Map();
  for (const record of records) {
    const platform = String(record.platform || "未知平台").trim();
    const terminal = String(record.terminal || "").trim();
    const key = `${platform}|${terminal}`;
    const group = groups.get(key) || { platform, terminal, total: 0, verified: 0, mentioned: 0, citations: 0 };
    group.total += 1;
    if (record.status === "verified") {
      group.verified += 1;
      if (Number(record.brandMentionCount || 0) > 0) group.mentioned += 1;
      group.citations += Array.isArray(record.citationSources) ? record.citationSources.length : 0;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((item) => ({ ...item, mentionRate: item.verified ? Math.round((item.mentioned / item.verified) * 100) : 0 }))
    .sort((left, right) => right.verified - left.verified || left.platform.localeCompare(right.platform, "zh-CN"));
}

function effectSearchReportCitationRows(records = []) {
  const groups = new Map();
  for (const record of records.filter((item) => item.status === "verified")) {
    for (const source of Array.isArray(record.citationSources) ? record.citationSources : []) {
      const title = String(source.title || source.domain || source.url || "未命名来源").trim();
      const domain = String(source.domain || "").trim();
      const key = String(domain || source.url || title).toLocaleLowerCase("zh-CN");
      const group = groups.get(key) || { title, domain, count: 0, platforms: new Set() };
      group.count += 1;
      if (record.platform) group.platforms.add(record.platform);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, "zh-CN"))
    .map((item) => ({ ...item, platforms: [...item.platforms] }));
}

function effectSearchReportAnalysis({ brandName = "", requested = 0, records = [], verified = [], mentioned = [], citations = 0, platforms = [], citationRows = [] } = {}) {
  const coverageBase = requested || records.length;
  const coverage = coverageBase ? Math.round((verified.length / coverageBase) * 100) : 0;
  const mentionRate = verified.length ? Math.round((mentioned.length / verified.length) * 100) : 0;
  const rankedRecords = verified.filter((record) => Number.isFinite(record.firstMentionRank) && record.firstMentionRank > 0);
  const averageRank = rankedRecords.length
    ? (rankedRecords.reduce((sum, record) => sum + record.firstMentionRank, 0) / rankedRecords.length).toFixed(1)
    : "";
  const sentimentCounts = verified.reduce((result, record) => {
    const sentiment = String(record.sentiment || "").toLowerCase();
    if (sentiment.includes("正") || sentiment.includes("positive")) result.positive += 1;
    else if (sentiment.includes("负") || sentiment.includes("negative")) result.negative += 1;
    else if (sentiment) result.neutral += 1;
    return result;
  }, { positive: 0, neutral: 0, negative: 0 });
  const platformWithMentions = platforms.filter((item) => item.mentioned > 0);
  const platformWithoutMentions = platforms.filter((item) => item.verified > 0 && item.mentioned === 0);
  const topPlatform = platforms.slice().sort((left, right) => right.mentionRate - left.mentionRate || right.verified - left.verified)[0];
  const platformText = platforms.length
    ? `本次共覆盖 ${platforms.length} 个平台终端。${topPlatform ? `按已验证结果看，${topPlatform.platform}${topPlatform.terminal ? `（${topPlatform.terminal}）` : ""}的品牌提及率最高，为 ${topPlatform.mentionRate}%。` : ""}${platformWithoutMentions.length ? `${platformWithoutMentions.length} 个平台终端暂未出现品牌提及，需结合平台内容和引用来源进一步优化。` : ""}`
    : "本次没有形成可比较的平台表现数据。";
  const visibilityText = brandName
    ? mentioned.length
      ? `${brandName}在 ${mentioned.length} 条已验证结果中被提及，品牌提及率为 ${mentionRate}%。${averageRank ? `其中 ${rankedRecords.length} 条结果返回了品牌出现位置，平均首次出现位置为第 ${averageRank} 位。` : "本轮没有返回可验证的品牌出现位置。"}`
      : `本轮 ${verified.length} 条已验证结果中暂未检测到${brandName}的明确提及，当前品牌在这组用户问题中的可见性不足。`
    : "本次未设置品牌名称，无法计算品牌提及率；报告仅分析平台覆盖和引用表现。";
  const citationText = citations
    ? `检测结果共识别 ${citations} 次有效回答引用，归并为 ${citationRows.length} 个主要来源。引用来源可作为后续建设官网页面、案例、FAQ 和行业内容的优先参考。`
    : "本轮没有识别到可验证的回答引用，暂时无法判断哪些公开内容正在影响 AI 回答。";
  const qualityText = coverage < 100
    ? `本次任务有效证据覆盖率为 ${coverage}%，其余任务项仍在处理、失败或未通过校验，当前结论只基于 ${verified.length} 条有效样本。`
    : `本次 ${verified.length} 条任务结果均已通过校验，报告结论基于完整回传数据生成。`;
  const sentimentText = sentimentCounts.positive || sentimentCounts.neutral || sentimentCounts.negative
    ? `已返回情感字段的样本中，正向 ${sentimentCounts.positive} 条、中性 ${sentimentCounts.neutral} 条、负向 ${sentimentCounts.negative} 条；未返回情感字段的样本不纳入判断。`
    : "本轮结果没有返回可验证的情感字段，因此不对舆情倾向做推测。";
  const recommendations = [];
  if (brandName && !mentioned.length) recommendations.push(`补充${brandName}的企业主体、产品能力、适用场景和客户案例等公开信源，让 AI 能够确认品牌实体与业务关系。`);
  else if (brandName && mentionRate < 50) recommendations.push(`围绕未提及品牌的平台和问题场景补充直接回答内容，提高${brandName}在决策型问题中的可见性。`);
  if (!citations) recommendations.push("建立可抓取、可引用的官网服务页、案例页和 FAQ 页面，并确保页面包含清晰的主体、产品、场景与证据信息。");
  else if (citationRows.length) recommendations.push(`优先复盘排名靠前的 ${Math.min(citationRows.length, 3)} 个引用来源，将其中稳定出现的主题沉淀为官网和内容资产。`);
  if (platformWithoutMentions.length) recommendations.push(`针对 ${platformWithoutMentions.slice(0, 3).map((item) => `${item.platform}${item.terminal ? `（${item.terminal}）` : ""}`).join("、")} 单独补充平台适配内容，并在下一轮检测中复测。`);
  if (coverage < 100) recommendations.push("等待未完成任务回传后再做最终判断，避免将部分样本当成完整结论。");
  if (!recommendations.length) recommendations.push("保持当前信源和内容结构，使用相同问题集定期复测提及率、引用来源和品牌出现位置的变化。");
  return {
    overview: qualityText,
    visibility: visibilityText,
    platform: platformText,
    citation: citationText,
    sentiment: sentimentText,
    recommendations
  };
}

function effectSearchGeneratedReportBody(report) {
  const source = report?.report || report || {};
  const sections = Array.isArray(source.sections) ? source.sections : [];
  const analysisSections = sections.filter((section) => [
    "scope", "brand_visibility", "answer_insights", "platform_comparison", "citation_analysis", "content_gaps", "action_roadmap"
  ].includes(String(section?.key || "")));
  const sectionHtml = analysisSections.map((section, index) => {
    const content = section.content && typeof section.content === "object" ? section.content : {};
    const findings = Array.isArray(content.findings) ? content.findings : [];
    const findingHtml = findings.slice(0, 8).map((finding) => `<li><b>${escapeHtml(finding.title || "数据发现")}</b><p>${escapeHtml(finding.analysis || "")}</p><small>${Array.isArray(finding.evidenceIds) ? `基于 ${finding.evidenceIds.length} 条已验证证据` : "基于已验证证据"}</small></li>`).join("");
    return `<section class="effect-search-generated-section"><header><span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(section.title || "数据分析")}</b><small>${escapeHtml(content.summary || "")}</small></div></header>${findingHtml ? `<ul>${findingHtml}</ul>` : ""}</section>`;
  }).join("");
  const recommendationsSection = sections.find((section) => section?.key === "analysis_recommendations");
  const recommendations = Array.isArray(recommendationsSection?.content?.items)
    ? recommendationsSection.content.items
    : Array.isArray(source.recommendations) ? source.recommendations : [];
  const recommendationsHtml = recommendations.slice(0, 12).map((item) => `<li><span class="effect-search-recommendation-priority ${escapeHtml(item.priority || "medium")}">${escapeHtml(item.priority || "medium")}</span><div><b>${escapeHtml(item.title || "优化动作")}</b><p>${escapeHtml(item.action || item.rationale || "")}</p><small>${escapeHtml(item.expectedOutcome || "复测同一问题集后观察指标变化")}</small></div></li>`).join("");
  if (!analysisSections.length && !recommendationsHtml) return "";
  return `<section class="effect-search-analysis-report effect-search-generated-report"><header><div><h4>本次检测深度分析报告</h4><p>服务端模型仅基于本次已验证的实时检测证据生成。</p></div><span>${icon("file")}已生成</span></header><div class="effect-search-generated-summary"><b>管理层摘要</b><p>${escapeHtml(source.executiveSummary || "报告已生成，但服务端未返回管理层摘要。")}</p></div><div class="effect-search-generated-sections">${sectionHtml}</div>${recommendationsHtml ? `<section class="effect-search-generated-recommendations"><header><b>分级优化行动</b><small>每项动作都来自本次检测证据</small></header><ul>${recommendationsHtml}</ul></section>` : ""}${Array.isArray(source.limitations) && source.limitations.length ? `<footer>${icon("info")}数据边界：${escapeHtml(source.limitations.slice(0, 4).join("；"))}</footer>` : ""}</section>`;
}

function effectSearchResultsPanel({ flow = currentRoute() === "effect-diagnostic" ? "diagnostic" : currentRoute() === "effect-monitor" ? "monitoring" : "realtime", records = effectSearchRecordsForView(), entry = effectRelayHistoryEntry(undefined, flow), title = "当前任务交付" } = {}) {
  const link = entry?.link || effectRelaySnapshot.activeLink;
  const run = entry?.run || effectRelaySnapshot.activeRun;
  const status = effectRelayRunStatus(link, run);
  const requested = link?.request?.items?.length || 0;
  const verified = records.filter((record) => record.status === "verified");
  const mentioned = verified.filter((record) => record.brandMentionCount > 0);
  const citations = verified.reduce((sum, record) => sum + (record.citationSources?.length || 0), 0);
  const platformRows = effectSearchReportPlatformRows(records);
  const citationRows = effectSearchReportCitationRows(records);
  const coverageBase = requested || records.length;
  const coverage = coverageBase ? Math.round((verified.length / coverageBase) * 100) : 0;
  const mentionRate = verified.length ? Math.round((mentioned.length / verified.length) * 100) : 0;
  const brandName = String(link?.request?.brand?.name || "").trim();
  const running = ["pending", "submitted", "queued", "running"].includes(status) || ui.effectSearchSubmitting;
  const summary = records.length
    ? "报告由已回传并通过校验的检测数据自动汇总，原始问题与回答不在客户端逐条展示。"
    : running
      ? "任务已提交；页面会在结果完成校验并入库后自动更新。"
      : effectFlowStateFor(flow).error || effectRelaySnapshot.error
        ? "AI 检测服务当前不可用；页面不会用本地样本替代结果。"
        : "完成一次查询后，系统将在这里生成检测报告总结。";
  const analysis = effectSearchReportAnalysis({ brandName, requested, records, verified, mentioned, citations, platforms: platformRows, citationRows });
  const platformHtml = platformRows.length
    ? platformRows.map((item) => `<li><div><b>${escapeHtml(item.platform)}${item.terminal ? ` · ${escapeHtml(item.terminal)}` : ""}</b><small>${item.verified} / ${item.total} 条结果已验证</small></div><span><b>${item.mentioned}</b><small>品牌提及</small></span><span><b>${item.citations}</b><small>有效引用</small></span></li>`).join("")
    : '<div class="effect-search-report-placeholder">暂无平台汇总数据</div>';
  const citationHtml = citationRows.length
    ? citationRows.slice(0, 8).map((item) => `<li><span>${icon("link")}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.domain || `${item.platforms.length} 个平台引用`)}</small></div><em>${item.count} 次</em></li>`).join("")
    : '<div class="effect-search-report-placeholder">本轮暂无可验证的引用来源</div>';
  const analysisSections = [
    ["01", "检测概览", analysis.overview],
    ["02", "品牌可见性分析", analysis.visibility],
    ["03", "平台表现分析", analysis.platform],
    ["04", "引用来源分析", analysis.citation],
    ["05", "结果质量与边界", analysis.sentiment]
  ].map(([number, heading, text]) => `<section class="effect-search-analysis-section"><header><span>${number}</span><b>${heading}</b></header><p>${escapeHtml(text)}</p></section>`).join("");
  const recommendationsHtml = analysis.recommendations.map((item) => `<li>${icon("arrow")}<span>${escapeHtml(item)}</span></li>`).join("");
  const reportDetails = `<div class="effect-search-report-details"><section><header><div><b>平台表现汇总</b><small>仅按平台聚合，不展示单条问题与回答</small></div></header><ul class="effect-search-report-platforms">${platformHtml}</ul></section><section><header><div><b>主要引用来源</b><small>按有效引用出现次数排序</small></div></header><ul class="effect-search-report-citations">${citationHtml}</ul></section></div>`;
  const generatedReportBody = flow === "realtime" ? effectSearchGeneratedReportBody(ui.effectSearchReport) : "";
  const reportBody = generatedReportBody
    ? `<div class="effect-search-report-body">${generatedReportBody}${reportDetails}<footer>${icon("shield")}原始回答和追溯证据已安全归档，需要核验时由系统后台查询。</footer></div>`
    : records.length
      ? `<div class="effect-search-report-body"><section class="effect-search-analysis-report"><header><div><h4>本次检测分析报告</h4><p>基于已回传的检测结果、品牌字段、平台信息和引用来源自动生成。</p></div><span>${icon("file")}规则分析</span></header><div class="effect-search-analysis-sections">${analysisSections}</div><section class="effect-search-analysis-recommendations"><header><b>优化建议</b><small>建议均基于本次检测中已验证的数据</small></header><ul>${recommendationsHtml}</ul></section></section>${reportDetails}<footer>${icon("shield")}原始回答和追溯证据已安全归档，需要核验时由系统后台查询。</footer></div>`
    : `<div class="effect-search-report-empty">${icon(running ? "clock" : "file")}<b>${running ? "正在生成检测报告" : "暂无检测报告"}</b><p>${escapeHtml(summary)}</p></div>`;
  const canGenerateDetailedReport = flow === "realtime" && verified.length && ["completed", "partial"].includes(status);
  const reportAction = canGenerateDetailedReport && !generatedReportBody
    ? `<button class="secondary-button button-small" type="button" data-action="effect-search-generate-report" ${ui.effectSearchReportLoading || !selectedTextProviderId() ? "disabled" : ""}>${ui.effectSearchReportLoading ? "正在生成分析…" : "生成详细分析报告"}</button>`
    : "";
  const reportError = flow === "realtime" && ui.effectSearchReportError ? `<small class="effect-search-report-error">${escapeHtml(ui.effectSearchReportError)}</small>` : "";
  return `<section class="card effect-search-results effect-search-report"><header><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(summary)}</p>${reportError}</div><div class="effect-search-report-header-actions">${reportAction}<span class="status-badge ${verified.length && ["completed", "partial"].includes(status) ? "status-approved" : running ? "status-pending" : "status-draft"}">${escapeHtml(effectRelayRunLabel(status))}</span></div></header><div class="effect-search-summary"><div><small>有效证据覆盖率</small><b>${coverageBase ? `${coverage}%` : "—"}</b><em>${verified.length} / ${coverageBase || 0} 条已验证</em></div><div><small>覆盖平台终端</small><b>${platformRows.length || "—"}</b><em>根据回传数据自动归并</em></div><div><small>品牌提及率</small><b>${verified.length && brandName ? `${mentionRate}%` : "—"}</b><em>${brandName ? `${mentioned.length} 条有效结果提及` : "本次未设置品牌"}</em></div><div><small>有效回答引用</small><b>${citations}</b><em>${citationRows.length} 个主要来源</em></div></div>${reportBody}</section>`;
}

function effectCenterTabs(active = ui.effectCenterView) {
  const tabs = [
    ["create", "新建检测", "冻结问题集并提交 AI 检测任务"],
    ["tasks", "任务中心", "查看真实任务状态与交付进度"],
    ["results", "结果与趋势", "仅汇总已写入的 live evidence"]
  ];
  return `<nav class="effect-center-tabs" aria-label="AI 效果检测功能">${tabs.map(([view, title, note]) => `<a href="#effect-search?view=${view}" class="${active === view ? "active" : ""}"><b>${title}</b><small>${note}</small></a>`).join("")}</nav>`;
}

function effectRelayEntryQuestions(entry) {
  return [...new Set((entry?.link?.request?.items || []).map((item) => String(item.prompt || "").trim()).filter(Boolean))];
}

function effectRelayEntryTitle(entry) {
  const brand = entry?.link?.request?.brand?.name || entry?.run?.inputSnapshot?.project?.targetBrand || "未命名品牌";
  const question = effectRelayEntryQuestions(entry)[0] || "冻结问题集";
  return `${brand} · ${question}`;
}

function effectRelayEntryStats(entry) {
  const requested = Number(entry?.link?.request?.items?.length || 0);
  const records = effectRelayRecordsFromRun(entry?.run, entry?.link);
  const verified = records.filter((record) => record.status === "verified").length;
  return { requested, delivered: records.length, verified, records };
}

function effectCenterTaskRow(entry) {
  const { requested, delivered, verified } = effectRelayEntryStats(entry);
  const status = effectRelayRunStatus(entry.link, entry.run);
  const canCancel = ["pending", "submitted", "queued", "running"].includes(status);
  const questions = effectRelayEntryQuestions(entry);
  const remoteSummary = entry.link?.remoteRun?.summary || entry.link?.remoteRun || {};
  const billing = remoteSummary.billingStatus || "待系统结算";
  const error = entry.link?.errorMessage || entry.run?.errorMessage || "";
  return `<article class="effect-task-row"><div class="effect-task-name"><b>${escapeHtml(effectRelayEntryTitle(entry))}</b><small>${questions.length} 个冻结问题 · ${requested} 个独立检测项 · ${escapeHtml(String(entry.link.createdAt || "").replace("T", " ").slice(0, 16) || "—")}</small>${error ? `<em>${escapeHtml(customerFacingEffectText(error))}</em>` : ""}</div><div><small>状态</small><span class="status-badge ${["completed", "partial"].includes(status) ? "status-approved" : ["failed", "attention", "cancelled"].includes(status) ? "status-error" : "status-pending"}">${escapeHtml(effectRelayRunLabel(status))}</span></div><div><small>结果 / 验证</small><b>${delivered} / ${requested || "—"}</b><em>${verified} 条已验证</em></div><div><small>结算</small><b>${escapeHtml(String(billing))}</b><em>${entry.link.relayRunId ? "已关联检测任务" : "等待系统确认"}</em></div><div class="effect-task-actions"><button class="link-button" type="button" data-action="effect-center-open-run" data-effect-run-id="${escapeHtml(entry.link.diagnosticRunId)}">查看结果</button>${canCancel ? `<button class="link-button danger" type="button" data-action="effect-center-cancel-run" data-effect-run-id="${escapeHtml(entry.link.diagnosticRunId)}">取消</button>` : ""}</div></article>`;
}
