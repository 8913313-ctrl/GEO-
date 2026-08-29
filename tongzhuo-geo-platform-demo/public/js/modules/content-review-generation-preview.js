// Generation preview and citation dialogs.
// Kept as a classic-script module so the existing global render/action API remains unchanged.

function generationEvidenceForPlan(plan, limit = 6) {
  const scope = normalizeKnowledgeScope(plan);
  const preferredIds = (plan.writingAgentSnapshot?.preferredKnowledgeBaseIds || []).filter((id) => scope.resolvedBaseIds.includes(id));
  const orderedBaseIds = [...preferredIds, ...scope.resolvedBaseIds.filter((id) => !preferredIds.includes(id))];
  const groups = orderedBaseIds.map((baseId) => approvedKnowledgeItems(baseId).map((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const chunk = version?.chunks?.[0];
    return { base: knowledgeBaseById(baseId), item, version, chunk, quote: chunk?.text || version?.content || "" };
  }).filter((entry) => entry.base && entry.version && entry.quote));
  const selectedItemIds = new Set(plan.selectedKnowledgeItemIds || []);
  const selected = [];
  groups.flat().forEach((entry) => { if (selectedItemIds.has(entry.item.id) && selected.length < limit) selected.push(entry); });
  groups.forEach((group) => { if (group[0] && selected.length < limit && !selected.some((entry) => entry.item.id === group[0].item.id)) selected.push(group[0]); });
  for (let depth = 1; selected.length < limit; depth += 1) {
    let found = false;
    [...groups].reverse().forEach((group) => {
      if (group[depth] && selected.length < limit && !selected.some((entry) => entry.item.id === group[depth].item.id)) {
        selected.push(group[depth]);
        found = true;
      }
    });
    if (!found) break;
  }
  return selected;
}

function generationGapLabels(plan, options = {}) {
  const planArticleIds = new Set(plan.articleIds || []);
  const gaps = (state.knowledgeGaps || []).filter((gap) => gap.status !== "resolved" && (gap.planId === plan.id || planArticleIds.has(gap.articleId)) && (!gap.businessLineId || gap.businessLineId === plan.businessLineId));
  const labels = gaps.map((gap) => gap.title || gap.label || gap.fact).filter(Boolean);
  if (labels.length || options.blockingOnly || plan.writingAgentSnapshot?.missingEvidenceAction === "block") return labels;
  return ["价格", "交付周期"];
}

