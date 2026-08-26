
function renderArticleModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return "";
  const topic = article.topicSnapshot || article.generationSnapshot?.topicSnapshot || state.topics.find((item) => item.id === article.topicId);
  const plan = contentPlanForArticle(article);
  const businessLine = state.businessLines.find((item) => item.id === (article.businessLineId || (topic && topicBusinessLineId(topic))));
  const citations = articleCitations(article);
  const lineActive = articleBusinessLineIsActive(article);
  const reviewPending = article.reviewStatus !== "approved";
  const manualReview = reviewPending && article.reviewStage === "manual_review";
  const revisionRequested = reviewPending && article.reviewStage === "revision_requested";
  const reviewStage = article.reviewStage || (reviewPending ? "draft" : "ready_to_publish");
  const submittedAt = article.reviewSubmittedAt ? new Date(article.reviewSubmittedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未提交";
  const reviewedAt = article.reviewedAt ? new Date(article.reviewedAt).toLocaleString("zh-CN", { hour12: false }) : "—";
  const knowledgeReady = citations.length > 0 && !citations.some((citation) => citation.supportStatus === "conflict" || citation.status === "missing") && (article.knowledgeStatus?.conflictCount || 0) === 0;
  const articleAssets = (article.assetIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter(Boolean);
  const assetIssues = articleAssetReviewIssues(article);
  const canSubmitReview = currentUserCan("content.generate");
  const canReview = currentUserCan("content.review");
  const canPublishContent = currentUserCan("content.publish");
  const canEditArticle = lineActive && canSubmitReview && !manualReview;
  const canPublish = article.reviewStatus === "approved" && article.status === "draft" && article.riskStatus === "clean" && knowledgeReady && lineActive;
  const hasKnowledgeUpdates = articleHasKnowledgeUpdates(article);
  const riskMeta = {
    clean: { label: "风控通过", text: "未命中 warning / blocked 规则", tone: "clean" },
    warning: { label: "需注意", text: "发现 1 条 warning 规则", tone: "warning" },
    blocked: { label: "已阻断", text: "命中 blocked 规则，禁止发布", tone: "warning" },
    stale: { label: "结果已过期", text: "正文已变化，需要重新检测", tone: "warning" },
    unscanned: { label: "尚未检测", text: "审核前将执行内容风控", tone: "warning" }
  }[article.riskStatus] || { label: "尚未检测", text: "需要执行内容风控", tone: "warning" };
  const actions = !lineActive
    ? '<button class="primary-button" type="button" data-action="manage-business-lines"><span data-icon="refresh"></span>恢复业务线后继续</button>'
    : reviewPending
    ? manualReview
      ? canReview
        ? '<button class="secondary-button" type="button" data-action="reject-article" data-article-id="' + article.id + '"><span data-icon="edit"></span>' + (canSubmitReview ? '退回并修改' : '退回修改') + '</button><button class="primary-button" type="button" data-action="approve-article"><span data-icon="check"></span>审核通过</button>'
        : '<button class="primary-button" type="button" disabled><span data-icon="lock"></span>等待审核人员处理</button>'
      : revisionRequested
        ? canSubmitReview ? '<button class="primary-button" type="button" data-action="open-article-studio" data-article-id="' + article.id + '"><span data-icon="edit"></span>继续修改</button>' : '<button class="primary-button" type="button" disabled><span data-icon="lock"></span>等待内容运营修改</button>'
        : canSubmitReview ? '<button class="primary-button" type="button" data-action="submit-article-review" data-article-id="' + article.id + '"><span data-icon="shield"></span>提交人工审核</button>' : '<button class="primary-button" type="button" disabled><span data-icon="lock"></span>没有提交审核权限</button>'
    : article.status === "draft" && article.riskStatus !== "clean"
      ? '<button class="primary-button" type="button" data-action="open-risk" data-article-id="' + article.id + '"><span data-icon="shield"></span>重新风控</button>'
    : canPublish && canPublishContent
      ? '<button class="primary-button" type="button" data-action="open-publish" data-article-id="' + article.id + '"><span data-icon="send"></span>去发布</button>'
      : article.status !== "draft"
        ? '<button class="primary-button" type="button" data-nav="publish"><span data-icon="send"></span>查看发布任务</button>'
        : '<button class="primary-button" type="button" disabled><span data-icon="lock"></span>缺少知识证据</button>';
  const keywords = article.keywords.map((word) => '<span class="small-tag">' + escapeHtml(word) + "</span>").join("");
  const citationRows = citations.map((citation) => {
    const base = knowledgeBaseById(citation.knowledgeBaseId || citation.baseId);
    const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
    const version = knowledgeVersionById(citation.versionId || citation.knowledgeVersionId);
    return `<button class="article-citation-row" type="button" data-action="open-citation" data-citation-id="${citation.id}"><b>${escapeHtml(citation.marker)}</b><span><strong>${escapeHtml(item?.title || item?.question || "企业知识")}</strong><small>${escapeHtml(base?.name || "知识库")} · v${escapeHtml(version?.version || citation.knowledgeVersion || "1")}</small></span><span data-icon="arrow"></span></button>`;
  }).join("");
  const editorRiskScan = scanArticleRisk(article);
  const editorSourceContent = articleContentForEditor(article, citations);
  const editorContent = highlightArticleRiskHtml(editorSourceContent, editorRiskScan.hits);
  const titleRiskPreview = renderArticleRiskTitlePreview(article, editorRiskScan, "article");
  const articleAgent = article.generationSnapshot?.writingAgent || null;
  const selectableAgents = activeWritingAgents(article.businessLineId || businessLine?.id, plan?.contentType || article.category);
  const selectedAgentIsActive = selectableAgents.some((agent) => agent.id === articleAgent?.agentId);
  const agentOptions = `${articleAgent && !selectedAgentIsActive ? '<option value="' + articleAgent.agentId + '" selected disabled>' + escapeHtml(articleAgent.nameSnapshot) + ' · v' + escapeHtml(articleAgent.version) + '（已停用）</option>' : ""}${selectableAgents.map((agent) => '<option value="' + agent.id + '" ' + (agent.id === articleAgent?.agentId ? "selected" : "") + '>' + escapeHtml(agent.name) + ' · v' + escapeHtml(agent.version) + '</option>').join("")}`;
  const previousVersions = Array.isArray(article.versions) ? article.versions : [];
  const versionRows = [`<div class="article-version-row current"><span><b>${escapeHtml(article.version)} · 当前稿</b><small>${escapeHtml(articleAgent?.nameSnapshot || "未记录智能体")}${articleAgent ? " v" + escapeHtml(articleAgent.version) : ""}</small></span><em>${formatRelative(article.updatedAt)}</em></div>`].concat(previousVersions.map((revision, index) => `<button class="article-version-row" type="button" data-action="open-article-version" data-article-id="${article.id}" data-version-index="${index}"><span><b>${escapeHtml(revision.version)} · ${escapeHtml(revision.reasonLabel || "历史版本")}</b><small>${escapeHtml(revision.generationSnapshot?.writingAgent?.nameSnapshot || revision.writingAgentNameSnapshot || "历史默认配置")}${revision.generationSnapshot?.writingAgent ? " v" + escapeHtml(revision.generationSnapshot.writingAgent.version) : ""}</small></span><em>${formatRelative(revision.archivedAt || revision.updatedAt)}</em></button>`)).join("");

  return modalChrome(`
    <div class="modal-head">
      <div><h2 id="modal-title">${manualReview ? "人工审核" : "文章编辑与审核"}</h2><p>${escapeHtml(article.id)} · ${escapeHtml(article.version)} · ${manualReview ? "核对通过后才允许发布" : revisionRequested ? "已退回修改，重新提交后才可审核" : reviewPending ? "草稿尚未提交人工审核" : "绑定当前版本发布"}</p></div>
      <button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button>
    </div>
    <div class="modal-body">
      ${!lineActive ? '<div class="knowledge-update-banner danger"><span data-icon="lock"></span><div><b>所属业务线已删除</b><p>历史正文和引用证据仍可查看；恢复业务线后才能编辑、审核或创建新的发布任务。</p></div></div>' : ""}
      ${hasKnowledgeUpdates ? '<div class="knowledge-update-banner"><span data-icon="history"></span><div><b>企业知识已有新版本</b><p>本文继续引用生成时冻结的旧版本；如需使用最新知识，请从内容计划重新生成新版本。</p></div></div>' : ""}
      ${manualReview ? `<div class="manual-review-banner"><span class="manual-review-step active"><i>1</i><b>人工审核中</b><small>正文、引用、风险</small></span><span class="manual-review-arrow">→</span><span class="manual-review-step"><i>2</i><b>审核通过</b><small>冻结当前版本</small></span><span class="manual-review-arrow">→</span><span class="manual-review-step"><i>3</i><b>进入发布</b><small>官网 / 多平台</small></span></div><div class="manual-review-meta"><div><span>当前状态</span><b class="status-badge status-review">待人工审核</b></div><div><span>提交时间</span><b>${escapeHtml(submittedAt)}</b></div><div><span>提交人</span><b>${escapeHtml(article.reviewSubmittedBy || "内容团队")}</b></div><div><span>审核版本</span><b>${escapeHtml(article.version)}</b></div></div><div class="manual-review-checklist"><b>审核清单</b><span class="ok">正文完整</span><span class="${citations.length ? "ok" : "warning"}">${citations.length ? "企业知识已引用" : "缺少企业知识引用"}</span><span class="${article.riskStatus === "clean" ? "ok" : "warning"}">${article.riskStatus === "clean" ? "风控已通过" : "待完成风控"}</span><small>审核通过后才会解锁发布，修改正文后会自动生成新版本并重新审核。</small></div>` : revisionRequested ? `<div class="knowledge-update-banner"><span data-icon="edit"></span><div><b>已退回修改</b><p>${escapeHtml(article.reviewNote || "请根据审核意见修改后重新提交。")}</p><small>审核人：${escapeHtml(article.reviewedBy || "审核人员")} · ${escapeHtml(reviewedAt)}</small></div></div>` : reviewPending ? `<div class="knowledge-update-banner"><span data-icon="clock"></span><div><b>当前为编辑草稿</b><p>确认正文、企业知识引用和风险状态后，再提交人工审核；未提交的草稿不能审核或发布。</p></div></div>` : `<div class="manual-review-complete"><span data-icon="check"></span><div><b>人工审核已通过 · 当前版本可发布</b><p>审核人：${escapeHtml(article.reviewedBy || "内容团队")} · ${escapeHtml(reviewedAt)} · 已冻结 ${escapeHtml(article.version)} 的正文与知识引用</p></div></div><div class="manual-review-complete-actions">${canPublish && canPublishContent ? '<button class="primary-button button-small" type="button" data-action="open-publish" data-article-id="' + escapeHtml(article.id) + '"><span data-icon="send"></span>去发布</button>' : ""}</div>`}
      <div class="article-drawer-grid">
        <div>
          <textarea class="editor-title" id="article-title-editor" rows="2" ${canEditArticle ? "" : "readonly"}>${escapeHtml(article.title)}</textarea>
          ${titleRiskPreview}
          <div class="editor-toolbar" aria-label="编辑工具栏">
            <button type="button" data-action="article-format" data-command="bold" aria-label="粗体" title="粗体" ${canEditArticle ? "" : "disabled"}><b>B</b></button><button type="button" data-action="article-format" data-command="italic" aria-label="斜体" title="斜体" ${canEditArticle ? "" : "disabled"}><i>I</i></button><button type="button" data-action="article-format" data-command="formatBlock" data-value="h2" aria-label="标题" title="二级标题" ${canEditArticle ? "" : "disabled"}>H2</button>
            <button type="button" data-action="article-format" data-command="insertUnorderedList" aria-label="列表" title="无序列表" ${canEditArticle ? "" : "disabled"}>☷</button><button type="button" data-action="article-link" aria-label="链接" title="插入链接" ${canEditArticle ? "" : "disabled"}><span data-icon="link"></span></button><button type="button" data-action="open-article-studio" data-article-id="${article.id}" aria-label="图片" title="在 AI 创作台插入或管理图片" ${canEditArticle ? "" : "disabled"}><span data-icon="image"></span></button>
          </div>
          ${renderArticleRiskInlineNotice(article, "article", editorRiskScan)}
          <article class="article-content ${canEditArticle ? "" : "read-only"}" id="article-content-editor" contenteditable="${canEditArticle ? "true" : "false"}" spellcheck="false">${editorContent}</article>
        </div>
        <aside class="article-side">
          <div class="side-panel public-citation-panel"><h4>发布展示</h4>${renderPublicCitationSetting(articlePublicCitationMarkersVisible(article), "article-show-public-citations", !canEditArticle)}</div>
          <div class="side-panel article-agent-panel">
            <h4>AI 协作 · 写作智能体</h4>
            ${articleAgent ? `<div class="current-agent-chip"><span class="writing-agent-avatar ${escapeHtml(writingAgentById(articleAgent.agentId)?.color || "blue")}">${escapeHtml(writingAgentById(articleAgent.agentId)?.avatar || articleAgent.nameSnapshot.slice(0, 1))}</span><span><b>${escapeHtml(articleAgent.nameSnapshot)} · v${escapeHtml(articleAgent.version)}</b><small>${escapeHtml(articleAgent.style)} · ${articleAgent.strictKnowledge ? "严格知识" : "普通模式"}</small></span></div>` : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>历史内容未记录写作智能体，需从内容计划重新生成。</span></div>'}
            ${articleAgent && citations.length && lineActive ? `<label class="agent-switch-label" for="article-writing-agent">后续 AI 操作使用</label><select class="select" id="article-writing-agent">${agentOptions}</select><button class="secondary-button button-small agent-regenerate-button" type="button" data-action="request-regenerate-article" data-article-id="${article.id}" ${selectableAgents.length ? "" : "disabled"}><span data-icon="refresh"></span>使用此智能体重新生成</button><p class="snapshot-note"><span data-icon="info"></span>切换下拉不会修改正文；确认重写后创建新版本。</p>` : ""}
          </div>
          <div class="side-panel">
            <h4>工作流状态</h4>
            <div class="side-list">
              <div><span>内容状态</span><b>${article.status === "published" ? "已发布" : article.status === "publishing" ? "发布中" : "草稿"}</b></div>
              <div><span>审核状态</span><b>${article.reviewStatus === "approved" ? "已通过 · 可发布" : revisionRequested ? "退回修改" : manualReview ? "待人工审核" : "草稿未提交"}</b></div>
              <div><span>冻结版本</span><b>${canPublish ? article.version : "—"}</b></div>
            </div>
          </div>
          <div class="side-panel">
            <h4>关联选题</h4>
            <p>${escapeHtml(topic?.title || "未关联选题")}</p>
            <div class="side-list mt-sm"><div><span>业务线</span><b>${escapeHtml(businessLine?.name || "未关联")}</b></div><div><span>内容计划</span><b>${escapeHtml(plan?.name || "未经过计划")}</b></div></div>
          </div>
          <div class="side-panel">
            <h4>企业知识引用</h4>
            ${citationRows ? '<div class="article-citation-list">' + citationRows + '</div>' : '<div class="knowledge-missing-inline"><span data-icon="alert"></span><span>这是一篇未建立证据映射的历史内容，不能直接审核发布。</span></div>'}
            <div class="citation-summary"><span>已审核证据</span><b>${citations.length} 条</b><small>${article.knowledgeStatus?.gapCount || 0} 项缺口已省略 · ${article.knowledgeStatus?.conflictCount || 0} 项冲突</small></div>
            ${article.knowledgeSnapshot ? '<p class="snapshot-note"><span data-icon="lock"></span>生成于 ' + escapeHtml(new Date(article.knowledgeSnapshot.capturedAt).toLocaleString("zh-CN", { hour12: false })) + '，引用版本' + (article.knowledgeSnapshot.frozenAt || article.reviewStatus === "approved" ? "已冻结" : "待审核冻结") + '。</p>' : ""}
          </div>
          ${articleAssets.length ? `<div class="side-panel"><h4>文章素材 ${assetIssues.length ? '<span class="small-tag amber">' + assetIssues.length + ' 待确认</span>' : '<span class="small-tag green">已确认</span>'}</h4><div class="article-citation-list">${articleAssets.map((asset) => `<div class="article-citation-row article-asset-row"><b><span data-icon="image"></span></b><span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.license || "来源待确认")} · ${asset.reviewStatus === "approved" ? "已审核" : "待人工确认"}</small></span>${asset.reviewStatus === "approved" ? '<span class="status-badge status-approved">可用</span>' : `<span class="article-asset-actions"><button class="link-button" type="button" data-action="approve-article-asset" data-article-id="${article.id}" data-asset-id="${asset.id}">确认可用</button><button class="link-button danger-text" type="button" data-action="remove-article-asset" data-article-id="${article.id}" data-asset-id="${asset.id}">移出</button></span>`}</div>`).join("")}</div><p class="snapshot-note"><span data-icon="info"></span>上传或 AI 生成的图片必须由人工确认来源与适用性，才可以随文章通过审核。</p></div>` : ""}
          <div class="side-panel">
            <h4>内容风控</h4>
            <div class="risk-score"><span class="risk-state-icon ${riskMeta.tone === "warning" ? "warning" : ""}" data-icon="shield"></span><p><b style="display:block;color:${riskMeta.tone === "warning" ? "var(--amber)" : "var(--green)"}">${riskMeta.label}</b>${riskMeta.text}</p></div>
            <button class="text-button" type="button" data-action="open-risk" data-article-id="${article.id}" >查看风险详情 <span data-icon="arrow"></span></button>
          </div>
          <div class="side-panel">
            <h4>关键词</h4>
            <div class="topic-tags">${keywords}</div>
          </div>
          <div class="side-panel"><h4>文章版本</h4><div class="article-version-list">${versionRows}</div></div>
        </aside>
      </div>
    </div>
    <div class="modal-foot">
      <span class="text-muted text-xs">最后更新：${formatRelative(article.updatedAt)} · ${escapeHtml(article.author)}</span>
      <div class="modal-foot-right">
        <button class="secondary-button" type="button" data-action="copy-article-text">复制全文</button>
        ${canEditArticle ? '<button class="secondary-button" type="button" data-action="open-article-studio" data-article-id="' + article.id + '"><span data-icon="sparkle"></span>AI 创作台</button><button class="secondary-button" type="button" data-action="save-article">保存草稿</button>' : ""}
        ${actions}
      </div>
    </div>
  `, { className: "article-review-modal" });
}

function archiveArticleRevision(article, reason = "manual_edit", reasonLabel = "历史版本") {
  article.versions = Array.isArray(article.versions) ? article.versions : [];
  const revision = {
    id: uid("ARV"),
    version: article.version,
    title: article.title,
    content: article.content,
    status: article.status,
    reviewStatus: article.reviewStatus,
    reviewStage: article.reviewStage || null,
    reviewSubmittedAt: article.reviewSubmittedAt || null,
    reviewSubmittedBy: article.reviewSubmittedBy || null,
    reviewedAt: article.reviewedAt || null,
    reviewedBy: article.reviewedBy || null,
    reviewNote: article.reviewNote || "",
    riskStatus: article.riskStatus,
    showPublicCitationMarkers: articlePublicCitationMarkersVisible(article),
    author: article.author,
    citations: cloneData(article.citations || []),
    citationSnapshots: cloneData(articleCitations(article)),
    knowledgeSnapshot: cloneData(article.knowledgeSnapshot),
    generationSnapshot: cloneData(article.generationSnapshot),
    knowledgeStatus: cloneData(article.knowledgeStatus),
    writingAgentId: article.writingAgentId || null,
    writingAgentVersion: article.writingAgentVersion || null,
    writingAgentNameSnapshot: article.writingAgentNameSnapshot || null,
    updatedAt: article.updatedAt,
    archivedAt: Date.now(),
    reason,
    reasonLabel
  };
  article.versions.unshift(revision);
  return revision;
}

function studioCloneCitationsForVersion(article, nextVersion) {
  const previous = articleCitations(article);
  if (!previous.length) return { citations: [], idMap: new Map() };
  const idMap = new Map();
  const next = previous.map((citation, index) => ({
    ...cloneData(citation),
    id: uid("CIT") + "-K" + (index + 1),
    articleId: article.id,
    articleVersion: nextVersion,
    status: "needs_review",
    supportStatus: "supported"
  }));
  previous.forEach((citation, index) => idMap.set(citation.id, next[index].id));
  state.knowledgeCitations = Array.isArray(state.knowledgeCitations) ? state.knowledgeCitations : [];
  state.knowledgeCitations.push(...next);
  article.citations = next.map((citation) => citation.id);
  article.sources = next.length;
  article.content = studioRemapCitationIds(article.content, idMap);
  if (article.knowledgeSnapshot) article.knowledgeSnapshot.citationIds = article.citations.slice();
  return { citations: next, idMap };
}

function studioRemapCitationIds(html, idMap) {
  if (!idMap?.size || !html) return html;
  return String(html).replace(/(data-citation-id=["'])([^"']+)(["'])/gi, (match, prefix, id, suffix) => idMap.has(id) ? prefix + idMap.get(id) + suffix : match);
}

function saveArticleEditor(options = {}) {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  const titleInput = document.getElementById("article-title-editor");
  const contentInput = document.getElementById("article-content-editor");
  const visibilityInput = document.getElementById("article-show-public-citations");
  if (!article || !titleInput || !contentInput) return null;
  if (article.reviewStage === "manual_review") {
    if (!options.silent) showToast("当前版本正在人工审核", "请先执行“退回并修改”，服务端确认退回后才能编辑。", "error");
    return null;
  }
  if (!articleBusinessLineIsActive(article)) {
    if (!options.silent) showToast("业务线已删除", "恢复业务线后才能编辑这篇历史文章。", "error");
    return article;
  }
  const nextTitle = titleInput.value.trim();
  const nextContent = sanitizeStudioHtml(stripArticleRiskHighlights(contentInput.innerHTML.trim()));
  const nextShowPublicCitationMarkers = visibilityInput ? visibilityInput.checked : articlePublicCitationMarkersVisible(article);
  if (!nextTitle) {
    showToast("标题不能为空", "请填写文章标题后再保存。", "error");
    titleInput.focus();
    return null;
  }
  let citations = articleCitations(article);
  const renderedBaseline = articleContentForEditor(article, citations).trim();
  const changed = nextTitle !== article.title || nextContent !== renderedBaseline || nextShowPublicCitationMarkers !== articlePublicCitationMarkersVisible(article);
  const requiresNewVersion = changed && (Boolean(article.contentVersionId) || article.reviewStatus === "approved" || article.status === "published");
  const citationClone = requiresNewVersion ? studioBumpArticleVersion(article, "manual_edit", "人工修订前") : null;
  if (citationClone) citations = articleCitations(article);
  article.title = nextTitle;
  article.showPublicCitationMarkers = nextShowPublicCitationMarkers;
  article.content = citationClone?.idMap ? studioRemapCitationIds(nextContent, citationClone.idMap) : nextContent;
  if (article.generationSnapshot?.outputContract || article.geoQuality) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot?.topicSnapshot || {}, citations);
    if (article.generationSnapshot) article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
  article.updatedAt = Date.now();
  if (changed) {
    article.riskStatus = "stale";
    citations.forEach((citation) => { citation.status = "needs_review"; });
    if (article.knowledgeStatus) {
      article.knowledgeStatus.state = "needs_review";
      article.knowledgeStatus.message = "正文已修改，需要重新核验引用证据并冻结新版本。";
    }
    if (article.knowledgeSnapshot) article.knowledgeSnapshot.frozenAt = null;
    article.reviewStatus = "pending";
    article.reviewStage = "draft";
    article.reviewSubmittedAt = null;
    article.reviewSubmittedBy = null;
    article.reviewedAt = null;
    article.reviewedBy = null;
    article.reviewNote = "";
  }
  if (requiresNewVersion) {
    article.status = "draft";
    if (!options.silent) showToast("已生成新版本", "文章内容变更，需要重新审核后才能发布。");
  } else if (!options.silent) {
    showToast("文章已保存", "草稿内容已保存在本次演示数据中。");
  }
  if (changed) {
    article.contentSyncPending = true;
    markContentArticleEditPending(article);
    void queueContentArticleSync(article, { createVersion: true }).catch((error) => {
      article.contentSyncPending = false;
      article.contentSyncError = error.message || "内容版本同步失败";
      updateContentArticleEditGuard(article, { pending: true });
      saveState();
      if (!options.silent) showToast("内容版本同步失败", article.contentSyncError, "warning");
    });
  }
  saveState();
  render();
  return article;
}

async function submitArticleForManualReview(articleId, options = {}) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新页面后重试。", "error");
  if (!currentUserCan("content.generate")) return showToast("没有提交审核权限", "请由内容运营或管理员提交人工审核。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能提交审核。", "error");
  if (article.reviewStatus === "approved") return showToast("当前版本已经审核通过", "修改正文会自动创建新版本并重新进入审核。", "error");
  if (article.reviewStage === "manual_review") return showToast("当前版本正在人工审核", "请等待审核结果；如需修改，先由审核人员退回。", "error");
  const rollback = options.rollback || {
    article: cloneData(article),
    knowledgeCitations: cloneData(state.knowledgeCitations || [])
  };
  let formalVersionReady = false;
  if (options.fromArticleModal && ui.modal?.type === "article" && ui.modal.articleId === article.id) {
    await waitForFormalContentMigration();
    const saved = saveArticleEditor({ silent: true });
    if (!saved) return null;
  }
  const workspace = (state.writingWorkspaces || []).find((item) => item.articleId === article.id);
  try {
    await ensureCurrentContentVersion(article);
    formalVersionReady = true;
    const scan = !["stale", "unscanned"].includes(article.riskStatus) && article.riskScan?.articleVersion === article.version ? article.riskScan : applyArticleRiskScan(article);
    if (scan.status === "blocked") {
      saveState();
      render();
      if (options.fromArticleModal) {
        ui.modal = { type: "article", articleId: article.id };
        renderModal();
      }
      showToast("风控已阻断", "请先修改命中禁止规则的正文，再提交人工审核。", "error");
      return null;
    }
    await contentServerRiskScan(article, scan);
    // The compatibility workspace may still have a debounced draft snapshot
    // in flight from the editor.  Serialize the review mutation and read the
    // authoritative records again before projecting the review state locally.
    await withContentWorkflowLock(article, async () => {
      await performContentServerAction(article, "submit-review", {
        note: article.reviewNote || "",
        riskScan: { findings: scan.hits || [], policyVersion: `workspace-${Object.values(scan.ruleVersions || {}).join("-")}`, completedAt: scan.scannedAt }
      });
      const serverSnapshot = await performRefreshContentServerSnapshot(article);
      if (serverSnapshot.version?.reviewStatus !== "pending" || serverSnapshot.article?.status !== "in_review" || serverSnapshot.task?.status !== "in_review") {
        throw new Error("服务端未确认文章已进入人工审核，请刷新后重试");
      }
    });
  } catch (error) {
    if (!formalVersionReady) {
      Object.keys(article).forEach((key) => { delete article[key]; });
      Object.assign(article, rollback.article);
      state.knowledgeCitations = rollback.knowledgeCitations;
    }
    article.contentSyncError = error.message || "提交审核同步失败";
    saveState();
    render();
    if (options.fromArticleModal) {
      ui.modal = { type: "article", articleId: article.id };
      renderModal();
    }
    showToast("提交审核同步失败", article.contentSyncError, "error");
    return null;
  }
  const submittedAt = new Date().toISOString();
  article.reviewStatus = "pending";
  article.reviewStage = "manual_review";
  article.reviewSubmittedAt = submittedAt;
  article.reviewSubmittedBy = window.__TZ_AUTH__?.user?.displayName || window.__TZ_AUTH__?.user?.username || "内容运营";
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.status = "draft";
  article.updatedAt = Date.now();
  if (workspace) {
    workspace.status = "review";
    workspace.updatedAt = article.updatedAt;
  }
  markContentArticleWorkspacePending(article);
  saveState();
  try {
    // Make the review transition durable in the compatibility workspace after
    // all older debounced editor snapshots have drained.  Without this flush,
    // a draft PUT could land after the content API's submit-review mutation and
    // visually roll the article back to an editable draft.
    await flushWorkspaceSyncNow("content-review-submit");
  } catch (error) {
    article.contentSyncError = error.message || "提交审核后的工作区同步失败";
    saveState();
  }
  return article;
}

