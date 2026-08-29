// Question library, seed expansion, and topic generation helpers.
// Kept as a classic-script module so the existing global action names remain unchanged.

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

async function removeKeywordCandidates(questionIds, options = {}) {
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
  await persistWorkspaceMutation("keyword-candidates-delete");
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
  await persistWorkspaceMutation("keyword-pack-delete");
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
