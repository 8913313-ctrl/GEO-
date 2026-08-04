import assert from "node:assert/strict";
import { CitationResearchStore } from "../citation-research-store.mjs";

const store = new CitationResearchStore();

function assertPlatformAggregation(result) {
  assert.equal(result.factPackVersion, "citation-question-set-preference-v1");
  assert.equal(result.datasetVersion, "2.0.1");
  assert.equal(result.platforms.length, 4);
  assert.deepEqual(result.platforms.map((item) => item.label), ["豆包", "DeepSeek", "千问", "元宝"]);
  for (const platform of result.platforms) {
    assert.ok(platform.citationObservationCount > 0, `${platform.label} must contain observations`);
    assert.ok(platform.questionCount > 0, `${platform.label} must contain questions`);
    assert.ok(platform.sourceCategories.length > 0, `${platform.label} must contain source categories`);
    assert.ok(platform.sourceTypes.length > 0, `${platform.label} must contain source types`);
    assert.ok(platform.ecosystems.length > 0, `${platform.label} must contain ecosystems`);
    assert.ok(platform.contentFormats.length > 0, `${platform.label} must contain content formats`);
    assert.ok(platform.topDomains.length > 0, `${platform.label} must contain top domains`);
    assert.ok(platform.averageQuotePosition == null || Number.isFinite(platform.averageQuotePosition));
    assert.ok(platform.averageSnippetLength == null || Number.isFinite(platform.averageSnippetLength));
  }
  assert.ok(result.citationSamples.length > 0);
  assert.ok(result.citationSamples.every((item) => item.evidenceId && item.sourceUrl));
  assert.equal(result.evidence.datasetVersion, result.source.datasetVersion);
  assert.equal(result.evidence.sourceCommit, result.source.sourceCommit);
  assert.equal(result.evidence.questionEvidenceIds.length, result.cohort.questionCount);
}

