
function renderEffectTaskCenter() {
  const entries = effectRelayHistoryEntries();
  const running = entries.filter((entry) => ["pending", "submitted", "queued", "running"].includes(effectRelayRunStatus(entry.link, entry.run))).length;
  const delivered = entries.reduce((total, entry) => total + effectRelayEntryStats(entry).delivered, 0);
  return `<section class="card effect-task-center"><header><div><h3>任务中心</h3><p>集中查看灼见 AI 检测任务状态、结果进度和已验证证据。</p></div><button class="secondary-button" type="button" data-action="effect-relay-refresh">${icon("refresh")}刷新任务</button></header><div class="effect-task-summary"><div><small>历史任务</small><b>${entries.length}</b><em>当前客户实例内</em></div><div><small>进行中</small><b>${running}</b><em>由系统异步执行</em></div><div><small>已入库结果</small><b>${delivered}</b><em>仅统计已同步记录</em></div></div>${effectRelaySnapshot.historyError ? `<div class="effect-center-notice warning">${icon("alert")} ${escapeHtml(customerFacingEffectText(effectRelaySnapshot.historyError))}</div>` : ""}<div class="effect-task-table">${entries.length ? entries.map(effectCenterTaskRow).join("") : `<div class="effect-search-empty">${effectRelaySnapshot.historyLoaded ? "暂无真实检测任务。请先在“新建检测”中提交冻结问题集。" : "正在读取该客户实例的任务历史…"}</div>`}</div></section>`;
}

function effectCenterRecordsForResultView() {
  const range = Math.max(1, Number(ui.effectCenterResultRange || 90));
  const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
  return effectRelayHistoryRecords().filter((record) => {
    if (ui.effectCenterResultRunId !== "all" && record.diagnosticRunId !== ui.effectCenterResultRunId) return false;
    if (ui.effectCenterResultPlatform !== "all" && record.platform !== ui.effectCenterResultPlatform) return false;
    if (ui.effectCenterResultQuestion !== "all" && record.questionId !== ui.effectCenterResultQuestion) return false;
    const observed = Date.parse(record.observedAt || "");
    return !Number.isFinite(observed) || observed >= cutoff;
  }).sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")));
}

function effectCenterTrendRows(records) {
  const groups = new Map();
  for (const record of records.filter((item) => item.status === "verified")) {
    const key = [record.questionId || record.question, record.platform, record.terminal, record.mode].join("|");
    const list = groups.get(key) || [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups.values()].filter((samples) => samples.length >= 2).map((samples) => {
    const ordered = samples.slice().sort((left, right) => String(left.observedAt || "").localeCompare(String(right.observedAt || "")));
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    return { first, latest, samples: ordered.length };
  }).sort((left, right) => right.samples - left.samples);
}

function renderEffectResultsCenter() {
  const allRecords = effectRelayHistoryRecords();
  const records = effectCenterRecordsForResultView();
  const entries = effectRelayHistoryEntries();
  const platforms = [...new Set(allRecords.map((record) => record.platform).filter(Boolean))];
  const questions = [...new Map(allRecords.map((record) => [record.questionId || record.question, record.question])).entries()];
  const trends = effectCenterTrendRows(records);
  const filters = `<div class="effect-center-filters"><label>任务<select data-effect-center-filter="run"><option value="all">全部任务</option>${entries.map((entry) => `<option value="${escapeHtml(entry.link.diagnosticRunId)}" ${ui.effectCenterResultRunId === entry.link.diagnosticRunId ? "selected" : ""}>${escapeHtml(effectRelayEntryTitle(entry).slice(0, 42))}</option>`).join("")}</select></label><label>平台<select data-effect-center-filter="platform"><option value="all">全部平台</option>${platforms.map((platform) => `<option value="${escapeHtml(platform)}" ${ui.effectCenterResultPlatform === platform ? "selected" : ""}>${escapeHtml(platform)}</option>`).join("")}</select></label><label>问题<select data-effect-center-filter="question"><option value="all">全部问题</option>${questions.map(([id, text]) => `<option value="${escapeHtml(id)}" ${ui.effectCenterResultQuestion === id ? "selected" : ""}>${escapeHtml(String(text).slice(0, 36))}</option>`).join("")}</select></label><label>时间<select data-effect-center-filter="range"><option value="7" ${ui.effectCenterResultRange === "7" ? "selected" : ""}>近 7 天</option><option value="30" ${ui.effectCenterResultRange === "30" ? "selected" : ""}>近 30 天</option><option value="90" ${ui.effectCenterResultRange === "90" ? "selected" : ""}>近 90 天</option></select></label></div>`;
  const trendHtml = trends.length ? `<div class="effect-trend-list">${trends.map(({ first, latest, samples }) => `<article><div><b>${escapeHtml(latest.platform)} · ${escapeHtml(latest.terminal)} · ${escapeHtml(latest.mode)}</b><small>${escapeHtml(latest.question)}</small></div><span><small>真实样本</small><b>${samples}</b></span><span><small>最早采样</small><b>${escapeHtml(String(first.observedAt || "").replace("T", " ").slice(0, 16))}</b></span><span><small>最近采样</small><b>${escapeHtml(String(latest.observedAt || "").replace("T", " ").slice(0, 16))}</b></span></article>`).join("")}</div>` : '<div class="effect-search-empty">暂无可计算的真实趋势。趋势需要同一问题、同一平台、同一终端与模式至少两条已验证的 live evidence；系统不会用模拟 KPI 补齐。</div>';
  return `<section class="card effect-results-center"><header><div><h3>结果与趋势</h3><p>仅展示已经校验并写入实时检测证据库的真实结果，当前趋势来自历史检测任务。</p></div><button class="secondary-button" type="button" data-action="effect-relay-refresh">${icon("refresh")}刷新证据</button></header>${filters}<div class="effect-center-trend-card"><div><b>真实历史样本趋势</b><small>不把单次回答内提及顺序称为“平台排名”；只展示可追溯采样时间。</small></div>${trendHtml}</div></section>${effectSearchResultsPanel({ records, title: "已落库的检测结果" })}`;
}

function renderEffectCreateCenter() {
  const questions = effectSearchDraftQuestions();
  const supportedItems = effectRelaySupportedItems(ui.effectPlatformScopes, ui.effectPlatformModes, questions);
  const quote = effectRelaySnapshot.quote;
  const activeStatus = effectRelayRunStatus();
  const running = ["pending", "submitted", "queued", "running"].includes(activeStatus) || ui.effectSearchSubmitting;
  const canQuote = Boolean(questions.length && ui.effectSearchBrand.trim() && ui.effectSearchExternalConsent && supportedItems.length);
  const primaryAction = quote && ui.effectSearchQuoteReady
    ? `<button class="primary-button" type="button" data-action="effect-search-submit" ${ui.effectSearchSubmitting || !supportedItems.length ? "disabled" : ""}>${ui.effectSearchSubmitting ? '<span class="loading-spinner"></span>正在提交…' : `${icon("send")}确认并提交`}</button>`
    : `<button class="primary-button" type="button" data-action="effect-search-quote" ${ui.effectSearchSubmitting || !canQuote ? "disabled" : ""}>${ui.effectSearchSubmitting ? '<span class="loading-spinner"></span>正在获取报价…' : `${icon("search")}获取检测报价`}</button>`;
  const quoteSummary = quote && ui.effectSearchQuoteReady
    ? `<div class="effect-search-quote-summary"><span data-icon="quote"></span><div><b>本次检测预计：${Number(quote.estimatedCustomerCredits || 0).toLocaleString("zh-CN")} 积分</b><small>将提交 ${supportedItems.length} 个独立检测项；提交时会再次校验价格与额度。</small></div><button class="link-button" type="button" data-action="effect-search-quote-reset">重新报价</button></div>`
    : "";
  const entry = effectRelayHistoryEntry();
  return `<div class="effect-demo-layout"><main class="effect-demo-main"><section class="card effect-demo-query"><header><div><h3>新建一次 AI 效果检测</h3><p>每个“问题 × 平台 × 终端 × 模式”会成为独立检测项；报价后冻结问题集并由灼见检测服务执行。</p></div><span class="status-badge ${running ? "status-pending" : "status-approved"}">${escapeHtml(running ? effectRelayRunLabel(activeStatus) : "等待配置")}</span></header><div class="effect-demo-form"><label class="effect-demo-input full"><span>${icon("eye")}检测问题集（每行一个） <em>*</em></span><textarea id="effect-search-question" rows="5" placeholder="如：工业机器人品牌推荐？&#10;如：工业机器人集成商如何选择？">${escapeHtml(ui.effectSearchQuestion)}</textarea><small class="effect-input-hint">提交后问题集会冻结；本次最多 20 个去重问题。</small></label><label class="effect-demo-input"><span>${icon("users")}品牌与别名（逗号分隔） <em>*</em></span><input id="effect-search-brand" value="${escapeHtml(ui.effectSearchBrand)}" placeholder="如：桐灼科技、桐灼 GEO" /></label><label class="effect-demo-input"><span>${icon("layers")}行业 / 场景</span><input id="effect-search-industry" value="${escapeHtml(ui.effectSearchIndustry || "")}" placeholder="如：工业机器人" /></label><div class="effect-demo-field full"><div class="effect-platform-heading"><b>可用检测能力</b><small>平台、终端与模式由当前客户的服务配置决定。</small></div>${effectSearchPlatforms()}</div><div class="effect-demo-controls"><span class="effect-search-scope-summary"><b>${supportedItems.length}</b> 个独立检测项<br /><small>${questions.length} 个问题 × 已选能力组合</small></span><span class="effect-demo-credit">${effectRelaySnapshot.quota?.availableCredits !== undefined ? `可用 ${Number(effectRelaySnapshot.quota.availableCredits).toLocaleString("zh-CN")} 积分` : "等待读取客户额度"} · 访问凭据由系统安全管理</span><label class="effect-search-consent"><input type="checkbox" data-effect-search-consent ${ui.effectSearchExternalConsent ? "checked" : ""} /><span>我确认将本次问题集、品牌别名和已选范围提交给灼见 AI 检测服务执行</span></label>${quoteSummary}${primaryAction}</div></div></section>${effectSearchResultsPanel({ entry, title: entry ? "当前选中任务的结果" : "当前任务结果" })}</main></div>`;
}

function effectAlignedTenantName() {
  return String(state.enterpriseProfile?.brandName || state.tenant || state.workspace?.name || "当前企业").trim() || "当前企业";
}

function effectAlignedDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).replaceAll("/", "-");
}

function effectAlignedPageHead({ eyebrow, title, accent, description }) {
  const state = effectRelaySnapshot.error ? "error" : effectRelaySnapshot.loaded ? "ok" : "loading";
  const serviceState = state === "error" ? "服务需检查" : state === "ok" ? "检测服务在线" : "正在连接";
  return `<header class="effect-aligned-head"><div><span class="effect-aligned-eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}${accent ? ` · <em>${escapeHtml(accent)}</em>` : ""}</h2><p>${escapeHtml(description)}</p></div><div class="effect-aligned-head-meta"><span class="effect-head-status" data-state="${state}"><i class="effect-head-status-dot"></i>${escapeHtml(serviceState)}</span><div><span><small>UTC+8</small><b>${escapeHtml(effectAlignedDateTime())}</b></span><span><small>租户</small><b>${escapeHtml(effectAlignedTenantName())}</b></span></div></div></header>`;
}

function effectAlignedEmpty(title, description = "未返回的字段不会使用演示数据补齐。", options = {}) {
  const { iconName = "file", action = "", actionLabel = "" } = options;
  const cta = action && actionLabel ? `<button class="secondary-button button-small" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>` : "";
  return `<div class="effect-aligned-empty"><span class="effect-empty-mark">${icon(iconName)}</span><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small>${cta}</div>`;
}

function effectAlignedKpi({ label, value = "—", delta = "", description, foot, action = "", iconName = "chart", tone = "" }) {
  const empty = value === "—" || value === 0;
  const numericDelta = Number(String(delta).replace(/[^\d.-]/g, ""));
  const hasDelta = delta !== "" && Number.isFinite(numericDelta);
  const deltaClass = hasDelta ? (numericDelta > 0 ? "is-up" : numericDelta < 0 ? "is-down" : "is-flat") : "";
  const deltaIcon = hasDelta ? (numericDelta > 0 ? "↑" : numericDelta < 0 ? "↓" : "→") : "";
  const deltaHtml = hasDelta ? `<em class="effect-kpi-delta ${deltaClass}">${deltaIcon} ${escapeHtml(String(delta))}</em>` : "";
  return `<article class="effect-aligned-kpi ${escapeHtml(tone)}${empty ? " is-empty" : ""}" data-tone="${escapeHtml(tone.replace(/^tone-/, ""))}"><header><span>${escapeHtml(label)}</span><i>${icon(iconName)}</i></header><strong class="effect-aligned-kpi-value"><span class="effect-aligned-kpi-number">${escapeHtml(String(value))}</span>${deltaHtml}</strong><p>${escapeHtml(description)}</p><footer><span>${escapeHtml(foot)}</span>${action ? `<b>${escapeHtml(action)}</b>` : ""}</footer></article>`;
}

function effectAlignedCapabilityChips({
  scopes = [],
  modes = [],
  scopeAttribute = "data-effect-platform-scope",
  modeAttribute = "data-effect-platform-mode",
  label = "检索平台："
} = {}) {
  const capabilities = effectRelayCapabilityItems();
  if (!effectRelaySnapshot.capabilities) return `<div class="effect-aligned-platform-row"><span class="effect-aligned-platform-label">${escapeHtml(label)}</span><small>${effectRelaySnapshot.error ? "平台能力暂不可用，请先检查检测服务" : "正在读取可用平台…"}</small></div>`;
  if (!capabilities.length) return `<div class="effect-aligned-platform-row"><span class="effect-aligned-platform-label">${escapeHtml(label)}</span><small>当前企业尚未配置 AI 检测平台。</small></div>`;
  const selectedScopes = new Set((scopes || []).map(effectRelayNormalizeScope));
  const selectedModes = new Set((modes || []).map(effectRelayModeCode));
  const scopeRows = [];
  const seenScopes = new Set();
  const platformTerminals = new Map();
  for (const item of capabilities) {
    const platform = String(item.platform || "").trim();
    const terminal = String(item.terminal || "").trim();
    if (!platform || !terminal) continue;
    const terminals = platformTerminals.get(platform) || new Set();
    terminals.add(terminal);
    platformTerminals.set(platform, terminals);
  }
  for (const item of capabilities) {
    const platform = String(item.platform || "").trim();
    const terminal = String(item.terminal || "").trim();
    const scope = effectRelayScopeKey(platform, terminal);
    if (!platform || !terminal || seenScopes.has(scope)) continue;
    seenScopes.add(scope);
    const platformName = EFFECT_RELAY_PLATFORM_NAMES[platform] || platform;
    const terminalName = EFFECT_RELAY_TERMINAL_NAMES[terminal] || terminal;
    const hasMultipleTerminals = (platformTerminals.get(platform)?.size || 0) > 1;
    scopeRows.push({ scope, label: hasMultipleTerminals ? `${platformName} · ${terminalName}` : platformName });
  }
  const modeKeys = [...new Set(capabilities.map((item) => String(item.mode || "").trim()).filter(Boolean))];
  const chipHtml = scopeRows.map((row) => `<label class="effect-aligned-platform-chip ${selectedScopes.has(row.scope) ? "active" : ""}"><input type="checkbox" value="${escapeHtml(row.scope)}" ${scopeAttribute} ${selectedScopes.has(row.scope) ? "checked" : ""} /><i></i><span>${escapeHtml(row.label)}</span></label>`).join("");
  const modeHtml = modeKeys.length > 1 ? `<span class="effect-aligned-platform-divider"></span>${modeKeys.map((mode) => `<label class="effect-aligned-platform-chip effect-aligned-mode-chip ${selectedModes.has(mode) ? "active" : ""}"><input type="checkbox" value="${escapeHtml(mode)}" ${modeAttribute} ${selectedModes.has(mode) ? "checked" : ""} /><i></i><span>${escapeHtml(EFFECT_RELAY_MODE_NAMES[mode] || mode)}</span></label>`).join("")}` : "";
  return `<div class="effect-aligned-platform-row"><span class="effect-aligned-platform-label">${escapeHtml(label)}</span><div class="effect-aligned-platform-chips">${chipHtml}${modeHtml}</div><small>已选 ${scopeRows.filter((row) => selectedScopes.has(row.scope)).length} / ${scopeRows.length}</small></div>`;
}

function effectAlignedSearchKpis(entries, records) {
  const today = new Date();
  const isToday = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };
  const todayEntries = entries.filter((entry) => isToday(entry.link?.createdAt));
  const todayRecords = todayEntries.flatMap((entry) => effectRelayRecordsFromRun(entry.run, entry.link)).filter((record) => record.status === "verified");
  const sourceRecords = todayRecords.length ? todayRecords : records.filter((record) => record.status === "verified");
  const mentioned = sourceRecords.filter((record) => Number(record.brandMentionCount || 0) > 0);
  const platforms = new Set(sourceRecords.map((record) => record.platform).filter(Boolean));
  const mentionRate = sourceRecords.length ? Math.round(mentioned.length / sourceRecords.length * 100) : null;
  return `<section class="effect-aligned-kpis">${effectAlignedKpi({ label: "今日检测", value: todayEntries.length, description: "实时检索任务数", foot: platforms.size ? `覆盖 ${platforms.size} 个 AI 平台` : "暂无已验证平台结果", action: "查看 →", iconName: "search" })}${effectAlignedKpi({ label: "品牌被引用", value: sourceRecords.length ? mentioned.length : "—", delta: mentionRate === null ? "" : `${mentionRate}%`, description: "已验证回答明确提及品牌", foot: sourceRecords.length ? `${mentioned.length} / ${sourceRecords.length} 条有效回答` : "等待真实结果", action: "明细 →", iconName: "check", tone: "tone-teal" })}${effectAlignedKpi({ label: "未提及", value: sourceRecords.length ? sourceRecords.length - mentioned.length : "—", delta: mentionRate === null ? "" : `${100 - mentionRate}%`, description: "需要补充信源或话术", foot: sourceRecords.length ? "仅统计已验证回答" : "等待真实结果", action: "优化 →", iconName: "alert", tone: "tone-amber" })}${effectAlignedKpi({ label: "竞品对比", value: "—", description: "当前检测未返回竞品比较口径", foot: "不使用推测数据生成排名", action: "报告 →", iconName: "users", tone: "tone-rose" })}</section>`;
}

function effectAlignedSearchAnswerCard(records, running) {
  const record = records.filter((item) => item.status === "verified").sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")))[0] || null;
  if (!record) return `<article class="effect-aligned-card effect-aligned-answer"><header><div><h3>${running ? `<i class="effect-aligned-live-dot"></i>` : ""}AI 平台 · 实时回答</h3><p>${running ? "检测服务正在获取并校验真实回答" : "提交问题后将在此展示最新一条已验证回答"}</p></div></header>${effectAlignedEmpty(running ? "正在等待回答回传" : "暂无实时回答", "只有通过服务端校验的真实回答会显示在这里。")}</article>`;
  const citations = Array.isArray(record.citationSources) ? record.citationSources : [];
  const citationHtml = citations.length ? `<div class="effect-aligned-citations">${citations.slice(0, 8).map((source, index) => {
    const url = /^https?:\/\//i.test(String(source.url || "")) ? String(source.url) : "";
    return `<article><strong>${index + 1}</strong><div><b>${escapeHtml(source.title || source.domain || source.url || "引用来源")}</b><small>${escapeHtml(source.domain || source.url || "未返回来源地址")}</small>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">查看来源 →</a>` : ""}</div></article>`;
  }).join("")}</div>` : `<div class="effect-aligned-inline-empty">本条回答未返回可验证引用来源。</div>`;
  return `<article class="effect-aligned-card effect-aligned-answer"><header><div><h3><i class="effect-aligned-live-dot"></i>${escapeHtml(record.platform || "AI 平台")} · 实时回答</h3><p>${escapeHtml(record.terminal || "—")} · ${escapeHtml(record.mode || "—")} · 引用 ${citations.length} 个信源</p></div></header><div class="effect-aligned-answer-bubble"><div><b>${escapeHtml(record.platform || "AI 平台")}</b><span>${escapeHtml(record.observedAt ? effectAlignedDateTime(record.observedAt) : "时间未返回")}</span><span>证据 ${escapeHtml(record.evidenceId || "—")}</span></div><p>${escapeHtml(record.answer || "检测服务未返回可展示的回答。")}</p></div>${citationHtml}</article>`;
}

function effectAlignedDimension(label, value, note = "") {
  const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;
  return `<div class="effect-aligned-dimension"><div><span>${escapeHtml(label)}</span><b>${numeric === null ? "—" : `${Math.round(numeric)}%`}</b></div><div class="effect-aligned-dimension-track"><i style="transform:scaleX(${numeric === null ? 0 : numeric / 100})"></i></div>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`;
}

function effectAlignedSearchDiagnosisCard(records, entry) {
  const verified = records.filter((record) => record.status === "verified");
  const requested = Number(entry?.link?.request?.items?.length || records.length || 0);
  const mentioned = verified.filter((record) => Number(record.brandMentionCount || 0) > 0);
  const cited = verified.filter((record) => (record.citationSources || []).length > 0);
  const ranked = verified.filter((record) => Number.isFinite(Number(record.firstMentionRank)) && Number(record.firstMentionRank) > 0);
  const topOne = ranked.filter((record) => Number(record.firstMentionRank) === 1);
  const coverage = requested ? Math.round(verified.length / requested * 100) : null;
  const mentionRate = verified.length ? Math.round(mentioned.length / verified.length * 100) : null;
  const citationRate = verified.length ? Math.round(cited.length / verified.length * 100) : null;
  const topOneRate = ranked.length ? Math.round(topOne.length / ranked.length * 100) : null;
  return `<article class="effect-aligned-card effect-aligned-score"><header><div><h3>本次检索诊断</h3><p>仅使用本次已验证的信源、提及与排名字段</p></div></header><div class="effect-aligned-score-main"><div class="effect-aligned-score-ring"><strong>—</strong></div><b>综合得分</b><small>检测服务未返回正式综合评分口径</small></div><div class="effect-aligned-dimensions">${effectAlignedDimension("证据覆盖率", coverage, `${verified.length} / ${requested || 0} 条已验证`)}${effectAlignedDimension("品牌提及率", mentionRate, `${mentioned.length} 条回答提及品牌`)}${effectAlignedDimension("回答引用率", citationRate, `${cited.length} 条回答带可验证引用`)}${effectAlignedDimension("首位提及率", topOneRate, ranked.length ? `${topOne.length} / ${ranked.length} 条返回排名` : "上游未返回排名字段")}</div></article>`;
}

function effectAlignedPlatformTable(records, running = false) {
  const selectedScopes = new Set((ui.effectPlatformScopes || []).map(effectRelayNormalizeScope));
  const groups = new Map();
  for (const capability of effectRelayCapabilityItems()) {
    const platformCode = String(capability.platform || "").trim();
    const platform = EFFECT_RELAY_PLATFORM_NAMES[platformCode] || platformCode;
    if (!platform) continue;
    const group = groups.get(platform) || { platform, code: (EFFECT_RELAY_PLATFORM_UI[platformCode]?.code || platform.slice(0, 1)), selected: false, records: [] };
    if (selectedScopes.has(effectRelayScopeKey(platformCode, capability.terminal))) group.selected = true;
    groups.set(platform, group);
  }
  for (const record of records) {
    const platform = String(record.platform || "未知平台");
    const group = groups.get(platform) || { platform, code: platform.slice(0, 1), selected: true, records: [] };
    group.records.push(record);
    groups.set(platform, group);
  }
  const rows = [...groups.values()].map((group) => {
    const verified = group.records.filter((record) => record.status === "verified");
    const citations = verified.reduce((sum, record) => sum + Number(record.citationSources?.length || 0), 0);
    const mentioned = verified.filter((record) => Number(record.brandMentionCount || 0) > 0).length;
    const ranked = verified.filter((record) => Number.isFinite(Number(record.firstMentionRank)) && Number(record.firstMentionRank) > 0);
    const topOne = ranked.filter((record) => Number(record.firstMentionRank) === 1).length;
    const latest = verified.slice().sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")))[0];
    const status = verified.length ? ["ok", "运行正常"] : group.records.length || (group.selected && running) ? ["warn", "检测中"] : group.selected ? ["idle", "等待结果"] : ["idle", "未启用"];
    return `<tr><td><div class="effect-aligned-platform-name">${effectMonitorPlatformBadge(group.platform, 26)}<span><b>${escapeHtml(group.platform)}</b><small>${verified.length ? `${verified.length} 条已验证回答` : "暂无已验证回答"}</small></span></div></td><td class="num">${verified.length ? citations : "—"}</td><td class="num">${verified.length ? verified.length - mentioned : "—"}</td><td class="num">${ranked.length ? `${Math.round(topOne / ranked.length * 100)}%` : "—"}</td><td><span class="effect-aligned-status ${status[0]}">${status[1]}</span></td><td>${latest?.observedAt ? escapeHtml(formatRelative(latest.observedAt)) : "—"}</td></tr>`;
  }).join("");
  return `<section class="effect-aligned-card effect-aligned-platform-table-card"><header><div><h3>各平台表现</h3><p>本次检索在当前已配置 AI 平台上的真实结果 · 未返回字段保持为空</p></div></header><div class="effect-aligned-table-scroll"><table class="effect-aligned-platform-table"><thead><tr><th>平台</th><th class="num">引用次数</th><th class="num">未提及</th><th class="num">首条命中率</th><th>状态</th><th>最近一次</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${effectAlignedEmpty("暂无平台能力数据")}</td></tr>`}</tbody></table></div></section>`;
}

