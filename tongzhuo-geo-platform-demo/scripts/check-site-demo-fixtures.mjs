import assert from "node:assert/strict";
import {
  demoFixturesEnabled,
  findFrontendArticle,
  findFrontendProblem,
  findSiteProblem,
  renderFixedPage,
  renderInsightsPage,
  renderLlms,
  renderSitemap
} from "../public-site/site-renderer.mjs";

const previousEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  TZ_SITE_FRONTEND_DEMO: process.env.TZ_SITE_FRONTEND_DEMO
};

const origin = "https://demo-gate.example.test";
const baseSite = {
  frontendDemo: true,
  siteName: "演示门测试企业",
  companyName: "演示门测试企业有限公司",
  description: "用于验证演示内容安全门。",
  cta: "预约诊断",
  pages: [
    { id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true },
    { id: "services", title: "产品与服务", path: "/services/", status: "published", sitemapEnabled: true },
    { id: "insights", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true }
  ],
  navItems: [],
  modules: {},
  contact: {},
  services: null,
  cases: null,
  problemGroups: null
};

function setEnvironment({ nodeEnv, demo }) {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (demo === undefined) delete process.env.TZ_SITE_FRONTEND_DEMO;
  else process.env.TZ_SITE_FRONTEND_DEMO = demo;
}

function renderHome(site = baseSite, articles = [], categories = []) {
  return renderFixedPage({
    site,
    page: site.pages.find((item) => item.id === "home"),
    articles,
    categories,
    origin
  });
}

try {
  // A legacy snapshot may still carry frontendDemo=true. Without an explicit
  // local opt-in the renderer is the final safety boundary and must ignore it.
  setEnvironment({ nodeEnv: "development" });
  assert.equal(demoFixturesEnabled(baseSite), false);
  const defaultHome = renderHome();
  assert.doesNotMatch(defaultHome, /工业设备企业公开信源建设|工业品企业做 GEO，第一步不是批量写文章/);
  const defaultHeader = defaultHome.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] || "";
  assert.doesNotMatch(defaultHeader, /href="\/cases\/"|href="\/problem-map\/"/);
  assert.equal(findFrontendArticle("industrial-geo-first-step"), null);
  assert.equal(findFrontendProblem("industrial-geo-start"), null);
  assert.equal(findSiteProblem(baseSite, "industrial-geo-start"), null);

  // The opt-in is deliberately narrow: explicit truthy value, non-production
  // process, and a snapshot that belongs to a demo-enabled project.
  setEnvironment({ nodeEnv: "development", demo: "true" });
  assert.equal(demoFixturesEnabled(baseSite), true);
  const demoHome = renderHome();
  assert.match(demoHome, /工业设备企业公开信源建设/);
  assert.match(demoHome, /工业品企业做 GEO，第一步不是批量写文章/);
  assert.ok(findFrontendArticle("industrial-geo-first-step"));
  assert.ok(findFrontendProblem("industrial-geo-start"));
  assert.ok(findSiteProblem(baseSite, "industrial-geo-start"));
  const demoInsights = renderInsightsPage({ site: baseSite, articles: [], categories: [], origin });
  assert.match(demoInsights, /演示内容/);
  assert.doesNotMatch(demoInsights, /GEO优化<\/strong>/);

  // Explicitly empty CMS collections are authoritative and must never be
  // replaced by presentation fixtures, even during an opted-in walkthrough.
  const emptyCmsSite = { ...baseSite, services: [], cases: [], problemGroups: [] };
  const emptyCmsHome = renderHome(emptyCmsSite);
  assert.doesNotMatch(emptyCmsHome, /工业设备企业公开信源建设/);
  assert.equal(findSiteProblem(emptyCmsSite, "industrial-geo-start"), null);

  // Real records win over fixtures. Their empty/null distinction remains
  // intact so a customer deployment cannot silently inherit Tongzhuo copy.
  const officialServiceTitle = "正式审核服务";
  const officialArticleTitle = "正式审核文章";
  const officialSite = {
    ...baseSite,
    services: [{ id: "official", title: officialServiceTitle, description: "正式公开说明", status: "published", href: "/services/#official" }],
    cases: [],
    problemGroups: []
  };
  const officialArticle = {
    id: "official-article", slug: "official-article", title: officialArticleTitle,
    categoryName: "正式栏目", categorySlug: "official", author: "正式团队",
    publishedAt: "2026-08-12T00:00:00.000Z", excerpt: "正式公开摘要", contentHtml: "<h2>正式正文</h2><p>已审核。</p>"
  };
  const officialHome = renderHome(officialSite, [officialArticle], [{ id: "official", name: "正式栏目", slug: "official" }]);
  assert.match(officialHome, new RegExp(officialServiceTitle));
  assert.match(officialHome, new RegExp(officialArticleTitle));
  assert.doesNotMatch(officialHome, /工业设备企业公开信源建设|工业品企业做 GEO，第一步不是批量写文章/);

  // Production refuses fixtures even when both the environment and stale
  // snapshot are accidentally set to true. Machine endpoints stay clean too.
  setEnvironment({ nodeEnv: "production", demo: "true" });
  assert.equal(demoFixturesEnabled(baseSite), false);
  const productionHome = renderHome();
  assert.doesNotMatch(productionHome, /工业设备企业公开信源建设|工业品企业做 GEO，第一步不是批量写文章/);
  assert.equal(findFrontendArticle("industrial-geo-first-step"), null);
  assert.equal(findFrontendProblem("industrial-geo-start"), null);
  const sitemap = renderSitemap({ site: baseSite, articles: [], categories: [], origin });
  const llms = renderLlms({ site: baseSite, articles: [], origin });
  assert.doesNotMatch(sitemap, /industrial-geo-start|industrial-geo-first-step|problem-map/);
  assert.doesNotMatch(llms, /工业品企业做 GEO|工业品企业做 GEO，第一步不是批量写文章/);

  console.log("Explicit development demo gate, CMS precedence, production refusal, and machine-output checks passed.");
} finally {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
