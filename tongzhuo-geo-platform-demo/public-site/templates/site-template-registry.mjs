import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
export const SITE_TEMPLATE_CSS = readFileSync(path.join(moduleRoot, "..", "themes", "templates.css"), "utf8");

const TEMPLATE_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "space-materials", category: "building-materials", variant: "material-archive", layout: "spatial-archive", listingLayout: "material-journal", articleLayout: "spatial-reading", imageTreatment: "space", name: "空间材料 · 材料档案", description: "以空间、材料、工程案例与设计服务组织内容，适合瓷砖、建材与空间材料企业。", color: "#8c6e59", aliases: Object.freeze(["tiles", "tile", "ceramic", "ceramics", "space", "building-materials-archive"]) }),
  Object.freeze({ key: "power-systems", category: "technical", variant: "power-console", layout: "control-console", listingLayout: "technical-manual", articleLayout: "power-manual", imageTreatment: "technical", name: "UPS / 数据中心 · 工况控制台", description: "按真实工况、产品选型、技术资料与支持路径组织内容，适合 UPS 与数据中心企业。", color: "#e4a15f", aliases: Object.freeze(["ups-console", "data-center", "power-system", "power-systems", "critical-power"]) }),
  Object.freeze({ key: "supply-chain", category: "logistics", variant: "service-split", layout: "service-network", listingLayout: "dispatch-board", articleLayout: "route-reading", imageTreatment: "operation", name: "物流 / 供应链 · 服务分流", description: "将寄递、企业物流、行业方案和合作需求分为明确入口，适合物流与供应链企业。", color: "#153e3b", aliases: Object.freeze(["logistics", "logistic", "supply-chain-service", "supplychain", "delivery"]) })
]);

// The first delivery contained six visual experiments that were not approved
// as production website packages. Keep only their data migration here: they
// are not selectable, not rendered and are never exposed to users.
const RETIRED_TEMPLATE_MIGRATIONS = Object.freeze({
  professional: "space-materials",
  industrial: "space-materials",
  energy: "power-systems",
  beauty: "space-materials",
  "engineering-case": "space-materials",
  "product-matrix": "supply-chain"
});

export const DEFAULT_SITE_TEMPLATE_KEY = "space-materials";
export const SITE_TEMPLATES = Object.freeze(Object.fromEntries(TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition])));

const TEMPLATE_ALIASES = new Map();
for (const definition of TEMPLATE_DEFINITIONS) {
  TEMPLATE_ALIASES.set(definition.key, definition.key);
  for (const alias of definition.aliases) TEMPLATE_ALIASES.set(alias, definition.key);
}
for (const [retiredKey, replacementKey] of Object.entries(RETIRED_TEMPLATE_MIGRATIONS)) {
  TEMPLATE_ALIASES.set(retiredKey, replacementKey);
}

export function resolveSiteTemplateKey(value, fallback = DEFAULT_SITE_TEMPLATE_KEY) {
  const candidate = String(value || "").trim().toLocaleLowerCase("en-US");
  const fallbackKey = TEMPLATE_ALIASES.get(String(fallback || "").trim().toLocaleLowerCase("en-US")) || DEFAULT_SITE_TEMPLATE_KEY;
  return TEMPLATE_ALIASES.get(candidate) || fallbackKey;
}

export function getSiteTemplate(value) {
  return SITE_TEMPLATES[resolveSiteTemplateKey(value)];
}

export function listSiteTemplates() {
  return TEMPLATE_DEFINITIONS.map(({ aliases: _aliases, ...definition }) => ({ ...definition }));
}
