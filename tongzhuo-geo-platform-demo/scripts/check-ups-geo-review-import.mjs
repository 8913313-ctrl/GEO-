import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetError, FoundationAssetStore } from "../foundation-asset-store.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "ups-geo-review-import-"));
const database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "review.sqlite") });
try {
  const store = new FoundationAssetStore(database);
  const first = importUpsGeoCandidateRules(store, manifest);
  assert.equal(first.version.id, "MVER-GEO-CORE-V1");
  assert.equal(first.rules.length, 16);
  assert.ok(first.rules.every((review) => review.reviewStatus === "pending"));
  assert.throws(() => store.setMethodologyVersionStatus(first.version.id, "published"), (error) => error instanceof FoundationAssetError && error.code === "METHODOLOGY_SOURCE_REVIEWS_INCOMPLETE");

  const selected = first.rules[0];
  store.upsertMethodologySourceReview({
    methodologyVersionId: first.version.id,
    ruleId: selected.ruleId,
    theme: selected.theme,
    rule: selected.rule,
    source: selected.source,
    classification: selected.classification,
    applicability: selected.applicability,
    licenseStatus: selected.licenseStatus,
    reuseDecision: "approved-global",
    reviewStatus: "approved",
    reviewNote: "integration test approval"
  });
  const repeated = importUpsGeoCandidateRules(store, manifest);
  assert.equal(repeated.rules.length, 16, "re-import must be idempotent");
  assert.equal(repeated.rules.find((review) => review.ruleId === selected.ruleId).reviewStatus, "approved", "re-import must not erase a completed review");

  for (const review of repeated.rules.filter((item) => item.reviewStatus !== "approved")) {
    store.upsertMethodologySourceReview({
      methodologyVersionId: repeated.version.id,
      ruleId: review.ruleId,
      theme: review.theme,
      rule: review.rule,
      source: review.source,
      classification: review.classification,
      applicability: review.applicability,
      licenseStatus: review.licenseStatus,
      reuseDecision: "approved-global",
      reviewStatus: "approved",
      reviewNote: "integration test approval"
    });
  }
  const readiness = store.assertMethodologyPublicationReady(repeated.version.id);
  assert.equal(readiness.reviewedRules, 16);
  assert.equal(readiness.requiredRuleCount, 16);
  assert.equal(store.setMethodologyVersionStatus(repeated.version.id, "published").status, "published");
  assert.throws(() => database.connection.prepare("UPDATE methodology_source_reviews SET review_note = 'changed' WHERE methodology_version_id = ?").run(repeated.version.id), /immutable/);
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("UPS_GEO source-review import, idempotency, publication gate, and immutability checks passed.");
