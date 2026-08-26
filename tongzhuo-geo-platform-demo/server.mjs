import http from "node:http";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publisherStore, PublisherError } from "./publisher-store.mjs";
import { aiProviderStore, AiProviderError } from "./ai-provider-store.mjs";
import { aiGenerationService, AiGenerationError } from "./ai-generation-service.mjs";
import { KnowledgeError, KnowledgeStore } from "./knowledge-store.mjs";
import { ContentError, ContentStateError, ContentStore } from "./content-store.mjs";
import { applyPublicCitationVisibility, publicCitationMarkersVisible } from "./citation-visibility.mjs";
import { createContentApi } from "./content-api.mjs";
import { ContentAssetError, ContentAssetStore } from "./content-asset-store.mjs";
import { createContentAssetApi } from "./content-asset-api.mjs";
import { MonitoringError, MonitoringStore, monitoringDateDaysBefore, monitoringReportingDate } from "./monitoring-store.mjs";
import { createMonitoringSuggestionGenerator } from "./monitoring-suggestion-generator.mjs";
import { DiagnosticError, DiagnosticStore } from "./diagnostic-store.mjs";
import { createDiagnosticApi } from "./diagnostic-api.mjs";
import { createDiagnosticRelayClient } from "./diagnostic-relay-client.mjs";
import { DiagnosticRelayService } from "./diagnostic-relay-service.mjs";
import { DiagnosticRelayConfigError, DiagnosticRelayConfigStore } from "./diagnostic-relay-config-store.mjs";
import { BrandMonitoringService } from "./diagnostic-monitoring-service.mjs";
import { AdHocDiagnosticService } from "./diagnostic-ad-hoc-service.mjs";
import { requireAdHocDiagnosticServiceApi } from "./diagnostic-ad-hoc-auth.mjs";
import { DiagnosticActionService } from "./diagnostic-action-service.mjs";
import { CitationResearchStore } from "./citation-research-store.mjs";
import { ResearchDocumentStore } from "./research-document-store.mjs";
import { CitationPackageUpdateError, CitationPackageUpdateStore, resolveActiveCitationResearchPackage } from "./citation-package-update-store.mjs";
import { createCitationPackageUpdateApi } from "./citation-package-update-api.mjs";
import { CitationDocumentUpdateError, CitationDocumentUpdateStore, resolveActiveCitationResearchDocuments } from "./citation-document-update-store.mjs";
import { createCitationDocumentUpdateApi } from "./citation-document-update-api.mjs";
import { DiagnosticAnalysisEngine, DiagnosticAnalysisError } from "./diagnostic-analysis-engine.mjs";
import { LiveEffectReportEngine } from "./live-effect-report-engine.mjs";
import { AnalysisWorkbenchError, AnalysisWorkbenchStore } from "./analysis-workbench-store.mjs";
import { AnalysisWorkbenchEngine } from "./analysis-workbench-engine.mjs";
import { createAnalysisWorkbenchApi } from "./analysis-workbench-api.mjs";
import { SiteCmsError, SiteCmsStore } from "./site-cms-store.mjs";
import { PublicSiteStore } from "./public-site/site-store.mjs";
import { renderFixedPage, renderNotFound } from "./public-site/site-renderer.mjs";
import { createSiteRuntime } from "./site-server.mjs";
import { assertProductionConfiguration, productionConfig } from "./production-config.mjs";
import { productionLogger } from "./production-logger.mjs";
import { requestMetadata } from "./production-audit.mjs";
import { AuthError, AuthService, openProductionDatabase, PERMISSIONS, WorkspaceConflictError, WorkspaceStore } from "./production-foundation.mjs";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(moduleRoot, "public");
const siteAssetRoot = path.join(moduleRoot, "public-site", "assets");
const configured = assertProductionConfiguration(productionConfig);
const port = Number(process.argv[2] || configured.port);
const database = openProductionDatabase({ databasePath: configured.databasePath });
const authService = new AuthService(database, {
  sessionTtlSeconds: configured.sessionHours * 60 * 60,
  secureCookies: configured.cookieSecure,
  trustProxy: configured.trustProxy
});
const workspaceStore = new WorkspaceStore(database, { trustProxy: configured.trustProxy });
const knowledgeStore = new KnowledgeStore(database);
const contentStore = new ContentStore(database, {
  workspaceId: "default",
  requireEvidence: true,
  evidenceValidator: (evidence, context = {}) => {
    const result = knowledgeStore.validateEvidenceReferences({ workspaceId: context.workspaceId || "default", evidence, allowInternal: false });
    if (evidence?.length && !result.items.some((item) => item.referenceType === "knowledge")) {
      throw new KnowledgeError("At least one traceable enterprise knowledge citation is required.", 422, "KNOWLEDGE_EVIDENCE_REQUIRED");
    }
    return result;
  }
});
const contentAssetStore = new ContentAssetStore(database, { workspaceId: "default" });
publisherStore.setWebPublisher((target) => contentStore.publish({
  workspaceId: "default",
  articleId: target.articleId,
  versionId: target.versionId,
  expectedRevision: target.expectedRevision,
  category: target.category,
  metadata: target.metadata,
  actor: target.actor,
  request: target.requestMetadata ? {
    headers: { "user-agent": target.requestMetadata.userAgent || "" },
    socket: { remoteAddress: target.requestMetadata.ipAddress || "" }
  } : null
}));
const contentApi = createContentApi({
  contentStore, requestJson, configured,
  onArticlePublished: async ({ principal, request }) => {
    const draft = siteCmsStore.draft("default");
    const publication = siteCmsStore.publication("default");
    const draftInsights = Array.isArray(draft.snapshot?.pages) ? draft.snapshot.pages.find((page) => page?.id === "insights") : null;
    const publishedInsights = Array.isArray(publication.snapshot?.pages) ? publication.snapshot.pages.find((page) => page?.id === "insights") : null;
    if (publishedInsights?.status === "published" || draftInsights?.status !== "published") return { status: "already-synced", cmsVersion: publication.version };
    const released = siteCmsStore.publish({ expectedDraftRevision: draft.revision, note: "文章发布后自动同步官网行业资讯" }, principal, request, "default");
    return { status: "published", cmsVersion: released.version, releaseId: released.releaseId };
  }
});
const contentAssetApi = createContentAssetApi({ contentAssetStore, requestJson, configured });
publisherStore.setPublicationObserver((job) => contentAssetStore.syncPublisherJob(job, { workspaceId: "default" }));
const diagnosticStore = new DiagnosticStore(database, { workspaceId: "default" });
const diagnosticRelayConfigStore = new DiagnosticRelayConfigStore({ dataDir: configured.dataDir });
try {
  await diagnosticRelayConfigStore.load();
} catch (error) {
  productionLogger.error("diagnostic_relay.ui_configuration_load_failed", { code: error.code || "DIAGNOSTIC_RELAY_CONFIG_LOAD_FAILED", error: error.message });
}
const relayEnvironmentConfigured = [configured.relayBaseUrl, configured.relayInstanceId, configured.relayClientId, configured.relayClientSecret].every(Boolean);
function activeDiagnosticRelayConfig() {
  if (relayEnvironmentConfigured) return configured;
  return diagnosticRelayConfigStore.runtimeConfig();
}
let diagnosticRelayClient = null;
try {
  diagnosticRelayClient = createDiagnosticRelayClient({ config: activeDiagnosticRelayConfig() });
} catch (error) {
  productionLogger.error("diagnostic_relay.configuration_failed", { code: error.code || "RELAY_CLIENT_CONFIGURATION", error: error.message });
}
const diagnosticRelayService = new DiagnosticRelayService({
  database,
  diagnosticStore,
  contentAssetStore,
  client: diagnosticRelayClient,
  workspaceId: "default",
  pullBatchSize: configured.relayPullBatchSize
});
function reloadDiagnosticRelayClient() {
  try {
    diagnosticRelayClient = createDiagnosticRelayClient({ config: activeDiagnosticRelayConfig() });
    diagnosticRelayService.setClient(diagnosticRelayClient);
    return { ok: true, status: diagnosticRelayService.status() };
  } catch (error) {
    diagnosticRelayClient = null;
    diagnosticRelayService.setClient(null);
    return { ok: false, code: error.code || "RELAY_CLIENT_CONFIGURATION", message: error.message || "中转服务配置无效。" };
  }
}
try {
  const backfill = contentAssetStore.syncEvidence({ workspaceId: "default", limit: 20_000 });
  if (backfill.created) productionLogger.info("content_asset.citation_backfill_completed", backfill);
} catch (error) {
  productionLogger.error("content_asset.citation_backfill_failed", { code: error.code || "CONTENT_ASSET_CITATION_BACKFILL_FAILED", error: error.message });
}
const brandMonitoringService = new BrandMonitoringService({
  database,
  diagnosticStore,
  relayService: diagnosticRelayService,
  workspaceId: "default",
  trustProxy: configured.trustProxy,
  schedulerBatchSize: configured.brandMonitoringSchedulerBatchSize
});
const adHocDiagnosticService = new AdHocDiagnosticService({
  database,
  diagnosticStore,
  relayService: diagnosticRelayService,
  workspaceId: "default",
  trustProxy: configured.trustProxy
});
const diagnosticActionService = new DiagnosticActionService({ diagnosticStore, workspaceStore, contentStore });
const citationPackageUpdateStore = new CitationPackageUpdateStore();
const citationDocumentUpdateStore = new CitationDocumentUpdateStore();
const citationPackageResolution = resolveActiveCitationResearchPackage();
let citationResearchStore = null;
let researchDocumentStore = null;
let diagnosticAnalysisEngine = null;
let liveEffectReportEngine = null;
try {
  citationResearchStore = new CitationResearchStore(citationPackageResolution.active ? {
    databasePath: citationPackageResolution.active.databasePath,
    expectedDatasetVersion: citationPackageResolution.active.version,
    expectedSourceCommit: citationPackageResolution.active.sourceCommit
  } : {});
  const researchHealth = citationResearchStore.health();
  const pin = citationResearchStore.summary().package;
  diagnosticStore.updateResearchPackageInstallation({
    workspaceId: "default",
    installState: "ready",
    verificationStatus: "verified",
    sourceCommit: researchHealth.sourceCommit,
    checksumSha256: pin.upstreamParquetSha256,
    limitations: [
      "The package is a fixed historical research baseline, not a live AI-platform monitoring feed.",
      "Complete answer text, reliable response identifiers, model versions and uniform collection timestamps are unavailable.",
      "responses.parquet is empty; current brand ranking, recommendation rate, sentiment and strict citation position cannot be derived from this package alone.",
      "Question matching is lexical and taxonomy-assisted. Low-confidence matches are treated as evidence gaps rather than forced conclusions."
    ],
    coverage: {
      ...diagnosticStore.activeResearchPackage("default").coverage,
      rawDataBundled: true,
      queryDatabaseReady: true,
      derivedDatabaseBytes: researchHealth.databaseBytes,
      preferredCitationObservationCount: researchHealth.counts.preferredCitationObservations,
      supportsCurrentBrandRanking: false,
      supportsRealtimeCitationMonitoring: false
    },
    manifest: {
      ...diagnosticStore.activeResearchPackage("default").manifest,
      deploymentMode: "verified_read_only_sqlite",
      sourceCommit: researchHealth.sourceCommit,
      upstreamDuckdbSha256: pin.upstreamDuckdbSha256,
      upstreamParquetSha256: pin.upstreamParquetSha256
    }
  });
  diagnosticAnalysisEngine = new DiagnosticAnalysisEngine({
    diagnosticStore,
    citationResearchStore,
    knowledgeStore,
    aiGenerationService
  });
} catch (error) {
  productionLogger.error("citation_research.not_ready", { error: error.message, code: error.code || "CITATION_RESEARCH_INIT_FAILED" });
  try { diagnosticStore.updateResearchPackageInstallation({ workspaceId: "default", installState: "failed", verificationStatus: "unverified" }); } catch { /* health remains visible through server logs */ }
}
try {
  liveEffectReportEngine = new LiveEffectReportEngine({ diagnosticStore, aiGenerationService });
} catch (error) {
  productionLogger.error("diagnostic.live_effect_report_not_ready", { error: error.message, code: error.code || "LIVE_EFFECT_REPORT_INIT_FAILED" });
}
function createActiveResearchDocumentStore() {
  if (!citationPackageResolution.active) return new ResearchDocumentStore();
  const documentResolution = resolveActiveCitationResearchDocuments({
    packageRoot: citationPackageResolution.packageRoot,
    legacyCommit: citationPackageResolution.active.sourceCommit,
    legacyDocumentRoot: process.env.TZ_CITATION_RESEARCH_REPOSITORY_MIRROR || ""
  });
  const activeDocuments = documentResolution.active;
  if (!activeDocuments?.documentRoot || !activeDocuments?.sourceCommit) {
    throw new CitationDocumentUpdateError("No active Citation Lab research-document snapshot is available.", 503, "CITATION_DOCUMENT_ACTIVE_SNAPSHOT_UNAVAILABLE");
  }
  const independent = activeDocuments.sourceCommit !== citationPackageResolution.active.sourceCommit;
  return new ResearchDocumentStore({
    packageRoot: citationPackageResolution.active.packagePath,
    repositoryMirrorPath: activeDocuments.documentRoot,
    repositoryMirrorCommit: activeDocuments.sourceCommit,
    allowIndependentRepositorySnapshot: independent,
    independentRepositorySnapshot: activeDocuments.verified === true ? activeDocuments : null,
    maxFileBytes: 16 * 1024 * 1024,
    maxCorpusBytes: 96 * 1024 * 1024
  });
}

