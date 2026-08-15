import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { FoundationMethodologyResolver } from "../foundation-methodology-resolver.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "methodology-resolver-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "resolver.sqlite") });
try {
  const store = new FoundationAssetStore(database);
  const imported = importUpsGeoCandidateRules(store, manifest);
  for (const review of imported.rules) {
    store.upsertMethodologySourceReview({
      methodologyVersionId: imported.version.id,
      ruleId: review.ruleId,
      theme: review.theme,
      rule: review.rule,
      source: review.source,
      classification: review.classification,
      applicability: review.applicability,
      licenseStatus: review.licenseStatus,
      reuseDecision: "approved-global",
      reviewStatus: "approved",
      reviewNote: "resolver test approval"
    });
  }
  store.setMethodologyVersionStatus(imported.version.id, "published");
  const timestamp = new Date().toISOString();
  for (const [workspaceId, planId, name] of [
    ["deployment_tongzhuo_geo", "PLAN-TONGZHUO", "桐灼 GEO 内容计划"],
    ["deployment_building_materials", "PLAN-BUILDING", "建材企业内容计划"]
  ]) {
    database.connection.prepare("INSERT INTO content_plans (id, workspace_id, name, content_type, status, methodology_version_id, created_at, updated_at) VALUES (?, ?, ?, '深度文章', 'draft', ?, ?, ?)")
      .run(planId, workspaceId, name, imported.version.id, timestamp, timestamp);
  }
  const resolver = new FoundationMethodologyResolver(database);
  const tongzhuo = resolver.resolveArticleContext({ workspaceId: "deployment_tongzhuo_geo", planId: "PLAN-TONGZHUO", customerQuestion: "企业做 GEO 内容时怎样引用官网事实？", contentType: "深度文章" });
  const building = resolver.resolveArticleContext({ workspaceId: "deployment_building_materials", planId: "PLAN-BUILDING", customerQuestion: "采购保温建材时应该如何比较产品参数？", contentType: "采购指南" });
  assert.equal(tongzhuo.versionId, building.versionId, "different deployments must reuse the same published global methodology version");
  assert.ok(tongzhuo.fragments.length > 0 && tongzhuo.fragments.length <= 8);
  assert.ok(building.fragments.length > 0 && building.fragments.length <= 8);
  assert.ok(!Object.hasOwn(tongzhuo, "content"), "resolver must not inject the full methodology content");
  assert.ok(tongzhuo.fragments.every((fragment) => /^[0-9a-f]{64}$/.test(fragment.source.sha256)));
  assert.ok(!JSON.stringify(tongzhuo).includes("建材企业"), "methodology context must not contain another deployment's project data");
  assert.ok(!JSON.stringify(building).includes("桐灼"), "methodology context must not contain another deployment's project data");
  assert.throws(() => resolver.resolveArticleContext({ workspaceId: "deployment_building_materials", planId: "PLAN-TONGZHUO", customerQuestion: "测试问题是什么？" }), /Content plan not found/);
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Per-task methodology fragment selection, shared global version, and deployment boundary checks passed.");
