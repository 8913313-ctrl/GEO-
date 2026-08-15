import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { FoundationMethodologyResolver } from "../foundation-methodology-resolver.mjs";
import { ensureGeoFoundationPublishedAssets } from "../foundation-assets/bootstrap.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidates = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "foundation-prompt-freeze-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "prompt.sqlite") });
try {
  const store = new FoundationAssetStore(database);
  const methodology = importUpsGeoCandidateRules(store, candidates);
  for (const review of methodology.rules) store.upsertMethodologySourceReview({ methodologyVersionId: methodology.version.id, ruleId: review.ruleId, theme: review.theme, rule: review.rule, source: review.source, classification: review.classification, applicability: review.applicability, licenseStatus: review.licenseStatus, reuseDecision: "approved-global", reviewStatus: "approved", reviewNote: "freeze test" });
  store.setMethodologyVersionStatus(methodology.version.id, "published");
  const foundation = ensureGeoFoundationPublishedAssets(store);
  const now = new Date().toISOString();
  for (const [workspaceId, planId, name] of [["deployment_tongzhuo_geo", "PLAN-PROMPT-TZ", "桐灼计划"], ["deployment_building_materials", "PLAN-PROMPT-BM", "建材计划"]]) {
    database.connection.prepare("INSERT INTO content_plans (id, workspace_id, name, content_type, status, methodology_version_id, prompt_version_id, quality_rule_pack_id, created_at, updated_at) VALUES (?, ?, ?, '深度文章', 'draft', ?, ?, ?, ?, ?)")
      .run(planId, workspaceId, name, methodology.version.id, foundation.promptVersion.id, foundation.qualityRulePack.id, now, now);
  }
  const resolver = new FoundationMethodologyResolver(database);
  const methodologyContext = resolver.resolveArticleContext({ workspaceId: "deployment_tongzhuo_geo", planId: "PLAN-PROMPT-TZ", customerQuestion: "企业怎样建设 GEO 官网事实？" });
  const context = resolver.resolveArticlePromptContext({
    workspaceId: "deployment_tongzhuo_geo", planId: "PLAN-PROMPT-TZ",
    companyProfile: { legalName: "桐灼科技", shortName: "桐灼", description: "GEO 服务企业", region: "济南" },
    businessLine: { id: "BL-GEO", name: "GEO 服务", description: "企业 GEO 运营" },
    topic: { id: "TOP-1", title: "企业怎样建设 GEO 官网事实？", intent: "方案了解", stage: "方案评估" },
    customerQuestion: "企业怎样建设 GEO 官网事实？", contentType: "深度文章", knowledgeScope: { libraryIds: ["KB-TZ"] },
    retrievedEvidence: [{ id: "E-TZ-1", claim: "桐灼服务", quote: "仅供桐灼项目的公开企业事实。", libraryId: "KB-TZ", documentId: "DOC-TZ", versionId: "VER-TZ", chunkId: "CHK-TZ" }], methodology: methodologyContext
  });
  assert.equal(context.templateId, foundation.promptVersion.id);
  assert.ok(context.renderedPrompt.includes("桐灼科技"));
  assert.ok(context.renderedPrompt.includes("企业 GEO 证据型内容编辑"), "published system prompt must be part of the frozen rendered prompt");
  assert.ok(context.renderedPrompt.includes("E-TZ-1"));
  assert.ok(context.renderedPrompt.includes(methodology.version.id));
  assert.ok(!context.renderedPrompt.includes("建材计划"));
  assert.equal(context.quality.packId, foundation.qualityRulePack.id);
  assert.ok(context.quality.rules.includes("facts_require_approved_evidence"));
  assert.throws(() => resolver.resolveArticlePromptContext({ workspaceId: "deployment_building_materials", planId: "PLAN-PROMPT-TZ", customerQuestion: "建材问题" }), /Content plan not found/);
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
console.log("Published prompt selection, variable allowlist, rendered snapshot, and deployment isolation checks passed.");