try {
  researchDocumentStore = createActiveResearchDocumentStore();
} catch (error) {
  productionLogger.error("citation_research.documents_not_ready", { error: error.message, code: error.code || "RESEARCH_DOCUMENT_INIT_FAILED" });
}
const diagnosticApi = createDiagnosticApi({
  diagnosticStore,
  requestJson,
  configured,
  relayService: diagnosticRelayService,
  monitoringPlanService: brandMonitoringService,
  adHocDiagnosticService,
  analysisEngine: diagnosticAnalysisEngine,
  requireAnalysisEngine: true,
  liveEffectReportEngine,
  actionExecutor: (action, { principal, request }) => diagnosticActionService.executeAccepted({
    workspaceId: "default",
    action,
    actor: principal,
    request
  }),
  enterpriseSnapshotProvider: async ({ workspaceId, projectId }) => {
    const project = diagnosticStore.project(workspaceId, projectId);
    const workspace = workspaceStore.get(workspaceId).state || {};
    const [operations, traffic] = await Promise.all([
      monitoringStore.operationsSummary({ workspaceId, businessLineId: project.businessLineId || "" }),
      Promise.resolve(monitoringStore.trafficSummary({ workspaceId }))
    ]);
    const websiteDiagnostic = monitoringStore.listReports({ workspaceId, limit: 1 })[0] || null;
    return {
      capturedAt: new Date().toISOString(),
      businessLineId: project.businessLineId || null,
      assets: {
        questionCount: (workspace.questionLibrary || []).filter((item) => !project.businessLineId || !item.businessLineId || item.businessLineId === project.businessLineId).length,
        topicCount: (workspace.topics || []).filter((item) => !project.businessLineId || !item.businessLineId || item.businessLineId === project.businessLineId).length,
        knowledgeBaseCount: (workspace.knowledgeBases || []).filter((item) => !project.businessLineId || !item.businessLineId || item.businessLineId === project.businessLineId || item.scope === "enterprise").length,
        knowledgeItemCount: (workspace.knowledgeItems || []).filter((item) => !project.businessLineId || !item.businessLineId || item.businessLineId === project.businessLineId).length
      },
      production: {
        articleTotal: operations.content.totalArticles,
        draft: operations.content.draft + operations.content.inReview + operations.content.changesRequested,
        approved: operations.content.approved,
        published: operations.content.published,
        taskTotal: operations.content.taskTotal,
        publishing: operations.publishing
      },
      websiteDiagnostic: websiteDiagnostic ? {
        reportId: websiteDiagnostic.id,
        sourceUrl: websiteDiagnostic.sourceUrl,
        status: websiteDiagnostic.status,
        overallScore: websiteDiagnostic.overallScore,
        ruleVersion: websiteDiagnostic.ruleVersion,
        contentHash: websiteDiagnostic.contentHash,
        completedAt: websiteDiagnostic.completedAt
      } : null,
      crawlerTraffic: {
        period: traffic.period,
        pv: traffic.kpis.pv,
        aiBotPv: traffic.kpis.aiBotPv,
        uniqueIp: traffic.kpis.uniqueIp,
        boundary: "Crawler access is a discoverability signal, not proof of AI-answer citation."
      }
    };
  }
});
const monitoringRemotePorts = String(process.env.TZ_MONITORING_REMOTE_PORTS || "80,443,19080")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0 && value <= 65_535);
const monitoringStore = new MonitoringStore(database, {
  workspaceId: "default",
  publisherStore,
  remotePorts: monitoringRemotePorts.length ? monitoringRemotePorts : [80, 443],
  recommendationGenerator: createMonitoringSuggestionGenerator({ aiGenerationService })
});
const recoveredMonitoringReports = monitoringStore.recoverInterruptedDiagnostics({ workspaceId: "default" });
if (recoveredMonitoringReports) productionLogger.info("monitoring.diagnostics_interrupted_recovered", { count: recoveredMonitoringReports });
const siteCmsStore = new SiteCmsStore(database, { workspaceId: "default", trustProxy: configured.trustProxy });
const sitePreviewStore = new PublicSiteStore({ database, cmsStore: siteCmsStore, workspaceId: "default" });
const analysisWorkbenchStore = new AnalysisWorkbenchStore(database, { workspaceId: "default" });
const analysisWorkbenchEngine = new AnalysisWorkbenchEngine({
  store: analysisWorkbenchStore,
  citationResearchStore,
  researchDocumentStore,
  knowledgeStore,
  aiGenerationService,
  siteOperationsProvider: async ({ workspaceId = "default" } = {}) => {
    const workspace = workspaceStore.get(workspaceId).state || {};
    const [overview, operations, traffic] = await Promise.all([
      monitoringStore.overview({ workspaceId }),
      monitoringStore.operationsSummary({ workspaceId }),
      Promise.resolve(monitoringStore.trafficSummary({ workspaceId }))
    ]);
    let publication = null;
    try { publication = siteCmsStore.publication(workspaceId); } catch { publication = null; }
    return {
      available: true,
      capturedAt: new Date().toISOString(),
      site: {
        companyName: workspace.companyProfile?.companyName || workspace.siteCms?.settings?.companyName || "",
        domain: workspace.site?.domain || workspace.siteCms?.settings?.officialDomain || "",
        publication: publication ? {
          releaseId: publication.releaseId,
          version: publication.version,
          publishedAt: publication.publishedAt,
          checksum: publication.checksum
        } : null
      },
      operations,
      traffic: {
        period: traffic.period,
        kpis: traffic.kpis,
        topPaths: Array.isArray(traffic.topPaths) ? traffic.topPaths.slice(0, 20) : [],
        boundary: "官网访问与 AI 爬虫访问是运营和可发现性信号，不等于 AI 回答引用。"
      },
      monitoring: {
        latestDiagnostic: overview.latestDiagnostic,
        boundary: overview.boundary,
        production: overview.production
      }
    };
  }
});
const analysisWorkbenchApi = createAnalysisWorkbenchApi({
  store: analysisWorkbenchStore,
  engine: analysisWorkbenchEngine,
  requestJson,
  configured,
  onBackgroundError: (error, context) => productionLogger.error("analysis_workbench.background_failed", {
    runId: context?.runId || null,
    code: error?.code || "ANALYSIS_WORKBENCH_FAILED",
    error: error?.message || String(error),
    details: Array.isArray(error?.details) ? error.details.slice(0, 8) : []
  })
});
const citationPackageUpdateApi = createCitationPackageUpdateApi({
  store: citationPackageUpdateStore,
  requestJson,
  configured
});
const citationDocumentUpdateApi = createCitationDocumentUpdateApi({
  store: citationDocumentUpdateStore,
  requestJson,
  configured
});

function reloadActiveResearchDocuments() {
  const next = createActiveResearchDocumentStore();
  const previous = researchDocumentStore;
  researchDocumentStore = next;
  analysisWorkbenchEngine.researchDocumentStore = next;
  previous?.close();
  return next.health();
}

let citationUpdateCheckRunning = false;
async function runCitationUpdateCheckIfDue() {
  if (citationUpdateCheckRunning) return;
  citationUpdateCheckRunning = true;
  try {
    const [packageStatus, documentStatus] = await Promise.all([
      citationPackageUpdateStore.status(),
      citationDocumentUpdateStore.status()
    ]);
    const checks = [];
    if (packageStatus.updatePolicy?.checkDue) checks.push(["citation_package_update", citationPackageUpdateStore.checkForUpdates()]);
    if (documentStatus.updatePolicy?.checkDue) checks.push(["citation_document_update", citationDocumentUpdateStore.checkForUpdates()]);
    const results = await Promise.allSettled(checks.map((item) => item[1]));
    results.forEach((result, index) => {
      if (result.status !== "rejected") return;
      const [scope] = checks[index];
      const error = result.reason;
      productionLogger.error(`${scope}.automatic_check_failed`, { code: error?.code || "CITATION_UPDATE_CHECK_FAILED", error: error?.message || String(error) });
    });
  } catch (error) {
    productionLogger.error("citation_update.automatic_check_failed", { code: error.code || "CITATION_UPDATE_CHECK_FAILED", error: error.message });
  } finally { citationUpdateCheckRunning = false; }
}
const citationUpdateStartupTimer = setTimeout(() => runCitationUpdateCheckIfDue(), 15_000);
const citationUpdateTimer = setInterval(() => runCitationUpdateCheckIfDue(), 60 * 60 * 1000);
let knowledgeWorkerRunning = false;
const knowledgeWorkerTimer = setInterval(() => {
  if (knowledgeWorkerRunning) return;
  knowledgeWorkerRunning = true;
  Promise.all([
    knowledgeStore.processOcrQueue({ workspaceId: "default", limit: 1 }),
    knowledgeStore.processIndexQueue({ workspaceId: "default", limit: 1 })
  ]).catch((error) => productionLogger.error("knowledge.worker_failed", { error: error.message })).finally(() => { knowledgeWorkerRunning = false; });
}, 15_000);
const publisherSchedulerIntervalMs = Math.max(250, Math.min(60_000, Number(process.env.TZ_PUBLISHER_SCHEDULER_INTERVAL_MS) || 5_000));
let publisherSchedulerRunning = false;
async function runPublisherScheduler() {
  if (publisherSchedulerRunning) return;
  publisherSchedulerRunning = true;
  try {
    await publisherStore.load();
    await publisherStore.processDueJobs();
  } catch (error) {
    productionLogger.error("publisher.scheduler_failed", { code: error.code || "PUBLISHER_SCHEDULER_FAILED", error: error.message });
  } finally {
    publisherSchedulerRunning = false;
  }
}
const publisherSchedulerStartupTimer = setTimeout(() => runPublisherScheduler(), 0);
const publisherSchedulerTimer = setInterval(() => runPublisherScheduler(), publisherSchedulerIntervalMs);
publisherSchedulerStartupTimer.unref?.();
publisherSchedulerTimer.unref?.();
let diagnosticRelayPullRunning = false;
async function runDiagnosticRelayPull() {
  if (!diagnosticRelayService.configured() || diagnosticRelayPullRunning) return;
  diagnosticRelayPullRunning = true;
  try {
    const result = await diagnosticRelayService.pullDeliveries({ limit: configured.relayPullBatchSize });
    const monitoring = await brandMonitoringService.reconcile({ limit: configured.brandMonitoringSchedulerBatchSize });
    if (result.pulled) productionLogger.info("diagnostic_relay.pull_completed", { pulled: result.pulled, acknowledged: result.acknowledged, failed: result.failed });
    if (monitoring.updated || monitoring.finalized) productionLogger.info("brand_monitoring.reconciled", monitoring);
  } catch (error) {
    productionLogger.error("diagnostic_relay.pull_failed", { code: error.code || "RELAY_PULL_FAILED", error: error.message });
  } finally {
    diagnosticRelayPullRunning = false;
  }
}
const diagnosticRelayPullStartupTimer = setTimeout(() => runDiagnosticRelayPull(), 2_000);
const diagnosticRelayPullTimer = setInterval(() => runDiagnosticRelayPull(), configured.relayPullIntervalMs);
diagnosticRelayPullStartupTimer.unref?.();
diagnosticRelayPullTimer.unref?.();

