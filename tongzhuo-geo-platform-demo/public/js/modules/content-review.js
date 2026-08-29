



function renderKnowledgePackageModal() {
  const line = state.businessLines.find((item) => item.id === ui.modal.lineId);
  if (!line) return "";
  const publicBases = (state.knowledgeBases || []).filter((base) => base.scope === "enterprise" && base.status !== "archived");
  const selectable = (state.knowledgeBases || []).filter((base) => base.scope !== "enterprise" && base.status !== "archived" && (!base.businessLineId || base.businessLineId === line.id));
  const publicRows = publicBases.map((base) => '<label class="knowledge-check-row locked"><input type="checkbox" checked disabled /><span class="knowledge-check-icon" data-icon="globe"></span><span><b>' + escapeHtml(base.name) + '</b><small>企业公共知识 · 自动继承 · ' + approvedKnowledgeItems(base.id).length + ' 条可用</small></span><em>固定</em></label>').join("");
  const rows = selectable.map((base) => '<label class="knowledge-check-row"><input class="checkbox" type="checkbox" data-package-base value="' + base.id + '" ' + ((line.knowledgeBaseIds || []).includes(base.id) ? "checked" : "") + ' /><span class="knowledge-check-icon" data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span><span><b>' + escapeHtml(base.name) + '</b><small>' + knowledgeKindLabel(base.kind) + ' · ' + approvedKnowledgeItems(base.id).length + ' 条可用于写作</small></span><em>' + escapeHtml(knowledgeScopeLabel(base)) + '</em></label>').join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配置业务线知识包</h2><p>${escapeHtml(line.name)} · 新内容计划默认继承这里的选择</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="knowledge-scope-block"><h3>企业公共知识</h3><p>由系统自动加入，业务线不能排除。</p>${publicRows}</div><div class="knowledge-scope-block"><h3>业务线默认知识库</h3><p>只显示归属当前业务线的知识库，避免跨业务线调用错误资料。</p>${rows || '<div class="empty-state compact"><div><span data-icon="book"></span><h3>没有可绑定的专属知识库</h3><p>请先创建属于这条业务线的文档库或问答库。</p></div></div>'}</div><div class="privacy-note"><span data-icon="history"></span><span>修改默认知识包只影响以后新建的内容计划；已保存计划的知识范围快照不会被覆盖。</span></div></div>
    <div class="modal-foot"><span>公共库 ${publicBases.length} 个 · 专属库可多选</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-knowledge-package" data-line-id="${line.id}"><span data-icon="check"></span>保存默认知识包</button></div></div>
  `, { wide: true });
}
function renderOnboardingModal() {
  const profile = state.enterpriseProfile;
  const isComplete = enterpriseFactCompletion(profile) === 100;
  const steps = [
    ["企业身份", "主体、品牌与官方域名"],
    ["业务边界", "服务、客户与禁止承诺"],
    ["证据资料", "案例、FAQ 与公开范围"],
    ["监测基线", "问题集与首批 AI 平台"]
  ];
  const stepHtml = steps.map((step, index) => {
    const number = index + 1;
    const stateClass = number < ui.onboardingStep ? "done" : number === ui.onboardingStep ? "active" : "";
    return '<div class="onboarding-step ' + stateClass + '"><span>' + (number < ui.onboardingStep ? icon("check") : number) + '</span><div><b>' + step[0] + '</b><small>' + step[1] + "</small></div></div>";
  }).join("");

  let body = "";
  if (ui.onboardingStep === 1) {
    body = `
      <div class="field-row"><div class="field"><label for="onboard-company">企业全称 *</label><input class="input" id="onboard-company" value="${escapeHtml(profile.companyName)}" placeholder="请输入工商登记全称" /></div><div class="field"><label for="onboard-brand">展示品牌</label><input class="input" id="onboard-brand" value="${escapeHtml(profile.brandName)}" /></div></div>
      <div class="field mt-md"><label for="onboard-intro">企业介绍 *</label><textarea class="textarea" id="onboard-intro" placeholder="说明企业定位、核心能力和服务对象">${escapeHtml(profile.introduction)}</textarea></div>
      <div class="field-row mt-md"><div class="field"><label for="onboard-domain">官方域名</label><input class="input" id="onboard-domain" value="${escapeHtml(profile.officialDomain)}" /></div><div class="field"><label for="onboard-industry">行业与地区</label><input class="input" id="onboard-industry" value="${escapeHtml(profile.industryRegion)}" /></div></div>
    `;
  } else if (ui.onboardingStep === 2) {
    body = `
      <div class="field"><label for="onboard-service">主推产品 / 服务 *</label><input class="input" id="onboard-service" value="${escapeHtml(profile.primaryService)}" /></div>
      <div class="field mt-md"><label for="onboard-service-desc">定位、能力与交付边界 *</label><textarea class="textarea" id="onboard-service-desc">${escapeHtml(profile.serviceDescription)}</textarea></div>
      <div class="field-row mt-md"><div class="field"><label for="onboard-audience">目标客户</label><input class="input" id="onboard-audience" value="${escapeHtml(profile.audience)}" /></div><div class="field"><label>服务范围</label><input class="input" id="onboard-area" value="${escapeHtml(profile.serviceArea)}" /></div></div>
      <div class="security-inline"><span data-icon="shield"></span><span>禁止承诺：不使用“保证排名、百分百收录、绝对第一”等无法验证的表述。</span></div>
    `;
  } else if (ui.onboardingStep === 3) {
    body = `
      <div class="onboarding-evidence-grid">
        <button class="evidence-card complete" type="button" data-action="onboarding-evidence" data-evidence-kind="website"><span data-icon="globe"></span><b>官网资料</b><small>已导入 9 个页面</small></button>
        <button class="evidence-card complete" type="button" data-action="onboarding-evidence" data-evidence-kind="document"><span data-icon="folder"></span><b>企业文件</b><small>已审核 34 / 36 份</small></button>
        <button class="evidence-card ${isComplete ? "complete" : "pending"}" type="button" data-action="onboarding-evidence" data-evidence-kind="case"><span data-icon="briefcase"></span><b>典型案例</b><small>${isComplete ? "8 / 8" : "7 / 8"} 条已确认</small></button>
        <button class="evidence-card ${isComplete ? "complete" : "pending"}" type="button" data-action="onboarding-evidence" data-evidence-kind="qa"><span data-icon="help"></span><b>常见问题</b><small>${isComplete ? "24 / 24" : "22 / 24"} 条已确认</small></button>
      </div>
      <div class="privacy-note"><span data-icon="info"></span><span>官网导入与 AI 整理只生成待确认草稿。正式发布到企业知识前必须人工核对事实与公开范围。</span></div>
    `;
  } else {
    body = `
      <div class="monitor-baseline">
        <div><span class="knowledge-icon" data-icon="target"></span><p><b>核心品牌基线问题</b><small>系统默认保留 8 个核心问题，监测设置与选题中心相互独立。</small></p><span class="status-badge status-approved">已准备</span></div>
        <div><span class="knowledge-icon teal" data-icon="cpu"></span><p><b>客户可用检测能力</b><small>平台、终端与模式由中央服务实时回传，不在客户端写死平台名单。</small></p><span class="status-badge status-approved">实时读取</span></div>
        <div><span class="knowledge-icon amber" data-icon="users"></span><p><b>竞品基线</b><small>${isComplete ? "已确认首批竞品，后续可持续调整。" : "正式运行前还需确认真实竞品品牌。"}</small></p><span class="status-badge ${isComplete ? "status-approved" : "status-review"}">${isComplete ? "已确认" : "待确认"}</span></div>
      </div>
      <div class="privacy-note inset"><span data-icon="info"></span><span>完成建档后会生成企业事实卡和品牌基线配置；正式监测任务由客户服务端按授权创建，首次运行前会再次报价并冻结问题集。</span></div>
    `;
  }

  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">企业建档引导</h2><p>第 ${ui.onboardingStep} / 4 步 · 所有资料最终进入同一份企业知识</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="onboarding-layout">
      <aside class="onboarding-steps">${stepHtml}</aside>
      <div class="modal-body onboarding-form"><h3>${steps[ui.onboardingStep - 1][0]}</h3><p class="onboarding-lead">${steps[ui.onboardingStep - 1][1]}</p>${body}</div>
    </div>
    <div class="modal-foot"><span>已完成 ${Math.min(ui.onboardingStep - 1, 3)} / 4 步</span><div class="modal-foot-right">${ui.onboardingStep > 1 ? '<button class="secondary-button" type="button" data-action="onboarding-prev">上一步</button>' : '<button class="secondary-button" type="button" data-action="close-modal">稍后继续</button>'}${ui.onboardingStep < 4 ? '<button class="primary-button" type="button" data-action="onboarding-next">保存并继续</button>' : '<button class="primary-button" type="button" data-action="finish-onboarding"><span data-icon="check"></span>完成建档并开始策划</button>'}</div></div>
  `, { wide: true });
}

function renderBusinessLineModal() {
  const editing = state.businessLines.find((line) => line.id === ui.modal.businessLineId);
  const isEdit = Boolean(editing);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${isEdit ? "编辑业务线" : "新增产品 / 业务线"}</h2><p>业务线是关键词、问题、选题和内容计划的共同归属</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="business-line-name">业务线名称 *</label><input class="input ${ui.businessLineError ? "input-error" : ""}" id="business-line-name" value="${escapeHtml(editing?.name || "")}" placeholder="例如：工业清洗设备" autocomplete="off" />${ui.businessLineError ? '<small class="error-text">' + escapeHtml(ui.businessLineError) + "</small>" : ""}</div>
      <div class="field mt-md"><label for="business-line-product">主推产品 / 服务</label><input class="input" id="business-line-product" value="${escapeHtml(editing?.product || "")}" placeholder="例如：激光清洗设备与交付服务" /></div>
      <div class="field-row mt-md"><div class="field"><label for="business-line-audience">目标客户</label><input class="input" id="business-line-audience" value="${escapeHtml(editing?.audience || "")}" placeholder="例如：汽车零部件制造企业" /></div><div class="field"><label for="business-line-scenario">核心场景</label><input class="input" id="business-line-scenario" value="${escapeHtml(editing?.positioning || editing?.scenario || "")}" placeholder="例如：除锈、除漆与模具清洁" /></div></div>
      <div class="privacy-note"><span data-icon="info"></span><span>${isEdit ? "修改会同步到该业务线下的选题、计划和文章展示。" : "创建后会自动切换到新业务线，可立即添加种子关键词并开始拓展。"}</span></div>
    </div>
    <div class="modal-foot"><span>同一客户空间内业务线名称不能重复</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-business-line">${isEdit ? "保存修改" : '<span data-icon="plus"></span>创建业务线'}</button></div></div>
  `);
}

function businessLineImpact(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId);
  const topicIds = state.topics.filter((topic) => topicBusinessLineId(topic) === lineId).map((topic) => topic.id);
  const planIds = state.contentPlans.filter((plan) => plan.businessLineId === lineId).map((plan) => plan.id);
  const articleIds = state.articles.filter((article) => article.businessLineId === lineId || article.generationSnapshot?.businessLineId === lineId || planIds.includes(article.planId) || topicIds.includes(article.topicId)).map((article) => article.id);
  const impact = {
    keywords: state.keywords.filter((item) => item.businessLineId === lineId).length,
    packs: state.keywordPacks.filter((item) => item.businessLineId === lineId).length,
    questions: state.questionLibrary.filter((item) => item.businessLineId === lineId).length,
    topics: topicIds.length,
    plans: planIds.length,
    articles: articleIds.length,
    publishedArticles: state.articles.filter((article) => articleIds.includes(article.id) && article.status === "published").length,
    publishTasks: state.publishTasks.filter((task) => articleIds.includes(task.articleId)).length,
    knowledgeBases: (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.scope !== "enterprise").length,
    knowledgeGaps: (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId).length,
    monitoringTasks: (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line?.name).length
  };
  impact.total = impact.keywords + impact.packs + impact.questions + impact.topics + impact.plans + impact.articles + impact.publishTasks + impact.knowledgeBases + impact.knowledgeGaps + impact.monitoringTasks;
  return impact;
}

function renderBusinessLineManagerModal() {
  const activeLines = state.businessLines.filter((line) => line.status === "active");
  const archivedLines = state.businessLines.filter((line) => line.status === "archived");
  const activeRows = activeLines.map((line) => {
    const impact = businessLineImpact(line.id);
    const deleteDisabled = activeLines.length <= 1;
    return `<article class="business-line-manage-row"><span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span><div><b>${escapeHtml(line.name)}</b><p>${escapeHtml(line.product || "未填写主推产品")}</p><small>${impact.keywords} 关键词 · ${impact.questions} 问题 · ${impact.plans} 计划 · ${impact.articles} 文章 · ${impact.knowledgeBases} 知识库</small></div><button class="secondary-button button-small" type="button" data-action="edit-business-line" data-line-id="${line.id}">编辑</button><button class="danger-button button-small" type="button" data-action="request-delete-business-line" data-line-id="${line.id}" ${deleteDisabled ? "disabled" : ""}>${deleteDisabled ? "至少保留一条" : "删除"}</button></article>`;
  }).join("");
  const archivedRows = archivedLines.map((line) => {
    const impact = businessLineImpact(line.id);
    return `<article class="business-line-manage-row archived"><span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span><div><b>${escapeHtml(line.name)}</b><p>已从日常运营入口移除</p><small>保留 ${impact.articles} 篇历史文章与 ${impact.knowledgeBases} 个业务线知识库的证据关系</small></div><button class="secondary-button button-small" type="button" data-action="restore-business-line" data-line-id="${line.id}"><span data-icon="refresh"></span>恢复</button></article>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">产品 / 业务线管理</h2><p>新增、删除或恢复业务线；至少保留一条可运营业务线</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="business-line-manage-head"><div><h3>正在使用</h3><p>删除后将从选题、计划和知识配置入口中移除。</p></div><button class="primary-button button-small" type="button" data-action="open-business-line"><span data-icon="plus"></span>新增业务线</button></div><div class="business-line-manage-list">${activeRows}</div>${archivedRows ? '<div class="business-line-manage-head archived-head"><div><h3>已删除，可恢复</h3><p>保留历史文章、发布记录和引用证据。</p></div></div><div class="business-line-manage-list">' + archivedRows + '</div>' : ""}<div class="privacy-note"><span data-icon="info"></span><span>空业务线会直接删除；已有内容的业务线采用可恢复删除，避免历史文章和知识引用失去来源。</span></div></div>
    <div class="modal-foot"><span>当前 ${activeLines.length} 条可用业务线</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>
  `, { wide: true });
}

function renderDeleteBusinessLineModal() {
  const line = state.businessLines.find((item) => item.id === ui.modal.lineId && item.status === "active");
  if (!line) return "";
  const impact = businessLineImpact(line.id);
  const isEmpty = impact.total === 0;
  const activeCount = state.businessLines.filter((item) => item.status === "active").length;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">删除业务线</h2><p>${escapeHtml(line.name)} · ${isEmpty ? "空业务线将永久删除" : "已有历史数据，将采用可恢复删除"}</p></div><button class="icon-button" type="button" data-action="back-business-line-manager" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="delete-business-line-warning"><span data-icon="alert"></span><div><b>确认删除「${escapeHtml(line.name)}」？</b><p>${isEmpty ? "这条业务线还没有运营数据，删除后不会保留空记录。" : "业务线会从日常运营入口中移除，关联知识库停止参与新内容生成；历史文章、发布记录和引用证据继续保留。"}</p></div></div><div class="delete-impact-grid"><div><span>关键词</span><b>${impact.keywords}</b></div><div><span>客户问题</span><b>${impact.questions}</b></div><div><span>选题</span><b>${impact.topics}</b></div><div><span>内容计划</span><b>${impact.plans}</b></div><div><span>文章</span><b>${impact.articles}</b></div><div><span>专属知识库</span><b>${impact.knowledgeBases}</b></div></div>${impact.publishedArticles || impact.publishTasks ? '<div class="privacy-note warning"><span data-icon="lock"></span><span>其中包含 ' + impact.publishedArticles + ' 篇已发布文章和 ' + impact.publishTasks + ' 个发布任务，这些记录不会被物理删除。</span></div>' : ""}</div>
    <div class="modal-foot"><span>${activeCount <= 1 ? "系统必须至少保留一条业务线" : isEmpty ? "此操作不可恢复" : "删除后可在业务线管理中恢复"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-business-line-manager">取消</button><button class="danger-button" type="button" data-action="confirm-delete-business-line" data-line-id="${line.id}" ${activeCount <= 1 ? "disabled" : ""}>确认删除</button></div></div>
  `);
}

