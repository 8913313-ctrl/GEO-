
function renderSitePageTreeItem(item, currentPageId, extension = false) {
  const icon = item.id === "home" ? "home" : item.id === "insights" ? "file" : item.id === "contact" ? "message" : item.id === "cases" ? "clipboard" : item.id === "problem-map" ? "help" : "layout";
  const statusText = item.status === "published" ? "已发布" : item.status === "archived" ? "已归档" : "草稿";
  const statusClass = item.status === "published" ? "" : " draft";
  return `<button class="site-tree-item ${item.id === currentPageId ? "active" : ""}" type="button" data-action="site-page" data-page-id="${escapeHtml(item.id)}"><span class="site-tree-icon" data-icon="${icon}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.path)}${extension ? " · 扩展页面" : ""}</small></span><i class="site-tree-status${statusClass}">${statusText}</i></button>`;
}

function renderSitePages() {
  const page = sitePageDefinition();
  const primaryPages = sitePrimaryPages();
  const extensionPages = siteExtensionPages();
  const modules = siteModules(page.id);
  return `
    <div class="site-page-toolbar"><div><h2>页面管理</h2><p>固定模板 + 语义模块，保证页面可编辑、可预览、可回滚。</p></div><div class="modal-foot-right"><button class="secondary-button button-small" type="button" data-action="site-new-page"><span data-icon="plus"></span>新建专题页</button><button class="primary-button button-small" type="button" data-action="site-page-save"><span data-icon="check"></span>保存页面</button></div></div>
    <div class="site-page-manager">
      <aside class="card site-page-tree"><div class="card-header"><div><h3>页面树</h3><p>${primaryPages.length} 个主站页面 · ${primaryPages.filter((item) => item.status === "published").length} 个已发布</p></div></div><div class="site-tree-list"><div class="site-tree-group-label">主站页面</div>${primaryPages.map((item) => renderSitePageTreeItem(item, page.id)).join("")}${extensionPages.length ? `<div class="site-tree-group-label">扩展页面 <small>不进入默认一级导航</small></div>${extensionPages.map((item) => renderSitePageTreeItem(item, page.id, true)).join("")}` : ""}</div></aside>
      <section class="card site-page-editor"><div class="card-header"><div><span class="small-tag">${escapeHtml(page.type)}</span><h3>${escapeHtml(page.title)}</h3><p>${escapeHtml(page.description)}</p></div><button class="secondary-button button-small" type="button" data-action="site-page-preview" data-page-id="${escapeHtml(page.id)}"><span data-icon="eye"></span>预览页面</button></div><div class="site-editor-canvas"><div class="site-editor-canvas-head"><span>页面模块</span><small>每个模块可编辑内容来源与展示状态</small></div>${modules.map((module, index) => `<div class="site-module-row"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><span class="site-module-grip">⋮⋮</span><div class="site-module-copy"><b>${escapeHtml(module.title)}</b><small>${escapeHtml(module.description)}</small><em>内容来源：${escapeHtml(module.source)}</em></div><span>${module.status === "published" ? statusBadge("published") : statusBadge("draft")}</span><button class="icon-button" type="button" data-action="site-module-edit" data-page-id="${escapeHtml(page.id)}" data-module-id="${escapeHtml(module.id)}" aria-label="编辑模块"><span data-icon="edit"></span></button></div>`).join("")}<button class="site-add-module" type="button" data-action="site-module-add" data-page-id="${escapeHtml(page.id)}"><span data-icon="plus"></span>添加语义模块</button></div></section>
       <aside class="card site-page-settings"><div class="card-header"><div><h3>页面设置</h3><p>页面级状态、SEO 与 AI 信号</p></div></div><div class="card-body"><div class="field"><label for="site-page-title">页面标题</label><input class="input" id="site-page-title" value="${escapeHtml(page.title)}" /></div><div class="field"><label for="site-page-path">页面路径</label><input class="input" id="site-page-path" value="${escapeHtml(page.path)}" /></div><div class="field"><label for="site-page-status">页面状态</label><select class="select" id="site-page-status"><option value="published" ${page.status === "published" ? "selected" : ""}>已发布</option><option value="draft" ${page.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${page.status === "archived" ? "selected" : ""}>已归档</option></select><small class="field-help">草稿和已归档页面不会出现在正式官网、导航、sitemap 或 AI 机器入口。</small></div><div class="field"><label for="site-page-seo">SEO 描述</label><textarea class="textarea" id="site-page-seo" rows="4">${escapeHtml(page.seoDescription || page.description)}</textarea></div><div class="setting-row"><div><b>自动生成结构化数据</b><small>${escapeHtml(page.type)} 模板自动生成对应 Schema</small></div><label class="toggle ${page.schemaEnabled !== false ? "on" : ""}"><input type="checkbox" id="site-page-schema" ${page.schemaEnabled !== false ? "checked" : ""} /><span></span></label></div><div class="setting-row"><div><b>加入站点地图</b><small>发布后自动更新 sitemap</small></div><label class="toggle ${page.sitemapEnabled !== false ? "on" : ""}"><input type="checkbox" id="site-page-sitemap" ${page.sitemapEnabled !== false ? "checked" : ""} /><span></span></label></div><div class="site-page-version"><span data-icon="history"></span><span><b>当前草稿 v${escapeHtml(page.version || 1)}</b><small>整站发布后可在发布历史中查看和回滚</small></span><button class="link-button" type="button" data-action="site-show-releases">查看发布历史</button></div></div></aside>
    </div>
  `;
}

function renderSiteCatalog() {
  const services = siteServices();
  const cases = siteCases();
  const isServices = ui.siteCatalogTab !== "cases";
  const serviceRows = services.map((item, index) => `<tr><td><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span></td><td class="article-title-cell"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.eyebrow || "SERVICE")}</small></td><td>${escapeHtml(item.audience || "待补充适用对象")}</td><td>${escapeHtml(item.focus || "待补充工作重点")}</td><td>${siteRecordStatus(item.status)}</td><td><button class="link-button" type="button" data-action="site-edit-service" data-service-id="${escapeHtml(item.id)}">编辑</button></td></tr>`).join("");
  const caseRows = cases.map((item, index) => `<tr><td><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span></td><td class="article-title-cell"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary || "等待补充案例摘要")}</small></td><td><span class="source-tag">${escapeHtml(item.industry || "待归类")}</span></td><td>${escapeHtml(item.service || "待关联服务")}</td><td>${escapeHtml(item.result || "待补充形成结果")}</td><td>${siteRecordStatus(item.status)}</td><td><button class="link-button" type="button" data-action="site-edit-case" data-case-id="${escapeHtml(item.id)}">编辑</button></td></tr>`).join("");
  return `<div class="site-page-toolbar"><div><h2>服务与案例</h2><p>维护官网产品与服务、公开案例和实施结果。只有公开状态的数据进入正式官网。</p></div><button class="primary-button button-small" type="button" data-action="${isServices ? "site-add-service" : "site-add-case"}"><span data-icon="plus"></span>${isServices ? "新增服务" : "新增案例"}</button></div><section class="card site-source-note"><span class="site-source-note-icon" data-icon="info"></span><div><b>服务和案例属于官网正式信源</b><p>案例需要完成客户授权、脱敏与人工核对；归档只会从官网隐藏，不会丢失历史发布版本。</p></div><span class="small-tag blue">随整站发布</span></section><div class="site-content-tabs"><button class="site-content-tab ${isServices ? "active" : ""}" type="button" data-action="site-catalog-tab" data-tab="services">产品与服务 <small>${services.length}</small></button><button class="site-content-tab ${!isServices ? "active" : ""}" type="button" data-action="site-catalog-tab" data-tab="cases">服务案例 <small>${cases.length}</small></button></div><section class="card table-card"><div class="table-scroll"><table class="data-table"><thead><tr>${isServices ? "<th>排序</th><th>服务</th><th>适合对象</th><th>工作重点</th><th>状态</th><th></th>" : "<th>排序</th><th>案例</th><th>行业</th><th>服务方向</th><th>形成结果</th><th>状态</th><th></th>"}</tr></thead><tbody>${isServices ? serviceRows : caseRows}</tbody></table></div>${(isServices ? services : cases).length ? "" : '<div class="empty-state compact"><div><span data-icon="layout"></span><h3>还没有官网内容</h3><p>新增后先保存到草稿，预览确认后再统一发布官网。</p></div></div>'}</section>`;
}

const SITE_CONTENT_KIND_LABELS = Object.freeze({
  offering: "产品 / 服务", proof: "案例 / 证据", credential: "资质 / 认证", partner: "客户 / 合作方",
  testimonial: "客户评价", person: "团队成员", scene: "业务场景", faq: "常见问题", media: "媒体资料"
});
const SITE_CONTENT_KINDS = Object.freeze(Object.keys(SITE_CONTENT_KIND_LABELS));

function siteContentItems(includeArchived = false) {
  const items = Array.isArray(siteCms().contentItems) ? siteCms().contentItems : [];
  return items.filter((item) => includeArchived || item.status !== "archived").sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function siteContentJson(value) {
  return JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {}, null, 2);
}

