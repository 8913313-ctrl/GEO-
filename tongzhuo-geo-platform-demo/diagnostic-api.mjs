import { DiagnosticError } from "./diagnostic-store.mjs";

function queryOf(request) { return new URL(request.url || "/", "http://localhost").searchParams; }
function decoded(value) { return decodeURIComponent(String(value || "")); }
function bodyObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function createDiagnosticApi({ diagnosticStore, requestJson, configured = {}, actionExecutor = null, enterpriseSnapshotProvider = null, analysisEngine = null, requireAnalysisEngine = false, liveEffectReportEngine = null, relayService = null, adHocDiagnosticService = null, monitoringPlanService = null } = {}) {
  if (!diagnosticStore || typeof diagnosticStore.createProject !== "function") throw new TypeError("createDiagnosticApi requires a DiagnosticStore instance.");
  if (typeof requestJson !== "function") throw new TypeError("createDiagnosticApi requires requestJson.");
  const workspaceId = "default";
  const bodyLimit = Math.max(Number(configured.requestBodyLimit) || 1_000_000, 5_000_000);

  return async function handleDiagnosticApi(request, response, parts, principal = null) {
    const method = request.method || "GET";
    const domain = parts[2] || "";

    if (domain === "research-packages") {
      if (parts.length === 3 && method === "GET") {
        return response.json(200, { ok: true, data: { items: diagnosticStore.listResearchPackages({ workspaceId }), current: diagnosticStore.activeResearchPackage(workspaceId) } });
      }
      if (parts.length === 4 && parts[3] === "current" && method === "GET") {
        return response.json(200, { ok: true, data: { researchPackage: diagnosticStore.activeResearchPackage(workspaceId) } });
      }
      if (parts.length === 4 && method === "GET") {
        return response.json(200, { ok: true, data: { researchPackage: diagnosticStore.researchPackage(workspaceId, decoded(parts[3])) } });
      }
      return response.json(404, { ok: false, code: "RESEARCH_PACKAGE_ROUTE_NOT_FOUND", message: "Research package API route not found." });
    }

    if (domain !== "diagnostics") return response.json(404, { ok: false, code: "DIAGNOSTIC_ROUTE_NOT_FOUND", message: "Diagnostic API route not found." });

    // Brand monitoring is a scheduled series of immutable relay-backed runs.
    // It intentionally lives beside diagnostics rather than the website
    // monitoring API, whose crawler/HTML data has a different evidence scope.
    if (monitoringPlanService && parts[3] === "monitoring" && parts[4] === "analytics" && method === "GET") {
      const query = queryOf(request);
      const planId = query.get("planId") || "";
      if (!planId) throw new DiagnosticError("planId is required.", 422, "BRAND_MONITORING_INVALID_INPUT", { field: "planId" });
      const analytics = monitoringPlanService.analytics(planId, { rangeDays: query.get("range") || 30 });
      return response.json(200, { ok: true, data: { analytics } });
    }
    if (monitoringPlanService && parts[3] === "monitoring-plans") {
      const query = queryOf(request);
      if (parts.length === 4 && method === "GET") {
        return response.json(200, { ok: true, data: {
          items: monitoringPlanService.listPlans({
            projectId: query.get("projectId") || "",
            status: query.get("status") || "",
            limit: query.get("limit") || 100
          })
        } });
      }
      if (parts.length === 4 && method === "POST") {
        const plan = await monitoringPlanService.createPlan(bodyObject(await requestJson(request, bodyLimit)), { actor: principal, request });
        return response.json(201, { ok: true, data: { plan } });
      }
      if (parts.length === 5 && method === "GET") {
        const plan = monitoringPlanService.getPlan(decoded(parts[4]), {
          includeRuns: query.get("includeRuns") === "true",
          runLimit: query.get("runLimit") || 100
        });
        return response.json(200, { ok: true, data: { plan } });
      }
      if (parts.length === 6 && parts[5] === "runs" && method === "GET") {
        return response.json(200, { ok: true, data: { items: monitoringPlanService.listPlanRuns(decoded(parts[4]), { limit: query.get("limit") || 100 }) } });
      }
      if (parts.length === 6 && parts[5] === "pause" && method === "POST") {
        const plan = monitoringPlanService.pausePlan(decoded(parts[4]), { actor: principal, request });
        return response.json(200, { ok: true, data: { plan } });
      }
      if (parts.length === 6 && parts[5] === "resume" && method === "POST") {
        const plan = monitoringPlanService.resumePlan(decoded(parts[4]), bodyObject(await requestJson(request, 100_000)), { actor: principal, request });
        return response.json(200, { ok: true, data: { plan } });
      }
      if (parts.length === 6 && parts[5] === "run" && method === "POST") {
        const planRun = await monitoringPlanService.triggerPlan(decoded(parts[4]), bodyObject(await requestJson(request, 100_000)), { actor: principal, request });
        return response.json(202, { ok: true, data: { planRun } });
      }
      throw new DiagnosticError("Brand-monitoring plan API route not found.", 404, "BRAND_MONITORING_PLAN_ROUTE_NOT_FOUND", { path: parts.join("/") });
    }

    if (relayService && parts[3] === "relay" && parts[4] === "status" && method === "GET") {
      return response.json(200, { ok: true, data: { relay: relayService.status() } });
    }
    if (relayService && parts[3] === "relay" && parts[4] === "capabilities" && method === "GET") {
      return response.json(200, { ok: true, data: { capabilities: await relayService.capabilities() } });
    }
    if (relayService && parts[3] === "relay" && parts[4] === "quota" && method === "GET") {
      return response.json(200, { ok: true, data: { quota: await relayService.quota() } });
    }
    if (relayService && parts[3] === "relay" && parts[4] === "quote" && method === "POST") {
      return response.json(200, { ok: true, data: { quote: await relayService.quote({ ...bodyObject(await requestJson(request, bodyLimit)), actor: principal }) } });
    }
    if (adHocDiagnosticService && parts.length === 5 && parts[3] === "relay" && parts[4] === "ad-hoc-runs" && method === "POST") {
      if (principal?.service?.adHocDiagnostic !== true) {
        throw new DiagnosticError("This endpoint is restricted to the customer-server service API.", 403, "AD_HOC_DIAGNOSTIC_SERVICE_ONLY");
      }
      const body = bodyObject(await requestJson(request, bodyLimit));
      const result = await adHocDiagnosticService.createRun(body, { actor: principal, request });
      return response.json(202, { ok: true, data: result });
    }
    if (relayService && parts[3] === "relay" && parts[4] === "pull" && method === "POST") {
      const body = bodyObject(await requestJson(request, 100_000));
      return response.json(200, { ok: true, data: await relayService.pullDeliveries({ limit: body.limit }) });
    }
    if (relayService && parts.length === 4 && parts[3] === "relay-runs" && method === "GET") {
      // The customer UI needs a tenant-scoped task centre.  Keep the relay
      // link as the lifecycle source of truth, and return only local runs and
      // evidence that have already been persisted in this customer instance.
      const query = queryOf(request);
      const includeEvidence = query.get("includeEvidence") === "true";
      const links = relayService.listLinks({ limit: query.get("limit") || 100 });
      const items = links.map((link) => ({
        link,
        run: diagnosticStore.run(workspaceId, link.diagnosticRunId, {
          includeEvidence,
          includeMetrics: false
        })
      }));
      return response.json(200, { ok: true, data: { items } });
    }
    if (relayService && parts.length === 6 && parts[3] === "projects" && parts[5] === "relay-runs" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: relayService.listLinks({ projectId: decoded(parts[4]), limit: query.get("limit") || 100 }) } });
    }
    if (relayService && parts.length === 6 && parts[3] === "projects" && parts[5] === "relay-runs" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      const result = await relayService.createRun({ ...body, projectId: decoded(parts[4]), actor: principal, request });
      return response.json(202, { ok: true, data: result });
    }
    const relayReportRoute = relayService && method === "POST" && (
      (parts.length === 6 && parts[3] === "relay-runs" && parts[5] === "report") ||
      (parts.length === 8 && parts[3] === "projects" && parts[5] === "relay-runs" && parts[7] === "report")
    );
    if (relayReportRoute) {
      const runId = decoded(parts[3] === "relay-runs" ? parts[4] : parts[6]);
      const projectId = parts[3] === "projects" ? decoded(parts[4]) : "";
      const link = relayService.getLink(runId);
      if (!link) throw new DiagnosticError("Diagnostic relay run not found.", 404, "RELAY_LINK_NOT_FOUND", { runId });
      const relayStatuses = [
        link.status,
        link.remoteRun?.status,
        link.remoteRun?.summary?.status
      ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
      const relayStatus = relayStatuses.find((value) => ["completed", "partial"].includes(value)) || relayStatuses[0] || "";
      if (!link.relayRunId || !["completed", "partial"].includes(relayStatus)) {
        throw new DiagnosticError(
          "A brand diagnostic report can only be generated after the Relay run is completed or partial.",
          409,
          "RELAY_REPORT_RUN_NOT_READY",
          { runId, relayStatus: relayStatus || null }
        );
      }
      const body = bodyObject(await requestJson(request, bodyLimit));
      const wantsFullLiveEffectReport = body.reportMode === "full_live_effect" || body.analysisMode === "live_effect_full";
      let generatedAnalysis = null;
      if (wantsFullLiveEffectReport) {
        if (!liveEffectReportEngine) throw new DiagnosticError("实时效果分析引擎尚未就绪。", 503, "LIVE_EFFECT_REPORT_ENGINE_NOT_READY");
        if (body.externalDataConsent !== true) throw new DiagnosticError("生成分析报告前必须确认将已回传检测数据发送到默认文本模型。", 422, "DIAGNOSTIC_EXTERNAL_MODEL_CONSENT_REQUIRED");
        generatedAnalysis = await liveEffectReportEngine.generate({
          workspaceId,
          projectId,
          runId,
          providerId: body.providerId || "",
          model: body.model || "",
          actor: principal,
          request
        });
      }
      const created = diagnosticStore.createRelayDiagnosticReport({
        workspaceId,
        projectId,
        runId,
        relayRunId: link.relayRunId,
        relayStatus,
        title: body.title || body.reportTitle || "",
        generatedAnalysis: generatedAnalysis?.analysis || null,
        actor: principal,
        request
      });
      return response.json(201, {
        ok: true,
        data: {
          reportId: created.reportId,
          version: created.version,
          summary: created.summary,
          report: created.report
        }
      });
    }
    if (relayService && parts.length === 5 && parts[3] === "relay-runs" && method === "GET") {
      const runId = decoded(parts[4]);
      const link = relayService.getLink(runId);
      if (!link) throw new DiagnosticError("Diagnostic relay run not found.", 404, "RELAY_LINK_NOT_FOUND", { runId });
      return response.json(200, { ok: true, data: { link, run: diagnosticStore.run(workspaceId, runId, { includeEvidence: true, includeMetrics: true }) } });
    }
    if (relayService && parts.length === 6 && parts[3] === "relay-runs" && parts[5] === "pull" && method === "POST") {
      const body = bodyObject(await requestJson(request, 100_000));
      return response.json(200, { ok: true, data: await relayService.pullRun(decoded(parts[4]), { limit: body.limit }) });
    }
    if (relayService && parts.length === 6 && parts[3] === "relay-runs" && parts[5] === "cancel" && method === "POST") {
      return response.json(200, { ok: true, data: await relayService.cancelRun(decoded(parts[4])) });
    }

    if (parts.length === 3 && method === "GET") return response.json(200, { ok: true, data: { overview: diagnosticStore.overview(workspaceId) } });
    if (parts.length === 4 && parts[3] === "overview" && method === "GET") return response.json(200, { ok: true, data: { overview: diagnosticStore.overview(workspaceId) } });

    if (parts.length === 4 && parts[3] === "projects" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listProjects({ workspaceId, status: query.get("status") || "", diagnosticType: query.get("diagnosticType") || "", businessLineId: query.get("businessLineId") || "", includeArchived: query.get("includeArchived") === "true", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 4 && parts[3] === "projects" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      const project = diagnosticStore.createProject({ workspaceId, ...body, actor: principal, request });
      const snapshot = Array.isArray(body.questionSetSnapshot) ? { questions: body.questionSetSnapshot } : bodyObject(body.questionSetSnapshot);
      let questionSet = null;
      if (Array.isArray(snapshot.questions) && snapshot.questions.length) {
        questionSet = diagnosticStore.createQuestionSet({ workspaceId, projectId: project.id, name: snapshot.name || "项目初始问题集", questions: snapshot.questions, actor: principal, request });
        questionSet = diagnosticStore.freezeQuestionSet({ workspaceId, questionSetId: questionSet.id, actor: principal, request });
      }
      return response.json(201, { ok: true, data: { project: diagnosticStore.project(workspaceId, project.id), questionSet } });
    }
    if (parts.length === 5 && parts[3] === "projects" && method === "GET") {
      const projectId = decoded(parts[4]);
      return response.json(200, { ok: true, data: { project: diagnosticStore.project(workspaceId, projectId), questionSets: diagnosticStore.listQuestionSets({ workspaceId, projectId }), runs: diagnosticStore.listRuns({ workspaceId, projectId }), reports: diagnosticStore.listReports({ workspaceId, projectId }), actions: diagnosticStore.listActions({ workspaceId, projectId }) } });
    }
    if (parts.length === 5 && parts[3] === "projects" && method === "PATCH") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      const project = diagnosticStore.updateProject({ workspaceId, projectId: decoded(parts[4]), expectedRevision: body.expectedRevision, patch: body.patch || body, actor: principal, request });
      return response.json(200, { ok: true, data: { project } });
    }

    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "question-sets" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listQuestionSets({ workspaceId, projectId: decoded(parts[4]), limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "question-sets" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      let questionSet = diagnosticStore.createQuestionSet({ workspaceId, projectId: decoded(parts[4]), ...body, actor: principal, request });
      if (body.freeze === true) questionSet = diagnosticStore.freezeQuestionSet({ workspaceId, questionSetId: questionSet.id, actor: principal, request });
      return response.json(201, { ok: true, data: { questionSet } });
    }
    if (parts.length === 6 && parts[3] === "question-sets" && parts[5] === "freeze" && method === "POST") {
      return response.json(200, { ok: true, data: { questionSet: diagnosticStore.freezeQuestionSet({ workspaceId, questionSetId: decoded(parts[4]), actor: principal, request }) } });
    }

    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "runs" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listRuns({ workspaceId, projectId: decoded(parts[4]), status: query.get("status") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "runs" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      const run = diagnosticStore.createRun({ workspaceId, projectId: decoded(parts[4]), ...body, actor: principal, request });
      return response.json(201, { ok: true, data: { run } });
    }
    if (parts.length === 5 && parts[3] === "runs" && method === "GET") {
      return response.json(200, { ok: true, data: { run: diagnosticStore.run(workspaceId, decoded(parts[4]), { includeEvidence: true, includeMetrics: true }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "start" && method === "POST") {
      return response.json(200, { ok: true, data: { run: diagnosticStore.startRun({ workspaceId, runId: decoded(parts[4]), actor: principal, request }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "complete" && method === "POST") {
      return response.json(200, { ok: true, data: { run: diagnosticStore.completeRun({ workspaceId, runId: decoded(parts[4]), actor: principal, request }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "fail" && method === "POST") {
      const body = bodyObject(await requestJson(request, 100_000));
      return response.json(200, { ok: true, data: { run: diagnosticStore.failRun({ workspaceId, runId: decoded(parts[4]), ...body, actor: principal, request }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "evidence" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listEvidence({ workspaceId, runId: decoded(parts[4]), evidenceType: query.get("evidenceType") || "", limit: query.get("limit") || 500 }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "evidence" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(201, { ok: true, data: { evidence: diagnosticStore.addEvidence({ workspaceId, runId: decoded(parts[4]), ...body, actor: principal, request }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "metrics" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listMetrics({ workspaceId, runId: decoded(parts[4]), evidenceType: query.get("evidenceType") || "", dimension: query.get("dimension") || "", limit: query.get("limit") || 500 }) } });
    }
    if (parts.length === 6 && parts[3] === "runs" && parts[5] === "metrics" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(201, { ok: true, data: { metric: diagnosticStore.addMetric({ workspaceId, runId: decoded(parts[4]), ...body, actor: principal, request }) } });
    }

    if (parts.length === 4 && parts[3] === "reports" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listReports({ workspaceId, projectId: query.get("projectId") || "", runId: query.get("runId") || "", status: query.get("status") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "reports" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listReports({ workspaceId, projectId: decoded(parts[4]), status: query.get("status") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "reports" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      const projectId = decoded(parts[4]);
      const researchOnly = body.researchOnly === true || body.analysisMode === "citation_lab_research";
      const enterpriseSnapshot = !researchOnly && typeof enterpriseSnapshotProvider === "function"
        ? await enterpriseSnapshotProvider({ workspaceId, projectId, principal, request })
        : researchOnly ? null : body.enterpriseSnapshot || null;
      if (requireAnalysisEngine && (!analysisEngine || typeof analysisEngine.analyze !== "function")) {
        throw new DiagnosticError("Citation Lab 研究库或真实分析引擎尚未就绪，未生成模板替代报告。", 503, "DIAGNOSTIC_ANALYSIS_ENGINE_NOT_READY");
      }
      if (analysisEngine && typeof analysisEngine.analyze === "function") {
        if (!String(body.providerId || "").trim()) {
          throw new DiagnosticError("请先在系统设置中配置并选择文本大模型。", 422, "DIAGNOSTIC_MODEL_PROVIDER_REQUIRED");
        }
        if (body.externalDataConsent !== true) {
          throw new DiagnosticError("使用外部大模型分析前，必须由当前用户确认本次问题、研究摘要、企业知识片段和运营快照的发送范围。", 422, "DIAGNOSTIC_EXTERNAL_MODEL_CONSENT_REQUIRED");
        }
        const analyzed = await analysisEngine.analyze({
          workspaceId,
          projectId,
          questionSetId: body.questionSetId || null,
          researchPackageId: body.researchPackageId || null,
          providerId: body.providerId,
          model: body.model || "",
          embeddingProviderId: body.embeddingProviderId || "",
          businessLineId: body.businessLineId || "",
          libraryIds: Array.isArray(body.libraryIds) ? body.libraryIds : [],
          includeInternalKnowledge: body.includeInternalKnowledge === true,
          citationTopK: body.citationTopK,
          citationMatchLimit: body.citationMatchLimit,
          citationMinimumScore: body.citationMinimumScore,
          knowledgeTopK: body.knowledgeTopK,
          minKnowledgeScore: body.minKnowledgeScore,
          enterpriseSnapshot,
          researchOnly,
          persistReport: true,
          reportStatus: "final",
          reportTitle: body.report?.title || body.title || "",
          input: {
            reportType: body.report?.reportType || body.reportType || "",
            analysisMode: researchOnly ? "citation_lab_research" : "combined_evidence",
            externalDataConsent: true,
            externalDataConsentAt: body.externalDataConsentAt || new Date().toISOString(),
            externalDataConsentMethod: body.externalDataConsentMethod || "authenticated_api_request",
            externalModelProviderId: body.providerId
          },
          actor: principal,
          request
        });
        const reportId = analyzed.persistedReport?.id;
        const report = reportId
          ? diagnosticStore.report(workspaceId, reportId, { includeRecommendations: true, includeEvidence: true, includeMetrics: true, includeRun: true })
          : analyzed.persistedReport;
        return response.json(201, { ok: true, data: {
          project: analyzed.project,
          questionSet: analyzed.questionSet,
          run: analyzed.run,
          report,
          recommendations: analyzed.persistedRecommendations || [],
          actions: analyzed.actions || [],
          modelRun: analyzed.modelRun || null
        } });
      }
      const created = diagnosticStore.createPhaseOneReport({ workspaceId, projectId, questionSetSnapshot: body.questionSetSnapshot || null, enterpriseSnapshot, report: body.report || body, recommendations: body.recommendations || null, actor: principal, request });
      return response.json(201, { ok: true, data: created });
    }
    if (parts.length === 5 && parts[3] === "reports" && method === "GET") {
      return response.json(200, { ok: true, data: { report: diagnosticStore.report(workspaceId, decoded(parts[4]), { includeRecommendations: true, includeEvidence: true, includeMetrics: true, includeRun: true }) } });
    }
    if (parts.length === 6 && parts[3] === "reports" && parts[5] === "recommendations" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listRecommendations({ workspaceId, reportId: decoded(parts[4]), status: query.get("status") || "", limit: query.get("limit") || 500 }) } });
    }
    if (parts.length === 6 && parts[3] === "reports" && parts[5] === "recommendations" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(201, { ok: true, data: { recommendation: diagnosticStore.createRecommendation({ workspaceId, reportId: decoded(parts[4]), ...body, actor: principal, request }) } });
    }

    if (parts.length === 4 && parts[3] === "actions" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listActions({ workspaceId, projectId: query.get("projectId") || "", status: query.get("status") || "", limit: query.get("limit") || 500 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "actions" && method === "GET") {
      const query = queryOf(request);
      return response.json(200, { ok: true, data: { items: diagnosticStore.listActions({ workspaceId, projectId: decoded(parts[4]), status: query.get("status") || "", limit: query.get("limit") || 500 }) } });
    }
    if (parts.length === 6 && parts[3] === "projects" && parts[5] === "actions" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(201, { ok: true, data: { action: diagnosticStore.createAction({ workspaceId, projectId: decoded(parts[4]), ...body, actor: principal, request }) } });
    }
    if (parts.length === 5 && parts[3] === "actions" && method === "GET") {
      return response.json(200, { ok: true, data: { action: diagnosticStore.action(workspaceId, decoded(parts[4])) } });
    }
    if (parts.length === 6 && parts[3] === "actions" && parts[5] === "confirm" && method === "POST") {
      const actionId = decoded(parts[4]);
      let action = diagnosticStore.action(workspaceId, actionId);
      if (action.status === "proposed") action = diagnosticStore.transitionAction({ workspaceId, actionId, status: "accepted", actor: principal, request });
      if (typeof actionExecutor === "function" && action.status === "accepted") {
        const execution = bodyObject(await actionExecutor(action, { principal, request, diagnosticStore }));
        action = diagnosticStore.transitionAction({ workspaceId, actionId, status: "applied", targetEntityType: execution.targetEntityType || "", targetEntityId: execution.targetEntityId || "", result: execution.result || execution, actor: principal, request });
        return response.json(200, { ok: true, data: { action, execution: { state: "applied", ...execution } } });
      }
      return response.json(200, { ok: true, data: { action, execution: { state: "accepted", message: "The action is confirmed and waiting for the target business module to execute it." } } });
    }
    if (parts.length === 6 && parts[3] === "actions" && parts[5] === "transition" && method === "POST") {
      const body = bodyObject(await requestJson(request, 500_000));
      const action = diagnosticStore.transitionAction({ workspaceId, actionId: decoded(parts[4]), ...body, actor: principal, request });
      return response.json(200, { ok: true, data: { action } });
    }

    throw new DiagnosticError("Diagnostic API route not found.", 404, "DIAGNOSTIC_ROUTE_NOT_FOUND", { path: parts.join("/") });
  };
}

export default createDiagnosticApi;