try {
  const directIndustry = store.buildResearchCohort({ industry: "餐饮" });
  assert.equal(directIndustry.scopeMode, "auto");
  assert.equal(directIndustry.mode, "industry_label");
  assert.equal(directIndustry.directIndustryCohortApplied, true);
  assert.equal(directIndustry.inferredIndustryCohort, false);
  assert.equal(directIndustry.globalFallbackApplied, false);
  assert.equal(directIndustry.resolvedIndustry.key, "food_beverage");
  assert.equal(directIndustry.resolvedIndustry.label, "餐饮");
  assert.equal(directIndustry.questionCount, 20);
  assert.equal(directIndustry.questions.length, 20);
  assert.ok(directIndustry.questions.every((item) => item.questionId && item.prompt && item.evidenceId));

  const forcedGlobal = store.buildResearchCohort({
    scopeMode: "global_baseline",
    industry: "餐饮",
    questionIds: directIndustry.questionIds.slice(0, 1),
    representativeQuestions: directIndustry.questions.slice(0, 1).map((item) => item.prompt)
  });
  assert.equal(forcedGlobal.scopeMode, "global_baseline");
  assert.equal(forcedGlobal.mode, "global_baseline");
  assert.equal(forcedGlobal.questionCount, store.summary().counts.questions);
  assert.equal(forcedGlobal.directIndustryCohortApplied, false);
  assert.equal(forcedGlobal.globalFallbackApplied, false);
  assert.match(forcedGlobal.basis, /scopeMode=global_baseline/);
  assert.ok(forcedGlobal.selectionWarnings.some((item) => /ignored/.test(item)));
  assert.deepEqual(forcedGlobal.selectorPrecedence, ["globalBaseline"]);
  assert.equal(forcedGlobal.requested.industry, null);
  assert.deepEqual(forcedGlobal.requested.questionIds, []);
  assert.deepEqual(forcedGlobal.requested.representativeQuestions, []);

  const forcedGlobalWithInvalidIgnoredFields = store.buildResearchCohort({
    scopeMode: "global_baseline",
    industry: "字段应被忽略",
    questionIds: "not-an-array",
    representativeQuestions: { invalid: true }
  });
  assert.equal(forcedGlobalWithInvalidIgnoredFields.mode, "global_baseline");
  assert.equal(forcedGlobalWithInvalidIgnoredFields.questionCount, store.summary().counts.questions);
  assert.equal(forcedGlobalWithInvalidIgnoredFields.evidenceId, store.buildResearchCohort({ scopeMode: "global_baseline" }).evidenceId);

  const forcedDirectIndustry = store.buildResearchCohort({
    scopeMode: "direct_industry",
    industry: "餐饮",
    questionIds: ["missing-question-id"],
    representativeQuestions: ["量子航天宠物营养的完全虚构诊断问题"]
  });
  assert.equal(forcedDirectIndustry.scopeMode, "direct_industry");
  assert.equal(forcedDirectIndustry.mode, "industry_label");
  assert.equal(forcedDirectIndustry.questionCount, 20);
  assert.equal(forcedDirectIndustry.directIndustryCohortApplied, true);
  assert.equal(forcedDirectIndustry.globalFallbackApplied, false);
  assert.equal(forcedDirectIndustry.representativeMatches.length, 0);
  assert.ok(forcedDirectIndustry.selectionWarnings.some((item) => /ignored/.test(item)));
  assert.deepEqual(forcedDirectIndustry.selectorPrecedence, ["industry"]);

  assert.throws(
    () => store.buildResearchCohort({
      scopeMode: "direct_industry",
      industry: "GEO运营",
      representativeQuestions: directIndustry.questions.slice(0, 1).map((item) => item.prompt)
    }),
    (error) => error?.code === "CITATION_RESEARCH_DIRECT_INDUSTRY_NOT_AVAILABLE"
  );
  assert.throws(
    () => store.buildResearchCohort({ scopeMode: "direct_industry" }),
    (error) => error?.code === "CITATION_RESEARCH_DIRECT_INDUSTRY_REQUIRED"
  );
  assert.throws(
    () => store.buildResearchCohort({ scopeMode: "unsupported" }),
    (error) => error?.code === "CITATION_RESEARCH_SCOPE_MODE_INVALID"
  );

  const industryAnalysis = store.analyzeQuestionSet({
    industry: "food_beverage",
    platformFamilies: ["doubao", "deepseek", "qwen", "yuanbao"],
    citationLimit: 4
  });
  assert.equal(industryAnalysis.cohort.mode, "industry_label");
  assert.equal(industryAnalysis.sample.preferredExactRecordOnly, true);
  assert.equal(industryAnalysis.statisticalScope.observationFilter, "is_preferred_exact_record = 1");
  assertPlatformAggregation(industryAnalysis);

  const explicitQuestionIds = directIndustry.questionIds.slice(0, 2);
  const explicitPreferred = store.analyzeQuestionSet({ questionIds: [...explicitQuestionIds, "missing-question-id"], citationLimit: 3 });
  assert.equal(explicitPreferred.cohort.mode, "explicit_question_ids");
  assert.deepEqual(explicitPreferred.cohort.questionIds, explicitQuestionIds);
  assert.deepEqual(explicitPreferred.cohort.rejectedQuestionIds, ["missing-question-id"]);
  assert.equal(explicitPreferred.cohort.globalFallbackApplied, false);
  assertPlatformAggregation(explicitPreferred);

  const explicitRaw = store.analyzeQuestionSet({ questionIds: explicitQuestionIds, preferredExact: false, citationLimit: 3 });
  assert.equal(explicitRaw.sample.preferredExactRecordOnly, false);
  assert.equal(explicitRaw.statisticalScope.observationFilter, "all citation_observations rows");
  assert.ok(explicitRaw.sample.citationObservationCount >= explicitPreferred.sample.citationObservationCount);

  const representativeCohort = store.buildResearchCohort({
    industry: "GEO运营",
    representativeQuestions: directIndustry.questions.slice(0, 2).map((item) => item.prompt),
    minimumScore: 0.99,
    matchLimitPerQuestion: 2
  });
  assert.equal(representativeCohort.mode, "matched_representative_questions");
  assert.equal(representativeCohort.directIndustryCohortApplied, false);
  assert.equal(representativeCohort.inferredIndustryCohort, false);
  assert.equal(representativeCohort.globalFallbackApplied, false);
  assert.equal(representativeCohort.representativeMatches.length, 2);
  assert.ok(representativeCohort.representativeMatches.every((item) => item.matches.some((match) => match.matchSignals.exact)));
  assert.ok(representativeCohort.selectionWarnings.some((item) => item.includes("GEO运营")));

  const unmatched = store.buildResearchCohort({
    industry: "不存在的虚构行业",
    representativeQuestions: ["量子航天宠物营养的完全虚构诊断问题"],
    minimumScore: 1
  });
  assert.equal(unmatched.mode, "global_baseline");
  assert.equal(unmatched.directIndustryCohortApplied, false);
  assert.equal(unmatched.inferredIndustryCohort, false);
  assert.equal(unmatched.globalFallbackApplied, true);
  assert.equal(unmatched.questionCount, store.summary().counts.questions);
  assert.match(unmatched.basis, /global fallback/i);
  assert.ok(unmatched.fallbackReason);
  assert.ok(unmatched.selectionAttempts.some((item) => item.selector === "industry" && item.matchedCount === 0));
  assert.ok(unmatched.selectionAttempts.some((item) => item.selector === "representativeQuestions" && item.matchedCount === 0));

  const injectionLikeIndustry = store.buildResearchCohort({ industry: "餐饮' OR 1=1 --" });
  assert.equal(injectionLikeIndustry.mode, "global_baseline");
  assert.equal(injectionLikeIndustry.globalFallbackApplied, true);

  console.log("Citation research question-set cohort check passed");
} finally {
  store.close();
}
