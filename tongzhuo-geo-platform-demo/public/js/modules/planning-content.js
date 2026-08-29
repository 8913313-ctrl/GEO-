
function renderPlanningArchive() {
  const line = activeBusinessLine();
  const kind = ui.planningArchiveKind === "topics" ? "topics" : "questions";
  const archivedQuestions = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.status === "archived");
  const archivedTopics = state.topics.filter((topic) => topicBusinessLineId(topic) === line?.id && topic.status === "archived");
  const rows = kind === "questions"
    ? archivedQuestions.map((question) => {
      const refs = planningQuestionReferences(question);
      const referenceText = `${refs.topics.length} 选题 · ${refs.plans.length} 计划 · ${refs.articles.length} 文章`;
      const canDelete = !question.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length;
      return `<tr class="topic-row-archived"><td class="article-title-cell"><b>${escapeHtml(question.question)}</b><small>${escapeHtml(question.id)} · v${escapeHtml(question.version || 1)} · 归档于 ${formatRelative(question.archivedAt || question.updatedAt || question.createdAt)}</small></td><td>${escapeHtml(question.sourceKeyword || "—")}</td><td><span class="status-badge status-archived">已归档</span></td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions"><button class="secondary-button button-small" type="button" data-action="restore-planning-record" data-kind="question" data-record-id="${escapeHtml(question.id)}"><span data-icon="refresh"></span>恢复</button>${refs.topics.length || refs.plans.length || refs.articles.length ? `<button class="link-button" type="button" data-action="view-planning-relations" data-kind="question" data-record-id="${escapeHtml(question.id)}">引用详情</button>` : ""}<button class="danger-button button-small" type="button" data-action="request-delete-archive" data-kind="question" data-record-id="${escapeHtml(question.id)}" ${canDelete ? "" : "disabled"}>永久删除</button></div></td></tr>`;
    }).join("")
    : (ui.archiveTopicSort ? sortByPriority(archivedTopics, (topic) => topic.recommendation, ui.archiveTopicSort) : archivedTopics).map((topic) => {
      const refs = planningTopicReferences(topic);
      const referenceText = `${refs.plans.length} 计划 · ${refs.articles.length} 文章`;
      const canDelete = !refs.plans.length && !refs.articles.length;
      const brief = topic.geoBrief || buildGeoTopicBrief(topic, refs.question);
      const coreQuestion = topic.coreQuestion || brief.coreQuestion || refs.question?.question || topic.title || "—";
      return `<tr class="topic-row-archived"><td class="article-title-cell"><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)} · 归档于 ${formatRelative(topic.archivedAt || topic.updatedAt || topic.createdAt)}</small></td><td>${escapeHtml(coreQuestion)}</td><td><span class="source-tag">${escapeHtml(DIMENSIONS.find((item) => item.id === topic.dimension)?.label || topic.dimension || "未分类")}</span></td><td>${priorityScoreCell(topic.recommendation)}</td><td><span class="status-badge status-archived">已归档</span></td><td><span class="topic-reference-count">${escapeHtml(referenceText)}</span></td><td><div class="table-actions topic-row-actions"><button class="secondary-button button-small" type="button" data-action="restore-planning-record" data-kind="topic" data-record-id="${escapeHtml(topic.id)}"><span data-icon="refresh"></span>恢复</button>${refs.plans.length || refs.articles.length ? `<button class="link-button" type="button" data-action="view-planning-relations" data-kind="topic" data-record-id="${escapeHtml(topic.id)}">引用详情</button>` : ""}<button class="danger-button button-small" type="button" data-action="request-delete-archive" data-kind="topic" data-record-id="${escapeHtml(topic.id)}" ${canDelete ? "" : "disabled"}>永久删除</button></div></td></tr>`;
    }).join("");
  const total = archivedQuestions.length + archivedTopics.length;
  const table = kind === "questions"
    ? `<table class="data-table topic-center-table topic-management-table"><thead><tr><th>问题</th><th>来源关键词</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<table class="data-table topic-center-table topic-management-table"><thead><tr><th>选题</th><th>核心回答问题</th><th>内容方向</th><th>${sortableHeader("优先级", "archive-topic", "priority", ui.archiveTopicSort)}</th><th>状态</th><th>引用关系</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<section class="archive-summary"><article class="card summary-card"><span data-icon="archive"></span><div><b>${total}</b><small>当前业务线归档项</small></div></article><article class="card summary-card"><span class="amber" data-icon="help"></span><div><b>${archivedQuestions.length}</b><small>归档问题</small></div></article><article class="card summary-card"><span class="purple" data-icon="clipboard"></span><div><b>${archivedTopics.length}</b><small>归档选题</small></div></article></section><section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 归档管理</h3><p>归档项不参与新的选题计划和文章生成，历史计划、文章与来源关系继续保留。</p></div><span class="small-tag blue">${total} 项</span></div><div class="archive-type-tabs" role="tablist"><button class="tab-button ${kind === "questions" ? "active" : ""}" type="button" data-action="planning-archive-kind" data-kind="questions">已归档问题 · ${archivedQuestions.length}</button><button class="tab-button ${kind === "topics" ? "active" : ""}" type="button" data-action="planning-archive-kind" data-kind="topics">已归档选题 · ${archivedTopics.length}</button></div>${rows ? `<div class="table-scroll">${table}</div>` : '<div class="archive-empty empty-state"><div><span data-icon="archive"></span><h3>这里还没有归档项</h3><p>在问题词库或选题库中归档后，可以在这里恢复。</p></div></div>'}</section>`;
}

function planStatusBadge(status) {
  const meta = { draft: ["待排期", "status-draft"], planned: ["待执行", "status-publishing"], produced: ["已创建内容", "status-approved"], completed: ["已完成", "status-success"] }[status] || [status, "status-draft"];
  return '<span class="status-badge ' + meta[1] + '">' + escapeHtml(meta[0]) + "</span>";
}

function renderContentPlans() {
  const line = activeBusinessLine();
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === line?.id);
  const rows = plans.map((plan) => {
    const { scope, approved } = planKnowledgeSummary(plan);
    const changes = scope.addedBaseIds.length || scope.excludedBaseIds.length ? `增补 ${scope.addedBaseIds.length} · 排除 ${scope.excludedBaseIds.length}` : "按默认知识包";
    const agentSnapshot = plan.writingAgentSnapshot;
    const agentCurrent = writingAgentById(agentSnapshot?.agentId || plan.writingAgentId);
    const versionHint = agentCurrent && Number(agentCurrent.version) > Number(agentSnapshot?.version || 0) ? " · 有新版" : "";
    const agentCell = agentSnapshot ? `<b>${escapeHtml(agentSnapshot.nameSnapshot)}</b><small class="block-subtext">v${escapeHtml(agentSnapshot.version)}${versionHint}</small>` : '<span class="status-badge status-review">未选择</span>';
    return `<tr><td class="article-title-cell"><b>${escapeHtml(plan.name)}</b><small>${plan.id} · 创建于 ${formatRelative(plan.createdAt)}</small></td><td><b>${plan.topicIds.length}</b> 个选题</td><td>${agentCell}</td><td><button class="knowledge-count-button" type="button" data-action="preview-plan-knowledge" data-plan-id="${plan.id}"><b>${scope.resolvedBaseIds.length}</b> 库 · <b>${approved}</b> 条</button><small class="block-subtext">${changes}</small></td><td>${escapeHtml(plan.scheduledFor)}</td><td>${escapeHtml(plan.owner)}</td><td>${escapeHtml(plan.contentType)}</td><td>${planStatusBadge(plan.status)}</td><td><button class="link-button" type="button" data-action="${plan.status === "produced" ? "view-plan-content" : "execute-plan"}" data-plan-id="${plan.id}">${plan.status === "produced" ? "查看内容" : "创建内容任务"}</button></td></tr>`;
  }).join("");
  const planned = plans.filter((plan) => ["draft", "planned"].includes(plan.status)).length;
  const produced = plans.filter((plan) => plan.status === "produced").length;
  return `
    <section class="topic-plan-summary"><article class="card summary-card"><span data-icon="clock"></span><div><b>${plans.length}</b><small>全部计划</small></div></article><article class="card summary-card"><span class="amber" data-icon="clipboard"></span><div><b>${planned}</b><small>等待执行</small></div></article><article class="card summary-card"><span class="green" data-icon="file"></span><div><b>${produced}</b><small>已创建内容</small></div></article></section>
    <section class="card table-card planning-library-panel"><div class="card-header"><div><h3>${escapeHtml(line?.name || "业务线")} · 内容计划</h3><p>计划同时冻结选题来源、写作智能体版本和企业知识范围，再创建文章任务。</p></div><button class="secondary-button button-small" type="button" data-action="planning-tab" data-tab="topics"><span data-icon="plus"></span>从选题创建</button></div><div class="table-scroll"><table class="data-table topic-center-table"><thead><tr><th>计划</th><th>选题</th><th>写作智能体</th><th>知识范围</th><th>计划日期</th><th>负责人</th><th>形式</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>${rows ? "" : '<div class="empty-state"><div><span data-icon="clock"></span><h3>还没有内容计划</h3><p>先到选题库选择选题，再安排日期、负责人、写作智能体和知识范围。</p><button class="primary-button button-small" type="button" data-action="planning-tab" data-tab="topics">去选题库</button></div></div>'}</section>
  `;
}

function renderPlanning() {
  const actions = ui.planningTab === "keywords"
    ? '<button class="secondary-button" type="button" data-action="export-pack"><span data-icon="download"></span>导出词包</button><button class="primary-button" type="button" data-action="focus-business-keyword"><span data-icon="plus"></span>扩展关键词</button>'
    : ui.planningTab === "questions"
      ? '<button class="primary-button" type="button" data-action="focus-question"><span data-icon="plus"></span>手动添加问题</button>'
      : ui.planningTab === "topics"
        ? '<button class="primary-button" type="button" data-action="open-plan"><span data-icon="clock"></span>创建内容计划</button>'
        : ui.planningTab === "plans"
          ? '<button class="primary-button" type="button" data-action="planning-tab" data-tab="topics"><span data-icon="plus"></span>从选题创建计划</button>'
          : '<button class="secondary-button" type="button" data-action="planning-archive-kind" data-kind="questions"><span data-icon="help"></span>查看归档问题</button>';
  const panel = ui.planningTab === "keywords" ? renderKeywordWorkspace() : ui.planningTab === "questions" ? renderQuestionLibrary() : ui.planningTab === "topics" ? renderTopicLibrary() : ui.planningTab === "plans" ? renderContentPlans() : renderPlanningArchive();
  return `<div class="page-container planning-page-shell planning-workbench-page"><header class="page-head page-head-terminal planning-workbench-head"><div><h2>问题研究</h2><p>从客户问题与搜索需求中发现内容机会，并将确认结果推进到选题与生产计划。</p></div><div class="planning-head-actions">${actions}</div></header><div class="planning-workspace page-workspace-surface"><section class="planning-workflow-nav"><div class="planning-workflow-meta"><span>研究流程</span><span class="health"><i></i>来源链完整</span></div>${planningLifecycle()}</section>${renderBusinessScope()}<main class="planning-workbench-body">${panel}</main></div></div>`;
}

function contentSectionTabs() {
  const items = [
    ["studio", "创作工作区", "edit", "直接生成"],
    ["articles", "文章管理", "file", state.articles.length],
    ["agents", "生产配置", "sparkle", (state.writingAgents || []).filter((agent) => agent.status === "active").length]
  ];
  return '<div class="content-section-tabs" role="tablist">' + items.map(([id, label, iconName, count]) => `<button class="${ui.contentView === id ? "active" : ""}" type="button" data-action="content-view" data-view="${id}"><span data-icon="${iconName}"></span><span><b>${label}</b><small>${id === "studio" ? count : count + (id === "articles" ? " 篇" : " 个启用")}</small></span></button>`).join("") + "</div>";
}

function contentPageShell(body, actions = "") {
  const line = activeBusinessLine();
  return `<div class="page-container content-page-container">${pageHead("内容生产", `${line?.name || "当前业务线"} · 管理创作工作区、生成任务、文章版本与审核冻结。`, actions)}<div class="tabs-row topic-center-tab-row content-section-tabs-row">${contentSectionTabs()}<span class="health"><i></i>${ui.contentView === "studio" ? "自动保存会话" : "内容任务工作区"}</span></div>${body}</div>`;
}

function writingAgentCard(agent) {
  const lineNames = !agent.businessLineIds?.length
    ? ["全部业务线"]
    : agent.businessLineIds.map((id) => state.businessLines.find((line) => line.id === id)?.name).filter(Boolean);
  const defaultLines = state.businessLines.filter((line) => line.status === "active" && line.defaultWritingAgentId === agent.id).map((line) => line.name);
  const usage = writingAgentUsageCount(agent.id) || agent.usageCount || 0;
  const inactive = agent.status !== "active";
  const actions = agent.builtIn
    ? `<button class="secondary-button button-small" type="button" data-action="open-writing-agent" data-agent-id="${agent.id}">查看配置</button><button class="primary-button button-small" type="button" data-action="copy-writing-agent" data-agent-id="${agent.id}">复制后编辑</button>`
    : `<button class="secondary-button button-small" type="button" data-action="open-writing-agent" data-agent-id="${agent.id}">编辑</button><button class="ghost-button button-small" type="button" data-action="copy-writing-agent" data-agent-id="${agent.id}">复制</button><button class="ghost-button button-small" type="button" data-action="toggle-writing-agent" data-agent-id="${agent.id}">${inactive ? "恢复" : "停用"}</button>`;
  return `
    <article class="card writing-agent-card ${inactive ? "inactive" : ""}">
      <div class="writing-agent-card-head">
        <span class="writing-agent-avatar ${escapeHtml(agent.color || "blue")}">${escapeHtml(agent.avatar || agent.name.slice(0, 1))}</span>
        <div class="writing-agent-title"><div><h3>${escapeHtml(agent.name)}</h3>${agent.builtIn ? '<span class="small-tag blue">系统内置</span>' : '<span class="small-tag teal">企业自建</span>'}${inactive ? '<span class="status-badge status-draft">已停用</span>' : '<span class="status-badge status-approved">启用中</span>'}</div><p>${escapeHtml(agent.description)}</p></div>
        <span class="writing-agent-version">v${escapeHtml(agent.version)}</span>
      </div>
      <div class="writing-agent-profile"><div><span>写作角色</span><b>${escapeHtml(agent.role)}</b></div><div><span>风格</span><b>${escapeHtml(agent.style)}</b></div><div><span>知识规则</span><b>${agent.strictKnowledge ? "严格知识 · " : "普通知识 · "}${agent.citationsRequired ? "逐条引用" : "不强制引用"}</b></div></div>
      <div class="writing-agent-tags">${lineNames.map((name) => '<span class="small-tag">' + escapeHtml(name) + '</span>').join("")}${(agent.contentTypes || []).map((type) => '<span class="small-tag blue">' + escapeHtml(type) + '</span>').join("")}</div>
      ${defaultLines.length ? '<div class="agent-default-note"><span data-icon="check"></span>' + escapeHtml(defaultLines.join("、")) + ' 默认使用</div>' : ""}
      <div class="writing-agent-card-foot"><span>使用 ${usage} 次 · 更新于 ${formatRelative(agent.updatedAt)}</span><div>${actions}${agent.status === "active" && writingAgentSupports(agent, activeBusinessLine()?.id) && !defaultLines.includes(activeBusinessLine()?.name) ? '<button class="text-button" type="button" data-action="set-default-writing-agent" data-agent-id="' + agent.id + '">设为当前业务线默认</button>' : ""}</div></div>
    </article>
  `;
}

function renderWritingAgents() {
  const builtIn = (state.writingAgents || []).filter((agent) => agent.builtIn).map(writingAgentCard).join("");
  const custom = (state.writingAgents || []).filter((agent) => !agent.builtIn).map(writingAgentCard).join("");
  return `
    <section class="writing-agent-principle"><span data-icon="info"></span><div><b>写作智能体决定怎么写</b><p>企业知识决定依据什么事实写，AI 模型决定用什么执行。智能体只能在内容计划冻结的知识范围内调整写法和召回顺序。</p></div></section>
    <section class="writing-agent-group"><div class="writing-agent-group-head"><div><h3>系统内置</h3><p>稳定的基础写作能力不可直接修改，可以复制成企业自己的版本。</p></div><span>${(state.writingAgents || []).filter((agent) => agent.builtIn).length} 个</span></div><div class="writing-agent-grid">${builtIn}</div></section>
    <section class="writing-agent-group"><div class="writing-agent-group-head"><div><h3>企业自建</h3><p>按业务、内容类型和品牌口吻维护；修改后版本递增，历史文章继续使用原快照。</p></div><span>${(state.writingAgents || []).filter((agent) => !agent.builtIn).length} 个</span></div><div class="writing-agent-grid">${custom || '<div class="card empty-state"><div><span data-icon="sparkle"></span><h3>还没有自定义智能体</h3><p>复制系统模板或从零创建一个。</p></div></div>'}</div></section>
  `;
}

function studioWorkspaceById(workspaceId) {
  return (state.writingWorkspaces || []).find((workspace) => workspace.id === workspaceId) || null;
}

