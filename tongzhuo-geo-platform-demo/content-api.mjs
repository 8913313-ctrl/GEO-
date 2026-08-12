import { ContentError } from "./content-store.mjs";
import { requireIndustryTemplate } from "./industry-templates/index.mjs";

function idFrom(body = {}) { return String(body.contentArticleId || body.articleId || body.article?.id || "").trim(); }
function versionIdFrom(body = {}) { return String(body.contentVersionId || body.articleVersionId || body.versionId || "").trim(); }
function jsonBody(body = {}) { return body && typeof body === "object" ? body : {}; }
function articleInput(body = {}) {
  const article = jsonBody(body.article);
  return {
    id: idFrom(body) || String(article.id || "").trim(),
    title: String(body.title || body.articleTitle || article.title || body.topic?.coreQuestion || body.topic?.title || "未命名文章").trim(),
    category: String(body.category || article.category || body.contentType || "").trim(),
    contentHtml: String(body.contentHtml || body.content || article.contentHtml || article.content || ""),
    contentText: String(body.contentText || article.contentText || ""),
    excerpt: String(body.excerpt || article.excerpt || ""),
    source: String(body.source || article.source || "human"),
    taskId: String(body.contentTaskId || body.taskId || "").trim() || null,
    planId: String(body.planId || body.contentPlanId || article.planId || "").trim() || null,
    topicId: String(body.topicId || body.topic?.id || article.topicId || "").trim() || null,
    businessLineId: String(body.businessLineId || body.businessLine?.id || article.businessLineId || "").trim() || null,
    metadata: body.metadata || article.metadata || {},
    evidence: body.evidence || body.approvedEvidence || article.evidence || article.citations || []
  };
}
function taskInput(body = {}, article = {}) {
  return {
    id: String(body.contentTaskId || body.taskId || body.id || "").trim() || undefined,
    planId: String(body.planId || body.contentPlanId || article.planId || "").trim() || null,
    topicId: String(body.topicId || body.topic?.id || article.topicId || "").trim() || null,
    businessLineId: String(body.businessLineId || body.businessLine?.id || article.businessLineId || "").trim() || null,
    title: String(body.taskTitle || body.title || body.articleTitle || article.title || body.topic?.coreQuestion || body.topic?.title || "未命名文章").trim(),
    dueAt: body.dueAt || body.expectedCompletionAt || null,
    status: String(body.taskStatus || body.status || "planned").trim(),
    metadata: body.taskMetadata || body.metadata || {}
  };
}
function result({ task = null, article = null, version = null, generationJob = null, ...extra } = {}) { return { task, article, version, generationJob, ...extra }; }

