
function renderKnowledgeLibraries() {
  const activeBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived");
  const bases = activeBases.filter((base) => ui.knowledgeKindFilter === "all" || base.kind === ui.knowledgeKindFilter);
  const activeBaseIds = new Set(activeBases.map((base) => base.id));
  const approvedCount = (state.knowledgeItems || []).filter((item) => activeBaseIds.has(item.knowledgeBaseId) && item.status === "approved").length;
  const pendingCount = (state.knowledgeItems || []).filter((item) => activeBaseIds.has(item.knowledgeBaseId) && ["pending_ocr", "processing"].includes(item.importStatus)).length + (knowledgeAssetRuntime.items || []).filter((asset) => asset.ocrStatus === "processing").length;
  const docCount = activeBases.filter((base) => base.kind === "document").length;
  const qaCount = activeBases.filter((base) => base.kind === "qa").length;
  const coverageTotal = activeBases.length ? Math.round((approvedCount / Math.max(1, activeBases.reduce((s, b) => s + knowledgeBaseItems(b.id).length, 0))) * 100) : 0;

  const cards = bases.map((base) => {
    const items = knowledgeBaseItems(base.id);
    const approved = approvedKnowledgeItems(base.id).length;
    const usage = items.length ? Math.min(100, Math.round(approved / items.length * 100)) : 0;
    const updatedAt = base.updatedAt ? formatRelative(base.updatedAt) : "—";
    const isQa = base.kind === "qa";
    const versionCount = items.reduce((s, item) => s + ((item.versions || []).length || 1), 0);
    const statusLabel = base.status === "ready" ? "就绪" : base.status === "processing" ? "处理中" : base.status === "archived" ? "归档" : "草稿";
    return `
      <article class="card knowledge-library-card kb-linear ${isQa ? "kb-qa" : "kb-doc"}">
        <div class="kb-linear-head">
          <span class="knowledge-icon" data-icon="${isQa ? "help" : "book"}"></span>
          <div class="kb-linear-title-wrap">
            <span class="kb-linear-title">${escapeHtml(base.name)}</span>
            <span class="kb-linear-meta">${knowledgeKindLabel(base.kind)} · ${escapeHtml(statusLabel)} · v${versionCount}</span>
          </div>
          <span class="kb-linear-stat">${approved}<small>/${items.length}</small></span>
        </div>
        <p class="kb-linear-desc">${escapeHtml(base.description || "尚未填写知识库说明")}</p>
        <div class="kb-linear-foot">
          <div class="kb-linear-meta-row">
            <span class="kb-linear-foot-meta">${escapeHtml(knowledgeScopeLabel(base))}</span>
            <span class="kb-linear-dot">·</span>
            <span class="kb-linear-foot-meta">${escapeHtml(updatedAt)}</span>
            <span class="kb-linear-dot">·</span>
            <span class="kb-linear-foot-meta">覆盖率 ${usage}%</span>
          </div>
          <button class="kb-linear-btn" type="button" data-action="open-knowledge-base" data-base-id="${base.id}">进入 <span data-icon="arrow"></span></button>
        </div>
      </article>
    `;
  }).join("");

  return `
    <section class="kb-summary-row">
      <article class="card kb-summary-card tone-blue"><span class="kb-summary-icon" data-icon="database"></span><div><b>${activeBases.length}</b><small>知识库总数</small></div><span class="kb-summary-trend">${docCount} 文档 · ${qaCount} 问答</span></article>
      <article class="card kb-summary-card tone-teal"><span class="kb-summary-icon" data-icon="check"></span><div><b>${approvedCount}</b><small>已审核可用</small></div><span class="kb-summary-trend">整体覆盖率 ${coverageTotal}%</span></article>
      <article class="card kb-summary-card tone-purple"><span class="kb-summary-icon" data-icon="help"></span><div><b>${qaCount}</b><small>标准问答库</small></div><span class="kb-summary-trend">企业标准回答</span></article>
      <article class="card kb-summary-card tone-amber"><span class="kb-summary-icon" data-icon="clock"></span><div><b>${pendingCount}</b><small>后台处理中</small></div><span class="kb-summary-trend">自动解析索引</span></article>
    </section>
    <div class="knowledge-toolbar">
      <div class="segmented-control" role="tablist">
        ${[["all", "全部"], ["document", "文档库"], ["qa", "问答库"]].map(([id, label]) => '<button class="' + (ui.knowledgeKindFilter === id ? "active" : "") + '" type="button" data-action="knowledge-kind-filter" data-kind="' + id + '">' + label + "</button>").join("")}
      </div>
      <p>文档库保存长资料，问答库保存企业标准回答；资料上传后直接入库，后台自动解析、向量化并更新检索索引。</p>
    </div>
    <section class="knowledge-library-grid">${cards || '<div class="card empty-state knowledge-empty"><div><span data-icon="book"></span><h3>还没有这类知识库</h3><p>新建后即可录入资料并绑定业务线。</p><button class="primary-button button-small" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button></div></div>'}</section>
  `;
}

function renderKnowledgePackages() {
  const publicBases = (state.knowledgeBases || []).filter((base) => base.scope === "enterprise" && base.status !== "archived");
  const cards = state.businessLines.filter((line) => line.status === "active").map((line) => {
    const bound = (line.knowledgeBaseIds || []).map(knowledgeBaseById).filter(Boolean);
    const names = bound.map((base) => '<span class="knowledge-package-chip"><span data-icon="' + (base.kind === "qa" ? "help" : "book") + '"></span>' + escapeHtml(base.name) + '</span>').join("");
    const approved = bound.reduce((total, base) => total + approvedKnowledgeItems(base.id).length, 0) + publicBases.reduce((total, base) => total + approvedKnowledgeItems(base.id).length, 0);
    return `
      <article class="card knowledge-package-card kb-linear">
        <div class="kb-linear-head">
          <span class="business-avatar">${escapeHtml(line.name.slice(0, 1))}</span>
          <div class="kb-linear-title-wrap">
            <span class="kb-linear-title">${escapeHtml(line.name)}</span>
            <span class="kb-linear-meta">${escapeHtml(line.product || "业务线")} · 绑定 ${bound.length} 个库</span>
          </div>
          <span class="kb-linear-stat">${approved}<small>条</small></span>
        </div>
        <p class="kb-linear-desc">${escapeHtml(line.scope || line.description || "新建内容计划会继承公共库和这里的默认库。")}</p>
        <div class="kb-linear-foot">
          <div class="kb-linear-meta-row">
            <span class="kb-linear-foot-meta">${names ? bound.length + " 个专属库" : "未绑定专属库"}</span>
            <span class="kb-linear-dot">·</span>
            <span class="kb-linear-foot-meta">公共库 ${publicBases.length}</span>
          </div>
          <button class="kb-linear-btn" type="button" data-action="manage-knowledge-package" data-line-id="${line.id}">配置默认 <span data-icon="arrow"></span></button>
        </div>
      </article>
    `;
  }).join("");
  return `
    <section class="card public-knowledge-banner"><span class="knowledge-icon" data-icon="globe"></span><div><h3>企业公共知识</h3><p>自动进入所有业务线与新内容计划，无需重复绑定。</p></div><div class="public-base-list">${publicBases.map((base) => '<button type="button" data-action="open-knowledge-base" data-base-id="' + base.id + '">' + escapeHtml(base.name) + '<b>' + approvedKnowledgeItems(base.id).length + ' 条</b></button>').join("") || "暂无公共库"}</div></section>
    <div class="kb-package-grid">${cards}</div>
  `;
}

function renderEnterpriseFacts() {
  const profile = state.enterpriseProfile;
  const facts = enterpriseFactEntries(profile);
  const completion = enterpriseFactCompletion(profile);
  const filledCount = facts.filter(([, value]) => value).length;
  const totalFacts = facts.length;
  return `<section class="facts-layout"><div class="card fact-summary kb-v2"><span class="completion-ring" style="--completion:${completion}%"><b>${completion}%</b></span><div class="fact-summary-meta"><h3>企业事实完成度</h3><p>事实卡用于快速校验，详细原文与版本仍保存在文档库和问答库。</p><div class="kb-fact-mini-stats"><span><b>${filledCount}</b><small>已填写</small></span><span><b>${totalFacts - filledCount}</b><small>待补充</small></span><span><b>${totalFacts}</b><small>总字段</small></span></div><button class="secondary-button button-small" type="button" data-action="edit-knowledge" data-knowledge="profile"><span data-icon="edit"></span>继续完善企业档案</button></div></div><div class="fact-grid">${facts.map(([label, value, note]) => '<article class="card fact-card' + (value ? " is-filled" : "") + '"><span class="fact-card-label">' + label + '</span><b>' + escapeHtml(value || "待补充") + '</b><p>' + escapeHtml(note || "") + '</p></article>').join("")}</div></section>`;
}

function knowledgePreparationMaterials() {
  return [
    {
      id: "profile",
      title: "企业基础档案",
      icon: "briefcase",
      action: "profile",
      actionLabel: "填写基础信息",
      purpose: "统一企业身份与公开联系信息，避免官网、文章和平台介绍出现多个版本。",
      materials: ["企业全称、品牌名、官网、公开联系方式", "主营业务、服务区域、可公开的企业简介"],
      example: "例如：一页企业介绍、官网链接和对外联系方式。"
    },
    {
      id: "products",
      title: "产品与服务",
      icon: "briefcase",
      action: "import",
      actionLabel: "上传产品资料",
      purpose: "让内容准确说明卖什么、适合谁、解决什么问题，以及哪些情况不适用。",
      materials: ["产品/服务介绍、型号或套餐、规格参数", "适用客户、应用场景、服务边界与不包含项"],
      example: "例如：产品手册、服务方案、参数表或服务说明。"
    },
    {
      id: "pricing_delivery",
      title: "报价与交付",
      icon: "clock",
      action: "import",
      actionLabel: "上传报价与交付说明",
      purpose: "只有企业确认的价格、周期和交付范围，才能安全出现在对外内容中。",
      materials: ["对外报价单或报价规则：适用服务、含税口径、有效期、不包含项", "交付说明或项目计划：启动条件、阶段里程碑、典型周期、客户配合事项"],
      example: "例如：服务包说明、价目表、合同中的交付条款摘录。"
    },
    {
      id: "cases",
      title: "客户案例与证明",
      icon: "target",
      action: "import",
      actionLabel: "上传案例资料",
      purpose: "用可核验的事实说明能力，避免把未经授权的客户、数字或成果写进内容。",
      materials: ["客户行业、原始问题、实施方案、可公开的结果", "客户授权范围、资质证书、检测报告或其他佐证"],
      example: "例如：脱敏案例、客户授权书、证书或可公开的数据证明。"
    },
    {
      id: "faq",
      title: "常见问题与标准答复",
      icon: "help",
      action: "import",
      actionLabel: "上传问答资料",
      purpose: "把销售、客服和交付中最常被问的问题统一成企业确认的回答。",
      materials: ["客户常问问题、标准回答、适用条件", "售前承诺边界、售后说明、异议处理口径"],
      example: "例如：FAQ 文档、销售话术中已确认的问答或客服知识库导出。"
    },
    {
      id: "brand_compliance",
      title: "品牌口径与合规边界",
      icon: "shield",
      action: "import",
      actionLabel: "上传品牌与合规资料",
      purpose: "明确什么能说、不能说，以及品牌应该以怎样的语气对外表达。",
      materials: ["品牌简介、标准称呼、语气与用词规范", "禁用表述、敏感信息、资质/效果/排名等宣传边界"],
      example: "例如：品牌手册、法务审核意见、宣传合规要求。"
    },
    {
      id: "assets",
      title: "图片与视觉素材",
      icon: "image",
      action: "assets",
      actionLabel: "上传图片素材",
      purpose: "让官网和内容可以使用真实、授权清晰的图片，而不是随意匹配素材。",
      materials: ["Logo、产品图、场景图、团队/工厂/案例现场图片", "图片用途说明、版权或客户授权信息"],
      example: "例如：按产品、场景或案例命名的 PNG、JPG、WebP 图片。"
    }
  ];
}

function knowledgePreparationById(id) {
  return knowledgePreparationMaterials().find((item) => item.id === id) || null;
}