function studioConversationById(conversationId) {
  return (state.aiConversations || []).find((conversation) => conversation.id === conversationId) || null;
}

function studioConversationForWorkspace(workspace) {
  if (!workspace) return null;
  return studioConversationById(workspace.conversationId) || (state.aiConversations || []).find((conversation) => conversation.workspaceId === workspace.id) || null;
}

function studioArticleForWorkspace(workspace) {
  return workspace?.articleId ? state.articles.find((article) => article.id === workspace.articleId) || null : null;
}

function studioContentHash(content) {
  const value = String(content || "").replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "h" + (hash >>> 0).toString(36);
}

function studioWorkspaceTopic(workspace, article = studioArticleForWorkspace(workspace)) {
  if (article?.topicSnapshot) return article.topicSnapshot;
  const linked = article?.topicId ? state.topics.find((topic) => topic.id === article.topicId) : null;
  return linked || workspace?.topic || { source: "custom", id: null, title: "", keyword: "", intent: "直接创作" };
}

function studioKnowledgeBases(workspace) {
  const scopeIds = workspace?.knowledgeScope?.resolvedBaseIds || [];
  return scopeIds.map(knowledgeBaseById).filter((base) => base && base.status !== "archived");
}

function studioApprovedKnowledgeEntries(workspace) {
  return studioKnowledgeBases(workspace).flatMap((base) => approvedKnowledgeItems(base.id).map((item) => ({
    base,
    item,
    version: knowledgeVersionById(item.latestVersionId)
  }))).filter((entry) => entry.version);
}

function studioKnowledgeAssets(workspace) {
  const scopedBaseIds = new Set(workspace?.knowledgeScope?.resolvedBaseIds || []);
  return (state.contentAssets || []).filter((asset) => {
    if (asset.kind !== "knowledge_image" || asset.archived || asset.reviewStatus !== "approved") return false;
    // Only server-backed assets have a real binary file and a durable source
    // record. Images are tenant-wide creative material: a business-line scope
    // boosts recommendations but does not hide the enterprise media library.
    // Legacy demo cards intentionally do not enter the writing picker.
    return Boolean(asset.serverBackedKnowledgeAsset);
  }).sort((left, right) => Number(scopedBaseIds.has(right.knowledgeBaseId)) - Number(scopedBaseIds.has(left.knowledgeBaseId)));
}

function studioAssetSearchText(asset) {
  const metadata = asset?.metadata || {};
  const base = knowledgeBaseById(asset?.knowledgeBaseId);
  return [
    asset?.name,
    asset?.altText,
    asset?.caption,
    asset?.license,
    base?.name,
    metadata.caption,
    metadata.category,
    metadata.sourceRole,
    ...(Array.isArray(metadata.tags) ? metadata.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function studioAssetRecommendationScore(asset, workspace) {
  const article = studioArticleForWorkspace(workspace);
  const context = [
    article?.title,
    studioPlainText(article?.content || ""),
    workspace?.draftTitle,
    workspace?.draftContent,
    workspace?.topic?.title,
    workspace?.topic?.keyword,
    ui.studioComposerDraft
  ].filter(Boolean).join(" ").toLowerCase();
  if (!context) return 0;
  const metadata = asset?.metadata || {};
  const tokens = [
    ...(Array.isArray(metadata.tags) ? metadata.tags : []),
    metadata.category,
    asset?.altText,
    String(asset?.name || "").replace(/\.[^.]+$/, "").split(/[\s_\-—、，,。.（）()]+/)
  ].flat().map((token) => String(token || "").trim().toLowerCase()).filter((token) => token.length >= 2);
  return [...new Set(tokens)].reduce((score, token) => score + (context.includes(token) ? Math.min(8, token.length) : 0), 0);
}

function studioAssetInsertionIndex() {
  const editor = document.getElementById("studio-content-editor");
  if (!editor) return null;
  const selection = window.getSelection?.();
  if (!selection?.rangeCount) return editor.children.length;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return editor.children.length;
  if (range.startContainer === editor) return Math.max(0, Math.min(editor.children.length, range.startOffset));
  let block = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  while (block?.parentElement && block.parentElement !== editor) block = block.parentElement;
  const index = [...editor.children].indexOf(block);
  return index < 0 ? editor.children.length : index + 1;
}

function createStudioWorkspace(article = null) {
  const linkedPlan = contentPlanForArticle(article);
  const line = state.businessLines.find((item) => item.id === (article?.businessLineId || linkedPlan?.businessLineId)) || activeBusinessLine();
  const knownContentTypes = ["深度文章", "问答文章", "案例解读", "系列文章"];
  const contentType = linkedPlan?.contentType || (knownContentTypes.includes(article?.category) ? article.category : "深度文章");
  const agentSnapshot = cloneData(article?.generationSnapshot?.writingAgent);
  const agent = writingAgentById(agentSnapshot?.agentId) || defaultAgentForLine(line, contentType);
  const inheritedBaseIds = article?.knowledgeSnapshot?.resolvedBaseIds || inheritedKnowledgeBaseIds(line);
  const now = Date.now();
  const workspaceId = uid("WS");
  const conversationId = uid("CHAT");
  const linkedTopic = article?.topicId ? state.topics.find((topic) => topic.id === article.topicId) : null;
  const topic = cloneData(article?.topicSnapshot || linkedTopic || { source: "custom", id: null, title: "", keyword: "", intent: "直接创作" });
  const snapshot = agentSnapshot || snapshotWritingAgent(agent, { selectionSource: article ? "article_workspace" : "quick_create" });
  const workspace = {
    id: workspaceId,
    mode: article ? "article" : "quick",
    sourceType: article?.sourceType || (article ? "content_task" : "quick_create"),
    articleId: article?.id || null,
    status: article ? "draft" : "blank",
    businessLineId: line?.id || null,
    businessLineSnapshot: line ? { id: line.id, name: line.name, product: line.product } : null,
    topic,
    draftTitle: article ? "" : (topic.title || ""),
    draftContent: "",
    draftContentHtml: "",
    contentType,
    knowledgeScope: {
      inheritedBaseIds: cloneData(inheritedBaseIds),
      addedBaseIds: cloneData(article?.knowledgeSnapshot?.addedBaseIds || []),
      excludedBaseIds: cloneData(article?.knowledgeSnapshot?.excludedBaseIds || []),
      resolvedBaseIds: cloneData(inheritedBaseIds),
      snapshottedAt: new Date(now).toISOString(),
      lockedVersionIds: cloneData(article?.knowledgeSnapshot?.lockedVersionIds || [])
    },
    selectedKnowledgeBaseIds: cloneData(inheritedBaseIds),
    selectedKnowledgeItemIds: [],
    writingAgentId: snapshot?.agentId || agent?.id || null,
    writingAgentSnapshot: snapshot,
    conversationId,
    attachmentIds: [],
    assetIds: cloneData(article?.assetIds || []),
    createdAt: now,
    updatedAt: now
  };
  const conversation = {
    id: conversationId,
    workspaceId,
    articleId: article?.id || null,
    status: "active",
    selectedAgentId: agent?.id || snapshot?.agentId || null,
    selectedKnowledgeBaseIds: cloneData(inheritedBaseIds),
    selectedKnowledgeItemIds: [],
    webSearchEnabled: false,
    attachments: [],
    imageIds: cloneData(article?.assetIds || []),
    messages: [{
      id: uid("MSG"),
      role: "assistant",
      text: article
        ? "文章已载入创作台。我会基于当前版本、已冻结的企业知识和你选择的写作智能体提出修改建议；在你点击应用前，我不会改动正文。"
        : "告诉我这篇文章要解决的问题。生成初稿后，你可以继续让我调整结构、标题或段落；所有建议都会先预览，再由你决定是否应用。",
      createdAt: now,
      agentSnapshot: snapshot,
      contextSnapshot: { businessLineId: line?.id || null, articleVersion: article?.version || null, knowledgeBaseIds: cloneData(inheritedBaseIds), webSearchEnabled: false }
    }],
    createdAt: now,
    updatedAt: now
  };
  state.writingWorkspaces = state.writingWorkspaces || [];
  state.aiConversations = state.aiConversations || [];
  state.writingWorkspaces.unshift(workspace);
  state.aiConversations.unshift(conversation);
  if (article) {
    article.workspaceId = workspace.id;
    article.sourceType = article.sourceType || "content_task";
  }
  return workspace;
}

function ensureStudioWorkspace(articleId = null, forceNew = false) {
  let article = articleId ? state.articles.find((item) => item.id === articleId) : null;
  let workspace = null;
  if (article && !forceNew) workspace = studioWorkspaceById(article.workspaceId) || (state.writingWorkspaces || []).find((item) => item.articleId === article.id) || null;
  if (!article && !forceNew) workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace) workspace = createStudioWorkspace(article);
  article = studioArticleForWorkspace(workspace);
  const conversation = studioConversationForWorkspace(workspace);
  if (ui.studioWorkspaceId !== workspace.id) ui.studioPicker = null;
  ui.studioWorkspaceId = workspace.id;
  ui.studioArticleId = article?.id || null;
  ui.studioTopicDraft = workspace.topic?.title || "";
  ui.studioContentType = workspace.contentType || article?.category || "深度文章";
  ui.studioAgentId = conversation?.selectedAgentId || workspace.writingAgentId || null;
  ui.studioWebSearch = Boolean(conversation?.webSearchEnabled);
  saveState();
  return workspace;
}

function openContentStudio(articleId = null, options = {}) {
  ui.studioPicker = null;
  ensureStudioWorkspace(articleId, Boolean(options.forceNew));
  ui.contentView = "studio";
  ui.studioPane = "editor";
  ui.studioComposerDraft = "";
  closeModal();
  navigate("content");
  window.setTimeout(() => {
    const target = document.getElementById("studio-title-editor") || document.getElementById("studio-composer-input");
    target?.focus();
  }, 40);
}

function renderStudioMessage(message, conversation) {
  const role = message.role || "assistant";
  const agent = message.agentSnapshot;
  const avatar = role === "user" ? "我" : role === "system" ? "系" : escapeHtml(writingAgentById(agent?.agentId)?.avatar || agent?.nameSnapshot?.slice(0, 1) || "AI");
  const sources = (message.sources || []).map((source, index) => `<div class="studio-source-card ${source.sourceType === "web" ? "web" : ""}"><b>${source.sourceType === "web" ? "WEB" + (index + 1) : "K" + (index + 1)}</b><span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.meta || source.url || "企业知识")}</small></span></div>`).join("");
  const proposal = message.proposal;
  const proposalHtml = proposal ? `<section class="studio-proposal-card"><header><strong>${escapeHtml(proposal.label || "AI 修改建议")}</strong><small>${proposal.status === "applied" ? "已应用到 " + escapeHtml(proposal.appliedVersion || "当前版本") : proposal.status === "discarded" ? "已放弃" : "尚未修改正文"}</small></header><div class="studio-proposal-diff"><div class="remove">原结构：${escapeHtml(proposal.before || "当前正文")}</div><div class="add">建议结构：${escapeHtml(proposal.after || proposal.title || "新方案")}</div></div>${proposal.status === "pending" ? `<div class="studio-proposal-actions"><button class="primary-button" type="button" data-action="apply-studio-proposal" data-message-id="${message.id}"><span data-icon="check"></span>${proposal.kind === "title" ? "采用标题" : proposal.kind === "insert" ? "插入正文" : "应用到正文"}</button><button class="secondary-button" type="button" data-action="copy-studio-proposal" data-message-id="${message.id}">仅复制</button><button class="ghost-button" type="button" data-action="discard-studio-proposal" data-message-id="${message.id}">放弃</button></div>` : ""}</section>` : "";
  const attachmentNote = (message.attachments || []).length ? `<p><small>本次参考附件：${message.attachments.map((item) => escapeHtml(item.name)).join("、")}（临时资料，未进入企业知识库）</small></p>` : "";
  return `<div class="studio-message ${role}">${role === "user" ? "" : `<span class="studio-message-avatar">${avatar}</span>`}<div class="studio-message-card"><p>${escapeHtml(message.text || "").replace(/\n/g, "<br>")}</p>${attachmentNote}${sources}${proposalHtml}</div>${role === "user" ? `<span class="studio-message-avatar">${avatar}</span>` : ""}</div>`;
}

function renderStudioPicker(workspace, conversation) {
  if (!ui.studioPicker) return "";
  if (ui.studioPicker === "knowledge") {
    const selected = new Set(conversation?.selectedKnowledgeItemIds || []);
    const rows = studioApprovedKnowledgeEntries(workspace).map(({ base, item, version }) => `<button class="studio-picker-item ${selected.has(item.id) ? "selected" : ""}" type="button" data-action="toggle-studio-knowledge" data-item-id="${item.id}"><span class="studio-picker-thumb" data-icon="${base.kind === "qa" ? "help" : "book"}"></span><span><b>${escapeHtml(item.title || item.question)}</b><small>${escapeHtml(base.name)} · v${escapeHtml(version.version)} · 可用</small></span><em>${selected.has(item.id) ? "已引用" : "引用"}</em></button>`).join("");
    return `<div class="studio-inline-picker"><div class="studio-picker-head"><div><h4>引用企业知识 / 文件</h4><p>只显示当前业务线授权范围内可用的资料版本</p></div><button class="icon-button" type="button" data-action="close-studio-picker"><span data-icon="x"></span></button></div><div class="studio-picker-list">${rows || '<div class="studio-empty-chat"><div><span data-icon="book"></span><b>没有可引用知识</b><p>请先在企业知识中上传资料。</p></div></div>'}</div></div>`;
  }
  if (ui.studioPicker === "knowledge-image") {
    const search = String(ui.studioAssetSearch || "").trim().toLowerCase();
    const assets = studioKnowledgeAssets(workspace).map((asset) => ({ asset, score: studioAssetRecommendationScore(asset, workspace), searchText: studioAssetSearchText(asset) }))
      .sort((left, right) => right.score - left.score || Number(right.asset.createdAt || 0) - Number(left.asset.createdAt || 0));
    const visibleCount = assets.filter((entry) => !search || entry.searchText.includes(search)).length;
    const recommendedCount = assets.filter((entry) => entry.score > 0).length;
    const rows = assets.map(({ asset, score, searchText }) => {
      const base = knowledgeBaseById(asset.knowledgeBaseId);
      const hidden = search && !searchText.includes(search) ? " hidden" : "";
      return `<button class="studio-picker-item studio-asset-result" type="button" data-action="insert-studio-asset" data-asset-id="${escapeHtml(asset.id)}" data-studio-asset-searchable="${escapeHtml(searchText)}"${hidden}>${asset.url ? `<img class="studio-picker-image" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || asset.name)}" loading="lazy" />` : `<span class="studio-picker-thumb ${escapeHtml(asset.accent || "blue")}" data-icon="image"></span>`}<span><b>${escapeHtml(asset.name)}</b><small>${score > 0 ? '<span class="studio-picker-ai-badge">AI 推荐</span> · ' : ""}${escapeHtml(base?.name || "企业图片")} · ${escapeHtml(asset.caption || asset.altText || "来源已记录")}</small></span><em>插入</em></button>`;
    }).join("");
    const empty = assets.length
      ? `<div class="studio-picker-no-results" data-studio-asset-empty ${visibleCount ? "hidden" : ""}><span data-icon="search"></span><b>没有匹配的图片</b><p>换一个名称、说明或标签试试。</p></div>`
      : '<div class="studio-empty-chat"><div><span data-icon="image"></span><b>没有可用图片</b><p>当前业务线知识库中暂无可用图片，可先上传到图片资料库。</p></div></div>';
    return `<div class="studio-inline-picker studio-asset-picker" role="dialog" aria-label="插入图片资料"><div class="studio-picker-head"><div><h4>图片资料库</h4><p>搜索、选择后插入到当前光标所在段落</p></div><button class="icon-button" type="button" data-action="close-studio-picker" aria-label="关闭图片资料库"><span data-icon="x"></span></button></div><label class="studio-picker-search"><span>搜索图片资料</span><div><span data-icon="search"></span><input id="studio-asset-search" type="search" value="${escapeHtml(ui.studioAssetSearch || "")}" placeholder="名称、说明或标签" autocomplete="off" data-studio-asset-search /></div></label><div class="studio-picker-summary"><span><b data-studio-asset-result-count>${visibleCount}</b> 张可选</span>${recommendedCount ? `<span><span data-icon="sparkle"></span>AI 已按当前文章推荐 ${recommendedCount} 张</span>` : ""}</div><div class="studio-picker-list">${rows}${empty}</div><div class="studio-picker-foot"><button class="secondary-button button-small" type="button" data-action="trigger-studio-image-upload"><span data-icon="upload"></span>上传并立即入库</button><span>无需逐张审核</span></div></div>`;
  }
  return `<div class="studio-inline-picker"><div class="studio-picker-head"><div><h4>插入图片</h4><p>图片会保留来源、版权和知识库关联</p></div><button class="icon-button" type="button" data-action="close-studio-picker"><span data-icon="x"></span></button></div><div class="studio-picker-list"><button class="studio-picker-item" type="button" data-action="generate-studio-image"><span class="studio-picker-thumb" data-icon="sparkle"></span><span><b>AI 配图占位（演示）</b><small>创建待确认的配图占位；正式部署后接入图片生成与对象存储</small></span><em>生成</em></button><button class="studio-picker-item" type="button" data-action="trigger-studio-image-upload"><span class="studio-picker-thumb" data-icon="upload"></span><span><b>上传到当前知识库</b><small>图片会立即保存到当前业务线知识库，可直接作为文章配图</small></span><em>上传</em></button><button class="studio-picker-item" type="button" data-action="open-studio-knowledge-images"><span class="studio-picker-thumb" data-icon="database"></span><span><b>从知识库图片选择</b><small>只使用当前知识范围内的企业图片</small></span><em>选择</em></button></div></div>`;
}