function renderGenerationPreviewModal() {
  const plan = state.contentPlans.find((item) => item.id === ui.modal.planId);
  if (!plan) return "";
  const alreadyGenerated = plan.status === "produced";
  const line = state.businessLines.find((item) => item.id === plan.businessLineId);
  const { scope, approved } = planKnowledgeSummary(plan);
  const evidence = generationEvidenceForPlan(plan);
  const gaps = generationGapLabels(plan);
  const agentSnapshot = plan.writingAgentSnapshot;
  const currentAgent = writingAgentById(agentSnapshot?.agentId || plan.writingAgentId);
  const agentAvailable = Boolean(agentSnapshot && currentAgent?.status === "active");
  const hasNewAgentVersion = Boolean(currentAgent && agentSnapshot && Number(currentAgent.version) > Number(agentSnapshot.version));
  const blockedByKnowledgePolicy = agentSnapshot?.missingEvidenceAction === "block" && generationGapLabels(plan, { blockingOnly: true }).length > 0;
  const canGenerate = evidence.length > 0 && agentAvailable && !blockedByKnowledgePolicy;
  const publicIds = enterpriseKnowledgeBaseIds();
  const baseRows = scope.resolvedBaseIds.map((baseId) => {
    const base = knowledgeBaseById(baseId);
    if (!base) return "";
    const itemCount = approvedKnowledgeItems(baseId).length;
    const usedCount = evidence.filter((entry) => entry.base.id === baseId).length;
    const origin = publicIds.includes(baseId) ? "企业公共" : scope.addedBaseIds.includes(baseId) ? "本计划增补" : "业务线默认";
    return `<div class="generation-base-row"><span class="knowledge-check-icon" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(base.name)}</b><small>${knowledgeKindLabel(base.kind)} · ${origin}</small></span><em>拟用 ${usedCount} / 可用 ${itemCount}</em></div>`;
  }).join("");
  const evidenceRows = evidence.map((entry, index) => `<div class="generation-evidence-row"><b>K${index + 1}</b><span><strong>${escapeHtml(entry.item.title || entry.item.question)}</strong><small>${escapeHtml(entry.base.name)} · v${escapeHtml(entry.version.version)} · ${escapeHtml(knowledgeLocator(entry.item, entry.version))}</small><p>${escapeHtml(entry.quote)}</p></span></div>`).join("");
  const chain = '<span>企业公共库 ' + publicIds.filter((id) => scope.resolvedBaseIds.includes(id)).length + '</span><span data-icon="arrow"></span><span>' + escapeHtml(line?.name || "业务线") + '默认库 ' + scope.inheritedBaseIds.filter((id) => !publicIds.includes(id) && scope.resolvedBaseIds.includes(id)).length + '</span><span data-icon="arrow"></span><b>本计划 ' + scope.resolvedBaseIds.length + ' 库</b>';
  const preferredInScope = (agentSnapshot?.preferredKnowledgeBaseIds || []).filter((id) => scope.resolvedBaseIds.includes(id)).map((id) => knowledgeBaseById(id)?.name).filter(Boolean);
  const expectedPlatformNames = planExpectedPlatformNames(plan);
  const briefTopic = plan.topicSnapshots?.[0] || state.topics.find((topic) => plan.topicIds?.includes(topic.id));
  const topicBrief = briefTopic ? (briefTopic.geoBrief || buildGeoTopicBrief(briefTopic, briefTopic.questionSnapshot)) : null;
  const topicBriefHtml = topicBrief ? `<section class="generation-section geo-brief-preview"><div class="section-title"><div><h3>本次选题 Brief</h3><p>先确定 AI 要回答的问题，再决定文章结构；多选题计划会为每篇文章分别生成 Brief。</p></div><span class="small-tag teal">问题地图</span></div><div class="geo-brief-grid"><div><span>核心问题</span><b>${escapeHtml(topicBrief.coreQuestion || briefTopic.title)}</b></div><div><span>决策角色</span><b>${escapeHtml(topicBrief.decisionRole || "—")}</b></div><div><span>回答方式</span><b>${escapeHtml(topicBrief.answerMode || "—")}</b></div><div><span>证据需求</span><b>${escapeHtml((topicBrief.evidenceNeeds || []).join("、") || "—")}</b></div></div><div class="topic-tags">${(topicBrief.requiredSections || []).map((section) => `<span class="small-tag">${escapeHtml(section)}</span>`).join("")}</div></section>` : "";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">生成方案确认</h2><p>${escapeHtml(plan.name)} · 同时核对写作方式与企业知识依据</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body generation-preview">
      ${agentSnapshot ? `<section class="generation-agent-section ${agentAvailable || alreadyGenerated ? "" : "invalid"}"><div class="generation-agent-main"><span class="writing-agent-avatar ${escapeHtml(currentAgent?.color || "blue")}">${escapeHtml(currentAgent?.avatar || agentSnapshot.nameSnapshot.slice(0, 1))}</span><div><span>本计划冻结的写作智能体</span><h3>${escapeHtml(agentSnapshot.nameSnapshot)} <em>v${escapeHtml(agentSnapshot.version)}</em></h3><p>${escapeHtml(agentSnapshot.style)} · ${escapeHtml(agentSnapshot.template)} · ${agentSnapshot.minWords}–${agentSnapshot.maxWords} 字</p></div><span class="status-badge ${agentAvailable ? "status-approved" : "status-error"}">${agentAvailable ? "可用" : "已停用或不适用"}</span></div><div class="generation-agent-rules"><span><b>写作角色</b>${escapeHtml(agentSnapshot.role)}</span><span><b>目标读者</b>${escapeHtml(agentSnapshot.audience)}</span><span><b>知识模式</b>${agentSnapshot.strictKnowledge ? "严格知识" : "普通模式"} · ${agentSnapshot.citationsRequired ? "逐条引用" : "不强制引用"}</span><span><b>缺少证据</b>${agentSnapshot.missingEvidenceAction === "block" ? "阻止生成" : "省略并标记"}</span></div>${preferredInScope.length ? '<p class="agent-priority-note"><b>优先召回：</b>' + escapeHtml(preferredInScope.join("、")) + '；仅调整本计划知识范围内的顺序。</p>' : ""}${hasNewAgentVersion && !alreadyGenerated ? '<div class="agent-version-update"><span data-icon="history"></span><span>当前智能体已有 v' + escapeHtml(currentAgent.version) + '，计划仍冻结 v' + escapeHtml(agentSnapshot.version) + '。</span><button class="text-button" type="button" data-action="upgrade-plan-agent" data-plan-id="' + plan.id + '">升级到最新版</button></div>' : ""}</section>` : '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>计划未记录写作智能体</b><p>请重新创建内容计划后再生成，系统不会静默换用默认智能体。</p></div></div>'}
      ${expectedPlatformNames.length ? `<div class="generation-platform-hint"><span data-icon="sparkle"></span><span><b>预计适配平台（仅写作提示）</b><small>${escapeHtml(expectedPlatformNames.join("、"))} · 不会创建或锁定发布目标</small></span></div>` : ""}
      ${topicBriefHtml}
      <div class="generation-chain">${chain}</div>
      <div class="generation-summary"><div><span>实际知识库</span><b>${scope.resolvedBaseIds.length}</b></div><div><span>可用知识资料</span><b>${approved}</b></div><div><span>预计引用证据</span><b>${evidence.length}</b></div><div><span>事实冲突</span><b class="good">0</b></div></div>
      <section class="generation-section"><div class="section-title"><div><h3>本次知识范围</h3><p>范围来自计划快照，不会临时改写业务线默认包</p></div><span class="small-tag teal">严格知识模式</span></div><div class="generation-base-list">${baseRows || '<div class="empty-inline">未选择知识库</div>'}</div></section>
      <section class="generation-section"><div class="section-title"><div><h3>预计使用的证据</h3><p>仅检索可用版本，生成后逐条锁定版本和原文</p></div><span class="small-tag blue">${evidence.length} 条</span></div><div class="generation-evidence-list">${evidenceRows || '<div class="empty-state compact"><div><span data-icon="alert"></span><h3>没有可用证据</h3><p>请先在企业知识中上传资料。</p></div></div>'}</div></section>
      ${gaps.length ? '<div class="knowledge-gap-warning"><span data-icon="alert"></span><div><b>发现 ' + gaps.length + ' 项知识缺口</b><p>' + gaps.map(escapeHtml).join("、") + '。缺口不会由模型补写，也不会生成具体数字或保证性承诺。</p></div></div>' : '<div class="privacy-note"><span data-icon="check"></span><span>当前计划没有已记录的知识缺口；严格知识智能体可以继续生成。</span></div>'}
      <label class="strict-mode-row"><input class="checkbox" type="checkbox" id="strict-knowledge-mode" ${agentSnapshot?.strictKnowledge !== false ? "checked" : ""} disabled /><span><b>${agentSnapshot?.strictKnowledge !== false ? "严格知识模式" : "普通知识模式"}</b><small>规则来自计划冻结的智能体版本；企业事实始终不能突破已审核知识范围</small></span></label>
    </div>
    <div class="modal-foot"><span>${alreadyGenerated ? "这是文章生成时实际使用的冻结方案" : canGenerate ? "智能体与证据检查通过，可以生成" : !agentAvailable ? "写作智能体不可用，暂不能生成" : blockedByKnowledgePolicy ? "智能体要求证据完整，需先补齐知识缺口" : "知识不足，暂不能生成"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">返回计划</button>${alreadyGenerated ? '<button class="primary-button" type="button" data-action="view-plan-content" data-plan-id="' + plan.id + '"><span data-icon="file"></span>查看已生成内容</button>' : '<button class="primary-button" type="button" data-action="confirm-generate-plan" data-plan-id="' + plan.id + '" ' + (canGenerate ? "" : "disabled") + '><span data-icon="sparkle"></span>确认并生成文章</button>'}</div></div>
  `, { wide: true });
}

function renderCitationModal() {
  const citation = (state.knowledgeCitations || []).find((item) => item.id === ui.modal.citationId);
  const article = state.articles.find((item) => item.id === (ui.modal.articleId || citation?.articleId));
  if (!citation || !article) return "";
  const base = knowledgeBaseById(citation.baseId || citation.knowledgeBaseId);
  const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
  const version = knowledgeVersionById(citation.versionId || citation.knowledgeVersionId);
  const currentVersion = knowledgeVersionById(item?.latestVersionId);
  const outdated = currentVersion && version && currentVersion.id !== version.id;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">引用证据 ${escapeHtml(citation.marker || "K")}</h2><p>${escapeHtml(article.title)} · ${escapeHtml(article.version)}</p></div><button class="icon-button" type="button" data-action="back-article" data-article-id="${article.id}" aria-label="返回文章"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${outdated ? '<div class="knowledge-update-banner"><span data-icon="history"></span><div><b>知识已有新版本</b><p>本文仍引用 v' + escapeHtml(version.version) + '，不会自动替换为 v' + escapeHtml(currentVersion.version) + '。</p></div></div>' : ""}
      <div class="citation-proof"><span>已冻结的知识原文</span><blockquote>${escapeHtml(citation.quote || citation.excerpt || version?.content || "")}</blockquote></div>
      <div class="citation-map"><span><small>知识库</small><b>${escapeHtml(base?.name || "未知知识库")}</b></span><span><small>资料 / 问答</small><b>${escapeHtml(item?.title || item?.question || "未知条目")}</b></span><span><small>冻结版本</small><b>v${escapeHtml(version?.version || citation.knowledgeVersion || "1")}</b></span><span><small>原文定位</small><b>${escapeHtml(citation.locator || knowledgeLocator(item || {}, version))}</b></span><span><small>正文位置</small><b>${escapeHtml(citation.articleSection || citation.paragraphId || "文章正文")}</b></span><span><small>核验状态</small><b>${citation.status === "needs_review" ? "待重新核验" : "证据支持"}</b></span></div>
      <div class="privacy-note"><span data-icon="lock"></span><span>此证据保存了知识库、知识条目、版本、原文片段和正文位置。知识库更新不会静默改动已经审核或发布的文章。</span></div>
    </div>
    <div class="modal-foot"><span>${escapeHtml(knowledgeSourceLabel(item || {}, version))} · ${escapeHtml(knowledgeLocator(item || {}, version))}</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="back-article" data-article-id="${article.id}">返回文章</button></div></div>
  `);
}
