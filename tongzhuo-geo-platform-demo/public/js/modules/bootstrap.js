
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-tab-group]")) {
    document.querySelectorAll("[data-tab-group].is-open").forEach((group) => group.classList.remove("is-open"));
  }
});

document.addEventListener("pointerover", (event) => {
  const point = event.target.closest?.("[data-monitor-point]");
  if (point) monitoringShowTooltip(point);
  const trendPoint = event.target.closest?.("[data-effect-trend-point]");
  if (trendPoint) effectTrendShowTip(trendPoint);
});
document.addEventListener("pointerout", (event) => {
  const point = event.target.closest?.("[data-monitor-point]");
  if (point && !point.contains(event.relatedTarget)) monitoringHideTooltip(point);
  const trendPoint = event.target.closest?.("[data-effect-trend-point]");
  if (trendPoint && !trendPoint.contains(event.relatedTarget)) effectTrendHideTip();
});
document.addEventListener("focusin", (event) => {
  const point = event.target.closest?.("[data-monitor-point]");
  if (point) monitoringShowTooltip(point);
  const trendPoint = event.target.closest?.("[data-effect-trend-point]");
  if (trendPoint) effectTrendShowTip(trendPoint);
});
document.addEventListener("focusout", (event) => {
  const point = event.target.closest?.("[data-monitor-point]");
  if (point) monitoringHideTooltip(point);
  const trendPoint = event.target.closest?.("[data-effect-trend-point]");
  if (trendPoint) effectTrendHideTip();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !ui.studioPicker) return;
  ui.studioPicker = null;
  ui.studioAssetInsertIndex = null;
  render();
  window.setTimeout(() => document.querySelector('[data-action="open-studio-knowledge-images"]')?.focus(), 20);
});
document.addEventListener("input", (event) => {
  const inputEl = event.target;
  if (inputEl && inputEl.hasAttribute && inputEl.hasAttribute("data-lead-search")) {
    ui.siteLeadSearch = String(inputEl.value || "");
    render();
  }
  if (inputEl && inputEl.hasAttribute && inputEl.hasAttribute("data-topic-library-search")) {
    ui.topicLibrarySearch = String(inputEl.value || "");
    render();
  }
  if (inputEl && inputEl.hasAttribute && inputEl.hasAttribute("data-question-library-search")) {
    ui.questionLibrarySearch = String(inputEl.value || "");
    render();
  }
});

