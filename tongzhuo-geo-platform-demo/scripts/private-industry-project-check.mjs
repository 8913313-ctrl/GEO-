import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContentStateError, ContentStore } from "../content-store.mjs";
import { requireIndustryTemplate } from "../industry-templates/index.mjs";
import { resolveProjectSeed } from "../project-seeds/index.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { createProductionBackup, restoreProductionBackup, verifyProductionBackup } from "./production-backup-v2.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function request(base, pathname, init = {}) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...init });
  return { response, text: await response.text() };
}

function evidenceFor(prefix, claim) {
  return [{
    marker: "K1",
    knowledgeLibraryId: `KB-${prefix}`,
    knowledgeDocumentId: `DOC-${prefix}`,
    knowledgeVersionId: `DOCV-${prefix}`,
    knowledgeChunkId: `CHUNK-${prefix}`,
    claim,
    quote: claim,
    supportStatus: "supported"
  }];
}

function backupOptions(root, databasePath, key) {
  const dataDir = path.join(root, `${key}-data`);
  return {
    config: { dataDir, databasePath, backupDir: path.join(dataDir, "backups") },
    env: {
      TZ_DATA_DIR: dataDir,
      TZ_DATABASE_PATH: databasePath,
      TZ_BACKUP_DIR: path.join(dataDir, "backups"),
      TZ_DEPLOY_CONFIG_DIR: path.join(root, `${key}-deploy`),
      TZ_SITE_STATIC_ROOT: path.join(root, `${key}-site`)
    }
  };
}

