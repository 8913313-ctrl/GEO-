import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
export const SITE_TEMPLATE_CSS = readFileSync(path.join(moduleRoot, "..", "themes", "templates.css"), "utf8");

const TEMPLATE_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "professional", category: "professional", variant: "editorial", name: "专业服务 · 编辑档案", description: "克制、可信，适合咨询、专业服务与知识型企业。", color: "#5e1d2e", aliases: Object.freeze(["passport", "professional-services", "professional/editorial", "editorial", "standard", "default"]) }),
  Object.freeze({ key: "industrial", category: "industrial", variant: "building-materials", name: "工业制造 · 工程材料", description: "强调产品规格、应用场景、工程能力与案例证据。", color: "#b85b32", aliases: Object.freeze(["manufacturing", "machinery", "industrial/building-materials", "building-materials"]) }),
  Object.freeze({ key: "energy", category: "technical", variant: "ups-energy", name: "技术设备 · UPS 能源", description: "强调可靠性、参数边界、选型与安装运维。", color: "#0d6b67", aliases: Object.freeze(["ups", "power", "technical/ups-energy", "ups-energy", "energy-equipment"]) }),
  Object.freeze({ key: "beauty", category: "consumer", variant: "beauty", name: "消费品牌 · 美妆", description: "强调成分、适用人群、使用方法、合规与安全。", color: "#9d536b", aliases: Object.freeze(["cosmetics", "skincare", "consumer/beauty", "consumer"]) })
]);

export const DEFAULT_SITE_TEMPLATE_KEY = "professional";
export const SITE_TEMPLATES = Object.freeze(Object.fromEntries(TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition])));

const TEMPLATE_ALIASES = new Map();
for (const definition of TEMPLATE_DEFINITIONS) {
  TEMPLATE_ALIASES.set(definition.key, definition.key);
  for (const alias of definition.aliases) TEMPLATE_ALIASES.set(alias, definition.key);
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