function effectAlignedSearchHistory(entries) {
  const rows = entries.slice(0, 5).map((entry) => {
    const stats = effectRelayEntryStats(entry);
    const question = effectRelayEntryQuestions(entry)[0] || "实时检索问题";
    const platforms = [...new Set((entry.link?.request?.items || []).map((item) => item.metadata?.displayPlatform || EFFECT_RELAY_PLATFORM_NAMES[item.platform] || item.platform).filter(Boolean))];
    const status = effectRelayRunStatus(entry.link, entry.run);
    return `<button type="button" class="effect-aligned-history-item ${["completed", "partial"].includes(status) ? "success" : ["pending", "submitted", "queued", "running"].includes(status) ? "running" : ""}" data-action="effect-center-open-run" data-effect-run-id="${escapeHtml(entry.link.diagnosticRunId)}"><span>${escapeHtml(effectAlignedDateTime(entry.link.createdAt))} · ${escapeHtml(platforms.slice(0, 2).join(" / ") || "AI 平台")}</span><b>${escapeHtml(question)}</b><small>回传 ${stats.delivered} / ${stats.requested || 0} · 已验证 ${stats.verified} · ${escapeHtml(effectRelayRunLabel(status))}</small></button>`;
  }).join("");
  return `<article class="effect-aligned-card effect-aligned-history"><header><div><h3>最近检索历史</h3><p>点击一条问题，查看同一次真实检测结果</p></div></header>${rows || effectAlignedEmpty("暂无实时检索历史", "提交首次实时搜索后，任务记录会出现在这里。")}</article>`;
}

function effectAlignedSystemStatus() {
  const domain = String(state.enterpriseProfile?.officialDomain || state.site?.domain || "").trim();
  const capabilityCount = effectRelayCapabilityItems().length;
  const serviceError = effectRelaySnapshot.error || effectFlowStateFor("realtime").error;
  const quota = effectRelaySnapshot.quota || {};
  const cells = [
    ["// 企业官网", domain ? "已配置" : "待配置", domain || "请在官网运营中配置域名", domain ? "ok" : "warn"],
    ["// GEO 检测", serviceError ? "需检查" : capabilityCount ? "可用" : "连接中", serviceError ? customerFacingEffectText(serviceError) : capabilityCount ? `${capabilityCount} 个检测能力项` : "正在读取平台能力", serviceError ? "bad" : capabilityCount ? "ok" : "warn"],
    ["// 检测额度", quota.availableCredits !== undefined ? `${Number(quota.availableCredits).toLocaleString("zh-CN")} 积分` : "读取中", quota.availableCredits !== undefined ? "以提交时实时校验为准" : "正在连接客户额度", quota.availableCredits !== undefined ? "ok" : "warn"]
  ];
  return `<article class="effect-aligned-card effect-aligned-system"><header><div><h3>系统状态</h3><p>当前企业独立部署环境</p></div></header><div class="effect-aligned-system-grid">${cells.map(([name, status, meta, tone]) => `<div><small>${escapeHtml(name)}</small><b><i class="${tone}"></i>${escapeHtml(status)}</b><span>${escapeHtml(meta)}</span></div>`).join("")}</div></article>`;
}

function renderEffectSearch() {
  if (!effectRelaySnapshot.attempted && !effectRelaySnapshot.loading) queueMicrotask(() => refreshEffectRelay({ renderAfter: true }));
  const question = effectSearchQuestionList(ui.effectSearchQuestion)[0] || "";
  const supportedItems = effectRelaySupportedItems(ui.effectPlatformScopes, ui.effectPlatformModes, [{ id: "realtime-draft", text: question }]);
  const entry = effectRelayHistoryEntry(ui.effectSearchRunId, "realtime");
  const estimatedCredits = effectSearchEstimatedCredits(supportedItems);
  const composerDisabled = ui.effectSearchSubmitting || !question || !supportedItems.length;
  const entries = effectRelayHistoryEntries("realtime");
  const records = entry ? effectRelayRecordsFromRun(entry.run, entry.link) : effectSearchRecordsForView();
  const status = effectRelayRunStatus(entry?.link, entry?.run);
  const running = ui.effectSearchSubmitting || ["pending", "submitted", "queued", "running"].includes(status);
  const brand = String(ui.effectSearchBrand || state.enterpriseProfile?.brandName || "").trim();
  return `<div class="page-container effect-demo-page effect-search-page effect-aligned-page">${effectAlignedPageHead({ eyebrow: "", title: "实时搜索", accent: "让品牌被 AI 准确看见", description: "在用户真正提问的 AI 平台上，实时检索企业的真实表现，看清每一次被引用或被忽略的瞬间。" })}${effectAlignedSearchKpis(entries, records)}<section class="effect-aligned-task"><header class="effect-aligned-task-head"><div><h3>发起一次实时搜索</h3><p>输入问题，选择平台，立即查看 AI 给出的真实答案与你的引用表现</p></div></header><div class="effect-aligned-search-row"><input id="effect-search-question" type="text" value="${escapeHtml(question)}" placeholder="例：国内做 GEO 优化的企业有哪些？哪家更值得选？" aria-label="实时搜索问题" /><input id="effect-search-brand" type="hidden" value="${escapeHtml(brand)}" /><input id="effect-search-industry" type="hidden" value="${escapeHtml(ui.effectSearchIndustry || "")}" /><button class="effect-aligned-primary" type="button" data-action="effect-search-run" ${composerDisabled ? "disabled" : ""}>${ui.effectSearchSubmitting ? '<span class="loading-spinner"></span>正在检索…' : "开始检索 →"}</button></div><div class="effect-live-estimate effect-aligned-estimate" data-effect-search-estimate ${question ? "" : "hidden"}><span>${icon("credit-card")}</span><b>本次预计消耗 ${estimatedCredits.toLocaleString("zh-CN")} 积分</b><small>发送时会按最新价格与额度自动校验</small></div>${effectAlignedCapabilityChips({ scopes: ui.effectPlatformScopes, modes: ui.effectPlatformModes, label: "检索平台：" })}<div class="effect-aligned-task-status">${effectRelayStatusPanel({ flow: "realtime", entry, scopes: ui.effectPlatformScopes, modes: ui.effectPlatformModes, questions: [{ id: "realtime-draft", text: question }], cancelAction: "effect-search-cancel", cancelRunId: ui.effectSearchRunId })}</div></section><section class="effect-aligned-results">${effectAlignedSearchAnswerCard(records, running)}${effectAlignedSearchDiagnosisCard(records, entry)}</section>${effectAlignedPlatformTable(records, running)}<section class="effect-aligned-bottom">${effectAlignedSearchHistory(entries)}${effectAlignedSystemStatus()}</section></div>`;
}

function effectPagesTabs(active) {
  const items = [
    ["effect-search", "实时搜索", "search"],
    ["effect-diagnostic", "品牌诊断", "target"],
    ["effect-monitor", "品牌监测", "chart"]
  ];
  return `<nav class="effect-pages-nav" aria-label="灼见 GEO"><span class="effect-pages-nav-brand">灼见 GEO</span>${items.map(([id, label, iconName]) => `<button class="effect-pages-nav-item ${active === id ? "active" : ""}" type="button" data-nav="${id}"><span class="ic" data-icon="${iconName}"></span><span>${label}</span></button>`).join("")}</nav>`;
}

function effectDiagnosticAliases(value = ui.effectDiagnosticBrandTerms) {
  return [...new Set((Array.isArray(value) ? value : effectSearchBrandTerms(value))
    .flatMap((item) => effectSearchBrandTerms(item))
    .map((item) => String(item || "").trim())
    .filter(Boolean))];
}

function effectDiagnosticBrandProfile() {
  const name = String(ui.effectDiagnosticBrand || "").trim();
  const aliases = effectDiagnosticAliases([name, ...(ui.effectDiagnosticBrandTerms || [])]);
  return { name, aliases, description: String(ui.effectDiagnosticIntroduction || "").trim() };
}

function effectDiagnosticQuestionList(value = ui.effectDiagnosticQuestions) {
  const source = typeof value === "string"
    ? value.split(/\r?\n/)
    : Array.isArray(value) ? value.map((item) => item?.text || item?.prompt || item) : [];
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 20);
}

function ensureEffectDiagnosticDraft() {
  const brand = String(ui.effectDiagnosticBrand || "").trim();
  if (!brand) return false;
  ui.effectDiagnosticStarted = true;
  if (!ui.effectDiagnosticQuestionDraftInitialized) {
    ui.effectDiagnosticQuestions = effectDiagnosticQuestionSeed(brand);
    ui.effectDiagnosticQuestionDraftInitialized = true;
  }
  if (!Array.isArray(ui.effectDiagnosticCompetitors)) ui.effectDiagnosticCompetitors = [];
  if (!ui.effectDiagnosticScopeSelectionTouched && !ui.effectDiagnosticScopes.length) {
    const scopes = effectRelayCapabilityScopeKeys();
    if (scopes.length) {
      ui.effectDiagnosticScopes = scopes;
      ui.effectDiagnosticPlatformRounds = Object.fromEntries(scopes.map((scope) => [scope, Number(ui.effectDiagnosticPlatformRounds?.[scope] || 1)]));
    }
  }
  const availableModes = [...new Set(effectRelayCapabilityItems().map((item) => String(item.mode || "").trim()).filter(Boolean))];
  if (!ui.effectDiagnosticModes.length && availableModes.length) {
    ui.effectDiagnosticModes = [availableModes.includes("fast") ? "fast" : availableModes[0]];
  }
  return true;
}

function effectDiagnosticDraftQuestions() {
  return effectDiagnosticQuestionList().map((text, index) => ({ id: `diagnostic-draft-${index + 1}`, text }));
}

function effectDiagnosticCompetitorLabels(value = ui.effectDiagnosticCompetitors) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === "string") return item.trim();
    const name = String(item?.name || "").trim();
    const aliases = effectSearchBrandTerms(item?.terms || item?.aliases || "");
    return name ? (aliases.length ? `${name}（别名：${aliases.join("、")}）` : name) : "";
  }).filter(Boolean).slice(0, 20);
}

function effectDiagnosticInputSignature() {
  return JSON.stringify({
    brand: effectDiagnosticBrandProfile(),
    website: String(ui.effectDiagnosticSite || "").trim(),
    industry: String(ui.effectDiagnosticIndustry || "").trim(),
    introduction: String(ui.effectDiagnosticIntroduction || "").trim(),
    competitors: effectDiagnosticCompetitorLabels(),
    questions: effectDiagnosticQuestionList(),
    scopes: (ui.effectDiagnosticScopes || []).map(effectRelayNormalizeScope).sort(),
    modes: (ui.effectDiagnosticModes || []).map(effectRelayModeCode).sort(),
    platformRounds: Object.fromEntries(Object.entries(ui.effectDiagnosticPlatformRounds || {})
      .map(([scope, value]) => [effectRelayNormalizeScope(scope), effectDiagnosticRoundCount(scope)])
      .sort(([left], [right]) => left.localeCompare(right)))
  });
}

function effectDiagnosticEntries() {
  return effectRelayHistoryEntries("diagnostic");
}

function effectDiagnosticActiveEntry() {
  // A new brand draft must never inherit a previous brand's evidence. History
  // remains available below, but an entry becomes active only after this
  // browser submits it or the user explicitly opens it.
  return ui.effectDiagnosticRunId
    ? effectRelayHistoryEntry(ui.effectDiagnosticRunId, "diagnostic")
    : null;
}

function invalidateEffectDiagnosticQuote() {
  ui.effectDiagnosticQuoteReady = false;
  ui.effectDiagnosticClientRunId = null;
  if (ui.effectDiagnosticRunId && !ui.effectDiagnosticSubmitting) {
    if (effectRelayPollTimers.diagnostic) window.clearTimeout(effectRelayPollTimers.diagnostic);
    effectRelayPollTimers.diagnostic = null;
    ui.effectDiagnosticRunId = null;
    ui.effectDiagnosticRelayRunId = null;
    ui.effectDiagnosticReportRunId = null;
    ui.effectDiagnosticReportId = null;
    ui.effectDiagnosticReportVersion = null;
    ui.effectDiagnosticReport = null;
    effectFlowStateFor("diagnostic").activeRun = null;
    effectFlowStateFor("diagnostic").activeLink = null;
  }
  ui.effectDiagnosticReportRunId = ui.effectDiagnosticRunId ? ui.effectDiagnosticReportRunId : null;
  setEffectRelayQuote("diagnostic", null);
  effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
}

function effectDiagnosticRecords(entry = effectDiagnosticActiveEntry()) {
  return entry ? effectRelayRecordsFromRun(entry.run, entry.link) : [];
}

async function ensureEffectDiagnosticProject() {
  const brand = effectDiagnosticBrandProfile();
  const questionTexts = effectDiagnosticQuestionList();
  const signature = effectDiagnosticInputSignature();
  if (ui.effectDiagnosticProjectId && ui.effectDiagnosticQuestionSetId && ui.effectDiagnosticProjectSignature === signature) {
    return { projectId: ui.effectDiagnosticProjectId, questionSetId: ui.effectDiagnosticQuestionSetId, questions: ui.effectDiagnosticFrozenQuestions };
  }
  const createdAt = Date.now();
  const frozenQuestions = questionTexts.map((text, index) => ({
    id: `effect-diagnostic-q-${createdAt}-${index + 1}`,
    text,
    type: "aidso_brand_diagnostic",
    source: "customer_input"
  }));
  const payload = await productionApi("/api/v1/diagnostics/projects", {
    method: "POST",
    body: {
      name: `品牌诊断 · ${brand.name}`,
      diagnosticType: "comprehensive",
      industry: ui.effectDiagnosticIndustry || "未填写行业",
      targetBrand: brand.name,
      websiteUrl: String(ui.effectDiagnosticSite || "").trim(),
      objective: `基于冻结问题集，对 ${brand.name} 在已选 AI 检测能力组合中的真实回答进行一次可追溯批量诊断。`,
      scope: {
        source: "effect_diagnostic",
        feature: "aidso_brand_diagnostic",
        aidsoProduct: "completeAnalysis",
        mode: "frozen_question_set",
        customerUi: true,
        brandAliases: brand.aliases,
        brandDescription: String(ui.effectDiagnosticIntroduction || "").trim(),
        competitors: effectDiagnosticCompetitorLabels(),
        platformScopes: ui.effectDiagnosticScopes,
        modes: ui.effectDiagnosticModes,
        platformRounds: Object.fromEntries((ui.effectDiagnosticScopes || []).map((scope) => [
          effectRelayNormalizeScope(scope),
          effectDiagnosticRoundCount(scope)
        ]))
      },
      questionSetSnapshot: { name: `${brand.name} 品牌诊断问题集`, version: 1, frozenAt: new Date().toISOString(), questions: frozenQuestions }
    }
  });
  const data = effectRelayData(payload);
  const project = data.project || diagnosticApiEntity(payload, ["project"]);
  const questionSet = data.questionSet || null;
  if (!project?.id || !questionSet?.id) throw new Error("品牌诊断项目未返回冻结问题集。");
  ui.effectDiagnosticProjectId = project.id;
  ui.effectDiagnosticQuestionSetId = questionSet.id;
  ui.effectDiagnosticProjectSignature = signature;
  ui.effectDiagnosticFrozenQuestions = Array.isArray(questionSet.questions) ? questionSet.questions : frozenQuestions;
  effectRelaySnapshot.projects = [project, ...effectRelaySnapshot.projects.filter((item) => item.id !== project.id)];
  return { projectId: project.id, questionSetId: questionSet.id, questions: ui.effectDiagnosticFrozenQuestions };
}

async function prepareEffectDiagnosticRun() {
  if (ui.effectDiagnosticSubmitting) return;
  const brand = document.getElementById("effect-diagnostic-brand")?.value.trim();
  const aliases = document.getElementById("effect-diagnostic-aliases")?.value;
  const site = document.getElementById("effect-diagnostic-site")?.value.trim();
  const industry = document.getElementById("effect-diagnostic-industry")?.value.trim();
  const introduction = document.getElementById("effect-diagnostic-introduction")?.value.trim();
  const questionInput = document.getElementById("effect-diagnostic-questions")?.value;
  const competitorInput = document.getElementById("effect-diagnostic-competitors")?.value;
  const consent = Boolean(document.querySelector("[data-effect-diagnostic-consent]")?.checked || ui.effectDiagnosticExternalConsent);
  const questions = effectDiagnosticQuestionList(questionInput);
  if (!brand) return showToast("请输入目标品牌", "品牌诊断需要明确目标品牌和品牌词口径。", "error");
  if (!questions.length) return showToast("请至少填写一个诊断问题", "每一行会冻结为一个独立的问题。", "error");
  if (!(ui.effectDiagnosticScopes || []).length || !(ui.effectDiagnosticModes || []).length) return showToast("请选择可执行能力", "至少选择一个当前客户实例授权的平台终端与模式。", "error");
  if (!consent) return showToast("请确认数据发送范围", "提交后，品牌资料、竞品和冻结问题集将由灼见 AI 检测服务安全处理。", "error");
  ui.effectDiagnosticBrand = brand;
  ui.effectDiagnosticBrandTerms = effectDiagnosticAliases([brand, ...(effectSearchBrandTerms(aliases))]);
  ui.effectDiagnosticSite = site;
  ui.effectDiagnosticIndustry = industry;
  ui.effectDiagnosticIntroduction = introduction || "";
  const existingQuestions = new Map((ui.effectDiagnosticQuestions || []).map((item) => [String(item.text || "").trim(), item]));
  ui.effectDiagnosticQuestions = questions.map((text, index) => ({
    ...(existingQuestions.get(text) || {}),
    id: existingQuestions.get(text)?.id || `diagnostic-input-${index + 1}`,
    text
  }));
  if (competitorInput !== undefined) {
    ui.effectDiagnosticCompetitors = String(competitorInput || "").split(/\r?\n/).map((line, index) => {
      const [name, terms = ""] = line.split(/[：:]/, 2);
      return { id: `competitor-${index + 1}`, name: String(name || "").trim(), terms: String(terms || "").trim() };
    }).filter((item) => item.name);
  } else {
    ui.effectDiagnosticCompetitors = (ui.effectDiagnosticCompetitors || []).map((item) => ({
      id: item.id || uid("COMP"),
      name: String(item.name || "").trim(),
      terms: String(item.terms || "").trim()
    })).filter((item) => item.name);
  }
  ui.effectDiagnosticExternalConsent = true;
  ui.effectDiagnosticSubmitting = true;
  ui.effectDiagnosticCompleted = false;
  ui.effectDiagnosticClientRunId = null;
  render();
  try {
    const project = await ensureEffectDiagnosticProject();
    const items = effectDiagnosticSupportedItems(ui.effectDiagnosticScopes, ui.effectDiagnosticModes, project.questions, { source: "effect_diagnostic", feature: "aidso_brand_diagnostic" });
    if (!items.length) throw new Error("当前客户实例没有可执行的平台、终端或模式价格规则。");
    const quotePayload = await productionApi("/api/v1/diagnostics/relay/quote", { method: "POST", body: { ...project, items } });
    const quote = effectRelayData(quotePayload).quote || null;
    setEffectRelayQuote("diagnostic", quote);
    setEffectFlowError("diagnostic", "");
    effectRelaySnapshot = { ...effectRelaySnapshot, quote, error: "" };
    ui.effectDiagnosticQuoteReady = true;
    showToast("品牌诊断报价已返回", `已冻结 ${project.questions.length} 个问题，将执行 ${items.length} 个独立任务项。`, "success");
  } catch (error) {
    setEffectRelayQuote("diagnostic", null);
    setEffectFlowError("diagnostic", error.message || "品牌诊断报价失败");
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null, error: error.message || "品牌诊断报价失败" };
    showToast("无法获取品牌诊断报价", effectRelaySnapshot.error, "error");
  } finally {
    ui.effectDiagnosticSubmitting = false;
    render();
  }
}

async function submitEffectDiagnosticRun() {
  if (ui.effectDiagnosticSubmitting || !ui.effectDiagnosticQuoteReady) return;
  const projectId = ui.effectDiagnosticProjectId;
  const questionSetId = ui.effectDiagnosticQuestionSetId;
  if (!projectId || !questionSetId) return showToast("诊断配置已失效", "请重新获取报价后再提交。", "error");
    const items = effectDiagnosticSupportedItems(ui.effectDiagnosticScopes, ui.effectDiagnosticModes, ui.effectDiagnosticFrozenQuestions, { source: "effect_diagnostic", feature: "aidso_brand_diagnostic" });
  if (!items.length) return showToast("没有可执行的诊断项", "请重新选择当前客户实例获准的能力组合。", "error");
  ui.effectDiagnosticSubmitting = true;
  render();
  const clientRunId = uid("EFFECT_DIAGNOSTIC");
  const idempotencyKey = `effect-diagnostic:${projectId}:${clientRunId}`;
  ui.effectDiagnosticClientRunId = clientRunId;
  try {
    const payload = await productionApi(`/api/v1/diagnostics/projects/${encodeURIComponent(projectId)}/relay-runs`, {
      method: "POST",
      body: {
        questionSetId,
        clientRunId,
        idempotencyKey,
        items,
        brand: effectDiagnosticBrandProfile(),
        competitors: effectDiagnosticCompetitorLabels(),
        analysisScope: {
          source: "effect_diagnostic",
          feature: "aidso_brand_diagnostic",
          aidsoProduct: "completeAnalysis",
          mode: "frozen_question_set",
          industry: ui.effectDiagnosticIndustry,
          websiteUrl: ui.effectDiagnosticSite,
          questionCount: ui.effectDiagnosticFrozenQuestions.length,
          sampling: {
            semantics: "independent_samples",
            platformRounds: Object.fromEntries((ui.effectDiagnosticScopes || []).map((scope) => [
              effectRelayNormalizeScope(scope),
              effectDiagnosticRoundCount(scope)
            ]))
          }
        },
        requestMetadata: { client: "tongzhuo-geo-platform", page: "effect-diagnostic", feature: "aidso_brand_diagnostic", aidsoProduct: "completeAnalysis", flow: "frozen_question_set", sampling: "independent_samples" },
        consent: { externalDataConsent: true, consentedAt: new Date().toISOString(), method: "effect_diagnostic_user_confirm" }
      }
    });
    const data = effectRelayData(payload);
    ui.effectDiagnosticRunId = data.run?.id || data.link?.diagnosticRunId || null;
    ui.effectDiagnosticRelayRunId = data.link?.relayRunId || null;
    ui.effectDiagnosticQuoteReady = false;
    // Keep the global transport cache intact; product pages filter it by
    // requestMetadata.feature rather than overwriting another product's rows.
    const history = (Array.isArray(effectRelaySnapshot.history) ? effectRelaySnapshot.history : [])
      .filter((entry) => String(entry?.link?.diagnosticRunId) !== String(ui.effectDiagnosticRunId));
    if (data.link?.diagnosticRunId) history.unshift({ link: data.link, run: data.run || null });
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null, history, links: history.map((entry) => entry.link), activeRun: data.run || null, activeLink: data.link || null, error: "", loaded: true };
    effectFlowStateFor("diagnostic").activeRun = data.run || null;
    effectFlowStateFor("diagnostic").activeLink = data.link || null;
    effectFlowStateFor("diagnostic").error = "";
    if (ui.effectDiagnosticRunId) await refreshEffectRelayRun({ runId: ui.effectDiagnosticRunId, pull: true, renderAfter: false, flow: "diagnostic" });
    showToast("品牌诊断任务已提交", "只有客户服务端已校验、写入 live evidence 的真实交付会进入诊断报告。", "success");
  } catch (error) {
    effectRelaySnapshot = { ...effectRelaySnapshot, error: error.message || "品牌诊断任务提交失败" };
    showToast("品牌诊断未提交", effectRelaySnapshot.error, "error");
  } finally {
    ui.effectDiagnosticSubmitting = false;
    render();
  }
}

async function generateEffectDiagnosticReport(entry = effectDiagnosticActiveEntry()) {
  if (ui.effectDiagnosticReportGenerating) return;
  const projectId = entry?.link?.projectId || entry?.run?.projectId || ui.effectDiagnosticProjectId;
  if (!entry?.link?.diagnosticRunId || !projectId) {
    return showToast("报告暂不可生成", "请先选择一条本次品牌诊断任务并完成项目冻结。", "error");
  }
  const status = effectRelayRunStatus(entry.link, entry.run);
  const verified = effectDiagnosticRecords(entry).filter((record) => record.status === "verified");
  if (!["completed", "partial"].includes(status) || !verified.length) {
    return showToast("等待真实回答回传", "只有中转任务完成并写入已验收 live evidence 后，才能生成报告。", "error");
  }
  ui.effectDiagnosticReportGenerating = true;
  render();
  try {
    const endpoint = "/api/v1/diagnostics/projects/" + encodeURIComponent(projectId) + "/relay-runs/" + encodeURIComponent(entry.link.diagnosticRunId) + "/report";
    const payload = await productionApi(endpoint, {
      method: "POST",
      body: { title: (ui.effectDiagnosticBrand || "品牌") + (effectRelayExecutionMode() === "mock" ? " AI 品牌诊断演练报告" : " AI 品牌诊断报告") }
    });
    const data = effectRelayData(payload);
    ui.effectDiagnosticReportRunId = entry.link.diagnosticRunId;
    ui.effectDiagnosticReportId = data.reportId || data.report?.id || null;
    ui.effectDiagnosticReportVersion = data.version || data.report?.version || null;
    ui.effectDiagnosticReport = data.report || null;
    showToast("品牌诊断报告已生成", ui.effectDiagnosticReportId ? "报告 " + ui.effectDiagnosticReportId + " · v" + (ui.effectDiagnosticReportVersion || 1) : "报告已保存到客户服务端。", "success");
  } catch (error) {
    showToast("品牌诊断报告未生成", error.message || "报告接口暂不可用。", "error");
  } finally {
    ui.effectDiagnosticReportGenerating = false;
    render();
  }
}

