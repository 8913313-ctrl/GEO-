
async function productionApi(path, options = {}) {
  const request = window.tzFetch || window.fetch.bind(window);
  const response = await request(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok || body.ok === false) {
    const error = new Error(body.message || `生产数据接口请求失败（${response.status}）`);
    error.status = response.status;
    error.code = body.code || `HTTP_${response.status}`;
    error.body = body;
    throw error;
  }
  return body;
}

function siteCmsApiPayload(payload = {}) {
  const data = payload?.data || payload || {};
  const draft = data.draft || data.siteCms?.draft || null;
  const publication = data.publication || data.published || data.siteCms?.publication || null;
  const releaseRows = data.releases?.items || data.releases || data.siteCms?.releases || [];
  const leads = data.leads?.items || data.leads || [];
  return {
    draft,
    publication,
    siteBaseUrl: String(data.siteBaseUrl || "").trim(),
    releases: Array.isArray(releaseRows) ? releaseRows : [],
    leads: Array.isArray(leads) ? leads : []
  };
}

function applySiteCmsApiPayload(payload, { replaceDraft = true } = {}) {
  const parsed = siteCmsApiPayload(payload);
  if (parsed.siteBaseUrl && state.site) state.site.baseUrl = parsed.siteBaseUrl;
  if (parsed.draft) {
    siteCmsRuntime.draft = parsed.draft;
    if (replaceDraft && parsed.draft.snapshot) {
      state.site.cms = cloneData(parsed.draft.snapshot);
      const officialDomain = parsed.draft.snapshot.settings?.officialDomain;
      if (officialDomain) state.site.domain = officialDomain;
      siteCmsRuntime.lastSnapshotJson = JSON.stringify(state.site.cms);
      siteCmsRuntime.localDirty = false;
    }
  }
  if (parsed.publication) siteCmsRuntime.publication = parsed.publication;
  if (parsed.releases.length || payload?.data?.releases || payload?.releases) siteCmsRuntime.releases = parsed.releases;
  if (parsed.leads.length || payload?.data?.leads || payload?.leads) siteCmsRuntime.leads = parsed.leads;
  siteCmsRuntime.loaded = Boolean(siteCmsRuntime.draft && siteCmsRuntime.publication);
  siteCmsRuntime.error = "";
  return parsed;
}

async function refreshSiteCmsFromServer({ renderAfter = false } = {}) {
  if (siteCmsRuntime.loading) return siteCmsRuntime;
  siteCmsRuntime.loading = true;
  try {
    applySiteCmsApiPayload(await productionApi("/api/v1/site-cms"));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (renderAfter) render();
    return siteCmsRuntime;
  } catch (error) {
    siteCmsRuntime.error = error.message || "官网 CMS 加载失败";
    throw error;
  } finally {
    siteCmsRuntime.loading = false;
  }
}

async function commitSiteCmsDraft({ silent = false } = {}) {
  if (!siteCmsRuntime.loaded) await refreshSiteCmsFromServer();
  const operation = async () => {
    const sourceJson = JSON.stringify(state.site.cms || {});
    if (!siteCmsRuntime.localDirty && sourceJson === siteCmsRuntime.lastSnapshotJson) return siteCmsRuntime.draft;
    siteCmsRuntime.saving = true;
    if (currentRoute() === "site") render();
    try {
      const payload = await productionApi("/api/v1/site-cms/draft", {
        method: "PUT",
        body: { expectedRevision: siteCmsRuntime.draft?.revision, cms: cloneData(state.site.cms) }
      });
      const parsed = siteCmsApiPayload(payload);
      if (!parsed.draft) throw new Error("官网 CMS 未返回草稿版本");
      siteCmsRuntime.draft = parsed.draft;
      const currentJson = JSON.stringify(state.site.cms || {});
      if (currentJson === sourceJson && parsed.draft.snapshot) {
        state.site.cms = cloneData(parsed.draft.snapshot);
        siteCmsRuntime.lastSnapshotJson = JSON.stringify(state.site.cms);
        siteCmsRuntime.localDirty = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        siteCmsRuntime.lastSnapshotJson = JSON.stringify(parsed.draft.snapshot || {});
        siteCmsRuntime.localDirty = true;
        queueSiteCmsDraftSync();
      }
      siteCmsRuntime.error = "";
      return parsed.draft;
    } catch (error) {
      siteCmsRuntime.error = error.message || "官网草稿保存失败";
      if (error.status === 409) {
        await refreshSiteCmsFromServer({ renderAfter: true }).catch(() => {});
        if (!silent) showToast("官网草稿已由其他成员更新", "已加载服务器上的最新草稿，请重新进行刚才的修改。", "warning");
      } else if (!silent) {
        showToast("官网草稿保存失败", siteCmsRuntime.error, "error");
      }
      throw error;
    } finally {
      siteCmsRuntime.saving = false;
      if (currentRoute() === "site") render();
    }
  };
  siteCmsSyncChain = siteCmsSyncChain.then(operation, operation);
  return siteCmsSyncChain;
}

function queueSiteCmsDraftSync() {
  if (!siteCmsRuntime.loaded) return;
  window.clearTimeout(siteCmsSyncTimer);
  siteCmsSyncTimer = window.setTimeout(() => { commitSiteCmsDraft({ silent: true }).catch(() => {}); }, 500);
}

async function flushSiteCmsDraftSync() {
  window.clearTimeout(siteCmsSyncTimer);
  await siteCmsSyncChain.catch(() => {});
  return commitSiteCmsDraft();
}

// Content production is persisted independently from the browser workspace.  The
// compatibility UI still keeps its local snapshot, but every article operation
// mirrors the current immutable version to the content API when it is available.
function contentApiRecord(payload, key = "") {
  const data = payload?.data;
  if (key && data?.[key]) return data[key];
  if (key && payload?.[key]) return payload[key];
  if (data?.item) return data.item;
  return data || payload || {};
}

function contentApiTask(payload) {
  const record = contentApiRecord(payload, "task");
  return record?.task || record || null;
}

function contentApiVersion(payload) {
  const record = contentApiRecord(payload, "version");
  // `data.version` is already the version record. Returning its numeric
  // `version` field dropped contentVersionId after every successful sync.
  if (record?.id && (record.articleId || record.versionNumber !== undefined || record.version !== undefined)) return record;
  return record?.version && typeof record.version === "object" ? record.version : record?.currentVersion || null;
}

