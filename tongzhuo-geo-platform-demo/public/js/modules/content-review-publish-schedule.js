// Publishing schedule helpers and rendering.
// Kept as a classic-script module to preserve the existing global action API.

function taskAggregateStatus(task) {
  const statuses = Object.values(task?.targets || {}).map((target) => target?.status);
  if (statuses.some((status) => ["queued", "running"].includes(status))) return "running";
  if (statuses.every((status) => status === "success")) return "success";
  if (statuses.some((status) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(status))) return "partial";
  return "queued";
}
function scheduleDefaultSelection(articleIds = []) {
  const group = state.accountGroups[0];
  const platforms = ["web", ...Object.keys(group?.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform)).map(canonicalPublishPlatformId)];
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    articleIds: [...new Set(articleIds)],
    groupId: group?.id || null,
    platforms,
    platformOrder: [...platforms],
    quotaMode: "dailyCount",
    dailyCount: 3,
    finishDays: 3,
    intervalMinutes: 60,
    startDate,
    dailyStart: "09:00",
    dailyEnd: "18:00",
    mode: "daily"
  };
}

function openScheduleForArticles(articleIds = [], sourcePlanId = null) {
  const ids = [...new Set(articleIds)].filter((id) => state.articles.some((article) => article.id === id));
  if (!ids.length) return showToast("请先选择文章", "定时发布需要先选择至少一篇文章。", "error");
  const eligible = ids.filter((id) => articlePublishEligibility(state.articles.find((article) => article.id === id)).ok);
  if (!eligible.length) return showToast("没有可排期文章", "选中的文章必须完成审核、风控和知识证据冻结。", "error");
  ui.scheduleSelection = { ...scheduleDefaultSelection(ids), sourcePlanId };
  ui.modal = { type: "schedule" };
  renderModal();
}

function scheduleArticles(selection) {
  const selected = new Set(selection?.articleIds || []);
  return state.articles.filter((article) => selected.has(article.id) && articleScheduleEligibility(article, selection).ok);
}

function scheduleDateWithOffset(date, minutes) {
  const parts = String(date || "").split("-").map(Number);
  const value = parts.length === 3 && parts.every(Number.isFinite)
    ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
    : new Date();
  value.setHours(0, Number(minutes) || 0, 0, 0);
  return value;
}

function scheduleCapacity(selection, articleCount) {
  const platforms = selection?.platformOrder || selection?.platforms || [];
  const [startHour, startMinute] = String(selection?.dailyStart || "09:00").split(":").map(Number);
  const [endHour, endMinute] = String(selection?.dailyEnd || "18:00").split(":").map(Number);
  const dayStart = startHour * 60 + startMinute;
  const dayEnd = endHour * 60 + endMinute;
  const interval = Math.max(5, Number(selection?.intervalMinutes) || 60);
  const requestedDaily = selection?.quotaMode === "finishDays"
    ? Math.max(1, Math.ceil(articleCount / Math.max(1, Number(selection?.finishDays) || 1)))
    : Math.max(1, Number(selection?.dailyCount) || 1);
  const targetSlots = dayEnd >= dayStart ? Math.floor((dayEnd - dayStart) / interval) + 1 : 0;
  const timeCapacity = platforms.length ? Math.floor(targetSlots / platforms.length) : 0;
  const effectiveDaily = Math.max(0, Math.min(requestedDaily, timeCapacity));
  return { platforms, dayStart, dayEnd, interval, requestedDaily, targetSlots, timeCapacity, effectiveDaily, limited: effectiveDaily < requestedDaily };
}