document.addEventListener("click", async (event) => {
  const consult = event.target.closest("[data-official-consult]");
  if (consult) {
    event.preventDefault();
    window.open(officialConsultUrl(), "_blank", "noopener,noreferrer");
    return;
  }

  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    closeModal();
    if (nav.dataset.effectView && nav.dataset.nav === "effect-monitor") {
      ui.effectMonitorView = EFFECT_MONITOR_VIEWS.some(([key]) => key === nav.dataset.effectView) ? nav.dataset.effectView : "dashboard";
    }
    navigate(nav.dataset.nav);
    return;
  }

  const command = event.target.closest("[data-command-route], [data-command-action]");
  if (command) {
    const route = command.dataset.commandRoute;
    const action = command.dataset.commandAction;
    closeModal();
    if (route) navigate(route);
    if (action === "publish-approved") {
      const article = state.articles.find((item) => item.reviewStatus === "approved" && item.status === "draft");
      if (article) openPublish(article.id);
      else {
        ui.contentView = "articles";
        ui.articleTaskView = "articles";
        ui.articlePlanFilterId = "all";
        ui.articleTab = "approved";
        navigate("content");
      }
    }
    return;
  }

  const assistantPlatformTab = event.target.closest("[data-assistant-platform-tab]");
  if (assistantPlatformTab) {
    ui.assistantCatalogType = assistantPlatformTab.dataset.assistantPlatformTab === "official" ? "official" : "self_media";
    return render();
  }

  const settingToggle = event.target.closest("[data-setting]");
  if (settingToggle) {
    const key = settingToggle.dataset.setting;
    state.settings[key] = !state.settings[key];
    const label = key === "riskGate" ? "文章风险门禁" : key === "manualReview" ? "人工审核" : key;
    addOperationLog("工作流设置", `${label}已${state.settings[key] ? "开启" : "关闭"}`);
    saveState();
    render();
    showToast("设置已保存", `${label}已${state.settings[key] ? "开启" : "关闭"}。`);
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const action = actionElement.dataset.action;

  if (action === "route-render-retry") return render();

  if (action === "effect-service-banner-dismiss") {
    ui.effectServiceBannerDismissed = true;
    return render();
  }
  if (action === "effect-scroll-to") {
    const target = document.querySelector(actionElement.dataset.scrollTarget || "");
    if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  if (action === "effect-search-focus") {
    navigate("effect-search");
    return window.setTimeout(() => document.getElementById("effect-search-question")?.focus(), 40);
  }
  if (action === "effect-search-default-question") {
    const value = actionElement.value || "";
    if (!value) return;
    ui.effectSearchQuestion = value;
    const input = document.getElementById("effect-search-question");
    if (input) input.value = value;
    return render();
  }
  if (action === "effect-search-run" || action === "effect-search-quote") return prepareEffectSearchRun();
  if (action === "effect-search-submit") return submitEffectSearchRun();
  if (action === "effect-search-generate-report") {
    ui.effectSearchReportAttemptedRunId = null;
    return generateEffectSearchReport();
  }
  if (action === "effect-search-quote-reset") {
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    setEffectRelayQuote("realtime", null);
    setEffectFlowError("realtime", "");
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
    return render();
  }
  if (action === "effect-relay-refresh") return refreshEffectRelay({ renderAfter: true, bypass: true });
  if (action === "effect-search-cancel") return cancelEffectRelayRun();
  if (action === "effect-center-open-run") {
    const runId = actionElement.dataset.effectRunId;
    if (!runId) return;
    ui.effectSearchRunId = runId;
    ui.effectCenterResultRunId = runId;
    await refreshEffectRelayRun({ runId, pull: false, renderAfter: false });
    return navigateEffectCenter("results", runId);
  }
  if (action === "effect-center-cancel-run") return cancelEffectRelayRun(actionElement.dataset.effectRunId);
  if (action === "effect-answer-detail") {
    const recordId = actionElement.dataset.effectSearchRecordId;
    const record = recordId ? effectRelayHistoryRecords().find((item) => item.id === recordId) : null;
    if (!record) return showToast("Live evidence unavailable", "Only synchronized relay evidence can be opened here.", "error");
    return showToast(`${record.platform} 检测证据`, `证据 ${record.evidenceId} · 任务追溯号 ${record.upstreamReqId || "未返回"}`, "success");
  }

  if (action === "effect-diagnostic-quote") return prepareEffectDiagnosticRun();
  if (action === "effect-diagnostic-submit") return submitEffectDiagnosticRun();
  if (action === "effect-diagnostic-generate-report") return generateEffectDiagnosticReport();
  if (action === "effect-diagnostic-quote-reset") {
    invalidateEffectDiagnosticQuote();
    setEffectRelayQuote("diagnostic", null);
    setEffectFlowError("diagnostic", "");
    return render();
  }
  if (action === "effect-diagnostic-cancel") return cancelEffectRelayRun(actionElement.dataset.effectRunId || ui.effectDiagnosticRunId, "diagnostic");
  if (action === "effect-diagnostic-open-run") {
    const runId = actionElement.dataset.effectRunId;
    if (!runId) return;
    ui.effectDiagnosticRunId = runId;
    await refreshEffectRelayRun({ runId, pull: false, renderAfter: false, flow: "diagnostic" });
    await loadEffectDiagnosticReport(runId);
    return render();
  }
  if (action === "effect-diagnostic-suggest-questions") {
    const brand = document.getElementById("effect-diagnostic-brand")?.value.trim() || ui.effectDiagnosticBrand;
    if (!brand) return showToast("请先输入目标品牌", "系统会以品牌名称生成可编辑的问题建议。", "error");
    ui.effectDiagnosticBrand = brand;
    ui.effectDiagnosticQuestions = effectDiagnosticQuestionSeed(brand);
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (action === "effect-monitor-tab-group") {
    const group = actionElement.closest("[data-tab-group]");
    if (!group) return;
    const willOpen = !group.classList.contains("is-open");
    group.closest(".effect-aligned-monitor-tabs")?.querySelectorAll("[data-tab-group].is-open").forEach((item) => { if (item !== group) item.classList.remove("is-open"); });
    group.classList.toggle("is-open", willOpen);
    return;
  }
  if (action === "effect-monitor-view") {
    const view = actionElement.dataset.view || "dashboard";
    ui.effectMonitorView = EFFECT_MONITOR_VIEWS.some(([key]) => key === view) ? view : "dashboard";
    return render();
  }
  if (action === "effect-monitor-export") return exportEffectMonitorAnalytics(actionElement.dataset.format || "json");
  if (action === "effect-monitor-refresh") return Promise.all([refreshEffectMonitoring({ renderAfter: true }), refreshEffectMonitoringAnalytics({ planId: ui.effectMonitorPlanId, renderAfter: true }), refreshEffectRelay()]);
  if (action === "effect-monitor-create") return createEffectMonitorPlan();
  if (action === "effect-monitor-select-plan") {
    const planId = actionElement.dataset.effectPlanId;
    if (!planId) return;
    ui.effectMonitorPlanId = planId;
    ui.effectMonitorView = "dashboard";
    return refreshEffectMonitoring({ planId, renderAfter: true });
  }
  if (action === "effect-monitor-run") return operateEffectMonitorPlan("run", actionElement.dataset.effectPlanId);
  if (action === "effect-monitor-pause") return operateEffectMonitorPlan("pause", actionElement.dataset.effectPlanId);
  if (action === "effect-monitor-resume") return operateEffectMonitorPlan("resume", actionElement.dataset.effectPlanId);

  if (action === "effect-diagnostic-start") {
    return effectDiagnosticStart(
      document.getElementById("effect-diagnostic-start-brand")?.value,
      document.getElementById("effect-diagnostic-start-site")?.value
    );
  }
  if (action === "effect-diagnostic-reset") {
    if (effectRelayPollTimers.diagnostic) window.clearTimeout(effectRelayPollTimers.diagnostic);
    effectRelayPollTimers.diagnostic = null;
    effectFlowStateFor("diagnostic").activeRun = null;
    effectFlowStateFor("diagnostic").activeLink = null;
    effectFlowStateFor("diagnostic").error = "";
    ui.effectDiagnosticStarted = false;
    ui.effectDiagnosticCompleted = false;
    ui.effectDiagnosticRecords = [];
    ui.effectDiagnosticBrand = "";
    ui.effectDiagnosticBrandTerms = [];
    ui.effectDiagnosticIntroduction = "";
    ui.effectDiagnosticCompetitors = [];
    ui.effectDiagnosticQuestions = [];
    ui.effectDiagnosticQuestionDraftInitialized = false;
    ui.effectDiagnosticScopes = [];
    ui.effectDiagnosticScopeSelectionTouched = false;
    ui.effectDiagnosticPlatformRounds = {};
    ui.effectDiagnosticProjectId = null;
    ui.effectDiagnosticQuestionSetId = null;
    ui.effectDiagnosticProjectSignature = "";
    ui.effectDiagnosticFrozenQuestions = [];
    ui.effectDiagnosticRunId = null;
    ui.effectDiagnosticRelayRunId = null;
    ui.effectDiagnosticReportRunId = null;
    ui.effectDiagnosticReportId = null;
    ui.effectDiagnosticReportVersion = null;
    ui.effectDiagnosticReport = null;
    ui.effectDiagnosticReportGenerating = false;
    ui.effectDiagnosticQuoteReady = false;
    ui.effectDiagnosticClientRunId = null;
    setEffectRelayQuote("diagnostic", null);
    return render();
  }
 if (action === "effect-diagnostic-brand-term-add") {
    const value = document.getElementById("effect-diagnostic-new-brand-term")?.value.trim();
    if (!value) return showToast("请输入品牌词", "可添加品牌别名、产品名称或常用写法。", "error");
    const terms = new Set(ui.effectDiagnosticBrandTerms || []);
    terms.add(value);
   ui.effectDiagnosticBrandTerms = [...terms];
    invalidateEffectDiagnosticQuote();
   return render();
  }
 if (action === "effect-diagnostic-brand-term-remove") {
   ui.effectDiagnosticBrandTerms = (ui.effectDiagnosticBrandTerms || []).filter((term) => term !== actionElement.dataset.term);
    invalidateEffectDiagnosticQuote();
   return render();
  }
 if (action === "effect-diagnostic-competitor-add") {
   ui.effectDiagnosticCompetitors = [...(ui.effectDiagnosticCompetitors || []), { id: uid("COMP"), name: "", terms: "" }];
    invalidateEffectDiagnosticQuote();
   return render();
  }
 if (action === "effect-diagnostic-competitor-remove") {
   ui.effectDiagnosticCompetitors = (ui.effectDiagnosticCompetitors || []).filter((item) => item.id !== actionElement.dataset.competitorId);
    invalidateEffectDiagnosticQuote();
   return render();
  }
  if (action === "effect-diagnostic-question-add") {
    const text = await uiPrompt("请输入需要诊断的 AI 问题：", "", `${ui.effectDiagnosticBrand} 有哪些核心优势？`);
    if (!text?.trim()) return;
    ui.effectDiagnosticQuestions = [...(ui.effectDiagnosticQuestions || []), { id: uid("DIAG_Q"), category: "自定义问题", keyword: ui.effectDiagnosticBrand, text: text.trim(), heat: 60 }];
    ui.effectDiagnosticCompleted = false;
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (action === "effect-diagnostic-question-regenerate") {
    return regenerateEffectDiagnosticQuestions();
  }
  if (action === "effect-diagnostic-question-copy") {
    const question = (ui.effectDiagnosticQuestions || []).find((item) => item.id === actionElement.dataset.questionId);
    if (!question) return;
    const copy = navigator.clipboard?.writeText ? navigator.clipboard.writeText(question.text) : Promise.reject(new Error("clipboard unavailable"));
    copy.then(() => showToast("问题已复制", "可直接粘贴到其他配置中使用。", "success")).catch(() => showToast("复制失败", "当前浏览器不支持剪贴板访问，请手动复制。", "error"));
    return;
  }
  if (action === "effect-diagnostic-question-edit") {
    const question = (ui.effectDiagnosticQuestions || []).find((item) => item.id === actionElement.dataset.questionId);
    if (!question) return;
    const text = await uiPrompt("编辑 AI 问题：", "", question.text);
    if (!text?.trim()) return;
    question.text = text.trim();
    ui.effectDiagnosticCompleted = false;
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (action === "effect-diagnostic-question-delete") {
    const question = (ui.effectDiagnosticQuestions || []).find((item) => item.id === actionElement.dataset.questionId);
    if (!question || !await uiConfirm(`确认删除问题“${question.text}”吗？`)) return;
    ui.effectDiagnosticQuestions = (ui.effectDiagnosticQuestions || []).filter((item) => item.id !== question.id);
    ui.effectDiagnosticCompleted = false;
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (action === "effect-diagnostic-run-fast") return runEffectDiagnostic(1);
  if (action === "effect-diagnostic-run-depth") return runEffectDiagnostic();
  if (action === "effect-diagnostic-rerun") return runEffectDiagnostic();

  if (action === "open-sidebar") return document.body.classList.add("sidebar-open");
  if (action === "close-sidebar") return document.body.classList.remove("sidebar-open");
  if (action === "backdrop-close" && event.target === actionElement) return closeModal();
  if (action === "close-modal") return closeModal();
  if (action === "confirm-action") {
    const modal = ui.modal;
    if (!modal) return;
    let result;
    try {
      // Run the callback before tearing down the dialog.  Prompt callbacks
      // resolve their promise synchronously; closing first used to resolve
      // that same prompt with null and silently cancelled “退回并修改”.
      result = modal.onConfirm ? modal.onConfirm() : true;
      if (result && typeof result.then === "function") result = await result;
    } catch (error) {
      showToast("操作失败", error.message || "请稍后重试。", "error");
      return;
    }
    if (result === false) return;
    if (ui.modal === modal) closeModal({ resolvePending: false });
    return result;
  }
  if (action === "open-search") {
    ui.commandQuery = "";
    ui.modal = { type: "search" };
    renderModal();
    return window.setTimeout(() => document.getElementById("command-input")?.focus(), 30);
  }
  if (action === "open-notifications") {
    ui.modal = { type: "notifications" };
    return renderModal();
  }
  if (action === "user-menu") {
    const user = window.__TZ_AUTH__?.user;
    if (!user) return showToast("登录状态不可用", "请刷新页面后重新登录。", "error");
    const roleLabel = { admin: "企业管理员", operator: "内容运营", reviewer: "审核人员", viewer: "只读成员" }[user.role] || user.role || "企业成员";
    if (await uiConfirm(`当前用户：${user.displayName || user.name || user.username}
角色：${roleLabel}

是否退出登录？`)) window.tzLogout?.();
    return;
  }
  if (action === "open-onboarding") {
    ui.onboardingStep = 1;
    ui.modal = { type: "onboarding" };
    return renderModal();
  }
  if (action === "onboarding-prev") {
    persistOnboardingDraft();
    ui.onboardingStep = Math.max(1, ui.onboardingStep - 1);
    return renderModal();
  }
  if (action === "onboarding-next") {
    if (!saveOnboardingCurrentStep()) return;
    ui.onboardingStep = Math.min(4, ui.onboardingStep + 1);
    return renderModal();
  }
  if (action === "onboarding-evidence") {
    const kind = actionElement.dataset.evidenceKind;
    const base = (state.knowledgeBases || []).find((item) => item.kind === kind) || null;
    if (base) {
      ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
      return renderModal();
    }
    closeModal();
    ui.knowledgeKindFilter = kind || "all";
    return navigate("knowledge");
  }
  if (action === "finish-onboarding") {
    state.enterpriseProfile.completion = enterpriseFactCompletion();
    saveState();
    closeModal();
    navigate("planning");
    return showToast("企业建档已完成", "企业事实卡、问题集与监测基线已准备，可以进入选题中心。");
  }
  if (action === "preview-site") {
    await flushSiteCmsDraftSync().catch(() => {});
    return openLiveSite("/");
  }
  if (action === "focus-seed") {
    ui.planningTab = "keywords";
    ui.planningArchiveKind = "questions";
    navigate("planning");
    return window.setTimeout(() => document.getElementById("seed-input")?.focus(), 50);
  }
  if (action === "planning-tab") {
    ui.planningTab = actionElement.dataset.tab;
    ui.businessKeywordError = "";
    ui.questionError = "";
    return render();
  }
  if (action === "planning-archive-kind") {
    ui.planningTab = "archive";
    ui.planningArchiveKind = actionElement.dataset.kind === "topics" ? "topics" : "questions";
    return render();
  }
  if (action === "edit-question") {
    ui.modal = { type: "questionEditor", questionId: actionElement.dataset.questionId };
    return renderModal();
  }
  if (action === "edit-topic") {
    ui.modal = { type: "topicEditor", topicId: actionElement.dataset.topicId };
    return renderModal();
  }
  if (action === "archive-question") return archivePlanningQuestion(actionElement.dataset.questionId);
  if (action === "archive-topic") return archivePlanningTopic(actionElement.dataset.topicId);
  if (action === "restore-planning-record") return restorePlanningRecord(actionElement.dataset.kind, actionElement.dataset.recordId);
  if (action === "view-planning-relations") {
    ui.modal = { type: "planningRelations", kind: actionElement.dataset.kind, recordId: actionElement.dataset.recordId };
    return renderModal();
  }
  if (action === "request-delete-archive") {
    ui.modal = { type: "planningArchiveDelete", kind: actionElement.dataset.kind, recordId: actionElement.dataset.recordId };
    return renderModal();
  }
  if (action === "confirm-delete-archive") return permanentlyDeletePlanningRecord(actionElement.dataset.kind, actionElement.dataset.recordId);
  if (action === "submit-question-edit") return submitQuestionEdit();
  if (action === "submit-topic-edit") return submitTopicEdit();
  if (action === "content-view") {
    const view = actionElement.dataset.view;
    ui.contentView = ["studio", "agents", "articles"].includes(view) ? view : "articles";
    if (ui.contentView === "studio") ensureStudioWorkspace(null, false);
    return render();
  }
  if (action === "content-task-view") {
    ui.contentView = "articles";
    ui.articleTaskView = actionElement.dataset.view === "articles" ? "articles" : "plans";
    clearArticleSelection();
    if (actionElement.dataset.planFilter) ui.articlePlanFilterId = actionElement.dataset.planFilter;
    if (ui.articleTaskView === "plans") ui.articlePlanFilterId = "all";
    ui.articleTab = "all";
    return render();
  }
  if (action === "open-content-studio") return openContentStudio(null, { forceNew: true });
  if (action === "open-article-studio") {
    await waitForFormalContentMigration();
    if (ui.modal?.type === "article") saveArticleEditor({ silent: true });
    return openContentStudio(actionElement.dataset.articleId);
  }
  if (action === "back-to-articles") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const studioArticle = studioArticleForWorkspace(workspace);
    const studioPlan = contentPlanForArticle(studioArticle);
    if (studioArticle) syncStudioArticleEditor({ silent: true });
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    if (studioPlan) ui.articlePlanFilterId = studioPlan.id;
    else if (studioArticle) ui.articlePlanFilterId = "__direct__";
    ui.articleTab = "all";
    return render();
  }
  if (action === "studio-pane") {
    ui.studioPane = ["editor", "chat", "info"].includes(actionElement.dataset.pane) ? actionElement.dataset.pane : "editor";
    return render();
  }
  if (action === "generate-studio-article") return generateStudioArticle();
  if (action === "save-studio-draft") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    return workspace?.articleId ? syncStudioArticleEditor() : generateStudioArticle("", { manualOnly: true });
  }
  if (action === "submit-studio-review") {
    const currentWorkspace = studioWorkspaceById(ui.studioWorkspaceId);
    const currentArticle = studioArticleForWorkspace(currentWorkspace);
    const rollback = currentArticle ? { article: cloneData(currentArticle), knowledgeCitations: cloneData(state.knowledgeCitations || []) } : null;
    const article = syncStudioArticleEditor({ silent: true });
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    if (!article || !workspace) return showToast("文章尚未生成", "请先生成文章初稿。", "error");
    if (!await submitArticleForManualReview(article.id, { rollback })) return;
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    const articlePlan = contentPlanForArticle(article);
    ui.articlePlanFilterId = articlePlan?.id || "__direct__";
    ui.articleTab = "pending";
    ui.articleSelection = [];
    render();
    ui.modal = { type: "article", articleId: article.id };
    renderModal();
    return showToast("已提交人工审核", "请核对正文、企业知识引用和内容风控；审核通过后才能发布。");
  }
  if (action === "toggle-studio-web") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!conversation) return;
    conversation.webSearchEnabled = !conversation.webSearchEnabled;
    conversation.updatedAt = Date.now();
    ui.studioWebSearch = conversation.webSearchEnabled;
    saveState();
    return render();
  }
  if (action === "open-studio-image-picker") {
    ui.studioAssetInsertIndex = studioAssetInsertionIndex();
    ui.studioPicker = ui.studioPicker === "image" ? null : "image";
    return render();
  }
  if (action === "open-studio-knowledge-picker") {
    ui.studioPicker = ui.studioPicker === "knowledge" ? null : "knowledge";
    return render();
  }
  if (action === "open-studio-knowledge-images") {
    ui.studioAssetInsertIndex = studioAssetInsertionIndex();
    ui.studioPicker = "knowledge-image";
    if (window.matchMedia?.("(max-width: 1040px)").matches) ui.studioPane = "chat";
    render();
    return window.setTimeout(() => document.getElementById("studio-asset-search")?.focus(), 30);
  }
  if (action === "close-studio-picker") {
    ui.studioPicker = null;
    return render();
  }
  if (action === "trigger-studio-attachment") return document.getElementById("studio-attachment-input")?.click();
  if (action === "trigger-studio-image-upload") return document.getElementById("studio-image-input")?.click();
  if (action === "toggle-studio-knowledge") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const itemId = actionElement.dataset.itemId;
    const allowed = studioApprovedKnowledgeEntries(workspace).some((entry) => entry.item.id === itemId);
    if (!conversation || !allowed) return showToast("知识不可引用", "只能引用当前业务线授权范围内的可用知识。", "error");
    const selected = new Set(conversation.selectedKnowledgeItemIds || []);
    selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId);
    conversation.selectedKnowledgeItemIds = [...selected];
    conversation.updatedAt = Date.now();
    workspace.selectedKnowledgeItemIds = [...selected];
    workspace.updatedAt = conversation.updatedAt;
    saveState();
    return render();
  }
  if (action === "remove-studio-context") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!workspace || !conversation) return;
    const id = actionElement.dataset.id;
    if (actionElement.dataset.kind === "knowledge") {
      conversation.selectedKnowledgeItemIds = conversation.selectedKnowledgeItemIds.filter((itemId) => itemId !== id);
      workspace.selectedKnowledgeItemIds = workspace.selectedKnowledgeItemIds.filter((itemId) => itemId !== id);
    } else if (actionElement.dataset.kind === "attachment") {
      workspace.attachmentIds = workspace.attachmentIds.filter((assetId) => assetId !== id);
      conversation.attachments = conversation.attachments.filter((assetId) => assetId !== id);
    } else {
      conversation.imageIds = conversation.imageIds.filter((assetId) => assetId !== id);
    }
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    saveState();
    return render();
  }
  if (action === "send-studio-chat") return sendStudioChat();
  if (action === "apply-studio-proposal") return applyStudioProposal(actionElement.dataset.messageId);
  if (action === "discard-studio-proposal") return discardStudioProposal(actionElement.dataset.messageId);
  if (action === "copy-studio-proposal") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const message = studioConversationForWorkspace(workspace)?.messages.find((item) => item.id === actionElement.dataset.messageId);
    const proposal = message?.proposal;
    const text = proposal?.after || proposal?.title || studioPlainText(proposal?.html || "");
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    return showToast("建议已复制", "正文没有发生变化。");
  }
  if (action === "insert-studio-asset") return insertStudioAsset(actionElement.dataset.assetId);
  if (action === "generate-studio-image") return generateStudioImageAsset();
  if (action === "new-studio-conversation") return startNewStudioConversation();
  if (action === "article-format") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    const editor = document.getElementById("article-content-editor");
    if (!article || !editor) return;
    if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    editor.focus();
    document.execCommand(actionElement.dataset.command, false, actionElement.dataset.value || null);
    return;
  }
  if (action === "article-link") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    const editor = document.getElementById("article-content-editor");
    if (!article || !editor) return;
    if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    const url = await uiPrompt("请输入链接地址（https://…）", "", "https://");
    if (!url) return;
    let parsedUrl;
    try { parsedUrl = new URL(url.trim(), window.location.origin); } catch { return showToast("链接格式不正确", "只允许使用 http、https 或 mailto 链接。", "error"); }
    if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) return showToast("链接协议不允许", "只允许使用 http、https 或 mailto 链接。", "error");
    editor.focus();
    document.execCommand("createLink", false, parsedUrl.href);
    return;
  }
  if (action === "studio-format") {
    const editor = document.getElementById("studio-content-editor");
    if (!editor) return;
    editor.focus();
    document.execCommand(actionElement.dataset.command, false, actionElement.dataset.value || null);
    return;
  }
  if (action === "studio-link") {
    const editor = document.getElementById("studio-content-editor");
    if (!editor) return;
    const url = await uiPrompt("请输入链接地址（https://…）", "", "https://");
    if (!url) return;
    let parsedUrl;
    try { parsedUrl = new URL(url.trim(), window.location.origin); } catch { return showToast("链接格式不正确", "只允许使用 http、https 或 mailto 链接。", "error"); }
    if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) return showToast("链接协议不允许", "只允许使用 http、https 或 mailto 链接。", "error");
    editor.focus();
    document.execCommand("createLink", false, parsedUrl.href);
    return;
  }
  if (action === "create-writing-agent") {
    ui.modal = { type: "writingAgent" };
    return renderModal();
  }
  if (action === "open-writing-agent") {
    ui.modal = { type: "writingAgent", agentId: actionElement.dataset.agentId };
    return renderModal();
  }
  if (action === "copy-writing-agent") {
    ui.modal = { type: "writingAgent", cloneFromId: actionElement.dataset.agentId };
    return renderModal();
  }
  if (action === "save-writing-agent") return saveWritingAgent(actionElement.dataset.agentId || null);
  if (action === "toggle-writing-agent") return toggleWritingAgent(actionElement.dataset.agentId);
  if (action === "set-default-writing-agent") return setDefaultWritingAgent(actionElement.dataset.agentId);
  if (action === "open-writing-agent-manager") {
    ui.contentView = "agents";
    closeModal();
    return navigate("content");
  }
  if (action === "edit-business-line") {
    ui.modal = { type: "businessLine", businessLineId: actionElement.dataset.lineId };
    return renderModal();
  }
  if (action === "open-business-line") {
    ui.businessLineError = "";
    ui.modal = { type: "businessLine" };
    return renderModal();
  }
  if (action === "manage-business-lines" || action === "back-business-line-manager") {
    ui.modal = { type: "businessLineManager" };
    return renderModal();
  }
  if (action === "request-delete-business-line") {
    ui.modal = { type: "deleteBusinessLine", lineId: actionElement.dataset.lineId };
    return renderModal();
  }
  if (action === "confirm-delete-business-line") return deleteBusinessLine(actionElement.dataset.lineId);
  if (action === "restore-business-line") return restoreBusinessLine(actionElement.dataset.lineId);
  if (action === "submit-business-line") return submitBusinessLine();
  if (action === "focus-business-keyword") {
    ui.planningTab = "keywords";
    render();
    return window.setTimeout(() => document.getElementById("business-keyword-input")?.focus(), 30);
  }
  if (action === "add-business-keywords") return addBusinessKeywords();
  if (action === "toggle-core-keyword") {
    const keywordId = actionElement.dataset.keywordId;
    const selected = new Set(ui.selectedCoreKeywordIds || []);
    selected.has(keywordId) ? selected.delete(keywordId) : selected.add(keywordId);
    ui.selectedCoreKeywordIds = [...selected];
    return render();
  }
  if (action === "restore-business-keyword") {
    const keyword = state.keywords.find((item) => item.id === actionElement.dataset.keywordId);
    if (keyword) keyword.status = "active";
    saveState();
    render();
    return showToast("关键词已恢复", "该关键词重新参与选题拓展。", "success");
  }
  if (action === "archive-business-keyword") {
    const keyword = state.keywords.find((item) => item.id === actionElement.dataset.keywordId);
    if (keyword) keyword.status = "archived";
    ui.selectedCoreKeywordIds = (ui.selectedCoreKeywordIds || []).filter((id) => id !== actionElement.dataset.keywordId);
    saveState();
    render();
    return showToast("关键词已归档", "历史词包和来源链不受影响。");
  }
  if (action === "expand-seeds") return expandSeedKeywords();
  if (action === "generate-question-pack") return generateQuestionPack();
  if (action === "edit-seed-keyword") return editSeedKeyword(actionElement.dataset.keywordId);
  if (action === "delete-seed-keyword") return deleteSeedKeyword(actionElement.dataset.keywordId);
  if (action === "delete-keyword-pack") return deleteKeywordPack(actionElement.dataset.packId);
  if (action === "delete-keyword-candidate") return deleteKeywordCandidate(actionElement.dataset.questionId);
  if (action === "delete-keyword-candidates") return deleteKeywordCandidates(actionElement.dataset.packId, actionElement.dataset.dimension || "all");
  if (action === "focus-question") {
    ui.planningTab = "questions";
    render();
    return window.setTimeout(() => document.getElementById("question-input")?.focus(), 30);
  }
  if (action === "add-question") return addQuestionToLibrary();
  if (action === "save-selected-questions") return saveSelectedQuestions();
  if (action === "remove-question") {
    const question = state.questionLibrary.find((item) => item.id === actionElement.dataset.questionId);
    if (question) question.selected = false;
    saveState();
    return render();
  }
  if (action === "clear-questions") {
    const line = activeBusinessLine();
    state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived").forEach((question) => { question.selected = false; });
    saveState();
    return render();
  }
  if (action === "questions-to-topics") return questionsToTopics();
  if (action === "question-to-topic") {
    const question = state.questionLibrary.find((item) => item.id === actionElement.dataset.questionId);
    if (!question || question.status === "archived") return showToast("问题已归档", "请先在归档管理中恢复，再生成选题。", "error");
    const linkedTopics = planningQuestionTopics(question);
    const activeTopics = linkedTopics.filter((topic) => topic.status !== "archived");
    const archivedTopics = linkedTopics.filter((topic) => topic.status === "archived");
    if (activeTopics.length) {
      ui.planningTab = "topics";
      return render();
    }
    if (archivedTopics.length) {
      ui.planningTab = "archive";
      ui.planningArchiveKind = "topics";
      return render();
    }
    return questionsToTopics([question.id]);
  }
  if (action === "direct-generate-topic") return openTopicDirectStudio(actionElement.dataset.topicId);
  if (action === "sort-score") {
    const scope = actionElement.dataset.sortScope;
    const field = actionElement.dataset.sortField;
    const sortKeyMap = { "keyword-result": "keywordResultSort", "topic-library": "topicLibrarySort", "archive-topic": "archiveTopicSort" };
    const sortKey = sortKeyMap[scope];
    if (!sortKey) return;
    const current = ui[sortKey];
    if (!current || current.field !== field) {
      ui[sortKey] = { field, dir: "desc" };
    } else if (current.dir === "desc") {
      ui[sortKey] = { field, dir: "asc" };
    } else {
      ui[sortKey] = null;
    }
    return render();
  }
  if (action === "topic-to-plan") return openTopicPlanPicker(actionElement.dataset.topicId);
  if (action === "submit-topic-plan-picker") return submitTopicPlanPicker();
  if (action === "create-plan-from-topic-picker") return createPlanFromTopicPicker(actionElement.dataset.topicId);
  if (action === "edit-content-plan") {
    ui.modal = { type: "contentPlanEdit", planId: actionElement.dataset.planId };
    return renderModal();
  }
  if (action === "submit-plan-edit") return submitPlanEdit();
  if (action === "open-plan") return openContentPlan();
  if (action === "submit-content-plan") return submitContentPlan();
  if (action === "execute-plan" || action === "preview-plan-knowledge") return openGenerationPreview(actionElement.dataset.planId);
  if (action === "upgrade-plan-agent") return upgradePlanWritingAgent(actionElement.dataset.planId);
  if (action === "confirm-generate-plan") return executeContentPlan(actionElement.dataset.planId);
  if (action === "view-plan-content") {
    const plan = state.contentPlans.find((item) => item.id === actionElement.dataset.planId);
    if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
    ui.articleTab = "all";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = plan.id;
    if (ui.modal) closeModal();
    ui.contentView = "articles";
    navigate("content");
    return;
  }
  if (action === "select-pack") {
    const line = activeBusinessLine();
    state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived").forEach((question) => { question.selected = false; });
    ui.selectedPackId = actionElement.dataset.packId;
    ui.planningCategory = "all";
    saveState();
    return render();
  }
  if (action === "planning-category") {
    ui.planningCategory = actionElement.dataset.category;
    return render();
  }
  if (action === "remove-topic") {
    const topic = state.topics.find((item) => item.id === actionElement.dataset.topicId);
    if (topic) topic.selected = false;
    saveState();
    return render();
  }
  if (action === "clear-topics") {
    const line = activeBusinessLine();
    state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status !== "archived").forEach((topic) => { topic.selected = false; });
    saveState();
    return render();
  }
  if (action === "generate-article") return openContentPlan();
  if (action === "export-pack") return exportPlanningPack();
  if (action === "content-filter") {
    ui.articleFilterExpanded = !ui.articleFilterExpanded;
    return render();
  }
  if (action === "clear-content-filters") {
    ui.articleSearch = "";
    ui.articleRiskFilter = "all";
    ui.articleKnowledgeFilter = "all";
    clearArticleSelection();
    return render();
  }
  if (action === "article-tab") {
    ui.articleTaskView = "articles";
    ui.articleTab = actionElement.dataset.tab;
    clearArticleSelection();
    return render();
  }
  if (action === "open-batch-review") return openBatchReview();
  if (action === "confirm-batch-review") return approveSelectedArticles();
  if (action === "go-schedule-articles") {
    closeModal();
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "approved";
    clearArticleSelection();
    return navigate("content");
  }
  if (action === "open-schedule") return openScheduleForArticles(selectedArticleIdsForCurrentView(), ui.articlePlanFilterId && !["all", "__direct__"].includes(ui.articlePlanFilterId) ? ui.articlePlanFilterId : null);
  if (action === "schedule-plan") {
    const plan = state.contentPlans.find((item) => item.id === actionElement.dataset.planId);
    if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
    return openScheduleForArticles(contentPlanArticles(plan).map((article) => article.id), plan.id);
  }
  if (action === "move-schedule-platform") {
    if (!ui.scheduleSelection) return;
    const order = [...(ui.scheduleSelection.platformOrder || [])];
    const index = order.indexOf(actionElement.dataset.platform);
    const next = actionElement.dataset.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    ui.scheduleSelection.platformOrder = order;
    return renderModal();
  }
  if (action === "submit-schedule") return submitSchedule().catch((error) => showToast("排期创建失败", error.message, "error"));
  if (action === "cancel-schedule") return cancelPublishSchedule(actionElement.dataset.scheduleId);
  if (action === "show-pending-articles") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "pending";
    return navigate("content");
  }
  if (action === "show-approved-articles") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "approved";
    return navigate("content");
  }
  if (action === "copy-article-text") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    if (!article) return;
    const text = `# ${article.title}

${plainText(article.contentHtml || article.content || "")}`;
    navigator.clipboard?.writeText(text).then(() => showToast("文章已复制", "标题与正文纯文本已复制到剪贴板。", "success")).catch(() => showToast("复制失败", "浏览器未授权剪贴板，请手动复制。", "error"));
    return;
  }
  if (action === "open-article") return openArticle(actionElement.dataset.articleId);
  if (action === "delete-content-article") return deleteContentArticle(actionElement.dataset.articleId);
  if (action === "delete-content-plan") return deleteContentPlan(actionElement.dataset.planId);
  if (action === "delete-knowledge-base") return deleteKnowledgeBase(actionElement.dataset.baseId);
  if (action === "delete-knowledge-item") return deleteKnowledgeItem(actionElement.dataset.itemId);
  if (action === "delete-site-lead") return deleteSiteLead(actionElement.dataset.leadId);
  if (action === "delete-publish-task") return deletePublishTask(actionElement.dataset.taskId);
  if (action === "delete-studio-workspace") return deleteStudioWorkspace(actionElement.dataset.workspaceId);
  if (action === "delete-knowledge-image") return deleteKnowledgeImage(actionElement.dataset.assetId);
  if (action === "delete-account-group") return deleteAccountGroup(actionElement.dataset.groupId);
  if (action === "approve-article-asset") return approveArticleAsset(actionElement.dataset.articleId, actionElement.dataset.assetId);
  if (action === "remove-article-asset") return removeArticleAsset(actionElement.dataset.articleId, actionElement.dataset.assetId);
  if (action === "request-regenerate-article") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    const agentId = document.getElementById("article-writing-agent")?.value;
    if (!article || !agentId) return showToast("请选择写作智能体", "选择后再创建文章新版本。", "error");
    ui.modal = { type: "regenerateArticle", articleId: article.id, agentId, unsavedChanges: articleEditorHasUnsavedChanges(article) };
    return renderModal();
  }
  if (action === "confirm-regenerate-article") return regenerateArticleWithAgent(actionElement.dataset.articleId, actionElement.dataset.agentId);
  if (action === "open-article-version") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (article && articleEditorHasUnsavedChanges(article)) return showToast("请先保存当前修改", "保存或撤销编辑器中的变化后再查看历史版本。", "error");
    ui.modal = { type: "articleVersion", articleId: actionElement.dataset.articleId, versionIndex: Number(actionElement.dataset.versionIndex) };
    return renderModal();
  }
  if (action === "open-citation") {
    const citation = (state.knowledgeCitations || []).find((item) => item.id === actionElement.dataset.citationId);
    if (!citation) return showToast("引用证据不存在", "请刷新页面后重试。", "error");
    const articleId = ui.modal?.articleId || citation.articleId;
    if (ui.modal?.type === "article") saveArticleEditor({ silent: true });
    ui.modal = { type: "citation", citationId: citation.id, articleId };
    return renderModal();
  }
  if (action === "save-article") {
    await waitForFormalContentMigration();
    const current = state.articles.find((item) => item.id === ui.modal?.articleId);
    const rollback = current ? cloneData(current) : null;
    const article = saveArticleEditor({ silent: true });
    if (article) {
      try {
        await waitForContentSync(article);
        if (article.contentSyncError) throw new Error(article.contentSyncError);
        const persisted = await flushContentArticleWorkspace(article, "content-article-save");
        if (persisted?.contentSyncError) throw new Error(persisted.contentSyncError);
      } catch (error) {
        const currentArticle = state.articles.find((item) => item.id === article.id) || article;
        if (rollback) Object.assign(currentArticle, rollback);
        saveState();
        render();
        ui.modal = { type: "article", articleId: article.id };
        renderModal();
        return showToast("文章保存失败", error.message || "正式内容版本没有保存，本次修改已回滚。", "error");
      }
      ui.modal = { type: "article", articleId: article.id };
      renderModal();
      showToast("文章已保存", `正式内容版本 ${article.contentVersionNumber || article.version} 已保存。`);
    }
    return;
  }
  if (action === "submit-article-review") {
    const article = await submitArticleForManualReview(actionElement.dataset.articleId || ui.modal?.articleId, { fromArticleModal: true });
    if (!article) return;
    render();
    ui.modal = { type: "article", articleId: article.id };
    renderModal();
    return showToast("已提交人工审核", "当前版本已进入人工审核；审核通过后才能发布。");
  }
  if (action === "approve-article") return approveArticle();
  if (action === "reject-article") return rejectArticle();
  if (action === "open-publish") return openPublish(actionElement.dataset.articleId);
  if (action === "open-publish-batch") return openPublishBatch();
  if (action === "back-to-publish-tasks") {
    ui.publishView = "tasks";
    ui.publishBatchSelection = null;
    ui.publishBatchSearch = "";
    ui.publishBatchArticleSearch = "";
    return render();
  }
  if (action === "publish-batch-category") {
    ui.publishBatchCategory = actionElement.dataset.category || "self_media";
    return render();
  }
  if (action === "publish-batch-select-eligible") {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.articleIds = publishBatchArticles().filter((article) => publishBatchEligibleArticle(article).ok).map((article) => article.id);
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (action === "publish-batch-select-all") {
    if (!ui.publishBatchSelection) return;
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => FORMAL_PUBLISH_PLATFORM_IDS.has(entry.id) && publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (action === "move-publish-batch-platform") {
    if (!ui.publishBatchSelection) return;
    const order = [...(ui.publishBatchSelection.platformOrder || [])];
    const index = order.indexOf(actionElement.dataset.platform);
    const next = actionElement.dataset.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (action === "publish-batch-preflight") {
    const selection = ui.publishBatchSelection;
    const articles = (selection?.articleIds || []).map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
    const blocked = articles.filter((article) => !articlePublishEligibility(article).ok);
    const websiteSelected = (selection?.platforms || []).includes("web");
    if (blocked.length) return showToast("还有文章不能发布", `${blocked.length} 篇文章未满足审核、风控或知识证据条件。`, "error");
    if (!websiteSelected) return showToast("发布条件检查完成", "文章可以发布；本批次未选择官网主信源，后续引用分析可能缺少官方来源。", "warning");
    return showToast("发布条件检查通过", `${articles.length} 篇文章、${selection.platforms.length} 个平台均满足当前演示规则。`);
  }
  if (action === "submit-publish-batch") return submitPublishBatch().catch((error) => showToast("发布任务创建失败", error.message, "error"));
  if (action === "publish-approved") {
    const article = state.articles.find((item) => item.reviewStatus === "approved" && item.status === "draft" && item.riskStatus === "clean" && articleCitations(item).length && articleBusinessLineIsActive(item));
    if (!article) {
      ui.contentView = "articles";
      ui.articleTaskView = "articles";
      ui.articlePlanFilterId = "all";
      ui.articleTab = "approved";
      navigate("content");
      return showToast("暂无可发布文章", "请先审核一篇文章。", "error");
    }
    ui.contentView = "articles";
    return openPublish(article.id);
  }
  if (action === "submit-publish") return submitPublish().catch((error) => showToast("发布任务创建失败", error.message, "error"));
  if (action === "publish-tab") {
    ui.publishTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "asset-tab") {
    ui.assetTab = actionElement.dataset.tab || "all";
    ui.assetExpandedId = null;
    return render();
  }
  if (action === "asset-expand") {
    ui.assetExpandedId = ui.assetExpandedId === actionElement.dataset.assetId ? null : actionElement.dataset.assetId;
    return render();
  }
  if (action === "refresh-assets") {
    syncLocalContentAssetsToServer({ renderAfter: true });
    refreshContentAssets({ renderAfter: true });
    return showToast("资产数据已刷新", "已重新同步文章资产与发布记录。", "info");
  }
  if (action === "asset-clear-search") {
    ui.assetSearch = "";
    return render();
  }
  if (action === "open-asset-article") return openArticle(actionElement.dataset.articleId);
  if (action === "asset-add-publication") {
    ui.modal = { type: "trackedWork", articleId: actionElement.dataset.articleId || "", publicationOnly: true, sourceType: "其他", sourceName: "手动添加平台" };
    return renderModal();
  }
  if (action === "asset-check-publication") {
    try {
      const payload = await productionApi(`/api/v1/content-assets/${encodeURIComponent(actionElement.dataset.assetId)}/publications/${encodeURIComponent(actionElement.dataset.publicationId)}/check`, { method: "POST", body: {} });
      await refreshContentAssets({ renderAfter: false, silent: true });
      render();
      const health = payload.data?.publication?.healthStatus || "unchecked";
      return showToast("地址检测已完成", ({ healthy: "页面可以正常访问。", redirected: "页面可以访问，但发生了跳转。", changed: "页面内容与上次检测相比发生了变化。" })[health] || "检测结果已写入内容资产记录。", ["healthy", "redirected"].includes(health) ? "success" : "warning");
    } catch (error) {
      await refreshContentAssets({ renderAfter: false, silent: true });
      render();
      return showToast("地址检测失败", error.message || "该地址当前无法安全访问。", "error");
    }
  }
  if (action === "asset-remove-publication") {
    if (!await uiConfirm("确认从这篇内容资产中移除该手动 URL？文章和平台原文不会被删除。")) return;
    try {
      await productionApi(`/api/v1/content-assets/${encodeURIComponent(actionElement.dataset.assetId)}/publications/${encodeURIComponent(actionElement.dataset.publicationId)}`, { method: "DELETE" });
      await refreshContentAssets({ renderAfter: false, silent: true });
      render();
      return showToast("手动 URL 已移除", "只移除了追踪关系，平台原文没有被删除。", "success");
    } catch (error) {
      return showToast("移除失败", error.message || "内容资产服务暂不可用。", "error");
    }
  }
  if (action === "asset-new-version") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (article) openContentStudio(article.id);
    return showToast("已打开文章工作区", "保存修改后会生成新的文章版本，并重新进入审核流程。");
  }
  if (action === "task-log") {
    ui.modal = { type: "task", taskId: actionElement.dataset.taskId };
    return renderModal();
  }
  if (action === "verify-result") return verifyPublishResult(actionElement.dataset.taskId, actionElement.dataset.platform, actionElement);
  if (action === "notification-task") {
    closeModal();
    ui.publishTab = "action";
    return navigate("publish");
  }
  if (action === "monitoring-tab") {
    ui.monitoringTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "diagnostic-section") {
    ui.diagnosticSection = ["analysis", "evidence", "reports", "rules"].includes(actionElement.dataset.section) ? actionElement.dataset.section : "analysis";
    if (ui.diagnosticSection !== "reports") ui.diagnosticReportId = null;
    if (ui.diagnosticSection === "analysis" && !analysisWorkbenchSnapshot.attempted) refreshAnalysisWorkbench({ renderAfter: true });
    if (ui.diagnosticSection === "reports" && !analysisWorkbenchSnapshot.attempted) refreshAnalysisWorkbench({ renderAfter: true });
    if (ui.diagnosticSection === "evidence" && !monitoringSnapshot.loaded && !monitoringSnapshot.loading) refreshRealMonitoring({ silent: true });
    if (ui.diagnosticSection === "rules" && !citationUpdateSnapshot.loaded && !citationUpdateSnapshot.loading) refreshCitationPackageUpdate({ renderAfter: true });
    if (ui.diagnosticSection === "rules" && !citationDocumentUpdateSnapshot.loaded && !citationDocumentUpdateSnapshot.loading) refreshCitationDocumentUpdate({ renderAfter: true });
    return render();
  }
  if (action === "analysis-refresh") return refreshAnalysisWorkbench({ renderAfter: true });
  if (action === "analysis-new-session") {
    stopAnalysisWorkbenchPolling();
    ui.diagnosticSection = "analysis";
    ui.analysisSessionId = null;
    ui.analysisPrompt = "";
    ui.analysisIndustry = "";
    ui.analysisDataSources = ["citation_lab"];
    ui.analysisPlatforms = ["豆包", "DeepSeek", "千问", "元宝"];
    ui.analysisReportDepth = "detailed";
    ui.analysisCustomDepth = "";
    ui.analysisPlan = null;
    ui.analysisPlanning = false;
    ui.analysisAdvancedOpen = false;
    ui.analysisFollowUp = "";
    ui.analysisFollowUpConsent = false;
    ui.analysisEvidenceOpen = false;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, activeSession: null, activeRun: null, error: "" };
    return render();
  }
  if (action === "analysis-open-session") return openAnalysisWorkbenchSession(actionElement.dataset.sessionId);
  if (action === "analysis-delete-session") return deleteAnalysisSession(actionElement.dataset.sessionId);
  if (action === "analysis-open-report") {
    ui.diagnosticSection = "analysis";
    return openAnalysisWorkbenchSession(actionElement.dataset.sessionId);
  }
  if (action === "analysis-submit" || action === "analysis-confirm-run") return submitAnalysisWorkbench(false);
  if (action === "analysis-plan-preview") return previewAnalysisWorkbenchPlan();
  if (action === "analysis-toggle-advanced") {
    ui.analysisAdvancedOpen = !ui.analysisAdvancedOpen;
    return render();
  }
  if (action === "analysis-follow-up-submit") return submitAnalysisWorkbench(true);
  if (action === "analysis-open-model-settings") {
    ui.settingsTab = "models";
    return navigate("settings");
  }
  if (action === "analysis-toggle-evidence") {
    ui.analysisEvidenceOpen = !ui.analysisEvidenceOpen;
    return render();
  }
  if (action === "analysis-jump-section") {
    document.getElementById(actionElement.dataset.sectionTarget || "")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "analysis-use-suggestion") {
    ui.analysisFollowUp = actionElement.dataset.suggestion || "";
    const field = document.getElementById("analysis-follow-up");
    if (field) { field.value = ui.analysisFollowUp; field.focus(); }
    return;
  }
  if (action === "citation-update-refresh") return refreshCitationPackageUpdate({ renderAfter: true });
  if (action === "citation-update-check") return operateCitationPackageUpdate("check");
  if (action === "citation-update-stage") return operateCitationPackageUpdate("stage");
  if (action === "citation-update-validate") return operateCitationPackageUpdate("validate");
  if (action === "citation-update-discard") return operateCitationPackageUpdate("discard");
  if (action === "citation-update-activate") return operateCitationPackageUpdate("activate");
  if (action === "citation-update-rollback") return operateCitationPackageUpdate("rollback");
  if (action === "citation-doc-update-refresh") return refreshCitationDocumentUpdate({ renderAfter: true });
  if (action === "citation-doc-update-check") return operateCitationDocumentUpdate("check");
  if (action === "citation-doc-update-stage") return operateCitationDocumentUpdate("stage");
  if (action === "citation-doc-update-validate") return operateCitationDocumentUpdate("validate");
  if (action === "citation-doc-update-discard") return operateCitationDocumentUpdate("discard");
  if (action === "citation-doc-update-activate") return operateCitationDocumentUpdate("activate");
  if (action === "citation-doc-update-rollback") return operateCitationDocumentUpdate("rollback");
  if (action === "diagnostic-new-project") {
    // Legacy entry point: all new analyses now start in the AI workbench.
    ui.diagnosticSection = "analysis";
    ui.analysisSessionId = null;
    ui.analysisPrompt = "";
    ui.analysisPlan = null;
    ui.analysisFollowUp = "";
    ui.analysisFollowUpConsent = false;
    analysisWorkbenchSnapshot = { ...analysisWorkbenchSnapshot, activeSession: null, activeRun: null, error: "" };
    return render();
  }
  if (action === "diagnostic-close-wizard") {
    ui.diagnosticWizardOpen = false;
    ui.diagnosticQuestionSetFrozen = false;
    return render();
  }
  if (action === "diagnostic-freeze-questions") return freezeDiagnosticQuestionSet();
  if (action === "diagnostic-unfreeze-questions") {
    ui.diagnosticQuestionSetFrozen = false;
    return render();
  }
  if (action === "diagnostic-create-project") return createDiagnosticProject();
  if (action === "diagnostic-open-project") {
    ui.diagnosticProjectId = actionElement.dataset.projectId || null;
    ui.diagnosticSection = "projects";
    return render();
  }
  if (action === "diagnostic-generate-report") return generateDiagnosticReport(actionElement.dataset.projectId);
  if (action === "diagnostic-project-reports") {
    ui.diagnosticProjectId = actionElement.dataset.projectId || null;
    ui.diagnosticReportId = null;
    ui.diagnosticSection = "reports";
    return render();
  }
  if (action === "diagnostic-open-report") {
    return openDiagnosticReport(actionElement.dataset.reportId || null);
  }
  if (action === "diagnostic-back-reports") {
    ui.diagnosticReportId = null;
    return render();
  }
  if (action === "diagnostic-clear-report-filter") {
    ui.diagnosticProjectId = null;
    ui.diagnosticReportId = null;
    return render();
  }
  if (action === "diagnostic-confirm-action") return confirmDiagnosticAction(actionElement.dataset.reportId, actionElement.dataset.diagnosticActionId);
  if (action === "diagnostic-refresh-all") {
    await Promise.allSettled([refreshOperationDiagnostics({ silent: true }), refreshRealMonitoring({ silent: true })]);
    return showToast("运营诊断数据已刷新", "已重新读取诊断项目、研究数据包和企业实测证据。", "success");
  }
  if (action === "refresh-monitoring") return refreshRealMonitoring();
  if (action === "run-monitoring-diagnostic") return runMonitoringDiagnostic();
  if (action === "save-tracked-work") return saveTrackedWork();
  if (action === "site-tab") {
    ui.siteTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "site-section-jump") {
    const sectionTargets = {
      template: ".site-template-section",
      footer: ".site-footer-management-grid",
      navigation: ".site-navigation-grid",
      public: ".site-theme-card"
    };
    const section = document.querySelector(sectionTargets[actionElement.dataset.section] || "");
    if (section) {
      const top = window.scrollY + section.getBoundingClientRect().top - 82;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    return;
  }
  if (action === "site-select-template") return selectSiteTemplate(actionElement.dataset.templateKey);
  if (action === "site-page") {
    ui.sitePageId = actionElement.dataset.pageId || "home";
    ui.siteTab = "pages";
    return render();
  }
  if (action === "site-content-tab") {
    ui.siteContentTab = actionElement.dataset.tab || "articles";
    return render();
  }
  if (action === "site-catalog-tab") {
    ui.siteCatalogTab = actionElement.dataset.tab || "services";
    return render();
  }
  if (action === "site-add-service") { ui.modal = { type: "siteService" }; return renderModal(); }
  if (action === "site-edit-service") { ui.modal = { type: "siteService", serviceId: actionElement.dataset.serviceId }; return renderModal(); }
  if (action === "site-save-service") return saveSiteService(actionElement.dataset.serviceId);
  if (action === "site-add-case") { ui.modal = { type: "siteCase" }; return renderModal(); }
  if (action === "site-edit-case") { ui.modal = { type: "siteCase", caseId: actionElement.dataset.caseId }; return renderModal(); }
  if (action === "site-save-case") return saveSiteCase(actionElement.dataset.caseId);
  if (action === "site-add-problem-group") { ui.modal = { type: "siteProblemGroup" }; return renderModal(); }
  if (action === "site-edit-problem-group") { ui.modal = { type: "siteProblemGroup", groupId: actionElement.dataset.groupId }; return renderModal(); }
  if (action === "site-save-problem-group") return saveSiteProblemGroup(actionElement.dataset.groupId);
  if (action === "site-add-question") { ui.modal = { type: "siteQuestion", groupId: actionElement.dataset.groupId }; return renderModal(); }
  if (action === "site-edit-question") { ui.modal = { type: "siteQuestion", groupId: actionElement.dataset.groupId, questionId: actionElement.dataset.questionId }; return renderModal(); }
  if (action === "site-save-question") return saveSiteQuestion(actionElement.dataset.questionId, actionElement.dataset.originalGroupId);
  if (action === "site-archive-cms-record") return archiveSiteCmsRecord(actionElement.dataset.kind, actionElement.dataset.recordId, actionElement.dataset.groupId);
  if (action === "site-category-filter") {
    ui.siteCategoryFilter = actionElement.dataset.filter || "all";
    ui.siteContentTab = "articles";
    return render();
  }
  if (action === "site-page-save") return saveSitePage();
  if (action === "site-page-preview") {
    await flushSiteCmsDraftSync().catch(() => {});
    const page = sitePageDefinition(actionElement.dataset.pageId || ui.sitePageId);
    return openLiveSite(page?.path || "/");
  }
  if (action === "site-preview-reload") {
    await flushSiteCmsDraftSync().catch(() => {});
    const frame = document.getElementById("site-rendered-preview-frame");
    if (frame) frame.src = `${frame.src.split("&previewRefresh=")[0]}&previewRefresh=${Date.now()}`;
    return;
  }
  if (action === "site-show-releases") {
    await refreshSiteCmsFromServer().catch(() => {});
    ui.modal = { type: "siteReleases" };
    return renderModal();
  }
  if (action === "site-publish-cms") return publishSiteCms();
  if (action === "site-rollback-cms") return rollbackSiteCms(actionElement.dataset.releaseId, actionElement.dataset.releaseVersion);
  if (action === "site-new-page") {
    ui.modal = { type: "sitePageEditor" };
    return renderModal();
  }
  if (action === "site-submit-page") return submitSitePage(actionElement.dataset.pageId);
  if (action === "site-module-add") {
    ui.modal = { type: "siteModule", pageId: actionElement.dataset.pageId || ui.sitePageId };
    return renderModal();
  }
  if (action === "site-module-edit") {
    ui.modal = { type: "siteModule", pageId: actionElement.dataset.pageId || ui.sitePageId, moduleId: actionElement.dataset.moduleId };
    return renderModal();
  }
  if (action === "site-save-module") return saveSiteModule(actionElement.dataset.pageId, actionElement.dataset.moduleId);
  if (action === "site-delete-module") return deleteSiteModule(actionElement.dataset.pageId, actionElement.dataset.moduleId);
  if (action === "site-add-category") {
    ui.modal = { type: "siteCategory" };
    return renderModal();
  }
  if (action === "site-category-action") {
    ui.modal = actionElement.dataset.categoryId ? { type: "siteCategory", categoryId: actionElement.dataset.categoryId } : { type: "siteCategoryManager" };
    return renderModal();
  }
  if (action === "site-edit-category") {
    ui.modal = { type: "siteCategory", categoryId: actionElement.dataset.categoryId };
    return renderModal();
  }
  if (action === "site-save-category") return saveSiteCategory(actionElement.dataset.categoryId);
  if (action === "site-publish-article") {
    ui.modal = { type: "sitePublish", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "site-confirm-publish") return submitSitePublish();
  if (action === "site-article-meta-edit") {
    ui.modal = { type: "siteArticleMeta", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "save-site-article-meta") return saveSiteArticleMeta();
  if (action === "site-article-preview") {
    ui.modal = { type: "siteArticlePreview", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "site-article-unpublish") {
    return unpublishSiteArticle(actionElement.dataset.articleId);
  }
  if (action === "site-content-production") {
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = "all";
    return navigate("content");
  }
  if (action === "site-nav-save") return saveSiteAppearance();
  if (action === "site-nav-add") {
    ui.modal = { type: "siteNav" };
    return renderModal();
  }
  if (action === "site-nav-edit") {
    ui.modal = { type: "siteNav", navId: actionElement.dataset.navId };
    return renderModal();
  }
  if (action === "site-save-nav") return saveSiteNav(actionElement.dataset.navId);
  if (action === "site-delete-nav") return deleteSiteNav(actionElement.dataset.navId);
  if (action === "site-footer-add-column") { ui.modal = { type: "siteFooterColumn" }; return renderModal(); }
  if (action === "site-footer-edit-column") { ui.modal = { type: "siteFooterColumn", columnId: actionElement.dataset.columnId }; return renderModal(); }
  if (action === "site-footer-save-column") return saveSiteFooterColumn(actionElement.dataset.columnId);
  if (action === "site-footer-delete-column") return deleteSiteFooterColumn(actionElement.dataset.columnId);
  if (action === "site-footer-add-social") { ui.modal = { type: "siteFooterSocial" }; return renderModal(); }
  if (action === "site-footer-edit-social") { ui.modal = { type: "siteFooterSocial", socialId: actionElement.dataset.socialId }; return renderModal(); }
  if (action === "site-footer-save-social") return saveSiteFooterSocial(actionElement.dataset.socialId);
  if (action === "site-footer-delete-social") return deleteSiteFooterSocial(actionElement.dataset.socialId);
  if (action === "site-lead-follow") {
    ui.modal = { type: "siteLeadFollow", leadId: actionElement.dataset.leadId };
    return renderModal();
  }
  if (action === "site-save-lead") return saveSiteLead(actionElement.dataset.leadId);
  if (action === "toggle-paged") {
    const stateKey = actionElement.dataset.state;
    if (stateKey) {
      ui[stateKey + "ShowAll"] = !ui[stateKey + "ShowAll"];
      return render();
    }
  }
  if (action === "site-deployment") {
    ui.modal = { type: "siteDeployment" };
    return renderModal();
  }
  if (action === "site-save-deployment") return saveSiteDeployment();
  if (action === "site-test-deployment") return testSiteDeployment();
  if (action === "site-redirects") {
    ui.modal = { type: "siteRedirects" };
    return renderModal();
  }
  if (action === "site-add-redirect") return addSiteRedirect();
  if (action === "site-toggle-redirect") return toggleSiteRedirect(actionElement.dataset.redirectId);
  if (action === "site-delete-redirect") return deleteSiteRedirect(actionElement.dataset.redirectId);
  if (action === "run-diagnostic") return runDiagnostic(actionElement);
  if (action === "save-site") return saveSiteSettings();
  if (action === "save-site-diagnostic-url") return saveSiteDiagnosticUrl();
  if (action === "save-site-contact") return saveSiteContactSettings();
  if (action === "export-leads") return exportSiteLeads();
  if (action === "refresh-knowledge") {
    refreshKnowledgeFromServer().then(() => render());
    refreshKnowledgeAssetsFromServer({ renderAfter: true });
    return showToast("知识数据已刷新", "知识库、条目与图片状态已重新读取。", "info");
  }
  if (action === "knowledge-tab") {
    ui.knowledgeTab = actionElement.dataset.tab;
    return render();
  }
  if (action === "knowledge-kind-filter") {
    ui.knowledgeKindFilter = actionElement.dataset.kind;
    return render();
  }
  if (action === "create-knowledge-base") {
    ui.modal = { type: "createKnowledgeBase" };
    return renderModal();
  }
  if (action === "submit-knowledge-base") return submitKnowledgeBase();
  if (action === "submit-knowledge-import") return submitKnowledgeImport().catch((error) => showToast("资料导入失败", error.message || "请检查文件后重试。", "error"));
  if (action === "upload-knowledge-images") {
    ui.modal = { type: "uploadKnowledgeImages" };
    return renderModal();
  }
  if (action === "submit-knowledge-images") return submitKnowledgeImages();
  if (action === "open-knowledge-base") {
    ui.modal = { type: "knowledgeBaseDetail", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "add-knowledge-item") {
    ui.modal = { type: "knowledgeItem", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "open-knowledge-item") {
    ui.modal = { type: "knowledgeItem", itemId: actionElement.dataset.itemId };
    return renderModal();
  }
  if (action === "edit-knowledge-item") {
    const item = knowledgeItemById(actionElement.dataset.itemId);
    if (!item) return showToast("知识条目不存在", "请刷新后重试。", "error");
    ui.modal = { type: "knowledgeItem", itemId: item.id, baseId: item.knowledgeBaseId, edit: true };
    return renderModal();
  }
  if (action === "back-knowledge-base") {
    ui.modal = { type: "knowledgeBaseDetail", baseId: actionElement.dataset.baseId };
    return renderModal();
  }
  if (action === "submit-knowledge-item") return submitKnowledgeItem(actionElement.dataset.baseId);
  if (action === "save-knowledge-item-edit") return updateKnowledgeItem(actionElement.dataset.itemId);
  if (action === "approve-knowledge-item") return approveKnowledgeItem(actionElement.dataset.itemId);
  if (action === "manage-knowledge-package") {
    ui.modal = { type: "knowledgePackage", lineId: actionElement.dataset.lineId || activeBusinessLine()?.id };
    return renderModal();
  }
  if (action === "save-knowledge-package") return saveKnowledgePackage(actionElement.dataset.lineId);
  if (action === "prepare-knowledge-material") {
    const preparation = knowledgePreparationById(actionElement.dataset.preparationId);
    if (!preparation) return showToast("未找到资料类型", "请刷新页面后重新选择要准备的资料。", "error");
    if (preparation.action === "profile") {
      ui.onboardingStep = 1;
      ui.modal = { type: "onboarding" };
      return renderModal();
    }
    if (preparation.action === "assets") {
      ui.modal = { type: "uploadKnowledgeImages", preparationId: preparation.id };
      return renderModal();
    }
    ui.modal = { type: "importKnowledge", preparationId: preparation.id };
    return renderModal();
  }
  if (action === "resolve-knowledge-gap") {
    const gap = state.knowledgeGaps.find((item) => item.id === actionElement.dataset.gapId);
    const base = (state.knowledgeBases || []).find((item) => item.kind === "document" && item.businessLineId === gap?.businessLineId) || (state.knowledgeBases || []).find((item) => item.kind === "document");
    if (!base) return showToast("请先新建文档库", "知识缺口需要先选择一个知识库承接。", "error");
    ui.modal = { type: "knowledgeItem", baseId: base.id, gapId: gap?.id || null };
    return renderModal();
  }
  if (action === "edit-knowledge") {
    if (actionElement.dataset.knowledge === "profile") {
      ui.onboardingStep = 1;
      ui.modal = { type: "onboarding" };
      return renderModal();
    }
    ui.modal = { type: "knowledge", knowledgeType: actionElement.dataset.knowledge };
    return renderModal();
  }
  if (action === "import-knowledge") {
    ui.modal = { type: "importKnowledge" };
    return renderModal();
  }
  if (action === "save-knowledge") {
    return saveLegacyKnowledge(actionElement.dataset.knowledge);
  }
  if (action === "open-risk") {
    ui.modal = { type: "risk", articleId: actionElement.dataset.articleId };
    return renderModal();
  }
  if (action === "locate-risk-hit") {
    return locateArticleRiskHit(actionElement.dataset.articleId, actionElement.dataset.riskHitId, actionElement.dataset.riskScope || "article");
  }
  if (action === "back-article") return openArticle(actionElement.dataset.articleId);
  if (action === "run-risk-scan") {
    const article = state.articles.find((item) => item.id === actionElement.dataset.articleId);
    if (!article) return;
    if (!currentUserCan("content.generate") && !currentUserCan("content.review")) return showToast("没有风控权限", "请由内容运营、审核人员或管理员执行检测。", "error");
    const previousRiskStatus = article.riskStatus;
    const previousRiskScan = cloneData(article.riskScan || null);
    const scan = applyArticleRiskScan(article);
    try {
      const payload = await contentServerRiskScan(article, scan);
      const remoteScan = payload?.data?.scan || payload?.scan || null;
      if (remoteScan?.status) {
        article.riskStatus = remoteScan.status === "passed" ? "clean" : remoteScan.status;
        article.riskScan = { ...scan, status: article.riskStatus, serverScanId: remoteScan.id || null, serverPolicyVersion: remoteScan.policyVersion || null };
      }
    } catch (error) {
      article.riskStatus = previousRiskStatus;
      article.riskScan = previousRiskScan;
      article.contentSyncError = error.message || "风控结果同步失败";
      saveState();
      render();
      ui.modal = { type: "risk", articleId: article.id };
      renderModal();
      return showToast("风控结果同步失败", article.contentSyncError, "error");
    }
    addOperationLog("内容风控", `检测文章《${article.title}》${article.version}：${article.riskStatus}，命中 ${scan.hits.length} 条规则`);
    saveState();
    ui.modal = { type: "risk", articleId: article.id };
    render();
    renderModal();
    if (article.riskStatus === "blocked") return showToast("风控检测已阻断", `命中 ${scan.hits.filter((hit) => hit.level === "blocked").length} 条禁用表述，修改后才能审核。`, "error");
    if (article.riskStatus === "warning") return showToast("风控检测需人工复核", `命中 ${scan.hits.length} 条敏感或合规规则，请查看片段并修改。`, "warning");
    return showToast("风控检测通过", "当前文章版本未命中企业内容规则。", "success");
  }
  if (action === "refresh-publisher") {
    refreshPublisherSnapshot({ renderAfter: true });
    return showToast("发布器状态已刷新", "已重新读取设备、账号与平台连接状态。", "info");
  }
  if (action === "edit-group") return showToast("请在本地助手中修改", "账号登录与分组只在客户电脑完成，然后同步状态到后台。");
  if (action === "pair-device") {
    ui.modal = { type: "pair" };
    renderModal();
    return issuePublisherPairing();
  }
  if (action === "refresh-publisher") {
    return refreshPublisherSnapshot({ renderAfter: true });
  }
  if (action === "settings-tab") {
    ui.settingsTab = actionElement.dataset.tab;
    render();
    if (ui.settingsTab === "models" && !aiProviderSnapshot.loaded) return refreshAiProviders({ renderAfter: true });
    if (ui.settingsTab === "effect-relay" && !effectRelayConfigSnapshot.loaded) return refreshEffectRelayConfig({ renderAfter: true });
    if (ui.settingsTab === "members") return refreshProductionMembers({ renderAfter: true });
    if (ui.settingsTab === "logs") return refreshProductionAudit({ renderAfter: true });
    return;
  }
  if (action === "refresh-ai-providers") return refreshAiProviders({ renderAfter: true });
  if (action === "refresh-effect-relay-config") return refreshEffectRelayConfig({ renderAfter: true });
  if (action === "save-effect-relay-config") return saveEffectRelayConfig();
  if (action === "test-effect-relay-config") return testEffectRelayConfig();
  if (action === "add-ai-provider") {
    const returnToModelKind = ui.modal?.type === "modelEditor" ? ui.modal.modelKind : "";
    ui.modal = { type: "aiProvider", returnToModelKind };
    return renderModal();
  }
  if (action === "edit-ai-provider") {
    ui.modal = { type: "aiProvider", providerId: actionElement.dataset.providerId || "" };
    return renderModal();
  }
  if (action === "save-ai-provider") return saveAiProvider();
  if (action === "test-ai-provider-draft") return saveAiProvider({ testAfter: true });
  if (action === "test-ai-provider") return testAiProvider(actionElement.dataset.providerId || "");
  if (action === "delete-ai-provider") return deleteAiProvider(actionElement.dataset.providerId || "");
  if (action === "edit-model") {
    ui.modal = { type: "modelEditor", modelKind: actionElement.dataset.modelKind };
    return renderModal();
  }
  if (action === "save-model") return saveModel(actionElement.dataset.modelKind);
  if (action === "invite-member") {
    ui.modal = { type: "memberEditor" };
    return renderModal();
  }
  if (action === "manage-member") {
    ui.modal = { type: "memberEditor", memberId: actionElement.dataset.memberId };
    return renderModal();
  }
  if (action === "save-member") return saveMember(actionElement.dataset.memberId || null);
  if (action === "delete-member") return deleteMember(actionElement.dataset.memberId);
  if (action === "save-settings") {
    addOperationLog("系统设置", "保存当前客户空间的部署与工作流配置");
    saveState();
    return showToast("设置已保存", "当前客户空间配置已更新。");
  }
  if (action === "show-version") {
    ui.modal = { type: "version" };
    return renderModal();
  }
  if (action === "refresh-audit") {
    refreshProductionAudit({ renderAfter: true });
    return showToast("操作日志已刷新", "已重新读取服务端审计记录。", "info");
  }
  if (action === "export-logs") return exportOperationLogs();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "effect-monitor-brand") {
    ui.effectMonitorBrand = event.target.value;
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-site") {
    ui.effectMonitorSite = event.target.value;
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-industry") {
    ui.effectMonitorIndustry = event.target.value;
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-aliases") {
    ui.effectMonitorAliases = effectMonitorAliases(event.target.value);
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-questions") {
    ui.effectMonitorQuestions = effectMonitorQuestionList(event.target.value).map((text, index) => ({ id: `monitor-input-${index + 1}`, text }));
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-competitors") {
    ui.effectMonitorCompetitors = String(event.target.value || "").split(/\r?\n/).map((line, index) => {
      const [name, terms = ""] = line.split(/[：:]/, 2);
      return { id: `monitor-competitor-${index + 1}`, name: String(name || "").trim(), terms: String(terms || "").trim() };
    }).filter((item) => item.name);
    invalidateEffectMonitorDraft();
  }
  if (event.target.id === "effect-monitor-interval-hours") ui.effectMonitorIntervalHours = event.target.value;
  if (event.target.id === "effect-monitor-max-credits") ui.effectMonitorMaxCredits = event.target.value;
  if (event.target.id === "effect-monitor-max-monthly-credits") ui.effectMonitorMaxMonthlyCredits = event.target.value;
  if (event.target.id === "effect-monitor-authorization-reference") ui.effectMonitorAuthorizationReference = event.target.value;
  if (event.target.id === "effect-monitor-authorization-expires-at") ui.effectMonitorAuthorizationExpiresAt = event.target.value;
  if (event.target.id === "effect-diagnostic-brand") {
    ui.effectDiagnosticBrand = event.target.value;
    invalidateEffectDiagnosticQuote();
  }
  if (event.target.id === "effect-diagnostic-site") {
    ui.effectDiagnosticSite = event.target.value;
    invalidateEffectDiagnosticQuote();
  }
  if (event.target.id === "effect-diagnostic-industry") {
    ui.effectDiagnosticIndustry = event.target.value;
    invalidateEffectDiagnosticQuote();
  }
  if (event.target.id === "effect-diagnostic-introduction") {
    ui.effectDiagnosticIntroduction = event.target.value;
    invalidateEffectDiagnosticQuote();
  }
  if (event.target.id === "effect-diagnostic-aliases") {
    ui.effectDiagnosticBrandTerms = effectDiagnosticAliases(event.target.value);
    invalidateEffectDiagnosticQuote();
  }
 if (event.target.id === "effect-diagnostic-questions") {
    if (document.querySelector(".effect-diagnostic-question-editor")) return;
    ui.effectDiagnosticQuestions = effectDiagnosticQuestionList(event.target.value).map((text, index) => ({ id: `diagnostic-input-${index + 1}`, text }));
    invalidateEffectDiagnosticQuote();
  }
 if (event.target.id === "effect-diagnostic-competitors") {
    if (document.querySelector(".effect-diagnostic-competitor-editor")) return;
    ui.effectDiagnosticCompetitors = String(event.target.value || "").split(/\r?\n/).map((line, index) => {
      const [name, terms = ""] = line.split(/[：:]/, 2);
      return { id: `competitor-${index + 1}`, name: String(name || "").trim(), terms: String(terms || "").trim() };
    }).filter((item) => item.name);
    invalidateEffectDiagnosticQuote();
  }
  if (event.target.id === "effect-diagnostic-start-brand") ui.effectDiagnosticBrand = event.target.value;
  if (event.target.id === "effect-diagnostic-start-site") ui.effectDiagnosticSite = event.target.value;
  if (event.target.id === "effect-diagnostic-brand") ui.effectDiagnosticBrand = event.target.value;
  if (event.target.id === "effect-diagnostic-site") ui.effectDiagnosticSite = event.target.value;
 if (event.target.matches("[data-effect-diagnostic-competitor-name]")) {
   const competitor = (ui.effectDiagnosticCompetitors || []).find((item) => item.id === event.target.dataset.competitorId);
   if (competitor) competitor.name = event.target.value;
    invalidateEffectDiagnosticQuote();
 }
 if (event.target.matches("[data-effect-diagnostic-competitor-terms]")) {
   const competitor = (ui.effectDiagnosticCompetitors || []).find((item) => item.id === event.target.dataset.competitorId);
   if (competitor) competitor.terms = event.target.value;
    invalidateEffectDiagnosticQuote();
 }
  if (event.target.id === "effect-search-question") {
    ui.effectSearchQuestion = event.target.value;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchFrozenQuestions = [];
    ui.effectSearchClientRunId = null;
    ui.effectSearchReport = null;
    ui.effectSearchReportError = "";
    ui.effectSearchReportAttemptedRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
    updateEffectSearchComposerState();
  }
  if (event.target.id === "effect-search-brand") {
    ui.effectSearchBrand = event.target.value;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchFrozenQuestions = [];
    ui.effectSearchClientRunId = null;
    ui.effectSearchReport = null;
    ui.effectSearchReportError = "";
    ui.effectSearchReportAttemptedRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
  }
  if (event.target.id === "effect-search-industry") {
    ui.effectSearchIndustry = event.target.value;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    ui.effectSearchReport = null;
    ui.effectSearchReportError = "";
    ui.effectSearchReportAttemptedRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
  }
  if (event.target.matches("[data-knowledge-asset-search]")) {
    ui.knowledgeAssetSearch = event.target.value;
    return render();
  }
  if (event.target.matches("[data-studio-asset-search]")) {
    const query = String(event.target.value || "").trim().toLowerCase();
    ui.studioAssetSearch = event.target.value;
    const picker = event.target.closest(".studio-asset-picker");
    const rows = [...(picker?.querySelectorAll("[data-studio-asset-searchable]") || [])];
    let visible = 0;
    rows.forEach((row) => {
      const matched = !query || String(row.dataset.studioAssetSearchable || "").includes(query);
      row.hidden = !matched;
      if (matched) visible += 1;
    });
    const counter = picker?.querySelector("[data-studio-asset-result-count]");
    if (counter) counter.textContent = String(visible);
    const empty = picker?.querySelector("[data-studio-asset-empty]");
    if (empty) empty.hidden = visible > 0;
    return;
  }
  if (event.target.id === "diagnostic-industry") ui.diagnosticIndustry = event.target.value;
  if (event.target.id === "diagnostic-goal") ui.diagnosticGoal = event.target.value;
  if (event.target.id === "analysis-prompt") {
    ui.analysisPrompt = event.target.value;
    const counter = document.querySelector(".analysis-prompt-foot > b");
    if (counter) counter.textContent = `${event.target.value.length.toLocaleString("zh-CN")} / 40,000`;
  }
  if (event.target.id === "analysis-plan-industry" && ui.analysisPlan?.intent) {
    ui.analysisPlan.intent.industry = event.target.value;
    ui.analysisIndustry = event.target.value;
  }
  if (event.target.id === "analysis-plan-questions" && ui.analysisPlan?.intent) {
    ui.analysisPlan.intent.representativeQuestions = event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }
  if (event.target.id === "analysis-industry") ui.analysisIndustry = event.target.value;
  if (event.target.id === "analysis-custom-depth") ui.analysisCustomDepth = event.target.value;
  if (event.target.id === "analysis-follow-up") ui.analysisFollowUp = event.target.value;
  if (event.target.matches("[data-publish-batch-article-search]")) {
    ui.publishBatchArticleSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".publish-article-row").forEach((row) => {
      row.hidden = Boolean(query && !row.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-publish-batch-platform-search]")) {
    ui.publishBatchSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".publish-platform-card").forEach((card) => {
      card.hidden = Boolean(query && !card.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-asset-search]")) {
    ui.assetSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".asset-card").forEach((card) => {
      card.hidden = Boolean(query && !card.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-content-article-search]")) {
    ui.articleSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".content-article-table tbody tr:not(.article-task-uncreated)").forEach((row) => {
      row.hidden = Boolean(query && !row.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.matches("[data-assistant-catalog-search]")) {
    ui.assistantCatalogSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll("[data-catalog-platform]").forEach((card) => {
      card.hidden = Boolean(query && !card.textContent.toLowerCase().includes(query));
    });
  }
  if (event.target.id === "studio-topic-input") {
    ui.studioTopicDraft = event.target.value;
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    if (workspace) {
      workspace.topic = { ...(workspace.topic || {}), source: "custom", title: event.target.value, prompt: event.target.value };
      workspace.updatedAt = Date.now();
      saveState();
    }
  }
  if (event.target.id === "studio-composer-input") {
    ui.studioComposerDraft = event.target.value;
    const sendButton = document.querySelector('[data-action="send-studio-chat"]');
    if (sendButton) sendButton.disabled = ui.studioGenerating || !event.target.value.trim();
  }
  if (event.target.id === "studio-title-editor" || event.target.id === "studio-content-editor") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const article = workspace && studioArticleForWorkspace(workspace);
    if (article) {
      const synced = syncStudioArticleEditor({ silent: true }) || article;
      refreshArticleRiskInlineNotice(synced, "studio", {
        title: event.target.id === "studio-title-editor" ? event.target.value : document.getElementById("studio-title-editor")?.value,
        content: event.target.id === "studio-content-editor" ? event.target.innerHTML : document.getElementById("studio-content-editor")?.innerHTML
      });
    } else if (workspace) {
      if (event.target.id === "studio-title-editor") {
        workspace.draftTitle = event.target.value;
        ui.studioTopicDraft = event.target.value;
        workspace.topic = { ...(workspace.topic || {}), source: "custom", title: event.target.value, prompt: event.target.value };
      } else {
        workspace.draftContent = event.target.innerText || "";
        workspace.draftContentHtml = sanitizeStudioHtml(event.target.innerHTML || "");
      }
      workspace.updatedAt = Date.now();
      saveState();
    }
    document.querySelector(".studio-save-state")?.classList.remove("unsaved");
    if (document.querySelector(".studio-save-state")) document.querySelector(".studio-save-state").textContent = "已自动保存";
  }
  if (event.target.id === "article-title-editor" || event.target.id === "article-content-editor") {
    const article = state.articles.find((item) => item.id === ui.modal?.articleId);
    if (article) {
      refreshArticleRiskInlineNotice(article, "article", {
        title: event.target.id === "article-title-editor" ? event.target.value : document.getElementById("article-title-editor")?.value,
        content: event.target.id === "article-content-editor" ? event.target.innerHTML : document.getElementById("article-content-editor")?.innerHTML
      });
    }
  }
  if (event.target.id === "business-keyword-input") {
    ui.businessKeywordInput = event.target.value;
    if (ui.businessKeywordError) {
      ui.businessKeywordError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "question-input") {
    ui.questionInput = event.target.value;
    if (ui.questionError) {
      ui.questionError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "seed-input") {
    ui.seedInput = event.target.value;
    if (ui.seedError) {
      ui.seedError = "";
      event.target.classList.remove("input-error");
      event.target.parentElement.querySelector(".error-text")?.remove();
    }
  }
  if (event.target.id === "command-input") {
    ui.commandQuery = event.target.value;
    updateCommandResults();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#article-show-public-citations")) {
    const article = saveArticleEditor({ silent: true });
    if (article) {
      ui.modal = { type: "article", articleId: article.id };
      renderModal();
    }
    return;
  }
  if (event.target.matches("#studio-show-public-citations")) {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const article = studioArticleForWorkspace(workspace);
    if (article) syncStudioArticleEditor({ silent: true });
    else if (workspace) {
      workspace.showPublicCitationMarkers = event.target.checked === true;
      workspace.updatedAt = Date.now();
      saveState();
    }
    return render();
  }
  if (event.target.matches("[data-effect-monitor-consent]")) {
    ui.effectMonitorExternalConsent = Boolean(event.target.checked);
    return render();
  }
  if (event.target.matches("[data-effect-monitor-platform-scope]")) {
    const selected = new Set((ui.effectMonitorScopes || []).map(effectRelayNormalizeScope));
    const scope = effectRelayNormalizeScope(event.target.value);
    event.target.checked ? selected.add(scope) : selected.delete(scope);
    ui.effectMonitorScopes = [...selected];
    invalidateEffectMonitorDraft();
    return render();
  }
  if (event.target.matches("[data-effect-monitor-platform-select-all]")) {
    ui.effectMonitorScopes = event.target.checked ? effectRelayCapabilityScopeKeys() : [];
    invalidateEffectMonitorDraft();
    return render();
  }
  if (event.target.matches("[data-effect-monitor-platform-mode]")) {
    const selected = new Set((ui.effectMonitorModes || []).map(effectRelayModeCode));
    const mode = effectRelayModeCode(event.target.value);
    event.target.checked ? selected.add(mode) : selected.delete(mode);
    ui.effectMonitorModes = [...selected];
    invalidateEffectMonitorDraft();
    return render();
  }
  if (event.target.matches("[data-effect-monitor-cadence]")) {
    ui.effectMonitorCadence = event.target.value || "weekly";
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-consent]")) {
    ui.effectDiagnosticExternalConsent = Boolean(event.target.checked);
    invalidateEffectDiagnosticQuote();
    return render();
  }
 if (event.target.matches("[data-effect-diagnostic-platform-scope]")) {
    ui.effectDiagnosticScopeSelectionTouched = true;
    const selected = new Set((ui.effectDiagnosticScopes || []).map(effectRelayNormalizeScope));
    const scope = effectRelayNormalizeScope(event.target.value);
    event.target.checked ? selected.add(scope) : selected.delete(scope);
    ui.effectDiagnosticScopes = [...selected];
    if (event.target.checked && !ui.effectDiagnosticPlatformRounds[scope]) ui.effectDiagnosticPlatformRounds[scope] = 1;
    invalidateEffectDiagnosticQuote();
    return render();
  }
 if (event.target.matches("[data-effect-diagnostic-platform-select-all]")) {
    ui.effectDiagnosticScopeSelectionTouched = true;
    ui.effectDiagnosticScopes = event.target.checked ? effectRelayCapabilityScopeKeys() : [];
    if (event.target.checked) {
      const nextRounds = { ...(ui.effectDiagnosticPlatformRounds || {}) };
      ui.effectDiagnosticScopes.forEach((scope) => { if (!nextRounds[scope]) nextRounds[scope] = 1; });
      ui.effectDiagnosticPlatformRounds = nextRounds;
    }
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-platform-mode]")) {
    const selected = new Set((ui.effectDiagnosticModes || []).map(effectRelayModeCode));
    const mode = effectRelayModeCode(event.target.value);
    event.target.checked ? selected.add(mode) : selected.delete(mode);
    ui.effectDiagnosticModes = [...selected];
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-platform-round]")) {
    const scope = effectRelayNormalizeScope(event.target.dataset.scope);
    const count = Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1)));
    ui.effectDiagnosticPlatformRounds = { ...(ui.effectDiagnosticPlatformRounds || {}), [scope]: count };
    invalidateEffectDiagnosticQuote();
    return render();
  }
  if (event.target.matches("[data-effect-center-filter]")) {
    const filter = event.target.dataset.effectCenterFilter;
    if (filter === "run") ui.effectCenterResultRunId = event.target.value || "all";
    if (filter === "platform") ui.effectCenterResultPlatform = event.target.value || "all";
    if (filter === "question") ui.effectCenterResultQuestion = event.target.value || "all";
    if (filter === "range") ui.effectCenterResultRange = event.target.value || "90";
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-scope]")) {
    const selected = new Set(ui.effectDiagnosticScopes || []);
    event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value);
    ui.effectDiagnosticScopes = [...selected];
    if (event.target.checked && !ui.effectDiagnosticPlatformRounds[event.target.value]) ui.effectDiagnosticPlatformRounds[event.target.value] = ui.effectDiagnosticRounds || 1;
    ui.effectDiagnosticCompleted = false;
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-select-all]")) {
    const scopes = effectPlatformCatalog().flatMap((platform) => platform.rows.map((row) => `${platform.name}|${row.device}`));
    ui.effectDiagnosticScopes = event.target.checked ? scopes : [];
    if (event.target.checked) scopes.forEach((scope) => { if (!ui.effectDiagnosticPlatformRounds[scope]) ui.effectDiagnosticPlatformRounds[scope] = ui.effectDiagnosticRounds || 1; });
    ui.effectDiagnosticCompleted = false;
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-mode]")) {
    const modes = new Set(ui.effectDiagnosticModes || []);
    event.target.checked ? modes.add(event.target.value) : modes.delete(event.target.value);
    if (!modes.size) modes.add(event.target.value);
    ui.effectDiagnosticModes = [...modes];
    ui.effectDiagnosticCompleted = false;
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-round]")) {
    const scope = event.target.dataset.scope;
    ui.effectDiagnosticPlatformRounds[scope] = Number(event.target.value || 1);
    ui.effectDiagnosticCompleted = false;
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-filter-platform]")) {
    ui.effectDiagnosticFilterPlatform = event.target.value || "all";
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-filter-question]")) {
    ui.effectDiagnosticFilterQuestion = event.target.value || "all";
    return render();
  }
  if (event.target.matches("[data-effect-diagnostic-filter-range]")) {
    ui.effectDiagnosticFilterRange = event.target.value || "30";
    return render();
  }
  if (event.target.matches("[data-effect-monitor-platform]")) {
    ui.effectMonitorPlatform = event.target.value || "all";
    return render();
  }
  if (event.target.matches("[data-effect-monitor-range]")) {
    ui.effectMonitorRange = event.target.value || "30";
    return refreshEffectMonitoringAnalytics({
      planId: ui.effectMonitorPlanId,
      range: ui.effectMonitorRange,
      renderAfter: true
    });
  }
  if (event.target.matches("[data-effect-search-consent]")) {
    ui.effectSearchExternalConsent = Boolean(event.target.checked);
    return render();
  }
  if (event.target.matches("[data-effect-platform-scope]")) {
    const selectedScopes = new Set(ui.effectPlatformScopes || []);
    event.target.checked ? selectedScopes.add(event.target.value) : selectedScopes.delete(event.target.value);
    ui.effectPlatformScopes = [...selectedScopes];
    ui.effectSearchScopeSelectionTouched = true;
    ui.effectPlatforms = [...new Set(ui.effectPlatformScopes.map((scope) => {
      const [platform] = effectRelayNormalizeScope(scope).split("|");
      return EFFECT_RELAY_PLATFORM_NAMES[platform] || platform;
    }))];
    ui.effectSearchRecords = [];
    ui.effectSearchCompleted = false;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
    return render();
  }
  if (event.target.matches("[data-effect-platform-select-all]")) {
    const scopes = effectRealtimeCapabilityScopeKeys();
    ui.effectPlatformScopes = event.target.checked ? scopes : [];
    ui.effectSearchScopeSelectionTouched = true;
    ui.effectPlatforms = event.target.checked ? [...new Set(scopes.map((scope) => {
      const [platform] = scope.split("|");
      return EFFECT_RELAY_PLATFORM_NAMES[platform] || platform;
    }))] : [];
    ui.effectSearchRecords = [];
    ui.effectSearchCompleted = false;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
    return render();
  }
  if (event.target.matches("[data-effect-platform-mode]")) {
    const modes = new Set(ui.effectPlatformModes || []);
    const family = event.target.dataset.effectPlatformModeFamily;
    const availableModes = [...new Set(effectRelayCapabilityItems().map((item) => String(item.mode || "").trim()).filter(Boolean))];
    const targets = family === "quick" ? availableModes.filter((mode) => mode === "fast")
      : family === "advanced" ? availableModes.filter((mode) => mode !== "fast")
        : [event.target.value];
    for (const mode of targets) event.target.checked ? modes.add(mode) : modes.delete(mode);
    if (!modes.size && availableModes.length) modes.add(availableModes.includes("fast") ? "fast" : availableModes[0]);
    ui.effectPlatformModes = [...modes];
    ui.effectSearchRecords = [];
    ui.effectSearchCompleted = false;
    ui.effectSearchQuoteReady = false;
    ui.effectSearchClientRunId = null;
    effectRelaySnapshot = { ...effectRelaySnapshot, quote: null };
    return render();
  }
  if (event.target.matches("[data-knowledge-asset-library-filter]")) {
    ui.knowledgeAssetLibraryFilter = event.target.value || "all";
    return render();
  }
  if (event.target.id === "knowledge-item-file") {
    const file = event.target.files?.[0] || null;
    const summary = document.getElementById("knowledge-item-file-summary");
    const titleInput = document.getElementById("knowledge-item-title");
    const sourceInput = document.getElementById("knowledge-item-source");
    if (summary) {
      summary.classList.toggle("has-file", Boolean(file));
      summary.innerHTML = file
        ? `<span data-icon="check"></span><span><b>${escapeHtml(file.name)}</b> · ${escapeHtml(formatBytes(file.size))} · ${escapeHtml(file.type || String(file.name).split(".").pop()?.toUpperCase() || "文件")}</span>`
        : '<span data-icon="info"></span><span>尚未选择文件；也可以直接在下方粘贴文字</span>';
      hydrateIcons(summary);
    }
    if (file && titleInput && !titleInput.value.trim()) titleInput.value = file.name.replace(/\.[^.]+$/, "") || file.name;
    if (file && sourceInput && !sourceInput.value.trim()) sourceInput.value = file.name;
    return;
  }
  if (event.target.id === "knowledge-image-files") {
    const files = Array.from(event.target.files || []);
    const size = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const summary = document.getElementById("knowledge-image-summary");
    if (summary) summary.innerHTML = `<span data-icon="${files.length ? "check" : "info"}"></span><span>${files.length ? `已选择 ${files.length} 张图片 · ${(size / 1024 / 1024).toFixed(1)} MB` : "尚未选择图片"}</span>`;
    hydrateIcons(summary || document);
    return;
  }
  if (event.target.matches("[data-analysis-source]")) {
    const selected = new Set(ui.analysisDataSources || []);
    event.target.checked ? selected.add(event.target.dataset.analysisSource) : selected.delete(event.target.dataset.analysisSource);
    ui.analysisDataSources = [...selected];
    ui.analysisPlan = null;
    return render();
  }
  if (event.target.matches("[data-analysis-platform]")) {
    const selected = new Set(ui.analysisPlatforms || []);
    event.target.checked ? selected.add(event.target.dataset.analysisPlatform) : selected.delete(event.target.dataset.analysisPlatform);
    ui.analysisPlatforms = [...selected];
    return render();
  }
  if (event.target.matches("[data-analysis-plan-platform]") && ui.analysisPlan?.intent) {
    const selected = new Set(ui.analysisPlan.intent.platforms || []);
    event.target.checked ? selected.add(event.target.dataset.analysisPlanPlatform) : selected.delete(event.target.dataset.analysisPlanPlatform);
    ui.analysisPlan.intent.platforms = ["豆包", "DeepSeek", "千问", "元宝"].filter((item) => selected.has(item));
    ui.analysisPlatforms = [...ui.analysisPlan.intent.platforms];
    return render();
  }
  if (event.target.matches('[name="analysis-depth"]')) {
    ui.analysisReportDepth = event.target.value;
    ui.analysisPlan = null;
    return render();
  }
  if (event.target.id === "analysis-provider") {
    ui.analysisProviderId = event.target.value;
    return render();
  }
  if (event.target.id === "analysis-follow-up-consent") {
    ui.analysisFollowUpConsent = event.target.checked;
    return;
  }
  if (event.target.matches("[data-diagnostic-business-line]")) {
    ui.diagnosticBusinessLineId = event.target.value || null;
    ui.diagnosticQuestionIds = [];
    ui.diagnosticQuestionSetFrozen = false;
    return render();
  }
  if (event.target.matches('[name="diagnostic-type"]')) {
    ui.diagnosticType = DIAGNOSTIC_TYPES[event.target.value] ? event.target.value : "comprehensive";
    ui.diagnosticQuestionSetFrozen = false;
    return render();
  }
  if (event.target.matches("[data-diagnostic-question]")) {
    const selected = new Set(ui.diagnosticQuestionIds || []);
    event.target.checked ? selected.add(event.target.dataset.diagnosticQuestion) : selected.delete(event.target.dataset.diagnosticQuestion);
    ui.diagnosticQuestionIds = [...selected];
    ui.diagnosticQuestionSetFrozen = false;
    const count = document.querySelector(".diagnostic-question-head .small-tag");
    if (count) count.textContent = `已选 ${selected.size} / ${document.querySelectorAll("[data-diagnostic-question]").length}`;
    return;
  }
  if (["site-page-schema", "site-page-sitemap", "site-setting-ai-crawl"].includes(event.target.id)) {
    event.target.closest(".toggle")?.classList.toggle("on", event.target.checked);
    return;
  }
  if (event.target.id === "tracked-work-article") {
    const article = state.articles.find((item) => item.id === event.target.value);
    if (!article) return;
    const record = articleAssetRecords().find((item) => item.article.id === article.id);
    const titleInput = document.getElementById("tracked-work-title");
    const siteInput = document.getElementById("tracked-work-site");
    const domainInput = document.getElementById("tracked-work-domain");
    const urlInput = document.getElementById("tracked-work-url");
    const questionInput = document.getElementById("tracked-work-questions");
    if (titleInput && !titleInput.value.trim()) titleInput.value = article.title;
    if (siteInput && !siteInput.value.trim() && !ui.modal.publicationOnly) siteInput.value = record?.sourceUrl ? state.site.domain : "待发布内容资产";
    if (domainInput && !domainInput.value.trim() && !ui.modal.publicationOnly) domainInput.value = domainFromUrl(record?.sourceUrl || article.siteUrl || "");
    if (urlInput && !urlInput.value.trim() && !ui.modal.publicationOnly) urlInput.value = record?.sourceUrl || article.siteUrl || "";
    if (questionInput && !Number(questionInput.value)) questionInput.value = String(monitoringBindingsForArticle(article.id)?.questionIds?.length || 0);
    return;
  }
  if (event.target.id === "model-provider") {
    const provider = (aiProviderSnapshot.providers || []).find((item) => item.id === event.target.value);
    const modelInput = document.getElementById("model-custom-name");
    if (provider?.model && modelInput && (!modelInput.value.trim() || /DeepSeek\s*V\d|演示|默认模型/i.test(modelInput.value.trim()))) {
      modelInput.value = provider.model;
    }
    return;
  }
  if (event.target.matches("[data-assistant-catalog-group]")) {
    ui.assistantCatalogGroupId = event.target.value || null;
    return render();
  }
  if (event.target.matches("[data-assistant-catalog-status]")) {
    ui.assistantCatalogStatus = event.target.value || "all";
    return render();
  }
  if (event.target.matches("[data-assistant-catalog-category]")) {
    ui.assistantCatalogCategory = event.target.value || "all";
    return render();
  }
  if (event.target.matches("[data-publish-batch-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group || !ui.publishBatchSelection) return;
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
    ui.publishBatchSelection.groupId = group.id;
    ui.publishBatchSelection.platforms = available;
    ui.publishBatchSelection.platformOrder = [...available];
    return render();
  }
  if (event.target.matches("[data-publish-batch-article]")) {
    if (!ui.publishBatchSelection) return;
    const selected = new Set(ui.publishBatchSelection.articleIds || []);
    event.target.checked ? selected.add(event.target.dataset.publishBatchArticle) : selected.delete(event.target.dataset.publishBatchArticle);
    ui.publishBatchSelection.articleIds = [...selected];
    const group = publishBatchGroup();
    const selectedArticles = state.articles.filter((article) => ui.publishBatchSelection.articleIds.includes(article.id));
    const available = new Set(PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id));
    const order = (ui.publishBatchSelection.platformOrder || []).filter((platform) => available.has(platform));
    ui.publishBatchSelection.platforms = order;
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (event.target.matches("[data-publish-batch-platform]")) {
    if (!ui.publishBatchSelection) return;
    const platform = event.target.dataset.publishBatchPlatform;
    const platforms = new Set(ui.publishBatchSelection.platforms || []);
    const order = [...(ui.publishBatchSelection.platformOrder || [])];
    if (event.target.checked) {
      platforms.add(platform);
      if (!order.includes(platform)) order.push(platform);
    } else {
      platforms.delete(platform);
      const index = order.indexOf(platform);
      if (index >= 0) order.splice(index, 1);
    }
    ui.publishBatchSelection.platforms = [...platforms];
    ui.publishBatchSelection.platformOrder = order;
    return render();
  }
  if (event.target.matches("[data-publish-batch-mode]")) {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.mode = event.target.value === "schedule" ? "schedule" : "immediate";
    return render();
  }
  if (event.target.matches("[data-publish-batch-interval]")) {
    if (!ui.publishBatchSelection) return;
    ui.publishBatchSelection.intervalMinutes = Math.max(5, Number(event.target.value) || 60);
    return render();
  }
  if (event.target.matches("[data-schedule-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group || !ui.scheduleSelection) return;
    const available = ["web", ...Object.keys(group.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform))];
    ui.scheduleSelection.groupId = group.id;
    ui.scheduleSelection.platforms = available;
    ui.scheduleSelection.platformOrder = [...available];
    return renderModal();
  }
  if (event.target.matches("[data-schedule-platform]")) {
    if (!ui.scheduleSelection) return;
    const platform = event.target.dataset.schedulePlatform;
    const platforms = new Set(ui.scheduleSelection.platforms || []);
    const order = [...(ui.scheduleSelection.platformOrder || [])];
    if (event.target.checked) {
      platforms.add(platform);
      if (!order.includes(platform)) order.push(platform);
    } else {
      platforms.delete(platform);
      const index = order.indexOf(platform);
      if (index >= 0) order.splice(index, 1);
    }
    ui.scheduleSelection.platforms = [...platforms];
    ui.scheduleSelection.platformOrder = order;
    return renderModal();
  }
  if (event.target.matches("[data-schedule-quota-mode]")) {
    if (!ui.scheduleSelection) return;
    ui.scheduleSelection.quotaMode = event.target.value === "finishDays" ? "finishDays" : "dailyCount";
    return renderModal();
  }
  if (ui.scheduleSelection && ["schedule-start-date", "schedule-daily-start", "schedule-daily-end", "schedule-interval", "schedule-daily-count", "schedule-finish-days"].includes(event.target.id)) {
    const fieldMap = {
      "schedule-start-date": "startDate",
      "schedule-daily-start": "dailyStart",
      "schedule-daily-end": "dailyEnd",
      "schedule-interval": "intervalMinutes",
      "schedule-daily-count": "dailyCount",
      "schedule-finish-days": "finishDays"
    };
    const numeric = ["schedule-interval", "schedule-daily-count", "schedule-finish-days"].includes(event.target.id);
    ui.scheduleSelection[fieldMap[event.target.id]] = numeric ? Math.max(1, Number(event.target.value) || 1) : event.target.value;
    return renderModal();
  }
  if (event.target.matches("[data-article-select]")) {
    const selected = new Set(selectedArticleIdsForCurrentView());
    const articleId = event.target.dataset.articleSelect;
    if (event.target.checked) selected.add(articleId);
    else selected.delete(articleId);
    ui.articleSelection = [...selected];
    return render();
  }
  if (event.target.matches("[data-select-all]")) {
    const scope = event.target.dataset.selectAll;
    if (scope === "content-articles") {
      const ids = [...document.querySelectorAll("[data-article-select]:not(:disabled)")].map((input) => input.dataset.articleSelect).filter(Boolean);
      ui.articleSelection = event.target.checked ? ids : [];
      return render();
    }
    if (scope === "keyword-questions") {
      const line = activeBusinessLine();
      const packId = event.target.dataset.selectPackId;
      const dimension = event.target.dataset.selectDimension || "all";
      state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "candidate" && question.packId === packId && (dimension === "all" || question.dimension === dimension)).forEach((question) => { question.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "question-library") {
      const line = activeBusinessLine();
      state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "active").forEach((question) => { question.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "topic-library") {
      const line = activeBusinessLine();
      state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "active").forEach((topic) => { topic.selected = event.target.checked; });
      saveState();
      return render();
    }
    if (scope === "publish-platforms") {
      const group = state.accountGroups.find((item) => item.id === ui.publishSelection?.groupId) || state.accountGroups[0];
      const article = state.articles.find((item) => item.id === ui.publishSelection?.articleId);
      const existing = articleExistingPublishPlatforms(article);
      const available = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled && (entry.category === "self_media" || entry.id === "web"))
        .map((entry) => entry.id)
        .filter((platform) => (platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform))) && !existing.has(platform));
      if (ui.publishSelection) ui.publishSelection.platforms = event.target.checked ? available : [];
      return renderModal();
    }
  }
  if (event.target.id === "content-plan-filter") {
    ui.articleTaskView = "articles";
    ui.articlePlanFilterId = event.target.value || "all";
    ui.articleTab = "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.matches("[data-content-risk-filter]")) {
    ui.articleRiskFilter = event.target.value || "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.matches("[data-content-knowledge-filter]")) {
    ui.articleKnowledgeFilter = event.target.value || "all";
    clearArticleSelection();
    return render();
  }
  if (event.target.id === "studio-business-line") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const line = state.businessLines.find((item) => item.id === event.target.value && item.status === "active");
    if (!workspace || !conversation || !line || workspace.articleId) return;
    const inherited = inheritedKnowledgeBaseIds(line);
    const agent = defaultAgentForLine(line, workspace.contentType);
    workspace.businessLineId = line.id;
    workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
    workspace.knowledgeScope = { inheritedBaseIds: cloneData(inherited), addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: cloneData(inherited), snapshottedAt: new Date().toISOString(), lockedVersionIds: [] };
    workspace.selectedKnowledgeBaseIds = cloneData(inherited);
    workspace.selectedKnowledgeItemIds = [];
    workspace.writingAgentId = agent?.id || null;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    conversation.selectedAgentId = agent?.id || null;
    conversation.selectedKnowledgeBaseIds = cloneData(inherited);
    conversation.selectedKnowledgeItemIds = [];
    conversation.updatedAt = workspace.updatedAt;
    ui.selectedBusinessLineId = line.id;
    ui.studioAgentId = agent?.id || null;
    saveState();
    return render();
  }
  if (event.target.id === "studio-content-type") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    if (!workspace || workspace.articleId) return;
    workspace.contentType = event.target.value;
    const current = writingAgentById(workspace.writingAgentId);
    const agent = writingAgentSupports(current, workspace.businessLineId, workspace.contentType) ? current : defaultAgentForLine(state.businessLines.find((line) => line.id === workspace.businessLineId), workspace.contentType);
    workspace.writingAgentId = agent?.id || null;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    if (conversation) {
      conversation.selectedAgentId = agent?.id || null;
      conversation.updatedAt = workspace.updatedAt;
    }
    ui.studioContentType = workspace.contentType;
    ui.studioAgentId = agent?.id || null;
    saveState();
    return render();
  }
  if (event.target.id === "studio-direct-agent") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const agent = writingAgentById(event.target.value);
    if (!workspace || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return;
    workspace.writingAgentId = agent.id;
    workspace.writingAgentSnapshot = snapshotWritingAgent(agent, { selectionSource: "quick_create" });
    workspace.updatedAt = Date.now();
    if (conversation) {
      conversation.selectedAgentId = agent.id;
      conversation.updatedAt = workspace.updatedAt;
    }
    ui.studioAgentId = agent.id;
    saveState();
    return render();
  }
  if (event.target.id === "studio-chat-agent") {
    const workspace = studioWorkspaceById(ui.studioWorkspaceId);
    const conversation = studioConversationForWorkspace(workspace);
    const agent = writingAgentById(event.target.value);
    if (!workspace || !conversation || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return showToast("智能体不可用", "请选择适用于当前文章的智能体。", "error");
    conversation.selectedAgentId = agent.id;
    conversation.updatedAt = Date.now();
    ui.studioAgentId = agent.id;
    saveState();
    return render();
  }
  if (event.target.id === "studio-attachment-input") {
    addStudioFiles(event.target.files, "attachment");
    event.target.value = "";
    return;
  }
  if (event.target.id === "studio-image-input") {
    addStudioFiles(event.target.files, "image");
    event.target.value = "";
    return;
  }
  if (event.target.id === "content-plan-agent" || event.target.id === "content-plan-type") {
    const agentSelect = document.getElementById("content-plan-agent");
    const type = document.getElementById("content-plan-type")?.value || "深度文章";
    let agent = writingAgentById(agentSelect?.value);
    if (event.target.id === "content-plan-type" && !writingAgentSupports(agent, activeBusinessLine()?.id, type)) {
      const compatible = activeWritingAgents(activeBusinessLine()?.id, type);
      if (compatible[0] && agentSelect) {
        agentSelect.value = compatible[0].id;
        agent = compatible[0];
      }
    }
    const summary = document.getElementById("plan-agent-summary");
    if (agent && summary) {
      const compatible = writingAgentSupports(agent, activeBusinessLine()?.id, type);
      summary.classList.toggle("invalid", !compatible);
      summary.innerHTML = `<span class="writing-agent-avatar ${escapeHtml(agent.color || "blue")}">${escapeHtml(agent.avatar || agent.name.slice(0, 1))}</span><span><b>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</b><small>${escapeHtml(agent.style)} · ${agent.strictKnowledge ? "严格知识模式" : "普通知识模式"}${compatible ? "" : " · 不适用于当前内容形式"}</small></span>`;
    }
    return;
  }
  if (event.target.matches("[data-planning-business]")) {
    ui.selectedBusinessLineId = event.target.value;
    ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === ui.selectedBusinessLineId)?.id || null;
    ui.selectedCoreKeywordIds = [];
    ui.seedInput = "";
    ui.planningCategory = "all";
    ui.articleTaskView = "plans";
    ui.articlePlanFilterId = "all";
    ui.articleTab = "all";
    clearArticleSelection();
    state.questionLibrary.forEach((question) => { question.selected = false; });
    state.topics.forEach((topic) => { topic.selected = false; });
    saveState();
    return render();
  }
  if (event.target.matches("[data-core-select]")) {
    const keywordId = event.target.dataset.coreSelect;
    const keyword = state.keywords.find((item) => item.id === keywordId && item.status === "active" && !isSeedKeyword(item));
    if (!keyword || keyword.businessLineId !== activeBusinessLine()?.id) return render();
    const selected = new Set(ui.selectedCoreKeywordIds || []);
    event.target.checked ? selected.add(keywordId) : selected.delete(keywordId);
    ui.selectedCoreKeywordIds = [...selected];
    return render();
  }
  if (event.target.matches("[data-seed-select]")) {
    const keyword = state.keywords.find((item) => item.id === event.target.dataset.seedSelect && item.status === "active" && isSeedKeyword(item));
    if (!keyword || keyword.businessLineId !== activeBusinessLine()?.id) return render();
    const terms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean);
    const matchIndex = terms.findIndex((term) => term.toLowerCase() === keyword.term.toLowerCase());
    if (event.target.checked && matchIndex < 0) {
      if (terms.length >= 8) {
        event.target.checked = false;
        return showToast("最多选择 8 个种子词", "请先取消一个已选种子词，再选择新的候选。", "error");
      }
      terms.push(keyword.term);
    } else if (!event.target.checked && matchIndex >= 0) {
      terms.splice(matchIndex, 1);
    }
    ui.seedInput = terms.join("，");
    ui.seedError = "";
    return render();
  }
  if (event.target.matches('[data-monitor-filter="platform"]')) {
    ui.monitoringPlatform = event.target.value;
    return render();
  }
  if (event.target.matches('[data-monitor-filter="range"]')) {
    ui.monitoringRange = event.target.value;
    return refreshRealMonitoring({ silent: false });
  }
  if (event.target.id === "monitoring-suggestion-generation") {
    ui.monitoringSuggestionGeneration = event.target.checked;
    return render();
  }
  if (event.target.id === "monitoring-suggestion-provider") {
    ui.monitoringSuggestionProviderId = event.target.value || "";
    return;
  }
  if (event.target.matches("[data-topic-select]")) {
    const topic = state.topics.find((item) => item.id === event.target.dataset.topicSelect);
    if (topic && topic.status === "active" && !planningTopicPlans(topic).length) topic.selected = event.target.checked;
    saveState();
    return render();
  }
  if (event.target.matches("[data-question-select]")) {
    const question = state.questionLibrary.find((item) => item.id === event.target.dataset.questionSelect);
    if (question && question.status !== "archived") question.selected = event.target.checked;
    saveState();
    return render();
  }
  if (event.target.matches("[data-publish-group]")) {
    const group = state.accountGroups.find((item) => item.id === event.target.value);
    if (!group) return;
    const article = state.articles.find((item) => item.id === ui.publishSelection?.articleId);
    const existing = articleExistingPublishPlatforms(article);
    ui.publishSelection.groupId = group.id;
    ui.publishSelection.platforms = ["web", ...Object.keys(group.accounts || {}).filter((platform) => publisherAccountReadyForGroup(group, platform)).map(canonicalPublishPlatformId)].filter((platform) => !existing.has(platform));
    return renderModal();
  }
  if (event.target.matches("[data-publish-platform]")) {
    const platform = event.target.dataset.publishPlatform;
    const platforms = new Set(ui.publishSelection.platforms);
    event.target.checked ? platforms.add(platform) : platforms.delete(platform);
    ui.publishSelection.platforms = [...platforms];
    return renderModal();
  }
});