function renderStudioChat(workspace, conversation, article) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const selectedAgent = writingAgentById(conversation?.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  const agents = activeWritingAgents(line?.id, workspace.contentType || article?.category || null);
  const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
  let messages = (conversation?.messages || []).map((message) => renderStudioMessage(message, conversation)).join("");
  if (ui.studioGenerating && !article) messages += '<div class="studio-message assistant studio-generating-message"><span class="studio-message-avatar">AI</span><div class="studio-message-card is-thinking"><span>正在检索企业知识并撰写初稿</span></div></div>';
  const knowledgeChips = (conversation?.selectedKnowledgeItemIds || []).map((itemId) => knowledgeItemById(itemId)).filter(Boolean).map((item) => `<span class="studio-selection-chip"><span data-icon="book"></span><b>${escapeHtml(item.title || item.question)}</b><button type="button" data-action="remove-studio-context" data-kind="knowledge" data-id="${item.id}"><span data-icon="x"></span></button></span>`).join("");
  const attachmentChips = (workspace.attachmentIds || []).map((assetId) => (state.contentAssets || []).find((asset) => asset.id === assetId)).filter(Boolean).map((asset) => `<span class="studio-selection-chip"><span data-icon="paperclip"></span><b>${escapeHtml(asset.name)}</b><button type="button" data-action="remove-studio-context" data-kind="attachment" data-id="${asset.id}"><span data-icon="x"></span></button></span>`).join("");
  const imageChips = (conversation?.imageIds || []).map((assetId) => (state.contentAssets || []).find((asset) => asset.id === assetId)).filter(Boolean).map((asset) => `<span class="studio-selection-chip"><span data-icon="image"></span><b>${escapeHtml(asset.name)}</b><button type="button" data-action="remove-studio-context" data-kind="image" data-id="${asset.id}"><span data-icon="x"></span></button></span>`).join("");
  return `<aside class="studio-chat-panel"><div class="studio-chat-head"><div><h3>AI 协作</h3><p>先给建议，再由你决定是否写入正文</p></div><div class="studio-chat-head-actions"><button class="icon-button" type="button" data-action="new-studio-conversation" title="新对话"><span data-icon="plus"></span></button><button class="icon-button" type="button" data-action="studio-pane" data-pane="info" title="文章信息"><span data-icon="info"></span></button></div></div><div class="studio-chat-context"><b>${article ? "当前全文" : "创作准备"}</b><span class="studio-context-chip blue"><span data-icon="sparkle"></span><b>${escapeHtml(selectedAgent?.name || "未选择智能体")}</b></span>${conversation?.webSearchEnabled ? '<span class="studio-context-chip teal"><span data-icon="globe"></span><b>联网检索演示</b></span>' : ""}</div><div class="studio-chat-messages">${messages || '<div class="studio-empty-chat"><div><span data-icon="sparkle"></span><b>从一个具体要求开始</b><p>例如：改成采购决策结构，并保留企业知识引用。</p></div></div>'}</div><div class="studio-composer">${renderStudioPicker(workspace, conversation)}<div class="studio-selected-context">${knowledgeChips}${attachmentChips}${imageChips}</div><textarea class="studio-composer-input" id="studio-composer-input" placeholder="例如：把文章改成采购决策结构，先给我看大纲差异…">${escapeHtml(ui.studioComposerDraft)}</textarea><div class="studio-composer-toolbar"><div class="studio-composer-tools"><select class="studio-agent-select" id="studio-chat-agent" aria-label="选择写作智能体">${agentOptions}</select><button class="studio-tool-button teal ${conversation?.webSearchEnabled ? "active" : ""}" type="button" data-action="toggle-studio-web" title="联网检索演示（未接入真实搜索服务）"><span data-icon="globe"></span><span>联网演示</span></button><button class="studio-tool-button" type="button" data-action="open-studio-image-picker" title="插入图片"><span data-icon="image"></span></button><button class="studio-tool-button ${(workspace.attachmentIds || []).length ? "has-value" : ""}" type="button" data-action="trigger-studio-attachment" title="上传附件"><span data-icon="paperclip"></span></button><button class="studio-tool-button ${(conversation?.selectedKnowledgeItemIds || []).length ? "has-value" : ""}" type="button" data-action="open-studio-knowledge-picker" title="引用知识库或文件"><span data-icon="quote"></span><span>@知识</span></button><button class="studio-tool-button ${(conversation?.imageIds || []).length ? "has-value" : ""}" type="button" data-action="open-studio-knowledge-images" title="知识库图片"><span data-icon="database"></span></button></div><button class="studio-send-button" type="button" data-action="send-studio-chat" ${ui.studioComposerDraft.trim() ? "" : "disabled"} aria-label="发送"><span data-icon="send"></span></button></div><input id="studio-attachment-input" type="file" hidden multiple /><input id="studio-image-input" type="file" accept="image/*" hidden multiple /></div></aside>`;
}

function renderStudioInfo(workspace, article) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const citations = article ? articleCitations(article) : [];
  const agent = article?.generationSnapshot?.writingAgent || workspace.writingAgentSnapshot;
  return `<aside class="studio-info-pane"><h3>文章信息</h3><section class="studio-info-card"><h4>当前上下文</h4><div class="side-list"><div><span>业务线</span><b>${escapeHtml(line?.name || "未设置")}</b></div><div><span>来源</span><b>${workspace.mode === "quick" ? "直接创作" : "文章任务"}</b></div><div><span>内容形式</span><b>${escapeHtml(workspace.contentType)}</b></div><div><span>写作智能体</span><b>${escapeHtml(agent?.nameSnapshot || "未选择")} ${agent ? "v" + escapeHtml(agent.version) : ""}</b></div></div></section><section class="studio-info-card"><h4>审核与版本</h4><div class="side-list"><div><span>文章版本</span><b>${escapeHtml(article?.version || "尚未生成")}</b></div><div><span>审核状态</span><b>${article ? (article.reviewStatus === "approved" ? "已通过" : "待审核") : "—"}</b></div><div><span>风控状态</span><b>${article ? (article.riskStatus === "clean" ? "已通过" : article.riskStatus === "stale" ? "已过期" : "待检测") : "—"}</b></div></div></section><section class="studio-info-card"><h4>知识与素材</h4><p>已授权 ${studioKnowledgeBases(workspace).length} 个知识库，正文锁定 ${citations.length} 条企业事实引用；会话附件 ${(workspace.attachmentIds || []).length} 个，文章图片 ${(workspace.assetIds || []).length} 张。</p></section><section class="studio-info-card"><h4>安全边界</h4><p>联网结果和临时附件只作为本次对话参考，不能替代企业知识中的可用事实。AI 建议应用后会创建文章新版本，并重新进入审核与风控。</p></section><button class="link-button danger-link" type="button" data-action="delete-studio-workspace" data-workspace-id="${escapeHtml(workspace.id)}">删除此创作会话</button></aside>`;
}

function renderStudioRichToolbar() {
  return `<div class="studio-editor-toolbar studio-editor-toolbar-rich" aria-label="文章编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button studio-format-wide" type="button" data-action="studio-format" data-command="formatBlock" data-value="p" title="正文">正文⌄</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="blockquote" title="引用">❝</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="underline" title="下划线"><u>U</u></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button></div><div class="studio-toolbar-group"><button class="studio-format-button studio-format-wide" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">标题 2</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertOrderedList" title="有序列表">1.</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="justifyLeft" title="左对齐">☰</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="justifyCenter" title="居中">≡</button></div><div class="studio-toolbar-group"><button class="studio-format-button studio-format-wide studio-asset-toolbar-button" type="button" data-action="open-studio-knowledge-images" title="搜索并插入图片资料"><span data-icon="image"></span>图片资料</button><button class="studio-format-button" type="button" data-action="studio-link" title="插入链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="undo" title="撤销">↶</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="redo" title="重做">↷</button><button class="studio-format-button" type="button" data-action="studio-format" data-command="removeFormat" title="清除格式">⌫</button></div></div>`;
}

function renderStudioTextEditor(workspace) {
  const draftTitle = workspace.draftTitle || workspace.topic?.title || "";
  const draftContent = workspace.draftContent || "";
  const bodyHtml = workspace.draftContentHtml || escapeHtml(draftContent).replace(/\n/g, "<br>");
  if (ui.studioGenerating) {
    return `<main class="studio-editor-panel studio-generating-editor" aria-busy="true"><div class="studio-editor-head"><div><h3>文章编辑器</h3><p>系统正在基于选题与企业知识生成初稿</p></div><span class="status-badge status-running"><span class="loading-spinner dark"></span>生成中</span></div><div class="studio-generation-stage" role="status" aria-live="polite"><div class="studio-generation-visual" aria-hidden="true"><span data-icon="file"></span><i></i><i></i><i></i></div><h3>正在生成文章初稿</h3><p>正在核对企业知识、组织回答结构并写入可编辑正文。</p><div class="studio-generation-steps" aria-hidden="true"><span class="done"><i></i>读取选题</span><span class="active"><i></i>检索知识</span><span><i></i>生成正文</span></div><div class="studio-generation-track" aria-hidden="true"><i></i></div></div></main>`;
  }
  return `<main class="studio-editor-panel studio-quick-editor"><div class="studio-editor-head"><div><h3>文章编辑器</h3><p>直接编辑标题和正文；写作与修改要求请在右侧 AI 协作中沟通</p></div><span class="status-badge status-draft">编辑中</span></div>${renderStudioRichToolbar()}<textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(draftTitle)}</textarea><article class="studio-editor-body studio-quick-content" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${bodyHtml}</article><section class="studio-publication-setting"><strong>发布展示</strong>${renderPublicCitationSetting(workspace.showPublicCitationMarkers === true, "studio-show-public-citations")}</section></main>`;
}