async function requestArticleChanges(article, options = {}) {
  if (!article) return null;
  if (!currentUserCan("content.review")) return showToast("没有人工审核权限", "请由审核人员或管理员执行退回修改。", "error");
  // Recover from a compatibility-workspace snapshot that was written before
  // the submit-review response.  The formal content API is authoritative, so
  // a pending/in-review article gets one fresh read before we reject it as
  // non-reviewable.
  if (article.reviewStage !== "manual_review" && (article.reviewStatus === "pending" || article.contentStatus === "in_review" || article.contentTaskStatus === "in_review")) {
    try { await refreshContentServerSnapshot(article); } catch { /* the guard below reports the actionable state */ }
  }
  if (article.reviewStage !== "manual_review") return showToast("文章尚未进入人工审核", "请先从文章编辑页提交审核。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "恢复业务线后才能退回并修改这篇文章。", "error");
  const workspace = (state.writingWorkspaces || []).find((item) => item.articleId === article.id);
  const reason = options.note === undefined
    ? await uiPrompt("请输入退回修改原因", "请说明需要修改的内容", article.reviewNote || "请补充正文、知识引用或风险处理后重新提交审核。", true)
    : options.note;
  if (reason === null) return;
  const reviewNote = String(reason || "").trim();
  if (!reviewNote) return showToast("请填写退回原因", "退回意见会随审核记录保存，方便内容人员按要求修改。", "error");
  let serverSnapshot;
  try {
    await withContentWorkflowLock(article, async () => {
      await waitForContentSync(article);
      await performContentServerAction(article, "request-changes", { note: reviewNote });
      // Read the two authoritative records again.  The action response updates
      // the local compatibility snapshot, but the follow-up read proves that
      // the immutable version, article and task all entered the returned state.
      serverSnapshot = await performRefreshContentServerSnapshot(article);
      const serverTask = serverSnapshot.task;
      const serverArticle = serverSnapshot.article;
      const serverVersion = serverSnapshot.version;
      if (serverVersion?.reviewStatus !== "changes_requested" || serverArticle?.status !== "changes_requested" || serverTask?.status !== "changes_requested") {
        throw new Error("服务端未确认文章已退回，请刷新后重试");
      }
    });
  } catch (error) {
    article.contentSyncError = error.message || "退回审核同步失败";
    showToast("退回审核同步失败", article.contentSyncError, "error");
    saveState();
    return null;
  }
  // applyContentServerSnapshot has already projected the server state to the
  // local UI.  Keep these fallbacks for older API payloads while preserving
  // the server-confirmed review note and reviewer when they are available.
  article.reviewStatus = article.reviewStatus === "approved" ? "pending" : article.reviewStatus || "pending";
  article.reviewStage = article.reviewStage === "manual_review" ? "revision_requested" : article.reviewStage || "revision_requested";
  article.reviewNote = article.reviewNote || reviewNote;
  article.reviewedAt = article.reviewedAt || new Date().toISOString();
  article.reviewedBy = article.reviewedBy || currentUserName() || "审核人员";
  article.status = "draft";
  article.contentStatus = "changes_requested";
  article.contentTaskStatus = "changes_requested";
  if (workspace) {
    workspace.status = "revision";
    workspace.updatedAt = Date.now();
  }
  article.updatedAt = Date.now();
  markContentArticleWorkspacePending(article);
  saveState();
  let workspacePersistError = null;
  try {
    // The content API is authoritative for the review transition, while the
    // compatibility workspace drives the list and editor route.  Persist the
    // confirmed projection before opening the studio so the next render and a
    // later refresh both see the editable state.
    await flushWorkspaceSyncNow("content-review-request-changes");
  } catch (error) {
    workspacePersistError = error;
    article.contentSyncError = error.message || "退回状态工作区同步失败";
    saveState();
  }
  if (options.openStudio !== false && currentUserCan("content.generate")) {
    closeModal();
    openContentStudio(article.id);
    showToast(workspacePersistError ? "已退回，正在同步修改状态" : "已退回并进入修改", workspacePersistError ? "服务端已保存退回状态；工作区正在重试同步，当前文章仍可编辑。" : "服务端已保存退回状态和审核意见，修改后请重新提交人工审核。", "warning");
  } else {
    closeModal();
    ui.contentView = "articles";
    ui.articleTaskView = "articles";
    ui.articleTab = "draft";
    render();
    showToast("已退回修改", "服务端已保存退回状态和审核意见，文章已进入“草稿 / 退回”。", "warning");
  }
  return article;
}

async function rejectArticle(articleId = null) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const article = state.articles.find((item) => item.id === (articleId || ui.modal?.articleId)) || studioArticleForWorkspace(workspace);
  return requestArticleChanges(article, { openStudio: true });
}

async function approveArticle() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return;
  if (!currentUserCan("content.review")) return showToast("没有人工审核权限", "请由审核人员或管理员执行审核通过。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "历史文章可以查看，但恢复业务线后才能继续审核和发布。", "error");
  if (article.reviewStage !== "manual_review") return showToast("文章尚未提交人工审核", "请先确认草稿并点击“提交人工审核”。", "error");
  const citations = articleCitations(article);
  if (!citations.length || !article.knowledgeSnapshot) return showToast("缺少企业知识证据", "这篇历史内容没有逐条引用与版本快照，请从内容计划重新生成。", "error");
  if (citations.some((citation) => !knowledgeBaseById(citation.knowledgeBaseId || citation.baseId) || !knowledgeItemById(citation.itemId || citation.knowledgeItemId) || !knowledgeVersionById(citation.versionId || citation.knowledgeVersionId))) return showToast("引用证据不完整", "存在无法定位到知识原文的引用，暂不能通过审核。", "error");
  if ((article.knowledgeStatus?.conflictCount || 0) > 0) return showToast("企业事实存在冲突", "请先处理知识冲突，再重新生成或审核文章。", "error");
  if (articleHasKnowledgeUpdates(article)) return showToast("知识版本已更新", "当前草稿引用的不是最新已审核版本，请从内容计划重新生成新版本。", "error");
  const assetIssues = articleAssetReviewIssues(article);
  if (assetIssues.length) return showToast("图片素材尚未审核", "文章包含未审核的上传或 AI 图片，请先完成素材审核后再通过文章审核。", "error");
  if (["unscanned", "stale"].includes(article.riskStatus) || article.riskScan?.articleVersion !== article.version) return showToast("尚未完成当前版本风控", "请先打开内容风控并重新检测，确认没有阻断或警告后再审核通过。", "error");
  if (article.riskStatus === "blocked") return showToast("风控已阻断", "命中 blocked 规则的文章不能通过审核。", "error");
  if (article.riskStatus === "warning") return showToast("存在 warning 规则", "请先查看风险详情并修订，或由管理员在正式版中填写覆盖原因。", "error");
  try {
    await contentServerRiskScan(article, article.riskScan);
    await contentServerAction(article, "approve", { note: "" });
  } catch (error) {
    article.contentSyncError = error.message || "审核通过同步失败";
    saveState();
    return showToast("审核通过同步失败", article.contentSyncError, "error");
  }
  article.reviewStatus = "approved";
  article.reviewStage = "ready_to_publish";
  article.reviewedAt = new Date().toISOString();
  article.reviewedBy = window.__TZ_AUTH__?.user?.displayName || window.__TZ_AUTH__?.user?.username || "审核人员";
  citations.forEach((citation) => { citation.status = "verified"; citation.supportStatus = "supported"; citation.articleVersion = article.version; });
  article.sources = citations.length;
  article.knowledgeSnapshot.frozenAt = new Date().toISOString();
  article.knowledgeSnapshot.citationIds = citations.map((citation) => citation.id);
  article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "frozen", evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, message: "正文、知识版本和逐条引用已完成审核冻结。" };
  article.updatedAt = Date.now();
  const reviewWorkspace = (state.writingWorkspaces || []).find((workspace) => workspace.articleId === article.id);
  if (reviewWorkspace) {
    reviewWorkspace.status = "approved";
    reviewWorkspace.updatedAt = Date.now();
  }
  ui.contentView = "articles";
  ui.articleTaskView = "articles";
  ui.articleTab = "approved";
  saveState();
  render();
  showToast("审核已通过", "已冻结 " + article.version + " 正文和 " + citations.length + " 条知识证据，可以进入发布。");
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
}

function openBatchReview() {
  if (!currentUserCan("content.review")) return showToast("没有批量审核权限", "请由审核人员或管理员执行一键审核。", "error");
  const current = contentTaskVisibleArticles().filter(articleSelectableForAction);
  const visibleIds = new Set(current.map((article) => article.id));
  const ids = selectedArticleIdsForCurrentView().filter((id) => visibleIds.has(id));
  const hasReviewable = ids.some((id) => articleSelectableForReview(state.articles.find((article) => article.id === id)));
  if (!hasReviewable) return showToast("请先选择待审核文章", "已审核文章可用于定时发布；批量审核只处理待审核文章。", "error");
  ui.articleSelection = ids;
  ui.modal = { type: "batchReview" };
  return renderModal();
}

async function approveSelectedArticles() {
  if (!currentUserCan("content.review")) return showToast("没有批量审核权限", "请由审核人员或管理员执行一键审核。", "error");
  const ids = selectedArticleIdsForCurrentView();
  const entries = ids.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean).map((article) => ({ article, reason: articleReviewBlockReason(article) }));
  let approved = entries.filter((entry) => !entry.reason).map(({ article }) => article);
  const skipped = entries.filter((entry) => entry.reason);
  if (!approved.length) return showToast("没有可审核文章", "所选文章均未满足人工审核条件。", "error");
  const synced = [];
  for (const article of approved) {
    try {
      await contentServerRiskScan(article, article.riskScan);
      await contentServerAction(article, "approve", { note: "" });
      synced.push(article);
    } catch (error) {
      article.contentSyncError = error.message || "审核通过同步失败";
      skipped.push({ article, reason: article.contentSyncError });
    }
  }
  approved = synced;
  if (!approved.length) {
    saveState();
    return showToast("批量审核未完成", "所选文章均未能同步到服务端审核流程。", "error");
  }
  const reviewedAt = new Date().toISOString();
  approved.forEach((article) => {
    const citations = articleCitations(article);
    article.reviewStatus = "approved";
    article.reviewStage = "ready_to_publish";
    article.reviewedAt = reviewedAt;
    article.reviewedBy = currentUserName() || "系统管理员";
    citations.forEach((citation) => { citation.status = "verified"; citation.supportStatus = "supported"; citation.articleVersion = article.version; });
    article.sources = citations.length;
    if (article.knowledgeSnapshot) {
      article.knowledgeSnapshot.frozenAt = article.knowledgeSnapshot.frozenAt || reviewedAt;
      article.knowledgeSnapshot.citationIds = citations.map((citation) => citation.id);
    }
    article.knowledgeStatus = { ...(article.knowledgeStatus || {}), state: "frozen", evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, message: "正文、知识版本和逐条引用已完成审核冻结。" };
    article.updatedAt = Date.now();
  });
  clearArticleSelection();
  saveState();
  closeModal();
  render();
  const suffix = skipped.length ? `；${skipped.length} 篇因审核条件未满足而跳过` : "";
  showToast(`已审核通过 ${approved.length} 篇`, `已记录审核人和审核时间，文章可继续进入发布流程${suffix}。`);
}

async function openPublish(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新后重试。", "error");
  if (!articleBusinessLineIsActive(article)) return showToast("业务线已删除", "历史文章仍可查看，但恢复业务线后才能创建新的发布任务。", "error");
  if (article.reviewStatus !== "approved") return showToast("文章尚未通过审核", "先完成事实与风险审核，再进入发布。", "error");
  if (article.riskStatus !== "clean") return showToast("风控状态不允许发布", "请重新检测当前文章版本，确认状态为 clean。", "error");
  if (articleAssetReviewIssues(article).length) return showToast("图片素材尚未审核", "文章包含未审核素材，不能发布；请先完成图片来源、版权和内容审核。", "error");
  if (!articleCitations(article).length || !article.knowledgeSnapshot?.frozenAt && article.knowledgeStatus?.state !== "ready_with_omissions") return showToast("知识证据尚未冻结", "请先完成事实审核并冻结当前文章引用版本。", "error");
  if (articleHasKnowledgeUpdates(article)) return showToast("企业知识已有更新", "当前文章仍保留旧证据；请确认沿用旧版本或重新生成后再发布。", "error");
  try {
    await ensureContentPublishSnapshot(article);
    if (article.reviewStatus !== "approved" || !article.contentApprovedVersionId) return showToast("服务端发布门禁未通过", "当前文章在正式内容数据库中尚未完成审核冻结。", "error");
    const payload = await productionApi(`/api/v1/content/tasks/${encodeURIComponent(article.contentTaskId)}/can-publish?versionId=${encodeURIComponent(article.contentApprovedVersionId || article.contentVersionId || "")}`);
    const result = payload?.data?.result || payload?.data?.canPublish || payload?.result || payload?.canPublish || payload?.data;
    if (result && result.ok === false) return showToast("服务端发布门禁未通过", result.reason || "当前文章版本尚未完成审核冻结。", "error");
  } catch (error) {
    return showToast("无法确认服务端发布资格", error.message || "请稍后重试，发布前必须通过服务端门禁。", "error");
  }
  if (article.status !== "draft") {
    ui.publishTab = "all";
    closeModal();
    navigate("publish");
    return showToast("文章已有发布任务", "请在发布运营中查看分平台结果。");
  }
  return openPublishBatch([articleId]);
}


async function submitPublish() {
  if (!(await ensurePublisherIntegration())) return;
  if (!(await refreshPublisherSnapshot())) {
    return showToast("发布器状态未同步", publisherSnapshot.error || "请等待桌面发布器完成一次心跳后重试。", "error");
  }
  if (ui.submittingPublish || !ui.publishSelection) return;
  const selection = ui.publishSelection;
  const article = state.articles.find((item) => item.id === selection.articleId);
  const group = state.accountGroups.find((item) => item.id === selection.groupId) || state.accountGroups[0];
  if (!article || !group) return;
  const existing = articleExistingPublishPlatforms(article);
  const platforms = selection.platforms.filter((platform) => !existing.has(platform) && (platform === "web" || (publisherPlatformSelectable(platform) && publisherAccountReadyForGroup(group, platform))));
  if (!platforms.length) return showToast("没有可创建的目标", "请确认账号组中已登录对应的本地发布平台。", "error");
  ui.submittingPublish = true;
  renderModal();
  try {
    const formal = await contentPublisherPayload(article);
    await publisherApi("/api/publisher/jobs", {
      method: "POST",
      body: {
        ...formal,
        webUrl: publisherArticleWebUrl(article),
        accountGroupId: group.id,
        groupName: group.name,
        platforms,
        platformOrder: platforms,
        intervalMinutes: 60,
        mode: "immediate"
      }
    });
    closeModal();
    ui.publishTab = "running";
    await refreshPublisherSnapshot();
    navigate("publish");
    showToast("发布任务已创建", "本地发布器将按平台顺序领取并回写结果。");
  } catch (error) {
    ui.submittingPublish = false;
    renderModal();
    showToast("发布任务创建失败", error.message, "error");
  }
}

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


function renderTaskModal() {
  const task = state.publishTasks.find((item) => item.id === ui.modal.taskId);
  if (!task) return "";
  const targetRows = Object.entries(task.targets || {}).map(([platform, target]) => `
    <div class="platform-choice">
      <span></span>${platformLogo(platform)}
      <span><b>${escapeHtml(publishPlatformName(platform))}</b><small>${escapeHtml(target?.account || "未绑定账号")}${target?.remoteUrl ? " · 已返回页面地址" : ""}${target?.message ? " · " + escapeHtml(target.message) : ""}</small></span>
      ${statusBadge(target?.status || "draft")}
    </div>
  `).join("");
  const logs = task.logs.slice().reverse().map((log) => '<div class="log-item"><span>' + escapeHtml(log.time) + "</span><b>" + escapeHtml(log.platform) + "</b><span>" + escapeHtml(log.message) + "</span></div>").join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">发布任务详情</h2><p>${escapeHtml(task.id)} · ${escapeHtml(task.version)} · ${escapeHtml(task.groupName)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="publish-article"><b>${escapeHtml(task.articleTitle)}</b><span>各平台结果独立记录；草稿、验证码、审核或失败都不会自动记为“已发布”。</span></div>
      <div class="publish-platforms">${targetRows}</div>
      <h3 class="section-title-sm">执行日志</h3>
      <div class="log-list">${logs}</div>
    </div>
    <div class="modal-foot"><span>任务状态：${STATUS_META[task.status]?.[0] || task.status}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button></div></div>
  `, { wide: true });
}

function renderSearchModal() {
  return modalChrome(`
    <div class="search-box"><span data-icon="search"></span><input id="command-input" value="${escapeHtml(ui.commandQuery)}" placeholder="搜索页面或操作…" autocomplete="off" /></div>
    <div class="command-list" id="command-list">${commandResultsHtml()}</div>
  `);
}

function commandResultsHtml() {
  const commands = [
    { route: "planning", icon: "sparkle", title: "选题中心", description: "维护关键词、问题词库、选题库和内容计划", keys: "选题中心 关键词 问题 内容计划" },
    { route: "content", icon: "file", title: "内容生产", description: "打开文章列表与审核工作流", keys: "文章 审核 写作" },
    { action: "publish-approved", icon: "send", title: "发布已通过文章", description: "选择账号组与发布平台", keys: "发布 微信 知乎 头条" },
    { route: "assets", icon: "folder", title: "内容资产", description: "管理文章版本、官网信源与多平台分发关系", keys: "资产 版本 信源 引用 内容" },
    { route: "monitoring", icon: "chart", title: "运营诊断", description: "查看行业研究、网站诊断与生产发布运行状态", keys: "运营 诊断 研究 信源 爬虫 访问 运行" },
    { route: "knowledge", icon: "book", title: "企业知识", description: "管理产品、案例、FAQ 与资料", keys: "企业资料 知识库" },
    { route: "assistant", icon: "monitor", title: "发布助手", description: "查看设备和平台账号状态", keys: "设备 账号组 登录" },
    { route: "site", icon: "globe", title: "官网运营", description: "预览官网、管理线索与站点设置", keys: "网站 官网 诊断" }
  ];
  const query = ui.commandQuery.trim().toLowerCase();
  const filtered = commands.filter((command) => !query || (command.title + command.description + command.keys).toLowerCase().includes(query));
  if (!filtered.length) return '<div class="empty-state compact"><div><span data-icon="search"></span><h3>没有匹配结果</h3><p>换一个关键词试试。</p></div></div>';
  return filtered.map((command) => `
    <button class="command-item" type="button" data-command-route="${command.route || ""}" data-command-action="${command.action || ""}">
      <span data-icon="${command.icon}"></span><span><b>${command.title}</b><small>${command.description}</small></span><kbd>↵</kbd>
    </button>
  `).join("");
}

function renderNotificationsModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">通知</h2><p>1 条需要处理的运营消息</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <button class="todo-item" type="button" data-action="notification-task">
        <span class="todo-icon red" data-icon="alert"></span><span class="todo-copy"><strong>头条号发布结果待核验</strong><span>平台提交后连接中断，为避免重复发文，任务已暂停自动重试。</span></span><span class="todo-meta"><i class="todo-arrow">›</i></span>
      </button>
      <div class="todo-item"><span class="todo-icon" data-icon="check"></span><span class="todo-copy"><strong>企业知识同步完成</strong><span>36 份资料已完成更新，可用于内容生成。</span></span><span class="todo-meta"><small>1小时前</small></span></div>
    </div>
  `);
}


function renderPairModal() {
  const code = ui.pairingCode || "正在生成配对码…";
  const expires = ui.pairingExpiresAt ? new Date(ui.pairingExpiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "10分钟内有效";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配对本地 GEO 发布器</h2><p>将当前客户后台与 Windows 桌面软件连接</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body text-center">
      <span class="device-icon" data-icon="monitor"></span>
      <p class="pairing-note">在桌面发布器的“绑定节点”中填写当前后台地址和下面的配对码。</p>
      <div class="pairing-code">${escapeHtml(code)}</div>
      <p class="pairing-note small">${escapeHtml(expires)}</p>
      <div class="security-inline text-left"><span data-icon="lock"></span><span>配对只建立设备令牌。平台密码、Cookie、验证码和浏览器 Profile 只保存在客户电脑。</span></div>
    </div>
    <div class="modal-foot"><span>桌面软件完成绑定后会显示在线</span><div class="modal-foot-right"><button class="secondary-button" data-action="refresh-publisher"><span data-icon="refresh"></span>刷新状态</button><button class="secondary-button" data-action="close-modal">完成</button></div></div>
  `);
}

async function issuePublisherPairing() {
  try {
    ui.pairingCode = null;
    ui.pairingExpiresAt = null;
    renderModal();
    const result = await publisherApi("/api/publisher/pairings", { method: "POST", body: {} });
    ui.pairingCode = result.pairing?.code || "";
    ui.pairingExpiresAt = result.pairing?.expiresAt || null;
    renderModal();
  } catch (error) {
    showToast("配对码生成失败", error.message, "error");
  }
}

function legacyKnowledgeDefinition(type) {
  return {
    products: { name: "产品服务", label: "产品 / 服务（每行一条）", help: "用于统一产品名称、服务内容与交付边界。" },
    cases: { name: "案例资质", label: "案例 / 资质（每行一条）", help: "只填写已脱敏且允许对外使用的案例和资质。" },
    faq: { name: "常见问题", label: "标准问答（每行一条）", help: "建议使用“问题｜企业标准答案”的格式。" },
    documents: { name: "知识资料", label: "资料清单（每行一条）", help: "记录资料名称、来源或用途；正文仍在文档知识库中维护版本。" },
    images: { name: "图片素材", label: "图片素材（每行一条）", help: "建议使用“素材名｜版权来源｜ALT 文本”的格式。" },
    adLaw: { name: "广告法词库", label: "合规规则（每行一条）", help: "命中后进入内容风控，不作为企业事实参与 RAG。" },
    sensitive: { name: "企业敏感词", label: "敏感规则（每行一条）", help: "记录需要人工复核的行业词、内部信息或披露边界。" },
    banned: { name: "禁用表述", label: "禁用表述（每行一条）", help: "命中后阻止文章审核通过，修改正文后才可继续。" }
  }[type] || { name: "企业知识", label: "内容（每行一条）", help: "保存后会记录更新时间并在此处回显。" };
}

function legacyKnowledgeDefaultContent(type) {
  const itemText = (item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    return item.kind === "qa" ? `${item.question || item.title}｜${version?.content || ""}` : `${item.title}｜${version?.content || ""}`;
  };
  if (type === "products") return (state.knowledgeItems || []).filter((item) => ["产品服务", "交付规范"].includes(item.category)).map(itemText).join("\n");
  if (type === "cases") return (state.knowledgeItems || []).filter((item) => item.category === "案例").map(itemText).join("\n");
  if (type === "faq") return (state.knowledgeItems || []).filter((item) => item.kind === "qa").map(itemText).join("\n");
  if (type === "documents") return (state.knowledgeItems || []).filter((item) => item.kind !== "qa").map(itemText).join("\n");
  if (type === "images") return (state.contentAssets || []).filter((asset) => asset.kind === "knowledge_image").map((asset) => `${asset.name}｜${asset.license || "来源待确认"}｜${asset.altText || asset.caption || ""}`).join("\n");
  if (type === "adLaw") return "禁止使用“国家级”“最高级”“最佳”等无法证明的绝对化用语\n效果、排名、收录和增长结论必须说明条件与证据\n涉及客户成果时必须使用已审核案例且保留适用边界";
  if (type === "sensitive") return "客户名称、合同金额和未公开经营数据需人工复核\n内部账号、Cookie、验证码和服务器凭据不得进入对外内容\n未公开产品参数与路线图不得对外披露";
  if (type === "banned") return "保证固定排名\n保证被 AI 收录或引用\n无需任何企业资料即可产生效果";
  return "";
}

function renderKnowledgeModal() {
  const type = ui.modal.knowledgeType || "products";
  const definition = legacyKnowledgeDefinition(type);
  const record = state.knowledge[type] || { count: 0, reviewed: 0, updated: "尚未维护" };
  const content = record.content === undefined ? legacyKnowledgeDefaultContent(type) : record.content;
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">管理${escapeHtml(definition.name)}</h2><p>保存后立即写入当前客户空间，并在企业知识页回显</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="side-panel"><h4>统一事实原则</h4><p>${escapeHtml(definition.help)} 保存后直接作为企业可用资料供官网、文章和发布引用；内容规则只参与风险检查。</p></div>
      <div class="field mt-md"><label for="legacy-knowledge-name">卡片名称</label><input class="input" id="legacy-knowledge-name" value="${escapeHtml(record.name || definition.name)}" /></div>
      <div class="field mt-md"><label for="legacy-knowledge-content">${escapeHtml(definition.label)}</label><textarea class="textarea textarea-lg" id="legacy-knowledge-content" placeholder="每行填写一条内容">${escapeHtml(content)}</textarea><small>${escapeHtml(definition.help)}</small></div>
    </div>
    <div class="modal-foot"><span>当前记录：${Number(record.count) || 0} 条 · ${escapeHtml(record.updated || "尚未维护")}</span><div class="modal-foot-right"><button class="secondary-button" data-action="close-modal">取消</button><button class="primary-button" data-action="save-knowledge" data-knowledge="${escapeHtml(type)}"><span data-icon="check"></span>保存并回显</button></div></div>
  `, { wide: true });
}

function legacyKnowledgeBaseForType(type) {
  const lineId = activeBusinessLine()?.id;
  const activeBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived");
  if (type === "faq") return activeBases.find((base) => base.kind === "qa" && (!base.businessLineId || base.businessLineId === lineId)) || activeBases.find((base) => base.kind === "qa") || null;
  if (type === "cases") return activeBases.find((base) => base.kind === "document" && /案例|资质/.test(base.name) && (!base.businessLineId || base.businessLineId === lineId)) || activeBases.find((base) => base.kind === "document" && /案例|资质/.test(base.name)) || null;
  return activeBases.find((base) => base.kind === "document" && base.businessLineId === lineId) || activeBases.find((base) => base.kind === "document" && base.scope === "enterprise") || activeBases.find((base) => base.kind === "document") || null;
}

function syncLegacyCardToKnowledgeItem(type, name, content) {
  const base = legacyKnowledgeBaseForType(type);
  if (!base) return null;
  const now = Date.now();
  let item = (state.knowledgeItems || []).find((entry) => entry.legacyCardKey === type);
  const current = item && knowledgeVersionById(item.latestVersionId);
  const nextNumber = Number(current?.version || 0) + 1;
  const itemId = item?.id || uid("KI-CARD");
  const versionId = uid("KV-CARD") + "-V" + nextNumber;
  const version = {
    id: versionId,
    itemId,
    version: nextNumber,
    reviewStatus: "approved",
    reviewedBy: null,
    reviewedAt: new Date(now).toISOString(),
    content,
    sourceName: `结构化资料卡 · ${name}`,
    locator: name,
    chunks: [{ id: uid("KC"), section: name, text: content }],
    createdAt: now,
    supersedesVersionId: current?.id || null
  };
  state.knowledgeVersions.push(version);
  if (!item) {
    item = {
      id: itemId,
      legacyCardKey: type,
      knowledgeBaseId: base.id,
      kind: base.kind,
      title: name,
      question: base.kind === "qa" ? `${name}有哪些企业标准回答？` : undefined,
      category: type === "products" ? "产品服务" : type === "cases" ? "案例" : type === "faq" ? "FAQ" : "企业资料",
      status: "approved",
      visibility: "public",
      sourceName: version.sourceName,
      locator: name,
      latestVersionId: versionId,
      tags: ["结构化资料"],
      createdAt: now,
      updatedAt: now
    };
    state.knowledgeItems.push(item);
  } else {
    item.knowledgeBaseId = base.id;
    item.kind = base.kind;
    item.title = name;
    if (base.kind === "qa") item.question = item.question || `${name}有哪些企业标准回答？`;
    item.status = "approved";
    item.sourceName = version.sourceName;
    item.locator = name;
    item.latestVersionId = versionId;
    item.updatedAt = now;
  }
  base.itemIds = [...new Set([...(base.itemIds || []), item.id])];
  base.updatedAt = now;
  return item;
}

function syncLegacyKnowledgeImages(entries) {
  const base = legacyKnowledgeBaseForType("documents");
  if (!base) return [];
  const existing = (state.contentAssets || []).filter((asset) => asset.legacyImageCard === true);
  const activeKeys = new Set();
  const assets = entries.map((entry, index) => {
    const [rawName, rawLicense, rawAlt] = String(entry).split(/[｜|]/).map((part) => part.trim());
    const name = rawName || `知识图片 ${index + 1}`;
    const key = name.toLowerCase();
    activeKeys.add(key);
    const asset = existing.find((item) => item.legacyImageKey === key) || { id: uid("ASSET-KB"), createdAt: Date.now() };
    Object.assign(asset, {
      legacyImageCard: true,
      legacyImageKey: key,
      kind: "knowledge_image",
      name,
      mime: asset.mime || "image/*",
      knowledgeBaseId: base.id,
      reviewStatus: "approved",
      reviewedBy: currentUserName() || "系统管理员",
      reviewedAt: new Date().toISOString(),
      license: rawLicense || "企业自有 · 已确认",
      altText: rawAlt || name,
      caption: rawAlt || name,
      accent: asset.accent || ["blue", "teal", "violet", "amber"][index % 4],
      archived: false,
      updatedAt: Date.now()
    });
    if (!state.contentAssets.includes(asset)) state.contentAssets.push(asset);
    return asset;
  });
  existing.filter((asset) => !activeKeys.has(asset.legacyImageKey)).forEach((asset) => { asset.archived = true; asset.updatedAt = Date.now(); });
  return assets;
}