export async function checkPrivateIndustryProject(spec) {
  const root = await mkdtemp(path.join(os.tmpdir(), `geo-${spec.seedKey}-project-`));
  const databasePath = path.join(root, `${spec.seedKey}.sqlite`);
  let database;
  let runtime;
  try {
    const seed = resolveProjectSeed(spec.seedKey);
    assert.ok(seed, `${spec.seedKey} must be a registered project seed`);
    assert.deepEqual(
      { projectId: seed.projectId, tenantId: seed.tenantId, industryTemplate: seed.industryTemplate, demo: seed.demo },
      { projectId: spec.projectId, tenantId: spec.tenantId, industryTemplate: spec.industryTemplate, demo: true }
    );
    assert.equal(new URL(seed.companyProfile.officialDomain).hostname, spec.officialDomain);

    const industry = requireIndustryTemplate(seed.industryTemplate);
    assert.equal(industry.templateKey, spec.industryTemplate);
    for (const field of spec.requiredIndustryFields) assert.ok(industry.requiredFields.includes(field), `industry template must require ${field}`);
    for (const group of spec.requiredQuestionGroups) assert.ok(industry.defaultQuestionGroups.some((item) => item.key === group), `industry template must seed question group ${group}`);
    for (const contentType of spec.requiredContentTypes) assert.ok(industry.contentTypes.includes(contentType), `industry template must support ${contentType}`);
    assert.doesNotMatch(JSON.stringify(industry), spec.forbiddenIdentity, "industry adaptation must contain no customer identity or facts");

    database = new ProductionDatabase({ databasePath });
    runtime = createSiteRuntime({
      database,
      workspaceId: seed.tenantId,
      projectId: seed.projectId,
      projectSeedKey: seed.key,
      staticRoot: root,
      host: "127.0.0.1",
      port: 0,
      baseUrl: `https://${spec.officialDomain}`,
      flushIntervalMs: 60_000,
      logger: { info() {}, warn() {}, error() {} }
    });
    const address = await runtime.listen(0);
    const base = `http://127.0.0.1:${address.port}`;

    const cmsStore = new SiteCmsStore(database, { workspaceId: seed.tenantId, projectSeedKey: seed.key });
    const publication = cmsStore.publication();
    const draft = cmsStore.draft();
    assert.equal(publication.checksum, draft.checksum, "new customer initialization must create matching draft and public snapshots");
    assert.equal(publication.snapshot.settings.companyName, spec.companyName);
    assert.equal(publication.snapshot.theme.key, spec.themeKey);
    for (const serviceId of spec.serviceIds) assert.ok(publication.snapshot.services.some((item) => item.id === serviceId), `new project must include service ${serviceId}`);
    for (const questionSlug of spec.questionSlugs) {
      assert.ok(publication.snapshot.problemGroups.some((group) => group.questions?.some((question) => question.slug === questionSlug)), `new project must include question ${questionSlug}`);
    }
    assert.doesNotMatch(JSON.stringify(publication.snapshot), spec.forbiddenIdentity, "customer CMS must not inherit another customer's identity");

    const publicSnapshot = new PublicSiteStore({ database, workspaceId: seed.tenantId, projectSeedKey: seed.key }).snapshot();
    assert.equal(publicSnapshot.site.projectId, seed.projectId);
    assert.equal(publicSnapshot.site.tenantId, seed.tenantId);
    assert.equal(publicSnapshot.site.industryTemplate, seed.industryTemplate);
    assert.equal(publicSnapshot.site.officialDomain, spec.officialDomain);
    const pages = ["/", "/services/", "/cases/", "/about/", "/problem-map/", "/contact/", `/problem-map/${spec.questionSlugs[0]}/`, "/sitemap.xml", "/llms.txt", "/llms-full.txt"];
    let rendered = "";
    for (const pathname of pages) {
      const result = await request(base, pathname);
      assert.equal(result.response.status, 200, `${spec.seedKey} public page must render: ${pathname}`);
      rendered += result.text;
    }
    for (const expected of spec.publicIdentity) assert.match(rendered, new RegExp(escaped(expected)), `public runtime is missing ${expected}`);
    assert.match(rendered, /演示内容，非客户案例/, "demo project must state its public evidence boundary");
    assert.doesNotMatch(rendered, spec.forbiddenIdentity, "public runtime must not expose another customer's identity");

    const leadPayload = { ...spec.lead, source_url: "/contact/" };
    const acceptedLead = await request(base, "/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `${spec.seedKey}-project-check-0001` },
      body: JSON.stringify(leadPayload)
    });
    assert.equal(acceptedLead.response.status, 201, "customer lead must be accepted by its own runtime");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get(seed.tenantId, seed.projectId).count, 1);
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id != ? OR project_id != ?").get(seed.tenantId, seed.projectId).count, 0, "lead storage must contain only this private project");

    const timestamp = new Date().toISOString();
    database.connection.prepare("INSERT INTO knowledge_libraries (id, workspace_id, name, kind, scope, description, status, created_at, updated_at) VALUES (?, ?, ?, 'document', 'enterprise', ?, 'active', ?, ?)")
      .run(`KB-${spec.articlePrefix}`, seed.tenantId, `${spec.companyName} 企业知识库`, spec.evidenceClaim, timestamp, timestamp);
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id = ?").get(seed.tenantId).count, 1, "new customer knowledge must be stored in its own workspace");

    const evidence = evidenceFor(spec.articlePrefix, spec.evidenceClaim);
    const content = new ContentStore(database, {
      workspaceId: seed.tenantId,
      requireEvidence: true,
      evidenceValidator(items, context) {
        assert.equal(context.allowInternal, false, "public content must reject internal-only evidence");
        assert.equal(items.length, 1);
        return { valid: true, count: items.length, items };
      }
    });
    const plan = content.createPlan({ id: `PLAN-${spec.articlePrefix}`, name: spec.planName, businessLineId: spec.businessLineId, metadata: { industryTemplate: spec.industryTemplate } });
    const task = content.createTask({ id: `TASK-${spec.articlePrefix}`, planId: plan.id, title: spec.articleTitle, businessLineId: spec.businessLineId });
    const article = content.createArticle({ id: `ART-${spec.articlePrefix}`, taskId: task.id, planId: plan.id, businessLineId: spec.businessLineId, title: spec.articleTitle, category: spec.articleCategory, contentHtml: spec.articleHtml, evidence });
    const version = article.currentVersion;
    assert.equal(content.canPublish(article.id, version.id).code, "CONTENT_REVIEW_REQUIRED", "draft content must not bypass review");
    assert.throws(
      () => content.approveAndFreeze({ articleId: article.id, versionId: version.id, expectedRevision: article.revision }),
      (error) => error instanceof ContentStateError && error.code === "CONTENT_INVALID_STATE",
      "draft content must not be directly approved"
    );
    content.recordRiskScan({ articleId: article.id, versionId: version.id, status: "passed", policyVersion: "private-industry-project-v1", findings: [], summary: { score: 100 } });
    const pending = content.submitReview({ articleId: article.id, versionId: version.id, expectedRevision: content.article(seed.tenantId, article.id).revision });
    assert.equal(pending.reviewStatus, "pending");
    assert.equal(content.canPublish(article.id, version.id).code, "CONTENT_REVIEW_REQUIRED", "pending content must not be public");
    const approved = content.approveAndFreeze({ articleId: article.id, versionId: version.id, expectedRevision: content.article(seed.tenantId, article.id).revision });
    assert.equal(approved.reviewStatus, "approved");
    assert.ok(approved.frozenAt);
    assert.equal(content.canPublish(article.id, version.id).ok, true);
    const published = content.publish({
      articleId: article.id,
      versionId: version.id,
      expectedRevision: content.article(seed.tenantId, article.id).revision,
      category: spec.articleCategory,
      metadata: { siteSlug: spec.articleSlug, siteAuthor: spec.companyName, siteExcerpt: spec.articleExcerpt }
    });
    assert.equal(published.article.status, "published");
    assert.equal(content.task(seed.tenantId, task.id).status, "completed");

    const articlePage = await request(base, `/insights/${spec.articleSlug}/`);
    assert.equal(articlePage.response.status, 200, "approved and published content must appear on the customer website");
    assert.match(articlePage.text, new RegExp(escaped(spec.articleTitle)));
    assert.doesNotMatch(articlePage.text, spec.forbiddenIdentity);
    assert.equal(new PublicSiteStore({ database, workspaceId: seed.tenantId, projectSeedKey: seed.key }).snapshot().articles.length, 1);
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM publication_tasks WHERE tenant_id != ?").get(seed.tenantId).count, 0, "publication task storage must not contain another tenant");

    await runtime.close();
    runtime = null;
    database.checkpoint("TRUNCATE");
    const backupDir = path.join(root, `${spec.seedKey}-backup`);
    const backup = backupOptions(root, databasePath, spec.seedKey);
    const created = await createProductionBackup({ ...backup, projectRoot, targetDir: backupDir, backupId: `CHECK-${spec.articlePrefix}` });
    assert.equal((await verifyProductionBackup(created.targetDir)).format, "tongzhuo-private-backup-v2");
    database.connection.prepare("DELETE FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").run(seed.tenantId, seed.projectId);
    database.connection.prepare("UPDATE content_articles SET status = 'approved' WHERE workspace_id = ?").run(seed.tenantId);
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles WHERE workspace_id = ? AND status = 'published'").get(seed.tenantId).count, 0, "the pre-restore mutation must remove public article status");
    database.checkpoint("TRUNCATE");
    database.close();
    database = null;
    await restoreProductionBackup({ ...backup, projectRoot, sourceDir: created.targetDir, force: true, skipSafetySnapshot: true });
    database = new ProductionDatabase({ databasePath });
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id = ? AND project_id = ?").get(seed.tenantId, seed.projectId).count, 1, "the customer lead must survive its own backup restore");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles WHERE workspace_id = ? AND status = 'published'").get(seed.tenantId).count, 1, "published customer content must survive its own backup restore");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id = ?").get(seed.tenantId).count, 1, "customer knowledge must survive its own backup restore");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM site_contact_leads WHERE tenant_id != ? OR project_id != ?").get(seed.tenantId, seed.projectId).count, 0, "restore must not introduce another customer project");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM content_articles WHERE workspace_id != ?").get(seed.tenantId).count, 0, "restore must not introduce another customer's content");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM knowledge_libraries WHERE workspace_id != ?").get(seed.tenantId).count, 0, "restore must not introduce another customer's knowledge");
    assert.equal(database.connection.prepare("SELECT COUNT(*) AS count FROM publication_tasks WHERE tenant_id != ?").get(seed.tenantId).count, 0, "restore must not introduce another customer's publication tasks");

    console.log(`${spec.seedKey}: initialization, industry adaptation, question seeds, review/publish gates, website identity, lead isolation and backup/restore checks passed.`);
  } finally {
    if (runtime) await runtime.close();
    database?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  }
}