function renderTopicPlanPickerModal() {
  const topic = state.topics.find((item) => item.id === ui.modal.topicId);
  if (!topic) return "";
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId);
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === lineId && plan.status !== "archived");
  const planStates = plans.map((plan) => {
    const status = plan.status || (contentPlanArticles(plan).length ? "produced" : "planned");
    const duplicate = contentPlanTopicIds(plan).includes(topic.id);
    const available = ["draft", "planned"].includes(status) && !duplicate;
    return { plan, status, duplicate, available };
  });
  const firstAvailableId = planStates.find((item) => item.available)?.plan.id || null;
  const selectedPlanId = planStates.some((item) => item.available && item.plan.id === ui.modal.planId) ? ui.modal.planId : firstAvailableId;
  const rows = planStates.map(({ plan, status, duplicate, available }) => {
    const topicCount = contentPlanTopicIds(plan).length;
    const unavailableReason = duplicate ? "该选题已在计划中" : status === "produced" ? "已生成内容，不再追加选题" : status === "completed" ? "计划已完成" : "当前状态不可追加";
    return `<label class="topic-plan-picker-row ${available ? "" : "disabled"}"><input class="checkbox" type="radio" name="topic-plan-id" value="${escapeHtml(plan.id)}" ${plan.id === selectedPlanId ? "checked" : ""} ${available ? "" : "disabled"} /><span class="topic-plan-picker-icon" data-icon="clock"></span><span class="topic-plan-picker-copy"><b>${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.id)} · ${topicCount} 个选题 · ${escapeHtml(plan.contentType || "未设置形式")}</small><em>完成日期 ${escapeHtml(plan.scheduledFor || "未安排")} · ${escapeHtml(plan.owner || "未分配负责人")}</em></span><span class="topic-plan-picker-state">${planStatusBadge(status)}<small>${available ? "可以加入" : escapeHtml(unavailableReason)}</small></span></label>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">加入已有内容计划</h2><p>${escapeHtml(line?.name || "业务线")} · 为当前选题选择一个计划</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body topic-plan-picker-body">
      <section class="topic-plan-picker-topic"><span data-icon="file"></span><span><small>当前选题</small><b>${escapeHtml(topic.title)}</b><em>${escapeHtml(topic.intent || "未设置用户意图")}</em></span></section>
      <div class="topic-plan-picker-heading"><div><h3>选择内容计划</h3><p>只显示当前产品 / 业务线的计划；已生成内容或已完成的计划不可追加。</p></div><span class="small-tag blue">${planStates.filter((item) => item.available).length} 个可选</span></div>
      <div class="topic-plan-picker-list">${rows || '<div class="empty-state topic-plan-picker-empty"><div><span data-icon="clock"></span><h3>还没有内容计划</h3><p>可以先为这个选题新建一个内容计划。</p></div></div>'}</div>
      <div class="privacy-note"><span data-icon="lock"></span><span>加入后，这个选题会使用该计划已经确定的写作智能体、企业知识范围和预计适配平台提示；不会锁定实际发布平台。</span></div>
    </div>
    <div class="modal-foot"><span>加入后可在「内容计划」继续创建文章任务</span><div class="modal-foot-right"><button class="ghost-button" type="button" data-action="create-plan-from-topic-picker" data-topic-id="${escapeHtml(topic.id)}"><span data-icon="plus"></span>新建内容计划</button><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-topic-plan-picker" ${firstAvailableId ? "" : "disabled"}><span data-icon="check"></span>确认加入</button></div></div>
  `, { wide: true });
}

function renderContentPlanEditModal() {
  const plan = state.contentPlans.find((item) => item.id === ui.modal.planId);
  if (!plan) return "";
  const typeOptions = ["深度文章", "问答文章", "案例解读", "系列文章"].map((type) => `<option value="${escapeHtml(type)}" ${plan.contentType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">编辑内容计划</h2><p>${escapeHtml(plan.name)}</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field-row"><div class="field"><label for="plan-edit-date">计划日期</label><input class="input" id="plan-edit-date" type="date" value="${escapeHtml((plan.scheduledFor || "").slice(0, 10))}" /></div><div class="field"><label for="plan-edit-owner">负责人</label><input class="input" id="plan-edit-owner" value="${escapeHtml(plan.owner || "")}" placeholder="填写负责人" /></div></div>
      <div class="field mt-md"><label for="plan-edit-type">内容形式</label><select class="select" id="plan-edit-type">${typeOptions}</select></div>
      <div class="privacy-note"><span data-icon="info"></span><span>选题、写作智能体和知识范围在创建时已冻结，如需调整请新建计划。</span></div>
    </div>
    <div class="modal-foot"><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-plan-edit">保存修改</button></div></div>
  `);
}

function submitPlanEdit() {
  const plan = state.contentPlans.find((item) => item.id === ui.modal.planId);
  if (!plan) return;
  plan.scheduledFor = String(document.getElementById("plan-edit-date")?.value || plan.scheduledFor || "");
  plan.owner = String(document.getElementById("plan-edit-owner")?.value || "").trim() || plan.owner;
  plan.contentType = String(document.getElementById("plan-edit-type")?.value || plan.contentType || "深度文章");
  plan.updatedAt = Date.now();
  saveState();
  closeModal();
  render();
  showToast("内容计划已更新", "日期、负责人或内容形式已同步。", "success");
}

