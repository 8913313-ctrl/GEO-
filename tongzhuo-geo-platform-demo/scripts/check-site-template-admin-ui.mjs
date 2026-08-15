import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

for (const key of ["space-materials", "power-systems", "supply-chain"]) {
  assert.match(app, new RegExp(`key: "${key}"`), `Admin UI must expose ${key}.`);
  assert.match(app, new RegExp(`value="\\$\\{escapeHtml\\(template.key\\)\\}"`), "Template values must be rendered from the allowlisted registry view model.");
}

assert.match(app, /name="site-template-key"/);
assert.match(app, /data-template-key="\$\{escapeHtml\(template\.key\)\}"/);
assert.match(app, /SITE_TEMPLATE_KEYS = new Set\(\["space-materials", "power-systems", "supply-chain"\]\)/);
assert.match(app, /allowedTemplateKeys = SITE_TEMPLATE_KEYS/);
assert.match(app, /theme\.key = templateKey/);
assert.match(app, /previewSelectedSiteTemplate\(\)/);
assert.match(app, /syncSiteTemplateSelection\(selected\)/);
assert.match(app, /保存后只更新官网草稿/);
assert.match(app, /首页、资讯、文章、固定页、页头和页尾会一起替换/);
assert.match(app, /templatePreview = \(template\)/);
assert.match(app, /首页、资讯列表、文章详情、服务、案例、问题地图、关于、联系、页头与页尾/);
assert.match(app, /咨询入口尚未公开/);
assert.match(app, /避免首页按钮跳转到 404 页面/);
assert.match(styles, /\.site-template-picker\s*\{/);
assert.match(styles, /\.site-template-option:focus-within\s*\{/);
assert.match(styles, /\.site-template-preview\s*\{/);
assert.match(styles, /\.site-template-preview-material\s*\{/);
assert.match(styles, /\.site-template-preview-power\s*\{/);
assert.match(styles, /\.site-template-preview-supply\s*\{/);
assert.match(styles, /@media[\s\S]*\.site-template-picker\s*\{\s*grid-template-columns:\s*repeat\(2/);
assert.match(styles, /\.site-template-picker\s*\{[^}]*grid-template-columns:\s*repeat\(3/);

console.log("Official-site template admin selection, allowlist, draft messaging, focus and responsive checks passed.");