function knowledgePreparationIdForGap(gap) {
  const value = [gap?.field, gap?.label, gap?.title, gap?.fact, gap?.reason, gap?.description].filter(Boolean).join(" ").toLowerCase();
  if (/(price|quote|cost|fee|报价|价格|费用|交付|周期|delivery|lead[ _-]?time|milestone|里程碑)/.test(value)) return "pricing_delivery";
  if (/(case|customer|certificate|proof|evidence|案例|客户|资质|证书|证明|佐证)/.test(value)) return "cases";
  if (/(faq|question|answer|问答|常见问题|售前|售后|异议)/.test(value)) return "faq";
  if (/(brand|compliance|legal|sensitive|banned|品牌|合规|法务|敏感|禁用)/.test(value)) return "brand_compliance";
  if (/(image|photo|video|logo|图片|素材|视频|图像)/.test(value)) return "assets";
  if (/(company|profile|identity|contact|官网|企业名称|企业事实|企业档案|档案|品牌名|联系方式|服务区域|主体)/.test(value)) return "profile";
  if (/(product|service|parameter|spec|scope|产品|服务|参数|规格|适用|边界)/.test(value)) return "products";
  return null;
}

function knowledgePreparationEvidenceCount(id) {
  const summary = state.knowledge || {};
  const profile = state.enterpriseProfile || {};
  const itemCount = (key) => Number(summary[key]?.reviewed ?? summary[key]?.count ?? 0) || 0;
  const availableItems = (state.knowledgeItems || []).filter((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    const extraction = String(version?.extractionStatus || item.importStatus || "complete").toLowerCase();
    const index = String(version?.indexStatus || "indexed").toLowerCase();
    return item.status === "approved" && item.visibility !== "internal" && version?.reviewStatus === "approved" && !["queued", "processing", "pending", "pending_ocr", "pending_parse", "failed"].includes(extraction) && index === "indexed";
  });
  const matchingItems = (pattern) => availableItems.filter((item) => {
    const version = knowledgeVersionById(item.latestVersionId);
    return pattern.test([item.title, item.question, item.category, ...(item.tags || []), version?.content].filter(Boolean).join(" "));
  }).length;
  if (id === "profile") return [profile.companyName, profile.brandName, profile.officialDomain, profile.primaryService, profile.serviceArea].filter(Boolean).length;
  if (id === "products") return matchingItems(/产品|服务|参数|规格|场景|适用|边界|方案/i) || (!availableItems.length ? itemCount("products") : 0);
  if (id === "cases") return matchingItems(/案例|客户|项目|证书|资质|证明/i) || (!availableItems.length ? itemCount("cases") : 0);
  if (id === "faq") return availableItems.filter((item) => item.kind === "qa").length || matchingItems(/问答|常见问题|FAQ|售前|售后/i) || (!availableItems.length ? itemCount("faq") : 0);
  if (id === "brand_compliance") return matchingItems(/品牌|合规|法务|敏感|禁用|宣传/i) || (!availableItems.length ? itemCount("adLaw") + itemCount("sensitive") + itemCount("banned") : 0);
  if (id === "assets") return (knowledgeAssetRuntime.items || []).filter((item) => item.assetType === "image" && item.ocrStatus !== "failed").length || (!availableItems.length ? itemCount("images") : 0);
  return matchingItems(/报价|价格|费用|交付|周期|价目|服务包|套餐|lead[ _-]?time|delivery/i);
}

function knowledgePreparationStatus(material, gaps) {
  const related = gaps.filter((gap) => knowledgePreparationIdForGap(gap) === material.id);
  if (related.length) {
    const affectedArticles = new Set(related.map((gap) => gap.articleId).filter(Boolean));
    const affected = affectedArticles.size || related.length;
    return { state: "missing", label: "待补充", count: related.length, description: `系统在 ${affected} ${affectedArticles.size ? "篇内容" : "条检查"}中发现这类资料尚未确认。` };
  }
  const evidenceCount = knowledgePreparationEvidenceCount(material.id);
  if (evidenceCount > 0) return { state: "ready", label: "已有资料", count: evidenceCount, description: `已发现 ${evidenceCount} 条相关资料，建议定期核对是否仍可对外使用。` };
  return { state: "suggested", label: "建议准备", count: 0, description: "当前尚未检测到缺项；提前准备可减少后续内容反复补料。" };
}

function groupedKnowledgeGaps(gaps) {
  const groups = new Map();
  gaps.forEach((gap) => {
    const preparationId = knowledgePreparationIdForGap(gap);
    const rawLabel = String(gap.title || gap.label || gap.fact || "待补充企业资料").trim() || "待补充企业资料";
    const field = String(gap.field || rawLabel).trim().toLowerCase().replace(/\s+/g, "_");
    // A price or delivery rule belongs to a business line. Merge repeated
    // checks for the same line, but do not pretend different products share
    // one quoted price or delivery commitment.
    const key = `${gap.businessLineId || "enterprise"}:${preparationId || `other:${field}`}`;
    if (!groups.has(key)) groups.set(key, { id: gap.id, label: preparationId ? knowledgePreparationById(preparationId)?.title || rawLabel : rawLabel, preparationId, labels: new Set(), gaps: [], articleIds: new Set(), businessLineIds: new Set() });
    const group = groups.get(key);
    group.labels.add(rawLabel);
    group.gaps.push(gap);
    if (gap.articleId) group.articleIds.add(gap.articleId);
    if (gap.businessLineId) group.businessLineIds.add(gap.businessLineId);
  });
  return [...groups.values()];
}

function renderKnowledgeReview() {
  const gaps = (state.knowledgeGaps || []).filter((gap) => !["resolved", "archived"].includes(gap.status));
  const materials = knowledgePreparationMaterials();
  const materialStates = materials.map((material) => ({ material, status: knowledgePreparationStatus(material, gaps) }));
  const gapGroups = groupedKnowledgeGaps(gaps);
  const readyCount = materialStates.filter(({ status }) => status.state === "ready").length;
  const missingCount = materialStates.filter(({ status }) => status.state === "missing").length;
  const suggestedCount = materialStates.filter(({ status }) => status.state === "suggested").length;
  const materialCards = materialStates.map(({ material, status }) => {
    const iconTone = material.id === "faq" || material.id === "brand_compliance" ? "purple" : material.id === "assets" ? "teal" : material.id === "pricing_delivery" ? "amber" : "blue";
    return `
    <article class="knowledge-prep-card ${status.state}">
      <div class="knowledge-prep-card-head">
        <span class="knowledge-icon ${iconTone}" data-icon="${material.icon}"></span>
        <div class="knowledge-library-head-meta">
          <span class="knowledge-library-title">${escapeHtml(material.title)}</span>
          <span class="knowledge-card-type"><span class="kb-pulse-dot ${iconTone}"></span>${escapeHtml(status.label)} · ${status.count ? status.count + " 项" : "尚未检测"}</span>
        </div>
      </div>
      <p class="knowledge-card-desc">${escapeHtml(material.purpose)}</p>
      <div class="knowledge-prep-materials"><b>建议准备</b><ul>${material.materials.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="knowledge-prep-example"><span data-icon="info"></span><span><b>材料示例：</b>${escapeHtml(material.example)}</span></div>
      <div class="knowledge-prep-card-foot"><small>${escapeHtml(status.description)}</small><button class="text-button" type="button" data-action="prepare-knowledge-material" data-preparation-id="${material.id}"><span data-icon="${material.action === "assets" ? "image" : material.action === "profile" ? "edit" : "upload"}"></span>${escapeHtml(material.actionLabel)}</button></div>
    </article>
  `;
  }).join("");
  const gapCards = gapGroups.map((group) => {
    const material = knowledgePreparationById(group.preparationId);
    const lines = [...group.businessLineIds].map((id) => state.businessLines.find((item) => item.id === id)?.name).filter(Boolean);
    const usage = group.articleIds.size ? `影响 ${group.articleIds.size} 篇内容` : `出现 ${group.gaps.length} 次`;
    const missingFields = [...group.labels].join("、");
    const need = material ? `待明确：${missingFields}。建议提交：${material.materials[0]}。` : "请提供可以核验、允许使用的企业资料或标准答复。";
    return `<article class="knowledge-gap-card knowledge-gap-summary-card"><span class="gap-icon" data-icon="alert"></span><div><div class="knowledge-gap-title"><b>${escapeHtml(group.label)}</b><span>${escapeHtml(usage)}</span></div><p>${escapeHtml(need)} 未确认的信息不会由系统猜测或写入对外内容。</p><small>${escapeHtml(lines.join("、") || "全企业")} · 相同缺项已合并显示</small></div><button class="text-button" type="button" data-action="prepare-knowledge-material" data-preparation-id="${escapeHtml(material?.id || "products")}"><span data-icon="upload"></span>${material ? `准备${escapeHtml(material.title)}` : "上传资料"}</button></article>`;
  }).join("");
  return `
    <section class="kb-summary-row" style="grid-template-columns:repeat(4, minmax(0,1fr)); margin-bottom:24px;">
      <article class="card kb-summary-card tone-teal"><span class="kb-summary-icon" data-icon="check"></span><div><b>${readyCount}</b><small>已有资料</small></div><span class="kb-summary-trend">已发现 ${readyCount} 类资料可对外使用</span></article>
      <article class="card kb-summary-card tone-amber"><span class="kb-summary-icon" data-icon="alert"></span><div><b>${missingCount}</b><small>待补充</small></div><span class="kb-summary-trend">系统检测到内容需要补充</span></article>
      <article class="card kb-summary-card tone-blue"><span class="kb-summary-icon" data-icon="info"></span><div><b>${suggestedCount}</b><small>建议准备</small></div><span class="kb-summary-trend">未来内容需要的资料</span></article>
      <article class="card kb-summary-card tone-purple"><span class="kb-summary-icon" data-icon="layers"></span><div><b>${materials.length}</b><small>资料分类</small></div><span class="kb-summary-trend">完整覆盖企业资料维度</span></article>
    </section>
    <section class="card knowledge-prep-hero kb-v2">
      <div class="knowledge-prep-hero-copy"><span class="knowledge-prep-kicker">企业资料准备清单</span><h3>先把企业资料准备齐，再让内容安全地引用</h3><p>不需要按模板重写：把已有的 PDF、Word、Excel、文本或图片上传即可。系统会解析并建立检索索引；没有企业确认的价格、案例或承诺不会被自动补写。</p></div>
    </section>
    <section class="card knowledge-prep-section">
      <div class="card-header knowledge-prep-section-head"><div><h3>客户资料准备清单</h3><p>每一类都告诉您资料用于什么、建议提供什么，以及可以直接上传哪些现有文件。</p></div><span class="small-tag teal">按业务资料整理</span></div>
      <div class="knowledge-prep-grid">${materialCards}</div>
    </section>
    <section class="card knowledge-gap-section"><div class="card-header"><div><h3>系统检测到的待补资料</h3><p>相同的缺项会合并显示，不再按每篇文章重复提醒。补齐后只会用于后续检索与创作，不会自动修改或发布已有内容。</p></div><span class="small-tag ${gapGroups.length ? "amber" : "teal"}">${gapGroups.length} 类</span></div><div class="knowledge-gap-list knowledge-gap-summary-list">${gapCards || '<div class="empty-state compact"><div><span data-icon="check"></span><h3>当前没有待补资料</h3><p>最近的内容检查没有发现必须补充的企业事实；仍建议按上方清单定期更新资料。</p></div></div>'}</div></section>
  `;
}

function knowledgeAssetPreviewUrl(asset) {
  return `/api/v1/knowledge/assets/${encodeURIComponent(asset.id)}/content`;
}

function knowledgeAssetStatus(asset) {
  if (asset.ocrStatus === "failed") return '<span class="status-badge status-approved">可用 · 识别失败</span>';
  if (["queued", "processing"].includes(asset.ocrStatus)) return '<span class="status-badge status-approved">可用 · 识别中</span>';
  return '<span class="status-badge status-approved">可用于写作</span>';
}