async function loadEffectDiagnosticReport(runId = ui.effectDiagnosticRunId) {
  if (!runId) return null;
  try {
    const listPayload = await productionApi("/api/v1/diagnostics/reports?runId=" + encodeURIComponent(runId) + "&status=final&limit=1");
    const summary = diagnosticApiItems(listPayload, ["items", "reports"])[0] || null;
    const reportId = summary?.id || summary?.reportId || null;
    if (!reportId) {
      if (ui.effectDiagnosticReportRunId === runId) {
        ui.effectDiagnosticReportRunId = null;
        ui.effectDiagnosticReportId = null;
        ui.effectDiagnosticReportVersion = null;
        ui.effectDiagnosticReport = null;
      }
      return null;
    }
    const detailPayload = await productionApi("/api/v1/diagnostics/reports/" + encodeURIComponent(reportId));
    const report = diagnosticApiEntity(detailPayload, ["report", "diagnosticReport"]) || summary;
    ui.effectDiagnosticReportRunId = runId;
    ui.effectDiagnosticReportId = reportId;
    ui.effectDiagnosticReportVersion = report.version || summary.version || null;
    ui.effectDiagnosticReport = report;
    return report;
  } catch {
    return null;
  }
}


function renderVerifiedEffectDiagnosticReport(entry = effectDiagnosticActiveEntry()) {
  if (!entry) return "";
  const records = effectDiagnosticRecords(entry);
  const requested = Number(entry.link?.request?.items?.length || 0);
  const verified = records.filter((record) => record.status === "verified");
  const mentioned = verified.filter((record) => Number(record.brandMentionCount || 0) > 0);
  const citations = verified.reduce((sum, record) => sum + Number(record.citationSources?.length || 0), 0);
  const coverage = requested ? Math.round((verified.length / requested) * 100) : 0;
  const mentionRate = verified.length ? Math.round((mentioned.length / verified.length) * 100) : 0;
  const status = effectRelayRunStatus(entry.link, entry.run);
  const incomplete = Math.max(0, requested - records.length);
 const runId = String(entry.link?.diagnosticRunId || "");
 const report = ui.effectDiagnosticReportRunId === runId ? ui.effectDiagnosticReport : null;
  const isMock = effectRelayExecutionMode() === "mock";
 const reportAction = report
    ? `<div class='effect-diagnostic-report-ready'><b>${isMock ? "演练报告已生成" : "正式报告已生成"}</b><span>报告 ${escapeHtml(ui.effectDiagnosticReportId || report.id || "—")} · v${escapeHtml(String(ui.effectDiagnosticReportVersion || report.version || 1))}</span><small>${escapeHtml(report.executiveSummary || "报告已保存到客户服务端，可按本次 evidence 追溯。")}</small></div>`
   : ["completed", "partial"].includes(status) && verified.length
      ? `<button class='primary-button' type='button' data-action='effect-diagnostic-generate-report' ${ui.effectDiagnosticReportGenerating ? "disabled" : ""}>${ui.effectDiagnosticReportGenerating ? "正在生成报告…" : isMock ? "生成演练诊断报告" : "生成品牌诊断报告"}</button>`
      : `<small class='effect-input-hint'>任务完成并收到已验收 live evidence 后，才能生成正式报告。</small>`;
  const note = !verified.length
    ? "当前还没有可用于指标计算的 verified live evidence；不会补充估算排名、情感或示例结果。"
    : "覆盖率、提及和回答引用均仅依据本次已验证的检测结果；结果可按证据 ID 和任务追溯号查询。";
  return `<section class='card effect-diagnostic-report'><header><div><span class='effect-demo-kicker'>DIAGNOSTIC FEEDBACK → REPORT</span><h3>${escapeHtml(ui.effectDiagnosticBrand || "品牌")} 诊断结果</h3><p>${escapeHtml(note)}</p></div><span class='status-badge ${["completed", "partial"].includes(status) ? "status-approved" : ["failed", "attention", "cancelled"].includes(status) ? "status-error" : "status-pending"}'>${escapeHtml(effectRelayRunLabel(status))}</span></header><div class='effect-search-summary'><div><small>证据覆盖率</small><b>${requested ? `${coverage}%` : "—"}</b><em>${verified.length} / ${requested || 0} 个已验证任务项</em></div><div><small>品牌提及率</small><b>${verified.length ? `${mentionRate}%` : "—"}</b><em>${mentioned.length} / ${verified.length} 个已验证回答</em></div><div><small>回答引用</small><b>${citations}</b><em>仅统计检测服务返回的引用</em></div><div><small>尚未落库项</small><b>${incomplete}</b><em>失败或未验证项不参与指标</em></div></div><div class='effect-diagnostic-report-action'>${reportAction}</div><div class='effect-diagnostic-boundary'>排名、情感或竞品对比只在检测结果包含可验证字段时展示，不会生成推测结论。</div></section>${effectSearchResultsPanel({ records, entry, title: "本次诊断的真实回答反馈" })}`;
}

function effectDiagnosticHistory(entry = effectDiagnosticActiveEntry()) {
  const entries = effectDiagnosticEntries();
  return `<section class="card effect-diagnostic-history"><header><div><h3>品牌诊断任务</h3><p>每次复测都会创建新的独立运行；问题集与能力配置以该次任务快照为准。</p></div><button class="secondary-button" type="button" data-action="effect-relay-refresh">${icon("refresh")}刷新</button></header><div>${entries.length ? entries.map((item) => { const stats = effectRelayEntryStats(item); const selected = item.link.diagnosticRunId === entry?.link?.diagnosticRunId; return `<article class="effect-diagnostic-history-row ${selected ? "active" : ""}"><div><b>${escapeHtml(effectRelayEntryQuestions(item)[0] || "冻结问题集")}</b><small>${effectRelayEntryQuestions(item).length} 个问题 · ${stats.requested} 个任务项 · ${escapeHtml(String(item.link.createdAt || "").replace("T", " ").slice(0, 16))}</small></div><span class="status-badge ${["completed", "partial"].includes(effectRelayRunStatus(item.link, item.run)) ? "status-approved" : ["failed", "attention", "cancelled"].includes(effectRelayRunStatus(item.link, item.run)) ? "status-error" : "status-pending"}">${escapeHtml(effectRelayRunLabel(effectRelayRunStatus(item.link, item.run)))}</span><button class="link-button" type="button" data-action="effect-diagnostic-open-run" data-effect-run-id="${escapeHtml(item.link.diagnosticRunId)}">查看证据</button></article>`; }).join("") : `<div class="effect-search-empty">${effectRelaySnapshot.historyLoaded ? "尚无真实品牌诊断任务。请先配置品牌、问题集和能力范围。" : "正在读取品牌诊断任务…"}</div>`}</div></section>`;
}

function effectDiagnosticRoundRows() {
  const selected = new Set((ui.effectDiagnosticScopes || []).map(effectRelayNormalizeScope));
  const capabilities = effectRelayCapabilityItems();
  const rows = [];
  const seen = new Set();
  for (const capability of capabilities) {
    const scope = effectRelayScopeKey(capability.platform, capability.terminal);
    if (!selected.has(scope) || seen.has(scope)) continue;
    seen.add(scope);
    rows.push({
      scope,
      platform: EFFECT_RELAY_PLATFORM_NAMES[capability.platform] || capability.platform,
      terminal: EFFECT_RELAY_TERMINAL_NAMES[capability.terminal] || capability.terminal,
      count: effectDiagnosticRoundCount(scope)
    });
  }
  if (!rows.length) return '<div class="effect-diagnostic-round-empty">请先选择至少一个平台终端，再设置采样次数。</div>';
  return `<div class="effect-diagnostic-round-grid">${rows.map((row) => `<label class="effect-diagnostic-round-row"><span><b>${escapeHtml(row.platform)}</b><small>${escapeHtml(row.terminal)}</small></span><select data-effect-diagnostic-platform-round data-scope="${escapeHtml(row.scope)}">${[1, 2, 3, 5, 10].map((value) => `<option value="${value}" ${row.count === value ? "selected" : ""}>${value} 次独立采样</option>`).join("")}</select><em>${row.count} × 每个问题</em></label>`).join("")}</div>`;
}

function renderRealEffectDiagnostic() {
  if (!effectRelaySnapshot.attempted && !effectRelaySnapshot.loading) queueMicrotask(() => refreshEffectRelay({ renderAfter: true }));
  if (!ui.effectDiagnosticStarted && !String(ui.effectDiagnosticBrand || "").trim()) return `${effectPagesTabs("effect-diagnostic")}${renderEffectDiagnosticStart()}`;
  const questions = effectDiagnosticQuestionList();
  const draftQuestions = effectDiagnosticDraftQuestions();
  const supportedItems = effectDiagnosticSupportedItems(ui.effectDiagnosticScopes, ui.effectDiagnosticModes, draftQuestions, { source: "effect_diagnostic", feature: "aidso_brand_diagnostic" });
  const quote = effectRelayQuoteFor("diagnostic");
  const entry = effectDiagnosticActiveEntry();
  const status = effectRelayRunStatus(entry?.link, entry?.run);
  const running = ui.effectDiagnosticSubmitting || ["pending", "submitted", "queued", "running"].includes(status);
  const canQuote = Boolean(ui.effectDiagnosticBrand.trim() && questions.length && (ui.effectDiagnosticScopes || []).length && (ui.effectDiagnosticModes || []).length && ui.effectDiagnosticExternalConsent && supportedItems.length);
  const primaryAction = quote && ui.effectDiagnosticQuoteReady
    ? `<button class="primary-button" type="button" data-action="effect-diagnostic-submit" ${ui.effectDiagnosticSubmitting || !supportedItems.length ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? '<span class="loading-spinner"></span>正在提交…' : `${icon("send")}确认并提交品牌诊断`}</button>`
    : `<button class="primary-button" type="button" data-action="effect-diagnostic-quote" ${ui.effectDiagnosticSubmitting || !canQuote ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? '<span class="loading-spinner"></span>正在获取报价…' : `${icon("search")}冻结问题集并获取报价`}</button>`;
  const quoteSummary = quote && ui.effectDiagnosticQuoteReady ? `<div class="effect-search-quote-summary"><span data-icon="quote"></span><div><b>本次批量诊断预估：${Number(quote.estimatedCustomerCredits || 0).toLocaleString("zh-CN")} 积分</b><small>${questions.length} 个冻结问题 × ${supportedItems.length} 个独立采样任务；每个平台次数按独立采样计，不模拟连续会话。</small></div><button class="link-button" type="button" data-action="effect-diagnostic-quote-reset">重新报价</button></div>` : "";
  const aliases = effectDiagnosticAliases([ui.effectDiagnosticBrand, ...(ui.effectDiagnosticBrandTerms || [])]).filter((item) => item !== ui.effectDiagnosticBrand).join("、");
  const competitors = (ui.effectDiagnosticCompetitors || []).map((item) => `${item.name || ""}${item.terms ? `：${item.terms}` : ""}`).filter(Boolean).join("\n");
  return `<div class="page-container effect-demo-page effect-diagnostic-page">${effectRelayStatusPanel({ entry, quote, scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, questions: draftQuestions, cancelAction: "effect-diagnostic-cancel", cancelRunId: ui.effectDiagnosticRunId })}<section class="card effect-demo-query"><header><div><h3>配置并冻结本次品牌诊断</h3><p>问题集、品牌别名、竞品、平台、终端和模式会随本次任务保存。报告只使用已验证的真实检测证据，不从本地生成回答。</p></div><span class="status-badge ${running ? "status-pending" : "status-approved"}">${escapeHtml(running ? effectRelayRunLabel(status) : "等待配置")}</span></header><div class="effect-demo-form"><label class="effect-demo-input"><span>${icon("users")}目标品牌 <em>*</em></span><input id="effect-diagnostic-brand" value="${escapeHtml(ui.effectDiagnosticBrand)}" placeholder="如：桐灼科技" /></label><label class="effect-demo-input"><span>${icon("link")}官网地址</span><input id="effect-diagnostic-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com（可选）" /></label><label class="effect-demo-input"><span>${icon("layers")}行业 / 场景</span><input id="effect-diagnostic-industry" value="${escapeHtml(ui.effectDiagnosticIndustry)}" placeholder="如：工业机器人" /></label><label class="effect-demo-input"><span>${icon("tag")}品牌别名</span><input id="effect-diagnostic-aliases" value="${escapeHtml(aliases)}" placeholder="用逗号分隔，如：桐灼 GEO、Tongzhuo" /></label><label class="effect-demo-input full"><span>${icon("eye")}诊断问题集（每行一个） <em>*</em></span><textarea id="effect-diagnostic-questions" rows="6" placeholder="如：桐灼科技是什么品牌？&#10;如：桐灼科技与同类品牌相比有什么优势？">${escapeHtml(questions.join("\n"))}</textarea><small class="effect-input-hint">最多 20 个去重问题；点击报价后会冻结为本次不可变的问题集。</small></label><label class="effect-demo-input full"><span>${icon("users")}竞品（每行一个；可写“品牌：别名”）</span><textarea id="effect-diagnostic-competitors" rows="3" placeholder="竞品 A：别名 A、产品词 A&#10;竞品 B">${escapeHtml(competitors)}</textarea><small class="effect-input-hint">竞品资料会作为本次任务范围保存；没有可验证字段时，报告不会生成竞品排名或胜负结论。</small></label><div class="effect-demo-field full"><div class="effect-platform-heading"><b>诊断能力范围</b><small>平台、终端和模式来自当前客户可用的 AI 检测能力。</small></div>${effectRelayCapabilityPicker({ scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, scopeAttribute: "data-effect-diagnostic-platform-scope", selectAllAttribute: "data-effect-diagnostic-platform-select-all", modeAttribute: "data-effect-diagnostic-platform-mode" })}</div><div class="effect-demo-controls"><span class="effect-search-scope-summary"><b>${supportedItems.length}</b> 个批量诊断项<br /><small>${questions.length} 个问题 × 已选能力组合</small></span><span class="effect-demo-credit">${effectRelaySnapshot.quota?.availableCredits !== undefined ? `可用 ${Number(effectRelaySnapshot.quota.availableCredits).toLocaleString("zh-CN")} 积分` : "等待读取客户额度"} · 访问凭据由系统安全管理</span><label class="effect-search-consent"><input type="checkbox" data-effect-diagnostic-consent ${ui.effectDiagnosticExternalConsent ? "checked" : ""} /><span>我确认将品牌资料、竞品和冻结问题集提交给灼见 AI 检测服务</span></label>${quoteSummary}${primaryAction}</div></div></section>${effectDiagnosticHistory(entry)}${renderVerifiedEffectDiagnosticReport(entry)}</div>`;
}

function effectMonitorAliases(value = ui.effectMonitorAliases) {
  return [...new Set((Array.isArray(value) ? value : effectSearchBrandTerms(value))
    .flatMap((item) => effectSearchBrandTerms(item))
    .map((item) => String(item || "").trim()).filter(Boolean))];
}

function effectMonitorBrandProfile() {
  const name = String(ui.effectMonitorBrand || "").trim();
  return { name, aliases: effectMonitorAliases([name, ...(ui.effectMonitorAliases || [])]) };
}

function effectMonitorCoreBaselineQuestions(brand = ui.effectMonitorBrand) {
  const name = String(brand || "目标品牌").trim() || "目标品牌";
  return [
    `${name}是什么品牌？主要提供哪些产品或服务？`,
    `${name}适合哪些客户和使用场景？`,
    `${name}的核心产品或服务能解决什么问题？`,
    `${name}相比同类品牌有哪些特点或优势？`,
    `选择${name}时应该重点关注哪些能力？`,
    `${name}有哪些可信的案例、资质或公开证据？`,
    `${name}与同类品牌相比，适合什么样的采购或决策需求？`,
    `如果用户需要相关服务，是否推荐${name}？为什么？`
  ];
}

function ensureEffectMonitorBaselineQuestions() {
  if (ui.effectMonitorQuestionDefaultsInitialized) return;
  if (!effectMonitorQuestionList().length) {
    ui.effectMonitorQuestions = effectMonitorCoreBaselineQuestions().map((text, index) => ({
      id: `monitor-default-${index + 1}`,
      text,
      source: "core_brand_baseline"
    }));
  }
  ui.effectMonitorQuestionDefaultsInitialized = true;
}

function effectMonitorQuestionList(value = ui.effectMonitorQuestions) {
  const source = typeof value === "string" ? value.split(/\r?\n/)
    : Array.isArray(value) ? value.map((item) => item?.text || item?.prompt || item) : [];
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}

function effectMonitorDraftQuestions() {
  return effectMonitorQuestionList().map((text, index) => ({ id: `monitor-draft-${index + 1}`, text }));
}

function effectMonitorCompetitorLabels(value = ui.effectMonitorCompetitors) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === "string") return item.trim();
    const name = String(item?.name || "").trim();
    const aliases = effectSearchBrandTerms(item?.terms || item?.aliases || "");
    return name ? (aliases.length ? `${name}（别名：${aliases.join("、")}）` : name) : "";
  }).filter(Boolean).slice(0, 20);
}

function effectMonitorInputSignature() {
  return JSON.stringify({
    brand: effectMonitorBrandProfile(),
    site: String(ui.effectMonitorSite || "").trim(),
    industry: String(ui.effectMonitorIndustry || "").trim(),
    competitors: effectMonitorCompetitorLabels(),
    questions: effectMonitorQuestionList(),
    scopes: (ui.effectMonitorScopes || []).map(effectRelayNormalizeScope).sort(),
    modes: (ui.effectMonitorModes || []).map(effectRelayModeCode).sort()
  });
}

function monitoringPlanRunIds(plan = effectMonitoringSnapshot.activePlan) {
  return new Set((Array.isArray(plan?.runs) ? plan.runs : effectMonitoringSnapshot.runs || [])
    .map((run) => String(run?.diagnosticRunId || "")).filter(Boolean));
}

function monitoringPlanEntries(plan = effectMonitoringSnapshot.activePlan) {
  const runIds = monitoringPlanRunIds(plan);
  return effectRelayHistoryEntries("monitoring").filter((entry) => runIds.has(String(entry.link?.diagnosticRunId || "")));
}

function monitoringPlanRecords(plan = effectMonitoringSnapshot.activePlan) {
  return monitoringPlanEntries(plan).flatMap((entry) => effectRelayRecordsFromRun(entry.run, entry.link));
}

const EFFECT_MONITOR_VIEWS = Object.freeze([
  ["dashboard", "数据大盘"],
  ["mentions", "提及率 / 排名"],
  ["sentiment", "舆情 / 情感"],
  ["product-cards", "商品卡分析"],
  ["sources", "AI 引用来源"],
  ["dialogs", "AI 对话记录"],
  ["works", "作品引用追踪"],
  ["export", "导出报告"],
  ["settings", "监测设置"],
  ["question-bank", "AI 问题库"]
]);

function effectMonitorViewTabs(active = ui.effectMonitorView) {
  const current = EFFECT_MONITOR_VIEWS.some(([key]) => key === active) ? active : "dashboard";
  const labelOf = (key) => EFFECT_MONITOR_VIEWS.find(([k]) => k === key)?.[1] || key;
  const groups = [
    { key: "overview", label: "概览", iconName: "home", views: ["dashboard"] },
    { key: "insights", label: "洞察分析", iconName: "chart", views: ["mentions", "sentiment", "product-cards", "sources", "dialogs", "works"] },
    { key: "manage", label: "管理", iconName: "settings", views: ["export", "question-bank", "settings"] }
  ];
  const activeGroup = groups.find((group) => group.views.includes(current)) || groups[0];
  const tabs = groups.map((group) => {
    if (group.views.length === 1) {
      const view = group.views[0];
      return `<button type="button" class="effect-aligned-monitor-tab ${current === view ? "active" : ""}" data-action="effect-monitor-view" data-view="${escapeHtml(view)}"><span class="ic" data-icon="${group.iconName}"></span>${escapeHtml(group.label)}</button>`;
    }
    const open = group.views.includes(current);
    const faceLabel = open ? labelOf(current) : group.label;
    const options = group.views.map((view) => `<button type="button" role="option" aria-selected="${current === view}" class="effect-monitor-sub-option ${current === view ? "active" : ""}" data-action="effect-monitor-view" data-view="${escapeHtml(view)}">${escapeHtml(labelOf(view))}</button>`).join("");
    return `<div class="effect-monitor-tab-group ${open ? "is-open" : ""}" data-tab-group><button type="button" class="effect-aligned-monitor-tab has-caret ${open ? "active" : ""}" data-action="effect-monitor-tab-group" aria-haspopup="true" aria-expanded="${open}"><span class="ic" data-icon="${group.iconName}"></span>${escapeHtml(faceLabel)}<span class="effect-caret"></span></button><div class="effect-monitor-subnav" role="listbox">${options}</div></div>`;
  }).join("");
  return `<nav class="effect-aligned-monitor-tabs" aria-label="品牌监测视图">${tabs}</nav>`;
}

function effectMonitorDisplay(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function effectMonitorPlatformBadge(platform, size = 22) {
  const name = String(platform || "").trim() || "—";
  const code = Object.keys(EFFECT_RELAY_PLATFORM_NAMES).find((key) => EFFECT_RELAY_PLATFORM_NAMES[key] === name) || "";
  const meta = EFFECT_RELAY_PLATFORM_UI[code] || null;
  const text = meta?.code || name.slice(0, 1);
  const color = meta?.color || "var(--blue)";
  return `<i class="effect-platform-badge" style="--pf-color:${escapeHtml(color)};width:${size}px;height:${size}px;font-size:${Math.max(9, Math.round(size * .44))}px">${escapeHtml(text)}</i>`;
}

function effectMonitorRateRing(rate, size = 40) {
  if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return `<span class="effect-rate-empty">—</span>`;
  const value = Math.max(0, Math.min(100, Number(rate)));
  const tone = value >= 60 ? "var(--teal)" : value >= 30 ? "var(--amber)" : "var(--red)";
  return `<span class="effect-rate-ring" role="img" aria-label="提及率 ${Math.round(value)}%" style="--rate:${value.toFixed(1)};--rate-color:${tone};width:${size}px;height:${size}px"><b>${Math.round(value)}<small>%</small></b></span>`;
}

function effectMonitorEmptyState(message = "暂无已验收的 live evidence。", options = {}) {
  const { iconName = "inbox", action = "", actionLabel = "" } = options;
  const cta = action && actionLabel ? `<button class="secondary-button button-small" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>` : "";
  return `<div class="effect-monitor-empty"><span class="effect-empty-mark">${icon(iconName)}</span><b>${escapeHtml(message)}</b><small>未返回的字段不会被估算或填充演示数值。</small>${cta}</div>`;
}

function effectMonitorNumber(value, fallback = "—") {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value).toLocaleString("zh-CN");
}

function effectMonitorPercent(value, fallback = "—") {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : `${Math.round(Number(value))}%`;
}

function effectMonitorLocalAnalytics(plan = effectMonitoringSnapshot.activePlan) {
  const entries = monitoringPlanEntries(plan);
  const records = monitoringPlanRecords(plan);
  const verified = records.filter((record) => record.status === "verified");
  const requested = entries.reduce((sum, entry) => sum + Number(entry?.link?.request?.items?.length || 0), 0);
  const mentioned = verified.filter((record) => Number(record.brandMentionCount || 0) > 0);
  const latest = verified.slice().sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")))[0] || null;
  const platformMap = new Map();
  for (const record of verified) {
    const key = [record.platform, record.terminal].join("|");
    const row = platformMap.get(key) || { platform: record.platform, terminal: record.terminal, samples: 0, mentioned: 0, citations: 0, rankValues: [] };
    row.samples += 1;
    if (Number(record.brandMentionCount || 0) > 0) row.mentioned += 1;
    row.citations += Number(record.citationSources?.length || 0);
    if (Number.isFinite(Number(record.firstMentionRank)) && Number(record.firstMentionRank) > 0) row.rankValues.push(Number(record.firstMentionRank));
    platformMap.set(key, row);
  }
  const mentionRank = [...platformMap.values()].map((row) => ({
    ...row,
    mentionRate: row.samples ? Math.round(row.mentioned / row.samples * 100) : null,
    averageRank: row.rankValues.length ? Number((row.rankValues.reduce((sum, value) => sum + value, 0) / row.rankValues.length).toFixed(1)) : null
  })).sort((left, right) => (right.mentionRate ?? -1) - (left.mentionRate ?? -1));
  const sentimentMap = new Map();
  for (const record of verified) {
    const label = String(record.sentiment || "").trim();
    if (!label) continue;
    sentimentMap.set(label, (sentimentMap.get(label) || 0) + 1);
  }
  const sentiment = [...sentimentMap.entries()].map(([label, count]) => ({ label, count, rate: verified.length ? Math.round(count / verified.length * 100) : null }));
  const sourceMap = new Map();
  for (const record of verified) for (const citation of record.citationSources || []) {
    const url = String(citation.url || "").trim();
    const domain = String(citation.domain || citation.siteName || "").trim();
    const key = url || domain || String(citation.title || "").trim();
    if (!key) continue;
    const row = sourceMap.get(key) || { title: citation.title || citation.siteName || domain || url, domain, url, citations: 0, records: 0, lastObservedAt: null };
    row.citations += 1;
    row.records += 1;
    if (!row.lastObservedAt || String(record.observedAt || "") > row.lastObservedAt) row.lastObservedAt = record.observedAt || null;
    sourceMap.set(key, row);
  }
  const sources = [...sourceMap.values()].sort((left, right) => right.citations - left.citations);
  const works = sources.map((source) => ({ ...source, workType: source.url ? "网页作品" : "来源记录" }));
  const questionRows = Array.isArray(plan?.questionSet?.questions) && plan.questionSet.questions.length
    ? plan.questionSet.questions
    : Array.isArray(ui.effectMonitorFrozenQuestions) && ui.effectMonitorFrozenQuestions.length
      ? ui.effectMonitorFrozenQuestions
      : effectMonitorQuestionList().map((text, index) => ({ id: `monitor-question-${index + 1}`, text }));
  const settings = {
    planId: plan?.id || null,
    status: plan?.status || null,
    cadence: plan?.schedule?.cadence || null,
    intervalHours: plan?.schedule?.intervalHours ?? null,
    nextRunAt: plan?.nextRunAt || null,
    authorizationReference: plan?.authorization?.authorizationReference || plan?.authorizationReference || null,
    authorizationExpiresAt: plan?.authorization?.expiresAt || plan?.authorizationExpiresAt || null,
    maxCreditsPerRun: plan?.budget?.maxCreditsPerRun ?? plan?.maxCreditsPerRun ?? null,
    maxMonthlyCredits: plan?.budget?.maxMonthlyCredits ?? plan?.maxMonthlyCredits ?? null,
    scopes: plan?.scope?.platformScopes || plan?.platformScopes || [],
    modes: plan?.scope?.modes || plan?.modes || []
  };
  return {
    overview: {
      requested,
      delivered: records.length,
      verified: verified.length,
      dialogCount: verified.length,
      mentionDialogCount: mentioned.length,
      coverageRate: requested ? Math.round(verified.length / requested * 100) : null,
      mentionRate: verified.length ? Math.round(mentioned.length / verified.length * 100) : null,
      brandMentionCount: verified.length ? verified.reduce((sum, record) => sum + Number(record.brandMentionCount || 0), 0) : null,
      sov: null,
      top1MentionRate: null,
      top3MentionRate: null,
      averageMentionRank: null,
      brandFavorability: null,
      citations: verified.length ? verified.reduce((sum, record) => sum + Number(record.citationSources?.length || 0), 0) : null,
      citationArticleCount: sources.filter((source) => source.url).length,
      sourceCount: sources.length,
      runCount: entries.length,
      lastObservedAt: latest?.observedAt || null
    },
    mentionRank,
    sentiment,
    sources,
    dialogs: records.slice().sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || ""))),
    works,
    settings,
    questionBank: questionRows,
    records,
    source: "customer-live-evidence"
  };
}

