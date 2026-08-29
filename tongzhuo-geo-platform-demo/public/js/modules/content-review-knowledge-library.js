// Knowledge library dialogs kept separate from the main content review shell.
// The classic global function names remain available for the existing actions.

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