function renderKnowledgeAssets() {
  const allImages = (knowledgeAssetRuntime.items || []).filter((asset) => asset.assetType === "image");
  const search = String(ui.knowledgeAssetSearch || "").trim().toLowerCase();
  const filtered = allImages.filter((asset) => {
    if (ui.knowledgeAssetLibraryFilter !== "all" && asset.libraryId !== ui.knowledgeAssetLibraryFilter) return false;
    const base = knowledgeBaseById(asset.libraryId);
    return !search || [asset.sourceName, asset.altText, asset.metadata?.caption, base?.name, ...(asset.metadata?.tags || [])].join(" " ).toLowerCase().includes(search);
  });
  const options = (state.knowledgeBases || []).filter((base) => base.status !== "archived" && base.kind === "document").map((base) => `<option value="${escapeHtml(base.id)}" ${ui.knowledgeAssetLibraryFilter === base.id ? "selected" : ""}>${escapeHtml(base.name)}</option>`).join("");
  const cards = filtered.map((asset) => {
    const base = knowledgeBaseById(asset.libraryId);
    const metadata = asset.metadata || {};
    const source = metadata.derivedFrom === "pdf" ? `${metadata.sourcePdfName || "PDF"}${metadata.pageNumber ? ` · 第 ${metadata.pageNumber} 页` : ""}` : "直接上传";
    return `<article class="knowledge-image-card"><div class="knowledge-image-preview"><img src="${knowledgeAssetPreviewUrl(asset)}" alt="${escapeHtml(asset.altText || asset.sourceName || "企业知识图片")}" loading="lazy" /></div><div class="knowledge-image-card-body"><div class="knowledge-image-card-head">${knowledgeAssetStatus(asset)}<span>${escapeHtml(base?.name || "未分组")}</span></div><h3 title="${escapeHtml(asset.sourceName)}">${escapeHtml(asset.sourceName || "未命名图片")}</h3><p>${escapeHtml(asset.altText || metadata.caption || "图片已入库，可在写作台直接选择插入。")}</p><footer><span>${escapeHtml(source)}</span><span>${escapeHtml(formatRelative(asset.createdAt))}</span><button class="link-button danger-link" type="button" data-action="delete-knowledge-image" data-asset-id="${escapeHtml(asset.id)}">删除</button></footer></div></article>`;
  }).join("");
  const content = knowledgeAssetRuntime.loading && !knowledgeAssetRuntime.loaded
    ? '<div class="card empty-state knowledge-empty"><div><span data-icon="loader"></span><h3>正在加载图片资料</h3></div></div>'
    : cards || '<div class="card empty-state knowledge-empty"><div><span data-icon="image"></span><h3>还没有图片资料</h3><p>支持一次选择多张照片；PDF 中提取出的图片也会自动出现在这里。</p><button class="primary-button button-small" type="button" data-action="upload-knowledge-images"><span data-icon="upload"></span>批量上传图片</button></div></div>';
  return `<section class="knowledge-assets-toolbar"><div><h2>图片资料库</h2><p>上传即入库，不需要逐张填写或审核；写文章时可以直接搜索、选择并插入。</p></div><div class="knowledge-assets-actions"><select class="select" data-knowledge-asset-library-filter><option value="all">全部知识库</option>${options}</select><input class="input" data-knowledge-asset-search placeholder="搜索图片名称、说明或标签" value="${escapeHtml(ui.knowledgeAssetSearch)}" /><button class="secondary-button" type="button" data-action="import-knowledge"><span data-icon="file"></span>上传文档 / PDF</button><button class="primary-button" type="button" data-action="upload-knowledge-images"><span data-icon="image"></span>批量上传图片</button></div></section><section class="knowledge-image-grid">${content}</section>`;
}

function renderKnowledgeLegacyCards(tab) {
  const cards = tab === "assets"
    ? [{
      id: "images", title: "品牌与内容素材", subtitle: "图片资料库", description: "品牌、产品、案例和文章配图，供内容任务按授权范围使用。", icon: "image", tone: "teal", unit: "张",
      metrics: [
        { label: "素材总数", value: null, suffix: "张" }
      ],
      coverage: 0
    }]
    : tab === "facts"
      ? [
        { id: "products", title: "产品服务", subtitle: "事实条目", description: "产品、服务内容、交付方式与对外承诺边界。", icon: "briefcase", tone: "teal", unit: "项",
          metrics: [
            { label: "已审核", value: null, suffix: "项" }
          ],
          coverage: 0 },
        { id: "cases", title: "案例资质", subtitle: "脱敏案例", description: "已脱敏、已授权且允许用于内容生产的案例与资质。", icon: "clipboard", tone: "purple", unit: "项",
          metrics: [
            { label: "可引用", value: null, suffix: "项" }
          ],
          coverage: 0 },
        { id: "faq", title: "常见问题", subtitle: "标准问答", description: "客户常问问题与企业认可的标准回答。", icon: "help", tone: "blue", unit: "条",
          metrics: [
            { label: "已确认", value: null, suffix: "条" }
          ],
          coverage: 0 },
        { id: "documents", title: "知识资料", subtitle: "档案清单", description: "企业档案、产品资料、交付规范和其他来源清单。", icon: "book", tone: "amber", unit: "份",
          metrics: [
            { label: "已索引", value: null, suffix: "份" }
          ],
          coverage: 0 }
      ]
    : [
      { id: "adLaw", title: "广告法规则", subtitle: "内容风控", description: "广告合规规则属于内容风控，不参与企业事实检索。", icon: "shield", tone: "amber", unit: "条",
        metrics: [
          { label: "规则条目", value: null, suffix: "条" }
        ],
        coverage: 0 },
      { id: "sensitive", title: "企业敏感规则", subtitle: "行业敏感词", description: "行业敏感词、内部信息和不允许对外披露的表达。", icon: "alert", tone: "purple", unit: "条",
        metrics: [
          { label: "规则条目", value: null, suffix: "条" }
        ],
        coverage: 0 },
      { id: "banned", title: "企业禁用表述", subtitle: "禁用说法", description: "与服务边界或企业事实冲突的禁止说法。", icon: "lock", tone: "teal", unit: "条",
        metrics: [
          { label: "规则条目", value: null, suffix: "条" }
        ],
        coverage: 0 }
    ];
  return '<section class="knowledge-grid">' + cards.map((item) => {
    const data = state.knowledge[item.id] || {};
    const ruleCount = Number(data.count) || 0;
    const updated = escapeHtml(data.updated || "尚未维护");
    const primary = (item.metrics || [])[0] || { label: "条目", value: ruleCount, suffix: item.unit || "" };
    const statValue = Number.isFinite(primary.value) ? primary.value : ruleCount;
    const stat = `${Number.isFinite(statValue) ? statValue.toLocaleString("zh-CN") : "—"}${primary.suffix ? `<small>${escapeHtml(primary.suffix)}</small>` : ""}`;
    return `<article class="card knowledge-card kb-linear">
      <div class="kb-linear-head">
        <span class="knowledge-icon" data-icon="${item.icon}"></span>
        <div class="kb-linear-title-wrap">
          <span class="kb-linear-title">${escapeHtml(data.name || item.title)}</span>
          <span class="kb-linear-meta">${escapeHtml(item.subtitle || "")} · 已启用 · ${item.id === "adLaw" || item.id === "sensitive" || item.id === "banned" ? "内容风控" : "事实库"}</span>
        </div>
        <span class="kb-linear-stat">${stat}</span>
      </div>
      <p class="kb-linear-desc">${escapeHtml(item.description)}</p>
      <div class="kb-linear-foot">
        <div class="kb-linear-meta-row">
          <span class="kb-linear-foot-meta">${updated}</span>
          <span class="kb-linear-dot">·</span>
          <span class="kb-linear-foot-meta">${escapeHtml(item.subtitle || "")}</span>
        </div>
        <button class="kb-linear-btn" type="button" data-action="edit-knowledge" data-knowledge="${escapeHtml(item.id)}">管理 <span data-icon="arrow"></span></button>
      </div>
    </article>`;
  }).join("") + "</section>";
}

function renderKnowledge() {
  const tabs = [
    ["libraries", "知识库", "database"],
    ["packages", "业务线知识包", "layers"],
    ["facts", "企业事实", "briefcase"],
    ["assets", "图片资料库", "image"],
    ["review", "资料准备", "check"],
    ["rules", "内容规则", "shield"]
  ];
  if (!tabs.some(([id]) => id === ui.knowledgeTab)) ui.knowledgeTab = "libraries";
  const tabCounts = (() => {
    const activeBases = (state.knowledgeBases || []).filter((base) => base.status !== "archived");
    const items = state.knowledgeItems || [];
    const assetCount = (knowledgeAssetRuntime.items || []).filter((asset) => asset.assetType === "image").length;
    const gapCount = (state.knowledgeGaps || []).filter((gap) => !["resolved", "archived"].includes(gap.status)).length;
    const ruleCount = ["adLaw", "sensitive", "banned"].reduce((s, k) => s + (Number(state.knowledge?.[k]?.count) || 0), 0);
    return {
      libraries: activeBases.length,
      packages: (state.businessLines || []).filter((line) => line.status === "active").length,
      facts: activeBases.length + items.length,
      assets: assetCount,
      review: gapCount,
      rules: ruleCount
    };
  })();
  const tabHtml = tabs.map(([id, label, icon]) => {
    const count = tabCounts[id];
    const countText = count > 0 ? count : "—";
    return `<button class="kb-tab-button ${ui.knowledgeTab === id ? "active" : ""}" type="button" data-action="knowledge-tab" data-tab="${id}"><span class="kb-tab-icon" data-icon="${icon}"></span><span class="kb-tab-text"><b>${escapeHtml(label)}</b><small>${countText} 项</small></span></button>`;
  }).join("");
  const actions = ui.knowledgeTab === "libraries"
    ? '<button class="secondary-button" type="button" data-action="refresh-knowledge"><span data-icon="refresh"></span>刷新</button><button class="secondary-button" type="button" data-action="import-knowledge"><span data-icon="upload"></span>导入资料</button><button class="primary-button" type="button" data-action="create-knowledge-base"><span data-icon="plus"></span>新建知识库</button>'
    : ui.knowledgeTab === "packages"
      ? '<button class="primary-button" type="button" data-action="manage-knowledge-package" data-line-id="' + (activeBusinessLine()?.id || "") + '"><span data-icon="layers"></span>配置当前业务线</button>'
      : ui.knowledgeTab === "facts"
        ? '<button class="primary-button" type="button" data-action="edit-knowledge" data-knowledge="profile"><span data-icon="edit"></span>完善企业档案</button>'
        : ui.knowledgeTab === "review"
          ? '<button class="primary-button" type="button" data-action="prepare-knowledge-material" data-preparation-id="products"><span data-icon="upload"></span>上传企业资料</button>'
          : "";
  const panel = ui.knowledgeTab === "libraries" ? renderKnowledgeLibraries()
    : ui.knowledgeTab === "packages" ? renderKnowledgePackages()
      : ui.knowledgeTab === "facts" ? `${renderEnterpriseFacts()}<section class="knowledge-structured-section"><div class="card-header"><div><h3>结构化企业资料</h3><p>维护运营人员常用的产品、案例、FAQ 和资料清单；详细正文与版本仍以知识库为准。</p></div></div>${renderKnowledgeLegacyCards("facts")}</section>`
        : ui.knowledgeTab === "review" ? renderKnowledgeReview()
          : ui.knowledgeTab === "assets" ? renderKnowledgeAssets()
            : renderKnowledgeLegacyCards(ui.knowledgeTab);
  return `
    <div class="page-container">
      ${pageHead("企业知识", "资料上传即入库，自动解析、索引并保留来源；文章发布前仍按内容流程人工审核。", actions)}
      <div class="knowledge-workspace page-workspace-surface">
        <div class="tabs-row knowledge-tabs-row kb-tabs-row"><div class="kb-tabs">${tabHtml}</div><span class="kb-tabs-badge"><span class="kb-pulse-dot teal"></span>企业 RAG 索引 · v2.4</span></div>
        ${panel}
        <div class="privacy-note"><span data-icon="info"></span><span><b>内容关联规则：</b>文章覆盖 ＞ 内容计划 ＞ 业务线默认知识包 ＞ 企业公共库。问题词库记录“客户会问什么”，企业问答库记录“企业如何标准回答”，两者不会混用。</span></div>
      </div>
    </div>
  `;
}


