import { AnalysisWorkbenchError, ANALYSIS_WORKBENCH_OPTIONS } from "./analysis-workbench-store.mjs";
import { ANALYSIS_TOOL_REGISTRY } from "./analysis-workbench-engine.mjs";

function bodyObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function decoded(value) { return decodeURIComponent(String(value || "")); }
function queryOf(request) { return new URL(request.url || "/", "http://localhost").searchParams; }

export function createAnalysisWorkbenchApi({ store, engine, requestJson, configured = {}, onBackgroundError = null } = {}) {
  if (!store || typeof store.createSession !== "function") throw new TypeError("createAnalysisWorkbenchApi requires an AnalysisWorkbenchStore.");
  if (typeof requestJson !== "function") throw new TypeError("createAnalysisWorkbenchApi requires requestJson.");
  const workspaceId = "default";
  const bodyLimit = Math.max(Number(configured.requestBodyLimit) || 1_000_000, 5_000_000);

  async function launch(runId, actor, request, waitForCompletion = false) {
    if (!engine || typeof engine.execute !== "function") throw new AnalysisWorkbenchError("AI 分析工作台引擎尚未就绪。", 503, "ANALYSIS_ENGINE_NOT_READY");
    const task = engine.execute(runId, actor, request);
    if (waitForCompletion) return task;
    task.catch((error) => { if (typeof onBackgroundError === "function") onBackgroundError(error, { runId }); });
    return null;
  }

  async function createAndLaunch(body, principal, request, existingSessionId = null) {
    const prompt = String(body.prompt || body.content || body.message || "").trim();
    if (!prompt) throw new AnalysisWorkbenchError("请输入要分析的需求。", 422, "ANALYSIS_INPUT_REQUIRED");
    if (!String(body.providerId || "").trim()) throw new AnalysisWorkbenchError("请选择已配置的大模型。", 422, "ANALYSIS_MODEL_REQUIRED");
    if (body.externalDataConsent !== true) throw new AnalysisWorkbenchError("开始分析前，请确认允许将分析需求和已勾选数据摘要发送给所选大模型。", 422, "ANALYSIS_EXTERNAL_MODEL_CONSENT_REQUIRED");
    const session = existingSessionId
      ? store.updateSession(workspaceId, existingSessionId, body, principal, request)
      : store.createSession({ ...body, title: body.title || prompt.slice(0, 80) }, principal, request, workspaceId);
    const message = store.addMessage(session.id, "user", prompt, {
      dataSources: body.dataSources || session.dataSources,
      platforms: body.platforms || session.platforms,
      reportDepth: body.reportDepth || session.reportDepth,
      externalDataConsent: true,
      externalDataConsentAt: body.externalDataConsentAt || new Date().toISOString(),
      externalDataConsentMethod: body.externalDataConsentMethod || "analysis_workbench_action"
    }, principal, request);
    const run = store.createRun(session.id, message.id, {
      prompt,
      providerId: body.providerId,
      model: body.model || "",
      dataSources: body.dataSources || session.dataSources,
      platforms: body.platforms || session.platforms,
      reportDepth: body.reportDepth || session.reportDepth,
      outputFormat: body.outputFormat || session.outputFormat,
      industry: body.industry || "",
      businessLineId: body.businessLineId || "",
      embeddingProviderId: body.embeddingProviderId || "",
      researchIntent: body.researchIntent || null,
      externalDataConsent: true,
      externalDataConsentAt: body.externalDataConsentAt || new Date().toISOString(),
      externalDataConsentMethod: body.externalDataConsentMethod || "analysis_workbench_action"
    }, principal, request);
    const completed = await launch(run.id, principal, request, body.waitForCompletion === true);
    if (completed) return completed;
    return { session: store.session(workspaceId, session.id), run: store.run(run.id, { includeTools: true }) };
  }

  return async function handleAnalysisWorkbenchApi(request, response, parts, principal = null) {
    const method = request.method || "GET";
    const domain = parts[2] || "";

    if (domain === "analysis-runs" && parts.length === 4 && method === "GET") {
      const run = store.run(decoded(parts[3]), { includeTools: true });
      store.session(workspaceId, run.sessionId, { includeDetails: false });
      return response.json(200, { ok: true, data: { run } });
    }
    if (domain === "analysis-plans" && parts.length === 3 && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      if (!String(body.prompt || body.content || body.message || "").trim()) throw new AnalysisWorkbenchError("请输入要分析的需求。", 422, "ANALYSIS_INPUT_REQUIRED");
      if (!String(body.providerId || "").trim()) throw new AnalysisWorkbenchError("请选择已配置的大模型。", 422, "ANALYSIS_MODEL_REQUIRED");
      if (body.externalDataConsent !== true) throw new AnalysisWorkbenchError("生成研究计划前，请确认允许将本次分析要求发送给所选大模型。", 422, "ANALYSIS_EXTERNAL_MODEL_CONSENT_REQUIRED");
      if (!engine || typeof engine.preview !== "function") throw new AnalysisWorkbenchError("AI 研究计划服务尚未就绪。", 503, "ANALYSIS_ENGINE_NOT_READY");
      const result = await engine.preview({ ...body, prompt: body.prompt || body.content || body.message, workspaceId });
      return response.json(200, { ok: true, data: result });
    }
    if (domain !== "analysis-sessions") return response.json(404, { ok: false, code: "ANALYSIS_ROUTE_NOT_FOUND", message: "AI 分析工作台接口不存在。" });

    if (parts.length === 4 && parts[3] === "options" && method === "GET") {
      return response.json(200, { ok: true, data: { ...ANALYSIS_WORKBENCH_OPTIONS, tools: Object.values(ANALYSIS_TOOL_REGISTRY) } });
    }
    if (parts.length === 3 && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: store.listSessions({ workspaceId, status: query.get("status") || "active", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 3 && method === "POST") {
      const result = await createAndLaunch(bodyObject(await requestJson(request, bodyLimit)), principal, request);
      return response.json(result.artifact ? 201 : 202, { ok: true, data: result });
    }
    if (parts.length === 4 && method === "GET") {
      return response.json(200, { ok: true, data: { session: store.session(workspaceId, decoded(parts[3])) } });
    }
    if (parts.length === 4 && method === "PATCH") {
      const session = store.updateSession(workspaceId, decoded(parts[3]), bodyObject(await requestJson(request, bodyLimit)), principal, request);
      return response.json(200, { ok: true, data: { session } });
    }
    if (parts.length === 4 && method === "DELETE") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      if (body.confirm !== true) throw new AnalysisWorkbenchError("删除报告前需要明确确认。", 422, "ANALYSIS_DELETE_CONFIRMATION_REQUIRED");
      const deleted = store.deleteSession(workspaceId, decoded(parts[3]), principal, request);
      return response.json(200, { ok: true, data: deleted });
    }
    if (parts.length === 5 && parts[4] === "messages" && method === "POST") {
      const result = await createAndLaunch(bodyObject(await requestJson(request, bodyLimit)), principal, request, decoded(parts[3]));
      return response.json(result.artifact ? 201 : 202, { ok: true, data: result });
    }
    return response.json(404, { ok: false, code: "ANALYSIS_ROUTE_NOT_FOUND", message: "AI 分析工作台接口不存在。" });
  };
}

export default createAnalysisWorkbenchApi;
