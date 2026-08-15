import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { industryTemplateKeys, requireIndustryTemplate, resolveIndustryTemplate, validateIndustryTemplate } from "../industry-templates/index.mjs";

assert.deepEqual(industryTemplateKeys(), ["professional-services", "building-materials", "machinery", "energy-equipment", "beauty-consumer"]);
assert.equal(resolveIndustryTemplate("missing"), null);

const buildingMaterials = requireIndustryTemplate("building-materials");
const machinery = requireIndustryTemplate("machinery");
const energyEquipment = requireIndustryTemplate("energy-equipment");
const beautyConsumer = requireIndustryTemplate("beauty-consumer");
for (const template of [buildingMaterials, machinery, energyEquipment, beautyConsumer]) {
  for (const key of ["templateKey", "displayName", "requiredFields", "defaultQuestionGroups", "contentTypes", "terminologyPack", "promptPreset", "navigationPreset"]) {
    assert.ok(Object.hasOwn(template, key), `${template.templateKey} is missing ${key}`);
  }
  assert.ok(template.requiredFields.includes("company_profile.legal_name"));
  assert.ok(template.promptPreset.key.startsWith("geo-"));
  assert.match(template.version, /^\d+\.\d+\.\d+$/);
  assert.match(template.checksum, /^[0-9a-f]{64}$/);
  assert.notEqual(template.promptPreset.version, "unassigned");
}
assert.notDeepEqual(buildingMaterials.defaultQuestionGroups, machinery.defaultQuestionGroups, "industry defaults must adapt to the selected industry");
assert.notDeepEqual(energyEquipment.defaultQuestionGroups, beautyConsumer.defaultQuestionGroups, "UPS and beauty must share the GEO core without sharing industry questions");

buildingMaterials.displayName = "changed by caller";
assert.equal(requireIndustryTemplate("building-materials").displayName, "建材", "registry values must not be mutable through callers");

assert.throws(() => validateIndustryTemplate({ ...machinery, companyName: "Customer A" }), /cannot contain customer field/);
assert.throws(() => validateIndustryTemplate({ ...machinery, templateKey: "Machinery" }), /kebab-case/);
assert.throws(() => requireIndustryTemplate(""), /Unknown industry template/);

const exampleConfig = JSON.parse(await readFile(new URL("../../tongzhuo-product-template/config/client-config.example.json", import.meta.url), "utf8"));
assert.equal(requireIndustryTemplate(exampleConfig.industry_template).templateKey, exampleConfig.industry_template, "project configuration must select a registered industry template");

const serialized = JSON.stringify([buildingMaterials, machinery, energyEquipment, beautyConsumer]);
assert.doesNotMatch(serialized, /桐灼|灼见|鲁ICP备|deployment_tongzhuo_geo/, "industry templates must not contain Tongzhuo customer data");

console.log("Industry adaptation template contract checks passed.");