function renderStudioQuickEditor(workspace) {
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId) || activeBusinessLine();
  const lines = state.businessLines.filter((item) => item.status === "active").map((item) => `<option value="${item.id}" ${item.id === line?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  const agents = activeWritingAgents(line?.id, workspace.contentType);
  const selectedAgent = writingAgentById(workspace.writingAgentId) || defaultAgentForLine(line, workspace.contentType);
  const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
  const approved = studioApprovedKnowledgeEntries(workspace).length;
  const draftTitle = workspace.draftTitle || workspace.topic?.title || "";
  const draftContent = workspace.draftContent || "";
  const bodyHtml = workspace.draftContentHtml || escapeHtml(draftContent).replace(/\n/g, "<br>");
  return `<main class="studio-editor-panel studio-quick-editor"><div class="studio-editor-head"><div><h3>直接生成文章</h3><p>先写标题和正文，也可以直接在右侧 AI 协作里提出写作要求</p></div><span class="status-badge status-draft">准备中</span></div><div class="studio-editor-toolbar" aria-label="编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">H2</button></div><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-link" title="链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="open-studio-image-picker" title="图片"><span data-icon="image"></span></button></div></div><textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(draftTitle)}</textarea><article class="studio-editor-body studio-quick-content" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${bodyHtml}</article><section class="studio-quick-settings"><div class="studio-quick-settings-grid"><label class="studio-field"><span>产品 / 业务线</span><select class="select" id="studio-business-line">${lines}</select></label><label class="studio-field"><span>内容形式</span><select class="select" id="studio-content-type">${["深度文章", "问答文章", "案例解读", "系列文章"].map((type) => `<option ${type === workspace.contentType ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="studio-field full"><span>写作智能体</span><select class="select" id="studio-direct-agent">${agentOptions}</select></label></div><div class="studio-knowledge-summary ${approved ? "" : "warning"}"><span data-icon="${approved ? "database" : "alert"}"></span><span><b>${studioKnowledgeBases(workspace).length} 个知识库 · ${approved} 条可用资料</b><small>${approved ? "生成后锁定企业知识版本；联网结果不会成为企业事实。" : "将由服务端按当前问题尝试检索企业知识。"}</small></span></div><button class="primary-button studio-quick-generate" type="button" data-action="generate-studio-article" ${selectedAgent ? "" : "disabled"}><span data-icon="sparkle"></span>${ui.studioGenerating ? "正在生成…" : "生成文章初稿"}</button></section></main>`;
}

function renderStudioArticleTextEditor(article) {
  const citations = articleCitations(article);
  const status = article.reviewStatus === "approved" ? '<span class="status-badge status-approved">已审核</span>' : '<span class="status-badge status-review">待审核</span>';
  const editorRiskScan = scanArticleRisk(article);
  const editorSourceContent = articleContentForEditor(article, citations);
  const editorContent = highlightArticleRiskHtml(editorSourceContent, editorRiskScan.hits);
  const titleRiskPreview = renderArticleRiskTitlePreview(article, editorRiskScan, "studio");
  return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>文章正文</h3><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${citations.length} 条企业知识引用</p></div>${status}</div>${renderStudioRichToolbar()}<textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(article.title)}</textarea>${titleRiskPreview}<article class="studio-editor-body" id="studio-content-editor" contenteditable="true" spellcheck="true" data-placeholder="请输入文章内容…">${editorContent}</article><section class="studio-publication-setting"><strong>发布展示</strong>${renderPublicCitationSetting(articlePublicCitationMarkersVisible(article), "studio-show-public-citations", article.reviewStage === "manual_review")}</section></main>`;
}

function renderStudioArticleEditorWithWorkflow(article) {
  const manualReview = article.reviewStage === "manual_review";
  const template = document.createElement("template");
  template.innerHTML = renderStudioArticleTextEditor(article);
  const root = template.content.firstElementChild;
  if (!root) return template.innerHTML;
  const status = root.querySelector(".studio-editor-head .status-badge");
  if (status) {
    status.className = "status-badge " + (article.reviewStatus === "approved" ? "status-approved" : "status-review");
    status.textContent = article.reviewStatus === "approved" ? "已审核" : manualReview ? "人工审核中" : article.reviewStage === "revision_requested" ? "退回修改" : "待审核";
  }
  const titleInput = root.querySelector("#studio-title-editor");
  const contentInput = root.querySelector("#studio-content-editor");
  if (manualReview) {
    if (titleInput) titleInput.readOnly = true;
    if (contentInput) contentInput.contentEditable = "false";
    root.querySelectorAll(".studio-editor-toolbar button").forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
    root.querySelector(".studio-editor-head")?.insertAdjacentHTML("afterend", '<div class="studio-read-only-banner"><span data-icon="lock"></span><div><b>当前版本正在人工审核</b><p>正文已锁定，不能直接修改。请由审核人员先点击“退回并修改”，服务端确认退回后再编辑。</p></div></div>');
  }
  if (contentInput) contentInput.insertAdjacentHTML("beforebegin", renderArticleRiskInlineNotice(article, "studio"));
  return root.outerHTML;
}

function renderStudioEditor(workspace, article) {
  if (!article) return renderStudioTextEditor(workspace);
  return renderStudioArticleEditorWithWorkflow(article);
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId) || activeBusinessLine();
  if (!article) {
    const lines = state.businessLines.filter((item) => item.status === "active").map((item) => `<option value="${item.id}" ${item.id === line?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    const agents = activeWritingAgents(line?.id, workspace.contentType);
    const selectedAgent = writingAgentById(workspace.writingAgentId) || defaultAgentForLine(line, workspace.contentType);
    const agentOptions = agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgent?.id ? "selected" : ""}>${escapeHtml(agent.name)} · v${escapeHtml(agent.version)}</option>`).join("");
    const approved = studioApprovedKnowledgeEntries(workspace).length;
    return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>直接生成文章</h3><p>不必先创建内容计划，但仍会冻结智能体和企业知识版本</p></div><span class="status-badge status-draft">准备中</span></div><div class="studio-empty-canvas"><div><span class="studio-empty-icon" data-icon="sparkle"></span><p class="studio-empty-prompt"><strong>今天要写什么？</strong>输入主题、客户问题或具体写作要求，系统会先核对业务线、智能体和知识范围。</p><div class="studio-generate-grid"><div class="studio-field full"><label for="studio-topic-input">主题 / 客户问题 *</label><textarea class="textarea" id="studio-topic-input" rows="4" placeholder="例如：工业品企业应该如何选择 GEO 服务商？">${escapeHtml(ui.studioTopicDraft || workspace.topic?.title || "")}</textarea><small>直接输入不会自动加入选题库；生成时只保存本篇文章的主题快照。</small></div><div class="studio-field"><label for="studio-business-line">产品 / 业务线</label><select class="select" id="studio-business-line">${lines}</select></div><div class="studio-field"><label for="studio-content-type">内容形式</label><select class="select" id="studio-content-type">${["深度文章", "问答文章", "案例解读", "系列文章"].map((type) => `<option ${type === workspace.contentType ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="studio-field full"><label for="studio-direct-agent">写作智能体</label><select class="select" id="studio-direct-agent">${agentOptions}</select><small>${escapeHtml(selectedAgent?.style || "请先配置适用于当前业务线的写作智能体")}</small></div><div class="studio-knowledge-summary ${approved ? "" : "warning"}"><span data-icon="${approved ? "database" : "alert"}"></span><span><b>${studioKnowledgeBases(workspace).length} 个知识库 · ${approved} 条已审核知识可用</b><br>${approved ? "生成时会由服务端按当前问题检索，并逐条记录知识库、条目和版本。" : "当前本地没有证据，生成时会先由服务端按当前问题检索企业知识。"}</span></div><div class="studio-field full"><button class="primary-button" type="button" data-action="generate-studio-article" ${selectedAgent ? "" : "disabled"}><span data-icon="sparkle"></span>${ui.studioGenerating ? "正在生成…" : "生成文章初稿"}</button></div></div></div></div></main>`;
  }
  const citations = articleCitations(article);
  return `<main class="studio-editor-panel"><div class="studio-editor-head"><div><h3>文章正文</h3><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${citations.length} 条企业知识引用</p></div>${article.reviewStatus === "approved" ? '<span class="status-badge status-approved">已审核</span>' : '<span class="status-badge status-review">待审核</span>'}</div><div class="studio-editor-toolbar" aria-label="编辑工具栏"><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="bold" title="粗体"><b>B</b></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="italic" title="斜体"><i>I</i></button><button class="studio-format-button" type="button" data-action="studio-format" data-command="formatBlock" data-value="h2" title="二级标题">H2</button></div><div class="studio-toolbar-group"><button class="studio-format-button" type="button" data-action="studio-format" data-command="insertUnorderedList" title="无序列表">☷</button><button class="studio-format-button" type="button" data-action="studio-link" title="链接"><span data-icon="link"></span></button><button class="studio-format-button" type="button" data-action="open-studio-image-picker" title="图片"><span data-icon="image"></span></button></div></div><textarea class="studio-title-input" id="studio-title-editor" rows="2" placeholder="请输入标题">${escapeHtml(article.title)}</textarea><article class="studio-editor-body" id="studio-content-editor" contenteditable="true" spellcheck="false">${articleContentForEditor(article, citations)}</article></main>`;
}

function renderContentStudio() {
  const workspace = ensureStudioWorkspace(null, false);
  const article = studioArticleForWorkspace(workspace);
  const conversation = studioConversationForWorkspace(workspace);
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId);
  const agent = writingAgentById(conversation?.selectedAgentId) || writingAgentById(workspace.writingAgentId);
  const knowledgeCount = studioApprovedKnowledgeEntries(workspace).length;
  const studio = `<section class="content-studio-page"><div class="studio-topbar"><button class="studio-back-button" type="button" data-action="back-to-articles"><span data-icon="arrow"></span>文章任务</button><div class="studio-doc-meta"><span>${article ? escapeHtml(article.id) + " · " + escapeHtml(article.version) : "直接创作 · 尚未生成文章"}</span><strong class="studio-doc-title">${escapeHtml(article?.title || workspace.topic?.title || "新文章")}</strong><small class="studio-save-state">${article ? "已保存到客户空间" : "创作上下文已保存"}</small><div class="studio-context-chips"><span class="studio-context-chip"><span data-icon="briefcase"></span><b>${escapeHtml(line?.name || "未设置业务线")}</b></span><span class="studio-context-chip blue"><span data-icon="sparkle"></span><b>${escapeHtml(agent?.name || workspace.writingAgentSnapshot?.nameSnapshot || "未选择智能体")}</b></span><span class="studio-context-chip teal"><span data-icon="database"></span><b>${studioKnowledgeBases(workspace).length} 库 / ${knowledgeCount} 条可用资料</b></span><span class="studio-context-chip"><span data-icon="file"></span><b>${workspace.mode === "quick" ? "直接创作" : "文章任务"}</b></span></div></div><div class="studio-top-actions"><button class="secondary-button" type="button" data-action="save-studio-draft"><span data-icon="check"></span><span>保存草稿</span></button>${article?.reviewStatus === "approved" ? `<button class="primary-button" type="button" data-action="open-publish" data-article-id="${escapeHtml(article.id)}"><span data-icon="send"></span><span>发布文章</span></button>` : `<button class="primary-button" type="button" data-action="submit-studio-review" ${article ? "" : "disabled"}><span data-icon="shield"></span><span>提交审核</span></button>`}</div></div><div class="studio-mobile-tabs"><button class="${ui.studioPane === "editor" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="editor">正文</button><button class="${ui.studioPane === "chat" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="chat">AI 协作</button><button class="${ui.studioPane === "info" ? "active" : ""}" type="button" data-action="studio-pane" data-pane="info">文章信息</button></div><div class="studio-shell" data-active-pane="${escapeHtml(ui.studioPane)}">${renderStudioEditor(workspace, article)}${renderStudioChat(workspace, conversation, article)}${renderStudioInfo(workspace, article)}</div></section>`;
  const studioMarkup = article?.reviewStage === "manual_review"
    ? studio.replace('data-action="save-studio-draft"', 'data-action="save-studio-draft" disabled aria-disabled="true"').replace("<span>保存草稿</span>", "<span>审核中不可保存</span>").replace('data-action="submit-studio-review"', 'data-action="submit-studio-review" disabled aria-disabled="true"')
    : studio;
  return contentPageShell(studioMarkup, '<button class="secondary-button" type="button" data-nav="planning"><span data-icon="clock"></span>进入选题中心</button><button class="primary-button" type="button" data-action="open-content-studio"><span data-icon="sparkle"></span>直接创作</button>');
}

function contentPlanForArticle(article) {
  if (!article) return null;
  const directPlan = state.contentPlans.find((plan) => plan.id === article.planId);
  if (directPlan) return directPlan;
  return state.contentPlans.find((plan) => Array.isArray(plan.articleIds) && plan.articleIds.includes(article.id)) || null;
}

function contentArticleBusinessLineId(article) {
  const plan = contentPlanForArticle(article);
  if (plan?.businessLineId) return plan.businessLineId;
  if (article?.businessLineId || article?.generationSnapshot?.businessLineId) return article.businessLineId || article.generationSnapshot.businessLineId;
  const topic = article?.topicId ? state.topics.find((item) => item.id === article.topicId) : null;
  return topic ? topicBusinessLineId(topic) : null;
}

function contentArticleInCurrentBusinessLine(article) {
  const line = activeBusinessLine();
  return Boolean(line?.id) && contentArticleBusinessLineId(article) === line.id;
}

function contentPlanArticles(plan) {
  if (!plan) return [];
  return state.articles.filter((article) => contentPlanForArticle(article)?.id === plan.id);
}

function contentPlanTopicIds(plan) {
  const ids = Array.isArray(plan?.topicIds) ? plan.topicIds : [];
  const snapshotIds = Array.isArray(plan?.topicSnapshots) ? plan.topicSnapshots.map((topic) => topic?.id) : [];
  return [...new Set([...ids, ...snapshotIds].filter(Boolean))];
}

function contentPlanProgress(plan) {
  const articles = contentPlanArticles(plan);
  const topicIds = contentPlanTopicIds(plan);
  const plannedTopicIds = new Set(topicIds);
  const coveredTopicIds = new Set(articles.map((article) => article.topicId).filter((topicId) => plannedTopicIds.has(topicId)));
  const missingTopicIds = topicIds.filter((topicId) => !coveredTopicIds.has(topicId));
  const total = topicIds.length || articles.length;
  const created = topicIds.length ? coveredTopicIds.size : articles.length;
  return {
    articles,
    topicIds,
    plannedCount: topicIds.length,
    total,
    created,
    draft: articles.filter((article) => article.reviewStatus !== "approved" && article.reviewStage !== "manual_review").length,
    pending: articles.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length,
    approved: articles.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length,
    published: articles.filter((article) => article.status === "published").length,
    missing: missingTopicIds.length,
    missingTopicIds,
    extraArticles: topicIds.length ? articles.filter((article) => !plannedTopicIds.has(article.topicId)) : []
  };
}

function articlePublishEligibility(article) {
  if (!article) return { ok: false, reason: "文章不存在" };
  if (!articleBusinessLineIsActive(article)) return { ok: false, reason: "业务线已归档" };
  if (article.reviewStatus !== "approved") return { ok: false, reason: "未完成人工审核" };
  if (article.riskStatus !== "clean") return { ok: false, reason: "风控未通过" };
  if (!articleCitations(article).length) return { ok: false, reason: "缺少知识证据" };
  if (!article.knowledgeSnapshot || (!article.knowledgeSnapshot.frozenAt && article.knowledgeStatus?.state !== "ready_with_omissions" && article.knowledgeStatus?.state !== "frozen")) return { ok: false, reason: "知识证据未冻结" };
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return { ok: false, reason: "企业事实存在冲突" };
  if (articleHasKnowledgeUpdates(article)) return { ok: false, reason: "知识版本已更新" };
  if (articleAssetReviewIssues(article).length) return { ok: false, reason: "图片素材尚未审核" };
  if (!["draft", "publishing", "published"].includes(article.status)) return { ok: false, reason: "文章当前状态不可发布" };
  return { ok: true, reason: article.status === "draft" ? "可发布" : "可继续发布到其他平台" };
}

function articleExistingPublishPlatforms(article) {
  if (!article) return new Set();
  const platforms = new Set();
  const addPlatform = (platform) => {
    const canonical = canonicalPublishPlatformId(platform);
    platforms.add(platform);
    platforms.add(canonical);
    if (PUBLISH_PLATFORM_REVERSE_ALIASES[canonical]) platforms.add(PUBLISH_PLATFORM_REVERSE_ALIASES[canonical]);
  };
  state.publishTasks.filter((task) => task.articleId === article.id && task.version === article.version).forEach((task) => Object.keys(task.targets || {}).forEach(addPlatform));
  (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled" && schedule.articleVersions?.[article.id] === article.version).forEach((schedule) => (schedule.items || []).filter((item) => item.articleId === article.id).forEach((item) => (item.targets || []).forEach((target) => addPlatform(target.platform))));
  return platforms;
}

function articleScheduleEligibility(article, selection) {
  const base = articlePublishEligibility(article);
  if (!base.ok) return base;
  const requested = selection?.platformOrder || selection?.platforms || [];
  const existing = articleExistingPublishPlatforms(article);
  if (requested.length && !requested.some((platform) => !existing.has(platform))) return { ok: false, reason: "所选平台已有发布任务" };
  return { ok: true, reason: "可排期" };
}

function publishScheduleForArticle(article) {
  if (!article) return [];
  return (state.publishSchedules || []).filter((schedule) => schedule.articleIds?.includes(article.id) && schedule.articleVersions?.[article.id] === article.version && ["scheduled", "running", "partial"].includes(schedule.status));
}

function articleMatchesContentFilters(article) {
  if (!article) return false;
  const query = String(ui.articleSearch || "").trim().toLowerCase();
  const plan = contentPlanForArticle(article);
  const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
  const agent = article.generationSnapshot?.writingAgent;
  const searchable = [article.title, article.id, article.category, article.author, plan?.name, topic?.title, agent?.nameSnapshot]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (ui.articleRiskFilter !== "all" && article.riskStatus !== ui.articleRiskFilter) return false;
  const hasKnowledge = articleCitations(article).length > 0 && Boolean(article.knowledgeSnapshot);
  if (ui.articleKnowledgeFilter === "mapped" && !hasKnowledge) return false;
  if (ui.articleKnowledgeFilter === "unmapped" && hasKnowledge) return false;
  if (ui.articleKnowledgeFilter === "outdated" && !articleHasKnowledgeUpdates(article)) return false;
  return true;
}

function contentTaskVisibleArticles() {
  const line = activeBusinessLine();
  const plans = state.contentPlans.filter((plan) => plan.businessLineId === line?.id);
  const base = state.articles.filter((article) => {
    if (!contentArticleInCurrentBusinessLine(article)) return false;
    const plan = contentPlanForArticle(article);
    if (ui.articlePlanFilterId === "__direct__") return !plan;
    if (ui.articlePlanFilterId && ui.articlePlanFilterId !== "all") return plan?.id === ui.articlePlanFilterId;
    return true;
  });
  return base.filter((article) => {
    if (ui.articleTab === "uncreated") return false;
    if (ui.articleTab === "draft") return article.reviewStatus !== "approved" && article.reviewStage !== "manual_review";
    if (ui.articleTab === "pending") return article.reviewStatus === "pending" && article.reviewStage === "manual_review";
    if (ui.articleTab === "approved") return article.reviewStatus === "approved" && article.status !== "published";
    if (ui.articleTab === "published") return article.status === "published";
    return true;
  }).filter(articleMatchesContentFilters);
}

function selectedArticleObjects() {
  const selected = new Set(ui.articleSelection || []);
  return state.articles.filter((article) => selected.has(article.id));
}

// 批量人工审核只处理待审核草稿；通用复选框还允许选择可排期的已审核文章。
function articleSelectableForReview(article) {
  return Boolean(article && article.status === "draft" && article.reviewStatus !== "approved" && article.reviewStage === "manual_review");
}

function articleSelectableForAction(article) {
  return articleSelectableForReview(article) || articlePublishEligibility(article).ok;
}

function articleReviewBlockReason(article) {
  if (!article) return "文章不存在";
  if (!articleBusinessLineIsActive(article)) return "所属业务线已归档";
  if (article.status === "published") return "文章已发布";
  if (article.reviewStatus === "approved") return "已审核通过";
  if (article.reviewStage !== "manual_review") return article.reviewStage === "revision_requested" ? "已退回修改，尚未重新提交" : "尚未提交人工审核";
  const citations = articleCitations(article);
  if (!citations.length || !article.knowledgeSnapshot) return "缺少企业知识证据";
  if (citations.some((citation) => !knowledgeBaseById(citation.knowledgeBaseId || citation.baseId) || !knowledgeItemById(citation.itemId || citation.knowledgeItemId) || !knowledgeVersionById(citation.versionId || citation.knowledgeVersionId))) return "引用证据不完整";
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return "企业事实存在冲突";
  if (articleHasKnowledgeUpdates(article)) return "知识版本已更新";
  if (articleAssetReviewIssues(article).length) return "图片素材尚未审核";
  if (["unscanned", "stale"].includes(article.riskStatus) || article.riskScan?.articleVersion !== article.version) return "尚未完成当前版本风控";
  if (article.riskStatus === "blocked") return "风控已阻断";
  if (article.riskStatus === "warning") return "存在风控警告";
  return "";
}

function selectedArticleIdsForCurrentView() {
  return Array.isArray(ui.articleSelection) ? ui.articleSelection : [];
}

function clearArticleSelection() {
  ui.articleSelection = [];
}

function enhanceArticleTaskSelection(root = document) {
  if (ui.route !== "content" || ui.contentView !== "articles" || ui.articleTaskView !== "articles") return;
  const table = root.querySelector(".content-article-table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tbody tr:not(.article-task-uncreated)")];
  const articles = rows.map((row) => {
    const openButton = row.querySelector('[data-action="open-article"]');
    const articleId = openButton?.dataset.articleId;
    return { row, article: state.articles.find((item) => item.id === articleId) };
  }).filter((entry) => entry.article);
  const selectable = articles.filter((entry) => articleSelectableForAction(entry.article));
  const selected = new Set(selectedArticleIdsForCurrentView());
  const selectedVisible = selectable.filter((entry) => selected.has(entry.article.id));

  articles.forEach(({ row, article }) => {
    const titleCell = row.querySelector("td.article-title-cell");
    if (!titleCell || titleCell.querySelector("[data-article-select]")) return;
    const canSelect = articleSelectableForAction(article);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox article-select-checkbox";
    checkbox.dataset.articleSelect = article.id;
    checkbox.checked = canSelect && selected.has(article.id);
    checkbox.disabled = !canSelect;
    checkbox.setAttribute("aria-label", `选择 ${article.title || article.id}`);
    const titleContent = document.createElement("span");
    while (titleCell.firstChild) titleContent.append(titleCell.firstChild);
    const wrapper = document.createElement("span");
    wrapper.className = "article-title-select";
    titleCell.append(wrapper);
    wrapper.append(checkbox);
    wrapper.append(titleContent);
  });

  const card = table.closest(".table-card");
  if (!card || card.querySelector(".article-bulk-row")) return;
  const header = card.querySelector(":scope > .card-header");
  if (!header) return;
  const bulkRow = document.createElement("div");
  bulkRow.className = "bulk-select-row article-bulk-row";
  const reviewableCount = selectedVisible.filter((entry) => articleSelectableForReview(entry.article)).length;
  const publishableCount = selectedVisible.filter((entry) => articlePublishEligibility(entry.article).ok).length;
  bulkRow.innerHTML = `${renderSelectAllControl("content-articles", selectable.length, selectedVisible.length, "全选当前列表")}<span class="article-bulk-summary">已选择 <b>${selectedVisible.length}</b> 篇文章</span><button class="primary-button button-small" type="button" data-action="open-batch-review" ${reviewableCount && currentUserCan("content.review") ? "" : "disabled"}><span data-icon="check"></span>${currentUserCan("content.review") ? `批量审核${reviewableCount ? `（${reviewableCount}篇）` : ""}` : "无审核权限"}</button><button class="secondary-button button-small" type="button" data-action="open-schedule" ${publishableCount ? "" : "disabled"}><span data-icon="clock"></span>定时发布${publishableCount ? `（${publishableCount}篇）` : ""}</button>`;
  header.insertAdjacentElement("afterend", bulkRow);
  hydrateIcons(bulkRow);
  hydrateBulkSelects(bulkRow);
}

function contentTaskViewSwitcher() {
  const line = activeBusinessLine();
  const planCount = state.contentPlans.filter((plan) => plan.businessLineId === line?.id).length;
  const articleCount = state.articles.filter((article) => contentArticleInCurrentBusinessLine(article)).length;
  return `<div class="content-task-switcher" role="tablist"><button class="${ui.articleTaskView === "plans" ? "active" : ""}" type="button" data-action="content-task-view" data-view="plans"><span data-icon="clock"></span><span><b>生成任务</b><small>${planCount ? `${planCount} 个计划 · 跟踪进度` : "暂无计划 · 建议先做选题"}</small></span></button><button class="${ui.articleTaskView === "articles" ? "active" : ""}" type="button" data-action="content-task-view" data-view="articles"><span data-icon="file"></span><span><b>文章列表</b><small>${articleCount} 篇文章 · 管理版本与审核</small></span></button></div>`;
}

function renderContentPlanTasks() {
  const line = activeBusinessLine();
  const plans = [...state.contentPlans].filter((plan) => plan.businessLineId === line?.id).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const directArticles = state.articles.filter((article) => !contentPlanForArticle(article) && contentArticleInCurrentBusinessLine(article));
  const allPlannedArticles = state.articles.filter((article) => contentPlanForArticle(article)?.businessLineId === line?.id);
  const pending = allPlannedArticles.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length;
  const published = allPlannedArticles.filter((article) => article.status === "published").length;
  const rows = plans.map((plan) => {
    const line = state.businessLines.find((item) => item.id === plan.businessLineId);
    const progress = contentPlanProgress(plan);
    const percent = progress.total ? Math.min(100, Math.round(progress.created / progress.total * 100)) : 0;
    const statusSummary = [
      progress.draft ? `<span class="status-badge status-draft">草稿 ${progress.draft}</span>` : "",
      progress.pending ? `<span class="status-badge status-review">待审核 ${progress.pending}</span>` : "",
      progress.approved ? `<span class="status-badge status-approved">已通过 ${progress.approved}</span>` : "",
      progress.published ? `<span class="status-badge status-published">已发布 ${progress.published}</span>` : ""
    ].filter(Boolean).join(" ") || '<span class="small-tag">尚未生成</span>';
    const missingNote = !progress.total ? '<small>计划无选题</small>' : progress.missing ? `<small class="plan-progress-missing">还差 ${progress.missing} 篇</small>` : '<small class="plan-progress-complete">文章任务已齐</small>';
    return `<tr><td class="article-title-cell"><button class="plan-name-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</button><small>${escapeHtml(plan.id)} · ${escapeHtml(line?.name || "未关联业务线")} · 创建于 ${formatRelative(plan.createdAt)}</small></td><td><b>${progress.plannedCount}</b> 个选题<br><small>${progress.created}/${progress.total || 0} 篇文章</small></td><td><div class="plan-progress"><div class="plan-progress-track"><i style="width:${percent}%"></i></div><div class="plan-progress-meta"><b>${percent}%</b>${missingNote}</div></div><div class="plan-status-list">${statusSummary}</div></td><td>${escapeHtml(plan.scheduledFor || "未安排")}</td><td>${escapeHtml(plan.owner || "未分配")}</td><td>${planStatusBadge(plan.status)}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">查看文章任务</button>${progress.articles.some((article) => articlePublishEligibility(article).ok) ? `<button class="link-button" type="button" data-action="schedule-plan" data-plan-id="${escapeHtml(plan.id)}">安排发布</button>` : ""}${progress.missing ? `<button class="link-button" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(plan.id)}">继续生成</button>` : ""}</div></td></tr>`;
  }).join("");
  const directRow = directArticles.length ? `<tr class="content-direct-row"><td class="article-title-cell"><button class="plan-name-button" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="__direct__">直接创作</button><small>未关联内容计划 · 独立文章工作区</small></td><td>—<br><small>${directArticles.length} 篇文章</small></td><td><div class="plan-progress plan-progress-direct"><div class="plan-progress-meta"><b>独立创作</b><small>不计入计划进度</small></div></div></td><td>—</td><td>—</td><td><span class="small-tag blue">独立创作</span></td><td><button class="link-button" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="__direct__">查看文章</button></td></tr>` : "";
  const directPublished = directArticles.filter((article) => article.status === "published").length;
  const totalArticles = allPlannedArticles.length + directArticles.length;
  const summary = `<section class="content-plan-summary content-queue-summary"><article class="card summary-card ${plans.length ? "" : "is-zero"}"><span data-icon="clock"></span><div><b>${plans.length}</b><small>内容计划</small><em>${plans.length ? "正在推进" : "尚未建立"}</em></div></article><article class="card summary-card ${totalArticles ? "" : "is-zero"}"><span class="amber" data-icon="file"></span><div><b>${totalArticles}</b><small>${plans.length ? "计划文章" : "已有文章"}</small><em>${directArticles.length ? `${directArticles.length} 篇直接创作` : "等待内容生成"}</em></div></article><article class="card summary-card ${pending ? "" : "is-zero"}"><span class="green" data-icon="check"></span><div><b>${pending}</b><small>待审核</small><em>${pending ? "需要处理" : "当前无待办"}</em></div></article><article class="card summary-card ${published || directPublished ? "" : "is-zero"}"><span class="purple" data-icon="send"></span><div><b>${published + directPublished}</b><small>已发布</small><em>${published + directPublished ? "已有发布成果" : "尚未发布"}</em></div></article></section>`;
  const queueTitle = plans.length ? "内容计划任务" : "当前内容队列";
  const queueDescription = plans.length ? "按计划查看生产进度，再进入计划处理每个选题对应的文章。" : (directArticles.length ? `当前业务线暂无内容计划，已为你保留 ${directArticles.length} 篇直接创作文章。` : "当前业务线还没有内容计划或文章，可以从选题中心开始。");
  const queueAction = `<div class="content-queue-actions"><button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="articles" data-plan-filter="all">查看文章列表</button>${!plans.length ? '<button class="primary-button button-small" type="button" data-nav="planning"><span data-icon="clock"></span>创建内容计划</button>' : ""}</div>`;
  return `${contentTaskViewSwitcher()}${summary}<section class="card table-card content-queue-card"><div class="card-header"><div><span class="section-kicker">生产工作队列</span><h3>${queueTitle}</h3><p>${queueDescription}</p></div>${queueAction}</div>${rows || directRow ? `<div class="table-scroll"><table class="data-table content-plan-table"><thead><tr><th>计划 / 来源</th><th>选题 / 文章</th><th>文章进度与状态</th><th>截止日期</th><th>负责人</th><th>计划状态</th><th class="text-right">操作</th></tr></thead><tbody>${rows}${directRow}</tbody></table></div>` : '<div class="empty-state content-queue-empty"><div><span data-icon="clock"></span><h3>还没有内容任务</h3><p>从选题中心创建内容计划，或点击右上角直接创作。</p></div></div>'}</section>`;
}

function renderContentArticleList() {
  const line = activeBusinessLine();
  const plans = [...state.contentPlans].filter((plan) => plan.businessLineId === line?.id).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const selectedPlan = ui.articlePlanFilterId && ui.articlePlanFilterId !== "all" && ui.articlePlanFilterId !== "__direct__"
    ? plans.find((plan) => plan.id === ui.articlePlanFilterId)
    : null;
  const baseFiltered = state.articles.filter((article) => {
    if (!contentArticleInCurrentBusinessLine(article)) return false;
    const plan = contentPlanForArticle(article);
    if (ui.articlePlanFilterId === "__direct__") return !plan;
    if (ui.articlePlanFilterId && ui.articlePlanFilterId !== "all") return plan?.id === ui.articlePlanFilterId;
    return true;
  });
  const selectedPlanProgress = selectedPlan ? contentPlanProgress(selectedPlan) : null;
  const tabs = selectedPlan ? [["all", "全部任务"], ["uncreated", "未生成"], ["draft", "草稿 / 退回"], ["pending", "待审核"], ["approved", "已通过"], ["published", "已发布"]] : [["all", "全部文章"], ["draft", "草稿 / 退回"], ["pending", "待审核"], ["approved", "已通过"], ["published", "已发布"]];
  const tabCount = (id) => {
    if (id === "all") return baseFiltered.length + (selectedPlanProgress?.missing || 0);
    if (id === "uncreated") return selectedPlanProgress?.missing || 0;
    if (id === "draft") return baseFiltered.filter((article) => article.reviewStatus !== "approved" && article.reviewStage !== "manual_review").length;
    if (id === "pending") return baseFiltered.filter((article) => article.reviewStatus === "pending" && article.reviewStage === "manual_review").length;
    if (id === "approved") return baseFiltered.filter((article) => article.reviewStatus === "approved" && article.status !== "published").length;
    return baseFiltered.filter((article) => article.status === "published").length;
  };
  const filtered = baseFiltered.filter((article) => {
    if (ui.articleTab === "uncreated") return false;
    if (ui.articleTab === "draft") return article.reviewStatus !== "approved" && article.reviewStage !== "manual_review";
    if (ui.articleTab === "pending") return article.reviewStatus === "pending" && article.reviewStage === "manual_review";
    if (ui.articleTab === "approved") return article.reviewStatus === "approved" && article.status !== "published";
    if (ui.articleTab === "published") return article.status === "published";
    return true;
  }).filter(articleMatchesContentFilters);
  const selectableArticles = filtered.filter(articleSelectableForAction);
  const selectableArticleIds = new Set(selectableArticles.map((article) => article.id));
  // 过滤条件变化后，隐藏列表中的勾选不应继续影响批量操作。
  ui.articleSelection = selectedArticleIdsForCurrentView().filter((id) => selectableArticleIds.has(id));
  const selectedArticleIds = new Set(ui.articleSelection);
  const selectedArticles = selectableArticles.filter((article) => selectedArticleIds.has(article.id));
  const tabHtml = tabs.map(([id, label]) => `<button class="tab-button ${ui.articleTab === id ? "active" : ""}" type="button" data-action="article-tab" data-tab="${id}">${label} · ${tabCount(id)}</button>`).join("");
  const planOptions = [`<option value="all" ${ui.articlePlanFilterId === "all" ? "selected" : ""}>全部计划</option>`, `<option value="__direct__" ${ui.articlePlanFilterId === "__direct__" ? "selected" : ""}>直接创作（无计划）</option>`].concat(plans.map((plan) => `<option value="${escapeHtml(plan.id)}" ${ui.articlePlanFilterId === plan.id ? "selected" : ""}>${escapeHtml(plan.name)}</option>`)).join("");
  const articleRows = filtered.map((article) => {
    const agent = article.generationSnapshot?.writingAgent;
    const plan = contentPlanForArticle(article);
    const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
    const sourceCell = plan
      ? `<span class="article-source-cell"><button class="link-button" type="button" data-action="view-plan-content" data-plan-id="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</button><small>${escapeHtml(topic?.title || "关联选题未找到")}</small></span>`
      : '<span class="article-source-cell direct"><b>直接创作</b><small>未关联内容计划</small></span>';
    const agentCell = agent
      ? `<span class="article-agent-cell"><b>${escapeHtml(agent.nameSnapshot)}</b><small>v${escapeHtml(agent.version)} · ${escapeHtml(agent.style || agent.template || "写作配置")}</small></span>`
      : '<span class="article-agent-cell legacy"><b>历史默认配置</b><small>未记录智能体</small></span>';
    return `<tr><td class="article-title-cell"><button type="button" data-action="open-article" data-article-id="${article.id}">${escapeHtml(article.title)}</button><small>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · 更新于 ${formatRelative(article.updatedAt)}</small></td><td>${sourceCell}</td><td><span class="source-tag">${escapeHtml(article.category)}</span></td><td>${agentCell}</td><td>${article.status === "published" ? statusBadge("published") : article.status === "publishing" ? statusBadge("publishing") : statusBadge("draft")}</td><td>${articleReviewBadge(article)}</td><td>${articleCitations(article).length ? `<span class="status-badge status-approved">${articleCitations(article).length} 条证据</span><small class="block-subtext">${article.knowledgeStatus?.gapCount || 0} 项缺口已省略</small>` : '<span class="status-badge status-review">未映射</span>'}</td><td>${articleRiskBadge(article)}<small class="block-subtext">绑定 ${article.version}</small></td><td>${escapeHtml(article.author)}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="open-article" data-article-id="${article.id}">打开</button><button class="link-button" type="button" data-action="open-article-studio" data-article-id="${article.id}">AI 协作</button>${article.reviewStatus === "approved" && article.status === "draft" && articleCitations(article).length && articleBusinessLineIsActive(article) ? `<button class="link-button" type="button" data-action="open-publish" data-article-id="${article.id}">发布</button>` : ""}<button class="link-button danger-link" type="button" data-action="delete-content-article" data-article-id="${article.id}">删除</button></div></td></tr>`;
  }).join("");
  const missingRows = selectedPlan && selectedPlanProgress.missingTopicIds.length && ["all", "uncreated"].includes(ui.articleTab)
    ? selectedPlanProgress.missingTopicIds.map((topicId) => {
      const topic = selectedPlan.topicSnapshots?.find((item) => item.id === topicId) || state.topics.find((item) => item.id === topicId);
      const agent = selectedPlan.writingAgentSnapshot;
      const title = topic?.title || `选题 ${topicId}`;
      return `<tr class="article-task-uncreated"><td class="article-title-cell"><span class="article-task-placeholder"><b>${escapeHtml(title)}</b><small>${escapeHtml(topicId)} · 尚未生成文章</small></span></td><td><span class="article-source-cell"><b>${escapeHtml(selectedPlan.name)}</b><small>${escapeHtml(title)}</small></span></td><td><span class="source-tag">${escapeHtml(selectedPlan.contentType || "待确定")}</span></td><td><span class="article-agent-cell"><b>${escapeHtml(agent?.nameSnapshot || "计划写作智能体")}</b><small>${agent?.version ? "v" + escapeHtml(agent.version) : "等待生成时冻结"}</small></span></td><td><span class="status-badge status-draft">未生成</span></td><td><span class="small-tag">待创建</span></td><td><span class="small-tag">生成后核验</span></td><td><span class="small-tag">未检测</span></td><td>${escapeHtml(selectedPlan.owner || "未分配")}</td><td><button class="link-button" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}">生成文章</button></td></tr>`;
    }).join("")
    : "";
  const rows = articleRows + missingRows;
  const filterLabel = ui.articlePlanFilterId === "__direct__" ? "直接创作" : selectedPlan?.name || "全部计划";
  const description = selectedPlan
    ? `计划包含 ${selectedPlanProgress.plannedCount} 个选题，已生成 ${selectedPlanProgress.created}/${selectedPlanProgress.total || 0} 个计划任务${selectedPlanProgress.extraArticles.length ? `，另有 ${selectedPlanProgress.extraArticles.length} 篇附加文章` : ""}。`
    : ui.articlePlanFilterId === "__direct__"
      ? "直接创作文章不进入内容计划进度。"
      : "可按计划查看文章，也可以切换到状态标签统一处理。";
  const headerActions = `<div class="table-actions content-article-header-actions">${selectedPlanProgress?.missing ? `<button class="secondary-button button-small" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}"><span data-icon="sparkle"></span>继续生成</button>` : ""}<button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="plans"><span data-icon="clock"></span>返回计划任务</button></div>`;
  const emptyState = selectedPlan
    ? `<div class="empty-state"><div><span data-icon="file"></span><h3>当前状态没有文章</h3><p>${selectedPlanProgress.missing ? `该计划还有 ${selectedPlanProgress.missing} 个选题尚未生成，可继续创建计划文章。` : "该计划在当前状态下没有文章，可返回计划任务查看整体进度。"}</p>${selectedPlanProgress.missing ? `<button class="primary-button button-small" type="button" data-action="execute-plan" data-plan-id="${escapeHtml(selectedPlan.id)}"><span data-icon="sparkle"></span>继续生成计划文章</button>` : '<button class="secondary-button button-small" type="button" data-action="content-task-view" data-view="plans">返回计划任务</button>'}</div></div>`
    : '<div class="empty-state"><div><span data-icon="file"></span><h3>当前筛选没有文章</h3><p>可以直接生成一篇文章，或回到选题中心创建内容计划。</p><button class="primary-button button-small" type="button" data-action="open-content-studio">直接创作</button></div></div>';
  const taskTable = rows ? `<div class="table-scroll"><table class="data-table content-article-table"><thead><tr><th>文章 / 任务</th><th>来源计划 / 选题</th><th>分类</th><th>写作智能体</th><th>内容状态</th><th>审核状态</th><th>知识证据</th><th>风控状态</th><th>作者</th><th class="text-right">操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState;
  const activeAdvancedFilters = Number(ui.articleRiskFilter !== "all") + Number(ui.articleKnowledgeFilter !== "all");
  const advancedFilters = ui.articleFilterExpanded
    ? `<div class="content-advanced-filters"><label><span>风控状态</span><select class="select" data-content-risk-filter><option value="all" ${ui.articleRiskFilter === "all" ? "selected" : ""}>全部风控状态</option><option value="clean" ${ui.articleRiskFilter === "clean" ? "selected" : ""}>风控通过</option><option value="unscanned" ${ui.articleRiskFilter === "unscanned" ? "selected" : ""}>尚未检测</option><option value="stale" ${ui.articleRiskFilter === "stale" ? "selected" : ""}>结果已过期</option><option value="warning" ${ui.articleRiskFilter === "warning" ? "selected" : ""}>需注意</option><option value="blocked" ${ui.articleRiskFilter === "blocked" ? "selected" : ""}>已阻断</option></select></label><label><span>知识证据</span><select class="select" data-content-knowledge-filter><option value="all" ${ui.articleKnowledgeFilter === "all" ? "selected" : ""}>全部证据状态</option><option value="mapped" ${ui.articleKnowledgeFilter === "mapped" ? "selected" : ""}>已映射企业知识</option><option value="unmapped" ${ui.articleKnowledgeFilter === "unmapped" ? "selected" : ""}>未映射企业知识</option><option value="outdated" ${ui.articleKnowledgeFilter === "outdated" ? "selected" : ""}>引用知识已更新</option></select></label><button class="ghost-button button-small" type="button" data-action="clear-content-filters" ${activeAdvancedFilters || ui.articleSearch ? "" : "disabled"}>清除筛选</button></div>`
    : "";
  const activeFilterSummary = [
    ui.articleTab !== "all" ? tabs.find(([id]) => id === ui.articleTab)?.[1] : "全部状态",
    filterLabel !== "全部计划" ? filterLabel : "",
    ui.articleSearch ? `搜索“${ui.articleSearch}”` : ""
  ].filter(Boolean).join(" · ");
  return `${contentTaskViewSwitcher()}<div class="content-article-toolbar"><div class="tabs" role="tablist">${tabHtml}</div><div class="filter-tools"><label class="content-plan-filter"><span>来源计划</span><select class="select" id="content-plan-filter">${planOptions}</select></label><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.articleSearch)}" placeholder="搜索文章、计划、选题或编号" aria-label="搜索文章" data-content-article-search /></div><button class="secondary-button button-small ${activeAdvancedFilters ? "active" : ""}" type="button" data-action="content-filter"><span data-icon="filter"></span>更多筛选${activeAdvancedFilters ? ` · ${activeAdvancedFilters}` : ""}</button></div></div><div class="content-filter-summary"><span class="content-filter-summary-label">当前视图</span><b>${escapeHtml(activeFilterSummary)}</b><span>${filtered.length + (selectedPlanProgress?.missing || 0)} 项</span>${activeAdvancedFilters || ui.articleSearch ? '<button class="text-button" type="button" data-action="clear-content-filters">清除条件</button>' : ""}</div>${advancedFilters}<section class="card table-card"><div class="card-header"><div><h3>${escapeHtml(filterLabel)} · 文章任务</h3><p>${description}</p></div>${headerActions}</div>${taskTable}</section>`;
}

