import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetError, FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoFoundationDrafts } from "../foundation-assets/bootstrap.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "geo-foundation-assets-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "foundation.sqlite") });
const timestamp = new Date().toISOString();
try {
  const store = new FoundationAssetStore(database);
  for (const workspaceId of ["deployment_tongzhuo_geo", "deployment_building_materials"]) {
    database.connection.prepare("INSERT INTO content_plans (id, workspace_id, name, content_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)")
      .run(`PLAN-${workspaceId}`, workspaceId, `${workspaceId} GEO 计划`, "深度文章", timestamp, timestamp);
  }

  const assets = ensureGeoFoundationDrafts(store);
  assert.equal(assets.methodologyPack.key, "geo-core");
  assert.equal(assets.methodologyVersion.status, "draft");
  assert.equal(assets.promptTemplate.operation, "article");
  assert.equal(assets.promptVersion.status, "draft");
  assert.equal(assets.qualityRulePack.status, "draft");
  assert.equal(store.methodologyVersions(assets.methodologyPack.id).length, 1);
  assert.equal(store.promptVersions(assets.promptTemplate.id).length, 1);
  const repeated = ensureGeoFoundationDrafts(store);
  assert.equal(repeated.methodologyVersion.id, assets.methodologyVersion.id);
  assert.equal(store.methodologyVersions(assets.methodologyPack.id).length, 1, "bootstrap must be idempotent");
  assert.equal(store.promptVersions(assets.promptTemplate.id).length, 1, "bootstrap must not duplicate prompt versions");

  assert.throws(() => store.setMethodologyVersionStatus(assets.methodologyVersion.id, "published"), (error) => error instanceof FoundationAssetError && error.code === "METHODOLOGY_SOURCE_REVIEWS_REQUIRED");
  store.upsertMethodologySourceReview({
    id: "MSREV-CHECK-001",
    methodologyVersionId: assets.methodologyVersion.id,
    ruleId: "CHECK-RULE-001",
    theme: "evidence",
    rule: "事实必须来自已审核证据。",
    source: { path: "public/app.js", locator: "GEO_AGENT_PROMPT_FOUNDATION", excerpt: "approved evidence", sha256: "0000000000000000000000000000000000000000000000000000000000000000" },
    classification: "quality-gate",
    applicability: "all deployments",
    licenseStatus: "internal",
    reviewStatus: "pending"
  });
  assert.throws(() => store.setMethodologyVersionStatus(assets.methodologyVersion.id, "published"), (error) => error instanceof FoundationAssetError && error.code === "METHODOLOGY_SOURCE_REVIEWS_INCOMPLETE");
  store.upsertMethodologySourceReview({
    methodologyVersionId: assets.methodologyVersion.id,
    ruleId: "CHECK-RULE-001",
    theme: "evidence",
    rule: "事实必须来自已审核证据。",
    source: { path: "public/app.js", locator: "GEO_AGENT_PROMPT_FOUNDATION", excerpt: "approved evidence", sha256: "0000000000000000000000000000000000000000000000000000000000000000" },
    classification: "quality-gate",
    applicability: "all deployments",
    licenseStatus: "internal",
    reuseDecision: "approved-global",
    reviewStatus: "approved",
    reviewNote: "test approval"
  });
  store.setMethodologyVersionStatus(assets.methodologyVersion.id, "published");
  store.setPromptVersionStatus(assets.promptVersion.id, "published");
  store.setQualityRulePackStatus(assets.qualityRulePack.id, "published");

  const references = {
    methodologyVersionId: assets.methodologyVersion.id,
    promptVersionId: assets.promptVersion.id,
    qualityRulePackId: assets.qualityRulePack.id
  };
  const selectedDefaults = store.selectPublishedPlanFoundation({ workspaceId: "deployment_tongzhuo_geo", industryTemplate: "professional-services" });
  assert.deepEqual({ methodologyVersionId: selectedDefaults.methodologyVersionId, promptVersionId: selectedDefaults.promptVersionId, qualityRulePackId: selectedDefaults.qualityRulePackId }, references);
  const projectPrompt = store.createPromptTemplate({ key: "geo-article", scope: "project", workspaceId: "deployment_tongzhuo_geo", operation: "article", title: "桐灼部署定制提示词" });
  const projectPromptVersion = store.createPromptVersion({ templateId: projectPrompt.id, systemPrompt: "只使用当前部署已审核事实。", userTemplate: "{{customer_question}}", variablesSchema: { type: "object", required: ["customer_question"] }, outputSchema: { type: "object" }, qualityRules: ["facts_require_approved_evidence"] });
  store.createPromptTestCase({ promptVersionId: projectPromptVersion.id, name: "当前部署提示词测试", inputFixture: { customer_question: "测试" }, expectedRules: ["facts_require_approved_evidence"] });
  store.setPromptVersionStatus(projectPromptVersion.id, "published");
  const projectDefaults = store.selectPublishedPlanFoundation({ workspaceId: "deployment_tongzhuo_geo", industryTemplate: "professional-services" });
  assert.equal(projectDefaults.promptVersionId, projectPromptVersion.id, "current deployment override must win over the global prompt");
  const otherDefaults = store.selectPublishedPlanFoundation({ workspaceId: "deployment_building_materials", industryTemplate: "building-materials" });
  assert.equal(otherDefaults.promptVersionId, assets.promptVersion.id, "another private deployment must not receive the project override");
  const tongzhuoPlan = store.attachPlanFoundation({ workspaceId: "deployment_tongzhuo_geo", planId: "PLAN-deployment_tongzhuo_geo", ...references });
  const buildingPlan = store.attachPlanFoundation({ workspaceId: "deployment_building_materials", planId: "PLAN-deployment_building_materials", ...references });
  assert.equal(tongzhuoPlan.methodology_version_id, buildingPlan.methodology_version_id, "customers must reference the same global methodology version");
  assert.equal(tongzhuoPlan.prompt_version_id, buildingPlan.prompt_version_id, "customers must reference the same global prompt version");

  assert.throws(() => store.attachPlanFoundation({ workspaceId: "deployment_other", planId: "PLAN-deployment_tongzhuo_geo", ...references }), /Content plan not found/);
  const buildingOnlyRules = store.createQualityRulePack({ key: "customer-rules", scope: "project", workspaceId: "deployment_building_materials", title: "建材客户自定义规则", rules: [{ key: "customer-rule", severity: "warning" }] });
  store.setQualityRulePackStatus(buildingOnlyRules.id, "published");
  assert.throws(() => store.attachPlanFoundation({ workspaceId: "deployment_tongzhuo_geo", planId: "PLAN-deployment_tongzhuo_geo", ...references, qualityRulePackId: buildingOnlyRules.id }), (error) => error instanceof FoundationAssetError && error.code === "FOUNDATION_REFERENCE_WORKSPACE_MISMATCH");
  assert.throws(() => database.connection.prepare("UPDATE methodology_versions SET content = ? WHERE id = ?").run("tampered", assets.methodologyVersion.id), /immutable/);
  assert.throws(() => database.connection.prepare("UPDATE methodology_source_reviews SET review_note = ? WHERE methodology_version_id = ?").run("tampered", assets.methodologyVersion.id), /immutable/);
  assert.throws(() => database.connection.prepare("DELETE FROM methodology_source_reviews WHERE methodology_version_id = ?").run(assets.methodologyVersion.id), /immutable/);
  assert.throws(() => database.connection.prepare("DELETE FROM prompt_versions WHERE id = ?").run(assets.promptVersion.id), /cannot be deleted/);
  assert.throws(() => store.setPromptVersionStatus(assets.promptVersion.id, "retired"), /immutable/);
  assert.throws(() => store.createMethodologyPack({ key: "bad", scope: "global", workspaceId: "workspace_leak", title: "bad" }), /Global assets cannot/);
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Foundation asset versioning and shared-reference checks passed.");