function effectMonitorNormalizeAnalytics(payload, fallback) {
  const source = payload?.analytics || payload?.monitoring || payload || {};
  if (!source || typeof source !== "object") return fallback;
  const arrayOr = (keys, defaultValue) => {
    for (const key of keys) if (Array.isArray(source[key])) return source[key];
    return defaultValue;
  };
  return {
    ...fallback,
    ...source,
    overview: { ...fallback.overview, ...(source.overview || source.summary || {}) },
    mentionRank: arrayOr(["mentionRank", "mentions", "rankings"], fallback.mentionRank),
    sentiment: arrayOr(["sentiment", "sentiments"], fallback.sentiment),
    sources: arrayOr(["sources", "citations"], fallback.sources),
    dialogs: arrayOr(["dialogs", "conversations", "records"], fallback.dialogs),
    works: arrayOr(["works", "artifacts"], fallback.works),
    settings: { ...fallback.settings, ...(source.settings || {}) },
    questionBank: arrayOr(["questionBank", "questions"], fallback.questionBank),
    source: source.source || "monitoring-analytics-api"
  };
}

async function refreshEffectMonitoringAnalytics({ planId = ui.effectMonitorPlanId, range = ui.effectMonitorRange, renderAfter = false } = {}) {
  if (effectMonitoringAnalyticsSnapshot.loading) return effectMonitoringAnalyticsSnapshot;
  if (!planId) {
    effectMonitoringAnalyticsSnapshot = { ...effectMonitoringAnalyticsSnapshot, attempted: true, loaded: true, loading: false, planId: null, data: null, error: "", loadedAt: Date.now() };
    if (renderAfter && currentRoute() === "effect-monitor") render();
    return effectMonitoringAnalyticsSnapshot;
  }
  effectMonitoringAnalyticsSnapshot = { ...effectMonitoringAnalyticsSnapshot, attempted: true, loading: true, planId, error: "" };
  const plan = effectMonitoringSnapshot.activePlan?.id === planId ? effectMonitoringSnapshot.activePlan : effectMonitoringSnapshot.plans.find((item) => String(item.id) === String(planId)) || null;
  const fallback = effectMonitorLocalAnalytics(plan);
  try {
    const payload = await productionApi(`/api/v1/diagnostics/monitoring/analytics?planId=${encodeURIComponent(planId)}&range=${encodeURIComponent(range || "30")}`);
    const data = effectMonitorNormalizeAnalytics(effectRelayData(payload), fallback);
    effectMonitoringAnalyticsSnapshot = { ...effectMonitoringAnalyticsSnapshot, loaded: true, loading: false, planId, data, error: "", loadedAt: Date.now() };
  } catch (error) {
    // Older customer servers may not expose the aggregate endpoint yet. The
    // fallback is still derived exclusively from synchronized live evidence;
    // it never manufactures KPI values.
    const hasLocalEvidence = Number(fallback?.overview?.delivered || 0) > 0;
    effectMonitoringAnalyticsSnapshot = { ...effectMonitoringAnalyticsSnapshot, loaded: true, loading: false, planId, data: fallback, error: hasLocalEvidence ? "聚合接口暂不可用，当前显示客户服务端已验收的 live evidence。" : (error.message || "监测聚合数据暂不可用"), loadedAt: Date.now() };
  }
  if (renderAfter && currentRoute() === "effect-monitor") render();
  return effectMonitoringAnalyticsSnapshot;
}

function invalidateEffectMonitorDraft() {
  ui.effectMonitorProjectId = null;
  ui.effectMonitorQuestionSetId = null;
  ui.effectMonitorProjectSignature = "";
  ui.effectMonitorFrozenQuestions = [];
}

async function refreshEffectMonitoring({ planId = ui.effectMonitorPlanId, renderAfter = false } = {}) {
  if (effectMonitoringSnapshot.loading) return effectMonitoringSnapshot;
  effectMonitoringSnapshot = { ...effectMonitoringSnapshot, attempted: true, loading: true, error: "" };
  try {
    const payload = await productionApi("/api/v1/diagnostics/monitoring-plans?limit=100");
    const plans = diagnosticApiItems(payload, ["items"]);
    const selectedId = planId || ui.effectMonitorPlanId || plans[0]?.id || "";
    let activePlan = plans.find((plan) => plan.id === selectedId) || null;
    if (selectedId) {
      const detailPayload = await productionApi(`/api/v1/diagnostics/monitoring-plans/${encodeURIComponent(selectedId)}?includeRuns=true&runLimit=100`);
      activePlan = effectRelayData(detailPayload).plan || activePlan;
    }
    const runs = Array.isArray(activePlan?.runs) ? activePlan.runs : [];
    ui.effectMonitorPlanId = activePlan?.id || null;
    effectMonitoringSnapshot = { ...effectMonitoringSnapshot, loaded: true, loading: false, plans, activePlan, runs, error: "", loadedAt: Date.now() };
    if (activePlan?.id) await refreshEffectMonitoringAnalytics({ planId: activePlan.id, renderAfter: false });
    else effectMonitoringAnalyticsSnapshot = { ...effectMonitoringAnalyticsSnapshot, attempted: true, loaded: true, loading: false, planId: null, data: null, error: "", loadedAt: Date.now() };
  } catch (error) {
    effectMonitoringSnapshot = { ...effectMonitoringSnapshot, loading: false, loaded: false, error: error.message || "品牌监测计划读取失败", loadedAt: Date.now() };
  }
  if (renderAfter && currentRoute() === "effect-monitor") render();
  return effectMonitoringSnapshot;
}

async function ensureEffectMonitorProject() {
  const brand = effectMonitorBrandProfile();
  const questionTexts = effectMonitorQuestionList();
  const signature = effectMonitorInputSignature();
  if (ui.effectMonitorProjectId && ui.effectMonitorQuestionSetId && ui.effectMonitorProjectSignature === signature) {
    return { projectId: ui.effectMonitorProjectId, questionSetId: ui.effectMonitorQuestionSetId, questions: ui.effectMonitorFrozenQuestions };
  }
  const createdAt = Date.now();
  const frozenQuestions = questionTexts.map((text, index) => ({
    id: `effect-monitor-q-${createdAt}-${index + 1}`,
    text,
    type: "aidso_brand_monitoring",
    source: "customer_input"
  }));
  const payload = await productionApi("/api/v1/diagnostics/projects", {
    method: "POST",
    body: {
      name: `品牌监测 · ${brand.name}`,
      diagnosticType: "comprehensive",
      industry: ui.effectMonitorIndustry || "未填写行业",
      targetBrand: brand.name,
      websiteUrl: String(ui.effectMonitorSite || "").trim(),
      objective: `建立 ${brand.name} 的周期性品牌监测计划，并将每次真实采样保留为可追溯检测证据。`,
      scope: {
        source: "effect_monitor",
        feature: "aidso_brand_monitoring",
        aidsoProduct: "monitor",
        mode: "scheduled_frozen_question_set",
        customerUi: true,
        brandAliases: brand.aliases,
        competitors: effectMonitorCompetitorLabels(),
        platformScopes: ui.effectMonitorScopes,
        modes: ui.effectMonitorModes
      },
      questionSetSnapshot: { name: `${brand.name} 品牌监测问题集`, version: 1, frozenAt: new Date().toISOString(), questions: frozenQuestions }
    }
  });
  const data = effectRelayData(payload);
  const project = data.project || diagnosticApiEntity(payload, ["project"]);
  const questionSet = data.questionSet || null;
  if (!project?.id || !questionSet?.id) throw new Error("品牌监测项目未返回冻结问题集。");
  ui.effectMonitorProjectId = project.id;
  ui.effectMonitorQuestionSetId = questionSet.id;
  ui.effectMonitorProjectSignature = signature;
  ui.effectMonitorFrozenQuestions = Array.isArray(questionSet.questions) ? questionSet.questions : frozenQuestions;
  effectRelaySnapshot.projects = [project, ...effectRelaySnapshot.projects.filter((item) => item.id !== project.id)];
  return { projectId: project.id, questionSetId: questionSet.id, questions: ui.effectMonitorFrozenQuestions };
}

async function createEffectMonitorPlan() {
  if (ui.effectMonitorCreating) return;
  const brand = document.getElementById("effect-monitor-brand")?.value.trim();
  const aliases = document.getElementById("effect-monitor-aliases")?.value;
  const site = document.getElementById("effect-monitor-site")?.value.trim();
  const industry = document.getElementById("effect-monitor-industry")?.value.trim();
  const questionInput = document.getElementById("effect-monitor-questions")?.value;
  const competitorInput = document.getElementById("effect-monitor-competitors")?.value;
  const authorizationReference = document.getElementById("effect-monitor-authorization-reference")?.value.trim();
  const maximumCredits = Number(document.getElementById("effect-monitor-max-credits")?.value || ui.effectMonitorMaxCredits);
  const maximumMonthlyCredits = Number(document.getElementById("effect-monitor-max-monthly-credits")?.value || ui.effectMonitorMaxMonthlyCredits || 0);
  const intervalHours = Number(document.getElementById("effect-monitor-interval-hours")?.value || ui.effectMonitorIntervalHours);
  const consent = Boolean(document.querySelector("[data-effect-monitor-consent]")?.checked || ui.effectMonitorExternalConsent);
  const questions = effectMonitorQuestionList(questionInput);
  if (!brand || !questions.length) return showToast("监测配置不完整", "请填写目标品牌和至少一个监测问题。", "error");
  if (!(ui.effectMonitorScopes || []).length || !(ui.effectMonitorModes || []).length) return showToast("请选择监测能力", "请选择当前客户实例获准的平台终端与模式。", "error");
  if (!Number.isInteger(maximumCredits) || maximumCredits < 1) return showToast("请填写单次积分上限", "监测计划会在每次执行前重新报价，超过该上限将自动进入待处理状态。", "error");
  if (!Number.isInteger(maximumMonthlyCredits) || maximumMonthlyCredits < 0) return showToast("请填写月度积分上限", "月度上限不能小于 0，填写 0 表示不额外限制。", "error");
  if (ui.effectMonitorCadence === "interval" && (!Number.isInteger(intervalHours) || intervalHours < 24)) return showToast("间隔至少为 24 小时", "周期监测不能低于每天一次。", "error");
  if (!authorizationReference || !consent) return showToast("需要自动执行授权", "周期计划需确认外部数据执行范围，并填写可追溯的授权编号或工单号。", "error");
  ui.effectMonitorBrand = brand;
  ui.effectMonitorAliases = effectMonitorAliases([brand, ...effectSearchBrandTerms(aliases)]);
  ui.effectMonitorSite = site;
  ui.effectMonitorIndustry = industry;
  ui.effectMonitorQuestions = questions.map((text, index) => ({ id: `monitor-input-${index + 1}`, text }));
  ui.effectMonitorCompetitors = String(competitorInput || "").split(/\r?\n/).map((line, index) => {
    const [name, terms = ""] = line.split(/[：:]/, 2);
    return { id: `monitor-competitor-${index + 1}`, name: String(name || "").trim(), terms: String(terms || "").trim() };
  }).filter((item) => item.name);
  ui.effectMonitorAuthorizationReference = authorizationReference;
  ui.effectMonitorMaxCredits = String(maximumCredits);
  ui.effectMonitorMaxMonthlyCredits = String(maximumMonthlyCredits);
  ui.effectMonitorIntervalHours = String(intervalHours || 24);
  ui.effectMonitorExternalConsent = true;
  ui.effectMonitorCreating = true;
  render();
  try {
    const project = await ensureEffectMonitorProject();
    const items = effectRelaySupportedItems(ui.effectMonitorScopes, ui.effectMonitorModes, project.questions, { source: "effect_monitor", feature: "aidso_brand_monitoring" });
    if (!items.length) throw new Error("当前客户实例没有可执行的监测能力组合。");
    const platforms = [...new Set(items.map((item) => item.platform))];
    const terminals = [...new Set(items.map((item) => item.terminal))];
    const modes = [...new Set(items.map((item) => item.mode))];
    const user = window.__TZ_AUTH__?.user || {};
    const authorization = {
      externalDataConsent: true,
      authorizationReference,
      authorizedBy: user.displayName || user.name || user.username || "customer-monitoring-operator",
      consentedAt: new Date().toISOString(),
      method: "effect_monitor_user_confirm",
      ...(ui.effectMonitorAuthorizationExpiresAt ? { expiresAt: ui.effectMonitorAuthorizationExpiresAt } : {})
    };
    const schedule = {
      ...(ui.effectMonitorCadence === "interval"
        ? { cadence: "interval", intervalHours }
        : { cadence: ui.effectMonitorCadence }),
      startAt: new Date().toISOString(),
      timeZone: "Asia/Shanghai"
    };
    const payload = await productionApi("/api/v1/diagnostics/monitoring-plans", {
      method: "POST",
      body: {
        name: `品牌监测 · ${brand}`,
        projectId: project.projectId,
        questionSetId: project.questionSetId,
        items,
        platforms,
        terminals,
        modes,
        brand: effectMonitorBrandProfile(),
        competitors: effectMonitorCompetitorLabels(),
        analysisScope: {
          source: "effect_monitor",
          feature: "aidso_brand_monitoring",
          aidsoProduct: "monitor",
          mode: "scheduled_frozen_question_set",
          industry,
          websiteUrl: site,
          questionCount: project.questions.length
        },
        schedule,
        authorization,
        budget: { maxCreditsPerRun: maximumCredits, maxMonthlyCredits: maximumMonthlyCredits },
        maxCreditsPerRun: maximumCredits,
        maxMonthlyCredits: maximumMonthlyCredits
      }
    });
    const plan = effectRelayData(payload).plan || null;
    ui.effectMonitorPlanId = plan?.id || null;
    showToast("品牌监测计划已创建", "计划会在每次执行前重新报价；超出单次上限、授权到期或连续失败会停止自动扣费并进入待处理状态。", "success");
    await Promise.all([refreshEffectMonitoring({ planId: ui.effectMonitorPlanId }), refreshEffectRelay()]);
  } catch (error) {
    showToast("品牌监测计划未创建", error.message || "请检查监测授权和能力范围。", "error");
  } finally {
    ui.effectMonitorCreating = false;
    render();
  }
}

async function operateEffectMonitorPlan(action, planId = ui.effectMonitorPlanId) {
  if (!planId || effectMonitoringSnapshot.operating) return;
  const labels = { run: "立即执行", pause: "暂停", resume: "恢复" };
  if (action === "run" && !await uiConfirm("立即执行会消耗本次重新报价后的积分，且不得超过计划的单次上限。确认执行？")) return;
  if (action === "pause" && !await uiConfirm("确认暂停该品牌监测计划？已经提交的检测任务不会被静默取消。")) return;
  if (action === "resume" && !await uiConfirm("确认恢复自动监测？系统会使用已保存的授权和单次积分上限。")) return;
  effectMonitoringSnapshot = { ...effectMonitoringSnapshot, operating: true, error: "" };
  render();
  try {
    const body = action === "run" || action === "resume" ? { confirmExternalExecution: true } : {};
    await productionApi(`/api/v1/diagnostics/monitoring-plans/${encodeURIComponent(planId)}/${action}`, { method: "POST", body });
    await Promise.all([refreshEffectMonitoring({ planId }), refreshEffectRelay()]);
    showToast(`计划已${labels[action] || "更新"}`, action === "run" ? "已创建本次监测运行，结果会在客户服务端验签写入 live evidence 后展示。" : "监测计划状态已更新。", "success");
  } catch (error) {
    showToast(`无法${labels[action] || "操作"}计划`, error.message || "请稍后重试。", "error");
  } finally {
    effectMonitoringSnapshot = { ...effectMonitoringSnapshot, operating: false };
    render();
  }
}

function effectMonitorTrendRows(records) {
  const groups = new Map();
  for (const record of records.filter((record) => record.status === "verified")) {
    const key = [record.questionId || record.question, record.platform, record.terminal, record.mode].join("|");
    const samples = groups.get(key) || [];
    samples.push(record);
    groups.set(key, samples);
  }
  return [...groups.values()].filter((samples) => samples.length >= 2).map((samples) => {
    const ordered = samples.slice().sort((left, right) => String(left.observedAt || "").localeCompare(String(right.observedAt || "")));
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    const mentionRate = Math.round((ordered.filter((record) => Number(record.brandMentionCount || 0) > 0).length / ordered.length) * 100);
    return { first, latest, samples: ordered.length, mentionRate, citations: ordered.reduce((sum, record) => sum + Number(record.citationSources?.length || 0), 0) };
  }).sort((left, right) => right.samples - left.samples);
}

function effectMonitorPlanCard(plan, activePlan) {
  const schedule = plan?.schedule || {};
  const cadence = schedule.cadence === "interval" ? `每 ${schedule.intervalHours} 小时` : ({ daily: "每天", weekly: "每周", monthly: "每月" })[schedule.cadence] || "未设置";
  const active = plan.id === activePlan?.id;
  const statusClass = plan.status === "active" ? "status-approved" : plan.status === "paused" ? "status-draft" : "status-error";
  return `<article class="effect-monitor-plan-row ${active ? "active" : ""}"><div><b>${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.project?.targetBrand || "目标品牌")} · ${escapeHtml(cadence)} · ${plan.questionSet?.questionCount || 0} 个冻结问题</small></div><span class="status-badge ${statusClass}">${escapeHtml(plan.status === "active" ? "监测中" : plan.status === "paused" ? "已暂停" : "待处理")}</span><button class="link-button" type="button" data-action="effect-monitor-select-plan" data-effect-plan-id="${escapeHtml(plan.id)}">${active ? "当前计划" : "查看"}</button></article>`;
}

function effectMonitorPlanDetail(plan = effectMonitoringSnapshot.activePlan) {
  if (!plan) return `<section class="card effect-monitor-detail"><div class="effect-search-empty">尚未创建品牌监测计划。创建后系统才会按固定问题集和能力范围做周期性真实采样。</div></section>`;
  const runs = Array.isArray(plan.runs) ? plan.runs : effectMonitoringSnapshot.runs || [];
  const records = monitoringPlanRecords(plan);
  const verified = records.filter((record) => record.status === "verified");
  const mentionRate = verified.length ? Math.round((verified.filter((record) => Number(record.brandMentionCount || 0) > 0).length / verified.length) * 100) : null;
  const citations = verified.reduce((sum, record) => sum + Number(record.citationSources?.length || 0), 0);
  const trends = effectMonitorTrendRows(records);
  const liveEntries = monitoringPlanEntries(plan);
  return `<section class="card effect-monitor-detail"><header><div><h3>${escapeHtml(plan.name)}</h3><p>计划每次运行都会独立报价、创建检测任务，并将交付写入新的实时检测证据；历史样本不会被覆盖。</p></div><div class="effect-monitor-actions">${plan.status === "active" ? `<button class="secondary-button" type="button" data-action="effect-monitor-run" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>${icon("play")}立即运行</button><button class="secondary-button" type="button" data-action="effect-monitor-pause" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>暂停计划</button>` : plan.status === "paused" ? `<button class="primary-button" type="button" data-action="effect-monitor-resume" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>恢复计划</button>` : ""}</div></header><div class="effect-search-summary"><div><small>计划状态</small><b>${escapeHtml(plan.status === "active" ? "监测中" : plan.status)}</b><em>下次：${escapeHtml(String(plan.nextRunAt || "待安排").replace("T", " ").slice(0, 16))}</em></div><div><small>历史运行</small><b>${runs.length}</b><em>每次都是独立任务快照</em></div><div><small>已验证样本</small><b>${verified.length}</b><em>${mentionRate === null ? "暂无可计算样本" : `品牌提及率 ${mentionRate}%`}</em></div><div><small>回答引用</small><b>${citations}</b><em>仅统计已验证结果</em></div></div><div class="effect-monitor-boundary">趋势只在同一问题、同一平台、同一终端、同一模式至少积累两条已验证的实时检测证据后展示；没有真实样本时保持为空，不生成排名、情感或预测曲线。</div><div class="effect-monitor-trend-list">${trends.length ? trends.map((trend) => `<article><div><b>${escapeHtml(trend.latest.platform)} · ${escapeHtml(trend.latest.terminal)} · ${escapeHtml(trend.latest.mode)}</b><small>${escapeHtml(trend.latest.question)}</small></div><span><small>已验证样本</small><b>${trend.samples}</b></span><span><small>品牌提及率</small><b>${trend.mentionRate}%</b></span><span><small>回答引用</small><b>${trend.citations}</b></span></article>`).join("") : `<div class="effect-search-empty">暂无可计算的真实趋势。请等待同一采样条件至少完成两次已验证交付。</div>`}</div><div class="effect-monitor-run-list"><h4>计划运行记录</h4>${runs.length ? runs.map((run) => { const entry = liveEntries.find((item) => item.link?.diagnosticRunId === run.diagnosticRunId); const stats = entry ? effectRelayEntryStats(entry) : { delivered: 0, verified: 0 }; return `<article><div><b>${escapeHtml(run.triggerKind === "manual" ? "手动运行" : "计划运行")} · ${escapeHtml(String(run.scheduledFor || run.createdAt || "").replace("T", " ").slice(0, 16))}</b><small>${escapeHtml(effectRelayRunLabel(run.status))}${run.errorMessage ? ` · ${escapeHtml(run.errorMessage)}` : ""}</small></div><span>${stats.delivered} 条交付 / ${stats.verified} 条已验证</span><span>${run.estimatedCustomerCredits === null ? "未结算" : `${Number(run.estimatedCustomerCredits).toLocaleString("zh-CN")} 积分`}</span></article>`; }).join("") : `<div class="effect-search-empty">计划尚未产生真实运行记录。</div>`}</div></section>`;
}

function effectMonitorAnalyticsCards(data = {}, view = "dashboard") {
  // The analytics request is independent from plan loading. During the
  // initial render or a plan switch it can legitimately be null; render an
  // empty read model until the response arrives instead of throwing.
  data = data && typeof data === "object" ? data : {};
  const overview = data.overview && typeof data.overview === "object" ? data.overview : {};
  const cardsByView = {
    dashboard: [
      ["品牌得分", "—", "检测服务未返回正式评分口径"],
      ["对话次数", effectMonitorNumber(overview.dialogCount ?? overview.verified), "已验证 AI 对话"],
      ["提及对话次数", effectMonitorNumber(overview.mentionDialogCount), "回答中明确提及品牌"],
      ["提及率", effectMonitorPercent(overview.mentionRate), "提及对话 / 可判断对话"],
      ["品牌提及次数", effectMonitorNumber(overview.brandMentionCount), "品牌和别名出现总次数"],
      ["SOV", effectMonitorPercent(overview.sov), "缺少竞品份额口径时显示 —"],
      ["Top1 提及率", effectMonitorPercent(overview.top1MentionRate), "仅使用上游排名字段"],
      ["Top3 提及率", effectMonitorPercent(overview.top3MentionRate), "仅使用上游排名字段"],
      ["平均提及排名", overview.averageMentionRank == null ? "—" : `#${overview.averageMentionRank}`, "不从文本位置推断排名"],
      ["品牌提及好感度", effectMonitorPercent(overview.brandFavorability), "仅使用上游情感字段"]
    ],
    mentions: [
      ["对话次数", effectMonitorNumber(overview.dialogCount ?? overview.verified), "已验证 AI 对话"],
      ["提及对话次数", effectMonitorNumber(overview.mentionDialogCount), "明确提及品牌的对话"],
      ["提及率", effectMonitorPercent(overview.mentionRate), "提及对话 / 可判断对话"],
      ["Top1 提及率", effectMonitorPercent(overview.top1MentionRate), "上游排名字段"],
      ["Top3 提及率", effectMonitorPercent(overview.top3MentionRate), "上游排名字段"],
      ["品牌提及次数", effectMonitorNumber(overview.brandMentionCount), "品牌和别名出现总次数"],
      ["平均提及排名", overview.averageMentionRank == null ? "—" : `#${overview.averageMentionRank}`, "没有排名字段则为空"]
    ],
    sentiment: [
      ["提及品牌 AI 对话次数", effectMonitorNumber(overview.mentionDialogCount), "明确提及品牌的对话"],
      ["品牌提及好感度", effectMonitorPercent(overview.brandFavorability), "仅使用上游标准化情感"],
      ...(["正面", "中性", "负面"].map((label) => { const row = (data.sentiment || []).find((item) => String(item.label || "").includes(label)); return [`${label}情感`, effectMonitorPercent(row?.rate), "无情感字段时显示 —"]; }))
    ],
    sources: [
      ["引用文章数", effectMonitorNumber(overview.citationArticleCount), "具有 URL 的唯一引用来源"],
      ["引用次数", effectMonitorNumber(overview.citations), "已验证回答中的引用总数"],
      ["引用站点", effectMonitorNumber(overview.sourceCount), "唯一引用来源数量"]
    ],
    works: [
      ["追踪作品数", effectMonitorNumber((data.works || []).length), "当前引用作品记录"],
      ["引用作品数", effectMonitorNumber(overview.citationArticleCount), "被 AI 引用的 URL"],
      ["引用 AI 问题数", effectMonitorNumber(new Set((data.dialogs || []).filter((row) => row.citationSources?.length).map((row) => row.questionId || row.question)).size), "产生引用的问题数量"],
      ["引用次数", effectMonitorNumber(overview.citations), "已验证回答中的引用总数"]
    ]
  };
  const cards = cardsByView[view] || cardsByView.dashboard;
  return `<div class="effect-monitor-analytics-cards">${cards.map(([label, value, note]) => `<article><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b><em>${escapeHtml(note)}</em></article>`).join("")}</div>`;
}