function renderAssistant() {
  const devices = publisherSnapshot.devices || [];
  const onlineDevices = devices.filter((device) => device.status === "online");
  const groups = state.accountGroups.filter((group) => group.id !== "unpaired").map((group) => {
    const accounts = Object.keys(group.accounts || {}).filter((platform) => !RETIRED_PUBLISH_PLATFORMS.has(canonicalPublishPlatformId(platform))).map((platform) => {
      const connection = publisherAccountConnection(group, platform);
      const account = connection.account || group.accounts?.[platform] || {};
      return `
      <div class="account-item">
        ${platformLogo(platform)}
        <span><b>${escapeHtml(account.name || account.accountName || "未命名账号")}</b><small>${escapeHtml(PLATFORM_META[platform]?.name || publisherPlatform(platform)?.name || platform)}</small></span>
        ${statusBadge(connection.status || account.status || "needs_login")}
      </div>
    `;
    }).join("");
    return `<article class="card account-group"><div class="account-group-head"><div class="group-title"><span class="group-avatar">${escapeHtml(group.name.slice(0, 1))}</span><span><b>${escapeHtml(group.name)}</b><small>${escapeHtml(group.deviceName || "本地桌面发布器")} · ${formatRelative(publisherGroupUpdatedAt(group))}同步</small></span></div><button class="secondary-button button-small" type="button" data-action="edit-group">在本地软件中管理</button><button class="link-button danger-link" type="button" data-action="delete-account-group" data-group-id="${escapeHtml(group.id)}">解绑</button></div><div class="account-grid">${accounts || '<div class="empty-state compact"><p>该账号组暂未同步平台账号。</p></div>'}</div></article>`;
  }).join("");
  const deviceName = onlineDevices[0]?.name || devices[0]?.name || "尚未连接桌面发布器";
  const lastHeartbeat = onlineDevices[0]?.lastHeartbeatAt || devices[0]?.lastHeartbeatAt || null;
  const accountCount = groups ? groups.match(/class="account-item"/g)?.length || 0 : 0;
  const liveState = onlineDevices.length ? "device_online" : devices.length ? "device_offline" : "not_connected";
  const selectablePlatformCount = (publisherSnapshot.selectablePlatformIds || publisherSnapshot.platforms || []).filter((item) => (typeof item === "string" ? item : item.id) !== "web" && (typeof item === "string" || item.enabled !== false)).length;
  const catalogGroups = state.accountGroups.filter((group) => group.id !== "unpaired");
  const catalogGroup = catalogGroups.find((group) => group.id === ui.assistantCatalogGroupId) || catalogGroups[0] || null;
  const loggedInPlatformCount = (publisherSnapshot.platforms || []).filter((platform) => platform.id !== "web" && platform.enabled !== false && publisherAccountReadyForGroup(catalogGroup, platform.id)).length;
  const catalogGroupOptions = catalogGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === catalogGroup?.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
  const FORMAL_PLATFORM_IDS = new Set([
    "web", "wechat_mp", "zhihu", "toutiao", "baijiahao", "xiaohongshu", "weibo", "juejin", "csdn",
    "jianshu", "douyin", "bilibili", "yuque", "douban", "sohu", "xueqiu", "woshipm", "dayu",
    "yidian", "imooc", "segmentfault", "cnblogs", "x",
    "eastmoney", "netease",
  ]);
  const catalogPlatforms = (publisherSnapshot.platforms || []).filter((platform) => platform.id !== "web" && !RETIRED_PUBLISH_PLATFORMS.has(canonicalPublishPlatformId(platform.id)));
  const officialPlatform = (publisherSnapshot.platforms || []).find((platform) => platform.id === "web")
    || PUBLISH_PLATFORM_REGISTRY.find((platform) => platform.id === "web")
    || { id: "web", name: "企业官网", capabilities: "长文 · 结构化数据", description: "由官网服务器直接发布，作为企业长期可控的主信源", enabled: true, accountMode: "server" };
  const catalogCategory = (platform) => {
    const id = platform.id;
    if (["douyin", "bilibili"].includes(id)) return "video";
    if (["weibo", "xiaohongshu", "x", "douban"].includes(id)) return "social";
    if (["juejin", "csdn", "jianshu", "yuque", "imooc", "segmentfault", "cnblogs"].includes(id)) return "tech";
    return "content";
  };
  const catalogCategoryLabel = { content: "内容平台", social: "社交平台", video: "视频平台", tech: "行业 / 技术" };
  const catalogStatus = (platform, connection) => {
    if (platform.support === "planned" || platform.enabled === false) return "planned";
    if (connection.ready) return "ready";
    if (connection.status === "unknown") return "unknown";
    return "login";
  };
  const catalogStatusLabel = { ready: "可直接发布", login: "待登录", unknown: "待确认", planned: "规划中" };
  const catalogSearch = String(ui.assistantCatalogSearch || "").trim().toLowerCase();
  const catalogStatusFilter = ui.assistantCatalogStatus || "all";
  const catalogCategoryFilter = ui.assistantCatalogCategory || "all";
  const formalCatalogPlatforms = catalogPlatforms.filter((platform) => FORMAL_PLATFORM_IDS.has(platform.id));
  const formalCatalogRows = formalCatalogPlatforms.filter((platform) => {
    const connection = publisherAccountConnection(catalogGroup, platform.id);
    const currentStatus = catalogStatus(platform, connection);
    const searchText = [platform.id, platform.name, platform.capabilities, platform.description, publisherConnectionMessage(connection)].join(" ").toLowerCase();
    return (!catalogSearch || searchText.includes(catalogSearch))
      && (catalogStatusFilter === "all" || currentStatus === catalogStatusFilter)
      && (catalogCategoryFilter === "all" || catalogCategory(platform) === catalogCategoryFilter);
  }).map((platform) => {
    const connection = publisherAccountConnection(catalogGroup, platform.id);
    const currentStatus = catalogStatus(platform, connection);
    const state = currentStatus === "ready" ? "online" : currentStatus === "planned" ? "planned" : connection.status || "not_connected";
    const copy = platform.enabled === false
      ? "规划目录保留，暂不进入发布选择"
      : publisherConnectionMessage(connection);
    const accountLabel = connection.account?.name || connection.account?.accountName || "尚未绑定账号";
    const capabilityLabel = platform.capabilities || "文章内容";
    return `<article class="assistant-platform-row" data-catalog-platform data-catalog-status="${currentStatus}" data-catalog-category="${catalogCategory(platform)}"><div class="assistant-platform-identity">${platformLogo(platform.id)}<div class="assistant-platform-copy"><b>${escapeHtml(platform.name)}</b><small>${escapeHtml(catalogCategoryLabel[catalogCategory(platform)] || "内容平台")} · ${escapeHtml(capabilityLabel)}</small></div></div><div class="assistant-platform-state">${statusBadge(state)}<small>${escapeHtml(copy)}</small></div><div class="assistant-platform-footer"><span>${escapeHtml(accountLabel)}</span><button class="link-button" type="button" data-action="edit-group">${connection.ready ? "管理账号" : "去登录"}</button></div></article>`;
  }).join("");
  const comingPlatformCount = catalogPlatforms.filter((platform) => !FORMAL_PLATFORM_IDS.has(platform.id)).length;
  const catalogRows = `${formalCatalogRows || ""}${!formalCatalogRows && !comingPlatformCount ? '<div class="empty-state compact"><p>没有符合当前筛选条件的平台。</p></div>' : ""}`;
  const formalCount = formalCatalogPlatforms.length;
  const readyCount = formalCatalogPlatforms.filter((platform) => publisherAccountReadyForGroup(catalogGroup, platform.id)).length;
  const pendingLoginCount = formalCount - readyCount;
  const categoryOptions = [["all", "全部类型"], ["content", "内容平台"], ["social", "社交平台"], ["video", "视频平台"], ["tech", "行业 / 技术"]].map(([value, label]) => `<option value="${value}" ${catalogCategoryFilter === value ? "selected" : ""}>${label}</option>`).join("");
  const statusOptions = [["all", "全部状态"], ["ready", "可直接发布"], ["login", "待登录"], ["unknown", "待确认"], ["planned", "规划中"]].map(([value, label]) => `<option value="${value}" ${catalogStatusFilter === value ? "selected" : ""}>${label}</option>`).join("");
  const catalogType = ui.assistantCatalogType === "official" ? "official" : "self_media";
  const officialStatus = officialPlatform.enabled === false ? "planned" : "ready";
  const officialState = officialStatus === "ready" ? "online" : "planned";
  const officialStatusBadge = officialStatus === "ready"
    ? '<span class="status-badge status-online">已接入</span>'
    : statusBadge(officialState);
  const officialDescription = officialPlatform.description || "由官网服务器直接发布，作为企业长期可控的主信源";
  return `
    <div class="page-container">
      ${pageHead("发布助手", "本地 Windows 软件负责平台账号登录和执行；发布任务只负责选择审核通过的文章、账号组和平台。")}
      <section class="card assistant-hero"><div class="device-state"><span class="device-icon" data-icon="monitor"><i></i></span><div class="device-state-body"><h3>${escapeHtml(deviceName)}</h3><p class="device-state-meta">${lastHeartbeat ? `最近心跳：${escapeHtml(formatTimeLabel(lastHeartbeat))}` : '本机尚未安装桐灼 GEO 桌面发布器'}</p><div class="device-state-hint">${lastHeartbeat ? '' : '下载并安装桌面软件后,点击「生成配对码」建立与本后台的连接。'}</div></div></div><div class="assistant-meta"><div class="meta-cell"><span>设备状态</span><b>${lastHeartbeat ? statusBadge(liveState) : '<span class="meta-empty">未连接</span>'}</b></div><div class="meta-cell"><span>账号组</span><b>${groups ? state.accountGroups.filter((group) => group.id !== "unpaired").length : 0} <small>组</small></b></div><div class="meta-cell"><span>平台账号</span><b>${accountCount} <small>个</small></b></div></div></section>
      <section class="card assistant-download-card"><div class="assistant-download-copy"><span class="download-app-icon" data-icon="monitor"></span><div><span class="section-kicker">桌面客户端 · Windows</span><h3>桐灼 GEO 桌面发布器</h3><p>桌面软件启动后会在本机托盘运行，账号登录态只留在客户电脑；后台通过任务队列把审核后的文章交给它执行。</p></div></div><div class="assistant-download-actions"><a class="primary-button" href="${publisherDownloadHref()}" download><span data-icon="download"></span>下载 Windows 桌面软件</a><button class="secondary-button" type="button" data-action="pair-device"><span data-icon="link"></span>生成配对码</button></div></section>
      <section class="card assistant-platform-catalog"><div class="card-header"><div><h3>发布平台目录</h3><p>将企业官网与自媒体账号分开管理：官网承载官方信源，自媒体平台由本地发布助手执行。</p></div><div class="assistant-catalog-tools">${catalogGroupOptions ? `<label><span>账号组</span><select class="select" data-assistant-catalog-group>${catalogGroupOptions}</select></label>` : ""}<span class="small-tag teal">${readyCount} 个可发布</span></div></div><div class="assistant-catalog-summary"><span><b>${formalCount}</b> 自媒体平台</span><span><b>1</b> 官方入口</span><span><b>${readyCount}</b> 已可发布</span><span><b>${pendingLoginCount}</b> 待登录</span>${comingPlatformCount ? `<span><b>${comingPlatformCount}</b> 规划中</span>` : ""}</div><div class="assistant-platform-tabs" role="tablist" aria-label="发布平台类型"><button class="assistant-platform-tab ${catalogType === "self_media" ? "is-active" : ""}" type="button" role="tab" aria-selected="${catalogType === "self_media" ? "true" : "false"}" aria-controls="assistant-self-media-pane" data-assistant-platform-tab="self_media"><span class="assistant-platform-tab-icon" data-icon="send"></span><span><b>自媒体平台</b><small>本地账号登录与任务执行</small></span><strong>${formalCount} 个</strong></button><button class="assistant-platform-tab ${catalogType === "official" ? "is-active" : ""}" type="button" role="tab" aria-selected="${catalogType === "official" ? "true" : "false"}" aria-controls="assistant-official-media-pane" data-assistant-platform-tab="official"><span class="assistant-platform-tab-icon" data-icon="globe"></span><span><b>官方媒体平台</b><small>企业官网与官方内容信源</small></span><strong>1 个入口</strong></button></div><div id="assistant-self-media-pane" class="assistant-platform-pane" role="tabpanel" data-assistant-platform-pane="self_media" ${catalogType !== "self_media" ? "hidden" : ""}><div class="assistant-catalog-toolbar"><div class="compact-search"><span data-icon="search"></span><input class="input" value="${escapeHtml(ui.assistantCatalogSearch || "")}" placeholder="搜索平台、能力或账号" aria-label="搜索自媒体平台" data-assistant-catalog-search /></div><label><span>平台类型</span><select class="select" data-assistant-catalog-category>${categoryOptions}</select></label><label><span>状态</span><select class="select" data-assistant-catalog-status>${statusOptions}</select></label></div><div class="assistant-platform-list">${catalogRows || '<div class="empty-state compact"><p>等待桌面发布器目录同步。</p></div>'}</div></div><div id="assistant-official-media-pane" class="assistant-platform-pane" role="tabpanel" data-assistant-platform-pane="official" ${catalogType !== "official" ? "hidden" : ""}><article class="assistant-official-card"><div class="assistant-official-main"><div class="assistant-official-logo">${platformLogo("web")}</div><div><span class="section-kicker">官方第一方信源</span><h3>${escapeHtml(officialPlatform.name || "企业官网")}</h3><p>${escapeHtml(officialDescription)}</p><div class="assistant-official-tags"><span>服务器发布</span><span>RSS / Sitemap</span><span>结构化数据</span></div></div></div><div class="assistant-official-state">${officialStatusBadge}<small>不依赖本地账号登录</small></div><div class="assistant-official-actions"><button class="primary-button" type="button" data-nav="site">进入官网运营</button><button class="secondary-button" type="button" data-nav="site">管理官网信源</button></div></article><div class="assistant-official-note"><span data-icon="info"></span><span><b>推荐流程：</b>文章先发布到企业官网，形成可长期引用的官方内容，再按需同步到自媒体平台。</span></div></div></section>
      <div class="privacy-note"><span data-icon="lock"></span><span><b class="block-title">平台登录态只留在本机</b>密码、Cookie、验证码与浏览器 Profile 不会上送服务器；后台只保存设备状态、账号别名、任务状态和发布结果。</span></div>
    </div>
  `;
}

function formatTimeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "-") : date.toLocaleString("zh-CN", { hour12: false });
}

function aiProviderProtocolLabel(protocol) {
  const labels = { openai_compatible: "OpenAI 兼容接口", deepseek: "DeepSeek", qwen: "通义千问", kimi: "Kimi / Moonshot", zhipu: "智谱 GLM", custom: "自定义接口" };
  return labels[protocol] || protocol || "OpenAI 兼容接口";
}

function aiProviderKindLabel(kind) {
  return kind === "image" ? "图片模型" : kind === "embedding" ? "向量模型" : "文本模型";
}

function aiProviderStatusMarkup(provider) {
  const status = provider?.connectionStatus || provider?.status || (provider?.connected ? "connected" : "not_configured");
  if (["connected", "online", "healthy", "passed"].includes(status)) return '<span class="status-badge status-online">已连接</span>';
  if (["testing", "pending"].includes(status)) return '<span class="status-badge status-pending">检测中</span>';
  if (["error", "failed"].includes(status)) return '<span class="status-badge status-error">连接失败</span>';
  return '<span class="status-badge status-draft">未测试</span>';
}

function renderAiProviderCards() {
  if (aiProviderSnapshot.loading) return '<div class="ai-provider-empty"><span class="loading-spinner dark"></span><b>正在读取模型供应商</b><p>仅加载供应商名称和脱敏状态，不会读取 API 密钥。</p></div>';
  if (!aiProviderSnapshot.loaded && aiProviderSnapshot.error) return `<div class="ai-provider-empty error"><span data-icon="alert"></span><b>模型供应服务未连接</b><p>${escapeHtml(aiProviderSnapshot.error)}。启动服务端后可在这里添加 API。</p><button class="secondary-button button-small" type="button" data-action="refresh-ai-providers"><span data-icon="refresh"></span>重新读取</button></div>`;
  if (!aiProviderSnapshot.providers.length) return '<div class="ai-provider-empty"><span data-icon="cpu"></span><b>还没有模型供应商</b><p>添加 API 后，模型才会出现在“更换模型”和写作智能体中。</p><button class="secondary-button button-small" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>添加第一个供应商</button></div>';
  return `<div class="ai-provider-list">${aiProviderSnapshot.providers.map((provider) => {
    const textDefault = state.settings.modelProviderId === provider.id;
    const imageDefault = state.settings.imageProviderId === provider.id;
    const embeddingDefault = state.settings.embeddingProviderId === provider.id;
    const modelNames = Array.isArray(provider.models) ? provider.models.map((model) => model.id || model.name).filter(Boolean).slice(0, 3) : [];
    const configuredModel = provider.model || provider.modelId || "未配置模型";
    const displayedModels = modelNames.length ? modelNames.join("、") : configuredModel;
    const testMessage = String(provider.lastTestMessage || "").trim();
    const testDetail = testMessage
      ? `<small class="setting-value-sub ${provider.connectionStatus === "failed" ? "warning" : ""}">${escapeHtml(testMessage)}${provider.lastTestAt ? ` · ${escapeHtml(formatTimeLabel(provider.lastTestAt))}` : ""}</small>`
      : "";
    return `<article class="ai-provider-row"><div class="ai-provider-icon"><span data-icon="cpu"></span></div><div class="ai-provider-copy"><div class="ai-provider-title"><b>${escapeHtml(provider.name || "未命名供应商")}</b>${aiProviderStatusMarkup(provider)}</div><p>${escapeHtml(aiProviderProtocolLabel(provider.protocol))} · ${escapeHtml(provider.baseUrl || "未填写 Base URL")}</p><div class="ai-provider-meta"><span>${escapeHtml(provider.apiKeyMasked || "未配置密钥")}</span><span>${escapeHtml(displayedModels)}</span></div>${testDetail}<div class="ai-provider-defaults">${textDefault ? '<span class="small-tag blue">默认文本模型</span>' : ''}${imageDefault ? '<span class="small-tag teal">默认图片模型</span>' : ''}${embeddingDefault ? '<span class="small-tag violet">默认向量模型</span>' : ''}</div></div><div class="ai-provider-actions"><button class="secondary-button button-small" type="button" data-action="edit-ai-provider" data-provider-id="${escapeHtml(provider.id)}">编辑</button><button class="ghost-button button-small" type="button" data-action="test-ai-provider" data-provider-id="${escapeHtml(provider.id)}">测试</button><button class="text-button" type="button" data-action="delete-ai-provider" data-provider-id="${escapeHtml(provider.id)}">删除</button></div></article>`;
  }).join("")}</div>`;
}

function renderSettingsPanel() {
  if (ui.settingsTab === "effect-relay") {
    const snapshot = effectRelayConfigSnapshot;
    const config = snapshot.config || {};
    const managedByEnvironment = config.source === "environment";
    const canManageRelay = currentUserCan("system.manage");
    if (snapshot.loading && !snapshot.loaded) return '<section class="card"><div class="card-body ai-provider-empty"><span class="loading-spinner dark"></span><b>正在读取 AI 效果检测服务配置</b><p>配置只保存在客户服务器，不会写入浏览器。</p></div></section>';
    if (snapshot.error && !snapshot.loaded) return `<section class="card"><div class="card-body ai-provider-empty error"><span data-icon="alert"></span><b>配置服务暂不可用</b><p>${escapeHtml(snapshot.error)}</p><button class="secondary-button button-small" type="button" data-action="refresh-effect-relay-config"><span data-icon="refresh"></span>重新读取</button></div></section>`;
    const disabled = managedByEnvironment ? "disabled" : "";
    const test = snapshot.test || (config.lastTestStatus ? { status: config.lastTestStatus, message: config.lastTestMessage, details: config.lastTestDetails } : null);
    const testMessage = test?.message || config.lastTestMessage || "尚未测试连接。";
    const capabilityCount = Number(test?.details?.capabilityCount ?? config.lastTestDetails?.capabilityCount ?? 0);
    return `
      <section class="card settings-relay-card">
        <div class="card-header"><div><h3>AI 效果检测服务</h3><p>配置爱搜 / 灼见中转服务，用于实时搜索、品牌诊断和品牌监测。密钥只在服务端加密保存，保存后不会回显。</p></div><div class="settings-relay-status">${effectRelayStatusMarkup(config, snapshot.relay)}</div></div>
        ${managedByEnvironment ? '<div class="privacy-note panel"><span data-icon="lock"></span><span>当前实例由环境变量接管配置。页面仅展示脱敏状态，修改请更新 TZ_RELAY_* 环境变量并重启服务。</span></div>' : ""}
        <div class="setting-section settings-relay-form">
          <label class="setting-field"><span>中转服务地址</span><input id="effect-relay-base-url" class="input" type="url" value="${escapeHtml(config.baseUrl || "")}" placeholder="https://relay.example.com" ${disabled} /></label>
          <label class="setting-field"><span>实例 ID</span><input id="effect-relay-instance-id" class="input" value="${escapeHtml(config.instanceId || "")}" placeholder="客户实例标识" ${disabled} /></label>
          <label class="setting-field"><span>Client ID</span><input id="effect-relay-client-id" class="input" value="${escapeHtml(config.clientId || "")}" placeholder="中转服务分配的 Client ID" ${disabled} /></label>
          <label class="setting-field"><span>Client Secret</span><input id="effect-relay-client-secret" class="input" type="password" value="" autocomplete="new-password" placeholder="${config.hasClientSecret ? "已保存，留空表示不更换" : "输入实例密钥"}" ${disabled} /></label>
          <label class="setting-field"><span>交付消费者 <small>可选</small></span><input id="effect-relay-delivery-consumer" class="input" value="${escapeHtml(config.deliveryConsumer || "")}" placeholder="默认 private-sync:实例ID" ${disabled} /></label>
        </div>
        <div class="setting-row settings-relay-summary"><div><b>连接状态</b><small>${escapeHtml(testMessage)}${config.lastTestAt ? ` · ${escapeHtml(formatTimeLabel(config.lastTestAt))}` : ""}</small></div><div class="setting-value">${capabilityCount ? `${capabilityCount} 项能力` : (snapshot.relay?.configured ? "已配置" : "未配置")}</div></div>
        <div class="card-footer settings-relay-actions"><button class="secondary-button button-small" type="button" data-action="refresh-effect-relay-config"><span data-icon="refresh"></span>刷新状态</button><button class="ghost-button button-small" type="button" data-action="test-effect-relay-config" ${snapshot.testing || !canManageRelay ? "disabled" : ""}>${snapshot.testing ? '<span class="loading-spinner"></span>测试中…' : `${icon("chart")}测试连接`}</button>${managedByEnvironment ? "" : `<button class="primary-button button-small" type="button" data-action="save-effect-relay-config" ${snapshot.saving || !canManageRelay ? "disabled" : ""}>${snapshot.saving ? '<span class="loading-spinner"></span>保存中…' : "保存配置"}</button>`}</div>
      </section>
    `;
  }
  if (ui.settingsTab === "models") {
    return `
      <section class="card">
        <div class="card-header"><div><h3>AI 模型</h3><p>模型选择会作为新生成文章的执行快照；既有文章、计划和智能体版本不会被覆盖。</p></div><div class="settings-model-actions"><button class="secondary-button button-small" type="button" data-action="refresh-ai-providers"><span data-icon="refresh"></span>刷新供应商</button><button class="primary-button button-small" type="button" data-action="add-ai-provider"><span data-icon="plus"></span>添加 API 供应商</button></div></div>
        <div class="setting-section">
          <div class="setting-row"><div><b>默认文本模型</b><small>用于文章生成、AI 协作和企业知识整理</small></div><div class="setting-value">${escapeHtml(state.settings.model)}${state.settings.modelProviderId ? '<small class="setting-value-sub">已绑定 API 供应商</small>' : '<small class="setting-value-sub warning">尚未绑定 API</small>'}</div><button class="secondary-button button-small" type="button" data-action="edit-model" data-model-kind="text">更换</button></div>
          <div class="setting-row"><div><b>默认图片模型</b><small>用于文章配图任务；不影响已审核的知识库图片</small></div><div class="setting-value">${escapeHtml(state.settings.imageModel)}${state.settings.imageProviderId ? '<small class="setting-value-sub">已绑定 API 供应商</small>' : '<small class="setting-value-sub warning">尚未绑定 API</small>'}</div><button class="secondary-button button-small" type="button" data-action="edit-model" data-model-kind="image">更换</button></div>
          <div class="setting-row"><div><b>默认向量模型</b><small>用于企业知识库分块向量化和 RAG 检索</small></div><div class="setting-value">${state.settings.embeddingProviderId ? '<small class="setting-value-sub">已绑定 embedding API</small>' : '<small class="setting-value-sub warning">使用本地兜底向量</small>'}</div><button class="secondary-button button-small" type="button" data-action="edit-model" data-model-kind="embedding">更换</button></div>
          <div class="setting-row"><div><b>写作智能体</b><small>提示词、写作角色和知识策略在内容生产中独立管理</small></div><div class="setting-value">${(state.writingAgents || []).filter((agent) => agent.status === "active").length} 个启用</div><button class="secondary-button button-small" type="button" data-action="open-writing-agent-manager">进入管理</button></div>
        </div>
        <div class="privacy-note panel"><span data-icon="lock"></span><span>API 密钥使用 AES-256-GCM 在服务器端加密保存；浏览器只显示供应商状态和密钥掩码，主密钥与业务数据库分开保管。</span></div>
      </section>
      <section class="card ai-provider-section"><div class="card-header"><div><h3>模型供应商 / API</h3><p>一个供应商可以提供多个文本、图片或向量模型；添加后再在“更换模型”中选择。</p></div><span class="small-tag blue">服务端管理</span></div>${renderAiProviderCards()}</section>
    `;
  }
  if (ui.settingsTab === "members") {
    const canManageUsers = currentUserCan("users.manage");
    const memberBadge = (member) => member.status === "active" ? '<span class="status-badge status-approved">已启用</span>' : '<span class="status-badge status-error">已停用</span>';
    const rows = (state.settings.members || []).map((member) => `<tr><td><b>${escapeHtml(member.name)}</b><small class="block-subtext text-muted">${escapeHtml(member.username || member.email)}</small></td><td>${escapeHtml(member.role)}</td><td>${member.lastLoginAt ? escapeHtml(formatRelative(member.lastLoginAt)) : "尚未登录"}</td><td>${memberBadge(member)}</td><td>${canManageUsers ? `<button class="link-button" type="button" data-action="manage-member" data-member-id="${escapeHtml(member.id)}">管理</button>` : "—"}</td></tr>`).join("");
    return `
      <section class="card table-card">
        <div class="card-header"><div><h3>成员与权限</h3><p>账号、密码、角色和登录状态由当前客户服务器统一管理，所有权限由服务端执行。</p></div>${canManageUsers ? '<button class="primary-button button-small" type="button" data-action="invite-member"><span data-icon="plus"></span>创建成员</button>' : ""}</div>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>成员</th><th>角色</th><th>最近登录</th><th>状态</th><th></th></tr></thead><tbody>
          ${rows || '<tr><td colspan="5">暂无成员</td></tr>'}
        </tbody></table></div><div class="privacy-note panel"><span data-icon="lock"></span><span>密码使用 scrypt 保存；登录会话和 CSRF Token 在数据库中只保存摘要。停用账号会立即撤销其所有会话。</span></div>
      </section>
    `;
  }
  if (ui.settingsTab === "logs") {
    const logs = auditSnapshot.loaded
      ? auditSnapshot.items.map((entry) => ({ occurredAt: entry.occurredAt, category: entry.action, actor: entry.actor, detail: `${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}` }))
      : [...(state.settings.operationLogs || [])].sort((a, b) => Number(b.occurredAt || 0) - Number(a.occurredAt || 0));
    return `
      <section class="card">
        <div class="card-header"><div><h3>操作日志</h3><p>登录、成员、工作区、审核、发布和配置事件由服务器写入不可由浏览器修改的审计表。</p></div><button class="secondary-button button-small" type="button" data-action="refresh-audit"><span data-icon="refresh"></span>刷新</button><button class="secondary-button button-small" type="button" data-action="export-logs"><span data-icon="download"></span>导出 CSV</button></div>
        <div class="card-body log-list">
          ${logs.map((entry) => `<div class="log-item"><span title="${escapeHtml(formatDateTime(entry.occurredAt))}">${escapeHtml(formatRelative(entry.occurredAt))}</span><b>${escapeHtml(entry.category)}</b><span><small>${escapeHtml(entry.actor)} · </small>${escapeHtml(entry.detail)}</span></div>`).join("") || '<div class="empty-state compact"><p>暂无可导出的操作日志。</p></div>'}
        </div>
      </section>
    `;
  }
  return `
    <section class="card">
      <div class="card-header"><div><h3>部署与工作流</h3><p>当前客户空间的基础配置</p></div><button class="primary-button button-small" data-action="save-settings">保存设置</button></div>
      <div class="setting-section">
        <div class="setting-row"><div><b>部署方式</b><small>应用、数据库、官网均客户独立</small></div><div class="setting-value">${escapeHtml(state.settings.deployment)} · 桐灼科技</div><span class="small-tag teal">运行正常</span></div>
        <div class="setting-row"><div><b>文章风险门禁</b><small>存在高风险表述时阻止发布</small></div><div class="setting-value">审核通过仍需经过发布风险门</div><button class="toggle ${state.settings.riskGate ? "on" : ""}" type="button" data-setting="riskGate" aria-label="切换风险门禁"></button></div>
        <div class="setting-row"><div><b>人工审核</b><small>AI 生成文章默认进入待审核</small></div><div class="setting-value">适用于所有内容生成任务</div><button class="toggle ${state.settings.manualReview ? "on" : ""}" type="button" data-setting="manualReview" aria-label="切换人工审核"></button></div>
        <div class="setting-row"><div><b>系统版本</b><small>企业私有化生产底座</small></div><div class="setting-value">Tongzhuo GEO Platform 1.0.0-alpha.1</div><button class="secondary-button button-small" data-action="show-version">版本说明</button></div>
      </div>
      <div class="setting-section">
        <div class="setting-row"><div><b>数据保护</b><small>正式数据库、修订记录和备份恢复</small></div><div class="setting-value">SQLite WAL · 乐观锁 · 服务端审计</div><span class="small-tag teal">已启用</span></div>
      </div>
    </section>
  `;
}

