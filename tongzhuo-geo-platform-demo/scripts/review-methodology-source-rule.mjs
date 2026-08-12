import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1] || "true");
  index += 1;
}
if (args.get("apply") !== "true") {
  console.error("Refusing to change review state without --apply true.");
  process.exitCode = 2;
} else {
  const versionId = String(args.get("version") || "").trim();
  const ruleId = String(args.get("rule") || "").trim();
  const reviewStatus = String(args.get("status") || "").trim();
  const reviewerId = String(args.get("reviewer-id") || "").trim();
  const reviewNote = String(args.get("note") || "").trim();
  if (!versionId || !ruleId || !["approved", "rejected"].includes(reviewStatus) || !reviewerId || !reviewNote) throw new Error("Required: --version, --rule, --status approved|rejected, --reviewer-id, --note, --apply true");
  const database = new ProductionDatabase();
  try {
    if (!database.connection.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(reviewerId)) throw new Error("Reviewer must be an active local user.");
    const store = new FoundationAssetStore(database);
    const existing = store.methodologySourceReviews(versionId).find((review) => review.ruleId === ruleId);
    if (!existing) throw new Error("Methodology source rule was not imported for this version.");
    const updated = store.upsertMethodologySourceReview({
      methodologyVersionId: versionId,
      ruleId,
      theme: existing.theme,
      rule: existing.rule,
      source: existing.source,
      classification: existing.classification,
      applicability: existing.applicability,
      licenseStatus: existing.licenseStatus,
      reuseDecision: reviewStatus === "approved" ? "approved-global" : "rejected",
      reviewStatus,
      reviewNote
    }, { userId: reviewerId });
    console.log(JSON.stringify(updated, null, 2));
  } finally {
    database.close();
  }
}