function schedulePreviewItems(selection = ui.scheduleSelection) {
  if (!selection) return [];
  const articles = scheduleArticles(selection);
  const capacity = scheduleCapacity(selection, articles.length);
  if (!articles.length || !capacity.platforms.length || !capacity.effectiveDaily) return [];
  const items = [];
  for (let offset = 0, dayIndex = 0; offset < articles.length; offset += capacity.effectiveDaily, dayIndex += 1) {
    const dayArticles = articles.slice(offset, offset + capacity.effectiveDaily);
    const startDate = scheduleDateWithOffset(selection.startDate, 0);
    startDate.setDate(startDate.getDate() + dayIndex);
    const localDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    dayArticles.forEach((article, articleIndex) => {
      const existingPlatforms = articleExistingPublishPlatforms(article);
      const targetTimes = capacity.platforms.map((platform, platformIndex) => {
        const sequence = platformIndex * dayArticles.length + articleIndex;
        const scheduledAt = scheduleDateWithOffset(localDate, capacity.dayStart + sequence * capacity.interval);
        return { platform, scheduledAt: scheduledAt.toISOString() };
      }).filter((target) => !existingPlatforms.has(target.platform));
      items.push({
        order: offset + articleIndex + 1,
        articleId: article.id,
        articleTitle: article.title,
        version: article.version,
        scheduledAt: targetTimes[0].scheduledAt,
        completesAt: targetTimes.at(-1).scheduledAt,
        targetTimes,
        platformNames: targetTimes.map((target) => PLATFORM_META[target.platform]?.name || target.platform)
      });
    });
  }
  return items;
}

function scheduleTimeLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function scheduleTimeRangeLabel(item) {
  if (!item?.scheduledAt) return "—";
  const start = scheduleTimeLabel(item.scheduledAt);
  if (!item.completesAt || item.completesAt === item.scheduledAt) return start;
  const end = new Date(item.completesAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${start} — ${end}`;
}

function schedulePlatformChoices(selection, group) {
  const entries = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled && (entry.category === "self_media" || entry.id === "web"));
  return entries.map((entry) => {
    const platform = entry.id;
    const isWeb = platform === "web";
    const connection = isWeb ? { account: { name: state.site.domain, status: "online" }, status: "online", ready: true } : publisherAccountConnection(group, platform);
    const account = connection.account;
    const available = isWeb || (publisherPlatformSelectable(platform) && connection.ready);
    const selected = (selection.platforms || []).includes(platform) && available;
    const help = isWeb ? "服务器发布" : publisherConnectionMessage(connection);
    return `<label class="platform-choice schedule-platform-choice ${selected ? "selected" : ""} ${available ? "" : "disabled"}"><input class="checkbox" type="checkbox" data-schedule-platform="${platform}" ${selected ? "checked" : ""} ${available ? "" : "disabled"} />${platformLogo(platform)}<span><b>${escapeHtml(publishPlatformName(platform))}</b><small>${escapeHtml(help)}</small></span>${statusBadge(available ? "online" : connection.status || "needs_login")}</label>`;
  }).join("");
}

function renderScheduleModal() {
  const selection = ui.scheduleSelection || scheduleDefaultSelection([]);
  const selectedArticles = state.articles.filter((article) => (selection.articleIds || []).includes(article.id));
  const eligible = selectedArticles.filter((article) => articleScheduleEligibility(article, selection).ok);
  const excluded = selectedArticles.filter((article) => !articleScheduleEligibility(article, selection).ok);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  const groups = state.accountGroups.map((item) => `<option value="${item.id}" ${item.id === group?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  const capacity = scheduleCapacity(selection, eligible.length);
  const preview = schedulePreviewItems(selection);
  const previewRows = preview.slice(0, 10).map((item) => `<tr><td><b>${item.order}</b></td><td class="schedule-preview-title">${escapeHtml(item.articleTitle)}<small>${escapeHtml(item.articleId)} · ${escapeHtml(item.version)}</small></td><td><span class="schedule-platform-chips">${(item.targetTimes || []).map((target) => `<em>${escapeHtml(PLATFORM_META[target.platform]?.name || target.platform)} ${new Date(target.scheduledAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</em>`).join("")}</span></td><td><b>${scheduleTimeRangeLabel(item)}</b></td></tr>`).join("");
  const days = preview.length ? Math.max(1, Math.ceil((new Date(preview.at(-1).scheduledAt) - new Date(preview[0].scheduledAt)) / 86400000) + 1) : 0;
  const expectedCompletionAt = preview.at(-1)?.completesAt || preview.at(-1)?.scheduledAt || null;
  const orderedPlatforms = selection.platformOrder || selection.platforms || [];
  const orderChips = orderedPlatforms.map((platform, index) => `<span class="schedule-order-chip">${index + 1}. ${escapeHtml(PLATFORM_META[platform]?.name || platform)}<button type="button" data-action="move-schedule-platform" data-platform="${platform}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-schedule-platform" data-platform="${platform}" data-direction="down" ${index === orderedPlatforms.length - 1 ? "disabled" : ""}>↓</button></span>`).join("");
  const excludedHtml = excluded.length ? `<div class="schedule-warning"><span data-icon="alert"></span><span>${excluded.length} 篇不能排期：${excluded.map((article) => `${escapeHtml(article.title)}（${escapeHtml(articleScheduleEligibility(article, selection).reason)}）`).join("、")}</span></div>` : "";
  const requestedDailyLabel = selection.quotaMode === "finishDays" ? `目标 ${Math.max(1, Math.ceil(eligible.length / Math.max(1, Number(selection.finishDays) || 1)))} 篇/天` : `目标 ${Math.max(1, Number(selection.dailyCount) || 1)} 篇/天`;
  const quotaDescription = `${requestedDailyLabel}，实际每天 ${capacity.effectiveDaily || 0} 篇，预计 ${days} 天完成`;
  const capacityWarning = capacity.limited ? `；按 ${capacity.platforms.length} 个平台和 ${capacity.interval} 分钟间隔，每天最多容纳 ${capacity.timeCapacity} 篇` : "";
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">创建定时发布</h2><p>只排期已完成人工审核的文章；文章数按文章计算，平台按顺序逐个执行</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body schedule-modal-body"><section class="schedule-section"><div class="schedule-section-head"><div><h3>发布文章</h3><p>本次选择 ${selectedArticles.length} 篇，可排期 ${eligible.length} 篇</p></div><span class="small-tag blue">${eligible.length} 篇文章</span></div>${excludedHtml}<div class="schedule-article-summary">${eligible.slice(0, 6).map((article) => `<span>${escapeHtml(article.title)}</span>`).join("")}${eligible.length > 6 ? `<span>+${eligible.length - 6} 篇</span>` : ""}</div></section><section class="schedule-section"><div class="schedule-section-head"><div><h3>账号组与平台</h3><p>同一平台只绑定一个本地账号；平台顺序决定助手执行队列</p></div></div><label class="field"><span>发布账号组</span><select class="select" id="schedule-group" data-schedule-group>${groups}</select></label><div class="publish-platforms schedule-platforms">${schedulePlatformChoices(selection, group)}</div><div class="schedule-order-row"><span>执行顺序</span><div class="schedule-order-chips">${orderChips || '<small>请先选择平台</small>'}</div></div></section><section class="schedule-section"><div class="schedule-section-head"><div><h3>排期规则</h3><p>一个平台发送完一篇后等待设定间隔，再发送该平台的下一篇</p></div></div><div class="schedule-mode-tabs"><label class="schedule-mode-card ${selection.quotaMode === "dailyCount" ? "active" : ""}"><input type="radio" name="schedule-quota-mode" data-schedule-quota-mode value="dailyCount" ${selection.quotaMode === "dailyCount" ? "checked" : ""} /><b>按每天数量</b><small>例如每天发布3篇，系统计算完成天数</small></label><label class="schedule-mode-card ${selection.quotaMode === "finishDays" ? "active" : ""}"><input type="radio" name="schedule-quota-mode" data-schedule-quota-mode value="finishDays" ${selection.quotaMode === "finishDays" ? "checked" : ""} /><b>按完成天数</b><small>例如5天完成，系统计算每天数量</small></label></div><div class="field-row schedule-fields"><label class="field"><span>开始日期</span><input class="input" type="date" id="schedule-start-date" value="${escapeHtml(selection.startDate)}" /></label><label class="field"><span>每天开始时间</span><input class="input" type="time" id="schedule-daily-start" value="${escapeHtml(selection.dailyStart)}" /></label><label class="field"><span>每天结束时间</span><input class="input" type="time" id="schedule-daily-end" value="${escapeHtml(selection.dailyEnd)}" /></label><label class="field"><span>文章间隔（分钟）</span><input class="input" type="number" min="5" max="1440" step="5" id="schedule-interval" value="${escapeHtml(selection.intervalMinutes)}" /></label>${selection.quotaMode === "dailyCount" ? `<label class="field"><span>每天发布文章数</span><input class="input" type="number" min="1" max="50" id="schedule-daily-count" value="${escapeHtml(selection.dailyCount)}" /></label>` : `<label class="field"><span>计划完成天数</span><input class="input" type="number" min="1" max="90" id="schedule-finish-days" value="${escapeHtml(selection.finishDays)}" /></label>`}</div><div class="schedule-rule-note"><span data-icon="clock"></span><span>${quotaDescription}${capacityWarning}；如果助手离线，恢复后会按平台顺序继续执行，不会集中补发。</span></div><div class="schedule-completion"><span data-icon="check"></span><div><small>预计完成时间</small><b>${expectedCompletionAt ? escapeHtml(scheduleTimeLabel(expectedCompletionAt)) : "调整规则后计算"}</b></div></div></section><section class="schedule-section schedule-preview-section"><div class="schedule-section-head"><div><h3>发布时间预览</h3><p>每行仍是一篇文章；平台列显示该文章在各平台的执行时间</p></div><span class="small-tag">${preview.length} 篇</span></div>${preview.length ? `<div class="table-scroll"><table class="data-table schedule-preview-table"><thead><tr><th>#</th><th>文章</th><th>平台及时间</th><th>计划时间范围</th></tr></thead><tbody>${previewRows}</tbody></table></div>${preview.length > 10 ? `<small class="schedule-more-note">还有 ${preview.length - 10} 篇文章将在后续日期执行。</small>` : ""}` : '<div class="schedule-empty">请先选择可用平台和文章排期规则。</div>'}</section></div><div class="modal-foot"><span>审核通过后版本会在排期时冻结</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-schedule" ${eligible.length && selection.platforms?.length && preview.length && !ui.submittingSchedule ? "" : "disabled"}>${ui.submittingSchedule ? '<span class="loading-spinner"></span>正在保存' : '<span data-icon="clock"></span>创建排期'}</button></div></div>`, { wide: true });
}


async function submitSchedule() {
  if (!(await ensurePublisherIntegration())) return;
  if (ui.submittingSchedule || !ui.scheduleSelection) return;
  const selection = ui.scheduleSelection;
  const articles = scheduleArticles(selection);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  const platforms = (selection.platformOrder || selection.platforms || []).filter((platform) => platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform)));
  if (!articles.length) return showToast("没有可排期文章", "请先完成文章审核。", "error");
  if (!platforms.length) return showToast("请至少选择一个平台", "平台账号需要在本地发布器中登录。", "error");
  const preview = schedulePreviewItems({ ...selection, articleIds: articles.map((article) => article.id), platforms, platformOrder: platforms });
  const schedule = {
    id: uid("SCH"),
    businessLineId: activeBusinessLine()?.id || null,
    source: selection.sourcePlanId ? "内容计划" : "文章任务",
    sourcePlanId: selection.sourcePlanId || null,
    articleIds: articles.map((article) => article.id),
    articleVersions: Object.fromEntries(articles.map((article) => [article.id, article.version])),
    articleTitles: Object.fromEntries(articles.map((article) => [article.id, article.title])),
    groupId: group?.id || null,
    groupName: group?.name || "未选择账号组",
    platforms,
    platformOrder: platforms,
    quotaMode: selection.quotaMode,
    dailyCount: Number(selection.dailyCount) || null,
    finishDays: Number(selection.finishDays) || null,
    intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
    startDate: selection.startDate,
    dailyStart: selection.dailyStart,
    dailyEnd: selection.dailyEnd,
    expectedCompletionAt: preview.at(-1)?.completesAt || preview.at(-1)?.scheduledAt || null,
    status: "scheduled",
    createdAt: Date.now(),
    remoteJobIds: [],
    items: preview.map((item) => ({
      ...item,
      status: "waiting",
      targets: (item.targetTimes || []).filter((target) => !articleExistingPublishPlatforms(state.articles.find((article) => article.id === item.articleId)).has(target.platform)).map((target) => ({
        platform: target.platform,
        account: target.platform === "web" ? state.site.domain : publisherAccount(group, target.platform)?.name || "未绑定账号",
        scheduledAt: target.scheduledAt,
        status: "waiting",
        remoteJobId: null
      }))
    }))
  };
  ui.submittingSchedule = true;
  renderModal();
  const createdRemoteIds = [];
  try {
    for (const item of schedule.items) {
      const article = state.articles.find((entry) => entry.id === item.articleId);
      if (!article) continue;
      const formal = await contentPublisherPayload(article);
      for (const target of item.targets) {
        const result = await publisherApi("/api/publisher/jobs", {
          method: "POST",
          body: {
            ...formal,
            webUrl: publisherArticleWebUrl(article),
            accountGroupId: group?.id,
            groupName: group?.name,
            platforms: [target.platform],
            platformOrder: [target.platform],
            intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
            mode: "scheduled",
            scheduledAt: target.scheduledAt
          }
        });
        target.remoteJobId = result.job?.id || null;
        if (target.remoteJobId !== null) createdRemoteIds.push(target.remoteJobId);
      }
    }
    if (!createdRemoteIds.length) throw new Error("没有可创建的排期目标，请确认文章和平台尚未存在相同任务。");
    schedule.remoteJobIds = createdRemoteIds;
    state.publishSchedules = Array.isArray(state.publishSchedules) ? state.publishSchedules : [];
    state.publishSchedules.unshift(schedule);
    saveState();
    ui.submittingSchedule = false;
    closeModal();
    await refreshPublisherSnapshot();
    ui.publishTab = "running";
    navigate("publish");
    showToast("定时发布排期已创建", `${schedule.articleIds.length} 篇文章、${createdRemoteIds.length} 个平台目标已按预览时间交给发布器。`);
  } catch (error) {
    await Promise.all(createdRemoteIds.map((id) => publisherApi(`/api/publisher/jobs/${id}/cancel`, { method: "POST" }).catch(() => null)));
    ui.submittingSchedule = false;
    renderModal();
    showToast("排期创建失败", error.message, "error");
  }
}

async function cancelPublishSchedule(scheduleId) {
  const schedule = (state.publishSchedules || []).find((item) => item.id === scheduleId);
  if (!schedule) return;
  if (!(await uiConfirm("确认取消该定时排期？已创建的远程任务会被逐个取消，且无法恢复。"))) return;
  if (!(await ensurePublisherIntegration())) return;
  const remoteIds = [...new Set((schedule.items || []).flatMap((item) => (item.targets || []).map((target) => target.remoteJobId).filter(Boolean)))];
  try {
    const results = await Promise.all(remoteIds.map((id) => publisherApi(`/api/publisher/jobs/${id}/cancel`, { method: "POST" })));
    const cancelled = new Set(results.filter((result) => result.job?.status === "cancelled").map((result) => String(result.job.id)));
    (schedule.items || []).forEach((item) => {
      (item.targets || []).forEach((target) => {
        if (cancelled.has(String(target.remoteJobId))) target.status = "cancelled";
      });
      if ((item.targets || []).every((target) => target.status === "cancelled")) item.status = "cancelled";
    });
  } catch (error) {
    return showToast("取消排期失败", error.message || "存在已开始执行的任务，请在任务详情中处理。", "error");
  }
  schedule.status = "cancelled";
  saveState();
  await refreshPublisherSnapshot();
  render();
  showToast("未来排期已取消", "已经执行的发布任务不会被回滚。", "success");
}

function renderPublishSchedules() {
  const schedules = (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled" && (schedule.businessLineId === activeBusinessLine()?.id || !schedule.businessLineId));
  if (!schedules.length) return `<section class="card publish-schedule-empty"><div><span data-icon="clock"></span><div><h3>还没有定时发布排期</h3><p>在文章任务中完成审核后，选择文章即可创建发布节奏。</p></div><button class="secondary-button button-small" type="button" data-nav="content"><span data-icon="file"></span>去文章任务</button></div></section>`;
  const cards = schedules.map((schedule) => {
    const items = schedule.items || [];
    const first = items[0]?.scheduledAt;
    const lastItem = items.at(-1);
    const last = lastItem?.targets?.at(-1)?.scheduledAt || lastItem?.completesAt || lastItem?.scheduledAt;
    const status = schedule.status === "completed" ? '<span class="status-badge status-success">已完成</span>' : schedule.status === "running" ? '<span class="status-badge status-running">执行中</span>' : schedule.status === "partial" ? '<span class="status-badge status-pending">部分完成</span>' : '<span class="status-badge status-queued">已排期</span>';
    const platformChips = (schedule.platformOrder || schedule.platforms || []).map((platform) => `<span>${platformLogo(platform)}${escapeHtml(PLATFORM_META[platform]?.name || platform)}</span>`).join("");
    const rows = items.slice(0, 5).map((item) => `<div class="schedule-item-row"><span class="schedule-item-index">${item.order}</span><span class="schedule-item-title"><b>${escapeHtml(item.articleTitle)}</b><small>${escapeHtml(item.version)}</small></span><span class="schedule-item-time">${scheduleTimeRangeLabel(item)}</span><span class="schedule-item-platforms">${(item.targets || []).map((target) => `<em>${escapeHtml(PLATFORM_META[target.platform]?.name || target.platform)} ${new Date(target.scheduledAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</em>`).join("")}</span>${statusBadge(item.status === "waiting" ? "scheduled" : item.status)}</div>`).join("");
    return `<article class="card publish-schedule-card"><div class="publish-schedule-head"><div><div class="publish-schedule-title"><h3>${escapeHtml(schedule.source === "内容计划" ? "内容计划发布排期" : "文章批量发布排期")}</h3>${status}</div><p>${escapeHtml(schedule.id)} · ${escapeHtml(schedule.groupName)} · ${schedule.articleIds.length} 篇文章 · 每篇间隔 ${schedule.intervalMinutes} 分钟</p></div><div class="publish-schedule-actions">${schedule.status !== "cancelled" ? `<button class="link-button" type="button" data-action="cancel-schedule" data-schedule-id="${schedule.id}">取消未来排期</button>` : ""}</div></div><div class="publish-schedule-meta"><span><b>执行顺序</b>${platformChips}</span><span><b>时间范围</b>${escapeHtml(scheduleTimeLabel(first))} — ${escapeHtml(scheduleTimeLabel(last))}</span><span class="publish-completion-time"><b>预计完成时间</b>${escapeHtml(scheduleTimeLabel(schedule.expectedCompletionAt || last))}</span></div><div class="schedule-item-list">${rows}</div>${items.length > 5 ? `<small class="schedule-more-note">还有 ${items.length - 5} 篇文章在后续执行。</small>` : ""}</article>`;
  }).join("");
  return `<section class="publish-schedules"><div class="section-heading"><div><h2>定时发布排期</h2><p>文章任务完成审核后创建；实际执行由本地助手按平台顺序领取。</p></div><span class="small-tag blue">${schedules.filter((schedule) => schedule.status !== "cancelled").length} 个有效排期</span></div>${cards}</section>`;
}

function refreshAfterTaskUpdate(task) {
  task.status = taskAggregateStatus(task);
  if (task.status === "success") {
    const article = state.articles.find((item) => item.id === task.articleId);
    if (article) {
      article.status = "published";
      article.updatedAt = Date.now();
    }
      if (ui.route === "publish" && ui.publishTab === "running") ui.publishTab = "all";
  }
  syncPublishedAssetTracking();
  saveState();
  render();
  if (ui.modal?.type === "task" && ui.modal.taskId === task.id) renderModal();
}