function renderContentPlanModal() {
  const line = activeBusinessLine();
  const selectedTopics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  const topicList = selectedTopics.map((topic) => '<div class="plan-topic-item"><span data-icon="file"></span><span><b>' + escapeHtml(topic.title) + '</b><small>' + escapeHtml(topic.intent) + " · " + topic.recommendation + ' 优先级</small></span></div>').join("");
  const inheritedIds = inheritedKnowledgeBaseIds(line);
  const eligibleBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived" && (base.scope === "enterprise" || !base.businessLineId || base.businessLineId === line?.id));
  const knowledgeList = eligibleBases.map((base) => {
    const inherited = inheritedIds.includes(base.id);
    const origin = base.scope === "enterprise" ? "企业公共" : inherited ? "业务线默认" : "可增补";
    return `<label class="knowledge-check-row plan-knowledge-row"><input class="checkbox" type="checkbox" data-plan-knowledge value="${base.id}" ${inherited ? "checked" : ""} /><span class="knowledge-check-icon" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(base.name)}</b><small>${knowledgeKindLabel(base.kind)} · ${approvedKnowledgeItems(base.id).length} 条可用资料</small></span><em>${origin}</em></label>`;
  }).join("");
  const defaultAgent = defaultAgentForLine(line, "深度文章");
  const availableAgents = activeWritingAgents(line?.id);
  const agentOptions = availableAgents.map((agent) => `<option value="${agent.id}" ${agent.id === defaultAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}${agent.id === line?.defaultWritingAgentId ? "（业务线默认）" : ""}</option>`).join("");
  const platformHintChoices = Object.entries(PLATFORM_META).map(([id, meta]) => `<label class="plan-platform-hint-option"><input class="checkbox" type="checkbox" data-plan-style-platform value="${id}" />${platformLogo(id).replace("<span ", '<span aria-hidden="true" ')}<span><b>${escapeHtml(meta.name)}</b><small>${escapeHtml(PLATFORM_STYLE_HINTS[id])}</small></span></label>`).join("");
  const today = new Date();
  const defaultDueDate = new Date(today.getTime());
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);
  const todayValue = localDateInputValue(today);
  const defaultDueDateValue = localDateInputValue(defaultDueDate);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">创建内容计划</h2><p>${escapeHtml(line?.name || "业务线")} · 已选择 ${selectedTopics.length} 个选题</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="content-plan-name">计划名称 *</label><input class="input ${ui.planError ? "input-error" : ""}" id="content-plan-name" value="${escapeHtml(line?.name || "业务线")} · ${defaultDueDate.getMonth() + 1} 月内容计划" />${ui.planError ? '<small class="error-text">' + escapeHtml(ui.planError) + "</small>" : ""}</div>
      <div class="field-row mt-md"><div class="field"><label for="content-plan-date">计划完成日期 *</label><input class="input" id="content-plan-date" type="date" min="${todayValue}" value="${defaultDueDateValue}" /></div><div class="field"><label for="content-plan-owner">负责人</label><select class="select" id="content-plan-owner">${contentPlanOwnerOptions()}</select></div></div>
      <div class="field mt-md"><label for="content-plan-type">内容形式</label><select class="select" id="content-plan-type"><option>深度文章</option><option>系列文章</option><option>问答文章</option><option>案例解读</option></select></div>
      <div class="plan-agent-panel"><div class="section-title"><div><h3>写作智能体 *</h3><p>决定文章角色、结构、语气与知识使用规则；保存计划时冻结当前版本</p></div><span class="small-tag blue">写法快照</span></div><select class="select" id="content-plan-agent" ${agentOptions ? "" : "disabled"}>${agentOptions || '<option value="">当前业务线没有可用智能体</option>'}</select>${defaultAgent ? `<div class="plan-agent-summary" id="plan-agent-summary"><span class="writing-agent-avatar ${escapeHtml(defaultAgent.color || "blue")}">${escapeHtml(defaultAgent.avatar || defaultAgent.name.slice(0, 1))}</span><span><b>${escapeHtml(defaultAgent.name)} · v${escapeHtml(defaultAgent.version)}</b><small>${escapeHtml(defaultAgent.style)} · ${defaultAgent.strictKnowledge ? "严格知识模式" : "普通知识模式"}</small></span></div>` : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>请先到内容生产创建或恢复一个可用写作智能体。</span></div>'}</div>
      <details class="plan-platform-hints"><summary><span><b>预计适配平台（可选）</b><small>仅向 AI 提示写作风格，不锁定发布</small></span><span class="small-tag">不锁定发布</span></summary><div class="plan-platform-hint-body"><p>可多选，也可以不选。平台和账号仍然只在文章审核通过后到「发布运营」中确定。</p><div class="plan-platform-hint-grid" role="group" aria-label="预计适配平台（可选）">${platformHintChoices}</div></div></details>
      <div class="privacy-note"><span data-icon="send"></span><span>发布平台与账号将在文章审核通过后，到「发布运营」中选择；内容计划不预先锁定分发渠道。</span></div>
      <div class="plan-knowledge-panel"><div class="section-title"><div><h3>本计划使用的企业知识</h3><p>已继承 ${inheritedIds.length} 个知识库，可为这次计划增补或排除；不会反向修改业务线默认包</p></div><span class="small-tag teal">范围快照</span></div><div class="plan-knowledge-list">${knowledgeList || '<div class="empty-inline">当前业务线还没有可用知识库</div>'}</div></div>
      <div class="plan-topic-list">${topicList}</div>
    </div>
    <div class="modal-foot"><span>保存时同时冻结智能体版本与本次知识范围</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="submit-content-plan" ${agentOptions ? "" : "disabled"}><span data-icon="check"></span>保存内容计划</button></div></div>
  `, { wide: true });
}

function renderWritingAgentModal() {
  const editingAgent = writingAgentById(ui.modal.agentId);
  const cloneSource = writingAgentById(ui.modal.cloneFromId);
  const source = editingAgent || cloneSource;
  const isReadOnly = Boolean(editingAgent?.builtIn);
  const isCopy = Boolean(cloneSource && !editingAgent);
  const empty = {
    name: "", description: "", avatar: "智", role: "企业内容编辑", audience: "企业客户", tone: "专业、清晰", style: "结论清晰 · 证据优先", template: "deep", structure: ["结论先行", "分点论证", "行动建议"], required: "关键判断需要企业知识支持。", banned: "不得虚构企业事实、案例或效果承诺。", cta: "给出克制的下一步建议。", systemPrompt: "请基于本次内容计划冻结的企业知识完成写作，所有企业事实必须可追溯。", strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", preferredKnowledgeBaseIds: [], businessLineIds: [], contentTypes: ["深度文章"], modelMode: "inherit", creativity: 0.35, minWords: 1000, maxWords: 1800
  };
  const agent = { ...empty, ...(source || {}) };
  let name = isCopy ? agent.name + " 副本" : agent.name;
  if (isCopy) {
    let copyNo = 2;
    while ((state.writingAgents || []).some((item) => item.name.toLowerCase() === name.toLowerCase())) name = agent.name + " 副本 " + copyNo++;
  }
  const lineChecks = state.businessLines.filter((line) => line.status === "active").map((line) => `<label><input class="checkbox" type="checkbox" data-agent-line value="${line.id}" ${(agent.businessLineIds || []).includes(line.id) ? "checked" : ""} />${escapeHtml(line.name)}</label>`).join("");
  const contentTypeChecks = ["深度文章", "系列文章", "问答文章", "案例解读"].map((type) => `<label><input class="checkbox" type="checkbox" data-agent-content-type value="${type}" ${(agent.contentTypes || []).includes(type) ? "checked" : ""} />${type}</label>`).join("");
  const knowledgeChecks = (state.knowledgeBases || []).filter((base) => base.status !== "archived").map((base) => `<label class="agent-knowledge-option"><input class="checkbox" type="checkbox" data-agent-knowledge value="${base.id}" ${(agent.preferredKnowledgeBaseIds || []).includes(base.id) ? "checked" : ""} /><span><b>${escapeHtml(base.name)}</b><small>${escapeHtml(knowledgeScopeLabel(base))} · 仅作计划范围内的优先级建议</small></span></label>`).join("");
  const title = isReadOnly ? "查看内置智能体" : editingAgent ? "编辑写作智能体" : isCopy ? "复制写作智能体" : "创建写作智能体";
  const subtitle = isReadOnly ? "系统模板不可直接修改，可以复制成企业自建版本" : editingAgent ? "保存配置变更后版本自动递增，历史快照不受影响" : "把常用写作角色、结构和知识规则保存为可复用能力";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body writing-agent-form">
      <fieldset ${isReadOnly ? "disabled" : ""}>
        <section class="agent-form-section"><div class="section-title"><div><h3>1. 基本信息</h3><p>说明这个智能体适合谁、适合什么内容</p></div>${editingAgent ? '<span class="small-tag blue">当前 v' + escapeHtml(editingAgent.version) + '</span>' : '<span class="small-tag teal">新建 v1</span>'}</div><div class="field-row"><div class="field"><label for="writing-agent-name">智能体名称 *</label><input class="input" id="writing-agent-name" maxlength="40" value="${escapeHtml(name)}" placeholder="例如：技术白皮书编辑" /></div><div class="field"><label for="writing-agent-avatar">图标文字</label><input class="input" id="writing-agent-avatar" maxlength="1" value="${escapeHtml(agent.avatar || name.slice(0, 1) || "智")}" /></div></div><div class="field"><label for="writing-agent-description">一句话用途 *</label><input class="input" id="writing-agent-description" maxlength="100" value="${escapeHtml(agent.description)}" placeholder="说明它最擅长写什么" /></div><div class="field-row"><div class="field"><label for="writing-agent-role">扮演角色</label><input class="input" id="writing-agent-role" value="${escapeHtml(agent.role)}" /></div><div class="field"><label for="writing-agent-audience">目标读者</label><input class="input" id="writing-agent-audience" value="${escapeHtml(agent.audience)}" /></div></div><div class="field"><label>适用业务线 <small>不勾选代表全部业务线</small></label><div class="agent-check-grid">${lineChecks}</div></div><div class="field"><label>适用内容形式 *</label><div class="agent-check-grid">${contentTypeChecks}</div></div></section>
        <section class="agent-form-section"><div class="section-title"><div><h3>2. 写作规则</h3><p>结构化配置给运营人员使用，高级提示词保留完整控制</p></div><span class="small-tag blue">决定怎么写</span></div><div class="field-row"><div class="field"><label for="writing-agent-tone">语气</label><input class="input" id="writing-agent-tone" value="${escapeHtml(agent.tone)}" /></div><div class="field"><label for="writing-agent-style">写作风格</label><input class="input" id="writing-agent-style" value="${escapeHtml(agent.style)}" /></div></div><div class="field-row"><div class="field"><label for="writing-agent-template">文章结构模板</label><select class="select" id="writing-agent-template"><option value="deep" ${agent.template === "deep" ? "selected" : ""}>深度解读</option><option value="qa" ${agent.template === "qa" ? "selected" : ""}>标准问答</option><option value="case" ${agent.template === "case" ? "selected" : ""}>案例拆解</option><option value="guide" ${agent.template === "guide" ? "selected" : ""}>采购指南</option><option value="story" ${agent.template === "story" ? "selected" : ""}>品牌叙事</option></select></div><div class="field"><label for="writing-agent-structure">推荐结构</label><input class="input" id="writing-agent-structure" value="${escapeHtml((agent.structure || []).join("、"))}" /></div></div><div class="field"><label for="writing-agent-required">必须包含</label><textarea class="textarea" id="writing-agent-required" rows="2">${escapeHtml(agent.required)}</textarea></div><div class="field"><label for="writing-agent-banned">禁止表达</label><textarea class="textarea" id="writing-agent-banned" rows="2">${escapeHtml(agent.banned)}</textarea></div><div class="field"><label for="writing-agent-cta">结尾行动引导</label><input class="input" id="writing-agent-cta" value="${escapeHtml(agent.cta)}" /></div><details class="agent-prompt-details" open><summary>高级提示词 *</summary><p>提示词不能绕过知识证据、内容风控与人工审核门禁。</p><textarea class="textarea" id="writing-agent-prompt" rows="7">${escapeHtml(agent.systemPrompt)}</textarea></details></section>
        <section class="agent-form-section"><div class="section-title"><div><h3>3. 知识与生成</h3><p>智能体控制写法，不会替换内容计划冻结的知识范围</p></div><span class="small-tag teal">权限不越界</span></div><div class="agent-policy-grid"><label class="strict-mode-row"><input class="checkbox" type="checkbox" id="writing-agent-strict" ${agent.strictKnowledge ? "checked" : ""} /><span><b>严格知识模式</b><small>企业事实必须有已审核证据</small></span></label><label class="strict-mode-row"><input class="checkbox" type="checkbox" id="writing-agent-citations" ${agent.citationsRequired ? "checked" : ""} /><span><b>生成逐条引用</b><small>文章保留 K1–Kn 证据定位</small></span></label></div><div class="field-row"><div class="field"><label for="writing-agent-missing">缺少证据时</label><select class="select" id="writing-agent-missing"><option value="omit" ${agent.missingEvidenceAction === "omit" ? "selected" : ""}>省略并标记知识缺口</option><option value="block" ${agent.missingEvidenceAction === "block" ? "selected" : ""}>阻止生成</option></select></div><div class="field"><label for="writing-agent-model">模型</label><select class="select" id="writing-agent-model"><option value="inherit">继承系统默认模型</option></select></div></div><div class="field-row three"><div class="field"><label for="writing-agent-min-words">最少字数</label><input class="input" type="number" id="writing-agent-min-words" min="300" max="10000" value="${escapeHtml(agent.minWords)}" /></div><div class="field"><label for="writing-agent-max-words">最多字数</label><input class="input" type="number" id="writing-agent-max-words" min="500" max="15000" value="${escapeHtml(agent.maxWords)}" /></div><div class="field"><label for="writing-agent-creativity">创造性 0–1</label><input class="input" type="number" id="writing-agent-creativity" min="0" max="1" step="0.05" value="${escapeHtml(agent.creativity)}" /></div></div><div class="field"><label>优先知识库 <small>只调整计划已经选中知识库的召回顺序</small></label><div class="agent-knowledge-list">${knowledgeChecks || '<span class="empty-inline">还没有知识库</span>'}</div></div></section>
      </fieldset>
      <div class="privacy-note"><span data-icon="history"></span><span>${isReadOnly ? "系统模板保持只读；复制后可以自定义。" : "保存修改只影响之后选择新版本的计划；历史计划和文章继续使用生成时的完整快照。"}</span></div>
    </div>
    <div class="modal-foot"><span>${isReadOnly ? "系统内置 · v" + escapeHtml(agent.version) : editingAgent ? "本次保存将检查配置变化" : "保存后可在内容计划中选择"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button>${isReadOnly ? '<button class="primary-button" type="button" data-action="copy-writing-agent" data-agent-id="' + agent.id + '"><span data-icon="plus"></span>复制后编辑</button>' : '<button class="primary-button" type="button" data-action="save-writing-agent" data-agent-id="' + (editingAgent?.id || "") + '"><span data-icon="check"></span>保存智能体</button>'}</div></div>
  `, { wide: true });
}

function renderRegenerateArticleModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  const agent = writingAgentById(ui.modal.agentId);
  if (!article || !agent) return "";
  const current = article.generationSnapshot?.writingAgent;
  const unsaved = Boolean(ui.modal.unsavedChanges);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">使用新智能体重新生成</h2><p>${escapeHtml(article.title)} · 将创建文章新版本</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${unsaved ? '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>检测到未保存修改</b><p>继续重新生成将以当前已保存版本为基础，编辑器中的未保存内容不会带入新版本。</p></div></div>' : ""}
      <div class="agent-regenerate-compare"><div><span>当前版本</span><b>${escapeHtml(article.version)} · ${escapeHtml(current?.nameSnapshot || "历史默认配置")}${current ? " v" + escapeHtml(current.version) : ""}</b><small>原正文、引用、审核状态和智能体快照将进入版本历史</small></div><span data-icon="arrow"></span><div><span>新版本</span><b>v${(Number(String(article.version).replace(/\D/g, "")) || 1) + 1} · ${escapeHtml(agent.name)} v${escapeHtml(agent.version)}</b><small>${escapeHtml(agent.style)} · ${agent.strictKnowledge ? "严格知识" : "普通知识"}</small></div></div>
      <div class="delete-business-line-warning"><span data-icon="refresh"></span><div><b>重新生成会发生什么？</b><p>新版本沿用当前冻结的企业知识版本与逐条引用，正文按新智能体结构重写；审核回到待审核，风控回到未检测。已发布任务仍绑定旧版本。</p></div></div>
      <div class="privacy-note"><span data-icon="lock"></span><span>智能体只能改变写法，不能增加计划未授权的知识库，也不能绕过事实审核、内容风控和人工审核。</span></div>
    </div>
    <div class="modal-foot"><span>此操作不会覆盖 ${escapeHtml(article.version)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-article" data-article-id="${article.id}">取消</button><button class="primary-button" type="button" data-action="confirm-regenerate-article" data-article-id="${article.id}" data-agent-id="${agent.id}"><span data-icon="sparkle"></span>创建新版本</button></div></div>
  `);
}

function renderArticleVersionModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  const revision = article?.versions?.[Number(ui.modal.versionIndex)];
  if (!article || !revision) return "";
  const agent = revision.generationSnapshot?.writingAgent;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">文章历史版本 ${escapeHtml(revision.version)}</h2><p>${escapeHtml(article.id)} · 只读快照 · ${new Date(revision.archivedAt || revision.updatedAt).toLocaleString("zh-CN", { hour12: false })}</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回"><span data-icon="x"></span></button></div>
    <div class="modal-body article-version-preview"><div class="generation-agent-section"><div class="generation-agent-main"><span class="writing-agent-avatar ${escapeHtml(writingAgentById(agent?.agentId)?.color || "blue")}">${escapeHtml(writingAgentById(agent?.agentId)?.avatar || agent?.nameSnapshot?.slice(0, 1) || "史")}</span><div><span>生成时冻结的写作方式</span><h3>${escapeHtml(agent?.nameSnapshot || "历史默认配置")} ${agent ? "<em>v" + escapeHtml(agent.version) + "</em>" : ""}</h3><p>${escapeHtml(agent?.style || "该版本未记录智能体配置")}</p></div><span class="status-badge status-draft">历史只读</span></div></div><h2 class="article-version-title">${escapeHtml(revision.title)}</h2><article class="article-content read-only">${revision.content}</article></div>
    <div class="modal-foot"><span>${(revision.citations || []).length} 条引用 · ${escapeHtml(revision.reviewStatus === "approved" ? "审核通过" : "待审核")}</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="back-article" data-article-id="${article.id}">返回当前版本</button></div></div>
  `, { wide: true });
}

