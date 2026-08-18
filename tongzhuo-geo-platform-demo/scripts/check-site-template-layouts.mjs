import assert from "node:assert/strict";
import { renderArticlePage, renderFixedPage, renderInsightsPage } from "../public-site/site-renderer.mjs";
import { SITE_TEMPLATES } from "../site-template-registry.mjs";

const home = { id: "home", path: "/", title: "首页", status: "published" };
const sourceSite = {
  siteName: "模板验收企业",
  companyName: "模板验收企业",
  description: "用统一 CMS 数据验收不同的行业官网布局。",
  theme: {},
  pages: [home],
  navItems: [],
  modules: { home: [{ id: "hero", type: "hero", title: "首屏", content: "从真实业务场景开始组织企业公开表达。", status: "published" }] },
  services: [
    { id: "cms-service-image", title: "带图服务内容", description: "这条服务带有 CMS 图片。", image: "https://example.com/service.jpg", imageAlt: "服务现场", status: "published", order: 1 },
    { id: "cms-service-no-image", title: "无图服务内容", description: "这条服务没有图片，必须保留 SVG 无图状态。", status: "published", order: 2 }
  ],
  cases: [
    { id: "cms-case-image", title: "带图 CMS 案例", industry: "制造业", service: "带图服务内容", summary: "这条案例带图片。", result: "已验证", image: "https://example.com/case.jpg", imageAlt: "案例现场", status: "published", order: 1 },
    { id: "cms-case-no-image", title: "无图 CMS 案例", industry: "建筑业", service: "无图服务内容", summary: "这条案例没有图片。", result: "待补充", status: "published", order: 2 }
  ],
  problemGroups: [{ id: "cms-problem-group", service: "带图服务内容", status: "published", order: 1, questions: [{ id: "cms-problem", slug: "cms-question", title: "CMS 问题内容", answer: "这条直接回答由同一份 CMS 数据提供。", status: "published", order: 1 }] }],
  frontendDemo: false
};
const articles = [
  { id: "cms-article-image", slug: "cms-article-image", title: "带图 CMS 文章", excerpt: "这条文章带图片。", image: "https://example.com/article.jpg", imageAlt: "文章现场", categoryName: "行业观点", publishedAt: "2026-08-18T00:00:00.000Z", status: "published" },
  { id: "cms-article-no-image", slug: "cms-article-no-image", title: "无图 CMS 文章", excerpt: "这条文章没有图片。", categoryName: "行业观点", publishedAt: "2026-08-17T00:00:00.000Z", status: "published" }
];

const sourceTemplates = SITE_TEMPLATES.filter((template) => template.sourceReady === true);
assert.deepEqual(sourceTemplates.map((template) => template.key), ["01-industry", "02-construction"]);

for (const template of SITE_TEMPLATES) {
  const site = { ...sourceSite, templateKey: template.key, theme: { templateKey: template.key } };
  const html = renderFixedPage({ site, page: home, articles, categories: [], origin: "http://template-check.local", preview: true, assetBase: "/api/v1/site-cms/preview/assets" });
  assert.match(html, new RegExp(`data-site-template="${template.key}"`));
  assert.match(html, /带图服务内容/);

  if (template.sourceReady === true) {
    assert.match(html, /带图 CMS 文章/);
    assert.match(html, new RegExp(`<link rel="stylesheet" href="/api/v1/site-cms/preview/assets/${template.stylesheet}\\?`));
    assert.doesNotMatch(html, /site-v8\.css/);
    assert.match(html, /template-runtime\.js/);
    assert.match(html, /class="template-source template-source-(01|02)/);
    assert.match(html, /template-case-media/);
    assert.match(html, /template-news-media/);

    if (template.key === "01-industry") {
      assert.match(html, /products-grid/);
      assert.match(html, /template-product-media has-template-image/);
      assert.match(html, /template-product-media no-template-image/);
    }
    if (template.key === "02-construction") {
      assert.match(html, /services-grid/);
      assert.match(html, /service-media/);
      assert.match(html, /template-service-media has-template-image/);
      assert.match(html, /class="service-icon"/);
    }

    const insights = renderInsightsPage({ site, articles, categories: [], origin: "http://template-check.local" });
    assert.match(insights, new RegExp(template.stylesheet));
    assert.doesNotMatch(insights, /site-v8\.css/);
    assert.match(insights, /news-grid|news-list/);

    const article = renderArticlePage({
      site,
      article: { ...articles[0], contentHtml: "<h2>CMS 正文</h2><p>文章正文必须继续来自 CMS。</p>" },
      origin: "http://template-check.local"
    }).html;
    assert.match(article, new RegExp(template.stylesheet));
    assert.doesNotMatch(article, /site-v8\.css/);
    assert.match(article, /CMS 正文/);
  } else {
    assert.equal(template.status, "pending", `${template.key} must remain explicitly pending until its source HTML/CSS is adapted`);
  }
}

console.log(`Site template isolation check passed (${sourceTemplates.length} ready, ${SITE_TEMPLATES.length - sourceTemplates.length} pending)`);
