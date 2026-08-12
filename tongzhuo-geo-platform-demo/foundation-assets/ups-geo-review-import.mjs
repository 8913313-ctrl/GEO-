import { GEO_CORE_DRAFT } from "./geo-core-drafts.mjs";

export function flattenUpsGeoRules(candidateManifest) {
  if (candidateManifest?.status !== "candidate-for-review-only") throw new Error("Candidate manifest must remain gated for review.");
  const themes = Array.isArray(candidateManifest.themes) ? candidateManifest.themes : [];
  const rules = themes.flatMap((theme) => (theme.rules || []).map((rule) => ({ ...rule, theme: theme.key })));
  if (!rules.length || new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("Candidate rules must be non-empty and have unique IDs.");
  return rules;
}

export function importUpsGeoCandidateRules(store, candidateManifest, actor = null) {
  const rules = flattenUpsGeoRules(candidateManifest);
  let pack = store.methodologyPackByKey(GEO_CORE_DRAFT.pack.key, { scope: "global" });
  if (!pack) pack = store.createMethodologyPack(GEO_CORE_DRAFT.pack, actor);
  let version = store.methodologyVersions(pack.id).find((item) => item.id === "MVER-GEO-CORE-V1");
  const content = [
    "# GEO 核心方法 v1（来源审核草稿）",
    "",
    "本版本由 UPS_GEO 研究资料提炼而来，当前所有来源规则仍处于待审批状态，不得发布或作为销售承诺。",
    "",
    ...candidateManifest.themes.flatMap((theme) => [
      `## ${theme.name}`,
      "",
      ...theme.rules.map((rule) => `- ${rule.rule}`),
      ""
    ])
  ].join("\n");
  if (!version) version = store.createMethodologyVersion({
    id: "MVER-GEO-CORE-V1",
    packId: pack.id,
    content,
    sources: [
      { type: "ups-geo-candidate-manifest", path: "docs/baseline/P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json", locator: "themes[].rules[]", usage: "candidate-rule-review", requiredRuleCount: rules.length },
      { type: "ups-geo-source-manifest", path: "docs/baseline/P2-T06-UPS-GEO-SOURCE-MANIFEST-20260811.json", locator: "files[]", usage: "source-integrity" }
    ]
  }, actor);
  const existing = new Set(store.methodologySourceReviews(version.id).map((review) => review.ruleId));
  for (const rule of rules) {
    if (existing.has(rule.id)) continue;
    store.upsertMethodologySourceReview({
      id: `MSREV-${rule.id}`,
      methodologyVersionId: version.id,
      ruleId: rule.id,
      theme: rule.theme,
      rule: rule.rule,
      source: rule.source,
      classification: rule.classification,
      applicability: rule.applicability,
      licenseStatus: rule.licenseStatus,
      reuseDecision: rule.reuseDecision,
      reviewStatus: "pending"
    }, actor);
  }
  return { pack, version, rules: store.methodologySourceReviews(version.id) };
}
