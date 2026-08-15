import { readFileSync } from "node:fs";
import { powerSystems, spaceMaterials, supplyChain } from "./industry-corporate.mjs";

const manifestUrl = new URL("./manifest.json", import.meta.url);
const rawManifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeKey(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

const packageList = Array.isArray(rawManifest.themes)
  ? rawManifest.themes.filter((item) => item && typeof item === "object" && item.key)
  : [];

const aliasMap = new Map();
for (const item of packageList) {
  aliasMap.set(normalizeKey(item.key), item.key);
  for (const alias of Array.isArray(item.aliases) ? item.aliases : []) {
    aliasMap.set(normalizeKey(alias), item.key);
  }
}

export const THEME_PACKAGE_SCHEMA_VERSION = Number(rawManifest.schemaVersion) || 1;
export const THEME_PACKAGE_VERSION = String(rawManifest.packageVersion || "1.0.0");
export const THEME_PACKAGES = deepFreeze(packageList);
export const SITE_THEME_PACKAGES = deepFreeze(Object.fromEntries(
  THEME_PACKAGES.map((item) => [item.key, item])
));

export function resolveThemePackageKey(value, fallback = "space-materials") {
  const fallbackKey = aliasMap.get(normalizeKey(fallback)) || "space-materials";
  return aliasMap.get(normalizeKey(value)) || fallbackKey;
}

export function getThemePackage(value, fallback = "space-materials") {
  return SITE_THEME_PACKAGES[resolveThemePackageKey(value, fallback)] || null;
}

export function listThemePackages() {
  return THEME_PACKAGES.map((item) => JSON.parse(JSON.stringify(item)));
}

export function pageTemplateFor(value, page, fallback = "space-materials") {
  const theme = getThemePackage(value, fallback);
  if (!theme || !theme.pages.includes(page)) return null;
  return theme.layout?.[page] || theme.layout?.public || null;
}

export function themeChromeClasses(value, fallback = "space-materials") {
  const theme = getThemePackage(value, fallback);
  if (!theme) return { header: "", footer: "" };
  return { header: theme.headerClass, footer: theme.footerClass };
}

export const THEME_PACKAGE_MANIFEST = deepFreeze({
  schemaVersion: THEME_PACKAGE_SCHEMA_VERSION,
  packageVersion: THEME_PACKAGE_VERSION,
  themes: THEME_PACKAGES
});

export const THEME_RENDERERS = Object.freeze({
  "space-materials": spaceMaterials,
  "power-systems": powerSystems,
  "supply-chain": supplyChain
});

export function getThemeRenderer(value, fallback = "space-materials") {
  return THEME_RENDERERS[resolveThemePackageKey(value, fallback)] || THEME_RENDERERS["space-materials"];
}