let brandMonitoringSchedulerRunning = false;
async function runBrandMonitoringScheduler() {
  if (!diagnosticRelayService.configured() || brandMonitoringSchedulerRunning) return;
  brandMonitoringSchedulerRunning = true;
  try {
    const result = await brandMonitoringService.processDue({ limit: configured.brandMonitoringSchedulerBatchSize });
    if (result.claimed || result.skipped || result.executed || result.reconciled.updated || result.reconciled.finalized) {
      productionLogger.info("brand_monitoring.scheduler_completed", {
        claimed: result.claimed,
        skipped: result.skipped,
        executed: result.executed,
        reconciled: result.reconciled
      });
    }
  } catch (error) {
    productionLogger.error("brand_monitoring.scheduler_failed", { code: error.code || "BRAND_MONITORING_SCHEDULER_FAILED", error: error.message });
  } finally {
    brandMonitoringSchedulerRunning = false;
  }
}
const brandMonitoringSchedulerStartupTimer = setTimeout(() => runBrandMonitoringScheduler(), 4_000);
const brandMonitoringSchedulerTimer = setInterval(() => runBrandMonitoringScheduler(), configured.brandMonitoringSchedulerIntervalMs);
brandMonitoringSchedulerStartupTimer.unref?.();
brandMonitoringSchedulerTimer.unref?.();

let contentAssetPatrolRunning = false;
async function runContentAssetPatrol() {
  if (contentAssetPatrolRunning) return;
  contentAssetPatrolRunning = true;
  try {
    const result = await contentAssetStore.patrolDue({ workspaceId: "default", limit: configured.contentAssetPatrolBatchSize, citationStaleDays: configured.contentAssetCitationStaleDays });
    if (result.checked || result.staleCitations) productionLogger.info("content_asset.patrol_completed", { checked: result.checked, succeeded: result.succeeded, failed: result.failed, staleCitations: result.staleCitations });
  } catch (error) {
    productionLogger.error("content_asset.patrol_failed", { code: error.code || "CONTENT_ASSET_PATROL_FAILED", error: error.message });
  } finally {
    contentAssetPatrolRunning = false;
  }
}
const contentAssetPatrolStartupTimer = setTimeout(() => runContentAssetPatrol(), 8_000);
const contentAssetPatrolTimer = setInterval(() => runContentAssetPatrol(), configured.contentAssetPatrolIntervalMs);
contentAssetPatrolStartupTimer.unref?.();
contentAssetPatrolTimer.unref?.();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

mimeTypes[".exe"] = "application/vnd.microsoft.portable-executable";
// Keep the management console pointed at the same versioned artifact that is
// advertised by electron-updater.  The environment variable can still
// override this for a staged release, but a fresh deployment must never fall
// back to the removed legacy filename.
const publisherDownloadPath = "https://tongzhuo.ink/downloads/%E6%A1%90%E7%81%BC%E5%8F%91%E5%B8%83%E5%8A%A9%E6%89%8B%20Setup%201.0.4.exe";

function requestId(request) {
  const supplied = String(request.headers["x-request-id"] || "").trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
}

function applySecurityHeaders(response, id) {
  response.setHeader("X-Request-Id", id);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

function escapeHtmlAttribute(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function publisherDownloadUrl() {
  const configuredUrl = String(configured.publisherDownloadUrl || "").trim();
  if (!configuredUrl) return publisherDownloadPath;
  try {
    const parsed = new URL(configuredUrl);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : publisherDownloadPath;
  } catch {
    return publisherDownloadPath;
  }
}

function isPublisherDownload(filePath) {
  const downloadsRoot = path.resolve(root, "downloads");
  const resolved = path.resolve(filePath);
  return resolved === downloadsRoot || resolved.startsWith(`${downloadsRoot}${path.sep}`);
}

function entityTag(fileInfo) {
  return `W/\"${fileInfo.size.toString(16)}-${Math.floor(fileInfo.mtimeMs).toString(16)}\"`;
}

function parseByteRange(value, size) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("bytes=") || raw.slice(6).includes(",")) return null;
  const [startText, endText] = raw.slice(6).split("-", 2);
  if (!startText && !endText) return null;
  if (!size) return null;
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    const length = Math.min(suffixLength, size);
    return { start: size - length, end: size - 1 };
  }
  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function streamStaticFile(request, response, filePath, fileInfo) {
  const etag = entityTag(fileInfo);
  const isDownload = isPublisherDownload(filePath);
  const baseHeaders = {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "ETag": etag,
    "Last-Modified": fileInfo.mtime.toUTCString(),
    "Cache-Control": isDownload ? "public, max-age=300, must-revalidate" : "no-store"
  };
  if (isDownload) baseHeaders["Content-Disposition"] = `attachment; filename=\"${path.basename(filePath)}\"`;

  const ifNoneMatch = String(request.headers["if-none-match"] || "").trim();
  if (ifNoneMatch === "*" || ifNoneMatch.split(",").map((item) => item.trim()).includes(etag)) {
    response.writeHead(304, baseHeaders);
    response.end();
    return;
  }

  let status = 200;
  let start = 0;
  let end = Math.max(0, fileInfo.size - 1);
  const rangeHeader = request.headers.range;
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, fileInfo.size);
    if (!range) {
      response.writeHead(416, {
        ...baseHeaders,
        "Content-Range": `bytes */${fileInfo.size}`,
        "Content-Length": "0"
      });
      response.end();
      return;
    }
    status = 206;
    start = range.start;
    end = range.end;
  }

  const contentLength = fileInfo.size ? end - start + 1 : 0;
  const headers = {
    ...baseHeaders,
    "Content-Length": String(contentLength)
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${fileInfo.size}`;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || !contentLength) {
    response.end();
    return;
  }

  const stream = createReadStream(filePath, { start, end });
  stream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.destroy(error);
  });
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}

function cookie(request, name) {
  const source = String(request.headers.cookie || "");
  for (const part of source.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return part.slice(separator + 1).trim(); }
  }
  return "";
}

async function optionalPrincipal(request) {
  try { return await authService.authenticate(request, { requireCsrf: false }); } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}

function authPayload(result = {}) {
  return {
    initialized: authService.initialized(),
    authenticated: Boolean(result.user),
    user: result.user || null,
    csrfToken: result.csrfToken || "",
    expiresAt: result.expiresAt || null
  };
}

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(body);
}

function rawResponse(response, status, body, contentType, headers = {}) {
  const output = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8");
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": output.byteLength,
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(output);
}

function parseObject(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function requestJson(request, maxBytes = configured.requestBodyLimit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("请求体过大。");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("请求 JSON 格式无效。");
    error.status = 422;
    throw error;
  }
}

function routeParts(request) {
  return new URL(request.url || "/", "http://localhost").pathname.split("/").filter(Boolean);
}

async function handleAuthApi(request, response, parts) {
  const method = request.method || "GET";
  const operation = parts[3] || "status";
  if (operation === "status" && method === "GET") {
    const principal = authService.initialized() ? await optionalPrincipal(request) : null;
    return jsonResponse(response, 200, { ok: true, data: authPayload({ user: principal?.user || null, csrfToken: principal ? cookie(request, "tz_csrf") : "" }) });
  }
  if (operation === "setup" && method === "POST") {
    const result = await authService.setup(await requestJson(request, 100_000), request, response);
    productionLogger.info("auth.setup", { userId: result.user.id, requestId: response.getHeader("X-Request-Id") });
    return jsonResponse(response, 201, { ok: true, data: authPayload(result) });
  }
  if (operation === "login" && method === "POST") {
    const result = await authService.login(await requestJson(request, 100_000), request, response);
    productionLogger.info("auth.login", { userId: result.user.id, requestId: response.getHeader("X-Request-Id") });
    return jsonResponse(response, 200, { ok: true, data: authPayload(result) });
  }
  if (operation === "logout" && method === "POST") {
    const result = await authService.logout(request, response);
    return jsonResponse(response, 200, { ok: true, data: result });
  }
  if (operation === "me" && method === "GET") {
    const principal = await authService.authenticate(request, { requireCsrf: false });
    return jsonResponse(response, 200, { ok: true, data: { user: principal.user, csrfToken: cookie(request, "tz_csrf") } });
  }
  return jsonResponse(response, 404, { ok: false, code: "AUTH_ROUTE_NOT_FOUND", message: "登录接口不存在。" });
}

async function handleWorkspaceApi(request, response, parts) {
  const method = request.method || "GET";
  if (parts.length === 3) {
    if (method === "GET") {
      await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
      const workspace = workspaceStore.get("default");
      return jsonResponse(response, 200, { ok: true, data: { ...workspace, initialized: Boolean(workspace.state) } });
    }
    if (method === "PUT") {
      const principal = await authService.requirePermission(request, PERMISSIONS.WORKSPACE_WRITE);
      const body = await requestJson(request, Math.max(configured.requestBodyLimit, 20_000_000));
      const workspace = workspaceStore.save("default", body.state, {
        expectedRevision: body.expectedRevision,
        actor: principal,
        request,
        reason: body.source || "browser-operation"
      });
      let knowledgeSync = null;
      try {
        knowledgeSync = await knowledgeStore.syncWorkspaceState(body.state, principal, request, "default");
      } catch (error) {
        productionLogger.error("knowledge.workspace_sync_failed", { requestId: response.getHeader("X-Request-Id"), error: error.message, code: error.code || "KNOWLEDGE_SYNC_FAILED" });
        knowledgeSync = { error: "知识索引同步失败，工作区数据已保存；请在企业知识页面重试索引。" };
      }
      return jsonResponse(response, 200, { ok: true, data: { ...workspace, initialized: true, knowledgeSync } });
    }
  }
  if (parts[3] === "revisions" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.AUDIT_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: workspaceStore.listRevisions("default", query.get("limit")) } });
  }
  if (parts[3] === "records" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: workspaceStore.listBusinessRecords("default", query.get("type"), query.get("limit")) } });
  }
  return jsonResponse(response, 404, { ok: false, code: "WORKSPACE_ROUTE_NOT_FOUND", message: "工作区接口不存在。" });
}

function siteLeadRows() {
  return database.connection.prepare(`
    SELECT id, name, phone, company, service, website, message, source_url,
      status, metadata_json, created_at, updated_at
    FROM site_contact_leads
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT 1000
  `).all("default").map((row) => {
    const metadata = parseObject(row.metadata_json);
    return {
      id: row.id, name: row.name, phone: row.phone, company: row.company,
      service: row.service, website: row.website, message: row.message,
      sourceUrl: row.source_url, sourcePage: row.source_url || "官网",
      status: row.status, owner: metadata.owner || "未分配",
      nextFollowAt: metadata.nextFollowAt || "", notes: metadata.notes || "",
      history: Array.isArray(metadata.history) ? metadata.history : [],
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  });
}

function siteDeploymentBaseUrl() {
  const candidate = String(process.env.TZ_SITE_BASE_URL || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

async function handleSiteCmsApi(request, response, parts) {
  const method = request.method || "GET";
  const operation = parts[3] || "snapshot";
  if (operation === "snapshot" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const draft = siteCmsStore.draft("default");
    const publication = siteCmsStore.publication("default");
    const siteBaseUrl = siteDeploymentBaseUrl();
    return jsonResponse(response, 200, { ok: true, data: { draft, publication, releases: { items: siteCmsStore.releases("default", 100) }, leads: { items: siteLeadRows() }, ...(siteBaseUrl ? { siteBaseUrl } : {}) } });
  }
  if (operation === "draft" && method === "PUT") {
    const principal = await authService.requirePermission(request, PERMISSIONS.WORKSPACE_WRITE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 4_000_000));
    const draft = siteCmsStore.saveDraft({ expectedRevision: body.expectedRevision, cms: body.cms || body.snapshot }, principal, request, "default");
    return jsonResponse(response, 200, { ok: true, data: { draft } });
  }
  if (operation === "publish" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.CONTENT_PUBLISH);
    const body = await requestJson(request, 100_000);
    const publication = siteCmsStore.publish({ expectedDraftRevision: body.expectedDraftRevision, note: body.note }, principal, request, "default");
    return jsonResponse(response, 200, { ok: true, data: { publication, releases: { items: siteCmsStore.releases("default", 100) } } });
  }
  if (operation === "rollback" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.CONTENT_PUBLISH);
    const body = await requestJson(request, 100_000);
    const result = siteCmsStore.rollback({ releaseId: body.releaseId, expectedCurrentVersion: body.expectedCurrentVersion, note: body.note }, principal, request, "default");
    return jsonResponse(response, 200, { ok: true, data: { ...result, releases: { items: siteCmsStore.releases("default", 100) } } });
  }
  if (operation === "leads" && parts.length === 5 && method === "PATCH") {
    const principal = await authService.requirePermission(request, PERMISSIONS.WORKSPACE_WRITE);
    const leadId = decodeURIComponent(parts[4]);
    const row = database.connection.prepare("SELECT id, status, metadata_json FROM site_contact_leads WHERE id = ? AND workspace_id = ?").get(leadId, "default");
    if (!row) return jsonResponse(response, 404, { ok: false, code: "SITE_LEAD_NOT_FOUND", message: "线索不存在。" });
    const body = await requestJson(request, 100_000);
    const allowedStatuses = new Set(["new", "contacted", "qualified", "closed", "spam"]);
    const status = allowedStatuses.has(String(body.status || "")) ? String(body.status) : row.status;
    const metadata = parseObject(row.metadata_json);
    const owner = String(body.owner || metadata.owner || "未分配").trim().slice(0, 160);
    const nextFollowAt = String(body.nextFollowAt || "").trim().slice(0, 160);
    const note = String(body.note || body.notes || "").trim().slice(0, 4_000);
    const history = Array.isArray(metadata.history) ? metadata.history : [];
    if (note) history.unshift({ id: randomUUID(), at: new Date().toISOString(), note, status, owner });
    const nextMetadata = JSON.stringify({ ...metadata, owner, nextFollowAt, notes: note || metadata.notes || "", history: history.slice(0, 100), updatedBy: principal.userId || principal.id || null });
    const now = new Date().toISOString();
    database.connection.prepare("UPDATE site_contact_leads SET status = ?, metadata_json = ?, updated_at = ? WHERE id = ? AND workspace_id = ?").run(status, nextMetadata, now, leadId, "default");
    return jsonResponse(response, 200, { ok: true, data: { lead: siteLeadRows().find((item) => item.id === leadId) } });
  }
  if (operation === "preview" && parts.length === 4 && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    const requestedPath = String(query.get("path") || "/").trim() || "/";
    const snapshot = sitePreviewStore.snapshot({ draft: true });
    const normalizePath = (value) => {
      const raw = String(value || "/").split("?")[0] || "/";
      if (!raw.startsWith("/")) return "/";
      return raw !== "/" && !raw.endsWith("/") ? `${raw}/` : raw;
    };
    const pathname = normalizePath(requestedPath);
    const page = snapshot.site.pages.find((item) => normalizePath(item.path) === pathname);
    const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const origin = `${forwardedProto === "https" ? "https" : "http"}://${request.headers.host || "localhost"}`;
    const body = page
      ? renderFixedPage({ site: snapshot.site, page, articles: snapshot.articles, categories: snapshot.categories, origin, preview: true, assetBase: "/api/v1/site-cms/preview/assets" })
      : renderNotFound({ site: snapshot.site, origin, pathname });
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    return rawResponse(response, page ? 200 : 404, body, "text/html; charset=utf-8");
  }
  if (operation === "preview" && parts[4] === "assets" && parts[5] && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const fileName = path.basename(decodeURIComponent(parts[5]));
    const previewAssetBase = "/api/v1/site-cms/preview/assets";
    const previewAssetFiles = Object.freeze({
      "template-03-software-ai.css": "03-software-ai.css",
      "template-04-logistics.css": "04-logistics.css",
      "template-05-business-services.css": "05-business-services.css",
      "template-06-finance.css": "06-finance.css",
      "template-07-healthcare.css": "07-healthcare.css",
      "template-08-education.css": "08-education.css",
      "template-09-travel-hotel.css": "09-travel-hotel.css",
      "template-10-food-consumer.css": "10-food-consumer.css",
      "template-11-ups.css": "template-11-ups.css"
    });
    const previewAssets = new Set([
      "site.css",
      "site.js",
      "site-v8.css",
      "template-01-industry.css",
      "template-02-construction.css",
      ...Object.keys(previewAssetFiles),
      "template-runtime.js",
      "site-v8.js",
      "gsap.min.js",
      "tz-display.woff2",
      "favicon.svg",
      "geo-signal-hero.svg",
      "geo-answer-hero.svg",
      "geo-network-hero.svg",
      "tongzhuo-geo-mark.svg",
      "tongzhuo-mark-gold.png",
      "tongzhuo-mark-wine.png",
      "tongzhuo-official-mark.png",
      "zhuojian-ai-brand.png",
      "zhuojian-ai-lockup-gold.png",
      "zhuojian-ai-official-logo.png",
      "template-01-default.png",
      "template-02-default.png",
      "template-03-default.png",
      "template-04-default.png",
      "template-05-default.png",
      "template-06-default.png",
      "template-07-default.png",
      "template-08-default.png",
      "template-09-default.png",
      "template-10-default.png",
      "template-11-ups.css",
      "template-11-default.png"
    ]);
    if (!previewAssets.has(fileName)) return jsonResponse(response, 404, { ok: false, code: "SITE_CMS_ASSET_NOT_FOUND", message: "预览资源不存在。" });
    const relativeFile = previewAssetFiles[fileName] || fileName;
    const filePath = fileName === "tz-display.woff2"
      ? path.join(siteAssetRoot, "fonts", fileName)
      : path.join(siteAssetRoot, relativeFile);
    let body = await readFile(filePath);
    if (fileName === "site-v8.css" || fileName === "site-v8.js") {
      body = body.toString("utf8")
        .replaceAll("/site-assets-r6/site.css", `${previewAssetBase}/site.css`)
        .replaceAll("/site-assets-r6/site.js", `${previewAssetBase}/site.js`)
        .replaceAll("/site-assets-r9/tz-display.woff2", `${previewAssetBase}/tz-display.woff2`)
        .replaceAll("/site-assets-r9/gsap.min.js", `${previewAssetBase}/gsap.min.js`);
    }
    const contentType = fileName.endsWith(".css")
      ? "text/css; charset=utf-8"
      : fileName.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : fileName.endsWith(".svg")
          ? "image/svg+xml"
          : fileName.endsWith(".png")
            ? "image/png"
            : fileName.endsWith(".woff2")
              ? "font/woff2"
              : "application/octet-stream";
    return rawResponse(response, 200, body, contentType);
  }
  return jsonResponse(response, 404, { ok: false, code: "SITE_CMS_ROUTE_NOT_FOUND", message: "官网 CMS 接口不存在。" });
}

