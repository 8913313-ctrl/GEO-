import assert from "node:assert/strict";
import { renderArticlePage, renderFixedPage } from "../public-site/site-renderer.mjs";
import { SITE_TEMPLATES } from "../site-template-registry.mjs";

const home = { id: "home", path: "/", title: "首页", status: "published" };
const pages = [
  home,
  { id: "about", path: "/about/", title: "关于我们", status: "published" },
  { id: "services", path: "/services/", title: "草稿服务页", status: "draft" },
  { id: "extension-page", path: "/extension-page/", title: "已发布扩展页", status: "published" }
];
const navItems = [
  { id: "nav-home", label: "一级导航首页", path: "/", visible: true },
  { id: "nav-about", label: "一级导航关于", path: "/about/", visible: true },
  { id: "nav-services", label: "草稿核心页错误入口", path: "/services/", visible: true },
  { id: "nav-extension", label: "扩展页错误入口", path: "/extension-page/", visible: true }
];

function assertNavigation(html, templateKey, surface) {
  assert.match(html, /一级导航首页/, `${templateKey} ${surface} must retain published core navigation`);
  assert.match(html, /一级导航关于/, `${templateKey} ${surface} must retain published core navigation`);
  assert.doesNotMatch(html, /草稿核心页错误入口/, `${templateKey} ${surface} must hide draft core pages`);
  assert.doesNotMatch(html, /扩展页错误入口/, `${templateKey} ${surface} must hide extension pages`);
}

for (const template of SITE_TEMPLATES) {
  const site = {
    siteName: "导航规则验收企业",
    companyName: "导航规则验收企业",
    description: "验证扩展页和草稿页不会进入官网一级导航。",
    templateKey: template.key,
    theme: { templateKey: template.key },
    pages,
    navItems,
    modules: { home: [{ id: "hero", type: "hero", title: "首屏", content: "导航规则验收。", status: "published" }] },
    services: [],
    cases: [],
    problemGroups: [],
    frontendDemo: false
  };
  const homeHtml = renderFixedPage({ site, page: home, articles: [], categories: [], origin: "https://navigation-check.test", preview: true });
  assertNavigation(homeHtml, template.key, "home");
  if (template.key === "01-industry") assert.doesNotMatch(homeHtml, /加入我们/, "industry topbar must not bypass CMS navigation rules");

  const articleHtml = renderArticlePage({
    site,
    article: {
      id: "navigation-check-article",
      slug: "navigation-check-article",
      title: "导航规则验收文章",
      excerpt: "用于覆盖文章页导航壳层。",
      contentHtml: "<h2>正文</h2><p>导航规则验收。</p>",
      contentText: "正文 导航规则验收",
      status: "published",
      publishedAt: "2026-08-27T00:00:00.000Z"
    },
    origin: "https://navigation-check.test"
  }).html;
  assertNavigation(articleHtml, template.key, "article");
}

console.log("Official site primary navigation check passed");