async function saveLegacyKnowledge(type) {
  const key = type || ui.modal?.knowledgeType;
  const definition = legacyKnowledgeDefinition(key);
  const nameInput = document.getElementById("legacy-knowledge-name");
  const contentInput = document.getElementById("legacy-knowledge-content");
  const name = nameInput?.value.trim() || definition.name;
  const content = contentInput?.value.trim() || "";
  if (!content) {
    contentInput?.classList.add("input-error");
    contentInput?.focus();
    return showToast("内容不能为空", "请至少保留一条资料或规则。", "error");
  }
  const entries = content.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  state.knowledge = state.knowledge || {};
  const previous = state.knowledge[key] || {};
  state.knowledge[key] = {
    ...previous,
    name,
    content,
    entries,
    count: entries.length,
    reviewed: entries.length,
    updated: new Date().toLocaleString("zh-CN", { hour12: false }),
    updatedAt: new Date().toISOString(),
    version: Number(previous.version || 0) + 1
  };
  if (["products", "cases", "faq", "documents"].includes(key)) {
    const item = syncLegacyCardToKnowledgeItem(key, name, content);
    if (item) addOperationLog("企业知识", `更新结构化资料「${name}」，新版本已直接生效并进入索引队列`);
  }
  if (key === "images") {
    const assets = syncLegacyKnowledgeImages(entries);
    addOperationLog("企业知识", `更新知识图片素材 ${assets.length} 条`);
  }
  if (["adLaw", "sensitive", "banned"].includes(key)) {
    state.articles.forEach((article) => {
      if (article.status === "published") return;
      article.riskStatus = article.riskStatus === "blocked" || article.riskStatus === "warning" ? article.riskStatus : "stale";
      article.riskScan = null;
    });
    addOperationLog("内容风控", `更新「${name}」规则，未发布文章需重新检测`);
  }
  saveState();
  try {
    await flushWorkspaceSyncNow("knowledge-legacy-explicit-save");
  } catch (error) {
    showToast("知识保存未完成", `${error.message || "服务端知识索引同步失败"} 页面不会把本次操作提示为成功，请修复后重试。`, "error");
    return;
  }
  closeModal();
  render();
  showToast("知识已保存", `已保存「${name}」的 ${entries.length} 条内容，并在对应业务功能中生效；后台会自动建立检索索引。`);
}

function renderUploadKnowledgeImagesModal() {
  const bases = (state.knowledgeBases || []).filter((base) => base.kind === "document" && base.status !== "archived");
  const options = bases.map((base) => `<option value="${escapeHtml(base.id)}">${escapeHtml(base.name)} · ${escapeHtml(knowledgeScopeLabel(base))}</option>`).join("");
  if (!bases.length) return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">批量上传图片</h2><p>请先创建一个文档知识库</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="empty-state"><div><span data-icon="book"></span><h3>还没有可用知识库</h3><p>先创建知识库，再批量上传企业照片。</p><button class="primary-button button-small" type="button" data-action="create-knowledge-base">新建知识库</button></div></div></div>`, { wide: true });
  const progress = knowledgeAssetRuntime.uploadProgress;
  const progressText = progress ? `正在上传第 ${progress.completed}/${progress.total} 批（${progress.created} 张已入库）` : "尚未选择图片";
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">批量上传图片</h2><p>一次可选择最多 500 张；系统会自动拆成小批次上传，统一设置归属后直接入库，无需逐张填写和审核</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="field-row"><div class="field"><label for="knowledge-image-base">保存到知识库 *</label><select class="select" id="knowledge-image-base">${options}</select></div><div class="field"><label for="knowledge-image-category">统一分类</label><select class="select" id="knowledge-image-category"><option>产品图片</option><option>案例现场</option><option>资质证书</option><option>流程图</option><option>数据图表</option><option>文章配图</option><option>其他资料</option></select></div></div><label class="knowledge-image-dropzone" for="knowledge-image-files"><span data-icon="images"></span><b>选择多张图片或整个文件夹</b><p>支持 PNG、JPG、JPEG、WebP、GIF；系统按文件名自动生成图片名称与 Alt 文本。</p><input id="knowledge-image-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple /></label><div class="field-row"><div class="field"><label for="knowledge-image-license">统一来源/版权</label><select class="select" id="knowledge-image-license"><option>企业自有</option><option>客户授权</option><option>供应商授权</option><option>公开资料</option></select></div><div class="field"><label for="knowledge-image-tags">统一标签（可选）</label><input class="input" id="knowledge-image-tags" placeholder="例如：产品A、工厂、应用现场" /></div></div><div class="knowledge-upload-summary" id="knowledge-image-summary"><span data-icon="${progress ? "upload" : "info"}"></span><span>${progressText}</span></div></div><div class="modal-foot"><span>上传后立即可作为文章配图；图片识别在后台继续进行</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-images" ${knowledgeAssetRuntime.uploading ? "disabled" : ""}><span data-icon="upload"></span>${knowledgeAssetRuntime.uploading ? "正在上传…" : "上传"}</button></div></div>`, { wide: true });
}

function renderImportKnowledgeModal() {
  const bases = (state.knowledgeBases || []).filter((base) => base.kind === "document" && base.status !== "archived");
  const preparation = knowledgePreparationById(ui.modal?.preparationId);
  const preferredBase = bases.find((base) => base.businessLineId === activeBusinessLine()?.id) || bases[0];
  const options = bases.map((base) => `<option value="${base.id}" ${base.id === preferredBase?.id ? "selected" : ""}>${escapeHtml(base.name)} · ${escapeHtml(knowledgeScopeLabel(base))}</option>`).join("");
  if (!bases.length) {
    return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">导入资料</h2><p>需要先创建一个文档知识库承接资料</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="empty-state"><div><span data-icon="book"></span><h3>暂无文档知识库</h3><p>先新建文档库，再导入 PDF、Word、Markdown 或文本资料。</p><button class="primary-button button-small" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button></div></div></div>`, { wide: true });
  }
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">导入企业资料</h2><p>上传后自动解析、建立索引并进入文章创作；PDF 中的图片会同步进入图片资料库</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${preparation ? `<section class="knowledge-import-guide"><span class="knowledge-icon ${preparation.id === "pricing_delivery" ? "amber" : preparation.id === "brand_compliance" || preparation.id === "faq" ? "purple" : ""}" data-icon="${preparation.icon}"></span><div><span>正在准备：${escapeHtml(preparation.title)}</span><b>${escapeHtml(preparation.purpose)}</b><p><strong>建议优先上传：</strong>${escapeHtml(preparation.materials.join("；"))}</p></div></section>` : ""}
      <div class="field"><label for="knowledge-import-base">导入到 *</label><select class="select" id="knowledge-import-base">${options}</select></div>
      <div class="field mt-md"><label for="knowledge-import-file">选择资料文件 *</label><input class="input" id="knowledge-import-file" type="file" accept=".pdf,.docx,.xlsx,.txt,.md,.csv,.html,.htm,.json,.xml" multiple /><small>可一次选择多个 PDF、DOCX、XLSX 或普通文档；系统分批解析，失败文件会单独列出。扫描文档需要先配置 OCR。</small></div>
      <div class="field mt-md"><label for="knowledge-import-content">正文或关键摘录（PDF / Word 建议填写）</label><textarea class="textarea" id="knowledge-import-content" rows="8" placeholder="可粘贴资料正文或关键摘录。若是文本类文件，可留空由系统读取。"></textarea></div>
      <div class="privacy-note mt-md"><span data-icon="lock"></span><span>原文件保存在客户私有服务器；PDF 会拆分为文字知识、内嵌图片和来源页码，扫描件在后台继续 OCR。上传资料不会自动修改或发布已有文章。</span></div>
    </div>
    <div class="modal-foot"><span>上传即入库；处理失败的文件会单独提示，不阻塞其他资料</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-import"><span data-icon="upload"></span>上传并入库</button></div></div>
  `, { wide: true });
}

function renderCreateKnowledgeBaseModal() {
  const lineOptions = state.businessLines.filter((line) => line.status === "active").map((line) => '<option value="' + line.id + '" ' + (line.id === ui.selectedBusinessLineId ? "selected" : "") + '>' + escapeHtml(line.name) + "</option>").join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">新建知识库</h2><p>先按内容形态分为文档库或问答库，索引策略统一由系统管理</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="knowledge-type-picker">
        <label><input type="radio" name="knowledge-kind" value="document" checked /><span class="knowledge-icon" data-icon="book"></span><b>文档库</b><small>PDF、Word、网页、产品资料、案例等长资料</small></label>
        <label><input type="radio" name="knowledge-kind" value="qa" /><span class="knowledge-icon purple" data-icon="help"></span><b>问答库</b><small>标准问题、官方答案、异议处理和服务边界</small></label>
      </div>
      <div class="field mt-lg"><label for="knowledge-base-name">知识库名称 *</label><input class="input" id="knowledge-base-name" placeholder="例如：GEO 产品资料库" autocomplete="off" /></div>
      <div class="field-row mt-md"><div class="field"><label for="knowledge-base-scope">使用范围</label><select class="select" id="knowledge-base-scope"><option value="business_line">业务线专用</option><option value="enterprise">全企业共享</option></select></div><div class="field"><label for="knowledge-base-line">所属业务线</label><select class="select" id="knowledge-base-line">${lineOptions}</select></div></div>
      <div class="field mt-md"><label for="knowledge-base-description">用途说明</label><textarea class="textarea" id="knowledge-base-description" rows="3" placeholder="说明这里存放什么，以及允许哪些内容任务使用"></textarea></div>
      <div class="privacy-note"><span data-icon="database"></span><span><b>企业 RAG 索引</b><br />系统按知识条目和不可变版本进行分块、向量化与混合检索；可由管理员配置正式向量库和 embedding 模型。</span></div>
    </div>
    <div class="modal-foot"><span>新建后可继续添加文档或标准问答</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-base"><span data-icon="plus"></span>创建知识库</button></div></div>
  `, { wide: true });
}

function renderKnowledgeBaseDetailModal() {
  const base = knowledgeBaseById(ui.modal.baseId);
  if (!base) return "";
  const items = knowledgeBaseItems(base.id);
  const rows = items.map((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const approved = item.status === "approved" && version?.reviewStatus === "approved";
    const processing = ["pending_ocr", "processing"].includes(item.importStatus) || ["queued", "processing"].includes(version?.extractionStatus);
    return `<tr><td class="article-title-cell"><b>${escapeHtml(item.title || item.question)}</b><small>${escapeHtml(knowledgeSourceLabel(item, version))} · ${escapeHtml(knowledgeLocator(item, version))}</small></td><td>v${escapeHtml(version?.version || "1")}</td><td><span class="small-tag">${escapeHtml(item.visibility === "internal" ? "仅内部" : "可对外")}</span></td><td>${processing ? '<span class="status-badge status-review">后台处理中</span>' : '<span class="status-badge status-approved">可用于写作</span>'}</td><td><div class="table-actions"><button class="link-button" type="button" data-action="open-knowledge-item" data-item-id="${item.id}">查看 / 编辑</button><button class="link-button danger-link" type="button" data-action="delete-knowledge-item" data-item-id="${item.id}">删除</button></div></td></tr>`;
  }).join("");
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(base.name)}</h2><p>${knowledgeKindLabel(base.kind)} · ${escapeHtml(knowledgeScopeLabel(base))} · RAG 索引${base.status === "ready" ? "就绪" : "处理中"}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="knowledge-detail-summary"><div><span>全部知识</span><b>${items.length}</b></div><div><span>可用于写作</span><b>${approvedKnowledgeItems(base.id).length}</b></div><div><span>后台处理中</span><b>${items.filter((item) => ["pending_ocr", "processing"].includes(item.importStatus)).length}</b></div><div><span>最近索引</span><b>${escapeHtml(base.updatedAt ? formatRelative(base.updatedAt) : "刚刚")}</b></div></div>
      <div class="card-header inline-head"><div><h3>知识条目</h3><p>${escapeHtml(base.description || "")}</p></div><button class="primary-button button-small" type="button" data-action="add-knowledge-item" data-base-id="${base.id}"><span data-icon="plus"></span>${base.kind === "qa" ? "新增问答" : "新增资料"}</button></div>
      ${rows ? '<div class="table-scroll knowledge-detail-table"><table class="data-table"><thead><tr><th>资料 / 问题</th><th>版本</th><th>公开范围</th><th>写作状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state"><div><span data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span><h3>这个知识库还是空的</h3><p>添加文字、文档、PDF 或批量图片，上传后直接进入资料库。</p><button class="primary-button button-small" type="button" data-action="add-knowledge-item" data-base-id="' + base.id + '"><span data-icon="plus"></span>添加知识</button></div></div>'}
    </div>
    <div class="modal-foot"><span>历史文章始终保留生成时引用的知识版本</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>
  `, { wide: true });
}

function renderKnowledgeItemModal() {
  const base = knowledgeBaseById(ui.modal.baseId || knowledgeItemById(ui.modal.itemId)?.knowledgeBaseId);
  const item = knowledgeItemById(ui.modal.itemId);
  if (!base) return "";
  const version = item ? knowledgeVersionById(item.latestVersionId) : null;
  if (item && ui.modal.edit) {
    return modalChrome(`
      <div class="modal-head"><div><h2 id="modal-title">编辑知识并新建版本</h2><p>${escapeHtml(base.name)} · 当前 v${escapeHtml(version?.version || "1")} 会保留给历史文章引用</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="关闭"><span data-icon="x"></span></button></div>
      <div class="modal-body">
        ${base.kind === "qa" ? `<div class="field"><label for="knowledge-item-question">标准问题 *</label><input class="input" id="knowledge-item-question" value="${escapeHtml(item.question || item.title)}" /></div>` : `<div class="field"><label for="knowledge-item-title">资料标题 *</label><input class="input" id="knowledge-item-title" value="${escapeHtml(item.title)}" /></div>`}
        <div class="field mt-md"><label for="knowledge-item-content">${base.kind === "qa" ? "企业标准答案 *" : "资料原文 *"}</label><textarea class="textarea" id="knowledge-item-content" rows="8">${escapeHtml(version?.content || item.content || "")}</textarea></div>
        <div class="field-row mt-md"><div class="field"><label for="knowledge-item-source">来源文件 / URL</label><input class="input" id="knowledge-item-source" value="${escapeHtml(knowledgeSourceLabel(item, version))}" /></div><div class="field"><label for="knowledge-item-locator">页码 / 章节</label><input class="input" id="knowledge-item-locator" value="${escapeHtml(knowledgeLocator(item, version))}" /></div></div>
        <div class="field mt-md"><label for="knowledge-item-visibility">对外范围</label><select class="select" id="knowledge-item-visibility"><option value="public" ${item.visibility !== "internal" ? "selected" : ""}>可用于对外内容</option><option value="internal" ${item.visibility === "internal" ? "selected" : ""}>仅内部参考</option></select></div>
        <div class="privacy-note"><span data-icon="history"></span><span>保存后会立即生成新版本并自动建立索引；历史计划和文章仍引用原来的已冻结版本。</span></div>
      </div>
      <div class="modal-foot"><span>新版本保存后自动进入 RAG</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">取消</button><button class="primary-button" type="button" data-action="save-knowledge-item-edit" data-item-id="${item.id}"><span data-icon="check"></span>保存新版本</button></div></div>
    `, { wide: true });
  }
  if (item) {
    return modalChrome(`
      <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(item.title || item.question)}</h2><p>${escapeHtml(base.name)} · v${escapeHtml(version?.version || "1")} · ${escapeHtml(knowledgeLocator(item, version))}</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="返回"><span data-icon="x"></span></button></div>
      <div class="modal-body"><div class="source-document"><span>${base.kind === "qa" ? "企业标准答案" : "知识原文"}</span>${item.question ? '<h3>问：' + escapeHtml(item.question) + '</h3>' : ""}<p>${escapeHtml(version?.content || item.content || "暂无正文")}</p></div><div class="side-list mt-lg"><div><span>资料状态</span><b>${version?.extractionStatus && ["queued", "processing", "pending"].includes(version.extractionStatus) ? "处理中" : "可用"}</b></div><div><span>来源</span><b>${escapeHtml(knowledgeSourceLabel(item, version))}</b></div><div><span>定位</span><b>${escapeHtml(knowledgeLocator(item, version))}</b></div><div><span>对外范围</span><b>${item.visibility === "internal" ? "仅内部" : "可对外"}</b></div></div></div>
      <div class="modal-foot"><span>查看的是当前知识版本，文章引用会另外冻结</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="edit-knowledge-item" data-item-id="${item.id}"><span data-icon="edit"></span>编辑并新建版本</button><button class="primary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">返回知识库</button></div></div>
    `);
  }
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">${base.kind === "qa" ? "新增标准问答" : "新增文档知识"}</h2><p>${escapeHtml(base.name)} · 保存后立即可用并自动索引</p></div><button class="icon-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      ${base.kind === "qa" ? '<div class="field"><label for="knowledge-item-question">标准问题 *</label><input class="input" id="knowledge-item-question" placeholder="例如：GEO 服务从哪里开始？" /></div><div class="field mt-md"><label for="knowledge-item-content">企业标准答案 *</label><textarea class="textarea" id="knowledge-item-content" rows="7" placeholder="只填写企业确认、允许使用的回答"></textarea></div>' : '<div class="field"><label for="knowledge-item-title">资料标题 *</label><input class="input" id="knowledge-item-title" placeholder="例如：GEO 服务交付说明" /></div><div class="field mt-md"><label>上传资料文件（可选）</label><label class="knowledge-file-dropzone" for="knowledge-item-file"><span class="knowledge-file-dropzone-icon" data-icon="upload"></span><span><b>点击选择本地文件</b><small>支持 PDF、Word、Excel、Markdown、文本和图片，单个文件不超过 20 MB</small></span><em>选择文件</em><input id="knowledge-item-file" type="file" accept=".pdf,.docx,.xlsx,.txt,.md,.csv,.html,.htm,.json,.xml,.png,.jpg,.jpeg,.webp,.gif,image/*" /></label><div class="knowledge-file-summary" id="knowledge-item-file-summary"><span data-icon="info"></span><span>尚未选择文件；也可以直接在下方粘贴文字</span></div></div><div class="knowledge-input-divider"><span>或直接录入文字</span></div><div class="field"><label for="knowledge-item-content">资料原文（可选）</label><textarea class="textarea" id="knowledge-item-content" rows="6" placeholder="上传文件与粘贴文字二选一；如果同时填写，文字将作为文件的关键摘录"></textarea></div>'}
      <div class="field-row mt-md"><div class="field"><label for="knowledge-item-source">来源文件 / URL</label><input class="input" id="knowledge-item-source" placeholder="方案.pdf 或 https://..." /></div><div class="field"><label for="knowledge-item-locator">页码 / 章节</label><input class="input" id="knowledge-item-locator" placeholder="第 6 页 / 标准答案" /></div></div>
      <div class="field mt-md"><label for="knowledge-item-visibility">对外范围</label><select class="select" id="knowledge-item-visibility"><option value="public">可用于对外内容</option><option value="internal">仅内部参考</option></select></div>
      <div class="privacy-note"><span data-icon="database"></span><span>保存后立即进入知识库；文字自动索引，PDF 与图片按需进入后台解析和 OCR。知识资料不需要人工审核。</span></div>
    </div>
    <div class="modal-foot"><span>文件或文字保存后自动解析并进入 RAG</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="back-knowledge-base" data-base-id="${base.id}">取消</button><button class="primary-button" type="button" data-action="submit-knowledge-item" data-base-id="${base.id}"><span data-icon="check"></span>上传并入库</button></div></div>
  `, { wide: true });
}

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

function stripArticleRiskHighlights(html = "") {
  const source = String(html || "");
  if (!source) return source;
  if (typeof document === "undefined") {
    return source.replace(/<(?:mark|span)\b[^>]*class=["'][^"']*article-risk-highlight[^"']*["'][^>]*>([\s\S]*?)<\/(?:mark|span)>/gi, "$1");
  }
  const template = document.createElement("template");
  template.innerHTML = source;
  template.content.querySelectorAll("mark.article-risk-highlight, span.article-risk-highlight").forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  });
  return template.innerHTML;
}

function articleRiskHighlightDescriptors(hits = []) {
  const byTerm = new Map();
  (Array.isArray(hits) ? hits : []).forEach((hit) => {
    const term = String(hit?.term || "").trim();
    if (!term) return;
    const key = term.toLocaleLowerCase();
    const current = byTerm.get(key);
    if (!current || (hit.level === "blocked" && current.level !== "blocked")) byTerm.set(key, { ...hit, term });
  });
  return [...byTerm.values()].sort((left, right) => right.term.length - left.term.length);
}

function articleRiskHighlightRegex(hits = []) {
  const descriptors = articleRiskHighlightDescriptors(hits);
  if (!descriptors.length) return { descriptors, map: new Map(), regex: null };
  const map = new Map(descriptors.map((hit) => [hit.term.toLocaleLowerCase(), hit]));
  const escapedTerms = descriptors.map((hit) => hit.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { descriptors, map, regex: new RegExp(escapedTerms.join("|"), "gi") };
}

function articleRiskMarkHtml(value, hit) {
  const blocked = hit?.level === "blocked";
  const label = blocked ? "违禁" : "复核";
  const detail = `${articleRiskHitLabel(hit)}：${hit?.message || hit?.rule || "请核对这段文字。"}`;
  return `<mark class="article-risk-highlight ${blocked ? "blocked" : "warning"}" data-risk-hit-id="${escapeHtml(hit?.id || "")}" data-risk-label="${label}" title="${escapeHtml(detail)}" aria-label="风险文字：${escapeHtml(value)}；${escapeHtml(detail)}">${escapeHtml(value)}</mark>`;
}

function highlightArticleRiskText(value, hits = []) {
  const source = String(value || "");
  const matcher = articleRiskHighlightRegex(hits);
  if (!source || !matcher.regex) return escapeHtml(source);
  let output = "";
  let cursor = 0;
  source.replace(matcher.regex, (match, offset) => {
    output += escapeHtml(source.slice(cursor, offset));
    const hit = matcher.map.get(match.toLocaleLowerCase()) || matcher.descriptors.find((item) => item.term.toLocaleLowerCase() === match.toLocaleLowerCase());
    output += articleRiskMarkHtml(match, hit);
    cursor = offset + match.length;
    return match;
  });
  output += escapeHtml(source.slice(cursor));
  return output;
}

function highlightArticleRiskHtml(html = "", hits = []) {
  const source = stripArticleRiskHighlights(html);
  const matcher = articleRiskHighlightRegex(hits);
  if (!source || !matcher.regex || typeof document === "undefined") return source;
  const template = document.createElement("template");
  template.innerHTML = source;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("[data-citation-id], .article-risk-highlight, script, style")) continue;
    if (matcher.regex.test(node.nodeValue || "")) {
      matcher.regex.lastIndex = 0;
      textNodes.push(node);
    }
    matcher.regex.lastIndex = 0;
  }
  textNodes.forEach((textNode) => {
    const sourceText = textNode.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    sourceText.replace(matcher.regex, (match, offset) => {
      if (offset > cursor) fragment.appendChild(document.createTextNode(sourceText.slice(cursor, offset)));
      const hit = matcher.map.get(match.toLocaleLowerCase()) || matcher.descriptors.find((item) => item.term.toLocaleLowerCase() === match.toLocaleLowerCase());
      const markTemplate = document.createElement("template");
      markTemplate.innerHTML = articleRiskMarkHtml(match, hit);
      fragment.appendChild(markTemplate.content.firstElementChild);
      cursor = offset + match.length;
      return match;
    });
    if (cursor < sourceText.length) fragment.appendChild(document.createTextNode(sourceText.slice(cursor)));
    textNode.replaceWith(fragment);
    matcher.regex.lastIndex = 0;
  });
  return template.innerHTML;
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


function addBusinessKeywords() {
  const line = activeBusinessLine();
  const values = [...new Set(ui.businessKeywordInput.split(/[，,;；\n]/).map((value) => value.trim()).filter(Boolean))];
  if (!line || !values.length) {
    ui.businessKeywordError = "请至少输入 1 个关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (values.length > 20) {
    ui.businessKeywordError = "一次最多添加 20 个关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (values.some((value) => value.length > 40)) {
    ui.businessKeywordError = "单个关键词不能超过 40 个字。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  const existing = new Set(state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active").map((item) => item.term.toLowerCase()));
  const added = values.filter((value) => !existing.has(value.toLowerCase()));
  if (!added.length) {
    ui.businessKeywordError = "这些关键词已存在于当前业务线。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  state.keywords.unshift(...added.map((term, index) => ({ id: uid("KW") + index, businessLineId: line.id, term, type: "核心关键词", keywordRole: "core", source: "手动添加", status: "active", createdAt: Date.now() })));
  ui.businessKeywordInput = "";
  ui.businessKeywordError = "";
  saveState();
  render();
  showToast("核心关键词已新增", "已向「" + line.name + "」新增 " + added.length + " 个核心关键词；勾选后即可智能拓展种子词。");
}

function addQuestionToLibrary() {
  const line = activeBusinessLine();
  const question = ui.questionInput.trim();
  if (!question) {
    ui.questionError = "请输入客户问题。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  if (question.length > 120) {
    ui.questionError = "问题不能超过 120 个字。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  const duplicate = state.questionLibrary.some((item) => item.businessLineId === line.id && item.question.toLowerCase() === question.toLowerCase() && item.status === "active");
  if (duplicate) {
    ui.questionError = "问题词库中已经存在相同问题。";
    render();
    return document.getElementById("question-input")?.focus();
  }
  const manualQuestion = { id: uid("Q"), packId: null, businessLineId: line.id, sourceKeyword: "人工录入", question, dimension: "question", intent: "待判断", stage: "待判断", coverage: "未覆盖", source: "手动添加", status: "active", version: 1, topicId: null, selected: false, recommendation: 80, createdAt: Date.now(), updatedAt: Date.now() };
  manualQuestion.geoIntent = buildGeoQuestionIntent(manualQuestion);
  state.questionLibrary.unshift(manualQuestion);
  ui.questionInput = "";
  ui.questionError = "";
  saveState();
  render();
  showToast("问题已加入词库", "可以继续勾选问题并生成正式选题。");
}

function saveSelectedQuestions() {
  const line = activeBusinessLine();
  const selected = state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status !== "archived" && question.selected);
  if (!selected.length) return showToast("还没有选择问题", "请先勾选至少一个拓展结果。", "error");
  const affectedPackIds = new Set(selected.map((question) => question.packId).filter(Boolean));
  selected.forEach((question) => { question.status = "active"; question.version = Number(question.version) || 1; question.updatedAt = Date.now(); question.selected = false; });
  affectedPackIds.forEach((packId) => updateKeywordPackTotal(state.keywordPacks.find((pack) => pack.id === packId)));
  ui.planningTab = "questions";
  saveState();
  render();
  showToast("问题已入库", "已保存 " + selected.length + " 个标准问题，下一步可以生成选题。");
}