function renderContent() {
  if (ui.contentView === "studio") return renderContentStudio();
  const actions = '<button class="secondary-button" type="button" data-nav="planning"><span data-icon="clock"></span>进入选题中心</button><button class="primary-button" type="button" data-action="open-content-studio"><span data-icon="sparkle"></span>直接创作</button>';
  if (ui.contentView === "agents") return contentPageShell(renderWritingAgents(), '<button class="secondary-button" type="button" data-nav="planning"><span data-icon="clock"></span>进入选题中心</button><button class="primary-button" type="button" data-action="create-writing-agent"><span data-icon="plus"></span>创建智能体</button>');
  return contentPageShell(ui.articleTaskView === "plans" ? renderContentPlanTasks() : renderContentArticleList(), actions);
}

function articleAssetRecords() {
  if (syncPublishedAssetTracking()) saveState();
  const trackedWorks = state.monitoring?.trackedWorks || [];
  const activeLine = activeBusinessLine();
  return state.articles
    .filter((article) => (!activeLine?.id || contentArticleBusinessLineId(article) === activeLine.id)
      && (article.status === "published" || article.siteStatus === "published" || Boolean(serverContentAssetForArticle(article.contentArticleId || article.id))))
    .map((article) => {
      const plan = contentPlanForArticle(article);
      const topic = article.topicId ? state.topics.find((item) => item.id === article.topicId) : null;
      const tasks = state.publishTasks.filter((task) => task.articleId === article.id && (!task.version || task.version === article.version));
      const targetMap = new Map();
      tasks.forEach((task) => Object.entries(task.targets || {}).forEach(([platform, target]) => {
        const previous = targetMap.get(platform);
        if (!previous || Number(target.updatedAt || 0) >= Number(previous.updatedAt || 0)) {
          targetMap.set(platform, { ...cloneData(target), platform, taskId: task.id, groupName: task.groupName });
        }
      }));
      const targets = [...targetMap.values()];
      const successful = targets.filter((target) => target.status === "success").length;
      const actionable = targets.filter((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target.status)).length;
      const websiteTarget = targets.find((target) => target.platform === "web");
      const trackedMatches = trackedWorks.filter((item) => item.articleId === article.id || (!item.articleId && item.title === article.title));
      const queryBinding = monitoringBindingsForArticle(article.id);
      const serverAsset = serverContentAssetForArticle(article.contentArticleId || article.id);
      const localPublications = [...new Map(trackedMatches.flatMap((item) => trackedWorkPublications(item)).map((item) => [item.canonicalUrl, item])).values()];
      const publications = serverAsset ? [] : localPublications;
      (serverAsset?.publications || []).forEach((publication) => {
        const normalized = normalizeTrackedUrl(publication.canonicalUrl || publication.url);
        if (!normalized || publications.some((item) => item.canonicalUrl === normalized)) return;
        publications.push({ ...publication, canonicalUrl: normalized, articleVersion: publication.articleVersionId || null, updatedAt: publication.updatedAt || Date.now() });
      });
      const publicationWebsite = publications.find((item) => item.platform === "web");
      const sourceUrl = websiteTarget?.remoteUrl || article.siteUrl || publicationWebsite?.url || "";
      const citationSummary = serverAsset?.citationSummary || { citationCount: 0, evidenceCount: 0, questionCount: 0, platformCount: 0, firstCitedAt: null, lastCitedAt: null };
      const recentCitations = Array.isArray(serverAsset?.recentCitations) ? serverAsset.recentCitations : [];
      const assetAlerts = Array.isArray(serverAsset?.alerts) ? serverAsset.alerts : [];
      const citationCount = Number(citationSummary.citationCount || 0);
      const citationQuestions = Number(citationSummary.questionCount || 0);
      const tracked = citationCount ? { citedDays: new Set(recentCitations.map((item) => String(item.observedAt || "").slice(0, 10)).filter(Boolean)).size } : null;
      let lifecycle = "draft";
      if (article.reviewStatus === "pending") lifecycle = "pending_review";
      else if (actionable) lifecycle = "needs_action";
      else if (article.status === "published" || successful) lifecycle = tracked ? "monitoring" : "published";
      else if (article.reviewStatus === "approved") lifecycle = "ready";
      return {
        id: "ASSET-" + article.id,
        article,
        plan,
        topic,
        line: state.businessLines.find((item) => item.id === contentArticleBusinessLineId(article)),
        targets,
        targetCount: targets.length,
        successful,
        actionable,
        sourceUrl,
        sourceHealth: sourceUrl ? "healthy" : (article.status === "published" ? "pending" : "missing"),
        tracked,
        serverAsset,
        publications,
        publicationWebsite,
        queryBinding,
        citationCount,
        citationQuestions,
        citationSummary,
        recentCitations,
        alerts: assetAlerts,
        lifecycle,
        lastActivity: targets.reduce((latest, target) => Math.max(latest, Number(target.updatedAt || 0)), Number(article.updatedAt || 0))
      };
    });
}