async function handleUsersApi(request, response, parts) {
  const method = request.method || "GET";
  const principal = await authService.requirePermission(request, PERMISSIONS.USERS_MANAGE, { requireCsrf: method === "GET" ? false : undefined });
  if (parts.length === 3 && method === "GET") return jsonResponse(response, 200, { ok: true, data: { users: authService.listUsers() } });
  if (parts.length === 3 && method === "POST") {
    const user = await authService.createUser(await requestJson(request, 100_000), principal, request);
    return jsonResponse(response, 201, { ok: true, data: { user } });
  }
  if (parts.length === 4 && method === "PATCH") {
    const user = await authService.updateUser(decodeURIComponent(parts[3]), await requestJson(request, 100_000), principal, request);
    return jsonResponse(response, 200, { ok: true, data: { user } });
  }
  if (parts.length === 4 && method === "DELETE") {
    return jsonResponse(response, 200, { ok: true, data: authService.deleteUser(decodeURIComponent(parts[3]), principal, request) });
  }
  return jsonResponse(response, 404, { ok: false, code: "USER_ROUTE_NOT_FOUND", message: "成员接口不存在。" });
}

async function handleAuditApi(request, response) {
  await authService.requirePermission(request, PERMISSIONS.AUDIT_READ, { requireCsrf: false });
  const query = new URL(request.url || "/", "http://localhost").searchParams;
  const limit = Math.max(1, Math.min(1_000, Number(query.get("limit")) || 200));
  const rows = database.connection.prepare(`
    SELECT a.*, u.display_name AS actor_name, u.username AS actor_username
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE a.action NOT IN ('workspace.save', 'monitoring.access_logs.ingest')
    ORDER BY a.id DESC LIMIT ?
  `).all(limit).map((row) => ({
    id: row.id,
    occurredAt: row.created_at,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actor: row.actor_name || row.actor_username || "系统",
    details: JSON.parse(row.details_json || "{}"),
    ipAddress: row.ip_address || null
  }));
  return jsonResponse(response, 200, { ok: true, data: { items: rows } });
}

function monitoringRangeFromQuery(request) {
  const query = new URL(request.url || "/", "http://localhost").searchParams;
  const days = Math.max(1, Math.min(366, Number(query.get("days")) || 30));
  const dateTo = query.get("dateTo") || monitoringReportingDate();
  return {
    dateFrom: query.get("dateFrom") || monitoringDateDaysBefore(dateTo, days - 1),
    dateTo,
    days,
    source: query.get("source") || "server",
    trafficType: query.get("trafficType") || "all",
    articleId: query.get("articleId") || "",
    businessLineId: query.get("businessLineId") || ""
  };
}

function monitoringReportPayload(report) {
  if (!report) return null;
  const completed = ["completed", "complete", "success", "succeeded"].includes(String(report.status || "").toLowerCase());
  const score = (value) => completed && value != null ? Number(value) : null;
  return {
    ...report,
    url: report.sourceUrl || "",
    overallScore: completed ? report.overallScore : null,
    totalScore: completed ? report.overallScore : null,
    scores: {
      schema: score(report.schema?.score),
      content: score(report.content?.score),
      meta: score(report.meta?.score),
      authority: score(report.citation?.score),
      citation: score(report.citation?.score),
      preview: score(report.meta?.previewScore ?? report.meta?.preview_score)
    },
    schemaScore: score(report.schema?.score),
    contentScore: score(report.content?.score),
    metaScore: score(report.meta?.score),
    authorityScore: score(report.citation?.score),
    citationScore: score(report.citation?.score),
    previewScore: score(report.meta?.previewScore ?? report.meta?.preview_score)
  };
}