function articleEditorHasUnsavedChanges(article) {
  const titleInput = document.getElementById("article-title-editor");
  const contentInput = document.getElementById("article-content-editor");
  const visibilityInput = document.getElementById("article-show-public-citations");
  if (!titleInput || !contentInput) return false;
  return titleInput.value.trim() !== article.title || contentInput.innerHTML.trim() !== articleContentForEditor(article, articleCitations(article)).trim() || Boolean(visibilityInput?.checked) !== articlePublicCitationMarkersVisible(article);
}

async function regenerateArticleWithAgent(articleId, agentId) {
  const article = state.articles.find((item) => item.id === articleId);
  const agent = writingAgentById(agentId);
  const topic = article?.topicSnapshot || article?.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article?.topicId);
  const plan = state.contentPlans.find((item) => item.id === article?.planId);
  if (!article || !agent || !topic) return showToast("无法重新生成", "文章、选题或写作智能体不存在。", "error");
  if (!writingAgentSupports(agent, article.businessLineId, plan?.contentType || null)) return showToast("写作智能体不可用", "请选择已启用且适用于当前业务线的智能体。", "error");
  const oldCitations = articleCitations(article);
  if (!oldCitations.length || !article.knowledgeSnapshot) return showToast("缺少冻结知识证据", "历史文章不能直接改写，请从内容计划重新生成。", "error");
  if (agent.missingEvidenceAction === "block" && (article.knowledgeStatus?.gapCount || 0) > 0) return showToast("知识缺口阻止重写", "该智能体要求证据完整，请先补齐并审核文章记录的知识缺口。", "error");
  const providerId = await ensureSelectedTextProviderId();
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const line = state.businessLines.find((item) => item.id === article.businessLineId && item.status === "active") || activeBusinessLine();
  if (!line) return showToast("业务线不可用", "请选择一个有效的产品 / 业务线后重试。", "error");
  const nextNumber = (Number(String(article.version).replace(/\D/g, "")) || 1) + 1;
  const nextVersion = "v" + nextNumber;
  const now = new Date().toISOString();
  const agentSnapshot = snapshotWritingAgent(agent, { selectedAt: now, selectionSource: "article_override", lockedAt: now });
  const expectedPlatformGuidance = planExpectedPlatformGuidance(plan);
  const geoBrief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  if (!topic.geoBrief) topic.geoBrief = cloneData(geoBrief);
  const contentType = plan?.contentType || article.category || "深度文章";
  let remoteGeneration;
  try {
    remoteGeneration = await requestAiArticle({
      providerId,
      line,
      contentType,
      topic: { ...topic, geoBrief },
      agentSnapshot,
      evidence: oldCitations.map((citation) => ({
        item: { title: citation.claim || citation.title || "已审核企业事实" },
        quote: citation.quote || citation.excerpt || "",
        base: { name: citation.source || citation.sourceName || "企业知识库" },
        version: { id: citation.versionId || citation.knowledgeVersionId || "", content: citation.quote || "" }
      })),
      expectedPlatforms: expectedPlatformGuidance.map((item) => item.name)
    });
  } catch (error) {
    return showToast("文章重写失败", error.message || "模型未返回符合 GEO 文章契约的结果，旧版本保持不变。", "error");
  }
  if (!remoteGeneration || typeof (remoteGeneration.html || remoteGeneration.content) !== "string") {
    return showToast("文章重写失败", "模型没有返回可编辑文章，旧版本保持不变。", "error");
  }
  archiveArticleRevision(article, "agent_regeneration", "智能体重写前");
  const newCitations = oldCitations.map((citation, index) => ({ ...cloneData(citation), id: uid("CIT") + "-K" + (index + 1), articleVersion: nextVersion, status: "needs_review" }));
  state.knowledgeCitations.push(...newCitations);
  const citationIds = newCitations.map((citation) => citation.id);
  const outputContract = buildGeoOutputContract({ ...topic, geoBrief }, newCitations, agentSnapshot, { contentType });
  article.version = nextVersion;
  article.status = "draft";
  article.reviewStatus = "pending";
  article.reviewStage = "draft";
  article.reviewSubmittedAt = null;
  article.reviewSubmittedBy = null;
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.riskStatus = "unscanned";
  article.author = "AI · " + agent.name;
  article.content = String(remoteGeneration.html || remoteGeneration.content || "");
  article.title = String(remoteGeneration.title || article.title).slice(0, 240);
  article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
  article.geoQuality = evaluateGeoArticleQuality(article.content, { ...topic, geoBrief }, newCitations);
  article.citations = citationIds;
  article.sources = citationIds.length;
  applyRemoteArticleResult(article, remoteGeneration);
  article.knowledgeSnapshot = { ...cloneData(article.knowledgeSnapshot), id: uid("KS"), capturedAt: now, frozenAt: null, citationIds };
  article.generationSnapshot = {
    ...cloneData(article.generationSnapshot),
    id: uid("GS"),
    generatedAt: now,
    generatedBy: "AI · " + agent.name,
    topicSnapshot: cloneData(topic),
    topicBrief: cloneData(geoBrief),
    model: { name: remoteGeneration.model || agentSnapshot.resolvedModel?.name || state.settings.model, promptVersion: agent.name + " v" + agent.version },
    generationMode: "model",
    generationRunId: remoteGeneration.generationRunId || remoteGeneration.runId || null,
    writingAgent: agentSnapshot,
    outputContract,
    geoQuality: article.geoQuality,
    styleGuidance: { expectedPlatforms: expectedPlatformGuidance.map((item) => item.name), platformGuidance: expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false },
    citationIds,
    promptTemplate: "由服务端 AI 生成契约驱动，运行记录已保存。",
    fingerprint: "demo-agent-" + article.id.toLowerCase() + "-" + nextVersion
  };
  article.topicSnapshot = cloneData(topic);
  article.writingAgentId = agent.id;
  article.writingAgentVersion = agent.version;
  article.writingAgentNameSnapshot = agent.name;
  article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "needs_review", evidenceCount: citationIds.length, supportedClaims: citationIds.length, message: "正文已由新智能体重写，沿用原冻结知识版本，需重新完成事实与风险审核。" };
  article.updatedAt = Date.now();
  saveState();
  closeModal();
  render();
  openArticle(article.id);
  showToast("已创建文章 " + nextVersion, "旧版本已完整保留；当前稿使用「" + agent.name + "」v" + agent.version + "，需要重新审核后发布。");
}

function renderVersionModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">关于当前版本</h2><p>Tongzhuo GEO Platform 1.0.0-alpha.1</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="privacy-note"><span data-icon="shield"></span><span>生产底座已经启用正式数据库、服务端工作区、登录会话、四级角色权限、CSRF、审计日志和密钥加密。向量 RAG、真实官网 CMS 与运营诊断仍按后续产品化阶段接入。</span></div>
      <div class="side-list mt-lg"><div><span>业务数据</span><b>SQLite WAL + 完整修订</b></div><div><span>账号权限</span><b>服务端 RBAC + scrypt</b></div><div><span>模型密钥</span><b>AES-256-GCM</b></div><div><span>发布设备凭据</span><b>SHA-256 摘要认证</b></div></div>
    </div>
    <div class="modal-foot"><span>部署与恢复说明见 docs/PRIVATE-DEPLOYMENT.md</span><div class="modal-foot-right"><button class="primary-button" data-action="close-modal">我知道了</button></div></div>
  `);
}

function renderTrackedWorkModal() {
  const linkedArticle = state.articles.find((article) => article.id === ui.modal.articleId);
  if (!linkedArticle) return "";
  const articleOptions = state.articles.map((article) => `<option value="${escapeHtml(article.id)}" ${linkedArticle.id === article.id ? "selected" : ""}>${escapeHtml(article.title)}</option>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">添加其他平台 URL</h2><p>为这篇内容资产补充一个可访问的外部发布地址，保存后立即进入自动巡检。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field"><label for="tracked-work-article">关联文章 *</label><select class="select" id="tracked-work-article">${articleOptions}</select><small>引用证据只会按规范化 URL 精确归属到这篇文章。</small></div>
      <div class="field-row mt-lg"><div class="field"><label for="tracked-work-site">发布平台 *</label><input class="input" id="tracked-work-site" value="" placeholder="例如：知乎专栏、行业媒体" /></div><div class="field"><label for="tracked-work-type">站点类型</label><select class="select" id="tracked-work-type">${["公众号", "内容平台", "行业媒体", "其他"].map((item) => `<option>${item}</option>`).join("")}</select></div></div>
      <div class="field"><label for="tracked-work-url">作品 URL *</label><input class="input" id="tracked-work-url" value="" placeholder="https://" /></div>
    </div>
    <div class="modal-foot"><span>保存后由服务端巡检可访问性、跳转和内容变化</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-tracked-work"><span data-icon="check"></span>添加 URL</button></div></div>
  `, { wide: true });
}
function renderModelEditorModal() {
  const kind = ["image", "embedding"].includes(ui.modal.modelKind) ? ui.modal.modelKind : "text";
  const isText = kind === "text";
  const label = kind === "embedding" ? "向量" : isText ? "文本" : "图片";
  const current = kind === "embedding" ? "embedding" : isText ? state.settings.model : state.settings.imageModel;
  const providerKey = kind === "embedding" ? "embeddingProviderId" : isText ? "modelProviderId" : "imageProviderId";
  const selectedProviderId = state.settings[providerKey] || "";
  const providers = (aiProviderSnapshot.providers || []).filter((provider) => provider.status !== "disabled" && provider.kind === kind);
  const providerOptions = [`<option value="">不绑定 API 供应商（仅保存模型名称）</option>`, ...providers.map((provider) => `<option value="${escapeHtml(provider.id)}" ${selectedProviderId === provider.id ? "selected" : ""}>${escapeHtml(provider.name)} · ${escapeHtml(provider.model || "未填写模型")}</option>`)].join("");
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">更换默认${label}模型</h2><p>选择已配置的 API 供应商；已有文章仍使用生成时保存的模型快照。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body model-editor-body"><div class="field"><label for="model-provider">API 供应商</label><select class="select" id="model-provider">${providerOptions}</select><small>${selectedProvider ? `${escapeHtml(selectedProvider.apiKeyMasked || "未配置 API Key")} · ${escapeHtml(aiProviderProtocolLabel(selectedProvider.protocol))}` : "尚未绑定供应商时不会发起真实 API 请求。"}</small></div><div class="field mt-lg"><label for="model-custom-name">模型 ID / 名称 *</label><input class="input" id="model-custom-name" value="${escapeHtml(current)}" placeholder="例如：deepseek-chat、gpt-4o-mini、qwen-plus" /><small>选择供应商后，留空会使用供应商默认模型。</small></div><button class="secondary-button" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>没有供应商？添加 API</button><div class="privacy-note mt-sm"><span data-icon="lock"></span><span>API Key 只保存在服务端并以掩码显示，浏览器不会保存原始密钥。</span></div></div>
    <div class="modal-foot"><span>当前：${escapeHtml(current)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-model" data-model-kind="${kind}"><span data-icon="check"></span>保存模型</button></div></div>
  `);
}