function assetLifecycleBadge(record) {
  const meta = {
    draft: ["草稿资产", "status-draft"],
    pending_review: ["待人工审核", "status-review"],
    ready: ["待发布", "status-approved"],
    published: ["已发布", "status-published"],
    monitoring: ["监测中", "status-running"],
    needs_action: ["需要处理", "status-error"]
  }[record.lifecycle] || ["待整理", "status-draft"];
  return `<span class="status-badge ${meta[1]}">${meta[0]}</span>`;
}

function assetSourceBadge(record) {
  const meta = {
    healthy: ["已建立主信源地址", "status-approved"],
    pending: ["主信源待核验", "status-pending"],
    missing: ["尚未建立主信源", "status-draft"]
  }[record.sourceHealth] || ["未检测", "status-draft"];
  return `<span class="small-tag asset-source-status ${meta[1]}">${meta[0]}</span>`;
}

function renderAssetPlatforms(record) {
  if (!record.targets.length) return '<div class="asset-empty-note"><span data-icon="send"></span><span>还没有发布任务；审核通过后可从发布运营创建官网或平台任务。</span></div>';
  return `<div class="asset-platform-list">${record.targets.map((target) => {
    const meta = PLATFORM_META[target.platform] || { name: target.platform, short: "平", logoClass: "web" };
    const url = target.remoteUrl || "";
    return `<div class="asset-platform-row"><div class="asset-platform-name">${platformLogo(target.platform)}<span><b>${escapeHtml(meta.name)}</b><small>${escapeHtml(target.account || "未绑定账号")}</small></span></div><div>${statusBadge(target.status)}${url ? `<a class="asset-url" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开信源</a>` : '<small class="asset-url-muted">等待地址</small>'}</div><small class="asset-platform-time">${target.updatedAt ? formatRelative(target.updatedAt) : "尚未执行"}</small></div>`;
  }).join("")}</div>`;
}

function renderAssetPublications(record) {
  const publications = record.publications || [];
  const rows = publications.map((publication) => {
    const meta = PLATFORM_META[publication.platform] || { name: publication.platformName || "其他平台", short: "平", logoClass: "generic" };
    const sourceLabel = publication.source === "publish_sync" ? "自动追踪" : "手动添加";
    const health = ({ unchecked: ["未检测", ""], healthy: ["可访问", "green"], redirected: ["有跳转", "blue"], changed: ["内容变化", "amber"], unreachable: ["不可访问", "amber"], blocked: ["已阻止", "amber"] })[publication.healthStatus] || ["已记录", ""];
    const serverManaged = Boolean(record.serverAsset?.id && publication.assetId === record.serverAsset.id && publication.id);
    return `<div class="asset-publication-row"><div class="asset-platform-name">${platformLogo(publication.platform)}<span><b>${escapeHtml(publication.platformName || meta.name)}</b><small>${sourceLabel} · ${publication.lastCheckedAt ? `检测于 ${formatRelative(publication.lastCheckedAt)}` : publication.updatedAt ? formatRelative(publication.updatedAt) : "已记录"}</small></span></div><a class="asset-url asset-publication-url" href="${escapeHtml(publication.url)}" target="_blank" rel="noreferrer">${escapeHtml(publication.url)}</a><div class="asset-publication-actions"><span class="small-tag ${health[1]}">${health[0]}</span>${serverManaged ? `<button class="link-button" type="button" data-action="asset-check-publication" data-asset-id="${escapeHtml(record.serverAsset.id)}" data-publication-id="${escapeHtml(publication.id)}">检测</button>${publication.source === "manual" ? `<button class="link-button danger-text" type="button" data-action="asset-remove-publication" data-asset-id="${escapeHtml(record.serverAsset.id)}" data-publication-id="${escapeHtml(publication.id)}">移除</button>` : ""}` : ""}</div></div>`;
  }).join("");
  return `<div class="asset-publications"><div class="asset-publication-head"><div><b>引用追踪地址</b><small>官网与成功发布的平台会自动加入，也可以补充其他平台 URL。</small></div><button class="secondary-button button-small" type="button" data-action="asset-add-publication" data-article-id="${escapeHtml(record.article.id)}"><span data-icon="plus"></span>添加其他平台 URL</button></div>${rows || '<div class="asset-publication-empty">发布成功后，系统会自动记录可追踪地址。</div>'}</div>`;
}

function renderAssetCitationFacts(record) {
  const citations = record.recentCitations || [];
  const alerts = record.alerts || [];
  const citationRows = citations.map((citation) => `<div class="asset-citation-row"><div><b>${escapeHtml(citation.platform || "AI 平台")} · ${escapeHtml(citation.question || "未记录问题")}</b><small>${escapeHtml(citation.sourceTitle || citation.canonicalSourceUrl || "引用来源")} · ${citation.observedAt ? formatDateTime(citation.observedAt) : "时间待确认"}</small></div><span>${escapeHtml(citation.terminal || "web")} / ${escapeHtml(citation.mode || "fast")}</span><a href="${escapeHtml(citation.sourceUrl)}" target="_blank" rel="noreferrer">打开引用</a></div>`).join("");
  const alertRows = alerts.map((alert) => `<div class="asset-alert-row ${escapeHtml(alert.severity || "warning")}"><span data-icon="${alert.severity === "critical" ? "alert" : "info"}"></span><div><b>${escapeHtml(alert.title)}</b><small>${escapeHtml(alert.message || "")} · ${alert.lastSeenAt ? formatDateTime(alert.lastSeenAt) : ""}</small></div></div>`).join("");
  return `<div class="asset-citation-facts"><section><header><b>真实 AI 引用记录</b><small>只统计已验证的实时检测证据，按来源 URL 与发布地址精确匹配。</small></header>${citationRows || '<div class="asset-publication-empty">尚未发现与这篇文章精确匹配的已验证 AI 引用。</div>'}</section><section><header><b>资产提醒</b><small>自动巡检会记录地址异常、内容变化、首次引用和引用长期未更新。</small></header>${alertRows || '<div class="asset-publication-empty">当前没有待处理提醒。</div>'}</section></div>`;
}

function renderAssetDetail(record) {
  const article = record.article;
  const knowledgeCount = articleCitations(article).length;
  const monitorText = record.tracked
    ? `已记录 ${record.citationQuestions} 个问题、${record.citationCount} 次引用，最近引用 ${record.citationSummary?.lastCitedAt ? formatDateTime(record.citationSummary.lastCitedAt) : "待确认"}`
    : "系统将持续巡检发布地址，并自动关联后续返回的已验证 AI 引用证据。";
  return `<div class="asset-detail"><div class="asset-detail-grid"><section><div class="asset-detail-head"><div><h4>发布渠道与信源</h4><p>官网是主信源，其他平台是分发信源；每个平台独立记录状态。</p></div><span class="small-tag blue">${record.successful}/${record.targetCount || 0} 完成</span></div>${renderAssetPlatforms(record)}${renderAssetPublications(record)}</section><section><div class="asset-detail-head"><div><h4>引用监测</h4><p>系统自动将已验证 AI 回答中的来源 URL 与这篇文章的发布地址关联。</p></div><span class="small-tag ${record.tracked ? "green" : "amber"}">${record.tracked ? "已有真实引用" : "等待真实引用"}</span></div><div class="asset-monitor-card"><span class="asset-monitor-icon" data-icon="chart"></span><div><b>${record.tracked ? `${record.citationCount} 次引用` : "自动追踪中"}</b><small>${escapeHtml(monitorText)}</small></div></div><div class="asset-detail-links"><button class="link-button" type="button" data-nav="effect-monitor">进入品牌监测</button></div></section></div>${renderAssetCitationFacts(record)}<div class="asset-detail-footer"><span><b>知识快照</b> ${knowledgeCount ? `${knowledgeCount} 条企业证据 · ${article.knowledgeSnapshot?.frozenAt || article.reviewStatus === "approved" ? "已冻结" : "待冻结"}` : "未建立可追溯证据"}</span><span><b>来源计划</b> ${escapeHtml(record.plan?.name || "直接创作")}</span><span><b>当前版本</b> ${escapeHtml(article.version || "v1")}</span><div class="asset-detail-actions"><button class="secondary-button button-small" type="button" data-action="open-asset-article" data-article-id="${article.id}">查看文章</button><button class="secondary-button button-small" type="button" data-action="asset-new-version" data-article-id="${article.id}">创建新版本</button></div></div></div>`;
}