function normalizeAiTopicCandidate(item, sourceQuestion, index, generationRunId = null) {
  if (!item || typeof item !== "object" || !sourceQuestion) throw new Error("模型返回的选题缺少来源问题");
  const title = String(item.title || "").trim();
  if (!title) throw new Error("模型返回了空的选题标题");
  const coreQuestion = String(item.core_question || item.coreQuestion || title || sourceQuestion.question).trim();
  if (!coreQuestion) throw new Error("模型返回的选题缺少核心回答问题");
  const quality = item.quality || {};
  const topic = {
    id: `TOP-AI-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    packId: sourceQuestion.packId || null,
    businessLineId: sourceQuestion.businessLineId,
    questionId: sourceQuestion.id,
    questionSnapshot: cloneData(sourceQuestion),
    keyword: sourceQuestion.sourceKeyword,
    title: title.slice(0, 240),
    coreQuestion: coreQuestion.slice(0, 240),
    dimension: sourceQuestion.dimension,
    intent: String(item.user_intent || sourceQuestion.intent || "客户问答"),
    recommendation: scoreTo100(item.recommendation ?? quality.recommendation_score ?? sourceQuestion.recommendation, 0),
    business: scoreTo100(item.business ?? quality.business_score ?? sourceQuestion.business, 0),
    scoreSource: String(item.scoreSource || "").trim() || null,
    quality: cloneData(quality),
    coverage: "未覆盖",
    reason: `由客户问题生成：${sourceQuestion.question}`,
    source: "AI 模型选题",
    generationRunId: item.generationRunId || item.generation_run_id || generationRunId || null,
    status: "active",
    autoAcceptedAt: Date.now(),
    version: 1,
    selected: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  topic.geoIntent = {
    ...(sourceQuestion.geoIntent || buildGeoQuestionIntent(sourceQuestion)),
    coreQuestion,
    expectedAnswer: String(item.content_direction || "先回答客户问题，再给出依据、适用条件、步骤和边界。"),
    evidenceNeeds: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String) : sourceQuestion.evidenceRequirements || []
  };
  topic.geoBrief = {
    ...buildGeoTopicBrief(topic, sourceQuestion),
    title: topic.title,
    coreQuestion,
    contentDirection: String(item.content_direction || "").slice(0, 2000),
    userIntent: topic.intent,
    answerOutline: Array.isArray(item.answer_outline) ? item.answer_outline.map(String).slice(0, 12) : [],
    evidenceRequirements: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String).slice(0, 20) : [],
    proofPoints: Array.isArray(item.proof_points) ? item.proof_points.map(String).slice(0, 20) : [],
    audienceBoundary: String(item.audience_boundary || "").slice(0, 1000),
    sourceQuestionId: sourceQuestion.id
  };
  return topic;
}

async function questionsToTopics(questionIds = null) {
  const line = activeBusinessLine();
  if (!line) return showToast("业务线不可用", "请先选择一个已启用的产品 / 业务线。", "error");
  const requestedIds = Array.isArray(questionIds) ? new Set(questionIds.map(String)) : null;
  const questions = state.questionLibrary.filter((question) => question.businessLineId === line.id && question.status === "active" && (requestedIds ? requestedIds.has(String(question.id)) : question.selected));
  if (!questions.length) return showToast("还没有选择问题", "请先勾选至少一个问题再生成选题。", "error");
  let providerId = selectedTextProviderId();
  if (!providerId) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const pending = questions.filter((question) => !planningQuestionTopics(question).some((topic) => topic.status !== "archived"));
  if (!pending.length) {
    ui.planningTab = "topics";
    render();
    return showToast("选题已经存在", "所选问题都已关联选题，已切换到选题库。");
  }
  ui.topicGenerating = true;
  ui.topicGenerationProgress = { total: pending.length, completed: 0, failed: 0, questionIds: pending.map((question) => String(question.id)) };
  render();
  const batches = [];
  for (let index = 0; index < pending.length; index += 20) batches.push(pending.slice(index, index + 20));
  const created = [];
  const failures = [];
  const failedQuestionIds = new Set();
  const addFailure = (question, message) => {
    const questionId = String(question?.id || "");
    if (!questionId) return;
    if (questionId && failedQuestionIds.has(questionId)) return;
    if (questionId) failedQuestionIds.add(questionId);
    failures.push({ questionId, title: question?.question || "未知问题", message: message || "模型未返回可用选题" });
  };

  for (const batch of batches) {
    let rawTopics = [];
    let generationRunId = null;
    try {
      const payload = await aiApi("/api/ai/generate/topics", {
        method: "POST",
        body: {
          providerId,
          model: selectedTextModelName(),
          businessLine: aiBusinessLinePayload(line),
          questions: batch.map((question) => ({
            id: question.id,
            question: question.question,
            dimension: question.dimension,
            sourceKeyword: question.sourceKeyword,
            coverage: question.coverage,
            intent: question.intent || "",
            stage: question.stage || "",
            evidenceRequirements: question.evidenceRequirements || question.geoIntent?.evidenceNeeds || []
          })),
          existingTopics: state.topics
            .filter((topic) => topicBusinessLineId(topic) === line.id && topic.status !== "archived")
            .map((topic) => topic.title)
            .filter(Boolean)
            .slice(0, 100)
        }
      });
      const data = payload.data || payload;
      rawTopics = data.topics || data.items || [];
      generationRunId = data.generationRunId || data.runId || null;
      if (!Array.isArray(rawTopics) || !rawTopics.length) throw new Error("模型没有返回可用选题");
    } catch (error) {
      batch.forEach((question) => addFailure(question, error.message || "本批选题生成失败"));
      ui.topicGenerationProgress.completed += batch.length;
      ui.topicGenerationProgress.failed = failures.length;
      render();
      continue;
    }

    const completedQuestionIds = new Set();
    rawTopics.forEach((item, index) => {
      const sourceId = item?.question_id || item?.questionId || item?.sourceQuestionId;
      const sourceText = String(item?.question || item?.primary_question || "");
      const sourceQuestion = batch.find((question) => sourceId && String(question.id) === String(sourceId))
        || batch.find((question) => sourceText && question.question === sourceText)
        || (!sourceId ? batch[index] : null);
      try {
        if (!sourceQuestion) throw new Error("模型返回的选题无法匹配来源问题");
        if (completedQuestionIds.has(sourceQuestion.id)) return;
        const existing = planningQuestionTopics(sourceQuestion).find((candidate) => candidate.status !== "archived");
        if (existing) {
          sourceQuestion.topicId = existing.id;
          sourceQuestion.coverage = "已规划";
          sourceQuestion.updatedAt = Date.now();
          sourceQuestion.selected = false;
          completedQuestionIds.add(sourceQuestion.id);
          return;
        }
        const topic = normalizeAiTopicCandidate(item, sourceQuestion, created.length + index, generationRunId);
        state.topics.unshift(topic);
        sourceQuestion.topicId = topic.id;
        sourceQuestion.coverage = "已规划";
        sourceQuestion.updatedAt = Date.now();
        sourceQuestion.selected = false;
        completedQuestionIds.add(sourceQuestion.id);
        created.push(topic);
      } catch (error) {
        addFailure(sourceQuestion, error.message || "选题结构不完整");
      }
    });
    batch.filter((question) => !completedQuestionIds.has(question.id)).forEach((question) => addFailure(question, "模型没有为该问题返回选题"));
    ui.topicGenerationProgress.completed += batch.length;
    ui.topicGenerationProgress.failed = failures.length;
    if (completedQuestionIds.size) saveState();
    render();
  }

  ui.topicGenerating = false;
  ui.topicGenerationProgress = null;
  if (created.length) ui.planningTab = "topics";
  saveState();
  render();
  if (created.length && failures.length) {
    showToast("选题部分生成完成", `已生成并保存 ${created.length} 个选题，${failures.length} 个问题保留勾选可直接重试。首个错误：${failures[0].message}`, "warning");
  } else if (created.length) {
    showToast("选题已生成并入库", `模型已为 ${created.length} 个客户问题生成对应选题，可直接编辑、生成文章或加入内容计划。`);
  } else {
    showToast("选题生成失败", failures[0]?.message || "模型未返回可用选题，请检查配置后重试。", "error");
  }
}

async function submitKnowledgeBase() {
  const nameInput = document.getElementById("knowledge-base-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("知识库名称不能为空", "请填写一个便于运营人员识别的名称。", "error");
  }
  const editingBase = state.knowledgeBases.find((base) => base.id === ui.modal.baseId);
  if (editingBase) {
    editingBase.name = name;
    editingBase.scope = document.getElementById("knowledge-base-scope")?.value || editingBase.scope || "business_line";
    const lineId = document.getElementById("knowledge-base-line")?.value || "";
    if (lineId) editingBase.businessLineId = editingBase.scope === "enterprise" ? null : lineId;
    editingBase.description = document.getElementById("knowledge-base-description")?.value.trim() || editingBase.description;
    editingBase.updatedAt = Date.now();
    saveState();
    closeModal();
    render();
    return showToast("知识库已更新", "名称、范围或说明已同步。", "success");
  }
  if ((state.knowledgeBases || []).some((base) => base.name.toLowerCase() === name.toLowerCase())) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("知识库名称已存在", "请进入现有知识库，或使用其他名称。", "error");
  }
  const kind = document.querySelector('input[name="knowledge-kind"]:checked')?.value || "document";
  const scope = document.getElementById("knowledge-base-scope")?.value || "business_line";
  const businessLineId = scope === "enterprise" ? null : document.getElementById("knowledge-base-line")?.value || activeBusinessLine()?.id || null;
  const base = {
    id: uid("KB"), name, kind, scope, businessLineId, isDefault: false, indexStrategy: "rag", status: "ready",
    description: document.getElementById("knowledge-base-description")?.value.trim() || (kind === "qa" ? "企业认可的标准问题与标准回答。" : "上传后自动进入企业内容生产的可用资料。"),
    itemIds: [], createdAt: Date.now(), updatedAt: Date.now()
  };
  try {
    const created = await productionApi("/api/v1/knowledge/libraries", { method: "POST", body: { name: base.name, kind: base.kind, scope: base.scope, businessLineId: base.businessLineId, description: base.description || "" } });
    const remoteBase = created.data?.library || created.library;
    if (!remoteBase?.id) throw new Error("服务端未返回知识库 ID");
    Object.assign(base, { id: remoteBase.id, status: remoteBase.status === "archived" ? "archived" : "ready", createdAt: remoteBase.createdAt || base.createdAt, updatedAt: remoteBase.updatedAt || base.updatedAt });
  } catch (error) {
    showToast("知识库创建失败", `${error.message || "服务端保存失败"} 本地不会显示为已创建。`, "error");
    return;
  }
  state.knowledgeBases.unshift(base);
  saveState();
  render();
  ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
  renderModal();
  showToast("知识库已创建", "已创建「" + name + "」，现在可以添加" + (kind === "qa" ? "标准问答" : "文档资料") + "。");
}

async function submitKnowledgeImport() {
  const base = knowledgeBaseById(document.getElementById("knowledge-import-base")?.value);
  const fileInput = document.getElementById("knowledge-import-file");
  const files = Array.from(fileInput?.files || []);
  const pasted = document.getElementById("knowledge-import-content")?.value.trim() || "";
  const preparation = knowledgePreparationById(ui.modal?.preparationId);
  if (!base || base.kind !== "document") return showToast("请选择文档知识库", "导入资料必须进入一个有效的文档知识库。", "error");
  if (!files.length) {
    fileInput?.classList.add("input-error");
    fileInput?.focus();
    return showToast("请选择资料文件", "可以一次选择多个 PDF、Word 或普通文档。", "error");
  }
  if (files.length > 100) return showToast("文件数量过多", "单次最多导入 100 个文档，请分批处理。", "error");
  const oversized = files.find((file) => Number(file.size || 0) > 20 * 1024 * 1024);
  if (oversized) return showToast("单个文件过大", `「${oversized.name}」超过 20 MB，请拆分或压缩后再上传。`, "error");
  if (files.reduce((sum, file) => sum + Number(file.size || 0), 0) > 100 * 1024 * 1024) return showToast("本批文件过大", "全部文件合计不能超过 100 MB，请分批导入。", "error");
  if (files.length > 1 && pasted) return showToast("批量导入不使用统一摘录", "一次导入多个文件时请清空正文/摘录；系统会分别解析每个原文件。", "error");
  const submitButton = document.querySelector('[data-action="submit-knowledge-import"]');
  const originalButtonHtml = submitButton?.innerHTML || "";
  if (submitButton) { submitButton.disabled = true; submitButton.innerHTML = '<span data-icon="upload"></span>正在批量解析…'; hydrateIcons(submitButton); }
  try {
    await ensureKnowledgeBaseOnServer(base);
    const batches = imageUploadBatches(files, 20, 20 * 1024 * 1024);
    let created = 0;
    let duplicateCount = 0;
    const failures = [];
    for (const batch of batches) {
      const documents = await Promise.all(batch.map(async (file) => {
        const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
        return {
          title: file.name.replace(/\.[^.]+$/, "") || file.name,
          sourceType: "file",
          sourceName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
          ...(files.length === 1 && pasted ? { content: pasted } : {}),
          metadata: { visibility: "public", importedFrom: "browser-batch", extension, size: Number(file.size || 0), lastModified: Number(file.lastModified || 0), ...(preparation ? { preparationId: preparation.id, preparationLabel: preparation.title } : {}) }
        };
      }));
      const response = await productionApi("/api/v1/knowledge/documents-batch", { method: "POST", body: { libraryId: base.id, documents, defaults: { visibility: "public" } } });
      created += Number(response.data?.created || 0);
      duplicateCount += Number(response.data?.duplicates?.length || 0);
      failures.push(...(response.data?.failures || []));
    }
    await Promise.all([refreshKnowledgeFromServer(), refreshKnowledgeAssetsFromServer()]);
    addOperationLog("企业知识", `批量导入 ${files.length} 个${preparation ? `「${preparation.title}」` : ""}资料到知识库「${base.name}」：成功 ${created}，重复 ${duplicateCount}，失败 ${failures.length}`);
    saveState();
    render();
    ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
    renderModal();
    if (failures.length) {
      const names = failures.slice(0, 3).map((item) => item.sourceName).join("、");
      showToast("批量导入已完成，部分文件失败", `成功 ${created} 个，失败 ${failures.length} 个（${names}${failures.length > 3 ? "等" : ""}）。失败文件未被伪装成已入库。`, "warning");
    } else {
      showToast("资料已批量导入知识库", `成功 ${created} 个${duplicateCount ? `，跳过 ${duplicateCount} 个重复文件` : ""}；已进入解析和 RAG 索引流程。`, "success");
    }
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.innerHTML = originalButtonHtml; hydrateIcons(submitButton); }
  }
}

async function submitKnowledgeImages() {
  if (knowledgeAssetRuntime.uploading) return;
  const fileInput = document.getElementById("knowledge-image-files");
  const files = Array.from(fileInput?.files || []).filter((file) => String(file.type || "").startsWith("image/"));
  const libraryId = document.getElementById("knowledge-image-base")?.value || "";
  if (!libraryId || !knowledgeBaseById(libraryId)) return showToast("请选择知识库", "图片需要保存到一个有效的文档知识库。", "error");
  if (!files.length) return showToast("请选择图片", "可以一次选择多张 PNG、JPG 或 WebP 图片。", "error");
  if (files.length > 500) return showToast("图片数量过多", "单次最多上传 500 张，请分批处理。", "error");
  const oversized = files.find((file) => Number(file.size || 0) > 20 * 1024 * 1024);
  if (oversized) return showToast("单张图片过大", `「${oversized.name}」超过 20 MB，请压缩后再上传。`, "error");
  const tags = (document.getElementById("knowledge-image-tags")?.value || "").split(/[，,;；]/).map((item) => item.trim()).filter(Boolean);
  const defaults = {
    category: document.getElementById("knowledge-image-category")?.value || "其他资料",
    license: document.getElementById("knowledge-image-license")?.value || "企业自有",
    tags,
    sourceRole: "batch_upload"
  };
  knowledgeAssetRuntime.uploading = true;
  knowledgeAssetRuntime.uploadProgress = { completed: 0, total: 0, created: 0, duplicates: 0 };
  renderModal();
  try {
    // Keep browser memory and proxy request bodies bounded even when a user
    // selects an entire 200-image folder. The user still clicks once; the
    // client streams predictable 40-file / 20 MB batches to the server.
    const batches = imageUploadBatches(files);
    knowledgeAssetRuntime.uploadProgress.total = batches.length;
    let created = 0;
    let duplicates = 0;
    for (const batch of batches) {
      const assets = await Promise.all(batch.map(async (file) => ({
        sourceName: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
        altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        metadata: { size: Number(file.size || 0), lastModified: Number(file.lastModified || 0) }
      })));
      const payload = await productionApi("/api/v1/knowledge/assets-batch", { method: "POST", body: { libraryId, assets, defaults } });
      created += Number(payload.data?.created || payload.data?.items?.length || 0);
      duplicates += Number(payload.data?.duplicates?.length || 0);
      knowledgeAssetRuntime.uploadProgress.completed += 1;
      knowledgeAssetRuntime.uploadProgress.created = created;
      knowledgeAssetRuntime.uploadProgress.duplicates = duplicates;
      renderModal();
    }
    await refreshKnowledgeAssetsFromServer();
    closeModal();
    ui.knowledgeTab = "assets";
    render();
    showToast("图片已批量入库", `成功上传 ${created} 张${duplicates ? `，跳过 ${duplicates} 张重复图片` : ""}；现在可以在写作台直接插入。`, "success");
  } catch (error) {
    const progress = knowledgeAssetRuntime.uploadProgress;
    const partial = progress?.created ? `已完成 ${progress.created} 张，` : "";
    showToast("图片上传失败", `${partial}${error.message || "请检查图片格式或稍后重试。"}`, "error");
  } finally {
    knowledgeAssetRuntime.uploading = false;
    knowledgeAssetRuntime.uploadProgress = null;
    if (ui.modal?.type === "uploadKnowledgeImages") renderModal();
  }
}

function imageUploadBatches(files, maximumFiles = 40, maximumBytes = 20 * 1024 * 1024) {
  const batches = [];
  let current = [];
  let currentBytes = 0;
  for (const file of files) {
    const size = Number(file.size || 0);
    if (current.length && (current.length >= maximumFiles || currentBytes + size > maximumBytes)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function remapKnowledgeBaseId(previousId, nextId, base) {
  if (!previousId || !nextId || previousId === nextId) return;
  base.id = nextId;
  (state.knowledgeItems || []).forEach((item) => { if (item.knowledgeBaseId === previousId) item.knowledgeBaseId = nextId; });
  (state.businessLines || []).forEach((line) => { line.knowledgeBaseIds = (line.knowledgeBaseIds || []).map((id) => id === previousId ? nextId : id); });
  const remap = (values) => (values || []).map((id) => id === previousId ? nextId : id);
  (state.contentPlans || []).forEach((plan) => {
    plan.knowledgeBaseIds = remap(plan.knowledgeBaseIds);
    if (plan.knowledgeScope) {
      plan.knowledgeScope.inheritedBaseIds = remap(plan.knowledgeScope.inheritedBaseIds);
      plan.knowledgeScope.addedBaseIds = remap(plan.knowledgeScope.addedBaseIds);
      plan.knowledgeScope.excludedBaseIds = remap(plan.knowledgeScope.excludedBaseIds);
      plan.knowledgeScope.resolvedBaseIds = remap(plan.knowledgeScope.resolvedBaseIds);
    }
  });
  (state.writingWorkspaces || []).forEach((workspace) => {
    workspace.selectedKnowledgeBaseIds = remap(workspace.selectedKnowledgeBaseIds);
    if (workspace.knowledgeScope) {
      workspace.knowledgeScope.inheritedBaseIds = remap(workspace.knowledgeScope.inheritedBaseIds);
      workspace.knowledgeScope.addedBaseIds = remap(workspace.knowledgeScope.addedBaseIds);
      workspace.knowledgeScope.excludedBaseIds = remap(workspace.knowledgeScope.excludedBaseIds);
      workspace.knowledgeScope.resolvedBaseIds = remap(workspace.knowledgeScope.resolvedBaseIds);
    }
  });
  (state.aiConversations || []).forEach((conversation) => { conversation.selectedKnowledgeBaseIds = remap(conversation.selectedKnowledgeBaseIds); });
}

async function ensureKnowledgeBaseOnServer(base) {
  try {
    await productionApi(`/api/v1/knowledge/libraries/${encodeURIComponent(base.id)}`);
    return base.id;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  let remoteBase = null;
  try {
    const created = await productionApi("/api/v1/knowledge/libraries", {
      method: "POST",
      body: { name: base.name, kind: base.kind, scope: base.scope, businessLineId: base.businessLineId, description: base.description || "" }
    });
    remoteBase = created.data?.library || created.library || null;
  } catch (error) {
    if (error.status !== 409) throw error;
    const listed = await productionApi("/api/v1/knowledge/libraries?includeArchived=1");
    remoteBase = (listed.data?.items || []).find((item) => String(item.name || "").toLowerCase() === String(base.name || "").toLowerCase()) || null;
  }
  if (!remoteBase?.id) throw new Error("服务端未返回知识库 ID");
  remapKnowledgeBaseId(base.id, remoteBase.id, base);
  saveState();
  return base.id;
}

async function submitKnowledgeItem(baseId) {
  const base = knowledgeBaseById(baseId);
  if (!base) return showToast("知识库不存在", "请刷新页面后重试。", "error");
  const fileInput = document.getElementById("knowledge-item-file");
  const file = base.kind === "qa" ? null : fileInput?.files?.[0] || null;
  const question = document.getElementById("knowledge-item-question")?.value.trim() || "";
  const fallbackTitle = file?.name?.replace(/\.[^.]+$/, "") || file?.name || "";
  const title = base.kind === "qa" ? question : document.getElementById("knowledge-item-title")?.value.trim() || fallbackTitle;
  const content = document.getElementById("knowledge-item-content")?.value.trim() || "";
  if (!title) return showToast("请填写资料标题", "资料标题用于后续检索和引用，不能为空。", "error");
  if (base.kind === "qa" && !content) return showToast("知识内容不完整", "请填写标准问题和企业标准答案。", "error");
  if (base.kind !== "qa" && !file && !content) return showToast("请选择文件或填写文字", "上传资料文件与直接录入文字至少完成一项。", "error");
  if (file && Number(file.size || 0) > 20 * 1024 * 1024) return showToast("文件超过大小限制", `「${file.name}」超过 20 MB，请压缩或拆分后再上传。`, "error");

  const visibility = document.getElementById("knowledge-item-visibility")?.value || "public";
  const declaredSource = document.getElementById("knowledge-item-source")?.value.trim() || "";
  const sourceName = file?.name || declaredSource || (base.kind === "qa" ? "企业标准问答" : "手动录入");
  const sourceUrl = /^https?:\/\//i.test(declaredSource) ? declaredSource : "";
  const locator = document.getElementById("knowledge-item-locator")?.value.trim() || (base.kind === "qa" ? "标准答案" : file ? "文件正文" : "正文");
  const extension = file ? String(file.name || "").split(".").pop()?.toLowerCase() || "" : "";
  const gapId = ui.modal.gapId || null;
  const submitButton = document.querySelector('[data-action="submit-knowledge-item"]');
  const originalButtonHtml = submitButton?.innerHTML || "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span data-icon="upload"></span>正在上传并解析…';
    hydrateIcons(submitButton);
  }

  try {
    await ensureKnowledgeBaseOnServer(base);
    const payload = {
      title,
      sourceType: file ? "file" : base.kind === "qa" ? "qa" : "text",
      sourceName,
      sourceUrl,
      mimeType: file?.type || "text/plain",
      content: content || undefined,
      metadata: {
        visibility,
        locator,
        declaredSource,
        uploadedFrom: "knowledge-item-modal",
        ...(file ? { extension, size: Number(file.size || 0), lastModified: Number(file.lastModified || 0) } : {})
      },
      reviewStatus: "approved"
    };
    if (file) payload.contentBase64 = arrayBufferToBase64(await file.arrayBuffer());

    const created = await productionApi(`/api/v1/knowledge/libraries/${encodeURIComponent(base.id)}/documents`, { method: "POST", body: payload });
    let remoteVersion = created.data?.version || created.version;
    if (!remoteVersion?.id || !remoteVersion.documentId) throw new Error("服务端未返回完整的知识版本信息");
    const detail = await productionApi(`/api/v1/knowledge/versions/${encodeURIComponent(remoteVersion.id)}?includeContent=1`);
    remoteVersion = detail.data?.version || detail.version || remoteVersion;

    const now = Date.now();
    const extractionStatus = String(remoteVersion.extractionStatus || "complete").toLowerCase();
    const extractionPending = ["queued", "processing", "pending"].includes(extractionStatus);
    const savedContent = remoteVersion.content || content || (file ? `文件已上传：${file.name}` : "");
    const itemId = remoteVersion.documentId;
    const versionId = remoteVersion.id;
    const item = {
      id: itemId,
      knowledgeBaseId: base.id,
      kind: base.kind,
      title,
      question: base.kind === "qa" ? question : undefined,
      category: base.kind === "qa" ? "FAQ" : file ? "上传资料" : "企业资料",
      status: "approved",
      visibility,
      latestVersionId: versionId,
      sourceName,
      sourceUrl,
      locator,
      importStatus: extractionPending ? "pending_ocr" : "ready",
      sourceFile: file ? { name: file.name, type: file.type || "application/octet-stream", size: Number(file.size || 0), extension } : undefined,
      gapId,
      tags: [],
      createdAt: now,
      updatedAt: now
    };
    const version = {
      id: versionId,
      itemId,
      version: Number(remoteVersion.version || 1),
      reviewStatus: remoteVersion.reviewStatus || "approved",
      reviewedBy: null,
      reviewedAt: remoteVersion.approvedAt || new Date().toISOString(),
      content: savedContent,
      extractionStatus: remoteVersion.extractionStatus || "complete",
      extractionMethod: remoteVersion.extractionMethod || (file ? extension || "file" : "text"),
      indexStatus: remoteVersion.indexStatus || (extractionPending ? "not_indexed" : "indexed"),
      sourceName,
      sourceUrl,
      locator,
      chunks: savedContent ? [{ id: uid("KC"), section: locator, text: savedContent }] : [],
      createdAt: remoteVersion.createdAt || now
    };
    state.knowledgeItems = (state.knowledgeItems || []).filter((entry) => entry.id !== itemId);
    state.knowledgeVersions = (state.knowledgeVersions || []).filter((entry) => entry.id !== versionId);
    state.knowledgeItems.push(item);
    state.knowledgeVersions.push(version);
    base.itemIds = [...new Set([...(base.itemIds || []), itemId])];
    base.status = "ready";
    base.updatedAt = now;
    if (file) await refreshKnowledgeAssetsFromServer().catch(() => {});
    addOperationLog("企业知识", `${file ? "上传资料" : "新增知识"}「${title}」到知识库「${base.name}」`);
    saveState();
    render();
    ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
    renderModal();
    showToast(extractionPending ? "资料已上传，后台处理中" : "资料已上传并自动索引", extractionPending ? "原文件已经保存；解析或 OCR 完成后会自动进入 RAG，无需人工审核。" : file ? "文件已进入知识库；PDF 中提取的图片也会进入图片资料库。" : "知识内容已经进入正式数据库和 RAG 检索。", extractionPending ? "warning" : "success");
  } catch (error) {
    showToast("资料入库失败", error.message || "请检查文件格式、登录状态或稍后重试。", "error");
  } finally {
    if (submitButton?.isConnected) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      hydrateIcons(submitButton);
    }
  }
}

async function updateKnowledgeItem(itemId) {
  const item = knowledgeItemById(itemId);
  const base = item && knowledgeBaseById(item.knowledgeBaseId);
  const current = item && knowledgeVersionById(item.latestVersionId);
  if (!item || !base || !current) return showToast("知识条目不存在", "请刷新后重试。", "error");
  const question = document.getElementById("knowledge-item-question")?.value.trim() || "";
  const title = base.kind === "qa" ? question : document.getElementById("knowledge-item-title")?.value.trim() || "";
  const content = document.getElementById("knowledge-item-content")?.value.trim() || "";
  if (!title || !content) return showToast("知识内容不完整", "请填写标题（或标准问题）和正文后再保存。", "error");
  const sourceName = document.getElementById("knowledge-item-source")?.value.trim() || knowledgeSourceLabel(item, current);
  const locator = document.getElementById("knowledge-item-locator")?.value.trim() || knowledgeLocator(item, current);
  const visibility = document.getElementById("knowledge-item-visibility")?.value || item.visibility || "public";
  const saveButton = document.querySelector('[data-action="save-knowledge-item-edit"]');
  const originalButtonHtml = saveButton?.innerHTML || "";
  if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<span data-icon="upload"></span>正在保存并更新索引…'; hydrateIcons(saveButton); }
  let remoteVersion;
  try {
    const response = await productionApi(`/api/v1/knowledge/documents/${encodeURIComponent(item.id)}`, {
      method: "POST",
      body: { title, content, sourceName, mimeType: "text/plain", metadata: { ...(current.metadata || {}), visibility, locator, editedFrom: current.id } }
    });
    remoteVersion = response.data?.version || response.version;
    if (!remoteVersion?.id || remoteVersion.documentId !== item.id || remoteVersion.indexStatus !== "indexed") {
      throw new Error(remoteVersion?.indexStatus === "failed" ? "新版本索引失败，请检查向量模型或索引任务。" : "服务端未返回已完成索引的新版本。");
    }
  } catch (error) {
    showToast("知识新版本保存失败", `${error.message || "服务端同步失败"} 本地内容没有被标记为保存成功。`, "error");
    return;
  } finally {
    if (saveButton?.isConnected) { saveButton.disabled = false; saveButton.innerHTML = originalButtonHtml; hydrateIcons(saveButton); }
  }
  const nextNumber = Number(remoteVersion.version || current.version || 0);
  const versionId = remoteVersion.id;
  const next = {
    id: versionId,
    itemId: item.id,
    version: nextNumber,
    reviewStatus: "approved",
    reviewedBy: null,
    reviewedAt: new Date().toISOString(),
    content,
    sourceName,
    locator,
    chunks: [{ id: uid("KC"), section: locator, text: content }],
    createdAt: Date.now(),
    supersedesVersionId: current.id
  };
  state.knowledgeVersions.push(next);
  item.title = title;
  if (base.kind === "qa") item.question = question;
  item.sourceName = sourceName;
  item.locator = locator;
  item.visibility = visibility;
  item.latestVersionId = versionId;
  item.status = "approved";
  if (item.importStatus === "pending_parse") item.importStatus = "ready";
  item.updatedAt = Date.now();
  base.status = "ready";
  base.updatedAt = Date.now();
  saveState();
  ui.modal = { type: "knowledgeBaseDetail", baseId: base.id };
  render();
  renderModal();
  showToast("知识新版本已保存", `${title} 已创建 v${nextNumber}，后台会自动更新检索索引，历史文章仍保留原版本。`);
}

async function approveKnowledgeItem(itemId) {
  const item = knowledgeItemById(itemId);
  const version = item && knowledgeVersionById(item.latestVersionId);
  if (!item || !version) return showToast("知识版本不存在", "请刷新后重试。", "error");
  // Kept only for old browser state that may still dispatch the historical
  // action. New knowledge versions are activated automatically on save.
  item.status = "approved";
  item.updatedAt = Date.now();
  version.reviewStatus = "approved";
  version.reviewedBy = null;
  version.reviewedAt = version.reviewedAt || new Date().toISOString();
  const base = knowledgeBaseById(item.knowledgeBaseId);
  if (base) { base.status = "ready"; base.updatedAt = Date.now(); }
  if (item.gapId) {
    const gap = state.knowledgeGaps.find((entry) => entry.id === item.gapId);
    if (gap) { gap.status = "resolved"; gap.resolvedByItemId = item.id; }
  }
  saveState();
  render();
  if (ui.modal?.type === "knowledgeBaseDetail") renderModal();
  showToast("知识已可用", "v" + version.version + " 已进入 RAG 检索；知识资料上传即入库，不需要人工审核。");
}

async function saveKnowledgePackage(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId);
  if (!line) return showToast("业务线不存在", "请刷新后重试。", "error");
  line.knowledgeBaseIds = Array.from(document.querySelectorAll("[data-package-base]:checked")).map((input) => input.value);
  saveState();
  try {
    await flushWorkspaceSyncNow("knowledge-package-explicit-save");
  } catch (error) {
    showToast("默认知识包保存失败", `${error.message || "服务端同步失败"} 本次修改没有被提示为成功。`, "error");
    return;
  }
  closeModal();
  render();
  showToast("默认知识包已保存", "以后新建的「" + line.name + "」内容计划会继承这些知识库；历史计划保持不变。");
}

function openGenerationPreview(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  ui.modal = { type: "generationPreview", planId };
  renderModal();
}

function upgradePlanWritingAgent(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  if (plan.status === "produced") return showToast("文章已经生成", "已生成计划必须保留原智能体快照；请在文章中创建新版本。", "error");
  const current = writingAgentById(plan.writingAgentSnapshot?.agentId || plan.writingAgentId);
  if (!current || !writingAgentSupports(current, plan.businessLineId, plan.contentType)) return showToast("智能体不可用", "请恢复智能体或重新创建内容计划。", "error");
  if (Number(current.version) <= Number(plan.writingAgentSnapshot?.version || 0)) return showToast("已经是最新版本", "当前计划无需升级。", "error");
  plan.writingAgentId = current.id;
  plan.writingAgentVersion = current.version;
  plan.writingAgentSnapshot = snapshotWritingAgent(current, { selectionSource: "manual_upgrade" });
  saveState();
  render();
  ui.modal = { type: "generationPreview", planId };
  renderModal();
  showToast("计划已升级智能体", "已显式更新到「" + current.name + "」v" + current.version + "，知识范围保持不变。");
}

function saveWritingAgent(agentId) {
  const existing = writingAgentById(agentId);
  if (existing?.builtIn) return showToast("内置智能体不可直接修改", "请先复制为企业自建智能体。", "error");
  const nameInput = document.getElementById("writing-agent-name");
  const promptInput = document.getElementById("writing-agent-prompt");
  const name = nameInput?.value.trim() || "";
  const description = document.getElementById("writing-agent-description")?.value.trim() || "";
  const systemPrompt = promptInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("智能体名称不能为空", "请填写一个便于运营人员识别的名称。", "error");
  }
  if (!description) return showToast("请填写智能体用途", "一句话说明它最适合创作什么内容。", "error");
  if (!systemPrompt) {
    promptInput?.classList.add("input-error");
    promptInput?.focus();
    return showToast("高级提示词不能为空", "请描述智能体的核心写作要求。", "error");
  }
  if ((state.writingAgents || []).some((agent) => agent.id !== agentId && agent.name.toLowerCase() === name.toLowerCase())) return showToast("智能体名称已存在", "请使用更容易区分的名称。", "error");
  const contentTypes = Array.from(document.querySelectorAll("[data-agent-content-type]:checked")).map((input) => input.value);
  if (!contentTypes.length) return showToast("请选择内容形式", "智能体至少需要适用于一种内容形式。", "error");
  const minWords = Number(document.getElementById("writing-agent-min-words")?.value || 1000);
  const maxWords = Number(document.getElementById("writing-agent-max-words")?.value || 1800);
  if (minWords < 300 || maxWords < minWords) return showToast("目标字数不合理", "最多字数必须大于等于最少字数，且最少不少于 300 字。", "error");
  const payload = {
    name,
    description,
    avatar: document.getElementById("writing-agent-avatar")?.value.trim().slice(0, 1) || name.slice(0, 1),
    role: document.getElementById("writing-agent-role")?.value.trim() || "企业内容编辑",
    audience: document.getElementById("writing-agent-audience")?.value.trim() || "企业客户",
    tone: document.getElementById("writing-agent-tone")?.value.trim() || "专业、清晰",
    style: document.getElementById("writing-agent-style")?.value.trim() || "结论清晰 · 证据优先",
    template: document.getElementById("writing-agent-template")?.value || "deep",
    structure: (document.getElementById("writing-agent-structure")?.value || "").split(/[、，,\n]/).map((item) => item.trim()).filter(Boolean),
    required: document.getElementById("writing-agent-required")?.value.trim() || "",
    banned: document.getElementById("writing-agent-banned")?.value.trim() || "",
    cta: document.getElementById("writing-agent-cta")?.value.trim() || "",
    systemPrompt,
    businessLineIds: Array.from(document.querySelectorAll("[data-agent-line]:checked")).map((input) => input.value),
    contentTypes,
    strictKnowledge: Boolean(document.getElementById("writing-agent-strict")?.checked),
    citationsRequired: Boolean(document.getElementById("writing-agent-citations")?.checked),
    missingEvidenceAction: document.getElementById("writing-agent-missing")?.value || "omit",
    preferredKnowledgeBaseIds: Array.from(document.querySelectorAll("[data-agent-knowledge]:checked")).map((input) => input.value),
    modelMode: "inherit",
    creativity: Math.min(1, Math.max(0, Number(document.getElementById("writing-agent-creativity")?.value || 0.35))),
    minWords,
    maxWords
  };
  const trackedKeys = Object.keys(payload);
  if (existing) {
    const before = JSON.stringify(Object.fromEntries(trackedKeys.map((key) => [key, existing[key]])));
    const after = JSON.stringify(payload);
    if (before === after) {
      closeModal();
      return showToast("配置没有变化", "智能体仍保持 v" + existing.version + "，未创建无意义的新版本。");
    }
    existing.changeLog = Array.isArray(existing.changeLog) ? existing.changeLog : [];
    existing.changeLog.unshift(createWritingAgentSnapshot(existing, { modelName: state.settings.model, selectedBy: currentUserName() || "系统管理员", selectionSource: "version_history" }));
    Object.assign(existing, payload, { version: (Number(existing.version) || 1) + 1, updatedAt: Date.now() });
    saveState();
    closeModal();
    render();
    return showToast("智能体已更新", "「" + existing.name + "」已发布 v" + existing.version + "；历史计划和文章继续使用旧快照。");
  }
  const colors = ["blue", "teal", "amber", "violet", "rose"];
  const agent = { id: uid("WA"), ...payload, color: colors[(state.writingAgents || []).length % colors.length], builtIn: false, status: "active", version: 1, usageCount: 0, changeLog: [], createdBy: currentUserName() || "系统管理员", createdAt: Date.now(), updatedAt: Date.now() };
  state.writingAgents.unshift(agent);
  saveState();
  closeModal();
  ui.contentView = "agents";
  render();
  showToast("写作智能体已创建", "「" + agent.name + "」v1 已可在内容计划和文章工作台中选择。");
}

function toggleWritingAgent(agentId) {
  const agent = writingAgentById(agentId);
  if (!agent || agent.builtIn) return showToast("系统智能体不可停用", "系统模板用于保证至少有一项基础写作能力。", "error");
  if (agent.status === "active") {
    const defaultLines = state.businessLines.filter((line) => line.status === "active" && line.defaultWritingAgentId === agent.id);
    if (defaultLines.length) return showToast("不能停用默认智能体", "请先为「" + defaultLines.map((line) => line.name).join("、") + "」设置其他默认智能体。", "error");
    agent.status = "inactive";
    agent.archivedAt = Date.now();
  } else {
    agent.status = "active";
    delete agent.archivedAt;
  }
  agent.updatedAt = Date.now();
  saveState();
  render();
  showToast(agent.status === "active" ? "智能体已恢复" : "智能体已停用", agent.status === "active" ? "现在可以用于新的内容计划和文章修订。" : "新的内容不能再选择它，历史计划和文章快照仍完整保留。");
}

function setDefaultWritingAgent(agentId) {
  const line = activeBusinessLine();
  const agent = writingAgentById(agentId);
  if (!line || !writingAgentSupports(agent, line.id)) return showToast("智能体不适用于当前业务线", "请先编辑适用范围或选择其他智能体。", "error");
  line.defaultWritingAgentId = agent.id;
  saveState();
  render();
  showToast("业务线默认智能体已更新", "「" + line.name + "」以后新建计划默认选择「" + agent.name + "」；历史计划保持不变。");
}

function deleteBusinessLine(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  const activeLines = state.businessLines.filter((item) => item.status === "active");
  if (!line) return showToast("业务线不存在", "请刷新页面后重试。", "error");
  if (activeLines.length <= 1) return showToast("不能删除最后一条业务线", "系统必须至少保留一条可运营业务线。", "error");
  const impact = businessLineImpact(lineId);
  const isEmpty = impact.total === 0;
  state.questionLibrary.filter((item) => item.businessLineId === lineId).forEach((item) => { item.selected = false; });
  state.topics.filter((topic) => topicBusinessLineId(topic) === lineId).forEach((topic) => { topic.selected = false; });
  if (isEmpty) {
    state.businessLines = state.businessLines.filter((item) => item.id !== lineId);
  } else {
    line.status = "archived";
    line.archivedAt = Date.now();
    (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.scope !== "enterprise").forEach((base) => {
      base.statusBeforeArchive = base.status;
      base.status = "archived";
      base.archivedAt = Date.now();
    });
    (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId && !["resolved", "archived"].includes(gap.status)).forEach((gap) => {
      gap.statusBeforeArchive = gap.status;
      gap.status = "archived";
    });
    (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line.name).forEach((task) => { task.archivedAt = Date.now(); });
  }
  const nextLine = state.businessLines.find((item) => item.status === "active");
  ui.selectedBusinessLineId = nextLine?.id || null;
  ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === nextLine?.id)?.id || null;
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  ui.planningCategory = "all";
  saveState();
  render();
  ui.modal = { type: "businessLineManager" };
  renderModal();
  showToast("业务线已删除", isEmpty ? "空业务线已永久删除。" : "已从日常运营入口移除，历史文章与证据关系继续保留，可随时恢复。");
}

function restoreBusinessLine(lineId) {
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "archived");
  if (!line) return showToast("未找到已删除业务线", "请刷新页面后重试。", "error");
  line.status = "active";
  delete line.archivedAt;
  (state.knowledgeBases || []).filter((base) => base.businessLineId === lineId && base.status === "archived").forEach((base) => {
    base.status = base.statusBeforeArchive || "ready";
    delete base.statusBeforeArchive;
    delete base.archivedAt;
  });
  (state.knowledgeGaps || []).filter((gap) => gap.businessLineId === lineId && gap.status === "archived").forEach((gap) => {
    gap.status = gap.statusBeforeArchive || "open";
    delete gap.statusBeforeArchive;
  });
  (state.monitoring?.tasks || []).filter((task) => task.businessLineId === lineId || task.business === line.name).forEach((task) => { delete task.archivedAt; });
  ui.selectedBusinessLineId = line.id;
  ui.selectedPackId = state.keywordPacks.find((pack) => pack.businessLineId === line.id)?.id || null;
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  saveState();
  render();
  ui.modal = { type: "businessLineManager" };
  renderModal();
  showToast("业务线已恢复", "「" + line.name + "」及其知识库、选题和内容计划已重新进入日常运营入口。");
}

function submitBusinessLine() {
  const nameInput = document.getElementById("business-line-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("业务线名称不能为空", "请输入产品或业务线名称。", "error");
  }
  if (state.businessLines.some((line) => line.name.toLowerCase() === name.toLowerCase())) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("业务线已存在", "请使用其他名称，或回到现有业务线继续添加关键词。", "error");
  }
  const editing = state.businessLines.find((lineItem) => lineItem.id === ui.modal.businessLineId);
  if (editing) {
    editing.name = name;
    editing.product = document.getElementById("business-line-product")?.value.trim() || editing.product;
    editing.audience = document.getElementById("business-line-audience")?.value.trim() || editing.audience;
    editing.scenario = document.getElementById("business-line-scenario")?.value.trim() || editing.scenario;
    editing.updatedAt = Date.now();
    saveState();
    closeModal();
    render();
    return showToast("业务线已更新", "名称、产品或客户信息已同步。", "success");
  }
  const line = { id: uid("BL"), name, product: document.getElementById("business-line-product")?.value.trim() || name, audience: document.getElementById("business-line-audience")?.value.trim() || "待补充目标客户", scenario: document.getElementById("business-line-scenario")?.value.trim() || "待补充核心场景", status: "active", knowledgeBaseIds: [], defaultWritingAgentId: state.settings.defaultWritingAgentId, createdAt: Date.now() };
  state.businessLines.push(line);
  ui.selectedBusinessLineId = line.id;
  ui.selectedPackId = null;
  ui.planningTab = "keywords";
  ui.businessKeywordInput = "";
  ui.selectedCoreKeywordIds = [];
  ui.seedInput = "";
  saveState();
  closeModal();
  render();
  showToast("业务线已创建", "现在可以为「" + line.name + "」添加关键词。");
  window.setTimeout(() => document.getElementById("business-keyword-input")?.focus(), 30);
}

function archivePlanningQuestion(questionId) {
  const question = state.questionLibrary.find((item) => item.id === questionId);
  if (!question || question.status === "archived") return;
  question.archivedFromStatus = question.status || "active";
  question.status = "archived";
  question.archivedAt = Date.now();
  question.archivedBy = currentUserName() || "系统管理员";
  question.archivedReason = "运营人员归档";
  question.selected = false;
  saveState();
  render();
  showToast("问题已归档", "历史选题、计划和文章仍然保留，可在归档管理中恢复。");
}

function archivePlanningTopic(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status === "archived") return;
  topic.archivedFromStatus = topic.status || "active";
  topic.status = "archived";
  topic.archivedAt = Date.now();
  topic.archivedBy = currentUserName() || "系统管理员";
  topic.archivedReason = "运营人员归档";
  topic.selected = false;
  saveState();
  render();
  showToast("选题已归档", "不会影响已经创建的内容计划和历史文章。");
}

function restorePlanningRecord(kind, recordId) {
  const record = kind === "topic" ? state.topics.find((item) => item.id === recordId) : state.questionLibrary.find((item) => item.id === recordId);
  if (!record || record.status !== "archived") return;
  const recordName = String(kind === "topic" ? record.title : record.question || "").trim().toLowerCase();
  const duplicate = kind === "topic"
    ? state.topics.some((item) => item.id !== record.id && item.status !== "archived" && topicBusinessLineId(item) === topicBusinessLineId(record) && String(item.title || "").trim().toLowerCase() === recordName)
    : state.questionLibrary.some((item) => item.id !== record.id && item.status !== "archived" && item.businessLineId === record.businessLineId && String(item.question || "").trim().toLowerCase() === recordName);
  if (duplicate) return showToast(kind === "topic" ? "无法恢复选题" : "无法恢复问题", "当前业务线中已存在同名的活跃记录，请先编辑或归档同名记录后再恢复。", "error");
  const restoredStatus = record.archivedFromStatus && record.archivedFromStatus !== "archived" ? record.archivedFromStatus : "active";
  record.status = kind === "topic" && restoredStatus === "candidate" ? "active" : restoredStatus;
  delete record.archivedFromStatus;
  delete record.archivedAt;
  delete record.archivedBy;
  delete record.archivedReason;
  record.updatedAt = Date.now();
  saveState();
  render();
  showToast(kind === "topic" ? "选题已恢复" : "问题已恢复", "已重新回到当前业务线的日常运营列表。");
}

function submitQuestionEdit() {
  const question = state.questionLibrary.find((item) => item.id === ui.modal?.questionId);
  if (!question) return;
  const text = document.getElementById("planning-question-text")?.value.trim() || "";
  const sourceKeyword = document.getElementById("planning-question-source")?.value.trim() || "";
  const coverage = document.getElementById("planning-question-coverage")?.value || "未覆盖";
  if (!text) return showToast("问题不能为空", "请填写客户真正会提出的问题。", "error");
  const duplicate = state.questionLibrary.some((item) => item.id !== question.id && item.businessLineId === question.businessLineId && item.status !== "archived" && item.question.trim().toLowerCase() === text.toLowerCase());
  if (duplicate) return showToast("问题已经存在", "当前业务线中已有相同问题，请修改后再保存。", "error");
  question.revisions = Array.isArray(question.revisions) ? question.revisions : [];
  question.revisions.unshift({ version: question.version || 1, question: question.question, sourceKeyword: question.sourceKeyword, dimension: question.dimension, intent: question.intent, stage: question.stage, coverage: question.coverage, updatedAt: question.updatedAt || question.createdAt || Date.now() });
  question.question = text;
  question.sourceKeyword = sourceKeyword;
  question.coverage = coverage;
  question.geoIntent = buildGeoQuestionIntent(question);
  question.version = Number(question.version || 1) + 1;
  question.updatedAt = Date.now();
  const refs = planningQuestionReferences(question);
  saveState();
  closeModal();
  render();
  showToast("问题已更新", refs.topics.length ? `已创建 v${question.version}；${refs.topics.length} 个选题仍保留原内容快照。` : `已保存问题 v${question.version}。`);
}

function submitTopicEdit() {
  const topic = state.topics.find((item) => item.id === ui.modal?.topicId);
  if (!topic) return;
  const title = document.getElementById("planning-topic-title")?.value.trim() || "";
  const coreQuestion = document.getElementById("planning-topic-core-question")?.value.trim() || "";
  const keyword = topic.keyword || "";
  const dimension = document.getElementById("planning-topic-dimension")?.value || "question";
  const intent = document.getElementById("planning-topic-intent")?.value.trim() || "待判断";
  const recommendation = Math.max(0, Math.min(100, Number(topic.recommendation ?? 80)));
  const coverage = topic.coverage || "未覆盖";
  const reason = topic.reason || "";
  if (!title) return showToast("选题标题不能为空", "请填写文章需要回答的具体方向。", "error");
  if (!coreQuestion) return showToast("核心回答问题不能为空", "请填写文章最终必须直接回答的问题。", "error");
  const duplicate = state.topics.some((item) => item.id !== topic.id && item.status !== "archived" && topicBusinessLineId(item) === topicBusinessLineId(topic) && item.title.trim().toLowerCase() === title.toLowerCase());
  if (duplicate) return showToast("选题已经存在", "当前业务线中已有相同选题，请修改后再保存。", "error");
  topic.revisions = Array.isArray(topic.revisions) ? topic.revisions : [];
  topic.revisions.unshift({ version: topic.version || 1, title: topic.title, coreQuestion: topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title, keyword: topic.keyword, dimension: topic.dimension, intent: topic.intent, recommendation: topic.recommendation, coverage: topic.coverage, reason: topic.reason, updatedAt: topic.updatedAt || topic.createdAt || Date.now() });
  topic.title = title;
  topic.coreQuestion = coreQuestion;
  topic.keyword = keyword;
  topic.dimension = dimension;
  topic.intent = intent;
  topic.recommendation = recommendation;
  topic.coverage = coverage;
  topic.reason = reason;
  topic.geoIntent = buildGeoQuestionIntent({ ...topic, question: coreQuestion, sourceKeyword: topic.keyword });
  topic.geoBrief = { ...buildGeoTopicBrief(topic, topic.questionSnapshot), coreQuestion, title };
  topic.version = Number(topic.version || 1) + 1;
  topic.updatedAt = Date.now();
  const refs = planningTopicReferences(topic);
  saveState();
  closeModal();
  render();
  showToast("选题已更新", refs.plans.length || refs.articles.length ? `已创建 v${topic.version}；历史计划和文章继续使用原选题版本。` : `已保存选题 v${topic.version}。`);
}

function permanentlyDeletePlanningRecord(kind, recordId) {
  const list = kind === "topic" ? state.topics : state.questionLibrary;
  const record = list.find((item) => item.id === recordId);
  if (!record || record.status !== "archived") return showToast("只能删除归档记录", "请先将问题或选题归档，再执行永久删除。", "error");
  const refs = kind === "topic" ? planningTopicReferences(record) : planningQuestionReferences(record);
  const canDelete = kind === "topic" ? !refs.plans.length && !refs.articles.length : !record.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length;
  if (!canDelete) return showToast("仍有下游引用", "该记录只能继续归档，不能永久删除。", "error");
  const index = list.findIndex((item) => item.id === recordId);
  if (index >= 0) list.splice(index, 1);
  if (kind === "topic") state.questionLibrary.filter((question) => question.topicId === recordId).forEach((question) => { question.topicId = null; });
  saveState();
  closeModal();
  render();
  showToast(kind === "topic" ? "选题已永久删除" : "问题已永久删除", "这条记录没有任何下游引用，已从当前客户空间移除。");
}

function openContentPlan() {
  const line = activeBusinessLine();
  const selected = state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  if (!selected.length) return showToast("还没有选择选题", "请先在选题库勾选至少一个选题。", "error");
  ui.planError = "";
  ui.modal = { type: "contentPlan" };
  renderModal();
}

function openTopicDirectStudio(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active") return showToast("选题不可用", "该选题可能已归档，请刷新选题库后重试。", "error");
  const existingArticle = planningTopicArticles(topic)[0];
  if (existingArticle) {
    ui.contentView = "studio";
    return openContentStudio(existingArticle.id);
  }
  if (planningTopicPlans(topic).length) return showToast("选题已进入计划", "请到内容计划中创建或查看文章任务。", "error");
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "这个选题关联的产品 / 业务线已停用。", "error");
  ui.selectedBusinessLineId = line.id;
  const workspace = ensureStudioWorkspace(null, true);
  const conversation = studioConversationForWorkspace(workspace);
  const question = planningTopicReferences(topic).question;
  const coreQuestion = topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title;
  const contentType = "深度文章";
  const inheritedBaseIds = inheritedKnowledgeBaseIds(line);
  const agent = defaultAgentForLine(line, contentType);
  const now = Date.now();
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: "topic_direct" });
  workspace.sourceType = "topic_direct";
  workspace.sourceTopicId = topic.id;
  workspace.sourceTopicSnapshot = cloneData(topic);
  workspace.sourceQuestionSnapshot = cloneData(question);
  workspace.businessLineId = line.id;
  workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
  workspace.topic = { ...cloneData(topic), source: "topic_library", geoBrief: cloneData(topic.geoBrief || buildGeoTopicBrief(topic, question)), prompt: [topic.title, coreQuestion !== topic.title ? "核心回答问题：" + coreQuestion : "", topic.intent ? "用户意图：" + topic.intent : "", topic.geoBrief?.answerMode ? "回答方式：" + topic.geoBrief.answerMode : ""].filter(Boolean).join("\n") };
  workspace.draftTitle = topic.title;
  workspace.draftContent = "";
  workspace.draftContentHtml = "";
  workspace.contentType = contentType;
  workspace.knowledgeScope = { inheritedBaseIds: cloneData(inheritedBaseIds), addedBaseIds: [], excludedBaseIds: [], resolvedBaseIds: cloneData(inheritedBaseIds), snapshottedAt: new Date(now).toISOString(), lockedVersionIds: [] };
  workspace.selectedKnowledgeBaseIds = cloneData(inheritedBaseIds);
  workspace.selectedKnowledgeItemIds = [];
  workspace.writingAgentId = agent?.id || null;
  workspace.writingAgentSnapshot = agentSnapshot;
  workspace.updatedAt = now;
  if (conversation) {
    conversation.articleId = null;
    conversation.selectedAgentId = agent?.id || null;
    conversation.selectedKnowledgeBaseIds = cloneData(inheritedBaseIds);
    conversation.selectedKnowledgeItemIds = [];
    conversation.webSearchEnabled = false;
    conversation.messages = [{ id: uid("MSG"), role: "assistant", text: `已带入选题「${topic.title}」。正在核对企业知识并生成文章初稿，完成后可继续调整结构、语气或受众。`, createdAt: now, agentSnapshot, contextSnapshot: { businessLineId: line.id, sourceTopicId: topic.id, knowledgeBaseIds: cloneData(inheritedBaseIds), webSearchEnabled: false } }];
    conversation.updatedAt = now;
  }
  ui.studioWorkspaceId = workspace.id;
  ui.studioArticleId = null;
  ui.studioTopicDraft = topic.title;
  ui.studioContentType = contentType;
  ui.studioAgentId = agent?.id || null;
  ui.studioWebSearch = false;
  ui.studioPicker = null;
  ui.studioComposerDraft = "";
  ui.contentView = "studio";
  ui.studioPane = "editor";
  saveState();
  closeModal();
  navigate("content");
  window.setTimeout(async () => {
    const instruction = `请基于选题「${topic.title}」和企业知识生成文章初稿。核心回答问题：${coreQuestion}`;
    const generated = await generateStudioArticle(instruction, { autoStart: true });
    if (!generated && !studioArticleForWorkspace(workspace)) {
      ui.studioComposerDraft = instruction;
      saveState();
      render();
      document.getElementById("studio-composer-input")?.focus();
    }
  }, 40);
}

function openTopicPlanPicker(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active") return showToast("选题不可用", "该选题可能已归档，请刷新选题库后重试。", "error");
  if (planningTopicPlans(topic).length) return showToast("选题已进入计划", "该选题已经在内容计划中，可前往内容计划查看。", "error");
  const article = planningTopicArticles(topic)[0];
  if (article) {
    ui.contentView = "studio";
    openContentStudio(article.id);
    return showToast("该选题已生成文章", "为避免重复创建，已为你打开现有文章。", "success");
  }
  ui.modal = { type: "topicPlanPicker", topicId: topic.id, planId: null };
  renderModal();
}

function createPlanFromTopicPicker(topicId) {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic || topic.status !== "active" || planningTopicPlans(topic).length) return showToast("选题不可用", "该选题可能已归档或已加入计划，请刷新选题库后重试。", "error");
  const lineId = topicBusinessLineId(topic);
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "这个选题关联的产品 / 业务线已停用。", "error");
  ui.selectedBusinessLineId = line.id;
  state.topics.filter((item) => topicBusinessLineId(item) === line.id).forEach((item) => { item.selected = item.id === topic.id; });
  saveState();
  closeModal();
  openContentPlan();
}

async function submitTopicPlanPicker() {
  const topic = state.topics.find((item) => item.id === ui.modal?.topicId);
  const planId = document.querySelector('input[name="topic-plan-id"]:checked')?.value || "";
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!topic || topic.status !== "active") return showToast("选题不可用", "该选题可能已归档，请刷新选题库后重试。", "error");
  if (!planId) return showToast("请选择内容计划", "选择一个已有计划，或为这个选题新建计划。", "error");
  if (!plan || plan.businessLineId !== topicBusinessLineId(topic)) return showToast("内容计划不可用", "只能加入当前产品 / 业务线的内容计划。", "error");
  const status = plan.status || (contentPlanArticles(plan).length ? "produced" : "planned");
  if (!["draft", "planned"].includes(status)) return showToast("计划不可追加选题", "已生成内容或已完成的计划不能继续加入选题。", "error");
  if (planningTopicPlans(topic).length || contentPlanTopicIds(plan).includes(topic.id)) return showToast("选题已进入计划", "请刷新页面后查看最新计划。", "error");
  const now = Date.now();
  const nextPlan = {
    ...cloneData(plan),
    topicIds: [...new Set([...contentPlanTopicIds(plan), topic.id])],
    topicSnapshots: [...(Array.isArray(plan.topicSnapshots) ? plan.topicSnapshots : []).filter((item) => item?.id !== topic.id).map((item) => cloneData(item)), cloneData(topic)],
    updatedAt: now
  };
  try {
    await syncContentPlan(nextPlan);
  } catch (error) {
    return showToast("加入内容计划失败", error.message || "正式内容计划没有保存，本次操作已取消。", "error");
  }
  Object.assign(plan, nextPlan);
  topic.selected = false;
  topic.coverage = "已规划";
  topic.updatedAt = now;
  saveState();
  closeModal();
  render();
  showToast("已加入内容计划", `「${topic.title}」已加入「${plan.name}」，可继续创建文章任务。`);
}

async function submitContentPlan() {
  const line = activeBusinessLine();
  const selected = state.topics.filter((topic) => topicBusinessLineId(topic) === line.id && topic.status === "active" && !planningTopicPlans(topic).length && topic.selected);
  const nameInput = document.getElementById("content-plan-name");
  const name = nameInput?.value.trim() || "";
  if (!name) {
    nameInput?.classList.add("input-error");
    nameInput?.focus();
    return showToast("计划名称不能为空", "请输入内容计划名称。", "error");
  }
  if (!selected.length) return showToast("没有可用选题", "返回选题库重新选择。", "error");
  const date = document.getElementById("content-plan-date")?.value || "";
  if (!date) return showToast("请选择计划日期", "内容计划需要明确预计完成日期。", "error");
  if (date < localDateInputValue()) return showToast("计划日期不能早于今天", "请选择今天或之后的预计完成日期。", "error");
  const contentType = document.getElementById("content-plan-type")?.value || "深度文章";
  const agentId = document.getElementById("content-plan-agent")?.value || "";
  const agent = writingAgentById(agentId);
  if (!agent || !writingAgentSupports(agent, line.id, contentType)) return showToast("写作智能体不可用", "请选择一个已启用、适用于当前业务线和内容形式的智能体。", "error");
  const expectedPlatformIds = Array.from(document.querySelectorAll("[data-plan-style-platform]:checked")).map((item) => item.value).filter((id) => PLATFORM_META[id]);
  const expectedPlatformNames = Object.fromEntries(expectedPlatformIds.map((id) => [id, publishPlatformName(id)]));
  const expectedPlatformGuidance = Object.fromEntries(expectedPlatformIds.map((id) => [id, PLATFORM_STYLE_HINTS[id]]));
  const inheritedBaseIds = inheritedKnowledgeBaseIds(line);
  const resolvedBaseIds = Array.from(document.querySelectorAll("[data-plan-knowledge]:checked")).map((item) => item.value);
  if (!resolvedBaseIds.length) return showToast("请保留至少一个知识库", "内容任务必须有可追溯的企业知识来源。", "error");
  const addedBaseIds = resolvedBaseIds.filter((id) => !inheritedBaseIds.includes(id));
  const excludedBaseIds = inheritedBaseIds.filter((id) => !resolvedBaseIds.includes(id));
  const now = Date.now();
  const agentSnapshot = snapshotWritingAgent(agent, { selectedAt: new Date(now).toISOString(), selectionSource: agent.id === line.defaultWritingAgentId ? "business_default" : "manual" });
  const plan = { id: uid("PLAN"), name, businessLineId: line.id, topicIds: selected.map((topic) => topic.id), topicSnapshots: selected.map((topic) => cloneData(topic)), scheduledFor: date, owner: document.getElementById("content-plan-owner")?.value || currentUserName() || "系统管理员", contentType, status: "planned", articleIds: [], writingAgentId: agent.id, writingAgentVersion: agentSnapshot.version, writingAgentSnapshot: agentSnapshot, writingHints: { expectedPlatformIds, expectedPlatformNames, expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false, snapshottedAt: now }, knowledgeBaseIds: resolvedBaseIds, knowledgeScope: { inheritedBaseIds, addedBaseIds, excludedBaseIds, resolvedBaseIds, snapshottedAt: now }, createdAt: now, updatedAt: now };
  try {
    await syncContentPlan(plan);
  } catch (error) {
    plan.contentPlanSyncError = error.message || "正式内容计划保存失败";
    return showToast("内容计划创建失败", plan.contentPlanSyncError, "error");
  }
  state.contentPlans.unshift(plan);
  selected.forEach((topic) => { topic.selected = false; topic.coverage = "已规划"; });
  ui.planningTab = "plans";
  saveState();
  closeModal();
  render();
  showToast("内容计划已创建", "已安排 " + plan.topicIds.length + " 个选题，并冻结「" + agent.name + "」v" + agent.version + " 与 " + resolvedBaseIds.length + " 个知识库的使用范围。");
}

function citationMarkerHtml(citation) {
  return ` <button class="citation-marker" type="button" contenteditable="false" data-action="open-citation" data-citation-id="${citation.id}" title="查看 ${citation.marker} 引用证据">[${citation.marker}]</button>`;
}

// 旧版演示正文仅用于兼容历史文章快照；新生成统一走下方 GEO 证据页契约。


function buildKnowledgeArticleContent(topic, citations, agentSnapshot = null, options = {}) {
  const brief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  const dimension = topic.dimension || topic.questionSnapshot?.dimension || "question";
  const fallbackAnswer = {
    semantic: "先把概念、目标对象和适用边界分开说明，再与相近概念进行对比；不要只用一个缩写或关键词代替完整定义。",
    scenario: "是否适合不能只看行业名称，应先核对目标客户、使用场景、资料完整度和执行条件，再决定从哪个场景切入。",
    commercial: "评估服务时应先核验服务范围、交付流程、验收证据和双方责任，再比较报价或承诺；没有公开依据的结果不应直接采信。",
    ranking: "不宜直接给出脱离条件的‘最好’名单，应先建立比较维度，逐项核验能力、案例、来源和适用边界，再形成分层选择。",
    review: "应把资产质量和 AI 表现分开评估，结合提及、推荐、官网引用、引用准确度和转化等有效样本持续复盘，而不是只看一次曝光。",
    brand: "应先确认企业主体、服务能力、适用客户和公开信源是否一致，再用可核验资料回答品牌能力，不用口号替代证据。",
    question: "建议从已审核的企业事实开始，先定义问题和目标读者，再按实施步骤、验收标准和缺口安排内容；资料不足时先补证，不用模型猜测。",
    technical: "需要把企业事实、问题地图、内容生产、审核发布和 AI 采样串成可追溯流程，并明确每个系统的输入、输出和责任边界。"
  }[dimension] || "应先明确问题、适用条件和核验证据，再给出可执行的下一步；无法从已审核资料确认的内容必须保留为待补充信息。";
  const statement = (citation) => citation
    ? "<span>" + escapeHtml(citation.quote || "") + "</span>" + citationMarkerHtml(citation)
    : "<span>当前已审核资料没有提供这一事实，本文不补写具体结论。</span>";
  const group = (items) => items.filter(Boolean).map(statement).join(" ");
  const customHeading = (index, fallback) => {
    const custom = agentSnapshot?.structure?.[index];
    return escapeHtml(custom && custom !== fallback ? `${fallback}（${custom}）` : fallback);
  };
  const writingFrame = agentSnapshot
    ? `<p class="geo-writing-note"><span>写作方式：</span>${escapeHtml(agentSnapshot.role || "企业内容编辑")} · ${escapeHtml(agentSnapshot.tone || "专业、清晰、克制")} · ${escapeHtml(agentSnapshot.style || "结论先行、证据优先")}</p>`
    : "";
  const directAnswer = `围绕“${escapeHtml(brief.coreQuestion || topic.title)}”，本文先给出可独立引用的判断：${escapeHtml(fallbackAnswer)}本次涉及企业自身的事实，只引用已审核知识；没有证据的部分保留为待补充信息。`;
  const evidence = citations.slice(1, 3);
  const method = citations.slice(3, 5);
  const faqCitation = citations[5] || citations[4] || citations[0];
  const faqSeeds = (brief.faqSeeds || ["这适合哪些企业或场景？", "落地前需要准备什么？", "如何核验结果或判断是否适用？"]).slice(0, 3);
  const faqAnswer = (index) => index === 0
    ? `先对照目标客户、业务场景和${escapeHtml(brief.answerMode || "回答方式")}，再判断是否适合，不把单一案例直接推广到所有企业。`
    : index === 1
      ? `至少准备企业主体、产品或服务说明、典型场景、可公开案例、FAQ 和禁用表达，并让来源、版本与更新时间可追溯。`
      : `用来源、版本、适用条件和更新时间逐条复核；${escapeHtml(fallbackAnswer)}若当前资料没有结论，应回到知识库补证。`;
  const comparisonBlock = ["commercial", "ranking", "review"].includes(dimension)
    ? `<h3>比较时先看哪些维度？</h3><table><thead><tr><th>比较维度</th><th>核验问题</th><th>当前证据边界</th></tr></thead><tbody><tr><td>能力与范围</td><td>是否覆盖本次目标场景？</td><td>只引用已审核的服务与产品资料</td></tr><tr><td>过程与交付</td><td>谁负责、如何验收、如何复盘？</td><td>没有统一资料的字段标记待补证</td></tr><tr><td>结果与风险</td><td>结果能否追溯，限制条件是什么？</td><td>不输出未经证实的排名或效果承诺</td></tr></tbody></table>`
    : "";
  const cta = agentSnapshot?.cta ? `<p class="agent-article-cta">${escapeHtml(agentSnapshot.cta)}</p>` : "";
  return `
    <section class="geo-article-section geo-answer-section" id="p-intro" data-geo-section="direct-answer">
      <h2>直接回答</h2>
      <p><strong>结论：</strong>${directAnswer}${statement(citations[0])}</p>
      ${writingFrame}
    </section>
    <section class="geo-article-section" id="p-scope" data-geo-section="scope">
      <h2>适用对象与问题边界</h2>
      <p>本内容面向${escapeHtml(brief.decisionRole || "正在评估方案的企业读者")}，回答方式为“${escapeHtml(brief.answerMode || "直接答案与执行步骤")}”。文章只讨论“${escapeHtml(brief.coreQuestion || topic.title)}”，不把单一案例或通用经验扩大为所有企业都适用的结论。</p>
      <ul><li>需要优先核验：${escapeHtml((brief.evidenceNeeds || []).join("、") || "企业主体、服务范围和适用条件")}。</li><li>不在本篇替代判断：未经审核的价格、排名、客户评价和效果承诺。</li></ul>
    </section>
    <section class="geo-article-section" id="p-knowledge" data-geo-section="evidence">
      <h2>${customHeading(0, "关键判断与事实依据")}</h2>
      <ol>${(evidence.length ? evidence : [null]).map((citation, index) => `<li><strong>依据 ${index + 1}：</strong>${statement(citation)}</li>`).join("")}</ol>
    </section>
    <section class="geo-article-section" id="p-topic" data-geo-section="method">
      <h2>${customHeading(1, "实施步骤或决策清单")}</h2>
      <ol><li><strong>先确认问题：</strong>把目标客户、使用场景和决策阶段写清楚，再决定内容范围。</li><li><strong>再核验事实：</strong>只使用本次冻结的知识版本，将每个关键判断绑定到对应证据。${group(method.slice(0, 1))}</li><li><strong>最后检查边界：</strong>对缺少证据的字段标记待补充，不用确定性话术代替事实。${group(method.slice(1, 2))}</li></ol>
      ${comparisonBlock}
    </section>
    <section class="geo-article-section geo-faq-section" id="p-faq" data-geo-section="faq">
      <h2>${customHeading(2, "常见追问")}</h2>
      ${faqSeeds.map((question, index) => `<h3>${escapeHtml(question)}</h3><p>${faqAnswer(index)}${index === 2 ? statement(faqCitation) : ""}</p>`).join("")}
    </section>
    <section class="geo-article-section geo-boundary-section" id="p-boundary" data-geo-section="boundary">
      <h2>信息边界与更新时间</h2>
      <p>本文企业事实仅来自本次冻结并通过审核的知识版本；联网搜索、临时附件和图片不能单独证明企业文字事实。${escapeHtml((brief.exclusions || []).join("；"))}。发布前仍需完成事实核验、风险扫描和人工审核。</p>
      <p class="knowledge-omission-note">如需补充价格、交付周期、客户名称或效果数字，请先在企业知识库建立并审核对应资料，再重新生成文章版本。</p>
    </section>
    ${cta}
  `;
}

function createArticleKnowledgeBundle(articleId, topic, plan) {
  const evidence = generationEvidenceForPlan(plan);
  const writingAgentSnapshot = cloneData(plan.writingAgentSnapshot);
  const geoBrief = topic.geoBrief || buildGeoTopicBrief(topic, topic.questionSnapshot);
  if (!topic.geoBrief) topic.geoBrief = cloneData(geoBrief);
  const expectedPlatformNames = planExpectedPlatformNames(plan);
  const expectedPlatformGuidance = planExpectedPlatformGuidance(plan);
  const sectionMeta = [
    ["p-intro", "直接回答"], ["p-knowledge", "关键判断与事实依据"], ["p-knowledge", "关键判断与事实依据"],
    ["p-topic", "实施步骤或决策清单"], ["p-topic", "实施步骤或决策清单"], ["p-faq", "常见追问"]
  ];
  const citations = evidence.map((entry, index) => {
    const marker = "K" + (index + 1);
    const citation = {
      id: uid("CIT") + "-" + marker,
      articleId,
      articleVersion: "v1",
      marker,
      paragraphId: sectionMeta[index]?.[0] || "p-content",
      articleSection: sectionMeta[index]?.[1] || "文章正文",
      knowledgeBaseId: entry.base.id,
      itemId: entry.item.id,
      versionId: entry.version.id,
      knowledgeVersion: entry.version.version,
      chunkId: entry.chunk?.id || null,
      claim: entry.item.title || entry.item.question,
      quote: entry.quote,
      excerpt: entry.quote,
      locator: knowledgeLocator(entry.item, entry.version),
      supportStatus: "supported",
      status: "verified"
    };
    return citation;
  });
  state.knowledgeCitations = state.knowledgeCitations || [];
  state.knowledgeCitations.push(...citations);
  const scope = normalizeKnowledgeScope(plan);
  const publicIds = enterpriseKnowledgeBaseIds();
  const planArticleIds = new Set(plan.articleIds || []);
  const gapTemplates = (state.knowledgeGaps || []).filter((gap) => gap.status !== "resolved" && (gap.planId === plan.id || planArticleIds.has(gap.articleId)) && (!gap.businessLineId || gap.businessLineId === plan.businessLineId));
  const fallbackGaps = writingAgentSnapshot?.missingEvidenceAction === "block" ? [] : [{ field: "price", label: "标准报价", reason: "当前已审核知识没有统一对外报价。" }, { field: "delivery_cycle", label: "交付周期", reason: "当前已审核知识没有可统一对外引用的交付周期。" }];
  const uniqueGaps = [...new Map((gapTemplates.length ? gapTemplates : fallbackGaps).map((gap) => [gap.field || gap.label, gap])).values()];
  const createdGaps = uniqueGaps.map((gap) => ({ id: uid("KG"), articleId, businessLineId: plan.businessLineId, field: gap.field || "missing_fact", label: gap.label || gap.title || "待补充事实", reason: gap.reason || "当前知识范围没有可核验的企业事实。", status: "open", severity: "blocking", generationPolicy: "omit" }));
  state.knowledgeGaps.push(...createdGaps);
  const now = new Date().toISOString();
  if (writingAgentSnapshot) writingAgentSnapshot.lockedAt = now;
  const citationIds = citations.map((citation) => citation.id);
  const lockedVersionIds = [...new Set(citations.map((citation) => citation.versionId))];
  const outputContract = buildGeoOutputContract({ ...topic, geoBrief }, citations, writingAgentSnapshot, { contentType: plan.contentType });
  const promptTemplate = buildGeoArticlePrompt({ ...topic, geoBrief }, citations, writingAgentSnapshot, { contentType: plan.contentType, outputContract, expectedPlatformGuidance });
  const content = buildKnowledgeArticleContent({ ...topic, geoBrief }, citations, writingAgentSnapshot, { outputContract });
  const geoQuality = evaluateGeoArticleQuality(content, { ...topic, geoBrief }, citations);
  return {
    citations,
    content,
    geoQuality,
    knowledgeSnapshot: {
      id: uid("KS"),
      capturedAt: now,
      frozenAt: null,
      enterpriseBaseIds: scope.resolvedBaseIds.filter((id) => publicIds.includes(id)),
      businessLineBaseIds: scope.resolvedBaseIds.filter((id) => !publicIds.includes(id) && !scope.addedBaseIds.includes(id)),
      addedBaseIds: scope.addedBaseIds,
      excludedBaseIds: scope.excludedBaseIds,
      resolvedBaseIds: scope.resolvedBaseIds,
      lockedVersionIds,
      citationIds,
      gapIds: createdGaps.map((gap) => gap.id)
    },
    generationSnapshot: {
      id: uid("GS"), generatedAt: now, generatedBy: "AI 内容助手", topicId: topic.id, topicSnapshot: cloneData(topic), planId: plan.id, businessLineId: plan.businessLineId,
      model: { name: (writingAgentSnapshot?.resolvedModel?.name || state.settings.model) + "（演示）", promptVersion: writingAgentSnapshot ? writingAgentSnapshot.nameSnapshot + " v" + writingAgentSnapshot.version : "历史默认配置" },
      writingAgent: writingAgentSnapshot,
      topicBrief: cloneData(geoBrief),
      outputContract,
      geoQuality,
      promptTemplate,
      styleGuidance: { expectedPlatforms: expectedPlatformNames, platformGuidance: expectedPlatformGuidance, purpose: "ai_writing_style_only", locksPublishing: false },
      retrieval: { strategy: "rag", query: topic.title, topK: 12, minScore: 0.62, approvedItems: planKnowledgeSummary(plan).approved, retrievedChunks: evidence.length, usedCitations: citations.length },
      knowledgeBaseIds: scope.resolvedBaseIds,
      citationIds,
      omittedFields: createdGaps.map((gap) => gap.field),
      instruction: promptTemplate,
      fingerprint: "demo-kb-" + articleId.toLowerCase()
    },
    knowledgeStatus: { state: "ready_with_omissions", availableItems: planKnowledgeSummary(plan).approved, evidenceCount: citations.length, supportedClaims: citations.length, conflictCount: 0, gapCount: createdGaps.length, message: citations.length + " 条事实已有证据；" + createdGaps.map((gap) => gap.label).join("与") + "因缺少知识而省略。" }
  };
}

function articleFromTopic(topic, plan, index, requestedArticleId = "") {
  const articleId = requestedArticleId || uid("ART") + index;
  const bundle = createArticleKnowledgeBundle(articleId, topic, plan);
  return {
    id: articleId,
    title: topic.title,
    topicId: topic.id,
    topicSnapshot: cloneData(topic),
    planId: plan.id,
    contentPlanId: plan.contentPlanId || plan.id || null,
    businessLineId: plan.businessLineId,
    status: "draft",
    reviewStatus: "pending",
    reviewStage: "draft",
    reviewSubmittedAt: null,
    reviewSubmittedBy: null,
    reviewNote: "",
    reviewedAt: null,
    reviewedBy: null,
    version: "v1",
    author: "AI 内容助手",
    category: plan.contentType,
    riskStatus: "unscanned",
    showPublicCitationMarkers: false,
    sources: bundle.citations.length,
    citations: bundle.citations.map((citation) => citation.id),
    knowledgeSnapshot: bundle.knowledgeSnapshot,
    generationSnapshot: bundle.generationSnapshot,
    geoQuality: bundle.geoQuality,
    writingAgentId: bundle.generationSnapshot.writingAgent?.agentId || null,
    writingAgentVersion: bundle.generationSnapshot.writingAgent?.version || null,
    writingAgentNameSnapshot: bundle.generationSnapshot.writingAgent?.nameSnapshot || null,
    versions: [],
    knowledgeStatus: bundle.knowledgeStatus,
    updatedAt: Date.now(),
    keywords: [topic.keyword, topic.intent, "企业知识"],
    excerpt: bundle.citations[0]?.quote || "来自内容计划「" + plan.name + "」的企业知识型文章初稿。",
    content: bundle.content
  };
}

function studioResetArticleReview(article, riskStatus = "unscanned") {
  article.reviewStatus = "pending";
  article.reviewStage = "draft";
  article.reviewSubmittedAt = null;
  article.reviewSubmittedBy = null;
  article.reviewNote = "";
  article.reviewedAt = null;
  article.reviewedBy = null;
  article.status = "draft";
  article.riskStatus = riskStatus;
  articleCitations(article).forEach((citation) => { citation.status = "needs_review"; });
  if (article.knowledgeSnapshot) article.knowledgeSnapshot.frozenAt = null;
  if (article.knowledgeStatus) {
    article.knowledgeStatus.state = "needs_review";
    article.knowledgeStatus.message = "正文已变化，需要重新核验引用、执行风控并人工审核。";
  }
  if (article.generationSnapshot?.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, article.topicSnapshot || article.generationSnapshot.topicSnapshot || {}, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
}

function studioBumpArticleVersion(article, reason, reasonLabel) {
  archiveArticleRevision(article, reason, reasonLabel);
  const current = Number(String(article.version || "v1").replace(/\D/g, "")) || 1;
  article.version = "v" + (current + 1);
  return studioCloneCitationsForVersion(article, article.version);
}

function syncStudioArticleEditor(options = {}) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const article = studioArticleForWorkspace(workspace);
  const titleInput = document.getElementById("studio-title-editor");
  const contentInput = document.getElementById("studio-content-editor");
  const visibilityInput = document.getElementById("studio-show-public-citations");
  if (!workspace || !article || !titleInput || !contentInput) return article || null;
  if (article.reviewStage === "manual_review") {
    if (!options.silent) showToast("当前版本正在人工审核", "请先执行“退回并修改”，服务端确认退回后才能编辑。", "error");
    return article;
  }
  const nextTitle = titleInput.value.trim();
  const nextContent = sanitizeStudioHtml(stripArticleRiskHighlights(contentInput.innerHTML.trim()));
  const nextShowPublicCitationMarkers = visibilityInput ? visibilityInput.checked : articlePublicCitationMarkersVisible(article);
  if (!nextTitle) {
    if (!options.silent) showToast("标题不能为空", "请填写文章标题后再保存。", "error");
    titleInput.focus();
    return null;
  }
  const baseline = articleContentForEditor(article, articleCitations(article)).trim();
  const changed = nextTitle !== article.title || nextContent !== baseline || nextShowPublicCitationMarkers !== articlePublicCitationMarkersVisible(article);
  const requiresNewVersion = changed && (Boolean(article.contentVersionId) || article.reviewStatus === "approved" || article.status === "published");
  const citationClone = requiresNewVersion ? studioBumpArticleVersion(article, "manual_edit", "人工编辑前") : null;
  article.title = nextTitle;
  article.showPublicCitationMarkers = nextShowPublicCitationMarkers;
  workspace.showPublicCitationMarkers = nextShowPublicCitationMarkers;
  article.content = citationClone?.idMap ? studioRemapCitationIds(nextContent, citationClone.idMap) : nextContent;
  if (changed) studioResetArticleReview(article, "stale");
  article.updatedAt = Date.now();
  workspace.updatedAt = article.updatedAt;
  if (changed) {
    article.contentSyncPending = true;
    markContentArticleEditPending(article);
    void queueContentArticleSync(article, { createVersion: true }).catch((error) => {
      article.contentSyncPending = false;
      article.contentSyncError = error.message || "内容版本同步失败";
      updateContentArticleEditGuard(article, { pending: true });
      saveState();
      if (!options.silent) showToast("内容版本同步失败", article.contentSyncError, "error");
    });
  }
  if (requiresNewVersion && !options.silent) showToast("已生成新版本", "已审核正文发生变化，需要重新审核与风控。");
  else if (!options.silent) showToast("草稿已保存", "文章正文和 AI 会话均已保存在当前客户空间。");
  saveState();
  return article;
}

function studioPlainText(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function studioHeadings(html) {
  return [...String(html || "").matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => studioPlainText(match[1])).filter(Boolean);
}

function studioReplaceHeadings(html, headings) {
  let index = 0;
  const semanticHeadings = ["直接回答", "适用对象与问题边界", "关键判断与事实依据", "实施步骤或决策清单", "常见追问", "信息边界与更新时间"];
  const replaced = String(html || "").replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi, (match) => {
    const custom = headings[index];
    const current = match.replace(/<[^>]+>/g, "").trim();
    const semantic = semanticHeadings[index] || current || "正文要点";
    index += 1;
    return `<h2>${escapeHtml(semantic)}${custom && custom !== semantic ? "（" + escapeHtml(custom) + "）" : ""}</h2>`;
  });
  if (index) return replaced;
  return replaced + headings.map((heading) => `<h2>${escapeHtml(heading)}</h2><p>请结合当前企业知识证据补充本节内容。</p>`).join("");
}

function studioFirstParagraphRewrite(html, prompt) {
  const match = String(html || "").match(/<p\b[^>]*>[\s\S]*?<\/p>/i);
  if (!match) return html;
  const markers = [...match[0].matchAll(/<button\b[^>]*data-citation-id="[^"]+"[^>]*>[\s\S]*?<\/button>/gi)].map((item) => item[0]).join("");
  const intro = prompt.includes("简洁")
    ? "先说结论：这项决策应从真实业务问题和已审核企业知识出发，再确定内容结构与发布路径。"
    : "这篇文章先明确读者要解决的核心问题，再用可追溯的企业知识说明判断依据、适用条件和下一步行动。";
  return String(html || "").replace(match[0], `<p id="p-intro">${escapeHtml(intro)}${markers}</p>`);
}

function buildStudioProposal(article, prompt, agentSnapshot) {
  if (!article) return null;
  const currentHash = studioContentHash(article.content);
  const lower = String(prompt || "").toLowerCase();
  if ((prompt.includes("标题") || lower.includes("headline")) && !prompt.includes("结构")) {
    const topic = article.topicSnapshot?.title || article.title;
    const title = topic.includes("？") ? topic : `${topic.replace(/[。！!]+$/, "")}：从企业知识到可执行决策`;
    return { kind: "title", label: "标题建议", title, before: article.title, after: title, baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  if (prompt.includes("开头") || prompt.includes("导语") || prompt.includes("简洁")) {
    const html = studioFirstParagraphRewrite(article.content, prompt);
    return { kind: "rewrite", label: "开篇重写建议", html, before: "现有开篇", after: "结论先行，并保留原企业知识引用", baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  if (prompt.includes("插入") || prompt.includes("补充") || prompt.includes("增加一节")) {
    const html = `${article.content}<h2>补充：落地前的核验清单</h2><ul><li>核对企业知识版本与适用边界。</li><li>确认内容面向的决策角色与发布渠道。</li><li>发布前重新完成引用、风险和人工审核。</li></ul>`;
    return { kind: "insert", label: "补充段落建议", html, before: "现有正文", after: "新增“落地前的核验清单”", baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
  }
  let headings;
  if (prompt.includes("采购") || prompt.includes("决策")) headings = ["一、先明确采购目标与适用场景", "二、用可核验维度比较方案", "三、签约前完成证据核验清单"];
  else if (prompt.includes("案例")) headings = ["一、案例背景与真实问题", "二、实施过程与关键选择", "三、结果、边界与可借鉴之处"];
  else if (prompt.includes("问答") || prompt.includes("FAQ")) headings = ["一、先给出直接答案", "二、说明判断依据与适用条件", "三、给出下一步核验建议"];
  else headings = (agentSnapshot?.structure || ["结论先行", "分点论证", "行动建议"]).slice(0, 3).map((heading, index) => `${["一", "二", "三"][index]}、${heading}`);
  const before = studioHeadings(article.content);
  return { kind: "structure", label: "文章结构调整建议", html: studioReplaceHeadings(article.content, headings), before: before.join(" → ") || "当前正文结构", after: headings.join(" → "), baseArticleVersion: article.version, baseContentHash: currentHash, status: "pending" };
}

function studioMessageSources(workspace, conversation) {
  const selectedIds = new Set(conversation?.selectedKnowledgeItemIds || []);
  const knowledgeSources = studioApprovedKnowledgeEntries(workspace).filter((entry) => selectedIds.has(entry.item.id)).map((entry) => ({
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
  if (!article) {
    const editorBodyDraft = (document.getElementById("studio-content-editor")?.innerText || workspace.draftContent || "").trim();
    const hasEditorDraft = Boolean((document.getElementById("studio-title-editor")?.value || workspace.draftTitle || "").trim() || editorBodyDraft);
    conversation.messages.push({ id: uid("MSG"), role: "user", text: prompt, createdAt: Date.now(), agentSnapshot, contextSnapshot, attachments });
    conversation.updatedAt = Date.now();
    workspace.updatedAt = conversation.updatedAt;
    ui.studioComposerDraft = "";
    ui.studioTopicDraft = prompt;
    saveState();
    const generated = await generateStudioArticle(prompt, { fromChat: true, preserveDraft: hasEditorDraft });
    if (!generated) {
      ui.studioComposerDraft = prompt;
      conversation.updatedAt = Date.now();
      workspace.updatedAt = conversation.updatedAt;
      saveState();
      render();
      return showToast("暂时无法生成", "本次写作要求已经保留，可直接再次发送；请检查模型状态后重试。", "error");
    }
    if (generated && editorBodyDraft) {
      const proposal = buildStudioProposal(generated, prompt, agentSnapshot);
      const generatedContext = { ...contextSnapshot, topic: cloneData(studioWorkspaceTopic(workspace, generated)), articleVersion: generated.version, contentHash: studioContentHash(generated.content) };
      const responseText = proposal?.kind === "title"
        ? "我已基于你刚才的正文给出标题建议，尚未写入文章。"
        : proposal?.kind === "insert"
          ? "我已基于你刚才的正文补出一节落地核验清单，点击应用后才会写入正文。"
          : "我已基于你刚才的正文整理出结构差异，点击应用后才会写入正文。";
      conversation.messages = conversation.messages.filter((m) => !m.thinking);
    conversation.messages.push({ id: uid("MSG"), role: "assistant", text: responseText, createdAt: Date.now(), agentSnapshot, contextSnapshot: generatedContext, sources, attachments, proposal });
      conversation.updatedAt = Date.now();
      workspace.updatedAt = conversation.updatedAt;
      saveState();
      render();
    }
    return;
  }
  conversation.messages.push({ id: uid("MSG"), role: "user", text: prompt, createdAt: Date.now(), agentSnapshot, contextSnapshot, attachments });
  conversation.messages.push({ id: uid("MSG"), role: "assistant", text: "正在结合企业知识与当前正文思考修改建议…", thinking: true, createdAt: Date.now() });
  conversation.updatedAt = Date.now();
  workspace.updatedAt = conversation.updatedAt;
  saveState();
  render();
  const providerId = await ensureSelectedTextProviderId();
  const line = state.businessLines.find((item) => item.id === workspace.businessLineId && item.status === "active");
  const evidence = articleCitations(article).map((citation) => ({
    item: { title: citation.claim || citation.title || "已审核企业事实" },
    quote: citation.quote || citation.excerpt || "",
    base: { name: citation.source || citation.sourceName || "企业知识库" },
    version: { id: citation.versionId || citation.knowledgeVersionId || "", content: citation.quote || "" }
  }));
  if (!providerId || !line || !evidence.length) {
    const failureText = !providerId ? "尚未配置文本模型，无法生成 AI 修改建议。" : !line ? "当前业务线不可用，无法生成 AI 修改建议。" : "当前文章没有冻结的已审核证据，无法安全重写。";
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
      userInstruction: `${prompt}\n当前文章标题：${article.title}\n当前文章正文：${studioPlainText(article.content).slice(0, 12000)}`
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
  const titleOnly = (prompt.includes("标题") || String(prompt).toLowerCase().includes("headline")) && !prompt.includes("结构");
  const proposal = {
    kind: titleOnly ? "title" : "rewrite",
    label: titleOnly ? "AI 标题建议" : "AI 正文修改建议",
    title: String(remoteRevision.title || article.title).slice(0, 240),
    html: titleOnly ? null : String(remoteRevision.html || remoteRevision.content || ""),
    before: titleOnly ? article.title : `当前 ${article.version}`,
    after: String(remoteRevision.summary || "已按本次要求重写，并保留证据边界。").slice(0, 300),
    baseArticleVersion: article.version,
    baseContentHash: studioContentHash(article.content),
    status: "pending",
    generationRunId: remoteRevision.generationRunId || remoteRevision.runId || null,
    model: remoteRevision.model || selectedTextModelName(),
    usage: remoteRevision.usage || null
  };
  const responseText = titleOnly
    ? "模型给出了一版更聚焦客户问题的标题，尚未写入文章。"
    : "模型已经按你的要求重写正文并保留企业知识引用，点击“应用到正文”后才会创建新版本。";
  conversation.messages.push({ id: uid("MSG"), role: "assistant", text: responseText + (conversation.webSearchEnabled ? " 联网结果单独标为外部资料，不会当成企业知识证据。" : ""), createdAt: Date.now(), agentSnapshot, contextSnapshot, sources, attachments, proposal });
  conversation.updatedAt = Date.now();
  workspace.updatedAt = conversation.updatedAt;
  ui.studioComposerDraft = "";
  saveState();
  render();
  window.setTimeout(() => {
    const messages = document.querySelector(".studio-chat-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
    document.getElementById("studio-composer-input")?.focus();
  }, 30);
}

function applyStudioProposal(messageId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const message = conversation?.messages.find((item) => item.id === messageId);
  const proposal = message?.proposal;
  const article = syncStudioArticleEditor({ silent: true }) || studioArticleForWorkspace(workspace);
  if (article?.reviewStage === "manual_review") return showToast("当前版本正在人工审核", "请先由审核人员退回并修改，AI 建议才能写入新版本。", "error");
  if (!article || !proposal || proposal.status !== "pending") return showToast("建议不可用", "请重新发送调整要求。", "error");
  if (proposal.baseArticleVersion !== article.version || proposal.baseContentHash !== studioContentHash(article.content)) return showToast("建议已过期", "正文或版本在建议生成后发生了变化，请重新让 AI 生成建议。", "error");
  const citationClone = studioBumpArticleVersion(article, "ai_collaboration", "应用 AI 建议前");
  if (proposal.kind === "title") article.title = proposal.title;
  else article.content = sanitizeStudioHtml(studioRemapCitationIds(proposal.html, citationClone?.idMap));
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  article.editEvents = Array.isArray(article.editEvents) ? article.editEvents : [];
  article.editEvents.unshift({ id: uid("EDIT"), type: "ai_proposal_applied", messageId, proposalKind: proposal.kind, fromVersion: proposal.baseArticleVersion, toVersion: article.version, agentSnapshot: cloneData(message.agentSnapshot), contextSnapshot: cloneData(message.contextSnapshot), createdAt: article.updatedAt });
  proposal.status = "applied";
  proposal.appliedVersion = article.version;
  proposal.appliedAt = article.updatedAt;
  conversation.messages.forEach((item) => {
    if (item.id !== messageId && item.proposal?.status === "pending") {
      item.proposal.status = "discarded";
      item.proposal.discardReason = "正文已生成新版本";
      item.proposal.discardedAt = article.updatedAt;
    }
  });
  conversation.messages.push({ id: uid("MSG"), role: "system", text: `建议已应用并创建 ${article.version}。审核、引用核验和风控已重置，旧版本仍可追溯。`, createdAt: article.updatedAt });
  conversation.updatedAt = article.updatedAt;
  workspace.status = "draft";
  workspace.updatedAt = article.updatedAt;
  saveState();
  article.contentSyncPending = true;
  void queueContentArticleSync(article, { createVersion: true }).catch((error) => {
    article.contentSyncPending = false;
    article.contentSyncError = error.message || "AI 修改版本同步失败";
    saveState();
  });
  render();
  showToast("AI 建议已应用", `已创建 ${article.version}，提交审核前需要重新风控并核验引用。`);
}

function discardStudioProposal(messageId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const message = conversation?.messages.find((item) => item.id === messageId);
  if (!message?.proposal) return;
  message.proposal.status = "discarded";
  message.proposal.discardedAt = Date.now();
  conversation.updatedAt = Date.now();
  saveState();
  render();
}

async function generateStudioArticle(topicOverride = "", options = {}) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace || workspace.articleId) return;
  const draftTitle = (document.getElementById("studio-title-editor")?.value || workspace.draftTitle || "").trim();
  const draftContentElement = document.getElementById("studio-content-editor");
  const draftContentHtml = sanitizeStudioHtml(draftContentElement?.innerHTML?.trim() || workspace.draftContentHtml || "");
  const draftContent = (draftContentElement?.innerText || workspace.draftContent || "").trim();
  const topicText = String(topicOverride || [draftTitle, draftContent].filter(Boolean).join("\n") || ui.studioTopicDraft).trim();
  const lineId = document.getElementById("studio-business-line")?.value || workspace.businessLineId;
  const contentType = document.getElementById("studio-content-type")?.value || workspace.contentType;
  const agentId = document.getElementById("studio-direct-agent")?.value || workspace.writingAgentId;
  const line = state.businessLines.find((item) => item.id === lineId && item.status === "active");
  const agent = writingAgentById(agentId);
  if (!topicText) return showToast("请先填写主题", "输入这篇文章要回答的问题或具体写作要求。", "error");
  if (!line) return showToast("业务线不可用", "请选择一个有效的产品 / 业务线。", "error");
  if (!agent || !writingAgentSupports(agent, line.id, contentType)) return showToast("写作智能体不可用", "请选择适用于当前业务线和内容形式的智能体。", "error");
  const scope = workspace.knowledgeScope;
  const agentSnapshot = snapshotWritingAgent(agent, { selectionSource: options.fromChat ? "studio_chat" : "quick_create", lockedAt: new Date().toISOString() });
  const context = { id: null, name: "AI 创作台 · 直接创作", businessLineId: line.id, contentType, articleIds: [], writingAgentId: agent.id, writingAgentSnapshot: agentSnapshot, knowledgeBaseIds: cloneData(scope.resolvedBaseIds), knowledgeScope: cloneData(scope), selectedKnowledgeItemIds: cloneData(workspace.selectedKnowledgeItemIds || []), createdAt: Date.now() };
  const requestedArticleId = uid("ART");
  const evidence = generationEvidenceForPlan(context);
  if (!evidence.length && !options.manualOnly) return showToast("没有可用企业知识", "请先为当前业务线配置知识库，并审核至少一条知识。", "error");
  const firstLine = topicText.split(/\n/).map((item) => item.trim()).find(Boolean) || topicText;
  const title = (draftTitle || firstLine).length > 70 ? (draftTitle || firstLine).slice(0, 68) + "…" : (draftTitle || firstLine);
  const topic = { id: uid("DIRECT-TOPIC"), source: "custom", title, keyword: title.slice(0, 32), intent: "直接创作", prompt: topicText, userInstruction: topicOverride || null };
  topic.geoIntent = buildGeoQuestionIntent({ question: title, sourceKeyword: topic.keyword, dimension: "question", intent: "直接创作", stage: "方案评估", source: "AI 创作台" });
  topic.geoBrief = buildGeoTopicBrief(topic, { id: null, question: title, sourceKeyword: topic.keyword, dimension: "question", intent: "直接创作", stage: "方案评估", geoIntent: topic.geoIntent });
  const sourceTopicId = workspace.sourceTopicId || null;
  const sourceTopicSnapshot = cloneData(workspace.sourceTopicSnapshot || null);
  let remoteGeneration = null;
  if (!options.manualOnly) {
    ui.studioGenerating = true;
    saveState();
    render();
    const providerId = await ensureSelectedTextProviderId();
    if (!providerId) {
      ui.studioGenerating = false;
      saveState();
      render();
      return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
    }
    const approvedEvidence = aiEvidencePayload(evidence);
    try {
      const modelQuestion = /[？?]/.test(topic.geoBrief.coreQuestion || "")
        ? topic.geoBrief.coreQuestion
        : `${topic.geoBrief.coreQuestion}应该如何判断和实施？`;
      const payload = await aiApi("/api/ai/generate/article", {
        method: "POST",
        body: {
          providerId,
          model: selectedTextModelName(),
          contentArticleId: requestedArticleId,
          contentTaskId: `TASK-${requestedArticleId}`,
          idempotencyKey: `article:workspace:${workspace.id}:${studioContentHash(topicText)}`,
          businessLine: aiBusinessLinePayload(line),
          contentType,
          topic: { id: topic.id, title: topic.title, coreQuestion: modelQuestion, dimension: topic.dimension || "question", intent: topic.intent, stage: topic.stage, geoBrief: { ...topic.geoBrief, coreQuestion: modelQuestion } },
          topicBrief: { ...topic.geoBrief, coreQuestion: modelQuestion },
          agentSnapshot,
          writingAgent: agentSnapshot,
          approvedEvidence,
          outputContract: buildGeoOutputContract(topic, [], agentSnapshot, { contentType })
        }
      });
      remoteGeneration = payload.data?.article || payload.article || payload.data || payload;
      const remoteHtml = remoteGeneration?.html || remoteGeneration?.content;
      if (!remoteHtml || typeof remoteHtml !== "string") throw new Error("模型没有返回可编辑的 HTML 文章");
      remoteGeneration = { ...remoteGeneration, html: remoteHtml, approvedEvidence };
    } catch (error) {
      ui.studioGenerating = false;
      saveState();
      render();
      showToast("文章生成失败", error.message || "模型未返回符合 GEO 文章契约的结果，请重试。", "error");
      return null;
    }
  }
  const article = articleFromTopic(topic, context, 0, requestedArticleId);
  article.showPublicCitationMarkers = workspace.showPublicCitationMarkers === true;
  article.topicId = null;
  article.planId = null;
  article.workspaceId = workspace.id;
  article.sourceType = workspace.sourceType === "topic_direct" ? "topic_direct" : "quick_create";
  article.sourceTopicId = sourceTopicId;
  article.sourceTopicSnapshot = sourceTopicSnapshot;
  article.topicSnapshot = cloneData(topic);
  article.businessLineId = line.id;
  article.category = contentType;
      article.author = (currentUserName() || "系统管理员") + " · AI 协作";
  if (remoteGeneration) {
    applyRemoteArticleResult(article, remoteGeneration);
  }
  if (options.manualOnly) {
    article.title = draftTitle || article.title;
    article.content = draftContentHtml || `<p>${escapeHtml(draftContent)}</p>`;
    article.excerpt = studioPlainText(article.content).slice(0, 180);
    const generatedCitationIds = new Set(article.citations || []);
    state.knowledgeCitations = (state.knowledgeCitations || []).filter((citation) => !generatedCitationIds.has(citation.id));
    state.knowledgeGaps = (state.knowledgeGaps || []).filter((gap) => gap.articleId !== article.id);
    article.citations = [];
    article.sources = 0;
    article.knowledgeSnapshot = { ...(article.knowledgeSnapshot || {}), citationIds: [], lockedVersionIds: [], frozenAt: null };
    article.knowledgeStatus = { state: "needs_review", evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "手工正文尚未映射企业知识引用，需要在 AI 协作或企业知识核验后再审核。" };
    article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "manual_editor", citationIds: [], topicSnapshot: cloneData(topic), instruction: "用户直接编辑的正文，未继承模板事实引用。" };
    article.sourceType = "manual_editor";
    article.author = (currentUserName() || "系统管理员") + " · 编辑";
  } else if (options.preserveDraft && (draftTitle || draftContent)) {
    article.title = draftTitle || article.title;
    if (draftContent) {
      article.content = draftContentHtml || `<p>${escapeHtml(draftContent)}</p>`;
      article.excerpt = studioPlainText(article.content).slice(0, 180);
      const generatedCitationIds = new Set(article.citations || []);
      state.knowledgeCitations = (state.knowledgeCitations || []).filter((citation) => !generatedCitationIds.has(citation.id));
      state.knowledgeGaps = (state.knowledgeGaps || []).filter((gap) => gap.articleId !== article.id);
      article.citations = [];
      article.sources = 0;
      article.knowledgeSnapshot = { ...(article.knowledgeSnapshot || {}), citationIds: [], lockedVersionIds: [], frozenAt: null };
      article.knowledgeStatus = { state: "needs_review", evidenceCount: 0, supportedClaims: 0, conflictCount: 0, gapCount: 0, message: "手工正文尚未映射企业知识引用，需要在 AI 协作或企业知识核验后再审核。" };
      article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "manual_editor", citationIds: [], topicSnapshot: cloneData(topic), instruction: "用户直接编辑的正文，未继承模板事实引用。" };
      article.sourceType = "quick_editor_draft";
      article.author = (currentUserName() || "系统管理员") + " · 编辑";
    } else {
      article.sourceType = "quick_editor_title";
      article.author = (currentUserName() || "系统管理员") + " · 编辑";
    }
  }
  article.keywords = [topic.keyword, "直接创作", line.name];
  article.generationSnapshot = { ...article.generationSnapshot, sourceType: article.sourceType, workspaceId: workspace.id, planId: null, topicSnapshot: cloneData(topic), sourceTopicId, sourceTopicSnapshot };
  if (article.generationSnapshot.outputContract) {
    article.geoQuality = evaluateGeoArticleQuality(article.content, topic, articleCitations(article));
    article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
  }
  article.assetIds = cloneData(workspace.assetIds || []);
  state.articles.unshift(article);
  workspace.articleId = article.id;
  workspace.status = "draft";
  workspace.businessLineId = line.id;
  workspace.businessLineSnapshot = { id: line.id, name: line.name, product: line.product };
  workspace.topic = cloneData(topic);
  workspace.draftTitle = "";
  workspace.draftContent = "";
  workspace.draftContentHtml = "";
  workspace.contentType = contentType;
  workspace.writingAgentId = agent.id;
  workspace.writingAgentSnapshot = agentSnapshot;
  workspace.knowledgeScope.lockedVersionIds = cloneData(article.knowledgeSnapshot?.lockedVersionIds || []);
  workspace.knowledgeScope.frozenAt = new Date().toISOString();
  workspace.updatedAt = Date.now();
  const conversation = studioConversationForWorkspace(workspace);
  if (conversation) {
    conversation.articleId = article.id;
    conversation.selectedAgentId = agent.id;
    const manualTextDraft = options.manualOnly || (options.preserveDraft && Boolean(draftContent));
    conversation.messages.push({ id: uid("MSG"), role: "system", text: manualTextDraft ? "已保存为手工编辑草稿。正文尚未建立企业知识引用，后续可在 AI 协作中继续写作或补充核验。" : `已基于 ${evidence.length} 条已审核企业知识生成 ${article.version} 初稿。正文、智能体和知识版本已记录，当前为待审核、未风控状态。`, createdAt: Date.now() });
    conversation.updatedAt = Date.now();
  }
  ui.studioArticleId = article.id;
  ui.studioAgentId = agent.id;
  ui.studioGenerating = false;
  saveState();
  render();
  showToast(options.manualOnly ? "草稿已保存" : "文章初稿已生成", options.manualOnly ? `已创建 ${article.id} · ${article.version}，可继续在右侧 AI 协作中写作。` : `已创建 ${article.id} · ${article.version}，可继续通过右侧 AI 对话调整。`);
  return article;
}

function studioAssetFigure(asset) {
  const base = knowledgeBaseById(asset.knowledgeBaseId);
  const source = [base?.name || "企业图片资料库", asset.license || "来源已记录"].filter(Boolean).join(" · ");
  if (asset.url) return `<figure class="studio-knowledge-image" data-asset-id="${escapeHtml(asset.id)}"><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || asset.name)}" loading="lazy" /><figcaption><b>${escapeHtml(asset.caption || asset.altText || asset.name)}</b><small>图片引用 · ${escapeHtml(source)}</small></figcaption></figure>`;
  return `<figure class="studio-knowledge-image" data-asset-id="${escapeHtml(asset.id)}"><div class="knowledge-image-placeholder ${escapeHtml(asset.accent || "blue")}" role="img" aria-label="${escapeHtml(asset.altText || asset.name)}"><span data-icon="image"></span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.kind === "knowledge_image" ? "企业知识库图片 · " + (asset.license || "来源已记录") : "创作素材 · 待审核")}</small></div><figcaption>${escapeHtml(asset.caption || asset.altText || asset.name)}</figcaption></figure>`;
}

