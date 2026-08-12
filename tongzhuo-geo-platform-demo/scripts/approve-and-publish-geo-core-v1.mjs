import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.argv.includes("--apply") || !process.argv.includes("--owner-confirmed")) {
  console.error("Refusing to approve or publish without --apply and --owner-confirmed.");
  process.exitCode = 2;
} else {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const candidateManifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
  const database = new ProductionDatabase();
  try {
    const reviewer = database.connection.prepare("SELECT id FROM users WHERE status = 'active' AND role = 'admin' ORDER BY created_at ASC LIMIT 1").get()
      || database.connection.prepare("SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").get();
    if (!reviewer?.id) throw new Error("Cannot publish geo-core without an active local reviewer account.");
    const store = new FoundationAssetStore(database);
    const imported = importUpsGeoCandidateRules(store, candidateManifest, { userId: reviewer.id });
    if (imported.version.status === "published") {
      console.log(JSON.stringify({ status: "already_published", methodologyVersionId: imported.version.id, ruleCount: imported.rules.length }, null, 2));
    } else {
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
          reviewNote: "负责人于 2026-08-12 确认允许作为所有 GEO 客户共用的 geo-core 底座。"
        }, { userId: reviewer.id });
      }
      const readiness = store.assertMethodologyPublicationReady(imported.version.id);
      const published = store.setMethodologyVersionStatus(imported.version.id, "published", { userId: reviewer.id });
      console.log(JSON.stringify({ status: "published", methodologyVersionId: published.id, version: published.version, checksum: published.checksum, reviewedRules: readiness.reviewedRules, sourceRulesRequired: readiness.requiredRuleCount }, null, 2));
    }
  } finally {
    database.close();
  }
}
