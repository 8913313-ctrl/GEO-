import { GEO_ARTICLE_PROMPT_DRAFT, GEO_CONTENT_QUALITY_DRAFT, GEO_CORE_DRAFT } from "./geo-core-drafts.mjs";

export function ensureGeoPromptAndQualityDrafts(store, actor = null) {
  let promptTemplate = store.promptTemplateByKey(GEO_ARTICLE_PROMPT_DRAFT.template.key, { scope: "global" });
  if (!promptTemplate) promptTemplate = store.createPromptTemplate(GEO_ARTICLE_PROMPT_DRAFT.template, actor);
  let promptVersion = store.promptVersions(promptTemplate.id).find((version) => version.id === GEO_ARTICLE_PROMPT_DRAFT.version.id);
  if (!promptVersion) promptVersion = store.createPromptVersion({ templateId: promptTemplate.id, ...GEO_ARTICLE_PROMPT_DRAFT.version }, actor);

  const existingTests = new Set(store.connection.prepare("SELECT id FROM prompt_test_cases WHERE prompt_version_id = ?").all(promptVersion.id).map((row) => row.id));
  for (const test of GEO_ARTICLE_PROMPT_DRAFT.tests) if (!existingTests.has(test.id)) store.createPromptTestCase({ promptVersionId: promptVersion.id, ...test }, actor);

  let qualityRulePack = store.qualityRulePacksByKey(GEO_CONTENT_QUALITY_DRAFT.key, { scope: "global" }).find((pack) => pack.id === GEO_CONTENT_QUALITY_DRAFT.id);
  if (!qualityRulePack) qualityRulePack = store.createQualityRulePack(GEO_CONTENT_QUALITY_DRAFT, actor);

  return { promptTemplate, promptVersion, qualityRulePack };
}

export function ensureGeoFoundationDrafts(store, actor = null) {
  let methodologyPack = store.methodologyPackByKey(GEO_CORE_DRAFT.pack.key, { scope: "global" });
  if (!methodologyPack) methodologyPack = store.createMethodologyPack(GEO_CORE_DRAFT.pack, actor);
  let methodologyVersion = store.methodologyVersions(methodologyPack.id).find((version) => version.id === GEO_CORE_DRAFT.version.id);
  if (!methodologyVersion) methodologyVersion = store.createMethodologyVersion({ packId: methodologyPack.id, ...GEO_CORE_DRAFT.version }, actor);

  const { promptTemplate, promptVersion, qualityRulePack } = ensureGeoPromptAndQualityDrafts(store, actor);

  return { methodologyPack, methodologyVersion, promptTemplate, promptVersion, qualityRulePack };
}

export function ensureGeoFoundationPublishedAssets(store, actor = null) {
  const assets = ensureGeoFoundationDrafts(store, actor);
  const promptVersion = assets.promptVersion.status === "published" ? assets.promptVersion : store.setPromptVersionStatus(assets.promptVersion.id, "published", actor);
  const qualityRulePack = assets.qualityRulePack.status === "published" ? assets.qualityRulePack : store.setQualityRulePackStatus(assets.qualityRulePack.id, "published", actor);
  return { ...assets, promptVersion, qualityRulePack };
}

export function ensureGeoPromptAndQualityPublishedAssets(store, actor = null) {
  const assets = ensureGeoPromptAndQualityDrafts(store, actor);
  const promptVersion = assets.promptVersion.status === "published" ? assets.promptVersion : store.setPromptVersionStatus(assets.promptVersion.id, "published", actor);
  const qualityRulePack = assets.qualityRulePack.status === "published" ? assets.qualityRulePack : store.setQualityRulePackStatus(assets.qualityRulePack.id, "published", actor);
  return { ...assets, promptVersion, qualityRulePack };
}