function insertStudioAssetFigure(editor, asset, index) {
  const template = document.createElement("template");
  template.innerHTML = studioAssetFigure(asset);
  const figure = template.content.firstElementChild;
  if (!figure) return false;
  const targetIndex = Number.isInteger(index) ? Math.max(0, Math.min(editor.children.length, index)) : editor.children.length;
  editor.insertBefore(figure, editor.children[targetIndex] || null);
  const spacer = document.createElement("p");
  spacer.innerHTML = "<br>";
  editor.insertBefore(spacer, figure.nextSibling);
  const range = document.createRange();
  range.selectNodeContents(spacer);
  range.collapse(true);
  const selection = window.getSelection?.();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function insertStudioAsset(assetId) {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!workspace || !conversation || !asset) return;
  if (asset.kind === "knowledge_image" && !studioKnowledgeAssets(workspace).some((item) => item.id === asset.id)) return showToast("图片不可用", "只能使用当前知识范围内的可用企业图片。", "error");
  const currentArticle = studioArticleForWorkspace(workspace);
  if (currentArticle?.reviewStage === "manual_review") return showToast("当前版本正在人工审核", "请先退回并修改，再插入图片资料。", "error");
  if (!conversation.imageIds.includes(asset.id)) conversation.imageIds.push(asset.id);
  const editor = document.getElementById("studio-content-editor");
  if (!editor || !insertStudioAssetFigure(editor, asset, ui.studioAssetInsertIndex)) return showToast("无法定位插入位置", "请在正文中点击要插入图片的段落后重试。", "error");
  const article = currentArticle;
  if (!article) {
    workspace.assetIds = Array.isArray(workspace.assetIds) ? workspace.assetIds : [];
    if (!workspace.assetIds.includes(asset.id)) workspace.assetIds.push(asset.id);
    workspace.draftContent = editor.innerText || "";
    workspace.draftContentHtml = sanitizeStudioHtml(editor.innerHTML);
    workspace.updatedAt = Date.now();
    ui.studioPicker = null;
    ui.studioAssetInsertIndex = null;
    saveState();
    render();
    return showToast("图片引用已插入", "已放到所选段落后，来源与知识库关联会随文章保存。", "success");
  }
  const citationClone = studioBumpArticleVersion(article, "asset_insert", "插入图片前");
  const nextContent = sanitizeStudioHtml(editor.innerHTML);
  article.content = citationClone?.idMap ? studioRemapCitationIds(nextContent, citationClone.idMap) : nextContent;
  article.assetIds = Array.isArray(article.assetIds) ? article.assetIds : [];
  if (!article.assetIds.includes(asset.id)) article.assetIds.push(asset.id);
  workspace.assetIds = Array.isArray(workspace.assetIds) ? workspace.assetIds : [];
  if (!workspace.assetIds.includes(asset.id)) workspace.assetIds.push(asset.id);
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  workspace.updatedAt = article.updatedAt;
  conversation.updatedAt = article.updatedAt;
  article.contentSyncPending = true;
  markContentArticleEditPending(article);
  void queueContentArticleSync(article, { createVersion: true }).catch((error) => {
    article.contentSyncPending = false;
    article.contentSyncError = error.message || "图片引用版本同步失败";
    updateContentArticleEditGuard(article, { pending: true });
    saveState();
    showToast("图片引用同步失败", `${article.contentSyncError}；本地草稿已保留，可稍后重试。`, "error");
  });
  ui.studioPicker = null;
  ui.studioAssetInsertIndex = null;
  saveState();
  render();
  showToast("图片引用已插入", `已放到所选段落后并创建 ${article.version}，来源和版权信息已记录。`, "success");
}

