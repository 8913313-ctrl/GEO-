// Legacy structured knowledge-card compatibility helpers.
// Kept separate from the primary knowledge workspace while preserving globals.

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