function contentApiArticle(payload) {
  const record = contentApiRecord(payload, "article");
  return record?.article || record?.contentArticle || (record?.id && record?.title ? record : null);
}

function contentApiPlan(payload) {
  const record = contentApiRecord(payload, "plan");
  return record?.plan || (record?.id && record?.name ? record : null);
}

function contentEvidencePayload(article) {
  return articleCitations(article).map((citation, index) => ({
    ordinal: index,
    marker: citation.marker || `K${index + 1}`,
    knowledgeLibraryId: citation.knowledgeBaseId || citation.baseId || null,
    knowledgeDocumentId: citation.itemId || citation.knowledgeItemId || null,
    knowledgeVersionId: citation.versionId || citation.knowledgeVersionId || null,
    knowledgeChunkId: citation.chunkId || citation.knowledgeChunkId || null,
    claim: citation.claim || "",
    quote: citation.quote || "",
    supportStatus: citation.supportStatus || "supported"
  }));
}

function contentPlainText(article) {
  return studioPlainText(article?.content || "");
}

function contentDraftSignature(article) {
  if (!article) return "";
  const source = JSON.stringify({
    localVersion: article.version || "",
    title: article.title || "",
    contentHtml: article.content || "",
    contentText: contentPlainText(article),
    excerpt: article.excerpt || "",
    showPublicCitationMarkers: article.showPublicCitationMarkers === true,
    planId: article.contentPlanId || article.planId || null,
    topicId: article.topicId || null,
    evidence: contentEvidencePayload(article).map((item) => ({
      marker: item.marker,
      knowledgeLibraryId: item.knowledgeLibraryId,
      knowledgeDocumentId: item.knowledgeDocumentId,
      knowledgeVersionId: item.knowledgeVersionId,
      knowledgeChunkId: item.knowledgeChunkId,
      claim: item.claim,
      quote: item.quote,
      supportStatus: item.supportStatus
    }))
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function contentVersionMatchesDraft(article, version) {
  if (!article || !version?.id) return false;
  if (String(version.title || "") !== String(article.title || "")) return false;
  if (studioPlainText(version.contentHtml || version.contentText || "") !== contentPlainText(article)) return false;
  if (Boolean(version.metadata?.showPublicCitationMarkers) !== (article.showPublicCitationMarkers === true)) return false;
  if (!Array.isArray(version.evidence)) return true;
  const localEvidence = contentEvidencePayload(article);
  if (version.evidence.length !== localEvidence.length) return false;
  return version.evidence.every((remote, index) => {
    const local = localEvidence[index] || {};
    return String(remote.marker || "") === String(local.marker || "")
      && String(remote.knowledgeLibraryId || "") === String(local.knowledgeLibraryId || "")
      && String(remote.knowledgeDocumentId || "") === String(local.knowledgeDocumentId || "")
      && String(remote.knowledgeVersionId || "") === String(local.knowledgeVersionId || "")
      && String(remote.knowledgeChunkId || "") === String(local.knowledgeChunkId || "")
      && String(remote.claim || "") === String(local.claim || "")
      && String(remote.quote || "") === String(local.quote || "")
      && String(remote.supportStatus || "supported") === String(local.supportStatus || "supported");
  });
}

function formalPlanStatus(plan) {
  return ({ generating: "active", produced: "active" })[plan?.status] || (["draft", "planned", "active", "completed", "cancelled", "archived"].includes(plan?.status) ? plan.status : "planned");
}

function contentPlanServerPayload(plan) {
  return {
    id: plan.contentPlanId || plan.id,
    businessLineId: plan.businessLineId || null,
    name: String(plan.name || `计划 ${String(plan.id || "").slice(0, 8)}`),
    contentType: plan.contentType || "",
    status: formalPlanStatus(plan),
    scheduledFor: plan.scheduledFor || null,
    dueAt: plan.scheduledFor || null,
    expectedCompletionAt: plan.scheduledFor || null,
    metadata: {
      localPlanId: plan.id,
      ownerName: plan.owner || "",
      topicIds: contentPlanTopicIds(plan),
      topicSnapshots: (plan.topicSnapshots || []).filter(Boolean).map((topic) => cloneData(topic)),
      writingAgentId: plan.writingAgentId || null,
      writingAgentVersion: plan.writingAgentVersion || null,
      writingAgentSnapshot: plan.writingAgentSnapshot || null,
      writingHints: plan.writingHints || null,
      knowledgeScope: normalizeKnowledgeScope(plan),
      localCreatedAt: plan.createdAt || null,
      localUpdatedAt: plan.updatedAt || null
    }
  };
}

function applyContentPlanServerSnapshot(plan, payload = {}) {
  const remote = contentApiPlan(payload);
  if (!plan || !remote?.id) return null;
  plan.contentPlanId = remote.id;
  plan.contentPlanRevision = Number(remote.revision || 0);
  plan.contentPlanSyncedAt = Date.now();
  plan.contentPlanSyncError = "";
  return remote;
}

const contentPlanSyncLocks = new Map();

async function syncContentPlan(plan) {
  if (!plan) throw new Error("内容计划不存在");
  const key = plan.id || plan.contentPlanId;
  if (key && contentPlanSyncLocks.has(key)) return contentPlanSyncLocks.get(key);
  const operation = (async () => {
    const payload = await productionApi("/api/v1/content/plans", { method: "POST", body: contentPlanServerPayload(plan) });
    const remote = applyContentPlanServerSnapshot(plan, payload);
    if (!remote?.id) throw new Error("正式内容计划接口未返回 planId");
    (state.articles || []).filter((article) => article.planId === plan.id).forEach((article) => { article.contentPlanId = remote.id; });
    return remote;
  })();
  if (!key) return operation;
  contentPlanSyncLocks.set(key, operation);
  try { return await operation; } finally { contentPlanSyncLocks.delete(key); }
}

let formalContentMigrationPromise = null;

// Content migration runs in the background after the first render.  Review
// actions can therefore overlap with a GET that started before the action and
// return an older review snapshot afterwards.  Serialize all formal-content
// reads and workflow mutations per article so an older response cannot roll a
// just-confirmed state back in the editor.
const contentWorkflowLocks = new Map();
const contentEditSyncPromises = new Map();
const contentArticleEditGuards = new Map();

function contentWorkflowKey(article) {
  return article?.id || article?.contentArticleId || article?.contentTaskId || "";
}

function contentArticleGuardFor(articleOrId) {
  const key = typeof articleOrId === "string" ? articleOrId : contentWorkflowKey(articleOrId);
  return key ? contentArticleEditGuards.get(key) || null : null;
}

function markContentArticleEditPending(article) {
  const key = contentWorkflowKey(article);
  if (!key || !article) return null;
  const existing = contentArticleEditGuards.get(key) || {};
  const guard = {
    ...existing,
    articleId: article.id || key,
    snapshot: cloneData(article),
    pending: true,
    startedAt: existing.startedAt || Date.now()
  };
  contentArticleEditGuards.set(key, guard);
  return guard;
}

function updateContentArticleEditGuard(article, { pending } = {}) {
  const key = contentWorkflowKey(article);
  if (!key) return null;
  const guard = contentArticleEditGuards.get(key);
  if (!guard) return null;
  const current = (state.articles || []).find((item) => item.id === article.id) || article;
  guard.snapshot = cloneData(current);
  if (pending !== undefined) guard.pending = Boolean(pending);
  guard.updatedAt = Date.now();
  return guard;
}

// Review transitions also need a short-lived workspace guard.  The content
// API and the compatibility workspace are persisted independently; a queued
// draft PUT must not replace a just-confirmed review projection after a 409
// conflict reload.
function markContentArticleWorkspacePending(article) {
  const key = contentWorkflowKey(article);
  if (!key || !article) return null;
  const existing = contentArticleGuardFor(key) || {};
  const current = (state.articles || []).find((item) => item.id === article.id) || article;
  const guard = {
    ...existing,
    articleId: article.id || key,
    snapshot: cloneData(current),
    workspacePending: true,
    startedAt: existing.startedAt || Date.now(),
    updatedAt: Date.now()
  };
  contentArticleEditGuards.set(key, guard);
  return guard;
}

function mergeProtectedContentArticles(targetState = state) {
  if (!targetState || !Array.isArray(targetState.articles)) return false;
  let changed = false;
  contentArticleEditGuards.forEach((guard) => {
    if (!guard?.snapshot || (!guard.pending && !guard.workspacePending && !guard.snapshot.contentSyncPending)) return;
    const id = guard.snapshot.id || guard.articleId;
    if (!id) return;
    const current = targetState.articles.find((item) => item.id === id);
    if (current) {
      Object.assign(current, cloneData(guard.snapshot));
      changed = true;
    } else {
      targetState.articles.push(cloneData(guard.snapshot));
      changed = true;
    }
  });
  return changed;
}

function contentArticleWorkspaceMatches(left, right) {
  if (!left || !right) return false;
  return left.id === right.id
    && left.title === right.title
    && left.content === right.content
    && left.excerpt === right.excerpt
    && left.version === right.version
    && left.contentVersionId === right.contentVersionId
    && left.reviewStatus === right.reviewStatus
    && left.reviewStage === right.reviewStage
    && left.status === right.status
    && left.contentStatus === right.contentStatus
    && left.contentTaskStatus === right.contentTaskStatus
    && left.contentRevision === right.contentRevision
    && left.contentTaskRevision === right.contentTaskRevision
    && left.contentVersionNumber === right.contentVersionNumber
    && left.reviewNote === right.reviewNote;
}

function acknowledgeContentArticleWorkspaceSnapshot(snapshotState) {
  const articles = Array.isArray(snapshotState?.articles) ? snapshotState.articles : [];
  contentArticleEditGuards.forEach((guard, key) => {
    if (!guard || guard.pending) return;
    const sent = articles.find((item) => item.id === (guard.snapshot?.id || guard.articleId));
    if (!contentArticleWorkspaceMatches(guard.snapshot, sent)) return;
    if (guard.workspacePending) guard.workspacePending = false;
    if (!guard.workspacePending && !guard.snapshot.contentSyncPending) contentArticleEditGuards.delete(key);
  });
}

async function withContentWorkflowLock(article, operation) {
  const key = contentWorkflowKey(article);
  const previous = key ? contentWorkflowLocks.get(key) : null;
  const run = (previous ? previous.catch(() => null) : Promise.resolve()).then(operation);
  if (!key) return run;
  contentWorkflowLocks.set(key, run);
  try {
    return await run;
  } finally {
    if (contentWorkflowLocks.get(key) === run) contentWorkflowLocks.delete(key);
  }
}

// User edits must share the same per-article queue as migration and review
// actions.  Otherwise a background migration GET can finish after a save and
// re-project the old compatibility snapshot over the freshly edited article.
function queueContentArticleSync(article, options = {}) {
  const key = contentWorkflowKey(article);
  const promise = withContentWorkflowLock(article, () => {
    const current = (state.articles || []).find((item) => item.id === article?.id) || article;
    return syncContentTaskAndVersion(current, options);
  });
  if (key) {
    contentEditSyncPromises.set(key, promise);
    promise.then(
      () => {
        updateContentArticleEditGuard(article, { pending: false });
        if (contentEditSyncPromises.get(key) === promise) contentEditSyncPromises.delete(key);
      },
      () => { if (contentEditSyncPromises.get(key) === promise) contentEditSyncPromises.delete(key); }
    );
  }
  return promise;
}

async function waitForFormalContentMigration() {
  if (formalContentMigrationPromise) await formalContentMigrationPromise.catch(() => null);
}

function contentServerVersionNumber(version) {
  const value = Number(version?.versionNumber ?? version?.version ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function contentServerSnapshotIsOlder(article, task, remoteArticle, version) {
  if (!article) return false;
  const localArticleRevision = Number(article.contentRevision || 0);
  const remoteArticleRevision = Number(remoteArticle?.revision || 0);
  if (localArticleRevision && remoteArticleRevision && remoteArticleRevision < localArticleRevision) return true;
  const localTaskRevision = Number(article.contentTaskRevision || 0);
  const remoteTaskRevision = Number(task?.revision || 0);
  if (localTaskRevision && remoteTaskRevision && remoteTaskRevision < localTaskRevision) return true;
  const localVersionNumber = Number(article.contentVersionNumber || 0);
  const remoteVersionNumber = contentServerVersionNumber(version);
  if (localVersionNumber && remoteVersionNumber && remoteVersionNumber < localVersionNumber) return true;
  const guard = contentArticleGuardFor(article);
  const guardedVersionNumber = contentServerVersionNumber(guard?.snapshot || {});
  if (guardedVersionNumber && remoteVersionNumber && remoteVersionNumber < guardedVersionNumber) return true;
  return false;
}

function shouldProjectContentVersion(article, version, snapshotIsOlder) {
  if (!version?.id || snapshotIsOlder) return false;
  const guard = contentArticleGuardFor(article);
  if (!guard) return true;
  const incomingId = String(version.id || "");
  const guardedId = String(guard.snapshot?.contentVersionId || "");
  const incomingNumber = contentServerVersionNumber(version);
  const guardedNumber = contentServerVersionNumber(guard.snapshot || {});
  // A GET started before the edit commonly returns the exact version that was
  // open when the user began typing. It must never replace the editor draft.
  if (guard.pending && (!incomingId || incomingId === guardedId)) return false;
  // A newer immutable version is the acknowledgement of the edit and is safe
  // to project into the compatibility article.
  if (guard.pending && incomingNumber && guardedNumber && incomingNumber <= guardedNumber) return false;
  return !guard.pending || Boolean(incomingNumber > guardedNumber || incomingId !== guardedId);
}

async function migrateFormalContentRecords() {
  if (formalContentMigrationPromise) return formalContentMigrationPromise;
  if (!currentUserCan("content.generate")) return null;
  formalContentMigrationPromise = (async () => {
    const failures = [];
    for (const plan of (state.contentPlans || [])) {
      try { await syncContentPlan(plan); } catch (error) {
        plan.contentPlanSyncError = error.message || "正式计划同步失败";
        failures.push({ kind: "plan", id: plan.id, message: plan.contentPlanSyncError });
      }
    }
    for (const article of (state.articles || [])) {
      await withContentWorkflowLock(article, async () => {
        const plan = (state.contentPlans || []).find((item) => item.id === article.planId);
        if (plan?.contentPlanId) article.contentPlanId = plan.contentPlanId;
        try {
          if (article.contentArticleId) {
            try {
              const payload = await productionApi(`/api/v1/content/articles/${encodeURIComponent(article.contentArticleId)}`);
              applyContentServerSnapshot(article, payload);
              if (plan?.contentPlanId && article.contentTaskPlanId !== plan.contentPlanId) {
                article.contentPlanId = plan.contentPlanId;
                await syncContentTaskAndVersion(article, { createVersion: false });
              }
              return;
            } catch (error) {
              if (error.status !== 404) throw error;
              article.contentTaskId = null;
              article.contentArticleId = null;
              article.contentVersionId = null;
              article.contentRevision = null;
            }
          }
          await syncContentTaskAndVersion(article, { createVersion: Boolean(contentPlainText(article)) });
        } catch (error) {
          article.contentSyncPending = false;
          article.contentSyncError = error.message || "正式文章迁移失败";
          failures.push({ kind: "article", id: article.id, message: article.contentSyncError });
        }
      });
    }
    saveState();
    if (failures.length) console.warn("Formal content migration completed with failures", failures);
    return { plans: (state.contentPlans || []).length, articles: (state.articles || []).length, failures };
  })();
  try { return await formalContentMigrationPromise; } finally { formalContentMigrationPromise = null; }
}

function applyContentServerSnapshot(article, payload = {}) {
  if (!article) return null;
  const task = contentApiTask(payload);
  const remoteArticle = contentApiArticle(payload);
  const version = contentApiVersion(payload);
  const snapshotIsOlder = contentServerSnapshotIsOlder(article, task, remoteArticle, version);
  const acceptRemoteState = !snapshotIsOlder;
  if (task?.id) article.contentTaskId = task.id;
  if (task?.revision !== undefined && (!article.contentTaskRevision || Number(task.revision) >= Number(article.contentTaskRevision))) article.contentTaskRevision = Number(task.revision) || 0;
  if (task?.planId && acceptRemoteState) article.contentPlanId = task.planId;
  if (task && Object.prototype.hasOwnProperty.call(task, "planId") && acceptRemoteState) article.contentTaskPlanId = task.planId || null;
  if (remoteArticle?.id) article.contentArticleId = remoteArticle.id;
  if (remoteArticle?.taskId) article.contentTaskId = remoteArticle.taskId;
  if (remoteArticle?.revision !== undefined && (!article.contentRevision || Number(remoteArticle.revision) >= Number(article.contentRevision))) article.contentRevision = Number(remoteArticle.revision) || 0;
  if (remoteArticle?.planId && acceptRemoteState) article.contentPlanId = remoteArticle.planId;
  if (remoteArticle?.status && acceptRemoteState) article.contentStatus = remoteArticle.status;
  if (remoteArticle?.approvedVersionId !== undefined && acceptRemoteState) article.contentApprovedVersionId = remoteArticle.approvedVersionId || null;
  if (task?.status && acceptRemoteState) article.contentTaskStatus = task.status;
  const publicationMetadata = remoteArticle?.metadata && typeof remoteArticle.metadata === "object" ? remoteArticle.metadata : null;
  if (publicationMetadata) {
    const siteMetadata = publicationMetadata.site && typeof publicationMetadata.site === "object" ? publicationMetadata.site : {};
    if (acceptRemoteState && (publicationMetadata.siteStatus || siteMetadata.status)) article.siteStatus = publicationMetadata.siteStatus || siteMetadata.status;
    if (acceptRemoteState && (publicationMetadata.siteSlug || siteMetadata.slug)) article.siteSlug = publicationMetadata.siteSlug || siteMetadata.slug;
    if (acceptRemoteState && (publicationMetadata.siteCategory || siteMetadata.category)) article.siteCategory = publicationMetadata.siteCategory || siteMetadata.category;
    if (acceptRemoteState && (publicationMetadata.siteCategoryId || siteMetadata.categoryId)) article.siteCategoryId = publicationMetadata.siteCategoryId || siteMetadata.categoryId;
    if (acceptRemoteState && (publicationMetadata.siteCategorySlug || siteMetadata.categorySlug)) article.siteCategorySlug = publicationMetadata.siteCategorySlug || siteMetadata.categorySlug;
    if (acceptRemoteState && (publicationMetadata.siteAuthor || siteMetadata.author)) article.siteAuthor = publicationMetadata.siteAuthor || siteMetadata.author;
    if (acceptRemoteState && (publicationMetadata.siteExcerpt || siteMetadata.excerpt)) article.siteExcerpt = publicationMetadata.siteExcerpt || siteMetadata.excerpt;
    if (acceptRemoteState && (publicationMetadata.sitePublishedAt || siteMetadata.publishedAt)) article.sitePublishedAt = publicationMetadata.sitePublishedAt || siteMetadata.publishedAt;
    if (acceptRemoteState && (publicationMetadata.siteUnpublishedAt || siteMetadata.unpublishedAt)) article.siteUnpublishedAt = publicationMetadata.siteUnpublishedAt || siteMetadata.unpublishedAt;
    if (acceptRemoteState && Object.prototype.hasOwnProperty.call(publicationMetadata, "showPublicCitationMarkers")) article.showPublicCitationMarkers = publicationMetadata.showPublicCitationMarkers === true;
  }
  const currentVersion = version || remoteArticle?.currentVersion || task?.currentVersion;
  const projectVersionBody = shouldProjectContentVersion(article, currentVersion, snapshotIsOlder);
  if (projectVersionBody) {
    if (currentVersion.title) article.title = String(currentVersion.title);
    if (typeof currentVersion.contentHtml === "string") article.content = sanitizeStudioHtml(stripArticleRiskHighlights(currentVersion.contentHtml));
    if (typeof currentVersion.excerpt === "string") article.excerpt = currentVersion.excerpt;
  }
  if (currentVersion?.id && (acceptRemoteState || projectVersionBody)) article.contentVersionId = currentVersion.id;
  if (currentVersion?.metadata && Object.prototype.hasOwnProperty.call(currentVersion.metadata, "showPublicCitationMarkers") && (acceptRemoteState || projectVersionBody)) article.showPublicCitationMarkers = currentVersion.metadata.showPublicCitationMarkers === true;
  if ((currentVersion?.versionNumber !== undefined || currentVersion?.version !== undefined) && (acceptRemoteState || projectVersionBody)) {
    article.contentVersionNumber = Number(currentVersion.versionNumber ?? currentVersion.version) || 0;
  }
  if (currentVersion?.reviewStatus && (acceptRemoteState || projectVersionBody)) {
    const reviewStatus = currentVersion.reviewStatus;
    article.reviewStatus = reviewStatus === "approved" ? "approved" : "pending";
    article.reviewStage = reviewStatus === "pending" ? "manual_review" : reviewStatus === "changes_requested" ? "revision_requested" : reviewStatus === "approved" ? "ready_to_publish" : "draft";
    const reviews = Array.isArray(currentVersion.reviews) ? currentVersion.reviews : [];
    const actorLabel = (review) => {
      const actorId = review?.actorUserId || "";
      const member = (state.settings?.members || []).find((item) => item.id === actorId);
      return review?.details?.actorName || member?.name || (window.__TZ_AUTH__?.user?.id === actorId ? currentUserName() : "") || "审核人员";
    };
    const submittedReview = [...reviews].reverse().find((review) => review.action === "submitted");
    const completedReview = [...reviews].reverse().find((review) => review.action === "changes_requested" || review.action === "approved");
    if (reviewStatus === "draft") {
      article.reviewSubmittedAt = null;
      article.reviewSubmittedBy = null;
      article.reviewNote = "";
      article.reviewedAt = null;
      article.reviewedBy = null;
    } else {
      if (submittedReview) {
        article.reviewSubmittedAt = submittedReview.createdAt || article.reviewSubmittedAt || null;
        article.reviewSubmittedBy = actorLabel(submittedReview);
      }
      if (reviewStatus === "pending") {
        article.reviewNote = "";
        article.reviewedAt = null;
        article.reviewedBy = null;
      } else if (completedReview) {
        article.reviewNote = reviewStatus === "changes_requested" ? completedReview.note || "" : "";
        article.reviewedAt = completedReview.createdAt || null;
        article.reviewedBy = actorLabel(completedReview);
      }
    }
    if (reviewStatus === "changes_requested") {
      article.contentStatus = "changes_requested";
      article.contentTaskStatus = "changes_requested";
    }
    const workspace = (state.writingWorkspaces || []).find((item) => item.articleId === article.id);
    if (workspace) {
      workspace.status = reviewStatus === "changes_requested" ? "revision" : reviewStatus === "pending" ? "review" : reviewStatus === "approved" ? "approved" : "draft";
    }
  }
  if (currentVersion?.riskStatus) {
    article.riskStatus = currentVersion.riskStatus === "passed" ? "clean" : currentVersion.riskStatus === "not_scanned" ? "unscanned" : currentVersion.riskStatus;
  }
  if (currentVersion?.frozenAt) article.knowledgeSnapshot = { ...(article.knowledgeSnapshot || {}), frozenAt: currentVersion.frozenAt };
  if (contentVersionMatchesDraft(article, currentVersion)) {
    article.contentSyncedSignature = contentDraftSignature(article);
    article.contentSyncedLocalVersion = article.version || null;
  }
  article.contentServerSnapshotAt = Date.now();
  return { task, article: remoteArticle, version: currentVersion };
}

async function ensureContentPublishSnapshot(article) {
  if (!article) throw new Error("文章不存在");
  await waitForContentSync(article);
  if (!article.contentArticleId || !article.contentVersionId) await syncContentTaskAndVersion(article, { createVersion: Boolean(contentPlainText(article)) });
  const remoteArticleId = article.contentArticleId;
  if (!remoteArticleId) throw new Error("文章尚未进入正式内容数据库");
  const payload = await productionApi(`/api/v1/content/articles/${encodeURIComponent(remoteArticleId)}`);
  applyContentServerSnapshot(article, payload);
  return article;
}

async function contentPublisherPayload(article) {
  await ensureContentPublishSnapshot(article);
  const articleId = article.contentArticleId;
  const versionId = article.contentApprovedVersionId || article.contentVersionId;
  if (!articleId || !versionId) throw new Error("正式文章或审核版本不存在，请先完成服务端人工审核");
  return {
    articleId,
    contentArticleId: articleId,
    versionId,
    contentVersionId: versionId,
    localArticleId: article.id,
    articleTitle: article.title,
    version: article.version,
    contentVersionNumber: article.contentVersionNumber || null,
    showPublicCitationMarkers: article.showPublicCitationMarkers === true,
    article: { id: articleId, localArticleId: article.id, title: article.title, version: article.version, contentVersionNumber: article.contentVersionNumber || null, versionId, excerpt: article.excerpt, content: article.content, showPublicCitationMarkers: article.showPublicCitationMarkers === true }
  };
}

const contentSyncLocks = new Map();

async function performContentTaskAndVersionSync(article, { createVersion = false, force = false } = {}) {
  if (!article) return null;
  let payload;
  const localPlan = (state.contentPlans || []).find((plan) => plan.id === article.planId || plan.contentPlanId === article.contentPlanId) || null;
  if (localPlan) {
    await syncContentPlan(localPlan);
    article.contentPlanId = localPlan.contentPlanId || localPlan.id;
  }
  let taskId = article.contentTaskId;
  if (!taskId || (article.contentPlanId || null) !== (article.contentTaskPlanId || null)) {
    payload = await productionApi("/api/v1/content/tasks", {
      method: "POST",
      body: {
        id: taskId || `TASK-${article.id}`,
        articleId: article.contentArticleId || article.id,
        planId: article.contentPlanId || null,
        contentPlanId: article.contentPlanId || null,
        topicId: article.topicId || null,
        businessLineId: article.businessLineId || null,
        title: article.title,
        status: "draft",
        metadata: { localArticleId: article.id, localPlanId: article.planId || null, version: article.version, category: article.category || "", showPublicCitationMarkers: article.showPublicCitationMarkers === true }
      }
    });
    const task = contentApiTask(payload);
    taskId = task?.id || task?.taskId;
    if (!taskId) throw new Error("内容任务接口未返回 taskId");
    applyContentServerSnapshot(article, payload);
  }
  const hasVersion = Boolean(article.contentVersionId);
  const hasContent = Boolean(contentPlainText(article));
  const draftSignature = contentDraftSignature(article);
  const needsVersion = !hasVersion || force || (createVersion && article.contentSyncedSignature !== draftSignature);
  if (needsVersion && hasContent) {
    const localVersion = article.version || null;
    const versionBody = {
      articleId: article.contentArticleId || article.id,
      articleLocalId: article.id,
      planId: article.contentPlanId || null,
      contentPlanId: article.contentPlanId || null,
      expectedRevision: article.contentRevision === undefined ? undefined : article.contentRevision,
      baseVersionId: article.contentVersionId || null,
      title: article.title,
      contentHtml: article.content || "",
      contentText: contentPlainText(article),
      excerpt: article.excerpt || "",
      source: article.generationSnapshot ? "ai" : "human",
      metadata: { localArticleId: article.id, localVersion, topicId: article.topicId || null, localPlanId: article.planId || null, contentPlanId: article.contentPlanId || null, showPublicCitationMarkers: article.showPublicCitationMarkers === true },
      evidence: contentEvidencePayload(article)
    };
    const versionPayload = await productionApi(`/api/v1/content/tasks/${encodeURIComponent(taskId)}/versions`, {
      method: "POST",
      body: versionBody
    });
    applyContentServerSnapshot(article, versionPayload);
    article.contentSyncedSignature = draftSignature;
    article.contentSyncedLocalVersion = localVersion;
    payload = versionPayload;
  }
  article.contentSyncPending = article.contentSyncedSignature !== contentDraftSignature(article);
  article.contentSyncError = "";
  saveState();
  return payload;
}

async function syncContentTaskAndVersion(article, options = {}) {
  if (!article) return null;
  const key = article.id || article.contentArticleId || article.contentTaskId;
  const previous = key ? contentSyncLocks.get(key) : null;
  const promise = (previous ? previous.catch(() => null) : Promise.resolve()).then(() => performContentTaskAndVersionSync(article, options));
  if (!key) return promise;
  contentSyncLocks.set(key, promise);
  try {
    return await promise;
  } finally {
    if (contentSyncLocks.get(key) === promise) contentSyncLocks.delete(key);
  }
}

async function waitForContentSync(article) {
  const key = article?.id || article?.contentArticleId || article?.contentTaskId;
  const editPending = key ? contentEditSyncPromises.get(key) : null;
  if (editPending) await editPending;
  const pending = key ? contentSyncLocks.get(key) : null;
  if (pending) await pending;
  return article;
}

// Workspace persistence is a compatibility layer beside the authoritative
// content API.  A conflict reload can replace the in-memory article while the
// content API save is still succeeding, so verify the saved projection and
// restore it before the explicit workspace flush completes.
async function flushContentArticleWorkspace(article, source = "content-article-save") {
  if (!article) return null;
  const key = contentWorkflowKey(article);
  const guard = contentArticleGuardFor(key);
  const expected = cloneData(guard?.snapshot || (state.articles || []).find((item) => item.id === article.id) || article);
  await flushWorkspaceSyncNow(source);
  let current = (state.articles || []).find((item) => item.id === expected.id);
  const matches = contentArticleWorkspaceMatches(expected, current);
  if (!matches) {
    if (!current) {
      state.articles = [...(state.articles || []), expected];
      current = expected;
    } else {
      Object.assign(current, expected);
    }
    saveState();
    await flushWorkspaceSyncNow(`${source}-retry`);
    current = (state.articles || []).find((item) => item.id === expected.id) || current;
  }
  const latestGuard = contentArticleGuardFor(key);
  if (latestGuard && !latestGuard.pending && contentArticleWorkspaceMatches(latestGuard.snapshot, current)) contentArticleEditGuards.delete(key);
  return current;
}

async function ensureCurrentContentVersion(article) {
  if (!article) throw new Error("文章不存在");
  await waitForContentSync(article);
  const draftSignature = contentDraftSignature(article);
  if (!article.contentVersionId || article.contentSyncedSignature !== draftSignature) {
    article.contentSyncPending = true;
    await syncContentTaskAndVersion(article, { createVersion: true });
    await waitForContentSync(article);
  }
  if (!article.contentTaskId || !article.contentArticleId || !article.contentVersionId) throw new Error("正式文章版本尚未保存");
  if (article.contentSyncedSignature !== contentDraftSignature(article)) throw new Error("正文仍在保存，请稍后重试");
  article.contentSyncPending = false;
  article.contentSyncError = "";
  return article;
}

async function performContentServerAction(article, action, body = {}) {
  if (!article) throw new Error("文章不存在");
  await waitForContentSync(article);
  if (!article.contentTaskId || !article.contentVersionId) await syncContentTaskAndVersion(article, { createVersion: true });
  const path = `/api/v1/content/tasks/${encodeURIComponent(article.contentTaskId)}/${action}`;
  const payload = await productionApi(path, {
    method: "POST",
    body: {
      articleId: article.contentArticleId || article.id,
      versionId: article.contentVersionId,
      expectedRevision: article.contentRevision,
      ...body
    }
  });
  applyContentServerSnapshot(article, payload);
  article.contentSyncError = "";
  saveState();
  return payload;
}

async function contentServerAction(article, action, body = {}) {
  return withContentWorkflowLock(article, () => performContentServerAction(article, action, body));
}

async function performRefreshContentServerSnapshot(article) {
  if (!article) throw new Error("文章不存在");
  await waitForContentSync(article);
  const remoteArticleId = article.contentArticleId || article.id;
  if (!remoteArticleId) throw new Error("正式文章 ID 不存在");
  const articlePayload = await productionApi(`/api/v1/content/articles/${encodeURIComponent(remoteArticleId)}`);
  const articleSnapshot = applyContentServerSnapshot(article, articlePayload) || {};
  let task = articleSnapshot.task || null;
  let taskVersion = articleSnapshot.version || null;
  if (article.contentTaskId) {
    const taskPayload = await productionApi(`/api/v1/content/tasks/${encodeURIComponent(article.contentTaskId)}`);
    task = contentApiTask(taskPayload) || task;
    taskVersion = contentApiVersion(taskPayload) || taskVersion;
    applyContentServerSnapshot(article, taskPayload);
  }
  return {
    article: contentApiArticle(articlePayload) || articleSnapshot.article || null,
    task,
    version: contentApiVersion(articlePayload) || taskVersion || articleSnapshot.version || null
  };
}

async function refreshContentServerSnapshot(article) {
  return withContentWorkflowLock(article, () => performRefreshContentServerSnapshot(article));
}

async function contentServerRiskScan(article, scan) {
  if (!article) return null;
  scan = scan || applyArticleRiskScan(article);
  await ensureCurrentContentVersion(article);
  const payload = await productionApi(`/api/v1/content/tasks/${encodeURIComponent(article.contentTaskId)}/risk-scan`, {
    method: "POST",
    body: {
      articleId: article.contentArticleId || article.id,
      versionId: article.contentVersionId,
      expectedRevision: article.contentRevision,
      status: scan.status === "clean" ? "passed" : scan.status,
      policyVersion: `workspace-${Object.values(scan.ruleVersions || {}).join("-")}`,
      findings: scan.hits || [],
      summary: { hits: scan.hits?.length || 0, localStatus: scan.status },
      completedAt: scan.scannedAt
    }
  });
  applyContentServerSnapshot(article, payload);
  saveState();
  return payload;
}

function serverWorkspacePayload(payload) {
  const value = payload?.data?.workspace || payload?.data || payload?.workspace || payload || {};
  return {
    initialized: Boolean(value.initialized || value.state),
    state: value.state || null,
    revision: Number(value.revision || 0),
    updatedAt: value.updatedAt || value.updated_at || null,
    knowledgeSync: value.knowledgeSync || null
  };
}

async function refreshKnowledgeFromServer() {
  const payload = await productionApi("/api/v1/knowledge/libraries?includeArchived=1");
  const libraries = Array.isArray(payload.data?.items) ? payload.data.items : [];
  if (!libraries.length) return;
  const localBases = new Map((state.knowledgeBases || []).map((base) => [base.id, base]));
  const remoteItems = [];
  for (const remote of libraries) {
    const local = localBases.get(remote.id) || {};
    Object.assign(local, {
      id: remote.id,
      name: remote.name,
      kind: remote.kind,
      scope: remote.scope,
      businessLineId: remote.businessLineId || null,
      description: remote.description || "",
      status: remote.status === "archived" ? "archived" : "ready",
      serverCounts: { documents: remote.documents, approvedVersions: remote.approvedVersions, indexedVersions: remote.indexedVersions },
      updatedAt: remote.updatedAt || local.updatedAt || Date.now(),
      itemIds: Array.isArray(local.itemIds) ? local.itemIds : []
    });
    localBases.set(remote.id, local);
    try {
      const detail = await productionApi(`/api/v1/knowledge/libraries/${encodeURIComponent(remote.id)}`);
      const documents = Array.isArray(detail.data?.documents) ? detail.data.documents : [];
      local.itemIds = documents.map((document) => document.id);
      documents.forEach((document) => {
        const existing = (state.knowledgeItems || []).find((item) => item.id === document.id) || { id: document.id, knowledgeBaseId: remote.id, kind: remote.kind, tags: [], createdAt: Date.now() };
        Object.assign(existing, {
          knowledgeBaseId: remote.id,
          kind: remote.kind,
          title: document.title,
          sourceName: document.sourceName,
          sourceFile: existing.sourceFile || { name: document.sourceName, type: document.mimeType || "text/plain" },
          latestVersionId: document.latestVersionId,
          visibility: document.visibility || existing.visibility || "public",
          status: document.reviewStatus === "approved" ? "approved" : document.status === "archived" ? "archived" : "pending_review",
          importStatus: ["queued", "processing", "pending"].includes(document.extractionStatus) ? "pending_ocr" : "ready",
          updatedAt: document.updatedAt || existing.updatedAt || Date.now()
        });
        if (!(state.knowledgeItems || []).some((item) => item.id === existing.id)) state.knowledgeItems.push(existing);
        const version = (state.knowledgeVersions || []).find((item) => item.id === document.latestVersionId);
        if (version) Object.assign(version, { reviewStatus: document.reviewStatus || version.reviewStatus, indexStatus: document.indexStatus || version.indexStatus, extractionStatus: document.extractionStatus || version.extractionStatus || "complete", extractionMethod: document.extractionMethod || version.extractionMethod || "text", metadata: document.metadata || version.metadata || {} });
        else if (document.latestVersionId) state.knowledgeVersions.push({ id: document.latestVersionId, itemId: document.id, version: document.latestVersion || 1, reviewStatus: document.reviewStatus || "pending_review", indexStatus: document.indexStatus || "not_indexed", extractionStatus: document.extractionStatus || "complete", extractionMethod: document.extractionMethod || "text", metadata: document.metadata || {}, content: "", createdAt: document.createdAt || Date.now() });
        remoteItems.push(existing);
      });
    } catch {
      // Keep the local compatibility snapshot for a library that was just created.
    }
  }
  state.knowledgeBases = [...localBases.values()];
  if (remoteItems.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function refreshKnowledgeAssetsFromServer({ renderAfter = false } = {}) {
  if (knowledgeAssetRuntime.loading) return knowledgeAssetRuntime;
  knowledgeAssetRuntime.loading = true;
  try {
    const payload = await productionApi("/api/v1/knowledge/assets?limit=1000");
    knowledgeAssetRuntime.items = Array.isArray(payload.data?.items) ? payload.data.items : [];
    const serverAssets = knowledgeAssetRuntime.items.filter((asset) => asset.assetType === "image").map((asset) => ({
      id: asset.id,
      serverBackedKnowledgeAsset: true,
      kind: "knowledge_image",
      name: asset.sourceName || "企业知识图片",
      mime: asset.mimeType || "image/*",
      knowledgeBaseId: asset.libraryId || null,
      itemId: asset.documentId || null,
      versionId: asset.versionId || null,
      reviewStatus: "approved",
      license: asset.metadata?.license || "企业资料",
      altText: asset.altText || asset.sourceName || "企业知识图片",
      caption: asset.metadata?.caption || asset.altText || asset.sourceName || "",
      url: `/api/v1/knowledge/assets/${encodeURIComponent(asset.id)}/content`,
      ocrStatus: asset.ocrStatus || "not_required",
      metadata: asset.metadata || {},
      createdAt: asset.createdAt || Date.now(),
      updatedAt: asset.updatedAt || asset.createdAt || Date.now()
    }));
    state.contentAssets = [...(state.contentAssets || []).filter((asset) => !asset.serverBackedKnowledgeAsset), ...serverAssets];
    knowledgeAssetRuntime.loaded = true;
    knowledgeAssetRuntime.error = "";
    if (renderAfter && currentRoute() === "knowledge") render();
    return knowledgeAssetRuntime;
  } catch (error) {
    knowledgeAssetRuntime.error = error.message || "图片资料加载失败";
    throw error;
  } finally {
    knowledgeAssetRuntime.loading = false;
  }
}

async function hydrateWorkspaceFromServer() {
  const payload = serverWorkspacePayload(await productionApi("/api/v1/workspace"));
  if (payload.initialized && payload.state) {
    state = migrateState(payload.state);
    workspaceRevision = payload.revision;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    // A new private deployment must never import stale localStorage from a
    // reused browser profile.  Build the first workspace from a deterministic
    // customer-neutral seed; migrated deliveries arrive with server state and
    // take the initialized branch above.
    state = migrateState(cloneBlankState());
    const imported = serverWorkspacePayload(await productionApi("/api/v1/workspace", { method: "PUT", body: { state, expectedRevision: 0, source: "private-deployment-blank-seed" } }));
    workspaceRevision = imported.revision;
    if (imported.state) state = migrateState(imported.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  workspaceSyncReady = true;
  workspaceChangeCounter = 0;
  return state;
}

async function reloadWorkspaceAfterConflict() {
  const latest = serverWorkspacePayload(await productionApi("/api/v1/workspace"));
  if (!latest.state) return;
  const incomingRevision = Number(latest.revision || 0);
  // Multiple queued writes can observe the same conflict.  Never let a late
  // GET move the client back to an older workspace revision.
  if (incomingRevision < Number(workspaceRevision || 0)) return;
  workspaceSyncReady = false;
  const nextState = migrateState(latest.state);
  const protectedArticles = mergeProtectedContentArticles(nextState);
  state = nextState;
  workspaceRevision = incomingRevision;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  workspaceSyncReady = true;
  if (protectedArticles) {
    workspaceChangeCounter += 1;
    queueWorkspaceSync();
  }
  render();
  showToast("数据已由其他成员更新", protectedArticles ? "已保留当前文章编辑，并继续同步到服务器。" : "已加载服务器上的最新版本，请重新执行刚才的操作。", "warning");
}

function queueWorkspaceSync() {
  if (!workspaceSyncReady) return;
  workspaceChangeCounter += 1;
  window.clearTimeout(workspaceSyncTimer);
  workspaceSyncTimer = window.setTimeout(() => {
    workspaceSyncChain = workspaceSyncChain.then(async () => {
      const changeVersion = workspaceChangeCounter;
      mergeProtectedContentArticles(state);
      const snapshot = cloneData(state);
      try {
        const saved = serverWorkspacePayload(await productionApi("/api/v1/workspace", { method: "PUT", body: { state: snapshot, expectedRevision: workspaceRevision, source: "browser-operation" } }));
        workspaceRevision = saved.revision;
        if (saved.knowledgeSync?.error) throw new Error(saved.knowledgeSync.error);
        acknowledgeContentArticleWorkspaceSnapshot(saved.state || snapshot);
        if (workspaceChangeCounter === changeVersion) workspaceChangeCounter = 0;
      } catch (error) {
        if (error.status === 409) return reloadWorkspaceAfterConflict();
        showToast("服务器保存失败", error.message || "本次修改暂存在当前浏览器，将自动重试。", "error");
        window.setTimeout(queueWorkspaceSync, 2_000);
      }
    });
  }, 250);
}

async function flushWorkspaceSyncNow(source = "browser-explicit-save") {
  if (!workspaceSyncReady) return null;
  window.clearTimeout(workspaceSyncTimer);
  const operation = async () => {
    let conflictAttempts = 0;
    while (true) {
      const changeVersion = workspaceChangeCounter;
      mergeProtectedContentArticles(state);
      const snapshot = cloneData(state);
      try {
        const saved = serverWorkspacePayload(await productionApi("/api/v1/workspace", { method: "PUT", body: { state: snapshot, expectedRevision: workspaceRevision, source } }));
        workspaceRevision = Math.max(Number(workspaceRevision || 0), Number(saved.revision || 0));
        if (saved.knowledgeSync?.error) throw new Error(saved.knowledgeSync.error);
        acknowledgeContentArticleWorkspaceSnapshot(saved.state || snapshot);
        if (workspaceChangeCounter === changeVersion) workspaceChangeCounter = 0;
        return saved;
      } catch (error) {
        if (error.status !== 409 || conflictAttempts >= 2) throw error;
        const latest = serverWorkspacePayload(await productionApi("/api/v1/workspace"));
        if (!latest.state) throw error;
        const nextState = migrateState(latest.state);
        mergeProtectedContentArticles(nextState);
        state = nextState;
        workspaceRevision = Math.max(Number(workspaceRevision || 0), Number(latest.revision || 0));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        workspaceSyncReady = true;
        conflictAttempts += 1;
      }
    }
  };
  workspaceSyncChain = workspaceSyncChain.then(operation, operation);
  return workspaceSyncChain;
}