function renderAssets() {
  if (!contentAssetSnapshot.attempted && !contentAssetSnapshot.loading) queueMicrotask(() => syncLocalContentAssetsToServer({ renderAfter: true }));
  const records = articleAssetRecords();
  const search = String(ui.assetSearch || "").trim().toLowerCase();
  const visible = records.filter((record) => {
    if (ui.assetTab === "published" && !["published", "monitoring", "needs_action"].includes(record.lifecycle)) return false;
    if (ui.assetTab === "ready" && !["ready", "pending_review", "draft"].includes(record.lifecycle)) return false;
    if (ui.assetTab === "needs" && record.lifecycle !== "needs_action") return false;
    if (search && ![record.article.title, record.plan?.name, record.topic?.title, record.article.id].filter(Boolean).join(" ").toLowerCase().includes(search)) return false;
    return true;
  });
  const publishedCount = records.filter((record) => ["published", "monitoring", "needs_action"].includes(record.lifecycle)).length;
  const monitoringCount = records.filter((record) => record.lifecycle === "monitoring").length;
  const needsCount = records.filter((record) => record.lifecycle === "needs_action").length;
  const totalCitations = records.reduce((sum, record) => sum + record.citationCount, 0);
  const tabs = [["all", "全部资产", records.length], ["published", "已发布", publishedCount], ["ready", "待发布 / 待审核", records.length - publishedCount], ["needs", "需要处理", needsCount]];
  const rows = visible.map((record) => {
    const article = record.article;
    const expanded = ui.assetExpandedId === record.id;
    const publishText = record.targetCount ? `${record.successful}/${record.targetCount} 平台完成` : "未创建发布任务";
    const citationText = record.tracked ? `${record.citationCount} 次引用 · ${record.citationQuestions} 个问题` : "等待真实引用";
    return `<article class="card asset-card ${expanded ? "is-expanded" : ""}"><div class="asset-card-main"><div class="asset-card-title"><span class="asset-kind-icon" data-icon="file"></span><div><div class="asset-title-line"><button class="asset-title-button" type="button" data-action="open-asset-article" data-article-id="${article.id}">${escapeHtml(article.title)}</button><span class="small-tag">${escapeHtml(article.version || "v1")}</span></div><p>${escapeHtml(record.plan?.name || "直接创作")} · ${escapeHtml(record.topic?.title || "未关联选题")} · ${escapeHtml(record.line?.name || "未关联业务线")}</p></div></div><div class="asset-card-actions">${assetLifecycleBadge(record)}<button class="secondary-button button-small" type="button" data-action="asset-expand" data-asset-id="${record.id}">${expanded ? "收起管理" : "管理资产"}</button></div></div><div class="asset-card-metrics"><div><small>发布渠道</small><b>${escapeHtml(publishText)}</b><span>${record.publications?.length ? `${record.publications.length} 个 URL 已纳入引用追踪` : record.targetCount ? "官网 / 内容平台独立记录" : "审核通过后创建任务"}</span></div><div><small>官网主信源</small><b>${assetSourceBadge(record)}</b><span>${record.sourceUrl ? escapeHtml(record.sourceUrl) : "尚未生成官网地址"}</span></div><div><small>AI 引用分析</small><b class="asset-citation-value">${escapeHtml(citationText)}</b><span>${record.tracked ? "最近一次已记录引用" : "发布地址已自动纳入追踪"}</span></div><div><small>最近活动</small><b>${record.lastActivity ? formatRelative(record.lastActivity) : "—"}</b><span>${escapeHtml(article.id)} · ${escapeHtml(article.author || "未分配")}</span></div></div>${expanded ? renderAssetDetail(record) : ""}</article>`;
  }).join("");
  return `<div class="page-container">${pageHead("内容资产", "一篇文章建立一个长期资产，统一管理文章版本、官网主信源、多平台发布记录和真实 AI 引用分析。", '<button class="secondary-button" type="button" data-action="refresh-assets"><span data-icon="refresh"></span>刷新</button><button class="secondary-button" type="button" data-nav="content"><span data-icon="file"></span>进入内容生产</button><button class="primary-button" type="button" data-nav="publish"><span data-icon="send"></span>查看发布任务</button>')}<div class="asset-summary"><article class="card summary-card"><span data-icon="file"></span><div><b>${records.length}</b><small>内容资产</small></div></article><article class="card summary-card"><span class="green" data-icon="globe"></span><div><b>${publishedCount}</b><small>已进入发布</small></div></article><article class="card summary-card"><span class="purple" data-icon="chart"></span><div><b>${monitoringCount}</b><small>已有真实引用</small></div></article><article class="card summary-card"><span class="amber" data-icon="link"></span><div><b>${totalCitations}</b><small>已验证引用</small></div></article></div><div class="asset-demo-note"><span data-icon="shield"></span><div><b>引用数据来自已验证的实时 AI 检测证据。</b><small>系统按规范化来源 URL 与官网及各发布平台地址精确匹配；没有真实证据时保持为空，不使用演示引用数补齐。</small></div></div><section class="card asset-workspace"><div class="asset-toolbar"><div class="tabs">${tabs.map(([id, label, count]) => `<button class="tab-button ${ui.assetTab === id ? "active" : ""}" type="button" data-action="asset-tab" data-tab="${id}">${label} · ${count}</button>`).join("")}</div><div class="asset-filter-tools"><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.assetSearch || "")}" placeholder="搜索文章、计划或选题" aria-label="搜索内容资产" data-asset-search /></div><button class="secondary-button button-small" type="button" data-action="asset-clear-search">清空</button></div></div>${rows ? `<div class="asset-list">${rows}</div>` : '<div class="empty-state"><div><span data-icon="file"></span><h3>没有符合条件的内容资产</h3><p>可以先在内容生产中生成文章，通过审核后会自动进入这里。</p><button class="primary-button button-small" type="button" data-nav="content">进入内容生产</button></div></div>'}</section></div>`;
}

function publishBatchEligibleArticle(article) {
  return articlePublishEligibility(article);
}