function assessRisk(version, requested = {}) {
  const html = String(version?.contentHtml || "");
  // Citation markers are rendered as inert buttons in the editor so users can
  // inspect evidence. They are not executable content and must not be treated
  // as dangerous HTML by the formal risk gate. Keep every other button blocked.
  const htmlForTagScan = html
    .replace(/<button\b(?=[^>]*\bdata-citation-id\s*=)[^>]*>/gi, "<span>")
    .replace(/<\/button>/gi, "</span>");
  const text = String(version?.contentText || "");
  const findings = Array.isArray(requested.findings) ? requested.findings.slice(0, 100) : [];
  const serverFindings = [];
  if (/<\s*(script|iframe|object|embed|form|input|textarea|button|svg|math)\b/i.test(htmlForTagScan)) serverFindings.push({ code: "DANGEROUS_HTML", severity: "blocked", message: "正文包含不允许的高风险 HTML 标签。" });
  if (/\son[a-z]+\s*=|(?:href|src)\s*=\s*["']?\s*(?:javascript|data|vbscript):/i.test(html)) serverFindings.push({ code: "UNSAFE_HTML_ATTRIBUTE", severity: "blocked", message: "正文包含不安全链接或事件属性。" });
  if (text.length < 80) findings.push({ code: "CONTENT_TOO_SHORT", severity: "warning", message: "正文较短，建议人工补充信息。" });
  const all = [...serverFindings, ...findings];
  const severe = all.filter((item) => ["blocked", "block", "critical", "high"].includes(String(item?.severity || item?.level || "").toLowerCase()));
  return { status: severe.length ? "blocked" : all.length ? "warning" : "passed", findings: all, summary: { findingCount: all.length, severeCount: severe.length, contentLength: text.length }, policyVersion: "geo-risk-v1" };
}

export function createContentApi({ contentStore, foundationAssetStore = null, industryTemplate = "", requestJson, configured, onArticlePublished = null }) {
  const workspaceId = String(contentStore.workspaceId || "default");
  const industryTemplateSnapshot = industryTemplate ? requireIndustryTemplate(industryTemplate) : null;
  async function handler(request, response, parts, principal) {
    const method = request.method || "GET";
    if (parts.length === 4 && parts[3] === "plans" && method === "GET") return response.json(200, { ok: true, data: { items: contentStore.listPlans({ workspaceId }) } });
    if (parts.length === 4 && parts[3] === "plans" && method === "POST") {
      // POST is intentionally idempotent for browser-workspace migration. A
      // plan keeps its local stable id while its formal row is provisioned;
      // retrying the request must reconcile the same row instead of creating a
      // second plan.
      const body = await requestJson(request, 100_000);
      if (!foundationAssetStore) throw new ContentError("Foundation asset service is not configured.", 503, "FOUNDATION_SERVICE_UNAVAILABLE");
      const foundationAssets = foundationAssetStore.selectPublishedPlanFoundation({ workspaceId, industryTemplate });
      const metadata = { ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}), industryTemplateSnapshot };
      const plan = contentStore.upsertPlan({ workspaceId, ...body, metadata, foundationAssets, actor: principal, request });
      return response.json(201, { ok: true, data: { plan } });
    }
    if (parts.length === 6 && parts[3] === "plans" && parts[5] === "foundation" && method === "POST") {
      if (!foundationAssetStore) throw new ContentError("Foundation asset service is not configured.", 503, "FOUNDATION_SERVICE_UNAVAILABLE");
      const planId = decodeURIComponent(parts[4]);
      const body = await requestJson(request, 100_000);
      const plan = foundationAssetStore.attachPlanFoundation({
        workspaceId,
        planId,
        industryTemplate: body.industryTemplate || "",
        methodologyVersionId: body.methodologyVersionId,
        promptVersionId: body.promptVersionId,
        qualityRulePackId: body.qualityRulePackId,
        allowUnpublished: false
      }, principal, request);
      return response.json(200, { ok: true, data: { plan: contentStore.plan(workspaceId, plan.id) } });
    }
    if (parts.length === 4 && parts[3] === "tasks" && method === "GET") {
      const query = new URL(request.url || "/", "http://localhost").searchParams;
      return response.json(200, { ok: true, data: { items: contentStore.listTasks({ workspaceId, planId: query.get("planId") || "", status: query.get("status") || "", businessLineId: query.get("businessLineId") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 4 && parts[3] === "tasks" && method === "POST") {
      const body = await requestJson(request, Math.max(configured.requestBodyLimit, 5_000_000));
      const ai = articleInput(body); const ti = taskInput(body, ai);
      let task = null;
      if (ti.id) { try { task = contentStore.task(workspaceId, ti.id); } catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; } }
      if (!task) task = contentStore.upsertTask({ workspaceId, ...ti, actor: principal, request });
      else task = contentStore.upsertTask({ workspaceId, ...ti, id: task.id, actor: principal, request });
      let article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true }) : null;
      if (!article) {
        const articleId = ai.id || `ART-${task.id}`;
        try { article = contentStore.article(workspaceId, articleId, { includeVersion: true }); } catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; }
        article = contentStore.upsertArticle({ workspaceId, ...ai, id: article?.id || articleId, taskId: task.id, planId: ti.planId, topicId: ti.topicId, businessLineId: ti.businessLineId, metadata: { ...(ai.metadata || {}), localArticleId: ai.metadata?.localArticleId || ai.id || articleId }, actor: principal, request });
      } else if (article.taskId !== task.id || article.planId !== ti.planId || article.topicId !== ti.topicId || article.businessLineId !== ti.businessLineId) {
        article = contentStore.upsertArticle({ workspaceId, ...ai, id: article.id, taskId: task.id, planId: ti.planId, topicId: ti.topicId, businessLineId: ti.businessLineId, actor: principal, request });
      }
      return response.json(201, { ok: true, data: result({ task: contentStore.task(workspaceId, task.id), article, version: article.currentVersion || null }) });
    }
    if (parts.length === 5 && parts[3] === "tasks" && method === "GET") {
      const task = contentStore.task(workspaceId, decodeURIComponent(parts[4]));
      const article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true, includeEvidence: true }) : null;
      return response.json(200, { ok: true, data: result({ task, article, version: article?.currentVersion || null, versions: article ? contentStore.listVersions({ workspaceId, articleId: article.id, includeContent: true }) : [] }) });
    }
    if (parts.length === 6 && parts[3] === "tasks" && parts[5] === "versions" && method === "POST") {
      const task = contentStore.task(workspaceId, decodeURIComponent(parts[4])); const body = await requestJson(request, Math.max(configured.requestBodyLimit, 8_000_000));
      const ai = articleInput(body); const articleId = ai.id || task.articleId || `ART-${task.id}`;
      let article; try { article = contentStore.article(workspaceId, articleId, { includeVersion: true }); } catch (error) { if (!(error instanceof ContentError) || error.status !== 404) throw error; }
      if (!article) article = contentStore.createArticle({ workspaceId, id: articleId, taskId: task.id, planId: task.planId, topicId: task.topicId, businessLineId: task.businessLineId, title: body.title || task.title, actor: principal, request });
      const version = contentStore.createVersion({ workspaceId, articleId: article.id, expectedRevision: body.expectedRevision === undefined ? article.revision : body.expectedRevision, baseVersionId: body.baseVersionId || article.currentVersionId || null, title: body.title || article.title, contentHtml: body.contentHtml || body.content || "", contentText: body.contentText || "", excerpt: body.excerpt || "", source: body.source || "human", generationJobId: body.generationJobId || null, metadata: body.metadata || {}, evidence: body.evidence || body.approvedEvidence || [], actor: principal, request });
      article = contentStore.article(workspaceId, article.id, { includeVersion: true });
      return response.json(201, { ok: true, data: result({ task: contentStore.task(workspaceId, task.id), article, version }) });
    }
    if (parts.length === 6 && parts[3] === "tasks" && parts[5] === "risk-scan" && method === "POST") {
      const task = contentStore.task(workspaceId, decodeURIComponent(parts[4])); const body = await requestJson(request, 500_000);
      const article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true }) : null;
      if (!article?.currentVersionId) throw new ContentError("Article version is required before risk scanning.", 422, "CONTENT_VERSION_REQUIRED");
      const version = contentStore.version(workspaceId, article.currentVersionId, { includeContent: true }); const scan = contentStore.recordRiskScan({ workspaceId, articleId: article.id, versionId: version.id, ...assessRisk(version, body), actor: principal, request });
      return response.json(200, { ok: true, data: { task: contentStore.task(workspaceId, task.id), article: contentStore.article(workspaceId, article.id, { includeVersion: true }), version: contentStore.version(workspaceId, version.id, { includeContent: true, includeScans: true }), scan } });
    }
    const reviewAction = parts.length === 6 ? parts[5] : "";
    if (parts.length === 6 && parts[3] === "tasks" && ["submit-review", "request-changes", "approve"].includes(reviewAction) && method === "POST") {
      const task = contentStore.task(workspaceId, decodeURIComponent(parts[4])); const body = await requestJson(request, 200_000);
      const article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true }) : null;
      if (!article?.currentVersionId) throw new ContentError("Article version is required.", 422, "CONTENT_VERSION_REQUIRED");
      const args = { workspaceId, articleId: article.id, versionId: body.versionId || article.currentVersionId, expectedRevision: body.expectedRevision === undefined ? article.revision : body.expectedRevision, note: body.note || "", actor: principal, request };
      if (reviewAction === "submit-review") {
        // Submitting for human review is one user action. If a client-side save
        // created a fresh immutable version immediately before this request, do
        // not make the operator manually run a second scan. Validate that the
        // requested version is still current, then create the missing scan for
        // that exact version using the same server-side safety rules.
        contentStore.assertCurrentVersion(workspaceId, article.id, args.versionId, args.expectedRevision, ["draft", "changes_requested"]);
        const reviewVersion = contentStore.version(workspaceId, args.versionId, { includeContent: true });
        if (!["passed", "warning"].includes(reviewVersion.riskStatus)) {
          const requestedRisk = body.riskScan && typeof body.riskScan === "object" ? body.riskScan : {};
          const assessment = assessRisk(reviewVersion, requestedRisk);
          contentStore.recordRiskScan({
            workspaceId,
            articleId: article.id,
            versionId: reviewVersion.id,
            ...assessment,
            policyVersion: String(requestedRisk.policyVersion || assessment.policyVersion || "geo-risk-v1"),
            completedAt: requestedRisk.completedAt || null,
            actor: principal,
            request
          });
        }
      }
      const version = reviewAction === "submit-review" ? contentStore.submitReview(args) : reviewAction === "request-changes" ? contentStore.requestChanges({ ...args, note: body.note || "请补充修改意见。" }) : contentStore.approveAndFreeze({ ...args, allowNoEvidence: body.allowNoEvidence === true });
      return response.json(200, { ok: true, data: { task: contentStore.task(workspaceId, task.id), article: contentStore.article(workspaceId, article.id, { includeVersion: true }), version } });
    }
    if (parts.length === 6 && parts[3] === "tasks" && parts[5] === "can-publish" && method === "GET") {
      const task = contentStore.task(workspaceId, decodeURIComponent(parts[4])); const article = task.articleId ? contentStore.article(workspaceId, task.articleId, { includeVersion: true }) : null; const query = new URL(request.url || "/", "http://localhost").searchParams;
      return response.json(200, { ok: true, data: article ? contentStore.canPublish(article.id, query.get("versionId") || null, { workspaceId }) : { ok: false, code: "CONTENT_ARTICLE_REQUIRED", reason: "No article is linked to this task." } });
    }
    if (parts.length === 5 && parts[3] === "articles" && method === "GET") {
      const article = contentStore.article(workspaceId, decodeURIComponent(parts[4]), { includeVersion: true, includeEvidence: true });
      return response.json(200, { ok: true, data: { article, versions: contentStore.listVersions({ workspaceId, articleId: article.id, includeContent: true }) } });
    }
    if (parts.length === 6 && parts[3] === "articles" && parts[5] === "can-publish" && method === "GET") {
      const query = new URL(request.url || "/", "http://localhost").searchParams; return response.json(200, { ok: true, data: contentStore.canPublish(decodeURIComponent(parts[4]), query.get("versionId") || null, { workspaceId }) });
    }
    if (parts.length === 6 && parts[3] === "articles" && ["publish", "unpublish"].includes(parts[5]) && method === "POST") {
      const articleId = decodeURIComponent(parts[4]);
      const body = await requestJson(request, 500_000);
      const metadata = jsonBody(body.metadata);
      const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
      const data = parts[5] === "publish"
        ? contentStore.publish({
            workspaceId,
            articleId,
            versionId: body.versionId || null,
            expectedRevision: body.expectedRevision,
            category: body.category || body.siteCategory || "",
            metadata: {
              ...metadata,
              ...(has("slug") || has("siteSlug") ? { siteSlug: body.slug ?? body.siteSlug } : {}),
              ...(has("author") || has("siteAuthor") ? { siteAuthor: body.author ?? body.siteAuthor } : {}),
              ...(has("excerpt") || has("siteExcerpt") ? { siteExcerpt: body.excerpt ?? body.siteExcerpt } : {}),
              ...(has("siteCategoryId") ? { siteCategoryId: body.siteCategoryId } : {}),
              ...(has("siteCategorySlug") ? { siteCategorySlug: body.siteCategorySlug } : {})
            },
            actor: principal,
            request
          })
        : contentStore.unpublish({ workspaceId, articleId, expectedRevision: body.expectedRevision, reason: body.reason || "", actor: principal, request });
      if (parts[5] === "publish" && typeof onArticlePublished === "function") {
        const sync = await onArticlePublished({ article: data.article, principal, request });
        if (sync) data.siteSync = sync;
      }
      return response.json(200, { ok: true, data });
    }
    return response.json(404, { ok: false, code: "CONTENT_ROUTE_NOT_FOUND", message: "内容生产接口不存在。" });
  }
  return handler;
}