function renderAiProviderModal() {
  const existing = ui.modal.providerId ? (aiProviderSnapshot.providers || []).find((provider) => provider.id === ui.modal.providerId) : null;
  const provider = existing || { name: "", baseUrl: "", model: "", protocol: "openai_compatible", kind: "text", status: "enabled" };
  const protocolOptions = [["openai_compatible", "OpenAI 兼容接口"], ["deepseek", "DeepSeek"], ["qwen", "通义千问"], ["kimi", "Kimi / Moonshot"], ["zhipu", "智谱 GLM"], ["custom", "自定义接口"]].map(([value, label]) => `<option value="${value}" ${provider.protocol === value ? "selected" : ""}>${label}</option>`).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${existing ? "编辑 API 供应商" : "添加 API 供应商"}</h2><p>配置一次后，文本、图片或向量模型都可以在对应的“更换模型”入口中选择。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body ai-provider-form"><div class="ai-provider-form-note"><span data-icon="shield"></span><div><b>密钥安全</b><small>原始 API Key 只提交到客户服务器，列表和页面永远只显示掩码。</small></div></div><div class="field-row"><div class="field"><label for="ai-provider-name">供应商名称 *</label><input class="input" id="ai-provider-name" value="${escapeHtml(provider.name)}" placeholder="例如：公司 DeepSeek" /></div><div class="field"><label for="ai-provider-protocol">接口类型</label><select class="select" id="ai-provider-protocol">${protocolOptions}</select></div></div><div class="field"><label for="ai-provider-base-url">API Base URL *</label><input class="input" id="ai-provider-base-url" value="${escapeHtml(provider.baseUrl)}" placeholder="例如：https://api.deepseek.com/v1" /><small>只填写服务端 API 地址，不要把模型路径重复拼接。</small></div><div class="field-row"><div class="field"><label for="ai-provider-key">API Key ${existing ? "（留空保持不变）" : "*"}</label><input class="input" id="ai-provider-key" type="password" value="" placeholder="${escapeHtml(existing?.apiKeyMasked || "sk-...")}" autocomplete="new-password" /></div><div class="field"><label for="ai-provider-model">默认模型 ID *</label><input class="input" id="ai-provider-model" value="${escapeHtml(provider.model || "")}" placeholder="例如：deepseek-chat" /></div></div><div class="field-row"><div class="field"><label for="ai-provider-kind">模型用途</label><select class="select" id="ai-provider-kind"><option value="text" ${provider.kind === "text" ? "selected" : ""}>文本模型</option><option value="image" ${provider.kind === "image" ? "selected" : ""}>图片模型</option><option value="embedding" ${provider.kind === "embedding" ? "selected" : ""}>向量模型</option></select></div><div class="field"><label for="ai-provider-status">供应商状态</label><select class="select" id="ai-provider-status"><option value="enabled" ${provider.status !== "disabled" ? "selected" : ""}>启用</option><option value="disabled" ${provider.status === "disabled" ? "selected" : ""}>停用</option></select></div></div><div class="privacy-note"><span data-icon="info"></span><span>测试连接目前只验证配置状态，不会向外部模型发送文章内容。正式接入生成服务时，调用仍由客户服务器完成。</span></div></div>
    <div class="modal-foot"><span>${existing ? `供应商 ID：${escapeHtml(existing.id)}` : "保存后可立即测试连接"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="ghost-button" type="button" data-action="test-ai-provider-draft"><span data-icon="check"></span>保存并测试</button><button class="primary-button" type="button" data-action="save-ai-provider" data-provider-id="${escapeHtml(existing?.id || "")}"><span data-icon="check"></span>保存供应商</button></div></div>
  `, { wide: true });
}

function renderMemberEditorModal() {
  const existing = ui.modal.memberId ? state.settings.members.find((member) => member.id === ui.modal.memberId) : null;
  const role = existing?.roleValue || ROLE_API_VALUES[existing?.role] || "operator";
  const status = existing?.status || "active";
  const adminCount = (state.settings.members || []).filter((member) => member.role === "管理员" && member.status !== "disabled").length;
  const canDelete = !existing || !(existing.role === "管理员" && adminCount <= 1);
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${existing ? "管理成员" : "创建成员账号"}</h2><p>${existing ? "角色、状态和密码修改会由服务端立即执行并记录审计。" : "创建后成员可以使用登录账号和初始密码进入当前企业后台。"}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body"><div class="field-row"><div class="field"><label for="member-name">姓名 *</label><input class="input" id="member-name" value="${escapeHtml(existing?.name || "")}" placeholder="请输入成员姓名" /></div><div class="field"><label for="member-email">邮箱</label><input class="input" id="member-email" type="email" value="${escapeHtml(existing?.email || "")}" placeholder="name@company.com" /></div></div><div class="field-row"><div class="field"><label for="member-username">登录账号 *</label><input class="input" id="member-username" value="${escapeHtml(existing?.username || "")}" placeholder="例如：zhangsan" ${existing ? "disabled" : ""} autocomplete="username" /></div><div class="field"><label for="member-password">${existing ? "重置密码（留空不修改）" : "初始密码 *"}</label><input class="input" id="member-password" type="password" minlength="10" maxlength="200" placeholder="至少 10 个字符" autocomplete="new-password" /></div></div><div class="field-row"><div class="field"><label for="member-role">角色</label><select class="select" id="member-role">${Object.entries(ROLE_UI_LABELS).map(([value, label]) => `<option value="${value}" ${role === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="member-status">状态</label><select class="select" id="member-status">${[["active", "已启用"], ["disabled", "已停用"]].map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div><div class="privacy-note mt-md"><span data-icon="lock"></span><span>初始密码只在本次提交中传送，不会写入浏览器存储；服务端使用 scrypt 保存密码摘要。</span></div></div>
    <div class="modal-foot"><span>${existing?.lastLoginAt ? "最近登录：" + formatDateTime(existing.lastLoginAt) : "尚未登录"}</span><div class="modal-foot-right">${existing ? `<button class="danger-button" type="button" data-action="delete-member" data-member-id="${escapeHtml(existing.id)}" ${canDelete ? "" : "disabled"}>删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-member" data-member-id="${escapeHtml(existing?.id || "")}"><span data-icon="check"></span>${existing ? "保存修改" : "创建账号"}</button></div></div>
  `);
}

function riskRuleEntries(type) {
  const record = state.knowledge?.[type] || {};
  if (Array.isArray(record.entries) && record.entries.length) return record.entries.map((entry) => String(entry).trim()).filter(Boolean);
  const content = record.content === undefined ? legacyKnowledgeDefaultContent(type) : record.content;
  return String(content || "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function riskTermsFromEntry(entry) {
  const quoted = [...String(entry).matchAll(/[“\"]([^”\"]+)[”\"]/g)].map((match) => match[1].trim()).filter(Boolean);
  if (quoted.length) return quoted;
  if (String(entry).length <= 30) return [String(entry).trim()];
  return String(entry).split(/[、，,；;]/).map((part) => part.replace(/^(禁止使用|禁止|不得|涉及|命中后|需要)/, "").trim()).filter((part) => part.length >= 2 && part.length <= 24);
}

function scanArticleRisk(article) {
  const plainText = `${article.title || ""}\n${studioPlainText(article.content || "")}`;
  const definitions = [
    { type: "banned", label: "企业禁用表述", level: "blocked", message: "命中企业明确禁用的对外表述，修改后才能提交审核。" },
    { type: "sensitive", label: "企业敏感规则", level: "warning", message: "涉及企业敏感信息或公开边界，需要人工核对。" },
    { type: "adLaw", label: "广告法规则", level: "warning", message: "可能属于绝对化或无法证明的效果表述，需要补充证据与适用边界。" }
  ];
  const hits = [];
  const seen = new Set();
  definitions.forEach((definition) => {
    riskRuleEntries(definition.type).forEach((entry, entryIndex) => {
      riskTermsFromEntry(entry).forEach((term) => {
        const normalized = term.trim();
        if (!normalized || seen.has(`${definition.type}:${normalized}`)) return;
        seen.add(`${definition.type}:${normalized}`);
        const index = plainText.indexOf(normalized);
        if (index < 0) return;
        hits.push({
          id: `${definition.type}-${entryIndex}-${hits.length + 1}`,
          type: definition.type,
          label: definition.label,
          level: definition.level,
          term: normalized,
          rule: entry,
          excerpt: plainText.slice(Math.max(0, index - 28), Math.min(plainText.length, index + normalized.length + 42)).replace(/\s+/g, " "),
          message: definition.message
        });
      });
    });
  });
  const status = hits.some((hit) => hit.level === "blocked") ? "blocked" : hits.length ? "warning" : "clean";
  return {
    status,
    articleVersion: article.version,
    scannedAt: new Date().toISOString(),
    ruleVersions: Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, Number(state.knowledge?.[type]?.version || 0)])),
    ruleCounts: Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, riskRuleEntries(type).length])),
    hits
  };
}

function renderArticleRiskTitlePreview(article, scan = null, scope = "article") {
  const targetId = scope === "studio" ? "studio-title-risk-preview" : "article-title-risk-preview";
  const title = String(article?.title || "");
  const hits = (Array.isArray(scan?.hits) ? scan.hits : scanArticleRisk(article).hits || []).filter((hit) => title.toLocaleLowerCase().includes(String(hit.term || "").toLocaleLowerCase()));
  if (!hits.length) return `<div id="${targetId}" class="article-title-risk-preview is-clean" aria-live="polite" hidden></div>`;
  const labels = [...new Set(hits.map((hit) => articleRiskHitLabel(hit)))].join("、");
  return `<section id="${targetId}" class="article-title-risk-preview" aria-live="polite"><div class="article-title-risk-head"><strong>标题中的问题文字</strong><span>${escapeHtml(labels)}</span></div><div class="article-title-risk-text">${highlightArticleRiskText(title, hits)}</div><small>标题中的命中内容已标识；修改后会重新检测当前版本。</small></section>`;
}

function articleRiskHitLabel(hit) {
  if (hit?.level === "blocked") return "违禁词 / 阻断";
  if (hit?.type === "sensitive") return "敏感词 / 需复核";
  return "广告法 / 需复核";
}

function renderArticleRiskInlineNotice(article, scope = "article", scan = null) {
  const targetId = scope === "studio" ? "studio-inline-risk" : "article-inline-risk";
  const currentScan = scan || scanArticleRisk(article);
  const hits = Array.isArray(currentScan?.hits) ? currentScan.hits : [];
  if (!hits.length) return "<section id=\"" + targetId + "\" class=\"article-inline-risk is-clean\" aria-live=\"polite\" hidden></section>";
  const blockedCount = hits.filter((hit) => hit.level === "blocked").length;
  const warningCount = hits.length - blockedCount;
  const summary = blockedCount ? "命中 " + blockedCount + " 个违禁词，当前版本不能提交审核。" : "发现 " + warningCount + " 个需复核风险词，请确认后再提交审核。";
  const chips = hits.map((hit) => "<button class=\"article-risk-hit " + (hit.level === "blocked" ? "blocked" : "warning") + "\" type=\"button\" data-action=\"locate-risk-hit\" data-article-id=\"" + escapeHtml(article.id) + "\" data-risk-hit-id=\"" + escapeHtml(hit.id) + "\" data-risk-scope=\"" + escapeHtml(scope) + "\" aria-label=\"定位风险词：" + escapeHtml(hit.term) + "\"><span>" + escapeHtml(hit.term) + "</span><small>" + escapeHtml(articleRiskHitLabel(hit)) + "</small></button>").join("");
  return "<section id=\"" + targetId + "\" class=\"article-inline-risk " + (blockedCount ? "has-blocked" : "has-warning") + "\" aria-live=\"polite\"><span class=\"article-inline-risk-icon\" data-icon=\"" + (blockedCount ? "alert" : "shield") + "\"></span><div class=\"article-inline-risk-copy\"><div class=\"article-inline-risk-title\"><strong>编辑器内风控提示</strong><span>" + escapeHtml(summary) + "</span></div><p>问题文字已直接在标题预览和正文中标识：红色“违禁”表示阻断，黄色“复核”表示需要人工确认；点击下方词条可定位。</p><div class=\"article-risk-hit-list\">" + chips + "</div><button class=\"text-button article-risk-details\" type=\"button\" data-action=\"open-risk\" data-article-id=\"" + escapeHtml(article.id) + "\">查看完整风控详情 <span data-icon=\"arrow\"></span></button></div></section>";
}

function refreshArticleRiskInlineNotice(article, scope = "article", draft = {}) {
  const targetId = scope === "studio" ? "studio-inline-risk" : "article-inline-risk";
  const target = document.getElementById(targetId);
  if (!target || !article) return null;
  const draftArticle = {
    ...article,
    title: draft.title === undefined ? article.title : draft.title,
    content: draft.content === undefined ? article.content : sanitizeStudioHtml(draft.content)
  };
  const scan = scanArticleRisk(draftArticle);
  const parent = target.parentElement;
  target.outerHTML = renderArticleRiskInlineNotice(article, scope, scan);
  const titleTargetId = scope === "studio" ? "studio-title-risk-preview" : "article-title-risk-preview";
  const titleTarget = document.getElementById(titleTargetId);
  if (titleTarget) titleTarget.outerHTML = renderArticleRiskTitlePreview(draftArticle, scan, scope);
  hydrateIcons(parent || document);
  return scan;
}

function locateArticleRiskHit(articleId, hitId, scope = "article") {
  const article = state.articles.find((item) => item.id === articleId);
  const titleInput = scope === "studio" ? document.getElementById("studio-title-editor") : document.getElementById("article-title-editor");
  const contentInput = scope === "studio" ? document.getElementById("studio-content-editor") : document.getElementById("article-content-editor");
  const draft = article ? {
    title: titleInput?.value === undefined ? article.title : titleInput.value,
    content: contentInput?.innerHTML === undefined ? article.content : sanitizeStudioHtml(contentInput.innerHTML)
  } : {};
  const hit = scanArticleRisk(article ? { ...article, ...draft } : {}).hits.find((item) => item.id === hitId);
  if (!article || !hit) return showToast("风险词已变化", "请重新检测当前文章后再定位。", "warning");
  const term = hit.term;
  if (titleInput && titleInput.value.includes(term)) {
    const start = titleInput.value.indexOf(term);
    titleInput.focus();
    titleInput.setSelectionRange(start, start + term.length);
    titleInput.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  if (!contentInput) return;
  const walker = document.createTreeWalker(contentInput, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const start = node.nodeValue.indexOf(term);
    if (start < 0) continue;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + term.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    contentInput.focus();
    node.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  contentInput.focus();
  contentInput.scrollIntoView({ block: "center", behavior: "smooth" });
  showToast("未找到风险词", "当前编辑区内容可能尚未保存，请查看完整风控详情。", "warning");
}

function applyArticleRiskScan(article) {
  const scan = scanArticleRisk(article);
  article.riskStatus = scan.status;
  article.riskScan = scan;
  article.updatedAt = Date.now();
  return scan;
}

function renderRiskModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return "";
  const riskStatus = article.riskStatus || "unscanned";
  const scan = article.riskScan?.articleVersion === article.version ? article.riskScan : null;
  const hits = scan?.hits || [];
  const needsScan = ["unscanned", "stale"].includes(riskStatus) || !scan && ["warning", "blocked"].includes(riskStatus);
  const statusTitle = riskStatus === "blocked" ? `命中 ${hits.filter((hit) => hit.level === "blocked").length || 1} 条阻断规则` : riskStatus === "warning" ? `命中 ${hits.length || 1} 条需复核规则` : riskStatus === "stale" ? "旧结果已过期" : riskStatus === "unscanned" ? "当前版本尚未检测" : "当前版本通过风控";
  let result = '<div class="empty-state compact"><div><span data-icon="shield"></span><h3>当前版本通过风控</h3><p>没有命中当前企业内容规则；修改正文或规则后需要重新检测。</p></div></div>';
  if (hits.length) result = `<div class="risk-issue-list">${hits.map((hit) => `<div class="risk-issue"><span class="status-badge ${hit.level === "blocked" ? "status-error" : "status-review"}">${hit.level === "blocked" ? "阻断" : "复核"}</span><div><b>${escapeHtml(hit.label)} · 命中“${escapeHtml(hit.term)}”</b><p>片段：${escapeHtml(hit.excerpt)}</p><small>${escapeHtml(hit.message)}<br />规则：${escapeHtml(hit.rule)}</small></div></div>`).join("")}</div>`;
  if (needsScan) result = '<div class="empty-state compact"><div><span data-icon="refresh"></span><h3>' + (riskStatus === "stale" ? "正文已变化" : scan ? "规则已变化" : "尚无可追溯检测明细") + '</h3><p>请重新检测当前文章版本，再进入审核与发布。</p></div></div>';
  const counts = scan?.ruleCounts || Object.fromEntries(["adLaw", "sensitive", "banned"].map((type) => [type, riskRuleEntries(type).length]));
  const canRunRisk = currentUserCan("content.generate") || currentUserCan("content.review");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">内容风控详情</h2><p>${article.id} · ${article.version} · 风控结果绑定当前文章版本与规则版本</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="risk-overview ${riskStatus !== "clean" ? "warning" : "clean"}"><span class="risk-state-icon ${riskStatus !== "clean" ? "warning" : ""}" data-icon="shield"></span><div><b>${statusTitle}</b><p>实际检查企业维护的广告法规则、敏感规则和禁用表述，并保存命中片段。</p></div></div>
      ${result}
      <div class="risk-rule-grid"><div><b>${counts.adLaw || 0}</b><span>广告法规则</span></div><div><b>${counts.sensitive || 0}</b><span>企业敏感规则</span></div><div><b>${counts.banned || 0}</b><span>企业禁用表述</span></div><div><b>${articleCitations(article).length}</b><span>企业事实证据</span></div></div>
    </div>
    <div class="modal-foot"><span>检测时间：${scan?.scannedAt ? new Date(scan.scannedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未检测"}</span><div class="modal-foot-right"><button class="secondary-button" data-action="back-article" data-article-id="${article.id}">返回文章</button><button class="primary-button" data-action="run-risk-scan" data-article-id="${article.id}" ${canRunRisk ? "" : "disabled"}><span data-icon="refresh"></span>${canRunRisk ? "重新检测" : "无检测权限"}</button></div></div>
  `, { wide: true });
}


async function verifyPublishResult(taskId, platform, button = null) {
  const task = state.publishTasks.find((item) => item.id === taskId);
  if (!task || !task.targets[platform] || !task.remoteJobId) return;
  if (button?.dataset.verifying === "1") return;
  if (button) {
    button.dataset.verifying = "1";
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner dark"></span>核验中';
  }
  try {
    const payload = await publisherApi(`/api/publisher/jobs/${encodeURIComponent(task.remoteJobId)}/verify`, { method: "POST", body: { platform } });
    await refreshPublisherSnapshot({ renderAfter: false });
    render();
    const result = payload?.data?.result || payload?.result || {};
    if (payload?.data?.verified || payload?.verified) {
      showToast("已确认发布", result.message || "检测到公开页面，任务状态已更新为已发布。", "success");
    } else {
      showToast("仍未检测到公开发布", result.message || "当前仍是草稿或无法访问公开页面，任务不会被误标为已发布。", "warning");
    }
  } catch (error) {
    if (button) { button.dataset.verifying = ""; button.disabled = false; button.textContent = "检查发布状态"; }
    showToast("发布状态核验失败", error.message || "暂时无法连接发布服务。", "error");
  }
}

function runDiagnostic(button) {
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner dark"></span>检测中';
  window.setTimeout(() => {
    state.site.lastDiagnostic = new Date().toLocaleString("zh-CN", { hour12: false });
    state.site.diagnosticStatus = "正常";
    saveState();
    render();
    showToast("站点检测完成", "基础访问、页面结构与抓取配置均正常。");
  }, 1200);
}

function persistOnboardingDraft() {
  const profile = state.enterpriseProfile;
  const value = (id) => document.getElementById(id)?.value.trim();
  if (ui.onboardingStep === 1) {
    if (value("onboard-company") !== undefined) profile.companyName = value("onboard-company");
    if (value("onboard-brand") !== undefined) profile.brandName = value("onboard-brand");
    if (value("onboard-intro") !== undefined) profile.introduction = value("onboard-intro");
    if (value("onboard-domain") !== undefined) profile.officialDomain = value("onboard-domain");
    if (value("onboard-industry") !== undefined) profile.industryRegion = value("onboard-industry");
  }
  if (ui.onboardingStep === 2) {
    if (value("onboard-service") !== undefined) profile.primaryService = value("onboard-service");
    if (value("onboard-service-desc") !== undefined) profile.serviceDescription = value("onboard-service-desc");
    if (value("onboard-audience") !== undefined) profile.audience = value("onboard-audience");
    if (value("onboard-area") !== undefined) profile.serviceArea = value("onboard-area");
  }
  saveState();
}

function saveOnboardingCurrentStep() {
  const required = [];
  if (ui.onboardingStep === 1) {
    required.push(["onboard-company", "请填写企业全称"], ["onboard-intro", "请填写企业介绍"]);
  } else if (ui.onboardingStep === 2) {
    required.push(["onboard-service", "请填写主推产品或服务"], ["onboard-service-desc", "请说明业务定位与交付边界"]);
  }
  for (const [id, message] of required) {
    const input = document.getElementById(id);
    if (!input?.value.trim()) {
      input?.classList.add("input-error");
      input?.focus();
      showToast("建档信息未完成", message, "error");
      return false;
    }
  }
  persistOnboardingDraft();
  return true;
}

function domainFromUrl(value, fallback = "tongzhuo.com") {
  try {
    return new URL(String(value || "")).hostname || fallback;
  } catch {
    return fallback;
  }
}

async function saveTrackedWork() {
  const articleId = document.getElementById("tracked-work-article")?.value || "";
  const article = state.articles.find((item) => item.id === articleId);
  const site = document.getElementById("tracked-work-site")?.value.trim() || "";
  const rawUrl = document.getElementById("tracked-work-url")?.value.trim() || "";
  const url = normalizeTrackedUrl(rawUrl);
  if (!article) return showToast("请选择关联文章", "手动 URL 必须归属于一篇内容资产。", "error");
  if (!site) return showToast("请填写发布平台", "例如知乎专栏、行业媒体或客户自有平台。", "error");
  if (!url) return showToast("作品 URL 格式不正确", "请填写以 http:// 或 https:// 开头的完整地址。", "error");
  try {
    if (!article.contentArticleId) await ensureContentPublishSnapshot(article);
    const formalArticleId = article.contentArticleId || article.id;
    let serverAsset = serverContentAssetForArticle(formalArticleId);
    if (!serverAsset) {
      const assetPayload = await productionApi("/api/v1/content-assets", { method: "POST", body: { articleId: formalArticleId } });
      serverAsset = assetPayload.data?.asset || assetPayload.asset;
    }
    if (!serverAsset?.id) throw new Error("服务端未返回内容资产记录");
    await productionApi(`/api/v1/content-assets/${encodeURIComponent(serverAsset.id)}/publications`, {
      method: "POST",
      body: {
        articleVersionId: article.contentApprovedVersionId || article.contentVersionId || null,
        platform: "manual",
        platformName: site,
        url,
        publishedAt: new Date().toISOString(),
        metadata: { sourceType: document.getElementById("tracked-work-type")?.value || "其他" }
      }
    });
    await refreshContentAssets({ renderAfter: false, silent: true });
  } catch (error) {
    return showToast("平台 URL 保存失败", error.message || "内容资产服务暂不可用。", "error");
  }
  const work = ensureArticleTrackedWork(article);
  const added = upsertTrackedPublication(article, { platform: "manual", remoteUrl: url }, { platform: "manual", platformName: site, source: "manual" });
  work.site = work.site || site;
  work.updatedAt = Date.now();
  addOperationLog("引用追踪", `${added ? "添加" : "更新"}《${article.title}》的平台 URL`);
  saveState();
  closeModal();
  render();
  showToast(added ? "平台 URL 已加入追踪" : "平台 URL 已更新", "该地址已经进入服务端自动巡检和 AI 引用匹配。", "success");
}
function upsertAiProviderSnapshot(provider) {
  if (!provider?.id) return;
  const existingIndex = aiProviderSnapshot.providers.findIndex((item) => item.id === provider.id);
  const providers = [...aiProviderSnapshot.providers];
  if (existingIndex >= 0) providers[existingIndex] = provider;
  else providers.unshift(provider);
  aiProviderSnapshot = { ...aiProviderSnapshot, loaded: true, loading: false, providers, error: "" };
}

function enabledAiProviders(kind = "text") {
  return (aiProviderSnapshot.providers || []).filter((provider) => provider?.kind === kind && provider.status !== "disabled" && provider.id && provider.hasApiKey === true && (provider.model || provider.modelId));
}

function autoBindDefaultAiProvider(kind = "text", preferredProvider = null) {
  const providerKey = kind === "embedding" ? "embeddingProviderId" : kind === "image" ? "imageProviderId" : "modelProviderId";
  const modelKey = kind === "embedding" ? null : kind === "image" ? "imageModel" : "model";
  const existingId = String(state.settings?.[providerKey] || "").trim();
  const existing = (aiProviderSnapshot.providers || []).find((provider) => provider.id === existingId && provider.kind === kind && provider.status !== "disabled" && provider.hasApiKey === true && (provider.model || provider.modelId));
  if (existing) {
    // Keep a stale display label from the pre-API demo state from being sent
    // as the upstream model ID.  The provider's model is the authoritative
    // default when the binding was created automatically.
    const configuredModel = modelKey ? String(state.settings?.[modelKey] || "").trim() : "";
    const providerValidatedModel = existing.protocol === "deepseek" && existing.connectionStatus === "passed";
    if (!configuredModel || /DeepSeek\s*V\d|演示|默认模型/i.test(configuredModel) || (providerValidatedModel && existing.model && configuredModel !== existing.model)) {
      if (modelKey && existing.model && state.settings[modelKey] !== existing.model) {
        state.settings[modelKey] = existing.model;
        return true;
      }
    }
    return false;
  }
  const candidates = enabledAiProviders(kind);
  const provider = preferredProvider && candidates.some((item) => item.id === preferredProvider.id)
    ? preferredProvider
    : candidates.length === 1 ? candidates[0] : null;
  if (!provider) return false;
  state.settings[providerKey] = provider.id;
  if (modelKey && provider.model) state.settings[modelKey] = provider.model;
  return true;
}

function aiProviderFormPayload({ includeBlankKey = false } = {}) {
  const payload = {
    name: document.getElementById("ai-provider-name")?.value.trim() || "",
    protocol: document.getElementById("ai-provider-protocol")?.value || "openai_compatible",
    baseUrl: document.getElementById("ai-provider-base-url")?.value.trim() || "",
    model: document.getElementById("ai-provider-model")?.value.trim() || "",
    kind: document.getElementById("ai-provider-kind")?.value || "text",
    status: document.getElementById("ai-provider-status")?.value || "enabled"
  };
  const apiKeyInput = document.getElementById("ai-provider-key");
  const apiKey = apiKeyInput?.value.trim() || "";
  if (apiKey || includeBlankKey) payload.apiKey = apiKey;
  return payload;
}

async function saveAiProvider({ testAfter = false } = {}) {
  const providerId = ui.modal?.providerId || "";
  const returnToModelKind = ui.modal?.returnToModelKind || "";
  const payload = aiProviderFormPayload({ includeBlankKey: !providerId });
  if (!payload.name || !payload.baseUrl || !payload.model) return showToast("信息还没填完整", "供应商名称、API Base URL 和默认模型 ID 都是必填项。", "error");
  if (!providerId && !payload.apiKey) return showToast("API Key 不能为空", "新建供应商时请输入 API Key；编辑已有供应商可以留空以保持原密钥。", "error");
  try {
    const response = providerId
      ? await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}`, { method: "PATCH", body: payload })
      : await aiApi("/api/ai/providers", { method: "POST", body: payload });
    const provider = response.provider || response.data?.provider;
    upsertAiProviderSnapshot(provider);
    const autoBound = provider?.kind === "text" && provider.status !== "disabled"
      ? autoBindDefaultAiProvider("text", provider)
      : provider?.kind === "image" && provider.status !== "disabled"
        ? autoBindDefaultAiProvider("image", provider)
        : provider?.kind === "embedding" && provider.status !== "disabled"
          ? autoBindDefaultAiProvider("embedding", provider)
        : false;
    if (autoBound) saveState();
    if (testAfter && provider?.id) {
      const tested = await aiApi(`/api/ai/providers/${encodeURIComponent(provider.id)}/test`, { method: "POST", body: {} });
      const testedProvider = tested.result?.provider;
      upsertAiProviderSnapshot(testedProvider || provider);
      const rebound = testedProvider?.kind === "text" && testedProvider.status !== "disabled"
        ? autoBindDefaultAiProvider("text", testedProvider)
        : testedProvider?.kind === "image" && testedProvider.status !== "disabled"
          ? autoBindDefaultAiProvider("image", testedProvider)
          : testedProvider?.kind === "embedding" && testedProvider.status !== "disabled"
            ? autoBindDefaultAiProvider("embedding", testedProvider)
          : false;
      if (rebound) saveState();
      showToast("供应商已保存并完成测试", tested.result?.message || "测试状态已更新。");
    } else {
      showToast(
        providerId ? "供应商配置已更新" : "API 供应商已添加",
        autoBound
          ? `${provider.name || "API 供应商"} 已保存，并已自动绑定为默认${provider.kind === "image" ? "图片" : provider.kind === "embedding" ? "向量" : "文本"}模型。`
          : "供应商已保存；如需用于生成，请在“更换模型”中选择它。"
      );
    }
    if (returnToModelKind) {
      ui.modal = { type: "modelEditor", modelKind: returnToModelKind };
      return renderModal();
    }
    closeModal();
    render();
  } catch (error) {
    showToast("供应商保存失败", error.message || "请检查服务端是否已启动。", "error");
  }
}

async function testAiProvider(providerId) {
  if (!providerId) return;
  try {
    const response = await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, { method: "POST", body: {} });
    const testedProvider = response.result?.provider;
    upsertAiProviderSnapshot(testedProvider);
    const rebound = testedProvider?.kind === "text" && testedProvider.status !== "disabled"
      ? autoBindDefaultAiProvider("text", testedProvider)
      : testedProvider?.kind === "image" && testedProvider.status !== "disabled"
        ? autoBindDefaultAiProvider("image", testedProvider)
        : false;
    if (rebound) saveState();
    render();
    showToast(response.result?.status === "passed" ? "连接测试通过" : "连接测试未通过", response.result?.message || "测试状态已更新。", response.result?.status === "passed" ? "success" : "error");
  } catch (error) {
    showToast("连接测试失败", error.message || "请检查服务端是否已启动。", "error");
  }
}

async function deleteAiProvider(providerId) {
  const provider = aiProviderSnapshot.providers.find((item) => item.id === providerId);
  if (!provider) return;
  if (state.settings.modelProviderId === providerId || state.settings.imageProviderId === providerId || state.settings.embeddingProviderId === providerId) return showToast("供应商正在使用中", "请先在默认模型中取消绑定后再删除。", "error");
  if (!await uiConfirm(`确认删除模型供应商“${provider.name}”？`)) return;
  try {
    await aiApi(`/api/ai/providers/${encodeURIComponent(providerId)}`, { method: "DELETE" });
    aiProviderSnapshot = { ...aiProviderSnapshot, providers: aiProviderSnapshot.providers.filter((item) => item.id !== providerId) };
    render();
    showToast("供应商已删除", "服务端密钥和供应商配置已一并移除。");
  } catch (error) {
    showToast("供应商删除失败", error.message || "请稍后重试。", "error");
  }
}

function saveModel(modelKind) {
  const kind = ["image", "embedding"].includes(modelKind) ? modelKind : "text";
  const providerId = document.getElementById("model-provider")?.value || "";
  const customName = document.getElementById("model-custom-name")?.value.trim() || "";
  const provider = (aiProviderSnapshot.providers || []).find((item) => item.id === providerId);
  const modelName = (provider && (!customName || /DeepSeek\s*V\d|演示|默认模型/i.test(customName)) ? provider.model : customName) || provider?.model || "";
  if (!modelName) return showToast("模型 ID 不能为空", "请输入模型 ID，或先选择一个已配置默认模型的供应商。", "error");
  const key = kind === "embedding" ? null : kind === "image" ? "imageModel" : "model";
  const providerKey = kind === "embedding" ? "embeddingProviderId" : kind === "image" ? "imageProviderId" : "modelProviderId";
  const before = key ? state.settings[key] : "embedding";
  if (key) state.settings[key] = modelName;
  state.settings[providerKey] = providerId;
  addOperationLog("模型配置", `默认${kind === "image" ? "图片" : kind === "embedding" ? "向量" : "文本"}模型由“${before}”更换为“${modelName}”${provider ? `，绑定供应商“${provider.name}”` : "，未绑定 API 供应商"}`);
  saveState();
  closeModal();
  render();
  showToast("默认模型已更新", `新${kind === "embedding" ? "知识索引" : "生成任务"}将使用“${modelName}”${provider ? `（${provider.name}）` : ""}；历史文章的模型快照保持不变。`);
}

async function saveMember(memberId) {
  const existing = memberId ? state.settings.members.find((member) => member.id === memberId) : null;
  const name = document.getElementById("member-name")?.value.trim() || "";
  const email = document.getElementById("member-email")?.value.trim().toLowerCase() || "";
  const username = document.getElementById("member-username")?.value.trim() || existing?.username || "";
  const password = document.getElementById("member-password")?.value || "";
  const role = document.getElementById("member-role")?.value || "operator";
  const status = document.getElementById("member-status")?.value || "active";
  if (!name || !username) return showToast("成员信息不完整", "请填写姓名和登录账号。", "error");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("邮箱格式不正确", "请填写有效的企业邮箱地址，或暂时留空。", "error");
  if (!existing && password.length < 10) return showToast("初始密码过短", "初始密码至少需要 10 个字符。", "error");
  if (existing && password && password.length < 10) return showToast("新密码过短", "重置密码至少需要 10 个字符。", "error");
  const payload = { displayName: name, email, role, status, ...(!existing ? { username } : {}), ...(password ? { password } : {}) };
  try {
    await productionApi(existing ? `/api/v1/users/${encodeURIComponent(existing.id)}` : "/api/v1/users", { method: existing ? "PATCH" : "POST", body: payload });
    await refreshProductionMembers();
    closeModal();
    render();
    showToast(existing ? "成员配置已保存" : "成员账号已创建", existing ? "角色、状态和密码设置已由服务器更新。" : "成员可以使用登录账号和初始密码进入系统。");
  } catch (error) {
    showToast(existing ? "成员更新失败" : "成员创建失败", error.message || "请检查账号和角色设置。", "error");
  }
}

async function deleteMember(memberId) {
  const member = state.settings.members.find((item) => item.id === memberId);
  if (!member) return;
  if (!await uiConfirm(`确认删除成员“${member.name}”？该成员的所有登录会话会立即失效。`)) return;
  try {
    await productionApi(`/api/v1/users/${encodeURIComponent(memberId)}`, { method: "DELETE" });
    await refreshProductionMembers();
    closeModal();
    render();
    showToast("成员已删除", `“${member.name}”已从当前企业服务器移除。`);
  } catch (error) {
    showToast("成员删除失败", error.message || "请确认系统中仍有其他管理员。", "error");
  }
}

function exportOperationLogs() {
  const source = auditSnapshot.loaded
    ? auditSnapshot.items.map((entry) => ({ occurredAt: entry.occurredAt, category: entry.action, actor: entry.actor, detail: `${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}` }))
    : (state.settings.operationLogs || []);
  const rows = [["时间", "分类", "操作人 / 来源", "详情"], ...source.map((entry) => [formatDateTime(entry.occurredAt), entry.category, entry.actor, entry.detail])];
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const day = new Date().toISOString().slice(0, 10);
  downloadTextFile(`tongzhuo-geo-operation-logs-${day}.csv`, csv, "text/csv;charset=utf-8");
  showToast("日志文件已下载", `已导出 ${Math.max(rows.length - 1, 0)} 条可回看的 CSV 记录。`);
}

function updateCommandResults() {
  const list = document.getElementById("command-list");
  if (!list) return;
  list.innerHTML = commandResultsHtml();
  hydrateIcons(list);
}

function officialConsultUrl() {
  return "https://tongzhuo.ink/insights/";
}
function monitoringShowTooltip(point) {
  const chart = point?.closest(".monitor-real-trend-chart");
  const tooltip = chart?.querySelector("[data-monitor-tooltip]");
  if (!chart || !tooltip) return;
  const data = {
    label: point.dataset.label,
    value: Number(point.dataset.value || 0),
    humanPv: Number(point.dataset.human || 0),
    aiBotPv: Number(point.dataset.ai || 0),
    searchBotPv: Number(point.dataset.search || 0),
    otherBotPv: Number(point.dataset.other || 0),
    unknownPv: Number(point.dataset.unknown || 0)
  };
  tooltip.innerHTML = monitoringTrendTooltipMarkup(data);
  tooltip.hidden = false;
  const chartRect = chart.getBoundingClientRect();
  const pointRect = point.getBoundingClientRect();
  const rawLeft = pointRect.left - chartRect.left + pointRect.width / 2 - tooltip.offsetWidth / 2;
  const left = Math.max(8, Math.min(chart.clientWidth - tooltip.offsetWidth - 8, rawLeft));
  const top = pointRect.top - chartRect.top - tooltip.offsetHeight - 10;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function monitoringHideTooltip(point) {
  const tooltip = point?.closest(".monitor-real-trend-chart")?.querySelector("[data-monitor-tooltip]");
  if (tooltip) tooltip.hidden = true;
}

let effectTrendTipEl = null;
function effectTrendShowTip(point) {
  effectTrendHideTip();
  const tip = document.createElement("div");
  tip.className = "effect-trend-tip";
  tip.textContent = point.dataset.tip || "";
  document.body.appendChild(tip);
  effectTrendTipEl = tip;
  const rect = point.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, rect.left + rect.width / 2 - tip.offsetWidth / 2));
  tip.style.left = `${left + window.scrollX}px`;
  tip.style.top = `${rect.top + window.scrollY - tip.offsetHeight - 10}px`;
  requestAnimationFrame(() => tip.classList.add("is-visible"));
}
function effectTrendHideTip() {
  if (effectTrendTipEl) {
    effectTrendTipEl.remove();
    effectTrendTipEl = null;
  }
}