function parseSiteContentJson(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function renderSiteContentCenter() {
  const kind = ui.siteContentKind || "all";
  const keyword = String(ui.siteContentSearch || "").trim().toLowerCase();
  const items = siteContentItems(true).filter((item) => {
    if (kind !== "all" && item.kind !== kind) return false;
    if (!keyword) return true;
    return [item.title, item.summary, item.description, item.tags?.join(" "), JSON.stringify(item.facts || {})].join(" ").toLowerCase().includes(keyword);
  });
  const allItems = siteContentItems(true);
  const rows = items.map((item, index) => `<tr><td><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span></td><td class="article-title-cell"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary || item.description || "暂无摘要")}</small></td><td><span class="source-tag">${escapeHtml(SITE_CONTENT_KIND_LABELS[item.kind] || item.kind || "未分类")}</span></td><td>${item.image ? "有图片" : "无图片"}<small class="table-subtext">${Object.keys(item.facts || {}).length} 个事实字段</small></td><td>${siteRecordStatus(item.status)}</td><td><button class="link-button" type="button" data-action="site-edit-content-item" data-content-item-id="${escapeHtml(item.id)}">编辑</button>${item.status !== "archived" ? `<button class="link-button danger-link" type="button" data-action="site-archive-content-item" data-content-item-id="${escapeHtml(item.id)}">归档</button>` : ""}</td></tr>`).join("");
  const kindOptions = [["all", "全部类型"], ...SITE_CONTENT_KINDS.map((entry) => [entry, SITE_CONTENT_KIND_LABELS[entry]])].map(([value, label]) => `<option value="${escapeHtml(value)}" ${kind === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  return `<div class="site-page-toolbar"><div><h2>通用内容中心</h2><p>所有模板共用这一套内容数据。资质、客户、项目、评价和施工日志都作为内容条目的事实字段管理。</p></div><button class="primary-button button-small" type="button" data-action="site-add-content-item"><span data-icon="plus"></span>新增内容</button></div><section class="card site-source-note"><span class="site-source-note-icon" data-icon="layers"></span><div><b>展示层与内容层已分离</b><p>切换 11 套模板只改变页面结构和视觉表达，不会复制内容，也不需要为某个行业新增数据库字段。客户确认后再把状态改为公开并发布官网。</p></div><span class="small-tag blue">${allItems.length} 条通用内容</span></section><section class="card table-card"><div class="card-header"><div><h3>内容条目</h3><p>用“类型 + 通用字段 + facts 扩展字段”覆盖不同企业，不把 UPS、建筑等行业写死在数据库里。</p></div><div class="card-header-tools"><select class="select" data-site-content-kind>${kindOptions}</select><input class="input" placeholder="搜索标题 / 摘要 / 事实字段" value="${escapeHtml(ui.siteContentSearch || "")}" data-site-content-search /></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>排序</th><th>内容</th><th>类型</th><th>媒体 / 事实</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td class="empty-cell" colspan="6">暂无匹配内容，点击“新增内容”开始建立企业事实。</td></tr>'}</tbody></table></div></section>`;
}

function renderSiteContentItemModal() {
  const item = ui.modal?.contentItemId ? siteContentItems(true).find((entry) => entry.id === ui.modal.contentItemId) : null;
  const isNew = !item;
  const kind = item?.kind || "offering";
  const kindOptions = SITE_CONTENT_KINDS.map((entry) => `<option value="${escapeHtml(entry)}" ${kind === entry ? "selected" : ""}>${escapeHtml(SITE_CONTENT_KIND_LABELS[entry])}</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新增通用内容" : "编辑通用内容"}</h2><p>字段属于所有企业官网模板共享的数据契约。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-content-title">标题 *</label><input class="input" id="site-content-title" value="${escapeHtml(item?.title || "")}" placeholder="例如：数据中心 UPS 供电项目" /></div><div class="field"><label for="site-content-kind">内容类型</label><select class="select" id="site-content-kind">${kindOptions}</select></div></div><div class="field"><label for="site-content-summary">摘要</label><textarea class="textarea" id="site-content-summary" rows="3" placeholder="用于卡片、列表和搜索摘要">${escapeHtml(item?.summary || "")}</textarea></div><div class="field"><label for="site-content-description">详细说明 / 正文</label><textarea class="textarea" id="site-content-description" rows="5" placeholder="填写客户确认后的公开说明，不要把未确认的演示数据标为公开。">${escapeHtml(item?.description || item?.content || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-content-image">主图地址</label><input class="input" id="site-content-image" value="${escapeHtml(item?.image || "")}" placeholder="/assets/... 或 https://..." /></div><div class="field"><label for="site-content-image-alt">图片说明</label><input class="input" id="site-content-image-alt" value="${escapeHtml(item?.imageAlt || "")}" /></div></div><div class="field"><label for="site-content-gallery">图集地址（每行一个）</label><textarea class="textarea" id="site-content-gallery" rows="3">${escapeHtml((item?.gallery || []).join("\n"))}</textarea></div><div class="field"><label for="site-content-tags">标签（逗号分隔）</label><input class="input" id="site-content-tags" value="${escapeHtml((item?.tags || []).join("、"))}" placeholder="例如：国家一级资质、LEED、数据中心" /></div><div class="field-row"><div class="field"><label for="site-content-order">排序</label><input class="input" id="site-content-order" type="number" min="1" value="${escapeHtml(item?.order || siteContentItems(true).length + 1)}" /></div><div class="field"><label for="site-content-status">公开状态</label><select class="select" id="site-content-status"><option value="published" ${item?.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${!item || item?.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>归档</option></select></div></div><div class="field-row"><div class="field"><label for="site-content-facts">事实字段 facts（JSON）</label><textarea class="textarea" id="site-content-facts" rows="9" spellcheck="false" placeholder="{\n  &quot;client&quot;: &quot;客户名称&quot;,\n  &quot;area&quot;: &quot;工程面积&quot;,\n  &quot;amount&quot;: &quot;项目金额&quot;,\n  &quot;duration&quot;: &quot;项目周期&quot;\n}">${escapeHtml(siteContentJson(item?.facts))}</textarea><small class="field-help">这里承载行业差异信息，例如客户名称、工程面积、项目金额、施工日志、证书编号；不用改数据库结构。</small></div><div class="field"><label for="site-content-metadata">扩展 metadata（JSON）</label><textarea class="textarea" id="site-content-metadata" rows="9" spellcheck="false">${escapeHtml(siteContentJson(item?.metadata))}</textarea><small class="field-help">仅填写可公开的辅助信息，例如来源、确认人、更新时间。</small></div></div></div><div class="modal-foot"><span>保存进入官网草稿；只有发布后才会影响正式官网。</span><div class="modal-foot-right">${item && item.status !== "archived" ? `<button class="danger-button" type="button" data-action="site-archive-content-item" data-content-item-id="${escapeHtml(item.id)}">归档</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-content-item" data-content-item-id="${escapeHtml(item?.id || "")}"><span data-icon="check"></span>保存内容</button></div></div>`, { wide: true });
}

async function saveSiteContentItem(itemId) {
  const title = siteValue("site-content-title");
  const kindValue = siteValue("site-content-kind");
  const kind = SITE_CONTENT_KINDS.includes(kindValue) ? kindValue : "media";
  if (!title) return showToast("请填写内容标题", "标题不能为空。", "error");
  const facts = parseSiteContentJson(siteValue("site-content-facts"));
  const metadata = parseSiteContentJson(siteValue("site-content-metadata"));
  if (!facts || !metadata) return showToast("JSON 格式不正确", "请检查 facts 和 metadata 是否为合法 JSON 对象。", "error");
  const cms = siteCms();
  if (!Array.isArray(cms.contentItems)) cms.contentItems = [];
  const existing = cms.contentItems.find((entry) => entry.id === itemId);
  const titleValue = title.slice(0, 240);
  const values = { id: itemId || uid("CONTENT"), kind, title: titleValue, summary: siteValue("site-content-summary"), description: siteValue("site-content-description"), content: siteValue("site-content-description"), image: siteValue("site-content-image"), imageAlt: siteValue("site-content-image-alt") || titleValue, gallery: siteValue("site-content-gallery").split(/\r?\n|[,，、;；|]/).map((entry) => entry.trim()).filter(Boolean), tags: siteValue("site-content-tags").split(/[,，、;；|]/).map((entry) => entry.trim()).filter(Boolean), facts, metadata, order: Math.max(1, Number.parseInt(siteValue("site-content-order"), 10) || cms.contentItems.length + 1), status: siteValue("site-content-status") || "draft", updatedAt: siteNow() };
  if (existing) Object.assign(existing, values); else cms.contentItems.push(values);
  saveState();
  try { await commitSiteCmsDraft(); } catch { return; }
  closeModal();
  render();
  showToast(existing ? "通用内容已更新" : "通用内容已新增", "内容已进入官网草稿，发布后才会对外显示。", "success");
}

async function archiveSiteContentItem(itemId) {
  if (!(await uiConfirm("确认归档该通用内容？归档后不会出现在正式官网。"))) return;
  const item = siteContentItems(true).find((entry) => entry.id === itemId);
  if (!item) return showToast("内容不存在", "请刷新页面后重试。", "error");
  item.status = "archived";
  item.updatedAt = siteNow();
  saveState();
  try { await commitSiteCmsDraft(); } catch { return; }
  closeModal();
  render();
  showToast("通用内容已归档", "历史发布版本仍然保留，下一次发布后正式官网会隐藏该内容。", "success");
}

function renderSiteProblems() {
  const groups = siteProblemGroups();
  const questionCount = groups.reduce((sum, group) => sum + (group.questions || []).length, 0);
  const sections = groups.map((group, groupIndex) => `<section class="card site-problem-admin-group"><div class="card-header"><div><span class="small-tag">${String(groupIndex + 1).padStart(2, "0")}</span><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.service)} · ${escapeHtml(group.description || "等待补充分组说明")}</p></div><div class="modal-foot-right">${siteRecordStatus(group.status)}<button class="secondary-button button-small" type="button" data-action="site-edit-problem-group" data-group-id="${escapeHtml(group.id)}">编辑分组</button><button class="primary-button button-small" type="button" data-action="site-add-question" data-group-id="${escapeHtml(group.id)}"><span data-icon="plus"></span>新增问题</button></div></div><div class="site-problem-admin-list">${(group.questions || []).map((question, index) => `<div class="site-problem-admin-row"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(question.title)}</b><small>${escapeHtml(question.answer || "等待补充直接回答")}</small><em>/problem-map/${escapeHtml(question.slug)}/ · ${escapeHtml((question.industries || []).join("、") || "未设置行业")}</em></div>${siteRecordStatus(question.status)}<button class="link-button" type="button" data-action="site-edit-question" data-group-id="${escapeHtml(group.id)}" data-question-id="${escapeHtml(question.id)}">编辑</button></div>`).join("") || '<div class="empty-state compact"><div><h3>分组内还没有问题</h3><p>新增问题后填写直接回答和适用行业。</p></div></div>'}</div></section>`).join("");
  return `<div class="site-page-toolbar"><div><h2>问题地图</h2><p>把客户真实提问组织成可公开、可引用、可进入问题详情页的直接回答。</p></div><button class="primary-button button-small" type="button" data-action="site-add-problem-group"><span data-icon="plus"></span>新增问题分组</button></div><section class="card site-source-note"><span class="site-source-note-icon" data-icon="info"></span><div><b>${groups.length} 个问题分组 · ${questionCount} 个客户问题</b><p>问题标题、直接回答、所属行业和关联文章进入正式 CMS 版本；草稿问题只在后台预览中显示。</p></div><button class="secondary-button button-small" type="button" data-action="site-page-preview" data-page-id="problem-map"><span data-icon="eye"></span>预览问题地图</button></section><div class="site-problem-admin-groups">${sections || '<section class="card empty-state"><div><span data-icon="help"></span><h3>还没有问题分组</h3><p>先建立 GEO 服务、企业 AI 落地或其他业务方向的问题分组。</p></div></section>'}</div>`;
}

function renderSiteInsights() {
  const articles = (state.articles || []).filter((article) => ui.siteCategoryFilter === "all" || article.siteCategory === ui.siteCategoryFilter || article.category === ui.siteCategoryFilter);
  const categories = siteCategories();
  return `
    <div class="site-page-toolbar"><div><h2>行业资讯</h2><p>正文在内容生产中心完成；这里管理主栏目、标签、官网字段和发布状态。</p></div><div class="modal-foot-right"><button class="secondary-button button-small" type="button" data-action="site-category-action"><span data-icon="layers"></span>管理栏目</button><button class="primary-button button-small" type="button" data-action="site-content-production"><span data-icon="edit"></span>去内容生产</button></div></div>
    <section class="card site-source-note"><span class="site-source-note-icon" data-icon="info"></span><div><b>官网文章的唯一写作入口是“内容生产中心”</b><p>审核通过后，文章才会出现在这里。官网 CMS 可补充主栏目、标签、摘要、封面、SEO 和 URL，不复制另一套正文编辑器。</p></div><span class="small-tag blue">审核冻结后发布</span></section>
    <div class="site-content-tabs"><button class="site-content-tab ${ui.siteContentTab === "articles" ? "active" : ""}" type="button" data-action="site-content-tab" data-tab="articles">文章列表 <small>${state.articles.length}</small></button><button class="site-content-tab ${ui.siteContentTab === "categories" ? "active" : ""}" type="button" data-action="site-content-tab" data-tab="categories">资讯栏目 <small>${categories.length}</small></button></div>
    ${ui.siteContentTab === "categories" ? `<section class="card table-card"><div class="card-header"><div><h3>客户可配置的资讯栏目</h3><p>最多两级；有文章的栏目不能直接删除，修改 slug 自动生成 301。</p></div><button class="primary-button button-small" type="button" data-action="site-add-category"><span data-icon="plus"></span>新增栏目</button></div><div class="table-scroll"><table class="data-table site-category-table"><thead><tr><th>栏目</th><th>Slug</th><th>文章</th><th>导航</th><th>状态</th><th></th></tr></thead><tbody>${categories.map((category) => `<tr><td class="article-title-cell"><b>${escapeHtml(category.name)}</b><small>${escapeHtml(category.description)}</small></td><td><code>/insights/category/${escapeHtml(category.slug)}/</code></td><td><b>${siteCategoryCount(category)}</b> 篇</td><td><span class="status-badge ${category.navVisible ? "status-approved" : "status-draft"}">${category.navVisible ? "显示" : "隐藏"}</span></td><td><span class="status-badge ${category.status === "active" ? "status-approved" : "status-review"}">${category.status === "active" ? "启用" : "停用"}</span></td><td><button class="link-button" type="button" data-action="site-category-action" data-category-id="${escapeHtml(category.id)}">编辑</button></td></tr>`).join("")}</tbody></table></div><div class="site-category-tip"><span data-icon="info"></span><span>文章只设置一个主栏目，可以设置多个标签；产品/业务线是内部运营维度，不等同于官网栏目。</span></div></section>` : `<section class="card table-card"><div class="card-header"><div><h3>官网文章</h3><p>当前显示已审核内容和已发布内容；发布到官网前需先完成人工审核。</p></div><div class="site-filter-chips">${[["all", "全部"], ...categories.slice(0, 4).map((item) => [item.name, item.name])].map(([value, label]) => `<button class="filter-chip ${ui.siteCategoryFilter === value ? "active" : ""}" type="button" data-action="site-category-filter" data-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join("")}</div></div><div class="table-scroll"><table class="data-table site-article-table"><thead><tr><th>文章</th><th>主栏目</th><th>标签</th><th>版本/作者</th><th>官网状态</th><th>操作</th></tr></thead><tbody>${articles.map((article) => `<tr><td class="article-title-cell"><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(article.siteExcerpt || article.excerpt || "等待官网摘要")}</small></td><td><span class="source-tag">${escapeHtml(article.siteCategory || article.category || "待归类")}</span></td><td><div class="site-tag-list">${(article.keywords || []).slice(0, 2).map((tag) => `<em>${escapeHtml(tag)}</em>`).join("") || '<em>待补充</em>'}</div></td><td>${escapeHtml(article.version || "v1")}<small class="table-subtext">${escapeHtml(article.siteAuthor || article.author || "企业内容团队")}</small></td><td>${siteArticleStatus(article)}</td><td><button class="link-button" type="button" data-action="site-article-preview" data-article-id="${escapeHtml(article.id)}">预览</button><span class="table-action-divider">·</span><button class="link-button" type="button" data-action="site-article-meta-edit" data-article-id="${escapeHtml(article.id)}">编辑</button>${article.status === "published" || article.siteStatus === "published" ? '<span class="table-action-divider">·</span><button class="link-button" type="button" data-action="site-article-unpublish" data-article-id="' + article.id + '">下线</button>' : article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length ? '<span class="table-action-divider">·</span><button class="link-button" type="button" data-action="site-publish-article" data-article-id="' + article.id + '">发布到官网</button>' : '<span class="table-subtext">回内容生产审核</span>'}</td></tr>`).join("")}</tbody></table></div></section>`}
  `;
}

function renderSiteNavigation() {
  const modules = siteModules("home");
  const navItems = siteNavItems();
  const theme = siteCms().theme;
  const assets = siteCmsAssets();
  const footer = siteCmsFooter();
  const templateConfigs = siteTemplateConfigs();
  const templateDefaultImageRows = SITE_TEMPLATE_REGISTRY.map((template) => {
    const config = templateConfigs[template.key] || {};
    return `<div class="site-template-image-setting"><div><b>${escapeHtml(template.shortName)}</b><small>${escapeHtml(template.name)}</small></div><input class="input" id="site-template-default-image-${escapeHtml(template.key)}" value="${escapeHtml(config.defaultImageUrl || "")}" placeholder="留空则使用全站默认图片" /></div>`;
  }).join("");
  const footerColumnRows = (footer.columns || []).map((column) => `<div class="site-footer-config-row"><div><b>${escapeHtml(column.title || "未命名栏目")}</b><small>${(column.links || []).length} 个链接</small></div><div class="site-footer-config-actions"><button class="link-button" type="button" data-action="site-footer-edit-column" data-column-id="${escapeHtml(column.id)}">编辑</button><button class="icon-button" type="button" data-action="site-footer-delete-column" data-column-id="${escapeHtml(column.id)}" aria-label="删除页脚栏目"><span data-icon="trash"></span></button></div></div>`).join("");
  const footerSocialRows = (footer.socialLinks || []).map((link) => `<div class="site-footer-config-row"><div><b>${escapeHtml(link.label || "未命名链接")}</b><small>${escapeHtml(link.href || "/")}</small></div><div class="site-footer-config-actions"><button class="link-button" type="button" data-action="site-footer-edit-social" data-social-id="${escapeHtml(link.id)}">编辑</button><button class="icon-button" type="button" data-action="site-footer-delete-social" data-social-id="${escapeHtml(link.id)}" aria-label="删除页脚链接"><span data-icon="trash"></span></button></div></div>`).join("");
  const footerManagement = `<section class="site-footer-management-grid"><section class="card"><div class="card-header"><div><h3>页脚栏目</h3><p>模板只负责布局，栏目标题和链接由这里统一维护。</p></div><button class="secondary-button button-small" type="button" data-action="site-footer-add-column"><span data-icon="plus"></span>添加栏目</button></div><div class="site-footer-config-list">${footerColumnRows || '<div class="empty-state compact"><div><h3>使用模板默认栏目</h3><p>添加自定义栏目后，官网会优先使用你的配置。</p></div></div>'}</div></section><section class="card"><div class="card-header"><div><h3>页脚入口</h3><p>可维护官网、公众号或其他公开入口地址。</p></div><button class="secondary-button button-small" type="button" data-action="site-footer-add-social"><span data-icon="plus"></span>添加入口</button></div><div class="site-footer-config-list">${footerSocialRows || '<div class="empty-state compact"><div><h3>使用模板默认入口</h3><p>添加后会替换模板默认的联系、资讯和案例入口。</p></div></div>'}</div></section></section>`;
  const sectionJumpNav = `<nav class="site-navigation-jump-nav" aria-label="导航与外观页面分区"><span>继续配置</span><a class="site-section-jump" href="#site-template-section">官网模板</a><a class="site-section-jump" href="#site-footer-management-section">页脚与入口</a><a class="site-section-jump" href="#site-navigation-section">主导航与首页模块</a><a class="site-section-jump" href="#site-public-settings-section">品牌素材与公共资料</a></nav>`;
  return `
    <div class="site-page-toolbar"><div><h2>导航与外观</h2><p>一处维护模板、品牌、导航、首页模块和公共信息，不改变文章事实内容。</p></div><button class="primary-button button-small" type="button" data-action="site-nav-save"><span data-icon="check"></span>保存外观设置</button></div>
    ${sectionJumpNav}<div id="site-template-section">${renderSiteTemplates()}</div>
    <div id="site-footer-management-section">${footerManagement}</div>
    <div id="site-navigation-section" class="site-navigation-grid"><section class="card"><div class="card-header"><div><h3>主导航</h3><p>顺序、名称、地址与显示状态均可维护。</p></div><button class="secondary-button button-small" type="button" data-action="site-nav-add"><span data-icon="plus"></span>添加导航项</button></div><div class="site-nav-list">${navItems.map((item, index) => `<div class="site-nav-row"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><span class="site-module-grip">⋮⋮</span><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.path)} · ${escapeHtml(item.type)}</small></div><span class="status-badge ${item.visible ? "status-approved" : "status-draft"}">${item.visible ? "显示" : "隐藏"}</span><button class="icon-button" type="button" data-action="site-nav-edit" data-nav-id="${escapeHtml(item.id)}" aria-label="编辑导航"><span data-icon="edit"></span></button></div>`).join("")}</div></section><section class="card"><div class="card-header"><div><h3>首页语义模块</h3><p>每个模块均可关联知识、产品、案例或资讯。</p></div></div><div class="site-nav-list">${modules.slice(0, 5).map((module, index) => `<div class="site-nav-row compact"><span class="site-module-order">${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(module.title)}</b><small>${escapeHtml(module.description)}</small></div><span>${module.status === "published" ? statusBadge("published") : statusBadge("draft")}</span><button class="link-button" type="button" data-action="site-module-edit" data-page-id="home" data-module-id="${escapeHtml(module.id)}">编辑</button></div>`).join("")}</div></section></div>
    <section id="site-public-settings-section" class="card site-theme-card"><div class="card-header"><div><h3>品牌与公共信息</h3><p>维护品牌主色和默认 CTA；Logo、联系方式、页脚与备案信息等公共字段也统一由这里承载。当前版本 v${escapeHtml(theme.version || 1)}。</p></div></div><div class="field-row"><div class="field"><label for="site-theme-color">品牌主色</label><div class="color-setting"><i style="background:${escapeHtml(theme.primaryColor)}"></i><input class="input" id="site-theme-color" value="${escapeHtml(theme.primaryColor)}" /></div></div><div class="field"><label for="site-theme-cta">默认 CTA 文案</label><input class="input" id="site-theme-cta" value="${escapeHtml(theme.cta)}" /></div></div></section>
    <div class="site-public-settings-grid"><section class="card site-public-assets-card"><div class="card-header"><div><h3>品牌素材与默认图片</h3><p>有内容图片时显示内容图片；没有时按当前模板、全站默认图片的顺序兜底。</p></div></div><div class="field-row"><div class="field"><label for="site-assets-logo">官网 Logo 图片地址</label><input class="input" id="site-assets-logo" value="${escapeHtml(assets.logoUrl || siteCms().settings?.logoUrl || "")}" placeholder="/assets/logo.png 或 https://..." /></div><div class="field"><label for="site-assets-favicon">浏览器图标地址</label><input class="input" id="site-assets-favicon" value="${escapeHtml(assets.faviconUrl || "")}" placeholder="/assets/favicon.png" /></div></div><div class="field-row"><div class="field"><label for="site-assets-default-image">全站默认图片</label><input class="input" id="site-assets-default-image" value="${escapeHtml(assets.defaultImageUrl || "")}" placeholder="/assets/default-cover.webp" /></div><div class="field"><label for="site-assets-default-image-alt">默认图片说明</label><input class="input" id="site-assets-default-image-alt" value="${escapeHtml(assets.defaultImageAlt || "企业默认图片")}" placeholder="用于无障碍说明" /></div></div><div class="site-template-image-list"><div class="site-template-image-list-head"><b>模板专属默认图片</b><small>每套模板可以有自己的图片；留空时继承全站默认图片。</small></div>${templateDefaultImageRows}</div></section><section class="card site-public-footer-card"><div class="card-header"><div><h3>页脚与备案</h3><p>这些内容属于企业公开信息，发布后会同步到所有已适配模板。</p></div></div><div class="field"><label for="site-footer-description">页脚说明</label><textarea class="textarea" id="site-footer-description" rows="3" placeholder="一句话说明企业和官网定位">${escapeHtml(footer.description || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-footer-copyright">版权文字</label><input class="input" id="site-footer-copyright" value="${escapeHtml(footer.copyright || "")}" placeholder="版权所有" /></div><div class="field"><label for="site-footer-icp">ICP备案号</label><input class="input" id="site-footer-icp" value="${escapeHtml(footer.icpNumber || "")}" placeholder="例如：京ICP备XXXXXXXX号" /></div></div><div class="field-row"><div class="field"><label for="site-footer-icp-url">ICP备案链接</label><input class="input" id="site-footer-icp-url" value="${escapeHtml(footer.icpUrl || "")}" placeholder="https://beian.miit.gov.cn/" /></div><div class="field"><label for="site-footer-police">公安备案号</label><input class="input" id="site-footer-police" value="${escapeHtml(footer.policeRecordNumber || "")}" placeholder="例如：京公网安备XXXXXXXX号" /></div></div><div class="field"><label for="site-footer-police-url">公安备案链接</label><input class="input" id="site-footer-police-url" value="${escapeHtml(footer.policeRecordUrl || "")}" placeholder="https://beian.mps.gov.cn/" /></div><div class="site-footer-switches"><label class="toggle ${footer.showIcp !== false ? "on" : ""}"><input type="checkbox" id="site-footer-show-icp" ${footer.showIcp !== false ? "checked" : ""} /><span></span><b>显示 ICP</b></label><label class="toggle ${footer.showPoliceRecord !== false ? "on" : ""}"><input type="checkbox" id="site-footer-show-police" ${footer.showPoliceRecord !== false ? "checked" : ""} /><span></span><b>显示公安备案</b></label><label class="toggle ${footer.showCopyright !== false ? "on" : ""}"><input type="checkbox" id="site-footer-show-copyright" ${footer.showCopyright !== false ? "checked" : ""} /><span></span><b>显示版权</b></label></div></section></div>
  `;
}

function renderSiteLeads() {
  const leads = siteLeads();
  const leadKeyword = String(ui.siteLeadSearch || "").trim().toLowerCase();
  const filteredLeads = leadKeyword ? leads.filter((lead) => [lead.name, lead.company, lead.service, lead.phone, lead.email, lead.sourcePage].join(" ").toLowerCase().includes(leadKeyword)) : leads;
  const pending = leads.filter((lead) => lead.status === "new").length;
  const contacted = leads.filter((lead) => lead.status === "contacted").length;
  const qualified = leads.filter((lead) => lead.status === "qualified").length;
  const leadStatus = { new: ["新线索", "status-review"], contacted: ["已联系", "status-publishing"], qualified: ["有效商机", "status-approved"] };
  return `<section class="card table-card"><div class="card-header"><div><h2>官网咨询线索</h2><p>来自官网表单的咨询，支持来源页面、跟进状态和导出。</p></div><div class="card-header-tools"><input class="input" placeholder="搜索姓名 / 企业 / 服务 / 来源" value="${escapeHtml(ui.siteLeadSearch || "")}" data-lead-search /><button class="secondary-button button-small" type="button" data-action="export-leads"><span data-icon="download"></span>导出 CSV</button></div></div><div class="site-lead-summary"><div><b>${pending}</b><span>待跟进</span></div><div><b>${leads.length}</b><span>已收录线索</span></div><div><b>${qualified}</b><span>有效商机</span></div><div><b>${leads.length ? Math.round((qualified / leads.length) * 100) : 0}%</b><span>转化率</span></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>联系人</th><th>企业</th><th>咨询服务</th><th>提交时间</th><th>来源页面</th><th>状态</th><th></th></tr></thead><tbody>${(() => { const paged = lightPaged(filteredLeads, "siteLeads"); return paged.visible.map((lead) => { const meta = leadStatus[lead.status] || leadStatus.new; return `<tr><td><b>${escapeHtml(lead.name)}</b><small class="table-subtext">${escapeHtml(lead.owner || "未分配")}</small></td><td>${escapeHtml(lead.company)}</td><td>${escapeHtml(lead.service)}</td><td>${escapeHtml(lead.createdAt)}</td><td><span class="source-tag">${escapeHtml(lead.sourcePage || "官网")}</span></td><td><span class="status-badge ${meta[1]}">${meta[0]}</span></td><td><button class="link-button" type="button" data-action="site-lead-follow" data-lead-id="${escapeHtml(lead.id)}">${lead.status === "new" ? "跟进" : "查看"}</button><button class="link-button danger-link" type="button" data-action="delete-site-lead" data-lead-id="${escapeHtml(lead.id)}">删除</button></td></tr>`; }).join("") || '<tr><td class="empty-cell" colspan="7">没有匹配的线索</td></tr>'} )()}</tbody></table></div>${(() => { const paged = lightPaged(filteredLeads, "siteLeads"); return paged.toggle; })()}<div class="site-category-tip"></table></div><div class="site-category-tip"><span data-icon="info"></span><span>${contacted} 条线索正在跟进；每次跟进会写入时间、负责人和下一步计划。</span></div></section>`;
}

function renderSiteSettings() {
  const settings = siteCms().settings;
  const redirects = siteCms().redirects || [];
  const outputs = [["Organization / WebSite", "企业主体、品牌名和官方域名", "已生成"], ["Service / CaseStudy", "产品服务与公开案例结构化表达", "已开启"], ["CollectionPage / FAQPage", "问题地图与权威答案的机器可读结构", "已开启"], ["Article / Breadcrumb", "文章页自动输出结构化数据", "已开启"], ["sitemap / RSS / llms.txt", "发布后同步更新机器入口", "已生成"]];
  return `<div class="site-settings-grid"><section class="card"><div class="card-header"><div><h2>站点与企业主体</h2><p>域名、企业实体和公开描述是全站信源的基础。</p></div><button class="primary-button button-small" type="button" data-action="save-site">保存设置</button></div><div class="card-body"><div class="field-row"><div class="field"><label for="site-setting-name">网站名称</label><input class="input" id="site-setting-name" value="${escapeHtml(settings.siteName)}" /></div><div class="field"><label for="site-setting-domain">主域名</label><input class="input" id="site-setting-domain" value="${escapeHtml(settings.officialDomain || state.site.domain)}" /></div></div><div class="field"><label for="site-setting-company">企业主体</label><input class="input" id="site-setting-company" value="${escapeHtml(settings.companyName)}" /></div><div class="field"><label for="site-setting-description">网站描述</label><textarea class="textarea" id="site-setting-description" rows="3">${escapeHtml(settings.description)}</textarea></div><div class="field"><label for="site-setting-same-as">权威主体链接</label><textarea class="textarea" id="site-setting-same-as" rows="3" placeholder="每行一个已认证的企业主页或权威主体地址">${escapeHtml((settings.sameAs || []).join("\n"))}</textarea><small>用于 Organization.sameAs，最多 12 个；请勿填写未认证或无关账号。</small></div><div class="setting-row"><div><b>允许 AI 抓取已发布内容</b><small>仅公开已审核、已发布的官网页面</small></div><label class="toggle ${settings.allowAiCrawl !== false ? "on" : ""}"><input type="checkbox" id="site-setting-ai-crawl" ${settings.allowAiCrawl !== false ? "checked" : ""} /><span></span></label></div></div></section><section class="card"><div class="card-header"><div><h2>AI 信源输出</h2><p>系统自动生成，不需要每篇文章手动配置。</p></div><span class="small-tag blue">信源完整度 92%</span></div><div class="site-output-list">${outputs.map((item) => `<div class="site-output-row"><span class="check-dot ok">✓</span><div><b>${item[0]}</b><small>${item[1]}</small></div><span class="status-badge status-approved">${item[2]}</span></div>`).join("")}</div><div class="site-settings-footnote"><span data-icon="info"></span><span>页面发布时自动检查标题、摘要、作者、发布日期、canonical、内部链接和栏目主题一致性。</span></div></section><section class="card site-advanced-card"><div class="card-header"><div><h2>高级设置</h2><p>低频维护入口：重定向、发布历史和网站诊断。</p></div></div><div class="advanced-setting-row"><div><b>官网发布机制</b><small>后台保存 CMS 草稿后，通过顶部“发布官网”生成不可变正式版本；官网服务从同一数据库即时读取。</small></div><span class="status-badge status-online">已连接</span><button class="link-button" type="button" data-action="site-show-releases">查看历史</button></div><div class="advanced-setting-row"><div><b>URL 重定向</b><small>栏目或页面 slug 修改时自动生成 301</small></div><span class="small-tag">${redirects.filter((item) => item.status === "active").length} 条生效</span><button class="link-button" type="button" data-action="site-redirects">管理</button></div><div class="site-health site-health-quiet"><div class="site-health-head"><h4>网站诊断：${escapeHtml(state.site.diagnosticStatus || "正常")}</h4>${statusBadge("healthy")}</div><p>首次上线或配置变更后复查即可，不作为日常运营工具。</p><button class="secondary-button button-small" type="button" data-action="run-diagnostic"><span data-icon="refresh"></span>重新检测</button></div></section></div>`;
}

function renderSiteContactSettings() {
  const settings = siteCms().settings || {};
  return `<section class="card site-contact-settings-card"><div class="card-header"><div><h2>公开联系方式</h2><p>统一应用到联系我们、页脚、咨询表单和企业结构化数据。</p></div><button class="primary-button button-small" type="button" data-action="save-site-contact"><span data-icon="check"></span>保存联系方式</button></div><div class="card-body"><div class="field-row"><div class="field"><label for="site-setting-phone">联系电话</label><input class="input" id="site-setting-phone" value="${escapeHtml(settings.phone || "")}" /></div><div class="field"><label for="site-setting-email">企业邮箱</label><input class="input" id="site-setting-email" type="email" value="${escapeHtml(settings.email || "")}" /></div></div><div class="field"><label for="site-setting-address">企业地址</label><input class="input" id="site-setting-address" value="${escapeHtml(settings.address || "")}" /></div><div class="field-row"><div class="field"><label for="site-setting-region">所在区域 / 行业区域</label><input class="input" id="site-setting-region" value="${escapeHtml(settings.industryRegion || "")}" /></div><div class="field"><label for="site-setting-area">服务区域</label><input class="input" id="site-setting-area" value="${escapeHtml(settings.serviceArea || "")}" /></div></div><div class="site-settings-footnote"><span data-icon="info"></span><span>这些信息属于公开资料，请填写经过企业确认、允许对外展示的联系方式。</span></div></div></section>`;
}

function renderSiteDiagnosticTargetSettings() {
  const settings = siteCms().settings || {};
  return `<section class="card site-diagnostic-target-card"><div class="card-header"><div><h2>官网实测地址</h2><p>为运营诊断单独配置抓取目标，不与公开域名、canonical 或 sitemap 混用。</p></div><button class="primary-button button-small" type="button" data-action="save-site-diagnostic-url"><span data-icon="check"></span>保存实测地址</button></div><div class="card-body"><div class="field"><label for="site-setting-diagnostic-url">可公开访问的 HTTP / HTTPS 地址</label><input class="input" id="site-setting-diagnostic-url" value="${escapeHtml(settings.diagnosticUrl || "")}" placeholder="http://124.221.70.55:19080/" /><small>例如当前官网暂用 HTTP 的 19080 端口，请填写 <code>http://</code>，不要误填为 <code>https://</code>。该地址只在后台发起实测时使用。</small></div><div class="site-settings-footnote"><span data-icon="shield"></span><span>服务端会拒绝本机、内网和未允许端口的地址；保存地址不代表自动发起检测。</span></div></div></section>`;
}

/* 把发布说明里的 ISO 时间戳转为人类可读 */
function humanizeReleaseNote(note) {
  const text = String(note || "");
  return text
    .replace(/官网正式发布\s*\d{4}-\d{2}-\d{2}T[\d:.Z-]+/g, () => "发布草稿为正式版本")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, (match) => {
      const date = new Date(match);
      if (Number.isNaN(date.getTime())) return match;
      return "发布于 " + date.toLocaleString("zh-CN", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    });
}

function renderSiteReleasePanel() {
  const current = siteCmsRuntime.publication?.version || 0;
  const rows = (siteCmsRuntime.releases || []).map((release) => `<tr><td><b>v${escapeHtml(release.version)}</b>${release.current ? '<small class="table-subtext">当前正式版本</small>' : ""}</td><td>${escapeHtml(release.operation === "rollback" ? "回滚发布" : release.operation === "bootstrap" ? "初始版本" : "正式发布")}</td><td>${escapeHtml(humanizeReleaseNote(release.note) || "—")}</td><td>${escapeHtml(siteDisplayTime(release.createdAt))}</td><td>${release.current ? siteRecordStatus("published") : `<button class="link-button" type="button" data-action="site-rollback-cms" data-release-id="${escapeHtml(release.id)}" data-release-version="${escapeHtml(release.version)}">恢复为新版本</button>`}</td></tr>`).join("");
  return `<div class="site-page-toolbar"><div><h2>发布历史</h2><p>每次正式发布生成不可变版本；回滚也会形成一个新的正式版本，不覆盖历史记录。</p></div><div class="modal-foot-right"><button class="secondary-button button-small" type="button" data-action="preview-site"><span data-icon="eye"></span>预览草稿</button><button class="primary-button button-small" type="button" data-action="site-publish-cms" ${siteCmsRuntime.publishing ? "disabled" : ""}>${siteCmsRuntime.publishing ? '<span class="button-spinner"></span>发布中…' : '<span data-icon="send"></span>发布官网'}</button></div></div><section class="card table-card"><div class="card-header"><div><h3>正式版本记录</h3><p>当前官网版本 v${escapeHtml(current)} · 共 ${(siteCmsRuntime.releases || []).length} 条记录</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>版本</th><th>操作</th><th>发布说明</th><th>时间</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderSitePanel() {
  if (ui.siteTab === "templates") ui.siteTab = "navigation";
  const draft = siteCmsRuntime.draft;
  const publication = siteCmsRuntime.publication;
  const changed = siteCmsRuntime.localDirty || Boolean(draft && publication && draft.checksum !== publication.checksum);
  const releaseBar = `<section class="site-release-bar ${changed ? "has-changes" : "is-current"}"><div class="site-release-state"><span class="site-release-indicator"></span><div><b>${siteCmsRuntime.saving ? "正在保存草稿" : changed ? "有未发布修改" : "草稿与官网一致"}</b><small>草稿 r${escapeHtml(draft?.revision || "—")} · 正式 v${escapeHtml(publication?.version || "—")} · 最近发布 ${escapeHtml(siteDisplayTime(publication?.publishedAt))}</small></div></div><div class="site-release-actions"><button class="secondary-button button-small" type="button" data-action="site-show-releases">发布历史</button><button class="secondary-button button-small" type="button" data-action="preview-site">预览草稿</button><button class="primary-button button-small" type="button" data-action="site-publish-cms" ${siteCmsRuntime.publishing ? "disabled" : ""}>${siteCmsRuntime.publishing ? '<span class="button-spinner"></span>发布中…' : "发布官网"}</button></div></section>`;
  let body = "";
  if (ui.siteTab === "pages") body = renderSitePages();
  else if (ui.siteTab === "catalog") body = renderSiteCatalog();
  else if (ui.siteTab === "content") body = renderSiteContentCenter();
  else if (ui.siteTab === "problems") body = renderSiteProblems();
  else if (ui.siteTab === "insights") body = renderSiteInsights();
  else if (ui.siteTab === "navigation") body = renderSiteNavigation();
  else if (ui.siteTab === "seo") body = renderSiteSettings() + renderSiteDiagnosticTargetSettings() + renderSiteContactSettings();
  else if (ui.siteTab === "leads") body = renderSiteLeads();
  else if (ui.siteTab === "releases") body = renderSiteReleasePanel();
  else body = renderSiteOverview();
  return releaseBar + body;
}

function renderSite() {
  return `<div class="page-container">${pageHead(PAGE_META.site.title, PAGE_META.site.description, '<button class="secondary-button" type="button" data-action="preview-site"><span data-icon="external"></span>预览官网</button>')}<div class="site-workspace"><aside class="card site-workspace-nav"><div class="site-workspace-nav-head"><span class="site-workspace-icon" data-icon="globe"></span><div><b>官网内容与结构</b><small>页面、信源与发布管理</small></div></div>${siteTabs()}<div class="site-workspace-status"><span class="health"><i></i>网站运行正常</span><small>${escapeHtml(state.site.domain)}</small></div></aside><section class="site-workspace-main">${renderSitePanel()}</section></div></div>`;
}

function selectSiteTemplate(templateKey) {
  const template = SITE_TEMPLATE_REGISTRY.find((item) => item.key === templateKey);
  if (!template) return showToast("模板不存在", "请重新选择一个官网模板。", "error");
  if (template.sourceReady === false) return showToast("模板尚未完成适配", "该行业的原始页面和独立 CSS 还在接入，当前不会切换到通用页面。", "info");
  const cms = siteCms();
  cms.templateKey = template.key;
  cms.theme = cms.theme || {};
  cms.theme.templateKey = template.key;
  cms.theme.name = `${template.shortName} · 企业官网`;
  cms.theme.primaryColor = template.accent;
  cms.theme.version = (Number(cms.theme.version) || 1) + 1;
  cms.theme.updatedAt = siteNow();
  state.site.theme = cms.theme.name;
  saveState();
  ui.siteTab = "navigation";
  render();
  showToast("模板已应用到草稿", `${template.name} 已成为当前官网展示模板；发布前可先预览。`, "success");
}

function renderSiteArticleMetaModal() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return "";
  const categories = (siteCms().categories || []).filter((item) => item.status !== "archived");
  const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category.slug || category.id)}" ${article.siteCategorySlug === category.slug || article.siteCategory === category.name ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
  const meta = article.siteMeta || article.websiteMeta || {};
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">编辑官网文章信息</h2><p>${escapeHtml(article.title)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <div class="field-row"><div class="field"><label for="site-article-meta-category">主栏目</label><select class="select" id="site-article-meta-category">${categoryOptions}</select></div><div class="field"><label for="site-article-meta-canonical">规范 URL（可留空）</label><input class="input" id="site-article-meta-canonical" value="${escapeHtml(meta.canonicalUrl || article.siteCanonicalUrl || "")}" placeholder="/insights/文章-slug/" /></div></div>
      <div class="field mt-md"><label for="site-article-meta-tags">标签（逗号分隔）</label><input class="input" id="site-article-meta-tags" value="${escapeHtml((article.siteTags || article.tags || []).join("、"))}" placeholder="例如：GEO、企业信源" /></div>
      <div class="field mt-md"><label for="site-article-meta-seo">SEO / AI 摘要</label><textarea class="textarea" id="site-article-meta-seo" rows="3">${escapeHtml(article.siteSeoDescription || article.seoDescription || article.excerpt || "")}</textarea></div>
      <div class="privacy-note"><span data-icon="info"></span><span>发布到官网后，栏目、标签、摘要和 SEO 描述会同步到文章页与机器入口。</span></div>
    </div>
    <div class="modal-foot"><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="save-site-article-meta">保存修改</button></div></div>
  `);
}

function saveSiteArticleMeta() {
  const article = state.articles.find((item) => item.id === ui.modal.articleId);
  if (!article) return;
  const selectedSlug = String(document.getElementById("site-article-meta-category")?.value || "");
  const category = (siteCms().categories || []).find((item) => (item.slug || item.id) === selectedSlug);
  article.siteCategory = category?.name || article.siteCategory;
  article.siteCategorySlug = category?.slug || category?.id || article.siteCategorySlug;
  article.siteTags = String(document.getElementById("site-article-meta-tags")?.value || "").split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
  article.siteSeoDescription = String(document.getElementById("site-article-meta-seo")?.value || "").trim();
  article.siteMeta = { ...(article.siteMeta || {}), canonicalUrl: String(document.getElementById("site-article-meta-canonical")?.value || "").trim() };
  article.updatedAt = Date.now();
  saveState();
  closeModal();
  render();
  showToast("文章信息已更新", "官网栏目、标签和 SEO 描述已同步。", "success");
}

function renderSitePublishModal() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return "";
  const eligible = article.reviewStatus === "approved" && article.riskStatus === "clean" && articleCitations(article).length;
  if (!eligible) return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">暂不能发布到官网</h2><p>文章必须完成人工审核、风险检查和知识证据冻结。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="site-source-note"><span class="site-source-note-icon" data-icon="alert"></span><div><b>${escapeHtml(article.title)}</b><p>当前状态：${article.reviewStatus === "approved" ? "已审核" : "待审核"} · ${article.riskStatus === "clean" ? "风险通过" : "需要处理风险"} · ${articleCitations(article).length ? "证据已关联" : "尚未关联证据"}</p></div></div></div><div class="modal-foot"><div></div><button class="secondary-button" type="button" data-action="close-modal">返回文章任务</button></div>`);
  const categories = siteCategories();
  const selectedCategory = article.siteCategory || article.category || categories[0]?.name || "GEO优化";
  const slug = article.siteSlug || String(article.title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || article.id.toLowerCase();
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">发布到企业官网</h2><p>${escapeHtml(article.id)} · 冻结版本 ${escapeHtml(article.version || "v1")} · 官网发布信息</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body site-publish-modal-body"><div class="publish-article"><b>${escapeHtml(article.title)}</b><span>正文来自内容生产中心；本窗口只补充官网展示字段。</span></div><div class="field-row"><div class="field"><label for="site-publish-category">主栏目 *</label><select class="select" id="site-publish-category">${categories.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === selectedCategory ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label for="site-publish-author">作者</label><input class="input" id="site-publish-author" value="${escapeHtml(article.author || "桐灼研究")}" /></div></div><div class="field"><label for="site-publish-slug">文章地址 slug *</label><div class="site-slug-input"><span>/insights/</span><input class="input" id="site-publish-slug" value="${escapeHtml(slug)}" /></div><small class="field-help">修改已发布文章的 slug 时，系统自动生成 301 重定向。</small></div><div class="field"><label for="site-publish-excerpt">官网摘要</label><textarea class="textarea" id="site-publish-excerpt" rows="4">${escapeHtml(article.excerpt || "")}</textarea></div><div class="site-optional-media-field"><div><label for="site-publish-image">文章封面（可选）</label><small>没有封面时，文章列表使用文字布局。</small></div><input class="input" id="site-publish-image" value="${escapeHtml(article.image || article.siteImage || "")}" placeholder="https://... 或 /assets/..." /><input class="input" id="site-publish-image-alt" value="${escapeHtml(article.imageAlt || article.title || "文章封面")}" placeholder="图片说明（用于无障碍）" /></div><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>引用编号</b><small>${articlePublicCitationMarkersVisible(article) ? "对外显示 [K1]、[K2]" : "仅后台可见，官网正文隐藏"}</small></span></div><div><span class="check-dot ok">✓</span><span><b>Article / Breadcrumb</b><small>发布时自动生成结构化数据</small></span></div><div><span class="check-dot ok">✓</span><span><b>栏目页、首页、sitemap</b><small>发布后自动更新相关入口</small></span></div><div><span class="check-dot ok">✓</span><span><b>知识证据冻结</b><small>${articleCitations(article).length} 条引用证据随版本保存</small></span></div></div></div><div class="modal-foot"><span>发布后可在行业资讯中下线或回滚</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-confirm-publish"><span data-icon="send"></span>确认发布</button></div></div>`, { wide: true });
}

async function submitSitePublish() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return closeModal();
  if (ui.submittingSitePublish) return;
  const category = document.getElementById("site-publish-category")?.value || article.category || "GEO优化";
  const slug = document.getElementById("site-publish-slug")?.value.trim() || article.id.toLowerCase();
  const author = document.getElementById("site-publish-author")?.value.trim() || article.author || "桐灼研究";
  const excerpt = document.getElementById("site-publish-excerpt")?.value.trim() || article.excerpt || "";
  const image = document.getElementById("site-publish-image")?.value.trim() || "";
  const imageAlt = document.getElementById("site-publish-image-alt")?.value.trim() || article.title || "文章封面";
  const oldSlug = article.siteSlug;
  const selectedCategory = siteCategories().find((item) => item.name === category) || null;
  const remoteArticleId = article.contentArticleId || article.id;
  ui.submittingSitePublish = true;
  try {
    await ensureContentPublishSnapshot(article);
    const payload = await productionApi(`/api/v1/content/articles/${encodeURIComponent(remoteArticleId)}/publish`, {
      method: "POST",
      body: {
        versionId: article.contentApprovedVersionId || article.contentVersionId || null,
        expectedRevision: article.contentRevision,
        category,
        siteSlug: slug,
        siteAuthor: author,
        siteExcerpt: excerpt,
        siteCategoryId: selectedCategory?.id || null,
        siteCategorySlug: selectedCategory?.slug || null,
        metadata: { keywords: cloneData(article.keywords || []), tags: cloneData(article.tags || []), image, imageAlt, showPublicCitationMarkers: articlePublicCitationMarkersVisible(article) }
      }
    });
    applyContentServerSnapshot(article, payload);
    article.siteStatus = "published";
    article.siteCategory = category;
    article.siteCategoryId = selectedCategory?.id || article.siteCategoryId || null;
    article.siteCategorySlug = selectedCategory?.slug || article.siteCategorySlug || null;
    article.siteSlug = slug;
    article.siteAuthor = author;
    article.siteExcerpt = excerpt;
    article.image = image;
    article.imageAlt = imageAlt;
    article.siteUrl = "/insights/" + slug + "/";
    article.sitePublishedAt = contentApiArticle(payload)?.metadata?.sitePublishedAt || article.sitePublishedAt || new Date().toISOString();
    if (oldSlug && oldSlug !== slug) siteAddRedirect(`/insights/${oldSlug}/`, `/insights/${slug}/`, `文章“${article.title}”地址调整`);
    saveState();
    closeModal();
    ui.siteTab = "insights";
    ui.siteContentTab = "articles";
    showToast("官网文章已发布", `${category} 栏目已更新，页面地址为 ${article.siteUrl}`);
    return render();
  } catch (error) {
    article.contentSyncError = error.message || "官网发布失败";
    saveState();
    return showToast("官网发布失败", article.contentSyncError, "error");
  } finally {
    ui.submittingSitePublish = false;
  }
}

async function unpublishSiteArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return;
  if (!(await uiConfirm("确认将这篇文章从官网下线？公开页面会立即不可访问。"))) return;
  if (ui.unpublishingSiteArticleId === article.id) return;
  ui.unpublishingSiteArticleId = article.id;
  try {
    const remoteArticleId = article.contentArticleId || article.id;
    await ensureContentPublishSnapshot(article);
    const payload = await productionApi(`/api/v1/content/articles/${encodeURIComponent(remoteArticleId)}/unpublish`, {
      method: "POST",
      body: { expectedRevision: article.contentRevision, reason: "CMS manual unpublish" }
    });
    applyContentServerSnapshot(article, payload);
    article.siteStatus = "draft";
    article.siteUnpublishedAt = contentApiArticle(payload)?.metadata?.siteUnpublishedAt || article.siteUnpublishedAt || new Date().toISOString();
    saveState();
    showToast("官网文章已下线", "官网公开页面已移除，文章版本和发布记录仍会保留。", "success");
    return render();
  } catch (error) {
    article.contentSyncError = error.message || "官网下线失败";
    saveState();
    return showToast("官网下线失败", article.contentSyncError, "error");
  } finally {
    ui.unpublishingSiteArticleId = "";
  }
}

function siteValue(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

function siteValues(id) {
  const element = document.getElementById(id);
  return element ? [...element.selectedOptions].map((option) => option.value).filter(Boolean) : [];
}

function siteChecked(id) {
  return Boolean(document.getElementById(id)?.checked);
}

function saveSitePage() {
  const page = sitePageDefinition();
  if (!page) return;
  const title = siteValue("site-page-title");
  const path = sitePath(siteValue("site-page-path"));
  const pageStatus = ["published", "draft", "archived"].includes(siteValue("site-page-status")) ? siteValue("site-page-status") : (page.status || "draft");
  const seoDescription = siteValue("site-page-seo");
  if (!title) return showToast("请填写页面标题", "页面标题不能为空。", "error");
  if (!path || path.includes(" ")) return showToast("页面路径不正确", "请使用以 / 开头的站内路径，且不要包含空格。", "error");
  const conflict = sitePages().find((item) => item.id !== page.id && item.path === path);
  if (conflict) return showToast("页面路径已存在", `“${conflict.title}”正在使用 ${path}。`, "error");
  const changed = title !== page.title || path !== page.path || pageStatus !== (page.status || "draft") || seoDescription !== (page.seoDescription || "") || siteChecked("site-page-schema") !== (page.schemaEnabled !== false) || siteChecked("site-page-sitemap") !== (page.sitemapEnabled !== false);
  if (!changed) return showToast("页面没有新的修改", "当前设置已经是已保存状态。", "info");
  const oldPath = page.path;
  page.title = title;
  page.path = path;
  page.status = pageStatus;
  page.description = seoDescription || page.description;
  page.seoDescription = seoDescription;
  page.schemaEnabled = siteChecked("site-page-schema");
  page.sitemapEnabled = siteChecked("site-page-sitemap");
  page.version = (Number(page.version) || 1) + 1;
  page.savedAt = siteNow();
  if (oldPath !== path) siteAddRedirect(oldPath, path, `页面“${title}”路径调整`);
  saveState();
  render();
  showToast("页面已保存", `已生成 v${page.version}，页面设置和模块可继续预览或回滚。`, "success");
}

function openLiveSite(path = "/") {
  const baseUrl = String(state.site?.baseUrl || "").trim();
  const domain = String(state.site?.domain || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!baseUrl && !domain) return showToast("尚未配置官网地址", "请先在站点设置中填写主域名，或在部署环境中配置官网地址。", "error");
  const origin = baseUrl || `https://${domain}`;
  const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  window.open(url, "_blank", "noopener");
  return true;
}

function renderSitePreviewModal() {
  const page = sitePageDefinition(ui.modal?.pageId);
  if (!page) return "";
  const src = `/api/v1/site-cms/preview?path=${encodeURIComponent(page.path)}`;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网草稿预览 · ${escapeHtml(page.title)}</h2><p>${escapeHtml(page.path)} · 使用正式官网渲染器 · 不会影响线上版本</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body site-rendered-preview-body"><div class="site-preview-address"><span class="status-badge status-review">草稿预览</span><code>${escapeHtml(src)}</code><button class="link-button" type="button" data-action="site-preview-reload">刷新</button></div><iframe class="site-rendered-preview-frame" id="site-rendered-preview-frame" src="${escapeHtml(src)}" title="${escapeHtml(page.title)}草稿预览"></iframe></div><div class="modal-foot"><span>预览页面带 noindex，搜索引擎和 AI 抓取不会收录</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button><button class="primary-button" type="button" data-action="site-publish-cms" ${siteCmsRuntime.publishing ? "disabled" : ""}>${siteCmsRuntime.publishing ? '<span class="button-spinner"></span>发布中…' : "发布官网"}</button></div></div>`, { wide: true });
}

function renderSiteReleasesModal() {
  const currentVersion = siteCmsRuntime.publication?.version || 0;
  const rows = (siteCmsRuntime.releases || []).map((release) => {
    const operation = release.operation === "rollback" ? "整站回滚" : release.operation === "bootstrap" ? "升级保留" : "正式发布";
    return `<div class="site-release-history-row ${release.current ? "current" : ""}"><div class="site-release-history-version"><b>v${escapeHtml(release.version)}</b><span class="small-tag ${release.current ? "blue" : ""}">${release.current ? "当前官网" : operation}</span></div><div><strong>${escapeHtml(release.note || operation)}</strong><small>草稿 r${escapeHtml(release.sourceDraftRevision)} · ${escapeHtml(siteDisplayTime(release.createdAt))}</small></div>${release.current ? '<span class="status-badge status-approved">正在使用</span>' : `<button class="secondary-button button-small" type="button" data-action="site-rollback-cms" data-release-id="${escapeHtml(release.id)}" data-release-version="${escapeHtml(release.version)}">恢复此版本</button>`}</div>`;
  }).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网正式发布历史</h2><p>当前官网 v${escapeHtml(currentVersion)} · 历史版本不可修改，回滚会产生一个新的正式版本。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="site-release-history-list">${rows || '<div class="empty-state compact"><div><h3>暂无发布记录</h3><p>发布首个官网版本后会在这里保留记录。</p></div></div>'}</div></div><div class="modal-foot"><span>恢复历史版本会同时更新当前 CMS 草稿，便于后续继续编辑</span><button class="primary-button" type="button" data-action="close-modal">完成</button></div>`, { wide: true });
}

async function publishSiteCms() {
  if (siteCmsRuntime.publishing) return;
  if (!currentUserCan("content.publish")) return showToast("没有官网发布权限", "请由管理员或具备发布权限的成员执行。", "error");
  siteCmsRuntime.publishing = true;
  render();
  try {
    await flushSiteCmsDraftSync();
    const payload = await productionApi("/api/v1/site-cms/publish", { method: "POST", body: { expectedDraftRevision: siteCmsRuntime.draft?.revision, note: `发布草稿 r${siteCmsRuntime.draft?.revision ?? "—"} 为正式版本` } });
    applySiteCmsApiPayload(payload, { replaceDraft: false });
    await refreshSiteCmsFromServer();
    closeModal();
    render();
    showToast("官网已正式发布", `当前正式版本为 v${siteCmsRuntime.publication?.version}，官网和机器入口已同步更新。`, "success");
  } catch (error) {
    showToast("官网发布失败", error.message || "请刷新 CMS 状态后重试。", "error");
  } finally {
    siteCmsRuntime.publishing = false;
  }
}

async function rollbackSiteCms(releaseId, releaseVersion) {
  if (siteCmsRuntime.rollingBack) return;
  if (!currentUserCan("content.publish")) return showToast("没有官网回滚权限", "请由管理员或具备发布权限的成员执行。", "error");
  if (!await uiConfirm(`确认将整站恢复到 v${releaseVersion}？系统会创建一个新的正式版本，当前历史不会被删除。`)) return;
  siteCmsRuntime.rollingBack = true;
  try {
    const payload = await productionApi("/api/v1/site-cms/rollback", { method: "POST", body: { releaseId, expectedCurrentVersion: siteCmsRuntime.publication?.version, note: `整站恢复到 v${releaseVersion}` } });
    applySiteCmsApiPayload(payload);
    await refreshSiteCmsFromServer();
    closeModal();
    render();
    showToast("官网已完成回滚", `历史 v${releaseVersion} 已恢复为新的正式版本 v${siteCmsRuntime.publication?.version}。`, "success");
  } catch (error) {
    showToast("官网回滚失败", error.message || "请刷新发布历史后重试。", "error");
  } finally {
    siteCmsRuntime.rollingBack = false;
  }
}

function renderSitePageEditorModal() {
  const page = ui.modal?.pageId ? sitePageDefinition(ui.modal.pageId) : null;
  const isNew = !page;
  const sourceOptions = sitePages().filter((item) => item.id !== page?.id).map((item) => `<option value="${escapeHtml(item.id)}">复制 ${escapeHtml(item.title)} 的模块</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新建专题页" : "编辑页面"}</h2><p>专题页会先保存为草稿；页面正文仍由模块和关联知识决定。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-new-page-title">页面标题 *</label><input class="input" id="site-new-page-title" value="${escapeHtml(page?.title || "")}" placeholder="例如：制造业 AI 搜索优化" /></div><div class="field"><label for="site-new-page-type">页面类型</label><select class="select" id="site-new-page-type"><option ${page?.type === "专题页" ? "selected" : ""}>专题页</option><option ${page?.type === "服务页" ? "selected" : ""}>服务页</option><option ${page?.type === "落地页" ? "selected" : ""}>落地页</option><option ${page?.type === "FAQ 页" ? "selected" : ""}>FAQ 页</option></select></div></div><div class="field"><label for="site-new-page-path">页面路径 *</label><input class="input" id="site-new-page-path" value="${escapeHtml(page?.path || "/topics/")}" placeholder="/topics/manufacturing-geo/" /><small class="field-help">路径唯一；修改已有页面路径时会自动增加 301 重定向。</small></div><div class="field"><label for="site-new-page-description">页面说明 / SEO 描述</label><textarea class="textarea" id="site-new-page-description" rows="4">${escapeHtml(page?.seoDescription || page?.description || "")}</textarea></div>${isNew ? `<div class="field"><label for="site-new-page-template">初始模块</label><select class="select" id="site-new-page-template"><option value="blank">空白页面（后续自行添加模块）</option>${sourceOptions}</select></div>` : ""}</div><div class="modal-foot"><span>${isNew ? "创建后可继续添加语义模块" : "保存后更新官网草稿，正式版本由顶部发布操作生成"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-submit-page" data-page-id="${escapeHtml(page?.id || "")}"><span data-icon="check"></span>${isNew ? "创建页面" : "保存页面"}</button></div></div>`, { wide: true });
}

function submitSitePage(pageId) {
  const title = siteValue("site-new-page-title");
  const path = sitePath(siteValue("site-new-page-path"));
  const description = siteValue("site-new-page-description");
  const type = siteValue("site-new-page-type") || "专题页";
  if (!title || !path) return showToast("请填写页面标题和路径", "页面标题和路径是必填项。", "error");
  const page = pageId ? sitePages().find((item) => item.id === pageId) : null;
  const conflict = sitePages().find((item) => item.id !== pageId && item.path === path);
  if (conflict) return showToast("页面路径已存在", `“${conflict.title}”正在使用 ${path}。`, "error");
  if (page) {
    const oldPath = page.path;
    Object.assign(page, { title, path, type, description: description || page.description, seoDescription: description || page.seoDescription, version: (Number(page.version) || 1) + 1, savedAt: siteNow() });
    if (oldPath !== path) siteAddRedirect(oldPath, path, `页面“${title}”路径调整`);
    ui.sitePageId = page.id;
  } else {
    const id = uid("PAGE").toLowerCase();
    const template = siteValue("site-new-page-template");
    const newPage = { id, type, title, path, status: "draft", description: description || `${title} 页面说明`, seoDescription: description || `${title} 页面说明`, schemaEnabled: true, sitemapEnabled: true, version: 1, savedAt: siteNow(), publishedAt: null };
    sitePages().push(newPage);
    siteCms().modules[id] = template && template !== "blank" ? cloneData(siteModules(template)).map((module, index) => ({ ...module, id: `${id}-module-${index + 1}` })) : [];
    ui.sitePageId = id;
  }
  saveState();
  closeModal();
  ui.siteTab = "pages";
  render();
  showToast(page ? "页面已更新" : "专题页已创建", `${title} 已保存为草稿，可以继续配置模块和预览。`, "success");
}

function renderSiteModuleModal() {
  const pageId = ui.modal?.pageId || ui.sitePageId;
  const modules = siteModules(pageId);
  const module = ui.modal?.moduleId ? modules.find((item) => item.id === ui.modal.moduleId) : null;
  const isNew = !module;
  const moduleTypes = [["hero", "首屏（hero）"], ["answer", "直接答案"], ["services", "产品服务"], ["process", "合作流程"], ["proof", "证据与案例"], ["entity", "企业信息"], ["principles", "工作原则"], ["boundary", "交付边界"], ["insights", "行业资讯"], ["articles", "文章列表"], ["problem-map", "问题地图"], ["faq", "常见问题"], ["contact", "联系方式"], ["form", "咨询表单"], ["cta", "行动入口"], ["content", "通用内容"]];
  const moduleTypeOptions = moduleTypes.map(([value, label]) => `<option value="${value}" ${module?.type === value || (!module && value === "content") ? "selected" : ""}>${label}</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加语义模块" : "编辑语义模块"}</h2><p>模块展示的是可解释的页面语义；正文可以引用企业知识、案例、栏目或公共组件。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-module-title">模块名称 *</label><input class="input" id="site-module-title" value="${escapeHtml(module?.title || "")}" placeholder="例如：客户常见问题" /></div><div class="field"><label for="site-module-type">模块类型</label><select class="select" id="site-module-type">${moduleTypeOptions}</select></div><div class="field"><label for="site-module-status">展示状态</label><select class="select" id="site-module-status"><option value="published" ${module?.status === "published" ? "selected" : ""}>已发布</option><option value="draft" ${!module || module?.status === "draft" ? "selected" : ""}>草稿</option><option value="hidden" ${module?.status === "hidden" ? "selected" : ""}>隐藏</option></select></div></div><div class="field"><label for="site-module-eyebrow">眉题 / AI 标签</label><input class="input" id="site-module-eyebrow" value="${escapeHtml(module?.eyebrow || "")}" placeholder="例如：DIRECT ANSWER" /></div><div class="field"><label for="site-module-source">内容来源</label><input class="input" id="site-module-source" value="${escapeHtml(module?.source || "页面内容")}" placeholder="例如：企业知识库 / 已审核案例库" /></div><div class="field"><label for="site-module-description">模块说明</label><textarea class="textarea" id="site-module-description" rows="3">${escapeHtml(module?.description || "")}</textarea></div><div class="field"><label for="site-module-content">预览文案</label><textarea class="textarea" id="site-module-content" rows="5">${escapeHtml(module?.content || "")}</textarea></div>${module?.type === "hero" ? `<div class="field"><label>数据条（首页数字，每行一组数字+标签，最多 5 组）</label>${[0, 1, 2, 3, 4].map((i) => `<div class="field-row"><div class="field"><input class="input" data-module-stat-number="${i}" placeholder="数字，如 20" value="${escapeHtml(module?.stats?.[i]?.[0] || "")}" /></div><div class="field"><input class="input" data-module-stat-label="${i}" placeholder="标签，如 年行业经验" value="${escapeHtml(module?.stats?.[i]?.[1] || "")}" /></div></div>`).join("")}<small>不填数字的行会忽略；全部留空则使用模板默认数据。</small></div>` : ""}<div class="field-row"><div class="field"><label for="site-module-cta-label">CTA 文案</label><input class="input" id="site-module-cta-label" value="${escapeHtml(module?.ctaLabel || "")}" placeholder="例如：了解服务" /></div><div class="field"><label for="site-module-cta-href">CTA 地址</label><input class="input" id="site-module-cta-href" value="${escapeHtml(module?.ctaHref || "/contact/")}" placeholder="/contact/" /></div></div></div><div class="modal-foot"><span>${isNew ? "添加后会出现在当前页面末尾" : "模块变更会随官网草稿保存，正式发布后同步到官网"}</span><div class="modal-foot-right">${!isNew && modules.length > 1 ? `<button class="danger-button" type="button" data-action="site-delete-module" data-page-id="${escapeHtml(pageId)}" data-module-id="${escapeHtml(module.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-module" data-page-id="${escapeHtml(pageId)}" data-module-id="${escapeHtml(module?.id || "")}"><span data-icon="check"></span>保存模块</button></div></div>`, { wide: true });
}

function saveSiteModule(pageId, moduleId) {
  const title = siteValue("site-module-title");
  if (!title) return showToast("请填写模块名称", "模块名称不能为空。", "error");
  const modules = siteCms().modules[pageId] || (siteCms().modules[pageId] = []);
  const page = sitePages().find((item) => item.id === pageId);
  const existing = modules.find((item) => item.id === moduleId);
  const values = { type: siteValue("site-module-type") || "content", title, eyebrow: siteValue("site-module-eyebrow"), source: siteValue("site-module-source") || "页面内容", description: siteValue("site-module-description"), content: siteValue("site-module-content"), ctaLabel: siteValue("site-module-cta-label"), ctaHref: sitePath(siteValue("site-module-cta-href"), "/contact/"), status: siteValue("site-module-status") || "draft" };
  const statRows = [];
  for (let statIndex = 0; statIndex < 5; statIndex += 1) {
    const statNumber = String(document.querySelector(`[data-module-stat-number="${statIndex}"]`)?.value || "").trim();
    const statLabel = String(document.querySelector(`[data-module-stat-label="${statIndex}"]`)?.value || "").trim();
    if (statNumber) statRows.push([statNumber, statLabel]);
  }
  if (statRows.length) values.stats = statRows;
  if (existing) Object.assign(existing, values);
  else modules.push({ id: uid("MODULE"), ...values });
  if (page) { page.savedAt = siteNow(); page.version = (Number(page.version) || 1) + 1; }
  saveState();
  closeModal();
  render();
  showToast(existing ? "模块已更新" : "模块已添加", "页面模块已保存，可在预览中查看。", "success");
}

async function deleteSiteModule(pageId, moduleId) {
  if (!(await uiConfirm("确认删除该语义模块？"))) return;
  const modules = siteCms().modules[pageId] || [];
  if (modules.length <= 1) return showToast("至少保留一个模块", "页面至少需要保留一个内容模块。", "error");
  const page = sitePages().find((item) => item.id === pageId);
  siteCms().modules[pageId] = modules.filter((item) => item.id !== moduleId);
  if (page) { page.savedAt = siteNow(); page.version = (Number(page.version) || 1) + 1; }
  saveState();
  await commitSiteCmsDraft();
  closeModal();
  render();
  showToast("模块已删除", "页面其余模块不会受到影响。", "success");
}

function renderSiteServiceModal() {
  const service = ui.modal?.serviceId ? siteServices().find((item) => item.id === ui.modal.serviceId) : null;
  const isNew = !service;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新增官网服务" : "编辑官网服务"}</h2><p>服务内容会出现在首页和“产品与服务”页面，正式发布后成为公开信源。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-service-title">服务名称 *</label><input class="input" id="site-service-title" value="${escapeHtml(service?.title || "")}" placeholder="例如：GEO 服务" /></div><div class="field"><label for="site-service-eyebrow">英文标签</label><input class="input" id="site-service-eyebrow" value="${escapeHtml(service?.eyebrow || "SERVICE")}" /></div></div><div class="field"><label for="site-service-description">服务说明 *</label><textarea class="textarea" id="site-service-description" rows="4">${escapeHtml(service?.description || "")}</textarea></div><div class="field"><label for="site-service-audience">适合对象</label><textarea class="textarea" id="site-service-audience" rows="2">${escapeHtml(service?.audience || "")}</textarea></div><div class="field"><label for="site-service-focus">工作重点</label><textarea class="textarea" id="site-service-focus" rows="2">${escapeHtml(service?.focus || "")}</textarea></div><div class="site-optional-media-field"><div><label for="site-service-image">服务图片（可选）</label><small>有图片就展示，没有图片自动使用无图布局。</small></div><input class="input" id="site-service-image" value="${escapeHtml(service?.image || "")}" placeholder="https://... 或 /assets/..." /><input class="input" id="site-service-image-alt" value="${escapeHtml(service?.imageAlt || service?.title || "服务图片")}" placeholder="图片说明（用于无障碍）" /></div><div class="field-row"><div class="field"><label for="site-service-href">行动地址</label><input class="input" id="site-service-href" value="${escapeHtml(service?.href || "/contact/")}" /></div><div class="field"><label for="site-service-order">排序</label><input class="input" id="site-service-order" type="number" min="1" value="${escapeHtml(service?.order || siteServices().length + 1)}" /></div><div class="field"><label for="site-service-status">公开状态</label><select class="select" id="site-service-status"><option value="published" ${service?.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${!service || service?.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${service?.status === "archived" ? "selected" : ""}>归档</option></select></div></div></div><div class="modal-foot"><span>保存后进入官网草稿，预览确认后再统一发布。</span><div class="modal-foot-right">${service && service.status !== "archived" ? `<button class="danger-button" type="button" data-action="site-archive-cms-record" data-kind="service" data-record-id="${escapeHtml(service.id)}">归档</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-service" data-service-id="${escapeHtml(service?.id || "")}"><span data-icon="check"></span>保存服务</button></div></div>`, { wide: true });
}

function saveSiteService(serviceId) {
  const title = siteValue("site-service-title");
  const description = siteValue("site-service-description");
  if (!title || !description) return showToast("请补全服务内容", "服务名称和服务说明不能为空。", "error");
  const rows = siteCms().services || (siteCms().services = []);
  const existing = rows.find((item) => item.id === serviceId);
  const values = { title, eyebrow: siteValue("site-service-eyebrow") || "SERVICE", description, audience: siteValue("site-service-audience"), focus: siteValue("site-service-focus"), image: siteValue("site-service-image"), imageAlt: siteValue("site-service-image-alt") || title, href: sitePath(siteValue("site-service-href"), "/contact/"), order: Math.max(1, Number(siteValue("site-service-order")) || rows.length + 1), status: siteValue("site-service-status") || "draft", updatedAt: siteNow() };
  if (existing) Object.assign(existing, values);
  else rows.push({ id: `service-${siteSlug(title, uid("service").toLowerCase())}`, ...values });
  saveState(); closeModal(); ui.siteTab = "catalog"; ui.siteCatalogTab = "services"; render();
  showToast(existing ? "服务已更新" : "服务已创建", "变更已保存到官网草稿。", "success");
}

function renderSiteCaseModal() {
  const item = ui.modal?.caseId ? siteCases().find((entry) => entry.id === ui.modal.caseId) : null;
  const isNew = !item;
  const options = siteServices(false).map((service) => `<option value="${escapeHtml(service.id)}" data-title="${escapeHtml(service.title)}" ${item?.serviceId === service.id || item?.service === service.title ? "selected" : ""}>${escapeHtml(service.title)}</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新增服务案例" : "编辑服务案例"}</h2><p>公开案例应完成授权、脱敏和事实核对，不填写无法验证的结果。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="site-case-title">案例标题 *</label><input class="input" id="site-case-title" value="${escapeHtml(item?.title || "")}" /></div><div class="field-row"><div class="field"><label for="site-case-industry">所属行业</label><input class="input" id="site-case-industry" value="${escapeHtml(item?.industry || "")}" placeholder="例如：制造业" /></div><div class="field"><label for="site-case-service">关联服务</label><select class="select" id="site-case-service"><option value="">暂不关联</option>${options}</select></div></div><div class="field"><label for="site-case-summary">实施摘要 *</label><textarea class="textarea" id="site-case-summary" rows="4">${escapeHtml(item?.summary || "")}</textarea></div><div class="field"><label for="site-case-result">形成结果 *</label><textarea class="textarea" id="site-case-result" rows="3">${escapeHtml(item?.result || "")}</textarea></div><div class="site-optional-media-field"><div><label for="site-case-image">案例图片（可选）</label><small>没有图片时使用内容布局，不强行显示图片框。</small></div><input class="input" id="site-case-image" value="${escapeHtml(item?.image || "")}" placeholder="https://... 或 /assets/..." /><input class="input" id="site-case-image-alt" value="${escapeHtml(item?.imageAlt || item?.title || "案例图片")}" placeholder="图片说明（用于无障碍）" /></div><div class="field-row"><div class="field"><label for="site-case-order">排序</label><input class="input" id="site-case-order" type="number" min="1" value="${escapeHtml(item?.order || siteCases().length + 1)}" /></div><div class="field"><label for="site-case-status">公开状态</label><select class="select" id="site-case-status"><option value="published" ${item?.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${!item || item?.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>归档</option></select></div></div></div><div class="modal-foot"><span>案例归档后不再显示，但历史正式版本仍可回滚。</span><div class="modal-foot-right">${item && item.status !== "archived" ? `<button class="danger-button" type="button" data-action="site-archive-cms-record" data-kind="case" data-record-id="${escapeHtml(item.id)}">归档</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-case" data-case-id="${escapeHtml(item?.id || "")}"><span data-icon="check"></span>保存案例</button></div></div>`, { wide: true });
}

function saveSiteCase(caseId) {
  const title = siteValue("site-case-title"); const summary = siteValue("site-case-summary"); const result = siteValue("site-case-result");
  if (!title || !summary || !result) return showToast("请补全案例内容", "案例标题、实施摘要和形成结果不能为空。", "error");
  const rows = siteCms().cases || (siteCms().cases = []); const existing = rows.find((item) => item.id === caseId);
  const serviceId = siteValue("site-case-service"); const service = siteServices().find((entry) => entry.id === serviceId);
  const values = { title, industry: siteValue("site-case-industry") || "中小企业", serviceId, service: service?.title || existing?.service || "企业服务", summary, result, image: siteValue("site-case-image"), imageAlt: siteValue("site-case-image-alt") || title, href: "/contact/", order: Math.max(1, Number(siteValue("site-case-order")) || rows.length + 1), status: siteValue("site-case-status") || "draft", updatedAt: siteNow() };
  if (existing) Object.assign(existing, values); else rows.push({ id: `case-${siteSlug(title, uid("case").toLowerCase())}`, ...values });
  saveState(); closeModal(); ui.siteTab = "catalog"; ui.siteCatalogTab = "cases"; render();
  showToast(existing ? "案例已更新" : "案例已创建", "变更已保存到官网草稿。", "success");
}

function renderSiteProblemGroupModal() {
  const group = ui.modal?.groupId ? siteProblemGroups().find((item) => item.id === ui.modal.groupId) : null;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${group ? "编辑问题分组" : "新增问题分组"}</h2><p>问题分组通常对应一项服务方向，帮助客户和 AI 理解问题所属语境。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-problem-group-title">分组名称 *</label><input class="input" id="site-problem-group-title" value="${escapeHtml(group?.title || "")}" /></div><div class="field"><label for="site-problem-group-service">服务方向 *</label><input class="input" id="site-problem-group-service" value="${escapeHtml(group?.service || "")}" /></div></div><div class="field"><label for="site-problem-group-description">分组说明</label><textarea class="textarea" id="site-problem-group-description" rows="3">${escapeHtml(group?.description || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-problem-group-order">排序</label><input class="input" id="site-problem-group-order" type="number" min="1" value="${escapeHtml(group?.order || siteProblemGroups().length + 1)}" /></div><div class="field"><label for="site-problem-group-status">公开状态</label><select class="select" id="site-problem-group-status"><option value="published" ${group?.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${!group || group?.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${group?.status === "archived" ? "selected" : ""}>归档</option></select></div></div></div><div class="modal-foot"><span>分组归档会同时从问题地图隐藏其问题。</span><div class="modal-foot-right">${group && group.status !== "archived" ? `<button class="danger-button" type="button" data-action="site-archive-cms-record" data-kind="group" data-record-id="${escapeHtml(group.id)}">归档</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-problem-group" data-group-id="${escapeHtml(group?.id || "")}"><span data-icon="check"></span>保存分组</button></div></div>`, { wide: true });
}

function saveSiteProblemGroup(groupId) {
  const title = siteValue("site-problem-group-title"); const service = siteValue("site-problem-group-service");
  if (!title || !service) return showToast("请补全问题分组", "分组名称和服务方向不能为空。", "error");
  const rows = siteCms().problemGroups || (siteCms().problemGroups = []); const existing = rows.find((item) => item.id === groupId);
  const values = { title, service, description: siteValue("site-problem-group-description"), order: Math.max(1, Number(siteValue("site-problem-group-order")) || rows.length + 1), status: siteValue("site-problem-group-status") || "draft", updatedAt: siteNow() };
  if (existing) Object.assign(existing, values); else rows.push({ id: `problem-group-${siteSlug(service, uid("group").toLowerCase())}`, serviceId: "", questions: [], ...values });
  saveState(); closeModal(); ui.siteTab = "problems"; render(); showToast(existing ? "问题分组已更新" : "问题分组已创建", "变更已保存到官网草稿。", "success");
}

function renderSiteQuestionModal() {
  const groups = siteProblemGroups();
  const group = groups.find((item) => item.id === ui.modal?.groupId) || groups[0];
  const question = group?.questions?.find((item) => item.id === ui.modal?.questionId) || null;
  const relatedIds = new Set(question?.relatedArticleIds || []);
  const groupOptions = groups.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === group?.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("");
  const articleOptions = (state.articles || []).filter((article) => article.reviewStatus === "approved" || article.status === "published").map((article) => `<option value="${escapeHtml(article.id)}" ${relatedIds.has(article.id) ? "selected" : ""}>${escapeHtml(article.title)}</option>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${question ? "编辑客户问题" : "新增客户问题"}</h2><p>问题必须像客户真实会问的问题；直接回答先给结论，再说明适用范围。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-question-group">所属分组 *</label><select class="select" id="site-question-group">${groupOptions}</select></div><div class="field"><label for="site-question-status">公开状态</label><select class="select" id="site-question-status"><option value="published" ${question?.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${!question || question?.status === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${question?.status === "archived" ? "selected" : ""}>归档</option></select></div></div><div class="field"><label for="site-question-title">客户问题 *</label><input class="input" id="site-question-title" value="${escapeHtml(question?.title || "")}" placeholder="例如：工业品企业做 GEO 应该从哪里开始？" /></div><div class="field"><label for="site-question-answer">直接回答 *</label><textarea class="textarea" id="site-question-answer" rows="5">${escapeHtml(question?.answer || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-question-slug">页面 slug</label><input class="input" id="site-question-slug" value="${escapeHtml(question?.slug || "")}" placeholder="industrial-geo-start" /></div><div class="field"><label for="site-question-industries">适用行业</label><input class="input" id="site-question-industries" value="${escapeHtml((question?.industries || []).join("、"))}" placeholder="工业品、制造业" /></div><div class="field"><label for="site-question-order">排序</label><input class="input" id="site-question-order" type="number" min="1" value="${escapeHtml(question?.order || (group?.questions?.length || 0) + 1)}" /></div></div><div class="field"><label for="site-question-articles">关联已审核文章（可多选）</label><select class="select" id="site-question-articles" multiple size="5">${articleOptions}</select><small class="field-help">按住 Ctrl 可选择多篇；文章正文仍由内容生产中心维护。</small></div></div><div class="modal-foot"><span>问题详情地址会自动生成，并输出 QAPage 结构化数据。</span><div class="modal-foot-right">${question && question.status !== "archived" ? `<button class="danger-button" type="button" data-action="site-archive-cms-record" data-kind="question" data-record-id="${escapeHtml(question.id)}" data-group-id="${escapeHtml(group.id)}">归档</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-question" data-question-id="${escapeHtml(question?.id || "")}" data-original-group-id="${escapeHtml(group?.id || "")}"><span data-icon="check"></span>保存问题</button></div></div>`, { wide: true });
}

function saveSiteQuestion(questionId, originalGroupId) {
  const title = siteValue("site-question-title"); const answer = siteValue("site-question-answer"); const targetGroupId = siteValue("site-question-group");
  if (!title || !answer || !targetGroupId) return showToast("请补全问题内容", "所属分组、客户问题和直接回答不能为空。", "error");
  const groups = siteCms().problemGroups || []; const target = groups.find((item) => item.id === targetGroupId);
  if (!target) return showToast("问题分组不存在", "请刷新后重新选择问题分组。", "error");
  const slug = siteSlug(siteValue("site-question-slug") || title, `question-${Date.now()}`);
  const duplicate = groups.flatMap((group) => group.questions || []).find((item) => item.id !== questionId && item.slug === slug);
  if (duplicate) return showToast("问题地址已存在", `请为“${duplicate.title}”之外的问题使用不同的 slug。`, "error");
  const original = groups.find((item) => item.id === originalGroupId); const existing = original?.questions?.find((item) => item.id === questionId);
  const values = { title, answer, slug, industries: siteCommaList(siteValue("site-question-industries")), relatedArticleIds: siteValues("site-question-articles"), relatedServiceId: target.serviceId || "", order: Math.max(1, Number(siteValue("site-question-order")) || (target.questions?.length || 0) + 1), status: siteValue("site-question-status") || "draft", updatedAt: siteNow() };
  if (existing && original.id === target.id) Object.assign(existing, values);
  else {
    if (existing) original.questions = (original.questions || []).filter((item) => item.id !== existing.id);
    if (!Array.isArray(target.questions)) target.questions = [];
    target.questions.push({ id: existing?.id || `question-${siteSlug(title, uid("question").toLowerCase())}`, ...values });
  }
  saveState(); closeModal(); ui.siteTab = "problems"; render(); showToast(existing ? "问题已更新" : "问题已创建", "问题与直接回答已保存到官网草稿。", "success");
}

async function archiveSiteCmsRecord(kind, recordId, groupId = "") {
  if (!(await uiConfirm("确认归档该记录？归档后不会出现在官网，可随时改回。"))) return;
  let item = null;
  if (kind === "service") item = (siteCms().services || []).find((entry) => entry.id === recordId);
  else if (kind === "case") item = (siteCms().cases || []).find((entry) => entry.id === recordId);
  else if (kind === "group") item = (siteCms().problemGroups || []).find((entry) => entry.id === recordId);
  else if (kind === "question") item = (siteCms().problemGroups || []).find((entry) => entry.id === groupId)?.questions?.find((entry) => entry.id === recordId);
  if (!item) return showToast("内容不存在", "请刷新页面后重试。", "error");
  item.status = "archived"; item.updatedAt = siteNow(); saveState(); await commitSiteCmsDraft(); closeModal(); render();
  showToast("内容已归档", "正式官网将在下一次发布后隐藏该内容，历史版本仍然保留。", "success");
}

function renderSiteCategoryManagerModal() {
  const rows = siteCategories(true).map((category) => `<div class="site-nav-row"><div><b>${escapeHtml(category.name)}</b><small>/insights/category/${escapeHtml(category.slug)}/ · ${siteCategoryCount(category)} 篇文章</small></div><span class="status-badge ${category.status === "active" ? "status-approved" : "status-draft"}">${category.status === "active" ? "启用" : "已归档"}</span><button class="secondary-button button-small" type="button" data-action="site-edit-category" data-category-id="${escapeHtml(category.id)}">编辑</button></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">资讯栏目管理</h2><p>栏目可改名、停用或归档；修改 slug 会自动创建 301 重定向。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="site-nav-list">${rows}</div></div><div class="modal-foot"><span>${siteCategories().length} 个启用栏目 · ${siteCategories(true).filter((item) => item.status === "archived").length} 个归档栏目</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">完成</button><button class="primary-button" type="button" data-action="site-add-category"><span data-icon="plus"></span>新增栏目</button></div></div>`, { wide: true });
}

function renderSiteCategoryModal() {
  const category = ui.modal?.categoryId ? siteCategories(true).find((item) => item.id === ui.modal.categoryId) : null;
  const isNew = !category;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "新增资讯栏目" : "编辑资讯栏目"}</h2><p>官网栏目可由每个客户独立配置，不等同于内部产品或业务线。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-category-name">栏目名称 *</label><input class="input" id="site-category-name" value="${escapeHtml(category?.name || "")}" /></div><div class="field"><label for="site-category-slug">栏目 slug *</label><input class="input" id="site-category-slug" value="${escapeHtml(category?.slug || "")}" placeholder="industry-news" /></div></div><div class="field"><label for="site-category-description">栏目说明</label><textarea class="textarea" id="site-category-description" rows="3">${escapeHtml(category?.description || "")}</textarea></div><div class="field"><label for="site-category-seo">SEO / AI 摘要</label><textarea class="textarea" id="site-category-seo" rows="3">${escapeHtml(category?.seoDescription || "")}</textarea></div><div class="field-row"><div class="field"><label for="site-category-status">栏目状态</label><select class="select" id="site-category-status"><option value="active" ${category?.status !== "archived" ? "selected" : ""}>启用</option><option value="archived" ${category?.status === "archived" ? "selected" : ""}>归档</option></select></div><label class="field"><span>导航显示</span><span class="check-line"><input type="checkbox" id="site-category-nav" ${category?.navVisible !== false ? "checked" : ""} /> 显示在资讯导航中</span></label></div>${category && siteCategoryCount(category) ? `<div class="archive-impact-note"><span data-icon="info"></span><span>该栏目已有 ${siteCategoryCount(category)} 篇文章，不能永久删除；可以停用或归档，文章仍保留历史归属。</span></div>` : ""}</div><div class="modal-foot"><span>${isNew ? "新栏目创建后立即可在文章发布时选择" : "变更会同步栏目页和导航"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-category" data-category-id="${escapeHtml(category?.id || "")}"><span data-icon="check"></span>保存栏目</button></div></div>`, { wide: true });
}

function saveSiteCategory(categoryId) {
  const name = siteValue("site-category-name");
  const slug = siteSlug(siteValue("site-category-slug"), siteSlug(name, "category"));
  if (!name) return showToast("请填写栏目名称", "栏目名称不能为空。", "error");
  const conflict = siteCategories(true).find((item) => item.id !== categoryId && (item.name === name || item.slug === slug));
  if (conflict) return showToast("栏目名称或 slug 已存在", `请与“${conflict.name}”使用不同的名称和地址。`, "error");
  const categories = siteCms().categories;
  const category = categories.find((item) => item.id === categoryId);
  const values = { name, slug, description: siteValue("site-category-description"), seoDescription: siteValue("site-category-seo"), status: siteValue("site-category-status") || "active", navVisible: siteChecked("site-category-nav"), updatedAt: siteNow() };
  if (category) {
    const oldName = category.name;
    const oldSlug = category.slug;
    Object.assign(category, values);
    state.articles.forEach((article) => {
      if (article.siteCategory === oldName) article.siteCategory = name;
      else if (article.category === oldName) article.siteCategory = name;
    });
    if (oldSlug !== slug) siteAddRedirect(`/insights/category/${oldSlug}/`, `/insights/category/${slug}/`, `栏目“${name}”slug 调整`);
  } else {
    categories.push({ id: uid("CATEGORY"), level: 1, count: 0, createdAt: siteNow(), ...values });
  }
  saveState();
  closeModal();
  ui.siteTab = "insights";
  ui.siteContentTab = "categories";
  render();
  showToast(category ? "栏目已更新" : "栏目已创建", `“${name}”已保存，文章发布时可以选择该栏目。`, "success");
}

function renderSiteArticlePreviewModal() {
  const article = state.articles.find((item) => item.id === ui.modal?.articleId);
  if (!article) return "";
  const category = article.siteCategory || article.category || "待归类";
  const slug = article.siteSlug || article.id.toLowerCase();
  const body = sanitizeStudioHtml(articleContentForPublicPreview(article) || `<p>${escapeHtml(article.excerpt || "尚无正文预览")}</p>`);
  const citations = articleCitations(article);
  const schemaPreview = { "@context": "https://schema.org", "@type": "Article", headline: article.title, author: article.siteAuthor || article.author || "企业内容团队", articleSection: category, url: `https://${state.site.domain}/insights/${slug}/` };
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网文章预览</h2><p>${escapeHtml(article.id)} · ${escapeHtml(article.version || "v1")} · ${escapeHtml(category)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><article class="site-preview"><span class="small-tag blue">${escapeHtml(category)}</span><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.siteExcerpt || article.excerpt || "")}</p><div class="site-preview-meta"><span>${escapeHtml(article.siteAuthor || article.author || "企业内容团队")}</span><span>·</span><span>${escapeHtml(article.sitePublishedAt ? siteDisplayTime(article.sitePublishedAt) : "预览未发布")}</span></div><div class="article-content read-only">${body}</div></article><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>知识证据</b><small>${citations.length} 条引用随当前版本冻结</small></span></div><div><span class="check-dot ok">✓</span><span><b>Article Schema</b><small>${escapeHtml(JSON.stringify(schemaPreview))}</small></span></div></div></div><div class="modal-foot"><span>预览地址 /insights/${escapeHtml(slug)}/</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button>${article.siteStatus === "published" ? "" : article.reviewStatus === "approved" && article.riskStatus === "clean" && citations.length ? `<button class="primary-button" type="button" data-action="site-publish-article" data-article-id="${escapeHtml(article.id)}"><span data-icon="send"></span>发布到官网</button>` : ""}</div></div>`, { wide: true });
}

function renderSiteNavModal() {
  const navItem = ui.modal?.navId ? siteNavItems().find((item) => item.id === ui.modal.navId) : null;
  const isNew = !navItem;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加导航项" : "编辑导航项"}</h2><p>导航可以指向固定页面、资讯栏目或自定义站内地址。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-nav-label">导航名称 *</label><input class="input" id="site-nav-label" value="${escapeHtml(navItem?.label || "")}" /></div><div class="field"><label for="site-nav-type">链接类型</label><select class="select" id="site-nav-type"><option ${navItem?.type === "固定页面" ? "selected" : ""}>固定页面</option><option ${navItem?.type === "资讯列表" ? "selected" : ""}>资讯列表</option><option ${navItem?.type === "资讯栏目" ? "selected" : ""}>资讯栏目</option><option ${navItem?.type === "自定义链接" ? "selected" : ""}>自定义链接</option></select></div></div><div class="field"><label for="site-nav-path">站内地址 *</label><input class="input" id="site-nav-path" value="${escapeHtml(navItem?.path || "/")}" /></div><label class="field"><span>显示状态</span><span class="check-line"><input type="checkbox" id="site-nav-visible" ${navItem?.visible !== false ? "checked" : ""} /> 在主导航显示</span></label></div><div class="modal-foot"><span>导航顺序按列表保存，新增项会排在末尾</span><div class="modal-foot-right">${!isNew ? `<button class="danger-button" type="button" data-action="site-delete-nav" data-nav-id="${escapeHtml(navItem.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-nav" data-nav-id="${escapeHtml(navItem?.id || "")}"><span data-icon="check"></span>保存导航</button></div></div>`, { wide: true });
}

function footerLinkText(links = []) {
  return links.map((link) => `${link.label || "链接"} | ${link.href || "/"}`).join("\n");
}

function parseFooterLinkText(value) {
  const rows = String(value || "").split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const links = [];
  for (const row of rows.slice(0, 12)) {
    const separator = row.indexOf("|");
    if (separator < 1) return { error: "每行请按“名称 | 地址”填写。" };
    const label = row.slice(0, separator).trim();
    const href = row.slice(separator + 1).trim();
    if (!label || !href) return { error: "链接名称和地址都不能为空。" };
    if (!(/^(?:\/|https?:\/\/|mailto:|tel:)/i.test(href)) || href.startsWith("//")) return { error: `“${label}”的地址格式不正确。` };
    links.push({ id: uid("FOOTER-LINK"), label, href });
  }
  return { links };
}

function renderSiteFooterColumnModal() {
  const footer = siteCmsFooter();
  const column = footer.columns.find((item) => item.id === ui.modal?.columnId) || null;
  const isNew = !column;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加页脚栏目" : "编辑页脚栏目"}</h2><p>每行一个链接，格式为“显示名称 | /站内地址”或完整 HTTPS 地址。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="site-footer-column-title">栏目标题 *</label><input class="input" id="site-footer-column-title" value="${escapeHtml(column?.title || "")}" placeholder="例如：服务项目" /></div><div class="field"><label for="site-footer-column-links">栏目链接 *</label><textarea class="textarea" id="site-footer-column-links" rows="8" placeholder="建筑工程 | /services/\n项目案例 | /cases/">${escapeHtml(footerLinkText(column?.links || []))}</textarea><small class="field-help">支持站内地址、HTTPS、mailto: 和 tel: 链接，最多 12 条。</small></div></div><div class="modal-foot"><span>发布官网后，已适配模板会同步显示这个栏目。</span><div class="modal-foot-right">${!isNew ? `<button class="danger-button" type="button" data-action="site-footer-delete-column" data-column-id="${escapeHtml(column.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-footer-save-column" data-column-id="${escapeHtml(column?.id || "")}"><span data-icon="check"></span>保存栏目</button></div></div>`, { wide: true });
}

function saveSiteFooterColumn(columnId) {
  const title = siteValue("site-footer-column-title");
  const parsed = parseFooterLinkText(siteValue("site-footer-column-links"));
  if (!title) return showToast("请填写栏目标题", "页脚栏目标题不能为空。", "error");
  if (parsed.error) return showToast("页脚链接格式不正确", parsed.error, "error");
  if (!parsed.links.length) return showToast("请至少填写一个链接", "栏目需要至少一个公开入口。", "error");
  const footer = siteCmsFooter();
  const existing = footer.columns.find((item) => item.id === columnId);
  const next = { id: columnId || uid("FOOTER-COLUMN"), title, links: parsed.links, updatedAt: siteNow() };
  if (existing) Object.assign(existing, next);
  else footer.columns.push(next);
  saveState();
  closeModal();
  render();
  showToast(existing ? "页脚栏目已更新" : "页脚栏目已添加", "发布官网后，模板页脚会使用这组链接。", "success");
}

async function deleteSiteFooterColumn(columnId) {
  if (!(await uiConfirm("确认删除该页脚栏目？"))) return;
  const footer = siteCmsFooter();
  footer.columns = footer.columns.filter((item) => item.id !== columnId);
  saveState();
  await commitSiteCmsDraft();
  closeModal();
  render();
  showToast("页脚栏目已删除", "官网会恢复使用模板默认栏目。", "success");
}

function renderSiteFooterSocialModal() {
  const footer = siteCmsFooter();
  const link = footer.socialLinks.find((item) => item.id === ui.modal?.socialId) || null;
  const isNew = !link;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${isNew ? "添加页脚入口" : "编辑页脚入口"}</h2><p>维护公众号、视频号、企业主页或其他允许公开访问的入口。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="site-footer-social-label">入口名称 *</label><input class="input" id="site-footer-social-label" value="${escapeHtml(link?.label || "")}" placeholder="例如：企业公众号" /></div><div class="field"><label for="site-footer-social-href">入口地址 *</label><input class="input" id="site-footer-social-href" value="${escapeHtml(link?.href || "")}" placeholder="https://... 或 /contact/" /></div></div><div class="modal-foot"><span>地址会在官网页脚以可访问入口展示。</span><div class="modal-foot-right">${!isNew ? `<button class="danger-button" type="button" data-action="site-footer-delete-social" data-social-id="${escapeHtml(link.id)}">删除</button>` : ""}<button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-footer-save-social" data-social-id="${escapeHtml(link?.id || "")}"><span data-icon="check"></span>保存入口</button></div></div>`, { wide: true });
}

function saveSiteFooterSocial(socialId) {
  const label = siteValue("site-footer-social-label");
  const href = siteValue("site-footer-social-href");
  if (!label || !href) return showToast("请填写入口名称和地址", "两项都不能为空。", "error");
  if (!(/^(?:\/|https?:\/\/|mailto:|tel:)/i.test(href)) || href.startsWith("//")) return showToast("入口地址格式不正确", "请填写站内地址、HTTPS、mailto: 或 tel: 地址。", "error");
  const footer = siteCmsFooter();
  const existing = footer.socialLinks.find((item) => item.id === socialId);
  const next = { id: socialId || uid("FOOTER-SOCIAL"), label, href, updatedAt: siteNow() };
  if (existing) Object.assign(existing, next);
  else footer.socialLinks.push(next);
  saveState();
  closeModal();
  render();
  showToast(existing ? "页脚入口已更新" : "页脚入口已添加", "发布官网后，模板页脚会同步更新。", "success");
}

async function deleteSiteFooterSocial(socialId) {
  if (!(await uiConfirm("确认删除该页脚入口？"))) return;
  const footer = siteCmsFooter();
  footer.socialLinks = footer.socialLinks.filter((item) => item.id !== socialId);
  saveState();
  await commitSiteCmsDraft();
  closeModal();
  render();
  showToast("页脚入口已删除", "官网会恢复使用模板默认入口。", "success");
}

function saveSiteNav(navId) {
  const label = siteValue("site-nav-label");
  const path = sitePath(siteValue("site-nav-path"));
  if (!label || !path) return showToast("请填写导航名称和地址", "导航名称和站内地址不能为空。", "error");
  const navItems = siteCms().navItems;
  const item = navItems.find((entry) => entry.id === navId);
  const values = { label, path, type: siteValue("site-nav-type") || "自定义链接", visible: siteChecked("site-nav-visible"), updatedAt: siteNow() };
  if (item) Object.assign(item, values);
  else navItems.push({ id: uid("NAV"), ...values });
  saveState();
  closeModal();
  render();
  showToast(item ? "导航项已更新" : "导航项已添加", "保存外观设置后将形成新的主题版本。", "success");
}

async function deleteSiteNav(navId) {
  if (!(await uiConfirm("确认删除该导航项？对应页面和内容不会被删除。"))) return;
  siteCms().navItems = siteCms().navItems.filter((item) => item.id !== navId);
  saveState();
  await commitSiteCmsDraft();
  closeModal();
  render();
  showToast("导航项已删除", "对应页面和内容不会被删除。", "success");
}

function saveSiteAppearance() {
  const cms = siteCms();
  const theme = cms.theme;
  const assets = siteCmsAssets();
  const footer = siteCmsFooter();
  const templateConfigs = siteTemplateConfigs();
  const color = siteValue("site-theme-color");
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return showToast("品牌主色格式不正确", "请输入类似 #1D5CFF 的 6 位十六进制颜色。", "error");
  const validPublicAsset = (value) => !value || (/^\/(?!\/)/.test(value) || /^https?:\/\/[^\s]+$/i.test(value));
  const assetValues = [
    ["Logo", siteValue("site-assets-logo")],
    ["favicon", siteValue("site-assets-favicon")],
    ["默认图片", siteValue("site-assets-default-image")],
    ["ICP备案链接", siteValue("site-footer-icp-url")],
    ["公安备案链接", siteValue("site-footer-police-url")]
  ];
  const invalidAsset = assetValues.find(([, value]) => value && !validPublicAsset(value));
  if (invalidAsset) return showToast(`${invalidAsset[0]}地址格式不正确`, "请填写 HTTPS 图片/网页地址，或以 / 开头的站内地址。", "error");
  const templateImageValues = SITE_TEMPLATE_REGISTRY.map((template) => [template, document.getElementById(`site-template-default-image-${template.key}`)?.value.trim() || ""]);
  const invalidTemplateImage = templateImageValues.find(([, value]) => value && !validPublicAsset(value));
  if (invalidTemplateImage) return showToast(`${invalidTemplateImage[0].shortName}默认图片地址不正确`, "请填写 HTTPS 图片地址，或以 / 开头的站内地址。", "error");
  theme.name = siteValue("site-theme-name") || theme.name;
  theme.primaryColor = color || theme.primaryColor;
  theme.cta = siteValue("site-theme-cta") || theme.cta;
  theme.version = (Number(theme.version) || 1) + 1;
  theme.updatedAt = siteNow();
  assets.logoUrl = siteValue("site-assets-logo");
  assets.faviconUrl = siteValue("site-assets-favicon");
  assets.defaultImageUrl = siteValue("site-assets-default-image");
  assets.defaultImageAlt = siteValue("site-assets-default-image-alt") || "企业默认图片";
  cms.settings.logoUrl = assets.logoUrl;
  templateImageValues.forEach(([template, value]) => {
    templateConfigs[template.key] = { ...(templateConfigs[template.key] || {}), defaultImageUrl: value, defaultImageAlt: `${template.shortName}默认图片`, updatedAt: siteNow() };
  });
  footer.description = siteValue("site-footer-description");
  footer.copyright = siteValue("site-footer-copyright");
  footer.icpNumber = siteValue("site-footer-icp");
  footer.icpUrl = siteValue("site-footer-icp-url");
  footer.policeRecordNumber = siteValue("site-footer-police");
  footer.policeRecordUrl = siteValue("site-footer-police-url");
  footer.showIcp = siteChecked("site-footer-show-icp");
  footer.showPoliceRecord = siteChecked("site-footer-show-police");
  footer.showCopyright = siteChecked("site-footer-show-copyright");
  cms.theme = theme;
  state.site.theme = theme.name;
  saveState();
  render();
  showToast("导航与外观已保存", `已创建主题版本 v${theme.version}，公共素材和页脚配置已写入官网草稿。`, "success");
}

function renderSiteLeadFollowModal() {
  const lead = siteLeads().find((item) => item.id === ui.modal?.leadId);
  if (!lead) return "";
  const history = (lead.history || []).map((item) => `<div class="article-version-row"><span><b>${escapeHtml(item.note)}</b><small>${escapeHtml(item.owner || lead.owner || "未分配")} · ${escapeHtml(item.at || "")}</small></span><em>${item.status === "qualified" ? "有效商机" : item.status === "contacted" ? "已联系" : "新线索"}</em></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">线索跟进 · ${escapeHtml(lead.name)}</h2><p>${escapeHtml(lead.company)} · ${escapeHtml(lead.service)} · 来源 ${escapeHtml(lead.sourcePage || "官网")}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-lead-status">线索状态</label><select class="select" id="site-lead-status"><option value="new" ${lead.status === "new" ? "selected" : ""}>新线索</option><option value="contacted" ${lead.status === "contacted" ? "selected" : ""}>已联系</option><option value="qualified" ${lead.status === "qualified" ? "selected" : ""}>有效商机</option></select></div><div class="field"><label for="site-lead-owner">负责人</label><input class="input" id="site-lead-owner" value="${escapeHtml(lead.owner || "")}" /></div></div><div class="field"><label for="site-lead-next">下次跟进时间</label><input class="input" id="site-lead-next" value="${escapeHtml(lead.nextFollowAt || "")}" placeholder="例如：2026-07-28 10:00" /></div><div class="field"><label for="site-lead-note">本次跟进记录 *</label><textarea class="textarea" id="site-lead-note" rows="4" placeholder="记录沟通结果、客户需求和下一步安排">${escapeHtml(lead.notes || "")}</textarea></div>${history ? `<div class="field"><label>历史跟进记录</label><div class="article-version-list">${history}</div></div>` : '<div class="archive-impact-note"><span data-icon="info"></span><span>这是首次跟进，保存后会建立第一条沟通记录。</span></div>'}</div><div class="modal-foot"><span>线索编号 ${escapeHtml(lead.id)} · 提交于 ${escapeHtml(lead.createdAt)}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="site-save-lead" data-lead-id="${escapeHtml(lead.id)}"><span data-icon="check"></span>保存跟进</button></div></div>`, { wide: true });
}

async function saveSiteLead(leadId) {
  const lead = siteLeads().find((item) => item.id === leadId);
  if (!lead) return showToast("线索不存在", "请刷新页面后重试。", "error");
  const note = siteValue("site-lead-note");
  if (!note) return showToast("请填写跟进记录", "至少记录本次沟通结果或下一步安排。", "error");
  const status = siteValue("site-lead-status") || lead.status;
  const owner = siteValue("site-lead-owner") || "未分配";
  if (ui.savingSiteLeadId === leadId) return;
  ui.savingSiteLeadId = leadId;
  try {
    const payload = await productionApi(`/api/v1/site-cms/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: { status, owner, nextFollowAt: siteValue("site-lead-next"), note }
    });
    const updated = payload?.data?.lead || payload?.lead;
    if (!updated) throw new Error("线索接口未返回更新后的记录");
    const index = siteCmsRuntime.leads.findIndex((item) => item.id === leadId);
    if (index >= 0) siteCmsRuntime.leads[index] = updated;
    else siteCmsRuntime.leads.unshift(updated);
    const localLead = state.site.cms?.leads?.find((item) => item.id === leadId);
    if (localLead) Object.assign(localLead, updated);
    state.site.leads = siteCmsRuntime.leads.filter((item) => item.status === "new").length;
    saveState();
    closeModal();
    render();
    showToast("跟进记录已保存", `“${lead.name}”已更新为${status === "qualified" ? "有效商机" : status === "contacted" ? "已联系" : "新线索"}。`, "success");
  } catch (error) {
    showToast("跟进记录保存失败", error.message || "请刷新后重试。", "error");
  } finally {
    ui.savingSiteLeadId = "";
  }
}

function renderSiteDeploymentModal() {
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">官网发布机制</h2><p>后台 CMS 与官网服务使用同一生产数据库，发布动作由正式版本切换完成。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="manual-review-complete"><span data-icon="server"></span><div><b>官网服务已连接</b><p>保存草稿不会影响公开页面；点击“发布官网”后，官网、sitemap、RSS 与 llms.txt 同步读取新的正式版本。</p></div></div><div class="site-publish-checks"><div><span class="check-dot ok">✓</span><span><b>不可变正式版本</b><small>每次发布都生成新的版本记录，可从发布历史回滚。</small></span></div><div><span class="check-dot ok">✓</span><span><b>私有化部署</b><small>官网运行在客户自己的服务器，不依赖本地媒体发布助手。</small></span></div></div></div><div class="modal-foot"><span>域名、证书和进程由交付运维配置</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">关闭</button><button class="primary-button" type="button" data-action="site-show-releases">查看发布历史</button></div></div>`, { wide: true });
}

function saveSiteDeployment() {
  return showToast("部署配置由交付运维维护", "官网发布只切换 CMS 正式版本，服务器目录和证书不在业务后台中修改。", "info");
}

function testSiteDeployment() {
  return showToast("官网服务已连接", "正式官网与后台 CMS 使用同一数据库，当前页面可直接通过预览和发布流程验收。", "success");
}

function renderSiteRedirectsModal() {
  const redirects = siteCms().redirects || [];
  const rows = redirects.map((item) => `<div class="site-nav-row"><div><b>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</b><small>${escapeHtml(item.reason || "手动创建")} · ${escapeHtml(siteDisplayTime(item.updatedAt || item.createdAt))}</small></div><span class="status-badge ${item.status === "active" ? "status-approved" : "status-draft"}">${item.status === "active" ? "301 生效" : "已停用"}</span><button class="link-button" type="button" data-action="site-toggle-redirect" data-redirect-id="${escapeHtml(item.id)}">${item.status === "active" ? "停用" : "启用"}</button><button class="icon-button" type="button" data-action="site-delete-redirect" data-redirect-id="${escapeHtml(item.id)}" aria-label="删除重定向"><span data-icon="trash"></span></button></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">URL 301 重定向</h2><p>页面或栏目路径变更时自动创建；也可以手动增加站内重定向。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field-row"><div class="field"><label for="site-redirect-from">原地址</label><input class="input" id="site-redirect-from" placeholder="/old-path/" /></div><div class="field"><label for="site-redirect-to">目标地址</label><input class="input" id="site-redirect-to" placeholder="/new-path/" /></div></div><div class="field"><label for="site-redirect-reason">变更原因</label><input class="input" id="site-redirect-reason" placeholder="例如：专题页地址调整" /></div><button class="secondary-button" type="button" data-action="site-add-redirect"><span data-icon="plus"></span>添加重定向</button><div class="redirect-list">${rows || '<div class="empty-state compact"><div><span data-icon="link"></span><h3>还没有重定向</h3><p>修改页面或栏目地址时，系统会自动在这里生成记录。</p></div></div>'}</div></div><div class="modal-foot"><span>${redirects.filter((item) => item.status === "active").length} 条规则正在生效</span><button class="primary-button" type="button" data-action="close-modal">完成</button></div>`, { wide: true });
}

function addSiteRedirect() {
  const from = siteValue("site-redirect-from");
  const to = siteValue("site-redirect-to");
  if (!from || !to) return showToast("请填写原地址和目标地址", "两个地址都必须是当前官网内的路径。", "error");
  if (sitePath(from) === sitePath(to)) return showToast("重定向地址不能相同", "原地址和目标地址需要不同。", "error");
  siteAddRedirect(from, to, siteValue("site-redirect-reason") || "手动创建");
  saveState();
  renderModal();
  showToast("301 重定向已添加", `${sitePath(from)} 将跳转到 ${sitePath(to)}。`, "success");
}

function toggleSiteRedirect(redirectId) {
  const redirect = siteCms().redirects.find((item) => item.id === redirectId);
  if (!redirect) return;
  redirect.status = redirect.status === "active" ? "disabled" : "active";
  redirect.updatedAt = siteNow();
  saveState();
  renderModal();
}

async function deleteSiteRedirect(redirectId) {
  if (!(await uiConfirm("确认删除该重定向规则？原地址将不再自动跳转。"))) return;
  siteCms().redirects = siteCms().redirects.filter((item) => item.id !== redirectId);
  saveState();
  await commitSiteCmsDraft();
  renderModal();
  showToast("重定向已删除", "该原地址将不再自动跳转。", "success");
}

function saveSiteSettings() {
  const name = siteValue("site-setting-name");
  const domain = siteValue("site-setting-domain").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const companyName = siteValue("site-setting-company");
  const description = siteValue("site-setting-description");
  const sameAs = [...new Set(siteValue("site-setting-same-as").split(/[\r\n,，;；]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 12);
  if (!name || !domain || !companyName) return showToast("请补全站点基础信息", "网站名称、主域名和企业主体不能为空。", "error");
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(domain)) return showToast("主域名格式不正确", "请填写不带协议和路径的域名，例如 www.example.com。", "error");
  const validPublicUrl = (value, allowRelative = false) => !value || (allowRelative && /^\/(?!\/)/.test(value)) || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
  if (sameAs.some((value) => !validPublicUrl(value))) return showToast("权威主体链接格式不正确", "每一行都应是完整的 http:// 或 https:// 地址。", "error");
  Object.assign(siteCms().settings, { siteName: name, companyName, description, officialDomain: domain, sameAs, allowAiCrawl: siteChecked("site-setting-ai-crawl"), updatedAt: siteNow() });
  state.site.domain = domain;
  saveState();
  render();
  showToast("站点设置已保存", "企业主体、域名和 AI 抓取配置已更新。", "success");
}

function saveSiteDiagnosticUrl() {
  const value = siteValue("site-setting-diagnostic-url");
  if (value) {
    let parsed;
    try { parsed = new URL(value); } catch { return showToast("官网实测地址格式不正确", "请填写完整的 http:// 或 https:// 公网地址。", "error"); }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
      return showToast("官网实测地址格式不正确", "仅支持不含账号密码的 HTTP / HTTPS 地址。", "error");
    }
  }
  Object.assign(siteCms().settings, { diagnosticUrl: value, updatedAt: siteNow() });
  saveState();
  render();
  showToast("官网实测地址已保存", value ? "运营诊断将优先使用此地址；保存不会自动开始检测。" : "已恢复为使用主域名作为实测默认地址。", "success");
}

function saveSiteContactSettings() {
  const email = siteValue("site-setting-email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("企业邮箱格式不正确", "请检查邮箱地址后重试。", "error");
  Object.assign(siteCms().settings, { phone: siteValue("site-setting-phone"), email, address: siteValue("site-setting-address"), industryRegion: siteValue("site-setting-region"), serviceArea: siteValue("site-setting-area"), updatedAt: siteNow() });
  saveState(); render(); showToast("公开联系方式已保存", "联系我们页面、页脚和结构化数据会在发布后同步更新。", "success");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportSiteLeads() {
  const statusLabel = { new: "新线索", contacted: "已联系", qualified: "有效商机" };
  const header = ["线索编号", "联系人", "企业", "咨询服务", "提交时间", "来源页面", "状态", "负责人", "下次跟进", "最近记录"];
  const rows = siteLeads().map((lead) => [lead.id, lead.name, lead.company, lead.service, lead.createdAt, lead.sourcePage, statusLabel[lead.status] || lead.status, lead.owner, lead.nextFollowAt, lead.notes]);
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `官网咨询线索-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  siteCms().lastLeadsExportAt = siteNow();
  saveState();
  showToast("线索 CSV 已导出", `共导出 ${rows.length} 条线索及当前跟进状态。`, "success");
}