function generateStudioImageAsset() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const article = studioArticleForWorkspace(workspace);
  const asset = { id: uid("ASSET-AI"), kind: "generated", name: "文章主题配图（演示占位）", mime: "image/png", reviewStatus: "pending", license: "AI 配图占位 · 待人工确认", altText: article ? `${article.title}的文章主题示意图` : "文章主题示意图", caption: "AI 配图占位（待接入真实图片服务）", accent: "violet", createdAt: Date.now() };
  state.contentAssets.push(asset);
  insertStudioAsset(asset.id);
}

function approveArticleAsset(articleId, assetId) {
  const article = state.articles.find((item) => item.id === articleId);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!article || !asset || !(article.assetIds || []).includes(assetId)) return showToast("素材不存在", "请刷新文章后重试。", "error");
  asset.reviewStatus = "approved";
  asset.reviewedAt = new Date().toISOString();
  asset.reviewedBy = currentUserName() || "系统管理员";
  asset.license = String(asset.license || "来源已确认").replace("待确认", "已确认");
  article.updatedAt = Date.now();
  addOperationLog("素材审核", `已确认文章《${article.title}》中的素材「${asset.name}」可用`);
  saveState();
  render();
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
  showToast("素材已确认", "已记录来源确认；文章仍需完成风控和人工审核后才可发布。");
}

