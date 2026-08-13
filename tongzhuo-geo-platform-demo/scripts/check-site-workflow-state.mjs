import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { SiteCmsError, SiteCmsStore } from "../site-cms-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-workflow-"));
let database;
let runtime;
const workspaceId = "tenant-workflow-test";
const actorEditor = { userId: "USER-CMS-EDITOR", displayName: "运营编辑" };
const actorReviewer = { userId: "USER-CMS-REVIEWER", displayName: "审核负责人" };

function expectError(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof SiteCmsError);
    assert.ok(error.status >= 400 && error.status < 500);
    assert.equal(error.code, code);
    return true;
  });
}

try {
  database = new ProductionDatabase({ databasePath: path.join(directory, "workflow.sqlite") });
  const now = new Date().toISOString();
  database.connection.prepare("INSERT INTO users (id, username, username_normalized, display_name, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'test-only', ?, 'active', ?, ?)")
    .run(actorEditor.userId, "cms-editor", "cms-editor", actorEditor.displayName, "operator", now, now);
  database.connection.prepare("INSERT INTO users (id, username, username_normalized, display_name, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'test-only', ?, 'active', ?, ?)")
    .run(actorReviewer.userId, "cms-reviewer", "cms-reviewer", actorReviewer.displayName, "reviewer", now, now);
  new WorkspaceStore(database).save(workspaceId, { site: { cms: {
    settings: { siteName: "状态机测试官网", companyName: "状态机测试企业", officialDomain: "workflow.example.test" },
    pages: [{ id: "home", title: "首页", path: "/", status: "published" }]
  } } }, { expectedRevision: 0 });
  const store = new SiteCmsStore(database, { workspaceId });
  const initial = store.publication();
  assert.equal(initial.status, "published");

  const cms = structuredClone(store.draft().snapshot);
  cms.settings.description = "等待审核的新官网说明";
  const draft = store.saveDraft({ expectedRevision: 1, cms, reason: "补充企业说明" }, actorEditor);
  assert.equal(store.workflow().status, "draft");
  expectError(() => store.publish({ expectedDraftRevision: draft.revision, note: "绕过审核" }, actorEditor), "SITE_CMS_PUBLISH_REQUIRES_APPROVAL");
  expectError(() => store.approve({ reason: "非法直接批准" }, actorReviewer), "SITE_CMS_INVALID_TRANSITION");

  const pending = store.submitReview({ reason: "企业说明已整理完成" }, actorEditor);
  assert.equal(pending.status, "pending_review");
  assert.ok(pending.changedAt);
  assert.equal(pending.reason, "企业说明已整理完成");
  assert.equal(pending.changedBy, actorEditor.userId);
  expectError(() => store.saveDraft({ expectedRevision: draft.revision, cms }, actorEditor), "SITE_CMS_DRAFT_LOCKED");
  expectError(() => store.publish({ expectedDraftRevision: draft.revision }, actorEditor), "SITE_CMS_PUBLISH_REQUIRES_APPROVAL");

  const rejected = store.reject({ reason: "企业主体证据不足" }, actorReviewer);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reviewReason, "企业主体证据不足");
  assert.equal(rejected.reviewedBy, actorReviewer.userId);
  assert.ok(rejected.reviewAt);
  expectError(() => store.publish({ expectedDraftRevision: draft.revision }, actorEditor), "SITE_CMS_PUBLISH_REQUIRES_APPROVAL");

  const revisedCms = structuredClone(cms);
  revisedCms.settings.description = "已经补齐企业主体证据";
  const revised = store.saveDraft({ expectedRevision: draft.revision, cms: revisedCms, reason: "按审核意见补充证据" }, actorEditor);
  assert.equal(store.workflow().status, "draft");
  store.submitReview({ reason: "重新提交审核" }, actorEditor);
  const approved = store.approve({ reason: "企业事实与公开边界核验通过" }, actorReviewer);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewReason, "企业事实与公开边界核验通过");
  expectError(() => store.saveDraft({ expectedRevision: revised.revision, cms: revisedCms }, actorEditor), "SITE_CMS_DRAFT_LOCKED");

  const publication = store.publish({ expectedDraftRevision: revised.revision, note: "正式发布审核通过版本" }, actorReviewer);
  assert.equal(publication.status, "published");
  assert.equal(publication.version, initial.version + 1);
  assert.equal(publication.snapshot.settings.description, "已经补齐企业主体证据");
  expectError(() => store.submitReview({ reason: "没有新草稿时不能重复送审" }, actorEditor), "SITE_CMS_INVALID_TRANSITION");

  const changedAfterPublication = structuredClone(revisedCms);
  changedAfterPublication.settings.description = "正式发布后的下一版修改";
  const nextDraft = store.saveDraft({ expectedRevision: revised.revision, cms: changedAfterPublication, reason: "准备官网下一版本" }, actorEditor);
  assert.equal(store.workflow().status, "draft", "editing a published site must reopen the review workflow");
  const repeatedSave = store.saveDraft({ expectedRevision: nextDraft.revision, cms: changedAfterPublication, reason: "重复保存相同下一版" }, actorEditor);
  assert.equal(repeatedSave.revision, nextDraft.revision);
  assert.equal(store.workflow().status, "draft", "a no-op save of an unpublished draft must not leave workflow published");
  store.submitReview({ reason: "提交官网下一版本" }, actorEditor);
  store.approve({ reason: "下一版本审核通过" }, actorReviewer);
  const nextPublication = store.publish({ expectedDraftRevision: nextDraft.revision, note: "发布官网下一版本" }, actorReviewer);
  assert.equal(nextPublication.version, publication.version + 1);

  const unpublished = store.unpublish({ reason: "企业要求临时下线" }, actorReviewer);
  assert.equal(unpublished.status, "unpublished");
  assert.equal(unpublished.reason, "企业要求临时下线");
  assert.equal(store.publication().releaseId, nextPublication.releaseId, "unpublish retains the latest immutable release for recovery");
  expectError(() => store.unpublish({ reason: "重复下线" }, actorReviewer), "SITE_CMS_INVALID_TRANSITION");

  runtime = createSiteRuntime({ database, workspaceId, staticRoot: directory, host: "127.0.0.1", port: 0, baseUrl: "https://workflow.example.test", logger: { info() {}, warn() {}, error() {} } });
  const address = await runtime.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const homeResponse = await fetch(`${base}/`);
  const liveResponse = await fetch(`${base}/health/live`);
  assert.equal(homeResponse.status, 404, "an unpublished site must stop serving public pages");
  assert.equal(liveResponse.status, 200, "unpublishing content must not hide operational health");

  const audit = database.connection.prepare("SELECT action, actor_user_id, details_json, created_at FROM audit_logs WHERE entity_id = ? AND action LIKE 'site.cms.%' ORDER BY id").all(workspaceId);
  for (const action of ["site.cms.draft", "site.cms.pending_review", "site.cms.rejected", "site.cms.approved", "site.cms.published", "site.cms.unpublished"]) {
    const row = audit.find((item) => item.action === action);
    assert.ok(row, `missing ${action} audit`);
    assert.ok(row.created_at);
    const details = JSON.parse(row.details_json);
    assert.ok(details.from && details.to);
    assert.equal(typeof details.reason, "string");
    assert.ok(row.actor_user_id, `${action} must retain its operator`);
  }

  console.log("Official-site CMS workflow transitions, review gate, rejection, unpublish, reason, timestamp, and audit checks passed.");
} finally {
  await runtime?.close();
  database?.close();
  await rm(directory, { recursive: true, force: true });
}