function publishBatchArticles() {
  const line = activeBusinessLine();
  const query = String(ui.publishBatchArticleSearch || "").trim().toLowerCase();
  return state.articles
    .filter((article) => !line?.id || contentArticleBusinessLineId(article) === line.id)
    .filter((article) => !query || [article.title, article.id, contentPlanForArticle(article)?.name].filter(Boolean).join(" ").toLowerCase().includes(query))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function publishBatchGroup() {
  const selection = ui.publishBatchSelection || {};
  return state.accountGroups.find((group) => group.id === selection.groupId) || state.accountGroups[0] || null;
}

function publishBatchPlatformEntry(platformId) {
  return PUBLISH_PLATFORM_REGISTRY.find((entry) => entry.id === platformId) || null;
}


function publishBatchPlatformState(entry, group, selectedArticles) {
  if (!entry) return { available: false, status: "not_connected", reason: "平台不存在" };
  if (!entry.enabled) return { available: false, status: entry.support === "planned" ? "planned" : "not_connected", reason: entry.description || "该平台当前不可用" };
  const existingCount = selectedArticles.filter((article) => articleExistingPublishPlatforms(article).has(entry.id)).length;
  const existingState = { existingCount, skippedCount: existingCount };
  if (entry.id === "web") return { available: true, status: "online", reason: `${state.site.domain} · 服务器发布`, ...existingState };
  const catalog = publisherPlatform(entry.id);
  if (publisherSnapshot.loaded && (!catalog || !catalog.enabled)) return { available: false, status: "not_connected", reason: "本地发布器未声明该平台", ...existingState };
  const device = (publisherSnapshot.devices || []).find((item) => (
    (group?.deviceId && item.id === group.deviceId)
      || (!group?.deviceId && (item.accountGroups || []).some((itemGroup) => itemGroup.id === group?.id))
  ));
  if (!device || device.status !== "online") {
    return { available: false, status: "device_offline", reason: "本地发布器尚未在线同步", ...existingState };
  }
  const capabilities = new Set((device.capabilities || []).map(canonicalPublishPlatformId));
  if (!capabilities.has(canonicalPublishPlatformId(entry.id))) {
    return { available: false, status: "not_capable", reason: "本地发布器尚未同步该平台能力", ...existingState };
  }
  const connection = publisherAccountConnection(group, entry.id);
  const account = connection.account;
  if (!account) return { available: false, status: "not_connected", reason: "当前账号组尚未绑定账号", ...existingState };
  if (!connection.ready) return { available: false, status: connection.status, reason: publisherConnectionMessage(connection), ...existingState };
  return {
    available: true,
    status: "online",
    reason: publisherConnectionMessage(connection),
    session: connection.session,
    ...existingState
  };
}

function publishBatchCategoryTabs() {
  const categories = [
    ["self_media", "自媒体账号", "账号登录后由本地助手执行"],
    ["official", "企业官网 / 微门户", "企业主信源与站点内容"]
  ];
  return categories.map(([id, label, description]) => `<button class="publish-category-tab ${ui.publishBatchCategory === id ? "active" : ""}" type="button" data-action="publish-batch-category" data-category="${id}"><b>${label}</b><small>${description}</small></button>`).join("");
}

function publishBatchPlatformCards() {
  const selection = ui.publishBatchSelection || { platforms: [], platformOrder: [] };
  const group = publishBatchGroup();
  const selectedArticles = state.articles.filter((article) => (selection.articleIds || []).includes(article.id));
  const query = String(ui.publishBatchSearch || "").trim().toLowerCase();
  const entries = PUBLISH_PLATFORM_REGISTRY.filter((entry) => entry.enabled !== false && entry.category === ui.publishBatchCategory && (!query || [entry.id, PLATFORM_META[entry.id]?.name, entry.role, entry.capabilities].join(" ").toLowerCase().includes(query)));
  const cards = entries.map((entry) => {
    const stateMeta = publishBatchPlatformState(entry, group, selectedArticles);
    const formal = FORMAL_PUBLISH_PLATFORM_IDS.has(entry.id);
    const selected = (selection.platforms || []).includes(entry.id) && stateMeta.available && formal;
    const status = stateMeta.status;
    const platform = PLATFORM_META[entry.id] || { name: entry.id, short: "平", logoClass: "generic" };
    const skipNote = Number(stateMeta.existingCount || 0) > 0 ? `<em class="publish-platform-skip-note">${stateMeta.existingCount} 篇已有该平台任务，本次将跳过</em>` : "";
    return `<label class="publish-platform-card ${selected ? "selected" : ""} ${stateMeta.available && formal ? "" : "disabled"}"><div class="publish-platform-card-top"><input class="checkbox" type="checkbox" data-publish-batch-platform="${entry.id}" ${selected ? "checked" : ""} ${stateMeta.available && formal ? "" : "disabled"} />${platformLogo(entry.id)}<span class="publish-platform-card-name"><b>${escapeHtml(platform.name)}</b><small>${escapeHtml(entry.role)}</small></span>${formal ? statusBadge(status) : '<span class="small-tag">规划中</span>'}</div><div class="publish-platform-card-meta"><span>${escapeHtml(entry.capabilities)}</span><span>${formal ? escapeHtml(stateMeta.reason) : "首期未正式支持，暂不可发布"}</span></div>${skipNote}${entry.id === "web" ? '<em class="publish-platform-role">推荐主信源</em>' : ""}</label>`;
  }).join("");
  return cards || '<div class="empty-state compact"><div><span data-icon="search"></span><h3>没有匹配的平台</h3><p>换一个平台名称或切换平台分类。</p></div></div>';
}

function publishBatchArticleRows() {
  const selection = ui.publishBatchSelection || { articleIds: [] };
  const rows = publishBatchArticles().slice(0, 40).map((article) => {
    const eligibility = publishBatchEligibleArticle(article);
    const plan = contentPlanForArticle(article);
    const selected = selection.articleIds.includes(article.id);
    const status = articleDisplayStatus(article);
    const disabled = !eligibility.ok;
    return `<label class="publish-article-row ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}"><input class="checkbox" type="checkbox" data-publish-batch-article="${article.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""} /><span class="publish-article-row-copy"><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(plan?.name || "直接创作")} · ${escapeHtml(article.version || "v1")}</small></span><span class="publish-article-row-status">${statusBadge(status)}<small>${escapeHtml(eligibility.ok ? "可发布" : eligibility.reason)}</small></span></label>`;
  }).join("");
  return rows || '<div class="empty-state compact"><div><span data-icon="file"></span><h3>没有可选择的文章</h3><p>请先在内容生产中完成文章审核和知识证据冻结。</p><button class="primary-button button-small" type="button" data-nav="content">去内容生产</button></div></div>';
}

function publishBatchOrderChips() {
  const order = ui.publishBatchSelection?.platformOrder || [];
  return order.map((platform, index) => `<span class="publish-order-chip">${index + 1}. ${escapeHtml(PLATFORM_META[platform]?.name || platform)}<button type="button" data-action="move-publish-batch-platform" data-platform="${platform}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-publish-batch-platform" data-platform="${platform}" data-direction="down" ${index === order.length - 1 ? "disabled" : ""}>↓</button></span>`).join("");
}

function renderPublishComposer() {
  const selection = ui.publishBatchSelection || { articleIds: [], platforms: [], platformOrder: [], groupId: state.accountGroups[0]?.id || null, mode: "immediate", intervalMinutes: 60 };
  const selectedArticles = state.articles.filter((article) => selection.articleIds.includes(article.id));
  const selectedPlatforms = selection.platformOrder || selection.platforms || [];
  const group = publishBatchGroup();
  const availableCount = selectedArticles.reduce((sum, article) => sum + selectedPlatforms.filter((platform) => !articleExistingPublishPlatforms(article).has(platform)).length, 0);
  const groups = state.accountGroups.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === group?.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.deviceName || "本地设备")}</option>`).join("");
  const availablePlatformCount = PUBLISH_PLATFORM_REGISTRY.filter((entry) => FORMAL_PUBLISH_PLATFORM_IDS.has(entry.id) && publishBatchPlatformState(entry, group, selectedArticles).available).length;
  const mode = selection.mode || "immediate";
  return `<div class="page-container publish-composer-page">${pageHead("新建发布批次", "先选择通过人工审核的文章，再选择多个平台；平台账号、顺序和间隔只影响发布执行，不改变文章版本。", '<button class="secondary-button" type="button" data-action="back-to-publish-tasks"><span data-icon="arrow"></span>返回发布任务</button>')}<div class="publish-flow-steps"><span class="active"><i>1</i>选择文章</span><b>→</b><span class="active"><i>2</i>选择平台</span><b>→</b><span><i>3</i>配置执行</span><b>→</b><span><i>4</i>发布回写</span></div><div class="publish-composer-grid"><section class="card publish-composer-section publish-article-picker"><div class="publish-composer-section-head"><div><h3>选择文章</h3><p>只有完成审核、风控和知识证据冻结的当前版本可以发布。</p></div><span class="small-tag blue">已选 ${selectedArticles.length} 篇</span></div><div class="publish-picker-toolbar"><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.publishBatchArticleSearch || "")}" placeholder="搜索文章、计划或编号" aria-label="搜索待发布文章" data-publish-batch-article-search /></div><button class="secondary-button button-small" type="button" data-action="publish-batch-select-eligible">选择全部可发布</button></div><div class="publish-article-list">${publishBatchArticleRows()}</div></section><section class="card publish-composer-section publish-platform-picker"><div class="publish-composer-section-head"><div><h3>选择发布平台</h3><p>同一篇文章可以发布多个平台，但同一平台只允许一个账号。</p></div><span class="small-tag green">${availablePlatformCount} 个可用</span></div><div class="publish-platform-actions"><button class="secondary-button button-small" type="button" data-action="publish-batch-select-all"><span data-icon="sparkle"></span>全平台智能分发</button><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.publishBatchSearch || "")}" placeholder="搜索平台" aria-label="搜索发布平台" data-publish-batch-platform-search /></div></div><div class="publish-category-tabs">${publishBatchCategoryTabs()}</div><div class="publish-platform-grid">${publishBatchPlatformCards()}</div><div class="publish-platform-note"><span data-icon="info"></span><span>官网不强制勾选；已登录的平台可直接下发至本地发布助手。若平台执行时出现验证码、审核或发布限制，任务结果会单独回写，不会影响其他平台。</span></div></section></div><section class="card publish-composer-section publish-delivery-config"><div class="publish-composer-section-head"><div><h3>账号与执行规则</h3><p>本地助手按照平台顺序执行，每发送一篇后等待设定间隔，再继续下一篇。</p></div><span class="small-tag">${selectedPlatforms.length} 个平台</span></div><div class="publish-config-grid"><label class="field"><span>发布账号组</span><select class="select" data-publish-batch-group>${groups}</select><small>账号登录和分类在本地发布助手中维护，后台只同步账号别名和状态。</small></label><label class="field"><span>文章间隔（分钟）</span><input class="input" type="number" min="5" max="1440" step="5" value="${escapeHtml(selection.intervalMinutes || 60)}" data-publish-batch-interval /><small>适用于同一平台的下一篇文章。</small></label><div class="publish-mode-picker"><span>发布方式</span><div class="publish-mode-options"><label class="publish-mode-option ${mode === "immediate" ? "active" : ""}"><input type="radio" name="publish-batch-mode" value="immediate" data-publish-batch-mode ${mode === "immediate" ? "checked" : ""} /><b>立即发布</b><small>创建任务后由本地助手按顺序领取</small></label><label class="publish-mode-option ${mode === "schedule" ? "active" : ""}"><input type="radio" name="publish-batch-mode" value="schedule" data-publish-batch-mode ${mode === "schedule" ? "checked" : ""} /><b>定时排期</b><small>继续设置每天数量、时间和预计完成日期</small></label></div></div></div><div class="publish-order-config"><span>执行顺序</span><div class="publish-order-chips">${publishBatchOrderChips() || '<small>选择平台后可调整顺序</small>'}</div></div></section><section class="card publish-batch-summary"><div><span class="publish-summary-icon" data-icon="send"></span><div><b>${selectedArticles.length} 篇文章 × ${selectedPlatforms.length} 个平台</b><small>将创建 ${availableCount} 条平台发布任务；文章资产仍按文章版本独立管理。</small></div></div><div class="publish-summary-actions"><button class="secondary-button" type="button" data-action="publish-batch-preflight" ${selectedArticles.length && selectedPlatforms.length ? "" : "disabled"}><span data-icon="shield"></span>检查发布条件</button><button class="primary-button" type="button" data-action="submit-publish-batch" ${selectedArticles.length && selectedPlatforms.length ? "" : "disabled"}>${mode === "schedule" ? '<span data-icon="clock"></span>进入定时排期' : '<span data-icon="send"></span>立即创建发布任务'}</button></div></section></div>`;
}

function openPublishBatch(articleIds = []) {
  const available = state.articles.filter((article) => articleBusinessLineIsActive(article) && publishBatchEligibleArticle(article).ok);
  const requested = [...new Set(articleIds)].map((id) => state.articles.find((article) => article.id === id)).filter((article) => article && available.some((item) => item.id === article.id));
  const selectedArticles = requested.length ? requested : available.slice(0, 1);
  const group = state.accountGroups[0] || null;
  const platforms = PUBLISH_PLATFORM_REGISTRY.filter((entry) => publishBatchPlatformState(entry, group, selectedArticles).available).map((entry) => entry.id);
  ui.publishBatchSelection = { articleIds: selectedArticles.map((article) => article.id), groupId: group?.id || null, platforms, platformOrder: [...platforms], intervalMinutes: 60, mode: "immediate" };
  ui.publishBatchCategory = "self_media";
  ui.publishBatchSearch = "";
  ui.publishBatchArticleSearch = "";
  ui.publishView = "compose";
  closeModal();
  navigate("publish");
}

function openScheduleFromPublishBatch() {
  const selection = ui.publishBatchSelection;
  if (!selection?.articleIds?.length) return showToast("请先选择文章", "定时发布需要至少选择一篇通过审核的文章。", "error");
  if (!selection.platformOrder?.length) return showToast("请先选择平台", "请选择至少一个可用平台。", "error");
  const eligible = selection.articleIds.filter((id) => articlePublishEligibility(state.articles.find((article) => article.id === id)).ok);
  if (!eligible.length) return showToast("没有可排期文章", "选中的文章必须完成审核、风控和知识证据冻结。", "error");
  ui.scheduleSelection = { ...scheduleDefaultSelection(eligible), groupId: selection.groupId, platforms: [...selection.platformOrder], platformOrder: [...selection.platformOrder], intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60) };
  ui.publishView = "tasks";
  ui.modal = { type: "schedule" };
  renderModal();
}


async function submitPublishBatch() {
  const selection = ui.publishBatchSelection;
  if (!selection?.articleIds?.length) return showToast("请先选择文章", "请选择至少一篇文章。", "error");
  if (!selection.platformOrder?.length) return showToast("请先选择平台", "请选择至少一个可用平台。", "error");
  if (selection.mode === "schedule") return openScheduleFromPublishBatch();
  if (!(await ensurePublisherIntegration())) return;
  // The composer can stay open while the desktop assistant pairs or sends its
  // first heartbeat. Always refresh immediately before creating jobs so the
  // selection cannot use a stale "connected" snapshot.
  if (!(await refreshPublisherSnapshot())) {
    return showToast("发布器状态未同步", publisherSnapshot.error || "请等待桌面发布器完成一次心跳后重试。", "error");
  }
  const group = publishBatchGroup();
  const articles = selection.articleIds.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
  const unavailable = selection.platformOrder
    .map((platformId) => {
      if (platformId === "web") return null;
      const entry = publishBatchPlatformEntry(platformId);
      const status = publishBatchPlatformState(entry, group, articles);
      return status.available ? null : `${entry?.name || platformId}：${status.reason}`;
    })
    .filter(Boolean);
  if (unavailable.length) {
    return showToast("发布器尚未完成同步", unavailable.join("；"), "error");
  }
  const created = [];
  let skippedPairs = 0;
  for (const article of articles) {
    const eligibility = articlePublishEligibility(article);
    if (!eligibility.ok) continue;
    const platforms = selection.platformOrder.filter((platform) => {
      if (articleExistingPublishPlatforms(article).has(platform)) { skippedPairs++; return false; }
      return true;
    });
    if (!platforms.length) continue;
    let formal;
    try { formal = await contentPublisherPayload(article); } catch (error) {
      article.contentSyncError = error.message || "正式文章版本不可发布";
      continue;
    }
    const result = await publisherApi("/api/publisher/jobs", {
      method: "POST",
      body: {
        ...formal,
        webUrl: publisherArticleWebUrl(article),
        accountGroupId: group?.id,
        groupName: group?.name,
        platforms,
        platformOrder: platforms,
        intervalMinutes: Math.max(5, Number(selection.intervalMinutes) || 60),
        mode: "immediate"
      }
    });
    if (result.job) created.push(result.job);
  }
  if (!created.length) {
    if (skippedPairs) return showToast("所选文章均已发布过所选平台", "已发布过的文章不会重复创建任务，请取消勾选已发布的平台或选择其他文章。", "warning");
    return showToast("没有可创建的任务", "请确认文章已审核，并且账号组中存在已登录的平台账号。", "error");
  }
  ui.publishBatchSelection = null;
  ui.publishView = "tasks";
  ui.publishTab = "running";
  await refreshPublisherSnapshot();
  navigate("publish");
  showToast("发布任务已交给本地发布器", `${created.length} 篇文章已进入平台任务队列，等待本地软件按顺序领取。${skippedPairs ? `已跳过 ${skippedPairs} 个已发布过的文章-平台组合。` : ""}`);
}

function taskNeedsAction(task) {
  return Object.values(task?.targets || {}).some((target) => ["failed", "needs_login", "needs_verification", "draft_saved", "result_unknown"].includes(target?.status));
}

function renderPublish() {
  if (ui.publishView === "compose") return renderPublishComposer();
  const runningCount = state.publishTasks.filter((task) => ["queued", "running"].includes(task.status)).length;
  const actionCount = state.publishTasks.filter(taskNeedsAction).length;
  const successCount = state.publishTasks.filter((task) => task.status === "success").length;
  const scheduleCount = (state.publishSchedules || []).filter((schedule) => schedule.status !== "cancelled").length;
  const readyCount = state.articles.filter((article) => article.reviewStatus === "approved" && article.status === "draft" && articleCitations(article).length && article.riskStatus === "clean" && articleBusinessLineIsActive(article)).length;
  const tabs = [["all", "全部任务"], ["running", "进行中"], ["action", "需要处理"], ["success", "发布成功"]];

  const filtered = state.publishTasks.filter((task) => {
    if (ui.publishTab === "running") return ["queued", "running"].includes(task.status);
    if (ui.publishTab === "action") return taskNeedsAction(task);
    if (ui.publishTab === "success") return task.status === "success";
    return true;
  });

  const tabHtml = tabs.map(([id, label]) => {
    const count = id === "all" ? state.publishTasks.length : id === "running" ? runningCount : id === "action" ? actionCount : successCount;
    return '<button class="tab-button ' + (ui.publishTab === id ? "active" : "") + '" type="button" data-action="publish-tab" data-tab="' + id + '">' + label + " · " + count + "</button>";
  }).join("");

  const tasks = filtered.map((task) => {
    const targetHtml = Object.entries(task.targets || {}).map(([platform, target]) => {
        const meta = PLATFORM_META[platform] || { name: publishPlatformName(platform) };
        const result = target?.status === "success"
        ? target.remoteUrl
          ? '<a href="' + escapeHtml(target.remoteUrl) + '" target="_blank" rel="noreferrer">打开发布地址</a>'
          : '<button class="link-button" type="button" data-action="task-log" data-task-id="' + task.id + '">查看回写详情</button>'
          : ["draft_saved", "result_unknown", "needs_verification"].includes(target?.status)
            ? '<span class="target-state-copy">' + escapeHtml(target?.message || (target?.status === "draft_saved" ? "草稿已保存，等待完成平台发布" : "尚未确认公开发布")) + '</span><button class="link-button verify-publish-button" type="button" data-action="verify-result" data-task-id="' + task.id + '" data-platform="' + escapeHtml(platform) + '">检查发布状态</button>'
            : ["queued", "running"].includes(target?.status)
            ? "本地助手正在处理"
            : "等待处理";
      return `
        <div class="publish-target">
          <div class="platform-name"><span class="platform-label">${platformLogo(platform)}<span>${meta.name}</span></span>${statusBadge(target.status)}</div>
          <div class="target-result">${escapeHtml(target?.account || "未绑定账号")} · ${result}</div>
        </div>
      `;
    }).join("");
    return `
      <article class="card publish-task">
        <div class="publish-task-head">
          <div class="publish-task-title">
            <div><h3>${escapeHtml(task.articleTitle)}</h3><span class="small-tag">${escapeHtml(task.version)}</span></div>
            <p>${escapeHtml(task.id)} · ${escapeHtml(task.groupName)} · 创建于 ${formatRelative(task.createdAt)}</p>
          </div>
          <div class="publish-task-actions">${statusBadge(task.status)}<button class="secondary-button button-small" type="button" data-action="task-log" data-task-id="${task.id}">详情</button>${task.status === "failed" || task.status === "cancelled" ? `<button class="link-button danger-link" type="button" data-action="delete-publish-task" data-task-id="${task.id}">删除</button>` : ""}</div>
        </div>
        <div class="publish-targets">${targetHtml}</div>
      </article>
    `;
  }).join("");

  return `
    <div class="page-container">
      ${pageHead("发布任务", "文章审核通过后创建发布批次；这里集中查看排期、平台执行状态、失败和结果。", '<button class="secondary-button" type="button" data-action="go-schedule-articles"><span data-icon="clock"></span>创建定时排期</button><button class="primary-button" type="button" data-action="open-publish-batch"><span data-icon="send"></span>新建发布批次</button>')}
      ${publisherSnapshot.loaded ? "" : `<div class="privacy-note warning publisher-offline-note"><span data-icon="alert"></span><span><b>发布服务未连接</b><br />${escapeHtml(publisherSnapshot.error || "正在连接本地发布器任务服务；断连期间不会创建模拟任务或伪造发布结果。")}</span><button class="secondary-button button-small" type="button" data-action="refresh-publisher"><span data-icon="refresh"></span>重新连接</button></div>`}
      <section class="publish-summary">
        <article class="card summary-card"><span data-icon="file"></span><div><b>${readyCount}</b><small>待发布文章</small></div></article>
        <article class="card summary-card"><span data-icon="clock"></span><div><b>${scheduleCount}</b><small>有效发布排期</small></div></article>
        <article class="card summary-card"><span class="purple" data-icon="send"></span><div><b>${runningCount}</b><small>执行中任务</small></div></article>
        <article class="card summary-card"><span class="red" data-icon="alert"></span><div><b>${actionCount}</b><small>需要人工处理</small></div></article>
      </section>
      ${renderPublishSchedules()}
      <div class="tabs-row"><div class="tabs">${tabHtml}</div><div class="filter-tools"><button class="secondary-button button-small" type="button" data-nav="assistant"><span data-icon="monitor"></span>账号组状态</button></div></div>
      <div class="publish-list">
        ${tasks || '<section class="card empty-state"><div><span data-icon="send"></span><h3>这里还没有任务</h3><p>从已通过文章发起一次多平台发布。</p><button class="primary-button button-small" type="button" data-action="publish-approved">选择文章</button></div></section>'}
      </div>
    </div>
  `;
}

function monitoringApiRecord(payload, keys = []) {
  const data = payload?.data ?? payload ?? {};
  for (const key of keys) {
    if (data?.[key] !== undefined) return data[key];
    if (payload?.[key] !== undefined) return payload[key];
  }
  return data;
}

function monitoringNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monitoringDisplayNumber(value, suffix = "") {
  const number = monitoringNumber(value);
  return number === null ? "—" : `${number.toLocaleString("zh-CN")}${suffix}`;
}

function monitoringMetric(source, aliases) {
  const record = source && typeof source === "object" ? source : {};
  for (const alias of aliases) {
    const value = record[alias];
    if (value && typeof value === "object") {
      const nested = monitoringNumber(value.score ?? value.value ?? value.percent ?? value.count);
      if (nested !== null) return nested;
    }
    const number = monitoringNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function monitoringDiagnostics() {
  const items = monitoringSnapshot.diagnostics;
  return Array.isArray(items) ? items : [];
}

function monitoringDiagnosticStatus(diagnostic) {
  return String(diagnostic?.status || diagnostic?.state || diagnostic?.runStatus || "").trim().toLowerCase();
}

function monitoringDiagnosticIsCompleted(diagnostic) {
  return ["completed", "complete", "success", "succeeded"].includes(monitoringDiagnosticStatus(diagnostic));
}

function monitoringDiagnosticIsTerminal(diagnostic) {
  return monitoringDiagnosticIsCompleted(diagnostic) || ["failed", "error", "cancelled", "canceled"].includes(monitoringDiagnosticStatus(diagnostic));
}

function monitoringLatestDiagnostic() {
  const overview = monitoringSnapshot.overview || {};
  const inline = overview.latestDiagnostic || overview.diagnostic || overview.websiteDiagnostic;
  return monitoringDiagnostics()[0] || inline || null;
}

function monitoringLatestCompletedDiagnostic() {
  const overview = monitoringSnapshot.overview || {};
  const candidates = [
    ...monitoringDiagnostics(),
    overview.latestDiagnostic,
    overview.diagnostic,
    overview.websiteDiagnostic
  ].filter(Boolean);
  return candidates.find(monitoringDiagnosticIsCompleted) || null;
}

function monitoringDiagnosticStateMeta(diagnostic) {
  const status = monitoringDiagnosticStatus(diagnostic);
  if (!diagnostic) return { key: "empty", label: "尚未实测", className: "pending", message: "填写可公开访问的官网地址后，开始一次网站 GEO 实测。" };
  if (monitoringDiagnosticIsCompleted(diagnostic)) return { key: "completed", label: "检测已完成", className: "success", message: "分数仅来自本次已完成的官网 HTML 检测。" };
  if (["running", "pending", "queued"].includes(status)) return { key: "running", label: status === "running" ? "检测中" : "等待检测", className: "pending", message: "正在读取官网页面，完成后才会计算分数。" };
  const failure = String(diagnostic?.errorMessage || diagnostic?.message || diagnostic?.error || "未能读取官网页面，请检查协议、端口和公网可达性后重试。").trim();
  return { key: "failed", label: "最近一次检测失败", className: "error", message: failure };
}

function monitoringRecommendationSourceMeta(diagnostic) {
  const recommendations = diagnostic?.recommendations && typeof diagnostic.recommendations === "object" && !Array.isArray(diagnostic.recommendations)
    ? diagnostic.recommendations
    : {};
  const rawGeneration = recommendations.generation;
  const generation = rawGeneration && typeof rawGeneration === "object" ? rawGeneration : {};
  const source = String(recommendations.source || (typeof rawGeneration === "string" ? rawGeneration : "") || generation.source || generation.mode || diagnostic?.suggestionGeneration?.source || diagnostic?.suggestionGeneration?.mode || "rules").trim().toLowerCase();
  const mapping = {
    rules: { key: "rules", label: "规则建议", description: "由本次页面检查规则直接生成。" },
    llm: { key: "llm", label: "AI 整理建议", description: "模型只整理已发现的问题和证据，不参与评分。" },
    rule_fallback: { key: "rule_fallback", label: "规则兜底", description: "模型建议未生成，已回退为页面规则建议。" }
  };
  const meta = mapping[source === "rule" ? "rules" : source === "fallback" ? "rule_fallback" : source] || mapping.rules;
  const provider = generation.providerName || generation.provider || generation.providerId || "";
  const model = generation.model || generation.modelName || "";
  return { ...meta, generation, modelLabel: [provider, model].filter(Boolean).join(" · ") };
}

function monitoringPriorityRecommendation(diagnostic) {
  const recommendations = diagnostic?.recommendations && typeof diagnostic.recommendations === "object" && !Array.isArray(diagnostic.recommendations)
    ? diagnostic.recommendations
    : {};
  const firstAction = (items) => Array.isArray(items) ? items.find((item) => item?.action || item?.goal || item?.title || item?.item) : null;
  const llm = recommendations.llm && typeof recommendations.llm === "object" ? recommendations.llm : {};
  const candidate = firstAction(llm.recommendations) || firstAction(recommendations.urgent) || firstAction(recommendations.recommended) || firstAction(recommendations.phasePlan);
  return String(llm.priorityAction || recommendations.summary?.priorityAction || recommendations.priorityAction || candidate?.action || candidate?.goal || candidate?.title || candidate?.item || "").trim();
}

function monitoringEvidenceText(value, fallback = "未发现") {
  const values = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return values.length ? values.map((item) => escapeHtml(String(item))).join("、") : escapeHtml(fallback);
}

function monitoringEvidenceFlag(label, value) {
  return `<span class="monitoring-evidence-flag ${value ? "pass" : "missing"}">${escapeHtml(label)}：${value ? "已具备" : "缺失"}</span>`;
}