async function handleMonitoringApi(request, response, parts) {
  const method = request.method || "GET";
  const workspaceId = "default";
  const operation = parts[3] || "overview";
  const range = monitoringRangeFromQuery(request);

  if (operation === "overview" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const [traffic, operations] = await Promise.all([
      Promise.resolve(monitoringStore.trafficSummary({ workspaceId, ...range })),
      monitoringStore.operationsSummary({ workspaceId, dateFrom: range.dateFrom, dateTo: range.dateTo, businessLineId: range.businessLineId })
    ]);
    return jsonResponse(response, 200, {
      ok: true,
      data: {
        overview: {
          generatedAt: new Date().toISOString(),
          days: range.days,
          latestDiagnostic: monitoringReportPayload(monitoringStore.listReports({ workspaceId, limit: 1 })[0] || null),
          traffic,
          production: {
            articles: {
              total: operations.content.totalArticles,
              draft: operations.content.draft + operations.content.inReview + operations.content.changesRequested,
              approved: operations.content.approved,
              published: operations.content.published
            },
            contentTasks: operations.content.taskTotal,
            generation: operations.generation,
            publishing: {
              total: operations.publishing.total,
              running: operations.publishing.pending,
              failed: operations.publishing.failed,
              success: operations.publishing.success,
              partial: operations.publishing.partial,
              cancelled: operations.publishing.cancelled
            }
          },
          boundary: operations.boundary
        }
      }
    });
  }

  if (operation === "traffic" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const summary = monitoringStore.trafficSummary({ workspaceId, ...range });
    const bots = summary.botBreakdown
      .filter((item) => item.count > 0)
      .map((item) => ({ name: item.key, count: item.count }));
    return jsonResponse(response, 200, {
      ok: true,
      data: { traffic: {
        ...summary,
        pv: summary.kpis.pv,
        humanPv: summary.kpis.humanPv,
        aiBotPv: summary.kpis.aiBotPv,
        searchBotPv: summary.kpis.searchBotPv,
        otherBotPv: summary.kpis.otherBotPv,
        unknownPv: summary.kpis.unknownPv,
        uniqueIp: summary.kpis.uniqueIp,
        trend: (summary.trend || summary.trafficTrend).map((item) => ({ label: item.date, pv: item.pv, allPv: item.totalPv ?? item.pv, humanPv: item.humanPv, aiBotPv: item.aiBotPv, searchBotPv: item.searchBotPv, otherBotPv: item.otherBotPv, unknownPv: item.unknownPv })),
        topPaths: summary.topPaths.map((item) => ({ ...item, pv: item.views })),
        bots
      } }
    });
  }

  if (operation === "diagnostics" && parts.length === 4 && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: monitoringStore.listReports({ workspaceId, status: query.get("status") || "", limit: query.get("limit") || 50 }).map(monitoringReportPayload) } });
  }
  if (operation === "diagnostics" && parts.length === 4 && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.WORKSPACE_WRITE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 6_000_000));
    // URL fetches and optional model suggestions can take longer than a
    // reverse-proxy request window. Persist first, then let the in-process
    // worker advance pending -> running -> completed/failed while the client
    // polls the report id.
    const report = monitoringStore.enqueueDiagnosis({ workspaceId, ...body, actor: principal, request });
    return jsonResponse(response, 202, { ok: true, data: { diagnostic: monitoringReportPayload(report) } });
  }
  if (operation === "diagnostics" && parts.length === 5 && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    return jsonResponse(response, 200, { ok: true, data: { diagnostic: monitoringReportPayload(monitoringStore.report(workspaceId, decodeURIComponent(parts[4]))) } });
  }
  if (operation === "access-logs" && parts.length === 4 && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.SYSTEM_MANAGE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 4_000_000));
    return jsonResponse(response, 202, { ok: true, data: monitoringStore.ingestAccessLogs({ workspaceId, ...body, actor: principal, request }) });
  }

  return jsonResponse(response, 404, { ok: false, code: "MONITORING_ROUTE_NOT_FOUND", message: "效果监测接口不存在。" });
}

async function handleKnowledgeApi(request, response, parts) {
  const method = request.method || "GET";
  const workspaceId = "default";
  if (parts.length === 4 && parts[3] === "assets" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: knowledgeStore.listAssets({ workspaceId, libraryId: query.get("libraryId") || "", documentId: query.get("documentId") || "", versionId: query.get("versionId") || "", reviewStatus: query.get("reviewStatus") || "", includeData: query.get("includeData") === "1", limit: query.get("limit") || 100 }) } });
  }
  if (parts.length === 4 && parts[3] === "assets" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 30_000_000));
    const asset = knowledgeStore.createAsset({ workspaceId, ...body, actor: principal, request });
    return jsonResponse(response, 201, { ok: true, data: { asset } });
  }
  if (((parts.length === 4 && parts[3] === "assets-batch") || (parts.length === 5 && parts[3] === "assets" && parts[4] === "batch")) && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 140_000_000));
    const result = knowledgeStore.createAssetsBatch({ workspaceId, ...body, actor: principal, request });
    return jsonResponse(response, 201, { ok: true, data: result });
  }
  if (parts.length === 4 && parts[3] === "documents-batch" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 140_000_000));
    const result = await knowledgeStore.createDocumentsBatch({ workspaceId, ...body, actor: principal, request });
    return jsonResponse(response, result.failed ? 207 : 201, { ok: true, data: result });
  }
  if (parts.length === 6 && parts[3] === "assets" && parts[5] === "content" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const asset = knowledgeStore.assetContent({ workspaceId, assetId: decodeURIComponent(parts[4]) });
    const encodedName = encodeURIComponent(asset.sourceName || asset.id);
    return rawResponse(response, 200, asset.buffer, asset.mimeType, { "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`, ETag: `"${asset.id}"` });
  }
  if (parts.length === 6 && parts[3] === "assets" && parts[5] === "approve" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_REVIEW);
    const asset = knowledgeStore.approveAsset({ workspaceId, assetId: decodeURIComponent(parts[4]), actor: principal, request });
    return jsonResponse(response, 200, { ok: true, data: { asset } });
  }
  if (parts.length === 4 && parts[3] === "ocr" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: knowledgeStore.listOcrJobs({ workspaceId, status: query.get("status") || "", assetId: query.get("assetId") || "", versionId: query.get("versionId") || "", limit: query.get("limit") || 100 }), configured: Boolean(knowledgeStore.ocrEndpoint) } });
  }
  if (parts.length === 4 && parts[3] === "ocr" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await requestJson(request, 100_000);
    const result = await knowledgeStore.processOcrQueue({ workspaceId, limit: body.limit || 2, workerId: principal.userId || "operator" });
    return jsonResponse(response, 200, { ok: true, data: result });
  }
  if (parts.length === 6 && parts[3] === "ocr" && parts[5] === "retry" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const job = knowledgeStore.retryOcrJob({ workspaceId, jobId: decodeURIComponent(parts[4]), actor: principal, request });
    return jsonResponse(response, 200, { ok: true, data: { job } });
  }
  if (parts.length === 4 && parts[3] === "index-jobs" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: knowledgeStore.listIndexJobs({ workspaceId, status: query.get("status") || "", versionId: query.get("versionId") || "", limit: query.get("limit") || 100 }) } });
  }
  if (parts.length === 4 && parts[3] === "index-jobs" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await requestJson(request, 100_000);
    const result = await knowledgeStore.processIndexQueue({ workspaceId, limit: body.limit || 2, workerId: principal.userId || "operator" });
    return jsonResponse(response, 200, { ok: true, data: result });
  }
  if (parts.length === 6 && parts[3] === "index-jobs" && parts[5] === "retry" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const job = knowledgeStore.retryIndexJob({ workspaceId, jobId: decodeURIComponent(parts[4]), actor: principal, request });
    return jsonResponse(response, 200, { ok: true, data: { job } });
  }
  if (parts.length === 4 && parts[3] === "vector-backend" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    return jsonResponse(response, 200, { ok: true, data: knowledgeStore.vectorBackendStatus() });
  }
  if (parts.length === 4 && parts[3] === "libraries" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: knowledgeStore.listLibraries({ workspaceId, businessLineId: query.get("businessLineId") || "", includeArchived: query.get("includeArchived") === "1" }) } });
  }
  if (parts.length === 4 && parts[3] === "libraries" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const library = knowledgeStore.createLibrary({ workspaceId, ...(await requestJson(request, 100_000)), actor: principal, request });
    return jsonResponse(response, 201, { ok: true, data: { library: knowledgeStore.libraryRow(library) } });
  }
  if (parts.length === 5 && parts[3] === "libraries" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const library = knowledgeStore.library(workspaceId, decodeURIComponent(parts[4]), true);
    return jsonResponse(response, 200, { ok: true, data: { library: knowledgeStore.libraryRow(library), documents: knowledgeStore.listDocuments({ workspaceId, libraryId: library.id, includeArchived: true }) } });
  }
  if (parts.length === 6 && parts[3] === "libraries" && parts[5] === "documents" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const libraryId = decodeURIComponent(parts[4]);
    knowledgeStore.library(workspaceId, libraryId);
    return jsonResponse(response, 200, { ok: true, data: { items: knowledgeStore.listDocuments({ workspaceId, libraryId, includeArchived: true }) } });
  }
  if (parts.length === 6 && parts[3] === "libraries" && parts[5] === "documents" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    // Base64 expands a 20 MB source file to roughly 27 MB; leave room for JSON metadata.
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 30_000_000));
    const version = await knowledgeStore.createDocument({ workspaceId, libraryId: decodeURIComponent(parts[4]), ...body, actor: principal, request });
    return jsonResponse(response, 201, { ok: true, data: { version: knowledgeStore.publicVersion(version) } });
  }
  if (parts.length === 5 && parts[3] === "documents" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const items = knowledgeStore.listDocuments({ workspaceId, limit: 1_000 }).filter((item) => item.id === decodeURIComponent(parts[4]));
    if (!items.length) throw new KnowledgeError("知识文档不存在。", 404, "KNOWLEDGE_DOCUMENT_NOT_FOUND");
    return jsonResponse(response, 200, { ok: true, data: { document: items[0] } });
  }
  if (parts.length === 5 && parts[3] === "documents" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    // Base64 expands a 20 MB source file to roughly 27 MB; leave room for JSON metadata.
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 30_000_000));
    const version = await knowledgeStore.createVersion({ workspaceId, documentId: decodeURIComponent(parts[4]), ...body, actor: principal, request });
    return jsonResponse(response, 201, { ok: true, data: { version: knowledgeStore.publicVersion(version) } });
  }
  if (parts.length === 5 && parts[3] === "versions" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { version: knowledgeStore.publicVersion(knowledgeStore.documentVersion(workspaceId, decodeURIComponent(parts[4])), { includeContent: query.get("includeContent") === "1" }) } });
  }
  if (parts.length === 6 && parts[3] === "versions" && parts[5] === "approve" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_REVIEW);
    const version = await knowledgeStore.approveVersion({ workspaceId, versionId: decodeURIComponent(parts[4]), actor: principal, request });
    return jsonResponse(response, 200, { ok: true, data: { version } });
  }
  if (parts.length === 6 && parts[3] === "versions" && parts[5] === "reindex" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.KNOWLEDGE_MANAGE);
    const version = await knowledgeStore.indexVersion({ workspaceId, versionId: decodeURIComponent(parts[4]), actor: principal, request });
    return jsonResponse(response, 200, { ok: true, data: { version } });
  }
  if (parts.length === 4 && parts[3] === "retrieve" && method === "POST") {
    const principal = await authService.requirePermission(request, PERMISSIONS.CONTENT_GENERATE);
    const body = await requestJson(request, 100_000);
    // This route feeds public content generation. Internal-only records are
    // available to explicitly scoped diagnostic services, never to browser
    // article retrieval even when a client sends includeInternal=true.
    const { includeInternal: _includeInternal, ...publicBody } = body || {};
    const result = await knowledgeStore.retrieve({ workspaceId, ...publicBody, includeInternal: false, actor: principal });
    return jsonResponse(response, 200, { ok: true, data: result });
  }
  if (parts.length === 5 && parts[3] === "retrieval" && method === "GET") {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    return jsonResponse(response, 200, { ok: true, data: { run: knowledgeStore.retrievalRun(workspaceId, decodeURIComponent(parts[4])) } });
  }
  return jsonResponse(response, 404, { ok: false, code: "KNOWLEDGE_ROUTE_NOT_FOUND", message: "知识库接口不存在。" });
}