function removeArticleAssetMarkup(html, assetId) {
  if (typeof document === "undefined") return String(html || "");
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  template.content.querySelectorAll("[data-asset-id]").forEach((node) => {
    if (node.getAttribute("data-asset-id") !== assetId) return;
    const container = node.closest("figure") || node;
    container.remove();
  });
  return template.innerHTML;
}

function removeArticleAsset(articleId, assetId) {
  const article = state.articles.find((item) => item.id === articleId);
  const asset = (state.contentAssets || []).find((item) => item.id === assetId);
  if (!article || !asset || !(article.assetIds || []).includes(assetId)) return showToast("素材不存在", "请刷新文章后重试。", "error");
  studioBumpArticleVersion(article, "asset_remove", "移除素材前");
  article.assetIds = article.assetIds.filter((id) => id !== assetId);
  article.content = removeArticleAssetMarkup(article.content, assetId);
  studioResetArticleReview(article, "unscanned");
  article.updatedAt = Date.now();
  (state.writingWorkspaces || []).filter((workspace) => workspace.articleId === article.id).forEach((workspace) => {
    workspace.assetIds = (workspace.assetIds || []).filter((id) => id !== assetId);
    workspace.updatedAt = article.updatedAt;
    const conversation = studioConversationForWorkspace(workspace);
    if (conversation) conversation.imageIds = (conversation.imageIds || []).filter((id) => id !== assetId);
  });
  addOperationLog("素材审核", `已从文章《${article.title}》移出素材「${asset.name}」，并创建 ${article.version} 新版本`);
  saveState();
  render();
  ui.modal = { type: "article", articleId: article.id };
  renderModal();
  showToast("素材已移出", `已创建 ${article.version} 新版本，需重新完成风控与人工审核。`);
}

async function addStudioFiles(fileList, kind = "attachment") {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  const conversation = studioConversationForWorkspace(workspace);
  const files = Array.from(fileList || []);
  if (!workspace || !conversation || !files.length) return;
  if (kind === "image") {
    const imageFiles = files.filter((file) => String(file.type || "").startsWith("image/"));
    if (!imageFiles.length) return showToast("请选择图片", "这里只接收 PNG、JPG、WebP、GIF 等图片文件。", "error");
    if (imageFiles.length > 500) return showToast("图片数量过多", "一次最多上传 500 张图片。", "error");
    const oversized = imageFiles.find((file) => Number(file.size || 0) > 20 * 1024 * 1024);
    if (oversized) return showToast("单张图片过大", `「${oversized.name}」超过 20 MB，请压缩后再上传。`, "error");
    const library = studioKnowledgeBases(workspace).find((base) => base.kind === "document")
      || (state.knowledgeBases || []).find((base) => base.kind === "document" && base.status !== "archived")
      || null;
    if (!library) return showToast("没有可用图片知识库", "请先在企业知识中创建或授权一个文档知识库，再上传文章配图。", "error");
    try {
      // A picture selected from the writing studio is a real knowledge asset,
      // not a temporary metadata-only content asset. It is immediately usable
      // and receives the same hash de-duplication and storage guarantees as
      // the bulk image library upload.
      const ids = [];
      for (const batch of imageUploadBatches(imageFiles)) {
        const assets = await Promise.all(batch.map(async (file) => ({
          sourceName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
          altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          metadata: { size: Number(file.size || 0), sourceRole: "studio_upload", category: "文章配图", license: "企业自有" }
        })));
        const payload = await productionApi("/api/v1/knowledge/assets-batch", { method: "POST", body: { libraryId: library.id, assets, defaults: { sourceRole: "studio_upload", category: "文章配图", license: "企业自有" } } });
        ids.push(
          ...(payload.data?.items || []).map((item) => item.id),
          ...(payload.data?.duplicates || []).map((item) => item.existingAssetId)
        );
      }
      await refreshKnowledgeAssetsFromServer();
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (uniqueIds.length) insertStudioAsset(uniqueIds[0]);
      showToast("图片已进入知识库", `${uniqueIds.length > 1 ? `已保存 ${uniqueIds.length} 张，第一张已插入正文；` : "当前图片已插入正文；"}其余图片可从知识库图片中选择，无需人工审核。`, "success");
    } catch (error) {
      showToast("图片上传失败", error.message || "请检查图片格式后重试。", "error");
    }
    return;
  }
  const assets = files.map((file) => ({ id: uid("ASSET-FILE"), kind: "attachment", name: file.name, mime: file.type || "application/octet-stream", size: file.size, reviewStatus: "temporary", license: "临时会话资料", altText: file.name, caption: file.name, accent: "teal", createdAt: Date.now() }));
  state.contentAssets.push(...assets);
  assets.forEach((asset) => {
    if (!workspace.attachmentIds.includes(asset.id)) workspace.attachmentIds.push(asset.id);
    if (!conversation.attachments.includes(asset.id)) conversation.attachments.push(asset.id);
  });
  workspace.updatedAt = Date.now();
  conversation.updatedAt = workspace.updatedAt;
  saveState();
  render();
  showToast("附件已加入本次对话", "附件仅作临时上下文，不会自动进入企业知识库或成为审核证据。");
}

function startNewStudioConversation() {
  const workspace = studioWorkspaceById(ui.studioWorkspaceId);
  if (!workspace) return;
  const oldConversation = studioConversationForWorkspace(workspace);
  if (oldConversation) oldConversation.status = "archived";
  const id = uid("CHAT");
  const conversation = { id, workspaceId: workspace.id, articleId: workspace.articleId || null, status: "active", selectedAgentId: oldConversation?.selectedAgentId || workspace.writingAgentId, selectedKnowledgeBaseIds: cloneData(workspace.knowledgeScope.resolvedBaseIds), selectedKnowledgeItemIds: [], webSearchEnabled: false, attachments: [], imageIds: [], messages: [{ id: uid("MSG"), role: "assistant", text: "新对话已开始。文章正文没有变化；你可以换一个智能体，从新的角度提出修改要求。", createdAt: Date.now(), agentSnapshot: cloneData(workspace.writingAgentSnapshot) }], createdAt: Date.now(), updatedAt: Date.now() };
  state.aiConversations.unshift(conversation);
  workspace.conversationId = id;
  workspace.updatedAt = Date.now();
  ui.studioComposerDraft = "";
  ui.studioWebSearch = false;
  ui.studioPicker = null;
  saveState();
  render();
}

function aiEvidencePayload(evidence) {
  return (evidence || []).map((entry, index) => ({
    id: `EVID-${index + 1}`,
    marker: `K${index + 1}`,
    claim: entry.item?.title || entry.item?.question || "已审核企业事实",
    quote: entry.quote || entry.version?.content || "",
    source: entry.base?.name || "企业知识库",
    locator: knowledgeLocator(entry.item || {}, entry.version || {}),
    knowledgeLibraryId: entry.base?.id || entry.libraryId || null,
    knowledgeDocumentId: entry.item?.id || entry.documentId || null,
    versionId: entry.version?.id || null,
    knowledgeVersionId: entry.version?.id || entry.versionId || null,
    knowledgeChunkId: entry.chunk?.id || entry.chunkId || null,
    status: "approved",
    supportStatus: "supported"
  }));
}

function applyRemoteArticleResult(article, remoteGeneration) {
  if (!article || !remoteGeneration) return article;
  article.title = String(remoteGeneration.title || article.title).slice(0, 240);
  const citations = articleCitations(article);
  article.content = String(remoteGeneration.html || remoteGeneration.content || "").replace(/<sup\b([^>]*?)data-evidence-id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/sup>/gi, (match, before, evidenceId, after, label) => {
    const index = Number(String(evidenceId).replace(/\D/g, "")) - 1;
    const citation = citations[index];
    return citation ? citationMarkerHtml(citation) : String(label || "");
  });
  article.excerpt = String(remoteGeneration.summary || studioPlainText(article.content)).slice(0, 180);
  article.sources = citations.length;
  // The article generation endpoint may already have committed the formal
  // content task/version.  Keep those identifiers so review and publishing use
  // the same server-side record instead of creating a duplicate draft.
  article.contentTaskId = remoteGeneration.contentTaskId || remoteGeneration.taskId || remoteGeneration.contentTask?.id || article.contentTaskId || null;
  article.contentArticleId = remoteGeneration.contentArticleId || remoteGeneration.articleId || remoteGeneration.contentArticle?.id || article.contentArticleId || null;
  article.contentVersionId = remoteGeneration.articleVersionId || remoteGeneration.versionId || remoteGeneration.articleVersion?.id || article.contentVersionId || null;
  article.contentRevision = remoteGeneration.contentRevision ?? remoteGeneration.revision ?? article.contentRevision;
  article.contentVersionNumber = remoteGeneration.articleVersion?.versionNumber ?? remoteGeneration.versionNumber ?? article.contentVersionNumber;
  article.generationSnapshot = { ...(article.generationSnapshot || {}), sourceType: "real_model", generationMode: "model", model: remoteGeneration.model || selectedTextModelName(), usage: remoteGeneration.usage || null, requestId: remoteGeneration.requestId || null, omittedClaims: remoteGeneration.omittedClaims || [], warnings: remoteGeneration.warnings || [] };
  return article;
}

