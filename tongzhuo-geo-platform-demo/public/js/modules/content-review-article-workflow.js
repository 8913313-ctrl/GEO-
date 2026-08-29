// Article editing, review, and immediate publishing workflow.
// Kept as a classic-script module to preserve the existing global action API.

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