window.addEventListener("hashchange", render);
window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.id === "prompt-input") {
    event.preventDefault();
    const el = document.querySelector('[data-action="confirm-action"]');
    if (el) el.click();
    return;
  }
  if (event.key === "Enter" && event.target.id === "studio-composer-input" && !event.shiftKey) {
    event.preventDefault();
    return sendStudioChat();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && ui.contentView === "studio") {
    event.preventDefault();
    return syncStudioArticleEditor();
  }
  if (event.key === "Enter" && event.target.id === "business-keyword-input") {
    event.preventDefault();
    return expandSeedKeywords();
  }
  if (event.key === "Enter" && event.target.id === "question-input") {
    event.preventDefault();
    return addQuestionToLibrary();
  }
  if (event.key === "Enter" && event.target.id === "seed-input") {
    event.preventDefault();
    return generateQuestionPack();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.commandQuery = "";
    ui.modal = { type: "search" };
    renderModal();
    return window.setTimeout(() => document.getElementById("command-input")?.focus(), 30);
  }
  if (event.key === "Escape") {
    if (ui.modal) closeModal();
    document.body.classList.remove("sidebar-open");
  }
});

async function startPrivateDeploymentApplication() {
  await (window.__TZ_AUTH_READY__ || Promise.resolve(window.__TZ_AUTH__));
  await hydrateWorkspaceFromServer();
  await refreshSiteCmsFromServer();
  await refreshKnowledgeFromServer().catch(() => {});
  await refreshKnowledgeAssetsFromServer().catch(() => {});
  const currentUser = window.__TZ_AUTH__?.user;
  const avatar = document.querySelector(".avatar-button");
  if (avatar && currentUser) {
    avatar.textContent = String(currentUser.displayName || currentUser.name || currentUser.username || "企").trim().slice(0, 1);
    avatar.title = `${currentUser.displayName || currentUser.name || currentUser.username} · ${currentUser.role || "member"}`;
  }
  hydrateIcons(document);
  const requestedRoute = location.hash.replace(/^#/, "").split("?")[0];
  if (!location.hash || !PAGE_META[requestedRoute]) history.replaceState(null, "", "#dashboard");
  render();
  migrateFormalContentRecords().catch((error) => console.warn("Formal content migration failed", error));
  refreshAiProviders({ renderAfter: false }).catch(() => {});
  refreshProductionMembers({ renderAfter: false }).catch(() => {});
  refreshProductionAudit({ renderAfter: false }).catch(() => {});
  refreshPublisherSnapshot({ renderAfter: true }).catch(() => {});
  window.setInterval(() => refreshPublisherSnapshot({ renderAfter: ["publish", "assistant"].includes(currentRoute()) }), 15000);
  window.setInterval(() => { if (currentRoute() === "monitoring" && !monitoringSnapshot.loading) refreshRealMonitoring({ silent: true }); }, 60000);
}

startPrivateDeploymentApplication().catch((error) => {
  console.error("生产后台启动失败", error);
  const view = document.getElementById("view");
  if (view && !document.getElementById("production-auth-root")) {
    view.innerHTML = `<div class="page-container"><div class="card empty-state"><div><h3>生产数据服务未就绪</h3><p>${escapeHtml(error.message || "请检查服务端日志和数据库状态。")}</p><button class="primary-button" type="button" data-reload-production>重新连接</button></div></div></div>`;
    view.querySelector("[data-reload-production]")?.addEventListener("click", () => window.location.reload());
  }
});