function studioPlainText(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function studioMessageSources(workspace, conversation) {
  const selectedIds = new Set(conversation?.selectedKnowledgeItemIds || []);
  const knowledgeSources = studioApprovedKnowledgeEntries(workspace)
    .filter((entry) => selectedIds.has(entry.item.id))
    .map((entry) => ({
      sourceType: "knowledge",
      title: entry.item.title || entry.item.question,
      meta: `${entry.base.name} · v${entry.version.version} · 已审核`,
      knowledgeBaseId: entry.base.id,
      itemId: entry.item.id,
      versionId: entry.version.id
    }));
  if (conversation?.webSearchEnabled) knowledgeSources.push({
    sourceType: "web",
    title: "公开网页检索结果（演示）",
    meta: `外部资料 · 未经企业审核 · ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content"
  });
  return knowledgeSources;
}

function studioEvidenceFromCitation(citation) {
  const libraryId = citation?.knowledgeBaseId || citation?.knowledgeLibraryId || citation?.libraryId || "";
  const documentId = citation?.itemId || citation?.knowledgeDocumentId || citation?.documentId || "";
  const versionId = citation?.versionId || citation?.knowledgeVersionId || "";
  const version = knowledgeVersionById(versionId) || { id: versionId, content: citation?.quote || citation?.excerpt || "" };
  const quote = citation?.quote || citation?.excerpt || version.content || "";
  const chunks = Array.isArray(version.chunks) ? version.chunks : [];
  const matchedChunk = citation?.chunkId
    ? chunks.find((chunk) => chunk?.id === citation.chunkId)
    : chunks.length === 1
      ? chunks[0]
      : chunks.find((chunk) => {
        const text = String(chunk?.text || chunk?.content || "").trim();
        return text && quote && (text.includes(quote) || quote.includes(text));
      });
  const chunkId = citation?.chunkId || citation?.knowledgeChunkId || matchedChunk?.id || "";
  const base = knowledgeBaseById(libraryId) || { id: libraryId, name: citation?.source || citation?.sourceName || "企业知识库" };
  const item = knowledgeItemById(documentId) || { id: documentId, title: citation?.claim || citation?.title || "已审核企业事实" };
  return {
    item,
    quote,
    base,
    version: { ...version, id: versionId || version.id, content: version.content || quote },
    chunk: matchedChunk || (chunkId ? { id: chunkId, text: quote } : null),
    libraryId,
    documentId,
    versionId: versionId || version.id || "",
    chunkId,
    referenceComplete: Boolean(libraryId && documentId && (versionId || version.id) && chunkId)
  };
}

function aiEvidencePayload(evidence) {
  return (evidence || []).map((entry, index) => ({
    id: `EVID-${index + 1}`,
    marker: `K${index + 1}`,
    claim: entry.item?.title || entry.item?.question || "已审核企业事实",
    quote: entry.quote || entry.version?.content || "",
    source: entry.base?.name || "企业知识库",
    locator: knowledgeLocator(entry.item || {}, entry.version || {}),
    knowledgeLibraryId: entry.base?.id || entry.knowledgeLibraryId || entry.libraryId || null,
    knowledgeDocumentId: entry.item?.id || entry.knowledgeDocumentId || entry.documentId || entry.itemId || null,
    versionId: entry.version?.id || entry.knowledgeVersionId || entry.versionId || null,
    knowledgeVersionId: entry.version?.id || entry.knowledgeVersionId || entry.versionId || null,
    knowledgeChunkId: entry.chunk?.id || entry.knowledgeChunkId || entry.chunkId || null,
    status: "approved",
    supportStatus: "supported"
  }));
}

function applyRemoteArticleResult(article, remoteGeneration) {
  if (!article || !remoteGeneration) return article;
  article.title = String(remoteGeneration.title || article.title).slice(0, 240);
  const previousCitationIds = Array.isArray(article.citations) ? [...article.citations] : [];
  const hasRemoteCitations = Array.isArray(remoteGeneration.citations);
  const remoteCitations = hasRemoteCitations ? remoteGeneration.citations : [];
  let citations = articleCitations(article);
  const localByRemoteId = new Map();
  if (hasRemoteCitations) {
    state.knowledgeCitations = (state.knowledgeCitations || []).filter((citation) => !previousCitationIds.includes(citation.id));
    citations = remoteCitations.map((remote, index) => {
      const marker = remote.marker || `K${index + 1}`;
      const local = {
        id: uid("CIT") + "-" + marker,
        articleId: article.id,
        articleVersion: article.version || "v1",
        marker,
        paragraphId: remote.paragraphId || "p-knowledge",
        articleSection: remote.articleSection || "关键判断与事实依据",
        knowledgeBaseId: remote.knowledgeLibraryId || remote.libraryId || null,
        itemId: remote.knowledgeDocumentId || remote.documentId || null,
        versionId: remote.knowledgeVersionId || remote.versionId || null,
        chunkId: remote.knowledgeChunkId || remote.chunkId || null,
        claim: remote.claim || "已审核企业事实",
        quote: remote.quote || remote.excerpt || "",
        excerpt: remote.quote || remote.excerpt || "",
        locator: remote.locator || "",
        supportStatus: remote.supportStatus || "supported",
        status: "verified"
      };
      state.knowledgeCitations.push(local);
      if (remote.id) localByRemoteId.set(String(remote.id), local);
      return local;
    });
    article.citations = citations.map((citation) => citation.id);
    article.knowledgeSnapshot = {
      ...(article.knowledgeSnapshot || {}),
      citationIds: [...article.citations],
      lockedVersionIds: [...new Set(citations.map((citation) => citation.versionId).filter(Boolean))]
    };
  }
  const remoteHtml = String(remoteGeneration.html || remoteGeneration.content || "");
  article.content = remoteHtml.replace(/<sup\b([^>]*?)data-evidence-id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/sup>/gi, (match, before, evidenceId, after, label) => {
    const citation = localByRemoteId.get(String(evidenceId)) || citations[Number(String(evidenceId).replace(/\D/g, "")) - 1];
    return citation ? citationMarkerHtml(citation) : String(label || "");
  });
  article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
  article.sources = citations.length;
  if (article.knowledgeStatus && hasRemoteCitations) {
    article.knowledgeStatus.evidenceCount = citations.length;
    article.knowledgeStatus.supportedClaims = citations.filter((citation) => citation.supportStatus === "supported").length;
  }
  article.contentTaskId = remoteGeneration.contentTaskId || remoteGeneration.taskId || remoteGeneration.contentTask?.id || article.contentTaskId || null;
  article.contentArticleId = remoteGeneration.contentArticleId || remoteGeneration.articleId || remoteGeneration.contentArticle?.id || article.contentArticleId || null;
  article.contentVersionId = remoteGeneration.articleVersionId || remoteGeneration.versionId || remoteGeneration.articleVersion?.id || article.contentVersionId || null;
  article.contentRevision = remoteGeneration.contentRevision ?? remoteGeneration.revision ?? article.contentRevision;
  article.contentVersionNumber = remoteGeneration.articleVersion?.versionNumber ?? remoteGeneration.versionNumber ?? article.contentVersionNumber;
  article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "real_model", generationMode: "model", model: remoteGeneration.model || selectedTextModelName(), usage: remoteGeneration.usage || null, requestId: remoteGeneration.requestId || null, omittedClaims: remoteGeneration.omittedClaims || [], warnings: remoteGeneration.warnings || [] };
  return article;
}

async function requestAiArticle({ providerId, line, contentType, topic, agentSnapshot, evidence, expectedPlatforms = [], userInstruction = "", planId = "", contentPlanId = "", contentArticleId = "", contentTaskId = "", topicId = "", idempotencyKey = "", dueAt = "", expectedCompletionAt = "", knowledgeBaseIds = [], persist = true }) {
  const coreQuestion = /[？?]/.test(topic?.geoBrief?.coreQuestion || topic?.title || "")
    ? (topic?.geoBrief?.coreQuestion || topic?.title)
    : `${topic?.geoBrief?.coreQuestion || topic?.title}应该如何判断和实施？`;
  const brief = { ...(topic?.geoBrief || buildGeoTopicBrief(topic, topic?.questionSnapshot)), coreQuestion };
  const payload = await aiApi("/api/ai/generate/article", {
    method: "POST",
    body: {
      providerId,
      model: selectedTextModelName(),
      planId: contentPlanId || planId || null,
      contentPlanId: contentPlanId || planId || null,
      contentArticleId: contentArticleId || null,
      contentTaskId: contentTaskId || null,
      topicId: topicId || topic?.id || null,
      idempotencyKey: idempotencyKey || null,
      dueAt: dueAt || expectedCompletionAt || null,
      expectedCompletionAt: expectedCompletionAt || dueAt || null,
      useRag: true,
      rag: {
        enabled: true,
        businessLineId: line?.id || "",
        query: coreQuestion,
        libraryIds: Array.isArray(knowledgeBaseIds) ? knowledgeBaseIds : [],
        embeddingProviderId: state.settings?.embeddingProviderId || "",
        topK: 8,
        minScore: 0.08
      },
      businessLine: aiBusinessLinePayload(line),
      contentType,
      topic: { id: topicId || topic.id, title: topic.title, coreQuestion, dimension: topic.dimension || "question", intent: topic.intent, stage: topic.stage, geoBrief: brief },
      topicBrief: brief,
      userInstruction: String(userInstruction || "").slice(0, 4000),
      agentSnapshot,
      writingAgent: agentSnapshot,
      approvedEvidence: aiEvidencePayload(evidence),
      expectedPlatforms,
      ...(persist === false ? { persist: false } : {}),
      outputContract: buildGeoOutputContract({ ...topic, geoBrief: brief }, [], agentSnapshot, { contentType })
    }
  });
  const remote = payload.data?.article || payload.article || payload.data || payload;
  if (!remote || typeof (remote.html || remote.content) !== "string") throw new Error("模型没有返回可编辑的 HTML 文章");
  return remote;
}

async function sendStudioChat() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  if (!workspace || !conversation) return;
  if (ui.studioGenerating) return showToast("文章正在生成", "初稿完成后可以继续通过 AI 协作调整内容。", "warning");
  const input = document.getElementById("studio-composer-input");
  const prompt = (input?.value || ui.studioComposerDraft).trim();
  if (!prompt) return showToast("请输入调整要求", "例如：改成采购决策结构，并保留知识引用。", "error");
  const article = syncStudioArticleEditor({ silent: true }) || studioArticleForWorkspace(workspace);
  if (article?.reviewStage === "manual_review") return showToast("当前版本正在人工审核", "审核中的版本不能继续生成或应用修改建议，请先退回并修改。", "error");
  const agent = writingAgentById(conversation.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  if (!agent || !writingAgentSupports(agent, workspace.businessLineId, workspace.contentType)) return showToast("写作智能体不可用", "请选择适用于当前业务线和内容形式的智能体。", "error");
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: "studio_chat" });
  const attachments = (workspace.attachmentIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter(Boolean).map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, reviewStatus: asset.reviewStatus }));
  const sources = studioMessageSources(workspace, conversation);
  const contextSnapshot = {
    businessLineId: workspace.businessLineId,
    topic: cloneData(studioWorkspaceTopic(workspace, article)),
    articleVersion: article?.version || null,
    contentHash: article ? studioContentHash(article.content) : null,
    knowledgeBaseIds: cloneData(conversation.selectedKnowledgeBaseIds || []),
    knowledgeItemIds: cloneData(conversation.selectedKnowledgeItemIds || []),
    attachmentIds: cloneData(workspace.attachmentIds || []),
    imageIds: cloneData(conversation.imageIds || []),
    webSearchEnabled: Boolean(conversation.webSearchEnabled)
  };
  if (!article) return showToast("没有可协作的文章", "请先从内容计划或文章编辑器打开一篇正文。", "error");
  conversation.messages.push({ id: uid("MSG"), role: "user", text: prompt, createdAt: Date.now(), agentSnapshot, contextSnapshot, attachments });
  conversation.messages.push({ id: uid("MSG"), role: "assistant", text: "正在结合企业知识与当前正文思考修改建议…", thinking: true, createdAt: Date.now() });
  conversation.updatedAt = Date.now();
  workspace.updatedAt = conversation.updatedAt;
  saveState();
  render();
  const providerId = await ensureSelectedTextProviderId();
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId && item.status === "active");
  const citationEvidence = articleCitations(article).map(studioEvidenceFromCitation);
  const evidence = citationEvidence.filter((entry) => entry.referenceComplete);
  if (!providerId || !line || !evidence.length || evidence.length !== citationEvidence.length) {
    const failureText = !providerId
      ? "尚未配置文本模型，无法生成 AI 修改建议。"
      : !line
        ? "当前业务线不可用，无法生成 AI 修改建议。"
        : evidence.length !== citationEvidence.length
          ? "当前文章的知识引用快照不完整（缺少知识库、文档、版本或片段定位），请重新检索或生成文章后再协作。"
          : "当前文章没有冻结的已审核证据，无法安全重写。";
    conversation.messages = conversation.messages.filter((m) => !m.thinking);
    conversation.messages.push({ id: uid("MSG"), role: "assistant", text: failureText, createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal: null });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = prompt;
    saveState();
    render();
    return showToast("AI 协作未执行", failureText, "error");
  }
  let remoteRevision;
  try {
    remoteRevision = await requestAiArticle({
      providerId,
      line,
      contentType: workspace.contentType,
      topic: studioWorkspaceTopic(workspace, article),
      agentSnapshot,
      evidence,
      expectedPlatforms: planExpectedPlatformGuidance(contentPlanForArticle(article)).map((item) => item.name),
      userInstruction: `${prompt}\n当前文章标题：${article.title}\n当前文章正文：${studioPlainText(article.content).slice(0, 12000)}`,
      persist: false
    });
  } catch (error) {
    const failureText = `模型没有生成可用的修改建议：${error.message || "请检查模型与知识配置后重试。"}`;
    conversation.messages.push({ id: uid("MSG"), role: "assistant", text: failureText, createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal: null });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = "";
    saveState();
    render();
    return showToast("AI 协作失败", failureText, "error");
  }
  applyRemoteArticleResult(article, remoteRevision);
  conversation.messages = conversation.messages.filter((m) => !m.thinking);
  conversation.messages.push({
    id: uid("MSG"),
    role: "assistant",
    text: String(remoteRevision.summary || "模型已经按你的要求重写正文并保留企业知识引用。").slice(0, 400),
    createdAt: Date.now(),
    agentSnapshot,
    contextSnapshot,
    sources,
    attachments,
    proposal: {
      kind: "rewrite",
      label: "AI 正文修改建议",
      title: String(remoteRevision.title || article.title).slice(0, 240),
      html: remoteRevision.html || remoteRevision.content || null,
      citationIds: Array.isArray(remoteRevision.citations) ? remoteRevision.citations.map((citation, index) => `K${index + 1}`) : null,
      hasRemoteCitations: Array.isArray(remoteRevision.citations),
      before: `当前 ${article.version}`,
      after: String(remoteRevision.summary || "已按本次要求重写，并保留证据边界。").slice(0, 300),
      baseArticleVersion: article.version,
      baseContentHash: studioContentHash(article.content),
      status: "pending",
      generationRunId: remoteRevision.generationRunId || remoteRevision.runId || null,
      model: remoteRevision.model || selectedTextModelName(),
      usage: remoteRevision.usage || null
    }
  });
  conversation.updatedAt = Date.now();
  workspace.updatedAt = conversation.updatedAt;
  ui.studioComposerDraft = "";
  saveState();
  render();
  showToast("AI 协作完成", "模型建议已写回当前文章。");
}
