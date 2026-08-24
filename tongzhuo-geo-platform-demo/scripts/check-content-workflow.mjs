import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { ContentConflictError, ContentStateError, ContentStore } from "../content-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-content-workflow-"));
let database;

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "content.sqlite") });
  const evidenceValidationCalls = [];
  let rejectEvidence = false;
  const store = new ContentStore(database, { workspaceId: "default", requireEvidence: true, evidenceValidator: (items, context) => {
    evidenceValidationCalls.push({ count: items.length, action: context.action, allowInternal: context.allowInternal });
    if (rejectEvidence) throw new ContentStateError("Knowledge evidence is no longer public.", "KNOWLEDGE_INTERNAL_EVIDENCE_FORBIDDEN");
    return { valid: true, count: items.length, items };
  } });
  const evidence = [{ marker: "K1", knowledgeLibraryId: "KB-CORP", knowledgeDocumentId: "DOC-1", knowledgeVersionId: "DOC-1-V1", knowledgeChunkId: "CHUNK-1", claim: "企业服务边界已审核", quote: "企业服务边界已审核", supportStatus: "supported" }];

  const plan = store.createPlan({ id: "PLAN-CHECK-1", name: "内容生产审核闭环", businessLineId: "BL-1" });
  const samePlan = store.upsertPlan({ id: plan.id, name: plan.name, businessLineId: plan.businessLineId, metadata: plan.metadata });
  assert.equal(samePlan.revision, plan.revision, "idempotent plan sync must not bump revision");
  const updatedPlan = store.upsertPlan({ id: plan.id, name: plan.name, businessLineId: plan.businessLineId, metadata: { topicIds: ["TOPIC-1"] } });
  assert.equal(updatedPlan.revision, plan.revision + 1, "plan metadata changes must be versioned");
  const task = store.createTask({ planId: plan.id, title: "企业 GEO 文章", businessLineId: "BL-1" });
  const article = store.createArticle({ id: "ART-CHECK-1", taskId: task.id, planId: plan.id, businessLineId: "BL-1", title: "企业 GEO 如何建立可信内容", contentHtml: "<p>先回答客户问题，再给出证据边界。</p>", evidence });
  const linked = store.upsertArticle({ id: article.id, taskId: task.id, planId: plan.id, businessLineId: "BL-1", title: article.title, metadata: { migrated: true } });
  assert.equal(linked.planId, plan.id, "article upsert must retain formal plan linkage");
  assert.equal(article.revision, 1);
  assert.equal(article.currentVersion.reviewStatus, "draft");
  const version1 = article.currentVersion;

  const scan = store.recordRiskScan({ articleId: article.id, versionId: version1.id, status: "passed", policyVersion: "geo-risk-v1", findings: [], summary: { score: 100 } });
  assert.equal(scan.status, "passed");
  const afterScan = store.article("default", article.id);
  const pending = store.submitReview({ articleId: article.id, versionId: version1.id, expectedRevision: afterScan.revision });
  assert.equal(pending.reviewStatus, "pending");

  const afterSubmit = store.article("default", article.id);
  const approved = store.approveAndFreeze({ articleId: article.id, versionId: version1.id, expectedRevision: afterSubmit.revision });
  assert.equal(approved.reviewStatus, "approved");
  assert.ok(approved.frozenAt);
  assert.equal(store.canPublish(article.id, version1.id).ok, true);
  assert.deepEqual(evidenceValidationCalls.map((item) => item.action), ["submit-review", "approve", "publish"]);
  assert.ok(evidenceValidationCalls.every((item) => item.allowInternal === false), "content workflow must always validate citations for public use");

  const revisionTask = store.createTask({ id: "TASK-CHECK-REVISION", planId: plan.id, title: "退回后可修改的文章", businessLineId: "BL-1" });
  const revisionArticle = store.createArticle({ id: "ART-CHECK-REVISION", taskId: revisionTask.id, planId: plan.id, businessLineId: "BL-1", title: "退回修改闭环", contentHtml: "<p>需要审核后再发布的正文。</p>", evidence });
  const revisionVersion = revisionArticle.currentVersion;
  store.recordRiskScan({ articleId: revisionArticle.id, versionId: revisionVersion.id, status: "passed", policyVersion: "geo-risk-v1", findings: [], summary: { score: 100 } });
  const revisionPending = store.submitReview({ articleId: revisionArticle.id, versionId: revisionVersion.id, expectedRevision: store.article("default", revisionArticle.id).revision });
  const revisionReturned = store.requestChanges({ articleId: revisionArticle.id, versionId: revisionVersion.id, expectedRevision: store.article("default", revisionArticle.id).revision, note: "请补充适用边界后重新提交。", actor: { displayName: "审核人员" } });
  assert.equal(revisionPending.reviewStatus, "pending");
  assert.equal(revisionReturned.reviewStatus, "changes_requested");
  assert.equal(revisionReturned.reviews.at(-1).action, "changes_requested");
  assert.equal(revisionReturned.reviews.at(-1).note, "请补充适用边界后重新提交。");
  const revisionRemoteArticle = store.article("default", revisionArticle.id, { includeVersion: true, includeReviews: true });
  assert.equal(revisionRemoteArticle.status, "changes_requested");
  assert.equal(revisionRemoteArticle.currentVersion.reviewStatus, "changes_requested");
  assert.equal(revisionRemoteArticle.currentVersion.reviews.at(-1).note, "请补充适用边界后重新提交。");
  assert.equal(store.task("default", revisionTask.id).status, "changes_requested");
  const revisedDraft = store.createVersion({ articleId: revisionArticle.id, expectedRevision: revisionRemoteArticle.revision, baseVersionId: revisionVersion.id, title: revisionArticle.title, contentHtml: "<p>已按审核意见补充适用边界的正文。</p>", evidence });
  assert.equal(revisedDraft.reviewStatus, "draft", "a changes-requested version must accept a new editable draft");

  const approvedArticle = store.article("default", article.id);
  const version2 = store.createVersion({ articleId: article.id, expectedRevision: approvedArticle.revision, baseVersionId: version1.id, title: article.title, contentHtml: "<p>更新后的文章内容。</p>", evidence });
  assert.equal(version2.reviewStatus, "draft", "editing must create an unapproved version");
  assert.equal(store.canPublish(article.id, version2.id).ok, false);
  assert.equal(store.canPublish(article.id, version1.id).ok, true, "the previously frozen version remains independently publishable");

  assert.throws(() => store.createVersion({ articleId: article.id, expectedRevision: approvedArticle.revision, baseVersionId: version1.id, title: article.title, contentHtml: "<p>stale update</p>", evidence }), (error) => error instanceof ContentConflictError && error.code === "CONTENT_REVISION_CONFLICT");
  assert.throws(() => store.approveAndFreeze({ articleId: article.id, versionId: version2.id, expectedRevision: store.article("default", article.id).revision }), (error) => error instanceof ContentStateError && error.code === "CONTENT_INVALID_STATE");
  assert.throws(() => database.connection.prepare("UPDATE content_article_versions SET content_text = 'tampered' WHERE id = ?").run(version1.id), /CONTENT_VERSION_IMMUTABLE/);
  rejectEvidence = true;
  assert.equal(store.canPublish(article.id, version1.id).code, "KNOWLEDGE_INTERNAL_EVIDENCE_FORBIDDEN", "publishability must be revalidated against current knowledge visibility");

  console.log("Content workflow check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