function effectMonitorDashboardViewLegacy(plan, data) {
  const overview = data?.overview || {};
  const trendRows = (Array.isArray(data?.mentionRank) ? data.mentionRank : []).slice(0, 6);
  return `<section class="effect-monitor-dashboard-view"><section class="effect-monitor-hero card"><div><h2>${escapeHtml(plan?.project?.targetBrand || ui.effectMonitorBrand || "品牌监测")}</h2><p>数据来自当前监测计划的已验证结果；空字段保持“—”，不生成模拟 KPI。</p></div><div class="effect-monitor-hero-meta"><span class="status-badge ${plan?.status === "active" ? "status-approved" : "status-pending"}">${escapeHtml(plan ? (plan.status === "active" ? "监测中" : plan.status || "待配置") : "未创建计划")}</span><small>最近采样：${escapeHtml(effectMonitorDisplay(overview.lastObservedAt ? formatDateTime(overview.lastObservedAt) : null))}</small></div></section>${data ? effectMonitorAnalyticsCards(data, "dashboard") : effectMonitorEmptyState("尚未选择监测计划。")}<section class="effect-monitor-dashboard-grid"><article class="card effect-monitor-dashboard-panel"><header><div><h3>平台提及与排名</h3><p>仅展示检测结果明确返回的字段。</p></div><button type="button" class="link-button" data-action="effect-monitor-view" data-view="mentions">查看明细</button></header>${trendRows.length ? `<div class="effect-monitor-mini-table">${trendRows.map((row) => `<div><b>${escapeHtml(row.platform || "—")}</b><small>${escapeHtml(row.terminal || "—")}</small><span>${effectMonitorPercent(row.mentionRate)}</span><em>${row.averageRank === null || row.averageRank === undefined ? "—" : `#${escapeHtml(row.averageRank)}`}</em></div>`).join("")}</div>` : effectMonitorEmptyState("暂无平台提及或排名数据。")}</article><article class="card effect-monitor-dashboard-panel"><header><div><h3>监测计划运行</h3><p>计划操作由灼见检测服务安全执行。</p></div><button type="button" class="link-button" data-action="effect-monitor-view" data-view="settings">管理设置</button></header>${plan ? `<div class="effect-monitor-run-summary"><b>${escapeHtml(plan.name || "品牌监测计划")}</b><span>周期：${escapeHtml(effectMonitorDisplay(plan.schedule?.cadence || plan.schedule?.intervalHours ? (plan.schedule.cadence === "interval" ? `每 ${plan.schedule.intervalHours} 小时` : plan.schedule.cadence) : null))}</span><span>下次运行：${escapeHtml(effectMonitorDisplay(plan.nextRunAt ? formatDateTime(plan.nextRunAt) : null))}</span></div>` : effectMonitorEmptyState("暂无监测计划，请先在监测设置中创建。")}</article></section>${plan ? effectMonitorPlanDetail(plan) : ""}</section>`;
}

/*
 * 品牌监测 Demo 对齐骨架。
 * 趋势、告警、平台状态和归档只从当前计划的真实 evidence、聚合接口
 * 和服务端运行记录读取；无法复核的字段保持为空，不补演示数值。
 */
function effectMonitorDashboardRecords(data, plan) {
  const source = Array.isArray(data?.records) && data.records.length
    ? data.records
    : Array.isArray(data?.dialogs) && data.dialogs.length
      ? data.dialogs
      : monitoringPlanRecords(plan);
  return source.filter((record) => record && typeof record === "object");
}

function effectMonitorDashboardRange(records, range = ui.effectMonitorRange) {
  const days = Number(range);
  const dated = records.filter((record) => record.observedAt && Number.isFinite(Date.parse(record.observedAt)));
  if (!Number.isFinite(days) || days <= 0 || !dated.length) return dated;
  const latest = Math.max(...dated.map((record) => Date.parse(record.observedAt)));
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return dated.filter((record) => Date.parse(record.observedAt) >= cutoff);
}

function effectMonitorDashboardTrend(records) {
  const bucket = new Map();
  records.filter((record) => record.status === "verified" && record.observedAt).forEach((record) => {
    const day = String(record.observedAt).slice(0, 10);
    const row = bucket.get(day) || { day, samples: 0, mentioned: 0 };
    row.samples += 1;
    row.mentioned += Number(record.brandMentionCount || 0) > 0 ? 1 : 0;
    bucket.set(day, row);
  });
  return [...bucket.values()]
    .map((row) => ({ ...row, rate: row.samples ? Math.round(row.mentioned / row.samples * 100) : null }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

function effectMonitorCadenceLabel(plan) {
  const schedule = plan?.schedule || {};
  if (schedule.cadence === "interval") return schedule.intervalHours ? `每 ${schedule.intervalHours} 小时` : "自定义间隔";
  return ({ daily: "每天", weekly: "每周", monthly: "每月" })[schedule.cadence] || "—";
}

function effectMonitorTaskCard(plan) {
  const latestEntry = monitoringPlanEntries(plan)[0] || null;
  const monitoringError = effectMonitoringSnapshot.error || effectMonitoringAnalyticsSnapshot.error || "";
  if (!plan) {
    return `<section class="card effect-monitor-task-card"><header><div><h2>品牌监测范围</h2><p>尚未创建服务端监测计划，因此不会显示模拟趋势或告警。</p></div><button class="primary-button" type="button" data-action="effect-monitor-view" data-view="settings">创建监测计划</button></header>${effectMonitorEmptyState("请先冻结问题集、能力范围、周期及授权。")}</section>`;
  }
  const active = plan.status === "active";
  const action = active
    ? `<button class="secondary-button" type="button" data-action="effect-monitor-run" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>${icon("play")}立即运行</button><button class="secondary-button" type="button" data-action="effect-monitor-pause" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>暂停计划</button>`
    : plan.status === "paused"
      ? `<button class="primary-button" type="button" data-action="effect-monitor-resume" data-effect-plan-id="${escapeHtml(plan.id)}" ${effectMonitoringSnapshot.operating ? "disabled" : ""}>恢复计划</button>`
      : `<button class="secondary-button" type="button" data-action="effect-monitor-view" data-view="settings">查看设置</button>`;
  return `<section class="card effect-monitor-task-card"><header><div><h2>${escapeHtml(plan.project?.targetBrand || plan.name || "品牌监测")}</h2><p>固定问题集、能力范围和授权均由当前服务端计划保存；每次运行产生独立的真实证据快照。</p></div><div class="effect-monitor-actions">${action}</div></header><div class="effect-monitor-task-meta"><span>状态：<b>${escapeHtml(active ? "监测中" : plan.status || "—")}</b></span><span>周期：<b>${escapeHtml(effectMonitorCadenceLabel(plan))}</b></span><span>冻结问题：<b>${escapeHtml(plan.questionSet?.questionCount ?? plan.questionSet?.questions?.length ?? "—")}</b></span><span>下次运行：<b>${escapeHtml(plan.nextRunAt ? formatDateTime(plan.nextRunAt) : "—")}</b></span></div><label class="effect-monitor-range-control">时间范围<select data-effect-monitor-range><option value="7" ${String(ui.effectMonitorRange) === "7" ? "selected" : ""}>近 7 天</option><option value="30" ${String(ui.effectMonitorRange) === "30" ? "selected" : ""}>近 30 天</option><option value="90" ${String(ui.effectMonitorRange) === "90" ? "selected" : ""}>近 90 天</option></select></label><div class="effect-monitor-task-status">${effectRelayStatusPanel({ flow: "monitoring", entry: latestEntry, scopes: ui.effectMonitorScopes, modes: ui.effectMonitorModes, questions: effectMonitorDraftQuestions() })}</div>${monitoringError ? `<p class="effect-monitor-inline-notice" role="status">${icon("alert")}${escapeHtml(customerFacingEffectText(monitoringError))}</p>` : ""}</section>`;
}

function effectMonitorTrendPanel(trend) {
  if (trend.length < 2) {
    return `<section class="card effect-monitor-trend-panel"><header><div><h3>品牌提及率趋势</h3><p>按已验证 AI 对话逐日聚合，不把单次回答当作趋势。</p></div></header>${effectMonitorEmptyState("当前范围内至少需要两个有日期的已验证采样日，才能绘制真实趋势。")}</section>`;
  }
  const width = 820;
  const point = (row, index) => ({ x: 48 + index * (732 / (trend.length - 1)), y: 24 + (100 - row.rate) * 1.18 });
  const points = trend.map(point);
  const path = points.map((item, index) => `${index ? "L" : "M"} ${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} 150 L ${points[0].x.toFixed(1)} 150 Z`;
  const average = trend.reduce((sum, row) => sum + row.rate, 0) / trend.length;
  const averageY = (24 + (100 - average) * 1.18).toFixed(1);
  const previous = trend[trend.length - 2].rate;
  const latest = trend[trend.length - 1].rate;
  const delta = latest - previous;
  const deltaText = `${delta > 0 ? "↑ +" : delta < 0 ? "↓ " : "— "}${delta === 0 ? "持平" : `${delta}pp`}`;
  return `<section class="card effect-monitor-trend-panel"><header><div><h3>品牌提及率趋势</h3><p>${escapeHtml(`${trend.length} 个真实采样日 · 仅统计已验证 AI 对话`)}</p></div><strong class="${delta < 0 ? "is-down" : delta > 0 ? "is-up" : ""}">${escapeHtml(deltaText)}</strong></header><div class="effect-monitor-real-chart"><svg viewBox="0 0 ${width} 180" role="img" aria-label="品牌提及率真实趋势"><defs><linearGradient id="effect-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--blue)" stop-opacity=".22"/><stop offset="1" stop-color="var(--blue)" stop-opacity="0"/></linearGradient></defs><line x1="40" y1="24" x2="780" y2="24" class="grid"/><line x1="40" y1="83" x2="780" y2="83" class="grid"/><line x1="40" y1="142" x2="780" y2="142" class="grid"/><text x="32" y="28">100%</text><text x="32" y="87">50%</text><text x="32" y="146">0%</text><line class="trend-average" x1="40" y1="${averageY}" x2="780" y2="${averageY}"/><text class="trend-average-label" x="784" y="${averageY}">${escapeHtml(`均值 ${Math.round(average)}%`)}</text><path class="trend-area" d="${areaPath}" fill="url(#effect-trend-fill)"/><path class="trend-line" d="${path}"/>${points.map((item, index) => `<g class="trend-point-group" data-effect-trend-point data-tip="${escapeHtml(`${trend[index].day} · 提及率 ${trend[index].rate}%（${trend[index].mentioned}/${trend[index].samples}）`)}" tabindex="0"><circle class="trend-hit" cx="${item.x}" cy="${item.y}" r="12"/><circle class="trend-point" cx="${item.x}" cy="${item.y}" r="3.5"/><text x="${item.x}" y="170" text-anchor="middle">${escapeHtml(trend[index].day.slice(5))}</text></g>`).join("")}</svg></div></section>`;
}

function effectMonitorAlertRows(data, trend, runs) {
  const serverAlerts = Array.isArray(data?.alerts) ? data.alerts.filter((row) => row && (row.title || row.message || row.label)) : [];
  if (serverAlerts.length) return serverAlerts.map((row) => ({ level: row.level || row.severity || "info", title: row.title || row.label || row.message, detail: row.detail || row.message || row.observedAt || "服务端告警", value: row.value ?? row.delta ?? null }));
  const actualFailures = runs.filter((run) => run?.errorMessage).map((run) => ({ level: "warn", title: `${run.triggerKind === "manual" ? "手动运行" : "计划运行"}未完成`, detail: `${run.errorMessage} · ${run.scheduledFor || run.createdAt || "未记录时间"}`, value: null }));
  if (trend.length >= 2) {
    const previous = trend[trend.length - 2];
    const latest = trend[trend.length - 1];
    const delta = latest.rate - previous.rate;
    if (Math.abs(delta) >= 5) actualFailures.unshift({ level: "warn", title: `提及率较上一采样日${delta > 0 ? "上升" : "下降"} ${Math.abs(delta)}pp`, detail: `${latest.day} · ${latest.mentioned}/${latest.samples} 条已验证对话提及品牌`, value: `${delta > 0 ? "+" : ""}${delta}pp` });
  }
  return actualFailures;
}

function effectMonitorPlatformRows(data, records) {
  const recent = new Map();
  records.filter((record) => record.platform).forEach((record) => {
    const key = `${record.platform}|${record.terminal || "—"}`;
    if (!recent.has(key) || String(record.observedAt || "") > String(recent.get(key).observedAt || "")) recent.set(key, record);
  });
  const fromApi = Array.isArray(data?.mentionRank) ? data.mentionRank.filter((row) => row && row.platform) : [];
  const aggregate = new Map();
  records.filter((record) => record.status === "verified" && record.platform).forEach((record) => {
    const key = `${record.platform}|${record.terminal || "—"}`;
    const row = aggregate.get(key) || { platform: record.platform, terminal: record.terminal || "—", samples: 0, mentioned: 0, citations: 0 };
    row.samples += 1;
    row.mentioned += Number(record.brandMentionCount || 0) > 0 ? 1 : 0;
    row.citations += Number(record.citationSources?.length || 0);
    aggregate.set(key, row);
  });
  const fallback = [...aggregate.values()].map((row) => ({ ...row, mentionRate: row.samples ? Math.round(row.mentioned / row.samples * 100) : null }));
  return (fromApi.length ? fromApi : fallback).map((row) => {
    const latest = recent.get(`${row.platform}|${row.terminal || "—"}`);
    return { ...row, latestStatus: latest?.status || null, lastObservedAt: latest?.observedAt || null };
  });
}

function effectMonitorAlertsPanel(rows) {
  return `<section class="card effect-monitor-alert-panel"><header><div><h3>异常告警 · ${rows.length}</h3><p>仅显示服务端告警或可复核的真实运行、真实波动。</p></div></header>${rows.length ? `<div class="effect-monitor-alert-list">${rows.map((row) => `<article class="${escapeHtml(row.level)}"><div><b>${escapeHtml(row.title)}</b><small>${escapeHtml(row.detail)}</small></div>${row.value === null || row.value === undefined ? "" : `<strong>${escapeHtml(row.value)}</strong>`}</article>`).join("")}</div>` : effectMonitorEmptyState("当前范围没有服务端告警，也没有达到阈值的真实运行异常。")}</section>`;
}

function effectMonitorPlatformsPanel(rows) {
  return `<section class="card effect-monitor-platform-panel"><header><div><h3>各平台当前状态</h3><p>提及率来自聚合数据；状态来自最近一条真实检测记录。</p></div></header>${rows.length ? `<div class="effect-monitor-platform-cards">${rows.map((row) => { const rate = row.mentionRate === null || row.mentionRate === undefined ? null : Number(row.mentionRate); const statusText = row.latestStatus || "—"; const statusTone = statusText === "verified" ? "ok" : statusText === "—" ? "idle" : "warn"; return `<article class="effect-monitor-platform-item"><header>${effectMonitorPlatformBadge(row.platform)}<div><b>${escapeHtml(row.platform || "—")}</b><small>${escapeHtml(row.terminal || "—")}</small></div><span class="effect-aligned-status ${statusTone}">${escapeHtml(statusText === "verified" ? "已验收" : statusText)}</span></header><div class="effect-monitor-platform-body">${effectMonitorRateRing(rate)}<div class="effect-monitor-platform-stats"><span>样本 <b>${effectMonitorNumber(row.samples)}</b></span><span>引用 <b>${effectMonitorNumber(row.citations)}</b></span></div></div></article>`; }).join("")}</div>` : effectMonitorEmptyState("暂无可展示的平台已验证记录。")}</section>`;
}

function effectMonitorArchivePanel(plan, runs) {
  const entries = monitoringPlanEntries(plan);
  const ordered = runs.slice().sort((left, right) => String(right.scheduledFor || right.createdAt || "").localeCompare(String(left.scheduledFor || left.createdAt || "")));
  return `<section class="card effect-monitor-archive-panel"><header><div><h3>历史运行归档</h3><p>每一行对应服务端保存的一次独立运行与其真实交付快照。</p></div></header>${ordered.length ? `<div class="effect-monitor-data-table effect-monitor-archive-table"><div class="head"><span>运行</span><span>计划时间</span><span>交付 / 已验证</span><span>积分</span><span>状态</span></div>${ordered.map((run) => { const entry = entries.find((item) => String(item.link?.diagnosticRunId || "") === String(run.diagnosticRunId || "")); const stats = entry ? effectRelayEntryStats(entry) : null; const delivery = stats ? `${stats.delivered} / ${stats.verified}` : "—"; const credits = run.estimatedCustomerCredits === null || run.estimatedCustomerCredits === undefined ? "—" : `${Number(run.estimatedCustomerCredits).toLocaleString("zh-CN")} 积分`; return `<div class="row"><b>${escapeHtml(run.triggerKind === "manual" ? "手动运行" : "计划运行")}</b><span>${escapeHtml(run.scheduledFor || run.createdAt ? formatDateTime(run.scheduledFor || run.createdAt) : "—")}</span><span>${escapeHtml(delivery)}</span><span>${escapeHtml(credits)}</span><span>${escapeHtml(effectRelayRunLabel(run.status))}${run.errorMessage ? ` · ${escapeHtml(run.errorMessage)}` : ""}</span></div>`; }).join("")}</div>` : effectMonitorEmptyState("当前计划还没有服务端历史运行记录。")}</section>`;
}

function effectMonitorDashboardView(plan, data) {
  const allRecords = effectMonitorDashboardRecords(data, plan);
  const records = effectMonitorDashboardRange(allRecords);
  const trend = effectMonitorDashboardTrend(records);
  const runs = Array.isArray(plan?.runs) ? plan.runs : (effectMonitoringSnapshot.runs || []);
  const alerts = effectMonitorAlertRows(data, trend, runs);
  const platforms = effectMonitorPlatformRows(data, records);
  return `<section class="effect-monitor-dashboard-stack">${effectMonitorTaskCard(plan)}${effectMonitorTrendPanel(trend)}<div class="effect-monitor-dashboard-grid">${effectMonitorAlertsPanel(alerts)}${effectMonitorPlatformsPanel(platforms)}</div>${effectMonitorArchivePanel(plan, runs)}</section>`;
}

function effectMonitorMentionView(data) {
  const rows = Array.isArray(data?.mentionRank) ? data.mentionRank : [];
  return `<section class="effect-monitor-view-stack">${effectMonitorAnalyticsCards(data, "mentions")}<section class="card effect-monitor-view-panel"><header><div><h2>品牌提及率 / 排名</h2><p>检测结果未提供排名字段时显示“—”，不会根据回答顺序推测排名。</p></div></header>${rows.length ? `<div class="effect-monitor-data-table effect-monitor-mentions-table"><div class="head"><span>平台</span><span>终端</span><span>样本</span><span>提及率</span><span>平均首次排名</span><span>引用</span></div>${rows.map((row) => `<div class="row"><b class="effect-monitor-pf-cell">${effectMonitorPlatformBadge(row.platform, 20)}${escapeHtml(row.platform || "—")}</b><span>${escapeHtml(row.terminal || "—")}</span><span>${effectMonitorNumber(row.samples)}</span><strong>${effectMonitorPercent(row.mentionRate)}</strong><span>${row.averageRank === null || row.averageRank === undefined ? "—" : `#${escapeHtml(row.averageRank)}`}</span><span>${effectMonitorNumber(row.citations)}</span></div>`).join("")}</div>` : effectMonitorEmptyState("暂无已验证的提及率或排名数据。")}</section></section>`;
}

function effectMonitorSentimentView(data) {
  const rows = Array.isArray(data?.sentiment) ? data.sentiment : [];
  return `<section class="effect-monitor-view-stack">${effectMonitorAnalyticsCards(data, "sentiment")}<section class="card effect-monitor-view-panel"><header><div><h2>舆情 / 情感</h2><p>只有检测结果返回标准化情感字段时才展示统计。</p></div></header>${rows.length ? `<div class="effect-monitor-sentiment-grid">${rows.map((row) => `<article><b>${escapeHtml(row.label || "—")}</b><strong>${effectMonitorNumber(row.count)}</strong><small>${effectMonitorPercent(row.rate)}</small></article>`).join("")}</div>` : effectMonitorEmptyState("当前检测结果尚未返回可验证的情感字段。")}</section></section>`;
}

function effectMonitorMentionLabel(row) {
  if (row?.brandMentionCount === null || row?.brandMentionCount === undefined || row?.brandMentionCount === "") return "—";
  return Number(row.brandMentionCount) > 0 ? `${row.brandMentionCount} 次` : "未提及";
}

function effectMonitorSafeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function effectMonitorSourcesView(data) {
  const rows = Array.isArray(data?.sources) ? data.sources : [];
  return `<section class="effect-monitor-view-stack">${effectMonitorAnalyticsCards(data, "sources")}<section class="card effect-monitor-view-panel"><header><div><h2>AI 引用来源</h2><p>来源名称、域名与 URL 均来自已验收回答引用。</p></div></header>${rows.length ? `<div class="effect-monitor-data-table effect-monitor-source-table"><div class="head"><span>来源</span><span>域名</span><span>引用次数</span><span>最近出现</span></div>${rows.map((row) => `<div class="row"><b>${escapeHtml(row.title || "—")}</b><span>${escapeHtml(row.domain || "—")}</span><strong>${effectMonitorNumber(row.citations)}</strong><span>${escapeHtml(row.lastObservedAt ? formatDateTime(row.lastObservedAt) : "—")}</span></div>`).join("")}</div>` : effectMonitorEmptyState("暂无 AI 引用来源。")}</section></section>`;
}

function effectMonitorDialogsView(data) {
  const rows = Array.isArray(data?.dialogs) ? data.dialogs : [];
  return `<section class="card effect-monitor-view-panel"><header><div><h2>AI 对话记录</h2><p>按平台、终端、问题和采样时间查看原始回答；缺失字段保持“—”，明确为零时显示“未提及”。</p></div></header>${rows.length ? `<div class="effect-monitor-dialog-list">${rows.map((row) => `<article><header><div class="effect-dialog-platform">${effectMonitorPlatformBadge(row.platform, 20)}<div><b>${escapeHtml(row.platform || "—")} · ${escapeHtml(row.terminal || "—")}</b><small>${escapeHtml(row.mode || "—")} · ${escapeHtml(row.observedAt ? formatDateTime(row.observedAt) : "—")}</small></div></div><span class="status-badge ${row.status === "verified" ? "status-approved" : "status-pending"}">${escapeHtml(row.status || "—")}</span></header><p class="question">${escapeHtml(row.question || "—")}</p><p class="answer">${escapeHtml(row.answer || "—")}</p><footer><span>品牌提及：${escapeHtml(effectMonitorMentionLabel(row))}</span><span>引用：${row.citationSources?.length === undefined ? "—" : escapeHtml(row.citationSources.length)}</span><span>证据：${escapeHtml(row.evidenceId || "—")}</span></footer></article>`).join("")}</div>` : effectMonitorEmptyState("暂无可展示的 AI 对话记录。")}</section>`;
}

function effectMonitorWorksView(data) {
  const rows = Array.isArray(data?.works) ? data.works : [];
  return `<section class="effect-monitor-view-stack">${effectMonitorAnalyticsCards(data, "works")}<section class="card effect-monitor-view-panel"><header><div><h2>作品引用追踪</h2><p>用于追踪被 AI 回答引用的网页作品；未返回 URL 时只显示来源名称。</p></div></header>${rows.length ? `<div class="effect-monitor-data-table effect-monitor-source-table"><div class="head"><span>作品 / 来源</span><span>URL</span><span>引用次数</span><span>最近出现</span></div>${rows.map((row) => { const url = effectMonitorSafeUrl(row.url); return `<div class="row"><b>${escapeHtml(row.title || "—")}</b><span>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>` : "—"}</span><strong>${effectMonitorNumber(row.citations)}</strong><span>${escapeHtml(row.lastObservedAt ? formatDateTime(row.lastObservedAt) : "—")}</span></div>`; }).join("")}</div>` : effectMonitorEmptyState("暂无作品引用记录。")}</section></section>`;
}

function effectMonitorExportView(data, plan) {
  const overview = data?.overview || {};
  return `<section class="card effect-monitor-view-panel effect-monitor-export-panel"><header><div><h2>导出监测报告</h2><p>导出内容只包含当前计划的聚合 API 数据和客户服务端已验收 evidence。</p></div></header><div class="effect-monitor-export-summary"><div><small>计划</small><b>${escapeHtml(plan?.name || "—")}</b></div><div><small>已验证样本</small><b>${effectMonitorNumber(overview.verified)}</b></div><div><small>最近采样</small><b>${escapeHtml(overview.lastObservedAt ? formatDateTime(overview.lastObservedAt) : "—")}</b></div></div><div class="effect-monitor-export-actions"><button type="button" class="primary-button" data-action="effect-monitor-export" data-format="json">导出 JSON</button><button type="button" class="secondary-button" data-action="effect-monitor-export" data-format="csv">导出 CSV</button></div><small class="effect-input-hint">没有真实数据时仍可导出配置与空结果，但不会填入示例指标。</small></section>`;
}

function effectMonitorSettingsView(plan, questions, aliases, competitors, supportedItems, canCreate) {
  const plans = effectMonitoringSnapshot.plans || [];
  return `<section class="effect-monitor-settings-view"><section class="card effect-monitor-plans"><header><div><h2>监测计划</h2><p>计划、授权和运行由客户服务端保存；暂停、恢复、手动运行仍使用现有接口。</p></div><button class="secondary-button" type="button" data-action="effect-monitor-refresh">${icon("refresh")}刷新计划</button></header><div>${plans.length ? plans.map((item) => effectMonitorPlanCard(item, plan)).join("") : `<div class="effect-monitor-settings-empty">${effectMonitoringSnapshot.loaded ? "暂无品牌监测计划，请先填写下方配置。" : "正在读取品牌监测计划…"}</div>`}</div></section><section class="card effect-demo-query effect-monitor-create"><header><div><h2>创建 / 更新监测配置</h2><p>创建后将冻结问题集、能力范围、周期和授权。每次运行前重新报价。</p></div></header><div class="effect-demo-form"><label class="effect-demo-input"><span>${icon("users")}目标品牌 <em>*</em></span><input id="effect-monitor-brand" value="${escapeHtml(ui.effectMonitorBrand)}" placeholder="如：桐灼科技" /></label><label class="effect-demo-input"><span>${icon("link")}官网地址</span><input id="effect-monitor-site" value="${escapeHtml(ui.effectMonitorSite)}" placeholder="https://example.com（可选）" /></label><label class="effect-demo-input"><span>${icon("layers")}行业 / 场景</span><input id="effect-monitor-industry" value="${escapeHtml(ui.effectMonitorIndustry)}" placeholder="如：工业机器人" /></label><label class="effect-demo-input"><span>${icon("tag")}品牌别名</span><input id="effect-monitor-aliases" value="${escapeHtml(aliases)}" placeholder="用逗号分隔" /></label><label class="effect-demo-input full"><span>${icon("eye")}固定监测问题集（每行一个） <em>*</em></span><textarea id="effect-monitor-questions" rows="5" placeholder="如：桐灼科技是什么品牌？">${escapeHtml(questions.join("\n"))}</textarea></label><label class="effect-demo-input full"><span>${icon("users")}竞品（可选）</span><textarea id="effect-monitor-competitors" rows="3" placeholder="竞品 A：别名 A">${escapeHtml(competitors)}</textarea></label><div class="effect-demo-field full"><div class="effect-platform-heading"><b>固定监测能力范围</b><small>仅显示当前客户服务配置允许的平台、终端和模式。</small></div>${effectRelayCapabilityPicker({ scopes: ui.effectMonitorScopes, modes: ui.effectMonitorModes, scopeAttribute: "data-effect-monitor-platform-scope", selectAllAttribute: "data-effect-monitor-platform-select-all", modeAttribute: "data-effect-monitor-platform-mode" })}</div><label class="effect-demo-input"><span>${icon("calendar")}监测周期 <em>*</em></span><select data-effect-monitor-cadence><option value="daily" ${ui.effectMonitorCadence === "daily" ? "selected" : ""}>每天</option><option value="weekly" ${ui.effectMonitorCadence === "weekly" ? "selected" : ""}>每周</option><option value="monthly" ${ui.effectMonitorCadence === "monthly" ? "selected" : ""}>每月</option><option value="interval" ${ui.effectMonitorCadence === "interval" ? "selected" : ""}>自定义小时</option></select></label><label class="effect-demo-input ${ui.effectMonitorCadence === "interval" ? "" : "is-disabled"}"><span>${icon("clock")}间隔小时</span><input id="effect-monitor-interval-hours" type="number" min="24" value="${escapeHtml(ui.effectMonitorIntervalHours)}" ${ui.effectMonitorCadence === "interval" ? "" : "disabled"} /></label><label class="effect-demo-input"><span>${icon("credit-card")}单次积分上限 <em>*</em></span><input id="effect-monitor-max-credits" type="number" min="1" value="${escapeHtml(ui.effectMonitorMaxCredits)}" /></label><label class="effect-demo-input"><span>${icon("credit-card")}月度积分上限</span><input id="effect-monitor-max-monthly-credits" type="number" min="0" value="${escapeHtml(ui.effectMonitorMaxMonthlyCredits)}" /></label><label class="effect-demo-input"><span>${icon("shield")}授权编号 / 工单号 <em>*</em></span><input id="effect-monitor-authorization-reference" value="${escapeHtml(ui.effectMonitorAuthorizationReference)}" placeholder="如：MON-2026-001" /></label><label class="effect-demo-input"><span>${icon("calendar")}授权到期时间</span><input id="effect-monitor-authorization-expires-at" type="datetime-local" value="${escapeHtml(ui.effectMonitorAuthorizationExpiresAt)}" /></label><div class="effect-demo-controls"><span class="effect-search-scope-summary"><b>${effectMonitorNumber(supportedItems.length, "—")}</b> 个固定监测项<br /><small>${effectMonitorNumber(questions.length, "—")} 个问题 × 已选能力组合</small></span><label class="effect-search-consent"><input type="checkbox" data-effect-monitor-consent ${ui.effectMonitorExternalConsent ? "checked" : ""} /><span>我确认授权客户服务端按上述周期发送冻结范围并接受积分上限约束</span></label><button class="primary-button" type="button" data-action="effect-monitor-create" ${ui.effectMonitorCreating || !canCreate ? "disabled" : ""}>${ui.effectMonitorCreating ? '<span class="loading-spinner"></span>正在创建…' : `${icon("plus")}创建监测计划`}</button></div></div></section>${effectMonitorPlanDetail(plan)}</section>`;
}

function effectMonitorQuestionBankView(data, plan) {
  const questions = Array.isArray(data?.questionBank) ? data.questionBank : [];
  return `<section class="card effect-monitor-view-panel"><header><div><h2>AI 问题库</h2><p>展示当前监测计划冻结的问题快照；修改需要在监测设置中创建新版本。</p></div><button type="button" class="link-button" data-action="effect-monitor-view" data-view="settings">打开监测设置</button></header>${questions.length ? `<div class="effect-monitor-question-list">${questions.map((question, index) => `<article><span>${index + 1}</span><div><b>${escapeHtml(question.text || question.prompt || "—")}</b><small>ID：${escapeHtml(question.id || "—")} · ${escapeHtml(question.intent || question.type || "冻结问题")}</small></div></article>`).join("")}</div>` : effectMonitorEmptyState(plan ? "当前计划没有可读取的问题快照。" : "请先选择或创建监测计划。")}</section>`;
}

function effectMonitorViewContent(view, plan, data, questions, aliases, competitors, supportedItems, canCreate) {
  switch (view) {
    case "mentions": return effectMonitorMentionView(data);
    case "sentiment": return effectMonitorSentimentView(data);
    case "product-cards": return effectMonitorProductCardsView(data, plan);
    case "sources": return effectMonitorSourcesView(data);
    case "dialogs": return effectMonitorDialogsView(data);
    case "works": return effectMonitorWorksView(data);
    case "export": return effectMonitorExportView(data, plan);
    case "settings": return effectMonitorSettingsView(plan, questions, aliases, competitors, supportedItems, canCreate);
    case "question-bank": return effectMonitorQuestionBankView(data, plan);
    default: return effectMonitorDashboardView(plan, data);
  }
}

function effectMonitorProductCardsView(data, plan) {
  const overview = data?.overview || {};
  return `<section class="effect-monitor-view-stack"><section class="card effect-monitor-view-panel"><header><div><h2>商品卡分析</h2><p>用于记录 AI 平台返回的商品卡、产品推荐和商品引用字段；服务端未返回时保持为空。</p></div></header><div class="effect-product-empty"><span>${icon("layers")}</span><b>${plan ? "当前计划尚未返回商品卡字段" : "请先创建品牌监测计划"}</b><small>${plan ? `已验证样本 ${effectMonitorNumber(overview.verified)} 条；商品卡能力将在检测服务返回结构化商品字段后展示。` : "商品卡分析依赖固定问题集与已验收的实时检测证据。"}</small></div></section></section>`;
}

function exportEffectMonitorAnalytics(format = "json") {
  const data = effectMonitoringAnalyticsSnapshot.data || effectMonitorLocalAnalytics(effectMonitoringSnapshot.activePlan);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "csv") {
    const rows = [["平台", "终端", "问题", "回答", "状态", "品牌提及", "引用数", "观察时间", "证据 ID"], ...(data.dialogs || []).map((row) => [row.platform || "", row.terminal || "", row.question || "", row.answer || "", row.status || "", Number(row.brandMentionCount || 0) > 0 ? row.brandMentionCount : "未提及", row.citationSources?.length ?? "", row.observedAt || "", row.evidenceId || ""])];
    downloadTextFile(`brand-monitor-${stamp}.csv`, rows.map((row) => row.map(csvValue).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  } else {
    downloadTextFile(`brand-monitor-${stamp}.json`, JSON.stringify({ planId: ui.effectMonitorPlanId, exportedAt: new Date().toISOString(), analytics: data }, null, 2), "application/json;charset=utf-8");
  }
  showToast("监测数据已导出", `已导出当前计划的 ${format.toUpperCase()} 数据；没有证据的字段保持为空。`, "success");
}

function renderRealEffectMonitor() {
  ensureEffectMonitorBaselineQuestions();
  if (!effectMonitoringSnapshot.attempted && !effectMonitoringSnapshot.loading) queueMicrotask(() => refreshEffectMonitoring({ renderAfter: true }));
  if (!effectRelaySnapshot.attempted && !effectRelaySnapshot.loading) queueMicrotask(() => refreshEffectRelay({ renderAfter: true }));
  const activePlan = effectMonitoringSnapshot.activePlan;
  if (activePlan?.id && effectMonitoringAnalyticsSnapshot.planId !== activePlan.id && !effectMonitoringAnalyticsSnapshot.loading) queueMicrotask(() => refreshEffectMonitoringAnalytics({ planId: activePlan.id, renderAfter: true }));
  const questions = effectMonitorQuestionList();
  const draftQuestions = effectMonitorDraftQuestions();
  const supportedItems = effectRelaySupportedItems(ui.effectMonitorScopes, ui.effectMonitorModes, draftQuestions, { source: "effect_monitor", feature: "aidso_brand_monitoring" });
  const aliases = effectMonitorAliases([ui.effectMonitorBrand, ...(ui.effectMonitorAliases || [])]).filter((item) => item !== ui.effectMonitorBrand).join("、");
  const competitors = (ui.effectMonitorCompetitors || []).map((item) => `${item.name || ""}${item.terms ? `：${item.terms}` : ""}`).filter(Boolean).join("\n");
  const data = effectMonitoringAnalyticsSnapshot.data || (activePlan ? effectMonitorLocalAnalytics(activePlan) : null);
  const view = EFFECT_MONITOR_VIEWS.some(([key]) => key === ui.effectMonitorView) ? ui.effectMonitorView : "dashboard";
  const canCreate = Boolean(ui.effectMonitorBrand.trim() && questions.length && (ui.effectMonitorScopes || []).length && (ui.effectMonitorModes || []).length && ui.effectMonitorExternalConsent && ui.effectMonitorAuthorizationReference.trim() && Number(ui.effectMonitorMaxCredits) >= 1 && Number(ui.effectMonitorMaxMonthlyCredits || 0) >= 0 && supportedItems.length);
  const latestEntry = monitoringPlanEntries(activePlan)[0] || null;
  const dashboard = view === "dashboard";
  const pageHead = effectAlignedPageHead({ eyebrow: "", title: "品牌监测", accent: "把品牌在 AI 中的长期表现变成趋势", description: "按冻结问题和平台范围持续采样，只展示客户服务端已验收的真实检测证据。" });
  if (dashboard) {
    return `<div class="page-container effect-demo-page effect-monitor-page effect-aligned-page">${pageHead}${effectPagesTabs("effect-monitor")}${effectMonitorViewTabs(view)}${effectMonitorViewContent(view, activePlan, data, questions, aliases, competitors, supportedItems, canCreate)}</div>`;
  }
  return `<div class="page-container effect-demo-page effect-monitor-page effect-aligned-page">${pageHead}${effectPagesTabs("effect-monitor")}${effectMonitorViewTabs(view)}${effectRelayStatusPanel({ entry: latestEntry, scopes: ui.effectMonitorScopes, modes: ui.effectMonitorModes, questions: draftQuestions })}${effectMonitorViewContent(view, activePlan, data, questions, aliases, competitors, supportedItems, canCreate)}</div>`;
}

function effectDiagnosticQuestionSeed(brand, options = {}) {
  const name = String(brand || "目标品牌").trim() || "目标品牌";
  const industry = String(options.industry ?? ui.effectDiagnosticIndustry ?? "").trim();
  const site = String(options.site ?? ui.effectDiagnosticSite ?? "").trim();
  const aliases = effectDiagnosticAliases(options.aliases ?? ui.effectDiagnosticBrandTerms).filter((item) => item !== name).slice(0, 3);
  const competitors = effectDiagnosticCompetitorLabels(options.competitors ?? ui.effectDiagnosticCompetitors).slice(0, 3);
  const peerLabel = competitors.length ? competitors.join("、") : "同类品牌";
  const contextLabel = industry ? industry + "场景中的" : "";
  const source = site ? "基于品牌名称、行业、官网与竞品配置" : "基于品牌名称、行业与竞品配置";
  return [
    { id: uid("DIAG_Q"), category: "品牌认知", keyword: name, text: name + " 是什么品牌？主要提供哪些产品或服务？", priority: 5, source },
    { id: uid("DIAG_Q"), category: "选购决策", keyword: name, text: "选择" + contextLabel + name + "时，应该重点比较哪些能力、适用条件和限制？", priority: 4, source },
    { id: uid("DIAG_Q"), category: "场景推荐", keyword: name, text: name + " 适合哪些" + (industry || "业务") + "场景？什么情况下不适合选择？", priority: 4, source },
    { id: uid("DIAG_Q"), category: "信源核验", keyword: aliases[0] || name, text: "在哪里可以核验 " + name + " 的官方资料、产品信息和服务边界？", priority: 3, source },
    { id: uid("DIAG_Q"), category: "竞品对比", keyword: name, text: name + " 与 " + peerLabel + " 相比有哪些差异？不同需求下如何选择？", priority: 4, source }
  ];
}

async function regenerateEffectDiagnosticQuestions() {
  if (ui.effectDiagnosticQuestionGenerating) return;
  const brand = String(ui.effectDiagnosticBrand || "").trim();
  if (!brand) return showToast("请先输入品牌名称", "AI 问题推荐需要品牌配置作为上下文。", "error");
  ui.effectDiagnosticQuestionGenerating = true;
  render();
  try {
    let providerId = selectedTextProviderId();
    if (!providerId && !aiProviderSnapshot.loaded) {
      await refreshAiProviders();
      providerId = selectedTextProviderId();
    }
    if (!providerId) {
      ui.effectDiagnosticQuestions = effectDiagnosticQuestionSeed(brand, {
        industry: ui.effectDiagnosticIndustry,
        site: ui.effectDiagnosticSite,
        aliases: ui.effectDiagnosticBrandTerms,
        competitors: ui.effectDiagnosticCompetitors
      });
      ui.effectDiagnosticQuestionDraftInitialized = true;
      invalidateEffectDiagnosticQuote();
      showToast("已生成基础问题建议", "当前未配置文本模型，系统根据品牌配置生成了可编辑建议。", "success");
      return;
    }
    const seeds = [brand, ...(ui.effectDiagnosticBrandTerms || []), ...effectDiagnosticCompetitorLabels()].filter(Boolean).slice(0, 8);
    const payload = await aiApi("/api/ai/generate/questions", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: { id: "effect-diagnostic", name: ui.effectDiagnosticIndustry || "品牌诊断", description: ui.effectDiagnosticIntroduction || "" },
        seeds,
        existingQuestions: [],
        dimensions: ["brand", "commercial", "scenario", "comparison", "trust"]
      }
    });
    const data = payload.data || payload;
    const raw = data.questions || data.customerQuestions || data.items || [];
    const generated = Array.isArray(raw) ? raw.map((item, index) => {
      const text = String(item?.question || item?.text || item?.title || "").trim();
      if (!text) return null;
      return {
        id: uid("DIAG_Q"),
        category: item?.category || item?.dimensionLabel || item?.dimension || "AI 推荐",
        keyword: item?.sourceKeyword || item?.keyword || brand,
        text,
        priority: Number(item?.recommendation || item?.priority || 0) || null,
        source: "已配置文本模型生成"
      };
    }).filter(Boolean).slice(0, 20) : [];
    if (!generated.length) throw new Error("文本模型没有返回可用的问题候选。");
    ui.effectDiagnosticQuestions = generated;
    ui.effectDiagnosticQuestionDraftInitialized = true;
    invalidateEffectDiagnosticQuote();
    showToast("AI 问题推荐已更新", "已结合当前品牌配置生成可编辑问题，可继续复制、编辑或删除。", "success");
  } catch (error) {
    ui.effectDiagnosticQuestions = effectDiagnosticQuestionSeed(brand, {
      industry: ui.effectDiagnosticIndustry,
      site: ui.effectDiagnosticSite,
      aliases: ui.effectDiagnosticBrandTerms,
      competitors: ui.effectDiagnosticCompetitors
    });
    ui.effectDiagnosticQuestionDraftInitialized = true;
    invalidateEffectDiagnosticQuote();
    showToast("AI 推荐暂不可用", (error.message || "已回退为基于品牌配置的基础问题建议。") + " 已保留可编辑建议。", "error");
  } finally {
    ui.effectDiagnosticQuestionGenerating = false;
    render();
  }
}

function effectDiagnosticStart(brand, site = "") {
  const normalized = String(brand || "").trim();
  if (!normalized) return showToast("请先输入品牌名称", "输入品牌后，系统才会生成品牌词、竞品和 AI 问题建议。", "error");
  if (effectRelayPollTimers.diagnostic) window.clearTimeout(effectRelayPollTimers.diagnostic);
  effectRelayPollTimers.diagnostic = null;
  effectFlowStateFor("diagnostic").activeRun = null;
  effectFlowStateFor("diagnostic").activeLink = null;
  effectFlowStateFor("diagnostic").error = "";
  ui.effectDiagnosticRunId = null;
  ui.effectDiagnosticRelayRunId = null;
  ui.effectDiagnosticProjectId = null;
  ui.effectDiagnosticQuestionSetId = null;
  ui.effectDiagnosticProjectSignature = "";
  ui.effectDiagnosticFrozenQuestions = [];
  ui.effectDiagnosticQuoteReady = false;
  ui.effectDiagnosticClientRunId = null;
  ui.effectDiagnosticReportRunId = null;
  ui.effectDiagnosticReportId = null;
  ui.effectDiagnosticReportVersion = null;
  ui.effectDiagnosticReport = null;
  ui.effectDiagnosticReportGenerating = false;
  setEffectRelayQuote("diagnostic", null);
  const defaultScopes = effectRelayCapabilityScopeKeys();
  const availableModes = [...new Set(effectRelayCapabilityItems().map((item) => String(item.mode || "").trim()).filter(Boolean))];
  ui.effectDiagnosticStarted = true;
  ui.effectDiagnosticBrand = normalized;
  ui.effectDiagnosticSite = String(site || "").trim();
  ui.effectDiagnosticIntroduction = "";
  ui.effectDiagnosticBrandTerms = [normalized];
  // Competitors are optional in AIDSO's completeAnalysis setup. Start with a
  // genuinely empty table row only when the customer explicitly adds one; do
  // not persist placeholder/demo competitor text into the diagnostic.
  ui.effectDiagnosticCompetitors = [];
  ui.effectDiagnosticQuestions = effectDiagnosticQuestionSeed(normalized);
  ui.effectDiagnosticQuestionDraftInitialized = true;
  ui.effectDiagnosticScopes = defaultScopes;
  ui.effectDiagnosticScopeSelectionTouched = false;
  ui.effectDiagnosticModes = availableModes.includes("fast") ? ["fast"] : availableModes.slice(0, 1);
  ui.effectDiagnosticRounds = 1;
  ui.effectDiagnosticPlatformRounds = Object.fromEntries(defaultScopes.map((scope) => [scope, 1]));
  ui.effectDiagnosticCompleted = false;
  ui.effectDiagnosticRecords = [];
  ui.effectDiagnosticFilterPlatform = "all";
  ui.effectDiagnosticFilterQuestion = "all";
  render();
}

function effectDiagnosticScopeRows() {
  const catalog = effectPlatformCatalog();
  const selected = new Set(ui.effectDiagnosticScopes || []);
  const rounds = ui.effectDiagnosticPlatformRounds || {};
  const rows = catalog.flatMap((platform) => platform.rows.map((row) => ({
    scope: `${platform.name}|${row.device}`,
    platform: platform.name,
    device: row.device,
    color: platform.color,
    code: platform.code,
    selected: selected.has(`${platform.name}|${row.device}`),
    rounds: Number(rounds[`${platform.name}|${row.device}`] || ui.effectDiagnosticRounds || 1)
  }))).filter((item) => item.selected);
  if (!rows.length) return '<p class="aidso-inline-empty">请至少选择一个平台终端，并设置每个平台的对话次数。</p>';
  return `<div class="aidso-rounds">${rows.map((item) => `<label><span><i style="--platform:${item.color}">${escapeHtml(item.code)}</i><b>${escapeHtml(item.platform)}</b><small>${escapeHtml(item.device)}</small></span><select data-effect-diagnostic-round value="${item.rounds}" data-scope="${escapeHtml(item.scope)}"><option value="1" ${item.rounds === 1 ? "selected" : ""}>1 次对话</option><option value="3" ${item.rounds === 3 ? "selected" : ""}>3 次对话</option><option value="5" ${item.rounds === 5 ? "selected" : ""}>5 次对话</option></select></label>`).join("")}</div>`;
}

function effectDiagnosticPlatformToolbar() {
  const selected = new Set(ui.effectDiagnosticScopes || []);
  const allScopes = effectPlatformCatalog().flatMap((platform) => platform.rows.map((row) => `${platform.name}|${row.device}`));
  const allSelected = allScopes.length > 0 && allScopes.every((scope) => selected.has(scope));
  const modes = new Set(ui.effectDiagnosticModes || ["快速"]);
  return `<div class="aidso-platform-toolbar"><label><input type="checkbox" data-effect-diagnostic-select-all ${allSelected ? "checked" : ""} /><span>${icon("check")}</span>全选</label><label><input type="checkbox" value="快速" data-effect-diagnostic-mode ${modes.has("快速") ? "checked" : ""} /><span>${icon("check")}</span>快速模式</label><label><input type="checkbox" value="深度" data-effect-diagnostic-mode ${modes.has("深度") ? "checked" : ""} /><span>${icon("check")}</span>深度思考</label></div>`;
}

function effectDiagnosticPlatformPicker() {
  return effectPlatformPicker({
    scopes: ui.effectDiagnosticScopes,
    modes: ui.effectDiagnosticModes,
    scopeAttribute: "data-effect-diagnostic-scope",
    selectAllAttribute: "data-effect-diagnostic-select-all",
    modeAttribute: "data-effect-diagnostic-mode",
    hideToolbar: true
  });
}


function hydrateEffectDiagnosticCompetitorEditor(root = document) {
  const textarea = root.querySelector("#effect-diagnostic-competitors");
  if (!textarea || root.querySelector(".effect-diagnostic-competitor-editor")) return;
  const section = document.createElement("section");
  section.className = "effect-diagnostic-competitor-editor";
  section.innerHTML = '<div class="effect-diagnostic-inline-actions"><small>竞品品牌与竞品词会随本次诊断快照保存。</small><button class="link-button" type="button" data-action="effect-diagnostic-competitor-add">+ 添加竞品</button></div>' + effectDiagnosticCompetitorRows();
  const host = textarea.closest("label") || textarea.parentElement;
  if (host) host.replaceWith(section);
}

function hydrateEffectDiagnosticQuestionEditor(root = document) {
  const textarea = root.querySelector("#effect-diagnostic-questions");
  if (!textarea || root.querySelector(".effect-diagnostic-question-editor")) return;
  const section = document.createElement("section");
  section.className = "effect-diagnostic-question-editor";
  section.innerHTML = effectDiagnosticQuestionRows();
  const host = textarea.closest("label") || textarea.parentElement;
  if (host) host.replaceWith(section);
}

function hydrateEffectDiagnosticBrandIntroduction(root = document) {
  const industry = root.querySelector("#effect-diagnostic-industry");
  if (!industry || root.querySelector("#effect-diagnostic-introduction")) return;
  const label = document.createElement("label");
  label.className = "effect-demo-input full";
  label.innerHTML = '<span>品牌介绍 / 诊断口径</span><textarea id="effect-diagnostic-introduction" rows="2" placeholder="可填写品牌简介、主要产品、服务边界或希望重点验证的方向">' + escapeHtml(ui.effectDiagnosticIntroduction || "") + '</textarea>';
  industry.closest("label")?.after(label);
}

function hydrateEffectRelayExecutionNotice(root = document) {
  const mode = effectRelayExecutionMode();
  if (mode !== "mock") return;
  const status = root.querySelector(".effect-relay-status");
  if (!status || status.querySelector("[data-effect-relay-execution-mode]")) return;
  const notice = document.createElement("span");
  notice.dataset.effectRelayExecutionMode = "mock";
  notice.className = "effect-relay-warning";
  notice.textContent = "当前为系统演练模式，结果不能作为正式检测结论";
  status.appendChild(notice);
}

function effectDiagnosticCompetitorRows() {
  const competitors = Array.isArray(ui.effectDiagnosticCompetitors) ? ui.effectDiagnosticCompetitors : [];
  if (!competitors.length) {
    return `<div class="aidso-competitor-empty">尚未添加竞品。竞品不是必填项，可点击“添加竞品”后填写品牌名和竞品词。</div>`;
  }
  return `<div class="aidso-competitor-table">
    <div><span>竞品品牌</span><span>竞品词 / 别名</span><span>操作</span></div>
    ${competitors.map((competitor) => `<label>
      <input data-effect-diagnostic-competitor-name data-competitor-id="${escapeHtml(competitor.id)}" value="${escapeHtml(competitor.name || "")}" placeholder="竞品品牌" />
      <input data-effect-diagnostic-competitor-terms data-competitor-id="${escapeHtml(competitor.id)}" value="${escapeHtml(competitor.terms || "")}" placeholder="竞品词，多个词请用逗号分隔" />
      <button type="button" data-action="effect-diagnostic-competitor-remove" data-competitor-id="${escapeHtml(competitor.id)}">删除</button>
    </label>`).join("")}
  </div>`;
}

function effectDiagnosticQuestionRows() {
  const questions = Array.isArray(ui.effectDiagnosticQuestions) ? ui.effectDiagnosticQuestions : [];
  if (!questions.length) return '<div class="aidso-question-empty">尚未配置问题。可点击“添加问题”或“重新生成”恢复问题建议。</div>';
  const rows = questions.map((question, index) => {
    const source = question.source || "基于当前品牌配置";
    const priority = Number.isFinite(Number(question.priority)) ? Number(question.priority) : "—";
    return `<article class="aidso-question-row"><span class="aidso-question-category"><i>${index + 1}</i>${escapeHtml(question.category || "品牌诊断")}</span><span class="aidso-question-keyword">${escapeHtml(question.keyword || ui.effectDiagnosticBrand)}</span><p>${escapeHtml(question.text)}</p><span class="aidso-question-heat" title="${escapeHtml(source)}">${escapeHtml(String(priority))}</span><span class="aidso-question-actions"><button type="button" data-action="effect-diagnostic-question-copy" data-question-id="${escapeHtml(question.id)}">复制</button><button type="button" data-action="effect-diagnostic-question-edit" data-question-id="${escapeHtml(question.id)}">编辑</button><button type="button" data-action="effect-diagnostic-question-delete" data-question-id="${escapeHtml(question.id)}">删除</button></span></article>`;
  }).join("");
  return `<div class="aidso-question-table"><div class="aidso-question-table-head"><span>问题类型</span><span>核心词</span><span>AI 推荐问题</span><span>优先级</span><span>操作</span></div>${rows}</div><small class="effect-input-hint">问题建议基于当前品牌配置生成；优先级仅用于排序，不代表真实搜索热度。</small>`;
}

function runEffectDiagnostic() {

  // Compatibility for legacy keyboard shortcuts; all submissions now enter
  // the real quote → signed relay → live-evidence flow.
  return prepareEffectDiagnosticRun();
}

function renderEffectDiagnosticStart() {
  return `<div class="page-container aidso-diagnostic-start"><div class="aidso-diagnostic-start-hero"><span class="aidso-start-badge">AI 品牌诊断</span><h2>立即开启诊断你的品牌</h2><p>先输入品牌名称，系统将生成品牌词、竞品配置和 AI 问题建议；确认平台与对话次数后，再生成品牌诊断报告。</p><div class="aidso-start-form"><label><span>品牌名称</span><input id="effect-diagnostic-start-brand" value="${escapeHtml(ui.effectDiagnosticBrand)}" placeholder="请输入需要诊断的品牌名称" /></label><label><span>官网地址（可选）</span><input id="effect-diagnostic-start-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com" /></label><button class="primary-button" type="button" data-action="effect-diagnostic-start">开始配置 ${icon("arrow")}</button></div><div class="aidso-start-notes"><span>${icon("check")}品牌与竞品配置</span><span>${icon("check")}AI 问题推荐与编辑</span><span>${icon("check")}多平台多轮对话诊断</span></div></div></div>`;
}

/*
 * 品牌诊断 Demo 对齐骨架。
 * 这些 helper 只消费当前任务快照、已验收 evidence 和服务端报告；
 * 没有真实字段时保持结构化空态，不把 Demo 的静态分数带入正式页面。
 */
function effectDiagnosticReportForEntry(entry) {
  const runId = String(entry?.link?.diagnosticRunId || "");
  if (!runId) return null;
  if (String(ui.effectDiagnosticReportRunId || "") === runId && ui.effectDiagnosticReport) return ui.effectDiagnosticReport;
  return (diagnosticSnapshot.reports || []).find((report) => String(
    report.runId || report.diagnosticRunId || report.relayRunId || report.scope?.diagnosticRunId || ""
  ) === runId) || null;
}

function effectDiagnosticStatusClass(status) {
  if (["completed", "partial"].includes(status)) return "status-approved";
  if (["failed", "attention", "cancelled"].includes(status)) return "status-error";
  return "status-pending";
}

function effectDiagnosticPercent(numerator, denominator) {
  if (!Number.isFinite(Number(denominator)) || Number(denominator) <= 0) return null;
  return Math.round((Number(numerator) / Number(denominator)) * 100);
}

function effectDiagnosticSixDimensions(entry, records) {
  const requestedItems = Array.isArray(entry?.link?.request?.items) ? entry.link.request.items : [];
  const verified = records.filter((record) => record.status === "verified");
  const mentioned = verified.filter((record) => Number(record.brandMentionCount || 0) > 0);
  const cited = verified.filter((record) => (record.citationSources || []).length > 0);
  const traceable = verified.filter((record) => record.evidenceId && (record.upstreamReqId || record.deliveryId));
  const requestedScopes = new Set(requestedItems.map((item) => `${item.platform || ""}|${item.terminal || ""}`).filter((key) => key !== "|"));
  const verifiedScopes = new Set(verified.map((record) => `${record.platform || ""}|${record.terminal || ""}`).filter((key) => key !== "|"));
  const requestedQuestions = new Set(requestedItems.map((item) => String(item.questionId || "")).filter(Boolean));
  const verifiedQuestions = new Set(verified.map((record) => String(record.questionId || "")).filter(Boolean));
  return [
    { label: "有效交付", value: effectDiagnosticPercent(verified.length, requestedItems.length), detail: `${verified.length} / ${requestedItems.length || 0} 已验证任务项` },
    { label: "品牌提及", value: effectDiagnosticPercent(mentioned.length, verified.length), detail: `${mentioned.length} / ${verified.length} 已验证回答提及品牌` },
    { label: "引用回答", value: effectDiagnosticPercent(cited.length, verified.length), detail: `${cited.length} / ${verified.length} 含返回引用` },
    { label: "平台终端", value: effectDiagnosticPercent(verifiedScopes.size, requestedScopes.size), detail: `${verifiedScopes.size} / ${requestedScopes.size} 已返回平台终端` },
    { label: "问题覆盖", value: effectDiagnosticPercent(verifiedQuestions.size, requestedQuestions.size), detail: `${verifiedQuestions.size} / ${requestedQuestions.size} 冻结问题有有效证据` },
    { label: "证据可追溯", value: effectDiagnosticPercent(traceable.length, verified.length), detail: `${traceable.length} / ${verified.length} 含证据与上游追溯号` }
  ];
}

function effectDiagnosticRadarMarkup(dimensions) {
  if (dimensions.some((item) => item.value === null)) {
    return `<div class="effect-diagnostic-data-empty"><span>${icon("clock")}</span><b>等待有效证据入库</b><p>六维图只在本次任务产生可验证实时检测证据后计算，不把“运行中”误显示为零分。</p></div>`;
  }
  const center = 120;
  const radius = 72;
  const point = (value, index, factor = 1) => {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    const current = radius * factor * (value / 100);
    return `${(center + Math.cos(angle) * current).toFixed(1)},${(center + Math.sin(angle) * current).toFixed(1)}`;
  };
  const rings = [1, 2 / 3, 1 / 3].map((factor) => `<polygon points="${dimensions.map((_, index) => point(100, index, factor)).join(" ")}" fill="none" stroke="currentColor" stroke-opacity=".16"/>`).join("");
  const axes = dimensions.map((_, index) => { const [x, y] = point(100, index).split(","); return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="currentColor" stroke-opacity=".16"/>`; }).join("");
  const polygon = dimensions.map((item, index) => point(item.value, index)).join(" ");
  const dots = dimensions.map((item, index) => { const [x, y] = point(item.value, index).split(","); return `<circle cx="${x}" cy="${y}" r="3.5"/>`; }).join("");
  return `<div class="effect-diagnostic-radar"><svg viewBox="0 0 240 240" role="img" aria-label="本次品牌诊断六维真实证据概览"><g>${rings}${axes}</g><polygon class="effect-diagnostic-radar-area" points="${polygon}"/><g class="effect-diagnostic-radar-points">${dots}</g>${dimensions.map((item, index) => { const angle = -Math.PI / 2 + index * Math.PI / 3; const x = center + Math.cos(angle) * 101; const y = center + Math.sin(angle) * 101; return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${escapeHtml(item.label)}</text>`; }).join("")}</svg></div>`;
}

function effectDiagnosticTaskCard(entry, records, { draft = false } = {}) {
  const link = entry?.link || {};
  const run = entry?.run || {};
  const request = link.request || {};
  const status = effectRelayRunStatus(link, run);
  const stats = entry ? effectRelayEntryStats(entry) : { requested: 0, delivered: 0, verified: 0 };
  const questions = entry ? effectRelayEntryQuestions(entry) : effectDiagnosticQuestionList();
  const brand = request.brand?.name || ui.effectDiagnosticBrand || "目标品牌";
  const scopes = new Set((request.items || []).map((item) => `${EFFECT_RELAY_PLATFORM_NAMES[item.platform] || item.platform || "未知平台"} · ${EFFECT_RELAY_TERMINAL_NAMES[item.terminal] || item.terminal || "网页"}`));
  const error = link.errorMessage || run.errorMessage || "";
  const quote = effectRelayQuoteFor("diagnostic");
  const draftItems = effectDiagnosticSupportedItems(ui.effectDiagnosticScopes, ui.effectDiagnosticModes, effectDiagnosticDraftQuestions(), { source: "effect_diagnostic", feature: "aidso_brand_diagnostic" });
  const hasBrandDraft = Boolean(ui.effectDiagnosticBrand.trim());
  const canQuote = Boolean(hasBrandDraft && questions.length && ui.effectDiagnosticScopes.length && ui.effectDiagnosticModes.length && ui.effectDiagnosticExternalConsent && draftItems.length);
  const primaryAction = quote && ui.effectDiagnosticQuoteReady
    ? `<button class="primary-button" type="button" data-action="effect-diagnostic-submit" ${ui.effectDiagnosticSubmitting ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? "正在提交…" : `${icon("send")}确认并提交`}</button>`
    : hasBrandDraft
      ? `<button class="primary-button" type="button" data-action="effect-diagnostic-quote" ${ui.effectDiagnosticSubmitting || !canQuote ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? "正在获取报价…" : `${icon("search")}生成诊断报告`}</button>`
      : `<button class="primary-button" type="button" data-action="effect-diagnostic-start">开始配置 →</button>`;
  const platformChips = effectAlignedCapabilityChips({ scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, scopeAttribute: "data-effect-diagnostic-platform-scope", modeAttribute: "data-effect-diagnostic-platform-mode", label: "诊断范围：" });
  const running = ui.effectDiagnosticSubmitting || ["pending", "submitted", "queued", "running"].includes(status);
  const brandInput = hasBrandDraft ? `<input id="effect-diagnostic-brand" value="${escapeHtml(ui.effectDiagnosticBrand)}" placeholder="品牌名称，如：桐灼科技" aria-label="目标品牌"/>` : `<input id="effect-diagnostic-start-brand" value="${escapeHtml(ui.effectDiagnosticBrand)}" placeholder="品牌名称，如：桐灼科技" aria-label="目标品牌"/>`;
  const siteInput = hasBrandDraft ? `<input id="effect-diagnostic-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com（可选）"/>` : `<input id="effect-diagnostic-start-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com（可选）"/>`;
  const config = hasBrandDraft && !entry ? `<div class="effect-diagnostic-config"><div class="effect-diagnostic-secondary-fields"><label>官网地址${siteInput}</label><label>品牌词 / 别名<input id="effect-diagnostic-aliases" value="${escapeHtml(effectDiagnosticAliases([brand, ...(ui.effectDiagnosticBrandTerms || [])]).filter((item) => item !== brand).join("、"))}" placeholder="用逗号分隔"/></label></div><label class="effect-demo-input full"><span>${icon("eye")}诊断问题集（每行一个） <em>*</em></span><textarea id="effect-diagnostic-questions" rows="4" placeholder="如：桐灼科技是什么品牌？">${escapeHtml(questions.join("\n"))}</textarea><small class="effect-input-hint">问题会在报价时冻结；最多 20 个去重问题。</small></label><label class="effect-demo-input full"><span>${icon("users")}竞品（可选）</span><textarea id="effect-diagnostic-competitors" rows="2" placeholder="竞品 A：别名 A">${escapeHtml((ui.effectDiagnosticCompetitors || []).map((item) => `${item.name || ""}${item.terms ? `：${item.terms}` : ""}`).filter(Boolean).join("\n"))}</textarea></label><div class="effect-diagnostic-config-actions"><label class="effect-diagnostic-consent"><input type="checkbox" data-effect-diagnostic-consent ${ui.effectDiagnosticExternalConsent ? "checked" : ""}/>我确认将品牌资料、冻结问题集和选定能力范围提交给灼见 AI 检测服务</label>${effectDiagnosticRoundRows()}</div></div>` : "";
  return `<section class="effect-aligned-task effect-diagnostic-task-card"><header class="effect-aligned-task-head"><div><span class="effect-aligned-eyebrow">BRAND DIAGNOSTIC</span><h3>${escapeHtml(brand)} · ${draft ? "发起一次品牌诊断" : "本次诊断任务"}</h3><p>${draft ? "输入诊断主题，选择平台，生成一份基于真实 AI 检测证据的品牌诊断。" : "冻结问题、执行范围和交付状态均以本次任务快照为准。"}</p></div><span class="effect-aligned-tag">// DIAGNOSTIC</span></header><div class="effect-aligned-task-body"><div class="effect-aligned-query-row">${brandInput}<input id="effect-diagnostic-industry" value="${escapeHtml(ui.effectDiagnosticIndustry)}" placeholder="诊断主题 / 行业场景" aria-label="行业场景"/>${primaryAction}</div>${config || ""}${platformChips}<div class="effect-diagnostic-task-meta ${entry ? "" : "is-draft"}">${entry ? `<span>冻结问题 <b>${questions.length}</b></span><span>独立检测项 <b>${stats.requested}</b></span><span>已回传 / 已验证 <b>${stats.delivered} / ${stats.verified}</b></span><span>平台终端 <b>${scopes.size}</b></span><span>状态 <b>${escapeHtml(effectRelayRunLabel(status))}</b></span>` : `<span>问题 <b>${questions.length || "—"}</b></span><span>独立检测项 <b>${draftItems.length || "—"}</b></span><span>品牌 <b>${hasBrandDraft ? "已填写" : "待填写"}</b></span>`}</div><div class="effect-aligned-task-status">${effectRelayStatusPanel({ flow: "diagnostic", entry, quote, scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, questions: effectDiagnosticDraftQuestions(), cancelAction: "effect-diagnostic-cancel", cancelRunId: ui.effectDiagnosticRunId })}</div>${error ? `<p class="effect-diagnostic-task-error">${escapeHtml(customerFacingEffectText(error))}</p>` : ""}</div></section>`;
}

function effectDiagnosticActionsMarkup(report) {
  if (!report) return `<div class="effect-diagnostic-data-empty"><span>${icon("file")}</span><b>报告尚未生成</b><p>本次任务完成且已有 verified 实时检测证据后，才能生成可追溯报告与行动建议。</p></div>`;
  const rows = diagnosticActionRows([report]);
  if (!rows.length) return `<div class="effect-diagnostic-data-empty"><span>${icon("clipboard")}</span><b>报告未返回行动建议</b><p>报告已保存，但服务端尚未提供可确认回流的建议项。</p></div>`;
  return `<div class="effect-diagnostic-action-list">${rows.map((item) => { const status = String(item.status || "").toLowerCase(); const completed = ["confirmed", "completed", "applied", "converted"].includes(status); const available = item.actionAvailable !== false && Boolean(item.id); const target = diagnosticActionTarget(item.actionType || item.type); return `<article class="effect-diagnostic-action-row"><span class="effect-diagnostic-priority">${escapeHtml(item.priority || item.level || "建议")}</span><div><b>${escapeHtml(item.title || item.name || item.action || "未命名建议")}</b><p>${escapeHtml(item.rationale || item.reason || item.description || item.detail || "需由运营人员确认后才会回流。")}</p><small>回流至：${escapeHtml(diagnosticActionTargetLabel(target))}</small></div><button class="secondary-button button-small" type="button" data-action="diagnostic-confirm-action" data-report-id="${escapeHtml(String(report.id || report.reportId || ""))}" data-diagnostic-action-id="${escapeHtml(String(item.id || ""))}" ${!available || completed || String(ui.diagnosticActionId) === String(item.id) ? "disabled" : ""}>${completed ? "已回流" : !available ? "动作待生成" : String(ui.diagnosticActionId) === String(item.id) ? "处理中" : "确认回流"}</button></article>`; }).join("")}</div>`;
}

function effectDiagnosticEvidenceMarkup(records) {
  const verified = records.filter((record) => record.status === "verified").slice().sort((left, right) => String(right.observedAt || "").localeCompare(String(left.observedAt || "")));
  if (!verified.length) return `<div class="effect-diagnostic-data-empty"><span>${icon("shield")}</span><b>暂无已验证证据</b><p>只展示已通过校验并写入实时检测证据库的本次任务记录。</p></div>`;
  return `<div class="effect-diagnostic-evidence-list">${verified.slice(0, 8).map((record) => { const citations = (record.citationSources || []).slice(0, 2); const excerpt = String(record.answer || "").replace(/\s+/g, " ").trim().slice(0, 150); return `<article class="effect-aligned-evidence-row"><span class="effect-aligned-evidence-strength is-strong">强</span><div class="effect-aligned-evidence-copy"><b>${escapeHtml(`${record.platform} · ${record.terminal} · ${record.mode}`)}</b><p>${escapeHtml(record.question || "冻结问题待返回")}</p>${excerpt ? `<small>${escapeHtml(excerpt)}${String(record.answer || "").length > 150 ? "…" : ""}</small>` : ""}<em>证据 ${escapeHtml(record.evidenceId || "—")} · ${escapeHtml(formatDateTime(record.observedAt))}</em>${citations.length ? `<div class="effect-diagnostic-evidence-sources">${citations.map((source) => `<span>${icon("link")}${escapeHtml(source.domain || source.title || "返回引用")}</span>`).join("")}</div>` : ""}</div><button class="link-button" type="button" data-action="effect-answer-detail" data-effect-search-record-id="${escapeHtml(record.id)}">追溯</button></article>`; }).join("")}</div>`;
}

function effectDiagnosticReportOperationMarkup(entry, report, verifiedCount) {
  const status = effectRelayRunStatus(entry?.link, entry?.run);
  const canGenerate = ["completed", "partial"].includes(status) && verifiedCount > 0;
  if (!report) return `<div class="effect-diagnostic-report-operation"><span>${icon("file")}</span><div><b>${canGenerate ? "可以生成报告" : "报告暂不可生成"}</b><p>${canGenerate ? "将只使用本次已验证的实时检测证据生成报告。" : "需等待任务完成，并至少收到一条已验证的真实检测证据。"}</p></div>${canGenerate ? `<button class="primary-button button-small" type="button" data-action="effect-diagnostic-generate-report" ${ui.effectDiagnosticReportGenerating ? "disabled" : ""}>${ui.effectDiagnosticReportGenerating ? "正在生成…" : "生成诊断报告"}</button>` : ""}</div>`;
  return `<div class="effect-diagnostic-report-operation"><span>${icon("file")}</span><div><b>${escapeHtml(report.title || report.name || "品牌诊断报告")}</b><p>报告 ${escapeHtml(String(report.id || report.reportId || "—"))} · v${escapeHtml(String(report.version || ui.effectDiagnosticReportVersion || 1))}</p>${report.executiveSummary || report.summary ? `<small>${escapeHtml(report.executiveSummary || report.summary)}</small>` : ""}</div><button class="secondary-button button-small" type="button" data-action="effect-relay-refresh">${icon("refresh")}刷新状态</button></div>`;
}

function renderEffectDiagnosticWorkbench(entry = effectDiagnosticActiveEntry()) {
  const records = entry ? effectDiagnosticRecords(entry) : [];
  const verified = records.filter((record) => record.status === "verified");
  const dimensions = effectDiagnosticSixDimensions(entry, records);
  const report = entry ? effectDiagnosticReportForEntry(entry) : null;
  return `<div class="effect-diagnostic-workbench"><div class="effect-diagnostic-result-grid"><section class="card effect-diagnostic-dimensions-card"><header><div><h3>品牌认知六维图</h3><p>每一维均是本次任务已验证 evidence 的占比，不是模型主观评分。</p></div></header><div class="effect-diagnostic-dimensions-body">${effectDiagnosticRadarMarkup(dimensions)}<div class="effect-diagnostic-dimension-list">${dimensions.map((item) => `<div><span>${escapeHtml(item.label)}</span><b>${item.value === null ? "—" : `${item.value}%`}</b><small>${escapeHtml(item.detail)}</small></div>`).join("")}</div></div></section><section class="card effect-diagnostic-actions-card"><header><div><h3>行动清单 · 按优先级</h3><p>仅展示当前报告已返回、且可人工确认回流的建议。</p></div></header>${effectDiagnosticActionsMarkup(report)}</section></div><div class="effect-diagnostic-result-grid"><section class="card effect-diagnostic-evidence-card"><header><div><h3>诊断证据链</h3><p>每条记录均可按 evidence ID、采样时间和上游追溯号核验。</p></div></header>${effectDiagnosticEvidenceMarkup(records)}</section><section class="card effect-diagnostic-report-card"><header><div><h3>报告操作</h3><p>报告生成与建议回流都以本次运行的已验证 evidence 为边界。</p></div></header>${effectDiagnosticReportOperationMarkup(entry, report, verified.length)}</section></div></div>`;
}

function renderEffectDiagnosticWorkspaceLegacy() {
  if (!effectRelaySnapshot.attempted && !effectRelaySnapshot.loading) queueMicrotask(() => refreshEffectRelay({ renderAfter: true }));
  const brand = String(ui.effectDiagnosticBrand || "").trim();
  if (!brand) {
    return `<div class="page-container effect-demo-page effect-diagnostic-page">${pageHead("品牌诊断", "先输入品牌名称，再配置竞品、AI 推荐问题、平台与每个平台的独立采样次数。", '')}}${effectPagesTabs("effect-diagnostic")}<section class="card effect-diagnostic-start-card"><div class="effect-diagnostic-start-copy"><span class="effect-diagnostic-start-mark" aria-hidden="true">${icon("target")}</span><div><h2>从品牌名称开始</h2><p>品牌名称确认后，才会出现品牌配置、竞品配置与 AI 问题推荐。执行结果只读取客户服务端验收并写入 <code>diagnostic_evidence(live)</code> 的真实交付。</p></div></div><div class="effect-diagnostic-start-fields"><label class="effect-demo-input"><span>${icon("users")}品牌名称 <em>*</em></span><input id="effect-diagnostic-start-brand" value="${escapeHtml(ui.effectDiagnosticBrand)}" placeholder="请输入需要诊断的品牌名称" /></label><label class="effect-demo-input"><span>${icon("link")}官网地址</span><input id="effect-diagnostic-start-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com（可选）" /></label><button class="primary-button" type="button" data-action="effect-diagnostic-start">开始品牌配置 ${icon("arrow")}</button></div></section>${effectDiagnosticHistory()}</div>`;
  }
  const questions = effectDiagnosticQuestionList();
  const draftQuestions = effectDiagnosticDraftQuestions();
  const supportedItems = effectDiagnosticSupportedItems(ui.effectDiagnosticScopes, ui.effectDiagnosticModes, draftQuestions, { source: "effect_diagnostic", feature: "aidso_brand_diagnostic" });
  const quote = effectRelayQuoteFor("diagnostic");
  const entry = effectDiagnosticActiveEntry();
  const status = effectRelayRunStatus(entry?.link, entry?.run);
  const running = ui.effectDiagnosticSubmitting || ["pending", "submitted", "queued", "running"].includes(status);
  const aliases = effectDiagnosticAliases([brand, ...(ui.effectDiagnosticBrandTerms || [])]).filter((item) => item !== brand).join("、");
  const competitors = (ui.effectDiagnosticCompetitors || []).map((item) => `${item.name || ""}${item.terms ? `：${item.terms}` : ""}`).filter(Boolean).join("\n");
  const canQuote = Boolean(questions.length && (ui.effectDiagnosticScopes || []).length && (ui.effectDiagnosticModes || []).length && ui.effectDiagnosticExternalConsent && supportedItems.length);
  const competitorRows = effectDiagnosticCompetitorRows();
  const primaryAction = quote && ui.effectDiagnosticQuoteReady
    ? `<button class="primary-button" type="button" data-action="effect-diagnostic-submit" ${ui.effectDiagnosticSubmitting || !supportedItems.length ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? '<span class="loading-spinner"></span>正在提交…' : `${icon("send")}确认并提交品牌诊断`}</button>`
    : `<button class="primary-button" type="button" data-action="effect-diagnostic-quote" ${ui.effectDiagnosticSubmitting || !canQuote ? "disabled" : ""}>${ui.effectDiagnosticSubmitting ? '<span class="loading-spinner"></span>正在获取报价…' : `${icon("search")}冻结问题集并获取报价`}</button>`;
  const quoteSummary = quote && ui.effectDiagnosticQuoteReady
    ? `<div class="effect-search-quote-summary"><span data-icon="quote"></span><div><b>预估 ${Number(quote.estimatedCustomerCredits || 0).toLocaleString("zh-CN")} 积分</b><small>${supportedItems.length} 个独立采样任务；提交时检测服务会再次校验报价与额度。</small></div><button class="link-button" type="button" data-action="effect-diagnostic-quote-reset">重新报价</button></div>`
    : "";
  return `<div class="page-container effect-demo-page effect-diagnostic-page">${pageHead("品牌诊断", "将品牌与竞品配置、AI 问题推荐和跨平台独立采样串成一次可追溯的诊断。", '')}}${effectPagesTabs("effect-diagnostic")}${effectRelayStatusPanel({ entry, quote, scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, questions: draftQuestions, cancelAction: "effect-diagnostic-cancel", cancelRunId: ui.effectDiagnosticRunId })}<section class="card effect-diagnostic-wizard"><header><div><h3>${escapeHtml(brand)} 品牌诊断配置</h3><p>配置会在报价时冻结。每个“对话次数”是同一条件下的独立采样任务，不是虚构的连续聊天记录。</p></div><button class="secondary-button" type="button" data-action="effect-diagnostic-reset">更换品牌</button></header><div class="effect-diagnostic-wizard-body"><section class="effect-diagnostic-step"><header><span>1</span><div><h4>品牌配置</h4><p>确认品牌口径、官网、行业和别名。</p></div></header><div class="effect-demo-form"><label class="effect-demo-input"><span>${icon("users")}品牌名称 <em>*</em></span><input id="effect-diagnostic-brand" value="${escapeHtml(brand)}" /></label><label class="effect-demo-input"><span>${icon("link")}官网地址</span><input id="effect-diagnostic-site" value="${escapeHtml(ui.effectDiagnosticSite)}" placeholder="https://example.com（可选）" /></label><label class="effect-demo-input"><span>${icon("layers")}行业 / 场景</span><input id="effect-diagnostic-industry" value="${escapeHtml(ui.effectDiagnosticIndustry)}" placeholder="如：工业机器人" /></label><label class="effect-demo-input"><span>${icon("tag")}品牌词 / 别名</span><input id="effect-diagnostic-aliases" value="${escapeHtml(aliases)}" placeholder="用逗号分隔，如：品牌简称、产品词" /></label></div></section><section class="effect-diagnostic-step"><header><span>2</span><div><h4>竞品配置</h4><p>每行一个竞品，可写成“竞品品牌：竞品词、别名”。</p></div></header><label class="effect-demo-input full"><textarea id="effect-diagnostic-competitors" rows="3" placeholder="竞品 A：别名 A、产品词 A&#10;竞品 B">${escapeHtml(competitors)}</textarea><small class="effect-input-hint">竞品配置随本次任务保存；没有上游可验证字段时，不会生成竞争排名或胜负结论。</small></label></section><section class="effect-diagnostic-step"><header><span>3</span><div><h4>AI 问题推荐</h4><p>问题是诊断单元。可复制、编辑、删除，也可补充或重新生成推荐。</p></div><div class="effect-diagnostic-step-actions"><button class="link-button" type="button" data-action="effect-diagnostic-question-add">+ 添加问题</button><button class="link-button" type="button" data-action="effect-diagnostic-question-regenerate">重新生成</button></div></header>${effectDiagnosticQuestionRows()}</section><section class="effect-diagnostic-step"><header><span>4</span><div><h4>选择诊断平台</h4><p>平台、终端和模式只来自当前客户的服务配置。</p></div></header>${effectRelayCapabilityPicker({ scopes: ui.effectDiagnosticScopes, modes: ui.effectDiagnosticModes, scopeAttribute: "data-effect-diagnostic-platform-scope", selectAllAttribute: "data-effect-diagnostic-platform-select-all", modeAttribute: "data-effect-diagnostic-platform-mode" })}</section><section class="effect-diagnostic-step"><header><span>5</span><div><h4>设置每个平台的对话次数</h4><p>设置同一问题在该平台终端的独立采样次数；采样次数越高，越能观察回答波动。</p></div></header>${effectDiagnosticRoundRows()}</section><footer class="effect-diagnostic-submit"><div><b>预计执行 ${supportedItems.length} 次 AI 独立采样</b><small>${questions.length} 个问题 · ${(ui.effectDiagnosticScopes || []).length} 个平台终端 · ${(ui.effectDiagnosticModes || []).length} 种模式</small></div><span class="effect-demo-credit">${effectRelaySnapshot.quota?.availableCredits !== undefined ? `可用 ${Number(effectRelaySnapshot.quota.availableCredits).toLocaleString("zh-CN")} 积分` : "等待读取客户额度"}</span><label class="effect-search-consent"><input type="checkbox" data-effect-diagnostic-consent ${ui.effectDiagnosticExternalConsent ? "checked" : ""} /><span>我确认将品牌资料、竞品和冻结问题集提交给灼见 AI 检测服务执行</span></label>${quoteSummary}${primaryAction}</footer></div></section>${effectDiagnosticHistory(entry)}${renderVerifiedEffectDiagnosticReport(entry)}</div>`;
}

function renderEffectDiagnosticWorkspace() {
  if (!effectRelaySnapshot.attempted && !effectRelaySnapshot.loading) {
    queueMicrotask(() => refreshEffectRelay({ renderAfter: true }));
  }

  const entry = effectDiagnosticActiveEntry();
  const records = entry ? effectDiagnosticRecords(entry) : [];
  const brand = String(entry?.link?.request?.brand?.name || ui.effectDiagnosticBrand || "").trim();
  return `<div class="page-container effect-demo-page effect-diagnostic-page effect-aligned-page">
    ${effectAlignedPageHead({ eyebrow: "", title: "品牌诊断", accent: "看清品牌在 AI 回答中的认知结构", description: "以固定问题、平台范围和可验证证据为边界，输出可追溯的品牌诊断结果。" })}
    ${effectDiagnosticTaskCard(entry, records, { draft: !entry })}
    ${renderEffectDiagnosticWorkbench(entry)}
  </div>`;
}

function renderEffectDiagnostic() {
  ensureEffectDiagnosticDraft();
  return renderEffectDiagnosticWorkspace();
}

function renderEffectMonitor() {
  return renderRealEffectMonitor();
}
function renderRealMonitoring() {
  if (!monitoringSnapshot.loaded && !monitoringSnapshot.loading) queueMicrotask(() => refreshRealMonitoring({ silent: true }));
  if (!diagnosticSnapshot.loaded && !diagnosticSnapshot.loading && !diagnosticSnapshot.attempted) queueMicrotask(() => refreshOperationDiagnostics({ silent: true }));
  const actions = `<button class="secondary-button" type="button" data-action="refresh-monitoring" ${monitoringSnapshot.loading ? "disabled" : ""}><span data-icon="refresh"></span>刷新官网数据</button><button class="primary-button" type="button" data-action="run-monitoring-diagnostic" ${monitoringSnapshot.loading || monitoringDiagnosticRunInFlight || monitoringDiagnosticPollReportId ? "disabled" : ""}><span data-icon="shield"></span>运行网站诊断</button>`;
  return `<div class="page-container monitor-real-page diagnostic-page">${pageHead("抓取 / SEO 诊断", "查看官网访问、AI 与搜索爬虫、页面抓取、Schema、Meta 和链接状态；这些运行信号不等同于 AI 提及、推荐或排名。", actions)}<main class="diagnostic-content">${renderDiagnosticEvidencePage()}</main></div>`;
}

function renderMonitoring() {
  return renderRealMonitoring();
}


/* --------------------------------------------------------------------------
 * 官网运营 CMS 演示层
 *
 * 文章正文仍由内容生产中心维护；这里负责页面结构、栏目、官网字段、
 * 预览和发布信源。正式版可将这些演示常量替换为 site/page/category API。
 * -------------------------------------------------------------------------- */
const SITE_PAGE_DEFINITIONS = [
  { id: "home", type: "首页", title: "首页", path: "/", status: "published", description: "企业定位、核心服务、案例与咨询入口" },
  { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", description: "服务能力、适用对象与交付边界" },
  { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", description: "经过审核的客户案例与实施结果" },
  { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", description: "客户自定义栏目下的公开文章" },
  { id: "problem-map", type: "问题地图", title: "问题地图", path: "/problem-map/", status: "published", description: "按服务方向和行业整理客户真实问题" },
  { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", description: "企业主体、团队与发展信息" },
  { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", description: "咨询表单、服务区域与联系方式" }
];

const SITE_PRIMARY_PAGE_IDS = new Set(SITE_PAGE_DEFINITIONS.map((page) => page.id));

const SITE_CATEGORIES = [
  { id: "geo", name: "GEO优化", slug: "geo", level: 1, count: 8, status: "active", description: "企业 GEO 方法、信源建设与 AI 搜索" },
  { id: "enterprise-ai", name: "企业AI落地", slug: "enterprise-ai", level: 1, count: 5, status: "active", description: "企业知识、AI 应用与流程落地" },
  { id: "short-video", name: "短视频运营", slug: "short-video", level: 1, count: 4, status: "active", description: "短视频获客、账号运营与内容策略" },
  { id: "solutions", name: "应用方案", slug: "solutions", level: 1, count: 3, status: "active", description: "按行业和业务场景组织的解决方案" },
  { id: "procurement", name: "采购指南", slug: "procurement", level: 1, count: 2, status: "active", description: "选型、比较和采购决策问题" },
  { id: "archive", name: "历史归档", slug: "archive", level: 1, count: 6, status: "archived", description: "不再进入导航的历史栏目" }
];

const SITE_NAV_ITEMS = [
  ["首页", "/", "固定页面", "nav-home"],
  ["产品与服务", "/services/", "固定页面", "nav-services"],
  ["服务案例", "/cases/", "固定页面", "nav-cases"],
  ["行业资讯", "/insights/", "资讯列表", "nav-insights"],
  ["问题地图", "/problem-map/", "固定页面", "nav-problem-map"],
  ["关于我们", "/about/", "固定页面", "nav-about"],
  ["联系我们", "/contact/", "固定页面", "nav-contact"]
];

const SITE_SEMANTIC_MODULES = {
  home: [
    ["首屏", "企业定位、直接答案与主 CTA", "引用企业公共知识", "published", "hero"],
    ["直接答案", "用一段话回答客户最关心的问题", "AI 信源摘要", "published", "answer"],
    ["产品服务", "服务范围、适用对象和交付边界", "产品/业务线资料", "published", "services"],
    ["案例与证据", "案例、数据和可核验事实", "已审核案例库", "published", "proof"],
    ["最新资讯", "自动展示已发布文章和栏目", "行业资讯", "draft", "insights"],
    ["咨询 CTA", "联系表单与下一步行动", "线索表单", "published", "cta"]
  ],
  insights: [
    ["栏目说明", "栏目简介、AI 摘要和导航入口", "栏目配置", "published", "hero"],
    ["文章列表", "标题、摘要、作者、日期与主栏目", "官网文章", "published", "articles"],
    ["相关内容", "按业务线、标签和实体关联内容", "内容关联", "draft", "content"]
  ],
  services: [
    ["服务直接答案", "适合谁、解决什么问题、如何交付", "企业知识库", "published", "answer"],
    ["服务模块", "产品、能力、流程和边界", "产品/业务线资料", "published", "services"],
    ["FAQ 与 CTA", "常见问题、证据和咨询入口", "FAQ 知识库", "draft", "faq"]
  ],
  cases: [
    ["服务案例", "展示经过脱敏、审核并允许公开的实施案例", "已审核案例库", "published", "hero"],
    ["案例与证据", "按业务场景展示公开案例与实施依据", "企业案例知识库", "published", "proof"],
    ["咨询 CTA", "提交业务场景并了解实施路径", "线索表单", "published", "cta"]
  ],
  "problem-map": [
    ["问题地图", "按服务方向和行业整理客户真实问题", "问题词库与已发布文章", "published", "hero"],
    ["客户正在问什么", "按服务方向、行业与决策阶段组织问题", "已审核问题地图", "published", "problem-map"],
    ["提交企业问题", "没有找到问题时进入咨询入口", "线索表单", "published", "cta"]
  ]
};

function sitePageDefinition(id = ui.sitePageId) {
  const pages = sitePages();
  return pages.find((item) => item.id === id) || pages[0];
}

function siteCms() {
  return state.site.cms;
}

function siteCmsAssets() {
  const cms = siteCms();
  if (!cms.assets || typeof cms.assets !== "object" || Array.isArray(cms.assets)) cms.assets = {};
  if (!cms.assets.defaultImageUrl) cms.assets.defaultImageUrl = "/assets/template-01-default.png";
  if (!cms.assets.defaultImageAlt) cms.assets.defaultImageAlt = "企业默认图片";
  return cms.assets;
}

function siteCmsFooter() {
  const cms = siteCms();
  if (!cms.footer || typeof cms.footer !== "object" || Array.isArray(cms.footer)) cms.footer = {};
  if (!Array.isArray(cms.footer.columns)) cms.footer.columns = [];
  if (!Array.isArray(cms.footer.socialLinks)) cms.footer.socialLinks = [];
  return cms.footer;
}

function siteTemplateConfigs() {
  const cms = siteCms();
  if (!cms.templateConfigs || typeof cms.templateConfigs !== "object" || Array.isArray(cms.templateConfigs)) cms.templateConfigs = {};
  SITE_TEMPLATE_REGISTRY.forEach((template) => {
    if (!cms.templateConfigs[template.key] || typeof cms.templateConfigs[template.key] !== "object") cms.templateConfigs[template.key] = {};
    if (!cms.templateConfigs[template.key].defaultImageUrl && template.defaultImage) cms.templateConfigs[template.key].defaultImageUrl = `/assets/${template.defaultImage}`;
    if (!cms.templateConfigs[template.key].defaultImageAlt) cms.templateConfigs[template.key].defaultImageAlt = `${template.shortName}默认图片`;
  });
  return cms.templateConfigs;
}

function sitePages() {
  const cms = siteCms();
  if (!Array.isArray(cms.pages)) cms.pages = [];
  const rows = cms.pages;
  SITE_PAGE_DEFINITIONS.forEach((definition) => {
    if (rows.some((page) => page.id === definition.id)) return;
    rows.push({ ...cloneData(definition), seoDescription: definition.description, schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: null, publishedAt: definition.status === "published" ? siteNow() : null });
  });
  const primary = SITE_PAGE_DEFINITIONS.map((definition) => rows.find((page) => page.id === definition.id)).filter(Boolean);
  const extensions = rows.filter((page) => !SITE_PRIMARY_PAGE_IDS.has(page.id));
  return [...primary, ...extensions];
}

function sitePrimaryPages() {
  return sitePages().filter((page) => SITE_PRIMARY_PAGE_IDS.has(page.id));
}

function siteExtensionPages() {
  return sitePages().filter((page) => !SITE_PRIMARY_PAGE_IDS.has(page.id));
}

function siteModules(pageId) {
  const modules = siteCms().modules?.[pageId];
  if (Array.isArray(modules)) return modules;
  const legacy = SITE_SEMANTIC_MODULES[pageId] || [["正文", "结构化页面正文和直接答案", "页面内容", "draft"], ["相关内容", "关联文章、案例与 FAQ", "内容库", "draft"], ["CTA", "页面行动入口", "公共组件", "published"]];
  siteCms().modules[pageId] = legacy.map((module, index) => ({ id: `${pageId}-legacy-${index}`, title: module[0], description: module[1], source: module[2], status: module[3], type: module[4] || "content", content: "" }));
  return siteCms().modules[pageId];
}

function siteCategories(includeArchived = false) {
  const categories = siteCms().categories || SITE_CATEGORIES;
  return includeArchived ? categories : categories.filter((item) => item.status !== "archived");
}

function siteServices(includeArchived = true) {
  const cms = siteCms();
  if (!Array.isArray(cms.services)) cms.services = [];
  const rows = [...cms.services].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
  return includeArchived ? rows : rows.filter((item) => item.status !== "archived");
}

function siteCases(includeArchived = true) {
  const cms = siteCms();
  if (!Array.isArray(cms.cases)) cms.cases = [];
  const rows = [...cms.cases].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
  return includeArchived ? rows : rows.filter((item) => item.status !== "archived");
}

function siteProblemGroups(includeArchived = true) {
  const cms = siteCms();
  if (!Array.isArray(cms.problemGroups)) cms.problemGroups = [];
  const rows = [...cms.problemGroups].map((group) => ({ ...group, questions: [...(group.questions || [])].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999)) })).sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
  return includeArchived ? rows : rows.filter((item) => item.status !== "archived");
}

function siteRecordStatus(status) {
  if (status === "published") return '<span class="status-badge status-approved">公开</span>';
  if (status === "archived") return '<span class="status-badge status-draft">已归档</span>';
  return '<span class="status-badge status-review">草稿</span>';
}

function siteCommaList(value) {
  return String(value || "").split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
}

function siteNavItems() {
  const cms = siteCms();
  if (!Array.isArray(cms.navItems)) cms.navItems = [];
  const normalized = cms.navItems.map((item, index) => Array.isArray(item) ? { id: `legacy-nav-${index}`, label: item[0], path: item[1], type: item[2], visible: true } : item);
  cms.navItems = normalized;
  const extensionPaths = new Set(siteExtensionPages().map((page) => page.path));
  normalized.forEach((item) => {
    if (item.path === "/faq/" || extensionPaths.has(item.path) || String(item.path || "").startsWith("/topics/")) item.visible = false;
  });
  const canonical = SITE_NAV_ITEMS.map(([label, path, type, id], index) => {
    const existing = normalized.find((item) => item.id === id || item.path === path);
    if (existing) return existing;
    const item = { id: id || `nav-${path === "/" ? "home" : path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || index + 1}`, label, path, type, visible: true };
    cms.navItems.push(item);
    normalized.push(item);
    return item;
  });
  return [...canonical, ...normalized.filter((item) => !canonical.includes(item))];
}

function siteLeads() {
  if (siteCmsRuntime.loaded) return siteCmsRuntime.leads || [];
  return siteCms().leads || [];
}

function siteNow() {
  return new Date().toISOString();
}

function siteDisplayTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

function sitePath(value, fallback = "/") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function siteSlug(value, fallback = "page") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function siteAddRedirect(from, to, reason = "地址变更") {
  const source = sitePath(from);
  const target = sitePath(to);
  if (source === target) return null;
  const redirects = siteCms().redirects;
  const existing = redirects.find((item) => item.from === source);
  if (existing) {
    existing.to = target;
    existing.reason = reason;
    existing.status = "active";
    existing.updatedAt = siteNow();
    return existing;
  }
  const redirect = { id: uid("REDIRECT"), from: source, to: target, status: "active", reason, createdAt: siteNow(), updatedAt: siteNow() };
  redirects.unshift(redirect);
  return redirect;
}

function siteCategoryCount(category) {
  return (state.articles || []).filter((article) => article.siteCategory === category.name || article.category === category.name || article.category === category.id).length || category.count || 0;
}

function siteArticleStatus(article) {
  if (article.siteStatus === "published") return statusBadge("published");
  if (article.status === "published") return statusBadge("published");
  if (article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length) return '<span class="status-badge status-approved">待发布</span>';
  if (article.reviewStatus === "approved") return '<span class="status-badge status-review">待补证据</span>';
  return statusBadge("pending_review");
}

function siteTabs() {
  const activeTab = ui.siteTab === "templates" ? "navigation" : ui.siteTab;
  const tabs = [
    ["overview", "官网概览"],
    ["pages", "页面管理"],
    ["catalog", "服务与案例"],
    ["problems", "问题地图"],
    ["insights", "行业资讯"],
    ["navigation", "导航与外观"],
    ["seo", "SEO 与 AI 信号"],
    ["leads", "咨询线索"],
    ["releases", "发布历史"]
  ];
  return '<div class="tabs site-cms-tabs">' + tabs.map(([id, label]) => '<button class="tab-button ' + (activeTab === id ? "active" : "") + '" type="button" data-action="site-tab" data-tab="' + id + '">' + label + "</button>").join("") + "</div>";
}

function siteImageStats() {
  const cms = siteCms();
  const records = [
    ...siteServices(false),
    ...siteCases(false),
    ...sitePages().flatMap((page) => siteModules(page.id)),
    ...(state.articles || [])
  ];
  const withImage = records.filter((item) => item.image || item.coverImage || item.siteImage || item.thumbnail).length;
  return { total: records.length, withImage, withoutImage: Math.max(0, records.length - withImage), modules: Object.values(cms.modules || {}).flat().filter(Boolean).length };
}

function renderSiteTemplates() {
  const current = siteTemplate();
  const cards = SITE_TEMPLATE_REGISTRY.map((template, index) => {
    const active = template.key === current.key;
    const ready = template.sourceReady !== false;
    const supports = (template.supports || []).slice(0, 4).join(" · ");
    const layout = String(template.layout || "industrial-grid").replace(/[^a-z0-9-]/gi, "-");
    const thumbSrc = template.defaultImage || `template-${String(index + 1).padStart(2, "0")}-default.png`;
    const status = active ? '<span class="status-badge status-approved">当前使用</span>' : ready ? '<span class="status-badge status-draft">可切换</span>' : '<span class="status-badge status-pending">待适配</span>';
    const action = active ? `<button class="secondary-button button-small" type="button" disabled>当前模板</button>` : ready ? `<button class="primary-button button-small" type="button" data-action="site-select-template" data-template-key="${escapeHtml(template.key)}">应用到草稿</button>` : `<button class="secondary-button button-small" type="button" disabled>正在适配原始页面</button>`;
    return `<article class="site-template-card ${active ? "active" : ""} ${ready ? "" : "is-pending"}" style="--template-accent:${escapeHtml(template.accent)}"><div class="site-template-preview"><img src="/assets/${escapeHtml(thumbSrc)}" alt="${escapeHtml(template.name)}官网模板缩略图" /></div><div class="site-template-card-body"><div class="site-template-card-head"><span class="small-tag">${String(index + 1).padStart(2, "0")}</span>${status}</div><h3>${escapeHtml(template.name)}</h3><p>${escapeHtml(template.description)}</p><small class="site-template-support">${escapeHtml(supports)}</small>${action}</div></article>`;
  }).join("");
  return `<section class="site-template-section" aria-labelledby="site-template-section-title"><div class="site-template-section-head"><div><span class="small-tag blue">展示结构</span><h3 id="site-template-section-title">官网模板</h3><p>模板只负责页面结构和视觉表达；企业内容、图片、Logo、联系方式和公共信息都由下方的 CMS 配置。</p></div><div class="site-template-current-label"><span class="site-template-current-dot" style="background:${escapeHtml(current.accent)}"></span><span>当前使用：<b>${escapeHtml(current.shortName)}</b></span></div></div><div class="site-template-notice"><span class="site-source-note-icon" data-icon="layers"></span><div><b>模板是展示层，CMS 内容是数据层</b><p>切换模板不会删除文章、服务或案例；有配置图片就展示真实资源，没有图片时由模板使用统一的默认图片策略。</p></div><button class="secondary-button button-small" type="button" data-action="site-page-preview" data-page-id="home"><span data-icon="eye"></span>预览当前模板</button></div><div class="site-template-grid">${cards}</div></section>`;
}

function renderSiteOverview() {
  const articles = state.articles || [];
  const pages = sitePrimaryPages();
  const leads = siteLeads();
  const pendingLeads = leads.filter((lead) => lead.status === "new").length;
  const published = articles.filter((article) => article.status === "published" || article.siteStatus === "published").length;
  const approved = articles.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length;
  const imageStats = siteImageStats();
  const current = siteTemplate();
  return `
    <div class="site-cms-overview">
      <section class="site-hero-card site-hero-card-reworked card"><div class="site-hero-copy"><span class="eyebrow">官网运营</span><h2>用一套清晰的后台，管理官网内容与展示。</h2><p>模板决定行业表达，CMS 决定企业事实。内容、图片、预览和正式发布都从这里完成。</p><div class="site-hero-actions"><button class="primary-button button-small" type="button" data-action="site-tab" data-tab="navigation"><span data-icon="layers"></span>配置导航与外观</button><button class="secondary-button button-small" type="button" data-action="site-tab" data-tab="insights"><span data-icon="file"></span>管理文章内容</button></div></div><div class="site-current-template-mini" style="--template-accent:${escapeHtml(current.accent)}"><span>当前官网模板</span><strong>${escapeHtml(current.shortName)}</strong><small>${escapeHtml(current.name)}</small><i></i></div></section>
      <div class="stats-grid site-stat-grid">
        <div class="stat-card"><span class="stat-icon blue" data-icon="layout"></span><div><small>固定页面</small><b>${pages.length}</b><em>页</em></div></div>
        <div class="stat-card"><span class="stat-icon purple" data-icon="file"></span><div><small>官网文章</small><b>${published}</b><em>篇已发布</em></div></div>
        <div class="stat-card"><span class="stat-icon teal" data-icon="image"></span><div><small>已配置图片</small><b>${imageStats.withImage}</b><em>/ ${imageStats.total || 0} 个内容项</em></div></div>
        <div class="stat-card"><span class="stat-icon orange" data-icon="message"></span><div><small>待跟进线索</small><b>${pendingLeads}</b><em>条 · 待发布 ${approved}</em></div></div>
      </div>
      <section class="site-cms-grid"><section class="card"><div class="card-header"><div><h3>当前工作流</h3><p>四步完成一次官网更新，文章正文仍只在内容生产中心维护。</p></div><span class="small-tag blue">${escapeHtml(state.site.domain || "尚未配置域名")}</span></div><div class="site-publish-flow"><div class="site-flow-step done"><i>1</i><b>内容生产</b><small>写作与审核</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step active"><i>2</i><b>官网配置</b><small>模板、栏目、图片</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step"><i>3</i><b>草稿预览</b><small>检查真实展示</small></div><span class="site-flow-arrow">→</span><div class="site-flow-step"><i>4</i><b>正式发布</b><small>生成可回滚版本</small></div></div></section><section class="card site-image-health"><div class="card-header"><div><h3>图片配置状态</h3><p>图片不是必填项，空图片会自动使用无图布局。</p></div><button class="text-button" type="button" data-action="site-tab" data-tab="catalog">去配置</button></div><div class="site-image-meter"><div><strong>${imageStats.withImage}</strong><span>有图片</span></div><div><strong>${imageStats.withoutImage}</strong><span>无图片</span></div></div><div class="site-image-rule"><span class="check-dot ok">✓</span><span>不会因为缺图生成空白图片框或破坏版式。</span></div></section></section>
      <section class="card"><div class="card-header"><div><h3>最近官网发布</h3><p>仅显示已通过审核并生成官网版本的内容。</p></div><button class="text-button" type="button" data-action="site-tab" data-tab="insights">查看全部</button></div><div class="site-recent-list">${articles.filter((article) => article.status === "published" || article.reviewStatus === "approved").slice(0, 4).map((article) => `<div class="site-recent-item"><span class="site-recent-type">${escapeHtml(article.category || "行业资讯")}</span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.author || "企业内容团队")} · ${formatRelative(article.updatedAt)}</small></div><span>${siteArticleStatus(article)}</span></div>`).join("")}</div></section>
    </div>
  `;
}
