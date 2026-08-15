import { createHash } from "node:crypto";
import professionalServices from "./professional-services.mjs";
import buildingMaterials from "./building-materials.mjs";
import machinery from "./machinery.mjs";
import energyEquipment from "./energy-equipment.mjs";
import beautyConsumer from "./beauty-consumer.mjs";

const REQUIRED_KEYS = Object.freeze([
  "templateKey", "displayName", "requiredFields", "defaultQuestionGroups",
  "contentTypes", "terminologyPack", "promptPreset", "navigationPreset", "version"
]);
const FORBIDDEN_CUSTOMER_KEYS = new Set([
  "workspace_id", "workspaceId", "company_profile", "companyName", "legalName", "shortName",
  "brand", "brandName", "contact", "phone", "email", "domain", "footerIcp"
]);

function clone(value) {
  return structuredClone(value);
}

function assertText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`Industry template ${field} must be non-empty text.`);
}

function assertUniqueTextList(value, field) {
  if (!Array.isArray(value) || !value.length) throw new TypeError(`Industry template ${field} must be a non-empty array.`);
  value.forEach((item, index) => assertText(item, `${field}[${index}]`));
  if (new Set(value).size !== value.length) throw new TypeError(`Industry template ${field} contains duplicates.`);
}

function rejectCustomerData(value, path = "template") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_CUSTOMER_KEYS.has(key)) throw new TypeError(`Industry template cannot contain customer field ${path}.${key}.`);
    rejectCustomerData(child, `${path}.${key}`);
  }
}

export function validateIndustryTemplate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Industry template must be an object.");
  for (const key of REQUIRED_KEYS) if (!(key in input)) throw new TypeError(`Industry template is missing ${key}.`);
  assertText(input.templateKey, "templateKey");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.templateKey)) throw new TypeError("Industry templateKey must use lowercase kebab-case.");
  assertText(input.displayName, "displayName");
  assertText(input.version, "version");
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) throw new TypeError("Industry template version must use semantic versioning.");
  assertUniqueTextList(input.requiredFields, "requiredFields");
  assertUniqueTextList(input.contentTypes, "contentTypes");
  assertUniqueTextList(input.navigationPreset, "navigationPreset");
  if (!Array.isArray(input.defaultQuestionGroups) || !input.defaultQuestionGroups.length) throw new TypeError("Industry template defaultQuestionGroups must be non-empty.");
  const groupKeys = new Set();
  for (const [index, group] of input.defaultQuestionGroups.entries()) {
    assertText(group?.key, `defaultQuestionGroups[${index}].key`);
    assertText(group?.name, `defaultQuestionGroups[${index}].name`);
    assertUniqueTextList(group?.intents, `defaultQuestionGroups[${index}].intents`);
    if (groupKeys.has(group.key)) throw new TypeError(`Industry template contains duplicate question group ${group.key}.`);
    groupKeys.add(group.key);
  }
  if (!input.terminologyPack || typeof input.terminologyPack !== "object" || Array.isArray(input.terminologyPack)) throw new TypeError("Industry template terminologyPack must be an object.");
  for (const key of ["offering", "customer", "scenario", "evidence", "conversion"]) assertText(input.terminologyPack[key], `terminologyPack.${key}`);
  assertText(input.promptPreset?.key, "promptPreset.key");
  assertText(input.promptPreset?.version, "promptPreset.version");
  rejectCustomerData(input);
  const value = clone(input);
  value.checksum = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return value;
}

const templates = [professionalServices, buildingMaterials, machinery, energyEquipment, beautyConsumer].map(validateIndustryTemplate);
const registry = new Map(templates.map((template) => [template.templateKey, template]));

if (registry.size !== templates.length) throw new TypeError("Industry template keys must be unique.");

export function industryTemplateKeys() {
  return [...registry.keys()];
}

export function resolveIndustryTemplate(templateKey) {
  const key = String(templateKey || "").trim();
  return registry.has(key) ? clone(registry.get(key)) : null;
}

export function requireIndustryTemplate(templateKey) {
  const template = resolveIndustryTemplate(templateKey);
  if (!template) throw new RangeError(`Unknown industry template: ${String(templateKey || "(empty)")}`);
  return template;
}