async function handlePublisherApi(request, response, parts, principal = null) {
  await publisherStore.load();
  if (request.method === "GET" && parts.length === 2 && parts[1] === "overview") {
    for (const job of publisherStore.state.jobs || []) {
      try { contentAssetStore.syncPublisherJob(job, { workspaceId: "default" }); }
      catch (error) { productionLogger.error("content_asset.publisher_backfill_failed", { jobId: job?.id, code: error.code || "CONTENT_ASSET_SYNC_FAILED", error: error.message }); }
    }
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.overview() });
  }
  if (request.method === "POST" && parts.length === 2 && parts[1] === "jobs") {
    const body = await requestJson(request, Math.max(configured.requestBodyLimit, 8_000_000));
    const articleId = String(body.contentArticleId || body.articleId || body.article?.contentArticleId || body.article?.id || "").trim();
    if (!articleId) throw new ContentError("发布前必须关联正式内容文章。", 422, "CONTENT_ARTICLE_REQUIRED");
    const versionId = String(body.contentVersionId || body.articleVersionId || body.versionId || "").trim() || null;
    const gate = contentStore.assertCanPublish(articleId, versionId, { workspaceId: "default" });
    const publicationMetadata = gate.article.metadata || {};
    const siteMetadata = publicationMetadata.site || {};
    const showPublicCitationMarkers = publicCitationMarkersVisible(gate.version.metadata);
    const publicContent = applyPublicCitationVisibility(gate.version.contentHtml, { showPublicCitationMarkers });
    const job = await publisherStore.createJobs({
      ...body,
      articleId: gate.articleId,
      versionId: gate.versionId,
      contentArticleId: gate.articleId,
      contentVersionId: gate.versionId,
      contentRevision: gate.article.revision,
      siteSlug: body.siteSlug || publicationMetadata.siteSlug || siteMetadata.slug || "",
      siteCategory: body.siteCategory || publicationMetadata.siteCategory || siteMetadata.category || gate.article.category || "",
      siteCategoryId: body.siteCategoryId || publicationMetadata.siteCategoryId || siteMetadata.categoryId || "",
      siteCategorySlug: body.siteCategorySlug || publicationMetadata.siteCategorySlug || siteMetadata.categorySlug || "",
      siteAuthor: body.siteAuthor || publicationMetadata.siteAuthor || siteMetadata.author || "",
      siteExcerpt: body.siteExcerpt || publicationMetadata.siteExcerpt || siteMetadata.excerpt || gate.version.excerpt || "",
      article: {
        ...(body.article || {}),
        id: gate.articleId,
        title: gate.version.title,
        content: publicContent,
        showPublicCitationMarkers,
        excerpt: gate.version.excerpt,
        version: gate.version.version,
        category: gate.article.category,
        siteSlug: body.siteSlug || publicationMetadata.siteSlug || siteMetadata.slug || "",
        siteCategory: body.siteCategory || publicationMetadata.siteCategory || siteMetadata.category || gate.article.category || "",
        siteCategoryId: body.siteCategoryId || publicationMetadata.siteCategoryId || siteMetadata.categoryId || "",
        siteCategorySlug: body.siteCategorySlug || publicationMetadata.siteCategorySlug || siteMetadata.categorySlug || "",
        siteAuthor: body.siteAuthor || publicationMetadata.siteAuthor || siteMetadata.author || "",
        siteExcerpt: body.siteExcerpt || publicationMetadata.siteExcerpt || siteMetadata.excerpt || gate.version.excerpt || ""
      }
    }, { actor: principal, requestMetadata: requestMetadata(request, { trustProxy: configured.trustProxy }) });
    return jsonResponse(response, 201, { ok: true, job, contentGate: { ok: true, versionId: gate.versionId } });
  }
  if (request.method === "POST" && parts.length === 4 && parts[1] === "jobs" && parts[3] === "cancel") {
    return jsonResponse(response, 200, { ok: true, job: await publisherStore.cancelJob(parts[2]) });
  }
  if (request.method === "POST" && parts.length === 4 && parts[1] === "jobs" && parts[3] === "verify") {
    const body = await requestJson(request, 20_000);
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.verifyJob(parts[2], body.platform || body.platformId || "", body) });
  }
  const method = request.method || "GET";
  if (method === "GET" && parts.length === 2 && parts[1] === "platforms") {
    return jsonResponse(response, 200, { ok: true, platforms: publisherStore.platforms() });
  }
  if (method === "POST" && parts.length === 2 && parts[1] === "pairings") {
    return jsonResponse(response, 201, { ok: true, pairing: await publisherStore.createPairing() });
  }
  if (method === "POST" && parts.length === 3 && parts[1] === "devices" && parts[2] === "register") {
    return jsonResponse(response, 201, { ok: true, result: await publisherStore.register(await requestJson(request)) });
  }
  if (parts.length >= 3 && parts[1] === "devices") {
    const deviceId = decodeURIComponent(parts[2]);
    const device = publisherStore.state.devices.find((item) => item.id === deviceId);
    if (!device) return jsonResponse(response, 404, { ok: false, message: "发布器设备不存在。" });
    const authenticatedDevice = publisherStore.authenticate(request.headers);
    if (authenticatedDevice.id !== device.id) return jsonResponse(response, 403, { ok: false, message: "设备身份与请求目标不一致。" });
    if (parts[3] === "heartbeat" && method === "POST") {
      return jsonResponse(response, 200, { ok: true, status: await publisherStore.heartbeat(device, await requestJson(request)) });
    }
    if (parts[3] === "disconnect" && method === "POST") {
      const body = await requestJson(request, 20_000);
      return jsonResponse(response, 200, { ok: true, status: await publisherStore.disconnect(device, body.reason) });
    }
    if (parts[3] === "sessions" && method === "GET") {
      return jsonResponse(response, 200, { ok: true, sessions: await publisherStore.sessions(device) });
    }
    if (parts[3] === "sessions" && method === "POST") {
      return jsonResponse(response, 200, { ok: true, session: await publisherStore.updateSession(device, await requestJson(request)) });
    }
  }
  return jsonResponse(response, 404, { ok: false, message: "发布器接口不存在。" });
}

async function handlePublisherWorkerApi(request, response, parts) {
  await publisherStore.load();
  const device = publisherStore.authenticate(request.headers);
  if (request.method === "GET" && parts[1] === "jobs") {
    const query = new URL(request.url || "/", "http://localhost").searchParams;
    return jsonResponse(response, 200, { ok: true, data: { items: await publisherStore.jobs(device, query.get("limit")) } });
  }
  if (parts[1] === "jobs" && parts[2] && parts[3] === "claim" && request.method === "POST") {
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.claimJob(device, parts[2]) });
  }
  if (parts[1] === "jobs" && parts[2] && parts[3] === "result" && request.method === "POST") {
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.result(device, parts[2], await requestJson(request)) });
  }
  if (parts[1] === "jobs" && parts[2] && parts[3] === "verify" && request.method === "POST") {
    const body = await requestJson(request, 20_000);
    return jsonResponse(response, 200, { ok: true, data: await publisherStore.verifyJob(parts[2], body.platform || body.platformId || "", body) });
  }
  return jsonResponse(response, 404, { ok: false, message: "发布器任务接口不存在。" });
}

async function handleAiProviderApi(request, response, parts) {
  await aiProviderStore.load();
  const method = request.method || "GET";
  if (method === "GET" && parts.length === 3) {
    return jsonResponse(response, 200, { ok: true, providers: aiProviderStore.list() });
  }
  if (method === "POST" && parts.length === 3) {
    const provider = await aiProviderStore.create(await requestJson(request));
    return jsonResponse(response, 201, { ok: true, provider });
  }
  if (parts.length === 4) {
    const id = decodeURIComponent(parts[3]);
    if (method === "PATCH") {
      const provider = await aiProviderStore.update(id, await requestJson(request));
      return jsonResponse(response, 200, { ok: true, provider });
    }
    if (method === "DELETE") {
      const provider = await aiProviderStore.remove(id);
      return jsonResponse(response, 200, { ok: true, provider });
    }
  }
  if (method === "POST" && parts.length === 5 && parts[4] === "test") {
    const result = await aiGenerationService.testProvider(decodeURIComponent(parts[3]));
    return jsonResponse(response, 200, { ok: true, result });
  }
  return jsonResponse(response, 404, { ok: false, message: "AI 供应商接口不存在。" });
}