function renderSettings() {
  const items = [
    ["general", "settings", "通用设置"],
    ["models", "cpu", "AI 模型"],
    ["effect-relay", "chart", "AI 效果检测"],
    ["members", "users", "成员权限"],
    ["logs", "log", "操作日志"]
  ];
  const nav = items.map(([id, iconName, label]) => '<button class="' + (ui.settingsTab === id ? "active" : "") + '" type="button" data-action="settings-tab" data-tab="' + id + '"><span data-icon="' + iconName + '"></span>' + label + "</button>").join("");
  return `
    <div class="page-container">
      ${pageHead("系统设置", "管理当前客户独立部署环境，不包含平台账号密码与登录态。")}
      <div class="settings-layout">
        <aside class="card settings-nav">${nav}</aside>
        ${renderSettingsPanel()}
      </div>
    </div>
  `;
}

function closeModal({ resolvePending = true } = {}) {
  if (ui.modal?.type === "onboarding") persistOnboardingDraft();
  if (resolvePending && ui.modal?._confirmResolve) ui.modal._confirmResolve(false);
  if (resolvePending && ui.modal?._promptResolve) ui.modal._promptResolve(null);
  document.body.classList.remove("modal-open");
  ui.modal = null;
  ui.publishSelection = null;
  ui.scheduleSelection = null;
  ui.submittingSchedule = false;
  ui.submittingPublish = false;
  ui.monitorPlatformSelection = null;
  document.getElementById("modal-root").innerHTML = "";
  document.body.style.overflow = "";
}

function mountModal(html) {
  const root = document.getElementById("modal-root");
  document.body.classList.add("modal-open");
  root.innerHTML = html;
  hydrateCustomerFacingEffectCopy(root);
  hydrateIcons(root);
  hydrateBulkSelects(root);
  document.body.style.overflow = "hidden";
}

window.__TZ_MID__ = "mid";
/* 轻量分页：前 N 条 + 查看全部 */
function lightPaged(items, stateKey, pageSize = 20) {
  const showAll = Boolean(ui[stateKey + "ShowAll"]);
  const visible = showAll ? items : items.slice(0, pageSize);
  const more = items.length > pageSize;
  const toggle = more ? `<div class="light-pager"><span>共 ${items.length} 条</span><button class="link-button" type="button" data-action="toggle-paged" data-state="${escapeHtml(stateKey)}">${showAll ? "收起" : "查看全部"}</button></div>` : "";
  return { visible, toggle };
}

function renderModal() {
  if (!ui.modal) return closeModal();
  const renderers = {
    confirm: renderConfirmModal,
    prompt: renderPromptModal,
    article: renderArticleModal,
    batchReview: renderBatchReviewModal,
    schedule: renderScheduleModal,
    task: renderTaskModal,
    search: renderSearchModal,
    notifications: renderNotificationsModal,
    pair: renderPairModal,
    knowledge: renderKnowledgeModal,
    importKnowledge: renderImportKnowledgeModal,
    uploadKnowledgeImages: renderUploadKnowledgeImagesModal,
    createKnowledgeBase: renderCreateKnowledgeBaseModal,
    knowledgeBaseDetail: renderKnowledgeBaseDetailModal,
    knowledgePackage: renderKnowledgePackageModal,
    knowledgeItem: renderKnowledgeItemModal,
    generationPreview: renderGenerationPreviewModal,
    citation: renderCitationModal,
    onboarding: renderOnboardingModal,
    businessLine: renderBusinessLineModal,
    businessLineManager: renderBusinessLineManagerModal,
    deleteBusinessLine: renderDeleteBusinessLineModal,
    contentPlan: renderContentPlanModal,
    topicPlanPicker: renderTopicPlanPickerModal,
    writingAgent: renderWritingAgentModal,
    regenerateArticle: renderRegenerateArticleModal,
    articleVersion: renderArticleVersionModal,
    trackedWork: renderTrackedWorkModal,
    modelEditor: renderModelEditorModal,
    memberEditor: renderMemberEditorModal,
    risk: renderRiskModal,
    questionEditor: renderQuestionEditorModal,
    topicEditor: renderTopicEditorModal,
    planningRelations: renderPlanningRelationsModal,
    planningArchiveDelete: renderPlanningArchiveDeleteModal,
    sitePublish: renderSitePublishModal,
    sitePreview: renderSitePreviewModal,
    siteReleases: renderSiteReleasesModal,
    sitePageEditor: renderSitePageEditorModal,
    siteModule: renderSiteModuleModal,
    siteService: renderSiteServiceModal,
    siteCase: renderSiteCaseModal,
    siteProblemGroup: renderSiteProblemGroupModal,
    siteQuestion: renderSiteQuestionModal,
    siteCategoryManager: renderSiteCategoryManagerModal,
    siteCategory: renderSiteCategoryModal,
    siteArticlePreview: renderSiteArticlePreviewModal,
    siteArticleMeta: renderSiteArticleMetaModal,
    siteNav: renderSiteNavModal,
    siteFooterColumn: renderSiteFooterColumnModal,
    siteFooterSocial: renderSiteFooterSocialModal,
    siteLeadFollow: renderSiteLeadFollowModal,
    siteDeployment: renderSiteDeploymentModal,
    siteRedirects: renderSiteRedirectsModal,
    version: renderVersionModal,
    aiProvider: renderAiProviderModal
  };
  const renderer = renderers[ui.modal.type];
  if (!renderer) return closeModal();
  mountModal(renderer());
  if (ui.modal.type === "importKnowledge") document.getElementById("knowledge-import-file")?.setAttribute("accept", ".pdf,.docx,.xlsx,.txt,.md,.csv,.html,.htm,.json,.xml,image/*");
}


/* 异步确认（系统弹窗，替换 window.confirm） */
function uiConfirm(message, title = "确认操作") {
  return new Promise((resolve) => {
    ui.modal = { type: "confirm", title, message, danger: true, confirmLabel: "确认", cancelLabel: "取消", _confirmResolve: resolve, onConfirm: () => { resolve(true); return true; } };
    renderModal();
  });
}

/* 异步输入（系统弹窗，替换 window.prompt） */
function uiPrompt(title, placeholder = "", value = "", multiline = false) {
  return new Promise((resolve) => {
    ui.modal = {
      type: "prompt",
      title,
      placeholder,
      value,
      multiline,
      _promptResolve: resolve,
      onConfirm: () => {
        const v = promptValue();
        if (!v) {
          ui.modal.error = "请填写内容后再确认。";
          renderModal();
          window.setTimeout(() => document.getElementById("prompt-input")?.focus(), 30);
          return false;
        }
        resolve(v);
        return true;
      }
    };
    renderModal();
    window.setTimeout(() => document.getElementById("prompt-input")?.focus(), 30);
  });
}

