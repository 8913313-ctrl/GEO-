import { createHash } from "node:crypto";
import { DiagnosticError } from "./diagnostic-store.mjs";

function stableId(prefix, value, ordinal = 0) {
  return `${prefix}-${createHash("sha256").update(`${value}:${ordinal}`, "utf8").digest("hex").slice(0, 18).toUpperCase()}`;
}

function questionText(item) {
  return String(typeof item === "string" ? item : item?.text || item?.question || item?.title || "").trim();
}

function normalizedText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

export class DiagnosticActionService {
  constructor({ diagnosticStore, workspaceStore, contentStore } = {}) {
    if (!diagnosticStore || !workspaceStore || !contentStore) {
      throw new TypeError("DiagnosticActionService requires diagnosticStore, workspaceStore and contentStore.");
    }
    this.diagnosticStore = diagnosticStore;
    this.workspaceStore = workspaceStore;
    this.contentStore = contentStore;
  }

  mutateWorkspace(workspaceId, mutate, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const current = this.workspaceStore.get(workspaceId);
      if (!current.state) {
        throw new DiagnosticError("工作区尚未初始化，不能回流诊断建议。", 409, "DIAGNOSTIC_WORKSPACE_NOT_READY");
      }
      const nextState = structuredClone(current.state);
      const result = mutate(nextState) || {};
      try {
        const saved = this.workspaceStore.save(workspaceId, nextState, {
          expectedRevision: current.revision,
          actor: options.actor,
          request: options.request,
          reason: options.reason || "运营诊断建议回流"
        });
        return { ...result, workspaceRevision: saved.revision };
      } catch (error) {
        lastError = error;
        if (error?.code !== "WORKSPACE_REVISION_CONFLICT" || attempt > 0) throw error;
      }
    }
    throw lastError;
  }

  applyQuestionCandidates({ workspaceId, action, project, actor, request }) {
    const questions = Array.isArray(action.payload?.questions) ? action.payload.questions : [];
    return this.mutateWorkspace(workspaceId, (state) => {
      state.questionLibrary = Array.isArray(state.questionLibrary) ? state.questionLibrary : [];
      const known = new Set(state.questionLibrary.map((item) => normalizedText(item.question)));
      const targetIds = [];
      questions.slice(0, 500).forEach((source, index) => {
        const text = questionText(source);
        if (!text || known.has(normalizedText(text))) return;
        const id = stableId("DQ", action.id, index);
        state.questionLibrary.push({
          id,
          businessLineId: project.businessLineId || null,
          question: text,
          dimension: source?.category || "diagnostic",
          intent: source?.intent || "待确认",
          stage: "运营诊断回流",
          coverage: "未覆盖",
          source: `运营诊断 · ${project.name}`,
          diagnosticProjectId: project.id,
          diagnosticActionId: action.id,
          status: "active",
          selected: false,
          createdAt: Date.now()
        });
        known.add(normalizedText(text));
        targetIds.push(id);
      });
      return { targetIds, createdCount: targetIds.length, skippedCount: Math.max(0, questions.length - targetIds.length) };
    }, { actor, request, reason: `运营诊断问题回流：${action.id}` });
  }

  applyKnowledgeGaps({ workspaceId, action, project, actor, request }) {
    const raw = Array.isArray(action.payload?.checklist) ? action.payload.checklist : [];
    const entries = raw.map(questionText).filter(Boolean);
    return this.mutateWorkspace(workspaceId, (state) => {
      state.knowledgeGaps = Array.isArray(state.knowledgeGaps) ? state.knowledgeGaps : [];
      const known = new Set(state.knowledgeGaps.filter((item) => item.status !== "archived").map((item) => normalizedText(item.label || item.title || item.field)));
      const targetIds = [];
      entries.slice(0, 100).forEach((label, index) => {
        if (known.has(normalizedText(label))) return;
        const id = stableId("DKG", action.id, index);
        state.knowledgeGaps.push({
          id,
          businessLineId: project.businessLineId || null,
          field: `diagnostic_${index + 1}`,
          label,
          title: `补齐${label}`,
          reason: `运营诊断“${project.name}”发现该项尚需企业提供可核验证据。`,
          source: "运营诊断",
          diagnosticProjectId: project.id,
          diagnosticActionId: action.id,
          status: "open",
          severity: "advisory",
          generationPolicy: "omit",
          createdAt: Date.now()
        });
        known.add(normalizedText(label));
        targetIds.push(id);
      });
      return { targetIds, createdCount: targetIds.length, skippedCount: Math.max(0, entries.length - targetIds.length) };
    }, { actor, request, reason: `运营诊断知识缺口回流：${action.id}` });
  }

  applyTopicCandidates({ workspaceId, action, project, actor, request }) {
    const questions = Array.isArray(action.payload?.questions) ? action.payload.questions : [];
    return this.mutateWorkspace(workspaceId, (state) => {
      state.topics = Array.isArray(state.topics) ? state.topics : [];
      const known = new Set(state.topics.map((item) => normalizedText(item.title)));
      const targetIds = [];
      questions.slice(0, 100).forEach((source, index) => {
        const title = questionText(source);
        if (!title || known.has(normalizedText(title))) return;
        const id = stableId("DTOP", action.id, index);
        state.topics.push({
          id,
          businessLineId: project.businessLineId || null,
          keyword: title,
          title,
          dimension: source?.category || "diagnostic",
          intent: source?.intent || "待确认",
          recommendation: 80,
          business: 80,
          coverage: "未覆盖",
          reason: `来自运营诊断“${project.name}”的候选选题`,
          source: "运营诊断",
          diagnosticProjectId: project.id,
          diagnosticActionId: action.id,
          selected: false,
          createdAt: Date.now()
        });
        known.add(normalizedText(title));
        targetIds.push(id);
      });
      return { targetIds, createdCount: targetIds.length, skippedCount: Math.max(0, questions.length - targetIds.length) };
    }, { actor, request, reason: `运营诊断选题回流：${action.id}` });
  }

  applyContentPlan({ workspaceId, action, project, actor, request }) {
    const planId = stableId("DPLAN", action.id);
    let plan;
    try {
      plan = this.contentStore.plan(workspaceId, planId);
    } catch (error) {
      if (error?.status !== 404) throw error;
      plan = this.contentStore.createPlan({
        workspaceId,
        id: planId,
        businessLineId: project.businessLineId || null,
        name: `${project.name}｜诊断执行计划`,
        contentType: "系列文章",
        status: "draft",
        metadata: { source: "operations_diagnostic", projectId: project.id, actionId: action.id },
        actor,
        request
      });
    }
    let questionSet = null;
    try { questionSet = this.diagnosticStore.latestFrozenQuestionSet(workspaceId, project.id); } catch { questionSet = null; }
    const taskIds = [];
    (questionSet?.questions || []).slice(0, 100).forEach((question, index) => {
      const taskId = stableId("DTASK", action.id, index);
      try {
        this.contentStore.task(workspaceId, taskId);
      } catch (error) {
        if (error?.status !== 404) throw error;
        this.contentStore.createTask({
          workspaceId,
          id: taskId,
          planId: plan.id,
          businessLineId: project.businessLineId || null,
          title: questionText(question),
          status: "planned",
          metadata: { source: "operations_diagnostic", projectId: project.id, actionId: action.id, questionId: question.id || null },
          actor,
          request
        });
      }
      taskIds.push(taskId);
    });
    const workspaceResult = this.mutateWorkspace(workspaceId, (state) => {
      state.topics = Array.isArray(state.topics) ? state.topics : [];
      state.contentPlans = Array.isArray(state.contentPlans) ? state.contentPlans : [];
      const topicIds = (questionSet?.questions || []).slice(0, 100).map((question, index) => {
        const topicId = stableId("DPTOP", action.id, index);
        if (!state.topics.some((item) => item.id === topicId)) {
          const title = questionText(question);
          state.topics.push({
            id: topicId,
            businessLineId: project.businessLineId || null,
            keyword: title,
            title,
            dimension: question.category || "diagnostic",
            intent: question.intent || "待确认",
            recommendation: 80,
            business: 80,
            coverage: "未覆盖",
            reason: `来自运营诊断“${project.name}”的内容计划`,
            source: "运营诊断",
            diagnosticProjectId: project.id,
            diagnosticActionId: action.id,
            selected: false,
            createdAt: Date.now()
          });
        }
        return topicId;
      });
      if (!state.contentPlans.some((item) => item.id === plan.id)) {
        state.contentPlans.unshift({
          id: plan.id,
          name: plan.name,
          businessLineId: project.businessLineId || null,
          topicIds,
          scheduledFor: "",
          owner: "待分配",
          contentType: plan.contentType || "系列文章",
          status: "planned",
          articleIds: [],
          source: "运营诊断",
          diagnosticProjectId: project.id,
          diagnosticActionId: action.id,
          createdAt: Date.now()
        });
      }
      return { topicIds };
    }, { actor, request, reason: `运营诊断内容计划回流：${action.id}` });
    return { targetIds: [plan.id], planId: plan.id, taskIds, createdTaskCount: taskIds.length, topicIds: workspaceResult.topicIds, workspaceRevision: workspaceResult.workspaceRevision };
  }

  applyCmsTask({ workspaceId, action, project, actor, request }) {
    return this.mutateWorkspace(workspaceId, (state) => {
      state.siteCmsTasks = Array.isArray(state.siteCmsTasks) ? state.siteCmsTasks : [];
      const id = stableId("CMSD", action.id);
      if (!state.siteCmsTasks.some((item) => item.id === id)) {
        state.siteCmsTasks.unshift({
          id,
          title: `官网信源能力整改｜${project.name}`,
          websiteUrl: action.payload?.websiteUrl || project.websiteUrl || "",
          checks: Array.isArray(action.payload?.checks) ? action.payload.checks : [],
          businessLineId: project.businessLineId || null,
          source: "运营诊断",
          diagnosticProjectId: project.id,
          diagnosticActionId: action.id,
          status: "pending",
          priority: "high",
          createdAt: Date.now()
        });
      }
      return { targetIds: [id], createdCount: 1 };
    }, { actor, request, reason: `运营诊断 CMS 任务回流：${action.id}` });
  }

  applyPublishingStrategy({ workspaceId, action, project, actor, request }) {
    return this.mutateWorkspace(workspaceId, (state) => {
      state.publishSchedules = Array.isArray(state.publishSchedules) ? state.publishSchedules : [];
      const id = stableId("DPUB", action.id);
      if (!state.publishSchedules.some((item) => item.id === id)) {
        state.publishSchedules.unshift({ id, name: `${project.name}｜诊断发布策略`, businessLineId: project.businessLineId || null, source: "运营诊断", diagnosticProjectId: project.id, diagnosticActionId: action.id, status: "draft", rules: action.payload || {}, createdAt: Date.now() });
      }
      return { targetIds: [id], createdCount: 1 };
    }, { actor, request, reason: `运营诊断发布策略回流：${action.id}` });
  }

  executeAccepted({ workspaceId = "default", action, actor = null, request = null } = {}) {
    if (!action?.id) throw new DiagnosticError("缺少待执行的诊断建议。", 422, "DIAGNOSTIC_ACTION_REQUIRED");
    if (action.status !== "accepted") {
      throw new DiagnosticError("诊断建议必须先由用户确认。", 409, "DIAGNOSTIC_ACTION_NOT_ACCEPTED", { actionId: action.id, status: action.status });
    }
    const project = this.diagnosticStore.project(workspaceId, action.projectId);
    let result;
    if (action.actionType === "question_library_candidate") result = this.applyQuestionCandidates({ workspaceId, action, project, actor, request });
    else if (action.actionType === "knowledge_gap") result = this.applyKnowledgeGaps({ workspaceId, action, project, actor, request });
    else if (action.actionType === "topic_candidate") result = this.applyTopicCandidates({ workspaceId, action, project, actor, request });
    else if (action.actionType === "content_plan") result = this.applyContentPlan({ workspaceId, action, project, actor, request });
    else if (action.actionType === "cms_task") result = this.applyCmsTask({ workspaceId, action, project, actor, request });
    else if (action.actionType === "publishing_strategy") result = this.applyPublishingStrategy({ workspaceId, action, project, actor, request });
    else throw new DiagnosticError("不支持的诊断回流类型。", 422, "DIAGNOSTIC_ACTION_TYPE_UNSUPPORTED", { actionType: action.actionType });
    return {
      targetEntityType: action.actionType,
      targetEntityId: result.targetIds?.[0] || "",
      result
    };
  }

  async confirmAndApply({ workspaceId = "default", actionId, actor = null, request = null } = {}) {
    let action = this.diagnosticStore.action(workspaceId, actionId);
    if (action.status === "applied") return action;
    if (!["proposed", "accepted", "failed"].includes(action.status)) {
      throw new DiagnosticError("该建议当前状态不能执行回流。", 409, "DIAGNOSTIC_ACTION_NOT_APPLICABLE", { actionId, status: action.status });
    }
    if (action.status !== "accepted") action = this.diagnosticStore.transitionAction({ workspaceId, actionId, status: "accepted", actor, request });
    try {
      const execution = this.executeAccepted({ workspaceId, action, actor, request });
      return this.diagnosticStore.transitionAction({
        workspaceId,
        actionId,
        status: "applied",
        targetEntityType: execution.targetEntityType,
        targetEntityId: execution.targetEntityId,
        result: execution.result,
        actor,
        request
      });
    } catch (error) {
      try {
        this.diagnosticStore.transitionAction({ workspaceId, actionId, status: "failed", result: { error: error.message, code: error.code || "DIAGNOSTIC_ACTION_APPLY_FAILED" }, actor, request });
      } catch {
        // Preserve the original application error if status recording also fails.
      }
      throw error;
    }
  }
}

export default DiagnosticActionService;