async function requestAiArticle({ providerId, line, contentType, topic, agentSnapshot, evidence, expectedPlatforms = [], userInstruction = "", planId = "", contentPlanId = "", contentArticleId = "", contentTaskId = "", topicId = "", idempotencyKey = "", dueAt = "", expectedCompletionAt = "", knowledgeBaseIds = [] }) {
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
      topic: { id: topic.id, title: topic.title, coreQuestion, dimension: topic.dimension || "question", intent: topic.intent, stage: topic.stage, geoBrief: brief },
      topicBrief: brief,
      userInstruction: String(userInstruction || "").slice(0, 4000),
      agentSnapshot,
      writingAgent: agentSnapshot,
      approvedEvidence: aiEvidencePayload(evidence),
      expectedPlatforms,
      outputContract: buildGeoOutputContract({ ...topic, geoBrief: brief }, [], agentSnapshot, { contentType })
    }
  });
  const remote = payload.data?.article || payload.article || payload.data || payload;
  if (!remote || typeof (remote.html || remote.content) !== "string") throw new Error("模型没有返回可编辑的 HTML 文章");
  return remote;
}

async function executeContentPlan(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return showToast("计划不存在", "请刷新页面后重试。", "error");
  try {
    await syncContentPlan(plan);
  } catch (error) {
    return showToast("正式计划同步失败", error.message || "无法把计划写入正式内容数据库，未开始生成文章。", "error");
  }
  const resolvedAgent = resolvePlanWritingAgent(plan);
  if (!resolvedAgent?.snapshot || !resolvedAgent.agent) return showToast("计划缺少写作智能体", "请重新创建内容计划；系统不会静默换用默认智能体。", "error");
  if (resolvedAgent.agent.status !== "active") return showToast("写作智能体不可用", "该智能体已停用，请恢复后再生成；系统不会静默换用其他智能体。", "error");
  const evidence = generationEvidenceForPlan(plan);
  if (!evidence.length) return showToast("没有可用企业知识", "请先为计划选择知识库，并审核至少一条知识。", "error");
  if (resolvedAgent.snapshot.missingEvidenceAction === "block" && generationGapLabels(plan, { blockingOnly: true }).length) return showToast("知识缺口阻止生成", "当前智能体要求证据完整，请先补齐并审核计划中的知识缺口。", "error");
  const providerId = await ensureSelectedTextProviderId();
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  const line = state.businessLines.find((item) => item.id === plan.businessLineId && item.status === "active");
  if (!line) return showToast("业务线不可用", "内容计划所属业务线已停用，不能继续生成文章。", "error");
  closeModal();
  plan.status = "generating";
  plan.updatedAt = Date.now();
  saveState();
  render();
  plan.topicIds = contentPlanTopicIds(plan);
  plan.topicSnapshots = Array.isArray(plan.topicSnapshots) ? plan.topicSnapshots.filter((topic) => topic && topic.id).map((topic) => cloneData(topic)) : [];
  const topicSnapshotById = new Map(plan.topicSnapshots.map((topic) => [topic.id, topic]));
  plan.articleIds = [...new Set((Array.isArray(plan.articleIds) ? plan.articleIds : []).filter(Boolean))];
  const created = [];
  const missingTopics = [];
  const failedTopics = [];
  for (const [index, topicId] of plan.topicIds.entries()) {
    const existing = state.articles.find((article) => contentPlanForArticle(article)?.id === plan.id && article.topicId === topicId);
    if (existing) {
      existing.planId = plan.id;
      existing.businessLineId = existing.businessLineId || plan.businessLineId;
      if (!plan.articleIds.includes(existing.id)) plan.articleIds.push(existing.id);
      continue;
    }
      const topic = topicSnapshotById.get(topicId) || state.topics.find((item) => item.id === topicId);
    if (!topic) {
      missingTopics.push(topicId);
      continue;
    }
    if (!topicSnapshotById.has(topicId)) {
      const snapshot = cloneData(topic);
      plan.topicSnapshots.push(snapshot);
      topicSnapshotById.set(topicId, snapshot);
    }
    try {
      const requestedArticleId = uid("ART");
      const remote = await requestAiArticle({
        providerId,
        line,
        contentType: plan.contentType,
        topic,
        agentSnapshot: resolvedAgent.snapshot,
        evidence,
        expectedPlatforms: planExpectedPlatformNames(plan),
        planId: plan.id,
        contentPlanId: plan.contentPlanId || plan.id,
        contentArticleId: requestedArticleId,
        contentTaskId: `TASK-${requestedArticleId}`,
        topicId,
        idempotencyKey: `article:${plan.contentPlanId || plan.id}:${topicId}:v1`,
        dueAt: plan.scheduledFor || null,
        expectedCompletionAt: plan.scheduledFor || null,
        knowledgeBaseIds: normalizeKnowledgeScope(plan).resolvedBaseIds
      });
      const article = applyRemoteArticleResult(articleFromTopic(topic, plan, index, requestedArticleId), remote);
      article.geoQuality = evaluateGeoArticleQuality(article.content, topic, articleCitations(article));
      article.generationSnapshot.geoQuality = cloneData(article.geoQuality);
      state.articles.unshift(article);
      plan.articleIds.push(article.id);
      created.push(article);
      if (!article.contentTaskId || !article.contentVersionId) {
        article.contentSyncPending = true;
        void queueContentArticleSync(article, { createVersion: true }).catch((error) => {
          article.contentSyncPending = false;
          article.contentSyncError = error.message || "生成结果同步失败";
          saveState();
        });
      }
      plan.updatedAt = Date.now();
      saveState();
      render();
    } catch (error) {
      failedTopics.push({ topicId, title: topic.title, message: error.message || "模型生成失败" });
    }
  }
  const progress = contentPlanProgress(plan);
  plan.status = !failedTopics.length && progress.total && !progress.missing ? "produced" : "planned";
  plan.updatedAt = Date.now();
  if (plan.writingAgentSnapshot && !plan.writingAgentSnapshot.lockedAt) plan.writingAgentSnapshot.lockedAt = new Date().toISOString();
  try { await syncContentPlan(plan); } catch (error) { plan.contentPlanSyncError = error.message || "正式计划状态同步失败"; }
  saveState();
  ui.contentView = "articles";
  ui.articleTaskView = "articles";
  ui.articlePlanFilterId = plan.id;
  ui.articleTab = "all";
  navigate("content");
  const message = failedTopics.length
    ? `已生成 ${created.length} 篇，另有 ${failedTopics.length} 篇失败；失败项未使用本地模板替代，可修正模型或知识后重试。首个错误：${failedTopics[0].message}`
    : created.length
    ? "已从计划生成 " + created.length + " 篇待审核初稿。" + (progress.missing ? "仍有 " + progress.missing + " 个选题待生成。" : "")
    : missingTopics.length
      ? "部分选题记录已不存在，计划仍保留待处理状态。"
      : "计划中的选题已经存在文章，已打开内容生产。";
  showToast(failedTopics.length ? "部分文章生成失败" : "内容任务已创建", message, failedTopics.length ? "error" : "success");
}

function selectedTextProviderId() {
  return String(state.settings?.modelProviderId || "").trim();
}

async function ensureSelectedTextProviderId() {
  let providerId = selectedTextProviderId();
  if (!providerId) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  return providerId;
}

function selectedTextModelName() {
  return String(state.settings?.model || "").trim();
}

function normalizeAiQuestionCandidate(item, index, packId, businessLineId, seeds, generationRunId = null) {
  if (!item || typeof item !== "object") throw new Error("模型返回了无法识别的问题项");
  const dimension = String(item.dimension || "").trim();
  const question = String(item.question || "").trim();
  const sourceKeyword = String(item.source_keyword || item.sourceKeyword || "").trim();
  if (!DIMENSIONS.some((entry) => entry.id === dimension && entry.id !== "all") || !question || !/[？?]/.test(question) || !sourceKeyword) {
    throw new Error("模型返回的问题缺少完整问句、来源关键词或栏目");
  }
  if (!seeds.some((seed) => seed.toLowerCase() === sourceKeyword.toLowerCase())) {
    throw new Error(`模型返回了未在本次拓展中出现的来源关键词：${sourceKeyword}`);
  }
  const intentLabels = { question: "客户问答", comparison: "方案对比", selection: "方案选择", evaluation: "效果评估", implementation: "实施落地", risk: "风险核验" };
  const stageLabels = { discovery: "需求认知", shortlist: "方案筛选", evaluation: "方案评估", purchase: "采购决策", implementation: "实施落地", renewal: "复盘续费" };
  const declaredScoreSource = String(item.scoreSource || "").trim();
  const scoreSource = ["system_rules_v1", "model_contract"].includes(declaredScoreSource)
    ? declaredScoreSource
    : item.generationMode === "model" && item.scoreBreakdown && Number.isFinite(Number(item.priorityScore)) ? "model_contract" : null;
  const modelRecommendation = scoreTo100(item.modelRecommendation ?? item.recommendation_score ?? (scoreSource ? null : item.recommendation));
  const business = scoreTo100(item.business_score ?? item.business);
  const questionRecord = applyQuestionPriorityScore({
    id: `Q-AI-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    packId,
    businessLineId,
    sourceKeyword,
    question,
    dimension,
    intent: intentLabels[item.intent] || String(item.intent || "客户问答"),
    stage: stageLabels[item.decision_stage] || String(item.decision_stage || "需求认知"),
    coverage: "未覆盖",
    source: "AI 模型拓展",
    status: "candidate",
    version: 1,
    topicId: null,
    selected: false,
    modelRecommendation,
    business,
    scoreSource,
    scoreBreakdown: item.scoreBreakdown && typeof item.scoreBreakdown === "object" ? cloneData(item.scoreBreakdown) : null,
    quality: {
      askability: scoreTo100(item.quality?.askability ?? item.askability),
      specificity: scoreTo100(item.quality?.specificity ?? item.specificity),
      businessRelevance: scoreTo100(item.quality?.businessRelevance ?? item.businessRelevance),
      evidenceReadiness: scoreTo100(item.quality?.evidenceReadiness ?? item.evidenceReadiness),
      duplicateRisk: scoreTo100(item.quality?.duplicateRisk ?? item.duplicateRisk)
    },
    reason: String(item.reason || "基于客户角色、场景与决策任务生成").slice(0, 500),
    generationMode: "real_model",
    engine: "openai-compatible",
    askerRole: String(item.asker_role || "").slice(0, 200),
    triggerScenario: String(item.trigger_scenario || "").slice(0, 500),
    expectedAnswer: String(item.expected_answer || "").slice(0, 1000),
    followUpQuestions: Array.isArray(item.follow_up_questions) ? item.follow_up_questions.map(String).slice(0, 10) : [],
    queryRewrites: Array.isArray(item.query_rewrites) ? item.query_rewrites.map(String).slice(0, 10) : [],
    evidenceRequirements: Array.isArray(item.evidence_requirements) ? item.evidence_requirements.map(String).slice(0, 20) : [],
    generationRunId: item.generationRunId || item.generation_run_id || generationRunId || null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  questionRecord.geoIntent = buildGeoQuestionIntent(questionRecord);
  return questionRecord;
}

async function expandSeedKeywords() {
  const line = activeBusinessLine();
  if (!line || ui.seedExpanding) return;
  const inputTerms = [...new Set(ui.businessKeywordInput.split(/[，,;；\n]/).map((term) => term.trim()).filter(Boolean))];
  if (inputTerms.length > 8) {
    ui.businessKeywordError = "一次最多使用 8 个核心关键词拓展种子词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (inputTerms.some((term) => term.length > 40)) {
    ui.businessKeywordError = "单个核心关键词不能超过 40 个字。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  const coreKeywords = state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active" && !isSeedKeyword(item));
  const coreByTerm = new Map(coreKeywords.map((item) => [item.term.toLowerCase(), item]));
  const now = Date.now();
  const newCoreKeywords = inputTerms.filter((term) => !coreByTerm.has(term.toLowerCase())).map((term, index) => ({
    id: uid("KW") + index,
    businessLineId: line.id,
    term,
    type: "核心关键词",
    keywordRole: "core",
    source: "智能拓展入口",
    status: "active",
    createdAt: now,
    updatedAt: now
  }));
  newCoreKeywords.forEach((item) => coreByTerm.set(item.term.toLowerCase(), item));
  const inputCoreKeywords = inputTerms.map((term) => coreByTerm.get(term.toLowerCase())).filter(Boolean);
  const selectedIds = new Set(ui.selectedCoreKeywordIds || []);
  const validSelectedCoreKeywords = coreKeywords.filter((item) => selectedIds.has(item.id));
  const requestedCoreKeywords = inputCoreKeywords.length
    ? [...inputCoreKeywords, ...validSelectedCoreKeywords]
    : (validSelectedCoreKeywords.length ? validSelectedCoreKeywords : coreKeywords);
  const requestedUniqueCoreKeywords = [...new Map(requestedCoreKeywords.map((item) => [item.id, item])).values()];
  const selectedCoreKeywords = requestedUniqueCoreKeywords.slice(0, 8);
  if (selectedIds.size && !validSelectedCoreKeywords.length) ui.selectedCoreKeywordIds = [];
  if (!selectedCoreKeywords.length) {
    ui.businessKeywordError = "请输入一个核心关键词，或勾选下方已有核心关键词。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  if (requestedUniqueCoreKeywords.length > 8) {
    ui.businessKeywordError = "本次输入和勾选的核心关键词合计不能超过 8 个。";
    render();
    return document.getElementById("business-keyword-input")?.focus();
  }
  let providerId = selectedTextProviderId();
  if (!providerId) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中绑定默认文本模型。", "error");
  if (newCoreKeywords.length) state.keywords.unshift(...newCoreKeywords);
  ui.selectedCoreKeywordIds = selectedCoreKeywords.map((item) => item.id);
  ui.businessKeywordInput = "";
  ui.businessKeywordError = "";
  ui.seedExpanding = true;
  saveState();
  render();
  try {
    const existingSeeds = state.keywords.filter((item) => item.businessLineId === line.id && item.status === "active" && isSeedKeyword(item)).map((item) => item.term);
    const payload = await aiApi("/api/ai/generate/seeds", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: aiBusinessLinePayload(line),
        coreKeywords: selectedCoreKeywords.map((item) => item.term),
        existingSeeds,
        count: 8
      }
    });
    const data = payload.data || payload;
    const rawSeeds = data.seeds || data.items || [];
    if (!Array.isArray(rawSeeds) || !rawSeeds.length) throw new Error("模型没有返回可用的种子词");
    const existing = new Set(existingSeeds.map((term) => term.toLowerCase()));
    const added = rawSeeds.map((item, index) => {
      const term = String(item?.term || item?.keyword || item?.name || "").trim().slice(0, 80);
      if (!term || existing.has(term.toLowerCase())) return null;
      existing.add(term.toLowerCase());
      const sourceKeyword = String(item?.sourceKeyword || item?.source_keyword || selectedCoreKeywords[0].term).trim();
      const sourceCore = selectedCoreKeywords.find((keyword) => keyword.term.toLowerCase() === sourceKeyword.toLowerCase()) || selectedCoreKeywords[0];
      return {
        id: uid("KW-SEED") + index,
        businessLineId: line.id,
        term,
        type: "种子词",
        keywordRole: "seed",
        source: "AI 智能拓展",
        sourceCoreKeywordIds: [sourceCore.id],
        sourceCoreKeywords: [sourceCore.term],
        reason: String(item?.reason || "由核心关键词智能拓展").slice(0, 240),
        relevance: scoreTo100(item?.relevance),
        business: scoreTo100(item?.business),
        scoreSource: String(item?.scoreSource || "").trim() || null,
        generationRunId: item?.generationRunId || data.generationRunId || data.runId || null,
        selected: true,
        status: "active",
        createdAt: now,
        updatedAt: now
      };
    }).filter(Boolean).slice(0, 8);
    if (!added.length) throw new Error("模型返回的种子词都已存在，请调整核心关键词后重试");
    state.keywords.unshift(...added);
    ui.seedInput = added.map((item) => item.term).join("，");
    ui.seedError = "";
    ui.seedExpanding = false;
    saveState();
    render();
    showToast("种子词拓展完成", `已根据核心关键词生成 ${added.length} 个种子词，可编辑确认后生成问题词包。`);
  } catch (error) {
    ui.seedExpanding = false;
    saveState();
    render();
    showToast("种子词拓展失败", error.message || "模型没有返回可用种子词，请检查模型配置后重试。", "error");
  }
}

async function editSeedKeyword(keywordId) {
  const keyword = state.keywords.find((item) => item.id === keywordId && isSeedKeyword(item));
  if (!keyword) return;
  const nextTerm = (await uiPrompt("编辑种子词", "种子词", keyword.term)) || "";
  if (!nextTerm || nextTerm === keyword.term) return;
  if (nextTerm.length > 80) return showToast("种子词过长", "单个种子词不能超过 80 个字。", "error");
  const duplicate = state.keywords.some((item) => item.id !== keyword.id && item.businessLineId === keyword.businessLineId && item.status === "active" && item.term.toLowerCase() === nextTerm.toLowerCase());
  if (duplicate) return showToast("种子词已存在", "请修改为其他表达。", "error");
  const terms = ui.seedInput.split(/[，,;\n]/).map((item) => item.trim()).filter(Boolean).map((term) => term.toLowerCase() === keyword.term.toLowerCase() ? nextTerm : term);
  keyword.term = nextTerm;
  keyword.updatedAt = Date.now();
  ui.seedInput = [...new Set(terms)].slice(0, 8).join("，");
  saveState();
  render();
  showToast("种子词已修改", "后续生成的问题词包将使用新的种子词表达。");
}



async function generateQuestionPack() {
  const seeds = ui.seedInput.split(/[，,;\n]/).map((seed) => seed.trim()).filter(Boolean);
  const unique = [...new Set(seeds)].map((seed) => seed.slice(0, 40));
  const line = activeBusinessLine();
  if (!unique.length) {
    ui.seedError = "请至少输入 1 个种子词。";
    render();
    document.getElementById("seed-input")?.focus();
    return;
  }
  if (unique.length > 8) {
    ui.seedError = "一次最多输入 8 个种子词，请减少后再试。";
    render();
    document.getElementById("seed-input")?.focus();
    return;
  }
  let providerId = selectedTextProviderId();
  if (!providerId) {
    await refreshAiProviders();
    providerId = selectedTextProviderId();
  }
  if (!providerId) {
    return showToast("尚未配置文本模型", "请先在系统设置 → 模型与 API 中添加供应商，并绑定默认文本模型。", "error");
  }
  ui.seedError = "";
  ui.expanding = true;
  const businessLineId = line.id;
  const businessLineName = line.name;
  render();
  try {
    const payload = await aiApi("/api/ai/generate/questions", {
      method: "POST",
      body: {
        providerId,
        model: selectedTextModelName(),
        businessLine: aiBusinessLinePayload(line),
        seeds: unique,
        existingQuestions: state.questionLibrary.filter((item) => item.businessLineId === businessLineId && item.status !== "archived").map((item) => item.question).slice(0, 100),
        dimensions: DIMENSIONS.filter((dimension) => dimension.id !== "all").map((dimension) => dimension.id)
      }
    });
    const data = payload.data || payload;
    const rawQuestions = data.questions || data.customerQuestions || data.items || [];
    if (!Array.isArray(rawQuestions) || !rawQuestions.length) throw new Error("模型没有返回问题候选");
    const packId = uid("KP");
    const existingKeywords = new Set(state.keywords.filter((item) => item.businessLineId === businessLineId && item.status === "active").map((item) => item.term.toLowerCase()));
    const sourceCoreIds = (ui.selectedCoreKeywordIds || []).filter((id) => state.keywords.some((item) => item.id === id && item.businessLineId === businessLineId && !isSeedKeyword(item)));
    const sourceCoreKeywords = sourceCoreIds.map((id) => state.keywords.find((item) => item.id === id)?.term).filter(Boolean);
    const seedKeywords = unique.filter((seed) => !existingKeywords.has(seed.toLowerCase())).map((term, index) => ({ id: uid("KW") + index, businessLineId, term, type: "种子词", keywordRole: "seed", source: "手动补充", sourceCoreKeywordIds: sourceCoreIds, sourceCoreKeywords, status: "active", selected: true, createdAt: Date.now() }));
    const seedSourceByTerm = new Map([
      ...state.keywords.filter((item) => item.businessLineId === businessLineId && item.status === "active" && isSeedKeyword(item)),
      ...seedKeywords
    ].map((item) => [item.term.toLowerCase(), item]));
    const questions = [];
    const invalidQuestions = [];
    rawQuestions.forEach((item, index) => {
      try {
        const question = normalizeAiQuestionCandidate(item, index, packId, businessLineId, unique, data.generationRunId || data.runId || null);
        const sourceSeed = seedSourceByTerm.get(question.sourceKeyword.toLowerCase()) || null;
        const coreIds = [...new Set(sourceSeed?.sourceCoreKeywordIds || sourceCoreIds)];
        const coreTerms = [...new Set(sourceSeed?.sourceCoreKeywords || sourceCoreKeywords)];
        question.sourceSeedKeywordId = sourceSeed?.id || null;
        question.sourceSeedKeyword = sourceSeed?.term || question.sourceKeyword;
        question.sourceCoreKeywordIds = coreIds;
        question.sourceCoreKeywords = coreTerms;
        question.sourceChain = { businessLineId, coreKeywordIds: coreIds, coreKeywords: coreTerms, seedKeywordId: sourceSeed?.id || null, seedKeyword: sourceSeed?.term || question.sourceKeyword, packId };
        questions.push(question);
      } catch (error) {
        invalidQuestions.push({ index, message: error.message || "问题结构不完整" });
      }
    });
    if (!questions.length) throw new Error(invalidQuestions[0]?.message || "模型没有返回可入库的问题候选");
    const counts = Object.fromEntries(DIMENSIONS.filter((dimension) => dimension.id !== "all").map((dimension) => [dimension.id, questions.filter((question) => question.dimension === dimension.id).length]));
    const missing = Object.entries(counts).filter(([, count]) => count !== QUESTION_VARIANT_LIMIT);
    state.keywords.unshift(...seedKeywords);
    const packCoreKeywords = [...new Set(questions.flatMap((question) => question.sourceCoreKeywords || []))];
    state.keywordPacks.unshift({ id: packId, businessLineId, title: unique[0] + (unique.length > 1 ? " 等 " + unique.length + " 个词" : "") + " · " + businessLineName, seeds: unique, coreKeywords: packCoreKeywords, source: "AI 生成问题词包", total: questions.length, generationRunId: data.generationRunId || data.runId || null, createdAt: Date.now() });
    state.questionLibrary.unshift(...questions);
    ui.selectedPackId = packId;
    ui.planningCategory = "all";
    ui.expanding = false;
    saveState();
    render();
    const warnings = [];
    if (missing.length) warnings.push("栏目数量不足：" + missing.map(([dimension, count]) => `${dimension}=${count}`).join("、"));
    if (invalidQuestions.length) warnings.push(`${invalidQuestions.length} 条无效结果已跳过`);
    if (warnings.length) {
      showToast("问题词包已部分生成", `已保存 ${questions.length} 个有效候选；${warnings.join("；")}。可先使用当前结果，或重新生成补充。`, "warning");
    } else {
      showToast("问题词包生成完成", `模型已按 8 个栏目各生成 5 个客户问题，共 ${questions.length} 个候选；请勾选后加入问题词库。`);
    }
  } catch (error) {
    ui.expanding = false;
    saveState();
    render();
    showToast("问题词包生成失败", error.message || "模型未返回可用的结构化问题，请检查模型配置后重试。", "error");
  }
}

function generateArticlesFromTopics() {
  return openContentPlan();
}

function updateKeywordPackTotal(pack) {
  if (!pack) return;
  pack.total = state.questionLibrary.filter((question) => question.packId === pack.id && question.status === "candidate").length;
}

function removeKeywordCandidates(questionIds, options = {}) {
  const line = activeBusinessLine();
  const ids = new Set((questionIds || []).filter(Boolean));
  const pack = state.keywordPacks.find((item) => item.id === options.packId && item.businessLineId === line?.id);
  if (!line || !pack || !ids.size) return showToast("没有可删除的候选", "请先选择当前业务线词包中的候选问题。", "error");
  const candidates = state.questionLibrary.filter((question) => {
    if (!ids.has(question.id) || question.businessLineId !== line.id || question.packId !== pack.id || question.status !== "candidate") return false;
    const dimension = options.dimension || "all";
    return dimension === "all" || question.dimension === dimension;
  });
  if (!candidates.length) return showToast("没有可删除的候选", "已入问题词库的问题不会被此操作删除。", "error");
  const blocked = candidates.filter((question) => {
    const refs = planningQuestionReferences(question);
    return refs.topics.length || refs.plans.length || refs.articles.length;
  });
  const removable = candidates.filter((question) => !blocked.includes(question));
  if (!removable.length) return showToast("候选已有引用", "请先在问题词库或归档管理中处理引用关系。", "error");
  const deletedCandidateCounts = pack.deletedCandidateCounts && typeof pack.deletedCandidateCounts === "object" ? pack.deletedCandidateCounts : {};
  removable.forEach((question) => {
    const dimension = question.dimension || "question";
    deletedCandidateCounts[dimension] = (Number(deletedCandidateCounts[dimension]) || 0) + 1;
    question.selected = false;
  });
  const removableIds = new Set(removable.map((question) => question.id));
  state.questionLibrary = state.questionLibrary.filter((question) => !removableIds.has(question.id));
  pack.deletedCandidateCounts = deletedCandidateCounts;
  pack.autoFillSuppressed = true;
  updateKeywordPackTotal(pack);
  const currentLinePacks = state.keywordPacks.filter((item) => item.businessLineId === line.id);
  if (!currentLinePacks.some((item) => item.id === ui.selectedPackId)) ui.selectedPackId = currentLinePacks[0]?.id || null;
  saveState();
  render();
  const suffix = blocked.length ? `，另有 ${blocked.length} 条因存在引用而保留` : "";
  showToast(options.bulk ? "候选问题已批量删除" : "候选问题已删除", `已从当前词包移除 ${removable.length} 条候选${suffix}。`, blocked.length ? "warning" : "success");
}

async function deleteKeywordCandidate(questionId) {
  if (!(await uiConfirm("确认删除该候选问题？"))) return;
  const question = state.questionLibrary.find((item) => item.id === questionId);
  if (!question || question.status !== "candidate") return showToast("不能删除正式问题", "只有候选问题可以删除。", "error");
  return removeKeywordCandidates([questionId], { packId: question.packId, dimension: question.dimension, bulk: false });
}

function deleteKeywordCandidates(packId, dimension = "all") {
  const line = activeBusinessLine();
  const candidates = state.questionLibrary.filter((question) => question.businessLineId === line?.id && question.packId === packId && question.status === "candidate" && question.selected && (dimension === "all" || question.dimension === dimension));
  return removeKeywordCandidates(candidates.map((question) => question.id), { packId, dimension, bulk: true });
}

async function deleteKeywordPack(packId) {
  const line = activeBusinessLine();
  const pack = state.keywordPacks.find((item) => item.id === packId && item.businessLineId === line?.id);
  if (!pack) return showToast("历史词包不存在", "请刷新页面后重试。", "error");
  const questions = state.questionLibrary.filter((question) => question.packId === pack.id && question.businessLineId === line.id);
  const linkedOrSaved = questions.filter((question) => {
    const refs = planningQuestionReferences(question);
    return question.status !== "candidate" || refs.topics.length || refs.plans.length || refs.articles.length;
  });
  const removableIds = new Set(questions.filter((question) => !linkedOrSaved.includes(question)).map((question) => question.id));
  const confirmText = linkedOrSaved.length
    ? `确认删除历史词包“${pack.title}”？未入库候选将删除，已有 ${linkedOrSaved.length} 个正式问题或引用记录会继续保留。`
    : `确认删除历史词包“${pack.title}”及其中 ${removableIds.size} 个候选问题？`;
  if (!await uiConfirm(confirmText)) return;
  state.questionLibrary = state.questionLibrary.filter((question) => !removableIds.has(question.id));
  linkedOrSaved.forEach((question) => {
    question.sourcePackTitle = question.sourcePackTitle || pack.title;
    question.packId = null;
  });
  state.keywordPacks = state.keywordPacks.filter((item) => item.id !== pack.id);
  const nextPack = state.keywordPacks.find((item) => item.businessLineId === line.id);
  ui.selectedPackId = nextPack?.id || null;
  ui.planningCategory = "all";
  saveState();
  render();
  showToast("历史词包已删除", linkedOrSaved.length ? `已删除 ${removableIds.size} 个未入库候选；${linkedOrSaved.length} 个正式问题及引用关系已保留。` : "词包及未入库候选问题已删除。");
}

function exportPlanningPack() {
  const line = activeBusinessLine();
  const packs = state.keywordPacks.filter((pack) => pack.businessLineId === line?.id);
  const pack = packs.find((item) => item.id === ui.selectedPackId) || packs[0];
  if (!pack) return showToast("没有可导出的词包", "请先添加关键词并执行一次智能拓展。", "error");
  const questions = state.questionLibrary.filter((question) => question.packId === pack.id && question.businessLineId === line?.id);
  if (!questions.length) return showToast("词包中没有问题", "当前词包没有可导出的拓展结果。", "error");
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["问题编号", "问题", "来源关键词", "内容方向", "状态", "建议强度"],
    ...questions.map((question) => [
      question.id,
      question.question,
      question.sourceKeyword,
      DIMENSIONS.find((item) => item.id === question.dimension)?.label || question.dimension,
      question.status === "candidate" ? "候选问题" : question.status === "active" ? "问题词库" : "已归档",
      question.recommendation || ""
    ])
  ];
  const blob = new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `${String(pack.title || "关键词拓展").replace(/[\\/:*?"<>|]+/g, "-")}-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("词包已导出", `已导出「${pack.title}」的 ${questions.length} 条问题及来源状态。`);
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