/* 通用确认弹窗：替换原生 window.confirm */
function openConfirm(options) {
  ui.modal = { type: "confirm", title: options.title || "确认操作", message: options.message || "", danger: options.danger !== false, confirmLabel: options.confirmLabel || (options.danger === false ? "确定" : "确认删除"), cancelLabel: options.cancelLabel || "取消", hint: options.hint || (options.danger !== false ? "该操作可能无法恢复，请确认。" : ""), onConfirm: options.onConfirm || (() => {}) };
  return renderModal();
}

function renderConfirmModal() {
  const m = ui.modal;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${escapeHtml(m.title)}</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="confirm-message"><span class="confirm-icon ${m.danger ? "danger" : ""}" data-icon="${m.danger ? "alert" : "info"}"></span><p>${escapeHtml(m.message)}</p></div></div><div class="modal-foot"><span>${escapeHtml(m.hint || "")}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">${escapeHtml(m.cancelLabel)}</button><button class="${m.danger ? "danger-button" : "primary-button"}" type="button" data-action="confirm-action">${escapeHtml(m.confirmLabel)}</button></div></div>`, { className: "confirm-dialog" });
}

/* 通用输入弹窗：替换原生 window.prompt */
function openPrompt(options) {
  ui.modal = { type: "prompt", title: options.title || "请输入", placeholder: options.placeholder || "", value: options.value || "", multiline: !!options.multiline, onConfirm: options.onConfirm || (() => {}) };
  return renderModal();
}

function renderPromptModal() {
  const m = ui.modal;
  const errorAttributes = m.error ? ' aria-invalid="true" aria-describedby="prompt-error"' : "";
  const input = m.multiline
    ? `<textarea class="textarea ${m.error ? "input-error" : ""}" id="prompt-input" rows="5" placeholder="${escapeHtml(m.placeholder)}"${errorAttributes}>${escapeHtml(m.value)}</textarea>`
    : `<input class="input ${m.error ? "input-error" : ""}" id="prompt-input" value="${escapeHtml(m.value)}" placeholder="${escapeHtml(m.placeholder)}"${errorAttributes} />`;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">${escapeHtml(m.title)}</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body">${input}${m.error ? `<small class="error-text" id="prompt-error" role="alert">${escapeHtml(m.error)}</small>` : ""}</div><div class="modal-foot"><span>按 Enter 确认</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="confirm-action">确定</button></div></div>`, { className: "prompt-dialog" });
}

function promptValue() {
  return String(document.getElementById("prompt-input")?.value || "").trim();
}

function modalChrome(content, options = {}) {
  const className = (options.drawer ? "drawer-dialog" : "modal-dialog" + (options.wide ? " wide" : "")) + (options.className ? ` ${options.className}` : "");
  return `
    <div class="modal-backdrop" data-action="backdrop-close"></div>
    <section class="${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      ${content}
    </section>
  `;
}

function renderQuestionEditorModal() {
  const question = state.questionLibrary.find((item) => item.id === ui.modal.questionId);
  if (!question) return "";
  const refs = planningQuestionReferences(question);
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">编辑问题</h2><p>${escapeHtml(question.id)} · 当前版本 v${escapeHtml(question.version || 1)} · 修改不会回写历史文章</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="planning-question-text">标准问题 *</label><textarea class="textarea" id="planning-question-text" rows="3">${escapeHtml(question.question)}</textarea></div><div class="field-row"><div class="field"><label for="planning-question-source">来源关键词</label><input class="input" id="planning-question-source" value="${escapeHtml(question.sourceKeyword || "")}" /></div><div class="field"><label for="planning-question-coverage">覆盖状态</label><select class="select" id="planning-question-coverage"><option ${question.coverage === "未覆盖" ? "selected" : ""}>未覆盖</option><option ${question.coverage === "部分覆盖" ? "selected" : ""}>部分覆盖</option><option ${question.coverage === "已覆盖" ? "selected" : ""}>已覆盖</option><option ${question.coverage === "已规划" ? "selected" : ""}>已规划</option></select></div></div>${refs.topics.length ? `<div class="archive-impact-note"><span data-icon="info"></span><span>该问题已关联 ${refs.topics.length} 个选题、${refs.plans.length} 个计划和 ${refs.articles.length} 篇文章。保存后只更新问题版本，已有选题和文章保留原快照。</span></div>` : ""}</div><div class="modal-foot"><span>保存后版本号会递增</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-question-edit"><span data-icon="check"></span>保存问题</button></div></div>`, { wide: true });
}

function renderTopicEditorModal() {
  const topic = state.topics.find((item) => item.id === ui.modal.topicId);
  if (!topic) return "";
  const dimensions = DIMENSIONS.filter((item) => item.id !== "all").map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === topic.dimension ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
  const coreQuestion = topic.coreQuestion || topic.geoBrief?.coreQuestion || topic.title || "";
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">编辑选题</h2><p>${escapeHtml(topic.id)} · 当前版本 v${escapeHtml(topic.version || 1)} · 历史计划和文章不会被回写</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body planning-editor-form"><div class="field"><label for="planning-topic-title">选题标题 *</label><textarea class="textarea" id="planning-topic-title" rows="3">${escapeHtml(topic.title)}</textarea></div><div class="field"><label for="planning-topic-core-question">核心回答问题 *</label><textarea class="textarea" id="planning-topic-core-question" rows="3">${escapeHtml(coreQuestion)}</textarea></div><div class="field"><label for="planning-topic-dimension">内容方向</label><select class="select" id="planning-topic-dimension">${dimensions}</select></div><div class="field"><label for="planning-topic-intent">用户意图</label><input class="input" id="planning-topic-intent" value="${escapeHtml(topic.intent || "")}" /></div></div><div class="modal-foot"><span>保存后版本号会递增</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="submit-topic-edit"><span data-icon="check"></span>保存选题</button></div></div>`, { wide: true });
}

function renderPlanningRelationsModal() {
  const kind = ui.modal.kind === "topic" ? "topic" : "question";
  const record = kind === "question" ? state.questionLibrary.find((item) => item.id === ui.modal.recordId) : state.topics.find((item) => item.id === ui.modal.recordId);
  if (!record) return "";
  if (kind === "question") {
    const refs = planningQuestionReferences(record);
    const topics = refs.topics.map((topic) => `<div class="relation-step"><span class="relation-step-index">选题</span><div><b>${escapeHtml(topic.title)}</b><small>${escapeHtml(topic.id)} · v${escapeHtml(topic.version || 1)} · ${planningTopicPlans(topic).length} 个计划 · ${planningTopicArticles(topic).length} 篇文章</small></div></div>`).join("");
    return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">问题引用关系</h2><p>${escapeHtml(record.question)} · ${escapeHtml(record.id)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="relation-chain"><div class="relation-step"><span class="relation-step-index">问题</span><div><b>${escapeHtml(record.question)}</b><small>${escapeHtml(record.sourceKeyword || "无来源关键词")} · v${escapeHtml(record.version || 1)}</small></div></div><span class="relation-arrow">↓</span>${topics || '<div class="archive-empty empty-state"><div><h3>还没有生成选题</h3><p>这个问题可以继续生成一个选题。</p></div></div>'}</div><div class="side-list mt-lg"><div><span>内容计划</span><b>${refs.plans.length} 个</b></div><div><span>文章任务</span><b>${refs.articles.length} 篇</b></div><div><span>管理规则</span><b>${record.status === "archived" ? "已归档，不参与新计划" : "使用中"}</b></div></div></div><div class="modal-foot"><span>归档不会破坏历史来源链</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>`, { wide: true });
  }
  const refs = planningTopicReferences(record);
  const plans = refs.plans.map((plan) => `<div class="relation-step"><span class="relation-step-index">计划</span><div><b>${escapeHtml(plan.name)}</b><small>${escapeHtml(plan.id)} · ${escapeHtml(plan.status || "")}</small></div></div>`).join("");
  const articles = refs.articles.map((article) => `<div class="relation-step"><span class="relation-step-index">文章</span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${escapeHtml(article.version || "")}</small></div></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">选题引用关系</h2><p>${escapeHtml(record.title)} · ${escapeHtml(record.id)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="relation-chain"><div class="relation-step"><span class="relation-step-index">选题</span><div><b>${escapeHtml(record.title)}</b><small>${escapeHtml(refs.question?.question || "历史问题")} · v${escapeHtml(record.version || 1)}</small></div></div><span class="relation-arrow">↓</span>${plans || '<div class="relation-step"><span class="relation-step-index">计划</span><div><b>尚未加入内容计划</b></div></div>'}<span class="relation-arrow">↓</span>${articles || '<div class="relation-step"><span class="relation-step-index">文章</span><div><b>尚未生成文章</b></div></div>'}</div><div class="side-list mt-lg"><div><span>来源问题</span><b>${escapeHtml(refs.question?.id || "未找到")}</b></div><div><span>计划数量</span><b>${refs.plans.length} 个</b></div><div><span>文章数量</span><b>${refs.articles.length} 篇</b></div><div><span>管理规则</span><b>${record.status === "archived" ? "已归档，不参与新计划" : "使用中"}</b></div></div></div><div class="modal-foot"><span>归档不会删除已生成文章</span><div class="modal-foot-right"><button class="primary-button" type="button" data-action="close-modal">完成</button></div></div>`, { wide: true });
}

function renderPlanningArchiveDeleteModal() {
  const kind = ui.modal.kind === "topic" ? "topic" : "question";
  const record = kind === "question" ? state.questionLibrary.find((item) => item.id === ui.modal.recordId) : state.topics.find((item) => item.id === ui.modal.recordId);
  if (!record) return "";
  const refs = kind === "question" ? planningQuestionReferences(record) : planningTopicReferences(record);
  const canDelete = kind === "question" ? !record.packId && !refs.topics.length && !refs.plans.length && !refs.articles.length : !refs.plans.length && !refs.articles.length;
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">永久删除${kind === "question" ? "问题" : "选题"}</h2><p>该操作不可恢复，请确认数据没有任何引用。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="delete-business-line-warning ${canDelete ? "" : "danger"}"><span data-icon="${canDelete ? "info" : "lock"}"></span><div><b>${escapeHtml(kind === "question" ? record.question : record.title)}</b><p>${canDelete ? "当前没有计划、文章或下游关系，可以永久删除。" : "当前仍存在下游引用，只能继续保留为归档状态。"}</p></div></div><div class="delete-impact-grid"><div><span>关联选题</span><b>${refs.topics?.length || 0}</b></div><div><span>关联计划</span><b>${refs.plans.length}</b></div><div><span>关联文章</span><b>${refs.articles.length}</b></div></div></div><div class="modal-foot"><span>${canDelete ? "删除后无法恢复" : "请先解除所有引用"}</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="danger-button" type="button" data-action="confirm-delete-archive" data-kind="${kind}" data-record-id="${escapeHtml(record.id)}" ${canDelete ? "" : "disabled"}>确认永久删除</button></div></div>`, { wide: true });
}

async function deleteContentArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新页面后重试。", "error");
  const published = article.status === "published";
  if (!(await uiConfirm(published ? `确认删除已发布的文章“${article.title}”？官网相关内容会一并下线，删除后不可恢复。` : `确认删除文章“${article.title}”？删除后不可恢复。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/content/articles/${encodeURIComponent(article.contentArticleId || article.id)}`);
  } catch (error) {
    return showToast("文章删除失败", error.message || "服务器未能归档该文章。", "error");
  }
  state.articles = state.articles.filter((item) => item.id !== articleId);
  if (Array.isArray(state.contentAssets)) state.contentAssets = state.contentAssets.filter((asset) => asset.articleId !== articleId);
  saveState();
  await persistWorkspaceMutation("content-article-delete");
  render();
  showToast("文章已删除", published ? "文章及其官网内容已移除。" : "文章已从列表中移除。", "success");
}

