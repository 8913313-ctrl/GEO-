import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

for (const key of ["professional", "industrial", "energy", "beauty"]) {
  assert.match(app, new RegExp(`key: "${key}"`), `Admin UI must expose ${key}.`);
  assert.match(app, new RegExp(`value="\\$\\{escapeHtml\\(template.key\\)\\}"`), "Template values must be rendered from the allowlisted registry view model.");
}

assert.match(app, /name="site-template-key"/);
assert.match(app, /allowedTemplateKeys = new Set\(\["professional", "industrial", "energy", "beauty"\]\)/);
assert.match(app, /theme\.key = templateKey/);
assert.match(app, /保存后只更新官网草稿/);
assert.match(styles, /\.site-template-picker\s*\{/);
assert.match(styles, /\.site-template-option:focus-within\s*\{/);
assert.match(styles, /@media[\s\S]*\.site-template-picker\s*\{\s*grid-template-columns:\s*repeat\(2/);

console.log("Official-site template admin selection, allowlist, draft messaging, focus and responsive checks passed.");
