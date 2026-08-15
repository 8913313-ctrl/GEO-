import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderArticlePage, renderFixedPage, renderInsightsPage } from "../public-site/site-renderer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "qa-shots", "visual-review");
const origin = "http://preview.local";
const assetOrigin = "http://127.0.0.1:18080/site-assets-r9";
const themes = ["space-materials", "power-systems", "supply-chain"];

const pages = [
  { id: "home", path: "/", title: "首页", status: "published" },
  { id: "services", path: "/services/", title: "产品与服务", status: "published" },
  { id: "cases", path: "/cases/", title: "服务案例", status: "published" },
  { id: "about", path: "/about/", title: "关于我们", status: "published" },
  { id: "problem-map", path: "/problem-map/", title: "问题地图", status: "published" },
  { id: "contact", path: "/contact/", title: "联系我们", status: "published" },
  { id: "insights", path: "/insights/", title: "行业资讯", status: "published" }
];

const services = [
  { id: "solution", title: "行业解决方案", description: "按应用场景、产品范围与技术条件组织可执行的业务方案。", audience: "采购、技术与项目团队", focus: "需求确认、产品选型、交付支持", href: "/services/" },
  { id: "product", title: "产品与系统", description: "用清晰的产品信息、服务边界与资料入口支持客户判断。", audience: "产品负责人和使用团队", focus: "产品资料、应用说明、支持路径", href: "/services/" },
  { id: "support", title: "项目服务支持", description: "将沟通、资料准备、实施与持续支持连接为同一条服务路径。", audience: "项目管理与工程协作团队", focus: "方案沟通、实施协作、持续支持", href: "/contact/" }
];

const cases = [
  { id: "case-a", title: "重点项目场景记录", industry: "企业项目", service: "行业解决方案", summary: "围绕真实业务场景整理已审核的产品、服务与项目材料。", result: "项目资料与业务决策路径保持一致" },
  { id: "case-b", title: "产品服务协同项目", industry: "产品应用", service: "产品与系统", summary: "通过产品说明、应用条件和服务支持降低沟通成本。", result: "形成可持续更新的公开资料" },
  { id: "case-c", title: "长期服务与支持", industry: "服务支持", service: "项目服务支持", summary: "为后续的交付、维护和咨询建立清晰入口。", result: "客户可快速找到下一步" }
];

const categories = [
  { id: "solutions", slug: "solutions", name: "解决方案", description: "面向实际业务场景的公开资料" },
  { id: "products", slug: "products", name: "产品与技术", description: "产品与应用信息" },
  { id: "services", slug: "services", name: "服务支持", description: "项目与服务路径" }
];

const articles = [
  { id: "article-a", slug: "solution-planning", title: "如何从实际应用场景开始规划企业解决方案", categoryName: "解决方案", categorySlug: "solutions", author: "企业内容团队", publishedAt: "2026-08-10T09:00:00+08:00", excerpt: "先确认业务条件、产品边界和参与角色，再组织能够被采购、技术和项目团队共同使用的公开资料。", tags: ["解决方案", "应用场景"], contentHtml: "<h2>先梳理真实条件</h2><p>公开内容应以企业真实的产品资料、适用场景和服务边界为依据，让客户能快速完成第一轮判断。</p><h2>把下一步说清楚</h2><p>每一份资料都应连接到明确的咨询、选型或项目支持入口，而不是只停留在介绍层面。</p>" },
  { id: "article-b", slug: "product-information", title: "产品信息如何服务于采购与技术决策", categoryName: "产品与技术", categorySlug: "products", author: "企业内容团队", publishedAt: "2026-08-04T09:00:00+08:00", excerpt: "把产品能力、适用条件、资料来源和支持路径放在同一条信息链中。", tags: ["产品资料", "技术支持"], contentHtml: "<h2>资料应该可验证</h2><p>产品资料应使用企业已审核、来源明确的事实，不用无来源图片或无法验证的描述替代信息。</p><h2>建立服务入口</h2><p>当客户需要进一步确认时，应能立刻找到对应的团队和咨询方式。</p>" },
  { id: "article-c", slug: "service-handoff", title: "从咨询到交付：让服务路径保持连贯", categoryName: "服务支持", categorySlug: "services", author: "企业内容团队", publishedAt: "2026-07-28T09:00:00+08:00", excerpt: "清晰的服务路线能让客户理解需要准备什么、谁来响应，以及下一步会发生什么。", tags: ["服务流程", "项目支持"], contentHtml: "<h2>先确认需求范围</h2><p>通过真实的场景、资料和问题把需求范围说清楚，避免沟通在无效的信息之间来回。</p><h2>再进入实施协作</h2><p>项目记录、服务资料和后续支持应在官网中保持可被理解的连接关系。</p>" }
];

function siteFor(theme) {
  return {
    siteName: "桐灼企业示例",
    companyName: "桐灼企业示例",
    homeTitle: "以真实资料，建立可持续的企业公开信息",
    description: "企业产品、服务与已审核公开内容的统一入口。",
    cta: "提交业务咨询",
    theme: { key: theme },
    template: { key: theme },
    pages,
    navItems: [
      { label: "首页", path: "/" }, { label: "产品与服务", path: "/services/" }, { label: "关于我们", path: "/about/" },
      { label: "服务案例", path: "/cases/" }, { label: "行业资讯", path: "/insights/" }, { label: "联系我们", path: "/contact/" }
    ],
    services,
    cases,
    contact: { phone: "400 880 2026", email: "hello@example.com", address: "企业办公地址待配置" },
    legal: { icp: "" }
  };
}

function externalAssets(html) {
  return html.replaceAll("/site-assets-r9", assetOrigin);
}

function previewFilename(theme, pageId) {
  if (pageId === "home") return `production-${theme}-preview.html`;
  if (pageId === "insights") return `production-${theme}-listing-preview.html`;
  return `production-${theme}-${pageId}-preview.html`;
}

function rewritePreviewLinks(html, theme) {
  const pageByPath = new Map(pages.map((page) => [page.path, previewFilename(theme, page.id)]));
  const listingFilename = previewFilename(theme, "insights");
  const articleFilename = `production-${theme}-article-preview.html`;
  return externalAssets(html).replace(/href="([^"]+)"/g, (match, href) => {
    if (pageByPath.has(href)) return `href="./${pageByPath.get(href)}"`;
    if (href.startsWith("/insights/")) return `href="./${href === "/insights/" ? listingFilename : articleFilename}"`;
    if (href.startsWith("/problem-map/")) return `href="./${previewFilename(theme, "problem-map")}"`;
    return match;
  });
}

await mkdir(destination, { recursive: true });
for (const theme of themes) {
  const site = siteFor(theme);
  const fixedPages = pages.filter((page) => page.id !== "insights");
  const renderedFixedPages = fixedPages.map((page) => ({
    filename: previewFilename(theme, page.id),
    html: renderFixedPage({ site, page, articles, categories, origin })
  }));
  const listing = renderInsightsPage({ site, articles, categories, origin });
  const article = renderArticlePage({ site, article: articles[0], relatedArticles: articles.slice(1), origin }).html;
  const documents = [
    ...renderedFixedPages,
    { filename: previewFilename(theme, "insights"), html: listing },
    { filename: `production-${theme}-article-preview.html`, html: article }
  ];
  await Promise.all(documents.map(({ filename, html }) =>
    writeFile(path.join(destination, filename), rewritePreviewLinks(html, theme), "utf8")
  ));
}
console.log(`Generated ${themes.length * (pages.length + 1)} deterministic theme preview pages in ${destination}`);