function relaySecretMasked(secret) {
  const value = String(secret || "");
  if (!value) return "";
  return value.length <= 8 ? `${value.slice(0, 2)}••••${value.slice(-2)}` : `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

function diagnosticRelayConfigView() {
  if (relayEnvironmentConfigured) {
    return {
      ...diagnosticRelayConfigStore.public({ source: "environment" }),
      configured: true,
      source: "environment",
      baseUrl: configured.relayBaseUrl,
      instanceId: configured.relayInstanceId,
      clientId: configured.relayClientId,
      deliveryConsumer: configured.relayDeliveryConsumer || `private-sync:${configured.relayInstanceId}`,
      hasClientSecret: true,
      clientSecretMasked: relaySecretMasked(configured.relayClientSecret)
    };
  }
  return diagnosticRelayConfigStore.public({ source: "ui" });
}

async function handleDiagnosticRelayConfigApi(request, response, parts) {
  await diagnosticRelayConfigStore.load();
  const method = request.method || "GET";
  const nested = parts[3] === "relay" && parts[4] === "config";
  const baseLength = nested ? 5 : 4;
  if (method === "GET" && parts.length === baseLength) {
    await authService.requirePermission(request, PERMISSIONS.WORKSPACE_READ, { requireCsrf: false });
    const config = diagnosticRelayConfigView();
    const relay = diagnosticRelayService.status();
    return jsonResponse(response, 200, { ok: true, data: { ...config, config, relay, status: relay } });
  }
  if (method === "PUT" && parts.length === baseLength) {
    await authService.requirePermission(request, PERMISSIONS.SYSTEM_MANAGE);
    if (relayEnvironmentConfigured) throw new DiagnosticRelayConfigError("当前实例由环境变量接管配置，请修改部署环境中的 TZ_RELAY_* 配置。", 409, "DIAGNOSTIC_RELAY_CONFIG_ENV_MANAGED");
    const config = await diagnosticRelayConfigStore.save(await requestJson(request, 20_000));
    const runtime = reloadDiagnosticRelayClient();
    if (!runtime.ok) throw new DiagnosticRelayConfigError(runtime.message, 422, runtime.code);
    return jsonResponse(response, 200, { ok: true, data: { config: { ...config, source: "ui" }, relay: runtime.status } });
  }
  if (method === "POST" && parts.length === baseLength + 1 && parts[baseLength] === "test") {
    await authService.requirePermission(request, PERMISSIONS.SYSTEM_MANAGE);
    const runtime = reloadDiagnosticRelayClient();
    if (!runtime.ok || !diagnosticRelayService.configured()) {
      const message = runtime.message || "请先完整填写中转服务地址、实例 ID、Client ID 和 Client Secret。";
      const config = await diagnosticRelayConfigStore.recordTest("failed", message, { code: runtime.code || "RELAY_CLIENT_NOT_CONFIGURED" });
      return jsonResponse(response, 200, { ok: true, data: { config: { ...config, source: relayEnvironmentConfigured ? "environment" : "ui" }, relay: diagnosticRelayService.status(), test: { status: "failed", message, code: runtime.code || "RELAY_CLIENT_NOT_CONFIGURED" } } });
    }
    try {
      const capabilities = await diagnosticRelayService.capabilities();
      const capabilityItems = Array.isArray(capabilities?.items) ? capabilities.items : Array.isArray(capabilities?.capabilities) ? capabilities.capabilities : [];
      const details = { capabilityCount: capabilityItems.length, capabilities: capabilityItems.slice(0, 100) };
      const config = await diagnosticRelayConfigStore.recordTest("passed", "连接成功，已读取中转服务能力。", details);
      return jsonResponse(response, 200, { ok: true, data: { config: diagnosticRelayConfigView(), relay: diagnosticRelayService.status(), test: { status: "passed", message: "连接成功，已读取中转服务能力。", details } } });
    } catch (error) {
      const message = error.message || "连接中转服务失败。";
      const config = await diagnosticRelayConfigStore.recordTest("failed", message, { code: error.code || "RELAY_TEST_FAILED" });
      return jsonResponse(response, 200, { ok: true, data: { config: { ...config, source: relayEnvironmentConfigured ? "environment" : "ui" }, relay: diagnosticRelayService.status(), test: { status: "failed", message, code: error.code || "RELAY_TEST_FAILED" } } });
    }
  }
  return jsonResponse(response, 404, { ok: false, code: "DIAGNOSTIC_RELAY_CONFIG_ROUTE_NOT_FOUND", message: "AI 效果检测服务配置接口不存在。" });
}

async function persistGeneratedArticle(payload, generated, ragResult, principal, request) {
  const workspaceId = "default";
  const requestedArticleId = String(payload.contentArticleId || payload.articleId || payload.article?.id || "").trim();
  const requestedTaskId = String(payload.contentTaskId || payload.taskId || "").trim();
  const title = String(generated.article?.title || payload.topic?.coreQuestion || payload.topic?.title || "未命名文章").trim();
  let task = null;
  if (requestedTaskId) {
    try { task = contentStore.task(workspaceId, requestedTaskId); } catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; }
  }
  if (!task) {
    task = contentStore.upsertTask({ workspaceId, id: requestedTaskId || undefined, planId: payload.planId || payload.contentPlanId || null, topicId: payload.topic?.id || payload.topicId || null, businessLineId: payload.businessLine?.id || payload.businessLineId || null, title, dueAt: payload.dueAt || payload.expectedCompletionAt || null, status: "generating", metadata: { source: "ai-generation", localArticleId: requestedArticleId || null }, actor: principal, request });
  } else {
    task = contentStore.upsertTask({ workspaceId, id: task.id, planId: payload.planId || payload.contentPlanId || undefined, topicId: payload.topic?.id || payload.topicId || undefined, businessLineId: payload.businessLine?.id || payload.businessLineId || undefined, title, dueAt: payload.dueAt || payload.expectedCompletionAt || undefined, metadata: { ...task.metadata, source: "ai-generation", localArticleId: task.metadata?.localArticleId || requestedArticleId || null }, actor: principal, request });
  }
  let article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true }) : null;
  if (!article) {
    const articleId = requestedArticleId || `ART-${task.id}`;
    try { article = contentStore.article(workspaceId, articleId, { includeVersion: true }); } catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; }
    if (!article) article = contentStore.upsertArticle({ workspaceId, id: articleId, taskId: task.id, planId: payload.planId || payload.contentPlanId || null, topicId: payload.topic?.id || payload.topicId || null, businessLineId: payload.businessLine?.id || payload.businessLineId || null, title, metadata: { source: "ai-generation", localArticleId: requestedArticleId || articleId }, actor: principal, request });
    else article = contentStore.upsertArticle({ workspaceId, id: article.id, taskId: task.id, planId: payload.planId || payload.contentPlanId || undefined, topicId: payload.topic?.id || payload.topicId || undefined, businessLineId: payload.businessLine?.id || payload.businessLineId || undefined, title, actor: principal, request });
  }
  const existingJob = payload.idempotencyKey ? contentStore.generationJobByIdempotency(workspaceId, payload.idempotencyKey) : null;
  const job = existingJob || contentStore.createGenerationJob({ workspaceId, articleId: article.id, taskId: task.id, operation: "article", idempotencyKey: payload.idempotencyKey || null, providerId: payload.providerId || null, model: payload.model || null, promptVersion: "geo-article-v1", retrievalRunId: ragResult?.runId || null, requestPayload: { topic: payload.topic || null, contentType: payload.contentType || "", agentId: payload.agentId || payload.writerAgentId || null, useRag: payload.useRag === true || payload.rag?.enabled === true }, actor: principal, request });
  // A browser retry can receive the same idempotent job after the response was
  // interrupted. Do not append another immutable article version in that case.
  if (job.status === "succeeded" && job.result?.versionId) {
    const existingVersion = contentStore.version(workspaceId, job.result.versionId, { includeContent: true, includeEvidence: true });
    const existingArticle = contentStore.article(workspaceId, article.id, { includeVersion: true, includeEvidence: true });
    return { task: contentStore.task(workspaceId, task.id), article: existingArticle, version: existingVersion, generationJob: job };
  }
  if (existingJob && ["running", "queued"].includes(job.status)) {
    throw new ContentStateError("An identical article generation is already running.", "CONTENT_GENERATION_IN_PROGRESS");
  }
  if (existingJob?.status === "failed") throw new ContentStateError("The previous identical article generation failed; use a new idempotency key to retry.", "CONTENT_GENERATION_RETRY_KEY_REQUIRED");
  contentStore.updateGenerationJob({ workspaceId, jobId: job.id, status: "running", actor: principal, request });
  try {
    const generatedResult = generated;
    const evidence = generatedResult.article?.citations?.length ? generatedResult.article.citations : (Array.isArray(payload.approvedEvidence) ? payload.approvedEvidence : []);
    const version = contentStore.createVersion({ workspaceId, articleId: article.id, expectedRevision: article.revision, baseVersionId: article.currentVersionId || null, title: generatedResult.article?.title || title, contentHtml: generatedResult.article?.html || generatedResult.article?.content || generatedResult.content || "", contentText: generatedResult.article?.contentText || "", excerpt: generatedResult.article?.summary || "", source: "ai", generationJobId: job.id, metadata: { model: generatedResult.article?.model || generatedResult.model || payload.model || null, generationRunId: generatedResult.generationRunId || generatedResult.runId || null, rag: ragResult ? { runId: ragResult.runId, resultCount: ragResult.results?.length || 0, libraryIds: Array.isArray(payload.rag?.libraryIds) ? payload.rag.libraryIds : [], businessLineId: payload.rag?.businessLineId || payload.businessLine?.id || null, embeddingModel: ragResult.embeddingModel || null, embeddingProviderId: ragResult.embeddingProviderId || null, embeddingSource: ragResult.embeddingSource || null } : null }, evidence, actor: principal, request });
    const updatedJob = contentStore.updateGenerationJob({ workspaceId, jobId: job.id, status: "succeeded", result: { versionId: version.id, title: version.title }, inputTokens: generatedResult.usage?.promptTokens || generatedResult.article?.usage?.promptTokens || 0, outputTokens: generatedResult.usage?.completionTokens || generatedResult.article?.usage?.completionTokens || 0, actor: principal, request });
    const currentArticle = contentStore.article(workspaceId, article.id, { includeVersion: true, includeEvidence: true });
    return { task: contentStore.task(workspaceId, task.id), article: currentArticle, version, generationJob: updatedJob };
  } catch (error) {
    try { contentStore.updateGenerationJob({ workspaceId, jobId: job.id, status: "failed", errorCode: error.code || "CONTENT_GENERATION_PERSIST_FAILED", errorMessage: error.message, actor: principal, request }); } catch { /* preserve original error */ }
    throw error;
  }
}

async function handleAiGenerationApi(request, response, parts, principal) {
  if (parts.length !== 4) {
    return jsonResponse(response, 404, { ok: false, code: "GENERATION_ROUTE_NOT_FOUND", message: "AI 生成接口不存在。" });
  }
  if (request.method !== "POST") {
    return jsonResponse(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "AI 生成接口只接受 POST 请求。" });
  }
  const payload = await requestJson(request);
  const operation = parts[3];
  let ragResult = null;
  if ((payload.useRag === true || payload.rag?.enabled === true) && ["article", "topics"].includes(operation)) {
    const query = payload.rag?.query || payload.topic?.coreQuestion || payload.topic?.title || payload.topicBrief?.coreQuestion || "";
    if (String(query).trim()) {
      ragResult = await knowledgeStore.retrieve({
        workspaceId: "default",
        query,
        businessLineId: payload.rag?.businessLineId || payload.businessLine?.id || "",
        libraryIds: payload.rag?.libraryIds || [],
        topK: payload.rag?.topK || 8,
        minScore: payload.rag?.minScore ?? 0.08,
        providerId: payload.rag?.embeddingProviderId || "",
        // The public content-generation endpoint never exposes internal-only
        // enterprise records, even if a browser payload attempts to opt in.
        includeInternal: false
      });
      if (ragResult.evidence?.length) {
        // Browser-side compatibility evidence can contain stale/local IDs.
        // Only server-retrieved references are promoted to approved evidence.
        payload.approvedEvidence = ragResult.evidence;
      }
    }
  }
  if (operation === "article") {
    const suppliedEvidence = Array.isArray(payload.approvedEvidence) ? payload.approvedEvidence : Array.isArray(payload.evidence) ? payload.evidence : [];
    if (suppliedEvidence.length) {
      const validated = knowledgeStore.validateEvidenceReferences({ workspaceId: "default", evidence: suppliedEvidence, allowInternal: false });
      payload.approvedEvidence = validated.items.filter((item) => item.referenceType === "knowledge");
      if (!payload.approvedEvidence.length) throw new KnowledgeError("Article generation requires at least one traceable public enterprise knowledge citation.", 422, "KNOWLEDGE_EVIDENCE_REQUIRED");
      delete payload.evidence;
    }
  }
  if (operation === "questions") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateQuestions(payload) });
  }
  if (operation === "seeds") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateSeeds(payload) });
  }
  if (operation === "topics") {
    return jsonResponse(response, 200, { ok: true, data: await aiGenerationService.generateTopics(payload) });
  }
  if (operation === "article") {
    const articleHint = String(payload.contentArticleId || payload.articleId || payload.article?.id || "").trim();
    const taskHint = String(payload.contentTaskId || payload.taskId || "").trim();
    const generated = await aiGenerationService.generateArticle(payload);
    if (ragResult) generated.rag = { runId: ragResult.runId, embeddingModel: ragResult.embeddingModel, embeddingSource: ragResult.embeddingSource, resultCount: ragResult.results.length, knowledgeGap: ragResult.knowledgeGap };
    const persisted = await persistGeneratedArticle({ ...payload, contentArticleId: articleHint, contentTaskId: taskHint }, generated, ragResult, principal, request);
    const data = { ...generated, contentTaskId: persisted.task.id, contentArticleId: persisted.article.id, articleVersionId: persisted.version.id, revision: persisted.article.revision, contentArticle: persisted.article, contentVersion: persisted.version, generationJob: persisted.generationJob };
    data.article = { ...(generated.article || {}), contentTaskId: data.contentTaskId, contentArticleId: data.contentArticleId, articleVersionId: data.articleVersionId, revision: data.revision };
    return jsonResponse(response, 200, { ok: true, data });
  }
  return jsonResponse(response, 404, { ok: false, code: "GENERATION_ROUTE_NOT_FOUND", message: "AI 生成接口不存在。" });
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(root, requested);
  return resolved.startsWith(path.resolve(root)) ? resolved : null;
}

const server = http.createServer(async (request, response) => {
  const id = requestId(request);
  const startedAt = Date.now();
  applySecurityHeaders(response, id);
  response.on("finish", () => productionLogger.info("http.request", {
    requestId: id,
    method: request.method,
    path: new URL(request.url || "/", "http://localhost").pathname,
    status: response.statusCode,
    durationMs: Date.now() - startedAt
  }));
  try {
    const parts = routeParts(request);
    const method = request.method || "GET";

    if ((parts[0] === "health" && ["live", "ready"].includes(parts[1])) || (parts[0] === "api" && parts[1] === "health")) {
      if (parts[1] === "live") return jsonResponse(response, 200, { ok: true, status: "alive", timestamp: new Date().toISOString() });
      try {
        database.connection.prepare("SELECT 1 AS ready").get();
        await Promise.all([aiProviderStore.load(), publisherStore.load()]);
        return jsonResponse(response, 200, {
          ok: true,
          status: "ready",
          database: "ready",
          citationResearch: citationResearchStore ? citationResearchStore.health() : { ok: false, state: "not_ready" },
          citationResearchDocuments: researchDocumentStore ? researchDocumentStore.health() : { ok: false, state: "not_ready" },
          diagnosticAnalysis: diagnosticAnalysisEngine ? "ready" : "not_ready",
          liveEffectReport: liveEffectReportEngine ? "ready" : "not_ready",
          analysisWorkbench: analysisWorkbenchEngine ? "ready" : "not_ready",
          // Health probes are public in a private deployment; do not expose
          // the relay URL, instance ID, or client ID here. The authenticated
          // diagnostics relay/status endpoint returns the full operator view.
          diagnosticRelay: diagnosticRelayService.health(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        productionLogger.error("health.not_ready", { requestId: id, error: error.message });
        return jsonResponse(response, 503, { ok: false, status: "not_ready", message: "生产数据服务尚未就绪。" });
      }
    }

    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "auth") return await handleAuthApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "workspace") return await handleWorkspaceApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "diagnostics" && (parts[3] === "relay-config" || (parts[3] === "relay" && parts[4] === "config"))) return await handleDiagnosticRelayConfigApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "site-cms") return await handleSiteCmsApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "users") return await handleUsersApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "audit" && method === "GET") return await handleAuditApi(request, response);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "citation-package-updates") {
      const principal = await authService.requirePermission(request, method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.SYSTEM_MANAGE, { requireCsrf: method === "GET" ? false : undefined });
      return await citationPackageUpdateApi(request, { json: (status, payload) => {
        if (method !== "GET" && status < 400) {
          const update = payload?.data?.update || {};
          database.connection.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(principal?.userId || null, `citation.package.${parts[3] || "update"}`, "research_package", update.current?.version || update.candidate?.id || null, JSON.stringify({ currentVersion: update.current?.version || null, candidateId: update.candidate?.id || null, lifecycle: update.candidate?.lifecycle || null }), String(request.headers?.["x-forwarded-for"] || request.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 200) || null, String(request.headers?.["user-agent"] || "").slice(0, 500) || null, new Date().toISOString());
        }
        return jsonResponse(response, status, payload);
      } }, parts, principal);
    }
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "citation-document-updates") {
      const principal = await authService.requirePermission(request, method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.SYSTEM_MANAGE, { requireCsrf: method === "GET" ? false : undefined });
      return await citationDocumentUpdateApi(request, { json: (status, payload) => {
        if (method !== "GET" && status < 400) {
          const update = payload?.data?.update || {};
          if (["activate", "rollback"].includes(parts[3])) {
            try {
              payload.data.runtimeDocuments = { ok: true, health: reloadActiveResearchDocuments() };
            } catch (error) {
              productionLogger.error("citation_document_update.runtime_reload_failed", { code: error.code || "CITATION_DOCUMENT_RELOAD_FAILED", error: error.message });
              payload.data.runtimeDocuments = { ok: false, restartRequired: true, code: error.code || "CITATION_DOCUMENT_RELOAD_FAILED" };
            }
          }
          database.connection.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(principal?.userId || null, `citation.documents.${parts[3] || "update"}`, "research_documents", update.current?.sourceCommit || update.candidate?.id || null, JSON.stringify({ currentCommit: update.current?.sourceCommit || null, candidateId: update.candidate?.id || null, lifecycle: update.candidate?.lifecycle || null, runtimeReloaded: payload.data.runtimeDocuments?.ok ?? null }), String(request.headers?.["x-forwarded-for"] || request.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 200) || null, String(request.headers?.["user-agent"] || "").slice(0, 500) || null, new Date().toISOString());
        }
        return jsonResponse(response, status, payload);
      } }, parts, principal);
    }
    if (parts.length === 5 && parts[0] === "api" && parts[1] === "v1" && parts[2] === "diagnostics" && parts[3] === "relay" && parts[4] === "ad-hoc-runs" && method === "POST") {
      const principal = requireAdHocDiagnosticServiceApi(request, { token: configured.adHocDiagnosticApiToken });
      return await diagnosticApi(request, { json: (status, payload) => jsonResponse(response, status, payload) }, parts, principal);
    }
    if (parts[0] === "api" && parts[1] === "v1" && ["diagnostics", "research-packages"].includes(parts[2])) {
      const principal = await authService.requirePermission(request, method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.WORKSPACE_WRITE, { requireCsrf: method === "GET" ? false : undefined });
      return await diagnosticApi(request, { json: (status, payload) => jsonResponse(response, status, payload) }, parts, principal);
    }
    if (parts[0] === "api" && parts[1] === "v1" && ["analysis-sessions", "analysis-runs", "analysis-plans"].includes(parts[2])) {
      const permission = method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.CONTENT_GENERATE;
      const principal = await authService.requirePermission(request, permission, { requireCsrf: method === "GET" ? false : undefined });
      return await analysisWorkbenchApi(request, { json: (status, payload) => jsonResponse(response, status, payload) }, parts, principal);
    }
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "monitoring") return await handleMonitoringApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "knowledge") return await handleKnowledgeApi(request, response, parts);
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "content-assets") {
      const principal = await authService.requirePermission(request, method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.CONTENT_PUBLISH, { requireCsrf: method === "GET" ? false : undefined });
      return await contentAssetApi(request, { json: (status, payload) => jsonResponse(response, status, payload) }, parts, principal);
    }
    if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "content") {
      const isRiskScan = method !== "GET" && parts[5] === "risk-scan";
      const permission = method === "GET" ? PERMISSIONS.WORKSPACE_READ
        : ["approve", "request-changes"].includes(parts[5]) ? PERMISSIONS.CONTENT_REVIEW
          : ["publish", "unpublish"].includes(parts[5]) ? PERMISSIONS.CONTENT_PUBLISH
            : isRiskScan ? [PERMISSIONS.CONTENT_GENERATE, PERMISSIONS.CONTENT_REVIEW]
              : PERMISSIONS.CONTENT_GENERATE;
      const principal = await authService.requirePermission(request, permission, { any: isRiskScan, requireCsrf: method === "GET" ? false : undefined });
      return await contentApi(request, { json: (status, payload) => jsonResponse(response, status, payload) }, parts, principal);
    }

    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "providers") {
      const permission = method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.MODELS_MANAGE;
      await authService.requirePermission(request, permission, { requireCsrf: method === "GET" ? false : undefined });
      return await handleAiProviderApi(request, response, parts);
    }
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "generate") {
      const principal = await authService.requirePermission(request, PERMISSIONS.CONTENT_GENERATE);
      return await handleAiGenerationApi(request, response, parts, principal);
    }
    if (parts[0] === "api" && ((parts[1] === "v1" && parts[2] === "publisher") || parts[1] === "publisher")) {
      const isV1 = parts[1] === "v1";
      const publisherParts = isV1 ? parts.slice(2) : parts.slice(1);
      if (isV1 && publisherParts[1] === "jobs") return await handlePublisherWorkerApi(request, response, publisherParts);
      const deviceSelfService = publisherParts[1] === "devices";
      const principal = deviceSelfService ? null : await authService.requirePermission(request, method === "GET" ? PERMISSIONS.WORKSPACE_READ : PERMISSIONS.CONTENT_PUBLISH, { requireCsrf: method === "GET" ? false : undefined });
      return await handlePublisherApi(request, response, publisherParts, principal);
    }

    if (parts[0] === "api") return jsonResponse(response, 404, { ok: false, code: "API_ROUTE_NOT_FOUND", message: "接口不存在。" });

    if (!["GET", "HEAD"].includes(method)) {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    let filePath = safePath(request.url || "/");
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    let fileInfo;
    try {
      fileInfo = await stat(filePath);
      if (fileInfo.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        fileInfo = await stat(filePath);
      }
    } catch {
      if (isPublisherDownload(filePath)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      filePath = path.join(root, "index.html");
      fileInfo = await stat(filePath);
    }

    if (path.resolve(filePath) === path.resolve(root, "index.html")) {
      const html = (await readFile(filePath, "utf8"))
        .replace("__TZ_PUBLISHER_DOWNLOAD_URL__", escapeHtmlAttribute(publisherDownloadUrl()));
      const body = Buffer.from(html, "utf8");
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store"
      });
      if (method === "HEAD") response.end();
      else response.end(body);
      return;
    }

    streamStaticFile(request, response, filePath, fileInfo);
  } catch (error) {
    const isApi = routeParts(request)[0] === "api" || routeParts(request)[0] === "health";
    const status = error instanceof WorkspaceConflictError ? 409
      : error instanceof PublisherError ? Number(error.status || 400)
      : error instanceof KnowledgeError ? Number(error.status || 422)
      : error instanceof ContentError ? Number(error.status || 422)
      : error instanceof ContentAssetError ? Number(error.status || 422)
      : error instanceof MonitoringError ? Number(error.status || 422)
      : error instanceof DiagnosticError || error instanceof DiagnosticAnalysisError ? Number(error.status || 422)
      : error instanceof AnalysisWorkbenchError ? Number(error.status || 422)
      : error instanceof CitationPackageUpdateError ? Number(error.status || 422)
      : error instanceof CitationDocumentUpdateError ? Number(error.status || 422)
      : error instanceof SiteCmsError ? Number(error.status || 422)
      : error instanceof DiagnosticRelayConfigError ? Number(error.status || 422)
      : error instanceof AuthError || error instanceof AiProviderError || error instanceof AiGenerationError ? Number(error.status || 500)
        : Number(error.status || 500);
    const code = error.code || (error instanceof WorkspaceConflictError ? "WORKSPACE_CONFLICT" : status === 413 ? "REQUEST_TOO_LARGE" : "INTERNAL_ERROR");
    productionLogger.error("http.error", { requestId: id, status, code, error: error.message, method: request.method, path: request.url });
    if (response.headersSent) return response.end();
    if (isApi) return jsonResponse(response, status, { ok: false, code, message: status >= 500 && !(error instanceof AiGenerationError) ? "服务器处理请求失败，请查看服务日志。" : error.message, ...(error.details ? { details: error.details } : {}) });
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status >= 500 ? "Server error" : error.message);
  }
});

const embeddedSiteRuntime = configured.environment === "development" && process.env.TZ_SITE_EMBED !== "false"
  ? createSiteRuntime({ database, host: configured.host, port: Number(process.env.TZ_SITE_PORT) || 19080, workspaceId: "default" })
  : null;
if (embeddedSiteRuntime) {
  embeddedSiteRuntime.listen().then((address) => {
    productionLogger.info("official_site.embedded_started", { host: embeddedSiteRuntime.config.host, port: address?.port || embeddedSiteRuntime.config.port });
  }).catch((error) => {
    productionLogger.error("official_site.embedded_failed", { code: error.code || "SITE_START_FAILED", error: error.message });
  });
}
server.listen(port, configured.host, () => {
  productionLogger.info("server.started", { environment: configured.environment, host: configured.host, port, database: configured.databasePath });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    productionLogger.info("server.stopping", { signal });
    server.close(() => {
      clearInterval(knowledgeWorkerTimer);
      clearTimeout(publisherSchedulerStartupTimer);
      clearInterval(publisherSchedulerTimer);
      clearTimeout(diagnosticRelayPullStartupTimer);
      clearInterval(diagnosticRelayPullTimer);
      clearTimeout(brandMonitoringSchedulerStartupTimer);
      clearInterval(brandMonitoringSchedulerTimer);
      clearTimeout(contentAssetPatrolStartupTimer);
      clearInterval(contentAssetPatrolTimer);
      clearTimeout(citationUpdateStartupTimer);
      clearInterval(citationUpdateTimer);
      if (embeddedSiteRuntime) void embeddedSiteRuntime.close();
      citationResearchStore?.close();
      researchDocumentStore?.close();
      database.close();
      process.exit(0);
    });
  });
}