async function deleteContentPlan(planId) {
  const plan = state.contentPlans.find((item) => item.id === planId);
  if (!plan) return;
  const articleCount = state.articles.filter((article) => contentPlanForArticle(article)?.id === planId).length;
  if (!(await uiConfirm(articleCount ? `确认删除内容计划“${plan.name}”？其下 ${articleCount} 篇关联文章不会被删除，但会失去计划归属。` : `确认删除内容计划“${plan.name}”？`))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/content/plans/${encodeURIComponent(plan.contentPlanId || plan.id)}`);
  } catch (error) {
    return showToast("内容计划删除失败", error.message || "服务器未能归档该计划。", "error");
  }
  state.contentPlans = state.contentPlans.filter((item) => item.id !== planId);
  state.articles.forEach((article) => { const p = contentPlanForArticle(article); if (p?.id === planId) { article.contentPlanId = null; article.planSnapshot = null; } });
  saveState();
  await persistWorkspaceMutation("content-plan-delete");
  render();
  showToast("内容计划已删除", articleCount ? "关联文章已解除计划归属。" : "计划已删除。", "success");
}

async function deleteKnowledgeBase(baseId) {
  const base = (state.knowledgeBases || []).find((item) => item.id === baseId);
  if (!base) return;
  const itemCount = (state.knowledgeItems || []).filter((item) => item.knowledgeBaseId === baseId).length;
  const kindLabel = base.kind === "qa" ? "问答库" : "文档库";
  const lineNames = (state.businessLines || []).filter((line) => (line.knowledgeBaseIds || []).includes(baseId)).map((line) => line.name);
  const linePart = lineNames.length ? `关联业务线：${lineNames.join("、")}` : "未关联任何业务线";
  const scope = itemCount ? `库内 ${itemCount} 条知识条目将一并移除` : "库内没有知识条目";
  if (!(await uiConfirm(`确认删除${kindLabel}“${base.name}”？${scope}，${linePart}。已生成的引用证据不会被改写，但会失去该知识库的检索来源。删除后不可恢复。`, "删除知识库"))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/knowledge/libraries/${encodeURIComponent(baseId)}`);
  } catch (error) {
    return showToast("知识库删除失败", error.message || "服务器未能归档该知识库。", "error");
  }
  state.knowledgeBases = state.knowledgeBases.filter((item) => item.id !== baseId);
  const removedItemIds = new Set((state.knowledgeItems || []).filter((item) => item.knowledgeBaseId === baseId).map((item) => item.id));
  state.knowledgeItems = (state.knowledgeItems || []).filter((item) => item.knowledgeBaseId !== baseId);
  state.knowledgeVersions = (state.knowledgeVersions || []).filter((version) => version.knowledgeBaseId !== baseId && !removedItemIds.has(version.knowledgeItemId));
  saveState();
  await persistWorkspaceMutation("knowledge-library-delete");
  render();
  showToast("知识库已删除", itemCount ? `知识库及 ${itemCount} 条条目已移除。` : "知识库已删除。", "success");
}

async function deleteKnowledgeItem(itemId) {
  const item = knowledgeItemById(itemId);
  if (!item) return;
  const base = knowledgeBaseById(item.knowledgeBaseId);
  if (!(await uiConfirm(`确认删除知识条目“${item.title || item.question}”？历史文章仍保留引用时的知识版本，但该条目将从库中移除。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/knowledge/documents/${encodeURIComponent(itemId)}`);
  } catch (error) {
    return showToast("知识条目删除失败", error.message || "服务器未能归档该条目。", "error");
  }
  state.knowledgeItems = (state.knowledgeItems || []).filter((entry) => entry.id !== itemId);
  state.knowledgeVersions = (state.knowledgeVersions || []).filter((version) => version.knowledgeItemId !== itemId);
  saveState();
  await persistWorkspaceMutation("knowledge-document-delete");
  closeModal();
  render();
  showToast("知识条目已删除", "该条目已从知识库移除。", "success");
}

async function deleteSiteLead(leadId) {
  const lead = siteLeads().find((item) => item.id === leadId) || (siteCms().leads || []).find((item) => item.id === leadId) || (state.siteLeads || []).find((item) => item.id === leadId);
  if (!lead) return showToast("线索不存在", "请刷新页面后重试。", "error");
  if (!(await uiConfirm(`确认删除来自 ${escapeHtml(lead.name || "未知")} 的线索？删除后不可恢复，导出 CSV 和转化统计会同步变化。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/site-cms/leads/${encodeURIComponent(leadId)}`);
  } catch (error) {
    return showToast("线索删除失败", error.message || "服务器未能删除该线索。", "error");
  }
  siteCmsRuntime.leads = (siteCmsRuntime.leads || []).filter((item) => item.id !== leadId);
  if (siteCms().leads) siteCms().leads = siteCms().leads.filter((item) => item.id !== leadId);
  if (Array.isArray(state.siteLeads)) state.siteLeads = state.siteLeads.filter((item) => item.id !== leadId);
  saveState();
  await persistWorkspaceMutation("site-lead-delete");
  render();
  showToast("线索已删除", "线索已移除。", "success");
}

async function deletePublishTask(taskId) {
  const task = (state.publishTasks || []).find((item) => item.id === taskId);
  if (!task) return;
  if (!(await uiConfirm(`确认删除发布任务“${task.articleTitle}”？任务记录会从列表移除，平台上的已发布内容不受影响。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/publisher/jobs/${encodeURIComponent(task.id)}`);
  } catch (error) {
    return showToast("发布任务删除失败", error.message || "服务器未能删除该任务。", "error");
  }
  state.publishTasks = (state.publishTasks || []).filter((item) => item.id !== taskId);
  saveState();
  await persistWorkspaceMutation("publisher-task-delete");
  render();
  showToast("发布任务已删除", "任务记录已移除。", "success");
}

async function deleteStudioWorkspace(workspaceId) {
  const workspace = studioWorkspaceById(workspaceId);
  if (!workspace) return;
  const article = studioArticleForWorkspace(workspace);
  if (!(await uiConfirm(article ? `确认删除此创作会话？会话内 AI 对话记录将清除，文章“${article.title}”不会被删除。` : "确认删除此创作会话？会话内 AI 对话记录将清除。"))) return;
  state.writingWorkspaces = (state.writingWorkspaces || []).filter((item) => item.id !== workspaceId);
  state.aiConversations = (state.aiConversations || []).filter((item) => item.workspaceId !== workspaceId);
  if (article) { article.workspaceId = null; }
  ui.studioWorkspaceId = null;
  ui.studioArticleId = null;
  saveState();
  await persistWorkspaceMutation("studio-workspace-delete");
  render();
  showToast("创作会话已删除", article ? "文章仍保留在列表中，可重新打开创作。" : "会话已清除。", "success");
}

async function deleteKnowledgeImage(assetId) {
  const asset = (knowledgeAssetRuntime.items || []).find((item) => item.id === assetId);
  if (!asset) return;
  if (!(await uiConfirm(`确认删除图片素材“${asset.sourceName || "未命名图片"}”？已插入文章中的图片引用不受影响，但素材库将移除该图片。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/v1/knowledge/assets/${encodeURIComponent(assetId)}`);
  } catch (error) {
    return showToast("图片素材删除失败", error.message || "服务器未能归档该素材。", "error");
  }
  knowledgeAssetRuntime.items = (knowledgeAssetRuntime.items || []).filter((item) => item.id !== assetId);
  saveState();
  await persistWorkspaceMutation("knowledge-asset-delete");
  render();
  showToast("图片素材已删除", "图片已从素材库移除。", "success");
}

async function deleteAccountGroup(groupId) {
  const group = state.accountGroups.find((item) => item.id === groupId);
  if (!group) return;
  if (!(await uiConfirm(`确认解绑账号组“${group.name}”？本地发布器中的账号与配置不会被删除，但后台将移除该组的展示与发布入口。`))) return;
  try {
    await deleteRemoteIfPresent(`/api/publisher/account-groups/${encodeURIComponent(groupId)}`);
  } catch (error) {
    return showToast("账号组解绑失败", error.message || "服务器未能移除该账号组。", "error");
  }
  state.accountGroups = state.accountGroups.filter((item) => item.id !== groupId);
  saveState();
  await persistWorkspaceMutation("account-group-delete");
  render();
  showToast("账号组已解绑", "该账号组已从后台移除。", "success");
}

function openArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return showToast("文章不存在", "请刷新页面后重试。", "error");
  ui.modal = { type: "article", articleId };
  renderModal();
}

function articleCitations(article) {
  return (article.citations || []).map((id) => (state.knowledgeCitations || []).find((citation) => citation.id === id)).filter(Boolean);
}

function articleAssetReviewIssues(article) {
  return (article?.assetIds || []).map((id) => (state.contentAssets || []).find((asset) => asset.id === id)).filter((asset) => asset && asset.reviewStatus !== "approved");
}

function articleBusinessLineIsActive(article) {
  const lineId = contentArticleBusinessLineId(article);
  return !lineId || state.businessLines.some((line) => line.id === lineId && line.status === "active");
}

function articleHasKnowledgeUpdates(article) {
  return articleCitations(article).some((citation) => {
    const item = knowledgeItemById(citation.itemId || citation.knowledgeItemId);
    const latest = item && knowledgeVersionById(item.latestVersionId);
    return latest?.reviewStatus === "approved" && item.latestVersionId !== (citation.versionId || citation.knowledgeVersionId);
  });
}

function articleContentForEditor(article, citations) {
  if (!citations.length || article.content.includes("data-citation-id")) return article.content;
  const groups = [[0], [1, 2], [3, 4], [5]];
  let paragraphIndex = 0;
  return article.content.replace(/<\/p>/g, (closing) => {
    const markers = (groups[paragraphIndex] || []).map((index) => citations[index] ? citationMarkerHtml(citations[index]) : "").join("");
    paragraphIndex += 1;
    return markers + closing;
  });
}

function articlePublicCitationMarkersVisible(article) {
  return article?.showPublicCitationMarkers === true;
}

function stripPublicCitationMarkersFromHtml(html = "") {
  return String(html || "")
    .replace(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-(?:citation|evidence)-id\s*=)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\[(?:K|E|REF)\s*\d+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ");
}

function articleContentForPublicPreview(article) {
  return articlePublicCitationMarkersVisible(article) ? String(article?.content || "") : stripPublicCitationMarkersFromHtml(article?.content || "");
}

function renderPublicCitationSetting(value, inputId, disabled = false) {
  const visible = value === true;
  return `<label class="public-citation-setting" for="${escapeHtml(inputId)}"><span><b>对外发布显示知识引用编号</b><small>${visible ? "官网和多平台会显示 [K1]、[K2] 等编号" : "仅后台可见；发布正文不显示 [K1]、[K2]"}</small></span><input type="checkbox" id="${escapeHtml(inputId)}" ${visible ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="对外发布显示知识引用编号" /><i aria-hidden="true"></i></label>`;
}
function renderBatchReviewModal() {
  const ids = selectedArticleIdsForCurrentView();
  const entries = ids.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean).map((article) => ({ article, reason: articleReviewBlockReason(article) }));
  const reviewable = entries.filter((entry) => !entry.reason);
  const blocked = entries.filter((entry) => entry.reason);
  const rows = entries.map(({ article, reason }) => `<div class="batch-review-item ${reason ? "blocked" : "ready"}"><span class="batch-review-state" data-icon="${reason ? "alert" : "check"}"></span><div><b>${escapeHtml(article.title)}</b><small>${escapeHtml(article.id)} · ${reason ? escapeHtml(reason) : "满足审核条件"}</small></div></div>`).join("");
  return modalChrome(`<div class="modal-head"><div><h2 id="modal-title">批量人工审核</h2><p>将对已选择的待审核文章执行人工审核，通过后才允许进入发布流程。</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal-body"><div class="batch-review-summary"><div><span>已选择</span><b>${entries.length}</b><small>篇文章</small></div><div class="ready"><span>可审核通过</span><b>${reviewable.length}</b><small>篇</small></div><div class="blocked"><span>不参与本次</span><b>${blocked.length}</b><small>篇</small></div></div>${blocked.length ? '<div class="privacy-note warning"><span data-icon="alert"></span><span>已审核文章不会重复审核；缺少证据或未通过风控的文章也会被跳过，原状态保持不变。</span></div>' : ""}<div class="batch-review-list">${rows || '<div class="empty-state compact"><div><span data-icon="file"></span><h3>没有可审核文章</h3><p>请返回文章任务列表重新选择。</p></div></div>'}</div></div><div class="modal-foot"><span>审核人：${escapeHtml(currentUserName() || "系统管理员")} · 审核通过后会记录时间和当前文章版本</span><div class="modal-foot-right"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="button" data-action="confirm-batch-review" ${reviewable.length ? "" : "disabled"}><span data-icon="check"></span>确认审核通过${reviewable.length ? `（${reviewable.length}篇）` : ""}</button></div></div>`, { wide: true });
}
